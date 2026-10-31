import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Partie, Prisma } from '@prisma/client';
import type {
  AggregatedSlotDto,
  AvailableSlotDto,
  ListViewMode,
  PartieDto,
  PartieKindTransitionRefusal,
  PartieProgress,
  PartieRole,
  PartieStatus,
  SlotStatus,
} from '@master-jdr/shared';
// Imports RUNTIME de `@master-jdr/shared` dans ce service : la matrice de conversion (Story 29.14,
// partagée avec le formulaire d'édition) et les lecteurs du registre des systèmes (Story 37.5,
// même source que `PartieForm`). `apps/api/package.json` (`transformIgnorePatterns`)
// laisse déjà ts-jest transformer `@master-jdr/*` : `parties.service.spec.ts` n'a donc besoin
// d'AUCUN `jest.mock('@master-jdr/shared')` pour ces imports (la vraie matrice/le vrai
// registre y sont exercés). Ce mock n'est requis que côté `parties.controller.spec.ts`, pour une
// tout autre raison : les DTO évaluent `@IsIn(GAME_SYSTEM_IDS)` au chargement de la classe.
import {
  checkPartieKindTransition,
  familyOf,
  isOpenForCreation,
  kindsOf,
  MAX_SLOT_WINDOW_SLOTS,
  partieStatus,
  spanSlots,
} from '@master-jdr/shared';
import { AvailabilityService } from '../availability/availability.service';
import { EventCancellationMailer } from '../events/event-cancellation-mailer.service';
import { EVENING_CANCELLED_MESSAGE, EventsService } from '../events/events.service';
import {
  ADMIN_ONLY_MESSAGE,
  NO_ACCESS_MESSAGE,
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import type { PartieSignalsPort } from '../poll/ports/partie-signals.port';
import { PollVoteCleanupService } from '../poll/poll-vote-cleanup.service';
import type { SlotWindowKeyBody } from './dto/slot-window.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import {
  detectImageMime,
  extractUploadFilename,
  stripImageMetadata,
  unlinkUploadFile,
  type DetectedImageMime,
} from '../common/image-upload.util';
import { UPLOADS_ROOT } from '../common/uploads-root';
import { ConvertPartieKindDto } from './dto/convert-partie-kind.dto';
import { CreatePartieDto } from './dto/create-partie.dto';
import { SPAN_MESSAGE } from './dto/get-available-slots.dto';
import { SetMemberRoleDto } from './dto/set-member-role.dto';
import { SetVisibilityLocksDto } from './dto/set-visibility-locks.dto';
import { UpdatePartieDto } from './dto/update-partie.dto';

/** Traduit un code de refus de conversion (union fermée) en message destiné au MJ.
 *  NFR-4 : le message nomme la cause réelle et le nombre en jeu — jamais un texte générique. */
function refusalMessage(refusal: PartieKindTransitionRefusal, scenarioCount: number): string {
  switch (refusal) {
    case 'PARTIE_CLOSED':
      return 'Cette partie est clôturée : rouvrez-la avant de changer son type';
    case 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT':
      return `Cette partie compte ${scenarioCount} scénarios ; un one-shot n'en a qu'un`;
    default: {
      // Revue de code : `apps/api/tsconfig.json` n'active pas `noImplicitReturns` — sans cette
      // garde, un futur membre ajouté à `PartieKindTransitionRefusal` sans mettre à jour ce
      // `switch` retournerait silencieusement `undefined` au lieu d'échouer bruyamment.
      const exhaustive: never = refusal;
      throw new Error(`Motif de refus de conversion non géré : ${String(exhaustive)}`);
    }
  }
}

/** Dossier/préfixe du domaine couverture (Story 29.12, AD-17) — paramétrise l'utilitaire d'upload
 *  commun, même patron que `PORTRAITS_DIR`/`PORTRAITS_URL_PREFIX` (`character.service.ts`). */
export const COVERS_DIR = join(UPLOADS_ROOT, 'covers');
export const COVERS_URL_PREFIX = '/uploads/covers/';

const INVALID_COVER_IMAGE_MESSAGE = "Le fichier fourni n'est pas une image JPEG/PNG/WEBP valide";

/** Story 29.17, AC2/AC4 : message de refus explicite quand la création ou le changement de
 *  système de jeu cible un système fermé à la création (Story 37.5 : `isOpenForCreation()`).
 *  Exportée pour que les specs l'importent plutôt que de retaper le texte en dur (revue de
 *  code). */
export const GAME_SYSTEM_WITHOUT_MODULE_MESSAGE =
  'Ce système de jeu ne propose pas encore de création de personnage jouable';

/** Story 37.5 : refus d'un changement de système qui ferait passer la partie d'une famille à une
 *  autre (ex. `jdr` → `ralliement`) — les données propres à chaque famille ne se convertissent pas. */
export const GAME_SYSTEM_FAMILY_CHANGE_MESSAGE =
  "Impossible de changer de famille de système : une partie de jeu de rôle ne peut pas devenir un ralliement, ni l'inverse";

/** Story 37.5 : la conversion de type (matrice `checkPartieKindTransition`) est réservée à la
 *  famille `jdr`. */
export const KIND_CONVERSION_NOT_JDR_MESSAGE =
  'Le type de cette partie ne peut pas être converti : la conversion est réservée aux parties de jeu de rôle';

/** Story 38.2 : le type de partie demandé n'est pas admis par le système (registre, `kindsOf`) —
 *  ex. une campagne linéaire pour un ralliement. */
export const KIND_NOT_ALLOWED_FOR_SYSTEM_MESSAGE =
  "Ce type de partie n'est pas disponible pour ce système de jeu";

/** Story 38.2 : le type (`kind`) et le système d'un ralliement sont définitifs. */
/** Refus de retirer de sa liste une partie qui n'est ni terminée ni annulée (Story 42.5, FR17). */
export const HIDE_NOT_OVER_MESSAGE =
  'Seule une partie terminée ou annulée peut être retirée de votre liste';
/** Refus de masquer une fenêtre de l'automate dont le jour est passé (Story 46.4). */
export const HIDE_WINDOW_PAST_MESSAGE =
  'Cette fenêtre est déjà passée : elle ne peut plus être masquée';
export const RALLIEMENT_TYPE_LOCKED_MESSAGE = "Le type d'un ralliement ne peut pas être modifié";

/** Story 39.3 : un administrateur ne retire qu'un simple membre. Story 39.5 : le créateur n'est plus
 *  protégé une fois redevenu simple membre (c'est le rôle qui décide, pas `ownerId`) ; un autre
 *  administrateur reste protégé, et soi-même relève de « Quitter le groupe ». */
export const RALLIEMENT_REMOVE_PROTECTED_MESSAGE =
  'Seul un membre ordinaire peut être retiré : ni un administrateur, ni vous-même';

/**
 * Story 39.5 — motif d'une sortie de partie, union FERMÉE. `LEFT` : départ volontaire
 * (`DELETE /parties/:id/members/me`) ; `deleteIfLastAdmin` confirme explicitement que le départ du
 * DERNIER administrateur supprime le groupe. `REMOVED` : retrait par un administrateur (ou, en JDR,
 * par le MJ) désigné par `byUserId`.
 *
 * Point d'extension : l'epic 43 (suppression de compte) ajoutera ici son propre motif, traité par
 * la même procédure `PartiesService.leave()`, sans nouvelle route.
 */
export type LeaveCause =
  | { type: 'LEFT'; deleteIfLastAdmin?: boolean }
  | { type: 'REMOVED'; byUserId: string }
  // Story 43.2 : effacement du compte — ne passe jamais par `leave()` (route) mais par la même
  // procédure sous verrou, dans la transaction de l'effacement ; la suppression d'un groupe sans
  // autre administrateur y est d'office confirmée.
  | { type: 'ACCOUNT_DELETION' };

/** Ce qu'une sortie de groupe a fait, de quoi émettre et notifier APRÈS le commit. */
interface DepartureOutcome {
  deleted: boolean;
  ownerCleared: boolean;
  participantIds: string[];
  cancelledEventIds: string[];
}

/** Ce que l'effacement d'un compte a fait dans sa transaction (Story 43.2), à émettre APRÈS le commit. */
export interface AccountErasureEffects {
  /** Parties de JDR du compte supprimées, avec les joueurs à prévenir. */
  deletedJdr: { partieId: string; participantIds: string[] }[];
  /** Parties de JDR où le compte n'était que joueur. */
  jdrDepartures: { partieId: string; ownerId: string | null }[];
  /** Groupes quittés (ou supprimés faute d'autre administrateur). */
  groupDepartures: { partieId: string; ownerId: string | null; outcome: DepartureOutcome }[];
}

/** Story 39.4 : refus d'un mouvement de rôle qui n'existe pas (nommer un administrateur, ou
 *  quitter soi-même l'office — rien d'autre). */
export const ROLE_ALREADY_ADMIN_MESSAGE = 'Ce membre est déjà administrateur du groupe';
export const ROLE_SELF_APPOINT_MESSAGE = 'Vous êtes déjà administrateur du groupe';
export const ROLE_DEMOTE_OTHER_MESSAGE =
  "Seul un administrateur peut quitter son propre office : on ne retire pas l'office à un autre";

/** Story 39.4 : quitter l'office en étant le dernier administrateur supprime le groupe — refusé
 *  tant que la suppression n'est pas confirmée explicitement (`deleteIfLastAdmin`). */
export const LAST_ADMIN_MESSAGE =
  "Vous êtes le dernier administrateur : quitter l'office supprimerait le groupe. Nommez d'abord un autre administrateur, ou confirmez la suppression";

/**
 * Dimensions cibles des dérivées (Story 29.12, AC9) — alignées sur le rendu réel de `PartyBanner`
 * (Stories 29.10/29.11 : grand 320×124, moyen 44×44, liste 28×28), doublées pour rester nettes sur
 * les écrans à forte densité. Fixées côté serveur, jamais un `dpr` ni une largeur venus du client
 * (vecteur de déni de service par redimensionnement).
 */
const COVER_DIMENSIONS: Record<ListViewMode, { width: number; height: number }> = {
  large: { width: 640, height: 248 },
  medium: { width: 88, height: 88 },
  compact: { width: 56, height: 56 },
};

/** Dérivées pré-générées au dépôt, jamais redimensionnées à la volée (coût CPU × 12 tuiles × chaque
 *  chargement de liste, cf. Décisions de la story). Toutes converties en WebP — allège nettement
 *  par rapport à la conservation du format d'entrée, ce qui sert directement AC9. */
const COVER_DERIVATIVE_MIME: DetectedImageMime = 'image/webp';
const COVER_DERIVATIVE_EXT = '.webp';

/**
 * Jeton de version dérivé de `Partie.coverImageUrl` (Story 29.12, AD-19) — le stem UUID du fichier
 * déposé, sans extension. `null` si aucune couverture. Jamais le chemin de stockage exposé côté
 * client : seule sa présence/son changement comptent (indicateur + cache-busting).
 */
export function coverImageVersion(coverImageUrl: string | null): string | null {
  const filename = extractUploadFilename(coverImageUrl, COVERS_URL_PREFIX);
  if (!filename) return null;
  return filename.slice(0, filename.lastIndexOf('.'));
}

