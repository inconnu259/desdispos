import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { familyOf, type BoardGameBroughtCountDto, type EventBringDto } from '@master-jdr/shared';
import { BOARD_GAME_NOT_FOUND, BoardGamesService } from '../board-games/board-games.service';
import { hasPrismaErrorCode } from '../common/prisma-error.util';
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

/** Refus d'apporter un jeu à une soirée à laquelle on ne participe pas (Story 49.2) : étranger, membre non
 *  inscrit ou place seulement réservée. */
export const BRING_NOT_PARTICIPANT_MESSAGE =
  'Seuls les participants de la soirée peuvent y apporter un jeu';

/** Refus d'apporter un jeu à sa propre soirée (Story 49.2) : les jeux de l'hôte y sont déjà. */
export const BRING_HOST_MESSAGE = "L'hôte reçoit chez lui : ses jeux sont déjà sur place";

/**
 * Les jeux apportés à une soirée (épic 49, Story 49.2) — SEUL écrivain de `EventGameBring`. Le droit de
 * rôle est décidé par `PermissionService` (`EVENT_GAME_BRING` sur la cible `{ eventId }`) ; le reste — soirée
 * ouverte, appelant participant, ni hôte, jeu à lui — est lu SOUS le verrou de la ligne `Event` (la même
 * que les inscriptions) : une inscription retirée ou une annulation concurrente ne se glisse pas entre
 * la décision et l'écriture. La propriété d'un jeu est lue par `BoardGamesService`, seul lecteur de `BoardGame`.
 */
@Injectable()
export class EventGameBringService {
  private readonly logger = new Logger(EventGameBringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly boardGames: BoardGamesService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /** J'apporte l'un de mes jeux à cette soirée. Idempotent : déjà apporté → rien ne change. */
  async bring(eventId: string, boardGameId: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, boardGameId, userId, async (tx) => {
      await tx.eventGameBring.upsert({
        where: { eventId_boardGameId: { eventId, boardGameId } },
        create: { eventId, boardGameId, userId },
        update: {},
      });
    });
    this.emit(partieId, eventId);
  }

