import { isFreeOn, type DeclaredAvailability } from './slot-availability';

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

function punctual(
  kind: DeclaredAvailability['kind'],
  slot: DeclaredAvailability['slot'],
  from: string,
  to: string,
): DeclaredAvailability {
  return {
    kind,
    recurKind: 'PUNCTUAL',
    dayOfWeek: null,
    slot,
    startDate: day(from),
    endDate: day(to),
    expiresAt: FUTURE,
  };
}

describe('isFreeOn (Story 40.5)', () => {
  const NOW = new Date('2026-10-01T00:00:00.000Z');

  it('sans déclaration : on ne sait pas, donc pas libre', () => {
    expect(isFreeOn([], day('2026-10-17'), 'EVENING', NOW)).toBe(false);
  });

  it('une disponibilité qui vise le créneau le rend libre', () => {
    const d = [punctual('AVAILABLE', 'EVENING', '2026-10-17', '2026-10-17')];
    expect(isFreeOn(d, day('2026-10-17'), 'EVENING', NOW)).toBe(true);
    expect(isFreeOn(d, day('2026-10-17'), 'MORNING', NOW)).toBe(false);
  });

  it('une indisponibilité l’emporte sur une disponibilité', () => {
    const d = [
      punctual('AVAILABLE', 'FULL_DAY', '2026-10-17', '2026-10-24'),
      punctual('UNAVAILABLE', 'EVENING', '2026-10-18', '2026-10-18'),
    ];
    expect(isFreeOn(d, day('2026-10-18'), 'EVENING', NOW)).toBe(false);
    expect(isFreeOn(d, day('2026-10-18'), 'MORNING', NOW)).toBe(true);
  });

  it('une déclaration sur un autre créneau ne dit rien du créneau demandé', () => {
    const d = [punctual('UNAVAILABLE', 'MORNING', '2026-10-17', '2026-10-24')];
    expect(isFreeOn(d, day('2026-10-20'), 'MORNING', NOW)).toBe(false);
    expect(isFreeOn(d, day('2026-10-20'), 'EVENING', NOW)).toBe(false);
  });

  it('une disponibilité sur toute la journée couvre chaque créneau de la période, pas au-delà', () => {
    const d = [punctual('AVAILABLE', 'FULL_DAY', '2026-10-17', '2026-10-24')];
    expect(isFreeOn(d, day('2026-10-20'), 'AFTERNOON', NOW)).toBe(true);
    expect(isFreeOn(d, day('2026-10-30'), 'AFTERNOON', NOW)).toBe(false);
  });

  it('une déclaration récurrente vise son jour de la semaine', () => {
    const saturday: DeclaredAvailability = {
      kind: 'AVAILABLE',
      recurKind: 'RECURRING',
      dayOfWeek: 6,
      slot: 'EVENING',
      startDate: day('2026-10-01'),
      endDate: null,
      expiresAt: FUTURE,
    };
    expect(isFreeOn([saturday], day('2026-10-17'), 'EVENING', NOW)).toBe(true); // samedi
    expect(isFreeOn([saturday], day('2026-10-16'), 'EVENING', NOW)).toBe(true); // couvert par la période
    expect(isFreeOn([saturday], day('2026-09-30'), 'EVENING', NOW)).toBe(false);
  });

  it('une déclaration expirée est ignorée', () => {
    const expired = {
      ...punctual('AVAILABLE', 'FULL_DAY', '2026-10-17', '2026-10-17'),
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    expect(isFreeOn([expired], day('2026-10-17'), 'EVENING', NOW)).toBe(false);
  });
});
