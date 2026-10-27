import { describe, expect, it } from 'vitest';
import type { CalendarLayerKey } from '@master-jdr/shared';
import type { AgendaEntry } from './calendar-agenda-view/calendar-agenda-view';
import { buildMonth, nameSpansOncePerRow } from './calendar-month-view/calendar-month-view';
import { buildDayDetail, entryCoversCell, entryIndexRange } from './day-detail.utils';
import { isSpan, spanSentence, spanShortLabel } from './span-label';

const ALL_LAYERS: CalendarLayerKey[] = [
  'mes-indisponibilites',
  'mes-disponibilites',
  'mes-seances',
  'votes-en-cours',
  'inscriptions-ouvertes',
  'disponibilite-groupe',
];
const NOW = new Date('2026-08-17T00:00:00Z');

/** Week-end jeux : du vendredi 6 novembre 2026 au soir au dimanche 8 après-midi. */
const WEEKEND: AgendaEntry = {
  key: 'seance-s1',
  type: 'mes-seances',
  date: '2026-11-06',
  slot: 'EVENING',
  endDate: '2026-11-08',
  endSlot: 'AFTERNOON',
  label: 'Week-end jeux',
  partieId: 'p1',
  scenarioId: 'sc1',
  seanceId: 's1',
};

describe('span-label (Story 47.3)', () => {
  it('isSpan : seule une fin différente du début est une plage', () => {
    const start = { date: '2026-11-06', slot: 'EVENING' as const };
    expect(isSpan(start, null)).toBe(false);
    expect(isSpan(start, { date: '2026-11-06', slot: 'EVENING' })).toBe(false);
    expect(isSpan(start, { date: '2026-11-06', slot: null })).toBe(false);
    // Même jour, créneau de fin AVANT celui du début : incohérent, jamais une plage.
    expect(isSpan(start, { date: '2026-11-06', slot: 'MORNING' })).toBe(false);
    expect(isSpan(start, { date: '2026-11-07', slot: 'EVENING' })).toBe(true);
  });

  it('isSpan : une fin avant le début n’est jamais une plage ; un créneau absent vaut la journée', () => {
    const start = { date: '2026-11-06', slot: 'EVENING' as const };
    expect(isSpan(start, { date: '2026-11-05', slot: 'EVENING' })).toBe(false);
    expect(isSpan(start, { date: '2026-11-06', slot: 'MORNING' })).toBe(false);
    expect(isSpan({ date: '2026-11-06', slot: 'MORNING' }, { date: '2026-11-06', slot: 'EVENING' })).toBe(true);
    // Début sans créneau et fin « journée » le même jour : la même journée, pas une plage.
    expect(isSpan({ date: '2026-11-06', slot: undefined }, { date: '2026-11-06', slot: 'FULL_DAY' })).toBe(false);
    expect(isSpan({ date: '2026-11-06', slot: null }, { date: '2026-11-07', slot: null })).toBe(true);
  });

  it('forme courte « ven. 6 nov. soir → dim. 8 nov. après-midi »', () => {
    expect(
      spanShortLabel({ date: '2026-11-06', slot: 'EVENING' }, { date: '2026-11-08', slot: 'AFTERNOON' }),
    ).toBe('ven. 6 nov. soir → dim. 8 nov. après-midi');
  });

  it('phrase accessible : le mois n’est écrit que s’il diffère', () => {
    expect(
      spanSentence({ date: '2026-11-06', slot: 'EVENING' }, { date: '2026-11-08', slot: 'AFTERNOON' }),
    ).toBe('du vendredi 6 soir au dimanche 8 après-midi');
    expect(
      spanSentence({ date: '2026-10-30', slot: 'EVENING' }, { date: '2026-11-01', slot: 'AFTERNOON' }),
    ).toBe('du vendredi 30 octobre soir au dimanche 1er novembre après-midi');
  });
});

