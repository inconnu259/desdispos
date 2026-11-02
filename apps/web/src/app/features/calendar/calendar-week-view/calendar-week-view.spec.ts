import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvailabilityDeclarationDto, CalendarLayerKey } from '@master-jdr/shared';
import type { AgendaEntry } from '../calendar-agenda-view/calendar-agenda-view';
import { CalendarWeekView, buildWeek, getWeekStart } from './calendar-week-view';
import { LONG_PRESS_MS } from '../selection.utils';
import { THEMES, TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('getWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    const wed = new Date(Date.UTC(2026, 5, 24)); // Wed 24 Jun 2026 UTC
    const result = getWeekStart(wed);
    expect(result.getUTCDay()).toBe(1); // Monday UTC
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCMonth()).toBe(5);
  });

  it('returns previous Monday for a Sunday', () => {
    const sun = new Date(Date.UTC(2026, 5, 28)); // Sun 28 Jun 2026 UTC
    const result = getWeekStart(sun);
    expect(result.getUTCDay()).toBe(1); // Monday UTC
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCMonth()).toBe(5);
  });

  it('returns same day for a Monday', () => {
    const mon = new Date(Date.UTC(2026, 5, 22)); // Mon 22 Jun 2026 UTC
    const result = getWeekStart(mon);
    expect(result.getUTCDay()).toBe(1);
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCMonth()).toBe(5);
  });

  // AC2 : un instant UTC qui est lundi 4h (= dimanche 23h UTC-5) → semaine commence lundi
  it('returns Monday UTC for a date that is Monday 4am UTC (Sunday 11pm in UTC-5)', () => {
    const mondayEarlyUtc = new Date(Date.UTC(2026, 5, 29, 4, 0, 0)); // Mon Jun 29 04:00 UTC
    const result = getWeekStart(mondayEarlyUtc);
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.getUTCDate()).toBe(29);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCHours()).toBe(0); // UTC midnight
  });
});

describe('buildWeek', () => {
  const emptyDecls: AvailabilityDeclarationDto[] = [];

  it('returns 7 cells', () => {
    const weekStart = getWeekStart(new Date(2026, 5, 22));
    const cells = buildWeek(weekStart, emptyDecls, null, TONE_MAP['grimoire-emeraude']);
    expect(cells).toHaveLength(7);
  });

  it('marks today as isToday', () => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const cells = buildWeek(weekStart, emptyDecls, null, TONE_MAP['grimoire-emeraude']);

    const todayCell = cells.find((c) => {
      const midnight = new Date(c.date);
      midnight.setHours(0, 0, 0, 0);
      const todayMidnight = new Date(today);
      todayMidnight.setHours(0, 0, 0, 0);
      return midnight.getTime() === todayMidnight.getTime();
    });

    expect(todayCell).toBeDefined();
    expect(todayCell?.isToday).toBe(true);
  });

  it('marks past days as isPast', () => {
    // Week starting 2 weeks ago — all cells should be past
    const pastWeekStart = new Date();
    pastWeekStart.setDate(pastWeekStart.getDate() - 14);
    const weekStart = getWeekStart(pastWeekStart);
    const cells = buildWeek(weekStart, emptyDecls, null, TONE_MAP['grimoire-emeraude']);
    expect(cells.every((c) => c.isPast)).toBe(true);
  });

  it('does not mark future days as isPast', () => {
    // Week starting next week — no cells should be past
    const futureWeekStart = new Date();
    futureWeekStart.setDate(futureWeekStart.getDate() + 7);
    const weekStart = getWeekStart(futureWeekStart);
    const cells = buildWeek(weekStart, emptyDecls, null, TONE_MAP['grimoire-emeraude']);
    expect(cells.every((c) => !c.isPast)).toBe(true);
  });
});

// AC1 : findWeekDecl doit respecter endDate pour les RECURRING (correctif modèle SPLIT)
describe('buildWeek - findWeekDecl avec endDate (AC1)', () => {
  const BASE_DECL: Pick<AvailabilityDeclarationDto, 'id' | 'userId' | 'createdAt' | 'expiresAt'> = {
    id: 'test-recurring',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2099-12-31T23:59:59.000Z',
  };

  // Semaine du lundi 22 juin 2026 (UTC)
  const weekStart = new Date(Date.UTC(2026, 5, 22));

  it('renvoie null declLabel pour une déclaration RECURRING dont endDate est dépassé', () => {
    const decl: AvailabilityDeclarationDto = {
      ...BASE_DECL,
      kind: 'UNAVAILABLE',
      recurKind: 'RECURRING',
      dayOfWeek: 1, // lundi
      slot: 'MORNING',
      startDate: null,
      endDate: '2026-06-21', // veille du lundi → la série est terminée
    };
    const cells = buildWeek(weekStart, [decl], null, TONE_MAP['grimoire-emeraude']);
    const monday = cells[0]; // index 0 = lundi
    expect(monday.morning.declLabel).toBeNull();
  });

  it("renvoie le declLabel pour une déclaration RECURRING dont endDate est exactement aujourd'hui", () => {
    const decl: AvailabilityDeclarationDto = {
      ...BASE_DECL,
      kind: 'UNAVAILABLE',
      recurKind: 'RECURRING',
      dayOfWeek: 1, // lundi
      slot: 'MORNING',
      startDate: null,
      endDate: '2026-06-22', // exactement le jour de la cellule → encore valide
    };
    const cells = buildWeek(weekStart, [decl], null, TONE_MAP['grimoire-emeraude']);
    const monday = cells[0];
    expect(monday.morning.declLabel).not.toBeNull();
    expect(monday.morning.declLabel).toContain('Récurrent');
  });

  for (const theme of THEMES) {
    it(`${theme} : le libellé de déclaration emploie les mots du thème passé`, () => {
      const decl: AvailabilityDeclarationDto = {
        ...BASE_DECL,
        kind: 'UNAVAILABLE',
        recurKind: 'RECURRING',
        dayOfWeek: 1,
        slot: 'MORNING',
        startDate: null,
        endDate: null,
      };
      const tone = TONE_MAP[theme];
      const label = buildWeek(weekStart, [decl], null, tone)[0].morning.declLabel;
      expect(label).toContain(tone['calendar.week_decl_unavailable']);
      expect(label).toContain(tone['calendar.week_decl_recurring']);
    });
  }

  it('renvoie le declLabel pour une déclaration RECURRING sans endDate', () => {
    const decl: AvailabilityDeclarationDto = {
      ...BASE_DECL,
      kind: 'AVAILABLE',
      recurKind: 'RECURRING',
      dayOfWeek: 3, // mercredi
      slot: 'AFTERNOON',
      startDate: null,
      endDate: null,
    };
    const cells = buildWeek(weekStart, [decl], null, TONE_MAP['grimoire-emeraude']);
    const wednesday = cells[2]; // index 2 = mercredi
    expect(wednesday.afternoon.declLabel).not.toBeNull();
  });
});

// ─── Sélection par glissement (Story 30.3) ────────────────────────────────────

