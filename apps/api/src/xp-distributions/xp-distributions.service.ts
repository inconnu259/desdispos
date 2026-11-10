import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { XpDistributionDto } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { CharacterService } from '../characters/character.service';
import { CreateXpDistributionDto } from './dto/create-xp-distribution.dto';

@Injectable()
export class XpDistributionsService {
  private readonly logger = new Logger(XpDistributionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly characters: CharacterService,
  ) {}

  async createDistribution(
    partieId: string,
    mjId: string,
    dto: CreateXpDistributionDto,
  ): Promise<XpDistributionDto> {
    await this.permissions.assert(mjId, 'XP_DISTRIBUTION_CREATE', { partieId });

    // Valider que CHAQUE characterId appartient à cette Partie AVANT toute écriture (batch, pas
    // N requêtes) — rejette la requête entière plutôt qu'une application partielle (AD-6).
    const characterIds = dto.entries.map((e) => e.characterId);
    const characters = await this.prisma.character.findMany({
      where: { id: { in: characterIds } },
      select: { id: true, partieId: true },
    });
    const partieIdByCharacterId = new Map(characters.map((c) => [c.id, c.partieId]));
    for (const id of characterIds) {
      if (partieIdByCharacterId.get(id) !== partieId) {
        throw new BadRequestException(
          "Un personnage de cette distribution n'appartient pas à cette Partie",
        );
      }
    }

    const distribution = await this.prisma.xpDistribution.create({
      data: {
        partieId,
        mjId,
        note: dto.note,
        entries: {
          create: dto.entries.map((e) => ({
            characterId: e.characterId,
            amount: e.amount,
            isBonus: e.isBonus ?? false,
          })),
        },
      },
      include: ENTRIES_WITH_OWNER_INCLUDE,
    });

    // Agrégé par personnage (montant commun + bonus fusionnés) — un seul appel `applyXpDelta` par
    // personnage, pas un par entrée : sinon un bonus soumis comme entrée séparée (cf. frontend)
    // déclencherait 2 vérifications pendingLevels()/e-mail pour le même franchissement de seuil.
    // Les lignes `XpDistributionEntry` elles-mêmes restent inchangées (audit détaillé montant/bonus).
    const totalByCharacterId = new Map<string, number>();
    for (const entry of dto.entries) {
      totalByCharacterId.set(
        entry.characterId,
        (totalByCharacterId.get(entry.characterId) ?? 0) + entry.amount,
      );
    }

    // Séquentiel, pas Promise.all : chaque increment déclenche indépendamment sa propre
    // vérification pendingLevels()/e-mail (cf. diagramme séquence ARCHITECTURE-SPINE.md).
    // Un échec isolé (ex. personnage supprimé entretemps) est loggé et n'interrompt pas les
    // increments restants — la distribution reste l'enregistrement de ce qui a été décidé par le
    // MJ même si son application a partiellement échoué sur un cas limite rare.
    for (const [characterId, amount] of totalByCharacterId) {
      try {
        await this.characters.applyXpDelta(characterId, amount);
      } catch (e) {
        this.logger.error(
          `Échec d'application de l'XP pour le personnage ${characterId} (distribution ${distribution.id})`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

    return toDto(distribution);
  }

  async listForPartie(
    partieId: string,
    mjId: string,
    pagination?: { skip?: number; take?: number },
  ): Promise<XpDistributionDto[]> {
    await this.permissions.assert(mjId, 'XP_DISTRIBUTION_READ', { partieId });
    const distributions = await this.prisma.xpDistribution.findMany({
      where: { partieId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: ENTRIES_WITH_OWNER_INCLUDE,
      skip: pagination?.skip,
      take: pagination?.take,
    });
    return distributions.map(toDto);
  }
}

/** Identité du propriétaire du personnage crédité — pas celle du MJ qui distribue (AD-2, Story 28.2). */
const ENTRIES_WITH_OWNER_INCLUDE = {
  entries: {
    include: {
      character: {
        include: { user: { select: { pseudo: true, displayName: true } } },
      },
    },
  },
} as const;

function toDto(
  distribution: Prisma.XpDistributionGetPayload<{ include: typeof ENTRIES_WITH_OWNER_INCLUDE }>,
): XpDistributionDto {
  return {
    id: distribution.id,
    partieId: distribution.partieId,
    note: distribution.note ?? undefined,
    createdAt: distribution.createdAt.toISOString(),
    entries: distribution.entries.map((e) => ({
      characterId: e.characterId,
      amount: e.amount,
      isBonus: e.isBonus,
      ownerPseudo: e.character.user.pseudo,
      ownerDisplayName: e.character.user.displayName,
    })),
  };
}
