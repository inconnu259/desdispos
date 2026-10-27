import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EventCardDto, UpdateEventDto } from '@master-jdr/shared';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PartieGrant,
} from '../permissions/permission.service';
import { EmailService } from '../email/email.service';
import {
  GROUP_POLL_OPTION_BOUNDS,
  POLL_DEADLINE_PAST_MESSAGE,
  PollService,
  type PollOptionInput,
} from '../poll/poll.service';
import { PARTIE_SIGNALS_PORT, type PartieSignalsPort } from '../poll/ports/partie-signals.port';
import { parseDayKey, todayKeyUtc } from './day-key';
import { InvitationCleanupService } from '../invitations/invitation-cleanup.service';
import { EventCancellationMailer } from './event-cancellation-mailer.service';
import { CreateEventDto } from './dto/create-event.dto';
import {
  EventsService,
  POLL_MODE_MESSAGE,
  type EventCardBase,
  type EventSeanceInput,
} from './events.service';
import { formatSessionSpan } from './session-date';

/** Refus d'une clé de jour bien formée mais inexistante au calendrier (ex. `2026-02-31`). */
export const INVALID_DAY_MESSAGE = "Cette date n'existe pas";
/** Refus d'un jour passé : aujourd'hui est accepté. */
export const PAST_DAY_MESSAGE = 'La date ne peut pas être passée';

/** Refus de places limitées ou de réservations sur une soirée isolée (Story 41.2). */
export const ISOLATED_NO_PLACES_MESSAGE =
  'Une soirée se fait sur invitation : ni places limitées, ni places réservées';

