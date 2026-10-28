import { Harness, body, isoDay, keysOf, type TestUser } from './harness';

// Tests de caractérisation (Story 37.1) : figent, au niveau HTTP, le comportement actuel des
// séances — capacité et gel des inscriptions, choix de date par vote, indisponibilité dérivée des
// séances d'autres parties (AD-9). Référence de toutes les stories de l'épic 37.

type PollOptionLike = { id: string; date: string; slot: string };
type SeanceDtoLike = Record<string, unknown> & {
  id: string;
  poll?: { id: string; options: PollOptionLike[] };
  inscription?: { inscrits: { userId: string }[] };
};
type ScenarioDtoLike = { id: string; status: string; seances: SeanceDtoLike[] };
type PartieDtoLike = { nextSessionDate: string | null; nextSessionSlot: string | null };
type SignalsLike = Record<string, { signals: string[] }>;
type AvailableSlotLike = {
  date: string;
  slot: string;
  members: { userId: string; status: string }[];
};

const MAX_INSCRITS_MESSAGE = 'Cette séance a atteint son nombre maximal d’inscrits';
const INSCRIPTIONS_FIGEES_MESSAGE =
  'Cette séance a déjà une date validée — les inscriptions sont figées';

/** Ajoute un scénario à une campagne et renvoie le scénario et sa première séance. */
async function addScenario(
  mj: TestUser,
  partieId: string,
  title: string,
): Promise<{ scenario: ScenarioDtoLike; seanceId: string }> {
  const res = await mj.agent.post(`/parties/${partieId}/scenarios`).send({ title }).expect(201);
  const scenario = body<ScenarioDtoLike>(res);
  return { scenario, seanceId: scenario.seances[0].id };
}

/** Crée un vote de date sur une séance puis fait choisir l'option d'index `chosen` au MJ. */
async function datePourVote(
  mj: TestUser,
  partieId: string,
  seanceId: string,
  options: { date: string; slot: string }[],
  chosen: number,
): Promise<void> {
  const pollRes = await mj.agent
    .post(`/scenarios/seances/${seanceId}/poll`)
    .send({ options })
    .expect(201);
  const seance = body<ScenarioDtoLike>(pollRes).seances.find((s) => s.id === seanceId);
  const poll = seance?.poll;
  if (!poll) throw new Error('Vote absent de la séance après création');
  const option = poll.options.find(
    (o) => o.date.startsWith(options[chosen].date) && o.slot === options[chosen].slot,
  );
  if (!option) throw new Error('Option choisie introuvable dans le vote');
  await mj.agent
    .patch(`/parties/${partieId}/poll/${poll.id}/choose`)
    .send({ optionId: option.id })
    .expect(200);
}

