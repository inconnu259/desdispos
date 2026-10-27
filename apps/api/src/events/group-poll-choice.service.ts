import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PartieKind } from '@master-jdr/shared';
import { EmailService } from '../email/email.service';
import { PermissionService } from '../permissions/permission.service';
import type { GroupPollChoosePort } from '../poll/ports/group-poll-choose.port';
import { EventsService } from './events.service';
import { formatSessionSpan } from './session-date';

/**
 * Fixer la date d'une conjonction depuis son sondage (Story 40.6) — le côté `events/` de la route
 * partagée `PATCH parties/:id/poll/:pollId/choose`, branchée sur `GroupPollChoosePort` par `PortsModule`.
 *
 * Classe distincte de `GroupEventsService` pour une raison de graphe : `GroupEventsService` dépend de
 * `PollService` (il lui fait écrire le sondage d'une conjonction), et `PollService` dépend de ce port.
 * Celle-ci ne dépend que d'`EventsService`, du service de permission et de l'e-mail — jamais de `poll/`.
 */
@Injectable()
export class GroupPollChoiceService implements GroupPollChoosePort {
  private readonly logger = new Logger(GroupPollChoiceService.name);

  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    private readonly email: EmailService,
  ) {}

  async assertCanChoose(
    poll: { id: string; partieId: string },
    _partie: { kind: PartieKind },
    userId: string,
  ): Promise<void> {
    // Story 41.2 : la soirée isolée fixe aussi sa date depuis son sondage — l'appelant n'ouvre ce port
    // qu'à la famille `ralliement`.
    const eventId = await this.events.eventIdOfPoll(poll.id, poll.partieId);
    if (!eventId) throw new NotFoundException('Poll introuvable');
    // Le droit « hôte de la conjonction » est décidé par `PermissionService` sur l'ÉVÉNEMENT du sondage,
    // jamais lu ici : un autre membre, administrateur compris, reçoit un 403.
    await this.permissions.assert(userId, 'POLL_CHOOSE', { eventId });
  }

  async notifyDateFixed(poll: { id: string; partieId: string }): Promise<void> {
    try {
      const notice = await this.events.dateFixedNotice(poll.id);
      if (!notice || notice.recipients.length === 0) return;
      const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}/parties/${poll.partieId}`;
      const sessionDate = notice.startDate
        ? formatSessionSpan(notice.startDate, notice.startSlot, notice.endDate, notice.endSlot)
        : null;
      for (const recipient of notice.recipients) {
        const result = await this.email.sendMail('conjonction-date-fixee', recipient.email, {
          eventTitle: notice.eventTitle,
          sessionDate,
          lieu: notice.lieu,
          link,
        });
        if (!result.ok) {
          this.logger.error(
            `Échec d'envoi de l'e-mail de date fixée (partie ${poll.partieId}, sondage ${poll.id})`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi des e-mails de date fixée (partie ${poll.partieId}, sondage ${poll.id})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
