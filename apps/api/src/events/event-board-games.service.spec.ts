import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { testGrant } from '../common/test-utils/grant';
import type { BoardGamesService } from '../board-games/board-games.service';
import {
  RALLIEMENT_UNAVAILABLE_MESSAGE,
  type PermissionService,
} from '../permissions/permission.service';
import { EventBoardGamesService } from './event-board-games.service';
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
    service = new EventBoardGamesService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      boardGames as unknown as BoardGamesService,
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
    expect(result).toEqual({ games: [GAME], participantsCount: 3 });
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

    expect(result).toEqual({ games: [], participantsCount: 2 });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  it('rencontre isolée close : aucun jeu', async () => {
    permissions.assert.mockResolvedValue(testGrant({ ...evening, closedAt: new Date() }, 'member'));
    events.boardGamesBasis.mockResolvedValue(basis({ memberIds: ['host'] }));

    expect(await service.list('e1', 'u1')).toEqual({ games: [], participantsCount: 1 });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
  });

  it('sans hôte (compte supprimé) : aucun jeu', async () => {
    events.boardGamesBasis.mockResolvedValue(
      basis({ hostId: null, inscriptions: [{ userId: 'a', status: 'CONFIRMED' }] }),
    );

    expect(await service.list('e1', 'u1')).toEqual({ games: [], participantsCount: 1 });
    expect(boardGames.listOfOwner).not.toHaveBeenCalled();
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
