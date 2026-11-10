import { describe, it, expect } from 'vitest';
import { flattenVoyageursProteges } from '../ryuutama/homme-dragon-voyageurs';

describe('flattenVoyageursProteges', () => {
  it('liste vide pour aucune aventure', () => {
    expect(flattenVoyageursProteges([])).toEqual([]);
  });

  it('liste vide pour des aventures sans voyageur', () => {
    expect(flattenVoyageursProteges([{ voyageurs: [] }, { voyageurs: [] }])).toEqual([]);
  });

  it("dédoublonne par userId et garde l'ordre de première apparition", () => {
    const result = flattenVoyageursProteges([
      {
        voyageurs: [
          { userId: 'u1', pseudo: 'alice' },
          { userId: 'u2', pseudo: 'bob' },
        ],
      },
      {
        voyageurs: [
          { userId: 'u3', pseudo: 'carla' },
          { userId: 'u1', pseudo: 'alice' },
        ],
      },
    ]);

    expect(result.map((v) => v.pseudo)).toEqual(['alice', 'bob', 'carla']);
  });

  it('ne garde que userId et pseudo (jamais de champ supplémentaire du DTO)', () => {
    const result = flattenVoyageursProteges([
      {
        voyageurs: [{ userId: 'u1', pseudo: 'alice', displayName: 'Alice' } as never],
      },
    ]);

    expect(result).toEqual([{ userId: 'u1', pseudo: 'alice' }]);
  });
});
