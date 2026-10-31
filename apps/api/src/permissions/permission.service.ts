import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Partie, Prisma } from '@prisma/client';
import type {
  GameSystemCapability,
  GameSystemFamily,
  MembershipRole,
  OrganizerCan,
  PartieRole,
  PermissionAction,
} from '@master-jdr/shared';
// Import RUNTIME du registre des systèmes (Story 37.5) : la famille du système de la partie choisit
// la politique de droits, ses capacités gardent les actions de couche 3 (Story 37.7). Jamais
// `import type` sur une valeur.
import { GAME_SYSTEMS, familyOf, hasCapability } from '@master-jdr/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Clés d'identifiant qu'une cible de décision de droit peut porter (une seule à la fois). */
type TargetKey =
  | 'partieId'
  | 'eventId'
  | 'seanceId'
  | 'characterId'
  | 'invitationId'
  | 'inviteLinkId'
  | 'announcementId';

/** Cible désignée par la SEULE clé `K` : toutes les autres clés sont interdites (`never`). */
type OnlyTarget<K extends TargetKey> = { [P in K]: string } & {
  [P in Exclude<TargetKey, K>]?: never;
};

/**
 * Cible d'une décision de droit (Story 37.6, AD-6). Pour un événement, une séance, un personnage,
 * une invitation, un lien ou une annonce, la partie est TOUJOURS résolue depuis la cible
 * elle-même — jamais lue dans un paramètre de route : un identifiant d'une autre partie ne peut
 * donc pas être « rattaché » à la partie de l'URL.
 */
export type PermissionTarget =
  // Membres mutuellement exclusifs : une cible mixte (`{ partieId, seanceId }`) ne compile pas —
  // sans quoi l'identifiant de partie (souvent lu dans la route) primerait sur la séance visée.
  // Story 37.7 : personnage, invitation, lien d'invitation et annonce se résolvent eux aussi vers
  // leur partie — jamais depuis la route.
  | OnlyTarget<'partieId'>
  | OnlyTarget<'eventId'>
  | OnlyTarget<'seanceId'>
  | OnlyTarget<'characterId'>
  | OnlyTarget<'invitationId'>
  | OnlyTarget<'inviteLinkId'>
  | OnlyTarget<'announcementId'>;

/** Cible telle que résolue par `assert()` : la partie, plus ce que la cible désignait (une séance
 *  donne aussi son événement). */
export interface ResolvedTarget {
  readonly partieId: string;
  readonly eventId?: string;
  readonly seanceId?: string;
  readonly characterId?: string;
  readonly invitationId?: string;
  readonly inviteLinkId?: string;
  readonly announcementId?: string;
}

/** Marque de l'autorisation : non exportée, aucun autre module ne peut fabriquer un `PartieGrant`
 *  sans passer par `PermissionService.assert()` (hors transtypage explicite, réservé aux tests). */
declare const GRANT_BRAND: unique symbol;

/**
 * Autorisation délivrée par `PermissionService.assert()` : la preuve, vérifiée par le compilateur,
 * qu'un droit a été contrôlé avant l'appel (`EventsService` n'accepte qu'elle — pas d'autorisation,
 * pas d'appel). Elle porte l'action contrôlée et la cible résolue : `EventsService` refuse d'écrire
 * une séance ou un événement qui n'appartient pas à la partie de l'autorisation.
 */
export interface PartieGrant {
  readonly partieId: string;
  /** Qui a été autorisé (Story 44.1) : sert aux projections qui portent ses droits (`can`). */
  readonly userId: string;
  readonly role: PartieRole;
  readonly action: PermissionAction;
  readonly target: ResolvedTarget;
  /** La partie telle que lue pour décider — l'appelant n'a pas à la relire. */
  readonly partie: Partie;
  readonly [GRANT_BRAND]: true;
}

/** Un participant d'une partie (propriétaire compris), identité = pseudo + nom affiché. */
export interface PartieMember {
  userId: string;
  pseudo: string;
  displayName: string;
}

/** Refus d'une action réservée au propriétaire, opposé à un membre. */
export const MJ_ONLY_MESSAGE = 'Action réservée au MJ de la partie';
/** Refus d'une action réservée aux administrateurs d'un ralliement, opposé à un simple membre
 *  (Story 38.2). */
export const ADMIN_ONLY_MESSAGE = 'Action réservée aux administrateurs de la partie';
/** Refus d'une action que la politique du ralliement n'ouvre à aucun rôle (Story 38.2) : le
 *  ralliement n'a ni scénario, ni personnage, ni XP… */
export const RALLIEMENT_UNAVAILABLE_MESSAGE =
  "Cette action n'est pas disponible pour ce type de partie";
/** Refus d'une action réservée à l'hôte d'une conjonction (Story 40.2) : un autre membre du groupe,
 *  administrateur compris, ne la modifie pas. */
export const HOST_ONLY_MESSAGE = "Action réservée à l'hôte de la conjonction";
/** Refus d'annuler une conjonction (Story 42.1) : ni son hôte, ni administrateur du groupe. */
export const HOST_OR_ADMIN_ONLY_MESSAGE =
  "Seul l'hôte de la conjonction ou un administrateur du groupe peut l'annuler";
/** Refus opposé à quelqu'un qui n'a aucun rôle sur la partie. */
export const NO_ACCESS_MESSAGE = "Vous n'avez pas accès à cette partie";
/** Refus d'une action de couche 3 sur une partie dont le système ne déclare pas la capacité. */
export const CAPABILITY_UNAVAILABLE_MESSAGE =
  "Cette fonctionnalité n'est pas disponible pour le système de jeu de cette partie";

/** Refus de lire une Ludothèque (Story 48.3) : UN seul message pour TOUS les refus — personne sans lien,
 *  JDR seul, invitation refusée ou révoquée, lien jamais utilisé, compte inconnu. Rien ne révèle que le
 *  compte existe. */
export const LIBRARY_NOT_FOUND_MESSAGE = 'Ludothèque introuvable';

/** Systèmes de la famille `ralliement` : seules leurs parties ouvrent une Ludothèque à leurs
 *  participants (une partie de JDR jamais). Lu à l'appel, non à l'import : le registre n'est jamais
 *  touché au chargement du module. */
