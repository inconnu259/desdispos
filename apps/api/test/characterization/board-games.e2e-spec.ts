import request from 'supertest';
import type { BoardGameDto } from '@master-jdr/shared';
import {
  RealtimeEventsService,
  partieTopic,
  userTopic,
} from '../../src/realtime/realtime-events.service';
import { Harness, body, keysOf, type Agent } from './harness';

/**
 * Story 48.1 — ma Ludothèque : `GET`/`POST /me/board-games`. Matrice d'entrées/sorties de la spec,
 * de bout en bout (validation globale, unicité de la clé normalisée en base, tri, émission).
 */
describe('Ludothèque — ajouter mes jeux et les retrouver (Story 48.1)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const messageOf = (res: request.Response): string => {
    const message = body<{ message?: string | string[] }>(res).message;
    return Array.isArray(message) ? message.join(' ') : (message ?? '');
  };

  it('sans session : refusé, rien n’est lu ni écrit', async () => {
    const anonymous = request(h.app.getHttpServer());
    // `AuthenticatedGuard` refuse en 403 sur toute l'API (même garde que `DELETE /me`).
    await anonymous.get('/me/board-games').expect(403);
    await anonymous.post('/me/board-games').send({ name: 'Azul' }).expect(403);
  });

  it('création complète : 201, nom rogné, clé normalisée, forme exacte du DTO', async () => {
    const me = await h.createUser('bg-complet');

    const res = await me.agent
      .post('/me/board-games')
      .send({ name: ' Azul ', minPlayers: 2, maxPlayers: 4, durationMin: 40 })
      .expect(201);

    const dto = body<BoardGameDto>(res);
    expect(keysOf(dto)).toEqual(
      ['createdAt', 'durationMin', 'id', 'maxPlayers', 'minPlayers', 'name', 'nameKey'].sort(),
    );
    expect(dto).toMatchObject({
      name: 'Azul',
      nameKey: 'azul',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 40,
    });
    expect(new Date(dto.createdAt).toISOString()).toBe(dto.createdAt);
  });

  it('nom seul : 201, nombres à null', async () => {
    const me = await h.createUser('bg-nom');

    const res = await me.agent.post('/me/board-games').send({ name: 'Skull' }).expect(201);

    expect(body<BoardGameDto>(res)).toMatchObject({
      name: 'Skull',
      nameKey: 'skull',
      minPlayers: null,
      maxPlayers: null,
      durationMin: null,
    });
  });

  it('doublon (casse, accents, espaces ignorés) : 409 ; un autre compte peut avoir le même jeu', async () => {
    const me = await h.createUser('bg-doublon');
    const other = await h.createUser('bg-doublon-autre');
    await me.agent.post('/me/board-games').send({ name: 'Azul' }).expect(201);

    const res = await me.agent.post('/me/board-games').send({ name: '  ÀZUL ' });

    expect(res.status).toBe(409);
    expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(1);
    await other.agent.post('/me/board-games').send({ name: 'azul' }).expect(201);
  });

  it.each([
    ['nom vide', { name: '' }],
    ['nom blanc', { name: '   ' }],
    ['nom de 81 caractères', { name: 'x'.repeat(81) }],
    ['joueurs 0', { name: 'Azul', minPlayers: 0 }],
    ['joueurs 100', { name: 'Azul', maxPlayers: 100 }],
    ['joueurs 2.5', { name: 'Azul', minPlayers: 2.5 }],
    ['durée 0', { name: 'Azul', durationMin: 0 }],
    ['durée 1441', { name: 'Azul', durationMin: 1441 }],
    ['max 2 < min 3', { name: 'Azul', minPlayers: 3, maxPlayers: 2 }],
    // Le propriétaire vient de la session, jamais du corps : un `ownerId` fourni est refusé par la
    // liste blanche de la validation globale (message générique de class-validator, non traduit).
    ['ownerId fourni par le client', { name: 'Azul', ownerId: 'un-autre-compte' }],
  ])('%s : 400, rien n’est écrit', async (label, payload) => {
    const me = await h.createUser('bg-bornes');

    const res = await me.agent.post('/me/board-games').send(payload);

    expect(res.status).toBe(400);
    if (label === 'ownerId fourni par le client') {
      expect(messageOf(res)).toMatch(/ownerId/);
    } else {
      expect(messageOf(res)).toMatch(/jeu|joueurs|durée/);
      expect(messageOf(res)).not.toMatch(/must|should/);
    }
    expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(0);
    expect(await h.prisma.boardGame.count({ where: { ownerId: 'un-autre-compte' } })).toBe(0);
  });

  it('plafond : 500 jeux déjà présents → le 501ᵉ est refusé (400)', async () => {
    const me = await h.createUser('bg-plafond');
    await h.prisma.boardGame.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        ownerId: me.id,
        name: `Jeu ${i}`,
        nameKey: `jeu ${i}`,
      })),
    });

    const res = await me.agent.post('/me/board-games').send({ name: 'Le 501e' });

    expect(res.status).toBe(400);
    expect(messageOf(res)).toMatch(/500 jeux/);
    expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(500);
  });

  it('ordre : alphabétique sur la clé normalisée (accents et casse ignorés), seulement mes jeux', async () => {
    const me = await h.createUser('bg-ordre');
    const other = await h.createUser('bg-ordre-autre');
    for (const name of ['zèbre', 'Azul', 'éclipse']) {
      await me.agent.post('/me/board-games').send({ name }).expect(201);
    }
    await other.agent.post('/me/board-games').send({ name: 'Bohnanza' }).expect(201);

    const res = await me.agent.get('/me/board-games').expect(200);

    expect(body<BoardGameDto[]>(res).map((g) => g.name)).toEqual(['Azul', 'éclipse', 'zèbre']);
  });

  it('émission : `user:{moi}` et `partie:{ralliement}` seulement — jamais la partie de JDR', async () => {
    const me = await h.createUser('bg-emission');
    const gm = await h.createUser('bg-emission-mj');
    const group = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'bg-groupe', 'ralliement');
    const quest = await h.createPartie(gm, 'ONE_SHOT', 'bg-quete', 'ryuutama');
    await h.addMember(quest.id, me);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await me.agent.post('/me/board-games').send({ name: 'Codenames' }).expect(201);

      expect(emit).toHaveBeenCalledWith(userTopic(me.id));
      expect(emit).toHaveBeenCalledWith(partieTopic(group.id));
      expect(emit).not.toHaveBeenCalledWith(partieTopic(quest.id));
      expect(emit).toHaveBeenCalledTimes(2);
    } finally {
      emit.mockRestore();
    }
  });

  it('une émission en échec ne fait pas échouer la création (201 conservé)', async () => {
    const me = await h.createUser('bg-emission-ko');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit').mockImplementation(() => {
      throw new Error('panne');
    });
    try {
      await me.agent.post('/me/board-games').send({ name: 'Cascadia' }).expect(201);
    } finally {
      emit.mockRestore();
    }
    expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(1);
  });
});

