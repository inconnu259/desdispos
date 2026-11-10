import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { InviteLink, Prisma } from '@prisma/client';
import type { InviteLinkPreviewDto } from '@master-jdr/shared';
import { familyOf } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { CreateInviteLinkDto } from './dto/create-invite-link.dto';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // +7 jours
const MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000; // plafond d'expiration (revue de sécurité)

@Injectable()
export class InviteLinksService {
  constructor(
    private readonly prisma: PrismaService,
    // Signaux de la partie (`notifyPartieSignalsChanged`) : écriture de `parties/`,
    // aucune décision de droit.
    private readonly parties: PartiesService,
    private readonly permissions: PermissionService,
    private readonly realtimeEvents: RealtimeEventsService,
    // Story 41.4 : une soirée terminée ne prend plus de lien ni de nouveau membre (lecture seule).
    private readonly events: EventsService,
  ) {}

  /** Le MJ (ou l'administrateur d'un ralliement) génère un lien d'invitation pour SA partie. */
  async create(partieId: string, mjId: string, dto: CreateInviteLinkDto) {
    const { partie } = await this.permissions.assert(mjId, 'INVITE_LINK_CREATE', { partieId });
    await this.events.assertIsolatedOpen(partie);
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + DEFAULT_TTL_MS);
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("La date d'expiration doit être dans le futur.");
    }
    // Un lien qui traîne dans une conversation ne doit pas ouvrir la porte indéfiniment.
    if (expiresAt.getTime() > Date.now() + MAX_TTL_MS) {
      throw new BadRequestException("Un lien d'invitation expire au plus tard dans 90 jours.");
    }
    const token = randomBytes(32).toString('base64url');
    return this.prisma.inviteLink.create({
      data: {
        token,
        partieId,
        createdById: mjId,
        maxUses: dto.maxUses ?? null,
        expiresAt,
      },
    });
  }

  /** Liens d'une partie (vue MJ). */
  async listForPartie(partieId: string, mjId: string) {
    await this.permissions.assert(mjId, 'INVITE_LINK_READ', { partieId });
    return this.prisma.inviteLink.findMany({
      where: { partieId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Le MJ révoque un lien. */
  async revoke(linkId: string, userId: string) {
    // La partie est résolue depuis le lien (404 si inconnu, 403 si étranger) — MJ uniquement.
    await this.permissions.assert(userId, 'INVITE_LINK_REVOKE', { inviteLinkId: linkId });
    await this.prisma.inviteLink.update({
      where: { id: linkId },
      data: { revoked: true },
    });
    return { ok: true };
  }

  /** Prévisualisation publique (sans session) : ne révèle que le nom + le système. */
  async preview(token: string): Promise<InviteLinkPreviewDto> {
    const link = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: { partie: { select: { name: true, gameSystemId: true } } },
    });
    if (!link) throw new NotFoundException('Lien introuvable');
    const { valid, reason } = this.linkStatus(link);
    return {
      partieName: link.partie.name,
      gameSystemId: link.partie.gameSystemId,
      valid,
      reason,
    };
  }

  /** Un utilisateur connecté rejoint une partie via un lien. */
  async join(token: string, userId: string) {
    const link = await this.prisma.$transaction((tx) => this.consumeLink(tx, token, userId));
    // Bug fix : le MJ/les autres membres ne voyaient jamais apparaître le nouveau membre sans
    // recharger — émis après résolution complète de la transaction, jamais dans son callback.
    this.realtimeEvents.emit(partieTopic(link.partieId));
    // Bug fix (revue de code) : l'utilisateur qui rejoint lui-même n'était notifié sur aucune de
    // ses AUTRES sessions/onglets déjà ouverts (miroir de removeMember()).
    this.realtimeEvents.emit(userTopic(userId));
    // AUCUN_MEMBRE_INVITE (Story 29.7, AD-14) : le MJ doit voir ce signal se lever quand quelqu'un
    // rejoint par lien. En plus des émissions ci-dessus, jamais en remplacement.
    await this.parties.notifyPartieSignalsChanged(link.partieId, link.partie.ownerId);
    return { ok: true, partieId: link.partieId };
  }

  /**
   * Contrôle préalable à une inscription, AVANT de créer quoi que ce soit : lien existant et valide, partie
   * encore ouverte, et — pour un lien émis vers une adresse précise (invitation par e-mail) — inscription
   * avec CETTE adresse. Sans ce dernier point, un lien transféré ou intercepté ouvrait un compte à n'importe
   * qui. Mêmes codes que `consumeLink` (404 lien inconnu, 403 lien inutilisable).
   */
  async assertUsableForRegistration(token: string, email: string): Promise<void> {
    const link = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: { partie: { select: { id: true, kind: true, closedAt: true, gameSystemId: true } } },
    });
    if (!link) throw new NotFoundException('Lien invalide');
    const status = this.linkStatus(link);
    if (!status.valid) throw new ForbiddenException(status.reason);
    if (link.targetEmail && link.targetEmail !== email) {
      throw new ForbiddenException(
        "Ce lien d'invitation a été envoyé à une autre adresse : inscrivez-vous avec l'adresse qui l'a reçu.",
      );
    }
    await this.events.assertIsolatedOpen(link.partie);
  }

  /**
   * Consomme un lien dans une transaction : valide, crée le `Membership`, incrémente `usesCount`.
   * Réutilisé par `join` (utilisateur existant) **et** par l'inscription (`AuthService.register`).
   * L'incrément conditionnel (`updateMany` + quota dans le `WHERE`) protège contre la course sur `maxUses`.
   */
  async consumeLink(
    tx: Prisma.TransactionClient,
    token: string,
    userId: string,
  ): Promise<InviteLink & { partie: { ownerId: string | null; gameSystemId: string } }> {
    const link = await tx.inviteLink.findUnique({
      where: { token },
      include: {
        partie: {
          select: { id: true, ownerId: true, gameSystemId: true, kind: true, closedAt: true },
        },
      },
    });
    if (!link) throw new NotFoundException('Lien invalide');
    const status = this.linkStatus(link);
    if (!status.valid) throw new ForbiddenException(status.reason);
    // Story 41.4 : on ne rejoint plus une soirée terminée (lecture hors transaction, sans effet pour les
    // autres types de partie).
    await this.events.assertIsolatedOpen(link.partie);
    // Textes neutres pour un ralliement (Story 39.3) : ni « MJ » ni « partie ».
    const isGroup = familyOf(link.partie.gameSystemId) === 'ralliement';
    if (link.partie.ownerId === userId) {
      throw new ConflictException(
        isGroup ? 'Vous êtes déjà membre de ce groupe.' : 'Vous êtes déjà le MJ de cette partie.',
      );
    }
    const existing = await tx.membership.findUnique({
      where: { userId_partieId: { userId, partieId: link.partieId } },
    });
    if (existing) {
      throw new ConflictException(
        isGroup ? 'Vous êtes déjà membre de ce groupe.' : 'Vous êtes déjà membre de cette partie.',
      );
    }

    const claim = await tx.inviteLink.updateMany({
      where: {
        id: link.id,
        revoked: false,
        expiresAt: { gt: new Date() },
        ...(link.maxUses != null ? { usesCount: { lt: link.maxUses } } : {}),
      },
      data: { usesCount: { increment: 1 } },
    });
    if (claim.count === 0) throw new ForbiddenException('Lien invalide ou quota atteint.');

    // Rôle explicite (Story 39.3) : un lien ne fait jamais entrer en administrateur.
    await tx.membership.create({ data: { userId, partieId: link.partieId, role: 'MEMBER' } });
    return link;
  }

  /**
   * Retrouve un lien valide déjà émis pour cette adresse sur cette partie, ou en crée un
   * nouveau (usage unique). Dédoublonnage pour l'invitation par e-mail (Story 5.2, FR-3) —
   * ne vérifie pas le rôle MJ ici, délégué à l'appelant (`InvitationsService.inviteByEmail`).
   */
  async findOrCreateForEmail(partieId: string, mjId: string, email: string): Promise<InviteLink> {
    const existing = await this.prisma.inviteLink.findFirst({
      where: {
        partieId,
        targetEmail: email,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const token = randomBytes(32).toString('base64url');
    return this.prisma.inviteLink.create({
      data: {
        token,
        partieId,
        createdById: mjId,
        maxUses: 1,
        targetEmail: email,
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
      },
    });
  }

  /** État de validité d'un lien (révoqué / expiré / quota). */
  private linkStatus(link: Pick<InviteLink, 'revoked' | 'expiresAt' | 'maxUses' | 'usesCount'>): {
    valid: boolean;
    reason?: string;
  } {
    if (link.revoked) return { valid: false, reason: 'Lien révoqué.' };
    if (link.expiresAt.getTime() <= Date.now()) return { valid: false, reason: 'Lien expiré.' };
    if (link.maxUses != null && link.usesCount >= link.maxUses) {
      return { valid: false, reason: "Nombre maximum d'utilisations atteint." };
    }
    return { valid: true };
  }
}
