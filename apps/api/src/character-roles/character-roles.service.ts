import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CharacterGroupRoleDto } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hasPrismaErrorCode } from '../common/prisma-error.util';
import { PermissionService } from '../permissions/permission.service';
import { GameSystemService } from '../game-systems/game-system.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';

function toDto(role: {
  id: string;
  characterId: string;
  partieId: string;
  roleKey: string;
  assignedAt: Date;
}): CharacterGroupRoleDto {
  return {
    id: role.id,
    characterId: role.characterId,
    partieId: role.partieId,
    roleKey: role.roleKey,
    assignedAt: role.assignedAt.toISOString(),
  };
}

/**
 * Assignation d'un rôle de groupe par le MJ (Epic 27, Story 27.2 — AD-5/AD-6/AD-8). Module dédié,
 * jamais fondu dans `CharacterModule` (portée cross-personnage à l'échelle de la Partie, pas
 * propriétaire-ou-MJ sur un personnage donné). Écriture MJ-only (`GROUP_ROLE_ASSIGN`,
 * `GROUP_ROLE_UNASSIGN`), lecture ouverte à tout membre (`GROUP_ROLE_READ`), toutes décidées par
 * `PermissionService` ; seule l'assignation exige la capacité `groupRoles` du système — aucun
 * nouveau guard NestJS.
 */
@Injectable()
export class CharacterRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly gameSystems: GameSystemService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async assign(
    partieId: string,
    mjId: string,
    characterId: string,
    roleKey: string,
  ): Promise<CharacterGroupRoleDto> {
    const { partie } = await this.permissions.assert(mjId, 'GROUP_ROLE_ASSIGN', { partieId });

    const content = await this.gameSystems.getContent(partie.gameSystemId);
    const validRoleKeys = (content['groupRole'] ?? []).map((entry) => entry.key);
    if (validRoleKeys.length === 0) {
      throw new BadRequestException("Aucun rôle de groupe n'est disponible pour ce système de jeu");
    }
    if (!validRoleKeys.includes(roleKey)) {
      throw new BadRequestException(`Rôle invalide. Rôles acceptés : ${validRoleKeys.join(', ')}`);
    }

    // Vérification explicite d'appartenance AVANT toute écriture (AC3) — jamais une confiance
    // implicite dans l'appelant, même pattern que XpDistributionsService.createDistribution().
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { partieId: true },
    });
    if (!character || character.partieId !== partieId) {
      throw new BadRequestException("Ce personnage n'appartient pas à cette Partie");
    }

    try {
      const role = await this.prisma.characterGroupRole.create({
        data: { characterId, partieId, roleKey },
      });
      // Émis juste après l'écriture réussie (P7-AD-2/AD-8) — jamais depuis l'intérieur d'un bloc
      // pouvant encore lever après coup.
      this.realtimeEvents.emit(partieTopic(partieId));
      return toDto(role);
    } catch (e) {
      // Couvre les DEUX contraintes d'unicité (@@unique([partieId, roleKey]) ET
      // @@unique([partieId, characterId])) — même erreur Prisma P2002, même philosophie « jamais
      // d'éviction silencieuse », un seul chemin de rejet explicite (AC4).
      if (hasPrismaErrorCode(e, 'P2002')) {
        throw new ConflictException(
          'Ce rôle est déjà attribué, ou ce personnage porte déjà un rôle — retirez-le explicitement avant de réassigner',
        );
      }
      // Personnage supprimé entre la vérification d'appartenance et l'écriture (contrainte FK) —
      // même message que la vérification d'appartenance ci-dessus, jamais un 500 brut.
      if (hasPrismaErrorCode(e, 'P2003')) {
        throw new BadRequestException("Ce personnage n'appartient pas à cette Partie");
      }
      throw e;
    }
  }

  async unassign(partieId: string, mjId: string, characterId: string): Promise<void> {
    await this.permissions.assert(mjId, 'GROUP_ROLE_UNASSIGN', { partieId });

    const result = await this.prisma.characterGroupRole.deleteMany({
      where: { partieId, characterId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Aucun rôle assigné à ce personnage');
    }
    this.realtimeEvents.emit(partieTopic(partieId));
  }

  async listForPartie(partieId: string, userId: string): Promise<CharacterGroupRoleDto[]> {
    await this.permissions.assert(userId, 'GROUP_ROLE_READ', { partieId });
    const roles = await this.prisma.characterGroupRole.findMany({
      where: { partieId },
      orderBy: { assignedAt: 'asc' },
    });
    return roles.map(toDto);
  }
}