describe('entryCoversCell / entryIndexRange — la plage dépliée (Story 47.3)', () => {
  it('un créneau seul garde exactement la règle d’avant', () => {
    const single: AgendaEntry = { ...WEEKEND, endDate: undefined, endSlot: undefined };
    expect(entryCoversCell(single, '2026-11-06', 'EVENING')).toBe(true);
    expect(entryCoversCell(single, '2026-11-06', 'MORNING')).toBe(false);
    expect(entryCoversCell(single, '2026-11-07', 'EVENING')).toBe(false);
    expect(entryCoversCell({ ...single, slot: 'FULL_DAY' }, '2026-11-06', 'MORNING')).toBe(true);
  });

  it('un week-end couvre 6 créneaux, du vendredi soir au dimanche après-midi, pas un de plus', () => {
    const covered: string[] = [];
    for (const day of ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']) {
      for (const slot of ['MORNING', 'AFTERNOON', 'EVENING'] as const) {
        if (entryCoversCell(WEEKEND, day, slot)) covered.push(`${day}|${slot}`);
      }
    }
    expect(covered).toEqual([
      '2026-11-06|EVENING',
      '2026-11-07|MORNING',
      '2026-11-07|AFTERNOON',
      '2026-11-07|EVENING',
      '2026-11-08|MORNING',
      '2026-11-08|AFTERNOON',
    ]);
  });

  it('une cellule FULL_DAY est couverte dès qu’un de ses créneaux l’est', () => {
    expect(entryCoversCell(WEEKEND, '2026-11-06', 'FULL_DAY')).toBe(true);
    expect(entryCoversCell(WEEKEND, '2026-11-09', 'FULL_DAY')).toBe(false);
  });

  it('une fin sans créneau : le même jour, le créneau de départ ; un autre jour, la fin de ce jour', () => {
    const base: AgendaEntry = { ...WEEKEND, slot: 'MORNING', endSlot: undefined };
    expect(entryCoversCell({ ...base, endDate: '2026-11-06' }, '2026-11-06', 'EVENING')).toBe(false);
    expect(entryCoversCell({ ...base, endDate: '2026-11-07' }, '2026-11-07', 'EVENING')).toBe(true);
  });

  it('fin avant le début : donnée incohérente, l’entrée garde son seul début', () => {
    const range = entryIndexRange({ ...WEEKEND, endDate: '2026-11-01' });
    expect(range).toEqual(entryIndexRange({ ...WEEKEND, endDate: undefined, endSlot: undefined }));
  });
});