/**
 * Projection explicite (AD-15, Story 29.1) — énumère les champs renvoyés, jamais un objet Prisma
 * propagé tel quel.
 *
 * `progress` détermine `status` (AD-8) : `closedAt` renseigné prime toujours (`TERMINEE`),
 * sinon la présence d'au moins un `Event` (Story 37.3 : chaque scénario en est l'extension) fait
 * passer de `A_VENIR` à `EN_COURS`. Compter les événements suffit à détecter « sans aucun scénario
 * ni séance » — `Seance.eventId` est une FK obligatoire (pas de séance orpheline) et tout événement
 * créé reçoit systématiquement au moins une séance (cf. `EventsService.createInTx`).
 * Story 40.1 : pour un GROUPE de ralliement (`CAMPAGNE_EPISODIQUE`), tout événement compte — sa
 * première conjonction le fait passer `EN_COURS`. Story 41.4 (AD-18) : une rencontre isolée est
 * `TERMINEE` dès que `closedAt` est posé OU que sa plage de dates est passée (`'ended'`) ; sans date elle
 * reste `A_VENIR`. `progress` est la seule entrée de cette dérivation (cf. `isRalliementGroup`).
 */
function toPartieDto(
  partie: Partie,
  role: PartieRole,
  progress: PartieProgress,
  isFavorite: boolean,
): PartieDto {
  // Story 44.2 (AD-15) : la dérivation est UNE fonction partagée (`partieStatus`), lue aussi par les
  // sondages ouverts. Story 42.2 : annulée l'emporte sur terminée, distincte d'elle.
  const status: PartieStatus = partieStatus(partie.closedAt, progress);
  return {
    id: partie.id,
    name: partie.name,
    kind: partie.kind,
    gameSystemId: partie.gameSystemId,
    description: partie.description,
    ownerId: partie.ownerId,
    createdAt: partie.createdAt.toISOString(),
    nextSessionDate: partie.nextSessionDate?.toISOString() ?? null,
    nextSessionSlot: partie.nextSessionSlot,
    // Story 47.2 : fin de la plage de la prochaine séance (égale au début pour un créneau).
    nextSessionEndDate: partie.nextSessionEndDate?.toISOString() ?? null,
    nextSessionEndSlot: partie.nextSessionEndSlot ?? null,
    role,
    status,
    isFavorite,
    coverImageVersion: coverImageVersion(partie.coverImageUrl ?? null),
  };
}

/** Story 40.1 : un groupe de ralliement (`CAMPAGNE_EPISODIQUE` de la famille `ralliement`) est
 *  « commencé » dès son premier événement (conjonction), qui n'a jamais de `Scenario`. La rencontre
 *  isolée de ralliement et toute partie de JDR gardent la règle historique (événement porteur d'un
 *  scénario). Seule source de cette distinction pour le statut. */
function isRalliementGroup(partie: Pick<Partie, 'kind' | 'gameSystemId'>): boolean {
  return partie.kind === 'CAMPAGNE_EPISODIQUE' && familyOf(partie.gameSystemId) === 'ralliement';
}

/** Story 41.4 : une rencontre isolée de ralliement (`ONE_SHOT`), dont le statut suit sa date. */
function isIsolatedRalliement(partie: Pick<Partie, 'kind' | 'gameSystemId'>): boolean {
  return partie.kind === 'ONE_SHOT' && familyOf(partie.gameSystemId) === 'ralliement';
}

@Injectable()
export class PartiesService implements PartieSignalsPort {
  private readonly logger = new Logger(PartiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly events: EventsService,
    // Story 37.6 (AD-6) : toute décision de droit sur une partie passe par ce service.
    private readonly permissions: PermissionService,
    // Story 40.8 : le module `poll/` retire les réponses de la personne qui sort (`leave()`).
    private readonly polls: PollVoteCleanupService,
    // Story 42.3 : e-mail n° 7 aux inscrits des conjonctions annulées par le départ de leur hôte.
    private readonly cancellationMailer: EventCancellationMailer,
  ) {}

  /** Story 29.17, AC2/AC4 : refus explicite partagé par `create()` et `update()` — un seul endroit
   *  à faire évoluer si la règle change (revue de code : les deux étaient des blocs copiés-collés
   *  indépendants, jamais comparés par aucun test). */
  private assertGameSystemOpenForCreation(gameSystemId: string): void {
    if (!isOpenForCreation(gameSystemId)) {
      throw new BadRequestException(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE);
    }
  }

