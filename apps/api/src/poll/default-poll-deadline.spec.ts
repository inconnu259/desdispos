import { defaultPollDeadline } from '@master-jdr/shared';

// Story 45.4 — `defaultPollDeadline` : le plus TÔT de « dans 14 jours » et de « la veille du premier créneau »,
// jamais avant aujourd'hui. Fonction partagée par le composer et le serveur.

const TODAY = '2026-11-02';
const at = (...days: string[]) => days.map((date) => ({ date }));

describe('defaultPollDeadline (Story 45.4)', () => {
  it('créneaux lointains → dans 14 jours', () => {
    expect(defaultPollDeadline(at('2027-01-10', '2027-01-17'), TODAY)).toBe('2026-11-16');
  });

  it('premier créneau proche → la veille du premier créneau, même si d’autres sont plus loin', () => {
    expect(defaultPollDeadline(at('2026-11-20', '2026-11-08'), TODAY)).toBe('2026-11-07');
  });

  it('premier créneau exactement dans 15 jours → dans 14 jours (égalité : la veille)', () => {
    expect(defaultPollDeadline(at('2026-11-17'), TODAY)).toBe('2026-11-16');
  });

  it('premier créneau aujourd’hui ou demain → aujourd’hui, jamais avant', () => {
    expect(defaultPollDeadline(at('2026-11-02'), TODAY)).toBe(TODAY);
    expect(defaultPollDeadline(at('2026-11-03'), TODAY)).toBe(TODAY);
  });

  it('un créneau déjà passé → aujourd’hui', () => {
    expect(defaultPollDeadline(at('2026-10-20', '2026-12-01'), TODAY)).toBe(TODAY);
  });

  it('sans créneau → dans 14 jours', () => {
    expect(defaultPollDeadline([], TODAY)).toBe('2026-11-16');
  });

  it('accepte des dates ISO complètes et franchit les fins de mois et d’année', () => {
    expect(defaultPollDeadline(at('2027-03-05T00:00:00.000Z'), '2026-12-25')).toBe('2027-01-08');
    expect(defaultPollDeadline(at('2027-01-01T00:00:00.000Z'), '2026-12-25')).toBe('2026-12-31');
  });
});
