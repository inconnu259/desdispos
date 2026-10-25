import { Harness, body, isoDay, type TestUser } from './harness';

// Story 45.4 — la fin du vote contre la vraie base : choisie ou proposée par `defaultPollDeadline` à la création
// d'un vote de JDR, repoussée par la mutation des options (qui EST la prolongation du MJ), refusée si elle est
// passée, MJ seul ; et, pour une conjonction, la changer ré-arme la relance de la veille.

type ScenarioLike = {
  id: string;
  seances: {
    id: string;
    poll?: { id: string; expiresAt: string | null; options: { id: string }[] };
  }[];
};
type CardLike = { id: string; poll: { id: string; expiresAt: string | null } | null };

const endOf = (key: string) => `${key}T23:59:59.999Z`;

describe('Fin du vote — création, options, relance (Story 45.4)', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let host: TestUser;
  let jdrId: string;
  let groupId: string;

  async function seance(title: string): Promise<string> {
    const sc = body<ScenarioLike>(
      await mj.agent.post(`/parties/${jdrId}/scenarios`).send({ title }).expect(201),
    );
    await mj.agent.patch(`/scenarios/${sc.id}/open`).expect(200);
    return sc.seances[0].id;
  }

  const two = (a: number, b: number) => [
    { date: isoDay(a), slot: 'EVENING' },
    { date: isoDay(b), slot: 'MORNING' },
  ];

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, host] = await Promise.all([
      h.createUser('fv-mj'),
      h.createUser('fv-joueur'),
      h.createUser('fv-hote'),
    ]);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'fv-jdr'));
    await h.addMember(jdrId, player);
    ({ id: groupId } = await h.createPartie(
      host,
      'CAMPAGNE_EPISODIQUE',
      'fv-groupe',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('JDR, sans fin donnée : la fin proposée (dans 14 jours pour des créneaux lointains), plus un délai fixe', async () => {
    const id = await seance('Lointain');
    const res = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${id}/poll`)
        .send({ options: two(60, 61) })
        .expect(201),
    );
    expect(res.seances[0].poll!.expiresAt).toBe(endOf(isoDay(14)));
  });

  it('JDR, sans fin donnée, premier créneau proche : la veille du premier créneau', async () => {
    const id = await seance('Proche');
    const res = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${id}/poll`)
        .send({ options: two(5, 9) })
        .expect(201),
    );
    expect(res.seances[0].poll!.expiresAt).toBe(endOf(isoDay(4)));
  });

  it('JDR, fin choisie : la fin de CE jour — après le premier créneau, c’est permis', async () => {
    const id = await seance('Choisie');
    const res = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${id}/poll`)
        .send({ options: two(5, 9), expiresAt: isoDay(7) })
        .expect(201),
    );
    expect(res.seances[0].poll!.expiresAt).toBe(endOf(isoDay(7)));
  });

  it('JDR, fin passée ou format invalide : 400 en français, aucun vote créé', async () => {
    const id = await seance('Refus');
    const past = await mj.agent
      .post(`/scenarios/seances/${id}/poll`)
      .send({ options: two(5, 9), expiresAt: isoDay(-1) })
      .expect(400);
    expect(body<{ message: string }>(past).message).toBe(
      "L'échéance du vote ne peut pas être passée",
    );
    await mj.agent
      .post(`/scenarios/seances/${id}/poll`)
      .send({ options: two(5, 9), expiresAt: '31/12/2026' })
      .expect(400);
    // La séance n'a toujours pas de vote : un vote correct passe ensuite.
    await mj.agent
      .post(`/scenarios/seances/${id}/poll`)
      .send({ options: two(5, 9), expiresAt: isoDay(6) })
      .expect(201);
  });

  describe('mutation des options', () => {
    let poll: { id: string; options: { id: string }[] };

    beforeAll(async () => {
      const id = await seance('Options');
      poll = body<ScenarioLike>(
        await mj.agent
          .post(`/scenarios/seances/${id}/poll`)
          .send({ options: two(10, 11), expiresAt: isoDay(3) })
          .expect(201),
      ).seances[0].poll!;
    });

    const put = (who: TestUser, payload: Record<string, unknown>) =>
      who.agent.put(`/parties/${jdrId}/poll/${poll.id}/options`).send(payload);

    it('repousser la fin du vote la change (c’est la prolongation du MJ) ; sans `expiresAt` elle est gardée', async () => {
      const res = body<{ expiresAt: string }>(
        await put(mj, { options: two(10, 11), expiresAt: isoDay(8) }).expect(200),
      );
      expect(res.expiresAt).toBe(endOf(isoDay(8)));

      const kept = body<{ expiresAt: string }>(await put(mj, { options: two(10, 11) }).expect(200));
      expect(kept.expiresAt).toBe(endOf(isoDay(8)));
    });

    it('une nouvelle fin déjà passée : 400, la fin actuelle reste', async () => {
      await put(mj, { options: two(10, 11), expiresAt: isoDay(-2) }).expect(400);
      const kept = body<{ expiresAt: string }>(await put(mj, { options: two(10, 11) }).expect(200));
      expect(kept.expiresAt).toBe(endOf(isoDay(8)));
    });

    it('refus : un joueur ne change ni les créneaux ni la fin du vote', async () => {
      await put(player, { options: two(10, 11), expiresAt: isoDay(20) }).expect(403);
      const kept = body<{ expiresAt: string }>(await put(mj, { options: two(10, 11) }).expect(200));
      expect(kept.expiresAt).toBe(endOf(isoDay(8)));
    });

    it('un vote dont la fin est passée (en base) accepte la correction de ses créneaux à fin inchangée, et rouvre en repoussant la fin', async () => {
      const pastEnd = new Date(`${isoDay(-1)}T23:59:59.999Z`);
      await h.prisma.sessionPoll.update({ where: { id: poll.id }, data: { expiresAt: pastEnd } });

      await put(mj, { options: two(12, 13), expiresAt: isoDay(-1) }).expect(200);
      const reopened = body<{ expiresAt: string }>(
        await put(mj, { options: two(12, 13), expiresAt: isoDay(5) }).expect(200),
      );
      expect(reopened.expiresAt).toBe(endOf(isoDay(5)));
    });
  });

  it('conjonction : changer la fin du vote remet `relanceSentAt` à vide (ré-arme la relance) ; la laisser ne change rien', async () => {
    const card = body<CardLike>(
      await host.agent
        .post(`/parties/${groupId}/events`)
        .send({
          title: 'Soirée relance',
          pollOptions: [
            { date: isoDay(30), slot: 'EVENING' },
            { date: isoDay(31), slot: 'MORNING' },
          ],
          pollDeadline: isoDay(20),
        })
        .expect(201),
    );
    const pollId = card.poll!.id;
    await h.prisma.sessionPoll.update({
      where: { id: pollId },
      data: { relanceSentAt: new Date() },
    });
    const update = (deadline: string) =>
      host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({
          title: 'Soirée relance',
          pollOptions: [
            { date: isoDay(30), slot: 'EVENING' },
            { date: isoDay(31), slot: 'MORNING' },
          ],
          pollDeadline: deadline,
        })
        .expect(200);
    const relance = async () =>
      (await h.prisma.sessionPoll.findUnique({ where: { id: pollId } }))!.relanceSentAt;

    await update(isoDay(20));
    expect(await relance()).not.toBeNull();

    await update(isoDay(22));
    expect(await relance()).toBeNull();
  });
});
