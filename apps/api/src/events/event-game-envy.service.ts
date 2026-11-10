import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { familyOf, type EventEnvyDto } from '@master-jdr/shared';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { eventIsOpen } from './event-is-open';
import {
  CANCELLED_EVENT_MESSAGE,
  EVENING_CANCELLED_MESSAGE,
  EVENING_FINISHED_MESSAGE,
  EventsService,
  PAST_ROSTER_MESSAGE,
  isRalliementGroup,
} from './events.service';
import { participantsOf } from './participants-of';

/** Refus de signaler une Envie sur une soirée à laquelle on ne participe pas (Story 49.5) : étranger, membre
 *  non inscrit ou place seulement réservée. */
export const ENVY_NOT_PARTICIPANT_MESSAGE =
  'Seuls les participants de la soirée peuvent y signaler une envie';

/** Refus d'une Envie sur un nom de jeu qui n'est pas sur place (Story 49.5) : aucune source ne le porte. */
export const ENVY_NOT_ON_SITE_MESSAGE = "Ce jeu n'est pas sur place pour cette soirée";

/**
 * Les Envies d'une soirée (épic 49, Story 49.5) — SEUL écrivain de `EventGameEnvy`. Le droit de rôle est décidé
 * par `PermissionService` (`EVENT_GAME_ENVY` sur la cible `{ eventId }`) ; le reste — soirée ouverte, appelant
 * participant, nom sur place — est lu SOUS le verrou de la ligne `Event` (la même que les inscriptions et les
 * apports) : une désinscription, un apport retiré ou un écart concurrents ne se glissent pas entre la décision
 * et l'écriture. Le « sur place » est celui d'`onSiteNameKeys`, lu par `EventsService` sur le client de la
 * transaction (les clés viennent de `BoardGamesService`, seul lecteur de `BoardGame`). Une Envie porte sur un
 * NOM (`nameKey`), jamais sur un identifiant de jeu.
 */
@Injectable()
export class EventGameEnvyService {
  private readonly logger = new Logger(EventGameEnvyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /** J'ai envie de jouer à ce jeu ce soir. Idempotent : déjà signalée → rien ne change. */
  async envy(eventId: string, nameKey: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, userId, true, async (tx, onSite) => {
      if (!onSite.has(nameKey)) throw new BadRequestException(ENVY_NOT_ON_SITE_MESSAGE);
      await tx.eventGameEnvy.upsert({
        where: { eventId_userId_nameKey: { eventId, userId, nameKey } },
        create: { eventId, userId, nameKey },
        update: {},
      });
    });
    this.emit(partieId, eventId);
  }

  /** Je n'ai plus envie de ce jeu. Idempotent : pas d'Envie → rien ne change. Retirer sa propre ligne est sans
   *  danger : ni la qualité de participant ni le « sur place » ne sont revérifiés. */
  async unenvy(eventId: string, nameKey: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, userId, false, async (tx) => {
      await tx.eventGameEnvy.deleteMany({ where: { eventId, userId, nameKey } });
    });
    this.emit(partieId, eventId);
  }

  /**
   * Les Envies des participants ACTUELS d'une soirée sur les noms SUR PLACE (Story 49.5), triées par clé puis par
   * pseudo. Lecture seule, sans décision de droit : l'appelant (`EventBoardGamesService`) a décidé `PARTIE_READ`
   * et fournit les participants et les noms sur place (`onSiteNameKeys`). Une Envie dont le nom a quitté la
   * soirée est ignorée ici, même si sa ligne existe encore (suppression de la Ludothèque, renommage).
   */
  async listFor(
    eventId: string,
    participantIds: string[],
    onSite: ReadonlySet<string>,
  ): Promise<EventEnvyDto[]> {
    if (participantIds.length === 0 || onSite.size === 0) return [];
    const rows = await this.prisma.eventGameEnvy.findMany({
      where: { eventId, userId: { in: participantIds }, nameKey: { in: [...onSite] } },
      select: {
        nameKey: true,
        user: { select: { id: true, pseudo: true, displayName: true } },
      },
    });
    const byKey = new Map<string, EventEnvyDto>();
    for (const row of rows) {
      const entry = byKey.get(row.nameKey) ?? { nameKey: row.nameKey, users: [] };
      entry.users.push({
        userId: row.user.id,
        pseudo: row.user.pseudo,
        displayName: row.user.displayName,
      });
      byKey.set(row.nameKey, entry);
    }
    const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return [...byKey.values()]
      .sort((a, b) => compare(a.nameKey, b.nameKey))
      .map((entry) => ({
        nameKey: entry.nameKey,
        users: [...entry.users].sort(
          (a, b) => compare(a.pseudo, b.pseudo) || compare(a.userId, b.userId),
        ),
      }));
  }

  /**
   * Cœur commun des deux écritures : droit de rôle, puis — sous le verrou de l'`Event`, base relue sur le
   * client de la transaction — les refus dans l'ordre : soirée annulée (400) ; soirée terminée (400) ;
   * seulement si `strict` (signaler) : appelant hors de `participantsOf`, place réservée comprise (403) ; nom
   * non sur place (400, décidé par `apply` avec l'ensemble `onSite` fourni, vide pour un retrait). Rend l'identifiant de la partie à prévenir.
   */
  private async write(
    eventId: string,
    userId: string,
    strict: boolean,
    apply: (tx: Prisma.TransactionClient, onSite: ReadonlySet<string>) => Promise<void>,
  ): Promise<string> {
    const { partie } = await this.permissions.assert(userId, 'EVENT_GAME_ENVY', { eventId });
    const isolated = partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement';
    // Une partie de JDR n'a pas de jeux sur place (la politique `jdr` ferme déjà l'action) ; tout autre
    // genre de partie de ralliement que le groupe et la rencontre isolée non plus.
    if (!isolated && !isRalliementGroup(partie)) {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const basis = await this.events.boardGamesBasis(eventId, { id: partie.id, isolated }, tx);
      if (!basis) throw new NotFoundException('Soirée introuvable');

      if (basis.cancelledAt) {
        throw new BadRequestException(
          isolated ? EVENING_CANCELLED_MESSAGE : CANCELLED_EVENT_MESSAGE,
        );
      }
      const open = eventIsOpen({
        cancelledAt: basis.cancelledAt,
        startDate: basis.startDate,
        endDate: basis.endDate,
        isolated,
        partieClosedAt: partie.closedAt,
      });
      if (!open) {
        throw new BadRequestException(isolated ? EVENING_FINISHED_MESSAGE : PAST_ROSTER_MESSAGE);
      }

      let onSite: ReadonlySet<string> = new Set();
      if (strict) {
        const participants = participantsOf({
          isolated,
          hostId: basis.hostId,
          inscriptions: basis.inscriptions,
          memberIds: basis.memberIds,
        });
        if (!participants.includes(userId)) {
          throw new ForbiddenException(ENVY_NOT_PARTICIPANT_MESSAGE);
        }
        onSite = await this.events.onSiteNameKeysInTx(tx, eventId, basis.hostId);
      }

      await apply(tx, onSite);
    });
    return partie.id;
  }

  /** Prévient les onglets de la partie (`partie:{id}`) — après le commit, hors de la transaction : un échec
   *  ici est consigné, jamais remonté en 500 (le client resoumettrait une écriture déjà faite). */
  private emit(partieId: string, eventId: string): void {
    try {
      this.realtimeEvents.emit(partieTopic(partieId));
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel après une envie de jeu (eventId=${eventId}) : ${String(err)}`,
      );
    }
  }
}
