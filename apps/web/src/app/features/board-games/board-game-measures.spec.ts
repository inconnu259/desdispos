import { fitsHeadcount } from './board-game-measures';

describe('fitsHeadcount (Story 49.1)', () => {
  it.each([
    [2, 4, 2, true],
    [2, 4, 3, true],
    [2, 4, 4, true],
    [2, 4, 1, false],
    [2, 4, 5, false],
    [3, 3, 3, true],
    [3, 3, 4, false],
  ])('%i–%i joueurs, N = %i → %s', (min, max, n, expected) => {
    expect(fitsHeadcount({ minPlayers: min, maxPlayers: max }, n)).toBe(expected);
  });

  it('un jeu sans nombre de joueurs, ou avec une seule borne, n’est jamais jouable', () => {
    expect(fitsHeadcount({ minPlayers: null, maxPlayers: null }, 4)).toBe(false);
    expect(fitsHeadcount({ minPlayers: 2, maxPlayers: null }, 4)).toBe(false);
    expect(fitsHeadcount({ minPlayers: null, maxPlayers: 6 }, 4)).toBe(false);
  });
});
