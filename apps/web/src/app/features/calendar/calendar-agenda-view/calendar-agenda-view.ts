import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { DaySlot } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import {
  type RailTarget,
  composeSeanceInfo,
  dateKeyToLocalMidnight,
  toDateKey,
} from '../day-detail.utils';
import type { GroupAvailability } from '../group-availability.utils';
import {
  participationAriaLabel,
  type VoteOptionActivatedEvent,
  type VoteParticipation,
} from '../poll-track.utils';
import { PollTrack } from '../poll-track/poll-track';
import {
  SLOT_LABELS,
  type AgendaBadge,
  type AgendaSectionId,
  type AgendaVoteGroup,
  badgeFor,
  groupVoteEntries,
  pollGroupBadge,
  sectionIdFor,
} from '../agenda-badge.utils';
import { entrySpanShortLabel, isSpan, spanShortLabel } from '../span-label';

/** Type d'entrée affichée dans la vue Agenda (Story 30.6, AC2) — un par couche pertinente.
 *
 *  ⚠️ Story 36.11 : trois de ces types n'ont plus de section dans l'Agenda
 *  (`mes-disponibilites`, `mes-indisponibilites`, `disponibilite-groupe`). Ils restent des types
 *  d'entrée valides — le rail, la vue Mois et la vue Semaine les consomment — mais la LISTE ne
 *  les rend plus. Le retrait est à l'affichage, jamais à la source. */
export type AgendaEntryType =
  | 'mes-seances'
  | 'votes-en-cours'
  | 'inscriptions-ouvertes'
  | 'mes-disponibilites'
  | 'mes-indisponibilites'
  | 'disponibilite-groupe'
  /** Story 36.12 — une séance à laquelle aucun vote n'est encore attaché, donc sans date
   *  proposée. **MJ et contexte de partie uniquement** : elle dérive d'`eligibleSeances()`, qui
   *  n'existe pas dans le calendrier personnel.
   *
   *  ⚠️ Agenda-only et sans date, exactement comme `inscriptions-ouvertes` : elle n'a aucune case
   *  où se poser, et ni la grille ni le rail ne la voient. Ne pas l'ajouter à `MEANINGFUL_TYPES`
   *  (`day-detail.utils.ts`), sans quoi le rail au repos pourrait se poser sur un jour vide. */
  | 'seances-sans-date';

/** Entrée déjà résolue par `CalendarView` (sources différentes selon le contexte personnel/partie,
 *  cf. encadré n°1 de la story) — ce composant ne fait QUE ranger et afficher, aucune dérivation
 *  ici. */
