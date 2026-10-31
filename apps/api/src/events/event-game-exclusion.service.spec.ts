import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { callArg } from '../common/test-utils/jest-typed';
import { testGrant } from '../common/test-utils/grant';
import { BOARD_GAME_NOT_FOUND, type BoardGamesService } from '../board-games/board-games.service';
import {
  HOST_ONLY_MESSAGE,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import { partieTopic, type RealtimeEventsService } from '../realtime/realtime-events.service';
import { EventGameExclusionService } from './event-game-exclusion.service';
import {
  CANCELLED_EVENT_MESSAGE,
  EVENING_CANCELLED_MESSAGE,
  EVENING_FINISHED_MESSAGE,
  PAST_ROSTER_MESSAGE,
  type EventBoardGamesBasis,
  type EventsService,
} from './events.service';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe('EventGameExclusionService (Story 49.4)', () => {
  const group = {
    id: 'p1',
    kind: 'CAMPAGNE_EPISODIQUE',
    gameSystemId: 'ralliement',
    closedAt: null,
  };
  const evening = { id: 'p2', kind: 'ONE_SHOT', gameSystemId: 'ralliement', closedAt: null };

  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    eventGameExcluded: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
  };
  let permissions: { assert: jest.Mock };
  let events: { boardGamesBasis: jest.Mock; releaseOrphanEnviesInTx: jest.Mock };
  let boardGames: { ownedGameIds: jest.Mock };
  let realtime: { emit: jest.Mock };
  let service: EventGameExclusionService;

  const basis = (over: Partial<EventBoardGamesBasis> = {}): EventBoardGamesBasis => ({
    hostId: 'host',
    cancelledAt: null,
    startDate: day(3),
    endDate: day(3),
    inscriptions: [],
    memberIds: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
      eventGameExcluded: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    // Transaction interactive simulée : la fonction reçoit le même client.
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
    permissions = { assert: jest.fn().mockResolvedValue(testGrant(group, 'member')) };
    events = {
      boardGamesBasis: jest.fn().mockResolvedValue(basis()),
      releaseOrphanEnviesInTx: jest.fn().mockResolvedValue(0),
    };
    boardGames = { ownedGameIds: jest.fn().mockResolvedValue(new Set(['g1'])) };
    realtime = { emit: jest.fn() };
    service = new EventGameExclusionService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      boardGames as unknown as BoardGamesService,
      realtime as unknown as RealtimeEventsService,
    );
  });

  /** Le verrou `FOR UPDATE` porte sur la ligne `Event`, une seule fois, AVANT la relecture de la base. */
  function expectEventLockedFirst(): void {
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = callArg<string[]>(prisma.$queryRaw).join('?');
    expect(sql).toContain('"Event"');
    expect(sql).toContain('FOR UPDATE');
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      events.boardGamesBasis.mock.invocationCallOrder[0],
    );
  }

  describe('exclude', () => {
    it('décide EVENT_GAME_EXCLUDE, verrouille l’événement, relit la base sur la transaction, écrit puis émet', async () => {
      await service.exclude('e1', 'g1', 'host');

      expect(permissions.assert).toHaveBeenCalledWith('host', 'EVENT_GAME_EXCLUDE', {
        eventId: 'e1',
      });
      expectEventLockedFirst();
      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p1', isolated: false },
        prisma,
      );
      expect(boardGames.ownedGameIds).toHaveBeenCalledWith('host', ['g1'], prisma);
      expect(prisma.eventGameExcluded.upsert).toHaveBeenCalledWith({
        where: { eventId_boardGameId: { eventId: 'e1', boardGameId: 'g1' } },
        create: { eventId: 'e1', boardGameId: 'g1' },
        update: {},
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('Story 49.5 : purge les Envies orphelines dans la même transaction, APRÈS l’écart', async () => {
      await service.exclude('e1', 'g1', 'host');

      expect(events.releaseOrphanEnviesInTx).toHaveBeenCalledWith(prisma, 'e1');
      expect(prisma.eventGameExcluded.upsert.mock.invocationCallOrder[0]).toBeLessThan(
        events.releaseOrphanEnviesInTx.mock.invocationCallOrder[0],
      );
    });

    it('Story 49.5 : une purge en échec annule l’écart (rien n’est émis)', async () => {
      events.releaseOrphanEnviesInTx.mockRejectedValue(new Error('boum'));

      await expect(service.exclude('e1', 'g1', 'host')).rejects.toThrow('boum');
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('rencontre isolée : l’hôte écarte un jeu', async () => {
      permissions.assert.mockResolvedValue(testGrant(evening, 'member'));

      await service.exclude('e1', 'g1', 'host');

      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p2', isolated: true },
        prisma,
      );
      expect(prisma.eventGameExcluded.upsert).toHaveBeenCalledTimes(1);
    });

    it('pas l’hôte : 403 « réservée à l’hôte » (par assert), rien n’est verrouillé ni écrit ni émis', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException(HOST_ONLY_MESSAGE));

      const refusal = service.exclude('e1', 'g1', 'zoe');

      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(HOST_ONLY_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.eventGameExcluded.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it.each([
      ['conjonction annulée', group, { cancelledAt: new Date() }, CANCELLED_EVENT_MESSAGE],
      ['soirée isolée annulée', evening, { cancelledAt: new Date() }, EVENING_CANCELLED_MESSAGE],
      ['conjonction passée', group, { startDate: day(-2), endDate: day(-2) }, PAST_ROSTER_MESSAGE],
      [
        'soirée isolée passée',
        evening,
        { startDate: day(-2), endDate: day(-2) },
        EVENING_FINISHED_MESSAGE,
      ],
    ])('%s : 400 en français, rien n’est écrit ni émis', async (_label, partie, over, message) => {
      permissions.assert.mockResolvedValue(testGrant(partie, 'member'));
      events.boardGamesBasis.mockResolvedValue(basis(over));

      const refusal = service.exclude('e1', 'g1', 'host');

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(message);
      expect(prisma.eventGameExcluded.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('rencontre isolée close : 400 « terminée »', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ ...evening, closedAt: new Date() }, 'member'),
      );

      await expect(service.exclude('e1', 'g1', 'host')).rejects.toThrow(EVENING_FINISHED_MESSAGE);
      expect(prisma.eventGameExcluded.upsert).not.toHaveBeenCalled();
    });

    it('soirée à la fois annulée et passée : l’annulation est dite en premier', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ cancelledAt: new Date(), startDate: day(-2), endDate: day(-2) }),
      );

      await expect(service.exclude('e1', 'g1', 'host')).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
    });

    it('soirée fermée ET jeu inconnu : la fermeture passe avant (400, pas 404)', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));
      boardGames.ownedGameIds.mockResolvedValue(new Set());

      await expect(service.exclude('e1', 'g9', 'host')).rejects.toBeInstanceOf(BadRequestException);
      expect(boardGames.ownedGameIds).not.toHaveBeenCalled();
    });

    it('jeu d’autrui ou inconnu : 404, même message, rien n’est écrit', async () => {
      boardGames.ownedGameIds.mockResolvedValue(new Set());

      const refusal = service.exclude('e1', 'g9', 'host');

      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow(BOARD_GAME_NOT_FOUND);
      expect(prisma.eventGameExcluded.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('jeu retiré pendant l’écriture (clé étrangère P2003) : le même 404', async () => {
      prisma.eventGameExcluded.upsert.mockRejectedValue({ code: 'P2003' });

      const refusal = service.exclude('e1', 'g1', 'host');

      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow(BOARD_GAME_NOT_FOUND);
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une autre erreur d’écriture remonte telle quelle', async () => {
      prisma.eventGameExcluded.upsert.mockRejectedValue(new Error('boum'));

      await expect(service.exclude('e1', 'g1', 'host')).rejects.toThrow('boum');
    });

    it('événement disparu entre la décision et le verrou : 404', async () => {
      events.boardGamesBasis.mockResolvedValue(null);

      await expect(service.exclude('e1', 'g1', 'host')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('partie de JDR (ou genre de partie sans jeux) : 403, rien n’est verrouillé', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p3', kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }, 'player'),
      );

      const refusal = service.exclude('e1', 'g1', 'host');

      await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('une émission en échec est consignée, l’écart reste un succès', async () => {
      realtime.emit.mockImplementation(() => {
        throw new Error('flux coupé');
      });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(service.exclude('e1', 'g1', 'host')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('restore', () => {
    it('Story 49.5 : remettre un jeu ne purge aucune Envie (une source de plus, jamais de moins)', async () => {
      await service.restore('e1', 'g1', 'host');

      expect(events.releaseOrphanEnviesInTx).not.toHaveBeenCalled();
    });

    it('mêmes décisions sous le verrou, puis lève l’écart (deleteMany) et émet', async () => {
      await service.restore('e1', 'g1', 'host');

      expect(permissions.assert).toHaveBeenCalledWith('host', 'EVENT_GAME_EXCLUDE', {
        eventId: 'e1',
      });
      expectEventLockedFirst();
      expect(prisma.eventGameExcluded.deleteMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', boardGameId: 'g1' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('écart absent : rien à supprimer, succès', async () => {
      prisma.eventGameExcluded.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.restore('e1', 'g1', 'host')).resolves.toBeUndefined();
    });

    it('pas l’hôte : 403 ; soirée annulée : 400 ; jeu d’autrui : 404 — rien n’est supprimé', async () => {
      permissions.assert.mockRejectedValueOnce(new ForbiddenException(HOST_ONLY_MESSAGE));
      await expect(service.restore('e1', 'g1', 'zoe')).rejects.toBeInstanceOf(ForbiddenException);

      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));
      await expect(service.restore('e1', 'g1', 'host')).rejects.toBeInstanceOf(BadRequestException);

      events.boardGamesBasis.mockResolvedValue(basis());
      boardGames.ownedGameIds.mockResolvedValue(new Set());
      await expect(service.restore('e1', 'g9', 'host')).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.eventGameExcluded.deleteMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });
  });

  describe('excludedIds', () => {
    it('lit les identifiants des jeux écartés de la soirée', async () => {
      prisma.eventGameExcluded.findMany.mockResolvedValue([
        { boardGameId: 'g1' },
        { boardGameId: 'g2' },
      ]);

      const ids = await service.excludedIds('e1');

      expect(prisma.eventGameExcluded.findMany).toHaveBeenCalledWith({
        where: { eventId: 'e1' },
        select: { boardGameId: true },
      });
      expect([...ids]).toEqual(['g1', 'g2']);
    });
  });
});
