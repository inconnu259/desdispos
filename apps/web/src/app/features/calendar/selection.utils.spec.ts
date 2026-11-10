import { describe, expect, it } from 'vitest';
import type { WeekCell } from './calendar-week-view/calendar-week-view';
import { buildBatchItems, mergeCells, monthRangeDays, weekRangeCells } from './selection.utils';

function makeSlotData() {
  return { status: 'UNKNOWN' as const, preview: null, declLabel: null };
}

function makeWeekCells(dates: string[]): WeekCell[] {
  return dates.map((iso) => ({
    date: new Date(iso + 'T00:00:00'),
    label: iso,
    isToday: false,
    isPast: false,
    morning: makeSlotData(),
    afternoon: makeSlotData(),
    evening: makeSlotData(),
  }));
}

describe('weekRangeCells', () => {
  const cells = makeWeekCells([
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
    '2026-08-16',
  ]);

  it('glissement de gauche à droite → toutes les cellules traversées, même slot', () => {
    const anchor = { date: cells[1].date, slot: 'EVENING' as const };
    const current = { date: cells[4].date, slot: 'EVENING' as const };
    const range = weekRangeCells(anchor, current, cells);
    expect(range.map((c) => c.date.getTime())).toEqual(
      cells.slice(1, 5).map((c) => c.date.getTime()),
    );
    expect(range.every((c) => c.slot === 'EVENING')).toBe(true);
  });

  it('glissement de droite à gauche → même plage, ordre chronologique', () => {
    const anchor = { date: cells[4].date, slot: 'MORNING' as const };
    const current = { date: cells[1].date, slot: 'MORNING' as const };
    const range = weekRangeCells(anchor, current, cells);
    expect(range.map((c) => c.date.getTime())).toEqual(
      cells.slice(1, 5).map((c) => c.date.getTime()),
    );
  });

  it('current sur un autre slot que anchor → clampé sur le slot de anchor', () => {
    const anchor = { date: cells[0].date, slot: 'AFTERNOON' as const };
    const current = { date: cells[2].date, slot: 'EVENING' as const };
    const range = weekRangeCells(anchor, current, cells);
    expect(range.every((c) => c.slot === 'AFTERNOON')).toBe(true);
    expect(range).toHaveLength(3);
  });

  it('anchor === current → une seule cellule', () => {
    const anchor = { date: cells[3].date, slot: 'EVENING' as const };
    const range = weekRangeCells(anchor, anchor, cells);
    expect(range).toHaveLength(1);
  });
});

describe('monthRangeDays', () => {
  it('glissement chronologique → plage inclusive', () => {
    const anchor = new Date('2026-08-10T00:00:00');
    const current = new Date('2026-08-13T00:00:00');
    const range = monthRangeDays(anchor, current);
    expect(range.map((d) => d.getDate())).toEqual([10, 11, 12, 13]);
  });

  it('glissement anti-chronologique → plage triée dans le sens chronologique', () => {
    const anchor = new Date('2026-08-13T00:00:00');
    const current = new Date('2026-08-10T00:00:00');
    const range = monthRangeDays(anchor, current);
    expect(range.map((d) => d.getDate())).toEqual([10, 11, 12, 13]);
  });

  it('enjambement de fin de mois (ligne suivante de la grille)', () => {
    const anchor = new Date('2026-08-30T00:00:00');
    const current = new Date('2026-09-02T00:00:00');
    const range = monthRangeDays(anchor, current);
    expect(range.map((d) => d.toISOString().substring(0, 10))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('anchor === current → un seul jour', () => {
    const d = new Date('2026-08-10T00:00:00');
    expect(monthRangeDays(d, d)).toHaveLength(1);
  });
});

describe('buildBatchItems', () => {
  it('un item PUNCTUAL par cellule, jamais RECURRING', () => {
    const cells = [
      { date: new Date('2026-08-10T00:00:00'), slot: 'EVENING' as const },
      { date: new Date('2026-08-11T00:00:00'), slot: 'EVENING' as const },
    ];
    const items = buildBatchItems(cells, 'UNAVAILABLE');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.recurKind).toBe('PUNCTUAL');
      expect(item.kind).toBe('UNAVAILABLE');
    }
    expect(items[0].startDate).toBe('2026-08-10');
    expect(items[0].endDate).toBe('2026-08-10');
    expect(items[0].expiresAt).toBe('2026-08-10T23:59:59.000Z');
    expect(items[1].startDate).toBe('2026-08-11');
  });

  it('kind AVAILABLE propagé à tous les items', () => {
    const cells = [{ date: new Date('2026-08-10T00:00:00'), slot: 'FULL_DAY' as const }];
    const items = buildBatchItems(cells, 'AVAILABLE');
    expect(items[0].kind).toBe('AVAILABLE');
    expect(items[0].slot).toBe('FULL_DAY');
  });

  it('liste vide → liste vide', () => {
    expect(buildBatchItems([], 'UNAVAILABLE')).toEqual([]);
  });
});

describe('mergeCells (Story 52.3)', () => {
  const cell = (iso: string, slot: 'MORNING' | 'EVENING' | 'FULL_DAY') => ({
    date: new Date(iso + 'T00:00:00'),
    slot,
  });

  it('réunit sans doublon, trié par date, le créneau déjà retenu gardant sa place', () => {
    const base = [cell('2026-08-21', 'FULL_DAY'), cell('2026-08-20', 'EVENING')];
    const added = [
      cell('2026-08-20', 'FULL_DAY'),
      cell('2026-08-21', 'FULL_DAY'),
      cell('2026-08-22', 'FULL_DAY'),
    ];

    const merged = mergeCells(base, added);

    expect(merged.map((c) => `${c.date.getDate()}|${c.slot}`)).toEqual([
      '20|EVENING',
      '20|FULL_DAY',
      '21|FULL_DAY',
      '22|FULL_DAY',
    ]);
  });

  it('une base vide rend les créneaux ajoutés, et rien ne rend rien', () => {
    expect(mergeCells([], [cell('2026-08-20', 'MORNING')])).toHaveLength(1);
    expect(mergeCells([], [])).toEqual([]);
  });
});
