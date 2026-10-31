import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Event, type ScenarioStatus, type Seance } from '@prisma/client';
import type {
  DaySlot,
  EventCardDto,
  EventParticipantDto,
  EventPollDto,
  InscriptionStatus,
  MyCalendarOpenInscriptionEntry,
  MyCalendarSeanceEntry,
  PartieKind,
  PartieProgress,
} from '@master-jdr/shared';
// Import RUNTIME du registre des systèmes (Story 40.1) : la famille de la partie choisit qui
// participe à une séance datée dans les ports du calendrier. Jamais `import type` sur une valeur.
import { familyOf, spanSlots } from '@master-jdr/shared';
import type { OccupiedSpan, OccupiedSpansPort } from '../availability/ports/occupied-spans.port';
import type {
  OwnEvents,
  OwnEventsPort,
  OwnEventsRange,
  OwnRolesResolver,
} from '../availability/ports/own-events.port';
import { type PartieGrant } from '../permissions/permission.service';
import {
  VISIBLE_SEANCE_WHERE,
  isHiddenDraft,
  isSpoilRestricted,
} from '../permissions/scenario-visibility';
import type { GroupPollVotePort } from '../poll/ports/group-poll-vote.port';
import type { RendezVousDurationPort } from '../poll/ports/rendez-vous-duration.port';
import type { SeanceDatePort } from '../poll/ports/seance-date.port';
import { BoardGamesService } from '../board-games/board-games.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDayKey, todayKeyUtc } from './day-key';
import { eligibleVoters } from './eligible-voters';
import { eventClosure } from './event-is-open';
import { onSiteNameKeys } from './on-site-name-keys';
import {
  DURATION_POLL_PENDING_MESSAGE,
  assertDuration,
  isSeancePast,
  seanceSpanEnd,
  upcomingSeanceOr,
} from './seance-span';
import { isFreeOn, type DeclaredAvailability } from './slot-availability';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';

/** Données de base d'un événement (Story 37.3, AD-3). `ownerId` = propriétaire de la partie pour le
 *  JDR ; l'hôte pour une conjonction de groupe (Story 40.1). `seance` : données de la séance unique
 *  créée avec l'événement — absente, la séance est créée vide (comportement historique). */
/** Carte d'une conjonction SANS ses droits d'organisateur (`can`, Story 44.1) : `EventsService` n'a pas
 *  `PermissionService`, c'est `GroupEventsService` qui complète la carte avant de la servir. */
export type EventCardBase = Omit<EventCardDto, 'can'>;

export interface CreateEventInput {
  partieId: string;
  title: string;
  description?: string | null;
  ownerId: string | null;
  seance?: EventSeanceInput;
}

/** Séance datée créée avec son événement (Story 40.1) : plage d'un seul créneau (`start = end`),
 *  informations pratiques écrites TELLES QUELLES (`heureRdv` est une étiquette `"HH:MM"`, jamais un
 *  instant) et capacité (`null` = sans limite, sinon le nombre de places, hôte compris). Les règles
 *  de saisie (jour non passé, créneau précis, bornes) sont vérifiées par l'appelant. */
export interface EventSeanceInput {
  /** Jour et créneau de la séance ; `null` pour une conjonction à sondage de dates (Story 40.5), dont la
   *  séance n'a pas de date tant que le vote n'a pas abouti. */
  date: Date | null;
  slot: DaySlot | null;
  /** Story 40.5 : écrit, DANS la transaction de création, le sondage de dates de la conjonction (par
   *  `PollService`, seul écrivain de `SessionPoll`) et rend son identifiant, que la séance porte
   *  (`Seance.pollId`). Fourni par l'appelant — `events/` ne connaît pas `poll/` à l'écriture. Exige
   *  une séance sans date. */
  createPoll?: (tx: Prisma.TransactionClient) => Promise<{ id: string }>;
  /** Story 40.5 : à la modification, met à jour (dans la transaction) le sondage déjà rattaché à la
   *  séance — créneaux et échéance. Exige une séance sans date, déjà liée à un sondage. Story 47.4 :
   *  `purge` vrai quand la durée vient de changer (dans la même transaction) — toutes les options et
   *  leurs réponses sont alors recréées. */
  updatePoll?: (
    tx: Prisma.TransactionClient,
    pollId: string,
    options: { purge: boolean },
  ) => Promise<void>;
  lieu: string | null;
  heureRdv: string | null;
  notePratique: string | null;
  capacity: number | null;
  /** Story 47.1 : durée du rendez-vous en créneaux enchaînés. Absente = 1 à la création, inchangée à la
   *  modification (jamais un défaut appliqué à une séance existante). */
  durationSlots?: number;
  /** Story 40.4 : membres à qui l'hôte réserve une place À LA CRÉATION (lignes `RESERVED`, même
   *  transaction). Règles vérifiées sous le verrou de la partie par `createInTx` : places limitées,
   *  distincts, jamais l'hôte, au plus `capacity − 1`, tous membres du groupe. */
  reservedUserIds?: string[];
}

/** Rappel d'extension : écrit, dans la MÊME transaction, la ligne qui étend l'événement (le
 *  `Scenario` pour le JDR). Fourni par l'appelant — `events/` ne connaît aucune extension. */
export type EventExtension<T> = (tx: Prisma.TransactionClient, event: Event) => Promise<T>;

export interface CreatedEvent<T> {
  event: Event;
  extension: T;
}

/** Une séance telle que lue par l'appelant — seuls les champs dont les règles ont besoin. */
type SeanceRef = Pick<Seance, 'id' | 'eventId' | 'pollId'>;
/** Story 37.4 : la date de la séance est le début de sa plage (`startDate`), seule source de la
 *  date — posée au choix d'une option de vote, effacée à sa remise à zéro. */
type SeanceDated = Pick<Seance, 'id' | 'inscriptionMax' | 'startDate'>;

/** Forme du payload des informations pratiques (Story 36.5) — les trois champs sont saisis
 *  ensemble et `null` vide le champ. */
export interface SeanceInfosPratiques {
  heureRdv: string | null;
  lieu: string | null;
  notePratique: string | null;
  /** Story 47.1 : nouvelle durée du rendez-vous, en créneaux ; absente = inchangée. */
  durationSlots?: number;
}

/** Valeur persistée de `Partie.nextSessionDate/nextSessionSlot`, telle que (re)calculée. */
export interface NextSession {
  nextSessionDate: Date | null;
  nextSessionSlot: DaySlot | null;
  /** Story 47.2 : fin de la plage de cette séance (égale au début pour un créneau). */
  nextSessionEndDate: Date | null;
  nextSessionEndSlot: DaySlot | null;
}

/** De quoi écrire l'e-mail d'invitation à une soirée isolée (Story 41.3), lu au moment de l'invitation :
 *  titre de son événement unique, date fixée ou échéance du vote, lieu. */
export interface InvitationNotice {
  eventTitle: string;
  startDate: Date | null;
  startSlot: DaySlot | null;
  /** Story 47.2 : fin de la plage, pour écrire une plage de plusieurs créneaux. */
  endDate?: Date | null;
  endSlot?: DaySlot | null;
  /** Échéance du vote (sondage ouvert, séance sans date), sinon `null`. */
  deadline: Date | null;
  lieu: string | null;
}

/** Refus d'agir sur une soirée isolée terminée — date passée ou close (Story 41.4) : invitation, vote,
 *  modification, retrait d'un invité. */
export const EVENING_FINISHED_MESSAGE = 'Cette soirée est terminée : plus rien ne peut y changer';

/** Refus de modifier une conjonction dont le jour est passé (Story 40.2). */
export const PAST_EVENT_MESSAGE = 'Cette conjonction est passée : elle ne peut plus être modifiée';

/** Refus de s'inscrire à une conjonction dont le jour est passé, ou de s'en désinscrire (Story 40.3). */
export const PAST_ROSTER_MESSAGE =
  'Cette conjonction est passée : les inscriptions ne peuvent plus changer';
/** Refus de s'inscrire à une conjonction dont toutes les places sont prises (Story 40.3). */
export const FULL_EVENT_MESSAGE = 'Cette conjonction est complète : plus aucune place disponible';
/** Refus de réserver une place quand la conjonction accueille « Tous les membres » (Story 40.4). */
export const RESERVE_NOT_LIMITED_MESSAGE =
  'Réserver une place suppose une conjonction à places limitées';
/** Refus de réserver une place à l'hôte, qui occupe déjà la sienne (Story 40.4). */
export const RESERVE_HOST_MESSAGE = "L'hôte occupe déjà une place de sa conjonction";
/** Refus de réserver une place à quelqu'un qui n'est pas membre du groupe (Story 40.4). */
export const RESERVE_NOT_MEMBER_MESSAGE = "Cette personne n'est pas membre du groupe";
/** Refus de réserver une place à quelqu'un qui est déjà inscrit ou a déjà une place réservée (40.4). */
export const RESERVE_ALREADY_MESSAGE = 'Cette personne a déjà une place dans cette conjonction';
/** Refus de réserver à la création plus de places que la capacité n'en laisse à l'hôte (Story 40.4). */
export const RESERVE_TOO_MANY_MESSAGE =
  "Le nombre de places réservées ne peut pas dépasser le nombre de places moins celle de l'hôte";
/** Refus de réserver la même personne deux fois dans une même demande (Story 40.4). */
export const RESERVE_DUPLICATE_MESSAGE = 'Une même personne ne peut pas recevoir deux places';

/** Refus d'une conjonction qui mêle les deux modes (date fixée et sondage), ou dont le mode change à la
 *  modification (Story 40.5). */
export const POLL_MODE_MESSAGE =
  'Une conjonction se propose à date fixée OU par sondage de dates, et son mode ne change pas';
/** Refus de voter quand la date de la conjonction est déjà fixée (Story 40.5). */
export const VOTE_DATE_SET_MESSAGE =
  'La date de cette conjonction est déjà fixée : le vote est terminé';
/** Refus de voter après l'échéance du sondage (Story 40.5). */
export const VOTE_ENDED_MESSAGE = 'Le vote est terminé : l’échéance est dépassée';
/** Refus de voter quand on n'est pas un votant éligible de la conjonction (Story 40.5). */
export const VOTE_NOT_ELIGIBLE_MESSAGE = 'Vous ne pouvez pas voter sur cette conjonction';

/** Refus de changer le jour ou le créneau d'une conjonction dont la date a été fixée depuis son sondage
 *  (Story 40.6) : la date ne se rouvre jamais. */
export const DATE_FIXED_MESSAGE =
  'La date de cette conjonction est fixée : le jour et le créneau ne peuvent plus changer';

/** Refus de toute action sur une conjonction annulée (Story 42.1) : l'annulation est définitive. */
export const CANCELLED_EVENT_MESSAGE =
  'Cette conjonction est annulée : plus rien ne peut y changer';
/** Refus de toute action sur une soirée isolée annulée (Story 42.2). */
export const EVENING_CANCELLED_MESSAGE = 'Cette soirée est annulée : plus rien ne peut y changer';
/** Refus d'annuler une conjonction dont le jour est passé (Story 42.1). */
export const CANCEL_PAST_MESSAGE = 'Cette conjonction est passée : elle ne peut plus être annulée';

/** Destinataire d'un rappel : identité minimale, jamais plus que l'adresse à qui écrire. */
export interface ReminderRecipient {
  id: string;
  email: string;
}

/** Séance due telle que lue par la tâche horaire : de quoi décider des destinataires de son rappel
 *  (Story 40.3). `gameSystemId` est lu avec le type de partie pour reconnaître un groupe. */
export interface ReminderSeance {
  /** Inscrits à la séance (lus avec la séance : aucune requête par séance). Story 40.4 : un groupe ne
   *  rappelle que les inscriptions confirmées — `status` absent compte comme confirmé (JDR). */
  inscriptions?: { status?: InscriptionStatus; user: ReminderRecipient }[];
  event: {
    /** Hôte de l'événement (groupe de ralliement) ; absent si son compte a disparu. */
    owner?: ReminderRecipient | null;
    /** Statut du scénario (extension JDR de l'événement) ; absent pour un événement sans scénario. */
    scenario?: { status: ScenarioStatus } | null;
    partie: {
      kind: PartieKind;
      gameSystemId: string;
      owner: ReminderRecipient | null;
      memberships: { user: ReminderRecipient }[];
    };
  };
}

/** Sondage d'une conjonction dû pour la relance de vote, tel que lu par la tâche horaire (Story 40.7) :
 *  de quoi décider, SANS requête supplémentaire, qui n'a pas encore voté. Les membres du groupe ne servent
 *  que si la conjonction accueille tous les membres (`inscriptionMax` nul). */
export interface VoteReminderPoll {
  /** Réponses déjà données sur le sondage (une ligne par réponse) — seul `userId` compte. */
  votes: { userId: string }[];
  seance: {
    inscriptionMax: number | null;
    inscriptions: { status: InscriptionStatus; user: ReminderRecipient }[];
    event: {
      owner: ReminderRecipient | null;
      partie: { memberships: { user: ReminderRecipient }[] };
    };
  };
}

/** Ce que le crochet d'annulation d'une soirée isolée (Story 42.2) a révoqué dans la transaction : les
 *  invités nominatifs dont l'invitation attendait encore une réponse (leur accueil se rafraîchit) et les
 *  adresses à prévenir (invités et liens par e-mail non utilisés). */
export interface CancellationExtras {
  userIds: string[];
  emails: string[];
}

/** De quoi écrire l'e-mail d'annulation (Story 42.1, e-mail n° 7), lu après le commit. */
export interface CancellationNotice {
  partieId: string;
  eventTitle: string;
  /** Nom affiché de la personne qui a annulé (l'hôte, ou un administrateur du groupe). */
  actorName: string;
  startDate: Date | null;
  startSlot: DaySlot | null;
  endDate?: Date | null;
  endSlot?: DaySlot | null;
  recipients: ReminderRecipient[];
}

/** De quoi écrire l'e-mail d'une place réservée (Story 40.4), lu après le commit. */
export interface ReservationNotice {
  eventTitle: string;
  hostName: string;
  startDate: Date | null;
  startSlot: DaySlot | null;
  endDate?: Date | null;
  endSlot?: DaySlot | null;
  lieu: string | null;
  recipients: ReminderRecipient[];
}

const FROZEN_ROSTER_MESSAGE = 'Cette séance a déjà une date validée — les inscriptions sont figées';

/** Story 49.1 : les faits lus pour les jeux sur place d'une soirée (voir `EventsService.boardGamesBasis`). */
export interface EventBoardGamesBasis {
  /** Hôte de l'événement (`null` : compte supprimé). */
  hostId: string | null;
  cancelledAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  inscriptions: { userId: string; status: InscriptionStatus }[];
  memberIds: string[];
}

/** Story 40.1 : un GROUPE de ralliement (`CAMPAGNE_EPISODIQUE` de la famille `ralliement`) — ses
 *  séances datées engagent l'hôte de l'événement et ses inscrits (AD-15). La rencontre isolée
 *  (`ONE_SHOT`) garde la règle historique : tous les membres. */
export function isRalliementGroup(partie: { kind: PartieKind; gameSystemId: string }): boolean {
  return partie.kind === 'CAMPAGNE_EPISODIQUE' && familyOf(partie.gameSystemId) === 'ralliement';
}

/** Story 40.4 : l'inscription participe vraiment (hôte mis à part) — tout sauf une place seulement
 *  réservée. Un statut absent (lignes du JDR, qui ne connaît pas la réservation) compte comme confirmé. */
