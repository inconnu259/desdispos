import request from 'supertest';
import type { HostCountsDto } from '@master-jdr/shared';
import { RALLIEMENT_UNAVAILABLE_MESSAGE } from '../../src/permissions/permission.service';
import { Harness, body, isoDay, type TestUser } from './harness';

/**
 * Story 50.2 — le Compteur d'hôte d'un groupe : `GET /parties/:id/host-counts`, gardé par `PARTIE_READ`, groupe
 * seulement. Matrice d'entrées/sorties de la spec, de bout en bout : seules comptent les conjonctions passées et
 * non annulées, hébergées par un membre ACTUEL ; rien n'est stocké.
 */
describe('Compteur d’hôte — qui reçoit (Story 50.2)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const read = (reader: TestUser, partieId: string) =>
    reader.agent.get(`/parties/${partieId}/host-counts`);

  /** Une conjonction proposée par `who`, qui en est l'hôte ; `ageDays` la repousse dans le passé (en base). */
  const host = async (who: TestUser, groupId: string, title: string, ageDays?: number) => {
    const res = await who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title, date: isoDay(6), slot: 'EVENING', capacity: 6 });
    expect(res.status).toBe(201);
    const event = body<{ id: string; seance: { id: string } }>(res);
    if (ageDays !== undefined) await age(event.seance.id, ageDays);
    return event;
  };

  const age = (seanceId: string, daysAgo: number) =>
    h.prisma.seance.update({
      where: { id: seanceId },
      data: {
        startDate: new Date(`${isoDay(-daysAgo)}T00:00:00.000Z`),
        endDate: new Date(`${isoDay(-daysAgo)}T00:00:00.000Z`),
      },
    });

  it('sans session : refusé (403)', async () => {
    const admin = await h.createUser('hc-anonyme');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'hc-anonyme', 'ralliement');

    await request(h.app.getHttpServer()).get(`/parties/${group.id}/host-counts`).expect(403);
  });

  it('compte les conjonctions passées par hôte, du plus au moins, les membres sans hôtellerie à 0', async () => {
    const admin = await h.createUser('hc-admin');
    const lea = await h.createUser('hc-lea');
    const tom = await h.createUser('hc-tom');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'hc-compte', 'ralliement');
    await h.addMember(group.id, lea);
    await h.addMember(group.id, tom);
    await host(lea, group.id, 'Léa 1', 3);
    await host(lea, group.id, 'Léa 2', 9);
    await host(tom, group.id, 'Tom 1', 5);

    const res = await read(tom, group.id).expect(200);

    const dto = body<HostCountsDto>(res);
    expect(dto.members.map((m) => [m.userId, m.count])).toEqual([
      [lea.id, 2],
      [tom.id, 1],
      [admin.id, 0],
    ]);
    expect(Object.keys(dto.members[0]).sort()).toEqual([
      'count',
      'displayName',
      'pseudo',
      'userId',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('email');
    expect(JSON.stringify(res.body)).not.toContain(lea.email);
  });

  it('une conjonction à venir, ou annulée, ne compte pas', async () => {
    const admin = await h.createUser('hc-exclu-admin');
    const lea = await h.createUser('hc-exclu-lea');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'hc-exclu', 'ralliement');
    await h.addMember(group.id, lea);
    await host(lea, group.id, 'À venir');
    const cancelled = await host(lea, group.id, 'Annulée');
    await lea.agent.post(`/parties/${group.id}/events/${cancelled.id}/cancel`).send({}).expect(201);
    await age(cancelled.seance.id, 4);
    await host(lea, group.id, 'Passée', 4);

    const dto = body<HostCountsDto>(await read(admin, group.id).expect(200));

    expect(dto.members.find((m) => m.userId === lea.id)?.count).toBe(1);
  });

  it('un ancien membre : absent, et ses conjonctions ne sont attribuées à personne', async () => {
    const admin = await h.createUser('hc-ancien-admin');
    const leaver = await h.createUser('hc-ancien-parti');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'hc-ancien', 'ralliement');
    await h.addMember(group.id, leaver);
    await host(leaver, group.id, 'Reçue puis parti', 2);
    expect(
      body<HostCountsDto>(await read(admin, group.id).expect(200)).members.find(
        (m) => m.userId === leaver.id,
      )?.count,
    ).toBe(1);

    await h.prisma.membership.deleteMany({ where: { partieId: group.id, userId: leaver.id } });

    const dto = body<HostCountsDto>(await read(admin, group.id).expect(200));
    expect(dto.members.map((m) => m.userId)).toEqual([admin.id]);
    expect(dto.members[0].count).toBe(0);
  });

  it('non-membre : refusé', async () => {
    const admin = await h.createUser('hc-nonmembre-admin');
    const stranger = await h.createUser('hc-nonmembre-etranger');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'hc-nonmembre', 'ralliement');

    await read(stranger, group.id).expect(403);
  });

  it('rencontre isolée : refusée même à son hôte', async () => {
    const hostUser = await h.createUser('hc-rencontre-hote');
    const encounter = await h.createPartie(hostUser, 'ONE_SHOT', 'hc-rencontre', 'ralliement');

    const res = await read(hostUser, encounter.id).expect(403);

    expect(body<{ message: string }>(res).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
  });

  it('partie de JDR : refusée même à son MJ', async () => {
    const mj = await h.createUser('hc-jdr-mj');
    const jdr = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'hc-jdr');

    const res = await read(mj, jdr.id).expect(403);

    expect(body<{ message: string }>(res).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
  });
});