function ralliementSystemIds(): string[] {
  return GAME_SYSTEMS.filter((g) => g.family === 'ralliement').map((g) => g.id);
}

/** « `userId` prend part à cette rencontre isolée » : hôte, membre, ou invité resté sans réponse
 *  (`PENDING`) — un refus (`DECLINED`) ou un retrait (`REVOKED`) n'ouvre plus rien. */
function takesPartInEncounter(userId: string): Prisma.PartieWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { memberships: { some: { userId } } },
      { invitations: { some: { inviteeUserId: userId, status: 'PENDING' } } },
    ],
  };
}

const OWNER_ONLY: readonly PartieRole[] = ['mj'];
const OWNER_AND_MEMBERS: readonly PartieRole[] = ['mj', 'player'];
const ADMIN_ONLY: readonly PartieRole[] = ['admin'];
const ADMIN_AND_MEMBERS: readonly PartieRole[] = ['admin', 'member'];
const NOBODY: readonly PartieRole[] = [];

/**
 * Politique de la famille `jdr` : le propriétaire (MJ) seul organise et administre, les membres
 * (joueurs) lisent et participent. Table COMPLÈTE par construction (`Record` sur l'union fermée
 * `PermissionAction`) : une action ajoutée sans sa ligne ne compile pas.
 */
export const JDR_POLICY: Readonly<Record<PermissionAction, readonly PartieRole[]>> = {
  // Partie
  PARTIE_READ: OWNER_AND_MEMBERS,
  PARTIE_UPDATE: OWNER_ONLY,
  PARTIE_CONVERT_KIND: OWNER_ONLY,
  PARTIE_CLOSE: OWNER_ONLY,
  PARTIE_REOPEN: OWNER_ONLY,
  PARTIE_DELETE: OWNER_ONLY,
  PARTIE_MEMBERS_READ: OWNER_AND_MEMBERS,
  PARTIE_MEMBER_REMOVE: OWNER_ONLY,
  // Story 39.4 : nommer un administrateur / quitter l'office n'existe pas pour une partie de JDR.
  PARTIE_MEMBER_ROLE_SET: NOBODY,
  // Story 39.5 : quitter soi-même une partie n'existe pas en JDR (seul le MJ retire un joueur).
  PARTIE_LEAVE: NOBODY,
  PARTIE_AVAILABILITY_READ: OWNER_AND_MEMBERS,
  // Story 46.4 : masquer une fenêtre de l'automate — le MJ seul, pour lui seul.
  SLOT_WINDOW_HIDE: OWNER_ONLY,
  PARTIE_VISIBILITY_LOCKS_READ: OWNER_ONLY,
  PARTIE_VISIBILITY_LOCKS_UPDATE: OWNER_ONLY,
  PARTIE_COVER_READ: OWNER_AND_MEMBERS,
  PARTIE_COVER_UPDATE: OWNER_ONLY,
  // Fiches de référence du système (Story 37.7)
  PARTIE_REFERENCE_ASSET_READ: OWNER_AND_MEMBERS,
  PARTIE_REFERENCE_ASSET_MJ_READ: OWNER_ONLY,
  // Scénario
  SCENARIO_CREATE: OWNER_ONLY,
  SCENARIO_UPDATE: OWNER_ONLY,
  SCENARIO_STATUS_CHANGE: OWNER_ONLY,
  // Anti-spoil : la lecture est ouverte aux membres, mais filtrée PAR RÔLE dans les services
  // (`scenario-visibility.ts` : brouillons cachés, contenu masqué) — le rôle vient de ce `assert`.
  SCENARIO_READ: OWNER_AND_MEMBERS,
  SCENARIO_DRAFTS_READ: OWNER_ONLY,
  SCENARIO_DOCUMENT_UPLOAD: OWNER_ONLY,
  SCENARIO_DOCUMENTS_READ: OWNER_AND_MEMBERS,
  SCENARIO_PARTICIPATE: OWNER_AND_MEMBERS,
  // Séance
  SEANCE_ADD: OWNER_ONLY,
  SEANCE_DELETE: OWNER_ONLY,
  SEANCE_DATE_RESET: OWNER_ONLY,
  SEANCE_CAPACITY_SET: OWNER_ONLY,
  SEANCE_COMPTE_RENDU_SET: OWNER_ONLY,
  SEANCE_PRACTICAL_INFO_SET: OWNER_ONLY,
  SEANCE_POLL_CREATE: OWNER_ONLY,
  SEANCE_INSCRIBE: OWNER_AND_MEMBERS,
  SEANCE_UNSUBSCRIBE: OWNER_AND_MEMBERS,
  // Story 40.4 : réserver une place à un membre n'existe pas en JDR (inscription libre, sans hôte).
  SEANCE_RESERVE: NOBODY,
  // Vote de date
  POLL_READ: OWNER_AND_MEMBERS,
  POLL_VOTE: OWNER_AND_MEMBERS,
  POLL_CHOOSE: OWNER_ONLY,
  // Story 40.7 : prolonger le vote n'existe pas en JDR (échéance par défaut de 14 jours, inchangée).
  POLL_EXTEND: NOBODY,
  POLL_OPTIONS_SET: OWNER_ONLY,
  POLL_CLOSE: OWNER_ONLY,
  // Personnage (Story 37.7) : tout participant lit ; l'édition de l'XP et de la fiche, l'historique
  // et la distribution d'XP sont réservés au MJ. L'inventaire, le portrait et le journal restent
  // des droits de PROPRIÉTAIRE DE LA FICHE, jamais des droits de partie (hors de cette table).
  CHARACTER_CREATE: OWNER_AND_MEMBERS,
  CHARACTER_LIST: OWNER_AND_MEMBERS,
  CHARACTER_READ: OWNER_AND_MEMBERS,
  CHARACTER_PORTRAIT_READ: OWNER_AND_MEMBERS,
  CHARACTER_NOTES_READ: OWNER_AND_MEMBERS,
  CHARACTER_XP_SET: OWNER_ONLY,
  CHARACTER_SHEET_FIELD_SET: OWNER_ONLY,
  CHARACTER_HISTORY_READ: OWNER_ONLY,
  XP_DISTRIBUTION_CREATE: OWNER_ONLY,
  XP_DISTRIBUTION_READ: OWNER_ONLY,
  // Homme Dragon : créer / lier (MANAGE, soumis à la capacité), lire et délier (sans capacité).
  HOMME_DRAGON_MANAGE: OWNER_ONLY,
  HOMME_DRAGON_READ: OWNER_ONLY,
  HOMME_DRAGON_UNLINK: OWNER_ONLY,
  GROUP_ROLE_ASSIGN: OWNER_ONLY,
  GROUP_ROLE_UNASSIGN: OWNER_ONLY,
  GROUP_ROLE_READ: OWNER_AND_MEMBERS,
  ANNOUNCEMENT_CREATE: OWNER_ONLY,
  ANNOUNCEMENT_READ: OWNER_AND_MEMBERS,
  ANNOUNCEMENT_MARK_READ: OWNER_AND_MEMBERS,
  // Story 40.1 : les événements d'un groupe de ralliement (conjonctions) n'existent pas en JDR — le
  // JDR crée et lit ses événements par ses scénarios.
  EVENT_CREATE: NOBODY,
  EVENT_LIST: NOBODY,
  EVENT_UPDATE: NOBODY,
  EVENT_CANCEL: NOBODY,
  // Story 49.2 : apporter un jeu à une soirée — n'existe pas en JDR.
  EVENT_GAME_BRING: NOBODY,
  // Story 49.4 : écarter un jeu de l'hôte pour une soirée — n'existe pas en JDR.
  EVENT_GAME_EXCLUDE: NOBODY,
  // Story 49.5 : signaler une Envie sur un jeu d'une soirée — n'existe pas en JDR.
  EVENT_GAME_ENVY: NOBODY,
  // Invitations : le MJ invite, liste et révoque (l'invitant est toujours le propriétaire, la
  // propriété d'une partie étant immuable).
  INVITATION_CREATE: OWNER_ONLY,
  INVITATION_READ: OWNER_ONLY,
  INVITATION_REVOKE: OWNER_ONLY,
  INVITE_LINK_CREATE: OWNER_ONLY,
  INVITE_LINK_READ: OWNER_ONLY,
  INVITE_LINK_REVOKE: OWNER_ONLY,
};

