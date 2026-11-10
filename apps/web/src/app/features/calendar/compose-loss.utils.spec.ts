import { describe, expect, it } from 'vitest';
import { composeLoss, type LossOption } from './compose-loss.utils';

const OPTIONS: LossOption[] = [
  { date: '2026-11-06T00:00:00.000Z', slot: 'EVENING', answers: 2 },
  { date: '2026-11-13', slot: 'EVENING', answers: 1 },
  { date: '2026-11-20', slot: 'EVENING', answers: 1 },
];
const keys = (...k: string[]) => new Set(k);

describe('composeLoss (Story 47.4)', () => {
  it('même durée : seules les réponses des options retirées sont comptées', () => {
    expect(composeLoss(OPTIONS, keys('2026-11-06|EVENING', '2026-11-13|EVENING'), 3, 3)).toEqual({
      answers: 1,
      removed: 1,
      durationChanged: false,
    });
  });

  it('même durée, rien de retiré : aucune perte', () => {
    expect(
      composeLoss(
        OPTIONS,
        keys('2026-11-06|EVENING', '2026-11-13|EVENING', '2026-11-20|EVENING'),
        1,
        1,
      ),
    ).toEqual({ answers: 0, removed: 0, durationChanged: false });
  });

  it('durée changée : TOUTES les réponses comptent, même sur les options gardées', () => {
    expect(
      composeLoss(
        OPTIONS,
        keys('2026-11-06|EVENING', '2026-11-13|EVENING', '2026-11-20|EVENING'),
        6,
        3,
      ),
    ).toEqual({ answers: 4, removed: 0, durationChanged: true });
  });

  it('création (aucune option existante) : rien à perdre, même en changeant la durée', () => {
    expect(composeLoss([], keys('2026-11-06|EVENING'), 6, 1)).toEqual({
      answers: 0,
      removed: 0,
      durationChanged: true,
    });
  });
});
