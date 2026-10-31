import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { familyOf, type EventBoardGamesDto } from '@master-jdr/shared';
import { BoardGamesService } from '../board-games/board-games.service';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { EventGameBringService } from './event-game-bring.service';
import { eventIsOpen } from './event-is-open';
import { EventsService, isRalliementGroup } from './events.service';
import { participantsOf } from './participants-of';

/**
 * Les jeux sur place d'une soirée à venir (épic 49, Stories 49.1 et 49.2) — lecture seule : les jeux de l'hôte,
 * jamais copiés, et le nombre de participants N. Le droit est décidé par `PermissionService`
 * (`PARTIE_READ` sur la cible `{ eventId }`) ; la lecture de l'hôte et de la séance est celle d'`EventsService`
 * (écrivain d'`Event`) ; les jeux viennent de `BoardGamesService` (seul lecteur de `BoardGame`) ; les apports des
 * participants, d'`EventGameBringService` (Story 49.2). Aucune émission : une lecture ne change rien.
 */
@Injectable()
export class EventBoardGamesService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly boardGames: BoardGamesService,
    private readonly bringsOfEvent: EventGameBringService,
  ) {}

  async list(eventId: string, userId: string): Promise<EventBoardGamesDto> {
    const grant = await this.permissions.assert(userId, 'PARTIE_READ', { eventId });
    const { partie } = grant;
    const isolated = partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement';
    // Une partie de JDR n'a pas de jeux sur place : refusée comme les autres routes du ralliement.
    if (!isolated && !isRalliementGroup(partie)) {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }

    const basis = await this.events.boardGamesBasis(eventId, { id: partie.id, isolated });
    if (!basis) throw new NotFoundException('Soirée introuvable');

    const participants = participantsOf({
      isolated,
      hostId: basis.hostId,
      inscriptions: basis.inscriptions,
      memberIds: basis.memberIds,
    });
    const participantsCount = participants.length;
    const open = eventIsOpen({
      cancelledAt: basis.cancelledAt,
      startDate: basis.startDate,
      endDate: basis.endDate,
      isolated,
      partieClosedAt: partie.closedAt,
    });
    // Soirée fermée : aucun jeu sur place, ni de l'hôte ni apporté.
    if (!open) return { games: [], brings: [], participantsCount };
    // Sans hôte (compte supprimé) : pas de jeux d'hôte, mais les apports des participants restent sur place.
    const [games, brings] = await Promise.all([
      basis.hostId === null ? Promise.resolve([]) : this.boardGames.listOfOwner(basis.hostId),
      // Story 49.2 : seuls les apports des participants ACTUELS (la purge d'un départ est la Story 49.3).
      this.bringsOfEvent.listFor(eventId, participants),
    ]);
    return { games, brings, participantsCount };
  }
}
