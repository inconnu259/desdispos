import type { AvailableSlotDto } from '@master-jdr/shared';
import { displayedWindows, windowKeyOf } from './window-list.utils';

const win = (date: string, slot: AvailableSlotDto['slot']): AvailableSlotDto => ({
  date,
  slot,
  members: [],
  durationSlots: 1,
});
const SERVED = [
  win('2030-03-06', 'EVENING'),
  win('2030-03-07', 'MORNING'),
  win('2030-03-09', 'EVENING'),
];

describe('displayedWindows (Story 46.3)', () => {
  it('sans composer, la liste servie telle quelle (copie)', () => {
    const shown = displayedWindows(SERVED, null);
    expect(shown).toEqual(SERVED);
    expect(shown).not.toBe(SERVED);
  });

  it('un composer sans créneau ne retire rien', () => {
    expect(displayedWindows(SERVED, new Set())).toHaveLength(3);
  });

  it('une fenêtre dans le composer quitte la liste, les autres restent dans l’ordre', () => {
    const shown = displayedWindows(SERVED, new Set(['2030-03-07|MORNING']));
    expect(shown.map(windowKeyOf)).toEqual(['2030-03-06|EVENING', '2030-03-09|EVENING']);
  });

  it('retirer la fenêtre du composer la rend à la liste', () => {
    expect(displayedWindows(SERVED, new Set(['2030-03-07|MORNING']))).toHaveLength(2);
    expect(displayedWindows(SERVED, new Set())).toHaveLength(3);
  });

  it('une clé qui n’est pas servie est sans effet (un créneau tapé à la main)', () => {
    expect(displayedWindows(SERVED, new Set(['2031-01-01|EVENING']))).toHaveLength(3);
  });

  it('même jour, autre créneau : seul le départ identique est retiré', () => {
    const shown = displayedWindows(SERVED, new Set(['2030-03-06|MORNING']));
    expect(shown).toHaveLength(3);
  });
});
