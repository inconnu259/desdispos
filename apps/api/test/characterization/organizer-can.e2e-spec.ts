import { Harness, body, isoDay, type TestUser } from './harness';

// Story 44.1 (AD-4) — les droits d'organisateur (`can`) servis avec les cartes de conjonction et les
// séances du JDR : pour chaque famille et chaque action, `can.<droit> === true` ⇔ l'écriture
// correspondante n'est PAS refusée en 403. Le serveur reste juge ; `can` ne fait que le dire d'avance.

type CanLike = { propose: boolean; edit: boolean; choose: boolean; extend: boolean };
type CardLike = {
  id: string;
  hostId: string | null;
  can: CanLike;
  poll: { id: string; options: { id: string }[] } | null;
};
type ScenarioLike = {
  id: string;
  seances: { id: string; can: CanLike; poll?: { id: string; options: { id: string }[] } }[];
};

/** L'écriture a-t-elle franchi la garde de droits ? (n'importe quel statut sauf 403). */
const notRefused = (status: number) => status !== 403;

describe('Droits d’organisateur servis (`can`) — Story 44.1', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let mj: TestUser;
  let player: TestUser;
  let groupId: string;
  let jdrId: string;

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, stranger, mj, player] = await Promise.all([
      h.createUser('can-admin'),
      h.createUser('can-hote'),
      h.createUser('can-invite'),
      h.createUser('can-etranger'),
      h.createUser('can-mj'),
      h.createUser('can-joueur'),
    ]);
    ({ id: groupId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'can-groupe',
      'ralliement',
    ));
    for (const who of [host, guest]) await h.addMember(groupId, who);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'can-jdr'));
    await h.addMember(jdrId, player);
  });

  afterAll(async () => {
    await h?.close();
  });

  describe('conjonction de groupe', () => {
    const newCard = async () => {
      const res = await host.agent.post(`/parties/${groupId}/events`).send({
        title: 'Sondage can',
        pollOptions: [
          { date: isoDay(8), slot: 'EVENING' },
          { date: isoDay(9), slot: 'MORNING' },
        ],
        pollDeadline: isoDay(5),
      });
      expect(res.status).toBe(201);
      return body<CardLike>(res);
    };
    const cardSeenBy = async (who: TestUser, eventId: string) =>
      body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
        (c) => c.id === eventId,
      )!;

    it.each([
      ['l’hôte', () => host, { propose: true, edit: true, choose: true, extend: true }],
      ['un administrateur qui n’est pas l’hôte', () => admin, null],
      ['un simple membre', () => guest, null],
    ])(
      '%s : `can` dit exactement ce que les écritures acceptent',
      async (_label, who, expected) => {
        const viewer = who();
        const card = await newCard();
        const { can } = await cardSeenBy(viewer, card.id);
        expect(can).toEqual(
          expected ?? { propose: false, edit: false, choose: false, extend: false },
        );

        // extend (POLL_EXTEND) — la route partagée avec le JDR, décidée sur l'événement du sondage.
        const extend = await viewer.agent
          .patch(`/parties/${groupId}/poll/${card.poll!.id}/extend`)
          .send({ expiresAt: isoDay(9) });
        expect(notRefused(extend.status)).toBe(can.extend);

        // choose (POLL_CHOOSE)
        const choose = await viewer.agent
          .patch(`/parties/${groupId}/poll/${card.poll!.id}/choose`)
          .send({ optionId: card.poll!.options[0].id });
        expect(notRefused(choose.status)).toBe(can.choose);

        // edit et propose (EVENT_UPDATE) — remplacement complet de la conjonction.
        const edit = await viewer.agent.patch(`/parties/${groupId}/events/${card.id}`).send({
          title: 'Sondage can modifié',
          pollOptions: [
            { date: isoDay(10), slot: 'EVENING' },
            { date: isoDay(11), slot: 'MORNING' },
          ],
          pollDeadline: isoDay(6),
        });
        expect(notRefused(edit.status)).toBe(can.edit);
        expect(can.edit).toBe(can.propose);
      },
    );

    it('chaque carte de la liste porte `can` pour la personne qui lit (jamais celle d’un autre)', async () => {
      const card = await newCard();
      expect((await cardSeenBy(host, card.id)).can.edit).toBe(true);
      expect((await cardSeenBy(admin, card.id)).can.edit).toBe(false);
      expect((await cardSeenBy(guest, card.id)).can.choose).toBe(false);
    });
  });

  describe('séance de JDR', () => {
    let scenarioId: string;

    const seancesSeenBy = async (who: TestUser) =>
      body<ScenarioLike[]>(await who.agent.get(`/parties/${jdrId}/scenarios`).expect(200)).find(
        (s) => s.id === scenarioId,
      )!.seances;
    const addSeance = async () => {
      const res = await mj.agent.post(`/scenarios/${scenarioId}/seances`).expect(201);
      const seances = body<ScenarioLike>(res).seances;
      return seances[seances.length - 1].id;
    };
    const poll = (who: TestUser, seanceId: string) =>
      who.agent.post(`/scenarios/seances/${seanceId}/poll`).send({
        options: [
          { date: isoDay(30), slot: 'EVENING' },
          { date: isoDay(31), slot: 'EVENING' },
        ],
      });

    beforeAll(async () => {
      const created = await mj.agent
        .post(`/parties/${jdrId}/scenarios`)
        .send({ title: 'Scénario can' })
        .expect(201);
      scenarioId = body<ScenarioLike>(created).id;
      // Un joueur ne voit ni ne vote le vote d'un brouillon.
      await mj.agent.patch(`/scenarios/${scenarioId}/open`).expect(200);
    });

    it('le MJ : propose, modifie et fixe la date, jamais « prolonger » — et l’écriture le confirme', async () => {
      const seanceId = await addSeance();
      const mine = (await seancesSeenBy(mj)).find((s) => s.id === seanceId)!.can;
      expect(mine).toEqual({ propose: true, edit: true, choose: true, extend: false });

      const created = await poll(mj, seanceId);
      expect(notRefused(created.status)).toBe(mine.propose);
      const pollRow = body<ScenarioLike>(created).seances.find((s) => s.id === seanceId)!.poll!;

      const edit = await mj.agent.put(`/parties/${jdrId}/poll/${pollRow.id}/options`).send({
        options: [
          { date: isoDay(40), slot: 'MORNING' },
          { date: isoDay(41), slot: 'MORNING' },
        ],
      });
      expect(notRefused(edit.status)).toBe(mine.edit);

      const fresh = (await seancesSeenBy(mj)).find((s) => s.id === seanceId)!.poll!;
      const choose = await mj.agent
        .patch(`/parties/${jdrId}/poll/${fresh.id}/choose`)
        .send({ optionId: fresh.options[0].id });
      expect(notRefused(choose.status)).toBe(mine.choose);

      const extend = await mj.agent
        .patch(`/parties/${jdrId}/poll/${fresh.id}/extend`)
        .send({ expiresAt: isoDay(35) });
      expect(notRefused(extend.status)).toBe(mine.extend);
    });

    it('un joueur : aucun droit, et chaque écriture est refusée (403)', async () => {
      const seanceId = await addSeance();
      const created = await poll(mj, seanceId);
      const pollRow = body<ScenarioLike>(created).seances.find((s) => s.id === seanceId)!.poll!;

      const theirs = (await seancesSeenBy(player)).find((s) => s.id === seanceId)!.can;
      expect(theirs).toEqual({ propose: false, edit: false, choose: false, extend: false });

      const other = await addSeance();
      expect(notRefused((await poll(player, other)).status)).toBe(theirs.propose);
      const edit = await player.agent.put(`/parties/${jdrId}/poll/${pollRow.id}/options`).send({
        options: [
          { date: isoDay(40), slot: 'MORNING' },
          { date: isoDay(41), slot: 'MORNING' },
        ],
      });
      expect(notRefused(edit.status)).toBe(theirs.edit);
      const choose = await player.agent
        .patch(`/parties/${jdrId}/poll/${pollRow.id}/choose`)
        .send({ optionId: pollRow.options[0].id });
      expect(notRefused(choose.status)).toBe(theirs.choose);
      const extend = await player.agent
        .patch(`/parties/${jdrId}/poll/${pollRow.id}/extend`)
        .send({ expiresAt: isoDay(35) });
      expect(notRefused(extend.status)).toBe(theirs.extend);
    });

    it('un étranger ne lit rien : 403, donc aucun `can` à lui servir', async () => {
      await stranger.agent.get(`/parties/${jdrId}/scenarios`).expect(403);
    });
  });
});