describe('Caractérisation JDR — séances (Story 37.1)', () => {
  let h: Harness;
  let mj: TestUser;
  let joueur1: TestUser;
  let joueur2: TestUser;

  beforeAll(async () => {
    h = await Harness.start();
    [mj, joueur1, joueur2] = await Promise.all([
      h.createUser('mj'),
      h.createUser('joueur'),
      h.createUser('joueur'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  describe('inscriptions en campagne épisodique', () => {
    let partieId: string;

    beforeAll(async () => {
      ({ id: partieId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'inscriptions'));
      await h.addMember(partieId, joueur1);
      await h.addMember(partieId, joueur2);
    });

    it('fige : capacité max 1 — 1er inscrit 201, 2e refusé en 409, réinscription du 1er idempotente', async () => {
      const { scenario, seanceId } = await addScenario(mj, partieId, 'Épisode capacité');
      await mj.agent.patch(`/scenarios/${scenario.id}/open`).expect(200);
      await mj.agent
        .patch(`/scenarios/seances/${seanceId}/capacite`)
        .send({ inscriptionMin: 1, inscriptionMax: 1 })
        .expect(200);

      const first = await joueur1.agent
        .post(`/scenarios/seances/${seanceId}/inscription`)
        .expect(201);
      const afterFirst = body<ScenarioDtoLike>(first).seances.find((s) => s.id === seanceId);
      expect(afterFirst?.inscription?.inscrits.map((i) => i.userId)).toEqual([joueur1.id]);

      const second = await joueur2.agent
        .post(`/scenarios/seances/${seanceId}/inscription`)
        .expect(409);
      expect(body<{ message: string }>(second).message).toBe(MAX_INSCRITS_MESSAGE);

      const again = await joueur1.agent
        .post(`/scenarios/seances/${seanceId}/inscription`)
        .expect(201);
      const afterAgain = body<ScenarioDtoLike>(again).seances.find((s) => s.id === seanceId);
      expect(afterAgain?.inscription?.inscrits.map((i) => i.userId)).toEqual([joueur1.id]);
    });

    it('fige : une séance datée par vote gèle inscription et désinscription (400), et sa forme de SeanceDto', async () => {
      const jourChoisi = isoDay(20);
      const autreJour = isoDay(21);
      const { scenario, seanceId } = await addScenario(mj, partieId, 'Épisode gelé');
      await mj.agent.patch(`/scenarios/${scenario.id}/open`).expect(200);
      await mj.agent
        .patch(`/scenarios/seances/${seanceId}/capacite`)
        .send({ inscriptionMin: 1, inscriptionMax: 3 })
        .expect(200);
      await joueur1.agent.post(`/scenarios/seances/${seanceId}/inscription`).expect(201);

      await datePourVote(
        mj,
        partieId,
        seanceId,
        [
          { date: jourChoisi, slot: 'AFTERNOON' },
          { date: autreJour, slot: 'EVENING' },
        ],
        0,
      );

      const inscription = await joueur2.agent
        .post(`/scenarios/seances/${seanceId}/inscription`)
        .expect(400);
      expect(body<{ message: string }>(inscription).message).toBe(INSCRIPTIONS_FIGEES_MESSAGE);

      const desinscription = await joueur1.agent
        .delete(`/scenarios/seances/${seanceId}/inscription`)
        .expect(400);
      expect(body<{ message: string }>(desinscription).message).toBe(INSCRIPTIONS_FIGEES_MESSAGE);

      // Forme de SeanceDto d'une séance avec capacité et vote scellé (celle de ce test).
      const scenariosRes = await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200);
      const seance = body<ScenarioDtoLike[]>(scenariosRes)
        .flatMap((s) => s.seances)
        .find((s) => s.id === seanceId);
      expect(seance).toBeDefined();
      expect(keysOf(seance)).toEqual([
        'can',
        'compteRendu',
        'createdAt',
        'dateValidee',
        'durationSlots',
        'endDate',
        'endSlot',
        'heureRdv',
        'id',
        'inscription',
        'lieu',
        'notePratique',
        'poll',
        'scenarioId',
        'slotValidee',
      ]);
      expect(keysOf(seance!.inscription)).toEqual(['dateValidee', 'inscrits', 'max', 'min']);
      expect(seance!.dateValidee).toBe(`${jourChoisi}T00:00:00.000Z`);
      expect(seance!.slotValidee).toBe('AFTERNOON');
    });
  });

  describe('choix de date par vote', () => {
    it('fige : le choix du MJ pose nextSessionDate/nextSessionSlot de la partie', async () => {
      const jourMatin = isoDay(10);
      const jourSoir = isoDay(11);
      const { id: partieId } = await h.createPartie(mj, 'ONE_SHOT', 'vote');
      const scenariosRes = await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;

      const before = await mj.agent.get(`/parties/${partieId}`).expect(200);
      expect(body<PartieDtoLike>(before).nextSessionDate).toBeNull();
      expect(body<PartieDtoLike>(before).nextSessionSlot).toBeNull();

      await datePourVote(
        mj,
        partieId,
        seanceId,
        [
          { date: jourMatin, slot: 'MORNING' },
          { date: jourSoir, slot: 'EVENING' },
        ],
        1,
      );

      const after = await mj.agent.get(`/parties/${partieId}`).expect(200);
      expect(body<PartieDtoLike>(after).nextSessionDate).toBe(`${jourSoir}T00:00:00.000Z`);
      expect(body<PartieDtoLike>(after).nextSessionSlot).toBe('EVENING');
    });

    it('fige : une séance datée par vote sans compte-rendu fait apparaître COMPTE_RENDU_NON_REDIGE côté MJ', async () => {
      const { id: partieId } = await h.createPartie(mj, 'ONE_SHOT', 'vote-cr');
      const scenariosRes = await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;

      const before = body<SignalsLike>(await mj.agent.get('/me/party-signals').expect(200));
      expect(before[partieId].signals).not.toContain('COMPTE_RENDU_NON_REDIGE');

      await datePourVote(
        mj,
        partieId,
        seanceId,
        [
          { date: isoDay(12), slot: 'AFTERNOON' },
          { date: isoDay(13), slot: 'EVENING' },
        ],
        0,
      );

      const after = body<SignalsLike>(await mj.agent.get('/me/party-signals').expect(200));
      expect(after[partieId].signals).toContain('COMPTE_RENDU_NON_REDIGE');
    });
  });

  describe('indisponibilité dérivée des séances (AD-9)', () => {
    it("fige : une séance datée d'une autre partie rend le joueur indisponible, sans révéler cette partie", async () => {
      const mjA = await h.createUser('mj-a');
      const mjB = await h.createUser('mj-b');
      const joueur = await h.createUser('joueur-ab');

      const { id: partieA } = await h.createPartie(mjA, 'CAMPAGNE_LINEAIRE', 'partie-a');
      const { id: partieB, name: nameB } = await h.createPartie(mjB, 'ONE_SHOT', 'partie-b');
      await h.addMember(partieA, joueur);
      await h.addMember(partieB, joueur);

      const day = isoDay(15);
      const lendemain = isoDay(16);
      const scenariosRes = await mjB.agent.get(`/parties/${partieB}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;
      await datePourVote(
        mjB,
        partieB,
        seanceId,
        [
          { date: day, slot: 'EVENING' },
          { date: lendemain, slot: 'EVENING' },
        ],
        0,
      );

      const res = await mjA.agent
        .get(`/parties/${partieA}/available-slots`)
        .query({ from: day, to: day })
        .expect(200);
      const slots = body<AvailableSlotLike[]>(res);
      const statusOf = (slot: string) =>
        slots
          .find((s) => s.date === day && s.slot === slot)
          ?.members.find((m) => m.userId === joueur.id)?.status;

      expect(statusOf('EVENING')).toBe('UNAVAILABLE');
      expect(statusOf('MORNING')).toBe('UNKNOWN');
      expect(statusOf('AFTERNOON')).toBe('UNKNOWN');

      // Aucune identité de la partie B (ni id, ni nom, ni MJ) dans la réponse.
      const raw = JSON.stringify(slots);
      expect(raw).not.toContain(partieB);
      expect(raw).not.toContain(nameB);
      expect(raw).not.toContain(mjB.id);
      expect(raw).not.toContain(mjB.pseudo);
    });
  });

  describe('plage de plusieurs créneaux (Story 47.2)', () => {
    it('un rendez-vous de 3 créneaux rend ses participants indisponibles sur chacun, du soir au lendemain, et le calendrier porte sa fin', async () => {
      const mjA = await h.createUser('mj-plage-a');
      const mjB = await h.createUser('mj-plage-b');
      const joueur = await h.createUser('joueur-plage');
      const { id: partieA } = await h.createPartie(mjA, 'CAMPAGNE_LINEAIRE', 'plage-a');
      const { id: partieB } = await h.createPartie(mjB, 'ONE_SHOT', 'plage-b');
      await h.addMember(partieA, joueur);
      await h.addMember(partieB, joueur);

      const day = isoDay(15);
      const lendemain = isoDay(16);
      const scenariosRes = await mjB.agent.get(`/parties/${partieB}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;
      // La durée se règle avant le vote (sous un vote ouvert sans date elle est figée).
      await mjB.agent
        .patch(`/scenarios/seances/${seanceId}/infos-pratiques`)
        .send({ heureRdv: null, lieu: null, notePratique: null, durationSlots: 3 })
        .expect(200);
      await datePourVote(
        mjB,
        partieB,
        seanceId,
        [
          { date: day, slot: 'EVENING' },
          { date: isoDay(17), slot: 'EVENING' },
        ],
        0,
      );

      const slots = body<AvailableSlotLike[]>(
        await mjA.agent
          .get(`/parties/${partieA}/available-slots`)
          .query({ from: day, to: lendemain })
          .expect(200),
      );
      const statusOf = (date: string, slot: string) =>
        slots.find((s) => s.date === date && s.slot === slot)?.members.find((m) => m.userId === joueur.id)
          ?.status;
      expect(statusOf(day, 'EVENING')).toBe('UNAVAILABLE');
      expect(statusOf(lendemain, 'MORNING')).toBe('UNAVAILABLE');
      expect(statusOf(lendemain, 'AFTERNOON')).toBe('UNAVAILABLE');
      // La plage s'arrête à son dernier créneau.
      expect(statusOf(lendemain, 'EVENING')).toBe('UNKNOWN');
      expect(statusOf(day, 'AFTERNOON')).toBe('UNKNOWN');

      // Le calendrier personnel le sert sur son SECOND jour, avec sa fin, et pas après.
      const cal = async (from: string, to: string) =>
        body<{ 'mes-seances': { seanceId: string; date: string; endDate: string; endSlot: string }[] }>(
          await mjB.agent.get('/me/calendar').query({ from, to }).expect(200),
        )['mes-seances'];
      const onSecondDay = await cal(lendemain, lendemain);
      expect(onSecondDay).toHaveLength(1);
      expect(onSecondDay[0]).toMatchObject({ date: day, endDate: lendemain, endSlot: 'AFTERNOON' });
      expect(await cal(isoDay(18), isoDay(19))).toHaveLength(0);
    });
  });

  describe('fenêtres déjà proposées par un vote ouvert (Story 46.3)', () => {
    it("le MJ ne reçoit plus une fenêtre qu'un vote ouvert propose ; le joueur garde sa vue agrégée", async () => {
      const mjA = await h.createUser('mj-fenetres');
      const joueur = await h.createUser('joueur-fenetres');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'fenetres');
      await h.addMember(partieId, joueur);
      const scenariosRes = await mjA.agent.get(`/parties/${partieId}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;

      const proposed = { date: isoDay(21), slot: 'EVENING' };
      const range = { from: isoDay(20), to: isoDay(24) };
      const read = async (user: TestUser) =>
        body<{ date: string; slot: string; members?: unknown }[]>(
          await user.agent.get(`/parties/${partieId}/available-slots`).query(range).expect(200),
        );
      const has = (list: { date: string; slot: string }[]) =>
        list.some((s) => s.date === proposed.date && s.slot === proposed.slot);

      // Avant le vote : la fenêtre est servie aux deux.
      expect(has(await read(mjA))).toBe(true);
      expect(has(await read(joueur))).toBe(true);

      await mjA.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({ options: [proposed, { date: isoDay(22), slot: 'MORNING' }] })
        .expect(201);

      // Vote ouvert : le MJ ne la reçoit plus (ni l'autre option) ; le joueur, si — vue agrégée intacte.
      const mjList = await read(mjA);
      expect(has(mjList)).toBe(false);
      expect(mjList.some((s) => s.date === isoDay(22) && s.slot === 'MORNING')).toBe(false);
      expect(mjList.every((s) => 'members' in s)).toBe(true);
      const playerList = await read(joueur);
      expect(has(playerList)).toBe(true);
      expect(playerList.every((s) => !('members' in s))).toBe(true);
    });
  });

  describe('fenêtres de plusieurs créneaux (Story 47.6)', () => {
    type Served = {
      date: string;
      slot: string;
      durationSlots?: number;
      members?: { userId: string; status: string }[];
    };

    it('span classe sur le pire statut de la plage, porte durationSlots, et se borne à 1..45 en français', async () => {
      const mjA = await h.createUser('mj-span-a');
      const mjB = await h.createUser('mj-span-b');
      const joueur = await h.createUser('joueur-span');
      const { id: partieA } = await h.createPartie(mjA, 'CAMPAGNE_LINEAIRE', 'span-a');
      const { id: partieB } = await h.createPartie(mjB, 'ONE_SHOT', 'span-b');
      await h.addMember(partieA, joueur);
      await h.addMember(partieB, joueur);
      const day = isoDay(15);
      const scenariosRes = await mjB.agent.get(`/parties/${partieB}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;
      // Le joueur est occupé le seul soir de ce jour-là (séance d'une autre partie, 1 créneau).
      await datePourVote(
        mjB,
        partieB,
        seanceId,
        [
          { date: day, slot: 'EVENING' },
          { date: isoDay(17), slot: 'EVENING' },
        ],
        0,
      );

      const read = async (span?: number) =>
        body<Served[]>(
          await mjA.agent
            .get(`/parties/${partieA}/available-slots`)
            .query({ from: day, to: day, ...(span === undefined ? {} : { span }) })
            .expect(200),
        );
      const statusOf = (list: Served[], slot: string) =>
        list
          .find((s) => s.date === day && s.slot === slot)
          ?.members?.find((m) => m.userId === joueur.id)?.status;

      // Sans span : une fenêtre par créneau, durée 1, comme avant.
      const one = await read();
      expect(one).toHaveLength(3);
      expect(one.every((s) => s.durationSlots === 1)).toBe(true);
      expect(statusOf(one, 'AFTERNOON')).toBe('UNKNOWN');
      expect(statusOf(one, 'EVENING')).toBe('UNAVAILABLE');

      // Span 2 : la fenêtre de l'après-midi touche le soir occupé ; celle du matin non.
      const two = await read(2);
      expect(two).toHaveLength(3);
      expect(two.every((s) => s.durationSlots === 2)).toBe(true);
      expect(statusOf(two, 'MORNING')).toBe('UNKNOWN');
      expect(statusOf(two, 'AFTERNOON')).toBe('UNAVAILABLE');
      expect(statusOf(two, 'EVENING')).toBe('UNAVAILABLE');

      for (const span of ['0', '46', 'x', '1.5']) {
        const res = await mjA.agent
          .get(`/parties/${partieA}/available-slots`)
          .query({ from: day, to: day, span })
          .expect(400);
        expect(JSON.stringify(res.body)).toContain('entier de 1 à 45 créneaux');
      }
    });

    it('exclusion et vue des joueurs : une plage déjà proposée ne se repropose qu’à sa durée ; le joueur garde sa vue agrégée', async () => {
      const mjA = await h.createUser('mj-span-excl');
      const joueur = await h.createUser('joueur-span-excl');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'span-excl');
      await h.addMember(partieId, joueur);
      const scenariosRes = await mjA.agent.get(`/parties/${partieId}/scenarios`).expect(200);
      const seanceId = body<ScenarioDtoLike[]>(scenariosRes)[0].seances[0].id;
      const proposed = { date: isoDay(21), slot: 'AFTERNOON' };
      const range = { from: isoDay(20), to: isoDay(24) };
      const read = async (user: TestUser, span: number) =>
        body<Served[]>(
          await user.agent
            .get(`/parties/${partieId}/available-slots`)
            .query({ ...range, span })
            .expect(200),
        );
      const has = (list: Served[]) =>
        list.some((s) => s.date === proposed.date && s.slot === proposed.slot);

      await mjA.agent
        .post(`/scenarios/seances/${seanceId}/poll`)
        .send({ options: [proposed, { date: isoDay(23), slot: 'EVENING' }], durationSlots: 2 })
        .expect(201);

      expect(has(await read(mjA, 2))).toBe(false);
      expect(has(await read(mjA, 1))).toBe(true);
      expect(has(await read(mjA, 3))).toBe(true);

      const playerList = await read(joueur, 2);
      expect(has(playerList)).toBe(true);
      expect(playerList.every((s) => !('members' in s) && !('durationSlots' in s))).toBe(true);
    });
  });

  describe('masquer une fenêtre de l’automate (Story 46.4)', () => {
    const range = { from: isoDay(20), to: isoDay(24) };
    const hidden = { date: isoDay(21), startSlot: 'EVENING', durationSlots: 1 };
    type Served = { date: string; slot: string; hidden?: boolean; durationSlots?: number };

    const read = async (user: TestUser, partieId: string) =>
      body<Served[]>(
        await user.agent.get(`/parties/${partieId}/available-slots`).query(range).expect(200),
      );
    const find = (list: Served[]) =>
      list.find((s) => s.date === hidden.date && s.slot === hidden.startSlot);

    it('le MJ masque une fenêtre : elle sort de la liste, revient à part, puis se démasque', async () => {
      const mjA = await h.createUser('mj-masque');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'masque');

      const avant = find(await read(mjA, partieId));
      expect(avant?.hidden).toBeUndefined();
      expect(avant?.durationSlots).toBe(1);

      await mjA.agent.put(`/parties/${partieId}/available-slots/hidden`).send(hidden).expect(200);
      // Idempotent : un second PUT ne double rien et ne casse rien.
      await mjA.agent.put(`/parties/${partieId}/available-slots/hidden`).send(hidden).expect(200);

      const apres = await read(mjA, partieId);
      expect(find(apres)?.hidden).toBe(true);
      expect(apres.filter((s) => s.hidden)).toHaveLength(1);
      // Les masquées viennent après toutes les visibles.
      expect(apres.findIndex((s) => s.hidden)).toBe(apres.length - 1);

      await mjA.agent
        .delete(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden)
        .expect(200);
      expect(find(await read(mjA, partieId))?.hidden).toBeUndefined();
      // Démasquer ce qui ne l'est pas : sans effet.
      await mjA.agent
        .delete(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden)
        .expect(200);
    });

    it('un joueur est refusé (403) et la vue agrégée ne montre ni masque ni durée', async () => {
      const mjA = await h.createUser('mj-masque-j');
      const joueur = await h.createUser('joueur-masque');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'masque-joueur');
      await h.addMember(partieId, joueur);
      await mjA.agent.put(`/parties/${partieId}/available-slots/hidden`).send(hidden).expect(200);

      await joueur.agent
        .put(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden)
        .expect(403);
      await joueur.agent
        .delete(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden)
        .expect(403);

      // Pour le joueur, la fenêtre reste servie, sans aucune trace du masquage du MJ.
      const vue = await read(joueur, partieId);
      expect(find(vue)).toBeDefined();
      expect(vue.every((s) => !('hidden' in s) && !('durationSlots' in s))).toBe(true);
    });

    it('un étranger à la partie est refusé, et rien n’est écrit', async () => {
      const mjA = await h.createUser('mj-masque-e');
      const intrus = await h.createUser('intrus-masque');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'masque-etranger');
      const res = await intrus.agent
        .put(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden);
      expect([403, 404]).toContain(res.status);
      expect(find(await read(mjA, partieId))?.hidden).toBeUndefined();
    });

    it('un groupe de ralliement refuse, même à son administrateur', async () => {
      const admin = await h.createUser('admin-masque');
      const { id: partieId } = await h.createPartie(
        admin,
        'ONE_SHOT',
        'masque-ralliement',
        'ralliement',
      );
      await admin.agent.put(`/parties/${partieId}/available-slots/hidden`).send(hidden).expect(403);
      await admin.agent
        .delete(`/parties/${partieId}/available-slots/hidden`)
        .send(hidden)
        .expect(403);
    });

    it.each([
      ['une date passée', { ...hidden, date: '2020-01-01' }],
      ['un créneau inconnu', { ...hidden, startSlot: 'NIGHT' }],
      ['une durée nulle', { ...hidden, durationSlots: 0 }],
      ['une durée au-delà du plafond', { ...hidden, durationSlots: 46 }],
      ['une date mal formée', { ...hidden, date: 'demain' }],
      ['un corps vide', {}],
    ])('refuse %s en 400', async (_label, bad) => {
      const mjA = await h.createUser('mj-masque-v');
      const { id: partieId } = await h.createPartie(mjA, 'ONE_SHOT', 'masque-valide');
      await mjA.agent.put(`/parties/${partieId}/available-slots/hidden`).send(bad).expect(400);
    });
  });

  describe('scénario Courant en campagne linéaire', () => {
    it('fige : un seul scénario Courant — 1er passage 200, second refusé en 409', async () => {
      const { id: partieId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'courant');
      const { scenario: premier } = await addScenario(mj, partieId, 'Chapitre 1');
      const { scenario: second } = await addScenario(mj, partieId, 'Chapitre 2');
      await mj.agent.patch(`/scenarios/${premier.id}/open`).expect(200);
      await mj.agent.patch(`/scenarios/${second.id}/open`).expect(200);

      await mj.agent.patch(`/scenarios/${premier.id}/courant`).expect(200);
      const refus = await mj.agent.patch(`/scenarios/${second.id}/courant`).expect(409);
      expect(body<{ message: string }>(refus).message).toBe(
        'Un scénario est déjà marqué Courant sur cette Partie.',
      );
    });
  });
});