/**
 * Politique de la famille `ralliement` (Story 38.2) : « voir » (partie, membres, couverture) pour
 * l'administrateur et les membres, « modifier la partie » (édition, couverture) et, depuis la Story
 * 39.1, « clore / rouvrir / brûler » et, depuis la Story 39.3, « inviter / retirer un membre » pour
 * l'administrateur seul, et, depuis la Story 39.4, « nommer un administrateur / quitter l'office ».
 * Depuis la Story 39.5, « quitter le groupe » est ouvert à l'administrateur et aux membres, et depuis
 * la Story 40.1, « proposer une conjonction / lister celles du groupe » et, depuis la Story 40.3,
 * « s'inscrire à une conjonction / s'en désinscrire », puis, Story 40.4, « réserver une place » et,
 * Story 40.6, « fixer la date » et, Story 40.7, « prolonger le vote » (l'hôte seul, décidé dans `assert()`).
 * TOUTE autre action est refusée
 * à tous les rôles — le ralliement n'a ni scénario, ni personnage, ni XP. Table COMPLÈTE par
 * construction (`Record` sur l'union fermée) : une action ajoutée sans sa ligne ne compile pas.
 */
export const RALLIEMENT_POLICY: Readonly<Record<PermissionAction, readonly PartieRole[]>> = {
  // Partie
  PARTIE_READ: ADMIN_AND_MEMBERS,
  PARTIE_UPDATE: ADMIN_ONLY,
  PARTIE_CONVERT_KIND: NOBODY,
  PARTIE_CLOSE: ADMIN_ONLY,
  PARTIE_REOPEN: ADMIN_ONLY,
  PARTIE_DELETE: ADMIN_ONLY,
  PARTIE_MEMBERS_READ: ADMIN_AND_MEMBERS,
  PARTIE_MEMBER_REMOVE: ADMIN_ONLY,
  // Story 39.4 : nommer un administrateur, quitter l'office. La cellule vaut pour la famille
  // entière ; le refus du `ONE_SHOT` (un seul administrateur) est posé dans le service.
  PARTIE_MEMBER_ROLE_SET: ADMIN_ONLY,
  // Story 39.5 : quitter le groupe, pour l'administrateur comme pour le membre. Même remarque : le
  // refus du `ONE_SHOT` est posé dans le service (`PartiesService.leave`).
  PARTIE_LEAVE: ADMIN_AND_MEMBERS,
  PARTIE_AVAILABILITY_READ: NOBODY,
  // Story 46.4 : le ralliement n'a pas de fenêtres de l'automate (le serveur les refuse à un groupe).
  SLOT_WINDOW_HIDE: NOBODY,
  PARTIE_VISIBILITY_LOCKS_READ: NOBODY,
  PARTIE_VISIBILITY_LOCKS_UPDATE: NOBODY,
  PARTIE_COVER_READ: ADMIN_AND_MEMBERS,
  PARTIE_COVER_UPDATE: ADMIN_ONLY,
  PARTIE_REFERENCE_ASSET_READ: NOBODY,
  PARTIE_REFERENCE_ASSET_MJ_READ: NOBODY,
  // Scénario
  SCENARIO_CREATE: NOBODY,
  SCENARIO_UPDATE: NOBODY,
  SCENARIO_STATUS_CHANGE: NOBODY,
  SCENARIO_READ: NOBODY,
  SCENARIO_DRAFTS_READ: NOBODY,
  SCENARIO_DOCUMENT_UPLOAD: NOBODY,
  SCENARIO_DOCUMENTS_READ: NOBODY,
  SCENARIO_PARTICIPATE: NOBODY,
  // Séance
  SEANCE_ADD: NOBODY,
  SEANCE_DELETE: NOBODY,
  SEANCE_DATE_RESET: NOBODY,
  SEANCE_CAPACITY_SET: NOBODY,
  SEANCE_COMPTE_RENDU_SET: NOBODY,
  SEANCE_PRACTICAL_INFO_SET: NOBODY,
  SEANCE_POLL_CREATE: NOBODY,
  // Story 40.3 : s'inscrire à une conjonction et s'en désinscrire — tout membre du groupe. La cellule
  // vaut pour la famille entière ; le refus de la rencontre isolée (`ONE_SHOT`) est posé dans le
  // service (`GroupEventsService`).
  SEANCE_INSCRIBE: ADMIN_AND_MEMBERS,
  SEANCE_UNSUBSCRIBE: ADMIN_AND_MEMBERS,
  // Story 40.4 : réserver une place / retirer une réservation. Tout membre passe la cellule ; la règle
  // « hôte de l'événement » est décidée plus bas, dans `assert()` (HOST_ONLY_ACTIONS) — jamais ailleurs.
  SEANCE_RESERVE: ADMIN_AND_MEMBERS,
  // Vote de date
  POLL_READ: NOBODY,
  // Story 40.5 : voter (et retirer son vote) sur le sondage de dates d'une conjonction — tout membre
  // passe la cellule ; « éligible », « avant l'échéance », « date pas encore fixée » sont décidés par
  // le sondage lui-même, via le port des votes de groupe (`poll/ports/`), jamais ici.
  POLL_VOTE: ADMIN_AND_MEMBERS,
  // Story 40.6 : fixer la date d'une conjonction (route partagée avec le JDR, `PATCH …/poll/:id/choose`).
  // Tout membre passe la cellule ; la règle « hôte de l'événement » est décidée plus bas, dans
  // `assert()` (HOST_ONLY_WHEN_EVENT_TARGETED), sur la cible `{ eventId }`.
  POLL_CHOOSE: ADMIN_AND_MEMBERS,
  // Story 40.7 : prolonger le vote d'une conjonction. Tout membre passe la cellule ; la règle « hôte de
  // l'événement » est décidée plus bas, dans `assert()` (HOST_ONLY_WHEN_EVENT_TARGETED), sur la cible
  // `{ eventId }` — comme `POLL_CHOOSE`.
  POLL_EXTEND: ADMIN_AND_MEMBERS,
  POLL_OPTIONS_SET: NOBODY,
  POLL_CLOSE: NOBODY,
  // Capacités JDR
  CHARACTER_CREATE: NOBODY,
  CHARACTER_LIST: NOBODY,
  CHARACTER_READ: NOBODY,
  CHARACTER_PORTRAIT_READ: NOBODY,
  CHARACTER_NOTES_READ: NOBODY,
  CHARACTER_XP_SET: NOBODY,
  CHARACTER_SHEET_FIELD_SET: NOBODY,
  CHARACTER_HISTORY_READ: NOBODY,
  XP_DISTRIBUTION_CREATE: NOBODY,
  XP_DISTRIBUTION_READ: NOBODY,
  HOMME_DRAGON_MANAGE: NOBODY,
  HOMME_DRAGON_READ: NOBODY,
  HOMME_DRAGON_UNLINK: NOBODY,
  GROUP_ROLE_ASSIGN: NOBODY,
  GROUP_ROLE_UNASSIGN: NOBODY,
  GROUP_ROLE_READ: NOBODY,
  ANNOUNCEMENT_CREATE: NOBODY,
  ANNOUNCEMENT_READ: NOBODY,
  ANNOUNCEMENT_MARK_READ: NOBODY,
  // Story 40.1 : tout membre du groupe (administrateur ou membre) propose une conjonction, dont il
  // est l'hôte, et lit celles du groupe. La cellule vaut pour la famille entière ; le refus de la
  // rencontre isolée (`ONE_SHOT`) est posé dans le service (`GroupEventsService`).
  EVENT_CREATE: ADMIN_AND_MEMBERS,
  EVENT_LIST: ADMIN_AND_MEMBERS,
  // Story 40.2 : modifier une conjonction. Tout membre passe la cellule ; la règle « hôte de
  // l'événement » est décidée plus bas, dans `assert()` (HOST_ONLY_ACTIONS) — jamais ailleurs.
  EVENT_UPDATE: ADMIN_AND_MEMBERS,
  // Story 42.1 : annuler une conjonction. Tout membre passe la cellule ; « hôte de l'événement OU
  // administrateur du groupe » est décidé plus bas, dans `assert()` (HOST_OR_ADMIN_ACTIONS). La cellule
  // vaut pour la famille entière ; le refus de la rencontre isolée est posé dans le service (42.2 le lève).
  EVENT_CANCEL: ADMIN_AND_MEMBERS,
  // Story 49.2 : apporter un de ses jeux à une soirée. Tout membre passe la cellule ; « participant de la
  // soirée, autre que l'hôte » est décidé sous le verrou de l'événement par `EventGameBringService` (le rôle
  // seul ne dit rien de l'inscription CONFIRMÉE) — ce n'est donc PAS une action réservée à l'hôte.
  EVENT_GAME_BRING: ADMIN_AND_MEMBERS,
  // Story 49.4 : écarter un jeu de l'hôte pour une soirée. Tout membre passe la cellule ; « hôte de
  // l'événement » est décidé plus bas (HOST_ONLY_ACTIONS), « soirée ouverte, jeu à l'hôte » sous le verrou
  // de l'événement par `EventGameExclusionService`.
  EVENT_GAME_EXCLUDE: ADMIN_AND_MEMBERS,
  // Story 49.5 : signaler une Envie. Tout membre passe la cellule ; « participant de la soirée (place réservée
  // exclue), nom de jeu sur place » est décidé sous le verrou de l'événement par `EventGameEnvyService` — ce
  // n'est donc PAS une action réservée à l'hôte.
  EVENT_GAME_ENVY: ADMIN_AND_MEMBERS,
  // Invitations (Story 39.3) : l'administrateur invite, liste et révoque ; un simple membre n'a que
  // la lecture de la liste des membres. La cellule vaut pour la famille entière (l'invitation à
  // usage unique, épopée 41, n'a pas encore d'interface : l'UI reste réservée aux groupes).
  INVITATION_CREATE: ADMIN_ONLY,
  INVITATION_READ: ADMIN_ONLY,
  INVITATION_REVOKE: ADMIN_ONLY,
  INVITE_LINK_CREATE: ADMIN_ONLY,
  INVITE_LINK_READ: ADMIN_ONLY,
  INVITE_LINK_REVOKE: ADMIN_ONLY,
};

