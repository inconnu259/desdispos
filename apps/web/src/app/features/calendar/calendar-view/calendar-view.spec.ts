import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { Location } from '@angular/common';
import { vi } from 'vitest';
import { CalendarView } from './calendar-view';
import { CalendarWeekView } from '../calendar-week-view/calendar-week-view';
import { CalendarMonthView } from '../calendar-month-view/calendar-month-view';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import type { AuthUser, DatableSeanceEntry, OpenPollEntry } from '@master-jdr/shared';
import {
  AvailabilityService,
  ConflictError,
} from '../../../core/availability/availability.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { DatableSeancesService } from '../../../core/poll/datable-seances.service';
import { OpenPollsService } from '../../../core/poll/open-polls.service';
import { PollService } from '../../../core/poll/poll.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { CALENDAR_LAYER_KEYS, DEFAULT_CALENDAR_LAYER_KEYS } from '@master-jdr/shared';
import { toDateKey } from '../day-detail.utils';
import { composeCellKey } from '../selection.utils';
import { RealtimeService, partieTopic, userTopic } from '../../../core/realtime/realtime.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { CalendarSessionLayersService } from '../calendar-session-layers.service';
import { ConjonctionDraftService } from '../../events/conjonction-draft.service';
import { EventsApiService } from '../../events/events-api.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { DateFixDialog } from '../../events/date-fix-dialog/date-fix-dialog';
import { ExtendVoteDialog } from '../../events/extend-vote-dialog/extend-vote-dialog';
import { SealConfirmDialog } from '../seal-confirm-dialog/seal-confirm-dialog';
import { DURATION_TEXT } from '../../../shared/duration-stepper/duration-labels';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

interface CreateOptions {
  mode?: 'mj' | 'personal';
  partieId?: string;
  queryParams?: Record<string, string>;
  scenarios?: any[];
  availabilitySvc?: ReturnType<typeof makeAvailabilityService>;
  authSvc?: ReturnType<typeof makeAuthService>;
  /** Story 36.11, AC6 — largeur simulée. Par défaut **ordinateur**, ce qui préserve le défaut
   *  « vue Mois » de toute la suite existante : jsdom répond `matches: false` à n'importe quelle
   *  media query, donc sans ce mock chaque test basculerait en vue Agenda. */
  desktop?: boolean;
  /** Story 36.12 — les membres servis par `GET /parties/:id/members`. Chargés en mode MJ
   *  seulement ; ils alimentent `missingByPoll()` (AC14). */
  members?: unknown[];
  /** Story 44.2 — mes sondages ouverts tels que `GET /me/open-polls` les sert (calendrier personnel). */
  openPolls?: OpenPollEntry[];
  /** Story 45.1 — mes rendez-vous à dater tels que `GET /me/datable-seances` les sert (calendrier personnel). */
  datable?: DatableSeanceEntry[];
  /** Story 45.1 — la partie de l'atelier telle que `GET /parties/:id` la sert (nom et statut). */
  partie?: { name: string; gameSystemId?: string; status?: string };
  /** Story 44.8 — mes parties (`MyPartiesService`), source du filtre par partie. */
  myParties?: { id: string; name: string; status: string }[];
}

/** Même forme que les mocks de `partie-detail.spec.ts` / `list-control-bar.spec.ts` :
 *  `isMatched()` synchrone + un `observe()` qui n'émet qu'une fois. */
function makeBreakpointObserver(desktop: boolean) {
  return {
    isMatched: () => desktop,
    observe: () => of({ matches: desktop, breakpoints: {} }),
  };
}

// Revue de code 36.14 (AC10, encadré n°2) — `CalendarView` s'abonne désormais à `paramMap`
// (jamais une lecture unique du snapshot au montage), pour suivre un changement de `:id` sur une
// instance réutilisée par Angular. Le mock doit donc porter les deux : `snapshot` pour les query
// params lus une fois, `paramMap` (Observable) pour l'identité de Partie suivie en continu.
function makeActivatedRoute(partieId?: string, queryParams: Record<string, string> = {}) {
  return {
    snapshot: {
      paramMap: { get: (key: string) => (key === 'id' ? (partieId ?? null) : null) },
      queryParamMap: { get: (key: string) => queryParams[key] ?? null },
    },
    // `BehaviorSubject`, pas `of()` : un test de réutilisation de route (Story 36.14, encadré
    // n°2) doit pouvoir pousser une seconde valeur sur la MÊME instance de composant, exactement
    // ce que fait Angular quand il réutilise `CalendarView` sur un simple changement de `:id`.
    paramMap: new BehaviorSubject(convertToParamMap(partieId ? { id: partieId } : {})),
  };
}

function makeAvailabilityService() {
  return {
    getMyDeclarations: vi.fn().mockResolvedValue([]),
    createDeclarationBatch: vi.fn().mockResolvedValue({ created: [] }),
    getMyCalendar: vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    }),
    changed: signal(0),
  };
}

// Story 30.6 : AuthService mocké — seul `currentUser` (source de `defaultCalendarLayers`,
// encadré n°2) est lu par CalendarView.
function makeAuthService(defaultCalendarLayers?: AuthUser['defaultCalendarLayers']) {
  return {
    currentUser: signal<Partial<AuthUser> | null>(
      defaultCalendarLayers ? { defaultCalendarLayers } : null,
    ),
  };
}

function makePollService() {
  return {
    getAvailableSlots: vi.fn().mockResolvedValue([]),
    // Story 46.4 — masquer / démasquer une fenêtre de l'automate.
    hideWindow: vi.fn().mockResolvedValue(undefined),
    showWindow: vi.fn().mockResolvedValue(undefined),
    getHeatmap: vi.fn().mockResolvedValue([]),
    chooseDate: vi.fn().mockResolvedValue(undefined),
    closePoll: vi.fn().mockResolvedValue(undefined),
    // Story 36.7 — les deux écritures du sélecteur de réponse. Sans elles, les nouveaux chemins
    // lèvent au lieu d'échouer proprement.
    castVote: vi.fn().mockResolvedValue(undefined),
    withdrawVote: vi.fn().mockResolvedValue(undefined),
    // Story 36.10 — la mutation des options d'un vote ouvert (D-16).
    setPollOptions: vi.fn().mockResolvedValue(undefined),
  };
}

/** Story 36.4 : le dialogue de résolution est ouvert par CalendarView. Par défaut il est ANNULÉ
 *  (résultat null) — un test qui veut une résolution règle `dialog.__result`. */
function makeMatDialog() {
  const dialog = {
    __result: null as unknown,
    open: vi.fn((component: unknown, config?: { data?: any }) => ({
      component,
      config,
      afterClosed: () => of(dialog.__result),
    })),
  };
  return dialog;
}

function makeSnackBar() {
  return { open: vi.fn() };
}

function makePartiesService(members: unknown[] = []) {
  return { members: vi.fn().mockResolvedValue(members) };
}

// Story 45.1 — une séance du serveur porte toujours `can` et `dateValidee` ; les fixtures historiques de ce fichier
// n'en disent rien : par défaut, tous les droits d'organisateur (le MJ de ces fixtures) et aucune date. Une fixture
// qui veut un refus écrit `can` (Story 45.2 : les droits viennent de `can`, jamais du mode de la route).
function withOrganizerDefaults(scenarios: any[]): any[] {
  return scenarios.map((s) => ({
    ...s,
    seances: (s.seances ?? []).map((se: any) => ({
      can: { propose: true, edit: true, choose: true, extend: false },
      dateValidee: null,
      ...se,
    })),
  }));
}

function makeScenariosService(scenarios: any[] = []) {
  return {
    createSeancePoll: vi.fn().mockResolvedValue({ seances: [] }),
    listAll: vi.fn().mockResolvedValue(withOrganizerDefaults(scenarios)),
    changed: signal<{ partieId: string } | null>(null),
  };
}

function makeRealtimeService() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

const ACTIVE_POLL_SCENARIO = {
  id: 's1',
  partieId: 'partie-1',
  title: 'Chapitre 1',
  description: null,
  status: 'COURANT',
  dureeHeures: null,
  dureeSeances: null,
  resumeFin: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  closedAt: null,
  seances: [
    {
      id: 'seance1',
      scenarioId: 's1',
      compteRendu: null,
      createdAt: '2026-07-13T00:00:00.000Z',
      poll: {
        id: 'poll1',
        partieId: 'partie-1',
        status: 'OPEN',
        scenarioRef: null,
        expiresAt: null,
        chosenDate: null,
        chosenSlot: null,
        // Story 36.6 — effectif de la troupe (MJ + membres).
        membersCount: 4,
        options: [],
      },
    },
  ],
};

/** Un sondage ouvert tel que `GET /me/open-polls` le sert (Story 44.2). */
function openPollEntry(over: Partial<OpenPollEntry> = {}): OpenPollEntry {
  return {
    pollId: 'poll9',
    partieId: 'partie-9',
    partieName: 'Les Cendres',
    family: 'jdr',
    kind: 'CAMPAGNE_LINEAIRE',
    seanceId: 'seance-9',
    title: 'Séance 1',
    expiresAt: null,
    durationSlots: 1,
    options: [
      {
        optionId: 'o1',
        date: '2026-08-28',
        slot: 'EVENING',
        yes: 2,
        maybe: 1,
        no: 0,
        myAnswer: 'YES',
      },
      {
        optionId: 'o2',
        date: '2026-08-29',
        slot: 'EVENING',
        yes: 0,
        maybe: 0,
        no: 1,
        myAnswer: null,
      },
    ],
    eligibleCount: 4,
    answeredCount: 2,
    me: { eligible: true, answered: false },
    can: { propose: false, edit: false, choose: false, extend: false },
    ...over,
  };
}

async function createCalendarView(options?: CreateOptions | 'mj' | 'personal') {
  const opts: CreateOptions = typeof options === 'string' ? { mode: options } : (options ?? {});

  const availabilitySvc = opts.availabilitySvc ?? makeAvailabilityService();
  const authSvc = opts.authSvc ?? makeAuthService();
  const pollSvc = makePollService();
  const snack = makeSnackBar();
  const dialog = makeMatDialog();
  const partiesSvc: any = makePartiesService(opts.members);
  if (opts.partie) {
    partiesSvc.get = vi.fn().mockResolvedValue({ gameSystemId: 'ryuutama', status: 'EN_COURS', ...opts.partie });
  }
  const datableSvc = {
    entries: signal<DatableSeanceEntry[]>(opts.datable ?? []),
    loaded: signal(true),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  const scenariosSvc = makeScenariosService(opts.scenarios ?? []);
  const realtimeSvc = makeRealtimeService();
  const openPollsSvc = {
    entries: signal<OpenPollEntry[]>(opts.openPolls ?? []),
    loaded: signal(true),
    refresh: vi.fn().mockResolvedValue(undefined),
  };

  await TestBed.configureTestingModule({
    imports: [CalendarView],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: ActivatedRoute, useValue: makeActivatedRoute(opts.partieId, opts.queryParams) },
      { provide: AvailabilityService, useValue: availabilitySvc },
      { provide: AuthService, useValue: authSvc },
      { provide: PartiesService, useValue: partiesSvc },
      { provide: PollService, useValue: pollSvc },
      { provide: MatSnackBar, useValue: snack },
      { provide: MatDialog, useValue: dialog },
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: RealtimeService, useValue: realtimeSvc },
      { provide: BreakpointObserver, useValue: makeBreakpointObserver(opts.desktop ?? true) },
      { provide: OpenPollsService, useValue: openPollsSvc },
      { provide: DatableSeancesService, useValue: datableSvc },
      ...(opts.myParties
        ? [
            {
              provide: MyPartiesService,
              useValue: { allParties: signal(opts.myParties), loaded: signal(true) },
            },
          ]
        : []),
    ],
  }).compileComponents();

  // Location réel (nécessaire au Router interne, ex. la synchro d'URL déclenchée par
  // router.navigate() dans ngOnInit) — on espionne juste back() plutôt que de le remplacer.
  const location = TestBed.inject(Location);
  vi.spyOn(location, 'back').mockImplementation(() => {});

  const fixture = TestBed.createComponent(CalendarView);
  if (opts.mode) fixture.componentRef.setInput('mode', opts.mode);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges(); // D5: second cycle pour les bindings asynchrones
  return {
    fixture,
    pollSvc,
    availabilitySvc,
    authSvc,
    snack,
    dialog,
    partiesSvc,
    scenariosSvc,
    realtimeSvc,
    openPollsSvc,
    datableSvc,
    location,
  };
}

/**
 * Story 36.14 — un remontage **dans la même session** : nouvelle instance de composant, MÊME
 * injecteur, donc même `CalendarSessionLayersService`. C'est une navigation interne (quitter le
 * calendrier puis y revenir), à ne pas confondre avec `TestBed.resetTestingModule()`, qui
 * reconstruit l'injecteur et simule un RECHARGEMENT.
 */
async function remountCalendarViewInSession(mode?: 'personal' | 'mj') {
  const fixture = TestBed.createComponent(CalendarView);
  if (mode) fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('CalendarView — signal mode', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('isMjMode() retourne true quand mode="mj"', async () => {
    const { fixture } = await createCalendarView('mj');
    expect((fixture.componentInstance as any).isMjMode()).toBe(true);
  });

  it('isMjMode() retourne false avec le mode par défaut ("personal")', async () => {
    const { fixture } = await createCalendarView();
    expect((fixture.componentInstance as any).isMjMode()).toBe(false);
  });

  it('affiche .mj-results-panel quand mode="mj" (D4)', async () => {
    const { fixture } = await createCalendarView('mj');
    const panel = fixture.nativeElement.querySelector('.mj-results-panel');
    expect(panel).not.toBeNull();
  });

  it('masque .mj-results-panel quand mode="personal" (D4)', async () => {
    const { fixture } = await createCalendarView('personal');
    const panel = fixture.nativeElement.querySelector('.mj-results-panel');
    expect(panel).toBeNull();
  });
});

// ─── Bouton retour contextuel (Story 8.8, AC6) ───────────────────────────────

describe('CalendarView — bouton retour (Story 8.8, AC6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('goBack() appelle Location.back()', async () => {
    const { fixture, location } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    (fixture.componentInstance as any).goBack();
    expect(location.back).toHaveBeenCalledTimes(1);
  });

  it('bouton "Retour" présent dans le DOM sur une route scopée à une Partie', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    expect(fixture.nativeElement.querySelector('.oracle-back-btn')).toBeTruthy();
  });

  it('bouton absent sur la destination globale Calendrier (aucun partieId, correction post-test 29.4)', async () => {
    const { fixture } = await createCalendarView('personal');
    expect(fixture.nativeElement.querySelector('.oracle-back-btn')).toBeNull();
  });
});

// ─── Arrivée avec le composer prêt (Story 8.7 → 45.2) ──────────────────────────

describe('CalendarView — arriver dans l’atelier avec le composer prêt (Story 45.2)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
    window.history.replaceState({}, '', '/');
  });

  /** L'adresse d'ARRIVÉE, posée avant le montage : le paramètre est lu à l'init et nettoyé quand il a servi. */
  const arriveAt = (query: string) =>
    window.history.replaceState({}, '', `/parties/partie-1/calendar?${query}`);

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const NOBODY = { propose: false, edit: false, choose: false, extend: false };

  function cell(iso: string, slot: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return { date: new Date(y, m - 1, d), slot };
  }

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  /** Un scénario à une séance (`id-s1`) ; `over` règle la séance, `scenarioOver` le scénario. */
  function scenario(
    id: string,
    over: Record<string, unknown> = {},
    scenarioOver: Record<string, unknown> = {},
  ) {
    return {
      id,
      partieId: 'partie-1',
      title: `Chapitre ${id}`,
      description: null,
      status: 'COURANT',
      dureeHeures: null,
      dureeSeances: null,
      resumeFin: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      closedAt: null,
      seances: [
        {
          id: `${id}-s1`,
          scenarioId: id,
          compteRendu: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          can: ORGANIZER,
          ...over,
        },
      ],
      ...scenarioOver,
    };
  }

  const openPoll = (pollId: string, extra: Record<string, unknown> = {}) => ({
    id: pollId,
    partieId: 'partie-1',
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    membersCount: 2,
    options: [
      { id: `${pollId}-a`, date: '2026-08-01T00:00:00.000Z', slot: 'EVENING', votes: [] },
      { id: `${pollId}-b`, date: '2026-08-02T00:00:00.000Z', slot: 'MORNING', votes: [] },
    ],
    ...extra,
  });

  const notice = (fixture: any) =>
    (fixture.nativeElement as HTMLElement).querySelector('.calendar-notice span')?.textContent?.trim() ?? null;

  it('?seanceId arme un vote NEUF pour ce rendez-vous, sans panneau 8.7, la barre le nomme', async () => {
    arriveAt('seanceId=sc1-s1');
    const { fixture, location } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      queryParams: { seanceId: 'sc1-s1' },
      scenarios: [scenario('sc1')],
      partie: { name: 'La Tour' },
    });
    const replaceState = vi.spyOn(location, 'replaceState');
    const comp = fixture.componentInstance as any;
    await tick(fixture);

    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc1-s1' });
    expect(comp.composedCells()).toEqual([]);
    expect(comp.composeTargetLabel()).toContain('Chapitre sc1');
    expect(fixture.nativeElement.querySelector('app-compose-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-poll-creation')).toBeNull();
    expect(notice(fixture)).toBeNull();
    // Tant que le composer est armé, rien ne retire le paramètre (un rechargement le réarme) : seul le lien périmé,
    // l'annulation et la validation le nettoient (testés plus bas).
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('?seanceId d’une séance qui porte un vote OUVERT modifiable : le composer part de ses créneaux', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      queryParams: { seanceId: 'sc1-s1' },
      scenarios: [scenario('sc1', { poll: openPoll('poll1') })],
    });
    const comp = fixture.componentInstance as any;
    await tick(fixture);

    expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll1' });
    expect([...comp.composedKeys()].sort()).toEqual(['2026-08-01|EVENING', '2026-08-02|MORNING']);
  });

  it('les droits viennent de `can`, jamais du mode de la route : un calendrier « personnel » d’une partie arme aussi', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      queryParams: { seanceId: 'sc1-s1' },
      scenarios: [scenario('sc1')],
    });
    await tick(fixture);

    expect((fixture.componentInstance as any).composing()).toBe(true);
  });

  it.each([
    ['séance datée', scenario('sc1', { dateValidee: '2099-01-01' }), 'sc1-s1'],
    ['vote déjà lancé et clos', scenario('sc1', { poll: openPoll('p', { status: 'CLOSED' }) }), 'sc1-s1'],
    ['scénario clôturé', scenario('sc1', {}, { status: 'PASSE' }), 'sc1-s1'],
    ['pas le droit de proposer', scenario('sc1', { can: NOBODY }), 'sc1-s1'],
    ['pas le droit de modifier le vote', scenario('sc1', { poll: openPoll('p'), can: NOBODY }), 'sc1-s1'],
    ['rendez-vous inconnu ou d’une autre partie', scenario('sc1'), 'ailleurs-s1'],
  ])('lien périmé (%s) : calendrier normal, message une fois, paramètre retiré', async (_label, sc, seanceId) => {
    arriveAt(`seanceId=${seanceId}`);
    const { fixture, location } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      queryParams: { seanceId },
      scenarios: [sc],
    });
    await tick(fixture);

    expect((fixture.componentInstance as any).composing()).toBe(false);
    expect(notice(fixture)).toBe(GRIMOIRE_TONE['calendar.compose_link_stale']);
    expect(location.path()).not.toContain('seanceId');
  });

  it('la vitrine n’arme jamais de composer : sans partie dans la route, `?seanceId` est ignoré', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      queryParams: { seanceId: 'sc1-s1' },
    });
    await tick(fixture);

    expect((fixture.componentInstance as any).composing()).toBe(false);
    expect(notice(fixture)).toBeNull();
  });

  describe('désigner des créneaux par le geste des dispos (Story 45.3)', () => {
    const armed = async () => {
      const r = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [scenario('sc1')],
      });
      (r.fixture.componentInstance as any).startCompose('sc1-s1');
      await tick(r.fixture);
      return r;
    };
    const keysOf = (comp: any) => comp.composedCells().map((c: any) => `${c.date.getDate()}|${c.slot}`);

    it('« Ajouter au vote » CUMULE : l’union avec les créneaux existants, sans doublon, l’ordre gardé', async () => {
      const { fixture } = await armed();
      const comp = fixture.componentInstance as any;
      comp.onComposeToggled(cell('2026-09-04', 'EVENING'));

      comp.onComposeAdded([
        cell('2026-09-04', 'EVENING'),
        cell('2026-09-11', 'EVENING'),
        cell('2026-09-18', 'EVENING'),
      ]);
      comp.onComposeAdded([cell('2026-09-25', 'AFTERNOON'), cell('2026-09-18', 'EVENING')]);

      expect(keysOf(comp)).toEqual(['4|EVENING', '11|EVENING', '18|EVENING', '25|AFTERNOON']);
    });

    it('en JDR la journée entière est permise ; la barre la propose et rien n’est refusé', async () => {
      const { fixture } = await armed();
      const comp = fixture.componentInstance as any;
      expect(comp.composeAllowsFullDay()).toBe(true);

      comp.onComposeAdded([cell('2026-09-04', 'FULL_DAY'), cell('2026-09-05', 'FULL_DAY')]);

      expect(keysOf(comp)).toEqual(['4|FULL_DAY', '5|FULL_DAY']);
      expect(comp.composeRefusal()).toBeNull();
    });

    it('« Retirer » ôte ces créneaux de la composition ; ceux qui n’y étaient pas ne changent rien', async () => {
      const { fixture } = await armed();
      const comp = fixture.componentInstance as any;
      comp.onComposeAdded([cell('2026-09-04', 'EVENING'), cell('2026-09-11', 'EVENING')]);

      comp.onComposeRemoved([cell('2026-09-04', 'EVENING'), cell('2026-09-30', 'MORNING')]);

      expect(keysOf(comp)).toEqual(['11|EVENING']);
    });

    it('rien n’est écrit tant qu’on ne valide pas, et hors composition ces événements sont sans effet', async () => {
      const { fixture, scenariosSvc, pollSvc } = await armed();
      const comp = fixture.componentInstance as any;
      comp.onComposeAdded([cell('2026-09-04', 'EVENING'), cell('2026-09-11', 'EVENING')]);
      expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
      expect(pollSvc.setPollOptions).not.toHaveBeenCalled();

      comp.cancelCompose();
      comp.onComposeAdded([cell('2026-09-18', 'EVENING')]);
      expect(comp.composedCells()).toEqual([]);
    });

    it('les deux grilles reçoivent la barre en version composition et l’autorisation de journée', async () => {
      const { fixture } = await armed();
      const comp = fixture.componentInstance as any;
      const month = fixture.debugElement.query(By.directive(CalendarMonthView)).componentInstance;
      expect(month.composing()).toBe(true);
      expect(month.composeFullDay()).toBe(comp.composeAllowsFullDay());
    });
  });

  describe('la fin du vote dans le composer (Story 45.4)', () => {
    /** La clé de jour (locale, comme `todayKey`) décalée de `days` jours. */
    const dayIn = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return toDateKey(d);
    };
    const armNew = async () => {
      const r = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [scenario('sc1')],
      });
      const comp = r.fixture.componentInstance as any;
      comp.startCompose('sc1-s1');
      await tick(r.fixture);
      return { ...r, comp };
    };
    const armEdit = async (endDay: string) => {
      // Un vote ouvert se modifie en arrivant par `?seanceId` (45.2) : aucune destinée n'est nécessaire.
      const r = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        queryParams: { seanceId: 'sc1-s1' },
        scenarios: [
          scenario('sc1', { poll: openPoll('poll1', { expiresAt: `${endDay}T23:59:59.999Z` }) }),
        ],
      });
      const comp = r.fixture.componentInstance as any;
      await tick(r.fixture);
      return { ...r, comp };
    };
    const deadlineText = (fixture: any) =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('.compose-bar__deadline-btn')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? null;

    it('un vote NEUF propose « dans 14 jours » pour des créneaux lointains, et la date SUIT les créneaux tant qu’on n’y touche pas', async () => {
      const { comp, fixture } = await armNew();
      // Sans créneau : dans 14 jours.
      expect(comp.composeDeadline()).toBe(dayIn(14));

      comp.onComposeAdded([cell(dayIn(60), 'EVENING'), cell(dayIn(61), 'MORNING')]);
      expect(comp.composeDeadline()).toBe(dayIn(14));
      expect(comp.composeDeadlineHint()).toBe(GRIMOIRE_TONE['calendar.compose_deadline_hint_14']);

      comp.onComposeAdded([cell(dayIn(5), 'EVENING')]);
      await tick(fixture);
      expect(comp.composeDeadline()).toBe(dayIn(4));
      expect(comp.composeDeadlineHint()).toBe(GRIMOIRE_TONE['calendar.compose_deadline_hint_eve']);
      expect(deadlineText(fixture)).toContain('Fin du vote');

      comp.onComposeRemoved([cell(dayIn(5), 'EVENING')]);
      expect(comp.composeDeadline()).toBe(dayIn(14));
    });

    it('premier créneau aujourd’hui : la fin proposée est aujourd’hui, jamais avant', async () => {
      const { comp } = await armNew();
      comp.onComposeAdded([cell(dayIn(0), 'EVENING'), cell(dayIn(2), 'EVENING')]);
      expect(comp.composeDeadline()).toBe(dayIn(0));
      expect(comp.composeDeadlineHint()).toBe(GRIMOIRE_TONE['calendar.compose_deadline_hint_today']);
      expect(comp.composeDeadlinePast()).toBe(false);
    });

    it('une date choisie ne suit plus les créneaux, perd l’explication du défaut, et une date après le premier créneau est permise', async () => {
      const { comp } = await armNew();
      comp.onComposeAdded([cell(dayIn(5), 'EVENING'), cell(dayIn(9), 'EVENING')]);
      comp.onComposeDeadlineChanged(dayIn(7));

      comp.onComposeAdded([cell(dayIn(30), 'EVENING')]);
      expect(comp.composeDeadline()).toBe(dayIn(7));
      expect(comp.composeDeadlineHint()).toBe('');
      expect(comp.composeCanConfirm()).toBe(true);
    });

    it('une date PASSÉE : refus écrit, Valider bloqué, rien n’est écrit', async () => {
      const { comp, scenariosSvc } = await armNew();
      comp.onComposeAdded([cell(dayIn(5), 'EVENING'), cell(dayIn(9), 'EVENING')]);
      comp.onComposeDeadlineChanged(dayIn(-1));

      expect(comp.composeDeadlinePast()).toBe(true);
      expect(comp.composeCanConfirm()).toBe(false);
      expect(comp.composeBlockedReason()).toBe(GRIMOIRE_TONE['calendar.compose_deadline_past']);
      await comp.confirmCompose();
      expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
    });

    it('la création écrit la fin CHOISIE', async () => {
      const { comp, scenariosSvc } = await armNew();
      comp.onComposeAdded([cell(dayIn(5), 'EVENING'), cell(dayIn(9), 'EVENING')]);
      comp.onComposeDeadlineChanged(dayIn(8));

      await comp.confirmCompose();

      expect(scenariosSvc.createSeancePoll).toHaveBeenCalledWith(
        'sc1-s1',
        expect.any(Array),
        dayIn(8),
        // Story 47.4 — durée inchangée : elle ne part pas.
        undefined,
      );
    });

    it('un vote EXISTANT montre sa fin actuelle et ne la fait pas suivre les créneaux', async () => {
      const { comp, fixture } = await armEdit(dayIn(9));
      expect(comp.composeDeadline()).toBe(dayIn(9));
      expect(comp.composeDeadlineHint()).toBe('');

      comp.onComposeAdded([cell(dayIn(2), 'EVENING')]);
      await tick(fixture);
      expect(comp.composeDeadline()).toBe(dayIn(9));
    });

    it('un vote dont la fin est PASSÉE : marqué « passée », Valider bloqué jusqu’à ce qu’on la repousse, puis la nouvelle fin est écrite', async () => {
      const { comp, fixture, pollSvc } = await armEdit(dayIn(-2));
      expect(comp.composeDeadlinePast()).toBe(true);
      expect(deadlineText(fixture)).toContain(GRIMOIRE_TONE['calendar.compose_deadline_ended_tag']);
      expect(comp.composeCanConfirm()).toBe(false);

      comp.onComposeDeadlineChanged(dayIn(6));
      await tick(fixture);
      expect(comp.composeCanConfirm()).toBe(true);
      expect(deadlineText(fixture)).not.toContain(
        GRIMOIRE_TONE['calendar.compose_deadline_ended_tag'],
      );

      await comp.confirmCompose();
      expect(pollSvc.setPollOptions).toHaveBeenCalledWith('partie-1', 'poll1', {
        options: expect.any(Array),
        expiresAt: dayIn(6),
      });
    });

    it('quitter le composer remet la fin à zéro : le suivant repart du défaut', async () => {
      const { comp } = await armNew();
      comp.onComposeDeadlineChanged(dayIn(3));
      comp.cancelCompose();
      comp.startCompose('sc1-s1');
      expect(comp.composeDeadline()).toBe(dayIn(14));
      expect(comp.composeDeadlineHint()).not.toBe('');
    });

    it('la barre porte le champ : texte, explication du défaut, et le crayon ouvre la date native', async () => {
      const { fixture } = await armNew();
      const bar = fixture.nativeElement.querySelector('app-compose-bar') as HTMLElement;
      expect(bar.querySelector('.compose-bar__deadline-hint')?.textContent?.trim()).toBe(
        GRIMOIRE_TONE['calendar.compose_deadline_hint_14'],
      );

      (bar.querySelector('.compose-bar__deadline-btn') as HTMLButtonElement).click();
      await tick(fixture);
      const input = bar.querySelector('.compose-bar__deadline-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.min).toBe(dayIn(0));
      expect(input.value).toBe(dayIn(14));
    });
  });

  describe('modifier et proposer ailleurs depuis la Destinée (Story 45.6)', () => {
    const MODIFY = () => GRIMOIRE_TONE['calendar.view_modify_dates'];
    const OTHER = () => GRIMOIRE_TONE['calendar.destiny_other_rendezvous'];

    /** L'atelier du MJ : un vote ouvert (`sc1`) mis en avant, et `free` séances encore à dater. */
    const atelierWith = async (free: number, canEdit = true) => {
      // Les droits de la séance et ceux de l'entrée servie viennent du même serveur : ils vont ensemble.
      const open = scenario('sc1', { poll: openPoll('poll1'), can: canEdit ? ORGANIZER : NOBODY });
      const frees = Array.from({ length: free }, (_, i) => scenario(`f${i}`));
      const r = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [open, ...frees],
        partie: { name: 'La Tour' },
        openPolls: [
          openPollEntry({
            pollId: 'poll1',
            partieId: 'partie-1',
            family: 'jdr',
            seanceId: 'sc1-s1',
            title: 'Chapitre sc1',
            can: canEdit ? ORGANIZER : NOBODY,
            options: [
              { optionId: 'poll1-a', date: '2026-08-01', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
              { optionId: 'poll1-b', date: '2026-08-02', slot: 'MORNING', yes: 0, maybe: 0, no: 0, myAnswer: null },
            ],
          }),
        ],
      });
      const comp = r.fixture.componentInstance as any;
      comp.destinyPollId.set('poll1');
      await tick(r.fixture);
      return { ...r, comp };
    };

    it('atelier : le plateau offre « Modifier les dates » et le lien, et « Modifier » arme le composer prérempli', async () => {
      const { comp } = await atelierWith(2);
      expect(comp.destinyBoard().actions).toMatchObject({ modifyLabel: MODIFY(), otherLabel: OTHER() });

      comp.openDestinyModify();

      expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll1' });
      expect([...comp.composedKeys()].sort()).toEqual(['2026-08-01|EVENING', '2026-08-02|MORNING']);
      // La Destinée est suspendue, pas quittée : annuler la rend.
      expect(comp.destinyPollId()).toBe('poll1');
    });

    it('atelier : le lien ouvre le choix du rendez-vous (plusieurs) ; un seul le saute et arme le composer', async () => {
      const several = await atelierWith(2);
      several.comp.proposeOther();
      expect(several.comp.rendezvousPickerOpen()).toBe(true);
      expect(several.comp.composing()).toBe(false);
      TestBed.resetTestingModule();

      const one = await atelierWith(1);
      one.comp.proposeOther();
      expect(one.comp.rendezvousPickerOpen()).toBe(false);
      expect(one.comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'f0-s1' });
    });

    it('atelier : sans rien à proposer, « Modifier » seulement — jamais un lien vers un choix vide', async () => {
      const { comp } = await atelierWith(0);
      expect(comp.destinyBoard().actions).toMatchObject({ modifyLabel: MODIFY(), otherLabel: null });
    });

    it('pas organisateur : ni « Modifier » ni lien, et rien ne s’arme', async () => {
      const { comp } = await atelierWith(2, false);
      expect(comp.destinyBoard().actions?.modifyLabel ?? null).toBeNull();
      expect(comp.destinyBoard().actions?.otherLabel ?? null).toBeNull();
      comp.openDestinyModify();
      expect(comp.composing()).toBe(false);
    });

    it('le bouton de la ligne de contrôles et l’action du plateau sont UN comportement', async () => {
      const { comp, fixture } = await atelierWith(2);
      const button = fixture.nativeElement.querySelector('.compose-arm') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe(MODIFY());
      button.click();
      await tick(fixture);
      expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll1' });
    });

    // ── la vitrine : jamais de composer, l'atelier s'ouvre ──
    const vitrine = async (over: Partial<OpenPollEntry>, datable: DatableSeanceEntry[] = []) => {
      const r = await createCalendarView({
        mode: 'personal',
        datable,
        openPolls: [
          openPollEntry({
            pollId: 'poll-j',
            partieId: 'partie-J',
            family: 'jdr',
            seanceId: 'seance-j',
            title: 'Chapitre 4',
            can: ORGANIZER,
            options: [
              { optionId: 'a1', date: '2099-03-04', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
              { optionId: 'a2', date: '2099-03-06', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
            ],
            ...over,
          }),
        ],
      });
      const comp = r.fixture.componentInstance as any;
      comp.destinyPollId.set('poll-j');
      r.fixture.detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      return { ...r, comp, navigate };
    };
    const row = (id: string) =>
      ({
        seanceId: id,
        partieId: `p-${id}`,
        partieName: `Partie ${id}`,
        family: 'jdr',
        kind: 'CAMPAGNE_LINEAIRE',
        title: `Titre ${id}`,
        seanceRank: 1,
        seanceCount: 1,
        can: ORGANIZER,
      }) as DatableSeanceEntry;

    it('vitrine : « Modifier les dates » (plateau ET bouton) ouvre l’atelier de CE vote, `?seanceId` et `?poll` ; aucun composer', async () => {
      const { comp, fixture, navigate } = await vitrine({}, [row('x')]);
      expect(comp.destinyBoard().actions).toMatchObject({ modifyLabel: MODIFY(), otherLabel: OTHER() });
      const button = fixture.nativeElement.querySelector('.compose-arm') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe(MODIFY());

      comp.openDestinyModify();
      expect(navigate).toHaveBeenLastCalledWith('/parties/partie-J/calendar?poll=poll-j&seanceId=seance-j');
      button.click();
      expect(navigate).toHaveBeenCalledTimes(2);
      expect(comp.composing()).toBe(false);
    });

    it('vitrine, vote de groupe : l’atelier du groupe (`/guild-calendar`)', async () => {
      const { comp, navigate } = await vitrine({ family: 'ralliement', partieId: 'partie-G' });
      comp.openDestinyModify();
      expect(navigate).toHaveBeenCalledWith('/parties/partie-G/guild-calendar?poll=poll-j&seanceId=seance-j');
    });

    it('vitrine : le lien « autre rendez-vous » ouvre le choix (plusieurs) ou passe directement à l’atelier (un seul)', async () => {
      const several = await vitrine({}, [row('x'), row('y')]);
      several.comp.proposeOther();
      expect(several.comp.rendezvousPickerOpen()).toBe(true);
      TestBed.resetTestingModule();

      const one = await vitrine({}, [row('x')]);
      one.comp.proposeOther();
      expect(one.navigate).toHaveBeenCalledWith('/parties/p-x/calendar?seanceId=x');
    });

    it('vitrine, pas organisateur : « Proposer des dates » comme avant, ni « Modifier » ni lien', async () => {
      const { comp, fixture } = await vitrine({ can: NOBODY }, [row('x')]);
      expect(comp.destinyBoard().actions?.modifyLabel ?? null).toBeNull();
      expect(comp.destinyBoard().actions?.otherLabel ?? null).toBeNull();
      const button = fixture.nativeElement.querySelector('.compose-arm') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe(GRIMOIRE_TONE['calendar.view_propose_dates']);
    });
  });

  describe('composer et Destinée', () => {
    const withDestiny = () =>
      createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [scenario('sc1', { poll: openPoll('pollX') }), scenario('sc2')],
      });

    it('armer SUSPEND la Destinée (estompe retirée, vote conservé) ; annuler rend l’état d’avant et nettoie l’adresse', async () => {
      const { fixture, location } = await withDestiny();
      const comp = fixture.componentInstance as any;
      comp.destinyPollId.set('pollX');
      await tick(fixture);
      expect(comp.destinyDates()).not.toBeNull();

      location.replaceState('/parties/partie-1/calendar', 'poll=pollX&seanceId=sc2-s1');
      comp.startCompose('sc2-s1');
      await tick(fixture);

      expect(comp.composing()).toBe(true);
      expect(comp.destinyDates()).toBeNull();
      expect(comp.destinyBoardShown()).toBe(false);
      expect(comp.destinyPollId()).toBe('pollX');
      expect(location.path()).toContain('poll=pollX');

      comp.cancelCompose();
      await tick(fixture);

      expect(comp.composing()).toBe(false);
      expect(comp.destinyPollId()).toBe('pollX');
      expect(comp.destinyDates()).not.toBeNull();
      expect(location.path()).not.toContain('seanceId');
      expect(location.path()).toContain('poll=pollX');
    });

    it('valider une CRÉATION : un seul appel, aucun dialogue, la Destinée s’active sur le vote créé, `?poll` posé et `?seanceId` retiré', async () => {
      const { fixture, location, scenariosSvc, dialog, openPollsSvc } = await withDestiny();
      const comp = fixture.componentInstance as any;
      comp.destinyPollId.set('pollX');
      location.replaceState('/parties/partie-1/calendar', 'poll=pollX&seanceId=sc2-s1');
      comp.startCompose('sc2-s1');
      comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
      comp.onComposeToggled(cell('2026-09-05', 'MORNING'));
      // Le serveur renvoie le scénario avec son vote ; la relecture le montre aussi.
      const created = openPoll('pollNew', {
        options: [
          { id: 'n1', date: '2026-09-04T00:00:00.000Z', slot: 'EVENING', votes: [] },
          { id: 'n2', date: '2026-09-05T00:00:00.000Z', slot: 'MORNING', votes: [] },
        ],
      });
      const after = [scenario('sc1', { poll: openPoll('pollX') }), scenario('sc2', { poll: created })];
      scenariosSvc.createSeancePoll.mockResolvedValue(after[1]);
      scenariosSvc.listAll.mockResolvedValue(after);

      await comp.confirmCompose();
      await tick(fixture);

      expect(dialog.open).not.toHaveBeenCalled();
      expect(scenariosSvc.createSeancePoll).toHaveBeenCalledTimes(1);
      expect(scenariosSvc.createSeancePoll).toHaveBeenCalledWith(
        'sc2-s1',
        [
          { date: '2026-09-04', slot: 'EVENING' },
          { date: '2026-09-05', slot: 'MORNING' },
        ],
        // Story 45.4 — la fin du vote proposée accompagne l'écriture.
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        // Story 47.4 — durée inchangée : elle ne part pas.
        undefined,
      );
      expect(openPollsSvc.refresh).toHaveBeenCalled();
      expect(comp.composing()).toBe(false);
      expect(comp.destinyPollId()).toBe('pollNew');
      expect(location.path()).toContain('poll=pollNew');
      expect(location.path()).not.toContain('seanceId');
    });

    it('rendez-vous daté ailleurs pendant la composition : à la validation, message, composer fermé, rien d’écrit', async () => {
      const { fixture, scenariosSvc } = await withDestiny();
      const comp = fixture.componentInstance as any;
      comp.startCompose('sc2-s1');
      comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
      comp.onComposeToggled(cell('2026-09-05', 'MORNING'));
      // Un autre appareil date la séance (temps réel) : elle n'est plus à dater.
      comp.scenarios.set(withOrganizerDefaults([scenario('sc2', { dateValidee: '2099-01-01' })]));

      await comp.confirmCompose();
      await tick(fixture);

      expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
      expect(comp.composing()).toBe(false);
      expect(notice(fixture)).toBe(GRIMOIRE_TONE['calendar.compose_link_stale']);
    });
  });
});

// ─── Sync calendrier → fenêtre de la destinée (Bug 2) ────────────────────────

describe('CalendarView — rafraîchissement après sauvegarde/suppression (Bug 2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('onPanelSaved() recharge créneaux et heatmap quand une partieId est active', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });

    // ngOnInit a déjà appelé les deux loaders une fois
    const slotsBefore = pollSvc.getAvailableSlots.mock.calls.length;
    const heatmapBefore = pollSvc.getHeatmap.mock.calls.length;

    await (fixture.componentInstance as any).onPanelSaved();

    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsBefore + 1);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapBefore + 1);
  });

  it('onPanelDeleted() recharge créneaux et heatmap quand une partieId est active', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });

    const slotsBefore = pollSvc.getAvailableSlots.mock.calls.length;
    const heatmapBefore = pollSvc.getHeatmap.mock.calls.length;

    await (fixture.componentInstance as any).onPanelDeleted();

    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsBefore + 1);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapBefore + 1);
  });

  it('onPanelSaved() sans partieId ne déclenche pas loadAvailableSlots', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'personal' });

    await (fixture.componentInstance as any).onPanelSaved();

    expect(pollSvc.getAvailableSlots).not.toHaveBeenCalled();
  });

  it('onPanelDeleted() sans partieId ne déclenche pas loadAvailableSlots', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'personal' });

    await (fixture.componentInstance as any).onPanelDeleted();

    expect(pollSvc.getAvailableSlots).not.toHaveBeenCalled();
  });
});

// ─── Vote(s) actif(s) — liste multi-poll (Story 8.8, AC7) ────────────────────

describe('CalendarView — activePolls() (Story 8.8, AC7 : plusieurs votes actifs)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('charge les votes actifs (poll OPEN) via ScenariosService.listAll au montage', async () => {
    const { fixture, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    expect(scenariosSvc.listAll).toHaveBeenCalledWith('partie-1');
    expect(comp.activePolls()).toHaveLength(1);
    expect(comp.activePolls()[0].poll.id).toBe('poll1');
    expect(comp.activePolls()[0].scenario.title).toBe('Chapitre 1');
  });

  it('un poll CLOSED (déjà scellé) est exclu de la liste des votes actifs', async () => {
    const closedScenario = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          ...ACTIVE_POLL_SCENARIO.seances[0],
          poll: { ...ACTIVE_POLL_SCENARIO.seances[0].poll, status: 'CLOSED' },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [closedScenario],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.activePolls()).toHaveLength(0);
  });

  it('plusieurs scénarios/séances avec vote OPEN → toutes les entrées présentes, étiquetées', async () => {
    const secondScenario = {
      ...ACTIVE_POLL_SCENARIO,
      id: 's2',
      title: 'Chapitre 2',
      seances: [
        {
          id: 'seance2',
          scenarioId: 's2',
          compteRendu: null,
          createdAt: '2026-07-14T00:00:00.000Z',
          poll: { ...ACTIVE_POLL_SCENARIO.seances[0].poll, id: 'poll2' },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO, secondScenario],
    });
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.poll-entry__label')).map(
      (el: any) => el.textContent.trim(),
    );
    expect(labels).toEqual(['Chapitre 1', 'Chapitre 2']);
  });

  it('un scénario à plusieurs séances → étiquette précise le numéro de séance', async () => {
    const multiSeanceScenario = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          id: 'seanceA',
          scenarioId: 's1',
          compteRendu: null,
          createdAt: '2026-07-10T00:00:00.000Z',
        },
        {
          id: 'seanceB',
          scenarioId: 's1',
          compteRendu: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          poll: { ...ACTIVE_POLL_SCENARIO.seances[0].poll },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [multiSeanceScenario],
    });
    const label = fixture.nativeElement.querySelector('.poll-entry__label').textContent as string;
    expect(label.replace(/\s+/g, ' ').trim()).toBe('Chapitre 1 — Séance 2');
  });

  it('aucun vote actif → message neutre "Aucun vote de date en cours."', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['calendar.view_no_poll']);
  });

  // ⚠️ Story 36.7, AC3 — ce test CHANGE DE SENS. Il verrouillait la présence de
  // `<app-poll-response>` dans le calendrier (story 8.8, AC8) ; depuis cette story, ce composant
  // est le « second chemin de retrait » que l'AC3 interdit : « aucun second chemin de retrait ne
  // subsiste dans le calendrier ». Il est retiré du calendrier, et de lui SEUL — il reste rendu
  // par la fiche de scénario (`seance-list`, `scenario-read-dialog`), qui ont leurs propres tests.
  // Ce que le joueur perd ici, la grille le lui rend : chaque créneau proposé est nommé et porte
  // sa piste depuis la 36.6, et le sélecteur de réponse s'ouvre dessus.
  it('AC3 — le calendrier ne rend plus app-poll-response : le sélecteur est le seul chemin', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    expect(fixture.nativeElement.querySelector('app-poll-response')).toBeNull();
    // Le vote reste LISIBLE dans le calendrier : l'option est projetée en entrée de calendrier.
    const comp = fixture.componentInstance as any;
    expect(comp.calendarEntries().some((e: any) => e.type === 'votes-en-cours')).toBe(true);
  });

  // ⚠️ Story 36.7 — le test « onPollResponded() met à jour uniquement l’entrée concernée » a été
  // RETIRÉ avec la méthode qu'il couvrait. Elle n'existait que pour l'`(responded)` de
  // `<app-poll-response>`, retiré du calendrier par l'AC3 : elle n'avait plus aucun appelant.
  // Ce que faisait sa mise à jour locale est désormais assuré par le rechargement explicite de
  // `writeVote()` — un seul chemin de fraîcheur après une écriture, dans les deux contextes.

  const NO_POLL_SEANCE = {
    id: 'seanceX',
    scenarioId: 's1',
    compteRendu: null,
    createdAt: '2026-07-13T00:00:00.000Z',
  };

  it('une séance sans poll, scénario non PASSE → éligible, étiquetée scénario + séance', async () => {
    const scenario = { ...ACTIVE_POLL_SCENARIO, seances: [NO_POLL_SEANCE] };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [scenario],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.eligibleSeances()).toHaveLength(1);
    expect(comp.eligibleSeances()[0].seance.id).toBe('seanceX');
  });

  it('scénario PASSE → ses séances sont exclues (séance passée)', async () => {
    const scenario = { ...ACTIVE_POLL_SCENARIO, status: 'PASSE', seances: [NO_POLL_SEANCE] };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [scenario],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.eligibleSeances()).toHaveLength(0);
  });

  it('séance avec un poll déjà lié (OPEN) → exclue (vote en cours)', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.eligibleSeances()).toHaveLength(0);
  });

  it('séance avec un poll déjà lié mais CLOSED → exclue quand même (createSeancePoll() la rejetterait)', async () => {
    const closedScenario = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          ...ACTIVE_POLL_SCENARIO.seances[0],
          poll: { ...ACTIVE_POLL_SCENARIO.seances[0].poll, status: 'CLOSED' },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [closedScenario],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.eligibleSeances()).toHaveLength(0);
  });

  it('séance épisodique avec dateValidee déjà posée (héritage) → exclue (date déjà choisie)', async () => {
    const scenario = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          ...NO_POLL_SEANCE,
          inscription: { min: 2, max: 4, inscrits: [], dateValidee: '2026-08-01T00:00:00.000Z' },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [scenario],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.eligibleSeances()).toHaveLength(0);
  });

  it('⚠️ Story 36.10, AC9 — le sélecteur « Planifier un vote pour : » n’est plus rendu, quelle que soit l’éligibilité', async () => {
    const scenario = { ...ACTIVE_POLL_SCENARIO, seances: [NO_POLL_SEANCE] };
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [scenario], // une séance PARFAITEMENT éligible : l'ancien sélecteur s'affichait
    });
    expect(fixture.nativeElement.querySelector('.new-vote-form')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Planifier un vote pour');
  });

  // ⚠️ Story 36.10, AC9 — les trois tests de `startVoteFor()` ont été retirés AVEC le
  // gestionnaire et le sélecteur qui l'appelait (même geste que la 36.9 pour `onChooseDate()`).
  // Ce qu'ils protégeaient — « désigner une séance mène bien à la création d'un vote » — est
  // désormais couvert par les tests de composition : la séance se demande à la validation, et
  // `createSeancePoll()` reste le seul chemin de création.
  //
  // 🚨 `lockedSeanceId` / `pollPanelOpen` ne sont PAS morts pour autant : ils portent l'arrivée
  // depuis `SeanceList` via `?seanceId=`, couverte par son propre test plus haut.
});

// ─── Choix de la date finale (Story 3.4, révisé Story 8.8 — pollId explicite) ─

// ⚠️ Story 36.9, AC4 — les trois tests d'`onChooseDate()` ont été retirés AVEC le gestionnaire :
// le panneau réduit supprime le seul appelant du calendrier, et le scellement reste couvert là où
// il vit désormais (`seance-list.spec.ts`, panneau complet). La garde `pollActionPending`, elle,
// est toujours vivante — elle protège maintenant `onClosePoll` d'une réponse de vote en cours,
// ce que le test réorienté ci-dessous vérifie sur le vrai chemin restant.
describe('CalendarView — onClosePoll() (multi-poll, Story 8.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("onClosePoll() bloqué pendant qu'une réponse de vote est en cours (garde pollActionPending)", async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.pickerVote.set({
      partieId: 'partie-1',
      pollId: 'poll1',
      optionId: 'opt1',
      yes: 0,
      maybe: 0,
      no: 0,
      total: 4,
      myAnswer: null,
    });
    let resolveVote!: () => void;
    pollSvc.castVote.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveVote = resolve;
      }),
    );

    const votePromise = comp.onVoteAnswerChosen('YES');
    await comp.onClosePoll('poll1');
    expect(pollSvc.closePoll).not.toHaveBeenCalled();

    resolveVote();
    await votePromise;
  });

  it('onClosePoll(pollId) appelle pollSvc.closePoll et recharge les votes actifs', async () => {
    const { fixture, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    const callsBefore = scenariosSvc.listAll.mock.calls.length;

    await comp.onClosePoll('poll1');

    expect(pollSvc.closePoll).toHaveBeenCalledWith('partie-1', 'poll1');
    expect(scenariosSvc.listAll.mock.calls.length).toBe(callsBefore + 1);
  });
});

// ─── Connexion temps réel (Story 19.1, AC3) ──────────────────────────────────

describe('CalendarView — connexion temps réel (Story 19.1, AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('connect() est appelé avec partieTopic(partieId) au montage', async () => {
    const { realtimeSvc } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('partie-1'));
  });

  it('disconnect() est appelé à la destruction du composant', async () => {
    const { fixture, realtimeSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
    });
    fixture.destroy();
    expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('partie-1'));
  });

  it('une notification ScenariosService.changed() recharge scénarios et créneaux/heatmap', async () => {
    const { fixture, scenariosSvc, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
    });
    const listAllCallsBefore = scenariosSvc.listAll.mock.calls.length;
    const slotsCallsBefore = pollSvc.getAvailableSlots.mock.calls.length;
    const heatmapCallsBefore = pollSvc.getHeatmap.mock.calls.length;

    scenariosSvc.changed.set({ partieId: '*' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll.mock.calls.length).toBe(listAllCallsBefore + 1);
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsCallsBefore + 1);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapCallsBefore + 1);
  });

  it('bug fix : une notification AvailabilityService.changed() (dispo d’un autre membre) recharge créneaux/heatmap', async () => {
    const { fixture, availabilitySvc, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
    });
    const slotsCallsBefore = pollSvc.getAvailableSlots.mock.calls.length;
    const heatmapCallsBefore = pollSvc.getHeatmap.mock.calls.length;

    availabilitySvc.changed.set(1);
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsCallsBefore + 1);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapCallsBefore + 1);
  });

  it('garde firstRun : un AvailabilityService.changed() déjà non-nul au montage ne déclenche PAS de refetch redondant', async () => {
    const availabilitySvc = {
      getMyDeclarations: vi.fn().mockResolvedValue([]),
      createDeclarationBatch: vi.fn().mockResolvedValue({ created: [] }),
      getMyCalendar: vi.fn().mockResolvedValue({
        'mes-indisponibilites': [],
        'mes-disponibilites': [],
        'mes-seances': [],
        'votes-en-cours': [],
        'inscriptions-ouvertes': [],
      }),
      changed: signal(1),
    };
    const { pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      availabilitySvc,
    });
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(1);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(1);
  });
});

describe('CalendarView — bandeau contextuel (Story 29.4)', () => {
  it("ngOnInit() renseigne ContextualNavService avec le titre de l'écran", async () => {
    await createCalendarView('personal');

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe(TONE_MAP['grimoire-emeraude']['nav.calendar']);
  });
});

// ─── Câblage de la sélection par glissement (Story 30.3) ─────────────────────

describe('CalendarView — onBatchDeclareRequested (Story 30.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const CELLS = [
    { date: new Date('2026-08-10'), slot: 'EVENING' as const },
    { date: new Date('2026-08-11'), slot: 'EVENING' as const },
  ];

  it('un seul appel à createDeclarationBatch, jamais une boucle (AC1, AC7)', async () => {
    const { fixture, availabilitySvc } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(availabilitySvc.createDeclarationBatch).toHaveBeenCalledTimes(1);
    const items = availabilitySvc.createDeclarationBatch.mock.calls[0][0];
    expect(items).toHaveLength(2);
    expect(items.every((i: { recurKind: string }) => i.recurKind === 'PUNCTUAL')).toBe(true);
  });

  it('succès → recharge les déclarations', async () => {
    const { fixture, availabilitySvc } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;
    availabilitySvc.getMyDeclarations.mockClear();

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'AVAILABLE' });

    expect(availabilitySvc.getMyDeclarations).toHaveBeenCalledTimes(1);
  });

  // ⚠️ Story 36.4 — ces deux tests CHANGENT DE VÉRITÉ (ils ne disparaissent pas). Le 409 ne se
  // solde plus par une snackbar d'échec en bloc : il OUVRE le dialogue de résolution (D-18).

  function conflict(startDate: string, batchIndex: number) {
    return {
      id: 'ex-' + batchIndex,
      kind: 'AVAILABLE' as const,
      slot: 'EVENING' as const,
      recurKind: 'PUNCTUAL' as const,
      startDate,
      endDate: startDate,
      dayOfWeek: null,
      batchIndex,
    };
  }

  function rejectingBatch(conflicts: ReturnType<typeof conflict>[]) {
    const svc = makeAvailabilityService();
    let call = 0;
    svc.createDeclarationBatch = vi.fn(() => {
      call += 1;
      // 1er appel : le serveur refuse et énumère les conflits. 2e appel (résolu) : succès.
      return call === 1
        ? Promise.reject(new ConflictError(conflicts))
        : Promise.resolve({ created: [] });
    });
    return svc;
  }

  it('AC1 : 409 → le dialogue de résolution s’ouvre, aucune snackbar d’échec en bloc', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    const { fixture, snack, dialog } = await createCalendarView({
      mode: 'personal',
      availabilitySvc,
    });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(snack.open).not.toHaveBeenCalled();
  });

  it('AC2 : le dialogue reçoit les créneaux NOMMÉS, pas un simple décompte', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-10', 0), conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    const data = dialog.open.mock.calls[0][1]!.data;
    const labels = data.conflicts.map((c: { label: string }) => c.label);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain('10');
    expect(labels[1]).toContain('11');
    expect(data.conflicts.map((c: { batchIndex: number }) => c.batchIndex)).toEqual([0, 1]);
    // Story 35.2 — les mots de la phrase « Vous déclarez <kind> <intent> » viennent du registre :
    // un trou `{from}`/`{to}` oublié ou une clé inversée laisserait une accolade à l'écran.
    expect(data.kind).toBe('UNAVAILABLE');
    expect(data.intentLabel).toBeTruthy();
    expect(data.intentLabel).not.toMatch(/[{}]/);
  });

  it('AC2 : un créneau « Journée » est nommé par sa seule date — sinon le séparateur devient ambigu', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 0)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({
      cells: [{ date: new Date('2026-08-10'), slot: 'FULL_DAY' as const }],
      kind: 'UNAVAILABLE',
    });

    const label = dialog.open.mock.calls[0][1]!.data.conflicts[0].label as string;
    expect(label).not.toContain('Journée');
    expect(label).toContain('10');
  });

  it('AC2 : un créneau partiel garde son nom de créneau', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 0)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({
      cells: [{ date: new Date('2026-08-10'), slot: 'EVENING' as const }],
      kind: 'UNAVAILABLE',
    });

    expect(dialog.open.mock.calls[0][1]!.data.conflicts[0].label).toContain('Soir');
  });

  it('AC12 : la sélection est RETENUE — la résolution rejoue le lot complet en un seul appel', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    dialog.__result = { 1: 'overwrite' };
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(availabilitySvc.createDeclarationBatch).toHaveBeenCalledTimes(2);
    const items = availabilitySvc.createDeclarationBatch.mock.calls[1][0];
    expect(items).toHaveLength(2);
    expect(items[0].conflictResolution).toBeUndefined();
    expect(items[1].conflictResolution).toBe('overwrite');
  });

  it('AC10 : annuler le dialogue → aucun second appel, rien n’est enregistré', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    dialog.__result = null;
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(availabilitySvc.createDeclarationBatch).toHaveBeenCalledTimes(1);
  });

  it('AC10 : un geste résolu ne produit jamais plus de DEUX appels, quel que soit le nombre de conflits', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-10', 0), conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    dialog.__result = { 0: 'keep', 1: 'overwrite' };
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(availabilitySvc.createDeclarationBatch).toHaveBeenCalledTimes(2);
    const items = availabilitySvc.createDeclarationBatch.mock.calls[1][0];
    expect(items[0].conflictResolution).toBe('keep');
    expect(items[1].conflictResolution).toBe('overwrite');
  });

  it('AC14 : un conflit INTERNE (sans batchIndex exploitable) garde le message d’échec en bloc', async () => {
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.createDeclarationBatch = vi.fn().mockRejectedValue(
      new ConflictError([
        { ...conflict('2026-08-10', 0), id: 'batch-item-0', internal: true },
        { ...conflict('2026-08-11', 1), id: 'batch-item-1', internal: true },
      ]),
    );
    const { fixture, snack, dialog } = await createCalendarView({
      mode: 'personal',
      availabilitySvc,
    });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(dialog.open).not.toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledTimes(1);
  });

  it('AC11 : une cellule couverte par une séance figure en exception, et jamais en conflit', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    availabilitySvc.getMyCalendar = vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [
        {
          seanceId: 's1',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc1',
          scenarioTitle: 'Le Convoi',
          date: '2026-08-10',
          slot: 'EVENING',
        },
      ],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    });
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'AVAILABLE' });

    const data = dialog.open.mock.calls[0][1]!.data;
    expect(data.seanceExceptions).toHaveLength(1);
    expect(data.seanceExceptions[0]).toContain('10');
    expect(data.conflicts.map((c: { batchIndex: number }) => c.batchIndex)).not.toContain(0);
  });

  it('Story 47.3 : une cellule du 2ᵉ jour d’une plage figure aussi en exception', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    availabilitySvc.getMyCalendar = vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [
        {
          seanceId: 's1',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc1',
          scenarioTitle: 'Le Convoi',
          // Commence le 9 au soir et couvre le 10 au soir : la cellule testée n'est PAS son premier jour.
          date: '2026-08-09',
          slot: 'EVENING',
          endDate: '2026-08-10',
          endSlot: 'EVENING',
          durationSlots: 4,
        },
      ],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    });
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'AVAILABLE' });

    expect(dialog.open.mock.calls[0][1]!.data.seanceExceptions).toHaveLength(1);
  });

  it('Story 47.3 : l’entrée du calendrier personnel porte la fin d’une plage, pas celle d’un créneau seul', async () => {
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.getMyCalendar = vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [
        {
          seanceId: 'w',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc1',
          scenarioTitle: 'Week-end',
          date: '2026-08-14',
          slot: 'EVENING',
          endDate: '2026-08-16',
          endSlot: 'AFTERNOON',
          durationSlots: 6,
        },
        {
          seanceId: 'u',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc2',
          scenarioTitle: 'Soirée',
          date: '2026-08-20',
          slot: 'EVENING',
          endDate: '2026-08-20',
          endSlot: 'EVENING',
          durationSlots: 1,
        },
      ],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    });
    const { fixture } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const entries = (fixture.componentInstance as any).allCalendarEntries() as {
      seanceId?: string;
      endDate?: string;
      endSlot?: string;
    }[];

    expect(entries.find((e) => e.seanceId === 'w')).toMatchObject({
      endDate: '2026-08-16',
      endSlot: 'AFTERNOON',
    });
    expect(entries.find((e) => e.seanceId === 'u')?.endDate).toBeUndefined();
  });

  it('AC11 : sans séance recouverte, aucune exception n’est transmise au dialogue', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(dialog.open.mock.calls[0][1]!.data.seanceExceptions).toEqual([]);
  });

  it('AC11 : construire l’exception n’émet AUCUN appel réseau supplémentaire', async () => {
    const availabilitySvc = rejectingBatch([conflict('2026-08-11', 1)]);
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    availabilitySvc.getMyCalendar.mockClear();
    dialog.__result = null;
    const comp = fixture.componentInstance as any;

    await comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' });

    expect(availabilitySvc.getMyCalendar).not.toHaveBeenCalled();
  });

  it('une garde empêche d’ouvrir deux dialogues de conflit à la fois', async () => {
    // Rejet SYSTÉMATIQUE : sans garde, les deux gestes ouvriraient chacun leur dialogue.
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.createDeclarationBatch = vi
      .fn()
      .mockRejectedValue(new ConflictError([conflict('2026-08-11', 1)]));
    const { fixture, dialog } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;

    await Promise.all([
      comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' }),
      comp.onBatchDeclareRequested({ cells: CELLS, kind: 'UNAVAILABLE' }),
    ]);

    expect(dialog.open).toHaveBeenCalledTimes(1);
  });
});

// ─── Couches du calendrier — état et bandeau (Story 30.6, AC3/AC4/AC7, encadré n°2) ───────────

describe('CalendarView — couches actives (Story 30.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('montage en contexte personnel : 5 couches actives (disponibilite-groupe absente, AC8)', async () => {
    const authSvc = makeAuthService([
      'mes-indisponibilites',
      'mes-disponibilites',
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
      'disponibilite-groupe',
    ]);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });
    const comp = fixture.componentInstance as any;

    expect(comp.activeLayers()).toEqual([
      'mes-indisponibilites',
      'mes-disponibilites',
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
    ]);
  });

  it('montage en contexte de partie : 6 couches actives (disponibilite-groupe incluse, AC9)', async () => {
    const authSvc = makeAuthService([
      'mes-indisponibilites',
      'mes-disponibilites',
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
      'disponibilite-groupe',
    ]);
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1', authSvc });
    const comp = fixture.componentInstance as any;

    expect(comp.activeLayers()).toHaveLength(6);
    expect(comp.activeLayers()).toContain('disponibilite-groupe');
  });

  it('toggleLayer() retire une couche par défaut → isOverridden() true (AC4, retrait pas seulement ajout)', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;
    expect(comp.isOverridden()).toBe(false);

    comp.toggleLayer('mes-indisponibilites');

    expect(comp.activeLayers()).not.toContain('mes-indisponibilites');
    expect(comp.isOverridden()).toBe(true);
  });

  it('toggleLayer() ajoute une couche absente du défaut → isOverridden() true', async () => {
    const authSvc = makeAuthService(['mes-disponibilites']);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });
    const comp = fixture.componentInstance as any;
    expect(comp.isOverridden()).toBe(false);

    comp.toggleLayer('mes-indisponibilites');

    expect(comp.isOverridden()).toBe(true);
  });

  it('resetToDefault() réaffecte le défaut du compte, aucun appel HTTP émis (AC3, encadré n°2)', async () => {
    const availabilitySvc = makeAvailabilityService();
    const { fixture } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;
    comp.toggleLayer('mes-indisponibilites');
    expect(comp.isOverridden()).toBe(true);
    const callsBefore = availabilitySvc.getMyCalendar.mock.calls.length;

    comp.resetToDefault();

    expect(comp.isOverridden()).toBe(false);
    expect(availabilitySvc.getMyCalendar.mock.calls.length).toBe(callsBefore);
  });

  /**
   * ⚠️ Story 36.14 — CE TEST A CHANGÉ DE VÉRITÉ, il n'a pas été supprimé.
   *
   * Story 30.6, il prouvait qu'une bascule ne survivait à AUCUN remontage. Depuis la 36.14, une
   * bascule survit à un remontage **dans la même session** (AC9) et ne survit **qu'à cela** : le
   * `TestBed.resetTestingModule()` ci-dessous reconstruit l'injecteur, donc le service de mémoire,
   * ce qui est exactement ce qu'un RECHARGEMENT fait en production (AC10).
   *
   * Ce qui n'a pas bougé, et que ce test continue de prouver : la bascule n'écrit jamais le
   * **défaut de compte** (encadré n°2 de la 30.6) — le second montage retrouve la préférence
   * d'origine, intacte.
   */
  it('un rechargement (injecteur reconstruit) rétablit le défaut de compte (AC10)', async () => {
    const authSvc = makeAuthService(['mes-disponibilites', 'mes-indisponibilites']);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });
    const comp = fixture.componentInstance as any;
    comp.toggleLayer('mes-indisponibilites');
    expect(comp.activeLayers()).toEqual(['mes-disponibilites']);

    fixture.destroy();
    TestBed.resetTestingModule();
    const second = await createCalendarView({ mode: 'personal', authSvc });
    const comp2 = second.fixture.componentInstance as any;

    expect(comp2.activeLayers()).toEqual(['mes-disponibilites', 'mes-indisponibilites']);
  });

  it('une bascule survit à un retour sur le MÊME calendrier dans la MÊME session (AC9)', async () => {
    const authSvc = makeAuthService(['mes-disponibilites', 'mes-indisponibilites']);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });
    (fixture.componentInstance as any).toggleLayer('mes-indisponibilites');
    fixture.destroy();

    const second = await remountCalendarViewInSession('personal');

    expect((second.componentInstance as any).activeLayers()).toEqual(['mes-disponibilites']);
  });

  it('la bascule écrit sous la clé DE CE calendrier, jamais sous une autre (AC10)', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    (fixture.componentInstance as any).toggleLayer('mes-seances');

    const session = TestBed.inject(CalendarSessionLayersService);
    expect(session.read('partie:partie-1')).not.toBeNull();
    expect(session.read('personal')).toBeNull();
    expect(session.read('partie:autre')).toBeNull();
  });

  /**
   * 🚨 `resetToDefault()` ÉCRIT le défaut dans la mémoire, il n'efface pas l'entrée. Effacer
   * laisserait la mémoire dire « jamais visité » alors que le lecteur vient d'exprimer un choix :
   * inoffensif ici, mais le jour où le défaut de compte change en cours de session (écran Compte
   * ouvert dans un autre onglet), un retour rejouerait une valeur que le lecteur a explicitement
   * écartée.
   */
  it('resetToDefault() mémorise le défaut, et le retour en session le retrouve (AC9)', async () => {
    const authSvc = makeAuthService(['mes-disponibilites', 'mes-indisponibilites']);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });
    const comp = fixture.componentInstance as any;
    comp.toggleLayer('mes-indisponibilites');
    comp.resetToDefault();
    fixture.destroy();

    const session = TestBed.inject(CalendarSessionLayersService);
    expect(session.read('personal')).toEqual(['mes-disponibilites', 'mes-indisponibilites']);

    const second = await remountCalendarViewInSession('personal');
    expect((second.componentInstance as any).activeLayers()).toEqual([
      'mes-disponibilites',
      'mes-indisponibilites',
    ]);
    expect((second.componentInstance as any).isOverridden()).toBe(false);
  });
});

// ─── Réutilisation de route sans destruction (revue de code 36.14, encadré n°2) ──────────────
//
// Angular réutilise la MÊME instance de `CalendarView` quand seul le paramètre `:id` change sur
// une route déjà appariée (`/parties/:id/calendar` → `/parties/:id/calendar` avec un autre id) :
// `ngOnInit` ne se relance PAS. Ces tests poussent une seconde valeur sur le même
// `ActivatedRoute.paramMap` (un `BehaviorSubject`, jamais un remontage de composant) pour prouver
// que `partieId()`, la mémoire de session ET les données scopées à la Partie suivent — pas
// seulement au premier montage. [Source: deferred-work.md:117]

describe('CalendarView — changement de :id sur une instance réutilisée (revue de code 36.14)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function pushParamMap(id: string | undefined) {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
    };
    route.paramMap.next(convertToParamMap(id ? { id } : {}));
  }

  async function settle(fixture: { detectChanges: () => void }) {
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  it("un changement de :id reprend la mémoire de session DE LA NOUVELLE partie, jamais celle de l'ancienne", async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    comp.toggleLayer('mes-seances');

    const session = TestBed.inject(CalendarSessionLayersService);
    session.write('partie:partie-2', ['votes-en-cours']);

    pushParamMap('partie-2');
    await settle(fixture);

    expect(comp.partieId()).toBe('partie-2');
    expect(comp.activeLayers()).toEqual(['votes-en-cours']);
  });

  it('44.6 : la Destinée de l’ancienne partie ne se ferme pas sur un faux « clos » dans la nouvelle', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [openPollEntry({ pollId: 'poll1', partieId: 'partie-1', title: 'Séance 1' })],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll1');
    await settle(fixture);
    expect(comp.destinyPollId()).toBe('poll1');

    pushParamMap('partie-2');
    await settle(fixture);

    expect(comp.destinyPollId()).toBeNull();
    expect(fixture.nativeElement.querySelector('.calendar-notice')).toBeNull();
  });

  it('reconnecte le canal temps réel sur le nouveau partieId, et déconnecte l’ancien', async () => {
    const { fixture, realtimeSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
    });

    pushParamMap('partie-2');
    await settle(fixture);

    expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic('partie-1'));
    expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('partie-2'));
  });

  it('recharge les scénarios de la nouvelle partie (et non plus ceux de l’ancienne)', async () => {
    const { fixture, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
    });
    const callsBefore = scenariosSvc.listAll.mock.calls.length;

    pushParamMap('partie-2');
    await settle(fixture);

    expect(scenariosSvc.listAll.mock.calls.length).toBe(callsBefore + 1);
    expect(scenariosSvc.listAll).toHaveBeenLastCalledWith('partie-2');
  });

  it('un retour au contexte personnel (id absent) réinitialise partieId() à null', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    expect(comp.partieId()).toBe('partie-1');

    pushParamMap(undefined);
    await settle(fixture);

    expect(comp.partieId()).toBeNull();
  });
});

// ─── La barre repliée, le panneau « Affichage » et la pastille (Story 36.14) ──────────────────

describe('CalendarView — barre repliée et panneau « Affichage » (Story 36.14)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Le panneau ancré est rendu dans le conteneur d'overlay du CDK, hors du fixture. */
  function menuSurface(): HTMLElement | null {
    return document.querySelector('.display-surface--menu');
  }

  async function openPanel(fixture: any) {
    fixture.nativeElement.querySelector('.display-trigger').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('AC1 — la bascule de vues partage la ligne de contrôles', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const bar = fixture.nativeElement.querySelector('.calendar-controls');

    expect(bar.querySelector('mat-button-toggle-group')).toBeTruthy();
    expect(bar.querySelector('.controls-spacer')).toBeTruthy();
  });

  it('AC1 — les couches ne sont plus une bande permanente dans la barre', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const bar = fixture.nativeElement.querySelector('.calendar-controls');

    expect(bar.querySelector('app-calendar-layer-toggle')).toBeNull();
    expect(fixture.nativeElement.querySelector('.display-trigger')).toBeTruthy();
  });

  it('story 51.5 — le déclencheur « Affichage » porte le pictogramme menu-affichage, sans caractère', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const trigger = fixture.nativeElement.querySelector('.display-trigger');

    expect(trigger.querySelector('app-icon').getAttribute('data-icon')).toBe('menu-affichage');
    expect(trigger.textContent).not.toContain('☰');
  });

  it('AC2 — sur ordinateur, activer le bouton ouvre un menu ancré', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: true });
    expect(menuSurface()).toBeNull();

    await openPanel(fixture);

    expect(menuSurface()).toBeTruthy();
    expect(menuSurface()!.querySelectorAll('.layer-chip')).toHaveLength(4);
    expect(document.querySelector('.display-surface--sheet')).toBeNull();
  });

  it('AC2 — sur téléphone, le même contenu monte du bas en feuille', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: false });

    await openPanel(fixture);

    const sheet = fixture.nativeElement.querySelector('.display-surface--sheet');
    expect(sheet).toBeTruthy();
    expect(sheet.querySelector('app-calendar-display-panel')).toBeTruthy();
    expect(menuSurface()).toBeNull();
  });

  /**
   * 🚨 AC12 — le commentaire posé dans `calendar-view.html` par la story 36.9 s'adressait
   * nommément à celle-ci : « Quand la story 36.14 repliera les couches derrière « ☰ Affichage »,
   * ce contrôle devra RESTER dehors. » Un mode se voit tant qu'il est actif ; l'enfermer dans un
   * panneau fermé par défaut le rendrait invisible.
   */
  it('AC12 — la Destinée reste dans la barre, jamais dans le panneau', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    await openPanel(fixture);

    expect(
      fixture.nativeElement.querySelector('.calendar-controls app-destiny-control'),
    ).toBeTruthy();
    expect(menuSurface()!.querySelector('app-destiny-control')).toBeNull();
  });

  it('AC3 — aucune pastille de résumé quand l’affichage est au défaut', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });

    expect(fixture.nativeElement.querySelector('.display-summary')).toBeNull();
  });

  it('AC4 — un écart fait apparaître la pastille, qui compte sur les couches AFFICHÉES', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    (fixture.componentInstance as any).toggleLayer('mes-seances');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.display-summary');
    expect(badge).toBeTruthy();
    // 4 interrupteurs en personnel (ni `inscriptions-ouvertes`, ni `disponibilite-groupe`),
    // dont 3 restent actifs — le contrat exige « 3 sur 4 », jamais « sur 5 ».
    expect(badge.textContent.trim()).toBe('Affichage filtré · 3 sur 4 · Rétablir');
  });

  it('AC4 — la pastille EST l’action de rétablissement', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;
    comp.toggleLayer('mes-seances');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.display-summary').click();
    fixture.detectChanges();

    expect(comp.isOverridden()).toBe(false);
    expect(fixture.nativeElement.querySelector('.display-summary')).toBeNull();
  });

  it('AC4 — en contexte de partie le dénominateur passe à 5', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    (fixture.componentInstance as any).toggleLayer('mes-seances');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.display-summary').textContent.trim()).toBe(
      'Affichage filtré · 4 sur 5 · Rétablir',
    );
  });

  /**
   * 🚨 AC17 — le piège fin de cette story. `isOverridden()` raisonne sur le jeu COMPLET des
   * couches, `inscriptions-ouvertes` comprise, alors que la pastille COMPTE sur le jeu affiché.
   * Restreindre `isOverridden()` à `availableLayerKeys()` ferait apparaître la pastille au premier
   * affichage pour tout compte portant encore cette clé — garde-fou explicitement posé par la
   * story 36.11 (tâche 7), qui a retiré l'interrupteur sans retirer la clé.
   */
  it('AC17 — un compte portant `inscriptions-ouvertes` n’affiche AUCUNE pastille au montage', async () => {
    const authSvc = makeAuthService([...CALENDAR_LAYER_KEYS]);
    const { fixture } = await createCalendarView({ mode: 'personal', authSvc });

    expect((fixture.componentInstance as any).isOverridden()).toBe(false);
    expect(fixture.nativeElement.querySelector('.display-summary')).toBeNull();
  });

  it('AC5 — la légende est fermée au montage et l’interrupteur du panneau l’ouvre', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;
    expect(comp.legendVisible()).toBe(false);

    await openPanel(fixture);
    (menuSurface()!.querySelector('.display-panel__legend-toggle') as HTMLElement).click();
    fixture.detectChanges();

    expect(comp.legendVisible()).toBe(true);
  });

  it('AC18 — le bouton porte un nom accessible et annonce son état', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const trigger = fixture.nativeElement.querySelector('.display-trigger');

    expect(trigger.getAttribute('aria-label')).toBe(GRIMOIRE_TONE['calendar.display.trigger_aria']);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await openPanel(fixture);
    expect(
      fixture.nativeElement.querySelector('.display-trigger').getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('AC18 — Échap ferme le panneau et rend le focus au bouton', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: false });
    await openPanel(fixture);
    const comp = fixture.componentInstance as any;
    expect(comp.displayPanelOpen()).toBe(true);

    comp.onDisplayPanelKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(comp.displayPanelOpen()).toBe(false);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.display-trigger'));
  });

  /**
   * 🚨 `Échap` porte DEUX gestes sur cet écran : fermer le panneau, et annuler la sélection en
   * cours dans la grille. Sans la barrière de propagation, fermer le panneau effacerait une
   * sélection que l'utilisateur n'a pas touchée.
   */
  it('Échap sur le panneau ne se propage pas jusqu’à la grille', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: false });
    await openPanel(fixture);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    const spy = vi.spyOn(event, 'stopPropagation');

    (fixture.componentInstance as any).onDisplayPanelKeydown(event);

    expect(spy).toHaveBeenCalled();
  });
});

// ─── Source des couches — deux chemins distincts (Story 30.6, AC6/AC8/AC9, encadré n°1) ───────

describe('CalendarView — source des couches (Story 30.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('contexte personnel : GET /me/calendar appelé une seule fois au montage', async () => {
    const availabilitySvc = makeAvailabilityService();
    await createCalendarView({ mode: 'personal', availabilitySvc });

    expect(availabilitySvc.getMyCalendar).toHaveBeenCalledTimes(1);
  });

  it('contexte de partie : GET /me/calendar jamais appelé (AC9)', async () => {
    const availabilitySvc = makeAvailabilityService();
    await createCalendarView({ mode: 'mj', partieId: 'partie-1', availabilitySvc });

    expect(availabilitySvc.getMyCalendar).not.toHaveBeenCalled();
  });

  it('contexte de partie : votes-en-cours dérivé d’activePolls, aucune requête HTTP de plus en bascule (AC6)', async () => {
    const { fixture, pollSvc, scenariosSvc, availabilitySvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    const slotsCalls = pollSvc.getAvailableSlots.mock.calls.length;
    const heatmapCalls = pollSvc.getHeatmap.mock.calls.length;
    const listAllCalls = scenariosSvc.listAll.mock.calls.length;
    const meCalendarCalls = availabilitySvc.getMyCalendar.mock.calls.length;

    comp.toggleLayer('votes-en-cours');

    expect(comp.agendaEntries().some((e: any) => e.type === 'votes-en-cours')).toBe(false);
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsCalls);
    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapCalls);
    expect(scenariosSvc.listAll.mock.calls.length).toBe(listAllCalls);
    expect(availabilitySvc.getMyCalendar.mock.calls.length).toBe(meCalendarCalls);
  });
});

// ─── Piste de participation — une entrée par OPTION (Story 36.6, AC8) ─────────────────────────

const TWO_OPTION_POLL_SCENARIO = {
  ...ACTIVE_POLL_SCENARIO,
  seances: [
    {
      ...ACTIVE_POLL_SCENARIO.seances[0],
      poll: {
        ...ACTIVE_POLL_SCENARIO.seances[0].poll,
        membersCount: 4,
        options: [
          {
            id: 'o1',
            date: '2026-08-28T00:00:00.000Z',
            slot: 'EVENING',
            votes: [
              { userId: 'me', pseudo: 'Moi', displayName: 'Moi', answer: 'YES' },
              { userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'YES' },
              { userId: 'u3', pseudo: 'Cyd', displayName: 'Cyd', answer: 'MAYBE' },
            ],
          },
          {
            id: 'o2',
            date: '2026-08-29T00:00:00.000Z',
            slot: 'EVENING',
            votes: [{ userId: 'u2', pseudo: 'Bob', displayName: 'Bob', answer: 'NO' }],
          },
        ],
      },
    },
  ],
};

describe('CalendarView — une piste par créneau proposé (Story 36.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC8 — contexte de partie : un vote à deux options produit DEUX entrées, sur DEUX dates', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const votes = comp.calendarEntries().filter((e: any) => e.type === 'votes-en-cours');
    expect(votes).toHaveLength(2);
    expect(votes.map((e: any) => e.date).sort()).toEqual(['2026-08-28', '2026-08-29']);
  });

  it('AC8 — les clés restent distinctes entre deux options du même vote', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const keys = comp
      .calendarEntries()
      .filter((e: any) => e.type === 'votes-en-cours')
      .map((e: any) => e.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('AC7 — les compteurs et ma réponse sont dérivés de la charge utile déjà chargée (AD-20), aucun appel de plus', async () => {
    const authSvc = { currentUser: signal<Partial<AuthUser> | null>({ id: 'me' }) };
    const { fixture, pollSvc, scenariosSvc, availabilitySvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      authSvc,
    });
    const comp = fixture.componentInstance as any;

    const first = comp
      .calendarEntries()
      .find((e: any) => e.type === 'votes-en-cours' && e.date === '2026-08-28');
    expect(first.vote).toEqual({
      partieId: 'partie-1',
      pollId: 'poll1',
      optionId: 'o1',
      yes: 2,
      maybe: 1,
      no: 0,
      total: 4,
      myAnswer: 'YES',
    });
    // Aucun appel réseau n'a été émis pour obtenir cela : la charge utile était déjà là.
    expect(availabilitySvc.getMyCalendar).not.toHaveBeenCalled();
    expect(pollSvc.getAvailableSlots).toHaveBeenCalledTimes(1);
    expect(scenariosSvc.listAll).toHaveBeenCalledTimes(1);
  });

  it("une option sur laquelle je n'ai pas voté porte myAnswer null", async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const second = comp
      .calendarEntries()
      .find((e: any) => e.type === 'votes-en-cours' && e.date === '2026-08-29');
    expect(second.vote.myAnswer).toBeNull();
    expect(second.vote.no).toBe(1);
  });

  it('AC6/AC8 — contexte personnel : les agrégats servis par GET /me/open-polls sont repris tels quels, une entrée par option (Story 44.2)', async () => {
    const availabilitySvc = makeAvailabilityService();
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc,
      openPolls: [openPollEntry()],
    });
    const comp = fixture.componentInstance as any;

    const votes = comp.calendarEntries().filter((e: any) => e.type === 'votes-en-cours');
    expect(votes).toHaveLength(2);
    expect(votes[0].vote).toEqual({
      partieId: 'partie-9',
      pollId: 'poll9',
      optionId: 'o1',
      yes: 2,
      maybe: 1,
      no: 0,
      // Le dénominateur est le nombre de votants éligibles du sondage.
      total: 4,
      myAnswer: 'YES',
      readOnly: false,
    });
    // Plus aucun vote dans `GET /me/calendar`.
    expect(availabilitySvc.getMyCalendar).toHaveBeenCalledTimes(1);
  });

  it('Story 44.2 — un vote de groupe figure aussi sur la grille personnelle, avec ma réponse ; un non-votant le lit sans pouvoir répondre', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [
        openPollEntry({ pollId: 'pj', family: 'jdr' }),
        openPollEntry({
          pollId: 'pg',
          partieId: 'groupe-1',
          partieName: 'Les amis',
          family: 'ralliement',
          me: { eligible: false, answered: false },
        }),
      ],
    });
    const comp = fixture.componentInstance as any;
    const votes = comp.calendarEntries().filter((e: any) => e.type === 'votes-en-cours');

    expect(votes.map((e: any) => e.vote.pollId)).toEqual(['pj', 'pj', 'pg', 'pg']);
    expect(votes.find((e: any) => e.vote.pollId === 'pg').vote.readOnly).toBe(true);
    expect(votes.find((e: any) => e.vote.pollId === 'pj').vote.readOnly).toBe(false);

    // Le sélecteur de réponse ne s'ouvre jamais sur un sondage où je ne vote pas.
    const anchor = document.createElement('button');
    const readOnly = votes.find((e: any) => e.vote.pollId === 'pg');
    comp.onVoteOptionActivated({
      vote: readOnly.vote,
      anchor,
      date: new Date(Date.UTC(2026, 7, 28)),
      slot: 'EVENING',
    });
    expect(comp.pickerVote()).toBeNull();
    const votable = votes.find((e: any) => e.vote.pollId === 'pj');
    comp.onVoteOptionActivated({
      vote: votable.vote,
      anchor,
      date: new Date(Date.UTC(2026, 7, 28)),
      slot: 'EVENING',
    });
    expect(comp.pickerVote()).not.toBeNull();
  });

  it('Story 44.2 — un vote dans un autre mois est dans la liste complète (rail, grille) mais pas dans l’Agenda de la période affichée', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [
        openPollEntry({
          pollId: 'loin',
          options: [
            {
              optionId: 'l1',
              date: '2031-01-10',
              slot: 'EVENING',
              yes: 0,
              maybe: 0,
              no: 0,
              myAnswer: null,
            },
          ],
        }),
      ],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.calendarEntries().some((e: any) => e.vote?.pollId === 'loin')).toBe(true);
    expect(comp.agendaEntries().some((e: any) => e.vote?.pollId === 'loin')).toBe(false);
  });
});

// ─── Vue Agenda (Story 30.6, AC1/AC2) ─────────────────────────────────────────────────────────

describe('CalendarView — vue Agenda (Story 30.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * ⚠️ Story 36.14 — CE TEST A CHANGÉ DE VÉRITÉ, il n'a pas été supprimé. La bascule émet
   * désormais DEUX formulations par vue (« Vue agenda » et « Agenda »), le CSS choisissant selon
   * la largeur du conteneur : `textContent` rend donc leur concaténation.
   *
   * Il interroge maintenant le NOM ACCESSIBLE, qui est le vrai contrat : il porte la forme longue
   * à toutes les largeurs et ne se tronque jamais avec le visuel (piège n°11 de la 36.13).
   */
  it('troisième option "Vue agenda" présente dans le sélecteur (AC1)', async () => {
    const { fixture } = await createCalendarView('personal');
    // Material transfère `aria-label` sur le bouton interne : c'est LUI qui porte le nom
    // accessible, l'hôte `<mat-button-toggle>` n'en a pas.
    const names = Array.from(
      fixture.nativeElement.querySelectorAll('mat-button-toggle button'),
    ).map((el: any) => el.getAttribute('aria-label'));
    expect(names).toEqual(['Vue mois', 'Vue semaine', 'Vue agenda']);
  });

  /**
   * 🚨 DÉFAUT RÉEL TROUVÉ À L'ÉCRAN, et invisible à jsdom, qui n'évalue aucune container query.
   * En contexte de partie, le panneau MJ prend la moitié de la largeur : la barre ne fait plus
   * que **380 px dans une fenêtre de 1725 px**, alors que les trois libellés longs pèsent 319 px
   * à eux seuls. Elle repassait à TROIS lignes — le défaut même que cette story répare.
   *
   * Ce que ce test peut voir : que les deux formulations existent TOUJOURS dans le DOM, jamais
   * un `@if` de largeur. C'est la moitié testable de la règle ; l'autre moitié se mesure à l'œil.
   */
  it('AC1 — les deux formulations sont toujours dans le DOM, seul le CSS choisit', async () => {
    const { fixture } = await createCalendarView('personal');
    const root = fixture.nativeElement;

    expect([...root.querySelectorAll('.vt-long')].map((e: any) => e.textContent.trim())).toEqual([
      'Vue mois',
      'Vue semaine',
      'Vue agenda',
    ]);
    expect([...root.querySelectorAll('.vt-short')].map((e: any) => e.textContent.trim())).toEqual([
      'Mois',
      'Sem.',
      'Agenda',
    ]);
  });

  it('bascule vers la vue agenda affiche app-calendar-agenda-view', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onViewChange('agenda');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-calendar-agenda-view')).toBeTruthy();
  });

  it('une couche désactivée n’apporte plus ses entrées à agendaEntries()', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc: (() => {
        const svc = makeAvailabilityService();
        svc.getMyCalendar.mockResolvedValue({
          'mes-indisponibilites': [],
          'mes-disponibilites': [],
          'mes-seances': [
            {
              seanceId: 'sX',
              partieId: 'pX',
              partieName: 'Partie X',
              scenarioId: 'scX',
              scenarioTitle: 'Chapitre X',
              date: '2026-09-01',
              slot: 'EVENING',
            },
          ],
          'votes-en-cours': [],
          'inscriptions-ouvertes': [],
        });
        return svc;
      })(),
    });
    const comp = fixture.componentInstance as any;

    expect(comp.agendaEntries().some((e: any) => e.type === 'mes-seances')).toBe(true);

    comp.toggleLayer('mes-seances');

    expect(comp.agendaEntries().some((e: any) => e.type === 'mes-seances')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.1 — Le rail de détail
// ─────────────────────────────────────────────────────────────────────────────

/** Calendrier personnel portant une séance datée, pour exercer le rail hors contexte de partie. */
function makeAvailabilityServiceWithSeance(date = '2026-09-01', slot = 'EVENING') {
  const svc = makeAvailabilityService();
  svc.getMyCalendar.mockResolvedValue({
    'mes-indisponibilites': [],
    'mes-disponibilites': [],
    'mes-seances': [
      {
        seanceId: 'sX',
        partieId: 'pX',
        partieName: 'Partie X',
        scenarioId: 'scX',
        scenarioTitle: 'Chapitre X',
        date,
        slot,
      },
    ],
    'votes-en-cours': [],
    'inscriptions-ouvertes': [],
  });
  return svc;
}

describe('CalendarView — rail : présence permanente (AC1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('rend le rail en vue mois', async () => {
    const { fixture } = await createCalendarView('personal');

    expect(fixture.nativeElement.querySelector('app-calendar-detail-rail')).toBeTruthy();
  });

  it('rend le rail en vue semaine', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onViewChange('week');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-calendar-detail-rail')).toBeTruthy();
  });

  it('ne rend pas le rail en vue agenda — celle-ci est déjà une liste détaillée', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onViewChange('agenda');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-calendar-detail-rail')).toBeNull();
  });

  it('n’expose aucun geste d’ouverture ou de fermeture du rail', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    expect(comp.railOpen).toBeUndefined();
    expect(comp.toggleRail).toBeUndefined();
  });
});

describe('CalendarView — rail : il suit le toucher (AC2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // ⚠️ Story 36.3, AC1/AC11 — ce test portait la garantie « le toucher ouvre TOUJOURS le
  // panneau » (AC9 de 36.1). Elle est levée : le toucher arme une sélection, et le panneau se
  // rejoint par « Autre… ». Ce qui reste dû, c'est que le rail suive — AC2 de 36.1.
  it('AC11 — un toucher peuple le rail et n’ouvre PLUS le panneau de déclaration', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'EVENING' });
    fixture.detectChanges();

    expect(comp.railSlot()).toBe('EVENING');
    expect(comp.railDetail().date).toBe('2026-09-01');
    expect(comp.panelOpen()).toBe(false);
  });

  it('AC4/AC10 — « Autre… » ouvre le panneau, avec la déclaration existante s’il y en a une', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onDeclarationPanelRequested({ date: new Date(2026, 8, 1), slot: 'EVENING' });
    fixture.detectChanges();

    expect(comp.panelOpen()).toBe(true);
    expect(comp.selectedSlot()).toBe('EVENING');
    // `selectedExisting` est renseigné par le même chemin qu'avant (findMatchingDeclaration) —
    // sans lui, la suppression et la découpe d'une récurrente deviendraient inatteignables.
    expect(comp.selectedExisting()).toBeDefined();
    // Le rail suit aussi ce chemin (AC11).
    expect(comp.railDetail().date).toBe('2026-09-01');
  });

  it('n’utilise PAS les signaux du panneau — fermer le panneau ne vide pas le rail', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'EVENING' });
    comp.closePanel();
    fixture.detectChanges();

    expect(comp.panelOpen()).toBe(false);
    expect(comp.railDetail().date).toBe('2026-09-01');
  });

  it('le détail porte toujours trois créneaux', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'FULL_DAY' });

    expect(comp.railDetail().slots.map((s: any) => s.slot)).toEqual([
      'MORNING',
      'AFTERNOON',
      'EVENING',
    ]);
  });
});

describe('CalendarView — rail : état de repos (AC3/AC4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('montre le prochain jour porteur quand aucune case n’a été touchée', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc: makeAvailabilityServiceWithSeance('2026-09-01'),
    });
    const comp = fixture.componentInstance as any;

    expect(comp.railDate()).toBeNull();
    expect(comp.railDetail().date).toBe('2026-09-01');
    expect(comp.railDetail().slots[2].seanceLabel).toBe('Partie X — Chapitre X');
  });

  it('retombe sur aujourd’hui quand rien n’est porteur, plutôt qu’un rail blanc', async () => {
    const { fixture } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    const todayKey = new Date().toLocaleDateString('sv-SE');
    expect(comp.railDetail().date).toBe(todayKey);
    expect(comp.railDetail().isEmpty).toBe(true);
  });
});

describe('CalendarView — rail : AC5, zéro appel réseau supplémentaire', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('un toucher n’émet aucun appel de plus (contexte personnel)', async () => {
    const { fixture, availabilitySvc, pollSvc } = await createCalendarView('personal');
    const comp = fixture.componentInstance as any;

    const calendarCalls = availabilitySvc.getMyCalendar.mock.calls.length;
    const declCalls = availabilitySvc.getMyDeclarations.mock.calls.length;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'MORNING' });
    comp.railDetail();
    fixture.detectChanges();

    expect(availabilitySvc.getMyCalendar.mock.calls.length).toBe(calendarCalls);
    expect(availabilitySvc.getMyDeclarations.mock.calls.length).toBe(declCalls);
    expect(pollSvc.getHeatmap).not.toHaveBeenCalled();
    expect(pollSvc.getAvailableSlots).not.toHaveBeenCalled();
  });

  it('un toucher n’émet aucun appel de plus (contexte de partie)', async () => {
    const { fixture, availabilitySvc, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const heatmapCalls = pollSvc.getHeatmap.mock.calls.length;
    const slotsCalls = pollSvc.getAvailableSlots.mock.calls.length;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'MORNING' });
    comp.railDetail();
    fixture.detectChanges();

    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapCalls);
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsCalls);
    // Le calendrier personnel n'est JAMAIS appelé depuis un contexte de partie (AD-18).
    expect(availabilitySvc.getMyCalendar).not.toHaveBeenCalled();
  });
});

describe('CalendarView — bandes du Mois : AC13, zéro appel réseau', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('basculer une couche ne déclenche aucun appel — les bandes se redérivent localement', async () => {
    const { fixture, availabilitySvc, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const heatmapCalls = pollSvc.getHeatmap.mock.calls.length;
    const slotsCalls = pollSvc.getAvailableSlots.mock.calls.length;
    const declCalls = availabilitySvc.getMyDeclarations.mock.calls.length;

    comp.toggleLayer('mes-seances');
    comp.toggleLayer('votes-en-cours');
    fixture.detectChanges();

    expect(pollSvc.getHeatmap.mock.calls.length).toBe(heatmapCalls);
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(slotsCalls);
    expect(availabilitySvc.getMyDeclarations.mock.calls.length).toBe(declCalls);
    expect(availabilitySvc.getMyCalendar).not.toHaveBeenCalled();
  });

  it('transmet à la vue Mois les entrées NON filtrées par couche (FR-50)', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const before = comp.calendarEntries().length;
    comp.toggleLayer('votes-en-cours');

    // agendaEntries() perd les votes, calendarEntries() les conserve : c'est ce qui permet à la
    // case de garder son rang et son indisponibilité quand la couche est éteinte.
    expect(comp.agendaEntries().some((e: any) => e.type === 'votes-en-cours')).toBe(false);
    expect(comp.calendarEntries().length).toBe(before);
  });
});

describe('CalendarView — rail : AC6, la couche gouverne le texte', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('éteindre « mes séances » retire le titre mais garde l’indisponibilité', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc: makeAvailabilityServiceWithSeance('2026-09-01'),
    });
    const comp = fixture.componentInstance as any;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'EVENING' });
    expect(comp.railDetail().slots[2].seanceLabel).toBe('Partie X — Chapitre X');
    expect(comp.railDetail().slots[2].status).toBe('UNAVAILABLE');

    comp.toggleLayer('mes-seances');

    expect(comp.railDetail().slots[2].seanceLabel).toBeNull();
    expect(comp.railDetail().slots[2].status).toBe('UNAVAILABLE');
  });
});

describe('CalendarView — rail : AC11, activer une ligne ouvre le scénario', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('navigue vers l’écran du scénario, jamais vers un écran de séance', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc: makeAvailabilityServiceWithSeance('2026-09-01'),
    });
    const comp = fixture.componentInstance as any;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await comp.onScenarioActivated({ partieId: 'pX', scenarioId: 'scX' });

    expect(navigate).toHaveBeenCalledWith(['/parties', 'pX', 'scenarios', 'scX']);
  });

  it('expose une cible navigable sur la séance du calendrier personnel', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      availabilitySvc: makeAvailabilityServiceWithSeance('2026-09-01'),
    });
    const comp = fixture.componentInstance as any;

    expect(comp.railDetail().slots[2].seanceTarget).toEqual({
      partieId: 'pX',
      scenarioId: 'scX',
    });
  });

  it('les entrées de séance d’un contexte de partie ne nomment que CETTE partie (AC7)', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [ACTIVE_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    const seances = comp.agendaEntries().filter((e: any) => e.type === 'mes-seances');
    for (const s of seances) expect(s.partieId).toBe('partie-1');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 36.7 — le sélecteur de réponse de vote
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe('CalendarView — le sélecteur de réponse de vote (Story 36.7)', () => {
  /** 🚨 Le sélecteur vit dans le CONTENEUR D'OVERLAY, attaché à `document.body` — jamais dans
   *  `fixture.nativeElement`. Une assertion négative faite dans le fixture passerait toujours,
   *  pour une mauvaise raison. On interroge donc le document, et on nettoie entre les tests. */
  function pickerEl(): HTMLElement | null {
    return document.body.querySelector('app-vote-answer-picker');
  }

  function pickerOption(answer: string): HTMLButtonElement {
    return document.body.querySelector(
      `app-vote-answer-picker .opt2--answer[data-answer="${answer}"]`,
    ) as HTMLButtonElement;
  }

  afterEach(() => {
    // Sans ce nettoyage, les overlays s'accumulent d'un test à l'autre et les assertions de
    // présence deviennent fausses par intermittence.
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  /** Ouvre le sélecteur en jouant le signal que les vues émettent (`voteOptionActivated`) —
   *  le chemin réel, sans dépendre du rendu d'une bande dans jsdom. */
  async function openPicker(fixture: any, vote: Record<string, unknown>, anchor?: HTMLElement) {
    const el = anchor ?? document.createElement('div');
    document.body.appendChild(el);
    (fixture.componentInstance as any).onVoteOptionActivated({
      vote,
      date: new Date(2026, 7, 28),
      slot: 'EVENING',
      anchor: el,
    });
    await tick(fixture);
    return el;
  }

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const PARTIE_VOTE = {
    partieId: 'partie-1',
    pollId: 'poll1',
    optionId: 'o1',
    yes: 2,
    maybe: 1,
    no: 0,
    total: 4,
    myAnswer: 'YES' as const,
  };

  it('AC1 — ouvre un sélecteur proposant oui, peut-être, non', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });

    expect(pickerEl()).toBeNull();
    await openPicker(fixture, PARTIE_VOTE);

    expect(pickerEl()).toBeTruthy();
    expect(pickerOption('YES')).toBeTruthy();
    expect(pickerOption('MAYBE')).toBeTruthy();
    expect(pickerOption('NO')).toBeTruthy();
  });

  it("AC1 — l'entête nomme le jour ET le créneau touchés", async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    await openPicker(fixture, PARTIE_VOTE);

    const head = document.body.querySelector('app-vote-answer-picker .picker__head');
    expect(head?.textContent).toContain('28');
    expect(head?.textContent?.toLowerCase()).toContain('soir');
  });

  it("AC8 — en contexte de partie, l'écriture vise la partie de la ROUTE", async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    await openPicker(fixture, PARTIE_VOTE);

    pickerOption('MAYBE').click();
    await tick(fixture);

    expect(pollSvc.castVote).toHaveBeenCalledWith('partie-1', 'poll1', {
      optionId: 'o1',
      answer: 'MAYBE',
    });
  });

  it("AC8 — en calendrier PERSONNEL, l'écriture vise la partie de l'ENTRÉE, pas une autre", async () => {
    // Le seul test qui prouve l'encadré n°3 : le calendrier personnel agrège plusieurs parties,
    // et rien dans la route ne dit laquelle porte le vote touché.
    const { fixture, pollSvc } = await createCalendarView({ mode: 'personal' });
    await openPicker(fixture, { ...PARTIE_VOTE, partieId: 'partie-9', pollId: 'poll9' });

    pickerOption('NO').click();
    await tick(fixture);

    expect(pollSvc.castVote).toHaveBeenCalledWith('partie-9', 'poll9', {
      optionId: 'o1',
      answer: 'NO',
    });
  });

  it('AC2/AC3 — le retrait passe par ce sélecteur, et par lui seul', async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    await openPicker(fixture, PARTIE_VOTE);

    const withdraw = document.body.querySelector(
      'app-vote-answer-picker .opt2--withdraw',
    ) as HTMLButtonElement;
    expect(withdraw).toBeTruthy();
    withdraw.click();
    await tick(fixture);

    expect(pollSvc.withdrawVote).toHaveBeenCalledWith('partie-1', 'poll1', 'o1');
  });

  it('AC4 — fermer sans choisir ne change rien', async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    await openPicker(fixture, PARTIE_VOTE);

    (fixture.componentInstance as any).closePicker();
    await tick(fixture);

    expect(pickerEl()).toBeNull();
    expect(pollSvc.castVote).not.toHaveBeenCalled();
    expect(pollSvc.withdrawVote).not.toHaveBeenCalled();
  });

  it('AC4 — Échap ferme le sélecteur sans rien écrire', async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    await openPicker(fixture, PARTIE_VOTE);

    (fixture.componentInstance as any).onPickerKeydown(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    await tick(fixture);

    expect(pickerEl()).toBeNull();
    expect(pollSvc.castVote).not.toHaveBeenCalled();
  });

  it("AC9 — après une écriture réussie, le sélecteur se ferme et l'écran se recharge", async () => {
    const { fixture, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const before = scenariosSvc.listAll.mock.calls.length;
    await openPicker(fixture, PARTIE_VOTE);

    pickerOption('YES').click();
    await tick(fixture);

    expect(pollSvc.castVote).toHaveBeenCalledTimes(1);
    expect(scenariosSvc.listAll.mock.calls.length).toBeGreaterThan(before);
    expect(pickerEl()).toBeNull();
  });

  it("AC9 — en calendrier personnel, c'est GET /me/open-polls qui est relu (Story 44.2)", async () => {
    const { fixture, openPollsSvc } = await createCalendarView({ mode: 'personal' });
    const before = openPollsSvc.refresh.mock.calls.length;
    await openPicker(fixture, { ...PARTIE_VOTE, partieId: 'partie-9' });

    pickerOption('YES').click();
    await tick(fixture);

    expect(openPollsSvc.refresh.mock.calls.length).toBeGreaterThan(before);
  });

  it("AC10 — un échec n'affiche jamais une réponse comme enregistrée", async () => {
    // `myAnswer` se dérive de l'utilisateur courant : sans lui, la piste ne saurait pas dire ce
    // que J'AI répondu, et l'assertion porterait sur rien.
    const authSvc = { currentUser: signal<Partial<AuthUser> | null>({ id: 'me' }) };
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      authSvc,
    });
    pollSvc.castVote.mockRejectedValueOnce(new Error('400'));
    await openPicker(fixture, PARTIE_VOTE);

    pickerOption('NO').click();
    await tick(fixture);

    const comp = fixture.componentInstance as any;
    expect(comp.error()).toBeTruthy();
    // L'état affiché n'a pas bougé : la piste dit toujours ce que le serveur, lui, dit.
    const entry = comp
      .calendarEntries()
      .find((e: any) => e.type === 'votes-en-cours' && e.vote?.optionId === 'o1');
    expect(entry.vote.myAnswer).toBe('YES');
  });

  it("AC11 — deux activations rapprochées ne produisent qu'UNE requête", async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    // La première écriture est laissée EN VOL : c'est le seul état où la garde d'unicité peut
    // être observée. On la relâche à la fin du test pour ne pas laisser de promesse pendante.
    let release!: () => void;
    const inFlight = new Promise<void>((resolve) => (release = resolve));
    pollSvc.castVote.mockImplementationOnce(() => inFlight);
    await openPicker(fixture, PARTIE_VOTE);

    const comp = fixture.componentInstance as any;
    comp.onVoteAnswerChosen('YES');
    comp.onVoteAnswerChosen('NO');
    await tick(fixture);

    expect(pollSvc.castVote).toHaveBeenCalledTimes(1);
    release();
    await tick(fixture);
  });
});

// ─── Disponibilité du groupe, canal séparé (Story 36.8) ──────────────────────────────────────
describe('CalendarView — la disponibilité du groupe (Story 36.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Zoneless : pas de zone.js, donc `whenStable()` seul ne suffit pas pour un enchaînement
   *  asynchrone — la boucle de ticks établie du projet (36.6 / 36.7). */
  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  /** Deux créneaux du même jour : l'un où le groupe s'est prononcé, l'autre où PERSONNE n'a rien
   *  dit — c'est ce second cas que l'ancien `continue` faisait disparaître avant d'atteindre la
   *  grille, et c'est l'un des deux vides de l'AC6. */
  const HEATMAP = [
    {
      date: '2026-09-01',
      slot: 'MORNING',
      available: 2,
      unavailable: 1,
      unknown: 1,
      total: 4,
    },
    {
      date: '2026-09-01',
      slot: 'EVENING',
      available: 0,
      unavailable: 0,
      unknown: 4,
      total: 4,
    },
  ];

  async function withHeatmap(heatmap: unknown[]) {
    const ctx = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    ctx.pollSvc.getHeatmap.mockResolvedValue(heatmap);
    // Un changement de mois relit la plage : c'est le chemin de rechargement déjà en place.
    await (ctx.fixture.componentInstance as any).onMonthDateChange(new Date(Date.UTC(2026, 8, 1)));
    await tick(ctx.fixture);
    return ctx;
  }

  it('porte une charge utile STRUCTURÉE sur les entrées de la couche, pas seulement du texte', async () => {
    const { fixture } = await withHeatmap(HEATMAP);
    const comp = fixture.componentInstance as any;

    const morning = comp
      .calendarEntries()
      .find((e: any) => e.type === 'disponibilite-groupe' && e.slot === 'MORNING');
    expect(morning.group).toEqual({
      available: 2,
      unavailable: 1,
      unknown: 1,
      total: 4,
      members: null,
    });
  });

  it('reporte les identités servies au MJ, et `null` quand le serveur n’en sert aucune (AC3/AC4)', async () => {
    const members = [
      { userId: 'mj1', pseudo: 'mj', displayName: 'Le MJ', status: 'AVAILABLE' },
      { userId: 'u1', pseudo: 'alice', displayName: 'Alice', status: 'UNAVAILABLE' },
    ];
    const { fixture } = await withHeatmap([{ ...HEATMAP[0], members }]);
    const comp = fixture.componentInstance as any;

    const entry = comp.calendarEntries().find((e: any) => e.type === 'disponibilite-groupe');
    // Reporté TEL QUEL : l'ordre vient du serveur et n'est jamais retrié côté front — c'est lui
    // qui fait que la position identifie la personne (AC4).
    expect(entry.group.members).toEqual(members);
  });

  it('🚨 le créneau où PERSONNE ne s’est prononcé atteint la GRILLE (AC6)', async () => {
    const { fixture } = await withHeatmap(HEATMAP);
    const comp = fixture.componentInstance as any;

    const evening = comp
      .calendarEntries()
      .find((e: any) => e.type === 'disponibilite-groupe' && e.slot === 'EVENING');
    expect(evening).toBeDefined();
    expect(evening.group).toEqual({
      available: 0,
      unavailable: 0,
      unknown: 4,
      total: 4,
      members: null,
    });
  });

  it('…mais PAS la liste Agenda : le filtre est à l’affichage, jamais à la source', async () => {
    const { fixture } = await withHeatmap(HEATMAP);
    const comp = fixture.componentInstance as any;

    const slots = comp
      .agendaEntries()
      .filter((e: any) => e.type === 'disponibilite-groupe')
      .map((e: any) => e.slot);
    expect(slots).toEqual(['MORNING']);
  });

  it('la couche éteinte retire la lecture longue de l’Agenda sans toucher à la grille (AC10)', async () => {
    const { fixture } = await withHeatmap(HEATMAP);
    const comp = fixture.componentInstance as any;

    comp.toggleLayer('disponibilite-groupe');
    fixture.detectChanges();

    expect(comp.agendaEntries().some((e: any) => e.type === 'disponibilite-groupe')).toBe(false);
    // Les entrées restent transmises à la grille — c'est `buildDayDetail()` qui les ignore quand
    // la couche est éteinte, exactement comme pour `mes-seances` (FR-50).
    expect(comp.calendarEntries().some((e: any) => e.type === 'disponibilite-groupe')).toBe(true);
    expect(comp.railDetail().slots.every((s: any) => s.group === null)).toBe(true);
  });

  it('le rail expose le canal SOUS une séance et sous un vote (AC2)', async () => {
    const { fixture } = await withHeatmap(HEATMAP);
    const comp = fixture.componentInstance as any;

    comp.onSlotSelected({ date: new Date(2026, 8, 1), slot: 'MORNING' });
    fixture.detectChanges();

    const morning = comp.railDetail().slots.find((s: any) => s.slot === 'MORNING');
    expect(morning.group).not.toBeNull();
  });

  it('AC13 — naviguer de semaine RECHARGE la plage en contexte de partie', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    const before = pollSvc.getHeatmap.mock.calls.length;

    await comp.onWeekDateChange(new Date(Date.UTC(2026, 9, 12)));
    await tick(fixture);

    expect(pollSvc.getHeatmap.mock.calls.length).toBe(before + 1);
    // La plage est celle de la grille du mois de `d`, jamais une seconde plage inventée : elle
    // couvre la semaine demandée et reste sous le plafond serveur de 45 jours.
    const [, from, to] = pollSvc.getHeatmap.mock.calls.at(-1)!;
    expect(from <= '2026-10-12').toBe(true);
    expect(to >= '2026-10-18').toBe(true);
  });

  it('AC8 — la couche reste ABSENTE du calendrier personnel, et rien ne l’y appelle', async () => {
    const { fixture, pollSvc } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;

    expect(comp.activeLayers()).not.toContain('disponibilite-groupe');
    expect(comp.availableLayerKeys()).not.toContain('disponibilite-groupe');
    expect(comp.calendarEntries().some((e: any) => e.type === 'disponibilite-groupe')).toBe(false);
    expect(pollSvc.getHeatmap).not.toHaveBeenCalled();

    await comp.onWeekDateChange(new Date(Date.UTC(2026, 9, 12)));
    await tick(fixture);
    expect(pollSvc.getHeatmap).not.toHaveBeenCalled();
  });
});

// ─── Le mode Destinée (Story 36.9) ────────────────────────────────────────────────────────────

/** Un SECOND vote ouvert, sur un autre scénario et une autre date — indispensable pour prouver
 *  que l'estompe suit le vote COURANT et non « un vote quelconque » (AC1), et que la navigation
 *  entre votes existe (AC2). */
const SECOND_POLL_SCENARIO = {
  ...ACTIVE_POLL_SCENARIO,
  id: 's2',
  title: 'Chapitre 2',
  seances: [
    {
      ...ACTIVE_POLL_SCENARIO.seances[0],
      id: 'seance2',
      scenarioId: 's2',
      poll: {
        ...ACTIVE_POLL_SCENARIO.seances[0].poll,
        id: 'poll2',
        membersCount: 4,
        options: [{ id: 'p2o1', date: '2026-09-04T00:00:00.000Z', slot: 'EVENING', votes: [] }],
      },
    },
  ],
};

describe('CalendarView — le mode Destinée (Story 36.9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  it('AC10 — aucun vote ouvert : aucune Destinée proposée, ni en état ni dans le DOM', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;

    expect(comp.destinyPolls()).toHaveLength(0);
    expect(comp.destinyPoll()).toBeNull();
    expect(comp.destinyDates()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-destiny-control button')).toBeNull();
  });

  it('AC2 — les votes ouverts sont listés et NOMMÉS, dans l’ordre', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO, SECOND_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.destinyPolls().map((p: any) => p.pollId)).toEqual(['poll1', 'poll2']);
    expect(comp.destinyPolls().map((p: any) => p.label)).toEqual(['Chapitre 1', 'Chapitre 2']);
  });

  it('AC1/AC12 — le mode retient les dates du vote COURANT, et d’aucun autre', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO, SECOND_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    comp.enterDestiny('poll1');
    fixture.detectChanges();
    expect([...comp.destinyDates()].sort()).toEqual(['2026-08-28', '2026-08-29']);

    // Story 44.4 — on change de vote par la liste (les chevrons parcourent les créneaux du vote actif).
    comp.enterDestiny('poll2');
    fixture.detectChanges();
    expect(comp.destinyPoll().pollId).toBe('poll2');
    expect([...comp.destinyDates()]).toEqual(['2026-09-04']);
  });

  it('AC6 — activer le mode ALLUME « votes-en-cours » si elle est éteinte, et le quitter ne la rééteint pas', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    comp.toggleLayer('votes-en-cours');
    expect(comp.activeLayers()).not.toContain('votes-en-cours');

    comp.enterDestiny('poll1');
    fixture.detectChanges();

    expect(comp.activeLayers()).toContain('votes-en-cours');
    // 🚨 Le test qui échoue sur une implémentation fondée sur `band.vote` / `pollVote` : ceux-là
    // sont gouvernés par la couche, donc l'ensemble serait vide au moment de l'activation.
    expect(comp.destinyDates()!.size).toBe(2);

    comp.exitDestiny();
    fixture.detectChanges();
    expect(comp.activeLayers()).toContain('votes-en-cours');
  });

  it('AC9 — le vote courant disparaît (temps réel) : le mode se termine, il ne bascule pas en silence', async () => {
    const { fixture, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO, SECOND_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    comp.enterDestiny('poll1');
    fixture.detectChanges();
    expect(comp.destinyPoll().pollId).toBe('poll1');

    // Le premier vote est scellé par quelqu'un d'autre : il n'est plus OPEN.
    scenariosSvc.listAll.mockResolvedValue(withOrganizerDefaults([SECOND_POLL_SCENARIO]));
    scenariosSvc.changed.set({ partieId: '*' });
    await tick(fixture);

    expect(comp.destinyPollId()).toBeNull();
    expect(comp.destinyPoll()).toBeNull();
    expect(comp.destinyDates()).toBeNull();
    // `poll2` est toujours ouvert : la Destinée reste PROPOSABLE, elle n'est plus active.
    expect(comp.destinyPolls()).toHaveLength(1);
  });

  it('AC9 — un vote TIERS qui disparaît ne touche pas au mode en cours', async () => {
    const { fixture, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO, SECOND_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;

    comp.enterDestiny('poll1');
    scenariosSvc.listAll.mockResolvedValue(withOrganizerDefaults([TWO_OPTION_POLL_SCENARIO]));
    scenariosSvc.changed.set({ partieId: '*' });
    await tick(fixture);

    expect(comp.destinyPoll().pollId).toBe('poll1');
    expect([...comp.destinyDates()].sort()).toEqual(['2026-08-28', '2026-08-29']);
  });

  it('AC5 — le contrôle est rendu HORS du panneau des couches, et dit son état sans rien ouvrir', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    const root = fixture.nativeElement as HTMLElement;

    const control = root.querySelector('app-destiny-control');
    expect(control).toBeTruthy();
    // AC5 : jamais une chip de plus à l'intérieur de la bande de couches.
    expect(root.querySelector('app-calendar-layer-toggle app-destiny-control')).toBeNull();
    // Story 44.3 — la puce ouvre une liste : `aria-expanded` dit l'état de la LISTE, le mode se lit dans le texte.
    const chip = control!.querySelector('button')!;
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.classList).not.toContain('destiny__chip--active');

    comp.enterDestiny('poll1');
    fixture.detectChanges();
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.classList).toContain('destiny__chip--active');
    expect(control!.textContent).toContain('Chapitre 1');
  });


  it('AC1 — le calendrier personnel connaît aussi ses votes ouverts, à travers plusieurs parties', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [
        openPollEntry({
          pollId: 'poll-a',
          partieId: 'partie-A',
          partieName: 'Les Cendres',
          eligibleCount: 3,
          options: [
            {
              optionId: 'oa',
              date: '2026-08-28',
              slot: 'EVENING',
              yes: 1,
              maybe: 0,
              no: 0,
              myAnswer: null,
            },
          ],
        }),
      ],
    });
    const comp = fixture.componentInstance as any;

    expect(comp.destinyPolls()).toEqual([{ pollId: 'poll-a', label: 'Les Cendres' }]);
    comp.enterDestiny('poll-a');
    fixture.detectChanges();
    expect([...comp.destinyDates()]).toEqual(['2026-08-28']);
  });

  // 🚨 Défaut trouvé à la VÉRIFICATION VISUELLE : en calendrier personnel, `GET /me/calendar` est
  // chargé PAR PLAGE. Naviguer d'une semaine recharge une plage qui peut ne plus couvrir les
  // créneaux du vote — et l'effet de fin de mode (AC9) tuait alors le mode DÉFINITIVEMENT, alors
  // que le vote existait toujours. « Absent des données chargées » ≠ « clos ».
  // Story 44.2 — la liste des votes n'est plus chargée PAR PLAGE : naviguer d'une semaine à l'autre ne
  // retire jamais un vote ouvert de la liste, le mode survit donc à tout changement de plage.
  it('AC9 — contexte personnel : changer de plage ne touche pas au vote, le mode survit', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [
        openPollEntry({
          pollId: 'poll-a',
          partieId: 'partie-A',
          partieName: 'Les Cendres',
          eligibleCount: 3,
          options: [
            {
              optionId: 'oa',
              date: '2026-08-28',
              slot: 'EVENING',
              yes: 1,
              maybe: 0,
              no: 0,
              myAnswer: null,
            },
          ],
        }),
      ],
    });
    const comp = fixture.componentInstance as any;
    comp.enterDestiny('poll-a');
    await tick(fixture);
    expect(comp.destinyPoll()).not.toBeNull();

    await comp.onWeekDateChange(new Date(Date.UTC(2026, 10, 2)));
    await tick(fixture);
    expect(comp.destinyPollId()).toBe('poll-a');

    await comp.onWeekDateChange(new Date(Date.UTC(2026, 7, 24)));
    await tick(fixture);
    expect(comp.destinyPoll()!.pollId).toBe('poll-a');
    expect([...comp.destinyDates()]).toEqual(['2026-08-28']);
  });

  // Revue de code (36.9) — pendant de la précédente : la garde qui protège la navigation ne doit
  // PAS désactiver AC9 entièrement en contexte personnel. Ici la plage rechargée est EXACTEMENT
  // la même (le vote était pleinement dans la plage la fois précédente) et le vote a disparu
  // « pour de vrai » : le mode doit se terminer, comme en contexte de partie.
  it('AC9 — contexte personnel : le vote disparaît de la liste servie ⇒ le mode se termine', async () => {
    const { fixture, openPollsSvc } = await createCalendarView({
      mode: 'personal',
      openPolls: [
        openPollEntry({
          pollId: 'poll-a',
          partieId: 'partie-A',
          partieName: 'Les Cendres',
          eligibleCount: 3,
          options: [
            {
              optionId: 'oa',
              date: '2026-08-28',
              slot: 'EVENING',
              yes: 1,
              maybe: 0,
              no: 0,
              myAnswer: null,
            },
          ],
        }),
      ],
    });
    const comp = fixture.componentInstance as any;
    comp.enterDestiny('poll-a');
    await tick(fixture);
    expect(comp.destinyPoll()!.pollId).toBe('poll-a');

    // Le serveur ne sert plus ce vote (date fixée, annulé, supprimé…) : l'absence fait autorité.
    openPollsSvc.entries.set([]);
    await tick(fixture);

    expect(comp.destinyPollId()).toBeNull();
    expect(comp.destinyPoll()).toBeNull();
    expect(comp.destinyDates()).toBeNull();
  });

  it('AC4 — le panneau du calendrier est RÉDUIT : des personnes, plus aucune liste de créneaux', async () => {
    const { fixture, partiesSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    void partiesSvc;
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-poll-missing')).toBeTruthy();
    // 🚨 Le panneau complet a quitté le calendrier — il reste sur la fiche de scénario.
    expect(root.querySelector('app-poll-status')).toBeNull();
    expect(root.querySelector('.poll-status__options')).toBeNull();
    // …et avec lui le seul bouton de scellement de cet écran.
    const buttons = [...root.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(buttons.some((t) => t.includes('Sceller ce créneau'))).toBe(false);
    // « Brûler le parchemin de vote » reste, lui : il n'est pas dans le périmètre de l'AC4.
    expect(buttons.some((t) => t.includes('Brûler le parchemin'))).toBe(true);
  });

  it('AC3 — aucun appel réseau ne part de l’entrée, de la navigation ou de la sortie du mode', async () => {
    const { fixture, pollSvc, scenariosSvc, availabilitySvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO, SECOND_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    const before = [
      pollSvc.getAvailableSlots.mock.calls.length,
      pollSvc.getHeatmap.mock.calls.length,
      scenariosSvc.listAll.mock.calls.length,
      availabilitySvc.getMyCalendar.mock.calls.length,
    ];

    comp.enterDestiny('poll1');
    comp.destinyNext();
    comp.destinyPrev();
    comp.exitDestiny();
    await tick(fixture);

    expect([
      pollSvc.getAvailableSlots.mock.calls.length,
      pollSvc.getHeatmap.mock.calls.length,
      scenariosSvc.listAll.mock.calls.length,
      availabilitySvc.getMyCalendar.mock.calls.length,
    ]).toEqual(before);
  });
});

// ─── Story 44.3 — choisir la destinée active dans une liste ───────────────────

describe('CalendarView — la liste des destinées (Story 44.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  /** Une option dans le futur lointain : « à venir » quelle que soit la date d'exécution. */
  const opt = (optionId: string, date: string, yes = 0, maybe = 0) => ({
    optionId,
    date,
    slot: 'EVENING' as const,
    yes,
    maybe,
    no: 0,
    myAnswer: null,
  });

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  const POLLS = [
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-A',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2020-01-01T00:00:00.000Z',
      can: ORGANIZER,
      options: [opt('a1', '2030-03-04', 0, 1), opt('a2', '2030-03-06', 3, 0), opt('a3', '2030-03-08', 3, 2)],
    }),
    openPollEntry({
      pollId: 'poll-b',
      partieId: 'partie-B',
      partieName: 'La Bande',
      family: 'ralliement',
      kind: 'ONE_SHOT',
      title: 'Soirée jeux',
      expiresAt: '2099-01-01T00:00:00.000Z',
      me: { eligible: true, answered: false },
      options: [opt('b1', '2030-06-14'), opt('b2', '2030-06-15')],
    }),
    openPollEntry({
      pollId: 'poll-c',
      partieId: 'partie-B',
      partieName: 'La Bande',
      family: 'ralliement',
      kind: 'ONE_SHOT',
      title: 'Brunch',
      expiresAt: null,
      me: { eligible: false, answered: false },
      options: [opt('c1', '2030-07-01')],
    }),
    openPollEntry({
      pollId: 'poll-d',
      partieId: 'partie-C',
      partieName: 'Les Héritiers',
      title: 'Séance 2',
      expiresAt: '2099-01-01T00:00:00.000Z',
      me: { eligible: true, answered: true },
      options: [opt('d1', '2030-09-02')],
    }),
  ];

  const list = () => document.querySelector('app-destiny-list') as HTMLElement | null;

  it('la puce ouvre la liste au lieu de basculer le mode : fond fermé par défaut, aria-expanded à jour', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;
    const chip = fixture.nativeElement.querySelector('app-destiny-control button') as HTMLButtonElement;

    expect(list()).toBeNull();
    chip.click();
    await tick(fixture);

    expect(list()).not.toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(comp.destinyPollId()).toBeNull();
  });

  it('les lignes sont groupées par NOM de partie, avec échéance, nombre de créneaux et pastille d’état', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    (fixture.componentInstance as any).toggleDestinyList();
    await tick(fixture);

    const groups = Array.from(list()!.querySelectorAll('.destiny-list__group')).map((g) => ({
      name: g.querySelector('h3')!.textContent!.trim(),
      rows: Array.from(g.querySelectorAll('.destiny-list__row')).map((r) => [
        r.querySelector('.destiny-list__name')!.textContent!.trim(),
        r.querySelector('.destiny-list__meta')!.textContent!.trim(),
        r.querySelector('.destiny-list__pill')!.textContent!.trim(),
      ]),
    }));

    expect(groups.map((g) => g.name)).toEqual(['Les Cendres', 'La Bande', 'Les Héritiers']);
    expect(groups[0].rows).toEqual([['Chapitre 4', 'Vote terminé · 3 créneaux', 'Organisateur']]);
    expect(groups[1].rows[0][0]).toBe('Soirée jeux');
    expect(groups[1].rows[0][1]).toMatch(/^Fin du vote .+ · 2 créneaux$/);
    expect(groups[1].rows[0][2]).toBe('À faire');
    // Sans échéance et un seul créneau : le singulier, et « Vous ne votez pas ».
    expect(groups[1].rows[1][0]).toBe('Brunch');
    expect(groups[1].rows[1][1]).toContain('1 créneau');
    expect(groups[1].rows[1][1]).not.toContain('créneaux');
    expect(groups[1].rows[1][2]).toBe('Vous ne votez pas');
    expect(groups[2].rows[0][2]).toBe('Répondu');
  });

  it('Échap ferme la liste sans rien changer et rend le focus à la puce', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;
    const chip = fixture.nativeElement.querySelector('app-destiny-control button') as HTMLButtonElement;

    comp.toggleDestinyList();
    await tick(fixture);
    list()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick(fixture);

    expect(list()).toBeNull();
    expect(comp.destinyPollId()).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('le fond assombri ferme la liste sans rien changer', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;

    comp.toggleDestinyList();
    await tick(fixture);
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await tick(fixture);

    expect(list()).toBeNull();
    expect(comp.destinyPollId()).toBeNull();
  });

  it('sous 1024 px la liste est un tiroir modal avec son fond', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: POLLS,
      desktop: false,
    });
    (fixture.componentInstance as any).toggleDestinyList();
    await tick(fixture);

    const sheet = fixture.nativeElement.querySelector('.display-surface--sheet') as HTMLElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.querySelector('app-destiny-list')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.display-backdrop')).not.toBeNull();
  });

  it('choisir une ligne active la Destinée sur ce pollId, en vue Mois même depuis l’Agenda, sur le premier créneau à venir', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: POLLS,
      desktop: false, // l'Agenda est la vue par défaut sur mobile
    });
    const comp = fixture.componentInstance as any;
    expect(comp.view()).toBe('agenda');
    comp.toggleDestinyList();
    await tick(fixture);

    comp.chooseDestiny('poll-d');
    await tick(fixture);

    expect(comp.destinyPollId()).toBe('poll-d');
    expect(comp.view()).toBe('month');
    expect(comp.destinyOptionId()).toBe('d1');
    expect(comp.sharedDate().toISOString().substring(0, 7)).toBe('2030-09');
    expect(comp.destinyListOpen()).toBe(false);
  });

  it('un vote du mode soirée s’ouvre en vue Semaine, sur son créneau d’entrée', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;
    expect(comp.view()).toBe('month');

    comp.chooseDestiny('poll-b');
    await tick(fixture);

    expect(comp.view()).toBe('week');
    expect(comp.destinyOptionId()).toBe('b1');
    expect(comp.sharedDate().toISOString().substring(0, 10)).toBe('2030-06-14');
  });

  it('un vote du mode soirée choisi depuis l’Agenda (téléphone) affiche la vue Semaine sur son créneau', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: POLLS,
      desktop: false,
    });
    const comp = fixture.componentInstance as any;
    expect(comp.view()).toBe('agenda');

    comp.chooseDestiny('poll-b');
    await tick(fixture);

    expect(comp.view()).toBe('week');
    expect(comp.destinyOptionId()).toBe('b1');
    expect(fixture.nativeElement.querySelector('app-calendar-week-view')).not.toBeNull();
  });

  it('après la fin du vote, la Destinée s’ouvre sur le meilleur créneau (le plus de oui, puis de peut-être)', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;

    comp.chooseDestiny('poll-a');
    await tick(fixture);

    expect(comp.destinyOptionId()).toBe('a3');
    expect(comp.view()).toBe('month');
  });

  it('un vote d’un autre mois : la vue Mois suit, la plage affichée est rechargée', async () => {
    const { fixture, availabilitySvc } = await createCalendarView({
      mode: 'personal',
      openPolls: POLLS,
    });
    const comp = fixture.componentInstance as any;
    const before = availabilitySvc.getMyCalendar.mock.calls.length;

    comp.chooseDestiny('poll-d');
    await tick(fixture);

    expect(availabilitySvc.getMyCalendar.mock.calls.length).toBeGreaterThan(before);
    const month = fixture.nativeElement.querySelector('app-calendar-month-view');
    expect(month.textContent).toMatch(/septembre\s+2030/i);
  });

  it('la destinée active est en tête avec « Quitter la Destinée », et n’est pas répétée dans les groupes', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: POLLS });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-d');
    await tick(fixture);

    comp.toggleDestinyList();
    await tick(fixture);

    expect(list()!.querySelector('.destiny-list__head')!.textContent).toContain('Séance 2');
    expect(list()!.querySelector('.destiny-list__quit')!.textContent!.trim()).toBe(
      'Quitter la Destinée',
    );
    const rows = Array.from(list()!.querySelectorAll('.destiny-list__row')).map((r) => r.textContent);
    expect(rows.some((t) => t!.includes('Séance 2'))).toBe(false);

    (list()!.querySelector('.destiny-list__quit') as HTMLButtonElement).click();
    await tick(fixture);

    expect(comp.destinyPollId()).toBeNull();
    expect(comp.destinyOptionId()).toBeNull();
    expect(list()).toBeNull();
  });

  it('à l’atelier, la liste ne montre que les votes de CETTE partie', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [
        openPollEntry({
          pollId: 'poll1',
          partieId: 'partie-1',
          partieName: 'Ma partie',
          title: 'Chapitre 1',
          options: [opt('x1', '2030-01-10'), opt('x2', '2030-01-11')],
        }),
        // Un vote d'une AUTRE partie : servi par /me/open-polls, mais absent de l'atelier.
        ...POLLS,
      ],
    });
    (fixture.componentInstance as any).toggleDestinyList();
    await tick(fixture);

    const names = Array.from(list()!.querySelectorAll('.destiny-list__row .destiny-list__name')).map(
      (n) => n.textContent!.trim(),
    );
    expect(names).toEqual(['Chapitre 1']);
  });

  it('sans vote ouvert, la puce est absente et la liste ne s’ouvre pas', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [] });
    const comp = fixture.componentInstance as any;

    expect(fixture.nativeElement.querySelector('app-destiny-control button')).toBeNull();
    comp.toggleDestinyList();
    await tick(fixture);
    expect(list()).toBeNull();
  });
});

// ─── Story 36.10 — composer un vote depuis la grille (FR-52, D-16) ───────────

describe('CalendarView — mode de composition (Story 36.10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Une séance dont le vote OUVERT porte deux options, dont une déjà votée. C'est le jeu qui
   *  rend observables l'AC13 (l'état de départ), l'AC6 (l'avertissement chiffré) et l'AC5. */
  const POLL_WITH_OPTIONS = {
    ...ACTIVE_POLL_SCENARIO,
    seances: [
      {
        ...ACTIVE_POLL_SCENARIO.seances[0],
        poll: {
          ...ACTIVE_POLL_SCENARIO.seances[0].poll,
          options: [
            {
              id: 'optA',
              date: '2026-08-01T00:00:00.000Z',
              slot: 'EVENING',
              votes: [{ userId: 'u1', pseudo: 'Léa', displayName: 'Léa', answer: 'YES' }],
            },
            { id: 'optB', date: '2026-08-02T00:00:00.000Z', slot: 'MORNING', votes: [] },
          ],
        },
      },
    ],
  };

  const FREE_SEANCE_SCENARIO = {
    ...ACTIVE_POLL_SCENARIO,
    seances: [
      {
        id: 'seanceX',
        scenarioId: 's1',
        compteRendu: null,
        createdAt: '2026-07-13T00:00:00.000Z',
        can: { propose: true, edit: true, choose: true, extend: false },
      },
    ],
  };

  function cell(iso: string, slot: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return { date: new Date(y, m - 1, d), slot };
  }

  // ── AC10 : le mode n'existe qu'en contexte de partie, côté MJ ──

  it('AC10 — aucun point d’entrée de composition en contexte personnel', async () => {
    const { fixture } = await createCalendarView({ scenarios: [FREE_SEANCE_SCENARIO] });
    const comp = fixture.componentInstance as any;
    expect(comp.canCompose()).toBe(false);
    expect(fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
  });

  it('AC10 — aucun point d’entrée pour un membre non-MJ, même sur une partie', async () => {
    const noRight = {
      ...FREE_SEANCE_SCENARIO,
      seances: [
        {
          ...FREE_SEANCE_SCENARIO.seances[0],
          can: { propose: false, edit: false, choose: false, extend: false },
        },
      ],
    };
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [noRight],
    });
    const comp = fixture.componentInstance as any;
    expect(comp.canCompose()).toBe(false);
    expect(fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
  });

  it('AC10 — la garde est STRUCTURELLE : startCompose() refuse même appelé de force', async () => {
    const { fixture } = await createCalendarView({ scenarios: [FREE_SEANCE_SCENARIO] });
    const comp = fixture.componentInstance as any;
    comp.startCompose();
    expect(comp.composing()).toBe(false);
    expect(comp.composeTarget()).toBeNull();
  });

  it('AC1/AC10 — MJ sur une partie avec une séance à dater : le bouton « Proposer des dates » est rendu', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const btn = fixture.nativeElement.querySelector('.compose-arm');
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toBe(GRIMOIRE_TONE['calendar.view_propose_dates']);
  });

  // ── AC13 : la composition part de l'état réel du vote ──

  it('AC13 — armée sur un vote mis en avant, la composition contient DÉJÀ ses options', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();

    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll1' });
    expect([...comp.composedKeys()].sort()).toEqual(['2026-08-01|EVENING', '2026-08-02|MORNING']);
  });

  it('AC4 — armée sur un rendez-vous sans vote, la composition vise un vote NEUF et part vide', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.startCompose('seanceX');

    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'seanceX' });
    expect(comp.composedCells()).toEqual([]);
  });

  // ── AC2 : le tap ajoute ou retire, sans rien écrire ──

  it('AC2 — deux bascules sur le même créneau reviennent à l’état de départ, et RIEN n’est écrit', async () => {
    const { fixture, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.startCompose('seanceX');

    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
    expect(comp.composedCells()).toHaveLength(1);
    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
    expect(comp.composedCells()).toHaveLength(0);

    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
    expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
  });

  it('AC2 — hors mode, une bascule est sans effet (aucun état fantôme)', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
    expect(comp.composedCells()).toEqual([]);
  });

  // ── AC3 : Échap et Annuler ne modifient rien ──

  it('AC3 — annuler quitte le mode sans aucun appel d’écriture', async () => {
    const { fixture, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));

    comp.cancelCompose();

    expect(comp.composing()).toBe(false);
    expect(comp.composedCells()).toEqual([]);
    expect(comp.composedKeys()).toBeNull();
    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
    expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
  });

  // ── AC14 côté client : les bornes, et la raison affichée ──

  it('AC14 — moins de deux créneaux : validation impossible, et la raison est DITE', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.startCompose('seanceX');
    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
    fixture.detectChanges();

    expect(comp.composeCanConfirm()).toBe(false);
    expect(comp.composeBlockedReason()).toContain('au moins deux');
    expect(fixture.nativeElement.querySelector('.compose-bar__blocked')).not.toBeNull();
  });

  // ── AC5 / AC6 / AC7 : la validation d'un vote existant ──

  it('AC5 — un simple AJOUT ne demande aucune confirmation et écrit le jeu COMPLET', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    comp.onComposeToggled(cell('2026-08-03', 'EVENING'));

    await comp.confirmCompose();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(pollSvc.setPollOptions).toHaveBeenCalledWith('partie-1', 'poll1', {
      options: [
        { date: '2026-08-01', slot: 'EVENING' },
        { date: '2026-08-02', slot: 'MORNING' },
        { date: '2026-08-03', slot: 'EVENING' },
      ],
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('AC6 — retirer une option VOTÉE ouvre l’avertissement AVANT l’appel, en nommant le nombre de réponses', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    // optA porte une réponse ; on la retire et on ajoute un créneau pour rester dans les bornes.
    comp.onComposeToggled(cell('2026-08-01', 'EVENING'));
    comp.onComposeToggled(cell('2026-08-03', 'EVENING'));

    await comp.confirmCompose();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const data = dialog.open.mock.calls[0][1]!.data;
    expect(data).not.toHaveProperty('mode');
    expect(data).not.toHaveProperty('seances');
    expect(data.removedCount).toBe(1);
    expect(data.voterCount).toBe(1);
    // 🚨 Le dialogue est ANNULÉ par défaut dans ce harnais : rien ne doit être écrit.
    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
  });

  it('AC6 — renoncer laisse la composition INTACTE : le MJ n’a rien à redésigner', async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    comp.onComposeToggled(cell('2026-08-01', 'EVENING'));
    comp.onComposeToggled(cell('2026-08-03', 'EVENING'));

    await comp.confirmCompose();

    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
    expect(comp.composing()).toBe(true);
    expect([...comp.composedKeys()].sort()).toEqual(['2026-08-02|MORNING', '2026-08-03|EVENING']);
  });

  it('AC7 — retrait CONFIRMÉ : le jeu écrit ne contient plus l’option retirée, et contient les autres', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    dialog.__result = true;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    comp.onComposeToggled(cell('2026-08-01', 'EVENING'));
    comp.onComposeToggled(cell('2026-08-03', 'EVENING'));

    await comp.confirmCompose();

    expect(pollSvc.setPollOptions).toHaveBeenCalledWith('partie-1', 'poll1', {
      options: [
        { date: '2026-08-02', slot: 'MORNING' },
        { date: '2026-08-03', slot: 'EVENING' },
      ],
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(comp.composing()).toBe(false);
  });

  // ── AC4 / AC11 : la création passe TOUJOURS par une séance ──

  it('AC4/AC11 — créer appelle createSeancePoll() sur la séance choisie AVANT, JAMAIS setPollOptions()', async () => {
    const { fixture, pollSvc, scenariosSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.startCompose('seanceX');
    comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
    comp.onComposeToggled(cell('2026-09-05', 'MORNING'));

    await comp.confirmCompose();

    // ⚠️ Story 45.2 — le rendez-vous est choisi avant : créer n'ouvre AUCUN dialogue.
    expect(dialog.open).not.toHaveBeenCalled();
    expect(scenariosSvc.createSeancePoll).toHaveBeenCalledWith(
      'seanceX',
      [
        { date: '2026-09-04', slot: 'EVENING' },
        { date: '2026-09-05', slot: 'MORNING' },
      ],
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      undefined,
    );
    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
  });

  // ── Robustesse : le mode doit savoir mourir, sans écrire ──

  it('le vote visé disparaît (scellé ou clos ailleurs) → la composition s’annule sans rien écrire', async () => {
    const { fixture, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    expect(comp.composing()).toBe(true);

    comp.scenarios.set([]); // le vote n'est plus ouvert
    fixture.detectChanges();

    expect(comp.composing()).toBe(false);
    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
    expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
  });

  it('une erreur d’écriture NE FERME PAS le mode — la composition n’est pas perdue', async () => {
    const { fixture, pollSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [POLL_WITH_OPTIONS],
    });
    const comp = fixture.componentInstance as any;
    pollSvc.setPollOptions.mockRejectedValueOnce(new Error('boom'));
    comp.destinyPollId.set('poll1');
    comp.startCompose();
    comp.onComposeToggled(cell('2026-08-03', 'EVENING'));

    await comp.confirmCompose();

    expect(comp.composing()).toBe(true);
    expect(comp.composedCells()).toHaveLength(3);
    expect(comp.error()).toBe(GRIMOIRE_TONE['calendar.view_compose_save_error']);
  });

  // ── AC1 : la barre persistante ──

  it('AC1 — la barre est rendue tant que le mode dure, MÊME à zéro créneau composé', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [FREE_SEANCE_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    comp.startCompose('seanceX');
    fixture.detectChanges();

    expect(comp.composedCells()).toEqual([]);
    expect(fixture.nativeElement.querySelector('app-compose-bar')).not.toBeNull();
    // Et l'armement disparaît : deux entrées simultanées dans le même mode seraient un piège.
    expect(fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
  });

  // ══ ⚠️ Story 47.4 — proposer des plages : la durée dans le composer ══════════════════════════════
  describe('la durée dans le composer (Story 47.4)', () => {
    /** Un vote de 3 créneaux : optA porte 3 réponses, optB une — 4 en tout. */
    const SPAN_POLL = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          ...ACTIVE_POLL_SCENARIO.seances[0],
          durationSlots: 3,
          poll: {
            ...ACTIVE_POLL_SCENARIO.seances[0].poll,
            durationSlots: 3,
            options: [
              {
                id: 'optA',
                date: '2026-08-01T00:00:00.000Z',
                slot: 'EVENING',
                votes: [
                  { userId: 'u1', pseudo: 'Léa', displayName: 'Léa', answer: 'YES' },
                  { userId: 'u2', pseudo: 'Max', displayName: 'Max', answer: 'NO' },
                  { userId: 'u3', pseudo: 'Zoé', displayName: 'Zoé', answer: 'MAYBE' },
                ],
              },
              {
                id: 'optB',
                date: '2026-08-08T00:00:00.000Z',
                slot: 'EVENING',
                votes: [{ userId: 'u1', pseudo: 'Léa', displayName: 'Léa', answer: 'YES' }],
              },
            ],
          },
        },
      ],
    };

    async function armOnSpanPoll() {
      const view = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [SPAN_POLL],
      });
      const comp = view.fixture.componentInstance as any;
      comp.destinyPollId.set('poll1');
      comp.startCompose();
      return { ...view, comp };
    }

    it('la ligne « Durée » part TOUJOURS de la durée du rendez-vous visé', async () => {
      const { comp, fixture } = await armOnSpanPoll();
      fixture.detectChanges();

      expect(comp.composeDuration()).toBe(3);
      expect(
        fixture.nativeElement.querySelector('app-compose-bar .ds__value')?.textContent?.trim(),
      ).toBe('3 créneaux');
    });

    it('une cible d’un créneau : durée 1, aucun aperçu, « Journée » reste permise', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onComposeToggled(cell('2026-09-04', 'EVENING'));

      expect(comp.composeDuration()).toBe(1);
      expect([...comp.composeCoverKeys()]).toEqual([]);
      expect(comp.composeAllowsFullDay()).toBe(true);
    });

    it('durée gardée : le PUT n’emporte pas `durationSlots`, aucun dialogue pour un simple ajout', async () => {
      const { comp, pollSvc, dialog } = await armOnSpanPoll();
      comp.onComposeToggled(cell('2026-08-15', 'EVENING'));

      await comp.confirmCompose();

      expect(dialog.open).not.toHaveBeenCalled();
      expect(pollSvc.setPollOptions).toHaveBeenCalledWith('partie-1', 'poll1', {
        options: [
          { date: '2026-08-01', slot: 'EVENING' },
          { date: '2026-08-08', slot: 'EVENING' },
          { date: '2026-08-15', slot: 'EVENING' },
        ],
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });

    it('durée changée, 4 réponses : l’avertissement les compte TOUTES, puis la durée part avec les options', async () => {
      const { comp, pollSvc, dialog } = await armOnSpanPoll();
      dialog.__result = true;
      comp.onComposeDurationChanged(6);

      await comp.confirmCompose();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(dialog.open.mock.calls[0][1]!.data).toMatchObject({
        voterCount: 4,
        removedCount: 0,
        durationChanged: true,
      });
      expect(pollSvc.setPollOptions).toHaveBeenCalledWith('partie-1', 'poll1', {
        options: [
          { date: '2026-08-01', slot: 'EVENING' },
          { date: '2026-08-08', slot: 'EVENING' },
        ],
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        durationSlots: 6,
      });
    });

    it('une réponse arrive pendant l’avertissement : la revérification refuse, rien n’est écrit', async () => {
      const { comp, pollSvc, dialog } = await armOnSpanPoll();
      comp.onComposeDurationChanged(6);
      dialog.open.mockImplementationOnce((component: unknown, config?: { data?: any }) => {
        const seance = SPAN_POLL.seances[0];
        comp.scenarios.set([
          {
            ...SPAN_POLL,
            seances: [
              {
                ...seance,
                poll: {
                  ...seance.poll,
                  options: [
                    seance.poll.options[0],
                    {
                      ...seance.poll.options[1],
                      votes: [
                        ...seance.poll.options[1].votes,
                        { userId: 'u4', pseudo: 'Sam', displayName: 'Sam', answer: 'YES' },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ]);
        return { component, config, afterClosed: () => of(true) } as any;
      });

      await comp.confirmCompose();

      expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
      expect(comp.error()).toBe(GRIMOIRE_TONE['calendar.view_compose_stale_voters']);
      expect(comp.composing()).toBe(true);
    });

    it('aperçu : durée 6, vendredi soir désigné → samedi entier et dimanche matin + après-midi', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onComposeDurationChanged(6);
      comp.onComposeToggled(cell('2026-11-06', 'EVENING'));

      expect([...comp.composeCoverKeys()].sort()).toEqual([
        '2026-11-07|AFTERNOON',
        '2026-11-07|EVENING',
        '2026-11-07|MORNING',
        '2026-11-08|AFTERNOON',
        '2026-11-08|MORNING',
      ]);
      // La plage s'écrit depuis le premier départ désigné.
      expect(comp.composeDurationStart()).toEqual({ date: '2026-11-06', slot: 'EVENING' });
      // Toucher le départ désigné le retire ; toucher une bande couverte ajoute un départ.
      comp.onComposeToggled(cell('2026-11-07', 'MORNING'));
      expect(comp.composedCells()).toHaveLength(2);
      comp.onComposeToggled(cell('2026-11-06', 'EVENING'));
      expect(comp.composedCells()).toHaveLength(1);
    });

    it('au-delà d’un créneau : une journée entière désignée est retirée, avec un message écrit ; « Journée » quitte la barre', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onComposeToggled(cell('2026-09-04', 'FULL_DAY'));
      comp.onComposeToggled(cell('2026-09-05', 'EVENING'));
      // Une journée entière n'est pas le départ de la plage écrite : le compteur peut toujours allonger.
      expect(comp.composeDurationStart()).toEqual({ date: '2026-09-05', slot: 'EVENING' });

      comp.onComposeDurationChanged(2);
      fixture.detectChanges();

      expect(comp.composedCells().map((c: any) => c.slot)).toEqual(['EVENING']);
      expect(comp.composeAllowsFullDay()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('.calendar-error--compose')?.textContent?.trim(),
      ).toBe(DURATION_TEXT.fullDayRemoved);
    });

    it('vue Mois, durée 2 : toucher une case entière ouvre la Semaine sur ce jour, sans rien désigner', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onViewChange('month');
      comp.onComposeDurationChanged(2);

      comp.onComposeToggled(cell('2026-09-04', 'FULL_DAY'));

      expect(comp.view()).toBe('week');
      expect(comp.sharedDate().toISOString().substring(0, 10)).toBe('2026-09-04');
      expect(comp.composedCells()).toEqual([]);
    });

    it('création : une durée changée part avec le vote ; inchangée, elle ne part pas', async () => {
      const { fixture, scenariosSvc } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onComposeDurationChanged(3);
      comp.onComposeToggled(cell('2026-09-04', 'EVENING'));
      comp.onComposeToggled(cell('2026-09-11', 'EVENING'));

      await comp.confirmCompose();

      expect(scenariosSvc.createSeancePoll).toHaveBeenCalledWith(
        'seanceX',
        [
          { date: '2026-09-04', slot: 'EVENING' },
          { date: '2026-09-11', slot: 'EVENING' },
        ],
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        3,
      );
    });

    it('une option = UNE entrée de l’agenda, avec son départ et sa fin (durée du vote)', async () => {
      const { comp } = await armOnSpanPoll();
      comp.cancelCompose();

      const entry = comp
        .allCalendarEntries()
        .find((e: any) => e.key === 'poll-poll1-optA');
      expect(entry).toMatchObject({
        date: '2026-08-01',
        slot: 'EVENING',
        endDate: '2026-08-02',
        endSlot: 'AFTERNOON',
      });
    });

    it('calendrier personnel : un vote ouvert de 6 créneaux donne à chaque option sa fin', async () => {
      const { fixture } = await createCalendarView({
        mode: 'personal',
        openPolls: [openPollEntry({ durationSlots: 6 })],
      });
      const comp = fixture.componentInstance as any;

      const entry = comp
        .allCalendarEntries()
        .find((e: any) => e.key === 'poll-poll9-2026-08-28-EVENING');
      expect(entry).toMatchObject({
        date: '2026-08-28',
        slot: 'EVENING',
        endDate: '2026-08-30',
        endSlot: 'AFTERNOON',
      });
    });

    it('au-delà d’un créneau, « Ajouter au vote » refuse une journée entière : seul le créneau précis entre, la raison est écrite', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onComposeDurationChanged(2);

      comp.onComposeAdded([cell('2026-09-04', 'FULL_DAY'), cell('2026-09-05', 'EVENING')]);

      expect(comp.composedCells().map((c: any) => c.slot)).toEqual(['EVENING']);
      expect(comp.composeRefusal()).toBe(DURATION_TEXT.fullDayRefused);
      // Revenir à 1 créneau efface le message propre à la durée.
      comp.onComposeDurationChanged(1);
      expect(comp.composeRefusal()).toBeNull();
    });

    it('au-delà d’un créneau, une journée entière touchée hors vue Mois est refusée avec sa raison, rien n’est désigné', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [FREE_SEANCE_SCENARIO],
      });
      const comp = fixture.componentInstance as any;
      comp.startCompose('seanceX');
      comp.onViewChange('week');
      comp.onComposeDurationChanged(2);

      comp.onComposeToggled(cell('2026-09-04', 'FULL_DAY'));

      expect(comp.view()).toBe('week');
      expect(comp.composedCells()).toEqual([]);
      expect(comp.composeRefusal()).toBe(DURATION_TEXT.fullDayRefused);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 36.11 — La vue Agenda refondue
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Une séance DATÉE et JOUÉE, sans compte-rendu : le seul jeu qui rende « C'est passé »
 *  observable — et il n'existe qu'en contexte de partie (encadré n°2 de la story). */
const SCENARIO_WITH_SEANCE = {
  ...ACTIVE_POLL_SCENARIO,
  seances: [
    {
      id: 'seanceD',
      scenarioId: 's1',
      compteRendu: null,
      createdAt: '2026-07-13T00:00:00.000Z',
      poll: {
        ...ACTIVE_POLL_SCENARIO.seances[0].poll,
        status: 'CLOSED',
        chosenDate: '2026-08-01T00:00:00.000Z',
        chosenSlot: 'EVENING',
      },
    },
  ],
};

/** Le même scénario, vote OUVERT à une option — de quoi armer la Destinée. */
const SCENARIO_WITH_OPEN_POLL = {
  ...ACTIVE_POLL_SCENARIO,
  seances: [
    {
      ...ACTIVE_POLL_SCENARIO.seances[0],
      poll: {
        ...ACTIVE_POLL_SCENARIO.seances[0].poll,
        options: [{ id: 'optA', date: '2026-08-28T00:00:00.000Z', slot: 'EVENING', votes: [] }],
      },
    },
  ],
};

describe('CalendarView — vue par défaut selon la largeur (Story 36.11, AC6/AC15)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC6 — sur téléphone, l’Agenda est la vue affichée par défaut', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: false });
    const comp = fixture.componentInstance as any;
    expect(comp.view()).toBe('agenda');
    expect(fixture.nativeElement.querySelector('app-calendar-agenda-view')).not.toBeNull();
  });

  it('AC6 — sur ordinateur, le Mois reste la vue par défaut', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: true });
    const comp = fixture.componentInstance as any;
    expect(comp.view()).toBe('month');
    expect(fixture.nativeElement.querySelector('app-calendar-month-view')).not.toBeNull();
  });

  it('AC15 — 🚨 un défaut n’est pas un verrou : le choix de l’utilisateur survit', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', desktop: false });
    const comp = fixture.componentInstance as any;

    comp.onViewChange('month');
    fixture.detectChanges();
    expect(comp.view()).toBe('month');

    // Une rotation d'écran ne doit RIEN réassigner : la largeur n'est lue qu'au montage. On
    // relance donc un cycle complet de détection, ce qui rejouerait tout `effect()` mal placé.
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(comp.view()).toBe('month');
  });
});

describe('CalendarView — la couche « inscriptions ouvertes » (Story 36.11, AC7/AC9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC7 — son interrupteur a quitté la barre de contrôles (contexte personnel)', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const keys = (fixture.componentInstance as any).availableLayerKeys();
    expect(keys).not.toContain('inscriptions-ouvertes');
    expect(keys).toHaveLength(4);
  });

  it('AC7 — son interrupteur a quitté la barre de contrôles (contexte de partie)', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const keys = (fixture.componentInstance as any).availableLayerKeys();
    expect(keys).not.toContain('inscriptions-ouvertes');
    expect(keys).toContain('disponibilite-groupe');
    expect(keys).toHaveLength(5);
  });

  it('AC7 — 🚨 la CLÉ survit dans l’union partagée : aucune préférence enregistrée n’est invalidée', () => {
    expect(CALENDAR_LAYER_KEYS).toContain('inscriptions-ouvertes');
    expect(DEFAULT_CALENDAR_LAYER_KEYS).toContain('inscriptions-ouvertes');
  });

  it('AC9 — 🚨 une préférence héritée qui éteint la couche ne peut plus vider la section', async () => {
    const authSvc = makeAuthService(['mes-indisponibilites', 'mes-disponibilites', 'mes-seances']);
    const { fixture } = await createCalendarView({
      mode: 'personal',
      authSvc,
      availabilitySvc: (() => {
        const svc = makeAvailabilityService();
        svc.getMyCalendar.mockResolvedValue({
          'mes-indisponibilites': [],
          'mes-disponibilites': [],
          'mes-seances': [],
          'votes-en-cours': [],
          'inscriptions-ouvertes': [
            {
              seanceId: 'si1',
              partieId: 'pX',
              partieName: 'Partie X',
              scenarioTitle: 'La Halte du Griffon',
              inscriptionMin: 2,
              inscriptionMax: 5,
              inscritsCount: 3,
              jeSuisInscrit: false,
            },
          ],
        });
        return svc;
      })(),
    });
    const comp = fixture.componentInstance as any;

    expect(comp.activeLayers()).not.toContain('inscriptions-ouvertes');
    const inscriptions = comp
      .agendaEntries()
      .filter((e: any) => e.type === 'inscriptions-ouvertes');
    expect(inscriptions).toHaveLength(1);
    expect(inscriptions[0].jeSuisInscrit).toBe(false);
  });
});

describe('CalendarView — ce que l’Agenda reçoit (Story 36.11, AC14, D-3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC14 — passer en vue agenda n’émet AUCUN appel réseau supplémentaire', async () => {
    const { fixture, availabilitySvc, pollSvc, scenariosSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_WITH_SEANCE],
    });
    const comp = fixture.componentInstance as any;
    const before =
      availabilitySvc.getMyDeclarations.mock.calls.length +
      availabilitySvc.getMyCalendar.mock.calls.length +
      pollSvc.getAvailableSlots.mock.calls.length +
      pollSvc.getHeatmap.mock.calls.length +
      scenariosSvc.listAll.mock.calls.length;

    comp.onViewChange('agenda');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const after =
      availabilitySvc.getMyDeclarations.mock.calls.length +
      availabilitySvc.getMyCalendar.mock.calls.length +
      pollSvc.getAvailableSlots.mock.calls.length +
      pollSvc.getHeatmap.mock.calls.length +
      scenariosSvc.listAll.mock.calls.length;
    expect(after).toBe(before);
  });

  it('D-3 — le contrôle Destinée est masqué en vue Agenda, sans éteindre le mode', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_WITH_OPEN_POLL],
    });
    const comp = fixture.componentInstance as any;
    expect(fixture.nativeElement.querySelector('app-destiny-control')).not.toBeNull();

    comp.destinyPollId.set('poll1');
    comp.onViewChange('agenda');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-destiny-control')).toBeNull();
    // Le MODE survit : revenir au Mois le retrouve tel quel.
    expect(comp.destinyPollId()).toBe('poll1');
    comp.onViewChange('month');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-destiny-control')).not.toBeNull();
  });

  it('le compte-rendu manquant d’une séance passée remonte à l’Agenda (contexte de partie)', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_WITH_SEANCE],
    });
    const comp = fixture.componentInstance as any;
    const seances = comp.agendaEntries().filter((e: any) => e.type === 'mes-seances');
    expect(seances.length).toBeGreaterThan(0);
    expect(seances[0].compteRenduManquant).toBe(true);
  });

  it('le compte-rendu manquant d’une séance passée remonte à l’Agenda (contexte personnel, deferred-work « C’est passé »)', async () => {
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.getMyCalendar = vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [
        {
          seanceId: 's1',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc1',
          scenarioTitle: 'Le Convoi',
          date: '2026-01-05',
          slot: 'EVENING',
          heureRdv: null,
          lieu: null,
          notePratique: null,
          compteRenduManquant: true,
        },
      ],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    });
    const { fixture } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;
    const seances = comp.agendaEntries().filter((e: any) => e.type === 'mes-seances');
    expect(seances.length).toBeGreaterThan(0);
    expect(seances[0].compteRenduManquant).toBe(true);
  });

  it('contexte personnel, sans query param `from` : la plage par défaut recule de 31 jours (deferred-work « C’est passé »)', async () => {
    const { fixture, availabilitySvc } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;
    const expected = new Date();
    expected.setUTCDate(expected.getUTCDate() - 31);
    const expectedFrom = expected.toISOString().substring(0, 10);
    expect(comp.fromDateStr()).toBe(expectedFrom);
    expect(availabilitySvc.getMyCalendar).toHaveBeenCalledWith(expectedFrom, expect.any(String));
  });

  it("contexte personnel, avec query param `from` explicite : la plage n'est PAS écrasée par le défaut -31j", async () => {
    const { fixture, availabilitySvc } = await createCalendarView({
      mode: 'personal',
      queryParams: { from: '2026-01-01' },
    });
    const comp = fixture.componentInstance as any;
    expect(comp.fromDateStr()).toBe('2026-01-01');
    expect(availabilitySvc.getMyCalendar).toHaveBeenCalledWith('2026-01-01', expect.any(String));
  });

  it("contexte MJ : le défaut -31j du contexte personnel ne s'applique pas (fromDateStr reste aujourd'hui)", async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    const today = new Date().toISOString().substring(0, 10);
    expect(comp.fromDateStr()).toBe(today);
  });

  it('contexte personnel : se connecte à userTopic(monId) au montage, se déconnecte au destroy (deferred-work, SSE calendrier personnel) — le calendrier personnel agrège plusieurs Parties, aucun partieTopic unique ne peut le couvrir', async () => {
    const authSvc = { currentUser: signal({ id: 'me1' }) } as any;
    const { fixture, realtimeSvc } = await createCalendarView({ mode: 'personal', authSvc });

    expect(realtimeSvc.connect).toHaveBeenCalledWith(userTopic('me1'));

    fixture.destroy();

    expect(realtimeSvc.disconnect).toHaveBeenCalledWith(userTopic('me1'));
  });

  it("atelier d'un joueur : connect(userTopic(...)) n'est PAS appelé — seul partieTopic(id) l'est", async () => {
    const authSvc = { currentUser: signal({ id: 'me1' }) } as any;
    const { realtimeSvc } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      authSvc,
    });

    expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('partie-1'));
    expect(realtimeSvc.connect).not.toHaveBeenCalledWith(userTopic('me1'));
  });

  // Story 46.4 — ⚠️ le contrat de la 36.11 (D-3) change pour le seul atelier du MJ : masquer une fenêtre de l'automate est
  // un fait PAR UTILISATEUR, que le serveur n'émet que sur `user:{id}` ; sans cette connexion, ses autres onglets et
  // appareils ne reliraient jamais la liste. Le joueur, lui, n'en a pas besoin.
  it("atelier du MJ : se connecte à partieTopic(id) ET à userTopic(moi), et s'en déconnecte", async () => {
    const authSvc = { currentUser: signal({ id: 'me1' }) } as any;
    const { fixture, realtimeSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      authSvc,
    });

    expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic('partie-1'));
    expect(realtimeSvc.connect).toHaveBeenCalledWith(userTopic('me1'));

    fixture.destroy();
    expect(realtimeSvc.disconnect).toHaveBeenCalledWith(userTopic('me1'));
  });

  it('contexte personnel : un changement de scenariosSvc.changed() APRÈS le montage recharge GET /me/calendar (deferred-work, SSE calendrier personnel)', async () => {
    const authSvc = { currentUser: signal({ id: 'me1' }) } as any;
    const { fixture, availabilitySvc, scenariosSvc } = await createCalendarView({
      mode: 'personal',
      authSvc,
    });
    availabilitySvc.getMyCalendar.mockClear();

    scenariosSvc.changed.set({ partieId: '*' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(availabilitySvc.getMyCalendar).toHaveBeenCalled();
  });

  it('deferred-work : une inscription ouverte du calendrier personnel porte désormais scenarioId/partieId — la ligne devient ouvrable (AC12)', async () => {
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.getMyCalendar = vi.fn().mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [
        {
          seanceId: 's1',
          partieId: 'p1',
          partieName: 'Partie',
          scenarioId: 'sc1',
          scenarioTitle: 'Le Convoi',
          inscriptionMin: 2,
          inscriptionMax: 5,
          inscritsCount: 3,
          jeSuisInscrit: false,
        },
      ],
    });
    const { fixture } = await createCalendarView({ mode: 'personal', availabilitySvc });
    const comp = fixture.componentInstance as any;
    const entries = comp.agendaEntries().filter((e: any) => e.type === 'inscriptions-ouvertes');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].scenarioId).toBe('sc1');
    expect(entries[0].partieId).toBe('p1');
  });
});

// ─── Story 36.12 — l'Agenda du MJ : scellement et lancement de vote ─────────

/** Un scénario portant DEUX séances : l'une avec un vote ouvert à deux options, l'autre sans le
 *  moindre vote — donc éligible à « Lancer un vote » (AC5). */
const SCENARIO_MJ_AGENDA = {
  ...ACTIVE_POLL_SCENARIO,
  seances: [
    {
      ...ACTIVE_POLL_SCENARIO.seances[0],
      poll: {
        ...ACTIVE_POLL_SCENARIO.seances[0].poll,
        options: [
          { id: 'optA', date: '2026-08-28T00:00:00.000Z', slot: 'EVENING', votes: [] },
          { id: 'optB', date: '2026-08-29T00:00:00.000Z', slot: 'EVENING', votes: [] },
        ],
      },
    },
    {
      id: 'seanceLibre',
      scenarioId: 's1',
      compteRendu: null,
      createdAt: '2026-07-14T00:00:00.000Z',
      poll: null,
    },
  ],
};

const SEAL_REQUEST = {
  partieId: 'partie-1',
  pollId: 'poll1',
  optionId: 'optA',
  dateLabel: 'ven. 28 août, soir',
  pollLabel: 'Chapitre 1',
};

describe('CalendarView — sceller depuis l’Agenda (Story 36.12, AC10 à AC12)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC10/AC11 — confirmé : un seul appel, avec le bon optionId, puis rechargement', async () => {
    const { fixture, pollSvc, scenariosSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    dialog.__result = true;
    const before = scenariosSvc.listAll.mock.calls.length;

    await (fixture.componentInstance as any).onSealRequested(SEAL_REQUEST);

    expect(pollSvc.chooseDate).toHaveBeenCalledTimes(1);
    expect(pollSvc.chooseDate).toHaveBeenCalledWith('partie-1', 'poll1', { optionId: 'optA' });
    // `chooseDate()` renvoie void : sans ce rechargement, la ligne resterait « vote ouvert ».
    expect(scenariosSvc.listAll.mock.calls.length).toBeGreaterThan(before);
  });

  it('AC11 — 🚨 renoncer n’écrit RIEN', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    dialog.__result = false;

    await (fixture.componentInstance as any).onSealRequested(SEAL_REQUEST);

    expect(dialog.open).toHaveBeenCalled();
    expect(pollSvc.chooseDate).not.toHaveBeenCalled();
  });

  it('AC11 — la confirmation NOMME la date et le vote qu’elle scelle', async () => {
    const { fixture, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    dialog.__result = false;

    await (fixture.componentInstance as any).onSealRequested(SEAL_REQUEST);

    expect(dialog.open.mock.calls[0][1]?.data).toEqual({
      dateLabel: 'ven. 28 août, soir',
      pollLabel: 'Chapitre 1',
    });
  });

  it('AC10 — 🚨 garde anti-double-clic : deux demandes rapprochées, un SEUL dialogue et un seul appel', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    dialog.__result = true;
    const comp = fixture.componentInstance as any;

    await Promise.all([comp.onSealRequested(SEAL_REQUEST), comp.onSealRequested(SEAL_REQUEST)]);

    // Revue de code (36.12) — la garde posait `pollActionPending` seulement APRÈS résolution du
    // dialogue : les deux appels passaient alors la garde et ouvraient chacun leur dialogue avant
    // qu'aucun réseau ne parte. Elle est maintenant posée AVANT l'ouverture, donc un seul dialogue.
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(pollSvc.chooseDate).toHaveBeenCalledTimes(1);
  });

  it('AC10 — un échec pose un message et ne laisse aucun état fantôme', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    dialog.__result = true;
    pollSvc.chooseDate.mockRejectedValueOnce(new Error('boom'));
    const comp = fixture.componentInstance as any;

    await comp.onSealRequested(SEAL_REQUEST);

    expect(comp.error()).toBe(GRIMOIRE_TONE['calendar.view_seal_error']);
    expect(comp.pollActionPending()).toBe(false);
  });

  it('AC12 — 🚨 le calendrier personnel ne scelle jamais, et n’en donne pas l’air', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('agenda');
    fixture.detectChanges();

    // `canSeal` porte les DEUX conditions ; sans `partieId`, il est faux quoi qu'il arrive — et
    // aucun bouton n'est rendu, pas même désactivé.
    expect(comp.partieId()).toBeNull();
    expect(fixture.nativeElement.querySelector('.agenda-option__seal')).toBeNull();
    expect(fixture.nativeElement.querySelector('.agenda-entry__launch')).toBeNull();
  });
});

describe('CalendarView — sceller depuis la grille (Story 36.15)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC1/AC3 — canSeal reçu par la vue Mois vaut isMjMode() && partieId() !== null', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('month');
    fixture.detectChanges();

    const month = fixture.debugElement.query(By.directive(CalendarMonthView));
    expect(month.componentInstance.canSeal()).toBe(true);
  });

  it('AC1/AC3 — canSeal reçu par la vue Semaine vaut isMjMode() && partieId() !== null', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('week');
    fixture.detectChanges();

    const week = fixture.debugElement.query(By.directive(CalendarWeekView));
    expect(week.componentInstance.canSeal()).toBe(true);
  });

  it('AC3 — canSeal est faux en calendrier personnel, même sans changer de vue', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal' });
    fixture.detectChanges();

    const month = fixture.debugElement.query(By.directive(CalendarMonthView));
    expect(month.componentInstance.canSeal()).toBe(false);
  });

  it('AC5/AC6 — sealRequested de la vue Mois route vers onSealRequested() (même chemin que l’Agenda)', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('month');
    fixture.detectChanges();
    dialog.__result = true;

    const month = fixture.debugElement.query(By.directive(CalendarMonthView));
    month.componentInstance.sealRequested.emit(SEAL_REQUEST);
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalled();
    expect(pollSvc.chooseDate).toHaveBeenCalledWith('partie-1', 'poll1', { optionId: 'optA' });
  });

  it('AC5/AC6 — sealRequested de la vue Semaine route vers onSealRequested()', async () => {
    const { fixture, pollSvc, dialog } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('week');
    fixture.detectChanges();
    dialog.__result = true;

    const week = fixture.debugElement.query(By.directive(CalendarWeekView));
    week.componentInstance.sealRequested.emit(SEAL_REQUEST);
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalled();
    expect(pollSvc.chooseDate).toHaveBeenCalledWith('partie-1', 'poll1', { optionId: 'optA' });
  });
});

describe('CalendarView — « Lancer un vote » depuis l’Agenda (Story 36.12, AC5, AC13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC5 — une séance sans vote produit une ligne d’agenda, MJ seul', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const sansDate = (fixture.componentInstance as any)
      .agendaEntries()
      .filter((e: any) => e.type === 'seances-sans-date');
    expect(sansDate).toHaveLength(1);
    expect(sansDate[0].seanceId).toBe('seanceLibre');
    expect(sansDate[0].date).toBe('');
  });

  it('AC5 — 🚨 en mode joueur, aucune de ces lignes n’existe', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    expect(
      (fixture.componentInstance as any)
        .agendaEntries()
        .filter((e: any) => e.type === 'seances-sans-date'),
    ).toHaveLength(0);
  });

  it('AC13 — bascule sur le Mois et arme la composition CIBLÉE sur la séance', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('agenda');

    comp.onPollLaunchRequested('seanceLibre');
    fixture.detectChanges();

    expect(comp.view()).toBe('month');
    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'seanceLibre' });
    expect(comp.composedCells()).toEqual([]);
    expect(fixture.nativeElement.querySelector('app-compose-bar')).not.toBeNull();
  });

});

describe('CalendarView — le regroupement ne touche PAS les grilles (Story 36.12, AC7)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('🚨 la vue Mois reçoit toujours UNE ENTRÉE PAR OPTION — la grille en dépend', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
    });
    const options = (fixture.componentInstance as any)
      .calendarEntries()
      .filter((e: any) => e.type === 'votes-en-cours');
    expect(options).toHaveLength(2);
    expect(options.map((e: any) => e.vote.optionId).sort()).toEqual(['optA', 'optB']);
  });

  it('AC14 — côté MJ, « qui manque » nomme ceux qui n’ont pas répondu à TOUTES les options', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
      members: [
        { userId: 'u1', pseudo: 'lea', displayName: 'Léa', joinedAt: '' },
        { userId: 'u2', pseudo: 'tom', displayName: 'Tom', joinedAt: '' },
      ],
    });
    // Aucun vote posé sur les deux options : les deux membres manquent.
    expect((fixture.componentInstance as any).missingByPoll()).toEqual({ poll1: ['Léa', 'Tom'] });
  });

  it('AC14 — 🚨 hors mode MJ, aucune identité ne peut fuir : la liste est vide', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [SCENARIO_MJ_AGENDA],
      members: [{ userId: 'u1', pseudo: 'lea', displayName: 'Léa', joinedAt: '' }],
    });
    expect((fixture.componentInstance as any).missingByPoll()).toEqual({});
  });
});

// ─── Le calendrier d'un groupe (Story 40.5b) ────────────────────────────────────────────────────

describe('CalendarView — le calendrier d’un groupe (Story 40.5b)', () => {
  const ME = 'me';
  const HOST = 'host';
  const OTHER = 'other';
  const GROUP_PARTY = {
    id: 'g1',
    gameSystemId: 'ralliement',
    kind: 'CAMPAGNE_EPISODIQUE',
    role: 'member',
  };
  const JDR_PARTY = { id: 'p1', gameSystemId: 'ryuutama', kind: 'CAMPAGNE_LINEAIRE', role: 'mj' };

  /** Fin du jour d'échéance (UTC), `days` jours à partir d'aujourd'hui (négatif : dépassée). */
  function deadline(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000);
    return `${d.toISOString().substring(0, 10)}T23:59:59.999Z`;
  }

  // Story 44.1 : le serveur dit ce que la personne peut faire (`can`) ; ici l'hôte a tous les droits, les autres aucun.
  const NO_CAN = { propose: false, edit: false, choose: false, extend: false };
  const HOST_CAN = { propose: true, edit: true, choose: true, extend: true };
  /** Cartes telles que le serveur les sert à `userId` : `can` calculé pour lui, sauf si la carte le fixe. */
  function servedTo(userId: string, cards: any[]) {
    return cards.map((c) => ({
      ...c,
      can: c.can !== NO_CAN ? c.can : c.hostId === userId ? HOST_CAN : NO_CAN,
    }));
  }

  /** Une conjonction à sondage ouvert : 3 créneaux, 3 votants éligibles, l'hôte est `HOST`. */
  function groupCard(over: Record<string, unknown> = {}, pollOver: Record<string, unknown> = {}) {
    return {
      id: 'e1',
      title: 'Soirée plateaux',
      hostId: HOST,
      hostDisplayName: 'Léa',
      seance: {
        id: 's1',
        date: null as string | null,
        slot: null as string | null,
        lieu: 'Chez Léa',
        heureRdv: '19:30',
        notePratique: 'Apportez à boire',
        capacity: 6,
        placesTaken: 2,
      },
      participants: [],
      myInscription: null,
      cancelled: false,
      can: NO_CAN,
      poll: {
        id: 'p1',
        expiresAt: deadline(3),
        status: 'OPEN',
        eligibleVoterIds: [HOST, ME, OTHER],
        options: [
          { id: 'o1', date: '2099-11-24', slot: 'EVENING', availableCount: 2 },
          { id: 'o2', date: '2099-11-25', slot: 'MORNING', availableCount: 1 },
          { id: 'o3', date: '2099-11-26', slot: 'EVENING', availableCount: 0 },
        ],
        votes: [
          { optionId: 'o1', userId: HOST, answer: 'YES' },
          { optionId: 'o1', userId: OTHER, answer: 'MAYBE' },
          { optionId: 'o2', userId: OTHER, answer: 'NO' },
        ],
        ...pollOver,
      },
      ...over,
    };
  }

  interface GroupOptions {
    userId?: string;
    party?: Record<string, unknown>;
    events?: unknown[];
    /** Story 44.4 — les membres servis par `GET /parties/:id/members` (nomment les absents d'un vote de groupe). */
    members?: unknown[];
    /** Story 44.4 — mes sondages ouverts tels que `GET /me/open-polls` les sert (le plateau de la destinée). */
    openPolls?: OpenPollEntry[];
    /** Story 44.7 — les paramètres d'adresse de l'arrivée (`?poll`, `?pollList`). */
    queryParams?: Record<string, string>;
    beforeCreate?: () => void;
  }

  async function createGroupView(opts: GroupOptions = {}) {
    const availabilitySvc = makeAvailabilityService();
    const authSvc = {
      currentUser: signal<Partial<AuthUser> | null>({
        id: opts.userId ?? ME,
        defaultCalendarLayers: DEFAULT_CALENDAR_LAYER_KEYS,
      }),
    };
    const pollSvc = makePollService();
    const snack = makeSnackBar();
    const dialog = makeMatDialog();
    const partiesSvc = {
      ...makePartiesService(opts.members ?? []),
      get: vi.fn().mockResolvedValue(opts.party ?? GROUP_PARTY),
    };
    const openPollsSvc = {
      entries: signal<OpenPollEntry[]>(opts.openPolls ?? []),
      loaded: signal(true),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    const scenariosSvc = makeScenariosService([]);
    const eventsApi = {
      list: vi.fn().mockResolvedValue(servedTo(opts.userId ?? ME, opts.events ?? [groupCard()])),
      update: vi.fn().mockResolvedValue(groupCard()),
      extend: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarView],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute, useValue: makeActivatedRoute('g1', opts.queryParams) },
        { provide: AvailabilityService, useValue: availabilitySvc },
        { provide: AuthService, useValue: authSvc },
        { provide: PartiesService, useValue: partiesSvc },
        { provide: PollService, useValue: pollSvc },
        { provide: MatSnackBar, useValue: snack },
        { provide: MatDialog, useValue: dialog },
        { provide: ScenariosService, useValue: scenariosSvc },
        { provide: RealtimeService, useValue: makeRealtimeService() },
        { provide: EventsApiService, useValue: eventsApi },
        { provide: BreakpointObserver, useValue: makeBreakpointObserver(true) },
        ...(opts.openPolls ? [{ provide: OpenPollsService, useValue: openPollsSvc }] : []),
      ],
    }).compileComponents();

    const location = TestBed.inject(Location);
    vi.spyOn(location, 'back').mockImplementation(() => {});
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const drafts = TestBed.inject(ConjonctionDraftService);
    opts.beforeCreate?.();

    const fixture = TestBed.createComponent(CalendarView);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const comp = fixture.componentInstance as any;
    const tick = async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };
    await tick();
    return {
      fixture,
      comp,
      tick,
      pollSvc,
      availabilitySvc,
      partiesSvc,
      scenariosSvc,
      eventsApi,
      dialog,
      navigate,
      drafts,
      openPollsSvc,
      location,
    };
  }

  function cell(iso: string, slot: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return { date: new Date(y, m - 1, d), slot };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  // ── Ce que la page lit ──

  it('un groupe lit ses conjonctions et ne fait AUCUN appel que le serveur lui refuse', async () => {
    const { pollSvc, scenariosSvc, partiesSvc, availabilitySvc, eventsApi } =
      await createGroupView();

    expect(eventsApi.list).toHaveBeenCalledWith('g1');
    expect(pollSvc.getAvailableSlots).not.toHaveBeenCalled();
    expect(pollSvc.getHeatmap).not.toHaveBeenCalled();
    expect(scenariosSvc.listAll).not.toHaveBeenCalled();
    expect(partiesSvc.members).not.toHaveBeenCalled();
    // Ses propres disponibilités et couches continuent de fonctionner.
    expect(availabilitySvc.getMyDeclarations).toHaveBeenCalled();
  });

  it('jamais de couche « disponibilité du groupe », même si le compte l’a par défaut', async () => {
    const { comp } = await createGroupView();
    expect(DEFAULT_CALENDAR_LAYER_KEYS).toContain('disponibilite-groupe');
    expect(comp.availableLayerKeys()).not.toContain('disponibilite-groupe');
    expect(comp.activeLayers()).not.toContain('disponibilite-groupe');
    expect(comp.activeLayers()).toContain('votes-en-cours');
    // Le défaut proposé au rétablissement est le même : l'écran n'est pas « filtré » à son arrivée.
    expect(comp.isOverridden()).toBe(false);
  });

  it('une quête (famille JDR) garde ses lectures et ne lit jamais la liste des conjonctions', async () => {
    const { pollSvc, scenariosSvc, eventsApi, comp } = await createGroupView({ party: JDR_PARTY });
    expect(comp.isGroup()).toBe(false);
    expect(pollSvc.getAvailableSlots).toHaveBeenCalled();
    expect(pollSvc.getHeatmap).toHaveBeenCalled();
    expect(scenariosSvc.listAll).toHaveBeenCalledWith('g1');
    expect(eventsApi.list).not.toHaveBeenCalled();
  });

  it('une piste par créneau : compteurs, ma réponse et effectif = votants éligibles', async () => {
    const { comp } = await createGroupView({
      events: [
        groupCard(
          {},
          {
            votes: [
              { optionId: 'o1', userId: HOST, answer: 'YES' },
              { optionId: 'o1', userId: ME, answer: 'MAYBE' },
              { optionId: 'o1', userId: OTHER, answer: 'YES' },
              // Un ancien votant qui n'est plus éligible ne compte pas.
              { optionId: 'o1', userId: 'parti', answer: 'YES' },
            ],
          },
        ),
      ],
    });
    const entries = comp.calendarEntries().filter((e: any) => e.type === 'votes-en-cours');
    expect(entries).toHaveLength(3);
    const first = entries.find((e: any) => e.vote.optionId === 'o1');
    expect(first.label).toBe('Soirée plateaux');
    expect(first.date).toBe('2099-11-24');
    expect(first.slot).toBe('EVENING');
    expect(first.vote).toEqual({
      partieId: 'g1',
      pollId: 'p1',
      optionId: 'o1',
      yes: 2,
      maybe: 1,
      no: 0,
      total: 3,
      myAnswer: 'MAYBE',
    });
  });

  it('une conjonction à date fixée, un sondage clos ou sans sondage ne donne aucune piste', async () => {
    const base = groupCard();
    const { comp } = await createGroupView({
      events: [
        groupCard({ id: 'dated', seance: { ...base.seance, date: '2099-11-30', slot: 'EVENING' } }),
        groupCard({ id: 'closed' }, { id: 'pc', status: 'CLOSED' }),
        groupCard({ id: 'plain', poll: null }),
      ],
    });
    expect(comp.groupPolls()).toEqual([]);
    expect(comp.calendarEntries().filter((e: any) => e.type === 'votes-en-cours')).toEqual([]);
  });

  it('un échec de lecture se voit et garde le dernier état connu', async () => {
    const { comp, fixture, eventsApi, scenariosSvc, tick } = await createGroupView();
    expect(comp.groupPolls()).toHaveLength(1);

    eventsApi.list.mockRejectedValueOnce(new Error('réseau'));
    scenariosSvc.changed.set({ partieId: 'g1' });
    await tick();

    expect(comp.groupPolls()).toHaveLength(1);
    const alert = fixture.nativeElement.querySelector('.calendar-error--events');
    expect(alert?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['partie.ralliement_calendar_events_error'],
    );
  });

  it('suit le signal temps réel des scénarios : la liste est relue, pas les scénarios', async () => {
    const { eventsApi, scenariosSvc, tick, comp } = await createGroupView();
    expect(eventsApi.list).toHaveBeenCalledTimes(1);

    eventsApi.list.mockResolvedValueOnce([
      groupCard({}, { votes: [{ optionId: 'o2', userId: ME, answer: 'YES' }] }),
    ]);
    scenariosSvc.changed.set({ partieId: 'g1' });
    await tick();

    expect(eventsApi.list).toHaveBeenCalledTimes(2);
    expect(scenariosSvc.listAll).not.toHaveBeenCalled();
    const mine = comp.calendarEntries().find((e: any) => e.vote?.optionId === 'o2').vote.myAnswer;
    expect(mine).toBe('YES');
  });

  // ── Voter ──

  it('un membre éligible répond : le vote part par la route partagée, puis la liste est relue', async () => {
    const { comp, pollSvc, eventsApi, tick, fixture } = await createGroupView();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const vote = comp.calendarEntries().find((e: any) => e.vote?.optionId === 'o1').vote;

    comp.onVoteOptionActivated({ vote, date: new Date(2099, 10, 24), slot: 'EVENING', anchor });
    await tick();
    expect(comp.pickerVote()).not.toBeNull();

    document.body
      .querySelector<HTMLButtonElement>('app-vote-answer-picker .opt2--answer[data-answer="YES"]')!
      .click();
    await tick();

    expect(pollSvc.castVote).toHaveBeenCalledWith('g1', 'p1', { optionId: 'o1', answer: 'YES' });
    expect(eventsApi.list).toHaveBeenCalledTimes(2);
    expect(comp.pickerVote()).toBeNull();
    expect(fixture.nativeElement.querySelector('.calendar-error')).toBeNull();
  });

  it('lecture seule : un membre non éligible, ou l’échéance dépassée, n’ouvre aucun sélecteur', async () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    const stranger = await createGroupView({ userId: 'stranger' });
    const vote = stranger.comp.calendarEntries().find((e: any) => e.vote?.optionId === 'o1').vote;
    stranger.comp.onVoteOptionActivated({
      vote,
      date: new Date(2099, 10, 24),
      slot: 'EVENING',
      anchor,
    });
    await stranger.tick();
    expect(stranger.comp.pickerVote()).toBeNull();
    // Les pistes et les compteurs restent affichés, l'état est écrit.
    expect(stranger.comp.calendarEntries().some((e: any) => e.vote?.optionId === 'o1')).toBe(true);
    expect(
      stranger.fixture.nativeElement.querySelector('.group-poll__state')?.textContent?.trim(),
    ).toBe(GRIMOIRE_TONE['partie.ralliement_event_poll_not_eligible']);
    TestBed.resetTestingModule();

    const late = await createGroupView({ events: [groupCard({}, { expiresAt: deadline(-1) })] });
    const vote2 = late.comp.calendarEntries().find((e: any) => e.vote?.optionId === 'o1').vote;
    late.comp.onVoteOptionActivated({
      vote: vote2,
      date: new Date(2099, 10, 24),
      slot: 'EVENING',
      anchor,
    });
    await late.tick();
    expect(late.comp.pickerVote()).toBeNull();
    expect(
      late.fixture.nativeElement.querySelector('.group-poll__state')?.textContent?.trim(),
    ).toBe(GRIMOIRE_TONE['partie.ralliement_event_poll_ended']);
  });

  it('un membre éligible lit « Vous pouvez répondre jusqu’au … » (une seule fois le point final)', async () => {
    const { fixture } = await createGroupView();
    const state = fixture.nativeElement.querySelector('.group-poll__state')?.textContent?.trim();
    expect(state).toMatch(/^Vous pouvez répondre jusqu’au .+\.$/);
    expect(state).not.toMatch(/\.\.$/);
  });

  it.each([
    ['2099-03-10', 'mars'],
    ['2099-05-12', 'mai'],
    ['2099-06-09', 'juin'],
    ['2099-08-11', 'août'],
  ])('mois sans point (%s) : le dernier caractère du mois n’est pas retiré', async (day, month) => {
    const { fixture } = await createGroupView({
      events: [groupCard({}, { expiresAt: `${day}T23:59:59.999Z` })],
    });
    const state = fixture.nativeElement.querySelector('.group-poll__state')?.textContent?.trim();
    expect(state).toMatch(new RegExp(` ${Number(day.slice(8))} ${month}\\.$`));
  });

  it('le refus du serveur est écrit tel quel', async () => {
    const { comp, pollSvc, tick, fixture } = await createGroupView();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    pollSvc.castVote.mockRejectedValueOnce({ error: { message: 'Le vote est terminé.' } });
    const vote = comp.calendarEntries().find((e: any) => e.vote?.optionId === 'o1').vote;
    comp.onVoteOptionActivated({ vote, date: new Date(2099, 10, 24), slot: 'EVENING', anchor });
    await tick();
    document.body
      .querySelector<HTMLButtonElement>('app-vote-answer-picker .opt2--answer[data-answer="NO"]')!
      .click();
    await tick();

    expect(fixture.nativeElement.querySelector('.calendar-error')?.textContent?.trim()).toBe(
      'Le vote est terminé.',
    );
  });

  // ── Composer pour un sondage ouvert ──

  it('seul l’hôte d’un sondage ouvert a « Modifier les dates », et seulement quand ce vote est la destinée active (Story 45.1)', async () => {
    const member = await createGroupView();
    member.comp.destinyPollId.set('p1');
    member.fixture.detectChanges();
    expect(member.fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
    member.comp.startGroupCompose('e1');
    expect(member.comp.composing()).toBe(false);
    TestBed.resetTestingModule();

    const host = await createGroupView({ userId: HOST });
    // Sans destinée active ni rendez-vous à dater : plus de bouton « Composer les créneaux : {titre} ».
    expect(host.fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
    host.comp.destinyPollId.set('p1');
    host.fixture.detectChanges();
    const btn = host.fixture.nativeElement.querySelector('.compose-arm');
    expect(btn?.textContent?.trim()).toBe(GRIMOIRE_TONE['calendar.view_modify_dates']);
  });

  it('le bouton « composer » suit le droit servi (`can.edit`), pas l’identité de l’hôte', async () => {
    const { comp, fixture } = await createGroupView({
      userId: HOST,
      events: [groupCard({ can: { ...HOST_CAN, edit: false } })],
    });
    comp.destinyPollId.set('p1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.compose-arm')).toBeNull();
    comp.startGroupCompose('e1');
    expect(comp.composing()).toBe(false);
  });

  it('armer la composition part des créneaux actuels et passe en vue Semaine', async () => {
    const { comp, fixture } = await createGroupView({ userId: HOST });
    comp.destinyPollId.set('p1');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.compose-arm').click();
    fixture.detectChanges();

    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'group-poll', eventId: 'e1' });
    expect(comp.composedCells().map((c: any) => `${c.slot}`)).toEqual([
      'EVENING',
      'MORNING',
      'EVENING',
    ]);
    expect(comp.view()).toBe('week');
    expect(fixture.nativeElement.querySelector('app-compose-bar')).not.toBeNull();
    expect(comp.composeTargetLabel()).toBe('Créneaux de la conjonction : Soirée plateaux');
  });

  it('la grille s’ouvre sur le premier créneau composé, hors de la semaine affichée', async () => {
    const { comp } = await createGroupView({ userId: HOST });
    // Aujourd'hui n'est pas en 2099 : sans déplacement, la semaine affichée serait vide.
    comp.startGroupCompose('e1');
    expect(comp.sharedDate().toISOString().substring(0, 10)).toBe('2099-11-24');
  });

  it('Story 45.3 — « Ajouter au vote » : la journée entière est refusée avec sa raison écrite, les créneaux précis sont ajoutés', async () => {
    const { comp, fixture } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    const before = comp.composedCells().length;
    expect(comp.composeAllowsFullDay()).toBe(false);

    comp.onComposeAdded([cell('2099-11-27', 'FULL_DAY'), cell('2099-11-28', 'EVENING')]);
    fixture.detectChanges();

    expect(comp.composedCells()).toHaveLength(before + 1);
    expect(comp.composedCells().some((c: any) => c.slot === 'FULL_DAY')).toBe(false);
    expect(fixture.nativeElement.querySelector('.calendar-error--compose')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['partie.ralliement_calendar_compose_full_day'],
    );

    comp.onComposeAdded([cell('2099-11-29', 'MORNING')]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.calendar-error--compose')).toBeNull();
  });

  // ── Story 45.5 — proposer des dates pour une soirée encore sans date ──

  describe('soirée sans date (Story 45.5)', () => {
    // Une soirée isolée : famille ralliement, partie active (le statut vient du serveur).
    const EVENING_PARTY = { ...GROUP_PARTY, name: 'Apéro', kind: 'ONE_SHOT', status: 'A_VENIR' };
    const SEANCE = {
      id: 's1',
      date: null as string | null,
      slot: null as string | null,
      lieu: 'Chez Léa',
      heureRdv: '19:30',
      notePratique: 'Apportez à boire',
      capacity: null as number | null,
      placesTaken: 1,
    };
    const dateless = (over: Record<string, unknown> = {}) =>
      groupCard({ poll: null, seance: SEANCE, can: HOST_CAN, ...over });
    const dayIn = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return toDateKey(d);
    };

    it('la soirée sans date est proposée ; la composer l’arme en vue Semaine, sans journée entière, avec une fin proposée', async () => {
      const { comp, fixture } = await createGroupView({
        party: EVENING_PARTY, userId: HOST, events: [dateless()] });
      expect(comp.rendezvousRows().map((r: any) => r.seanceId)).toEqual(['s1']);

      comp.startCompose('s1');
      fixture.detectChanges();

      expect(comp.composeTarget()).toEqual({ kind: 'evening-poll', eventId: 'e1' });
      expect(comp.view()).toBe('week');
      expect(comp.composeAllowsFullDay()).toBe(false);
      expect(comp.composeHasDeadline()).toBe(true);
      expect(comp.composeDeadline()).toBe(dayIn(14));
      expect(comp.composeTargetLabel()).toBe('Dates à proposer : Soirée plateaux');
    });

    it('arriver par ?seanceId arme le composer pour cette soirée', async () => {
      const { comp, tick } = await createGroupView({
        party: EVENING_PARTY,
        userId: HOST,
        events: [dateless()],
        queryParams: { seanceId: 's1' },
      });
      await tick();
      expect(comp.composeTarget()).toEqual({ kind: 'evening-poll', eventId: 'e1' });
    });

    it('valider : UN PATCH avec les champs RELUS de la carte, les créneaux triés et la fin du composer ; la Destinée s’active sur le vote', async () => {
      const opened = groupCard({ can: HOST_CAN });
      const { comp, eventsApi, dialog } = await createGroupView({
        party: EVENING_PARTY,
        userId: HOST,
        events: [dateless()],
        openPolls: [
          openPollEntry({ pollId: 'p1', partieId: 'g1', family: 'ralliement', title: 'Soirée plateaux' }),
        ],
      });
      comp.startCompose('s1');
      comp.onComposeAdded([cell('2099-11-27', 'EVENING'), cell('2099-11-20', 'EVENING')]);
      comp.onComposeAdded([cell('2099-11-21', 'AFTERNOON')]);
      comp.onComposeDeadlineChanged(dayIn(9));
      eventsApi.list.mockResolvedValue([opened]);

      await comp.confirmCompose();

      expect(dialog.open).not.toHaveBeenCalled();
      expect(eventsApi.update).toHaveBeenCalledTimes(1);
      const [partieId, eventId, dto] = eventsApi.update.mock.calls[0];
      expect([partieId, eventId]).toEqual(['g1', 'e1']);
      expect(dto).toEqual({
        title: 'Soirée plateaux',
        lieu: 'Chez Léa',
        heureRdv: '19:30',
        notePratique: 'Apportez à boire',
        capacity: null,
        pollOptions: [
          { date: '2099-11-20', slot: 'EVENING' },
          { date: '2099-11-21', slot: 'AFTERNOON' },
          { date: '2099-11-27', slot: 'EVENING' },
        ],
        pollDeadline: dayIn(9),
      });
      expect(comp.composing()).toBe(false);
      expect(comp.destinyPollId()).toBe('p1');
    });

    it('Story 47.4 — la soirée arme sa durée ; changée, elle part dans le PATCH', async () => {
      const { comp, eventsApi } = await createGroupView({
        party: EVENING_PARTY,
        userId: HOST,
        events: [dateless({ seance: { ...SEANCE, durationSlots: 3 } })],
      });
      comp.startCompose('s1');
      expect(comp.composeDuration()).toBe(3);

      comp.onComposeDurationChanged(4);
      comp.onComposeAdded([cell('2099-11-20', 'EVENING'), cell('2099-11-27', 'EVENING')]);
      await comp.confirmCompose();

      expect(eventsApi.update).toHaveBeenCalledTimes(1);
      expect(eventsApi.update.mock.calls[0][2].durationSlots).toBe(4);
    });

    it('la journée entière est refusée avec sa raison, comme pour une conjonction', async () => {
      const { comp, fixture } = await createGroupView({
        party: EVENING_PARTY, userId: HOST, events: [dateless()] });
      comp.startCompose('s1');
      comp.onComposeAdded([cell('2099-11-27', 'FULL_DAY'), cell('2099-11-28', 'EVENING')]);
      fixture.detectChanges();

      expect(comp.composedCells()).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('.calendar-error--compose')?.textContent?.trim()).toBe(
        GRIMOIRE_TONE['partie.ralliement_calendar_compose_full_day'],
      );
    });

    it('moins de deux créneaux ou fin passée : Valider bloqué, rien n’est écrit', async () => {
      const { comp, eventsApi } = await createGroupView({
        party: EVENING_PARTY, userId: HOST, events: [dateless()] });
      comp.startCompose('s1');
      comp.onComposeAdded([cell('2099-11-27', 'EVENING')]);
      expect(comp.composeCanConfirm()).toBe(false);

      comp.onComposeAdded([cell('2099-11-28', 'EVENING')]);
      expect(comp.composeCanConfirm()).toBe(true);
      comp.onComposeDeadlineChanged('2020-01-01');
      expect(comp.composeCanConfirm()).toBe(false);
      await comp.confirmCompose();
      expect(eventsApi.update).not.toHaveBeenCalled();
    });

    it('daté ou lancé ailleurs pendant la composition : message, composer fermé, rien d’écrit', async () => {
      const { comp, eventsApi, fixture } = await createGroupView({
        party: EVENING_PARTY,
        userId: HOST,
        events: [dateless()],
      });
      comp.startCompose('s1');
      comp.onComposeAdded([cell('2099-11-27', 'EVENING'), cell('2099-11-28', 'EVENING')]);
      comp.groupEvents.set([groupCard({ can: HOST_CAN })]); // un vote est apparu ailleurs

      await comp.confirmCompose();
      fixture.detectChanges();

      expect(eventsApi.update).not.toHaveBeenCalled();
      expect(comp.composing()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('.calendar-notice span')?.textContent?.trim(),
      ).toBe(GRIMOIRE_TONE['calendar.compose_link_stale']);
    });

    it('un refus du serveur reste affiché et le composer est conservé', async () => {
      const { comp, eventsApi } = await createGroupView({
        party: EVENING_PARTY, userId: HOST, events: [dateless()] });
      comp.startCompose('s1');
      comp.onComposeAdded([cell('2099-11-27', 'EVENING'), cell('2099-11-28', 'EVENING')]);
      eventsApi.update.mockRejectedValueOnce({ error: { message: 'Soirée terminée.' } });

      await comp.confirmCompose();

      expect(comp.composing()).toBe(true);
      expect(comp.error()).toBe('Soirée terminée.');
    });

    it('qui n’est pas l’hôte : la soirée n’est jamais proposée, aucun composer', async () => {
      const { comp } = await createGroupView({
        party: EVENING_PARTY,
        userId: ME,
        events: [dateless({ can: { propose: false, edit: false, choose: false, extend: false } })],
      });
      expect(comp.rendezvousRows()).toEqual([]);
      comp.startCompose('s1');
      expect(comp.composing()).toBe(false);
    });
  });

  it('Story 45.4 — la fin du vote d’une conjonction : la fin actuelle est montrée, et la fin CHOISIE est celle du PATCH', async () => {
    const card = groupCard({}, { votes: [] });
    const { comp, eventsApi, fixture } = await createGroupView({ userId: HOST, events: [card] });
    comp.startGroupCompose('e1');
    expect(comp.composeHasDeadline()).toBe(true);
    expect(comp.composeDeadline()).toBe(card.poll.expiresAt.substring(0, 10));

    const later = new Date(Date.now() + 40 * 86_400_000).toISOString().substring(0, 10);
    comp.onComposeDeadlineChanged(later);
    fixture.detectChanges();
    await comp.confirmCompose();

    expect(eventsApi.update.mock.calls[0][2].pollDeadline).toBe(later);
  });

  it('Story 45.4 — une fin passée bloque la validation d’une conjonction, avec la raison écrite', async () => {
    const { comp, eventsApi } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    comp.onComposeDeadlineChanged('2020-01-01');

    expect(comp.composeCanConfirm()).toBe(false);
    expect(comp.composeBlockedReason()).toBe(GRIMOIRE_TONE['calendar.compose_deadline_past']);
    await comp.confirmCompose();
    expect(eventsApi.update).not.toHaveBeenCalled();
  });

  it('la journée entière est refusée avec sa raison écrite ; un créneau précis est accepté', async () => {
    const { comp, fixture } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    const before = comp.composedCells().length;

    comp.onComposeToggled(cell('2099-11-27', 'FULL_DAY'));
    fixture.detectChanges();
    expect(comp.composedCells()).toHaveLength(before);
    const refusal = fixture.nativeElement.querySelector('.calendar-error--compose');
    expect(refusal?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['partie.ralliement_calendar_compose_full_day'],
    );

    comp.onComposeToggled(cell('2099-11-27', 'AFTERNOON'));
    fixture.detectChanges();
    expect(comp.composedCells()).toHaveLength(before + 1);
    expect(fixture.nativeElement.querySelector('.calendar-error--compose')).toBeNull();
  });

  it('au moins deux créneaux, sans plafond métier', async () => {
    const { comp } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    comp.composedCells.set([cell('2099-11-24', 'EVENING')]);
    expect(comp.composeCanConfirm()).toBe(false);
    expect(comp.composeBlockedReason()).toBe(
      GRIMOIRE_TONE['partie.ralliement_event_poll_min_hint'],
    );

    // Bien au-delà de la borne 40 d'un vote de JDR.
    comp.composedCells.set(
      Array.from({ length: 60 }, (_, i) =>
        cell(`2099-12-${String((i % 28) + 1).padStart(2, '0')}`, i < 28 ? 'MORNING' : 'EVENING'),
      ),
    );
    expect(comp.composeCanConfirm()).toBe(true);
    expect(comp.composeBlockedReason()).toBe('');
  });

  it('valider sans réponse perdue : un PATCH complet avec les autres champs de la carte, sans date ni créneau', async () => {
    const card = groupCard({}, { votes: [] });
    const { comp, eventsApi, dialog, tick } = await createGroupView({
      userId: HOST,
      events: [card],
    });
    comp.startGroupCompose('e1');
    comp.onComposeToggled(cell('2099-11-27', 'AFTERNOON'));
    await comp.confirmCompose();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(eventsApi.update).toHaveBeenCalledTimes(1);
    const [partieId, eventId, dto] = eventsApi.update.mock.calls[0];
    expect(partieId).toBe('g1');
    expect(eventId).toBe('e1');
    expect(dto).toEqual({
      title: 'Soirée plateaux',
      lieu: 'Chez Léa',
      heureRdv: '19:30',
      notePratique: 'Apportez à boire',
      capacity: 6,
      pollOptions: [
        { date: '2099-11-24', slot: 'EVENING' },
        { date: '2099-11-25', slot: 'MORNING' },
        { date: '2099-11-26', slot: 'EVENING' },
        { date: '2099-11-27', slot: 'AFTERNOON' },
      ],
      pollDeadline: card.poll.expiresAt.substring(0, 10),
    });
    expect('date' in dto).toBe(false);
    expect('slot' in dto).toBe(false);
    await tick();
    expect(comp.composing()).toBe(false);
  });

  it('retirer un créneau déjà voté avertit du nombre de réponses perdues avant d’écrire', async () => {
    const { comp, eventsApi, dialog } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    // o1 porte 2 réponses (HOST oui, OTHER peut-être), o2 une (OTHER non) : on retire o1.
    comp.onComposeToggled(cell('2099-11-24', 'EVENING'));

    dialog.__result = true;
    await comp.confirmCompose();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const data = dialog.open.mock.calls[0][1]!.data;
    expect(data).toMatchObject({
      group: true,
      slotCount: 2,
      removedCount: 1,
      voterCount: 2,
    });
    expect(eventsApi.update).toHaveBeenCalledTimes(1);
    // Les créneaux conservés sont renvoyés tels quels : le serveur leur garde leurs réponses.
    expect(eventsApi.update.mock.calls[0][2].pollOptions).toEqual([
      { date: '2099-11-25', slot: 'MORNING' },
      { date: '2099-11-26', slot: 'EVENING' },
    ]);
  });

  it('des réponses arrivent sur un créneau retiré pendant l’avertissement : rien n’est écrit, le nouveau chiffre est redemandé', async () => {
    const { comp, eventsApi, dialog } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    comp.onComposeToggled(cell('2099-11-24', 'EVENING'));
    const base = groupCard();
    dialog.open.mockImplementationOnce((component: unknown, config?: { data?: any }) => {
      // Pendant que l'avertissement est lu, la liste vivante reçoit une réponse de plus sur o1.
      comp.groupEvents.set([
        groupCard(
          {},
          { votes: [...base.poll.votes, { optionId: 'o1', userId: ME, answer: 'YES' }] },
        ),
      ]);
      return { component, config, afterClosed: () => of(true) } as any;
    });
    await comp.confirmCompose();

    expect(eventsApi.update).not.toHaveBeenCalled();
    expect(comp.error()).toBe(GRIMOIRE_TONE['partie.ralliement_calendar_compose_stale_voters']);
    expect(comp.composing()).toBe(true);
  });

  it('une modification de la carte arrivée pendant l’avertissement n’est pas écrasée : le PATCH part de la carte relue', async () => {
    const { comp, eventsApi, dialog } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    comp.onComposeToggled(cell('2099-11-24', 'EVENING'));
    const base = groupCard();
    dialog.open.mockImplementationOnce((component: unknown, config?: { data?: any }) => {
      comp.groupEvents.set([
        groupCard({
          title: 'Soirée jeux de société',
          seance: { ...base.seance, lieu: 'Chez Max', heureRdv: '20:00', notePratique: null, capacity: 8 },
        }),
      ]);
      return { component, config, afterClosed: () => of(true) } as any;
    });
    await comp.confirmCompose();

    expect(eventsApi.update).toHaveBeenCalledTimes(1);
    expect(eventsApi.update.mock.calls[0][2]).toMatchObject({
      title: 'Soirée jeux de société',
      lieu: 'Chez Max',
      heureRdv: '20:00',
      notePratique: null,
      capacity: 8,
    });
  });

  it('renoncer à l’avertissement n’écrit rien et garde la composition', async () => {
    const { comp, eventsApi, dialog } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    comp.onComposeToggled(cell('2099-11-24', 'EVENING'));
    dialog.__result = null;
    await comp.confirmCompose();

    expect(eventsApi.update).not.toHaveBeenCalled();
    expect(comp.composing()).toBe(true);
    expect(comp.composedCells()).toHaveLength(2);
  });

  it('un 400 du serveur est écrit et la composition reste ouverte', async () => {
    const { comp, eventsApi, fixture, tick } = await createGroupView({
      userId: HOST,
      events: [groupCard({}, { votes: [] })],
    });
    comp.startGroupCompose('e1');
    comp.onComposeToggled(cell('2099-11-27', 'AFTERNOON'));
    eventsApi.update.mockRejectedValueOnce({
      error: { message: 'Un sondage de dates demande au moins deux créneaux.' },
    });
    await comp.confirmCompose();
    await tick();

    expect(comp.composing()).toBe(true);
    expect(fixture.nativeElement.querySelector('.calendar-error')?.textContent?.trim()).toBe(
      'Un sondage de dates demande au moins deux créneaux.',
    );
  });

  it('le sondage devient une date fixée en cours de composition : le mode se ferme', async () => {
    const { comp, eventsApi, scenariosSvc, tick } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    expect(comp.composing()).toBe(true);

    const base = groupCard();
    eventsApi.list.mockResolvedValueOnce([
      groupCard({ seance: { ...base.seance, date: '2099-11-24', slot: 'EVENING' } }),
    ]);
    scenariosSvc.changed.set({ partieId: 'g1' });
    await tick();

    expect(comp.composing()).toBe(false);
    expect(comp.composeTarget()).toBeNull();
  });

  // ── Route réutilisée par Angular sur un simple changement de :id ──

  it('un autre :id (quête) pendant une composition : le groupe est oublié, la composition fermée', async () => {
    const { comp, partiesSvc, eventsApi, tick } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    expect(comp.composing()).toBe(true);
    expect(comp.groupPolls()).toHaveLength(1);

    partiesSvc.get.mockResolvedValue(JDR_PARTY);
    (TestBed.inject(ActivatedRoute) as any).paramMap.next(convertToParamMap({ id: 'p1' }));
    await tick();

    expect(comp.isGroup()).toBe(false);
    expect(comp.composing()).toBe(false);
    expect(comp.groupPolls()).toEqual([]);
    expect(eventsApi.list).toHaveBeenCalledTimes(1);
  });

  it('Story 41.2 : une soirée isolée (ONE_SHOT) est traitée comme un groupe — ses conjonctions sont lues', async () => {
    const { comp, eventsApi } = await createGroupView({
      userId: HOST,
      party: { ...GROUP_PARTY, kind: 'ONE_SHOT' },
    });

    expect(comp.isGroup()).toBe(true);
    expect(eventsApi.list).toHaveBeenCalledWith('g1');
  });

  it('un autre :id (autre groupe) : conjonctions relues pour lui, composition fermée', async () => {
    const { comp, eventsApi, tick } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    eventsApi.list.mockResolvedValue([groupCard({ id: 'e2', title: 'Autre groupe' }, { id: 'p2' })]);
    (TestBed.inject(ActivatedRoute) as any).paramMap.next(convertToParamMap({ id: 'g2' }));
    await tick();

    expect(eventsApi.list).toHaveBeenLastCalledWith('g2');
    expect(comp.isGroup()).toBe(true);
    expect(comp.composing()).toBe(false);
    expect(comp.groupPolls().map((e: any) => e.card.id)).toEqual(['e2']);
  });

  // ── Aller-retour de la fenêtre de création ──

  const DRAFT = {
    partieId: 'g1',
    title: 'Brunch du dimanche',
    pollOptions: [
      { date: '2099-11-24', slot: 'EVENING' as const },
      { date: '2099-11-25', slot: 'MORNING' as const },
    ],
    pollDeadline: '2099-11-20',
    lieu: 'Parc',
    heureRdv: '11:00',
    notePratique: '',
    participation: 'all' as const,
    places: 4,
    reserved: [],
  };
  const sendDraft = () => TestBed.inject(ConjonctionDraftService).beginCompose(DRAFT);

  it('la fenêtre de création envoie son brouillon : composition d’une nouvelle conjonction, sans appel au serveur', async () => {
    const { comp, eventsApi, fixture } = await createGroupView({ beforeCreate: sendDraft });

    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'group-new' });
    expect(comp.composedCells()).toHaveLength(2);
    // Vue Mois par défaut sur ordinateur : armer passe en Semaine, sur le premier créneau du brouillon.
    expect(comp.view()).toBe('week');
    expect(comp.sharedDate().toISOString().substring(0, 10)).toBe('2099-11-24');
    expect(comp.composeTargetLabel()).toBe(
      GRIMOIRE_TONE['partie.ralliement_calendar_compose_target_new'],
    );
    expect(fixture.nativeElement.querySelector('app-compose-bar')).not.toBeNull();
    expect(eventsApi.update).not.toHaveBeenCalled();
  });

  it('valider : les créneaux rejoignent le brouillon, retour à la page du groupe', async () => {
    const { comp, navigate, drafts, eventsApi, dialog } = await createGroupView({
      beforeCreate: sendDraft,
    });
    comp.onComposeToggled(cell('2099-11-26', 'AFTERNOON'));
    await comp.confirmCompose();

    expect(eventsApi.update).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenLastCalledWith(['/parties', 'g1'], { replaceUrl: true });
    expect(comp.composing()).toBe(false);
    const back = drafts.takeReopen('g1');
    expect(back?.title).toBe('Brunch du dimanche');
    expect(back?.pollOptions).toEqual([
      { date: '2099-11-24', slot: 'EVENING' },
      { date: '2099-11-25', slot: 'MORNING' },
      { date: '2099-11-26', slot: 'AFTERNOON' },
    ]);
  });

  it('annuler (ou « Retour ») : le brouillon revient intact', async () => {
    const first = await createGroupView({ beforeCreate: sendDraft });
    first.comp.onComposeToggled(cell('2099-11-26', 'AFTERNOON'));
    first.comp.cancelCompose();
    expect(first.navigate).toHaveBeenLastCalledWith(['/parties', 'g1'], { replaceUrl: true });
    expect(first.drafts.takeReopen('g1')?.pollOptions).toEqual(DRAFT.pollOptions);
    TestBed.resetTestingModule();

    const second = await createGroupView({ beforeCreate: sendDraft });
    second.comp.goBack();
    expect(second.navigate).toHaveBeenLastCalledWith(['/parties', 'g1'], { replaceUrl: true });
    expect(second.drafts.takeReopen('g1')?.title).toBe('Brunch du dimanche');
  });

  it('quitter la page en pleine composition (retour du navigateur) rend le brouillon : la fenêtre de création le retrouvera', async () => {
    const { fixture, drafts } = await createGroupView({ beforeCreate: sendDraft });
    expect(drafts.takeReopen('g1')).toBeNull();

    fixture.destroy();

    expect(drafts.takeReopen('g1')?.title).toBe('Brunch du dimanche');
  });

  it('sans brouillon en attente, la page ne compose rien d’elle-même', async () => {
    const { comp } = await createGroupView();
    expect(comp.composing()).toBe(false);
  });

  // ── ⚠️ Story 47.4 — la durée dans le composer d'un groupe ──

  it('Story 47.4 — le brouillon porte sa durée dans les deux sens (fenêtre de création ↔ composer)', async () => {
    const { comp, drafts } = await createGroupView({
      beforeCreate: () =>
        TestBed.inject(ConjonctionDraftService).beginCompose({ ...DRAFT, durationSlots: 4 }),
    });
    expect(comp.composeDuration()).toBe(4);

    comp.onComposeDurationChanged(5);
    await comp.confirmCompose();

    expect(drafts.takeReopen('g1')?.durationSlots).toBe(5);
  });

  it('Story 47.4 — vote ouvert d’une conjonction, durée 1 → 2 : toutes les réponses annoncées, puis le PATCH porte la durée', async () => {
    const { comp, eventsApi, dialog } = await createGroupView({ userId: HOST });
    comp.startGroupCompose('e1');
    expect(comp.composeDuration()).toBe(1);
    comp.onComposeDurationChanged(2);
    dialog.__result = true;

    await comp.confirmCompose();

    expect(dialog.open.mock.calls[0][1]!.data).toMatchObject({
      group: true,
      removedCount: 0,
      voterCount: 3,
      durationChanged: true,
    });
    expect(eventsApi.update).toHaveBeenCalledTimes(1);
    expect(eventsApi.update.mock.calls[0][2]).toMatchObject({
      pollOptions: [
        { date: '2099-11-24', slot: 'EVENING' },
        { date: '2099-11-25', slot: 'MORNING' },
        { date: '2099-11-26', slot: 'EVENING' },
      ],
      durationSlots: 2,
    });
  });

  it('Story 47.4 — une option du sondage d’une conjonction de 3 créneaux porte sa fin dans l’agenda', async () => {
    const { comp } = await createGroupView({
      events: [groupCard({}, { durationSlots: 3 })],
    });

    const entry = comp.allCalendarEntries().find((e: any) => e.key === 'poll-p1-o1');
    expect(entry).toMatchObject({
      date: '2099-11-24',
      slot: 'EVENING',
      endDate: '2099-11-25',
      endSlot: 'AFTERNOON',
    });
  });

  it('Story 47.4 — durée gardée : le PATCH n’emporte pas `durationSlots`', async () => {
    const { comp, eventsApi } = await createGroupView({
      userId: HOST,
      events: [groupCard({}, { votes: [], durationSlots: 3 })],
    });
    comp.startGroupCompose('e1');
    expect(comp.composeDuration()).toBe(3);
    comp.onComposeToggled(cell('2099-11-27', 'AFTERNOON'));

    await comp.confirmCompose();

    expect('durationSlots' in eventsApi.update.mock.calls[0][2]).toBe(false);
  });

  // ── Le plateau de la destinée (Story 44.4) ──

  const GROUP_POLL_ENTRY = (over: Partial<OpenPollEntry> = {}): OpenPollEntry => ({
    pollId: 'p1',
    partieId: 'g1',
    partieName: 'La Bande',
    family: 'ralliement',
    kind: 'CAMPAGNE_EPISODIQUE',
    seanceId: 's1',
    title: 'Soirée plateaux',
    expiresAt: null,
    durationSlots: 1,
    options: [
      { optionId: 'o1', date: '2099-11-24', slot: 'EVENING', yes: 1, maybe: 1, no: 0, myAnswer: null },
      { optionId: 'o2', date: '2099-11-25', slot: 'MORNING', yes: 0, maybe: 0, no: 1, myAnswer: null },
    ],
    eligibleCount: 3,
    answeredCount: 2,
    me: { eligible: true, answered: false },
    can: NO_CAN,
    ...over,
  });
  const MEMBERS = [
    { userId: HOST, pseudo: 'lea', displayName: 'Léa' },
    { userId: ME, pseudo: 'moi', displayName: 'Moi' },
    { userId: OTHER, pseudo: 'tom', displayName: 'Tom' },
  ];

  it('plateau : l’organisateur d’un groupe voit les NOMS de qui n’a pas répondu, les membres sont lus à ce moment-là', async () => {
    const { comp, fixture, tick, partiesSvc } = await createGroupView({
      userId: HOST,
      members: MEMBERS,
      openPolls: [GROUP_POLL_ENTRY({ can: HOST_CAN })],
    });
    expect(partiesSvc.members).not.toHaveBeenCalled();

    comp.chooseDestiny('p1');
    await tick();

    expect(partiesSvc.members).toHaveBeenCalledWith('g1');
    const absent = fixture.nativeElement.querySelector('.destiny-board__absent') as HTMLElement;
    // `ME` n'a répondu à aucune option : seul absent (l'hôte et l'autre membre ont voté).
    expect(absent.textContent).toContain('Moi');
    expect(absent.textContent).not.toContain('Tom');
    expect(absent.textContent).not.toContain('Léa');
  });

  it('plateau : un simple membre d’un groupe ne voit que le nombre, et ne déclenche aucune lecture des membres', async () => {
    const { comp, fixture, tick, partiesSvc } = await createGroupView({
      members: MEMBERS,
      openPolls: [GROUP_POLL_ENTRY()],
    });

    comp.chooseDestiny('p1');
    await tick();

    expect(partiesSvc.members).not.toHaveBeenCalled();
    const absent = fixture.nativeElement.querySelector('.destiny-board__absent') as HTMLElement;
    expect(absent.textContent).toContain('1 n’a pas encore répondu');
    expect(absent.textContent).not.toContain('Moi');
    expect(fixture.nativeElement.querySelector('.destiny-board__who')).toBeNull();
  });

  // ── Conclure le vote depuis le plateau (Story 44.6) ──

  /** Les créneaux (o1 : 1 oui 1 peut-être ; o2 : 0 oui 1 non) comptés par l'entrée servie. */
  const fixButton = (fixture: any) =>
    fixture.nativeElement.querySelector('.destiny-board__fix') as HTMLButtonElement | null;
  const extendButton = (fixture: any) =>
    fixture.nativeElement.querySelector('.destiny-board__extend') as HTMLButtonElement | null;

  it('44.6 : l’hôte fixe la date par DateFixDialog, le meilleur créneau en tête, puis la liste est relue', async () => {
    const { comp, fixture, tick, dialog, pollSvc, eventsApi, openPollsSvc } = await createGroupView({
      userId: HOST,
      members: MEMBERS,
      openPolls: [GROUP_POLL_ENTRY({ can: HOST_CAN })],
    });
    comp.chooseDestiny('p1');
    await tick();
    dialog.__result = true;
    const listed = eventsApi.list.mock.calls.length;

    fixButton(fixture)!.click();
    await tick();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: any }];
    expect(component).toBe(DateFixDialog);
    expect(config.data.title).toBe('Soirée plateaux');
    expect(config.data.slots.map((s: any) => s.id)).toEqual(['o1', 'o2']);

    await config.data.confirm('o1');
    expect(pollSvc.chooseDate).toHaveBeenCalledWith('g1', 'p1', { optionId: 'o1' });
    // Confirmé : l'atelier relit ses conjonctions et mes sondages ouverts.
    expect(eventsApi.list.mock.calls.length).toBeGreaterThan(listed);
    expect(openPollsSvc.refresh).toHaveBeenCalled();
  });

  it('44.6 : l’hôte prolonge le vote par ExtendVoteDialog (écriture par la route partagée)', async () => {
    const { comp, fixture, tick, dialog, eventsApi } = await createGroupView({
      userId: HOST,
      members: MEMBERS,
      openPolls: [GROUP_POLL_ENTRY({ can: HOST_CAN, expiresAt: '2099-11-20T00:00:00.000Z' })],
    });
    comp.chooseDestiny('p1');
    await tick();

    extendButton(fixture)!.click();
    await tick();

    const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: any }];
    expect(component).toBe(ExtendVoteDialog);
    expect(config.data.deadlineKey).toBe('2099-11-20');
    expect(config.data.minKey).toBe('2099-11-21');
    await config.data.confirm('2099-12-01');
    expect(eventsApi.extend).toHaveBeenCalledWith('g1', 'p1', '2099-12-01');
  });

  it('44.6 : sans droit d’organisateur, aucune action n’est offerte', async () => {
    const { comp, fixture, tick } = await createGroupView({ openPolls: [GROUP_POLL_ENTRY()] });
    comp.chooseDestiny('p1');
    await tick();
    expect(fixture.nativeElement.querySelector('.destiny-board__actions')).toBeNull();
  });

  it('44.6 : atelier d’un groupe, le message dit pourquoi le vote est clos (date fixée, annulé, autre)', async () => {
    const { comp, fixture, tick } = await createGroupView({
      userId: HOST,
      members: MEMBERS,
      openPolls: [GROUP_POLL_ENTRY({ can: HOST_CAN })],
    });
    const notice = () =>
      fixture.nativeElement.querySelector('.calendar-notice span')?.textContent?.trim() ?? null;
    const dated = { ...groupCard().seance, date: '2099-11-24', slot: 'EVENING' };
    const cases: [any[], string][] = [
      [[groupCard({ seance: dated }, { status: 'CLOSED' })], 'Ce vote est clos : sa date est fixée.'],
      [[groupCard({ cancelled: true }, { status: 'CLOSED' })], 'Ce vote est clos : le rendez-vous est annulé.'],
      [[], 'Ce vote est clos.'],
    ];
    for (const [events, expected] of cases) {
      comp.groupEvents.set(groupCard().poll ? [groupCard()] : []);
      comp.chooseDestiny('p1');
      await tick();
      expect(notice()).toBeNull();

      comp.groupEvents.set(events);
      await tick();
      expect(comp.destinyPollId()).toBeNull();
      expect(notice()).toBe(expected);
    }
  });

  it('44.7 UJ-3 : un lien ?poll arrive en Semaine, Destinée active, tiroir replié, sur le premier créneau à venir', async () => {
    const { comp, location } = await createGroupView({
      openPolls: [GROUP_POLL_ENTRY()],
      queryParams: { poll: 'p1' },
    });

    expect(comp.destinyPollId()).toBe('p1');
    expect(comp.view()).toBe('week');
    expect(comp.destinySheetExpanded()).toBe(false);
    expect(comp.destinyOptionId()).toBe('o1');
    expect(location.path()).toContain('poll=p1');
  });

  it('plateau : il remplace la colonne de 340 px du groupe, qui revient à la sortie de la Destinée', async () => {
    const { comp, fixture, tick } = await createGroupView({
      openPolls: [GROUP_POLL_ENTRY()],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.group-polls')).not.toBeNull();
    expect(root.querySelector('app-destiny-board')).toBeNull();

    comp.chooseDestiny('p1');
    await tick();
    expect(root.querySelector('.group-polls')).toBeNull();
    expect(root.querySelector('.destiny-board-col:not(.destiny-board-col--partie) app-destiny-board')).not.toBeNull();

    comp.quitDestiny();
    await tick();
    expect(root.querySelector('.group-polls')).not.toBeNull();
    expect(root.querySelector('app-destiny-board')).toBeNull();
  });
});

// ─── Story 44.4 — le plateau de la destinée ───────────────────────────────────

describe('CalendarView — le plateau de la destinée (Story 44.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  /** Une option dans le futur lointain : « à venir » quelle que soit la date d'exécution. */
  const opt = (optionId: string, date: string, yes = 0, maybe = 0) => ({
    optionId,
    date,
    slot: 'EVENING' as const,
    yes,
    maybe,
    no: 0,
    myAnswer: null,
  });

  const poll = (over: Partial<OpenPollEntry> = {}) =>
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-A',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 5,
      answeredCount: 2,
      // Volontairement dans le désordre : le plateau les range dans l'ordre chronologique.
      options: [opt('a2', '2030-03-06', 1), opt('a1', '2030-03-04', 0, 1), opt('a3', '2030-03-08', 3, 2)],
      ...over,
    });

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;
  const board = (fixture: any) => root(fixture).querySelector('app-destiny-board');
  const column = (fixture: any) => root(fixture).querySelector('.destiny-board-col');

  it('vitrine : une colonne de 340 px apparaît avec la Destinée et disparaît avec elle', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    const comp = fixture.componentInstance as any;
    expect(column(fixture)).toBeNull();

    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(column(fixture)).not.toBeNull();
    expect(column(fixture)!.classList).not.toContain('destiny-board-col--partie');
    expect(board(fixture)).not.toBeNull();

    comp.quitDestiny();
    await tick(fixture);
    expect(column(fixture)).toBeNull();
  });

  it('le plateau dit le titre, la fin du vote, les réponses, et range les créneaux dans l’ordre chronologique', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny-board__title')!.textContent).toContain('Chapitre 4');
    expect(root(fixture).querySelector('.destiny-board__subtitle')!.textContent!.trim()).toMatch(
      /^Fin du vote .+ · 2 réponses sur 5$/,
    );
    expect(comp.destinyBoard().slots.map((s: any) => s.optionId)).toEqual(['a1', 'a2', 'a3']);
    expect(root(fixture).querySelectorAll('.destiny-board__slot')).toHaveLength(3);
  });

  it('« meilleur » ne va qu’au meilleur créneau, et le créneau courant est entouré', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);

    const rows = Array.from(root(fixture).querySelectorAll<HTMLElement>('.destiny-board__slot'));
    expect(root(fixture).querySelectorAll('.destiny-board__best')).toHaveLength(1);
    expect(rows[2].querySelector('.destiny-board__best')).not.toBeNull();
    // Vote encore ouvert : la Destinée s'est ouverte sur le premier créneau à venir.
    expect(rows[0].getAttribute('aria-current')).toBe('true');
    expect(rows[0].classList).toContain('destiny-board__slot--current');
    expect(rows[2].getAttribute('aria-current')).toBeNull();
  });

  it('sans aucun « oui », « meilleur » n’apparaît nulle part', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ options: [opt('a1', '2030-03-04', 0, 2), opt('a2', '2030-03-06')] })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny-board__best')).toBeNull();
  });

  it('un vote terminé : « Vote terminé le … · plus de vote possible », les créneaux restent parcourables', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ expiresAt: '2020-01-01T00:00:00.000Z' })],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny-board__subtitle')!.textContent).toMatch(
      /^\s*Vote terminé le .+ · plus de vote possible\s*$/,
    );
    // Après la fin du vote, la Destinée s'ouvre sur le meilleur créneau.
    expect(comp.destinyOptionId()).toBe('a3');
    comp.destinyPrev();
    expect(comp.destinyOptionId()).toBe('a2');
  });

  it('sans échéance, le sous-titre ne dit que les réponses', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ expiresAt: null, answeredCount: 1 })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny-board__subtitle')!.textContent!.trim()).toBe(
      '1 réponse sur 5',
    );
  });

  it('pas de plateau sous 768 px : la colonne habituelle reste', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      desktop: false,
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1' })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll1');
    await tick(fixture);

    expect(board(fixture)).toBeNull();
    expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();
  });

  it('ni dans l’Agenda, ni pendant la composition : la colonne habituelle revient', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1', can: ORGANIZER })],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll1');
    await tick(fixture);
    expect(board(fixture)).not.toBeNull();
    expect(root(fixture).querySelector('.mj-results-panel')).toBeNull();

    comp.composing.set(true);
    await tick(fixture);
    expect(board(fixture)).toBeNull();
    expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();
    comp.composing.set(false);

    comp.onViewChange('agenda');
    await tick(fixture);
    expect(board(fixture)).toBeNull();
    // Le mode n'est pas défait : revenir à la grille retrouve le plateau.
    comp.onViewChange('month');
    await tick(fixture);
    expect(board(fixture)).not.toBeNull();
  });

  it('atelier MJ : le plateau remplace la colonne MJ (40 %), qui revient à la sortie de la Destinée', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1', can: ORGANIZER })],
    });
    const comp = fixture.componentInstance as any;
    expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();

    comp.chooseDestiny('poll1');
    await tick(fixture);
    expect(root(fixture).querySelector('.mj-results-panel')).toBeNull();
    expect(root(fixture).querySelector('.destiny-board-col--partie app-destiny-board')).not.toBeNull();

    comp.quitDestiny();
    await tick(fixture);
    expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();
    expect(board(fixture)).toBeNull();
  });

  it('atelier joueur : le plateau remplace la colonne des créneaux de la guilde', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1' })],
    });
    const comp = fixture.componentInstance as any;
    expect(root(fixture).querySelector('.guild-slots-panel')).not.toBeNull();

    comp.chooseDestiny('poll1');
    await tick(fixture);
    expect(root(fixture).querySelector('.guild-slots-panel')).toBeNull();
    expect(board(fixture)).not.toBeNull();

    comp.quitDestiny();
    await tick(fixture);
    expect(root(fixture).querySelector('.guild-slots-panel')).not.toBeNull();
  });

  it('atelier MJ organisateur : « N’ont pas … » nomme celles et ceux qui n’ont pas répondu', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      // `me` et `u3` n'ont voté que sur l'une des deux options, `u4` sur aucune ; `u2` a tout répondu.
      members: [
        { userId: 'me', pseudo: 'moi', displayName: 'Moi' },
        { userId: 'u2', pseudo: 'bob', displayName: 'Bob' },
        { userId: 'u3', pseudo: 'cyd', displayName: 'Cyd' },
        { userId: 'u4', pseudo: 'dan', displayName: 'Dan' },
      ],
      openPolls: [
        poll({
          pollId: 'poll1',
          partieId: 'partie-1',
          can: ORGANIZER,
          eligibleCount: 4,
          answeredCount: 1,
        }),
      ],
    });
    (fixture.componentInstance as any).chooseDestiny('poll1');
    await tick(fixture);

    const absent = root(fixture).querySelector('.destiny-board__absent')!.textContent!;
    expect(absent).toContain('N’ont pas consulté l’oracle');
    expect(absent).toContain('Cyd');
    expect(absent).toContain('Dan');
    expect(absent).not.toContain('Bob');
  });

  it('atelier, sans droit d’organisateur : le nombre, jamais un nom', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      members: [{ userId: 'u4', pseudo: 'dan', displayName: 'Dan' }],
      openPolls: [
        poll({ pollId: 'poll1', partieId: 'partie-1', eligibleCount: 4, answeredCount: 1 }),
      ],
    });
    (fixture.componentInstance as any).chooseDestiny('poll1');
    await tick(fixture);

    const absent = root(fixture).querySelector('.destiny-board__absent')!.textContent!;
    expect(absent).toContain('3 n’ont pas encore répondu');
    expect(absent).not.toContain('Dan');
    expect(root(fixture).querySelector('.destiny-board__who')).toBeNull();
  });

  it('vitrine, organisateur : le nombre et « voir qui » — jamais un nom — qui mène à la page de la partie', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ can: ORGANIZER })],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    const absent = root(fixture).querySelector('.destiny-board__absent')!;
    expect(absent.textContent).toContain('3 n’ont pas encore répondu');
    const who = absent.querySelector('.destiny-board__who') as HTMLButtonElement;
    expect(who.textContent!.trim()).toBe('voir qui');

    who.click();
    expect(navigate).toHaveBeenCalledWith('/parties/partie-A/calendar?poll=poll-a');
  });

  it('vitrine, sans droit d’organisateur : le nombre seulement ; tout le monde a répondu : aucune ligne', async () => {
    const { fixture, openPollsSvc } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll()],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny-board__absent')!.textContent).toContain(
      '3 n’ont pas encore répondu',
    );
    expect(root(fixture).querySelector('.destiny-board__who')).toBeNull();

    openPollsSvc.entries.set([poll({ answeredCount: 5 })]);
    await tick(fixture);
    expect(root(fixture).querySelector('.destiny-board__absent')).toBeNull();
  });

  it('une personne qui ne vote pas lit quand même le plateau', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ me: { eligible: false, answered: false } })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(board(fixture)).not.toBeNull();
  });

  it('‹ n/N › parcourent les CRÉNEAUX du vote actif, en boucle, et annoncent le créneau courant', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);
    const nav = () => root(fixture).querySelector('.destiny__nav')!.textContent!;
    const live = () => root(fixture).querySelector('.destiny-board__sr')!.textContent!;

    expect(nav()).toContain('1 / 3');
    comp.destinyNext();
    await tick(fixture);
    expect(comp.destinyOptionId()).toBe('a2');
    expect(nav()).toContain('2 / 3');
    expect(live()).toBe('Créneau 2 sur 3, mercredi 6 mars, soir, 1 oui');

    comp.destinyNext();
    comp.destinyNext();
    await tick(fixture);
    expect(comp.destinyOptionId()).toBe('a1');
    comp.destinyPrev();
    await tick(fixture);
    expect(comp.destinyOptionId()).toBe('a3');
    expect(nav()).toContain('3 / 3');
    // Le vote reste le même : les chevrons ne changent plus de vote.
    expect(comp.destinyPollId()).toBe('poll-a');
  });

  it('un seul créneau : pas de chevrons', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ options: [opt('a1', '2030-03-04')] })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(root(fixture).querySelector('.destiny__nav')).toBeNull();
  });

  it('toucher un créneau du plateau le rend courant et place la grille sur son mois', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll({ options: [opt('c1', '2030-03-04'), opt('c2', '2030-05-10')] })],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(comp.sharedDate().toISOString().substring(0, 7)).toBe('2030-03');

    (root(fixture).querySelectorAll('.destiny-board__slot')[1] as HTMLButtonElement).click();
    await tick(fixture);

    expect(comp.destinyOptionId()).toBe('c2');
    expect(comp.sharedDate().toISOString().substring(0, 7)).toBe('2030-05');
    expect(
      root(fixture).querySelectorAll('.destiny-board__slot')[1].getAttribute('aria-current'),
    ).toBe('true');
  });

  it('un créneau du mois déjà affiché ne relit pas le calendrier', async () => {
    const { fixture, availabilitySvc } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll()],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);
    const calls = availabilitySvc.getMyCalendar.mock.calls.length;

    comp.destinyNext();
    comp.destinyNext();
    await tick(fixture);

    expect(comp.destinyOptionId()).toBe('a3');
    expect(availabilitySvc.getMyCalendar.mock.calls.length).toBe(calls);
  });

  it('le créneau courant retiré d’un vote toujours ouvert : la Destinée se replace sur le créneau d’entrée', async () => {
    const { fixture, openPollsSvc } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll()],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    comp.destinyNext();
    await tick(fixture);
    expect(comp.destinyOptionId()).toBe('a2');

    openPollsSvc.entries.set([poll({ options: [opt('a1', '2030-03-04'), opt('a3', '2030-03-08')] })]);
    await tick(fixture);

    expect(comp.destinyPollId()).toBe('poll-a');
    expect(comp.destinyOptionId()).toBe('a1');
  });

  it('en direct : les comptes d’un autre vote se mettent à jour', async () => {
    const { fixture, openPollsSvc } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll()],
    });
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);
    const yes = () => root(fixture).querySelectorAll('.destiny-board__yes')[0].textContent!.trim();
    expect(yes()).toBe('0 oui');

    openPollsSvc.entries.set([
      poll({ answeredCount: 3, options: [opt('a1', '2030-03-04', 4), opt('a2', '2030-03-06', 1)] }),
    ]);
    await tick(fixture);

    expect(yes()).toBe('4 oui');
    expect(root(fixture).querySelector('.destiny-board__subtitle')!.textContent).toContain(
      '3 réponses sur 5',
    );
  });

  it('atelier : tant qu’une Destinée est active, le signal partie: relit mes sondages ouverts — sinon non', async () => {
    const { fixture, scenariosSvc, openPollsSvc } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1' })],
    });
    const comp = fixture.componentInstance as any;
    const before = openPollsSvc.refresh.mock.calls.length;

    scenariosSvc.changed.set({ partieId: 'partie-1' });
    await tick(fixture);
    expect(openPollsSvc.refresh.mock.calls.length).toBe(before);

    comp.chooseDestiny('poll1');
    scenariosSvc.changed.set({ partieId: 'partie-1' });
    await tick(fixture);
    expect(openPollsSvc.refresh.mock.calls.length).toBeGreaterThan(before);
  });
});

// ─── Story 44.5 — le tiroir de la destinée, sous 768 px ───────────────────────

describe('CalendarView — le tiroir de la destinée (Story 44.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  const opt = (optionId: string, date: string, yes = 0, maybe = 0) => ({
    optionId,
    date,
    slot: 'EVENING' as const,
    yes,
    maybe,
    no: 0,
    myAnswer: null,
  });

  const poll = (over: Partial<OpenPollEntry> = {}) =>
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-A',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 5,
      answeredCount: 2,
      options: [opt('a2', '2030-03-06', 1), opt('a1', '2030-03-04', 0, 1), opt('a3', '2030-03-08', 3, 2)],
      ...over,
    });

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;
  const sheet = (fixture: any) => root(fixture).querySelector('app-destiny-sheet');
  const summary = (fixture: any) =>
    root(fixture).querySelector('.destiny-sheet__summary')!.textContent!.trim();
  const toggle = (fixture: any) =>
    root(fixture).querySelector<HTMLButtonElement>('.destiny-sheet__toggle')!;

  /** Un calendrier personnel étroit (< 768 px) avec la Destinée sur le vote donné. */
  async function narrow(entry: OpenPollEntry = poll()) {
    const ctx = await createCalendarView({ mode: 'personal', desktop: false, openPolls: [entry] });
    (ctx.fixture.componentInstance as any).chooseDestiny(entry.pollId);
    await tick(ctx.fixture);
    return ctx;
  }

  it('sous 768 px, choisir un vote ouvre le tiroir replié ; pas de plateau en colonne', async () => {
    const { fixture } = await narrow();
    expect(sheet(fixture)).not.toBeNull();
    expect(root(fixture).querySelector('app-destiny-board')).toBeNull();
    expect(root(fixture).querySelector('.destiny-board-col')).toBeNull();
    expect(root(fixture).querySelector('.destiny-sheet__title')!.textContent).toContain('Chapitre 4');
    expect(toggle(fixture).textContent).toContain('Voir les 3 dates');
    expect(
      root(fixture).querySelector('.destiny-sheet__handle')!.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('la région est nommée « Destinée : {nom} »', async () => {
    const { fixture } = await narrow();
    expect(sheet(fixture)!.querySelector('[role="region"]')!.getAttribute('aria-label')).toBe(
      'Destinée : Chapitre 4',
    );
  });

  it('le résumé dit n / N, le créneau, les oui et la fin du vote', async () => {
    const { fixture } = await narrow();
    expect(summary(fixture)).toMatch(/^1 \/ 3 · .+ soir · 0 oui · fin du vote .+$/);
  });

  it('un vote terminé : « vote terminé » ; sans échéance : aucune fin de vote', async () => {
    const ended = await narrow(poll({ expiresAt: '2020-01-01T00:00:00.000Z' }));
    // Après la fin du vote, la Destinée s'ouvre sur le meilleur créneau (3 oui).
    expect(summary(ended.fixture)).toMatch(/^3 \/ 3 · .+ soir · 3 oui · vote terminé$/);
    TestBed.resetTestingModule();

    const open = await narrow(poll({ expiresAt: null }));
    expect(summary(open.fixture)).toMatch(/^1 \/ 3 · .+ soir · 0 oui$/);
    expect(summary(open.fixture)).not.toContain('fin du vote');
  });

  it('la pastille dit mon état : À faire, Répondu, Organisateur, Vous ne votez pas', async () => {
    const cases: [Partial<OpenPollEntry>, string][] = [
      [{ me: { eligible: true, answered: false } }, 'À faire'],
      [{ me: { eligible: true, answered: true } }, 'Répondu'],
      [{ can: ORGANIZER }, 'Organisateur'],
      [{ me: { eligible: false, answered: false } }, 'Vous ne votez pas'],
    ];
    for (const [over, label] of cases) {
      const { fixture } = await narrow(poll(over));
      expect(root(fixture).querySelector('.destiny-sheet__pill')!.textContent!.trim(), label).toBe(
        label,
      );
      TestBed.resetTestingModule();
    }
  });

  it('« Voir les N dates » déplie le plateau complet, « Replier » le referme ; la poignée fait de même', async () => {
    const { fixture } = await narrow();
    const handle = () => root(fixture).querySelector<HTMLButtonElement>('.destiny-sheet__handle')!;

    toggle(fixture).click();
    await tick(fixture);
    expect(root(fixture).querySelectorAll('.destiny-board__slot')).toHaveLength(3);
    expect(toggle(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(toggle(fixture).textContent).toContain('Replier');

    handle().click();
    await tick(fixture);
    expect(root(fixture).querySelector('app-destiny-board')).toBeNull();
    expect(toggle(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  it('une seule région aria-live dans le tiroir, replié ou déplié', async () => {
    const { fixture } = await narrow();
    const live = () => sheet(fixture)!.querySelectorAll('[aria-live="polite"]');
    expect(live()).toHaveLength(1);
    toggle(fixture).click();
    await tick(fixture);
    expect(live()).toHaveLength(1);
  });

  it('parcourir les créneaux met le résumé à jour ; toucher un créneau déplié garde le tiroir ouvert', async () => {
    const { fixture } = await narrow();
    const comp = fixture.componentInstance as any;
    comp.destinyNext();
    await tick(fixture);
    expect(summary(fixture)).toMatch(/^2 \/ 3 · .+ soir · 1 oui/);
    expect(root(fixture).querySelector('.destiny-sheet__sr')!.textContent).toContain(
      'Créneau 2 sur 3',
    );

    toggle(fixture).click();
    await tick(fixture);
    root(fixture).querySelectorAll<HTMLButtonElement>('.destiny-board__slot')[2].click();
    await tick(fixture);
    expect(comp.destinyOptionId()).toBe('a3');
    expect(comp.destinySheetExpanded()).toBe(true);
  });

  it('le tiroir s’ouvre replié à chaque entrée, et disparaît avec la Destinée', async () => {
    const { fixture } = await narrow();
    const comp = fixture.componentInstance as any;
    comp.toggleDestinySheet();
    await tick(fixture);
    expect(comp.destinySheetExpanded()).toBe(true);

    comp.quitDestiny();
    await tick(fixture);
    expect(sheet(fixture)).toBeNull();

    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(sheet(fixture)).not.toBeNull();
    expect(comp.destinySheetExpanded()).toBe(false);
  });

  it('pas de tiroir à partir de 768 px (le plateau le remplace), ni dans l’Agenda, ni en composition', async () => {
    const wide = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    (wide.fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(wide.fixture);
    expect(sheet(wide.fixture)).toBeNull();
    expect(root(wide.fixture).querySelector('app-destiny-board')).not.toBeNull();
    TestBed.resetTestingModule();

    const { fixture } = await narrow();
    const comp = fixture.componentInstance as any;
    comp.composing.set(true);
    await tick(fixture);
    expect(sheet(fixture)).toBeNull();
    comp.composing.set(false);

    comp.onViewChange('agenda');
    await tick(fixture);
    expect(sheet(fixture)).toBeNull();
    // Le mode n'est pas défait : revenir à la grille retrouve le tiroir.
    comp.onViewChange('month');
    await tick(fixture);
    expect(sheet(fixture)).not.toBeNull();
  });

  it('la colonne habituelle reste empilée sous la grille', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      desktop: false,
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1', can: ORGANIZER })],
    });
    (fixture.componentInstance as any).chooseDestiny('poll1');
    await tick(fixture);
    expect(sheet(fixture)).not.toBeNull();
    expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();
  });

  it('organisateur, vitrine : « voir qui » du tiroir déplié mène à la page de la partie', async () => {
    const { fixture } = await narrow(poll({ can: ORGANIZER }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    toggle(fixture).click();
    await tick(fixture);

    const who = root(fixture).querySelector<HTMLButtonElement>('.destiny-board__who')!;
    expect(who.textContent!.trim()).toBe('voir qui');
    who.click();
    expect(navigate).toHaveBeenCalledWith('/parties/partie-A/calendar?poll=poll-a');
  });

  it('le tiroir fait de la place : la page reçoit une marge basse, replié ou déplié', async () => {
    const { fixture } = await narrow();
    const page = () => root(fixture).querySelector('.calendar-page')!;
    expect(page().classList).toContain('calendar-page--sheet');
    toggle(fixture).click();
    await tick(fixture);
    expect(page().classList).toContain('calendar-page--sheet-open');
    expect(page().classList).not.toContain('calendar-page--sheet');
  });
});


// ─── Story 44.6 — fixer la date ou prolonger le vote depuis le plateau ────────

describe('CalendarView — conclure le vote depuis le plateau (Story 44.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  const opt = (optionId: string, date: string, yes = 0, maybe = 0) => ({
    optionId,
    date,
    slot: 'EVENING' as const,
    yes,
    maybe,
    no: 0,
    myAnswer: null,
  });

  const poll = (over: Partial<OpenPollEntry> = {}) =>
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-A',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 5,
      answeredCount: 2,
      can: ORGANIZER,
      options: [opt('a2', '2030-03-06', 1), opt('a1', '2030-03-04', 0, 1), opt('a3', '2030-03-08', 3, 2)],
      ...over,
    });

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;
  const fix = (fixture: any) => root(fixture).querySelector<HTMLButtonElement>('.destiny-board__fix');
  const extend = (fixture: any) =>
    root(fixture).querySelector<HTMLButtonElement>('.destiny-board__extend');
  const notice = (fixture: any) =>
    root(fixture).querySelector('.calendar-notice span')?.textContent?.trim() ?? null;

  async function enter(entry: OpenPollEntry = poll(), extra: Partial<CreateOptions> = {}) {
    const ctx = await createCalendarView({ mode: 'personal', openPolls: [entry], ...extra });
    (ctx.fixture.componentInstance as any).chooseDestiny(entry.pollId);
    await tick(ctx.fixture);
    return ctx;
  }

  it('JDR : « Fixer la date… » ouvre SealConfirmDialog avec les créneaux, le meilleur en tête', async () => {
    const { fixture, dialog, pollSvc, openPollsSvc } = await enter();
    dialog.__result = true;

    fix(fixture)!.click();
    await tick(fixture);

    const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: any }];
    expect(component).toBe(SealConfirmDialog);
    expect(config.data.pollLabel).toBe('Chapitre 4');
    expect(config.data.slots.map((s: any) => s.id)).toEqual(['a3', 'a2', 'a1']);

    // Le `partieId` vient de l'entrée : la vitrine n'a pas de route de partie.
    await config.data.confirm('a3');
    expect(pollSvc.chooseDate).toHaveBeenCalledWith('partie-A', 'poll-a', { optionId: 'a3' });
    expect(openPollsSvc.refresh).toHaveBeenCalled();
  });

  it('renoncer n’écrit rien et ne relit rien', async () => {
    const { fixture, dialog, pollSvc, openPollsSvc } = await enter();
    dialog.__result = false;
    const before = openPollsSvc.refresh.mock.calls.length;

    fix(fixture)!.click();
    await tick(fixture);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(pollSvc.chooseDate).not.toHaveBeenCalled();
    expect(openPollsSvc.refresh.mock.calls.length).toBe(before);
  });

  it('deux demandes rapprochées n’ouvrent qu’une confirmation', async () => {
    const { fixture, dialog } = await enter();
    const comp = fixture.componentInstance as any;
    void comp.openDestinyFix();
    void comp.openDestinyFix();
    await tick(fixture);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('un vote terminé garde « Fixer la date… »', async () => {
    const { fixture } = await enter(poll({ expiresAt: '2020-01-01T00:00:00.000Z' }));
    expect(fix(fixture)).not.toBeNull();
  });

  it('sans droit, aucune action ; jamais « Prolonger » en JDR même si le droit le dirait', async () => {
    const none = await enter(poll({ can: { propose: false, edit: false, choose: false, extend: false } }));
    expect(root(none.fixture).querySelector('.destiny-board__actions')).toBeNull();
    TestBed.resetTestingModule();

    const jdr = await enter(poll({ can: { ...ORGANIZER, extend: true } }));
    expect(fix(jdr.fixture)).not.toBeNull();
    expect(extend(jdr.fixture)).toBeNull();
  });

  it('soirée : « Prolonger le vote » ouvre ExtendVoteDialog, DateFixDialog sert à fixer', async () => {
    const entry = poll({ family: 'ralliement', can: { ...ORGANIZER, extend: true } });
    const { fixture, dialog } = await enter(entry);

    extend(fixture)!.click();
    await tick(fixture);
    expect(dialog.open.mock.calls[0][0]).toBe(ExtendVoteDialog);
    expect((dialog.open.mock.calls[0][1] as any).data.deadlineKey).toBe('2099-01-01');

    fix(fixture)!.click();
    await tick(fixture);
    expect(dialog.open.mock.calls[1][0]).toBe(DateFixDialog);
  });

  it('vitrine : le vote qui n’est plus ouvert ferme la Destinée avec son message, une fois', async () => {
    const { fixture, openPollsSvc } = await enter();
    const comp = fixture.componentInstance as any;
    expect(notice(fixture)).toBeNull();

    openPollsSvc.entries.set([]);
    await tick(fixture);

    expect(comp.destinyPollId()).toBeNull();
    expect(notice(fixture)).toBe('Ce vote n’est plus ouvert.');
    expect(root(fixture).querySelector('.calendar-notice-slot')!.getAttribute('role')).toBe('status');

    // « Fermer » l'efface ; une nouvelle entrée en Destinée l'efface aussi.
    root(fixture).querySelector<HTMLButtonElement>('.calendar-notice__close')!.click();
    await tick(fixture);
    expect(notice(fixture)).toBeNull();

    openPollsSvc.entries.set([poll()]);
    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(notice(fixture)).toBeNull();
  });

  it('quitter soi-même la Destinée ne pose aucun message', async () => {
    const { fixture } = await enter();
    (fixture.componentInstance as any).quitDestiny();
    await tick(fixture);
    expect(notice(fixture)).toBeNull();
  });

  it('atelier JDR : la date fixée ailleurs ferme la Destinée avec sa raison, sinon « clos »', async () => {
    const seance = TWO_OPTION_POLL_SCENARIO.seances[0];
    const closed = (chosenDate: string | null) => [
      {
        ...TWO_OPTION_POLL_SCENARIO,
        seances: [{ ...seance, poll: { ...seance.poll, status: 'CLOSED', chosenDate } }],
      },
    ];
    for (const [scenarios, expected] of [
      [closed('2026-08-28T00:00:00.000Z'), 'Ce vote est clos : sa date est fixée.'],
      [closed(null), 'Ce vote est clos.'],
      [[], 'Ce vote est clos.'],
    ] as [any[], string][]) {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [TWO_OPTION_POLL_SCENARIO],
        openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1' })],
      });
      const comp = fixture.componentInstance as any;
      comp.chooseDestiny('poll1');
      await tick(fixture);
      expect(notice(fixture)).toBeNull();

      comp.scenarios.set(withOrganizerDefaults(scenarios));
      await tick(fixture);
      expect(comp.destinyPollId()).toBeNull();
      expect(notice(fixture)).toBe(expected);
      TestBed.resetTestingModule();
    }
  });

  it('tiroir replié : « Fixer la date… » ouvre la même confirmation', async () => {
    const { fixture, dialog } = await enter(poll(), { desktop: false });
    const button = root(fixture).querySelector<HTMLButtonElement>('.destiny-sheet__fix')!;
    expect(button.textContent!.trim()).toBe('Fixer la date…');

    button.click();
    await tick(fixture);
    expect(dialog.open.mock.calls[0][0]).toBe(SealConfirmDialog);
  });
});


// ─── Story 44.7 — arriver en Destinée par un lien ─────────────────────────────

describe('CalendarView — arriver en Destinée par un lien (Story 44.7)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const opt = (optionId: string, date: string, yes = 0) => ({
    optionId,
    date,
    slot: 'EVENING' as const,
    yes,
    maybe: 0,
    no: 0,
    myAnswer: null,
  });

  const poll = (over: Partial<OpenPollEntry> = {}) =>
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-A',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      options: [opt('a2', '2030-03-06', 1), opt('a1', '2030-03-04'), opt('a3', '2030-03-08', 3)],
      ...over,
    });

  const notice = (fixture: any) =>
    (fixture.nativeElement as HTMLElement).querySelector('.calendar-notice span')?.textContent?.trim() ?? null;

  it('vitrine : ?poll ouvre la Destinée sur ce vote, en Mois, tiroir replié sur téléphone, adresse conservée', async () => {
    const { fixture, location } = await createCalendarView({
      mode: 'personal',
      desktop: false,
      queryParams: { poll: 'poll-a' },
      openPolls: [poll()],
    });
    await tick(fixture);
    const comp = fixture.componentInstance as any;

    expect(comp.destinyPollId()).toBe('poll-a');
    expect(comp.view()).toBe('month');
    expect(comp.destinySheetExpanded()).toBe(false);
    expect(comp.destinyOptionId()).toBe('a1');
    expect(location.path()).toContain('poll=poll-a');
    expect(notice(fixture)).toBeNull();
  });

  it('un vote inconnu, clos ou d’une autre partie : calendrier normal, message une fois, paramètre retiré', async () => {
    const cases: [Record<string, any>, string][] = [
      [{ mode: 'personal', openPolls: [poll()] }, 'zzz'],
      [
        {
          mode: 'mj',
          partieId: 'partie-1',
          scenarios: [TWO_OPTION_POLL_SCENARIO],
          openPolls: [poll({ pollId: 'poll-x', partieId: 'partie-X' })],
        },
        'poll-x',
      ],
    ];
    for (const [options, pollParam] of cases) {
      const { fixture, location } = await createCalendarView({
        ...options,
        queryParams: { poll: pollParam },
      });
      await tick(fixture);

      expect((fixture.componentInstance as any).destinyPollId()).toBeNull();
      expect(notice(fixture)).toBe('Ce vote n’existe pas ou n’est plus ouvert.');
      expect(location.path()).not.toContain('poll=');
      TestBed.resetTestingModule();
    }
  });

  it('atelier JDR : le lien attend les données de la partie, la Destinée n’est pas fermée aussitôt', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
      queryParams: { poll: 'poll1' },
      openPolls: [poll({ pollId: 'poll1', partieId: 'partie-1' })],
    });
    await tick(fixture);

    expect((fixture.componentInstance as any).destinyPollId()).toBe('poll1');
    expect(notice(fixture)).toBeNull();
  });

  it('?pollList ouvre la liste ✦ et se consomme ; sans ligne, rien ne s’ouvre', async () => {
    const withLines = await createCalendarView({
      mode: 'personal',
      queryParams: { pollList: '' },
      openPolls: [poll()],
    });
    await tick(withLines.fixture);
    expect((withLines.fixture.componentInstance as any).destinyListOpen()).toBe(true);
    expect(withLines.location.path()).not.toContain('pollList');
    TestBed.resetTestingModule();

    const empty = await createCalendarView({
      mode: 'personal',
      queryParams: { pollList: '' },
      openPolls: [],
    });
    await tick(empty.fixture);
    expect((empty.fixture.componentInstance as any).destinyListOpen()).toBe(false);
  });

  it('l’adresse suit la Destinée : posée au choix, changée avec le vote, retirée à la sortie, sans navigation du routeur', async () => {
    const { fixture, location } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll(), poll({ pollId: 'poll-b', title: 'Chapitre 5' })],
    });
    const comp = fixture.componentInstance as any;
    const replace = vi.spyOn(location, 'replaceState');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(location.path()).toContain('poll=poll-a');

    comp.chooseDestiny('poll-b');
    await tick(fixture);
    expect(location.path()).toContain('poll=poll-b');
    expect(location.path()).not.toContain('poll=poll-a');

    comp.quitDestiny();
    await tick(fixture);
    expect(location.path()).not.toContain('poll=');
    expect(replace).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('les autres paramètres de l’adresse sont gardés', async () => {
    const { fixture, location } = await createCalendarView({
      mode: 'personal',
      openPolls: [poll()],
    });
    location.replaceState(location.path().split('?')[0], 'from=2030-03-01&to=2030-03-31');
    (fixture.componentInstance as any).chooseDestiny('poll-a');
    await tick(fixture);

    expect(location.path()).toContain('from=2030-03-01');
    expect(location.path()).toContain('to=2030-03-31');
    expect(location.path()).toContain('poll=poll-a');
  });
});

// ─── Story 44.8 — filtrer mon calendrier personnel par partie ─────────────────

describe('CalendarView — filtrer par partie (Story 44.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const TODAY = toDateKey(new Date());
  const PARTIES = [
    { id: 'pA', name: 'Les Cendres', status: 'EN_COURS' },
    { id: 'pB', name: 'La Bande', status: 'A_VENIR' },
    { id: 'pC', name: 'Soirée jeux', status: 'A_VENIR' },
    { id: 'pZ', name: 'Finie', status: 'TERMINEE' },
  ];

  const vote = (pollId: string, partieId: string, partieName: string) =>
    openPollEntry({
      pollId,
      partieId,
      partieName,
      title: `Vote ${partieName}`,
      expiresAt: null,
      options: [
        { optionId: `${pollId}-o`, date: TODAY, slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null },
      ],
    });

  function seanceOf(partieId: string, name: string) {
    return {
      seanceId: `s-${partieId}`,
      partieId,
      partieName: name,
      scenarioId: `sc-${partieId}`,
      scenarioTitle: 'Chapitre',
      date: TODAY,
      slot: 'MORNING',
    };
  }

  async function create(over: Record<string, unknown> = {}) {
    const availabilitySvc = makeAvailabilityService();
    availabilitySvc.getMyCalendar.mockResolvedValue({
      'mes-indisponibilites': [],
      'mes-disponibilites': [],
      'mes-seances': [seanceOf('pA', 'Les Cendres'), seanceOf('pB', 'La Bande')],
      'votes-en-cours': [],
      'inscriptions-ouvertes': [],
    });
    const ctx = await createCalendarView({
      mode: 'personal',
      availabilitySvc,
      myParties: PARTIES,
      openPolls: [vote('poll-a', 'pA', 'Les Cendres'), vote('poll-b', 'pB', 'La Bande')],
      ...over,
    });
    await tick(ctx.fixture);
    return ctx;
  }

  const partiesIn = (entries: any[]) =>
    new Set(entries.map((e: any) => e.partieId ?? e.vote?.partieId).filter(Boolean));

  it('liste mes parties actives par leur nom, sans la terminée ; section absente avec une seule partie', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    expect(comp.filterParties().map((p: any) => p.name)).toEqual([
      'La Bande',
      'Les Cendres',
      'Soirée jeux',
    ]);
    expect(comp.isOverridden()).toBe(false);
    TestBed.resetTestingModule();

    const one = await create({ myParties: [PARTIES[0]] });
    expect((one.fixture.componentInstance as any).filterParties()).toEqual([]);
  });

  it('décocher une partie retire ses séances et ses votes de l’Agenda, pas ceux des autres ; les dispos restent', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    expect(partiesIn(comp.agendaEntries())).toEqual(new Set(['pA', 'pB']));

    comp.togglePartie('pB');
    await tick(fixture);

    expect(partiesIn(comp.agendaEntries())).toEqual(new Set(['pA']));
    expect(comp.agendaEntries().some((e: any) => e.type === 'mes-seances')).toBe(true);
    expect(comp.agendaEntries().some((e: any) => e.type === 'votes-en-cours')).toBe(true);

    comp.togglePartie('pB');
    expect(partiesIn(comp.agendaEntries())).toEqual(new Set(['pA', 'pB']));
  });

  it('le filtre est en aval : la liste complète, la liste ✦, la puce et le rail restent complets', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    comp.togglePartie('pB');
    await tick(fixture);

    expect(partiesIn(comp.calendarEntries())).toEqual(new Set(['pA', 'pB']));
    expect(comp.destinyPolls().map((p: any) => p.pollId).sort()).toEqual(['poll-a', 'poll-b']);
    expect(comp.destinyListItems().map((i: any) => i.pollId).sort()).toEqual(['poll-a', 'poll-b']);
    comp.railDate.set(new Date());
    expect(comp.railDetail().slots.some((s: any) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('la grille : la séance d’une partie masquée reste indisponible sans nom, le vote qui la couvrait disparaît', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    const month = fixture.debugElement.query(By.directive(CalendarMonthView)).componentInstance;
    const todayBands = () =>
      month
        .weeks()
        .flat()
        .find((c: any) => c.isToday).bands as { slot: string; winner: string; status: string; text: string | null }[];
    // Le matin d'aujourd'hui : la séance de pA et celle de pB (nommée) ; le soir : un vote par partie.
    const named = () => todayBands().filter((b) => b.text).map((b) => b.text);
    const namedBefore = named().length;
    expect(namedBefore).toBeGreaterThan(0);

    comp.togglePartie('pB');
    comp.togglePartie('pA');
    await tick(fixture);

    // Plus rien n'est nommé, mais le créneau de la séance reste pris (FR-50).
    expect(named()).toEqual([]);
    expect(todayBands().some((b) => b.slot === 'MORNING' && b.status === 'UNAVAILABLE')).toBe(true);
    expect(todayBands().every((b) => b.winner !== 'vote')).toBe(true);
    expect(comp.hiddenForViews()!.size).toBe(2);

    comp.togglePartie('pA');
    comp.togglePartie('pB');
    await tick(fixture);
    expect(comp.hiddenForViews()).toBeNull();
    expect(named().length).toBe(namedBefore);
  });

  it('la pastille annonce les parties, rétablir remet couches ET parties', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    comp.togglePartie('pB');
    await tick(fixture);

    expect(comp.isOverridden()).toBe(true);
    expect(comp.layerSummaryLabel()).toBe('Affichage filtré · 2 sur 3 · Rétablir');
    const pill = (fixture.nativeElement as HTMLElement).querySelector('.display-summary');
    expect(pill!.textContent).toContain('2 sur 3');

    comp.toggleLayer('mes-seances');
    expect(comp.layerSummaryLabel()).toMatch(/^Affichage filtré · \d sur \d · 2 sur 3 · Rétablir$/);

    comp.resetToDefault();
    await tick(fixture);
    expect(comp.hiddenPartieIds().size).toBe(0);
    expect(comp.isOverridden()).toBe(false);
  });

  it('le filtre n’entre ni dans activeLayers ni dans la mémoire de session', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    const before = [...comp.activeLayers()];
    comp.togglePartie('pB');
    await tick(fixture);

    expect(comp.activeLayers()).toEqual(before);
    expect(JSON.stringify(comp.activeLayers())).not.toContain('pB');
    expect(CALENDAR_LAYER_KEYS as readonly string[]).not.toContain('pB');
  });

  it('entrer en Destinée sur une partie décochée la recoche', async () => {
    const { fixture } = await create();
    const comp = fixture.componentInstance as any;
    comp.togglePartie('pB');
    await tick(fixture);
    expect(partiesIn(comp.agendaEntries())).toEqual(new Set(['pA']));

    comp.chooseDestiny('poll-b');
    await tick(fixture);

    expect(comp.hiddenPartieIds().has('pB')).toBe(false);
    expect(comp.destinyPollId()).toBe('poll-b');
    expect(comp.activeLayers()).toContain('votes-en-cours');
  });

  it('l’atelier ne connaît pas le filtre', async () => {
    const { fixture } = await create({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [TWO_OPTION_POLL_SCENARIO],
    });
    const comp = fixture.componentInstance as any;
    expect(comp.filterParties()).toEqual([]);
    expect(comp.hiddenForViews()).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 45.1 — « Proposer des dates » : voir les rendez-vous qui attendent une date
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe('CalendarView — Proposer des dates (Story 45.1)', () => {
  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const NOBODY = { propose: false, edit: false, choose: false, extend: false };

  /** Un scénario à une séance sans date, que `can` permet ou non de dater. */
  function freeScenario(id: string, title: string, over: Record<string, unknown> = {}) {
    return {
      id,
      partieId: 'partie-1',
      title,
      description: null,
      status: 'COURANT',
      dureeHeures: null,
      dureeSeances: null,
      resumeFin: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      closedAt: null,
      seances: [
        {
          id: `${id}-s1`,
          scenarioId: id,
          compteRendu: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          can: ORGANIZER,
          ...over,
        },
      ],
    };
  }

  function entry(seanceId: string, partieName: string, over: Partial<DatableSeanceEntry> = {}) {
    return {
      seanceId,
      partieId: `p-${partieName}`,
      partieName,
      family: 'jdr',
      kind: 'CAMPAGNE_LINEAIRE',
      title: `Titre ${seanceId}`,
      seanceRank: 1,
      seanceCount: 1,
      can: ORGANIZER,
      ...over,
    } as DatableSeanceEntry;
  }

  const button = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector<HTMLButtonElement>('.compose-arm');

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  async function atelier(scenarios: any[], extra: Partial<CreateOptions> = {}) {
    return createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios,
      partie: { name: 'La Tour' },
      ...extra,
    });
  }

  it('atelier JDR, un seul rendez-vous : le bouton s’écrit « Proposer des dates » et arme le composer sans passer par le choix', async () => {
    const { fixture } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    const comp = fixture.componentInstance as any;
    expect(button(fixture)?.textContent?.trim()).toBe(GRIMOIRE_TONE['calendar.view_propose_dates']);

    button(fixture)!.click();
    fixture.detectChanges();

    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc1-s1' });
  });

  it('atelier JDR, plusieurs rendez-vous : le bouton ouvre le choix, grouper sous le nom de la partie ; choisir arme le composer', async () => {
    const { fixture } = await atelier([
      freeScenario('sc1', 'Chapitre 1'),
      freeScenario('sc2', 'Chapitre 2'),
    ]);
    const comp = fixture.componentInstance as any;

    button(fixture)!.click();
    await tick(fixture);

    expect(comp.rendezvousPickerShown()).toBe(true);
    expect(comp.composing()).toBe(false);
    const picker = document.body.querySelector('app-rendezvous-picker');
    expect(picker).not.toBeNull();
    expect(picker!.querySelector('.rendezvous-picker__group-name')?.textContent?.trim()).toBe(
      'La Tour',
    );
    const rows = [...picker!.querySelectorAll('.rendezvous-picker__row')];
    expect(
      rows.map((r) => [
        r.querySelector('.rendezvous-picker__name')!.textContent!.trim(),
        r.querySelector('.rendezvous-picker__meta')!.textContent!.trim(),
      ]),
    ).toEqual([
      ['Chapitre 1', GRIMOIRE_TONE['calendar.rendezvous_nature_seance']],
      ['Chapitre 2', GRIMOIRE_TONE['calendar.rendezvous_nature_seance']],
    ]);

    (rows[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc2-s1' });
  });

  it('atelier JDR : rien à dater → pas de bouton (vote lancé, date posée, scénario clôturé, droit absent, partie terminée)', async () => {
    const dated = freeScenario('sc1', 'A', { dateValidee: '2099-01-01' });
    const polled = freeScenario('sc2', 'B', {
      poll: { id: 'poll9', status: 'OPEN', options: [], membersCount: 2 },
    });
    const closed = { ...freeScenario('sc3', 'C'), status: 'PASSE' };
    const noRight = freeScenario('sc4', 'D', { can: NOBODY });
    const { fixture } = await atelier([dated, polled, closed, noRight]);
    expect(button(fixture)).toBeNull();
    TestBed.resetTestingModule();

    const frozen = await atelier([freeScenario('sc5', 'E')], {
      partie: { name: 'La Tour', status: 'TERMINEE' },
    });
    expect(button(frozen.fixture)).toBeNull();
  });

  it('atelier JDR, destinée active sur un vote modifiable : le même bouton s’écrit « Modifier les dates » et arme ce vote', async () => {
    const withOptions = {
      ...ACTIVE_POLL_SCENARIO,
      seances: [
        {
          ...ACTIVE_POLL_SCENARIO.seances[0],
          poll: {
            ...ACTIVE_POLL_SCENARIO.seances[0].poll,
            options: [
              { id: 'optA', date: '2026-08-01T00:00:00.000Z', slot: 'EVENING', votes: [] },
              { id: 'optB', date: '2026-08-02T00:00:00.000Z', slot: 'MORNING', votes: [] },
            ],
          },
        },
      ],
    };
    const { fixture } = await atelier([withOptions]);
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll1');
    fixture.detectChanges();

    expect(button(fixture)?.textContent?.trim()).toBe(GRIMOIRE_TONE['calendar.view_modify_dates']);
    button(fixture)!.click();
    fixture.detectChanges();
    expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll1' });
  });

  it('une composition en cours masque le bouton', async () => {
    const { fixture } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    (fixture.componentInstance as any).startCompose('sc1-s1');
    fixture.detectChanges();
    expect(button(fixture)).toBeNull();
  });

  it('Story 45.5 — atelier d’une soirée : la soirée sans date est proposée, le bouton la liste', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      partieId: 'partie-g',
      partie: { name: 'Apéro', gameSystemId: 'ralliement' },
    });
    const comp = fixture.componentInstance as any;
    comp.isGroup.set(true);
    comp.groupEvents.set([
      {
        id: 'e1',
        title: 'Apéro',
        hostId: 'moi',
        hostDisplayName: 'Moi',
        seance: { id: 's1', date: null, slot: null },
        participants: [],
        myInscription: null,
        poll: null,
        cancelled: false,
        can: ORGANIZER,
      },
    ]);
    fixture.detectChanges();
    expect(comp.rendezvousRows().map((r: any) => [r.seanceId, r.eventId, r.nature])).toEqual([
      ['s1', 'e1', 'soiree'],
    ]);
    expect(button(fixture)?.textContent?.trim()).toBe(GRIMOIRE_TONE['calendar.view_propose_dates']);
  });

  describe('calendrier personnel', () => {
    it('lit mes rendez-vous à dater ; aucun, pas de bouton', async () => {
      const { fixture, datableSvc } = await createCalendarView({ mode: 'personal' });
      expect(datableSvc.refresh).toHaveBeenCalledTimes(1);
      expect(button(fixture)).toBeNull();
    });

    it('un seul rendez-vous : le choix est sauté et l’atelier de sa partie s’ouvre sur ?seanceId — jamais de composer', async () => {
      const { fixture } = await createCalendarView({
        mode: 'personal',
        datable: [entry('s1', 'La Tour', { partieId: 'pT' })],
      });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      expect(button(fixture)?.textContent?.trim()).toBe(
        GRIMOIRE_TONE['calendar.view_propose_dates'],
      );

      button(fixture)!.click();
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith('/parties/pT/calendar?seanceId=s1');
      expect((fixture.componentInstance as any).composing()).toBe(false);
    });

    it('plusieurs rendez-vous de deux parties : le choix les groupe par nom ; « Titre — Séance 2 » seulement s’il y en a plusieurs', async () => {
      const { fixture } = await createCalendarView({
        mode: 'personal',
        datable: [
          entry('s1', 'La Tour', { partieId: 'pT', title: 'Chapitre', seanceRank: 2, seanceCount: 3 }),
          entry('s2', 'Les Dragons', { partieId: 'pD', title: 'Épilogue' }),
        ],
      });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      button(fixture)!.click();
      await tick(fixture);

      const picker = document.body.querySelector('app-rendezvous-picker')!;
      expect(
        [...picker.querySelectorAll('.rendezvous-picker__group-name')].map((n) =>
          n.textContent!.trim(),
        ),
      ).toEqual(['La Tour', 'Les Dragons']);
      const rows = [...picker.querySelectorAll<HTMLButtonElement>('.rendezvous-picker__row')];
      expect(rows[0].textContent).toContain('Chapitre — Séance 2');
      expect(rows[1].textContent).toContain('Épilogue');
      expect(rows[1].textContent).not.toContain('Séance');

      rows[1].click();
      expect(navigate).toHaveBeenCalledWith('/parties/pD/calendar?seanceId=s2');
    });

    it('un rendez-vous daté ailleurs (temps réel) fait disparaître le bouton', async () => {
      const { fixture, datableSvc } = await createCalendarView({
        mode: 'personal',
        datable: [entry('s1', 'La Tour')],
      });
      expect(button(fixture)).not.toBeNull();
      datableSvc.entries.set([]);
      fixture.detectChanges();
      expect(button(fixture)).toBeNull();
    });

    it('Story 45.5 — une soirée sans date est proposée (« soirée sans date ») et mène à l’atelier de la soirée, sans composer', async () => {
      const { fixture } = await createCalendarView({
        mode: 'personal',
        datable: [entry('s1', 'Apéro', { partieId: 'pS', family: 'ralliement', kind: 'ONE_SHOT' })],
      });
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      expect(button(fixture)).not.toBeNull();

      button(fixture)!.click();
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith('/parties/pS/guild-calendar?seanceId=s1');
      expect((fixture.componentInstance as any).composing()).toBe(false);
    });
  });
});

// ─── Story 45.4 — comment rouvrir un vote de JDR terminé ──────────────────────────────────────

describe('CalendarView — plateau d’un vote de JDR terminé (Story 45.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const entry = (over: Partial<OpenPollEntry>) =>
    openPollEntry({
      pollId: 'poll-j',
      partieId: 'partie-J',
      family: 'jdr',
      title: 'Chapitre 4',
      options: [
        { optionId: 'a1', date: '2099-03-04', slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null },
        { optionId: 'a2', date: '2099-03-06', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
      ],
      ...over,
    });

  const reopenHint = async (e: OpenPollEntry) => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [e] });
    const comp = fixture.componentInstance as any;
    comp.destinyPollId.set('poll-j');
    fixture.detectChanges();
    const hint = comp.destinyBoard()?.reopenHint ?? null;
    TestBed.resetTestingModule();
    return hint;
  };

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const NOBODY = { propose: false, edit: false, choose: false, extend: false };

  it('fin passée, organisateur : la phrase « Pour rouvrir le vote… » (jamais de « Prolonger » en JDR)', async () => {
    expect(await reopenHint(entry({ expiresAt: '2020-01-01T23:59:59.999Z', can: ORGANIZER }))).toBe(
      GRIMOIRE_TONE['calendar.destiny_reopen_vote'],
    );
  });

  it('fin non passée, ou pas organisateur, ou groupe : aucune phrase', async () => {
    expect(await reopenHint(entry({ expiresAt: '2099-01-01T23:59:59.999Z', can: ORGANIZER }))).toBeNull();
    expect(await reopenHint(entry({ expiresAt: '2020-01-01T23:59:59.999Z', can: NOBODY }))).toBeNull();
    expect(
      await reopenHint(
        entry({ expiresAt: '2020-01-01T23:59:59.999Z', can: ORGANIZER, family: 'ralliement' }),
      ),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 46.1 — ranger la colonne de droite (≥ 768 px) et replier les éphémérides (< 768 px)
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView — ranger la colonne de droite (Story 46.1)', () => {
  const LS_KEY = 'master-jdr.calendar.column-closed';
  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  beforeEach(() => localStorage.removeItem(LS_KEY));
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(LS_KEY);
  });

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;
  const dockButton = (fixture: any) =>
    root(fixture).querySelector<HTMLButtonElement>('.side-dock__bar .side-dock__button');
  const reopenButton = (fixture: any) =>
    root(fixture).querySelector<HTMLButtonElement>('.side-dock .side-dock__button');
  const dockLabel = (fixture: any) => root(fixture).querySelector('.side-dock__label')?.textContent?.trim();

  const poll = () =>
    openPollEntry({
      pollId: 'poll-a',
      partieId: 'partie-1',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 5,
      answeredCount: 2,
      can: ORGANIZER,
      options: [
        { optionId: 'a1', date: '2030-03-04', slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null },
        { optionId: 'a2', date: '2030-03-06', slot: 'EVENING', yes: 2, maybe: 0, no: 0, myAnswer: null },
      ],
    });

  it('colonne MJ : › range la colonne en dock « Éphémérides · N », ‹ la rouvre, la clé est écrite', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1', scenarios: [] });
    await tick(fixture);

    const dock = dockButton(fixture)!;
    expect(dock.getAttribute('aria-expanded')).toBe('true');
    expect(dock.getAttribute('aria-label')).toBe('Ranger la colonne');
    expect(root(fixture).querySelector('.date-range-form')).not.toBeNull();

    dock.click();
    await tick(fixture);
    const host = root(fixture).querySelector('app-side-dock.mj-results-panel')!;
    expect(host.classList).toContain('side-dock--docked');
    expect(dockLabel(fixture)).toBe('Éphémérides · 0');
    expect(root(fixture).querySelector('.date-range-form')).toBeNull();
    expect(localStorage.getItem(LS_KEY)).toBe('closed');
    const reopen = reopenButton(fixture)!;
    expect(reopen.getAttribute('aria-expanded')).toBe('false');
    expect(reopen.getAttribute('aria-label')).toBe('Rouvrir la colonne');
    // Le focus passe à ‹ (le bouton qui vient d'être activé a disparu).
    expect(document.activeElement).toBe(reopen);

    reopen.click();
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.mj-results-panel')!.classList).not.toContain(
      'side-dock--docked',
    );
    expect(root(fixture).querySelector('.date-range-form')).not.toBeNull();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(document.activeElement).toBe(dockButton(fixture));
  });

  it('colonne joueur : se range de la même façon', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', partieId: 'partie-1' });
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.guild-slots-panel')).not.toBeNull();

    dockButton(fixture)!.click();
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.guild-slots-panel')!.classList).toContain(
      'side-dock--docked',
    );
    expect(dockLabel(fixture)).toBe('Éphémérides · 0');
  });

  it('colonne de groupe : se range, libellé « votes de dates · N »', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', partieId: 'partie-1' });
    (fixture.componentInstance as any).isGroup.set(true);
    await tick(fixture);

    dockButton(fixture)!.click();
    await tick(fixture);
    expect(dockLabel(fixture)).toBe(`${GRIMOIRE_TONE['partie.ralliement_calendar_polls_heading']} · 0`);
  });

  it('plateau de la destinée : titre seul + pictogramme destinee, et entrer en Destinée rouvre la colonne rangée', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [poll()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-a');
    await tick(fixture);

    dockButton(fixture)!.click();
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.destiny-board-col')!.classList).toContain(
      'side-dock--docked',
    );
    expect(dockLabel(fixture)).toBe('Chapitre 4');
    expect(
      root(fixture).querySelector('.side-dock__label app-icon')?.getAttribute('data-icon'),
    ).toBe('destinee');

    // Quitter puis entrer de nouveau : la colonne revient ouverte.
    comp.quitDestiny();
    await tick(fixture);
    comp.chooseDestiny('poll-a');
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.destiny-board-col')!.classList).not.toContain(
      'side-dock--docked',
    );
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('au rechargement : l’état retenu « rangé » rouvre la colonne rangée', async () => {
    localStorage.setItem(LS_KEY, 'closed');
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1', scenarios: [] });
    await tick(fixture);
    expect(root(fixture).querySelector('app-side-dock.mj-results-panel')!.classList).toContain(
      'side-dock--docked',
    );
  });

  it('stockage qui jette : on range quand même, sans erreur', async () => {
    const { fixture } = await createCalendarView({ mode: 'mj', partieId: 'partie-1', scenarios: [] });
    await tick(fixture);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      dockButton(fixture)!.click();
      await tick(fixture);
      expect(root(fixture).querySelector('app-side-dock.mj-results-panel')!.classList).toContain(
        'side-dock--docked',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('sous 768 px : pas de dock, la liste se replie et Du / Au / Scruter disparaissent', async () => {
    const { fixture } = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [],
      desktop: false,
    });
    const comp = fixture.componentInstance as any;
    comp.onViewChange('month');
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    await tick(fixture);

    expect(root(fixture).querySelector('.side-dock__bar')).toBeNull();
    const fold = root(fixture).querySelector<HTMLButtonElement>('.available-slots__fold')!;
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(root(fixture).querySelector('.date-range-form')).not.toBeNull();

    fold.click();
    await tick(fixture);
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(root(fixture).querySelector('.date-range-form')).toBeNull();
    expect(root(fixture).querySelector('.available-slots__empty')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 46.2 — mettre une fenêtre de l'automate en évidence
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView — fenêtre de l’automate en évidence (Story 46.2)', () => {
  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const WIN_A = { date: '2030-03-06', slot: 'EVENING', members: [] as any[], durationSlots: 1 };
  const WIN_B = { date: '2030-03-09', slot: 'MORNING', members: [] as any[], durationSlots: 1 };
  const KEY_A = '2030-03-06|EVENING';

  beforeEach(() => localStorage.removeItem('master-jdr.calendar.column-closed'));
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;
  const cards = (fixture: any) => [...root(fixture).querySelectorAll<HTMLElement>('.mj-results-panel .creneau-card')];
  const headers = (fixture: any) =>
    [...root(fixture).querySelectorAll<HTMLButtonElement>('.mj-results-panel .creneau-card__select')];

  async function atelier(extra: Record<string, unknown> = {}) {
    const ctx = await createCalendarView({ mode: 'mj', partieId: 'partie-1', scenarios: [], ...extra });
    const comp = ctx.fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set([WIN_A, WIN_B]);
    await tick(ctx.fixture);
    return { ...ctx, comp };
  }

  const poll = () =>
    openPollEntry({
      pollId: 'poll1',
      partieId: 'partie-1',
      partieName: 'Les Cendres',
      title: 'Chapitre 4',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 3,
      answeredCount: 1,
      can: ORGANIZER,
      options: [
        { optionId: 'a1', date: '2030-04-04', slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null },
        { optionId: 'a2', date: '2030-04-06', slot: 'EVENING', yes: 1, maybe: 0, no: 0, myAnswer: null },
      ],
    });

  it('toucher une carte la sélectionne : carte contournée, jour net, autres jours estompés, grille sur son mois', async () => {
    const { fixture, comp } = await atelier();
    expect(comp.destinyDates()).toBeNull();

    headers(fixture)[0].click();
    await tick(fixture);

    expect(comp.selectedWindowKey()).toBe(KEY_A);
    expect([...comp.destinyDates()]).toEqual(['2030-03-06']);
    expect(cards(fixture).filter((c) => c.classList.contains('creneau-card--selected'))).toHaveLength(1);
    // La grille se place sur mars 2030 (« Mars 2030 » dans le titre de la vue Mois).
    expect(comp.sharedDate().getUTCFullYear?.() ?? comp.sharedDate().getFullYear()).toBe(2030);
    expect(comp.sharedDate().getMonth()).toBe(2);
    expect(root(fixture).querySelector('.band--window')).not.toBeNull();
  });

  it('une seule fenêtre à la fois : en toucher une autre remplace la première', async () => {
    const { fixture, comp } = await atelier();
    headers(fixture)[0].click();
    await tick(fixture);
    headers(fixture)[1].click();
    await tick(fixture);

    expect(comp.selectedWindowKey()).toBe('2030-03-09|MORNING');
    expect(cards(fixture).filter((c) => c.classList.contains('creneau-card--selected'))).toHaveLength(1);
  });

  it('retoucher la carte sélectionnée désélectionne : affichage normal', async () => {
    const { fixture, comp } = await atelier();
    headers(fixture)[0].click();
    await tick(fixture);
    headers(fixture)[0].click();
    await tick(fixture);

    expect(comp.selectedWindow()).toBeNull();
    expect(comp.destinyDates()).toBeNull();
    expect(root(fixture).querySelector('.band--window')).toBeNull();
  });

  it('Échap désélectionne', async () => {
    const { fixture, comp } = await atelier();
    headers(fixture)[0].click();
    await tick(fixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick(fixture);
    expect(comp.selectedWindow()).toBeNull();
  });

  it('composer ouvert : la carte reste sélectionnée mais rien n’est estompé', async () => {
    const { fixture, comp } = await atelier();
    comp.composing.set(true);
    headers(fixture)[0].click();
    await tick(fixture);

    expect(comp.selectedWindowKey()).toBe(KEY_A);
    expect(comp.destinyDates()).toBeNull();
    expect(root(fixture).querySelector('.band--window')).not.toBeNull();
  });

  it('la fenêtre qui n’est plus servie perd sa sélection', async () => {
    const { fixture, comp } = await atelier();
    headers(fixture)[0].click();
    await tick(fixture);

    comp.availableSlots.set([WIN_B]);
    await tick(fixture);
    expect(comp.selectedWindow()).toBeNull();
  });

  it('couche éteinte ou vue Agenda : la sélection tombe', async () => {
    const { fixture, comp } = await atelier();
    headers(fixture)[0].click();
    await tick(fixture);
    comp.onViewChange('agenda');
    await tick(fixture);
    expect(comp.selectedWindow()).toBeNull();
  });

  it('joueur : pas de sélection, la vue agrégée reste telle quelle', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set([{ date: '2030-03-06', slot: 'EVENING', total: 2, available: 2, unavailable: 0 }]);
    await tick(fixture);

    expect(comp.windowSelectable()).toBe(false);
    expect(root(fixture).querySelector('.creneau-card__select')).toBeNull();
  });

  describe('pendant une Destinée', () => {
    async function destinee() {
      const ctx = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [TWO_OPTION_POLL_SCENARIO],
        openPolls: [poll()],
      });
      const comp = ctx.fixture.componentInstance as any;
      comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
      comp.availableSlots.set([WIN_A, WIN_B]);
      comp.chooseDestiny('poll1');
      await tick(ctx.fixture);
      return { ...ctx, comp };
    }

    it('le plateau garde en pied « Éphémérides · N » replié ; le déplier montre les cartes', async () => {
      const { fixture, comp } = await destinee();
      const foot = root(fixture).querySelector('.destiny-board-col__slots')!;
      expect(foot.querySelector('.available-slots__title span')!.textContent!.trim()).toBe('Éphémérides · 2');
      expect(foot.querySelectorAll('.creneau-card')).toHaveLength(0);

      foot.querySelector<HTMLButtonElement>('.available-slots__fold')!.click();
      await tick(fixture);
      expect(comp.boardSlotsOpen()).toBe(true);
      expect(root(fixture).querySelectorAll('.destiny-board-col__slots .creneau-card')).toHaveLength(2);
    });

    it('toucher une carte suspend la Destinée (le plateau cède la place) ; désélectionner la rétablit', async () => {
      const { fixture, comp } = await destinee();
      root(fixture).querySelector<HTMLButtonElement>('.destiny-board-col__slots .available-slots__fold')!.click();
      await tick(fixture);
      expect(root(fixture).querySelector('app-destiny-board')).not.toBeNull();

      root(fixture).querySelector<HTMLButtonElement>('.destiny-board-col__slots .creneau-card__select')!.click();
      await tick(fixture);
      expect(root(fixture).querySelector('app-destiny-board')).toBeNull();
      expect(root(fixture).querySelector('.mj-results-panel')).not.toBeNull();
      // Le vote reste le mode actif : seul son affichage est suspendu, et l'estompe est celle de la fenêtre.
      expect(comp.destinyPollId()).toBe('poll1');
      expect([...comp.destinyDates()]).toEqual(['2030-03-06']);

      comp.onWindowSelected(null);
      await tick(fixture);
      expect(root(fixture).querySelector('app-destiny-board')).not.toBeNull();
      expect(root(fixture).querySelector('.mj-results-panel')).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 46.3 — ajouter une fenêtre de l'automate au vote
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView — ajouter une fenêtre au vote (Story 46.3)', () => {
  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const WIN_A = { date: '2030-03-06', slot: 'EVENING', members: [] as any[], durationSlots: 1 };
  const WIN_B = { date: '2030-03-09', slot: 'MORNING', members: [] as any[], durationSlots: 1 };

  beforeEach(() => localStorage.removeItem('master-jdr.calendar.column-closed'));
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
    TestBed.resetTestingModule();
  });

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;

  /** Un scénario à une séance sans date ni vote, que le MJ peut dater. */
  function freeScenario(id: string, title: string, over: Record<string, unknown> = {}) {
    return {
      id,
      partieId: 'partie-1',
      title,
      description: null,
      status: 'COURANT',
      dureeHeures: null,
      dureeSeances: null,
      resumeFin: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      closedAt: null,
      seances: [
        {
          id: `${id}-s1`,
          scenarioId: id,
          compteRendu: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          can: ORGANIZER,
          ...over,
        },
      ],
    };
  }

  /** Un scénario dont la séance porte un vote OUVERT de deux créneaux (le composer part d'eux). */
  const openVoteScenario = (id: string, title: string) =>
    freeScenario(id, title, {
      poll: {
        id: 'poll9',
        partieId: 'partie-1',
        status: 'OPEN',
        scenarioRef: null,
        expiresAt: null,
        chosenDate: null,
        chosenSlot: null,
        membersCount: 2,
        options: [
          { id: 'o1', date: '2030-04-04T00:00:00.000Z', slot: 'EVENING', votes: [] },
          { id: 'o2', date: '2030-04-06T00:00:00.000Z', slot: 'EVENING', votes: [] },
        ],
      },
    });

  async function atelier(scenarios: any[], extra: Record<string, unknown> = {}) {
    const ctx = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios,
      partie: { name: 'La Tour' },
      ...extra,
    });
    const comp = ctx.fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set([WIN_A, WIN_B]);
    await tick(ctx.fixture);
    return { ...ctx, comp };
  }

  const keys = (comp: any) => comp.composedCells().map((c: any) => composeCellKey(c.date, c.slot));

  it('composer déjà ouvert : la fenêtre y entre directement, quitte la liste et n’est plus sélectionnée', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    comp.startCompose('sc1-s1');
    comp.onWindowSelected(WIN_A);
    await tick(fixture);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(keys(comp)).toEqual(['2030-03-06|EVENING']);
    expect(comp.selectedWindow()).toBeNull();
    expect(comp.displayedSlots().map((s: any) => s.date)).toEqual(['2030-03-09']);
    // Aucune écriture : seul le composer a bougé.
    expect(comp.composing()).toBe(true);
  });

  it('le bouton « Ajouter au vote » de la carte sélectionnée fait la même chose', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    root(fixture).querySelector<HTMLButtonElement>('.mj-results-panel .creneau-card__select')!.click();
    await tick(fixture);
    root(fixture)
      .querySelector<HTMLButtonElement>('.mj-results-panel .creneau-card__action--primary')!
      .click();
    await tick(fixture);

    expect(comp.composing()).toBe(true);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc1-s1' });
    expect(keys(comp)).toEqual(['2030-03-06|EVENING']);
  });

  it('un seul rendez-vous composable : le choix est sauté, le composer s’arme sur lui avec la fenêtre', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    comp.onWindowSelected(WIN_B);
    await tick(fixture);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc1-s1' });
    expect(keys(comp)).toEqual(['2030-03-09|MORNING']);
  });

  it('la Destinée active est un vote modifiable de cette partie : le composer part de ses créneaux plus la fenêtre', async () => {
    const { fixture, comp } = await atelier([openVoteScenario('sc1', 'Chapitre 1')], {
      openPolls: [
        openPollEntry({
          pollId: 'poll9',
          partieId: 'partie-1',
          can: ORGANIZER,
          options: [
            { optionId: 'o1', date: '2030-04-04', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
            { optionId: 'o2', date: '2030-04-06', slot: 'EVENING', yes: 0, maybe: 0, no: 0, myAnswer: null },
          ],
        }),
      ],
    });
    comp.chooseDestiny('poll9');
    await tick(fixture);
    comp.onWindowSelected(WIN_A);
    await tick(fixture);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll9' });
    expect(keys(comp).sort()).toEqual(['2030-03-06|EVENING', '2030-04-04|EVENING', '2030-04-06|EVENING']);
  });

  it('plusieurs composables : le choix s’ouvre (à dater ET au vote ouvert) ; en choisir un arme le composer et y verse la fenêtre', async () => {
    const { fixture, comp } = await atelier([
      freeScenario('sc1', 'Chapitre 1'),
      openVoteScenario('sc2', 'Chapitre 2'),
    ]);
    comp.onWindowSelected(WIN_A);
    await tick(fixture);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(comp.rendezvousPickerShown()).toBe(true);
    expect(comp.composing()).toBe(false);
    const rows = [...document.body.querySelectorAll('.rendezvous-picker__row')];
    expect(rows.map((r) => r.querySelector('.rendezvous-picker__meta')!.textContent!.trim())).toEqual([
      GRIMOIRE_TONE['calendar.rendezvous_nature_seance'],
      GRIMOIRE_TONE['calendar.rendezvous_nature_seance_poll'],
    ]);

    (rows[1] as HTMLButtonElement).click();
    await tick(fixture);
    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.composeTarget()).toEqual({ kind: 'poll', pollId: 'poll9' });
    expect(keys(comp).sort()).toEqual(['2030-03-06|EVENING', '2030-04-04|EVENING', '2030-04-06|EVENING']);
  });

  it('plusieurs composables : choisir une séance à dater crée un vote neuf avec la fenêtre', async () => {
    const { fixture, comp } = await atelier([
      freeScenario('sc1', 'Chapitre 1'),
      openVoteScenario('sc2', 'Chapitre 2'),
    ]);
    comp.onWindowSelected(WIN_A);
    comp.addSelectedWindow();
    await tick(fixture);

    (document.body.querySelectorAll('.rendezvous-picker__row')[0] as HTMLButtonElement).click();
    await tick(fixture);
    expect(comp.composeTarget()).toEqual({ kind: 'new', seanceId: 'sc1-s1' });
    expect(keys(comp)).toEqual(['2030-03-06|EVENING']);
  });

  it('fermer le choix sans rien choisir garde la fenêtre sélectionnée et n’arme rien', async () => {
    const { fixture, comp } = await atelier([
      freeScenario('sc1', 'Chapitre 1'),
      freeScenario('sc2', 'Chapitre 2'),
    ]);
    comp.onWindowSelected(WIN_A);
    comp.addSelectedWindow();
    await tick(fixture);
    expect(comp.rendezvousPickerShown()).toBe(true);

    comp.closeRendezvousPicker();
    await tick(fixture);
    expect(comp.composing()).toBe(false);
    expect(comp.selectedWindowKey()).toBe('2030-03-06|EVENING');
    expect(comp.pendingWindow()).toBeNull();
  });

  it('annuler le composer rend les fenêtres ajoutées à la liste', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    comp.onWindowSelected(WIN_A);
    comp.addSelectedWindow();
    await tick(fixture);
    expect(comp.displayedSlots()).toHaveLength(1);

    comp.cancelCompose();
    await tick(fixture);
    expect(comp.displayedSlots()).toHaveLength(2);
    expect(comp.composing()).toBe(false);
  });

  it('retirer la fenêtre du composer la rend à la liste', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    comp.onWindowSelected(WIN_A);
    comp.addSelectedWindow();
    await tick(fixture);

    comp.onComposeToggled({ date: comp.composedCells()[0].date, slot: 'EVENING' });
    await tick(fixture);
    expect(comp.composedCells()).toHaveLength(0);
    expect(comp.displayedSlots()).toHaveLength(2);
  });

  it('rien de composable (date posée, droit absent) : ajouter n’arme rien et n’écrit rien', async () => {
    const { fixture, comp, pollSvc, scenariosSvc } = await atelier([
      freeScenario('sc1', 'A', { dateValidee: '2099-01-01' }),
      freeScenario('sc2', 'B', { can: { propose: false, edit: false, choose: false, extend: false } }),
    ]);
    comp.onWindowSelected(WIN_A);
    comp.addSelectedWindow();
    await tick(fixture);

    expect(comp.composing()).toBe(false);
    expect(comp.rendezvousPickerOpen()).toBe(false);
    expect(comp.selectedWindowKey()).toBe('2030-03-06|EVENING');
    expect(pollSvc.setPollOptions).not.toHaveBeenCalled();
    expect(scenariosSvc.createSeancePoll).not.toHaveBeenCalled();
    // Le bouton le dit : désactivé, jamais un clic muet.
    expect(comp.windowAddable()).toBe(false);
    expect(
      root(fixture)
        .querySelector('.mj-results-panel .creneau-card__action--primary')!
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('la même fenêtre ajoutée deux fois ne se double pas', async () => {
    const { fixture, comp } = await atelier([freeScenario('sc1', 'Chapitre 1')]);
    comp.startCompose('sc1-s1');
    comp.addSelectedWindow(WIN_A);
    comp.addSelectedWindow(WIN_A);
    await tick(fixture);
    expect(comp.composedCells()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 46.4 — masquer une fenêtre de l'automate
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView — masquer une fenêtre de l’automate (Story 46.4)', () => {
  const WIN_A = { date: '2030-03-06', slot: 'EVENING', members: [] as any[], durationSlots: 1 };
  const WIN_B = { date: '2030-03-09', slot: 'MORNING', members: [] as any[], durationSlots: 1 };
  const HIDDEN = {
    date: '2030-03-12',
    slot: 'AFTERNOON',
    members: [] as any[],
    durationSlots: 1,
    hidden: true,
  };

  beforeEach(() => localStorage.removeItem('master-jdr.calendar.column-closed'));
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;

  async function atelier(served: any[] = [WIN_A, WIN_B, HIDDEN]) {
    const ctx = await createCalendarView({ mode: 'mj', partieId: 'partie-1', scenarios: [] });
    const comp = ctx.fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set(served);
    await tick(ctx.fixture);
    return { ...ctx, comp };
  }

  it('les masquées sont servies à part : jamais dans la liste, ni dans le compte « Éphémérides · N »', async () => {
    const { fixture, comp } = await atelier();

    expect(comp.displayedSlots().map((s: any) => s.date)).toEqual(['2030-03-06', '2030-03-09']);
    expect(comp.hiddenSlots().map((s: any) => s.date)).toEqual(['2030-03-12']);
    expect(comp.slotsDockLabel()).toBe('Éphémérides · 2');
    expect(
      root(fixture).querySelector('.mj-results-panel .available-slots__title')!.textContent,
    ).toContain('Éphémérides · 2');
  });

  it('« Masquer » écrit la fenêtre avec sa clé servie, désélectionne et relit la liste', async () => {
    const { fixture, comp, pollSvc } = await atelier();
    pollSvc.getAvailableSlots.mockResolvedValue([WIN_B, { ...WIN_A, hidden: true }]);
    comp.onWindowSelected(WIN_A);
    await tick(fixture);
    const reads = pollSvc.getAvailableSlots.mock.calls.length;

    root(fixture)
      .querySelectorAll<HTMLButtonElement>('.mj-results-panel .creneau-card__action')[1]
      .click();
    await tick(fixture);

    expect(pollSvc.hideWindow).toHaveBeenCalledWith('partie-1', {
      date: '2030-03-06',
      startSlot: 'EVENING',
      durationSlots: 1,
    });
    expect(comp.selectedWindow()).toBeNull();
    expect(pollSvc.getAvailableSlots.mock.calls.length).toBe(reads + 1);
    expect(comp.displayedSlots().map((s: any) => s.date)).toEqual(['2030-03-09']);
  });

  it('un échec garde la fenêtre sélectionnée et le dit', async () => {
    const { fixture, comp, pollSvc } = await atelier();
    pollSvc.hideWindow.mockRejectedValue(new Error('500'));
    comp.onWindowSelected(WIN_A);
    await tick(fixture);

    await comp.hideWindow(WIN_A);
    await tick(fixture);

    expect(comp.selectedWindowKey()).toBe('2030-03-06|EVENING');
    expect(comp.error()).toBe(GRIMOIRE_TONE['calendar.window_hide_error']);
  });

  it('le lien du pied montre les masquées à 55 % avec « Démasquer » ; « Démasquer » écrit et relit', async () => {
    const { fixture, pollSvc } = await atelier();
    const toggle = root(fixture).querySelector<HTMLButtonElement>(
      '.mj-results-panel .available-slots__hidden-toggle',
    )!;
    expect(toggle.textContent!.trim()).toBe('Afficher les 1 masquées');
    expect(root(fixture).querySelector('.available-slots__list--hidden')).toBeNull();

    toggle.click();
    await tick(fixture);
    const card = root(fixture).querySelector('.available-slots__list--hidden .creneau-card')!;
    expect(card.classList).toContain('creneau-card--hidden');

    pollSvc.getAvailableSlots.mockResolvedValue([WIN_A, WIN_B, { ...HIDDEN, hidden: undefined }]);
    root(fixture)
      .querySelector<HTMLButtonElement>('.available-slots__list--hidden .creneau-card__action')!
      .click();
    await tick(fixture);

    expect(pollSvc.showWindow).toHaveBeenCalledWith('partie-1', {
      date: '2030-03-12',
      startSlot: 'AFTERNOON',
      durationSlots: 1,
    });
  });

  it('aucune masquée : pas de lien', async () => {
    const { fixture } = await atelier([WIN_A, WIN_B]);
    expect(root(fixture).querySelector('.available-slots__hidden-toggle')).toBeNull();
  });

  it('une fenêtre masquée ne se sélectionne pas', async () => {
    const { fixture, comp } = await atelier();
    root(fixture).querySelector<HTMLButtonElement>('.available-slots__hidden-toggle')!.click();
    await tick(fixture);
    root(fixture).querySelector<HTMLElement>('.available-slots__list--hidden .creneau-card')!.click();
    await tick(fixture);
    expect(comp.selectedWindow()).toBeNull();
  });

  it('un joueur : aucune masquée, aucune action', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', partieId: 'partie-1' });
    const comp = fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set([
      { date: '2030-03-06', slot: 'EVENING', total: 2, available: 2, unavailable: 0, unknown: 0 },
    ]);
    await tick(fixture);

    expect(comp.hiddenSlots()).toEqual([]);
    expect(root(fixture).querySelector('.available-slots__hidden-toggle')).toBeNull();
    expect(root(fixture).querySelector('.creneau-card__action')).toBeNull();
  });
});

// ─── Story 47.5 — voter et fixer une plage ────────────────────────────────────

describe('CalendarView — voter et fixer une plage (Story 47.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };

  const opt = (optionId: string, date: string, slot = 'EVENING', yes = 0) => ({
    optionId,
    date,
    slot: slot as 'MORNING' | 'AFTERNOON' | 'EVENING',
    yes,
    maybe: 0,
    no: 0,
    myAnswer: null,
  });

  // Trois week-ends (vendredis soir) d'une plage de 6 créneaux, dans le futur lointain.
  const weekends = (over: Partial<OpenPollEntry> = {}) =>
    openPollEntry({
      pollId: 'poll-w',
      partieId: 'partie-A',
      partieName: 'Les Cendres',
      title: 'Week-end jeux',
      expiresAt: '2099-01-01T00:00:00.000Z',
      eligibleCount: 5,
      answeredCount: 4,
      durationSlots: 6,
      can: ORGANIZER,
      options: [
        opt('w1', '2030-03-01', 'EVENING', 1),
        opt('w2', '2030-03-08', 'EVENING', 4),
        opt('w3', '2030-03-15', 'EVENING', 2),
      ],
      ...over,
    });

  const root = (fixture: any) => fixture.nativeElement as HTMLElement;

  it('plateau : chaque candidat s’écrit de son début à sa fin ; l’annonce du créneau courant dit la plage', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [weekends()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-w');
    comp.chooseDestinySlot('w2');
    await tick(fixture);

    expect(comp.destinyBoard().slots.map((s: any) => s.label)).toEqual([
      'ven. 1 mars soir → dim. 3 mars après-midi',
      'ven. 8 mars soir → dim. 10 mars après-midi',
      'ven. 15 mars soir → dim. 17 mars après-midi',
    ]);
    expect(comp.destinyBoard().announcement).toBe(
      'Créneau 2 sur 3, du vendredi 8 soir au dimanche 10 après-midi, 4 oui',
    );
  });

  it('un vote d’un créneau : libellé et annonce d’avant, aucune disponibilité', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      openPolls: [weekends({ durationSlots: 1 })],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-w');
    comp.chooseDestinySlot('w2');
    await tick(fixture);

    expect(comp.destinyBoard().slots[1].label).toBe('ven. 8 mars · Soir');
    expect(comp.destinyBoard().announcement).toContain('vendredi 8 mars, soir, 4 oui');
    expect(comp.destinyBoard().slots[1].availabilityText).toBeNull();
  });

  it('tiroir replié : « n / N · départ → fin · x oui · fin du vote … »', async () => {
    const { fixture } = await createCalendarView({
      mode: 'personal',
      desktop: false,
      openPolls: [weekends()],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-w');
    comp.chooseDestinySlot('w2');
    await tick(fixture);

    expect(comp.destinySheet().summary).toMatch(
      /^2 \/ 3 · ven\. 8 mars soir → dim\. 10 mars après-midi · 4 oui · fin du vote /,
    );
  });

  it('Destinée : les jours couverts par une plage ne sont pas estompés', async () => {
    const { fixture } = await createCalendarView({ mode: 'personal', openPolls: [weekends()] });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-w');
    await tick(fixture);

    expect([...comp.destinyDates()].sort()).toEqual([
      '2030-03-01',
      '2030-03-02',
      '2030-03-03',
      '2030-03-08',
      '2030-03-09',
      '2030-03-10',
      '2030-03-15',
      '2030-03-16',
      '2030-03-17',
    ]);
  });

  describe('pire disponibilité d’une plage candidate', () => {
    const cells = (week: string[], available: number[]) =>
      week.map((key, i) => {
        const [date, slot] = key.split('|');
        return { date, slot, available: available[i], unavailable: 0, unknown: 0, total: 5 };
      });
    const second = [
      '2030-03-08|EVENING',
      '2030-03-09|MORNING',
      '2030-03-09|AFTERNOON',
      '2030-03-09|EVENING',
      '2030-03-10|MORNING',
      '2030-03-10|AFTERNOON',
    ];

    it('JDR, carte de chaleur chargée : « 2 dispos sur toute la plage » sur la carte de 6 créneaux', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [TWO_OPTION_POLL_SCENARIO],
        openPolls: [weekends({ pollId: 'poll1', partieId: 'partie-1' })],
      });
      const comp = fixture.componentInstance as any;
      comp.chooseDestiny('poll1');
      await tick(fixture);

      comp.heatmap.set(cells(second, [5, 2, 4, 5, 5, 5]));
      await tick(fixture);

      const slots = comp.destinyBoard().slots;
      expect(slots[1].availabilityText).toBe('2 dispos sur toute la plage');
      // Les autres semaines ne sont pas dans la carte : pas de chiffre.
      expect(slots[0].availabilityText).toBeNull();
      expect(slots[2].availabilityText).toBeNull();
      expect(root(fixture).querySelector('.destiny-board__availability')?.textContent).toContain(
        '2 dispos sur toute la plage',
      );
    });

    it('une cellule manquante : aucun chiffre', async () => {
      const { fixture } = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [TWO_OPTION_POLL_SCENARIO],
        openPolls: [weekends({ pollId: 'poll1', partieId: 'partie-1' })],
      });
      const comp = fixture.componentInstance as any;
      comp.chooseDestiny('poll1');
      await tick(fixture);

      comp.heatmap.set(cells(second.slice(0, 5), [5, 2, 4, 5, 5]));
      await tick(fixture);

      expect(comp.destinyBoard().slots[1].availabilityText).toBeNull();
    });

    it('calendrier personnel ou créneau seul : rien', async () => {
      const personal = await createCalendarView({ mode: 'personal', openPolls: [weekends()] });
      const pc = personal.fixture.componentInstance as any;
      pc.chooseDestiny('poll-w');
      await tick(personal.fixture);

      pc.heatmap.set(cells(second, [5, 2, 4, 5, 5, 5]));
      await tick(personal.fixture);
      expect(pc.destinyBoard().slots[1].availabilityText).toBeNull();
      TestBed.resetTestingModule();

      const single = await createCalendarView({
        mode: 'mj',
        partieId: 'partie-1',
        scenarios: [TWO_OPTION_POLL_SCENARIO],
        openPolls: [weekends({ pollId: 'poll1', partieId: 'partie-1', durationSlots: 1 })],
      });
      const sc = single.fixture.componentInstance as any;
      sc.chooseDestiny('poll1');
      await tick(single.fixture);

      sc.heatmap.set(cells(second, [5, 2, 4, 5, 5, 5]));
      await tick(single.fixture);
      expect(sc.destinyBoard().slots[1].availabilityText).toBeNull();
    });
  });

  describe('sélecteur de réponse : une ligne par plage', () => {
    const lineOf = (optionId: string, range: string, myAnswer: any = null) => ({
      vote: {
        partieId: 'partie-A',
        pollId: 'poll-w',
        optionId,
        yes: 1,
        maybe: 0,
        no: 0,
        total: 5,
        myAnswer,
      },
      range,
    });

    async function open(destinyOption: string | null, lines: any[]) {
      const ctx = await createCalendarView({ mode: 'personal', openPolls: [weekends()] });
      const comp = ctx.fixture.componentInstance as any;
      comp.chooseDestiny('poll-w');
      if (destinyOption) comp.chooseDestinySlot(destinyOption);
      await tick(ctx.fixture);
      const anchor = document.createElement('button');
      document.body.appendChild(anchor);
      comp.onVoteOptionActivated({
        vote: lines[0].vote,
        lines,
        anchor,
        date: new Date(2030, 2, 9),
        slot: 'AFTERNOON',
      });
      await tick(ctx.fixture);
      return { ...ctx, comp };
    }

    const lines = () => [
      lineOf('w1', 'ven. 1 soir → dim. 3 après-midi'),
      lineOf('w2', 'ven. 8 soir → dim. 10 après-midi'),
    ];

    it('deux plages : deux lignes, la plage courante de la Destinée d’abord', async () => {
      const { comp } = await open('w2', lines());
      expect(comp.pickerLines().map((l: any) => l.vote.optionId)).toEqual(['w2', 'w1']);
      expect(comp.pickerVote().optionId).toBe('w2');
      const groups = [...document.body.querySelectorAll('.picker__line')];
      expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
        'ven. 8 soir → dim. 10 après-midi',
        'ven. 1 soir → dim. 3 après-midi',
      ]);
    });

    it('sans plage courante couvrant le créneau : l’ordre chronologique reçu', async () => {
      const { comp } = await open(null, lines());
      expect(comp.pickerLines().map((l: any) => l.vote.optionId)).toEqual(['w1', 'w2']);
    });

    it('répondre sur une ligne écrit pour CETTE option, pas pour la première', async () => {
      const { comp, pollSvc, fixture } = await open('w2', lines());
      document.body
        .querySelector<HTMLButtonElement>(
          'app-vote-answer-picker .opt2--answer[data-option="w1"][data-answer="NO"]',
        )!
        .click();
      await tick(fixture);

      expect(pollSvc.castVote).toHaveBeenCalledWith('partie-A', 'poll-w', {
        optionId: 'w1',
        answer: 'NO',
      });
      expect(comp.pickerVote()).toBeNull();
      expect(comp.pickerLines()).toEqual([]);
    });

    it('retirer sur une ligne retire la réponse de CETTE option', async () => {
      const withMine = [lineOf('w1', 'a', 'YES'), lineOf('w2', 'b')];
      const { pollSvc, fixture } = await open(null, withMine);
      document.body
        .querySelector<HTMLButtonElement>('app-vote-answer-picker .opt2--withdraw')!
        .click();
      await tick(fixture);

      expect(pollSvc.withdrawVote).toHaveBeenCalledWith('partie-A', 'poll-w', 'w1');
    });

    it('une seule plage : le sélecteur d’avant (aucune ligne), la réponse part pour l’option touchée', async () => {
      const { comp, pollSvc, fixture } = await open(null, [lines()[1]]);
      expect(comp.pickerLines()).toEqual([]);
      expect(document.body.querySelector('.picker__line')).toBeNull();
      document.body
        .querySelector<HTMLButtonElement>('app-vote-answer-picker .opt2--answer[data-answer="YES"]')!
        .click();
      await tick(fixture);

      expect(pollSvc.castVote).toHaveBeenCalledWith('partie-A', 'poll-w', {
        optionId: 'w2',
        answer: 'YES',
      });
    });
  });

  it('fixer la date : la confirmation liste chaque candidat de début à fin', async () => {
    const { fixture, dialog } = await createCalendarView({
      mode: 'personal',
      openPolls: [weekends()],
    });
    const comp = fixture.componentInstance as any;
    comp.chooseDestiny('poll-w');
    await tick(fixture);
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(false) } as any);

    await comp.openDestinyFix();

    const data = (dialog.open.mock.calls.at(-1) as any)[1].data;
    expect(data.slots.map((s: any) => s.label)).toEqual([
      'ven. 8 mars soir → dim. 10 mars après-midi',
      'ven. 15 mars soir → dim. 17 mars après-midi',
      'ven. 1 mars soir → dim. 3 mars après-midi',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 47.6 — faire chercher à l'automate des fenêtres de la bonne durée
// ─────────────────────────────────────────────────────────────────────────────
describe('CalendarView — fenêtres de la bonne durée (Story 47.6)', () => {
  const ORGANIZER = { propose: true, edit: true, choose: true, extend: false };
  const win = (date: string, slot: string, durationSlots: number) => ({
    date,
    slot,
    members: [] as any[],
    durationSlots,
  });
  const WIN_1 = win('2030-03-06', 'EVENING', 1);
  const WIN_2 = win('2030-03-09', 'AFTERNOON', 2);

  beforeEach(() => localStorage.removeItem('master-jdr.calendar.column-closed'));
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
    TestBed.resetTestingModule();
  });

  async function tick(fixture: any) {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }
  const root = (fixture: any) => fixture.nativeElement as HTMLElement;

  /** Un scénario à une séance sans date ni vote, de `durationSlots` créneaux. */
  function scenario(id: string, durationSlots: number) {
    return {
      id,
      partieId: 'partie-1',
      title: 'Chapitre',
      description: null,
      status: 'COURANT',
      dureeHeures: null,
      dureeSeances: null,
      resumeFin: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      closedAt: null,
      seances: [
        {
          id: `${id}-s1`,
          scenarioId: id,
          compteRendu: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          can: ORGANIZER,
          durationSlots,
        },
      ],
    };
  }

  async function atelier(durationSlots = 1, served: any[] = [WIN_1]) {
    const ctx = await createCalendarView({
      mode: 'mj',
      partieId: 'partie-1',
      scenarios: [scenario('sc1', durationSlots)],
      partie: { name: 'La Tour' },
    });
    const comp = ctx.fixture.componentInstance as any;
    comp.activeLayers.set([...DEFAULT_CALENDAR_LAYER_KEYS, 'disponibilite-groupe']);
    comp.availableSlots.set(served);
    await tick(ctx.fixture);
    return { ...ctx, comp };
  }
  const spans = (pollSvc: any) => pollSvc.getAvailableSlots.mock.calls.map((c: any[]) => c[4]);
  const keys = (comp: any) => comp.composedCells().map((c: any) => composeCellKey(c.date, c.slot));

  it('hors composer, la liste demande span = 1 explicitement', async () => {
    const { pollSvc } = await atelier();
    expect(pollSvc.getAvailableSlots).toHaveBeenCalled();
    expect(new Set(spans(pollSvc))).toEqual(new Set([1]));
  });

  it('stepper 1 → 2 : la colonne se relit avec span = 2 et les cartes montrent leur plage ; fermer le composer revient à 1', async () => {
    const { fixture, comp, pollSvc } = await atelier();
    comp.startCompose('sc1-s1');
    await tick(fixture);
    // Armer à la durée 1 de la cible : pas de relecture inutile.
    expect(new Set(spans(pollSvc))).toEqual(new Set([1]));

    pollSvc.getAvailableSlots.mockResolvedValue([WIN_2]);
    comp.onComposeDurationChanged(2);
    await tick(fixture);

    expect(spans(pollSvc).at(-1)).toBe(2);
    const card = root(fixture).querySelector('.mj-results-panel .creneau-card')!;
    const range = card.querySelector('.creneau-card__range')!;
    expect(range.textContent).toContain('→');
    expect(range.textContent).toContain('après-midi');
    expect(range.textContent).toContain('soir');
    expect(card.querySelector('.creneau-card__slot')).toBeNull();

    pollSvc.getAvailableSlots.mockResolvedValue([WIN_1]);
    comp.cancelCompose();
    await tick(fixture);
    expect(spans(pollSvc).at(-1)).toBe(1);
    expect(root(fixture).querySelector('.mj-results-panel .creneau-card__range')).toBeNull();
  });

  it('une réponse périmée (durée changée entre-temps) est ignorée', async () => {
    const { fixture, comp, pollSvc } = await atelier();
    comp.startCompose('sc1-s1');
    await tick(fixture);
    const pending: ((v: any[]) => void)[] = [];
    pollSvc.getAvailableSlots.mockImplementation(
      () => new Promise<any[]>((resolve) => pending.push(resolve)),
    );

    comp.onComposeDurationChanged(2);
    await tick(fixture);
    comp.onComposeDurationChanged(3);
    await tick(fixture);
    expect(spans(pollSvc).slice(-2)).toEqual([2, 3]);

    // La réponse la plus récente arrive d'abord, la périmée ensuite : seule la récente compte.
    pending[1]([win('2030-03-12', 'MORNING', 3)]);
    await tick(fixture);
    pending[0]([win('2030-03-13', 'MORNING', 2)]);
    await tick(fixture);

    expect(comp.availableSlots().map((s: any) => s.date)).toEqual(['2030-03-12']);
    expect(comp.slotsLoading()).toBe(false);
  });

  it('composer à 2 créneaux : une fenêtre de 2 créneaux s’y ajoute comme un départ', async () => {
    const { fixture, comp, pollSvc } = await atelier(2, [WIN_2]);
    // Le composer s'arme à 2 créneaux : la liste se relit à cette durée et sert la fenêtre de 2 créneaux.
    pollSvc.getAvailableSlots.mockResolvedValue([WIN_2]);
    comp.startCompose('sc1-s1');
    expect(comp.composeDuration()).toBe(2);
    comp.onWindowSelected(WIN_2);
    await tick(fixture);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(keys(comp)).toEqual(['2030-03-09|AFTERNOON']);
    expect(comp.composeRefusal()).toBeNull();
  });

  it('liste à 1, rendez-vous de 3 créneaux : le composer s’ouvre à 3 sans la fenêtre, la liste se relit à 3 et le dit', async () => {
    const { fixture, comp, pollSvc } = await atelier(3, [WIN_1]);
    comp.onWindowSelected(WIN_1);
    await tick(fixture);
    pollSvc.getAvailableSlots.mockResolvedValue([win('2030-03-09', 'MORNING', 3)]);

    comp.addSelectedWindow();
    await tick(fixture);

    expect(comp.composing()).toBe(true);
    expect(comp.composeDuration()).toBe(3);
    expect(keys(comp)).toEqual([]);
    expect(comp.composeRefusal()).toBe(
      'Cette fenêtre ne dure pas 3 créneaux : elle n’a pas été ajoutée.',
    );
    expect(comp.selectedWindow()).toBeNull();
    expect(spans(pollSvc).at(-1)).toBe(3);
  });

  it('une fenêtre servie à une autre durée que la composition ne s’y ajoute pas (liste périmée)', async () => {
    const { fixture, comp } = await atelier(2, [WIN_1]);
    comp.startCompose('sc1-s1');
    comp.onWindowSelected(WIN_1);
    await tick(fixture);

    comp.addSelectedWindow(WIN_1);
    await tick(fixture);

    expect(keys(comp)).toEqual([]);
    expect(comp.composeRefusal()).toBe(
      'Cette fenêtre ne dure pas 2 créneaux : elle n’a pas été ajoutée.',
    );
  });

  it('la durée 1 du composer : le message s’accorde au singulier', async () => {
    const { fixture, comp } = await atelier(1, [WIN_2]);
    comp.startCompose('sc1-s1');
    comp.onWindowSelected(WIN_2);
    await tick(fixture);

    comp.addSelectedWindow(WIN_2);

    expect(keys(comp)).toEqual([]);
    expect(comp.composeRefusal()).toBe(
      'Cette fenêtre ne dure pas 1 créneau : elle n’a pas été ajoutée.',
    );
  });
});
