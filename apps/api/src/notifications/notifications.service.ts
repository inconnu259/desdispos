import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { DaySlot } from '@prisma/client';
import { GAME_SYSTEMS, atelierUrl, familyOf, type PartieKind } from '@master-jdr/shared';
import {
  EventsService,
  type ReminderSeance,
  type VoteReminderPoll,
} from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { formatSessionDate } from '../events/session-date';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'matin',
  AFTERNOON: 'après-midi',
  EVENING: 'soir',
  FULL_DAY: 'toute la journée',
};

const HOUR_MS = 60 * 60 * 1000;

/** Systèmes de la famille `ralliement` (Story 40.7) : seuls leurs sondages de groupe reçoivent la relance de
 *  vote — un sondage de JDR garde son échéance par défaut et aucune relance. */
const RALLIEMENT_SYSTEM_IDS: string[] = GAME_SYSTEMS.filter((g) => g.family === 'ralliement').map(
  (g) => g.id,
);

/** Sondage dû pour la relance de vote tel que lu par la tâche : les champs de `VoteReminderPoll` plus ce que
 *  le message et la marque d'envoi utilisent. */
type DueVotePoll = Omit<VoteReminderPoll, 'seance'> & {
  id: string;
  expiresAt: Date | null;
  seance:
    | (VoteReminderPoll['seance'] & {
        /** Story 47.2 : durée du rendez-vous, dite par la relance quand elle dépasse un créneau. */
        durationSlots: number;
        event: { title: string; partie: { id: string; kind: PartieKind; gameSystemId: string } };
      })
    | null;
};

/** Séance due telle que lue par la tâche : les champs de `ReminderSeance` (qui décide des
 *  destinataires, Story 40.3) plus ce que le message affiche. */
