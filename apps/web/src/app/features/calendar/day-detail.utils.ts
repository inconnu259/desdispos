import { spanSlots } from '@master-jdr/shared';
import type {
  AvailabilityDeclarationDto,
  CalendarLayerKey,
  DaySlot,
  SlotStatus,
} from '@master-jdr/shared';
import { computeDisplayStatus } from '../../core/availability/compute-display-status';
import type { AgendaEntry } from './calendar-agenda-view/calendar-agenda-view';
import type { VoteParticipation } from './poll-track.utils';
import type { GroupAvailability } from './group-availability.utils';
import { isSpan, spanCompactLabel, spanSentence, spanShortLabel } from './span-label';

/**
 * Story 36.1 — modèle du rail de détail.
 *
 * Fonctions pures, testées sans TestBed (patron `selection.utils.ts`). Elles ne connaissent ni
 * Angular, ni HTTP, ni routes : elles projettent des données DÉJÀ CHARGÉES par `CalendarView`
 * vers la forme qu'affiche le rail. Aucun appel réseau n'existe ni ne doit exister ici (AC5).
 */

/** Les trois créneaux nommés du jour. `FULL_DAY` n'en est pas un : c'est un joker qui les couvre
 *  tous les trois en lecture. Dérivé de `DaySlot` (`@master-jdr/shared`) plutôt que dupliqué à la
 *  main, pour ne pas driver silencieusement si `DaySlot` évolue. */
export type RailSlot = Exclude<DaySlot, 'FULL_DAY'>;

/** Ordre d'affichage du rail, verrouillé : matin → après-midi → soir (contrat d'UI). */
export const RAIL_SLOTS: readonly { slot: RailSlot; label: string; shortLabel: string }[] = [
  { slot: 'MORNING', label: 'Matin', shortLabel: 'Matin' },
  { slot: 'AFTERNOON', label: 'Après-midi', shortLabel: 'Après-m.' },
  { slot: 'EVENING', label: 'Soir', shortLabel: 'Soir' },
] as const;

/** Cible de navigation d'une ligne activable. Story 36.1, AC11 : on ouvre le SCÉNARIO qui porte
 *  la séance — aucun écran de séance n'existe dans l'application. */
export interface RailTarget {
  partieId: string;
  scenarioId: string;
}

/**
 * Story 36.2 — la préséance dans un créneau (FR-49).
 *
 * Le rang qui occupe la bande. QUATRE rangs concourent ; `'none'` n'en est pas un — c'est ce
 * qui reste quand rien ne gagne (« non déclaré »).
 *
 * La **disponibilité du groupe n'y figure pas** : elle est sortie de la préséance le 2026-08-17
 * (FR-53) et passe sur un canal séparé, livré par la story 36.8. Ne pas l'y réintroduire.
 */
export type SlotWinner = 'seance' | 'vote' | 'unavailable' | 'available' | 'none';

/** L'ordre, écrit une fois. Séance confirmée > vote en cours > mes indisponibilités > mes
 *  disponibilités. Patron repris de `core/parties/party-signal-priority.ts` : un ordre exporté,
 *  une résolution pure, une spec dédiée. */
export const SLOT_PRECEDENCE: readonly Exclude<SlotWinner, 'none'>[] = [
  'seance',
  'vote',
  'unavailable',
  'available',
] as const;

/** Les rangs qui portent un ÉVÉNEMENT — par opposition à un simple état de disponibilité.
 *  Un jour n'est « uniforme » (bandes fusionnables) que si aucun de ceux-là n'est posé. */
const EVENT_WINNERS: ReadonlySet<SlotWinner> = new Set<SlotWinner>(['seance', 'vote']);