function isConfirmed(inscription: { status?: InscriptionStatus }): boolean {
  return inscription.status !== 'RESERVED';
}

/** Story 40.6 : le sondage n'est servi que tant qu'il est ouvert (un sondage clos n'a plus de bloc). */
function openPollOf(poll: EventPollDto | undefined): EventPollDto | undefined {
  return poll?.status === 'OPEN' ? poll : undefined;
}

/** Inscrits d'une séance tels que lus pour les cartes (Story 40.2/40.4), plus — Story 40.5 — les lignes
 *  d'inscription brutes (hôte exclu), dont les votants éligibles et les libres d'un créneau se déduisent. */
interface Roster {
  participants: EventParticipantDto[];
  placesTaken: number;
  myInscription: InscriptionStatus | null;
  rows: { userId: string; status: InscriptionStatus }[];
}

/** Ordre des créneaux d'une même journée (tri des cartes, Story 40.1). */
const SLOT_ORDER: Record<DaySlot, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2, FULL_DAY: 3 };

/**
 * Événement de base et ses séances (Story 37.3, couche 2 « rassemblement »).
 *
 * Écrivain unique d'`Event`, de `Seance` (hors `compteRendu`, écrit par `scenarios/`) et
 * d'`Inscription` (AD-1). Les gardes propres à un système (statut de scénario, type de partie,
 * anti-spoil) restent chez l'appelant, qui délègue ensuite l'écriture ici ; les règles propres à la
 * séance (verrou de ligne, capacité, gel par la date, idempotence) vivent ici, messages inchangés.
 *
 * Les droits sont vérifiés par l'appelant AVANT tout appel : chaque écriture publique exige
 * l'autorisation (`PartieGrant`) délivrée par `PermissionService.assert()` (Story 37.6, AD-6) —
 * pas d'autorisation, pas d'appel, et la partie écrite est celle de l'autorisation, jamais un
 * identifiant passé à part. Une séance ou un événement écrit doit appartenir à la partie de
 * l'autorisation, sinon 404 avec le message historique (`Séance introuvable`, `Scénario
 * introuvable`) : une autorisation obtenue sur la partie A ne permet jamais d'écrire dans B.
 *
 * Seules exceptions, qui prennent un `partieId` (ou un identifiant) nu, chacune pour une raison :
 * - `createInTx` : appelée par `PartiesService` (écrivain de `Partie`) dans sa propre transaction,
 *   sur la partie qu'il crée (aucune autorisation ne peut encore exister) ou qu'il convertit
 *   (autorisation déjà vérifiée dans la même méthode) ;
 * - `updateInTx` : appelée dans la transaction de l'appelant, qui a obtenu l'autorisation sur
 *   l'événement lui-même (`{ eventId }`) juste avant ;
 * - `chooseDate` (`SeanceDatePort`) : appelée par `PollService.choose()` dans sa transaction, après
 *   l'autorisation `POLL_CHOOSE` et la vérification que le vote appartient à la partie ;
 * - `recalculateNextSession[InTx]` : recalcul d'une valeur dérivée (aucune donnée saisie),
 *   idempotent, appelé après une écriture déjà autorisée — seul écrivain de
 *   `Partie.nextSessionDate/nextSessionSlot` (Story 37.8, AD-15).
 *
 * Story 37.8 : implémente les ports de la couche 1 (`OccupiedSpansPort`, `OwnEventsPort`,
 * `SeanceDatePort`), branchés par `PortsModule` — `availability/` et `poll/` ne connaissent que les
 * interfaces.
 *
 * Toute méthode publique non transactionnelle émet `partie:{id}` après validation ; les variantes
 * `…InTx` n'émettent jamais — l'appelant émet après SON commit.
 */
