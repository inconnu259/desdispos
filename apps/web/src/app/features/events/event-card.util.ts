import { hasAnswered } from '@master-jdr/shared';
import type {
  DaySlot,
  EventCardDto,
  EventParticipantDto,
  OpenPollOption,
} from '@master-jdr/shared';
import type { StatusBadgeState } from '../../core/status/status-derivation';
import { daysBetweenKeys, imminenceIntensity } from '../../core/status/status-badge.model';
import { fillTone } from '../../core/theme/tone-format';
import { SLOT_LABELS } from '../calendar/agenda-badge.utils';
import { candidateSpanShort, isSpan, spanShortLabel } from '../calendar/span-label';

/**
 * Story 40.1 — dérivations PURES de la carte d'une conjonction (testables sans TestBed). Le jour de
 * l'événement est la clé `YYYY-MM-DD` servie par l'API ; « aujourd'hui » est une clé de jour figée
 * par l'écran (même convention que `CalendarView.todayKey` / `PartieDetail.todayKey`).
 */

/** Textes de registre dont la carte a besoin (sous-ensemble de `theme.tone()`). */
export type EventTone = Readonly<Record<string, string>>;

/** Jour de la conjonction, ou `null` tant qu'il n'est pas fixé. */
export function eventDayKey(card: EventCardDto): string | null {
  return card.seance?.date ?? null;
}

/** Story 42.1 : la conjonction est annulée (définitif, décidé par le serveur). Elle n'offre plus aucune
 *  action, quelle que soit sa date. */
export function isCancelled(card: EventCardDto): boolean {
  return card.cancelled;
}

/** Passée : son jour est AVANT aujourd'hui (aujourd'hui reste « À venir »). Sans date : à venir. */
export function isPastEvent(card: EventCardDto, todayKey: string): boolean {
  const day = eventDayKey(card);
  // Story 47.3 : une plage de plusieurs créneaux n'est passée qu'une fois sa FIN passée — le serveur la tient pour
  // modifiable et annulable jusque-là.
  const last = card.seance?.endDate && day && card.seance.endDate > day ? card.seance.endDate : day;
  return last !== null && last < todayKey;
}

/** Imminente : à venir et au palier `imminent` (aujourd'hui ou demain) de `imminenceIntensity`. */
export function isImminentEvent(card: EventCardDto, todayKey: string): boolean {
  const day = eventDayKey(card);
  return day !== null && day >= todayKey && imminenceIntensity(day, todayKey) === 'imminent';
}

/** Story 40.3 : toutes les places d'une conjonction à places limitées sont prises. Story 40.4 : les
 *  places prises sont celles du serveur (`placesTaken` : l'hôte et TOUTES les lignes, réservées
 *  comprises) — la liste des participants n'en montre pas forcément autant. « Tous les membres » (sans
 *  limite) n'est jamais complet. */
export function isFull(card: EventCardDto): boolean {
  const capacity = card.seance?.capacity ?? null;
  return capacity !== null && (card.seance?.placesTaken ?? 0) >= capacity;
}

/** Story 40.3 : la personne peut encore s'inscrire — conjonction avec séance, membre ni hôte ni inscrit, conjonction à venir
 *  et pas complète. (Le serveur reste juge : une course sur la dernière place répond 409.) */
export function canSignUp(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
): boolean {
  return (
    !!currentUserId &&
    card.seance !== null &&
    !isCancelled(card) &&
    !isParticipantOf(card, currentUserId) &&
    // Story 40.4 : qui tient une place réservée l'accepte ou la décline, il ne « s'inscrit » pas.
    card.myInscription !== 'RESERVED' &&
    !isPastEvent(card, todayKey) &&
    !isFull(card)
  );
}

/** Story 40.3 : « Complet » est écrit pour une personne NON inscrite quand la conjonction à venir n'a
 *  plus de place ; les inscrits et l'hôte gardent leur état normal. */
export function isFullForViewer(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
): boolean {
  return (
    isFull(card) &&
    !isCancelled(card) &&
    !isParticipantOf(card, currentUserId) &&
    // Story 40.4 : la place réservée est la sienne — la conjonction n'est pas « complète » pour lui.
    card.myInscription !== 'RESERVED' &&
    !isPastEvent(card, todayKey)
  );
}

