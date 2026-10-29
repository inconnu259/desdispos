import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { InvitationDto } from '@master-jdr/shared';
import { familyOf } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { formatSessionDate, formatSessionSpan } from '../events/session-date';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { InviteLinksService } from './invite-links.service';
import { EmailService } from '../email/email.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Signaux de la partie (`notifyPartieSignalsChanged`) : écriture de `parties/`,
    // aucune décision de droit.
    private readonly parties: PartiesService,
    private readonly permissions: PermissionService,
    private readonly inviteLinks: InviteLinksService,
    private readonly email: EmailService,
    private readonly realtimeEvents: RealtimeEventsService,
    // Story 41.3 : de quoi écrire l'e-mail d'invitation à une soirée isolée (lecture seule).
    private readonly events: EventsService,
  ) {}

  /** Le MJ (JDR) ou l'administrateur (ralliement) invite un utilisateur déjà inscrit. Idempotent :
   *  ré-invite ranime une invitation close. */
  async invite(partieId: string, inviterId: string, inviteeUserId: string) {
    // MJ uniquement (JDR) ; administrateur uniquement (ralliement, Story 39.3).
    const { partie } = await this.permissions.assert(inviterId, 'INVITATION_CREATE', { partieId });
    // Story 41.4 : plus d'invitation à une soirée terminée.
    await this.events.assertIsolatedOpen(partie);
    if (inviteeUserId === inviterId) {
      throw new BadRequestException('Vous ne pouvez pas vous inviter vous-même.');
    }
    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeUserId },
    });
    if (!invitee) throw new NotFoundException('Utilisateur introuvable');

    const alreadyMember = await this.prisma.membership.findUnique({
      where: { userId_partieId: { userId: inviteeUserId, partieId } },
    });
    if (alreadyMember) {
      throw new ConflictException(
        familyOf(partie.gameSystemId) === 'ralliement'
          ? 'Cet utilisateur est déjà membre du groupe.'
          : 'Cet utilisateur est déjà membre de la partie.',
      );
    }

    const invitation = await this.prisma.invitation.upsert({
      where: { partieId_inviteeUserId: { partieId, inviteeUserId } },
      create: { partieId, inviterId, inviteeUserId },
      update: { status: 'PENDING', inviterId, respondedAt: null },
    });
    this.realtimeEvents.emit(userTopic(inviteeUserId));
    // Story 41.3 : l'invité d'une soirée isolée en est prévenu par e-mail (jamais bloquant) ; les autres
    // invitations par pseudo gardent leur comportement (aucun e-mail).
    if (partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement') {
      await this.sendSoireeInvitation(
        partie,
        inviterId,
        invitee.email,
        `${process.env.WEB_ORIGIN ?? 'http://localhost:4200'}/`,
      );
    }
    return invitation;
  }

  /**
   * Story 41.3 : e-mail n° 2 « *Marc* vous invite : « *Soirée* » » — titre, date (fixée, « à voter jusqu'au … »
   * ou « à fixer »), lieu, bouton « Accepter ou décliner ». Envoyé APRÈS l'écriture ; un échec est journalisé
   * et n'annule jamais l'invitation. Renvoie le résultat de l'envoi.
   */
  private async sendSoireeInvitation(
    partie: { id: string; name: string },
    inviterId: string,
    to: string,
    link: string,
  ): Promise<{ ok: boolean }> {
    try {
      const [inviter, notice] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: inviterId },
          select: { displayName: true, pseudo: true },
        }),
        this.events.invitationNotice(partie.id),
      ]);
      let dateLine = 'date à fixer';
      if (notice?.startDate) dateLine = formatSessionSpan(notice.startDate, notice.startSlot, notice.endDate, notice.endSlot);
      else if (notice?.deadline) {
        dateLine = `date à voter jusqu'au ${formatSessionDate(notice.deadline, null)}`;
      }
      const result = await this.email.sendMail('soiree-invitation', to, {
        inviterName: inviter?.displayName || inviter?.pseudo || 'Un ami',
        eventTitle: notice?.eventTitle ?? partie.name,
        dateLine,
        lieu: notice?.lieu ?? null,
        link,
      });
      if (!result.ok) {
        this.logger.error(`Échec d'envoi de l'invitation à la soirée ${partie.id}`);
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Échec de l'invitation par e-mail à la soirée ${partie.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { ok: false };
    }
  }

  /**
   * Invitations émises pour une partie (vue MJ). L'invité est identifié par `pseudo` et `displayName`,
   * jamais par son e-mail (P9-AD-2) : tout utilisateur peut créer un groupe et y inviter n'importe quel
   * compte trouvé par pseudo — renvoyer l'adresse en ferait un moyen de lire celle de n'importe qui.
   */
  async listForPartie(partieId: string, mjId: string) {
    await this.permissions.assert(mjId, 'INVITATION_READ', { partieId });
    return this.prisma.invitation.findMany({
      where: { partieId },
      orderBy: { createdAt: 'desc' },
      include: { invitee: { select: { id: true, pseudo: true, displayName: true } } },
    });
  }

  /** Invitations PENDING reçues par l'utilisateur courant (→ dashboard joueur). */
  async listReceived(userId: string): Promise<InvitationDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { inviteeUserId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        partie: { select: { id: true, name: true, gameSystemId: true } },
        inviter: { select: { pseudo: true } },
      },
    });
    return invitations.map((inv) => ({
      id: inv.id,
      partie: inv.partie,
      inviterPseudo: inv.inviter.pseudo,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  /** Le destinataire accepte : crée le Membership et marque ACCEPTED (atomique). */
  async accept(invitationId: string, userId: string) {
    const inv = await this.requirePendingForInvitee(invitationId, userId);
    // Story 41.4 : on ne rejoint plus une soirée terminée.
    await this.events.assertIsolatedOpen(inv.partie);
    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { userId_partieId: { userId, partieId: inv.partieId } },
        // Rôle explicite (Story 39.3) : on rejoint un ralliement comme simple membre, jamais admin.
        create: { userId, partieId: inv.partieId, role: 'MEMBER' },
        update: {},
      }),
      this.prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
    ]);
    // Bug fix : le MJ/les autres membres ne voyaient jamais apparaître le nouveau membre sans
    // recharger (PartieDetail.members/.characters n'étaient notifiés d'aucun événement).
    this.realtimeEvents.emit(partieTopic(inv.partieId));
    // Bug fix (revue de code) : le destinataire lui-même n'était notifié sur aucune de ses AUTRES
    // sessions/onglets déjà ouverts (miroir de removeMember(), qui émet déjà userTopic(targetUserId)
    // pour le membre retiré).
    this.realtimeEvents.emit(userTopic(userId));
    // AUCUN_MEMBRE_INVITE (Story 29.7, AD-14) : le MJ doit voir ce signal se lever quand quelqu'un
    // rejoint. En plus des émissions ci-dessus, jamais en remplacement. Notifié avec le propriétaire
    // de la partie et non l'invitant (Story 39.3) : un ralliement a plusieurs administrateurs, et
    // l'invitant n'est plus forcément le propriétaire.
    await this.parties.notifyPartieSignalsChanged(inv.partieId, inv.partie.ownerId);
    return { ok: true, partieId: inv.partieId };
  }

  /** Le destinataire refuse. */
  async decline(invitationId: string, userId: string) {
    await this.requirePendingForInvitee(invitationId, userId);
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    return { ok: true };
  }

  /** Le MJ de la partie (l'invitant) révoque une invitation. */
  async revoke(invitationId: string, userId: string) {
    // La partie est résolue depuis l'invitation (404 si inconnue, 403 si étrangère). Révoquer est
    // réservé au MJ (JDR) ou à un administrateur (ralliement, Story 39.3).
    await this.permissions.assert(userId, 'INVITATION_REVOKE', { invitationId });
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!inv) throw new NotFoundException('Invitation introuvable');
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED', respondedAt: new Date() },
    });
    this.realtimeEvents.emit(userTopic(inv.inviteeUserId));
    return { ok: true };
  }

  /**
   * Le MJ invite par e-mail (FR-3) : réutilise `invite()` si l'adresse correspond à un
   * utilisateur déjà inscrit, sinon génère/réutilise un `InviteLink` à usage unique.
   * Ne relance jamais sur un échec d'envoi — `EmailService.sendMail` ne relance pas non plus.
   */
  async inviteByEmail(
    partieId: string,
    inviterId: string,
    rawEmail: string,
  ): Promise<{ ok: boolean }> {
    // Normalisée une seule fois ici : couvre la recherche User, le dédoublonnage InviteLink et
    // l'envoi, sans dépendre de la casse saisie par le MJ (foo@bar.com === Foo@Bar.com).
    const email = rawEmail.trim().toLowerCase();
    const { partie } = await this.permissions.assert(inviterId, 'INVITATION_CREATE', { partieId });
    await this.events.assertIsolatedOpen(partie);
    const origin = process.env.WEB_ORIGIN ?? 'http://localhost:4200';
    const user = await this.prisma.user.findUnique({ where: { email } });

    const isSoiree = partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement';
    let link: string;
    if (user) {
      // Story 41.3 : pour une soirée, `invite()` envoie lui-même l'e-mail n° 2 (une seule fois).
      await this.invite(partieId, inviterId, user.id);
      if (isSoiree) return { ok: true };
      link = `${origin}/`;
    } else {
      const inviteLink = await this.inviteLinks.findOrCreateForEmail(partieId, inviterId, email);
      link = `${origin}/join/${inviteLink.token}`;
    }

    // Story 41.3 : adresse inconnue — le lien d'invitation à usage unique porte l'e-mail n° 2.
    if (isSoiree) return this.sendSoireeInvitation(partie, inviterId, email, link);

    if (familyOf(partie.gameSystemId) === 'ralliement') {
      // Story 39.3 : e-mail neutre, au nom de l'invitant (l'invité peut ne pas avoir de compte).
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        select: { displayName: true, pseudo: true },
      });
      return this.email.sendMail('group-invitation', email, {
        inviterName: inviter?.displayName || inviter?.pseudo || 'Un ami',
        partieName: partie.name,
        link,
      });
    }

    return this.email.sendMail('invitation', email, {
      partieName: partie.name,
      link,
    });
  }

  /** Garde-fou commun à accept/decline : invitation existante, PENDING, adressée à l'utilisateur. */
  private async requirePendingForInvitee(invitationId: string, userId: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      // Propriétaire de la partie : `accept()` le notifie (Story 39.3), pas l'invitant.
      include: {
        partie: {
          select: { id: true, ownerId: true, kind: true, gameSystemId: true, closedAt: true },
        },
      },
    });
    if (!inv || inv.inviteeUserId !== userId) throw new NotFoundException('Invitation introuvable');
    if (inv.status !== 'PENDING') throw new ConflictException('Invitation déjà traitée.');
    return inv;
  }
}
