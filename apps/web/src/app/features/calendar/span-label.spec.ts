import { describe, expect, it } from 'vitest';
import {
  candidateSpanSentence,
  candidateSpanShort,
  entrySpanShortLabel,
  spanCompactLabel,
} from './span-label';

describe('libellés de candidats de plusieurs créneaux (Story 47.5)', () => {
  const friday = { date: '2026-11-06', slot: 'EVENING' as const };

  it('une plage de 6 créneaux s’écrit de son début à sa fin', () => {
    expect(candidateSpanShort(friday, 6)).toBe('ven. 6 nov. soir → dim. 8 nov. après-midi');
    expect(candidateSpanSentence(friday, 6)).toBe('du vendredi 6 soir au dimanche 8 après-midi');
  });

  it('un créneau seul n’a pas de plage écrite (le texte d’avant reste celui de chaque surface)', () => {
    expect(candidateSpanShort(friday, 1)).toBeNull();
    expect(candidateSpanSentence(friday, 1)).toBeNull();
  });

  it('une durée absente, invalide ou une journée entière : pas de plage, jamais d’exception', () => {
    expect(candidateSpanShort(friday, undefined as unknown as number)).toBeNull();
    expect(candidateSpanShort(friday, 0)).toBeNull();
    expect(candidateSpanShort({ date: '2026-11-06', slot: 'FULL_DAY' }, 3)).toBeNull();
  });

  it('accepte une date ISO complète', () => {
    expect(candidateSpanShort({ date: '2026-11-06T00:00:00.000Z', slot: 'EVENING' }, 2)).toBe(
      'ven. 6 nov. soir → sam. 7 nov. matin',
    );
  });

  it('la forme compacte du sélecteur n’écrit pas le mois', () => {
    expect(
      spanCompactLabel(
        { date: '2026-11-06', slot: 'EVENING' },
        { date: '2026-11-08', slot: 'AFTERNOON' },
      ),
    ).toBe('ven. 6 soir → dim. 8 après-midi');
  });

  it('entrySpanShortLabel : une plage s’écrit, un créneau seul rend null', () => {
    expect(
      entrySpanShortLabel({
        date: '2026-11-06',
        slot: 'EVENING',
        endDate: '2026-11-08',
        endSlot: 'AFTERNOON',
      }),
    ).toBe('ven. 6 nov. soir → dim. 8 nov. après-midi');
    expect(entrySpanShortLabel({ date: '2026-11-06', slot: 'EVENING' })).toBeNull();
    expect(
      entrySpanShortLabel({
        date: '2026-11-06',
        slot: 'EVENING',
        endDate: '2026-11-06',
        endSlot: 'EVENING',
      }),
    ).toBeNull();
  });
});
