import { BadRequestException, Injectable } from '@nestjs/common';
import type { PartieKind } from '@master-jdr/shared';
import { PermissionService } from '../permissions/permission.service';
import type { GroupPollExtendPort } from '../poll/ports/group-poll-extend.port';
import { EventsService } from './events.service';

/**
 * Prolonger le vote d'une conjonction (Story 40.7) — le côté `events/` de la route
 * `PATCH parties/:id/poll/:pollId/extend`, branchée sur `GroupPollExtendPort` par `PortsModule`.
 *
 * Classe distincte de `GroupEventsService` pour la même raison que `GroupPollChoiceService` :
 * `GroupEventsService` dépend de `PollService`, et `PollService` dépend de ce port.
 */
@Injectable()
export class GroupPollExtensionService implements GroupPollExtendPort {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
  ) {}

  async assertCanExtend(
    poll: { id: string; partieId: string },
    _partie: { kind: PartieKind },
    userId: string,
  ): Promise<void> {
    // Story 41.2 : la soirée isolée prolonge aussi son vote — l'appelant n'ouvre ce port qu'à la famille
    // `ralliement`.
    const eventId = await this.events.eventIdOfPoll(poll.id, poll.partieId);
    if (!eventId) throw new BadRequestException('Poll introuvable ou fermé');
    // Le droit « hôte de la conjonction » est décidé par `PermissionService` sur l'ÉVÉNEMENT du sondage,
    // jamais lu ici : un autre membre, administrateur compris, reçoit un 403.
    await this.permissions.assert(userId, 'POLL_EXTEND', { eventId });
  }
}
