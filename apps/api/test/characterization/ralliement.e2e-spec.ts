import { randomUUID } from 'node:crypto';
import request, { type Response } from 'supertest';
import { EventsService } from '../../src/events/events.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PartiesService } from '../../src/parties/parties.service';
import { PollVoteCleanupService } from '../../src/poll/poll-vote-cleanup.service';
import {
  RealtimeEventsService,
  partieTopic,
  userTopic,
} from '../../src/realtime/realtime-events.service';
import { Harness, body, isoDay, type TestUser } from './harness';

// Story 38.2 — création et droits d'un ralliement, au niveau HTTP : les deux formes (rencontre
// isolée, groupe), le rôle `admin`/`member` dérivé de `Membership.role`, la politique « voir /
// modifier la partie », le type définitif, l'exclusion des listes par rôle.

type PartieDtoLike = Record<string, unknown> & {
  id: string;
  role: string;
  status: string;
  kind: string;
  gameSystemId: string;
  name: string;
  ownerId: string;
};
type MemberLike = { userId: string };
type SignalsDto = Record<string, { role: string; status: string; signals: string[] }>;

const UNAVAILABLE = "Cette action n'est pas disponible pour ce type de partie";
const ADMIN_ONLY = 'Action réservée aux administrateurs de la partie';
const NO_ACCESS = "Vous n'avez pas accès à cette partie";

describe('Ralliement — création et droits (Story 38.2)', () => {
  let h: Harness;
  let admin: TestUser;
  let member: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await Harness.start();
    [admin, member, stranger] = await Promise.all([
      h.createUser('admin'),
      h.createUser('membre'),
      h.createUser('etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  describe('création', () => {
    it('rencontre isolée : un événement, une séance non datée, aucun scénario, créateur membre ADMIN', async () => {
      const { res, id, name } = await h.createPartie(admin, 'ONE_SHOT', 'isole', 'ralliement');
      expect(res.status).toBe(201);
      const partie = body<PartieDtoLike>(res);
      expect(partie.role).toBe('admin');
      expect(partie.kind).toBe('ONE_SHOT');
      expect(partie.gameSystemId).toBe('ralliement');
      expect(partie.ownerId).toBe(admin.id);
      // Aucun Scenario : le statut de la réponse de création est celui de GET /parties/:id.
      expect(partie.status).toBe('A_VENIR');
      const got = await admin.agent.get(`/parties/${id}`).expect(200);
      expect(body<PartieDtoLike>(got).status).toBe(partie.status);

      const events = await h.prisma.event.findMany({
        where: { partieId: id },
        include: { seances: true },
      });
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe(name);
      expect(events[0].seances).toHaveLength(1);
      expect(events[0].seances[0].startDate).toBeNull();
      expect(await h.prisma.scenario.count({ where: { event: { partieId: id } } })).toBe(0);

      const memberships = await h.prisma.membership.findMany({ where: { partieId: id } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ userId: admin.id, role: 'ADMIN' });
    });

    it('groupe : membership ADMIN du créateur, aucun événement', async () => {
      const { res, id } = await h.createPartie(
        admin,
        'CAMPAGNE_EPISODIQUE',
        'groupe',
        'ralliement',
      );
      expect(res.status).toBe(201);
      const partie = body<PartieDtoLike>(res);
      expect(partie.role).toBe('admin');
      expect(partie.status).toBe('A_VENIR');

      expect(await h.prisma.event.count({ where: { partieId: id } })).toBe(0);
      const memberships = await h.prisma.membership.findMany({ where: { partieId: id } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ userId: admin.id, role: 'ADMIN' });
    });

    it('CAMPAGNE_LINEAIRE refusée en 400, rien écrit', async () => {
      const name = `C38 lineaire ${h.suffix}`;
      const res = await admin.agent
        .post('/parties')
        .send({ name, kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ralliement' });
      expect(res.status).toBe(400);
      expect(await h.prisma.partie.count({ where: { name } })).toBe(0);
    });

    it('une quête reste inchangée : aucun membership créé, rôle mj', async () => {
      const { res, id } = await h.createPartie(admin, 'ONE_SHOT', 'quete');
      expect(res.status).toBe(201);
      expect(body<PartieDtoLike>(res).role).toBe('mj');
      expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(0);
    });
  });

  describe('droits', () => {
    let partieId: string;

    beforeAll(async () => {
      ({ id: partieId } = await h.createPartie(
        admin,
        'CAMPAGNE_EPISODIQUE',
        'droits',
        'ralliement',
      ));
      await h.addMember(partieId, member);
    });

    it('voir : admin et membre lisent la partie, avec leur rôle', async () => {
      const asAdmin = await admin.agent.get(`/parties/${partieId}`).expect(200);
      expect(body<PartieDtoLike>(asAdmin).role).toBe('admin');
      const asMember = await member.agent.get(`/parties/${partieId}`).expect(200);
      expect(body<PartieDtoLike>(asMember).role).toBe('member');
    });

    it('voir : la liste des membres compte le créateur une seule fois', async () => {
      const res = await member.agent.get(`/parties/${partieId}/members`).expect(200);
      const ids = body<MemberLike[]>(res).map((m) => m.userId);
      expect([...ids].sort()).toEqual([admin.id, member.id].sort());
    });

    it('un étranger est refusé en 403 « pas accès » (lecture et modification)', async () => {
      const read = await stranger.agent.get(`/parties/${partieId}`).expect(403);
      expect(body<{ message: string }>(read).message).toBe(NO_ACCESS);
      const write = await stranger.agent
        .patch(`/parties/${partieId}`)
        .send({ name: 'Tentative' })
        .expect(403);
      expect(body<{ message: string }>(write).message).toBe(NO_ACCESS);
    });

    it('un membre ne modifie pas la partie : 403 « réservée aux administrateurs », rien écrit', async () => {
      const res = await member.agent
        .patch(`/parties/${partieId}`)
        .send({ name: 'Tentative' })
        .expect(403);
      expect(body<{ message: string }>(res).message).toBe(ADMIN_ONLY);
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } });
      expect(stored.name).not.toBe('Tentative');
    });

    it('un admin renomme son ralliement', async () => {
      const res = await admin.agent
        .patch(`/parties/${partieId}`)
        .send({ name: `C38 renomme ${h.suffix}` })
        .expect(200);
      expect(body<PartieDtoLike>(res).role).toBe('admin');
    });

    it('renommer une rencontre isolée renomme son événement unique', async () => {
      const { id } = await h.createPartie(admin, 'ONE_SHOT', 'renom', 'ralliement');
      const newName = `C38 renomme isole ${h.suffix}`;
      await admin.agent.patch(`/parties/${id}`).send({ name: newName }).expect(200);
      const events = await h.prisma.event.findMany({ where: { partieId: id } });
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe(newName);
    });

    it('une quête de JDR ne devient pas un ralliement par PATCH (400), rien écrit', async () => {
      const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'quete-vers-ralliement');
      await admin.agent.patch(`/parties/${id}`).send({ gameSystemId: 'ralliement' }).expect(400);
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
      expect(stored.gameSystemId).toBe('ryuutama');
      expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(0);
    });

    it('le type est définitif : kind ou système différent → 400, rien écrit', async () => {
      const kindRes = await admin.agent
        .patch(`/parties/${partieId}`)
        .send({ kind: 'ONE_SHOT' })
        .expect(400);
      expect(body<{ message: string }>(kindRes).message).toBe(
        "Le type d'un ralliement ne peut pas être modifié",
      );
      await admin.agent
        .patch(`/parties/${partieId}`)
        .send({ gameSystemId: 'ryuutama' })
        .expect(400);
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } });
      expect(stored.kind).toBe('CAMPAGNE_EPISODIQUE');
      expect(stored.gameSystemId).toBe('ralliement');
    });

    it('PATCH /parties/:id/kind refusé par la politique (même à l’admin)', async () => {
      const res = await admin.agent
        .patch(`/parties/${partieId}/kind`)
        .send({ kind: 'ONE_SHOT' })
        .expect(403);
      expect(body<{ message: string }>(res).message).toBe(UNAVAILABLE);
    });

    it('les actions de JDR sont refusées à tous les rôles (scénarios)', async () => {
      for (const user of [admin, member]) {
        const list = await user.agent.get(`/parties/${partieId}/scenarios`).expect(403);
        expect(body<{ message: string }>(list).message).toBe(UNAVAILABLE);
        await user.agent
          .post(`/parties/${partieId}/scenarios`)
          .send({ title: 'Un scénario' })
          .expect(403);
      }
      expect(await h.prisma.scenario.count({ where: { event: { partieId } } })).toBe(0);
    });

    // Story 39.1 : clore, rouvrir et brûler un ralliement sont des droits d'administrateur.
    it('un membre ni ne clôt, ni ne rouvre, ni ne brûle : 403 « réservée aux administrateurs », rien écrit', async () => {
      for (const route of [
        () => member.agent.patch(`/parties/${partieId}/close`),
        () => member.agent.patch(`/parties/${partieId}/reopen`),
        () => member.agent.delete(`/parties/${partieId}`),
      ]) {
        const res = await route();
        expect(res.status).toBe(403);
        expect(body<{ message: string }>(res).message).toBe(ADMIN_ONLY);
      }
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } });
      expect(stored.closedAt).toBeNull();
    });

    it('un étranger ni ne clôt, ni ne rouvre, ni ne brûle : 403 « pas accès », rien écrit', async () => {
      for (const route of [
        () => stranger.agent.patch(`/parties/${partieId}/close`),
        () => stranger.agent.patch(`/parties/${partieId}/reopen`),
        () => stranger.agent.delete(`/parties/${partieId}`),
      ]) {
        const res = await route();
        expect(res.status).toBe(403);
        expect(body<{ message: string }>(res).message).toBe(NO_ACCESS);
      }
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } });
      expect(stored.closedAt).toBeNull();
    });

    it('un admin clôt puis rouvre son groupe (même état terminé que le JDR, réversible)', async () => {
      const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'clore', 'ralliement');
      await h.addMember(id, member);
      const closed = await admin.agent.patch(`/parties/${id}/close`).expect(200);
      expect(body<PartieDtoLike>(closed).status).toBe('TERMINEE');
      expect(body<PartieDtoLike>(closed).role).toBe('admin');
      expect((await h.prisma.partie.findUniqueOrThrow({ where: { id } })).closedAt).not.toBeNull();
      const asMember = await member.agent.get(`/parties/${id}`).expect(200);
      expect(body<PartieDtoLike>(asMember).status).toBe('TERMINEE');
      const reopened = await admin.agent.patch(`/parties/${id}/reopen`).expect(200);
      expect(body<PartieDtoLike>(reopened).status).not.toBe('TERMINEE');
      expect((await h.prisma.partie.findUniqueOrThrow({ where: { id } })).closedAt).toBeNull();
    });

    it('un admin brûle son groupe : la partie et ses adhésions disparaissent', async () => {
      const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'bruler', 'ralliement');
      await h.addMember(id, member);
      expect(await h.prisma.membership.count({ where: { partieId: id } })).toBeGreaterThan(0);
      await admin.agent.delete(`/parties/${id}`).expect(200);
      expect(await h.prisma.partie.findUnique({ where: { id } })).toBeNull();
      expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(0);
      await member.agent.get(`/parties/${id}`).expect(404);
    });
  });

  describe('listes', () => {
    it('absent de ?role=mj et ?role=player, présent dans la liste sans rôle avec admin / member', async () => {
      const owner = await h.createUser('liste-admin');
      const guest = await h.createUser('liste-membre');
      const { id } = await h.createPartie(owner, 'CAMPAGNE_EPISODIQUE', 'liste', 'ralliement');
      await h.addMember(id, guest);

      const mjList = body<PartieDtoLike[]>(await owner.agent.get('/parties').query({ role: 'mj' }));
      expect(mjList.map((p) => p.id)).not.toContain(id);
      const ownerPlayerList = body<PartieDtoLike[]>(
        await owner.agent.get('/parties').query({ role: 'player' }),
      );
      expect(ownerPlayerList.map((p) => p.id)).not.toContain(id);
      const guestPlayerList = body<PartieDtoLike[]>(
        await guest.agent.get('/parties').query({ role: 'player' }),
      );
      expect(guestPlayerList.map((p) => p.id)).not.toContain(id);

      const ownerAll = body<PartieDtoLike[]>(await owner.agent.get('/parties').expect(200));
      expect(ownerAll.find((p) => p.id === id)?.role).toBe('admin');
      const guestAll = body<PartieDtoLike[]>(await guest.agent.get('/parties').expect(200));
      expect(guestAll.find((p) => p.id === id)?.role).toBe('member');
    });

    it('un ralliement tout juste créé figure dans GET /parties (sans rôle) avec le rôle admin et sa famille (Story 38.5)', async () => {
      const owner = await h.createUser('liste-neuve');
      const { id } = await h.createPartie(owner, 'ONE_SHOT', 'liste-neuve', 'ralliement');
      const all = body<PartieDtoLike[]>(await owner.agent.get('/parties').expect(200));
      const created = all.find((p) => p.id === id);
      expect(created?.role).toBe('admin');
      expect(created?.gameSystemId).toBe('ralliement');
      expect(created?.kind).toBe('ONE_SHOT');
      // Aucun signal pour lui : la liste des signaux est bâtie sur les listes par rôle seulement.
      const signals = body<SignalsDto>(await owner.agent.get('/me/party-signals').expect(200));
      expect(Object.keys(signals)).not.toContain(id);
    });

    it('party-signals n’émet aucune entrée pour un ralliement', async () => {
      const owner = await h.createUser('signaux');
      const { id } = await h.createPartie(owner, 'ONE_SHOT', 'signaux', 'ralliement');
      // Témoin JDR du même utilisateur : il DOIT apparaître, sans quoi l'absence ne prouve rien.
      const { id: jdrId } = await h.createPartie(owner, 'CAMPAGNE_EPISODIQUE', 'signaux-jdr');
      const res = await owner.agent.get('/me/party-signals').expect(200);
      const signals = body<SignalsDto>(res);
      expect(signals[jdrId]).toEqual(
        expect.objectContaining({ role: 'mj', signals: expect.any(Array) as string[] }),
      );
      expect(Object.keys(signals)).not.toContain(id);
    });
  });

  // Story 38.4 (AD-1) : la page d'un ralliement n'affiche aucune section de JDR, et le serveur refuse
  // ces mêmes routes en direct — l'écran n'est jamais la seule barrière.
  describe('capacités de JDR absentes : refus en direct (Story 38.4)', () => {
    const ZERO = '00000000-0000-4000-8000-000000000000';
    // Un PNG 1×1 : octets valides, de sorte que la validation du fichier ne précède pas le refus.
    const PNG_1X1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    let partieId: string;
    /** Séance unique de la rencontre isolée : seul vrai identifiant de séance atteignable ici. */
    let seanceId: string;

    beforeAll(async () => {
      // Rencontre isolée : elle porte un événement et une séance réels, de quoi sonder les routes
      // de séance avec un vrai identifiant (un identifiant aléatoire ne prouverait qu'un 404).
      ({ id: partieId } = await h.createPartie(admin, 'ONE_SHOT', 'refus-jdr', 'ralliement'));
      await h.addMember(partieId, member);
      const seance = await h.prisma.seance.findFirstOrThrow({ where: { event: { partieId } } });
      seanceId = seance.id;
    });

    type Probe = {
      label: string;
      /** Statuts admis : 403 par défaut ; 403 ou 404 pour un identifiant aléatoire (rien à agir). */
      allowed?: number[];
      send: (user: TestUser) => Promise<{ status: number }>;
    };
    const p = (id: string) => `/parties/${id}`;
    const probes = (): Probe[] => [
      {
        label: 'POST xp-distributions',
        send: (u) =>
          u.agent
            .post(`${p(partieId)}/xp-distributions`)
            .send({ entries: [{ characterId: ZERO, amount: 1 }] }),
      },
      {
        label: 'GET xp-distributions',
        send: (u) => u.agent.get(`${p(partieId)}/xp-distributions`),
      },
      {
        label: 'POST homme-dragon',
        send: (u) =>
          u.agent
            .post(`${p(partieId)}/homme-dragon`)
            .send({ race: 'DRAGON_VERT', artefact: { key: 'x' }, nom: 'Nom' }),
      },
      { label: 'GET homme-dragon', send: (u) => u.agent.get(`${p(partieId)}/homme-dragon`) },
      {
        label: 'PUT homme-dragon/:id',
        send: (u) => u.agent.put(`${p(partieId)}/homme-dragon/${ZERO}`),
      },
      {
        label: 'DELETE homme-dragon/:id',
        send: (u) => u.agent.delete(`${p(partieId)}/homme-dragon/${ZERO}`),
      },
      {
        label: 'POST announcements',
        send: (u) => u.agent.post(`${p(partieId)}/announcements`).send({ text: 'Une annonce' }),
      },
      { label: 'GET announcements', send: (u) => u.agent.get(`${p(partieId)}/announcements`) },
      {
        label: 'PUT visibility-locks',
        send: (u) => u.agent.put(`${p(partieId)}/visibility-locks`).send({ paths: [] }),
      },
      {
        label: 'GET visibility-locks',
        send: (u) => u.agent.get(`${p(partieId)}/visibility-locks`),
      },
      { label: 'GET characters', send: (u) => u.agent.get(`${p(partieId)}/characters`) },
      {
        label: 'POST characters',
        send: (u) =>
          u.agent
            .post(`${p(partieId)}/characters`)
            .send({ gameSystemId: 'ralliement', sheetData: { a: 1 } }),
      },
      // Invitations, liens et retrait d'un membre : ouverts à l'administrateur depuis la Story 39.3
      // (describe « inviter » ci-dessous) — retirés de cette liste de capacités absentes.
      // Story 40.1 : une rencontre isolée n'accueille pas de nouvelle conjonction (réservé au groupe).
      {
        label: 'POST events (conjonction)',
        send: (u) =>
          u.agent
            .post(`${p(partieId)}/events`)
            .send({ title: 'Une conjonction', date: '2030-01-01', slot: 'EVENING' }),
      },
      { label: 'GET poll', send: (u) => u.agent.get(`${p(partieId)}/poll`) },
      // Story 41.2 : voter, fixer la date et prolonger le vote sont ouverts à la soirée isolée (describe
      // dédié en fin de fichier) — retirés de cette liste de capacités absentes.
      {
        label: 'PUT poll/:id/options',
        send: (u) =>
          u.agent.put(`${p(partieId)}/poll/${ZERO}/options`).send({
            options: [
              { date: '2030-01-01', slot: 'EVENING' },
              { date: '2030-01-02', slot: 'EVENING' },
            ],
          }),
      },
      { label: 'DELETE poll/:id', send: (u) => u.agent.delete(`${p(partieId)}/poll/${ZERO}`) },
      { label: 'GET available-slots', send: (u) => u.agent.get(`${p(partieId)}/available-slots`) },
      {
        label: 'GET heatmap',
        send: (u) =>
          u.agent.get(`${p(partieId)}/heatmap`).query({ from: '2030-01-01', to: '2030-01-07' }),
      },
      // Scénarios : aucun n'existe dans un ralliement, les routes de la partie sont refusées.
      { label: 'GET scenarios', send: (u) => u.agent.get(`${p(partieId)}/scenarios`) },
      {
        label: 'GET scenarios/drafts',
        send: (u) => u.agent.get(`${p(partieId)}/scenarios/drafts`),
      },
      {
        label: 'POST scenarios',
        send: (u) => u.agent.post(`${p(partieId)}/scenarios`).send({ title: 'Un scénario' }),
      },
      { label: 'GET documents', send: (u) => u.agent.get(`${p(partieId)}/documents`) },
      // Routes d'un scénario : identifiant aléatoire (aucun scénario possible) → 403 ou 404, jamais d'action.
      ...(
        [
          ['PATCH scenarios/:id', 'patch', '', { title: 'X' }],
          ['PATCH scenarios/:id/open', 'patch', '/open', undefined],
          ['PATCH scenarios/:id/courant', 'patch', '/courant', undefined],
          ['PATCH scenarios/:id/passe', 'patch', '/passe', undefined],
          ['PATCH scenarios/:id/resume-fin', 'patch', '/resume-fin', { resumeFin: 'x' }],
          ['POST scenarios/:id/participate', 'post', '/participate', undefined],
          ['POST scenarios/:id/seances', 'post', '/seances', undefined],
          ['GET scenarios/:id/documents', 'get', '/documents', undefined],
        ] as const
      ).map(([label, method, suffix, payload]): Probe => ({
        label,
        allowed: [403, 404],
        send: (u) => {
          const req = u.agent[method](`/scenarios/${ZERO}${suffix}`);
          return payload ? req.send(payload) : req;
        },
      })),
      // Séances : vraie séance de la rencontre isolée → refusées (la politique ne les ouvre à personne).
      {
        label: 'DELETE seances/:id',
        send: (u) => u.agent.delete(`/scenarios/seances/${seanceId}`),
      },
      {
        label: 'POST seances/:id/poll',
        send: (u) =>
          u.agent.post(`/scenarios/seances/${seanceId}/poll`).send({
            options: [
              { date: '2030-01-01', slot: 'EVENING' },
              { date: '2030-01-02', slot: 'EVENING' },
            ],
          }),
      },
      {
        label: 'PATCH seances/:id/reset-date',
        send: (u) => u.agent.patch(`/scenarios/seances/${seanceId}/reset-date`),
      },
      {
        label: 'PATCH seances/:id/capacite',
        send: (u) =>
          u.agent
            .patch(`/scenarios/seances/${seanceId}/capacite`)
            .send({ inscriptionMin: 1, inscriptionMax: 4 }),
      },
      {
        label: 'POST seances/:id/inscription',
        send: (u) => u.agent.post(`/scenarios/seances/${seanceId}/inscription`),
      },
      {
        label: 'DELETE seances/:id/inscription',
        send: (u) => u.agent.delete(`/scenarios/seances/${seanceId}/inscription`),
      },
      {
        label: 'PATCH seances/:id/compte-rendu',
        send: (u) =>
          u.agent.patch(`/scenarios/seances/${seanceId}/compte-rendu`).send({ compteRendu: 'x' }),
      },
      {
        label: 'PATCH seances/:id/infos-pratiques',
        send: (u) =>
          u.agent
            .patch(`/scenarios/seances/${seanceId}/infos-pratiques`)
            .send({ heureRdv: '20:00', lieu: 'Salle', notePratique: null }),
      },
      // Rôles de groupe et ressources d'un système de jeu.
      {
        label: 'GET character-roles',
        send: (u) => u.agent.get(`${p(partieId)}/character-roles`),
      },
      {
        label: 'POST characters/:id/role',
        send: (u) => u.agent.post(`${p(partieId)}/characters/${ZERO}/role`).send({ roleKey: 'x' }),
      },
      {
        label: 'DELETE characters/:id/role',
        send: (u) => u.agent.delete(`${p(partieId)}/characters/${ZERO}/role`),
      },
      {
        label: 'GET game-systems/ryuutama/assets/journal',
        send: (u) => u.agent.get(`${p(partieId)}/game-systems/ryuutama/assets/journal`),
      },
    ];

    /** Instantané de tout ce que ces routes pourraient écrire, pour prouver qu'aucune ne l'a fait. */
    const snapshot = async () => {
      const where = { partieId };
      return {
        announcements: await h.prisma.announcement.count({ where }),
        xpDistributions: await h.prisma.xpDistribution.count({ where }),
        visibilityLocks: await h.prisma.partieVisibilityLock.count({ where }),
        invitations: await h.prisma.invitation.count({ where }),
        inviteLinks: await h.prisma.inviteLink.count({ where }),
        characters: await h.prisma.character.count({ where }),
        scenarios: await h.prisma.scenario.count({ where: { event: { partieId } } }),
        memberships: (await h.prisma.membership.findMany({ where }))
          .map((m) => `${m.userId}:${m.role}`)
          .sort(),
        // La séance entière, champ par champ : date, capacité, compte rendu, infos pratiques, vote.
        seances: JSON.stringify(
          await h.prisma.seance.findMany({
            where: { event: { partieId } },
            orderBy: { id: 'asc' },
          }),
        ),
        partie: JSON.stringify(
          await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } }),
        ),
      };
    };

    it.each(['admin', 'membre', 'étranger'])(
      '%s : chaque route d’une capacité absente est refusée en 403',
      async (who) => {
        const user = who === 'admin' ? admin : who === 'membre' ? member : stranger;
        // Jest n'accepte pas de message : on collecte les écarts pour nommer la route fautive.
        const ecarts: string[] = [];
        for (const probe of probes()) {
          const res = await probe.send(user);
          if (!(probe.allowed ?? [403]).includes(res.status)) {
            ecarts.push(`${probe.label} → ${res.status}`);
          }
        }
        expect(ecarts).toEqual([]);
      },
    );

    it('aucune écriture n’a eu lieu : on sonde toutes les routes puis on compare l’état avant / après', async () => {
      const avant = await snapshot();
      for (const user of [admin, member, stranger]) {
        for (const probe of probes()) await probe.send(user);
      }
      expect(await snapshot()).toEqual(avant);
    });

    it('témoin positif : admin et membre lisent la partie et ses membres (créateur une fois), un étranger est refusé', async () => {
      for (const user of [admin, member]) {
        await user.agent.get(p(partieId)).expect(200);
        const res = await user.agent.get(`${p(partieId)}/members`).expect(200);
        const ids = body<MemberLike[]>(res).map((m) => m.userId);
        expect([...ids].sort()).toEqual([admin.id, member.id].sort());
      }
      await stranger.agent.get(p(partieId)).expect(403);
      await stranger.agent.get(`${p(partieId)}/members`).expect(403);
    });

    it('un membre ne change pas la couverture (403 « réservée aux administrateurs »), un étranger non plus', async () => {
      const asMember = await member.agent
        .put(`${p(partieId)}/cover`)
        .attach('file', PNG_1X1, { filename: 'c.png', contentType: 'image/png' });
      expect(asMember.status).toBe(403);
      expect(body<{ message: string }>(asMember).message).toBe(ADMIN_ONLY);
      const asStranger = await stranger.agent
        .put(`${p(partieId)}/cover`)
        .attach('file', PNG_1X1, { filename: 'c.png', contentType: 'image/png' });
      expect(asStranger.status).toBe(403);
      const removed = await member.agent.delete(`${p(partieId)}/cover`);
      expect(removed.status).toBe(403);
      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id: partieId } });
      expect(stored.coverImageUrl).toBeNull();
    });
  });
});