export interface DaySlotDetail {
  slot: RailSlot;
  label: string;
  shortLabel: string;
  /** Story 36.2 — le rang qui occupe le créneau. Le fond, la forme et le texte de la bande en
   *  dépendent. Une séance dont la couche `mes-seances` est éteinte reste `'seance'`, seul son
   *  libellé disparaît (FR-50, AC6). Le vote, en revanche, N'EST PAS indépendant de sa couche :
   *  `votes-en-cours` éteinte fait retomber le rang sur le statut déclaré (décision utilisateur,
   *  revue de code du 2026-08-18) — un vote n'engage rien tant qu'il n'a pas produit de séance. */
  winner: SlotWinner;
  /** État de disponibilité du créneau. Une séance confirmée le force à `UNAVAILABLE`, quel que
   *  soit l'état de la couche « mes séances » (AC6 / FR-50). */
  status: SlotStatus;
  /** Titre de la séance, ou `null` si aucune séance — ou si la couche est éteinte (AC6). */
  seanceLabel: string | null;
  /** Renseignée uniquement quand la séance est nommée ET navigable (AC11). */
  seanceTarget: RailTarget | null;
  /** Story 36.5 — informations pratiques. Elles suivent le TITRE, jamais l'indisponibilité :
   *  couche `mes-seances` éteinte ⇒ les trois passent à `null` en même temps que `seanceLabel`,
   *  et le créneau reste `UNAVAILABLE` (FR-50). Séparées jusqu'au rendu pour que l'ordre de
   *  repli reste applicable (AC3). */
  seanceHeure: string | null;
  seanceLieu: string | null;
  seanceNote: string | null;
  /** Libellé du vote en cours sur ce créneau, ou `null`. */
  pollLabel: string | null;
  /** Story 36.6 — la participation à l'option de vote qui couvre ce créneau, ou `null`.
   *
   *  **Gouvernée exactement comme `pollLabel`** : la couche `votes-en-cours` éteinte la fait
   *  disparaître, sans quoi la piste survivrait à son propre libellé. Les surfaces la rendent
   *  seulement quand le rang gagnant est `'vote'` — le texte suit le rang, la piste aussi
   *  (une séance confirmée qui l'emporte n'affiche pas la piste d'un vote concurrent). */
  pollVote: VoteParticipation | null;
  /** Story 47.5 — TOUTES les options du vote qui couvrent ce créneau (une par option, dans l'ordre de leur
   *  début), chacune avec sa plage écrite. `pollVote` en est la première et garde son sens : pour un créneau
   *  couvert une seule fois (ou un créneau seul), la liste n'a qu'une entrée. Même gouvernance que `pollVote`
   *  (couche `votes-en-cours`) ; c'est LA source du sélecteur de réponse (une ligne par plage) — aucune vue ne
   *  refiltre. Vide si aucune option ne porte de participation. */
  pollVotes: SlotPollVote[];
  /** Story 47.5 — combien de plages de ce vote couvrent le créneau (« ×n » quand n ≥ 2). Même gouvernance que
   *  `pollVote` ; 0 sans vote affiché. */
  pollCount: number;
  /** Story 36.8 — la disponibilité du groupe sur ce créneau (FR-53), ou `null`.
   *
   *  🚨 **CE CHAMP NE SUIT PAS LE RANG GAGNANT**, contrairement à `seanceLabel`, `pollLabel` et
   *  `pollVote` juste au-dessus. C'est délibéré et c'est toute la story : le groupe vit sur un
   *  **canal séparé**, il ne concourt pas dans `SLOT_PRECEDENCE` et il reste visible **sous** une
   *  séance comme sous un vote. Le copier sur le modèle de ses voisins — le geste le plus naturel
   *  en lisant ce fichier — le rendrait invisible exactement dans les cas qui justifient la
   *  couche, et reproduirait le défaut du 2026-08-17 (`EXPERIENCE.md:253`).
   *
   *  Il **est** gouverné par sa couche, comme `pollVote` : `disponibilite-groupe` éteinte ⇒
   *  `null`, et la case retrouve alors ses bandes fusionnées (AC10/AC11). */
  group: GroupAvailability | null;
  /** Story 47.3 — la plage de plusieurs créneaux que ce créneau fait partie, ou `null` (un créneau seul, ou
   *  l'objet nommé n'est pas une plage). Suit le rang GAGNANT et la gouvernance des couches comme le texte : une
   *  couche éteinte n'a ni nom ni connecteur, jamais moins d'indisponibilité. */
  span: SlotSpan | null;
}

