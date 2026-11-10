import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HommeDragon, Prisma } from '@prisma/client';
import type {
  ChooseArtefactCadeauDto as ChooseArtefactCadeauPayload,
  ChooseEveilPowerDto as ChooseEveilPowerPayload,
  SetReserveSlotDto as SetReserveSlotPayload,
  CreateHommeDragonDto,
  HommeDragonAventureDto,
  HommeDragonDto,
  HommeDragonRefDto,
  HommeDragonSheetData,
  MyHommeDragonDto,
  UpdateHommeDragonDto,
} from '@master-jdr/shared';
import {
  ARTEFACT_CADEAU_LEVEL,
  validateHommeDragon,
  computeHommeDragonDerived,
  levelForScenariosPasse,
  pendingEveilLevels,
  reserveCapacity,
  validateReserve,
  type HommeDragonArtefactCatalogEntry,
} from '@master-jdr/game-rules';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { GameSystemService } from '../game-systems/game-system.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { RYUUTAMA_ID } from '../game-systems/supported-game-systems';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';

/** Nombre maximal d'emplacements de la réserve (niveau 5 : 5 − 1) — borne dure du numéro d'emplacement. */
const MAX_RESERVE_SLOTS = 4;

/** Client Prisma ou client d'une transaction : le bloc dérivé s'exécute des deux façons (AD-23). */
type Db = Prisma.TransactionClient;

/** Bloc dérivé complet d'un Homme Dragon (AD-3, AD-23) : tout ce qui se calcule à la lecture. */
interface DerivedBlock {
  aventures: HommeDragonAventureDto[];
  historique: HommeDragonDto['historique'];
  level: number;
  PS: number;
  eveilPowers: { level: number; key: string }[];
  pendingEveilLevels: number[];
}

/**
 * Homme Dragon (Epic 10, 33 ; AD-22, AD-23).
 *
 * Modèle : une fiche appartient à son propriétaire (`userId`, toujours un MJ) et suit 0..N
 * aventures — une aventure de `H` est une partie dont `hommeDragonId = H.id`, sans autre prédicat.
 * La fiche est adressée par son `id` et gardée par son propriétaire : absent ou étranger, c'est
 * `404`, jamais `403`. Les routes par partie ne font que créer / lier (`HOMME_DRAGON_MANAGE`,
 * soumis à la capacité `hommeDragon`), délier (`HOMME_DRAGON_UNLINK`) et référencer
 * (`HOMME_DRAGON_READ`), ces deux dernières sans capacité.
 *
 * Écrivains de `Partie.hommeDragonId` : ce service (create, link, unlink) et `PartiesService.update`
 * (remise à `NULL` au changement de système) — aucun autre.
 */
