import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InviteLinksService } from './invite-links.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EventsService } from '../events/events.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { anyOf } from '../common/test-utils/jest-typed';

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

describe('InviteLinksService', () => {
  let service: InviteLinksService;
  let prisma: {
    inviteLink: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let parties: { notifyPartieSignalsChanged: jest.Mock };
  let permissions: { assert: jest.Mock };
  let realtimeEvents: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      inviteLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    };
    parties = {
      notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined),
    };
    // Story 37.7 : les droits sont décidés par `PermissionService.assert()`, simulé ici.
    permissions = {
      assert: jest.fn().mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' })),
    };
    realtimeEvents = { emit: jest.fn() };
    service = new InviteLinksService(
      prisma as unknown as PrismaService,
      parties as unknown as PartiesService,
      permissions as unknown as PermissionService,
      realtimeEvents as unknown as RealtimeEventsService,
      { assertIsolatedOpen: jest.fn().mockResolvedValue(undefined) } as unknown as EventsService,
    );
  });

  it('create : MJ requis, token généré, expiration par défaut +7j', async () => {
    prisma.inviteLink.create.mockImplementation(({ data }) => Promise.resolve(data));
    const before = Date.now();
    const link = (await service.create('p1', 'mj1', {})) as {
      token: string;
      expiresAt: Date;
    };
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITE_LINK_CREATE', {
      partieId: 'p1',
    });
    expect(link.token).toHaveLength(43); // 32 octets en base64url
    expect(link.expiresAt.getTime()).toBeGreaterThan(before + 6 * 24 * 3600 * 1000);
  });

  it('create : refuse une expiration passée', async () => {
    await expect(
      service.create('p1', 'mj1', { expiresAt: past().toISOString() }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preview : 404 si le token est inconnu', async () => {
    prisma.inviteLink.findUnique.mockResolvedValue(null);
    await expect(service.preview('xxx')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preview : valide si non révoqué/expiré et quota ok', async () => {
    prisma.inviteLink.findUnique.mockResolvedValue({
      revoked: false,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      partie: { name: 'La Nuit', gameSystemId: 'draconis' },
    });
    expect(await service.preview('tok')).toEqual({
      partieName: 'La Nuit',
      gameSystemId: 'draconis',
      valid: true,
      reason: undefined,
    });
  });

  it('preview : invalide si expiré', async () => {
    prisma.inviteLink.findUnique.mockResolvedValue({
      revoked: false,
      expiresAt: past(),
      maxUses: null,
      usesCount: 0,
      partie: { name: 'La Nuit', gameSystemId: 'draconis' },
    });
    const res = await service.preview('tok');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('expiré');
  });

  // --- consumeLink (cœur du join + register) ---

  const makeTx = (link: unknown, existingMember: unknown = null, claimCount = 1) => ({
    inviteLink: {
      findUnique: jest.fn().mockResolvedValue(link),
      updateMany: jest.fn().mockResolvedValue({ count: claimCount }),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue(existingMember),
      create: jest.fn().mockResolvedValue({}),
    },
  });

  it('consumeLink : 404 si lien inconnu', async () => {
    const tx = makeTx(null);
    await expect(service.consumeLink(tx as never, 'tok', 'u')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('consumeLink : 403 si révoqué', async () => {
    const tx = makeTx({
      id: 'l1',
      revoked: true,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    });
    await expect(service.consumeLink(tx as never, 'tok', 'u')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('consumeLink : 409 si l’utilisateur est le MJ', async () => {
    const tx = makeTx({
      id: 'l1',
      revoked: false,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    });
    await expect(service.consumeLink(tx as never, 'tok', 'mj1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('consumeLink : 409 si déjà membre', async () => {
    const tx = makeTx(
      {
        id: 'l1',
        revoked: false,
        expiresAt: future(),
        maxUses: null,
        usesCount: 0,
        partieId: 'p1',
        partie: { ownerId: 'mj1' },
      },
      { userId: 'u', partieId: 'p1' },
    );
    await expect(service.consumeLink(tx as never, 'tok', 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('consumeLink : 403 si le quota est épuisé (claim atomique = 0)', async () => {
    const tx = makeTx(
      {
        id: 'l1',
        revoked: false,
        expiresAt: future(),
        maxUses: 1,
        usesCount: 1,
        partieId: 'p1',
        partie: { ownerId: 'mj1' },
      },
      null,
      0,
    );
    await expect(service.consumeLink(tx as never, 'tok', 'u')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('consumeLink : crée le membership et incrémente quand tout est ok', async () => {
    const link = {
      id: 'l1',
      revoked: false,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    };
    const tx = makeTx(link);
    const res = await service.consumeLink(tx as never, 'tok', 'u');
    expect(tx.inviteLink.updateMany).toHaveBeenCalled();
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: { userId: 'u', partieId: 'p1', role: 'MEMBER' },
    });
    expect(res).toBe(link);
  });

  // Story 39.3 : un ralliement parle en termes neutres (ni « MJ » ni « partie »).
  describe('assertUsableForRegistration (revue de sécurité)', () => {
    const link = (over: Record<string, unknown> = {}) => ({
      id: 'l1',
      token: 'tok',
      revoked: false,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      targetEmail: null,
      partie: { id: 'p1', kind: 'CAMPAGNE', closedAt: null, gameSystemId: 'ryuutama' },
      ...over,
    });

    it('lien inconnu → 404 ; lien expiré → 403', async () => {
      prisma.inviteLink.findUnique.mockResolvedValue(null);
      await expect(service.assertUsableForRegistration('x', 'a@b.c')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.inviteLink.findUnique.mockResolvedValue(link({ expiresAt: past() }));
      await expect(service.assertUsableForRegistration('tok', 'a@b.c')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lien émis vers une adresse : refusé pour une autre adresse, accepté pour celle-ci', async () => {
      prisma.inviteLink.findUnique.mockResolvedValue(link({ targetEmail: 'invite@b.c' }));
      await expect(service.assertUsableForRegistration('tok', 'autre@b.c')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.assertUsableForRegistration('tok', 'invite@b.c'),
      ).resolves.toBeUndefined();
    });

    it('lien de groupe (sans adresse) : toute adresse', async () => {
      prisma.inviteLink.findUnique.mockResolvedValue(link());
      await expect(service.assertUsableForRegistration('tok', 'qui@b.c')).resolves.toBeUndefined();
    });
  });

  describe('consumeLink — ralliement (Story 39.3)', () => {
    const groupLink = {
      id: 'l1',
      revoked: false,
      expiresAt: future(),
      maxUses: null,
      usesCount: 0,
      partieId: 'g1',
      partie: { ownerId: 'admin1', gameSystemId: 'ralliement' },
    };

    it('le créateur qui rejoint de nouveau : 409 neutre, sans « MJ »', async () => {
      const promise = service.consumeLink(makeTx(groupLink) as never, 'tok', 'admin1');
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('Vous êtes déjà membre de ce groupe.');
      await expect(promise).rejects.not.toThrow(/MJ/);
    });

    it('un membre qui rejoint de nouveau : 409 neutre, sans « partie »', async () => {
      const tx = makeTx(groupLink, { userId: 'u', partieId: 'g1' });
      const promise = service.consumeLink(tx as never, 'tok', 'u');
      await expect(promise).rejects.toThrow('Vous êtes déjà membre de ce groupe.');
    });

    it('crée un membership MEMBER explicite', async () => {
      const tx = makeTx(groupLink);
      await service.consumeLink(tx as never, 'tok', 'u');
      expect(tx.membership.create).toHaveBeenCalledWith({
        data: { userId: 'u', partieId: 'g1', role: 'MEMBER' },
      });
    });

    it('join : notifie les signaux avec le propriétaire du groupe (pas le créateur du lien)', async () => {
      jest.spyOn(service, 'consumeLink').mockResolvedValue(groupLink as never);
      await service.join('tok', 'u');
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('g1', 'admin1');
    });
  });

  // --- join (bug fix : roster MJ jamais notifié quand un joueur rejoint via lien) ---

  it('join : émet un événement temps réel scopé sur la Partie après la transaction', async () => {
    jest.spyOn(service, 'consumeLink').mockResolvedValue({
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    } as never);
    const res = await service.join('tok', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    expect(res).toEqual({ ok: true, partieId: 'p1' });
  });

  it("join : émet aussi userTopic(userId) (bug fix : les AUTRES sessions/onglets déjà ouverts du joueur n'étaient jamais notifiés)", async () => {
    jest.spyOn(service, 'consumeLink').mockResolvedValue({
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    } as never);
    await service.join('tok', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u'));
  });

  it('join : notifie aussi PartiesService.notifyPartieSignalsChanged pour le MJ (Story 29.7, AD-14, signal AUCUN_MEMBRE_INVITE)', async () => {
    jest.spyOn(service, 'consumeLink').mockResolvedValue({
      partieId: 'p1',
      partie: { ownerId: 'mj1' },
    } as never);
    await service.join('tok', 'u');
    expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
  });

  // --- findOrCreateForEmail (Story 5.2) ---

  it('findOrCreateForEmail : crée un nouveau lien usage unique si aucun n’existe', async () => {
    prisma.inviteLink.findFirst.mockResolvedValue(null);
    prisma.inviteLink.create.mockImplementation(({ data }) => Promise.resolve(data));
    const link = (await service.findOrCreateForEmail('p1', 'mj1', 'ami@example.com')) as {
      token: string;
      maxUses: number;
      targetEmail: string;
    };
    expect(prisma.inviteLink.findFirst).toHaveBeenCalledWith({
      where: {
        partieId: 'p1',
        targetEmail: 'ami@example.com',
        revoked: false,
        expiresAt: { gt: anyOf(Date) },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(link.maxUses).toBe(1);
    expect(link.targetEmail).toBe('ami@example.com');
    expect(link.token).toHaveLength(43);
  });

  it('findOrCreateForEmail : réutilise un lien existant valide plutôt que d’en créer un nouveau', async () => {
    const existing = {
      id: 'l1',
      token: 'tok-existant',
      targetEmail: 'ami@example.com',
    };
    prisma.inviteLink.findFirst.mockResolvedValue(existing);
    const link = await service.findOrCreateForEmail('p1', 'mj1', 'ami@example.com');
    expect(link).toBe(existing);
    expect(prisma.inviteLink.create).not.toHaveBeenCalled();
  });

  it('listForPartie : MJ requis (INVITE_LINK_READ), liens de la partie renvoyés', async () => {
    prisma.inviteLink.findMany.mockResolvedValue([{ id: 'l1' }]);
    await expect(service.listForPartie('p1', 'mj1')).resolves.toEqual([{ id: 'l1' }]);
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITE_LINK_READ', { partieId: 'p1' });
  });

  it('revoke : la partie est résolue depuis le lien (INVITE_LINK_REVOKE), puis le lien est révoqué', async () => {
    await expect(service.revoke('l1', 'mj1')).resolves.toEqual({ ok: true });
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'INVITE_LINK_REVOKE', {
      inviteLinkId: 'l1',
    });
    expect(prisma.inviteLink.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { revoked: true },
    });
  });

  it('revoke : lien d’une autre partie ou non MJ → refus propagé, aucune écriture', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException());
    await expect(service.revoke('l-autre', 'mj1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.inviteLink.update).not.toHaveBeenCalled();
  });

  it('revoke : lien inconnu → 404 « Lien introuvable » du service de permission, aucune écriture', async () => {
    permissions.assert.mockRejectedValue(new NotFoundException('Lien introuvable'));
    await expect(service.revoke('zzz', 'mj1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inviteLink.update).not.toHaveBeenCalled();
  });
});