describe('CalendarWeekView — sélection par glissement', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  // Semaine future pour éviter que les cellules soient marquées isPast.
  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);

  function create(): void {
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  // Les 7 cellules d'une ligne partagent le même sélecteur data-cell-slot ; on les récupère toutes
  // puis on indexe par jour (ordre du DOM == ordre des jours de buildWeek).
  function slotCells(slot: 'MORNING' | 'AFTERNOON' | 'EVENING'): HTMLElement[] {
    return Array.from(el.querySelectorAll(`.slot-cell[data-cell-slot="${slot}"]`));
  }

  function pointerEvent(type: string, x: number, y: number, pointerType = 'mouse'): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerType, bubbles: true });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ⚠️ Story 36.3, AC15 — un tap COURT est un geste de lecture : le rail suit (AC2 de 36.1) et
  // rien ne s'ouvre. Ni le panneau (AC1), ni la barre.
  it('AC15 — un tap court ne fait que peupler le rail : aucune barre, aucune sélection', () => {
    create();
    const spy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(spy);
    const cell = slotCells('EVENING')[0];
    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    const grid = el.querySelector('.week-grid') as HTMLElement;
    grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  it('AC15 — un appui maintenu à la SOURIS arme la sélection et affiche la barre', () => {
    vi.useFakeTimers();
    create();
    const cell = slotCells('EVENING')[0];

    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(1);
    expect(fixture.componentInstance['scope']()).toBe('EVENING');
    expect(el.querySelector('app-selection-bar')).not.toBeNull();
  });

  it('AC18 — en mode modification, le clic bascule N’IMPORTE QUELLE ligne, pas seulement celle de l’ancre', () => {
    vi.useFakeTimers();
    create();
    const grid = el.querySelector('.week-grid') as HTMLElement;
    const tap = (cell: HTMLElement) => {
      cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
      fixture.detectChanges();
    };

    // Sélection armée sur la ligne « Soir ».
    slotCells('EVENING')[0].dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
    fixture.detectChanges();

    // Un matin d'un autre jour rejoint la sélection : la contrainte de ligne droite est celle
    // du GLISSEMENT, pas du clic.
    tap(slotCells('MORNING')[2]);
    const cells = fixture.componentInstance['selectedCells']();
    expect(cells).toHaveLength(2);
    expect(cells.map((c: { slot: string }) => c.slot).sort()).toEqual(['EVENING', 'MORNING']);
    // Créneaux divergents → plus aucune portée commune.
    expect(fixture.componentInstance['scope']()).toBeNull();

    // Et le même clic l'en retire.
    tap(slotCells('MORNING')[2]);
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(1);
  });

  it('glissement souris sur plusieurs cellules → sélectionne la plage, aucun tap émis', () => {
    create();
    const tapSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(tapSpy);
    const cells = slotCells('EVENING');
    const grid = el.querySelector('.week-grid') as HTMLElement;

    cells[1].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    // Stub elementFromPoint : jsdom ne calcule pas de géométrie réelle.
    const target3 = cells[3];
    document.elementFromPoint = vi.fn().mockReturnValue(target3);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(3);
    expect(tapSpy).not.toHaveBeenCalled();

    grid.dispatchEvent(pointerEvent('pointerup', 50, 0));
    // La sélection reste affichée après relâchement (barre visible) tant qu'aucune action n'est prise.
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(3);
  });

  it('glissement tactile avant expiration du délai d’appui maintenu → aucune sélection (AC4)', () => {
    vi.useFakeTimers();
    create();
    const cells = slotCells('MORNING');
    const grid = el.querySelector('.week-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0, 'touch'));
    // Déplacement significatif avant l'expiration du délai → traité comme un défilement natif.
    grid.dispatchEvent(pointerEvent('pointermove', 0, 100, 'touch'));
    vi.advanceTimersByTime(1000);

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
  });

  it('appui maintenu tactile jusqu’à expiration du délai → arme la sélection (AC4)', () => {
    vi.useFakeTimers();
    create();
    const cells = slotCells('MORNING');

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0, 'touch'));
    vi.advanceTimersByTime(500);

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(1);
  });

  it('Échap efface la sélection sans émettre de lot', () => {
    create();
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = slotCells('EVENING');
    const grid = el.querySelector('.week-grid') as HTMLElement;

    cells[1].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[3]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(3);

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('validation via la barre de sélection émet batchDeclareRequested avec le kind attendu', () => {
    create();
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = slotCells('EVENING');
    const grid = el.querySelector('.week-grid') as HTMLElement;

    cells[1].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();
    grid.dispatchEvent(pointerEvent('pointerup', 50, 0));
    fixture.detectChanges();

    const unavailableBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Indisponible',
    )!;
    unavailableBtn.click();

    expect(batchSpy).toHaveBeenCalledTimes(1);
    const payload = batchSpy.mock.calls[0][0];
    expect(payload.kind).toBe('UNAVAILABLE');
    expect(payload.cells).toHaveLength(2);
    // La sélection est effacée dès la validation (avant même la réponse de l'API, gérée par le parent).
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
  });

  it('Maj+flèche droite étend la sélection depuis une cellule (AC5)', () => {
    create();
    const cells = slotCells('EVENING');
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });

    cells[1].dispatchEvent(shiftRight);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(2);

    cells[1].dispatchEvent(shiftRight);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(3);
  });

  it('Maj+flèche gauche étend la sélection vers la gauche (AC5)', () => {
    create();
    const cells = slotCells('MORNING');
    const shiftLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
    });

    cells[3].dispatchEvent(shiftLeft);
    cells[3].dispatchEvent(shiftLeft);
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(3);
  });

  // ⚠️ Story 36.3, AC6 — remplace « Entrée valide avec Indisponible d'office » (story 30.3).
  it('AC6 — Entrée valide la sélection avec l’intention armée par la barre', () => {
    create();
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = slotCells('AFTERNOON');
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });

    cells[0].dispatchEvent(shiftRight);
    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    cells[0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0][0].kind).toBe('UNAVAILABLE');
    expect(batchSpy.mock.calls[0][0].cells).toHaveLength(3);

    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    fixture.componentInstance['onArmedKindChange']('AVAILABLE');
    fixture.detectChanges();
    cells[0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

    expect(batchSpy).toHaveBeenCalledTimes(2);
    expect(batchSpy.mock.calls[1][0].kind).toBe('AVAILABLE');
  });

  // ⚠️ Story 36.3, AC7 — remplace « Entrée sans sélection ouvre le panneau ».
  it('AC7 — Entrée sans sélection armée ne fait rien', () => {
    create();
    const slotSpy = vi.fn();
    const batchSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(slotSpy);
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cell = slotCells('EVENING')[0];

    cell.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(slotSpy).not.toHaveBeenCalled();
    expect(batchSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
  });

  it('AC3 — la portée gouverne le créneau écrit, pour toute la sélection', () => {
    create();
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = slotCells('AFTERNOON');
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });
    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();

    fixture.componentInstance['onScopeChange']('EVENING');
    fixture.detectChanges();
    fixture.componentInstance['onSelectionCommit']('AVAILABLE');

    const payload = batchSpy.mock.calls[0][0];
    expect(payload.cells).toHaveLength(2);
    expect(payload.cells.every((c: { slot: string }) => c.slot === 'EVENING')).toBe(true);
  });

  it('AC2 — la portée « journée » marque les trois lignes des jours retenus', () => {
    vi.useFakeTimers();
    create();
    const cell = slotCells('EVENING')[0];
    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();
    expect(el.querySelectorAll('.slot-cell.selected')).toHaveLength(1);

    fixture.componentInstance['onScopeChange']('FULL_DAY');
    fixture.detectChanges();
    expect(el.querySelectorAll('.slot-cell.selected')).toHaveLength(3);
  });

  it('AC4 — « Autre… » émet declarationPanelRequested sur l’ancre, à la portée courante', () => {
    vi.useFakeTimers();
    create();
    const spy = vi.fn();
    fixture.componentInstance.declarationPanelRequested.subscribe(spy);
    const cell = slotCells('EVENING')[0];
    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();

    const otherBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === GRIMOIRE_TONE['calendar.selbar_other'],
    )!;
    otherBtn.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].slot).toBe('EVENING');
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
  });
});

// ─── Story 36.13 — la grille Semaine à densité variable ───────────────────────

