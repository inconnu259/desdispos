import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { GAME_SYSTEMS, boardGameNameKey, type BoardGameDto } from '@master-jdr/shared';
import { hasPrismaErrorCode } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import type { CreateBoardGameDto } from './dto/create-board-game.dto';

/** Plafond d'une Ludothèque (épic 48) : le 501ᵉ jeu est refusé. */
export const BOARD_GAMES_MAX_PER_OWNER = 500;

/** Systèmes de la famille `ralliement` : seules ces parties (groupes, rencontres isolées) entendent
 *  parler des jeux de leurs membres — une partie de JDR jamais (même copie locale que
 *  `NotificationsService`, Story 40.7). */
const RALLIEMENT_SYSTEM_IDS: string[] = GAME_SYSTEMS.filter((g) => g.family === 'ralliement').map(
  (g) => g.id,
);

/** Forme minimale d'une ligne `BoardGame` lue par le mappeur — sans dépendance à @prisma/client. */
interface BoardGameRow {
  id: string;
  name: string;
  nameKey: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  durationMin: number | null;
  createdAt: Date;
}

/** Projection explicite d'une ligne vers le DTO partagé — champ par champ, jamais d'étalement : une
 *  colonne ajoutée plus tard (ex. `ownerId`) ne sort pas sans qu'on l'ait décidé. */
export function toBoardGameDto(row: BoardGameRow): BoardGameDto {
  return {
    id: row.id,
    name: row.name,
    nameKey: row.nameKey,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    durationMin: row.durationMin,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Ludothèque d'une personne (Story 48.1, épic 48) — module de couche 2, SEUL écrivain de la table
 * `BoardGame`. Il n'importe jamais `events/` : la dépendance ira `events/ → board-games/` (épic 49).
 */
@Injectable()
export class BoardGamesService {
  private readonly logger = new Logger(BoardGamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /** Mes jeux, dans l'ordre alphabétique de leur clé normalisée (accents et casse ignorés), puis du nom. */
  async listMine(ownerId: string): Promise<BoardGameDto[]> {
    const rows = await this.prisma.boardGame.findMany({
      where: { ownerId },
      orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toBoardGameDto);
  }

  /**
   * Ajoute un jeu à ma Ludothèque. `name` arrive rogné (DTO) ; sa clé est calculée ici, par la
   * fonction partagée. Refus : `max < min` (400), 500 jeux déjà présents (400), même clé déjà
   * présente (409, contrainte d'unicité `[ownerId, nameKey]`).
   */
  async create(ownerId: string, dto: CreateBoardGameDto): Promise<BoardGameDto> {
    const minPlayers = dto.minPlayers ?? null;
    const maxPlayers = dto.maxPlayers ?? null;
    if (minPlayers !== null && maxPlayers !== null && maxPlayers < minPlayers) {
      throw new BadRequestException(
        'Le nombre maximum de joueurs doit être supérieur ou égal au nombre minimum',
      );
    }
    const name = dto.name.trim();
    const nameKey = boardGameNameKey(name);
    if (nameKey.length === 0) {
      throw new BadRequestException('Le nom du jeu est obligatoire');
    }

    let row: BoardGameRow;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        // Verrou sur la ligne du propriétaire : deux ajouts simultanés se suivent, le décompte du
        // second voit le jeu du premier — le plafond ne peut pas être franchi par une course.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE`;
        const count = await tx.boardGame.count({ where: { ownerId } });
        if (count >= BOARD_GAMES_MAX_PER_OWNER) {
          throw new BadRequestException(
            `Une Ludothèque compte au plus ${BOARD_GAMES_MAX_PER_OWNER} jeux`,
          );
        }
        return tx.boardGame.create({
          data: {
            ownerId,
            name,
            nameKey,
            minPlayers,
            maxPlayers,
            durationMin: dto.durationMin ?? null,
          },
        });
      });
    } catch (err) {
      if (hasPrismaErrorCode(err, 'P2002')) {
        throw new ConflictException('Ce jeu est déjà dans votre Ludothèque');
      }
      throw err;
    }

    // Après le commit, hors de la transaction : une émission ratée ne défait pas l'écriture.
    await this.emitForOwner(ownerId);
    return toBoardGameDto(row);
  }

  // ─── Temps réel ─────────────────────────────────────────────────────────────

  /**
   * Prévient les autres onglets du propriétaire (`user:{id}`) et chaque partie de la famille
   * `ralliement` dont il est membre (`partie:{id}`) — l'onglet des jeux d'une soirée (épic 49) en
   * dépend. Jamais une partie de JDR. Appelée après le commit : un échec ici est consigné, jamais
   * remonté en 500 (le client resoumettrait une écriture déjà faite).
   */
  private async emitForOwner(ownerId: string): Promise<void> {
    try {
      this.realtimeEvents.emit(userTopic(ownerId));
      const memberships = await this.prisma.membership.findMany({
        where: { userId: ownerId, partie: { gameSystemId: { in: RALLIEMENT_SYSTEM_IDS } } },
        select: { partieId: true },
      });
      for (const partieId of new Set(memberships.map((m) => m.partieId))) {
        this.realtimeEvents.emit(partieTopic(partieId));
      }
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel après écriture d'un jeu (ownerId=${ownerId}) : ${String(err)}`,
      );
    }
  }
}