// Story 39.3 — inviter quelqu'un dans un groupe : l'administrateur invite par pseudo, par e-mail et
// par lien, retire un simple membre ; un membre ou un étranger est refusé en 403 sur chaque route.
describe('Ralliement — inviter dans un groupe (Story 39.3)', () => {
  let h: Harness;
  let admin: TestUser;
  let admin2: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let partieId: string;
  const registeredEmails: string[] = [];

  type InvitationLike = { id: string; partie?: { gameSystemId: string } };
  type LinkLike = { id: string; token: string };

  beforeAll(async () => {
    h = await Harness.start();
    [admin, admin2, member, stranger] = await Promise.all([
      h.createUser('inv-admin'),
      h.createUser('inv-admin2'),
      h.createUser('inv-membre'),
      h.createUser('inv-etranger'),
    ]);
    ({ id: partieId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'inviter',
      'ralliement',
    ));
    await h.addMember(partieId, admin2, 'ADMIN');
    await h.addMember(partieId, member);
  });

  afterAll(async () => {
    // Comptes créés par l'inscription par lien : le banc ne les connaît pas.
    if (registeredEmails.length > 0) {
      await h.prisma.user.deleteMany({ where: { email: { in: registeredEmails } } });
    }
    await h?.close();
  });

  const membershipOf = (userId: string) =>
    h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId } } });

  describe('refus', () => {
    let invitationId: string;
    let linkId: string;

    beforeAll(async () => {
      const target = await h.createUser('inv-cible-refus');
      const inv = await admin.agent
        .post(`/parties/${partieId}/invitations`)
        .send({ inviteeUserId: target.id })
        .expect(201);
      invitationId = body<InvitationLike>(inv).id;
      const link = await admin.agent.post(`/parties/${partieId}/invite-links`).send({}).expect(201);
      linkId = body<LinkLike>(link).id;
    });

    const routes = (user: TestUser) => [
      {
        label: 'POST invitations',
        send: () =>
          user.agent.post(`/parties/${partieId}/invitations`).send({ inviteeUserId: stranger.id }),
      },
      {
        label: 'POST invitations/by-email',
        send: () =>
          user.agent
            .post(`/parties/${partieId}/invitations/by-email`)
            .send({ email: `refus-${h.suffix}@test.local` }),
      },
      { label: 'GET invitations', send: () => user.agent.get(`/parties/${partieId}/invitations`) },
      {
        label: 'DELETE invitations/:id',
        send: () => user.agent.delete(`/invitations/${invitationId}`),
      },
      {
        label: 'POST invite-links',
        send: () => user.agent.post(`/parties/${partieId}/invite-links`).send({}),
      },
      {
        label: 'GET invite-links',
        send: () => user.agent.get(`/parties/${partieId}/invite-links`),
      },
      {
        label: 'DELETE invite-links/:id',
        send: () => user.agent.delete(`/invite-links/${linkId}`),
      },
      {
        label: 'DELETE members/:userId',
        send: () => user.agent.delete(`/parties/${partieId}/members/${admin2.id}`),
      },
    ];

    const snapshot = async () => ({
      invitations: await h.prisma.invitation.findMany({
        where: { partieId },
        orderBy: { id: 'asc' },
      }),
      links: await h.prisma.inviteLink.findMany({ where: { partieId }, orderBy: { id: 'asc' } }),
      memberships: (await h.prisma.membership.findMany({ where: { partieId } }))
        .map((m) => `${m.userId}:${m.role}`)
        .sort(),
    });

    it.each([
      ['un membre', 'member', ADMIN_ONLY],
      ['un étranger', 'stranger', NO_ACCESS],
    ] as const)(
      '%s : chaque route d’invitation, de lien et de retrait est refusée en 403, rien écrit',
      async (_label, who, message) => {
        const user = who === 'member' ? member : stranger;
        const avant = await snapshot();
        const ecarts: string[] = [];
        for (const route of routes(user)) {
          const res = await route.send();
          if (res.status !== 403 || body<{ message: string }>(res).message !== message) {
            ecarts.push(`${route.label} → ${res.status}`);
          }
        }
        expect(ecarts).toEqual([]);
        expect(await snapshot()).toEqual(avant);
      },
    );
  });

  describe('par pseudo', () => {
    it('un admin invite, l’invité (carte « groupe ») accepte et devient MEMBER ; les autres membres le voient', async () => {
      const invitee = await h.createUser('inv-pseudo');
      const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
      try {
        // Un second administrateur invite : le signal part vers le propriétaire, pas l'invitant.
        const created = await admin2.agent
          .post(`/parties/${partieId}/invitations`)
          .send({ inviteeUserId: invitee.id })
          .expect(201);
        const invitationId = body<InvitationLike>(created).id;

        const received = body<InvitationLike[]>(
          await invitee.agent.get('/invitations').expect(200),
        );
        expect(received.find((i) => i.id === invitationId)?.partie?.gameSystemId).toBe(
          'ralliement',
        );

        await invitee.agent.post(`/invitations/${invitationId}/accept`).expect(201);
        expect(await membershipOf(invitee.id)).toMatchObject({ role: 'MEMBER' });
        expect(notify).toHaveBeenCalledWith(partieId, admin.id);

        const asMember = await member.agent.get(`/parties/${partieId}/members`).expect(200);
        expect(body<MemberLike[]>(asMember).map((m) => m.userId)).toContain(invitee.id);
      } finally {
        notify.mockRestore();
      }
    });

    it('un utilisateur déjà membre : 409 « du groupe »', async () => {
      const res = await admin.agent
        .post(`/parties/${partieId}/invitations`)
        .send({ inviteeUserId: member.id })
        .expect(409);
      expect(body<{ message: string }>(res).message).toBe(
        'Cet utilisateur est déjà membre du groupe.',
      );
    });

    it('l’admin révoque une invitation en attente', async () => {
      const target = await h.createUser('inv-revoque');
      const created = await admin.agent
        .post(`/parties/${partieId}/invitations`)
        .send({ inviteeUserId: target.id })
        .expect(201);
      const id = body<InvitationLike>(created).id;
      await admin.agent.delete(`/invitations/${id}`).expect(200);
      const stored = await h.prisma.invitation.findUniqueOrThrow({ where: { id } });
      expect(stored.status).toBe('REVOKED');
    });
  });

  describe('par e-mail', () => {
    it('adresse inconnue : e-mail « group-invitation » au nom de l’invitant, avec un lien de jonction', async () => {
      const to = `inconnu-${h.suffix}@test.local`;
      const res = await admin.agent
        .post(`/parties/${partieId}/invitations/by-email`)
        .send({ email: to })
        .expect(201);
      expect(body<{ ok: boolean }>(res).ok).toBe(true);
      const sent = h.email.calls.filter((c) => c.to === to);
      expect(sent).toHaveLength(1);
      expect(sent[0].template).toBe('group-invitation');
      expect(sent[0].data).toMatchObject({ inviterName: admin.displayName });
      expect(String(sent[0].data.link)).toContain('/join/');
    });

    it('adresse d’un compte existant : invitation en attente + e-mail de groupe vers le tableau de bord', async () => {
      const known = await h.createUser('inv-connu');
      const res = await admin.agent
        .post(`/parties/${partieId}/invitations/by-email`)
        .send({ email: known.email })
        .expect(201);
      expect(body<{ ok: boolean }>(res).ok).toBe(true);
      const sent = h.email.calls.filter((c) => c.to === known.email);
      expect(sent.map((c) => c.template)).toEqual(['group-invitation']);
      expect(
        await h.prisma.invitation.count({
          where: { partieId, inviteeUserId: known.id, status: 'PENDING' },
        }),
      ).toBe(1);
    });
  });

  describe('par lien', () => {
    it('l’invité connecté rejoint en MEMBER ; un second essai, comme le créateur, est refusé en 409 neutre', async () => {
      const joiner = await h.createUser('inv-lien');
      const link = await admin.agent.post(`/parties/${partieId}/invite-links`).send({}).expect(201);
      const { token } = body<LinkLike>(link);

      const preview = await joiner.agent.get(`/invite-links/${token}`).expect(200);
      expect(body<{ gameSystemId: string }>(preview).gameSystemId).toBe('ralliement');

      await joiner.agent.post(`/invite-links/${token}/join`).expect(201);
      expect(await membershipOf(joiner.id)).toMatchObject({ role: 'MEMBER' });

      for (const user of [joiner, admin]) {
        const again = await user.agent.post(`/invite-links/${token}/join`).expect(409);
        const message = body<{ message: string }>(again).message;
        expect(message).toBe('Vous êtes déjà membre de ce groupe.');
        expect(message).not.toMatch(/MJ|partie/);
      }
    });

    it('l’inscription par lien crée un MEMBER ; un lien révoqué est refusé', async () => {
      const link = await admin.agent.post(`/parties/${partieId}/invite-links`).send({}).expect(201);
      const { token, id } = body<LinkLike>(link);
      const email = `inscrit-${h.suffix}@test.local`;
      registeredEmails.push(email);
      await request
        .agent(h.app.getHttpServer())
        .post('/auth/register')
        .send({ email, pseudo: `inscrit-${h.suffix}`, password: 'MotDePasse-123', token })
        .expect(201);
      const created = await h.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await membershipOf(created.id)).toMatchObject({ role: 'MEMBER' });

      await admin.agent.delete(`/invite-links/${id}`).expect(200);
      const late = await h.createUser('inv-revoque-lien');
      await late.agent.post(`/invite-links/${token}/join`).expect(403);
    });
  });

  describe('retrait', () => {
    it('l’admin retire un simple membre : adhésion supprimée', async () => {
      const leaver = await h.createUser('inv-retire');
      await h.addMember(partieId, leaver);
      await admin.agent.delete(`/parties/${partieId}/members/${leaver.id}`).expect(200);
      expect(await membershipOf(leaver.id)).toBeNull();
      await leaver.agent.get(`/parties/${partieId}`).expect(403);
    });

    it.each([
      ['le créateur resté administrateur', 'admin2', 'admin'],
      ['un autre administrateur', 'admin', 'admin2'],
      ['soi-même', 'admin', 'admin'],
    ] as const)('refuse de retirer %s : 409, adhésion intacte', async (_label, caller, target) => {
      const users = { admin, admin2 };
      const res = await users[caller].agent
        .delete(`/parties/${partieId}/members/${users[target].id}`)
        .expect(409);
      expect(body<{ message: string }>(res).message).toContain('membre ordinaire');
      expect(await membershipOf(users[target].id)).not.toBeNull();
    });

    // Story 39.5 : c'est le rôle qui décide, plus `ownerId` — le créateur redevenu simple membre se
    // retire comme les autres, et le groupe n'a plus de propriétaire.
    it('le créateur devenu simple membre est retirable : adhésion supprimée, ownerId vide', async () => {
      const { id } = await h.createPartie(
        admin,
        'CAMPAGNE_EPISODIQUE',
        'retrait-createur',
        'ralliement',
      );
      await h.addMember(id, admin2, 'ADMIN');
      await admin.agent
        .patch(`/parties/${id}/members/${admin.id}/role`)
        .send({ role: 'MEMBER' })
        .expect(200);

      await admin2.agent.delete(`/parties/${id}/members/${admin.id}`).expect(200);

      const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
      expect(stored.ownerId).toBeNull();
      expect(
        await h.prisma.membership.findUnique({
          where: { userId_partieId: { userId: admin.id, partieId: id } },
        }),
      ).toBeNull();
      // Sans adhésion ni propriété, l'ancien créateur n'a plus aucun accès.
      await admin.agent.get(`/parties/${id}`).expect(403);
    });

    it('membre inconnu du groupe : 404', async () => {
      await admin.agent.delete(`/parties/${partieId}/members/${stranger.id}`).expect(404);
    });
  });

  // Comportement ACCEPTÉ, à réviser avec l'epic 41 : la politique d'invitation est posée pour la
  // FAMILLE entière (décision de la Story 39.3), donc l'admin d'une rencontre isolée (ONE_SHOT) peut
  // créer un lien d'invitation alors que l'interface en est réservée aux groupes. L'invitation à
  // usage unique de l'epic 41 devra trancher (restreindre la cellule ou l'assumer) et ce test avec.
  it('rencontre isolée : l’admin crée un lien (accepté jusqu’à l’epic 41), le membre et l’étranger sont refusés', async () => {
    const { id } = await h.createPartie(admin, 'ONE_SHOT', 'inviter-isolee', 'ralliement');
    await h.addMember(id, member);

    const asAdmin = await admin.agent.post(`/parties/${id}/invite-links`).send({});
    expect(asAdmin.status).toBeGreaterThanOrEqual(200);
    expect(asAdmin.status).toBeLessThan(300);

    const asMember = await member.agent.post(`/parties/${id}/invite-links`).send({}).expect(403);
    expect(body<{ message: string }>(asMember).message).toBe(ADMIN_ONLY);
    const asStranger = await stranger.agent
      .post(`/parties/${id}/invite-links`)
      .send({})
      .expect(403);
    expect(body<{ message: string }>(asStranger).message).toBe(NO_ACCESS);
  });
});

// Story 39.4 — nommer des administrateurs et quitter l'office : mouvements autorisés, refus (membre,
// étranger, JDR, rencontre isolée), dernier administrateur sous confirmation explicite, et deux
// départs simultanés sous le verrou de la partie.
describe("Ralliement — nommer des admins et quitter l'office (Story 39.4)", () => {
  let h: Harness;
  let admin: TestUser;
  let admin2: TestUser;
  let member: TestUser;
  let member2: TestUser;
  let stranger: TestUser;

  type MemberRoleLike = { userId: string; role: string };
  const LAST_ADMIN = 'dernier administrateur';

  beforeAll(async () => {
    h = await Harness.start();
    [admin, admin2, member, member2, stranger] = await Promise.all([
      h.createUser('role-admin'),
      h.createUser('role-admin2'),
      h.createUser('role-membre'),
      h.createUser('role-membre2'),
      h.createUser('role-etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  /** Un groupe neuf : `admin` (créateur) + les membres demandés. */
  const newGroup = async (label: string, members: [TestUser, 'ADMIN' | 'MEMBER'][] = []) => {
    const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', label, 'ralliement');
    for (const [user, role] of members) await h.addMember(id, user, role);
    return id;
  };
  const roleOf = async (partieId: string, userId: string) =>
    (await h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId } } }))
      ?.role ?? null;
  const setRole = (
    who: TestUser,
    partieId: string,
    targetId: string,
    payload: Record<string, unknown>,
  ) => who.agent.patch(`/parties/${partieId}/members/${targetId}/role`).send(payload);

  it('un admin nomme un membre ordinaire : il devient ADMIN, la liste des membres le dit', async () => {
    const id = await newGroup('role-nommer', [[member, 'MEMBER']]);
    await setRole(admin, id, member.id, { role: 'ADMIN' }).expect(200);
    expect(await roleOf(id, member.id)).toBe('ADMIN');

    const list = body<MemberRoleLike[]>(
      await member.agent.get(`/parties/${id}/members`).expect(200),
    );
    expect(list.find((m) => m.userId === member.id)?.role).toBe('ADMIN');
    expect(list.find((m) => m.userId === admin.id)?.role).toBe('ADMIN');
    // Le nouvel administrateur voit ses droits changer.
    const got = await member.agent.get(`/parties/${id}`).expect(200);
    expect(body<PartieDtoLike>(got).role).toBe('admin');
  });

  it('la propriété ne bouge jamais : ownerId reste le créateur après nomination et départ', async () => {
    const id = await newGroup('role-owner', [[admin2, 'MEMBER']]);
    await setRole(admin, id, admin2.id, { role: 'ADMIN' }).expect(200);
    await setRole(admin, id, admin.id, { role: 'MEMBER' }).expect(200);
    const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
    expect(stored.ownerId).toBe(admin.id);
  });

  it("quitter l'office alors qu'un autre admin reste : devient MEMBER, reste dans le groupe, perd les droits d'admin", async () => {
    const id = await newGroup('role-quitter', [[admin2, 'ADMIN']]);
    await setRole(admin, id, admin.id, { role: 'MEMBER' }).expect(200);
    expect(await roleOf(id, admin.id)).toBe('MEMBER');
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);
    const got = await admin.agent.get(`/parties/${id}`).expect(200);
    expect(body<PartieDtoLike>(got).role).toBe('member');
    const refused = await admin.agent
      .patch(`/parties/${id}`)
      .send({ name: 'Plus admin' })
      .expect(403);
    expect(body<{ message: string }>(refused).message).toBe(ADMIN_ONLY);
  });

  it('dernier administrateur sans confirmation : 409, rien ne change ; avec confirmation, le groupe disparaît pour tous', async () => {
    const id = await newGroup('role-dernier', [[member, 'MEMBER']]);
    const sans = await setRole(admin, id, admin.id, { role: 'MEMBER' }).expect(409);
    expect(body<{ message: string }>(sans).message).toContain(LAST_ADMIN);
    await setRole(admin, id, admin.id, { role: 'MEMBER', deleteIfLastAdmin: false }).expect(409);
    expect(await roleOf(id, admin.id)).toBe('ADMIN');
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);

    await setRole(admin, id, admin.id, { role: 'MEMBER', deleteIfLastAdmin: true }).expect(200);
    expect(await h.prisma.partie.count({ where: { id } })).toBe(0);
    expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(0);
    await member.agent.get(`/parties/${id}`).expect(404);
  });

  it('un membre ordinaire : 403 « réservée aux administrateurs » (nommer et se nommer), rien écrit', async () => {
    const id = await newGroup('role-membre', [
      [member, 'MEMBER'],
      [member2, 'MEMBER'],
    ]);
    for (const target of [member2.id, member.id]) {
      const res = await setRole(member, id, target, { role: 'ADMIN' }).expect(403);
      expect(body<{ message: string }>(res).message).toBe(ADMIN_ONLY);
    }
    const down = await setRole(member, id, member.id, { role: 'MEMBER' }).expect(403);
    expect(body<{ message: string }>(down).message).toBe(ADMIN_ONLY);
    expect(await roleOf(id, member.id)).toBe('MEMBER');
    expect(await roleOf(id, member2.id)).toBe('MEMBER');
  });

  it('un étranger : 403 « pas accès »', async () => {
    const id = await newGroup('role-etranger', [[member, 'MEMBER']]);
    const res = await setRole(stranger, id, member.id, { role: 'ADMIN' }).expect(403);
    expect(body<{ message: string }>(res).message).toBe(NO_ACCESS);
    expect(await roleOf(id, member.id)).toBe('MEMBER');
  });

  it("mouvements inexistants : retirer l'office à un autre, nommer un admin, se nommer → 409 ; membre inconnu → 404", async () => {
    const id = await newGroup('role-mauvais', [
      [admin2, 'ADMIN'],
      [member, 'MEMBER'],
    ]);
    await setRole(admin, id, admin2.id, { role: 'MEMBER' }).expect(409);
    await setRole(admin, id, admin2.id, { role: 'ADMIN' }).expect(409);
    await setRole(admin, id, admin.id, { role: 'ADMIN' }).expect(409);
    await setRole(admin, id, stranger.id, { role: 'ADMIN' }).expect(404);
    expect(await roleOf(id, admin2.id)).toBe('ADMIN');
    expect(await roleOf(id, member.id)).toBe('MEMBER');
  });

  it('corps invalide : 400', async () => {
    const id = await newGroup('role-corps', [[member, 'MEMBER']]);
    await setRole(admin, id, member.id, { role: 'SUPER' }).expect(400);
    await setRole(admin, id, member.id, {}).expect(400);
    await setRole(admin, id, member.id, { role: 'ADMIN', deleteIfLastAdmin: 'oui' }).expect(400);
  });

  it('rencontre isolée (ONE_SHOT) : refusée en 403 même à son administrateur', async () => {
    const { id } = await h.createPartie(admin, 'ONE_SHOT', 'role-isolee', 'ralliement');
    await h.addMember(id, member);
    const res = await setRole(admin, id, member.id, { role: 'ADMIN' }).expect(403);
    expect(body<{ message: string }>(res).message).toBe(UNAVAILABLE);
    expect(await roleOf(id, member.id)).toBe('MEMBER');
  });

  it('partie de JDR : la route est fermée à tous, y compris au MJ', async () => {
    const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'role-jdr');
    await h.addMember(id, member);
    await setRole(admin, id, member.id, { role: 'ADMIN' }).expect(403);
    await setRole(member, id, member.id, { role: 'MEMBER' }).expect(403);
    await setRole(stranger, id, member.id, { role: 'ADMIN' }).expect(403);
    expect(await roleOf(id, member.id)).toBe('MEMBER');
    const list = body<MemberRoleLike[]>(
      await admin.agent.get(`/parties/${id}/members`).expect(200),
    );
    expect(list.map((m) => m.role)).toEqual(['MEMBER']);
  });

  it('« Retirer » : un administrateur nommé n’est plus retirable (409), même par le créateur', async () => {
    const id = await newGroup('role-retirer', [[member, 'MEMBER']]);
    await setRole(admin, id, member.id, { role: 'ADMIN' }).expect(200);
    await admin.agent.delete(`/parties/${id}/members/${member.id}`).expect(409);
    expect(await roleOf(id, member.id)).toBe('ADMIN');
  });

  it("deux administrateurs quittent l'office en même temps, avec confirmation : le groupe disparaît une seule fois, jamais zéro admin sans suppression", async () => {
    const id = await newGroup('role-concurrent', [[admin2, 'ADMIN']]);
    const [a, b] = await Promise.all([
      setRole(admin, id, admin.id, { role: 'MEMBER', deleteIfLastAdmin: true }),
      setRole(admin2, id, admin2.id, { role: 'MEMBER', deleteIfLastAdmin: true }),
    ]);
    // Le verrou sérialise : le premier quitte l'office, le second voit le recomptage (dernier
    // administrateur, suppression confirmée). Les deux réussissent, le groupe disparaît UNE fois.
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await h.prisma.partie.count({ where: { id } })).toBe(0);
  });

  it("deux départs simultanés sans confirmation : un seul réussit, l'autre est refusé, un admin reste", async () => {
    const id = await newGroup('role-concurrent-sans', [[admin2, 'ADMIN']]);
    const [a, b] = await Promise.all([
      setRole(admin, id, admin.id, { role: 'MEMBER' }),
      setRole(admin2, id, admin2.id, { role: 'MEMBER' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);
    expect(await h.prisma.membership.count({ where: { partieId: id, role: 'ADMIN' } })).toBe(1);
  });
});

// Story 39.5 — quitter un groupe : `DELETE /parties/:id/members/me`, même procédure `leave()` que le
// retrait. Départ d'un membre, du créateur, d'un administrateur ; dernier administrateur sous
// confirmation explicite ; refus (étranger, JDR, rencontre isolée) ; départs simultanés sous verrou.
describe('Ralliement — quitter un groupe (Story 39.5)', () => {
  let h: Harness;
  let admin: TestUser;
  let admin2: TestUser;
  let member: TestUser;
  let stranger: TestUser;

  const LAST_ADMIN = 'dernier administrateur';

  beforeAll(async () => {
    h = await Harness.start();
    [admin, admin2, member, stranger] = await Promise.all([
      h.createUser('quit-admin'),
      h.createUser('quit-admin2'),
      h.createUser('quit-membre'),
      h.createUser('quit-etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  /** Un groupe neuf : `admin` (créateur, ADMIN) + les membres demandés. */
  const newGroup = async (label: string, members: [TestUser, 'ADMIN' | 'MEMBER'][] = []) => {
    const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', label, 'ralliement');
    for (const [user, role] of members) await h.addMember(id, user, role);
    return id;
  };
  const leave = (who: TestUser, partieId: string, query = '') =>
    who.agent.delete(`/parties/${partieId}/members/me${query}`);
  const membershipOf = (partieId: string, userId: string) =>
    h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId } } });

  it('un membre quitte : adhésion supprimée, le groupe sort de sa liste, les autres sont notifiés', async () => {
    const id = await newGroup('quit-membre', [[member, 'MEMBER']]);
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const res = await leave(member, id).expect(200);
      expect(body<{ ok: boolean; deleted: boolean }>(res)).toEqual({ ok: true, deleted: false });
      // Sa propre liste perd le groupe ; les listes de membres ouvertes se rafraîchissent.
      expect(emit).toHaveBeenCalledWith(userTopic(member.id));
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
      expect(emit).toHaveBeenCalledWith(partieTopic(id));
    } finally {
      emit.mockRestore();
    }
    expect(await membershipOf(id, member.id)).toBeNull();
    const mine = body<PartieDtoLike[]>(await member.agent.get('/parties').expect(200));
    expect(mine.map((p) => p.id)).not.toContain(id);
    await member.agent.get(`/parties/${id}`).expect(403);
    const others = body<MemberLike[]>(await admin.agent.get(`/parties/${id}/members`).expect(200));
    expect(others.map((m) => m.userId)).toEqual([admin.id]);
  });

  it('le créateur redevenu simple membre quitte : ownerId vide, le groupe reste', async () => {
    const id = await newGroup('quit-createur', [[admin2, 'ADMIN']]);
    await admin.agent
      .patch(`/parties/${id}/members/${admin.id}/role`)
      .send({ role: 'MEMBER' })
      .expect(200);
    await leave(admin, id).expect(200);
    const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
    expect(stored.ownerId).toBeNull();
    expect(await membershipOf(id, admin.id)).toBeNull();
    // Plus de propriétaire fantôme : l'ancien créateur n'a plus aucun accès.
    await admin.agent.get(`/parties/${id}`).expect(403);
    const got = await admin2.agent.get(`/parties/${id}`).expect(200);
    expect(body<PartieDtoLike>(got).role).toBe('admin');
  });

  it("un administrateur part alors qu'un autre reste : il quitte simplement, le groupe reste", async () => {
    const id = await newGroup('quit-admin', [
      [admin2, 'ADMIN'],
      [member, 'MEMBER'],
    ]);
    await leave(admin2, id).expect(200);
    expect(await membershipOf(id, admin2.id)).toBeNull();
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);
    // Le créateur n'est pas celui qui part : la propriété ne bouge pas.
    const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
    expect(stored.ownerId).toBe(admin.id);
  });

  it('dernier administrateur : 409 sans confirmation, rien ne change ; confirmé, le groupe disparaît pour tous', async () => {
    const id = await newGroup('quit-dernier', [[member, 'MEMBER']]);
    for (const query of ['', '?deleteIfLastAdmin=false', '?deleteIfLastAdmin=1']) {
      const res = await leave(admin, id, query).expect(409);
      expect(body<{ message: string }>(res).message).toContain(LAST_ADMIN);
    }
    expect(await membershipOf(id, admin.id)).toMatchObject({ role: 'ADMIN' });
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);

    const res = await leave(admin, id, '?deleteIfLastAdmin=true').expect(200);
    expect(body<{ ok: boolean; deleted: boolean }>(res)).toEqual({ ok: true, deleted: true });
    expect(await h.prisma.partie.count({ where: { id } })).toBe(0);
    expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(0);
    await member.agent.get(`/parties/${id}`).expect(404);
  });

  it('refus : un étranger (403 « pas accès »), rien écrit', async () => {
    const id = await newGroup('quit-etranger', [[member, 'MEMBER']]);
    const res = await leave(stranger, id).expect(403);
    expect(body<{ message: string }>(res).message).toBe(NO_ACCESS);
    expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(2);
  });

  it('refus : partie de JDR — ni le joueur ni le MJ ne la quittent par cette route (403)', async () => {
    const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'quit-jdr');
    await h.addMember(id, member);
    await leave(member, id).expect(403);
    await leave(admin, id).expect(403);
    expect(await membershipOf(id, member.id)).not.toBeNull();
    // Le retrait d'un joueur par le MJ, lui, est inchangé.
    await admin.agent.delete(`/parties/${id}/members/${member.id}`).expect(200);
    expect(await membershipOf(id, member.id)).toBeNull();
    const stored = await h.prisma.partie.findUniqueOrThrow({ where: { id } });
    expect(stored.ownerId).toBe(admin.id);
  });

  it('refus : rencontre isolée (ONE_SHOT) — 403 « indisponible », à son membre comme à son administrateur', async () => {
    const { id } = await h.createPartie(admin, 'ONE_SHOT', 'quit-isolee', 'ralliement');
    await h.addMember(id, member);
    for (const who of [member, admin]) {
      const res = await leave(who, id).expect(403);
      expect(body<{ message: string }>(res).message).toBe(UNAVAILABLE);
    }
    expect(await h.prisma.membership.count({ where: { partieId: id } })).toBe(2);
  });

  it('les deux derniers administrateurs partent en même temps, confirmés : le groupe disparaît une seule fois', async () => {
    const id = await newGroup('quit-concurrent', [
      [admin2, 'ADMIN'],
      [member, 'MEMBER'],
    ]);
    const [a, b] = await Promise.all([
      leave(admin, id, '?deleteIfLastAdmin=true'),
      leave(admin2, id, '?deleteIfLastAdmin=true'),
    ]);
    // Le verrou sérialise : le premier part simplement, le second se recompte dernier
    // administrateur et supprime le groupe (confirmé). Jamais un groupe sans administrateur.
    expect([a.status, b.status]).toEqual([200, 200]);
    const deleted = [a, b].map((r) => body<{ deleted: boolean }>(r).deleted).sort();
    expect(deleted).toEqual([false, true]);
    expect(await h.prisma.partie.count({ where: { id } })).toBe(0);
  });

  it("deux derniers administrateurs partent en même temps, sans confirmation : l'un part, l'autre est refusé", async () => {
    const id = await newGroup('quit-concurrent-sans', [
      [admin2, 'ADMIN'],
      [member, 'MEMBER'],
    ]);
    const [a, b] = await Promise.all([leave(admin, id), leave(admin2, id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await h.prisma.partie.count({ where: { id } })).toBe(1);
    expect(await h.prisma.membership.count({ where: { partieId: id, role: 'ADMIN' } })).toBe(1);
  });
});

