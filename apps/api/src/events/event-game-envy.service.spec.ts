import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { callArg } from '../common/test-utils/jest-typed';
import { testGrant } from '../common/test-utils/grant';
import {
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import type { PrismaService } from '../prisma/prisma.service';
import { partieTopic, type RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  ENVY_NOT_ON_SITE_MESSAGE,
  ENVY_NOT_PARTICIPANT_MESSAGE,
  EventGameEnvyService,
} from './event-game-envy.service';
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

describe('EventGameEnvyService (Story 49.5)', () => {
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
    eventGameEnvy: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
  };
  let permissions: { assert: jest.Mock };
  let events: { boardGamesBasis: jest.Mock; onSiteNameKeysInTx: jest.Mock };
  let realtime: { emit: jest.Mock };
  let service: EventGameEnvyService;

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
      eventGameEnvy: {
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
      onSiteNameKeysInTx: jest.fn().mockResolvedValue(new Set(['azul'])),
    };
    realtime = { emit: jest.fn() };
    service = new EventGameEnvyService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
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

  describe('envy', () => {
    it('décide EVENT_GAME_ENVY, verrouille l’événement, relit sur la transaction, vérifie le nom sur place, écrit puis émet', async () => {
      await service.envy('e1', 'azul', 'zoe');

      expect(permissions.assert).toHaveBeenCalledWith('zoe', 'EVENT_GAME_ENVY', {
        eventId: 'e1',
      });
      expectEventLockedFirst();
      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p1', isolated: false },
        prisma,
      );
      expect(events.onSiteNameKeysInTx).toHaveBeenCalledWith(prisma, 'e1', 'host');
      expect(prisma.eventGameEnvy.upsert).toHaveBeenCalledWith({
        where: { eventId_userId_nameKey: { eventId: 'e1', userId: 'zoe', nameKey: 'azul' } },
        create: { eventId: 'e1', userId: 'zoe', nameKey: 'azul' },
        update: {},
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('l’hôte a aussi le droit d’avoir envie (il est participant)', async () => {
      await service.envy('e1', 'azul', 'host');

      expect(prisma.eventGameEnvy.upsert).toHaveBeenCalledTimes(1);
    });

    it('rencontre isolée : un membre de la partie signale une envie', async () => {
      permissions.assert.mockResolvedValue(testGrant(evening, 'member'));
      events.boardGamesBasis.mockResolvedValue(basis({ memberIds: ['host', 'zoe'] }));

      await service.envy('e1', 'azul', 'zoe');

      expect(events.boardGamesBasis).toHaveBeenCalledWith(
        'e1',
        { id: 'p2', isolated: true },
        prisma,
      );
      expect(prisma.eventGameEnvy.upsert).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['conjonction annulée', group, { cancelledAt: new Date() }, CANCELLED_EVENT_MESSAGE],
      ['soirée isolée annulée', evening, { cancelledAt: new Date() }, EVENING_CANCELLED_MESSAGE],
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

      const refusal = service.envy('e1', 'azul', 'zoe');

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(message);
      expect(prisma.eventGameEnvy.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('rencontre isolée close : 400 « terminée »', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ ...evening, closedAt: new Date() }, 'member'),
      );
      events.boardGamesBasis.mockResolvedValue(basis({ memberIds: ['zoe'] }));

      await expect(service.envy('e1', 'azul', 'zoe')).rejects.toThrow(EVENING_FINISHED_MESSAGE);
      expect(prisma.eventGameEnvy.upsert).not.toHaveBeenCalled();
    });

    it('soirée à la fois annulée et passée : l’annulation est dite en premier', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ cancelledAt: new Date(), startDate: day(-2), endDate: day(-2) }),
      );

      await expect(service.envy('e1', 'azul', 'zoe')).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
    });

    it('soirée fermée ET appelant non participant : la fermeture passe avant (400, pas 403)', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      await expect(service.envy('e1', 'azul', 'intrus')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('membre non inscrit : 403, rien n’est écrit', async () => {
      const refusal = service.envy('e1', 'azul', 'intrus');

      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(ENVY_NOT_PARTICIPANT_MESSAGE);
      expect(prisma.eventGameEnvy.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('place seulement RÉSERVÉE : 403 comme un non-participant', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [{ userId: 'zoe', status: 'RESERVED' }] }),
      );

      await expect(service.envy('e1', 'azul', 'zoe')).rejects.toThrow(ENVY_NOT_PARTICIPANT_MESSAGE);
      expect(prisma.eventGameEnvy.upsert).not.toHaveBeenCalled();
    });

    it('non participant ET nom hors place : la participation passe avant (403, pas 400)', async () => {
      events.onSiteNameKeysInTx.mockResolvedValue(new Set());

      await expect(service.envy('e1', 'azul', 'intrus')).rejects.toBeInstanceOf(ForbiddenException);
      expect(events.onSiteNameKeysInTx).not.toHaveBeenCalled();
    });

    it('nom sur place par aucune source : 400 en français, rien n’est écrit ni émis', async () => {
      events.onSiteNameKeysInTx.mockResolvedValue(new Set(['go']));

      const refusal = service.envy('e1', 'azul', 'zoe');

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(ENVY_NOT_ON_SITE_MESSAGE);
      expect(prisma.eventGameEnvy.upsert).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une autre erreur d’écriture remonte telle quelle', async () => {
      prisma.eventGameEnvy.upsert.mockRejectedValue(new Error('boum'));

      await expect(service.envy('e1', 'azul', 'zoe')).rejects.toThrow('boum');
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('événement disparu entre la décision et le verrou : 404', async () => {
      events.boardGamesBasis.mockResolvedValue(null);

      await expect(service.envy('e1', 'azul', 'zoe')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('partie de JDR (ou genre de partie sans jeux) : 403, rien n’est verrouillé', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p3', kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }, 'player'),
      );

      const refusal = service.envy('e1', 'azul', 'zoe');

      await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('refus du droit de rôle (étranger) : propagé, rien n’est lu', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('Pas accès'));

      await expect(service.envy('e1', 'azul', 'intrus')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('une émission en échec est consignée, l’envie reste un succès', async () => {
      realtime.emit.mockImplementation(() => {
        throw new Error('flux coupé');
      });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(service.envy('e1', 'azul', 'zoe')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('unenvy', () => {
    it('mêmes décisions de soirée sous le verrou, puis supprime MON envie et émet', async () => {
      await service.unenvy('e1', 'azul', 'zoe');

      expect(permissions.assert).toHaveBeenCalledWith('zoe', 'EVENT_GAME_ENVY', {
        eventId: 'e1',
      });
      expectEventLockedFirst();
      expect(prisma.eventGameEnvy.deleteMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', userId: 'zoe', nameKey: 'azul' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('ne revérifie ni la participation ni le « sur place » : on retire sa propre ligne', async () => {
      events.onSiteNameKeysInTx.mockResolvedValue(new Set());
      events.boardGamesBasis.mockResolvedValue(basis({ inscriptions: [] }));

      await expect(service.unenvy('e1', 'azul', 'zoe')).resolves.toBeUndefined();

      expect(events.onSiteNameKeysInTx).not.toHaveBeenCalled();
      expect(prisma.eventGameEnvy.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('envie absente : rien à supprimer, succès', async () => {
      prisma.eventGameEnvy.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unenvy('e1', 'azul', 'zoe')).resolves.toBeUndefined();
    });

    it.each([
      ['conjonction annulée', group, { cancelledAt: new Date() }, CANCELLED_EVENT_MESSAGE],
      ['conjonction passée', group, { startDate: day(-2), endDate: day(-2) }, PAST_ROSTER_MESSAGE],
      ['soirée isolée annulée', evening, { cancelledAt: new Date() }, EVENING_CANCELLED_MESSAGE],
    ])('%s : 400, rien n’est supprimé', async (_label, partie, over, message) => {
      permissions.assert.mockResolvedValue(testGrant(partie, 'member'));
      events.boardGamesBasis.mockResolvedValue(basis(over));

      await expect(service.unenvy('e1', 'azul', 'zoe')).rejects.toThrow(message);
      expect(prisma.eventGameEnvy.deleteMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('partie de JDR : 403, rien n’est verrouillé', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p3', kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }, 'player'),
      );

      await expect(service.unenvy('e1', 'azul', 'zoe')).rejects.toThrow(
        RALLIEMENT_UNAVAILABLE_MESSAGE,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('listFor', () => {
    const row = (nameKey: string, id: string, pseudo: string, displayName = pseudo) => ({
      nameKey,
      user: { id, pseudo, displayName },
    });

    it('lit les Envies des seuls participants donnés sur les seuls noms sur place, sans e-mail', async () => {
      prisma.eventGameEnvy.findMany.mockResolvedValue([row('azul', 'u1', 'zoe', 'Zoé')]);

      const result = await service.listFor('e1', ['host', 'u1'], new Set(['azul', 'go']));

      expect(prisma.eventGameEnvy.findMany).toHaveBeenCalledWith({
        where: {
          eventId: 'e1',
          userId: { in: ['host', 'u1'] },
          nameKey: { in: ['azul', 'go'] },
        },
        select: {
          nameKey: true,
          user: { select: { id: true, pseudo: true, displayName: true } },
        },
      });
      expect(result).toEqual([
        { nameKey: 'azul', users: [{ userId: 'u1', pseudo: 'zoe', displayName: 'Zoé' }] },
      ]);
      expect(JSON.stringify(result)).not.toContain('email');
    });

    it('ordre stable : par clé, puis par pseudo, quel que soit l’ordre des lignes', async () => {
      prisma.eventGameEnvy.findMany.mockResolvedValue([
        row('go', 'u3', 'yan'),
        row('azul', 'u1', 'zoe'),
        row('azul', 'u2', 'alix'),
        row('go', 'u4', 'bob'),
      ]);

      const result = await service.listFor('e1', ['u1', 'u2', 'u3', 'u4'], new Set(['azul', 'go']));

      expect(result.map((e) => e.nameKey)).toEqual(['azul', 'go']);
      expect(result[0].users.map((u) => u.pseudo)).toEqual(['alix', 'zoe']);
      expect(result[1].users.map((u) => u.pseudo)).toEqual(['bob', 'yan']);
    });

    it('aucun participant ou aucun nom sur place : liste vide, rien n’est lu', async () => {
      await expect(service.listFor('e1', [], new Set(['azul']))).resolves.toEqual([]);
      await expect(service.listFor('e1', ['u1'], new Set())).resolves.toEqual([]);
      expect(prisma.eventGameEnvy.findMany).not.toHaveBeenCalled();
    });
  });
});