  async create(ownerId: string, dto: CreatePartieDto): Promise<PartieDto> {
    // Story 29.17, AC2 : refus AVANT toute écriture — même discipline que la garde `kind` de
    // `convertKind()` (aucune trace en base d'une partie sur un système sans module).
    this.assertGameSystemOpenForCreation(dto.gameSystemId);
    // Story 38.2 : le type demandé doit être admis par le système (le registre est la seule source).
    if (!kindsOf(dto.gameSystemId).includes(dto.kind)) {
      throw new BadRequestException(KIND_NOT_ALLOWED_FOR_SYSTEM_MESSAGE);
    }
    const isRalliement = familyOf(dto.gameSystemId) === 'ralliement';
    const created = await this.prisma.$transaction(async (tx) => {
      const partie = await tx.partie.create({
        data: {
          name: dto.name,
          kind: dto.kind,
          gameSystemId: dto.gameSystemId,
          description: dto.description ?? null,
          ownerId,
        },
      });

      // Story 38.2 : le créateur d'un ralliement est aussi membre `ADMIN`, dans la même transaction
      // que la partie (`ownerId` reste le créateur, AD-5). Le rôle d'un ralliement vient de cette
      // ligne uniquement.
      if (isRalliement) {
        await tx.membership.create({
          data: { userId: ownerId, partieId: partie.id, role: 'ADMIN' },
        });
        // Rencontre isolée : un événement et une séance non datée, SANS extension `Scenario` (le
        // scénario n'existe que pour les événements de JDR). Un groupe n'a aucun événement.
        if (dto.kind === 'ONE_SHOT') {
          await this.events.createInTx(tx, {
            partieId: partie.id,
            title: partie.name,
            ownerId: partie.ownerId,
          });
        }
        // Aucun `Scenario` n'existe dans un ralliement : `hasScenario` vaut toujours faux.
        return toPartieDto(partie, 'admin', 'none', false);
      }

      // AD-7 : une Partie ONE_SHOT n'existe jamais sans son scénario unique — créé au même titre
      // que la Partie, statut BROUILLON, ouverture (BROUILLON→A_VENIR) toujours une action MJ
      // explicite ultérieure (Story 7.3), jamais automatique ici.
      // Story 37.3 : l'événement de base et sa première séance sont créés par `EventsService`
      // (variante transactionnelle) ; la ligne `Scenario` qui l'étend est écrite par le rappel
      // ci-dessous — exception connue à la table des écrivains (couche 2 sans import de la couche
      // 3), à refermer avec les capacités (37.5–37.7).
      if (dto.kind === 'ONE_SHOT') {
        await this.events.createInTx(
          tx,
          { partieId: partie.id, title: partie.name, ownerId: partie.ownerId },
          (etx, event) => etx.scenario.create({ data: { id: event.id, status: 'BROUILLON' } }),
        );
      }

      // Le créateur est toujours MJ de la partie qu'il crée (revue de code, AC6).
      // hasScenario connu synchronement : le scénario unique vient d'être créé dans cette même
      // transaction pour ONE_SHOT (ci-dessus) ; CAMPAGNE_LINEAIRE/CAMPAGNE_EPISODIQUE n'en créent
      // aucun — aucune requête `scenario.count()` nécessaire ici (Story 29.6).
      // isFavorite toujours false ici : une partie tout juste créée n'est jamais favorite,
      // aucune requête `partieFavorite` nécessaire (Story 29.8).
      return toPartieDto(partie, 'mj', dto.kind === 'ONE_SHOT' ? 'started' : 'none', false);
    });
    // Story 38.5 : la transaction est validée — la liste d'accueil du créateur (autre onglet, autre
    // appareil) se rafraîchit sans rechargement, pour toute famille. Hors transaction, et un échec
    // d'émission ne fait jamais échouer une création déjà enregistrée.
    try {
      this.realtimeEvents.emit(userTopic(ownerId));
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel après la création de la partie ${created.id} : ${String(err)}`,
      );
    }
    return created;
  }

  /** Lecture en lot (AD-3) : une seule requête groupée pour dériver `status` de tout le tableau
   *  renvoyé — jamais un `scenario.count()` par partie dans une boucle (Story 29.6). Story 40.1 :
   *  les groupes de ralliement du lot (s'il y en a) sont lus par UNE seconde requête groupée, sans
   *  filtre de scénario ; une liste sans groupe garde exactement la requête historique. */
  private async progressByPartieId(
    parties: Pick<Partie, 'id' | 'kind' | 'gameSystemId'>[],
  ): Promise<(partieId: string) => PartieProgress> {
    // Story 44.2 : la lecture en lot vit dans `events/` (qui la sert aussi aux sondages ouverts).
    return this.events.progressByPartieIds(parties);
  }

  /** Story 42.2 : une soirée isolée annulée n'accepte plus aucune action — renommer, clore, rouvrir (400). Les
   *  autres écritures (invitations, retrait d'invité, modification, vote) passent par `assertIsolatedOpen`. */
  private async assertEveningNotCancelled(
    partie: Pick<Partie, 'id' | 'kind' | 'gameSystemId'>,
  ): Promise<void> {
    if (!isIsolatedRalliement(partie)) return;
    if ((await this.events.cancelledIsolatedPartieIds([partie.id])).has(partie.id)) {
      throw new BadRequestException(EVENING_CANCELLED_MESSAGE);
    }
  }

  /** Variante mono-partie de `progressByPartieId` — la lecture en lot (AD-3) ne s'applique pas
   *  quand une seule partie est concernée (`findOneDto`, `update`, `close`, `reopen`). */
  private async progressOf(
    partie: Pick<Partie, 'id' | 'kind' | 'gameSystemId'>,
  ): Promise<PartieProgress> {
    // Story 41.4 : une rencontre isolée dont la plage de dates est passée est terminée.
    if (isIsolatedRalliement(partie)) {
      // Story 42.2 : annulée l'emporte sur terminée.
      if ((await this.events.cancelledIsolatedPartieIds([partie.id])).has(partie.id)) {
        return 'cancelled';
      }
      return (await this.events.endedIsolatedPartieIds([partie.id])).has(partie.id)
        ? 'ended'
        : 'none';
    }
    // Story 40.1 : un groupe de ralliement compte toutes ses conjonctions.
    if (isRalliementGroup(partie)) {
      return (await this.prisma.event.count({ where: { partieId: partie.id } })) > 0
        ? 'started'
        : 'none';
    }
    // Story 38.2 : seuls les événements porteurs d'un `Scenario` comptent — l'événement unique
    // d'une rencontre isolée de ralliement n'en est pas un.
    const count = await this.prisma.event.count({
      where: { partieId: partie.id, scenario: { isNot: null } },
    });
    return count > 0 ? 'started' : 'none';
  }

  /** Lecture en lot (même discipline qu'AD-3/`progressByPartieId`, Story 29.8) : une seule
   *  requête groupée pour dériver `isFavorite` de tout le tableau renvoyé par `listForUser()`. */
  private async favoritePartieIds(userId: string, partieIds: string[]): Promise<Set<string>> {
    if (partieIds.length === 0) return new Set();
    const favorites = await this.prisma.partieFavorite.findMany({
      where: { userId, partieId: { in: partieIds } },
      select: { partieId: true },
    });
    return new Set(favorites.map((f) => f.partieId));
  }

  /** Variante mono-partie de `favoritePartieIds` — même logique que `progressOf()` vs
   *  `progressByPartieId()` (`findOneDto`, `update`, `close`, `reopen`). */
  private async isFavorite(userId: string, partieId: string): Promise<boolean> {
    const favorite = await this.prisma.partieFavorite.findUnique({
      where: { userId_partieId: { userId, partieId } },
    });
    return favorite !== null;
  }

  /**
   * `mj` = les parties que je maîtrise ; `player` = celles où je suis membre (via `Membership`) ;
   * sans rôle (Story 37.7) = TOUTES mes parties, propriétaire ou membre, chacune avec son rôle —
   * lu en une seule fois par `PermissionService.rolesOf()`, jamais déduit d'une comparaison.
   * Story 38.2 : les listes par rôle (`mj`/`player`, donc `party-signals`) EXCLUENT les
   * ralliements, qui n'apparaissent que dans la liste sans rôle (`admin`/`member`).
   */
  async listForUser(userId: string, role?: 'mj' | 'player'): Promise<PartieDto[]> {
    if (role === undefined) {
      const mine = await this.prisma.partie.findMany({
        // Story 42.5 : les parties que l'utilisateur a retirées de sa liste n'y figurent plus, nulle part.
        where: {
          OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
          hiddenBy: { none: { userId } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const mineIds = mine.map((p) => p.id);
      const [roles, progressOf, favoriteIds] = await Promise.all([
        this.permissions.rolesOf(userId, mineIds),
        this.progressByPartieId(mine),
        this.favoritePartieIds(userId, mineIds),
      ]);
      return mine.flatMap((p) => {
        const partieRole = roles.get(p.id);
        if (!partieRole) return [];
        return [toPartieDto(p, partieRole, progressOf(p.id), favoriteIds.has(p.id))];
      });
    }
    if (role === 'player') {
      const allMemberships = await this.prisma.membership.findMany({
        where: { userId, partie: { hiddenBy: { none: { userId } } } },
        orderBy: { joinedAt: 'desc' },
        include: { partie: true },
      });
      const memberships = allMemberships.filter(
        (m) => familyOf(m.partie.gameSystemId) !== 'ralliement',
      );
      const partieIds = memberships.map((m) => m.partie.id);
      const [progressOf, favoriteIds] = await Promise.all([
        this.progressByPartieId(memberships.map((m) => m.partie)),
        this.favoritePartieIds(userId, partieIds),
      ]);
      return memberships.map((m) =>
        toPartieDto(m.partie, 'player', progressOf(m.partie.id), favoriteIds.has(m.partie.id)),
      );
    }
    const ownedParties = await this.prisma.partie.findMany({
      where: { ownerId: userId, hiddenBy: { none: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
    const parties = ownedParties.filter((p) => familyOf(p.gameSystemId) !== 'ralliement');
    const partieIds = parties.map((p) => p.id);
    const [progressOf, favoriteIds] = await Promise.all([
      this.progressByPartieId(parties),
      this.favoritePartieIds(userId, partieIds),
    ]);
    return parties.map((p) => toPartieDto(p, 'mj', progressOf(p.id), favoriteIds.has(p.id)));
  }

  /** Récupère une partie visible par l'utilisateur (`PARTIE_READ`, MJ ou membre) enrichie
   *  du pseudo/nom affiché du MJ (AD-2) — le MJ n'étant jamais un `Membership`, son identité
   *  n'apparaît nulle part ailleurs dans `PartieDto`. Revue de code : `mj` gardé comme
   *  `PermissionService.membersOf()` plutôt qu'une assertion non-null — une ligne `User` orpheline ne doit
   *  jamais transformer ce chemin de lecture principal en 500 (ownerPseudo/ownerDisplayName
   *  optionnels). Une partie sans propriétaire (AD-5) les laisse également absents. */
  async findOneDto(id: string, userId: string): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_READ', { partieId: id });
    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    const dto = toPartieDto(partie, role, progress, favorite);
    if (partie.ownerId === null) return dto;
    const owner = await this.prisma.user.findUnique({
      where: { id: partie.ownerId },
      select: { pseudo: true, displayName: true },
    });
    if (!owner) return dto;
    return { ...dto, ownerPseudo: owner.pseudo, ownerDisplayName: owner.displayName };
  }

  /** Liste des joueurs d'une partie (visible par le MJ ou un membre). L'e-mail n'est renseigné
   *  que si le demandeur est le MJ (AD-2) — un `InviteLink` acceptant un nombre d'usages
   *  illimité, un membre n'est pas nécessairement quelqu'un que le MJ a choisi individuellement. */
  async listMembers(partieId: string, userId: string) {
    const { role, partie } = await this.permissions.assert(userId, 'PARTIE_MEMBERS_READ', {
      partieId,
    });
    // Projection selon le rôle (Story 37.6) : l'e-mail n'est exposé qu'au MJ.
    const withEmail = role === 'mj';
    // Story 39.4 : le rôle d'adhésion ne compte que pour un groupe ; une partie de JDR renvoie
    // toujours `MEMBER` (son pouvoir vient de `ownerId`, pas de ce rôle).
    const isGroup = familyOf(partie.gameSystemId) === 'ralliement';
    const memberships = await this.prisma.membership.findMany({
      where: { partieId },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: {
          select: { id: true, pseudo: true, displayName: true, email: true },
        },
      },
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      pseudo: m.user.pseudo,
      displayName: m.user.displayName,
      role: isGroup ? m.role : ('MEMBER' as const),
      email: withEmail ? m.user.email : undefined,
      joinedAt: m.joinedAt,
    }));
  }

  /** Le MJ retire un joueur de SA partie ; l'administrateur d'un ralliement retire un simple membre.
   *  Story 39.5 : simple délégation à `leave()`, seule procédure de sortie. */
  async removeMember(partieId: string, userId: string, targetUserId: string) {
    await this.leave(partieId, targetUserId, { type: 'REMOVED', byUserId: userId });
    return { ok: true };
  }

  /**
   * Story 39.5 — SEULE procédure de sortie d'une partie : départ volontaire (`LEFT`) comme retrait
   * par un administrateur (`REMOVED`). `userId` est la personne qui sort.
   *
   * Famille `jdr` : seul le retrait par le MJ existe (`PARTIE_LEAVE` n'y est ouvert à personne), et
   * il garde son comportement historique exact — ni verrou, ni changement de propriétaire.
   *
   * Groupe (`ralliement`) : tout se passe sous `SELECT … FOR UPDATE` de la partie, les rôles étant
   * relus après le verrou (la décision de droit date d'avant). Puis :
   * - Story 40.8 : les places à venir (réservées ou confirmées) et les votes ouverts de la personne
   *   sont libérés d'abord, dans la même transaction (le passé et les conjonctions qu'elle héberge restent) ;
   * - l'adhésion est supprimée, et `ownerId` remis à `null` si la personne était le créateur ;
   * - retrait : l'appelant doit encore être `ADMIN`, la cible un simple `MEMBER` (créateur compris) —
   *   un autre administrateur ou soi-même → 409 ;
   * - départ du DERNIER administrateur : le groupe est supprimé (adhésions et événements par
   *   cascade), seulement si `deleteIfLastAdmin` le confirme — sinon 409 et rien ne change.
   * Les émissions temps réel ont lieu après le commit, jamais dans la transaction.
   */
  async leave(
    partieId: string,
    userId: string,
    cause: Exclude<LeaveCause, { type: 'ACCOUNT_DELETION' }>,
  ): Promise<{ ok: true; deleted: boolean }> {
    const { partie } =
      cause.type === 'REMOVED'
        ? await this.permissions.assert(cause.byUserId, 'PARTIE_MEMBER_REMOVE', { partieId })
        : await this.permissions.assert(userId, 'PARTIE_LEAVE', { partieId });

    if (familyOf(partie.gameSystemId) !== 'ralliement') {
      // JDR : comportement historique inchangé (le MJ retire un joueur, sans verrou).
      await this.prisma.membership.deleteMany({ where: { partieId, userId } });
      await this.emitDeparture(partieId, userId, partie.ownerId);
      return { ok: true, deleted: false };
    }

    if (cause.type === 'LEFT' && partie.kind === 'ONE_SHOT') {
      // La cellule de la politique vaut pour la famille entière : la rencontre à usage unique (un
      // seul administrateur, epic 41) est écartée ici.
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    if (cause.type === 'REMOVED' && userId === cause.byUserId) {
      throw new ConflictException(RALLIEMENT_REMOVE_PROTECTED_MESSAGE);
    }
    // Story 41.4 : les invités d'une soirée terminée ne bougent plus (400).
    if (cause.type === 'REMOVED') await this.events.assertIsolatedOpen(partie);

    const outcome = await this.prisma.$transaction((tx) =>
      this.departGroupInTx(tx, partieId, userId, cause),
    );
    return this.afterDeparture(partieId, userId, partie.ownerId, outcome);
  }

  /**
   * Corps transactionnel de la sortie d'un groupe, SOUS le verrou de la partie — partagé par
   * `leave()` (départ, retrait) et par l'effacement du compte (Story 43.2, AD-17) : une seule
   * procédure. Aucune émission ici ; `afterDeparture()` s'en charge après le commit.
   */
  private async departGroupInTx(
    tx: Prisma.TransactionClient,
    partieId: string,
    userId: string,
    cause: LeaveCause,
  ): Promise<DepartureOutcome> {
    await this.lockPartie(tx, partieId);
    if (cause.type === 'REMOVED') {
      // Rôles relus SOUS le verrou : un appelant qui vient de quitter l'office ne retire plus
      // personne, une cible nommée administrateur entre-temps n'est jamais retirée.
      const remover = await tx.membership.findUnique({
        where: { userId_partieId: { userId: cause.byUserId, partieId } },
        select: { role: true },
      });
      if (remover?.role !== 'ADMIN') throw new ForbiddenException(ADMIN_ONLY_MESSAGE);
      const target = await tx.membership.findUnique({
        where: { userId_partieId: { userId, partieId } },
        select: { role: true },
      });
      if (!target) throw new NotFoundException('Ce membre est introuvable');
      if (target.role !== 'MEMBER') {
        throw new ConflictException(RALLIEMENT_REMOVE_PROTECTED_MESSAGE);
      }
    } else {
      const leaver = await tx.membership.findUnique({
        where: { userId_partieId: { userId, partieId } },
        select: { role: true },
      });
      if (!leaver) throw new ForbiddenException(NO_ACCESS_MESSAGE);
      if (leaver.role === 'ADMIN') {
        // Le recomptage des administrateurs fait foi (le verrou le fige) : deux derniers
        // administrateurs qui partent en même temps ne laissent jamais un groupe sans administrateur.
        const adminCount = await tx.membership.count({ where: { partieId, role: 'ADMIN' } });
        if (adminCount <= 1) {
          return {
            deleted: true,
            ownerCleared: false,
            participantIds: await this.deleteGroupOfLastAdmin(
              tx,
              partieId,
              // Effacement du compte : la confirmation est celle du compte lui-même.
              cause.type === 'LEFT' ? cause.deleteIfLastAdmin : true,
            ),
            // Le groupe disparaît en cascade : aucune annulation, aucun e-mail.
            cancelledEventIds: [] as string[],
          };
        }
      }
    }

    // Story 40.8 : dans CETTE transaction et sous ce verrou (aucune nouvelle route), les places et
    // les votes de la personne sont libérés — inscriptions (réservées ou confirmées) aux
    // conjonctions à venir, puis réponses aux sondages ouverts. Les données passées, les sondages
    // fermés et les conjonctions à venir qu'elle organise restent. Ordre des verrous : partie, puis
    // lignes `Event` (triées) prises par `EventsService`.
    await this.events.releaseUpcomingInscriptionsInTx(tx, partieId, userId);
    // Story 49.3 : les jeux qu'elle apportait aux soirées À VENIR du groupe (et des rencontres isolées,
    // trouvées par `Event.partieId`) partent avec elle ; les soirées passées gardent leurs lignes.
    await this.events.releaseGameBringsInTx(tx, { partieId, upcomingOnly: true }, userId);
    await this.polls.removeOpenVotesInTx(tx, partieId, userId);
    // Story 42.3 : les conjonctions À VENIR qu'elle organise sont annulées par la procédure de la Story 42.1,
    // dans cette même transaction (un échec annule tout le départ) ; le passé reste, hôte affiché compris.
    const cancelledEventIds = await this.events.cancelUpcomingHostedInTx(
      tx,
      partieId,
      userId,
      (client, pollIds) => this.polls.closePollsInTx(client, pollIds),
    );
    await tx.membership.deleteMany({ where: { partieId, userId } });
    // Le créateur qui sort ne laisse pas de propriétaire derrière lui : sans ligne d'adhésion,
    // `ownerId` le ferait encore compter comme administrateur (`ralliementRole`).
    const cleared = await tx.partie.updateMany({
      where: { id: partieId, ownerId: userId },
      data: { ownerId: null },
    });
    return {
      deleted: false,
      ownerCleared: cleared.count > 0,
      participantIds: [] as string[],
      cancelledEventIds,
    };
  }

  /** Après le commit uniquement : émissions temps réel et e-mails d'une sortie de groupe. `actorName` est
   *  le nom de la personne qui part, quand elle n'existera plus à l'envoi (effacement du compte). */
  private async afterDeparture(
    partieId: string,
    userId: string,
    ownerId: string | null,
    outcome: DepartureOutcome,
    actorName?: string,
  ): Promise<{ ok: true; deleted: boolean }> {
    if (outcome.deleted) {
      this.realtimeEvents.emit(partieTopic(partieId));
      this.emitPartieDeleted(ownerId, outcome.participantIds);
      return { ok: true, deleted: true };
    }
    await this.emitDeparture(partieId, userId, outcome.ownerCleared ? null : ownerId);
    // Story 42.3 : e-mail n° 7 de chaque conjonction annulée, APRÈS le commit (échecs journalisés, jamais
    // remontés) ; l'auteur est la personne qui part.
    for (const eventId of outcome.cancelledEventIds) {
      if (actorName === undefined) await this.cancellationMailer.send(partieId, eventId, userId);
      else await this.cancellationMailer.send(partieId, eventId, userId, [], actorName);
    }
    return { ok: true, deleted: false };
  }

  /**
   * Story 43.2 (AD-11, AD-17) — la part « parties » de l'effacement d'un compte, DANS la transaction de
   * l'appelant : les parties de JDR possédées sont supprimées (personnages compris, par cascade) ; chaque
   * autre adhésion est quittée, dans l'ordre des identifiants (ordre de verrouillage stable) — une partie
   * de JDR en perdant simplement la ligne, un groupe par la procédure de `leave()` (`departGroupInTx`) :
   * places et votes à venir libérés, conjonctions à venir hébergées annulées, groupe supprimé s'il n'a plus
   * d'administrateur, `ownerId` vidé ailleurs. Ne supprime pas le compte et n'émet rien.
   */
  async eraseMembershipsInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<AccountErasureEffects> {
    const effects: AccountErasureEffects = {
      deletedJdr: [],
      jdrDepartures: [],
      groupDepartures: [],
    };

    const owned = await tx.partie.findMany({
      where: { ownerId: userId },
      select: { id: true, gameSystemId: true },
      orderBy: { id: 'asc' },
    });
    for (const p of owned) {
      if (familyOf(p.gameSystemId) === 'ralliement') continue; // quitté plus bas, via son adhésion
      const members = await tx.membership.findMany({
        where: { partieId: p.id },
        select: { userId: true },
      });
      await tx.partie.delete({ where: { id: p.id } });
      effects.deletedJdr.push({ partieId: p.id, participantIds: members.map((m) => m.userId) });
    }

    const memberships = await tx.membership.findMany({
      where: { userId },
      select: { partieId: true, partie: { select: { gameSystemId: true, ownerId: true } } },
      orderBy: { partieId: 'asc' },
    });
    for (const m of memberships) {
      if (familyOf(m.partie.gameSystemId) !== 'ralliement') {
        await tx.membership.deleteMany({ where: { partieId: m.partieId, userId } });
        effects.jdrDepartures.push({ partieId: m.partieId, ownerId: m.partie.ownerId });
        continue;
      }
      const outcome = await this.departGroupInTx(tx, m.partieId, userId, {
        type: 'ACCOUNT_DELETION',
      });
      effects.groupDepartures.push({ partieId: m.partieId, ownerId: m.partie.ownerId, outcome });
    }
    return effects;
  }

  /** Story 43.2 — émissions et e-mails de l'effacement d'un compte, APRÈS le commit. Un échec ici est
   *  journalisé, jamais remonté : le compte n'existe plus, rien ne se rejoue. */
  async announceAccountErasure(
    userId: string,
    actorName: string,
    effects: AccountErasureEffects,
  ): Promise<void> {
    const guard = async (what: string, action: () => Promise<unknown> | void) => {
      try {
        await action();
      } catch (e) {
        this.logger.error(`Échec de l'annonce de l'effacement du compte (${what})`, e as Error);
      }
    };
    for (const d of effects.deletedJdr) {
      await guard(`partie ${d.partieId}`, () => {
        this.realtimeEvents.emit(partieTopic(d.partieId));
        this.emitPartieDeleted(userId, d.participantIds);
      });
    }
    for (const d of effects.jdrDepartures) {
      await guard(`partie ${d.partieId}`, () => this.emitDeparture(d.partieId, userId, d.ownerId));
    }
    for (const g of effects.groupDepartures) {
      await guard(`groupe ${g.partieId}`, () =>
        this.afterDeparture(g.partieId, userId, g.ownerId, g.outcome, actorName),
      );
    }
  }

  /** Émissions d'une sortie de partie (après le commit) : `partie:{id}` pour la liste des membres
   *  déjà ouverte, `user:{id}` de la personne sortie (sa liste perd la partie) et de chaque
   *  participant restant (signaux, `AUCUN_MEMBRE_INVITE` du MJ quand le dernier joueur part). */
  private async emitDeparture(
    partieId: string,
    leaverId: string,
    ownerId: string | null,
  ): Promise<void> {
    // Bug fix : le MJ/les autres membres ne voyaient jamais le roster rétrécir sans recharger, et
    // le joueur retiré ne voyait jamais sa propre liste de Parties se mettre à jour.
    this.realtimeEvents.emit(partieTopic(partieId));
    this.realtimeEvents.emit(userTopic(leaverId));
    // AUCUN_MEMBRE_INVITE (Story 29.7, AD-14) : retirer le dernier membre fait réapparaître ce
    // signal pour le MJ. `partieTopic` déjà émis ci-dessus : `notifyPartieSignalsChanged` (membres
    // seulement) pour ne pas le réémettre (revue de code, Story 29.7 — double émission SSE).
    await this.notifyPartieSignalsChanged(partieId, ownerId);
  }

  /**
   * Story 39.4 — change le rôle d'un membre d'un GROUPE. Deux mouvements seulement : un
   * administrateur en nomme un autre (membre ordinaire → `ADMIN`), ou quitte lui-même l'office
   * (`MEMBER` sur son propre `userId`). Tout le reste (retirer l'office à un autre, nommer un
   * administrateur ou soi-même) est un 409.
   *
   * Tout se passe sous `SELECT … FOR UPDATE` de la partie : les rôles sont relus et les
   * administrateurs recomptés après avoir pris le verrou, si bien que deux départs simultanés ne
   * laissent jamais un groupe sans administrateur. Quitter l'office en étant le DERNIER
   * administrateur supprime le groupe (adhésions et événements par cascade), et seulement si
   * `deleteIfLastAdmin` est vrai — sinon 409 et rien ne change. `ownerId` ne change jamais.
   * Les émissions temps réel ont lieu après le commit, jamais dans la transaction.
   */
  async setMemberRole(
    partieId: string,
    userId: string,
    targetUserId: string,
    dto: SetMemberRoleDto,
  ): Promise<{ ok: true; deleted: boolean }> {
    const { partie } = await this.permissions.assert(userId, 'PARTIE_MEMBER_ROLE_SET', {
      partieId,
    });
    // La cellule de la politique vaut pour la famille entière : la rencontre à usage unique
    // (`ONE_SHOT`, un seul administrateur) est écartée ici.
    if (partie.kind === 'ONE_SHOT') {
      throw new ForbiddenException(RALLIEMENT_UNAVAILABLE_MESSAGE);
    }
    const appoint = dto.role === 'ADMIN';
    if (appoint && targetUserId === userId) throw new ConflictException(ROLE_SELF_APPOINT_MESSAGE);
    if (!appoint && targetUserId !== userId) throw new ConflictException(ROLE_DEMOTE_OTHER_MESSAGE);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockPartie(tx, partieId);
      // Rôles relus SOUS le verrou : la décision de droit date d'avant.
      const caller = await tx.membership.findUnique({
        where: { userId_partieId: { userId, partieId } },
        select: { role: true },
      });
      if (!caller) throw new ForbiddenException(NO_ACCESS_MESSAGE);
      if (caller.role !== 'ADMIN') throw new ForbiddenException(ADMIN_ONLY_MESSAGE);

      if (appoint) {
        const target = await tx.membership.findUnique({
          where: { userId_partieId: { userId: targetUserId, partieId } },
          select: { role: true },
        });
        if (!target) throw new NotFoundException('Ce membre est introuvable');
        if (target.role === 'ADMIN') throw new ConflictException(ROLE_ALREADY_ADMIN_MESSAGE);
        await tx.membership.update({
          where: { userId_partieId: { userId: targetUserId, partieId } },
          data: { role: 'ADMIN' },
        });
        return { deleted: false, participantIds: [] as string[] };
      }

      // Quitter l'office : le recomptage des administrateurs fait foi (le verrou le fige).
      const adminCount = await tx.membership.count({ where: { partieId, role: 'ADMIN' } });
      if (adminCount > 1) {
        await tx.membership.update({
          where: { userId_partieId: { userId, partieId } },
          data: { role: 'MEMBER' },
        });
        return { deleted: false, participantIds: [] as string[] };
      }
      return {
        deleted: true,
        participantIds: await this.deleteGroupOfLastAdmin(tx, partieId, dto.deleteIfLastAdmin),
      };
    });

    // Après le commit uniquement.
    this.realtimeEvents.emit(partieTopic(partieId));
    if (outcome.deleted) {
      this.emitPartieDeleted(partie.ownerId, outcome.participantIds);
      return { ok: true, deleted: true };
    }
    await this.notifyPartieSignalsChanged(partieId, partie.ownerId);
    return { ok: true, deleted: false };
  }

  /** Verrou d'écriture de la partie pour la durée de la transaction (`SELECT … FOR UPDATE`, même
   *  patron que `EventsService.assertCanAddEvent`) : toute opération qui change le nombre
   *  d'administrateurs le prend, puis relit les rôles avant d'écrire. */
  private async lockPartie(tx: Prisma.TransactionClient, partieId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Partie" WHERE "id" = ${partieId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Partie introuvable');
  }

  /** Règle UNIQUE du dernier administrateur qui part (quitter l'office, Story 39.4, ou quitter le
   *  groupe, Story 39.5) : sans confirmation explicite, 409 et rien ne change ; avec elle, le groupe
   *  est supprimé (adhésions et événements par cascade). À appeler SOUS le verrou de la partie, après
   *  le recomptage. Renvoie les participants, lus AVANT la suppression, pour l'émission après commit. */
  private async deleteGroupOfLastAdmin(
    tx: Prisma.TransactionClient,
    partieId: string,
    confirmed: boolean | undefined,
  ): Promise<string[]> {
    if (confirmed !== true) throw new ConflictException(LAST_ADMIN_MESSAGE);
    const memberships = await tx.membership.findMany({
      where: { partieId },
      select: { userId: true },
    });
    await tx.partie.delete({ where: { id: partieId } });
    return memberships.map((m) => m.userId);
  }

  /** Émission après suppression d'une partie : chaque participant (propriétaire compris) voit sa
   *  liste changer. À appeler APRÈS le commit, jamais dans une transaction. */
  private emitPartieDeleted(ownerId: string | null, participantIds: readonly string[]): void {
    const recipients = new Set<string>();
    if (ownerId !== null) recipients.add(ownerId);
    for (const id of participantIds) recipients.add(id);
    for (const id of recipients) this.realtimeEvents.emit(userTopic(id));
  }

  async update(id: string, userId: string, dto: UpdatePartieDto): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_UPDATE', {
      partieId: id,
    });
    await this.assertEveningNotCancelled(partie);

    // Story 38.2 : le type et le système d'un ralliement sont définitifs. Garde posée AVANT les
    // autres (leurs messages parleraient de conversion ou de famille) ; renvoyer les valeurs déjà
    // enregistrées reste accepté (le formulaire renvoie tous les champs).
    if (
      familyOf(partie.gameSystemId) === 'ralliement' &&
      ((dto.kind !== undefined && dto.kind !== partie.kind) ||
        (dto.gameSystemId !== undefined && dto.gameSystemId !== partie.gameSystemId))
    ) {
      throw new BadRequestException(RALLIEMENT_TYPE_LOCKED_MESSAGE);
    }

    // Story 38.2 : aucune partie ne devient un ralliement par édition (elle n'aurait ni membership
    // ADMIN ni événement) — y compris quand son système actuel est inconnu du registre.
    if (
      dto.gameSystemId !== undefined &&
      familyOf(dto.gameSystemId) === 'ralliement' &&
      familyOf(partie.gameSystemId) !== 'ralliement'
    ) {
      throw new BadRequestException(GAME_SYSTEM_FAMILY_CHANGE_MESSAGE);
    }

    // Story 29.14 : jusqu'ici `data: { ...dto }` écrivait `kind` sans aucune vérification, alors que
    // le type gouverne des invariants dans quatre services. Changer de type est une OPÉRATION à
    // effets (création de scénario, semis de participants, rétrogradation de statuts) portant son
    // propre paramètre — elle passe par `convertKind()`, jamais par cette édition de champs.
    // Un `kind` IDENTIQUE reste accepté : le formulaire renvoie toujours les quatre champs, et le
    // rejeter casserait l'enregistrement d'un simple changement de nom.
    if (dto.kind !== undefined && dto.kind !== partie.kind) {
      throw new BadRequestException(
        'Le type de partie ne se change pas par cette route — utiliser la conversion dédiée',
      );
    }

    // Story 29.17, AC4 : même patron que la garde `kind` ci-dessus — un CHANGEMENT vers un système
    // sans module est refusé, mais renvoyer la valeur déjà enregistrée (même sans module, AC3) reste
    // accepté : sans cette distinction, chaque sauvegarde d'une partie existante sur un système sans
    // module casserait.
    const systemChanged =
      dto.gameSystemId !== undefined && dto.gameSystemId !== partie.gameSystemId;
    if (systemChanged) {
      // Story 37.5 : un changement entre familles est refusé AVANT le contrôle d'ouverture, pour
      // nommer la vraie cause. Un système courant inconnu du registre (`null`) n'est pas bloqué
      // ici : le contrôle d'ouverture ci-dessous suffit à filtrer la cible.
      const currentFamily = familyOf(partie.gameSystemId);
      if (currentFamily !== null && currentFamily !== familyOf(dto.gameSystemId as string)) {
        throw new BadRequestException(GAME_SYSTEM_FAMILY_CHANGE_MESSAGE);
      }
      this.assertGameSystemOpenForCreation(dto.gameSystemId as string);
    }

    // AD-23 : tout `UPDATE` qui change `gameSystemId` remet `hommeDragonId` à NULL DANS LA MÊME
    // instruction — c'est ce qui rend « une aventure de H = une partie dont hommeDragonId = H.id »
    // vrai par construction (un lien existant est toujours un lien Ryuutama du MJ). La fiche de
    // l'Homme Dragon n'est pas touchée : seul le lien disparaît, le niveau est recalculé à la lecture.
    const data = { ...dto, ...(systemChanged ? { hommeDragonId: null } : {}) };
    // Story 38.2 : l'événement unique d'une rencontre isolée porte le nom de la partie — renommer
    // la partie renomme son événement, dans la même transaction.
    const renameEvent =
      familyOf(partie.gameSystemId) === 'ralliement' &&
      partie.kind === 'ONE_SHOT' &&
      dto.name !== undefined &&
      dto.name !== partie.name;
    const updated = renameEvent
      ? await this.prisma.$transaction(async (tx) => {
          const written = await tx.partie.update({ where: { id }, data });
          const event = await tx.event.findFirst({ where: { partieId: id }, select: { id: true } });
          if (event) await this.events.updateInTx(tx, event.id, { title: dto.name });
          return written;
        })
      : await this.prisma.partie.update({ where: { id }, data });
    this.realtimeEvents.emit(partieTopic(id));
    // Le changement de système fait apparaître ou disparaître HOMME_DRAGON_A_CREER (et le lien) :
    // signaux du MJ et des membres, en plus de `partie:` ci-dessus (jamais en remplacement).
    if (systemChanged) await this.notifyPartieSignalsChanged(id, partie.ownerId);
    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    return toPartieDto(updated, role, progress, favorite);
  }

  /**
   * Convertit le type d'une partie (Story 29.14) — MJ uniquement.
   *
   * Tout se joue dans une seule transaction : lecture de l'état, évaluation par la matrice
   * partagée, puis — et seulement si le verdict est favorable — écriture du `kind` et de ses
   * effets. Un refus lève AVANT toute écriture (AC10) : évaluer après avoir écrit laisserait une
   * partie convertie suivie d'une exception, le pire des deux mondes.
   *
   * La matrice vit dans `@master-jdr/shared` et non ici : le formulaire d'édition la consomme
   * aussi, pour désactiver les types inatteignables. Deux tables de règles divergeraient.
   */
  async convertKind(id: string, userId: string, dto: ConvertPartieKindDto): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_CONVERT_KIND', {
      partieId: id,
    });

    // Story 37.5 : la matrice de conversion ne vaut que pour la famille `jdr` — hors de celle-ci,
    // refus avant toute lecture ou écriture, sans consulter `checkPartieKindTransition`.
    // Un système inconnu du registre (`null`) n'est pas refusé ici, comme dans `update()`.
    const family = familyOf(partie.gameSystemId);
    if (family !== null && family !== 'jdr') {
      throw new BadRequestException(KIND_CONVERSION_NOT_JDR_MESSAGE);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const [scenarioCount, courantCount] = await Promise.all([
        tx.scenario.count({ where: { event: { partieId: id } } }),
        tx.scenario.count({ where: { event: { partieId: id }, status: 'COURANT' } }),
      ]);

      const verdict = checkPartieKindTransition(partie.kind, dto.kind, {
        scenarioCount,
        courantCount,
        isClosed: partie.closedAt !== null,
      });

      if (!verdict.allowed) {
        throw new BadRequestException(refusalMessage(verdict.refusal, scenarioCount));
      }

      // Le scénario qui reste Courant est validé avant toute écriture, lui aussi : il doit exister,
      // appartenir à CETTE partie (isolation) et être réellement COURANT.
      let keptCourantId: string | null = null;
      if (verdict.requiresCourantChoice) {
        if (!dto.courantScenarioId) {
          throw new BadRequestException(
            'Cette partie a plusieurs scénarios Courant : désignez celui qui doit le rester',
          );
        }
        const kept = await tx.scenario.findUnique({
          where: { id: dto.courantScenarioId },
          include: { event: { select: { partieId: true } } },
        });
        if (!kept || kept.event.partieId !== id) {
          throw new BadRequestException("Ce scénario n'appartient pas à cette partie");
        }
        if (kept.status !== 'COURANT') {
          throw new BadRequestException('Le scénario désigné pour rester Courant ne l’est pas');
        }
        keptCourantId = kept.id;
      }

      const written = await tx.partie.update({
        where: { id },
        data: { kind: dto.kind },
      });

      for (const effect of verdict.effects) {
        // Revue de code : `switch` exhaustif plutôt qu'une chaîne de `if` — un futur membre ajouté
        // à `PartieKindTransitionEffect` sans mettre à jour cette boucle échoue bruyamment (`default`
        // ci-dessous) au lieu d'être silencieusement ignoré.
        switch (effect) {
          case 'CREATE_SCENARIO': {
            // Même geste que `create()` pour un ONE_SHOT (AD-7) : un scénario BROUILLON titré du nom
            // de la partie, plus la séance sans laquelle il n'a aucune date à planifier. Sans cela la
            // partie resterait sans scénario pour toujours — `ScenariosService.create()` refuse d'en
            // créer un sur un ONE_SHOT, et il n'existe aucun autre chemin.
            // Story 37.3 : via `EventsService.createInTx` (garde ONE_SHOT sous verrou de la partie,
            // dont le `kind` vient d'être écrit dans cette transaction), extension écrite en ligne.
            await this.events.createInTx(
              tx,
              { partieId: id, title: partie.name, ownerId: partie.ownerId },
              (etx, event) => etx.scenario.create({ data: { id: event.id, status: 'BROUILLON' } }),
            );
            break;
          }

          case 'SEED_PARTICIPANTS': {
            // Hors épisodique, le code tient déjà pour vrai que tous les membres participent
            // (`homme-dragon.service.ts`). On l'explicite, sans quoi la conversion viderait les notes
            // de rétrospective et ferait refuser les associations de journal.
            // `skipDuplicates` rend le semis idempotent, comme l'upsert de `participate()`.
            const [scenarios, memberships] = await Promise.all([
              tx.scenario.findMany({
                where: { event: { partieId: id } },
                select: { id: true },
              }),
              tx.membership.findMany({
                where: { partieId: id },
                select: { userId: true },
              }),
            ]);
            const rows = scenarios.flatMap((s) =>
              memberships.map((m) => ({ scenarioId: s.id, userId: m.userId })),
            );
            if (rows.length > 0) {
              await tx.scenarioParticipant.createMany({
                data: rows,
                skipDuplicates: true,
              });
            }
            break;
          }

          case 'DEMOTE_EXTRA_COURANTS': {
            // Revue de code : `keptCourantId` remplace une assertion non-null par une garde
            // explicite — `requiresCourantChoice` (donc cet effet) n'est posé par la matrice que
            // lorsque `keptCourantId` a été validé plus haut, mais un futur refactor qui romprait ce
            // lien lèverait ici au lieu de rétrograder silencieusement TOUS les scénarios Courant
            // (`{ not: null }` matcherait tout).
            if (!keptCourantId) {
              throw new Error(
                'DEMOTE_EXTRA_COURANTS appliqué sans scénario Courant désigné — invariant rompu',
              );
            }
            // Règle A — rien n'est effacé : seul `status` change. Séances, votes et dates des
            // scénarios rétrogradés restent intacts, et un scénario A_VENIR peut parfaitement porter
            // une séance datée (seul PASSE fige, cf. `addSeance`/`createSeancePoll`).
            await tx.scenario.updateMany({
              where: {
                event: { partieId: id },
                status: 'COURANT',
                id: { not: keptCourantId },
              },
              data: { status: 'A_VENIR' },
            });
            break;
          }

          default: {
            const exhaustive: never = effect;
            throw new Error(`Effet de conversion non géré : ${String(exhaustive)}`);
          }
        }
      }

      // Anti-spoil serveur : un brouillon est caché sauf dans un ONE_SHOT — convertir le type change
      // donc l'ensemble des séances éligibles à `nextSessionDate/Slot` (valeur unique, partagée par
      // tous les lecteurs). Recalcul dans la même transaction, reporté sur le DTO renvoyé.
      const next = await this.events.recalculateNextSessionInTx(tx, id);
      return { ...written, ...next };
    });

    // AD-14 : la conversion change des statuts de scénario, donc des signaux. Émission tolérante
    // aux pannes (patron `close()`/`reopen()`, Story 29.6) — un commit réussi ne doit jamais se
    // transformer en 500 parce qu'une notification a échoué.
    await this.emitPartieAndMembersSafe(id, partie.ownerId);

    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    return toPartieDto(updated, role, progress, favorite);
  }

  /** Déclare la partie terminée (AD-8, Story 29.6) — MJ uniquement. Réversible via `reopen()`. */
  async close(id: string, userId: string): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_CLOSE', {
      partieId: id,
    });
    await this.assertEveningNotCancelled(partie);
    const updated = await this.prisma.partie.update({
      where: { id },
      data: { closedAt: new Date() },
    });
    await this.emitPartieAndMembersSafe(id, partie.ownerId);
    // Le MJ peut clôturer une partie jamais commencée (aucun scénario) — progression recalculée,
    // jamais supposé, `closedAt` primant de toute façon sur le résultat dans toPartieDto().
    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    return toPartieDto(updated, role, progress, favorite);
  }

  /**
   * Story 42.5 (FR17, AD-10) : retire DÉFINITIVEMENT une partie terminée ou annulée de la liste de
   * `userId`, et de lui seul. Droit : un rôle sur la partie (`PARTIE_READ`, 403/404 sinon) ; le statut,
   * calculé par la fonction unique (jamais lu du client), doit être TERMINEE ou ANNULEE (400 sinon).
   * Idempotent (`skipDuplicates`). Les lectures de l'utilisateur l'excluent ensuite côté serveur ; les autres
   * participants la gardent. N'émet qu'après l'écriture : `user:{userId}` rafraîchit ses autres onglets.
   */
  async hide(userId: string, partieId: string): Promise<{ ok: true }> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_READ', { partieId });
    const progress = await this.progressOf(partie);
    const { status } = toPartieDto(partie, role, progress, false);
    if (status !== 'TERMINEE' && status !== 'ANNULEE') {
      throw new BadRequestException(HIDE_NOT_OVER_MESSAGE);
    }
    await this.prisma.partieHidden.createMany({
      data: [{ userId, partieId }],
      skipDuplicates: true,
    });
    this.realtimeEvents.emit(userTopic(userId));
    return { ok: true };
  }

  /** Revient sur une clôture (AD-8, Story 29.6) — MJ uniquement. */
  async reopen(id: string, userId: string): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_REOPEN', {
      partieId: id,
    });
    await this.assertEveningNotCancelled(partie);
    const updated = await this.prisma.partie.update({
      where: { id },
      data: { closedAt: null },
    });
    // Story 42.5 : rouvrir une partie close la rend à TOUS ceux qui l'avaient retirée de leur liste.
    await this.prisma.partieHidden.deleteMany({ where: { partieId: id } });
    await this.emitPartieAndMembersSafe(id, partie.ownerId);
    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    return toPartieDto(updated, role, progress, favorite);
  }

  async remove(id: string, userId: string) {
    const { partie } = await this.permissions.assert(userId, 'PARTIE_DELETE', { partieId: id });
    // AD-23 : si la partie portait un Homme Dragon, la FK `SetNull` ne fait que le délier — la
    // fiche est conservée. Le signal HOMME_DRAGON_A_CREER du MJ n'est plus celui d'avant et sa liste
    // « Personnages » change : `user:` au MJ (aucun canal `partie:`, la partie n'existe plus).
    //
    // Story 39.1 : un groupe (ralliement) brûlé emporte ses adhésions (cascade) — chaque membre voit
    // sa liste changer. Les participants sont donc lus AVANT la suppression, et l'émission a lieu
    // après le commit (jamais dans une transaction).
    const participants =
      familyOf(partie.gameSystemId) === 'ralliement'
        ? await this.permissions.membersOf({ id, ownerId: partie.ownerId })
        : [];
    await this.prisma.partie.delete({ where: { id } });
    this.emitPartieDeleted(
      partie.ownerId,
      participants.map((p) => p.userId),
    );
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Image de couverture (Story 29.12, AD-17/AD-19) — MJ seul en écriture (`PARTIE_COVER_UPDATE`),
  // lecture ouverte à tout membre (`PARTIE_COVER_READ`). Patron repris de `character.service.ts:updatePortrait()`
  // pour la validation/le nettoyage/le nettoyage du fichier orphelin, étendu pour écrire trois
  // dérivées pré-générées (AC9) plutôt qu'un fichier unique.
  // ─────────────────────────────────────────────────────────────────────────

  /** Noms des 3 fichiers dérivés partageant le même `stem` UUID (`<stem>-<mode>.webp`). */
  private coverDerivativeFilenames(stem: string): Record<ListViewMode, string> {
    return {
      large: `${stem}-large${COVER_DERIVATIVE_EXT}`,
      medium: `${stem}-medium${COVER_DERIVATIVE_EXT}`,
      compact: `${stem}-compact${COVER_DERIVATIVE_EXT}`,
    };
  }

  /** Extrait le `stem` (UUID sans extension) du `coverImageUrl` stocké — c'est une identité
   *  logique, jamais un chemin littéral sur disque (aucun fichier n'existe réellement à ce nom
   *  exact, seules les 3 dérivées `<stem>-<mode>.webp` existent). Alias de `coverImageVersion()`
   *  (Review Findings : deux implémentations indépendantes de la même règle d'extraction
   *  divergeraient silencieusement si le format d'URL changeait un jour). */
  private coverStem(coverImageUrl: string): string | null {
    return coverImageVersion(coverImageUrl);
  }

  private async deleteCoverFiles(coverImageUrl: string): Promise<void> {
    const stem = this.coverStem(coverImageUrl);
    if (!stem) {
      this.logger.warn(`coverImageUrl inattendu, suppression ignorée : ${coverImageUrl}`);
      return;
    }
    const filenames = Object.values(this.coverDerivativeFilenames(stem));
    await Promise.all(
      filenames.map((filename) =>
        unlinkUploadFile(COVERS_DIR, filename).catch((e) => {
          this.logger.warn(`Échec de suppression de la couverture ${filename}`, e as Error);
        }),
      ),
    );
  }

  /**
   * Dépose une image de couverture (AC1, AC4, AC6, AC9) — MJ seul (`PARTIE_COVER_UPDATE`). Détection MIME →
   * nettoyage EXIF → 3 dérivées redimensionnées pré-générées → écriture DB, avec nettoyage des
   * fichiers orphelins si une étape échoue après coup (patron `character.service.ts`). Au
   * remplacement d'une image existante, l'ancienne est supprimée (les 3 dérivées).
   */
  async setCoverImage(id: string, userId: string, file: Express.Multer.File): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_COVER_UPDATE', {
      partieId: id,
    });

    const mime = detectImageMime(file.buffer);
    if (!mime) {
      throw new BadRequestException(INVALID_COVER_IMAGE_MESSAGE);
    }
    let cleanedBuffer: Buffer;
    try {
      cleanedBuffer = await stripImageMetadata(file.buffer);
    } catch (err) {
      this.logger.warn(
        `Échec du nettoyage EXIF (sharp) sur une couverture uploadée : ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(INVALID_COVER_IMAGE_MESSAGE);
    }

    const stem = randomUUID();
    const filenames = this.coverDerivativeFilenames(stem);
    const written: string[] = [];
    try {
      await mkdir(COVERS_DIR, { recursive: true });
      for (const mode of Object.keys(COVER_DIMENSIONS) as ListViewMode[]) {
        const { width, height } = COVER_DIMENSIONS[mode];
        // Rapports très différents entre le mode grand (≈2,6/1) et moyen/liste (1/1) : recadrage
        // au centre plutôt que déformation (Décisions de la story).
        const resized = await sharp(cleanedBuffer)
          .resize({ width, height, fit: 'cover', position: 'centre' })
          .webp()
          .toBuffer();
        await writeFile(join(COVERS_DIR, filenames[mode]), resized);
        written.push(filenames[mode]);
      }
    } catch (err) {
      await Promise.all(written.map((f) => unlinkUploadFile(COVERS_DIR, f).catch(() => undefined)));
      this.logger.warn(
        `Échec de génération des dérivées de couverture : ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(INVALID_COVER_IMAGE_MESSAGE);
    }

    const newCoverImageUrl = `${COVERS_URL_PREFIX}${stem}${COVER_DERIVATIVE_EXT}`;
    try {
      await this.prisma.partie.update({
        where: { id },
        data: { coverImageUrl: newCoverImageUrl },
      });
    } catch (e) {
      // Les nouveaux fichiers ne sont référencés nulle part : DB en échec, nettoyage immédiat
      // plutôt que de laisser des fichiers orphelins sur disque (patron portrait).
      await Promise.all(written.map((f) => unlinkUploadFile(COVERS_DIR, f).catch(() => undefined)));
      throw e;
    }

    if (partie.coverImageUrl) {
      await this.deleteCoverFiles(partie.coverImageUrl);
    }

    // AD-14 : les autres membres continuent de voir l'ancienne identité visuelle jusqu'à un
    // rechargement complet sans cette émission — `emitPartieAndMembersSafe` n'a pas encore été
    // appelée pour cette mutation (contrairement à `close()`/`reopen()`), donc `partieTopic` n'a
    // pas déjà été émis ailleurs.
    await this.emitPartieAndMembersSafe(id, partie.ownerId);

    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    const updated = await this.prisma.partie.findUniqueOrThrow({
      where: { id },
    });
    return toPartieDto(updated, role, progress, favorite);
  }

  /** Retire l'image de couverture (AC3, AC4) — MJ seul. La bannière générée reprend sa place. */
  async removeCoverImage(id: string, userId: string): Promise<PartieDto> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_COVER_UPDATE', {
      partieId: id,
    });

    await this.prisma.partie.update({
      where: { id },
      data: { coverImageUrl: null },
    });

    if (partie.coverImageUrl) {
      await this.deleteCoverFiles(partie.coverImageUrl);
    }

    await this.emitPartieAndMembersSafe(id, partie.ownerId);

    const [progress, favorite] = await Promise.all([
      this.progressOf(partie),
      this.isFavorite(userId, id),
    ]);
    const updated = await this.prisma.partie.findUniqueOrThrow({
      where: { id },
    });
    return toPartieDto(updated, role, progress, favorite);
  }

  /**
   * Lecture d'une dérivée de couverture (AC8, AC9) — MJ ou membre (`PARTIE_COVER_READ`, mêmes
   * règles d'accès que `findOneDto`), contrairement aux mutations (MJ seul). Retourne `null` si la
   * partie n'a pas de couverture, ou si le fichier référencé a disparu du disque (base et disque
   * désynchronisés) — **jamais une exception** : CAP-20 impose qu'aucune partie ne soit jamais
   * nue, c'est au contrôleur/au front de retomber sur la bannière générée, pas à cette méthode de
   * faire échouer la requête.
   */
  async getCoverFile(
    id: string,
    userId: string,
    mode: ListViewMode,
  ): Promise<{
    buffer: Buffer;
    mime: DetectedImageMime;
    version: string;
  } | null> {
    const { partie } = await this.permissions.assert(userId, 'PARTIE_COVER_READ', { partieId: id });
    if (!partie.coverImageUrl) return null;

    const stem = this.coverStem(partie.coverImageUrl);
    if (!stem) return null;

    try {
      const buffer = await readFile(join(COVERS_DIR, this.coverDerivativeFilenames(stem)[mode]));
      return { buffer, mime: COVER_DERIVATIVE_MIME, version: stem };
    } catch {
      return null;
    }
  }

  /** Double émission temps réel (AD-14) pour toute mutation partagée à l'échelle d'une Partie :
   *  `partie:{id}` pour l'écran de détail déjà connecté, `user:{id}` pour chaque membre (MJ inclus)
   *  afin que sa propre liste de parties (Dashboard) reflète le changement sans recharger. */
  private async emitPartieAndMembers(partieId: string, ownerId: string | null): Promise<void> {
    this.realtimeEvents.emit(partieTopic(partieId));
    const participants = await this.permissions.membersOf({ id: partieId, ownerId });
    for (const p of participants) this.realtimeEvents.emit(userTopic(p.userId));
  }

  /** Variante de `emitPartieAndMembers` qui n'échoue jamais l'appelant (`close()`/`reopen()`) —
   *  appelée après que la mutation DB a déjà été committée, une erreur ici ne doit jamais faire
   *  croire au client que la clôture/réouverture a échoué alors qu'elle a bien eu lieu (revue de
   *  code, Story 29.6). */
  private async emitPartieAndMembersSafe(partieId: string, ownerId: string | null): Promise<void> {
    try {
      await this.emitPartieAndMembers(partieId, ownerId);
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel après mutation de la partie ${partieId} : ${String(err)}`,
      );
    }
  }