describe('buildDayDetail — la plage sur chaque jour (Story 47.3)', () => {
  it('porte la plage, ses bords et son nom accessible', () => {
    const sat = buildDayDetail('2026-11-07', [WEEKEND], ALL_LAYERS, [], NOW);
    const [morning, afternoon, evening] = sat.slots;
    expect([morning.winner, afternoon.winner, evening.winner]).toEqual(['seance', 'seance', 'seance']);
    expect(morning.span).toMatchObject({
      range: 'du vendredi 6 soir au dimanche 8 après-midi',
      continuesBefore: true,
      continuesAfter: false,
      isFirstDay: false,
    });
    expect(afternoon.span).toMatchObject({ continuesBefore: false, continuesAfter: false });
    expect(evening.span).toMatchObject({ continuesBefore: false, continuesAfter: true });
    // Une séance couvre le créneau : il est indisponible, comme avant.
    expect(sat.slots.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('le dernier jour s’arrête à la fin : le soir du dimanche reste libre', () => {
    const sun = buildDayDetail('2026-11-08', [WEEKEND], ALL_LAYERS, [], NOW);
    expect(sun.slots.map((s) => s.winner)).toEqual(['seance', 'seance', 'none']);
    expect(sun.slots[2].span).toBeNull();
  });

  it('le premier jour : seul le soir est couvert, sans connecteur « venant de »', () => {
    const fri = buildDayDetail('2026-11-06', [WEEKEND], ALL_LAYERS, [], NOW);
    expect(fri.slots.map((s) => s.winner)).toEqual(['none', 'none', 'seance']);
    expect(fri.slots[2].span).toMatchObject({ isStart: true, isFirstDay: true, continuesAfter: true });
  });

  it('couche « mes séances » éteinte : l’indisponibilité reste, le nom et les connecteurs disparaissent', () => {
    const sat = buildDayDetail(
      '2026-11-07',
      [WEEKEND],
      ALL_LAYERS.filter((l) => l !== 'mes-seances'),
      [],
      NOW,
    );
    expect(sat.slots.map((s) => s.winner)).toEqual(['seance', 'seance', 'seance']);
    expect(sat.slots.every((s) => s.span === null && s.seanceLabel === null)).toBe(true);
  });

  it('un créneau seul : aucune information de plage', () => {
    const single: AgendaEntry = { ...WEEKEND, endDate: undefined, endSlot: undefined };
    const fri = buildDayDetail('2026-11-06', [single], ALL_LAYERS, [], NOW);
    expect(fri.slots.every((s) => s.span === null)).toBe(true);
  });
});

describe('buildMonth — bandes reliées, nom une fois par ligne (Story 47.3)', () => {
  const NOVEMBER = new Date(2026, 10, 1);
  const rowOf = (weeks: ReturnType<typeof buildMonth>, dayOfMonth: number) =>
    weeks.find((w) => w.some((c) => c.isCurrentMonth && c.date.getDate() === dayOfMonth))!;
  const cellOf = (row: ReturnType<typeof buildMonth>[number], dayOfMonth: number) =>
    row.find((c) => c.isCurrentMonth && c.date.getDate() === dayOfMonth)!;

  it('le week-end : 6 bandes marquées, connecteurs aux changements de jour, nom écrit une seule fois', () => {
    const weeks = buildMonth(NOVEMBER, [WEEKEND], ALL_LAYERS, [], null);
    const row = rowOf(weeks, 6);
    const [fri, sat, sun] = [6, 7, 8].map((d) => cellOf(row, d));

    expect(fri.bands.map((b) => b.winner)).toEqual(['none', 'none', 'seance']);
    expect(sat.bands.map((b) => b.winner)).toEqual(['seance', 'seance', 'seance']);
    expect(sun.bands.map((b) => b.winner)).toEqual(['seance', 'seance', 'none']);

    expect(fri.bands[2].span?.continuesAfter).toBe(true);
    expect(sat.bands[0].span?.continuesBefore).toBe(true);
    expect(sat.bands[2].span?.continuesAfter).toBe(true);
    expect(sun.bands[0].span?.continuesBefore).toBe(true);
    expect(sun.bands[1].span?.continuesAfter).toBe(false);

    const named = [fri, sat, sun].flatMap((c) => c.bands.map((b) => b.text)).filter(Boolean);
    expect(named).toEqual(['Week-end jeux']);
    // Chaque bande couverte garde pourtant sa plage entière pour le nom accessible.
    expect(sat.bands[1].span?.range).toBe('du vendredi 6 soir au dimanche 8 après-midi');
  });

  it('dimanche → lundi : connecteur au bord de la ligne, le nom reprend « ← » sur la ligne suivante', () => {
    const entry: AgendaEntry = {
      ...WEEKEND,
      date: '2026-11-08',
      slot: 'EVENING',
      endDate: '2026-11-09',
      endSlot: 'AFTERNOON',
    };
    const weeks = buildMonth(NOVEMBER, [entry], ALL_LAYERS, [], null);
    const sunday = cellOf(rowOf(weeks, 8), 8);
    const monday = cellOf(rowOf(weeks, 9), 9);

    expect(sunday.bands[2].span?.continuesAfter).toBe(true);
    expect(sunday.bands[2].text).toBe('Week-end jeux');
    expect(monday.bands[0].span?.continuesBefore).toBe(true);
    expect(monday.bands[0].text).toBe('← Week-end jeux');
    expect(monday.bands[1].text).toBeNull();
  });

  it('un créneau seul : la bande est celle d’avant, sans connecteur', () => {
    const single: AgendaEntry = { ...WEEKEND, endDate: undefined, endSlot: undefined };
    const weeks = buildMonth(NOVEMBER, [single], ALL_LAYERS, [], null);
    const fri = cellOf(rowOf(weeks, 6), 6);
    expect(fri.bands[2].winner).toBe('seance');
    expect(fri.bands[2].text).toBe('Week-end jeux');
    expect(fri.bands.every((b) => b.span === null)).toBe(true);
  });

  it('nameSpansOncePerRow est sans effet quand aucune plage n’est présente', () => {
    const weeks = buildMonth(NOVEMBER, [], ALL_LAYERS, [], null);
    const before = JSON.stringify(weeks[1]);
    nameSpansOncePerRow(weeks[1]);
    expect(JSON.stringify(weeks[1])).toBe(before);
  });
});
