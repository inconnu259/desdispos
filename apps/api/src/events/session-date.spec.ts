import { formatSessionDate, formatSessionSpan } from './session-date';

describe('formatSessionDate (Story 40.4)', () => {
  it('jour en toutes lettres et créneau entre parenthèses', () => {
    const day = new Date('2026-10-24T00:00:00.000Z');
    expect(formatSessionDate(day, 'EVENING')).toBe('samedi 24 octobre (soir)');
    expect(formatSessionDate(day, 'MORNING')).toBe('samedi 24 octobre (matin)');
    expect(formatSessionDate(day, 'AFTERNOON')).toBe('samedi 24 octobre (après-midi)');
    expect(formatSessionDate(day, 'FULL_DAY')).toBe('samedi 24 octobre (toute la journée)');
  });

  it('sans créneau : la date seule', () => {
    expect(formatSessionDate(new Date('2026-10-24T00:00:00.000Z'), null)).toBe('samedi 24 octobre');
  });

  it('le jour UTC stocké n’est jamais décalé, quel que soit le fuseau', () => {
    expect(formatSessionDate(new Date('2026-10-24T23:59:59.000Z'), null)).toBe('samedi 24 octobre');
    expect(formatSessionDate(new Date('2026-01-01T00:00:00.000Z'), 'EVENING')).toBe(
      'jeudi 1 janvier (soir)',
    );
  });
});

describe('formatSessionSpan (Story 47.2)', () => {
  const sat = new Date('2026-11-14T00:00:00.000Z');
  const sun = new Date('2026-11-15T00:00:00.000Z');

  it('un créneau (fin absente, ou égale au début) : le texte de formatSessionDate', () => {
    expect(formatSessionSpan(sat, 'EVENING')).toBe('samedi 14 novembre (soir)');
    expect(formatSessionSpan(sat, 'EVENING', null, null)).toBe('samedi 14 novembre (soir)');
    expect(formatSessionSpan(sat, 'EVENING', sat, 'EVENING')).toBe('samedi 14 novembre (soir)');
    expect(formatSessionSpan(sat, null, sat, null)).toBe('samedi 14 novembre');
  });

  it('plusieurs créneaux : « du … au … », créneaux entre parenthèses', () => {
    expect(formatSessionSpan(sat, 'EVENING', sun, 'AFTERNOON')).toBe(
      'du samedi 14 novembre (soir) au dimanche 15 novembre (après-midi)',
    );
  });

  it('même jour, créneaux différents', () => {
    expect(formatSessionSpan(sat, 'MORNING', sat, 'EVENING')).toBe(
      'du samedi 14 novembre (matin) au samedi 14 novembre (soir)',
    );
  });
});
