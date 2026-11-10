import { InvitationCleanupService } from './invitation-cleanup.service';

describe('InvitationCleanupService — soirée isolée annulée (Story 42.2)', () => {
  function makeTx() {
    return {
      invitation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inviteLink: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  }

  it('lit les invités en attente et les liens par e-mail inutilisés AVANT de tout révoquer, puis révoque', async () => {
    const tx = makeTx();
    const order: string[] = [];
    tx.invitation.findMany.mockImplementation(() => {
      order.push('lire-invitations');
      return Promise.resolve([
        { invitee: { id: 'u1', email: 'Un@Example.com' } },
        { invitee: { id: 'u2', email: 'deux@example.com' } },
      ]);
    });
    tx.inviteLink.findMany.mockImplementation(() => {
      order.push('lire-liens');
      return Promise.resolve([
        { targetEmail: 'deux@example.com' },
        { targetEmail: 'Trois@Example.com' },
        { targetEmail: null },
      ]);
    });
    tx.invitation.updateMany.mockImplementation(() => {
      order.push('revoquer-invitations');
      return Promise.resolve({ count: 2 });
    });
    tx.inviteLink.updateMany.mockImplementation(() => {
      order.push('revoquer-liens');
      return Promise.resolve({ count: 3 });
    });

    const result = await new InvitationCleanupService().revokePendingInTx(tx as never, 'p1');

    expect(order).toEqual([
      'lire-invitations',
      'lire-liens',
      'revoquer-invitations',
      'revoquer-liens',
    ]);
    expect(result).toEqual({
      userIds: ['u1', 'u2'],
      // Minuscules, sans doublon ; un lien ouvert (sans adresse) ne prévient personne.
      emails: ['un@example.com', 'deux@example.com', 'trois@example.com'],
    });
    expect(tx.invitation.findMany.mock.calls[0][0].where).toEqual({
      partieId: 'p1',
      status: 'PENDING',
    });
    expect(tx.invitation.updateMany).toHaveBeenCalledWith({
      where: { partieId: 'p1', status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    expect(tx.inviteLink.updateMany).toHaveBeenCalledWith({
      where: { partieId: 'p1', revoked: false },
      data: { revoked: true },
    });
  });

  it('seuls les liens non révoqués, jamais utilisés et non expirés fournissent une adresse', async () => {
    const tx = makeTx();

    await new InvitationCleanupService().revokePendingInTx(tx as never, 'p1');

    const where = tx.inviteLink.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ partieId: 'p1', revoked: false, usesCount: 0 });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('rien à révoquer : résultat vide', async () => {
    await expect(
      new InvitationCleanupService().revokePendingInTx(makeTx() as never, 'p1'),
    ).resolves.toEqual({ userIds: [], emails: [] });
  });
});
