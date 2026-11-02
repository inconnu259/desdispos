import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { AvailabilityDeclarationDto } from '@master-jdr/shared';
import { AvailabilityService } from '../../../core/availability/availability.service';
import { ConstraintPanel } from './constraint-panel';
import { buildConstraintDto } from './constraint-panel.utils';
import type { ConstraintFormValue } from './constraint-panel.utils';

// Mercredi 1 juillet 2026 en heure locale
const WED = new Date(2026, 6, 1);

function makeForm(overrides: Partial<ConstraintFormValue> = {}): ConstraintFormValue {
  return {
    slot: 'MORNING',
    kind: 'UNAVAILABLE',
    type: 'PONCTUEL',
    expiresAt: '',
    startDate: '',
    endDate: '',
    ...overrides,
  };
}

describe('buildConstraintDto', () => {
  it('PONCTUEL: recurKind=PUNCTUAL, startDate=endDate=selected date, expiresAt auto', () => {
    const dto = buildConstraintDto(makeForm({ type: 'PONCTUEL' }), WED);
    expect(dto.recurKind).toBe('PUNCTUAL');
    expect(dto.startDate).toBe('2026-07-01');
    expect(dto.endDate).toBe('2026-07-01');
    expect(dto.expiresAt).toBe('2026-07-01T23:59:59.000Z');
    expect(dto.slot).toBe('MORNING');
    expect(dto.kind).toBe('UNAVAILABLE');
  });

  it('RECURRENT: recurKind=RECURRING, dayOfWeek inferred (mercredi=3), expiresAt from form', () => {
    const dto = buildConstraintDto(
      makeForm({ type: 'RECURRENT', expiresAt: '2027-01-01', slot: 'EVENING' }),
      WED,
    );
    expect(dto.recurKind).toBe('RECURRING');
    expect(dto.dayOfWeek).toBe(3);
    expect(dto.slot).toBe('EVENING');
    expect(dto.expiresAt).toBe('2027-01-01T23:59:59.000Z');
    expect(dto.startDate).toBe('2026-07-01'); // première occurrence = jour sélectionné
    expect(dto.endDate).toBeUndefined();
  });

  it('PLAGE: startDate/endDate from form, expiresAt auto from endDate', () => {
    const dto = buildConstraintDto(
      makeForm({
        type: 'PLAGE',
        startDate: '2026-07-10',
        endDate: '2026-07-20',
        slot: 'AFTERNOON',
      }),
      WED,
    );
    expect(dto.recurKind).toBe('PUNCTUAL');
    expect(dto.startDate).toBe('2026-07-10');
    expect(dto.endDate).toBe('2026-07-20');
    expect(dto.expiresAt).toBe('2026-07-20T23:59:59.000Z');
  });

  it('kind=AVAILABLE transmis fidèlement', () => {
    const dto = buildConstraintDto(makeForm({ kind: 'AVAILABLE' }), WED);
    expect(dto.kind).toBe('AVAILABLE');
  });

  it('slot=FULL_DAY transmis', () => {
    const dto = buildConstraintDto(makeForm({ slot: 'FULL_DAY' }), WED);
    expect(dto.slot).toBe('FULL_DAY');
  });

  it('RECURRENT dimanche: dayOfWeek=0', () => {
    const SUN = new Date(2026, 6, 5); // 5 juillet 2026 = dimanche
    const dto = buildConstraintDto(makeForm({ type: 'RECURRENT', expiresAt: '2027-01-01' }), SUN);
    expect(dto.dayOfWeek).toBe(0);
  });
});

describe('ConstraintPanel — pictogrammes (story 51.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const EXISTING: AvailabilityDeclarationDto = {
    id: 'd1',
    userId: 'u1',
    kind: 'UNAVAILABLE',
    recurKind: 'PUNCTUAL',
    dayOfWeek: null,
    slot: 'MORNING',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-12-31T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
  };

  function create() {
    TestBed.configureTestingModule({
      imports: [ConstraintPanel],
      providers: [{ provide: AvailabilityService, useValue: {} }],
    });
    const fixture = TestBed.createComponent(ConstraintPanel);
    fixture.componentRef.setInput('date', WED);
    fixture.componentRef.setInput('slot', 'MORNING');
    fixture.componentRef.setInput('existingDeclaration', EXISTING);
    fixture.detectChanges();
    return fixture;
  }

  const names = (root: Element) =>
    Array.from(root.querySelectorAll('app-icon')).map((i) => i.getAttribute('data-icon'));

  it('fermer dans l’en-tête, supprimer dans les actions', () => {
    const el = create().nativeElement as HTMLElement;
    expect(names(el.querySelector('.panel-header')!)).toEqual(['fermer']);
    expect(names(el.querySelector('.panel-actions')!)).toEqual(['supprimer']);
  });

  it('chacune des trois invites de confirmation est précédée d’un avertissement', () => {
    const fixture = create();
    const comp = fixture.componentInstance as any;
    const el = fixture.nativeElement as HTMLElement;

    for (const open of [
      () => comp.splitDialogAction.set('modify'),
      () => comp.splitDialogAction.set('delete'),
      () => {
        comp.splitDialogAction.set(null);
        comp.conflictData.set([]);
      },
    ]) {
      open();
      fixture.detectChanges();
      const warn = el.querySelector('.confirm-warn')!;
      expect(names(warn)).toEqual(['avertissement']);
      expect(warn.textContent).not.toContain('⚠');
    }
  });
});