/** Story 47.5 — une option de vote qui couvre un créneau : sa participation et sa plage écrite. */
export interface SlotPollVote {
  vote: VoteParticipation;
  /** « ven. 6 soir → dim. 8 après-midi » — la ligne du sélecteur ; vide pour un créneau seul. */
  range: string;
  /** « du vendredi 6 soir au dimanche 8 après-midi » — pour les noms accessibles ; vide pour un créneau seul. */
  rangeSentence: string;
  /** « ven. 6 nov. soir → dim. 8 nov. après-midi » — la forme courte des cartes ; vide pour un créneau seul. */
  rangeShort: string;
  /** Rang linéaire du premier créneau de l'option : ordre chronologique des lignes. */
  startIndex: number;
}

/** Story 47.3 (UX-DR9) — ce qu'une bande ou une ligne du rail sait de la plage qui la couvre. */
export interface SlotSpan {
  /** Clé de l'entrée : deux bandes de la même plage la partagent (le nom n'est écrit qu'une fois par ligne). */
  key: string;
  /** Nom du rendez-vous. */
  label: string;
  /** « du vendredi 6 soir au dimanche 8 après-midi » — nom accessible. */
  range: string;
  /** « ven. 6 nov. soir → dim. 8 nov. après-midi » — forme courte. */
  shortRange: string;
  /** Ce créneau est le tout premier de la plage. */
  isStart: boolean;
  /** Ce jour est le premier jour de la plage (le rail écrit « (suite) » sur les suivants). */
  isFirstDay: boolean;
  /** Le matin d'un jour, quand la plage couvre aussi le soir de la veille : connecteur « venant de ». */
  continuesBefore: boolean;
  /** Le soir d'un jour, quand la plage couvre aussi le matin du lendemain : connecteur « allant vers ». */
  continuesAfter: boolean;
  /** Rang linéaire du créneau (`jour * 3 + créneau`) : permet de dire, sans autre calcul, qu'une bande n'est pas
   *  le début de sa plage (préfixe « ← » de la ligne de semaine). */
  index: number;
  /** Rang linéaire du premier créneau de la plage. */
  startIndex: number;
}

export interface DayDetail {
  /** `YYYY-MM-DD`. */
  date: string;
  /** TOUJOURS trois entrées, dans l'ordre de `RAIL_SLOTS` — y compris les créneaux vides, qui
   *  disent alors leur état. Invariant de la story : aucune largeur, aucun état, aucune couche
   *  éteinte ne peut en retirer une. */
  slots: DaySlotDetail[];
  /** Vrai quand aucun créneau ne porte d'objet ET qu'aucun n'a d'état déclaré (AC4). */
  isEmpty: boolean;
}

/** Types d'entrées qui font d'un jour un jour « porteur » au sens de l'AC3. Une déclaration de
 *  disponibilité est un ÉTAT, pas un événement : elle ne suffit pas. La tendance du groupe non
 *  plus — elle décrit un créneau, elle n'y ajoute rien à faire. */
const MEANINGFUL_TYPES = new Set(['mes-seances', 'votes-en-cours', 'inscriptions-ouvertes']);

/** `FULL_DAY` (ou un créneau absent), côté entrée COMME côté cible, couvre les trois créneaux —
 *  même convention de lecture que `compute-display-status.ts` et `calendar-week-view.ts`. Le
 *  second paramètre accepte `DaySlot` (pas seulement `RailSlot`) pour être réutilisable avec une
 *  cellule sélectionnée en Journée entière (Story 36.4, revue de code). */
export function entryCoversSlot(entrySlot: DaySlot | undefined, slot: DaySlot): boolean {
  if (entrySlot == null || entrySlot === 'FULL_DAY' || slot === 'FULL_DAY') return true;
  return entrySlot === slot;
}

const SLOT_ORDER: Record<RailSlot, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2 };