@Injectable()
export class HommeDragonService {
  constructor(
    private readonly prisma: PrismaService,
    // Signaux de la partie (`notifyPartieSignalsChanged`) : écriture de `parties/`,
    // aucune décision de droit.
    private readonly parties: PartiesService,
    private readonly permissions: PermissionService,
    private readonly gameSystems: GameSystemService,
    private readonly scenarios: ScenariosService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /**
   * Crée un Homme Dragon ET le lie à la partie, dans une même transaction (AD-23) : aucune
   * création hors aventure. Réservé aux systèmes déclarant la capacité `hommeDragon`. Si le lien
   * perd la course (la partie a reçu un Homme Dragon entre-temps), `409` et la création est
   * annulée avec la transaction — aucune fiche orpheline.
   */
  async create(
    partieId: string,
    userId: string,
    dto: CreateHommeDragonDto,
  ): Promise<HommeDragonDto> {
    // La capacité `hommeDragon` du système est contrôlée par `assert()` (400 si absente).
    const { partie } = await this.permissions.assert(userId, 'HOMME_DRAGON_MANAGE', { partieId });

    const catalog = await this.buildArtefactCatalog(partie.gameSystemId);
    const sheetData = {
      ...dto,
      mondesProteges: dto.mondesProteges ?? partie.name,
    };
    const result = validateHommeDragon(sheetData, catalog);
    if (!result.valid) {
      throw new BadRequestException(result.errors);
    }

    const hommeDragon = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hommeDragon.create({
        data: { userId, gameSystemId: RYUUTAMA_ID, sheetData: sheetData },
      });
      await this.linkPartie(tx, partieId, userId, created.id);
      return created;
    });
    await this.emitLinkChanged(partieId, userId);
    return this.buildDto(hommeDragon);
  }

  /**
   * Lie un Homme Dragon à une aventure (AD-23) : `PUT /parties/:id/homme-dragon/:hommeDragonId`.
   * Ordre des refus : partie inaccessible (`403`) ou système sans la capacité `hommeDragon`
   * (`400`), tous deux décidés par `assert()` AVANT toute lecture de la fiche ; puis Homme Dragon
   * absent ou étranger `404` AVANT tout `409` (aucun oracle d'existence) ; puis partie déjà
   * pourvue `409` (jamais de remplacement implicite : dissocier d'abord). Verrou `HommeDragon`
   * pris avant l'écriture de `Partie` (ordre fixé par AD-23).
   */
  async link(partieId: string, hommeDragonId: string, userId: string): Promise<HommeDragonDto> {
    await this.permissions.assert(userId, 'HOMME_DRAGON_MANAGE', { partieId });

    const hommeDragon = await this.prisma.$transaction(async (tx) => {
      await this.lockHommeDragon(tx, hommeDragonId);
      const owned = await tx.hommeDragon.findFirst({ where: { id: hommeDragonId, userId } });
      if (!owned) throw new NotFoundException('Homme Dragon introuvable');
      await this.linkPartie(tx, partieId, userId, hommeDragonId);
      return owned;
    });
    await this.emitLinkChanged(partieId, userId);
    return this.buildDto(hommeDragon);
  }

  /**
   * Délie un Homme Dragon d'une aventure (AD-23) : `DELETE /parties/:id/homme-dragon/:hommeDragonId`.
   * Action `HOMME_DRAGON_UNLINK` (MJ seul) SANS condition de capacité : une partie sortie du
   * système est de toute façon déjà déliée. Zéro ligne touchée = `404` (la partie ne porte pas cet
   * Homme Dragon). Le niveau est recalculé à la lecture suivante et peut baisser ; `sheetData`
   * n'est jamais touché (rien n'est purgé).
   */
  async unlink(partieId: string, hommeDragonId: string, userId: string): Promise<HommeDragonDto> {
    await this.permissions.assert(userId, 'HOMME_DRAGON_UNLINK', { partieId });

    const hommeDragon = await this.prisma.$transaction(async (tx) => {
      await this.lockHommeDragon(tx, hommeDragonId);
      const owned = await tx.hommeDragon.findFirst({ where: { id: hommeDragonId, userId } });
      if (!owned) throw new NotFoundException('Homme Dragon introuvable');
      const { count } = await tx.partie.updateMany({
        where: { id: partieId, ownerId: userId, hommeDragonId },
        data: { hommeDragonId: null },
      });
      if (count === 0) {
        throw new NotFoundException("Cet Homme Dragon n'est pas lié à cette aventure");
      }
      return owned;
    });
    await this.emitLinkChanged(partieId, userId);
    return this.buildDto(hommeDragon);
  }

  /**
   * `GET /parties/:id/homme-dragon` : l'Homme Dragon lié à cette aventure sous forme de référence
   * `{ id, nom }`, ou `null` (état normal, jamais un 404), y compris sur un système sans la
   * capacité `hommeDragon`. MJ seul (`HOMME_DRAGON_READ`) : l'existence d'un Homme Dragon ne
   * fuit jamais vers un joueur.
   */
  async findForPartie(partieId: string, userId: string): Promise<HommeDragonRefDto | null> {
    const { partie } = await this.permissions.assert(userId, 'HOMME_DRAGON_READ', { partieId });
    if (!partie.hommeDragonId) return null;
    const hommeDragon = await this.prisma.hommeDragon.findFirst({
      where: { id: partie.hommeDragonId, userId },
    });
    if (!hommeDragon) return null;
    const sheetData = hommeDragon.sheetData as unknown as HommeDragonSheetData;
    return { id: hommeDragon.id, nom: sheetData.nom ?? '' };
  }

  /**
   * AD-2 : pas de verrouillage optimiste — MJ seul écrivain. Mais, comme toute écriture de fiche
   * (AD-23), le `PATCH` passe par une transaction avec verrou de ligne `FOR NO KEY UPDATE` : la
   * fiche relue sous verrou est celle sur laquelle on fusionne, deux écritures simultanées ne
   * s'écrasent pas. Race jamais éditable (absente d'`UpdateHommeDragonDto`). Toujours revalidé
   * contre le catalogue (revue de code : un `dto` sans `artefact` contournait jusqu'ici la règle
   * « nom obligatoire »). `dto.artefact` est fusionné avec l'artefact existant (revue de code : un
   * spread au niveau racine écrasait `nom`/`inscription` personnalisés dès qu'un `{ key }` seul
   * était envoyé).
   */
  async update(
    hommeDragonId: string,
    userId: string,
    dto: UpdateHommeDragonDto,
  ): Promise<HommeDragonDto> {
    const catalog = await this.buildArtefactCatalog(RYUUTAMA_ID);
    // Le `ValidationPipe` (`transform: true`) rend une instance de classe dont les champs optionnels
    // absents existent en `undefined` (cible ES2023) : un spread brut effacerait alors `nom` ou
    // tout autre champ non envoyé. Seuls les champs réellement fournis sont fusionnés.
    // Même règle une marche plus bas : `dto.artefact` est lui aussi une instance (`ArtefactDto`) dont
    // `nom` et `inscription` valent `undefined` quand le front n'envoie que `{ key }`.
    const withoutUndefined = <T extends object>(source: T): Partial<T> =>
      Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined),
      ) as Partial<T>;
    const provided = withoutUndefined(dto);
    const providedArtefact = provided.artefact ? withoutUndefined(provided.artefact) : undefined;

    const updated = await this.writeSheet(hommeDragonId, userId, ({ sheetData: existing }) => {
      const sheetData: HommeDragonSheetData = {
        ...existing,
        ...provided,
        artefact: providedArtefact
          ? { ...existing.artefact, ...providedArtefact }
          : existing.artefact,
      };
      const result = validateHommeDragon(sheetData, catalog);
      if (!result.valid) {
        throw new BadRequestException(result.errors);
      }
      return sheetData;
    });
    return this.buildDto(updated);
  }

  /**
   * Choix d'un pouvoir d'éveil pour un niveau franchi (Story 10.4) — propriétaire seul, par id.
   * Décision utilisateur : le catalogue `eveilPower` est un pool commun à toutes les races, sans
   * niveau de déblocage par pouvoir — un pouvoir ne peut donc être choisi qu'une seule fois, quel
   * que soit le niveau pour lequel il est choisi. Niveau calculé SOUS le verrou (AD-23) : une
   * dissociation concurrente ne peut pas laisser écrire un éveil pour un niveau périmé.
   */
  async chooseEveilPower(
    hommeDragonId: string,
    userId: string,
    dto: ChooseEveilPowerPayload,
  ): Promise<HommeDragonDto> {
    const catalogKeys = await this.buildEveilPowerCatalogKeys(RYUUTAMA_ID);

    const updated = await this.writeSheet(
      hommeDragonId,
      userId,
      ({ sheetData: existingSheetData, level }) => {
        const appliedEveilPowers: { level: number; key: string }[] =
          existingSheetData.eveilPowers ?? [];

        const pending = pendingEveilLevels(
          level,
          appliedEveilPowers.map((e) => e.level),
        );
        if (!pending.includes(dto.level)) {
          throw new BadRequestException(
            "Ce niveau n'est pas en attente d'un choix de pouvoir d'éveil",
          );
        }

        if (!catalogKeys.has(dto.key)) {
          throw new BadRequestException("Pouvoir d'éveil invalide");
        }
        // Pool commun (décision utilisateur) : un pouvoir n'est jamais proposé deux fois, quel que
        // soit le niveau pour lequel il aurait déjà été choisi.
        if (appliedEveilPowers.some((e) => e.key === dto.key)) {
          throw new BadRequestException("Ce pouvoir d'éveil a déjà été choisi");
        }

        return {
          ...existingSheetData,
          eveilPowers: [...appliedEveilPowers, { level: dto.level, key: dto.key }],
        };
      },
    );
    return this.buildDto(updated);
  }

  /**
   * Choix de l'artefact cadeau du niveau 4 (Story 33.7) — propriétaire seul, par id. Choix unique
   * et définitif : refusé si le niveau est < 4, si un cadeau existe déjà, si la clé est absente du
   * catalogue `hommeDragonArtefact` ou si l'artefact est de la race du dragon. Même mécanique que
   * `chooseEveilPower()` : niveau calculé sous le verrou de ligne, `sheetData` copié plutôt que
   * muté.
   */
  async chooseArtefactCadeau(
    hommeDragonId: string,
    userId: string,
    dto: ChooseArtefactCadeauPayload,
  ): Promise<HommeDragonDto> {
    const catalog = await this.buildArtefactCatalog(RYUUTAMA_ID);

    const updated = await this.writeSheet(
      hommeDragonId,
      userId,
      ({ sheetData: existingSheetData, level }) => {
        if (level < ARTEFACT_CADEAU_LEVEL) {
          throw new BadRequestException(
            `L'artefact cadeau n'est disponible qu'à partir du niveau ${ARTEFACT_CADEAU_LEVEL}`,
          );
        }
        if (existingSheetData.artefactCadeau) {
          throw new BadRequestException("L'artefact cadeau a déjà été choisi");
        }

        const entry = catalog.find((e) => e.key === dto.key);
        // Entrée sans race (mappée à '' par buildArtefactCatalog) : jamais un cadeau valide.
        if (!entry || !entry.race) {
          throw new BadRequestException('Artefact cadeau invalide');
        }
        if (entry.race === existingSheetData.race) {
          throw new BadRequestException(
            "L'artefact cadeau doit appartenir à une autre race que celle de l'Homme Dragon",
          );
        }

        return { ...existingSheetData, artefactCadeau: { key: dto.key } };
      },
    );
    return this.buildDto(updated);
  }

  /**
   * Écriture d'UN emplacement de la réserve de souffles (Story 33.6, AD-22) — propriétaire seul,
   * par id. `slot` est 1-based ; `key: null` retire le souffle. Un seul emplacement par appel
   * (écriture à chaque geste côté fiche) : le geste est appliqué à la liste LUE SOUS VERROU, puis
   * toute la composition résultante est revalidée contre les catalogues `souffle` et
   * `souffleRituel` (capacité, souffles du temps, autre race, rituels). Une demande invalide est
   * rejetée (400) sans rien écrire. Niveau calculé sous le verrou (AD-23). Aucune purge d'un
   * surplus après une baisse de niveau : ce qui est inchangé est toléré, et le RETRAIT d'un souffle
   * (`key: null`) reste permis à tout niveau, y compris 1 — seuls les ajouts hors règles sont
   * refusés.
   */
  async setReserveSlot(
    hommeDragonId: string,
    userId: string,
    slot: number,
    dto: SetReserveSlotPayload,
  ): Promise<HommeDragonDto> {
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_RESERVE_SLOTS) {
      throw new BadRequestException(`Emplacement invalide (de 1 à ${MAX_RESERVE_SLOTS})`);
    }
    const content = await this.gameSystems.getContent(RYUUTAMA_ID);
    const catalogs = {
      souffles: content['souffle'] ?? [],
      rituels: content['souffleRituel'] ?? [],
    };

    const updated = await this.writeSheet(
      hommeDragonId,
      userId,
      ({ sheetData: existingSheetData, level }) => {
        // Niveau 1 : capacité 0, aucune réserve à composer — un AJOUT est refusé d'emblée (message
        // dédié) ; un retrait reste permis (cf. ci-dessus).
        if (dto.key !== null && reserveCapacity(level) < 1) {
          throw new BadRequestException("La réserve de souffles s'ouvre au niveau 2");
        }
        const previous = existingSheetData.reserve ?? [];

        // Geste appliqué à la liste lue sous verrou (copie, jamais de mutation de l'objet Prisma).
        // Un retrait au-delà de la fin de la liste n'a rien à vider : la liste n'est pas allongée.
        const reserve: (string | null)[] = Array.from(
          { length: dto.key === null ? previous.length : Math.max(previous.length, slot) },
          (_, i) => previous[i] ?? null,
        );
        if (slot <= reserve.length) reserve[slot - 1] = dto.key;

        const result = validateReserve(reserve, level, existingSheetData.race, catalogs, previous);
        if (!result.valid) {
          throw new BadRequestException(result.errors);
        }

        return { ...existingSheetData, reserve };
      },
    );
    return this.buildDto(updated);
  }

  /**
   * `hommeDragon.userId` EST le MJ propriétaire (toujours créé par un MJ via
   * `HOMME_DRAGON_MANAGE` — jamais un joueur). Utilisé pour l'export PDF (Story 10.5),
   * `HommeDragonDto` n'exposant pas le pseudo du propriétaire.
   */
  async getOwnerPseudo(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pseudo: true },
    });
    return user.pseudo;
  }

  /**
   * Lecture de la fiche, réservée à son propriétaire (AD-22/AD-23) : un Homme Dragon absent ou
   * appartenant à un autre répond `404` dans les deux cas — son existence ne fuit pas, `GET` comme
   * export PDF (qui passe par cette méthode).
   */
  async findOne(hommeDragonId: string, userId: string): Promise<HommeDragonDto> {
    const hommeDragon = await this.prisma.hommeDragon.findFirst({
      where: { id: hommeDragonId, userId },
    });
    if (!hommeDragon) throw new NotFoundException('Homme Dragon introuvable');
    return this.buildDto(hommeDragon);
  }

  /**
   * Lecture agrégée pour « Personnages » (Story 33.5) : les Hommes Dragons de l'appelant, en une
   * seule requête (jamais une requête par fiche) et sans le bloc dérivé (qui calcule niveau et
   * historique). Filtrée par propriétaire seul (AD-23) : un Homme Dragon sans aucune aventure y
   * reste visible, avec `aventures: []`.
   */
  async findMine(userId: string): Promise<MyHommeDragonDto[]> {
    const rows = await this.prisma.hommeDragon.findMany({
      where: { userId },
      include: {
        parties: {
          select: { id: true, name: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      // Colonne JSON : relecture vers le contrat au seul point de sortie (cf. buildDto).
      const sheetData = row.sheetData as unknown as HommeDragonSheetData;
      return {
        id: row.id,
        aventures: row.parties.map((p) => ({ partieId: p.id, nom: p.name })),
        gameSystemId: row.gameSystemId,
        nom: sheetData.nom ?? '',
        race: sheetData.race,
        ...(sheetData.avatar ? { avatar: sheetData.avatar } : {}),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  /**
   * Verrou de ligne `SELECT … FOR NO KEY UPDATE` sur l'Homme Dragon, par `id` (AD-23) : compatible
   * avec les verrous de clé étrangère qu'un `UPDATE` de `Partie.hommeDragonId` prend sur cette
   * ligne. Ordre de prise fixé : `HommeDragon` puis `Partie`. Toute écriture de fiche, ainsi que
   * link et unlink, passe par ici.
   */
  private async lockHommeDragon(tx: Db, hommeDragonId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "HommeDragon" WHERE id = ${hommeDragonId} FOR NO KEY UPDATE`;
  }

  /**
   * Écriture de fiche : transaction, verrou, relecture `{ id, userId }` sous verrou (absent ou
   * étranger : `404`), niveau calculé SOUS le verrou par le bloc dérivé, puis `mutate` rend la
   * nouvelle `sheetData` (copie, l'objet relu n'est jamais muté) — qui peut lever pour refuser.
   * Aucune émission temps réel : le client qui écrit se met à jour avec la réponse (AD-23).
   */
  private async writeSheet(
    hommeDragonId: string,
    userId: string,
    mutate: (ctx: { sheetData: HommeDragonSheetData; level: number }) => HommeDragonSheetData,
  ): Promise<HommeDragon> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockHommeDragon(tx, hommeDragonId);
      const existing = await tx.hommeDragon.findFirst({ where: { id: hommeDragonId, userId } });
      if (!existing) throw new NotFoundException('Homme Dragon introuvable');

      const { level } = await this.computeDerivedBlock(tx, hommeDragonId, 'level');
      const sheetData = mutate({
        sheetData: existing.sheetData as unknown as HommeDragonSheetData,
        level,
      });
      return tx.hommeDragon.update({
        where: { id: hommeDragonId },
        data: { sheetData: sheetData as unknown as Prisma.InputJsonObject },
      });
    });
  }

  /**
   * Pose le lien en UN statement conditionnel (AD-23) : partie du MJ appelant, Ryuutama, sans
   * Homme Dragon. Zéro ligne = la partie en a déjà un (ou a changé de système entre-temps) :
   * `409`, sans remplacement implicite. Sous le verrou de l'Homme Dragon et, pour `create()`, dans
   * la transaction de sa création (le `409` l'annule).
   *
   * Le filtre `gameSystemId: RYUUTAMA_ID` est un garde d'écriture atomique (course avec un
   * changement de système) : il DOIT suivre la capacité `hommeDragon` du registre le jour où un
   * autre système la déclare, faute de quoi `link`/`create` y répondraient `409` malgré le feu
   * vert de `assert()`.
   */
  private async linkPartie(
    tx: Db,
    partieId: string,
    userId: string,
    hommeDragonId: string,
  ): Promise<void> {
    const { count } = await tx.partie.updateMany({
      where: { id: partieId, ownerId: userId, gameSystemId: RYUUTAMA_ID, hommeDragonId: null },
      data: { hommeDragonId },
    });
    if (count === 0) throw new ConflictException('Cette aventure a déjà un Homme Dragon');
  }

  /**
   * Create, link, unlink : `partie:{id}` puis les signaux (`HOMME_DRAGON_A_CREER` change), hors
   * transaction (P7-AD-2). `assert()` a déjà garanti que `userId` est le MJ.
   */
  private async emitLinkChanged(partieId: string, userId: string): Promise<void> {
    this.realtimeEvents.emit(partieTopic(partieId));
    await this.parties.notifyPartieSignalsChanged(partieId, userId);
  }

  private async buildArtefactCatalog(
    gameSystemId: string,
  ): Promise<HommeDragonArtefactCatalogEntry[]> {
    const content = await this.gameSystems.getContent(gameSystemId);
    return (content['hommeDragonArtefact'] ?? []).map((entry) => ({
      key: entry.key,
      race: (entry.data as { race?: string })?.race ?? '',
    }));
  }

  private async buildEveilPowerCatalogKeys(gameSystemId: string): Promise<Set<string>> {
    const content = await this.gameSystems.getContent(gameSystemId);
    return new Set((content['eveilPower'] ?? []).map((entry) => entry.key));
  }

  /**
   * AD-3 : tout ce qui est dérivé (aventures, historique, niveau, PS, éveils en attente) est
   * calculé à la lecture, jamais stocké — pour TOUTE réponse contenant l'état de la fiche, jamais
   * seulement `findOne()`, afin de ne jamais renvoyer une forme de DTO incohérente selon la route.
   */
  private async buildDto(hommeDragon: HommeDragon): Promise<HommeDragonDto> {
    // Colonne JSON : Prisma la rend en `JsonValue`, sans forme garantie. Relecture vers le type
    // du contrat ici, au seul point de sortie.
    const sheetData = hommeDragon.sheetData as unknown as HommeDragonSheetData;
    const block = await this.computeDerivedBlock(this.prisma, hommeDragon.id, 'full', sheetData);
    return {
      id: hommeDragon.id,
      userId: hommeDragon.userId,
      gameSystemId: hommeDragon.gameSystemId,
      sheetData,
      createdAt: hommeDragon.createdAt.toISOString(),
      updatedAt: hommeDragon.updatedAt.toISOString(),
      aventures: block.aventures,
      historique: block.historique,
      derived: { level: block.level, PS: block.PS },
      eveilPowers: block.eveilPowers,
      pendingEveilLevels: block.pendingEveilLevels,
    };
  }

  /**
   * Bloc dérivé UNIQUE (AD-3, AD-23) : `aventures`, `historique`, niveau, PS et éveils en attente
   * naissent ici, et nulle part ailleurs. Accepte le client Prisma ou celui d'une transaction.
   *
   * - mode `'level'` : le niveau seul, sous le verrou d'une écriture de fiche — un simple comptage
   *   des scénarios `PASSE` des parties dont `hommeDragonId = H.id` (même ensemble que
   *   `historique`), sans aucune lecture de participants ;
   * - mode `'full'` : le bloc entier. `historique` = scénarios `PASSE` de TOUTES les aventures
   *   (lecture en lot de `ScenariosService`, jamais une boucle par partie), chacun avec sa
   *   `partieId`, triés par `closedAt` puis `id` ; niveau = `levelForScenariosPasse(historique.length)`.
   */
  private async computeDerivedBlock(
    db: Db,
    hommeDragonId: string,
    mode: 'level',
  ): Promise<{ level: number }>;
  private async computeDerivedBlock(
    db: Db,
    hommeDragonId: string,
    mode: 'full',
    sheetData: HommeDragonSheetData,
  ): Promise<DerivedBlock>;
  private async computeDerivedBlock(
    db: Db,
    hommeDragonId: string,
    mode: 'level' | 'full',
    sheetData?: HommeDragonSheetData,
  ): Promise<{ level: number } | DerivedBlock> {
    if (mode === 'level') {
      const passe = await db.scenario.count({
        where: { status: 'PASSE', closedAt: { not: null }, event: { partie: { hommeDragonId } } },
      });
      return { level: levelForScenariosPasse(passe) };
    }

    const parties = await db.partie.findMany({
      where: { hommeDragonId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    const { scenarios, membersByPartie } = await this.scenarios.findPasseForParties(
      parties.map((p) => p.id),
    );

    // AD-4 (Story 8.1) : la règle de participation (épisodique : inscrits ; sinon tous les membres
    // actuels) est celle de `ScenariosService`, appliquée par la lecture en lot.
    const historique = scenarios.map((s) => ({
      scenarioTitle: s.title,
      date: s.closedAt,
      participants: s.participants.map((p) => p.pseudo),
      partieId: s.partieId,
    }));
    const aventures = parties.map((p) => ({
      partieId: p.id,
      nom: p.name,
      voyageurs: (membersByPartie.get(p.id) ?? []).map((m) => ({
        userId: m.userId,
        pseudo: m.pseudo,
        displayName: m.displayName,
      })),
    }));

    const level = levelForScenariosPasse(historique.length);
    const { PS } = computeHommeDragonDerived(level);
    const eveilPowers = sheetData?.eveilPowers ?? [];
    return {
      aventures,
      historique,
      level,
      PS,
      eveilPowers,
      pendingEveilLevels: pendingEveilLevels(
        level,
        eveilPowers.map((e) => e.level),
      ),
    };
  }
}
