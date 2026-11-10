import { describe, expect, it } from 'vitest';
import { composeSpanKeys, earliestStart } from './compose-span.utils';

/** Jour local à minuit (comme les cases des grilles). */
const d = (key: string) => {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day);
};

describe('composeSpanKeys (Story 47.4)', () => {
  it('à 1 créneau, rien ne s’allume (la grille reste celle d’avant)', () => {
    expect([...composeSpanKeys([{ date: d('2026-11-06'), slot: 'EVENING' }], 1)]).toEqual([]);
  });

  it('6 créneaux depuis vendredi soir : samedi entier et dimanche matin + après-midi, départ exclu', () => {
    const keys = composeSpanKeys([{ date: d('2026-11-06'), slot: 'EVENING' }], 6);

    expect([...keys]).toEqual([
      '2026-11-07|MORNING',
      '2026-11-07|AFTERNOON',
      '2026-11-07|EVENING',
      '2026-11-08|MORNING',
      '2026-11-08|AFTERNOON',
    ]);
    expect(keys.has('2026-11-06|EVENING')).toBe(false);
    expect(keys.has('2026-11-08|EVENING')).toBe(false);
  });

  it('plusieurs départs : l’union de leurs plages ; un départ couvert par une autre plage reste un départ', () => {
    const keys = composeSpanKeys(
      [
        { date: d('2026-11-06'), slot: 'EVENING' },
        { date: d('2026-11-07'), slot: 'MORNING' },
      ],
      3,
    );

    expect([...keys].sort()).toEqual(['2026-11-07|AFTERNOON', '2026-11-07|EVENING']);
  });

  it('une journée entière n’a pas de plage au-delà d’un créneau', () => {
    expect([...composeSpanKeys([{ date: d('2026-11-06'), slot: 'FULL_DAY' }], 3)]).toEqual([]);
  });

  it('passe d’un mois à l’autre (soir du 30 → matin du 1er)', () => {
    expect([...composeSpanKeys([{ date: d('2026-11-30'), slot: 'EVENING' }], 2)]).toEqual([
      '2026-12-01|MORNING',
    ]);
  });
});

describe('earliestStart (Story 47.4)', () => {
  it('le premier départ, par jour puis par créneau', () => {
    expect(
      earliestStart([
        { date: d('2026-11-13'), slot: 'EVENING' },
        { date: d('2026-11-06'), slot: 'EVENING' },
        { date: d('2026-11-06'), slot: 'AFTERNOON' },
      ]),
    ).toEqual({ date: d('2026-11-06'), slot: 'AFTERNOON' });
    expect(earliestStart([])).toBeNull();
  });
});