// Story 40.1 — proposer une conjonction à date fixée : tout membre d'un groupe propose, il en est
// l'hôte ; l'événement et sa séance datée unique sont écrits ensemble ; le groupe passe « en cours » ;
// la carte, l'agenda de l'hôte et ses indisponibilités suivent. Refus : partie de JDR, étranger,
// membre d'un autre groupe, rencontre isolée ; saisies invalides en 400, rien écrit.
describe('Ralliement — proposer une conjonction à date fixée (Story 40.1)', () => {
  let h: Harness;
  let admin: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    hostDisplayName: string | null;
    seance: {
      id: string;
      date: string | null;
      slot: string | null;
      lieu: string | null;
      heureRdv: string | null;
      notePratique: string | null;
      capacity: number | null;
    } | null;
    participants: { userId: string; displayName: string; isHost: boolean; isAdmin: boolean }[];
  };
  type ErrorLike = { statusCode: number; message: string | string[] };
  type CalendarLike = { 'mes-seances': { seanceId: string }[] };
  type DatedPartieLike = PartieDtoLike & {
    nextSessionDate: string | null;
    nextSessionSlot: string | null;
  };

  const payload = (over: Record<string, unknown> = {}) => ({
    title: 'Catane et galettes',
    date: isoDay(5),
    slot: 'EVENING',
    ...over,
  });
  const propose = (who: TestUser, partieId: string, sent: Record<string, unknown>) =>
    who.agent.post(`/parties/${partieId}/events`).send(sent);
  const eventCount = (partieId: string) => h.prisma.event.count({ where: { partieId } });

  beforeAll(async () => {
    h = await Harness.start();
    [admin, member, stranger, otherAdmin] = await Promise.all([
      h.createUser('conj-admin'),
      h.createUser('conj-membre'),
      h.createUser('conj-etranger'),
      h.createUser('conj-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'conj', 'ralliement'));
    await h.addMember(groupId, member);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'conj-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('avant toute conjonction : le groupe est « À venir », la liste est vide', async () => {
    const partie = body<PartieDtoLike>(await admin.agent.get(`/parties/${groupId}`).expect(200));
    expect(partie.status).toBe('A_VENIR');
    const list = await member.agent.get(`/parties/${groupId}/events/list`).expect(200);
    expect(body<CardLike[]>(list)).toEqual([]);
  });

  it('un simple membre propose : 201, il est l’hôte ; événement + séance datée unique ; groupe EN_COURS, prochaine date posée ; tous sont prévenus', async () => {
    const day = isoDay(5);
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let card: CardLike;
    try {
      const res = await propose(
        member,
        groupId,
        payload({ lieu: ' Lyon 3e ', heureRdv: '20:30', notePratique: 'On mange sur place.' }),
      ).expect(201);
      card = body<CardLike>(res);
      // Carte en temps réel pour tous les membres, liste d'accueil (statut, date) de chacun.
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
      expect(emit).toHaveBeenCalledWith(userTopic(member.id));
    } finally {
      emit.mockRestore();
    }

    expect(card).toEqual({
      id: card.id,
      title: 'Catane et galettes',
      hostId: member.id,
      hostDisplayName: member.displayName,
      seance: {
        id: card.seance!.id,
        date: day,
        slot: 'EVENING',
        lieu: 'Lyon 3e',
        heureRdv: '20:30',
        notePratique: 'On mange sur place.',
        capacity: null,
        endDate: day,
        endSlot: 'EVENING',
        durationSlots: 1,
        placesTaken: 1,
      },
      // Story 40.2 : l'hôte est le premier (et ici le seul) participant.
      participants: [
        {
          userId: member.id,
          displayName: member.displayName,
          isHost: true,
          isAdmin: false,
          status: 'CONFIRMED',
        },
      ],
      myInscription: null,
      // Story 40.5 : une conjonction à date fixée n'a pas de sondage.
      poll: null,
      // Story 42.1 : une conjonction n'est pas annulée à sa création.
      cancelled: false,
      // Story 44.1 : l'hôte a les droits d'organisateur de sa conjonction.
      can: { propose: true, edit: true, choose: true, extend: true },
    });

    const events = await h.prisma.event.findMany({
      where: { partieId: groupId },
      include: { seances: true, scenario: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0].ownerId).toBe(member.id);
    expect(events[0].scenario).toBeNull();
    expect(events[0].seances).toHaveLength(1);
    const seance = events[0].seances[0];
    expect(seance.startDate?.toISOString()).toBe(`${day}T00:00:00.000Z`);
    expect(seance.endDate?.toISOString()).toBe(`${day}T00:00:00.000Z`);
    expect([seance.startSlot, seance.endSlot]).toEqual(['EVENING', 'EVENING']);
    expect(seance.inscriptionMax).toBeNull();
    // Aucune inscription : l'hôte occupe sa place sans ligne `Inscription` (AD-15).
    expect(await h.prisma.inscription.count({ where: { seanceId: seance.id } })).toBe(0);

    // Statut et prochaine date, vus par chacun (détail et liste d'accueil).
    for (const who of [admin, member]) {
      const partie = body<DatedPartieLike>(await who.agent.get(`/parties/${groupId}`).expect(200));
      expect(partie.status).toBe('EN_COURS');
      expect(partie.nextSessionDate).toBe(`${day}T00:00:00.000Z`);
      expect(partie.nextSessionSlot).toBe('EVENING');
      const mine = body<PartieDtoLike[]>(await who.agent.get('/parties').expect(200));
      expect(mine.find((p) => p.id === groupId)?.status).toBe('EN_COURS');
    }

    // La liste des conjonctions, lue par l'administrateur.
    const list = body<CardLike[]>(
      await admin.agent.get(`/parties/${groupId}/events/list`).expect(200),
    );
    // Story 44.1 : même carte, mais les droits d'organisateur sont ceux de qui lit — un administrateur
    // qui n'est pas l'hôte n'en a aucun.
    expect(list).toEqual([
      { ...card, can: { propose: false, edit: false, choose: false, extend: false } },
    ]);
  });

  it('places limitées : N = 8 stocké tel quel (aucun plafond) ; N < 2 → 400, rien écrit', async () => {
    const res = await propose(admin, groupId, payload({ title: 'Huit places', capacity: 8 }));
    expect(res.status).toBe(201);
    expect(body<CardLike>(res).seance?.capacity).toBe(8);
    const seance = await h.prisma.seance.findFirstOrThrow({
      where: { event: { partieId: groupId, title: 'Huit places' } },
    });
    expect(seance.inscriptionMax).toBe(8);

    const before = await eventCount(groupId);
    const refused = await propose(admin, groupId, payload({ title: 'Une place', capacity: 1 }));
    expect(refused.status).toBe(400);
    expect(await eventCount(groupId)).toBe(before);
  });

  it.each([
    ['créneau FULL_DAY', { slot: 'FULL_DAY' }],
    ['créneau absent', { slot: undefined }],
    ['date mal formée', { date: '10/10/2031' }],
    ['date inexistante', { date: '2031-02-31' }],
    ['date passée', { date: isoDay(-1) }],
    ['nom vide', { title: '   ' }],
    ['heure mal formée', { heureRdv: '20h30' }],
    ['lieu trop long', { lieu: 'x'.repeat(81) }],
    ['note trop longue', { notePratique: 'x'.repeat(201) }],
  ])('%s → 400 avec un message en français, rien écrit', async (_label, over) => {
    const before = await eventCount(groupId);
    const res = await propose(member, groupId, payload(over));
    expect(res.status).toBe(400);
    const message = body<ErrorLike>(res).message;
    const text = Array.isArray(message) ? message.join(' ') : message;
    // Français : aucun message de validation par défaut (anglais) de class-validator.
    expect(text).not.toMatch(/must be|should not|is not/i);
    expect(text.length).toBeGreaterThan(0);
    expect(await eventCount(groupId)).toBe(before);
  });

  it('aujourd’hui est accepté', async () => {
    await propose(member, groupId, payload({ title: 'Ce soir', date: isoDay(0) })).expect(201);
  });

  describe('refus (403, rien écrit)', () => {
    it('un étranger : « pas accès », en création comme en lecture', async () => {
      const before = await eventCount(groupId);
      const res = await propose(stranger, groupId, payload());
      expect(res.status).toBe(403);
      expect(body<ErrorLike>(res).message).toBe(NO_ACCESS);
      await stranger.agent.get(`/parties/${groupId}/events/list`).expect(403);
      expect(await eventCount(groupId)).toBe(before);
    });

    it('le membre d’un autre groupe : ni création ni lecture', async () => {
      const before = await eventCount(groupId);
      expect((await propose(otherAdmin, groupId, payload())).status).toBe(403);
      await otherAdmin.agent.get(`/parties/${groupId}/events/list`).expect(403);
      expect(await eventCount(groupId)).toBe(before);
      // Et réciproquement : son propre groupe ne montre rien des conjonctions des autres.
      const own = body<CardLike[]>(
        await otherAdmin.agent.get(`/parties/${otherGroupId}/events/list`).expect(200),
      );
      expect(own).toEqual([]);
    });

    it('une partie de JDR : fermée au MJ comme au joueur, en création comme en lecture', async () => {
      const { id: jdrId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'conj-jdr');
      await h.addMember(jdrId, member);
      for (const who of [admin, member]) {
        expect((await propose(who, jdrId, payload())).status).toBe(403);
        await who.agent.get(`/parties/${jdrId}/events/list`).expect(403);
      }
      expect(await eventCount(jdrId)).toBe(0);
      const partie = body<PartieDtoLike>(await admin.agent.get(`/parties/${jdrId}`).expect(200));
      expect(partie.status).toBe('A_VENIR');
    });

    it('une rencontre isolée (ONE_SHOT) : « indisponible », même à son administrateur', async () => {
      const { id: isoleeId } = await h.createPartie(admin, 'ONE_SHOT', 'conj-isolee', 'ralliement');
      await h.addMember(isoleeId, member);
      for (const who of [admin, member]) {
        const res = await propose(who, isoleeId, payload());
        expect(res.status).toBe(403);
        expect(body<ErrorLike>(res).message).toBe(UNAVAILABLE);
      }
      // Son événement unique, créé avec elle, reste le seul.
      expect(await eventCount(isoleeId)).toBe(1);
    });
  });

  it('calendrier : l’hôte non créateur voit sa conjonction dans son agenda et en est occupé ; les autres membres non', async () => {
    const day = isoDay(9);
    const res = await propose(
      member,
      groupId,
      payload({ title: 'Agenda', date: day, slot: 'MORNING' }),
    );
    expect(res.status).toBe(201);
    const card = body<CardLike>(res);
    const query = { from: isoDay(0), to: isoDay(30) };

    const hostCal = body<CalendarLike>(
      await member.agent.get('/me/calendar').query(query).expect(200),
    );
    expect(hostCal['mes-seances'].map((s) => s.seanceId)).toContain(card.seance!.id);
    const adminCal = body<CalendarLike>(
      await admin.agent.get('/me/calendar').query(query).expect(200),
    );
    expect(adminCal['mes-seances'].map((s) => s.seanceId)).not.toContain(card.seance!.id);

    // Indisponibilités : une plage { date, slot } seulement, sans titre ni identité.
    const spans = await h.app.get(EventsService).occupiedSpansOf([member.id, admin.id]);
    const memberSpans = spans.get(member.id)!.map((s) => [s.date.toISOString(), s.slot]);
    expect(memberSpans).toContainEqual([`${day}T00:00:00.000Z`, 'MORNING']);
    const adminSpans = spans.get(admin.id)!.map((s) => [s.date.toISOString(), s.slot]);
    expect(adminSpans).not.toContainEqual([`${day}T00:00:00.000Z`, 'MORNING']);
    for (const span of spans.get(member.id)!) {
      expect(Object.keys(span).sort()).toEqual(['date', 'slot']);
    }
  });

  it('la liste compte toutes les conjonctions du groupe, triées par date', async () => {
    const list = body<CardLike[]>(
      await member.agent.get(`/parties/${groupId}/events/list`).expect(200),
    );
    expect(list).toHaveLength(await eventCount(groupId));
    const dates = list.map((c) => c.seance?.date ?? '');
    expect(dates).toEqual([...dates].sort());
  });
});

// Story 40.2 — consulter et modifier une conjonction : la carte porte ses participants (hôte puis
// inscrits, rôle admin lu en lot) ; l'hôte seul remplace sa conjonction à venir (PATCH), les autres
// membres, les étrangers et les autres familles sont refusés sans rien écrire.
describe('Ralliement — consulter et modifier une conjonction (Story 40.2)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: {
      id: string;
      date: string | null;
      slot: string | null;
      lieu: string | null;
      heureRdv: string | null;
      notePratique: string | null;
      capacity: number | null;
    } | null;
    participants: { userId: string; displayName: string; isHost: boolean; isAdmin: boolean }[];
  };
  type ErrorLike = { statusCode: number; message: string | string[] };
  type DatedPartieLike = PartieDtoLike & { nextSessionDate: string | null };

  const HOST_ONLY = "Action réservée à l'hôte de la conjonction";
  const PAST_DAY = 'La date ne peut pas être passée';
  const PAST_EVENT = 'Cette conjonction est passée : elle ne peut plus être modifiée';

  const payload = (over: Record<string, unknown> = {}) => ({
    title: 'Soirée plateaux',
    date: isoDay(6),
    slot: 'EVENING',
    ...over,
  });
  const propose = async (who: TestUser, partieId: string, over: Record<string, unknown> = {}) =>
    body<CardLike>(
      await who.agent.post(`/parties/${partieId}/events`).send(payload(over)).expect(201),
    );
  const edit = (who: TestUser, partieId: string, eventId: string, sent: Record<string, unknown>) =>
    who.agent.patch(`/parties/${partieId}/events/${eventId}`).send(sent);
  const stored = (eventId: string) =>
    h.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { seances: true } });
  const inscribe = (seanceId: string, user: TestUser) =>
    h.prisma.inscription.create({ data: { seanceId, userId: user.id } });

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, stranger, otherAdmin] = await Promise.all([
      h.createUser('edit-admin'),
      h.createUser('edit-hote'),
      h.createUser('edit-invite'),
      h.createUser('edit-etranger'),
      h.createUser('edit-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'edit', 'ralliement'));
    await h.addMember(groupId, host);
    await h.addMember(groupId, guest);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'edit-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('participants : l’hôte d’abord, puis les inscrits par ordre d’inscription ; l’administrateur est signalé ; tout membre les lit, aucun étranger', async () => {
    const card = await propose(host, groupId, { title: 'Avec inscrits', capacity: 6 });
    await inscribe(card.seance!.id, guest);
    await inscribe(card.seance!.id, admin);

    const list = body<CardLike[]>(
      await guest.agent.get(`/parties/${groupId}/events/list`).expect(200),
    );
    const read = list.find((c) => c.id === card.id)!;
    expect(read.participants).toEqual([
      {
        userId: host.id,
        displayName: host.displayName,
        isHost: true,
        isAdmin: false,
        status: 'CONFIRMED',
      },
      {
        userId: guest.id,
        displayName: guest.displayName,
        isHost: false,
        isAdmin: false,
        status: 'CONFIRMED',
      },
      {
        userId: admin.id,
        displayName: admin.displayName,
        isHost: false,
        isAdmin: true,
        status: 'CONFIRMED',
      },
    ]);
    await stranger.agent.get(`/parties/${groupId}/events/list`).expect(403);
  });

  it('l’hôte modifie : 200 + carte, tout est remplacé, le rappel est ré-armé, la prochaine date recalculée, tous prévenus', async () => {
    const card = await propose(host, groupId, {
      title: 'À corriger',
      lieu: 'Lyon',
      heureRdv: '20:00',
      notePratique: 'Ancienne note',
      capacity: 5,
    });
    await h.prisma.seance.update({
      where: { id: card.seance!.id },
      data: { reminderSentAt: new Date() },
    });
    const newDay = isoDay(40);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let updated: CardLike;
    try {
      const res = await edit(
        host,
        groupId,
        card.id,
        payload({
          title: '  Corrigée  ',
          date: newDay,
          slot: 'MORNING',
          lieu: ' Paris ',
          heureRdv: '09:30',
          notePratique: null,
          capacity: null,
        }),
      ).expect(200);
      updated = body<CardLike>(res);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(updated).toEqual({
      id: card.id,
      title: 'Corrigée',
      hostId: host.id,
      hostDisplayName: host.displayName,
      seance: {
        id: card.seance!.id,
        date: newDay,
        slot: 'MORNING',
        lieu: 'Paris',
        heureRdv: '09:30',
        notePratique: null,
        capacity: null,
        endDate: newDay,
        endSlot: 'MORNING',
        durationSlots: 1,
        placesTaken: 1,
      },
      participants: [
        {
          userId: host.id,
          displayName: host.displayName,
          isHost: true,
          isAdmin: false,
          status: 'CONFIRMED',
        },
      ],
      myInscription: null,
      poll: null,
      cancelled: false,
      can: { propose: true, edit: true, choose: true, extend: true },
    });
    const event = await stored(card.id);
    expect(event.title).toBe('Corrigée');
    expect(event.ownerId).toBe(host.id); // l'hôte est immuable
    const seance = event.seances[0];
    expect(seance.startDate?.toISOString()).toBe(`${newDay}T00:00:00.000Z`);
    expect(seance.endDate?.toISOString()).toBe(`${newDay}T00:00:00.000Z`);
    expect([seance.startSlot, seance.endSlot]).toEqual(['MORNING', 'MORNING']);
    expect(seance.inscriptionMax).toBeNull();
    expect(seance.reminderSentAt).toBeNull();
    // Un seul événement, une seule séance : remplacement, pas création.
    expect(event.seances).toHaveLength(1);

    // La prochaine date de la partie est celle de la plus proche conjonction à venir.
    const partie = body<DatedPartieLike>(await admin.agent.get(`/parties/${groupId}`).expect(200));
    const nearest = await h.prisma.seance.findFirstOrThrow({
      where: { event: { partieId: groupId }, startDate: { not: null } },
      orderBy: { startDate: 'asc' },
    });
    expect(partie.nextSessionDate).toBe(nearest.startDate!.toISOString());
  });

  it('groupe à une seule conjonction : la prochaine date de la partie suit exactement la date modifiée', async () => {
    const { id: soloId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'edit-solo',
      'ralliement',
    );
    const solo = await propose(admin, soloId, { title: 'Seule', date: isoDay(6) });
    const nextDate = async () =>
      body<DatedPartieLike>(await admin.agent.get(`/parties/${soloId}`).expect(200))
        .nextSessionDate;
    expect(await nextDate()).toBe(`${isoDay(6)}T00:00:00.000Z`);

    await edit(admin, soloId, solo.id, payload({ title: 'Seule', date: isoDay(40) })).expect(200);

    expect(await nextDate()).toBe(`${isoDay(40)}T00:00:00.000Z`);
  });

  it('même jour et même créneau : le rappel déjà envoyé n’est pas ré-armé', async () => {
    const card = await propose(host, groupId, { title: 'Stable' });
    const sentAt = new Date('2026-01-01T10:00:00.000Z');
    await h.prisma.seance.update({
      where: { id: card.seance!.id },
      data: { reminderSentAt: sentAt },
    });

    await edit(
      host,
      groupId,
      card.id,
      payload({ title: 'Stable renommée', date: card.seance!.date }),
    ).expect(200);

    const seance = (await stored(card.id)).seances[0];
    expect(seance.reminderSentAt?.toISOString()).toBe(sentAt.toISOString());
  });

  describe('refus (rien n’est écrit)', () => {
    let card: CardLike;
    beforeAll(async () => {
      card = await propose(host, groupId, { title: 'Intouchable', capacity: 4, lieu: 'Nantes' });
    });
    const untouched = async () => {
      const event = await stored(card.id);
      expect(event.title).toBe('Intouchable');
      expect(event.seances[0].lieu).toBe('Nantes');
      expect(event.seances[0].inscriptionMax).toBe(4);
    };

    it('un autre membre, y compris l’administrateur du groupe : 403 « réservée à l’hôte »', async () => {
      for (const who of [guest, admin]) {
        const res = await edit(who, groupId, card.id, payload({ title: 'Piraté' }));
        expect(res.status).toBe(403);
        expect(body<ErrorLike>(res).message).toBe(HOST_ONLY);
      }
      await untouched();
    });

    it('un étranger : 403 « pas accès » ; le membre d’un autre groupe aussi', async () => {
      for (const who of [stranger, otherAdmin]) {
        const res = await edit(who, groupId, card.id, payload({ title: 'Piraté' }));
        expect(res.status).toBe(403);
        expect(body<ErrorLike>(res).message).toBe(NO_ACCESS);
      }
      await untouched();
    });

    it('l’événement d’un autre groupe par la route du sien : 404, rien n’est écrit des deux côtés', async () => {
      const foreign = await propose(otherAdmin, otherGroupId, { title: 'Autre groupe' });
      // L'hôte de B est aussi membre de A : l'événement de B ne s'atteint pas par la route de A.
      await h.addMember(groupId, otherAdmin);
      try {
        const res = await edit(otherAdmin, groupId, foreign.id, payload({ title: 'Détourné' }));
        expect(res.status).toBe(404);
      } finally {
        await h.prisma.membership.deleteMany({
          where: { partieId: groupId, userId: otherAdmin.id },
        });
      }
      expect((await stored(foreign.id)).title).toBe('Autre groupe');
      // Un membre de A, étranger à B, est refusé avant même d'atteindre la route.
      const asMember = await edit(host, otherGroupId, foreign.id, payload({ title: 'Détourné' }));
      expect(asMember.status).toBe(403);
      expect((await stored(foreign.id)).title).toBe('Autre groupe');
      await untouched();
    });

    it('un événement inconnu : 404', async () => {
      await edit(host, groupId, randomUUID(), payload()).expect(404);
    });

    it('une partie de JDR : 403 pour le MJ comme pour le joueur', async () => {
      const { id: jdrId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'edit-jdr');
      await h.addMember(jdrId, guest);
      const scenario = body<{ id: string }>(
        await admin.agent
          .post(`/parties/${jdrId}/scenarios`)
          .send({ title: 'Scénario' })
          .expect(201),
      );
      for (const who of [admin, guest]) {
        const res = await edit(who, jdrId, scenario.id, payload({ title: 'Piraté' }));
        expect(res.status).toBe(403);
      }
      expect((await stored(scenario.id)).title).toBe('Scénario');
    });

    it('une rencontre isolée (ONE_SHOT, Story 41.2) : son hôte la complète ; les cas détaillés sont en fin de fichier', async () => {
      const { id: isoleeId } = await h.createPartie(admin, 'ONE_SHOT', 'edit-isolee', 'ralliement');
      const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: isoleeId } });
      const res = await edit(admin, isoleeId, event.id, payload({ title: 'Complétée' }));
      expect(res.status).toBe(200);
      expect((await stored(event.id)).title).toBe('Complétée');
    });

    it('une conjonction passée : 400 français, rien n’est écrit', async () => {
      const past = await propose(host, groupId, { title: 'Hier' });
      const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
      await h.prisma.seance.update({
        where: { id: past.seance!.id },
        data: { startDate: day, endDate: day },
      });

      const res = await edit(host, groupId, past.id, payload({ title: 'Trop tard' }));
      expect(res.status).toBe(400);
      expect(body<ErrorLike>(res).message).toBe(PAST_EVENT);
      expect((await stored(past.id)).title).toBe('Hier');
    });

    it('une nouvelle date passée ou inexistante : 400 français', async () => {
      const res = await edit(host, groupId, card.id, payload({ title: 'Passé', date: isoDay(-1) }));
      expect(res.status).toBe(400);
      expect(body<ErrorLike>(res).message).toBe(PAST_DAY);
      await edit(host, groupId, card.id, payload({ date: '2031-02-31' })).expect(400);
      await untouched();
    });

    it('une saisie invalide : 400 sans message anglais ; le créneau FULL_DAY et l’hôte en corps sont refusés', async () => {
      for (const over of [
        { heureRdv: '20h30' },
        { title: '   ' },
        { slot: 'FULL_DAY' },
        { capacity: 1 },
      ]) {
        const res = await edit(host, groupId, card.id, payload(over));
        expect(res.status).toBe(400);
        const message = body<ErrorLike>(res).message;
        const text = Array.isArray(message) ? message.join(' ') : message;
        expect(text).not.toMatch(/must be|should not|is not/i);
      }
      // L'hôte est immuable : aucun champ ne le désigne (propriété inconnue refusée).
      await edit(host, groupId, card.id, payload({ ownerId: guest.id })).expect(400);
      await untouched();
    });
  });

  it('capacité : sous les participants actuels (hôte + inscrits) → 400 ; égale → acceptée ; sans limite → acceptée', async () => {
    const card = await propose(host, groupId, { title: 'Quota', capacity: 6 });
    await inscribe(card.seance!.id, guest);
    await inscribe(card.seance!.id, admin);
    // 3 participants : l'hôte et deux inscrits.

    const tooSmall = await edit(host, groupId, card.id, payload({ title: 'Quota', capacity: 2 }));
    expect(tooSmall.status).toBe(400);
    expect(String(body<ErrorLike>(tooSmall).message)).toMatch(/participants actuels \(3\)/);
    expect((await stored(card.id)).seances[0].inscriptionMax).toBe(6);

    const exact = await edit(
      host,
      groupId,
      card.id,
      payload({ title: 'Quota', capacity: 3 }),
    ).expect(200);
    expect(body<CardLike>(exact).seance?.capacity).toBe(3);
    const open = await edit(
      host,
      groupId,
      card.id,
      payload({ title: 'Quota', capacity: null }),
    ).expect(200);
    expect(body<CardLike>(open).seance?.capacity).toBeNull();
  });
});

describe("Ralliement — s'inscrire à une conjonction et s'en désinscrire (Story 40.3)", () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: {
      id: string;
      date: string | null;
      slot: string | null;
      capacity: number | null;
    } | null;
    participants: { userId: string; isHost: boolean }[];
  };
  type ErrorLike = { statusCode: number; message: string | string[] };

  const FULL = 'Cette conjonction est complète : plus aucune place disponible';
  const PAST_ROSTER = 'Cette conjonction est passée : les inscriptions ne peuvent plus changer';

  const propose = async (who: TestUser, partieId: string, over: Record<string, unknown> = {}) =>
    body<CardLike>(
      await who.agent
        .post(`/parties/${partieId}/events`)
        .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING', ...over })
        .expect(201),
    );
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const unsubscribe = (who: TestUser, seanceId: string) =>
    who.agent.delete(`/scenarios/seances/${seanceId}/inscription`);
  const registered = async (seanceId: string) =>
    (
      await h.prisma.inscription.findMany({ where: { seanceId }, orderBy: { createdAt: 'asc' } })
    ).map((i) => i.userId);
  const ids = (card: CardLike) => card.participants.map((p) => p.userId);
  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, third, stranger, otherAdmin] = await Promise.all([
      h.createUser('insc-admin'),
      h.createUser('insc-hote'),
      h.createUser('insc-invite'),
      h.createUser('insc-tiers'),
      h.createUser('insc-etranger'),
      h.createUser('insc-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'insc', 'ralliement'));
    await h.addMember(groupId, host);
    await h.addMember(groupId, guest);
    await h.addMember(groupId, third);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'insc-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('« Tous les membres » : un membre s’inscrit (201 + carte), figure dans les participants, tous sont prévenus en direct', async () => {
    const card = await propose(host, groupId, { title: 'Pour tous' });
    expect(card.seance?.capacity).toBeNull();

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let res: Response;
    try {
      res = await signUp(guest, card.seance!.id).expect(201);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      // La liste d'accueil des membres (statut, « mes conjonctions ») est prévenue après l'écriture.
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
      expect(emit).toHaveBeenCalledWith(userTopic(third.id));
    } finally {
      emit.mockRestore();
    }

    const updated = body<CardLike>(res);
    expect(updated.id).toBe(card.id);
    expect(ids(updated)).toEqual([host.id, guest.id]);
    expect(await registered(card.seance!.id)).toEqual([guest.id]);
    // Aucune limite : tous les autres peuvent s'inscrire, l'administrateur compris.
    await signUp(third, card.seance!.id).expect(201);
    await signUp(admin, card.seance!.id).expect(201);
    expect(await registered(card.seance!.id)).toHaveLength(3);
    // Les autres membres lisent la même liste.
    const list = body<CardLike[]>(
      await third.agent.get(`/parties/${groupId}/events/list`).expect(200),
    );
    expect(ids(list.find((c) => c.id === card.id)!)).toEqual([
      host.id,
      guest.id,
      third.id,
      admin.id,
    ]);
  });

  it('places limitées : l’hôte tient une place, premier arrivé premier servi, complet → 409 français, rien d’écrit', async () => {
    const card = await propose(host, groupId, { title: 'Trois places', capacity: 3 });
    const seanceId = card.seance!.id;

    await signUp(guest, seanceId).expect(201);
    expect(await registered(seanceId)).toEqual([guest.id]);
    await signUp(third, seanceId).expect(201);

    const full = await signUp(admin, seanceId);
    expect(full.status).toBe(409);
    expect(message(full)).toBe(FULL);
    expect(await registered(seanceId)).toEqual([guest.id, third.id]);
  });

  it('dernière place, deux membres en même temps : exactement un est accepté, l’autre reçoit « complet »', async () => {
    const card = await propose(host, groupId, { title: 'Dernière place', capacity: 2 });
    const seanceId = card.seance!.id;

    const [a, b] = await Promise.all([signUp(guest, seanceId), signUp(third, seanceId)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(message(loser)).toBe(FULL);
    expect(await registered(seanceId)).toHaveLength(1);
  });

  it('trois membres en même temps sur deux places : jamais plus de places que la capacité', async () => {
    const card = await propose(host, groupId, { title: 'Course', capacity: 3 });
    const seanceId = card.seance!.id;

    const results = await Promise.all([
      signUp(guest, seanceId),
      signUp(third, seanceId),
      signUp(admin, seanceId),
    ]);

    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    expect(await registered(seanceId)).toHaveLength(2);
  });

  it('inscription tardive : la date est déjà posée, l’inscription est acceptée et la date ne bouge pas', async () => {
    const day = isoDay(2);
    const card = await propose(host, groupId, { title: 'Datée', date: day, slot: 'AFTERNOON' });

    const res = await signUp(guest, card.seance!.id).expect(201);

    const updated = body<CardLike>(res);
    expect(updated.seance).toMatchObject({ date: day, slot: 'AFTERNOON' });
    const seance = await h.prisma.seance.findUniqueOrThrow({ where: { id: card.seance!.id } });
    expect(seance.startDate?.toISOString()).toBe(`${day}T00:00:00.000Z`);
    expect(seance.startSlot).toBe('AFTERNOON');
  });

  it('désinscription : la ligne et la place sont libérées (un autre peut la prendre), tous sont prévenus', async () => {
    const card = await propose(host, groupId, { title: 'Libre-service', capacity: 2 });
    const seanceId = card.seance!.id;
    await signUp(guest, seanceId).expect(201);
    expect((await signUp(third, seanceId)).status).toBe(409);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let res: Response;
    try {
      res = await unsubscribe(guest, seanceId).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
    } finally {
      emit.mockRestore();
    }

    expect(ids(body<CardLike>(res))).toEqual([host.id]);
    expect(await registered(seanceId)).toEqual([]);
    await signUp(third, seanceId).expect(201);
    expect(await registered(seanceId)).toEqual([third.id]);
  });

  it('idempotence : s’inscrire deux fois, l’hôte qui s’inscrit ou se désinscrit, un non-inscrit qui se désinscrit — la carte revient, rien ne change', async () => {
    const card = await propose(host, groupId, { title: 'Idempotente', capacity: 3 });
    const seanceId = card.seance!.id;

    await signUp(guest, seanceId).expect(201);
    const again = body<CardLike>(await signUp(guest, seanceId).expect(201));
    expect(ids(again)).toEqual([host.id, guest.id]);
    expect(await registered(seanceId)).toEqual([guest.id]);

    const hostSignUp = body<CardLike>(await signUp(host, seanceId).expect(201));
    expect(ids(hostSignUp)).toEqual([host.id, guest.id]);
    const hostLeave = body<CardLike>(await unsubscribe(host, seanceId).expect(200));
    expect(ids(hostLeave)).toEqual([host.id, guest.id]);
    expect(await registered(seanceId)).toEqual([guest.id]);

    const notRegistered = body<CardLike>(await unsubscribe(third, seanceId).expect(200));
    expect(ids(notRegistered)).toEqual([host.id, guest.id]);
    // Un inscrit n'est jamais rejeté par une conjonction devenue pleine.
    await signUp(third, seanceId).expect(201);
    await signUp(guest, seanceId).expect(201);
    expect(await registered(seanceId)).toEqual([guest.id, third.id]);
  });

  it('jour passé : ni inscription ni désinscription (400 français), rien ne change', async () => {
    const card = await propose(host, groupId, { title: 'Hier', capacity: 5 });
    const seanceId = card.seance!.id;
    await signUp(guest, seanceId).expect(201);
    const yesterday = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: seanceId },
      data: { startDate: yesterday, endDate: yesterday },
    });

    const lateSignUp = await signUp(third, seanceId);
    expect(lateSignUp.status).toBe(400);
    expect(message(lateSignUp)).toBe(PAST_ROSTER);
    const lateLeave = await unsubscribe(guest, seanceId);
    expect(lateLeave.status).toBe(400);
    expect(message(lateLeave)).toBe(PAST_ROSTER);
    expect(await registered(seanceId)).toEqual([guest.id]);
  });

  describe('refus (rien n’est écrit)', () => {
    let card: CardLike;
    beforeAll(async () => {
      card = await propose(host, groupId, { title: 'Fermée aux autres', capacity: 4 });
    });

    it('un étranger et l’administrateur d’un autre groupe : 403 « pas accès », en inscription comme en désinscription', async () => {
      for (const who of [stranger, otherAdmin]) {
        const up = await signUp(who, card.seance!.id);
        expect(up.status).toBe(403);
        expect(message(up)).toBe(NO_ACCESS);
        const down = await unsubscribe(who, card.seance!.id);
        expect(down.status).toBe(403);
        expect(message(down)).toBe(NO_ACCESS);
      }
      expect(await registered(card.seance!.id)).toEqual([]);
    });

    it('la séance d’un autre groupe n’est atteinte que par ses membres : le membre de A reçoit 403 sur la séance de B, rien n’est écrit', async () => {
      const foreign = await propose(otherAdmin, otherGroupId, { title: 'Chez les autres' });
      const res = await signUp(guest, foreign.seance!.id);
      expect(res.status).toBe(403);
      expect(message(res)).toBe(NO_ACCESS);
      expect(await registered(foreign.seance!.id)).toEqual([]);
      // Son propre groupe reste intact.
      expect(await registered(card.seance!.id)).toEqual([]);
    });

    it('une séance inconnue : 404', async () => {
      await signUp(guest, randomUUID()).expect(404);
      await unsubscribe(guest, randomUUID()).expect(404);
    });

    it('une rencontre isolée (ONE_SHOT) : 403 « indisponible », même à son administrateur', async () => {
      const { id: isoleeId } = await h.createPartie(admin, 'ONE_SHOT', 'insc-isolee', 'ralliement');
      const seance = await h.prisma.seance.findFirstOrThrow({
        where: { event: { partieId: isoleeId } },
      });
      for (const call of [signUp, unsubscribe]) {
        const res = await call(admin, seance.id);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(UNAVAILABLE);
      }
      expect(await registered(seance.id)).toEqual([]);
    });

    it('une partie de JDR : un membre du groupe n’y a aucun accès, et le MJ garde sa sémantique historique', async () => {
      const { id: jdrId } = await h.createPartie(otherAdmin, 'CAMPAGNE_EPISODIQUE', 'insc-jdr');
      const scenario = body<{ id: string; seances: { id: string }[] }>(
        await otherAdmin.agent
          .post(`/parties/${jdrId}/scenarios`)
          .send({ title: 'Scénario' })
          .expect(201),
      );
      const seanceId = scenario.seances[0].id;
      const res = await signUp(guest, seanceId);
      expect(res.status).toBe(403);
      expect(message(res)).toBe(NO_ACCESS);
      // Scénario encore en brouillon : le MJ lui-même reçoit son 400 historique, jamais une carte.
      const jdr = await signUp(otherAdmin, seanceId);
      expect(jdr.status).toBe(400);
      expect(await registered(seanceId)).toEqual([]);
    });
  });

  it('participants : la carte de la liste et la réponse portent les mêmes inscrits, par ordre d’inscription', async () => {
    const card = await propose(host, groupId, { title: 'Ordre' });
    await signUp(third, card.seance!.id).expect(201);
    await signUp(guest, card.seance!.id).expect(201);

    const list = body<CardLike[]>(
      await admin.agent.get(`/parties/${groupId}/events/list`).expect(200),
    );
    expect(ids(list.find((c) => c.id === card.id)!)).toEqual([host.id, third.id, guest.id]);
  });
});

