import { ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

// AuthService -> import RUNTIME (pas `import type`) de THEMES depuis @master-jdr/shared (ESM, non
// transformé par ts-jest) — même piège déjà documenté pour GAME_SYSTEMS/@master-jdr/game-rules et
// pour update-theme.dto.ts (Story 28.4, revue de code).
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteLinksService } from '../invitations/invite-links.service';
import { EmailService } from '../email/email.service';
import { PartiesService } from '../parties/parties.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { anyOf, callArg, objectLike, stringLike } from '../common/test-utils/jest-typed';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByEmailOrPseudo' | 'findByEmail' | 'create'>>;
  let tx: {
    user: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    passwordResetToken: { updateMany: jest.Mock };
    userSession: { findMany: jest.Mock; deleteMany: jest.Mock };
    session: { deleteMany: jest.Mock };
    emailChangeToken: { updateMany: jest.Mock };
    emailChangeRollbackToken: { updateMany: jest.Mock; create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    userSession: { upsert: jest.Mock; deleteMany: jest.Mock };
    emailChangeToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    emailChangeRollbackToken: { findUnique: jest.Mock };
  };
  let inviteLinks: { consumeLink: jest.Mock };
  let email: { sendMail: jest.Mock };
  let realtimeEvents: { emit: jest.Mock };
  let parties: { notifyPartieSignalsChanged: jest.Mock };

  const fakeUser = {
    id: 'u1',
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    passwordHash: 'HASH',
    role: 'USER' as const,
    createdAt: new Date(),
    theme: null,
    mustResetPassword: false,
    partiesSort: 'urgence',
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    calendarLayersSetAt: null,
    calendarLayers: [],
  };

  beforeEach(() => {
    users = {
      findByEmailOrPseudo: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    tx = {
      user: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.c',
          pseudo: 'alice',
          passwordHash: 'NEW_HASH',
          role: 'USER',
          createdAt: new Date(),
        }),
        findUnique: jest.fn(),
      },
      passwordResetToken: {
        updateMany: jest.fn(),
      },
      userSession: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      session: { deleteMany: jest.fn() },
      emailChangeToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      emailChangeRollbackToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
    };
    // $transaction exécute le callback avec notre `tx` mocké.
    prisma = {
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      userSession: { upsert: jest.fn(), deleteMany: jest.fn() },
      emailChangeToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      emailChangeRollbackToken: { findUnique: jest.fn() },
    };
    inviteLinks = {
      consumeLink: jest.fn().mockResolvedValue({ partieId: 'p1', partie: { ownerId: 'mj1' } }),
    };
    email = { sendMail: jest.fn().mockResolvedValue({ ok: true }) };
    realtimeEvents = { emit: jest.fn() };
    parties = { notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      users as unknown as UsersService,
      prisma as unknown as PrismaService,
      inviteLinks as unknown as InviteLinksService,
      email as unknown as EmailService,
      realtimeEvents as unknown as RealtimeEventsService,
      parties as unknown as PartiesService,
    );
  });

  describe('validateUser', () => {
    it('renvoie null si identifiant (email ou pseudo) inconnu', async () => {
      users.findByEmailOrPseudo.mockResolvedValue(null);
      expect(await service.validateUser('x@y.z', 'pw')).toBeNull();
    });

    it('identifiant inconnu : vérifie quand même un hash argon2 (durée de réponse indiscernable)', async () => {
      users.findByEmailOrPseudo.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$factice');
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      expect(await service.validateUser('inconnu', 'pw')).toBeNull();
      expect(argon2.verify).toHaveBeenCalledWith(expect.any(String), 'pw');
    });

    it('renvoie null si mauvais mot de passe', async () => {
      users.findByEmailOrPseudo.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      expect(await service.validateUser('a@b.c', 'wrong')).toBeNull();
    });

    it("renvoie l'utilisateur sans le hash si mot de passe correct, via l'email", async () => {
      users.findByEmailOrPseudo.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const result = await service.validateUser('a@b.c', 'good');
      expect(result).toMatchObject({
        id: 'u1',
        email: 'a@b.c',
        pseudo: 'alice',
      });
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it("renvoie l'utilisateur sans le hash si mot de passe correct, via le pseudo", async () => {
      users.findByEmailOrPseudo.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const result = await service.validateUser('alice', 'good');
      expect(users.findByEmailOrPseudo).toHaveBeenCalledWith('alice');
      expect(result).toMatchObject({ id: 'u1', pseudo: 'alice' });
    });

    it('hash stocké invalide/corrompu (argon2.verify lève) → renvoie null plutôt que de laisser planter la requête', async () => {
      users.findByEmailOrPseudo.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('pwhash must be a argon2 hash'));
      await expect(service.validateUser('a@b.c', 'anything')).resolves.toBeNull();
    });
  });

  describe('register', () => {
    it("crée le compte, consomme le lien et renvoie l'utilisateur sans le hash", async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      const result = await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      expect(inviteLinks.consumeLink).toHaveBeenCalledWith(tx, 'tok', 'u1');
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result).toMatchObject({ pseudo: 'alice' });
    });

    it('AC8 (Story 30.4) : defaultCalendarLayers jamais undefined — compte tout juste créé, jeu par défaut appliqué', async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      const result = await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      expect(result.defaultCalendarLayers).toBeDefined();
      expect(result.defaultCalendarLayers.length).toBeGreaterThan(0);
    });

    it('bug fix : émet un événement temps réel scopé sur la Partie rejointe, après la transaction', async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('Story 39.3 : notifie les signaux de la partie rejointe avec son propriétaire, après la transaction', async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      // Ordre observé : la notification ne doit partir qu'APRÈS la résolution de la transaction (un
      // appel placé dans son callback la ferait précéder 'transaction résolue').
      const ordre: string[] = [];
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => {
        const resultat = await cb(tx);
        ordre.push('transaction résolue');
        return resultat;
      });
      parties.notifyPartieSignalsChanged.mockImplementation(() => {
        ordre.push('notification');
        return Promise.resolve();
      });
      await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
      expect(ordre).toEqual(['transaction résolue', 'notification']);
    });

    it('renseigne displayName au pseudo à la création (AD-1, deuxième point d’écriture obligatoire)', async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      expect(tx.user.create).toHaveBeenCalledWith({
        data: objectLike({
          email: 'a@b.c',
          pseudo: 'alice',
          displayName: 'alice',
        }),
      });
    });

    it('tire un thème au hasard parmi THEMES à la création (revue de code Story 28.4)', async () => {
      tx.user.create.mockResolvedValue(fakeUser);
      await service.register({
        email: 'a@b.c',
        pseudo: 'alice',
        password: 'password123',
        token: 'tok',
      });
      const data = callArg<{ data: { theme: string } }>(tx.user.create).data;
      expect(['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre']).toContain(data.theme);
    });

    it('lève ConflictException si email/pseudo déjà pris (P2002)', async () => {
      tx.user.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.register({
          email: 'a@b.c',
          pseudo: 'alice',
          password: 'password123',
          token: 'tok',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('requestPasswordReset', () => {
    it('e-mail correspondant à un compte → crée un PasswordResetToken (+24h, tokenHash haché, jamais le secret) et envoie l’e-mail', async () => {
      users.findByEmail.mockResolvedValue(fakeUser);
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'r1' });
      (argon2.hash as jest.Mock).mockResolvedValue('SECRET_HASH');
      const before = Date.now();
      const result = await service.requestPasswordReset('a@b.c');
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const createArgs = callArg<{
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }>(prisma.passwordResetToken.create);
      expect(createArgs.data.userId).toBe('u1');
      expect(createArgs.data.tokenHash).toBe('SECRET_HASH');
      expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
      expect(email.sendMail).toHaveBeenCalledWith(
        'password-reset',
        'a@b.c',
        objectLike({
          link: stringLike('/reset-password/r1.'),
        }),
      );
      // Le secret embarqué dans le lien n'est jamais le tokenHash stocké en base (AC1).
      const link = callArg<{ link: string }>(email.sendMail, 0, 2).link;
      const secret = link.split('/reset-password/r1.')[1];
      expect(secret).not.toBe('SECRET_HASH');
      expect(secret.length).toBeGreaterThan(0);
      expect(result).toEqual({ ok: true });
      expect(prisma.passwordResetToken.count).toHaveBeenCalledWith({
        where: { userId: 'u1', createdAt: { gt: anyOf(Date) } },
      });
    });

    it('e-mail sans compte correspondant → aucun token créé, aucun e-mail envoyé, renvoie quand même { ok: true } (AC1)', async () => {
      users.findByEmail.mockResolvedValue(null);
      const result = await service.requestPasswordReset('inconnu@x.y');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.count).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('sous le seuil de limitation par e-mail (4 tokens récents) → token créé et e-mail envoyé normalement (AC2)', async () => {
      users.findByEmail.mockResolvedValue(fakeUser);
      prisma.passwordResetToken.count.mockResolvedValue(4);
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'r1' });
      (argon2.hash as jest.Mock).mockResolvedValue('SECRET_HASH');
      const result = await service.requestPasswordReset('a@b.c');
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      expect(email.sendMail).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true });
    });

    it('seuil de limitation par e-mail atteint (5 tokens récents) → aucun token créé, aucun e-mail envoyé, renvoie quand même { ok: true } (AC2, anti-énumération préservée)', async () => {
      users.findByEmail.mockResolvedValue(fakeUser);
      prisma.passwordResetToken.count.mockResolvedValue(5);
      const result = await service.requestPasswordReset('a@b.c');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('recordSession', () => {
    it('crée une ligne UserSession (userId, sid) via upsert (sid @unique, idempotent en cas de retry)', async () => {
      await service.recordSession('u1', 'sess1');
      expect(prisma.userSession.upsert).toHaveBeenCalledWith({
        where: { sid: 'sess1' },
        create: { userId: 'u1', sid: 'sess1' },
        update: { userId: 'u1' },
      });
    });
  });

  describe('forgetSession', () => {
    it('supprime la ligne UserSession correspondant au sid (deleteMany, idempotent)', async () => {
      await service.forgetSession('sess1');
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { sid: 'sess1' },
      });
    });
  });

  describe('resetPassword', () => {
    const validRecord = {
      id: 'r1',
      userId: 'u1',
      tokenHash: 'STORED_HASH',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    it('token composite valide (id connu, secret correct) → vérifie via argon2.verify hors transaction, réclame atomiquement, met à jour le mot de passe puis invalide les sessions actives (Session + UserSession), dans la même transaction limitée au claim+update+invalidation', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      tx.userSession.findMany.mockResolvedValue([{ sid: 's1' }, { sid: 's2' }]);

      await service.resetPassword('r1.secretvalue', 'newpassword123');

      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
      expect(argon2.verify).toHaveBeenCalledWith('STORED_HASH', 'secretvalue');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', usedAt: null, expiresAt: { gt: anyOf(Date) } },
        data: { usedAt: anyOf(Date) },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'NEW_HASH', mustResetPassword: false },
      });
      expect(tx.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { sid: true },
      });
      expect(tx.session.deleteMany).toHaveBeenCalledWith({
        where: { sid: { in: ['s1', 's2'] } },
      });
      expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(email.sendMail).toHaveBeenCalledWith('password-changed', 'a@b.c', {});
    });

    it('deferred-work (2026-08-25) : invalide aussi tout autre PasswordResetToken non utilisé du même utilisateur (token fuité plus ancien)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      tx.userSession.findMany.mockResolvedValue([]);

      await service.resetPassword('r1.secretvalue', 'newpassword123');

      expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', usedAt: null, expiresAt: { gt: anyOf(Date) } },
        data: { usedAt: anyOf(Date) },
      });
      expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: anyOf(Date) },
      });
    });

    it('aucune session active (UserSession.findMany vide) → invalidation en no-op, reset réussit normalement', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      tx.userSession.findMany.mockResolvedValue([]);

      await expect(
        service.resetPassword('r1.secretvalue', 'newpassword123'),
      ).resolves.toBeUndefined();

      expect(tx.session.deleteMany).toHaveBeenCalledWith({
        where: { sid: { in: [] } },
      });
      expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    it('token sans séparateur "." (format invalide) → NotFoundException, aucune requête DB', async () => {
      await expect(
        service.resetPassword('nosecretmarker', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('id inconnu (findUnique → null) → NotFoundException, mot de passe non modifié, transaction jamais ouverte', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword('unknown.secretvalue', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.passwordResetToken.updateMany).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('secret incorrect (argon2.verify → false) → NotFoundException, la réclamation atomique (updateMany) n’est jamais appelée, transaction jamais ouverte', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(
        service.resetPassword('r1.wrongsecret', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Garde anti-brûlage : un mauvais secret ne doit jamais marquer le token comme utilisé,
      // sinon une tentative ratée invaliderait le vrai lien de l'utilisateur légitime.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.passwordResetToken.updateMany).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('token déjà utilisé (usedAt non nul) → NotFoundException avant toute vérification du secret', async () => {
      const verifyCallsBefore = (argon2.verify as jest.Mock).mock.calls.length;
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: new Date(),
      });
      await expect(
        service.resetPassword('r1.secretvalue', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((argon2.verify as jest.Mock).mock.calls.length).toBe(verifyCallsBefore);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('token expiré (expiresAt dans le passé) → NotFoundException avant toute vérification du secret', async () => {
      const verifyCallsBefore = (argon2.verify as jest.Mock).mock.calls.length;
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword('r1.secretvalue', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((argon2.verify as jest.Mock).mock.calls.length).toBe(verifyCallsBefore);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('réclamation atomique échoue malgré secret valide (course concurrente, count: 0) → NotFoundException, mot de passe non modifié', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.resetPassword('r1.secretvalue', 'newpassword123'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyPassword (Story 43.2)', () => {
    it('mot de passe correct → résolu, rien d’écrit', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: 'STORED_HASH' });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.verifyPassword('u1', 'bon')).resolves.toBeUndefined();

      expect(argon2.verify).toHaveBeenCalledWith('STORED_HASH', 'bon');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('mot de passe incorrect → UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: 'STORED_HASH' });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyPassword('u1', 'faux')).rejects.toThrow('Mot de passe incorrect');
    });

    it('hash illisible (argon2 lève) → traité comme incorrect, jamais un 500', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: 'N_IMPORTE_QUOI' });
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('invalid hash'));

      await expect(service.verifyPassword('u1', 'bon')).rejects.toThrow('Mot de passe incorrect');
    });

    it('compte introuvable → NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyPassword('u1', 'bon')).rejects.toThrow('Compte introuvable');
    });
  });

  describe('changePassword', () => {
    const currentUser = {
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'STORED_HASH',
    };

    it('mot de passe courant correct → hash mis à jour, autres sessions révoquées (exceptSid préservé), e-mail envoyé', async () => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      tx.userSession.findMany.mockResolvedValue([{ sid: 's2' }]);

      const result = await service.changePassword('u1', 'currentpw', 'newpassword123', 's1');

      expect(result).toEqual({ ok: true });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
      expect(argon2.verify).toHaveBeenCalledWith('STORED_HASH', 'currentpw');
      expect(argon2.hash).toHaveBeenCalledWith('newpassword123');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'NEW_HASH' },
      });
      expect(tx.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', sid: { not: 's1' } },
        select: { sid: true },
      });
      expect(tx.session.deleteMany).toHaveBeenCalledWith({
        where: { sid: { in: ['s2'] } },
      });
      expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', sid: { not: 's1' } },
      });
      expect(email.sendMail).toHaveBeenCalledWith('password-changed', 'a@b.c', {});
    });

    it('mot de passe courant incorrect → UnauthorizedException, rien de modifié, transaction jamais ouverte, aucun e-mail', async () => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('u1', 'wrongpw', 'newpassword123', 's1')).rejects.toThrow(
        'Mot de passe actuel incorrect',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('deferred-work (2026-08-25) : compte supprimé entre le findUnique et la transaction (P2025) → NotFoundException, pas de 500 brut', async () => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2025' });

      await expect(
        service.changePassword('u1', 'currentpw', 'newpassword123', 's1'),
      ).rejects.toThrow('Compte introuvable');
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('hash stocké invalide/corrompu (argon2.verify lève) → traité comme incorrect, rien de modifié', async () => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('pwhash must be a argon2 hash'));

      await expect(
        service.changePassword('u1', 'anything', 'newpassword123', 's1'),
      ).rejects.toThrow('Mot de passe actuel incorrect');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('compte introuvable (findUnique → null) → NotFoundException, aucune vérification argon2', async () => {
      const verifyCallsBefore = (argon2.verify as jest.Mock).mock.calls.length;
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('gone', 'anything', 'newpassword123', 's1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((argon2.verify as jest.Mock).mock.calls.length).toBe(verifyCallsBefore);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Revue de code : exceptSid vide (chaîne vide) → toujours traité comme « une session à exclure », jamais comme « tout révoquer »', async () => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('NEW_HASH');
      tx.userSession.findMany.mockResolvedValue([]);

      await service.changePassword('u1', 'currentpw', 'newpassword123', '');

      expect(tx.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', sid: { not: '' } },
        select: { sid: true },
      });
      expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', sid: { not: '' } },
      });
    });
  });

  describe('requestEmailChange', () => {
    const currentUser = {
      id: 'u1',
      email: 'old@b.c',
      passwordHash: 'STORED_HASH',
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('TOKEN_HASH');
      users.findByEmail.mockResolvedValue(null);
      prisma.emailChangeToken.create.mockResolvedValue({ id: 'tok1' });
    });

    it('mot de passe correct, adresse libre → invalide les anciens jetons, crée le nouveau, envoie les 2 e-mails', async () => {
      const result = await service.requestEmailChange('u1', 'currentpw', 'new@b.c');

      expect(result).toEqual({ ok: true });
      expect(argon2.verify).toHaveBeenCalledWith('STORED_HASH', 'currentpw');
      expect(users.findByEmail).toHaveBeenCalledWith('new@b.c');
      expect(prisma.emailChangeToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: anyOf(Date) },
      });
      expect(prisma.emailChangeToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          newEmail: 'new@b.c',
          tokenHash: 'TOKEN_HASH',
          expiresAt: anyOf(Date),
        },
      });
      expect(email.sendMail).toHaveBeenCalledWith('email-change-confirm', 'new@b.c', {
        link: stringLike('/confirm-email-change/tok1.'),
      });
      expect(email.sendMail).toHaveBeenCalledWith('email-change-notice', 'old@b.c', {});
    });

    it('mot de passe courant incorrect → UnauthorizedException, rien de créé, aucun e-mail', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.requestEmailChange('u1', 'wrongpw', 'new@b.c')).rejects.toThrow(
        'Mot de passe actuel incorrect',
      );
      expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('nouvelle adresse identique à l’adresse actuelle → ConflictException, rien de créé', async () => {
      await expect(service.requestEmailChange('u1', 'currentpw', 'old@b.c')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
    });

    it('nouvelle adresse déjà prise par un autre compte → ConflictException, rien de créé', async () => {
      users.findByEmail.mockResolvedValue({ id: 'other' } as never);

      await expect(service.requestEmailChange('u1', 'currentpw', 'new@b.c')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
    });

    it('limite de fréquence atteinte → { ok: true } silencieux, rien de créé, aucun e-mail', async () => {
      prisma.emailChangeToken.count.mockResolvedValue(5);

      const result = await service.requestEmailChange('u1', 'currentpw', 'new@b.c');

      expect(result).toEqual({ ok: true });
      expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('compte introuvable → NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.requestEmailChange('gone', 'currentpw', 'new@b.c'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revue de code : adresse identique à la casse près (OLD@B.C vs old@b.c) → ConflictException, contournement de casse impossible', async () => {
      await expect(service.requestEmailChange('u1', 'currentpw', 'OLD@B.C')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.emailChangeToken.create).not.toHaveBeenCalled();
    });

    it('revue de code : adresse normalisée (trim + minuscules) avant vérification d’unicité et stockage', async () => {
      const result = await service.requestEmailChange('u1', 'currentpw', '  New@B.C  ');

      expect(result).toEqual({ ok: true });
      expect(users.findByEmail).toHaveBeenCalledWith('new@b.c');
      expect(prisma.emailChangeToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          newEmail: 'new@b.c',
          tokenHash: 'TOKEN_HASH',
          expiresAt: anyOf(Date),
        },
      });
      expect(email.sendMail).toHaveBeenCalledWith('email-change-confirm', 'new@b.c', {
        link: stringLike('/confirm-email-change/tok1.'),
      });
    });
  });

  describe('confirmEmailChange', () => {
    const validRecord = {
      id: 'tok1',
      userId: 'u1',
      newEmail: 'new@b.c',
      tokenHash: 'STORED_HASH',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
    const currentUser = { id: 'u1', email: 'old@b.c', passwordHash: 'X' };

    it('token valide → adresse remplacée, EmailChangeRollbackToken créé (oldEmail = adresse avant update), e-mail de rollback envoyé', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue(validRecord);
      tx.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('ROLLBACK_HASH');
      tx.emailChangeToken.updateMany.mockResolvedValue({ count: 1 });
      tx.emailChangeRollbackToken.create.mockResolvedValue({ id: 'rb1' });

      const result = await service.confirmEmailChange('tok1.secretvalue');

      expect(result).toEqual({ ok: true });
      expect(argon2.verify).toHaveBeenCalledWith('STORED_HASH', 'secretvalue');
      expect(tx.emailChangeToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'tok1',
          usedAt: null,
          expiresAt: { gt: anyOf(Date) },
        },
        data: { usedAt: anyOf(Date) },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { email: 'new@b.c' },
      });
      expect(tx.emailChangeRollbackToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          oldEmail: 'old@b.c',
          tokenHash: 'ROLLBACK_HASH',
          expiresAt: anyOf(Date),
        },
      });
      expect(email.sendMail).toHaveBeenCalledWith('email-change-rollback-available', 'old@b.c', {
        link: stringLike('/rollback-email-change/rb1.'),
      });
    });

    it('token inconnu → NotFoundException, aucune écriture', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue(null);

      await expect(service.confirmEmailChange('unknown.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('token déjà utilisé → NotFoundException avant toute vérification du secret', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: new Date(),
      });

      await expect(service.confirmEmailChange('tok1.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('token expiré → NotFoundException', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.confirmEmailChange('tok1.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('secret incorrect → NotFoundException, la réclamation atomique n’est jamais appelée', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue(validRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.confirmEmailChange('tok1.wrongsecret')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('adresse prise entre-temps par un autre compte (P2002) → ConflictException propre, pas de 500 brut', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue(validRecord);
      tx.user.findUnique.mockResolvedValue(currentUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.emailChangeToken.updateMany.mockResolvedValue({ count: 1 });
      tx.user.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.confirmEmailChange('tok1.secretvalue')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('revue de code : compte supprimé entre la demande et la confirmation → NotFoundException, aucun e-mail', async () => {
      prisma.emailChangeToken.findUnique.mockResolvedValue(validRecord);
      tx.user.findUnique.mockResolvedValue(null);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.emailChangeToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.confirmEmailChange('tok1.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('rollbackEmailChange', () => {
    const validRollbackRecord = {
      id: 'rb1',
      userId: 'u1',
      oldEmail: 'old@b.c',
      tokenHash: 'STORED_HASH',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    it('token valide → adresse restaurée, mustResetPassword: true, toutes les sessions révoquées (sans exceptSid), e-mail envoyé', async () => {
      prisma.emailChangeRollbackToken.findUnique.mockResolvedValue(validRollbackRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.emailChangeRollbackToken.updateMany.mockResolvedValue({ count: 1 });
      tx.userSession.findMany.mockResolvedValue([{ sid: 's1' }]);

      const result = await service.rollbackEmailChange('rb1.secretvalue');

      expect(result).toEqual({ ok: true });
      expect(tx.emailChangeRollbackToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rb1', usedAt: null, expiresAt: { gt: anyOf(Date) } },
        data: { usedAt: anyOf(Date) },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { email: 'old@b.c', mustResetPassword: true },
      });
      // revokeSessions() sans exceptSid → où porte uniquement sur userId (toutes les sessions).
      expect(tx.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { sid: true },
      });
      expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(email.sendMail).toHaveBeenCalledWith(
        'email-change-rolled-back',
        'old@b.c',
        objectLike({ link: anyOf(String) }),
      );
    });

    it('token inconnu/expiré/déjà utilisé/secret invalide → NotFoundException, aucune écriture', async () => {
      prisma.emailChangeRollbackToken.findUnique.mockResolvedValue(null);

      await expect(service.rollbackEmailChange('unknown.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('revue de code : compte supprimé entre l’émission du jeton de rollback et son usage (P2025) → NotFoundException, pas de 500 brut', async () => {
      prisma.emailChangeRollbackToken.findUnique.mockResolvedValue(validRollbackRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.emailChangeRollbackToken.updateMany.mockResolvedValue({ count: 1 });
      tx.user.update.mockRejectedValue({ code: 'P2025' });

      await expect(service.rollbackEmailChange('rb1.secretvalue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('revue de code : oldEmail repris par un autre compte entre la confirmation et le rollback (P2002) → ConflictException propre, pas de 500 brut', async () => {
      prisma.emailChangeRollbackToken.findUnique.mockResolvedValue(validRollbackRecord);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      tx.emailChangeRollbackToken.updateMany.mockResolvedValue({ count: 1 });
      tx.user.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.rollbackEmailChange('rb1.secretvalue')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(email.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('purgeExpiredResetTokens', () => {
    it('supprime les PasswordResetToken dont expiresAt est dépassé (AC1, AC2)', async () => {
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });
      await service.purgeExpiredResetTokens();
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: anyOf(Date) } },
      });
    });

    it('aucun token expiré → se résout normalement sans erreur', async () => {
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.purgeExpiredResetTokens()).resolves.toBeUndefined();
    });
  });
});
