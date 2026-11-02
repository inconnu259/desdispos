import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../core/icons/app-icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  AvailKind,
  AvailabilityDeclarationDto,
  CalendarLayerKey,
  CreateAvailabilityDto,
  DaySlot,
  SlotStatus,
} from '@master-jdr/shared';
import { computeDisplayStatus } from '../../../core/availability/compute-display-status';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { SLOT_LABELS } from '../agenda-badge.utils';
import { entrySpanShortLabel } from '../span-label';
import { overlapAriaLabel, overlapMarkLabel } from '../../../shared/duration-stepper/duration-labels';
import type { AgendaEntry, AgendaSealRequest } from '../calendar-agenda-view/calendar-agenda-view';
import {
  buildMonthDetails,
  composeSeanceInfo,
  dateKeyToLocalMidnight,
  toDateKey,
  type DayDetail,
  type DaySlotDetail,
  type SlotPollVote,
} from '../day-detail.utils';
import { SlotSelectedEvent } from '../calendar-month-view/calendar-month-view';
import { SelectionBar } from '../selection-bar/selection-bar';
import { composeSpanKeys } from '../compose-span.utils';
import {
  LONG_PRESS_MS,
  MOVE_THRESHOLD_PX,
  type GesturePointerType,
  type SelectedCell,
  composeCellKey,
  weekRangeCells,
} from '../selection.utils';

/** Story 36.15 — MÊME format que `OPTION_DATE_FORMAT` de `calendar-agenda-view.ts` : le libellé
 *  du dialogue de confirmation doit se lire pareil, que le scellement parte de l'Agenda ou d'ici.
 *  Dupliqué plutôt qu'exporté : `OPTION_DATE_FORMAT` est un détail interne de l'Agenda. Toute
 *  retouche ici est à reporter là-bas. */
const SEAL_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

interface SlotData {
  status: SlotStatus;
  preview: SlotStatus | null;
  declLabel: string | null;
  /**
   * Story 36.13 — ce que le créneau PORTE, projeté par `buildDayDetail()` (AC7).
   *
   * ⚠️ Le partage des rôles est délibéré et c'est le point le plus subtil de la story. `detail`
   * porte le contenu textuel (titre, informations pratiques, nom accessible) **et** le statut,
   * parce qu'il est le seul à connaître les séances — `computeDisplayStatus` ne lit que les
   * déclarations. `preview` (revue de code) est désormais dérivé du MÊME point unique, avec la
   * déclaration en attente ajoutée à l'entrée : ni le Mois ni la Semaine ne doivent pouvoir
   * afficher « disponible » par-dessus une séance confirmée pendant une saisie (FR-50), même en
   * aperçu — patron identique à `calendar-month-view.ts` (`previewDetails`/`previewStatus`).
   *
   * Optionnel à dessein : `buildWeek()` le renseigne toujours, mais `WeekCell` est aussi construit
   * par des fixtures hors de cette vue (`selection.utils.spec.ts`), qui n'ont que faire du contenu
   * affiché. Le rendre requis les casserait sans rien garantir de plus au runtime.
   */
  detail?: DaySlotDetail | null;
}

export interface WeekCell {
  date: Date;
  label: string;
  isToday: boolean;
  isPast: boolean;
  morning: SlotData;
  afternoon: SlotData;
  evening: SlotData;
}

export function getWeekStart(date: Date): Date {
  const dow = date.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
}

function toUTCMidnight(isoDate: string): Date {
  const d = new Date(isoDate);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDeclLabel(d: AvailabilityDeclarationDto, tone: Record<string, string>): string {
  const kind =
    d.kind === 'UNAVAILABLE'
      ? tone['calendar.week_decl_unavailable']
      : tone['calendar.week_decl_available'];
  const recur =
    d.recurKind === 'RECURRING'
      ? tone['calendar.week_decl_recurring']
      : tone['calendar.week_decl_punctual'];
  return `${kind} · ${recur}`;
}

function findWeekDecl(
  decls: AvailabilityDeclarationDto[],
  utcDate: Date,
  slot: 'MORNING' | 'AFTERNOON' | 'EVENING',
  now: Date,
): AvailabilityDeclarationDto | null {
  return (
    decls.find((d) => {
      if (new Date(d.expiresAt) <= now) return false;
      const slotMatch = d.slot === 'FULL_DAY' || d.slot === slot;
      if (!slotMatch) return false;
      if (d.recurKind === 'RECURRING') {
        if (d.dayOfWeek !== utcDate.getUTCDay()) return false;
        if (d.startDate) {
          const start = toUTCMidnight(d.startDate);
          if (utcDate < start) return false;
        }
        if (d.endDate) {
          const end = toUTCMidnight(d.endDate);
          if (utcDate > end) return false;
        }
        return utcDate <= toUTCMidnight(d.expiresAt);
      }
      if (!d.startDate || !d.endDate) return false;
      const start = new Date(d.startDate.substring(0, 10) + 'T00:00:00Z');
      const end = new Date(d.endDate.substring(0, 10) + 'T00:00:00Z');
      return utcDate >= start && utcDate <= end;
    }) ?? null
  );
}

function toFakeDecl(dto: CreateAvailabilityDto): AvailabilityDeclarationDto {
  return {
    id: '__preview__',
    userId: '__preview__',
    kind: dto.kind,
    recurKind: dto.recurKind,
    dayOfWeek: dto.dayOfWeek ?? null,
    slot: dto.slot,
    startDate: dto.startDate ?? null,
    endDate: dto.endDate ?? null,
    expiresAt: dto.expiresAt || '2099-12-31T23:59:59.000Z',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Story 36.13 — les sept clés `YYYY-MM-DD` de la semaine, dans l'ordre des colonnes.
 *
 * Extraite pour que la projection des détails (`buildMonthDetails`) porte EXACTEMENT sur les jours
 * que `buildWeek()` rend : deux boucles de dates qui divergeraient d'un fuseau décaleraient
 * silencieusement les titres d'une colonne.
 */
export function weekDateKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    toDateKey(
      new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i),
    ),
  );
}