describe('Ralliement — réserver une place à des membres (Story 40.4)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let fourth: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: {
      id: string;
      date: string | null;
      capacity: number | null;
      placesTaken: number;
    } | null;
    participants: { userId: string; isHost: boolean; status: string }[];
    myInscription: string | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };

  const FULL = 'Cette conjonction est complète : plus aucune place disponible';
  const PAST = 'Cette conjonction est passée : les inscriptions ne peuvent plus changer';
  const HOST_ONLY = "Action réservée à l'hôte de la conjonction";
  const RESERVATION_MAIL = 'conjonction-reservation';

  const propose = (who: TestUser, over: Record<string, unknown> = {}) =>
    who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title: 'Soirée plateaux', date: isoDay(6), slot: 'EVENING', capacity: 4, ...over });
  const create = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await propose(who, over);
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const reserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({ userId });
  const unreserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.delete(`/scenarios/seances/${seanceId}/reservations/${userId}`);
  const accept = (who: TestUser, seanceId: string) =>
    who.agent.patch(`/scenarios/seances/${seanceId}/inscription/accept`);
  const decline = (who: TestUser, seanceId: string) =>
    who.agent.delete(`/scenarios/seances/${seanceId}/inscription`);
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const rows = async (seanceId: string) =>
    (
      await h.prisma.inscription.findMany({ where: { seanceId }, orderBy: { createdAt: 'asc' } })
    ).map((i) => [i.userId, i.status]);
  const listFor = async (who: TestUser) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200));
  const cardFor = async (who: TestUser, eventId: string) =>
    (await listFor(who)).find((c) => c.id === eventId)!;
  const signalsOf = async (who: TestUser) =>
    body<Record<string, { signals: string[] }>>(
      await who.agent.get('/me/party-signals').expect(200),
    )[groupId]?.signals ?? [];
  const mailsTo = (who: TestUser) =>
    h.email.calls.filter((c) => c.to === who.email && c.template === RESERVATION_MAIL);
  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;
  /** Efface les places encore seulement réservées à `who` par les scénarios précédents : le signal
   *  d'accueil est par groupe, il faut partir d'une situation propre pour le lire. */
  const clearReservations = (who: TestUser) =>
    h.prisma.inscription.deleteMany({ where: { userId: who.id, status: 'RESERVED' } });
  const calendarOf = async (who: TestUser) =>
    body<{ 'mes-seances': { seanceId: string }[] }>(
      await who.agent
        .get('/me/calendar')
        .query({ from: isoDay(0), to: isoDay(30) })
        .expect(200),
    )['mes-seances'].map((s) => s.seanceId);

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, third, fourth, stranger, otherAdmin] = await Promise.all([
      h.createUser('resa-admin'),
      h.createUser('resa-hote'),
      h.createUser('resa-invite'),
      h.createUser('resa-tiers'),
      h.createUser('resa-quatrieme'),
      h.createUser('resa-etranger'),
      h.createUser('resa-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'resa', 'ralliement'));
    for (const who of [host, guest, third, fourth]) await h.addMember(groupId, who);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'resa-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('l’hôte réserve : ligne RESERVED comptée dans la capacité, e-mail n°3, signal et direct pour la cible, pastille en attente pour l’hôte seul', async () => {
    const card = await create(host, { title: 'Réservée' });
    const seanceId = card.seance!.id;

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let res: Response;
    try {
      res = await reserve(host, seanceId, guest.id).expect(201);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await rows(seanceId)).toEqual([[guest.id, 'RESERVED']]);
    // Réponse = carte de l'hôte : la place en attente y figure, avec son statut.
    const hostCard = body<CardLike>(res);
    expect(hostCard.participants.map((p) => [p.userId, p.status])).toEqual([
      [host.id, 'CONFIRMED'],
      [guest.id, 'RESERVED'],
    ]);
    expect(hostCard.seance?.placesTaken).toBe(2);

    // E-mail n°3 : un seul, vers la cible, au nom de l'hôte, lien vers la page du groupe.
    const mails = mailsTo(guest);
    expect(mails).toHaveLength(1);
    expect(mails[0].data).toMatchObject({
      hostName: host.displayName,
      eventTitle: 'Réservée',
      link: expect.stringContaining(`/parties/${groupId}`) as string,
    });

    // La cible : sa ligne et son signal d'accueil, que personne d'autre ne porte.
    expect((await cardFor(guest, card.id)).myInscription).toBe('RESERVED');
    expect(await signalsOf(guest)).toContain('RESERVATION_A_CONFIRMER');
    expect(await signalsOf(third)).not.toContain('RESERVATION_A_CONFIRMER');

    // Visibilité : un autre membre ne voit pas qui tient la place, mais « placesTaken » la compte.
    const thirdCard = await cardFor(third, card.id);
    expect(thirdCard.participants.map((p) => p.userId)).toEqual([host.id]);
    expect(thirdCard.seance?.placesTaken).toBe(2);
    expect(JSON.stringify(thirdCard)).not.toContain(guest.id);
    expect(JSON.stringify(thirdCard)).not.toContain(guest.displayName);
    // La personne réservée ne se voit pas non plus dans la liste (elle lit myInscription).
    expect((await cardFor(guest, card.id)).participants.map((p) => p.userId)).toEqual([host.id]);
    // L'hôte relit la même chose que dans la réponse.
    expect((await cardFor(host, card.id)).participants.map((p) => p.userId)).toEqual([
      host.id,
      guest.id,
    ]);
  });

  it('place tenue : une conjonction pleine de places réservées affiche « Complet » aux autres — 409, rien d’écrit', async () => {
    const card = await create(host, { title: 'Tenue', capacity: 3 });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);
    await signUp(third, seanceId).expect(201);

    const refused = await signUp(fourth, seanceId);
    expect(refused.status).toBe(409);
    expect(message(refused)).toBe(FULL);
    // Et l'hôte ne peut pas réserver au-delà de la capacité non plus.
    const over = await reserve(host, seanceId, fourth.id);
    expect(over.status).toBe(409);
    expect(message(over)).toBe(FULL);
    expect(await rows(seanceId)).toEqual([
      [guest.id, 'RESERVED'],
      [third.id, 'CONFIRMED'],
    ]);
    const full = await cardFor(fourth, card.id);
    expect(full.seance).toMatchObject({ capacity: 3, placesTaken: 3 });
  });

  it('accepter : la ligne devient CONFIRMED, tout le monde voit l’inscrit·e, le signal s’efface, la personne est notifiée', async () => {
    await clearReservations(guest);
    const card = await create(host, { title: 'Acceptée' });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);
    expect(await signalsOf(guest)).toContain('RESERVATION_A_CONFIRMER');

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let res: Response;
    try {
      res = await accept(guest, seanceId).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await rows(seanceId)).toEqual([[guest.id, 'CONFIRMED']]);
    const own = body<CardLike>(res);
    expect(own.myInscription).toBe('CONFIRMED');
    expect(own.participants.map((p) => [p.userId, p.status])).toEqual([
      [host.id, 'CONFIRMED'],
      [guest.id, 'CONFIRMED'],
    ]);
    expect(await signalsOf(guest)).not.toContain('RESERVATION_A_CONFIRMER');
    // Tous les membres le voient désormais inscrit·e.
    expect((await cardFor(third, card.id)).participants.map((p) => p.userId)).toEqual([
      host.id,
      guest.id,
    ]);
    // Idempotent : accepter de nouveau ne change rien.
    await accept(guest, seanceId).expect(200);
    expect(await rows(seanceId)).toEqual([[guest.id, 'CONFIRMED']]);
    // La séance devient la sienne dans son agenda (hôte + CONFIRMED seulement).
    expect(await calendarOf(guest)).toContain(seanceId);
  });

  it('s’inscrire en tenant une place réservée la confirme (comme accepter) : la ligne passe CONFIRMED, la personne apparaît inscrite pour tous, sans nouvelle place prise', async () => {
    const card = await create(host, { title: 'Inscrite d’office', capacity: 3 });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let res: Response;
    try {
      res = await signUp(guest, seanceId).expect(201);
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await rows(seanceId)).toEqual([[guest.id, 'CONFIRMED']]);
    const own = body<CardLike>(res);
    expect(own.myInscription).toBe('CONFIRMED');
    expect(own.seance?.placesTaken).toBe(2);
    expect((await cardFor(third, card.id)).participants.map((p) => p.userId)).toEqual([
      host.id,
      guest.id,
    ]);
  });

  it('calendrier : tant que la place est seulement réservée, la conjonction n’est ni dans l’agenda ni dans les indisponibilités de la cible', async () => {
    const day = isoDay(11);
    const card = await create(host, { title: 'Pas encore', date: day, slot: 'AFTERNOON' });
    await reserve(host, card.seance!.id, guest.id).expect(201);

    expect(await calendarOf(guest)).not.toContain(card.seance!.id);
    const spans = await h.app.get(EventsService).occupiedSpansOf([guest.id, host.id]);
    const wanted = [`${day}T00:00:00.000Z`, 'AFTERNOON'];
    expect(spans.get(guest.id)!.map((s) => [s.date.toISOString(), s.slot])).not.toContainEqual(
      wanted,
    );
    expect(spans.get(host.id)!.map((s) => [s.date.toISOString(), s.slot])).toContainEqual(wanted);
  });

  it('décliner : DELETE …/inscription supprime la ligne réservée, la place est de nouveau libre, la personne est notifiée', async () => {
    await clearReservations(guest);
    const card = await create(host, { title: 'Déclinée', capacity: 2 });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);
    expect((await signUp(third, seanceId)).status).toBe(409);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await decline(guest, seanceId).expect(200);
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await rows(seanceId)).toEqual([]);
    expect(await signalsOf(guest)).not.toContain('RESERVATION_A_CONFIRMER');
    // La place est rendue aux autres.
    await signUp(third, seanceId).expect(201);
    expect(await rows(seanceId)).toEqual([[third.id, 'CONFIRMED']]);
  });

  it('retirer la réservation : l’hôte supprime la ligne RESERVED, la cible est notifiée ; une inscription confirmée n’est jamais retirée par cette voie', async () => {
    await clearReservations(guest);
    const card = await create(host, { title: 'Retirée' });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);
    await signUp(third, seanceId).expect(201);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const res = await unreserve(host, seanceId, guest.id).expect(200);
      expect(body<CardLike>(res).participants.map((p) => p.userId)).toEqual([host.id, third.id]);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }
    expect(await rows(seanceId)).toEqual([[third.id, 'CONFIRMED']]);
    expect(await signalsOf(guest)).not.toContain('RESERVATION_A_CONFIRMER');

    // La personne confirmée reste inscrite ; retirer de nouveau est sans effet.
    await unreserve(host, seanceId, third.id).expect(200);
    await unreserve(host, seanceId, guest.id).expect(200);
    expect(await rows(seanceId)).toEqual([[third.id, 'CONFIRMED']]);
  });

  describe('à la création', () => {
    it('reservedUserIds : événement + séance + lignes RESERVED en une transaction, UN e-mail par membre, direct vers chacun', async () => {
      const before = h.email.calls.length;
      const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
      let card: CardLike;
      try {
        card = await create(host, {
          title: 'Dès le départ',
          capacity: 4,
          reservedUserIds: [guest.id, third.id],
        });
        expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
        expect(emit).toHaveBeenCalledWith(userTopic(third.id));
      } finally {
        emit.mockRestore();
      }

      expect(await rows(card.seance!.id)).toEqual([
        [guest.id, 'RESERVED'],
        [third.id, 'RESERVED'],
      ]);
      expect(card.seance?.placesTaken).toBe(3);
      expect(card.participants.map((p) => [p.userId, p.status])).toEqual([
        [host.id, 'CONFIRMED'],
        [guest.id, 'RESERVED'],
        [third.id, 'RESERVED'],
      ]);
      const sent = h.email.calls.slice(before).filter((c) => c.template === RESERVATION_MAIL);
      expect(sent.map((c) => c.to).sort()).toEqual([guest.email, third.email].sort());
      expect(await signalsOf(third)).toContain('RESERVATION_A_CONFIRMER');
    });

    it.each([
      ['places non limitées', () => ({ capacity: null, reservedUserIds: [guest.id] })],
      ['l’hôte lui-même', () => ({ capacity: 4, reservedUserIds: [host.id] })],
      ['une personne deux fois', () => ({ capacity: 4, reservedUserIds: [guest.id, guest.id] })],
      [
        'plus que capacité − 1',
        () => ({ capacity: 3, reservedUserIds: [guest.id, third.id, fourth.id] }),
      ],
      ['un étranger au groupe', () => ({ capacity: 4, reservedUserIds: [stranger.id] })],
      ['un membre d’un autre groupe', () => ({ capacity: 4, reservedUserIds: [otherAdmin.id] })],
      ['un identifiant invalide', () => ({ capacity: 4, reservedUserIds: ['pas-un-uuid'] })],
    ])('refus 400 (%s) : ni événement, ni ligne, ni e-mail', async (_label, extra) => {
      const eventsBefore = await h.prisma.event.count({ where: { partieId: groupId } });
      const mailsBefore = h.email.calls.length;

      const res = await propose(host, { title: 'Refusée', ...extra() });

      expect(res.status).toBe(400);
      expect(await h.prisma.event.count({ where: { partieId: groupId } })).toBe(eventsBefore);
      expect(h.email.calls).toHaveLength(mailsBefore);
    });

    it('capacité − 1 réservations exactement : acceptée, la conjonction est pleine', async () => {
      const card = await create(host, {
        title: 'Pleine d’emblée',
        capacity: 3,
        reservedUserIds: [guest.id, third.id],
      });
      const refused = await signUp(fourth, card.seance!.id);
      expect(refused.status).toBe(409);
      expect(message(refused)).toBe(FULL);
    });
  });

  describe('refus (rien n’est écrit)', () => {
    let seanceId: string;
    beforeAll(async () => {
      const card = await create(host, { title: 'Chasse gardée', capacity: 6 });
      seanceId = card.seance!.id;
      await reserve(host, seanceId, guest.id).expect(201);
    });
    const unchanged = async () => expect(await rows(seanceId)).toEqual([[guest.id, 'RESERVED']]);

    it('un membre qui n’est pas l’hôte : 403 « réservée à l’hôte » — l’administrateur du groupe compris', async () => {
      for (const who of [third, admin]) {
        const res = await reserve(who, seanceId, fourth.id);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(HOST_ONLY);
        const del = await unreserve(who, seanceId, guest.id);
        expect(del.status).toBe(403);
        expect(message(del)).toBe(HOST_ONLY);
      }
      await unchanged();
    });

    it('un étranger et l’administrateur d’un autre groupe : 403 « pas accès »', async () => {
      for (const who of [stranger, otherAdmin]) {
        const res = await reserve(who, seanceId, fourth.id);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(NO_ACCESS);
        expect((await unreserve(who, seanceId, guest.id)).status).toBe(403);
        expect((await accept(who, seanceId)).status).toBe(403);
      }
      await unchanged();
    });

    it('la séance d’un autre groupe : l’hôte de A reçoit 403 sur la séance de B (la partie est lue depuis la séance)', async () => {
      const foreign = body<CardLike>(
        await otherAdmin.agent
          .post(`/parties/${otherGroupId}/events`)
          .send({ title: 'Chez les autres', date: isoDay(8), slot: 'EVENING', capacity: 4 })
          .expect(201),
      );
      const res = await reserve(host, foreign.seance!.id, guest.id);
      expect(res.status).toBe(403);
      expect(message(res)).toBe(NO_ACCESS);
      expect(await rows(foreign.seance!.id)).toEqual([]);
    });

    it('la cible : pas membre → 400, l’hôte → 400, déjà réservée ou inscrite → 409', async () => {
      const notMember = await reserve(host, seanceId, stranger.id);
      expect(notMember.status).toBe(400);
      expect(message(notMember)).toBe("Cette personne n'est pas membre du groupe");
      const self = await reserve(host, seanceId, host.id);
      expect(self.status).toBe(400);
      const again = await reserve(host, seanceId, guest.id);
      expect(again.status).toBe(409);
      await signUp(third, seanceId).expect(201);
      const registered = await reserve(host, seanceId, third.id);
      expect(registered.status).toBe(409);
      expect(message(registered)).toBe('Cette personne a déjà une place dans cette conjonction');
      expect(await rows(seanceId)).toEqual([
        [guest.id, 'RESERVED'],
        [third.id, 'CONFIRMED'],
      ]);
    });

    it('« Tous les membres » (sans limite) : 400, aucune ligne', async () => {
      const open = await create(host, { title: 'Pour tous', capacity: null });
      const res = await reserve(host, open.seance!.id, guest.id);
      expect(res.status).toBe(400);
      expect(await rows(open.seance!.id)).toEqual([]);
    });

    it('corps invalide : 400 ; séance inconnue : 404', async () => {
      await host.agent
        .post(`/scenarios/seances/${seanceId}/reservations`)
        .send({ userId: 'pas-un-uuid' })
        .expect(400);
      await host.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({}).expect(400);
      await reserve(host, randomUUID(), guest.id).expect(404);
      await unreserve(host, randomUUID(), guest.id).expect(404);
      await accept(guest, randomUUID()).expect(404);
    });

    it('jour passé : réserver, retirer et accepter sont refusés (400 français), rien ne change', async () => {
      const old = await create(host, { title: 'Hier', capacity: 5 });
      await reserve(host, old.seance!.id, guest.id).expect(201);
      const yesterday = new Date(`${isoDay(-2)}T00:00:00.000Z`);
      await h.prisma.seance.update({
        where: { id: old.seance!.id },
        data: { startDate: yesterday, endDate: yesterday },
      });

      const late = await reserve(host, old.seance!.id, third.id);
      expect(late.status).toBe(400);
      expect(message(late)).toBe(PAST);
      expect((await unreserve(host, old.seance!.id, guest.id)).status).toBe(400);
      const lateAccept = await accept(guest, old.seance!.id);
      expect(lateAccept.status).toBe(400);
      expect(message(lateAccept)).toBe(PAST);
      expect(await rows(old.seance!.id)).toEqual([[guest.id, 'RESERVED']]);
    });

    it('accepter sans place réservée : sans effet (200), aucune ligne créée', async () => {
      const plain = await create(host, { title: 'Sans réservation' });
      await accept(fourth, plain.seance!.id).expect(200);
      expect(await rows(plain.seance!.id)).toEqual([]);
    });

    it('une rencontre isolée (ONE_SHOT) : 403 « indisponible », même à son administrateur', async () => {
      const { id: isoleeId } = await h.createPartie(admin, 'ONE_SHOT', 'resa-isolee', 'ralliement');
      const seance = await h.prisma.seance.findFirstOrThrow({
        where: { event: { partieId: isoleeId } },
      });
      for (const res of [
        await reserve(admin, seance.id, guest.id),
        await unreserve(admin, seance.id, guest.id),
        await accept(admin, seance.id),
      ]) {
        expect(res.status).toBe(403);
        expect(message(res)).toBe(UNAVAILABLE);
      }
      expect(await rows(seance.id)).toEqual([]);
    });
  });

  it('dernière place, réserver contre s’inscrire en même temps : exactement un gagne, l’autre reçoit « complet »', async () => {
    const card = await create(host, { title: 'Course', capacity: 2 });
    const seanceId = card.seance!.id;

    const [a, b] = await Promise.all([reserve(host, seanceId, guest.id), signUp(third, seanceId)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(message(loser)).toBe(FULL);
    expect(await rows(seanceId)).toHaveLength(1);
  });

  it('plusieurs réservations et inscriptions en même temps : jamais plus de places que la capacité', async () => {
    const card = await create(host, { title: 'Mêlée', capacity: 3 });
    const seanceId = card.seance!.id;

    const results = await Promise.all([
      reserve(host, seanceId, guest.id),
      reserve(host, seanceId, fourth.id),
      signUp(third, seanceId),
    ]);

    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    expect(await rows(seanceId)).toHaveLength(2);
  });

  it('accepter et décliner en même temps : un seul état final cohérent (jamais une ligne à moitié)', async () => {
    const card = await create(host, { title: 'Hésitation', capacity: 3 });
    const seanceId = card.seance!.id;
    await reserve(host, seanceId, guest.id).expect(201);

    await Promise.all([accept(guest, seanceId), decline(guest, seanceId)]);

    const final = await rows(seanceId);
    expect(final.length).toBeLessThanOrEqual(1);
    for (const [, status] of final) expect(['CONFIRMED', 'RESERVED']).toContain(status);
  });
});

