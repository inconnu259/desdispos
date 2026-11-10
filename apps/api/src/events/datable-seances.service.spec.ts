import { isDatableSeance } from '@master-jdr/shared';
import type { PermissionService } from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DatableSeancesService } from './datable-seances.service';
import type { EventsService } from './events.service';
import type { DatableSeanceFilter } from './ports/datable-seance-filter.port';

// Story 45.1 — `isDatableSeance` (la définition partagée) et le service de `GET /me/datable-seances` : filtres,
// ordre, et nombre de lectures FIXE. Les refus contre la vraie base sont dans l'e2e.

describe('isDatableSeance (Story 45.1)', () => {
  const base = {
    hasDate: false,
    hasPoll: false,
    cancelled: false,
    frozen: false,
    canOrganize: true,
  };

  it('sans date, sans sondage, non annulée, partie active, droit de proposer → à dater', () => {
    expect(isDatableSeance(base)).toBe(true);
  });

  it.each([
    ['une date', { hasDate: true }],
    ['un sondage (ouvert ou clos sans date)', { hasPoll: true }],
    ['un événement annulé', { cancelled: true }],
    ['une partie figée (terminée ou annulée)', { frozen: true }],
    ['pas le droit de proposer', { canOrganize: false }],
  ])('%s → pas à dater', (_label, over) => {
    expect(isDatableSeance({ ...base, ...over })).toBe(false);
  });
});

const jdr = {
  id: 'pJ',
  name: 'Zèbre',
  kind: 'CAMPAGNE_LINEAIRE',
  gameSystemId: 'ryuutama',
  closedAt: null,
};
const soiree = {
  id: 'pS',
  name: 'Apéro',
  kind: 'ONE_SHOT',
  gameSystemId: 'ralliement',
  closedAt: null,
};

function row(id: string, partie: typeof jdr, title: string, siblings: string[] = [id]) {
  return {
    id,
    event: { title, createdAt: new Date(), partie, seances: siblings.map((s) => ({ id: s })) },
  };
}

const CAN = { propose: true, edit: true, choose: true, extend: false };
const NO = { propose: false, edit: false, choose: false, extend: false };

function build(opts: {
  rows: unknown[];
  cans?: Record<string, typeof CAN>;
  excluded?: string[];
  progress?: Record<string, string>;
}) {
  const prisma = { seance: { findMany: jest.fn().mockResolvedValue(opts.rows) } };
  const events = {
    progressByPartieIds: jest
      .fn()
      .mockResolvedValue((id: string) => opts.progress?.[id] ?? 'started'),
  };
  const permissions = {
    organizerCan: jest.fn((_u: string, targets: { seanceId: string }[]) =>
      Promise.resolve(targets.map((t) => opts.cans?.[t.seanceId] ?? CAN)),
    ),
  };
  const excludedSeanceIds = jest.fn().mockResolvedValue(new Set(opts.excluded ?? []));
  const filter: DatableSeanceFilter = { excludedSeanceIds };
  const service = new DatableSeancesService(
    prisma as unknown as PrismaService,
    events as unknown as EventsService,
    permissions as unknown as PermissionService,
    filter,
  );
  return { service, prisma, events, permissions, excludedSeanceIds };
}

describe('DatableSeancesService (Story 45.1)', () => {
  it('forme servie : rang et nombre de séances de l’événement, famille, droits', async () => {
    const { service } = build({ rows: [row('s2', jdr, 'Quête', ['s1', 's2'])] });
    expect(await service.list('moi')).toEqual([
      {
        seanceId: 's2',
        partieId: 'pJ',
        partieName: 'Zèbre',
        family: 'jdr',
        kind: 'CAMPAGNE_LINEAIRE',
        title: 'Quête',
        seanceRank: 2,
        seanceCount: 2,
        can: CAN,
      },
    ]);
  });

  it('écarte ce que le port exclut, ce que je ne peux pas proposer et les parties terminées ou annulées', async () => {
    const { service } = build({
      rows: [row('s1', jdr, 'A'), row('s2', jdr, 'B'), row('s3', jdr, 'C'), row('s4', soiree, 'D')],
      excluded: ['s1'],
      cans: { s2: NO },
      progress: { pS: 'ended' },
    });
    expect((await service.list('moi')).map((d) => d.seanceId)).toEqual(['s3']);
  });

  it('classe par nom de partie', async () => {
    const { service } = build({ rows: [row('s1', jdr, 'A'), row('s2', soiree, 'B')] });
    expect((await service.list('moi')).map((d) => d.partieName)).toEqual(['Apéro', 'Zèbre']);
  });

  it('nombre de lectures FIXE : une de séances, un avancement, un filtre, un lot de droits', async () => {
    const { service, prisma, events, permissions, excludedSeanceIds } = build({
      rows: [row('s1', jdr, 'A'), row('s2', soiree, 'B'), row('s3', jdr, 'C')],
    });
    await service.list('moi');
    expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
    expect(events.progressByPartieIds).toHaveBeenCalledTimes(1);
    expect(permissions.organizerCan).toHaveBeenCalledTimes(1);
    expect(excludedSeanceIds).toHaveBeenCalledTimes(1);
  });

  it('aucune séance : aucune lecture de plus', async () => {
    const { service, events, permissions, excludedSeanceIds } = build({ rows: [] });
    expect(await service.list('moi')).toEqual([]);
    expect(events.progressByPartieIds).not.toHaveBeenCalled();
    expect(permissions.organizerCan).not.toHaveBeenCalled();
    expect(excludedSeanceIds).not.toHaveBeenCalled();
  });
});