/** Story 40.3 : un inscrit (jamais l'hôte, qui garde sa place) peut se désinscrire tant que la
 *  conjonction n'est pas passée. */
export function canUnsubscribe(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
): boolean {
  return (
    !!currentUserId &&
    card.seance !== null &&
    !isCancelled(card) &&
    isParticipantOf(card, currentUserId) &&
    !isHostOf(card, currentUserId) &&
    !isPastEvent(card, todayKey)
  );
}

/**
 * Badge d'état (UX-DR7) : « Passé » (teinte `done`) ; « Complet » (même teinte grise) pour une
 * personne non inscrite quand toutes les places sont prises (Story 40.3) ; « Dans *n* jours » dans la
 * semaine qui vient (teinte `soon`, intensité `near`, PLEIN au palier `imminent` — « Aujourd'hui » /
 * « Demain ») ; « À venir » au-delà ou sans date. Le libellé est toujours écrit : la teinte le double.
 * `currentUserId` absent : aucune personne n'est inscrite, donc « Complet » s'applique.
 */
export function eventBadge(
  card: EventCardDto,
  todayKey: string,
  tone: EventTone,
  currentUserId?: string | null,
): StatusBadgeState {
  // Story 42.1 : « Annulée », écrit, l'emporte sur tout autre état (même passée).
  if (isCancelled(card)) {
    return {
      tone: 'cancelled',
      labelKey: 'status.scenario_passe',
      draft: false,
      text: tone['partie.ralliement_event_badge_cancelled'],
    };
  }
  if (isPastEvent(card, todayKey)) {
    return { tone: 'done', labelKey: 'status.scenario_passe', draft: false };
  }
  // Story 40.5 : tant que le vote est ouvert, la date n'est pas posée — « Vote en cours », orange pour
  // un votant éligible qui n'a pas encore répondu, cyan pour tous les autres.
  if (isPollOpen(card, todayKey)) {
    return {
      tone: needsVote(card, currentUserId, todayKey) ? 'todo' : 'live',
      labelKey: 'status.scenario_a_venir',
      draft: false,
      text: tone['partie.ralliement_event_badge_poll'],
    };
  }
  if (isFullForViewer(card, currentUserId, todayKey)) {
    return {
      tone: 'done',
      labelKey: 'status.scenario_passe',
      draft: false,
      text: tone['partie.ralliement_event_badge_full'],
    };
  }
  const day = eventDayKey(card);
  const upcoming: StatusBadgeState = {
    tone: 'soon',
    labelKey: 'status.scenario_a_venir',
    draft: false,
  };
  if (day === null) return upcoming;
  const intensity = imminenceIntensity(day, todayKey);
  if (intensity === 'far') return upcoming;
  const days = daysBetweenKeys(todayKey, day);
  const text =
    days <= 0
      ? tone['partie.ralliement_event_badge_today']
      : days === 1
        ? tone['partie.ralliement_event_badge_tomorrow']
        : fillTone(tone['partie.ralliement_event_badge_in_days'], { n: days });
  return { ...upcoming, intensity, text };
}

/** Date en gras de la carte : « Sam. 10 oct. · soir ». Sans date : « Date à fixer ». */
export function eventDateLabel(card: EventCardDto, tone: EventTone): string {
  const day = eventDayKey(card);
  // Story 40.5 : « Date à voter · jusqu'au sam. 25 oct. » tant que le sondage décide de la date.
  if (!day && hasPendingPoll(card)) {
    const deadline = pollDeadlineKey(card);
    if (deadline) {
      return fillTone(tone['partie.ralliement_event_poll_date_line'], {
        date: shortDayLabel(deadline),
      });
    }
  }
  if (!day) return tone['partie.ralliement_event_no_date'];
  const [y, m, d] = day.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const date = formatted.charAt(0).toLocaleUpperCase('fr-FR') + formatted.slice(1);
  const slot: DaySlot | null = card.seance?.slot ?? null;
  // Story 47.3 : une plage de plusieurs créneaux se lit du début à la fin (« Ven. 6 nov. soir → dim. 8 nov. après-midi »).
  const endDate = card.seance?.endDate;
  if (endDate && isSpan({ date: day, slot }, { date: endDate, slot: card.seance?.endSlot })) {
    const range = spanShortLabel({ date: day, slot }, { date: endDate, slot: card.seance?.endSlot });
    return range.charAt(0).toLocaleUpperCase('fr-FR') + range.slice(1);
  }
  return slot ? `${date} · ${SLOT_LABELS[slot].toLocaleLowerCase('fr-FR')}` : date;
}

