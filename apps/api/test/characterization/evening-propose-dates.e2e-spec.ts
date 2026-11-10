import { Harness, body, isoDay, type TestUser } from './harness';

// Story 45.5 — proposer des dates pour une soirée isolée encore sans date (UJ-2), contre la vraie base : l'hôte
// ouvre le sondage par `PATCH /parties/:id/events/:eventId` (41.2, aucun changement serveur), la soirée quitte la
// liste « à dater », un invité accepté vote ; qui n'est pas l'hôte n'y touche pas (403, rien d'écrit).

type CardLike = {
  id: string;
  title: string;
  seance: { id: string; date: string | null } | null;
  poll: {
    id: string;
    expiresAt: string | null;
    eligibleVoterIds: string[];
    options: { id: string }[];
  } | null;
  can: { propose: boolean; edit: boolean; choose: boolean; extend: boolean };
};
type DatableLike = { seanceId: string; partieId: string };

describe('Soirée sans date — proposer des dates (Story 45.5)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let eveningId: string;
  let card: CardLike;

  const cards = async (who: TestUser) =>
    body<CardLike[]>(await who.agent.get(`/parties/${eveningId}/events/list`).expect(200));
  const datable = async (who: TestUser) =>
    body<DatableLike[]>(await who.agent.get('/me/datable-seances').expect(200)).filter(
      (d) => d.partieId === eveningId,
    );

  const payload = (over: Record<string, unknown> = {}) => ({
    title: card.title,
    pollOptions: [
      { date: isoDay(30), slot: 'EVENING' },
      { date: isoDay(37), slot: 'EVENING' },
      { date: isoDay(38), slot: 'AFTERNOON' },
    ],
    pollDeadline: isoDay(20),
    ...over,
  });

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, stranger] = await Promise.all([
      h.createUser('ev-hote'),
      h.createUser('ev-invite'),
      h.createUser('ev-etranger'),
    ]);
    ({ id: eveningId } = await h.createPartie(host, 'ONE_SHOT', 'ev-soiree', 'ralliement'));
    await h.addMember(eveningId, guest);
    [card] = await cards(host);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('avant : la soirée est sans date ni vote, l’hôte peut la proposer et la voit « à dater » ; l’invité et l’étranger non', async () => {
    expect(card.seance?.date).toBeNull();
    expect(card.poll).toBeNull();
    expect(card.can.propose).toBe(true);
    expect((await datable(host)).map((d) => d.seanceId)).toEqual([card.seance!.id]);
    expect(await datable(guest)).toEqual([]);
    expect(await datable(stranger)).toEqual([]);
    expect((await cards(guest))[0].can.propose).toBe(false);
  });

  it('refus : un membre non hôte et un étranger ne peuvent pas ouvrir le sondage, rien n’est écrit', async () => {
    await guest.agent.patch(`/parties/${eveningId}/events/${card.id}`).send(payload()).expect(403);
    await stranger.agent
      .patch(`/parties/${eveningId}/events/${card.id}`)
      .send(payload())
      .expect(403);

    const [after] = await cards(host);
    expect(after.poll).toBeNull();
    expect(after.seance?.date).toBeNull();
    expect((await datable(host)).length).toBe(1);
  });

  it('une fin de vote passée est refusée (400) et rien n’est écrit', async () => {
    await host.agent
      .patch(`/parties/${eveningId}/events/${card.id}`)
      .send(payload({ pollDeadline: isoDay(-1) }))
      .expect(400);
    expect((await cards(host))[0].poll).toBeNull();
  });

  it('l’hôte ouvre le sondage : fin et créneaux écrits, la soirée quitte la liste « à dater », l’invité peut voter', async () => {
    const res = body<CardLike>(
      await host.agent.patch(`/parties/${eveningId}/events/${card.id}`).send(payload()).expect(200),
    );

    expect(res.poll).not.toBeNull();
    expect(res.poll!.options).toHaveLength(3);
    expect(res.poll!.expiresAt).toBe(`${isoDay(20)}T23:59:59.999Z`);
    // Aucune date posée : c'est un sondage, pas une date fixée.
    expect(res.seance?.date).toBeNull();
    expect(res.poll!.eligibleVoterIds).toContain(host.id);

    expect(await datable(host)).toEqual([]);

    // Un invité éligible répond au sondage, comme à n'importe quelle conjonction.
    if (res.poll!.eligibleVoterIds.includes(guest.id)) {
      await guest.agent
        .post(`/parties/${eveningId}/poll/${res.poll!.id}/vote`)
        .send({ optionId: res.poll!.options[0].id, answer: 'YES' })
        .expect(201);
    }
  });
});
