import type { DaySlot, VoteAnswer } from '@master-jdr/shared';
import { fillTone } from '../../core/theme/tone-format';

/**
 * Story 36.6 — la piste de participation d'un vote.
 *
 * Fonctions pures, testées sans TestBed (patron `selection.utils.ts` / `day-detail.utils.ts`).
 * Elles ne connaissent ni Angular, ni HTTP : elles projettent des données déjà chargées vers la
 * forme qu'affichent les quatre surfaces (case du Mois, cellule de Semaine, rail, Agenda).
 *
 * 🚨 **La règle fondatrice, à ne jamais inverser** (`DESIGN.md:329-333`) : *la piste entière
 * représente la TROUPE, pas les répondants.* La portion remplie dit **combien** ont répondu, les
 * couleurs disent **quoi**, la portion restante — le fond tramé — dit ce qui manque.
 * Tant que les largeurs étaient proportionnelles aux seuls répondants, « 1 votant sur 4, il a dit
 * oui » et « 4 sur 4 tous oui » produisaient une piste verte pleine **identique** : un créneau
 * voté par une personne se lisait comme un créneau plébiscité. C'est le défaut que cette story
 * existe pour corriger, et ce que l'AC3 verrouille.
 */

/** La participation à UNE option de vote, telle que les surfaces la consomment.
 *
 *  `total` est l'effectif de la troupe — **le MJ compris** (`participantCount()` côté serveur),
 *  le même nombre que `AggregatedSlotDto.total`. C'est le DÉNOMINATEUR, jamais le nombre de
 *  répondants. */
export interface VoteParticipation {
  /** Story 36.7 — la partie qui porte ce vote. **Requis, jamais optionnel.**
   *
   *  Les deux routes d'écriture sont scopées à la partie
   *  (`POST/DELETE /parties/:partieId/poll/:pollId/vote…`), et le calendrier PERSONNEL agrège
   *  plusieurs parties : sans ce champ, une bande ne sait pas à quelle partie appartient l'option
   *  qu'elle affiche, et le sélecteur de réponse ne peut pas construire son URL. Optionnel, il
   *  laisserait un `undefined` finir silencieusement dans un chemin d'URL.
   *
   *  Avec `pollId` et `optionId`, il forme le **triplet d'identité** de l'action. Les trois
   *  voyagent ensemble jusqu'aux quatre surfaces — les séparer obligerait chacune à recomposer
   *  une cible, c'est-à-dire à réécrire la dérivation que la story 36.6 a rendue unique. */
  partieId: string;
  pollId: string;
  optionId: string;
  yes: number;
  maybe: number;
  no: number;
  total: number;
  /** `null` = je n'ai pas répondu. Jamais `undefined` (AD-10 : une seule représentation). */
  myAnswer: VoteAnswer | null;
  /** Story 44.2 — je ne suis pas votant de ce sondage (places limitées d'un groupe) : la piste se lit, le
   *  sélecteur de réponse ne s'ouvre pas. Absent = je peux répondre. */
  readOnly?: boolean;
}

/**
 * Story 36.7 — une option de vote vient d'être activée sur une surface du calendrier.
 *
 * Émis par la case du Mois, la cellule de Semaine, le rail et l'Agenda. **Les surfaces ne savent
 * pas qu'un sélecteur existe** : elles signalent ce qui vient d'arriver, `CalendarView` décide
 * quoi en faire. C'est la même séparation que `slotSelected` / `scenarioActivated`.
 *
 * `anchor` est l'élément **déjà présent** qui portait l'option — la bande, la cellule ou le
 * bouton de ligne. 🚨 Aucun nœud n'est jamais ajouté pour servir d'ancre : un nœud de plus dans
 * une cellule casserait le hit-test du glissement (`elementFromPoint` + `closest`), et aucun test
 * ne le verrait (le hit-test est stubbé en jsdom).
 */
export interface VoteOptionActivatedEvent {
  vote: VoteParticipation;
  /** Story 47.5 — TOUTES les options du vote qui couvrent le créneau touché (une ligne par plage), telles que
   *  `buildDayDetail()` les a projetées (`pollVotes`). Absent ou d'une seule entrée = le sélecteur d'avant. */
  lines?: readonly VoteLine[];
  date: Date;
  slot: DaySlot;
  anchor: HTMLElement;
}

/** Story 47.5 — une option de vote qui couvre un créneau, pour une ligne du sélecteur de réponse. */
export interface VoteLine {
  vote: VoteParticipation;
  /** « ven. 6 soir → dim. 8 après-midi » ; vide pour un créneau seul. */
  range: string;
}

/** Largeurs des trois segments, en pourcentage de l'effectif TOTAL. Le reste de la piste n'est pas
 *  un quatrième segment : c'est le fond tramé qui transparaît. */
export interface TrackSegments {
  yes: number;
  maybe: number;
  no: number;
}

/** Niveau de densité, même vocabulaire que `composeSeanceInfo()` — ce que les surfaces savent
 *  dire d'elles-mêmes, plutôt qu'un budget en pixels. */
export type TrackDensity = 'full' | 'compact';

/** Dictionnaire de ton lisible par les fonctions pures (`theme.tone()` d'un composant). */
type ToneDict = Readonly<Record<string, string>>;

