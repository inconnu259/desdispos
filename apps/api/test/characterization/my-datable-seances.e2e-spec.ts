import { RealtimeEventsService, userTopic } from '../../src/realtime/realtime-events.service';
import { Harness, body, isoDay, type TestUser } from './harness';

// Story 45.1 — `GET /me/datable-seances` contre la vraie base : les rendez-vous qui attendent une date et que
// JE peux dater, rien d'une partie dont je ne suis pas organisateur, rien de ce qui est figé (scénario
// clôturé, partie terminée ou masquée, sondage déjà lancé) — et chaque écriture qui change cet ensemble
// émet sur le canal `user:{id}` que la liste écoute.

type DatableLike = {
  seanceId: string;
  partieId: string;
  partieName: string;
  family: string;
  kind: string;
  title: string;
  seanceRank: number;
  seanceCount: number;
  can: { propose: boolean; edit: boolean; choose: boolean; extend: boolean };
};
type ScenarioLike = { id: string; seances: { id: string }[] };

describe('Mes rendez-vous à dater — GET /me/datable-seances (Story 45.1)', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let stranger: TestUser;
  let host: TestUser;
  let jdrId: string;
  let jdrName: string;
  let courant: ScenarioLike;

  const mine = async (who: TestUser) =>
    body<DatableLike[]>(await who.agent.get('/me/datable-seances').expect(200));
  const ids = (list: DatableLike[]) => list.map((d) => d.seanceId);

  async function newScenario(partieId: string, title: string): Promise<ScenarioLike> {
    const sc = body<ScenarioLike>(
      await mj.agent.post(`/parties/${partieId}/scenarios`).send({ title }).expect(201),
    );
    await mj.agent.patch(`/scenarios/${sc.id}/open`).expect(200);
    return sc;
  }

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, stranger, host] = await Promise.all([
      h.createUser('ds-mj'),
      h.createUser('ds-joueur'),
      h.createUser('ds-etranger'),
      h.createUser('ds-hote'),
    ]);
    ({ id: jdrId, name: jdrName } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'ds-jdr'));
    await h.addMember(jdrId, player);
    courant = await newScenario(jdrId, 'Courant');
  });

  afterAll(async () => {
    await h?.close();
  });

  it('le MJ voit la séance sans date de son scénario, avec ses droits ; la forme est exactement celle-là', async () => {
    const list = await mine(mj);
    const entry = list.find((d) => d.seanceId === courant.seances[0].id)!;
    expect(entry).toEqual({
      seanceId: courant.seances[0].id,
      partieId: jdrId,
      partieName: jdrName,
      family: 'jdr',
      kind: 'CAMPAGNE_LINEAIRE',
      title: 'Courant',
      seanceRank: 1,
      seanceCount: 1,
      durationSlots: 1,
      can: { propose: true, edit: true, choose: true, extend: false },
    });
  });

  it('refus : un joueur, un étranger ne reçoivent aucune séance de cette partie', async () => {
    expect(ids(await mine(player))).toEqual([]);
    expect(ids(await mine(stranger))).toEqual([]);
  });

  it('une seconde séance porte son rang et le nombre de séances de l’événement', async () => {
    const res = body<ScenarioLike>(
      await mj.agent.post(`/scenarios/${courant.id}/seances`).expect(201),
    );
    const second = res.seances[1].id;
    const list = await mine(mj);
    expect(list.find((d) => d.seanceId === second)).toMatchObject({
      seanceRank: 2,
      seanceCount: 2,
    });
    expect(list.find((d) => d.seanceId === courant.seances[0].id)).toMatchObject({
      seanceRank: 1,
      seanceCount: 2,
    });
    await mj.agent.delete(`/scenarios/seances/${second}`).expect(200);
  });

  it('un sondage lancé (ouvert) retire la séance, la remise à zéro de la date la ramène', async () => {
    const seanceId = courant.seances[0].id;
    await mj.agent
      .post(`/scenarios/seances/${seanceId}/poll`)
      .send({
        options: [
          { date: isoDay(20), slot: 'EVENING' },
          { date: isoDay(21), slot: 'EVENING' },
        ],
      })
      .expect(201);
    expect(ids(await mine(mj))).not.toContain(seanceId);

    await mj.agent.patch(`/scenarios/seances/${seanceId}/reset-date`).expect(200);
    expect(ids(await mine(mj))).toContain(seanceId);
  });

  it('un scénario clôturé, une partie masquée ou terminée disparaissent', async () => {
    const closing = await newScenario(jdrId, 'À clôturer');
    const seanceId = closing.seances[0].id;
    expect(ids(await mine(mj))).toContain(seanceId);
    await mj.agent.patch(`/scenarios/${closing.id}/courant`).expect(200);
    await mj.agent.patch(`/scenarios/${closing.id}/passe`).expect(200);
    expect(ids(await mine(mj))).not.toContain(seanceId);

    const { id: autreId } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'ds-autre');
    const autre = await newScenario(autreId, 'Autre');
    const autreSeance = autre.seances[0].id;
    expect(ids(await mine(mj))).toContain(autreSeance);
    await h.prisma.partieHidden.create({ data: { userId: mj.id, partieId: autreId } });
    expect(ids(await mine(mj))).not.toContain(autreSeance);
    await h.prisma.partieHidden.deleteMany({ where: { partieId: autreId } });
    await mj.agent.patch(`/parties/${autreId}/close`).expect(200);
    expect(ids(await mine(mj))).not.toContain(autreSeance);
  });

  describe('soirée isolée (famille ralliement)', () => {
    let eveningId: string;

    beforeAll(async () => {
      ({ id: eveningId } = await h.createPartie(host, 'ONE_SHOT', 'ds-soiree', 'ralliement'));
    });

    it('l’hôte voit sa soirée sans date ; un membre non hôte et un étranger non', async () => {
      const entry = (await mine(host)).find((d) => d.partieId === eveningId);
      expect(entry).toMatchObject({
        family: 'ralliement',
        kind: 'ONE_SHOT',
        can: { propose: true, edit: true, choose: true, extend: true },
      });
      const guest = await h.createUser('ds-invite');
      await h.addMember(eveningId, guest);
      expect((await mine(guest)).filter((d) => d.partieId === eveningId)).toEqual([]);
      expect((await mine(stranger)).filter((d) => d.partieId === eveningId)).toEqual([]);
    });

    it('annulée, la soirée n’attend plus de date', async () => {
      const cards = body<{ id: string }[]>(
        await host.agent.get(`/parties/${eveningId}/events/list`).expect(200),
      );
      await host.agent.post(`/parties/${eveningId}/events/${cards[0].id}/cancel`).expect(201);
      expect((await mine(host)).filter((d) => d.partieId === eveningId)).toEqual([]);
    });
  });

  describe('chaque écriture qui change l’ensemble « à dater » émet sur user:{organisateur}', () => {
    let emit: jest.SpyInstance;
    /** L'organisateur de la partie qui écrit — le canal que sa liste écoute. */
    let organizer: TestUser;

    beforeAll(() => {
      emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    });
    afterAll(() => emit.mockRestore());

    const notifies = async (who: TestUser, write: () => Promise<unknown>) => {
      organizer = who;
      emit.mockClear();
      await write();
      expect(emit).toHaveBeenCalledWith(userTopic(organizer.id));
    };

    it('JDR : ajouter une séance, la supprimer, lancer le vote, remettre la date à zéro, clôturer le scénario', async () => {
      const sc = await newScenario(jdrId, 'Notifs');
      let added = '';
      await notifies(mj, async () => {
        const res = body<ScenarioLike>(
          await mj.agent.post(`/scenarios/${sc.id}/seances`).expect(201),
        );
        added = res.seances[1].id;
      });
      await notifies(mj, () => mj.agent.delete(`/scenarios/seances/${added}`).expect(200));
      const seanceId = sc.seances[0].id;
      await notifies(mj, () =>
        mj.agent
          .post(`/scenarios/seances/${seanceId}/poll`)
          .send({
            options: [
              { date: isoDay(30), slot: 'EVENING' },
              { date: isoDay(31), slot: 'EVENING' },
            ],
          })
          .expect(201),
      );
      await notifies(mj, () =>
        mj.agent.patch(`/scenarios/seances/${seanceId}/reset-date`).expect(200),
      );
      await notifies(mj, async () => {
        await mj.agent.patch(`/scenarios/${sc.id}/courant`).expect(200);
        await mj.agent.patch(`/scenarios/${sc.id}/passe`).expect(200);
      });
    });

    it('soirée isolée : l’annuler prévient', async () => {
      const { id } = await h.createPartie(host, 'ONE_SHOT', 'ds-soiree-n', 'ralliement');
      const cards = body<{ id: string }[]>(
        await host.agent.get(`/parties/${id}/events/list`).expect(200),
      );
      await notifies(host, () =>
        host.agent.post(`/parties/${id}/events/${cards[0].id}/cancel`).expect(201),
      );
    });

    it('terminer la partie prévient', async () => {
      const { id } = await h.createPartie(mj, 'CAMPAGNE_LINEAIRE', 'ds-close');
      await notifies(mj, () => mj.agent.patch(`/parties/${id}/close`).expect(200));
    });
  });
});
