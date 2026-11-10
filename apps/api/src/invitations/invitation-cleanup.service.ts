import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Story 42.2 — révocation des invitations d'une soirée isolée ANNULÉE, dans la transaction de l'appelant
 * (`GroupEventsService.cancel`, via `EventsService.cancelHosted`). Code du module `invitations/` (qui reste
 * l'écrivain d'`Invitation` et d'`InviteLink`), mais sans AUCUNE dépendance : `InvitationsModule` importe
 * `EventsModule`, l'import inverse ferait un cycle — même patron que `PollVoteCleanupService`.
 */
@Injectable()
export class InvitationCleanupService {
  /**
   * Passe en `REVOKED` les invitations de la partie qui attendent une réponse (`PENDING`) et révoque ses
   * liens d'invitation encore ouverts. Renvoie, LUS AVANT la révocation (ensuite l'état `PENDING` a
   * disparu), les invités nominatifs encore sans réponse — leur identifiant, pour rafraîchir leur accueil,
   * et leur adresse — ainsi que les adresses des liens créés par e-mail et jamais utilisés, que l'e-mail
   * d'annulation doit prévenir. Adresses en minuscules, sans doublon. Aucun droit décidé ici ; n'émet rien.
   */
  async revokePendingInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
  ): Promise<{ userIds: string[]; emails: string[] }> {
    const pending = await tx.invitation.findMany({
      where: { partieId, status: 'PENDING' },
      select: { invitee: { select: { id: true, email: true } } },
    });
    const openLinks = await tx.inviteLink.findMany({
      where: { partieId, revoked: false, usesCount: 0, expiresAt: { gt: new Date() } },
      select: { targetEmail: true },
    });
    await tx.invitation.updateMany({
      where: { partieId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    await tx.inviteLink.updateMany({
      where: { partieId, revoked: false },
      data: { revoked: true },
    });

    const emails = new Set<string>();
    for (const { invitee } of pending) emails.add(invitee.email.toLowerCase());
    for (const { targetEmail } of openLinks) if (targetEmail) emails.add(targetEmail.toLowerCase());
    return { userIds: pending.map((p) => p.invitee.id), emails: [...emails] };
  }
}