/**
 * Garde de capacité (Story 37.7, AD-1) : action d'ÉCRITURE de couche 3 → capacité que le système
 * de la partie doit déclarer dans le registre. Posée ICI, dans `assert()`, jamais par un test local
 * du système : un service de couche 3 n'a pas d'autre chemin vers une autorisation, il ne peut donc
 * pas l'oublier.
 *
 * Les LECTURES, le retrait d'un lien (`HOMME_DRAGON_UNLINK`) et `ANNOUNCEMENT_MARK_READ` n'exigent
 * aucune capacité (décision du 2026-10-10) : sur un système sans la capacité, une lecture garde son
 * contrôle de rôle et renvoie vide / null comme avant. Une action absente de la table n'exige
 * aucune capacité (couches 1 et 2, scénario — `scenarioLifecycle` et `linearCampaign` restent
 * gardés dans `scenarios/`, reporté).
 */
export const ACTION_CAPABILITY: Readonly<Partial<Record<PermissionAction, GameSystemCapability>>> =
  {
    CHARACTER_CREATE: 'characters',
    CHARACTER_XP_SET: 'xp',
    CHARACTER_SHEET_FIELD_SET: 'characters',
    XP_DISTRIBUTION_CREATE: 'xp',
    HOMME_DRAGON_MANAGE: 'hommeDragon',
    GROUP_ROLE_ASSIGN: 'groupRoles',
    ANNOUNCEMENT_CREATE: 'announcements',
  };