export interface AgendaEntry {
  /** Clé stable pour @for — pas forcément un id serveur (options de vote, créneaux agrégés). */
  key: string;
  type: AgendaEntryType;
  /** `YYYY-MM-DD`, ou chaîne vide si l'entrée n'a pas de date propre (inscriptions ouvertes) —
   *  rangée en fin de section dans ce cas, jamais traitée comme une anomalie (Story 36.11, AC3). */
  date: string;
  label: string;
  detail?: string;
  /** Story 36.1, Task 2 : créneau TYPÉ de l'entrée. `detail` porte déjà cette information sous
   *  forme de texte libre destiné à l'affichage ; le rail de détail a besoin d'une valeur
   *  exploitable pour ranger l'entrée dans la bonne ligne. `undefined` = créneau inconnu, traité
   *  comme `FULL_DAY` en lecture (même convention que `compute-display-status.ts`). */
  slot?: DaySlot;
  /** Story 47.3 — fin de la plage d'un rendez-vous de plusieurs créneaux (`YYYY-MM-DD` et créneau). Absentes pour
   *  un créneau seul : `date` / `slot` en sont alors le début ET la fin. UNE entrée par rendez-vous — la grille et
   *  le rail la déplient (`entryCoversCell`), l'Agenda l'écrit « début → fin ». */
  endDate?: string;
  endSlot?: DaySlot;
  /** Story 36.1, Task 4 bis : identifiants de navigation. Renseignés uniquement pour les entrées
   *  ouvrables — aujourd'hui les séances, dont on ouvre le SCÉNARIO qui les porte (aucun écran de
   *  séance n'existe). Absents pour toute entrée non ouvrable. */
  partieId?: string;
  scenarioId?: string;
  seanceId?: string;
  /** Story 36.5 — informations pratiques d'une séance, gardées SEPAREES jusqu'à l'affichage :
   *  c'est ce qui permet d'en lâcher une quand la place manque (AC3). Une chaîne pré-composée
   *  rendrait l'ordre de repli impossible à appliquer en aval.
   *  ⚠️ Ne jamais les verser dans `detail`, qui porte déjà trois usages distincts.
   *  `seanceHeure` est une ETIQUETTE `"HH:MM"` : rien ne la parse, ne la compare ni ne la trie. */
  seanceHeure?: string | null;
  seanceLieu?: string | null;
  seanceNote?: string | null;
  /** Story 36.6 — la participation à l'option de vote portée par cette entrée.
   *
   *  ⚠️ **Depuis cette story, une entrée `votes-en-cours` représente UNE OPTION, pas un sondage.**
   *  Un vote proposant deux créneaux produit deux entrées, à deux dates — sans quoi seul le
   *  premier créneau serait marqué dans la grille (défaut pré-existant, encadré n°1 de la story).
   *
   *  Sous-objet plutôt que sept champs plats : `AgendaEntry` est déjà chargé, et la story 36.7 en
   *  ajoutera. Renseigné pour les seules entrées `votes-en-cours`. */
  vote?: VoteParticipation;
  /** Story 36.8 — la disponibilité du groupe sur ce créneau, en charge utile STRUCTURÉE.
   *
   *  ⚠️ `label` et `detail` portaient déjà cette information en texte libre (« Soir — 2/4
   *  disponibles ») : cela suffisait à une liste, jamais à une jauge, qui a besoin des nombres.
   *
   *  Renseigné pour les seules entrées `disponibilite-groupe`, qui n'existent qu'en contexte de
   *  partie (AD-16 : la couche n'a aucun sens dans le calendrier personnel). Depuis la 36.11 ces
   *  entrées ne sont plus rendues par l'Agenda ; le champ sert la grille et le rail. */
  group?: GroupAvailability;
  /** Story 36.11 — le compte-rendu de la séance manque, donc elle a encore quelque chose à me
   *  demander une fois jouée (« C'est passé »).
   *
   *  🚨 **Renseigné en contexte de PARTIE uniquement** : `SeanceDto.compteRendu` n'a aucun
   *  équivalent sur `MyCalendarSeanceEntry`. `undefined` signifie « on ne sait pas », et une
   *  séance dont on ne sait pas n'entre pas dans « C'est passé » — la section reste alors vide,
   *  donc absente. Ne pas confondre avec `false`, qui affirme que le compte-rendu existe. */
  compteRenduManquant?: boolean;
  /** Story 36.11 — je figure déjà parmi les inscrits de cette séance à inscription ouverte.
   *  Renseigné pour les seules entrées `inscriptions-ouvertes` ; commande le badge (« S'inscrire »
   *  contre « Inscrit »), jamais l'appartenance à une section. */
  jeSuisInscrit?: boolean;
}

/**
 * Story 36.12 — ce qu'une section contient, ligne par ligne.
 *
 * 🚨 **Une ligne de vote n'est plus une option, c'est un vote** (AC7). Le reste de l'agenda reste
 * une entrée par ligne. Une union discriminée plutôt qu'un `AgendaEntry` gonflé d'un
 * `options?: AgendaEntry[]` : le gabarit d'une ligne de vote n'a presque rien de commun avec
 * celui d'une séance, et les confondre ferait un template à trous.
 */
export type AgendaRow =
  | { kind: 'entry'; key: string; entry: AgendaEntry }
  | { kind: 'poll'; key: string; group: AgendaVoteGroup };

/** Une section de l'Agenda, prête à rendre. Construite par `sections()`, jamais à la main. */
export interface AgendaSection {
  id: AgendaSectionId;
  /** Clé de ton — le libellé dépend du thème actif, comme tout titre de l'application. */
  titleKey: string;
  /** Teinte de la palette de statut portée par le liseré et l'en-tête. */
  tint: 'todo' | 'soon' | 'done';
  rows: AgendaRow[];
}

/** Ce qu'une demande de scellement porte jusqu'à `CalendarView`, qui seul écrit (AC10).
 *
 *  🚨 `partieId` vient du **triplet d'identité de l'option** (Story 36.7), jamais de la route :
 *  c'est la seule valeur qui reste juste si un jour une ligne de vote d'une autre partie
 *  atteignait cette surface. `dateLabel` sert la confirmation (AC11) — elle doit nommer ce
 *  qu'elle scelle. */
export interface AgendaSealRequest {
  partieId: string;
  pollId: string;
  optionId: string;
  dateLabel: string;
  /** Le scénario (ou la partie) que porte le vote — plusieurs votes peuvent être ouverts en
   *  parallèle depuis la story 8.8, la confirmation doit donc dire LEQUEL elle scelle. */
  pollLabel: string;
}