// Story 40.5 — proposer une conjonction par sondage de dates : le membre place des créneaux et une
// échéance ; le serveur ouvre un sondage sur la séance (sans date), ne laisse voter que les votants
// éligibles, avant l'échéance, tant que la date n'est pas fixée. Le vote dans le calendrier du groupe
// est l'objet de la Story 40.5b : ici le vote passe par l'API.
describe('Ralliement — proposer une conjonction par sondage de dates (Story 40.5)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type PollLike = {
    id: string;
    expiresAt: string | null;
    status: string;
    eligibleVoterIds: string[];
    options: { id: string; date: string; slot: string; availableCount: number }[];
    votes: { optionId: string; userId: string; answer: string }[];
  };
  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: {
      id: string;
      date: string | null;
      slot: string | null;
      capacity: number | null;
    } | null;
    participants: { userId: string; status: string }[];
    poll: PollLike | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };
  type DatedPartieLike = PartieDtoLike & { nextSessionDate: string | null };

  const NOT_ELIGIBLE = 'Vous ne pouvez pas voter sur cette conjonction';
  const ENDED = 'Le vote est terminé : l’échéance est dépassée';
  const DATE_SET = 'La date de cette conjonction est déjà fixée : le vote est terminé';
  const MODE =
    'Une conjonction se propose à date fixée OU par sondage de dates, et son mode ne change pas';
  const PAST_DEADLINE = "L'échéance du vote ne peut pas être passée";
  const HOST_ONLY = "Action réservée à l'hôte de la conjonction";

  const slots = (...entries: [number, string][]) =>
    entries.map(([days, slot]) => ({ date: isoDay(days), slot }));
  const pollPayload = (over: Record<string, unknown> = {}) => ({
    title: 'Sondage plateaux',
    pollOptions: slots([8, 'EVENING'], [9, 'MORNING'], [12, 'EVENING']),
    pollDeadline: isoDay(5),
    ...over,
  });
  const propose = (who: TestUser, sent: Record<string, unknown>, partieId = groupId) =>
    who.agent.post(`/parties/${partieId}/events`).send(sent);
  const create = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await propose(who, pollPayload(over));
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const edit = (who: TestUser, eventId: string, sent: Record<string, unknown>) =>
    who.agent.patch(`/parties/${groupId}/events/${eventId}`).send(sent);
  const vote = (
    who: TestUser,
    pollId: string,
    optionId: string,
    answer = 'YES',
    partieId = groupId,
  ) => who.agent.post(`/parties/${partieId}/poll/${pollId}/vote`).send({ optionId, answer });
  const withdraw = (who: TestUser, pollId: string, optionId: string, partieId = groupId) =>
    who.agent.delete(`/parties/${partieId}/poll/${pollId}/vote/${optionId}`);
  const listFor = async (who: TestUser) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200));
  const cardFor = async (who: TestUser, eventId: string) =>
    (await listFor(who)).find((c) => c.id === eventId)!;
  const votesIn = (pollId: string) => h.prisma.pollVote.count({ where: { pollId } });
  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;
  const eventCount = (partieId: string) => h.prisma.event.count({ where: { partieId } });
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, third, stranger, otherAdmin] = await Promise.all([
      h.createUser('sond-admin'),
      h.createUser('sond-hote'),
      h.createUser('sond-invite'),
      h.createUser('sond-tiers'),
      h.createUser('sond-etranger'),
      h.createUser('sond-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'sond', 'ralliement'));
    for (const who of [host, guest, third]) await h.addMember(groupId, who);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'sond-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('un membre propose par sondage : 201, séance SANS date liée au sondage, échéance en fin de journée, carte vivante pour tous', async () => {
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    let card: CardLike;
    try {
      card = body<CardLike>(await propose(host, pollPayload({ lieu: 'Lyon 3e' })).expect(201));
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(admin.id));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(card.hostId).toBe(host.id);
    expect(card.seance).toMatchObject({ date: null, slot: null, capacity: null });
    expect(card.poll).toMatchObject({ status: 'OPEN', votes: [] });
    expect(card.poll?.expiresAt).toBe(`${isoDay(5)}T23:59:59.999Z`);
    // « Tous les membres » : tous les membres du groupe (hôte compris) peuvent voter.
    expect([...card.poll!.eligibleVoterIds].sort()).toEqual(
      [admin, host, guest, third].map((u) => u.id).sort(),
    );
    expect(card.poll?.options.map((o) => [o.date, o.slot])).toEqual([
      [isoDay(8), 'EVENING'],
      [isoDay(9), 'MORNING'],
      [isoDay(12), 'EVENING'],
    ]);

    // Écriture : événement + séance + sondage ensemble, séance sans date, sondage de l'hôte.
    const seance = await h.prisma.seance.findUniqueOrThrow({
      where: { id: card.seance!.id },
      include: { poll: { include: { options: true } } },
    });
    expect([seance.startDate, seance.startSlot, seance.endDate, seance.endSlot]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(seance.pollId).toBe(card.poll!.id);
    expect(seance.poll?.createdById).toBe(host.id);
    expect(seance.poll?.partieId).toBe(groupId);
    expect(seance.poll?.options).toHaveLength(3);
    expect(seance.lieu).toBe('Lyon 3e');

    // Sans date, la conjonction ne fait pas la prochaine date du groupe ; le groupe est EN_COURS.
    const partie = body<DatedPartieLike>(await guest.agent.get(`/parties/${groupId}`).expect(200));
    expect(partie.status).toBe('EN_COURS');
    expect(partie.nextSessionDate).toBeNull();

    // Les autres membres la lisent, aucun étranger.
    expect((await cardFor(guest, card.id)).poll?.id).toBe(card.poll!.id);
    await stranger.agent.get(`/parties/${groupId}/events/list`).expect(403);
  });

  describe('création refusée (400, rien n’est écrit)', () => {
    it.each([
      ['les deux modes à la fois', { date: isoDay(5), slot: 'EVENING' }, MODE],
      [
        'aucun mode',
        { pollOptions: undefined, pollDeadline: undefined },
        'La date doit être au format AAAA-MM-JJ',
      ],
      ['un seul créneau', { pollOptions: slots([8, 'EVENING']) }, 'au moins 2 créneaux'],
      [
        'des créneaux en double',
        { pollOptions: slots([8, 'EVENING'], [8, 'EVENING']) },
        'Options dupliquées',
      ],
      ['une échéance passée', { pollDeadline: isoDay(-1) }, PAST_DEADLINE],
      ['une échéance inexistante', { pollDeadline: '2031-02-31' }, "Cette date n'existe pas"],
      [
        'un créneau sur toute la journée',
        { pollOptions: slots([8, 'FULL_DAY'], [9, 'EVENING']) },
        'Le créneau doit être le matin, l’après-midi ou le soir',
      ],
      ['des créneaux sans échéance', { pollDeadline: undefined }, 'créneaux et une échéance'],
      ['une échéance sans créneaux', { pollOptions: undefined }, 'créneaux et une échéance'],
    ])('%s', async (_label, over, expected) => {
      const before = await eventCount(groupId);
      const pollsBefore = await h.prisma.sessionPoll.count({ where: { partieId: groupId } });

      const res = await propose(host, pollPayload(over));

      expect(res.status).toBe(400);
      expect([message(res)].flat().join(' | ')).toContain(expected);
      expect(await eventCount(groupId)).toBe(before);
      expect(await h.prisma.sessionPoll.count({ where: { partieId: groupId } })).toBe(pollsBefore);
    });

    it('aujourd’hui est accepté comme échéance ; beaucoup de créneaux sont acceptés (aucun plafond métier)', async () => {
      await create(host, { pollDeadline: isoDay(0) });
      const many = Array.from({ length: 45 }, (_, i) => ({
        date: isoDay(20 + i),
        slot: 'EVENING',
      }));
      const card = await create(host, { pollOptions: many });
      expect(card.poll?.options).toHaveLength(45);
    });
  });

  it('refus de droit : un étranger 403 « pas accès », une rencontre isolée 403 — rien n’est écrit', async () => {
    const before = await eventCount(groupId);
    const res = await propose(stranger, pollPayload());
    expect(res.status).toBe(403);
    expect(message(res)).toBe(NO_ACCESS);
    // Le groupe d'un autre n'est pas atteignable.
    expect((await propose(host, pollPayload(), otherGroupId)).status).toBe(403);
    expect(await eventCount(groupId)).toBe(before);

    const { id: oneShot } = await h.createPartie(admin, 'ONE_SHOT', 'sond-solo', 'ralliement');
    const solo = await propose(admin, pollPayload(), oneShot);
    expect(solo.status).toBe(403);
    expect(message(solo)).toBe(UNAVAILABLE);
    // La rencontre isolée garde l'unique événement créé avec elle : aucun de plus.
    expect(await eventCount(oneShot)).toBe(1);
  });

  it('vote d’un votant éligible (« Tous les membres ») : accepté, la carte de chacun le montre en direct, le retrait est idempotent', async () => {
    const card = await create(host);
    const [o1, o2] = card.poll!.options;

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await vote(guest, card.poll!.id, o1.id, 'YES').expect(201);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
    } finally {
      emit.mockRestore();
    }
    await vote(guest, card.poll!.id, o2.id, 'MAYBE').expect(201);
    await vote(guest, card.poll!.id, o1.id, 'NO').expect(201); // remplace sa réponse
    await vote(host, card.poll!.id, o1.id, 'YES').expect(201);

    for (const who of [admin, guest, third]) {
      const seen = (await cardFor(who, card.id)).poll!;
      expect(seen.votes.map((v) => [v.userId, v.optionId, v.answer]).sort()).toEqual(
        [
          [guest.id, o1.id, 'NO'],
          [guest.id, o2.id, 'MAYBE'],
          [host.id, o1.id, 'YES'],
        ].sort(),
      );
    }
    expect(await votesIn(card.poll!.id)).toBe(3);

    await withdraw(guest, card.poll!.id, o2.id).expect(200);
    await withdraw(guest, card.poll!.id, o2.id).expect(200);
    expect(await votesIn(card.poll!.id)).toBe(2);
  });

  describe('votant non éligible : 403, rien n’est écrit', () => {
    it('étranger au groupe et membre d’un autre groupe', async () => {
      const card = await create(host);
      const optionId = card.poll!.options[0].id;

      for (const who of [stranger, otherAdmin]) {
        const res = await vote(who, card.poll!.id, optionId);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(NO_ACCESS);
        expect((await withdraw(who, card.poll!.id, optionId)).status).toBe(403);
      }
      // Par la route de SON groupe, le sondage d'une autre partie est inconnu (400).
      const via = await vote(otherAdmin, card.poll!.id, optionId, 'YES', otherGroupId);
      expect(via.status).toBe(400);
      expect(await votesIn(card.poll!.id)).toBe(0);
    });

    it('places limitées : seul l’hôte et les inscrits confirmés votent ; l’inscription ouvre le droit, la désinscription le ferme', async () => {
      const card = await create(host, { capacity: 4 });
      const { id: pollId, options } = card.poll!;
      expect(card.poll?.eligibleVoterIds).toEqual([host.id]);

      // Un membre du groupe non inscrit est refusé.
      const refused = await vote(guest, pollId, options[0].id);
      expect(refused.status).toBe(403);
      expect(message(refused)).toBe(NOT_ELIGIBLE);
      expect((await withdraw(guest, pollId, options[0].id)).status).toBe(403);
      await vote(host, pollId, options[0].id).expect(201);

      // Coexistence : s'inscrire à la conjonction encore sans date est accepté, l'éligibilité suit.
      await signUp(guest, card.seance!.id).expect(201);
      await vote(guest, pollId, options[0].id, 'YES').expect(201);
      expect((await cardFor(third, card.id)).poll?.eligibleVoterIds).toEqual([host.id, guest.id]);

      // Une place seulement réservée n'est pas une participation.
      await host.agent
        .post(`/scenarios/seances/${card.seance!.id}/reservations`)
        .send({ userId: third.id })
        .expect(201);
      const reserved = await vote(third, pollId, options[0].id);
      expect(reserved.status).toBe(403);
      expect(message(reserved)).toBe(NOT_ELIGIBLE);

      // Désinscrit, la réponse de l'invité n'est plus servie (elle ne compte plus).
      await guest.agent.delete(`/scenarios/seances/${card.seance!.id}/inscription`).expect(200);
      expect((await vote(guest, pollId, options[0].id)).status).toBe(403);
      const seen = (await cardFor(host, card.id)).poll!;
      expect(seen.votes.map((v) => v.userId)).toEqual([host.id]);
      expect(await h.prisma.pollVote.count({ where: { pollId, userId: third.id } })).toBe(0);
    });
  });

  it('après l’échéance : vote et retrait refusés (400 français), rien n’est écrit ni retiré', async () => {
    const card = await create(host);
    const { id: pollId, options } = card.poll!;
    await vote(guest, pollId, options[0].id).expect(201);
    await h.prisma.sessionPoll.update({
      where: { id: pollId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const late = await vote(third, pollId, options[0].id);
    expect(late.status).toBe(400);
    expect(message(late)).toBe(ENDED);
    const lateWithdraw = await withdraw(guest, pollId, options[0].id);
    expect(lateWithdraw.status).toBe(400);
    expect(message(lateWithdraw)).toBe(ENDED);
    expect(await votesIn(pollId)).toBe(1);
  });

  it('date déjà fixée ou sondage fermé : vote refusé (400), rien n’est écrit', async () => {
    const dated = await create(host);
    await h.prisma.seance.update({
      where: { id: dated.seance!.id },
      data: { startDate: new Date(`${isoDay(9)}T00:00:00.000Z`), startSlot: 'EVENING' },
    });
    const res = await vote(guest, dated.poll!.id, dated.poll!.options[0].id);
    expect(res.status).toBe(400);
    expect(message(res)).toBe(DATE_SET);
    expect(await votesIn(dated.poll!.id)).toBe(0);

    const closed = await create(host);
    await h.prisma.sessionPoll.update({
      where: { id: closed.poll!.id },
      data: { status: 'CLOSED' },
    });
    const shut = await vote(guest, closed.poll!.id, closed.poll!.options[0].id);
    expect(shut.status).toBe(400);
    expect(message(shut)).toBe('Poll introuvable ou fermé');
    expect(await votesIn(closed.poll!.id)).toBe(0);
  });

  it('un vote sur une option d’un AUTRE sondage ou inconnue est refusé (400)', async () => {
    const a = await create(host);
    const b = await create(host);
    const res = await vote(guest, a.poll!.id, b.poll!.options[0].id);
    expect(res.status).toBe(400);
    expect(await votesIn(a.poll!.id)).toBe(0);
    expect((await vote(guest, a.poll!.id, randomUUID())).status).toBe(400);
  });

  describe('modification par l’hôte', () => {
    it('réconcilie les créneaux : le conservé garde son identifiant et ses réponses, le retiré perd les siennes, l’échéance est mise à jour', async () => {
      const card = await create(host);
      const [keep, drop] = card.poll!.options;
      await vote(guest, card.poll!.id, keep.id, 'YES').expect(201);
      await vote(guest, card.poll!.id, drop.id, 'NO').expect(201);
      await vote(host, card.poll!.id, drop.id, 'YES').expect(201);

      const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
      let res: Response;
      try {
        res = await edit(host, card.id, {
          title: 'Sondage renommé',
          pollOptions: [
            { date: keep.date, slot: keep.slot },
            ...slots([14, 'AFTERNOON'], [15, 'EVENING']),
          ],
          pollDeadline: isoDay(6),
          lieu: 'Paris',
        }).expect(200);
        expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      } finally {
        emit.mockRestore();
      }

      const updated = body<CardLike>(res);
      expect(updated.title).toBe('Sondage renommé');
      expect(updated.poll?.id).toBe(card.poll!.id);
      expect(updated.poll?.expiresAt).toBe(`${isoDay(6)}T23:59:59.999Z`);
      expect(updated.poll?.options.map((o) => o.id)).toContain(keep.id);
      expect(updated.poll?.options.map((o) => o.id)).not.toContain(drop.id);
      expect(updated.poll?.options).toHaveLength(3);
      expect(updated.poll?.votes).toEqual([{ optionId: keep.id, userId: guest.id, answer: 'YES' }]);
      expect(await votesIn(card.poll!.id)).toBe(1);

      // La séance n'a toujours pas de date, le lieu est remplacé.
      const seance = await h.prisma.seance.findUniqueOrThrow({ where: { id: card.seance!.id } });
      expect([seance.startDate, seance.startSlot]).toEqual([null, null]);
      expect(seance.lieu).toBe('Paris');
      expect(seance.pollId).toBe(card.poll!.id);
    });

    it('refus (rien n’est modifié) : non-hôte 403, échéance passée 400, mode changé 400, créneaux insuffisants ou en double 400', async () => {
      const card = await create(host);
      const sent = pollPayload({ title: 'Détourné' });

      const asGuest = await edit(guest, card.id, sent);
      expect(asGuest.status).toBe(403);
      expect(message(asGuest)).toBe(HOST_ONLY);
      expect((await edit(admin, card.id, sent)).status).toBe(403);
      expect((await edit(stranger, card.id, sent)).status).toBe(403);

      const past = await edit(host, card.id, { ...sent, pollDeadline: isoDay(-1) });
      expect(past.status).toBe(400);
      expect(message(past)).toBe(PAST_DEADLINE);

      const toDated = await edit(host, card.id, {
        title: 'X',
        date: isoDay(7),
        slot: 'EVENING',
      });
      expect(toDated.status).toBe(400);
      expect(message(toDated)).toBe(MODE);

      const one = await edit(host, card.id, { ...sent, pollOptions: slots([8, 'EVENING']) });
      expect(one.status).toBe(400);
      const dup = await edit(host, card.id, {
        ...sent,
        pollOptions: slots([8, 'EVENING'], [8, 'EVENING']),
      });
      expect(dup.status).toBe(400);

      const unchanged = await cardFor(host, card.id);
      expect(unchanged.title).toBe('Sondage plateaux');
      expect(unchanged.poll?.options.map((o) => o.id)).toEqual(card.poll!.options.map((o) => o.id));
      expect(unchanged.poll?.expiresAt).toBe(card.poll!.expiresAt);
    });

    it('une conjonction à date fixée ne devient pas un sondage (400, la date reste)', async () => {
      const dated = body<CardLike>(
        await propose(host, { title: 'Datée', date: isoDay(7), slot: 'EVENING' }).expect(201),
      );
      expect(dated.poll).toBeNull();
      const res = await edit(host, dated.id, pollPayload());
      expect(res.status).toBe(400);
      expect(message(res)).toBe(MODE);
      expect((await cardFor(host, dated.id)).seance?.date).toBe(isoDay(7));
    });

    it('échéance passée INCHANGÉE : le lieu se corrige encore après la fin du vote', async () => {
      const card = await create(host);
      // Le vote s'est terminé hier soir : l'échéance stockée est la fin de journée d'hier.
      const endOfYesterday = `${isoDay(-1)}T23:59:59.999Z`;
      await h.prisma.sessionPoll.update({
        where: { id: card.poll!.id },
        data: { expiresAt: new Date(endOfYesterday) },
      });

      const res = await edit(host, card.id, {
        title: 'Sondage plateaux',
        pollOptions: card.poll!.options.map((o) => ({ date: o.date, slot: o.slot })),
        pollDeadline: isoDay(-1),
        lieu: 'Corrigé',
      }).expect(200);

      expect(body<CardLike>(res).poll?.expiresAt).toBe(endOfYesterday);
      const seance = await h.prisma.seance.findUniqueOrThrow({ where: { id: card.seance!.id } });
      expect(seance.lieu).toBe('Corrigé');
    });
  });

  it('disponibilités : availableCount compte les INSCRITS libres sur le créneau (hôte + confirmés), en un nombre, sans noms', async () => {
    const card = await create(host, { capacity: 4 });
    await signUp(guest, card.seance!.id).expect(201);
    const [o1, o2] = card.poll!.options;
    const declare = (
      user: TestUser,
      slot: 'EVENING' | 'MORNING' | 'FULL_DAY',
      from: string,
      to: string,
    ) =>
      h.prisma.availabilityDeclaration.create({
        data: {
          userId: user.id,
          kind: 'AVAILABLE',
          recurKind: 'PUNCTUAL',
          slot,
          startDate: new Date(`${from}T00:00:00.000Z`),
          endDate: new Date(`${to}T00:00:00.000Z`),
          expiresAt: new Date(`${isoDay(60)}T00:00:00.000Z`),
        },
      });
    await declare(host, 'EVENING', o1.date, o1.date);
    await declare(guest, 'FULL_DAY', o1.date, o2.date);
    // Un membre non inscrit qui se déclare libre ne compte pas.
    await declare(third, 'FULL_DAY', o1.date, o2.date);

    const seen = (await cardFor(third, card.id)).poll!;
    expect(seen.options.find((o) => o.id === o1.id)?.availableCount).toBe(2);
    expect(seen.options.find((o) => o.id === o2.id)?.availableCount).toBe(1);
    expect(seen.options.find((o) => o.id === card.poll!.options[2].id)?.availableCount).toBe(0);
    expect(JSON.stringify(seen)).not.toContain(guest.displayName);
  });

  it('calendrier : une conjonction sans date n’entre ni dans l’agenda, ni dans les indisponibilités, ni dans les inscriptions ouvertes', async () => {
    const card = await create(host, { capacity: 4 });
    await signUp(guest, card.seance!.id).expect(201);

    for (const who of [host, guest, third]) {
      const cal = body<{
        'mes-seances': { seanceId: string }[];
        'inscriptions-ouvertes': { seanceId: string }[];
      }>(
        await who.agent
          .get('/me/calendar')
          .query({ from: isoDay(0), to: isoDay(40) })
          .expect(200),
      );
      expect(cal['mes-seances'].map((s) => s.seanceId)).not.toContain(card.seance!.id);
      expect(cal['inscriptions-ouvertes'].map((s) => s.seanceId)).not.toContain(card.seance!.id);
      // Story 44.2 : `GET /me/calendar` ne sert plus aucun vote.
      expect(cal).not.toHaveProperty('votes-en-cours');
    }

    // Les votes de groupe sont servis par `GET /me/open-polls` : l'hôte et l'inscrit y votent, le tiers non
    // inscrit (places limitées) le voit sans pouvoir y répondre.
    const polls = async (who: TestUser) =>
      body<{ pollId: string; me: { eligible: boolean } }[]>(
        await who.agent.get('/me/open-polls').expect(200),
      ).find((p) => p.pollId === card.poll!.id);
    expect((await polls(host))?.me.eligible).toBe(true);
    expect((await polls(guest))?.me.eligible).toBe(true);
    expect((await polls(third))?.me.eligible).toBe(false);
  });
});

// Story 40.6 — fixer la date d'une conjonction : l'hôte choisit un créneau du sondage ; sous le verrou de
// l'événement, la séance est datée, le sondage clos et la prochaine date de la partie recalculée, puis
// les inscrits confirmés sont prévenus par e-mail. La date ne se rouvre jamais.
describe("Ralliement — fixer la date d'une conjonction (Story 40.6)", () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let invited: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;

  type PollLike = {
    id: string;
    status: string;
    options: { id: string; date: string; slot: string }[];
    votes: { optionId: string; userId: string; answer: string }[];
  };
  type CardLike = {
    id: string;
    title: string;
    seance: { id: string; date: string | null; slot: string | null; lieu: string | null } | null;
    myInscription: string | null;
    poll: PollLike | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };
  type DatedPartieLike = PartieDtoLike & { nextSessionDate: string | null };

  const DATE_MAIL = 'conjonction-date-fixee';
  const HOST_ONLY = "Action réservée à l'hôte de la conjonction";
  const ALREADY_FIXED = 'La date de cette conjonction est déjà fixée';
  const POLL_CLOSED = 'Poll introuvable ou fermé';
  const DATE_FIXED =
    'La date de cette conjonction est fixée : le jour et le créneau ne peuvent plus changer';
  const MODE =
    'Une conjonction se propose à date fixée OU par sondage de dates, et son mode ne change pas';

  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;
  const create = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await who.agent.post(`/parties/${groupId}/events`).send({
      title: 'Sondage à trancher',
      pollOptions: [
        { date: isoDay(8), slot: 'EVENING' },
        { date: isoDay(9), slot: 'MORNING' },
        { date: isoDay(12), slot: 'EVENING' },
      ],
      pollDeadline: isoDay(5),
      ...over,
    });
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const choose = (who: TestUser, pollId: string, optionId: string, partieId = groupId) =>
    who.agent.patch(`/parties/${partieId}/poll/${pollId}/choose`).send({ optionId });
  const vote = (who: TestUser, pollId: string, optionId: string, answer = 'YES') =>
    who.agent.post(`/parties/${groupId}/poll/${pollId}/vote`).send({ optionId, answer });
  const withdraw = (who: TestUser, pollId: string, optionId: string) =>
    who.agent.delete(`/parties/${groupId}/poll/${pollId}/vote/${optionId}`);
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const reserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({ userId });
  const edit = (who: TestUser, eventId: string, sent: Record<string, unknown>) =>
    who.agent.patch(`/parties/${groupId}/events/${eventId}`).send(sent);
  const cardFor = async (who: TestUser, eventId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
      (c) => c.id === eventId,
    )!;
  const seanceRow = (seanceId: string) =>
    h.prisma.seance.findUniqueOrThrow({ where: { id: seanceId } });
  const pollRow = (pollId: string) =>
    h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: pollId } });
  const dateMails = (since: number) =>
    h.email.calls.slice(since).filter((c) => c.template === DATE_MAIL);
  const nextDate = async (who: TestUser) =>
    body<DatedPartieLike>(await who.agent.get(`/parties/${groupId}`).expect(200)).nextSessionDate;

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, third, invited, stranger, otherAdmin] = await Promise.all([
      h.createUser('fixe-admin'),
      h.createUser('fixe-hote'),
      h.createUser('fixe-invite'),
      h.createUser('fixe-tiers'),
      h.createUser('fixe-reserve'),
      h.createUser('fixe-etranger'),
      h.createUser('fixe-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'fixe', 'ralliement'));
    for (const who of [host, guest, third, invited]) await h.addMember(groupId, who);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'fixe-autre',
      'ralliement',
    ));
  });

  afterAll(async () => {
    await h?.close();
  });

  it("l'hôte fixe la date : séance datée, sondage clos, prochaine date recalculée, rappel ré-armé, carte vivante, e-mail aux seuls inscrits confirmés", async () => {
    const card = await create(host, { capacity: 5 });
    const [, o2] = card.poll!.options;
    const seanceId = card.seance!.id;
    await signUp(guest, seanceId).expect(201);
    await signUp(third, seanceId).expect(201);
    // Une place seulement réservée n'est pas une participation : aucun e-mail.
    await reserve(host, seanceId, invited.id).expect(201);
    await vote(guest, card.poll!.id, o2.id, 'YES').expect(201);
    // Le rappel de la veille (d'une date précédente) est ré-armé par la nouvelle date.
    await h.prisma.seance.update({
      where: { id: seanceId },
      data: { reminderSentAt: new Date() },
    });
    expect(await nextDate(guest)).toBeNull();

    const mailsBefore = h.email.calls.length;
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    try {
      await choose(host, card.poll!.id, o2.id).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(notify).toHaveBeenCalledWith(groupId, expect.anything());
    } finally {
      emit.mockRestore();
      notify.mockRestore();
    }

    // Séance : plage d'un seul créneau (start = end), jamais FULL_DAY, rappel ré-armé.
    const seance = await seanceRow(seanceId);
    expect(seance.startDate?.toISOString().substring(0, 10)).toBe(o2.date);
    expect(seance.endDate?.toISOString().substring(0, 10)).toBe(o2.date);
    expect([seance.startSlot, seance.endSlot]).toEqual([o2.slot, o2.slot]);
    expect(seance.reminderSentAt).toBeNull();
    // Sondage : clos, date et créneau choisis.
    const poll = await pollRow(card.poll!.id);
    expect(poll.status).toBe('CLOSED');
    expect(poll.chosenDate?.toISOString().substring(0, 10)).toBe(o2.date);
    expect(poll.chosenSlot).toBe(o2.slot);
    // Prochaine date de la partie recalculée, visible de tous.
    expect((await nextDate(third))?.substring(0, 10)).toBe(o2.date);

    // Carte : date normale, plus de bloc de sondage — pour chaque membre.
    for (const who of [admin, host, guest, third, invited]) {
      const seen = await cardFor(who, card.id);
      expect(seen.poll).toBeNull();
      expect(seen.seance).toMatchObject({ date: o2.date, slot: o2.slot });
    }
    // Calendrier personnel : l'hôte et l'inscrit la voient, la place seulement réservée non.
    const inWindow = async (who: TestUser) =>
      body<{ 'mes-seances': { seanceId: string }[] }>(
        await who.agent
          .get('/me/calendar')
          .query({ from: isoDay(0), to: isoDay(30) })
          .expect(200),
      )['mes-seances'].map((s) => s.seanceId);
    expect(await inWindow(host)).toContain(seanceId);
    expect(await inWindow(guest)).toContain(seanceId);
    expect(await inWindow(invited)).not.toContain(seanceId);

    // E-mail n°4 : une fois chacun, inscrits confirmés seulement, hôte et place réservée exclus.
    const sent = dateMails(mailsBefore);
    expect(sent.map((c) => c.to).sort()).toEqual([guest.email, third.email].sort());
    expect(sent[0].data).toMatchObject({ eventTitle: 'Sondage à trancher' });
    expect(String(sent[0].data.sessionDate)).toContain(o2.slot === 'MORNING' ? 'matin' : 'soir');
    expect(String(sent[0].data.link)).toContain(`/parties/${groupId}`);
  });

  it("aucun inscrit : la date est fixée, aucun e-mail n'est envoyé", async () => {
    const card = await create(host);
    const before = h.email.calls.length;

    await choose(host, card.poll!.id, card.poll!.options[0].id).expect(200);

    expect((await seanceRow(card.seance!.id)).startDate).not.toBeNull();
    expect(dateMails(before)).toEqual([]);
  });

  it("l'échéance dépassée ne bloque pas l'hôte", async () => {
    const card = await create(host);
    await h.prisma.sessionPoll.update({
      where: { id: card.poll!.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await choose(host, card.poll!.id, card.poll!.options[1].id).expect(200);

    expect((await pollRow(card.poll!.id)).status).toBe('CLOSED');
  });

  it("l'échec de l'envoi est journalisé, jamais remonté : la date reste fixée", async () => {
    const card = await create(host);
    await signUp(guest, card.seance!.id).expect(201);
    const send = jest.spyOn(h.email, 'sendMail').mockRejectedValue(new Error('SMTP indisponible'));
    try {
      await choose(host, card.poll!.id, card.poll!.options[0].id).expect(200);
      expect(send).toHaveBeenCalled();
    } finally {
      send.mockRestore();
    }
    expect((await seanceRow(card.seance!.id)).startDate).not.toBeNull();
  });

  describe('refus de droit (rien n’est écrit, aucun e-mail)', () => {
    it("tout autre membre, administrateur compris, est refusé (403 « réservée à l'hôte »), comme un étranger ou un membre d'un autre groupe", async () => {
      const card = await create(host);
      await signUp(guest, card.seance!.id).expect(201);
      const optionId = card.poll!.options[0].id;
      const mailsBefore = h.email.calls.length;

      for (const who of [admin, guest, third]) {
        const res = await choose(who, card.poll!.id, optionId);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(HOST_ONLY);
      }
      for (const who of [stranger, otherAdmin]) {
        const res = await choose(who, card.poll!.id, optionId);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(NO_ACCESS);
      }
      // Par la route de SON groupe, le sondage d'un autre groupe est inconnu (404).
      expect((await choose(otherAdmin, card.poll!.id, optionId, otherGroupId)).status).toBe(404);

      expect((await seanceRow(card.seance!.id)).startDate).toBeNull();
      expect((await pollRow(card.poll!.id)).status).toBe('OPEN');
      expect(dateMails(mailsBefore)).toEqual([]);
    });

    it('la rencontre isolée (ONE_SHOT, Story 41.2) suit les mêmes règles : un sondage inconnu y est introuvable (404)', async () => {
      const { id: oneShot } = await h.createPartie(admin, 'ONE_SHOT', 'fixe-solo', 'ralliement');
      const res = await choose(admin, randomUUID(), randomUUID(), oneShot);
      expect(res.status).toBe(404);
    });
  });

  describe('cible invalide (400/404, rien n’est écrit)', () => {
    it("option d'un autre sondage, option inconnue, sondage inconnu", async () => {
      const a = await create(host);
      const b = await create(host);
      const mailsBefore = h.email.calls.length;

      expect((await choose(host, a.poll!.id, b.poll!.options[0].id)).status).toBe(404);
      expect((await choose(host, a.poll!.id, randomUUID())).status).toBe(404);
      expect((await choose(host, randomUUID(), a.poll!.options[0].id)).status).toBe(404);
      await host.agent
        .patch(`/parties/${groupId}/poll/${a.poll!.id}/choose`)
        .send({ optionId: 'pas-un-uuid' })
        .expect(400);

      for (const c of [a, b]) {
        expect((await seanceRow(c.seance!.id)).startDate).toBeNull();
        expect((await pollRow(c.poll!.id)).status).toBe('OPEN');
      }
      expect(dateMails(mailsBefore)).toEqual([]);
    });

    it('date déjà fixée ou sondage déjà fermé : 400 français, la date ne change pas, un seul e-mail', async () => {
      const card = await create(host);
      await signUp(guest, card.seance!.id).expect(201);
      const [o1, o2] = card.poll!.options;
      const mailsBefore = h.email.calls.length;
      await choose(host, card.poll!.id, o1.id).expect(200);

      const again = await choose(host, card.poll!.id, o2.id);
      expect(again.status).toBe(400);
      expect(message(again)).toBe(ALREADY_FIXED);
      expect((await seanceRow(card.seance!.id)).startDate?.toISOString().substring(0, 10)).toBe(
        o1.date,
      );
      expect(dateMails(mailsBefore)).toHaveLength(1);

      // Sondage fermé par ailleurs, séance encore sans date : refusé aussi.
      const other = await create(host);
      await h.prisma.sessionPoll.update({
        where: { id: other.poll!.id },
        data: { status: 'CLOSED' },
      });
      expect((await choose(host, other.poll!.id, other.poll!.options[0].id)).status).toBe(400);
      expect((await seanceRow(other.seance!.id)).startDate).toBeNull();
    });
  });

  it('deux fixations simultanées : une seule gagne sous le verrou, l’autre est refusée (400), un seul e-mail par inscrit', async () => {
    const card = await create(host);
    await signUp(guest, card.seance!.id).expect(201);
    const [o1, o2] = card.poll!.options;
    const mailsBefore = h.email.calls.length;

    const results = await Promise.all([
      choose(host, card.poll!.id, o1.id),
      choose(host, card.poll!.id, o2.id),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const winner = results[0].status === 200 ? o1 : o2;
    const seance = await seanceRow(card.seance!.id);
    expect(seance.startDate?.toISOString().substring(0, 10)).toBe(winner.date);
    expect(seance.startSlot).toBe(winner.slot);
    expect(dateMails(mailsBefore)).toHaveLength(1);
  });

  it('une fois la date fixée : vote et retrait refusés (400), inscription tardive et réservation acceptées, la date ne bouge pas', async () => {
    const card = await create(host, { capacity: 5 });
    const [o1, o2] = card.poll!.options;
    await signUp(guest, card.seance!.id).expect(201);
    await vote(guest, card.poll!.id, o1.id, 'YES').expect(201);
    await choose(host, card.poll!.id, o2.id).expect(200);

    const lateVote = await vote(guest, card.poll!.id, o2.id);
    expect(lateVote.status).toBe(400);
    expect(message(lateVote)).toBe(POLL_CLOSED);
    const lateWithdraw = await withdraw(guest, card.poll!.id, o1.id);
    expect(lateWithdraw.status).toBe(400);
    expect(await h.prisma.pollVote.count({ where: { pollId: card.poll!.id } })).toBe(1);

    // Inscription tardive et réservation par l'hôte : la conjonction est datée, rien de plus.
    await signUp(third, card.seance!.id).expect(201);
    await reserve(host, card.seance!.id, invited.id).expect(201);
    const rows = await h.prisma.inscription.findMany({ where: { seanceId: card.seance!.id } });
    expect(rows.map((r) => [r.userId, r.status]).sort()).toEqual(
      [
        [guest.id, 'CONFIRMED'],
        [third.id, 'CONFIRMED'],
        [invited.id, 'RESERVED'],
      ].sort(),
    );
    expect((await seanceRow(card.seance!.id)).startDate?.toISOString().substring(0, 10)).toBe(
      o2.date,
    );
    expect((await cardFor(third, card.id)).myInscription).toBe('CONFIRMED');
  });

  it("modification d'une conjonction dont la date est fixée : lieu, heure et infos passent, le jour et le créneau sont refusés (400)", async () => {
    const card = await create(host);
    const [o1] = card.poll!.options;
    await choose(host, card.poll!.id, o1.id).expect(200);
    const same = { title: 'Renommée', date: o1.date, slot: o1.slot };

    const ok = await edit(host, card.id, {
      ...same,
      lieu: 'Chez Léa',
      heureRdv: '20:30',
      notePratique: 'Apportez des jeux',
    }).expect(200);
    expect(body<CardLike>(ok).seance).toMatchObject({ lieu: 'Chez Léa', date: o1.date });
    expect(body<CardLike>(ok).poll).toBeNull();

    const otherDay = await edit(host, card.id, { ...same, date: isoDay(15) });
    expect(otherDay.status).toBe(400);
    expect(message(otherDay)).toBe(DATE_FIXED);
    const otherSlot = await edit(host, card.id, {
      ...same,
      slot: o1.slot === 'MORNING' ? 'EVENING' : 'MORNING',
    });
    expect(otherSlot.status).toBe(400);
    expect(message(otherSlot)).toBe(DATE_FIXED);
    // Les champs de sondage ne rouvrent rien.
    const asPoll = await edit(host, card.id, {
      title: 'X',
      pollOptions: [
        { date: isoDay(20), slot: 'EVENING' },
        { date: isoDay(21), slot: 'EVENING' },
      ],
      pollDeadline: isoDay(10),
    });
    expect(asPoll.status).toBe(400);
    expect(message(asPoll)).toBe(MODE);

    const seance = await seanceRow(card.seance!.id);
    expect(seance.startDate?.toISOString().substring(0, 10)).toBe(o1.date);
    expect(seance.lieu).toBe('Chez Léa');
    expect((await pollRow(card.poll!.id)).status).toBe('CLOSED');
  });

  it('un créneau dont le jour est déjà passé est refusé (400 français) : la conjonction n’est pas scellée, aucun e-mail', async () => {
    const card = await create(host);
    await signUp(guest, card.seance!.id).expect(201);
    const [o1, o2] = card.poll!.options;
    // Le jour du créneau passe avant que l'hôte tranche.
    await h.prisma.pollOption.update({
      where: { id: o1.id },
      data: { date: new Date(`${isoDay(-1)}T00:00:00.000Z`) },
    });
    const mailsBefore = h.email.calls.length;

    const res = await choose(host, card.poll!.id, o1.id);

    expect(res.status).toBe(400);
    expect(message(res)).toBe('Ce créneau est déjà passé : choisissez un jour à venir');
    expect((await seanceRow(card.seance!.id)).startDate).toBeNull();
    expect((await pollRow(card.poll!.id)).status).toBe('OPEN');
    expect(dateMails(mailsBefore)).toEqual([]);
    // Un créneau à venir reste fixable ; aujourd'hui est accepté.
    await h.prisma.pollOption.update({
      where: { id: o2.id },
      data: { date: new Date(`${isoDay(0)}T00:00:00.000Z`) },
    });
    await choose(host, card.poll!.id, o2.id).expect(200);
  });

  it('vote et retrait qui attendent le verrou de l’événement sont refusés (400) quand la date est fixée entre-temps, sans rien écrire', async () => {
    const card = await create(host);
    const [o1, o2] = card.poll!.options;
    await vote(guest, card.poll!.id, o1.id, 'YES').expect(201);
    const eventId = card.id;

    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    // Autre connexion : elle tient le verrou de la ligne Event, puis écrit ce que la fixation de la date
    // validerait (séance datée, sondage clos) avant de le relâcher.
    const holder = h.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
        locked();
        await released;
        await tx.seance.update({
          where: { id: card.seance!.id },
          data: {
            startDate: new Date(`${o2.date}T00:00:00.000Z`),
            startSlot: o2.slot as 'MORNING' | 'AFTERNOON' | 'EVENING',
            endDate: new Date(`${o2.date}T00:00:00.000Z`),
            endSlot: o2.slot as 'MORNING' | 'AFTERNOON' | 'EVENING',
          },
        });
        await tx.sessionPoll.update({
          where: { id: card.poll!.id },
          data: { status: 'CLOSED', chosenDate: new Date(`${o2.date}T00:00:00.000Z`) },
        });
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    const done = { vote: false, withdraw: false };
    let voteRes: Response | undefined;
    let withdrawRes: Response | undefined;
    try {
      await lockTaken;
      const voting = vote(third, card.poll!.id, o2.id, 'YES').then((r) => {
        done.vote = true;
        voteRes = r;
      });
      const withdrawing = withdraw(guest, card.poll!.id, o1.id).then((r) => {
        done.withdraw = true;
        withdrawRes = r;
      });
      // Tant que le verrou est tenu, ni le vote ni le retrait n'aboutissent.
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(done).toEqual({ vote: false, withdraw: false });
      expect(await h.prisma.pollVote.count({ where: { pollId: card.poll!.id } })).toBe(1);

      release();
      await holder;
      await Promise.all([voting, withdrawing]);
    } finally {
      release();
      await holder.catch(() => undefined);
    }

    expect(voteRes?.status).toBe(400);
    expect(withdrawRes?.status).toBe(400);
    // Rien n'a été écrit ni retiré : seule la réponse d'avant la fixation subsiste.
    const rows = await h.prisma.pollVote.findMany({ where: { pollId: card.poll!.id } });
    expect(rows.map((r) => [r.userId, r.optionId, r.answer])).toEqual([[guest.id, o1.id, 'YES']]);
  });
});

describe('Ralliement — prolonger le vote et relancer la veille (Story 40.7)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let third: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;
  let oneShotId: string;
  let jdrId: string;

  type PollLike = {
    id: string;
    status: string;
    expiresAt: string | null;
    options: { id: string; date: string; slot: string }[];
  };
  type CardLike = {
    id: string;
    seance: { id: string } | null;
    poll: PollLike | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };

  const RELANCE_MAIL = 'conjonction-relance';
  const HOST_ONLY = "Action réservée à l'hôte de la conjonction";
  const NOT_LATER = "La nouvelle échéance doit être postérieure à l'échéance actuelle";
  const PAST_DEADLINE = "L'échéance du vote ne peut pas être passée";
  const INVALID_DAY = "La nouvelle échéance n'est pas un jour valide";
  const ALREADY_FIXED = 'La date de cette conjonction est déjà fixée';
  const VOTE_ENDED = 'Le vote est terminé : l’échéance est dépassée';

  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;
  const endOfDay = (day: string) => `${day}T23:59:59.999Z`;
  const create = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await who.agent.post(`/parties/${groupId}/events`).send({
      title: 'Sondage à prolonger',
      pollOptions: [
        { date: isoDay(8), slot: 'EVENING' },
        { date: isoDay(9), slot: 'MORNING' },
      ],
      pollDeadline: isoDay(5),
      ...over,
    });
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const extend = (who: TestUser, pollId: string, expiresAt: unknown, partieId = groupId) =>
    who.agent.patch(`/parties/${partieId}/poll/${pollId}/extend`).send({ expiresAt });
  const vote = (who: TestUser, pollId: string, optionId: string) =>
    who.agent.post(`/parties/${groupId}/poll/${pollId}/vote`).send({ optionId, answer: 'YES' });
  const pollRow = (pollId: string) =>
    h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: pollId } });
  const cardFor = async (who: TestUser, eventId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
      (c) => c.id === eventId,
    )!;
  const relanceMails = (since: number, title: string) =>
    h.email.calls
      .slice(since)
      .filter((c) => c.template === RELANCE_MAIL && c.data.eventTitle === title);
  const unchanged = async (pollId: string, expiresAt: Date) => {
    const row = await pollRow(pollId);
    expect(row.expiresAt?.getTime()).toBe(expiresAt.getTime());
  };

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, third, stranger, otherAdmin] = await Promise.all([
      h.createUser('prol-admin'),
      h.createUser('prol-hote'),
      h.createUser('prol-invite'),
      h.createUser('prol-tiers'),
      h.createUser('prol-etranger'),
      h.createUser('prol-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'prol', 'ralliement'));
    for (const who of [host, guest, third]) await h.addMember(groupId, who);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'prol-autre',
      'ralliement',
    ));
    ({ id: oneShotId } = await h.createPartie(admin, 'ONE_SHOT', 'prol-isolee', 'ralliement'));
    ({ id: jdrId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'prol-jdr'));
  });

  afterAll(async () => {
    await h?.close();
  });

  it("l'hôte prolonge : échéance en fin du nouveau jour (UTC), relance ré-armée, carte vivante pour tous", async () => {
    const card = await create(host);
    await h.prisma.sessionPoll.update({
      where: { id: card.poll!.id },
      data: { relanceSentAt: new Date() },
    });
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    try {
      await extend(host, card.poll!.id, isoDay(9)).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(notify).toHaveBeenCalledWith(groupId, expect.anything());
    } finally {
      emit.mockRestore();
      notify.mockRestore();
    }

    const row = await pollRow(card.poll!.id);
    expect(row.expiresAt?.toISOString()).toBe(endOfDay(isoDay(9)));
    expect(row.relanceSentAt).toBeNull();
    expect(row.status).toBe('OPEN');
    for (const who of [admin, host, guest, third]) {
      expect((await cardFor(who, card.id)).poll?.expiresAt).toBe(endOfDay(isoDay(9)));
    }
  });

  it("une échéance dépassée mais un sondage encore ouvert : l'hôte prolonge, les votes rouvrent", async () => {
    const card = await create(host);
    const optionId = card.poll!.options[0].id;
    await h.prisma.sessionPoll.update({
      where: { id: card.poll!.id },
      data: { expiresAt: new Date(Date.now() - 3 * 86_400_000) },
    });
    const refused = await vote(guest, card.poll!.id, optionId);
    expect(refused.status).toBe(400);
    expect(message(refused)).toBe(VOTE_ENDED);

    // Le jour d'aujourd'hui suffit (jamais avant aujourd'hui) : le vote rouvre jusqu'à ce soir.
    await extend(host, card.poll!.id, isoDay(0)).expect(200);

    await vote(guest, card.poll!.id, optionId).expect(201);
    expect(await h.prisma.pollVote.count({ where: { pollId: card.poll!.id } })).toBe(1);
  });

  describe('refus (rien n’est écrit)', () => {
    it("tout autre membre, administrateur compris : 403 « réservée à l'hôte » ; un étranger et l'administrateur d'un autre groupe : 403 « pas accès »", async () => {
      const card = await create(host);
      const before = (await pollRow(card.poll!.id)).expiresAt!;

      for (const who of [guest, third, admin]) {
        const res = await extend(who, card.poll!.id, isoDay(9));
        expect(res.status).toBe(403);
        expect(message(res)).toBe(HOST_ONLY);
      }
      for (const who of [stranger, otherAdmin]) {
        const res = await extend(who, card.poll!.id, isoDay(9));
        expect(res.status).toBe(403);
        expect(message(res)).toBe("Vous n'avez pas accès à cette partie");
      }
      await unchanged(card.poll!.id, before);
    });

    it("la rencontre isolée (ONE_SHOT, Story 41.2) comme un groupe, le JDR : 403 ; le sondage d'un autre groupe par la route du sien : 400", async () => {
      const card = await create(host);
      const before = (await pollRow(card.poll!.id)).expiresAt!;

      // Story 41.2 : la soirée isolée prolonge son vote comme un groupe — un sondage inconnu y est refusé en 400.
      expect((await extend(admin, randomUUID(), isoDay(9), oneShotId)).status).toBe(400);
      // JDR : la capacité n'existe pas, même pour le MJ (propriétaire).
      expect((await extend(admin, randomUUID(), isoDay(9), jdrId)).status).toBe(403);
      // L'administrateur de l'autre groupe, par la route de SON groupe, ne touche pas ce sondage.
      expect((await extend(otherAdmin, card.poll!.id, isoDay(9), otherGroupId)).status).toBe(400);
      // Sondage inconnu dans son propre groupe.
      expect((await extend(host, randomUUID(), isoDay(9))).status).toBe(400);
      await unchanged(card.poll!.id, before);
    });

    it('jour identique ou antérieur à l’échéance, jour passé, format ou jour invalide : 400 français', async () => {
      const card = await create(host); // échéance : fin du jour +5
      const before = (await pollRow(card.poll!.id)).expiresAt!;

      for (const day of [isoDay(5), isoDay(3)]) {
        const res = await extend(host, card.poll!.id, day);
        expect(res.status).toBe(400);
        expect(message(res)).toBe(NOT_LATER);
      }
      const past = await extend(host, card.poll!.id, isoDay(-1));
      expect(past.status).toBe(400);
      expect(message(past)).toBe(PAST_DEADLINE);
      const impossible = await extend(host, card.poll!.id, '2099-02-30');
      expect(impossible.status).toBe(400);
      expect(message(impossible)).toBe(INVALID_DAY);
      for (const bad of ['demain', '2099-1-1', 42, null, undefined]) {
        expect((await extend(host, card.poll!.id, bad)).status).toBe(400);
      }
      await unchanged(card.poll!.id, before);
    });

    it('date déjà fixée ou sondage fermé : 400 français', async () => {
      const dated = await create(host);
      await host.agent
        .patch(`/parties/${groupId}/poll/${dated.poll!.id}/choose`)
        .send({ optionId: dated.poll!.options[0].id })
        .expect(200);
      const before = (await pollRow(dated.poll!.id)).expiresAt!;
      const res = await extend(host, dated.poll!.id, isoDay(20));
      expect(res.status).toBe(400);
      expect(message(res)).toBe(ALREADY_FIXED);
      await unchanged(dated.poll!.id, before);

      const closed = await create(host);
      await h.prisma.sessionPoll.update({
        where: { id: closed.poll!.id },
        data: { status: 'CLOSED' },
      });
      const beforeClosed = (await pollRow(closed.poll!.id)).expiresAt!;
      expect((await extend(host, closed.poll!.id, isoDay(20))).status).toBe(400);
      await unchanged(closed.poll!.id, beforeClosed);
    });
  });

  it('deux prolongations simultanées vers le même jour : une seule gagne sous le verrou, l’autre est refusée (400)', async () => {
    const card = await create(host);

    const [a, b] = await Promise.all([
      extend(host, card.poll!.id, isoDay(10)),
      extend(host, card.poll!.id, isoDay(10)),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect((await pollRow(card.poll!.id)).expiresAt?.toISOString()).toBe(endOfDay(isoDay(10)));
  });

  describe('relance de la veille (e-mail n°6)', () => {
    /** Place l'échéance dans la fenêtre « la veille du jour d'échéance » (entre 24 h et 48 h d'ici). */
    const eveOfDeadline = (pollId: string) =>
      h.prisma.sessionPoll.update({
        where: { id: pollId },
        data: { expiresAt: new Date(Date.now() + 36 * 3_600_000) },
      });
    const run = () => h.app.get(NotificationsService).sendDueReminders();

    it('la veille de l’échéance : les éligibles sans réponse reçoivent l’e-mail une seule fois ; la marque est posée', async () => {
      const card = await create(host, { title: 'Relance cible' });
      await vote(guest, card.poll!.id, card.poll!.options[0].id).expect(201);
      await vote(host, card.poll!.id, card.poll!.options[1].id).expect(201);
      await eveOfDeadline(card.poll!.id);

      const before = h.email.calls.length;
      await run();
      const sent = relanceMails(before, 'Relance cible');
      // « Tous les membres » : l'administrateur et le tiers n'ont pas répondu ; l'invité et l'hôte oui.
      expect(sent.map((c) => c.to).sort()).toEqual([admin.email, third.email].sort());
      expect(String(sent[0].data.link)).toContain(
        `/parties/${groupId}/guild-calendar?poll=${card.poll!.id}`,
      );
      expect((await pollRow(card.poll!.id)).relanceSentAt).not.toBeNull();

      // Une seconde passe ne renvoie rien : « une fois ».
      const second = h.email.calls.length;
      await run();
      expect(relanceMails(second, 'Relance cible')).toEqual([]);
    });

    it('prolonger ré-arme la relance : la veille de la nouvelle échéance, elle repart', async () => {
      const card = await create(host, { title: 'Relance rearmee' });
      await eveOfDeadline(card.poll!.id);
      let mark = h.email.calls.length;
      await run();
      expect(relanceMails(mark, 'Relance rearmee')).toHaveLength(4);
      expect((await pollRow(card.poll!.id)).relanceSentAt).not.toBeNull();

      await extend(host, card.poll!.id, isoDay(7)).expect(200);
      expect((await pollRow(card.poll!.id)).relanceSentAt).toBeNull();
      // Loin de la nouvelle échéance : rien ne part.
      mark = h.email.calls.length;
      await run();
      expect(relanceMails(mark, 'Relance rearmee')).toEqual([]);

      // La veille de la nouvelle échéance : la relance repart, à ceux qui n'ont toujours pas voté.
      await vote(guest, card.poll!.id, card.poll!.options[0].id).expect(201);
      await eveOfDeadline(card.poll!.id);
      mark = h.email.calls.length;
      await run();
      expect(
        relanceMails(mark, 'Relance rearmee')
          .map((c) => c.to)
          .sort(),
      ).toEqual([admin.email, host.email, third.email].sort());
    });

    it('places limitées : seuls l’hôte et les inscrits confirmés sans réponse sont relancés', async () => {
      const card = await create(host, { title: 'Relance limitee', capacity: 4 });
      await guest.agent.post(`/scenarios/seances/${card.seance!.id}/inscription`).expect(201);
      await eveOfDeadline(card.poll!.id);

      const before = h.email.calls.length;
      await run();

      expect(
        relanceMails(before, 'Relance limitee')
          .map((c) => c.to)
          .sort(),
      ).toEqual([host.email, guest.email].sort());
    });

    it('tout le monde a voté : aucun e-mail, la marque est quand même posée', async () => {
      const card = await create(host, { title: 'Relance complete' });
      for (const who of [admin, host, guest, third]) {
        await vote(who, card.poll!.id, card.poll!.options[0].id).expect(201);
      }
      await eveOfDeadline(card.poll!.id);

      const before = h.email.calls.length;
      await run();

      expect(relanceMails(before, 'Relance complete')).toEqual([]);
      expect((await pollRow(card.poll!.id)).relanceSentAt).not.toBeNull();
    });

    it('rien pour une date fixée, un sondage fermé, une échéance hors de la veille', async () => {
      const dated = await create(host, { title: 'Relance datee' });
      await host.agent
        .patch(`/parties/${groupId}/poll/${dated.poll!.id}/choose`)
        .send({ optionId: dated.poll!.options[0].id })
        .expect(200);
      const closed = await create(host, { title: 'Relance fermee' });
      await h.prisma.sessionPoll.update({
        where: { id: closed.poll!.id },
        data: { status: 'CLOSED' },
      });
      const early = await create(host, { title: 'Relance trop tot' });
      const late = await create(host, { title: 'Relance trop tard' });
      for (const c of [dated, closed]) await eveOfDeadline(c.poll!.id);
      await h.prisma.sessionPoll.update({
        where: { id: late.poll!.id },
        data: { expiresAt: new Date(Date.now() + 12 * 3_600_000) },
      });

      const before = h.email.calls.length;
      await run();

      for (const title of [
        'Relance datee',
        'Relance fermee',
        'Relance trop tot',
        'Relance trop tard',
      ]) {
        expect(relanceMails(before, title)).toEqual([]);
      }
      for (const c of [dated, closed, early, late]) {
        expect((await pollRow(c.poll!.id)).relanceSentAt).toBeNull();
      }
    });

    it('un sondage de JDR n’est jamais relancé, même dans la fenêtre', async () => {
      const mj = admin;
      const event = await h.prisma.event.create({
        data: { partieId: jdrId, title: 'Relance jdr', ownerId: mj.id },
      });
      const poll = await h.prisma.sessionPoll.create({
        data: {
          partieId: jdrId,
          createdById: mj.id,
          expiresAt: new Date(Date.now() + 36 * 3_600_000),
          options: { create: [{ date: new Date(`${isoDay(8)}T00:00:00.000Z`), slot: 'EVENING' }] },
        },
      });
      await h.prisma.seance.create({ data: { eventId: event.id, pollId: poll.id } });

      const before = h.email.calls.length;
      await run();

      expect(h.email.calls.slice(before).filter((c) => c.template === RELANCE_MAIL)).toEqual([]);
      expect((await pollRow(poll.id)).relanceSentAt).toBeNull();
    });
  });
});

