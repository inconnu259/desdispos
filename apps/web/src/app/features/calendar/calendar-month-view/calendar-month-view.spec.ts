import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarMonthView, buildMonth } from './calendar-month-view';
import { LONG_PRESS_MS } from '../selection.utils';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

describe('buildMonth', () => {
  it('returns 6 weeks of 7 days', () => {
    const result = buildMonth(new Date(2026, 5, 1), [], [], [], null);
    expect(result).toHaveLength(6);
    result.forEach((week) => expect(week).toHaveLength(7));
  });

  it('marks today as isToday in the current month view', () => {
    const today = new Date();
    const display = new Date(today.getFullYear(), today.getMonth(), 1);
    const weeks = buildMonth(display, [], [], [], null);
    const allCells = weeks.flat();

    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);

    const todayCell = allCells.find((c) => {
      const cellMidnight = new Date(c.date);
      cellMidnight.setHours(0, 0, 0, 0);
      return cellMidnight.getTime() === todayMidnight.getTime();
    });

    expect(todayCell).toBeDefined();
    expect(todayCell?.isToday).toBe(true);
  });

  // AC3 : isToday ne doit PAS dépendre d'un snapshot statique — chaque appel de buildMonth
  // recalcule le jour courant. Ce test vérifie que le mois précédent ne contient aucun isToday
  // parmi ses propres jours (les cellules de débordement d'un autre mois peuvent légitimement
  // inclure aujourd'hui et ne sont donc pas concernées par cette assertion).
  it('does not mark any cell as isToday in a past month', () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const display = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const weeks = buildMonth(display, [], [], [], null);
    const currentMonthCells = weeks.flat().filter((c) => c.isCurrentMonth);
    expect(currentMonthCells.every((c) => !c.isToday)).toBe(true);
  });

  it('marks cells of previous and next months as isCurrentMonth = false', () => {
    // Juin 2026 : le 1er est un lundi, donc pas de cellules d'autres mois avant.
    // Juillet 2026 : le 1er est un mercredi, donc on a lundi et mardi du mois précédent.
    const display = new Date(2026, 6, 1); // juillet 2026
    const weeks = buildMonth(display, [], [], [], null);
    const firstWeek = weeks[0];
    // Les 2 premières cellules sont en juin
    expect(firstWeek[0].isCurrentMonth).toBe(false); // lun 29 juin
    expect(firstWeek[1].isCurrentMonth).toBe(false); // mar 30 juin
    expect(firstWeek[2].isCurrentMonth).toBe(true); // mer 1er juillet
  });

  it('marks all current-month cells as isCurrentMonth = true', () => {
    const display = new Date(2026, 5, 1); // juin 2026
    const weeks = buildMonth(display, [], [], [], null);
    const currentMonthCells = weeks.flat().filter((c) => c.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(30); // juin a 30 jours
  });
});

describe('CalendarMonthView — navigation UTC-midnight (Q8)', () => {
  function isUtcMidnight(d: Date): boolean {
    return d.getTime() % 86_400_000 === 0;
  }

  async function createMonthView() {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CalendarMonthView);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('la navigation porte les pictogrammes precedent, suivant puis aujourdhui, dans cet ordre', async () => {
    const fixture = await createMonthView();
    const names = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.month-nav button app-icon'),
    ).map((i) => i.getAttribute('data-icon'));
    expect(names).toEqual(['precedent', 'suivant', 'aujourdhui']);
  });

  it('goToToday() émet un Date UTC-midnight', async () => {
    const fixture = await createMonthView();
    const emitted: Date[] = [];
    fixture.componentInstance.displayDateChange.subscribe((d) => emitted.push(d));
    fixture.componentInstance.goToToday();
    expect(emitted).toHaveLength(1);
    expect(isUtcMidnight(emitted[0])).toBe(true);
    const today = new Date();
    expect(emitted[0].getUTCDate()).toBe(today.getUTCDate());
    expect(emitted[0].getUTCMonth()).toBe(today.getUTCMonth());
  });

  it('nextMonth() émet un Date UTC-midnight au 1er du mois suivant', async () => {
    const fixture = await createMonthView();
    const emitted: Date[] = [];
    fixture.componentInstance.displayDateChange.subscribe((d) => emitted.push(d));
    fixture.componentInstance.nextMonth();
    expect(emitted).toHaveLength(1);
    expect(isUtcMidnight(emitted[0])).toBe(true);
    expect(emitted[0].getUTCDate()).toBe(1);
  });

  it('prevMonth() émet un Date UTC-midnight au 1er du mois précédent', async () => {
    const fixture = await createMonthView();
    const emitted: Date[] = [];
    fixture.componentInstance.displayDateChange.subscribe((d) => emitted.push(d));
    fixture.componentInstance.prevMonth();
    expect(emitted).toHaveLength(1);
    expect(isUtcMidnight(emitted[0])).toBe(true);
    expect(emitted[0].getUTCDate()).toBe(1);
  });
});

describe('CalendarMonthView — accessibilité clavier des bandes (touches 1/2/3)', () => {
  async function createMonthView() {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CalendarMonthView);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it("touche '1' sur la cellule du jour → sélectionne le créneau MORNING (équivalent clavier de la bande matin)", async () => {
    const fixture = await createMonthView();
    const emitted: { date: Date; slot: string }[] = [];
    fixture.componentInstance.slotSelected.subscribe((e) => emitted.push(e));

    const cell = fixture.nativeElement.querySelector('.day-cell.today') as HTMLElement;
    expect(cell).toBeTruthy();
    cell.dispatchEvent(new KeyboardEvent('keyup', { key: '1' }));
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('MORNING');
  });

  it("touche '2' sur la cellule du jour → sélectionne le créneau AFTERNOON", async () => {
    const fixture = await createMonthView();
    const emitted: { date: Date; slot: string }[] = [];
    fixture.componentInstance.slotSelected.subscribe((e) => emitted.push(e));

    const cell = fixture.nativeElement.querySelector('.day-cell.today') as HTMLElement;
    cell.dispatchEvent(new KeyboardEvent('keyup', { key: '2' }));
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('AFTERNOON');
  });

  it("touche '3' sur la cellule du jour → sélectionne le créneau EVENING", async () => {
    const fixture = await createMonthView();
    const emitted: { date: Date; slot: string }[] = [];
    fixture.componentInstance.slotSelected.subscribe((e) => emitted.push(e));

    const cell = fixture.nativeElement.querySelector('.day-cell.today') as HTMLElement;
    cell.dispatchEvent(new KeyboardEvent('keyup', { key: '3' }));
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('EVENING');
  });

  it("Story 35.2 : nom accessible d'une case — « {jour} (aujourd'hui) » pour aujourd'hui, le numéro seul pour un autre jour, aucun hors du mois", async () => {
    const fixture = await createMonthView();
    const root = fixture.nativeElement as HTMLElement;

    const today = root.querySelector('.day-cell.today') as HTMLElement;
    expect(today.getAttribute('aria-label')).toBe(`${new Date().getDate()} (aujourd'hui)`);

    const others = [
      ...root.querySelectorAll<HTMLElement>('.day-cell:not(.today):not(.other-month)'),
    ];
    expect(others.length).toBeGreaterThan(0);
    for (const cell of others) {
      expect(cell.getAttribute('aria-label')).toMatch(/^\d{1,2}$/);
    }

    const outside = root.querySelector('.day-cell.other-month') as HTMLElement | null;
    if (outside) expect(outside.getAttribute('aria-label')).toBeNull();
  });

  it('la cellule interactive référence les instructions clavier via aria-describedby', async () => {
    const fixture = await createMonthView();
    const cell = fixture.nativeElement.querySelector('.day-cell.today') as HTMLElement;
    expect(cell.getAttribute('aria-describedby')).toBe('month-cell-instructions');
    const instructions = fixture.nativeElement.querySelector('#month-cell-instructions');
    expect(instructions).toBeTruthy();
    expect(instructions.textContent).toContain('1');
  });
});

// ─── Sélection par glissement (Story 30.3) ────────────────────────────────────