/** L'ordre des trois sections est **contractuel** et ne dépend d'aucune donnée : ce qu'on attend
 *  de moi d'abord, ce qui est programmé ensuite, ce qui traîne derrière en dernier.
 *  [Source: EXPERIENCE.md §4.4 bis] */
const SECTION_ORDER: readonly Omit<AgendaSection, 'rows'>[] = [
  { id: 'awaiting', titleKey: 'calendar.agenda.section_awaiting', tint: 'todo' },
  { id: 'scheduled', titleKey: 'calendar.agenda.section_scheduled', tint: 'soon' },
  { id: 'past', titleKey: 'calendar.agenda.section_past', tint: 'done' },
];

/** Clés de ton des badges, par nature. L'imminence n'y figure pas : c'est un décompte calculé,
 *  pas un libellé de registre. */
const BADGE_KEYS: Record<Exclude<AgendaBadge['kind'], 'imminence'>, string> = {
  'answer-poll': 'calendar.agenda.badge_answer_poll',
  'poll-open': 'calendar.agenda.badge_poll_open',
  signup: 'calendar.agenda.badge_signup',
  'signed-up': 'calendar.agenda.badge_signed_up',
  debrief: 'calendar.agenda.badge_debrief',
  'to-seal': 'calendar.agenda.badge_to_seal',
};

/** Au-delà de ce nombre, les créneaux proposés sont résumés au lieu d'être énumérés (AC14) :
 *  « 28 ou 29 août » reste lisible, la liste des quatre ne l'est plus. */
const MAX_LISTED_OPTIONS = 2;

/** Au-delà de ce nombre, « il manque » nomme les premiers et compte le reste (AC14). */
const MAX_LISTED_MISSING = 3;

/** Une date sans le nom du jour — les options d'un vote sont lues en colonne, l'une sous l'autre :
 *  le jour de la semaine s'y répète et le format long y coûte plus qu'il n'apporte. */
const OPTION_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Ordre chronologique du jour — pas alphabétique (`EVENING` < `MORNING` en toutes lettres) —
 *  pour départager deux options du même jour dans `optionDates()` (revue de code, 36.12). */
const SLOT_ORDER: Record<string, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2, FULL_DAY: 3 };

/** Une entrée sans date propre se range en FIN de section. Une clé sentinelle plutôt qu'un test
 *  dans le comparateur : le tri reste une comparaison de chaînes, comme partout ailleurs. */
const NO_DATE_SORT_KEY = '9999-12-31';

// Revue de code 36.11 — l'année est nécessaire : « C'est passé » et « C'est programmé » n'ont
// aucune borne de date (au moins un an d'historique/d'avenir), donc deux entrées au même
// jour-du-calendrier mais d'années différentes s'afficheraient sinon de façon identique.
const AGENDA_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Vue Agenda (Story 36.11, FR-56) — troisième présentation du calendrier.
 *
 * 🚨 **Elle n'a pas d'axe temporel.** Elle ne trie pas par date : elle range par **ce qu'on
 * attend du lecteur**, en trois sections, et **aucun jour ne figure en en-tête** — la date
 * redevient une propriété de la ligne. C'est ce qui la distingue des deux grilles, qui portent
 * déjà le temps. [Source: EXPERIENCE.md §4.4 bis, `contrat-ui-calendrier.html` planche 3]
 *
 * Composant de rendu pur : la dérivation par couche/contexte (personnel via `GET /me/calendar`,
 * partie via les signaux déjà chargés) reste dans `CalendarView`. Aucun appel réseau n'existe ni
 * ne doit exister ici.
 */
@Component({
  selector: 'app-calendar-agenda-view',
  standalone: true,
  imports: [NgTemplateOutlet, MatProgressSpinnerModule, PollTrack],
  templateUrl: './calendar-agenda-view.html',
  styleUrl: './calendar-agenda-view.scss',
})
export class CalendarAgendaView {
  protected readonly theme = inject(ThemeToneService);

  readonly entries = input<AgendaEntry[]>([]);
  readonly loading = input(false);
  /** Story 36.11 — le « maintenant » de l'écran, **injecté** et jamais lu ici.
   *
   *  🚨 Un `new Date()` interne rendrait tout test indéterministe et pourrait placer deux entrées
   *  de part et d'autre d'une frontière de jour au sein du même rendu. `CalendarView` le fige au
   *  montage, une seule source pour tout l'écran (même patron que `Dashboard.countdownNow`). La
   *  valeur par défaut ne sert qu'à ne casser aucun site d'appel existant. */
  readonly todayKey = input<string>(toDateKey(new Date()));