/** Numéro de jour (UTC) d'une clé `YYYY-MM-DD` : l'écart entre deux clés est un nombre de jours entiers. */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Story 47.3 — les rangs linéaires `[de, à]` (inclus) que couvre une entrée, avec `rang = jour * 3 + créneau`
 * (matin 0, après-midi 1, soir 2). Un créneau absent ou `FULL_DAY` couvre les trois créneaux de son jour ; une
 * fin sans créneau, tout son jour. `null` pour une entrée sans date. Une fin avant le début est ignorée (donnée
 * incohérente : l'entrée garde son seul début).
 */
export function entryIndexRange(e: AgendaEntry): [number, number] | null {
  if (!e.date) return null;
  const startDay = dayNumber(e.date) * 3;
  const startNamed = e.slot != null && e.slot !== 'FULL_DAY';
  const from = startDay + (startNamed ? SLOT_ORDER[e.slot as RailSlot] : 0);
  const single: [number, number] = [from, startNamed ? from : startDay + 2];
  if (!e.endDate) return single;
  const endDay = dayNumber(e.endDate) * 3;
  const endNamed = e.endSlot != null && e.endSlot !== 'FULL_DAY';
  // Une fin sans créneau : le même jour que le début, c'est le créneau de départ (comme `isSpan`) ; un autre
  // jour, c'est la fin de ce jour.
  const to =
    endDay +
    (endNamed ? SLOT_ORDER[e.endSlot as RailSlot] : e.endDate === e.date && startNamed ? SLOT_ORDER[e.slot as RailSlot] : 2);
  return to >= from ? [from, to] : single;
}

/**
 * Story 47.3 — l'entrée couvre-t-elle ce créneau de ce jour ? Un créneau seul garde EXACTEMENT la règle de
 * `entryCoversSlot()` (même jour, `FULL_DAY` joker) ; une plage couvre chaque créneau compris entre son début
 * et sa fin, du soir au lendemain matin compris. Une cellule `FULL_DAY` est couverte dès que l'un de ses trois
 * créneaux l'est.
 */
export function entryCoversCell(e: AgendaEntry, dateKey: string, slot: DaySlot): boolean {
  if (!e.endDate) return e.date === dateKey && entryCoversSlot(e.slot, slot);
  const range = entryIndexRange(e);
  if (!range) return false;
  const day = dayNumber(dateKey) * 3;
  const [cellFrom, cellTo] = slot === 'FULL_DAY' ? [day, day + 2] : [day + SLOT_ORDER[slot], day + SLOT_ORDER[slot]];
  return range[0] <= cellTo && cellFrom <= range[1];
}

/**
 * Story 47.5 — les jours (`YYYY-MM-DD`, dans l'ordre) que couvre une entrée : son jour, ou tous les jours d'une
 * plage. Dérivé de `spanSlots` (`@master-jdr/shared`, LA fonction des créneaux couverts) sur le nombre de créneaux
 * que `entryIndexRange` lit dans l'entrée — jamais un second parcours de calendrier. Une entrée sans date : aucun.
 */
export function entryCoveredDays(e: AgendaEntry): string[] {
  const range = entryIndexRange(e);
  if (!range || !e.date) return [];
  const count = range[1] - range[0] + 1;
  const startNamed = e.slot != null && e.slot !== 'FULL_DAY';
  if (count <= 1 || !startNamed) return [e.date];
  const days: string[] = [];
  for (const covered of spanSlots(e.date, e.slot as RailSlot, count)) {
    if (days[days.length - 1] !== covered.date) days.push(covered.date);
  }
  return days;
}

/** Une entrée touche-t-elle ce jour ? Son jour de début, ou l'un des jours d'une plage. */
function entryTouchesDay(e: AgendaEntry, dateKey: string): boolean {
  return e.date === dateKey || (!!e.endDate && e.date < dateKey && dateKey <= e.endDate);
}

/** Les informations de plage d'un créneau pour l'entrée qui le nomme, ou `null` pour un créneau seul. */
function spanOf(entry: AgendaEntry, dateKey: string, slot: RailSlot): SlotSpan | null {
  const range = entryIndexRange(entry);
  if (!range || !entry.endDate) return null;
  const start = { date: entry.date, slot: entry.slot };
  const end = { date: entry.endDate, slot: entry.endSlot };
  if (!isSpan(start, end)) return null;
  const index = dayNumber(dateKey) * 3 + SLOT_ORDER[slot];
  return {
    key: entry.key,
    label: entry.label,
    range: spanSentence(start, end),
    shortRange: spanShortLabel(start, end),
    isStart: index === range[0],
    isFirstDay: entry.date === dateKey,
    continuesBefore: slot === 'MORNING' && index - 1 >= range[0],
    continuesAfter: slot === 'EVENING' && index + 1 <= range[1],
    index,
    startIndex: range[0],
  };
}

/**
 * Story 47.5 — les options du MÊME vote qui couvrent le créneau, dans l'ordre de leur début. C'est la seule règle
 * de « qui couvre ce créneau » pour le sélecteur et le « ×n » : `entryCoversCell` (47.3) en décide, ce n'est
 * qu'un regroupement par vote. Un autre vote qui couvre aussi le créneau reste annoncé par « (+1 autre) ».
 */
function coveringVotes(first: AgendaEntry | undefined, matches: AgendaEntry[]): AgendaEntry[] {
  if (!first) return [];
  const pollId = first.vote?.pollId;
  const same = pollId ? matches.filter((e) => e.vote?.pollId === pollId) : [first];
  return same
    .map((entry, i) => ({ entry, i, start: entryIndexRange(entry)?.[0] ?? 0 }))
    .sort((a, b) => a.start - b.start || a.i - b.i)
    .map((x) => x.entry);
}

function slotPollVote(entry: AgendaEntry): SlotPollVote | null {
  if (!entry.vote) return null;
  const range = entryIndexRange(entry);
  const start = { date: entry.date, slot: entry.slot };
  const end = entry.endDate ? { date: entry.endDate, slot: entry.endSlot } : null;
  const long = end && isSpan(start, end) ? end : null;
  return {
    vote: entry.vote,
    range: long ? spanCompactLabel(start, long) : '',
    rangeSentence: long ? spanSentence(start, long) : '',
    rangeShort: long ? spanShortLabel(start, long) : '',
    startIndex: range?.[0] ?? 0,
  };
}

/** `YYYY-MM-DD` → Date minuit UTC, contrat d'entrée de `computeDisplayStatus`. */
export function dateKeyToUtcMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date locale → `YYYY-MM-DD`, même convention que `dateKey()` des vues Mois/Semaine. */
/**
 * Story 36.7 — `YYYY-MM-DD` vers minuit **LOCAL**.
 *
 * 🚨 Distinct de `dateKeyToUtcMidnight()`, et le choix n'est pas cosmétique. Les deux grilles
 * construisent leurs cases en heure LOCALE (`buildMonth`/`buildWeek`), et `toDateKey()` relit des
 * composantes locales : un événement d'activation portant une date à minuit UTC serait relu, dans
 * tout fuseau négatif, comme la veille. Toute surface qui émet une date vers `CalendarView` passe
 * donc par ici — le rail et l'Agenda, qui ne connaissent leur jour que sous forme de clé.
 */
export function dateKeyToLocalMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * La partie à laquelle appartient une entrée du calendrier personnel (Story 44.8) : `partieId` pour une séance ou
 * une inscription, `vote.partieId` pour un vote ; `null` pour ce qui n'appartient à aucune (déclarations).
 */
export function entryPartieId(entry: AgendaEntry): string | null {
  return entry.partieId ?? entry.vote?.partieId ?? null;
}

/**
 * Construit le détail d'UN jour pour le rail.
 *
 * @param dateKey      Jour à détailler, `YYYY-MM-DD`.
 * @param entries      Entrées du calendrier **non filtrées par couche** — le filtrage se fait ici,
 *                     et seulement sur le TEXTE (AC6). Les passer déjà filtrées ferait disparaître
 *                     l'indisponibilité d'une séance en même temps que son titre, ce que FR-50
 *                     interdit.
 * @param activeLayers Couches actives : gouvernent ce qui est NOMMÉ, jamais l'indisponibilité.
 * @param declarations Déclarations déjà filtrées par couche (mêmes données que la grille, pour que
 *                     rail et grille ne se contredisent jamais).
 * @param now          Injectable pour les tests (expiration des déclarations).
 */
export function buildDayDetail(
  dateKey: string,
  entries: AgendaEntry[],
  activeLayers: readonly CalendarLayerKey[],
  declarations: AvailabilityDeclarationDto[],
  now: Date = new Date(),
  hiddenPartieIds: ReadonlySet<string> | null = null,
): DayDetail {
  const active = new Set(activeLayers);
  const hiddenParty = (e: AgendaEntry): boolean => {
    const id = entryPartieId(e);
    return id !== null && !!hiddenPartieIds?.has(id);
  };
  const utcDate = dateKeyToUtcMidnight(dateKey);
  // Story 47.3 : les entrées qui TOUCHENT ce jour — son début, ou l'un des jours d'une plage.
  const sameDay = entries.filter((e) => entryTouchesDay(e, dateKey));

  const slots = RAIL_SLOTS.map(({ slot, label, shortLabel }): DaySlotDetail => {
    // Plusieurs entrées peuvent partager le même jour/créneau (ex. deux séances de deux parties
    // distinctes). On n'en agrège pas la liste complète (hors périmètre de la story) mais on ne
    // fait jamais disparaître silencieusement les suivantes : un indicateur minimal les signale.
    const allSeanceMatches = sameDay.filter(
      (e) => e.type === 'mes-seances' && entryCoversCell(e, dateKey, slot),
    );
    // Story 44.8 — le filtre par partie. Une séance d'une partie masquée garde le créneau INDISPONIBLE (FR-50,
    // comme une couche éteinte) mais n'est jamais nommée ; ses votes, eux, disparaissent comme s'ils n'existaient
    // pas. Les entrées visibles passent d'abord, pour qu'une séance nommée ne soit pas masquée par une autre.
    const seanceMatches = allSeanceMatches.filter((e) => !hiddenParty(e));
    const pollMatches = sameDay.filter(
      (e) => e.type === 'votes-en-cours' && entryCoversCell(e, dateKey, slot) && !hiddenParty(e),
    );
    const seance = seanceMatches[0];
    const blockingSeance = seance ?? allSeanceMatches[0];
    const poll = pollMatches[0];
    const covering = coveringVotes(poll, pollMatches)
      .map(slotPollVote)
      .filter((v): v is SlotPollVote => v !== null);
    // Story 36.8 — le CANAL SÉPARÉ. Résolu ici, avec les autres, pour que grille et rail ne se
    // contredisent jamais (AC16) — mais volontairement HORS de la chaîne `winner` ci-dessous.
    const groupEntry = sameDay.find(
      (e) => e.type === 'disponibilite-groupe' && entryCoversCell(e, dateKey, slot),
    );

    // AC6 / FR-50 : une séance confirmée rend le créneau indisponible INDÉPENDAMMENT de
    // l'affichage. La couche retire le texte, jamais le fait d'être pris.
    const status: SlotStatus = blockingSeance
      ? 'UNAVAILABLE'
      : computeDisplayStatus(utcDate, slot, declarations, now);

    // Story 36.2 — la préséance, résolue dans l'ordre de SLOT_PRECEDENCE. Le vote entre ici
    // comme un RANG, et non plus seulement comme un libellé annexe.
    // Revue de code (décision utilisateur, 2026-08-18) : contrairement à la séance (AC6, le rang
    // persiste couche éteinte), le rang « vote » est GOUVERNÉ par la couche `votes-en-cours` — la
    // retirer fait retomber le créneau sur le statut déclaré, comme si le vote n'existait pas.
    const voteActive = poll != null && active.has('votes-en-cours');
    const winner: SlotWinner = blockingSeance
      ? 'seance'
      : voteActive
        ? 'vote'
        : status === 'UNAVAILABLE'
          ? 'unavailable'
          : status === 'AVAILABLE'
            ? 'available'
            : 'none';

    const seanceNamed = seance != null && active.has('mes-seances');
    // AC11 : navigable seulement si la séance est nommée (pas d'affordance sur une ligne muette)
    // ET si l'entrée porte de quoi naviguer. AC7 : une indisponibilité dérivée d'une séance d'une
    // autre partie n'expose aucun identifiant — elle n'arrive donc jamais ici avec une cible.
    const target: RailTarget | null =
      seanceNamed && seance?.partieId && seance.scenarioId
        ? { partieId: seance.partieId, scenarioId: seance.scenarioId }
        : null;

    return {
      slot,
      label,
      shortLabel,
      winner,
      status,
      seanceLabel: seanceNamed
        ? seance!.label + (seanceMatches.length > 1 ? ' (+1 autre)' : '')
        : null,
      seanceTarget: target,
      // Même gouvernance que seanceLabel : `seanceNamed`, jamais un `??` opportuniste — la
      // story 36.2 a déjà corrigé une fuite de texte inter-rangs de cette forme.
      seanceHeure: seanceNamed ? (seance!.seanceHeure ?? null) : null,
      seanceLieu: seanceNamed ? (seance!.seanceLieu ?? null) : null,
      seanceNote: seanceNamed ? (seance!.seanceNote ?? null) : null,
      pollLabel:
        poll && active.has('votes-en-cours')
          ? poll.label + (pollMatches.length > 1 ? ' (+1 autre)' : '')
          : null,
      // Story 36.6 — même gouvernance que `pollLabel`, à la lettre : la couche éteinte retire la
      // piste en même temps que le texte. `?? null` et jamais `undefined` — une seule
      // représentation de « rien à afficher ».
      pollVote: poll && active.has('votes-en-cours') ? (poll.vote ?? null) : null,
      // Story 47.5 — même gouvernance que `pollVote` (la couche éteinte retire aussi la liste et le compte).
      pollVotes: poll && active.has('votes-en-cours') ? covering : [],
      // Le compte est celui des lignes réellement servies : « ×n » ne compte jamais une option sans participation.
      pollCount: poll && active.has('votes-en-cours') ? covering.length : 0,
      // Story 36.8 — gouverné par SA couche, et par rien d'autre : ni le rang gagnant, ni la
      // présence d'une séance ou d'un vote ne l'effacent (AC2). `?? null` et jamais `undefined`
      // — une seule représentation de « rien à afficher », comme partout dans ce fichier.
      group: groupEntry && active.has('disponibilite-groupe') ? (groupEntry.group ?? null) : null,
      // Story 47.3 — la plage suit le rang GAGNANT, comme le texte : une séance nommée l'emporte, sinon le vote
      // affiché ; couche éteinte ou rang d'un état déclaré ⇒ aucune plage à dessiner.
      span:
        winner === 'seance' && seanceNamed
          ? spanOf(seance!, dateKey, slot)
          : winner === 'vote' && poll && active.has('votes-en-cours')
            ? spanOf(poll, dateKey, slot)
            : null,
    };
  });

  const isEmpty = slots.every(
    (s) => s.seanceLabel === null && s.pollLabel === null && s.status === 'UNKNOWN',
  );

  return { date: dateKey, slots, isEmpty };
}

/**
 * Story 36.2, AC4 — un jour est « uniforme » quand ses trois créneaux portent le même rang **et**
 * qu'aucun événement n'y est posé. Ses trois bandes fusionnent alors en une seule : il n'y a rien
 * à distinguer, et c'est ce qui empêche la grille de devenir bariolée.
 *
 * Écrite volontairement comme un prédicat SUR LE DÉTAIL SEUL, sans autre dépendance : la story
 * 36.8 devra y ajouter sa propre condition (la couche « disponibilité du groupe » allumée impose
 * trois bandes, une jauge par créneau) — elle le fera au point d'appel, sans toucher à celle-ci.
 */
/** Niveau de densité offert à `composeSeanceInfo()`. Un niveau plutôt qu'un budget en
 *  caractères : c'est ce que les surfaces savent réellement dire d'elles-mêmes (une bande de
 *  20 px, un rail large, une ligne d'agenda), et ça se teste sans arithmétique. */
export type InfoDensity = 'full' | 'compact' | 'minimal';

/** Les trois informations pratiques d'une séance, telles que portées par `DaySlotDetail`. */
export interface SeanceInfoParts {
  seanceHeure: string | null;
  seanceLieu: string | null;
  seanceNote: string | null;
}

/**
 * Compose les informations pratiques d'une séance en UNE chaîne d'affichage (Story 36.5, AC3).
 *
 * C'est le point unique exigé par l'AC10 : le rail, la bande de la case et l'agenda passent tous
 * par ici. Personne ne recompose de son côté, sans quoi l'ordre de repli divergerait entre trois
 * surfaces — exactement le genre d'incohérence que la doctrine du projet combat.
 *
 * **Ordre de repli** — quand la place manque, la NOTE cède la première, puis le lieu ; l'heure
 * tient le plus longtemps. C'est ce qui justifie que les trois champs soient séparés en base.
 *
 * ⚠️ Aucune valeur n'est reformatée : `seanceHeure` est reprise telle quelle (AC2). Une valeur
 * vide ou blanche est traitée comme absente, pour ne jamais produire de séparateur orphelin (AC4).
 */
export function composeSeanceInfo(parts: SeanceInfoParts, density: InfoDensity = 'full'): string {
  const ordered = [parts.seanceHeure, parts.seanceLieu, parts.seanceNote];
  const present = ordered.map((v) => v?.trim() ?? '').filter((v) => v.length > 0);
  const budget = density === 'full' ? 3 : density === 'compact' ? 2 : 1;
  return present.slice(0, budget).join(' · ');
}

export function bandsAreUniform(detail: DayDetail): boolean {
  const [first, ...rest] = detail.slots;
  if (!first || EVENT_WINNERS.has(first.winner)) return false;
  return rest.every((s) => s.winner === first.winner);
}

/**
 * Story 36.2 — la projection d'un mois entier, construite AU-DESSUS de `buildDayDetail()`.
 *
 * Ne réimplémente rien : la préséance, la couverture `FULL_DAY` et la règle « la couche gouverne
 * le texte » vivent dans `buildDayDetail()` et nulle part ailleurs. Aucune donnée n'est chargée
 * ici — tout vient de signaux déjà en mémoire (AC13).
 */
export function buildMonthDetails(
  dateKeys: readonly string[],
  entries: AgendaEntry[],
  activeLayers: readonly CalendarLayerKey[],
  declarations: AvailabilityDeclarationDto[],
  now: Date = new Date(),
  hiddenPartieIds: ReadonlySet<string> | null = null,
): Map<string, DayDetail> {
  const out = new Map<string, DayDetail>();
  for (const key of dateKeys) {
    out.set(key, buildDayDetail(key, entries, activeLayers, declarations, now, hiddenPartieIds));
  }
  return out;
}

/**
 * AC3 — le prochain jour « portant quelque chose », à partir d'aujourd'hui inclus.
 *
 * « Quelque chose » = une séance, un vote en cours ou une inscription ouverte **datée**. Une
 * déclaration de disponibilité est un état, pas un événement. Les entrées sans date propre
 * (inscriptions ouvertes, cf. AD-18) sont naturellement exclues : leur `date` est vide.
 *
 * @returns la clé du jour, ou `null` si rien n'est porteur dans les données chargées.
 */
export function nextMeaningfulDate(entries: AgendaEntry[], todayKey: string): string | null {
  let best: string | null = null;
  for (const e of entries) {
    if (!e.date || !MEANINGFUL_TYPES.has(e.type)) continue;
    if (e.date < todayKey) continue;
    if (best === null || e.date < best) best = e.date;
  }
  return best;
}