/** Story 40.2 : la personne est l'hôte de la conjonction. */
export function isHostOf(card: EventCardDto, userId: string | null | undefined): boolean {
  return !!userId && card.hostId === userId;
}

/** Story 40.2 : la personne participe — l'hôte, ou un inscrit de la liste des participants. Story
 *  40.4 : une place seulement réservée (statut `RESERVED`, que l'hôte est seul à voir dans la liste)
 *  n'est pas une participation. */
export function isParticipantOf(card: EventCardDto, userId: string | null | undefined): boolean {
  return (
    !!userId &&
    (isHostOf(card, userId) ||
      card.participants.some((p) => p.userId === userId && p.status === 'CONFIRMED'))
  );
}

/** Story 40.4 : la personne tient une place réservée, pas encore acceptée. */
export function hasReservedPlace(card: EventCardDto): boolean {
  return card.myInscription === 'RESERVED';
}

/** Story 40.4 : la personne peut accepter ou décliner sa place réservée — tant que la conjonction
 *  n'est pas passée (le serveur refuse après). */
export function canRespondToReservation(card: EventCardDto, todayKey: string): boolean {
  return (
    card.seance !== null &&
    !isCancelled(card) &&
    hasReservedPlace(card) &&
    !isPastEvent(card, todayKey)
  );
}

/** Story 40.4 : l'hôte gère les réservations de sa conjonction à places limitées tant qu'elle n'est
 *  pas passée. */
export function canManageReservations(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
): boolean {
  return (
    card.seance !== null &&
    card.seance.capacity !== null &&
    !isCancelled(card) &&
    isHostOf(card, currentUserId) &&
    !isPastEvent(card, todayKey)
  );
}

/** Story 42.1 : la personne peut annuler la conjonction — son hôte, ou un administrateur du groupe —
 *  tant qu'elle n'est ni passée ni déjà annulée. Le serveur reste juge (droit, verrou, jour UTC). */
export function canCancelEvent(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  viewerIsAdmin: boolean,
  todayKey: string,
): boolean {
  return (
    !isCancelled(card) &&
    !isPastEvent(card, todayKey) &&
    (viewerIsAdmin || isHostOf(card, currentUserId))
  );
}

/** Story 40.4 : une place réservée, en attente de réponse, parmi les participants (vue de l'hôte). */
export function isPendingParticipant(participant: EventParticipantDto): boolean {
  return participant.status === 'RESERVED';
}

/** Ligne « Ma situation » : l'hôte et les inscrits participent (« J'y étais » une fois passée) ; tout
 *  autre membre n'est pas inscrit (chip pointillée). */
export interface EventSituation {
  labelKey:
    | 'partie.ralliement_event_chip_participating'
    | 'partie.ralliement_event_chip_vote_todo'
    | 'partie.ralliement_event_chip_reserved'
    | 'partie.ralliement_event_chip_was_there'
    | 'partie.ralliement_event_chip_not_registered';
  dotted: boolean;
}

export function eventSituation(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
  membersParticipate = false,
): EventSituation {
  // Story 40.5 : « Vote à faire » l'emporte sur toute autre ligne tant que le vote attend la personne.
  if (needsVote(card, currentUserId, todayKey)) {
    return { labelKey: 'partie.ralliement_event_chip_vote_todo', dotted: false };
  }
  // Story 40.4 : « Place réservée » tant que la conjonction est à venir ; une fois passée, une place
  // jamais acceptée n'a pas été une participation.
  if (hasReservedPlace(card) && !isPastEvent(card, todayKey)) {
    return { labelKey: 'partie.ralliement_event_chip_reserved', dotted: false };
  }
  // Story 41.4 : dans une soirée isolée, tout membre participe (« J'y étais » une fois passée).
  if (!membersParticipate && !isParticipantOf(card, currentUserId)) {
    return { labelKey: 'partie.ralliement_event_chip_not_registered', dotted: true };
  }
  return isPastEvent(card, todayKey)
    ? { labelKey: 'partie.ralliement_event_chip_was_there', dotted: false }
    : { labelKey: 'partie.ralliement_event_chip_participating', dotted: false };
}