  /** Story 36.7 — « Idem » de la table 1 d'`EXPERIENCE.md` : l'Agenda ouvre le même sélecteur de
   *  réponse que les grilles. Composant de rendu pur : il signale, il n'écrit pas. */
  readonly voteOptionActivated = output<VoteOptionActivatedEvent>();

  /** Story 36.11, AC5 — activer une ligne portant une séance ouvre **le scénario** qui la porte ;
   *  aucun écran de séance n'existe. Même type d'événement que le rail, pour que `CalendarView`
   *  branche les deux surfaces sur `onScenarioActivated()` — une seule navigation. */
  readonly scenarioActivated = output<RailTarget>();

  /**
   * Story 36.12 — le lecteur peut-il sceller ? (AC6, AC12)
   *
   * 🚨 **Deux conditions, décidées par le parent** : être MJ **et** être dans le calendrier d'une
   * partie. Le calendrier personnel agrège plusieurs parties et ne sait de AUCUNE d'elles si j'en
   * suis le MJ — `MyCalendarPollEntry` ne porte ni rôle ni `ownerId`, et ne doit pas les porter
   * (AD-9). Un bouton *Sceller* y échouerait en 403 une ligne sur deux.
   *
   * 🚨 Ce drapeau est une affaire d'**interface**, jamais de sécurité : `PollService.choose()`
   * garde la route par `getOwned()`. Ne jamais raisonner comme si l'absence de bouton protégeait.
   */
  readonly canSeal = input(false);

  /**
   * Story 36.12, AC14 — les noms de ceux qui n'ont pas encore répondu, par `pollId`.
   *
   * 🚨 Calculé par `CalendarView` avec `getMissingVoters()`, **la définition unique** partagée
   * avec la fiche de scénario et `<app-poll-missing>`. Une seconde définition de « manquant » sur
   * le même écran finirait par diverger de la première.
   *
   * Vide hors mode MJ, et **structurellement vide** en calendrier personnel : aucune identité de
   * votant n'y transite (`MyCalendarPollOption` est anonyme par conception).
   */
  readonly missingByPoll = input<Record<string, string[]>>({});

  /** Story 36.12, AC10 — le MJ demande à sceller une option. Le composant **signale**, il n'écrit
   *  pas : `CalendarView` confirme puis appelle `PollService.chooseDate()`. Même séparation que
   *  `voteOptionActivated` et `scenarioActivated`. */
  readonly sealRequested = output<AgendaSealRequest>();

  /** Story 36.12, AC13 — le MJ veut lancer un vote sur une séance sans date. Porte le `seanceId` ;
   *  c'est `CalendarView` qui bascule sur le Mois et arme la composition de la 36.10. */
  readonly pollLaunchRequested = output<string>();

  /**
   * Story 36.12, AC8 — les votes dépliés **à la main**, par `pollId`.
   *
   * 🚨 **Des `pollId`, jamais des index** : `activePolls()` est reconstruit à chaque événement
   * temps réel, et un index survivrait au rechargement en désignant un AUTRE vote (piège
   * fondateur de la 36.9).
   *
   * 🚨 **Il s'AJOUTE à la maturité, il ne la remplace pas.** Un vote mûr est déplié qu'il figure
   * ici ou non. Et un vote non mûr DOIT pouvoir se déplier : la ligne d'option est le seul chemin
   * de réponse depuis l'Agenda — « d'office » veut dire « par défaut », pas « exclusivement ».
   *
   * État purement visuel : rien n'est persisté, ni en compte, ni en `localStorage`, ni dans l'URL.
   */
  private readonly expanded = signal<ReadonlyMap<string, boolean>>(new Map());