/** Texte saisi nettoyé : espaces de bord retirés, chaîne vide → `null`. */
function cleaned(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Événements d'un groupe de ralliement — les conjonctions (Story 40.1, epic 40).
 *
 * Orchestration côté ralliement de `EventsService` (écrivain unique d'`Event`/`Seance`) : décision du
 * droit (`PermissionService.assert`, seul décideur), garde de nature (un groupe
 * `CAMPAGNE_EPISODIQUE` seulement — la rencontre isolée relève de l'epic 41), règles de saisie
 * (jour réel, jamais passé), puis signaux après validation. Story 41.2 : la soirée isolée (`ONE_SHOT`) y
 * complète (`update`) l'événement unique créé avec elle ; proposer, s'inscrire et réserver restent
 * réservés au groupe.
 *
 * Service distinct d'`EventsService` pour une raison de graphe : `PartiesService` dépend
 * d'`EventsService`, et le port des signaux (`PARTIE_SIGNALS_PORT`) EST `PartiesService`. Injecter le
 * port dans `EventsService` créerait un cycle de fournisseurs ; ce service-ci n'est requis par
 * personne d'autre que le contrôleur.
 */
@Injectable()
export class GroupEventsService {
  private readonly logger = new Logger(GroupEventsService.name);

  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventsService,
    @Inject(PARTIE_SIGNALS_PORT) private readonly partieSignals: PartieSignalsPort,
    private readonly email: EmailService,
    // Story 40.5 : `PollService` reste le seul écrivain de `SessionPoll` — ce service lui fait écrire le
    // sondage d'une conjonction dans la transaction de `EventsService` (couche 2 → couche 1, pas de port).
    private readonly polls: PollService,
    // Story 42.3 : l'e-mail n° 7 est envoyé par un service partagé avec le départ d'un hôte.
    private readonly cancellationMailer: EventCancellationMailer,
    // Story 42.2 : l'annulation d'une soirée isolée révoque ses invitations en attente et ses liens.
    private readonly invitationCleanup: InvitationCleanupService,
  ) {}

  /**
   * Un membre du groupe propose une conjonction à date fixée, dont il est l'hôte (immuable).
   * L'événement et sa séance datée unique sont écrits dans UNE transaction (`EventsService.create`,
   * qui recalcule aussi la prochaine date de la partie et émet `partie:{id}` après validation) ;
   * la liste d'accueil des membres (statut, prochaine date) est ensuite prévenue.
   */
  async create(partieId: string, userId: string, dto: CreateEventDto): Promise<EventCardDto> {
    const grant = await this.permissions.assert(userId, 'EVENT_CREATE', { partieId });
    // La cellule de politique vaut pour toute la famille : la rencontre isolée (un seul événement,
    // créé avec elle) n'accueille pas de nouvelle conjonction.
    if (grant.partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }

    // Story 40.4 : les places réservées d'emblée sont écrites avec l'événement (mêmes règles que la
    // réservation tardive, vérifiées par `EventsService` sous le verrou de la partie).
    const reservedUserIds = dto.reservedUserIds ?? [];
    const seance: EventSeanceInput = {
      ...this.seanceInput(dto, grant.partieId, userId, 'create'),
      ...(reservedUserIds.length > 0 ? { reservedUserIds } : {}),
    };

    const { event } = await this.events.createHosted(grant, userId, {
      title: dto.title.trim(),
      seance,
    });
    // Après validation et après `partie:{id}` (émis par `EventsService.create`) ; ne lève jamais.
    await this.partieSignals.notifyChanged(grant.partieId);
    await this.sendReservationEmails(grant, event.id, reservedUserIds);

    return this.cardOf(grant, userId, event.id);
  }

  /**
   * Story 40.2 : l'hôte corrige sa conjonction à venir — remplacement complet (mêmes champs et mêmes
   * règles que la création, l'hôte est immuable). Le droit est décidé par `PermissionService` sur
   * la cible `{ eventId }` (cellule de rôle + « hôte de l'événement ») ; la partie est celle de
   * l'événement, jamais celle de la route : une route de la partie A ne touche pas l'événement de B
   * (404). Le refus d'une conjonction passée, de la capacité sous les participants actuels et
   * l'écriture elle-même (verrou de l'événement) sont dans `EventsService.updateHosted`.
   */
  async update(
    partieId: string,
    eventId: string,
    userId: string,
    dto: UpdateEventDto,
  ): Promise<EventCardDto> {
    const grant = await this.permissions.assert(userId, 'EVENT_UPDATE', { eventId });
    if (grant.partieId !== partieId) throw new NotFoundException('Conjonction introuvable');
    // Story 41.2 : la soirée isolée (`ONE_SHOT`) complète son événement unique par la même route —
    // sur invitation, donc ni places limitées ni réservations.
    const isolated = grant.partie.kind === 'ONE_SHOT';
    if (isolated) {
      // Story 41.4 : une soirée terminée est figée.
      await this.events.assertIsolatedOpen(grant.partie);
      if (dto.capacity != null || (dto.reservedUserIds?.length ?? 0) > 0) {
        throw new BadRequestException(ISOLATED_NO_PLACES_MESSAGE);
      }
    }

    // Une soirée qui attend encore sa date est complétée comme une création (jours et échéance jamais
    // passés) ; tout autre événement suit les règles de modification (créneaux conservés tolérés).
    const completing = isolated && (await this.events.isAwaitingDate(eventId));
    await this.events.updateHosted(grant, eventId, {
      title: dto.title.trim(),
      seance: this.seanceInput(dto, grant.partieId, userId, completing ? 'create' : 'update'),
    });
    // Après validation et après `partie:{id}` (émis par `EventsService.updateHosted`) ; ne lève jamais.
    await this.partieSignals.notifyChanged(grant.partieId);

    return this.cardOf(grant, userId, eventId);
  }

  /**
   * Story 42.1 : l'hôte de la conjonction, ou un administrateur du groupe, l'annule DÉFINITIVEMENT. Le droit
   * est décidé par `PermissionService` (`EVENT_CANCEL`, cible `{ eventId }`) ; la partie est celle de
   * l'événement, jamais celle de la route (404 sinon). La rencontre isolée (Story 42.2) s'annule aussi : son
   * événement unique, ses invitations et ses liens sont révoqués dans la même transaction. L'écriture (verrous, sondage fermé, prochaine date) est dans
   * `EventsService.cancelHosted` ; ensuite, APRÈS validation, la liste d'accueil des membres est prévenue
   * puis l'e-mail n° 7 part (échec journalisé, jamais remonté). Renvoie la carte à jour.
   */
  async cancel(partieId: string, eventId: string, userId: string): Promise<EventCardDto> {
    const grant = await this.permissions.assert(userId, 'EVENT_CANCEL', { eventId });
    if (grant.partieId !== partieId) throw new NotFoundException('Conjonction introuvable');
    // Story 42.2 : la soirée isolée (`ONE_SHOT`) s'annule aussi, par la même procédure ; terminée, close ou déjà
    // annulée, elle est figée (400).
    const isolated = grant.partie.kind === 'ONE_SHOT';
    if (isolated) await this.events.assertIsolatedOpen(grant.partie);

    const extras = await this.events.cancelHosted(
      grant,
      eventId,
      (tx, pollId) => this.polls.closeInTx(tx, pollId),
      isolated ? (tx) => this.invitationCleanup.revokePendingInTx(tx, grant.partieId) : undefined,
    );
    // Après validation et après `partie:{id}` (émis par `EventsService.cancelHosted`) ; ne lève jamais.
    await this.partieSignals.notifyChanged(grant.partieId);
    await this.cancellationMailer.send(grant.partieId, eventId, userId, extras.emails);

    return this.cardOf(grant, userId, eventId);
  }

  /**
   * Story 40.3 : un membre s'inscrit à une conjonction (route partagée avec le JDR,
   * `POST scenarios/seances/:id/inscription`, branche « groupe »). Le droit `SEANCE_INSCRIBE` est
   * décidé par l'appelant, qui a déjà résolu la partie DEPUIS la séance (jamais depuis la route) et
   * choisit cette branche selon la famille ; la rencontre isolée (`ONE_SHOT`) est refusée comme en 40.1
   * et 40.2. Les règles et le verrou de l'événement sont dans `EventsService.inscrireConjonction`.
   * Renvoie la carte à jour.
   */
  async inscrire(grant: PartieGrant, userId: string): Promise<EventCardDto> {
    const seanceId = this.seanceOf(grant);
    await this.events.inscrireConjonction(grant, seanceId, userId);
    return this.afterRosterChange(grant, userId);
  }

  /** Story 40.3 : se désinscrire d'une conjonction (`DELETE scenarios/seances/:id/inscription`, branche
   *  « groupe »). Même cadre que `inscrire`. Story 40.4 : c'est aussi ainsi qu'on DÉCLINE une place
   *  réservée (la ligne `RESERVED` est supprimée, la place est libre). Renvoie la carte à jour. */
  async desinscrire(grant: PartieGrant, userId: string): Promise<EventCardDto> {
    const seanceId = this.seanceOf(grant);
    await this.events.desinscrireConjonction(grant, seanceId, userId);
    return this.afterRosterChange(grant, userId);
  }

  /**
   * Story 40.4 : la personne à qui une place est réservée l'accepte
   * (`PATCH scenarios/seances/:id/inscription/accept`, droit `SEANCE_INSCRIBE` décidé par l'appelant,
   * qui a résolu la partie DEPUIS la séance). Sa ligne devient confirmée ; sans place réservée, rien
   * ne change. Renvoie la carte à jour.
   */
  async accepter(grant: PartieGrant, userId: string): Promise<EventCardDto> {
    const seanceId = this.seanceOf(grant);
    await this.events.accepterReservation(grant, seanceId, userId);
    return this.afterRosterChange(grant, userId);
  }

  /**
   * Story 40.4 : l'hôte réserve une place à un membre
   * (`POST scenarios/seances/:id/reservations`, droit `SEANCE_RESERVE` — hôte de l'événement — décidé
   * par l'appelant). L'e-mail « une place vous est réservée » part APRÈS le commit, une fois par
   * nouvelle réservation ; son échec est journalisé, jamais remonté. Renvoie la carte à jour (vue de
   * l'hôte : les places réservées en attente y figurent).
   */
  async reserver(grant: PartieGrant, hostId: string, targetUserId: string): Promise<EventCardDto> {
    const seanceId = this.seanceOf(grant);
    await this.events.reserverPlace(grant, seanceId, targetUserId);
    await this.sendReservationEmails(grant, grant.target.eventId!, [targetUserId]);
    return this.afterRosterChange(grant, hostId);
  }

  /** Story 40.4 : l'hôte retire la réservation d'un membre
   *  (`DELETE scenarios/seances/:id/reservations/:userId`, droit `SEANCE_RESERVE`). Renvoie la carte
   *  à jour. */
  async retirerReservation(
    grant: PartieGrant,
    hostId: string,
    targetUserId: string,
  ): Promise<EventCardDto> {
    const seanceId = this.seanceOf(grant);
    await this.events.retirerReservation(grant, seanceId, targetUserId);
    return this.afterRosterChange(grant, hostId);
  }

  /** E-mail « une place vous est réservée », un par nouvelle réservation, APRÈS le commit : lire ou
   *  envoyer en échec est journalisé et n'annule jamais la réservation (déjà validée). */
  private async sendReservationEmails(
    grant: PartieGrant,
    eventId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;
    try {
      const notice = await this.events.reservationNotice(eventId, userIds);
      if (!notice) return;
      const link = `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}/parties/${grant.partieId}`;
      const sessionDate = notice.startDate
        ? formatSessionSpan(notice.startDate, notice.startSlot, notice.endDate, notice.endSlot)
        : null;
      for (const recipient of notice.recipients) {
        const result = await this.email.sendMail('conjonction-reservation', recipient.email, {
          hostName: notice.hostName,
          eventTitle: notice.eventTitle,
          sessionDate,
          lieu: notice.lieu,
          link,
        });
        if (!result.ok) {
          this.logger.error(
            `Échec d'envoi de l'e-mail de place réservée (partie ${grant.partieId}, événement ${eventId})`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi des e-mails de place réservée (partie ${grant.partieId}, événement ${eventId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Séance visée par l'autorisation ; garde de nature (un groupe `CAMPAGNE_EPISODIQUE` seulement). */
  private seanceOf(grant: PartieGrant): string {
    if (grant.partie.kind !== 'CAMPAGNE_EPISODIQUE') {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    const seanceId = grant.target.seanceId;
    if (!seanceId) throw new NotFoundException('Séance introuvable');
    return seanceId;
  }

  /** Après l'écriture validée (et après `partie:{id}`, émis par `EventsService`) : la liste d'accueil
   *  (« mes conjonctions », statut) est prévenue — ne lève jamais —, puis la carte à jour. */
  private async afterRosterChange(grant: PartieGrant, viewerId: string): Promise<EventCardDto> {
    await this.partieSignals.notifyChanged(grant.partieId);
    return this.cardOf(grant, viewerId, grant.target.eventId!);
  }

  /**
   * Règles de saisie d'une conjonction (création et modification) : textes nettoyés, capacité `null` =
   * tous les membres, et l'un des DEUX modes, exclusifs (400 français sinon) :
   * - date fixée : jour réel, jamais passé (aujourd'hui accepté, clés de jour UTC) et créneau ;
   * - sondage de dates (Story 40.5) : au moins 2 créneaux distincts (jours réels) et une échéance
   *   `YYYY-MM-DD` réelle, pas avant aujourd'hui (à la modification, c'est `PollService` qui refuse une
   *   NOUVELLE échéance passée, une échéance inchangée restant acceptée). La séance n'a alors pas de
   *   date ; l'écriture du sondage est confiée à `PollService`, dans la transaction de l'événement.
   */
  private seanceInput(
    dto: CreateEventDto,
    partieId: string,
    hostId: string,
    action: 'create' | 'update',
  ): EventSeanceInput {
    const common = {
      lieu: cleaned(dto.lieu),
      heureRdv: cleaned(dto.heureRdv),
      notePratique: cleaned(dto.notePratique),
      capacity: dto.capacity ?? null,
      // Story 47.1 : durée absente = 1 à la création, inchangée à la modification (jamais `null`).
      ...(dto.durationSlots != null ? { durationSlots: dto.durationSlots } : {}),
    };
    // `null` vaut absent (un corps JSON peut envoyer `null`) : seul un champ renseigné désigne un mode.
    const pollMode = dto.pollOptions != null || dto.pollDeadline != null;
    const fixedMode = dto.date != null || dto.slot != null;
    // Les deux à la fois, ou aucun : refusé.
    if (pollMode === fixedMode) throw new BadRequestException(POLL_MODE_MESSAGE);

    if (!pollMode) {
      if (dto.date == null || dto.slot == null) {
        throw new BadRequestException(POLL_MODE_MESSAGE);
      }
      const date = parseDayKey(dto.date);
      if (!date) throw new BadRequestException(INVALID_DAY_MESSAGE);
      // Comparaison de clés de jour (UTC) : aujourd'hui est accepté, quel que soit le créneau.
      if (dto.date < todayKeyUtc()) throw new BadRequestException(PAST_DAY_MESSAGE);
      return { date, slot: dto.slot, ...common };
    }

    if (dto.pollOptions == null || dto.pollDeadline == null) {
      throw new BadRequestException('Un sondage de dates demande des créneaux et une échéance');
    }
    const options: PollOptionInput[] = dto.pollOptions.map((o) => {
      const date = parseDayKey(o.date);
      if (!date) throw new BadRequestException(INVALID_DAY_MESSAGE);
      // À la création, un créneau candidat ne peut pas être passé (comme le jour d'une date fixée). À la
      // modification, les créneaux conservés peuvent l'être devenus : le sondage les réconcilie.
      if (action === 'create' && o.date < todayKeyUtc()) {
        throw new BadRequestException(PAST_DAY_MESSAGE);
      }
      return { date, slot: o.slot };
    });
    const deadlineDay = parseDayKey(dto.pollDeadline);
    if (!deadlineDay) throw new BadRequestException(INVALID_DAY_MESSAGE);
    if (action === 'create' && dto.pollDeadline < todayKeyUtc()) {
      throw new BadRequestException(POLL_DEADLINE_PAST_MESSAGE);
    }
    // Le vote se termine à la fin du jour d'échéance (UTC).
    const expiresAt = new Date(deadlineDay.getTime() + 86_400_000 - 1);
    const bounds = GROUP_POLL_OPTION_BOUNDS;
    return {
      date: null,
      slot: null,
      ...common,
      createPoll: (tx) =>
        this.polls.createInTx(tx, partieId, hostId, { options, expiresAt, bounds }),
      // Story 47.4 : `purge` vient de l'écriture de la durée par `updateHosted`, juste avant.
      updatePoll: (tx, pollId, { purge }) =>
        this.polls.setOptionsInTx(tx, pollId, { options, expiresAt, bounds }, { purge }),
    };
  }

  /** Les conjonctions du groupe, passées comprises — tout membre du groupe les lit. */
  async list(partieId: string, userId: string): Promise<EventCardDto[]> {
    const grant = await this.permissions.assert(userId, 'EVENT_LIST', { partieId });
    return this.withCan(userId, await this.events.listCards(grant, userId));
  }

  /** La carte d'un événement, droits d'organisateur compris (Story 44.1). */
  private async cardOf(grant: PartieGrant, userId: string, eventId: string): Promise<EventCardDto> {
    const [card] = await this.withCan(
      userId,
      await this.events.listCards(grant, userId, [eventId]),
    );
    return card;
  }

  /** Story 44.1 (AD-4) : complète chaque carte de `can`, les droits de `userId` calculés par
   *  `PermissionService` en un nombre fixe de lectures — jamais déduits de `hostId` à l'écran. */
  private async withCan(userId: string, cards: EventCardBase[]): Promise<EventCardDto[]> {
    const can = await this.permissions.organizerCan(
      userId,
      cards.map((c) => ({ eventId: c.id })),
    );
    return cards.map((card, i) => ({ ...card, can: can[i] }));
  }
}
