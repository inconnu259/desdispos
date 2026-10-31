import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { testGrant } from '../common/test-utils/grant';
import type { BoardGamesService } from '../board-games/board-games.service';
import {
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import { EventBoardGamesService } from './event-board-games.service';
import type { EventGameBringService } from './event-game-bring.service';
import type { EventGameEnvyService } from './event-game-envy.service';
import type { EventGameExclusionService } from './event-game-exclusion.service';
import type { EventBoardGamesBasis, EventsService } from './events.service';

const GAME = {
  id: 'g1',
  name: 'Azul',
  nameKey: 'azul',
  minPlayers: 2,
  maxPlayers: 4,
  durationMin: 40,
  createdAt: '2026-10-29T10:00:00.000Z',
};

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe('EventBoardGamesService (Story 49.1)', () => {
  let permissions: { assert: jest.Mock };
  let events: { boardGamesBasis: jest.Mock };
  let boardGames: { listOfOwner: jest.Mock };
  let brings: { listFor: jest.Mock };
  let exclusions: { excludedIds: jest.Mock };
  let envies: { listFor: jest.Mock };
  let service: EventBoardGamesService;

  const group = {
    id: 'p1',
    kind: 'CAMPAGNE_EPISODIQUE',
    gameSystemId: 'ralliement',
    closedAt: null,
  };
  const evening = { id: 'p2', kind: 'ONE_SHOT', gameSystemId: 'ralliement', closedAt: null };

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
    permissions = { assert: jest.fn().mockResolvedValue(testGrant(group, 'member')) };
    events = { boardGamesBasis: jest.fn().mockResolvedValue(basis()) };
    boardGames = { listOfOwner: jest.fn().mockResolvedValue([GAME]) };
    brings = { listFor: jest.fn().mockResolvedValue([]) };
    exclusions = { excludedIds: jest.fn().mockResolvedValue(new Set()) };
    envies = { listFor: jest.fn().mockResolvedValue([]) };
    service = new EventBoardGamesService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      boardGames as unknown as BoardGamesService,
      brings as unknown as EventGameBringService,
      exclusions as unknown as EventGameExclusionService,
      envies as unknown as EventGameEnvyService,
    );
  });

  it('décide PARTIE_READ sur l’événement, lit la base avec la nature de la partie, puis les jeux de l’hôte', async () => {
    events.boardGamesBasis.mockResolvedValue(
      basis({
        inscriptions: [
          { userId: 'a', status: 'CONFIRMED' },
          { userId: 'b', status: 'CONFIRMED' },
        ],
      }),
    );

    const result = await service.list('e1', 'u1');

    expect(permissions.assert).toHaveBeenCalledWith('u1', 'PARTIE_READ', { eventId: 'e1' });
    expect(events.boardGamesBasis).toHaveBeenCalledWith('e1', { id: 'p1', isolated: false });
    expect(boardGames.listOfOwner).toHaveBeenCalledWith('host');
    expect(result).toEqual({ games: [GAME], brings: [], participantsCount: 3, envies: [] });
  });

  it('une place réservée n’est pas comptée', async () => {
    events.boardGamesBasis.mockResolvedValue(
      basis({
        inscriptions: [
          { userId: 'a', status: 'CONFIRMED' },
          { userId: 'b', status: 'RESERVED' },
        ],
      }),
    );

    expect((await service.list('e1', 'u1')).participantsCount).toBe(2);
  });

  it('rencontre isolée : N vient des membres de la partie', async () => {
    permissions.assert.mockResolvedValue(testGrant(evening, 'member'));
    events.boardGamesBasis.mockResolvedValue(basis({ memberIds: ['host', 'm1', 'm2'] }));

    const result = await service.list('e1', 'u1');

    expect(events.boardGamesBasis).toHaveBeenCalledWith('e1', { id: 'p2', isolated: true });
    expect(result.participantsCount).toBe(3);
    expect(result.games).toEqual([GAME]);
  });

  it.each([
    ['annulée', { cancelledAt: new Date() }],
    ['passée', { startDate: day(-2), endDate: day(-2) }],
  ])('soirée %s : aucun jeu, N tel que calculé, jeux de l’hôte non lus', async (_label, over) => {
    events.boardGamesBasis.mockResolvedValue(
      basis({ ...over, inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
    );

    const result = await service.list('e1', 'u1');

    expect(result).toEqual({ games: [], brings: [], participantsCount: 2, envies: [] });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  it('rencontre isolée close : aucun jeu', async () => {
    permissions.assert.mockResolvedValue(testGrant({ ...evening, closedAt: new Date() }, 'member'));
    events.boardGamesBasis.mockResolvedValue(basis({ memberIds: ['host'] }));

    expect(await service.list('e1', 'u1')).toEqual({
      games: [],
      brings: [],
      participantsCount: 1,
      envies: [],
    });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  it('sans hôte (compte supprimé) : aucun jeu d’hôte', async () => {
    events.boardGamesBasis.mockResolvedValue(
      basis({ hostId: null, inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
    );

    expect(await service.list('e1', 'u1')).toEqual({
      games: [],
      brings: [],
      participantsCount: 1,
      envies: [],
    });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  describe('apports (Story 49.2)', () => {
    const BRING = {
      game: { ...GAME, id: 'g2', name: 'Azul', nameKey: 'azul' },
      bringer: { userId: 'a', pseudo: 'zoe', displayName: 'Zoé' },
    };

    it('lit les apports des participants actuels, dans l’ordre fourni par EventGameBringService', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
      );
      brings.listFor.mockResolvedValue([BRING]);

      const result = await service.list('e1', 'u1');

      expect(brings.listFor).toHaveBeenCalledWith('e1', ['host', 'a']);
      expect(result.brings).toEqual([BRING]);
    });

    it('une place réservée n’est pas un participant : ses apports ne sont pas demandés', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [{ userId: 'b', status: 'RESERVED' }] }),
      );

      await service.list('e1', 'u1');

      expect(brings.listFor).toHaveBeenCalledWith('e1', ['host']);
    });

    it('soirée fermée : aucun apport, rien n’est lu', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      expect((await service.list('e1', 'u1')).brings).toEqual([]);
      expect(brings.listFor).not.toHaveBeenCalled();
    });

    it('sans hôte : pas de jeux d’hôte, mais les apports des participants restent sur place', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ hostId: null, inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
      );
      brings.listFor.mockResolvedValue([BRING]);

      expect(await service.list('e1', 'u1')).toEqual({
        games: [],
        brings: [BRING],
        participantsCount: 1,
        envies: [],
      });
    });
  });

  describe('jeux écartés par l’hôte (Story 49.4)', () => {
    const AZUL = GAME;
    const BRASS = { ...GAME, id: 'g2', name: 'Brass', nameKey: 'brass' };

    beforeEach(() => {
      boardGames.listOfOwner.mockResolvedValue([AZUL, BRASS]);
      exclusions.excludedIds.mockResolvedValue(new Set(['g2']));
    });

    it('l’hôte : `games` sans le jeu écarté, `excludedGames` avec', async () => {
      const result = await service.list('e1', 'host');

      expect(exclusions.excludedIds).toHaveBeenCalledWith('e1');
      expect(result).toEqual({
        games: [AZUL],
        brings: [],
        participantsCount: 1,
        envies: [],
        excludedGames: [BRASS],
      });
    });

    it('un autre lecteur : `games` sans le jeu écarté, et la clé `excludedGames` est ABSENTE', async () => {
      const result = await service.list('e1', 'u1');

      expect(result.games).toEqual([AZUL]);
      expect('excludedGames' in result).toBe(false);
      expect(JSON.stringify(result)).not.toContain('Brass');
    });

    it('l’hôte sans rien d’écarté : `excludedGames` vaut []', async () => {
      exclusions.excludedIds.mockResolvedValue(new Set());

      const result = await service.list('e1', 'host');

      expect(result.games).toEqual([AZUL, BRASS]);
      expect(result.excludedGames).toEqual([]);
    });

    it('soirée fermée : l’hôte reçoit `excludedGames: []`, les autres pas la clé, rien n’est lu', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      expect(await service.list('e1', 'host')).toEqual({
        games: [],
        brings: [],
        participantsCount: 1,
        envies: [],
        excludedGames: [],
      });
      const other = await service.list('e1', 'u1');
      expect('excludedGames' in other).toBe(false);
      expect(exclusions.excludedIds).not.toHaveBeenCalled();
    });

    it('sans hôte (compte supprimé) : aucun lecteur n’est l’hôte, pas de clé `excludedGames`', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ hostId: null }));

      expect('excludedGames' in (await service.list('e1', 'u1'))).toBe(false);
    });
  });

  describe('Envies (Story 49.5)', () => {
    const AZUL = GAME;
    const BRASS = { ...GAME, id: 'g2', name: 'Brass', nameKey: 'brass' };
    const ENVY = { nameKey: 'azul', users: [{ userId: 'a', pseudo: 'zoe', displayName: 'Zoé' }] };

    it('lit les Envies des participants actuels sur les noms sur place (jeux de l’hôte, écarts exclus, apports inclus)', async () => {
      events.boardGamesBasis.mockResolvedValue(
        basis({ inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
      );
      boardGames.listOfOwner.mockResolvedValue([AZUL, BRASS]);
      exclusions.excludedIds.mockResolvedValue(new Set(['g2']));
      brings.listFor.mockResolvedValue([
        {
          game: { ...GAME, id: 'g3', name: 'Catane', nameKey: 'catane' },
          bringer: { userId: 'a', pseudo: 'zoe', displayName: 'Zoé' },
        },
      ]);
      envies.listFor.mockResolvedValue([ENVY]);

      const result = await service.list('e1', 'u1');

      expect(envies.listFor).toHaveBeenCalledWith('e1', ['host', 'a'], new Set(['azul', 'catane']));
      expect(result.envies).toEqual([ENVY]);
    });

    it('un nom écarté chez l’hôte mais apporté reste sur place', async () => {
      boardGames.listOfOwner.mockResolvedValue([AZUL]);
      exclusions.excludedIds.mockResolvedValue(new Set(['g1']));
      brings.listFor.mockResolvedValue([
        {
          game: { ...GAME, id: 'g9', nameKey: 'azul' },
          bringer: { userId: 'a', pseudo: 'zoe', displayName: 'Zoé' },
        },
      ]);

      await service.list('e1', 'u1');

      expect(envies.listFor).toHaveBeenCalledWith('e1', ['host'], new Set(['azul']));
    });

    it('soirée fermée : `envies` vaut [] et rien n’est lu', async () => {
      events.boardGamesBasis.mockResolvedValue(basis({ cancelledAt: new Date() }));

      expect((await service.list('e1', 'u1')).envies).toEqual([]);
      expect(envies.listFor).not.toHaveBeenCalled();
    });

    it('l’hôte reçoit aussi les Envies', async () => {
      envies.listFor.mockResolvedValue([ENVY]);

      expect((await service.list('e1', 'host')).envies).toEqual([ENVY]);
    });
  });

  it('partie de JDR : refusée (403), rien n’est lu', async () => {
    permissions.assert.mockResolvedValue(
      testGrant({ id: 'p3', kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }, 'player'),
    );

    const refusal = service.list('e1', 'u1');

    await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
    await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
    expect(events.boardGamesBasis).not.toHaveBeenCalled();
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  it('refus du droit : propagé tel quel, rien n’est lu', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException('Accès refusé'));

    await expect(service.list('e1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(events.boardGamesBasis).not.toHaveBeenCalled();
  });

  it('événement disparu entre la décision et la lecture : 404', async () => {
    events.boardGamesBasis.mockResolvedValue(null);

    await expect(service.list('e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