/** Clés de ton des trois avis, résolues par `answerWord()`. */
const ANSWER_WORD_KEYS: Record<VoteAnswer, string> = {
  YES: 'calendar.util_answer_yes',
  MAYBE: 'calendar.util_answer_maybe',
  NO: 'calendar.util_answer_no',
};

/**
 * Ramène une valeur à un entier fini et positif.
 *
 * 🚨 **Pourquoi cette garde existe** — défaut RÉEL trouvé à la vérification visuelle, qu'aucun
 * test n'avait vu : quand le serveur ne sert pas encore les agrégats (client neuf, API en retard
 * — exactement l'état transitoire d'un déploiement), les champs arrivent `undefined` et le rail
 * affichait « **NaN / undefined** » à l'écran. Le typage ne protège de rien ici : la charge utile
 * vient du réseau. On dégrade vers zéro, jamais vers un non-nombre.
 */
function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Nombre de personnes ayant répondu, tous avis confondus — le NUMÉRATEUR du « 3 / 4 ». */
export function respondedCount(vote: VoteParticipation): number {
  return safeCount(vote.yes) + safeCount(vote.maybe) + safeCount(vote.no);
}

/**
 * Les trois largeurs, en pourcentage de l'effectif.
 *
 * Deux gardes, toutes deux exigées par un AC et par la revue de sécurité — ces valeurs finissent
 * dans un attribut `style` :
 * - **effectif nul** ⇒ zéro partout, jamais une division par zéro ni un `NaN%` ;
 * - **plus de réponses que de membres** (effectif périmé : un membre retiré après avoir voté)
 *   ⇒ les largeurs sont ramenées à 100 % au total, jamais au-delà.
 */
export function trackSegments(vote: VoteParticipation): TrackSegments {
  const total = safeCount(vote.total);
  if (total <= 0) return { yes: 0, maybe: 0, no: 0 };
  const scale = 100 / total;
  const yes = safeCount(vote.yes) * scale;
  const maybe = safeCount(vote.maybe) * scale;
  const no = safeCount(vote.no) * scale;
  const sum = yes + maybe + no;
  if (sum <= 100) return { yes, maybe, no };
  // Bornage proportionnel : on préserve le rapport entre les trois avis.
  const k = 100 / sum;
  return { yes: yes * k, maybe: maybe * k, no: no * k };
}

/** Le compteur qui double la forme (AC4) — « 3 / 4 ». Toujours rendu, même à zéro : une piste
 *  vide et une piste absente ne doivent pas se ressembler.
 *
 *  Borné comme `trackSegments()` (revue de code du 36.6) : un effectif périmé (membre retiré
 *  après avoir voté) ne doit jamais afficher « 5 / 4 » à côté d'une piste rendue pleine à 100 %. */
export function counterLabel(vote: VoteParticipation, tone: ToneDict): string {
  const total = safeCount(vote.total);
  return fillTone(tone['calendar.util_counter'], {
    n: Math.min(respondedCount(vote), total),
    total,
  });
}

/**
 * Ma réponse, **en toutes lettres** (AC5) — jamais un code, jamais la seule couleur.
 *
 * Deux formulations, gouvernées par la densité : la case du Mois n'a la place que du mot
 * (« oui »), le rail phrase (« tu as dit oui »). Un seul point de vérité pour les deux, sans quoi
 * les surfaces diraient la même chose de deux façons.
 */
export function answerLabel(
  answer: VoteAnswer | null,
  density: TrackDensity,
  tone: ToneDict,
): string {
  if (!answer) return '';
  const word = tone[ANSWER_WORD_KEYS[answer]];
  return density === 'full' ? fillTone(tone['calendar.util_answer_mine'], { answer: word }) : word;
}

/**
 * Le nom accessible de la piste (AC14).
 *
 * La piste code par la **proportion** : sans ce texte, elle n'existe pas pour un lecteur d'écran.
 * Il dit le total, le détail des avis donnés (jamais un avis à zéro, qui n'apprendrait rien) et
 * ma réponse.
 */
export function participationAriaLabel(vote: VoteParticipation, tone: ToneDict): string {
  const total = safeCount(vote.total);
  // Borné comme `trackSegments()`/`counterLabel()` (revue de code du 36.6) : un effectif périmé
  // ne doit jamais annoncer « 5 réponses sur 4 ».
  const n = Math.min(respondedCount(vote), total);
  const countKey = n > 1 ? 'calendar.util_participation_many' : 'calendar.util_participation_one';
  const parts = [fillTone(tone[countKey], { n, total })];

  const detail = (['YES', 'MAYBE', 'NO'] as const)
    .map(
      (a) => [a, safeCount(a === 'YES' ? vote.yes : a === 'MAYBE' ? vote.maybe : vote.no)] as const,
    )
    .filter(([, count]) => count > 0)
    .map(([a, count]) => `${count} ${tone[ANSWER_WORD_KEYS[a]]}`);
  if (detail.length > 0) parts.push(detail.join(', '));

  const mine = answerLabel(vote.myAnswer, 'full', tone);
  if (mine) parts.push(mine);

  return parts.join(' — ');
}
