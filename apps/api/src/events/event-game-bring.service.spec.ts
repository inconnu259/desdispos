import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { callArg } from '../common/test-utils/jest-typed';
import { testGrant } from '../common/test-utils/grant';
import { BOARD_GAME_NOT_FOUND, type BoardGamesService } from '../board-games/board-games.service';
import {
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import { partieTopic, type RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  BRING_HOST_MESSAGE,
  BRING_NOT_PARTICIPANT_MESSAGE,
  EventGameBringService,
} from './event-game-bring.service';
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

const GAME = {
  id: 'g1',
  name: 'Azul',
  nameKey: 'azul',
  minPlayers: 2,
  maxPlayers: 4,
  durationMin: 40,
  createdAt: '2026-10-29T10:00:00.000Z',
};

describe('EventGameBringService (Story 49.2)', () => {
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
    eventGameBring: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
  };
  let permissions: { assert: jest.Mock };
  let events: { boardGamesBasis: jest.Mock; releaseOrphanEnviesInTx: jest.Mock };
  let boardGames: { ownedGameIds: jest.Mock; listByIds: jest.Mock };
  let realtime: { emit: jest.Mock };
  let service: EventGameBringService;

  const basis = (over: Partial<EventBoardGamesBasis> = {}): EventBoardGamesBasis => ({
    hostId: 'host',
    cancelledAt: null,
    startDate: day(3),
    endDate: day(3),
    inscriptions: [{ userId: 'zoe', status: 'CONFIRMED' }],
    memberIds: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
      eventGameBring: {
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
    boardGames = {
      ownedGameIds: jest.fn().mockResolvedValue(new Set(['g1'])),
      listByIds: jest.fn().mockResolvedValue([GAME]),
    };
    realtime = { emit: jest.fn() };
    service = new EventGameBringService(
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

  describe('bring', () => {
    it('décide EVENT_GAME_BRING, verrouille l’événement, relit la base sur la transaction, écrit puis émet', async () => {
      await service.bring('e1', 'g1', 'zoe');

      expect(permissions.assert).toHaveBeenCalledWith('zoe', 'EVENT_GAME_BRING', { eventId: 'e1' });
      expectEventLockedFirst();
      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p1', isolated: false },
        prisma,
      );
      expect(boardGames.ownedGameIds).toHaveBeenCalledWith('zoe', ['g1'], prisma);
      expect(prisma.eventGameBring.upsert).toHaveBeenCalledWith({
        where: { eventId_boardGameId: { eventId: 'e1', boardGameId: 'g1' } },
        create: { eventId: 'e1', boardGameId: 'g1', userId: 'zoe' },
        update: {},
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('rencontre isolée : un membre de la partie apporte', async () => {
      permissions.assert.mockResolvedValue(testGrant(evening, 'member'));
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [], memberIds: ['host', 'zoe'] }),
      );

      await service.bring('e1', 'g1', 'zoe');

      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p2', isolated: true },
        prisma,
      );
      expect(prisma.eventGameBring.upsert).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['conjonction annulée', group, { cancelledAt: new Date() }, CANCELLED_EVENT_MESSAGE],
      [
        'soirée isolée annulée',
        evening,
        { cancelledAt: new Date(), memberIds: ['zoe'] },
        EVENING_CANCELLED_MESSAGE,
      ],
      ['conjonction passée', group, { startDate: day(-2), endDate: day(-2) }, PAST_ROSTER_MESSAGE],
      [
        'soirée isolée passée',
        evening,
        { startDate: day(-2), endDate: day(-2), memberIds: ['zoe'] },
        EVENING_FINISHED_MESSAGE,
      ],
    ])('%s : 400 en français, rien n’est écrit ni émis', async (_label, partie, over, message) => {
      permissions.assert.mockResolvedValue(testGrant(partie, 'member'));
      events.boardGamesBasis.mockResolvedValue(basis(over));

      const refusal = service.bring('e1', 'g1', 'zoe');

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(message);
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('rencontre isolée close : 400 « terminée »', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ ...evening, closedAt: new Date() }, 'member'),
      );
      events.boardGamesBasis.mockResolvedValue(basis({ inscriptions: [], memberIds: ['zoe'] }));

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toThrow(EVENING_FINISHED_MESSAGE);
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
    });

    it('soirée à la fois annulée et passée : l’annulation est dite en premier', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ cancelledAt: new Date(), startDate: day(-2), endDate: day(-2) }),
      );

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
    });

    it('soirée fermée ET appelant non participant : la fermeture passe avant (400, pas 403)', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      await expect(service.bring('e1', 'g1', 'intrus')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('membre non inscrit : 403, rien n’est écrit', async () => {
      const refusal = service.bring('e1', 'g1', 'intrus');

      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(BRING_NOT_PARTICIPANT_MESSAGE);
      expect(boardGames.ownedGameIds).not.toHaveBeenCalled();
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('place seulement RÉSERVÉE : 403 comme un non-participant', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [{ userId: 'zoe', status: 'RESERVED' }] }),
      );

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toThrow(BRING_NOT_PARTICIPANT_MESSAGE);
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
    });

    it('hôte : 403 « ses jeux sont déjà sur place », rien n’est écrit', async () => {
      const refusal = service.bring('e1', 'g1', 'host');

      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(BRING_HOST_MESSAGE);
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('jeu d’autrui ou inconnu : 404, même message, rien n’est écrit', async () => {
      boardGames.ownedGameIds.mockResolvedValue(new Set());

      const refusal = service.bring('e1', 'g9', 'zoe');

      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow(BOARD_GAME_NOT_FOUND);
      expect(prisma.eventGameBring.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('jeu retiré pendant l’écriture (clé étrangère P2003) : le même 404', async () => {
      prisma.eventGameBring.upsert.mockRejectedValue({ code: 'P2003' });

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toThrow(BOARD_GAME_NOT_FOUND);
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une autre erreur d’écriture remonte telle quelle', async () => {
      prisma.eventGameBring.upsert.mockRejectedValue(new Error('boum'));

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toThrow('boum');
    });

    it('événement disparu entre la décision et le verrou : 404', async () => {
      events.boardGamesBasis.mockResolvedValue(null);

      await expect(service.bring('e1', 'g1', 'zoe')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('partie de JDR (ou genre de partie sans jeux) : 403, rien n’est verrouillé', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p3', kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }, 'player'),
      );

      const refusal = service.bring('e1', 'g1', 'zoe');

      await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refus du droit de rôle (étranger) : propagé, rien n’est lu', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('Pas accès'));

      await expect(service.bring('e1', 'g1', 'intrus')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('une émission en échec est consignée, l’apport reste un succès', async () => {
      realtime.emit.mockImplementation(() => {
        throw new Error('flux coupé');
      });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(service.bring('e1', 'g1', 'zoe')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('unbring', () => {
    it('mêmes décisions sous le verrou, puis supprime MON apport et émet', async () => {
      await service.unbring('e1', 'g1', 'zoe');

      expect(permissions.assert).toHaveBeenCalledWith('zoe', 'EVENT_GAME_BRING', { eventId: 'e1' });
      expectEventLockedFirst();
      expect(prisma.eventGameBring.deleteMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', boardGameId: 'g1', userId: 'zoe' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('Story 49.5 : purge les Envies orphelines dans la même transaction, APRÈS la suppression de l’apport', async () => {
      await service.unbring('e1', 'g1', 'zoe');

      expect(events.releaseOrphanEnviesInTx).toHaveBeenCalledWith(prisma, 'e1');
      expect(prisma.eventGameBring.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        events.releaseOrphanEnviesInTx.mock.invocationCallOrder[0],
      );
    });

    it('Story 49.5 : apporter un jeu ne purge aucune Envie', async () => {
      await service.bring('e1', 'g1', 'zoe');

      expect(events.releaseOrphanEnviesInTx).not.toHaveBeenCalled();
    });

    it('apport absent : rien à supprimer, succès', async () => {
      prisma.eventGameBring.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unbring('e1', 'g1', 'zoe')).resolves.toBeUndefined();
    });

    it('soirée annulée : 400, rien n’est supprimé', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      await expect(service.unbring('e1', 'g1', 'zoe')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.eventGameBring.deleteMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('non participant : 403 ; hôte : 403 ; jeu d’autrui : 404', async () => {
      await expect(service.unbring('e1', 'g1', 'intrus')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.unbring('e1', 'g1', 'host')).rejects.toBeInstanceOf(ForbiddenException);
      boardGames.ownedGameIds.mockResolvedValue(new Set());
      await expect(service.unbring('e1', 'g9', 'zoe')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.eventGameBring.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('listFor', () => {
    const rows = [
      { boardGameId: 'g2', user: { id: 'u2', pseudo: 'yan', displayName: 'Yan' } },
      { boardGameId: 'g1', user: { id: 'u1', pseudo: 'zoe', displayName: 'Zoé' } },
    ];

    it('lit les apports des seuls participants donnés, jeux par BoardGamesService, sans e-mail', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue(rows);
      boardGames.listByIds.mockResolvedValue([
        GAME,
        { ...GAME, id: 'g2', name: 'Brass', nameKey: 'brass' },
      ]);

      const result = await service.listFor('e1', ['host', 'u1', 'u2']);

      expect(prisma.eventGameBring.findMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', userId: { in: ['host', 'u1', 'u2'] } },
        select: {
          boardGameId: true,
          user: { select: { id: true, pseudo: true, displayName: true } },
        },
      });
      expect(boardGames.listByIds).toHaveBeenCalledWith(['g2', 'g1']);
      // Ordre des jeux (clé normalisée), pas celui des lignes.
      expect(result.map((b) => b.game.id)).toEqual(['g1', 'g2']);
      expect(result[0].bringer).toEqual({ userId: 'u1', pseudo: 'zoe', displayName: 'Zoé' });
      expect(JSON.stringify(result)).not.toContain('email');
    });

    it('deux jeux de même clé (doublon) : pas de départage par pseudo, l’ordre est celui de listByIds', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue([
        { boardGameId: 'g2', user: { id: 'u2', pseudo: 'yan', displayName: 'Yan' } },
        { boardGameId: 'g1', user: { id: 'u1', pseudo: 'zoe', displayName: 'Zoé' } },
      ]);
      boardGames.listByIds.mockResolvedValue([GAME, { ...GAME, id: 'g2' }]);

      const result = await service.listFor('e1', ['u1', 'u2']);

      expect(result.map((b) => b.bringer.pseudo)).toEqual(['zoe', 'yan']);
    });

    it('jeu retiré entre les deux lectures : l’apport est ignoré', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue(rows);
      boardGames.listByIds.mockResolvedValue([GAME]);

      expect((await service.listFor('e1', ['u1', 'u2'])).map((b) => b.game.id)).toEqual(['g1']);
    });

    it('aucun participant ou aucun apport : liste vide, jeux non lus', async () => {
      await expect(service.listFor('e1', [])).resolves.toEqual([]);
      expect(prisma.eventGameBring.findMany).not.toHaveBeenCalled();
      await expect(service.listFor('e1', ['u1'])).resolves.toEqual([]);
      expect(boardGames.listByIds).not.toHaveBeenCalled();
    });
  });

  describe('broughtCount', () => {
    const row = (event: {
      cancelledAt?: Date | null;
      kind?: string;
      closedAt?: Date | null;
      startDate?: Date | null;
      endDate?: Date | null;
    }) => ({
      event: {
        cancelledAt: event.cancelledAt ?? null,
        partie: {
          kind: event.kind ?? 'CAMPAGNE_EPISODIQUE',
          gameSystemId: 'ralliement',
          closedAt: event.closedAt ?? null,
        },
        seances: [{ startDate: event.startDate ?? day(3), endDate: event.endDate ?? day(3) }],
      },
    });

    it('ne compte que les soirées encore ouvertes (ni annulée, ni passée, ni rencontre close)', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue([
        row({}),
        row({ kind: 'ONE_SHOT' }),
        row({ cancelledAt: new Date() }),
        row({ startDate: day(-2), endDate: day(-2) }),
        row({ kind: 'ONE_SHOT', closedAt: new Date() }),
      ]);

      await expect(service.broughtCount('zoe', 'g1')).resolves.toEqual({ count: 2 });
      expect(boardGames.ownedGameIds).toHaveBeenCalledWith('zoe', ['g1']);
    });

    it('aucun apport : 0', async () => {
      await expect(service.broughtCount('zoe', 'g1')).resolves.toEqual({ count: 0 });
    });

    it('jeu d’autrui ou inconnu : 404, rien n’est compté', async () => {
      boardGames.ownedGameIds.mockResolvedValue(new Set());

      const refusal = service.broughtCount('zoe', 'g9');

      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow(BOARD_GAME_NOT_FOUND);
      expect(prisma.eventGameBring.findMany).not.toHaveBeenCalled();
    });
  });
});