// Story 40.8 — qui quitte un groupe, ou en est retiré, libère ses places et ses votes : inscriptions
// (`RESERVED` et `CONFIRMED`) aux conjonctions à venir et réponses aux sondages ouverts, dans la
// transaction de `leave()`. Le passé, les sondages fermés et les conjonctions qu'il organise restent.
describe('Ralliement — libérer places et votes de qui quitte le groupe (Story 40.8)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let leaver: TestUser;
  let other: TestUser;
  let third: TestUser;
  let groupId: string;
  let oneShotId: string;
  let jdrId: string;

  type CardLike = {
    id: string;
    seance: { id: string; placesTaken: number } | null;
    participants: { userId: string; isHost: boolean }[];
    myInscription: string | null;
    poll: {
      id: string;
      options: { id: string }[];
      votes: { userId: string }[];
    } | null;
  };

  const propose = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title: 'Soirée', date: isoDay(6), slot: 'EVENING', capacity: 6, ...over });
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const proposePoll = (who: TestUser, over: Record<string, unknown> = {}) =>
    propose(who, {
      date: undefined,
      slot: undefined,
      capacity: null,
      pollOptions: [
        { date: isoDay(8), slot: 'EVENING' },
        { date: isoDay(9), slot: 'MORNING' },
      ],
      pollDeadline: isoDay(5),
      ...over,
    });
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const reserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({ userId });
  const vote = (who: TestUser, pollId: string, optionId: string) =>
    who.agent.post(`/parties/${groupId}/poll/${pollId}/vote`).send({ optionId, answer: 'YES' });
  const leave = (who: TestUser) => who.agent.delete(`/parties/${groupId}/members/me`);
  const remove = (who: TestUser, targetId: string) =>
    who.agent.delete(`/parties/${groupId}/members/${targetId}`);
  const rows = async (seanceId: string) =>
    (
      await h.prisma.inscription.findMany({ where: { seanceId }, orderBy: { createdAt: 'asc' } })
    ).map((i) => [i.userId, i.status]);
  const votesOf = (pollId: string, userId: string) =>
    h.prisma.pollVote.count({ where: { pollId, userId } });
  const cardFor = async (who: TestUser, eventId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
      (c) => c.id === eventId,
    )!;
  const member = (userId: string) =>
    h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId: groupId } } });
  const setDay = (seanceId: string, day: string) => {
    const date = new Date(`${day}T00:00:00.000Z`);
    return h.prisma.seance.update({
      where: { id: seanceId },
      data: { startDate: date, endDate: date },
    });
  };

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, leaver, other, third] = await Promise.all([
      h.createUser('lib-admin'),
      h.createUser('lib-hote'),
      h.createUser('lib-partant'),
      h.createUser('lib-autre'),
      h.createUser('lib-tiers'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'lib', 'ralliement'));
    for (const who of [host, other, third]) await h.addMember(groupId, who);
    ({ id: oneShotId } = await h.createPartie(admin, 'ONE_SHOT', 'lib-isolee', 'ralliement'));
    ({ id: jdrId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'lib-jdr'));
  });

  afterAll(async () => {
    await h?.close();
  });

  // Le départ est le sujet de chaque scénario : la personne est (re)membre avant chacun.
  beforeEach(async () => {
    if (!(await member(leaver.id))) await h.addMember(groupId, leaver);
  });

  it('départ volontaire : places à venir (confirmées, réservées, du jour, sans date) et votes ouverts libérés ; le passé, le sondage fermé et la conjonction hébergée restent ; en direct', async () => {
    const upcoming = await propose(host, { title: 'À venir' });
    const reserved = await propose(host, { title: 'Réservée' });
    const today = await propose(host, { title: 'Aujourd’hui' });
    const past = await propose(host, { title: 'Passée' });
    const undated = await proposePoll(host, { title: 'Sans date' });
    const closed = await proposePoll(host, { title: 'Sondage fermé' });
    const hosted = await propose(leaver, { title: 'Hébergée' });

    await signUp(leaver, upcoming.seance!.id).expect(201);
    await reserve(host, reserved.seance!.id, leaver.id).expect(201);
    await signUp(leaver, today.seance!.id).expect(201);
    await setDay(today.seance!.id, isoDay(0));
    await signUp(leaver, past.seance!.id).expect(201);
    await setDay(past.seance!.id, isoDay(-2));
    await signUp(leaver, undated.seance!.id).expect(201);
    await vote(leaver, undated.poll!.id, undated.poll!.options[0].id).expect(201);
    await vote(leaver, undated.poll!.id, undated.poll!.options[1].id).expect(201);
    await vote(other, undated.poll!.id, undated.poll!.options[0].id).expect(201);
    await vote(leaver, closed.poll!.id, closed.poll!.options[0].id).expect(201);
    await h.prisma.sessionPoll.update({
      where: { id: closed.poll!.id },
      data: { status: 'CLOSED' },
    });
    await signUp(other, hosted.seance!.id).expect(201);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    try {
      await leave(leaver).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(leaver.id));
      expect(notify).toHaveBeenCalledWith(groupId, expect.anything());
    } finally {
      emit.mockRestore();
      notify.mockRestore();
    }

    expect(await member(leaver.id)).toBeNull();
    // Libérés.
    expect(await rows(upcoming.seance!.id)).toEqual([]);
    expect(await rows(reserved.seance!.id)).toEqual([]);
    expect(await rows(today.seance!.id)).toEqual([]);
    expect(await rows(undated.seance!.id)).toEqual([]);
    expect(await votesOf(undated.poll!.id, leaver.id)).toBe(0);
    // Conservés : le passé (la personne y reste parmi les participants), le sondage fermé, l'hébergée (que la
    // Story 42.3 annule désormais : elle reste attribuée à son hôte, ses inscrits sont conservés).
    expect(await rows(past.seance!.id)).toEqual([[leaver.id, 'CONFIRMED']]);
    expect(await votesOf(closed.poll!.id, leaver.id)).toBe(1);
    expect(await h.prisma.event.count({ where: { id: hosted.id, ownerId: leaver.id } })).toBe(1);
    expect(await rows(hosted.seance!.id)).toEqual([[other.id, 'CONFIRMED']]);
    // Les votes des autres ne bougent pas.
    expect(await votesOf(undated.poll!.id, other.id)).toBe(1);

    // Les cartes des autres membres suivent : places libérées, résumé du sondage sans le partant.
    expect((await cardFor(host, upcoming.id)).participants.map((p) => p.userId)).toEqual([host.id]);
    expect((await cardFor(third, upcoming.id)).seance?.placesTaken).toBe(1);
    expect((await cardFor(host, reserved.id)).seance?.placesTaken).toBe(1);
    const summary = (await cardFor(host, undated.id)).poll!;
    expect(summary.votes.map((v) => v.userId)).toEqual([other.id]);
    expect((await cardFor(host, past.id)).participants.map((p) => p.userId)).toContain(leaver.id);
  });

  it('retrait par un administrateur : la place réservée est libérée et le signal « réservation à confirmer » disparaît', async () => {
    const card = await propose(host, { title: 'Réservée au retiré', capacity: 4 });
    await reserve(host, card.seance!.id, leaver.id).expect(201);
    const signals = async () =>
      body<Record<string, { signals: string[] }>>(
        await leaver.agent.get('/me/party-signals').expect(200),
      )[groupId]?.signals ?? [];
    expect(await signals()).toContain('RESERVATION_A_CONFIRMER');

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await remove(admin, leaver.id).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(leaver.id));
    } finally {
      emit.mockRestore();
    }

    expect(await rows(card.seance!.id)).toEqual([]);
    expect((await cardFor(host, card.id)).seance?.placesTaken).toBe(1);
    expect(await member(leaver.id)).toBeNull();
    // Plus membre : le groupe ne figure plus dans ses signaux.
    expect(await signals()).not.toContain('RESERVATION_A_CONFIRMER');
  });

  it('dernière place : un inscrit part, un autre membre s’inscrit aussitôt avec succès', async () => {
    const card = await propose(host, { title: 'Dernière place', capacity: 2 });
    await signUp(leaver, card.seance!.id).expect(201);
    expect((await signUp(third, card.seance!.id)).status).toBe(409);

    await leave(leaver).expect(200);

    await signUp(third, card.seance!.id).expect(201);
    expect(await rows(card.seance!.id)).toEqual([[third.id, 'CONFIRMED']]);
  });

  it('sondage ouvert : les votes du partant disparaissent, ceux des autres restent', async () => {
    const card = await proposePoll(host, { title: 'Sondage ouvert' });
    const [o1, o2] = card.poll!.options;
    await vote(leaver, card.poll!.id, o1.id).expect(201);
    await vote(leaver, card.poll!.id, o2.id).expect(201);
    await vote(third, card.poll!.id, o1.id).expect(201);
    expect((await cardFor(host, card.id)).poll!.votes).toHaveLength(3);

    await leave(leaver).expect(200);

    const summary = (await cardFor(host, card.id)).poll!;
    expect(summary.votes.map((v) => v.userId)).toEqual([third.id]);
  });

  it('un échec du nettoyage annule tout : adhésion, places et votes intacts, rien n’est émis', async () => {
    const card = await proposePoll(host, { title: 'Atomicité' });
    await signUp(leaver, card.seance!.id).expect(201);
    await vote(leaver, card.poll!.id, card.poll!.options[0].id).expect(201);
    const dated = await propose(host, { title: 'Atomicité datée' });
    await signUp(leaver, dated.seance!.id).expect(201);

    const fail = jest
      .spyOn(h.app.get(PollVoteCleanupService), 'removeOpenVotesInTx')
      .mockRejectedValue(new Error('boom'));
    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      const res = await leave(leaver);
      expect(res.status).toBe(500);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      fail.mockRestore();
      emit.mockRestore();
    }

    expect(await member(leaver.id)).not.toBeNull();
    // Les inscriptions déjà supprimées plus tôt dans la transaction sont revenues.
    expect(await rows(card.seance!.id)).toEqual([[leaver.id, 'CONFIRMED']]);
    expect(await rows(dated.seance!.id)).toEqual([[leaver.id, 'CONFIRMED']]);
    expect(await votesOf(card.poll!.id, leaver.id)).toBe(1);
  });

  it('seul le groupe quitté est nettoyé : une inscription dans un autre groupe reste', async () => {
    const { id: otherGroupId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'lib-autre-groupe',
      'ralliement',
    );
    await h.addMember(otherGroupId, leaver);
    const res = await admin.agent
      .post(`/parties/${otherGroupId}/events`)
      .send({ title: 'Ailleurs', date: isoDay(6), slot: 'EVENING', capacity: 4 });
    const elsewhere = body<CardLike>(res);
    await signUp(leaver, elsewhere.seance!.id).expect(201);
    const here = await propose(host, { title: 'Ici' });
    await signUp(leaver, here.seance!.id).expect(201);

    await leave(leaver).expect(200);

    expect(await rows(here.seance!.id)).toEqual([]);
    expect(await rows(elsewhere.seance!.id)).toEqual([[leaver.id, 'CONFIRMED']]);
  });

  it('JDR : le retrait par le MJ garde inscriptions et votes (comportement inchangé)', async () => {
    await h.addMember(jdrId, leaver);
    const event = await h.prisma.event.create({
      data: { partieId: jdrId, title: 'Séance jdr', ownerId: admin.id },
    });
    const day = new Date(`${isoDay(6)}T00:00:00.000Z`);
    const seance = await h.prisma.seance.create({
      data: {
        eventId: event.id,
        startDate: day,
        endDate: day,
        startSlot: 'EVENING',
        endSlot: 'EVENING',
      },
    });
    await h.prisma.inscription.create({ data: { seanceId: seance.id, userId: leaver.id } });
    const poll = await h.prisma.sessionPoll.create({
      data: {
        partieId: jdrId,
        createdById: admin.id,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
        options: { create: [{ date: new Date(`${isoDay(8)}T00:00:00.000Z`), slot: 'EVENING' }] },
      },
      include: { options: true },
    });
    await h.prisma.pollVote.create({
      data: { pollId: poll.id, optionId: poll.options[0].id, userId: leaver.id, answer: 'YES' },
    });

    await admin.agent.delete(`/parties/${jdrId}/members/${leaver.id}`).expect(200);

    expect(await rows(seance.id)).toEqual([[leaver.id, 'CONFIRMED']]);
    expect(await votesOf(poll.id, leaver.id)).toBe(1);
  });

  it('rencontre isolée : le départ reste refusé (403), inscription intacte', async () => {
    await h.addMember(oneShotId, leaver);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: oneShotId } });
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId: event.id } });
    await h.prisma.inscription.create({ data: { seanceId: seance.id, userId: leaver.id } });

    await leaver.agent.delete(`/parties/${oneShotId}/members/me`).expect(403);

    expect(await rows(seance.id)).toEqual([[leaver.id, 'CONFIRMED']]);
  });

  it('dernier administrateur : le groupe est supprimé sans nettoyage (cascade), comme avant', async () => {
    const { id: soloId } = await h.createPartie(
      third,
      'CAMPAGNE_EPISODIQUE',
      'lib-solo',
      'ralliement',
    );
    const res = await third.agent
      .post(`/parties/${soloId}/events`)
      .send({ title: 'Solo', date: isoDay(6), slot: 'EVENING', capacity: 4 });
    const eventId = body<CardLike>(res).id;
    await third.agent.delete(`/parties/${soloId}/members/me?deleteIfLastAdmin=true`).expect(200);
    expect(await h.prisma.partie.count({ where: { id: soloId } })).toBe(0);
    expect(await h.prisma.event.count({ where: { id: eventId } })).toBe(0);
  });
});