export function buildWeek(
  weekStart: Date,
  decls: AvailabilityDeclarationDto[],
  pendingDecl: AvailabilityDeclarationDto | null,
  // Textes du thème actif, pour le libellé de déclaration (« Dispo · Récurrent »). Obligatoire : le
  // composant passe le ton courant, aucun appelant ne retombe sur le thème de référence.
  tone: Record<string, string>,
  details?: Map<string, DayDetail>,
  previewDetails?: Map<string, DayDetail> | null,
): WeekCell[] {
  const now = new Date();
  // Minuit UTC d'aujourd'hui — cohérent avec l'alignement UTC des semaines.
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Array.from({ length: 7 }, (_, i) => {
    const utcCell = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i),
    );
    // Pour l'affichage (label, date émise) : date locale représentant le même jour calendaire.
    const cellLocal = new Date(
      utcCell.getUTCFullYear(),
      utcCell.getUTCMonth(),
      utcCell.getUTCDate(),
    );
    const cellKey = toDateKey(cellLocal);

    const computeSlot = (slot: 'MORNING' | 'AFTERNOON' | 'EVENING'): SlotData => {
      const status = computeDisplayStatus(utcCell, slot, decls);
      const matchingDecl = findWeekDecl(decls, utcCell, slot, now);
      const dayDetail = details?.get(cellKey) ?? null;
      const detail = dayDetail?.slots.find((s) => s.slot === slot) ?? null;
      // Story 36.13, AC11 / FR-50 — quand un détail existe, c'est LUI qui dit le statut : il
      // applique la règle « une séance confirmée rend le créneau indisponible, quelle que soit
      // la couche », que `computeDisplayStatus` ignore (il ne connaît que les déclarations).
      // Sans cela la Semaine contredirait le Mois et le rail sur le même jour — précisément ce
      // que `buildDayDetail()` existe pour empêcher. Hors séance, les deux valeurs coïncident,
      // le détail étant calculé sur les mêmes déclarations.
      const finalStatus = detail ? detail.status : status;

      // Revue de code (36.13) — même défaut que celui déjà corrigé pour `status` : `preview`
      // dérivait de `computeDisplayStatus`, aveugle aux séances, et pouvait afficher « disponible »
      // par-dessus une case verrouillée par une séance pendant une saisie. `previewDetails` est
      // construit par le MÊME point unique (`buildDayDetail`, via la déclaration en attente
      // ajoutée aux déclarations), donc `previewStatus` hérite de la même force de séance —
      // patron identique à `calendar-month-view.ts`.
      let preview: SlotStatus | null = null;
      if (pendingDecl) {
        const previewDayDetail = previewDetails?.get(cellKey) ?? null;
        const previewSlotDetail = previewDayDetail?.slots.find((s) => s.slot === slot) ?? null;
        const previewStatus = previewSlotDetail ? previewSlotDetail.status : finalStatus;
        if (previewStatus !== finalStatus) preview = previewStatus;
      }

      return {
        status: finalStatus,
        preview,
        declLabel: matchingDecl ? formatDeclLabel(matchingDecl, tone) : null,
        detail,
      };
    };

    return {
      date: cellLocal,
      label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(
        cellLocal,
      ),
      isToday: utcCell.getTime() === todayUtcMidnight,
      isPast: utcCell.getTime() < todayUtcMidnight,
      morning: computeSlot('MORNING'),
      afternoon: computeSlot('AFTERNOON'),
      evening: computeSlot('EVENING'),
    };
  });
}

interface PointerDownInfo {
  cell: WeekCell;
  slot: DaySlot;
  /** Story 36.7 — la `.slot-cell` d'origine, retenue pour servir d'ANCRE au sélecteur de
   *  réponse. Le tap de cette vue est synthétisé au `pointerup` sur la grille : sans cette
   *  référence, l'élément touché serait perdu au moment de l'ouverture. */
  element: HTMLElement | null;
  pointerId: number;
  pointerType: GesturePointerType;
  startX: number;
  startY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

import { GroupGauge } from '../group-gauge/group-gauge';
import { type GroupAvailability, groupAriaLabel } from '../group-availability.utils';
import { PollTrack } from '../poll-track/poll-track';
import {
  type VoteOptionActivatedEvent,
  type VoteParticipation,
  participationAriaLabel,
} from '../poll-track.utils';

@Component({
  selector: 'app-calendar-week-view',
  standalone: true,
  imports: [
    MatButtonModule,
    AppIcon,
    MatProgressSpinnerModule,
    SelectionBar,
    PollTrack,
    GroupGauge,
  ],
  templateUrl: './calendar-week-view.html',
  styleUrl: './calendar-week-view.scss',
})
export class CalendarWeekView {
  protected readonly theme = inject(ThemeToneService);

  readonly declarations = input<AvailabilityDeclarationDto[]>([]);
  readonly loading = input(false);
  readonly pendingDto = input<CreateAvailabilityDto | null>(null);
  readonly startDate = input<Date>(new Date());
  /** Story 36.13 — entrées du calendrier **non filtrées par couche** (`allCalendarEntries()`),
   *  exactement l'input que reçoit déjà la vue Mois. Les passer déjà filtrées ferait disparaître
   *  l'indisponibilité d'une séance en même temps que son titre, ce que FR-50 interdit (AC11). */
  readonly entries = input<AgendaEntry[]>([]);
  /** Couches actives : gouvernent ce qui est NOMMÉ dans la cellule, jamais l'indisponibilité. */
  readonly activeLayers = input<readonly CalendarLayerKey[]>([]);
  /** Story 44.8 — les parties masquées par le filtre du calendrier personnel (voir la vue Mois). */
  readonly hiddenPartieIds = input<ReadonlySet<string> | null>(null);
  /**
   * Story 36.9 — les jours que le mode Destinée met en avant (clés `YYYY-MM-DD`), ou `null` hors
   * mode. **Exactement l'ensemble que reçoit la vue Mois**, dérivé une seule fois par
   * `CalendarView` (AC12) : les deux grilles estompent les mêmes jours ou aucune ne le fait.
   */
  readonly destinyDates = input<ReadonlySet<string> | null>(null);

  /**
   * Story 36.10 — le mode de composition d'un vote (MJ). Mêmes entrées, même sémantique et même
   * point d'étranglement qu'en vue Mois : les deux grilles doivent se comporter à l'identique,
   * sans quoi le mode changerait de sens en changeant d'onglet.
   */
  readonly composing = input(false);
  /** Créneaux composés, en clés `YYYY-MM-DD|SLOT` (`composeCellKey`). `null` hors mode. */
  readonly composedKeys = input<ReadonlySet<string> | null>(null);
  /** Story 46.2 — la clé (`AAAA-MM-JJ|créneau`) de la fenêtre de l'automate sélectionnée (reçue, jamais dérivée ici). */
  readonly windowKey = input<string | null>(null);

  /** Story 36.15 — même double garde que `CalendarAgendaView.canSeal` (36.12) : être MJ ET être
   *  dans le calendrier d'une partie. `CalendarView` la calcule (`isMjMode() && partieId() !==
   *  null`), jamais cette vue — le calendrier personnel agrège plusieurs parties et ne sait
   *  d'aucune si l'utilisateur en est le MJ. */
  readonly canSeal = input(false);

