import { ForbiddenException } from '@nestjs/common';
import { testGrant } from '../common/test-utils/grant';
import {
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import { EventHostCountsService, toHostCountsDto } from './event-host-counts.service';
import type { EventsService } from './events.service';

const LEA = { userId: 'u1', pseudo: 'lea', displayName: 'Léa' };
const TOM = { userId: 'u2', pseudo: 'tom', displayName: 'Tom' };
const ZOE = { userId: 'u3', pseudo: 'zoe', displayName: 'Zoé' };

describe('toHostCountsDto (Story 50.2)', () => {
  it('chaque membre actuel figure, à 0 s’il n’a jamais reçu', () => {
    const dto = toHostCountsDto([LEA, TOM], [{ hostId: 'u1', count: 2 }]);

    expect(dto.members).toEqual([
      { ...LEA, count: 2 },
      { ...TOM, count: 0 },
    ]);
  });

  it('un hôte qui n’est plus membre est absent : ses événements ne sont attribués à personne', () => {
    const dto = toHostCountsDto([LEA], [{ hostId: 'ancien', count: 5 }]);

    expect(dto.members).toEqual([{ ...LEA, count: 0 }]);
  });

  it('du plus grand compte au plus petit, puis nom affiché (accents et casse ignorés), pseudo, identifiant', () => {
    const twinB = { userId: 'u9', pseudo: 'zoe-b', displayName: 'ZOE' };
    const twinA = { userId: 'u8', pseudo: 'zoe-a', displayName: 'Zoé' };
    const dto = toHostCountsDto(
      [TOM, twinB, LEA, twinA, ZOE],
      [
        { hostId: 'u1', count: 1 },
        { hostId: 'u2', count: 3 },
        { hostId: 'u3', count: 1 },
        { hostId: 'u8', count: 1 },
        { hostId: 'u9', count: 1 },
      ],
    );

    // Tom (3), puis les quatre à 1 : « Léa » avant « Zoé » ; les trois « Zoé » départagés par pseudo (zoe, zoe-a, zoe-b).
    expect(dto.members.map((m) => m.userId)).toEqual(['u2', 'u1', 'u3', 'u8', 'u9']);
  });

  it('projette champ par champ : jamais l’e-mail', () => {
    const dto = toHostCountsDto([{ ...LEA, email: 'lea@test.local' } as typeof LEA], []);

    expect(JSON.stringify(dto)).not.toContain('lea@test.local');
    expect(Object.keys(dto.members[0]).sort()).toEqual([
      'count',
      'displayName',
      'pseudo',
      'userId',
    ]);
  });
});

describe('EventHostCountsService (Story 50.2)', () => {
  let permissions: { assert: jest.Mock };
  let events: { pastHostedCounts: jest.Mock };
  let prisma: { membership: { findMany: jest.Mock } };
  let service: EventHostCountsService;

  const group = { id: 'p1', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };

  beforeEach(() => {
    permissions = { assert: jest.fn().mockResolvedValue(testGrant(group, 'member')) };
    events = { pastHostedCounts: jest.fn().mockResolvedValue([{ hostId: 'u1', count: 2 }]) };
    prisma = {
      membership: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { user: { id: 'u1', pseudo: 'lea', displayName: 'Léa', email: 'lea@test.local' } },
            { user: { id: 'u2', pseudo: 'tom', displayName: 'Tom', email: 'tom@test.local' } },
          ]),
      },
    };
    service = new EventHostCountsService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      prisma as unknown as PrismaService,
    );
  });

  it('décide le droit AVANT de lire, puis lit les membres et les comptes du groupe', async () => {
    const dto = await service.list('p1', 'u2');

    expect(permissions.assert).toHaveBeenCalledWith('u2', 'PARTIE_READ', { partieId: 'p1' });
    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: { partieId: 'p1' },
      select: { user: { select: { id: true, pseudo: true, displayName: true } } },
    });
    expect(events.pastHostedCounts).toHaveBeenCalledWith('p1');
    expect(dto.members.map((m) => [m.userId, m.count])).toEqual([
      ['u1', 2],
      ['u2', 0],
    ]);
    expect(JSON.stringify(dto)).not.toContain('@test.local');
  });

  it('droit refusé : refus propagé, rien n’est lu', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException('refus'));

    await expect(service.list('p1', 'u9')).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(events.pastHostedCounts).not.toHaveBeenCalled();
  });

  it.each([
    ['une rencontre isolée', { id: 'p2', kind: 'ONE_SHOT', gameSystemId: 'ralliement' }],
    ['une partie de JDR', { id: 'p3', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ryuutama' }],
  ])('%s : 403 RALLIEMENT_UNAVAILABLE_MESSAGE, rien n’est lu', async (_label, partie) => {
    permissions.assert.mockResolvedValue(testGrant(partie, 'member'));

    const err = await service.list(partie.id, 'u1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(events.pastHostedCounts).not.toHaveBeenCalled();
  });
});
