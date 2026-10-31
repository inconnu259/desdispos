import request from 'supertest';
import { AuthService } from '../../src/auth/auth.service';
import {
  RealtimeEventsService,
  partieTopic,
  userTopic,
} from '../../src/realtime/realtime-events.service';
import { Harness, body, isoDay, type TestUser } from './harness';

/**
 * Story 43.2 (AD-11, AD-17) — `DELETE /me` : effacer son compte, mot de passe exigé, en une transaction.
 * Les invitations et liens créés par le compte disparaissent avec lui (cascade existante).
 */
describe('Compte — effacer mon compte (Story 43.2)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await Harness.start();
  });

  afterAll(async () => {
    await h?.close();
  });

  const erase = (who: TestUser, password: string = h.userPassword) =>
    who.agent.delete('/me').send({ password });
  const userExists = async (id: string) => (await h.prisma.user.count({ where: { id } })) === 1;
  const membership = (userId: string, partieId: string) =>
    h.prisma.membership.findUnique({ where: { userId_partieId: { userId, partieId } } });
  const partieExists = async (id: string) => (await h.prisma.partie.count({ where: { id } })) === 1;
  const propose = async (who: TestUser, groupId: string, title: string, day: string) => {
    const res = await who.agent
      .post(`/parties/${groupId}/events`)
      .send({ title, date: day, slot: 'EVENING', capacity: 6 });
    expect(res.status).toBe(201);
    return body<{ id: string; seance: { id: string } }>(res);
  };

  describe('refus', () => {
    it('mauvais mot de passe : 401, rien ne bouge, la session reste ouverte', async () => {
      const user = await h.createUser('eff-faux');
      const { id: groupId } = await h.createPartie(
        user,
        'CAMPAGNE_EPISODIQUE',
        'eff-faux',
        'ralliement',
      );

      await erase(user, 'pas-le-bon').expect(401);

      expect(await userExists(user.id)).toBe(true);
      expect(await partieExists(groupId)).toBe(true);
      expect((await membership(user.id, groupId))?.role).toBe('ADMIN');
      await user.agent.get('/auth/me').expect(200);
    });

    it('mot de passe absent ou vide : 400, rien ne bouge', async () => {
      const user = await h.createUser('eff-vide');

      await user.agent.delete('/me').send({}).expect(400);
      await erase(user, '').expect(400);

      expect(await userExists(user.id)).toBe(true);
    });

    it('sans session : refusé', async () => {
      await request(h.app.getHttpServer())
        .delete('/me')
        .send({ password: h.userPassword })
        .expect(403);
    });

    it('un identifiant en paramètre n’existe pas : DELETE /me/:id ne vise jamais un autre compte', async () => {
      const user = await h.createUser('eff-id');
      const other = await h.createUser('eff-id-autre');

      const res = await user.agent.delete(`/me/${other.id}`).send({ password: h.userPassword });

      expect(res.status).toBe(404);
      expect(await userExists(other.id)).toBe(true);
      expect(await userExists(user.id)).toBe(true);
    });
  });

  describe('effacement', () => {
    it('efface le compte : groupes, parties de JDR, conjonctions, sessions — sans toucher les autres comptes', async () => {
      const [me, admin2, guest, player, gm, bystander] = await Promise.all([
        h.createUser('eff-moi'),
        h.createUser('eff-admin2'),
        h.createUser('eff-invite'),
        h.createUser('eff-joueur'),
        h.createUser('eff-mj'),
        h.createUser('eff-passant'),
      ]);

      // Groupe dont je suis le seul administrateur (avec un membre), et une rencontre isolée.
      const sole = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'eff-seul', 'ralliement');
      await h.addMember(sole.id, guest);
      const evening = await h.createPartie(me, 'ONE_SHOT', 'eff-soiree', 'ralliement');
      // Groupe qui garde un autre administrateur : je suis l'hôte d'une conjonction à venir et d'une passée.
      const shared = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'eff-partage', 'ralliement');
      await h.addMember(shared.id, admin2, 'ADMIN');
      await h.addMember(shared.id, guest);
      const upcoming = await propose(me, shared.id, 'Hôte effacé : à venir', isoDay(6));
      const past = await propose(me, shared.id, 'Hôte effacé : passée', isoDay(7));
      await guest.agent.post(`/scenarios/seances/${upcoming.seance.id}/inscription`).expect(201);
      await h.prisma.seance.update({
        where: { id: past.seance.id },
        data: {
          startDate: new Date(`${isoDay(-2)}T00:00:00.000Z`),
          endDate: new Date(`${isoDay(-2)}T00:00:00.000Z`),
        },
      });
      // Groupe où je ne suis qu'un membre, inscrit à une conjonction d'un autre.
      const joined = await h.createPartie(
        admin2,
        'CAMPAGNE_EPISODIQUE',
        'eff-membre',
        'ralliement',
      );
      await h.addMember(joined.id, me);
      const theirs = await propose(admin2, joined.id, 'Celle d’un autre', isoDay(8));
      await me.agent.post(`/scenarios/seances/${theirs.seance.id}/inscription`).expect(201);
      // Ma partie de JDR (un joueur y a un personnage) ; et une autre où je suis simple joueur.
      const quest = await h.createPartie(me, 'ONE_SHOT', 'eff-quete', 'ryuutama');
      await h.addMember(quest.id, player);
      const character = await h.prisma.character.create({
        data: {
          userId: player.id,
          partieId: quest.id,
          gameSystemId: 'ryuutama',
          sheetData: {},
          derived: {},
        },
      });
      const otherQuest = await h.createPartie(gm, 'ONE_SHOT', 'eff-autre-quete', 'ryuutama');
      await h.addMember(otherQuest.id, me);
      // Une invitation envoyée par moi dans un groupe qui survit.
      await me.agent
        .post(`/parties/${shared.id}/invitations`)
        .send({ inviteeUserId: bystander.id })
        .expect(201);
      // Story 48.1 : deux jeux dans ma Ludothèque (cascade `BoardGame.owner`).
      await me.agent.post('/me/board-games').send({ name: 'Azul' }).expect(201);
      await me.agent.post('/me/board-games').send({ name: 'Skull' }).expect(201);
      expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(2);
      // Story 49.2 : j'apporte mon Azul à la conjonction d'un autre où je suis inscrit (cascade `EventGameBring`).
      const azul = await h.prisma.boardGame.findFirstOrThrow({
        where: { ownerId: me.id, nameKey: 'azul' },
      });
      await me.agent.put(`/events/${theirs.id}/board-games/${azul.id}/bring`).expect(204);
      expect(await h.prisma.eventGameBring.count({ where: { userId: me.id } })).toBe(1);
      // Story 49.5 : une Envie du compte sur une soirée PASSÉE d'un groupe qui survit (la purge applicative ne la voit pas :
      // seule la cascade `EventGameEnvy.user` l'efface) ; celle d'un autre sur la même soirée doit rester.
      const oldEvening = await propose(admin2, joined.id, 'Soirée passée', isoDay(9));
      const longAgo = new Date(`${isoDay(-3)}T00:00:00.000Z`);
      await h.prisma.seance.update({
        where: { id: oldEvening.seance.id },
        data: { startDate: longAgo, endDate: longAgo },
      });
      await h.prisma.eventGameEnvy.create({
        data: { eventId: oldEvening.id, userId: me.id, nameKey: 'azul' },
      });
      await h.prisma.eventGameEnvy.create({
        data: { eventId: oldEvening.id, userId: admin2.id, nameKey: 'azul' },
      });
      // Une seconde session.
      const second = request.agent(h.app.getHttpServer());
      await second
        .post('/auth/login')
        .send({ identifier: me.email, password: h.userPassword })
        .expect(201);
      expect(await h.prisma.userSession.count({ where: { userId: me.id } })).toBe(2);
      const before = h.email.calls.length;

      const emit = jest.spyOn(h.app.get(RealtimeEventsService), 'emit');
      try {
        const res = await erase(me).expect(200);
        expect(body<{ ok: boolean }>(res).ok).toBe(true);
        expect(emit).toHaveBeenCalledWith(partieTopic(shared.id));
        expect(emit).toHaveBeenCalledWith(userTopic(admin2.id));
        expect(emit).toHaveBeenCalledWith(userTopic(guest.id));
        expect(emit).toHaveBeenCalledWith(userTopic(player.id));
      } finally {
        emit.mockRestore();
      }

      // Le compte et ses sessions ont disparu ; les deux sessions sont mortes.
      expect(await userExists(me.id)).toBe(false);
      expect(await h.prisma.userSession.count({ where: { userId: me.id } })).toBe(0);
      await me.agent.get('/auth/me').expect(403);
      await second.get('/auth/me').expect(403);

      // Seul administrateur : groupe et rencontre isolée supprimés avec leurs adhésions.
      expect(await partieExists(sole.id)).toBe(false);
      expect(await partieExists(evening.id)).toBe(false);
      expect(await h.prisma.membership.count({ where: { partieId: sole.id } })).toBe(0);
      // Un administrateur reste : le groupe survit, sans moi ni propriétaire ; ses autres membres sont intacts.
      expect(await partieExists(shared.id)).toBe(true);
      expect(await membership(me.id, shared.id)).toBeNull();
      expect((await membership(admin2.id, shared.id))?.role).toBe('ADMIN');
      expect(await membership(guest.id, shared.id)).not.toBeNull();
      expect(
        (await h.prisma.partie.findUniqueOrThrow({ where: { id: shared.id } })).ownerId,
      ).toBeNull();
      // Conjonction à venir hébergée : annulée ; la passée reste, hôte vidé (« compte supprimé »).
      expect(
        (await h.prisma.event.findUniqueOrThrow({ where: { id: upcoming.id } })).cancelledAt,
      ).not.toBeNull();
      const pastRow = await h.prisma.event.findUniqueOrThrow({ where: { id: past.id } });
      expect(pastRow.cancelledAt).toBeNull();
      expect(pastRow.ownerId).toBeNull();
      // E-mail n° 7 après la validation, au nom de l'hôte effacé, jamais à lui.
      const sent = h.email.calls
        .slice(before)
        .filter(
          (c) =>
            c.template === 'conjonction-annulee' && c.data.eventTitle === 'Hôte effacé : à venir',
        );
      expect(sent.map((c) => c.to)).toContain(guest.email);
      expect(sent[0].data).toMatchObject({ actorName: me.displayName });
      expect(h.email.calls.slice(before).some((c) => c.to === me.email)).toBe(false);
      // Membre simple : mon inscription a disparu, le groupe et la conjonction restent.
      expect(await partieExists(joined.id)).toBe(true);
      expect(await h.prisma.inscription.count({ where: { seanceId: theirs.seance.id } })).toBe(0);
      expect(
        (await h.prisma.event.findUniqueOrThrow({ where: { id: theirs.id } })).cancelledAt,
      ).toBeNull();
      // MJ : sa partie de JDR est supprimée avec les personnages ; le joueur, lui, existe toujours.
      expect(await partieExists(quest.id)).toBe(false);
      expect(await h.prisma.character.count({ where: { id: character.id } })).toBe(0);
      expect(await userExists(player.id)).toBe(true);
      // Joueur d'une autre partie : elle reste, sans moi.
      expect(await partieExists(otherQuest.id)).toBe(true);
      expect(await membership(me.id, otherQuest.id)).toBeNull();
      // Mes invitations disparaissent avec moi (cascade existante).
      expect(await h.prisma.invitation.count({ where: { inviterId: me.id } })).toBe(0);
      // Story 48.1 : ma Ludothèque disparaît avec moi (cascade `BoardGame.owner`).
      expect(await h.prisma.boardGame.count({ where: { ownerId: me.id } })).toBe(0);
      // Story 49.2 : mon apport disparaît avec moi ; la conjonction de l'autre, elle, reste.
      expect(await h.prisma.eventGameBring.count({ where: { eventId: theirs.id } })).toBe(0);
      // Story 49.5 : son Envie d'une soirée passée part avec le compte (cascade) ; celle d'un autre reste.
      expect(await h.prisma.eventGameEnvy.count({ where: { userId: me.id } })).toBe(0);
      expect(
        await h.prisma.eventGameEnvy.count({
          where: { eventId: oldEvening.id, userId: admin2.id },
        }),
      ).toBe(1);
      // Les autres comptes restent connectés et intacts.
      for (const other of [admin2, guest, player, gm, bystander]) {
        expect(await userExists(other.id)).toBe(true);
      }
      await admin2.agent.get('/auth/me').expect(200);
    });

    it('un échec en cours de route annule tout : compte, groupes et parties intacts', async () => {
      const me = await h.createUser('eff-echec');
      const group = await h.createPartie(me, 'CAMPAGNE_EPISODIQUE', 'eff-echec-g', 'ralliement');
      const quest = await h.createPartie(me, 'ONE_SHOT', 'eff-echec-q', 'ryuutama');
      const spy = jest
        .spyOn(h.app.get(AuthService), 'revokeSessions')
        .mockRejectedValueOnce(new Error('panne'));
      try {
        await erase(me).expect(500);
      } finally {
        spy.mockRestore();
      }

      expect(await userExists(me.id)).toBe(true);
      expect(await partieExists(group.id)).toBe(true);
      expect(await partieExists(quest.id)).toBe(true);
      expect((await membership(me.id, group.id))?.role).toBe('ADMIN');
      await me.agent.get('/auth/me').expect(200);
    });
  });
});
