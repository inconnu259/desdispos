import request from 'supertest';
import type {
  BoardGameBroughtCountDto,
  BoardGameDto,
  EventBoardGamesDto,
  EventEnvyDto,
  UserLibraryDto,
} from '@master-jdr/shared';
import {
  RealtimeEventsService,
  partieTopic,
  userTopic,
} from '../../src/realtime/realtime-events.service';
import { Harness, body, isoDay, keysOf, type Agent } from './harness';

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

/**
 * Story 48.3 — lire la Ludothèque d'une personne : `GET /users/:userId/board-games`, gardé par la
 * décision `LIBRARY_READ` de `PermissionService`. Matrice d'entrées/sorties de la spec, de bout en
 * bout : tout refus — compte inconnu compris — est le même 404, au même corps.
 */
describe('Ludothèque — consulter celle d’une personne (Story 48.3)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const add = async (agent: Agent, payload: Record<string, unknown>): Promise<BoardGameDto> =>
    body<BoardGameDto>(await agent.post('/me/board-games').send(payload).expect(201));

  const read = (reader: { agent: Agent }, userId: string) =>
    reader.agent.get(`/users/${userId}/board-games`);

  /** Invitation posée directement en base : seul l'état `status` compte pour la décision. */
  const invite = (
    partieId: string,
    inviter: { id: string },
    invitee: { id: string },
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED',
  ) =>
    h.prisma.invitation.create({
      data: { partieId, inviterId: inviter.id, inviteeUserId: invitee.id, status },
    });

  it('sans session : refusé (403)', async () => {
    const me = await h.createUser('bg3-anonyme');
    await request(h.app.getHttpServer()).get(`/users/${me.id}/board-games`).expect(403);
  });

  it('soi-même : 200, sa propre Ludothèque', async () => {
    const me = await h.createUser('bg3-soi');
    await add(me.agent, { name: 'Azul' });

    const res = await read(me, me.id).expect(200);

    expect(body<UserLibraryDto>(res).owner.userId).toBe(me.id);
    expect(body<UserLibraryDto>(res).games.map((g) => g.name)).toEqual(['Azul']);
  });

  it('deux membres d’un même groupe : 200 `{ owner, games }`, jeux triés, aucun e-mail', async () => {
    const admin = await h.createUser('bg3-groupe-admin');
    const member = await h.createUser('bg3-groupe-membre');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg3-groupe', 'ralliement');
    await h.addMember(group.id, member);
    await add(member.agent, { name: 'Skull', minPlayers: 3, maxPlayers: 6, durationMin: 30 });
    await add(member.agent, { name: 'Azul' });

    const res = await read(admin, member.id).expect(200);

    const dto = body<UserLibraryDto>(res);
    expect(keysOf(dto)).toEqual(['games', 'owner']);
    expect(dto.owner).toEqual({
      userId: member.id,
      pseudo: member.pseudo,
      displayName: member.displayName,
    });
    expect(dto.games.map((g) => g.name)).toEqual(['Azul', 'Skull']);
    expect(JSON.stringify(res.body)).not.toContain('email');
    expect(JSON.stringify(res.body)).not.toContain(member.email);
    // Dans l'autre sens aussi.
    await read(member, admin.id).expect(200);
  });

  it('rencontre isolée acceptée : deux membres → 200', async () => {
    const host = await h.createUser('bg3-rencontre-hote');
    const guest = await h.createUser('bg3-rencontre-invite');
    const encounter = await h.createPartie(host, 'ONE_SHOT', 'bg3-rencontre', 'ralliement');
    await h.addMember(encounter.id, guest);
    await invite(encounter.id, host, guest, 'ACCEPTED');
    await add(guest.agent, { name: 'Azul' });

    await read(host, guest.id).expect(200);
    await read(guest, host.id).expect(200);
  });

  it('rencontre isolée, invité `PENDING` : l’hôte lit sa Ludothèque, et l’inverse', async () => {
    const host = await h.createUser('bg3-pending-hote');
    const invitee = await h.createUser('bg3-pending-invite');
    const encounter = await h.createPartie(host, 'ONE_SHOT', 'bg3-pending', 'ralliement');
    await invite(encounter.id, host, invitee, 'PENDING');
    await add(invitee.agent, { name: 'Azul' });
    await add(host.agent, { name: 'Skull' });

    const fromHost = await read(host, invitee.id).expect(200);
    expect(body<UserLibraryDto>(fromHost).games.map((g) => g.name)).toEqual(['Azul']);
    const fromInvitee = await read(invitee, host.id).expect(200);
    expect(body<UserLibraryDto>(fromInvitee).games.map((g) => g.name)).toEqual(['Skull']);
  });

  it.each(['DECLINED', 'REVOKED'] as const)(
    'rencontre isolée, invitation %s : 404 dans les deux sens',
    async (status) => {
      const host = await h.createUser(`bg3-${status}-hote`);
      const invitee = await h.createUser(`bg3-${status}-invite`);
      const encounter = await h.createPartie(host, 'ONE_SHOT', `bg3-${status}`, 'ralliement');
      await invite(encounter.id, host, invitee, status);
      await add(invitee.agent, { name: 'Azul' });

      await read(host, invitee.id).expect(404);
      await read(invitee, host.id).expect(404);
    },
  );

  it('deux invités `PENDING` d’une même rencontre isolée : 200', async () => {
    const host = await h.createUser('bg3-deux-hote');
    const a = await h.createUser('bg3-deux-a');
    const b = await h.createUser('bg3-deux-b');
    const encounter = await h.createPartie(host, 'ONE_SHOT', 'bg3-deux', 'ralliement');
    await invite(encounter.id, host, a, 'PENDING');
    await invite(encounter.id, host, b, 'PENDING');

    await read(a, b.id).expect(200);
  });

  it('une invitation en attente à un GROUPE (pas une rencontre isolée) n’ouvre rien : 404', async () => {
    const admin = await h.createUser('bg3-grp-pending-admin');
    const invitee = await h.createUser('bg3-grp-pending-invite');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg3-grp-pend', 'ralliement');
    await invite(group.id, admin, invitee, 'PENDING');

    await read(admin, invitee.id).expect(404);
    await read(invitee, admin.id).expect(404);
  });

  it('partie de JDR seulement : 404 même entre le MJ et son joueur', async () => {
    const mj = await h.createUser('bg3-jdr-mj');
    const player = await h.createUser('bg3-jdr-joueur');
    const jdr = await h.createPartie(mj, 'ONE_SHOT', 'bg3-jdr');
    await h.addMember(jdr.id, player);
    await add(player.agent, { name: 'Azul' });

    await read(mj, player.id).expect(404);
    await read(player, mj.id).expect(404);
  });

  it('lien d’invitation jamais utilisé : 404', async () => {
    const admin = await h.createUser('bg3-lien-admin');
    const stranger = await h.createUser('bg3-lien-etranger');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg3-lien', 'ralliement');
    await h.prisma.inviteLink.create({
      data: {
        token: `bg3-${h.suffix}`,
        partieId: group.id,
        createdById: admin.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await read(admin, stranger.id).expect(404);
    await read(stranger, admin.id).expect(404);
  });

  it('inconnu : 404, corps identique à un refus de droit', async () => {
    const me = await h.createUser('bg3-inconnu');
    const other = await h.createUser('bg3-inconnu-autre');

    const unknown = await read(me, 'identifiant-inexistant').expect(404);
    const forbidden = await read(me, other.id).expect(404);

    expect(unknown.body).toEqual(forbidden.body);
  });

  it('Ludothèque vide d’une personne autorisée : 200, `games: []`', async () => {
    const admin = await h.createUser('bg3-vide-admin');
    const member = await h.createUser('bg3-vide-membre');
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bg3-vide', 'ralliement');
    await h.addMember(group.id, member);

    const res = await read(admin, member.id).expect(200);

    expect(body<UserLibraryDto>(res).games).toEqual([]);
  });
});

/**
 * Story 49.1 — voir les jeux de l'hôte avant la soirée : `GET /events/:eventId/board-games`. Matrice
 * d'entrées/sorties de la spec, de bout en bout (droit `PARTIE_READ`, N de `participantsOf`, statut
 * partagé, aucune émission sur une lecture).
 */
describe('Jeux sur place — voir les jeux de l’hôte avant la soirée (Story 49.1)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const UNAVAILABLE = "Cette action n'est pas disponible pour ce type de partie";
  const UNKNOWN_ID = '4f9a7f0e-2c1b-4b8e-9d34-0a5c6e7f8a9b';

  const addGame = (u: Agent, name: string, over: Record<string, unknown> = {}) =>
    u
      .post('/me/board-games')
      .send({ name, ...over })
      .expect(201);
  const read = (who: { agent: Agent }, eventId: string) =>
    who.agent.get(`/events/${eventId}/board-games`);
  type Card = { id: string; seance: { id: string } };
  const propose = async (
    who: { agent: Agent },
    groupId: string,
    over: Record<string, unknown> = {},
  ) =>
    body<Card>(
      await who.agent
        .post(`/parties/${groupId}/events`)
        .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING', ...over })
        .expect(201),
    );
  const signUp = (who: { agent: Agent }, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`).expect(201);

  /** Un groupe, son hôte (membre) et trois autres membres. */
  async function setupGroup(label: string) {
    const admin = await h.createUser(`bg49-${label}-admin`);
    const host = await h.createUser(`bg49-${label}-hote`);
    const guest = await h.createUser(`bg49-${label}-invite`);
    const other = await h.createUser(`bg49-${label}-autre`);
    const group = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', `bg49-${label}`, 'ralliement');
    for (const u of [host, guest, other]) await h.addMember(group.id, u);
    return { admin, host, guest, other, groupId: group.id };
  }

  it('groupe à venir : les jeux de l’hôte (ordre alphabétique), N = hôte + 2 inscrits confirmés', async () => {
    const { host, guest, other, groupId } = await setupGroup('avenir');
    for (const name of ['Zombicide', 'Azul', 'éclipse']) await addGame(host.agent, name);
    const card = await propose(host, groupId);
    await signUp(guest, card.seance.id);
    await signUp(other, card.seance.id);

    const res = await read(guest, card.id).expect(200);

    const dto = body<EventBoardGamesDto>(res);
    expect(dto.games.map((g) => g.name)).toEqual(['Azul', 'éclipse', 'Zombicide']);
    expect(dto.participantsCount).toBe(3);
    expect(keysOf(dto)).toEqual(['brings', 'envies', 'games', 'participantsCount']);
    expect(keysOf(dto.games[0])).toEqual(
      ['createdAt', 'durationMin', 'id', 'maxPlayers', 'minPlayers', 'name', 'nameKey'].sort(),
    );
    // Les jeux d'un invité ne sont jamais ceux de l'hôte.
    await addGame(guest.agent, 'Skull');
    expect(body<EventBoardGamesDto>(await read(guest, card.id).expect(200)).games).toHaveLength(3);
  });

  it('place réservée : jamais comptée ; acceptée, elle l’est', async () => {
    const { host, guest, other, groupId } = await setupGroup('reserve');
    const card = await propose(host, groupId, { capacity: 6, reservedUserIds: [other.id] });
    await signUp(guest, card.seance.id);

    expect(body<EventBoardGamesDto>(await read(host, card.id).expect(200)).participantsCount).toBe(
      2,
    );

    await other.agent.patch(`/scenarios/seances/${card.seance.id}/inscription/accept`).expect(200);

    expect(body<EventBoardGamesDto>(await read(host, card.id).expect(200)).participantsCount).toBe(
      3,
    );
  });

  it('membre non inscrit : 200 en lecture, N inchangé', async () => {
    const { host, other, groupId } = await setupGroup('lecteur');
    await addGame(host.agent, 'Azul');
    const card = await propose(host, groupId);

    const dto = body<EventBoardGamesDto>(await read(other, card.id).expect(200));

    expect(dto.participantsCount).toBe(1);
    expect(dto.games).toHaveLength(1);
  });

  it('rencontre isolée : N vient des membres de la partie (l’hôte compris)', async () => {
    const admin = await h.createUser('bg49-iso-admin');
    const m1 = await h.createUser('bg49-iso-m1');
    const m2 = await h.createUser('bg49-iso-m2');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg49-iso', 'ralliement');
    await h.addMember(evening.id, m1);
    await h.addMember(evening.id, m2);
    await addGame(admin.agent, 'Codenames');
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });

    const dto = body<EventBoardGamesDto>(await read(m1, event.id).expect(200));

    expect(dto.participantsCount).toBe(3);
    expect(dto.games.map((g) => g.name)).toEqual(['Codenames']);
  });

  it('bibliothèque vide de l’hôte : `games: []`', async () => {
    const { host, groupId } = await setupGroup('vide');
    const card = await propose(host, groupId);

    // Story 49.4 : l'hôte lit aussi `excludedGames` (vide ici).
    expect(body<EventBoardGamesDto>(await read(host, card.id).expect(200))).toEqual({
      games: [],
      brings: [],
      participantsCount: 1,
      envies: [],
      excludedGames: [],
    });
  });

  it('soirée passée : `games: []`, N tel que calculé', async () => {
    const { host, guest, groupId } = await setupGroup('passee');
    await addGame(host.agent, 'Azul');
    const card = await propose(host, groupId);
    await signUp(guest, card.seance.id);
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: card.seance.id },
      data: { startDate: day, endDate: day },
    });

    expect(body<EventBoardGamesDto>(await read(guest, card.id).expect(200))).toEqual({
      games: [],
      brings: [],
      participantsCount: 2,
      envies: [],
    });
  });

  it('soirée annulée : `games: []`', async () => {
    const { host, guest, groupId } = await setupGroup('annulee');
    await addGame(host.agent, 'Azul');
    const card = await propose(host, groupId);
    await host.agent.post(`/parties/${groupId}/events/${card.id}/cancel`).expect(201);

    expect(body<EventBoardGamesDto>(await read(guest, card.id).expect(200)).games).toEqual([]);
  });

  it('rencontre isolée close ou à la date passée : `games: []`', async () => {
    const admin = await h.createUser('bg49-fin-admin');
    await addGame(admin.agent, 'Azul');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg49-fin', 'ralliement');
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    expect(body<EventBoardGamesDto>(await read(admin, event.id).expect(200)).games).toHaveLength(1);

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: new Date() } });
    expect(body<EventBoardGamesDto>(await read(admin, event.id).expect(200))).toEqual({
      games: [],
      brings: [],
      participantsCount: 1,
      envies: [],
      excludedGames: [],
    });

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: null } });
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId: event.id } });
    const day = new Date(`${isoDay(-3)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: seance.id },
      data: { startDate: day, endDate: day },
    });
    expect(body<EventBoardGamesDto>(await read(admin, event.id).expect(200)).games).toEqual([]);
  });

  it('hôte sans compte (Event.ownerId nul) : `games: []`', async () => {
    const { host, guest, groupId } = await setupGroup('sans-hote');
    await addGame(host.agent, 'Azul');
    const card = await propose(host, groupId);
    await signUp(guest, card.seance.id);
    await h.prisma.event.update({ where: { id: card.id }, data: { ownerId: null } });

    expect(body<EventBoardGamesDto>(await read(guest, card.id).expect(200))).toEqual({
      games: [],
      brings: [],
      participantsCount: 1,
      envies: [],
    });
  });

  it('étranger à la partie : 403, comme PARTIE_READ', async () => {
    const { host, groupId } = await setupGroup('etranger');
    const stranger = await h.createUser('bg49-etranger');
    const card = await propose(host, groupId);

    await read(stranger, card.id).expect(403);
  });

  it('partie de JDR : 403 « indisponible », même à son MJ', async () => {
    const gm = await h.createUser('bg49-jdr-mj');
    const player = await h.createUser('bg49-jdr-joueur');
    const jdr = await h.createPartie(gm, 'ONE_SHOT', 'bg49-jdr');
    await h.addMember(jdr.id, player);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: jdr.id } });

    for (const who of [gm, player]) {
      const res = await read(who, event.id).expect(403);
      expect(body<{ message: string }>(res).message).toBe(UNAVAILABLE);
    }
  });

  it('événement inconnu : 404 ; identifiant mal formé : 400 ; sans session : 403', async () => {
    const me = await h.createUser('bg49-inconnu');

    await read(me, UNKNOWN_ID).expect(404);
    await read(me, 'pas-un-uuid').expect(400);
    await request(h.app.getHttpServer()).get(`/events/${UNKNOWN_ID}/board-games`).expect(403);
  });

  it('une lecture n’émet rien', async () => {
    const { host, groupId } = await setupGroup('emission');
    const card = await propose(host, groupId);
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await read(host, card.id).expect(200);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });
});

