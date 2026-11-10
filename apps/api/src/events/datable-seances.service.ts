import { Inject, Injectable } from '@nestjs/common';
import {
  familyOf,
  isDatableSeance,
  isPartieActive,
  partieStatus,
  type DatableSeanceEntry,
} from '@master-jdr/shared';
import { PermissionService } from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DATABLE_SEANCE_FILTER,
  type DatableSeanceFilter,
} from './ports/datable-seance-filter.port';
import { EventsService } from './events.service';

/**
 * `GET /me/datable-seances` (Story 45.1, AR3) — les rendez-vous de MES parties qui attendent une date et que
 * je peux dater : séance sans date ni sondage, événement non annulé, partie active, `can.propose`
 * (`isDatableSeance`, la définition partagée avec les trois calendriers). Lecture seule.
 *
 * Nombre de lectures FIXE, quel que soit le nombre de séances : les séances sans date, l'avancement des
 * parties, les séances écartées par `scenarios/` (port) et les droits d'organisateur (`organizerCan`).
 */
@Injectable()
export class DatableSeancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly permissions: PermissionService,
    @Inject(DATABLE_SEANCE_FILTER) private readonly filter: DatableSeanceFilter,
  ) {}

  async list(userId: string): Promise<DatableSeanceEntry[]> {
    const rows = await this.prisma.seance.findMany({
      where: {
        startDate: null,
        pollId: null,
        event: {
          cancelledAt: null,
          // Mes parties seulement (propriétaire ou membre), non masquées par moi ; la clôture est rejugée
          // plus bas par `partieStatus`, qui est la seule définition de « partie active ».
          partie: {
            closedAt: null,
            hiddenBy: { none: { userId } },
            OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        durationSlots: true,
        event: {
          select: {
            title: true,
            createdAt: true,
            partie: {
              select: { id: true, name: true, kind: true, gameSystemId: true, closedAt: true },
            },
            seances: { select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });
    if (rows.length === 0) return [];

    const parties = [...new Map(rows.map((r) => [r.event.partie.id, r.event.partie])).values()];
    const seanceIds = rows.map((r) => r.id);
    const [progressOf, excluded, cans] = await Promise.all([
      this.events.progressByPartieIds(parties),
      this.filter.excludedSeanceIds(seanceIds),
      this.permissions.organizerCan(
        userId,
        seanceIds.map((seanceId) => ({ seanceId })),
      ),
    ]);

    const out: DatableSeanceEntry[] = [];
    rows.forEach((row, i) => {
      const partie = row.event.partie;
      const datable = isDatableSeance({
        hasDate: false,
        hasPoll: false,
        cancelled: false,
        frozen: !isPartieActive(partieStatus(partie.closedAt, progressOf(partie.id))),
        canOrganize: cans[i].propose,
      });
      if (!datable || excluded.has(row.id)) return;
      const rank = row.event.seances.findIndex((s) => s.id === row.id) + 1;
      out.push({
        seanceId: row.id,
        partieId: partie.id,
        partieName: partie.name,
        family: familyOf(partie.gameSystemId) ?? 'jdr',
        kind: partie.kind,
        title: row.event.title,
        seanceRank: rank,
        seanceCount: row.event.seances.length,
        durationSlots: row.durationSlots,
        can: cans[i],
      });
    });
    // Par nom de partie puis par ordre de création : les lignes d'une même partie se suivent.
    return out.sort((a, b) => a.partieName.localeCompare(b.partieName, 'fr'));
  }
}