describe('CalendarMonthView — sélection par glissement', () => {
  let fixture: Awaited<ReturnType<typeof createMonthView>>;
  let el: HTMLElement;

  async function createMonthView() {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.detectChanges();
    return f;
  }

  function dayCells(): HTMLElement[] {
    return Array.from(el.querySelectorAll('.day-cell:not(.other-month):not(.past)'));
  }

  function allDayCells(): HTMLElement[] {
    return Array.from(el.querySelectorAll('.day-cell'));
  }

  function pointerEvent(type: string, x: number, y: number, pointerType = 'mouse'): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerType, bubbles: true });
  }

  beforeEach(() => {
    // 10 août 2026 — milieu de mois, marge suffisante avant/après pour tester un glissement
    // sans dépendre du jour réel d'exécution des tests.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(async () => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // ⚠️ Story 36.3, AC15 — un tap COURT est un geste de lecture : le rail suit (AC2 de 36.1) et
  // rien ne s'ouvre. Ni le panneau (AC1), ni la barre.
  it('AC15 — un tap court ne fait que peupler le rail : aucune barre, aucune sélection', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const spy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(spy);
    const cell = dayCells()[0];
    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    const grid = el.querySelector('.calendar-grid') as HTMLElement;
    grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  it('AC15 — un appui maintenu à la SOURIS arme la sélection et affiche la barre', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cell = dayCells()[0];

    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);
    expect(el.querySelector('app-selection-bar')).not.toBeNull();
  });

  it('AC15 — la barre survit au relâchement de l’appui maintenu, CLIC DU NAVIGATEUR COMPRIS', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cell = dayCells()[0];
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
    // Le navigateur émet un `click` derrière tout `pointerup` sans déplacement. Sans garde, il
    // rebasculait la case et l'appui maintenu ressortait aussitôt du mode modification.
    (cell.querySelector('.band') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);
    expect(el.querySelector('app-selection-bar')).not.toBeNull();
  });

  it('glissement souris sur plusieurs jours → sélectionne la plage à la journée entière (AC2)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const tapSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(tapSpy);
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(3);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  // Story 36.2 : les bandes remplacent les segments comme cible de pointeur. Ces deux tests
  // protègent le mécanisme `fromBand` (ex-`fromSegment`) — ils sont transposés, pas supprimés.
  it('un tap rapide (sans glissement) sur une bande ne rejoue pas un tap FULL_DAY en double', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const tapSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(tapSpy);
    const band = el.querySelector('.day-cell:not(.other-month):not(.past) .band') as HTMLElement;
    const grid = el.querySelector('.calendar-grid') as HTMLElement;
    band.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    grid.dispatchEvent(pointerEvent('pointerup', 0, 0));

    // La bande gère son propre tap via (click), simulé indépendamment ici : on vérifie
    // uniquement que notre mécanisme de geste (pointerdown/up) n'émet pas lui-même de FULL_DAY.
    expect(tapSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });

  it('un glissement parti d’une bande arme quand même une sélection de journée (le bug corrigé)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cells = dayCells();
    const band = cells[0].querySelector('.band') as HTMLElement;
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    band.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(3);
  });

  it('Échap efface la sélection sans émettre de lot', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(3);

    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('validation via la barre de sélection émet batchDeclareRequested en FULL_DAY', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[1]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();
    grid.dispatchEvent(pointerEvent('pointerup', 50, 0));
    fixture.detectChanges();

    const availableBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Disponible',
    )!;
    availableBtn.click();

    expect(batchSpy).toHaveBeenCalledTimes(1);
    const payload = batchSpy.mock.calls[0][0];
    expect(payload.kind).toBe('AVAILABLE');
    expect(payload.cells).toHaveLength(2);
    expect(payload.cells.every((c: { slot: string }) => c.slot === 'FULL_DAY')).toBe(true);
  });

  it('Maj+flèche droite étend la sélection à la journée entière (AC5)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cells = dayCells();
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });

    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(2);

    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(3);
  });

  // ⚠️ Story 36.3, AC6 — remplace « Entrée valide avec Indisponible d'office » (story 30.3).
  // `Entrée` valide désormais CE QUE LA BARRE AFFICHE, dans les deux sens.
  it('AC6 — Entrée valide la sélection avec l’intention armée par la barre', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = dayCells();
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });

    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    cells[0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

    // Par défaut la barre affiche « Indisponible » — le résultat observable ne change pas
    // pour qui ne touche à rien.
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0][0].kind).toBe('UNAVAILABLE');
    expect(batchSpy.mock.calls[0][0].cells).toHaveLength(2);

    // Mais la barre fait foi : armer « Disponible » change ce que valide `Entrée`.
    cells[0].dispatchEvent(shiftRight);
    fixture.detectChanges();
    fixture.componentInstance['onArmedKindChange']('AVAILABLE');
    fixture.detectChanges();
    cells[0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

    expect(batchSpy).toHaveBeenCalledTimes(2);
    expect(batchSpy.mock.calls[1][0].kind).toBe('AVAILABLE');
  });

  // ⚠️ Story 36.3, AC7 — remplace « Entrée sans sélection ouvre le panneau ». Second point de
  // l'encadré de dette : `Espace` garde la journée, `Entrée` est réservée à la validation.
  it('AC7 — Entrée sans sélection armée ne fait rien', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const slotSpy = vi.fn();
    const batchSpy = vi.fn();
    fixture.componentInstance.slotSelected.subscribe(slotSpy);
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cell = dayCells()[0];

    cell.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(slotSpy).not.toHaveBeenCalled();
    expect(batchSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });

  it('AC7 — Espace sélectionne la journée entière', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cell = dayCells()[0];

    cell.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);
    expect(fixture.componentInstance['scope']()).toBe('FULL_DAY');
  });

  it('AC3 — la portée gouverne le créneau écrit, pour toute la sélection', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();
    grid.dispatchEvent(pointerEvent('pointerup', 50, 0));
    fixture.detectChanges();

    fixture.componentInstance['onScopeChange']('EVENING');
    fixture.detectChanges();
    fixture.componentInstance['onSelectionCommit']('UNAVAILABLE');

    const payload = batchSpy.mock.calls[0][0];
    expect(payload.cells).toHaveLength(3);
    expect(payload.cells.every((c: { slot: string }) => c.slot === 'EVENING')).toBe(true);
  });

  it('AC4 — « Autre… » émet declarationPanelRequested sur l’ancre, à la portée courante', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const spy = vi.fn();
    fixture.componentInstance.declarationPanelRequested.subscribe(spy);
    const cell = dayCells()[0];
    cell.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    fixture.componentInstance['onScopeChange']('MORNING');
    fixture.detectChanges();

    const otherBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === GRIMOIRE_TONE['calendar.selbar_other'],
    )!;
    otherBtn.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].slot).toBe('MORNING');
    // La sélection a remis son intention au panneau : elle ne survit pas.
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });

  it('AC5 — un glissement souris à dominante verticale n’arme rien (il défile)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[2]);
    grid.dispatchEvent(pointerEvent('pointermove', 5, 60));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });

  it('AC5 — une fois armée, la sélection s’étend même verticalement (pas de test d’axe)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const cells = dayCells();
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    cells[0].dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cells[1]);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0)); // arme (horizontal)
    fixture.detectChanges();
    document.elementFromPoint = vi.fn().mockReturnValue(cells[8]);
    grid.dispatchEvent(pointerEvent('pointermove', 55, 90)); // enjambe une ligne de semaine
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(9);
  });

  it('AC9 — un double-clic ne déclenche aucune action propre et n’enregistre rien', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const batchSpy = vi.fn();
    fixture.componentInstance.batchDeclareRequested.subscribe(batchSpy);
    const cell = dayCells()[0];
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    for (let i = 0; i < 2; i++) {
      cell.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      grid.dispatchEvent(pointerEvent('pointerup', 10, 10));
    }
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    // Deux taps courts successifs restent deux lectures : aucune barre, aucune écriture (AC15).
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('le glissement ne s’étend pas sur un jour hors du mois affiché (review finding)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const all = allDayCells();
    const currentMonthCells = dayCells();
    const lastCurrent = currentMonthCells[currentMonthCells.length - 1];
    const lastCurrentIndex = all.indexOf(lastCurrent);
    const otherMonthCell = all[lastCurrentIndex + 1];
    expect(otherMonthCell.classList.contains('other-month')).toBe(true);
    const grid = el.querySelector('.calendar-grid') as HTMLElement;

    lastCurrent.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(otherMonthCell);
    grid.dispatchEvent(pointerEvent('pointermove', 50, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);
  });

  it('Maj+flèche droite ne s’étend pas sur un jour hors du mois affiché (review finding)', async () => {
    fixture = await createMonthView();
    el = fixture.nativeElement;
    const currentMonthCells = dayCells();
    const lastCurrent = currentMonthCells[currentMonthCells.length - 1];
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
    });

    lastCurrent.dispatchEvent(shiftRight);
    fixture.detectChanges();

    // Aucune extension possible depuis ce jour (limite du mois) : l'ancre est posée mais la
    // cellule courante n'avance jamais vers le mois suivant, la sélection reste vide.
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.2 — la case à trois bandes et la préséance
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — les trois bandes', () => {
  let fixture: any;
  let el: HTMLElement;

  const ALL_LAYERS = [
    'mes-indisponibilites',
    'mes-disponibilites',
    'mes-seances',
    'votes-en-cours',
    'inscriptions-ouvertes',
    'disponibilite-groupe',
  ] as any[];

  function seance(
    date: string,
    slot: string | undefined = 'EVENING',
    infos: Record<string, unknown> = {},
  ) {
    return {
      key: 'seance-s1',
      type: 'mes-seances',
      date,
      label: 'Le Convoi du Nord',
      slot,
      partieId: 'p1',
      scenarioId: 'sc1',
      seanceId: 's1',
      ...infos,
    } as any;
  }

  function vote(date: string, slot = 'MORNING', participation?: Record<string, unknown>) {
    return {
      key: 'poll-p1-o1',
      type: 'votes-en-cours',
      date,
      label: 'Ashal',
      slot,
      // Story 36.6 — la participation portée par l'option (absente = piste non rendue).
      vote: participation,
    } as any;
  }

  function decl(over: Record<string, unknown> = {}) {
    return {
      id: 'd1',
      userId: 'u1',
      kind: 'AVAILABLE',
      recurKind: 'PUNCTUAL',
      dayOfWeek: null,
      slot: 'FULL_DAY',
      startDate: '2026-08-20T00:00:00.000Z',
      endDate: '2026-08-20T00:00:00.000Z',
      expiresAt: '2099-12-31T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
      ...over,
    } as any;
  }

  async function createWith(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.componentRef.setInput('activeLayers', ALL_LAYERS);
    f.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    fixture = f;
    el = f.nativeElement;
    return f;
  }

  /** La case du jour donné (août 2026 affiché). */
  function cellOf(day: number): HTMLElement {
    const target = new Date(2026, 7, day).getTime();
    return el.querySelector(`.day-cell[data-cell-date="${target}"]`) as HTMLElement;
  }

  /** Story 36.3, AC15 : arme la barre par un APPUI MAINTENU sur la bande visée — un tap court
   *  ne fait plus que peupler le rail. */
  function longPress(band: Element): void {
    band.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 5,
        clientY: 5,
        pointerType: 'mouse',
        bubbles: true,
      }),
    );
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // ─── Story 36.7 — l'ouverture du sélecteur de réponse ──────────────────────────────────────

  const VOTE_PARTICIPATION = {
    partieId: 'partie-1',
    pollId: 'p',
    optionId: 'o1',
    yes: 2,
    maybe: 1,
    no: 0,
    total: 4,
    myAnswer: 'YES',
  };

  it('Story 36.7, AC1 — taper une bande portant une option de vote signale l’option, avec son ancre', async () => {
    const f = await createWith({
      entries: [vote('2026-08-20', 'MORNING', VOTE_PARTICIPATION)],
    });
    const emitted: any[] = [];
    f.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    const band = cellOf(20).querySelectorAll('.band')[0] as HTMLElement;
    band.click();
    f.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].vote).toEqual(VOTE_PARTICIPATION);
    expect(emitted[0].slot).toBe('MORNING');
    // L'ancre est la bande ELLE-MÊME : rien n'est inséré dans la case pour la porter (AC14).
    expect(emitted[0].anchor).toBe(band);
  });

  it('Story 36.7, AC1 — le rail suit QUAND MÊME : les deux signaux partent du même tap', async () => {
    const f = await createWith({
      entries: [vote('2026-08-20', 'MORNING', VOTE_PARTICIPATION)],
    });
    const slots: any[] = [];
    f.componentInstance.slotSelected.subscribe((e: any) => slots.push(e));

    (cellOf(20).querySelectorAll('.band')[0] as HTMLElement).click();
    f.detectChanges();

    expect(slots).toHaveLength(1);
  });

  it('Story 36.7, AC6 — une sélection ARMÉE garde le tap : la case bascule, rien ne s’ouvre', async () => {
    const f = await createWith({
      entries: [vote('2026-08-20', 'MORNING', VOTE_PARTICIPATION)],
    });
    const emitted: any[] = [];
    f.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    // Appui maintenu sur un AUTRE jour → la barre de sélection s'ouvre (36.3, AC15).
    longPress(cellOf(21).querySelectorAll('.band')[0]);
    expect(el.querySelector('app-selection-bar')).toBeTruthy();

    // Puis tap sur la bande de vote : elle doit rejoindre la sélection, pas ouvrir le sélecteur.
    (cellOf(20).querySelectorAll('.band')[0] as HTMLElement).click();
    f.detectChanges();

    expect(emitted).toEqual([]);
    expect(cellOf(20).querySelectorAll('.band')[0].classList.contains('band--selected')).toBe(true);
  });

  it('Story 36.7, AC12 — couche « votes-en-cours » éteinte : aucun sélecteur ne s’ouvre', async () => {
    const f = await createWith({
      entries: [vote('2026-08-20', 'MORNING', VOTE_PARTICIPATION)],
      activeLayers: ['mes-seances'],
    });
    const emitted: any[] = [];
    f.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    (cellOf(20).querySelectorAll('.band')[0] as HTMLElement).click();
    f.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('Story 36.7 — un créneau dont le rang gagnant est « séance » n’ouvre rien', async () => {
    const f = await createWith({
      entries: [seance('2026-08-20', 'MORNING'), vote('2026-08-20', 'MORNING', VOTE_PARTICIPATION)],
    });
    const emitted: any[] = [];
    f.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    const band = cellOf(20).querySelectorAll('.band')[0] as HTMLElement;
    expect(band.getAttribute('data-winner')).toBe('seance');
    band.click();
    f.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('Story 36.6, AC1 — une bande dont le rang gagnant est « vote » porte la piste de participation', async () => {
    await createWith({
      entries: [
        vote('2026-08-20', 'MORNING', {
          partieId: 'partie-1',
          pollId: 'p',
          optionId: 'o1',
          yes: 2,
          maybe: 1,
          no: 0,
          total: 4,
          myAnswer: 'YES',
        }),
      ],
    });

    const band = cellOf(20).querySelectorAll('.band')[0];
    expect(band.getAttribute('data-winner')).toBe('vote');
    expect(band.querySelector('app-poll-track')).toBeTruthy();
  });

  it('Story 36.6, AC4 — la case du Mois ne porte JAMAIS le compteur « 3 / 4 »', async () => {
    await createWith({
      entries: [
        vote('2026-08-20', 'MORNING', {
          partieId: 'partie-1',
          pollId: 'p',
          optionId: 'o1',
          yes: 2,
          maybe: 1,
          no: 0,
          total: 4,
          myAnswer: null,
        }),
      ],
    });

    // 🚨 Le masquage passe par une CLASSE D'HÔTE lue par `poll-track.scss`, et non par une règle
    // écrite dans `calendar-month-view.scss` : l'encapsulation de vue empêcherait celle-ci
    // d'atteindre `.cnt`, qui appartient au composant de piste. Défaut trouvé à l'œil, jamais par
    // un test — ce test verrouille désormais le mécanisme qui marche.
    const track = cellOf(20).querySelectorAll('.band')[0].querySelector('app-poll-track')!;
    expect(track.classList.contains('in-month')).toBe(true);
  });

  it('Story 36.6 — un vote sans participation ne rend aucune piste', async () => {
    await createWith({ entries: [vote('2026-08-20', 'MORNING')] });

    const band = cellOf(20).querySelectorAll('.band')[0];
    expect(band.getAttribute('data-winner')).toBe('vote');
    expect(band.querySelector('app-poll-track')).toBeNull();
  });

  it('Story 36.6 — couche « votes-en-cours » éteinte : la piste disparaît avec le libellé', async () => {
    await createWith({
      entries: [
        vote('2026-08-20', 'MORNING', {
          partieId: 'partie-1',
          pollId: 'p',
          optionId: 'o1',
          yes: 2,
          maybe: 0,
          no: 0,
          total: 4,
          myAnswer: null,
        }),
      ],
      activeLayers: ALL_LAYERS.filter((l) => l !== 'votes-en-cours'),
    });

    const band = cellOf(20).querySelectorAll('.band')[0];
    expect(band.querySelector('app-poll-track')).toBeNull();
  });

  it('Story 36.6, encadré n°8 — une séance gagnante ne porte pas la piste du vote concurrent', async () => {
    await createWith({
      entries: [
        seance('2026-08-20', 'EVENING'),
        vote('2026-08-20', 'EVENING', {
          partieId: 'partie-1',
          pollId: 'p',
          optionId: 'o1',
          yes: 3,
          maybe: 0,
          no: 0,
          total: 4,
          myAnswer: null,
        }),
      ],
    });

    const soir = cellOf(20).querySelectorAll('.band')[2];
    expect(soir.getAttribute('data-winner')).toBe('seance');
    expect(soir.querySelector('app-poll-track')).toBeNull();
  });

  it('Story 36.6, AC14 — le nom accessible de la bande dit la participation', async () => {
    await createWith({
      entries: [
        vote('2026-08-20', 'MORNING', {
          partieId: 'partie-1',
          pollId: 'p',
          optionId: 'o1',
          yes: 2,
          maybe: 1,
          no: 0,
          total: 4,
          myAnswer: 'YES',
        }),
      ],
    });

    const label = cellOf(20).querySelectorAll('.band')[0].getAttribute('aria-label') ?? '';
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_participation_many'], { n: 3, total: 4 }),
    );
    expect(label).toContain(
      fillTone(GRIMOIRE_TONE['calendar.util_answer_mine'], {
        answer: GRIMOIRE_TONE['calendar.util_answer_yes'],
      }),
    );
  });

  it('rend trois bandes pour un jour dont les créneaux diffèrent (AC1)', async () => {
    await createWith({ entries: [seance('2026-08-20')], declarations: [decl()] });

    expect(cellOf(20).querySelectorAll('.band')).toHaveLength(3);
  });

  it('arbitre bande par bande, jamais à la journée (AC2)', async () => {
    await createWith({ entries: [seance('2026-08-20')], declarations: [decl()] });

    const winners = Array.from(cellOf(20).querySelectorAll('.band')).map((b) =>
      b.getAttribute('data-winner'),
    );
    expect(winners).toEqual(['available', 'available', 'seance']);
  });

  it('la séance gagne sur le vote sur un même créneau (AC2)', async () => {
    await createWith({ entries: [seance('2026-08-20'), vote('2026-08-20', 'EVENING')] });

    const winners = Array.from(cellOf(20).querySelectorAll('.band')).map((b) =>
      b.getAttribute('data-winner'),
    );
    expect(winners[2]).toBe('seance');
  });

  it('un vote gagne sur une déclaration (AC2)', async () => {
    await createWith({ entries: [vote('2026-08-20', 'MORNING')], declarations: [decl()] });

    const winners = Array.from(cellOf(20).querySelectorAll('.band')).map((b) =>
      b.getAttribute('data-winner'),
    );
    expect(winners[0]).toBe('vote');
  });

  it('une séance sans créneau occupe les trois bandes (AC11 / AD-9)', async () => {
    // Entrée construite sans propriété `slot` du tout — c'est le cas réel d'une séance dont la
    // date est validée sans vote rattaché : `chosenSlot` est absent et vaut FULL_DAY.
    const sansCreneau = { ...seance('2026-08-20') };
    delete (sansCreneau as Record<string, unknown>)['slot'];
    await createWith({ entries: [sansCreneau] });

    const winners = Array.from(cellOf(20).querySelectorAll('.band')).map((b) =>
      b.getAttribute('data-winner'),
    );
    expect(winners).toEqual(['seance', 'seance', 'seance']);
  });

  it('fusionne les trois bandes sur un jour uniforme sans événement (AC4)', async () => {
    await createWith({ declarations: [decl()] });

    const bands = cellOf(20).querySelectorAll('.band');
    expect(bands).toHaveLength(1);
    expect(bands[0].classList.contains('band--uniform')).toBe(true);
  });

  it('ne fusionne pas quand un événement est posé, même sur les trois créneaux (AC4)', async () => {
    await createWith({ entries: [seance('2026-08-20', 'FULL_DAY')] });

    expect(cellOf(20).querySelectorAll('.band')).toHaveLength(3);
  });

  it('écrit le titre de la séance dans sa bande (AC5)', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    expect(cellOf(20).querySelector('.band__label')?.textContent?.trim()).toBe('Le Convoi du Nord');
  });

  // ─── Informations pratiques (Story 36.5) ───────────────────────────────
  it('AC3 : la bande ne porte que l’HEURE — l’ordre de repli lâche le reste', async () => {
    await createWith({
      entries: [
        seance('2026-08-20', 'EVENING', {
          seanceHeure: '20:30',
          seanceLieu: 'chez Marc',
          seanceNote: 'pensez aux dés',
        }),
      ],
    });

    // La grille est plafonnée à ~115 px de case : seule l'heure y tient, et c'est la plus
    // actionnable des trois. Le lieu et la note sont portés par le rail (AC3/AC11).
    expect(cellOf(20).querySelector('.band__sub')?.textContent?.trim()).toBe('20:30');
  });

  it('AC4 : sans informations pratiques, aucun nœud accessoire n’est rendu', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    expect(cellOf(20).querySelector('.band__sub')).toBeNull();
  });

  it('AC8 : couche éteinte → les informations disparaissent avec le titre', async () => {
    await createWith({
      entries: [seance('2026-08-20', 'EVENING', { seanceHeure: '20:30' })],
      activeLayers: ALL_LAYERS.filter((l) => l !== 'mes-seances'),
    });

    expect(cellOf(20).querySelector('.band__sub')).toBeNull();
  });

  it('AC13 : les informations figurent dans le nom accessible de la bande', async () => {
    await createWith({
      entries: [seance('2026-08-20', 'EVENING', { seanceHeure: '20:30', seanceLieu: 'chez Marc' })],
    });

    const bands = cellOf(20).querySelectorAll('.band');
    expect(bands[2].getAttribute('aria-label')).toBe('Soir : Le Convoi du Nord — 20:30');
  });

  it('AC9 : du balisage est rendu littéralement dans la bande', async () => {
    // Le DTO interdit ce contenu côté serveur (heureRdv est validée au format HH:MM) ; ce test
    // vérifie la seconde barrière — le CHEMIN DE RENDU échappe, quoi qu'on lui donne.
    await createWith({
      entries: [seance('2026-08-20', 'EVENING', { seanceHeure: '<b>gras</b>' })],
    });

    const node = cellOf(20).querySelector('.band__sub')!;
    expect(node.textContent).toContain('<b>gras</b>');
    expect(node.querySelector('b')).toBeNull();
  });

  it('éteindre la couche « mes séances » retire le texte mais garde le rang (AC6)', async () => {
    await createWith({
      entries: [seance('2026-08-20')],
      activeLayers: ALL_LAYERS.filter((l) => l !== 'mes-seances'),
    });

    const bands = cellOf(20).querySelectorAll('.band');
    expect(bands[2].getAttribute('data-winner')).toBe('seance');
    expect(cellOf(20).querySelector('.band__label')).toBeNull();
  });

  it('revue de code (2026-08-18) : couche « mes séances » éteinte ne laisse pas fuiter le libellé d’un vote qui couvre le même créneau', async () => {
    await createWith({
      entries: [seance('2026-08-20'), vote('2026-08-20', 'EVENING')],
      activeLayers: ALL_LAYERS.filter((l) => l !== 'mes-seances'),
    });

    const bands = cellOf(20).querySelectorAll('.band');
    // La séance gagne toujours le rang (AC6) mais son texte disparaît — la bande ne doit pas
    // afficher le titre du vote à la place, alors qu'elle reste stylée « seance ».
    expect(bands[2].getAttribute('data-winner')).toBe('seance');
    expect(cellOf(20).querySelector('.band__label')).toBeNull();
  });

  it('retire l’ancienne signalétique — pastilles et réglette de segments (AC7)', async () => {
    await createWith({ entries: [seance('2026-08-20')], declarations: [decl()] });

    expect(el.querySelector('.guild-dot')).toBeNull();
    expect(el.querySelector('.seance-dot')).toBeNull();
    expect(el.querySelector('.segment')).toBeNull();
    expect(el.querySelector('.segments')).toBeNull();
  });

  it('nomme chaque bande avec son créneau et son état en toutes lettres (AC12)', async () => {
    await createWith({ entries: [seance('2026-08-20')], declarations: [decl()] });

    const labels = Array.from(cellOf(20).querySelectorAll('.band')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels[0]).toBe('Matin : disponible');
    expect(labels[2]).toBe('Soir : Le Convoi du Nord');
  });

  it('garde un seul arrêt de tabulation par case — 42 sur la grille, pas 126 (AC12)', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    expect(el.querySelectorAll('.band[tabindex]')).toHaveLength(0);
    expect(el.querySelectorAll('.day-cell[tabindex="0"]').length).toBeLessThanOrEqual(42);
  });

  it('un tap sur une bande émet le créneau correspondant (AC9)', async () => {
    await createWith({ entries: [seance('2026-08-20')] });
    const emitted: any[] = [];
    fixture.componentInstance.slotSelected.subscribe((e: any) => emitted.push(e));

    (cellOf(20).querySelectorAll('.band')[1] as HTMLElement).click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('AFTERNOON');
  });

  it('un tap sur une case fusionnée vaut la journée entière (AC4)', async () => {
    await createWith({ declarations: [decl()] });
    const emitted: any[] = [];
    fixture.componentInstance.slotSelected.subscribe((e: any) => emitted.push(e));

    (cellOf(20).querySelector('.band') as HTMLElement).click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('FULL_DAY');
  });

  // ─── Story 36.3 — la sélection au créneau, et la portée ────────────────────

  it('AC15 — un appui maintenu sur une bande sélectionne CE créneau et y initialise la portée', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    longPress(cellOf(20).querySelectorAll('.band')[2]);

    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);
    expect(fixture.componentInstance['scope']()).toBe('EVENING');
    expect(fixture.componentInstance['selectedCells']()[0].slot).toBe('EVENING');
  });

  it('AC16 — un clic rend la date courante, et une seule à la fois', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    (cellOf(20).querySelectorAll('.band')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(cellOf(20).classList.contains('current')).toBe(true);
    expect(cellOf(19).classList.contains('current')).toBe(false);

    (cellOf(19).querySelectorAll('.band')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(cellOf(19).classList.contains('current')).toBe(true);
    expect(cellOf(20).classList.contains('current')).toBe(false);
  });

  it('AC17 — en mode modification, un clic ajoute puis retire un jour, et le dernier retrait sort du mode', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    longPress(cellOf(20).querySelectorAll('.band')[2]);
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);

    // Un autre jour rejoint la sélection.
    (cellOf(24).querySelectorAll('.band')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(2);

    // Le même jour recliqué en sort.
    (cellOf(24).querySelectorAll('.band')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(1);

    // Retirer le dernier quitte le mode modification : la barre disparaît d'elle-même.
    (cellOf(20).querySelectorAll('.band')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  it('AC17 — la sélection par bascule n’a pas besoin d’être contiguë', async () => {
    await createWith({ entries: [seance('2026-08-20')] });

    longPress(cellOf(20).querySelectorAll('.band')[2]);
    (cellOf(26).querySelectorAll('.band')[0] as HTMLElement).click();
    fixture.detectChanges();

    const days = fixture.componentInstance['selectedDays']();
    expect(days.map((d: Date) => d.getDate())).toEqual([20, 26]);
  });

  it('AC15 — un tap court sur une bande n’arme rien : il désigne le créneau pour le rail', async () => {
    await createWith({ entries: [seance('2026-08-20')] });
    const emitted: any[] = [];
    fixture.componentInstance.slotSelected.subscribe((e: any) => emitted.push(e));

    (cellOf(20).querySelectorAll('.band')[2] as HTMLElement).click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].slot).toBe('EVENING');
    expect(fixture.componentInstance['selectedDays']()).toHaveLength(0);
  });

  it('AC2 — le marquage des bandes suit la portée, jamais le créneau d’origine', async () => {
    await createWith({ entries: [seance('2026-08-20')] });
    const cell = cellOf(20);

    longPress(cell.querySelectorAll('.band')[0]);
    expect(cell.querySelectorAll('.band--selected')).toHaveLength(1);

    fixture.componentInstance['onScopeChange']('FULL_DAY');
    fixture.detectChanges();
    expect(cell.querySelectorAll('.band--selected')).toHaveLength(3);

    fixture.componentInstance['onScopeChange']('EVENING');
    fixture.detectChanges();
    const marked = cell.querySelectorAll('.band--selected');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(cell.querySelectorAll('.band')[2]);
  });

  it('AC4 — une case fusionnée arme la journée entière comme portée (collision 8)', async () => {
    await createWith({ declarations: [decl()] });

    longPress(cellOf(20).querySelector('.band')!);

    expect(fixture.componentInstance['scope']()).toBe('FULL_DAY');
    expect(cellOf(20).querySelectorAll('.band--selected')).toHaveLength(1);
  });

  // Défaut trouvé à l'écran, qu'aucun test ne voyait : la bande fusionnée porte les TROIS
  // créneaux, elle doit donc rester marquée quelle que soit la portée retenue.
  it('AC2 — la bande fusionnée reste marquée quelle que soit la portée', async () => {
    await createWith({ declarations: [decl()] });

    longPress(cellOf(20).querySelector('.band')!);
    fixture.componentInstance['onScopeChange']('EVENING');
    fixture.detectChanges();

    expect(cellOf(20).querySelectorAll('.band--selected')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 36.8 — la disponibilité du groupe sur un canal séparé
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarMonthView — une plage de plusieurs créneaux (Story 47.3)', () => {
  let fixture: any;
  let el: HTMLElement;

  // Août 2026 : le vendredi 21 au soir → le dimanche 23 après-midi (une seule ligne de semaine).
  const WEEKEND = {
    key: 'seance-w',
    type: 'mes-seances',
    date: '2026-08-21',
    slot: 'EVENING',
    endDate: '2026-08-23',
    endSlot: 'AFTERNOON',
    label: 'Week-end jeux',
    partieId: 'p1',
    scenarioId: 'sc1',
    seanceId: 'w',
  } as any;

  async function createWith(entries: any[]) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarMonthView);
    fixture.componentRef.setInput('activeLayers', ['mes-seances']);
    fixture.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const bandsOf = (day: number): HTMLElement[] => {
    const cell = el.querySelector(`.day-cell[data-cell-date="${new Date(2026, 7, day).getTime()}"]`);
    return Array.from(cell!.querySelectorAll<HTMLElement>('.band'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('les bandes couvertes portent le rang séance, les connecteurs sont aux changements de jour', async () => {
    await createWith([WEEKEND]);
    const [friM, friA, friE] = bandsOf(21);
    const [satM, satA, satE] = bandsOf(22);
    const [sunM, sunA, sunE] = bandsOf(23);

    expect([friM, friA].map((b) => b.dataset['winner'])).not.toContain('seance');
    for (const band of [friE, satM, satA, satE, sunM, sunA]) {
      expect(band.dataset['winner']).toBe('seance');
    }
    expect(sunE.dataset['winner']).not.toBe('seance');

    expect(friE.classList.contains('band--span-next')).toBe(true);
    expect(satM.classList.contains('band--span-prev')).toBe(true);
    expect(satE.classList.contains('band--span-next')).toBe(true);
    expect(sunM.classList.contains('band--span-prev')).toBe(true);
    expect(satA.classList.contains('band--span-next')).toBe(false);
    expect(sunA.classList.contains('band--span-next')).toBe(false);
  });

  it('le nom visible n’est écrit qu’une fois ; chaque bande couverte dit la plage entière', async () => {
    await createWith([WEEKEND]);
    const labels = Array.from(el.querySelectorAll('.band__label')).map((n) => n.textContent?.trim());
    expect(labels).toEqual(['Week-end jeux']);

    const aria = bandsOf(22)[1].getAttribute('aria-label') ?? '';
    expect(aria).toContain('Week-end jeux, du vendredi 21 soir au dimanche 23 après-midi');
  });

  it('un créneau seul : la bande est celle d’avant, sans connecteur', async () => {
    await createWith([{ ...WEEKEND, endDate: undefined, endSlot: undefined }]);
    expect(el.querySelector('.band--span-next, .band--span-prev')).toBeNull();
    expect(bandsOf(21)[2].getAttribute('aria-label')).not.toContain('du vendredi');
  });
});

describe('CalendarMonthView — plusieurs plages d’un même vote (Story 47.5)', () => {
  let fixture: any;
  let el: HTMLElement;

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
  // Août 2026, durée 3 : (a) samedi 22 matin → soir ; (b) samedi 22 après-midi → dimanche 23 matin.
  // Elles se recouvrent le samedi après-midi et le samedi soir.
  const optionA = {
    key: 'poll-1-a',
    type: 'votes-en-cours',
    date: '2026-08-22',
    slot: 'MORNING',
    endDate: '2026-08-22',
    endSlot: 'EVENING',
    label: 'Week-end jeux',
    vote: participation('a'),
  } as any;
  const optionB = {
    key: 'poll-1-b',
    type: 'votes-en-cours',
    date: '2026-08-22',
    slot: 'AFTERNOON',
    endDate: '2026-08-23',
    endSlot: 'MORNING',
    label: 'Week-end jeux',
    vote: participation('b'),
  } as any;

  async function createWith(entries: any[], layers = ['votes-en-cours']) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarMonthView);
    fixture.componentRef.setInput('activeLayers', layers);
    fixture.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const bandsOf = (day: number): HTMLElement[] => {
    const cell = el.querySelector(`.day-cell[data-cell-date="${new Date(2026, 7, day).getTime()}"]`);
    return Array.from(cell!.querySelectorAll<HTMLElement>('.band'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('« ×2 » sur chaque bande recouverte deux fois, rien ailleurs ; il entre dans le nom accessible', async () => {
    await createWith([optionA, optionB]);
    const [satM, satA, satE] = bandsOf(22);
    const [sunM] = bandsOf(23);

    expect(satA.querySelector('.band__overlap')?.textContent?.trim()).toBe('×2');
    expect(satE.querySelector('.band__overlap')?.textContent?.trim()).toBe('×2');
    expect(satM.querySelector('.band__overlap')).toBeNull();
    expect(sunM.querySelector('.band__overlap')).toBeNull();
    expect(satA.getAttribute('aria-label')).toContain('2 plages se superposent (×2)');
    expect(satM.getAttribute('aria-label')).not.toContain('×');
  });

  it('une seule plage sur le créneau : pas de « ×n »', async () => {
    await createWith([optionA]);
    expect(el.querySelector('.band__overlap')).toBeNull();
  });

  it('un créneau seul : la sortie d’avant (pas de marque)', async () => {
    await createWith([{ ...optionA, endDate: undefined, endSlot: undefined }]);
    expect(el.querySelector('.band__overlap')).toBeNull();
  });

  it('toucher la bande recouverte signale TOUTES les plages qui la couvrent, dans l’ordre de leur début', async () => {
    await createWith([optionB, optionA]);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    bandsOf(22)[1].click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].lines.map((l: any) => l.vote.optionId)).toEqual(['a', 'b']);
    expect(emitted[0].lines.map((l: any) => l.range)).toEqual([
      'sam. 22 matin → sam. 22 soir',
      'sam. 22 après-midi → dim. 23 matin',
    ]);
  });

  it('toucher une bande couverte une seule fois : une seule ligne', async () => {
    await createWith([optionA, optionB]);
    const emitted: any[] = [];
    fixture.componentInstance.voteOptionActivated.subscribe((e: any) => emitted.push(e));

    bandsOf(22)[0].click();
    fixture.detectChanges();

    expect(emitted[0].lines.map((l: any) => l.vote.optionId)).toEqual(['a']);
  });

  it('couche « votes en cours » éteinte : ni marque ni signal', async () => {
    await createWith([optionA, optionB], ['mes-seances']);
    expect(el.querySelector('.band__overlap')).toBeNull();
  });
});

describe('CalendarMonthView — le canal de groupe (Story 36.8)', () => {
  let el: HTMLElement;

  const GROUP_LAYERS = [
    'mes-indisponibilites',
    'mes-disponibilites',
    'mes-seances',
    'votes-en-cours',
    'inscriptions-ouvertes',
    'disponibilite-groupe',
  ] as any[];

  const MEMBERS = [
    { userId: 'mj1', pseudo: 'mj', displayName: 'Le MJ', status: 'AVAILABLE' },
    { userId: 'u1', pseudo: 'alice', displayName: 'Alice', status: 'UNAVAILABLE' },
    { userId: 'u2', pseudo: 'bob', displayName: 'Bob', status: 'UNKNOWN' },
  ];

  function groupEntry(day: number, slot = 'EVENING', over: Record<string, unknown> = {}) {
    return {
      key: `groupe-2026-08-${String(day).padStart(2, '0')}-${slot}`,
      type: 'disponibilite-groupe',
      date: `2026-08-${String(day).padStart(2, '0')}`,
      label: `${slot} — 2/4 disponibles`,
      slot,
      group: { available: 2, unavailable: 1, unknown: 1, total: 4, members: null, ...over },
    } as any;
  }

  function seanceEntry(day: number, slot = 'EVENING') {
    return {
      key: 'seance-s1',
      type: 'mes-seances',
      date: `2026-08-${String(day).padStart(2, '0')}`,
      label: 'Le Convoi du Nord',
      slot,
      partieId: 'p1',
      scenarioId: 'sc1',
      seanceId: 's1',
    } as any;
  }

  function voteEntry(day: number, slot = 'EVENING') {
    return {
      key: 'poll-p1-o1',
      type: 'votes-en-cours',
      date: `2026-08-${String(day).padStart(2, '0')}`,
      label: 'Ashal',
      slot,
      vote: {
        partieId: 'p1',
        pollId: 'p1',
        optionId: 'o1',
        yes: 2,
        maybe: 1,
        no: 0,
        total: 4,
        myAnswer: 'YES',
      },
    } as any;
  }

  async function createWith(entries: any[], layers: any[] = GROUP_LAYERS) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.componentRef.setInput('activeLayers', layers);
    f.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    f.componentRef.setInput('entries', entries);
    f.detectChanges();
    el = f.nativeElement;
    return f;
  }

  function cellOf(day: number): HTMLElement {
    const target = new Date(2026, 7, day).getTime();
    return el.querySelector(`.day-cell[data-cell-date="${target}"]`) as HTMLElement;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('AC1 — la bande porte le canal, sur un noeud DISTINCT de son fond', async () => {
    await createWith([groupEntry(20)]);

    const evening = [...cellOf(20).querySelectorAll('.band')][2];
    expect(evening.querySelector('app-group-gauge')).not.toBeNull();
    // Le fond de la bande n'a pas bougé : le groupe n'entre pas dans la préséance.
    expect(evening.getAttribute('data-winner')).toBe('none');
  });

  it('🚨 AC2 — le canal SURVIT sous une séance ET sous un vote', async () => {
    await createWith([groupEntry(20), seanceEntry(20)]);
    const withSeance = [...cellOf(20).querySelectorAll('.band')][2];
    expect(withSeance.getAttribute('data-winner')).toBe('seance');
    expect(withSeance.querySelector('app-group-gauge')).not.toBeNull();

    TestBed.resetTestingModule();
    await createWith([groupEntry(21), voteEntry(21)]);
    const withVote = [...cellOf(21).querySelectorAll('.band')][2];
    expect(withVote.getAttribute('data-winner')).toBe('vote');
    expect(withVote.querySelector('app-group-gauge')).not.toBeNull();
  });

  it('AC4 — les identités servies produisent une pastille par membre, dans l ordre recu', async () => {
    await createWith([groupEntry(20, 'EVENING', { members: MEMBERS })]);

    const pastilles = [...cellOf(20).querySelectorAll('.band app-group-gauge .members .p')];
    expect(pastilles).toHaveLength(3);
    expect(pastilles.map((p) => p.className)).toEqual(['p p--yes', 'p p--no', 'p p--unknown']);
  });

  it('AC3 — sans identité servie, la bande rend une jauge et AUCUN nom', async () => {
    await createWith([groupEntry(20)]);

    const band = [...cellOf(20).querySelectorAll('.band')][2];
    expect(band.querySelector('app-group-gauge .gg-gauge')).not.toBeNull();
    expect(band.querySelector('.members')).toBeNull();
    expect(band.textContent).not.toContain('Alice');
  });

  it('🚨 AC11 — la couche allumée INTERDIT la fusion des bandes', async () => {
    await createWith([groupEntry(20, 'FULL_DAY')]);

    const cell = cellOf(20);
    expect(cell.querySelectorAll('.band')).toHaveLength(3);
    expect(cell.querySelector('.band--uniform')).toBeNull();
    // Chacune porte SA marque : c'est tout le motif de l'interdiction.
    expect(cell.querySelectorAll('.band app-group-gauge')).toHaveLength(3);
  });

  it('AC10 — couche éteinte : aucun canal, aucune marge réservée, et la fusion revient', async () => {
    await createWith(
      [groupEntry(20, 'FULL_DAY')],
      GROUP_LAYERS.filter((k) => k !== 'disponibilite-groupe'),
    );

    const cell = cellOf(20);
    expect(cell.querySelectorAll('app-group-gauge')).toHaveLength(0);
    expect(cell.querySelectorAll('.band--gauge')).toHaveLength(0);
    expect(cell.querySelector('.band--uniform')).not.toBeNull();
  });

  it('la marge de 11 px est réservée pour la JAUGE, jamais pour les pastilles', async () => {
    await createWith([groupEntry(20)]);
    expect([...cellOf(20).querySelectorAll('.band')][2].classList.contains('band--gauge')).toBe(
      true,
    );

    TestBed.resetTestingModule();
    await createWith([groupEntry(21, 'EVENING', { members: MEMBERS })]);
    expect([...cellOf(21).querySelectorAll('.band')][2].classList.contains('band--gauge')).toBe(
      false,
    );
  });

  it('AC15 — le nom accessible de la bande dit le groupe (son aria-label écrase ses enfants)', async () => {
    await createWith([groupEntry(20)]);
    const label = [...cellOf(20).querySelectorAll('.band')][2].getAttribute('aria-label')!;
    expect(label).toContain('2 sur 4 disponibles');

    TestBed.resetTestingModule();
    await createWith([groupEntry(21), seanceEntry(21)]);
    const withSeance = [...cellOf(21).querySelectorAll('.band')][2].getAttribute('aria-label')!;
    // Il s'AJOUTE au titre de la séance, il ne le remplace pas.
    expect(withSeance).toContain('Le Convoi du Nord');
    expect(withSeance).toContain('2 sur 4 disponibles');
  });

  // 🚨 AC12 — LE CONTRAT DOM DU GLISSEMENT, sans aucun stub. `elementFromPoint` est stubbé dans
  // tous les tests de geste : si ce noeud sortait de la bande, ils resteraient VERTS et le
  // glissement serait cassé en production. Ce test est le seul garde-fou du canal.
  it('AC12 — le noeud du canal reste un descendant porteur de data-cell-date', async () => {
    await createWith([groupEntry(20)]);
    const cell = cellOf(20);
    const gauge = cell.querySelector('app-group-gauge')!;
    expect(gauge.closest('[data-cell-date]')).toBe(cell);
  });
});

// ─── Story 36.9 — le mode Destinée : l'estompe de la case ─────────────────────────────────────

describe('CalendarMonthView — le mode Destinée (Story 36.9)', () => {
  let el: HTMLElement;
  let fixture: any;

  async function createWith(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.componentRef.setInput('activeLayers', [
      'mes-disponibilites',
      'mes-indisponibilites',
      'mes-seances',
      'votes-en-cours',
    ]);
    f.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    fixture = f;
    el = f.nativeElement;
    return f;
  }

  function cellOf(day: number): HTMLElement {
    const target = new Date(2026, 7, day).getTime();
    return el.querySelector(`.day-cell[data-cell-date="${target}"]`) as HTMLElement;
  }

  function longPress(node: Element): void {
    node.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 5,
        clientY: 5,
        pointerType: 'mouse',
        bubbles: true,
      }),
    );
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('AC1 — hors mode (ensemble null), AUCUNE case n’est estompée', async () => {
    await createWith({ destinyDates: null });
    expect(el.querySelectorAll('.day-cell--dim')).toHaveLength(0);
  });

  it('AC1 — mode actif : les jours du vote courant restent nets, les autres s’estompent', async () => {
    await createWith({ destinyDates: new Set(['2026-08-20', '2026-08-21']) });

    expect(cellOf(20).classList.contains('day-cell--dim')).toBe(false);
    expect(cellOf(21).classList.contains('day-cell--dim')).toBe(false);
    expect(cellOf(19).classList.contains('day-cell--dim')).toBe(true);
    expect(cellOf(22).classList.contains('day-cell--dim')).toBe(true);
    // L'estompe couvre toute la grille, pas seulement les jours porteurs de quelque chose.
    expect(el.querySelectorAll('.day-cell--dim').length).toBe(40);
  });

  // 🚨 Défaut trouvé à la VÉRIFICATION VISUELLE, invisible à tous les autres tests : activer la
  // Destinée depuis un mois qui ne porte AUCUNE date du vote courant estompait les 42 cases, sans
  // rien mettre en avant et sans dire pourquoi. L'AC1 exige que « les créneaux proposés restent
  // pleinement lisibles » — quand il n'y en a aucun à l'écran, estomper ne met rien en avant et ne
  // coûte que de la lisibilité.
  it('AC1 — aucune date du vote courant dans la grille affichée : RIEN n’est estompé', async () => {
    await createWith({ destinyDates: new Set(['2026-11-03']) });
    expect(el.querySelectorAll('.day-cell--dim')).toHaveLength(0);
  });

  it('AC3 — 🚨 une case estompée reste PLEINEMENT interactive et annoncée', async () => {
    await createWith({ destinyDates: new Set(['2026-08-20']) });
    const dimmed = cellOf(22);

    expect(dimmed.classList.contains('day-cell--dim')).toBe(true);
    // Rien n'est retiré : ni au pointeur, ni au clavier, ni au lecteur d'écran.
    expect(dimmed.getAttribute('aria-hidden')).toBeNull();
    expect(dimmed.getAttribute('tabindex')).toBe('0');
    expect(dimmed.getAttribute('role')).toBe('button');
    expect(dimmed.getAttribute('data-cell-date')).toBeTruthy();

    // 🚨 Le contrat DOM du glissement : la bande reste un descendant porteur de data-cell-date.
    // (Un jour sans rien rend UNE bande fusionnée — story 36.2, AC4.)
    const band = dimmed.querySelector('.band')!;
    expect(band.closest('[data-cell-date]')).toBe(dimmed);

    // Et le geste marche : un appui maintenu arme toujours la sélection.
    longPress(band);
    expect(el.querySelector('app-selection-bar')).toBeTruthy();
  });

  it('AC8 — une case estompée qui est SÉLECTIONNÉE cesse de l’être', async () => {
    await createWith({ destinyDates: new Set(['2026-08-20']) });
    const dimmed = cellOf(22);
    expect(dimmed.classList.contains('day-cell--dim')).toBe(true);

    longPress(dimmed.querySelector('.band')!);

    expect(cellOf(22).classList.contains('selected')).toBe(true);
    expect(cellOf(22).classList.contains('day-cell--dim')).toBe(false);
    // Le voisin, lui, reste estompé : c'est bien la sélection qui lève l'estompe, pas le mode.
    expect(cellOf(23).classList.contains('day-cell--dim')).toBe(true);
  });

  it('AC8 — une case estompée en APERÇU de déclaration cesse de l’être', async () => {
    await createWith({
      destinyDates: new Set(['2026-08-20']),
      pendingDto: {
        kind: 'AVAILABLE',
        recurKind: 'ONE_OFF',
        slot: 'EVENING',
        startDate: '2026-08-22T00:00:00.000Z',
        endDate: '2026-08-22T00:00:00.000Z',
      },
    });

    expect(cellOf(22).classList.contains('day-cell--dim')).toBe(false);
    expect(cellOf(23).classList.contains('day-cell--dim')).toBe(true);
  });
});

// ─── Story 36.10 — le mode de composition réassigne le tap (vue Mois) ────────

describe('CalendarMonthView — mode de composition (Story 36.10)', () => {
  let el: HTMLElement;

  const VOTE_ENTRY = {
    key: 'vote-1',
    type: 'votes-en-cours' as const,
    date: '2026-08-20',
    label: 'Chapitre 1',
    slot: 'EVENING' as const,
    vote: {
      pollId: 'poll1',
      optionId: 'opt1',
      partieId: 'partie-1',
      yes: 1,
      no: 0,
      maybe: 0,
      total: 4,
      myAnswer: null,
    },
  };

  async function createWith(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.componentRef.setInput('activeLayers', [
      'mes-disponibilites',
      'mes-indisponibilites',
      'mes-seances',
      'votes-en-cours',
    ]);
    f.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    el = f.nativeElement;
    return f;
  }

  function cellOf(day: number): HTMLElement {
    const target = new Date(2026, 7, day).getTime();
    return el.querySelector(`.day-cell[data-cell-date="${target}"]`) as HTMLElement;
  }

  /** La bande d'un créneau donné : 0 = matin, 1 = après-midi, 2 = soir.
   *
   *  🚨 N'existe QUE si la case n'est pas uniforme : une journée qui ne porte rien est rendue en
   *  UNE seule bande fusionnée (AC4 de la 36.2). Les tests qui visent un créneau précis passent
   *  donc une entrée sur ce jour — sans quoi `bandOf(j, 2)` est `undefined`, ce qui est le
   *  comportement voulu et non un défaut du test. */
  function bandOf(day: number, index: number): HTMLElement {
    return [...cellOf(day).querySelectorAll('.band')][index] as HTMLElement;
  }

  /** La bande unique d'une case uniforme (journée entière). */
  function uniformBandOf(day: number): HTMLElement {
    return cellOf(day).querySelector('.band') as HTMLElement;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('AC2/AC12 — en composition, un tap émet composeToggled ET slotSelected, mais n’arme AUCUNE sélection', async () => {
    const f = await createWith({
      entries: [VOTE_ENTRY],
      composing: true,
      composedKeys: new Set<string>(),
    });
    const composed = vi.fn();
    const selected = vi.fn();
    f.componentInstance.composeToggled.subscribe(composed);
    f.componentInstance.slotSelected.subscribe(selected);

    bandOf(20, 2).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(composed).toHaveBeenCalledTimes(1);
    expect(composed.mock.calls[0][0].slot).toBe('EVENING');
    // Le rail suit toujours : « le rail suit, il ne se commande pas » (principe 2).
    expect(selected).toHaveBeenCalledTimes(1);
    // 🚨 Aucune sélection armée : la barre de sélection ne doit pas apparaître.
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  it('🚨 AC12 — en composition, une bande portant un VOTE n’ouvre pas le sélecteur de réponse', async () => {
    const f = await createWith({
      entries: [VOTE_ENTRY],
      composing: true,
      composedKeys: new Set<string>(),
    });
    const voteActivated = vi.fn();
    const composed = vi.fn();
    f.componentInstance.voteOptionActivated.subscribe(voteActivated);
    f.componentInstance.composeToggled.subscribe(composed);

    bandOf(20, 2).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(voteActivated).not.toHaveBeenCalled();
    expect(composed).toHaveBeenCalledTimes(1);
  });

  it('hors composition, la même bande ouvre bien le sélecteur (preuve que la neutralisation vient du mode)', async () => {
    const f = await createWith({ entries: [VOTE_ENTRY] });
    const voteActivated = vi.fn();
    f.componentInstance.voteOptionActivated.subscribe(voteActivated);

    bandOf(20, 2).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(voteActivated).toHaveBeenCalledTimes(1);
  });

  // ── Story 45.3 — le geste des dispos en composition (bloc JUMEAU de la vue Semaine) ──

  const pointerAt = (type: string, x = 5, y = 5) =>
    new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true });
  const gridEl = () => el.querySelector('.calendar-grid') as HTMLElement;
  const barEl = () => el.querySelector('app-selection-bar');
  const barButton = (text: string) =>
    Array.from(el.querySelectorAll('app-selection-bar button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement;

  /** Un glissement de la case `from` à la case `to`, relâché. */
  function dragDays(from: number, to: number): void {
    cellOf(from).dispatchEvent(pointerAt('pointerdown', 0, 0));
    document.elementFromPoint = vi.fn().mockReturnValue(cellOf(to));
    gridEl().dispatchEvent(pointerAt('pointermove', 60, 0));
    gridEl().dispatchEvent(pointerAt('pointerup', 60, 0));
  }

  it('Story 45.3 — en composition, l’appui maintenu arme une sélection de jours ET ouvre la barre en version composition', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const toggled = vi.fn();
    f.componentInstance.composeToggled.subscribe(toggled);

    uniformBandOf(20).dispatchEvent(pointerAt('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    gridEl().dispatchEvent(pointerAt('pointerup'));
    f.detectChanges();
    // Le `click` que le navigateur émet derrière le geste est AVALÉ : il ne compose pas la case sélectionnée.
    uniformBandOf(20).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(f.componentInstance['selectedDays']()).toHaveLength(1);
    expect(barEl()).not.toBeNull();
    expect(barButton(GRIMOIRE_TONE['calendar.selbar_compose_add'])).toBeTruthy();
    expect(barButton(GRIMOIRE_TONE['common.disponible'])).toBeUndefined();
    expect(toggled).not.toHaveBeenCalled();
  });

  it('Story 45.3 — un glissement sélectionne plusieurs jours ; choisir « Soir » puis « Ajouter au vote » émet CES créneaux, sans rien composer par la vue', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const added = vi.fn();
    const toggled = vi.fn();
    f.componentInstance.composeAdded.subscribe(added);
    f.componentInstance.composeToggled.subscribe(toggled);

    dragDays(20, 22);
    f.detectChanges();
    expect(f.componentInstance['selectedDays']()).toHaveLength(3);

    (el.querySelector('app-selection-bar .scope-seg[aria-label="Soir"]') as HTMLButtonElement).click();
    f.detectChanges();
    barButton(GRIMOIRE_TONE['calendar.selbar_compose_add']).click();
    f.detectChanges();

    expect(added).toHaveBeenCalledTimes(1);
    const cells = added.mock.calls[0][0] as { date: Date; slot: string }[];
    expect(cells.map((c) => [c.date.getDate(), c.slot])).toEqual([
      [20, 'EVENING'],
      [21, 'EVENING'],
      [22, 'EVENING'],
    ]);
    expect(barEl()).toBeNull();
    expect(toggled).not.toHaveBeenCalled();
  });

  it('Story 45.3 — « Retirer » émet composeRemoved avec la sélection', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const removed = vi.fn();
    f.componentInstance.composeRemoved.subscribe(removed);

    dragDays(20, 21);
    f.detectChanges();
    barButton(GRIMOIRE_TONE['calendar.selbar_compose_remove']).click();
    f.detectChanges();

    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][0]).toHaveLength(2);
    expect(barEl()).toBeNull();
  });

  it('Story 45.3 — barre ouverte, un tap bascule la case dans la SÉLECTION (jamais dans la composition)', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const toggled = vi.fn();
    f.componentInstance.composeToggled.subscribe(toggled);

    dragDays(20, 21);
    f.detectChanges();
    expect(f.componentInstance['selectedDays']()).toHaveLength(2);

    // Un vrai tap : le `pointerdown` remet à zéro l'avalement du clic du geste précédent.
    uniformBandOf(25).dispatchEvent(pointerAt('pointerdown'));
    gridEl().dispatchEvent(pointerAt('pointerup'));
    uniformBandOf(25).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(f.componentInstance['selectedDays']()).toHaveLength(3);
    expect(toggled).not.toHaveBeenCalled();
  });

  it('Story 45.3 — `Échap` ferme d’abord la barre de sélection, puis (sans barre) quitte le composer', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const cancelled = vi.fn();
    f.componentInstance.composeCancelled.subscribe(cancelled);
    const escape = () =>
      gridEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    dragDays(20, 21);
    f.detectChanges();
    escape();
    f.detectChanges();
    expect(barEl()).toBeNull();
    expect(cancelled).not.toHaveBeenCalled();

    escape();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('Story 45.3 — quitter le composer efface la sélection : une barre de composition ne devient pas une barre de déclaration', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    dragDays(20, 21);
    f.detectChanges();
    expect(barEl()).not.toBeNull();

    f.componentRef.setInput('composing', false);
    f.detectChanges();

    expect(f.componentInstance['selectedDays']()).toHaveLength(0);
    expect(barEl()).toBeNull();
  });

  it('Story 45.3 — sans journée entière (groupe), la barre ne propose pas « Journée »', async () => {
    const f = await createWith({
      composing: true,
      composedKeys: new Set<string>(),
      composeFullDay: false,
    });
    dragDays(20, 21);
    f.detectChanges();

    const labels = Array.from(el.querySelectorAll('app-selection-bar .scope-seg')).map((b) =>
      b.textContent!.trim(),
    );
    expect(labels).not.toContain('Journée');
    // La sélection part d'une journée entière : « Ajouter » attend qu'on choisisse un moment.
    expect(barButton(GRIMOIRE_TONE['calendar.selbar_compose_add']).disabled).toBe(true);
  });

  it('AC12/AC16 — au clavier aussi : `1` compose au lieu d’armer une sélection', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const composed = vi.fn();
    f.componentInstance.composeToggled.subscribe(composed);

    cellOf(20).dispatchEvent(new KeyboardEvent('keyup', { key: '1', bubbles: true }));
    f.detectChanges();

    expect(composed).toHaveBeenCalledTimes(1);
    expect(composed.mock.calls[0][0].slot).toBe('MORNING');
    expect(el.querySelector('app-selection-bar')).toBeNull();
  });

  it('AC17 — une date PASSÉE ne compose rien', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const composed = vi.fn();
    const selected = vi.fn();
    f.componentInstance.composeToggled.subscribe(composed);
    f.componentInstance.slotSelected.subscribe(selected);

    // Le 5 août est antérieur au 10 août (temps figé) : la garde existante doit tenir. La case
    // ne porte rien, donc une seule bande fusionnée — c'est elle qu'on touche.
    uniformBandOf(5).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();

    expect(composed).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
  });

  it('AC3 — `Échap` en composition remonte composeCancelled, et pas l’annulation de sélection', async () => {
    const f = await createWith({ composing: true, composedKeys: new Set<string>() });
    const cancelled = vi.fn();
    f.componentInstance.composeCancelled.subscribe(cancelled);

    el.querySelector('.calendar-grid')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    f.detectChanges();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('AC13/AC16 — un créneau composé porte sa classe ET son état en toutes lettres', async () => {
    await createWith({
      entries: [VOTE_ENTRY],
      composing: true,
      composedKeys: new Set(['2026-08-20|EVENING']),
    });

    const band = bandOf(20, 2);
    expect(band.classList.contains('band--composed')).toBe(true);
    expect(band.getAttribute('aria-label')).toContain(GRIMOIRE_TONE['common.designe_pour_le_vote']);

    // Le voisin ne l'est pas : la classe suit bien la clé, pas le jour.
    const morning = bandOf(20, 0);
    expect(morning.classList.contains('band--composed')).toBe(false);
    expect(morning.getAttribute('aria-label')).not.toContain('désigné pour le vote');
  });

  it('AC13 — composé et sélectionné sont DEUX traitements distincts', async () => {
    await createWith({
      entries: [VOTE_ENTRY],
      composing: true,
      composedKeys: new Set(['2026-08-20|EVENING']),
    });
    const band = bandOf(20, 2);
    expect(band.classList.contains('band--composed')).toBe(true);
    expect(band.classList.contains('band--selected')).toBe(false);
  });

  // ⚠️ Story 47.4 — l'aperçu de la plage de chaque départ désigné.
  describe('aperçu des plages (Story 47.4)', () => {
    const COVER = new Set(['2026-08-21|MORNING', '2026-08-21|AFTERNOON']);

    it('le départ garde son tireté ; les autres bandes de sa plage prennent l’aperçu, un jour vide se déplie', async () => {
      await createWith({
        entries: [VOTE_ENTRY],
        composing: true,
        composedKeys: new Set(['2026-08-20|EVENING']),
        composeCoverKeys: COVER,
        composeDuration: 3,
      });

      const start = bandOf(20, 2);
      expect(start.classList.contains('band--composed')).toBe(true);
      expect(start.classList.contains('band--span-preview')).toBe(false);
      // Le 21 ne porte rien (case uniforme hors composition) : il montre ses trois créneaux.
      expect(cellOf(21).querySelectorAll('.band')).toHaveLength(3);
      expect(bandOf(21, 0).classList.contains('band--span-preview')).toBe(true);
      expect(bandOf(21, 1).classList.contains('band--span-preview')).toBe(true);
      expect(bandOf(21, 2).classList.contains('band--span-preview')).toBe(false);
    });

    it('au survol d’une bande, la plage qu’elle ouvrirait s’allume ; la quitter l’éteint', async () => {
      const f = await createWith({
        entries: [VOTE_ENTRY],
        composing: true,
        composedKeys: new Set<string>(),
        composeCoverKeys: new Set<string>(),
        composeDuration: 2,
      });

      bandOf(20, 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      f.detectChanges();
      expect(bandOf(20, 2).classList.contains('band--span-preview')).toBe(true);
      expect(bandOf(21, 0).classList.contains('band--span-preview')).toBe(true);
      expect(bandOf(21, 1).classList.contains('band--span-preview')).toBe(false);

      bandOf(20, 2).dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      f.detectChanges();
      expect(el.querySelectorAll('.band--span-preview')).toHaveLength(0);
      expect(cellOf(21).querySelectorAll('.band')).toHaveLength(1);
    });

    it('au doigt (entrée émulée sans sortie), ou sur un jour passé, le survol n’allume rien', async () => {
      const f = await createWith({
        entries: [VOTE_ENTRY, { ...VOTE_ENTRY, key: 'vote-past', date: '2026-08-05' }],
        composing: true,
        composedKeys: new Set<string>(),
        composeCoverKeys: new Set<string>(),
        composeDuration: 2,
      });

      bandOf(20, 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
      f.detectChanges();
      expect(el.querySelectorAll('.band--span-preview')).toHaveLength(0);

      bandOf(5, 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      f.detectChanges();
      expect(el.querySelectorAll('.band--span-preview')).toHaveLength(0);
    });

    it('à 1 créneau, rien ne change : pas d’aperçu, un jour vide reste une seule bande', async () => {
      const f = await createWith({
        entries: [VOTE_ENTRY],
        composing: true,
        composedKeys: new Set(['2026-08-20|EVENING']),
        composeCoverKeys: new Set<string>(),
        composeDuration: 1,
      });

      bandOf(20, 2).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      f.detectChanges();
      expect(el.querySelectorAll('.band--span-preview')).toHaveLength(0);
      expect(cellOf(21).querySelectorAll('.band')).toHaveLength(1);
    });
  });
});

// ─── Story 36.15 — Sceller depuis la barre de sélection (bloc JUMEAU de la vue Semaine) ──────

describe('CalendarMonthView — sceller depuis la barre de sélection (Story 36.15)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarMonthView>>;
  let el: HTMLElement;

  const VOTE_ENTRY = {
    key: 'vote-1',
    type: 'votes-en-cours' as const,
    date: '2026-08-20',
    label: 'Chapitre 1',
    slot: 'EVENING' as const,
    partieId: 'partie-1',
    vote: {
      pollId: 'poll1',
      optionId: 'opt1',
      partieId: 'partie-1',
      yes: 1,
      no: 0,
      maybe: 0,
      total: 4,
      myAnswer: null,
    },
  };

  async function createWith(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarMonthView);
    fixture.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function selectSingle(day: number, slot: 'MORNING' | 'AFTERNOON' | 'EVENING' = 'EVENING'): void {
    const date = new Date(2026, 7, day);
    (fixture.componentInstance as any).selectedCells.set([{ date, slot }]);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('AC1/AC8 — sealCandidate résout le triplet depuis l’entrée votes-en-cours correspondante (jumeau Semaine)', async () => {
    await createWith({ canSeal: true, entries: [VOTE_ENTRY] });
    selectSingle(20, 'EVENING');
    const candidate = (fixture.componentInstance as any).sealCandidate();
    expect(candidate).toEqual({
      partieId: 'partie-1',
      pollId: 'poll1',
      optionId: 'opt1',
      dateLabel: expect.stringContaining('soir'),
      pollLabel: 'Chapitre 1',
    });
  });

  it('Story 47.5 — sealCandidate d’une plage porte « début → fin », pas seulement le créneau de départ', async () => {
    await createWith({
      canSeal: true,
      entries: [{ ...VOTE_ENTRY, endDate: '2026-08-22', endSlot: 'AFTERNOON' }],
    });
    selectSingle(20, 'EVENING');
    const candidate = (fixture.componentInstance as any).sealCandidate();
    expect(candidate.dateLabel).toBe('jeu. 20 août soir → sam. 22 août après-midi');
  });

  it('AC1 — le bouton Sceller est rendu dans la barre de sélection', async () => {
    await createWith({ canSeal: true, entries: [VOTE_ENTRY] });
    selectSingle(20, 'EVENING');
    expect(el.querySelector('.seal-btn')).not.toBeNull();
  });

  it('AC2 — sealCandidate est null quand aucune entrée ne correspond au créneau sélectionné', async () => {
    await createWith({ canSeal: true, entries: [VOTE_ENTRY] });
    selectSingle(20, 'MORNING');
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('Revue de code — deux entrées votes-en-cours sur le MÊME créneau (deux votes OPEN concurrents) → sealCandidate est null, jamais le premier match silencieux', async () => {
    const other = { ...VOTE_ENTRY, key: 'vote-2', label: 'Autre scénario' };
    await createWith({ canSeal: true, entries: [VOTE_ENTRY, other] });
    selectSingle(20, 'EVENING');
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC3 — sealCandidate est null quand canSeal est faux', async () => {
    await createWith({ canSeal: false, entries: [VOTE_ENTRY] });
    selectSingle(20, 'EVENING');
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC4 — sealCandidate est null sur une sélection de plusieurs créneaux', async () => {
    await createWith({ canSeal: true, entries: [VOTE_ENTRY] });
    const date = new Date(2026, 7, 20);
    (fixture.componentInstance as any).selectedCells.set([
      { date, slot: 'EVENING' },
      { date, slot: 'AFTERNOON' },
    ]);
    fixture.detectChanges();
    expect((fixture.componentInstance as any).sealCandidate()).toBeNull();
  });

  it('AC5/AC6 — un clic sur Sceller émet sealRequested avec le candidat, sans appel réseau ici', async () => {
    await createWith({ canSeal: true, entries: [VOTE_ENTRY] });
    selectSingle(20, 'EVENING');
    const spy = vi.fn();
    fixture.componentInstance.sealRequested.subscribe(spy);
    (el.querySelector('.seal-btn') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ pollId: 'poll1', optionId: 'opt1' }),
    );
  });
});

// ─── Story 46.2 — la fenêtre de l'automate sélectionnée : contour plein, jamais tireté ──────────
describe('CalendarMonthView — fenêtre de l’automate sélectionnée (Story 46.2)', () => {
  let el: HTMLElement;

  async function createWith(windowKey: string | null) {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthView],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const f = TestBed.createComponent(CalendarMonthView);
    f.componentRef.setInput('activeLayers', ['mes-disponibilites']);
    f.componentRef.setInput('initialDate', new Date(2026, 7, 15));
    f.componentRef.setInput('windowKey', windowKey);
    f.detectChanges();
    el = f.nativeElement;
    return f;
  }

  const cellOf = (day: number) => {
    const target = new Date(2026, 7, day).getTime();
    return el.querySelector(`.day-cell[data-cell-date="${target}"]`) as HTMLElement;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('sans fenêtre : aucune bande contournée', async () => {
    await createWith(null);
    expect(el.querySelectorAll('.band--window')).toHaveLength(0);
  });

  it('un jour sans rien (bande fusionnée) est contourné dès que la fenêtre tombe ce jour-là', async () => {
    await createWith('2026-08-20|EVENING');
    const band = cellOf(20).querySelector('.band') as HTMLElement;
    expect(band.classList).toContain('band--uniform');
    expect(band.classList).toContain('band--window');
    expect(el.querySelectorAll('.band--window')).toHaveLength(1);
    expect(band.getAttribute('aria-label')).toContain(
      TONE_MAP['grimoire-emeraude']['calendar.window_selected_aria'],
    );
  });

  it('une autre clé ne contourne rien', async () => {
    await createWith('2026-09-20|EVENING');
    expect(el.querySelectorAll('.band--window')).toHaveLength(0);
  });
});
