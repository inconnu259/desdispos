import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { callArg } from '../common/test-utils/jest-typed';
import {
  BOARD_GAMES_MAX_PER_OWNER,
  BOARD_GAME_NOT_FOUND,
  BoardGamesService,
  toBoardGameDto,
  toGroupBoardGamesDto,
  toUserLibraryDto,
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
    boardGame: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    membership: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
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
  let permissions: { assertLibraryRead: jest.Mock; assert: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    realtime = { emit: jest.fn() };
    permissions = { assertLibraryRead: jest.fn().mockResolvedValue(undefined), assert: jest.fn() };
    prisma.boardGame.count.mockResolvedValue(0);
    prisma.membership.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        BoardGamesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeEventsService, useValue: realtime },
        { provide: PermissionService, useValue: permissions },
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

  describe('listOfOwner (Story 49.1)', () => {
    it('lit les jeux de la personne demandée dans le même ordre que listMine, sans décider de droit', async () => {
      prisma.boardGame.findMany.mockResolvedValue([row({ ownerId: 'host' })]);

      const result = await service.listOfOwner('host');

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'host' },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
      });
      expect(result).toEqual([toBoardGameDto(row({ ownerId: 'host' }))]);
      expect(permissions.assertLibraryRead).not.toHaveBeenCalled();
    });
  });

  describe('listByIds (Story 49.2)', () => {
    it('lit les jeux désignés, triés comme listMine, sans décider de droit', async () => {
      prisma.boardGame.findMany.mockResolvedValue([row({ id: 'g2' })]);

      const result = await service.listByIds(['g2', 'g3']);

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['g2', 'g3'] } },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual([toBoardGameDto(row({ id: 'g2' }))]);
      expect(permissions.assertLibraryRead).not.toHaveBeenCalled();
    });

    it('aucun identifiant : liste vide, aucune lecture', async () => {
      await expect(service.listByIds([])).resolves.toEqual([]);
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ownedGameIds (Story 49.2)', () => {
    it('ne retient que les jeux du propriétaire demandé', async () => {
      prisma.boardGame.findMany.mockResolvedValue([{ id: 'g1' }]);

      const owned = await service.ownedGameIds('u1', ['g1', 'g9']);

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1', id: { in: ['g1', 'g9'] } },
        select: { id: true },
      });
      expect([...owned]).toEqual(['g1']);
    });

    it('lit sur le client fourni (transaction) quand il y en a un', async () => {
      const tx = { boardGame: { findMany: jest.fn().mockResolvedValue([{ id: 'g1' }]) } };

      const owned = await service.ownedGameIds('u1', ['g1'], tx as never);

      expect(tx.boardGame.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
      expect(owned.has('g1')).toBe(true);
    });

    it('aucun identifiant : ensemble vide, aucune lecture', async () => {
      expect((await service.ownedGameIds('u1', [])).size).toBe(0);
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });
  });

  describe('nameKeysOfOwner (Story 49.5)', () => {
    it('lit l’identifiant et la clé de mes seuls jeux, sans autre colonne', async () => {
      prisma.boardGame.findMany.mockResolvedValue([{ id: 'g1', nameKey: 'azul' }]);

      const keys = await service.nameKeysOfOwner('u1');

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
        select: { id: true, nameKey: true },
      });
      expect(keys).toEqual([{ id: 'g1', nameKey: 'azul' }]);
    });

    it('lit sur le client fourni (transaction) quand il y en a un', async () => {
      const tx = { boardGame: { findMany: jest.fn().mockResolvedValue([]) } };

      await service.nameKeysOfOwner('u1', tx as never);

      expect(tx.boardGame.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });
  });

  describe('nameKeysByIds (Story 49.5)', () => {
    it('rend les clés des jeux demandés, sans doublon', async () => {
      prisma.boardGame.findMany.mockResolvedValue([{ nameKey: 'azul' }, { nameKey: 'azul' }]);

      const keys = await service.nameKeysByIds(['g1', 'g2']);

      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['g1', 'g2'] } },
        select: { nameKey: true },
      });
      expect(keys).toEqual(['azul']);
    });

    it('lit sur le client fourni (transaction) quand il y en a un', async () => {
      const tx = { boardGame: { findMany: jest.fn().mockResolvedValue([{ nameKey: 'go' }]) } };

      await expect(service.nameKeysByIds(['g1'], tx as never)).resolves.toEqual(['go']);

      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });

    it('aucun identifiant : liste vide, aucune lecture', async () => {
      await expect(service.nameKeysByIds([])).resolves.toEqual([]);
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
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

  describe('toUserLibraryDto / listOf (Story 48.3)', () => {
    const OWNER = { id: 'u2', pseudo: 'zoe', displayName: 'Zoé', email: 'zoe@test.local' };

    it('projette champ par champ : jamais l’e-mail ni le hash du propriétaire', () => {
      const dto = toUserLibraryDto(OWNER, [row()]);

      expect(dto).toEqual({
        owner: { userId: 'u2', pseudo: 'zoe', displayName: 'Zoé' },
        games: [toBoardGameDto(row())],
      });
      expect(JSON.stringify(dto)).not.toContain('zoe@test.local');
      expect(Object.keys(dto.owner).sort()).toEqual(['displayName', 'pseudo', 'userId']);
    });

    it('décide le droit AVANT de lire, puis lit les jeux de la personne dans l’ordre de listMine', async () => {
      prisma.user.findUnique.mockResolvedValue(OWNER);
      prisma.boardGame.findMany.mockResolvedValue([row({ ownerId: 'u2' })]);

      const result = await service.listOf('u1', 'u2');

      expect(permissions.assertLibraryRead).toHaveBeenCalledWith('u1', 'u2');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u2' },
        select: { id: true, pseudo: true, displayName: true },
      });
      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u2' },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
      });
      expect(result.games).toHaveLength(1);
    });

    it('droit refusé : 404 propagé, aucune lecture de jeux ni de compte', async () => {
      permissions.assertLibraryRead.mockRejectedValue(
        new NotFoundException('Ludothèque introuvable'),
      );

      await expect(service.listOf('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });

    it('compte introuvable malgré le droit : le même 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.boardGame.findMany.mockResolvedValue([]);

      const err = await service.listOf('u1', 'u2').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe('Ludothèque introuvable');
    });

    it('Ludothèque vide : 200 avec une liste vide', async () => {
      prisma.user.findUnique.mockResolvedValue(OWNER);
      prisma.boardGame.findMany.mockResolvedValue([]);

      expect((await service.listOf('u1', 'u2')).games).toEqual([]);
    });
  });

  describe('toGroupBoardGamesDto / listOfGroup (Story 50.1)', () => {
    const ZOE = { id: 'u2', pseudo: 'zoe', displayName: 'Zoé', email: 'zoe@test.local' };
    const LEA = { id: 'u1', pseudo: 'lea', displayName: 'Léa', email: 'lea@test.local' };
    const GROUP = { kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };

    function groupRow(owner: typeof ZOE, overrides: Record<string, unknown> = {}) {
      return { ...row({ ownerId: owner.id, ...overrides }), owner };
    }

    it('regroupe les copies d’un même nom normalisé : une entrée, tous les propriétaires', () => {
      const dto = toGroupBoardGamesDto([
        groupRow(ZOE, { id: 'g2', name: 'azul' }),
        groupRow(LEA, { id: 'g1', name: 'Azul' }),
      ]);

      expect(dto.games).toHaveLength(1);
      expect(dto.games[0].nameKey).toBe('azul');
      expect(dto.games[0].owners.map((o) => o.userId)).toEqual(['u1', 'u2']);
    });

    it('propriétaires triés par nom affiché, pseudo puis identifiant ; nom et mesures de la copie du premier', () => {
      const dto = toGroupBoardGamesDto([
        groupRow(ZOE, { name: 'AZUL', minPlayers: 1, maxPlayers: 9, durationMin: null }),
        groupRow(LEA, { name: 'Azul', minPlayers: 2, maxPlayers: 4, durationMin: 40 }),
      ]);

      expect(dto.games[0]).toMatchObject({
        name: 'Azul',
        minPlayers: 2,
        maxPlayers: 4,
        durationMin: 40,
      });
    });

    it('homonymes (même nom affiché, accents et casse ignorés) : le pseudo départage, puis l’identifiant — dans les deux ordres d’entrée', () => {
      const ZOE_A = { id: 'u5', pseudo: 'zoe-a', displayName: 'Zoé', email: 'a@test.local' };
      const ZOE_B = { id: 'u4', pseudo: 'zoe-b', displayName: 'ZOE', email: 'b@test.local' };
      const a = groupRow(ZOE_A, { name: 'Azul A', minPlayers: 2, maxPlayers: 4 });
      const b = groupRow(ZOE_B, { name: 'Azul B', minPlayers: 1, maxPlayers: 9 });

      for (const rows of [
        [a, b],
        [b, a],
      ]) {
        const entry = toGroupBoardGamesDto(rows).games[0];
        expect(entry.owners.map((o) => o.userId)).toEqual(['u5', 'u4']);
        expect(entry.name).toBe('Azul A');
        expect([entry.minPlayers, entry.maxPlayers]).toEqual([2, 4]);
      }

      // Même nom affiché et même pseudo : l'identifiant tranche, quel que soit l'ordre reçu.
      const twinA = groupRow({ ...ZOE_A, id: 'u1' }, { name: 'Azul 1' });
      const twinB = groupRow({ ...ZOE_A, id: 'u2' }, { name: 'Azul 2' });
      for (const rows of [
        [twinA, twinB],
        [twinB, twinA],
      ]) {
        expect(toGroupBoardGamesDto(rows).games[0].owners.map((o) => o.userId)).toEqual([
          'u1',
          'u2',
        ]);
      }
    });

    it('garde l’ordre des lignes reçues (déjà triées par clé) pour les entrées', () => {
      const dto = toGroupBoardGamesDto([
        groupRow(LEA, { nameKey: 'azul', name: 'Azul' }),
        groupRow(LEA, { nameKey: 'skull', name: 'Skull' }),
      ]);

      expect(dto.games.map((g) => g.nameKey)).toEqual(['azul', 'skull']);
    });

    it('projette champ par champ : jamais l’e-mail ni l’identifiant d’un jeu', () => {
      const dto = toGroupBoardGamesDto([groupRow(LEA)]);

      expect(JSON.stringify(dto)).not.toContain('lea@test.local');
      expect(Object.keys(dto.games[0]).sort()).toEqual([
        'durationMin',
        'maxPlayers',
        'minPlayers',
        'name',
        'nameKey',
        'owners',
      ]);
      expect(Object.keys(dto.games[0].owners[0]).sort()).toEqual([
        'displayName',
        'pseudo',
        'userId',
      ]);
    });

    it('décide le droit AVANT de lire, puis lit les jeux des seuls membres actuels du groupe', async () => {
      permissions.assert.mockResolvedValue({ partie: GROUP });
      prisma.boardGame.findMany.mockResolvedValue([groupRow(LEA)]);

      const result = await service.listOfGroup('u1', 'p1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'PARTIE_READ', { partieId: 'p1' });
      expect(prisma.boardGame.findMany).toHaveBeenCalledWith({
        where: { owner: { memberships: { some: { partieId: 'p1' } } } },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
        include: { owner: { select: { id: true, pseudo: true, displayName: true } } },
      });
      expect(result.games).toHaveLength(1);
    });

    it('droit refusé : refus propagé, aucune lecture de jeux', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('refus'));

      await expect(service.listOfGroup('u9', 'p1')).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
    });

    it.each([
      ['une rencontre isolée', { kind: 'ONE_SHOT', gameSystemId: 'ralliement' }],
      ['une partie de JDR', { kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ryuutama' }],
    ])(
      '%s : 403 RALLIEMENT_UNAVAILABLE_MESSAGE, aucune lecture de jeux',
      async (_label, partie) => {
        permissions.assert.mockResolvedValue({ partie });

        const err = await service.listOfGroup('u1', 'p1').catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as ForbiddenException).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
        expect(prisma.boardGame.findMany).not.toHaveBeenCalled();
      },
    );

    it('groupe sans jeu : une liste vide', async () => {
      permissions.assert.mockResolvedValue({ partie: GROUP });
      prisma.boardGame.findMany.mockResolvedValue([]);

      await expect(service.listOfGroup('u1', 'p1')).resolves.toEqual({ games: [] });
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
  describe('update (Story 48.2)', () => {
    it('renomme : nom rogné, clé recalculée, nombres inchangés (champs absents non écrits)', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row());
      prisma.boardGame.update.mockResolvedValue(
        row({ name: 'Azul Summer', nameKey: 'azul summer' }),
      );

      const dto = await service.update('u1', 'g1', { name: ' Azul Summer ' });

      expect(prisma.boardGame.findFirst).toHaveBeenCalledWith({
        where: { id: 'g1', ownerId: 'u1' },
      });
      expect(prisma.boardGame.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { name: 'Azul Summer', nameKey: 'azul summer' },
      });
      expect(dto).toMatchObject({ name: 'Azul Summer', nameKey: 'azul summer', minPlayers: 2 });
    });

    it('verrouille la ligne du jeu (filtrée sur le propriétaire) avant de la lire', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row());
      prisma.boardGame.update.mockResolvedValue(row());

      await service.update('u1', 'g1', { durationMin: 30 });

      const sql = callArg<string[]>(prisma.$queryRaw).join('?');
      expect(sql).toContain('"BoardGame"');
      expect(sql).toContain('"ownerId"');
      expect(sql).toContain('FOR UPDATE');
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.boardGame.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('`null` efface un nombre ; une valeur absente n’est pas écrite', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row());
      prisma.boardGame.update.mockResolvedValue(row({ durationMin: null }));

      const dto = await service.update('u1', 'g1', { durationMin: null });

      expect(callArg<{ data: unknown }>(prisma.boardGame.update).data).toEqual({
        durationMin: null,
      });
      expect(dto.durationMin).toBeNull();
    });

    it('bornes fusionnées : `{min:3,max:5}` puis `{maxPlayers:2}` → 400 en français, rien n’est écrit ni émis', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row({ minPlayers: 3, maxPlayers: 5 }));

      const err = await service.update('u1', 'g1', { maxPlayers: 2 }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toMatch(/maximum de joueurs/);
      expect(prisma.boardGame.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('bornes fusionnées : effacer le min rend tout max acceptable', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row({ minPlayers: 3, maxPlayers: 5 }));
      prisma.boardGame.update.mockResolvedValue(row({ minPlayers: null, maxPlayers: 2 }));

      await expect(
        service.update('u1', 'g1', { minPlayers: null, maxPlayers: 2 }),
      ).resolves.toBeDefined();
    });

    it('jeu d’autrui ou inconnu → 404, même message, rien n’est écrit ni émis', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(null);

      const err = await service.update('u1', 'g-autre', { name: 'Azul' }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(BOARD_GAME_NOT_FOUND);
      expect(prisma.boardGame.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('même clé qu’un autre de mes jeux (P2002) → 409, rien n’est émis', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(
        row({ id: 'g2', name: 'Skull', nameKey: 'skull' }),
      );
      prisma.boardGame.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.update('u1', 'g2', { name: 'azul' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('nom réduit à rien par la normalisation → 400, rien n’est lu, écrit ni émis', async () => {
      await expect(
        service.update('u1', 'g1', { name: String.fromCharCode(0x0301) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('succès : émet comme la création, après l’écriture', async () => {
      prisma.boardGame.findFirst.mockResolvedValue(row());
      prisma.boardGame.update.mockResolvedValue(row());
      prisma.membership.findMany.mockResolvedValue([{ partieId: 'groupe' }]);

      await service.update('u1', 'g1', { name: 'Azul' });

      expect(realtime.emit.mock.calls).toEqual([[userTopic('u1')], [partieTopic('groupe')]]);
      expect(prisma.boardGame.update.mock.invocationCallOrder[0]).toBeLessThan(
        realtime.emit.mock.invocationCallOrder[0],
      );
    });
  });

  describe('remove (Story 48.2)', () => {
    it('supprime filtré sur le propriétaire, puis émet', async () => {
      prisma.boardGame.deleteMany.mockResolvedValue({ count: 1 });
      prisma.membership.findMany.mockResolvedValue([{ partieId: 'groupe' }]);

      await expect(service.remove('u1', 'g1')).resolves.toBeUndefined();

      expect(prisma.boardGame.deleteMany).toHaveBeenCalledWith({
        where: { id: 'g1', ownerId: 'u1' },
      });
      expect(realtime.emit.mock.calls).toEqual([[userTopic('u1')], [partieTopic('groupe')]]);
    });

    it('jeu d’autrui ou inconnu (rien supprimé) → 404, même message, rien n’est émis', async () => {
      prisma.boardGame.deleteMany.mockResolvedValue({ count: 0 });

      const err = await service.remove('u1', 'g-autre').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(BOARD_GAME_NOT_FOUND);
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une émission en échec est consignée, la suppression reste un succès', async () => {
      prisma.boardGame.deleteMany.mockResolvedValue({ count: 1 });
      prisma.membership.findMany.mockRejectedValue(new Error('panne'));
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        await expect(service.remove('u1', 'g1')).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