/**
 * Story 49.2 — dire ce que j'apporte, et voir les doublons : `PUT/DELETE /events/:eventId/board-games/:id/bring`,
 * les apports dans la lecture, `GET /me/board-games/:id/brought-count`. Matrice d'entrées/sorties de la spec, de
 * bout en bout (droit `EVENT_GAME_BRING`, verrou de la soirée, refus dans l'ordre, cascade, émission).
 */
describe('Jeux sur place — dire ce que j’apporte, et voir les doublons (Story 49.2)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const UNKNOWN_ID = '4f9a7f0e-2c1b-4b8e-9d34-0a5c6e7f8a9b';

  const addGame = async (u: { agent: Agent }, name: string): Promise<BoardGameDto> =>
    body<BoardGameDto>(await u.agent.post('/me/board-games').send({ name }).expect(201));
  const bringUrl = (eventId: string, gameId: string) =>
    `/events/${eventId}/board-games/${gameId}/bring`;
  const read = async (who: { agent: Agent }, eventId: string) =>
    body<EventBoardGamesDto>(await who.agent.get(`/events/${eventId}/board-games`).expect(200));
  type Card = { id: string; seance: { id: string } };
  const propose = async (
    who: { agent: Agent },
    groupId: string,
    over: Record<string, unknown> = {},
  ) =>
    body<Card>(
      await who.agent
        .post(`/parties/${groupId}/events`)
        .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING', ...over })
        .expect(201),
    );
  const signUp = (who: { agent: Agent }, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`).expect(201);
  const messageOf = (res: request.Response) => body<{ message?: string }>(res).message;
  const bringCount = (eventId: string) => h.prisma.eventGameBring.count({ where: { eventId } });

  /** Un groupe, son hôte (membre), deux invités inscrits et un membre non inscrit ; une conjonction à venir. */
  async function setup(label: string) {
    const admin = await h.createUser(`bg492-${label}-admin`);
    const host = await h.createUser(`bg492-${label}-hote`);
    const zoe = await h.createUser(`bg492-${label}-zoe`);
    const yan = await h.createUser(`bg492-${label}-yan`);
    const outsider = await h.createUser(`bg492-${label}-hors`);
    const group = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      `bg492-${label}`,
      'ralliement',
    );
    for (const u of [host, zoe, yan, outsider]) await h.addMember(group.id, u);
    const card = await propose(host, group.id);
    await signUp(zoe, card.seance.id);
    await signUp(yan, card.seance.id);
    return { admin, host, zoe, yan, outsider, groupId: group.id, card };
  }

  it('apporter : 204, l’apport est lu par tous avec son porteur (pseudo, nom affiché — jamais d’e-mail)', async () => {
    const { host, zoe, outsider, card } = await setup('bring');
    const azul = await addGame(zoe, 'Azul');

    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);

    for (const viewer of [host, zoe, outsider]) {
      const dto = await read(viewer, card.id);
      expect(dto.brings).toHaveLength(1);
      expect(dto.brings[0].game).toEqual(azul);
      expect(dto.brings[0].bringer).toEqual({
        userId: zoe.id,
        pseudo: zoe.pseudo,
        displayName: zoe.displayName,
      });
      expect(keysOf(dto.brings[0])).toEqual(['bringer', 'game']);
      expect(keysOf(dto.brings[0].bringer)).toEqual(['displayName', 'pseudo', 'userId']);
      expect(JSON.stringify(dto)).not.toContain(zoe.email);
    }
  });

  it('apporter deux fois : 204 et une seule ligne ; retirer deux fois : 204', async () => {
    const { zoe, card } = await setup('idempotent');
    const azul = await addGame(zoe, 'Azul');

    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    expect(await bringCount(card.id)).toBe(1);

    await zoe.agent.delete(bringUrl(card.id, azul.id)).expect(204);
    await zoe.agent.delete(bringUrl(card.id, azul.id)).expect(204);
    expect(await bringCount(card.id)).toBe(0);
    expect((await read(zoe, card.id)).brings).toEqual([]);
  });

  it('retirer ne touche que MON apport ; le jeu d’autrui est un 404', async () => {
    const { zoe, yan, card } = await setup('mien');
    const azul = await addGame(zoe, 'Azul');
    const skull = await addGame(yan, 'Skull');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await yan.agent.put(bringUrl(card.id, skull.id)).expect(204);

    await yan.agent.delete(bringUrl(card.id, azul.id)).expect(404);
    await yan.agent.put(bringUrl(card.id, azul.id)).expect(404);
    expect(await bringCount(card.id)).toBe(2);

    await zoe.agent.delete(bringUrl(card.id, azul.id)).expect(204);
    expect((await read(zoe, card.id)).brings.map((b) => b.game.name)).toEqual(['Skull']);
  });

  it('doublons : l’hôte a « Azul », Zoé apporte « azul » — les deux lignes portent la même clé', async () => {
    const { host, zoe, card } = await setup('doublon');
    await addGame(host, 'Azul');
    const mine = await addGame(zoe, 'azul');
    await zoe.agent.put(bringUrl(card.id, mine.id)).expect(204);

    const dto = await read(zoe, card.id);

    expect(dto.games.map((g) => g.nameKey)).toEqual(['azul']);
    expect(dto.brings.map((b) => b.game.nameKey)).toEqual(['azul']);
  });

  it('ordre de la lecture : celui des jeux (clé normalisée, puis nom)', async () => {
    const { zoe, yan, card } = await setup('ordre');
    for (const [who, name] of [
      [zoe, 'Skull'],
      [zoe, 'Azul'],
      [yan, 'azul'],
    ] as const) {
      const game = await addGame(who, name);
      await who.agent.put(bringUrl(card.id, game.id)).expect(204);
    }

    const dto = await read(zoe, card.id);

    expect(dto.brings.map((b) => b.game.nameKey)).toEqual(['azul', 'azul', 'skull']);
  });

  it('émission : `partie:{groupe}` après chaque écriture, jamais sur une lecture ni sur un refus', async () => {
    const { zoe, outsider, groupId, card } = await setup('emission');
    const azul = await addGame(zoe, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await zoe.agent.delete(bringUrl(card.id, azul.id)).expect(204);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await read(zoe, card.id);
      await outsider.agent.put(bringUrl(card.id, azul.id)).expect(403);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });

  it('une émission en échec ne fait pas échouer l’apport (204 conservé, ligne écrite)', async () => {
    const { zoe, card } = await setup('emission-ko');
    const azul = await addGame(zoe, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit').mockImplementation(() => {
      throw new Error('flux coupé');
    });
    try {
      await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    } finally {
      emit.mockRestore();
    }
    expect(await bringCount(card.id)).toBe(1);
  });

  it('soirée annulée : 400 en français, rien n’est écrit ; la lecture ne montre plus d’apport', async () => {
    const { host, zoe, groupId, card } = await setup('annulee');
    const azul = await addGame(zoe, 'Azul');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await host.agent.post(`/parties/${groupId}/events/${card.id}/cancel`).expect(201);

    const put = await zoe.agent.put(bringUrl(card.id, azul.id)).expect(400);
    const del = await zoe.agent.delete(bringUrl(card.id, azul.id)).expect(400);

    expect(messageOf(put)).toBe('Cette conjonction est annulée : plus rien ne peut y changer');
    expect(messageOf(del)).toBe(messageOf(put));
    expect(await bringCount(card.id)).toBe(1);
    expect((await read(zoe, card.id)).brings).toEqual([]);
  });

  it('soirée passée : 400 en français, rien n’est écrit', async () => {
    const { zoe, card } = await setup('passee');
    const azul = await addGame(zoe, 'Azul');
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: card.seance.id },
      data: { startDate: day, endDate: day },
    });

    const res = await zoe.agent.put(bringUrl(card.id, azul.id)).expect(400);

    expect(messageOf(res)).toBe(
      'Cette conjonction est passée : les inscriptions ne peuvent plus changer',
    );
    expect(await bringCount(card.id)).toBe(0);
  });

  it('rencontre isolée : un membre apporte ; close ou annulée → 400 « soirée »', async () => {
    const admin = await h.createUser('bg492-iso-admin');
    const m1 = await h.createUser('bg492-iso-m1');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg492-iso', 'ralliement');
    await h.addMember(evening.id, m1);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const game = await addGame(m1, 'Codenames');

    await m1.agent.put(bringUrl(event.id, game.id)).expect(204);
    expect((await read(admin, event.id)).brings).toHaveLength(1);

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: new Date() } });
    const closed = await m1.agent.put(bringUrl(event.id, game.id)).expect(400);
    expect(messageOf(closed)).toBe('Cette soirée est terminée : plus rien ne peut y changer');
    expect((await read(admin, event.id)).brings).toEqual([]);

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: null } });
    await h.prisma.event.update({ where: { id: event.id }, data: { cancelledAt: new Date() } });
    const cancelled = await m1.agent.put(bringUrl(event.id, game.id)).expect(400);
    expect(messageOf(cancelled)).toBe('Cette soirée est annulée : plus rien ne peut y changer');
  });

  it('un membre non inscrit, un étranger, une place RÉSERVÉE : 403, rien n’est écrit', async () => {
    const { host, outsider, zoe, groupId } = await setup('refus');
    const stranger = await h.createUser('bg492-refus-etranger');
    const card = await propose(host, groupId, { capacity: 6, reservedUserIds: [outsider.id] });
    await signUp(zoe, card.seance.id);

    for (const who of [outsider, stranger]) {
      const game = await addGame(who, 'Azul');
      await who.agent.put(bringUrl(card.id, game.id)).expect(403);
      await who.agent.delete(bringUrl(card.id, game.id)).expect(403);
    }
    expect(await bringCount(card.id)).toBe(0);
  });

  it('l’hôte ne peut rien apporter à sa propre soirée : 403, rien n’est écrit', async () => {
    const { host, card } = await setup('hote');
    const game = await addGame(host, 'Azul');

    await host.agent.put(bringUrl(card.id, game.id)).expect(403);

    expect(await bringCount(card.id)).toBe(0);
  });

  it('jeu d’autrui ou inconnu : 404, même corps, rien n’est écrit', async () => {
    const { host, zoe, card } = await setup('autrui');
    const theirs = await addGame(host, 'Azul');

    const other = await zoe.agent.put(bringUrl(card.id, theirs.id)).expect(404);
    const unknown = await zoe.agent.put(bringUrl(card.id, UNKNOWN_ID)).expect(404);

    expect(body<unknown>(other)).toEqual(body<unknown>(unknown));
    expect(await bringCount(card.id)).toBe(0);
  });

  it('partie de JDR : 403 pour son MJ comme pour son joueur ; identifiants mal formés : 400 ; sans session : 403', async () => {
    const gm = await h.createUser('bg492-jdr-mj');
    const player = await h.createUser('bg492-jdr-joueur');
    const jdr = await h.createPartie(gm, 'ONE_SHOT', 'bg492-jdr');
    await h.addMember(jdr.id, player);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: jdr.id } });
    const game = await addGame(player, 'Azul');

    for (const who of [gm, player]) {
      await who.agent.put(bringUrl(event.id, game.id)).expect(403);
    }
    await player.agent.put(bringUrl('pas-un-uuid', game.id)).expect(400);
    await player.agent.put(bringUrl(event.id, 'pas-un-uuid')).expect(400);
    await player.agent.put(bringUrl(UNKNOWN_ID, game.id)).expect(404);
    await request(h.app.getHttpServer()).put(bringUrl(event.id, game.id)).expect(403);
    expect(await bringCount(event.id)).toBe(0);
  });

  it('un participant parti : son apport n’est plus lu (et, depuis la Story 49.3, plus écrit)', async () => {
    const { zoe, yan, card } = await setup('parti');
    const azul = await addGame(zoe, 'Azul');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);

    await zoe.agent.delete(`/scenarios/seances/${card.seance.id}/inscription`).expect(200);

    expect((await read(yan, card.id)).brings).toEqual([]);
    expect(await bringCount(card.id)).toBe(0);
  });

  it('brought-count : seules les soirées encore ouvertes comptent ; jeu d’autrui ou inconnu → 404', async () => {
    const { zoe, host, groupId, card } = await setup('compte');
    const azul = await addGame(zoe, 'Azul');
    const count = async (who: { agent: Agent }, id: string) =>
      body<BoardGameBroughtCountDto>(
        await who.agent.get(`/me/board-games/${id}/brought-count`).expect(200),
      );
    expect(await count(zoe, azul.id)).toEqual({ count: 0 });

    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    const second = await propose(host, groupId, { date: isoDay(9) });
    await signUp(zoe, second.seance.id);
    await zoe.agent.put(bringUrl(second.id, azul.id)).expect(204);
    expect(await count(zoe, azul.id)).toEqual({ count: 2 });

    // Une soirée passée ne compte plus (son apport reste en base, mais plus rien n'y change).
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: second.seance.id },
      data: { startDate: day, endDate: day },
    });
    expect(await count(zoe, azul.id)).toEqual({ count: 1 });

    await host.agent.get(`/me/board-games/${azul.id}/brought-count`).expect(404);
    await zoe.agent.get(`/me/board-games/${UNKNOWN_ID}/brought-count`).expect(404);
    await zoe.agent.get('/me/board-games/pas-un-uuid/brought-count').expect(400);
    await request(h.app.getHttpServer())
      .get(`/me/board-games/${azul.id}/brought-count`)
      .expect(403);
  });

  it('retirer le jeu de ma Ludothèque retire ses apports, et prévient les onglets de la soirée', async () => {
    const { zoe, groupId, card } = await setup('cascade');
    const azul = await addGame(zoe, 'Azul');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await zoe.agent.delete(`/me/board-games/${azul.id}`).expect(204);

      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
    } finally {
      emit.mockRestore();
    }
    expect(await bringCount(card.id)).toBe(0);
    expect((await read(zoe, card.id)).brings).toEqual([]);
  });

  // ─── Story 49.3 — ne plus rien apporter quand on ne vient plus ──────────────────────────────

  const seedBring = (eventId: string, userId: string, boardGameId: string) =>
    h.prisma.eventGameBring.create({ data: { eventId, userId, boardGameId } });
  const broughtCountOf = async (who: { agent: Agent }, boardGameId: string) =>
    body<BoardGameBroughtCountDto>(
      await who.agent.get(`/me/board-games/${boardGameId}/brought-count`).expect(200),
    );

  it('49.3 — se désinscrire : ses apports partent, ceux des autres restent, `partie:` est émis ; se réinscrire ne les ressuscite pas', async () => {
    const { zoe, yan, groupId, card } = await setup('493-desinscrit');
    const azul = await addGame(zoe, 'Azul');
    const skull = await addGame(zoe, 'Skull');
    const uno = await addGame(yan, 'Uno');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);
    await yan.agent.put(bringUrl(card.id, uno.id)).expect(204);
    expect(await broughtCountOf(zoe, azul.id)).toEqual({ count: 1 });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await zoe.agent.delete(`/scenarios/seances/${card.seance.id}/inscription`).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
    } finally {
      emit.mockRestore();
    }

    expect(await bringCount(card.id)).toBe(1);
    expect((await read(yan, card.id)).brings.map((b) => b.game.name)).toEqual(['Uno']);
    // La boîte de retrait de la Ludothèque ne compte plus cette soirée.
    expect(await broughtCountOf(zoe, azul.id)).toEqual({ count: 0 });

    await signUp(zoe, card.seance.id);
    expect((await read(yan, card.id)).brings.map((b) => b.game.name)).toEqual(['Uno']);
    expect(await bringCount(card.id)).toBe(1);
  });

  it('49.3 — refuser une place réservée : ses apports (posés en base) partent ; la promotion en confirmé ne touche à rien', async () => {
    const { host, outsider, zoe, groupId } = await setup('493-reserve');
    const mine = await addGame(outsider, 'Azul');
    const accepted = await propose(host, groupId, { capacity: 6, reservedUserIds: [outsider.id] });
    const declined = await propose(host, groupId, {
      capacity: 6,
      reservedUserIds: [outsider.id],
      date: isoDay(8),
    });
    await signUp(zoe, accepted.seance.id);
    await seedBring(accepted.id, outsider.id, mine.id);
    await seedBring(declined.id, outsider.id, mine.id);

    // Promotion RESERVED → CONFIRMED : rien n'est supprimé.
    await outsider.agent
      .patch(`/scenarios/seances/${accepted.seance.id}/inscription/accept`)
      .expect(200);
    expect(await bringCount(accepted.id)).toBe(1);

    // Refus de la place réservée de l'autre soirée : la ligne de réservation et les apports partent.
    await outsider.agent.delete(`/scenarios/seances/${declined.seance.id}/inscription`).expect(200);
    expect(await bringCount(declined.id)).toBe(0);
    expect(await bringCount(accepted.id)).toBe(1);
  });

  it('49.3 — l’hôte retire une réservation : les apports (posés en base) de la personne partent, ceux des autres restent', async () => {
    const { host, outsider, zoe, groupId } = await setup('493-retrait');
    const mine = await addGame(outsider, 'Azul');
    const hers = await addGame(zoe, 'Skull');
    const card = await propose(host, groupId, { capacity: 6, reservedUserIds: [outsider.id] });
    await signUp(zoe, card.seance.id);
    await zoe.agent.put(bringUrl(card.id, hers.id)).expect(204);
    await seedBring(card.id, outsider.id, mine.id);

    await host.agent
      .delete(`/scenarios/seances/${card.seance.id}/reservations/${outsider.id}`)
      .expect(200);

    expect(await bringCount(card.id)).toBe(1);
    expect((await read(zoe, card.id)).brings.map((b) => b.game.name)).toEqual(['Skull']);
  });

  it('49.3 — retirer une réservation ne touche pas aux apports d’une inscription CONFIRMÉE', async () => {
    const { host, zoe, card } = await setup('493-confirme');
    const hers = await addGame(zoe, 'Skull');
    await zoe.agent.put(bringUrl(card.id, hers.id)).expect(204);

    await host.agent
      .delete(`/scenarios/seances/${card.seance.id}/reservations/${zoe.id}`)
      .expect(200);

    expect(await bringCount(card.id)).toBe(1);
  });

  it('49.3 — quitter le groupe : les apports des soirées à venir partent, ceux d’une soirée passée restent', async () => {
    const { host, zoe, yan, groupId, card } = await setup('493-depart');
    const second = await propose(host, groupId, { date: isoDay(9) });
    await signUp(zoe, second.seance.id);
    const azul = await addGame(zoe, 'Azul');
    const skull = await addGame(zoe, 'Skull');
    const uno = await addGame(yan, 'Uno');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);
    await zoe.agent.put(bringUrl(second.id, azul.id)).expect(204);
    await yan.agent.put(bringUrl(card.id, uno.id)).expect(204);
    // La seconde soirée devient passée (les écritures sont alors refusées, la ligne reste en base).
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: second.seance.id },
      data: { startDate: day, endDate: day },
    });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await zoe.agent.delete(`/parties/${groupId}/members/me`).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
    } finally {
      emit.mockRestore();
    }

    expect((await read(yan, card.id)).brings.map((b) => b.game.name)).toEqual(['Uno']);
    expect(await bringCount(card.id)).toBe(1);
    expect(await bringCount(second.id)).toBe(1);
  });

  it('49.3 — retrait par un administrateur : les apports à venir de la cible partent, ceux des autres restent', async () => {
    const { admin, zoe, yan, groupId, card } = await setup('493-retire');
    const azul = await addGame(zoe, 'Azul');
    const uno = await addGame(yan, 'Uno');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await yan.agent.put(bringUrl(card.id, uno.id)).expect(204);

    await admin.agent.delete(`/parties/${groupId}/members/${zoe.id}`).expect(200);

    expect(await bringCount(card.id)).toBe(1);
    expect((await read(yan, card.id)).brings.map((b) => b.game.name)).toEqual(['Uno']);
  });

  it('49.3 — effacement du compte : les apports du compte partent, ceux des autres restent', async () => {
    const { zoe, yan, card } = await setup('493-compte');
    const azul = await addGame(zoe, 'Azul');
    const uno = await addGame(yan, 'Uno');
    await zoe.agent.put(bringUrl(card.id, azul.id)).expect(204);
    await yan.agent.put(bringUrl(card.id, uno.id)).expect(204);

    await zoe.agent.delete('/me').send({ password: h.userPassword }).expect(200);

    expect(await h.prisma.eventGameBring.count({ where: { userId: zoe.id } })).toBe(0);
    expect((await read(yan, card.id)).brings.map((b) => b.game.name)).toEqual(['Uno']);
  });

  it('49.3 — rencontre isolée : l’administrateur retire un membre, ses apports partent (trouvés par `Event.partieId`)', async () => {
    const admin = await h.createUser('bg493-iso-admin');
    const m1 = await h.createUser('bg493-iso-m1');
    const m2 = await h.createUser('bg493-iso-m2');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg493-iso', 'ralliement');
    await h.addMember(evening.id, m1);
    await h.addMember(evening.id, m2);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const codenames = await addGame(m1, 'Codenames');
    const skull = await addGame(m2, 'Skull');
    await m1.agent.put(bringUrl(event.id, codenames.id)).expect(204);
    await m2.agent.put(bringUrl(event.id, skull.id)).expect(204);

    await admin.agent.delete(`/parties/${evening.id}/members/${m1.id}`).expect(200);

    expect(await bringCount(event.id)).toBe(1);
    expect((await read(admin, event.id)).brings.map((b) => b.game.name)).toEqual(['Skull']);
  });

  it('49.3 — refuser une invitation à une rencontre isolée ne change aucun apport', async () => {
    const admin = await h.createUser('bg493-inv-admin');
    const m1 = await h.createUser('bg493-inv-m1');
    const invitee = await h.createUser('bg493-inv-invite');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg493-inv', 'ralliement');
    await h.addMember(evening.id, m1);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const codenames = await addGame(m1, 'Codenames');
    await m1.agent.put(bringUrl(event.id, codenames.id)).expect(204);
    await admin.agent
      .post(`/parties/${evening.id}/invitations`)
      .send({ inviteeUserId: invitee.id })
      .expect(201);
    const [invitation] = body<{ id: string }[]>(
      await invitee.agent.get('/invitations').expect(200),
    );

    await invitee.agent.post(`/invitations/${invitation.id}/decline`).expect(201);

    expect(await bringCount(event.id)).toBe(1);
    expect((await read(admin, event.id)).brings.map((b) => b.game.name)).toEqual(['Codenames']);
  });
});

/**
 * Story 49.4 — écarter un jeu pour ce soir (hôte) : `PUT/DELETE /events/:eventId/board-games/:id/exclusion`, les
 * jeux écartés dans la lecture. Matrice d'entrées/sorties de la spec, de bout en bout (droit `EVENT_GAME_EXCLUDE`
 * réservé à l'hôte, verrou de la soirée, refus dans l'ordre, cascade, émission, lecture par rôle).
 */
describe('Jeux sur place — écarter un jeu pour ce soir (Story 49.4)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const UNKNOWN_ID = '4f9a7f0e-2c1b-4b8e-9d34-0a5c6e7f8a9b';

  const addGame = async (u: { agent: Agent }, name: string): Promise<BoardGameDto> =>
    body<BoardGameDto>(await u.agent.post('/me/board-games').send({ name }).expect(201));
  const exclusionUrl = (eventId: string, gameId: string) =>
    `/events/${eventId}/board-games/${gameId}/exclusion`;
  const bringUrl = (eventId: string, gameId: string) =>
    `/events/${eventId}/board-games/${gameId}/bring`;
  const read = async (who: { agent: Agent }, eventId: string) =>
    body<EventBoardGamesDto>(await who.agent.get(`/events/${eventId}/board-games`).expect(200));
  type Card = { id: string; seance: { id: string } };
  const propose = async (who: { agent: Agent }, groupId: string) =>
    body<Card>(
      await who.agent
        .post(`/parties/${groupId}/events`)
        .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING' })
        .expect(201),
    );
  const signUp = (who: { agent: Agent }, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`).expect(201);
  const messageOf = (res: request.Response) => body<{ message?: string }>(res).message;
  const excludedCount = (eventId: string) =>
    h.prisma.eventGameExcluded.count({ where: { eventId } });

  /** Un groupe, son administrateur, son hôte (membre), un invité inscrit et un membre non inscrit. */
  async function setup(label: string) {
    const admin = await h.createUser(`bg494-${label}-admin`);
    const host = await h.createUser(`bg494-${label}-hote`);
    const zoe = await h.createUser(`bg494-${label}-zoe`);
    const outsider = await h.createUser(`bg494-${label}-hors`);
    const group = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      `bg494-${label}`,
      'ralliement',
    );
    for (const u of [host, zoe, outsider]) await h.addMember(group.id, u);
    const card = await propose(host, group.id);
    await signUp(zoe, card.seance.id);
    return { admin, host, zoe, outsider, groupId: group.id, card };
  }

  it('écarter : 204 ; le jeu quitte `games` pour tous et entre dans `excludedGames` de l’hôte SEUL', async () => {
    const { admin, host, zoe, outsider, card } = await setup('ecarter');
    const azul = await addGame(host, 'Azul');
    const brass = await addGame(host, 'Brass');

    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    const hostView = await read(host, card.id);
    expect(hostView.games.map((g) => g.name)).toEqual(['Brass']);
    expect(hostView.excludedGames).toEqual([azul]);
    for (const viewer of [zoe, outsider, admin]) {
      const dto = await read(viewer, card.id);
      expect(dto.games).toEqual([brass]);
      // La clé est absente : la réponse elle-même ne dit rien du jeu écarté.
      expect(keysOf(dto)).toEqual(['brings', 'envies', 'games', 'participantsCount']);
      expect(JSON.stringify(dto)).not.toContain('Azul');
    }
  });

  it('remettre : 204 ; le jeu revient dans `games` pour tous, `excludedGames` se vide', async () => {
    const { host, zoe, card } = await setup('remettre');
    const azul = await addGame(host, 'Azul');
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(204);

    expect((await read(zoe, card.id)).games).toEqual([azul]);
    const hostView = await read(host, card.id);
    expect(hostView.games).toEqual([azul]);
    expect(hostView.excludedGames).toEqual([]);
  });

  it('écarter deux fois : 204 et une seule ligne ; remettre deux fois : 204', async () => {
    const { host, card } = await setup('idempotent');
    const azul = await addGame(host, 'Azul');

    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
    expect(await excludedCount(card.id)).toBe(1);

    await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(204);
    await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(204);
    expect(await excludedCount(card.id)).toBe(0);
  });

  it('un jeu écarté pour une soirée reste sur les autres soirées', async () => {
    const { host, zoe, groupId, card } = await setup('autre-soiree');
    const azul = await addGame(host, 'Azul');
    const second = await propose(host, groupId);
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    expect((await read(zoe, card.id)).games).toEqual([]);
    expect((await read(zoe, second.id)).games).toEqual([azul]);
  });

  it('un membre non hôte, un administrateur, un invité : 403 « réservée à l’hôte », rien n’est écrit ni émis', async () => {
    const { admin, zoe, outsider, host, card } = await setup('non-hote');
    const azul = await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      for (const who of [admin, zoe, outsider]) {
        const put = await who.agent.put(exclusionUrl(card.id, azul.id)).expect(403);
        await who.agent.delete(exclusionUrl(card.id, azul.id)).expect(403);
        expect(messageOf(put)).toBe("Action réservée à l'hôte de la conjonction");
      }
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
    expect(await excludedCount(card.id)).toBe(0);
  });

  it('un étranger à la partie : 403 ; sans session : 403', async () => {
    const { host, card } = await setup('etranger');
    const stranger = await h.createUser('bg494-etranger');
    const azul = await addGame(host, 'Azul');

    await stranger.agent.put(exclusionUrl(card.id, azul.id)).expect(403);
    await request(h.app.getHttpServer()).put(exclusionUrl(card.id, azul.id)).expect(403);
    expect(await excludedCount(card.id)).toBe(0);
  });

  it('un événement sans hôte (ownerId nul) : refusé à tous (403)', async () => {
    const { admin, host, card } = await setup('sans-hote');
    const azul = await addGame(host, 'Azul');
    await h.prisma.event.update({ where: { id: card.id }, data: { ownerId: null } });

    await admin.agent.put(exclusionUrl(card.id, azul.id)).expect(403);
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(403);
    expect(await excludedCount(card.id)).toBe(0);
  });

  it('soirée annulée : 400 en français, rien n’est écrit ; la lecture ne liste plus rien', async () => {
    const { host, groupId, card } = await setup('annulee');
    const azul = await addGame(host, 'Azul');
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
    await host.agent.post(`/parties/${groupId}/events/${card.id}/cancel`).expect(201);

    const put = await host.agent.put(exclusionUrl(card.id, azul.id)).expect(400);
    const del = await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(400);

    expect(messageOf(put)).toBe('Cette conjonction est annulée : plus rien ne peut y changer');
    expect(messageOf(del)).toBe(messageOf(put));
    expect(await excludedCount(card.id)).toBe(1);
    const dto = await read(host, card.id);
    expect(dto.games).toEqual([]);
    expect(dto.excludedGames).toEqual([]);
  });

  it('soirée passée : 400 en français, rien n’est écrit ; l’hôte lit `excludedGames: []`', async () => {
    const { host, zoe, card } = await setup('passee');
    const azul = await addGame(host, 'Azul');
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: card.seance.id },
      data: { startDate: day, endDate: day },
    });

    const res = await host.agent.put(exclusionUrl(card.id, azul.id)).expect(400);

    expect(messageOf(res)).toBe(
      'Cette conjonction est passée : les inscriptions ne peuvent plus changer',
    );
    expect(await excludedCount(card.id)).toBe(0);
    expect((await read(host, card.id)).excludedGames).toEqual([]);
    expect('excludedGames' in (await read(zoe, card.id))).toBe(false);
  });

  it('rencontre isolée : l’hôte écarte ; close → 400 « terminée », annulée → 400 « annulée »', async () => {
    const admin = await h.createUser('bg494-iso-admin');
    const m1 = await h.createUser('bg494-iso-m1');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg494-iso', 'ralliement');
    await h.addMember(evening.id, m1);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const game = await addGame(admin, 'Codenames');

    await admin.agent.put(exclusionUrl(event.id, game.id)).expect(204);
    expect((await read(m1, event.id)).games).toEqual([]);
    expect((await read(admin, event.id)).excludedGames).toEqual([game]);
    await m1.agent.put(exclusionUrl(event.id, game.id)).expect(403);

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: new Date() } });
    const closed = await admin.agent.put(exclusionUrl(event.id, game.id)).expect(400);
    expect(messageOf(closed)).toBe('Cette soirée est terminée : plus rien ne peut y changer');

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: null } });
    await h.prisma.event.update({ where: { id: event.id }, data: { cancelledAt: new Date() } });
    const cancelled = await admin.agent.put(exclusionUrl(event.id, game.id)).expect(400);
    expect(messageOf(cancelled)).toBe('Cette soirée est annulée : plus rien ne peut y changer');
  });

  it('jeu d’autrui ou inconnu : 404, même corps, rien n’est écrit', async () => {
    const { host, zoe, card } = await setup('autrui');
    const hers = await addGame(zoe, 'Skull');

    const other = await host.agent.put(exclusionUrl(card.id, hers.id)).expect(404);
    const unknown = await host.agent.put(exclusionUrl(card.id, UNKNOWN_ID)).expect(404);
    await host.agent.delete(exclusionUrl(card.id, hers.id)).expect(404);

    expect(body<unknown>(other)).toEqual(body<unknown>(unknown));
    expect(await excludedCount(card.id)).toBe(0);
  });

  it('partie de JDR : 403 ; identifiants mal formés : 400 ; événement inconnu : 404', async () => {
    const gm = await h.createUser('bg494-jdr-mj');
    const jdr = await h.createPartie(gm, 'ONE_SHOT', 'bg494-jdr');
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: jdr.id } });
    const game = await addGame(gm, 'Azul');

    await gm.agent.put(exclusionUrl(event.id, game.id)).expect(403);
    await gm.agent.put(exclusionUrl('pas-un-uuid', game.id)).expect(400);
    await gm.agent.put(exclusionUrl(event.id, 'pas-un-uuid')).expect(400);
    await gm.agent.put(exclusionUrl(UNKNOWN_ID, game.id)).expect(404);
    expect(await excludedCount(event.id)).toBe(0);
  });

  it('émission : `partie:{groupe}` après chaque écriture, jamais sur une lecture ni sur un refus', async () => {
    const { host, zoe, groupId, card } = await setup('emission');
    const azul = await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(204);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await read(host, card.id);
      await zoe.agent.put(exclusionUrl(card.id, azul.id)).expect(403);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });

  it('une émission en échec ne fait pas échouer l’écart (204 conservé, ligne écrite)', async () => {
    const { host, card } = await setup('emission-ko');
    const azul = await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit').mockImplementation(() => {
      throw new Error('flux coupé');
    });
    try {
      await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
    } finally {
      emit.mockRestore();
    }
    expect(await excludedCount(card.id)).toBe(1);
  });

  it('doublon : « Azul » de l’hôte écarté, Zoé apporte « azul » — seul l’apport reste sur place', async () => {
    const { host, zoe, card } = await setup('doublon');
    const hostAzul = await addGame(host, 'Azul');
    const mine = await addGame(zoe, 'azul');
    await zoe.agent.put(bringUrl(card.id, mine.id)).expect(204);
    await host.agent.put(exclusionUrl(card.id, hostAzul.id)).expect(204);

    const dto = await read(zoe, card.id);

    expect(dto.games).toEqual([]);
    expect(dto.brings.map((b) => b.game.nameKey)).toEqual(['azul']);
  });

  it('tout est écarté : `games` vide, tous les jeux dans `excludedGames` (triés)', async () => {
    const { host, card } = await setup('tout');
    const zombicide = await addGame(host, 'Zombicide');
    const azul = await addGame(host, 'Azul');
    for (const g of [zombicide, azul])
      await host.agent.put(exclusionUrl(card.id, g.id)).expect(204);

    const dto = await read(host, card.id);

    expect(dto.games).toEqual([]);
    expect(dto.excludedGames).toEqual([azul, zombicide]);
  });

  it('un invité qui apporte garde son apport quand l’hôte écarte un jeu (apports et N inchangés)', async () => {
    const { host, zoe, card } = await setup('apports');
    const azul = await addGame(host, 'Azul');
    const skull = await addGame(zoe, 'Skull');
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);

    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    const dto = await read(zoe, card.id);
    expect(dto.brings.map((b) => b.game.name)).toEqual(['Skull']);
    expect(dto.participantsCount).toBe(2);
  });

  it('retirer le jeu de la Ludothèque supprime son écart (cascade)', async () => {
    const { host, card } = await setup('cascade');
    const azul = await addGame(host, 'Azul');
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);
    expect(await excludedCount(card.id)).toBe(1);

    await host.agent.delete(`/me/board-games/${azul.id}`).expect(204);

    expect(await excludedCount(card.id)).toBe(0);
    expect((await read(host, card.id)).excludedGames).toEqual([]);
  });

  it('l’écart disparaît avec la soirée (cascade sur l’événement)', async () => {
    const { host, card } = await setup('cascade-event');
    const azul = await addGame(host, 'Azul');
    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    await h.prisma.event.delete({ where: { id: card.id } });

    expect(await excludedCount(card.id)).toBe(0);
  });
});

