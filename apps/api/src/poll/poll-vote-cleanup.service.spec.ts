import { PollVoteCleanupService } from './poll-vote-cleanup.service';

describe('PollVoteCleanupService — départ du groupe (Story 40.8)', () => {
  it('supprime les réponses de la personne sur les sondages OUVERTS de la partie seulement', async () => {
    const tx = { pollVote: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) } };
    await expect(
      new PollVoteCleanupService().removeOpenVotesInTx(tx as never, 'p1', 'u1'),
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
      new PollVoteCleanupService().closePollsInTx(tx as never, ['a', 'b']),
    ).resolves.toBe(2);
    expect(tx.sessionPoll.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });
  });

  it('aucun sondage : aucune écriture', async () => {
    const tx = { sessionPoll: { updateMany: jest.fn() } };

    await expect(new PollVoteCleanupService().closePollsInTx(tx as never, [])).resolves.toBe(0);
    expect(tx.sessionPoll.updateMany).not.toHaveBeenCalled();
  });
});

describe('PollVoteCleanupService — créneaux déjà proposés (Story 46.3)', () => {
  it('lit les options des sondages OUVERTS de la partie, en clés « jour|créneau » (UTC)', async () => {
    const db = {
      pollOption: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2030-03-04T00:00:00.000Z'), slot: 'EVENING' },
          { date: new Date('2030-03-06T00:00:00.000Z'), slot: 'MORNING' },
        ]),
      },
    };

    const keys = await new PollVoteCleanupService().openOptionKeys(db as never, 'p1');

    expect(db.pollOption.findMany).toHaveBeenCalledWith({
      where: { poll: { partieId: 'p1', status: 'OPEN' } },
      select: { date: true, slot: true },
    });
    expect([...keys].sort()).toEqual(['2030-03-04|EVENING', '2030-03-06|MORNING']);
  });

  it('aucune option : un ensemble vide', async () => {
    const db = { pollOption: { findMany: jest.fn().mockResolvedValue([]) } };
    expect((await new PollVoteCleanupService().openOptionKeys(db as never, 'p1')).size).toBe(0);
  });
});
