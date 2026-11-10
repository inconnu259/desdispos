import type { PrismaService } from '../prisma/prisma.service';
import { ScenarioDatableSeanceFilter } from './datable-seance-filter.service';

// Story 45.1 — l'exclusion « scénario clôturé » : une lecture, en lot ; rien à lire sans séance.

describe('ScenarioDatableSeanceFilter (Story 45.1)', () => {
  it('exclut les séances d’un scénario PASSE, en une seule lecture', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 's2' }]);
    const filter = new ScenarioDatableSeanceFilter({
      seance: { findMany },
    } as unknown as PrismaService);
    expect(await filter.excludedSeanceIds(['s1', 's2', 's3'])).toEqual(new Set(['s2']));
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['s1', 's2', 's3'] }, event: { scenario: { status: 'PASSE' } } },
      }),
    );
  });

  it('aucune séance : aucune lecture', async () => {
    const findMany = jest.fn();
    const filter = new ScenarioDatableSeanceFilter({
      seance: { findMany },
    } as unknown as PrismaService);
    expect(await filter.excludedSeanceIds([])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });
});
