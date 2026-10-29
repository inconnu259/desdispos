import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { InviteLinksService } from './invite-links.service';
import { EmailService } from '../email/email.service';
import type { EventsService } from '../events/events.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { objectLike, stringLike } from '../common/test-utils/jest-typed';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    membership: { findUnique: jest.Mock; upsert: jest.Mock };
    invitation: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let parties: { notifyPartieSignalsChanged: jest.Mock };
  let permissions: { assert: jest.Mock };
  let inviteLinks: { findOrCreateForEmail: jest.Mock };
  let email: { sendMail: jest.Mock };
  let realtimeEvents: { emit: jest.Mock };
  let events: { invitationNotice: jest.Mock; assertIsolatedOpen: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      membership: { findUnique: jest.fn(), upsert: jest.fn() },
      invitation: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    parties = {
      notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined),
    };
    // Story 37.7 : les droits sont décidés par `PermissionService.assert()`, simulé ici.
    permissions = {
      assert: jest.fn().mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          name: 'La Forêt Ancienne',
        }),
      ),
    };
    inviteLinks = {
      findOrCreateForEmail: jest.fn().mockResolvedValue({ token: 'tok123' }),
    };
    email = { sendMail: jest.fn().mockResolvedValue({ ok: true }) };
    realtimeEvents = { emit: jest.fn() };
    events = {
      invitationNotice: jest.fn().mockResolvedValue(null),
      assertIsolatedOpen: jest.fn().mockResolvedValue(undefined),
    };
    service = new InvitationsService(
      prisma as unknown as PrismaService,
      parties as unknown as PartiesService,
      permissions as unknown as PermissionService,
      inviteLinks as unknown as InviteLinksService,
      email as unknown as EmailService,
      realtimeEvents as unknown as RealtimeEventsService,
      events as unknown as EventsService,
    );
  });

  describe('soirée terminée (Story 41.4) — plus d’invitation', () => {
    const finished = () =>
      events.assertIsolatedOpen.mockRejectedValue(
        new BadRequestException('Cette soirée est terminée'),
      );

    it('invite, inviteByEmail : refusés avant toute écriture ni e-mail', async () => {
      finished();
      await expect(service.invite('s1', 'host', 'u1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.inviteByEmail('s1', 'host', 'a@example.com')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.invitation.upsert).not.toHaveBeenCalled();
      expect(inviteLinks.findOrCreateForEmail).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('accept : refusé, aucune appartenance créée ; decline reste possible', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv1',
        inviteeUserId: 'u1',
        partieId: 's1',
        status: 'PENDING',
        partie: {
          id: 's1',
          ownerId: 'host',
          kind: 'ONE_SHOT',
          gameSystemId: 'ralliement',
          closedAt: null,
        },
      });
      finished();

      await expect(service.accept('inv1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();

      await expect(service.decline('inv1', 'u1')).resolves.toEqual({ ok: true });
    });
  });

  describe('soirée isolée (ONE_SHOT, Story 41.3) — e-mail n° 2', () => {
    const SOIREE = {
      id: 's1',
      ownerId: 'host',
      name: 'Marathon',
      kind: 'ONE_SHOT',
      gameSystemId: 'ralliement',
    };
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(SOIREE, 'admin'));
    });
    const users = (known: boolean) =>
      prisma.user.findUnique.mockImplementation(
        ({ where }: { where: { email?: string; id?: string } }) => {
          if (where.email) return Promise.resolve(known ? { id: 'u1', email: where.email } : null);
          if (where.id === 'host') return Promise.resolve({ displayName: 'Marc', pseudo: 'marc' });
          return Promise.resolve({ id: 'u1', email: 'u1@example.com' });
        },
      );

    it('invite par pseudo : e-mail « soiree-invitation » à l’invité, titre, date à fixer, bouton vers l’accueil', async () => {
      users(true);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });
      events.invitationNotice.mockResolvedValue({
        eventTitle: 'Marathon Pandémie',
        startDate: null,
        startSlot: null,
        deadline: null,
        lieu: null,
      });

      await service.invite('s1', 'host', 'u1');

      expect(email.sendMail).toHaveBeenCalledTimes(1);
      expect(email.sendMail).toHaveBeenCalledWith(
        'soiree-invitation',
        'u1@example.com',
        objectLike({
          inviterName: 'Marc',
          eventTitle: 'Marathon Pandémie',
          dateLine: 'date à fixer',
          lieu: null,
          link: stringLike('/'),
        }),
      );
    });

    it('la ligne de date : date fixée écrite, ou « date à voter jusqu’au … » pour un sondage ouvert', async () => {
      users(true);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });

      events.invitationNotice.mockResolvedValue({
        eventTitle: 'Soirée',
        startDate: new Date('2026-11-14T00:00:00.000Z'),
        startSlot: 'EVENING',
        deadline: null,
        lieu: 'Chez Léa',
      });
      await service.invite('s1', 'host', 'u1');
      expect(email.sendMail).toHaveBeenLastCalledWith(
        'soiree-invitation',
        'u1@example.com',
        objectLike({ dateLine: 'samedi 14 novembre (soir)', lieu: 'Chez Léa' }),
      );

      events.invitationNotice.mockResolvedValue({
        eventTitle: 'Soirée',
        startDate: null,
        startSlot: null,
        deadline: new Date('2026-10-25T23:59:59.999Z'),
        lieu: null,
      });
      await service.invite('s1', 'host', 'u1');
      expect(email.sendMail).toHaveBeenLastCalledWith(
        'soiree-invitation',
        'u1@example.com',
        objectLike({ dateLine: "date à voter jusqu'au dimanche 25 octobre" }),
      );
    });

    it('invite par e-mail, compte connu : un seul e-mail (celui de l’invitation), pas le gabarit de groupe', async () => {
      users(true);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });

      const result = await service.inviteByEmail('s1', 'host', 'Ami@Example.com');

      expect(result).toEqual({ ok: true });
      expect(email.sendMail).toHaveBeenCalledTimes(1);
      expect(email.sendMail).toHaveBeenCalledWith(
        'soiree-invitation',
        'u1@example.com',
        expect.anything(),
      );
    });

    it('invite par e-mail, adresse inconnue : lien d’invitation à usage unique dans l’e-mail n° 2', async () => {
      users(false);

      const result = await service.inviteByEmail('s1', 'host', 'ami@example.com');

      expect(result).toEqual({ ok: true });
      expect(email.sendMail).toHaveBeenCalledWith(
        'soiree-invitation',
        'ami@example.com',
        objectLike({ inviterName: 'Marc', link: stringLike('/join/tok123') }),
      );
    });

    it('un échec d’envoi ne fait pas échouer l’invitation par pseudo (journalisé)', async () => {
      users(true);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });
      email.sendMail.mockResolvedValue({ ok: false });

      await expect(service.invite('s1', 'host', 'u1')).resolves.toEqual({ id: 'inv1' });
    });

    it('un groupe ou une quête : aucun e-mail pour une invitation par pseudo, gabarit de groupe inchangé', async () => {
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'g1',
            ownerId: 'admin1',
            name: 'Groupe',
            kind: 'CAMPAGNE_EPISODIQUE',
            gameSystemId: 'ralliement',
          },
          'admin',
        ),
      );
      users(true);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });

      await service.invite('g1', 'admin1', 'u1');

      expect(email.sendMail).not.toHaveBeenCalled();
    });
  });

  it('invite : refuse de s’inviter soi-même', async () => {
    await expect(service.invite('p1', 'mj1', 'mj1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invite : 404 si destinataire inconnu', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.invite('p1', 'mj1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('invite : 409 si déjà membre', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    prisma.membership.findUnique.mockResolvedValue({
      userId: 'u',
      partieId: 'p1',
    });
    await expect(service.invite('p1', 'mj1', 'u')).rejects.toBeInstanceOf(ConflictException);
  });

  it('invite : upsert PENDING si tout est ok', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });
    await service.invite('p1', 'mj1', 'u');
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITATION_CREATE', { partieId: 'p1' });
    expect(prisma.invitation.upsert).toHaveBeenCalledWith(
      objectLike({
        update: objectLike({ status: 'PENDING' }),
      }),
    );
  });

  it('invite : émet un événement temps réel scopé sur l’utilisateur invité (Story 18.1, AC1)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });
    await service.invite('p1', 'mj1', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u'));
  });

  it('accept : 404 si l’invitation ne m’est pas adressée', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'autre',
      status: 'PENDING',
    });
    await expect(service.accept('inv1', 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accept : 409 si l’invitation n’est plus PENDING', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'u',
      status: 'ACCEPTED',
    });
    await expect(service.accept('inv1', 'u')).rejects.toBeInstanceOf(ConflictException);
  });

  it('accept : crée le membership et marque ACCEPTED (transaction)', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'u',
      partieId: 'p1',
      status: 'PENDING',
      partie: { ownerId: 'mj1' },
    });
    const res = await service.accept('inv1', 'u');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.membership.upsert).toHaveBeenCalled();
    expect(prisma.invitation.update).toHaveBeenCalledWith(
      objectLike({
        data: objectLike({ status: 'ACCEPTED' }),
      }),
    );
    expect(res).toEqual({ ok: true, partieId: 'p1' });
  });

  it('accept : émet un événement temps réel scopé sur la Partie (bug fix : roster MJ jamais notifié)', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'u',
      partieId: 'p1',
      status: 'PENDING',
      partie: { ownerId: 'mj1' },
    });
    await service.accept('inv1', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it("accept : émet aussi userTopic(userId) (bug fix : les AUTRES sessions/onglets déjà ouverts du destinataire n'étaient jamais notifiés)", async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'u',
      partieId: 'p1',
      status: 'PENDING',
      partie: { ownerId: 'mj1' },
    });
    await service.accept('inv1', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u'));
  });

  it('accept : notifie aussi PartiesService.notifyPartieSignalsChanged pour le MJ (propriétaire) — Story 29.7, AD-14, signal AUCUN_MEMBRE_INVITE', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviteeUserId: 'u',
      inviterId: 'mj1',
      partieId: 'p1',
      status: 'PENDING',
      partie: { ownerId: 'mj1' },
    });
    await service.accept('inv1', 'u');
    expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
  });

  // Story 39.3 — groupe de ralliement : plusieurs administrateurs, e-mail neutre, rôle MEMBER.
  describe('groupe de ralliement (Story 39.3)', () => {
    beforeEach(() => {
      permissions.assert.mockResolvedValue(
        testGrant(
          { id: 'g1', ownerId: 'admin1', name: 'Les Fidèles', gameSystemId: 'ralliement' },
          'admin',
        ),
      );
    });

    it("accept : adhésion MEMBER explicite, notifie avec le propriétaire (pas l'invitant)", async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv1',
        inviteeUserId: 'u',
        inviterId: 'admin2',
        partieId: 'g1',
        status: 'PENDING',
        partie: { ownerId: 'admin1' },
      });
      await service.accept('inv1', 'u');
      expect(prisma.membership.upsert).toHaveBeenCalledWith(
        objectLike({ create: { userId: 'u', partieId: 'g1', role: 'MEMBER' } }),
      );
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('g1', 'admin1');
    });

    it('invite : déjà membre → 409 au texte neutre', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u' });
      prisma.membership.findUnique.mockResolvedValue({ userId: 'u', partieId: 'g1' });
      const promise = service.invite('g1', 'admin1', 'u');
      await expect(promise).rejects.toThrow('Cet utilisateur est déjà membre du groupe.');
    });

    it("inviteByEmail : adresse inconnue → e-mail « group-invitation » au nom de l'invitant", async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { email?: string } }) =>
        Promise.resolve(where.email ? null : { displayName: 'Marc', pseudo: 'marc42' }),
      );
      const result = await service.inviteByEmail('g1', 'admin1', 'ami@example.com');
      expect(email.sendMail).toHaveBeenCalledWith(
        'group-invitation',
        'ami@example.com',
        objectLike({
          inviterName: 'Marc',
          partieName: 'Les Fidèles',
          link: stringLike('/join/tok123'),
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('inviteByEmail : adresse déjà inscrite → invitation + e-mail de groupe vers le tableau de bord', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { email?: string } }) =>
        Promise.resolve(where.email ? { id: 'u1' } : { displayName: '', pseudo: 'marc42' }),
      );
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });
      await service.inviteByEmail('g1', 'admin1', 'ami@example.com');
      expect(prisma.invitation.upsert).toHaveBeenCalled();
      expect(email.sendMail).toHaveBeenCalledWith(
        'group-invitation',
        'ami@example.com',
        objectLike({ inviterName: 'marc42', link: stringLike('/') }),
      );
    });

    it("inviteByEmail : un échec d'envoi ne fait pas échouer l'appel", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      email.sendMail.mockResolvedValue({ ok: false });
      await expect(service.inviteByEmail('g1', 'admin1', 'ami@example.com')).resolves.toEqual({
        ok: false,
      });
    });
  });

  it('listForPartie : réservé au MJ (INVITATION_READ), invitations de la partie renvoyées', async () => {
    prisma.invitation.findMany.mockResolvedValue([{ id: 'inv1' }]);

    await expect(service.listForPartie('p1', 'mj1')).resolves.toEqual([{ id: 'inv1' }]);

    // Un membre ne doit jamais lire les invitations (adresses e-mail des invités) : l'action reste
    // MJ seul, ce test fige le câblage.
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITATION_READ', { partieId: 'p1' });
    expect(prisma.invitation.findMany).toHaveBeenCalledWith(
      objectLike({ where: { partieId: 'p1' } }),
    );
  });

  it("listForPartie : l'invité est servi sans son e-mail (P9-AD-2), avec pseudo et nom affiché", async () => {
    prisma.invitation.findMany.mockResolvedValue([]);

    await service.listForPartie('p1', 'mj1');

    const select = prisma.invitation.findMany.mock.calls[0][0].include.invitee.select;
    expect(select).toEqual({ id: true, pseudo: true, displayName: true });
    expect(select).not.toHaveProperty('email');
  });

  it('listForPartie : refus du service de permission propagé, aucune invitation lue', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException());

    await expect(service.listForPartie('p1', 'joueur1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invitation.findMany).not.toHaveBeenCalled();
  });

  it('revoke : 403 si non MJ de la partie de l’invitation (refus du service de permission, aucune écriture)', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException());
    await expect(service.revoke('inv1', 'intrus')).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissions.assert).toHaveBeenCalledWith('intrus', 'INVITATION_REVOKE', {
      invitationId: 'inv1',
    });
    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });

  it('revoke : 404 si l’invitation est inconnue (message historique porté par le service de permission)', async () => {
    permissions.assert.mockRejectedValue(new NotFoundException('Invitation introuvable'));
    await expect(service.revoke('zzz', 'mj1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });

  it('revoke : émet un événement temps réel scopé sur l’invité de l’invitation révoquée (Story 18.1, AC1)', async () => {
    prisma.invitation.findUnique.mockResolvedValue({
      id: 'inv1',
      inviterId: 'mj1',
      inviteeUserId: 'u',
    });
    await service.revoke('inv1', 'mj1');
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITATION_REVOKE', {
      invitationId: 'inv1',
    });
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u'));
  });

  // --- inviteByEmail (Story 5.2) ---

  it('inviteByEmail : adresse déjà inscrite → réutilise invite() existant, envoie un e-mail vers le tableau de bord', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.invitation.upsert.mockResolvedValue({ id: 'inv1' });

    const result = await service.inviteByEmail('p1', 'mj1', 'ami@example.com');

    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITATION_CREATE', { partieId: 'p1' });
    expect(prisma.invitation.upsert).toHaveBeenCalled(); // délègue à invite()
    expect(inviteLinks.findOrCreateForEmail).not.toHaveBeenCalled();
    expect(email.sendMail).toHaveBeenCalledWith(
      'invitation',
      'ami@example.com',
      objectLike({
        partieName: 'La Forêt Ancienne',
        link: stringLike('/'),
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('inviteByEmail : adresse inconnue → génère/réutilise un InviteLink, envoie un e-mail avec le lien de jonction', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.inviteByEmail('p1', 'mj1', 'inconnu@example.com');

    expect(inviteLinks.findOrCreateForEmail).toHaveBeenCalledWith(
      'p1',
      'mj1',
      'inconnu@example.com',
    );
    expect(email.sendMail).toHaveBeenCalledWith(
      'invitation',
      'inconnu@example.com',
      objectLike({
        partieName: 'La Forêt Ancienne',
        link: stringLike('/join/tok123'),
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('inviteByEmail : propage { ok: false } si l’envoi échoue, sans lever d’exception', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    email.sendMail.mockResolvedValue({ ok: false });

    const result = await service.inviteByEmail('p1', 'mj1', 'inconnu@example.com');

    expect(result).toEqual({ ok: false });
  });

  it('inviteByEmail : normalise la casse/espaces avant recherche, dédoublonnage et envoi', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.inviteByEmail('p1', 'mj1', '  Ami@Example.COM  ');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ami@example.com' },
    });
    expect(inviteLinks.findOrCreateForEmail).toHaveBeenCalledWith('p1', 'mj1', 'ami@example.com');
    expect(email.sendMail).toHaveBeenCalledWith('invitation', 'ami@example.com', expect.anything());
  });
});