// ─── Soirée isolée : lecture de son événement unique (Story 41.1) ──────────────────────────
//
// La page d'une soirée isolée (ralliement ONE_SHOT) affiche en ligne l'unique événement créé avec
// elle, lu par la liste existante de la partie. Les refus propres à la soirée (un seul
// administrateur, pas de second événement, pas de déplacement) sont couverts plus haut : rôles
// (39.4), départ (39.5), proposer (40.1), modifier (40.2), s'inscrire (40.3).
describe('Ralliement — lire l’événement unique d’une soirée isolée (Story 41.1)', () => {
  let h: Harness;
  let admin: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let soireeId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: { id: string; date: string | null; capacity: number | null } | null;
    participants: { userId: string; isHost: boolean }[];
  };

  beforeAll(async () => {
    h = await Harness.start();
    [admin, guest, stranger] = await Promise.all([
      h.createUser('soiree-hote'),
      h.createUser('soiree-invite'),
      h.createUser('soiree-etranger'),
    ]);
    ({ id: soireeId } = await h.createPartie(admin, 'ONE_SHOT', 'soiree', 'ralliement'));
    await h.addMember(soireeId, guest);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('l’hôte et un invité lisent exactement un événement : titre de la soirée, hôte = créateur, non daté, sans limite', async () => {
    const partie = body<{ name: string }>(
      await admin.agent.get(`/parties/${soireeId}`).expect(200),
    );
    for (const who of [admin, guest]) {
      const list = body<CardLike[]>(
        await who.agent.get(`/parties/${soireeId}/events/list`).expect(200),
      );
      expect(list).toHaveLength(1);
      const [card] = list;
      expect(card.title).toBe(partie.name);
      expect(card.hostId).toBe(admin.id);
      expect(card.seance?.date).toBeNull();
      expect(card.seance?.capacity).toBeNull();
    }
  });

  it('l’hôte figure parmi les participants de la carte ; les invités sont lus dans la liste des membres de la partie', async () => {
    const [card] = body<CardLike[]>(
      await guest.agent.get(`/parties/${soireeId}/events/list`).expect(200),
    );
    expect(card.participants.find((p) => p.userId === admin.id)?.isHost).toBe(true);
    const members = body<{ userId: string }[]>(
      await guest.agent.get(`/parties/${soireeId}/members`).expect(200),
    );
    expect(members.map((m) => m.userId).sort()).toEqual([admin.id, guest.id].sort());
  });

  it('un étranger à la soirée ne lit rien de son événement (403)', async () => {
    await stranger.agent.get(`/parties/${soireeId}/events/list`).expect(403);
  });

  it('la soirée reste à un seul événement : proposer une conjonction est refusé (403), même à l’hôte', async () => {
    await admin.agent
      .post(`/parties/${soireeId}/events`)
      .send({ title: 'Second', date: isoDay(5), slot: 'EVENING' })
      .expect(403);
    expect(await h.prisma.event.count({ where: { partieId: soireeId } })).toBe(1);
  });
});

// ─── Poser la rencontre d'une soirée isolée (Story 41.2) ───────────────────────────────────
//
// Une soirée naît avec un événement SANS date ni sondage (« date à fixer », Story 38.2). L'hôte le complète
// par la route de modification, à date fixée ou par sondage ; le vote, la fixation et la prolongation sont
// ceux des conjonctions, avec l'hôte et les membres de la soirée pour votants et destinataires.
describe('Ralliement — poser la rencontre d’une soirée isolée (Story 41.2)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let soireeId: string;

  type CardLike = {
    id: string;
    title: string;
    hostId: string | null;
    seance: {
      id: string;
      date: string | null;
      slot: string | null;
      capacity: number | null;
    } | null;
    poll: { id: string; options: { id: string }[]; eligibleVoterIds: string[] } | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };

  const DATE_MAIL = 'conjonction-date-fixee';
  const newSoiree = async (name: string) => {
    const { id } = await h.createPartie(host, 'ONE_SHOT', name, 'ralliement');
    await h.addMember(id, guest);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: id } });
    return { id, eventId: event.id };
  };
  const edit = (who: TestUser, partieId: string, eventId: string, sent: Record<string, unknown>) =>
    who.agent.patch(`/parties/${partieId}/events/${eventId}`).send(sent);
  const pollPayload = (over: Record<string, unknown> = {}) => ({
    title: 'Marathon Pandémie',
    pollOptions: [
      { date: isoDay(8), slot: 'EVENING' },
      { date: isoDay(9), slot: 'MORNING' },
    ],
    pollDeadline: isoDay(5),
    ...over,
  });
  const cardOf = async (who: TestUser, partieId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${partieId}/events/list`).expect(200))[0];

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, stranger] = await Promise.all([
      h.createUser('pose-hote'),
      h.createUser('pose-invite'),
      h.createUser('pose-etranger'),
    ]);
    ({ id: soireeId } = await newSoiree('pose'));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('date fixée : l’événement existant est complété (aucun second), la prochaine date de la soirée est posée', async () => {
    const { id, eventId } = await newSoiree('pose-fixe');
    const res = await edit(host, id, eventId, {
      title: 'Soirée jeux',
      date: isoDay(6),
      slot: 'EVENING',
      lieu: 'Chez Léa',
    });
    expect(res.status).toBe(200);
    const card = body<CardLike>(res);
    expect(card.id).toBe(eventId);
    expect(card.seance?.date).toBe(isoDay(6));
    expect(card.seance?.capacity).toBeNull();
    expect(await h.prisma.event.count({ where: { partieId: id } })).toBe(1);
    const partie = body<{ nextSessionDate: string | null }>(
      await guest.agent.get(`/parties/${id}`).expect(200),
    );
    expect(partie.nextSessionDate?.substring(0, 10)).toBe(isoDay(6));
  });

  it('sondage : créé et rattaché à l’événement, qui reste sans date ; l’hôte et les membres sont les votants', async () => {
    const { id, eventId } = await newSoiree('pose-sondage');
    const res = await edit(host, id, eventId, pollPayload());
    expect(res.status).toBe(200);
    const card = body<CardLike>(res);
    expect(card.seance?.date).toBeNull();
    expect(card.poll?.options).toHaveLength(2);
    expect([...card.poll!.eligibleVoterIds].sort()).toEqual([host.id, guest.id].sort());
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId } });
    expect(seance.pollId).toBe(card.poll!.id);
    expect(await h.prisma.event.count({ where: { partieId: id } })).toBe(1);
  });

  it('vote : l’hôte et un membre votent ; un étranger est refusé (403), tout comme après l’échéance (400)', async () => {
    const { id, eventId } = await newSoiree('pose-vote');
    const card = body<CardLike>(await edit(host, id, eventId, pollPayload()));
    const [o1] = card.poll!.options;
    const vote = (who: TestUser) =>
      who.agent
        .post(`/parties/${id}/poll/${card.poll!.id}/vote`)
        .send({ optionId: o1.id, answer: 'YES' });
    expect((await vote(host)).status).toBe(201);
    expect((await vote(guest)).status).toBe(201);
    expect((await vote(stranger)).status).toBe(403);

    await h.prisma.sessionPoll.update({
      where: { id: card.poll!.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await vote(guest)).status).toBe(400);
  });

  it('fixer la date : l’hôte seul ; la séance est datée, le sondage clos, l’e-mail n° 4 va aux membres sauf l’hôte', async () => {
    const { id, eventId } = await newSoiree('pose-choix');
    const card = body<CardLike>(await edit(host, id, eventId, pollPayload()));
    const [o1] = card.poll!.options;
    const choose = (who: TestUser) =>
      who.agent.patch(`/parties/${id}/poll/${card.poll!.id}/choose`).send({ optionId: o1.id });
    expect((await choose(guest)).status).toBe(403);
    expect((await choose(stranger)).status).toBe(403);

    const mailsBefore = h.email.calls.length;
    expect((await choose(host)).status).toBeLessThan(300);
    const fixed = await cardOf(guest, id);
    expect(fixed.seance?.date).toBe(isoDay(8));
    expect(fixed.poll).toBeNull();
    const mails = h.email.calls.slice(mailsBefore).filter((c) => c.template === DATE_MAIL);
    expect(mails.map((c) => c.to)).toEqual([guest.email]);
  });

  it('prolonger le vote : l’hôte seul ; la nouvelle échéance est enregistrée', async () => {
    const { id, eventId } = await newSoiree('pose-prolonge');
    const card = body<CardLike>(await edit(host, id, eventId, pollPayload()));
    const extend = (who: TestUser) =>
      who.agent.patch(`/parties/${id}/poll/${card.poll!.id}/extend`).send({ expiresAt: isoDay(9) });
    expect((await extend(guest)).status).toBe(403);
    expect((await extend(host)).status).toBeLessThan(300);
    const poll = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: card.poll!.id } });
    expect(poll.expiresAt?.toISOString().substring(0, 10)).toBe(isoDay(9));
  });

  it('modifier : un membre non hôte et un étranger sont refusés (403), rien n’est écrit', async () => {
    const { id, eventId } = await newSoiree('pose-droits');
    for (const who of [guest, stranger]) {
      const res = await edit(who, id, eventId, {
        title: 'Piraté',
        date: isoDay(6),
        slot: 'EVENING',
      });
      expect(res.status).toBe(403);
    }
    const event = await h.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.title).not.toBe('Piraté');
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId } });
    expect(seance.startDate).toBeNull();
  });

  it('places limitées ou places réservées : refusées (400) sur une soirée', async () => {
    const { id, eventId } = await newSoiree('pose-places');
    const date = { title: 'Soirée', date: isoDay(6), slot: 'EVENING' };
    for (const extra of [{ capacity: 4 }, { reservedUserIds: [guest.id] }]) {
      const res = await edit(host, id, eventId, { ...date, ...extra });
      expect(res.status).toBe(400);
      expect(String((res.body as ErrorLike).message)).toContain('sur invitation');
    }
    expect((await h.prisma.seance.findFirstOrThrow({ where: { eventId } })).startDate).toBeNull();
  });

  it('date ou échéance passées sur une soirée en attente de date : 400, rien n’est écrit', async () => {
    const { id, eventId } = await newSoiree('pose-passe');
    const past = await edit(host, id, eventId, { title: 'X', date: isoDay(-1), slot: 'EVENING' });
    expect(past.status).toBe(400);
    const pastDeadline = await edit(host, id, eventId, pollPayload({ pollDeadline: isoDay(-1) }));
    expect(pastDeadline.status).toBe(400);
    const pastSlot = await edit(
      host,
      id,
      eventId,
      pollPayload({
        pollOptions: [
          { date: isoDay(-2), slot: 'EVENING' },
          { date: isoDay(8), slot: 'MORNING' },
        ],
      }),
    );
    expect(pastSlot.status).toBe(400);
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId } });
    expect(seance.startDate).toBeNull();
    expect(seance.pollId).toBeNull();
  });

  it('le mode ne change plus une fois posé : un sondage ne devient pas une date fixée (400)', async () => {
    const { id, eventId } = await newSoiree('pose-mode');
    expect((await edit(host, id, eventId, pollPayload())).status).toBe(200);
    const res = await edit(host, id, eventId, { title: 'X', date: isoDay(6), slot: 'EVENING' });
    expect(res.status).toBe(400);
  });

  it('la soirée reste à un seul événement : proposer une conjonction est refusé (403)', async () => {
    const res = await host.agent
      .post(`/parties/${soireeId}/events`)
      .send({ title: 'Second', date: isoDay(5), slot: 'EVENING' });
    expect(res.status).toBe(403);
    expect(await h.prisma.event.count({ where: { partieId: soireeId } })).toBe(1);
  });
});

// ─── Inviter à une soirée isolée, accepter ou décliner (Story 41.3) ───────────────────────
//
// L'invitation est l'`Invitation` existante au niveau de la partie (sans limite), répondue depuis la liste
// d'accueil. L'e-mail n° 2 prévient l'invité ; accepter crée le `Membership`, qui fait de lui un votant.
describe('Ralliement — inviter à une soirée isolée (Story 41.3)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;
  let soireeId: string;
  let eventId: string;

  type PollCard = { poll: { id: string; options: { id: string }[] } | null };
  type InvitationLike = { id: string; partie: { id: string } };

  const MAIL = 'soiree-invitation';
  const invite = (who: TestUser, userId: string, partieId = soireeId) =>
    who.agent.post(`/parties/${partieId}/invitations`).send({ inviteeUserId: userId });
  const received = async (who: TestUser) =>
    body<InvitationLike[]>(await who.agent.get('/invitations').expect(200));
  const mailsTo = (to: string) => h.email.calls.filter((c) => c.to === to && c.template === MAIL);

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, stranger] = await Promise.all([
      h.createUser('inv-soiree-hote'),
      h.createUser('inv-soiree-invite'),
      h.createUser('inv-soiree-etranger'),
    ]);
    ({ id: soireeId } = await h.createPartie(host, 'ONE_SHOT', 'invitations', 'ralliement'));
    eventId = (await h.prisma.event.findFirstOrThrow({ where: { partieId: soireeId } })).id;
  });

  afterAll(async () => {
    await h?.close();
  });

  it('par pseudo : invitation en attente, e-mail n° 2 (titre, date à fixer), l’invité la voit dans ses invitations reçues', async () => {
    await invite(host, guest.id).expect(201);

    const sent = mailsTo(guest.email);
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toMatchObject({
      inviterName: host.displayName,
      dateLine: 'date à fixer',
    });
    expect(String(sent[0].data.eventTitle)).toBeTruthy();
    expect((await received(guest)).map((i) => i.partie.id)).toEqual([soireeId]);
    // L'invité n'a toujours aucun accès à la soirée avant d'accepter.
    await guest.agent.get(`/parties/${soireeId}`).expect(403);
    await guest.agent.get(`/parties/${soireeId}/events/list`).expect(403);
  });

  it('avant d’accepter, l’invité ne peut pas voter ; après avoir accepté il est membre, votant, et l’hôte le voit', async () => {
    const date = new Date(Date.now() + 5 * 86_400_000).toISOString().substring(0, 10);
    const later = new Date(Date.now() + 6 * 86_400_000).toISOString().substring(0, 10);
    const deadline = new Date(Date.now() + 3 * 86_400_000).toISOString().substring(0, 10);
    const card = body<PollCard>(
      await host.agent
        .patch(`/parties/${soireeId}/events/${eventId}`)
        .send({
          title: 'Soirée',
          pollOptions: [
            { date, slot: 'EVENING' },
            { date: later, slot: 'MORNING' },
          ],
          pollDeadline: deadline,
        })
        .expect(200),
    );
    const vote = () =>
      guest.agent
        .post(`/parties/${soireeId}/poll/${card.poll!.id}/vote`)
        .send({ optionId: card.poll!.options[0].id, answer: 'YES' });
    expect((await vote()).status).toBe(403);

    const [invitation] = await received(guest);
    await guest.agent.post(`/invitations/${invitation.id}/accept`).expect(201);
    expect(
      await h.prisma.membership.count({ where: { partieId: soireeId, userId: guest.id } }),
    ).toBe(1);
    expect((await vote()).status).toBe(201);
    const members = body<{ userId: string }[]>(
      await host.agent.get(`/parties/${soireeId}/members`).expect(200),
    );
    expect(members.map((m) => m.userId)).toContain(guest.id);
  });

  it('retirer un invité accepté : son appartenance et ses votes ouverts disparaissent ; un invité ou un étranger ne retire personne', async () => {
    const poll = await h.prisma.sessionPoll.findFirstOrThrow({ where: { partieId: soireeId } });
    expect(await h.prisma.pollVote.count({ where: { pollId: poll.id, userId: guest.id } })).toBe(1);

    await guest.agent.delete(`/parties/${soireeId}/members/${host.id}`).expect(403);
    await stranger.agent.delete(`/parties/${soireeId}/members/${guest.id}`).expect(403);
    expect(
      await h.prisma.membership.count({ where: { partieId: soireeId, userId: guest.id } }),
    ).toBe(1);

    await host.agent.delete(`/parties/${soireeId}/members/${guest.id}`).expect(200);
    expect(
      await h.prisma.membership.count({ where: { partieId: soireeId, userId: guest.id } }),
    ).toBe(0);
    expect(await h.prisma.pollVote.count({ where: { pollId: poll.id, userId: guest.id } })).toBe(0);
  });

  it('refuser : l’invitation passe à DECLINED, aucune appartenance, plus de tuile dans la liste', async () => {
    const decliner = await h.createUser('inv-soiree-refus');
    await invite(host, decliner.id).expect(201);
    const [invitation] = await received(decliner);
    await decliner.agent.post(`/invitations/${invitation.id}/decline`).expect(201);

    expect(await received(decliner)).toEqual([]);
    expect(
      await h.prisma.membership.count({ where: { partieId: soireeId, userId: decliner.id } }),
    ).toBe(0);
    // Un second refus (ou accepter après coup) est refusé.
    await decliner.agent.post(`/invitations/${invitation.id}/accept`).expect(409);
  });

  it('seul l’hôte invite, liste, révoque et crée un lien : un invité, un membre et un étranger sont refusés (403)', async () => {
    const member = await h.createUser('inv-soiree-membre');
    await h.addMember(soireeId, member);
    const target = await h.createUser('inv-soiree-cible');
    for (const who of [member, stranger]) {
      expect((await invite(who, target.id)).status).toBe(403);
      await who.agent
        .post(`/parties/${soireeId}/invitations/by-email`)
        .send({ email: 'x@example.com' })
        .expect(403);
      await who.agent.get(`/parties/${soireeId}/invitations`).expect(403);
      await who.agent.post(`/parties/${soireeId}/invite-links`).send({}).expect(403);
    }
    expect(await received(target)).toEqual([]);
  });

  it('par e-mail : adresse connue → invitation + un seul e-mail n° 2 ; adresse inconnue → lien d’invitation dans l’e-mail', async () => {
    const known = await h.createUser('inv-soiree-connu');
    await host.agent
      .post(`/parties/${soireeId}/invitations/by-email`)
      .send({ email: known.email })
      .expect(201);
    expect(mailsTo(known.email)).toHaveLength(1);
    expect((await received(known)).map((i) => i.partie.id)).toEqual([soireeId]);

    const unknown = 'inv-soiree-inconnu@example.com';
    await host.agent
      .post(`/parties/${soireeId}/invitations/by-email`)
      .send({ email: unknown })
      .expect(201);
    const sent = mailsTo(unknown);
    expect(sent).toHaveLength(1);
    expect(String(sent[0].data.link)).toContain('/join/');
  });

  it('sans limite : douze invités de plus sont acceptés', async () => {
    const guests = await Promise.all(
      Array.from({ length: 12 }, (_, i) => h.createUser(`inv-soiree-nombre-${i}`)),
    );
    for (const g of guests) await invite(host, g.id).expect(201);
    expect(
      await h.prisma.invitation.count({ where: { partieId: soireeId, status: 'PENDING' } }),
    ).toBeGreaterThanOrEqual(12);
  });

  it('un groupe ou une quête : l’invitation par pseudo n’envoie aucun e-mail (inchangé)', async () => {
    const admin = await h.createUser('inv-soiree-admin-groupe');
    const target = await h.createUser('inv-soiree-cible-groupe');
    const { id } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'inv-groupe', 'ralliement');
    await invite(admin, target.id, id).expect(201);
    expect(h.email.calls.filter((c) => c.to === target.email)).toEqual([]);
  });
});

// ─── Clore une soirée isolée une fois passée (Story 41.4) ─────────────────────────────────
//
// Statut : isolée → `closedAt` ou plage passée → TERMINEE, sinon A_VENIR (AD-18). Une soirée terminée est
// figée : plus d'invitation, de vote, de modification ni de retrait d'invité.
describe('Ralliement — clore une soirée isolée une fois passée (Story 41.4)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let invitee: TestUser;

  type PartieLike = { id: string; status: string };

  const FINISHED = 'Cette soirée est terminée : plus rien ne peut y changer';
  const newSoiree = async (name: string) => {
    const { id } = await h.createPartie(host, 'ONE_SHOT', name, 'ralliement');
    await h.addMember(id, guest);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: id } });
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId: event.id } });
    return { id, eventId: event.id, seanceId: seance.id };
  };
  /** Date la séance directement en base (une soirée passée ne se saisit pas par l'API : jour passé refusé). */
  const dateSeance = (seanceId: string, offsetDays: number) => {
    const day = new Date(`${isoDay(offsetDays)}T00:00:00.000Z`);
    return h.prisma.seance.update({
      where: { id: seanceId },
      data: { startDate: day, endDate: day, startSlot: 'EVENING', endSlot: 'EVENING' },
    });
  };
  const statusOf = async (id: string) =>
    body<PartieLike>(await host.agent.get(`/parties/${id}`).expect(200)).status;
  const listedStatus = async (who: TestUser, id: string) =>
    body<PartieLike[]>(await who.agent.get('/parties').expect(200)).find((p) => p.id === id)
      ?.status;

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, invitee] = await Promise.all([
      h.createUser('clos-hote'),
      h.createUser('clos-invite'),
      h.createUser('clos-cible'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('sans date : « À venir » ; demain et aujourd’hui : « À venir » ; hier : « Terminée » — au détail comme dans la liste', async () => {
    const { id, seanceId } = await newSoiree('statut');
    expect(await statusOf(id)).toBe('A_VENIR');
    expect(await listedStatus(host, id)).toBe('A_VENIR');

    await dateSeance(seanceId, 1);
    expect(await statusOf(id)).toBe('A_VENIR');
    await dateSeance(seanceId, 0);
    expect(await statusOf(id)).toBe('A_VENIR');
    expect(await listedStatus(guest, id)).toBe('A_VENIR');

    await dateSeance(seanceId, -1);
    expect(await statusOf(id)).toBe('TERMINEE');
    expect(await listedStatus(host, id)).toBe('TERMINEE');
    expect(await listedStatus(guest, id)).toBe('TERMINEE');
  });

  it('close : « Terminée » même sans date ; rouvrir la remet « À venir » (date non passée) — et reste « Terminée » si la date est passée', async () => {
    const { id, seanceId } = await newSoiree('clore');
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    expect(await statusOf(id)).toBe('TERMINEE');
    expect(await listedStatus(guest, id)).toBe('TERMINEE');
    await host.agent.patch(`/parties/${id}/reopen`).expect(200);
    expect(await statusOf(id)).toBe('A_VENIR');

    await dateSeance(seanceId, -2);
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    await host.agent.patch(`/parties/${id}/reopen`).expect(200);
    expect(await statusOf(id)).toBe('TERMINEE');
  });

  it('soirée passée figée : invitations (pseudo, e-mail, lien), retrait d’un invité et modification refusés en 400 français', async () => {
    const { id, eventId, seanceId } = await newSoiree('figee');
    await dateSeance(seanceId, -1);

    const refusals = [
      await host.agent.post(`/parties/${id}/invitations`).send({ inviteeUserId: invitee.id }),
      await host.agent
        .post(`/parties/${id}/invitations/by-email`)
        .send({ email: 'nouveau@example.com' }),
      await host.agent.post(`/parties/${id}/invite-links`).send({}),
      await host.agent.delete(`/parties/${id}/members/${guest.id}`),
      await host.agent
        .patch(`/parties/${id}/events/${eventId}`)
        .send({ title: 'Trop tard', date: isoDay(3), slot: 'EVENING' }),
    ];
    for (const res of refusals) {
      expect(res.status).toBe(400);
      expect(String((res.body as { message: string | string[] }).message)).toContain(FINISHED);
    }
    expect(await h.prisma.membership.count({ where: { partieId: id, userId: guest.id } })).toBe(1);
    expect((await h.prisma.event.findUniqueOrThrow({ where: { id: eventId } })).title).not.toBe(
      'Trop tard',
    );
  });

  it('une invitation en attente ne peut plus être acceptée une fois la soirée terminée (400) ; la refuser reste possible', async () => {
    const { id } = await newSoiree('accepter');
    await host.agent
      .post(`/parties/${id}/invitations`)
      .send({ inviteeUserId: invitee.id })
      .expect(201);
    const [invitation] = body<{ id: string }[]>(
      await invitee.agent.get('/invitations').expect(200),
    );
    await host.agent.patch(`/parties/${id}/close`).expect(200);

    const res = await invitee.agent.post(`/invitations/${invitation.id}/accept`);
    expect(res.status).toBe(400);
    expect(await h.prisma.membership.count({ where: { partieId: id, userId: invitee.id } })).toBe(
      0,
    );
    await invitee.agent.post(`/invitations/${invitation.id}/decline`).expect(201);
  });

  it('un lien d’invitation ne fait plus rejoindre une soirée terminée (400)', async () => {
    const { id } = await newSoiree('lien');
    const link = body<{ token: string }>(
      await host.agent.post(`/parties/${id}/invite-links`).send({}).expect(201),
    );
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    const joiner = await h.createUser('clos-lien');
    expect((await joiner.agent.post(`/invite-links/${link.token}/join`)).status).toBe(400);
    expect(await h.prisma.membership.count({ where: { partieId: id, userId: joiner.id } })).toBe(0);
  });

  it('vote : un membre ne vote plus sur le sondage d’une soirée close sans date (400)', async () => {
    const { id, eventId } = await newSoiree('vote-clos');
    const card = body<{ poll: { id: string; options: { id: string }[] } }>(
      await host.agent
        .patch(`/parties/${id}/events/${eventId}`)
        .send({
          title: 'Soirée',
          pollOptions: [
            { date: isoDay(8), slot: 'EVENING' },
            { date: isoDay(9), slot: 'MORNING' },
          ],
          pollDeadline: isoDay(5),
        })
        .expect(200),
    );
    const vote = () =>
      guest.agent
        .post(`/parties/${id}/poll/${card.poll.id}/vote`)
        .send({ optionId: card.poll.options[0].id, answer: 'YES' });
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    const res = await vote();
    expect(res.status).toBe(400);
    expect(String((res.body as { message: string }).message)).toContain(FINISHED);

    await host.agent.patch(`/parties/${id}/reopen`).expect(200);
    expect((await vote()).status).toBe(201);
  });

  it('une soirée à venir reste modifiable, et un groupe garde son statut et ses écritures', async () => {
    const { id, eventId } = await newSoiree('avenir');
    const res = await host.agent
      .patch(`/parties/${id}/events/${eventId}`)
      .send({ title: 'Soirée', date: isoDay(4), slot: 'EVENING' });
    expect(res.status).toBe(200);

    const { id: groupId } = await h.createPartie(
      host,
      'CAMPAGNE_EPISODIQUE',
      'clos-groupe',
      'ralliement',
    );
    expect(await statusOf(groupId)).toBe('A_VENIR');
    await host.agent
      .post(`/parties/${groupId}/events`)
      .send({ title: 'Conjonction', date: isoDay(5), slot: 'EVENING' })
      .expect(201);
    expect(await statusOf(groupId)).toBe('EN_COURS');
  });
});

describe('Ralliement — annuler une conjonction de groupe (Story 42.1)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let reservedUser: TestUser;
  let third: TestUser;
  let stranger: TestUser;
  let otherAdmin: TestUser;
  let groupId: string;
  let otherGroupId: string;
  let oneShotId: string;

  type PollLike = { id: string; status: string; options: { id: string }[] };
  type CardLike = {
    id: string;
    cancelled: boolean;
    seance: { id: string; date: string | null } | null;
    poll: PollLike | null;
  };
  type ErrorLike = { statusCode: number; message: string | string[] };

  const CANCEL_MAIL = 'conjonction-annulee';
  const CANCELLED = 'Cette conjonction est annulée : plus rien ne peut y changer';
  const HOST_OR_ADMIN =
    "Seul l'hôte de la conjonction ou un administrateur du groupe peut l'annuler";
  const PAST = 'Cette conjonction est passée : elle ne peut plus être annulée';

  const message = (res: { body: unknown }) => (res.body as ErrorLike).message;
  const propose = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title: 'À annuler', date: isoDay(3), slot: 'EVENING', ...over });
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const proposePoll = (who: TestUser) =>
    propose(who, {
      title: 'Sondage à annuler',
      date: undefined,
      slot: undefined,
      pollOptions: [
        { date: isoDay(8), slot: 'EVENING' },
        { date: isoDay(9), slot: 'MORNING' },
      ],
      pollDeadline: isoDay(5),
    });
  const cancel = (who: TestUser, eventId: string, partieId = groupId) =>
    who.agent.post(`/parties/${partieId}/events/${eventId}/cancel`);
  const cardFor = async (who: TestUser, eventId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
      (c) => c.id === eventId,
    )!;
  const eventRow = (eventId: string) =>
    h.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const rows = async (seanceId: string) =>
    (
      await h.prisma.inscription.findMany({ where: { seanceId }, orderBy: { createdAt: 'asc' } })
    ).map((i) => [i.userId, i.status]);
  const cancelMails = (since: number, title: string) =>
    h.email.calls
      .slice(since)
      .filter((c) => c.template === CANCEL_MAIL && c.data.eventTitle === title);
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const reserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({ userId });
  const calendarOf = async (who: TestUser) =>
    body<{ 'mes-seances': { seanceId: string }[] }>(
      await who.agent
        .get('/me/calendar')
        .query({ from: isoDay(0), to: isoDay(30) })
        .expect(200),
    )['mes-seances'].map((s) => s.seanceId);

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, reservedUser, third, stranger, otherAdmin] = await Promise.all([
      h.createUser('annul-admin'),
      h.createUser('annul-hote'),
      h.createUser('annul-invite'),
      h.createUser('annul-reserve'),
      h.createUser('annul-tiers'),
      h.createUser('annul-etranger'),
      h.createUser('annul-autre-admin'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'annul', 'ralliement'));
    for (const who of [host, guest, reservedUser, third]) await h.addMember(groupId, who);
    ({ id: otherGroupId } = await h.createPartie(
      otherAdmin,
      'CAMPAGNE_EPISODIQUE',
      'annul-autre',
      'ralliement',
    ));
    ({ id: oneShotId } = await h.createPartie(admin, 'ONE_SHOT', 'annul-isolee', 'ralliement'));
  });

  afterAll(async () => {
    await h?.close();
  });

  it('l’hôte annule : cancelledAt posé, carte « annulée », e-mail n° 7 aux inscrits confirmés et réservés (jamais à l’hôte), tous prévenus en direct', async () => {
    const card = await propose(host, { title: 'Annulée par l’hôte', capacity: 4 });
    const seanceId = card.seance!.id;
    await signUp(guest, seanceId).expect(201);
    await reserve(host, seanceId, reservedUser.id).expect(201);
    const before = h.email.calls.length;

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    let res: Response;
    try {
      res = await cancel(host, card.id);
      expect(res.status).toBe(201);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(notify).toHaveBeenCalledWith(groupId, expect.anything());
    } finally {
      emit.mockRestore();
      notify.mockRestore();
    }

    expect(body<CardLike>(res).cancelled).toBe(true);
    expect((await eventRow(card.id)).cancelledAt).not.toBeNull();
    for (const who of [admin, host, guest, reservedUser, third]) {
      expect((await cardFor(who, card.id)).cancelled).toBe(true);
    }
    // Les lignes d'inscription restent telles quelles (l'historique de qui était inscrit).
    expect(await rows(seanceId)).toEqual([
      [guest.id, 'CONFIRMED'],
      [reservedUser.id, 'RESERVED'],
    ]);

    const sent = cancelMails(before, 'Annulée par l’hôte');
    expect(sent.map((c) => c.to).sort()).toEqual([guest.email, reservedUser.email].sort());
    expect(sent[0].data).toMatchObject({ actorName: host.displayName });
    expect(String(sent[0].data.link)).toContain(`/parties/${groupId}`);
  });

  it('un administrateur qui n’est pas l’hôte annule : l’hôte et les inscrits sont prévenus, pas l’administrateur', async () => {
    const card = await propose(host, { title: 'Annulée par l’admin', capacity: 4 });
    await signUp(guest, card.seance!.id).expect(201);
    const before = h.email.calls.length;

    await cancel(admin, card.id).expect(201);

    expect((await eventRow(card.id)).cancelledAt).not.toBeNull();
    const sent = cancelMails(before, 'Annulée par l’admin');
    expect(sent.map((c) => c.to).sort()).toEqual([host.email, guest.email].sort());
    expect(sent[0].data).toMatchObject({ actorName: admin.displayName });
  });

  it('une conjonction à sondage : le sondage est clos, la carte n’en porte plus, vote / date / prolongation sont refusés (400)', async () => {
    const card = await proposePoll(host);
    const poll = card.poll!;
    await guest.agent
      .post(`/parties/${groupId}/poll/${poll.id}/vote`)
      .send({ optionId: poll.options[0].id, answer: 'YES' })
      .expect(201);

    await cancel(host, card.id).expect(201);

    const closed = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: poll.id } });
    expect(closed.status).toBe('CLOSED');
    const seen = await cardFor(third, card.id);
    expect(seen.cancelled).toBe(true);
    expect(seen.poll).toBeNull();

    const vote = await third.agent
      .post(`/parties/${groupId}/poll/${poll.id}/vote`)
      .send({ optionId: poll.options[0].id, answer: 'YES' });
    expect(vote.status).toBe(400);
    const choose = await host.agent
      .patch(`/parties/${groupId}/poll/${poll.id}/choose`)
      .send({ optionId: poll.options[0].id });
    expect(choose.status).toBe(400);
    const extend = await host.agent
      .patch(`/parties/${groupId}/poll/${poll.id}/extend`)
      .send({ expiresAt: isoDay(7) });
    expect(extend.status).toBe(400);
    expect(await h.prisma.pollVote.count({ where: { optionId: poll.options[0].id } })).toBe(1);
    const seance = await h.prisma.seance.findUniqueOrThrow({ where: { id: card.seance!.id } });
    expect(seance.startDate).toBeNull();
  });

  it('plus aucune action : s’inscrire, se désinscrire, réserver, accepter, modifier → 400 « annulée », rien n’est écrit', async () => {
    const card = await propose(host, { title: 'Figée', capacity: 5 });
    const seanceId = card.seance!.id;
    await signUp(guest, seanceId).expect(201);
    await reserve(host, seanceId, reservedUser.id).expect(201);
    await cancel(host, card.id).expect(201);
    const before = await rows(seanceId);

    const refusals = [
      await signUp(third, seanceId),
      await guest.agent.delete(`/scenarios/seances/${seanceId}/inscription`),
      await reserve(host, seanceId, third.id),
      await host.agent.delete(`/scenarios/seances/${seanceId}/reservations/${reservedUser.id}`),
      await reservedUser.agent.patch(`/scenarios/seances/${seanceId}/inscription/accept`),
      await host.agent
        .patch(`/parties/${groupId}/events/${card.id}`)
        .send({ title: 'Renommée', date: isoDay(9), slot: 'MORNING', capacity: 5 }),
    ];
    for (const res of refusals) {
      expect(res.status).toBe(400);
      expect(message(res)).toBe(CANCELLED);
    }
    expect(await rows(seanceId)).toEqual(before);
    expect((await eventRow(card.id)).title).toBe('Figée');
  });

  it('une conjonction annulée sort des calendriers, du signal de réservation, des rappels et de la prochaine date', async () => {
    const { id: soloId } = await h.createPartie(
      admin,
      'CAMPAGNE_EPISODIQUE',
      'annul-solo',
      'ralliement',
    );
    for (const who of [host, guest, reservedUser]) await h.addMember(soloId, who);
    const create = async (title: string, day: number) =>
      body<CardLike>(
        await host.agent
          .post(`/parties/${soloId}/events`)
          .send({ title, date: isoDay(day), slot: 'EVENING', capacity: 4 })
          .expect(201),
      );
    const cancelled = await create('Rappel annulé', 2);
    const kept = await create('Rappel conservé', 4);
    for (const card of [cancelled, kept]) await signUp(guest, card.seance!.id).expect(201);
    await reserve(host, cancelled.seance!.id, reservedUser.id).expect(201);
    const reservedSignal = async () =>
      body<Record<string, { signals: string[] }>>(
        await reservedUser.agent.get('/me/party-signals').expect(200),
      )[soloId]?.signals ?? [];
    expect(await reservedSignal()).toContain('RESERVATION_A_CONFIRMER');
    expect(await calendarOf(host)).toContain(cancelled.seance!.id);
    const nextDate = async () =>
      body<{ nextSessionDate: string | null }>(
        await host.agent.get(`/parties/${soloId}`).expect(200),
      ).nextSessionDate?.substring(0, 10);
    expect(await nextDate()).toBe(isoDay(2));

    await cancel(host, cancelled.id, soloId).expect(201);

    expect(await calendarOf(host)).not.toContain(cancelled.seance!.id);
    expect(await calendarOf(guest)).not.toContain(cancelled.seance!.id);
    expect(await calendarOf(guest)).toContain(kept.seance!.id);
    expect(await reservedSignal()).not.toContain('RESERVATION_A_CONFIRMER');
    // Prochaine date de la partie : celle de la conjonction conservée, jamais l'annulée.
    expect(await nextDate()).toBe(isoDay(4));

    // Rappel de la veille : les deux séances tombent dans la fenêtre de 24 h ; seule la conservée est rappelée.
    for (const card of [cancelled, kept]) {
      await h.prisma.seance.update({
        where: { id: card.seance!.id },
        data: { startDate: new Date(Date.now() + 2 * 3_600_000), reminderSentAt: null },
      });
    }
    const before = h.email.calls.length;
    await h.app.get(NotificationsService).sendDueReminders();
    const reminders = h.email.calls
      .slice(before)
      .filter((c) => c.template === 'conjonction-reminder');
    expect(reminders.some((c) => c.data.eventTitle === 'Rappel conservé')).toBe(true);
    expect(reminders.some((c) => c.data.eventTitle === 'Rappel annulé')).toBe(false);
  });

  describe('refus (rien n’est écrit, aucun e-mail)', () => {
    it('un membre qui n’est ni l’hôte ni administrateur : 403 ; un étranger et l’administrateur d’un autre groupe : 403 « pas accès »', async () => {
      const card = await propose(host, { title: 'Intouchable' });
      const before = h.email.calls.length;

      const plain = await cancel(third, card.id);
      expect(plain.status).toBe(403);
      expect(message(plain)).toBe(HOST_OR_ADMIN);
      for (const who of [stranger, otherAdmin]) {
        const res = await cancel(who, card.id);
        expect(res.status).toBe(403);
        expect(message(res)).toBe(NO_ACCESS);
      }

      expect((await eventRow(card.id)).cancelledAt).toBeNull();
      expect(cancelMails(before, 'Intouchable')).toEqual([]);
    });

    it('l’événement d’un groupe par la route d’un autre : 404 ; un événement inconnu : 404', async () => {
      const card = await propose(host, { title: 'Chez nous' });

      expect((await cancel(admin, card.id, otherGroupId)).status).toBe(404);
      expect((await cancel(admin, randomUUID())).status).toBe(404);
      expect((await eventRow(card.id)).cancelledAt).toBeNull();
    });

    it('une conjonction passée ou déjà annulée : 400 français, rien ne change', async () => {
      const card = await propose(host, { title: 'Trop tard' });
      await h.prisma.seance.update({
        where: { id: card.seance!.id },
        // Début ET fin : une conjonction passée a sa plage entière dans le passé (Story 47.2).
        data: {
          startDate: new Date(`${isoDay(-2)}T00:00:00.000Z`),
          endDate: new Date(`${isoDay(-2)}T00:00:00.000Z`),
        },
      });
      const past = await cancel(host, card.id);
      expect(past.status).toBe(400);
      expect(message(past)).toBe(PAST);
      expect((await eventRow(card.id)).cancelledAt).toBeNull();

      const other = await propose(host, { title: 'Déjà annulée' });
      await cancel(host, other.id).expect(201);
      const stamp = (await eventRow(other.id)).cancelledAt;
      const again = await cancel(host, other.id);
      expect(again.status).toBe(400);
      expect(message(again)).toBe(CANCELLED);
      expect((await eventRow(other.id)).cancelledAt).toEqual(stamp);
    });

    it('une rencontre isolée (ONE_SHOT) : son administrateur l’annule (Story 42.2), l’annulation d’un membre reste refusée', async () => {
      const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: oneShotId } });

      const res = await cancel(admin, event.id, oneShotId);

      expect(res.status).toBe(201);
      expect((await eventRow(event.id)).cancelledAt).not.toBeNull();
    });
  });

  it('deux annulations simultanées : une seule gagne sous le verrou, l’autre est refusée (400), un seul jeu d’e-mails', async () => {
    const card = await propose(host, { title: 'Course', capacity: 4 });
    await signUp(guest, card.seance!.id).expect(201);
    const before = h.email.calls.length;

    const [a, b] = await Promise.all([cancel(host, card.id), cancel(admin, card.id)]);

    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(cancelMails(before, 'Course').filter((c) => c.to === guest.email)).toHaveLength(1);
  });

  it('une inscription et une annulation simultanées : jamais d’inscription après l’annulation', async () => {
    const card = await propose(host, { title: 'Inscrit ou annulé', capacity: 4 });

    const [signing, cancelling] = await Promise.all([
      signUp(third, card.seance!.id),
      cancel(host, card.id),
    ]);

    expect(cancelling.status).toBe(201);
    expect([201, 400]).toContain(signing.status);
    expect(await h.prisma.inscription.count({ where: { seanceId: card.seance!.id } })).toBe(
      signing.status === 201 ? 1 : 0,
    );
    // Une fois l'annulation validée, plus aucune inscription n'est possible.
    expect((await signUp(guest, card.seance!.id)).status).toBe(400);
  });
});

describe('Ralliement — annuler les conjonctions de qui quitte le groupe (Story 42.3)', () => {
  let h: Harness;
  let admin: TestUser;
  let host: TestUser;
  let guest: TestUser;
  let reservedUser: TestUser;
  let third: TestUser;
  let groupId: string;

  type CardLike = {
    id: string;
    cancelled: boolean;
    seance: { id: string } | null;
    poll: { id: string; options: { id: string }[] } | null;
  };

  const CANCEL_MAIL = 'conjonction-annulee';
  const propose = async (who: TestUser, over: Record<string, unknown> = {}) => {
    const res = await who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title: 'Soirée', date: isoDay(6), slot: 'EVENING', capacity: 6, ...over });
    expect(res.status).toBe(201);
    return body<CardLike>(res);
  };
  const proposePoll = (who: TestUser, over: Record<string, unknown> = {}) =>
    propose(who, {
      date: undefined,
      slot: undefined,
      capacity: null,
      pollOptions: [
        { date: isoDay(8), slot: 'EVENING' },
        { date: isoDay(9), slot: 'MORNING' },
      ],
      pollDeadline: isoDay(5),
      ...over,
    });
  const signUp = (who: TestUser, seanceId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/inscription`);
  const reserve = (who: TestUser, seanceId: string, userId: string) =>
    who.agent.post(`/scenarios/seances/${seanceId}/reservations`).send({ userId });
  const leave = (who: TestUser) => who.agent.delete(`/parties/${groupId}/members/me`);
  const remove = (who: TestUser, targetId: string) =>
    who.agent.delete(`/parties/${groupId}/members/${targetId}`);
  const eventRow = (eventId: string) =>
    h.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const cardFor = async (who: TestUser, eventId: string) =>
    body<CardLike[]>(await who.agent.get(`/parties/${groupId}/events/list`).expect(200)).find(
      (c) => c.id === eventId,
    )!;
  const member = (userId: string) =>
    h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId: groupId } } });
  const cancelMails = (since: number, title: string) =>
    h.email.calls
      .slice(since)
      .filter((c) => c.template === CANCEL_MAIL && c.data.eventTitle === title);
  const setDay = (seanceId: string, day: string) => {
    const date = new Date(`${day}T00:00:00.000Z`);
    return h.prisma.seance.update({
      where: { id: seanceId },
      data: { startDate: date, endDate: date },
    });
  };

  beforeAll(async () => {
    h = await Harness.start();
    [admin, host, guest, reservedUser, third] = await Promise.all([
      h.createUser('qgrp-admin'),
      h.createUser('qgrp-hote'),
      h.createUser('qgrp-invite'),
      h.createUser('qgrp-reserve'),
      h.createUser('qgrp-tiers'),
    ]);
    ({ id: groupId } = await h.createPartie(admin, 'CAMPAGNE_EPISODIQUE', 'qgrp', 'ralliement'));
    for (const who of [guest, reservedUser, third]) await h.addMember(groupId, who);
  });

  afterAll(async () => {
    await h?.close();
  });

  // Le départ est le sujet de chaque scénario : l'hôte est (re)membre avant chacun.
  beforeEach(async () => {
    if (!(await member(host.id))) await h.addMember(groupId, host);
  });

  it('départ volontaire : seules les conjonctions à venir de l’hôte sont annulées (sondage clos), le passé et l’ancienne annulation restent ; e-mail n° 7 aux inscrits, jamais à l’hôte', async () => {
    const upcoming = await propose(host, { title: 'Hôte parti : à venir' });
    const polled = await proposePoll(host, { title: 'Hôte parti : sondage' });
    const past = await propose(host, { title: 'Hôte parti : passée' });
    const already = await propose(host, { title: 'Hôte parti : déjà annulée' });
    const others = await propose(third, { title: 'Hôte parti : celle d’un autre' });
    await signUp(guest, upcoming.seance!.id).expect(201);
    await reserve(host, upcoming.seance!.id, reservedUser.id).expect(201);
    await signUp(guest, past.seance!.id).expect(201);
    await setDay(past.seance!.id, isoDay(-2));
    await signUp(guest, polled.seance!.id).expect(201);
    await signUp(guest, already.seance!.id).expect(201);
    await host.agent.post(`/parties/${groupId}/events/${already.id}/cancel`).expect(201);
    const firstStamp = (await eventRow(already.id)).cancelledAt;
    await signUp(guest, others.seance!.id).expect(201);
    const before = h.email.calls.length;

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      await leave(host).expect(200);
      expect(emit).toHaveBeenCalledWith(partieTopic(groupId));
      expect(emit).toHaveBeenCalledWith(userTopic(host.id));
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await member(host.id)).toBeNull();
    // Annulées dans la même transaction que le départ ; sondage clos.
    expect((await eventRow(upcoming.id)).cancelledAt).not.toBeNull();
    expect((await eventRow(polled.id)).cancelledAt).not.toBeNull();
    const poll = await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: polled.poll!.id } });
    expect(poll.status).toBe('CLOSED');
    // Le passé reste intact, avec son hôte et ses inscrits ; l'ancienne annulation n'est pas réécrite.
    const pastRow = await eventRow(past.id);
    expect(pastRow.cancelledAt).toBeNull();
    expect(pastRow.ownerId).toBe(host.id);
    expect(await h.prisma.inscription.count({ where: { seanceId: past.seance!.id } })).toBe(1);
    expect((await eventRow(already.id)).cancelledAt).toEqual(firstStamp);
    // La conjonction d'un autre hôte ne bouge pas.
    expect((await eventRow(others.id)).cancelledAt).toBeNull();

    // Les autres membres voient l'état « annulée » ; le passé garde son hôte affiché.
    expect((await cardFor(guest, upcoming.id)).cancelled).toBe(true);
    expect((await cardFor(guest, polled.id)).cancelled).toBe(true);
    expect((await cardFor(guest, polled.id)).poll).toBeNull();
    expect((await cardFor(guest, past.id)).cancelled).toBe(false);
    expect((await cardFor(guest, others.id)).cancelled).toBe(false);

    // E-mail n° 7 : confirmés ET places réservées, au nom de l'hôte parti, jamais à lui ; rien pour le reste.
    const sent = cancelMails(before, 'Hôte parti : à venir');
    expect(sent.map((c) => c.to).sort()).toEqual([guest.email, reservedUser.email].sort());
    expect(sent[0].data).toMatchObject({ actorName: host.displayName });
    expect(cancelMails(before, 'Hôte parti : sondage').map((c) => c.to)).toEqual([guest.email]);
    expect(cancelMails(before, 'Hôte parti : passée')).toEqual([]);
    expect(cancelMails(before, 'Hôte parti : déjà annulée')).toEqual([]);
    expect(cancelMails(before, 'Hôte parti : celle d’un autre')).toEqual([]);
    expect(h.email.calls.slice(before).some((c) => c.to === host.email)).toBe(false);
  });

  it('retrait par un administrateur : mêmes annulations, e-mail au nom de l’hôte retiré', async () => {
    const card = await propose(host, { title: 'Hôte retiré' });
    await signUp(guest, card.seance!.id).expect(201);
    const before = h.email.calls.length;

    await remove(admin, host.id).expect(200);

    expect(await member(host.id)).toBeNull();
    expect((await eventRow(card.id)).cancelledAt).not.toBeNull();
    const sent = cancelMails(before, 'Hôte retiré');
    expect(sent.map((c) => c.to)).toEqual([guest.email]);
    expect(sent[0].data).toMatchObject({ actorName: host.displayName });
  });

  it('une conjonction annulée par le départ n’accepte plus rien (inscription refusée)', async () => {
    const card = await propose(host, { title: 'Plus rien' });
    await leave(host).expect(200);

    const res = await signUp(third, card.seance!.id);

    expect(res.status).toBe(400);
  });

  it('un membre qui n’héberge rien part : aucune annulation, aucun e-mail', async () => {
    const card = await propose(third, { title: 'Intacte' });
    const before = h.email.calls.length;

    await leave(guest).expect(200);
    await h.addMember(groupId, guest);

    expect((await eventRow(card.id)).cancelledAt).toBeNull();
    expect(h.email.calls.slice(before).filter((c) => c.template === CANCEL_MAIL)).toEqual([]);
  });

  it('un échec de l’annulation annule tout le départ : adhésion et conjonction intactes, aucun e-mail', async () => {
    const card = await propose(host, { title: 'Départ avorté' });
    await signUp(guest, card.seance!.id).expect(201);
    const before = h.email.calls.length;
    const spy = jest
      .spyOn(h.app.get(PollVoteCleanupService), 'closePollsInTx')
      .mockRejectedValueOnce(new Error('boom'));
    const poll = await proposePoll(host, { title: 'Départ avorté (sondage)' });
    try {
      const res = await leave(host);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }

    expect(await member(host.id)).not.toBeNull();
    expect((await eventRow(card.id)).cancelledAt).toBeNull();
    expect((await eventRow(poll.id)).cancelledAt).toBeNull();
    expect(
      (await h.prisma.sessionPoll.findUniqueOrThrow({ where: { id: poll.poll!.id } })).status,
    ).toBe('OPEN');
    expect(cancelMails(before, 'Départ avorté')).toEqual([]);
  });

  it('le dernier administrateur supprime le groupe : aucune annulation ni e-mail', async () => {
    const { id: soloId } = await h.createPartie(
      third,
      'CAMPAGNE_EPISODIQUE',
      'qgrp-solo',
      'ralliement',
    );
    await h.addMember(soloId, guest);
    const res = await third.agent
      .post(`/parties/${soloId}/events`)
      .send({ title: 'Groupe supprimé', date: isoDay(6), slot: 'EVENING' })
      .expect(201);
    const seanceId = body<CardLike>(res).seance!.id;
    await signUp(guest, seanceId).expect(201);
    const before = h.email.calls.length;

    await third.agent.delete(`/parties/${soloId}/members/me?deleteIfLastAdmin=true`).expect(200);

    expect(cancelMails(before, 'Groupe supprimé')).toEqual([]);
    expect(await h.prisma.partie.count({ where: { id: soloId } })).toBe(0);
  });
});

