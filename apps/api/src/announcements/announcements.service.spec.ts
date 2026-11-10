import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// ScenariosService (import réel pour servir de jeton DI) importe transitivement CharacterService
// -> @master-jdr/game-rules (ESM, non transformé par ts-jest) — même mock que
// scenarios.service.spec.ts pour éviter "Unexpected token export" au chargement du module.
jest.mock('@master-jdr/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  pendingLevels: jest.fn(),
  LEVEL_TABLE: [],
}));

import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { RELEASED_ANNOUNCEMENT_WHERE } from '../permissions/scenario-visibility';
import { ScenariosService } from '../scenarios/scenarios.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';

function makePrisma() {
  return {
    announcement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

/** Story 37.7 : les droits sont décidés par `PermissionService.assert()`, simulé ici ; `ownerOf`
 *  fournit l'identité de l'auteur (le MJ propriétaire) affichée sur les annonces. */
function makePermissions() {
  return { assert: jest.fn(), ownerOf: jest.fn() };
}

function makeScenariosService() {
  return {
    verifyScenarioBelongsToPartie: jest.fn(),
  };
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

function makeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ann1',
    partieId: 'p1',
    scenarioId: null,
    text: 'Une annonce',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: ReturnType<typeof makePrisma>;
  let permissions: ReturnType<typeof makePermissions>;
  let scenarios: ReturnType<typeof makeScenariosService>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;

  beforeEach(async () => {
    prisma = makePrisma();
    permissions = makePermissions();
    scenarios = makeScenariosService();
    realtimeEvents = makeRealtimeEvents();
    const module = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: ScenariosService, useValue: scenarios },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
      ],
    }).compile();
    service = module.get(AnnouncementsService);
  });

  describe('create()', () => {
    it('pas de scenarioId → Announcement créée avec scenarioId: null (AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.announcement.create.mockResolvedValue(makeAnnouncement());
      prisma.user.findUnique.mockResolvedValue({
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });

      const result = await service.create('p1', 'mj1', { text: 'Une annonce' });

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'ANNOUNCEMENT_CREATE', {
        partieId: 'p1',
      });
      expect(scenarios.verifyScenarioBelongsToPartie).not.toHaveBeenCalled();
      expect(prisma.announcement.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', scenarioId: null, text: 'Une annonce' },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'mj1' },
        select: { pseudo: true, displayName: true },
      });
      expect(result.scenarioId).toBeNull();
      expect(result.authorPseudo).toBe('le-mj');
      expect(result.authorDisplayName).toBe('Le Grand MJ');
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.announcement.create.mockResolvedValue(makeAnnouncement());
      prisma.user.findUnique.mockResolvedValue({
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });

      await service.create('p1', 'mj1', { text: 'Une annonce' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('scenarioId valide de la Partie → Announcement créée avec ce scenarioId (AC2)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      scenarios.verifyScenarioBelongsToPartie.mockResolvedValue(undefined);
      prisma.announcement.create.mockResolvedValue(makeAnnouncement({ scenarioId: 's1' }));
      prisma.user.findUnique.mockResolvedValue({
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });

      const result = await service.create('p1', 'mj1', {
        text: 'Une annonce scopée',
        scenarioId: 's1',
      });

      expect(scenarios.verifyScenarioBelongsToPartie).toHaveBeenCalledWith('s1', 'p1');
      expect(prisma.announcement.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', scenarioId: 's1', text: 'Une annonce scopée' },
      });
      expect(result.scenarioId).toBe('s1');
    });

    it("scenarioId d'une autre Partie → rejet propagé par verifyScenarioBelongsToPartie, aucune écriture (AC3)", async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      scenarios.verifyScenarioBelongsToPartie.mockRejectedValue(
        new Error("Ce scénario n'appartient pas à cette Partie"),
      );

      await expect(
        service.create('p1', 'mj1', { text: 'x', scenarioId: 's-autre' }),
      ).rejects.toThrow();
      expect(prisma.announcement.create).not.toHaveBeenCalled();
    });

    it('scenarioId visant un scénario BROUILLON/A_VENIR de la même Partie → acceptée, aucune validation de statut (AC7)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      // verifyScenarioBelongsToPartie ne valide jamais le statut (délégué à ScenariosService, AD-2) —
      // ce test documente que AnnouncementsService ne fait lui non plus aucune vérification de statut.
      scenarios.verifyScenarioBelongsToPartie.mockResolvedValue(undefined);
      prisma.announcement.create.mockResolvedValue(makeAnnouncement({ scenarioId: 's-brouillon' }));
      prisma.user.findUnique.mockResolvedValue({
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });

      await expect(
        service.create('p1', 'mj1', { text: 'x', scenarioId: 's-brouillon' }),
      ).resolves.toBeDefined();
      expect(prisma.announcement.create).toHaveBeenCalled();
    });

    it('non-MJ → ForbiddenException propagée par permissions.assert, aucune écriture (AC6)', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.create('p1', 'stranger', { text: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(scenarios.verifyScenarioBelongsToPartie).not.toHaveBeenCalled();
      expect(prisma.announcement.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll() (Story 9.2, AD-6/AD-9)', () => {
    it('liste les annonces de la Partie triées par createdAt desc, membre quelconque (AC1/AC2)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'player'));
      permissions.ownerOf.mockResolvedValue({
        userId: 'mj1',
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });
      prisma.announcement.findMany.mockResolvedValue([
        makeAnnouncement({
          id: 'ann2',
          createdAt: new Date('2026-07-15T10:00:00.000Z'),
        }),
        makeAnnouncement({
          id: 'ann1',
          createdAt: new Date('2026-07-14T10:00:00.000Z'),
        }),
      ]);

      const result = await service.findAll('p1', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'ANNOUNCEMENT_READ', {
        partieId: 'p1',
      });
      // Anti-spoil serveur : un joueur ne lit que les annonces de toute la partie ou ciblées sur un
      // scénario diffusé (fragment partagé).
      expect(prisma.announcement.findMany).toHaveBeenCalledWith({
        where: { AND: [{ partieId: 'p1' }, RELEASED_ANNOUNCEMENT_WHERE] },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.map((a) => a.id)).toEqual(['ann2', 'ann1']);
      expect(result[0].authorPseudo).toBe('le-mj');
      expect(result[0].authorDisplayName).toBe('Le Grand MJ');
    });

    it('échec FERMÉ : un rôle autre que MJ (ici member) reçoit la liste filtrée', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'member'));
      permissions.ownerOf.mockResolvedValue({ userId: 'mj1', pseudo: 'le-mj', displayName: 'MJ' });
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.findAll('p1', 'u1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith({
        where: { AND: [{ partieId: 'p1' }, RELEASED_ANNOUNCEMENT_WHERE] },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('le MJ lit TOUTES les annonces, y compris celles scopées à un scénario BROUILLON/A_VENIR (aucun filtre)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'mj'));
      permissions.ownerOf.mockResolvedValue({
        userId: 'mj1',
        pseudo: 'le-mj',
        displayName: 'Le Grand MJ',
      });
      prisma.announcement.findMany.mockResolvedValue([
        makeAnnouncement({ id: 'ann-brouillon', scenarioId: 's-brouillon' }),
      ]);

      const result = await service.findAll('p1', 'mj1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].scenarioId).toBe('s-brouillon');
    });

    it('non-membre → ForbiddenException propagée par permissions.assert, aucune lecture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.findAll('p1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.announcement.findMany).not.toHaveBeenCalled();
    });

    it("partie sans propriétaire (aucun auteur à afficher) → liste vide, sans lire d'annonce", async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: null }, 'player'));
      permissions.ownerOf.mockResolvedValue(null);

      await expect(service.findAll('p1', 'u1')).resolves.toEqual([]);
      expect(prisma.announcement.findMany).not.toHaveBeenCalled();
    });
  });
});