describe('CalendarWeekView — densité variable (Story 36.13)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  // Semaine future : évite `isPast`, qui retire le rôle bouton et l'aria-label des cellules.
  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(futureStart.getFullYear(), futureStart.getMonth(), futureStart.getDate())),
  );

  /** Le jour de la colonne `i`, dans la convention `YYYY-MM-DD` locale des entrées. */
  function dayKey(i: number): string {
    const d = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i,
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function seanceEntry(dayIndex: number, over: Partial<AgendaEntry> = {}): AgendaEntry {
    return {
      key: `seance-${dayIndex}`,
      type: 'mes-seances',
      date: dayKey(dayIndex),
      label: 'Le Convoi du Nord',
      slot: 'EVENING',
      partieId: 'p1',
      scenarioId: 's1',
      ...over,
    };
  }

  function voteEntry(dayIndex: number, over: Partial<AgendaEntry> = {}): AgendaEntry {
    return {
      key: `poll-${dayIndex}`,
      type: 'votes-en-cours',
      date: dayKey(dayIndex),
      label: 'Les Cendres d Ashal',
      slot: 'MORNING',
      partieId: 'p1',
      ...over,
    };
  }

  /** Story 36.6 — la participation portée par une option de vote. */
  const PARTICIPATION = {
    partieId: 'partie-1',
    pollId: 'p',
    optionId: 'o1',
    yes: 2,
    maybe: 1,
    no: 0,
    total: 4,
    myAnswer: 'YES' as const,
  };

  function create(entries: AgendaEntry[] = [], activeLayers: CalendarLayerKey[] = []): void {
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('activeLayers', activeLayers);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function cellAt(slot: 'MORNING' | 'AFTERNOON' | 'EVENING', dayIndex: number): HTMLElement {
    return Array.from(el.querySelectorAll<HTMLElement>(`.slot-cell[data-cell-slot="${slot}"]`))[
      dayIndex
    ];
  }

  /** Story 36.7 — le tap de la vue Semaine n'est PAS un `(click)` : il est synthétisé par
   *  `onGridPointerUp()` quand le geste n'a pas armé. Le reproduire fidèlement est le seul moyen
   *  de tester le vrai chemin. */
  function pointer(type: string, x = 10, y = 10): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true });
  }

  function tap(cell: HTMLElement): void {
    const grid = el.querySelector('.week-grid') as HTMLElement;
    cell.dispatchEvent(pointer('pointerdown'));
    grid.dispatchEvent(pointer('pointerup'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // AC1 — sept colonnes, à toutes les largeurs. La densité étant purement CSS, la structure est
  // la même dans les deux cas : c'est précisément ce que cet AC garantit.
  it('AC1 — conserve sept colonnes et rend trois lignes de sept cellules', () => {
    create();
    expect(el.querySelectorAll('.col-header')).toHaveLength(7);
    for (const slot of ['MORNING', 'AFTERNOON', 'EVENING'] as const) {
      expect(el.querySelectorAll(`.slot-cell[data-cell-slot="${slot}"]`)).toHaveLength(7);
    }
  });

  it('la navigation porte les pictogrammes precedent, suivant puis aujourdhui, dans cet ordre', () => {
    create();
    const names = Array.from(el.querySelectorAll('.week-nav button app-icon')).map((i) =>
      i.getAttribute('data-icon'),
    );
    expect(names).toEqual(['precedent', 'suivant', 'aujourdhui']);
  });

  // AC1 + AC2 — la gouttière porte une icône par créneau, et chacune est nommée. L'icône y
  // REMPLACE le mot (contrairement au rail, où elle l'accompagne et reste aria-hidden).
  it('AC1/AC2 — la gouttière porte trois icônes de créneau, chacune avec un libellé accessible', () => {
    create();
    const icons = Array.from(el.querySelectorAll('.row-label .slot-icon'));
    expect(icons).toHaveLength(3);
    expect(icons.map((i) => i.getAttribute('data-icon'))).toEqual(['matin', 'apres-midi', 'soir']);
    const svgs = icons.map((i) => i.querySelector('svg')!);
    expect(svgs.map((s) => s.getAttribute('aria-label'))).toEqual(['Matin', 'Après-midi', 'Soir']);
    expect(svgs.some((s) => s.getAttribute('aria-hidden') === 'true')).toBe(false);
  });

  // AC6 — la case du Mois n'en porte pas : la position y dit déjà le créneau. Vérifié ici par
  // l'absence de toute icône hors gouttière dans cette vue (le Mois a sa propre spec, intacte).
  it('AC6 — aucune icône de créneau hors de la gouttière', () => {
    create([seanceEntry(3)], ['mes-seances']);
    expect(el.querySelectorAll('.slot-cell .slot-icon')).toHaveLength(0);
  });

  // AC3/AC4 — le titre est TOUJOURS dans le DOM ; seul le CSS décide de ce qui se voit. jsdom
  // n'évalue pas les container queries : l'assertion porte donc sur la présence, jamais sur la
  // visibilité effective — d'où la vérification visuelle exigée par la story.
  it('AC3/AC4 — la cellule portant une séance rend son titre', () => {
    create([seanceEntry(3)], ['mes-seances']);
    expect(cellAt('EVENING', 3).querySelector('.ev-title')?.textContent?.trim()).toBe(
      'Le Convoi du Nord',
    );
    expect(cellAt('EVENING', 0).querySelector('.ev-title')).toBeNull();
  });

  // AC4 — les informations pratiques sont rendues, et composées par le POINT UNIQUE
  // `composeSeanceInfo` au niveau `compact` (deux champs : l'heure puis le lieu, la note cède).
  it('AC4/AC7 — la cellule rend les informations pratiques au niveau compact', () => {
    create(
      [
        seanceEntry(3, {
          seanceHeure: '20:30',
          seanceLieu: 'chez Marc',
          seanceNote: 'apporter les dés',
        }),
      ],
      ['mes-seances'],
    );
    expect(cellAt('EVENING', 3).querySelector('.ev-info')?.textContent?.trim()).toBe(
      '20:30 · chez Marc',
    );
  });

  // AC10 — un vote est un événement comme un autre : il est nommé. Sa PISTE relève de la 36.6.
  it('AC10 — la cellule nomme un vote en cours', () => {
    create([voteEntry(2)], ['votes-en-cours']);
    expect(cellAt('MORNING', 2).querySelector('.ev-title')?.textContent?.trim()).toBe(
      'Les Cendres d Ashal',
    );
  });

  // AC11 — la couche gouverne le TEXTE ; l'indisponibilité dérivée d'une séance DEMEURE (FR-50).
  it('AC11 — couche eteinte : le titre disparait, l indisponibilite demeure', () => {
    create([seanceEntry(3)], []);
    const cell = cellAt('EVENING', 3);
    expect(cell.querySelector('.ev-title')).toBeNull();
    expect(cell.getAttribute('data-status')).toBe('UNAVAILABLE');
  });

  // AC11 — le rang « vote », lui, EST gouverné par sa couche (décision du 2026-08-18) : couche
  // éteinte, le créneau retombe sur son statut déclaré et ne nomme rien.
  it('AC11 — couche de votes eteinte : le vote n est pas nomme', () => {
    create([voteEntry(2)], []);
    expect(cellAt('MORNING', 2).querySelector('.ev-title')).toBeNull();
  });

  // AC12 — ce que le CSS tronque visuellement n'est JAMAIS tronqué dans le nom accessible.
  it('AC12 — le nom accessible porte le titre complet et les informations pratiques', () => {
    create([seanceEntry(3, { seanceHeure: '20:30', seanceLieu: 'chez Marc' })], ['mes-seances']);
    const label = cellAt('EVENING', 3).getAttribute('aria-label')!;
    expect(label).toContain('Le Convoi du Nord');
    expect(label).toContain('20:30 · chez Marc');
    expect(label).toContain('indisponible');
  });

  // ─── Story 36.6 — la piste de participation ────────────────────────────────────────────────

  // ─── Story 36.7 — l'ouverture du sélecteur de réponse ──────────────────────────────────────

  it('Story 36.7, AC1 — taper une cellule portant une option de vote signale l’option, avec son ancre', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    const cell = cellAt('MORNING', 2);
    tap(cell);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].vote).toEqual(PARTICIPATION);
    expect(emitted[0].slot).toBe('MORNING');
    // L'ancre est la cellule elle-même — aucun nœud ajouté pour la porter (AC14).
    expect(emitted[0].anchor).toBe(cell);
  });

  it('Story 36.7, AC1 — le rail suit quand même', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const slots: any[] = [];
    fixture.componentInstance.slotSelected.subscribe((e: any) => slots.push(e));

    tap(cellAt('MORNING', 2));

    expect(slots).toHaveLength(1);
  });

  it('Story 36.7, AC6 — une sélection armée garde le tap : aucun sélecteur ne s’ouvre', () => {
    vi.useFakeTimers();
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    // Appui maintenu sur une autre cellule → la barre s'ouvre.
    const grid = el.querySelector('.week-grid') as HTMLElement;
    cellAt('MORNING', 4).dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    grid.dispatchEvent(pointer('pointerup'));
    fixture.detectChanges();
    expect(el.querySelector('app-selection-bar')).toBeTruthy();

    tap(cellAt('MORNING', 2));

    expect(emitted).toEqual([]);
    expect(cellAt('MORNING', 2).classList.contains('selected')).toBe(true);
  });

  it('Story 36.7, AC12 — couche « votes-en-cours » éteinte : aucun sélecteur ne s’ouvre', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['mes-seances']);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    tap(cellAt('MORNING', 2));

    expect(emitted).toEqual([]);
  });

  it('Story 36.7 — une séance gagnante n’ouvre aucun sélecteur', () => {
    create(
      [seanceEntry(3), voteEntry(3, { slot: 'EVENING', vote: PARTICIPATION })],
      ['mes-seances', 'votes-en-cours'],
    );
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    tap(cellAt('EVENING', 3));

    expect(emitted).toEqual([]);
  });

  it('Story 36.6, AC1 — une cellule portant un vote rend sa piste de participation', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    expect(cellAt('MORNING', 2).querySelector('app-poll-track')).toBeTruthy();
  });

  it('Story 36.6, AC4 — la cellule de Semaine porte le compteur « 3 / 4 », révélé par le seuil de densité', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const cell = cellAt('MORNING', 2);
    expect(cell.querySelector('.cnt')?.textContent?.trim()).toBe('3 / 4');
    // La bascule passe par une classe d'HÔTE lue depuis `poll-track.scss` — une règle écrite dans
    // `calendar-week-view.scss` n'atteindrait pas `.cnt` (encapsulation de vue).
    expect(cell.querySelector('app-poll-track')!.classList.contains('in-week')).toBe(true);
  });

  it('Story 36.6 — couche de votes éteinte : la piste disparaît avec le titre', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], []);
    expect(cellAt('MORNING', 2).querySelector('app-poll-track')).toBeNull();
  });

  it('Story 36.6, encadré n°8 — une séance gagnante ne porte pas la piste du vote concurrent', () => {
    create(
      [seanceEntry(3), voteEntry(3, { slot: 'EVENING', vote: PARTICIPATION })],
      ['mes-seances', 'votes-en-cours'],
    );
    const cell = cellAt('EVENING', 3);
    expect(cell.getAttribute('data-winner')).toBe('seance');
    expect(cell.querySelector('app-poll-track')).toBeNull();
  });

  it('Story 36.6, AC13 — la cellule SE SIGNALE : data-winner porte le rang, pas seulement le texte', () => {
    create([seanceEntry(3)], ['mes-seances']);
    expect(cellAt('EVENING', 3).getAttribute('data-winner')).toBe('seance');

    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    expect(cellAt('MORNING', 2).getAttribute('data-winner')).toBe('vote');
  });

  it('Story 36.6, AC14 — le nom accessible de la cellule dit la participation et ma réponse', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const label = cellAt('MORNING', 2).getAttribute('aria-label')!;
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_participation_many'], { n: 3, total: 4 }),
    );
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_answer_mine'], {
        answer: GRIMOIRE_TONE['calendar.util_answer_yes'],
      }),
    );
  });

  it('🚨 Story 36.6, AC9 — le nœud de piste reste un descendant porteur de data-cell-date', () => {
    create([voteEntry(2, { vote: PARTICIPATION })], ['votes-en-cours']);
    const cell = cellAt('MORNING', 2);
    const track = cell.querySelector('app-poll-track')!;
    expect(track.closest('[data-cell-date]')).toBe(cell);
  });

  // 🚨 AC9 — LE CONTRAT DOM DU GLISSEMENT. `elementFromPoint` est stubbé partout ailleurs : si un
  // nœud ajouté sortait de la cellule, les 15 tests de glissement resteraient VERTS et le geste
  // serait cassé en production. Ce test-ci est le seul garde-fou, et il n'utilise aucun stub.
  it('AC9 — tout noeud ajoute reste un descendant porteur de data-cell-date', () => {
    create([seanceEntry(3, { seanceHeure: '20:30', seanceLieu: 'chez Marc' })], ['mes-seances']);
    const cell = cellAt('EVENING', 3);
    const title = cell.querySelector('.ev-title')!;
    const info = cell.querySelector('.ev-info')!;
    expect(title.closest('[data-cell-date]')).toBe(cell);
    expect(info.closest('[data-cell-date]')).toBe(cell);
  });

  // ── Story 36.8 — la disponibilité du groupe sur un canal séparé ────────────────────────────

  function groupEntry(dayIndex: number, over: Partial<AgendaEntry> = {}): AgendaEntry {
    return {
      key: `groupe-${dayIndex}`,
      type: 'disponibilite-groupe',
      date: dayKey(dayIndex),
      label: 'Matin — 2/4 disponibles',
      slot: 'MORNING',
      group: { available: 2, unavailable: 1, unknown: 1, total: 4, members: null },
      ...over,
    };
  }

  const GROUP_MEMBERS = [
    { userId: 'mj1', pseudo: 'mj', displayName: 'Le MJ', status: 'AVAILABLE' as const },
    { userId: 'u1', pseudo: 'alice', displayName: 'Alice', status: 'UNAVAILABLE' as const },
  ];

  it('Story 36.8, AC1 — la cellule porte le canal sans que son rang change', () => {
    create([groupEntry(2)], ['disponibilite-groupe']);
    const cell = cellAt('MORNING', 2);

    expect(cell.querySelector('app-group-gauge')).toBeTruthy();
    expect(cell.getAttribute('data-winner')).toBe('none');
  });

  it('🚨 Story 36.8, AC2 — le canal SURVIT sous une séance et sous un vote', () => {
    create(
      [seanceEntry(3), groupEntry(3, { slot: 'EVENING', key: 'groupe-3-ev' })],
      ['mes-seances', 'disponibilite-groupe'],
    );
    const withSeance = cellAt('EVENING', 3);
    expect(withSeance.getAttribute('data-winner')).toBe('seance');
    expect(withSeance.querySelector('app-group-gauge')).toBeTruthy();

    create(
      [voteEntry(2, { vote: PARTICIPATION }), groupEntry(2)],
      ['votes-en-cours', 'disponibilite-groupe'],
    );
    const withVote = cellAt('MORNING', 2);
    expect(withVote.getAttribute('data-winner')).toBe('vote');
    expect(withVote.querySelector('app-group-gauge')).toBeTruthy();
  });

  it('Story 36.8, AC4 — les identités servies produisent une pastille par membre', () => {
    create(
      [groupEntry(2, { group: { ...groupEntry(2).group!, members: GROUP_MEMBERS } })],
      ['disponibilite-groupe'],
    );

    const pastilles = [...cellAt('MORNING', 2).querySelectorAll('.members .p')];
    expect(pastilles.map((p) => p.className)).toEqual(['p p--yes', 'p p--no']);
  });

  it('Story 36.8, AC10 — couche éteinte : aucun canal rendu', () => {
    create([groupEntry(2)], ['mes-seances']);
    expect(cellAt('MORNING', 2).querySelector('app-group-gauge')).toBeNull();
  });

  it('Story 36.8, AC15 — le nom accessible de la cellule dit le groupe', () => {
    create([groupEntry(2)], ['disponibilite-groupe']);
    expect(cellAt('MORNING', 2).getAttribute('aria-label')).toContain('2 sur 4 disponibles');
  });

  it('🚨 Story 36.8, AC12 — le noeud du canal reste un descendant porteur de data-cell-date', () => {
    create([groupEntry(2)], ['disponibilite-groupe']);
    const cell = cellAt('MORNING', 2);
    const gauge = cell.querySelector('app-group-gauge')!;
    expect(gauge.closest('[data-cell-date]')).toBe(cell);
  });

  it('Story 36.8 — le tap sur une cellule à canal reste une LECTURE : rien ne s’ouvre', () => {
    create([groupEntry(2)], ['disponibilite-groupe']);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    tap(cellAt('MORNING', 2));

    expect(emitted).toEqual([]);
  });

  // ─── Story 36.9 — le mode Destinée : l'estompe de la colonne ────────────────────────────────

  function createWithDestiny(dates: ReadonlySet<string> | null): void {
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    fixture.componentRef.setInput('entries', []);
    fixture.componentRef.setInput('activeLayers', ['votes-en-cours']);
    fixture.componentRef.setInput('destinyDates', dates);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  it('Story 36.9, AC1 — hors mode : aucune colonne estompée', () => {
    createWithDestiny(null);
    expect(el.querySelectorAll('.slot-cell--dim')).toHaveLength(0);
  });

  it('Story 36.9, AC1/AC12 — l’unité est le JOUR : toute la colonne s’estompe, en-tête compris', () => {
    createWithDestiny(new Set([dayKey(2)]));

    // Les trois créneaux du jour retenu restent nets…
    for (const slot of ['MORNING', 'AFTERNOON', 'EVENING'] as const) {
      expect(cellAt(slot, 2).classList.contains('slot-cell--dim')).toBe(false);
    }
    // …et ceux des six autres jours sont estompés (3 créneaux × 6 jours).
    expect(el.querySelectorAll('.slot-cell--dim')).toHaveLength(18);

    const headers = Array.from(el.querySelectorAll<HTMLElement>('.col-header'));
    expect(headers[2].classList.contains('col-header--dim')).toBe(false);
    expect(headers[3].classList.contains('col-header--dim')).toBe(true);
  });

  // 🚨 Même défaut que celui trouvé à la vérification visuelle en vue Mois : une semaine qui ne
  // porte aucune date du vote courant s'estompait entièrement, sans rien mettre en avant.
  it('Story 36.9, AC1 — aucune date du vote dans la semaine affichée : RIEN n’est estompé', () => {
    createWithDestiny(new Set(['2026-11-03']));
    expect(el.querySelectorAll('.slot-cell--dim')).toHaveLength(0);
    expect(el.querySelectorAll('.col-header--dim')).toHaveLength(0);
  });

  it('Story 36.9, AC3 — 🚨 une cellule estompée reste PLEINEMENT interactive et annoncée', () => {
    createWithDestiny(new Set([dayKey(2)]));
    const dimmed = cellAt('EVENING', 4);

    expect(dimmed.classList.contains('slot-cell--dim')).toBe(true);
    expect(dimmed.getAttribute('aria-hidden')).toBeNull();
    expect(dimmed.getAttribute('tabindex')).toBe('0');
    expect(dimmed.getAttribute('role')).toBe('button');
    // Le contrat DOM du glissement, inchangé.
    expect(dimmed.getAttribute('data-cell-date')).toBeTruthy();
    expect(dimmed.closest('[data-cell-date]')).toBe(dimmed);
  });

  it('Story 36.9, AC8 — une colonne estompée dont un créneau est SÉLECTIONNÉ cesse de l’être', () => {
    vi.useFakeTimers();
    createWithDestiny(new Set([dayKey(2)]));
    const dimmed = cellAt('EVENING', 4);
    expect(dimmed.classList.contains('slot-cell--dim')).toBe(true);

    dimmed.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();

    expect(cellAt('EVENING', 4).classList.contains('selected')).toBe(true);
    // 🚨 Le JOUR entier se relève, pas seulement la cellule : l'unité de l'estompe est le jour.
    for (const slot of ['MORNING', 'AFTERNOON', 'EVENING'] as const) {
      expect(cellAt(slot, 4).classList.contains('slot-cell--dim')).toBe(false);
    }
    expect(cellAt('EVENING', 5).classList.contains('slot-cell--dim')).toBe(true);
  });
});

