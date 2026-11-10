import { PartiesService } from '../../src/parties/parties.service';
import { Harness, body, isoDay, type TestUser } from './harness';

// Story 44.2 — `GET /me/open-polls` contre la vraie base : tous MES sondages ouverts, toutes familles, toutes
// échéances, sans jamais rien d'une partie dont je ne suis pas membre, d'un brouillon caché, d'une partie
// terminée ou masquée — et sans identité de votant. Plus : chaque écriture de sondage ou de vote prévient les
// listes de l'accueil (`notifyPartieSignalsChanged`), donc le canal `user:{id}` que la liste écoute.

type OpenPollLike = {
  pollId: string;
  partieId: string;
  family: string;
  seanceId: string;
  title: string;
  options: { optionId: string; date: string; myAnswer: string | null }[];
  eligibleCount: number;
  answeredCount: number;
  me: { eligible: boolean; answered: boolean };
  can: { propose: boolean; edit: boolean; choose: boolean; extend: boolean };
};
type ScenarioLike = {
  id: string;
  seances: { id: string; poll?: { id: string; options: { id: string }[] } }[];
};
type CardLike = { id: string; poll: { id: string; options: { id: string }[] } | null };

describe('Mes sondages ouverts — GET /me/open-polls (Story 44.2)', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let stranger: TestUser;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let jdrId: string;
  let groupId: string;
  let pollCourant: { id: string; options: { id: string }[] };
  let pollBrouillon: { id: string; options: { id: string }[] };
  let groupCard: CardLike;

  const mine = async (who: TestUser) =>
    body<OpenPollLike[]>(await who.agent.get('/me/open-polls').expect(200));
  const ids = (list: OpenPollLike[]) => list.map((p) => p.pollId);

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, stranger, admin, host, guest, third] = await Promise.all([
      h.createUser('op-mj'),
      h.createUser('op-joueur'),
      h.createUser('op-etranger'),
      h.createUser('op-admin'),
      h.createUser('op-hote'),
      h.createUser('op-invite'),
      h.createUser('op-tiers'),
    ]);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'op-jdr'));
    await h.addMember(jdrId, player);

    // Un scénario ouvert (vote visible) et un brouillon caché (vote invisible pour le joueur).
    const courant = body<ScenarioLike>(
      await mj.agent.post(`/parties/${jdrId}/scenarios`).send({ title: 'Courant' }).expect(201),
    );
    await mj.agent.patch(`/scenarios/${courant.id}/open`).expect(200);
    const brouillon = body<ScenarioLike>(
      await mj.agent.post(`/parties/${jdrId}/scenarios`).send({ title: 'Brouillon' }).expect(201),
    );
    pollCourant = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${courant.seances[0].id}/poll`)
        .send({
          options: [
            { date: isoDay(30), slot: 'EVENING' },
            { date: isoDay(95), slot: 'EVENING' },
          ],
        })
        .expect(201),
    ).seances[0].poll!;
    pollBrouillon = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${brouillon.seances[0].id}/poll`)
        .send({
          options: [
            { date: isoDay(31), slot: 'EVENING' },
            { date: isoDay(32), slot: 'EVENING' },
          ],
        })
        .expect(201),
    ).seances[0].poll!;

    // Un groupe : une conjonction à sondage, places limitées (hôte + invité inscrit votent, le tiers non).
    ({ id: groupId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'op-groupe',
      'ralliement',
    ));
    for (const who of [host, guest, third]) await h.addMember(groupId, who);
    groupCard = body<CardLike>(
      await host.agent
        .post(`/parties/${groupId}/events`)
        .send({
          title: 'Soirée plateaux',
          capacity: 4,
          pollOptions: [
            { date: isoDay(8), slot: 'EVENING' },
            { date: isoDay(9), slot: 'MORNING' },
          ],
          pollDeadline: isoDay(5),
        })
        .expect(201),
    );
    await guest.agent
      .post(
        `/scenarios/seances/${(groupCard as unknown as { seance: { id: string } }).seance.id}/inscription`,
      )
      .expect(201);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('un joueur voit le vote du scénario courant, quel que soit le mois, sans le brouillon caché', async () => {
    const list = await mine(player);
    const entry = list.find((p) => p.pollId === pollCourant.id)!;

    expect(ids(list)).not.toContain(pollBrouillon.id);
    expect(entry).toMatchObject({
      partieId: jdrId,
      family: 'jdr',
      title: 'Courant',
      me: { eligible: true, answered: false },
      // Le MJ + un membre.
      eligibleCount: 2,
      answeredCount: 0,
      can: { propose: false, edit: false, choose: false, extend: false },
    });
    // L'option à ~3 mois est bien servie (la période n'est plus un filtre de la liste).
    expect(entry.options.map((o) => o.date)).toEqual([isoDay(30), isoDay(95)]);
  });

  it('le MJ voit aussi le vote du brouillon, avec ses droits d’organisateur', async () => {
    const list = await mine(mj);
    expect(ids(list)).toEqual(expect.arrayContaining([pollCourant.id, pollBrouillon.id]));
    expect(list.find((p) => p.pollId === pollBrouillon.id)!.can).toEqual({
      propose: true,
      edit: true,
      choose: true,
      extend: false,
    });
  });

  it('un étranger ne voit aucun de ces votes', async () => {
    expect(ids(await mine(stranger))).toEqual([]);
  });

  it('mes réponses : « a répondu » en JDR exige une réponse à CHAQUE option, et ma réponse ressort', async () => {
    const [o1, o2] = pollCourant.options;
    await player.agent
      .post(`/parties/${jdrId}/poll/${pollCourant.id}/vote`)
      .send({ optionId: o1.id, answer: 'YES' })
      .expect(201);
    let entry = (await mine(player)).find((p) => p.pollId === pollCourant.id)!;
    expect(entry.me.answered).toBe(false);
    expect(entry.options.find((o) => o.optionId === o1.id)!.myAnswer).toBe('YES');

    await player.agent
      .post(`/parties/${jdrId}/poll/${pollCourant.id}/vote`)
      .send({ optionId: o2.id, answer: 'MAYBE' })
      .expect(201);
    entry = (await mine(player)).find((p) => p.pollId === pollCourant.id)!;
    expect(entry.me.answered).toBe(true);
    expect(entry.answeredCount).toBe(1);
  });

  it('groupe : listé avec les ayants droit de la conjonction — l’hôte et l’inscrit votent, le tiers le voit sans voter', async () => {
    for (const who of [host, guest, third]) {
      const entry = (await mine(who)).find((p) => p.pollId === groupCard.poll!.id)!;
      expect(entry).toMatchObject({ family: 'ralliement', partieId: groupId });
      expect(entry.eligibleCount).toBe(2);
    }
    expect((await mine(host)).find((p) => p.pollId === groupCard.poll!.id)!.me.eligible).toBe(true);
    expect((await mine(guest)).find((p) => p.pollId === groupCard.poll!.id)!.me.eligible).toBe(
      true,
    );
    expect((await mine(third)).find((p) => p.pollId === groupCard.poll!.id)!.me.eligible).toBe(
      false,
    );
    // Un administrateur qui n'est pas l'hôte voit le vote, sans droit d'organisateur.
    const adminEntry = (await mine(admin)).find((p) => p.pollId === groupCard.poll!.id)!;
    expect(adminEntry.can).toEqual({ propose: false, edit: false, choose: false, extend: false });
    expect((await mine(host)).find((p) => p.pollId === groupCard.poll!.id)!.can.extend).toBe(true);
  });

  it('aucune identité de votant dans la réponse', async () => {
    const json = JSON.stringify(await mine(player));
    for (const who of [mj, player, host, guest, third, admin]) {
      expect(json).not.toContain(who.id);
      expect(json).not.toContain(who.pseudo);
    }
  });

  it('une partie masquée par moi ou terminée disparaît de ma liste, celle des autres reste', async () => {
    const { id: autreId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'op-autre');
    await h.addMember(autreId, player);
    const sc = body<ScenarioLike>(
      await mj.agent.post(`/parties/${autreId}/scenarios`).send({ title: 'Autre' }).expect(201),
    );
    await mj.agent.patch(`/scenarios/${sc.id}/open`).expect(200);
    const poll = await jdrPollOn(sc);
    expect(ids(await mine(player))).toContain(poll.id);

    // Masquée par le joueur : absente pour lui seulement.
    await h.prisma.partieHidden.create({ data: { userId: player.id, partieId: autreId } });
    expect(ids(await mine(player))).not.toContain(poll.id);
    expect(ids(await mine(mj))).toContain(poll.id);
    await h.prisma.partieHidden.deleteMany({ where: { partieId: autreId } });

    // Terminée (clôturée par le MJ) : absente pour tous.
    await mj.agent.patch(`/parties/${autreId}/close`).expect(200);
    expect(ids(await mine(player))).not.toContain(poll.id);
    expect(ids(await mine(mj))).not.toContain(poll.id);
    expect(ids(await mine(player))).toContain(pollCourant.id);
  });

  async function jdrPollOn(scenario: ScenarioLike) {
    const res = await mj.agent
      .post(`/scenarios/seances/${scenario.seances[0].id}/poll`)
      .send({
        options: [
          { date: isoDay(20), slot: 'EVENING' },
          { date: isoDay(21), slot: 'EVENING' },
        ],
      })
      .expect(201);
    return body<ScenarioLike>(res).seances[0].poll!;
  }

  describe('chaque écriture de sondage ou de vote prévient les listes (notifyPartieSignalsChanged)', () => {
    let notify: jest.SpyInstance;

    beforeAll(() => {
      notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    });
    afterAll(() => notify.mockRestore());

    /** Joue `write` et exige qu'il ait prévenu les signaux de la partie `partieId`. */
    const notifies = async (partieId: string, write: () => Promise<unknown>) => {
      notify.mockClear();
      await write();
      expect(notify).toHaveBeenCalledWith(partieId, expect.anything());
    };

    it('JDR : créer le vote, voter, retirer, modifier les options, fixer la date', async () => {
      const sc = body<ScenarioLike>(
        await mj.agent.post(`/parties/${jdrId}/scenarios`).send({ title: 'Notifs' }).expect(201),
      );
      await mj.agent.patch(`/scenarios/${sc.id}/open`).expect(200);

      let poll!: { id: string; options: { id: string }[] };
      await notifies(jdrId, async () => {
        poll = await jdrPollOn(sc);
      });
      await notifies(jdrId, () =>
        player.agent
          .post(`/parties/${jdrId}/poll/${poll.id}/vote`)
          .send({ optionId: poll.options[0].id, answer: 'YES' })
          .expect(201),
      );
      await notifies(jdrId, () =>
        player.agent
          .delete(`/parties/${jdrId}/poll/${poll.id}/vote/${poll.options[0].id}`)
          .expect(200),
      );
      await notifies(jdrId, () =>
        mj.agent
          .put(`/parties/${jdrId}/poll/${poll.id}/options`)
          .send({
            options: [
              { date: isoDay(22), slot: 'MORNING' },
              { date: isoDay(23), slot: 'MORNING' },
            ],
          })
          .expect(200),
      );
      const optionId = (await mine(mj)).find((p) => p.pollId === poll.id)!.options[0].optionId;
      await notifies(jdrId, () =>
        mj.agent.patch(`/parties/${jdrId}/poll/${poll.id}/choose`).send({ optionId }).expect(200),
      );
    });

    it('groupe : créer la conjonction à sondage, voter, retirer, prolonger, fixer la date', async () => {
      let card!: CardLike & { seance: { id: string } };
      await notifies(groupId, async () => {
        card = body<typeof card>(
          await host.agent
            .post(`/parties/${groupId}/events`)
            .send({
              title: 'Notifs groupe',
              pollOptions: [
                { date: isoDay(10), slot: 'EVENING' },
                { date: isoDay(11), slot: 'MORNING' },
              ],
              pollDeadline: isoDay(6),
            })
            .expect(201),
        );
      });
      const poll = card.poll!;
      await notifies(groupId, () =>
        guest.agent
          .post(`/parties/${groupId}/poll/${poll.id}/vote`)
          .send({ optionId: poll.options[0].id, answer: 'YES' })
          .expect(201),
      );
      await notifies(groupId, () =>
        guest.agent
          .delete(`/parties/${groupId}/poll/${poll.id}/vote/${poll.options[0].id}`)
          .expect(200),
      );
      await notifies(groupId, () =>
        host.agent
          .patch(`/parties/${groupId}/poll/${poll.id}/extend`)
          .send({ expiresAt: isoDay(9) })
          .expect(200),
      );
      await notifies(groupId, () =>
        host.agent
          .patch(`/parties/${groupId}/poll/${poll.id}/choose`)
          .send({ optionId: poll.options[0].id })
          .expect(200),
      );
    });
  });
});