describe('Ralliement — annuler une soirée isolée (Story 42.2)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let invitee: TestUser;
  let stranger: TestUser;

  type PartieLike = { id: string; status: string };
  type CardLike = { id: string; cancelled: boolean };

  const CANCELLED = 'Cette soirée est annulée : plus rien ne peut y changer';
  const FINISHED = 'Cette soirée est terminée : plus rien ne peut y changer';
  const CANCEL_MAIL = 'conjonction-annulee';
  const message = (res: { body: unknown }) => {
    const m = (res.body as { message: string | string[] }).message;
    return Array.isArray(m) ? m.join(' ') : m;
  };
  const newSoiree = async (name: string) => {
    const { id } = await h.createPartie(host, 'ONE_SHOT', name, 'ralliement');
    await h.addMember(id, guest);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: id } });
    const seance = await h.prisma.seance.findFirstOrThrow({ where: { eventId: event.id } });
    return { id, eventId: event.id, seanceId: seance.id };
  };
  const cancel = (who: TestUser, partieId: string, eventId: string) =>
    who.agent.post(`/parties/${partieId}/events/${eventId}/cancel`);
  const statusOf = async (who: TestUser, id: string) =>
    body<PartieLike>(await who.agent.get(`/parties/${id}`).expect(200)).status;
  const listedStatus = async (who: TestUser, id: string) =>
    body<PartieLike[]>(await who.agent.get('/parties').expect(200)).find((p) => p.id === id)
      ?.status;
  const signalsOf = async (who: TestUser, id: string) =>
    body<Record<string, { status: string; signals: string[] }>>(
      await who.agent.get('/me/party-signals').expect(200),
    )[id];
  const mails = (since: number) =>
    h.email.calls.slice(since).filter((c) => c.template === CANCEL_MAIL);

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, invitee, stranger] = await Promise.all([
      h.createUser('annsoi-hote'),
      h.createUser('annsoi-invite'),
      h.createUser('annsoi-cible'),
      h.createUser('annsoi-etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('l’hôte annule : événement annulé, statut ANNULEE pour tous, invitations et liens révoqués, e-mail n° 7 aux membres et aux invités sans réponse, signal PARTIE_ANNULEE', async () => {
    const { id, eventId } = await newSoiree('annulee');
    await host.agent
      .post(`/parties/${id}/invitations`)
      .send({ inviteeUserId: invitee.id })
      .expect(201);
    const unknown = `inconnu-annsoi-${h.suffix}@test.local`;
    await host.agent
      .post(`/parties/${id}/invitations/by-email`)
      .send({ email: unknown })
      .expect(201);
    const open = body<{ token: string }>(
      await host.agent.post(`/parties/${id}/invite-links`).send({}).expect(201),
    );
    const before = h.email.calls.length;

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    const notify = jest.spyOn(h.app.get(PartiesService), 'notifyPartieSignalsChanged');
    let res: Response;
    try {
      res = await cancel(host, id, eventId);
      expect(res.status).toBe(201);
      expect(emit).toHaveBeenCalledWith(partieTopic(id));
      expect(emit).toHaveBeenCalledWith(userTopic(invitee.id));
      expect(notify).toHaveBeenCalledWith(id, expect.anything());
    } finally {
      emit.mockRestore();
      notify.mockRestore();
    }

    expect(body<CardLike>(res).cancelled).toBe(true);
    expect(
      (await h.prisma.event.findUniqueOrThrow({ where: { id: eventId } })).cancelledAt,
    ).not.toBeNull();
    // Statut distinct de « terminée », au détail comme dans la liste, pour l'hôte comme pour l'invité.
    expect(await statusOf(host, id)).toBe('ANNULEE');
    expect(await statusOf(guest, id)).toBe('ANNULEE');
    expect(await listedStatus(host, id)).toBe('ANNULEE');
    expect(await listedStatus(guest, id)).toBe('ANNULEE');
    // Invitations et liens révoqués.
    const invitations = await h.prisma.invitation.findMany({ where: { partieId: id } });
    expect(invitations.map((i) => i.status)).toEqual(['REVOKED']);
    const links = await h.prisma.inviteLink.findMany({ where: { partieId: id } });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links.every((l) => l.revoked)).toBe(true);
    expect(body<unknown[]>(await invitee.agent.get('/invitations').expect(200))).toEqual([]);
    expect(
      (await invitee.agent.post(`/invite-links/${open.token}/join`)).status,
    ).toBeGreaterThanOrEqual(400);
    // E-mail n° 7 : le membre, l'invité nominatif sans réponse, l'adresse invitée par e-mail — jamais l'hôte.
    const sent = mails(before);
    expect(sent.map((c) => c.to).sort()).toEqual([guest.email, invitee.email, unknown].sort());
    expect(sent[0].data).toMatchObject({
      actorName: host.displayName,
      eventTitle: expect.stringContaining('annulee') as string,
    });
    // Signal d'accueil : seul PARTIE_ANNULEE, pour l'hôte comme pour le membre.
    for (const who of [host, guest]) {
      expect(await signalsOf(who, id)).toEqual({
        role: 'player',
        status: 'ANNULEE',
        signals: ['PARTIE_ANNULEE'],
      });
    }
  });

  it('plus aucune action : invitation, e-mail, lien, acceptation, retrait d’un invité, modification, clore, rouvrir, renommer → 400 « annulée », rien d’écrit', async () => {
    const { id, eventId } = await newSoiree('figee-annulee');
    const nameBefore = (await h.prisma.partie.findUniqueOrThrow({ where: { id } })).name;
    await host.agent
      .post(`/parties/${id}/invitations`)
      .send({ inviteeUserId: invitee.id })
      .expect(201);
    await cancel(host, id, eventId).expect(201);

    const refusals = [
      await host.agent.post(`/parties/${id}/invitations`).send({ inviteeUserId: stranger.id }),
      await host.agent
        .post(`/parties/${id}/invitations/by-email`)
        .send({ email: `refus-annsoi-${h.suffix}@test.local` }),
      await host.agent.post(`/parties/${id}/invite-links`).send({}),
      await host.agent.delete(`/parties/${id}/members/${guest.id}`),
      await host.agent
        .patch(`/parties/${id}/events/${eventId}`)
        .send({ title: 'Trop tard', date: isoDay(3), slot: 'EVENING' }),
      await host.agent.patch(`/parties/${id}/close`),
      await host.agent.patch(`/parties/${id}/reopen`),
      await host.agent.patch(`/parties/${id}`).send({ name: 'Renommée' }),
    ];
    for (const res of refusals) {
      expect(res.status).toBe(400);
      expect(message(res)).toContain(CANCELLED);
    }
    expect(await h.prisma.membership.count({ where: { partieId: id, userId: guest.id } })).toBe(1);
    expect((await h.prisma.event.findUniqueOrThrow({ where: { id: eventId } })).title).not.toBe(
      'Trop tard',
    );
    expect((await h.prisma.partie.findUniqueOrThrow({ where: { id } })).name).toBe(nameBefore);
    // La tentative d'acceptation d'une invitation révoquée est refusée aussi.
    expect(await h.prisma.membership.count({ where: { partieId: id, userId: invitee.id } })).toBe(
      0,
    );
  });

  it('refus : un invité (simple membre) et un étranger → 403 ; rien n’est annulé, aucun e-mail', async () => {
    const { id, eventId } = await newSoiree('intouchable-soiree');
    const before = h.email.calls.length;

    expect((await cancel(guest, id, eventId)).status).toBe(403);
    expect((await cancel(stranger, id, eventId)).status).toBe(403);

    expect(
      (await h.prisma.event.findUniqueOrThrow({ where: { id: eventId } })).cancelledAt,
    ).toBeNull();
    expect(mails(before)).toEqual([]);
    expect(await statusOf(host, id)).toBe('A_VENIR');
  });

  it('soirée passée, close ou déjà annulée : refusée (400) ; l’événement d’une autre partie par la route de celle-ci : 404', async () => {
    const past = await newSoiree('passee-annulation');
    const day = new Date(`${isoDay(-2)}T00:00:00.000Z`);
    await h.prisma.seance.update({
      where: { id: past.seanceId },
      data: { startDate: day, endDate: day, startSlot: 'EVENING', endSlot: 'EVENING' },
    });
    const pastRes = await cancel(host, past.id, past.eventId);
    expect(pastRes.status).toBe(400);
    expect(message(pastRes)).toContain(FINISHED);

    const closed = await newSoiree('close-annulation');
    await host.agent.patch(`/parties/${closed.id}/close`).expect(200);
    const closedRes = await cancel(host, closed.id, closed.eventId);
    expect(closedRes.status).toBe(400);
    expect(message(closedRes)).toContain(FINISHED);

    const twice = await newSoiree('deux-fois');
    await cancel(host, twice.id, twice.eventId).expect(201);
    const again = await cancel(host, twice.id, twice.eventId);
    expect(again.status).toBe(400);
    expect(message(again)).toContain(CANCELLED);

    const other = await newSoiree('autre-soiree');
    expect((await cancel(host, other.id, twice.eventId)).status).toBe(404);
    for (const s of [past, closed, other]) {
      expect(
        (await h.prisma.event.findUniqueOrThrow({ where: { id: s.eventId } })).cancelledAt,
      ).toBeNull();
    }
  });

  it('une soirée à sondage : le sondage est clos ; la soirée annulée sort du calendrier', async () => {
    const { id, eventId } = await newSoiree('sondage-annule');
    const card = body<{ poll: { id: string } | null }>(
      await host.agent
        .patch(`/parties/${id}/events/${eventId}`)
        .send({
          title: 'Sondage',
          pollOptions: [
            { date: isoDay(8), slot: 'EVENING' },
            { date: isoDay(9), slot: 'MORNING' },
          ],
          pollDeadline: isoDay(5),
        })
        .expect(200),
    );
    expect(card.poll).not.toBeNull();

    await cancel(host, id, eventId).expect(201);

    const poll = await h.prisma.sessionPoll.findFirstOrThrow({ where: { partieId: id } });
    expect(poll.status).toBe('CLOSED');
    expect(await statusOf(guest, id)).toBe('ANNULEE');
  });

  it('un groupe et une quête de JDR gardent leurs statuts : aucun n’est jamais ANNULEE', async () => {
    const { id: groupId } = await h.createPartie(
      host,
      'CAMPAGNE_EPISODIQUE',
      'groupe-statut',
      'ralliement',
    );
    expect(await statusOf(host, groupId)).toBe('A_VENIR');
    const { id: jdrId } = await h.createPartie(host, 'ONE_SHOT', 'jdr-statut');
    expect(await statusOf(host, jdrId)).not.toBe('ANNULEE');
  });
});

describe('Ralliement — retirer de sa liste une partie terminée ou annulée (Story 42.5)', () => {
  let h: Harness;
  let host: TestUser;
  let guest: TestUser;
  let stranger: TestUser;

  type PartieLike = { id: string; status: string };

  const HIDE_REFUSAL = 'Seule une partie terminée ou annulée peut être retirée de votre liste';
  const newSoiree = async (name: string, dated = false) => {
    const { id } = await h.createPartie(host, 'ONE_SHOT', name, 'ralliement');
    await h.addMember(id, guest);
    const event = await h.prisma.event.findFirstOrThrow({ where: { partieId: id } });
    if (dated) {
      await host.agent
        .patch(`/parties/${id}/events/${event.id}`)
        .send({ title: name, date: isoDay(4), slot: 'EVENING' })
        .expect(200);
    }
    return { id, eventId: event.id };
  };
  const hide = (who: TestUser, id: string) => who.agent.put(`/parties/${id}/hidden`);
  const listed = async (who: TestUser) =>
    body<PartieLike[]>(await who.agent.get('/parties').expect(200)).map((p) => p.id);
  const listedByRole = async (who: TestUser, role: 'mj' | 'player') =>
    body<PartieLike[]>(await who.agent.get(`/parties?role=${role}`).expect(200)).map((p) => p.id);
  const signalIds = async (who: TestUser) =>
    Object.keys(
      body<Record<string, unknown>>(await who.agent.get('/me/party-signals').expect(200)),
    );
  const calendarParties = async (who: TestUser) =>
    body<{ 'mes-seances': { partieId: string }[] }>(
      await who.agent
        .get('/me/calendar')
        .query({ from: isoDay(0), to: isoDay(30) })
        .expect(200),
    )['mes-seances'].map((s) => s.partieId);

  beforeAll(async () => {
    h = await Harness.start();
    [host, guest, stranger] = await Promise.all([
      h.createUser('cache-hote'),
      h.createUser('cache-invite'),
      h.createUser('cache-etranger'),
    ]);
  });

  afterAll(async () => {
    await h?.close();
  });

  it('une soirée close : l’invité la retire — liste, signaux et calendrier la perdent pour lui seul ; l’hôte la garde', async () => {
    const { id } = await newSoiree('close-retiree', true);
    expect(await calendarParties(guest)).toContain(id);
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    expect(await listed(guest)).toContain(id);

    const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
    try {
      expect(body<{ ok: boolean }>(await hide(guest, id).expect(200)).ok).toBe(true);
      expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
    } finally {
      emit.mockRestore();
    }

    expect(await h.prisma.partieHidden.count({ where: { partieId: id } })).toBe(1);
    expect(await listed(guest)).not.toContain(id);
    expect(await listedByRole(guest, 'player')).not.toContain(id);
    expect(await signalIds(guest)).not.toContain(id);
    expect(await calendarParties(guest)).not.toContain(id);
    // L'hôte, lui, la garde partout ; l'invité peut encore la lire par son identifiant.
    expect(await listed(host)).toContain(id);
    expect(await calendarParties(host)).toContain(id);
    await guest.agent.get(`/parties/${id}`).expect(200);
  });

  it('une soirée annulée : retirable par son hôte comme par un invité, sans signal ni entrée de liste ensuite', async () => {
    const { id, eventId } = await newSoiree('annulee-retiree');
    await host.agent.post(`/parties/${id}/events/${eventId}/cancel`).expect(201);
    expect(await signalIds(guest)).toContain(id);

    await hide(guest, id).expect(200);
    await hide(host, id).expect(200);

    for (const who of [guest, host]) {
      expect(await listed(who)).not.toContain(id);
      expect(await signalIds(who)).not.toContain(id);
    }
    expect(await h.prisma.partieHidden.count({ where: { partieId: id } })).toBe(2);
  });

  it('une quête de JDR terminée : son MJ et un joueur la retirent aussi', async () => {
    const { id } = await h.createPartie(host, 'ONE_SHOT', 'jdr-retiree');
    await h.addMember(id, guest);
    await host.agent.patch(`/parties/${id}/close`).expect(200);

    await hide(guest, id).expect(200);
    await hide(host, id).expect(200);

    expect(await listed(guest)).not.toContain(id);
    expect(await listedByRole(host, 'mj')).not.toContain(id);
  });

  it('idempotent : un second retrait ne change rien et n’écrit pas de doublon', async () => {
    const { id } = await newSoiree('deux-fois-retiree');
    await host.agent.patch(`/parties/${id}/close`).expect(200);

    await hide(guest, id).expect(200);
    await hide(guest, id).expect(200);

    expect(await h.prisma.partieHidden.count({ where: { partieId: id, userId: guest.id } })).toBe(
      1,
    );
  });

  it('une partie à venir : refusée (400), rien d’écrit', async () => {
    const { id } = await newSoiree('a-venir-non-retirable', true);

    const res = await hide(guest, id);

    expect(res.status).toBe(400);
    expect(String((res.body as { message: string }).message)).toBe(HIDE_REFUSAL);
    expect(await h.prisma.partieHidden.count({ where: { partieId: id } })).toBe(0);
    expect(await listed(guest)).toContain(id);
  });

  it('un étranger : 403 ; une partie inconnue : 404 — rien d’écrit', async () => {
    const { id } = await newSoiree('etranger-refuse');
    await host.agent.patch(`/parties/${id}/close`).expect(200);

    expect((await hide(stranger, id)).status).toBe(403);
    expect((await hide(stranger, randomUUID())).status).toBe(404);
    expect(await h.prisma.partieHidden.count({ where: { partieId: id } })).toBe(0);
  });

  it('rouvrir une partie close rend la partie à tous ceux qui l’avaient retirée', async () => {
    const { id } = await newSoiree('rouverte', true);
    await host.agent.patch(`/parties/${id}/close`).expect(200);
    await hide(guest, id).expect(200);
    await hide(host, id).expect(200);
    expect(await listed(guest)).not.toContain(id);

    await host.agent.patch(`/parties/${id}/reopen`).expect(200);

    expect(await h.prisma.partieHidden.count({ where: { partieId: id } })).toBe(0);
    expect(await listed(guest)).toContain(id);
    expect(await listed(host)).toContain(id);
    expect(await calendarParties(guest)).toContain(id);
  });
});