// ─── Story 36.10 — le mode de composition réassigne le tap (vue Semaine) ─────

describe('CalendarWeekView — mode de composition (Story 36.10)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  // Semaine future : évite `isPast`, qui retire le rôle bouton et l'aria-label des cellules.
  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(futureStart.getFullYear(), futureStart.getMonth(), futureStart.getDate())),
  );

  /** Le jour de la colonne `i`, dans la convention `YYYY-MM-DD` des clés de composition. */
  function dayKey(i: number): string {
    const d = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i,
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const PARTICIPATION = {
    partieId: 'partie-1',
    pollId: 'poll1',
    optionId: 'opt1',
    yes: 1,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
  };

  function voteEntry(dayIndex: number): AgendaEntry {
    return {
      key: `poll-${dayIndex}`,
      type: 'votes-en-cours',
      date: dayKey(dayIndex),
      label: 'Les Cendres d Ashal',
      slot: 'EVENING',
      partieId: 'partie-1',
      vote: PARTICIPATION,
    } as AgendaEntry;
  }

  function create(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function cellAt(slot: 'MORNING' | 'AFTERNOON' | 'EVENING', dayIndex: number): HTMLElement {
    return Array.from(el.querySelectorAll<HTMLElement>(`.slot-cell[data-cell-slot="${slot}"]`))[
      dayIndex
    ];
  }

  function pointer(type: string, x = 10, y = 10): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true });
  }

  /** Le tap de cette vue n'est PAS un `(click)` : il est synthétisé par `onGridPointerUp()`. */
  function tap(cell: HTMLElement): void {
    const grid = el.querySelector('.week-grid') as HTMLElement;
    cell.dispatchEvent(pointer('pointerdown'));
    grid.dispatchEvent(pointer('pointerup'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('AC2/AC12 — un tap émet composeToggled ET slotSelected, mais n’arme aucune sélection', () => {
    create({ composing: true, composedKeys: new Set<string>() });
    const composed = vi.fn();
    const selected = vi.fn();
    fixture.componentInstance.composeToggled.subscribe(composed);
    fixture.componentInstance.slotSelected.subscribe(selected);

    tap(cellAt('EVENING', 2));

    expect(composed).toHaveBeenCalledTimes(1);
    expect(composed.mock.calls[0][0].slot).toBe('EVENING');
    expect(selected).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  // ── Story 45.3 — le geste des dispos en composition (bloc JUMEAU de la vue Mois) ──

  const barEl = () => el.querySelector('app-selection-bar');
  const barButton = (text: string) =>
    Array.from(el.querySelectorAll('app-selection-bar button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement;
  const gridEl = () => el.querySelector('.week-grid') as HTMLElement;

  /** Appui maintenu sur une cellule, relâché : arme une sélection sur la ligne de cette cellule. */
  function longPressCell(cell: HTMLElement): void {
    cell.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    gridEl().dispatchEvent(pointer('pointerup'));
    fixture.detectChanges();
  }

  it('Story 45.3 — en composition, l’appui maintenu arme une sélection ET ouvre la barre en version composition', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>() });
    const toggled = vi.fn();
    fixture.componentInstance.composeToggled.subscribe(toggled);

    longPressCell(cellAt('EVENING', 2));

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(1);
    expect(barEl()).not.toBeNull();
    expect(barButton(GRIMOIRE_TONE['calendar.selbar_compose_add'])).toBeTruthy();
    expect(barButton(GRIMOIRE_TONE['common.indisponible'])).toBeUndefined();
    expect(toggled).not.toHaveBeenCalled();
  });

  it('Story 45.3 — « Ajouter au vote » émet la sélection et ferme la barre ; « Retirer » émet composeRemoved', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>() });
    const added = vi.fn();
    const removed = vi.fn();
    fixture.componentInstance.composeAdded.subscribe(added);
    fixture.componentInstance.composeRemoved.subscribe(removed);

    longPressCell(cellAt('EVENING', 2));
    barButton(GRIMOIRE_TONE['calendar.selbar_compose_add']).click();
    fixture.detectChanges();
    expect(added).toHaveBeenCalledTimes(1);
    expect(added.mock.calls[0][0].map((c: { slot: string }) => c.slot)).toEqual(['EVENING']);
    expect(barEl()).toBeNull();

    longPressCell(cellAt('MORNING', 3));
    barButton(GRIMOIRE_TONE['calendar.selbar_compose_remove']).click();
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][0].map((c: { slot: string }) => c.slot)).toEqual(['MORNING']);
  });

  it('Story 45.3 — barre ouverte, un tap bascule la cellule dans la SÉLECTION, jamais dans la composition', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>() });
    const toggled = vi.fn();
    fixture.componentInstance.composeToggled.subscribe(toggled);

    longPressCell(cellAt('EVENING', 2));
    tap(cellAt('EVENING', 4));

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(2);
    expect(toggled).not.toHaveBeenCalled();
  });

  it('Story 45.3 — `Échap` ferme d’abord la barre, puis quitte le composer', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>() });
    const cancelled = vi.fn();
    fixture.componentInstance.composeCancelled.subscribe(cancelled);
    const escape = () =>
      gridEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    longPressCell(cellAt('EVENING', 2));
    escape();
    fixture.detectChanges();
    expect(barEl()).toBeNull();
    expect(cancelled).not.toHaveBeenCalled();

    escape();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('Story 45.3 — quitter le composer efface la sélection', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>() });
    longPressCell(cellAt('EVENING', 2));
    expect(barEl()).not.toBeNull();

    fixture.componentRef.setInput('composing', false);
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
    expect(barEl()).toBeNull();
  });

  it('Story 45.3 — sans journée entière (groupe), la barre ne propose pas « Journée »', () => {
    vi.useFakeTimers();
    create({ composing: true, composedKeys: new Set<string>(), composeFullDay: false });
    longPressCell(cellAt('EVENING', 2));

    const labels = Array.from(el.querySelectorAll('app-selection-bar .scope-seg')).map((b) =>
      b.textContent!.trim(),
    );
    expect(labels).toEqual(['Matin', 'Après-m.', 'Soir']);
  });

  it('🚨 AC12 — une cellule portant un VOTE n’ouvre pas le sélecteur de réponse en composition', () => {
    create({
      entries: [voteEntry(2)],
      activeLayers: ['votes-en-cours'],
      composing: true,
      composedKeys: new Set<string>(),
    });
    const voteActivated = vi.fn();
    fixture.componentInstance.voteOptionActivated.subscribe(voteActivated);

    tap(cellAt('EVENING', 2));

    expect(voteActivated).not.toHaveBeenCalled();
  });

  it('hors composition, la même cellule ouvre bien le sélecteur', () => {
    create({ entries: [voteEntry(2)], activeLayers: ['votes-en-cours'] });
    const voteActivated = vi.fn();
    fixture.componentInstance.voteOptionActivated.subscribe(voteActivated);

    tap(cellAt('EVENING', 2));

    expect(voteActivated).toHaveBeenCalledTimes(1);
  });

  it('AC12/AC16 — au clavier, `Espace` compose au lieu d’armer une sélection', () => {
    create({ composing: true, composedKeys: new Set<string>() });
    const composed = vi.fn();
    fixture.componentInstance.composeToggled.subscribe(composed);

    cellAt('AFTERNOON', 3).dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    fixture.detectChanges();

    expect(composed).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['selectedCells']()).toHaveLength(0);
  });

  it('AC3 — `Échap` en composition remonte composeCancelled', () => {
    create({ composing: true, composedKeys: new Set<string>() });
    const cancelled = vi.fn();
    fixture.componentInstance.composeCancelled.subscribe(cancelled);

    (el.querySelector('.week-grid') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('AC13/AC16 — une cellule composée porte sa classe ET son état en toutes lettres', () => {
    create({ composing: true, composedKeys: new Set([`${dayKey(2)}|EVENING`]) });

    const cell = cellAt('EVENING', 2);
    expect(cell.classList.contains('slot-cell--composed')).toBe(true);
    expect(cell.getAttribute('aria-label')).toContain(GRIMOIRE_TONE['common.designe_pour_le_vote']);

    const other = cellAt('MORNING', 2);
    expect(other.classList.contains('slot-cell--composed')).toBe(false);
    expect(other.getAttribute('aria-label')).not.toContain('désigné pour le vote');
  });

  it('AC13 — composé et sélectionné sont DEUX traitements distincts', () => {
    create({ composing: true, composedKeys: new Set([`${dayKey(2)}|EVENING`]) });
    const cell = cellAt('EVENING', 2);
    expect(cell.classList.contains('slot-cell--composed')).toBe(true);
    expect(cell.classList.contains('selected')).toBe(false);
  });

  // ⚠️ Story 47.4 — bloc JUMEAU de la vue Mois : l'aperçu des plages.
  it('Story 47.4 — le départ garde son tireté, les créneaux couverts prennent l’aperçu', () => {
    create({
      composing: true,
      composedKeys: new Set([`${dayKey(2)}|EVENING`]),
      composeCoverKeys: new Set([`${dayKey(3)}|MORNING`, `${dayKey(3)}|AFTERNOON`]),
      composeDuration: 3,
    });

    expect(cellAt('EVENING', 2).classList.contains('slot-cell--span-preview')).toBe(false);
    expect(cellAt('MORNING', 3).classList.contains('slot-cell--span-preview')).toBe(true);
    expect(cellAt('AFTERNOON', 3).classList.contains('slot-cell--span-preview')).toBe(true);
    expect(cellAt('EVENING', 3).classList.contains('slot-cell--span-preview')).toBe(false);
  });

  it('Story 47.4 — au survol, la plage qu’ouvrirait la cellule s’allume ; à 1 créneau, rien', () => {
    create({ composing: true, composedKeys: new Set<string>(), composeDuration: 2 });

    cellAt('EVENING', 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    fixture.detectChanges();
    expect(cellAt('EVENING', 2).classList.contains('slot-cell--span-preview')).toBe(true);
    expect(cellAt('MORNING', 3).classList.contains('slot-cell--span-preview')).toBe(true);

    cellAt('EVENING', 2).dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    fixture.detectChanges();
    expect(el.querySelectorAll('.slot-cell--span-preview')).toHaveLength(0);

    // Au doigt, l'entrée émulée après un tap n'a pas de sortie : elle n'allume rien.
    cellAt('EVENING', 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    fixture.detectChanges();
    expect(el.querySelectorAll('.slot-cell--span-preview')).toHaveLength(0);

    fixture.componentRef.setInput('composeDuration', 1);
    cellAt('EVENING', 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    fixture.detectChanges();
    expect(el.querySelectorAll('.slot-cell--span-preview')).toHaveLength(0);
  });
});

// ─── Story 36.15 — Sceller depuis la barre de sélection ──────────────────────

describe('CalendarWeekView — sceller depuis la barre de sélection (Story 36.15)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(futureStart.getFullYear(), futureStart.getMonth(), futureStart.getDate())),
  );

  function dayKey(i: number): string {
    const d = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i,
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const PARTICIPATION = {
    partieId: 'partie-1',
    pollId: 'poll1',
    optionId: 'opt1',
    yes: 2,
    maybe: 1,
    no: 0,
    total: 4,
    myAnswer: null,
  };

  /** Vote OPEN sur mercredi (index 2) soir — `entries()` ne porte jamais de vote CLOSED
   *  (cf. `CalendarView.activePolls()`, filtré `status === 'OPEN'`). */
  function voteEntry(
    dayIndex: number,
    slot: 'MORNING' | 'AFTERNOON' | 'EVENING' = 'EVENING',
  ): AgendaEntry {
    return {
      key: `poll-${dayIndex}`,
      type: 'votes-en-cours',
      date: dayKey(dayIndex),
      label: 'Les Cendres d’Ashal',
      slot,
      partieId: 'partie-1',
      vote: PARTICIPATION,
    } as AgendaEntry;
  }

  function create(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function selectSingle(
    dayIndex: number,
    slot: 'MORNING' | 'AFTERNOON' | 'EVENING' = 'EVENING',
  ): void {
    const date = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + dayIndex,
    );
    (fixture.componentInstance as any).selectedCells.set([{ date, slot }]);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('AC1 — sealCandidate résout le triplet depuis l’entrée votes-en-cours correspondante', () => {
    create({ canSeal: true, entries: [voteEntry(2)] });
    selectSingle(2, 'EVENING');
    const candidate = (fixture.componentInstance as any).sealCandidate();
    expect(candidate).toEqual({
      partieId: 'partie-1',
      pollId: 'poll1',
      optionId: 'opt1',
      dateLabel: expect.stringContaining('soir'),
      pollLabel: 'Les Cendres d’Ashal',
    });
  });

  it('Story 47.5 — sealCandidate d’une plage porte « début → fin », pas seulement le créneau de départ', () => {
    create({
      canSeal: true,
      entries: [{ ...voteEntry(2, 'EVENING'), endDate: dayKey(4), endSlot: 'AFTERNOON' } as AgendaEntry],
    });
    selectSingle(2, 'EVENING');
    const candidate = (fixture.componentInstance as any).sealCandidate();
    expect(candidate.dateLabel).toMatch(
      /^[^ ]+\. \d{1,2} [^ ]+ soir → [^ ]+\. \d{1,2} [^ ]+ après-midi$/,
    );
    // Un créneau seul garde son écriture d'avant (sans flèche).
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
    create({ canSeal: true, entries: [voteEntry(2, 'EVENING')] });
    selectSingle(2, 'EVENING');
    expect((fixture.componentInstance as any).sealCandidate().dateLabel).not.toContain('→');
  });

  it('AC1 — le bouton Sceller est rendu dans la barre de sélection', () => {
    create({ canSeal: true, entries: [voteEntry(2)] });
    selectSingle(2, 'EVENING');
    expect(el.querySelector('.seal-btn')).not.toBeNull();
  });

  it('AC2 — sealCandidate est null quand aucune entrée ne correspond au créneau sélectionné', () => {
    create({ canSeal: true, entries: [voteEntry(2, 'EVENING')] });
    selectSingle(2, 'MORNING'); // même jour, autre créneau
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC3 — sealCandidate est null quand canSeal est faux, même avec une entrée correspondante', () => {
    create({ canSeal: false, entries: [voteEntry(2)] });
    selectSingle(2, 'EVENING');
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('Revue de code — deux entrées votes-en-cours sur le MÊME créneau (deux votes OPEN concurrents) → sealCandidate est null, jamais le premier match silencieux', () => {
    const other = { ...voteEntry(2, 'EVENING'), key: 'poll-2-bis', label: 'Autre scénario' };
    create({ canSeal: true, entries: [voteEntry(2, 'EVENING'), other] });
    selectSingle(2, 'EVENING');
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC4 — sealCandidate est null sur une sélection de plusieurs créneaux', () => {
    create({ canSeal: true, entries: [voteEntry(2)] });
    const date = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + 2,
    );
    (fixture.componentInstance as any).selectedCells.set([
      { date, slot: 'EVENING' },
      { date, slot: 'AFTERNOON' },
    ]);
    fixture.detectChanges();
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC5/AC6 — un clic sur Sceller émet sealRequested avec le candidat, sans appel réseau ici', () => {
    create({ canSeal: true, entries: [voteEntry(2)] });
    selectSingle(2, 'EVENING');
    const spy = vi.fn();
    fixture.componentInstance.sealRequested.subscribe(spy);
    (el.querySelector('.seal-btn') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ pollId: 'poll1', optionId: 'opt1' }),
    );
  });
});

// ─── Story 46.2 — la fenêtre de l'automate sélectionnée : contour plein, jamais tireté ──────────
describe('CalendarWeekView — fenêtre de l’automate sélectionnée (Story 46.2)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())),
  );
  const dayKey = (i: number) => {
    const y = weekStart.getUTCFullYear();
    const d = new Date(y, weekStart.getUTCMonth(), weekStart.getUTCDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function create(windowKey: string | null): void {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', start);
    fixture.componentRef.setInput('entries', []);
    fixture.componentRef.setInput('activeLayers', []);
    fixture.componentRef.setInput('windowKey', windowKey);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }
  const cellAt = (slot: 'MORNING' | 'AFTERNOON' | 'EVENING', i: number) =>
    Array.from(el.querySelectorAll<HTMLElement>(`.slot-cell[data-cell-slot="${slot}"]`))[i];

  afterEach(() => TestBed.resetTestingModule());

  it('sans fenêtre : aucune cellule contournée', () => {
    create(null);
    expect(el.querySelectorAll('.slot-cell--window')).toHaveLength(0);
  });

  it('la cellule de la fenêtre porte le contour, et elle seule', () => {
    create(`${dayKey(2)}|EVENING`);
    expect(el.querySelectorAll('.slot-cell--window')).toHaveLength(1);
    expect(cellAt('EVENING', 2).classList).toContain('slot-cell--window');
    expect(cellAt('MORNING', 2).classList).not.toContain('slot-cell--window');
  });

  it('son nom accessible dit « fenêtre sélectionnée » (jamais le contour seul)', () => {
    create(`${dayKey(2)}|EVENING`);
    expect(cellAt('EVENING', 2).getAttribute('aria-label')).toContain(
      TONE_MAP['grimoire-emeraude']['calendar.window_selected_aria'],
    );
    expect(cellAt('EVENING', 3).getAttribute('aria-label')).not.toContain(
      TONE_MAP['grimoire-emeraude']['calendar.window_selected_aria'],
    );
  });
});

describe('CalendarWeekView — une plage sur la semaine (Story 47.3)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(futureStart.getFullYear(), futureStart.getMonth(), futureStart.getDate())),
  );
  const dayKey = (i: number): string => {
    const d = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i,
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const cellAt = (slot: string, dayIndex: number): HTMLElement =>
    Array.from(el.querySelectorAll<HTMLElement>(`.slot-cell[data-cell-slot="${slot}"]`))[dayIndex];

  /** Vendredi soir → dimanche après-midi (jours 4 à 6 de la semaine). */
  const weekend = (over: Partial<AgendaEntry> = {}): AgendaEntry => ({
    key: 'seance-w',
    type: 'mes-seances',
    date: dayKey(4),
    slot: 'EVENING',
    endDate: dayKey(6),
    endSlot: 'AFTERNOON',
    label: 'Week-end jeux',
    partieId: 'p1',
    scenarioId: 's1',
    ...over,
  });

  function create(entries: AgendaEntry[], layers: CalendarLayerKey[] = ['mes-seances']): void {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('activeLayers', layers);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('les 6 cellules couvertes sont marquées comme une séance, le soir du dimanche reste libre', () => {
    create([weekend()]);
    const winners = [
      cellAt('EVENING', 4),
      cellAt('MORNING', 5),
      cellAt('AFTERNOON', 5),
      cellAt('EVENING', 5),
      cellAt('MORNING', 6),
      cellAt('AFTERNOON', 6),
    ].map((c) => c.getAttribute('data-winner'));
    expect(winners).toEqual(Array(6).fill('seance'));
    expect(cellAt('EVENING', 6).getAttribute('data-winner')).not.toBe('seance');
    expect(cellAt('MORNING', 4).getAttribute('data-winner')).not.toBe('seance');
  });

  it('le nom n’est écrit qu’une fois dans la semaine ; chaque cellule couverte dit la plage entière', () => {
    create([weekend()]);
    const titles = Array.from(el.querySelectorAll('.ev-title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['Week-end jeux']);
    const label = cellAt('AFTERNOON', 5).getAttribute('aria-label') ?? '';
    expect(label).toContain('Week-end jeux, du vendredi');
    expect(label).toContain('au dimanche');
  });

  it('chaque cellule couverte garde le style d\'une cellule d\'événement, même sans texte', () => {
    create([weekend()]);
    expect(cellAt('AFTERNOON', 5).classList.contains('has-event')).toBe(true);
    expect(cellAt('EVENING', 5).classList.contains('has-event')).toBe(true);
    expect(cellAt('EVENING', 6).classList.contains('has-event')).toBe(false);
  });

  it('connecteurs : le soir continue, le matin suivant vient de la veille', () => {
    create([weekend()]);
    expect(cellAt('EVENING', 4).classList.contains('slot-cell--span-next')).toBe(true);
    expect(cellAt('MORNING', 5).classList.contains('slot-cell--span-prev')).toBe(true);
    expect(cellAt('EVENING', 5).classList.contains('slot-cell--span-next')).toBe(true);
    expect(cellAt('MORNING', 6).classList.contains('slot-cell--span-prev')).toBe(true);
    expect(cellAt('AFTERNOON', 5).classList.contains('slot-cell--span-next')).toBe(false);
    expect(cellAt('AFTERNOON', 6).classList.contains('slot-cell--span-next')).toBe(false);
  });

  it('une plage commencée la semaine d’avant : la première cellule visible reprend « ← »', () => {
    create([weekend({ date: dayKey(-2), slot: 'EVENING', endDate: dayKey(1), endSlot: 'AFTERNOON' })]);
    const titles = Array.from(el.querySelectorAll('.ev-title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['← Week-end jeux']);
  });

  it('un créneau seul : ni connecteur ni plage', () => {
    create([weekend({ endDate: undefined, endSlot: undefined })]);
    expect(el.querySelector('.slot-cell--span-next, .slot-cell--span-prev')).toBeNull();
    expect(cellAt('MORNING', 5).getAttribute('data-winner')).not.toBe('seance');
  });
});

describe('CalendarWeekView — plusieurs plages d’un même vote (Story 47.5)', () => {
  let fixture: ComponentFixture<CalendarWeekView>;
  let el: HTMLElement;

  const futureStart = new Date();
  futureStart.setDate(futureStart.getDate() + 14);
  const weekStart = getWeekStart(
    new Date(Date.UTC(futureStart.getFullYear(), futureStart.getMonth(), futureStart.getDate())),
  );
  const dayKey = (i: number): string => {
    const d = new Date(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + i,
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const cellAt = (slot: string, dayIndex: number): HTMLElement =>
    Array.from(el.querySelectorAll<HTMLElement>(`.slot-cell[data-cell-slot="${slot}"]`))[dayIndex];

  const participation = (optionId: string) => ({
    partieId: 'p1',
    pollId: 'poll-1',
    optionId,
    yes: 1,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
  });
  // Durée 3 : (a) jour 5 matin → soir ; (b) jour 5 après-midi → jour 6 matin. Recouvrement : après-midi et soir du jour 5.
  const optionA: AgendaEntry = {
    key: 'poll-1-a',
    type: 'votes-en-cours',
    date: dayKey(5),
    slot: 'MORNING',
    endDate: dayKey(5),
    endSlot: 'EVENING',
    label: 'Week-end jeux',
    vote: participation('a'),
  };
  const optionB: AgendaEntry = {
    key: 'poll-1-b',
    type: 'votes-en-cours',
    date: dayKey(5),
    slot: 'AFTERNOON',
    endDate: dayKey(6),
    endSlot: 'MORNING',
    label: 'Week-end jeux',
    vote: participation('b'),
  };

  function create(entries: AgendaEntry[], layers: CalendarLayerKey[] = ['votes-en-cours']): void {
    TestBed.configureTestingModule({ imports: [CalendarWeekView] });
    fixture = TestBed.createComponent(CalendarWeekView);
    fixture.componentRef.setInput('startDate', futureStart);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('activeLayers', layers);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  /** Le tap de la vue Semaine est synthétisé par `onGridPointerUp()` (cf. Story 36.7). */
  function tap(cell: HTMLElement): void {
    const grid = el.querySelector('.week-grid') as HTMLElement;
    const ev = (type: string) =>
      new PointerEvent(type, { clientX: 10, clientY: 10, pointerType: 'mouse', bubbles: true });
    cell.dispatchEvent(ev('pointerdown'));
    grid.dispatchEvent(ev('pointerup'));
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('« ×2 » sur chaque cellule recouverte deux fois, rien ailleurs ; il entre dans le nom accessible', () => {
    create([optionA, optionB]);

    expect(cellAt('AFTERNOON', 5).querySelector('.ev-overlap')?.textContent?.trim()).toBe('×2');
    expect(cellAt('EVENING', 5).querySelector('.ev-overlap')?.textContent?.trim()).toBe('×2');
    expect(cellAt('MORNING', 5).querySelector('.ev-overlap')).toBeNull();
    expect(cellAt('MORNING', 6).querySelector('.ev-overlap')).toBeNull();
    expect(cellAt('AFTERNOON', 5).getAttribute('aria-label')).toContain(
      '2 plages se superposent (×2)',
    );
    expect(cellAt('MORNING', 5).getAttribute('aria-label')).not.toContain('×');
  });

  it('une seule plage sur le créneau, ou un créneau seul : pas de « ×n »', () => {
    create([optionA]);
    expect(el.querySelector('.ev-overlap')).toBeNull();
    TestBed.resetTestingModule();
    create([{ ...optionA, endDate: undefined, endSlot: undefined }]);
    expect(el.querySelector('.ev-overlap')).toBeNull();
  });

  it('toucher la cellule recouverte signale TOUTES les plages qui la couvrent, dans l’ordre de leur début', () => {
    create([optionB, optionA]);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    tap(cellAt('AFTERNOON', 5));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].lines.map((l: any) => l.vote.optionId)).toEqual(['a', 'b']);
  });

  it('toucher une cellule couverte une seule fois : une seule ligne', () => {
    create([optionA, optionB]);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    tap(cellAt('MORNING', 5));

    expect(emitted[0].lines.map((l: any) => l.vote.optionId)).toEqual(['a']);
  });

  it('couche « votes en cours » éteinte : ni marque ni signal', () => {
    create([optionA, optionB], ['mes-seances']);
    expect(el.querySelector('.ev-overlap')).toBeNull();
  });
});