/** Texte du panneau de situation de la fenêtre de détail (Story 40.2) : la situation de la personne,
 *  au présent ou à l'imparfait selon que la conjonction est passée. Le bouton « S'inscrire » (Story
 *  40.3) vit dans le panneau, pas dans ce texte. Pas de vote à ce palier. */
export function eventSituationTextKey(
  card: EventCardDto,
  currentUserId: string | null | undefined,
  todayKey: string,
  membersParticipate = false,
): string {
  const past = isPastEvent(card, todayKey);
  // Story 41.1 : dans une soirée isolée, tout membre (hôte, puis invités acceptés) participe — la carte
  // ne porte que des inscriptions, que la soirée n'a pas (« sur invitation »).
  const who = isHostOf(card, currentUserId)
    ? 'host'
    : membersParticipate || isParticipantOf(card, currentUserId)
      ? 'registered'
      : hasReservedPlace(card)
        ? 'reserved'
        : 'none';
  return `partie.ralliement_event_situation_${who}${past ? '_past' : ''}`;
}

/** Accord français d'une unité portée par le registre (`'place|places'`) : 0 et 1 au singulier. */
export function frUnit(spec: string, n: number): string {
  const [one, many] = spec.split('|');
  return `${n} ${n <= 1 ? one : (many ?? one)}`;
}

/** Participation de la fiche : « 8 places · 5 inscrits · 3 libres » ou « Tous les membres » quand la
 *  conjonction n'a pas de limite. Story 40.4 : « inscrits » = l'hôte + les inscriptions CONFIRMÉES (une
 *  place réservée n'est pas une inscription), « libres » = capacité − places prises (réservées
 *  comprises : une place tenue n'est pas libre). */
export function participationLine(card: EventCardDto, tone: EventTone): string {
  const capacity = card.seance?.capacity ?? null;
  if (capacity === null) return tone['partie.ralliement_event_participation_all'];
  const registered = card.participants.filter((p) => !isPendingParticipant(p)).length;
  const taken = card.seance?.placesTaken ?? registered;
  return [
    frUnit(tone['partie.ralliement_event_unit_place'], capacity),
    frUnit(tone['partie.ralliement_event_unit_registered'], registered),
    frUnit(tone['partie.ralliement_event_unit_free'], Math.max(0, capacity - taken)),
  ].join(' · ');
}

/** Initiales d'un nom affiché (une ou deux lettres) pour le disque d'avatar. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '?';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('fr-FR');
}

/** Ordre des créneaux d'une même journée. */
const SLOT_ORDER: Record<DaySlot, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2, FULL_DAY: 3 };

/** Sections de l'onglet : « À venir » par jour puis créneau croissants (sans date en dernier),
 *  « Passées » dans l'ordre inverse de cette même clé (la plus récente d'abord). */
export function splitEvents(
  cards: readonly EventCardDto[],
  todayKey: string,
): { upcoming: EventCardDto[]; past: EventCardDto[] } {
  const byDay = (a: EventCardDto, b: EventCardDto) => {
    const da = eventDayKey(a);
    const db = eventDayKey(b);
    if (da === null || db === null) return da === db ? 0 : da === null ? 1 : -1;
    if (da !== db) return da < db ? -1 : 1;
    const sa = a.seance?.slot ? SLOT_ORDER[a.seance.slot] : -1;
    const sb = b.seance?.slot ? SLOT_ORDER[b.seance.slot] : -1;
    return sa - sb;
  };
  const upcoming = cards.filter((c) => !isPastEvent(c, todayKey)).sort(byDay);
  const past = cards
    .filter((c) => isPastEvent(c, todayKey))
    .sort(byDay)
    .reverse();
  return { upcoming, past };
}

