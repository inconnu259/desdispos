import { deleteDocumentFile } from '../../src/scenarios/document-storage.util';
import { Harness, body, isoDay, keysOf, type TestUser } from './harness';

// Anti-spoil appliqué PAR LE SERVEUR (PRD FR-5/FR-6) : un joueur qui appelle l'API directement ne
// reçoit rien d'un brouillon (scénario, séance, vote, date, document, annonce) ni du contenu d'un
// scénario « à venir ». Le MJ voit tout, comme avant. Exemption ONE_SHOT : son scénario unique
// reste listé et ses séances/dates/votes utilisables, mais son contenu est masqué tant qu'il est
// brouillon. Vérifié au niveau HTTP, joueur contre MJ.

type PollLike = { id: string; options: { id: string; date: string; slot: string }[] };
type SeanceLike = {
  id: string;
  compteRendu: string | null;
  dateValidee: string | null;
  poll?: PollLike;
};
type ScenarioLike = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  dureeHeures: number | null;
  dureeSeances: number | null;
  seances: SeanceLike[];
  participants?: { userId: string }[];
};
type PartieLike = { nextSessionDate: string | null; nextSessionSlot: string | null };
type DocLike = { id: string; scenarioId: string | null };
type AnnouncementLike = { id: string; text: string; scenarioId: string | null };
type CalendarLike = {
  'mes-seances': { seanceId: string }[];
  'inscriptions-ouvertes': { seanceId: string }[];
};
// Story 44.2 : les votes en cours viennent de `GET /me/open-polls`, plus de `GET /me/calendar`.
type OpenPollLike = { pollId: string; partieId: string };
type SignalsLike = Record<string, { signals: string[] }>;
type ErrorLike = { statusCode: number; message: string };

const POLL_INCONNU = 'Poll introuvable ou fermé';
const SCENARIO_INTROUVABLE = 'Scénario introuvable';

