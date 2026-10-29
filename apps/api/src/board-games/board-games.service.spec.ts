import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { callArg } from '../common/test-utils/jest-typed';
import {
  BOARD_GAMES_MAX_PER_OWNER,
  BoardGamesService,
  toBoardGameDto,
} from './board-games.service';

const CREATED_AT = new Date('2026-10-29T10:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    ownerId: 'u1',
    name: 'Azul',
    nameKey: 'azul',
    minPlayers: 2,
    maxPlayers: 4,
    durationMin: 40,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    boardGame: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    membership: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  // Transaction interactive simulée : la fonction reçoit le même client.
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
}

describe('BoardGamesService (Story 48.1)', () => {
  let service: BoardGamesService;
  let prisma: ReturnType<typeof makePrisma>;
  let realtime: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    realtime = { emit: jest.fn() };
    prisma.boardGame.count.mockResolvedValue(0);
    prisma.membership.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        BoardGamesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeEventsService, useValue: realtime },
      ],
    }).compile();
    service = module.get(BoardGamesService);
  });

  describe('toBoardGameDto', () => {
    it('projette champ par champ, sans le propriétaire, date en ISO', () => {
      expect(toBoardGameDto(row())).toEqual({
        id: 'g1',
        name: 'Azul',
        nameKey: 'azul',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 40,
        createdAt: '2026-10-29T10:00:00.000Z',
      });
    });
  });

  describe('listMine', () => {
    it('lit mes seuls jeux, triés par clé normalisée puis par nom', async () => {
      prisma.boardGame.findMany.mockResolvedValue([row()]);

      const result = await service.listMine('u1');

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
      });
      expect(result).toEqual([toBoardGameDto(row())]);
    });
  });

  describe('create', () => {
    it('écrit le nom rogné et sa clé calculée par la fonction partagée', async () => {
      prisma.boardGame.create.mockResolvedValue(row({ name: 'Éclipse', nameKey: 'eclipse' }));

      const dto = await service.create('u1', {
        name: '  Éclipse ',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 40,
      });

      expect(prisma.boardGame.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'u1',
          name: 'Éclipse',
          nameKey: 'eclipse',
          minPlayers: 2,
          maxPlayers: 4,
          durationMin: 40,
        },
      });
      expect(dto.nameKey).toBe('eclipse');
    });

    it('nom seul : les nombres sont écrits à `null`', async () => {
      prisma.boardGame.create.mockResolvedValue(
        row({
          name: 'Skull',
          nameKey: 'skull',
          minPlayers: null,
          maxPlayers: null,
          durationMin: null,
        }),
      );

      await service.create('u1', { name: 'Skull' });

      expect(
        callArg<{ data: Record<string, unknown> }>(prisma.boardGame.create).data,
      ).toMatchObject({
        minPlayers: null,
        maxPlayers: null,
        durationMin: null,
      });
    });

    it('max < min → 400 en français, rien n’est écrit ni émis', async () => {
      await expect(
        service.create('u1', { name: 'Azul', minPlayers: 3, maxPlayers: 2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.boardGame.create).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('min = max → accepté', async () => {
      prisma.boardGame.create.mockResolvedValue(row({ minPlayers: 2, maxPlayers: 2 }));
      await expect(
        service.create('u1', { name: 'Azul', minPlayers: 2, maxPlayers: 2 }),
      ).resolves.toBeDefined();
    });

    it(`${BOARD_GAMES_MAX_PER_OWNER} jeux déjà présents → 400 (le 501ᵉ est refusé)`, async () => {
      prisma.boardGame.count.mockResolvedValue(BOARD_GAMES_MAX_PER_OWNER);

      const err = await service.create('u1', { name: 'Azul' }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toMatch(/au plus 500 jeux/);
      expect(prisma.boardGame.count).toHaveBeenCalledWith({ where: { ownerId: 'u1' } });
      // Le décompte suit le verrou de la ligne du propriétaire (course entre deux ajouts).
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.boardGame.count.mock.invocationCallOrder[0],
      );
      expect(callArg<string[]>(prisma.$queryRaw).join('?')).toContain('FOR UPDATE');
      expect(prisma.boardGame.create).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('499 jeux → le 500ᵉ passe', async () => {
      prisma.boardGame.count.mockResolvedValue(BOARD_GAMES_MAX_PER_OWNER - 1);
      prisma.boardGame.create.mockResolvedValue(row());
      await expect(service.create('u1', { name: 'Azul' })).resolves.toBeDefined();
    });

    it('même clé déjà présente (P2002) → 409, rien n’est émis', async () => {
      prisma.boardGame.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create('u1', { name: '  ÀZUL ' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('nom réduit à rien par la normalisation (accent combinant seul) → 400, rien n’est écrit ni émis', async () => {
      const name = String.fromCharCode(0x0301);

      await expect(service.create('u1', { name })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.boardGame.create).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une autre erreur Prisma remonte telle quelle', async () => {
      const boom = { code: 'P2003' };
      prisma.boardGame.create.mockRejectedValue(boom);

      await expect(service.create('u1', { name: 'Azul' })).rejects.toBe(boom);
    });
  });

  describe('émission temps réel', () => {
    it('après l’écriture : `user:{propriétaire}` et `partie:{id}` de chaque partie ralliement dont il est membre', async () => {
      prisma.boardGame.create.mockResolvedValue(row());
      prisma.membership.findMany.mockResolvedValue([
        { partieId: 'groupe' },
        { partieId: 'soiree' },
      ]);

      await service.create('u1', { name: 'Azul' });

      const query = callArg<{ where: unknown }>(prisma.membership.findMany);
      expect(query.where).toEqual({
        userId: 'u1',
        partie: { gameSystemId: { in: ['ralliement'] } },
      });
      expect(realtime.emit.mock.calls).toEqual([
        [userTopic('u1')],
        [partieTopic('groupe')],
        [partieTopic('soiree')],
      ]);
    });

    it('jamais une partie de JDR : le filtre ne retient que la famille ralliement', async () => {
      prisma.boardGame.create.mockResolvedValue(row());

      await service.create('u1', { name: 'Azul' });

      const query = callArg<{ where: { partie: { gameSystemId: { in: string[] } } } }>(
        prisma.membership.findMany,
      );
      expect(query.where.partie.gameSystemId.in).not.toContain('ryuutama');
    });

    it('une émission en échec est consignée, la création reste un succès', async () => {
      prisma.boardGame.create.mockResolvedValue(row());
      prisma.membership.findMany.mockRejectedValue(new Error('panne'));
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        await expect(service.create('u1', { name: 'Azul' })).resolves.toEqual(
          toBoardGameDto(row()),
        );
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