// ─── Sondage de dates d'une conjonction (Story 40.5) ───────────────────────────────────────────────
// Tout se calcule ici, depuis la carte vivante : le serveur sert la liste des votants éligibles et les
// réponses ; le résumé du vote (réponses, meilleur créneau, « n'ont pas encore répondu ») n'est PAS
// servi, il est recalculé à l'écran et suit donc les réponses qui arrivent en direct.

/** Libellé court d'un jour en minuscules : « sam. 25 oct. » (clé `YYYY-MM-DD`, jour UTC). */
export function shortDayLabel(key: string, withMonth = true): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    ...(withMonth ? { month: 'short' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Plage des jours d'un sondage : « ven. 17 → sam. 25 oct. » (le mois n'est écrit qu'une fois quand les
 *  deux bouts le partagent). Un seul jour : « ven. 17 oct. ». */
export function pollRangeLabel(keys: readonly string[]): string {
  if (keys.length === 0) return '';
  const sorted = [...keys].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return shortDayLabel(first);
  const sameMonth = first.substring(0, 7) === last.substring(0, 7);
  return `${shortDayLabel(first, !sameMonth)} → ${shortDayLabel(last)}`;
}

/** Créneau candidat écrit : « sam. 25 oct. · soir ». Story 47.5 : un candidat de plusieurs créneaux s'écrit de son
 *  début à sa fin (« ven. 6 nov. soir → dim. 8 nov. après-midi ») ; un créneau seul est inchangé. */
export function pollSlotLabel(option: { date: string; slot: DaySlot }, durationSlots = 1): string {
  const span = candidateSpanShort(option, durationSlots);
  if (span) return span;
  return `${shortDayLabel(option.date)} · ${SLOT_LABELS[option.slot].toLocaleLowerCase('fr-FR')}`;
}

/** Jour d'échéance du vote (clé `YYYY-MM-DD`, dernier jour où l'on vote), ou `null`. */
export function pollDeadlineKey(card: EventCardDto): string | null {
  return card.poll?.expiresAt?.substring(0, 10) ?? null;
}

/** La conjonction a un sondage de dates qui décide encore de sa date (pas de date posée). */
export function hasPendingPoll(card: EventCardDto): boolean {
  return card.poll !== null && !card.seance?.date;
}

/** Le vote est ouvert : sondage ouvert, pas de date posée, échéance non dépassée (le jour d'échéance
 *  reste un jour de vote). */
export function isPollOpen(card: EventCardDto, todayKey: string): boolean {
  if (!card.poll || card.poll.status !== 'OPEN' || card.seance?.date) return false;
  const deadline = pollDeadlineKey(card);
  return deadline === null || deadline >= todayKey;
}

/** Le vote est terminé sans qu'une date soit posée (échéance dépassée). */
export function isPollEnded(card: EventCardDto, todayKey: string): boolean {
  return hasPendingPoll(card) && !isPollOpen(card, todayKey);
}

/** La personne est un votant éligible de cette conjonction. */
export function canVoteOn(card: EventCardDto, userId: string | null | undefined): boolean {
  return !!userId && !!card.poll && card.poll.eligibleVoterIds.includes(userId);
}

/** Réponses d'un votant éligible (celles d'une personne qui ne l'est plus ne comptent pas). */
function answersOf(card: EventCardDto, userId: string): { optionId: string; answer: string }[] {
  const poll = card.poll;
  if (!poll || !poll.eligibleVoterIds.includes(userId)) return [];
  return poll.votes.filter((v) => v.userId === userId);
}

/** Nombre de créneaux auxquels la personne a répondu. */
export function answeredSlotCount(card: EventCardDto, userId: string | null | undefined): number {
  if (!userId) return 0;
  return new Set(answersOf(card, userId).map((v) => v.optionId)).size;
}

/** Votants éligibles qui ont répondu au moins à un créneau. */
export function respondentIds(card: EventCardDto): string[] {
  const poll = card.poll;
  if (!poll) return [];
  // Story 44.2 : la règle d'un groupe est la règle partagée `hasAnswered` (une réponse à AU MOINS UN créneau).
  const optionIds = poll.options.map((o) => o.id);
  return poll.eligibleVoterIds.filter((id) =>
    hasAnswered(
      'ralliement',
      optionIds,
      poll.votes.filter((v) => v.userId === id).map((v) => v.optionId),
    ),
  );
}

/** Vote à faire : le vote est ouvert, la personne peut voter et n'a répondu à aucun créneau. */
export function needsVote(
  card: EventCardDto,
  userId: string | null | undefined,
  todayKey: string,
): boolean {
  return (
    isPollOpen(card, todayKey) && canVoteOn(card, userId) && answeredSlotCount(card, userId) === 0
  );
}

/** Meilleur créneau pour l'instant : celui qui réunit le plus de « oui » parmi les votants éligibles
 *  (à égalité, le plus de « peut-être », puis le plus proche). `null` tant que personne n'a dit oui. */
export function pollBestSlot(
  card: EventCardDto,
): { option: { id: string; date: string; slot: DaySlot }; yes: number } | null {
  const poll = card.poll;
  if (!poll) return null;
  const eligible = new Set(poll.eligibleVoterIds);
  let best: { option: (typeof poll.options)[number]; yes: number; maybe: number } | null = null;
  for (const option of poll.options) {
    const votes = poll.votes.filter((v) => v.optionId === option.id && eligible.has(v.userId));
    const yes = votes.filter((v) => v.answer === 'YES').length;
    const maybe = votes.filter((v) => v.answer === 'MAYBE').length;
    if (!best || yes > best.yes || (yes === best.yes && maybe > best.maybe)) {
      best = { option, yes, maybe };
    }
  }
  return best && best.yes > 0 ? { option: best.option, yes: best.yes } : null;
}

/** « dans 3 jours » / « demain » / « aujourd'hui » : le temps qu'il reste pour voter. */
function pollWhen(card: EventCardDto, todayKey: string, tone: EventTone): string {
  const deadline = pollDeadlineKey(card);
  const days = deadline === null ? 0 : daysBetweenKeys(todayKey, deadline);
  if (days <= 0) return tone['partie.ralliement_event_poll_ends_today'];
  if (days === 1) return tone['partie.ralliement_event_poll_ends_tomorrow'];
  return fillTone(tone['partie.ralliement_event_poll_ends_in_days'], { n: days });
}

/** Panneau du sondage dans la fenêtre de détail : membre (cadre « à faire » tant qu'il n'a pas voté),
 *  hôte (cadre accent), ou simple lecteur non éligible. `nameOf` nomme un votant (membres du groupe
 *  puis participants) ; les noms ne sont écrits que pour l'hôte. */
export interface PollPanel {
  kind: 'member-todo' | 'member-done' | 'host' | 'not-eligible';
  /** Vote terminé sans date posée : la phrase dit qu'il est terminé. */
  ended: boolean;
  text: string;
  /** « Vos réponses : 2 créneaux sur 5 » (membre) ou « Réponses : 3 sur 4 » (hôte). */
  answersLine: string | null;
  /** « Meilleur créneau pour l'instant : sam. 25 oct. — 3 oui ». */
  bestLine: string | null;
  /** Hôte seulement : « N'ont pas encore répondu : Léa, Max ». */
  waitingLine: string | null;
}

export function pollPanel(
  card: EventCardDto,
  userId: string | null | undefined,
  todayKey: string,
  tone: EventTone,
  nameOf: (id: string) => string,
): PollPanel | null {
  const poll = card.poll;
  if (!poll || card.seance?.date) return null;
  const ended = isPollEnded(card, todayKey);
  const deadline = pollDeadlineKey(card);
  // Le point de l'abréviation (« oct. ») ne doit pas doubler celui qui ferme la phrase.
  const dateText = deadline ? shortDayLabel(deadline).replace(/\.$/, '') : '';
  const best = pollBestSlot(card);
  const bestLine = best
    ? fillTone(tone['partie.ralliement_event_poll_best'], {
        date: pollSlotLabel(best.option, poll.durationSlots),
        n: best.yes,
      })
    : null;
  const total = poll.options.length;

  if (isHostOf(card, userId)) {
    const responded = new Set(respondentIds(card));
    const missing = poll.eligibleVoterIds.filter((id) => !responded.has(id));
    return {
      kind: 'host',
      ended,
      text: ended
        ? tone['partie.ralliement_event_poll_ended']
        : fillTone(tone['partie.ralliement_event_poll_host_summary'], {
            when: pollWhen(card, todayKey, tone),
            n: total,
          }),
      answersLine: fillTone(tone['partie.ralliement_event_poll_host_answers'], {
        x: responded.size,
        n: poll.eligibleVoterIds.length,
      }),
      bestLine,
      waitingLine:
        missing.length > 0
          ? fillTone(tone['partie.ralliement_event_poll_host_waiting'], {
              names: missing.map(nameOf).join(', '),
            })
          : null,
    };
  }

  if (!canVoteOn(card, userId)) {
    return {
      kind: 'not-eligible',
      ended,
      text: ended
        ? tone['partie.ralliement_event_poll_ended']
        : tone['partie.ralliement_event_poll_not_eligible'],
      answersLine: null,
      bestLine,
      waitingLine: null,
    };
  }

  const answered = answeredSlotCount(card, userId);
  const todo = !ended && answered === 0;
  return {
    kind: todo ? 'member-todo' : 'member-done',
    ended,
    text: ended
      ? tone['partie.ralliement_event_poll_ended']
      : todo
        ? fillTone(tone['partie.ralliement_event_poll_member_todo'], { date: dateText })
        : fillTone(tone['partie.ralliement_event_poll_member_voted'], { date: dateText }),
    answersLine: fillTone(tone['partie.ralliement_event_poll_my_answers'], {
      x: frUnit(tone['partie.ralliement_event_unit_slot'], answered),
      n: total,
    }),
    bestLine,
    waitingLine: null,
  };
}

/** Ligne d'un créneau candidat de la fiche : « sam. 25 oct. · soir » et le nombre d'inscrits libres. */
export function pollSlotRows(
  card: EventCardDto,
  tone: EventTone,
): { id: string; label: string; available: string }[] {
  return (card.poll?.options ?? []).map((o) => ({
    id: o.id,
    label: pollSlotLabel(o, card.poll?.durationSlots),
    available: frUnit(tone['partie.ralliement_event_unit_available'], o.availableCount),
  }));
}

/** Résumé du formulaire : « 3 créneaux · ven. 17 → sam. 25 oct. ». */
export function pollSummaryLabel(options: readonly { date: string }[], tone: EventTone): string {
  return fillTone(tone['partie.ralliement_event_poll_summary'], {
    count: frUnit(tone['partie.ralliement_event_unit_slot'], options.length),
    range: pollRangeLabel(options.map((o) => o.date)),
  });
}

// ─── Fixer la date (Story 40.6) ───────────────────────────────────────────────────────────────────

/** Un créneau candidat avec le décompte de ses réponses, tel que la confirmation « Fixer la date » le liste. */
export interface RankedPollSlot {
  id: string;
  /** Jour et moment du créneau : `bestOption` (@master-jdr/shared) en a besoin pour le classer. */
  date: string;
  slot: DaySlot;
  /** « sam. 25 oct. · soir ». */
  label: string;
  yes: number;
  maybe: number;
  no: number;
  /** Le jour du créneau est avant aujourd'hui : il ne peut plus être retenu (le serveur le refuse). */
  past: boolean;
}

/**
 * Les créneaux du sondage, du plus au moins plébiscité (UX-DR12) : plus de « oui », puis plus de
 * « peut-être », puis moins de « non », puis le plus proche (jour, puis créneau). Les réponses comptées
 * sont celles des votants éligibles, comme le « meilleur créneau » du panneau. Le premier est le meilleur
 * (il est présélectionné) ; sans réponse, c'est le plus proche.
 */
export function rankedPollSlots(card: EventCardDto, todayKey: string): RankedPollSlot[] {
  const poll = card.poll;
  if (!poll) return [];
  const eligible = new Set(poll.eligibleVoterIds);
  return poll.options
    .map((option) => {
      const votes = poll.votes.filter((v) => v.optionId === option.id && eligible.has(v.userId));
      return {
        option,
        slot: {
          id: option.id,
          date: option.date,
          slot: option.slot,
          label: pollSlotLabel(option, poll.durationSlots),
          yes: votes.filter((v) => v.answer === 'YES').length,
          maybe: votes.filter((v) => v.answer === 'MAYBE').length,
          no: votes.filter((v) => v.answer === 'NO').length,
          past: option.date < todayKey,
        },
      };
    })
    .sort(
      (a, b) =>
        b.slot.yes - a.slot.yes ||
        b.slot.maybe - a.slot.maybe ||
        a.slot.no - b.slot.no ||
        a.option.date.localeCompare(b.option.date) ||
        SLOT_ORDER[a.option.slot] - SLOT_ORDER[b.option.slot],
    )
    .map((entry) => entry.slot);
}

/**
 * Story 44.6 — les créneaux d'un vote ouvert tel que `GET /me/open-polls` le sert, dans le même ordre que
 * `rankedPollSlots` (le plus plébiscité d'abord) : la confirmation « Fixer la date » de la Destinée liste les
 * mêmes lignes, que le vote vienne d'une conjonction ou d'un scénario. Les comptes sont ceux de l'entrée.
 */
export function rankedEntrySlots(
  options: readonly OpenPollOption[],
  todayKey: string,
  durationSlots = 1,
): RankedPollSlot[] {
  return options
    .map((o) => ({
      id: o.optionId,
      date: o.date,
      slot: o.slot,
      label: pollSlotLabel(o, durationSlots),
      yes: o.yes,
      maybe: o.maybe,
      no: o.no,
      past: o.date < todayKey,
    }))
    .sort(
      (a, b) =>
        b.yes - a.yes ||
        b.maybe - a.maybe ||
        a.no - b.no ||
        a.date.localeCompare(b.date) ||
        SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot],
    );
}

