import { Injectable } from '@nestjs/common';
import type { DatableSeanceFilter } from '../events/ports/datable-seance-filter.port';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Story 45.1 (AR3) — un scénario clôturé (`PASSE`) est figé : on n'y propose plus de date
 * (`createSeancePoll` le refuse). Implémente `DatableSeanceFilter`, lié par `PortsModule`.
 * Une seule lecture, quel que soit le nombre de séances.
 */
@Injectable()
export class ScenarioDatableSeanceFilter implements DatableSeanceFilter {
  constructor(private readonly prisma: PrismaService) {}

  async excludedSeanceIds(seanceIds: string[]): Promise<Set<string>> {
    if (seanceIds.length === 0) return new Set();
    const rows = await this.prisma.seance.findMany({
      where: { id: { in: seanceIds }, event: { scenario: { status: 'PASSE' } } },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
}