/** Actions réservées à l'HÔTE de l'événement visé (Story 40.2) : au-delà de la cellule de rôle de la
 *  politique, l'appelant doit être le propriétaire de l'événement. Décidé ICI et nulle part ailleurs —
 *  aucun code hors de `permissions/` ne lit `ownerId` pour un droit. */
const HOST_ONLY_ACTIONS: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'EVENT_UPDATE',
  // Story 40.4 : réserver / retirer une réservation — cible `{ seanceId }` (l'hôte est celui de
  // l'événement de la séance).
  'SEANCE_RESERVE',
  // Story 49.4 : écarter un jeu de l'hôte pour une soirée — cible `{ eventId }`.
  'EVENT_GAME_EXCLUDE',
]);

/** Story 42.1 — actions ouvertes à l'HÔTE de l'événement visé OU à un administrateur du groupe (cible
 *  `{ eventId }` obligatoire ; sans événement ou sans hôte, seul l'administrateur passe). Décidé ICI. */
const HOST_OR_ADMIN_ACTIONS: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'EVENT_CANCEL',
]);

/** Story 40.6 — actions réservées à l'hôte, mais seulement dans la famille `ralliement` et seulement
 *  quand la cible désigne un événement (`{ eventId }`) : la route partagée avec le JDR (fixer la date
 *  d'un vote) commence par une cible `{ partieId }` — cellule de rôle seule, qui ne dit encore rien du
 *  sondage visé —, puis `PollService` re-décide sur l'événement du sondage pour un groupe. Dans la
 *  famille `jdr`, la cellule du MJ suffit, comme avant. */
const HOST_ONLY_WHEN_EVENT_TARGETED: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'POLL_CHOOSE',
  // Story 40.7 : prolonger le vote — même route-cellule `{ partieId }` puis re-décision sur l'événement du
  // sondage, par `PollService`.
  'POLL_EXTEND',
]);

/** Politique applicable à une famille. Un système inconnu du registre retombe sur la politique
 *  `jdr`. */
function policyFor(
  family: GameSystemFamily | null,
): Readonly<Record<PermissionAction, readonly PartieRole[]>> {
  switch (family) {
    case 'ralliement':
      return RALLIEMENT_POLICY;
    case 'jdr':
    case null:
      return JDR_POLICY;
    default: {
      const exhaustive: never = family;
      throw new Error(`Famille de système sans politique de droits : ${String(exhaustive)}`);
    }
  }
}

/** Règle de rôle de la famille `jdr` : le propriétaire est `mj`, un membre est `player`. Un
 *  propriétaire nul (AD-5) n'est jamais `mj` — la comparaison est faite sur une valeur non nulle. */
function jdrRole(ownerId: string | null, userId: string, isMember: boolean): PartieRole | null {
  if (ownerId !== null && ownerId === userId) return 'mj';
  return isMember ? 'player' : null;
}

/** Règle de rôle de la famille `ralliement` (Story 38.2) : le rôle vient UNIQUEMENT de
 *  `Membership.role` (`ADMIN` → `admin`, `MEMBER` → `member`) ; le propriétaire n'est jamais `mj`.
 *  Un propriétaire sans ligne de membership compte comme `admin`. */
function ralliementRole(
  ownerId: string | null,
  userId: string,
  membershipRole: MembershipRole | null,
): PartieRole | null {
  if (membershipRole === 'ADMIN') return 'admin';
  if (membershipRole === 'MEMBER') return 'member';
  return ownerId !== null && ownerId === userId ? 'admin' : null;
}

/** Rôle de `userId` selon la famille de la partie. `membership` = sa ligne `Membership` (`null`
 *  s'il n'en a pas) : famille `jdr`, sa seule existence compte ; `ralliement`, son `role` décide. */
function roleFor(
  partie: Pick<Partie, 'ownerId' | 'gameSystemId'>,
  userId: string,
  membership: { role: MembershipRole } | null,
): PartieRole | null {
  if (familyOf(partie.gameSystemId) === 'ralliement') {
    return ralliementRole(partie.ownerId, userId, membership?.role ?? null);
  }
  return jdrRole(partie.ownerId, userId, membership != null);
}

/** Cible d'un lot (`canMany`, `organizerCan` — Story 44.1) : une séance OU un événement, jamais une
 *  partie seule (la règle « hôte » ne joue que sur un événement). */
export type BatchTarget = OnlyTarget<'seanceId'> | OnlyTarget<'eventId'>;

/** Ce que la décision d'un droit lit : la partie, le rôle déjà trouvé, la cible résolue et l'hôte de
 *  l'événement visé. */
interface DecisionContext {
  readonly partie: Pick<Partie, 'gameSystemId'>;
  readonly role: PartieRole;
  readonly resolved: ResolvedTarget;
  readonly eventOwnerId?: string | null;
}