/**
 * Story 49.5 — signaler une Envie : `PUT/DELETE /events/:eventId/envies` (corps `{ nameKey }`), `envies` dans la
 * lecture. Matrice d'entrées/sorties de la spec, de bout en bout (droit `EVENT_GAME_ENVY`, verrou de la soirée,
 * refus dans l'ordre, nom « sur place », purge dans la transaction de chaque chemin qui retire une source ou un
 * participant, cascade, émission, lecture).
 */
describe('Jeux sur place — signaler une Envie (Story 49.5)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const addGame = async (u: { agent: Agent }, name: string): Promise<BoardGameDto> =>
    body<BoardGameDto>(await u.agent.post('/me/board-games').send({ name }).expect(201));
  const enviesUrl = (eventId: string) => `/events/${eventId}/envies`;
  const bringUrl = (eventId: string, gameId: string) =>
    `/events/${eventId}/board-games/${gameId}/bring`;
  const exclusionUrl = (eventId: string, gameId: string) =>
    `/events/${eventId}/board-games/${gameId}/exclusion`;
  const read = async (who: { agent: Agent }, eventId: string) =>
    body<EventBoardGamesDto>(await who.agent.get(`/events/${eventId}/board-games`).expect(200));
  type Card = { id: string; seance: { id: string } };
  const propose = async (
    who: { agent: Agent },
    groupId: string,
    over: Record<string, unknown> = {},
  ) =>
    body<Card>(
      await who.agent
        .post(`/parties/${groupId}/events`)
        .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING', ...over })
        .expect(201),
    );
  const signUp = (who: { agent: Agent }, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`).expect(201);
  const messageOf = (res: request.Response) => body<{ message?: string | string[] }>(res).message;
  const envyCount = (eventId: string, where: Record<string, unknown> = {}) =>
    h.prisma.eventGameEnvy.count({ where: { eventId, ...where } });
  const envy = (who: { agent: Agent }, eventId: string, nameKey: string) =>
    who.agent.put(enviesUrl(eventId)).send({ nameKey });
  const unenvy = (who: { agent: Agent }, eventId: string, nameKey: string) =>
    who.agent.delete(enviesUrl(eventId)).send({ nameKey });
  const namesOf = (envies: EventEnvyDto[], nameKey: string) =>
    envies.find((e) => e.nameKey === nameKey)?.users.map((u) => u.pseudo);

  /** Un groupe, son hôte (membre), deux invités inscrits et un membre non inscrit ; une conjonction à venir. */
  async function setup(label: string) {
    const admin = await h.createUser(`bg495-${label}-admin`);
    const host = await h.createUser(`bg495-${label}-hote`);
    const zoe = await h.createUser(`bg495-${label}-zoe`);
    const yan = await h.createUser(`bg495-${label}-yan`);
    const outsider = await h.createUser(`bg495-${label}-hors`);
    const group = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      `bg495-${label}`,
      'ralliement',
    );
    for (const u of [host, zoe, yan, outsider]) await h.addMember(group.id, u);
    const card = await propose(host, group.id);
    await signUp(zoe, card.seance.id);
    await signUp(yan, card.seance.id);
    return { admin, host, zoe, yan, outsider, groupId: group.id, card };
  }

  it('envie : 204 ; `envies` la liste avec qui (pseudo, nom affiché, jamais d’e-mail), vue par tous', async () => {
    const { host, zoe, yan, outsider, card } = await setup('envie');
    await addGame(host, 'Azul');

    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    for (const viewer of [host, zoe, outsider]) {
      const dto = await read(viewer, card.id);
      expect(dto.envies).toHaveLength(1);
      expect(dto.envies[0].nameKey).toBe('azul');
      expect(namesOf(dto.envies, 'azul')).toEqual([zoe.pseudo, yan.pseudo].sort());
      expect(keysOf(dto.envies[0].users[0])).toEqual(['displayName', 'pseudo', 'userId']);
      expect(JSON.stringify(dto.envies)).not.toContain('@');
    }
  });

  it('retirer son envie : 204, elle disparaît ; deux fois : 204 ; deux envies identiques : une seule ligne', async () => {
    const { host, zoe, card } = await setup('idempotent');
    await addGame(host, 'Azul');

    await envy(zoe, card.id, 'azul').expect(204);
    await envy(zoe, card.id, 'azul').expect(204);
    expect(await envyCount(card.id)).toBe(1);

    await unenvy(zoe, card.id, 'azul').expect(204);
    await unenvy(zoe, card.id, 'azul').expect(204);
    expect(await envyCount(card.id)).toBe(0);
    expect((await read(zoe, card.id)).envies).toEqual([]);
  });

  it('retirer ne touche que MON envie', async () => {
    const { host, zoe, yan, card } = await setup('miennes');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    await unenvy(zoe, card.id, 'azul').expect(204);

    expect(namesOf((await read(host, card.id)).envies, 'azul')).toEqual([yan.pseudo]);
  });

  it('l’hôte a aussi le droit d’avoir envie ; un jeu apporté est sur place ; l’envie suit le NOM', async () => {
    const { host, zoe, yan, card } = await setup('sources');
    await addGame(host, 'Azul');
    const skull = await addGame(zoe, 'Skull');
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);

    await envy(host, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'skull').expect(204);

    const dto = await read(yan, card.id);
    expect(namesOf(dto.envies, 'azul')).toEqual([host.pseudo]);
    expect(namesOf(dto.envies, 'skull')).toEqual([yan.pseudo]);
  });

  it('ordre de la lecture : par clé, puis par pseudo', async () => {
    const { host, zoe, yan, card } = await setup('ordre');
    await addGame(host, 'Zombicide');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'zombicide').expect(204);
    await envy(yan, card.id, 'zombicide').expect(204);
    await envy(zoe, card.id, 'azul').expect(204);

    const dto = await read(host, card.id);

    expect(dto.envies.map((e) => e.nameKey)).toEqual(['azul', 'zombicide']);
    expect(namesOf(dto.envies, 'zombicide')).toEqual([zoe.pseudo, yan.pseudo].sort());
  });

  it('nom sur place par aucune source : 400 en français, rien n’est écrit ni émis', async () => {
    const { host, zoe, card } = await setup('hors-place');
    await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const res = await envy(zoe, card.id, 'catane').expect(400);
      expect(messageOf(res)).toBe("Ce jeu n'est pas sur place pour cette soirée");
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
    expect(await envyCount(card.id)).toBe(0);
  });

  it('clé mal formée (espaces, majuscule, vide, 81 caractères, champ en trop) : 400 en français, rien n’est écrit', async () => {
    const { host, zoe, card } = await setup('cle');
    await addGame(host, 'Azul');

    for (const nameKey of [' azul ', 'Azul', '', 'x'.repeat(81)]) {
      await envy(zoe, card.id, nameKey).expect(400);
      await unenvy(zoe, card.id, nameKey).expect(400);
    }
    await zoe.agent.put(enviesUrl(card.id)).send({ nameKey: 'azul', userId: host.id }).expect(400);
    await zoe.agent.put(enviesUrl(card.id)).send({}).expect(400);
    expect(await envyCount(card.id)).toBe(0);
  });

  it('un membre non inscrit, un étranger, une place RÉSERVÉE : 403, rien n’est écrit', async () => {
    const { admin, host, outsider, zoe, groupId, card } = await setup('refus');
    await addGame(host, 'Azul');
    const reserved = await propose(host, groupId, {
      capacity: 6,
      reservedUserIds: [outsider.id],
      date: isoDay(8),
    });
    const stranger = await h.createUser('bg495-refus-etranger');

    await envy(outsider, card.id, 'azul').expect(403);
    await envy(outsider, reserved.id, 'azul').expect(403);
    await envy(stranger, card.id, 'azul').expect(403);
    await envy(zoe, reserved.id, 'azul').expect(403);
    // L'administrateur non inscrit n'est pas participant non plus.
    await envy(admin, card.id, 'azul').expect(403);
    expect(await envyCount(card.id)).toBe(0);
    expect(await envyCount(reserved.id)).toBe(0);
  });

  it('soirée annulée / passée : 400 en français pour envier ET pour retirer, rien n’est écrit ; la lecture est vide', async () => {
    const { host, zoe, yan, groupId, card } = await setup('fermee');
    await addGame(host, 'Azul');
    const past = await propose(host, groupId, { date: isoDay(9) });
    await signUp(zoe, past.seance.id);
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(zoe, past.id, 'azul').expect(204);

    await host.agent.post(`/parties/${groupId}/events/${card.id}/cancel`).send({}).expect(201);
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: past.seance.id },
      data: { startDate: day, endDate: day },
    });

    for (const eventId of [card.id, past.id]) {
      const viewer = eventId === card.id ? yan : zoe;
      await envy(viewer, eventId, 'azul').expect(400);
      await unenvy(zoe, eventId, 'azul').expect(400);
      expect((await read(viewer, eventId)).envies).toEqual([]);
    }
    // Les lignes d'une soirée fermée ne sont pas touchées (le passé est conservé).
    expect(await envyCount(card.id)).toBe(1);
    expect(await envyCount(past.id)).toBe(1);
  });

  it('rencontre isolée : un membre envie ; close → 400 « terminée »', async () => {
    const admin = await h.createUser('bg495-iso-admin');
    const m1 = await h.createUser('bg495-iso-m1');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg495-iso', 'ralliement');
    await h.addMember(evening.id, m1);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const codenames = await addGame(m1, 'Codenames');
    await m1.agent.put(bringUrl(event.id, codenames.id)).expect(204);

    await envy(admin, event.id, 'codenames').expect(204);
    expect(namesOf((await read(m1, event.id)).envies, 'codenames')).toEqual([admin.pseudo]);

    await h.prisma.partie.update({ where: { id: evening.id }, data: { closedAt: new Date() } });
    const closed = await envy(m1, event.id, 'codenames').expect(400);
    expect(messageOf(closed)).toMatch(/terminée/);
  });

  it('partie de JDR : 403 ; identifiant mal formé : 400 ; événement inconnu : 404', async () => {
    const mj = await h.createUser('bg495-jdr-mj');
    const player = await h.createUser('bg495-jdr-joueur');
    const jdr = await h.createPartie(mj, 'ONE_SHOT', 'bg495-jdr');
    await h.addMember(jdr.id, player);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: jdr.id } });
    const { zoe } = await setup('jdr');

    for (const who of [mj, player]) await envy(who, event.id, 'azul').expect(403);
    await envy(zoe, 'pas-un-uuid', 'azul').expect(400);
    await envy(zoe, '4f9a7f0e-2c1b-4b8e-9d34-0a5c6e7f8a9b', 'azul').expect(404);
  });

  it('émission : `partie:{groupe}` après chaque écriture, jamais sur une lecture ni sur un refus', async () => {
    const { host, zoe, outsider, groupId, card } = await setup('emission');
    await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await envy(zoe, card.id, 'azul').expect(204);
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await unenvy(zoe, card.id, 'azul').expect(204);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));

      emit.mockClear();
      await read(host, card.id);
      await envy(outsider, card.id, 'azul').expect(403);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      emit.mockRestore();
    }
  });

  it('une émission en échec ne fait pas échouer l’envie (204 conservé, ligne écrite)', async () => {
    const { host, zoe, card } = await setup('emission-ko');
    await addGame(host, 'Azul');
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit').mockImplementation(() => {
      throw new Error('flux coupé');
    });
    try {
      await envy(zoe, card.id, 'azul').expect(204);
    } finally {
      emit.mockRestore();
    }
    expect(await envyCount(card.id)).toBe(1);
  });

  // ─── Purge : un nom qui quitte la soirée perd ses Envies, dans la transaction de l'écriture ─────────

  it('dernière source : l’hôte écarte « Azul » (sans apport) → toutes ses Envies partent ; le remettre ne les ressuscite pas', async () => {
    const { host, zoe, yan, card } = await setup('ecarte');
    const azul = await addGame(host, 'Azul');
    await addGame(host, 'Skull');
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);
    await envy(zoe, card.id, 'skull').expect(204);

    await host.agent.put(exclusionUrl(card.id, azul.id)).expect(204);

    expect(await envyCount(card.id, { nameKey: 'azul' })).toBe(0);
    expect(await envyCount(card.id, { nameKey: 'skull' })).toBe(1);
    await envy(zoe, card.id, 'azul').expect(400);

    await host.agent.delete(exclusionUrl(card.id, azul.id)).expect(204);
    expect(namesOf((await read(zoe, card.id)).envies, 'azul')).toBeUndefined();
  });

  it('deux sources : l’hôte écarte « Azul » mais Zoé l’apporte → les Envies survivent ; quand elle ne l’apporte plus, elles partent', async () => {
    const { host, zoe, yan, card } = await setup('deux-sources');
    const hostAzul = await addGame(host, 'Azul');
    const hers = await addGame(zoe, 'azul');
    await zoe.agent.put(bringUrl(card.id, hers.id)).expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    await host.agent.put(exclusionUrl(card.id, hostAzul.id)).expect(204);
    expect(await envyCount(card.id)).toBe(1);
    expect(namesOf((await read(yan, card.id)).envies, 'azul')).toEqual([yan.pseudo]);

    await zoe.agent.delete(bringUrl(card.id, hers.id)).expect(204);
    expect(await envyCount(card.id)).toBe(0);
  });

  it('dernier apport : seul un invité apporte « Skull », il ne l’apporte plus → ses Envies partent', async () => {
    const { zoe, yan, card } = await setup('dernier-apport');
    const skull = await addGame(zoe, 'Skull');
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);
    await envy(yan, card.id, 'skull').expect(204);
    await envy(zoe, card.id, 'skull').expect(204);

    await zoe.agent.delete(bringUrl(card.id, skull.id)).expect(204);

    expect(await envyCount(card.id)).toBe(0);
  });

  it('un nom encore tenu par l’hôte : retirer l’apport d’un doublon garde les Envies', async () => {
    const { host, zoe, yan, card } = await setup('doublon');
    await addGame(host, 'Azul');
    const hers = await addGame(zoe, 'azul');
    await zoe.agent.put(bringUrl(card.id, hers.id)).expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    await zoe.agent.delete(bringUrl(card.id, hers.id)).expect(204);

    expect(await envyCount(card.id)).toBe(1);
  });

  it('sortie 1/5 — se désinscrire : SES Envies partent, celles des autres restent ; le nom qu’elle apportait seule perd les siennes', async () => {
    const { host, zoe, yan, card } = await setup('sortie-desinscrit');
    await addGame(host, 'Azul');
    const skull = await addGame(zoe, 'Skull');
    await zoe.agent.put(bringUrl(card.id, skull.id)).expect(204);
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'skull').expect(204);

    await zoe.agent.delete(`/scenarios/seances/${card.seance.id}/inscription`).expect(200);

    // Son envie sur « azul » est partie ; celle de Yan reste ; « skull » n'a plus de source : ses Envies partent.
    expect(await envyCount(card.id, { userId: zoe.id })).toBe(0);
    expect(namesOf((await read(host, card.id)).envies, 'azul')).toEqual([yan.pseudo]);
    expect(await envyCount(card.id, { nameKey: 'skull' })).toBe(0);
  });

  it('sortie 1/5 — personne sans aucun apport mais avec des Envies : elles partent aussi (pas d’arrêt faute d’apport)', async () => {
    const { host, zoe, card } = await setup('sortie-sans-apport');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);
    expect(await h.prisma.eventGameBring.count({ where: { eventId: card.id } })).toBe(0);

    await zoe.agent.delete(`/scenarios/seances/${card.seance.id}/inscription`).expect(200);

    expect(await envyCount(card.id)).toBe(0);
  });

  it('sortie 2/5 — place réservée refusée ou retirée par l’hôte : les Envies posées en base partent', async () => {
    const { host, outsider, zoe, groupId } = await setup('sortie-reserve');
    await addGame(host, 'Azul');
    const declined = await propose(host, groupId, {
      capacity: 6,
      reservedUserIds: [outsider.id],
      date: isoDay(8),
    });
    const removed = await propose(host, groupId, {
      capacity: 6,
      reservedUserIds: [outsider.id],
      date: isoDay(9),
    });
    await signUp(zoe, declined.seance.id);
    for (const ev of [declined, removed]) {
      await h.prisma.eventGameEnvy.create({
        data: { eventId: ev.id, userId: outsider.id, nameKey: 'azul' },
      });
    }

    await outsider.agent.delete(`/scenarios/seances/${declined.seance.id}/inscription`).expect(200);
    await host.agent
      .delete(`/scenarios/seances/${removed.seance.id}/reservations/${outsider.id}`)
      .expect(200);

    expect(await envyCount(declined.id)).toBe(0);
    expect(await envyCount(removed.id)).toBe(0);
  });

  it('sortie 3/5 — quitter le groupe : les Envies des soirées à venir partent, celles d’une soirée passée restent', async () => {
    const { host, zoe, yan, groupId, card } = await setup('sortie-depart');
    await addGame(host, 'Azul');
    const second = await propose(host, groupId, { date: isoDay(9) });
    await signUp(zoe, second.seance.id);
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);
    await envy(zoe, second.id, 'azul').expect(204);
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: second.seance.id },
      data: { startDate: day, endDate: day },
    });

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await zoe.agent.delete(`/parties/${groupId}/members/me`).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
    } finally {
      emit.mockRestore();
    }

    expect(await envyCount(card.id, { userId: zoe.id })).toBe(0);
    expect(await envyCount(card.id, { userId: yan.id })).toBe(1);
    expect(await envyCount(second.id)).toBe(1);
  });

  it('sortie 4/5 — retrait par un administrateur : les Envies à venir de la cible partent, celles des autres restent', async () => {
    const { admin, host, zoe, yan, groupId, card } = await setup('sortie-retire');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    await admin.agent.delete(`/parties/${groupId}/members/${zoe.id}`).expect(200);

    expect(await envyCount(card.id, { userId: zoe.id })).toBe(0);
    expect(await envyCount(card.id, { userId: yan.id })).toBe(1);
  });

  it('sortie 5/5 — effacement du compte : les Envies du compte partent (cascade), celles des autres restent', async () => {
    const { host, zoe, yan, card } = await setup('sortie-compte');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);
    await envy(yan, card.id, 'azul').expect(204);

    await zoe.agent.delete('/me').send({ password: h.userPassword }).expect(200);

    expect(await h.prisma.eventGameEnvy.count({ where: { userId: zoe.id } })).toBe(0);
    expect(await envyCount(card.id)).toBe(1);
  });

  it('rencontre isolée : l’administrateur retire un membre, ses Envies partent', async () => {
    const admin = await h.createUser('bg495-isoretire-admin');
    const m1 = await h.createUser('bg495-isoretire-m1');
    const m2 = await h.createUser('bg495-isoretire-m2');
    const evening = await h.createPartie(admin, 'ONE_SHOT', 'bg495-isoretire', 'ralliement');
    await h.addMember(evening.id, m1);
    await h.addMember(evening.id, m2);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: evening.id } });
    const skull = await addGame(m2, 'Skull');
    await m2.agent.put(bringUrl(event.id, skull.id)).expect(204);
    await envy(m1, event.id, 'skull').expect(204);
    await envy(m2, event.id, 'skull').expect(204);

    await admin.agent.delete(`/parties/${evening.id}/members/${m1.id}`).expect(200);

    expect(await envyCount(event.id, { userId: m1.id })).toBe(0);
    expect(await envyCount(event.id, { userId: m2.id })).toBe(1);
  });

  // ─── Lecture ────────────────────────────────────────────────────────────────────────────────────

  it('lecture : une Envie dont le nom a quitté la soirée est ignorée (suppression de la Ludothèque, ligne laissée)', async () => {
    const { host, zoe, card } = await setup('ignoree');
    const azul = await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);

    await host.agent.delete(`/me/board-games/${azul.id}`).expect(204);

    // La ligne reste (accepté : pas de purge depuis `board-games/`), mais elle n'est pas lue.
    expect(await envyCount(card.id)).toBe(1);
    expect((await read(zoe, card.id)).envies).toEqual([]);
  });

  it('lecture : une Envie d’une personne qui n’est pas participante n’est pas lue', async () => {
    const { host, zoe, outsider, card } = await setup('non-participante');
    await addGame(host, 'Azul');
    await h.prisma.eventGameEnvy.create({
      data: { eventId: card.id, userId: outsider.id, nameKey: 'azul' },
    });
    await envy(zoe, card.id, 'azul').expect(204);

    expect(namesOf((await read(host, card.id)).envies, 'azul')).toEqual([zoe.pseudo]);
  });

  it('cascade : les Envies disparaissent avec la soirée', async () => {
    const { host, zoe, card } = await setup('cascade-event');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);

    await h.prisma.event.delete({ where: { id: card.id } });

    expect(await envyCount(card.id)).toBe(0);
  });

  it('une lecture de soirée annulée donne `envies: []` à tous', async () => {
    const { host, zoe, yan, groupId, card } = await setup('lecture-fermee');
    await addGame(host, 'Azul');
    await envy(zoe, card.id, 'azul').expect(204);
    await host.agent.post(`/parties/${groupId}/events/${card.id}/cancel`).send({}).expect(201);

    expect((await read(yan, card.id)).envies).toEqual([]);
    expect((await read(host, card.id)).envies).toEqual([]);
  });
});