  readonly slotSelected = output<SlotSelectedEvent>();
  /** Story 36.10, AC2 — un créneau vient d'être désigné ou retiré. */
  readonly composeToggled = output<SlotSelectedEvent>();
  /** Story 36.10, AC3 — `Échap` pendant la composition. */
  readonly composeCancelled = output<void>();
  /** ⚠️ Story 45.3 — la sélection (appui maintenu ou glissement) rejoint la composition : « Ajouter au vote ».
   *  La vue ne change JAMAIS les créneaux composés, elle les émet ; `CalendarView` en fait l'union. */
  readonly composeAdded = output<SelectedCell[]>();
  /** Story 45.3 — « Retirer » : ces créneaux quittent la composition. */
  readonly composeRemoved = output<SelectedCell[]>();
  /** Story 45.3 — la journée entière est-elle permise dans cette composition ? Faux pour une conjonction ou une
   *  soirée : la barre ne propose alors pas « Journée ». */
  readonly composeFullDay = input(true);
  /** ⚠️ Story 47.4 — bloc JUMEAU de `calendar-month-view.ts` : les créneaux couverts par les plages des départs
   *  désignés (départs exclus), reçus de `CalendarView`, et la durée composée (aperçu au survol). */
  readonly composeCoverKeys = input<ReadonlySet<string> | null>(null);
  readonly composeDuration = input(1);

  /** Story 47.4 — la cellule survolée à la souris pendant la composition (sa plage s'allume en aperçu). */
  private readonly hoverStart = signal<{ date: Date; slot: DaySlot } | null>(null);
  private readonly hoverKeys = computed<ReadonlySet<string>>(() => {
    const start = this.hoverStart();
    if (!start || !this.composing()) return new Set();
    return new Set([
      composeCellKey(start.date, start.slot),
      ...composeSpanKeys([start], this.composeDuration()),
    ]);
  });
  readonly displayDateChange = output<Date>();
  /** Story 30.3 : lot construit par un glissement (souris/tactile) ou une validation clavier —
   *  CalendarView construit les items et appelle createDeclarationBatch(), jamais cette vue. */
  readonly batchDeclareRequested = output<{ cells: SelectedCell[]; kind: AvailKind }>();
  /** Story 36.3, AC4 — « Autre… » de la barre. Depuis cette story, c'est le **seul** chemin vers
   *  `ConstraintPanel`, donc vers la contrainte récurrente (story 1.7), la modification, la
   *  suppression et la découpe. Le tap n'ouvre plus le panneau. */
  readonly declarationPanelRequested = output<SlotSelectedEvent>();
  /** Story 36.7 — une cellule portant une option de vote vient d'être activée. Même contrat que
   *  la vue Mois : la vue signale, `CalendarView` ouvre le sélecteur. */
  readonly voteOptionActivated = output<VoteOptionActivatedEvent>();
  /** Story 36.15, AC5/AC6 — réémis tel quel depuis `<app-selection-bar>`, vers
   *  `CalendarView.onSealRequested()` (confirmation + écriture, 36.12). Aucune logique ici. */
  readonly sealRequested = output<AgendaSealRequest>();

  protected readonly displayWeekStart = signal<Date>(getWeekStart(new Date()));

  private readonly pendingDecl = computed<AvailabilityDeclarationDto | null>(() => {
    const dto = this.pendingDto();
    return dto ? toFakeDecl(dto) : null;
  });

  /** Story 36.13, AC7 — UNE seule projection par semaine rendue, au-dessus de `buildDayDetail()`.
   *  Ni la préséance, ni la couverture `FULL_DAY`, ni la règle « la couche gouverne le texte » ne
   *  sont réécrites ici : elles vivent dans `day-detail.utils.ts` et nulle part ailleurs. */
  private readonly weekDetails = computed<Map<string, DayDetail>>(() =>
    buildMonthDetails(
      weekDateKeys(this.displayWeekStart()),
      this.entries(),
      this.activeLayers(),
      this.declarations(),
      new Date(),
      this.hiddenPartieIds(),
    ),
  );

  /** Revue de code (36.13) — même patron que `calendar-month-view.ts` (`previewDetails`) :
   *  une seconde projection, avec la déclaration en attente ajoutée, pour que `preview` hérite
   *  lui aussi de la force de séance de `buildDayDetail()` (FR-50). Calculée seulement quand une
   *  saisie est en cours — pas de second passage au repos. */
  private readonly weekPreviewDetails = computed<Map<string, DayDetail> | null>(() => {
    const pending = this.pendingDecl();
    if (!pending) return null;
    return buildMonthDetails(
      weekDateKeys(this.displayWeekStart()),
      this.entries(),
      this.activeLayers(),
      [...this.declarations(), pending],
      new Date(),
      this.hiddenPartieIds(),
    );
  });

  protected readonly cells = computed(() =>
    buildWeek(
      this.displayWeekStart(),
      this.declarations(),
      this.pendingDecl(),
      this.theme.tone(),
      this.weekDetails(),
      this.weekPreviewDetails(),
    ),
  );

