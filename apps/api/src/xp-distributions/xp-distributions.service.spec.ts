import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// `CharacterService` (importé ci-dessous comme token DI) importe `@master-jdr/game-rules`
// (module ESM) — le mocker évite l'échec de transform Jest, même pattern que
// `character.service.spec.ts`.
jest.mock('@master-jdr/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  levelForXp: jest.fn(),
  pendingLevels: jest.fn(),
}));

import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { CharacterService } from '../characters/character.service';
import { XpDistributionsService } from './xp-distributions.service';
import { objectLike } from '../common/test-utils/jest-typed';
import { testGrant } from '../common/test-utils/grant';

function makePrisma() {
  return {
    character: { findMany: jest.fn() },
    xpDistribution: { create: jest.fn(), findMany: jest.fn() },
  };
}

function makePermissions() {
  return { assert: jest.fn() };
}

function makeCharacters() {
  return { applyXpDelta: jest.fn().mockResolvedValue(undefined) };
}

describe('XpDistributionsService', () => {
  let service: XpDistributionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let permissions: ReturnType<typeof makePermissions>;
  let characters: ReturnType<typeof makeCharacters>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    permissions = makePermissions();
    characters = makeCharacters();
    const module = await Test.createTestingModule({
      providers: [
        XpDistributionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: CharacterService, useValue: characters },
      ],
    }).compile();
    service = module.get(XpDistributionsService);
  });

  describe('createDistribution()', () => {
    it('non-MJ → 403 (permissions.assert rejette), aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(
        service.createDistribution('p1', 'stranger', {
          entries: [{ characterId: 'c1', amount: 100 }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(permissions.assert).toHaveBeenCalledWith('stranger', 'XP_DISTRIBUTION_CREATE', {
        partieId: 'p1',
      });
      expect(prisma.xpDistribution.create).not.toHaveBeenCalled();
    });

    it("characterId n'appartenant pas à la Partie → 400, aucune écriture, applyXpDelta jamais appelé", async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.character.findMany.mockResolvedValue([
        { id: 'c1', partieId: 'p1' },
        { id: 'c2', partieId: 'AUTRE_PARTIE' },
      ]);

      await expect(
        service.createDistribution('p1', 'mj1', {
          entries: [
            { characterId: 'c1', amount: 100 },
            { characterId: 'c2', amount: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.xpDistribution.create).not.toHaveBeenCalled();
      expect(characters.applyXpDelta).toHaveBeenCalledTimes(0);
    });

    it('succès → crée la distribution et appelle applyXpDelta une fois par entrée', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.character.findMany.mockResolvedValue([
        { id: 'c1', partieId: 'p1' },
        { id: 'c2', partieId: 'p1' },
      ]);
      prisma.xpDistribution.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        note: 'Bien joué',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        entries: [
          {
            characterId: 'c1',
            amount: 250,
            isBonus: false,
            character: {
              user: { pseudo: 'alice', displayName: 'Alice au pays' },
            },
          },
          {
            characterId: 'c2',
            amount: 50,
            isBonus: true,
            character: { user: { pseudo: 'bob', displayName: 'Bobby' } },
          },
        ],
      });

      const result = await service.createDistribution('p1', 'mj1', {
        entries: [
          { characterId: 'c1', amount: 250 },
          { characterId: 'c2', amount: 50, isBonus: true },
        ],
        note: 'Bien joué',
      });

      expect(prisma.xpDistribution.create).toHaveBeenCalledWith(
        objectLike({
          data: objectLike({
            partieId: 'p1',
            mjId: 'mj1',
            note: 'Bien joué',
          }),
          include: {
            entries: {
              include: {
                character: {
                  include: {
                    user: { select: { pseudo: true, displayName: true } },
                  },
                },
              },
            },
          },
        }),
      );
      expect(characters.applyXpDelta).toHaveBeenCalledWith('c1', 250);
      expect(characters.applyXpDelta).toHaveBeenCalledWith('c2', 50);
      expect(characters.applyXpDelta).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('d1');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toMatchObject({
        characterId: 'c1',
        ownerPseudo: 'alice',
        ownerDisplayName: 'Alice au pays',
      });
      expect(result.entries[1]).toMatchObject({
        characterId: 'c2',
        ownerPseudo: 'bob',
        ownerDisplayName: 'Bobby',
      });
    });

    it('montant + bonus du même personnage agrégés en un seul appel applyXpDelta (évite un double e-mail level-up)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.character.findMany.mockResolvedValue([{ id: 'c1', partieId: 'p1' }]);
      prisma.xpDistribution.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        note: undefined,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        entries: [
          {
            characterId: 'c1',
            amount: 250,
            isBonus: false,
            character: {
              user: { pseudo: 'alice', displayName: 'Alice au pays' },
            },
          },
          {
            characterId: 'c1',
            amount: 50,
            isBonus: true,
            character: {
              user: { pseudo: 'alice', displayName: 'Alice au pays' },
            },
          },
        ],
      });

      await service.createDistribution('p1', 'mj1', {
        entries: [
          { characterId: 'c1', amount: 250 },
          { characterId: 'c1', amount: 50, isBonus: true },
        ],
      });

      expect(characters.applyXpDelta).toHaveBeenCalledTimes(1);
      expect(characters.applyXpDelta).toHaveBeenCalledWith('c1', 300);
    });

    it('un échec isolé de applyXpDelta est loggé et n’interrompt pas les increments restants', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.character.findMany.mockResolvedValue([
        { id: 'c1', partieId: 'p1' },
        { id: 'c2', partieId: 'p1' },
      ]);
      prisma.xpDistribution.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        note: undefined,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        entries: [
          {
            characterId: 'c1',
            amount: 100,
            isBonus: false,
            character: {
              user: { pseudo: 'alice', displayName: 'Alice au pays' },
            },
          },
          {
            characterId: 'c2',
            amount: 100,
            isBonus: false,
            character: { user: { pseudo: 'bob', displayName: 'Bobby' } },
          },
        ],
      });
      characters.applyXpDelta.mockRejectedValueOnce(new Error('personnage supprimé'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await service.createDistribution('p1', 'mj1', {
        entries: [
          { characterId: 'c1', amount: 100 },
          { characterId: 'c2', amount: 100 },
        ],
      });

      expect(characters.applyXpDelta).toHaveBeenCalledTimes(2);
      expect(loggerSpy).toHaveBeenCalled();
      expect(result.id).toBe('d1'); // la distribution reste créée malgré l'échec partiel

      loggerSpy.mockRestore();
    });
  });

  describe('listForPartie()', () => {
    it('non-MJ → 403', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());
      await expect(service.listForPartie('p1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(permissions.assert).toHaveBeenCalledWith('stranger', 'XP_DISTRIBUTION_READ', {
        partieId: 'p1',
      });
    });

    it('trie par createdAt desc avec tie-breaker id (déterministe, Story 17.1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.xpDistribution.findMany.mockResolvedValue([]);

      await service.listForPartie('p1', 'mj1');

      expect(prisma.xpDistribution.findMany).toHaveBeenCalledWith(
        objectLike({
          where: { partieId: 'p1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            entries: {
              include: {
                character: {
                  include: {
                    user: { select: { pseudo: true, displayName: true } },
                  },
                },
              },
            },
          },
        }),
      );
    });

    it('résout ownerPseudo/ownerDisplayName de chaque entrée depuis Character.userId → User', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.xpDistribution.findMany.mockResolvedValue([
        {
          id: 'd1',
          partieId: 'p1',
          note: undefined,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          entries: [
            {
              characterId: 'c1',
              amount: 100,
              isBonus: false,
              character: {
                user: { pseudo: 'alice', displayName: 'Alice au pays' },
              },
            },
          ],
        },
      ]);

      const result = await service.listForPartie('p1', 'mj1');

      expect(result[0].entries[0]).toMatchObject({
        ownerPseudo: 'alice',
        ownerDisplayName: 'Alice au pays',
      });
    });

    it('skip/take fournis → transmis tels quels à Prisma (AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.xpDistribution.findMany.mockResolvedValue([]);

      await service.listForPartie('p1', 'mj1', { skip: 20, take: 10 });

      expect(prisma.xpDistribution.findMany).toHaveBeenCalledWith(
        objectLike({ skip: 20, take: 10 }),
      );
    });

    it('skip/take absents → aucune limite appliquée (comportement par défaut inchangé)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.xpDistribution.findMany.mockResolvedValue([]);

      await service.listForPartie('p1', 'mj1');

      expect(prisma.xpDistribution.findMany).toHaveBeenCalledWith(
        objectLike({ skip: undefined, take: undefined }),
      );
    });
  });
});
