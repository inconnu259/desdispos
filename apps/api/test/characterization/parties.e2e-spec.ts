import { randomUUID } from 'node:crypto';
import { Harness, body, keysOf, type TestUser } from './harness';

// Tests de caractérisation (Story 37.1) : figent, au niveau HTTP, le comportement actuel des
// parties — création, refus d'accès, formes des DTO, signaux. Référence de toutes les stories de
// l'épic 37 : une attente qui change ici signale un changement de comportement JDR.

type PartieDtoLike = Record<string, unknown> & {
  id: string;
  role: string;
  status: string;
  kind: string;
  name: string;
};
type SeanceDtoLike = Record<string, unknown> & { id: string };
type ScenarioDtoLike = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  seances: SeanceDtoLike[];
};
type SignalsDto = Record<string, { role: string; status: string; signals: string[] }>;

/** Clés de `PartieDto` renvoyé par `GET /parties/:id` (avec l'identité du MJ). */
const PARTIE_DTO_KEYS = [
  'coverImageVersion',
  'createdAt',
  'description',
  'gameSystemId',
  'id',
  'isFavorite',
  'kind',
  'name',
  'nextSessionDate',
  // Story 47.2 : fin de la plage de la prochaine séance.
  'nextSessionEndDate',
  'nextSessionEndSlot',
  'nextSessionSlot',
  'ownerDisplayName',
  'ownerId',
  'ownerPseudo',
  'role',
  'status',
];

/** Clés de `ScenarioDto` hors campagne épisodique (scénario non clôturé). */
const SCENARIO_DTO_KEYS = [
  'closedAt',
  'createdAt',
  'description',
  'dureeHeures',
  'dureeSeances',
  'id',
  'partieId',
  'resumeFin',
  'seances',
  'status',
  'title',
];

/** Clés de `SeanceDto` d'une séance neuve (ni vote, ni capacité). */
const SEANCE_DTO_KEYS = [
  // Story 44.1 : droits d'organisateur de la personne qui lit.
  'can',
  'compteRendu',
  'createdAt',
  'dateValidee',
  // Story 47.1 : durée du rendez-vous, en créneaux enchaînés (1 par défaut).
  'durationSlots',
  // Story 47.2 : fin de la plage de la séance.
  'endDate',
  'endSlot',
  'heureRdv',
  'id',
  'lieu',
  'notePratique',
  'scenarioId',
  'slotValidee',
];

