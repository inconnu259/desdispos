import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { familyOf, type EventBoardGamesDto } from '@master-jdr/shared';
import { BoardGamesService } from '../board-games/board-games.service';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { EventGameBringService } from './event-game-bring.service';
import { EventGameEnvyService } from './event-game-envy.service';
import { EventGameExclusionService } from './event-game-exclusion.service';
import { eventIsOpen } from './event-is-open';
import { EventsService, isRalliementGroup } from './events.service';
import { onSiteNameKeys } from './on-site-name-keys';
import { participantsOf } from './participants-of';

/**
 * Les jeux sur place d'une soirée à venir (épic 49, Stories 49.1 et 49.2) — lecture seule : les jeux de l'hôte,
 * jamais copiés, et le nombre de participants N. Le droit est décidé par `PermissionService`
 * (`PARTIE_READ` sur la cible `{ eventId }`) ; la lecture de l'hôte et de la séance est celle d'`EventsService`
 * (écrivain d'`Event`) ; les jeux viennent de `BoardGamesService` (seul lecteur de `BoardGame`) ; les apports des
 * participants, d'`EventGameBringService` (Story 49.2) ; les jeux écartés par l'hôte, d'`EventGameExclusionService`
 * (Story 49.4 : retirés de `games` pour tous, rendus à l'hôte seul dans `excludedGames`) ; les Envies des participants
 * sur les noms sur place, d'`EventGameEnvyService` (Story 49.5, le « sur place » étant `onSiteNameKeys`). Aucune émission : une lecture ne change rien.
 */
@Injectable()
export class EventBoardGamesService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly boardGames: BoardGamesService,
    private readonly bringsOfEvent: EventGameBringService,
    private readonly exclusions: EventGameExclusionService,
    private readonly envyOfEvent: EventGameEnvyService,
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
    // Story 49.4 : seul l'hôte lit les jeux qu'il a écartés (clé absente pour tout autre lecteur).
    const readerIsHost = basis.hostId !== null && basis.hostId === userId;
    // Soirée fermée : aucun jeu sur place, ni de l'hôte ni apporté.
    if (!open) {
      return readerIsHost
        ? { games: [], brings: [], participantsCount, envies: [], excludedGames: [] }
        : { games: [], brings: [], participantsCount, envies: [] };
    }
    // Sans hôte (compte supprimé) : pas de jeux d'hôte, mais les apports des participants restent sur place.
    const [hostGames, brings, excludedIds] = await Promise.all([
      basis.hostId === null ? Promise.resolve([]) : this.boardGames.listOfOwner(basis.hostId),
      // Story 49.2 : seuls les apports des participants ACTUELS (un départ purge les siens, Story 49.3).
      this.bringsOfEvent.listFor(eventId, participants),
      // Story 49.4 : les jeux de l'hôte écartés pour cette soirée.
      this.exclusions.excludedIds(eventId),
    ]);
    // Un jeu écarté sort des jeux sur place pour tout le monde (résumé, compte, doublons, « jouables »).
    const games = hostGames.filter((g) => !excludedIds.has(g.id));
    // Story 49.5 : les Envies des participants actuels sur les noms sur place — la même définition que le
    // contrôle d'écriture et la purge (`onSiteNameKeys`), ici sur les faits déjà lus.
    const onSite = onSiteNameKeys({
      hostGames,
      excludedIds,
      bringNameKeys: brings.map((b) => b.game.nameKey),
    });
    const envies = await this.envyOfEvent.listFor(eventId, participants, onSite);
    if (!readerIsHost) return { games, brings, participantsCount, envies };
    return {
      games,
      brings,
      participantsCount,
      envies,
      excludedGames: hostGames.filter((g) => excludedIds.has(g.id)),
    };
  }
}
