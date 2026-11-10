import { Injectable, NotFoundException } from '@nestjs/common';
import type { AnnouncementDto } from '@master-jdr/shared';
import type { Announcement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { RELEASED_ANNOUNCEMENT_WHERE, isSpoilRestricted } from '../permissions/scenario-visibility';
import { ScenariosService } from '../scenarios/scenarios.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

/** Exporté pour réutilisation par `AccountService.getUnseenAnnouncements()` (Story 29.13, AD-17 :
 *  extraction, jamais duplication). */
export function toDto(
  announcement: Announcement,
  mj: { pseudo: string; displayName: string },
): AnnouncementDto {
  return {
    id: announcement.id,
    partieId: announcement.partieId,
    scenarioId: announcement.scenarioId,
    text: announcement.text,
    createdAt: announcement.createdAt.toISOString(),
    authorPseudo: mj.pseudo,
    authorDisplayName: mj.displayName,
  };
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly scenarios: ScenariosService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async create(
    partieId: string,
    mjId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementDto> {
    await this.permissions.assert(mjId, 'ANNOUNCEMENT_CREATE', { partieId });

    if (dto.scenarioId !== undefined) {
      await this.scenarios.verifyScenarioBelongsToPartie(dto.scenarioId, partieId);
    }

    // L'auteur est toujours le MJ de la Partie (seul autorisé à publier, cf. ANNOUNCEMENT_CREATE
    // ci-dessus) — Announcement n'a aucune relation vers User, dérivé plutôt que stocké (AD-2,
    // Story 28.2).
    // Résolu AVANT la création (revue de code 28.2) : un MJ introuvable échoue alors sans avoir rien
    // persisté, et l'émission temps réel reste immédiatement après le create — une requête glissée
    // entre les deux aurait laissé l'annonce écrite sans jamais notifier les autres membres.
    const mj = await this.prisma.user.findUnique({
      where: { id: mjId },
      select: { pseudo: true, displayName: true },
    });
    if (!mj) {
      throw new NotFoundException('MJ introuvable.');
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        partieId,
        scenarioId: dto.scenarioId ?? null,
        text: dto.text,
      },
    });

    this.realtimeEvents.emit(partieTopic(partieId));
    return toDto(announcement, mj);
  }

  /** Story 9.2 (AD-9/AD-6) : lecture ouverte à tout membre (ANNOUNCEMENT_READ). Le MJ reçoit TOUTES
   * les annonces de la Partie. Anti-spoil serveur : un joueur ne reçoit pas les annonces ciblées sur
   * un scénario qui n'est ni `COURANT` ni `PASSE` ; les annonces de toute la partie restent. */
  async findAll(partieId: string, userId: string): Promise<AnnouncementDto[]> {
    const { partie, role } = await this.permissions.assert(userId, 'ANNOUNCEMENT_READ', {
      partieId,
    });
    // Une partie sans propriétaire (AD-5, compte supprimé — inatteignable aujourd'hui) n'a plus
    // d'auteur à afficher : ses annonces sont écartées en attendant l'affichage « compte
    // supprimé ».
    const author = await this.permissions.ownerOf(partie);
    if (!author) return [];
    const announcements = await this.prisma.announcement.findMany({
      where: isSpoilRestricted(role)
        ? { AND: [{ partieId }, RELEASED_ANNOUNCEMENT_WHERE] }
        : { partieId },
      orderBy: { createdAt: 'desc' },
    });
    return announcements.map((a) => toDto(a, author));
  }
}
