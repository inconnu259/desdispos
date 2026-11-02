import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Location } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  AggregatedSlotDto,
  AvailKind,
  AvailabilityDeclarationDto,
  AvailableSlotDto,
  CalendarLayerKey,
  CreateAvailabilityBatchItem,
  CreateAvailabilityDto,
  DaySlot,
  EventCardDto,
  EventPollDto,
  EventPollOptionInput,
  EventSlot,
  MeCalendarDto,
  OpenPollEntry,
  PartieMemberDto,
  ScenarioDto,
  SeanceDto,
  SessionPollDto,
  UpdateEventDto,
  VoteAnswer,
} from '@master-jdr/shared';
import {
  CALENDAR_LAYER_KEYS,
  DEFAULT_CALENDAR_LAYER_KEYS,
  atelierUrl,
  defaultPollDeadline,
  bestOption,
  destinyEntryOption,
  familyOf,
  hasAnswered,
  isPartieActive,
  sortOptionsChronologically,
  spanEnd,
} from '@master-jdr/shared';
import {
  AvailabilityService,
  ConflictError,
} from '../../../core/availability/availability.service';
import { AppIcon } from '../../../core/icons/app-icon';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { DatableSeancesService } from '../../../core/poll/datable-seances.service';
import { OpenPollsService } from '../../../core/poll/open-polls.service';
import { PollService } from '../../../core/poll/poll.service';
import { getMissingVoters } from '../../../core/poll/poll.util';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import {
  CalendarSessionLayersService,
  calendarSessionKey,
} from '../calendar-session-layers.service';
import { CalendarDisplayPanel } from '../calendar-display-panel/calendar-display-panel';
import { CalendarLegend } from '../calendar-legend/calendar-legend';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService, partieTopic, userTopic } from '../../../core/realtime/realtime.service';
import { CalendarMonthView, SlotSelectedEvent } from '../calendar-month-view/calendar-month-view';
import { CalendarWeekView, getWeekStart } from '../calendar-week-view/calendar-week-view';
import {
  CalendarAgendaView,
  type AgendaEntry,
  type AgendaSealRequest,
} from '../calendar-agenda-view/calendar-agenda-view';
import { SealConfirmDialog, type SealSlotsData } from '../seal-confirm-dialog/seal-confirm-dialog';
import { CalendarDetailRail } from '../calendar-detail-rail/calendar-detail-rail';
import {
  type RailTarget,
  buildDayDetail,
  dateKeyToLocalMidnight,
  entryCoveredDays,
  entryCoversCell,
  entryPartieId,
  nextMeaningfulDate,
  toDateKey,
} from '../day-detail.utils';
import { CalendarLayerToggle } from '../calendar-layer-toggle/calendar-layer-toggle';
import { DestinyControl, type DestinyPollRef } from '../destiny-control/destiny-control';
import { DestinyList, type DestinyListItem, type DestinyState } from '../destiny-list/destiny-list';
import { RendezvousPicker } from '../rendezvous-picker/rendezvous-picker';
import {
  groupRendezvous,
  jdrRendezvous,
  jdrComposable,
  rowFromEntry,
  type RendezvousRow,
  type RendezvousTitle,
} from '../rendezvous-picker/rendezvous.utils';
import { displayedWindows } from '../window-list.utils';
import { DestinySheet, type DestinySheetModel } from '../destiny-sheet/destiny-sheet';
import {
  DestinyBoard,
  type DestinyBoardAbsent,
  type DestinyBoardActions,
  type DestinyBoardModel,
} from '../destiny-board/destiny-board';
import { ConstraintPanel } from '../constraint-panel/constraint-panel';
import {
  ConflictDialog,
  type ConflictDialogData,
  type ConflictResolutionByIndex,
} from '../conflict-dialog/conflict-dialog';
import { type SelectedCell, buildBatchItems, composeCellKey } from '../selection.utils';
import { ComposeBar } from '../compose-bar/compose-bar';
import {
  ComposeConfirmDialog,
  type ComposeConfirmData,
} from '../compose-confirm-dialog/compose-confirm-dialog';
import { AvailableSlotsPanel, availableSlotKey } from '../available-slots/available-slots';
import { ColumnDockService } from '../side-dock/column-dock.service';
import { SideDock } from '../side-dock/side-dock';
import { VoteAnswerPicker } from '../vote-answer-picker/vote-answer-picker';
import type { VoteLine, VoteOptionActivatedEvent, VoteParticipation } from '../poll-track.utils';
import {
  ConjonctionDraftService,
  type ConjonctionDraft,
} from '../../events/conjonction-draft.service';
import { EventsApiService } from '../../events/events-api.service';
import { refusalMessage } from '../../events/refusal-message';
import { extendMinKeyFrom, rankedEntrySlots, shortDayLabel } from '../../events/event-card.util';
import { DateFixDialog, type DateFixData } from '../../events/date-fix-dialog/date-fix-dialog';
import {
  ExtendVoteDialog,
  type ExtendVoteData,
} from '../../events/extend-vote-dialog/extend-vote-dialog';
import { PollMissingPanel } from '../poll-missing/poll-missing';
import { worstAvailability } from '../group-availability.utils';
import { candidateSpanSentence, candidateSpanShort, isSpan } from '../span-label';
import { composeSpanKeys, earliestStart } from '../compose-span.utils';
import { composeLoss, type LossOption } from '../compose-loss.utils';
import {
  DURATION_TEXT,
  windowDurationRefusal,
  type SpanStart,
  worstAvailabilityLabel,
} from '../../../shared/duration-stepper/duration-labels';

/** Story 8.8, AC7/AC8 : un vote actif, étiqueté par son scénario (et sa séance si le scénario en a
 * plusieurs) — remplace le signal `activePoll` unique qui ne représentait qu'« un » poll par Partie. */
export interface ActivePollEntry {
  scenario: ScenarioDto;
  seance: SeanceDto;
  /** 1-based, position de la séance dans `scenario.seances` — même convention que SeanceList. */
  seanceIndex: number;
  poll: SessionPollDto;
}

/** Libellés des créneaux, pour NOMMER un créneau en conflit (Story 36.4, AC2) — le dialogue
 *  nomme, il ne compte pas. */
const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

/**
 * Story 36.7 — les positions du sélecteur, dans l'ordre de préférence.
 *
 * Sous la bande d'abord (le geste vient d'en haut), au-dessus si la place manque en bas — cas
 * réel et fréquent : la dernière ligne d'une grille de six semaines touche le bas de l'écran.
 * `cdkConnectedOverlayPush` rattrape ensuite les débordements latéraux.
 */
const PICKER_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Story 36.14 — les positions du panneau « Affichage » sur ordinateur.
 *
 * 🚨 Jeu DISTINCT de `PICKER_POSITIONS` : celui-ci est calé sur une bande de grille, qui peut
 * toucher le bas de l'écran ; le panneau, lui, pend d'un bouton en HAUT de page — la préférence
 * naturelle est donc « sous, aligné à gauche », et le repli au-dessus n'est qu'un filet de
 * sécurité pour les très petites hauteurs. Les réunir aurait donné au panneau les priorités du
 * sélecteur, pour la seule raison qu'un tableau existait déjà.
 */
const DISPLAY_PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];

/** Story 44.4 — « samedi 18 octobre » : la date que l'annonce du créneau courant dit en toutes lettres. */
const DESTINY_ANNOUNCE_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const CALENDAR_CELL_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

/** Story 36.10 — ce que la composition vise.
 *
 * 🚨 Un `pollId`, jamais un index (même raison qu'à la Destinée, story 36.9 encadré n°2) :
 * `activePolls()` est reconstruit à chaque rechargement temps réel, et un index désignerait
 * alors un AUTRE vote — donc écrirait les créneaux composés dans le mauvais. */
/** Ce que la composition de créneaux vise.
 *
 *  ⚠️ Story 45.2 — `seanceId` est REQUIS sur `'new'` : le rendez-vous se choisit AVANT le composer (« Proposer
 *  des dates », `?seanceId`, ligne d'Agenda), plus à la validation ; la fenêtre de confirmation n'a plus de
 *  sélecteur de séance. */
export type ComposeTarget =
  | { kind: 'poll'; pollId: string }
  | { kind: 'new'; seanceId: string }
  // Story 40.5b — les deux cibles d'un GROUPE : les créneaux du sondage d'une conjonction déjà
  // ouverte (par l'identifiant de la conjonction, jamais un index : la liste est rechargée en direct),
  // ou ceux d'une conjonction qui n'existe pas encore (aucun appel au serveur : le brouillon de la
  // fenêtre de création les reçoit au retour).
  | { kind: 'group-poll'; eventId: string }
  // Story 45.5 — les créneaux d'une soirée isolée encore SANS date ni vote : la composition CRÉE son sondage (écrit par
  // `PATCH …/events/:eventId`, 41.2). Distincte de « vote ouvert » (on le modifie) et de « nouvelle conjonction »
  // (rien n'existe, rien n'est écrit avant le retour à la fenêtre de création).
  | { kind: 'evening-poll'; eventId: string }
  | { kind: 'group-new' };

/** Story 40.5b — un sondage de dates de conjonction ouvert (statut `OPEN`, séance sans date). */
export interface GroupPollEntry {
  card: EventCardDto;
  poll: EventPollDto;
}

/** Story 40.5b — au moins deux créneaux pour un sondage ; aucun plafond métier (le serveur garde le sien). */
const GROUP_MIN_SLOTS = 2;

/** Story 8.8, AC9 : une séance sans vote encore lancé — sert désormais à rattacher un vote neuf
 *  composé sur la grille (Story 36.10, AC11). */
export interface EligibleSeanceEntry {
  scenario: ScenarioDto;
  seance: SeanceDto;
  seanceIndex: number;
}

/**
 * Story 47.3 — les champs de fin d'une entrée de séance : présents SEULEMENT pour une plage de plusieurs
 * créneaux (la fin diffère du début). Un créneau seul n'émet rien, donc ses entrées — et tous les tests qui
 * les comparent — restent exactement ce qu'elles étaient. `end` est une clé `YYYY-MM-DD` ou un ISO complet.
 */
function spanEndOf(
  startDate: string,
  startSlot: DaySlot | undefined,
  end: string | null | undefined,
  endSlot: DaySlot | null | undefined,
): { endDate?: string; endSlot?: DaySlot } {
  if (!end) return {};
  const endDate = end.substring(0, 10);
  if (!isSpan({ date: startDate.substring(0, 10), slot: startSlot }, { date: endDate, slot: endSlot })) {
    return {};
  }
  return { endDate, ...(endSlot ? { endSlot } : {}) };
}

/**
 * Story 47.4 — la fin d'une option de vote : chaque option est le DÉPART d'une plage de la durée du vote (`spanEnd`).
 * Une option d'un créneau (ou une journée entière) n'émet rien : ses entrées restent celles d'avant, et la projection
 * de la 47.3 dessine les plages candidates des autres.
 */
function optionSpanEnd(
  date: string,
  slot: DaySlot,
  durationSlots: number | undefined,
): { endDate?: string; endSlot?: DaySlot } {
  const n = durationSlots ?? 1;
  if (n <= 1 || slot === 'FULL_DAY') return {};
  const end = spanEnd(date.substring(0, 10), slot, n);
  return spanEndOf(date, slot, end.date, end.slot);
}

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  // Story 46.2 — `Échap` désélectionne la fenêtre de l'automate (document : le focus peut être n'importe où).
  host: { '(document:keydown.escape)': 'onWindowEscape()' },
  imports: [
    CalendarMonthView,
    CalendarWeekView,
    CalendarAgendaView,
    CalendarDetailRail,
    CalendarLayerToggle,
    DestinyControl,
    DestinyList,
    RendezvousPicker,
    DestinyBoard,
    DestinySheet,
    ComposeBar,
    ConstraintPanel,
    MatButtonToggleModule,
    MatButtonModule,
    AvailableSlotsPanel,
    SideDock,
    PollMissingPanel,
    VoteAnswerPicker,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkTrapFocus,
    CalendarDisplayPanel,
    CalendarLegend,
    AppIcon,
  ],
  templateUrl: './calendar-view.html',
  styleUrl: './calendar-view.scss',
})
export class CalendarView implements OnInit {
  readonly mode = input<'personal' | 'mj'>('personal');

  private readonly availabilitySvc = inject(AvailabilityService);
  private readonly authSvc = inject(AuthService);
  private readonly partiesSvc = inject(PartiesService);
  private readonly pollSvc = inject(PollService);
  private readonly openPollsSvc = inject(OpenPollsService);
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly scenariosSvc = inject(ScenariosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  protected readonly theme = inject(ThemeToneService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpointObserver = inject(BreakpointObserver);
  /** Story 46.1 — l'état « colonne rangée » (dock ≥ 768 px, liste repliée en dessous), retenu dans ce navigateur. */
  protected readonly dock = inject(ColumnDockService);
  private readonly sessionLayers = inject(CalendarSessionLayersService);
  // Story 40.5b — `EventsApiService` n'est résolu qu'à la demande (groupe seulement) : il tire HttpClient,
  // et le calendrier d'une quête ou du MJ n'a pas à en dépendre.
  private readonly injector = inject(Injector);
  private readonly drafts = inject(ConjonctionDraftService);

  /** Même seuil que `partie-detail` et `list-control-bar` — pas un troisième vocabulaire de
   *  largeur dans l'application. */
  private static readonly DESKTOP_QUERY = '(min-width: 1024px)';
  /** Story 44.4 — à partir de cette largeur la colonne de droite existe (côte à côte avec la grille) : c'est
   *  là que le plateau de la destinée la remplace. En dessous, le tiroir (story 44.5). */
  private static readonly WIDE_QUERY = '(min-width: 768px)';

  protected readonly declarations = signal<AvailabilityDeclarationDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /**
   * Story 36.11, AC6 — **l'Agenda est la vue par défaut sur mobile**, le Mois sur ordinateur
   * [Source: EXPERIENCE.md §9].
   *
   * 🚨 La largeur est lue **UNE SEULE FOIS**, ici, à l'initialisation. Aucun `effect()` ni
   * `toSignal()` réactif ne doit réassigner ce signal : un défaut n'est pas un verrou (AC15), et
   * une rotation d'écran ramènerait sinon l'utilisateur de force sur l'Agenda alors qu'il vient
   * de choisir le Mois. `isMatched()` est synchrone — évite un rendu mobile qui clignoterait en
   * desktop (même patron que `list-control-bar.ts`).
   */
  protected readonly view = signal<'month' | 'week' | 'agenda'>(
    this.breakpointObserver.isMatched(CalendarView.DESKTOP_QUERY) ? 'month' : 'agenda',
  );

  /**
   * Story 36.11 — le « maintenant » de l'écran, figé au montage.
   *
   * Une seule source pour toutes les surfaces : deux `new Date()` pourraient placer deux entrées
   * de part et d'autre d'une frontière de jour et leur donner des sections incohérentes. Figé
   * plutôt que réactif, comme `Dashboard.countdownNow` : un agenda qui se réorganiserait tout
   * seul à minuit coûterait un timer permanent pour un gain nul.
   */
  protected readonly todayKey = toDateKey(new Date());
  protected readonly sharedDate = signal<Date>(new Date());

  // ─── Couches du calendrier (Story 30.6, AC1/AC3/AC4/AC7, encadré n°2) ──────
  // Signal purement local, jamais persisté par la bascule elle-même — seul l'écran Compte (Story
  // 30.4) écrit `defaultCalendarLayers`. Initialisé au montage depuis le défaut du compte.
  protected readonly activeLayers = signal<CalendarLayerKey[]>([]);
  // Contenu de GET /me/calendar (contexte personnel uniquement, AC8/AC9) — jamais peuplé en
  // contexte de partie.
  protected readonly meCalendar = signal<MeCalendarDto | null>(null);
  protected readonly meCalendarLoading = signal(false);

  /**
   * Les couches dont la BARRE porte un interrupteur — 4 hors contexte de partie, 5 en contexte de
   * partie (`disponibilite-groupe` absente hors partie, AD-16/AC8 de la 30.6).
   *
   * ⚠️ Story 36.11, AC7 — `inscriptions-ouvertes` ne figure plus ici. Une séance à inscription
   * ouverte **n'a pas de date** : elle n'a aucune case où se poser, et l'interrupteur n'a jamais
   * rien produit à l'écran. Elle vit désormais dans une section de l'Agenda.
   *
   * 🚨 **La CLÉ, elle, reste** dans `CALENDAR_LAYER_KEYS` et dans la préférence de compte
   * [Source: prd.md:305]. La retirer de l'union ferait échouer la validation serveur
   * (`@IsIn(CALENDAR_LAYER_KEYS)`) de tout compte l'ayant déjà enregistrée — et l'écran Compte
   * continue de l'offrir. C'est l'interrupteur de la barre qui disparaît, pas la clé.
   */
  protected readonly availableLayerKeys = computed<CalendarLayerKey[]>(() =>
    CALENDAR_LAYER_KEYS.filter(
      (k) =>
        k !== 'inscriptions-ouvertes' &&
        // Story 40.5b — un groupe n'a pas de couche « disponibilité du groupe » (jamais d'agrégat nominatif).
        (this.partieId() && !this.isGroup() ? true : k !== 'disponibilite-groupe'),
    ),
  );

  private defaultLayersForContext(partieContext: boolean): CalendarLayerKey[] {
    const base = this.authSvc.currentUser()?.defaultCalendarLayers ?? DEFAULT_CALENDAR_LAYER_KEYS;
    return partieContext && !this.isGroup()
      ? base
      : base.filter((k) => k !== 'disponibilite-groupe');
  }

  /**
   * Story 36.14 — l'identité du calendrier dont on mémorise les couches pour la session.
   *
   * 🚨 **Dérivée du signal `partieId()`, jamais capturée au montage.** Les trois routes du
   * calendrier (`/profile/calendar`, `/parties/:id/calendar`, `/parties/:id/guild-calendar`)
   * montent le MÊME composant : Angular peut réutiliser l'instance sur un simple changement de
   * paramètre, sans la détruire. Une clé figée dans `ngOnInit` conserverait alors celle du
   * calendrier précédent, et l'AC10 (« l'ouverture d'un **autre** calendrier repart du défaut »)
   * serait faux en production tout en restant vert en test.
   * [Source: deferred-work.md:117 — le même piège, déjà constaté sur `fromDateStr`/`toDateStr`.]
   */
  private sessionKey(): string {
    return calendarSessionKey(this.partieId(), this.mode());
  }

  protected toggleLayer(key: CalendarLayerKey): void {
    this.activeLayers.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
    // AC9 — la bascule survit à un retour sur CE calendrier dans CETTE session. Toujours aucune
    // écriture réseau : le défaut de compte n'est touché que par l'écran Compte (AC15).
    this.sessionLayers.write(this.sessionKey(), this.activeLayers());
  }

  protected isLayerActive(key: CalendarLayerKey): boolean {
    return this.activeLayers().includes(key);
  }

  /** AC4/AC7 : comparaison d'ensemble complète (ajouts ET retraits), pas seulement les couches
   *  ajoutées — un retrait doit rester détecté (encadré n°2). */
  protected readonly layersOverridden = computed(() => {
    const current = this.activeLayers();
    const def = this.defaultLayersForContext(!!this.partieId());
    if (current.length !== def.length) return true;
    const defSet = new Set(def);
    return current.some((k) => !defSet.has(k));
  });

  // ─── Story 44.8 — filtrer mon calendrier personnel par partie ─────────────────────────────────
  //
  // Un SIGNAL DE LA PAGE : jamais dans `activeLayers` ni dans `CALENDAR_LAYER_KEYS` (persistés dans le compte, ils en
  // feraient un réglage durable), jamais dans la mémoire de session des couches, perdu au rechargement. Il s'applique
  // EN AVAL d'`allCalendarEntries()` : le rail, l'estompe de la Destinée, la liste ✦, la puce et le plateau lisent
  // la liste complète.

  /** Les parties décochées. Vide hors du calendrier personnel. */
  protected readonly hiddenPartieIds = signal<ReadonlySet<string>>(new Set());

  /** Mes parties actives (JDR et groupes), par leur nom — seulement dans le calendrier personnel, et à partir de
   *  deux : un filtre sur une seule partie n'a rien à choisir. */
  protected readonly filterParties = computed<{ id: string; name: string }[]>(() => {
    if (this.partieId() !== null) return [];
    const active = this.myPartiesSvc
      .allParties()
      .filter((p) => isPartieActive(p.status))
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return active.length >= 2 ? active : [];
  });

  /** Combien de parties de la liste sont décochées (un identifiant resté dans l'ensemble après la fin d'une partie
   *  ne compte pas). */
  private readonly hiddenPartieCount = computed(
    () => this.filterParties().filter((p) => this.hiddenPartieIds().has(p.id)).length,
  );

  /** L'ensemble transmis aux grilles : `null` sans filtre actif. */
  protected readonly hiddenForViews = computed<ReadonlySet<string> | null>(() =>
    this.hiddenPartieCount() > 0 ? this.hiddenPartieIds() : null,
  );

  protected togglePartie(partieId: string): void {
    this.hiddenPartieIds.update((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(partieId)) next.add(partieId);
      return next;
    });
  }

  /** L'affichage s'écarte du défaut : des couches changées, ou des parties décochées. */
  protected readonly isOverridden = computed(
    () => this.layersOverridden() || this.hiddenPartieCount() > 0,
  );

  // ─── Story 36.14 — la barre repliée : le panneau « Affichage », sa pastille, sa légende ───

  /**
   * ⚠️ Le panneau est un OVERLAY ancré au viewport, pas du contenu dans la grille : une media
   * query est ici le bon outil, là où la vue Semaine emploie une container query (story 36.13).
   * Le raisonnement de la 36.13 — « en contexte de partie un panneau latéral prend 40 % de la
   * largeur et une media query mentirait » — vaut pour ce qui vit DANS la colonne ; un élément
   * qui flotte au-dessus de tout n'a pas ce problème.
   *
   * Réactif, contrairement à `view` : celui-ci porte un DÉFAUT que l'utilisateur peut écarter
   * (36.11, AC15), celui-là décrit la place disponible ici et maintenant — une rotation d'écran
   * doit bien faire passer le menu ancré à la feuille du bas.
   */
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(CalendarView.DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(CalendarView.DESKTOP_QUERY) },
  );

  /** Story 44.4 — la colonne de droite est à côté de la grille (≥ 768 px). Réactif, comme `isDesktop`. */
  protected readonly isWide = toSignal(
    this.breakpointObserver.observe(CalendarView.WIDE_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(CalendarView.WIDE_QUERY) },
  );

  protected readonly displayPanelOpen = signal(false);
  /** AC5 — fermée par défaut. Portée écran, jamais mémorisée : la légende est une aide de
   *  lecture ponctuelle, pas un réglage d'affichage au sens de FR-55. */
  protected readonly legendVisible = signal(false);
  protected readonly DISPLAY_PANEL_POSITIONS = DISPLAY_PANEL_POSITIONS;

  private readonly displayTrigger = viewChild<ElementRef<HTMLButtonElement>>('displayTrigger');

  protected toggleDisplayPanel(): void {
    this.displayPanelOpen.update((open) => !open);
  }

  /** AC18 — rendre le focus au bouton : sans quoi un utilisateur clavier retombe en haut du
   *  document, exactement le défaut déjà corrigé sur le sélecteur de vote (36.7, AC7). */
  protected closeDisplayPanel(): void {
    this.displayPanelOpen.set(false);
    this.displayTrigger()?.nativeElement.focus();
  }