  /** Je n'apporte plus ce jeu. Idempotent : pas d'apport → rien ne change. */
  async unbring(eventId: string, boardGameId: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, boardGameId, userId, async (tx) => {
      await tx.eventGameBring.deleteMany({ where: { eventId, boardGameId, userId } });
      // Story 49.5 : si c'était la dernière source de ce nom, ses Envies partent dans la même transaction.
      await this.events.releaseOrphanEnviesInTx(tx, eventId);
    });
    this.emit(partieId, eventId);
  }

  /**
   * Les apports des participants ACTUELS d'une soirée (Story 49.2), triés comme les jeux (clé normalisée,
   * nom). Un apport dont le porteur n'est plus participant n'est pas lu : la Story 49.3 supprime ces lignes
   * à chaque sortie (`EventsService.releaseGameBringsInTx`), ce filtre ne couvre plus que les soirées passées
   * dont un départ a gardé les lignes. Lecture seule, sans décision de droit : l'appelant a décidé `PARTIE_READ`.
   */
  async listFor(eventId: string, participantIds: string[]): Promise<EventBringDto[]> {
    if (participantIds.length === 0) return [];
    const rows = await this.prisma.eventGameBring.findMany({
      where: { eventId, userId: { in: participantIds } },
      select: {
        boardGameId: true,
        user: { select: { id: true, pseudo: true, displayName: true } },
      },
    });
    if (rows.length === 0) return [];
    const games = await this.boardGames.listByIds(rows.map((r) => r.boardGameId));
    const bringerOf = new Map(rows.map((r) => [r.boardGameId, r.user]));
    // L'ordre est celui des jeux (clé normalisée, puis nom) ; un jeu retiré entre les deux lectures est
    // ignoré (son apport suit en cascade). Un seul apport par jeu et par soirée : pas de départage de porteur.
    return games.flatMap((game) => {
      const user = bringerOf.get(game.id);
      return user
        ? [
            {
              game,
              bringer: { userId: user.id, pseudo: user.pseudo, displayName: user.displayName },
            },
          ]
        : [];
    });
  }

  /**
   * Combien de soirées encore ouvertes (ni annulées, ni passées, ni closes) attendent l'un de MES jeux
   * (Story 49.2) — lu au clic « Retirer » de la Ludothèque. Un jeu d'autrui ou inconnu : 404, le même.
   * Depuis la Story 49.3, un porteur qui a quitté une soirée à venir n'y laisse plus de ligne : elle ne
   * compte plus (les sorties suppriment ses apports dans leur transaction).
   */
  async broughtCount(userId: string, boardGameId: string): Promise<BoardGameBroughtCountDto> {
    const owned = await this.boardGames.ownedGameIds(userId, [boardGameId]);
    if (!owned.has(boardGameId)) throw new NotFoundException(BOARD_GAME_NOT_FOUND);
    const rows = await this.prisma.eventGameBring.findMany({
      where: { boardGameId },
      select: {
        event: {
          select: {
            cancelledAt: true,
            partie: { select: { kind: true, gameSystemId: true, closedAt: true } },
            seances: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: 1,
              select: { startDate: true, endDate: true },
            },
          },
        },
      },
    });
    const count = rows.filter(({ event }) =>
      eventIsOpen({
        cancelledAt: event.cancelledAt,
        startDate: event.seances[0]?.startDate ?? null,
        endDate: event.seances[0]?.endDate ?? null,
        isolated:
          event.partie.kind === 'ONE_SHOT' && familyOf(event.partie.gameSystemId) === 'ralliement',
        partieClosedAt: event.partie.closedAt,
      }),
    ).length;
    return { count };
  }

  /**
   * Cœur commun des deux écritures : droit de rôle, puis — sous le verrou de l'`Event`, base relue sur le
   * client de la transaction — les refus dans l'ordre : soirée annulée (400) ; soirée terminée (400) ;
   * appelant hors de `participantsOf`, place réservée comprise (403) ; appelant hôte (403) ; jeu inconnu
   * ou d'une autre personne (404, un seul message). Rend l'identifiant de la partie à prévenir.
   */
  private async write(
    eventId: string,
    boardGameId: string,
    userId: string,
    apply: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<string> {
    const { partie } = await this.permissions.assert(userId, 'EVENT_GAME_BRING', { eventId });
    const isolated = partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement';
    // Une partie de JDR n'a pas de jeux sur place (la politique `jdr` ferme déjà l'action) ; tout autre
    // genre de partie de ralliement que le groupe et la rencontre isolée non plus.
    if (!isolated && !isRalliementGroup(partie)) {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }

    try {
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

        const participants = participantsOf({
          isolated,
          hostId: basis.hostId,
          inscriptions: basis.inscriptions,
          memberIds: basis.memberIds,
        });
        if (!participants.includes(userId)) {
          throw new ForbiddenException(BRING_NOT_PARTICIPANT_MESSAGE);
        }
        if (basis.hostId === userId) throw new ForbiddenException(BRING_HOST_MESSAGE);

        const owned = await this.boardGames.ownedGameIds(userId, [boardGameId], tx);
        if (!owned.has(boardGameId)) throw new NotFoundException(BOARD_GAME_NOT_FOUND);

        await apply(tx);
      });
    } catch (err) {
      // Le jeu a été retiré de la Ludothèque entre la lecture et l'écriture (sa suppression ne prend pas
      // le verrou de l'événement) : clé étrangère rompue, même réponse que pour un jeu inconnu.
      if (hasPrismaErrorCode(err, 'P2003')) throw new NotFoundException(BOARD_GAME_NOT_FOUND);
      throw err;
    }
    return partie.id;
  }

  /** Prévient les onglets de la partie (`partie:{id}`) — après le commit, hors de la transaction : un échec
   *  ici est consigné, jamais remonté en 500 (le client resoumettrait une écriture déjà faite). */
  private emit(partieId: string, eventId: string): void {
    try {
      this.realtimeEvents.emit(partieTopic(partieId));
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel après un apport de jeu (eventId=${eventId}) : ${String(err)}`,
      );
    }
  }
}
