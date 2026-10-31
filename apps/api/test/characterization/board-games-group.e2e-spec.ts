import request from 'supertest';
import type { BoardGameDto, GroupBoardGamesDto } from '@master-jdr/shared';
import { RALLIEMENT_UNAVAILABLE_MESSAGE } from '../../src/permissions/permission.service';
import { Harness, body, keysOf, type Agent } from './harness';

/**
 * Story 50.1 — les jeux des membres d'un groupe : `GET /parties/:id/board-games`, gardé par `PARTIE_READ`,
 * groupe seulement. Matrice d'entrées/sorties de la spec, de bout en bout : regroupement par nom normalisé en
 * base, membres actuels seulement, refus d'une rencontre isolée et d'une partie de JDR, aucun e-mail.
 */
describe('Ludothèque — les jeux du groupe (Story 50.1)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const add = async (agent: Agent, payload: Record<string, unknown>): Promise<BoardGameDto> =>
    body<BoardGameDto>(await agent.post('/me/board-games').send(payload).expect(201));

  const read = (reader: { agent: Agent }, partieId: string) =>
    reader.agent.get(`/parties/${partieId}/board-games`);

  it('sans session : refusé (403)', async () => {
    const admin = await h.createUser('bg50-anonyme');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg50-anonyme', 'ralliement');

    await request(h.app.getHttpServer()).get(`/parties/${group.id}/board-games`).expect(403);
  });

  it('regroupe un même nom (casse et accents ignorés) : une entrée, deux propriétaires, aucun e-mail', async () => {
    const admin = await h.createUser('bg50-groupe-admin');
    const member = await h.createUser('bg50-groupe-membre');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg50-groupe', 'ralliement');
    await h.addMember(group.id, member);
    await add(admin.agent, { name: 'Azul', minPlayers: 2, maxPlayers: 4, durationMin: 40 });
    await add(member.agent, { name: 'ÀZUL', minPlayers: 1, maxPlayers: 9 });
    await add(member.agent, { name: 'Skull', minPlayers: 3, maxPlayers: 6, durationMin: 30 });

    const res = await read(member, group.id).expect(200);

    const dto = body<GroupBoardGamesDto>(res);
    expect(keysOf(dto)).toEqual(['games']);
    expect(dto.games.map((g) => g.nameKey)).toEqual(['azul', 'skull']);
    expect(keysOf(dto.games[0]).sort()).toEqual([
      'durationMin',
      'maxPlayers',
      'minPlayers',
      'name',
      'nameKey',
      'owners',
    ]);
    expect(dto.games[0].owners.map((o) => o.userId).sort()).toEqual([admin.id, member.id].sort());
    expect(dto.games[1].owners).toEqual([
      { userId: member.id, pseudo: member.pseudo, displayName: member.displayName },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('email');
    expect(JSON.stringify(res.body)).not.toContain(member.email);
    expect(JSON.stringify(res.body)).not.toContain(admin.email);
  });

  it('un ancien membre : ses jeux ne sont plus listés', async () => {
    const admin = await h.createUser('bg50-ancien-admin');
    const leaver = await h.createUser('bg50-ancien-parti');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg50-ancien', 'ralliement');
    await h.addMember(group.id, leaver);
    await add(admin.agent, { name: 'Azul' });
    await add(leaver.agent, { name: 'Skull' });
    expect(body<GroupBoardGamesDto>(await read(admin, group.id).expect(200)).games).toHaveLength(2);

    await h.prisma.membership.deleteMany({ where: { partieId: group.id, userId: leaver.id } });

    const after = body<GroupBoardGamesDto>(await read(admin, group.id).expect(200));
    expect(after.games.map((g) => g.nameKey)).toEqual(['azul']);
  });

  it('un jeu d’une personne d’un autre groupe n’apparaît pas', async () => {
    const admin = await h.createUser('bg50-autre-admin');
    const outsider = await h.createUser('bg50-autre-etranger');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg50-autre', 'ralliement');
    await add(outsider.agent, { name: 'Cascadia' });

    expect(body<GroupBoardGamesDto>(await read(admin, group.id).expect(200)).games).toEqual([]);
  });

  it('groupe sans jeu : 200 avec une liste vide', async () => {
    const admin = await h.createUser('bg50-vide-admin');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg50-vide', 'ralliement');

    const res = await read(admin, group.id).expect(200);

    expect(res.body).toEqual({ games: [] });
  });

  it('non-membre : refusé, sans rien révéler des jeux', async () => {
    const admin = await h.createUser('bg50-nonmembre-admin');
    const stranger = await h.createUser('bg50-nonmembre-etranger');
    const group = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'bg50-nonmembre',
      'ralliement',
    );
    await add(admin.agent, { name: 'Azul' });

    const res = await read(stranger, group.id).expect(403);

    expect(JSON.stringify(res.body)).not.toContain('azul');
  });

  it('partie inconnue : refusée', async () => {
    const me = await h.createUser('bg50-inconnue');

    await read(me, 'inconnue').expect(404);
  });

  it('rencontre isolée : refusée même à son hôte', async () => {
    const host = await h.createUser('bg50-rencontre-hote');
    const encounter = await h.createPartie(host, 'ONE_SHOT', 'bg50-rencontre', 'ralliement');
    await add(host.agent, { name: 'Azul' });

    const res = await read(host, encounter.id).expect(403);

    expect(body<{ message: string }>(res).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
  });

  it('partie de JDR : refusée même à son MJ', async () => {
    const mj = await h.createUser('bg50-jdr-mj');
    const jdr = await h.createPartie(mj, 'CAMPAGNE_EPISODIQUE', 'bg50-jdr');
    await add(mj.agent, { name: 'Azul' });

    const res = await read(mj, jdr.id).expect(403);

    expect(body<{ message: string }>(res).message).toBe(RALLIEMENT_UNAVAILABLE_MESSAGE);
  });
});
