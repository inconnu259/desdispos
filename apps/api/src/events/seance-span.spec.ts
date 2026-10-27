import { BadRequestException } from '@nestjs/common';
import { spanEnd, spanSlots } from '@master-jdr/shared';
import {
  DURATION_CAP_MESSAGE,
  isSeancePast,
  upcomingSeanceOr,
  DURATION_FULL_DAY_MESSAGE,
  assertDuration,
  seanceSpanEnd,
} from './seance-span';

describe('spanEnd / spanSlots — créneaux enchaînés (Story 47.1, AD-10)', () => {
  it('une durée de 1 créneau : la fin est le départ', () => {
    expect(spanEnd('2026-11-14', 'AFTERNOON', 1)).toEqual({ date: '2026-11-14', slot: 'AFTERNOON' });
    expect(spanSlots('2026-11-14', 'AFTERNOON', 1)).toEqual([
      { date: '2026-11-14', slot: 'AFTERNOON' },
    ]);
  });

  it('le soir est suivi du matin du lendemain : samedi soir × 3 → dimanche après-midi', () => {
    expect(spanEnd('2026-11-14', 'EVENING', 3)).toEqual({ date: '2026-11-15', slot: 'AFTERNOON' });
    expect(spanSlots('2026-11-14', 'EVENING', 3)).toEqual([
      { date: '2026-11-14', slot: 'EVENING' },
      { date: '2026-11-15', slot: 'MORNING' },
      { date: '2026-11-15', slot: 'AFTERNOON' },
    ]);
  });

  it('fin de mois et d’année : 31 octobre soir × 2 → 1er novembre matin ; 31 décembre soir × 2 → 1er janvier', () => {
    expect(spanEnd('2026-10-31', 'EVENING', 2)).toEqual({ date: '2026-11-01', slot: 'MORNING' });
    expect(spanEnd('2026-12-31', 'EVENING', 2)).toEqual({ date: '2027-01-01', slot: 'MORNING' });
  });

  it('quinze jours : 45 créneaux depuis un matin finissent le soir du quinzième jour', () => {
    expect(spanEnd('2026-11-01', 'MORNING', 45)).toEqual({ date: '2026-11-15', slot: 'EVENING' });
    expect(spanSlots('2026-11-01', 'MORNING', 45)).toHaveLength(45);
  });

  it('FULL_DAY à 1 : la fin est le départ lui-même, déplié en trois créneaux du même jour', () => {
    expect(spanEnd('2026-11-14', 'FULL_DAY', 1)).toEqual({ date: '2026-11-14', slot: 'FULL_DAY' });
    expect(spanSlots('2026-11-14', 'FULL_DAY', 1)).toEqual([
      { date: '2026-11-14', slot: 'MORNING' },
      { date: '2026-11-14', slot: 'AFTERNOON' },
      { date: '2026-11-14', slot: 'EVENING' },
    ]);
  });

  it.each([
    ['FULL_DAY au-delà d’un créneau', 'FULL_DAY' as const, 2],
    ['durée nulle', 'EVENING' as const, 0],
    ['durée négative', 'EVENING' as const, -1],
    ['durée fractionnaire', 'EVENING' as const, 1.5],
  ])('%s → RangeError', (_label, slot, n) => {
    expect(() => spanEnd('2026-11-14', slot, n)).toThrow(RangeError);
    expect(() => spanSlots('2026-11-14', slot, n)).toThrow(RangeError);
  });
});

describe('assertDuration / seanceSpanEnd (Story 47.1)', () => {
  it('accepte 1 et 45, refuse 0, 46 et les non-entiers par un 400 écrit', () => {
    expect(() => assertDuration(1)).not.toThrow();
    expect(() => assertDuration(45)).not.toThrow();
    expect(() => assertDuration(46)).toThrow(DURATION_CAP_MESSAGE);
    expect(() => assertDuration(0)).toThrow(BadRequestException);
    expect(() => assertDuration(2.5)).toThrow(BadRequestException);
  });

  it('calcule la fin en dates UTC à minuit', () => {
    expect(seanceSpanEnd(new Date('2026-11-14T00:00:00.000Z'), 'EVENING', 3)).toEqual({
      endDate: new Date('2026-11-15T00:00:00.000Z'),
      endSlot: 'AFTERNOON',
    });
  });

  it('séance sans début : pas de fin', () => {
    expect(seanceSpanEnd(null, null, 3)).toEqual({ endDate: null, endSlot: null });
  });

  it('FULL_DAY au-delà d’un créneau → 400 français', () => {
    expect(() => seanceSpanEnd(new Date('2026-11-14T00:00:00.000Z'), 'FULL_DAY', 2)).toThrow(
      DURATION_FULL_DAY_MESSAGE,
    );
  });
});

describe('isSeancePast / upcomingSeanceOr — la règle « passée » (Story 47.2)', () => {
  const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
  const TODAY = '2026-11-14';

  it('sans date : jamais passée', () => {
    expect(isSeancePast(null, null, TODAY)).toBe(false);
  });

  it('un créneau : passée le lendemain, pas le jour même', () => {
    expect(isSeancePast(day('2026-11-14'), day('2026-11-14'), TODAY)).toBe(false);
    expect(isSeancePast(day('2026-11-13'), day('2026-11-13'), TODAY)).toBe(true);
  });

  it('sans fin servie, le début décide', () => {
    expect(isSeancePast(day('2026-11-13'), null, TODAY)).toBe(true);
    expect(isSeancePast(day('2026-11-14'), undefined, TODAY)).toBe(false);
  });

  it('une plage commencée reste à venir jusqu’à sa fin ; finie hier, elle est passée', () => {
    expect(isSeancePast(day('2026-11-13'), day('2026-11-15'), TODAY)).toBe(false);
    expect(isSeancePast(day('2026-11-13'), day('2026-11-14'), TODAY)).toBe(false);
    expect(isSeancePast(day('2026-11-11'), day('2026-11-13'), TODAY)).toBe(true);
  });

  it('le filtre Prisma : sans date, ou fin ≥ aujourd’hui, ou sans fin et début ≥ aujourd’hui', () => {
    const today = day(TODAY);
    expect(upcomingSeanceOr(today)).toEqual([
      { startDate: null },
      { endDate: { gte: today } },
      { endDate: null, startDate: { gte: today } },
    ]);
    // Sans borne exploitable, seules les séances sans date restent.
    expect(upcomingSeanceOr(null)).toEqual([{ startDate: null }]);
  });
});
