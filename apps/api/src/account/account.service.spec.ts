import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';

// AccountService importe toDto() depuis AnnouncementsService (Story 29.13, AD-17) qui importe
// transitivement CharacterService -> @desdispos/game-rules (ESM, non transformé par ts-jest) —
// même mock que announcements.service.spec.ts pour éviter "Unexpected token export".
jest.mock('@desdispos/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  pendingLevels: jest.fn(),
  LEVEL_TABLE: [],
}));

import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { AuthService } from '../auth/auth.service';
import { PartiesService } from '../parties/parties.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { testGrant } from '../common/test-utils/grant';
import { RELEASED_ANNOUNCEMENT_WHERE } from '../permissions/scenario-visibility';
import { AccountService } from './account.service';
import { anyOf, objectLike } from '../common/test-utils/jest-typed';

// Champs requis par toAuthUser() (Story 30.4) — fusionnés dans chaque mock de retour
// `prisma.user.update()` qui ne les fournit pas déjà explicitement.
const AUTH_USER_BASE_FIELDS = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  calendarLayersSetAt: null,
  calendarLayers: [],
};

function makePrisma() {
  return {
    user: { update: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    userCalendarLayer: { deleteMany: jest.fn(), createMany: jest.fn() },
    partieFavorite: { create: jest.fn(), deleteMany: jest.fn() },
    announcement: { findMany: jest.fn(), count: jest.fn() },
    announcementRead: { create: jest.fn() },
    membership: { findMany: jest.fn(), groupBy: jest.fn() },
    partie: { findMany: jest.fn() },
    event: { groupBy: jest.fn() },
    character: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
}

const EFFECTS = { deletedJdr: [], jdrDepartures: [], groupDepartures: [] };

describe('AccountService', () => {
  let service: AccountService;
  let prisma: ReturnType<typeof makePrisma>;
  // Story 37.7 : l'appartenance à la partie est décidée par `PermissionService.assert()`, simulé ici.
  let permissions: { assert: jest.Mock };
  // Story 43.2 : mot de passe et sessions (AuthService), sortie des parties (PartiesService), simulés.
  let auth: { verifyPassword: jest.Mock; revokeSessions: jest.Mock };
  let parties: { eraseMembershipsInTx: jest.Mock; announceAccountErasure: jest.Mock };
  let realtime: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    permissions = { assert: jest.fn().mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' })) };
    auth = {
      verifyPassword: jest.fn().mockResolvedValue(undefined),
      revokeSessions: jest.fn().mockResolvedValue(undefined),
    };
    parties = {
      eraseMembershipsInTx: jest.fn().mockResolvedValue(EFFECTS),
      announceAccountErasure: jest.fn().mockResolvedValue(undefined),
    };
    realtime = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
        { provide: AuthService, useValue: auth },
        { provide: PartiesService, useValue: parties },
        { provide: RealtimeEventsService, useValue: realtime },
      ],
    }).compile();
    service = module.get(AccountService);
  });

  describe('updateDisplayName()', () => {
    it('persiste le nom affiché pour l’id fourni et renvoie l’utilisateur sans passwordHash', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        pseudo: 'alice',
        displayName: 'Alice au pays',
        passwordHash: 'HASH',
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        calendarLayersSetAt: null,
        calendarLayers: [],
      });

      const result = await service.updateDisplayName('u1', 'Alice au pays');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { displayName: 'Alice au pays' },
        include: { calendarLayers: true },
      });
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result).toMatchObject({ id: 'u1', displayName: 'Alice au pays' });
    });

    it('deux utilisateurs différents peuvent porter exactement le même nom affiché (AC4, aucune contrainte d’unicité)', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u2',
        email: 'x@y.z',
        pseudo: 'bob',
        displayName: 'Alice au pays',
        passwordHash: 'HASH2',
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        calendarLayersSetAt: null,
        calendarLayers: [],
      });

      const result = await service.updateDisplayName('u2', 'Alice au pays');

      expect(result).toMatchObject({ id: 'u2', displayName: 'Alice au pays' });
    });

    it('userId de session référant un compte supprimé (P2025) → NotFoundException, pas un 500 brut', async () => {
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(service.updateDisplayName('deleted-user', 'Nom')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('erreur Prisma non-P2025 → propagée telle quelle', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
      prisma.user.update.mockRejectedValue(otherError);

      await expect(service.updateDisplayName('u1', 'Nom')).rejects.toBe(otherError);
    });
  });

  describe('updateTheme()', () => {
    it('persiste le thème pour l’id fourni et renvoie l’utilisateur sans passwordHash', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        pseudo: 'alice',
        displayName: 'Alice',
        passwordHash: 'HASH',
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        theme: 'foret-ancienne',
        calendarLayersSetAt: null,
        calendarLayers: [],
      });

      const result = await service.updateTheme('u1', 'foret-ancienne');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { theme: 'foret-ancienne' },
        include: { calendarLayers: true },
      });
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result).toMatchObject({ id: 'u1', theme: 'foret-ancienne' });
    });

    it('userId de session référant un compte supprimé (P2025) → NotFoundException, pas un 500 brut', async () => {
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(service.updateTheme('deleted-user', 'grimoire-emeraude')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('erreur Prisma non-P2025 → propagée telle quelle', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
      prisma.user.update.mockRejectedValue(otherError);

      await expect(service.updateTheme('u1', 'grimoire-emeraude')).rejects.toBe(otherError);
    });
  });

  describe('updatePreferences() (Story 29.8)', () => {
    it('ne met à jour que les champs fournis (patch partiel) — partiesSort seul', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        pseudo: 'alice',
        displayName: 'Alice',
        passwordHash: 'HASH',
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        partiesSort: 'date',
        hideFinishedParties: false,
        calendarLayersSetAt: null,
        calendarLayers: [],
      });

      const result = await service.updatePreferences('u1', {
        partiesSort: 'date',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { partiesSort: 'date' },
        include: { calendarLayers: true },
      });
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result).toMatchObject({ partiesSort: 'date' });
    });

    it('ne met à jour que les champs fournis (patch partiel) — hideFinishedParties seul', async () => {
      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        hideFinishedParties: true,
      });

      await service.updatePreferences('u1', { hideFinishedParties: true });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { hideFinishedParties: true },
        include: { calendarLayers: true },
      });
    });

    it('availabilityReminder (Story 52.4) → écrit la préférence ET émet user:{id}', async () => {
      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        availabilityReminder: false,
      });

      const result = await service.updatePreferences('u1', { availabilityReminder: false });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { availabilityReminder: false },
        include: { calendarLayers: true },
      });
      expect(realtime.emit).toHaveBeenCalledTimes(1);
      expect(realtime.emit).toHaveBeenCalledWith('user:u1');
      expect(result.availabilityReminder).toBe(false);
    });

    it('sans availabilityReminder (Story 52.4) → aucune émission', async () => {
      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        hideFinishedParties: true,
      });

      await service.updatePreferences('u1', { hideFinishedParties: true });

      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une émission qui échoue ne fait pas échouer l’écriture (Story 52.4)', async () => {
      prisma.user.update.mockResolvedValue({ ...AUTH_USER_BASE_FIELDS, id: 'u1' });
      realtime.emit.mockImplementation(() => {
        throw new Error('bus indisponible');
      });

      await expect(
        service.updatePreferences('u1', { availabilityReminder: true }),
      ).resolves.toBeDefined();
    });

    it('userId de session référant un compte supprimé (P2025) → NotFoundException, pas un 500 brut', async () => {
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(
        service.updatePreferences('deleted-user', { partiesSort: 'nom' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ne met à jour que les champs fournis (patch partiel) — les 3 champs de la Story 29.9 isolément', async () => {
      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        partiesViewMode: 'compact',
      });
      await service.updatePreferences('u1', { partiesViewMode: 'compact' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { partiesViewMode: 'compact' },
        include: { calendarLayers: true },
      });

      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        charactersViewMode: 'large',
      });
      await service.updatePreferences('u1', { charactersViewMode: 'large' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { charactersViewMode: 'large' },
        include: { calendarLayers: true },
      });

      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        charactersSort: 'niveau',
      });
      await service.updatePreferences('u1', { charactersSort: 'niveau' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { charactersSort: 'niveau' },
        include: { calendarLayers: true },
      });
    });

    it('patch combinant les 6 champs de préférence en un seul appel (Story 29.9)', async () => {
      const body = {
        partiesSort: 'date' as const,
        hideFinishedParties: true,
        partiesViewMode: 'compact' as const,
        charactersViewMode: 'large' as const,
        charactersSort: 'niveau' as const,
      };
      prisma.user.update.mockResolvedValue({
        ...AUTH_USER_BASE_FIELDS,
        id: 'u1',
        ...body,
      });

      await service.updatePreferences('u1', body);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: body,
        include: { calendarLayers: true },
      });
    });

    describe('defaultCalendarLayers (Story 30.4, AD-16)', () => {
      it('lot fourni → remplacement atomique via $transaction (delete puis create) et calendarLayersSetAt posé', async () => {
        prisma.$transaction.mockResolvedValue([
          {},
          {},
          {
            ...AUTH_USER_BASE_FIELDS,
            id: 'u1',
            calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
            calendarLayers: [{ id: 'l1', userId: 'u1', layerKey: 'mes-seances' }],
          },
        ]);

        const result = await service.updatePreferences('u1', {
          defaultCalendarLayers: ['mes-seances'],
        });

        expect(prisma.userCalendarLayer.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'u1' },
        });
        expect(prisma.userCalendarLayer.createMany).toHaveBeenCalledWith({
          data: [{ userId: 'u1', layerKey: 'mes-seances' }],
        });
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { calendarLayersSetAt: anyOf(Date) },
          include: { calendarLayers: true },
        });
        expect(result.defaultCalendarLayers).toEqual(['mes-seances']);
      });

      it('lot vide → aucune ligne créée mais calendarLayersSetAt posé quand même (AC3 — tout éteint, distinct d’absent)', async () => {
        prisma.$transaction.mockResolvedValue([
          {},
          {},
          {
            ...AUTH_USER_BASE_FIELDS,
            id: 'u1',
            calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
            calendarLayers: [],
          },
        ]);

        const result = await service.updatePreferences('u1', {
          defaultCalendarLayers: [],
        });

        expect(prisma.userCalendarLayer.createMany).toHaveBeenCalledWith({
          data: [],
        });
        expect(result.defaultCalendarLayers).toEqual([]);
      });

      it('doublons dans le lot → dédupliqués avant écriture (AC9)', async () => {
        prisma.$transaction.mockResolvedValue([
          {},
          {},
          {
            ...AUTH_USER_BASE_FIELDS,
            id: 'u1',
            calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
            calendarLayers: [{ id: 'l1', userId: 'u1', layerKey: 'mes-seances' }],
          },
        ]);

        await service.updatePreferences('u1', {
          defaultCalendarLayers: ['mes-seances', 'mes-seances'],
        });

        expect(prisma.userCalendarLayer.createMany).toHaveBeenCalledWith({
          data: [{ userId: 'u1', layerKey: 'mes-seances' }],
        });
      });

      it('combiné à un scalaire dans le même patch → les deux appliqués dans la même transaction', async () => {
        prisma.$transaction.mockResolvedValue([
          {},
          {},
          {
            ...AUTH_USER_BASE_FIELDS,
            id: 'u1',
            partiesSort: 'date',
            calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
            calendarLayers: [],
          },
        ]);

        await service.updatePreferences('u1', {
          partiesSort: 'date',
          defaultCalendarLayers: [],
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { partiesSort: 'date', calendarLayersSetAt: anyOf(Date) },
          include: { calendarLayers: true },
        });
      });
    });
  });

  describe('addFavorite() (Story 29.8)', () => {
    it('crée la ligne PartieFavorite', async () => {
      prisma.partieFavorite.create.mockResolvedValue({
        id: 'f1',
        userId: 'u1',
        partieId: 'p1',
      });

      const result = await service.addFavorite('u1', 'p1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'PARTIE_READ', { partieId: 'p1' });
      expect(prisma.partieFavorite.create).toHaveBeenCalledWith({
        data: { userId: 'u1', partieId: 'p1' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('utilisateur sans rôle sur la partie → refus du service de permission, aucun favori écrit', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.addFavorite('stranger', 'p1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.partieFavorite.create).not.toHaveBeenCalled();
    });

    it('partie inconnue → 404 du service de permission, aucun favori écrit', async () => {
      permissions.assert.mockRejectedValue(new NotFoundException('Partie introuvable'));

      await expect(service.addFavorite('u1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.partieFavorite.create).not.toHaveBeenCalled();
    });

    it('déjà favori (P2002) → aucune erreur, idempotent', async () => {
      prisma.partieFavorite.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(service.addFavorite('u1', 'p1')).resolves.toEqual({
        ok: true,
      });
    });

    it('partieId inexistant (P2003, FK invalide) → NotFoundException', async () => {
      prisma.partieFavorite.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed.', {
          code: 'P2003',
          clientVersion: '7.8.0',
        }),
      );

      await expect(service.addFavorite('u1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('erreur Prisma non P2002/P2003 → propagée telle quelle', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2025',
        clientVersion: '7.8.0',
      });
      prisma.partieFavorite.create.mockRejectedValue(otherError);

      await expect(service.addFavorite('u1', 'p1')).rejects.toBe(otherError);
    });
  });

  describe('removeFavorite() (Story 29.8)', () => {
    it('supprime la ligne PartieFavorite', async () => {
      prisma.partieFavorite.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeFavorite('u1', 'p1');

      expect(prisma.partieFavorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', partieId: 'p1' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('partie non favorite (0 ligne supprimée) → aucune erreur, idempotent', async () => {
      prisma.partieFavorite.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeFavorite('u1', 'p1')).resolves.toEqual({
        ok: true,
      });
    });
  });

  describe('getUnseenAnnouncements() (Story 29.13)', () => {
    it('effectue un unique appel findMany batché (AD-3, jamais de fan-out par partie)', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.getUnseenAnnouncements('u1');

      expect(prisma.announcement.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.announcement.findMany).toHaveBeenCalledWith({
        // Anti-spoil serveur : propriétaire → tout ; simple membre → annonces de toute la partie ou
        // ciblées sur un scénario diffusé (fragment partagé).
        where: {
          OR: [
            { partie: { ownerId: 'u1' } },
            {
              AND: [
                { partie: { memberships: { some: { userId: 'u1' } } } },
                RELEASED_ANNOUNCEMENT_WHERE,
              ],
            },
          ],
          reads: { none: { userId: 'u1' } },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          partie: {
            select: { owner: { select: { pseudo: true, displayName: true } } },
          },
        },
      });
    });

    it('mappe les annonces trouvées vers AnnouncementDto (auteur dérivé du MJ de la partie)', async () => {
      prisma.announcement.findMany.mockResolvedValue([
        {
          id: 'a1',
          partieId: 'p1',
          scenarioId: null,
          text: 'Bienvenue',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          partie: { owner: { pseudo: 'mj1', displayName: 'Le Meneur' } },
        },
      ]);

      const result = await service.getUnseenAnnouncements('u1');

      expect(result).toEqual([
        {
          id: 'a1',
          partieId: 'p1',
          scenarioId: null,
          text: 'Bienvenue',
          createdAt: '2026-08-01T00:00:00.000Z',
          authorPseudo: 'mj1',
          authorDisplayName: 'Le Meneur',
        },
      ]);
    });

    it('aucune annonce non vue → tableau vide', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);

      await expect(service.getUnseenAnnouncements('u1')).resolves.toEqual([]);
    });

    it("AC3 (multi-appareil) : une annonce disparaît de la liste après markAnnouncementRead(), l'état vivant en base par userId", async () => {
      const announcement = {
        id: 'a1',
        partieId: 'p1',
        scenarioId: null,
        text: 'Bienvenue',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        partie: { owner: { pseudo: 'mj1', displayName: 'Le Meneur' } },
      };
      // Premier appareil : l'annonce est encore non-lue.
      prisma.announcement.findMany.mockResolvedValueOnce([announcement]);
      const first = await service.getUnseenAnnouncements('u1');
      expect(first).toHaveLength(1);

      prisma.announcementRead.create.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        announcementId: 'a1',
      });
      await service.markAnnouncementRead('u1', 'a1');

      // Second appareil : la requête reflète désormais reads:{none} exclu par le mock, donc vide.
      prisma.announcement.findMany.mockResolvedValueOnce([]);
      const second = await service.getUnseenAnnouncements('u1');
      expect(second).toHaveLength(0);
    });
  });

  describe('markAnnouncementRead() (Story 29.13)', () => {
    it('crée la ligne AnnouncementRead', async () => {
      prisma.announcementRead.create.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        announcementId: 'a1',
      });

      const result = await service.markAnnouncementRead('u1', 'a1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'ANNOUNCEMENT_MARK_READ', {
        announcementId: 'a1',
      });
      expect(prisma.announcementRead.create).toHaveBeenCalledWith({
        data: { userId: 'u1', announcementId: 'a1' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('anti-spoil serveur — joueur : annonce visible (toute la partie ou scénario diffusé) → marquée lue', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'player'));
      prisma.announcement.count.mockResolvedValue(1);
      prisma.announcementRead.create.mockResolvedValue({ id: 'r1' });

      await expect(service.markAnnouncementRead('u1', 'a1')).resolves.toEqual({ ok: true });

      expect(prisma.announcement.count).toHaveBeenCalledWith({
        where: { AND: [{ id: 'a1' }, RELEASED_ANNOUNCEMENT_WHERE] },
      });
      expect(prisma.announcementRead.create).toHaveBeenCalledTimes(1);
    });

    it.each(['player', 'member'] as const)(
      'anti-spoil serveur — %s : annonce ciblée sur un scénario non diffusé → 404, aucune ligne écrite',
      async (role) => {
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, role));
        prisma.announcement.count.mockResolvedValue(0);

        const promise = service.markAnnouncementRead('u1', 'a-brouillon');

        await expect(promise).rejects.toBeInstanceOf(NotFoundException);
        await expect(promise).rejects.toThrow('Annonce introuvable');
        expect(prisma.announcementRead.create).not.toHaveBeenCalled();
      },
    );

    it('le MJ marque toute annonce lue, sans test de visibilité', async () => {
      prisma.announcementRead.create.mockResolvedValue({ id: 'r1' });

      await service.markAnnouncementRead('mj1', 'a-brouillon');

      expect(prisma.announcement.count).not.toHaveBeenCalled();
      expect(prisma.announcementRead.create).toHaveBeenCalledTimes(1);
    });

    it('annonce d’une partie où l’utilisateur n’a aucun rôle → refus, aucune ligne de lecture écrite', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.markAnnouncementRead('stranger', 'a-etrangere')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.announcementRead.create).not.toHaveBeenCalled();
    });

    it('annonce inconnue → 404 « Annonce introuvable » du service de permission, aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new NotFoundException('Annonce introuvable'));

      await expect(service.markAnnouncementRead('u1', 'inconnue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.announcementRead.create).not.toHaveBeenCalled();
    });

    it('déjà marquée lue (P2002) → aucune erreur, idempotent', async () => {
      prisma.announcementRead.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(service.markAnnouncementRead('u1', 'a1')).resolves.toEqual({
        ok: true,
      });
    });

    it('announcementId inexistant (P2003, FK invalide) → NotFoundException', async () => {
      prisma.announcementRead.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed.', {
          code: 'P2003',
          clientVersion: '7.8.0',
        }),
      );

      await expect(service.markAnnouncementRead('u1', 'inconnue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('erreur Prisma non P2002/P2003 → propagée telle quelle', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2025',
        clientVersion: '7.8.0',
      });
      prisma.announcementRead.create.mockRejectedValue(otherError);

      await expect(service.markAnnouncementRead('u1', 'a1')).rejects.toBe(otherError);
    });
  });

  describe('getDeletionImpact() — Story 43.1', () => {
    function mockReads(opts: {
      adminships?: { partie: { id: string; name: string } }[];
      owned?: { id: string; name: string }[];
      admins?: { partieId: string; n: number }[];
      members?: { partieId: string; n: number }[];
      events?: { partieId: string; n: number }[];
      characters?: { partieId: string; userId: string }[];
    }) {
      const rows = (r: { partieId: string; n: number }[] = []) =>
        r.map((x) => ({ partieId: x.partieId, _count: { _all: x.n } }));
      prisma.membership.findMany.mockResolvedValue(opts.adminships ?? []);
      prisma.partie.findMany.mockResolvedValue(opts.owned ?? []);
      prisma.membership.groupBy
        .mockResolvedValueOnce(rows(opts.admins))
        .mockResolvedValueOnce(rows(opts.members));
      prisma.event.groupBy.mockResolvedValue(rows(opts.events));
      prisma.character.findMany.mockResolvedValue(opts.characters ?? []);
    }

    it('seul administrateur : le groupe est listé avec ses adhésions et ses conjonctions', async () => {
      mockReads({
        adminships: [{ partie: { id: 'g1', name: 'La Bande du Jeudi' } }],
        admins: [{ partieId: 'g1', n: 1 }],
        members: [{ partieId: 'g1', n: 14 }],
        events: [{ partieId: 'g1', n: 6 }],
      });

      await expect(service.getDeletionImpact('u1')).resolves.toEqual({
        groups: [{ id: 'g1', name: 'La Bande du Jeudi', memberCount: 14, eventCount: 6 }],
        jdrParties: [],
      });
    });

    it('un autre administrateur existe : le groupe survit, il n’est pas listé', async () => {
      mockReads({
        adminships: [
          { partie: { id: 'g1', name: 'Partagé' } },
          { partie: { id: 'g2', name: 'Seul' } },
        ],
        admins: [
          { partieId: 'g1', n: 2 },
          { partieId: 'g2', n: 1 },
        ],
        members: [
          { partieId: 'g1', n: 5 },
          { partieId: 'g2', n: 3 },
        ],
      });

      const impact = await service.getDeletionImpact('u1');

      expect(impact.groups.map((g) => g.id)).toEqual(['g2']);
      expect(impact.groups[0]).toMatchObject({ memberCount: 3, eventCount: 0 });
    });

    it('partie de JDR possédée : compte les joueurs distincts qui ont un personnage', async () => {
      mockReads({
        owned: [{ id: 'q1', name: 'Quête' }],
        characters: [
          { partieId: 'q1', userId: 'p1' },
          { partieId: 'q1', userId: 'p2' },
        ],
      });

      await expect(service.getDeletionImpact('u1')).resolves.toEqual({
        groups: [],
        jdrParties: [{ id: 'q1', name: 'Quête', playerCount: 2 }],
      });
      // Le MJ lui-même n'est jamais compté, et seules ses parties sont lues.
      expect(prisma.character.findMany).toHaveBeenCalledWith(
        objectLike({ where: { partieId: { in: ['q1'] }, userId: { not: 'u1' } } }),
      );
      expect(prisma.partie.findMany).toHaveBeenCalledWith(
        objectLike({ where: objectLike({ ownerId: 'u1' }) }),
      );
    });

    it('simple membre : deux listes vides, et aucune lecture groupée inutile', async () => {
      mockReads({});

      await expect(service.getDeletionImpact('u1')).resolves.toEqual({
        groups: [],
        jdrParties: [],
      });
      expect(prisma.membership.groupBy).not.toHaveBeenCalled();
      expect(prisma.event.groupBy).not.toHaveBeenCalled();
      expect(prisma.character.findMany).not.toHaveBeenCalled();
    });

    it('ne lit que les adhésions ADMIN de l’utilisateur appelant', async () => {
      mockReads({});

      await service.getDeletionImpact('u1');

      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        objectLike({ where: objectLike({ userId: 'u1', role: 'ADMIN' }) }),
      );
    });

    it('trie les listes par nom', async () => {
      mockReads({
        adminships: [
          { partie: { id: 'g1', name: 'Zèbre' } },
          { partie: { id: 'g2', name: 'Abeille' } },
        ],
        admins: [
          { partieId: 'g1', n: 1 },
          { partieId: 'g2', n: 1 },
        ],
      });

      const impact = await service.getDeletionImpact('u1');

      expect(impact.groups.map((g) => g.name)).toEqual(['Abeille', 'Zèbre']);
    });
  });

  describe('deleteAccount() — Story 43.2', () => {
    const tx = { user: { delete: jest.fn() } };

    beforeEach(() => {
      tx.user.delete.mockReset().mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ displayName: 'Alice au pays' });
      prisma.$transaction.mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    });

    it('faux mot de passe : refusé, aucune transaction, aucune annonce', async () => {
      auth.verifyPassword.mockRejectedValue(new UnauthorizedException('Mot de passe incorrect'));

      await expect(service.deleteAccount('u1', 'faux')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(auth.verifyPassword).toHaveBeenCalledWith('u1', 'faux');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(parties.announceAccountErasure).not.toHaveBeenCalled();
    });

    it('une transaction : parties quittées, sessions coupées, compte supprimé — puis annonce', async () => {
      const order: string[] = [];
      parties.eraseMembershipsInTx.mockImplementation(() => {
        order.push('parties');
        return Promise.resolve(EFFECTS);
      });
      auth.revokeSessions.mockImplementation(() => {
        order.push('sessions');
        return Promise.resolve();
      });
      tx.user.delete.mockImplementation(() => {
        order.push('compte');
        return Promise.resolve({});
      });
      parties.announceAccountErasure.mockImplementation(() => {
        order.push('annonce');
        return Promise.resolve();
      });

      await expect(service.deleteAccount('u1', 'bon')).resolves.toEqual({ ok: true });

      expect(order).toEqual(['parties', 'sessions', 'compte', 'annonce']);
      expect(parties.eraseMembershipsInTx).toHaveBeenCalledWith(tx, 'u1');
      expect(auth.revokeSessions).toHaveBeenCalledWith(tx, 'u1');
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(parties.announceAccountErasure).toHaveBeenCalledWith('u1', 'Alice au pays', EFFECTS);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('échec dans la transaction : propagé, rien n’est annoncé', async () => {
      tx.user.delete.mockRejectedValue(new Error('boom'));

      await expect(service.deleteAccount('u1', 'bon')).rejects.toThrow('boom');

      expect(parties.announceAccountErasure).not.toHaveBeenCalled();
    });

    it('compte introuvable : 404, aucune transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('u1', 'bon')).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