/**
 * Story 48.2 — corriger ou retirer un jeu : `PATCH`/`DELETE /me/board-games/:id`. Matrice
 * d'entrées/sorties de la spec, de bout en bout (validation partielle, bornes fusionnées, unicité de
 * la clé, 404 hors de ma Ludothèque, émission).
 */
describe('Ludothèque — corriger ou retirer un jeu (Story 48.2)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const add = async (agent: Agent, payload: Record<string, unknown>): Promise<BoardGameDto> =>
    body<BoardGameDto>(await agent.post('/me/board-games').send(payload).expect(201));

  const messageOf = (res: request.Response): string => {
    const message = body<{ message?: string | string[] }>(res).message;
    return Array.isArray(message) ? message.join(' ') : (message ?? '');
  };

  it('sans session : refusé (403), rien n’est touché', async () => {
    const me = await h.createUser('bg2-anonyme');
    const azul = await add(me.agent, { name: 'Azul' });
    const anonymous = request(h.app.getHttpServer());

    await anonymous.patch(`/me/board-games/${azul.id}`).send({ name: 'Volé' }).expect(403);
    await anonymous.delete(`/me/board-games/${azul.id}`).expect(403);

    expect(await h.prisma.boardGame.findUnique({ where: { id: azul.id } })).toMatchObject({
      name: 'Azul',
    });
  });

  it('renommer : 200, nom rogné, clé recalculée, nombres conservés', async () => {
    const me = await h.createUser('bg2-renommer');
    const azul = await add(me.agent, {
      name: 'Azul',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 40,
    });

    const res = await me.agent
      .patch(`/me/board-games/${azul.id}`)
      .send({ name: ' Azul Summer ' })
      .expect(200);

    expect(body<BoardGameDto>(res)).toEqual({
      ...azul,
      name: 'Azul Summer',
      nameKey: 'azul summer',
    });
  });

  it('ne changer que la casse : 200 (le jeu ne se heurte pas à lui-même)', async () => {
    const me = await h.createUser('bg2-casse');
    const azul = await add(me.agent, { name: 'Azul' });

    const res = await me.agent
      .patch(`/me/board-games/${azul.id}`)
      .send({ name: 'AZUL' })
      .expect(200);

    expect(body<BoardGameDto>(res)).toMatchObject({ name: 'AZUL', nameKey: 'azul' });
  });

  it('renommer comme un autre de mes jeux : 409, rien ne change', async () => {
    const me = await h.createUser('bg2-heurt');
    await add(me.agent, { name: 'Azul' });
    const skull = await add(me.agent, { name: 'Skull' });

    const res = await me.agent.patch(`/me/board-games/${skull.id}`).send({ name: 'azul' });

    expect(res.status).toBe(409);
    expect(await h.prisma.boardGame.findUnique({ where: { id: skull.id } })).toMatchObject({
      name: 'Skull',
      nameKey: 'skull',
    });
  });

  it('bornes fusionnées : `{min:3,max:5}` puis `{maxPlayers:2}` → 400 en français', async () => {
    const me = await h.createUser('bg2-bornes');
    const game = await add(me.agent, { name: 'Azul', minPlayers: 3, maxPlayers: 5 });

    const res = await me.agent.patch(`/me/board-games/${game.id}`).send({ maxPlayers: 2 });

    expect(res.status).toBe(400);
    expect(messageOf(res)).toMatch(/joueurs/);
    expect(messageOf(res)).not.toMatch(/must|should/);
    expect(await h.prisma.boardGame.findUnique({ where: { id: game.id } })).toMatchObject({
      maxPlayers: 5,
    });
  });

  it('effacer un nombre : `{durationMin:null}` → 200, durée à null, le reste conservé', async () => {
    const me = await h.createUser('bg2-effacer');
    const game = await add(me.agent, { name: 'Azul', minPlayers: 2, durationMin: 40 });

    const res = await me.agent
      .patch(`/me/board-games/${game.id}`)
      .send({ durationMin: null })
      .expect(200);

    expect(body<BoardGameDto>(res)).toMatchObject({
      name: 'Azul',
      minPlayers: 2,
      durationMin: null,
    });
  });

  it.each([
    ['nom null', { name: null }],
    ['nom blanc', { name: '   ' }],
    ['nom de 81 caractères', { name: 'x'.repeat(81) }],
    ['joueurs 0', { minPlayers: 0 }],
    ['durée 1441', { durationMin: 1441 }],
  ])('%s : 400, rien ne change', async (_label, payload) => {
    const me = await h.createUser('bg2-invalide');
    const game = await add(me.agent, { name: 'Azul', minPlayers: 2, durationMin: 40 });

    const res = await me.agent.patch(`/me/board-games/${game.id}`).send(payload);

    expect(res.status).toBe(400);
    expect(messageOf(res)).toMatch(/jeu|joueurs|durée/);
    expect(await h.prisma.boardGame.findUnique({ where: { id: game.id } })).toMatchObject({
      name: 'Azul',
      minPlayers: 2,
      durationMin: 40,
    });
  });

  it('jeu d’autrui ou inconnu : 404 sur PATCH et DELETE, même message, rien ne change ni n’est émis', async () => {
    const me = await h.createUser('bg2-autrui');
    const other = await h.createUser('bg2-autrui-proprio');
    const theirs = await add(other.agent, { name: 'Azul', minPlayers: 2 });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const messages: string[] = [];
      for (const id of [theirs.id, 'identifiant-inconnu']) {
        const patch = await me.agent.patch(`/me/board-games/${id}`).send({ name: 'Volé' });
        expect(patch.status).toBe(404);
        messages.push(messageOf(patch));
        const del = await me.agent.delete(`/me/board-games/${id}`);
        expect(del.status).toBe(404);
        messages.push(messageOf(del));
      }
      expect(new Set(messages).size).toBe(1);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
    expect(await h.prisma.boardGame.findUnique({ where: { id: theirs.id } })).toMatchObject({
      ownerId: other.id,
      name: 'Azul',
      minPlayers: 2,
    });
  });

  it('retirer : 204, le jeu disparaît de la liste ; émet `user:{moi}` et `partie:{ralliement}`', async () => {
    const me = await h.createUser('bg2-retirer');
    const group = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'bg2-groupe', 'ralliement');
    const azul = await add(me.agent, { name: 'Azul' });
    await add(me.agent, { name: 'Skull' });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const res = await me.agent.delete(`/me/board-games/${azul.id}`).expect(204);
      expect(res.text).toBe('');
      expect(emit).toHaveBeenCalledWith(userTopic(me.id));
      expect(emit).toHaveBeenCalledWith(partieTopic(group.id));
      expect(emit).toHaveBeenCalledTimes(2);
    } finally {
      emit.mockRestore();
    }

    const list = await me.agent.get('/me/board-games').expect(200);
    expect(body<BoardGameDto[]>(list).map((g) => g.name)).toEqual(['Skull']);
  });

  it('corriger émet comme la création', async () => {
    const me = await h.createUser('bg2-emission');
    const group = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'bg2-groupe-e', 'ralliement');
    const azul = await add(me.agent, { name: 'Azul' });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await me.agent.patch(`/me/board-games/${azul.id}`).send({ durationMin: 30 }).expect(200);
      expect(emit).toHaveBeenCalledWith(userTopic(me.id));
      expect(emit).toHaveBeenCalledWith(partieTopic(group.id));
      expect(emit).toHaveBeenCalledTimes(2);
    } finally {
      emit.mockRestore();
    }
  });

  it('annuler un retrait : recréer `Azul 2–4 · 40` redonne les mêmes champs ; un doublon entre-temps → 409', async () => {
    const me = await h.createUser('bg2-annuler');
    const azul = await add(me.agent, {
      name: 'Azul',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 40,
    });
    await me.agent.delete(`/me/board-games/${azul.id}`).expect(204);

    const back = await add(me.agent, {
      name: azul.name,
      minPlayers: azul.minPlayers,
      maxPlayers: azul.maxPlayers,
      durationMin: azul.durationMin,
    });
    expect(back).toMatchObject({ name: 'Azul', minPlayers: 2, maxPlayers: 4, durationMin: 40 });

    // Le même jeu ressaisi entre-temps : la recréation se heurte au doublon.
    await me.agent.delete(`/me/board-games/${back.id}`).expect(204);
    await add(me.agent, { name: 'AZUL' });
    await me.agent.post('/me/board-games').send({ name: 'Azul' }).expect(409);
  });
});