  /** Variante d'`emitPartieAndMembers` qui n'émet PAS `partieTopic` — réservée aux appelants qui
   *  l'ont déjà émis eux-mêmes (revue de code, Story 29.7 : `emitPartieAndMembersSafe` d'origine
   *  causait une double émission `partie:{id}` sur chaque point d'appel de
   *  `notifyPartieSignalsChanged`, qui a tous déjà leur propre `realtimeEvents.emit(partieTopic(...))`
   *  juste avant). */
  private async emitMembersOnly(partieId: string, ownerId: string | null): Promise<void> {
    const participants = await this.permissions.membersOf({ id: partieId, ownerId });
    for (const p of participants) this.realtimeEvents.emit(userTopic(p.userId));
  }

  /** Variante sans échec d'`emitMembersOnly` — même garde que `emitPartieAndMembersSafe`. */
  private async emitMembersOnlySafe(partieId: string, ownerId: string | null): Promise<void> {
    try {
      await this.emitMembersOnly(partieId, ownerId);
    } catch (err) {
      this.logger.warn(
        `Échec de l'émission temps réel (membres) après mutation de la partie ${partieId} : ${String(err)}`,
      );
    }
  }

  /** Point d'entrée public (Story 29.7, AD-14/AD-3) — réutilisé par les services propriétaires des
   *  mutations qui affectent un signal de FR-12 (`CharacterService`, `HommeDragonService`,
   *  `ScenariosService`, `PollService`, `InvitationsService`, `InviteLinksService`, tous injectent
   *  déjà `PartiesService`). Ces appelants émettent **déjà** `partieTopic` eux-mêmes juste avant
   *  d'appeler cette méthode — elle n'émet donc que `userTopic` par membre (`emitMembersOnlySafe`),
   *  jamais `emitPartieAndMembersSafe` qui réémettrait `partieTopic` une seconde fois. */
  async notifyPartieSignalsChanged(partieId: string, ownerId: string | null): Promise<void> {
    await this.emitMembersOnlySafe(partieId, ownerId);
  }

