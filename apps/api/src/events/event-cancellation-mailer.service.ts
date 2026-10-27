import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { EventsService } from './events.service';
import { formatSessionSpan } from './session-date';

/**
 * E-mail n° 7 « Annulée : « *Conjonction* » » (Stories 42.1 et 42.3) — UNE seule définition de l'envoi,
 * partagée par l'annulation d'une conjonction (`GroupEventsService.cancel`) et par le départ d'un hôte
 * (`PartiesService.leave`). Classe distincte pour une raison de graphe : `GroupEventsService` reçoit
 * `PartiesService` par le port des signaux, `PartiesService` ne peut donc pas l'injecter sans cycle ; ce
 * service-ci ne dépend que d'`EventsService` (lecture) et de l'e-mail.
 *
 * À appeler APRÈS le commit : la lecture et l'envoi sont journalisés en cas d'échec et ne lèvent jamais, car
 * l'annulation (ou le départ) est déjà validée.
 */
@Injectable()
export class EventCancellationMailer {
  private readonly logger = new Logger(EventCancellationMailer.name);

  constructor(
    private readonly events: EventsService,
    private readonly email: EmailService,
  ) {}

  /** Prévient les inscrits (confirmés ET places réservées) de la conjonction `eventId`, plus son hôte quand
   *  c'est un autre qui annule — ou, pour une soirée isolée, ses membres plus `extraEmails` (invités sans
   *  réponse) ; jamais `actorId`, qui annule ou qui part. */
  async send(
    partieId: string,
    eventId: string,
    actorId: string,
    extraEmails: string[] = [],
    actorName?: string,
  ): Promise<void> {
    try {
      const notice = await (actorName === undefined
        ? this.events.cancellationNotice(eventId, actorId)
        : this.events.cancellationNotice(eventId, actorId, actorName));
      if (!notice) return;
      // Story 42.2 : les invités nominatifs sans réponse d'une soirée annulée s'ajoutent aux membres ; une
      // adresse n'est écrite qu'une fois.
      const seen = new Set<string>();
      const addresses: string[] = [];
      for (const address of [...notice.recipients.map((r) => r.email), ...extraEmails]) {
        if (seen.has(address.toLowerCase())) continue;
        seen.add(address.toLowerCase());
        addresses.push(address);
      }
      if (addresses.length === 0) return;
      const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}/parties/${partieId}`;
      const sessionDate = notice.startDate
        ? formatSessionSpan(notice.startDate, notice.startSlot, notice.endDate, notice.endSlot)
        : null;
      for (const address of addresses) {
        const result = await this.email.sendMail('conjonction-annulee', address, {
          actorName: notice.actorName,
          eventTitle: notice.eventTitle,
          sessionDate,
          link,
        });
        if (!result.ok) {
          this.logger.error(
            `Échec d'envoi de l'e-mail d'annulation (partie ${partieId}, événement ${eventId})`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi des e-mails d'annulation (partie ${partieId}, événement ${eventId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
