import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { GameSystemService } from '../game-systems/game-system.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { CharacterRolesService } from './character-roles.service';

function makePrisma() {
  return {
    character: { findUnique: jest.fn() },
    characterGroupRole: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

/** Story 37.7 : les droits sont décidés par `PermissionService.assert()`, simulé ici. */
function makePermissions() {
  return {
    assert: jest
      .fn()
      .mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' })),
  };
}

function makeGameSystems() {
  return {
    getContent: jest.fn().mockResolvedValue({
      groupRole: [
        { key: 'cartographe', data: {} },
        { key: 'chef', data: {} },
        { key: 'chroniqueur', data: {} },
        { key: 'intendant', data: {} },
      ],
    }),
  };
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

function makeRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role1',
    characterId: 'char1',
    partieId: 'p1',
    roleKey: 'cartographe',
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CharacterRolesService', () => {
  let service: CharacterRolesService;
  let prisma: ReturnType<typeof makePrisma>;
  let permissions: ReturnType<typeof makePermissions>;
  let gameSystems: ReturnType<typeof makeGameSystems>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    permissions = makePermissions();
    gameSystems = makeGameSystems();
    realtimeEvents = makeRealtimeEvents();
    const module = await Test.createTestingModule({
      providers: [
        CharacterRolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: GameSystemService, useValue: gameSystems },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
      ],
    }).compile();
    service = module.get(CharacterRolesService);
  });

  describe('assign()', () => {
    it('MJ + roleKey valide + characterId de la Partie → create appelé, DTO retourné, emit appelé', async () => {
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });
      prisma.characterGroupRole.create.mockResolvedValue(makeRole());

      const result = await service.assign('p1', 'mj1', 'char1', 'cartographe');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'GROUP_ROLE_ASSIGN', {
        partieId: 'p1',
      });
      expect(prisma.characterGroupRole.create).toHaveBeenCalledWith({
        data: { characterId: 'char1', partieId: 'p1', roleKey: 'cartographe' },
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(result).toEqual({
        id: 'role1',
        characterId: 'char1',
        partieId: 'p1',
        roleKey: 'cartographe',
        assignedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('non-MJ → permissions.assert rejette, propagation, aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new Error('forbidden'));

      await expect(service.assign('p1', 'stranger', 'char1', 'cartographe')).rejects.toThrow(
        'forbidden',
      );
      expect(prisma.characterGroupRole.create).not.toHaveBeenCalled();
    });

    it('roleKey inconnu du catalogue groupRole → BadRequestException, aucune écriture', async () => {
      await expect(service.assign('p1', 'mj1', 'char1', 'roleKey-inexistant')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.characterGroupRole.create).not.toHaveBeenCalled();
    });

    it("characterId n'appartenant pas à partieId → BadRequestException, aucune écriture", async () => {
      prisma.character.findUnique.mockResolvedValue({
        partieId: 'autre-partie',
      });

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.characterGroupRole.create).not.toHaveBeenCalled();
    });

    it('characterId introuvable → BadRequestException, aucune écriture', async () => {
      prisma.character.findUnique.mockResolvedValue(null);

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.characterGroupRole.create).not.toHaveBeenCalled();
    });

    it('roleKey déjà tenu par un autre personnage (P2002) → ConflictException', async () => {
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });
      prisma.characterGroupRole.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow(
        ConflictException,
      );
    });

    it('characterId portant déjà un rôle différent (P2002, 2e contrainte) → ConflictException (même chemin de gestion)', async () => {
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });
      prisma.characterGroupRole.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.assign('p1', 'mj1', 'char1', 'chef')).rejects.toThrow(ConflictException);
    });

    it('erreur Prisma non-P2002 → propagée telle quelle', async () => {
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });
      const dbError = new Error('DB down');
      prisma.characterGroupRole.create.mockRejectedValue(dbError);

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow('DB down');
    });

    it('personnage supprimé entre la vérification et le create (P2003) → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });
      prisma.characterGroupRole.create.mockRejectedValue({ code: 'P2003' });

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('catalogue groupRole vide pour ce système de jeu → BadRequestException explicite', async () => {
      gameSystems.getContent.mockResolvedValue({ groupRole: [] });
      prisma.character.findUnique.mockResolvedValue({ partieId: 'p1' });

      await expect(service.assign('p1', 'mj1', 'char1', 'cartographe')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.characterGroupRole.create).not.toHaveBeenCalled();
    });
  });

  describe('unassign()', () => {
    it('rôle existant → deleteMany appelé, emit appelé', async () => {
      prisma.characterGroupRole.deleteMany.mockResolvedValue({ count: 1 });

      await service.unassign('p1', 'mj1', 'char1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'GROUP_ROLE_UNASSIGN', {
        partieId: 'p1',
      });
      expect(prisma.characterGroupRole.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', characterId: 'char1' },
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('aucun rôle assigné (count 0) → NotFoundException, emit non appelé', async () => {
      prisma.characterGroupRole.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unassign('p1', 'mj1', 'char1')).rejects.toThrow(NotFoundException);
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('non-MJ → permissions.assert rejette, aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new Error('forbidden'));

      await expect(service.unassign('p1', 'stranger', 'char1')).rejects.toThrow('forbidden');
      expect(prisma.characterGroupRole.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('listForPartie()', () => {
    it('membre (pas MJ) → GROUP_ROLE_READ vérifié, liste retournée', async () => {
      prisma.characterGroupRole.findMany.mockResolvedValue([makeRole()]);

      const result = await service.listForPartie('p1', 'joueur1');

      expect(permissions.assert).toHaveBeenCalledWith('joueur1', 'GROUP_ROLE_READ', {
        partieId: 'p1',
      });
      expect(prisma.characterGroupRole.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
        orderBy: { assignedAt: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'role1',
          characterId: 'char1',
          partieId: 'p1',
          roleKey: 'cartographe',
          assignedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('non-membre → permissions.assert rejette, propagation', async () => {
      permissions.assert.mockRejectedValue(new Error('forbidden'));

      await expect(service.listForPartie('p1', 'stranger')).rejects.toThrow('forbidden');
    });
  });
});