  /**
   * Les sections à rendre, **dans l'ordre contractuel et sans les vides** (AC10).
   *
   * Une section absente vaut mieux qu'un en-tête suivi de rien : l'en-tête annoncerait un contenu
   * que l'écran ne porte pas.
   */
  protected readonly sections = computed<AgendaSection[]>(() => {
    const today = this.todayKey();
    const canSeal = this.canSeal();
    const buckets = new Map<AgendaSectionId, AgendaRow[]>([
      ['awaiting', []],
      ['scheduled', []],
      ['past', []],
    ]);

    // Story 36.12, AC7 — les options d'un même vote fusionnent en UNE ligne, avant tout tri. Ce
    // que la 36.6 a éclaté pour la grille se recompose ici, et ici seulement.
    const { groups } = groupVoteEntries(this.entries());
    const grouped = new Set(groups.flatMap((g) => g.options.map((o) => o.key)));

    for (const entry of this.entries()) {
      // Les options rassemblées dans un groupe ne produisent plus de ligne propre. Celles qu'on
      // n'a pas pu grouper (agrégats non servis, API en retard) ne sont PAS dans `grouped` : elles
      // gardent leur ligne d'origine, dégradée mais présente — jamais perdue.
      if (grouped.has(entry.key)) continue;
      const id = sectionIdFor(entry, today);
      if (id) buckets.get(id)!.push({ kind: 'entry', key: entry.key, entry });
    }

    for (const group of groups) {
      buckets.get('awaiting')!.push({ kind: 'poll', key: `poll-${group.pollId}`, group });
    }

    // « Ça t'attend » : ce qui réclame une action de moi d'abord — l'urgence est le critère de la
    // vue, elle doit valoir aussi À L'INTÉRIEUR d'une section. Puis la date, puis le libellé
    // (départage stable de deux entrées sans date, cf. revue de code de la 30.6).
    buckets
      .get('awaiting')!
      .sort(
        (a, b) =>
          this.actionRank(a, today, canSeal) - this.actionRank(b, today, canSeal) ||
          this.dateSortKey(a).localeCompare(this.dateSortKey(b)) ||
          this.rowLabel(a).localeCompare(this.rowLabel(b)),
      );
    buckets
      .get('scheduled')!
      .sort(
        (a, b) =>
          this.dateSortKey(a).localeCompare(this.dateSortKey(b)) ||
          this.rowLabel(a).localeCompare(this.rowLabel(b)),
      );
    // « C'est passé » se lit du plus récent au plus ancien : un compte-rendu oublié hier prime
    // sur celui d'il y a trois mois.
    buckets
      .get('past')!
      .sort(
        (a, b) =>
          this.dateSortKey(b).localeCompare(this.dateSortKey(a)) ||
          this.rowLabel(a).localeCompare(this.rowLabel(b)),
      );

    return SECTION_ORDER.filter((s) => buckets.get(s.id)!.length > 0).map((s) => ({
      ...s,
      rows: buckets.get(s.id)!,
    }));
  });

  private actionRank(row: AgendaRow, today: string, canSeal: boolean): number {
    const badge =
      row.kind === 'poll' ? pollGroupBadge(row.group, canSeal) : badgeFor(row.entry, today);
    return badge?.tone === 'todo' ? 0 : 1;
  }

  /** La date qui range la ligne. Pour un vote, c'est la **plus proche** de ses options — une
   *  option lointaine ne doit pas repousser un vote qui se joue la semaine prochaine (AC18). */
  private dateSortKey(row: AgendaRow): string {
    const date = row.kind === 'poll' ? row.group.nearestDate : row.entry.date;
    return date || NO_DATE_SORT_KEY;
  }

  private rowLabel(row: AgendaRow): string {
    return row.kind === 'poll' ? row.group.label : row.entry.label;
  }

  protected sectionTitle(section: AgendaSection): string {
    return this.theme.tone()[section.titleKey];
  }

  protected readonly emptyMessage = computed(() => this.theme.tone()['calendar.agenda.empty']);

  /**
   * AC2 — la date est une propriété de la ligne : elle est rendue **avec** l'entrée, jamais en
   * en-tête de groupe.
   *
   * Le créneau est traduit ici et non repris de `detail`, qui porte le code brut (`EVENING`) pour
   * les séances — un reste que la liste plate laissait fuir à l'écran.
   */
  protected metaLine(entry: AgendaEntry): string {
    const parts: string[] = [];
    if (entry.date) {
      // Story 47.3 : UNE ligne par rendez-vous — « ven. 6 nov. soir → dim. 8 nov. après-midi » pour une plage.
      const start = { date: entry.date, slot: entry.slot };
      const end = entry.endDate ? { date: entry.endDate, slot: entry.endSlot } : null;
      parts.push(
        isSpan(start, end) ? spanShortLabel(start, end) : this.dateWithSlot(entry.date, entry.slot),
      );
    }
    if (entry.type === 'inscriptions-ouvertes') {
      if (entry.detail) parts.push(entry.detail);
      // Revue de code de la 36.11 : ce libellé était codé en dur alors que tous les autres
      // passent par le registre du thème. Corrigé ici, cette méthode étant réécrite.
      //
      // Revue de code (2e passe, 2026-08-24) — garde explicite sur `!entry.date` ajoutée : le
      // typage de `AgendaEntry` ne garantit pas que `date` soit vide pour ce type. Sans elle, une
      // entrée qui porterait un jour une date afficherait à la fois la date ET « sans date »,
      // contradictoire. `calendar-view.ts` pose toujours `date: ''` pour ce type aujourd'hui,
      // mais rien ne le garantit au niveau du type.
      if (!entry.date) parts.push(this.theme.tone()['calendar.agenda.no_date']);
    } else if (entry.type === 'seances-sans-date') {
      parts.push(this.theme.tone()['calendar.agenda.no_date_proposed']);
    } else if (entry.type === 'votes-en-cours' && entry.detail && !entry.date) {
      // Revue de code (2e passe, 2026-08-24) — branche jamais atteinte par l'invariant de
      // construction ACTUEL (`calendar-view.ts` pose toujours `date: option.date` pour ce type,
      // une ligne par option) : conservée comme filet explicite, pas retirée, au cas où une
      // évolution future produirait un `votes-en-cours` sans date propre (ex. créneau non encore
      // choisi) — auquel cas le créneau seul (`detail`) resterait affiché.
      parts.push(entry.detail);
    }
    const infos = this.seanceInfo(entry);
    if (infos) parts.push(infos);
    return parts.join(' · ');
  }

