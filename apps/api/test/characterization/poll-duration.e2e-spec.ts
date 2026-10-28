import { Harness, body, isoDay, type TestUser } from './harness';

// Story 47.4 (AD-10) — proposer des plages : la durée du rendez-vous s'écrit avec les créneaux du vote, dans UNE
// transaction verrouillée (partie puis événement) ; une durée réellement changée recrée toutes les options (les
// réponses partent), une durée absente ou identique réconcilie comme avant. Une journée entière n'existe qu'à 1.

type PollLike = {
  id: string;
  durationSlots: number;
  options: { id: string; date: string; slot: string; votes: { userId: string }[] }[];
};
type ScenarioLike = {
  id: string;
  seances: { id: string; durationSlots: number; poll?: PollLike }[];
};
type CardLike = {
  id: string;
  seance: { id: string; durationSlots: number } | null;
  poll: { id: string; durationSlots: number; options: { id: string }[]; votes: unknown[] } | null;
};

// Story 47.5 (AD-11) — fixer une plage : la fixation prend les mêmes verrous qu'un changement de durée, relit le
// vote et l'option dessous, et écrit la plage entière (début → fin) ; un participant est occupé sur chaque créneau.

describe('Proposer des plages dans le composer — Story 47.4', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let host: TestUser;
  let member: TestUser;
  let jdrId: string;
  let groupId: string;

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, host, member] = await Promise.all([
      h.createUser('pl-mj'),
      h.createUser('pl-joueur'),
      h.createUser('pl-hote'),
      h.createUser('pl-membre'),
    ]);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'pl-jdr'));
    await h.addMember(jdrId, player);
    ({ id: groupId } = await h.createPartie(
      host,
      'CAMPAGNE_EPISODIQUE',
      'pl-groupe',
      'ralliement',
    ));
    await h.addMember(groupId, member);
  });

  afterAll(async () => {
    await h?.close();
  });

  const dbSeance = (id: string) => h.prisma.seance.findUniqueOrThrow({ where: { id } });
  const fridays = [
    { date: isoDay(10), slot: 'EVENING' },
    { date: isoDay(17), slot: 'EVENING' },
    { date: isoDay(24), slot: 'EVENING' },
  ];

  /** Une séance de JDR ouverte (les joueurs y votent), sans vote. */
  async function seance(title: string): Promise<string> {
    const sc = body<ScenarioLike>(
      await mj.agent.post(`/parties/${jdrId}/scenarios`).send({ title }).expect(201),
    );
    await mj.agent.patch(`/scenarios/${sc.id}/open`).expect(200);
    return sc.seances[0].id;
  }

  /** Une séance de JDR et son vote, d'une durée donnée ; le joueur répond oui à toutes les options. */
  async function votedPoll(title: string, durationSlots: number) {
    const seanceId = await seance(title);
    const created = body<ScenarioLike>(
      await mj.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({ options: fridays, durationSlots })
        .expect(201),
    );
    const poll = created.seances.find((s) => s.id === seanceId)!.poll!;
    for (const option of poll.options) {
      await player.agent
        .post(`/parties/${jdrId}/poll/${poll.id}/vote`)
        .send({ optionId: option.id, answer: 'YES' })
        .expect(201);
    }
    return { seanceId, poll };
  }

  const put = (who: TestUser, pollId: string, payload: Record<string, unknown>) =>
    who.agent.put(`/parties/${jdrId}/poll/${pollId}/options`).send(payload);
  const votesOf = (poll: PollLike) => poll.options.reduce((n, o) => n + o.votes.length, 0);

  describe('création d’un vote de JDR', () => {
    it('la durée est écrite avec le vote : la séance et le DTO la portent', async () => {
      const { seanceId, poll } = await votedPoll('Création', 6);

      expect(poll.durationSlots).toBe(6);
      expect((await dbSeance(seanceId)).durationSlots).toBe(6);
    });

    it('atomique : la création du vote échoue (journée entière sur 6 créneaux) → durée inchangée, aucun vote lié', async () => {
      const seanceId = await seance('Atomique');

      const res = await mj.agent.post(`/scenarios/seances/${seanceId}/poll`).send({
        options: [
          { date: isoDay(10), slot: 'FULL_DAY' },
          { date: isoDay(17), slot: 'EVENING' },
        ],
        durationSlots: 6,
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Une journée entière ne dure qu’un créneau');
      const row = await dbSeance(seanceId);
      expect(row.durationSlots).toBe(1);
      expect(row.pollId).toBeNull();
    });

    it('refus : un joueur ne crée pas de vote, même avec une durée ; une durée de 46 créneaux → 400', async () => {
      const seanceId = await seance('Refus création');

      await player.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({ options: fridays, durationSlots: 3 })
        .expect(403);
      const cap = await mj.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({ options: fridays, durationSlots: 46 });
      expect(cap.status).toBe(400);
      expect(JSON.stringify(cap.body)).toContain('15 jours au plus');
      expect((await dbSeance(seanceId)).durationSlots).toBe(1);
    });
  });

  describe('PUT …/options', () => {
    it('durée absente : elle reste de 3, les options gardées gardent leurs réponses', async () => {
      const { seanceId, poll } = await votedPoll('Garder', 3);

      const res = body<PollLike>(await put(mj, poll.id, { options: fridays }).expect(200));

      expect(res.durationSlots).toBe(3);
      expect(res.options.map((o) => o.id).sort()).toEqual(poll.options.map((o) => o.id).sort());
      expect(votesOf(res)).toBe(3);
      expect((await dbSeance(seanceId)).durationSlots).toBe(3);
    });

    it('durée changée (3 → 6), mêmes options : recréées, 0 réponse, relance ré-armée, DTO à 6', async () => {
      const { seanceId, poll } = await votedPoll('Changer', 3);
      await h.prisma.sessionPoll.update({
        where: { id: poll.id },
        data: { relanceSentAt: new Date() },
      });

      const res = body<PollLike>(
        await put(mj, poll.id, { options: fridays, durationSlots: 6 }).expect(200),
      );

      expect(res.durationSlots).toBe(6);
      expect(res.options).toHaveLength(3);
      expect(res.options.some((o) => poll.options.some((old) => old.id === o.id))).toBe(false);
      expect(votesOf(res)).toBe(0);
      expect((await dbSeance(seanceId)).durationSlots).toBe(6);
      const row = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: poll.id } });
      expect(row.relanceSentAt).toBeNull();
    });

    it('même durée renvoyée : aucune purge', async () => {
      const { poll } = await votedPoll('Même durée', 3);

      const res = body<PollLike>(
        await put(mj, poll.id, { options: fridays, durationSlots: 3 }).expect(200),
      );

      expect(votesOf(res)).toBe(3);
    });

    it('deux PUT 1 → 3 simultanés : une seule purge, le second réconcilie', async () => {
      const { poll } = await votedPoll('Concurrence', 1);

      const [a, b] = await Promise.all([
        put(mj, poll.id, { options: fridays, durationSlots: 3 }),
        put(mj, poll.id, { options: fridays, durationSlots: 3 }),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      const idsA = body<PollLike>(a)
        .options.map((o) => o.id)
        .sort();
      const idsB = body<PollLike>(b)
        .options.map((o) => o.id)
        .sort();
      // Une seconde purge aurait recréé d'autres identifiants que ceux servis par la première écriture.
      expect(idsA).toEqual(idsB);
      const final = await h.prisma.pollOption.findMany({ where: { pollId: poll.id } });
      expect(final.map((o) => o.id).sort()).toEqual(idsA);
    });

    it('journée entière avec une durée de 3 → 400 français, rien n’est écrit', async () => {
      const { seanceId, poll } = await votedPoll('Journée', 1);

      const res = await put(mj, poll.id, {
        options: [{ date: isoDay(10), slot: 'FULL_DAY' }, ...fridays.slice(1)],
        durationSlots: 3,
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Une journée entière ne dure qu’un créneau');
      expect((await dbSeance(seanceId)).durationSlots).toBe(1);
      const options = await h.prisma.pollOption.findMany({ where: { pollId: poll.id } });
      expect(options.map((o) => o.id).sort()).toEqual(poll.options.map((o) => o.id).sort());
    });

    it('refus : un joueur ne change pas la durée (403), une durée hors bornes → 400 ; rien ne bouge', async () => {
      const { seanceId, poll } = await votedPoll('Refus options', 2);

      await put(player, poll.id, { options: fridays, durationSlots: 6 }).expect(403);
      const zero = await put(mj, poll.id, { options: fridays, durationSlots: 0 });
      expect(zero.status).toBe(400);
      expect(JSON.stringify(zero.body)).toContain('La durée doit être un entier');

      expect((await dbSeance(seanceId)).durationSlots).toBe(2);
    });

    it('la liste de mes votes ouverts porte la durée du rendez-vous', async () => {
      const { poll } = await votedPoll('Mes votes', 4);

      const entries = body<{ pollId: string; durationSlots: number }[]>(
        await player.agent.get('/me/open-polls').expect(200),
      );

      expect(entries.find((e) => e.pollId === poll.id)?.durationSlots).toBe(4);
    });
  });

  describe('conjonction de groupe (PATCH …/events/:id)', () => {
    const pollPayload = {
      title: 'Week-end jeux',
      pollOptions: fridays,
      pollDeadline: isoDay(5),
    };

    async function votedCard(): Promise<CardLike> {
      const card = body<CardLike>(
        await host.agent.post(`/parties/${groupId}/events`).send(pollPayload).expect(201),
      );
      for (const option of card.poll!.options) {
        await member.agent
          .post(`/parties/${groupId}/poll/${card.poll!.id}/vote`)
          .send({ optionId: option.id, answer: 'YES' })
          .expect(201);
      }
      return card;
    }

    it('composer sur un vote ouvert, durée 1 → 2 : options purgées et recréées, la carte porte 2', async () => {
      const card = await votedCard();
      expect(card.poll!.durationSlots).toBe(1);

      const res = body<CardLike>(
        await host.agent
          .patch(`/parties/${groupId}/events/${card.id}`)
          .send({ ...pollPayload, durationSlots: 2 })
          .expect(200),
      );

      expect(res.poll!.durationSlots).toBe(2);
      expect(res.seance!.durationSlots).toBe(2);
      expect(res.poll!.options.some((o) => card.poll!.options.some((old) => old.id === o.id))).toBe(
        false,
      );
      expect(res.poll!.votes).toEqual([]);
    });

    it('durée absente : réconciliation, les réponses restent', async () => {
      const card = await votedCard();

      const res = body<CardLike>(
        await host.agent
          .patch(`/parties/${groupId}/events/${card.id}`)
          .send(pollPayload)
          .expect(200),
      );

      expect(res.poll!.options.map((o) => o.id).sort()).toEqual(
        card.poll!.options.map((o) => o.id).sort(),
      );
      expect(res.poll!.votes).toHaveLength(3);
    });

    it('refus : un membre qui n’est pas l’hôte ne change pas la durée (403)', async () => {
      const card = await votedCard();

      await member.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ ...pollPayload, durationSlots: 3 })
        .expect(403);

      expect((await dbSeance(card.seance!.id)).durationSlots).toBe(1);
    });
  });

  describe('fixer une plage (Story 47.5)', () => {
    type SlotLike = { date: string; slot: string; members: { userId: string; status: string }[] };

    /** Les week-ends sont proposés du vendredi soir ; on fixe le deuxième. */
    it('fixer le 2e des 3 week-ends : séance début/fin = la plage, vote clos, participants occupés sur chaque créneau', async () => {
      const { seanceId, poll } = await votedPoll('Fixer la plage', 6);
      const second = poll.options.find((o) => o.date.startsWith(isoDay(17)))!;
      const viewer = await h.createUser('pl-vue');
      const { id: viewId } = await h.createPartie(viewer, 'ONE_SHOT', 'pl-vue-partie');
      await h.addMember(viewId, player);

      await mj.agent
        .patch(`/parties/${jdrId}/poll/${poll.id}/choose`)
        .send({ optionId: second.id })
        .expect(200);

      const row = await dbSeance(seanceId);
      const key = (d: Date | null) => d?.toISOString().substring(0, 10);
      expect([key(row.startDate), row.startSlot]).toEqual([isoDay(17), 'EVENING']);
      expect([key(row.endDate), row.endSlot]).toEqual([isoDay(19), 'AFTERNOON']);
      expect(row.durationSlots).toBe(6);
      expect(row.reminderSentAt).toBeNull();
      const closed = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: poll.id } });
      expect(closed.status).toBe('CLOSED');

      const slots = body<SlotLike[]>(
        await viewer.agent
          .get(`/parties/${viewId}/available-slots`)
          .query({ from: isoDay(17), to: isoDay(19) })
          .expect(200),
      );
      const statusOf = (date: string, slot: string) =>
        slots.find((x) => x.date === date && x.slot === slot)?.members.find((m) => m.userId === player.id)
          ?.status;
      const covered: [string, string][] = [
        [isoDay(17), 'EVENING'],
        [isoDay(18), 'MORNING'],
        [isoDay(18), 'AFTERNOON'],
        [isoDay(18), 'EVENING'],
        [isoDay(19), 'MORNING'],
        [isoDay(19), 'AFTERNOON'],
      ];
      for (const [date, slot] of covered) expect(statusOf(date, slot)).toBe('UNAVAILABLE');
      // La plage s'arrête à son dernier créneau, et ne commence pas avant son départ.
      expect(statusOf(isoDay(19), 'EVENING')).toBe('UNKNOWN');
      expect(statusOf(isoDay(17), 'AFTERNOON')).toBe('UNKNOWN');
    });

    it('concurrence : fixer et changer la durée en même temps sont sérialisés (la date lit une option fraîche)', async () => {
      const { seanceId, poll } = await votedPoll('Fixer en concurrence', 6);
      const target = poll.options.find((o) => o.date.startsWith(isoDay(10)))!;

      const [fix, change] = await Promise.all([
        mj.agent.patch(`/parties/${jdrId}/poll/${poll.id}/choose`).send({ optionId: target.id }),
        put(mj, poll.id, { options: fridays, durationSlots: 3 }),
      ]);

      const row = await dbSeance(seanceId);
      if (fix.status === 200) {
        // La fixation est passée la première : la plage écrite est celle de la durée de 6.
        expect(row.durationSlots).toBe(6);
        expect(row.endDate?.toISOString().substring(0, 10)).toBe(isoDay(12));
        expect(change.status).toBe(400);
      } else {
        // Le changement de durée a recréé les options avant : l'ancienne n'existe plus, rien n'est écrit.
        expect([fix.status, change.status]).toEqual([404, 200]);
        expect(row.startDate).toBeNull();
        expect(row.durationSlots).toBe(3);
        const stillOpen = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: poll.id } });
        expect(stillOpen.status).toBe('OPEN');
      }
    });

    it('option disparue (purgée par un changement de durée) : 404 « Option introuvable », rien n’est écrit', async () => {
      const { seanceId, poll } = await votedPoll('Option purgée', 3);
      const stale = poll.options[1];
      await put(mj, poll.id, { options: fridays, durationSlots: 6 }).expect(200);

      const res = await mj.agent
        .patch(`/parties/${jdrId}/poll/${poll.id}/choose`)
        .send({ optionId: stale.id });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Option introuvable');
      expect((await dbSeance(seanceId)).startDate).toBeNull();
    });

    it('refus : un joueur ne fixe pas la date (403), rien n’est écrit', async () => {
      const { seanceId, poll } = await votedPoll('Refus fixer', 6);

      await player.agent
        .patch(`/parties/${jdrId}/poll/${poll.id}/choose`)
        .send({ optionId: poll.options[0].id })
        .expect(403);

      expect((await dbSeance(seanceId)).startDate).toBeNull();
    });

    it('groupe : option disparue (purgée par une durée changée) → 404, la conjonction reste sans date', async () => {
      const card = body<CardLike>(
        await host.agent
          .post(`/parties/${groupId}/events`)
          .send({ title: 'Plage purgée', pollOptions: fridays, pollDeadline: isoDay(5) })
          .expect(201),
      );
      const stale = card.poll!.options[0];
      await host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ title: 'Plage purgée', pollOptions: fridays, pollDeadline: isoDay(5), durationSlots: 2 })
        .expect(200);

      const res = await host.agent
        .patch(`/parties/${groupId}/poll/${card.poll!.id}/choose`)
        .send({ optionId: stale.id });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Option introuvable');
      expect((await dbSeance(card.seance!.id)).startDate).toBeNull();
    });
  });
});
