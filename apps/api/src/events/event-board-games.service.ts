import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { familyOf, type EventBoardGamesDto } from '@master-jdr/shared';
import { BoardGamesService } from '../board-games/board-games.service';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { eventIsOpen } from './event-is-open';
import { EventsService, isRalliementGroup } from './events.service';
import { participantsOf } from './participants-of';

/**
 * Les jeux sur place d'une soirée à venir (épic 49, Story 49.1) — lecture seule : les jeux de l'hôte,
 * jamais copiés, et le nombre de participants N. Le droit est décidé par `PermissionService`
 * (`PARTIE_READ` sur la cible `{ eventId }`) ; la lecture de l'hôte et de la séance est celle d'`EventsService`
 * (écrivain d'`Event`) ; les jeux viennent de `BoardGamesService` (seul lecteur de `BoardGame`).
 * Aucune émission : une lecture ne change rien.
 */
@Injectable()
export class EventBoardGamesService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly boardGames: BoardGamesService,
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

    const participantsCount = participantsOf({
      isolated,
      hostId: basis.hostId,
      inscriptions: basis.inscriptions,
      memberIds: basis.memberIds,
    }).length;
    const open = eventIsOpen({
      cancelledAt: basis.cancelledAt,
      startDate: basis.startDate,
      endDate: basis.endDate,
      isolated,
      partieClosedAt: partie.closedAt,
    });
    // Soirée fermée, ou sans hôte (compte supprimé) : aucun jeu sur place.
    if (!open || basis.hostId === null) return { games: [], participantsCount };
    return { games: await this.boardGames.listOfOwner(basis.hostId), participantsCount };
  }
}