/**
 * Story 44.1 (AD-4) — action décidant chaque drapeau de `can`, par famille. Le JDR décide sur la séance
 * (cellule du MJ) ; le ralliement sur l'événement (hôte seul, `EVENT_UPDATE` / `POLL_CHOOSE` /
 * `POLL_EXTEND`). `POLL_EXTEND` n'existe pas en JDR : le MJ repousse l'échéance en modifiant le sondage.
 * Cette correspondance vit ICI et nulle part ailleurs.
 */
const ORGANIZER_ACTIONS: Readonly<
  Record<'jdr' | 'ralliement', Readonly<Record<keyof OrganizerCan, PermissionAction>>>
> = {
  jdr: {
    propose: 'SEANCE_POLL_CREATE',
    edit: 'POLL_OPTIONS_SET',
    choose: 'POLL_CHOOSE',
    extend: 'POLL_EXTEND',
  },
  ralliement: {
    propose: 'EVENT_UPDATE',
    edit: 'EVENT_UPDATE',
    choose: 'POLL_CHOOSE',
    extend: 'POLL_EXTEND',
  },
};

/**
 * LA décision d'un droit, une fois le rôle trouvé : `null` si accordé, sinon l'exception à lever. Partagée
 * par `assert()` (qui la lève) et `canMany()` (qui n'en garde que l'issue) — elles ne peuvent donc pas
 * diverger. Ordre : cellule de rôle, règles « hôte », capacité.
 */
function refusalFor(input: {
  userId: string;
  action: PermissionAction;
  role: PartieRole;
  partie: Pick<Partie, 'gameSystemId'>;
  resolved: ResolvedTarget;
  eventOwnerId?: string | null;
}): ForbiddenException | BadRequestException | null {
  const { userId, action, role, partie, resolved, eventOwnerId } = input;
  const family = familyOf(partie.gameSystemId);
  const allowed = policyFor(family)[action];
  if (!allowed.includes(role)) {
    if (family === 'ralliement') {
      // Aucun rôle n'a ce droit : l'action n'existe pas pour ce type de partie ; sinon elle est
      // réservée aux administrateurs.
      return new ForbiddenException(
        allowed.length === 0 ? RALLIEMENT_UNAVAILABLE_MESSAGE : ADMIN_ONLY_MESSAGE,
      );
    }
    return new ForbiddenException(MJ_ONLY_MESSAGE);
  }
  // Story 40.2 : l'hôte de l'événement visé seul (cible `{ eventId }` ou, Story 40.4, `{ seanceId }`
  // obligatoire ; une cible sans événement, ou un événement sans hôte — compte supprimé —, n'ouvre
  // rien).
  const hostOnly =
    HOST_ONLY_ACTIONS.has(action) ||
    (family === 'ralliement' &&
      HOST_ONLY_WHEN_EVENT_TARGETED.has(action) &&
      resolved.eventId !== undefined);
  if (hostOnly && (eventOwnerId == null || eventOwnerId !== userId)) {
    return new ForbiddenException(HOST_ONLY_MESSAGE);
  }
  // Story 42.1 : l'hôte de l'événement, ou un administrateur du groupe.
  if (
    HOST_OR_ADMIN_ACTIONS.has(action) &&
    role !== 'admin' &&
    (resolved.eventId === undefined || eventOwnerId == null || eventOwnerId !== userId)
  ) {
    return new ForbiddenException(HOST_OR_ADMIN_ONLY_MESSAGE);
  }
  const capability = ACTION_CAPABILITY[action];
  if (capability !== undefined && !hasCapability(partie.gameSystemId, capability)) {
    return new BadRequestException(CAPABILITY_UNAVAILABLE_MESSAGE);
  }
  return null;
}

/**
 * Service UNIQUE de décision des droits sur une partie, ses événements et ses séances (Story
 * 37.6, AD-6). Transverse : n'importe que `PrismaService` et le registre des systèmes — aucun
 * module métier, pour que toutes les couches puissent l'injecter sans cycle.
 */