  /** `PartieSignalsPort` (Story 37.8) : le port de la couche 1 (`poll/`) vers ce point d'entrée —
   *  même comportement, un seul émetteur. */
  async notifyChanged(partieId: string): Promise<void> {
    // Contrat du port : ne lève jamais (la mutation appelante est déjà validée). Le propriétaire
    // est lu ici, pour que `poll/` n'ait jamais à le connaître.
    try {
      const partie = await this.prisma.partie.findUnique({
        where: { id: partieId },
        select: { ownerId: true },
      });
      if (!partie) return;
      await this.notifyPartieSignalsChanged(partieId, partie.ownerId);
    } catch (err) {
      this.logger.warn(
        `Échec de la notification des signaux de la partie ${partieId} : ${String(err)}`,
      );
    }
  }

  async getAvailableSlots(
    partieId: string,
    userId: string,
    weeks: number,
    from?: string,
    to?: string,
    span = 1,
  ): Promise<AvailableSlotDto[] | AggregatedSlotDto[]> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_AVAILABILITY_READ', {
      partieId,
    });
    // Projection selon le rôle (Story 37.6) : détail nominatif des créneaux pour le MJ seul.
    const nominative = role === 'mj';
    const participants = await this.permissions.membersOf(partie);

    const participantIds = participants.map((p) => p.userId);
    // getActiveDeclarationsWithSeances (pas getActiveDeclarations) : injecte l'indisponibilité
    // dérivée des séances datées d'AUTRES parties des membres (AD-9, Story 30.5) — source unique
    // partagée par getAvailableSlots (vue MJ) et getHeatmap (vue joueur), AC6.
    const declarationsMap =
      await this.availability.getActiveDeclarationsWithSeances(participantIds);

    if (!!from !== !!to) {
      throw new BadRequestException('from and to must both be provided together');
    }
    // Story 47.6 : la durée des fenêtres, en créneaux (filet de sécurité derrière le DTO).
    if (!Number.isInteger(span) || span < 1 || span > MAX_SLOT_WINDOW_SLOTS) {
      throw new BadRequestException(SPAN_MESSAGE);
    }

    const SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;

    // Les jours de DÉPART des fenêtres (UTC) : la plage demandée, ou les `weeks` prochaines semaines.
    const startDays: number[] = [];
    if (from && to) {
      const fromMs = new Date(from + 'T00:00:00Z').getTime();
      const toMs = new Date(to + 'T00:00:00Z').getTime();
      if (fromMs > toMs) throw new BadRequestException('from must be before or equal to to');
      if (toMs - fromMs > 366 * 86_400_000)
        throw new BadRequestException('Date range cannot exceed 366 days');
      for (let ms = fromMs; ms <= toMs; ms += 86_400_000) startDays.push(ms);
    } else {
      const now = new Date();
      const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      for (let d = 0; d < weeks * 7; d++) startDays.push(todayUtcMidnight + d * 86_400_000);
    }

    // Story 47.6 : le statut de chaque membre sur un créneau précis est calculé UNE fois (clé `jour|créneau`),
    // puis relu par chaque fenêtre qui le recouvre — jamais recalculé par fenêtre.
    const statusGrid = new Map<string, SlotStatus[]>();
    const statusesAt = (date: string, slot: (typeof SLOTS)[number]): SlotStatus[] => {
      const key = `${date}|${slot}`;
      let row = statusGrid.get(key);
      if (!row) {
        const dateUtc = new Date(`${date}T00:00:00Z`);
        row = participants.map((p) =>
          this.availability.computeSlotStatus(declarationsMap.get(p.userId) ?? [], dateUtc, slot),
        );
        statusGrid.set(key, row);
      }
      return row;
    };
    // Le pire statut d'un membre sur la plage : UNAVAILABLE > UNKNOWN > AVAILABLE.
    const worst = (a: SlotStatus, b: SlotStatus): SlotStatus => {
      if (a === 'UNAVAILABLE' || b === 'UNAVAILABLE') return 'UNAVAILABLE';
      if (a === 'UNKNOWN' || b === 'UNKNOWN') return 'UNKNOWN';
      return 'AVAILABLE';
    };

    const all: AvailableSlotDto[] = [];
    for (const ms of startDays) {
      const date = new Date(ms).toISOString().substring(0, 10);
      for (const slot of SLOTS) {
        const covered = spanSlots(date, slot, span);
        const statuses = covered
          .map((c) => statusesAt(c.date, c.slot as (typeof SLOTS)[number]))
          .reduce((acc, row) => acc.map((st, i) => worst(st, row[i])));
        all.push({
          date,
          slot,
          members: participants.map((p, i) => ({
            userId: p.userId,
            pseudo: p.pseudo,
            displayName: p.displayName,
            status: statuses[i],
          })),
          durationSlots: span,
        });
      }
    }

    // Q1: hard-exclude tout créneau où le MJ est UNAVAILABLE (prérequis organisateur)
    const ownerId = partie.ownerId;
    const filtered = all.filter((s) => {
      const mj = s.members.find((m) => m.userId === ownerId);
      return mj?.status !== 'UNAVAILABLE';
    });

    // Priorité : 0=tous dispos, 1=mixte sans refus, 2=tous inconnus, 3=au moins un refus
    const priority = (s: AvailableSlotDto): number => {
      const hasUnavail = s.members.some((m) => m.status === 'UNAVAILABLE');
      const availCount = s.members.filter((m) => m.status === 'AVAILABLE').length;
      if (hasUnavail) return 3;
      if (availCount === s.members.length) return 0;
      if (availCount > 0) return 1;
      return 2;
    };

    const slotIdx = (s: AvailableSlotDto) => SLOTS.indexOf(s.slot as (typeof SLOTS)[number]);

    const sorted = [...filtered].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      if (pa === 1) {
        const ca = a.members.filter((m) => m.status === 'AVAILABLE').length;
        const cb = b.members.filter((m) => m.status === 'AVAILABLE').length;
        if (ca !== cb) return cb - ca;
      }
      const dateCmp = a.date.localeCompare(b.date);
      return dateCmp !== 0 ? dateCmp : slotIdx(a) - slotIdx(b);
    });

    // Story 46.3 — vue nominative du MJ seulement : une fenêtre déjà proposée par un sondage ouvert de la partie ne
    // se repropose pas. L'exclusion précède le plafond (les 20 restants sont de vraies propositions) ; la vue agrégée
    // des joueurs reste identique à celle d'avant.
    const proposed = nominative
      ? await this.polls.openOptionKeys(this.prisma, partieId)
      : new Set<string>();
    // Story 47.6 : l'exclusion compare le départ ET la durée (clé `jour|créneau|durée`).
    const open = sorted.filter((s) => !proposed.has(`${s.date}|${s.slot}|${s.durationSlots}`));

    if (nominative) {
      // Story 46.4 — les fenêtres que CE MJ a masquées : retirées AVANT le plafond de 20, puis servies à part, après
      // les visibles, marquées `hidden`. Une ligne dont la date est passée est ignorée. Chaque fenêtre porte sa durée
      // en créneaux : on ne masque une fenêtre que pour cette durée-là (Story 47.6).
      const hidden = await this.hiddenWindowKeys(partieId, userId);
      const hiddenKey = (s: AvailableSlotDto) => `${s.date}|${s.slot}|${s.durationSlots}`;
      const visible = open.filter((s) => !hidden.has(hiddenKey(s))).slice(0, 20);
      const apart = open
        .filter((s) => hidden.has(hiddenKey(s)))
        .map((s) => ({ ...s, hidden: true }));
      return [...visible, ...apart];
    }

    const limited = open.slice(0, 20);

    return limited.map(({ date, slot, members }) => ({
      date,
      slot,
      available: members.filter((m) => m.status === 'AVAILABLE').length,
      unavailable: members.filter((m) => m.status === 'UNAVAILABLE').length,
      unknown: members.filter((m) => m.status === 'UNKNOWN').length,
      total: members.length,
    }));
  }

  /** Story 46.4 — les clés `AAAA-MM-JJ|CRÉNEAU|DURÉE` des fenêtres que `userId` a masquées sur cette partie, hors
   *  dates passées (ignorées à la lecture). Les lignes d'un autre utilisateur ne sont jamais lues. */
  private async hiddenWindowKeys(partieId: string, userId: string): Promise<Set<string>> {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const rows = await this.prisma.slotWindowHidden.findMany({
      where: { userId, partieId, date: { gte: today } },
      select: { date: true, startSlot: true, durationSlots: true },
    });
    return new Set(
      rows.map((r) => `${r.date.toISOString().substring(0, 10)}|${r.startSlot}|${r.durationSlots}`),
    );
  }

  /**
   * Story 46.4 (FR3, AR7) — masquer une fenêtre de l'automate : le MJ d'un JDR, pour lui seul (`SLOT_WINDOW_HIDE`,
   * refusé à un joueur, à un groupe, à un non-membre). La fenêtre est celle que `getAvailableSlots` a servie ; une
   * date passée est refusée (400). Idempotent (`skipDuplicates`). N'émet qu'après l'écriture : `user:{id}` du MJ
   * seulement, pour que ses autres onglets et appareils relisent la liste.
   */
  async hideWindow(
    partieId: string,
    userId: string,
    dto: SlotWindowKeyBody,
  ): Promise<{ ok: true }> {
    await this.permissions.assert(userId, 'SLOT_WINDOW_HIDE', { partieId });
    const todayKey = new Date().toISOString().substring(0, 10);
    if (dto.date < todayKey) throw new BadRequestException(HIDE_WINDOW_PAST_MESSAGE);
    await this.prisma.slotWindowHidden.createMany({
      data: [
        {
          userId,
          partieId,
          date: new Date(`${dto.date}T00:00:00.000Z`),
          startSlot: dto.startSlot,
          durationSlots: dto.durationSlots,
        },
      ],
      skipDuplicates: true,
    });
    this.realtimeEvents.emit(userTopic(userId));
    return { ok: true };
  }

  /** Story 46.4 — démasquer une fenêtre : même droit, mêmes émissions ; sans effet si elle ne l'était pas. */
  async showWindow(
    partieId: string,
    userId: string,
    dto: SlotWindowKeyBody,
  ): Promise<{ ok: true }> {
    await this.permissions.assert(userId, 'SLOT_WINDOW_HIDE', { partieId });
    await this.prisma.slotWindowHidden.deleteMany({
      where: {
        userId,
        partieId,
        date: new Date(`${dto.date}T00:00:00.000Z`),
        startSlot: dto.startSlot,
        durationSlots: dto.durationSlots,
      },
    });
    this.realtimeEvents.emit(userTopic(userId));
    return { ok: true };
  }

  async getHeatmap(
    partieId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<AggregatedSlotDto[]> {
    const { partie, role } = await this.permissions.assert(userId, 'PARTIE_AVAILABILITY_READ', {
      partieId,
    });
    // Projection selon le rôle (Story 37.6) : détail nominatif pour le MJ seul (FR-53).
    const nominative = role === 'mj';
    const participants = await this.permissions.membersOf(partie);

    const participantIds = participants.map((p) => p.userId);
    // getActiveDeclarationsWithSeances (pas getActiveDeclarations) : injecte l'indisponibilité
    // dérivée des séances datées d'AUTRES parties des membres (AD-9, Story 30.5) — source unique
    // partagée par getAvailableSlots (vue MJ) et getHeatmap (vue joueur), AC6.
    const declarationsMap =
      await this.availability.getActiveDeclarationsWithSeances(participantIds);

    const SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;
    const fromMs = new Date(from + 'T00:00:00Z').getTime();
    const toMs = new Date(to + 'T00:00:00Z').getTime();
    if (fromMs > toMs) throw new BadRequestException('from must be before or equal to to');
    if (toMs - fromMs > 45 * 86_400_000)
      throw new BadRequestException('Date range must not exceed 45 days');
    const results: AggregatedSlotDto[] = [];

    for (let ms = fromMs; ms <= toMs; ms += 86_400_000) {
      const dateUtc = new Date(ms);
      const dateStr = dateUtc.toISOString().substring(0, 10);
      for (const slot of SLOTS) {
        const statuses = participants.map((p) =>
          this.availability.computeSlotStatus(declarationsMap.get(p.userId) ?? [], dateUtc, slot),
        );
        results.push({
          date: dateStr,
          slot,
          available: statuses.filter((s) => s === 'AVAILABLE').length,
          unavailable: statuses.filter((s) => s === 'UNAVAILABLE').length,
          unknown: statuses.filter((s) => s === 'UNKNOWN').length,
          total: participants.length,
          // Story 36.8 (FR-53) — le détail nominatif, POUR LE SEUL MJ. Les statuts par membre
          // sont déjà calculés juste au-dessus : jusqu'ici on les agrégeait et on jetait les
          // identités. Aucune requête nouvelle n'est émise ici.
          //
          // 🚨 La garde est `nominative`, dérivée en tête de méthode du rôle délivré par le
          // service de permission — ne pas la dupliquer, ne pas la déplacer. Le spread
          // conditionnel OMET la clé pour un joueur ; un `members: nominative ? … : []`
          // exposerait la forme de la donnée, et un `: undefined` laisserait la clé dans
          // l'objet. L'absence ne dit rien, c'est ce qu'on veut.
          ...(nominative
            ? {
                members: participants.map((p, i) => ({
                  userId: p.userId,
                  pseudo: p.pseudo,
                  displayName: p.displayName,
                  status: statuses[i],
                })),
              }
            : {}),
        });
      }
    }

    return results;
  }

  /**
   * Remplace l'ensemble complet des chemins de fiche verrouillés (cadenas de visibilité, Story
   * 31.6) pour une Partie — MJ SEUL (`PARTIE_VISIBILITY_LOCKS_UPDATE`, même politique que les
   * autres mutations de Partie ci-dessus). Consommé par l'écran de configuration des cadenas (Story 31.7,
   * `VisibilityLocks`), qui s'appuie sur ce mécanisme déjà fonctionnel sans le modifier.
   *
   * Jeu DÉCLARATIF COMPLET, comme `PollService.setOptions()` (Story 36.10, D-16, même transaction
   * delete-tout-puis-recrée) : ce qui n'est pas dans `dto.paths` est retiré. Contrairement au vote
   * (`PollOption` porte des `PollVote` en cascade, jamais recréables à l'identique), une ligne de
   * `PartieVisibilityLock` ne porte aucune donnée dérivée — un remplacement intégral est sans
   * risque, pas besoin de diff conserver/créer/retirer.
   */
  async setVisibilityLocks(
    partieId: string,
    userId: string,
    dto: SetVisibilityLocksDto,
  ): Promise<{ fieldKey: string; subField: string | null }[]> {
    await this.permissions.assert(userId, 'PARTIE_VISIBILITY_LOCKS_UPDATE', { partieId });

    const wanted = new Map<string, { fieldKey: string; subField: string | null }>();
    for (const p of dto.paths) {
      const subField = p.subField ?? null;
      // Séparateur `.` sûr : `fieldKey`/`subField` sont validés par `FIELD_KEY_PATTERN`
      // (`set-visibility-locks.dto.ts`, alphanumérique sans point) — aucune collision possible
      // entre deux chemins distincts.
      const key = `${p.fieldKey}.${subField ?? ''}`;
      if (wanted.has(key)) {
        throw new BadRequestException('Chemins verrouillés dupliqués');
      }
      wanted.set(key, { fieldKey: p.fieldKey, subField });
    }
    const locks = [...wanted.values()];

    await this.prisma.$transaction(async (tx) => {
      await tx.partieVisibilityLock.deleteMany({ where: { partieId } });
      if (locks.length > 0) {
        await tx.partieVisibilityLock.createMany({
          data: locks.map((l) => ({ partieId, fieldKey: l.fieldKey, subField: l.subField })),
        });
      }
    });
    this.realtimeEvents.emit(partieTopic(partieId));

    return locks;
  }

  /**
   * Lecture symétrique à `setVisibilityLocks()` ci-dessus (Story 31.7) — MJ seul
   * (`PARTIE_VISIBILITY_LOCKS_READ`), même forme `{fieldKey, subField}[]`. Alimente l'écran de configuration des
   * cadenas : un joueur atteignant directement cette route se voit refuser l'accès (403/404),
   * jamais une liste vide qui laisserait croire qu'aucun cadenas n'est posé.
   */
  async getVisibilityLocks(
    partieId: string,
    userId: string,
  ): Promise<{ fieldKey: string; subField: string | null }[]> {
    await this.permissions.assert(userId, 'PARTIE_VISIBILITY_LOCKS_READ', { partieId });
    const locks = await this.prisma.partieVisibilityLock.findMany({ where: { partieId } });
    return locks.map((l) => ({ fieldKey: l.fieldKey, subField: l.subField }));
  }
}
