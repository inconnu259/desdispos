import { PollVoteCleanupService } from './poll-vote-cleanup.service';
import type { RendezVousDurationPort } from './ports/rendez-vous-duration.port';

/** Port des durées (Story 47.6) : `durationsOf` rend 1 pour un vote qu'on ne lui a pas décrit. */
const durationPort = (map: Record<string, number> = {}) => {
  const port = {
    durationsOf: jest.fn(async (ids: readonly string[]) => {
      return new Map(ids.map((id) => [id, map[id] ?? 1]));
    }),
    setDurationInTx: jest.fn(),
  };
  return port as typeof port & RendezVousDurationPort;
};

describe('PollVoteCleanupService — départ du groupe (Story 40.8)', () => {
  it('supprime les réponses de la personne sur les sondages OUVERTS de la partie seulement', async () => {
    const tx = { pollVote: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) } };
    await expect(
      new PollVoteCleanupService(durationPort()).removeOpenVotesInTx(tx as never, 'p1', 'u1'),
    ).resolves.toBe(4);
    expect(tx.pollVote.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', poll: { partieId: 'p1', status: 'OPEN' } },
    });
  });
});

describe('PollVoteCleanupService — sondages des conjonctions annulées (Story 42.3)', () => {
  it('ferme les sondages OUVERTS donnés, dans la transaction de l’appelant', async () => {
    const tx = { sessionPoll: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };

    await expect(
      new PollVoteCleanupService(durationPort()).closePollsInTx(tx as never, ['a', 'b']),
    ).resolves.toBe(2);
    expect(tx.sessionPoll.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });
  });

  it('aucun sondage : aucune écriture', async () => {
    const tx = { sessionPoll: { updateMany: jest.fn() } };

    await expect(
      new PollVoteCleanupService(durationPort()).closePollsInTx(tx as never, []),
    ).resolves.toBe(0);
    expect(tx.sessionPoll.updateMany).not.toHaveBeenCalled();
  });
});

describe('PollVoteCleanupService — plages déjà proposées (Story 46.3 / 47.6)', () => {
  it('lit les options des sondages OUVERTS de la partie, en clés « jour|créneau|durée » (UTC)', async () => {
    const db = {
      pollOption: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2030-03-04T00:00:00.000Z'), slot: 'EVENING', pollId: 'a' },
          { date: new Date('2030-03-06T00:00:00.000Z'), slot: 'MORNING', pollId: 'b' },
          { date: new Date('2030-03-07T00:00:00.000Z'), slot: 'MORNING', pollId: 'a' },
        ]),
      },
    };
    const port = durationPort({ a: 2 }); // « b » : durée 1 (vote sans séance ou d'un créneau)

    const keys = await new PollVoteCleanupService(port).openOptionKeys(db as never, 'p1');

    expect(db.pollOption.findMany).toHaveBeenCalledWith({
      where: { poll: { partieId: 'p1', status: 'OPEN' } },
      select: { date: true, slot: true, pollId: true },
    });
    // Une seule lecture des durées, sur les votes distincts.
    expect(port.durationsOf).toHaveBeenCalledTimes(1);
    expect([...port.durationsOf.mock.calls[0][0]].sort()).toEqual(['a', 'b']);
    expect([...keys].sort()).toEqual([
      '2030-03-04|EVENING|2',
      '2030-03-06|MORNING|1',
      '2030-03-07|MORNING|2',
    ]);
  });

  it('aucune option : un ensemble vide, sans lecture des durées', async () => {
    const db = { pollOption: { findMany: jest.fn().mockResolvedValue([]) } };
    const port = durationPort();
    const keys = await new PollVoteCleanupService(port).openOptionKeys(db as never, 'p1');
    expect(keys.size).toBe(0);
    expect(port.durationsOf).not.toHaveBeenCalled();
  });
});