  /**
   * AC14 — ce que dit la ligne d'un vote : « Vote ouvert · 28 ou 29 août · 2 sur 4 ont répondu »,
   * plus « il manque Léa, Tom » quand le lecteur est le MJ.
   *
   * ⚠️ **Aucune piste ici, et c'est délibéré.** La planche en dessine une petite en ligne ; une
   * piste au niveau du VOTE devrait agréger les `yes`/`maybe`/`no` de plusieurs options, or un
   * membre peut répondre différemment sur chacune — elle affirmerait un consensus que personne
   * n'a exprimé. C'est exactement le défaut fondateur que la 36.6 existe pour corriger. Les
   * pistes vivent sur les options, où elles sont vraies ; ici, le compteur en toutes lettres.
   */
  protected pollMeta(group: AgendaVoteGroup): string {
    const tone = this.theme.tone();
    const parts = [tone['calendar.agenda.poll_open'], this.optionDates(group)];
    parts.push(
      tone['calendar.agenda.responded_count']
        .replace('{n}', String(group.respondedCount))
        .replace('{total}', String(group.membersCount)),
    );
    const missing = this.missingLabel(group);
    if (missing) parts.push(missing);
    return parts.filter((p) => p).join(' · ');
  }

  /** Jusqu'à deux créneaux énumérés (« ven. 28 août ou sam. 29 août »), au-delà résumés (AC14).
   *
   *  Revue de code (36.12) — inclut le CRÉNEAU (`slot`), pas seulement la date : deux options du
   *  même jour à des créneaux différents (matin/soir) sont un cas normal de la composition sur
   *  grille, et un résumé qui ne regardait que la date les rendait indiscernables
   *  (« ven. 28 août ou ven. 28 août »), contrairement à `optionLabel()` sur les options dépliées. */
  private optionDates(group: AgendaVoteGroup): string {
    // Énumérés dans l'ordre du CALENDRIER, pas de la faveur : une liste de dates se lit dans le
    // temps. La faveur gouverne les options dépliées, pas ce résumé.
    const seen = new Set<string>();
    const slots = group.options
      .filter((o) => o.date)
      .filter((o) => {
        const key = `${o.date}|${o.slot ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (SLOT_ORDER[a.slot ?? ''] ?? 0) - (SLOT_ORDER[b.slot ?? ''] ?? 0),
      );
    if (slots.length === 0) return '';
    if (slots.length > MAX_LISTED_OPTIONS) {
      return this.theme
        .tone()
        ['calendar.agenda.slots_proposed'].replace('{n}', String(slots.length));
    }
    return slots.map((o) => this.optionLabel(o)).join(' ou ');
  }

  /** « il manque Léa, Tom » — MJ en contexte de partie uniquement, la liste venant du parent. */
  private missingLabel(group: AgendaVoteGroup): string {
    const names = this.missingByPoll()[group.pollId] ?? [];
    if (names.length === 0) return '';
    const tone = this.theme.tone();
    const listed = names.slice(0, MAX_LISTED_MISSING).join(', ');
    const rest = names.length - MAX_LISTED_MISSING;
    const moreKey =
      rest > 1 ? 'calendar.agenda_missing_more_many' : 'calendar.agenda_missing_more_one';
    return tone['calendar.agenda.missing_voters'].replace(
      '{names}',
      rest > 0 ? fillTone(tone[moreKey], { listed, rest }) : listed,
    );
  }

  /** AC8 — l'intention du lecteur prime ; à défaut, la maturité décide (« d'office » = par
   *  défaut). */
  protected isExpanded(group: AgendaVoteGroup): boolean {
    return this.expanded().get(group.pollId) ?? group.mature;
  }

  /**
   * AC8 — déplier/replier à la main, y compris un vote mûr : le MJ doit pouvoir refermer une page
   * pleine d'options.
   *
   * 🚨 On enregistre une **intention explicite**, jamais une inversion de la maturité. La nuance
   * n'est pas théorique : si l'on stockait « inversé », un vote déplié à la main qui devient mûr
   * en direct (réponse d'un autre membre reçue par SSE) se **refermerait tout seul** sous les
   * yeux du lecteur.
   */
  protected toggleExpanded(group: AgendaVoteGroup): void {
    const open = this.isExpanded(group);
    this.expanded.update((current) => new Map(current).set(group.pollId, !open));
  }

  private dateWithSlot(dateKey: string, slot: DaySlot | undefined): string {
    const date = AGENDA_DATE_FORMAT.format(dateKeyToLocalMidnight(dateKey));
    return slot && slot !== 'FULL_DAY' ? `${date}, ${SLOT_LABELS[slot].toLowerCase()}` : date;
  }

  /** Story 36.5 — même composition que le rail et la bande (AC10). L'agenda est une liste : il
   *  a la place, donc niveau complet. */
  protected seanceInfo(entry: AgendaEntry): string {
    return composeSeanceInfo(
      {
        seanceHeure: entry.seanceHeure ?? null,
        seanceLieu: entry.seanceLieu ?? null,
        seanceNote: entry.seanceNote ?? null,
      },
      'full',
    );
  }

  protected badge(entry: AgendaEntry): AgendaBadge | null {
    return badgeFor(entry, this.todayKey());
  }

  /** AC8 — le badge porte TOUJOURS un libellé : la teinte double le mot, elle ne le remplace
   *  jamais (P-1). */
  protected badgeLabel(badge: AgendaBadge): string {
    return badge.kind === 'imminence'
      ? (badge.text ?? '')
      : this.theme.tone()[BADGE_KEYS[badge.kind]];
  }

  protected badgeClass(badge: AgendaBadge): string {
    const intensity = badge.intensity ? ` agenda-badge--${badge.intensity}` : '';
    return `agenda-badge agenda-badge--${badge.tone}${intensity}`;
  }

  /**
   * AC5/AC12 — la cible de navigation d'une ligne, ou `null` si elle n'en a aucune.
   *
   * 🚨 Une entrée de vote n'est **jamais** ouvrable, même si elle portait un jour ces
   * identifiants : sa ligne contient déjà un bouton (le sélecteur de réponse), et un bouton dans
   * un bouton est du HTML invalide dont la navigation clavier ne se relève pas. La garde est
   * structurelle, pas une observation sur les données actuelles.
   *
   * Une entrée sans scénario identifiable n'est pas cliquable **et ne s'en donne pas l'air** :
   * pas de bouton désactivé, pas de bouton du tout. *(2026-08-24 : ce n'est plus le cas de
   * l'inscription ouverte du calendrier personnel — `MyCalendarOpenInscriptionEntry` porte
   * désormais `scenarioId`, la ligne est ouvrable comme en contexte de partie.)*
   */
  protected openTarget(entry: AgendaEntry): RailTarget | null {
    if (entry.vote || !entry.partieId || !entry.scenarioId) return null;
    // Story 36.12 — même raison pour la séance sans date : sa ligne porte déjà le bouton
    // « Lancer un vote ». La garde structurelle vaut pour toute ligne qui porte une action.
    if (entry.type === 'seances-sans-date') return null;
    return { partieId: entry.partieId, scenarioId: entry.scenarioId };
  }

  /** Le libellé accessible annonce l'ouverture du **scénario**, jamais de la séance
   *  [Source: EXPERIENCE.md §6 bis] — même formulation qu'au rail. */
  protected openLabel(entry: AgendaEntry): string {
    const meta = this.metaLine(entry);
    const tone = this.theme.tone();
    return meta
      ? fillTone(tone['common.ouvrir_le_scenario_label_info'], { label: entry.label, info: meta })
      : fillTone(tone['common.ouvrir_le_scenario_label'], { label: entry.label });
  }

  /** Revue de code 36.7 : même repli qu'au rail — `[attr.aria-label]` écrase le contenu du
   *  bouton, y compris le `role="img"`/`aria-label` propre à `<app-poll-track>` qu'il enveloppe. */
  protected voteAriaLabel(entry: AgendaEntry): string {
    const tone = this.theme.tone();
    const detail = entry.vote ? participationAriaLabel(entry.vote, tone) : null;
    return detail
      ? fillTone(tone['common.repondre_au_vote_label_detail'], { label: entry.label, detail })
      : fillTone(tone['common.repondre_au_vote_label'], { label: entry.label });
  }

  /** Date à minuit LOCAL, comme les grilles — jamais UTC (cf. `dateKeyToLocalMidnight`). */
  protected onVoteActivate(entry: AgendaEntry, event: Event): void {
    const vote = entry.vote;
    if (!vote || !entry.date || !(event.currentTarget instanceof HTMLElement)) return;
    this.voteOptionActivated.emit({
      vote,
      date: dateKeyToLocalMidnight(entry.date),
      slot: entry.slot ?? 'FULL_DAY',
      anchor: event.currentTarget,
    });
  }

  // ─── Story 36.12 — les options dépliées ───────────────────────────────────

  /** Le créneau proposé, lu en colonne : « ven. 28 août, soir ». */
  protected optionLabel(entry: AgendaEntry): string {
    // Story 47.5 — un candidat de plusieurs créneaux s'écrit de son début à sa fin, ici comme dans la confirmation
    // de scellement (qui réutilise ce libellé) ; un créneau seul reste inchangé.
    const span = entrySpanShortLabel(entry);
    if (span) return span;
    const date = OPTION_DATE_FORMAT.format(dateKeyToLocalMidnight(entry.date));
    return entry.slot && entry.slot !== 'FULL_DAY'
      ? `${date}, ${SLOT_LABELS[entry.slot].toLowerCase()}`
      : date;
  }

  /**
   * ⚠️ **Clé DÉDIÉE, et surtout pas `cta.choose_date`** — écart avec la story, tranché à l'écran.
   *
   * `cta.choose_date` est une phrase (« Planter le drapeau de la clairière », « Verrouiller
   * l'engrenage de la date ») : elle a été écrite pour LE bouton unique d'un panneau. Répétée sur
   * chacune des options d'un vote — quatorze, sur le jeu de développement — elle passait à la
   * ligne et doublait la hauteur de chaque option, faisant de la ligne dépliée un mur.
   * La planche contractuelle porte un « Sceller » court sur chaque option ; c'est ce que cette
   * clé rend. La phrase longue reste, à sa place : sur le bouton du dialogue de confirmation, où
   * il n'y en a qu'un et où il est l'action principale.
   */
  protected sealLabel(): string {
    return this.theme.tone()['calendar.agenda.action_seal'];
  }

  protected launchLabel(): string {
    return this.theme.tone()['calendar.agenda.action_launch_poll'];
  }

  /** Le badge d'une ligne de vote — il dépend du lecteur ET de la maturité (AC15). */
  protected pollBadge(group: AgendaVoteGroup): AgendaBadge {
    return pollGroupBadge(group, this.canSeal());
  }

  /** Le nom accessible du bouton de dépliement : il annonce ce qu'il va faire, pas ce qu'il est. */
  protected discloseLabel(group: AgendaVoteGroup): string {
    // Revue de code (36.12) — thématisé, comme le reste des libellés d'agenda.
    const tone = this.theme.tone();
    const key = this.isExpanded(group)
      ? 'calendar.agenda.action_collapse'
      : 'calendar.agenda.action_expand';
    return `${tone[key]} les créneaux du vote — ${group.label} — ${this.pollMeta(group)}`;
  }

  /**
   * AC10 — le MJ demande à sceller. **Aucune écriture ici** : la garde d'autorisation vit côté
   * serveur (`getOwned`), la confirmation et l'appel vivent dans `CalendarView`.
   *
   * 🚨 `canSeal` est revérifié : le bouton n'existe pas quand il est faux, mais un composant de
   * rendu ne doit pas dépendre du template pour tenir son contrat.
   */
  protected requestSeal(group: AgendaVoteGroup, entry: AgendaEntry): void {
    if (!this.canSeal() || !entry.vote) return;
    this.sealRequested.emit({
      partieId: entry.vote.partieId,
      pollId: group.pollId,
      optionId: entry.vote.optionId,
      dateLabel: this.optionLabel(entry),
      pollLabel: group.label,
    });
  }

  /** AC3 — le nom accessible du bouton *Sceller* nomme le créneau qu'il retiendrait. Sans lui,
   *  trois boutons identiques se suivraient dans la liste d'un lecteur d'écran. */
  protected sealAriaLabel(group: AgendaVoteGroup, entry: AgendaEntry): string {
    return `${this.sealLabel()} — ${group.label} — ${this.optionLabel(entry)}`;
  }
}