@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie que `userId` peut faire `action` sur `target`, et renvoie l'autorisation.
   * Cible inconnue → 404 (message historique de la cible) ; aucun rôle → 403
   * `NO_ACCESS_MESSAGE` ; rôle insuffisant → 403 `MJ_ONLY_MESSAGE` ; capacité absente du système
   * de la partie → 400 `CAPABILITY_UNAVAILABLE_MESSAGE`. Ordre : rôle d'abord, capacité ensuite
   * (un étranger n'apprend rien du système d'une partie qui n'est pas la sienne).
   */
  async assert(
    userId: string,
    action: PermissionAction,
    target: PermissionTarget,
  ): Promise<PartieGrant> {
    const { partie, resolved, eventOwnerId } = await this.resolveTarget(target);
    const role = await this.roleIn(partie, userId);
    if (role === null) throw new ForbiddenException(NO_ACCESS_MESSAGE);
    const refusal = refusalFor({ userId, action, role, partie, resolved, eventOwnerId });
    if (refusal) throw refusal;
    return { partieId: partie.id, userId, role, action, target: resolved, partie } as PartieGrant;
  }

  /**
   * Story 48.3 — `LIBRARY_READ`, cible `{ userId }` : `readerId` peut-il lire la Ludothèque de
   * `ownerUserId` ? Décidé ICI et nulle part ailleurs (`board-games/` ne recode aucune règle de
   * visibilité). Ouvert :
   *  - à la personne elle-même ;
   *  - à deux membres d'une même partie de la famille `ralliement` (groupe ou rencontre isolée) ;
   *  - dans une rencontre isolée (`ONE_SHOT` de ralliement), à l'hôte, aux membres et aux invités
   *    `PENDING`, entre eux. L'état de la rencontre (annulée, passée) n'est pas considéré.
   * Rien d'autre n'ouvre : partie de JDR, invitation `DECLINED` / `REVOKED`, lien d'invitation jamais
   * utilisé (aucun `Membership` n'existe), compte inconnu. TOUT refus est le même 404 au même
   * message : la cible n'est jamais résolue en partie, il n'y a donc pas de 403.
   */
  async assertLibraryRead(readerId: string, ownerUserId: string): Promise<void> {
    if (readerId === ownerUserId) return;
    const shared = await this.prisma.partie.findFirst({
      where: {
        gameSystemId: { in: ralliementSystemIds() },
        OR: [
          // Groupe ou rencontre : membres de la même partie.
          {
            AND: [
              { memberships: { some: { userId: readerId } } },
              { memberships: { some: { userId: ownerUserId } } },
            ],
          },
          // Rencontre isolée : hôte / membre / invité en attente, des deux côtés.
          {
            kind: 'ONE_SHOT',
            AND: [takesPartInEncounter(readerId), takesPartInEncounter(ownerUserId)],
          },
        ],
      },
      select: { id: true },
    });
    if (!shared) throw new NotFoundException(LIBRARY_NOT_FOUND_MESSAGE);
  }

  /**
   * Story 44.1 (AD-4) — `userId` peut-il faire `action` sur chacune des cibles ? Même décision que
   * `assert()` (cellule de rôle, règles « hôte », capacité : UNE fonction, `refusalFor`), mais sans rien
   * lever : une cible inconnue, d'une partie sans rôle pour `userId`, ou refusée vaut `false` — rien
   * n'est révélé d'une partie dont on n'est pas membre. Résultat aligné sur `targets`.
   *
   * Cibles `{ seanceId }` ou `{ eventId }` seulement, jamais `{ partieId }` : la règle « hôte » ne joue
   * que sur un événement. Trois lectures au plus (séances, événements, appartenances), quel que soit le
   * nombre de cibles.
   */
  async canMany(
    userId: string,
    action: PermissionAction,
    targets: readonly BatchTarget[],
  ): Promise<boolean[]> {
    const contexts = await this.resolveMany(userId, targets);
    return contexts.map((ctx) => ctx !== null && refusalFor({ userId, action, ...ctx }) === null);
  }

  /**
   * Story 44.1 (AD-4) — les droits d'organisateur (`can`) de `userId` sur chacune des cibles, alignés sur
   * `targets`. Les cibles sont résolues UNE fois pour les quatre drapeaux (quatre actions ne coûtent pas
   * quatre fois les lectures). La correspondance drapeau → action vit ici et nulle part ailleurs.
   */
  async organizerCan(userId: string, targets: readonly BatchTarget[]): Promise<OrganizerCan[]> {
    const contexts = await this.resolveMany(userId, targets);
    return contexts.map((ctx) => {
      const can: OrganizerCan = { propose: false, edit: false, choose: false, extend: false };
      if (ctx === null) return can;
      // Un système inconnu du registre retombe sur la politique `jdr` (comme `policyFor`).
      const mapping =
        familyOf(ctx.partie.gameSystemId) === 'ralliement'
          ? ORGANIZER_ACTIONS.ralliement
          : ORGANIZER_ACTIONS.jdr;
      for (const flag of Object.keys(mapping) as (keyof OrganizerCan)[]) {
        can[flag] = refusalFor({ userId, action: mapping[flag], ...ctx }) === null;
      }
      return can;
    });
  }

  /** Résout un lot de cibles en un nombre fixe de lectures. `null` = cible inconnue, cible invalide ou
   *  aucun rôle de `userId` sur sa partie. Aligné sur `targets`. */
  private async resolveMany(
    userId: string,
    targets: readonly BatchTarget[],
  ): Promise<(DecisionContext | null)[]> {
    const seanceIds = [...new Set(targets.flatMap((t) => (t.seanceId ? [t.seanceId] : [])))];
    const eventIds = [...new Set(targets.flatMap((t) => (t.eventId ? [t.eventId] : [])))];
    if (seanceIds.length === 0 && eventIds.length === 0) return targets.map(() => null);
    const [seances, events] = await Promise.all([
      this.prisma.seance.findMany({
        where: { id: { in: seanceIds } },
        include: { event: { include: { partie: true } } },
      }),
      this.prisma.event.findMany({
        where: { id: { in: eventIds } },
        include: { partie: true },
      }),
    ]);
    const bySeance = new Map(seances.map((s) => [s.id, s]));
    const byEvent = new Map(events.map((e) => [e.id, e]));

    const partieIds = [
      ...new Set([...seances.map((s) => s.event.partieId), ...events.map((e) => e.partieId)]),
    ];
    const memberships = await this.prisma.membership.findMany({
      where: { userId, partieId: { in: partieIds } },
      select: { partieId: true, role: true },
    });
    const membershipByPartie = new Map(memberships.map((m) => [m.partieId, m]));

    return targets.map((target): DecisionContext | null => {
      let partie: Partie;
      let resolved: ResolvedTarget;
      let eventOwnerId: string | null;
      if (target.seanceId) {
        const seance = bySeance.get(target.seanceId);
        if (!seance) return null;
        partie = seance.event.partie;
        resolved = { partieId: partie.id, eventId: seance.event.id, seanceId: seance.id };
        eventOwnerId = seance.event.ownerId;
      } else if (target.eventId) {
        const event = byEvent.get(target.eventId);
        if (!event) return null;
        partie = event.partie;
        resolved = { partieId: partie.id, eventId: event.id };
        eventOwnerId = event.ownerId;
      } else {
        return null;
      }
      const role = roleFor(partie, userId, membershipByPartie.get(partie.id) ?? null);
      return role === null ? null : { partie, role, resolved, eventOwnerId };
    });
  }

  /** Rôle de `userId` sur une partie, `null` s'il n'en a aucun (ou si la partie n'existe pas).
   *  Une seule requête. */
  async roleOf(partieId: string, userId: string): Promise<PartieRole | null> {
    const partie = await this.prisma.partie.findUnique({
      where: { id: partieId },
      select: {
        ownerId: true,
        gameSystemId: true,
        memberships: { where: { userId }, select: { role: true } },
      },
    });
    if (!partie) return null;
    return roleFor(partie, userId, partie.memberships[0] ?? null);
  }

  /** Rôles de `userId` sur un lot de parties — UNE seule requête, jamais une par partie. Les
   *  parties où il n'a aucun rôle (ou inexistantes) sont absentes de la table renvoyée. */
  async rolesOf(userId: string, partieIds: string[]): Promise<Map<string, PartieRole>> {
    const roles = new Map<string, PartieRole>();
    if (partieIds.length === 0) return roles;
    const parties = await this.prisma.partie.findMany({
      where: {
        id: { in: partieIds },
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      select: {
        id: true,
        ownerId: true,
        gameSystemId: true,
        memberships: { where: { userId }, select: { role: true } },
      },
    });
    for (const p of parties) {
      // Retenue par le filtre : propriétaire ou membre — donc membre si elle n'est pas à lui.
      // Famille `jdr` : le propriétaire est `mj`, sinon `player` ; `ralliement` : rôle de la ligne
      // de membership (propriétaire sans ligne = `admin`).
      const role =
        familyOf(p.gameSystemId) === 'ralliement'
          ? ralliementRole(p.ownerId, userId, p.memberships[0]?.role ?? null)
          : jdrRole(p.ownerId, userId, true);
      if (role) roles.set(p.id, role);
    }
    return roles;
  }

  /**
   * Participants d'une partie (famille `jdr` : propriétaire puis membres, dédoublonnés) avec leur
   * pseudo et leur nom affiché. Une partie sans propriétaire (AD-5) ne renvoie que ses membres.
   *
   * Story 36.8 — ORDRE FIXE DE LA TROUPE : la couche « disponibilité du groupe » fait porter
   * l'identité par la POSITION (FR-53) ; tri `joinedAt` puis `userId` en départage (deux membres
   * invités dans le même lot peuvent partager le même `joinedAt`).
   */
  async membersOf(partie: Pick<Partie, 'id' | 'ownerId'>): Promise<PartieMember[]> {
    const [owner, memberships] = await Promise.all([
      this.ownerOf(partie),
      this.prisma.membership.findMany({
        where: { partieId: partie.id },
        orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        include: {
          user: { select: { id: true, pseudo: true, displayName: true } },
        },
      }),
    ]);

    const seen = new Set<string>();
    const members: PartieMember[] = [];
    // Un compte propriétaire orphelin (ligne `User` absente) est simplement omis.
    if (owner) {
      seen.add(owner.userId);
      members.push(owner);
    }
    for (const m of memberships) {
      if (seen.has(m.user.id)) continue;
      seen.add(m.user.id);
      members.push({ userId: m.user.id, pseudo: m.user.pseudo, displayName: m.user.displayName });
    }
    return members;
  }

  /** Identité (pseudo + nom affiché) du propriétaire d'une partie, `null` si elle n'en a pas
   *  (AD-5) ou si son compte est absent. Sert aux projections « auteur » (annonces), jamais à
   *  décider d'un droit. */
  async ownerOf(partie: Pick<Partie, 'ownerId'>): Promise<PartieMember | null> {
    if (partie.ownerId === null) return null;
    const owner = await this.prisma.user.findUnique({
      where: { id: partie.ownerId },
      select: { id: true, pseudo: true, displayName: true },
    });
    if (!owner) return null;
    return { userId: owner.id, pseudo: owner.pseudo, displayName: owner.displayName };
  }

  /** Résout la partie de la cible (et ce qu'elle désigne), 404 avec le message historique de la
   *  cible si elle n'existe pas. */
  private async resolveTarget(target: PermissionTarget): Promise<{
    partie: Partie;
    resolved: ResolvedTarget;
    /** Propriétaire (hôte) de l'événement visé — lu pour les seules règles « hôte » de `assert()`. */
    eventOwnerId?: string | null;
  }> {
    if (target.partieId !== undefined) {
      const partie = await this.prisma.partie.findUnique({ where: { id: target.partieId } });
      if (!partie) throw new NotFoundException('Partie introuvable');
      return { partie, resolved: { partieId: partie.id } };
    }
    if (target.eventId !== undefined) {
      const event = await this.prisma.event.findUnique({
        where: { id: target.eventId },
        include: { partie: true },
      });
      // Message historique : dans le JDR, un événement est toujours un scénario.
      if (!event) throw new NotFoundException('Scénario introuvable');
      return {
        partie: event.partie,
        resolved: { partieId: event.partie.id, eventId: event.id },
        eventOwnerId: event.ownerId,
      };
    }
    if (target.characterId !== undefined) {
      const character = await this.prisma.character.findUnique({
        where: { id: target.characterId },
        include: { partie: true },
      });
      if (!character) throw new NotFoundException('Personnage introuvable');
      return {
        partie: character.partie,
        resolved: { partieId: character.partie.id, characterId: character.id },
      };
    }
    if (target.invitationId !== undefined) {
      const invitation = await this.prisma.invitation.findUnique({
        where: { id: target.invitationId },
        include: { partie: true },
      });
      if (!invitation) throw new NotFoundException('Invitation introuvable');
      return {
        partie: invitation.partie,
        resolved: { partieId: invitation.partie.id, invitationId: invitation.id },
      };
    }
    if (target.inviteLinkId !== undefined) {
      const link = await this.prisma.inviteLink.findUnique({
        where: { id: target.inviteLinkId },
        include: { partie: true },
      });
      if (!link) throw new NotFoundException('Lien introuvable');
      return {
        partie: link.partie,
        resolved: { partieId: link.partie.id, inviteLinkId: link.id },
      };
    }
    if (target.announcementId !== undefined) {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: target.announcementId },
        include: { partie: true },
      });
      if (!announcement) throw new NotFoundException('Annonce introuvable');
      return {
        partie: announcement.partie,
        resolved: { partieId: announcement.partie.id, announcementId: announcement.id },
      };
    }
    const seance = await this.prisma.seance.findUnique({
      where: { id: target.seanceId },
      include: { event: { include: { partie: true } } },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    return {
      partie: seance.event.partie,
      resolved: { partieId: seance.event.partie.id, eventId: seance.event.id, seanceId: seance.id },
      eventOwnerId: seance.event.ownerId,
    };
  }

  /** Rôle de `userId` sur une partie déjà lue. Famille `jdr` : la table `Membership` n'est
   *  consultée que si l'utilisateur n'est pas le propriétaire. Famille `ralliement` : le rôle vient
   *  de la ligne `Membership`, toujours lue. */
  private async roleIn(partie: Partie, userId: string): Promise<PartieRole | null> {
    if (familyOf(partie.gameSystemId) !== 'ralliement') {
      const asOwner = jdrRole(partie.ownerId, userId, false);
      if (asOwner) return asOwner;
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId_partieId: { userId, partieId: partie.id } },
      select: { role: true },
    });
    return roleFor(partie, userId, membership);
  }
}
