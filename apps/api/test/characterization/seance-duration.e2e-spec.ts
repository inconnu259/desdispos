import { Harness, body, isoDay, type TestUser } from './harness';

// Story 47.1 (AD-10, AD-14) — la durée d'un rendez-vous (`Seance.durationSlots`) : déclarée à la création,
// jamais perdue par une modification qui ne la cite pas, corrigée avec la fin de la plage, bornée.

type CardLike = {
  id: string;
  title: string;
  seance: { id: string; date: string | null; slot: string | null; durationSlots: number } | null;
  poll: { id: string } | null;
};

describe('Durée d’un rendez-vous — Story 47.1', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let mj: TestUser;
  let groupId: string;
  let jdrId: string;

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, mj] = await Promise.all([
      h.createUser('dur-admin'),
      h.createUser('dur-hote'),
      h.createUser('dur-mj'),
    ]);
    ({ id: groupId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'dur-groupe',
      'ralliement',
    ));
    await h.addMember(groupId, host);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'dur-jdr'));
  });

  afterAll(async () => {
    await h?.close();
  });

  const create = (payload: object) => host.agent.post(`/parties/${groupId}/events`).send(payload);
  const dbSeance = (id: string) => h.prisma.seance.findUniqueOrThrow({ where: { id } });
  const key = (d: Date | null) => d?.toISOString().substring(0, 10) ?? null;

  describe('conjonction de groupe', () => {
    const base = { title: 'Week-end jeux', date: isoDay(8), slot: 'EVENING' };

    it('3 créneaux depuis un soir : la plage finit le lendemain après-midi, la carte porte la durée', async () => {
      const res = await create({ ...base, durationSlots: 3 }).expect(201);
      const card = body<CardLike>(res);

      expect(card.seance?.durationSlots).toBe(3);
      const row = await dbSeance(card.seance!.id);
      expect(key(row.startDate)).toBe(isoDay(8));
      expect(key(row.endDate)).toBe(isoDay(9));
      expect([row.startSlot, row.endSlot]).toEqual(['EVENING', 'AFTERNOON']);
      expect(row.durationSlots).toBe(3);
    });

    it('sans durée : 1 créneau, fin = départ', async () => {
      const card = body<CardLike>(await create(base).expect(201));

      const row = await dbSeance(card.seance!.id);
      expect(row.durationSlots).toBe(1);
      expect([key(row.endDate), row.endSlot]).toEqual([isoDay(8), 'EVENING']);
    });

    it('un PATCH sans durée sur un rendez-vous de 3 créneaux le laisse à 3', async () => {
      const card = body<CardLike>(await create({ ...base, durationSlots: 3 }).expect(201));

      await host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ ...base, title: 'Week-end renommé', lieu: 'Lyon' })
        .expect(200);

      const row = await dbSeance(card.seance!.id);
      expect(row.durationSlots).toBe(3);
      expect([key(row.endDate), row.endSlot]).toEqual([isoDay(9), 'AFTERNOON']);
    });

    it('corriger la durée d’une date fixée recalcule la fin et ré-arme le rappel', async () => {
      const card = body<CardLike>(await create({ ...base, durationSlots: 3 }).expect(201));
      await h.prisma.seance.update({
        where: { id: card.seance!.id },
        data: { reminderSentAt: new Date() },
      });

      await host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ ...base, durationSlots: 1 })
        .expect(200);

      const row = await dbSeance(card.seance!.id);
      expect(row.durationSlots).toBe(1);
      expect([key(row.endDate), row.endSlot]).toEqual([isoDay(8), 'EVENING']);
      expect(row.reminderSentAt).toBeNull();
    });

    it.each([
      ['46 créneaux', 46, '15 jours au plus'],
      ['0 créneau', 0, 'La durée doit être un entier'],
    ])('%s → 400 écrit, rien n’est créé', async (_label, durationSlots, message) => {
      const res = await create({ ...base, title: `Refusé ${durationSlots}`, durationSlots });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(message);
      const list = body<CardLike[]>(await host.agent.get(`/parties/${groupId}/events/list`));
      expect(list.some((c) => c.title === `Refusé ${durationSlots}`)).toBe(false);
    });

    it('un rendez-vous au vote ouvert : durée absente ou identique gardée ; changée (composer, Story 47.4), elle est écrite', async () => {
      const poll = {
        title: 'Sondage durée',
        pollOptions: [
          { date: isoDay(8), slot: 'EVENING' },
          { date: isoDay(9), slot: 'MORNING' },
        ],
        pollDeadline: isoDay(5),
      };
      const card = body<CardLike>(await create({ ...poll, durationSlots: 2 }).expect(201));
      expect((await dbSeance(card.seance!.id)).durationSlots).toBe(2);

      // Durée absente ou identique : la modification passe, la durée reste.
      await host.agent.patch(`/parties/${groupId}/events/${card.id}`).send(poll).expect(200);
      expect((await dbSeance(card.seance!.id)).durationSlots).toBe(2);

      // Story 47.4 : le composer d'un groupe passe par cette même route — la durée est écrite avec les créneaux.
      await host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ ...poll, durationSlots: 3 })
        .expect(200);
      expect((await dbSeance(card.seance!.id)).durationSlots).toBe(3);
    });
  });

  describe('séance du JDR', () => {
    const scenarioWithSeance = async () => {
      const res = await mj.agent
        .post(`/parties/${jdrId}/scenarios`)
        .send({ title: `Chapitre ${Math.random().toString(36).slice(2, 7)}` });
      expect(res.status).toBe(201);
      return body<{ id: string; seances: { id: string; durationSlots: number }[] }>(res);
    };

    it('ajouter une séance de 6 créneaux ; sans corps, 1 créneau ; le DTO porte la durée', async () => {
      const scenario = await scenarioWithSeance();

      const withDuration = body<{ seances: { id: string; durationSlots: number }[] }>(
        await mj.agent.post(`/scenarios/${scenario.id}/seances`).send({ durationSlots: 6 }).expect(201),
      );
      const plain = body<{ seances: { id: string; durationSlots: number }[] }>(
        await mj.agent.post(`/scenarios/${scenario.id}/seances`).expect(201),
      );

      expect(withDuration.seances.map((s) => s.durationSlots).sort()).toEqual([1, 6]);
      expect(plain.seances.map((s) => s.durationSlots).sort()).toEqual([1, 1, 6]);
    });

    it('la durée plafonne à 45 créneaux', async () => {
      const scenario = await scenarioWithSeance();

      const res = await mj.agent
        .post(`/scenarios/${scenario.id}/seances`)
        .send({ durationSlots: 46 });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('15 jours au plus');
    });

    it('les informations pratiques corrigent la durée ; sans durée, elle reste', async () => {
      const scenario = await scenarioWithSeance();
      const seanceId = scenario.seances[0].id;
      const infos = { heureRdv: null, lieu: 'Café', notePratique: null };

      await mj.agent
        .patch(`/scenarios/seances/${seanceId}/infos-pratiques`)
        .send({ ...infos, durationSlots: 4 })
        .expect(200);
      expect((await dbSeance(seanceId)).durationSlots).toBe(4);

      await mj.agent.patch(`/scenarios/seances/${seanceId}/infos-pratiques`).send(infos).expect(200);
      expect((await dbSeance(seanceId)).durationSlots).toBe(4);
    });
  });
});