  protected onDisplayPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // 🚨 `stopPropagation` : `Échap` annule aussi la sélection en cours dans la grille. Sans
      // cette barrière, fermer le panneau effacerait une sélection que l'utilisateur n'a pas
      // touchée — deux gestes distincts sur la même touche, comme pour le sélecteur de la 36.7.
      event.stopPropagation();
      this.closeDisplayPanel();
    }
  }

  protected toggleLegend(): void {
    this.legendVisible.update((v) => !v);
  }

  /**
   * AC4/AC6 — le libellé de la pastille de résumé.
   *
   * 🚨 Le dénominateur est `availableLayerKeys()` — les couches que CE calendrier expose : 4 en
   * personnel, 5 en contexte de partie. Le contrat l'écrit noir sur blanc : « la pastille dit
   * « 3 sur 4 », pas « 3 sur 5 » » [Source: contrat-ui-calendrier.html:277-278].
   *
   * ⚠️ À ne pas confondre avec `isOverridden()`, qui raisonne, lui, sur le jeu COMPLET,
   * `inscriptions-ouvertes` comprise (AC17) : compter sur le jeu affiché et décider sur le jeu
   * complet n'est pas une incohérence, c'est la seule combinaison qui ne mente ni au compteur ni
   * à la condition d'apparition.
   */
  protected readonly layerSummaryLabel = computed(() => {
    const shown = this.availableLayerKeys();
    const active = new Set(this.activeLayers());
    const layers = `${shown.filter((k) => active.has(k)).length} sur ${shown.length}`;
    const parties = `${this.filterParties().length - this.hiddenPartieCount()} sur ${this.filterParties().length}`;
    // Story 44.8 — un seul texte, quelle que soit la voix du thème : couches seules, parties seules, ou les deux
    // (« Affichage filtré · 3 sur 4 · 2 sur 3 · Rétablir »).
    const counts =
      this.layersOverridden() && this.hiddenPartieCount() > 0
        ? `${layers} · ${parties}`
        : this.hiddenPartieCount() > 0
          ? parties
          : layers;
    return this.theme.tone()['calendar.display.filtered_badge'].replace('{n} sur {total}', counts);
  });

  /** Aucun appel réseau : réaffecte l'état local depuis le défaut du compte (encadré n°2). */
  protected resetToDefault(): void {
    // Story 44.8 — la pastille rétablit AUSSI les parties décochées.
    this.hiddenPartieIds.set(new Set());
    this.activeLayers.set(this.defaultLayersForContext(!!this.partieId()));
    // 🚨 On ÉCRIT le défaut, on n'efface pas l'entrée : une entrée effacée dirait « jamais
    // visité », et un retour en session rejouerait un défaut de compte que le lecteur vient
    // peut-être d'écarter à nouveau depuis un autre onglet.
    this.sessionLayers.write(this.sessionKey(), this.activeLayers());
  }

  protected readonly visibleDeclarations = computed<AvailabilityDeclarationDto[]>(() => {
    const active = this.activeLayers();
    const showAvail = active.includes('mes-disponibilites');
    const showUnavail = active.includes('mes-indisponibilites');
    return this.declarations().filter((d) => (d.kind === 'AVAILABLE' ? showAvail : showUnavail));
  });

  /** Garde anti-double-ouverture du dialogue de résolution (Story 36.4). */
  private readonly conflictDialogOpen = signal(false);

  protected readonly panelOpen = signal(false);
  protected readonly selectedDate = signal<Date>(new Date());
  protected readonly selectedSlot = signal<DaySlot>('FULL_DAY');
  protected readonly selectedExisting = signal<AvailabilityDeclarationDto | null>(null);
  protected readonly pendingDto = signal<CreateAvailabilityDto | null>(null);

  protected readonly partieId = signal<string | null>(null);
  protected readonly availableSlots = signal<(AvailableSlotDto | AggregatedSlotDto)[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly slotsError = signal<string | null>(null);
  protected readonly heatmap = signal<AggregatedSlotDto[]>([]);

  protected readonly isMjMode = computed(() => this.mode() === 'mj');

  // ─── Story 40.5b — le calendrier d'un GROUPE (ralliement, `CAMPAGNE_EPISODIQUE`) ───────────────
  //
  // Même page, même composant : un groupe n'a ni scénarios, ni MJ, ni disponibilité agrégée. Ses
  // votes sont les sondages de dates de ses conjonctions, servis par `GET /parties/:id/events/list`
  // (`EventCardDto.poll`) ; ils se votent par les routes de vote partagées, et leur hôte en compose
  // les créneaux sur la grille. 🚨 Le mode MJ n'est jamais un groupe (aucune lecture de la partie).
  protected readonly isGroup = signal(false);
  /** La nature de la partie est connue (groupe ou non) : tant qu'elle ne l'est pas, le panneau latéral
   *  du mode joueur n'est pas rendu — il afficherait un instant des créneaux calculés à un groupe. */
  protected readonly groupResolved = signal(false);
  protected readonly groupEvents = signal<EventCardDto[]>([]);
  protected readonly groupEventsError = signal<string | null>(null);
  /** Pourquoi la dernière désignation d'un créneau a été refusée (journée entière) ; vide sinon. */
  protected readonly composeRefusal = signal<string | null>(null);
  private groupEventsReqId = 0;

  /** Les sondages de dates ouverts du groupe (une conjonction sans date, sondage `OPEN`). */
  protected readonly groupPolls = computed<GroupPollEntry[]>(() => {
    const out: GroupPollEntry[] = [];
    for (const card of this.groupEvents()) {
      if (card.poll && card.poll.status === 'OPEN' && !card.seance?.date) {
        out.push({ card, poll: card.poll });
      }
    }
    return out;
  });

  /** Le vote est ouvert à cet instant : statut `OPEN` et échéance non dépassée (le serveur tranche en
   *  dernier : `now > expiresAt` est refusé). */
  private pollOpenNow(poll: EventPollDto): boolean {
    if (poll.status !== 'OPEN') return false;
    return poll.expiresAt === null || Date.parse(poll.expiresAt) >= Date.now();
  }

  /** La personne connectée peut répondre à ce sondage : votant éligible, avant l'échéance. */
  private canVoteGroupPoll(poll: EventPollDto): boolean {
    const me = this.authSvc.currentUser()?.id;
    return !!me && poll.eligibleVoterIds.includes(me) && this.pollOpenNow(poll);
  }

  /** Une ligne par sondage ouvert : son nom, l'état du vote EN TOUTES LETTRES (répondre jusqu'au…, ou
   *  lecture seule et pourquoi), et le bouton « composer » de son hôte. */
  protected readonly groupPollRows = computed(() => {
    const tone = this.theme.tone();
    const me = this.authSvc.currentUser()?.id;
    return this.groupPolls().map(({ card, poll }) => {
      let state: string;
      if (!this.pollOpenNow(poll)) {
        state = tone['partie.ralliement_event_poll_ended'];
      } else if (!me || !poll.eligibleVoterIds.includes(me)) {
        state = tone['partie.ralliement_event_poll_not_eligible'];
      } else {
        const deadline = poll.expiresAt ? shortDayLabel(poll.expiresAt.substring(0, 10)) : '';
        state = fillTone(tone['partie.ralliement_calendar_poll_can_vote'], {
          date: deadline.replace(/\.$/, ''),
        });
      }
      return {
        eventId: card.id,
        title: card.title,
        state,
      };
    });
  });

  // Story 8.8, AC9 : source unique de vérité — `activePolls`/`eligibleSeances` en sont dérivés
  // (computed), pas peuplés séparément, pour rester cohérents après tout rechargement.
  protected readonly scenarios = signal<ScenarioDto[]>([]);

  // Story 8.8, AC7/AC8 : liste des votes actifs (OPEN) de la Partie, un par Séance, étiquetés par
  // scénario — remplace l'ancien signal `activePoll` unique (`PollService.getCurrentPoll`), qui ne
  // représentait qu'« un » poll par Partie (invariant retiré, cf. Décision 2 de la story).
  protected readonly activePolls = computed<ActivePollEntry[]>(() => {
    const entries: ActivePollEntry[] = [];
    for (const scenario of this.scenarios()) {
      scenario.seances.forEach((seance, i) => {
        if (seance.poll?.status === 'OPEN') {
          entries.push({ scenario, seance, seanceIndex: i + 1, poll: seance.poll });
        }
      });
    }
    return entries;
  });

  // Story 8.8, AC9 : séances sans vote encore lancé — scénario non clôturé, aucun poll déjà lié
  // (OPEN ou CLOSED, createSeancePoll() le rejetterait de toute façon), aucune date déjà validée
  // (héritage `dateValidee`, cas rare depuis le retrait de validerDate()).
  protected readonly eligibleSeances = computed<EligibleSeanceEntry[]>(() => {
    const entries: EligibleSeanceEntry[] = [];
    for (const scenario of this.scenarios()) {
      if (scenario.status === 'PASSE') continue;
      scenario.seances.forEach((seance, i) => {
        if (seance.poll) return;
        if (seance.inscription?.dateValidee) return;
        entries.push({ scenario, seance, seanceIndex: i + 1 });
      });
    }
    return entries;
  });

  // Story 30.6, AC4/AC2 : séances de mes parties dont l'inscription est ouverte — dérivation
  // séparée de `eligibleSeances()` (qui sert un besoin différent, MJ-only : lancer un vote).
  // Même règle que `buildOpenInscriptionsLayer` côté serveur (Story 30.5) : `inscription.max`
  // défini, aucune date validée (ni poll.chosenDate ni inscription.dateValidee).
  private openInscriptionSeances(): { scenario: ScenarioDto; seance: SeanceDto }[] {
    const out: { scenario: ScenarioDto; seance: SeanceDto }[] = [];
    for (const scenario of this.scenarios()) {
      for (const seance of scenario.seances) {
        if (seance.inscription?.max == null) continue;
        const validated = seance.poll?.chosenDate ?? seance.inscription?.dateValidee;
        if (validated) continue;
        out.push({ scenario, seance });
      }
    }
    return out;
  }

  // Story 30.6, Task 6/AC2 : liste chronologique unique fusionnant les couches actives — deux
  // chemins de source distincts selon le contexte (encadré n°1) :
  // - Contexte de partie (`partieId()` renseigné) : dérivée des signaux déjà chargés par cette
  //   page (`scenarios`, `activePolls`, `availableSlots`/`heatmap`), aucun appel réseau de plus
  //   (AC9).
  // - Contexte personnel (`partieId()` absent) : dérivée de `meCalendar()` (Story 30.5, AC8), qui
  //   porte déjà `mes-seances`/`votes-en-cours`/`inscriptions-ouvertes` filtrées par plage.
  //
  // Story 36.1, encadré n°2 : la dérivation est faite UNE SEULE FOIS, sans filtrage par couche.
  // Deux consommateurs en dépendent, avec des besoins opposés :
  //  - la vue Agenda ne veut que les couches actives (`agendaEntries()`, ci-dessous) ;
  //  - le rail de détail a besoin des entrées NON filtrées, parce qu'une séance dont la couche
  //    est éteinte doit continuer de rendre son créneau indisponible (FR-50 / AC6). Filtrer ici
  //    ferait disparaître l'indisponibilité en même temps que le titre.
  // Le filtrage par couche vit donc en aval, et seulement sur ce qui est NOMMÉ.
  private readonly allCalendarEntries = computed<AgendaEntry[]>(() => {
    const entries: AgendaEntry[] = [];
    const pid = this.partieId();
    const tone = this.theme.tone();

    if (pid) {
      for (const scenario of this.scenarios()) {
        for (const seance of scenario.seances) {
          const date = seance.poll?.chosenDate ?? seance.inscription?.dateValidee;
          if (!date) continue;
          entries.push({
            key: `seance-${seance.id}`,
            type: 'mes-seances',
            date: date.substring(0, 10),
            label: scenario.title,
            detail: seance.poll?.chosenSlot ?? undefined,
            slot: seance.poll?.chosenSlot ?? 'FULL_DAY',
            // AC7 : en contexte de partie, `scenarios()` ne contient QUE les scénarios de cette
            // partie — une séance d'une autre partie n'arrive jamais ici, et n'est donc ni
            // nommée ni navigable. Elle n'existe que sous forme d'indisponibilité anonyme,
            // dérivée côté serveur (AD-9).
            partieId: pid,
            scenarioId: scenario.id,
            seanceId: seance.id,
            // Story 36.5 — gratuits ici : le SeanceDto complet est déjà chargé.
            seanceHeure: seance.heureRdv,
            seanceLieu: seance.lieu,
            seanceNote: seance.notePratique,
            // Story 47.3 — la fin de la plage, lue de la séance : une plage de plusieurs créneaux
            // reste UNE entrée, la grille et le rail la déplient.
            ...spanEndOf(
              date.substring(0, 10),
              seance.poll?.chosenSlot ?? 'FULL_DAY',
              seance.endDate,
              seance.endSlot,
            ),
            // Story 36.11 — ce qui fait entrer une séance JOUÉE dans « C'est passé ». Gratuit
            // ici, le SeanceDto complet est déjà chargé. 🚨 Renseigné dans cette branche
            // SEULEMENT : `MyCalendarSeanceEntry` n'a pas de `compteRendu`, et le calendrier
            // personnel ne charge de toute façon aucune date passée.
            compteRenduManquant: !seance.compteRendu?.trim(),
          });
        }
      }
      // Story 36.6, AC8 — UNE entrée par OPTION, jamais une par sondage. Avant cette story, un
      // vote proposant vendredi ET samedi ne marquait que le vendredi : l'entrée unique portait
      // la date de la PREMIÈRE option, et tous les autres créneaux proposés restaient muets en
      // Mois, en Semaine et au rail. C'est ce que corrige l'éclatement ci-dessous.
      //
      // AD-20 : les compteurs et ma réponse se dérivent ici, côté client, de `PollOptionDto.votes`
      // — cet écran détient déjà la charge utile complète. Aucun appel réseau n'en part.
      const myId = this.authSvc.currentUser()?.id;
      for (const entry of this.activePolls()) {
        for (const option of entry.poll.options) {
          const mine = option.votes.find((v) => v.userId === myId);
          entries.push({
            key: `poll-${entry.poll.id}-${option.id}`,
            type: 'votes-en-cours',
            date: option.date.substring(0, 10),
            label: entry.scenario.title,
            // Story 36.6 — le CRÉNEAU, comme pour une séance. Le « N option(s) proposée(s) »
            // d'avant décrivait le SONDAGE ; répété sur chacune de ses options éclatées, il
            // devenait un bruit trompeur (constaté à l'œil dans l'Agenda). Ce que la ligne doit
            // dire, c'est le créneau qu'elle propose — traduit, comme SLOT_LABELS le fait déjà
            // pour les séances (revue de code du 36.6 : le code brut fuitait ici).
            detail: SLOT_LABELS[option.slot],
            slot: option.slot,
            // Story 47.4 — l'option est le départ d'une plage de la durée du vote.
            ...optionSpanEnd(option.date, option.slot, entry.poll.durationSlots),
            vote: {
              // Story 36.7 — le triplet d'identité de l'action. En contexte de partie il vient de
              // la route ; il est porté jusqu'à la bande pour que le sélecteur de réponse n'ait
              // rien à recomposer.
              partieId: pid,
              pollId: entry.poll.id,
              optionId: option.id,
              yes: option.votes.filter((v) => v.answer === 'YES').length,
              maybe: option.votes.filter((v) => v.answer === 'MAYBE').length,
              no: option.votes.filter((v) => v.answer === 'NO').length,
              // Le dénominateur vient du serveur (`membersCount`) et JAMAIS de `members()`, qui
              // n'est chargé qu'en mode MJ : un joueur n'a aucun effectif en mémoire.
              total: entry.poll.membersCount,
              myAnswer: mine ? mine.answer : null,
            },
          });
        }
      }
      // Story 40.5b — les sondages de dates des conjonctions d'un groupe : UNE entrée par option, comme
      // ci-dessus. Compteurs et ma réponse se dérivent de `poll.votes` (réponses des votants éligibles) ;
      // le dénominateur est le nombre de votants éligibles, jamais le nombre de membres.
      for (const { card, poll } of this.groupPolls()) {
        const eligible = new Set(poll.eligibleVoterIds);
        for (const option of poll.options) {
          const votes = poll.votes.filter((v) => v.optionId === option.id && eligible.has(v.userId));
          const mine = votes.find((v) => v.userId === myId);
          entries.push({
            key: `poll-${poll.id}-${option.id}`,
            type: 'votes-en-cours',
            date: option.date.substring(0, 10),
            label: card.title,
            detail: SLOT_LABELS[option.slot],
            slot: option.slot,
            // Story 47.4 — l'option est le départ d'une plage de la durée du vote.
            ...optionSpanEnd(option.date, option.slot, poll.durationSlots),
            vote: {
              partieId: pid,
              pollId: poll.id,
              optionId: option.id,
              yes: votes.filter((v) => v.answer === 'YES').length,
              maybe: votes.filter((v) => v.answer === 'MAYBE').length,
              no: votes.filter((v) => v.answer === 'NO').length,
              total: poll.eligibleVoterIds.length,
              myAnswer: mine ? mine.answer : null,
            },
          });
        }
      }
      for (const { scenario, seance } of this.openInscriptionSeances()) {
        entries.push({
          key: `inscription-${seance.id}`,
          type: 'inscriptions-ouvertes',
          date: '',
          label: scenario.title,
          detail: fillTone(tone['common.n_max_inscrits'], {
            n: seance.inscription!.inscrits.length,
            max: seance.inscription!.max,
          }),
          // Story 36.11 — commande le badge (« S'inscrire » contre « Inscrit »), jamais
          // l'appartenance à la section : une inscription reste dans « Ça t'attend » même une
          // fois prise, c'est le libellé qui change (même règle que pour un vote répondu).
          jeSuisInscrit: seance.inscription!.inscrits.some((i) => i.userId === myId),
        });
      }
      // Story 36.8 — ⚠️ le `continue` qui sautait les créneaux « aucun disponible ET aucun avis »
      // a été RETIRÉ : c'est précisément l'un des DEUX VIDES que l'AC6 demande de distinguer
      // (jauge vide « personne ne s'est prononcé » vs jauge rouge pleine « tout le monde est
      // bloqué »). Tant qu'il filtrait ici, la grille ne pouvait structurellement pas montrer le
      // premier. La liste Agenda, elle, continue de ne rien afficher pour ces créneaux — mais le
      // filtre est désormais À L'AFFICHAGE (`agendaEntries()`), jamais à la source.
      // Story 36.12, AC5 — les séances auxquelles il manque un vote. 🚨 MJ UNIQUEMENT : un joueur
      // ne peut pas lancer de vote, et lui montrer une ligne dont l'unique contenu est une action
      // qui lui est refusée serait une promesse creuse. Elles n'existent qu'en contexte de partie,
      // `eligibleSeances()` dérivant de `scenarios()`.
      //
      // Agenda-only et sans date, exactement comme `inscriptions-ouvertes` : aucune case ne les
      // porte, ni en Mois, ni en Semaine, ni au rail.
      if (this.isMjMode()) {
        for (const e of this.eligibleSeances()) {
          entries.push({
            key: `sans-date-${e.seance.id}`,
            type: 'seances-sans-date',
            date: '',
            label:
              e.scenario.seances.length > 1
                ? this.scenarioSeanceTitle(e.scenario.title, e.seanceIndex)
                : e.scenario.title,
            partieId: pid,
            scenarioId: e.scenario.id,
            seanceId: e.seance.id,
          });
        }
      }
      for (const slot of this.heatmap()) {
        entries.push({
          key: `groupe-${slot.date}-${slot.slot}`,
          type: 'disponibilite-groupe',
          date: slot.date,
          label: fillTone(tone['calendar.view_group_label'], {
            slot: slot.slot,
            available: slot.available,
            total: slot.total,
          }),
          detail:
            slot.unavailable > 0
              ? fillTone(tone['calendar.view_group_unavailable_detail'], { n: slot.unavailable })
              : undefined,
          slot: slot.slot,
          // La charge utile STRUCTURÉE que la grille et le rail consomment (le `label` ci-dessus
          // reste le texte de l'Agenda). `members` vient du serveur et n'existe que pour le MJ :
          // `?? null` — jamais `undefined`, une seule représentation de « aucune identité ».
          group: {
            available: slot.available,
            unavailable: slot.unavailable,
            unknown: slot.unknown,
            total: slot.total,
            members: slot.members ?? null,
          },
        });
      }
    } else {
      const mc = this.meCalendar();
      if (mc) {
        for (const s of mc['mes-seances']) {
          entries.push({
            key: `seance-${s.seanceId}`,
            type: 'mes-seances',
            date: s.date,
            label: `${s.partieName} — ${s.scenarioTitle}`,
            detail: s.slot,
            slot: s.slot,
            partieId: s.partieId,
            scenarioId: s.scenarioId,
            seanceId: s.seanceId,
            // Story 36.5, AC6 — le second chemin d'alimentation. Sans ces trois lignes ET
            // l'enrichissement de MyCalendarSeanceEntry côté serveur, les informations pratiques
            // marcheraient en contexte de partie et manqueraient sur profile/calendar.
            seanceHeure: s.heureRdv,
            seanceLieu: s.lieu,
            seanceNote: s.notePratique,
            // Story 47.3 — la fin de la plage, servie par le calendrier personnel.
            ...spanEndOf(s.date, s.slot, s.endDate, s.endSlot),
            compteRenduManquant: s.compteRenduManquant,
          });
        }
        // Story 44.2 — mes sondages ouverts viennent de `GET /me/open-polls` (toutes parties, toutes familles,
        // tous les mois), plus de la couche de `GET /me/calendar`. Même éclatement par option qu'en contexte de
        // partie ; les agrégats sont SERVIS (D-17) : le calendrier personnel n'a pas la charge utile des votants,
        // et ne doit pas l'avoir (AD-9).
        for (const p of this.openPollsSvc.entries()) {
          for (const option of p.options) {
            entries.push({
              key: `poll-${p.pollId}-${option.date}-${option.slot}`,
              type: 'votes-en-cours',
              date: option.date,
              label: p.partieName,
              // Idem contexte de partie (cf. commentaire ci-dessus, ligne ~332).
              detail: SLOT_LABELS[option.slot],
              slot: option.slot,
              // Story 47.4 — l'option est le départ d'une plage de la durée du rendez-vous.
              ...optionSpanEnd(option.date, option.slot, p.durationSlots),
              vote: {
                // Story 36.7 — ici le `partieId` ne peut PAS venir de la route : le calendrier personnel
                // agrège plusieurs parties. Il vient de l'entrée elle-même (`OpenPollEntry.partieId`), et
                // c'est le seul endroit de l'application où voter dans la mauvaise partie serait possible.
                partieId: p.partieId,
                pollId: p.pollId,
                optionId: option.optionId,
                yes: option.yes,
                maybe: option.maybe,
                no: option.no,
                // Story 44.2 — le dénominateur est le nombre de votants éligibles du sondage.
                total: p.eligibleCount,
                myAnswer: option.myAnswer,
                // Je ne suis pas votant (places limitées d'un groupe) : je lis la piste, sans répondre.
                readOnly: !p.me.eligible,
              },
            });
          }
        }
        for (const i of mc['inscriptions-ouvertes']) {
          entries.push({
            key: `inscription-${i.seanceId}`,
            type: 'inscriptions-ouvertes',
            date: '',
            label: `${i.partieName} — ${i.scenarioTitle}`,
            detail: fillTone(tone['common.n_max_inscrits'], {
              n: i.inscritsCount,
              max: i.inscriptionMax,
            }),
            // Story 36.11 — servi par le DTO ici, dérivé de la liste des inscrits en contexte de
            // partie. Deferred-work (2026-08-24) : `MyCalendarOpenInscriptionEntry` porte
            // désormais `scenarioId`, la ligne est donc ouvrable comme en contexte de partie
            // (`CalendarAgendaView.openTarget()` s'appuie déjà sur `partieId`+`scenarioId`).
            partieId: i.partieId,
            scenarioId: i.scenarioId,
            jeSuisInscrit: i.jeSuisInscrit,
          });
        }
      }
    }

    for (const d of this.declarations()) {
      entries.push({
        key: `decl-${d.id}`,
        type: d.kind === 'AVAILABLE' ? 'mes-disponibilites' : 'mes-indisponibilites',
        date: d.startDate ?? '',
        label:
          d.recurKind === 'RECURRING'
            ? tone['calendar.week_decl_recurring']
            : tone['calendar.week_decl_punctual'],
        detail: d.slot,
        slot: d.slot,
      });
    }

    return entries;
  });

  // Story 30.6, Task 6/AC2 : liste chronologique unique fusionnant les couches ACTIVES.
  // Le filtre par type est exactement équivalent à l'ancien gating bloc par bloc, y compris pour
  // les déclarations (dont `visibleDeclarations()` applique le même mapping kind → couche).
  protected readonly agendaEntries = computed<AgendaEntry[]>(() => {
    const active = new Set(this.activeLayers());
    // Story 44.2 — calendrier personnel : la liste des votes couvre tous les mois, l'Agenda ne montre que les votes
    // qui ont au moins une option dans la période chargée (comme avant, quand le serveur filtrait par période).
    const personal = this.partieId() === null;
    const from = this.fromDateStr();
    const to = this.toDateStr();
    const pollsInPeriod = new Set<string>();
    if (personal) {
      for (const e of this.allCalendarEntries()) {
        if (e.type === 'votes-en-cours' && e.vote && e.date >= from && e.date <= to) {
          pollsInPeriod.add(e.vote.pollId);
        }
      }
    }
    const hidden = this.hiddenForViews();
    return this.allCalendarEntries().filter(
      (e) =>
        // Story 44.8 — les séances, votes et inscriptions d'une partie décochée quittent l'Agenda.
        (hidden === null || !hidden.has(entryPartieId(e) ?? '')) &&
        (!personal ||
          e.type !== 'votes-en-cours' ||
          (e.vote && pollsInPeriod.has(e.vote.pollId))) &&
        // Story 36.11, AC9 — 🚨 `inscriptions-ouvertes` ÉCHAPPE au filtre par couche. Son
        // interrupteur a quitté la barre (AC7) mais sa clé survit dans la préférence de compte :
        // un compte qui l'avait éteinte au palier précédent verrait sinon la section « Ça
        // t'attend » amputée, sans plus aucun moyen de la rétablir.
        // Story 36.12 — `seances-sans-date` échappe pour une raison différente et plus simple :
        // ce n'est pas une clé de `CALENDAR_LAYER_KEYS`, donc `active.has()` serait TOUJOURS faux
        // et la ligne n'apparaîtrait jamais. Elle n'a pas d'interrupteur parce qu'elle n'est pas
        // une couche : c'est une action attendue du MJ, pas une matière à afficher ou masquer.
        (e.type === 'inscriptions-ouvertes' ||
          e.type === 'seances-sans-date' ||
          active.has(e.type)) &&
        // Story 36.8 — un créneau dont personne n'a rien dit n'a rien à faire dans une LISTE : il
        // n'y ajouterait qu'une ligne « 0/4 disponibles » par créneau et par jour. Il doit en
        // revanche atteindre la GRILLE, où sa jauge vide porte une information (AC6). Le filtre
        // vit donc ici, à l'affichage, et non plus à la source (`allCalendarEntries`).
        (e.type !== 'disponibilite-groupe' ||
          e.group == null ||
          e.group.available > 0 ||
          e.group.unavailable > 0),
    );
  });

  /**
   * Story 36.12, AC14 — qui n'a pas encore répondu, par `pollId`, pour la méta de la ligne de
   * vote côté MJ (« il manque Léa, Tom »).
   *
   * 🚨 `getMissingVoters()` est **la** définition de « manquant » du projet — celle de la fiche de
   * scénario et de `<app-poll-missing>`, juste à côté sur cet écran. En réécrire une seconde ici
   * garantirait qu'elles finissent par diverger.
   *
   * 🚨 **Vide hors mode MJ, et structurellement vide en calendrier personnel** : `members()` n'y
   * est jamais chargé, et `MyCalendarPollOption` est anonyme par conception (AD-9) — aucune
   * identité de votant ne doit transiter par le calendrier personnel.
   *
   * ⚠️ Dette connue, héritée de la 36.6 : `GET /parties/:id/members` ne renvoie pas le MJ, qui
   * peut pourtant voter. La liste ne peut donc pas le nommer ; le compteur, lui, reste juste,
   * puisqu'il vient de `membersCount`.
   */
  protected readonly missingByPoll = computed<Record<string, string[]>>(() => {
    // Revue de code (36.12) — même double garde que `canSeal` (`isMjMode() && partieId() !==
    // null`), documentée là-bas comme nécessaire : aujourd'hui `members()` reste vide hors
    // contexte de partie, mais rien ne le garantit structurellement sans ce second test explicite.
    if (!this.isMjMode() || this.partieId() === null) return {};
    if (!this.membersLoaded()) return {};
    const members = this.members();
    const out: Record<string, string[]> = {};
    for (const entry of this.activePolls()) {
      const missing = getMissingVoters(entry.poll, members);
      if (missing.length > 0) out[entry.poll.id] = missing.map((m) => m.displayName || m.pseudo);
    }
    return out;
  });

  /** Story 36.2 — les entrées **non filtrées** transmises à la vue Mois, qui arbitre la préséance
   *  bande par bande. Volontairement distinct d'`agendaEntries()` : la case doit continuer de
   *  rendre un créneau indisponible quand la couche « mes séances » est éteinte (FR-50), ce
   *  qu'une liste déjà filtrée rendrait impossible. */
  protected readonly calendarEntries = computed<AgendaEntry[]>(() => this.allCalendarEntries());

  // ─── Rail de détail (Story 36.1) ──────────────────────────────────────────
  // Signaux DÉDIÉS, distincts de `selectedDate`/`selectedSlot` : ces derniers appartiennent au
  // ConstraintPanel et sont liés à `panelOpen`/`closePanel()`. Les réutiliser viderait le rail à
  // chaque fermeture du panneau (encadré n°1, piège n°1).
  protected readonly railDate = signal<Date | null>(null);
  protected readonly railSlot = signal<DaySlot | null>(null);

  /** AC3 — au repos, le prochain jour portant quelque chose ; à défaut, aujourd'hui (jamais un
   *  rail blanc). Dérivé de la liste COMPLÈTE (`allCalendarEntries()`), pas des couches actives :
   *  le rail suit, il ne se commande pas — désactiver une couche ne doit pas le faire sauter vers
   *  un autre jour. */
  private readonly railDateKey = computed<string>(() => {
    const touched = this.railDate();
    if (touched) return toDateKey(touched);
    const todayKey = toDateKey(new Date());
    return nextMeaningfulDate(this.allCalendarEntries(), todayKey) ?? todayKey;
  });

  /** AC5 — purement dérivé des signaux déjà chargés : aucun appel réseau n'part d'ici. */
  protected readonly railDetail = computed(() =>
    buildDayDetail(
      this.railDateKey(),
      this.allCalendarEntries(),
      this.activeLayers(),
      this.visibleDeclarations(),
    ),
  );

  // ─── Story 36.9 — le mode Destinée ────────────────────────────────────────
  //
  // 🚨 UN MODE, PAS UNE COUCHE (`EXPERIENCE.md:367`). Il ne rejoint JAMAIS `activeLayers` :
  // `CALENDAR_LAYER_KEYS` est un type partagé, persisté dans `defaultCalendarLayers` du compte —
  // y ajouter la Destinée l'exposerait à `resetToDefault()`, à `isOverridden()` et à l'écran
  // Compte, et ferait de ce mode éphémère un réglage persistant.
  //
  // 🚨 L'état est un `pollId`, JAMAIS UN INDEX. `activePolls()` est reconstruit à chaque
  // `scenariosSvc.changed()` : un index survivrait au rechargement en désignant un AUTRE vote, et
  // la Destinée basculerait toute seule. Un `pollId` disparu, lui, est détectable — c'est l'effet
  // de fin de mode plus bas (AC9).
  protected readonly destinyPollId = signal<string | null>(null);

  /**
   * Les votes ouverts, nommés, dans l'ordre de première rencontre.
   *
   * 🚨 Dérivé d'`allCalendarEntries()` et **surtout pas** d'`activePolls()` : ce dernier est vide
   * hors contexte de partie, alors que le calendrier personnel porte lui aussi des votes ouverts
   * (agrégés depuis plusieurs parties par `GET /me/calendar`). Une seule dérivation sert donc les
   * DEUX contextes, et le libellé est celui que l'entrée porte déjà — jamais recomposé.
   */
  protected readonly destinyPolls = computed<DestinyPollRef[]>(() => {
    const seen = new Set<string>();
    const polls: DestinyPollRef[] = [];
    for (const e of this.allCalendarEntries()) {
      if (e.type !== 'votes-en-cours' || !e.vote) continue;
      if (seen.has(e.vote.pollId)) continue;
      seen.add(e.vote.pollId);
      polls.push({ pollId: e.vote.pollId, label: e.label });
    }
    return polls;
  });

  /** Le vote courant, ou `null` — y compris quand `destinyPollId` désigne un vote qui vient de
   *  disparaître : la lecture est toujours honnête, avant même que l'effet ne nettoie le signal. */
  protected readonly destinyPoll = computed<DestinyPollRef | null>(() => {
    const id = this.destinyPollId();
    return id === null ? null : (this.destinyPolls().find((p) => p.pollId === id) ?? null);
  });

  /**
   * Les jours que le mode met en avant : `null` hors mode, sinon les clés `YYYY-MM-DD` portant
   * une option du vote COURANT (AC1/AC12).
   *
   * 🚨 **Dérivé d'`allCalendarEntries()`, la liste NON filtrée** — jamais de `band.vote` ni de
   * `DaySlotDetail.pollVote`, qui sont gouvernés par la couche `votes-en-cours`. Les en dériver
   * ferait qu'une couche éteinte produirait un ensemble VIDE, donc une grille entièrement
   * estompée sans rien mettre en avant. C'est le défaut que l'AC6 et son test verrouillent.
   *
   * Point de dérivation UNIQUE (AC12) : les deux vues consomment cet ensemble, aucune ne
   * recalcule la pertinence depuis ses propres bandes (doctrine AD-12/AD-19).
   */
  protected readonly destinyDates = computed<ReadonlySet<string> | null>(() => {
    // ⚠️ Story 45.2 (AR16) — armer le composer SUSPEND la Destinée : plus d'estompe (le plateau est déjà masqué par
    // `destinyPresentable`). `destinyPollId` n'est pas touché : annuler rend l'état exact d'avant, valider
    // réactive la Destinée sur le vote créé ou modifié.
    if (this.composing()) return null;
    // Story 46.2 — une fenêtre de l'automate sélectionnée passe avant la Destinée : seul son jour reste net.
    const window = this.selectedWindow();
    if (window) return new Set([window.date]);
    const current = this.destinyPoll();
    if (!current) return null;
    const dates = new Set<string>();
    for (const e of this.allCalendarEntries()) {
      if (e.type !== 'votes-en-cours' || e.vote?.pollId !== current.pollId) continue;
      // Story 47.5 — une plage couvre tous ses jours : aucun n'est estompé.
      for (const day of entryCoveredDays(e)) dates.add(day);
    }
    return dates;
  });

  /**
   * AC6 — activer le mode ALLUME `votes-en-cours` si elle est éteinte.
   *
   * Un mode qui concentre l'écran sur un vote ne peut pas laisser ce vote invisible : l'AC1 exige
   * que « les créneaux proposés restent **pleinement lisibles** ». Coup de pouce **à sens
   * unique** — `exitDestiny()` ne rééteint rien : on ne défait pas un réglage que l'utilisateur
   * voit et peut refaire lui-même.
   */
  protected enterDestiny(pollId: string): void {
    this.destinyPollId.set(pollId);
    // Story 46.1 — entrer en Destinée rouvre la colonne : le vote ne se suit pas derrière un dock.
    this.dock.open();
    // Le créneau courant appartenait au vote précédent ; `chooseDestiny` pose celui du nouveau.
    this.destinyOptionId.set(null);
    // Story 44.8 — entrer en Destinée sur une partie décochée la recoche : on ne regarde pas un vote que la grille
    // cache.
    const partieOfPoll = this.openPollsSvc.entries().find((e) => e.pollId === pollId)?.partieId;
    if (partieOfPoll && this.hiddenPartieIds().has(partieOfPoll)) {
      this.hiddenPartieIds.update((hidden) => {
        const next = new Set(hidden);
        next.delete(partieOfPoll);
        return next;
      });
    }
    // Le tiroir (44.5) s'ouvre toujours replié : la grille d'abord.
    this.destinySheetExpanded.set(false);
    this.destinyNotice.set(null);
    if (!this.activeLayers().includes('votes-en-cours')) {
      this.activeLayers.update((keys) => [...keys, 'votes-en-cours']);
    }
  }

  protected exitDestiny(): void {
    this.destinyPollId.set(null);
    this.destinyOptionId.set(null);
    this.destinySheetExpanded.set(false);
  }

  // ─── Story 44.3 — choisir la destinée active dans une liste ───────────────────
  //
  // ⚠️ La puce ✦ ne bascule plus le mode : elle ouvre la liste des votes ouverts, et c'est le choix d'une
  // ligne qui l'active. La liste est enveloppée comme le panneau « Affichage » (menu ancré sur ordinateur,
  // tiroir modal du bas en dessous de 1024 px) ; son contenu est `DestinyList`, de rendu pur.

  /** Le créneau courant de la Destinée : un `optionId`, jamais un rang (le plateau de la 44.4 le lit). */
  protected readonly destinyOptionId = signal<string | null>(null);

  protected readonly destinyListOpen = signal(false);

  private readonly destinyControl = viewChild(DestinyControl);

  /** L'ancre du menu de la liste : la puce, qui vit dans `DestinyControl`. */
  protected readonly destinyChip = computed(() => this.destinyControl()?.chipElement() ?? null);

  /**
   * Les lignes de la liste : les votes que la vue connaît (`destinyPolls()`, qui fait autorité sur ce qui est
   * ouvert — à l'atelier, ceux de CETTE partie seulement ; dans la vitrine, ceux de toutes mes parties),
   * enrichis de ce que `GET /me/open-polls` sert (échéance, effectif, mon état). Un vote sans entrée servie
   * n'est pas listé : on ne montre pas une ligne dont on ignore l'état.
   */
  protected readonly destinyListItems = computed<DestinyListItem[]>(() => {
    const known = new Set(this.destinyPolls().map((p) => p.pollId));
    const today = this.todayKey;
    return this.openPollsSvc
      .entries()
      .filter((e) => known.has(e.pollId))
      .map((e) => ({
        pollId: e.pollId,
        partieName: e.partieName,
        title: e.title,
        expiresAt: e.expiresAt,
        ended: e.expiresAt !== null && e.expiresAt.substring(0, 10) < today,
        optionCount: e.options.length,
        state: this.destinyStateOf(e),
      }));
  });

  /** Mon état sur un vote — la liste et le tiroir (44.5) le disent de la même façon. Qui conclut le vote d'abord ;
   *  puis qui n'y vote pas ; puis ma réponse. */
  private destinyStateOf(e: OpenPollEntry): DestinyState {
    if (e.can.choose) return 'organizer';
    if (!e.me.eligible) return 'not-voting';
    return e.me.answered ? 'answered' : 'todo';
  }

  /** La liste n'a de sens que s'il y a des lignes : sans elles la puce a disparu, et le menu perdrait son ancre. */
  protected readonly destinyListShown = computed(
    () => this.destinyListOpen() && this.destinyListItems().length > 0,
  );

  protected toggleDestinyList(): void {
    this.destinyListOpen.update((open) => !open);
  }

  /** Rendre le focus à la puce : sans quoi un utilisateur clavier retombe en haut du document. */
  protected closeDestinyList(): void {
    this.destinyListOpen.set(false);
    this.destinyChip()?.focus();
  }

  protected onDestinyListKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Comme le panneau « Affichage » : Échap annule aussi la sélection de la grille, deux gestes distincts.
      event.stopPropagation();
      this.closeDestinyList();
    }
  }

  /** Choisir une ligne : la Destinée s'active sur CE vote (`pollId`), la vue devient Mois (Semaine pour un vote
   *  du mode soirée) même depuis l'Agenda, et la grille se place sur l'option d'entrée du vote. */
  protected chooseDestiny(pollId: string): void {
    const entry = this.openPollsSvc.entries().find((e) => e.pollId === pollId);
    this.closeDestinyList();
    if (!entry) return;
    this.enterDestiny(pollId);
    const target = destinyEntryOption(entry, this.todayKey);
    this.destinyOptionId.set(target?.optionId ?? null);
    const view = entry.family === 'ralliement' ? 'week' : 'month';
    if (this.view() !== view) this.onViewChange(view);
    if (target) this.moveGridTo(target.date, true);
  }

  /**
   * Place la grille sur un jour (`YYYY-MM-DD`). Date UTC à minuit, comme celles que les vues émettent ; la
   * plage affichée est rechargée comme pour une navigation à la main.
   *
   * Story 44.4 — un créneau touché ou un chevron ne doit pas relire le calendrier personnel à chaque geste :
   * en vue Mois, un jour du mois déjà affiché ne recharge rien (`force` : l'entrée dans un vote recharge
   * toujours, comme avant). La vue Semaine recharge, sa plage étant celle de la semaine.
   */
  private moveGridTo(dateKey: string, force = false): void {
    const date = new Date(`${dateKey}T00:00:00Z`);
    if (this.view() === 'week') {
      void this.onWeekDateChange(date);
      return;
    }
    const shown = this.sharedDate();
    const sameMonth =
      (shown.getFullYear() === date.getUTCFullYear() && shown.getMonth() === date.getUTCMonth()) ||
      (shown.getUTCFullYear() === date.getUTCFullYear() &&
        shown.getUTCMonth() === date.getUTCMonth());
    if (!force && sameMonth) return;
    void this.onMonthDateChange(date);
  }

  // ─── Story 44.4 — le plateau de la destinée ───────────────────────────────────
  //
  // ⚠️ À partir de 768 px, tant que la Destinée est active, le plateau REMPLACE le contenu de la colonne de
  // droite (colonne MJ, colonne joueur ou groupe, colonne de 340 px de la vitrine). Tout vient d'UNE source,
  // l'entrée servie par `GET /me/open-polls` : la liste, la puce et le plateau ne peuvent pas se contredire.

  /** L'entrée servie du vote courant, ou `null` (vote pas encore lu, ou disparu). */
  protected readonly destinyEntry = computed<OpenPollEntry | null>(() => {
    const id = this.destinyPollId();
    return id === null ? null : (this.openPollsSvc.entries().find((e) => e.pollId === id) ?? null);
  });

  /** Les créneaux du vote courant, dans l'ordre chronologique : l'ordre du plateau ET celui des chevrons. */
  protected readonly destinySlots = computed(() =>
    sortOptionsChronologically(this.destinyEntry()?.options ?? []),
  );

  /** Le rang (base 1) du créneau courant dans l'ordre chronologique ; `0` s'il n'y en a pas. */
  protected readonly destinySlotPosition = computed(() => {
    const id = this.destinyOptionId();
    const i = this.destinySlots().findIndex((o) => o.optionId === id);
    return i < 0 ? 0 : i + 1;
  });

  /** Le plateau remplace la colonne de droite : large écran, hors Agenda (la Destinée n'y existe pas), hors
   *  composition (qui masque la Destinée), et seulement pour un vote dont l'état est connu. */
  private readonly destinyPresentable = computed(
    () =>
      this.view() !== 'agenda' &&
      !this.composing() &&
      // Story 46.2 — sélectionner une fenêtre SUSPEND la Destinée (`destinyPollId` intact : désélectionner la rétablit).
      !this.selectedWindow() &&
      this.destinyPoll() !== null &&
      this.destinyEntry() !== null,
  );

  // ─── Story 46.2 — mettre une fenêtre de l'automate en évidence ─────────────────
  //
  // Un signal ÉPHÉMÈRE, jamais une couche : une seule fenêtre à la fois, celle que le MJ vient de toucher dans la liste
  // de l'automate. Priorité unique des modes : composer > fenêtre sélectionnée > Destinée (`destinyDates`,
  // `destinyPresentable`). Elle n'existe que pour la vue nominative du MJ, à l'atelier.

  protected readonly selectedWindow = signal<{
    date: string;
    slot: DaySlot;
    /** Story 47.6 — la durée de la fenêtre telle que servie : elle ne rejoint qu'une composition de la même durée. */
    durationSlots: number;
  } | null>(null);

  /** La clé de la fenêtre sélectionnée, dans le format des grilles (`AAAA-MM-JJ|créneau`). */
  protected readonly selectedWindowKey = computed(() => {
    const w = this.selectedWindow();
    return w ? availableSlotKey(w) : null;
  });

  /** Le pied « Éphémérides · N » du plateau est-il déplié ? Local : le dock de 46.1 ne le concerne pas. */
  protected readonly boardSlotsOpen = signal(false);

  /** Les cartes de l'automate ne se sélectionnent qu'à l'atelier du MJ (les joueurs gardent leur vue agrégée). */
  protected readonly windowSelectable = computed(() => this.isMjMode() && this.partieId() !== null);

  /** Story 46.3 — « Ajouter au vote » a-t-il quelque part où verser la fenêtre ? Composer ouvert, vote de la Destinée
   *  modifiable, ou au moins un rendez-vous composable. Sinon le bouton est désactivé : jamais un clic muet. */
  protected readonly windowAddable = computed(
    () => this.composing() || this.modifiablePoll() !== null || this.composableRows().length > 0,
  );

  protected onWindowSelected(slot: AvailableSlotDto | null): void {
    if (!slot) {
      this.selectedWindow.set(null);
      return;
    }
    this.selectedWindow.set({ date: slot.date, slot: slot.slot, durationSlots: slot.durationSlots });
    this.moveGridTo(slot.date);
  }

  /**
   * ⚠️ Story 46.4 — « Masquer » : la fenêtre est rangée parmi les masquées (`PUT …/available-slots/hidden`, avec sa clé
   * recopiée de la fenêtre servie), puis la liste est relue. La sélection tombe. Un échec la laisse en place et le dit.
   * Le serveur émet `user:{id}` : les autres onglets et appareils du MJ relisent la liste d'eux-mêmes.
   */
  protected async hideWindow(slot: AvailableSlotDto): Promise<void> {
    const id = this.partieId();
    if (!id || this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.pollSvc.hideWindow(id, {
        date: slot.date,
        startSlot: slot.slot,
        durationSlots: slot.durationSlots,
      });
      this.selectedWindow.set(null);
      await this.refreshMjPanels();
    } catch {
      this.error.set(this.theme.tone()['calendar.window_hide_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** Story 46.4 — « Démasquer » : la fenêtre revient dans la liste si l'automate la juge encore libre. */
  protected async showWindow(slot: AvailableSlotDto): Promise<void> {
    const id = this.partieId();
    if (!id || this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.pollSvc.showWindow(id, {
        date: slot.date,
        startSlot: slot.slot,
        durationSlots: slot.durationSlots,
      });
      await this.refreshMjPanels();
    } catch {
      this.error.set(this.theme.tone()['calendar.window_hide_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** `Échap` désélectionne la fenêtre (les panneaux et sélecteurs ouverts retiennent la touche avant nous). */
  protected onWindowEscape(): void {
    if (this.selectedWindow()) this.selectedWindow.set(null);
  }

  /** Story 46.1 — ce que le dock de la colonne MJ ou joueur dit en vertical : « Éphémérides · 18 ». */
  protected readonly slotsDockLabel = computed(
    () => `${this.theme.tone()['section.slots']} · ${this.displayedSlots().length}`,
  );

  /** Story 46.3 (AR8) — les fenêtres de l'automate affichées : celles que le serveur sert, moins celles du composer.
   *  Une seule fonction pure (`displayedWindows`) ; la vue des joueurs, sans composer, reçoit la liste servie. */
  protected readonly displayedSlots = computed(() =>
    displayedWindows(
      this.availableSlots().filter((s) => !('hidden' in s && s.hidden)),
      this.composedKeys(),
    ),
  );

  /** Story 46.4 — les fenêtres que ce MJ a masquées, servies à part : derrière le lien du pied de liste, jamais
   *  comptées dans « Éphémérides · N ». Vide pour les joueurs (la vue agrégée n'en porte pas). */
  protected readonly hiddenSlots = computed(() =>
    this.availableSlots().filter((s): s is AvailableSlotDto => 'hidden' in s && s.hidden === true),
  );

  /** Story 46.1 — le dock de la colonne d'un groupe : ses votes de dates, comptés. */
  protected readonly groupDockLabel = computed(
    () =>
      `${this.theme.tone()['partie.ralliement_calendar_polls_heading']} · ${this.groupPollRows().length}`,
  );

  /** Story 46.1 — le dock du plateau : le titre seul (« Chapitre 4 ») ; le pictogramme `destinee` passe par l'entrée `icon` du dock. */
  protected readonly boardDockLabel = computed(() => this.destinyBoard()?.title ?? '');

  protected readonly destinyBoardShown = computed(() => this.isWide() && this.destinyPresentable());

  /** Les noms de celles et ceux qui n'ont pas répondu — pour l'organisateur, à l'atelier, jamais ailleurs. */
  private absentNames(entry: OpenPollEntry): string[] {
    if (entry.family === 'jdr') return this.missingByPoll()[entry.pollId] ?? [];
    // Un groupe : les votants éligibles sans aucune réponse (règle partagée `hasAnswered`), nommés par les membres.
    if (!this.membersLoaded()) return [];
    const poll = this.groupPolls().find((g) => g.poll.id === entry.pollId)?.poll;
    if (!poll) return [];
    const optionIds = poll.options.map((o) => o.id);
    const byId = new Map(this.members().map((m) => [m.userId, m]));
    return poll.eligibleVoterIds
      .filter(
        (userId) =>
          !hasAnswered(
            'ralliement',
            optionIds,
            poll.votes.filter((v) => v.userId === userId).map((v) => v.optionId),
          ),
      )
      .flatMap((userId) => {
        const member = byId.get(userId);
        return member ? [member.displayName || member.pseudo] : [];
      });
  }

  /** Story 44.6 — ce que le serveur permet à CETTE personne de conclure (`can`, jamais déduit du rôle). « Fixer la
   *  date… » aussi après la fin du vote ; « Prolonger le vote » jamais en JDR (`can.extend` y est toujours faux). */
  private destinyActions(entry: OpenPollEntry): DestinyBoardActions | null {
    const tone = this.theme.tone();
    const fixLabel =
      entry.can.choose && entry.options.length > 0
        ? tone['partie.ralliement_event_fix_date_btn']
        : null;
    const extendLabel =
      entry.can.extend && entry.family === 'ralliement'
        ? tone['partie.ralliement_event_extend_btn']
        : null;
    // Story 45.6 — l'organisateur du vote (`can.edit`) modifie ses dates et, s'il reste un rendez-vous à proposer,
    // en propose pour un autre. Jamais un bouton pour qui n'a pas le droit.
    const modifyLabel = entry.can.edit ? tone['calendar.view_modify_dates'] : null;
    const otherLabel =
      entry.can.edit && this.rendezvousRows().length > 0
        ? tone['calendar.destiny_other_rendezvous']
        : null;
    return fixLabel || extendLabel || modifyLabel || otherLabel
      ? { fixLabel, extendLabel, modifyLabel, otherLabel }
      : null;
  }

  private destinyAbsent(entry: OpenPollEntry): DestinyBoardAbsent | null {
    const tone = this.theme.tone();
    const missing = Math.max(0, entry.eligibleCount - entry.answeredCount);
    if (missing === 0) return null;
    const atelier = this.partieId() !== null;
    // Les noms : l'organisateur, à l'atelier. La vitrine n'en porte jamais (AD-9).
    if (atelier && entry.can.choose) {
      const names = this.absentNames(entry);
      if (names.length > 0) {
        return { text: `${tone['poll.missing_prefix']} ${names.join(', ')}`, whoLabel: null };
      }
    }
    return {
      text: fillTone(tone[`calendar.destiny_board_absent_${missing === 1 ? 'one' : 'many'}`], {
        n: missing,
      }),
      whoLabel: !atelier && entry.can.choose ? tone['calendar.destiny_board_who'] : null,
    };
  }

  protected readonly destinyBoard = computed<DestinyBoardModel | null>(() => {
    const entry = this.destinyEntry();
    if (!entry) return null;
    const tone = this.theme.tone();
    const slots = this.destinySlots();
    const currentId = this.destinyOptionId();
    const best = bestOption(slots, this.todayKey);
    const eligible = entry.eligibleCount;
    const answers = fillTone(
      tone[`calendar.destiny_board_answers_${entry.answeredCount <= 1 ? 'one' : 'many'}`],
      { n: entry.answeredCount, total: eligible },
    );
    const deadline = entry.expiresAt?.substring(0, 10) ?? null;
    const subtitle =
      deadline === null
        ? answers
        : deadline < this.todayKey
          ? fillTone(tone['calendar.destiny_board_ended'], { date: shortDayLabel(deadline) })
          : fillTone(tone['calendar.destiny_board_open'], {
              date: shortDayLabel(deadline),
              answers,
            });
    const position = this.destinySlotPosition();
    const current = position > 0 ? slots[position - 1] : null;
    // Story 47.5 — un candidat de plusieurs créneaux s'écrit de son début à sa fin ; sa pire disponibilité sur la
    // plage ne se lit qu'en JDR, avec la carte de chaleur de CETTE partie déjà chargée (jamais au groupe).
    const duration = entry.durationSlots;
    const heat = this.heatmap();
    const showWorst =
      duration > 1 && entry.family === 'jdr' && this.partieId() === entry.partieId && heat.length > 0;
    return {
      title: entry.title,
      subtitle,
      slotsAria: tone['calendar.destiny_board_slots_aria'],
      bestLabel: tone['calendar.destiny_board_best'],
      slots: slots.map((o) => ({
        optionId: o.optionId,
        label: candidateSpanShort(o, duration) ?? `${shortDayLabel(o.date)} · ${SLOT_LABELS[o.slot]}`,
        yesText: fillTone(tone['calendar.destiny_board_yes'], { n: o.yes }),
        availabilityText: this.worstAvailabilityText(showWorst ? heat : null, o, duration),
        ratio: eligible > 0 ? Math.min(1, o.yes / eligible) : 0,
        best: best?.optionId === o.optionId,
        current: o.optionId === currentId,
      })),
      absent: this.destinyAbsent(entry),
      actions: this.destinyActions(entry),
      // Story 45.4 — un vote de JDR terminé n'a pas de « Prolonger » : on le rouvre en repoussant sa fin.
      reopenHint:
        entry.family === 'jdr' && entry.can.edit && deadline !== null && deadline < this.todayKey
          ? tone['calendar.destiny_reopen_vote']
          : null,
      announcement: current
        ? this.announceCandidate(position, slots.length, current, duration)
        : '',
    };
  });

  /** Story 47.5 — « 2 dispos sur toute la plage », ou `null` (créneau seul, carte non chargée, cellule manquante). */
  private worstAvailabilityText(
    heat: readonly AggregatedSlotDto[] | null,
    option: { date: string; slot: DaySlot },
    durationSlots: number,
  ): string | null {
    if (!heat || durationSlots <= 1) return null;
    const worst = worstAvailability(heat, option, durationSlots);
    return worst === null ? null : worstAvailabilityLabel(worst);
  }

  /** Story 47.5 — l'annonce du créneau courant : la phrase d'un créneau seul est celle d'avant ; une plage dit
   *  « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui ». */
  private announceCandidate(
    n: number,
    total: number,
    current: { date: string; slot: DaySlot; yes: number },
    durationSlots: number,
  ): string {
    const tone = this.theme.tone();
    const sentence = candidateSpanSentence(current, durationSlots);
    if (sentence) {
      return fillTone(DURATION_TEXT.announceSpan, {
        n,
        total,
        range: sentence,
        yes: fillTone(tone['calendar.destiny_board_yes'], { n: current.yes }),
      });
    }
    return fillTone(tone['calendar.destiny_board_announce'], {
      n,
      total,
      date: DESTINY_ANNOUNCE_DATE_FORMAT.format(new Date(`${current.date}T00:00:00Z`)),
      slot: SLOT_LABELS[current.slot].toLowerCase(),
      yes: current.yes,
    });
  }

  // ─── Story 44.5 — le tiroir de la destinée, sous 768 px ───────────────────────
  //
  // ⚠️ Là où le plateau n'a pas de place (colonne empilée sous la grille), la Destinée active s'affiche dans un
  // tiroir du bas non modal. Mêmes conditions que le plateau, largeur inverse ; le modèle du plateau sert tel quel
  // une fois déplié. Le reste de la colonne de droite reste empilé sous la grille, comme avant.

  /** Replié par défaut, et à chaque entrée dans la Destinée (`enterDestiny`) comme à chaque sortie. */
  protected readonly destinySheetExpanded = signal(false);

  protected readonly destinySheetShown = computed(
    () => !this.isWide() && this.destinyPresentable(),
  );

  protected toggleDestinySheet(): void {
    this.destinySheetExpanded.update((open) => !open);
  }

  protected readonly destinySheet = computed<DestinySheetModel | null>(() => {
    const entry = this.destinyEntry();
    const board = this.destinyBoard();
    if (!entry || !board) return null;
    const tone = this.theme.tone();
    const slots = this.destinySlots();
    const position = this.destinySlotPosition();
    const current = position > 0 ? slots[position - 1] : null;
    const deadline = entry.expiresAt?.substring(0, 10) ?? null;
    // « 2 / 5 · sam. 18 oct. soir · 4 oui · fin du vote ven. 30 oct. » : chaque morceau absent est omis.
    const parts = [
      current ? `${position} / ${slots.length}` : null,
      current
        ? (candidateSpanShort(current, entry.durationSlots) ??
          `${shortDayLabel(current.date)} ${SLOT_LABELS[current.slot].toLowerCase()}`)
        : null,
      current ? fillTone(tone['calendar.destiny_board_yes'], { n: current.yes }) : null,
      deadline === null
        ? null
        : deadline < this.todayKey
          ? tone['calendar.destiny_sheet_deadline_ended']
          : fillTone(tone['calendar.destiny_sheet_deadline_open'], {
              date: shortDayLabel(deadline),
            }),
    ].filter((p): p is string => p !== null);
    const state = this.destinyStateOf(entry);
    return {
      region: fillTone(tone['calendar.destiny_sheet_region'], { name: entry.title }),
      title: entry.title,
      summary: parts.join(' · '),
      state,
      stateLabel: tone[`calendar.destiny_state_${state.replace('-', '_')}`],
      datesLabel: fillTone(
        tone[`calendar.destiny_sheet_dates_${slots.length === 1 ? 'one' : 'many'}`],
        { n: slots.length },
      ),
      hideLabel: tone['calendar.destiny_sheet_hide'],
      fixLabel: board.actions?.fixLabel ?? null,
      collapseAria: tone['calendar.destiny_sheet_collapse_aria'],
      announcement: board.announcement,
      board,
    };
  });

  /** Toucher un créneau du plateau : il devient le créneau courant et la grille se place sur son jour. */
  protected chooseDestinySlot(optionId: string): void {
    const option = this.destinySlots().find((o) => o.optionId === optionId);
    if (!option) return;
    this.destinyOptionId.set(option.optionId);
    this.moveGridTo(option.date);
  }

  // ─── Story 44.6 — conclure le vote depuis le plateau ou le tiroir ─────────────────────────────

  /** Le message de fermeture de la Destinée (une fois, fermable) ; effacé à la prochaine entrée en Destinée. */
  protected readonly destinyNotice = signal<string | null>(null);

  // ─── Story 44.7 — arriver en Destinée par un lien ─────────────────────────────────────────────
  //
  // `?poll` / `?pollList` sont lus à l'initialisation puis réécrits par `Location.replaceState`, JAMAIS par une
  // navigation du routeur (elle vide le bandeau contextuel). Tant qu'un lien attend sa résolution, l'adresse reste
  // intacte : sinon la synchro qui suit le mode l'effacerait avant qu'il n'ait servi.

  /** Le lien lu à l'init et pas encore résolu ; `null` une fois appliqué (ou refusé). */
  private readonly linkPending = signal<{ poll: string | null; list: boolean } | null>(null);
  /** Les données de la partie (scénarios, conjonctions…) sont lues : à l'atelier, un vote ne s'ouvre pas avant. */
  private readonly partieDataLoaded = signal(false);

  /** Réécrit la chaîne de requête de l'adresse courante, sans navigation, en gardant tout le reste. */
  private writeQuery(mutate: (params: URLSearchParams) => void): void {
    const full = this.location.path();
    const cut = full.indexOf('?');
    // `replaceState('')` ne change rien (une URL vide désigne l'adresse courante) : la racine, au pire.
    const path = (cut < 0 ? full : full.slice(0, cut)) || '/';
    const params = new URLSearchParams(cut < 0 ? '' : full.slice(cut + 1));
    const before = params.toString();
    mutate(params);
    const after = params.toString();
    if (after !== before) this.location.replaceState(path, after);
  }

  /**
   * Résout le lien. Un vote s'ouvre s'il est servi à la personne ET dans la liste de CETTE page (à l'atelier, de
   * cette partie) : un lien ne peut jamais ouvrir le vote d'une autre partie. Sinon : calendrier normal, un message
   * écrit une fois, paramètre retiré — rien n'est dit du vote.
   */
  private applyLink(pending: { poll: string | null; list: boolean }): void {
    this.linkPending.set(null);
    if (pending.poll) {
      const pollId = pending.poll;
      const entry = this.openPollsSvc.entries().find((e) => e.pollId === pollId);
      const here = this.partieId();
      const known = this.destinyPolls().some((p) => p.pollId === pollId);
      if (entry && known && (here === null || entry.partieId === here)) {
        // Entrée comme depuis la liste : vue Mois (Semaine en soirée), tiroir replié, créneau d'entrée.
        this.chooseDestiny(pollId);
        this.writeQuery((params) => params.delete('pollList'));
        return;
      }
      this.destinyNotice.set(this.theme.tone()['calendar.destiny_link_unknown']);
      this.writeQuery((params) => {
        params.delete('poll');
        params.delete('pollList');
      });
      return;
    }
    if (pending.list && this.destinyListItems().length > 0) this.destinyListOpen.set(true);
    this.writeQuery((params) => params.delete('pollList'));
  }

  /**
   * ⚠️ « Fixer la date… » : la confirmation EXISTANTE — `DateFixDialog` pour un groupe (e-mail « date fixée »),
   * `SealConfirmDialog` en mode liste pour un JDR (séance scellée, vote fermé). Les deux écrivent par la route
   * partagée `PATCH …/poll/:pollId/choose`, avec le `partieId` de l'ENTRÉE (la vitrine n'a pas de route de partie).
   * Le serveur reste juge : son refus reste affiché dans la fenêtre.
   */
  protected async openDestinyFix(): Promise<void> {
    const entry = this.destinyEntry();
    if (!entry || !entry.can.choose || this.pollActionPending()) return;
    const todayKey = this.todayKey;
    const slots = rankedEntrySlots(entry.options, todayKey, entry.durationSlots);
    const confirm = (optionId: string) =>
      this.pollSvc.chooseDate(entry.partieId, entry.pollId, { optionId });
    // Posé AVANT d'ouvrir la fenêtre : deux touchers rapprochés n'en ouvrent pas deux.
    this.pollActionPending.set(true);
    try {
      const ref =
        entry.family === 'ralliement'
          ? this.dialog.open<DateFixDialog, DateFixData, boolean>(DateFixDialog, {
              data: { title: entry.title, slots, todayKey, confirm },
              width: 'min(560px, 96vw)',
              autoFocus: 'first-tabbable',
              restoreFocus: true,
            })
          : this.dialog.open<SealConfirmDialog, SealSlotsData, boolean>(SealConfirmDialog, {
              data: { pollLabel: entry.title, slots, todayKey, confirm },
              width: 'min(560px, 96vw)',
              autoFocus: 'first-tabbable',
              restoreFocus: true,
            });
      if (await firstValueFrom(ref.afterClosed())) await this.refreshAfterDestinyWrite();
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** « Prolonger le vote » (soirée seulement) : `ExtendVoteDialog` (Story 40.7), route `PATCH …/extend`. */
  protected async openDestinyExtend(): Promise<void> {
    const entry = this.destinyEntry();
    if (!entry || !entry.can.extend || entry.family !== 'ralliement' || this.pollActionPending()) {
      return;
    }
    const deadlineKey = entry.expiresAt?.substring(0, 10) ?? null;
    this.pollActionPending.set(true);
    try {
      const ref = this.dialog.open<ExtendVoteDialog, ExtendVoteData, boolean>(ExtendVoteDialog, {
        data: {
          title: entry.title,
          deadlineKey,
          minKey: extendMinKeyFrom(deadlineKey, this.todayKey),
          confirm: (day) =>
            this.injector.get(EventsApiService).extend(entry.partieId, entry.pollId, day),
        },
        width: 'min(560px, 96vw)',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      });
      if (await firstValueFrom(ref.afterClosed())) await this.refreshAfterDestinyWrite();
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** Relire ce que la page montre après une écriture : à l'atelier les votes de la partie, dans la vitrine mes
   *  sondages ouverts et mon calendrier. Un vote clos disparaît alors, et la Destinée se ferme avec sa raison. */
  private async refreshAfterDestinyWrite(): Promise<void> {
    const partieId = this.partieId();
    if (partieId) {
      await this.reloadVotes(partieId);
      await this.refreshMjPanels();
      await this.openPollsSvc.refresh();
      return;
    }
    await this.openPollsSvc.refresh();
    await this.loadMeCalendarForRange(this.fromDateStr(), this.toDateStr());
  }

  /**
   * Pourquoi le vote de la Destinée n'est plus ouvert, d'après ce que l'atelier a déjà chargé (scénarios d'un JDR,
   * conjonctions d'un groupe) : date fixée, rendez-vous annulé, sinon clos (y compris supprimé). La vitrine, elle,
   * ne lit pas de charge utile par vote : elle dit seulement « n'est plus ouvert ».
   */
  private destinyCloseReason(pollId: string): string {
    const tone = this.theme.tone();
    if (this.isGroup()) {
      const card = this.groupEvents().find((c) => c.poll?.id === pollId);
      if (card?.cancelled) return tone['calendar.destiny_closed_cancelled'];
      if (card?.seance?.date) return tone['calendar.destiny_closed_fixed'];
      return tone['calendar.destiny_closed_generic'];
    }
    for (const scenario of this.scenarios()) {
      for (const seance of scenario.seances) {
        if (
          seance.poll?.id === pollId &&
          seance.poll.status === 'CLOSED' &&
          seance.poll.chosenDate
        ) {
          return tone['calendar.destiny_closed_fixed'];
        }
      }
    }
    return tone['calendar.destiny_closed_generic'];
  }

  /** « voir qui » (vitrine, organisateur) : la page de la partie, en attendant l'atelier sur ce vote (44.7). */
  protected openDestinyWho(): void {
    const entry = this.destinyEntry();
    if (!entry) return;
    // Story 44.7 — l'atelier de CE vote : le MJ d'un JDR vit à `/calendar`, un groupe à `/guild-calendar`. Le serveur
    // ne donne `can.choose` d'un JDR qu'au MJ, d'où son rôle ici.
    const role = entry.family === 'jdr' && entry.can.choose ? 'mj' : 'player';
    void this.router.navigateByUrl(
      atelierUrl({ partieId: entry.partieId, family: entry.family, role }, { poll: entry.pollId }),
    );
  }

  /** « Quitter la Destinée » : le mode s'arrête, la liste se referme. */
  protected quitDestiny(): void {
    this.exitDestiny();
    this.closeDestinyList();
  }

  /** ⚠️ Story 44.4 — les chevrons parcourent les CRÉNEAUX du vote actif (on change de vote par la liste), en
   *  boucle. Le créneau courant est un `optionId` ; n/N se déduit de l'ordre chronologique. */
  private stepDestiny(delta: 1 | -1): void {
    const slots = this.destinySlots();
    if (slots.length < 2) return;
    const i = slots.findIndex((o) => o.optionId === this.destinyOptionId());
    const next = i < 0 ? slots[0] : slots[(i + delta + slots.length) % slots.length];
    this.chooseDestinySlot(next.optionId);
  }

  protected destinyNext(): void {
    this.stepDestiny(1);
  }
  protected destinyPrev(): void {
    this.stepDestiny(-1);
  }

  // ─── Story 36.10 — le mode de composition d'un vote ───────────────────────
  //
  // 🚨 IL RÉASSIGNE LE TAP. C'est le SEUL mode de l'application qui en a le droit
  // (`EXPERIENCE.md:538`, principe 4 ; collision 5). Le contraste avec la Destinée est entier :
  // celle-ci ne change QUE l'affichage, celui-ci change ce que fait le doigt. Les deux états sont
  // indépendants et peuvent coexister — ne jamais les fusionner.
  //
  // 🚨 MJ ET CONTEXTE DE PARTIE UNIQUEMENT (AC10). L'écriture exige `getOwned` et un `partieId` ;
  // le calendrier personnel agrège des votes de PLUSIEURS parties et n'a pas de cible.
  protected readonly composing = signal(false);
  /** Ce que la composition vise : un vote ouvert à modifier, ou un vote à créer. */
  protected readonly composeTarget = signal<ComposeTarget | null>(null);
  /** Les créneaux composés, dans la forme que `SelectedCell` porte déjà partout ailleurs. */
  protected readonly composedCells = signal<SelectedCell[]>([]);

  /** Ce qui descend dans les deux grilles — un ensemble de clés, jamais la liste : les vues n'ont
   *  qu'un test d'appartenance à faire, et la dérivation reste unique (doctrine `destinyDates()`). */
  protected readonly composedKeys = computed<ReadonlySet<string> | null>(() => {
    if (!this.composing()) return null;
    return new Set(this.composedCells().map((c) => composeCellKey(c.date, c.slot)));
  });

  // ─── ⚠️ Story 47.4 — la durée dans le composer ────────────────────────────────────────────────

  /** La durée composée, en créneaux : chaque créneau désigné est le DÉPART d'une plage de cette durée. Toujours
   *  initialisée à celle du rendez-vous visé (`Seance.durationSlots`, ou celle du brouillon d'une conjonction). */
  protected readonly composeDuration = signal(1);
  /** La durée du rendez-vous visé à l'armement : la comparer à `composeDuration` dit si elle change (payload,
   *  avertissement de perte). */
  private readonly composeTargetDuration = signal(1);

  /** ⚠️ Story 47.6 — la durée que la liste de l'automate demande au serveur : celle du composer pendant la composition,
   *  1 sinon. Le serveur est seul à classer les fenêtres (pire statut sur la plage) : aucune règle ici. */
  protected readonly slotsSpan = computed(() => (this.composing() ? this.composeDuration() : 1));

  /** Les créneaux qu'allument les plages des départs désignés (départs exclus) — vide à 1 créneau. */
  protected readonly composeCoverKeys = computed<ReadonlySet<string> | null>(() =>
    this.composing() ? composeSpanKeys(this.composedCells(), this.composeDuration()) : null,
  );

  /** Le premier départ désigné : la plage s'écrit depuis lui, en clair, sous le compteur. Une journée entière n'en est
   *  pas un — sinon le compteur plafonnerait à 1 et l'on ne pourrait plus allonger (ce qui la retire). */
  protected readonly composeDurationStart = computed<SpanStart | null>(() => {
    const first = earliestStart(this.composedCells().filter((c) => c.slot !== 'FULL_DAY'));
    return first ? { date: toDateKey(first.date), slot: first.slot } : null;
  });

  /** La durée change-t-elle ? Elle ne part dans l'écriture QUE dans ce cas (absente = inchangée côté serveur). */
  private composeDurationPayload(): { durationSlots?: number } {
    const n = this.composeDuration();
    return n !== this.composeTargetDuration() ? { durationSlots: n } : {};
  }

  /** La durée du rendez-vous qu'une cible vise, lue de la charge déjà chargée (1 à défaut). */
  private targetDurationOf(target: ComposeTarget): number {
    switch (target.kind) {
      case 'poll': {
        const entry = this.activePolls().find((e) => e.poll.id === target.pollId);
        return entry?.poll.durationSlots ?? entry?.seance.durationSlots ?? 1;
      }
      case 'new':
        return (
          this.scenarios()
            .flatMap((s) => s.seances)
            .find((s) => s.id === target.seanceId)?.durationSlots ?? 1
        );
      case 'group-poll': {
        const entry = this.groupPolls().find((e) => e.card.id === target.eventId);
        return entry?.poll.durationSlots ?? entry?.card.seance?.durationSlots ?? 1;
      }
      case 'evening-poll':
        return this.groupEvents().find((c) => c.id === target.eventId)?.seance?.durationSlots ?? 1;
      case 'group-new':
        return 1;
    }
  }

  /** Arme la ligne « Durée » sur la durée du rendez-vous visé. */
  private armDuration(durationSlots: number): void {
    this.composeDuration.set(durationSlots);
    this.composeTargetDuration.set(durationSlots);
  }

  /** Une nouvelle durée choisie au compteur. Au-delà d'un créneau, une journée entière déjà désignée quitte la
   *  composition, et le message l'écrit (jamais un retrait muet). Rien n'est écrit au serveur. */
  protected onComposeDurationChanged(durationSlots: number): void {
    if (!this.composing()) return;
    this.composeDuration.set(durationSlots);
    if (durationSlots <= 1) {
      // Revenu à 1 créneau : les messages propres à la durée n'ont plus d'objet.
      const refusal = this.composeRefusal();
      if (refusal === DURATION_TEXT.fullDayRemoved || refusal === DURATION_TEXT.fullDayRefused) {
        this.composeRefusal.set(null);
      }
      return;
    }
    const cells = this.composedCells();
    const kept = cells.filter((c) => c.slot !== 'FULL_DAY');
    if (kept.length < cells.length) {
      this.composedCells.set(kept);
      this.composeRefusal.set(DURATION_TEXT.fullDayRemoved);
    }
  }

  /** Les options d'un vote de JDR, dans la forme de la règle de perte (`composeLoss`). */
  private jdrLossOptions(poll: ActivePollEntry['poll'] | undefined): LossOption[] {
    return (poll?.options ?? []).map((o) => ({
      date: o.date,
      slot: o.slot,
      answers: o.votes.length,
    }));
  }

  /** Les options du sondage d'une conjonction, dans la forme de la règle de perte. */
  private groupLossOptions(poll: EventPollDto): LossOption[] {
    return poll.options.map((o) => ({
      date: o.date,
      slot: o.slot,
      answers: poll.votes.filter((v) => v.optionId === o.id).length,
    }));
  }

  /** Le vote ouvert visé, ou `null` (cible « nouveau vote », ou vote disparu). */
  private readonly composedPollEntry = computed(() => {
    const target = this.composeTarget();
    if (target?.kind !== 'poll') return null;
    return this.activePolls().find((e) => e.poll.id === target.pollId) ?? null;
  });

  /** Story 40.5b — la conjonction dont le sondage est en cours de composition, ou `null`. */
  private readonly composedGroupEntry = computed(() => {
    const target = this.composeTarget();
    if (target?.kind !== 'group-poll') return null;
    return this.groupPolls().find((e) => e.card.id === target.eventId) ?? null;
  });

  protected readonly composeTargetLabel = computed(() => {
    const tone = this.theme.tone();
    const group = this.composeTarget();
    if (group?.kind === 'group-poll') {
      return fillTone(tone['partie.ralliement_calendar_compose_target_poll'], {
        title: this.composedGroupEntry()?.card.title ?? '',
      });
    }
    if (group?.kind === 'group-new') return tone['partie.ralliement_calendar_compose_target_new'];
    if (group?.kind === 'evening-poll') {
      return fillTone(tone['calendar.compose_target_evening'], {
        title: this.groupEvents().find((c) => c.id === group.eventId)?.title ?? '',
      });
    }
    const entry = this.composedPollEntry();
    if (entry) {
      return fillTone(tone['calendar.view_compose_target_poll'], {
        label: this.pollEntryLabel(entry),
      });
    }
    const target = this.composeTarget();
    if (target?.kind === 'new') {
      const row = this.rendezvousRows().find((r) => r.seanceId === target.seanceId);
      if (row) return fillTone(tone['calendar.view_compose_target_poll'], { label: row.title });
    }
    return tone['calendar.view_compose_target_new'];
  });

  /** Titre d'un scénario suivi du rang de la séance — « Titre — Séance 2 ». */
  private scenarioSeanceTitle(title: string, index: number): string {
    return fillTone(this.theme.tone()['common.title_seance_index'], { title, index });
  }

  /** Étiquette d'un vote actif : le scénario, et la séance seulement s'il en a plusieurs. */
  protected pollEntryLabel(entry: ActivePollEntry): string {
    return entry.scenario.seances.length > 1
      ? this.scenarioSeanceTitle(entry.scenario.title, entry.seanceIndex)
      : entry.scenario.title;
  }

  /** Story 40.5b — la composition vise la conjonction d'un groupe (ouverte, ou à créer). */
  private isGroupTarget(): boolean {
    const kind = this.composeTarget()?.kind;
    return kind === 'group-poll' || kind === 'group-new' || kind === 'evening-poll';
  }

  // ─── Story 45.4 — la fin du vote dans le composer ─────────────────────────────────────────────

  /** Le jour que l'organisateur a choisi (ou celui d'un vote existant), `YYYY-MM-DD` ; `null` tant que rien n'est fixé. */
  private readonly composeDeadlineDay = signal<string | null>(null);
  /** L'organisateur a touché la date, ou le vote existait déjà avec sa fin : la date ne suit plus les créneaux. */
  private readonly composeDeadlineFixed = signal(false);

  /** Une fin de vote se règle dans tous les composers qui ÉCRIVENT (vote de JDR, conjonction ouverte). La composition
   *  d'une conjonction à créer n'écrit rien : sa fin se règle dans la fenêtre de création. */
  protected readonly composeHasDeadline = computed(() => {
    const kind = this.composeTarget()?.kind;
    return kind === 'new' || kind === 'poll' || kind === 'group-poll' || kind === 'evening-poll';
  });

  /** LA fin du vote : celle de l'organisateur, sinon la proposée (`defaultPollDeadline`), qui suit les créneaux. */
  protected readonly composeDeadline = computed(() => {
    if (this.composeDeadlineFixed()) {
      const day = this.composeDeadlineDay();
      if (day) return day;
    }
    return defaultPollDeadline(
      this.composedCells().map((c) => ({ date: toDateKey(c.date) })),
      this.todayKey,
    );
  });

  /** La fin est passée : « Valider » est bloqué jusqu'à ce qu'elle soit repoussée (le serveur refuse aussi). */
  protected readonly composeDeadlinePast = computed(
    () => this.composeHasDeadline() && this.composeDeadline() < this.todayKey,
  );

  /** L'explication du défaut, seulement tant que la date est celle qu'on propose et que personne n'y a touché. */
  protected readonly composeDeadlineHint = computed(() => {
    if (!this.composeHasDeadline() || this.composeDeadlineFixed()) return '';
    const tone = this.theme.tone();
    const day = this.composeDeadline();
    if (day === this.todayKey) return tone['calendar.compose_deadline_hint_today'];
    return day === defaultPollDeadline([], this.todayKey)
      ? tone['calendar.compose_deadline_hint_14']
      : tone['calendar.compose_deadline_hint_eve'];
  });

  protected onComposeDeadlineChanged(day: string): void {
    this.composeDeadlineDay.set(day);
    this.composeDeadlineFixed.set(true);
  }

  /** AC14 côté client : la borne serveur est 2..40, et la création exige une séance. Un bouton
   *  qu'on ne peut pas presser doit dire pourquoi (`composeBlockedReason`), jamais rester inerte. */
  protected readonly composeCanConfirm = computed(() => {
    const n = this.composedCells().length;
    // Story 40.5b — un groupe : au moins deux créneaux, aucun plafond métier (le serveur garde le sien).
    if (this.composeDeadlinePast()) return false;
    if (this.isGroupTarget()) return n >= GROUP_MIN_SLOTS;
    return n >= 2 && n <= 40;
  });

  protected readonly composeBlockedReason = computed(() => {
    const tone = this.theme.tone();
    const n = this.composedCells().length;
    if (this.isGroupTarget()) {
      if (n < GROUP_MIN_SLOTS) return tone['partie.ralliement_event_poll_min_hint'];
      return this.composeDeadlinePast() ? tone['calendar.compose_deadline_past'] : '';
    }
    if (n < 2) return tone['calendar.view_compose_blocked_min'];
    if (n > 40) return tone['calendar.view_compose_blocked_max'];
    return this.composeDeadlinePast() ? tone['calendar.compose_deadline_past'] : '';
  });

  /** Le point d'entrée n'existe que là où la composition a un sens (AC10) : à l'atelier, et s'il y a quelque chose à
   *  proposer ou à modifier — décidé par les droits servis (`can`), jamais par le mode de la route (Story 45.2). */
  protected readonly canCompose = computed(
    () =>
      this.partieId() !== null &&
      (this.modifiablePoll() !== null || this.rendezvousRows().length > 0),
  );

  // ─── Story 45.1 — « Proposer des dates » ────────────────────────────────────────────────────────
  //
  // ⚠️ UN bouton écrit, dans les trois calendriers, remplace « Inscrire des dates » (MJ) et les boutons
  // « Composer les créneaux : {titre} » de l'hôte. Il ouvre le choix du rendez-vous à dater (sauté s'il n'y en
  // a qu'un). À l'atelier la liste se DÉRIVE de la charge utile déjà chargée, avec le prédicat partagé
  // `isDatableSeance` ; dans la vitrine elle vient de `GET /me/datable-seances`. Choisir arme le composer à
  // l'atelier ; dans la vitrine, cela ouvre l'atelier (`?seanceId`, que la 45.2 transforme en composer armé).
  // Quand la destinée active est un vote que l'organisateur peut modifier ici, le même bouton devient
  // « Modifier les dates » et arme le composer sur ce vote (comportement d'avant, sous son nouveau nom).
  private readonly datableSvc = inject(DatableSeancesService);

  /** Nom et état de la partie de l'atelier — le nom titre le choix, l'état « figé » écarte les rendez-vous. */
  private readonly partieMeta = signal<{ name: string; frozen: boolean } | null>(null);

  protected readonly rendezvousPickerOpen = signal(false);
  /** Story 46.3 — le choix sert « Proposer des dates » (rendez-vous à dater) ou « Ajouter au vote » d'une fenêtre de
   *  l'automate (rendez-vous composables : à dater, ou au vote ouvert). */
  protected readonly rendezvousPickerMode = signal<'propose' | 'window'>('propose');
  /** Story 46.3 — la fenêtre que le MJ veut verser au vote, en attente du choix du rendez-vous. */
  private readonly pendingWindow = signal<{
    date: string;
    slot: DaySlot;
    durationSlots: number;
  } | null>(null);
  private readonly proposeButtonRef = viewChild('proposeBtn', {
    read: ElementRef<HTMLButtonElement>,
  });
  /** L'ancre du menu du choix : le bouton lui-même. */
  protected readonly proposeAnchor = computed(() => this.proposeButtonRef()?.nativeElement ?? null);

  /** « Titre — Séance 2 » seulement quand le scénario a plusieurs séances (comme `pollEntryLabel`). */
  private readonly rendezvousTitle: RendezvousTitle = (title, rank, count) =>
    count > 1 ? this.scenarioSeanceTitle(title, rank) : title;

  /** Les rendez-vous que le bouton propose de dater, dans le contexte affiché (atelier ou vitrine). */
  protected readonly rendezvousRows = computed<RendezvousRow[]>(() => {
    const id = this.partieId();
    if (id === null) {
      return this.datableSvc.entries().map((e) => rowFromEntry(e, this.rendezvousTitle));
    }
    const meta = this.partieMeta();
    const partie = { id, name: meta?.name ?? '' };
    const frozen = meta?.frozen ?? false;
    const rows = this.isGroup()
      ? groupRendezvous(this.groupEvents(), partie, frozen)
      : jdrRendezvous(this.scenarios(), partie, frozen, this.rendezvousTitle);
    return rows;
  });

  /** Story 46.3 — les rendez-vous COMPOSABLES de l'atelier (JDR) : à dater, ou au vote ouvert modifiable
   *  (`isComposableSeance`). Seul le MJ d'un JDR a des fenêtres de l'automate à verser. */
  protected readonly composableRows = computed<RendezvousRow[]>(() => {
    const id = this.partieId();
    if (id === null || this.isGroup()) return [];
    const meta = this.partieMeta();
    return jdrComposable(
      this.scenarios(),
      { id, name: meta?.name ?? '' },
      meta?.frozen ?? false,
      this.rendezvousTitle,
    );
  });

  /** Les lignes du choix, selon ce qu'il sert. */
  protected readonly rendezvousPickerRows = computed<RendezvousRow[]>(() =>
    this.rendezvousPickerMode() === 'window' ? this.composableRows() : this.rendezvousRows(),
  );

  /** La destinée active est un vote que l'organisateur peut modifier DEPUIS CET ATELIER (`can.edit`), ou `null`. */
  private readonly modifiablePoll = computed<ComposeTarget | null>(() => {
    const destinyId = this.destinyPollId();
    if (destinyId === null || this.partieId() === null) return null;
    if (this.isGroup()) {
      const entry = this.groupPolls().find((e) => e.poll.id === destinyId && e.card.can.edit);
      return entry ? { kind: 'group-poll', eventId: entry.card.id } : null;
    }
    const entry = this.activePolls().find((e) => e.poll.id === destinyId && e.seance.can.edit);
    return entry ? { kind: 'poll', pollId: entry.poll.id } : null;
  });

  /** Le bouton de la ligne de contrôles : « Proposer des dates », « Modifier les dates », ou rien — jamais
   *  pendant une composition (le mode se voit tant qu'il dure). */
  protected readonly proposeButton = computed<'propose' | 'modify' | null>(() => {
    if (this.composing()) return null;
    if (this.modifiablePoll()) return 'modify';
    // Story 45.6 — dans la vitrine, la destinée active dont j'ai `can.edit` : « Modifier les dates » ouvre son atelier.
    if (this.partieId() === null && this.destinyEntry()?.can.edit) return 'modify';
    return this.rendezvousRows().length > 0 ? 'propose' : null;
  });

  /** Le choix n'a de sens que s'il y a des lignes : sans elles le bouton a disparu, et le menu perdrait son ancre. */
  protected readonly rendezvousPickerShown = computed(
    () => this.rendezvousPickerOpen() && this.rendezvousPickerRows().length > 0,
  );

  protected onProposeClicked(): void {
    const mode = this.proposeButton();
    if (mode === 'modify') {
      this.openDestinyModify();
      return;
    }
    if (mode === 'propose') this.proposeOther();
  }

  /**
   * ⚠️ Story 45.6 — « Modifier les dates » du vote que la Destinée met en avant : UN comportement pour le bouton de la
   * ligne de contrôles et pour le plateau. À l'atelier il arme le composer prérempli (créneaux et fin du vote) ; dans
   * la vitrine il ouvre l'atelier de ce vote (`?seanceId` arme le composer, `?poll` garde la Destinée) — la vitrine
   * n'arme jamais de composer.
   */
  protected openDestinyModify(): void {
    if (this.composing()) return;
    if (this.partieId() !== null) {
      const target = this.modifiablePoll();
      if (target) this.armTarget(target);
      return;
    }
    const entry = this.destinyEntry();
    if (!entry?.can.edit) return;
    // Seul le MJ d'un JDR a `can.edit` sur une séance de JDR : son atelier vit à `/calendar`.
    const role = entry.family === 'jdr' ? 'mj' : 'player';
    void this.router.navigateByUrl(
      atelierUrl(
        { partieId: entry.partieId, family: entry.family, role },
        { seanceId: entry.seanceId, poll: entry.pollId },
      ),
    );
  }

  /** Proposer des dates pour un rendez-vous À DATER (le bouton, ou le lien « autre rendez-vous » du plateau) : un seul
   *  rendez-vous saute l'étape du choix ; le nouveau vote deviendra la destinée active (45.2). */
  protected proposeOther(): void {
    if (this.composing()) return;
    const rows = this.rendezvousRows();
    if (rows.length === 0) return;
    this.pendingWindow.set(null);
    this.rendezvousPickerMode.set('propose');
    if (rows.length === 1) this.pickRendezvous(rows[0]);
    else this.rendezvousPickerOpen.set(true);
  }

  /** Rendre le focus au bouton : sans quoi un utilisateur clavier retombe en haut du document. */
  protected closeRendezvousPicker(): void {
    this.rendezvousPickerOpen.set(false);
    // Story 46.3 — renoncer au choix garde la fenêtre sélectionnée : rien n'a été versé.
    this.pendingWindow.set(null);
    this.proposeButtonRef()?.nativeElement.focus();
  }

  protected onRendezvousPickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeRendezvousPicker();
    }
  }

  /** Choisir un rendez-vous : à l'atelier, le composer s'arme pour sa séance ; dans la vitrine, l'atelier de sa
   *  partie s'ouvre (la vitrine n'arme JAMAIS de composer). */
  protected pickRendezvous(row: RendezvousRow): void {
    this.rendezvousPickerOpen.set(false);
    const pending = this.pendingWindow();
    this.pendingWindow.set(null);
    if (this.partieId() === null) {
      // Seul le MJ d'un JDR a `can.propose` sur une séance de JDR : son atelier vit à `/calendar`.
      const role = row.family === 'jdr' ? 'mj' : 'player';
      void this.router.navigateByUrl(
        atelierUrl(
          { partieId: row.partieId, family: row.family, role },
          { seanceId: row.seanceId },
        ),
      );
      return;
    }
    this.startCompose(row.seanceId);
    // Story 46.3 — le composer est armé : la fenêtre qui a lancé le choix y entre.
    if (pending && this.composing()) this.addWindowCell(pending);
  }

  /**
   * ⚠️ Story 46.3 — « Ajouter au vote » : la fenêtre passe TOUJOURS par le composer. Composer ouvert : elle y entre
   * directement ; sinon, la destinée active est un vote de cette partie que l'on peut modifier : le composer s'arme avec
   * ses créneaux plus la fenêtre ; sinon, le choix du rendez-vous (sauté s'il n'y en a qu'un). Rien n'est écrit ici :
   * la validation du composer reste le seul chemin d'écriture.
   */
  protected addSelectedWindow(slot?: AvailableSlotDto): void {
    const window = slot
      ? { date: slot.date, slot: slot.slot, durationSlots: slot.durationSlots }
      : this.selectedWindow();
    if (!window) return;
    if (this.composing()) {
      this.addWindowCell(window);
      return;
    }
    const target = this.modifiablePoll();
    if (target) {
      this.armTarget(target);
      this.addWindowCell(window);
      return;
    }
    const rows = this.composableRows();
    if (rows.length === 0) return;
    this.pendingWindow.set(window);
    this.rendezvousPickerMode.set('window');
    if (rows.length === 1) this.pickRendezvous(rows[0]);
    else this.rendezvousPickerOpen.set(true);
  }

  /** Verse une fenêtre dans les créneaux composés (sans doublon) et la désélectionne : elle est désormais une cellule
   *  du composer, et quitte la liste de l'automate. */
  private addWindowCell(window: { date: string; slot: DaySlot; durationSlots: number }): void {
    // ⚠️ Story 47.6 — une fenêtre ne rejoint que la composition de SA durée : un départ de 2 créneaux dans un vote de
    // 3 raconterait une plage que le vote n'a pas. Le composer est déjà armé à la durée du rendez-vous (la liste se
    // relit à cette durée) ; la fenêtre ne l'y suit pas, et le dit.
    if (window.durationSlots !== this.composeDuration()) {
      this.composeRefusal.set(windowDurationRefusal(this.composeDuration()));
      this.selectedWindow.set(null);
      return;
    }
    const cell: SelectedCell = { date: dateKeyToLocalMidnight(window.date), slot: window.slot };
    const key = composeCellKey(cell.date, cell.slot);
    this.composedCells.update((cells) =>
      cells.some((c) => composeCellKey(c.date, c.slot) === key) ? cells : [...cells, cell],
    );
    this.composeRefusal.set(null);
    this.selectedWindow.set(null);
  }

  /** Lit le nom et l'état de la partie de l'atelier (le mode MJ ne lit pas la partie par ailleurs). Un échec
   *  laisse la partie « active » et sans nom : le choix reste utilisable. */
  private async loadPartieMeta(id: string): Promise<void> {
    try {
      const partie = await this.partiesSvc.get(id);
      if (this.partieId() === id) {
        this.partieMeta.set({ name: partie.name, frozen: !isPartieActive(partie.status) });
      }
    } catch {
      /* le choix se passe du nom */
    }
  }

  /**
   * ⚠️ Story 45.2 — la cible de composition d'un rendez-vous, décidée par ce que la charge utile a de plus frais ET
   * par les droits servis (`can`) — jamais par le mode de la route :
   * - un vote OUVERT que l'on peut modifier (`can.edit`) → le composer part de ses créneaux actuels ;
   * - un rendez-vous encore à dater (`can.propose`, scénario non clôturé) → un vote neuf ;
   * - sinon `null` : le rendez-vous n'est plus à dater ni modifiable.
   * Une soirée isolée sans date n'a pas encore de cible (Story 45.5).
   */
  private composeTargetFor(seanceId: string): ComposeTarget | null {
    if (this.isGroup()) {
      const entry = this.groupPolls().find((e) => e.card.seance?.id === seanceId);
      if (entry) return entry.card.can.edit ? { kind: 'group-poll', eventId: entry.card.id } : null;
      // Story 45.5 — une soirée isolée sans date ni vote que je peux proposer (la ligne vient du prédicat partagé).
      const row = this.rendezvousRows().find((r) => r.seanceId === seanceId);
      return row?.eventId ? { kind: 'evening-poll', eventId: row.eventId } : null;
    }
    const open = this.activePolls().find((e) => e.seance.id === seanceId);
    if (open) return open.seance.can.edit ? { kind: 'poll', pollId: open.poll.id } : null;
    return this.rendezvousRows().some((r) => r.seanceId === seanceId)
      ? { kind: 'new', seanceId }
      : null;
  }

  /**
   * Arme le composer sur une cible décidée. Modifier part de l'état RÉEL du vote : ses options actuelles sont
   * déjà composées, sans quoi « retiré s'il y était déjà » (AC2) n'aurait aucun référent et le MJ ne pourrait
   * qu'ajouter.
   *
   * 🚨 Les options viennent d'`activePolls()` / `groupPolls()`, jamais d'`allCalendarEntries()` : celles-ci sont
   * bornées par la plage affichée en contexte personnel, et une option hors plage manquerait au jeu de départ —
   * donc serait silencieusement SUPPRIMÉE à la validation.
   */
  private armTarget(target: ComposeTarget): void {
    let cells: SelectedCell[] = [];
    if (target.kind === 'poll') {
      const entry = this.activePolls().find((e) => e.poll.id === target.pollId);
      if (!entry) return;
      cells = entry.poll.options.map((o) => ({
        date: dateKeyToLocalMidnight(o.date.substring(0, 10)),
        slot: o.slot,
      }));
    } else if (target.kind === 'group-poll') {
      const entry = this.groupPolls().find((e) => e.card.id === target.eventId);
      if (!entry) return;
      cells = entry.poll.options.map((o) => ({
        date: dateKeyToLocalMidnight(o.date.substring(0, 10)),
        slot: o.slot,
      }));
    }
    this.composeTarget.set(target);
    this.composedCells.set(cells);
    this.composeRefusal.set(null);
    // Story 45.4 — un vote existant montre SA fin (et ne la fait plus suivre les créneaux) ; un vote neuf propose la
    // sienne et la fait suivre les créneaux tant qu'on n'y touche pas.
    const existingEnd =
      target.kind === 'poll'
        ? this.activePolls().find((e) => e.poll.id === target.pollId)?.poll.expiresAt
        : target.kind === 'group-poll'
          ? this.groupPolls().find((e) => e.card.id === target.eventId)?.poll.expiresAt
          : null;
    this.composeDeadlineDay.set(existingEnd ? existingEnd.substring(0, 10) : null);
    this.composeDeadlineFixed.set(!!existingEnd);
    // ⚠️ Story 47.4 — la ligne « Durée » part TOUJOURS de la durée du rendez-vous visé.
    this.armDuration(this.targetDurationOf(target));
    this.composing.set(true);
    // Un groupe se compose en vue Semaine (règle 40.5b) ; la vue Agenda n'a ni grille ni barre de composition.
    if (target.kind === 'group-poll' || target.kind === 'evening-poll') this.showGridForCompose();
    else if (this.view() === 'agenda') this.onViewChange('month');
  }

  /**
   * Arme le mode pour un rendez-vous précis (`seanceId`), ou — sans argument — sur le vote que la Destinée met
   * en avant (« Modifier les dates »).
   *
   * Story 36.12, AC13 — armée depuis l'Agenda sur une séance précise : on compose pour ELLE, sans regarder la
   * Destinée. 🚨 Revue de code (36.12) — ne JAMAIS écraser une composition déjà en cours avec des créneaux choisis.
   */
  protected startCompose(seanceId?: string): void {
    if (!this.canCompose()) return;
    if (seanceId) {
      if (this.composing() && this.composedCells().length > 0) return;
      const target = this.composeTargetFor(seanceId);
      if (target) this.armTarget(target);
      return;
    }
    const target = this.modifiablePoll();
    if (target) this.armTarget(target);
  }

  // ─── Story 45.2 — arriver dans l'atelier avec le composer prêt (`?seanceId`) ──────────────────────

  /** Le rendez-vous désigné par `?seanceId`, lu à l'init et pas encore résolu ; `null` une fois appliqué (ou refusé). */
  private readonly armPending = signal<string | null>(null);

  /** Retire `?seanceId` de l'adresse, sans navigation (comme `?poll`, 44.7) : à l'annulation, à la validation, ou
   *  quand le lien ne vise plus rien. Tant que le composer est armé, il y reste : un rechargement le réarme. */
  private clearArmParam(): void {
    this.writeQuery((params) => params.delete('seanceId'));
  }

  /** Message écrit une fois, sans rien dire du rendez-vous (EXPERIENCE §5.4). */
  private noteNoLongerDatable(): void {
    this.destinyNotice.set(this.theme.tone()['calendar.compose_link_stale']);
  }

  /** Résout le lien : le composer s'arme pour ce rendez-vous, ou — s'il n'est plus à dater ni modifiable, ou si
   *  l'on n'en a pas le droit — le calendrier reste normal et le dit. */
  private applyArming(seanceId: string): void {
    this.armPending.set(null);
    const target = this.composeTargetFor(seanceId);
    if (target) {
      this.armTarget(target);
      return;
    }
    this.noteNoLongerDatable();
    this.clearArmParam();
  }

  /** AC2 — bascule pure. Aucun appel réseau : rien n'est enregistré avant validation. */
  protected onComposeToggled(event: SlotSelectedEvent): void {
    if (!this.composing()) return;
    // ⚠️ Story 47.4 — au-delà d'un créneau, une journée entière n'est pas un départ : en Mois, toucher une case
    // entière ouvre la Semaine sur ce jour (où l'on choisit matin, après-midi ou soir) sans rien désigner.
    if (event.slot === 'FULL_DAY' && this.composeDuration() > 1) {
      if (this.view() === 'month') {
        this.sharedDate.set(
          new Date(Date.UTC(event.date.getFullYear(), event.date.getMonth(), event.date.getDate())),
        );
        this.onViewChange('week');
        this.composeRefusal.set(null);
      } else {
        this.composeRefusal.set(DURATION_TEXT.fullDayRefused);
      }
      return;
    }
    if (this.isGroupTarget()) {
      // Story 40.5b — une conjonction se propose sur un créneau précis : matin, après-midi ou soir.
      // La journée entière est REFUSÉE avec sa raison écrite (jamais un tap muet).
      if (event.slot === 'FULL_DAY') {
        this.composeRefusal.set(this.theme.tone()['partie.ralliement_calendar_compose_full_day']);
        return;
      }
      this.composeRefusal.set(null);
    }
    const key = composeCellKey(event.date, event.slot);
    this.composedCells.update((cells) => {
      const without = cells.filter((c) => composeCellKey(c.date, c.slot) !== key);
      return without.length === cells.length ? [...cells, { ...event }] : without;
    });
  }

  /** ⚠️ Story 45.3 — la journée entière est-elle permise dans cette composition ? En JDR oui ; une conjonction ou une
   *  soirée (cibles de groupe) se propose sur un créneau précis. */
  protected readonly composeAllowsFullDay = computed(
    // Story 47.4 — et seulement à 1 créneau : au-delà, « Journée » quitte la barre de sélection.
    () => !this.isGroupTarget() && this.composeDuration() <= 1,
  );

  /** ⚠️ Story 45.3 — « Ajouter au vote » : la sélection (appui maintenu ou glissement, puis un moment) rejoint les
   *  créneaux déjà désignés. CUMUL : l'union, sans doublon, l'ordre existant gardé — jamais un remplacement.
   *  Une journée entière refusée l'est avec sa raison écrite (comme pour un tap), jamais en silence. */
  protected onComposeAdded(cells: SelectedCell[]): void {
    if (!this.composing()) return;
    let toAdd = cells;
    if (this.isGroupTarget()) {
      const kept = cells.filter((c) => c.slot !== 'FULL_DAY');
      this.composeRefusal.set(
        kept.length < cells.length
          ? this.theme.tone()['partie.ralliement_calendar_compose_full_day']
          : null,
      );
      toAdd = kept;
    } else if (this.composeDuration() > 1) {
      // Story 47.4 — au-delà d'un créneau, une journée entière n'est pas un départ (refus écrit, jamais muet).
      const kept = cells.filter((c) => c.slot !== 'FULL_DAY');
      this.composeRefusal.set(kept.length < cells.length ? DURATION_TEXT.fullDayRefused : null);
      toAdd = kept;
    } else {
      this.composeRefusal.set(null);
    }
    this.composedCells.update((current) => {
      const seen = new Set(current.map((c) => composeCellKey(c.date, c.slot)));
      const added: SelectedCell[] = [];
      for (const c of toAdd) {
        const key = composeCellKey(c.date, c.slot);
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({ date: c.date, slot: c.slot });
      }
      return [...current, ...added];
    });
  }

  /** Story 45.3 — « Retirer » : ces créneaux quittent la composition (ceux qui n'y étaient pas ne changent rien). */
  protected onComposeRemoved(cells: SelectedCell[]): void {
    if (!this.composing()) return;
    const drop = new Set(cells.map((c) => composeCellKey(c.date, c.slot)));
    this.composeRefusal.set(null);
    this.composedCells.update((current) =>
      current.filter((c) => !drop.has(composeCellKey(c.date, c.slot))),
    );
  }

  /** AC3 — `Échap` et « Annuler » font la MÊME chose : sortir sans rien écrire. */
  protected cancelCompose(): void {
    const target = this.composeTarget();
    this.exitCompose();
    this.clearArmParam();
    // Story 40.5b — renoncer à composer les créneaux d'une conjonction à créer ramène à la fenêtre de
    // création, brouillon intact (le brouillon n'est jamais perdu pour avoir hésité).
    if (target?.kind === 'group-new') {
      const id = this.partieId();
      if (id) {
        this.drafts.finishCompose(id);
        void this.returnToGroupPage(id);
      }
    }
  }

  /** Sortie du mode, sans rien écrire ni naviguer. */
  private exitCompose(): void {
    this.composing.set(false);
    this.composeTarget.set(null);
    this.composedCells.set([]);
    this.composeRefusal.set(null);
    this.composeDeadlineDay.set(null);
    this.composeDeadlineFixed.set(false);
    this.armDuration(1);
  }

  /** Story 40.5b — retour à la page du groupe (son onglet des conjonctions rouvre la fenêtre de
   *  création). L'entrée d'historique du calendrier est REMPLACÉE : le retour arrière ne ramène pas
   *  dans un mode « composer » qui n'existe plus. */
  private async returnToGroupPage(id: string): Promise<void> {
    await this.router.navigate(['/parties', id], { replaceUrl: true });
  }

  /**
   * AC4 / AC5 / AC6 / AC7 / AC11 — valider la composition.
   *
   * 🚨 **L'avertissement précède l'écriture, jamais l'inverse** (AC6). Le nombre de votants est
   * lu sur `activePolls()`, déjà chargé : aucun appel réseau n'est dépensé à compter ce qu'on a
   * déjà en mémoire.
   *
   * Deux chemins d'écriture, et un seul appel dans chacun :
   * - vote existant → `PUT …/poll/:pollId/options` ;
   * - vote neuf → `POST /scenarios/seances/:id/poll`, **le seul chemin de création**, parce qu'un
   *   `SessionPoll` sans `Seance` est interdit depuis la 8.8.
   */
  protected async confirmCompose(): Promise<void> {
    const partieId = this.partieId();
    const target = this.composeTarget();
    if (!partieId || !target || !this.composeCanConfirm() || this.pollActionPending()) return;

    if (target.kind === 'group-new') {
      this.confirmGroupNew(partieId);
      return;
    }
    if (target.kind === 'group-poll') {
      await this.confirmGroupPoll(partieId, target.eventId);
      return;
    }
    if (target.kind === 'evening-poll') {
      await this.confirmEveningPoll(partieId, target.eventId);
      return;
    }

    const options = this.composedCells().map((c) => ({
      date: toDateKey(c.date),
      slot: c.slot,
    }));

    // Ce qui disparaît, et ce que cela coûte aux autres (AC6). Vide par construction sur une
    // création : un vote qui n'existe pas ne porte aucune réponse.
    // ⚠️ Story 47.4 — UNE règle (`composeLoss`) : une durée changée efface TOUTES les réponses, sinon seules celles
    // des créneaux retirés partent.
    const entry = this.composedPollEntry();
    const keptKeys = new Set(this.composedCells().map((c) => composeCellKey(c.date, c.slot)));
    const durationSlots = this.composeDuration();
    const targetDuration = this.composeTargetDuration();
    const loss = composeLoss(
      this.jdrLossOptions(entry?.poll),
      keptKeys,
      durationSlots,
      targetDuration,
    );
    const voterCount = loss.answers;

    // ⚠️ Story 45.2 — le rendez-vous a été choisi avant : le dialogue ne s'ouvre plus que pour l'avertissement de
    // perte de réponses (modification d'un vote dont des créneaux retirés en portent). Créer n'en ouvre aucun.
    if (target.kind === 'new' && !this.rendezvousRows().some((r) => r.seanceId === target.seanceId)) {
      // Daté ailleurs pendant la composition (EXPERIENCE §5.5) : rien n'est écrit, le composer se ferme.
      this.noteNoLongerDatable();
      this.cancelCompose();
      return;
    }
    if (voterCount > 0) {
      const data: ComposeConfirmData = {
        slotCount: options.length,
        removedCount: loss.removed,
        voterCount,
        ...(loss.durationChanged ? { durationChanged: true } : {}),
      };
      const ref = this.dialog.open(ComposeConfirmDialog, { data });
      // AC6 — renoncer ne modifie RIEN, et la composition reste telle quelle : le MJ n'a pas à
      // tout redésigner parce qu'il a hésité une fois.
      if (!(await firstValueFrom(ref.afterClosed()))) return;
    }

    // 🚨 Revue de code — `voterCount` a pu être calculé AVANT l'ouverture du dialogue, qui reste
    // ouvert le temps que le MJ lise et décide. Un membre peut voter (SSE) sur une option en
    // cours de retrait pendant cette fenêtre : revérifier juste avant l'écriture, jamais se fier
    // au chiffre que le MJ a vu à l'ouverture. S'il a AUGMENTÉ, ne pas écrire en silence sur un
    // consentement qui ne porte plus sur le bon nombre — redemander confirmation.
    if (target.kind === 'poll') {
      const freshEntry = this.composedPollEntry();
      const freshVoterCount = composeLoss(
        this.jdrLossOptions(freshEntry?.poll),
        keptKeys,
        durationSlots,
        targetDuration,
      ).answers;
      if (freshVoterCount > voterCount) {
        this.error.set(this.theme.tone()['calendar.view_compose_stale_voters']);
        return;
      }
    }

    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      let pollId: string | undefined;
      if (target.kind === 'poll') {
        // Même patron que `onClosePoll()` : `PollService` écrit, `loadScenarios()` relit. La
        // notification de domaine est portée par le serveur, qui émet déjà `partieTopic` sur
        // cette mutation (AC15) — `ScenariosService.notifyChanged()` est privé et réservé à ses
        // propres écritures.
        await this.pollSvc.setPollOptions(partieId, target.pollId, {
          options,
          expiresAt: this.composeDeadline(),
          // Story 47.4 — seulement si elle change : absente, le serveur garde la durée (et les réponses).
          ...this.composeDurationPayload(),
        });
        pollId = target.pollId;
      } else {
        // Le vote créé est lu dans le scénario renvoyé par l'écriture (son identifiant n'existait pas avant).
        const scenario = await this.scenariosSvc.createSeancePoll(
          target.seanceId,
          options,
          this.composeDeadline(),
          // Story 47.4 — écrite avec le vote, dans la même transaction, seulement si elle change.
          this.composeDurationPayload().durationSlots,
        );
        pollId = scenario.seances.find((s) => s.id === target.seanceId)?.poll?.id;
      }
      await this.loadScenarios(partieId);
      this.exitCompose();
      this.clearArmParam();
      if (pollId) await this.reactivateDestiny(pollId);
    } catch {
      // 🚨 Le mode NE SE FERME PAS sur une erreur : la composition du MJ est en mémoire et nulle
      // part ailleurs. La perdre l'obligerait à tout redésigner sur la grille.
      this.error.set(this.theme.tone()['calendar.view_compose_save_error']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /**
   * ⚠️ Story 45.2 (AR16) — valider réactive la Destinée sur le vote créé ou modifié : entrée comme depuis la liste
   * (vue Mois, Semaine en soirée, créneau d'entrée), `?poll` posé par l'effet qui suit la Destinée. Le vote vient
   * d'être écrit : `GET /me/open-polls` est relu d'abord, sans quoi le plateau n'aurait pas encore son entrée.
   */
  private async reactivateDestiny(pollId: string): Promise<void> {
    await this.openPollsSvc.refresh();
    if (this.openPollsSvc.entries().some((e) => e.pollId === pollId)) this.chooseDestiny(pollId);
    else this.enterDestiny(pollId);
  }

  // ─── Story 40.5b — composer les créneaux d'une conjonction de groupe ─────────────────────────

  /** Bascule la page en vue Semaine : la seule où l'on désigne un créneau précis (matin, après-midi,
   *  soir) — la vue Mois fond un jour sans événement en une case « journée », refusée ici. La barre
   *  de composition n'existe pas en Agenda. */
  private showGridForCompose(): void {
    if (this.view() !== 'week') this.onViewChange('week');
    // Les créneaux de départ peuvent tomber hors de la semaine affichée : la grille s'ouvre sur le
    // premier d'entre eux (date UTC à minuit, comme celles que les vues émettent).
    const first = [...this.composedCells()].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    if (first) {
      const d = first.date;
      this.sharedDate.set(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
    }
  }

  /** L'hôte arme la composition sur le sondage ouvert de SA conjonction : les créneaux actuels sont
   *  déjà composés (sans quoi « retiré s'il y était déjà » n'aurait aucun référent). */
  protected startGroupCompose(eventId: string): void {
    if (!this.isGroup() || this.composing()) return;
    const entry = this.groupPolls().find((e) => e.card.id === eventId);
    if (!entry?.card.can.edit) return;
    // Un seul chemin d'armement : créneaux actuels, fin du vote actuelle, vue Semaine (Story 45.4).
    this.armTarget({ kind: 'group-poll', eventId });
  }

  /** La fenêtre de création a envoyé ici son brouillon : composition d'une conjonction qui n'existe
   *  pas encore, ses créneaux déjà choisis comme point de départ. Aucun appel au serveur. */
  private startGroupComposeNew(draft: ConjonctionDraft): void {
    this.composeTarget.set({ kind: 'group-new' });
    this.composedCells.set(
      draft.pollOptions.map((o) => ({
        date: dateKeyToLocalMidnight(o.date.substring(0, 10)),
        slot: o.slot,
      })),
    );
    this.composeRefusal.set(null);
    // ⚠️ Story 47.4 — la durée du brouillon (celle de la fenêtre de création), dans les deux sens.
    this.armDuration(draft.durationSlots ?? 1);
    this.composing.set(true);
    this.showGridForCompose();
  }

  /** Les créneaux désignés, triés par jour puis créneau, dans la forme de l'API (jamais `FULL_DAY`). */
  private composedSlots(): EventPollOptionInput[] {
    const rank: Record<string, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2 };
    return this.composedCells()
      .filter((c): c is SelectedCell & { slot: EventSlot } => c.slot !== 'FULL_DAY')
      .map((c) => ({ date: toDateKey(c.date), slot: c.slot }))
      .sort((a, b) =>
        a.date === b.date ? rank[a.slot] - rank[b.slot] : a.date < b.date ? -1 : 1,
      );
  }

  /** Valider la composition d'une conjonction à créer : les créneaux rejoignent le brouillon, la
   *  fenêtre de création revient. Aucun appel au serveur (la conjonction n'existe qu'à « Créer »). */
  private confirmGroupNew(partieId: string): void {
    const options = this.composedSlots();
    // Story 47.4 — la durée composée rejoint le brouillon avec les créneaux (la fenêtre de création la reprend).
    const durationSlots = this.composeDuration();
    this.exitCompose();
    this.drafts.finishCompose(partieId, options, durationSlots);
    void this.returnToGroupPage(partieId);
  }

  /**
   * ⚠️ Story 45.5 — valider les créneaux d'une soirée isolée sans date : le sondage naît par `PATCH …/events/:eventId`
   * (41.2, remplacement complet). Les autres champs sont RELUS de la carte chargée — jamais d'un état du composer —
   * avec les créneaux et la fin du vote du composer. Aucune perte de réponses à avertir : la soirée n'a pas de vote.
   * La soirée a pu être datée ou lancée ailleurs pendant la composition : rien n'est alors écrit.
   */
  private async confirmEveningPoll(partieId: string, eventId: string): Promise<void> {
    const card = this.groupEvents().find((c) => c.id === eventId);
    if (!card || !this.rendezvousRows().some((r) => r.eventId === eventId)) {
      this.noteNoLongerDatable();
      this.cancelCompose();
      return;
    }
    const dto: UpdateEventDto = {
      title: card.title,
      lieu: card.seance?.lieu ?? null,
      heureRdv: card.seance?.heureRdv ?? null,
      notePratique: card.seance?.notePratique ?? null,
      capacity: card.seance?.capacity ?? null,
      pollOptions: this.composedSlots(),
      pollDeadline: this.composeDeadline(),
      // Story 47.4 — seulement si elle change (absente = inchangée).
      ...this.composeDurationPayload(),
    };
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.injector.get(EventsApiService).update(partieId, card.id, dto);
      await this.loadGroupEvents(partieId);
      const pollId = this.groupEvents().find((c) => c.id === eventId)?.poll?.id;
      this.exitCompose();
      this.clearArmParam();
      if (pollId) await this.reactivateDestiny(pollId);
    } catch (err) {
      // Le mode NE SE FERME PAS : la composition n'existe qu'en mémoire. Le refus du serveur (400 en français) est
      // écrit tel quel.
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_calendar_compose_save_error']),
      );
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /** Valider la composition d'une conjonction ouverte : `PATCH …/events/:eventId`, remplacement
   *  complet avec les autres champs de la carte et les nouveaux `pollOptions` (jamais `date`/`slot`).
   *  Les créneaux conservés gardent leurs réponses ; l'avertissement qui précède chiffre celles
   *  qui disparaissent (lues dans `poll.votes`). */
  private async confirmGroupPoll(partieId: string, eventId: string): Promise<void> {
    const entry = this.composedGroupEntry();
    if (!entry || entry.card.id !== eventId) return;
    const tone = this.theme.tone();
    const options = this.composedSlots();
    // Story 45.4 — la fin du vote est celle du composer (la fin actuelle, ou celle que l'hôte a choisie).
    const deadline = this.composeDeadline();

    // Ce qui disparaît et ce que cela coûte aux autres. ⚠️ Story 47.4 — la MÊME règle que le JDR (`composeLoss`) :
    // une durée changée efface toutes les réponses, sinon seules celles des créneaux retirés partent.
    const kept = new Set(options.map((o) => `${o.date}|${o.slot}`));
    const durationSlots = this.composeDuration();
    const targetDuration = this.composeTargetDuration();
    const lostVotes = (poll: EventPollDto) => {
      const loss = composeLoss(this.groupLossOptions(poll), kept, durationSlots, targetDuration);
      return { removed: loss.removed, votes: loss.answers, durationChanged: loss.durationChanged };
    };
    const before = lostVotes(entry.poll);
    // La carte qui sert à bâtir le PATCH est celle relue APRÈS l'avertissement : une modification du
    // nom, du lieu, de l'heure, des infos ou de la capacité arrivée entre-temps ne doit pas être écrasée.
    let current = entry;

    if (before.votes > 0) {
      const data: ComposeConfirmData = {
        slotCount: options.length,
        removedCount: before.removed,
        voterCount: before.votes,
        group: true,
        ...(before.durationChanged ? { durationChanged: true } : {}),
      };
      const ref = this.dialog.open(ComposeConfirmDialog, { data });
      const decision = await firstValueFrom(ref.afterClosed());
      // Renoncer ne modifie RIEN, et la composition reste telle quelle.
      if (!decision) return;

      // Des réponses ont pu arriver pendant que l'avertissement était lu : si le chiffre a augmenté,
      // le consentement ne porte plus sur le bon nombre — on redemande plutôt que d'écrire.
      const fresh = this.composedGroupEntry();
      if (!fresh || lostVotes(fresh.poll).votes > before.votes) {
        this.error.set(tone['partie.ralliement_calendar_compose_stale_voters']);
        return;
      }
      current = fresh;
    }

    const card = current.card;
    const dto: UpdateEventDto = {
      title: card.title,
      lieu: card.seance?.lieu ?? null,
      heureRdv: card.seance?.heureRdv ?? null,
      notePratique: card.seance?.notePratique ?? null,
      capacity: card.seance?.capacity ?? null,
      pollOptions: options,
      pollDeadline: deadline,
      // Story 47.4 — seulement si elle change : le serveur écrit la durée puis recrée les créneaux.
      ...this.composeDurationPayload(),
    };
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.injector.get(EventsApiService).update(partieId, card.id, dto);
      await this.loadGroupEvents(partieId);
      this.exitCompose();
      this.clearArmParam();
      await this.reactivateDestiny(current.poll.id);
    } catch (err) {
      // Le mode NE SE FERME PAS : la composition n'existe qu'en mémoire. Le refus du serveur (400 en
      // français) est écrit tel quel.
      this.error.set(refusalMessage(err, tone['partie.ralliement_calendar_compose_save_error']));
    } finally {
      this.pollActionPending.set(false);
    }
  }

  protected readonly members = signal<PartieMemberDto[]>([]);
  /** Story 44.4 — la partie dont un groupe a déjà demandé les membres (pour nommer les absents). */
  private membersRequestedFor: string | null = null;
  /** Revue de code (36.12) — distingue « personne ne manque » de « pas encore chargé » pour
   *  `missingByPoll`, que `members().length === 0` seul ne pouvait pas trancher. */
  protected readonly membersLoaded = signal(false);
  /** true pendant qu'une requête choose/close est en cours — évite une double action concurrente (double-clic, choix + annulation simultanés). */
  protected readonly pollActionPending = signal(false);

  // ─── Story 36.7 — le sélecteur de réponse de vote ─────────────────────────
  // UN SEUL sélecteur pour les quatre surfaces (case du Mois, cellule de Semaine, rail, Agenda) :
  // elles signalent l'option activée, c'est ici qu'on l'ouvre et qu'on écrit. Deux
  // implémentations produiraient deux façons de répondre selon l'écran.
  //
  // 🚨 L'ancre est l'élément DÉJÀ RENDU que la surface a touché (bande, cellule, bouton de
  // ligne) — jamais un nœud ajouté pour l'occasion : un nœud de plus dans une cellule casserait
  // le hit-test du glissement, et aucun test ne le verrait.
  protected readonly pickerVote = signal<VoteParticipation | null>(null);
  protected readonly pickerAnchor = signal<HTMLElement | null>(null);
  protected readonly pickerLabel = signal('');
  /** Story 47.5 — les plages du vote qui couvrent le créneau touché, UNE LIGNE CHACUNE, la courante d'abord
   *  (celle de la Destinée si elle couvre le créneau, sinon l'ordre chronologique que `buildDayDetail()` a posé).
   *  Moins de deux : le sélecteur d'avant. */
  protected readonly pickerLines = signal<readonly VoteLine[]>([]);
  /** L'élément à qui rendre le focus à la fermeture — sans quoi un utilisateur clavier retombe
   *  en haut du document (AC7). */
  private pickerReturnFocus: HTMLElement | null = null;
  protected readonly PICKER_POSITIONS = PICKER_POSITIONS;

  private static todayIso(): string {
    return new Date().toISOString().substring(0, 10);
  }
  private static eightWeeksLaterIso(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 56);
    return d.toISOString().substring(0, 10);
  }
  private static thirtyOneDaysAgoIso(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 31);
    return d.toISOString().substring(0, 10);
  }

  protected readonly fromDateStr = signal(CalendarView.todayIso());
  protected readonly toDateStr = signal(CalendarView.eightWeeksLaterIso());
  // Story deferred-work (« C'est passé » en calendrier personnel) — vrai seulement si l'URL a
  // explicitement fixé `from` au montage : sert à ne PAS écraser un lien partagé/query param par
  // le défaut élargi vers le passé du contexte personnel, ci-dessous.
  private hasExplicitRangeParam = false;

  private static readonly ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  constructor() {
    // Story 19.1 (AC3) : un vote/une clôture/l'ouverture d'un nouveau sondage émettent déjà sur
    // partie:{id} (Story 18.1, PollService/ScenariosService backend) — recharge à la fois les
    // scénarios/séances (ScenariosService, pour activePolls/eligibleSeances) ET les créneaux
    // calculés/heatmap (PollService, non concerné par ScenariosService.changed mais recalculés
    // par la même mutation sous-jacente) : réutilise loadScenarios()/refreshMjPanels() existantes.
    effect(() => {
      const change = this.scenariosSvc.changed();
      const id = this.partieId();
      if (id) {
        if (!matchesPartie(change, id)) return;
        untracked(() => {
          // Story 36.7 — un vote/retrait tiers peut avoir clos le sondage ou fait disparaître
          // l'option affichée : le sélecteur ouvert référencerait alors des données périmées, et
          // son ancre peut devenir un nœud détaché une fois la grille reconstruite ci-dessous.
          this.closePicker();
          // Story 44.4 — le plateau lit `GET /me/open-polls`, qu'aucun canal `user:` ne tient à jour à
          // l'atelier : tant qu'une Destinée est active, le signal `partie:` le relit aussi.
          if (this.destinyPollId() !== null) void this.openPollsSvc.refresh();
          // Story 40.5b — un groupe relit ses conjonctions (sondages, votes) sur CE même signal : aucun
          // nouveau handler `'partie:'`. Il n'a ni scénarios, ni créneaux agrégés à relire.
          if (this.isGroup()) {
            void this.loadGroupEvents(id);
            return;
          }
          void this.loadScenarios(id);
          void this.refreshMjPanels();
          if (this.isMjMode()) void this.loadMembers(id);
        });
        return;
      }
      // Deferred-work (SSE, calendrier personnel) — `change === null` est la valeur initiale au
      // montage (rien à recharger, `loadForPartieId()` s'en charge déjà) ; toute valeur non nulle
      // ensuite vient d'un événement `user:{id}` (connecté ci-dessus en contexte personnel
      // seulement) — aucun filtrage par partieId possible ni utile ici, le calendrier personnel
      // agrège plusieurs Parties.
      if (change === null) return;
      untracked(() => {
        void this.loadMeCalendarForRange(this.fromDateStr(), this.toDateStr());
      });
    });

    // Bug fix (temps réel) : une déclaration de dispo/indispo d'un autre membre ne rafraîchissait
    // jamais le calendrier — AvailabilityService.changed() est un simple compteur (pas de
    // { partieId } comme ScenariosService), aucun filtrage matchesPartie possible ici ; sans risque
    // car ce composant ne reçoit l'événement SSE que sur SA propre connexion partie:{id} (le
    // serveur ne route jamais un événement d'une autre Partie vers cette connexion). Garde firstRun
    // (même piège que partout ailleurs, Stories 19.2/20.1/20.2/21.*) : le signal peut déjà porter
    // une valeur avant le montage.
    // Story 36.9, AC9 — le mode Destinée doit savoir MOURIR. Un vote scellé, clôturé ou brûlé
    // (par moi ailleurs, ou par un autre membre via SSE) disparaît de `destinyPolls()` sous les
    // pieds du mode. Même piège que le sélecteur de réponse de la 36.7, que l'effet ci-dessus
    // ferme explicitement.
    //
    // 🚨 Il se TERMINE, il ne bascule pas sur un autre vote : basculer en silence est exactement
    // ce que l'encadré n°2 de la story interdit (« un vote que personne n'a demandé »). Un vote
    // TIERS qui disparaît, lui, ne touche à rien — la garde est l'absence de l'id COURANT.
    effect(() => {
      const id = this.destinyPollId();
      if (id === null) return;
      const polls = this.destinyPolls();
      const stillPresent = polls.some((p) => p.pollId === id);

      if (stillPresent) return;

      // « Le vote a disparu de la liste » ne veut dire « le vote est clos » QUE si la liste fait
      // autorité sur ce qui est ouvert. C'est vrai en contexte de PARTIE (`activePolls()` dérive
      // de TOUS les scénarios de la partie, remplacés d'un bloc après chargement) : absence ⇒ clos.
      if (this.partieId()) {
        untracked(() => {
          this.destinyNotice.set(this.destinyCloseReason(id));
          this.exitDestiny();
        });
        return;
      }

      // Contexte personnel (Story 44.2) : `GET /me/open-polls` couvre TOUS les mois, plus de plage — un vote
      // absent de la liste servie est un vote qui n'est plus ouvert. Tant que la liste n'a pas été lue une
      // première fois, on ne sait rien : le mode attend. (L'ancienne heuristique « hors plage ≠ clos » n'a
      // plus d'objet.)
      if (!this.openPollsSvc.loaded()) return;
      untracked(() => {
        this.destinyNotice.set(this.theme.tone()['calendar.destiny_closed_gone']);
        this.exitDestiny();
      });
    });

    // Story 44.4 — le créneau courant doit savoir disparaître sans emporter la Destinée : retiré d'un vote qui
    // reste ouvert (dates modifiées ailleurs), il est remplacé par le créneau d'entrée du vote, et la grille
    // s'y replace. Un vote qui n'a pas encore de créneau courant (entrée par `enterDestiny`) en reçoit un.
    effect(() => {
      const entry = this.destinyEntry();
      if (!entry) return;
      const current = this.destinyOptionId();
      if (current !== null && entry.options.some((o) => o.optionId === current)) return;
      untracked(() => {
        const target = destinyEntryOption(entry, this.todayKey);
        this.destinyOptionId.set(target?.optionId ?? null);
        if (target && current !== null) this.moveGridTo(target.date);
      });
    });

    // Story 46.2 — la fenêtre sélectionnée disparaît avec ce qui la montrait : atelier quitté, liste relue sans elle,
    // couche éteinte ou vue Agenda.
    effect(() => {
      const sel = this.selectedWindow();
      if (!sel) return;
      const gone =
        !this.windowSelectable() ||
        !this.isLayerActive('disponibilite-groupe') ||
        this.view() === 'agenda' ||
        (!this.slotsLoading() &&
          !this.availableSlots().some(
            (s) =>
              availableSlotKey(s) === availableSlotKey(sel) &&
              // Story 47.6 — la même date servie à une autre durée est une autre fenêtre.
              ('durationSlots' in s ? s.durationSlots : 1) === sel.durationSlots,
          ));
      if (gone) untracked(() => this.selectedWindow.set(null));
    });

    // ⚠️ Story 47.6 — la liste de l'automate suit la durée du composer : elle se relit quand le compteur bouge (ou quand
    // le composer s'ouvre ou se ferme sur une autre durée que celle déjà demandée).
    effect(() => {
      const span = this.slotsSpan();
      untracked(() => {
        const id = this.partieId();
        if (!id || this.isGroup() || span === this.slotsSpanAsked) return;
        void this.loadAvailableSlots(id, this.fromDateStr(), this.toDateStr());
      });
    });

    // Story 44.7 — le lien attend les sondages ouverts et, à l'atelier, les données de la partie.
    effect(() => {
      const pending = this.linkPending();
      // `partieDataLoaded` vaut aussi pour le calendrier personnel (fin de `loadForPartieId(null)`) : avant lui,
      // `partieId()` n'est pas encore posé et l'on ne saurait pas dans quel contexte on résout le lien.
      if (!pending || !this.openPollsSvc.loaded() || !this.partieDataLoaded()) return;
      untracked(() => this.applyLink(pending));
    });

    // Story 45.2 — le rendez-vous désigné par `?seanceId` s'arme dès que les données de l'atelier sont lues (et la
    // nature de la partie connue : un groupe se lit par ses conjonctions, un JDR par ses scénarios).
    effect(() => {
      const pending = this.armPending();
      if (!pending || !this.partieDataLoaded() || !this.groupResolved()) return;
      untracked(() => this.applyArming(pending));
    });

    // Story 44.7 — l'adresse suit la Destinée : `poll` posé à l'entrée ou au changement, retiré à la sortie. Un
    // rechargement ramène ainsi au même vote.
    effect(() => {
      const id = this.destinyPollId();
      if (this.linkPending()) return;
      untracked(() =>
        this.writeQuery((params) => {
          if (id) params.set('poll', id);
          else params.delete('poll');
        }),
      );
    });

    // Story 44.4 — les noms de celles et ceux qui n'ont pas répondu à un vote de GROUPE ne se montrent qu'à son
    // organisateur : les membres ne sont lus qu'alors (le calendrier d'un groupe n'en lit aucun autrement).
    effect(() => {
      const entry = this.destinyEntry();
      const id = this.partieId();
      if (!entry || !id || entry.family !== 'ralliement' || !entry.can.choose) return;
      if (!this.isGroup() || this.membersRequestedFor === id) return;
      this.membersRequestedFor = id;
      untracked(() => void this.loadMembers(id));
    });

    // Story 36.10 — la composition aussi doit savoir mourir. Un vote scellé ou clôturé ailleurs
    // (ou par un autre membre via SSE) pendant qu'on compose ses créneaux ne peut plus être écrit :
    // le serveur refuserait (`status !== 'OPEN'`), et continuer à composer donnerait au MJ
    // l'illusion d'un travail qui aboutira.
    //
    // 🚨 La garde de plage de la Destinée ne se recopie PAS ici, et c'est délibéré : la
    // composition n'existe qu'en contexte de PARTIE (AC10), où `activePolls()` dérive de tous les
    // scénarios et fait donc autorité sur ce qui est ouvert. « Absent » y veut bien dire « clos ».
    effect(() => {
      const target = this.composeTarget();
      if (target?.kind !== 'poll') return;
      const stillOpen = this.activePolls().some((e) => e.poll.id === target.pollId);
      if (!stillOpen) untracked(() => this.cancelCompose());
    });

    // Story 40.5b — même règle pour un groupe : la conjonction dont on compose les créneaux a pu cesser
    // d'être un sondage ouvert (date fixée, vote clos, conjonction retirée) pendant la composition.
    effect(() => {
      const target = this.composeTarget();
      if (target?.kind !== 'group-poll') return;
      const stillOpen = this.groupPolls().some((e) => e.card.id === target.eventId);
      if (!stillOpen) untracked(() => this.exitCompose());
    });

    let firstRun = true;
    effect(() => {
      this.availabilitySvc.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.refreshMjPanels());
    });
  }

  /** Sujet temps réel actuellement connecté (`partieTopic(id)`), pour le déconnecter proprement
   *  au changement de Partie ET à la destruction du composant — voir `loadForPartieId()`. */
  private connectedPartieTopic: string | null = null;
  /** Deferred-work (SSE, calendrier personnel) — même rôle que `connectedPartieTopic` mais pour
   *  `userTopic(monId)`, connecté seulement en contexte personnel (`loadForPartieId()`) : le
   *  calendrier personnel agrège plusieurs Parties, aucun `partieTopic` unique ne peut le couvrir. */
  private connectedUserTopic: string | null = null;

  async ngOnInit(): Promise<void> {
    this.contextualNav.set({ title: this.theme.tone()['nav.calendar'] });
    const fromParam = this.route.snapshot.queryParamMap.get('from');
    const toParam = this.route.snapshot.queryParamMap.get('to');
    if (fromParam && CalendarView.ISO_DATE_RE.test(fromParam)) this.fromDateStr.set(fromParam);
    if (toParam && CalendarView.ISO_DATE_RE.test(toParam)) this.toDateStr.set(toParam);
    this.hasExplicitRangeParam = !!(fromParam && CalendarView.ISO_DATE_RE.test(fromParam));

    // ⚠️ Story 45.2 — `?seanceId=<id>` arme le composer pour ce rendez-vous (remplace le panneau 8.7). Lu ICI, une
    // fois, puis résolu quand les données de la partie sont là (`applyArming`). Seul l'ATELIER arme : sans `:id` de
    // partie (le calendrier personnel) le paramètre est ignoré. Aucune garde de mode : les droits sont ceux de `can`.
    const seanceIdParam = this.route.snapshot.queryParamMap.get('seanceId');
    if (seanceIdParam && this.route.snapshot.paramMap.get('id')) this.armPending.set(seanceIdParam);

    // Story 44.7 — `?poll=<pollId>` ouvre la Destinée sur ce vote, `?pollList` la liste ✦. Lus ICI, une fois, puis
    // résolus quand les données sont là (`applyLink`) ; l'adresse n'est pas touchée d'ici là.
    const pollParam = this.route.snapshot.queryParamMap.get('poll');
    const listParam = this.route.snapshot.queryParamMap.get('pollList');
    if (pollParam || listParam !== null) {
      this.linkPending.set({ poll: pollParam || null, list: listParam !== null });
    }

    this.destroyRef.onDestroy(() => {
      // Story 40.5b — toute sortie autre que valider / renoncer / « Retour » (retour du navigateur, menu)
      // pendant la composition d'une nouvelle conjonction rend le brouillon : la page du groupe rouvre
      // la fenêtre de création au lieu de le perdre en silence.
      const id = this.partieId();
      if (id && this.composeTarget()?.kind === 'group-new') this.drafts.finishCompose(id);
      if (this.connectedPartieTopic) this.realtime.disconnect(this.connectedPartieTopic);
      if (this.connectedUserTopic) this.realtime.disconnect(this.connectedUserTopic);
    });

    // 🚨 Revue de code 36.14 (AC10, encadré n°2) — abonné à `paramMap`, jamais lu une seule fois
    // au montage. Les trois routes du calendrier (`/profile/calendar`, `/parties/:id/calendar`,
    // `/parties/:id/guild-calendar`) montent le MÊME composant, et la stratégie de réutilisation
    // par défaut d'Angular conserve l'instance sur un simple changement de `:id` — `ngOnInit` ne
    // se relance alors PAS. Une lecture figée dans `ngOnInit` conserverait l'identité de la
    // Partie précédente pour la mémoire de session ET pour toutes les données scopées à la
    // Partie (déclarations, créneaux, heatmap, scénarios, membres, canal temps réel).
    // [Source: deferred-work.md:117 — le même piège, déjà constaté sur `fromDateStr`/`toDateStr`.]
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => void this.loadForPartieId(id));
  }

  private async loadForPartieId(id: string | null): Promise<void> {
    // Story 40.5b — une nouvelle identité de partie repart de zéro : ni groupe, ni conjonctions, ni
    // composition d'une partie précédente (la route réutilise l'instance sur un simple changement de
    // `:id`).
    this.partieDataLoaded.set(false);
    this.isGroup.set(false);
    this.groupResolved.set(false);
    this.groupEvents.set([]);
    this.groupEventsError.set(null);
    this.membersRequestedFor = null;
    this.exitCompose();
    // Story 44.6 — la Destinée d'une partie précédente ne survit pas à ce changement : elle n'a pas à se fermer
    // plus tard sur un « Ce vote est clos. » qui ne concerne pas la partie affichée.
    this.exitDestiny();
    this.destinyNotice.set(null);
    // Story 44.8 — le filtre est celui du calendrier personnel : il ne suit pas dans une autre page.
    this.hiddenPartieIds.set(new Set());
    // Story 45.1 — le choix du rendez-vous et le nom de la partie ne suivent pas dans une autre page.
    this.rendezvousPickerOpen.set(false);
    this.partieMeta.set(null);

    // Story 30.6, Task 1 : état des couches actives, initialisé depuis le défaut du compte —
    // jamais persisté par la bascule elle-même (encadré n°2). `disponibilite-groupe` retirée hors
    // contexte de partie (AC8).
    //
    // Story 36.14, AC8/AC9 — le défaut de compte est l'état d'ARRIVÉE, jamais un verrou : si ce
    // calendrier a déjà été visité dans cette session, ses bascules reprennent la main. La
    // mémoire est en RAM (voir `CalendarSessionLayersService`), donc un rechargement, une
    // déconnexion ou un autre calendrier retombent ici même, sur le défaut (AC10).
    const remembered = this.sessionLayers.read(calendarSessionKey(id, this.mode()));
    this.activeLayers.set(remembered ?? this.defaultLayersForContext(!!id));

    if (this.connectedPartieTopic) {
      this.realtime.disconnect(this.connectedPartieTopic);
      this.connectedPartieTopic = null;
    }
    if (this.connectedUserTopic) {
      this.realtime.disconnect(this.connectedUserTopic);
      this.connectedUserTopic = null;
    }

    this.partieId.set(id);

    if (id) {
      const topic = partieTopic(id);
      this.realtime.connect(topic);
      this.connectedPartieTopic = topic;
      // Story 46.4 — le masquage d'une fenêtre est un fait PAR UTILISATEUR : le serveur émet `user:{id}` du MJ, jamais
      // `partie:{id}`. L'atelier du MJ s'y connecte aussi, pour que ses autres onglets et appareils relisent la liste.
      const myId = this.authSvc.currentUser()?.id;
      if (this.mode() === 'mj' && myId) {
        const userTopicName = userTopic(myId);
        this.realtime.connect(userTopicName);
        this.connectedUserTopic = userTopicName;
      }

      // Story 40.5b — seules les lectures que le serveur ne refuse pas à un groupe attendent de savoir
      // si la partie en est un ; les déclarations de la personne partent tout de suite.
      const groupResolved = this.resolveGroup(id);
      await Promise.all([
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { from: this.fromDateStr(), to: this.toDateStr() },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
        this.loadDeclarations(),
        groupResolved.then(() => this.loadPartieData(id)),
      ]);
      // Revue de code Story 29.4 : la navigation interne ci-dessus (mêmes route/composant,
      // seuls les query params from/to changent) déclenche NavigationStart -> clear() sur
      // ContextualNavService, qui vide le bandeau posé en tête de `ngOnInit` — repositionner le
      // titre juste après.
      this.contextualNav.set({ title: this.theme.tone()['nav.calendar'] });
      if (this.isMjMode()) {
        await this.loadMembers(id);
      }
      // Story 40.5b — la fenêtre de création vient chercher ses créneaux : le mode « composer » est
      // déjà armé pour la nouvelle conjonction (et le calendrier du groupe est en vue Semaine, la
      // seule où l'on choisit un créneau précis).
      if (this.isGroup() && this.partieId() === id) {
        const draft = this.drafts.takeComposeRequest(id);
        if (draft) this.startGroupComposeNew(draft);
      }
    } else {
      // Story 45.1 — mes rendez-vous à dater (le bouton « Proposer des dates » de la vitrine).
      void this.datableSvc.refresh();
      // Deferred-work (SSE, calendrier personnel) — le calendrier personnel agrège plusieurs
      // Parties : aucun `partieTopic` unique ne peut le couvrir, donc `user:{id}` (même patron que
      // `dashboard.ts`). Le serveur y fait désormais un fan-out (`notifyPartieSignalsChanged`) sur
      // toute écriture pertinente pour mes-seances/votes-en-cours/inscriptions-ouvertes.
      const myId = this.authSvc.currentUser()?.id;
      if (myId) {
        const topic = userTopic(myId);
        this.realtime.connect(topic);
        this.connectedUserTopic = topic;
      }
      // Deferred-work (« C'est passé ») — sans plage explicite dans l'URL, le calendrier
      // personnel élargit son point de départ à -31 jours : sans ça, `fromDateStr` par défaut
      // (aujourd'hui) ne couvre jamais le passé et la section reste structurellement vide au
      // premier chargement. Le contexte MJ (branche ci-dessus) n'est pas concerné.
      if (!this.hasExplicitRangeParam) {
        this.fromDateStr.set(CalendarView.thirtyOneDaysAgoIso());
      }
      // Story 30.6, AC8/AC9 : contexte personnel — un seul appel GET /me/calendar pour les 5
      // couches temporelles, jamais depuis un contexte de partie.
      await Promise.all([
        this.loadDeclarations(),
        this.loadMeCalendarForRange(this.fromDateStr(), this.toDateStr()),
      ]);
    }
    // Story 44.7 — ce que la page montre de SA partie est lu : un lien de Destinée peut s'appliquer sans que la
    // fin de mode (vote absent de la liste chargée) l'achève aussitôt.
    this.partieDataLoaded.set(true);
  }

  // Story 8.8, AC7/AC8/AC9 : charge les scénarios/séances de la Partie via ScenariosService.listAll
  // (déjà utilisé par ScenarioTimeline) — évite un nouvel endpoint backend dédié. `activePolls` et
  // `eligibleSeances` (computed) en sont dérivés.
  private async loadScenarios(partieId: string): Promise<void> {
    // Story 40.5b — la liste des scénarios est refusée à un groupe (et un groupe n'en a pas).
    if (this.isGroup()) return;
    try {
      this.scenarios.set(await this.scenariosSvc.listAll(partieId));
    } catch {
      // non-bloquant — la vue reste utilisable sans la liste des scénarios/votes actifs
    }
  }

  /**
   * Story 40.5b — la partie est-elle un groupe ? (famille `ralliement`, type `CAMPAGNE_EPISODIQUE`.)
   * Jamais en mode MJ. Un échec de lecture laisse la page se comporter comme celle d'une quête : les
   * lectures refusées à un groupe échouent alors en silence, comme avant.
   */
  private async resolveGroup(id: string): Promise<void> {
    if (this.isMjMode()) {
      void this.loadPartieMeta(id);
      this.groupResolved.set(true);
      return;
    }
    let group = false;
    try {
      const partie = await this.partiesSvc.get(id);
      if (this.partieId() === id) {
        this.partieMeta.set({ name: partie.name, frozen: !isPartieActive(partie.status) });
      }
      // Story 41.2 : la soirée isolée (`ONE_SHOT`) vote aussi dans le calendrier du groupe.
      group = familyOf(partie.gameSystemId) === 'ralliement';
    } catch {
      group = false;
    }
    if (this.partieId() !== id) return;
    this.isGroup.set(group);
    this.groupResolved.set(true);
    // Un groupe n'a pas de couche « disponibilité du groupe », même mémorisée pour la session.
    if (group) this.activeLayers.update((keys) => keys.filter((k) => k !== 'disponibilite-groupe'));
  }

  /** Les lectures propres à la partie, selon qu'elle est un groupe (ses conjonctions) ou non (créneaux
   *  calculés, agrégat, scénarios). */
  private async loadPartieData(id: string): Promise<void> {
    if (this.isGroup()) {
      await this.loadGroupEvents(id);
      return;
    }
    await Promise.all([
      this.loadAvailableSlots(id, this.fromDateStr(), this.toDateStr()),
      this.loadHeatmap(id),
      this.loadScenarios(id),
    ]);
  }

  /**
   * Story 40.5b — relit les conjonctions du groupe. Compteur de requêtes : une réponse périmée
   * n'écrase pas une plus fraîche. Un échec se VOIT et garde le dernier état connu (jamais de
   * `.set([])`).
   */
  private async loadGroupEvents(partieId: string): Promise<void> {
    const reqId = ++this.groupEventsReqId;
    try {
      const list = await this.injector.get(EventsApiService).list(partieId);
      if (reqId !== this.groupEventsReqId || this.partieId() !== partieId) return;
      this.groupEvents.set(list);
      this.groupEventsError.set(null);
    } catch {
      if (reqId !== this.groupEventsReqId || this.partieId() !== partieId) return;
      this.groupEventsError.set(this.theme.tone()['partie.ralliement_calendar_events_error']);
    }
  }

  /** Relit ce que la page affiche des votes : les conjonctions d'un groupe, les scénarios sinon. */
  private async reloadVotes(partieId: string): Promise<void> {
    if (this.isGroup()) await this.loadGroupEvents(partieId);
    else await this.loadScenarios(partieId);
  }

  /**
   * Revue de code (36.12) — `members()` n'était chargé qu'une fois à `ngOnInit`, jamais
   * resynchronisé : un membre qui rejoint/quitte en cours de session laissait « il manque … »
   * périmé (`missingByPoll`). Rappelée depuis l'effet `scenariosSvc.changed()` ci-dessous, seul
   * canal temps réel scopé `partie:{id}` que ce composant écoute déjà — pas une garantie qu'un
   * changement de composition l'émette toujours, mais le meilleur signal disponible sans ajouter
   * un nouveau canal SSE.
   */
  private async loadMembers(partieId: string): Promise<void> {
    this.members.set(await this.partiesSvc.members(partieId).catch(() => []));
    this.membersLoaded.set(true);
  }

  // ⚠️ Story 36.10, AC9 — `startVoteFor()` et `noop()` ont été SUPPRIMÉS avec le sélecteur
  // « Planifier un vote pour : ». Story 45.2 : le panneau 8.7 (`<app-poll-creation>`, `pollPanelOpen`,
  // `lockedSeanceId`) l'est aussi — `?seanceId` arme désormais le composer (`applyArming`), la séance est
  // choisie AVANT et plus jamais demandée à la validation. `eligibleSeances()` reste : l'Agenda en tire ses
  // lignes « Lancer un vote » (36.12).

  /**
   * Story 36.1, AC2 : le rail suit tout toucher de case, « quelle que soit la raison du toucher ».
   *
   * ⚠️ Story 36.3, AC1 — ce handler est **amputé, pas supprimé**. Il n'ouvre plus le panneau de
   * déclaration : le toucher arme désormais une sélection dans la vue enfant, et le panneau se
   * rejoint par « Autre… » (`onDeclarationPanelRequested`). C'est le renversement demandé par
   * FR-57 : « la sélection est le geste, le panneau est le chemin avancé ». Les quatre lignes de
   * préparation du panneau ont migré telles quelles dans le handler ci-dessous.
   */
  protected onSlotSelected(event: SlotSelectedEvent): void {
    this.railDate.set(event.date);
    this.railSlot.set(event.slot);
  }

  /**
   * Story 36.3, AC4/AC10 — « Autre… » de la barre de sélection. **Seul chemin** vers
   * `ConstraintPanel` depuis cette story, donc seul chemin vers la contrainte récurrente
   * (story 1.7), la modification, la suppression et la découpe d'une récurrente.
   *
   * `selectedExisting` est indispensable : sans lui le panneau s'ouvrirait en création alors
   * qu'une déclaration couvre déjà la cellule, et la suppression comme la découpe deviendraient
   * inatteignables.
   */
  protected onDeclarationPanelRequested(event: SlotSelectedEvent): void {
    this.railDate.set(event.date);
    this.railSlot.set(event.slot);

    this.selectedDate.set(event.date);
    this.selectedSlot.set(event.slot);
    this.selectedExisting.set(this.findMatchingDeclaration(event.date, event.slot));
    this.pendingDto.set(null);
    this.panelOpen.set(true);
  }

  /** Story 36.1, AC11 — activer une ligne du rail ouvre LE SCÉNARIO qui porte la séance. Aucun
   *  écran de séance n'existe dans l'application : une séance n'a d'existence qu'à l'intérieur de
   *  son scénario, qui porte le contexte utile (chronologie, autres séances, compte rendu). */
  protected async onScenarioActivated(target: RailTarget): Promise<void> {
    await this.router.navigate(['/parties', target.partieId, 'scenarios', target.scenarioId]);
  }

  /** Story 36.4, D-18 — un conflit ne fait plus échouer le geste : il OUVRE une résolution.
   *
   *  Les deux vues effacent leur sélection AVANT de connaître le résultat (`onSelectionCommit`) :
   *  `event.cells` est donc la seule chose qui survive au 409, et c'est elle qui permet à la fois
   *  de NOMMER les créneaux (AC2) et de rejouer le lot résolu (AC12). On la retient ici.
   *
   *  Un geste produit au plus DEUX appels : le premier, puis le lot résolu. « Au cas par cas »
   *  n'en ajoute aucun — c'est un parcours interne au dialogue (AC10). */
  protected async onBatchDeclareRequested(event: {
    cells: SelectedCell[];
    kind: AvailKind;
  }): Promise<void> {
    const items = buildBatchItems(event.cells, event.kind);
    try {
      await this.availabilitySvc.createDeclarationBatch(items);
      await this.loadDeclarations();
      await this.refreshMjPanels();
    } catch (err) {
      if (err instanceof ConflictError) {
        await this.resolveBatchConflicts(err, event.cells, event.kind, items);
        return;
      }
      this.snack.open(
        this.theme.tone()['common.impossible_d_enregistrer_ces_disponibilites_reessayez'],
        undefined,
        { duration: 5000 },
      );
    }
  }

  private async resolveBatchConflicts(
    err: ConflictError,
    cells: SelectedCell[],
    kind: AvailKind,
    items: CreateAvailabilityBatchItem[],
  ): Promise<void> {
    // AC14 : un conflit INTERNE au lot reste irrésoluble — aucun des deux créneaux n'est
    // « l'existant », « Remplacer » n'y aurait aucun sens. Le serveur le signe via `internal`
    // (Story 36.4 — remplace le sondage par préfixe d'id de la Story 30.2, revue de code).
    const resolvable = err.conflicts.filter((c) => typeof c.batchIndex === 'number' && !c.internal);
    if (resolvable.length === 0) {
      const labels = err.conflicts.map((c) => c.startDate ?? c.dayOfWeek).join(', ');
      const tone = this.theme.tone();
      this.snack.open(
        labels
          ? fillTone(tone['calendar.view_batch_conflict_labels'], { labels })
          : tone['calendar.view_batch_conflict_plain'],
        undefined,
        { duration: 5000 },
      );
      return;
    }

    // Garde anti-double-ouverture (patron `dialogPending()` de PollStatusPanel) : posée avant
    // tout await, sans quoi deux gestes rapprochés ouvriraient deux dialogues concurrents. Le
    // second geste est notifié plutôt que silencieusement perdu (revue de code Story 36.4).
    if (this.conflictDialogOpen()) {
      this.snack.open(this.theme.tone()['calendar.view_conflict_in_progress'], undefined, {
        duration: 5000,
      });
      return;
    }
    this.conflictDialogOpen.set(true);
    try {
      const conflictedIndexes = new Set(resolvable.map((c) => c.batchIndex as number));
      const seanceExceptions = this.seanceCoveredCells(cells, conflictedIndexes);
      const data: ConflictDialogData = {
        kind,
        intentLabel: this.describeSelection(cells),
        conflicts: resolvable.map((c) => ({
          batchIndex: c.batchIndex as number,
          label: this.describeCell(cells[c.batchIndex as number]),
        })),
        // Les cellules d'exception séance ne sont ni en conflit ni « libres » : le compteur
        // « Les N autres passent en… » ne doit pas les recompter (AC2/AC11, revue de code).
        freeCount: cells.length - conflictedIndexes.size - seanceExceptions.length,
        seanceExceptions,
      };

      const ref = this.dialog.open(ConflictDialog, { data });
      const resolution = (await firstValueFrom(
        ref.afterClosed(),
      )) as ConflictResolutionByIndex | null;
      if (!resolution) return;

      // Un seul appel portant TOUT le lot, chaque créneau en conflit muni de sa décision.
      const resolved = items.map((item, index) =>
        resolution[index] ? { ...item, conflictResolution: resolution[index] } : item,
      );
      try {
        await this.availabilitySvc.createDeclarationBatch(resolved);
      } catch (resubmitErr) {
        // Une résolution peut elle-même échouer sur un nouveau 409 (conflit interne révélé
        // seulement après résolution de l'externe, ou collision de course) : on ne l'avale pas
        // dans le message générique, on relance la résolution avec les conflits à jour
        // (revue de code Story 36.4).
        if (resubmitErr instanceof ConflictError) {
          this.conflictDialogOpen.set(false);
          await this.resolveBatchConflicts(resubmitErr, cells, kind, resolved);
          return;
        }
        throw resubmitErr;
      }
      await this.loadDeclarations();
      await this.refreshMjPanels();
    } catch {
      this.snack.open(
        this.theme.tone()['common.impossible_d_enregistrer_ces_disponibilites_reessayez'],
        undefined,
        { duration: 5000 },
      );
    } finally {
      this.conflictDialogOpen.set(false);
    }
  }

  /** Créneaux de la sélection couverts par une séance et qui ne sont PAS en conflit : ce sont
   *  eux que le dialogue signale en exception (AC11). Ils ne peuvent structurellement pas
   *  figurer dans `conflicts` — l'indisponibilité dérivée d'une séance n'est jamais persistée
   *  (AD-9), il n'y a rien à écraser. Dérivé d'`allCalendarEntries()`, déjà en mémoire pour les
   *  deux contextes : aucun appel réseau supplémentaire. */
  private seanceCoveredCells(cells: SelectedCell[], conflicted: Set<number>): string[] {
    const seances = this.allCalendarEntries().filter((e) => e.type === 'mes-seances');
    if (seances.length === 0) return [];
    const labels: string[] = [];
    cells.forEach((cell, index) => {
      if (conflicted.has(index)) return;
      const key = toDateKey(cell.date);
      // Story 47.3 : la règle de couverture est celle de la projection (une plage couvre chaque jour, pas
      // seulement son premier).
      const covered = seances.some((e) => entryCoversCell(e, key, cell.slot));
      if (covered) labels.push(this.describeCell(cell));
    });
    return labels;
  }

  /** ⚠️ Le créneau est OMIS quand il vaut la journée entière. Vérifié à l'écran : « jeu. 20 août ·
   *  Journée · ven. 21 août · Journée · … » emploie le même séparateur entre la date et le créneau
   *  qu'entre deux créneaux, si bien qu'on ne distingue plus les items de la liste. Le contrat d'UI
   *  écrit d'ailleurs « Mar 4 · Ven 7 · Dim 9 », sans créneau. Il reste nommé dès qu'il porte une
   *  information (Matin / Après-midi / Soir). */
  private describeCell(cell: SelectedCell | undefined): string {
    if (!cell) return this.theme.tone()['calendar.view_cell_unknown'];
    const date = CALENDAR_CELL_DATE_FORMAT.format(cell.date);
    return cell.slot === 'FULL_DAY' ? date : `${date} · ${SLOT_LABELS[cell.slot]}`;
  }

  /** Rappelle l'intention du geste sous le titre du dialogue — « du 3 au 9 août, le soir ». */
  private describeSelection(cells: SelectedCell[]): string {
    const tone = this.theme.tone();
    if (cells.length === 0) return tone['calendar.view_selection_none'];
    if (cells.length === 1) {
      return fillTone(tone['calendar.view_selection_one'], { cell: this.describeCell(cells[0]) });
    }
    const sorted = [...cells].sort((a, b) => a.date.getTime() - b.date.getTime());
    const from = CALENDAR_CELL_DATE_FORMAT.format(sorted[0].date);
    const to = CALENDAR_CELL_DATE_FORMAT.format(sorted[sorted.length - 1].date);
    return fillTone(tone['calendar.view_selection_many'], { n: cells.length, from, to });
  }

  protected onViewChange(value: string): void {
    // Story 36.7 — changer de vue démonte la grille qui ancre le sélecteur ouvert.
    this.closePicker();
    this.view.set(value as 'month' | 'week' | 'agenda');
  }

  protected async onMonthDateChange(d: Date): Promise<void> {
    // Story 36.7 — naviguer de mois reconstruit les cases : l'ancre du sélecteur ouvert (une
    // bande déjà rendue) serait détachée sans que ses données restent valides.
    this.closePicker();
    this.sharedDate.set(d);
    const id = this.partieId();
    if (id) {
      if (!this.isGroup()) await this.loadHeatmap(id, d);
    } else {
      // Story 30.6, AC10 : la plage affichée du calendrier personnel change — GET /me/calendar
      // est rappelé avec la nouvelle plage, jamais un cache silencieusement périmé.
      const { from, to } = CalendarView.monthGridRange(d);
      await this.loadMeCalendarForRange(from, to);
    }
  }

  protected async onWeekDateChange(d: Date): Promise<void> {
    // Story 36.7 — même motif que `onMonthDateChange`.
    this.closePicker();
    this.sharedDate.set(d);
    const partieId = this.partieId();
    if (partieId) {
      // Story 36.8, AC13 — 🚨 jusqu'ici, naviguer de semaine en contexte de partie ne rechargeait
      // RIEN : c'était sans conséquence visible tant que la couche « disponibilité du groupe »
      // n'était pas dessinée dans la grille. Depuis cette story, deux semaines d'avance suffisent
      // à la faire disparaître sans que l'écran le dise, alors que la spine la veut « dans toutes
      // les vues de grille ».
      //
      // `monthGridRange(d)` — la MÊME plage que `onMonthDateChange`, jamais une seconde inventée :
      // elle couvre largement la semaine de `d` (42 jours autour de son mois) et reste sous le
      // plafond serveur de 45 jours. Effet de bord accepté : deux navigations de semaine dans le
      // même mois rechargent la même plage, pour une requête déjà bornée.
      if (!this.isGroup()) await this.loadHeatmap(partieId, d);
      return;
    }
    // Story 30.6, AC10 : contexte personnel — la plage affichée change, `GET /me/calendar` est
    // rappelé avec elle, jamais un cache silencieusement périmé.
    const weekStart = getWeekStart(d);
    const weekEnd = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6),
    );
    await this.loadMeCalendarForRange(
      CalendarView.toIsoDate(weekStart),
      CalendarView.toIsoDate(weekEnd),
    );
  }

  protected onFormChanged(dto: CreateAvailabilityDto | null): void {
    this.pendingDto.set(dto);
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
    this.pendingDto.set(null);
  }

  /**
   * Story 36.7, AC1 — une surface signale qu'une option de vote a été activée : on ouvre le
   * sélecteur, ancré sur l'élément touché.
   *
   * Les surfaces ont déjà tranché *quand* : elles n'émettent que si elles rendent une piste sur
   * ce créneau (couche allumée, rang gagnant `vote`, agrégats servis) et jamais pendant une
   * sélection armée. Rien de tout cela n'est réévalué ici — une seconde règle diveregerait de la
   * première au premier changement.
   */
  protected onVoteOptionActivated(event: VoteOptionActivatedEvent): void {
    // Story 44.2 — un sondage où je ne suis pas votant (places limitées d'un groupe) se lit, il ne se répond pas.
    if (event.vote.readOnly) return;
    // Story 40.5b — un groupe : le sélecteur ne s'ouvre que pour un votant éligible avant l'échéance.
    // Les autres lisent la piste et les compteurs (lecture seule) ; le serveur reste juge de toute façon.
    if (this.isGroup()) {
      const entry = this.groupPolls().find((e) => e.poll.id === event.vote.pollId);
      if (!entry || !this.canVoteGroupPoll(entry.poll)) return;
    }
    const lines = this.orderPickerLines(event.lines ?? []);
    this.pickerLines.set(lines);
    // Plusieurs plages : le vote courant du sélecteur est celui de la première ligne.
    this.pickerVote.set(lines.length >= 2 ? lines[0].vote : event.vote);
    this.pickerAnchor.set(event.anchor);
    this.pickerLabel.set(this.composePickerLabel(event.date, event.slot));
    this.pickerReturnFocus = event.anchor;
  }

  /**
   * Story 47.5 — la plage COURANTE d'abord : l'option de la Destinée si elle couvre le créneau, sinon l'ordre
   * chronologique reçu tel quel. Moins de deux lignes : aucune (le sélecteur d'une plage). La couverture n'est pas
   * recalculée ici — les lignes sont celles de `buildDayDetail()`.
   */
  private orderPickerLines(lines: readonly VoteLine[]): readonly VoteLine[] {
    if (lines.length < 2) return [];
    const current = this.destinyOptionId();
    const at = current === null ? -1 : lines.findIndex((l) => l.vote.optionId === current);
    return at <= 0 ? lines : [lines[at], ...lines.slice(0, at), ...lines.slice(at + 1)];
  }

  /** « ven. 28 août — soir ». Composé ICI et non dans le sélecteur : les formateurs vivent déjà
   *  dans ce fichier, et le sélecteur reste un composant de rendu pur. */
  private composePickerLabel(date: Date, slot: DaySlot): string {
    const day = CALENDAR_CELL_DATE_FORMAT.format(date);
    return slot === 'FULL_DAY' ? day : `${day} — ${SLOT_LABELS[slot].toLowerCase()}`;
  }

  protected closePicker(): void {
    this.pickerVote.set(null);
    this.pickerLines.set([]);
    this.pickerAnchor.set(null);
    // Le focus revient à la ligne ou à la bande d'où l'on vient (AC7). `isConnected` : la surface
    // a pu être re-rendue entre-temps (rechargement après écriture).
    const back = this.pickerReturnFocus;
    this.pickerReturnFocus = null;
    if (back?.isConnected) back.focus();
  }

  /** AC4 — `Échap` ferme sans rien changer.
   *
   *  🚨 C'est bien le `keydown` de l'OVERLAY, jamais celui de la grille : celle-ci a déjà le
   *  sien, qui ANNULE la sélection en cours. Les deux ne doivent jamais se déclencher l'un
   *  l'autre. */
  protected onPickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closePicker();
    }
  }

  /** AC8/AC9/AC10/AC11 — répondre. */
  protected async onVoteAnswerChosen(answer: VoteAnswer, chosen?: VoteParticipation): Promise<void> {
    // Story 47.5 — avec plusieurs plages, la ligne touchée NOMME l'option ; sinon, l'unique vote du sélecteur.
    const vote = chosen ?? this.pickerVote();
    if (!vote || this.pollActionPending()) return;
    await this.writeVote(
      vote,
      () => this.pollSvc.castVote(vote.partieId, vote.pollId, { optionId: vote.optionId, answer }),
      'success.vote_cast',
      this.theme.tone()['poll.cast_error'],
    );
  }

  /** AC3 — retirer. **Seul chemin de retrait du calendrier** depuis cette story. */
  protected async onVoteWithdrawn(chosen?: VoteParticipation): Promise<void> {
    const vote = chosen ?? this.pickerVote();
    if (!vote || this.pollActionPending()) return;
    await this.writeVote(
      vote,
      () => this.pollSvc.withdrawVote(vote.partieId, vote.pollId, vote.optionId),
      'success.vote_withdrawn',
      this.theme.tone()['poll.withdraw_error'],
    );
  }

  /**
   * Le corps commun des deux écritures — un seul endroit où vivent la garde d'unicité, le
   * rechargement et le traitement de l'échec.
   *
   * 🚨 **On recharge, on ne reconstruit pas.** `PollResponseComponent` fabrique un
   * `SessionPollDto` optimiste à la main parce qu'il n'a pas de rechargement sous la main ; ici
   * `loadScenarios()` existe. Un rechargement coûte un appel sur une ACTION utilisateur (jamais
   * au rendu — l'AC7 de la 36.6 porte sur l'affichage) et garantit que les quatre surfaces
   * disent la même chose, la dérivation étant unique depuis la 36.6.
   *
   * 🚨 **On recharge AUSSI en cas d'échec** : un vote a pu être clos entre l'affichage et le
   * geste (le serveur répond alors 400), et le calendrier personnel n'est pas câblé sur SSE —
   * l'écran affichait donc peut-être un vote qui n'existe plus (AC10).
   */
  private async writeVote(
    vote: VoteParticipation,
    write: () => Promise<void>,
    successToneKey: 'success.vote_cast' | 'success.vote_withdrawn',
    errorMessage: string,
  ): Promise<void> {
    this.pollActionPending.set(true);
    this.error.set(null);
    let ok = false;
    try {
      await write();
      ok = true;
    } catch (err) {
      // Story 40.5b — le refus du serveur d'un groupe (hors votants éligibles, échéance dépassée) est
      // écrit tel quel, en français ; une quête garde son message.
      this.error.set(this.isGroup() ? refusalMessage(err, errorMessage) : errorMessage);
    } finally {
      this.pollActionPending.set(false);
    }
    // Revue de code 36.7 : fermer APRÈS l'écriture, jamais avant — sinon `[busy]` (câblé sur
    // `pollActionPending`) ne peut jamais s'afficher (le sélecteur a déjà disparu), et un échec
    // perd son contexte visuel au moment précis où l'utilisateur l'attend.
    this.closePicker();

    if (ok) this.snack.open(this.theme.tone()[successToneKey], undefined, { duration: 3000 });

    // Les deux contextes n'ont pas la même source : contexte de partie ⇒ les scénarios (d'où
    // `activePolls`) ; calendrier personnel ⇒ `GET /me/open-polls` (Story 44.2).
    const partieId = this.partieId();
    if (partieId) await this.reloadVotes(partieId);
    // Story 44.2 — calendrier personnel : mes votes viennent de `GET /me/open-polls`.
    else await this.openPollsSvc.refresh();
  }

  protected async onClosePoll(pollId: string): Promise<void> {
    const id = this.partieId();
    if (!id || this.pollActionPending()) return;
    this.pollActionPending.set(true);
    this.error.set(null);
    try {
      await this.pollSvc.closePoll(id, pollId);
      await this.loadScenarios(id);
    } catch {
      this.error.set(this.theme.tone()['common.impossible_de_cloturer_le_vote_reessayez']);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  /**
   * Story 36.12, AC10/AC11 — sceller un créneau depuis l'Agenda.
   *
   * *(La 36.9 avait retiré l'ancien `onChooseDate()` avec le panneau qui l'appelait, en annonçant
   * que cette story rendrait le scellement à l'Agenda « avec son propre chemin ». Le voici : il
   * est écrit neuf, il ne ressuscite rien.)*
   *
   * 🚨 **Le calendrier n'est PAS le seul chemin de scellement** : la fiche de scénario
   * (`seance-list`) garde son panneau complet et son bouton. Ce chemin s'ajoute, il ne déplace
   * rien.
   *
   * Patron d'écriture identique à `onClosePoll()` : garde anti-double-clic, appel, **rechargement
   * obligatoire** (`chooseDate()` renvoie `void` — sans `loadScenarios()`, la ligne resterait
   * affichée comme un vote ouvert, défaut déjà payé une fois), message d'erreur sur échec.
   */
  protected async onSealRequested(request: AgendaSealRequest): Promise<void> {
    const id = this.partieId();
    if (!id || this.pollActionPending()) return;

    // Revue de code (36.12) — posé AVANT d'ouvrir le dialogue, pas seulement avant l'écriture :
    // sans cela, deux clics rapprochés sur *Sceller* (même sur deux options différentes) passaient
    // tous les deux la garde ci-dessus — elle ne se refermait qu'après confirmation du premier —
    // et ouvraient chacun leur propre dialogue de confirmation.
    this.pollActionPending.set(true);
    try {
      const ref = this.dialog.open(SealConfirmDialog, {
        data: { dateLabel: request.dateLabel, pollLabel: request.pollLabel },
      });
      const confirmed = await firstValueFrom(ref.afterClosed());
      if (!confirmed) return;
      await this.writeSeal(id, request);
    } finally {
      this.pollActionPending.set(false);
    }
  }

  private async writeSeal(id: string, request: AgendaSealRequest): Promise<void> {
    this.error.set(null);
    try {
      // `request.partieId` vient du triplet d'identité de l'option (36.7), jamais de la route :
      // c'est la seule valeur qui reste juste si une ligne d'une autre partie atteignait un jour
      // cette surface. Le serveur reste la garde (`getOwned`), quoi qu'envoie le client.
      await this.pollSvc.chooseDate(request.partieId, request.pollId, {
        optionId: request.optionId,
      });
      await this.loadScenarios(id);
      await this.refreshMjPanels();
    } catch {
      this.error.set(this.theme.tone()['calendar.view_seal_error']);
    }
  }

  /**
   * Story 36.12, AC13 — « Lancer un vote » depuis une ligne d'agenda.
   *
   * 🚨 **Aucun formulaire nouveau, aucun second chemin de création.** On bascule sur le Mois et on
   * arme le mode de composition de la 36.10, ciblé sur la séance : le MJ désigne ses créneaux sur
   * la grille, la barre persistante valide. C'est ce que FR-52 demande — le premier geste est la
   * grille — et c'est le sélecteur « Planifier un vote pour : » qu'elle a supprimé qu'on
   * ressusciterait en ouvrant ici un dialogue de dates.
   */
  protected onPollLaunchRequested(seanceId: string): void {
    if (!seanceId) return;
    // `onViewChange` ferme le sélecteur de réponse : la vue Agenda qui l'ancrait va être démontée.
    this.onViewChange('month');
    this.startCompose(seanceId);
  }

  // Story 8.8, AC6 : ramène le MJ vers la page d'origine (fiche de partie, ou fiche de scénario si
  // ouvert depuis SeanceList via `goToCalendarForSeance`) — s'appuie sur l'historique de navigation
  // du navigateur plutôt que sur un paramètre de retour explicite, aucune page tierce ne pouvant
  // ouvrir l'Oracle autrement que par un lien direct depuis ces deux origines.
  protected goBack(): void {
    // Story 40.5b — « Retour » pendant la composition d'une nouvelle conjonction = renoncer : la
    // fenêtre de création revient avec son brouillon, au lieu de le perdre avec la page.
    if (this.composeTarget()?.kind === 'group-new') {
      this.cancelCompose();
      return;
    }
    this.location.back();
  }

  protected async onPanelSaved(): Promise<void> {
    this.panelOpen.set(false);
    this.pendingDto.set(null);
    await this.loadDeclarations();
    await this.refreshMjPanels();
  }

  protected async onPanelDeleted(): Promise<void> {
    this.panelOpen.set(false);
    this.pendingDto.set(null);
    await this.loadDeclarations();
    await this.refreshMjPanels();
  }

  private async refreshMjPanels(): Promise<void> {
    const id = this.partieId();
    // Story 40.5b — ni créneaux calculés ni agrégat pour un groupe : le serveur les lui refuse.
    if (!id || this.isGroup()) return;
    await Promise.all([
      this.loadAvailableSlots(id, this.fromDateStr(), this.toDateStr()),
      this.loadHeatmap(id),
    ]);
  }

  protected onFromChange(event: Event): void {
    this.fromDateStr.set((event.target as HTMLInputElement).value);
  }

  protected onToChange(event: Event): void {
    this.toDateStr.set((event.target as HTMLInputElement).value);
  }

  protected async onSearch(): Promise<void> {
    const id = this.partieId();
    if (!id) return;
    const from = this.fromDateStr();
    const to = this.toDateStr();
    if (from > to) {
      this.slotsError.set(this.theme.tone()['calendar.view_range_error']);
      return;
    }
    this.slotsError.set(null);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from, to, weeks: null },
      queryParamsHandling: 'merge',
    });
    // Revue de code Story 29.4 : même piège que ngOnInit — cette navigation interne vide le
    // bandeau contextuel via NavigationStart -> clear(), à repositionner.
    this.contextualNav.set({ title: this.theme.tone()['nav.calendar'] });
    await this.loadAvailableSlots(id, from, to);
  }

  private async loadDeclarations(): Promise<void> {
    try {
      this.declarations.set(await this.availabilitySvc.getMyDeclarations());
    } catch {
      this.error.set(this.theme.tone()['calendar.view_load_declarations_error']);
    } finally {
      this.loading.set(false);
    }
  }

  private static toIsoDate(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  /** Calcule exactement la grille du mois affiché (même logique que buildMonth : 6×7 = 42 jours) —
   *  `centerDate` est un Date UTC-midnight (émis par displayDateChange) → utiliser getUTC*.
   *  Story 30.6 : extrait de `loadHeatmap` (comportement inchangé) pour être réutilisé par
   *  `onMonthDateChange` en contexte personnel (AC10). */
  private static monthGridRange(centerDate: Date): { from: string; to: string } {
    const year = centerDate.getUTCFullYear();
    const month = centerDate.getUTCMonth();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const dow = firstOfMonth.getUTCDay();
    const startOffset = dow === 0 ? 6 : dow - 1;
    const gridStart = new Date(Date.UTC(year, month, 1 - startOffset));
    const gridEnd = new Date(
      Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + 41),
    );
    return { from: CalendarView.toIsoDate(gridStart), to: CalendarView.toIsoDate(gridEnd) };
  }

  // Revue de code : identifiant de requête incrémental, même patron que `meCalendarReqId` —
  // une navigation rapide (mois/semaine suivant·e) peut déclencher plusieurs appels
  // `getHeatmap()` qui ne résolvent pas dans l'ordre ; seule la réponse de la dernière requête
  // émise est appliquée.
  private heatmapReqId = 0;

  private async loadHeatmap(id: string, centerDate: Date = new Date()): Promise<void> {
    if (this.isGroup()) return;
    const { from, to } = CalendarView.monthGridRange(centerDate);
    const reqId = ++this.heatmapReqId;
    try {
      const result = await this.pollSvc.getHeatmap(id, from, to);
      if (reqId !== this.heatmapReqId) return;
      this.heatmap.set(result);
    } catch {
      if (reqId !== this.heatmapReqId) return;
      // non-bloquant — le heatmap est un overlay facultatif, mais un échec ne doit pas laisser
      // une couche périmée à l'écran : un canal vide (AC10) est moins trompeur qu'une jauge qui
      // ne reflète plus la réalité.
      this.heatmap.set([]);
    }
  }

  /** Story 47.6 — compteur de requêtes de la liste de l'automate : une réponse périmée (durée changée entre-temps)
   *  est ignorée. */
  private slotsReqId = 0;
  /** Story 47.6 — la durée demandée par la dernière lecture : l'effet de rechargement ne relit que si elle change. */
  private slotsSpanAsked = 1;

  private async loadAvailableSlots(id: string, from?: string, to?: string): Promise<void> {
    if (this.isGroup()) return;
    const reqId = ++this.slotsReqId;
    const span = this.slotsSpan();
    this.slotsSpanAsked = span;
    this.slotsLoading.set(true);
    try {
      const result = await this.pollSvc.getAvailableSlots(id, undefined, from, to, span);
      if (reqId !== this.slotsReqId) return;
      this.availableSlots.set(result);
    } catch {
      if (reqId !== this.slotsReqId) return;
      this.slotsError.set(this.theme.tone()['calendar.view_load_slots_error']);
    } finally {
      if (reqId === this.slotsReqId) this.slotsLoading.set(false);
    }
  }

  // Story 30.6, AC8/AC9/AC10 : un seul appel pour les couches temporelles du calendrier
  // personnel — jamais appelée en contexte de partie.
  // Revue de code : identifiant de requête incrémental — une navigation rapide (mois/semaine
  // suivant·e) peut déclencher plusieurs appels getMyCalendar() qui ne résolvent pas dans l'ordre ;
  // seule la réponse de la dernière requête émise est appliquée.
  private meCalendarReqId = 0;

  private async loadMeCalendarForRange(from: string, to: string): Promise<void> {
    this.fromDateStr.set(from);
    this.toDateStr.set(to);
    this.meCalendarLoading.set(true);
    const reqId = ++this.meCalendarReqId;
    try {
      const result = await this.availabilitySvc.getMyCalendar(from, to);
      if (reqId !== this.meCalendarReqId) return;
      this.meCalendar.set(result);
      this.error.set(null);
    } catch {
      if (reqId !== this.meCalendarReqId) return;
      // Revue de code (AC10) : ne jamais laisser la plage précédente affichée comme si elle
      // était à jour — signaler l'échec et vider les couches temporelles plutôt que de les
      // laisser silencieusement périmées.
      this.meCalendar.set(null);
      this.error.set(this.theme.tone()['calendar.view_load_calendar_error']);
    } finally {
      if (reqId === this.meCalendarReqId) this.meCalendarLoading.set(false);
    }
  }

  private findMatchingDeclaration(date: Date, slot: DaySlot): AvailabilityDeclarationDto | null {
    const now = new Date();
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    return (
      this.declarations().find((d) => {
        if (new Date(d.expiresAt) <= now) return false;
        const slotMatch =
          slot === 'FULL_DAY' ? d.slot === 'FULL_DAY' : d.slot === 'FULL_DAY' || d.slot === slot;
        if (!slotMatch) return false;
        if (d.recurKind === 'RECURRING') {
          if (d.dayOfWeek !== utcDate.getUTCDay()) return false;
          if (d.startDate) {
            const start = new Date(d.startDate.substring(0, 10) + 'T00:00:00Z');
            if (utcDate < start) return false;
          }
          if (d.endDate) {
            const end = new Date(d.endDate.substring(0, 10) + 'T00:00:00Z');
            if (utcDate > end) return false;
          }
          return true;
        }
        // Normalise en UTC minuit pour éviter les décalages de fuseau horaire dans la string ISO
        const start = new Date(d.startDate!.substring(0, 10) + 'T00:00:00Z');
        const end = new Date(d.endDate!.substring(0, 10) + 'T00:00:00Z');
        return utcDate >= start && utcDate <= end;
      }) ?? null
    );
  }
}