describe('Caractérisation JDR — parties (Story 37.1)', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, stranger] = await Promise.all([
      h.createUser('mj'),
      h.createUser('joueur'),
      h.createUser('etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  describe('création', () => {
    it('fige : un ONE_SHOT naît avec un unique scénario BROUILLON titré comme la partie et une séance', async () => {
      const { res, id, name } = await h.createPartie(mj, 'ONE_SHOT');
      expect(res.status).toBe(201);
      const partie = body<PartieDtoLike>(res);
      expect(partie.role).toBe('mj');
      expect(partie.kind).toBe('ONE_SHOT');
      expect(partie.name).toBe(name);
      expect(partie.status).toBe('EN_COURS');

      const scenariosRes = await mj.agent.get(`/parties/${id}/scenarios`).expect(200);
      const scenarios = body<ScenarioDtoLike[]>(scenariosRes);
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].status).toBe('BROUILLON');
      expect(scenarios[0].title).toBe(name);
      expect(scenarios[0].seances).toHaveLength(1);
    });

    it.each(['CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'] as const)(
      'fige : une campagne %s naît sans aucun scénario',
      async (kind) => {
        const { res, id } = await h.createPartie(mj, kind);
        expect(res.status).toBe(201);
        const partie = body<PartieDtoLike>(res);
        expect(partie.role).toBe('mj');
        expect(partie.kind).toBe(kind);
        expect(partie.status).toBe('A_VENIR');

        const scenariosRes = await mj.agent.get(`/parties/${id}/scenarios`).expect(200);
        expect(body<ScenarioDtoLike[]>(scenariosRes)).toEqual([]);
      },
    );
  });

  describe("refus d'accès", () => {
    let partieId: string;

    beforeAll(async () => {
      ({ id: partieId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'refus'));
      await h.addMember(partieId, player);
    });

    it('fige : la lecture (GET /parties/:id) est refusée en 403 à un non-membre', async () => {
      await stranger.agent.get(`/parties/${partieId}`).expect(403);
    });

    it('fige : la lecture (GET /parties/:id) est ouverte au membre, avec le rôle player', async () => {
      const res = await player.agent.get(`/parties/${partieId}`).expect(200);
      expect(body<PartieDtoLike>(res).role).toBe('player');
    });

    it('fige : la lecture (GET /parties/:id) d’un identifiant inconnu répond 404 « Partie introuvable »', async () => {
      const res = await mj.agent.get(`/parties/${randomUUID()}`).expect(404);
      expect(body<{ message: string }>(res).message).toBe('Partie introuvable');
    });

    it('fige : la modification (PATCH /parties/:id) est refusée en 403 à un membre', async () => {
      await player.agent.patch(`/parties/${partieId}`).send({ name: 'Tentative' }).expect(403);
    });

    it('fige : la modification (PATCH /parties/:id) d’un identifiant inconnu répond 404 « Partie introuvable »', async () => {
      const res = await mj.agent
        .patch(`/parties/${randomUUID()}`)
        .send({ name: 'Tentative' })
        .expect(404);
      expect(body<{ message: string }>(res).message).toBe('Partie introuvable');
    });
  });

  describe('formes des DTO', () => {
    it('fige : clés de PartieDto, ScenarioDto et SeanceDto pour un ONE_SHOT', async () => {
      const { id } = await h.createPartie(mj, 'ONE_SHOT', 'forme');
      const partieRes = await mj.agent.get(`/parties/${id}`).expect(200);
      expect(keysOf(body(partieRes))).toEqual(PARTIE_DTO_KEYS);

      const scenariosRes = await mj.agent.get(`/parties/${id}/scenarios`).expect(200);
      const [scenario] = body<ScenarioDtoLike[]>(scenariosRes);
      expect(keysOf(scenario)).toEqual(SCENARIO_DTO_KEYS);
      expect(keysOf(scenario.seances[0])).toEqual(SEANCE_DTO_KEYS);
    });

    it('fige : clés de PartieDto sur POST /parties, GET /parties (MJ et joueur) et GET /parties/:id (joueur)', async () => {
      // Sans identité du MJ (ownerPseudo/ownerDisplayName) hors de GET /parties/:id.
      const listKeys = PARTIE_DTO_KEYS.filter(
        (k) => k !== 'ownerPseudo' && k !== 'ownerDisplayName',
      );
      const owner = await h.createUser('mj-formes');
      const member = await h.createUser('joueur-formes');
      const { res, id } = await h.createPartie(owner, 'CAMPAGNE_LINEAIRE', 'formes-liste');
      expect(res.status).toBe(201);
      expect(keysOf(body(res))).toEqual(listKeys);
      await h.addMember(id, member);

      const mjList = body<PartieDtoLike[]>(await owner.agent.get('/parties').expect(200));
      const mjItem = mjList.find((p) => p.id === id);
      expect(mjItem).toBeDefined();
      expect(keysOf(mjItem)).toEqual(listKeys);

      const playerList = body<PartieDtoLike[]>(
        await member.agent.get('/parties').query({ role: 'player' }).expect(200),
      );
      const playerItem = playerList.find((p) => p.id === id);
      expect(playerItem).toBeDefined();
      expect(playerItem!.role).toBe('player');
      expect(keysOf(playerItem)).toEqual(listKeys);

      const playerGet = await member.agent.get(`/parties/${id}`).expect(200);
      expect(keysOf(body(playerGet))).toEqual(PARTIE_DTO_KEYS);
    });

    it('fige : en campagne épisodique, ScenarioDto ajoute `participants`', async () => {
      const { id } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'forme-episodique');
      await mj.agent.post(`/parties/${id}/scenarios`).send({ title: 'Épisode 1' }).expect(201);

      const scenariosRes = await mj.agent.get(`/parties/${id}/scenarios`).expect(200);
      const [scenario] = body<ScenarioDtoLike[]>(scenariosRes);
      expect(keysOf(scenario)).toEqual([...SCENARIO_DTO_KEYS, 'participants'].sort());
      expect(scenario.participants).toEqual([]);
      expect(keysOf(scenario.seances[0])).toEqual(SEANCE_DTO_KEYS);
    });
  });

  describe('signaux (GET /me/party-signals)', () => {
    it('fige : une entrée par partie avec rôle, statut et codes de signaux (comparés en ensembles)', async () => {
      const owner = await h.createUser('mj-signaux');
      const member = await h.createUser('joueur-signaux');
      const { id: oneShotId } = await h.createPartie(owner, 'ONE_SHOT', 'signaux-oneshot');
      const { id: campagneId } = await h.createPartie(
        owner,
        'CAMPAGNE_LINEAIRE',
        'signaux-campagne',
      );
      await h.addMember(campagneId, member);

      const ownerRes = await owner.agent.get('/me/party-signals').expect(200);
      const ownerSignals = body<SignalsDto>(ownerRes);
      expect(Object.keys(ownerSignals).sort()).toEqual([oneShotId, campagneId].sort());

      expect(ownerSignals[oneShotId].role).toBe('mj');
      expect(ownerSignals[oneShotId].status).toBe('EN_COURS');
      expect(new Set(ownerSignals[oneShotId].signals)).toEqual(
        new Set([
          'HOMME_DRAGON_A_CREER',
          'AUCUN_MEMBRE_INVITE',
          'AUCUN_SCENARIO_EN_COURS',
          'AUCUNE_DATE_NI_VOTE',
        ]),
      );

      expect(ownerSignals[campagneId].role).toBe('mj');
      expect(ownerSignals[campagneId].status).toBe('A_VENIR');
      expect(new Set(ownerSignals[campagneId].signals)).toEqual(
        new Set(['HOMME_DRAGON_A_CREER', 'AUCUN_SCENARIO_EN_COURS', 'AUCUNE_DATE_NI_VOTE']),
      );

      const memberRes = await member.agent.get('/me/party-signals').expect(200);
      const memberSignals = body<SignalsDto>(memberRes);
      expect(Object.keys(memberSignals)).toEqual([campagneId]);
      expect(memberSignals[campagneId].role).toBe('player');
      expect(memberSignals[campagneId].status).toBe('A_VENIR');
      expect(new Set(memberSignals[campagneId].signals)).toEqual(new Set(['PERSONNAGE_A_CREER']));
    });
  });
});