@Injectable()
export class EventsService
  implements
    OccupiedSpansPort,
    OwnEventsPort,
    SeanceDatePort,
    GroupPollVotePort,
    RendezVousDurationPort
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
    // Story 49.5 : seul lecteur de `BoardGame` — les noms de jeu sur place d'une soirée (purge des Envies).
    private readonly boardGames: BoardGamesService,
  ) {}

  /** Création composite (événement + extension + première séance) dans une transaction, puis
   *  émission après validation. La partie est celle de l'autorisation. */
  async create<T = undefined>(
    grant: PartieGrant,
    input: Omit<CreateEventInput, 'partieId'>,
    extend?: EventExtension<T>,
  ): Promise<CreatedEvent<T>> {
    const created = await this.prisma.$transaction((tx) =>
      this.createInTx(tx, { ...input, partieId: grant.partieId }, extend),
    );
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    // Story 40.4 : chaque membre à qui une place est réservée d'emblée voit arriver sa situation.
    for (const userId of input.seance?.reservedUserIds ?? []) {
      this.realtimeEvents.emit(userTopic(userId));
    }
    return created;
  }

  /** Story 40.1 : événement proposé par `hostId`, qui en devient l'hôte (propriétaire de
   *  l'événement, immuable), créé avec sa séance datée unique — même transaction et même émission
   *  que `create`. L'autorisation (`EVENT_CREATE`) et les règles de saisie sont celles de l'appelant. */
  async createHosted(
    grant: PartieGrant,
    hostId: string,
    input: { title: string; seance: EventSeanceInput },
  ): Promise<CreatedEvent<undefined>> {
    return this.create(grant, { title: input.title, ownerId: hostId, seance: input.seance });
  }

  /** Variante pour un appelant déjà dans une transaction (`PartiesService.create`/`convertKind`).
   *  N'émet rien : l'appelant émet après son propre commit. Seul écrivain de `Partie`,
   *  `PartiesService` l'appelle sur la partie qu'il est en train de créer (aucune autorisation ne
   *  peut encore exister) ou de convertir (autorisation déjà vérifiée dans la même méthode). */
  async createInTx<T = undefined>(
    tx: Prisma.TransactionClient,
    input: CreateEventInput,
    extend?: EventExtension<T>,
  ): Promise<CreatedEvent<T>> {
    await this.assertCanAddEvent(tx, input.partieId);

    const event = await tx.event.create({
      data: {
        partieId: input.partieId,
        title: input.title,
        description: input.description ?? null,
        ownerId: input.ownerId,
      },
    });
    const extension = (extend ? await extend(tx, event) : undefined) as T;
    // Un événement a systématiquement besoin d'au moins une séance pour planifier sa date — on
    // peut toujours en ajouter d'autres ensuite (addSeance, aucun plafond).
    const seance = input.seance;
    if (!seance) {
      await tx.seance.create({ data: { eventId: event.id } });
      return { event, extension };
    }
    // Story 40.5 : conjonction à sondage de dates — le sondage est écrit ICI (même transaction que
    // l'événement), la séance n'a pas de date et porte `pollId`. Date et sondage sont exclusifs.
    if ((seance.createPoll === undefined) === (seance.date === null)) {
      throw new BadRequestException(POLL_MODE_MESSAGE);
    }
    const poll = seance.createPoll ? await seance.createPoll(tx) : null;
    // Story 40.1 : séance datée d'emblée (conjonction à date fixée). Story 47.1 : la plage couvre
    // `durationSlots` créneaux enchaînés (1 par défaut, à la création).
    const durationSlots = seance.durationSlots ?? 1;
    const created = await tx.seance.create({
      data: {
        eventId: event.id,
        ...(poll ? { pollId: poll.id } : {}),
        startDate: seance.date,
        startSlot: seance.slot,
        ...seanceSpanEnd(seance.date, seance.slot, durationSlots),
        durationSlots,
        lieu: seance.lieu,
        heureRdv: seance.heureRdv,
        notePratique: seance.notePratique,
        inscriptionMax: seance.capacity,
      },
    });
    // Story 40.4 : places réservées à des membres, dans la MÊME transaction que l'événement.
    await this.createReservationsInTx(tx, input, created.id, seance);
    // La date la plus proche de la partie peut changer : recalcul dans LA MÊME transaction (le
    // verrou de la partie est déjà tenu, pris par `assertCanAddEvent`).
    await this.recalculateNextSessionInTx(tx, input.partieId);
    return { event, extension };
  }

  /** Story 40.4 : écrit les lignes `RESERVED` demandées à la création d'une conjonction. Les règles sont
   *  vérifiées ICI, dans la transaction (le verrou de la partie est déjà tenu) : places limitées,
   *  personnes distinctes, jamais l'hôte, au plus `capacité − 1` (l'hôte occupe une place), toutes
   *  membres du groupe. Un refus est un 400 qui annule la création entière. */
  private async createReservationsInTx(
    tx: Prisma.TransactionClient,
    event: Pick<CreateEventInput, 'partieId' | 'ownerId'>,
    seanceId: string,
    seance: EventSeanceInput,
  ): Promise<void> {
    const ids = seance.reservedUserIds ?? [];
    if (ids.length === 0) return;
    if (seance.capacity === null) throw new BadRequestException(RESERVE_NOT_LIMITED_MESSAGE);
    if (new Set(ids).size !== ids.length) throw new BadRequestException(RESERVE_DUPLICATE_MESSAGE);
    if (event.ownerId && ids.includes(event.ownerId)) {
      throw new BadRequestException(RESERVE_HOST_MESSAGE);
    }
    if (ids.length > seance.capacity - 1) throw new BadRequestException(RESERVE_TOO_MANY_MESSAGE);
    await this.assertMembers(tx, event.partieId, ids);
    // Horodatage croissant d'une milliseconde par personne : le tri par ordre d'inscription (puis
    // identifiant) garde l'ordre choisi par l'hôte, au lieu de départager au hasard des lignes écrites
    // dans le même instant.
    const base = Date.now();
    await tx.inscription.createMany({
      data: ids.map((userId, i) => ({
        seanceId,
        userId,
        status: 'RESERVED' as const,
        createdAt: new Date(base + i),
      })),
    });
  }

  /** Toutes ces personnes sont des membres actuels du groupe (une seule lecture), sinon 400. */
  private async assertMembers(
    tx: Prisma.TransactionClient,
    partieId: string,
    userIds: string[],
  ): Promise<void> {
    const members = await tx.membership.findMany({
      where: { partieId, userId: { in: userIds } },
      select: { userId: true },
    });
    if (new Set(members.map((m) => m.userId)).size !== new Set(userIds).size) {
      throw new BadRequestException(RESERVE_NOT_MEMBER_MESSAGE);
    }
  }

  /** Titre/description d'un événement, dans la transaction de l'appelant (qui émet après). */
  async updateInTx(
    tx: Prisma.TransactionClient,
    eventId: string,
    data: { title?: string; description?: string | null },
  ): Promise<Event> {
    return tx.event.update({ where: { id: eventId }, data });
  }

  /** `ONE_SHOT` = exactement un événement (AD-3), vérifié sous verrou de la partie : deux
   *  créations concurrentes ne peuvent pas lire toutes deux « zéro événement ». */
  private async assertCanAddEvent(tx: Prisma.TransactionClient, partieId: string): Promise<void> {
    const [partie] = await tx.$queryRaw<{ kind: PartieKind }[]>`
      SELECT "kind"::text AS "kind" FROM "Partie" WHERE "id" = ${partieId} FOR UPDATE`;
    if (!partie) throw new NotFoundException('Partie introuvable');
    if (partie.kind !== 'ONE_SHOT') return;
    const existing = await tx.event.findFirst({ where: { partieId }, select: { id: true } });
    if (existing) {
      throw new BadRequestException(
        "Une Partie de type ONE_SHOT n'a qu'un seul événement — il est créé avec elle",
      );
    }
  }

  // ─── Cartes d'événements (Story 40.1) ───────────────────────────────────────────────────────

  /**
   * Cartes des événements de la partie de l'autorisation (conjonctions d'un groupe), vues par
   * `viewerId` : projection EXPLICITE — identifiant, titre, hôte (identifiant + nom affiché) et séance
   * unique (date, créneau, lieu, heure, note pratique, capacité, places prises) et participants (Story
   * 40.2 : l'hôte d'abord, puis les inscrits par ordre d'inscription, avec leur rôle de groupe).
   * Trois lectures groupées au plus (événements, inscriptions, appartenances), jamais une requête par
   * événement. `eventIds` restreint la lecture (carte d'un événement tout juste créé). Ordre : date
   * croissante, les événements sans date en dernier, puis création.
   *
   * Story 40.4 — visibilité : une place RÉSERVÉE (en attente d'acceptation) n'est listée parmi les
   * participants qu'à l'HÔTE de la conjonction ; pour tous les autres, `placesTaken` (hôte + toutes les
   * lignes) rend « Complet » et « libres » justes sans révéler qui la tient, et `myInscription` dit
   * l'état de la ligne de celui qui lit.
   */
  async listCards(
    grant: PartieGrant,
    viewerId: string,
    eventIds?: string[],
  ): Promise<EventCardBase[]> {
    const events = await this.prisma.event.findMany({
      where: {
        partieId: grant.partieId,
        ...(eventIds ? { id: { in: eventIds } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        // L'hôte d'une conjonction est le propriétaire de l'événement (Story 40.1) : sélection de
        // la personne à afficher, jamais une décision de droit.
        ownerId: true,
        cancelledAt: true,
        owner: { select: { displayName: true } },
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: {
            id: true,
            startDate: true,
            startSlot: true,
            endDate: true,
            endSlot: true,
            lieu: true,
            heureRdv: true,
            notePratique: true,
            inscriptionMax: true,
            pollId: true,
            durationSlots: true,
          },
        },
      },
    });

    const rosterBySeance = await this.rosterOf(grant.partieId, viewerId, events);
    // Story 40.6 : seules les conjonctions encore sans date ont un bloc de sondage (une date fixée le retire).
    const undated = events.filter((e) => !e.seances[0]?.startDate);
    const pollBySeance = await this.pollsOf(grant.partieId, undated, rosterBySeance);

    const cards = events.map((e): EventCardBase => {
      const s = e.seances[0];
      const roster = s ? rosterBySeance.get(s.id) : undefined;
      return {
        id: e.id,
        title: e.title,
        hostId: e.ownerId,
        hostDisplayName: e.owner?.displayName ?? null,
        seance: s
          ? {
              id: s.id,
              date: s.startDate ? s.startDate.toISOString().substring(0, 10) : null,
              slot: s.startSlot ?? null,
              // Story 47.2 : la fin de la plage (le début à défaut), lue de la séance.
              endDate: s.startDate
                ? (s.endDate ?? s.startDate).toISOString().substring(0, 10)
                : null,
              endSlot: s.startDate ? (s.endSlot ?? s.startSlot ?? null) : null,
              lieu: s.lieu ?? null,
              heureRdv: s.heureRdv ?? null,
              notePratique: s.notePratique ?? null,
              capacity: s.inscriptionMax ?? null,
              durationSlots: s.durationSlots,
              placesTaken: roster?.placesTaken ?? (e.ownerId ? 1 : 0),
            }
          : null,
        participants: roster?.participants ?? [],
        myInscription: roster?.myInscription ?? null,
        // Story 40.6 : une fois la date fixée (séance datée, sondage clos), la carte n'a plus de bloc de
        // sondage — elle montre la date normale et les badges habituels.
        poll: s && !s.startDate ? (openPollOf(pollBySeance.get(s.id)) ?? null) : null,
        // Story 42.1 : annulée = sondage clos (donc déjà sans bloc de sondage) et plus aucune action.
        cancelled: Boolean(e.cancelledAt),
      };
    });
    // Tri stable (création déjà ordonnée par la requête) : par date puis créneau (matin <
    // après-midi < soir), sans date en dernier.
    return cards.sort((a, b) => {
      const da = a.seance?.date ?? null;
      const db = b.seance?.date ?? null;
      if (da === null || db === null) return da === db ? 0 : da === null ? 1 : -1;
      if (da !== db) return da < db ? -1 : 1;
      const sa = a.seance?.slot ? SLOT_ORDER[a.seance.slot] : -1;
      const sb = b.seance?.slot ? SLOT_ORDER[b.seance.slot] : -1;
      return sa - sb;
    });
  }

  /** Inscrits de chaque séance (Story 40.2), en deux lectures pour TOUS les événements : les
   *  inscriptions (ordre d'inscription) puis les appartenances au groupe (rôle). L'hôte vient en
   *  premier ; un inscrit qui serait aussi l'hôte n'est listé qu'une fois. Un ancien membre (plus de
   *  ligne d'appartenance) reste listé, sans le drapeau administrateur.
   *
   *  Story 40.4 : `participants` n'inclut une ligne `RESERVED` que si `viewerId` est l'hôte de
   *  l'événement ; `placesTaken` compte l'hôte et TOUTES les lignes ; `myInscription` est le statut de
   *  la ligne de `viewerId`. */
  private async rosterOf(
    partieId: string,
    viewerId: string,
    events: {
      ownerId: string | null;
      owner: { displayName: string } | null;
      seances: { id: string }[];
    }[],
  ): Promise<Map<string, Roster>> {
    const result = new Map<string, Roster>();
    const seanceIds = events.flatMap((e) => e.seances.map((s) => s.id));
    if (seanceIds.length === 0) return result;

    const inscriptions = await this.prisma.inscription.findMany({
      where: { seanceId: { in: seanceIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        seanceId: true,
        userId: true,
        status: true,
        user: { select: { displayName: true } },
      },
    });
    const userIds = new Set<string>(inscriptions.map((i) => i.userId));
    for (const e of events) if (e.ownerId) userIds.add(e.ownerId);
    const memberships = await this.prisma.membership.findMany({
      where: { partieId, userId: { in: [...userIds] } },
      select: { userId: true, role: true },
    });
    const adminIds = new Set(memberships.filter((m) => m.role === 'ADMIN').map((m) => m.userId));

    const inscritsBySeance = new Map<string, typeof inscriptions>();
    for (const i of inscriptions) {
      const list = inscritsBySeance.get(i.seanceId) ?? [];
      list.push(i);
      inscritsBySeance.set(i.seanceId, list);
    }
    for (const e of events) {
      const s = e.seances[0];
      if (!s) continue;
      const viewerIsHost = e.ownerId !== null && e.ownerId === viewerId;
      const participants: EventParticipantDto[] = [];
      if (e.ownerId && e.owner) {
        participants.push({
          userId: e.ownerId,
          displayName: e.owner.displayName,
          isHost: true,
          isAdmin: adminIds.has(e.ownerId),
          status: 'CONFIRMED',
        });
      }
      let placesTaken = e.ownerId ? 1 : 0;
      let myInscription: InscriptionStatus | null = null;
      for (const i of inscritsBySeance.get(s.id) ?? []) {
        if (i.userId === e.ownerId) continue;
        placesTaken += 1;
        if (i.userId === viewerId) myInscription = i.status;
        // Une place réservée n'est visible que de l'hôte (qui la gère).
        if (i.status === 'RESERVED' && !viewerIsHost) continue;
        participants.push({
          userId: i.userId,
          displayName: i.user.displayName,
          isHost: false,
          isAdmin: adminIds.has(i.userId),
          status: i.status,
        });
      }
      result.set(s.id, {
        participants,
        placesTaken,
        myInscription,
        rows: (inscritsBySeance.get(s.id) ?? []).map((i) => ({
          userId: i.userId,
          status: i.status,
        })),
      });
    }
    return result;
  }

  /**
   * Sondages de dates des conjonctions listées (Story 40.5), par identifiant de séance : projection
   * EXPLICITE (`EventPollDto`), lue pour des membres du groupe seulement. Lectures groupées pour TOUS
   * les événements — les sondages (créneaux + réponses), les membres du groupe (seulement si une
   * conjonction accueille tous les membres) et les disponibilités déclarées des inscrits — jamais une
   * requête par événement ni par créneau.
   *
   * `eligibleVoterIds` suit `eligibleVoters()` ; les réponses servies sont celles des votants
   * éligibles (quelqu'un qui s'est désinscrit ne pèse plus dans le résumé). `availableCount` : parmi
   * les INSCRITS (l'hôte + les inscriptions confirmées), combien sont libres sur le créneau d'après
   * leurs disponibilités déclarées — un nombre, jamais des noms.
   */
  private async pollsOf(
    partieId: string,
    events: {
      ownerId: string | null;
      seances: {
        id: string;
        pollId: string | null;
        inscriptionMax: number | null;
        durationSlots: number;
      }[];
    }[],
    rosters: Map<string, Roster>,
  ): Promise<Map<string, EventPollDto>> {
    const result = new Map<string, EventPollDto>();
    const targets = events.flatMap((e) => {
      const s = e.seances[0];
      return s?.pollId ? [{ ownerId: e.ownerId, seance: s, pollId: s.pollId }] : [];
    });
    if (targets.length === 0) return result;

    const [polls, members] = await Promise.all([
      this.prisma.sessionPoll.findMany({
        where: { id: { in: targets.map((t) => t.pollId) }, partieId },
        select: {
          id: true,
          expiresAt: true,
          status: true,
          options: {
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
            select: { id: true, date: true, slot: true },
          },
          votes: { select: { optionId: true, userId: true, answer: true } },
        },
      }),
      targets.some((t) => t.seance.inscriptionMax === null)
        ? this.prisma.membership.findMany({ where: { partieId }, select: { userId: true } })
        : Promise.resolve([] as { userId: string }[]),
    ]);
    const pollById = new Map(polls.map((p) => [p.id, p]));
    const memberIds = members.map((m) => m.userId);

    // Inscrits de chaque conjonction (l'hôte + les inscriptions confirmées) : une seule lecture des
    // disponibilités pour l'ensemble.
    const inscritsByPoll = new Map<string, string[]>();
    for (const t of targets) {
      const rows = rosters.get(t.seance.id)?.rows ?? [];
      inscritsByPoll.set(t.pollId, [
        ...new Set([
          ...(t.ownerId ? [t.ownerId] : []),
          ...rows.filter(isConfirmed).map((r) => r.userId),
        ]),
      ]);
    }
    const allInscrits = [...new Set([...inscritsByPoll.values()].flat())];
    const declarations = allInscrits.length
      ? await this.prisma.availabilityDeclaration.findMany({
          where: { userId: { in: allInscrits }, expiresAt: { gt: new Date() } },
          select: {
            userId: true,
            kind: true,
            recurKind: true,
            dayOfWeek: true,
            slot: true,
            startDate: true,
            endDate: true,
            expiresAt: true,
          },
        })
      : [];
    const declarationsByUser = new Map<string, DeclaredAvailability[]>();
    for (const d of declarations) {
      const list = declarationsByUser.get(d.userId) ?? [];
      list.push(d);
      declarationsByUser.set(d.userId, list);
    }

    for (const t of targets) {
      const poll = pollById.get(t.pollId);
      if (!poll) continue;
      const eligibleVoterIds = eligibleVoters({
        hostId: t.ownerId,
        inscriptionMax: t.seance.inscriptionMax,
        inscriptions: rosters.get(t.seance.id)?.rows ?? [],
        memberIds,
      });
      const eligible = new Set(eligibleVoterIds);
      const inscrits = inscritsByPoll.get(t.pollId) ?? [];
      const now = new Date();
      result.set(t.seance.id, {
        id: poll.id,
        expiresAt: poll.expiresAt?.toISOString() ?? null,
        status: poll.status,
        eligibleVoterIds,
        // Story 47.4 : chaque créneau candidat est le départ d'une plage de cette durée.
        durationSlots: t.seance.durationSlots,
        options: [...poll.options]
          .sort(
            (a, b) =>
              a.date.getTime() - b.date.getTime() || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot],
          )
          .map((o) => ({
            id: o.id,
            date: o.date.toISOString().substring(0, 10),
            slot: o.slot,
            availableCount: inscrits.filter((userId) =>
              isFreeOn(declarationsByUser.get(userId) ?? [], o.date, o.slot, now),
            ).length,
          })),
        votes: poll.votes
          .filter((v) => eligible.has(v.userId))
          .map((v) => ({ optionId: v.optionId, userId: v.userId, answer: v.answer })),
      });
    }
    return result;
  }

  // ─── Modification d'une conjonction (Story 40.2) ─────────────────────────────────────────────

  /**
   * L'hôte corrige sa conjonction : remplacement complet du titre et de la séance unique (date,
   * créneau, lieu, heure, note pratique, capacité). L'autorisation `EVENT_UPDATE` (hôte de
   * l'événement) est celle de l'appelant ; l'événement doit appartenir à sa partie (404 sinon).
   *
   * Tout est écrit dans UNE transaction sous `SELECT … FOR UPDATE` sur la ligne de la partie puis sur
   * celle de l'événement (même schéma que `inscrire`, partie d'abord comme les autres écrivains) : une conjonction déjà passée est refusée (400, jour UTC strictement
   * avant aujourd'hui), de même qu'une capacité inférieure aux participants actuels (hôte compris).
   * Le rappel de la veille est ré-armé si le jour ou le créneau change ; la prochaine date de la
   * partie est recalculée dans la même transaction. `partie:{id}` est émis après validation.
   * La nouvelle date n'est PAS contrôlée ici (règle de saisie de l'appelant).
   */
  async updateHosted(
    grant: PartieGrant,
    eventId: string,
    input: { title: string; seance: EventSeanceInput },
  ): Promise<void> {
    await this.assertEventInGrant(grant, eventId);
    await this.prisma.$transaction(async (tx) => {
      // Ordre des verrous commun à tous les écrivains (createInTx, leave) : la PARTIE d'abord, puis
      // l'événement — jamais l'inverse, sans quoi deux transactions s'interbloqueraient. Le recalcul
      // de la prochaine date reprend ensuite le verrou de la partie, déjà tenu.
      await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${grant.partieId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          ownerId: true,
          cancelledAt: true,
          seances: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
            select: {
              id: true,
              startDate: true,
              startSlot: true,
              endDate: true,
              pollId: true,
              durationSlots: true,
            },
          },
        },
      });
      const seance = event?.seances[0];
      if (!event || !seance) throw new NotFoundException('Conjonction introuvable');
      // Story 42.1 : une conjonction annulée ne change plus (relue sous le verrou de l'événement).
      if (event.cancelledAt) throw new BadRequestException(CANCELLED_EVENT_MESSAGE);

      // Story 40.5 : le mode (date fixée / sondage de dates) ne change pas à la modification — une
      // conjonction à sondage garde ses créneaux et sa séance sans date, une conjonction datée garde
      // son jour. La modification d'une conjonction à sondage ne pose jamais de date de séance.
      // Story 40.6 : une conjonction dont la date a été fixée depuis son sondage (`pollId` posé ET séance
      // datée) est désormais une conjonction datée : on la modifie en mode « date fixée », sans
      // pouvoir changer le jour ni le créneau.
      // Story 41.2 : une soirée isolée naît SANS date ni sondage (« date à fixer ») — troisième état, que
      // la première modification complète par l'un ou l'autre mode (aucun événement de groupe n'y est jamais).
      const awaitingDate = seance.startDate === null && !seance.pollId;
      const undatedPoll = Boolean(seance.pollId) && seance.startDate === null;
      const pollMode = input.seance.date === null;
      if (!awaitingDate && pollMode !== undatedPoll)
        throw new BadRequestException(POLL_MODE_MESSAGE);

      const currentDay = seance.startDate?.toISOString().substring(0, 10) ?? null;
      // Story 47.2 : « passée » = la FIN de la plage est avant aujourd'hui (une plage commencée reste modifiable).
      if (isSeancePast(seance.startDate, seance.endDate)) {
        throw new BadRequestException(PAST_EVENT_MESSAGE);
      }

      // Story 47.1 : durée absente = inchangée (même si la modification remplace les autres champs).
      // Story 47.4 : celle d'un rendez-vous au vote ouvert et sans date se règle par le composer, qui
      // passe par cette même route — elle est écrite AVANT les créneaux, qui sont alors tous recréés.
      const durationSlots = input.seance.durationSlots ?? seance.durationSlots;
      assertDuration(durationSlots);
      const durationChanged = durationSlots !== seance.durationSlots;

      // Participants actuels = l'hôte + les inscrits (un hôte éventuellement inscrit n'est compté
      // qu'une fois).
      const inscrits = await tx.inscription.count({
        where: {
          seanceId: seance.id,
          ...(event.ownerId ? { userId: { not: event.ownerId } } : {}),
        },
      });
      const participants = inscrits + (event.ownerId ? 1 : 0);
      const { capacity } = input.seance;
      if (capacity !== null && capacity < participants) {
        throw new BadRequestException(
          `Le nombre de places ne peut pas être inférieur au nombre de participants actuels (${participants})`,
        );
      }

      await tx.event.update({ where: { id: eventId }, data: { title: input.title } });
      if (pollMode && awaitingDate) {
        // Story 41.2 : le vote s'ouvre dès que les créneaux sont posés — le sondage est créé ICI (par
        // `PollService`, via la fermeture de l'appelant) et la séance le porte, toujours sans date.
        if (!input.seance.createPoll) throw new BadRequestException(POLL_MODE_MESSAGE);
        const poll = await input.seance.createPoll(tx);
        await tx.seance.update({
          where: { id: seance.id },
          data: {
            pollId: poll.id,
            durationSlots,
            lieu: input.seance.lieu,
            heureRdv: input.seance.heureRdv,
            notePratique: input.seance.notePratique,
            inscriptionMax: capacity,
          },
        });
      } else if (pollMode) {
        // Créneaux (réconciliés : un créneau conservé garde ses réponses) et échéance du sondage.
        if (!input.seance.updatePoll || !seance.pollId) {
          throw new BadRequestException(POLL_MODE_MESSAGE);
        }
        // Story 47.4 (AD-10) : la durée d'abord (verrous déjà tenus), puis les créneaux — purgés
        // seulement si la durée a réellement changé (le retour de l'écriture en est la seule source).
        const { changed } = durationChanged
          ? await this.setSeanceDurationInTx(tx, grant.partieId, seance.id, durationSlots, {
              allowOpenPoll: true,
            })
          : { changed: false };
        await input.seance.updatePoll(tx, seance.pollId, { purge: changed });
        await tx.seance.update({
          where: { id: seance.id },
          data: {
            lieu: input.seance.lieu,
            heureRdv: input.seance.heureRdv,
            notePratique: input.seance.notePratique,
            inscriptionMax: capacity,
          },
        });
      } else {
        const dateChanged =
          currentDay !== input.seance.date!.toISOString().substring(0, 10) ||
          seance.startSlot !== input.seance.slot;
        // Story 40.6 : la date fixée depuis un sondage ne bouge plus (elle ne se rouvre jamais) ; les
        // autres champs restent modifiables.
        if (dateChanged && seance.pollId) throw new BadRequestException(DATE_FIXED_MESSAGE);
        await tx.seance.update({
          where: { id: seance.id },
          data: {
            startDate: input.seance.date,
            startSlot: input.seance.slot,
            ...seanceSpanEnd(input.seance.date, input.seance.slot, durationSlots),
            durationSlots,
            lieu: input.seance.lieu,
            heureRdv: input.seance.heureRdv,
            notePratique: input.seance.notePratique,
            inscriptionMax: capacity,
            // Nouvelle date ou nouvelle durée → le rappel de la veille est ré-armé (Story 37.9, 47.1).
            ...(dateChanged || durationChanged ? { reminderSentAt: null } : {}),
          },
        });
      }
      await this.recalculateNextSessionInTx(tx, grant.partieId);
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * Story 42.1 (AD-9) : annule une conjonction de groupe, DÉFINITIVEMENT. L'autorisation `EVENT_CANCEL`
   * (hôte ou administrateur) est celle de l'appelant. Une seule transaction, mêmes verrous et même ordre
   * que `updateHosted` (la PARTIE puis l'événement) : `cancelledAt` est écrit, le sondage éventuel est fermé
   * par la fermeture `closePoll` de l'appelant (`PollService` reste l'unique écrivain de `SessionPoll`) et
   * la prochaine date de la partie est recalculée sans elle. Refus (400) d'une conjonction déjà annulée ou
   * dont le jour est passé (jour UTC strictement avant aujourd'hui ; aujourd'hui reste annulable).
   * `partie:{id}` est émis après validation ; les signaux de l'accueil et l'e-mail sont ceux de l'appelant.
   */
  async cancelHosted(
    grant: PartieGrant,
    eventId: string,
    closePoll: (tx: Prisma.TransactionClient, pollId: string) => Promise<void>,
    afterCancel?: (tx: Prisma.TransactionClient) => Promise<CancellationExtras>,
  ): Promise<CancellationExtras> {
    await this.assertEventInGrant(grant, eventId);
    const extras = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${grant.partieId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          cancelledAt: true,
          seances: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
            select: { startDate: true, endDate: true, pollId: true },
          },
        },
      });
      if (!event) throw new NotFoundException('Conjonction introuvable');
      if (event.cancelledAt) throw new BadRequestException(CANCELLED_EVENT_MESSAGE);
      const seance = event.seances[0];
      // Story 47.2 : une plage commencée reste annulable jusqu'à sa fin.
      if (seance && isSeancePast(seance.startDate, seance.endDate)) {
        throw new BadRequestException(CANCEL_PAST_MESSAGE);
      }

      await tx.event.update({ where: { id: eventId }, data: { cancelledAt: new Date() } });
      if (seance?.pollId) await closePoll(tx, seance.pollId);
      await this.recalculateNextSessionInTx(tx, grant.partieId);
      // Story 42.2 : soirée isolée — invitations et liens révoqués dans la même transaction.
      return afterCancel ? await afterCancel(tx) : { userIds: [], emails: [] };
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    // Les invités dont l'invitation vient d'être révoquée voient leur accueil se rafraîchir.
    for (const userId of extras.userIds) this.realtimeEvents.emit(userTopic(userId));
    return extras;
  }

  /**
   * Story 42.3 (AD-17) : annule, DANS la transaction de l'appelant (`PartiesService.leave()`, déjà sous le
   * verrou de la partie), les conjonctions À VENIR dont `hostId` est l'hôte — mêmes règles que
   * `releaseUpcomingInscriptionsInTx` : séance sans date (sondage ouvert) ou jour aujourd'hui ou plus tard
   * (jour UTC). Les conjonctions passées gardent leur hôte et leurs inscrits ; celles déjà annulées sont
   * ignorées. Les lignes `Event` concernées sont verrouillées triées par identifiant (après la partie),
   * `cancelledAt` est écrit, les sondages ouverts sont confiés à `closePolls` (`poll/` reste l'écrivain de
   * `SessionPoll`) et la prochaine date de la partie est recalculée. N'émet rien : l'appelant émet et envoie
   * les e-mails après SON commit. Renvoie les identifiants des conjonctions annulées.
   */
  async cancelUpcomingHostedInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    hostId: string,
    closePolls: (tx: Prisma.TransactionClient, pollIds: string[]) => Promise<unknown>,
  ): Promise<string[]> {
    const todayStart = parseDayKey(todayKeyUtc());
    const hosted = await tx.event.findMany({
      where: {
        partieId,
        ownerId: hostId,
        cancelledAt: null,
        seances: { some: { OR: upcomingSeanceOr(todayStart) } },
      },
      select: { id: true, seances: { select: { pollId: true } } },
      orderBy: { id: 'asc' },
    });
    if (hosted.length === 0) return [];
    const eventIds = hosted.map((e) => e.id);
    for (const eventId of eventIds) {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
    }
    // Relue sous les verrous : une annulation concurrente (hôte, administrateur) ne s'écrit pas deux fois.
    const { count } = await tx.event.updateMany({
      where: { id: { in: eventIds }, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    if (count === 0) return [];
    const pollIds = hosted.flatMap((e) => e.seances.flatMap((s) => (s.pollId ? [s.pollId] : [])));
    await closePolls(tx, pollIds);
    await this.recalculateNextSessionInTx(tx, partieId);
    return eventIds;
  }

  /**
   * Story 42.1 : de quoi écrire l'e-mail d'annulation (n° 7), lu APRÈS le commit — titre, date, nom de la
   * personne qui a annulé et destinataires : les inscrits (confirmés ET places réservées) plus l'hôte quand
   * c'est un autre qui annule ; jamais celui qui annule, une adresse chacun. `null` si l'événement n'existe
   * plus. Une conjonction non annulée n'a rien à notifier (`null`).
   */
  async cancellationNotice(
    eventId: string,
    actorId: string,
    actorName?: string,
  ): Promise<CancellationNotice | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        partieId: true,
        ownerId: true,
        cancelledAt: true,
        owner: { select: { id: true, email: true } },
        // Story 42.2 : les membres d'une soirée isolée (elle n'a pas d'inscriptions).
        partie: {
          select: {
            kind: true,
            memberships: {
              orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
              select: { user: { select: { id: true, email: true } } },
            },
          },
        },
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: {
            startDate: true,
            startSlot: true,
            endDate: true,
            endSlot: true,
            inscriptions: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: { user: { select: { id: true, email: true } } },
            },
          },
        },
      },
    });
    if (!event || !event.cancelledAt) return null;
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { displayName: true },
    });
    const seance = event.seances[0];
    // Soirée isolée : ses membres ; groupe : les inscrits (confirmés et places réservées).
    const attendees =
      event.partie.kind === 'ONE_SHOT'
        ? event.partie.memberships.map((m) => m.user)
        : (seance?.inscriptions ?? []).map((i) => i.user);
    const candidates = [...(event.owner ? [event.owner] : []), ...attendees];
    const recipients = [...new Map(candidates.map((u) => [u.id, u])).values()].filter(
      (u) => u.id !== actorId,
    );
    return {
      partieId: event.partieId,
      eventTitle: event.title,
      // Story 43.2 : un compte effacé n'existe plus à l'envoi, son nom est fourni par l'appelant.
      actorName: actorName ?? actor?.displayName ?? 'Un membre du groupe',
      startDate: seance?.startDate ?? null,
      startSlot: seance?.startSlot ?? null,
      endDate: seance?.endDate ?? null,
      endSlot: seance?.endSlot ?? null,
      recipients,
    };
  }

  /** Story 41.2 : l'événement attend-il sa date (séance sans date ni sondage) ? Lecture seule, pour que
   *  l'appelant choisisse les règles de saisie (création ou modification) avant la transaction ; l'état
   *  est relu sous verrou par `updateHosted`. Un événement qui n'existe pas n'attend rien. */
  async isAwaitingDate(eventId: string): Promise<boolean> {
    const seance = await this.prisma.seance.findFirst({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { startDate: true, pollId: true },
    });
    return !!seance && seance.startDate === null && seance.pollId === null;
  }

  // ─── Appartenance à la partie de l'autorisation ──────────────────────────────────────────────

  /** L'événement appartient-il à la partie de l'autorisation ? Sans requête quand l'autorisation a
   *  été délivrée sur cet événement (ou une de ses séances) ; sinon vérifié en base. 404 avec le
   *  message historique dans le cas contraire — jamais d'écriture hors de la partie autorisée. */
  private async assertEventInGrant(grant: PartieGrant, eventId: string): Promise<void> {
    if (grant.target.eventId === eventId) return;
    const count = await this.prisma.event.count({
      where: { id: eventId, partieId: grant.partieId },
    });
    if (count === 0) throw new NotFoundException('Scénario introuvable');
  }

  /** Même garde pour une séance (`Séance introuvable`). */
  private async assertSeanceInGrant(grant: PartieGrant, seanceId: string): Promise<void> {
    if (grant.target.seanceId === seanceId) return;
    const count = await this.prisma.seance.count({
      where: { id: seanceId, event: { partieId: grant.partieId } },
    });
    if (count === 0) throw new NotFoundException('Séance introuvable');
  }

  // ─── Séances ────────────────────────────────────────────────────────────────────────────────

  /** Ajoute une séance à un événement — aucun plafond (Story 8.2, AC1). Story 47.1 : `durationSlots`
   *  est sa durée en créneaux (1 par défaut, à la création). */
  async addSeance(grant: PartieGrant, eventId: string, durationSlots = 1): Promise<void> {
    assertDuration(durationSlots);
    await this.assertEventInGrant(grant, eventId);
    await this.prisma.seance.create({ data: { eventId, durationSlots } });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * Supprime une séance (Story 8.7). Un événement a toujours au moins une séance — la toute
   * première (par createdAt croissant, id en tie-breaker) ne peut jamais être supprimée (AC5).
   * `Inscription.onDelete: Cascade` emporte les inscriptions liées. Revue de code Story 8.8
   * (décision utilisateur) : sans séance, un vote de date n'a plus de sens — le SessionPoll lié est
   * supprimé plutôt que laissé orphelin ; la Seance d'abord (elle référence le poll en FK). Enfin,
   * la date la plus proche de la Partie peut disparaître → recalcul.
   */
  async deleteSeance(grant: PartieGrant, seance: SeanceRef): Promise<void> {
    await this.assertSeanceInGrant(grant, seance.id);
    const [firstSeance] = await this.prisma.seance.findMany({
      where: { eventId: seance.eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 1,
    });
    if (firstSeance?.id === seance.id) {
      throw new BadRequestException("La première séance d'un scénario ne peut pas être supprimée");
    }

    // Deferred-work (2026-08-25) : TOCTOU entre la lecture de la séance par l'appelant et ce
    // delete() — une seconde suppression concurrente de la MÊME séance ferait lever un P2025 brut
    // plutôt qu'un 404 propre.
    try {
      await this.prisma.seance.delete({ where: { id: seance.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Séance introuvable');
      }
      throw e;
    }
    if (seance.pollId) {
      await this.prisma.sessionPoll.delete({ where: { id: seance.pollId } });
    }
    await this.recalculateNextSession(grant.partieId);
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * Rattache à une séance le vote de date que `createPoll` crée (Story 8.7). Un seul vote par
   * séance : refus si la séance en porte déjà un, AVANT de créer le vote. `createPoll` est fourni
   * par l'appelant — `PollService` reste le seul écrivain de `SessionPoll` (P2-AD-2) ; ce service
   * ne fait que poser `Seance.pollId`.
   *
   * Story 47.4 : UNE transaction (la non-atomicité de la 8.7 est levée) — verrou de la partie puis de
   * l'événement, garde « déjà liée » relue sous ces verrous, durée écrite (`durationSlots` absent =
   * inchangée), vote créé avec la durée EFFECTIVE, puis `Seance.pollId` : tout ou rien.
   */
  async createSeancePoll(
    grant: PartieGrant,
    seance: SeanceRef,
    durationSlots: number | undefined,
    createPoll: (tx: Prisma.TransactionClient, durationSlots: number) => Promise<{ id: string }>,
  ): Promise<void> {
    await this.assertSeanceInGrant(grant, seance.id);
    if (seance.pollId) {
      throw new BadRequestException('Cette séance est déjà liée à un vote de date');
    }
    if (durationSlots !== undefined) assertDuration(durationSlots);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${grant.partieId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${seance.eventId} FOR UPDATE`;
      const fresh = await tx.seance.findUnique({
        where: { id: seance.id },
        select: { pollId: true, durationSlots: true },
      });
      if (!fresh) throw new NotFoundException('Séance introuvable');
      // Relue sous les verrous : deux créations simultanées ne lient jamais deux votes.
      if (fresh.pollId) {
        throw new BadRequestException('Cette séance est déjà liée à un vote de date');
      }
      if (durationSlots !== undefined) {
        await this.setSeanceDurationInTx(tx, grant.partieId, seance.id, durationSlots);
      }
      const poll = await createPoll(tx, durationSlots ?? fresh.durationSlots);
      await tx.seance.update({ where: { id: seance.id }, data: { pollId: poll.id } });
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * Story 8.8, AC4 : détache le vote de la séance et efface sa plage de date (Story 37.4), PUIS
   * supprime le SessionPoll lui-même (détacher avant de supprimer : FK). La date la plus proche de
   * la Partie peut changer → recalcul.
   */
  async resetSeanceDate(grant: PartieGrant, seance: SeanceRef): Promise<void> {
    await this.assertSeanceInGrant(grant, seance.id);
    await this.prisma.seance.update({
      where: { id: seance.id },
      data: {
        pollId: null,
        startDate: null,
        startSlot: null,
        endDate: null,
        endSlot: null,
        reminderSentAt: null,
      },
    });
    if (seance.pollId) {
      await this.prisma.sessionPoll.delete({ where: { id: seance.pollId } });
    }
    await this.recalculateNextSession(grant.partieId);
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * `SeanceDatePort` (Story 37.8) : pose la plage de date de la séance rattachée au vote `pollId`
   * depuis l'option choisie — `start = end` (seules plages écrites à ce palier, Story 37.4) —
   * puis recalcule `Partie.nextSessionDate/Slot`, le tout DANS la transaction de l'appelant
   * (`PollService.choose`) : le vote clos, la date de la séance et la prochaine séance sont écrits
   * ensemble ou pas du tout. Un vote sans séance rattachée (vote de partie hérité) ne touche
   * aucune séance mais recalcule quand même la partie du vote. N'émet jamais.
   */
  async chooseDate(
    tx: Prisma.TransactionClient,
    pollId: string,
    date: Date,
    slot: DaySlot,
  ): Promise<void> {
    // Le vote est cherché AVANT toute écriture : un vote introuvable échoue sans rien avoir écrit.
    const poll = await tx.sessionPoll.findUnique({
      where: { id: pollId },
      select: { partieId: true },
    });
    if (!poll) throw new NotFoundException('Poll introuvable');
    // Story 47.1 : la fin se calcule sur la durée de la séance (1 créneau tant qu'aucune n'est posée).
    const seance = await tx.seance.findFirst({ where: { pollId }, select: { durationSlots: true } });
    await tx.seance.updateMany({
      where: { pollId },
      // Nouvelle date → le rappel de la veille de cette séance est ré-armé (Story 37.9).
      data: {
        startDate: date,
        startSlot: slot,
        ...seanceSpanEnd(date, slot, seance?.durationSlots ?? 1),
        reminderSentAt: null,
      },
    });
    await this.recalculateNextSessionInTx(tx, poll.partieId);
  }

  /** Capacité d'inscription d'une séance (Story 8.3). */
  async setSeanceCapacity(
    grant: PartieGrant,
    seanceId: string,
    inscriptionMin: number,
    inscriptionMax: number,
  ): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    if (inscriptionMax < inscriptionMin) {
      throw new BadRequestException('Le maximum doit être supérieur ou égal au minimum');
    }
    await this.prisma.seance.update({
      where: { id: seanceId },
      data: { inscriptionMin, inscriptionMax },
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /** Informations pratiques d'une séance (Story 36.5, dérogation D-15 amendée le 2026-08-19).
   *  🚨 Les trois valeurs sont écrites TELLES QUELLES : `heureRdv` est une étiquette `"HH:MM"`,
   *  jamais parsée, convertie ni comparée (addendum §5.7). `null` vide le champ. */
  async setInfosPratiques(
    grant: PartieGrant,
    seanceId: string,
    dto: SeanceInfosPratiques,
  ): Promise<{ durationChanged: boolean }> {
    await this.assertSeanceInGrant(grant, seanceId);
    // Un seul update pour les trois champs : ils sont saisis ensemble.
    const infos = {
      heureRdv: dto.heureRdv,
      lieu: dto.lieu,
      notePratique: dto.notePratique,
    };
    const { durationSlots } = dto;
    let durationChanged = false;
    if (durationSlots === undefined) {
      await this.prisma.seance.update({ where: { id: seanceId }, data: infos });
    } else {
      assertDuration(durationSlots);
      await this.prisma.$transaction(async (tx) => {
        // Story 47.1 : corriger la durée suit l'ordre des verrous des écrivains de plage — la PARTIE,
        // puis l'événement de la séance.
        await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${grant.partieId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = (SELECT "eventId" FROM "Seance" WHERE "id" = ${seanceId}) FOR UPDATE`;
        ({ changed: durationChanged } = await this.setSeanceDurationInTx(
          tx,
          grant.partieId,
          seanceId,
          durationSlots,
        ));
        await tx.seance.update({ where: { id: seanceId }, data: infos });
      });
    }
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    return { durationChanged };
  }

  /**
   * Story 47.1 (AD-10, AD-14) : fixe la durée d'une séance DANS la transaction de l'appelant, qui tient
   * déjà les verrous de la partie puis de l'événement. Renvoie `changed` (faux = durée identique, rien
   * n'est écrit). Séance datée : la fin est recalculée, le rappel de la veille ré-armé si le départ n'est
   * pas passé et la prochaine date de la partie recalculée ; séance au vote ouvert sans date : refusée
   * (400, le composer s'en charge) — sauf `allowOpenPoll` (Story 47.4), réservé au chemin du composer
   * (`setDurationInTx`, modification d'une conjonction à sondage), qui recrée alors les créneaux dans la
   * même transaction. N'émet rien et n'envoie aucun e-mail.
   */
  async setSeanceDurationInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    seanceId: string,
    durationSlots: number,
    options: { allowOpenPoll?: boolean } = {},
  ): Promise<{ changed: boolean }> {
    assertDuration(durationSlots);
    const seance = await tx.seance.findUnique({
      where: { id: seanceId },
      select: { durationSlots: true, startDate: true, startSlot: true, pollId: true },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    if (seance.durationSlots === durationSlots) return { changed: false };
    if (seance.pollId && !seance.startDate && !options.allowOpenPoll) {
      throw new BadRequestException(DURATION_POLL_PENDING_MESSAGE);
    }
    const started =
      seance.startDate !== null && seance.startDate.toISOString().substring(0, 10) < todayKeyUtc();
    await tx.seance.update({
      where: { id: seanceId },
      data: {
        durationSlots,
        ...seanceSpanEnd(seance.startDate, seance.startSlot, durationSlots),
        ...(seance.startDate && !started ? { reminderSentAt: null } : {}),
      },
    });
    if (seance.startDate) await this.recalculateNextSessionInTx(tx, partieId);
    return { changed: true };
  }

  /**
   * `RendezVousDurationPort` (Story 47.4) : dans la transaction de l'appelant (`PollService`), verrouille
   * la partie puis l'événement du rendez-vous porté par le vote — l'ordre de `updateHosted` —, puis écrit
   * sa durée par `setSeanceDurationInTx` (vote ouvert accepté sur ce seul chemin). Durée absente = verrous
   * seulement. Rend aussi la durée EFFECTIVE (relue sous les verrous). Un vote sans séance (hérité) vaut
   * 1 : seule une durée donnée y est refusée (404).
   */
  async setDurationInTx(
    tx: Prisma.TransactionClient,
    pollId: string,
    durationSlots?: number,
  ): Promise<{ changed: boolean; durationSlots: number }> {
    const poll = await tx.sessionPoll.findUnique({
      where: { id: pollId },
      select: { partieId: true, seance: { select: { id: true, eventId: true } } },
    });
    if (!poll) throw new NotFoundException('Poll introuvable');
    await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${poll.partieId} FOR UPDATE`;
    if (!poll.seance) {
      if (durationSlots !== undefined) throw new NotFoundException('Rendez-vous introuvable');
      return { changed: false, durationSlots: 1 };
    }
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${poll.seance.eventId} FOR UPDATE`;
    if (durationSlots === undefined) {
      const current = await tx.seance.findUnique({
        where: { id: poll.seance.id },
        select: { durationSlots: true },
      });
      return { changed: false, durationSlots: current?.durationSlots ?? 1 };
    }
    const { changed } = await this.setSeanceDurationInTx(
      tx,
      poll.partieId,
      poll.seance.id,
      durationSlots,
      { allowOpenPoll: true },
    );
    return { changed, durationSlots };
  }

  /** `RendezVousDurationPort` (Story 47.4) : la durée de chaque vote, en une lecture ; 1 sans séance. */
  async durationsOf(pollIds: readonly string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>(pollIds.map((id) => [id, 1]));
    if (pollIds.length === 0) return result;
    const rows = await this.prisma.seance.findMany({
      where: { pollId: { in: [...pollIds] } },
      select: { pollId: true, durationSlots: true },
    });
    for (const row of rows) if (row.pollId) result.set(row.pollId, row.durationSlots);
    return result;
  }

  // ─── Inscriptions ───────────────────────────────────────────────────────────────────────────

  /**
   * Inscription à capacité limitée (Story 8.3). AD-5 (verbatim) : verrou de ligne explicite
   * SELECT ... FOR UPDATE obligatoire — READ COMMITTED seul ne suffit pas à empêcher un dépassement
   * de max entre deux inscriptions concurrentes.
   */
  async inscrire(grant: PartieGrant, seance: SeanceDated, userId: string): Promise<void> {
    await this.assertSeanceInGrant(grant, seance.id);
    const seanceId = seance.id;
    if (seance.inscriptionMax == null) {
      throw new BadRequestException("Cette séance n'a pas encore de capacité définie par le MJ");
    }
    // Story 37.4 : la plage porte la date, qu'elle vienne d'un vote choisi ou non.
    if (seance.startDate) {
      throw new BadRequestException(FROZEN_ROSTER_MESSAGE);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Seance" WHERE id = ${seanceId} FOR UPDATE`;
      const existing = await tx.inscription.findUnique({
        where: { seanceId_userId: { seanceId, userId } },
      });
      // AC2 vs AC4 : ce check précède le comptage — un joueur déjà inscrit reste inscrit sans
      // jamais être rejeté par un quota déjà atteint par d'autres (idempotence).
      if (existing) return;
      // Relit inscriptionMax ET la date sous le verrou — sinon une capacité ou une date validée
      // concurrentes entre la lecture initiale (hors transaction) et cette comparaison
      // utiliseraient un état périmé (revue de code, 2026-07-14).
      const locked = await tx.seance.findUniqueOrThrow({ where: { id: seanceId } });
      if (locked.startDate) {
        throw new ConflictException(FROZEN_ROSTER_MESSAGE);
      }
      const count = await tx.inscription.count({ where: { seanceId } });
      if (count >= locked.inscriptionMax!) {
        throw new ConflictException('Cette séance a atteint son nombre maximal d’inscrits');
      }
      await tx.inscription.create({ data: { seanceId, userId } });
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  /**
   * Retrait d'inscription — deleteMany (pas delete) : idempotent si l'utilisateur n'était pas
   * inscrit. Décision utilisateur (revue de code, 2026-07-14) : la date validée fige le roster.
   */
  async desinscrire(
    grant: PartieGrant,
    seance: Omit<SeanceDated, 'inscriptionMax'>,
    userId: string,
  ): Promise<void> {
    await this.assertSeanceInGrant(grant, seance.id);
    if (seance.startDate) {
      throw new BadRequestException(FROZEN_ROSTER_MESSAGE);
    }
    await this.prisma.inscription.deleteMany({ where: { seanceId: seance.id, userId } });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
  }

  // ─── Inscriptions à une conjonction (Story 40.3) ────────────────────────────────────────────

  /**
   * Un membre du groupe s'inscrit à la séance d'une conjonction. Tout est lu et écrit dans UNE
   * transaction, sous `SELECT … FOR UPDATE` sur la ligne `Event` (verrou commun des écritures
   * d'inscription, posé AVANT tout comptage) : deux inscriptions simultanées sur la dernière place
   * n'en acceptent qu'une, la seconde reçoit 409.
   *
   * Règles : capacité `null` = « Tous les membres » (s'inscrire confirme, aucune limite) ; sinon
   * premier arrivé, premier servi, sans liste d'attente — les places prises sont l'hôte (qui occupe
   * une place sans ligne d'inscription) + les inscrits. Une inscription tardive reste permise une
   * fois la date posée (elle ne bouge pas), mais plus quand le jour de la séance est passé (400, jour
   * UTC strictement avant aujourd'hui). S'inscrire deux fois, ou en étant l'hôte, ne change rien.
   * `partie:{id}` est émis après validation ; les signaux de l'accueil sont ceux de l'appelant.
   */
  async inscrireConjonction(grant: PartieGrant, seanceId: string, userId: string): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const { seance, ownerId } = await this.lockedSeanceOfEvent(tx, seanceId);
      this.assertNotPast(seance.startDate, seance.endDate);

      // Idempotence : l'hôte occupe déjà sa place, un inscrit reste inscrit — avant tout comptage,
      // pour qu'une conjonction pleine ne rejette jamais quelqu'un qui en fait déjà partie.
      if (userId === ownerId) return false;
      const existing = await tx.inscription.findUnique({
        where: { seanceId_userId: { seanceId, userId } },
        select: { id: true, status: true },
      });
      if (existing) {
        // Story 40.4 : s'inscrire en tenant une place réservée vaut l'accepter (la place compte déjà
        // dans la capacité) — même effet que `accepterReservation`, sous le même verrou.
        if (existing.status !== 'RESERVED') return false;
        await tx.inscription.updateMany({
          where: { seanceId, userId, status: 'RESERVED' },
          data: { status: 'CONFIRMED' },
        });
        return true;
      }

      if (seance.inscriptionMax !== null) {
        const inscrits = await tx.inscription.count({
          where: { seanceId, ...(ownerId ? { userId: { not: ownerId } } : {}) },
        });
        const taken = inscrits + (ownerId ? 1 : 0);
        if (taken >= seance.inscriptionMax) throw new ConflictException(FULL_EVENT_MESSAGE);
      }
      await tx.inscription.create({ data: { seanceId, userId } });
      return false;
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    if (confirmed) this.realtimeEvents.emit(userTopic(userId));
  }

  /**
   * Désinscription d'une conjonction : libre tant que le jour n'est pas passé (400 sinon), idempotente
   * — rien à retirer pour quelqu'un qui n'est pas inscrit, et l'hôte ne se désinscrit pas de sa propre
   * conjonction. Même transaction et même verrou `Event` que l'inscription. Émet `partie:{id}`.
   */
  async desinscrireConjonction(
    grant: PartieGrant,
    seanceId: string,
    userId: string,
  ): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    const removed = await this.prisma.$transaction(async (tx) => {
      const { seance, ownerId, eventId } = await this.lockedSeanceOfEvent(tx, seanceId);
      this.assertNotPast(seance.startDate, seance.endDate);
      if (userId === ownerId) return 0;
      const { count } = await tx.inscription.deleteMany({ where: { seanceId, userId } });
      // Story 49.3 : qui n'est plus participant n'apporte plus rien à cette soirée (même transaction).
      await this.releaseGameBringsInTx(tx, { eventId }, userId);
      return count;
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    // Story 40.4 : décliner une place réservée libère la place — la personne voit sa situation (et
    // son signal) changer sur tous ses onglets.
    if (removed > 0) this.realtimeEvents.emit(userTopic(userId));
  }

  // ─── Réservation de places (Story 40.4) ─────────────────────────────────────────────────────

  /**
   * L'hôte réserve une place de sa conjonction à un membre : une ligne `Inscription` de statut
   * `RESERVED`. L'autorisation `SEANCE_RESERVE` (hôte de l'événement) est celle de l'appelant.
   * Même transaction et même verrou `Event` que les inscriptions (`FOR UPDATE` posé AVANT tout
   * comptage) : une réservation et une inscription concurrentes sur la dernière place n'en
   * acceptent qu'une, l'autre reçoit 409.
   *
   * Règles, dans l'ordre : conjonction pas passée (400) ; places limitées (400 — « Tous les membres »
   * n'a rien à réserver) ; la cible n'est pas l'hôte (400) ; elle est membre actuel du groupe (400) ;
   * elle n'a pas déjà de ligne, réservée ou confirmée (409) ; il reste une place, la réservation
   * comptant dans la capacité comme une inscription (409). Une place réservée ne périme jamais.
   * Émet `partie:{id}` puis `user:{cible}` après validation ; les signaux de l'accueil et l'e-mail sont
   * ceux de l'appelant.
   */
  async reserverPlace(grant: PartieGrant, seanceId: string, targetUserId: string): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    await this.prisma.$transaction(async (tx) => {
      const { seance, ownerId } = await this.lockedSeanceOfEvent(tx, seanceId);
      this.assertNotPast(seance.startDate, seance.endDate);
      if (seance.inscriptionMax === null) {
        throw new BadRequestException(RESERVE_NOT_LIMITED_MESSAGE);
      }
      if (targetUserId === ownerId) throw new BadRequestException(RESERVE_HOST_MESSAGE);
      await this.assertMembers(tx, grant.partieId, [targetUserId]);
      const existing = await tx.inscription.findUnique({
        where: { seanceId_userId: { seanceId, userId: targetUserId } },
        select: { id: true },
      });
      if (existing) throw new ConflictException(RESERVE_ALREADY_MESSAGE);
      // Toute ligne compte (confirmée ou réservée), plus l'hôte qui occupe sa place sans ligne.
      const rows = await tx.inscription.count({
        where: { seanceId, ...(ownerId ? { userId: { not: ownerId } } : {}) },
      });
      if (rows + (ownerId ? 1 : 0) >= seance.inscriptionMax) {
        throw new ConflictException(FULL_EVENT_MESSAGE);
      }
      await tx.inscription.create({ data: { seanceId, userId: targetUserId, status: 'RESERVED' } });
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    this.realtimeEvents.emit(userTopic(targetUserId));
  }

  /**
   * L'hôte retire la réservation d'un membre : la ligne `RESERVED` est supprimée, la place est libre.
   * Même cadre, même verrou et même refus d'une conjonction passée (400) que la réservation.
   * Idempotent : rien à retirer si la personne n'a pas de place réservée — une inscription
   * CONFIRMÉE n'est jamais touchée par cette voie. Émet `partie:{id}` puis `user:{cible}`.
   */
  async retirerReservation(
    grant: PartieGrant,
    seanceId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    const removed = await this.prisma.$transaction(async (tx) => {
      const { seance, eventId } = await this.lockedSeanceOfEvent(tx, seanceId);
      this.assertNotPast(seance.startDate, seance.endDate);
      const { count } = await tx.inscription.deleteMany({
        where: { seanceId, userId: targetUserId, status: 'RESERVED' },
      });
      // Story 49.3 (défensif : une place réservée ne porte aucun jeu) : seulement si une ligne est partie.
      if (count > 0) await this.releaseGameBringsInTx(tx, { eventId }, targetUserId);
      return count;
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    if (removed > 0) this.realtimeEvents.emit(userTopic(targetUserId));
  }

  /**
   * La personne à qui une place est réservée l'accepte : sa ligne passe de `RESERVED` à `CONFIRMED`
   * (elle comptait déjà dans la capacité). Même cadre et même verrou que les autres écritures ; une
   * conjonction passée est refusée (400). Idempotent : sans ligne, ou avec une ligne déjà confirmée,
   * rien ne change. Émet `partie:{id}` puis `user:{userId}`.
   */
  async accepterReservation(grant: PartieGrant, seanceId: string, userId: string): Promise<void> {
    await this.assertSeanceInGrant(grant, seanceId);
    const accepted = await this.prisma.$transaction(async (tx) => {
      const { seance } = await this.lockedSeanceOfEvent(tx, seanceId);
      this.assertNotPast(seance.startDate, seance.endDate);
      const { count } = await tx.inscription.updateMany({
        where: { seanceId, userId, status: 'RESERVED' },
        data: { status: 'CONFIRMED' },
      });
      return count;
    });
    this.realtimeEvents.emit(partieTopic(grant.partieId));
    if (accepted > 0) this.realtimeEvents.emit(userTopic(userId));
  }

  /**
   * Story 40.8 — libère, DANS la transaction de l'appelant (`PartiesService.leave()`, déjà sous le
   * verrou de la partie), les inscriptions (`RESERVED` comme `CONFIRMED`) d'une personne qui quitte ou
   * est retirée du groupe, sur les conjonctions À VENIR de ce groupe : jour de la séance aujourd'hui ou
   * plus tard (jour UTC, comme `assertNotPast`), ou séance sans date (sondage ouvert). Les conjonctions
   * passées gardent la personne parmi leurs participants. L'hôte n'a pas de ligne d'inscription : ses
   * conjonctions à venir restent (l'épique 42 les annulera). Ordre des verrous commun à tous les
   * écrivains : la partie (déjà prise par l'appelant) PUIS les lignes `Event` concernées, triées par
   * identifiant. N'émet rien : l'appelant émet après SON commit. Renvoie le nombre de lignes retirées.
   */
  async releaseUpcomingInscriptionsInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    userId: string,
  ): Promise<number> {
    const todayStart = parseDayKey(todayKeyUtc());
    const where: Prisma.InscriptionWhereInput = {
      userId,
      seance: {
        event: { partieId },
        OR: upcomingSeanceOr(todayStart),
      },
    };
    const rows = await tx.inscription.findMany({
      where,
      select: { seance: { select: { eventId: true } } },
    });
    if (rows.length === 0) return 0;
    const eventIds = [...new Set(rows.map((r) => r.seance.eventId))].sort();
    for (const eventId of eventIds) {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
    }
    // Suppression sous les verrous, par la même condition : seules les lignes à venir de la personne.
    const { count } = await tx.inscription.deleteMany({ where });
    return count;
  }

  /**
   * Story 49.3 — supprime, DANS la transaction de l'appelant, les jeux qu'une personne apportait à une
   * soirée quand elle cesse d'en être participante (désinscription, refus d'une place réservée, départ
   * du groupe, retrait, effacement du compte, sortie d'une rencontre isolée) : plus personne ne compte
   * sur un jeu qui ne viendra pas. `scope` : `{ eventId }` (cette soirée, sans filtre de date) ou
   * `{ partieId, upcomingOnly: true }` (les soirées À VENIR de la partie — séance sans date ou dont le
   * jour est aujourd'hui ou plus tard, jour UTC ; les soirées passées gardent leurs lignes). Cherche
   * par `Event.partieId`, pas par les inscriptions : les rencontres isolées sont couvertes.
   * Story 49.5 : la personne y perd aussi ses PROPRES Envies, et les soirées visées sont celles où elle a un
   * apport OU une Envie (une personne sans apport, qui n'avait que des Envies, est couverte). Les Envies des
   * autres sur un nom qui n'est plus sur place (le jeu qu'elle apportait était la dernière source) sont
   * supprimées dans la foulée (`releaseOrphanEnviesInTx`).
   * Même ordre des verrous que `releaseUpcomingInscriptionsInTx` : les lignes `Event` concernées, triées
   * par identifiant, `FOR UPDATE` (le verrou de `EventGameBringService.write`) AVANT la suppression, pour
   * qu'aucun apport ni Envie ne se glisse après. N'émet rien : l'appelant émet `partie:{id}` après SON
   * commit. Renvoie le nombre d'apports supprimés.
   */
  async releaseGameBringsInTx(
    tx: Prisma.TransactionClient,
    scope: { eventId: string } | { partieId: string; upcomingOnly: true },
    userId: string,
  ): Promise<number> {
    // La même portée sert aux apports et aux Envies : une soirée précise, ou les soirées à venir de la partie.
    const eventFilter: Prisma.EventWhereInput | undefined =
      'eventId' in scope
        ? undefined
        : {
            partieId: scope.partieId,
            seances: { some: { OR: upcomingSeanceOr(parseDayKey(todayKeyUtc())) } },
          };
    const where: Prisma.EventGameBringWhereInput =
      'eventId' in scope ? { userId, eventId: scope.eventId } : { userId, event: eventFilter };
    const envyWhere: Prisma.EventGameEnvyWhereInput =
      'eventId' in scope ? { userId, eventId: scope.eventId } : { userId, event: eventFilter };
    const bringRows = await tx.eventGameBring.findMany({ where, select: { eventId: true } });
    const envyRows = await tx.eventGameEnvy.findMany({
      where: envyWhere,
      select: { eventId: true },
    });
    if (bringRows.length === 0 && envyRows.length === 0) return 0;
    const eventIds = [...new Set([...bringRows, ...envyRows].map((r) => r.eventId))].sort();
    for (const eventId of eventIds) {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
    }
    // Suppression sous les verrous, par la même condition : seuls les apports et Envies de la personne.
    const { count } = await tx.eventGameBring.deleteMany({ where });
    await tx.eventGameEnvy.deleteMany({ where: envyWhere });
    // Les Envies des AUTRES sur un nom qui n'est plus tenu par personne partent aussi (même transaction).
    for (const eventId of eventIds) {
      await this.releaseOrphanEnviesInTx(tx, eventId);
    }
    return count;
  }

  /**
   * Story 49.5 — les noms de jeu SUR PLACE d'une soirée, lus sur le client de la transaction de l'appelant
   * (sous le verrou de l'événement) : les jeux de l'hôte moins ceux qu'il a écartés, plus les jeux apportés —
   * la définition unique est `onSiteNameKeys`. `hostId` est l'hôte de l'événement (`null` s'il a disparu : pas de
   * jeux d'hôte, les apports restent). Les clés sont lues par `BoardGamesService`, seul lecteur de `BoardGame`.
   */
  async onSiteNameKeysInTx(
    tx: Prisma.TransactionClient,
    eventId: string,
    hostId: string | null,
  ): Promise<Set<string>> {
    const hostGames = hostId === null ? [] : await this.boardGames.nameKeysOfOwner(hostId, tx);
    const excluded = await tx.eventGameExcluded.findMany({
      where: { eventId },
      select: { boardGameId: true },
    });
    const brings = await tx.eventGameBring.findMany({
      where: { eventId },
      select: { boardGameId: true },
    });
    const bringNameKeys = await this.boardGames.nameKeysByIds(
      brings.map((b) => b.boardGameId),
      tx,
    );
    return onSiteNameKeys({
      hostGames,
      excludedIds: excluded.map((e) => e.boardGameId),
      bringNameKeys,
    });
  }

  /**
   * Story 49.5 — supprime, DANS la transaction de l'appelant et SOUS le verrou de l'événement (déjà pris), les
   * Envies dont le nom n'est plus sur place : le dernier jeu qui le portait a été écarté par l'hôte, ou le
   * dernier apport retiré (ou parti avec son porteur). Un nom encore tenu par une autre source — une copie de
   * l'hôte, un autre porteur — garde ses Envies. N'émet rien : l'appelant émet après SON commit. Renvoie le
   * nombre d'Envies supprimées.
   */
  async releaseOrphanEnviesInTx(tx: Prisma.TransactionClient, eventId: string): Promise<number> {
    const envied = await tx.eventGameEnvy.findMany({
      where: { eventId },
      select: { nameKey: true },
      distinct: ['nameKey'],
    });
    if (envied.length === 0) return 0;
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
    const onSite = await this.onSiteNameKeysInTx(tx, eventId, event?.ownerId ?? null);
    const orphans = envied.map((e) => e.nameKey).filter((key) => !onSite.has(key));
    if (orphans.length === 0) return 0;
    const { count } = await tx.eventGameEnvy.deleteMany({
      where: { eventId, nameKey: { in: orphans } },
    });
    return count;
  }

  /**
   * De quoi écrire l'e-mail « une place vous est réservée » (Story 40.4) : titre de la conjonction,
   * nom affiché de l'hôte, date et lieu, et pour chaque destinataire son identifiant et son adresse.
   * Lecture seule, pour l'appelant qui envoie APRÈS le commit. `null` si la conjonction n'existe plus.
   */
  async reservationNotice(eventId: string, userIds: string[]): Promise<ReservationNotice | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        owner: { select: { displayName: true } },
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: { startDate: true, startSlot: true, endDate: true, endSlot: true, lieu: true },
        },
      },
    });
    if (!event) return null;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const seance = event.seances[0];
    return {
      eventTitle: event.title,
      hostName: event.owner?.displayName ?? 'Un membre du groupe',
      startDate: seance?.startDate ?? null,
      startSlot: seance?.startSlot ?? null,
      endDate: seance?.endDate ?? null,
      endSlot: seance?.endSlot ?? null,
      lieu: seance?.lieu ?? null,
      recipients: users,
    };
  }

  /**
   * Story 44.2 (AD-15) — l'avancement de chaque partie du lot, en lecture groupée (jamais un comptage par
   * partie). Entrée de `partieStatus()` : cette lecture, déplacée ici depuis `PartiesService`, sert aussi
   * bien la liste des parties que les sondages ouverts (via `OpenPollContextPort`). Un groupe de ralliement
   * compte tous ses événements (Story 40.1) ; toute autre partie, ceux porteurs d'un scénario ; une
   * rencontre isolée suit sa date (Story 41.4) ou son annulation (Story 42.2).
   */
  async progressByPartieIds(
    parties: { id: string; kind: PartieKind; gameSystemId: string }[],
  ): Promise<(partieId: string) => PartieProgress> {
    const groupIds = parties.filter(isRalliementGroup).map((p) => p.id);
    const otherIds = parties.filter((p) => !isRalliementGroup(p)).map((p) => p.id);
    const isolatedIds = parties
      .filter((p) => p.kind === 'ONE_SHOT' && familyOf(p.gameSystemId) === 'ralliement')
      .map((p) => p.id);
    const [withScenario, withEvent, ended, cancelled] = await Promise.all([
      otherIds.length === 0
        ? []
        : this.prisma.event.groupBy({
            by: ['partieId'],
            where: { partieId: { in: otherIds }, scenario: { isNot: null } },
            _count: { _all: true },
          }),
      groupIds.length === 0
        ? []
        : this.prisma.event.groupBy({
            by: ['partieId'],
            where: { partieId: { in: groupIds } },
            _count: { _all: true },
          }),
      this.endedIsolatedPartieIds(isolatedIds),
      this.cancelledIsolatedPartieIds(isolatedIds),
    ]);
    // `groupBy` ne renvoie jamais de groupe à compte zéro : chaque ligne retournée a au moins un
    // événement qui compte.
    const started = new Set([...withScenario, ...withEvent].map((c) => c.partieId));
    return (partieId) =>
      cancelled.has(partieId)
        ? 'cancelled'
        : ended.has(partieId)
          ? 'ended'
          : started.has(partieId)
            ? 'started'
            : 'none';
  }

  /**
   * Story 41.4 : parmi ces rencontres isolées, lesquelles ont leur plage de dates PASSÉE — fin de plage
   * (`endDate`, à défaut `startDate`) strictement avant le début du jour courant UTC (aujourd'hui reste à
   * venir, même convention que les conjonctions). UNE lecture groupée ; une rencontre sans date n'y est
   * jamais. L'appelant ne passe que des rencontres isolées (`ONE_SHOT` de la famille ralliement).
   */
  async endedIsolatedPartieIds(partieIds: string[]): Promise<Set<string>> {
    if (partieIds.length === 0) return new Set();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const seances = await this.prisma.seance.findMany({
      where: {
        event: { partieId: { in: partieIds } },
        OR: [{ endDate: { lt: startOfToday } }, { endDate: null, startDate: { lt: startOfToday } }],
      },
      select: { event: { select: { partieId: true } } },
    });
    return new Set(seances.map((s) => s.event.partieId));
  }

  /**
   * Story 42.2 : parmi ces rencontres isolées, lesquelles sont ANNULÉES — leur événement unique porte
   * `cancelledAt`. UNE lecture groupée ; liste vide : aucune lecture. L'appelant ne passe que des rencontres
   * isolées (`ONE_SHOT` de la famille ralliement).
   */
  async cancelledIsolatedPartieIds(partieIds: string[]): Promise<Set<string>> {
    if (partieIds.length === 0) return new Set();
    const events = await this.prisma.event.findMany({
      where: { partieId: { in: partieIds }, cancelledAt: { not: null } },
      select: { partieId: true },
    });
    return new Set(events.map((e) => e.partieId));
  }

  /**
   * Story 41.4 : une soirée isolée est figée (400) quand elle est terminée — `closedAt` posé ou date passée,
   * la même règle que le statut `TERMINEE`. Sans effet pour tout autre type de partie.
   */
  async assertIsolatedOpen(partie: {
    id: string;
    kind: PartieKind;
    gameSystemId: string;
    closedAt: Date | null;
  }): Promise<void> {
    if (partie.kind !== 'ONE_SHOT' || familyOf(partie.gameSystemId) !== 'ralliement') return;
    // Story 42.2 : une soirée annulée est figée, plus encore qu'une soirée terminée. Story 49.1 : la décision
    // est celle de `eventClosure`, la règle de statut que lit aussi la route des jeux sur place.
    const cancelled = (await this.cancelledIsolatedPartieIds([partie.id])).has(partie.id);
    const finished =
      !cancelled &&
      (partie.closedAt !== null || (await this.endedIsolatedPartieIds([partie.id])).has(partie.id));
    const closure = eventClosure({ cancelled, finished });
    if (closure === 'CANCELLED') throw new BadRequestException(EVENING_CANCELLED_MESSAGE);
    if (closure === 'ENDED') throw new BadRequestException(EVENING_FINISHED_MESSAGE);
  }

  /**
   * Story 49.1 : les faits dont la route des jeux sur place d'une soirée a besoin — l'hôte, l'annulation, la
   * plage de la séance (la première, l'événement n'en porte qu'une), ses inscriptions (conjonction de groupe)
   * ou les membres de la partie (rencontre isolée). Lecture seule ; la décision (N, ouverte ou non) est dans
   * `participantsOf` et `eventIsOpen`. `null` si l'événement n'existe pas. Story 49.2 : `db` permet de la
   * relire sur le client d'une transaction, sous le verrou de l'événement (écritures d'`EventGameBringService`).
   */
  async boardGamesBasis(
    eventId: string,
    partie: { id: string; isolated: boolean },
    db: Pick<Prisma.TransactionClient, 'event' | 'membership'> = this.prisma,
  ): Promise<EventBoardGamesBasis | null> {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        cancelledAt: true,
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: {
            startDate: true,
            endDate: true,
            // Les inscriptions ne comptent que pour une conjonction de groupe.
            ...(partie.isolated
              ? {}
              : { inscriptions: { select: { userId: true, status: true } } }),
          },
        },
      },
    });
    if (!event) return null;
    const seance = event.seances[0] as
      | {
          startDate: Date | null;
          endDate: Date | null;
          inscriptions?: { userId: string; status: InscriptionStatus }[];
        }
      | undefined;
    const memberIds = partie.isolated
      ? (
          await db.membership.findMany({
            where: { partieId: partie.id },
            select: { userId: true },
          })
        ).map((m) => m.userId)
      : [];
    return {
      hostId: event.ownerId,
      cancelledAt: event.cancelledAt,
      startDate: seance?.startDate ?? null,
      endDate: seance?.endDate ?? null,
      inscriptions: seance?.inscriptions ?? [],
      memberIds,
    };
  }

  /**
   * Story 50.2 : combien de conjonctions PASSÉES et NON ANNULÉES chaque hôte a reçues dans cette partie — dérivé
   * à la lecture, jamais stocké. Seule la règle partagée `isSeancePast` dit « passée », sur la première séance de
   * l'événement (le même choix que `listCards`) ; un événement sans date n'est jamais passé, et un événement sans
   * hôte (compte supprimé) n'est attribué à personne. Lecture seule : le droit et le filtre « membres actuels »
   * sont ceux de l'appelant.
   */
  async pastHostedCounts(partieId: string): Promise<{ hostId: string; count: number }[]> {
    const events = await this.prisma.event.findMany({
      where: { partieId, cancelledAt: null, ownerId: { not: null } },
      select: {
        ownerId: true,
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: { startDate: true, endDate: true },
        },
      },
    });
    const counts = new Map<string, number>();
    for (const event of events) {
      const seance = event.seances[0];
      if (!event.ownerId || !seance || !isSeancePast(seance.startDate, seance.endDate)) continue;
      counts.set(event.ownerId, (counts.get(event.ownerId) ?? 0) + 1);
    }
    return [...counts].map(([hostId, count]) => ({ hostId, count }));
  }

  /**
   * Story 41.3 : de quoi écrire l'e-mail d'invitation à une soirée isolée — son événement unique (le
   * premier de la partie), sa date ou l'échéance de son vote, son lieu. Lecture seule : l'invitation ne
   * lit jamais les tables d'événements elle-même. `null` si la partie n'a aucun événement.
   */
  async invitationNotice(partieId: string): Promise<InvitationNotice | null> {
    const event = await this.prisma.event.findFirst({
      where: { partieId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        title: true,
        seances: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: {
            startDate: true,
            startSlot: true,
            endDate: true,
            endSlot: true,
            lieu: true,
            poll: { select: { status: true, expiresAt: true } },
          },
        },
      },
    });
    if (!event) return null;
    const seance = event.seances[0];
    const openPoll = seance?.poll?.status === 'OPEN' ? seance.poll : null;
    return {
      eventTitle: event.title,
      startDate: seance?.startDate ?? null,
      startSlot: seance?.startSlot ?? null,
      endDate: seance?.endDate ?? null,
      endSlot: seance?.endSlot ?? null,
      deadline: !seance?.startDate ? (openPoll?.expiresAt ?? null) : null,
      lieu: seance?.lieu ?? null,
    };
  }

  /** Prend le verrou de ligne de l'événement de la séance, PUIS relit la séance et l'hôte : tout ce
   *  qui décide d'une inscription (capacité, jour) est lu sous le verrou, jamais avant. */
  private async lockedSeanceOfEvent(
    tx: Prisma.TransactionClient,
    seanceId: string,
  ): Promise<{
    seance: { startDate: Date | null; endDate?: Date | null; inscriptionMax: number | null };
    ownerId: string | null;
    eventId: string;
  }> {
    const ref = await tx.seance.findUnique({ where: { id: seanceId }, select: { eventId: true } });
    if (!ref) throw new NotFoundException('Séance introuvable');
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${ref.eventId} FOR UPDATE`;
    const seance = await tx.seance.findUnique({
      where: { id: seanceId },
      select: {
        startDate: true,
        endDate: true,
        inscriptionMax: true,
        event: { select: { ownerId: true, cancelledAt: true } },
      },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    // Story 42.1 : inscription, désinscription, réservation et acceptation sont refusées une fois la
    // conjonction annulée — lu sous le verrou, donc sérialisé avec l'annulation.
    if (seance.event.cancelledAt) throw new BadRequestException(CANCELLED_EVENT_MESSAGE);
    return {
      seance: {
        startDate: seance.startDate,
        endDate: seance.endDate,
        inscriptionMax: seance.inscriptionMax,
      },
      ownerId: seance.event.ownerId,
      eventId: ref.eventId,
    };
  }

  /** Les inscriptions d'une conjonction se figent quand son jour est passé (jour UTC strictement avant
   *  aujourd'hui, comme la modification). Une séance sans date n'est jamais passée. */
  private assertNotPast(startDate: Date | null, endDate?: Date | null): void {
    // Story 47.2 : c'est la fin de la plage qui fige les inscriptions (une plage commencée reste ouverte).
    if (isSeancePast(startDate, endDate)) {
      throw new BadRequestException(PAST_ROSTER_MESSAGE);
    }
  }

  // ─── Vote sur le sondage d'une conjonction (Story 40.5) ─────────────────────────────────────

  /**
   * `GroupPollVotePort` : un vote (ou son retrait) sur le sondage d'un groupe est-il recevable ? Une
   * seule lecture de la séance rattachée au sondage (avec son hôte, sa capacité et ses inscriptions),
   * plus celle des membres seulement quand la conjonction accueille tous les membres. Refus, dans
   * l'ordre : sondage sans conjonction de cette partie (400) ; date déjà fixée (400) ; échéance dépassée (400) ; votant hors de
   * `eligibleVoters` (403). Ne lève rien d'autre, n'écrit rien.
   */
  async assertCanVote(
    poll: { id: string; partieId: string; expiresAt: Date | null },
    _partie: { kind: PartieKind },
    userId: string,
  ): Promise<void> {
    // Story 41.2 : tout ralliement vote (groupe comme soirée isolée) — l'appelant n'ouvre ce port qu'à
    // la famille `ralliement`, et les votants éligibles restent ceux d'`eligibleVoters`.
    const seance = await this.prisma.seance.findUnique({
      where: { pollId: poll.id },
      select: {
        startDate: true,
        inscriptionMax: true,
        inscriptions: { select: { userId: true, status: true } },
        event: {
          select: {
            partieId: true,
            ownerId: true,
            cancelledAt: true,
            partie: { select: { id: true, kind: true, gameSystemId: true, closedAt: true } },
          },
        },
      },
    });
    if (!seance || seance.event.partieId !== poll.partieId) {
      throw new BadRequestException('Poll introuvable ou fermé');
    }
    // Story 41.4 : une soirée close (même sans date) ne prend plus de vote ; une soirée passée est datée,
    // donc déjà refusée plus bas.
    await this.assertIsolatedOpen(seance.event.partie);
    // Story 42.1 : une conjonction annulée ne prend plus de vote.
    if (seance.event.cancelledAt) throw new BadRequestException(CANCELLED_EVENT_MESSAGE);
    if (seance.startDate) throw new BadRequestException(VOTE_DATE_SET_MESSAGE);
    if (poll.expiresAt && poll.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(VOTE_ENDED_MESSAGE);
    }
    const memberIds =
      seance.inscriptionMax === null
        ? (
            await this.prisma.membership.findMany({
              where: { partieId: poll.partieId },
              select: { userId: true },
            })
          ).map((m) => m.userId)
        : [];
    const voters = eligibleVoters({
      hostId: seance.event.ownerId,
      inscriptionMax: seance.inscriptionMax,
      inscriptions: seance.inscriptions,
      memberIds,
    });
    if (!voters.includes(userId)) throw new ForbiddenException(VOTE_NOT_ELIGIBLE_MESSAGE);
  }

  /**
   * `GroupPollVotePort` (Story 40.6) : prend, DANS la transaction de l'appelant, le verrou de ligne de la
   * partie PUIS celui de l'événement du sondage (même ordre que `updateHosted`, `createInTx`, `leave` :
   * jamais l'inverse), et dit si la date de la conjonction est déjà fixée. Le vote, son retrait et
   * l'arrêt de la date relisent leur état APRÈS ce verrou : un vote et une fixation simultanés sont
   * sérialisés, le perdant voit le sondage fermé. Refuse (400) un sondage sans conjonction de sa partie.
   */
  async lockConjonction(
    tx: Prisma.TransactionClient,
    poll: { id: string; partieId: string },
  ): Promise<{ dated: boolean }> {
    const ref = await tx.seance.findUnique({
      where: { pollId: poll.id },
      select: { event: { select: { id: true, partieId: true } } },
    });
    if (!ref || ref.event.partieId !== poll.partieId) {
      throw new BadRequestException('Poll introuvable ou fermé');
    }
    await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${poll.partieId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${ref.event.id} FOR UPDATE`;
    const seance = await tx.seance.findUnique({
      where: { pollId: poll.id },
      select: { startDate: true, event: { select: { cancelledAt: true } } },
    });
    if (!seance) throw new BadRequestException('Poll introuvable ou fermé');
    // Story 42.1 : voter, fixer la date ou prolonger le vote d'une conjonction annulée est refusé.
    if (seance.event.cancelledAt) throw new BadRequestException(CANCELLED_EVENT_MESSAGE);
    return { dated: seance.startDate !== null };
  }

  /** Événement de la conjonction qui porte le sondage `pollId` dans la partie `partieId` (Story 40.6) :
   *  de quoi décider du droit « hôte » sur la cible `{ eventId }`. `null` si le sondage n'est rattaché
   *  à aucune conjonction de cette partie. */
  async eventIdOfPoll(pollId: string, partieId: string): Promise<string | null> {
    const seance = await this.prisma.seance.findUnique({
      where: { pollId },
      select: { event: { select: { id: true, partieId: true } } },
    });
    return seance && seance.event.partieId === partieId ? seance.event.id : null;
  }

  /**
   * De quoi écrire l'e-mail « C'est fixé » (Story 40.6), lu APRÈS le commit : titre, date, lieu et les
   * destinataires — les inscrits CONFIRMÉS d'un groupe, ou les membres d'une soirée isolée (Story 41.2),
   * l'hôte exclu, une adresse chacun. `null` si la conjonction n'existe plus ou n'est pas datée.
   */
  async dateFixedNotice(
    pollId: string,
  ): Promise<(Omit<ReservationNotice, 'hostName'> & { partieId: string }) | null> {
    const seance = await this.prisma.seance.findUnique({
      where: { pollId },
      select: {
        startDate: true,
        startSlot: true,
        endDate: true,
        endSlot: true,
        lieu: true,
        event: {
          select: {
            title: true,
            partieId: true,
            ownerId: true,
            // Story 41.2 : les membres d'une soirée isolée (la soirée n'a pas d'inscriptions).
            partie: {
              select: {
                kind: true,
                memberships: {
                  orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
                  select: { user: { select: { id: true, email: true } } },
                },
              },
            },
          },
        },
        inscriptions: {
          where: { status: 'CONFIRMED' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { user: { select: { id: true, email: true } } },
        },
      },
    });
    if (!seance || !seance.startDate) return null;
    const hostId = seance.event.ownerId;
    const invited =
      seance.event.partie.kind === 'ONE_SHOT'
        ? seance.event.partie.memberships
        : seance.inscriptions;
    return {
      partieId: seance.event.partieId,
      eventTitle: seance.event.title,
      startDate: seance.startDate,
      startSlot: seance.startSlot,
      endDate: seance.endDate,
      endSlot: seance.endSlot,
      lieu: seance.lieu,
      recipients: invited.map((i) => i.user).filter((user) => user.id !== hostId),
    };
  }

  // ─── Destinataires du rappel de la veille ───────────────────────────────────────────────────

  /**
   * Destinataires du rappel de la veille d'une séance (Story 40.3) — UNE définition, lue par la tâche
   * horaire. Groupe de ralliement : l'hôte de l'événement + les inscrits CONFIRMÉS (Story 40.4 : une
   * place seulement réservée n'est pas une participation). Toute autre famille garde ses destinataires : le propriétaire et les
   * membres de la partie — le seul propriétaire quand la séance est celle d'un brouillon caché
   * (anti-spoil serveur). Dédoublonné par identifiant, l'ordre d'apparition est conservé.
   */
  reminderRecipients(seance: ReminderSeance): ReminderRecipient[] {
    const { partie } = seance.event;
    let recipients: ReminderRecipient[];
    if (isRalliementGroup(partie)) {
      recipients = [
        ...(seance.event.owner ? [seance.event.owner] : []),
        ...(seance.inscriptions ?? []).filter(isConfirmed).map((i) => i.user),
      ];
    } else {
      // Propriétaire absent (AD-5, compte supprimé) : seuls les membres restent destinataires.
      // Anti-spoil serveur : la séance d'un brouillon caché (scénario `BROUILLON` hors `ONE_SHOT`)
      // n'est rappelée qu'au propriétaire, jamais aux membres, tant que le scénario n'est pas ouvert.
      const scenario = seance.event.scenario;
      const ownerOnly = !!scenario && isHiddenDraft(scenario.status, partie.kind);
      recipients = [
        ...(partie.owner ? [partie.owner] : []),
        ...(ownerOnly ? [] : partie.memberships.map((m) => m.user)),
      ];
    }
    return [...new Map(recipients.map((r) => [r.id, r])).values()];
  }

  /**
   * Destinataires de la relance de vote de la veille de l'échéance (Story 40.7) — UNE définition, lue par
   * la tâche horaire : les votants éligibles du sondage (`eligibleVoters`, la même définition que le
   * refus d'un vote et le résumé des cartes) qui n'ont AUCUNE réponse sur le sondage. Pur : tout est lu
   * avec les sondages dus (une seule lecture groupée, jamais une requête par sondage ni par votant).
   * Un éligible dont l'adresse n'est pas connue (ni hôte, ni inscrit, ni membre) est ignoré. L'ordre
   * d'`eligibleVoters` est conservé (l'hôte d'abord).
   */
  voteReminderRecipients(poll: VoteReminderPoll): ReminderRecipient[] {
    const { seance } = poll;
    const known = new Map<string, ReminderRecipient>();
    for (const user of [
      ...(seance.event.owner ? [seance.event.owner] : []),
      ...seance.inscriptions.map((i) => i.user),
      ...seance.event.partie.memberships.map((m) => m.user),
    ]) {
      known.set(user.id, user);
    }
    const voted = new Set(poll.votes.map((v) => v.userId));
    return eligibleVoters({
      hostId: seance.event.owner?.id ?? null,
      inscriptionMax: seance.inscriptionMax,
      inscriptions: seance.inscriptions.map((i) => ({ userId: i.user.id, status: i.status })),
      memberIds: seance.event.partie.memberships.map((m) => m.user.id),
    })
      .filter((userId) => !voted.has(userId))
      .flatMap((userId) => known.get(userId) ?? []);
  }

  // ─── Prochaine séance ───────────────────────────────────────────────────────────────────────

  /**
   * Story 8.8 (Décision 2) : un seul vote actif par Séance — Partie.nextSessionDate/nextSessionSlot
   * reflètent la date la plus proche dans le futur parmi TOUTES les séances de la Partie
   * (début de leur plage, Story 37.4). Appelé après tout événement pouvant faire changer cette date :
   * choix d'un vote (`chooseDate`), réinitialisation ou suppression d'une séance. Ne touche pas
   * aux rappels : ils sont portés par chaque séance (Story 37.9).
   */
  async recalculateNextSession(partieId: string): Promise<void> {
    await this.recomputeNextSession(this.prisma, partieId);
  }

  /**
   * Story 37.8 (AD-15) : SEUL écrivain de `Partie.nextSessionDate/nextSessionSlot`. Variante à
   * exécuter dans la transaction de l'appelant (`chooseDate`) ; `recalculateNextSession` calcule
   * hors transaction. N'émet jamais.
   *
   * Prend un verrou de ligne sur la partie AVANT de lire les séances : sous READ COMMITTED, deux
   * votes de la même partie choisis en même temps recalculeraient chacun depuis un instantané
   * privé de la plage non validée de l'autre, et le dernier à écrire figerait une valeur périmée.
   * Le verrou les sérialise : le second relit les séances une fois le premier validé.
   */
  async recalculateNextSessionInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
  ): Promise<NextSession> {
    await tx.$queryRaw`SELECT "id" FROM "Partie" WHERE "id" = ${partieId} FOR UPDATE`;
    return this.recomputeNextSession(tx, partieId);
  }

  private async recomputeNextSession(
    tx: Prisma.TransactionClient,
    partieId: string,
  ): Promise<NextSession> {
    // Anti-spoil serveur : la valeur est UNIQUE et persistée, partagée par tous les lecteurs (MJ
    // compris) — les séances d'un brouillon caché n'y entrent donc jamais, sans quoi un joueur lirait
    // la date d'un scénario qu'il ne doit pas voir. Elles y entrent à l'ouverture du scénario.
    const seances = await tx.seance.findMany({
      // Story 42.1 : une conjonction annulée n'est jamais la prochaine date.
      where: { AND: [{ event: { partieId, cancelledAt: null } }, VISIBLE_SEANCE_WHERE] },
      select: { startDate: true, startSlot: true, endDate: true, endSlot: true },
    });

    // Bug fix (production) : comparer à Date.now() excluait TOUJOURS une séance datée
    // d'aujourd'hui dès que l'heure courante dépassait minuit, quel que soit le créneau — on
    // compare donc au début du jour courant (UTC), pas à l'horodatage exact.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const now = startOfToday.getTime();
    type Candidate = { date: Date; slot: DaySlot | null; end: Date; endSlot: DaySlot | null };
    const nearest =
      seances
        .map((s): Candidate | null => {
          // Créneau vide = « sans créneau » (date posée hors vote) → `nextSessionSlot` null.
          if (!s.startDate) return null;
          return {
            date: s.startDate,
            slot: s.startSlot ?? null,
            // Story 47.2 : la fin de la plage décide du « à venir » (une plage commencée en fait partie).
            end: s.endDate ?? s.startDate,
            endSlot: s.endDate ? (s.endSlot ?? null) : (s.startSlot ?? null),
          };
        })
        .filter((c): c is Candidate => c !== null && c.end.getTime() >= now)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;

    const next: NextSession = {
      nextSessionDate: nearest?.date ?? null,
      nextSessionSlot: nearest?.slot ?? null,
      nextSessionEndDate: nearest?.end ?? null,
      nextSessionEndSlot: nearest?.endSlot ?? null,
    };
    await tx.partie.update({ where: { id: partieId }, data: next });
    return next;
  }

  // ─── Ports du calendrier (Story 37.8) ───────────────────────────────────────────────────────

  /**
   * `OccupiedSpansPort` (AD-9) : pour chaque utilisateur demandé, les plages occupées par une
   * séance datée de N'IMPORTE LAQUELLE de ses parties (propriétaire ou membre) — pas seulement
   * celle consultée par l'appelant. La sortie est réduite à `{ date, slot }` : jamais une identité
   * de partie/scénario, la non-fuite cross-partie découle directement de cette forme.
   *
   * Participant d'une séance datée : ONE_SHOT/CAMPAGNE_LINEAIRE → tous les membres + le
   * propriétaire (aucune présence individuelle dans ces kinds) ; CAMPAGNE_EPISODIQUE → le
   * propriétaire + les seuls utilisateurs inscrits (`Inscription`) à CETTE séance — un joueur non
   * inscrit n'est engagé sur rien. Groupe de ralliement (`CAMPAGNE_EPISODIQUE`, Story 40.1, AD-15) :
   * l'HÔTE de l'événement (`Event.ownerId`, pas le propriétaire de la partie) + les inscrits de la
   * séance ; la rencontre isolée de ralliement (`ONE_SHOT`) garde la règle « tous les membres ».
   *
   * Deux requêtes Prisma au total, jamais une par utilisateur ni par partie (pas de N+1).
   */
  async occupiedSpansOf(userIds: string[]): Promise<Map<string, OccupiedSpan[]>> {
    const map = new Map<string, OccupiedSpan[]>();
    for (const userId of userIds) map.set(userId, []);

    const parties = await this.prisma.partie.findMany({
      where: {
        OR: [{ ownerId: { in: userIds } }, { memberships: { some: { userId: { in: userIds } } } }],
      },
      select: {
        id: true,
        kind: true,
        gameSystemId: true,
        ownerId: true,
        memberships: { select: { userId: true } },
      },
    });
    if (parties.length === 0) return map;

    const partieIds = parties.map((p) => p.id);
    const partieById = new Map(parties.map((p) => [p.id, p]));
    const seances = await this.prisma.seance.findMany({
      // Story 42.1 : une conjonction annulée n'occupe plus personne.
      where: { event: { partieId: { in: partieIds }, cancelledAt: null } },
      include: {
        inscriptions: { select: { userId: true, status: true } },
        event: { select: { partieId: true, ownerId: true } },
      },
    });

    const requested = new Set(userIds);

    for (const seance of seances) {
      // Story 37.4 : la plage de la séance est la seule source ; créneau vide = FULL_DAY ici.
      const date = seance.startDate;
      if (!date) continue;
      const slot = seance.startSlot ?? 'FULL_DAY';

      const partie = partieById.get(seance.event.partieId);
      if (!partie) continue; // partie hors du périmètre résolu ci-dessus

      // Story 40.4 : une place seulement réservée n'engage personne — hôte + inscrits CONFIRMÉS.
      const inscritIds = seance.inscriptions.filter(isConfirmed).map((i) => i.userId);
      let participantIds: Set<string>;
      if (isRalliementGroup(partie)) {
        // Story 40.1 : groupe de ralliement — hôte de l'événement + inscrits. Hôte absent (compte supprimé) : les inscrits.
        const hostIds = seance.event.ownerId ? [seance.event.ownerId] : [];
        participantIds = new Set([...hostIds, ...inscritIds]);
      } else {
        // Propriétaire absent (AD-5, compte supprimé) : seuls les membres/inscrits sont concernés.
        const ownerIds = partie.ownerId === null ? [] : [partie.ownerId];
        participantIds =
          partie.kind === 'CAMPAGNE_EPISODIQUE'
            ? new Set([...ownerIds, ...inscritIds])
            : new Set([...ownerIds, ...partie.memberships.map((m) => m.userId)]);
      }

      const dayUtc = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );

      // Story 47.2 (AD-14) : la plage est dépliée créneau par créneau (`spanSlots`) — un rendez-vous de N
      // créneaux occupe chacun d'eux, du soir au lendemain matin compris. Un créneau seul, une journée
      // entière ou une date sans créneau gardent leur entrée unique.
      const covered: OccupiedSpan[] =
        seance.startSlot && seance.startSlot !== 'FULL_DAY' && seance.durationSlots > 1
          ? spanSlots(
              dayUtc.toISOString().substring(0, 10),
              seance.startSlot,
              seance.durationSlots,
            ).map((c) => ({ date: parseDayKey(c.date)!, slot: c.slot }))
          : [{ date: dayUtc, slot }];

      for (const userId of participantIds) {
        // Copie par entrée : chaque utilisateur reçoit ses propres objets, jamais une référence
        // partagée avec les autres participants de la même séance.
        if (requested.has(userId)) {
          map.get(userId)!.push(...covered.map((c) => ({ date: new Date(c.date), slot: c.slot })));
        }
      }
    }

    return map;
  }

  /**
   * `OwnEventsPort` : le calendrier personnel d'un utilisateur — ses parties (propriétaire ou
   * membre) et, en UNE lecture groupée des séances de toutes ces parties (AD-3, jamais une
   * itération par partie), les couches `mes-seances` et `inscriptions-ouvertes`. Identité de
   * partie/scénario incluse : ce sont ses propres parties.
   */
  async ownEventsOf(
    userId: string,
    roles: OwnRolesResolver,
    range: OwnEventsRange,
  ): Promise<OwnEvents> {
    const found = await this.prisma.partie.findMany({
      // Story 42.5 : une partie retirée de sa liste sort aussi de son calendrier personnel.
      where: {
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        hiddenBy: { none: { userId } },
      },
      select: { id: true, name: true, kind: true, gameSystemId: true },
    });
    if (found.length === 0) return { parties: [], seances: [], inscriptionsOuvertes: [] };
    // La famille sert au choix des participants ; la sortie garde sa forme (id, nom, nature).
    const ralliementIds = new Set(found.filter(isRalliementGroup).map((p) => p.id));
    const parties = found.map(({ id, name, kind }) => ({ id, name, kind }));

    const partieIds = parties.map((p) => p.id);
    const partieById = new Map(parties.map((p) => [p.id, p]));

    const [seances, roleByPartie] = await Promise.all([
      this.prisma.seance.findMany({
        // Story 42.1 : une conjonction annulée sort des calendriers personnels.
        where: { event: { partieId: { in: partieIds }, cancelledAt: null } },
        include: {
          inscriptions: { select: { userId: true, status: true } },
          event: {
            select: {
              partieId: true,
              title: true,
              ownerId: true,
              scenario: { select: { status: true } },
            },
          },
        },
      }),
      // Rôle de l'utilisateur sur chacune de ses parties, en UNE requête (jamais une par partie).
      roles(partieIds),
    ]);

    const mySeances: MyCalendarSeanceEntry[] = [];
    const openInscriptions: MyCalendarOpenInscriptionEntry[] = [];
    for (const s of seances) {
      const partie = partieById.get(s.event.partieId);
      if (!partie) continue;

      // Anti-spoil serveur : tout rôle autre que MJ (inconnu compris) ignore les séances d'un
      // brouillon caché ; seul le MJ voit tout.
      if (
        isSpoilRestricted(roleByPartie.get(partie.id)) &&
        s.event.scenario &&
        isHiddenDraft(s.event.scenario.status, partie.kind)
      ) {
        continue;
      }

      // Mes séances datées dans la fenêtre. Pour une partie CAMPAGNE_EPISODIQUE, une séance n'est
      // « mienne » que si j'y suis inscrit (ou MJ) — même règle « participant » qu'`occupiedSpansOf`
      // (AD-9), sinon un membre non inscrit verrait listée comme sienne une séance à laquelle il
      // ne participe pas.
      const date = s.startDate;
      // Story 40.4 : seule une inscription CONFIRMÉE rend la séance « mienne » (une place réservée
      // pas encore acceptée n'engage pas le calendrier).
      const inscrit = s.inscriptions.some((i) => i.userId === userId && isConfirmed(i));
      // Story 40.1 : dans un groupe de ralliement, la séance est « mienne » si j'en suis l'hôte
      // (propriétaire de l'événement) ou inscrit — jamais par un rôle de partie.
      const notMine = ralliementIds.has(partie.id)
        ? s.event.ownerId !== userId && !inscrit
        : partie.kind === 'CAMPAGNE_EPISODIQUE' && roleByPartie.get(partie.id) !== 'mj' && !inscrit;
      // Story 47.2 : le filtre de période teste le CHEVAUCHEMENT de la plage (une séance du 31 au 1ᵉʳ
      // apparaît dans les deux mois), pas son seul début.
      const lastDay = s.endDate ?? date;
      if (
        date &&
        lastDay &&
        lastDay.getTime() >= range.fromMs &&
        date.getTime() <= range.toMs &&
        !notMine
      ) {
        mySeances.push({
          seanceId: s.id,
          partieId: partie.id,
          partieName: partie.name,
          scenarioId: s.eventId,
          scenarioTitle: s.event.title,
          date: date.toISOString().substring(0, 10),
          // AC5 : créneau de la plage de la séance (Story 37.4), FULL_DAY à défaut — jamais une
          // supposition locale à l'appelant.
          slot: s.startSlot ?? 'FULL_DAY',
          endDate: lastDay.toISOString().substring(0, 10),
          endSlot: s.endSlot ?? s.startSlot ?? 'FULL_DAY',
          durationSlots: s.durationSlots,
          // Story 36.5 — transmis tels quels. `heureRdv` reste une CHAÎNE : rien ici ne la parse
          // ni ne la compare, et elle n'entre pas dans le calcul de statut de créneau (AD-9).
          heureRdv: s.heureRdv ?? null,
          lieu: s.lieu ?? null,
          notePratique: s.notePratique ?? null,
          // Story 36.16 — même formule que `CalendarView.allCalendarEntries()` (front) : une
          // chaîne vide ou uniquement des espaces compte comme manquant.
          compteRenduManquant: !s.compteRendu?.trim(),
        });
      }

      // Séances à inscription ouverte de mes parties CAMPAGNE_EPISODIQUE — jamais filtrées par
      // fenêtre (D-13, Story 30.5) : une séance en attente d'inscriptions n'a pas encore de date.
      // Une date validée (plage de la séance) fige le roster (`inscrire()`) : plus « ouverte ».
      // Story 40.5 : une conjonction de groupe à sondage n'a pas de date non plus — son sondage est
      // le sien, jamais une « inscription ouverte » du calendrier personnel du JDR.
      if (
        s.inscriptionMax != null &&
        !s.startDate &&
        partie.kind === 'CAMPAGNE_EPISODIQUE' &&
        !ralliementIds.has(partie.id)
      ) {
        openInscriptions.push({
          seanceId: s.id,
          partieId: partie.id,
          partieName: partie.name,
          scenarioId: s.eventId,
          scenarioTitle: s.event.title,
          inscriptionMin: s.inscriptionMin ?? 0,
          inscriptionMax: s.inscriptionMax,
          inscritsCount: s.inscriptions.filter(isConfirmed).length,
          jeSuisInscrit: inscrit,
        });
      }
    }

    return { parties, seances: mySeances, inscriptionsOuvertes: openInscriptions };
  }
}
