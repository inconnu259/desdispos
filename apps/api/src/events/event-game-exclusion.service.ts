import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { familyOf } from '@master-jdr/shared';
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

/**
 * Les jeux de l'hôte écartés pour une soirée (épic 49, Story 49.4) — SEUL écrivain de `EventGameExcluded`.
 * Le droit « hôte de la soirée » est décidé par `PermissionService` (`EVENT_GAME_EXCLUDE` sur la cible
 * `{ eventId }`, refus 403 `HOST_ONLY_MESSAGE` pour tout autre, sans hôte pour tous) ; le reste — soirée
 * ouverte, jeu à l'hôte — est lu SOUS le verrou de la ligne `Event` (la même que les inscriptions et les
 * apports) : une annulation concurrente ne se glisse pas entre la décision et l'écriture. La propriété d'un jeu
 * est lue par `BoardGamesService`, seul lecteur de `BoardGame`. Le jeu reste dans la Ludothèque et sur les autres
 * soirées : seule la ligne de cette soirée est posée ou levée.
 */
@Injectable()
export class EventGameExclusionService {
  private readonly logger = new Logger(EventGameExclusionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly boardGames: BoardGamesService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /** J'écarte l'un de mes jeux pour cette soirée. Idempotent : déjà écarté → rien ne change. */
  async exclude(eventId: string, boardGameId: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, boardGameId, userId, async (tx) => {
      await tx.eventGameExcluded.upsert({
        where: { eventId_boardGameId: { eventId, boardGameId } },
        create: { eventId, boardGameId },
        update: {},
      });
      // Story 49.5 : si c'était la dernière source de ce nom, ses Envies partent dans la même transaction.
      await this.events.releaseOrphanEnviesInTx(tx, eventId);
    });
    this.emit(partieId, eventId);
  }

  /** Je remets ce jeu pour cette soirée. Idempotent : pas d'écart → rien ne change. */
  async restore(eventId: string, boardGameId: string, userId: string): Promise<void> {
    const partieId = await this.write(eventId, boardGameId, userId, async (tx) => {
      await tx.eventGameExcluded.deleteMany({ where: { eventId, boardGameId } });
    });
    this.emit(partieId, eventId);
  }

  /**
   * Les identifiants des jeux écartés pour une soirée — lecture seule, sans décision de droit : l'appelant
   * (`EventBoardGamesService`, qui a décidé `PARTIE_READ`) filtre la liste pour tous et ne rend la liste des
   * écartés qu'à l'hôte.
   */
  async excludedIds(eventId: string): Promise<Set<string>> {
    const rows = await this.prisma.eventGameExcluded.findMany({
      where: { eventId },
      select: { boardGameId: true },
    });
    return new Set(rows.map((r) => r.boardGameId));
  }

  /**
   * Cœur commun des deux écritures : droit de rôle et d'hôte (par `assert`, 403), puis — sous le verrou de
   * l'`Event`, base relue sur le client de la transaction — les refus dans l'ordre : soirée annulée (400) ;
   * soirée terminée (400) ; jeu inconnu ou qui n'est pas à l'hôte (404, un seul message). Rend l'identifiant de
   * la partie à prévenir.
   */
  private async write(
    eventId: string,
    boardGameId: string,
    userId: string,
    apply: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<string> {
    const { partie } = await this.permissions.assert(userId, 'EVENT_GAME_EXCLUDE', { eventId });
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

        // L'appelant est l'hôte (décidé par `assert`) : « un jeu à l'hôte » est « un jeu de l'appelant ».
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
        `Échec de l'émission temps réel après l'écart d'un jeu (eventId=${eventId}) : ${String(err)}`,
      );
    }
  }
}
