import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GAME_SYSTEMS,
  boardGameNameKey,
  familyOf,
  type BoardGameDto,
  type GroupBoardGameDto,
  type GroupBoardGamesDto,
  type UserLibraryDto,
} from '@master-jdr/shared';
import { hasPrismaErrorCode } from '../common/prisma-error.util';
import {
  LIBRARY_NOT_FOUND_MESSAGE,
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import type { CreateBoardGameDto } from './dto/create-board-game.dto';
import type { UpdateBoardGameDto } from './dto/update-board-game.dto';

/** Plafond d'une Ludothèque (épic 48) : le 501ᵉ jeu est refusé. */
export const BOARD_GAMES_MAX_PER_OWNER = 500;

/** Refus d'un jeu qui n'est pas à moi (Story 48.2) : le même pour un jeu d'autrui et un inconnu —
 *  rien ne révèle qu'un identifiant existe ailleurs. */
export const BOARD_GAME_NOT_FOUND = 'Jeu introuvable dans votre Ludothèque';

/** Systèmes de la famille `ralliement` : seules ces parties (groupes, rencontres isolées) entendent
 *  parler des jeux de leurs membres — une partie de JDR jamais (même copie locale que
 *  `NotificationsService`, Story 40.7). Lus À L'APPEL, pas à l'import : `events/` importe ce module
 *  (Story 49.5) et certains tests doublent `@master-jdr/shared` sans `GAME_SYSTEMS`. */
function ralliementSystemIds(): string[] {
  return GAME_SYSTEMS.filter((g) => g.family === 'ralliement').map((g) => g.id);
}

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

/** Identité lue pour le propriétaire d'une Ludothèque — pseudo et nom affiché, jamais l'e-mail. */
interface LibraryOwnerRow {
  id: string;
  pseudo: string;
  displayName: string;
}

/** Projection explicite de la Ludothèque d'une personne lue par un tiers (Story 48.3) : champ par
 *  champ, jamais d'étalement de la ligne `User` (qui porte l'e-mail et le hash du mot de passe). */
export function toUserLibraryDto(owner: LibraryOwnerRow, games: BoardGameRow[]): UserLibraryDto {
  return {
    owner: { userId: owner.id, pseudo: owner.pseudo, displayName: owner.displayName },
    games: games.map(toBoardGameDto),
  };
}

/** Ligne `BoardGame` lue avec l'identité publique de son propriétaire, pour la vue d'un groupe (Story 50.1). */
interface GroupBoardGameRow extends BoardGameRow {
  owner: LibraryOwnerRow;
}

/** Ordre des propriétaires d'un jeu : nom affiché (accents et casse ignorés), pseudo, identifiant — total et
 *  stable, de sorte que « la copie du premier propriétaire » est toujours la même. */
function compareOwners(a: LibraryOwnerRow, b: LibraryOwnerRow): number {
  return (
    a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) ||
    a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Regroupe les jeux des membres d'un groupe par clé normalisée (Story 50.1) : une entrée par `nameKey`, dans
 * l'ordre des lignes reçues (déjà triées par clé), avec tous ses propriétaires. Le nom et les mesures sont ceux
 * de la copie du premier propriétaire — ce que la ligne annonce est ce que le filtre du web teste. Projection
 * explicite champ par champ : jamais l'e-mail ni une colonne ajoutée plus tard.
 */
export function toGroupBoardGamesDto(rows: GroupBoardGameRow[]): GroupBoardGamesDto {
  const byKey = new Map<string, GroupBoardGameRow[]>();
  for (const row of rows) {
    const copies = byKey.get(row.nameKey);
    if (copies) copies.push(row);
    else byKey.set(row.nameKey, [row]);
  }
  const games: GroupBoardGameDto[] = [];
  for (const [nameKey, copies] of byKey) {
    const sorted = [...copies].sort((a, b) => compareOwners(a.owner, b.owner));
    const first = sorted[0];
    games.push({
      nameKey,
      name: first.name,
      minPlayers: first.minPlayers,
      maxPlayers: first.maxPlayers,
      durationMin: first.durationMin,
      owners: sorted.map((c) => ({
        userId: c.owner.id,
        pseudo: c.owner.pseudo,
        displayName: c.owner.displayName,
      })),
    });
  }
  return { games };
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
    private readonly permissions: PermissionService,
  ) {}

  /** Mes jeux, dans l'ordre alphabétique de leur clé normalisée (accents et casse ignorés), puis du nom. */
  async listMine(ownerId: string): Promise<BoardGameDto[]> {
    return this.listOfOwner(ownerId);
  }

  /**
   * Les jeux d'une personne, triés comme `listMine` — SANS décision de droit : l'appelant l'a déjà prise.
   * Lue par `events/` (Story 49.1) pour les jeux sur place d'une soirée : l'hôte de l'événement, après
   * `PARTIE_READ` sur l'événement. La dépendance va de `events/` vers ce module, jamais l'inverse.
   */
  async listOfOwner(ownerId: string): Promise<BoardGameDto[]> {
    const rows = await this.prisma.boardGame.findMany({
      where: { ownerId },
      orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toBoardGameDto);
  }

  /**
   * Les jeux désignés par leurs identifiants, triés comme `listOfOwner` — SANS décision de droit : l'appelant
   * (`events/`, Story 49.2) a déjà décidé et ne passe que des identifiants lus d'un apport à une soirée.
   * Un identifiant inconnu est simplement absent du résultat.
   */
  async listByIds(ids: string[]): Promise<BoardGameDto[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.boardGame.findMany({
      where: { id: { in: ids } },
      orderBy: [{ nameKey: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toBoardGameDto);
  }

  /**
   * Parmi `ids`, ceux qui sont des jeux de `ownerId` (Story 49.2) — l'appartenance d'un jeu, lue ici par
   * le seul lecteur de `BoardGame`. Un jeu inconnu ou d'une autre personne est simplement absent : l'appelant
   * répond le même 404 dans les deux cas. `db` permet de lire sur le client d'une transaction.
   */
  async ownedGameIds(
    ownerId: string,
    ids: string[],
    db: Pick<PrismaService, 'boardGame'> = this.prisma,
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db.boardGame.findMany({
      where: { ownerId, id: { in: ids } },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /**
   * L'identifiant et la clé normalisée (`nameKey`) de chaque jeu de `ownerId` — SANS décision de droit
   * (Story 49.5) : lue par `events/` pour décider quels noms sont « sur place » (`onSiteNameKeys`, qui retire
   * les jeux écartés par leur identifiant). `db` permet de lire sur le client d'une transaction, sous le
   * verrou de la soirée.
   */
  async nameKeysOfOwner(
    ownerId: string,
    db: Pick<PrismaService, 'boardGame'> = this.prisma,
  ): Promise<{ id: string; nameKey: string }[]> {
    return db.boardGame.findMany({ where: { ownerId }, select: { id: true, nameKey: true } });
  }

  /**
   * Les clés normalisées des jeux désignés par `ids`, sans doublon — SANS décision de droit (Story 49.5) : les
   * identifiants viennent des apports d'une soirée. Un identifiant inconnu est simplement absent. `db` permet
   * de lire sur le client d'une transaction.
   */
  async nameKeysByIds(
    ids: string[],
    db: Pick<PrismaService, 'boardGame'> = this.prisma,
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await db.boardGame.findMany({
      where: { id: { in: ids } },
      select: { nameKey: true },
    });
    return [...new Set(rows.map((r) => r.nameKey))];
  }

  /**
   * Ludothèque de `ownerUserId` lue par `readerId` (Story 48.3). Le droit est décidé par
   * `PermissionService.assertLibraryRead` (`LIBRARY_READ`) AVANT toute lecture : aucune règle de
   * visibilité n'est recodée ici. Tout refus — dont un compte inconnu — est le même 404.
   */
  async listOf(readerId: string, ownerUserId: string): Promise<UserLibraryDto> {
    await this.permissions.assertLibraryRead(readerId, ownerUserId);
    const [owner, games] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { id: true, pseudo: true, displayName: true },
      }),
      this.prisma.boardGame.findMany({
        where: { ownerId: ownerUserId },
        orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
      }),
    ]);
    if (!owner) throw new NotFoundException(LIBRARY_NOT_FOUND_MESSAGE);
    return toUserLibraryDto(owner, games);
  }

  /**
   * Les jeux des membres ACTUELS d'un groupe (Story 50.1), regroupés par nom normalisé. Le droit est décidé par
   * `PermissionService` (`PARTIE_READ`) AVANT toute lecture : un non-membre est refusé comme partout ; aucune
   * règle de visibilité n'est recodée ici. Seul un GROUPE (`CAMPAGNE_EPISODIQUE` de la famille `ralliement`)
   * a des « jeux du groupe » : une rencontre isolée ou une partie de JDR répond le même 403 que `events/`.
   * Le nombre de membres bornant la lecture (un groupe en compte une vingtaine), aucune pagination.
   */
  async listOfGroup(userId: string, partieId: string): Promise<GroupBoardGamesDto> {
    const { partie } = await this.permissions.assert(userId, 'PARTIE_READ', { partieId });
    if (partie.kind !== 'CAMPAGNE_EPISODIQUE' || familyOf(partie.gameSystemId) !== 'ralliement') {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    const rows = await this.prisma.boardGame.findMany({
      where: { owner: { memberships: { some: { partieId } } } },
      orderBy: [{ nameKey: 'asc' }, { name: 'asc' }],
      include: { owner: { select: { id: true, pseudo: true, displayName: true } } },
    });
    return toGroupBoardGamesDto(rows);
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

  /**
   * Corrige un de mes jeux (Story 48.2). Partiel : champ absent = inchangé, `null` efface un nombre.
   * Mêmes règles qu'à la création : `max ≥ min` vérifié sur les valeurs FUSIONNÉES (400), nouvelle
   * clé recalculée par la fonction partagée ; même clé qu'un AUTRE de mes jeux → 409 (renommer un jeu
   * en lui-même, ou n'en changer que la casse ou les accents, garde sa clé : accepté). Un jeu qui
   * n'est pas à moi — d'une autre personne ou inconnu — répond 404, sans rien écrire ni émettre.
   */
  async update(ownerId: string, id: string, dto: UpdateBoardGameDto): Promise<BoardGameDto> {
    let nameChange: { name: string; nameKey: string } | null = null;
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const nameKey = boardGameNameKey(name);
      if (nameKey.length === 0) {
        throw new BadRequestException('Le nom du jeu est obligatoire');
      }
      nameChange = { name, nameKey };
    }

    let row: BoardGameRow;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        // Verrou sur la ligne du jeu : deux corrections simultanées se suivent, la seconde fusionne
        // ses bornes avec les valeurs écrites par la première (jamais un `max < min` en base).
        await tx.$queryRaw`SELECT "id" FROM "BoardGame" WHERE "id" = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
        const current = await tx.boardGame.findFirst({ where: { id, ownerId } });
        if (!current) {
          throw new NotFoundException(BOARD_GAME_NOT_FOUND);
        }
        const minPlayers = dto.minPlayers !== undefined ? dto.minPlayers : current.minPlayers;
        const maxPlayers = dto.maxPlayers !== undefined ? dto.maxPlayers : current.maxPlayers;
        if (minPlayers !== null && maxPlayers !== null && maxPlayers < minPlayers) {
          throw new BadRequestException(
            'Le nombre maximum de joueurs doit être supérieur ou égal au nombre minimum',
          );
        }
        return tx.boardGame.update({
          where: { id: current.id },
          data: {
            ...(nameChange ?? {}),
            ...(dto.minPlayers !== undefined ? { minPlayers: dto.minPlayers } : {}),
            ...(dto.maxPlayers !== undefined ? { maxPlayers: dto.maxPlayers } : {}),
            ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
          },
        });
      });
    } catch (err) {
      if (hasPrismaErrorCode(err, 'P2002')) {
        throw new ConflictException('Ce jeu est déjà dans votre Ludothèque');
      }
      throw err;
    }

    await this.emitForOwner(ownerId);
    return toBoardGameDto(row);
  }

  /**
   * Retire un de mes jeux (Story 48.2) — immédiat côté API : la confirmation « apporté à N soirées à venir »
   * (Story 49.2) est demandée par l'écran, qui lit `GET /me/board-games/:id/brought-count` avant d'appeler ici.
   * Les apports du jeu à des soirées disparaissent en cascade (`EventGameBring`), comme ses écarts par l'hôte
   * (`EventGameExcluded`, Story 49.4).
   * Suppression filtrée sur le propriétaire : un jeu qui n'est pas à moi n'est jamais touché et répond
   * 404, avec le même message que la correction.
   */
  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.boardGame.deleteMany({ where: { id, ownerId } });
    if (count === 0) {
      throw new NotFoundException(BOARD_GAME_NOT_FOUND);
    }
    await this.emitForOwner(ownerId);
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
        where: { userId: ownerId, partie: { gameSystemId: { in: ralliementSystemIds() } } },
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