/** Crée un scénario (brouillon) dans une campagne et le renvoie. */
async function createScenario(
  mj: TestUser,
  partieId: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<ScenarioLike> {
  const res = await mj.agent
    .post(`/parties/${partieId}/scenarios`)
    .send({ title, ...extra })
    .expect(201);
  return body<ScenarioLike>(res);
}

/** Crée un vote sur une séance, renvoie le vote créé. */
async function createPoll(
  mj: TestUser,
  seanceId: string,
  days: [number, number],
): Promise<PollLike> {
  const res = await mj.agent
    .post(`/scenarios/seances/${seanceId}/poll`)
    .send({
      options: [
        { date: isoDay(days[0]), slot: 'EVENING' },
        { date: isoDay(days[1]), slot: 'EVENING' },
      ],
    })
    .expect(201);
  const poll = body<ScenarioLike>(res).seances.find((s) => s.id === seanceId)?.poll;
  if (!poll) throw new Error('Vote absent de la séance après création');
  return poll;
}

/** Date une séance : crée un vote puis fait choisir sa première option au MJ. */
async function dateSeance(
  mj: TestUser,
  partieId: string,
  seanceId: string,
  days: [number, number],
): Promise<void> {
  const poll = await createPoll(mj, seanceId, days);
  await mj.agent
    .patch(`/parties/${partieId}/poll/${poll.id}/choose`)
    .send({ optionId: poll.options[0].id })
    .expect(200);
}

/** Dépose un document texte (bibliothèque si `scenarioId` absent) et renvoie son identifiant. */
async function uploadDoc(mj: TestUser, partieId: string, scenarioId?: string): Promise<DocLike> {
  const req = mj.agent
    .post(`/parties/${partieId}/documents`)
    .attach('file', Buffer.from('Contenu secret du document'), {
      filename: 'secret.txt',
      contentType: 'text/plain',
    });
  if (scenarioId) void req.field('scenarioId', scenarioId);
  return body<DocLike>(await req.expect(201));
}

describe('Anti-spoil serveur des scénarios', () => {
  let h: Harness;
  let mj: TestUser;
  let joueur: TestUser;
  const partieIds: string[] = [];

  beforeAll(async () => {
    h = await Harness.start();
    [mj, joueur] = await Promise.all([h.createUser('mj'), h.createUser('joueur')]);
  });

  afterAll(async () => {
    try {
      // Les fichiers de documents vivent sur disque : la cascade ne les efface pas.
      const docs = await h.prisma.scenarioDocument.findMany({
        where: { partieId: { in: partieIds } },
        select: { filename: true },
      });
      for (const d of docs) await deleteDocumentFile(d.filename);
    } finally {
      await h?.close();
    }
  });

  /** Crée une partie, y inscrit le joueur et mémorise son identifiant. */
  async function partie(
    kind: 'ONE_SHOT' | 'CAMPAGNE_LINEAIRE' | 'CAMPAGNE_EPISODIQUE',
    label: string,
  ) {
    const { id } = await h.createPartie(mj, kind, label);
    await h.addMember(id, joueur);
    partieIds.push(id);
    return id;
  }

  describe('campagne linéaire : liste, contenu masqué, documents, annonces, prochaine séance', () => {
    let partieId: string;
    let brouillon: ScenarioLike;
    let aVenir: ScenarioLike;
    let courant: ScenarioLike;
    let seanceBrouillonDatee: string;
    let pollBrouillon: PollLike;
    let pollCourant: PollLike;
    let nextAfterDraftOnly: PartieLike;
    let docBrouillon: DocLike;
    let docAVenir: DocLike;
    let docCourant: DocLike;
    let docBibliotheque: DocLike;
    let annonceBrouillon: AnnouncementLike;

    beforeAll(async () => {
      partieId = await partie('CAMPAGNE_LINEAIRE', 'liste');

      // Brouillon : description, durées, compte rendu, deux séances (l'une avec un vote ouvert, la
      // seconde datée), un document et une annonce ciblée.
      brouillon = await createScenario(mj, partieId, 'Brouillon secret', {
        description: 'DESC-BROUILLON',
        dureeHeures: 3,
        dureeSeances: 2,
      });
      await mj.agent
        .patch(`/scenarios/seances/${brouillon.seances[0].id}/compte-rendu`)
        .send({ compteRendu: 'CR-BROUILLON' })
        .expect(200);
      pollBrouillon = await createPoll(mj, brouillon.seances[0].id, [3, 4]);
      const withSecond = body<ScenarioLike>(
        await mj.agent.post(`/scenarios/${brouillon.id}/seances`).expect(201),
      );
      seanceBrouillonDatee = withSecond.seances[1].id;
      await dateSeance(mj, partieId, seanceBrouillonDatee, [2, 5]);
      nextAfterDraftOnly = body<PartieLike>(await joueur.agent.get(`/parties/${partieId}`));

      // À venir : séance datée (+20 j), compte rendu.
      aVenir = await createScenario(mj, partieId, 'Scénario à venir', {
        description: 'DESC-AVENIR',
        dureeHeures: 5,
        dureeSeances: 3,
      });
      await dateSeance(mj, partieId, aVenir.seances[0].id, [20, 21]);
      await mj.agent
        .patch(`/scenarios/seances/${aVenir.seances[0].id}/compte-rendu`)
        .send({ compteRendu: 'CR-AVENIR' })
        .expect(200);
      await mj.agent.patch(`/scenarios/${aVenir.id}/open`).expect(200);

      // Courant : séance datée (+25 j) et un second vote ouvert (+30 j).
      courant = await createScenario(mj, partieId, 'Scénario courant', {
        description: 'DESC-COURANT',
        dureeHeures: 6,
        dureeSeances: 4,
      });
      await dateSeance(mj, partieId, courant.seances[0].id, [25, 26]);
      const second = body<ScenarioLike>(
        await mj.agent.post(`/scenarios/${courant.id}/seances`).expect(201),
      );
      pollCourant = await createPoll(mj, second.seances[1].id, [30, 31]);
      await mj.agent.patch(`/scenarios/${courant.id}/open`).expect(200);
      await mj.agent.patch(`/scenarios/${courant.id}/courant`).expect(200);

      docBrouillon = await uploadDoc(mj, partieId, brouillon.id);
      docAVenir = await uploadDoc(mj, partieId, aVenir.id);
      docCourant = await uploadDoc(mj, partieId, courant.id);
      docBibliotheque = await uploadDoc(mj, partieId);

      await mj.agent
        .post(`/parties/${partieId}/announcements`)
        .send({ text: 'Pour tous' })
        .expect(201);
      annonceBrouillon = body<AnnouncementLike>(
        await mj.agent
          .post(`/parties/${partieId}/announcements`)
          .send({ text: 'ANN-BROUILLON', scenarioId: brouillon.id })
          .expect(201),
      );
      await mj.agent
        .post(`/parties/${partieId}/announcements`)
        .send({ text: 'ANN-AVENIR', scenarioId: aVenir.id })
        .expect(201);
      await mj.agent
        .post(`/parties/${partieId}/announcements`)
        .send({ text: 'ANN-COURANT', scenarioId: courant.id })
        .expect(201);
    });

    it('le joueur ne reçoit pas le brouillon dans la liste ; le MJ reçoit les trois scénarios', async () => {
      const joueurList = body<ScenarioLike[]>(
        await joueur.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      expect(joueurList.map((s) => s.title)).toEqual(['Scénario à venir', 'Scénario courant']);
      expect(JSON.stringify(joueurList)).not.toContain('Brouillon secret');
      expect(JSON.stringify(joueurList)).not.toContain('DESC-BROUILLON');
      expect(JSON.stringify(joueurList)).not.toContain('CR-BROUILLON');
      expect(JSON.stringify(joueurList)).not.toContain(brouillon.id);

      const mjList = body<ScenarioLike[]>(
        await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      expect(mjList.map((s) => s.title)).toEqual([
        'Brouillon secret',
        'Scénario à venir',
        'Scénario courant',
      ]);
    });

    it('à venir : le joueur garde titre, séances et dates mais ni description, ni durées, ni compte rendu', async () => {
      const list = body<ScenarioLike[]>(
        await joueur.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      const s = list.find((x) => x.id === aVenir.id)!;
      expect(s).toMatchObject({
        title: 'Scénario à venir',
        status: 'A_VENIR',
        description: null,
        dureeHeures: null,
        dureeSeances: null,
      });
      expect(s.seances).toHaveLength(1);
      expect(s.seances[0].compteRendu).toBeNull();
      expect(s.seances[0].dateValidee).toBe(`${isoDay(20)}T00:00:00.000Z`);
      // La forme du DTO ne change pas : les champs masqués restent présents (nuls).
      expect(keysOf(s)).toEqual(expect.arrayContaining(['description', 'dureeHeures']));

      const mjS = body<ScenarioLike[]>(
        await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      ).find((x) => x.id === aVenir.id)!;
      expect(mjS).toMatchObject({ description: 'DESC-AVENIR', dureeHeures: 5, dureeSeances: 3 });
      expect(mjS.seances[0].compteRendu).toBe('CR-AVENIR');
    });

    it('courant : le joueur reçoit le contenu complet', async () => {
      const list = body<ScenarioLike[]>(
        await joueur.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      expect(list.find((x) => x.id === courant.id)).toMatchObject({
        description: 'DESC-COURANT',
        dureeHeures: 6,
        dureeSeances: 4,
      });
    });

    it('documents : brouillon et à venir → 404 sans octet ; courant et bibliothèque → servis ; le MJ lit tout', async () => {
      for (const doc of [docBrouillon, docAVenir]) {
        const res = await joueur.agent.get(`/documents/${doc.id}`).expect(404);
        expect(body<ErrorLike>(res).message).toBe('Document introuvable');
        expect(JSON.stringify(res.body)).not.toContain('Contenu secret');
      }
      for (const doc of [docCourant, docBibliotheque]) {
        const res = await joueur.agent.get(`/documents/${doc.id}`).expect(200);
        expect(res.text).toContain('Contenu secret');
      }
      for (const doc of [docBrouillon, docAVenir, docCourant, docBibliotheque]) {
        await mj.agent.get(`/documents/${doc.id}`).expect(200);
      }
    });

    it('liste des documents d’un scénario : brouillon → 404 ; à venir → bibliothèque seule ; courant → les deux', async () => {
      const draft = await joueur.agent.get(`/scenarios/${brouillon.id}/documents`).expect(404);
      expect(body<ErrorLike>(draft).message).toBe(SCENARIO_INTROUVABLE);

      const avenir = body<DocLike[]>(
        await joueur.agent.get(`/scenarios/${aVenir.id}/documents`).expect(200),
      );
      expect(avenir.map((d) => d.id)).toEqual([docBibliotheque.id]);

      const cour = body<DocLike[]>(
        await joueur.agent.get(`/scenarios/${courant.id}/documents`).expect(200),
      );
      expect(cour.map((d) => d.id).sort()).toEqual([docCourant.id, docBibliotheque.id].sort());

      const mjDraft = body<DocLike[]>(
        await mj.agent.get(`/scenarios/${brouillon.id}/documents`).expect(200),
      );
      expect(mjDraft.map((d) => d.id)).toContain(docBrouillon.id);
    });

    it('annonces : le joueur ne reçoit que celles de toute la partie et du scénario courant ; le MJ reçoit les quatre', async () => {
      const joueurAnn = body<AnnouncementLike[]>(
        await joueur.agent.get(`/parties/${partieId}/announcements`).expect(200),
      );
      expect(joueurAnn.map((a) => a.text).sort()).toEqual(['ANN-COURANT', 'Pour tous']);

      const mjAnn = body<AnnouncementLike[]>(
        await mj.agent.get(`/parties/${partieId}/announcements`).expect(200),
      );
      expect(mjAnn.map((a) => a.text).sort()).toEqual([
        'ANN-AVENIR',
        'ANN-BROUILLON',
        'ANN-COURANT',
        'Pour tous',
      ]);

      // Annonces non vues : mêmes règles par rôle (le MJ voit aussi les siennes, ici non lues).
      const unseenJoueur = body<AnnouncementLike[]>(
        await joueur.agent.get('/me/unseen-announcements').expect(200),
      ).filter((a) => a.text.startsWith('ANN-') || a.text === 'Pour tous');
      expect(unseenJoueur.map((a) => a.text).sort()).toEqual(['ANN-COURANT', 'Pour tous']);
      const unseenMj = body<AnnouncementLike[]>(
        await mj.agent.get('/me/unseen-announcements').expect(200),
      ).filter((a) => a.text.startsWith('ANN-') || a.text === 'Pour tous');
      expect(unseenMj).toHaveLength(4);
    });

    it('annonce du brouillon : le joueur ne peut ni la marquer lue ni sonder son existence (404), le MJ le peut', async () => {
      const res = await joueur.agent
        .put(`/me/announcements-read/${annonceBrouillon.id}`)
        .expect(404);
      expect(body<ErrorLike>(res).message).toBe('Annonce introuvable');
      expect(
        await h.prisma.announcementRead.count({ where: { announcementId: annonceBrouillon.id } }),
      ).toBe(0);

      await mj.agent.put(`/me/announcements-read/${annonceBrouillon.id}`).expect(200);
    });

    it('calendrier personnel : les séances du brouillon sont absentes pour le joueur, présentes pour le MJ', async () => {
      const query = { from: isoDay(0), to: isoDay(40) };
      const joueurCal = body<CalendarLike>(
        await joueur.agent.get('/me/calendar').query(query).expect(200),
      );
      const joueurSeances = joueurCal['mes-seances'].map((s) => s.seanceId);
      expect(joueurSeances).not.toContain(seanceBrouillonDatee);
      expect(joueurSeances).toContain(aVenir.seances[0].id);
      expect(joueurSeances).toContain(courant.seances[0].id);

      const mjCal = body<CalendarLike>(await mj.agent.get('/me/calendar').query(query).expect(200));
      expect(mjCal['mes-seances'].map((s) => s.seanceId)).toContain(seanceBrouillonDatee);
    });

    it('votes en cours : le joueur ne voit que le vote du scénario courant, le MJ voit aussi celui du brouillon', async () => {
      const joueurPolls = body<OpenPollLike[]>(
        await joueur.agent.get('/me/open-polls').expect(200),
      );
      expect(joueurPolls.map((p) => p.pollId)).toEqual([pollCourant.id]);

      const mjPolls = body<OpenPollLike[]>(await mj.agent.get('/me/open-polls').expect(200));
      expect(mjPolls.map((p) => p.pollId).sort()).toEqual(
        [pollBrouillon.id, pollCourant.id].sort(),
      );
    });

    it('prochaine séance : la date du brouillon n’est jamais retenue, ouvrir le scénario la rend éligible', async () => {
      // Au moment où seul le brouillon était daté (+2 j) : aucune prochaine séance.
      expect(nextAfterDraftOnly.nextSessionDate).toBeNull();
      expect(nextAfterDraftOnly.nextSessionSlot).toBeNull();

      // Brouillon (+2 j), à venir (+20 j), courant (+25 j) : la plus proche VISIBLE est +20 j, pour
      // le joueur comme pour le MJ.
      for (const user of [joueur, mj]) {
        const p = body<PartieLike>(await user.agent.get(`/parties/${partieId}`).expect(200));
        expect(p.nextSessionDate).toBe(`${isoDay(20)}T00:00:00.000Z`);
      }

      await mj.agent.patch(`/scenarios/${brouillon.id}/open`).expect(200);
      for (const user of [joueur, mj]) {
        const p = body<PartieLike>(await user.agent.get(`/parties/${partieId}`).expect(200));
        expect(p.nextSessionDate).toBe(`${isoDay(2)}T00:00:00.000Z`);
        expect(p.nextSessionSlot).toBe('EVENING');
      }
    });
  });

  describe('campagne linéaire : vote de la séance d’un brouillon', () => {
    let partieId: string;
    let brouillon: ScenarioLike;
    let poll: PollLike;
    const query = { from: isoDay(0), to: isoDay(40) };

    beforeAll(async () => {
      partieId = await partie('CAMPAGNE_LINEAIRE', 'vote-brouillon');
      brouillon = await createScenario(mj, partieId, 'Brouillon à vote');
      poll = await createPoll(mj, brouillon.seances[0].id, [10, 11]);
    });

    it('lecture : le joueur ne reçoit aucun vote, le MJ reçoit le vote ouvert', async () => {
      const joueurRes = await joueur.agent.get(`/parties/${partieId}/poll`).expect(200);
      expect(joueurRes.body).not.toHaveProperty('id');
      expect(JSON.stringify(joueurRes.body)).not.toContain(poll.id);

      const mjRes = await mj.agent.get(`/parties/${partieId}/poll`).expect(200);
      expect(body<PollLike>(mjRes).id).toBe(poll.id);
    });

    it('vote et retrait : même erreur qu’un vote inconnu (400), aucun vote enregistré', async () => {
      const vote = await joueur.agent
        .post(`/parties/${partieId}/poll/${poll.id}/vote`)
        .send({ optionId: poll.options[0].id, answer: 'YES' })
        .expect(400);
      expect(body<ErrorLike>(vote).message).toBe(POLL_INCONNU);

      const retrait = await joueur.agent
        .delete(`/parties/${partieId}/poll/${poll.id}/vote/${poll.options[0].id}`)
        .expect(400);
      expect(body<ErrorLike>(retrait).message).toBe(POLL_INCONNU);

      expect(await h.prisma.pollVote.count({ where: { pollId: poll.id } })).toBe(0);
    });

    it('signal et calendrier : ni VOTE_EN_COURS_SANS_REPONSE ni vote en cours pour le joueur, le MJ voit le vote', async () => {
      const signals = body<SignalsLike>(await joueur.agent.get('/me/party-signals').expect(200));
      expect(signals[partieId].signals).not.toContain('VOTE_EN_COURS_SANS_REPONSE');

      // La liste agrège toutes les parties : on isole celle de ce test.
      const ici = async (who: typeof joueur) =>
        body<OpenPollLike[]>(await who.agent.get('/me/open-polls').expect(200))
          .filter((p) => p.partieId === partieId)
          .map((p) => p.pollId);
      expect(await ici(joueur)).toEqual([]);
      expect(await ici(mj)).toEqual([poll.id]);
    });

    it('le MJ vote sur son propre brouillon (inchangé)', async () => {
      await mj.agent
        .post(`/parties/${partieId}/poll/${poll.id}/vote`)
        .send({ optionId: poll.options[0].id, answer: 'YES' })
        .expect(201);
    });

    it('une fois le scénario ouvert, le joueur voit le vote, reçoit le signal et peut voter', async () => {
      await mj.agent.patch(`/scenarios/${brouillon.id}/open`).expect(200);

      const res = await joueur.agent.get(`/parties/${partieId}/poll`).expect(200);
      expect(body<PollLike>(res).id).toBe(poll.id);

      const signals = body<SignalsLike>(await joueur.agent.get('/me/party-signals').expect(200));
      expect(signals[partieId].signals).toContain('VOTE_EN_COURS_SANS_REPONSE');

      await joueur.agent
        .post(`/parties/${partieId}/poll/${poll.id}/vote`)
        .send({ optionId: poll.options[0].id, answer: 'MAYBE' })
        .expect(201);
      expect(await h.prisma.pollVote.count({ where: { pollId: poll.id, userId: joueur.id } })).toBe(
        1,
      );
    });
  });

  describe('campagne épisodique : participation et inscriptions ouvertes', () => {
    let partieId: string;
    let brouillon: ScenarioLike;
    let aVenir: ScenarioLike;
    let passe: ScenarioLike;

    beforeAll(async () => {
      partieId = await partie('CAMPAGNE_EPISODIQUE', 'episodique');
      brouillon = await createScenario(mj, partieId, 'Épisode brouillon', {
        description: 'DESC-EPISODE-BROUILLON',
      });
      aVenir = await createScenario(mj, partieId, 'Épisode à venir', {
        description: 'DESC-EPISODE-AVENIR',
      });
      passe = await createScenario(mj, partieId, 'Épisode passé');
      for (const s of [brouillon, aVenir]) {
        await mj.agent
          .patch(`/scenarios/seances/${s.seances[0].id}/capacite`)
          .send({ inscriptionMin: 1, inscriptionMax: 3 })
          .expect(200);
      }
      await mj.agent.patch(`/scenarios/${aVenir.id}/open`).expect(200);
      await mj.agent.patch(`/scenarios/${passe.id}/open`).expect(200);
      await mj.agent.patch(`/scenarios/${passe.id}/courant`).expect(200);
      await mj.agent.patch(`/scenarios/${passe.id}/passe`).expect(200);
    });

    it('participer à un brouillon : 404 « Scénario introuvable », aucune participation écrite', async () => {
      const res = await joueur.agent.post(`/scenarios/${brouillon.id}/participate`).expect(404);
      expect(body<ErrorLike>(res).message).toBe(SCENARIO_INTROUVABLE);
      expect(
        await h.prisma.scenarioParticipant.count({ where: { scenarioId: brouillon.id } }),
      ).toBe(0);
    });

    it('participer à un scénario passé : 400, aucune participation écrite', async () => {
      await joueur.agent.post(`/scenarios/${passe.id}/participate`).expect(400);
      expect(await h.prisma.scenarioParticipant.count({ where: { scenarioId: passe.id } })).toBe(0);
    });

    it('participer à un scénario à venir : 201, participants conservés, contenu masqué dans la réponse', async () => {
      const res = await joueur.agent.post(`/scenarios/${aVenir.id}/participate`).expect(201);
      const dto = body<ScenarioLike>(res);
      expect(dto).toMatchObject({
        title: 'Épisode à venir',
        description: null,
        dureeHeures: null,
        dureeSeances: null,
      });
      expect(dto.participants?.map((p) => p.userId)).toEqual([joueur.id]);
    });

    it('inscription à une séance de brouillon : 404 « Séance introuvable » (et non le 400 « non actif »), aucune inscription', async () => {
      const res = await joueur.agent
        .post(`/scenarios/seances/${brouillon.seances[0].id}/inscription`)
        .expect(404);
      expect(body<ErrorLike>(res).message).toBe('Séance introuvable');
      expect(
        await h.prisma.inscription.count({ where: { seanceId: brouillon.seances[0].id } }),
      ).toBe(0);
    });

    it('désinscription d’une séance de brouillon : 404, rien n’est révélé', async () => {
      const res = await joueur.agent
        .delete(`/scenarios/seances/${brouillon.seances[0].id}/inscription`)
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain('DESC-EPISODE-BROUILLON');
    });

    it('inscriptions ouvertes : la séance du brouillon n’est listée que pour le MJ', async () => {
      const query = { from: isoDay(0), to: isoDay(40) };
      const joueurCal = body<CalendarLike>(
        await joueur.agent.get('/me/calendar').query(query).expect(200),
      );
      expect(joueurCal['inscriptions-ouvertes'].map((s) => s.seanceId)).toEqual([
        aVenir.seances[0].id,
      ]);

      const mjCal = body<CalendarLike>(await mj.agent.get('/me/calendar').query(query).expect(200));
      expect(mjCal['inscriptions-ouvertes'].map((s) => s.seanceId).sort()).toEqual(
        [brouillon.seances[0].id, aVenir.seances[0].id].sort(),
      );
    });
  });

  describe('ONE_SHOT : exemption (scénario unique listé, contenu masqué, séances et vote utilisables)', () => {
    let partieId: string;
    let scenarioId: string;
    let seanceId: string;
    let poll: PollLike;

    beforeAll(async () => {
      partieId = await partie('ONE_SHOT', 'one-shot');
      const list = body<ScenarioLike[]>(
        await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      scenarioId = list[0].id;
      seanceId = list[0].seances[0].id;
      await mj.agent
        .patch(`/scenarios/${scenarioId}`)
        .send({ description: 'DESC-ONE-SHOT', dureeHeures: 4, dureeSeances: 1 })
        .expect(200);
      await mj.agent
        .patch(`/scenarios/seances/${seanceId}/compte-rendu`)
        .send({ compteRendu: 'CR-ONE-SHOT' })
        .expect(200);
      poll = await createPoll(mj, seanceId, [6, 7]);
      await uploadDoc(mj, partieId, scenarioId);
      await mj.agent
        .post(`/parties/${partieId}/announcements`)
        .send({ text: 'ANN-ONE-SHOT', scenarioId })
        .expect(201);
    });

    it('le joueur reçoit le scénario brouillon, contenu masqué, séance et vote conservés', async () => {
      const list = body<ScenarioLike[]>(
        await joueur.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: scenarioId,
        status: 'BROUILLON',
        description: null,
        dureeHeures: null,
        dureeSeances: null,
      });
      expect(list[0].seances).toHaveLength(1);
      expect(list[0].seances[0].compteRendu).toBeNull();
      expect(list[0].seances[0].poll?.id).toBe(poll.id);
      expect(JSON.stringify(list)).not.toContain('DESC-ONE-SHOT');
      expect(JSON.stringify(list)).not.toContain('CR-ONE-SHOT');

      const mjList = body<ScenarioLike[]>(
        await mj.agent.get(`/parties/${partieId}/scenarios`).expect(200),
      );
      expect(mjList[0]).toMatchObject({ description: 'DESC-ONE-SHOT', dureeHeures: 4 });
      expect(mjList[0].seances[0].compteRendu).toBe('CR-ONE-SHOT');
    });

    it('documents et annonces ciblés : masqués au joueur tant que le scénario est brouillon', async () => {
      const docs = body<DocLike[]>(
        await joueur.agent.get(`/scenarios/${scenarioId}/documents`).expect(200),
      );
      expect(docs).toEqual([]);

      const doc = await h.prisma.scenarioDocument.findFirstOrThrow({
        where: { partieId, scenarioId },
      });
      await joueur.agent.get(`/documents/${doc.id}`).expect(404);

      const anns = body<AnnouncementLike[]>(
        await joueur.agent.get(`/parties/${partieId}/announcements`).expect(200),
      );
      expect(anns).toEqual([]);
      const mjAnns = body<AnnouncementLike[]>(
        await mj.agent.get(`/parties/${partieId}/announcements`).expect(200),
      );
      expect(mjAnns.map((a) => a.text)).toEqual(['ANN-ONE-SHOT']);
    });

    it('le vote reste lisible et votable par le joueur, la date apparaît dans la prochaine séance', async () => {
      const res = await joueur.agent.get(`/parties/${partieId}/poll`).expect(200);
      expect(body<PollLike>(res).id).toBe(poll.id);

      await joueur.agent
        .post(`/parties/${partieId}/poll/${poll.id}/vote`)
        .send({ optionId: poll.options[0].id, answer: 'YES' })
        .expect(201);

      await mj.agent
        .patch(`/parties/${partieId}/poll/${poll.id}/choose`)
        .send({ optionId: poll.options[0].id })
        .expect(200);
      const p = body<PartieLike>(await joueur.agent.get(`/parties/${partieId}`).expect(200));
      expect(p.nextSessionDate).toBe(`${isoDay(6)}T00:00:00.000Z`);

      const cal = body<CalendarLike>(
        await joueur.agent
          .get('/me/calendar')
          .query({ from: isoDay(0), to: isoDay(40) })
          .expect(200),
      );
      expect(cal['mes-seances'].map((s) => s.seanceId)).toContain(seanceId);
    });

    it('la participation individuelle reste refusée par type de partie (400), comme avant', async () => {
      await joueur.agent.post(`/scenarios/${scenarioId}/participate`).expect(400);
    });
  });
});