  protected readonly weekLabel = computed(() => {
    const ws = this.displayWeekStart();
    // Dates locales construites depuis les composantes UTC pour l'affichage.
    const start = new Date(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate());
    const end = new Date(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() + 6);
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
    const fmtYear = (d: Date) =>
      new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        d,
      );
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${fmtYear(end)}`
      : `${fmt(start)} – ${fmtYear(end)}`;
  });

  protected readonly isCurrentWeek = computed(() => {
    const ws = this.displayWeekStart();
    const curr = getWeekStart(new Date());
    return ws.getTime() === curr.getTime();
  });

  protected readonly SLOT_ROWS: {
    key: 'morning' | 'afternoon' | 'evening';
    label: string;
    slot: DaySlot;
  }[] = [
    { key: 'morning', label: 'Matin', slot: 'MORNING' },
    { key: 'afternoon', label: 'Après-midi', slot: 'AFTERNOON' },
    { key: 'evening', label: 'Soir', slot: 'EVENING' },
  ];

  // ─── Sélection par glissement (Story 30.3) ─────────────────────────────────
  private pointerDown: PointerDownInfo | null = null;
  /** Un geste armé se termine par un `click` que le navigateur émet spontanément : il doit être
   *  avalé, sans quoi il rebasculerait la cellule qui vient d'être sélectionnée. */
  private suppressNextClick = false;
  protected readonly dragArmed = signal(false);
  protected readonly selectionAnchor = signal<SelectedCell | null>(null);
  protected readonly selectionCurrent = signal<SelectedCell | null>(null);

  /** Portée courante (AC2) : **dérivée** de la sélection, non plus imposée à elle. Elle vaut le
   *  créneau commun quand tous les créneaux retenus s'accordent, `null` dès qu'ils divergent —
   *  ce que l'AC18 rend possible, la bascule se faisant cellule par cellule. */
  protected readonly scope = computed<DaySlot | null>(() => {
    const cells = this.selectedCells();
    if (cells.length === 0) return null;
    const first = cells[0].slot;
    return cells.every((c) => c.slot === first) ? first : null;
  });
  /** Ce que `Entrée` valide (AC6). Défaut `UNAVAILABLE`, désormais affiché par la barre. */
  protected readonly armedKind = signal<AvailKind>('UNAVAILABLE');

  /**
   * Story 36.15, AC1/AC2/AC3/AC4 — le candidat de scellement pour la sélection courante, ou
   * `null`. Toutes les gardes vivent ici, jamais dans `SelectionBar` (composant de rendu pur,
   * qui ne connaît pas `entries()`) : `canSeal()` (MJ + contexte de partie), sélection à UN SEUL
   * créneau, et une entrée `votes-en-cours` dont `date`/`slot` correspondent EXACTEMENT à ce
   * créneau (ces entrées ne portent que des votes `OPEN`, cf. `CalendarView.activePolls()`).
   */
  protected readonly sealCandidate = computed<AgendaSealRequest | null>(() => {
    if (!this.canSeal()) return null;
    const cells = this.selectedCells();
    if (cells.length !== 1) return null;
    const cell = cells[0];
    const dateKey = toDateKey(cell.date);
    // Revue de code (36.15) — deux votes OPEN de la même partie pourraient en théorie proposer
    // le même créneau exact : un `.find()` prendrait le premier silencieusement, au risque de
    // sceller le mauvais vote. `.filter()` + exiger EXACTEMENT une correspondance traite ce cas
    // comme AC2/AC4 traitent déjà l'absence de correspondance : aucun candidat, pas de bouton.
    const matches = this.entries().filter(
      (e) => e.type === 'votes-en-cours' && e.date === dateKey && e.slot === cell.slot,
    );
    if (matches.length !== 1) return null;
    const entry = matches[0];
    if (!entry.vote) return null;
    return {
      partieId: entry.vote.partieId,
      pollId: entry.vote.pollId,
      optionId: entry.vote.optionId,
      // Story 47.5 — une plage se scelle écrite de son début à sa fin.
      dateLabel: entrySpanShortLabel(entry) ?? CalendarWeekView.sealDateLabel(entry.date, entry.slot),
      pollLabel: entry.label,
    };
  });

  /** Même formatage que `CalendarAgendaView.optionLabel()` — le dialogue de confirmation doit
   *  nommer le créneau à l'identique, que le scellement parte de l'Agenda ou d'ici. */
  private static sealDateLabel(dateKey: string, slot?: DaySlot): string {
    const date = SEAL_DATE_FORMAT.format(dateKeyToLocalMidnight(dateKey));
    return slot && slot !== 'FULL_DAY' ? `${date}, ${SLOT_LABELS[slot].toLowerCase()}` : date;
  }
  /** AC16 — la cellule courante : la dernière cliquée. Un tap court ne déclare rien, mais il
   *  désigne — le rail en montre le détail, et la cellule doit le dire aussi. */
  protected readonly currentCell = signal<SelectedCell | null>(null);

  /** ⚠️ Story 36.3, AC17/AC18 — la sélection est un **ENSEMBLE DE CRÉNEAUX**, identique en vue
   *  Mois. Le glissement reste contraint à la ligne de l'ancre — c'est un geste continu sur une
   *  grille où la ligne EST le créneau — mais **le clic ne l'est pas** : en mode modification il
   *  ajoute ou retire n'importe quelle cellule, matin, après-midi ou soir confondus. */
  protected readonly selectedCells = signal<SelectedCell[]>([]);

  private static cellKey(cell: SelectedCell): string {
    return `${cell.date.getTime()}|${cell.slot}`;
  }

  private readonly selectedKeys = computed(
    () => new Set(this.selectedCells().map(CalendarWeekView.cellKey)),
  );

  /** Les jours touchés, dédoublonnés — sert au libellé de plage. */
  private readonly selectedDays = computed<Date[]>(() => {
    const seen = new Map<number, Date>();
    for (const c of this.selectedCells()) seen.set(c.date.getTime(), c.date);
    return [...seen.values()].sort((a, b) => a.getTime() - b.getTime());
  });

  /** Écrit la plage ancre → cible, sur la ligne de l'ancre. Un glissement **remplace**. */
  private setRange(current: SelectedCell): void {
    const anchor = this.selectionAnchor();
    if (!anchor) return;
    this.selectionCurrent.set(current);
    this.selectedCells.set(weekRangeCells(anchor, current, this.cells()));
  }

  /** AC17/AC18 — bascule **un créneau**. Retirer le dernier **quitte le mode modification**. */
  private toggleCell(date: Date, slot: DaySlot): void {
    const key = CalendarWeekView.cellKey({ date, slot });
    const cells = this.selectedCells();
    const without = cells.filter((c) => CalendarWeekView.cellKey(c) !== key);
    if (without.length !== cells.length) {
      this.selectedCells.set(without);
      if (without.length === 0) {
        this.selectionAnchor.set(null);
        this.selectionCurrent.set(null);
      }
      return;
    }
    this.selectedCells.set(
      [...cells, { date, slot }].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    this.selectionAnchor.set({ date, slot });
    this.selectionCurrent.set({ date, slot });
  }

  /** AC2 — la portée s'applique à **toute** la sélection : elle réécrit le créneau de chaque jour
   *  retenu. C'est une ACTION, pas un filtre — un clic peut ensuite affiner cellule par cellule. */
  protected onScopeChange(slot: DaySlot): void {
    this.selectedCells.set(this.selectedDays().map((date) => ({ date, slot })));
  }

  protected readonly selectionRangeLabel = computed<string | null>(() => {
    const cells = this.selectedCells();
    if (cells.length === 0) return null;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(d);
    const scope = this.scope();
    const slotLabel =
      scope === null
        ? this.theme.tone()['common.creneaux_varies']
        : scope === 'FULL_DAY'
          ? 'journée'
          : (this.SLOT_ROWS.find((r) => r.slot === scope)?.label ?? '');
    const days = this.selectedDays();
    if (days.length === 1) return `${fmt(days[0])}, ${slotLabel}`;
    return `${fmt(days[0])} → ${fmt(days[days.length - 1])}, ${slotLabel}`;
  });

  constructor() {
    // Story 45.3 — bloc JUMEAU de la vue Mois : la sélection ne survit pas à l'entrée ni à la sortie du composer.
    effect(() => {
      this.composing();
      untracked(() => this.onSelectionCancelled());
    });
    effect(() => {
      const d = this.startDate();
      untracked(() => this.displayWeekStart.set(getWeekStart(d)));
    });
  }

  prevWeek(): void {
    const ws = this.displayWeekStart();
    const next = new Date(Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() - 7));
    this.displayWeekStart.set(next);
    this.displayDateChange.emit(next);
  }

  nextWeek(): void {
    const ws = this.displayWeekStart();
    const next = new Date(Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() + 7));
    this.displayWeekStart.set(next);
    this.displayDateChange.emit(next);
  }

  goToToday(): void {
    const today = getWeekStart(new Date());
    this.displayWeekStart.set(today);
    this.displayDateChange.emit(today);
  }

  /**
   * Le tap — **point d'entrée unique**, comme en vue Mois. Cette vue n'a aucun `(click)` : le tap
   * est synthétisé par `onGridPointerUp()` quand le geste n'a pas armé.
   *
   * Story 36.7 — ordre d'arbitrage identique à celui de la vue Mois (voir son `onCellClick`) :
   * le rail suit toujours, une sélection ouverte garde le tap, et seule une cellule portant une
   * option de vote au rang gagnant ouvre le sélecteur.
   */
  protected onCellClick(date: Date, slot: DaySlot, anchor?: HTMLElement | null): void {
    const now = new Date();
    // cellLocal est construit depuis les composantes UTC → getFullYear/Month/Date() == composantes UTC.
    const cellUtcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (cellUtcMidnight < todayUtcMidnight) return;
    // ⚠️ Story 36.3, AC15 — un tap court est un geste de LECTURE : il désigne le créneau, le rail
    // suit (AC2 de 36.1), et rien d'autre ne s'ouvre. La barre appartient à l'appui maintenu et
    // au glissement.
    this.slotSelected.emit({ date, slot });
    this.currentCell.set({ date, slot });
    // 🚨 Story 36.10, AC2/AC12 — le mode de composition réassigne le tap, ICI, avant tout le
    // reste. Le rail a déjà suivi juste au-dessus (principe 2) ; sélection et sélecteur de
    // réponse sont neutralisés.
    // Un geste armé se termine par un `click` spontané du navigateur : l'avaler, sinon il
    // rebasculerait la cellule qu'on vient de sélectionner (même garde qu'en vue Mois).
    // ⚠️ Story 45.3 — avalé AVANT la composition (bloc JUMEAU de la vue Mois).
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.composing()) {
      if (this.selectedCells().length > 0) this.toggleCell(date, slot);
      else this.composeToggled.emit({ date, slot });
      return;
    }
    // AC17/AC18 — une fois la barre ouverte, le même clic BASCULE le créneau touché, quelle que
    // soit sa ligne : la contrainte de ligne droite est celle du GLISSEMENT, pas du clic.
    if (this.selectedCells().length > 0) {
      this.toggleCell(date, slot);
      return;
    }
    // Story 36.7, AC1 — même condition que celle qui fait rendre la piste (`eventVote`), donc
    // couche éteinte et séance gagnante excluent l'ouverture sans condition supplémentaire.
    // La ligne de la grille Semaine EST un créneau : `SLOT_ROWS` fait déjà la correspondance,
    // on ne pose pas une seconde table. `FULL_DAY` n'y figure pas et ne porte donc jamais de vote.
    const cell = this.cells().find((c) => c.date.getTime() === date.getTime());
    const key = this.SLOT_ROWS.find((r) => r.slot === slot)?.key;
    const slotData = cell && key ? this.getSlotData(cell, key) : null;
    const vote = slotData ? this.eventVote(slotData) : null;
    if (vote && anchor) {
      // Story 47.5 — toutes les plages du vote qui couvrent ce créneau : une ligne chacune dans le sélecteur.
      this.voteOptionActivated.emit({ vote, lines: this.eventVotes(slotData!), date, slot, anchor });
    }
  }

  /** Sélection d'une seule cellule, armée au clavier (AC7, AC15). La portée part du créneau visé
   *  — la ligne de la grille Semaine EST un créneau. */
  private armSelection(date: Date, slot: DaySlot): void {
    // ⚠️ Story 45.3 — la garde de la 36.10 (AC12) tombe pour l'appui maintenu et le glissement : en composition ils
    // sélectionnent des jours, que la barre verse au vote. Le clavier, lui, compose directement AVANT d'arriver ici
    // (`onCellKeySelect`), et `Maj`+flèches reste inerte pendant la composition (`onShiftArrow`).
    this.selectionAnchor.set({ date, slot });
    this.selectionCurrent.set({ date, slot });
    this.selectedCells.set([{ date, slot }]);
  }

  /** Équivalent clavier de l'appui maintenu (AC15) : une frappe délibérée sur `Espace` **est**
   *  l'intention de déclarer, elle arme donc directement. Le rail suit aussi. */
  protected onCellKeySelect(cell: WeekCell, slot: DaySlot): void {
    if (cell.isPast) return;
    this.slotSelected.emit({ date: cell.date, slot });
    // Story 36.10, AC2/AC16 — parité clavier : en composition, désigner ajoute ou retire.
    if (this.composing()) {
      this.composeToggled.emit({ date: cell.date, slot });
      return;
    }
    this.armSelection(cell.date, slot);
  }

  protected getSlotData(cell: WeekCell, key: 'morning' | 'afternoon' | 'evening'): SlotData {
    return cell[key];
  }

  /** Story 36.13 — le doublon local a été retiré au profit du point unique de `day-detail.utils`,
   *  qui portait déjà exactement la même convention. */
  protected dateKey(date: Date): string {
    return toDateKey(date);
  }

  /**
   * Story 36.13, AC3/AC4/AC10 — ce que la cellule NOMME, gouverné par le RANG GAGNANT.
   *
   * Même règle qu'en vue Mois (`calendar-month-view.ts`) : le texte suit `winner`, jamais un `??`
   * opportuniste entre `seanceLabel` et `pollLabel` — la story 36.2 a déjà corrigé une fuite de
   * texte inter-rangs de cette forme.
   */
  protected eventTitle(slotData: SlotData): string | null {
    const d = slotData.detail;
    if (!d) return null;
    const title =
      d.winner === 'seance' ? d.seanceLabel : d.winner === 'vote' ? d.pollLabel : null;
    // Story 47.3 : une plage n'est NOMMÉE que sur sa première cellule visible de la semaine, avec « ← » quand
    // cette cellule n'est pas son début ; les autres cellules couvertes restent marquées mais sans texte.
    const span = d.span;
    if (title && span) {
      if (span.index !== this.firstSpanIndex().get(span.key)) return null;
      return span.index > span.startIndex ? `← ${title}` : title;
    }
    return title;
  }

  /** Story 47.3 — pour chaque plage de la semaine affichée, le rang linéaire de sa première cellule visible
   *  (ordre de lecture : jour après jour, matin → soir = ordre croissant des rangs). */
  private readonly firstSpanIndex = computed<Map<string, number>>(() => {
    const first = new Map<string, number>();
    for (const cell of this.cells()) {
      for (const slot of [cell.morning, cell.afternoon, cell.evening]) {
        const span = slot.detail?.span;
        if (!span) continue;
        const seen = first.get(span.key);
        if (seen === undefined || span.index < seen) first.set(span.key, span.index);
      }
    }
    return first;
  });

  /** Story 47.3 — classes de connecteur d'une cellule : la plage continue après le soir / vient de la veille. */
  protected spanNext(slotData: SlotData): boolean {
    return slotData.detail?.span?.continuesAfter ?? false;
  }

  protected spanPrev(slotData: SlotData): boolean {
    return slotData.detail?.span?.continuesBefore ?? false;
  }

  /** AC4/AC7 — les informations pratiques, composées par le POINT UNIQUE. Niveau `compact` : la
   *  cellule large tient deux champs (heure puis lieu), la note cède la première. */
  protected eventInfo(slotData: SlotData): string {
    const d = slotData.detail;
    if (!d || d.winner !== 'seance') return '';
    return composeSeanceInfo(d, 'compact');
  }

  /**
   * Story 36.6, AC13 — le RANG que porte la cellule, exposé au CSS.
   *
   * Même convention que la case du Mois (`[attr.data-winner]` sur `.band`) : jamais un second
   * schéma de classes pour dire la même chose. C'est ce qui permet à la cellule de **se
   * signaler** — liseré de vote, filet de séance — au lieu de se contenter de se nommer, ce que
   * la doctrine P-1 exige (une information ne repose jamais sur le seul texte).
   */
  protected cellWinner(slotData: SlotData): string | null {
    return slotData.detail?.winner ?? null;
  }

  /** Story 36.6 — la participation, portée par le rang GAGNANT comme le titre. Un créneau dont
   *  la séance l'emporte ne montre pas la piste d'un vote concurrent (encadré n°8). */
  protected eventVote(slotData: SlotData): VoteParticipation | null {
    const d = slotData.detail;
    if (!d || d.winner !== 'vote') return null;
    return d.pollVote;
  }

  /** Story 47.5 — toutes les options du vote qui couvrent la cellule (rang GAGNANT « vote » seulement). */
  protected eventVotes(slotData: SlotData): SlotPollVote[] {
    const d = slotData.detail;
    return d && d.winner === 'vote' ? d.pollVotes : [];
  }

  /** Story 47.5 — « ×n » : combien de plages du vote recouvrent la cellule (0 hors rang « vote »). */
  protected eventOverlap(slotData: SlotData): number {
    const d = slotData.detail;
    return d && d.winner === 'vote' ? d.pollCount : 0;
  }

  protected overlapMark(n: number): string {
    return overlapMarkLabel(n);
  }

  /**
   * Story 36.8 — la disponibilité du groupe, sur un **canal séparé** (FR-53).
   *
   * 🚨 **Aucune garde `winner` ici**, contrairement à `eventTitle()`, `eventInfo()` et
   * `eventVote()` juste au-dessus. Le fond de la cellule dit *ma* situation, ce canal dit celle
   * du groupe : il reste visible **sous** une séance comme sous un vote (AC2). Copier la garde
   * des trois voisins — le geste le plus naturel en lisant ce bloc — rendrait la couche invisible
   * exactement dans les cas qui la justifient.
   */
  protected eventGroup(slotData: SlotData): GroupAvailability | null {
    return slotData.detail?.group ?? null;
  }

  protected cellAriaLabel(
    cell: WeekCell,
    slotData: SlotData,
    slotName: string,
    slot?: DaySlot,
  ): string {
    const tone = this.theme.tone();
    const labels: Record<SlotStatus, string> = {
      AVAILABLE: tone['calendar.week_status_available'],
      UNAVAILABLE: tone['calendar.week_status_unavailable'],
      UNKNOWN: tone['calendar.week_status_unknown'],
    };
    const status = slotData.preview ?? slotData.status;
    const fullDate = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(cell.date);
    // AC12 — ce que le CSS tronque visuellement n'est JAMAIS tronqué ici. Les informations
    // pratiques sont annoncées au niveau `full`, pas au niveau `compact` de la cellule : c'est le
    // défaut exact relevé en revue de code de la story 36.5 sur le rail (`openLabel()`).
    const d = slotData.detail;
    // Story 47.3 : toute cellule d'une plage dit le rendez-vous ET sa plage entière, même quand son texte
    // visible est tu (nom une fois par semaine) — le connecteur et la flèche ne se lisent pas à l'oreille.
    const title = d?.span ? `${d.span.label}, ${d.span.range}` : this.eventTitle(slotData);
    const info = d && d.winner === 'seance' ? composeSeanceInfo(d, 'full') : '';
    const parts = [`${slotName}, ${fullDate} : ${labels[status]}`];
    if (title) parts.push(title);
    if (info) parts.push(info);
    // Story 36.6, AC14 — la piste code par la PROPORTION : elle n'existe pour un lecteur d'écran
    // que si le nom accessible la dit. Même garde `winner` que `eventInfo()`.
    const participation = this.eventVote(slotData);
    if (participation) parts.push(participationAriaLabel(participation, tone));
    // Story 47.5 — plusieurs plages du vote sur ce créneau : « ×n » se dit aussi (la marque est visuelle).
    const overlap = this.eventOverlap(slotData);
    if (overlap >= 2) parts.push(overlapAriaLabel(overlap));
    // Story 36.8, AC15 — 🚨 `.slot-cell` porte son propre `aria-label`, qui ÉCRASE le nom
    // accessible de `<app-group-gauge>` qu'elle contient désormais. Sans ce repli, le canal
    // serait purement visuel en vue Semaine — même régression que celle corrigée en revue de la
    // 36.7 pour la piste dans le rail.
    const groupe = this.eventGroup(slotData);
    if (groupe) parts.push(groupAriaLabel(groupe, tone));
    // Story 36.10, AC16 — l'état composé est annoncé, comme en vue Mois. Le créneau TYPÉ est
    // passé par le gabarit (`row.slot`) plutôt que redéduit du libellé : `slotName` est du texte
    // d'affichage, s'en servir de clé le rendrait intraduisible.
    if (slot && this.isCellComposed(cell, slot)) parts.push(tone['common.designe_pour_le_vote']);
    if (slot && this.isCellWindow(cell, slot)) parts.push(tone['calendar.window_selected_aria']);
    return parts.join(' — ');
  }

  /** Story 46.2 — cette cellule est-elle la fenêtre de l'automate sélectionnée ? */
  protected isCellWindow(cell: WeekCell, slot: DaySlot): boolean {
    return this.windowKey() === composeCellKey(cell.date, slot);
  }

  /** Story 36.10, AC13 — ce créneau fait-il partie de la composition en cours ? */
  protected isCellComposed(cell: WeekCell, slot: DaySlot): boolean {
    return this.composedKeys()?.has(composeCellKey(cell.date, slot)) ?? false;
  }

  /** ⚠️ Story 47.4 — bloc JUMEAU de `CalendarMonthView.isBandSpanPreview` : la cellule est couverte par la plage d'un
   *  départ désigné, ou par celle qu'ouvrirait la cellule survolée. Rien à 1 créneau. */
  protected isCellSpanPreview(cell: WeekCell, slot: DaySlot): boolean {
    if (this.composeDuration() <= 1 || this.isCellComposed(cell, slot)) return false;
    const key = composeCellKey(cell.date, slot);
    return (this.composeCoverKeys()?.has(key) ?? false) || this.hoverKeys().has(key);
  }

  /** Story 47.4 — survol d'une cellule pendant la composition (`null` : la souris la quitte). Souris seulement : au
   *  doigt, l'entrée émulée après un tap n'a pas de sortie et laisserait une plage allumée. */
  protected onCellHover(event: PointerEvent, cell: WeekCell | null, slot?: DaySlot): void {
    if (event.pointerType !== 'mouse') return;
    if (!cell || !slot || cell.isPast || !this.composing() || this.composeDuration() <= 1) {
      if (this.hoverStart() !== null) this.hoverStart.set(null);
      return;
    }
    this.hoverStart.set({ date: cell.date, slot });
  }

  /** AC2/AC3 — le marquage suit la **portée** : passer la portée à « journée » doit allumer les
   *  trois lignes des jours retenus, passer au « soir » ne doit allumer que celle-là. */
  protected isCellSelected(cell: WeekCell, slot: DaySlot): boolean {
    const keys = this.selectedKeys();
    const time = cell.date.getTime();
    return keys.has(`${time}|${slot}`) || keys.has(`${time}|FULL_DAY`);
  }

  /**
   * Story 36.9, AC1/AC8 — la colonne du jour s'estompe-t-elle ?
   *
   * 🚨 **L'unité est le JOUR, pas le créneau** — la même qu'en vue Mois, où la planche estompe la
   * case entière. Un jour à moitié estompé se lirait comme deux jours ; et deux règles cohérentes
   * par accident valent moins qu'une seule règle appliquée aux deux grilles.
   *
   * AC8 : une sélection ou un aperçu **n'importe où** dans la journée relève toute la colonne —
   * sans quoi glisser sur des jours hors du vote courant ferait disparaître sa propre sélection.
   * Le focus clavier est traité en CSS (`:not(:focus-within)`).
   */
  /** 🚨 Règle jumelle de `destinyInView` en vue Mois, trouvée à la vérification visuelle : une
   *  semaine sans aucune date du vote courant s'estompait entièrement, sans rien mettre en avant.
   *  **Un mode qui estomperait tout n'estompe rien.** */
  private readonly destinyInView = computed(() => {
    const dates = this.destinyDates();
    return dates !== null && this.cells().some((c) => dates.has(this.dateKey(c.date)));
  });

  protected isDayDimmed(cell: WeekCell): boolean {
    const dates = this.destinyDates();
    if (dates === null || !this.destinyInView()) return false;
    if (dates.has(this.dateKey(cell.date))) return false;
    return !this.SLOT_ROWS.some(
      (r) => this.isCellSelected(cell, r.slot) || this.getSlotData(cell, r.key).preview !== null,
    );
  }

  /** Story 36.3, AC16 — la cellule courante : la dernière cliquée, celle dont le rail montre le
   *  détail. Distinct de `.selected`, qui dit « ce créneau partira à l'écriture ». */
  protected isCurrentCell(cell: WeekCell, slot: DaySlot): boolean {
    const current = this.currentCell();
    if (current === null) return false;
    return current.date.getTime() === cell.date.getTime() && current.slot === slot;
  }

  /** true pendant qu'un pointeur est actuellement enfoncé sur la grille — utilisé pour ne bloquer
   *  le menu contextuel natif (clic droit) que pendant un geste, pas en permanence. */
  protected isGestureActive(): boolean {
    return this.pointerDown !== null;
  }

  // ─── Geste souris/tactile ───────────────────────────────────────────────
  protected onCellPointerDown(event: PointerEvent, cell: WeekCell, slot: DaySlot): void {
    if (cell.isPast) return;
    // Seul le bouton principal peut amorcer un geste (clic droit/milieu = menu contextuel/autre).
    if (event.button !== 0) return;
    // Un geste est déjà en cours pour un autre pointeur (deuxième doigt, paume) : on l'ignore
    // plutôt que de remplacer silencieusement l'état du premier.
    if (this.pointerDown && this.pointerDown.pointerId !== event.pointerId) return;
    this.clearPointerState();
    this.suppressNextClick = false;
    this.dragArmed.set(false);
    this.pointerDown = {
      cell,
      slot,
      // Story 36.7 — l'ancre du sélecteur : la `.slot-cell` telle qu'elle existe déjà. Aucun
      // nœud n'est ajouté pour la porter (le hit-test du glissement remonte par `closest`).
      element: event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
      pointerId: event.pointerId,
      pointerType: event.pointerType as GesturePointerType,
      startX: event.clientX,
      startY: event.clientY,
      // ⚠️ Story 36.3, AC15 — l'appui maintenu arme la barre **pour tous les pointeurs**, souris
      // comprise : c'est lui qui sépare lire (tap court) de déclarer (appui long).
      longPressTimer: setTimeout(() => this.armDrag(cell, slot), LONG_PRESS_MS),
    };
  }

  protected onGridPointerMove(event: PointerEvent): void {
    const down = this.pointerDown;
    if (!down || down.pointerId !== event.pointerId) return;
    const dx = event.clientX - down.startX;
    const dy = event.clientY - down.startY;
    const moved = Math.hypot(dx, dy) > MOVE_THRESHOLD_PX;

    if (!this.dragArmed()) {
      if (down.pointerType === 'touch') {
        // Appui maintenu requis (AC4) : un déplacement avant l'expiration du délai laisse le
        // défilement natif se produire, on n'appelle pas preventDefault().
        if (moved) {
          this.cancelLongPressTimer();
          this.pointerDown = null;
        }
        return;
      }
      if (!moved) return;
      this.armDrag(down.cell, down.slot);
    }

    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-cell-date]');
    if (!target) return;
    const dateMs = Number(target.dataset['cellDate']);
    const cellMatch = this.cells().find((c) => c.date.getTime() === dateMs);
    if (!cellMatch || cellMatch.isPast) return;
    const anchor = this.selectionAnchor();
    if (!anchor) return;
    this.setRange({ date: cellMatch.date, slot: anchor.slot });
  }

  protected onGridPointerUp(event: PointerEvent): void {
    const down = this.pointerDown;
    if (!down || down.pointerId !== event.pointerId) return;
    const wasArmed = this.dragArmed();
    this.cancelLongPressTimer();
    this.pointerDown = null;
    if (!wasArmed) {
      // Relâché sans déplacement ni appui maintenu écoulé → tap normal (AC3, AC9).
      if (down) this.onCellClick(down.cell.date, down.slot, down.element);
      return;
    }
    this.dragArmed.set(false);
    // Le geste a armé : le `click` qui suit ce `pointerup` ne doit pas être pris pour une bascule.
    this.suppressNextClick = true;
    // La sélection reste affichée (anchor/current conservés) — la barre reste visible
    // jusqu'à validation ou annulation par l'utilisateur.
  }

  private armDrag(cell: WeekCell, slot: DaySlot): void {
    // Le glissement souris peut armer avant l'échéance de l'appui maintenu : sans cette
    // annulation, le minuteur rejouerait armDrag() et ramènerait l'ancre à la cellule de départ.
    this.cancelLongPressTimer();
    this.dragArmed.set(true);
    this.armSelection(cell.date, slot);
  }

  private cancelLongPressTimer(): void {
    if (this.pointerDown?.longPressTimer) clearTimeout(this.pointerDown.longPressTimer);
  }

  private clearPointerState(): void {
    this.cancelLongPressTimer();
    this.pointerDown = null;
  }

  // ─── Clavier ─────────────────────────────────────────────────────────────
  /** Story 36.3, AC6/AC7 — `Entrée` est **réservée à la validation**, et valide ce que la barre
   *  affiche (`armedKind`) au lieu de « indisponible » d'office. Hors sélection, elle ne fait
   *  plus rien : `Espace` garde la sélection.
   *  [Source: EXPERIENCE.md §6 bis — encadré de dette, ses deux points] */
  protected onCellEnterKey(): void {
    if (!this.selectionAnchor()) return;
    this.onSelectionCommit(this.armedKind());
  }

  protected onShiftArrow(cell: WeekCell, slot: DaySlot, direction: -1 | 1): void {
    // AC12 — ce chemin pose l'ancre lui-même, il lui faut donc sa propre garde.
    if (cell.isPast || this.composing()) return;
    const anchor = this.selectionAnchor() ?? { date: cell.date, slot };
    if (!this.selectionAnchor()) this.selectionAnchor.set(anchor);
    const cellsArr = this.cells();
    const currentSel = this.selectionCurrent() ?? anchor;
    const idx = cellsArr.findIndex((c) => c.date.getTime() === currentSel.date.getTime());
    const nextIdx = Math.min(Math.max(idx + direction, 0), cellsArr.length - 1);
    const nextCell = cellsArr[nextIdx];
    if (nextCell.isPast) return;
    this.setRange({ date: nextCell.date, slot: anchor.slot });
  }

  /** Story 36.10, AC3 — `Échap` : une seule signification à un instant donné. */
  protected onEscape(): void {
    if (this.composing()) {
      // Story 45.3 — une barre de sélection ouverte se ferme d'abord : `Échap` n'a qu'UN sens à la fois, celui de la
      // couche la plus proche. Sans barre, il quitte le composer.
      if (this.selectedCells().length > 0) {
        this.onSelectionCancelled();
        return;
      }
      this.composeCancelled.emit();
      return;
    }
    this.onSelectionCancelled();
  }

  protected onSelectionCancelled(): void {
    this.selectionAnchor.set(null);
    this.selectionCurrent.set(null);
    this.selectedCells.set([]);
    this.armedKind.set('UNAVAILABLE');
  }

  protected onArmedKindChange(kind: AvailKind): void {
    this.armedKind.set(kind);
  }

  /** AC4 — « Autre… » remet l'intention au panneau, avec la cellule d'ancrage et la portée
   *  courante, puis rend la main : la sélection a désigné la cible, le panneau gouverne la
   *  suite (récurrence, plage, suppression, découpe). */
  protected onOtherRequested(): void {
    // Le premier créneau RETENU, pas l'ancre : un changement de portée réécrit la sélection
    // sans toucher à l'ancre, qui porterait alors un créneau périmé.
    const target = this.selectedCells()[0] ?? this.selectionAnchor();
    if (!target) return;
    this.declarationPanelRequested.emit({ date: target.date, slot: target.slot });
    this.onSelectionCancelled();
  }

  /** ⚠️ Story 45.3 — « Ajouter au vote » : la sélection rejoint les créneaux composés (cumul, sans touche de
   *  modification), puis la barre se ferme. Rien n'est écrit : seul « Valider » écrit. */
  protected onComposeAdd(): void {
    const cells = this.selectedCells();
    if (cells.length === 0) return;
    this.composeAdded.emit(cells);
    this.onSelectionCancelled();
  }

  /** Story 45.3 — « Retirer » : ces créneaux quittent la composition. */
  protected onComposeRemove(): void {
    const cells = this.selectedCells();
    if (cells.length === 0) return;
    this.composeRemoved.emit(cells);
    this.onSelectionCancelled();
  }

  protected onSelectionCommit(kind: AvailKind): void {
    const cells = this.selectedCells();
    if (cells.length === 0) return;
    this.batchDeclareRequested.emit({ cells, kind });
    this.onSelectionCancelled();
  }
}