/** « 4 oui · 0 peut-être · 1 non » : le décompte d'un créneau dans la confirmation. */
export function pollCountsLabel(slot: RankedPollSlot, tone: EventTone): string {
  return fillTone(tone['partie.ralliement_event_fix_counts'], {
    yes: slot.yes,
    maybe: slot.maybe,
    no: slot.no,
  });
}

/** La personne peut fixer la date : le serveur lui en donne le droit (`can.choose`, Story 44.1 — jamais déduit
 *  de `hostId`), le sondage est OUVERT (l'échéance dépassée ne le bloque pas) et propose au moins un créneau.
 *  Le serveur reste juge. */
export function canFixDate(card: EventCardDto): boolean {
  return (
    card.can.choose &&
    card.poll !== null &&
    card.poll.status === 'OPEN' &&
    !card.seance?.date &&
    card.poll.options.length > 0
  );
}

// ─── Prolonger le vote (Story 40.7) ───────────────────────────────────────────────────────────────

/** Le jour qui suit la clé `YYYY-MM-DD` (jour UTC). */
export function nextDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().substring(0, 10);
}

/** La personne peut prolonger le vote : le serveur lui en donne le droit (`can.extend`, Story 44.1), le sondage
 *  est OUVERT et sans date posée. L'échéance déjà dépassée ne le bloque pas (prolonger rouvre le vote). Le
 *  serveur reste juge. */
export function canExtendVote(card: EventCardDto): boolean {
  return card.can.extend && card.poll !== null && card.poll.status === 'OPEN' && !card.seance?.date;
}

/** Plus petite « Nouvelle échéance » proposable : le lendemain de l'échéance actuelle — jamais avant
 *  aujourd'hui (le serveur refuse un jour passé, une échéance déjà dépassée comprise). */
export function extendMinKey(card: EventCardDto, todayKey: string): string {
  return extendMinKeyFrom(pollDeadlineKey(card), todayKey);
}

/** La même règle à partir du jour d'échéance seul (`null` : aucune échéance) — la Destinée (Story 44.6) ne
 *  porte pas la carte, seulement l'entrée de `GET /me/open-polls`. */
export function extendMinKeyFrom(deadline: string | null, todayKey: string): string {
  const afterDeadline = deadline === null ? todayKey : nextDayKey(deadline);
  return afterDeadline > todayKey ? afterDeadline : todayKey;
}
