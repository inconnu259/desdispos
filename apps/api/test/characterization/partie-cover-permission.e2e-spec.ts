import { Harness, body, type TestUser } from './harness';

// Story 53.5 — le serveur dit qui peut changer la couverture : `GET /parties/:id` et la liste servent
// `can.coverUpdate`, décidé par la même fonction que la garde `PARTIE_COVER_UPDATE` des routes de
// couverture. Le serveur reste seul juge : un joueur qui force un `PUT` reçoit toujours 403.

type PartieLike = { id: string; role: string; can: { coverUpdate: boolean } };

describe('Droit de changer la couverture servi (`can.coverUpdate`) — Story 53.5', () => {
  let h: Harness;
  let mj: TestUser;
  let player: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let jdrId: string;
  let groupId: string;

  beforeAll(async () => {
    h = await Harness.start();
    [mj, player, admin, member] = await Promise.all([
      h.createUser('cov-mj'),
      h.createUser('cov-joueur'),
      h.createUser('cov-admin'),
      h.createUser('cov-membre'),
    ]);
    ({ id: jdrId } = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'cov-jdr'));
    await h.addMember(jdrId, player);
    ({ id: groupId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'cov-groupe',
      'ralliement',
    ));
    await h.addMember(groupId, member);
  });

  afterAll(async () => {
    await h?.close();
  });

  const read = async (who: TestUser, id: string) =>
    body<PartieLike>(await who.agent.get(`/parties/${id}`).expect(200));
  const listed = async (who: TestUser, id: string) =>
    body<PartieLike[]>(await who.agent.get('/parties').expect(200)).find((p) => p.id === id)!;

  it.each([
    ['le MJ d’un JDR', () => mj, () => jdrId, true],
    ['un joueur d’un JDR', () => player, () => jdrId, false],
    ['un administrateur de groupe', () => admin, () => groupId, true],
    ['un simple membre de groupe', () => member, () => groupId, false],
  ])('%s : `can.coverUpdate` attendu', async (_label, who, id, expected) => {
    const viewer = who();
    expect((await read(viewer, id())).can).toEqual({ coverUpdate: expected });
    expect((await listed(viewer, id())).can).toEqual({ coverUpdate: expected });
  });

  it('un joueur qui force PUT /parties/:id/cover reçoit toujours 403', async () => {
    const res = await player.agent
      .put(`/parties/${jdrId}/cover`)
      .attach('file', Buffer.from('pas une image'), {
        filename: 'couverture.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(403);
  });

  it('un simple membre de groupe qui force DELETE /parties/:id/cover reçoit 403', async () => {
    await member.agent.delete(`/parties/${groupId}/cover`).expect(403);
  });
});