type DueSeance = ReminderSeance & {
  id: string;
  startDate: Date | null;
  startSlot: DaySlot | null;
  lieu?: string | null;
  event: ReminderSeance['event'] & {
    title?: string;
    partie: ReminderSeance['event']['partie'] & { id: string; name: string };
  };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Garde de non-chevauchement : @Cron(EVERY_HOUR) ne suspend pas l'exécution suivante si
  // celle-ci dépasse 1h (beaucoup de séances/destinataires dus) — sans cette garde, deux runs
  // pourraient tous les deux voir Seance.reminderSentAt: null et double-envoyer avant que le
  // premier ne persiste sa mise à jour.
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    // Story 40.3 : seul décideur des destinataires du rappel (`reminderRecipients`).
    private readonly events: EventsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendDueReminders(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('sendDueReminders ignoré : une exécution précédente est encore en cours');
      return;
    }
    this.isRunning = true;
    try {
      try {
        await this.processDueReminders();
      } finally {
        // Story 40.7 : la relance de vote est indépendante des rappels de séance (l'échec de l'une
        // n'empêche pas l'autre) et ne lève jamais.
        await this.processVoteReminders();
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async processDueReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Un rappel par séance datée (Story 37.9, AD-12) : une campagne à plusieurs séances dans les
    // 24 h rappelle chacune d'elles, et chaque séance porte sa propre marque d'envoi.
    const dueSeances = await this.prisma.seance.findMany({
      where: {
        startDate: { gte: now, lte: in24h },
        reminderSentAt: null,
        // Story 42.1 : une conjonction annulée n'est jamais rappelée.
        event: { cancelledAt: null },
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      include: {
        // Story 40.3 : les inscrits d'une conjonction, lus avec la séance (jamais une requête par séance).
        inscriptions: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { status: true, user: { select: { id: true, email: true } } },
        },
        event: {
          select: {
            title: true,
            owner: { select: { id: true, email: true } },
            scenario: { select: { status: true } },
            partie: {
              select: {
                id: true,
                name: true,
                kind: true,
                gameSystemId: true,
                owner: { select: { id: true, email: true } },
                memberships: {
                  include: { user: { select: { id: true, email: true } } },
                },
              },
            },
          },
        },
      },
    });

    for (const seance of dueSeances) {
      // Une séance en échec (base, données incohérentes) n'empêche pas les suivantes.
      try {
        await this.remindSeance(seance);
      } catch (error) {
        this.logger.error(
          `Échec du rappel de séance (partie ${seance.event.partie.id}, séance ${seance.id})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async remindSeance(seance: DueSeance): Promise<void> {
    const partie = seance.event.partie;
    // Destinataires : une seule définition, dans `events/` (propriétaire + membres pour le JDR, avec
    // l'anti-spoil des brouillons cachés ; hôte + inscrits pour un groupe).
    const recipients = this.events.reminderRecipients(seance);
    // Story 41.2 : tout ralliement (groupe ou soirée isolée) reçoit l'e-mail neutre de la conjonction.
    const group = familyOf(partie.gameSystemId) === 'ralliement';
    const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}/parties/${partie.id}`;
    const sessionDate = this.formatSessionRange(seance);
    for (const recipient of recipients) {
      // Story 40.3 : un groupe reçoit l'e-mail neutre de la conjonction (hôte et inscrits seulement) ;
      // Story 41.2 : la soirée isolée aussi (propriétaire et membres) ; le JDR garde `session-reminder`.
      const result = group
        ? await this.email.sendMail('conjonction-reminder', recipient.email, {
            eventTitle: seance.event.title,
            sessionDate,
            lieu: seance.lieu ?? null,
            link,
          })
        : await this.email.sendMail('session-reminder', recipient.email, {
            partieName: partie.name,
            sessionDate,
            // « a lieu le mardi 14 juillet » pour un créneau, « a lieu du … au … » pour une plage.
            sessionPhrase: sessionDate.startsWith('du ') ? sessionDate : `le ${sessionDate}`,
            link,
          });
      if (!result.ok) {
        this.logger.error(
          `Échec d'envoi du rappel à ${recipient.email} (partie ${partie.id}, séance ${seance.id})`,
        );
      }
    }
    // Marque après l'envoi, gardée par la date lue : si la date a changé entre-temps (rappel
    // ré-armé à null) ou si la séance a disparu, l'écriture ne touche rien et la nouvelle date
    // sera rappelée à un prochain passage.
    await this.prisma.seance.updateMany({
      where: { id: seance.id, startDate: seance.startDate, startSlot: seance.startSlot },
      data: { reminderSentAt: new Date() },
    });
  }

  /**
   * Relance de vote (Story 40.7, e-mail #6) : UNE fois par sondage, la veille du jour d'échéance — les
   * sondages ouverts d'une conjonction d'un groupe, sans date fixée et jamais relancés, dont l'échéance
   * (fin du jour, UTC) tombe entre 24 h et 48 h plus tard : `expiresAt − 48 h ≤ maintenant < expiresAt −
   * 24 h`, soit le jour UTC qui précède le jour d'échéance. Une seule lecture groupée (sondages, hôte,
   * inscrits, membres, réponses), jamais une requête par sondage ni par votant. Ne lève jamais : un échec
   * est journalisé et le sondage suivant est traité.
   */
  private async processVoteReminders(): Promise<void> {
    try {
      const now = Date.now();
      const polls = await this.prisma.sessionPoll.findMany({
        where: {
          status: 'OPEN',
          relanceSentAt: null,
          expiresAt: { gt: new Date(now + 24 * HOUR_MS), lte: new Date(now + 48 * HOUR_MS) },
          seance: {
            is: {
              startDate: null,
              event: {
                // Story 42.1 : une conjonction annulée n'est jamais relancée (son sondage est clos).
                cancelledAt: null,
                // Story 41.2 : groupe comme soirée isolée (tout ralliement a un sondage de dates).
                partie: { gameSystemId: { in: RALLIEMENT_SYSTEM_IDS } },
              },
            },
          },
        },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          expiresAt: true,
          votes: { select: { userId: true } },
          seance: {
            select: {
              inscriptionMax: true,
              durationSlots: true,
              inscriptions: {
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: { status: true, user: { select: { id: true, email: true } } },
              },
              event: {
                select: {
                  title: true,
                  owner: { select: { id: true, email: true } },
                  partie: {
                    select: {
                      id: true,
                      kind: true,
                      gameSystemId: true,
                      memberships: { select: { user: { select: { id: true, email: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      for (const poll of polls) {
        // Un sondage en échec (base, données incohérentes) n'empêche pas les suivants.
        try {
          await this.remindVote(poll);
        } catch (error) {
          this.logger.error(
            `Échec de la relance de vote (sondage ${poll.id})`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Échec de la lecture des relances de vote',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async remindVote(poll: DueVotePoll): Promise<void> {
    const seance = poll.seance;
    if (!seance) return;
    const partie = seance.event.partie;
    // Garde de défense en plus du filtre de la requête : pas de relance pour le JDR.
    if (familyOf(partie.gameSystemId) !== 'ralliement') return;
    const recipients = this.events.voteReminderRecipients({ votes: poll.votes, seance });
    // Story 44.7 — le lien arrive en Destinée sur CE vote (`?poll`), par l'adresse unique de l'atelier.
    const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}${atelierUrl(
      { partieId: partie.id, family: 'ralliement', role: 'member' },
      { poll: poll.id },
    )}`;
    // Jour d'échéance en toutes lettres (jour UTC de `expiresAt`, sans créneau) : « samedi 24 octobre ».
    const deadline = poll.expiresAt ? formatSessionDate(poll.expiresAt, null) : null;
    for (const recipient of recipients) {
      const result = await this.email.sendMail('conjonction-relance', recipient.email, {
        eventTitle: seance.event.title,
        deadline,
        // Story 47.2 : un rendez-vous de plusieurs créneaux le dit (chaque date proposée est un départ).
        durationLabel: seance.durationSlots > 1 ? `${seance.durationSlots} créneaux` : null,
        link,
      });
      if (!result.ok) {
        this.logger.error(
          `Échec d'envoi de la relance de vote à ${recipient.email} (partie ${partie.id}, sondage ${poll.id})`,
        );
      }
    }
    // Marque après l'envoi — AUSSI quand il n'y a aucun destinataire (tout le monde a voté) : la relance est
    // « une fois ». Gardée par l'état lu : si le vote a été prolongé (échéance et marque remises à jour),
    // fermé ou daté entre-temps, l'écriture ne touche rien et la nouvelle échéance aura sa propre relance.
    await this.prisma.sessionPoll.updateMany({
      where: { id: poll.id, status: 'OPEN', relanceSentAt: null, expiresAt: poll.expiresAt },
      data: { relanceSentAt: new Date() },
    });
  }

  /** Story 47.2 : la date du rappel — « du … au … » quand la plage couvre plusieurs créneaux, le texte
   *  d'un créneau seul inchangé sinon. Le rappel part toujours la veille du DÉPART. */
  private formatSessionRange(seance: {
    startDate: Date | null;
    startSlot: DaySlot | null;
    endDate?: Date | null;
    endSlot?: DaySlot | null;
  }): string {
    const start = seance.startDate!;
    const single = this.formatSessionDate(start, seance.startSlot);
    const { endDate, endSlot } = seance;
    if (!endDate) return single;
    const sameDay = endDate.toISOString().substring(0, 10) === start.toISOString().substring(0, 10);
    if (sameDay && (endSlot ?? seance.startSlot) === seance.startSlot) return single;
    return `du ${single} au ${this.formatSessionDate(endDate, endSlot ?? null)}`;
  }

  private formatSessionDate(date: Date, slot: DaySlot | null): string {
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(date);
    return slot ? `${formatted} (${SLOT_LABELS[slot]})` : formatted;
  }
}
