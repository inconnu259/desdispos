/**
 * Types partagés entre l'API (NestJS) et le front (Angular).
 * Import type-only côté apps → effacé à la compilation, aucun coût runtime.
 */

/** Thèmes disponibles — liste déclarée une seule fois (AD-13), la validation API s'y réfère
 *  directement (`@IsIn(THEMES)`), jamais une seconde liste côté serveur. */
export const THEMES = ['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'] as const;

export type Theme = (typeof THEMES)[number];

/** Critères de tri de la liste des parties (FR-10, AD-1, Story 29.8) — union fermée, validée
 *  côté serveur via `@IsIn(PARTIE_SORTS)`, jamais une chaîne libre. */
export const PARTIE_SORTS = ['urgence', 'date', 'nom', 'type', 'statut'] as const;

export type PartieSort = (typeof PARTIE_SORTS)[number];

/** Modes de densité d'affichage des listes (FR-45, AD-1, Story 29.9) — union fermée **partagée**
 *  entre la liste des parties et la vue « mes personnages » (CAP-18 : « une seule grammaire »),
 *  chacune gardant sa propre valeur mémorisée (`partiesViewMode`/`charactersViewMode`). Littéral
 *  `"medium"` (pas `'moyen'`) : doit rester synchronisé avec le défaut Prisma du Structural Seed. */
export const LIST_VIEW_MODES = ['large', 'medium', 'compact'] as const;

export type ListViewMode = (typeof LIST_VIEW_MODES)[number];

/** Critères de tri de la vue « mes personnages » (FR-45, AD-1, Story 29.9) — union fermée
 *  distincte de `PARTIE_SORTS` (AD-1 : « niveau, partie, nom pour les personnages »), pas de
 *  vocabulaire partagé au-delà de `'nom'`, présent dans les deux unions. */
export const CHARACTER_SORTS = ['niveau', 'partie', 'nom'] as const;

export type CharacterSort = (typeof CHARACTER_SORTS)[number];

/** Couches d'affichage du calendrier (FR-46, AD-16, Story 30.4) — union fermée, validée côté
 *  serveur via `@IsIn(CALENDAR_LAYER_KEYS, { each: true })`, jamais une chaîne libre. La couche
 *  `disponibilite-groupe` n'a de sens que dans le calendrier d'une partie — c'est la **lecture**
 *  qui l'ignore hors contexte (Story 30.6), pas le stockage/le défaut qui la refuse (AD-16). */
export const CALENDAR_LAYER_KEYS = [
  'mes-indisponibilites',
  'mes-disponibilites',
  'mes-seances',
  'votes-en-cours',
  'inscriptions-ouvertes',
  'disponibilite-groupe',
] as const;

export type CalendarLayerKey = (typeof CALENDAR_LAYER_KEYS)[number];

/** Jeu de couches actives par défaut pour un compte qui n'a jamais réglé cette préférence
 *  (`calendarLayersSetAt === null`, AD-16) — toutes actives, y compris `disponibilite-groupe`. */
export const DEFAULT_CALENDAR_LAYER_KEYS: CalendarLayerKey[] = [...CALENDAR_LAYER_KEYS];

/** Utilisateur authentifié (renvoyé par /auth/login, /auth/me). Jamais le hash. */
export interface AuthUser {
  id: string;
  email: string;
  pseudo: string;
  /** Nom affiché aux autres utilisateurs. Initialisé au pseudo, librement modifiable, sans contrainte d'unicité (AD-1). */
  displayName: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  /** Thème choisi sur le compte. `null` = jamais choisi — le thème local est alors adopté une
   *  seule fois et poussé vers le compte (AD-13). Toujours présent, jamais `undefined`. */
  theme: Theme | null;
  /** Préférence « masquer les parties terminées » (FR-3, AD-1, Story 29.8) — appliquée côté front
   *  à la liste déjà chargée, jamais par un filtre serveur. */
  hideFinishedParties: boolean;
  /** Critère de tri mémorisé de la liste des parties (FR-10, AD-1, Story 29.8). */
  partiesSort: PartieSort;
  /** Mode d'affichage mémorisé de la liste des parties (FR-45, AD-1, Story 29.9). */
  partiesViewMode: ListViewMode;
  /** Mode d'affichage mémorisé de la vue « mes personnages » (FR-45, AD-1, Story 29.9). */
  charactersViewMode: ListViewMode;
  /** Critère de tri mémorisé de la vue « mes personnages » (FR-45, AD-1, Story 29.9). */
  charactersSort: CharacterSort;
  /** Couches actives du calendrier (FR-46, AD-16, Story 30.4) — toujours résolu côté serveur,
   *  jamais `undefined` : si le compte n'a jamais réglé cette préférence, porte
   *  `DEFAULT_CALENDAR_LAYER_KEYS` ; si réglé (y compris à vide), porte exactement ce qui a été
   *  enregistré. Contrairement à `theme`, aucun sentinel `null` n'est exposé au client — la
   *  distinction « jamais réglé » / « tout éteint » est résolue en interne (AD-16). */
  defaultCalendarLayers: CalendarLayerKey[];
}

/** Un groupe (ou une rencontre isolée) que l'effacement du compte supprimerait : son utilisateur en est le
 *  SEUL administrateur (Story 43.1, AD-11). */
export interface DeletionImpactGroupDto {
  id: string;
  name: string;
  /** Adhésions du groupe, administrateur compris. */
  memberCount: number;
  /** Événements du groupe (les conjonctions). */
  eventCount: number;
}

/** Une partie de JDR que l'effacement du compte supprimerait : son utilisateur en est le MJ. */
export interface DeletionImpactJdrPartieDto {
  id: string;
  name: string;
  /** Joueurs (hors MJ) qui y perdraient leurs personnages. */
  playerCount: number;
}

/** Réponse de GET /me/deletion-impact — ce que l'effacement du compte emporterait (Story 43.1). */
export interface AccountDeletionImpactDto {
  groups: DeletionImpactGroupDto[];
  jdrParties: DeletionImpactJdrPartieDto[];
}

/** Corps de la requête PATCH /me/display-name. */
export interface UpdateDisplayNameDto {
  displayName: string;
}

/** Réponse de l'endpoint GET /health de l'API. */
export interface HealthStatus {
  /** État global de l'API. */
  status: 'ok' | 'error';
  /** État de la connexion à la base de données. */
  db: 'up' | 'down';
  /** Horodatage ISO 8601 de la vérification. */
  timestamp: string;
}

/** Type d'une partie. En 1b l'UI n'expose que ONE_SHOT + CAMPAGNE_LINEAIRE (libellé « Campagne »). */
export type PartieKind = 'ONE_SHOT' | 'CAMPAGNE_LINEAIRE' | 'CAMPAGNE_EPISODIQUE';

/** Famille d'un système de jeu (Story 37.5, AD-2) : `jdr` pour les jeux de rôle, `ralliement`
 *  pour les soirées entre amis (épic 38). Gouverne la politique de droits et les transitions
 *  autorisées (changement de système, conversion de type). */
export type GameSystemFamily = 'jdr' | 'ralliement';

/** Capacités qu'un système peut déclarer (Story 37.5) — à terme (Story 37.7), chaque
 *  fonctionnalité de couche 3 (JDR) sera conditionnée à l'une d'elles, plus à un identifiant de
 *  système en dur. */
export type GameSystemCapability =
  | 'characters'
  | 'scenarioLifecycle'
  | 'xp'
  | 'hommeDragon'
  | 'groupRoles'
  | 'announcements'
  | 'linearCampaign';

/** Forme d'une entrée du registre `GAME_SYSTEMS`. */
export interface GameSystemEntry {
  id: string;
  name: string;
  family: GameSystemFamily;
  capabilities: readonly GameSystemCapability[];
  kinds: readonly PartieKind[];
  /** Le système peut-il être choisi à la création d'une partie (ou par un changement de
   *  système) ? */
  openForCreation: boolean;
  /** Badge rond du système dans la liste des parties (Story 38.5) : `R1` (Ryuutama), `L1`
   *  (ralliement) ; absent ou `null` = pas de badge, la seule pastille texte suffit. */
  badge?: GameSystemBadge | null;
}

/** Glyphes de badge de système (maquettes `badge-R1-…` et `badge-L1-…`). */
export type GameSystemBadge = 'R1' | 'L1';

const JDR_KINDS = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'] as const;

/** Registre UNIQUE des systèmes de jeu (Story 37.5, AD-2) : famille, capacités, types de partie
 *  admis et ouverture à la création. Remplace l'ancien drapeau `module` (Story 29.15/29.17), qui
 *  confondait « a des personnages jouables » et « peut être choisi à la création ». Toujours lu via
 *  les lecteurs `familyOf()`, `hasCapability()`, `kindsOf()`, `isOpenForCreation()` ci-dessous,
 *  jamais champ par champ. Consommé par le web (bouton de création de personnage, onglet par
 *  défaut, tooltip du slot roster, liste proposée par `PartieForm`, libellés) et par l'API
 *  (`PartiesService.create()`/`update()`/`convertKind()`, `CharacterService.create()`, signal
 *  `PERSONNAGE_A_CREER` de `party-signals.service.ts`, validateurs DTO « id connu »).
 *
 *  `ralliement` est ouvert à la création depuis la Story 38.2 ; il n'a pas de ligne en table
 *  `GameSystem`. Importer en VALEUR (jamais `import type`). */
export const GAME_SYSTEMS = [
  {
    id: 'draconis',
    name: 'Draconis',
    family: 'jdr',
    capabilities: [],
    kinds: JDR_KINDS,
    openForCreation: false,
  },
  {
    id: 'conte-de-minuit',
    name: 'Conte de Minuit',
    family: 'jdr',
    capabilities: [],
    kinds: JDR_KINDS,
    openForCreation: false,
  },
  {
    id: 'ryuutama',
    name: 'Ryuutama',
    family: 'jdr',
    capabilities: [
      'characters',
      'scenarioLifecycle',
      'xp',
      'hommeDragon',
      'groupRoles',
      'announcements',
      'linearCampaign',
    ],
    kinds: JDR_KINDS,
    openForCreation: true,
    badge: 'R1',
  },
  {
    id: 'esteren',
    name: 'Esteren',
    family: 'jdr',
    capabilities: [],
    kinds: JDR_KINDS,
    openForCreation: false,
  },
  {
    id: 'ralliement',
    name: 'Ralliement',
    family: 'ralliement',
    capabilities: [],
    kinds: ['ONE_SHOT', 'CAMPAGNE_EPISODIQUE'],
    openForCreation: true,
    badge: 'L1',
  },
] as const satisfies readonly GameSystemEntry[];

export type GameSystemId = (typeof GAME_SYSTEMS)[number]['id'];

/** Entrée du registre pour un `id`, ou `undefined` si inconnu. */
function findGameSystem(id: string): GameSystemEntry | undefined {
  return (GAME_SYSTEMS as readonly GameSystemEntry[]).find((g) => g.id === id);
}

/** Famille d'un système. Tolère un `id` inconnu (jamais d'exception) → `null`. */
export function familyOf(id: string): GameSystemFamily | null {
  return findGameSystem(id)?.family ?? null;
}

/** Le système déclare-t-il cette capacité ? `id` inconnu → `false`. */
export function hasCapability(id: string, capability: GameSystemCapability): boolean {
  return findGameSystem(id)?.capabilities.includes(capability) ?? false;
}

/** Types de partie admis par le système. `id` inconnu → `[]`. */
export function kindsOf(id: string): readonly PartieKind[] {
  return findGameSystem(id)?.kinds ?? [];
}

/** Le système peut-il être choisi à la création d'une partie ou par un changement de système ?
 *  `id` inconnu → `false`. */
export function isOpenForCreation(id: string): boolean {
  return findGameSystem(id)?.openForCreation ?? false;
}

/** Glyphe de badge du système (Story 38.5), ou `null` s'il n'en a pas. `id` inconnu → `null`,
 *  jamais d'exception. */
export function badgeOf(id: string): GameSystemBadge | null {
  return findGameSystem(id)?.badge ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Droits sur une partie (Story 37.6, AD-6)
//
// Toute décision de droit sur une partie, ses événements et ses séances passe par
// `PermissionService.assert(userId, action, cible)` côté API. Les actions forment une union
// FERMÉE : en ajouter une oblige à compléter la table de politique de chaque famille (le
// compilateur refuse une table incomplète).
// ─────────────────────────────────────────────────────────────────────────────

/** Rôle d'un utilisateur sur une partie. Famille `jdr` : `mj` (propriétaire) ou `player`
 *  (membre). Famille `ralliement` (Story 38.2) : `admin` ou `member`, dérivé de
 *  `Membership.role` uniquement. Un propriétaire nul (compte supprimé, AD-5) ne donne jamais
 *  `mj`. */
export type PartieRole = 'mj' | 'player' | 'admin' | 'member';

/** Rôle d'un membre d'une partie (colonne `Membership.role`, Story 38.2) — union FERMÉE. Le
 *  créateur d'un ralliement est inséré `ADMIN` ; tout autre membre est `MEMBER`. */
export type MembershipRole = 'ADMIN' | 'MEMBER';

/** Action soumise à un droit sur une partie (Story 37.6) — union fermée, `SCREAMING_SNAKE`. */
export type PermissionAction =
  // Partie
  | 'PARTIE_READ'
  | 'PARTIE_UPDATE'
  | 'PARTIE_CONVERT_KIND'
  | 'PARTIE_CLOSE'
  | 'PARTIE_REOPEN'
  | 'PARTIE_DELETE'
  | 'PARTIE_MEMBERS_READ'
  | 'PARTIE_MEMBER_REMOVE'
  | 'PARTIE_MEMBER_ROLE_SET'
  // Story 39.5 : quitter soi-même une partie (groupe de ralliement seulement)
  | 'PARTIE_LEAVE'
  | 'PARTIE_AVAILABILITY_READ'
  // Story 46.4 : masquer / démasquer une fenêtre de l'automate (MJ d'un JDR seul)
  | 'SLOT_WINDOW_HIDE'
  | 'PARTIE_VISIBILITY_LOCKS_READ'
  | 'PARTIE_VISIBILITY_LOCKS_UPDATE'
  | 'PARTIE_COVER_READ'
  | 'PARTIE_COVER_UPDATE'
  // Fiches de référence du système (Story 37.7) : lecture par tout participant / par le MJ seul
  | 'PARTIE_REFERENCE_ASSET_READ'
  | 'PARTIE_REFERENCE_ASSET_MJ_READ'
  // Scénario (extension JDR de l'événement)
  | 'SCENARIO_CREATE'
  | 'SCENARIO_UPDATE'
  | 'SCENARIO_STATUS_CHANGE'
  | 'SCENARIO_READ'
  | 'SCENARIO_DRAFTS_READ'
  | 'SCENARIO_DOCUMENT_UPLOAD'
  | 'SCENARIO_DOCUMENTS_READ'
  | 'SCENARIO_PARTICIPATE'
  // Séance
  | 'SEANCE_ADD'
  | 'SEANCE_DELETE'
  | 'SEANCE_DATE_RESET'
  | 'SEANCE_CAPACITY_SET'
  | 'SEANCE_COMPTE_RENDU_SET'
  | 'SEANCE_PRACTICAL_INFO_SET'
  | 'SEANCE_POLL_CREATE'
  | 'SEANCE_INSCRIBE'
  | 'SEANCE_UNSUBSCRIBE'
  // Story 40.4 : réserver une place à un membre / retirer une réservation — l'hôte seul (règle
  // décidée dans `PermissionService`), groupe de ralliement seulement.
  | 'SEANCE_RESERVE'
  // Vote de date
  | 'POLL_READ'
  | 'POLL_VOTE'
  | 'POLL_CHOOSE'
  // Story 40.7 : prolonger le vote d'une conjonction — l'hôte seul (règle décidée dans `PermissionService`),
  // groupe de ralliement seulement ; absente du JDR (son échéance par défaut reste de 14 jours).
  | 'POLL_EXTEND'
  | 'POLL_OPTIONS_SET'
  | 'POLL_CLOSE'
  // Capacités JDR (Story 37.7, couche 3) : les actions d'ÉCRITURE sont aussi conditionnées à une
  // capacité du système de la partie par la table action → capacité de `permissions/`
  // (`characters`, `xp`, `hommeDragon`, `groupRoles`, `announcements`).
  // Personnage
  | 'CHARACTER_CREATE'
  | 'CHARACTER_LIST'
  | 'CHARACTER_READ'
  | 'CHARACTER_PORTRAIT_READ'
  | 'CHARACTER_NOTES_READ'
  | 'CHARACTER_XP_SET'
  | 'CHARACTER_SHEET_FIELD_SET'
  | 'CHARACTER_HISTORY_READ'
  // Distribution d'XP
  | 'XP_DISTRIBUTION_CREATE'
  | 'XP_DISTRIBUTION_READ'
  // Homme Dragon
  | 'HOMME_DRAGON_MANAGE'
  | 'HOMME_DRAGON_READ'
  | 'HOMME_DRAGON_UNLINK'
  // Rôles de groupe
  | 'GROUP_ROLE_ASSIGN'
  | 'GROUP_ROLE_UNASSIGN'
  | 'GROUP_ROLE_READ'
  // Annonces
  | 'ANNOUNCEMENT_CREATE'
  | 'ANNOUNCEMENT_READ'
  | 'ANNOUNCEMENT_MARK_READ'
  // Événements d'un groupe de ralliement (Story 40.1) : proposer une conjonction, lister celles du
  // groupe. Couche 2, aucune capacité requise ; fermées à tous en JDR (le JDR passe par ses scénarios).
  | 'EVENT_CREATE'
  | 'EVENT_LIST'
  // Story 40.2 : modifier une conjonction — son hôte seul (règle décidée dans `PermissionService`).
  | 'EVENT_UPDATE'
  // Story 42.1 : annuler une conjonction — son hôte OU un administrateur du groupe (règle décidée dans
  // `PermissionService`). Fermée à tous en JDR.
  | 'EVENT_CANCEL'
  // Story 49.2 : apporter un de ses jeux à une soirée — tout membre d'un groupe de ralliement ; la condition
  // « participant, autre que l'hôte » est décidée par `events/`. Fermée à tous en JDR.
  | 'EVENT_GAME_BRING'
  // Story 49.4 : écarter un des jeux de l'hôte pour une soirée — l'hôte de l'événement seul (règle décidée
  // dans `PermissionService`) ; la condition « soirée ouverte, jeu à l'hôte » est décidée par `events/`.
  // Fermée à tous en JDR.
  | 'EVENT_GAME_EXCLUDE'
  // Story 49.5 : signaler une Envie de jouer à un jeu — tout membre d'un groupe de ralliement ; la condition
  // « participant de la soirée, nom de jeu sur place » est décidée par `events/`. Fermée à tous en JDR.
  | 'EVENT_GAME_ENVY'
  // Invitations et liens d'invitation (couche 2, aucune capacité requise)
  | 'INVITATION_CREATE'
  | 'INVITATION_READ'
  | 'INVITATION_REVOKE'
  | 'INVITE_LINK_CREATE'
  | 'INVITE_LINK_READ'
  | 'INVITE_LINK_REVOKE';

/** Statut d'une partie — dérivé côté serveur à partir de `Partie.closedAt` et de la présence de
 *  scénarios (AD-8), jamais recalculé côté client (Story 29.6). */
export type PartieStatus = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';

/** Avancement d'une partie, lu en lot par `events/` : aucun événement, au moins un événement qui compte,
 *  rencontre isolée dont la plage est passée, ou annulée (Story 44.2). */
export type PartieProgress = 'none' | 'started' | 'ended' | 'cancelled';

/**
 * LE statut d'une partie (Story 44.2, AD-15) — la seule dérivation, lue par `PartieDto` et par les sondages
 * ouverts. Annulée l'emporte sur terminée (clôture ou date passée), distincte d'elle ; `closedAt` renseigné
 * (ou rencontre passée) vaut terminée ; sinon un avancement démarré vaut en cours.
 */
export function partieStatus(closedAt: Date | string | null, progress: PartieProgress): PartieStatus {
  if (progress === 'cancelled') return 'ANNULEE';
  if (closedAt || progress === 'ended') return 'TERMINEE';
  return progress === 'started' ? 'EN_COURS' : 'A_VENIR';
}

/** Une partie « active » : ni terminée, ni annulée. La seule définition (Story 44.2). */
export function isPartieActive(status: PartieStatus): boolean {
  return status === 'A_VENIR' || status === 'EN_COURS';
}

/**
 * Un rendez-vous (séance) « à dater » (Story 45.1, AR3) : sans date, sans sondage (ouvert ou clos — un vote
 * fermé sans date n'en est plus un), événement non annulé, partie active, et la personne peut proposer des
 * dates. LA définition, lue par les trois calendriers et par `GET /me/datable-seances`.
 * `frozen` = la partie n'est plus active ; `canOrganize` = `can.propose`.
 */
export function isDatableSeance(seance: {
  hasDate: boolean;
  hasPoll: boolean;
  cancelled: boolean;
  frozen: boolean;
  canOrganize: boolean;
}): boolean {
  return (
    !seance.hasDate &&
    !seance.hasPoll &&
    !seance.cancelled &&
    !seance.frozen &&
    seance.canOrganize
  );
}

/**
 * Un rendez-vous (séance) « composable » (Story 46.3, AR3) : celui sur lequel le composer peut s'armer — soit « à dater »
 * (`isDatableSeance`), soit porteur d'un sondage OUVERT que la personne peut modifier (le composer part alors de ses
 * créneaux). Ni annulé ni figé dans les deux cas. LA définition, lue par le choix du rendez-vous quand une fenêtre de
 * l'automate est ajoutée au vote. `canPropose` = `can.propose`, `canEdit` = `can.edit`.
 */
export function isComposableSeance(seance: {
  hasDate: boolean;
  hasPoll: boolean;
  hasOpenPoll: boolean;
  cancelled: boolean;
  frozen: boolean;
  canPropose: boolean;
  canEdit: boolean;
}): boolean {
  if (
    isDatableSeance({
      hasDate: seance.hasDate,
      hasPoll: seance.hasPoll,
      cancelled: seance.cancelled,
      frozen: seance.frozen,
      canOrganize: seance.canPropose,
    })
  ) {
    return true;
  }
  return seance.hasOpenPoll && !seance.cancelled && !seance.frozen && seance.canEdit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion du type d'une partie (Story 29.14)
//
// POINT DE DÉRIVATION UNIQUE de la matrice de conversion. Le serveur (garde de
// `PartiesService.convertKind()`) et le formulaire d'édition consomment tous deux
// `checkPartieKindTransition()` — il n'existe pas deux tables de règles, qui
// divergeraient (Règle B de la story, esprit d'AD-17).
//
// Le `kind` gouverne des invariants dans quatre services :
//   - ONE_SHOT              : exactement un scénario, créé avec la partie (AD-7)
//   - CAMPAGNE_LINEAIRE     : au plus un scénario COURANT à la fois (AD-10)
//   - CAMPAGNE_EPISODIQUE   : participation individuelle + inscriptions à capacité
// Jusqu'à cette story, `update()` écrivait `kind` sans aucune vérification.
// ─────────────────────────────────────────────────────────────────────────────

/** État de la partie au moment où une conversion est évaluée. Lu par le serveur dans la
 *  transaction ; reconstitué côté client depuis la liste des scénarios de la partie. */
export interface PartieKindTransitionState {
  scenarioCount: number;
  /** Nombre de scénarios au statut `COURANT`. */
  courantCount: number;
  /** `Partie.closedAt !== null`. */
  isClosed: boolean;
}

/** Motifs de refus — union fermée. Le serveur renvoie un code, jamais une phrase : le libellé
 *  est thématisable côté client, et un code se teste sans dépendre d'une formulation. */
export type PartieKindTransitionRefusal =
  /** Règle C : une partie clôturée se rouvre avant d'être convertie. */
  | 'PARTIE_CLOSED'
  /** Cas 3 et 5 : un one-shot n'a qu'un scénario (AD-7), on ne sait pas lequel garder. */
  | 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT';

/** Effets à appliquer dans la transaction de conversion, en plus de l'écriture du `kind`. */
export type PartieKindTransitionEffect =
  /** Cas 3 et 5 à zéro scénario : en créer un (+ sa séance), comme le fait `PartiesService.create()`
   *  pour un ONE_SHOT. Sans cela la partie serait définitivement coincée sans scénario —
   *  `ScenariosService.create()` refuse d'en créer un sur un ONE_SHOT. */
  | 'CREATE_SCENARIO'
  /** Cas 2 et 4 : inscrire les membres actuels comme participants de chaque scénario existant.
   *  Ce n'est pas une invention : hors épisodique, le code tient déjà pour vrai que « tous les
   *  membres actuels sont réputés participer » (`homme-dragon.service.ts`). Sans ce semis, la
   *  conversion viderait les notes de rétrospective et ferait refuser les associations de journal. */
  | 'SEED_PARTICIPANTS'
  /** Cas 6 avec plusieurs COURANT : rétrograder en `A_VENIR` tous ceux que le MJ n'a pas retenus.
   *  Séances, votes et dates sont conservés (Règle A — rien n'est jamais effacé). */
  | 'DEMOTE_EXTRA_COURANTS';

export type PartieKindTransitionVerdict =
  | { allowed: false; refusal: PartieKindTransitionRefusal }
  | {
      allowed: true;
      effects: PartieKindTransitionEffect[];
      /** Vrai quand `DEMOTE_EXTRA_COURANTS` s'applique : le MJ doit désigner le scénario qui reste
       *  Courant. Le serveur exige alors `courantScenarioId`. */
      requiresCourantChoice: boolean;
    };

/**
 * Évalue une conversion de type de partie. Fonction **pure** : aucune dépendance à Prisma,
 * Nest ou Angular, testable isolément.
 *
 * Une transition identité (`from === to`) est toujours autorisée et sans effet — le formulaire
 * renvoie systématiquement `kind`, y compris inchangé.
 */
export function checkPartieKindTransition(
  from: PartieKind,
  to: PartieKind,
  state: PartieKindTransitionState,
): PartieKindTransitionVerdict {
  if (from === to) {
    return { allowed: true, effects: [], requiresCourantChoice: false };
  }

  // Règle C — évaluée avant tout le reste : une partie clôturée ne se convertit pas.
  if (state.isClosed) {
    return { allowed: false, refusal: 'PARTIE_CLOSED' };
  }

  const effects: PartieKindTransitionEffect[] = [];

  if (to === 'ONE_SHOT') {
    // Cas 3 et 5. À deux scénarios ou plus, aucune règle ne dit lequel survivrait : refus.
    if (state.scenarioCount >= 2) {
      return { allowed: false, refusal: 'TOO_MANY_SCENARIOS_FOR_ONE_SHOT' };
    }
    if (state.scenarioCount === 0) {
      effects.push('CREATE_SCENARIO');
    }
    return { allowed: true, effects, requiresCourantChoice: false };
  }

  if (to === 'CAMPAGNE_EPISODIQUE') {
    // Cas 2 et 4 — toujours autorisés, la réparation rend la conversion non destructive.
    return {
      allowed: true,
      effects: ['SEED_PARTICIPANTS'],
      requiresCourantChoice: false,
    };
  }

  // to === 'CAMPAGNE_LINEAIRE' — cas 1 et 6.
  // Le verrou « un seul COURANT » d'AD-10 ne s'applique qu'aux nouveaux passages en COURANT ; il
  // ne répare pas l'existant. Sans rétrogradation, l'invariant naîtrait déjà violé.
  const requiresCourantChoice = state.courantCount >= 2;
  if (requiresCourantChoice) {
    effects.push('DEMOTE_EXTRA_COURANTS');
  }
  return { allowed: true, effects, requiresCourantChoice };
}

/** Une partie telle que renvoyée par l'API. */
export interface PartieDto {
  id: string;
  name: string;
  kind: PartieKind;
  gameSystemId: string;
  description: string | null;
  /** Propriétaire de la partie (le MJ pour la famille `jdr`). `null` = compte propriétaire supprimé
   *  (AD-5) — inatteignable tant qu'aucun code ne supprime de compte, mais à traiter. */
  ownerId: string | null;
  /** Renseigné uniquement par `GET /parties/:id` (`findOneDto`) — jamais par `GET /parties`
   *  (`listForUser`, tableau de bord), qui reste volontairement hors du périmètre de l'homonymie
   *  (Story 28.3, Task 1). Toujours vérifier avant usage plutôt que supposer présent. */
  ownerPseudo?: string;
  ownerDisplayName?: string;
  createdAt: string;
  nextSessionDate: string | null;
  nextSessionSlot: DaySlot | null;
  /** Story 47.2 : fin de la plage de la prochaine séance (égale au début pour un créneau) ; absente = non servie. */
  nextSessionEndDate?: string | null;
  nextSessionEndSlot?: DaySlot | null;
  /** Rôle de l'appelant sur cette partie — calculé serveur (`ownerId === userId`), jamais dérivé
   *  côté client (Story 29.1, AD-15). Toujours présent, contrairement à `ownerPseudo`/`ownerDisplayName`. */
  role: PartieRole;
  /** Toujours présent, calculé serveur (AD-8) — jamais dérivé côté client (Story 29.6). */
  status: PartieStatus;
  /** Toujours présent, calculé serveur (Story 29.8) — jamais dérivé côté client. */
  isFavorite: boolean;
  /** Jeton de version de la couverture (Story 29.12, AD-19) — dérivé de `Partie.coverImageUrl`,
   *  change à chaque dépôt. Sert à la fois d'indicateur de présence (`null` = pas d'image, la
   *  bannière générée s'applique) et de paramètre de cache-busting pour
   *  `GET /parties/:id/cover` : jamais le chemin de stockage lui-même, qui n'apporte rien côté
   *  client (l'URL se construit depuis l'`id` de la partie, même patron que
   *  `CharacterAvatar.absolutePortraitUrl`). */
  coverImageVersion: string | null;
}

/** Code de signal d'état d'une partie (FR-12, AD-3) — union fermée, jamais un booléen libre ni
 *  une chaîne construite à la volée côté client (Story 29.7). */
export type PartySignalCode =
  | 'PERSONNAGE_A_CREER'
  | 'VOTE_EN_COURS_SANS_REPONSE'
  | 'COMPTE_RENDU_NON_REDIGE'
  | 'HOMME_DRAGON_A_CREER'
  | 'AUCUN_MEMBRE_INVITE'
  | 'AUCUN_SCENARIO_EN_COURS'
  | 'AUCUNE_DATE_NI_VOTE'
  | 'RAPPORT_FIN_MANQUANT'
  | 'PROCHAINE_SEANCE_CONNUE'
  | 'PARTIE_TERMINEE'
  // Story 42.2 : la rencontre isolée (statut ANNULEE) a été annulée par son hôte — seul signal qu'elle porte.
  | 'PARTIE_ANNULEE'
  // Story 40.4 : une place est réservée à l'utilisateur dans une conjonction à venir d'un groupe.
  | 'RESERVATION_A_CONFIRMER';

/** Réponse de `GET /me/party-signals` — une entrée par partie de l'utilisateur, jamais une entrée
 *  absente (`signals: []` si aucun signal actif). `role`/`status` sont dupliqués depuis `PartieDto`
 *  volontairement (AD-3) : l'écran de liste n'a besoin d'aucun autre appel. */
export interface PartySignalsDto {
  role: 'mj' | 'player';
  status: PartieStatus;
  signals: PartySignalCode[];
}

/** Statut d'une invitation in-app. */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

/** Résultat de recherche d'utilisateur (GET /users/search) — jamais le hash, jamais l'e-mail,
 *  jamais le nom affiché (AD-2 : seule exception à « pseudo et displayName toujours les deux »). */
export interface UserSearchResultDto {
  id: string;
  pseudo: string;
}

/** Un joueur d'une partie (GET /parties/:id/members). */
export interface PartieMemberDto {
  userId: string;
  pseudo: string;
  displayName: string;
  /** Rôle d'adhésion (Story 39.4) : `ADMIN` ou `MEMBER`. Une partie de la famille `jdr` renvoie
   *  toujours `MEMBER` — son pouvoir vient de `ownerId`, pas de ce rôle. */
  role: MembershipRole;
  /** Renseigné uniquement lorsque le demandeur est le MJ de la partie (AD-2) — omis pour tout autre membre. */
  email?: string;
  joinedAt: string;
}

/** Invitation reçue, telle qu'affichée au joueur (GET /invitations). */
export interface InvitationDto {
  id: string;
  partie: { id: string; name: string; gameSystemId: string };
  inviterPseudo: string;
  status: InvitationStatus;
  createdAt: string;
}

/** Lien d'invitation (vue MJ — GET /parties/:id/invite-links). */
export interface InviteLinkDto {
  id: string;
  token: string;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

/** Prévisualisation publique d'un lien (GET /invite-links/:token, sans session). */
export interface InviteLinkPreviewDto {
  partieName: string;
  gameSystemId: string;
  valid: boolean;
  /** Raison d'invalidité éventuelle (expiré / révoqué / quota atteint). */
  reason?: string;
}

// ─── Palier 4 (suite) : Scénarios ──────────────────────────────────────────────

/** Statut du cycle de vie anti-spoil d'un scénario (Story 7.1). */
export type ScenarioStatus = 'BROUILLON' | 'A_VENIR' | 'COURANT' | 'PASSE';

/** Un scénario tel que renvoyé par l'API — contenu toujours complet (anti-spoil = rendu frontend, AD-6). */
export interface ScenarioDto {
  id: string;
  partieId: string;
  title: string;
  description: string | null;
  status: ScenarioStatus;
  dureeHeures: number | null;
  dureeSeances: number | null;
  resumeFin: string | null;
  createdAt: string;
  closedAt: string | null;
  /** Séances du scénario (Story 8.2) — toujours un tableau, potentiellement vide, quel que soit le kind. */
  seances: SeanceDto[];
  /** Participants (CAMPAGNE_EPISODIQUE uniquement, Story 8.1) — toujours undefined pour ONE_SHOT/CAMPAGNE_LINEAIRE (AD-4). */
  participants?: { userId: string; pseudo: string; displayName: string }[];
  /** Notes de journal associées à la rétrospective (Story 8.6) — peuplé uniquement si `status === 'PASSE'`, sinon `undefined`. */
  retrospectiveNotes?: CharacterNoteDto[];
}

/** Une séance d'un scénario (Story 8.2) — `poll` peuplé si une date a été liée via linkSeancePoll. */
export interface SeanceDto {
  id: string;
  scenarioId: string;
  poll?: SessionPollDto;
  /** Inscription à capacité limitée (CAMPAGNE_EPISODIQUE uniquement, Story 8.3) — peuplé seulement si `inscriptionMax` est défini sur la Seance (AD-4 : jamais en même temps que `poll`). */
  inscription?: SeanceInscriptionDto;
  /**
   * Story 32.3 — date EFFECTIVE de la séance, **à la racine**, résolue côté serveur :
   * `poll.chosenDate` quand un vote a été scellé, sinon la colonne `Seance.dateValidee`.
   *
   * 🚨 **Pourquoi à la racine.** `dateValidee` ne vivait que dans le bloc `inscription`, lui-même
   * peuplé seulement si `inscriptionMax != null` : une séance datée **sans vote ni inscription**
   * (héritage `validerDate()`, campagne linéaire) n'exposait donc AUCUNE date exploitable, et son
   * état (« Programmée », « À débriefer », « Jouée ») n'était pas dérivable. Ajout purement
   * additif — `inscription.dateValidee` reste servi à l'identique, aucun site d'appel n'est touché.
   */
  dateValidee: string | null;
  /** Créneau de `dateValidee`. Renseigné seulement quand la date vient d'un vote scellé
   *  (`poll.chosenSlot`) : la colonne `Seance.dateValidee` n'a pas de créneau propre — même
   *  convention que `recalculateNextSession()`, qui pose `slot: null` dans ce cas. */
  slotValidee: DaySlot | null;
  /** Story 47.2 : fin de la plage de la séance, lue de `Seance.endDate/endSlot` (jamais de `poll.chosenDate`),
   *  même forme que `dateValidee` / `slotValidee` ; `null` tant que la séance n'a pas de date. */
  endDate: string | null;
  endSlot: DaySlot | null;
  compteRendu: string | null;
  /** Informations pratiques (Story 36.5, D-15 amendée le 2026-08-19) — trois champs
   *  facultatifs, séparés pour qu'on puisse en lâcher un quand la place manque.
   *  `heureRdv` est une ÉTIQUETTE `"HH:MM"`, jamais un instant : rien ne la parse, ne la
   *  compare ni ne la trie, et la chaîne de disponibilité reste au créneau de journée. */
  heureRdv: string | null;
  lieu: string | null;
  notePratique: string | null;
  createdAt: string;
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés (1 par défaut). */
  durationSlots: number;
  /** Story 44.1 : droits d'organisateur de la personne qui lit, sur cette séance (aucun écran du JDR
   *  ne les lit encore). */
  can: OrganizerCan;
}

/** État d'inscription à capacité limitée d'une Seance (Story 8.3). */
export interface SeanceInscriptionDto {
  min: number;
  max: number;
  inscrits: { userId: string; pseudo: string }[];
  dateValidee: string | null;
}

/** Payload de rédaction du compte-rendu d'une Seance (PATCH /scenarios/seances/:id/compte-rendu). */
export interface SetCompteRenduDto {
  compteRendu: string;
}

/** Payload des informations pratiques d'une Seance (PATCH /scenarios/seances/:id/infos-pratiques,
 *  Story 36.5). Un seul payload pour les trois champs : le MJ les saisit ensemble, et une écriture
 *  partielle compliquerait la remise à vide. `null` VIDE le champ — le distinguer de `undefined`
 *  n'aurait pas de sens ici, les trois étant toujours envoyés ensemble. */
export interface SetInfosPratiquesDto {
  heureRdv: string | null;
  lieu: string | null;
  notePratique: string | null;
  /** Story 47.1 : nouvelle durée du rendez-vous, en créneaux (1 à 45) ; absente = inchangée. */
  durationSlots?: number;
}

/** Payload d'ajout d'une séance (POST /scenarios/:id/seances, Story 47.1). Durée absente = 1 créneau. */
export interface AddSeanceDto {
  durationSlots?: number;
}

/** Payload de définition de la capacité d'une Seance (PATCH /scenarios/seances/:id/capacite). */
export interface SetSeanceCapacityDto {
  inscriptionMin: number;
  inscriptionMax: number;
}

/** Payload de rédaction du résumé de fin d'un Scenario (PATCH /scenarios/:id/resume-fin). */
export interface SetResumeFinDto {
  resumeFin: string;
}

/** Payload de création + liaison d'un SessionPoll pour une Seance (POST /scenarios/seances/:id/poll,
 * Story 8.7) — remplace LinkSeancePollDto : plus de round-trip créer-puis-lier séparé, un seul
 * appel crée le vote (PollService.create() appelé tel quel, CreatePollDto inchangé) ET pose
 * Seance.pollId. */
export interface CreateSeancePollDto {
  options: { date: string; slot: DaySlot }[];
  /** Story 45.4 — fin du vote, un jour `YYYY-MM-DD` (fin de ce jour, UTC). Absent : `defaultPollDeadline`. */
  expiresAt?: string;
  /** Story 47.4 : durée du rendez-vous, en créneaux (1 à 45), écrite avec le vote dans la même transaction ;
   *  absente = inchangée. Un créneau `FULL_DAY` n'existe qu'à 1. */
  durationSlots?: number;
}

/** Payload de création d'un scénario (POST /parties/:id/scenarios). */
export interface CreateScenarioDto {
  title: string;
  description?: string;
  dureeHeures?: number;
  dureeSeances?: number;
}

/** Un document de scénario ou de bibliothèque de Partie (Story 7.2) — `scenarioId: null` = bibliothèque. */
export interface ScenarioDocumentDto {
  id: string;
  partieId: string;
  scenarioId: string | null;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
}

/** Payload d'édition d'un scénario (PATCH /scenarios/:id). */
export interface UpdateScenarioDto {
  title?: string;
  description?: string;
  dureeHeures?: number;
  dureeSeances?: number;
}

// ─── Epic 40 : conjonctions d'un groupe de ralliement ─────────────────────────

/** Créneau d'une conjonction (Story 40.1) : toujours un créneau de journée précis — jamais
 *  `FULL_DAY`, jamais vide. */
export type EventSlot = Exclude<DaySlot, 'FULL_DAY'>;

/** Statut d'une inscription (colonne `Inscription.status`, Story 40.4) — union FERMÉE. `RESERVED` :
 *  place réservée par l'hôte, pas encore acceptée (elle compte dans la capacité et n'expire jamais) ;
 *  `CONFIRMED` : inscription confirmée (défaut — toutes les lignes du JDR). */
export type InscriptionStatus = 'RESERVED' | 'CONFIRMED';

/** Un créneau candidat d'un sondage de dates de conjonction (Story 40.5) : un jour (`YYYY-MM-DD`) et
 *  un créneau précis. */
export interface EventPollOptionInput {
  date: string;
  slot: EventSlot;
}

/** Payload de création d'une conjonction à date fixée (POST /parties/:id/events, Story 40.1).
 *  `date` est une clé `YYYY-MM-DD` (aujourd'hui accepté, jamais avant) ; `heureRdv` est une
 *  ÉTIQUETTE `"HH:MM"`, jamais un instant. `capacity` : `null` (ou absent) = « Tous les membres »,
 *  sinon N places, hôte compris (N ≥ 2, sans plafond). */
export interface CreateEventDto {
  title: string;
  /** Mode « date fixée » : jour et créneau. Absents (avec `pollOptions`) en mode « sondage de dates »
   *  (Story 40.5) — les deux modes sont exclusifs. */
  date?: string;
  slot?: EventSlot;
  /** Story 40.5, mode « sondage de dates » : créneaux candidats (au moins 2, distincts, jamais
   *  `FULL_DAY`, sans plafond métier). Exclusif avec `date`/`slot`. */
  pollOptions?: EventPollOptionInput[];
  /** Story 40.5 : fin du vote, clé `YYYY-MM-DD` (aujourd'hui accepté, jamais avant) ; obligatoire avec
   *  `pollOptions`. Le vote se termine à la fin de ce jour (UTC). */
  pollDeadline?: string;
  lieu?: string | null;
  heureRdv?: string | null;
  notePratique?: string | null;
  capacity?: number | null;
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés (1 à 45). Absente = 1 à la création,
   *  inchangée à la modification (même si celle-ci remplace les autres champs). */
  durationSlots?: number;
  /** Story 40.4 : membres à qui l'hôte réserve une place d'emblée (distincts, jamais l'hôte, places
   *  limitées seulement, au plus `capacity − 1`). Ignoré par la modification. */
  reservedUserIds?: string[];
}

/** Payload de prolongation du vote d'une conjonction (PATCH /parties/:id/poll/:pollId/extend, Story 40.7) :
 *  `expiresAt` est la clé `YYYY-MM-DD` du NOUVEAU jour d'échéance (le vote se termine à la fin de ce jour,
 *  UTC) ; strictement après le jour d'échéance actuel, jamais avant aujourd'hui. */
export interface ExtendPollDto {
  expiresAt: string;
}

/** Payload de réservation d'une place (POST /scenarios/seances/:id/reservations, Story 40.4). */
export interface ReservePlaceDto {
  userId: string;
}

/** Payload de modification d'une conjonction (PATCH /parties/:id/events/:eventId, Story 40.2) :
 *  remplacement COMPLET, mêmes champs et mêmes règles que la création (l'hôte est immuable). */
export type UpdateEventDto = CreateEventDto;

/** La séance unique d'une conjonction, telle que projetée pour sa carte (Story 40.1). `date` est la
 *  clé `YYYY-MM-DD` du début de sa plage (`null` tant qu'elle n'est pas fixée) ; `capacity` `null` =
 *  « Tous les membres ». */
export interface EventCardSeanceDto {
  id: string;
  date: string | null;
  slot: DaySlot | null;
  lieu: string | null;
  heureRdv: string | null;
  notePratique: string | null;
  capacity: number | null;
  /** Story 47.2 : fin de la plage (clé `YYYY-MM-DD` et créneau), `null` tant que la séance n'a pas de date. */
  endDate: string | null;
  endSlot: DaySlot | null;
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés. */
  durationSlots: number;
  /** Story 40.4 : places prises = l'hôte + TOUTES les lignes d'inscription, `RESERVED` comprises —
   *  servi à tous pour que « Complet » et « libres » soient justes sans révéler qui tient une place
   *  en attente. */
  placesTaken: number;
}

/** Un participant d'une conjonction (Story 40.2) : l'hôte d'abord (`isHost`), puis les inscrits par
 *  ordre d'inscription. `isAdmin` = `Membership.role` du groupe (jamais un droit sur l'événement).
 *  Story 40.4 : `status` — une ligne `RESERVED` n'est servie qu'à l'hôte de la conjonction. */
export interface EventParticipantDto {
  userId: string;
  displayName: string;
  isHost: boolean;
  isAdmin: boolean;
  status: InscriptionStatus;
}

/** Un créneau candidat du sondage d'une conjonction, tel que servi aux membres (Story 40.5).
 *  `availableCount` : parmi les inscrits (hôte + inscriptions confirmées), combien sont libres sur ce
 *  créneau d'après leurs disponibilités déclarées — un nombre, jamais des noms. */
export interface EventPollOptionDto {
  id: string;
  date: string;
  slot: DaySlot;
  availableCount: number;
}

/** La réponse d'un votant éligible à un créneau (Story 40.5). */
export interface EventPollVoteDto {
  optionId: string;
  userId: string;
  answer: VoteAnswer;
}

/** Sondage de dates d'une conjonction (Story 40.5) — projection explicite, servie aux membres du
 *  groupe seuls. `eligibleVoterIds` : qui peut voter (tous les membres, ou l'hôte + les inscrits
 *  confirmés si les places sont limitées) ; le résumé du vote (réponses, meilleur créneau, « n'ont pas
 *  encore répondu ») est calculé à l'écran depuis cette liste et `votes`. `expiresAt` : fin du vote
 *  (instant ISO, fin du jour d'échéance en UTC). */
export interface EventPollDto {
  id: string;
  expiresAt: string | null;
  status: PollStatus;
  eligibleVoterIds: string[];
  /** Story 47.4 : durée du rendez-vous voté, en créneaux — chaque créneau candidat est le DÉPART d'une plage
   *  de cette durée. */
  durationSlots: number;
  options: EventPollOptionDto[];
  votes: EventPollVoteDto[];
}

/**
 * Droits d'organisateur d'un rendez-vous pour la personne qui lit (Story 44.1, AD-4) — calculés par le
 * serveur (`PermissionService`), jamais déduits à l'écran d'un `hostId` ou d'un rôle. Ils disent le DROIT,
 * pas l'état : un sondage clos ou une date fixée restent des conditions d'écran à part.
 * - `propose` : proposer des dates (créer un sondage) ;
 * - `edit` : modifier les dates d'un sondage ouvert ;
 * - `choose` : fixer la date ;
 * - `extend` : prolonger le vote (jamais en JDR, où l'on repousse l'échéance en modifiant le sondage).
 */
export interface OrganizerCan {
  propose: boolean;
  edit: boolean;
  choose: boolean;
  extend: boolean;
}

/** Carte d'une conjonction (GET /parties/:id/events/list, Story 40.1) — projection explicite :
 *  l'hôte (immuable, `null` si son compte a disparu), la séance unique et, depuis la Story 40.2, ses
 *  participants (hôte en premier, puis les inscrits). */
export interface EventCardDto {
  id: string;
  title: string;
  hostId: string | null;
  hostDisplayName: string | null;
  seance: EventCardSeanceDto | null;
  participants: EventParticipantDto[];
  /** Story 40.4 : la ligne d'inscription de la personne qui lit (`null` : aucune — l'hôte non plus). */
  myInscription: InscriptionStatus | null;
  /** Story 40.5 : le sondage de dates de la conjonction (`null` pour une conjonction à date fixée). */
  poll: EventPollDto | null;
  /** Story 42.1 : la conjonction est annulée (définitif) — plus aucune action, sondage clos. */
  cancelled: boolean;
  /** Story 44.1 : droits d'organisateur de la personne qui lit, sur cet événement. */
  can: OrganizerCan;
}

// ─── Epic 9 : Annonces MJ ──────────────────────────────────────────────────

/** Une annonce MJ à portée variable (Story 9.1) — `scenarioId: null` = portée Partie/campagne entière. */
export interface AnnouncementDto {
  id: string;
  partieId: string;
  scenarioId: string | null;
  text: string;
  createdAt: string;
  /** Identité du MJ auteur — dérivée de `Partie.ownerId`, jamais stockée sur l'annonce (AD-2, Story 28.2). */
  authorPseudo: string;
  authorDisplayName: string;
}

/** Payload de publication d'une annonce (POST /parties/:id/announcements). */
export interface CreateAnnouncementDto {
  text: string;
  scenarioId?: string;
}

/** Rôle de groupe assigné à un personnage (Story 27.2) — `roleKey` référence le catalogue
 *  `groupRole` (Story 27.1), jamais une FK stricte (même pattern que l'Homme Dragon). */
export interface CharacterGroupRoleDto {
  id: string;
  characterId: string;
  partieId: string;
  roleKey: string;
  assignedAt: string;
}

/** Payload d'assignation (POST /parties/:id/characters/:characterId/role). */
export interface AssignGroupRoleDto {
  roleKey: string;
}

// ─── Palier 2 : Calendrier de disponibilités ──────────────────────────────────

/** Granularité d'un créneau de disponibilité. */
export type DaySlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY';

/** Story 47.1 (AD-10) — un créneau précis d'un jour, avec sa clé de jour `AAAA-MM-JJ` (UTC). */
export interface DatedSlot {
  date: string;
  slot: DaySlot;
}

/** Les trois créneaux d'une journée, dans l'ordre où ils s'enchaînent (le soir est suivi du matin
 *  du lendemain). */
const SLOT_CHAIN: readonly DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];

function addDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

/**
 * Story 47.1 (AD-10) — **la** fonction de fin d'une plage : `durationSlots` créneaux enchaînés
 * (`MORNING → AFTERNOON → EVENING → MORNING` du lendemain) à partir du créneau de départ, départ
 * compris. `FULL_DAY` n'existe qu'à 1 : la fin est alors le départ lui-même. Lève une `RangeError`
 * pour une durée qui n'est pas un entier ≥ 1, ou pour `FULL_DAY` au-delà de 1 ; l'appelant la
 * traduit en refus écrit.
 */
export function spanEnd(date: string, slot: DaySlot, durationSlots: number): DatedSlot {
  if (!Number.isInteger(durationSlots) || durationSlots < 1) {
    throw new RangeError('La durée doit être un entier d’au moins 1 créneau');
  }
  if (slot === 'FULL_DAY') {
    if (durationSlots > 1) throw new RangeError('Une journée entière ne dure qu’un créneau');
    return { date, slot };
  }
  const index = SLOT_CHAIN.indexOf(slot) + durationSlots - 1;
  return {
    date: addDays(date, Math.floor(index / SLOT_CHAIN.length)),
    slot: SLOT_CHAIN[index % SLOT_CHAIN.length],
  };
}

/**
 * Story 47.1 (AD-10) — **la** fonction des créneaux couverts par une plage, du départ à la fin,
 * un par créneau précis. `FULL_DAY` (durée 1) se déplie en les trois créneaux de son jour. Mêmes
 * refus que `spanEnd`.
 */
export function spanSlots(date: string, slot: DaySlot, durationSlots: number): DatedSlot[] {
  spanEnd(date, slot, durationSlots);
  if (slot === 'FULL_DAY') return SLOT_CHAIN.map((s) => ({ date, slot: s }));
  const start = SLOT_CHAIN.indexOf(slot);
  return Array.from({ length: durationSlots }, (_, i) => ({
    date: addDays(date, Math.floor((start + i) / SLOT_CHAIN.length)),
    slot: SLOT_CHAIN[(start + i) % SLOT_CHAIN.length],
  }));
}

/** Type d'une déclaration de disponibilité. */
export type AvailKind = 'UNAVAILABLE' | 'AVAILABLE';

/** Récurrence d'une déclaration. */
export type RecurKind = 'RECURRING' | 'PUNCTUAL';

/** Statut calculé d'un créneau pour un utilisateur donné. */
export type SlotStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

/** Statut d'un vote de date. */
export type PollStatus = 'OPEN' | 'CLOSED';

/** Réponse à une option de vote. */
export type VoteAnswer = 'YES' | 'NO' | 'MAYBE';

/**
 * Une personne a-t-elle répondu à un sondage ? LA règle de chaque famille (Story 44.2), partagée par le serveur
 * (réponses, signaux de liste) et l'écran : en JDR il faut avoir voté sur CHAQUE option (un sondage sans
 * option compte comme répondu — rien à répondre) ; pour un groupe ou une soirée, sur AU MOINS UNE.
 */
export function hasAnswered(
  family: GameSystemFamily,
  optionIds: readonly string[],
  votedOptionIds: ReadonlySet<string> | readonly string[],
): boolean {
  const voted = votedOptionIds instanceof Set ? votedOptionIds : new Set(votedOptionIds);
  return family === 'ralliement'
    ? optionIds.some((id) => voted.has(id))
    : optionIds.every((id) => voted.has(id));
}

/** Une option de vote telle que `bestOption` la classe : un jour, un créneau et ses réponses. */
export interface RankableOption {
  /** Clé `YYYY-MM-DD`. */
  date: string;
  slot: DaySlot;
  yes: number;
  maybe: number;
}

const DAY_SLOT_RANK: Record<DaySlot, number> = { MORNING: 0, AFTERNOON: 1, EVENING: 2, FULL_DAY: 3 };

/** Ordre chronologique : le jour, puis le créneau de la journée. */
function compareOptionsChronologically(a: RankableOption, b: RankableOption): number {
  return a.date.localeCompare(b.date) || DAY_SLOT_RANK[a.slot] - DAY_SLOT_RANK[b.slot];
}

/** Les options dans l'ordre chronologique (Story 44.4) — le jour, puis le créneau de la journée. Source unique
 *  de l'ordre du plateau de la Destinée et de ses chevrons ; ne modifie pas la liste reçue. */
export function sortOptionsChronologically<T extends RankableOption>(options: readonly T[]): T[] {
  return [...options].sort(compareOptionsChronologically);
}

/** Délai par défaut de la fin d'un vote, en jours (Story 45.4). */
export const POLL_DEFAULT_DEADLINE_DAYS = 14;

/** La clé de jour `YYYY-MM-DD` décalée de `days` jours (calendrier UTC, sans heure). */
function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().substring(0, 10);
}

/**
 * LA fin de vote proposée (Story 45.4, AR17) — source unique du composer ET du serveur, qui remplace le délai
 * fixe de 14 jours : le plus TÔT de « dans 14 jours » et de « la veille du premier créneau », jamais avant
 * aujourd'hui. Entrées et résultat sont des clés de jour `YYYY-MM-DD` ; le serveur donne au résultat la fin de
 * ce jour. Sans créneau : dans 14 jours.
 */
export function defaultPollDeadline(options: readonly { date: string }[], today: string): string {
  const inTwoWeeks = shiftDayKey(today, POLL_DEFAULT_DEADLINE_DAYS);
  if (options.length === 0) return inTwoWeeks;
  const first = options.map((o) => o.date.substring(0, 10)).sort()[0];
  const eve = shiftDayKey(first, -1);
  const earliest = eve < inTwoWeeks ? eve : inTwoWeeks;
  return earliest < today ? today : earliest;
}

/**
 * LE meilleur créneau d'un vote (Story 44.3), source unique de l'écran (Destinée, confirmation « Fixer la
 * date ») : le plus de « oui », puis le plus de « peut-être », puis le plus tôt. Les options passées
 * (`date < today`) sont exclues. `null` s'il n'en reste aucune, ou si personne n'a dit oui — il n'y a alors
 * pas de « meilleur », et rien ne doit en porter l'étiquette.
 */
export function bestOption<T extends RankableOption>(
  options: readonly T[],
  today: string,
): T | null {
  const best = options
    .filter((o) => o.date >= today)
    .sort((a, b) => b.yes - a.yes || b.maybe - a.maybe || compareOptionsChronologically(a, b))[0];
  return best && best.yes > 0 ? best : null;
}

/**
 * L'option sur laquelle la Destinée s'ouvre (Story 44.3) : tant que le vote est ouvert (pas d'échéance, ou
 * échéance aujourd'hui ou plus tard), le premier créneau À VENIR ; après sa fin, le meilleur. Sans meilleur
 * (ou sans créneau à venir), le premier créneau à venir, à défaut le premier créneau. `null` sans option.
 */
export function destinyEntryOption<T extends RankableOption>(
  poll: { expiresAt: string | null; options: readonly T[] },
  today: string,
): T | null {
  const chronological = [...poll.options].sort(compareOptionsChronologically);
  const firstUpcoming = chronological.find((o) => o.date >= today) ?? null;
  const ended = poll.expiresAt !== null && poll.expiresAt.substring(0, 10) < today;
  const preferred = ended ? bestOption(chronological, today) : firstUpcoming;
  return preferred ?? firstUpcoming ?? chronological[0] ?? null;
}

/** Paramètres d'adresse reconnus par les calendriers de l'atelier (Story 44.7). */
export interface AtelierUrlParams {
  /** `?poll=<pollId>` : la Destinée s'ouvre sur ce vote. */
  poll?: string;
  /** `?pollList` : la liste ✦ des destinées s'ouvre. */
  pollList?: boolean;
  /** `?seanceId=<id>` : le rendez-vous visé (armement du composer, palier 10.4). */
  seanceId?: string;
}

/**
 * Le chemin de l'atelier d'une partie (Story 44.7, AD-5/AR18). Le JDR du MJ vit à `/parties/:id/calendar` ; le
 * joueur de JDR, le groupe et la soirée isolée à `/parties/:id/guild-calendar` (un lien `calendar` vers un groupe
 * serait refusé : la lecture des scénarios lui est interdite).
 */
export function atelierPath(target: {
  partieId: string;
  family: GameSystemFamily;
  role: PartieRole;
}): string {
  const page = target.family === 'jdr' && target.role === 'mj' ? 'calendar' : 'guild-calendar';
  return `/parties/${encodeURIComponent(target.partieId)}/${page}`;
}

/** La chaîne de requête (sans `?`) des paramètres donnés, dans un ordre stable ; vide si aucun. */
export function atelierQuery(params: AtelierUrlParams = {}): string {
  const parts: string[] = [];
  if (params.poll) parts.push(`poll=${encodeURIComponent(params.poll)}`);
  if (params.pollList) parts.push('pollList');
  if (params.seanceId) parts.push(`seanceId=${encodeURIComponent(params.seanceId)}`);
  return parts.join('&');
}

/**
 * **Une** fonction construit l'adresse de l'atelier, pour le web et pour les gabarits d'e-mail (Story 44.7) :
 * aucun endroit ne choisit plus lui-même la route d'une famille.
 */
export function atelierUrl(
  target: { partieId: string; family: GameSystemFamily; role: PartieRole },
  params: AtelierUrlParams = {},
): string {
  const query = atelierQuery(params);
  return query ? `${atelierPath(target)}?${query}` : atelierPath(target);
}

/** Déclaration de disponibilité telle que renvoyée par l'API. */
export interface AvailabilityDeclarationDto {
  id: string;
  userId: string;
  kind: AvailKind;
  recurKind: RecurKind;
  dayOfWeek: number | null;
  slot: DaySlot;
  startDate: string | null;
  endDate: string | null;
  expiresAt: string;
  createdAt: string;
}

/** Payload de création d'une déclaration de disponibilité. */
export interface CreateAvailabilityDto {
  kind: AvailKind;
  recurKind: RecurKind;
  dayOfWeek?: number | null;
  slot: DaySlot;
  startDate?: string | null;
  endDate?: string | null;
  expiresAt: string;
  /** ID de la déclaration en cours de remplacement (exclue du check de conflits). */
  replacingId?: string;
  /** Résolution choisie après détection de conflit. */
  conflictResolution?: 'overwrite' | 'keep';
}

/** Info sur une déclaration conflictuelle détectée à la création. */
export interface ConflictInfo {
  id: string;
  kind: AvailKind;
  slot: DaySlot;
  recurKind: RecurKind;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  /** Conflit INTERNE au lot (entre deux items du même lot, `id` synthétique
   *  `batch-item-{index}`) : irrésoluble, aucun choix de résolution n'y a de sens (AC14).
   *  Absent/`false` = conflit avec une déclaration persistée, résoluble. Story 36.4. */
  internal?: boolean;
}

/** Résultat d'un POST /availability (avec ou sans résolution de conflit). */
export interface CreateAvailabilityResult {
  created: AvailabilityDeclarationDto[];
}

/** Élément d'un lot d'écriture groupée (POST /availability/batch) : forme de
 *  CreateAvailabilityDto sans replacingId — cet identifiant n'a de sens que depuis le
 *  panneau, qui remplace une déclaration précise.
 *
 *  `conflictResolution` est en revanche porté PAR ITEM depuis la Story 36.4 (dérogation
 *  D-18) : la route groupée n'échoue plus en bloc sur conflit, elle absorbe l'écrasement
 *  et la découpe. C'est un renversement assumé de l'AC2 de la Story 30.2 et de la phrase
 *  3 d'AD-21 — les phrases 1 (un seul appel) et 2 (écriture transactionnelle tout-ou-rien)
 *  restent vraies. La résolution est par item, et non globale au lot, parce que le
 *  parcours « Au cas par cas » décide créneau par créneau : un seul contrat couvre donc
 *  les trois issues (Remplacer / Conserver / Au cas par cas). */
export interface CreateAvailabilityBatchItem {
  kind: AvailKind;
  recurKind: RecurKind;
  dayOfWeek?: number | null;
  slot: DaySlot;
  startDate?: string | null;
  endDate?: string | null;
  expiresAt: string;
  /** Résolution choisie pour CE créneau après détection de conflit (Story 36.4, D-18).
   *  Absente = aucune résolution : un conflit sur cet item fait échouer le lot avec un 409
   *  qui énumère TOUS les conflits, ce que le dialogue de résolution consomme. */
  conflictResolution?: 'overwrite' | 'keep';
}

/** Payload de POST /availability/batch. */
export interface CreateAvailabilityBatchDto {
  items: CreateAvailabilityBatchItem[];
}

/** Résultat de POST /availability/batch. ⚠️ `created.length` n'égale PAS forcément
 *  `items.length` et son ordre ne correspond PAS positionnellement à `items` : un item
 *  résolu `keep` peut produire 0 à N pièces (découpe « à trous » autour des conflits
 *  conservés), quand tout autre item en produit exactement une. Ne jamais indexer
 *  `created[i]` en supposant qu'il correspond à `items[i]` (Story 36.4). */
export interface CreateAvailabilityBatchResult {
  created: AvailabilityDeclarationDto[];
}

/** Conflit détecté dans un lot : ConflictInfo enrichi de l'index de l'élément fautif. */
export interface BatchConflictInfo extends ConflictInfo {
  /** Index (0-based) de l'élément du lot en conflit avec cette déclaration. */
  batchIndex: number;
}

/** Payload partiel pour la mise à jour d'une déclaration. */
export interface UpdateAvailabilityDto {
  kind?: AvailKind;
  recurKind?: RecurKind;
  dayOfWeek?: number | null;
  slot?: DaySlot;
  startDate?: string | null;
  endDate?: string | null;
  expiresAt?: string;
}

/** Statut d'un membre de la troupe sur un créneau donné, avec son identité.
 *
 *  Forme UNIQUE, partagée par `AvailableSlotDto.members` et par le `members` que
 *  `GET /parties/:id/heatmap` sert **au seul MJ** (Story 36.8). Deux définitions voisines
 *  divergeraient à la première évolution — c'est exactement le défaut à deux dénominateurs que
 *  `participantCount()` a corrigé côté effectif. */
export interface SlotMemberDto {
  userId: string;
  pseudo: string;
  displayName: string;
  status: SlotStatus;
}

/** Créneau calculé disponible pour une partie (retourné par GET /parties/:id/available-slots). */
export interface AvailableSlotDto {
  date: string;
  slot: DaySlot;
  members: SlotMemberDto[];
  /** Story 46.4 — la durée de la fenêtre, en créneaux : 1 jusqu'à l'épic 47. Fait partie de sa clé naturelle (avec le
   *  jour et le créneau de départ), recopiée telle quelle pour masquer ou démasquer. */
  durationSlots: number;
  /** Story 46.4 — la fenêtre est masquée par le MJ : servie à part, après les visibles, jamais comptée dans les 20. */
  hidden?: boolean;
}

/** Story 46.4 — plafond d'une fenêtre ou d'un rendez-vous, en créneaux : 15 jours de 3 créneaux (AR10). Borne la durée
 *  d'un masquage et, depuis la Story 47.1, la durée d'un rendez-vous (`Seance.durationSlots`). */
export const MAX_SLOT_WINDOW_SLOTS = 45;

/** Story 46.4 — corps de `PUT` / `DELETE /parties/:id/available-slots/hidden` : la fenêtre telle que servie. */
export interface SlotWindowKeyDto {
  /** `AAAA-MM-JJ`. */
  date: string;
  startSlot: DaySlot;
  durationSlots: number;
}

/** Vue agrégée d'un créneau disponible pour un joueur non-MJ (sans identité des membres). */
export interface AggregatedSlotDto {
  date: string;
  slot: DaySlot;
  available: number;
  unavailable: number;
  unknown: number;
  total: number;
  /** Story 36.8 (FR-53) — le détail nominatif du créneau, servi **au seul MJ**, pour la couche
   *  « disponibilité du groupe » : une pastille par membre, la POSITION identifiant la personne.
   *
   *  🚨 **Absent, jamais `[]`, pour un joueur.** Un tableau vide laisserait déduire qu'une liste
   *  existe ailleurs ; l'omission ne dit rien. Même discipline que `listMembers()`, qui met
   *  `email: undefined` et non `null` pour un non-MJ.
   *
   *  Optionnel par nécessité (les appelants existants ne le connaissent pas), et c'est la seule
   *  raison : côté front, la projection qui en dérive est **requise** (`| null`), pour que le
   *  compilateur attrape toute surface qui l'oublierait. */
  members?: SlotMemberDto[];
}

/** Séance datée d'une de mes parties (couche `mes-seances`, `GET /me/calendar`, AD-18, Story 30.5).
 *  Identité de partie/scénario incluse : ce sont mes propres parties, la notion de partie tierce
 *  n'existe pas dans le calendrier personnel (AD-9, AC4 Story 30.5). */
export interface MyCalendarSeanceEntry {
  seanceId: string;
  partieId: string;
  partieName: string;
  scenarioId: string;
  scenarioTitle: string;
  date: string;
  slot: DaySlot;
  /** Story 47.2 : fin de la plage de la séance (égale au début pour un créneau), lue de la `Seance`. */
  endDate: string;
  endSlot: DaySlot;
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés. */
  durationSlots: number;
  /** Informations pratiques (Story 36.5). Elles doivent transiter par CE chemin aussi : sans
   *  cela le calendrier personnel ne les verrait jamais, le contexte de partie étant le seul à
   *  disposer du `SeanceDto` complet. Aucun appel supplémentaire — les scalaires de `Seance`
   *  sont déjà chargés par le `findMany` de `getMyCalendar`. */
  heureRdv: string | null;
  lieu: string | null;
  notePratique: string | null;
  /** Story 36.16 — le compte-rendu de cette séance manque, condition d'entrée dans la section
   *  « C'est passé » de l'Agenda (déjà livrée côté front par la 36.11). Contrairement à
   *  `AgendaEntry.compteRenduManquant` (contexte de partie, optionnel), **jamais optionnel ici**
   *  : cette entrée provient toujours d'un `Seance` complet côté serveur, donc toujours
   *  calculable — pas de distinction « on ne sait pas » à préserver. */
  compteRenduManquant: boolean;
}

/** Une option d'un vote en cours, telle que la voit le calendrier PERSONNEL (Story 36.6, D-17).
 *
 *  ⚠️ Contrairement à `PollOptionDto` (contexte de partie, AD-20 : la charge utile porte l'identité
 *  de tous les votants), cette forme est **strictement anonyme** : des compteurs, et ma seule
 *  réponse. Le calendrier personnel agrège des parties entre lesquelles rien ne doit transiter
 *  (AD-9/AD-2) — n'y ajouter jamais un `userId`, un `pseudo` ni un `displayName`. */
export interface OpenPollOption {
  /** Story 36.6 — sans lui, ni ma réponse ni un agrégat ne sont adressables, et le sélecteur de
   *  réponse (story 36.7) ne pourrait pas voter depuis le calendrier personnel. */
  optionId: string;
  date: string;
  slot: DaySlot;
  yes: number;
  maybe: number;
  no: number;
  /** `null` = je n'ai pas répondu. Jamais `undefined` : « pas de réponse » a une seule
   *  représentation, comme l'absence de ligne `PollVote` côté base (AD-10). */
  myAnswer: VoteAnswer | null;
}

/** Un sondage de dates OUVERT de l'une de mes parties actives (`GET /me/open-polls`, Story 44.2), de
 *  n'importe quelle famille (JDR, groupe, soirée isolée). Une entrée par sondage, pas par option — le
 *  client éclate par option. Strictement anonyme : des compteurs et ma seule réponse, jamais un
 *  `userId` de votant. `eligibleCount` = ceux qui peuvent voter (JDR : le MJ + ses membres ; groupe :
 *  les votants éligibles de la conjonction) ; `answeredCount` = ceux d'entre eux qui ont répondu
 *  (règle de `hasAnswered`). `me` dit si JE peux voter et si j'ai répondu. */
export interface OpenPollEntry {
  pollId: string;
  partieId: string;
  partieName: string;
  family: GameSystemFamily;
  kind: PartieKind;
  seanceId: string;
  title: string;
  /** Échéance du vote, `null` si non définie. Passée ou non : un sondage ouvert reste listé. */
  expiresAt: string | null;
  /** Durée du rendez-vous en créneaux (Story 47.4 : lue de la séance ; 1 pour un sondage sans séance). */
  durationSlots: number;
  options: OpenPollOption[];
  eligibleCount: number;
  answeredCount: number;
  me: { eligible: boolean; answered: boolean };
  /** Droits d'organisateur de la personne qui lit sur ce rendez-vous (Story 44.1). */
  can: OrganizerCan;
}

/** Un rendez-vous qui attend une date, proposable par la personne qui lit (`GET /me/datable-seances`,
 *  Story 45.1). Une entrée par séance ; aucune donnée d'un autre membre. */
export interface DatableSeanceEntry {
  seanceId: string;
  partieId: string;
  partieName: string;
  family: GameSystemFamily;
  kind: PartieKind;
  /** Titre du rendez-vous (celui de l'événement). */
  title: string;
  /** Rang de la séance dans son événement (1 = la première) et nombre de séances de l'événement : le client
   *  écrit « Titre — Séance 2 » seulement quand il y en a plusieurs. */
  seanceRank: number;
  seanceCount: number;
  /** Story 47.1 : durée du rendez-vous, en créneaux enchaînés. */
  durationSlots: number;
  /** Droits d'organisateur de la personne qui lit (`propose` est vrai pour toute entrée servie). */
  can: OrganizerCan;
}

/** Séance à inscription ouverte d'une de mes parties CAMPAGNE_EPISODIQUE (couche
 *  `inscriptions-ouvertes`, `GET /me/calendar`, Story 30.5, D-13). Non filtrée par plage de dates :
 *  une séance en attente d'inscriptions n'a pas encore de date propre. */
export interface MyCalendarOpenInscriptionEntry {
  seanceId: string;
  partieId: string;
  partieName: string;
  scenarioId: string;
  scenarioTitle: string;
  inscriptionMin: number;
  inscriptionMax: number;
  inscritsCount: number;
  jeSuisInscrit: boolean;
}

/** Réponse de `GET /me/calendar` (AD-18, Story 30.5) : un seul appel pour toute la plage,
 *  indexé par couche. `disponibilite-groupe` n'y figure jamais (AD-16) — elle n'a de sens que
 *  dans le calendrier d'une partie, pas dans le calendrier personnel. Une couche sans contenu
 *  porte un tableau vide, jamais une clé absente. */
export interface MeCalendarDto {
  'mes-indisponibilites': AvailabilityDeclarationDto[];
  'mes-disponibilites': AvailabilityDeclarationDto[];
  'mes-seances': MyCalendarSeanceEntry[];
  'inscriptions-ouvertes': MyCalendarOpenInscriptionEntry[];
}

/** Vote de date (SessionPoll). */
export interface SessionPollDto {
  id: string;
  partieId: string;
  status: PollStatus;
  scenarioRef: string | null;
  expiresAt: string | null;
  chosenDate: string | null;
  chosenSlot: DaySlot | null;
  /** Story 36.6 — effectif de la troupe : **le MJ + ses membres** (`participantCount()`), le même
   *  nombre que `AggregatedSlotDto.total`. C'est le DÉNOMINATEUR de la piste de participation.
   *
   *  Il vit ici et non dans `PollOptionDto` pour deux raisons. (1) C'est une propriété de la
   *  partie, pas de l'option. (2) 🚨 Les deux `toSessionPollDto` (`poll.service.ts`,
   *  `scenarios.service.ts`) typent leur entrée en `any`, donc `options: (…).map(…)` produit un
   *  `any[]` que TypeScript ne vérifie **pas** : un champ ajouté à l'intérieur des options
   *  manquerait silencieusement. À la racine du littéral, le compilateur l'attrape.
   *
   *  Requis, jamais optionnel : un effectif absent rendrait une piste au dénominateur indéfini. */
  membersCount: number;
  /** Story 47.4 : durée du rendez-vous voté, en créneaux (1 pour un sondage sans séance) — chaque option est
   *  le DÉPART d'une plage de cette durée. Requis, à la racine (même raison que `membersCount`). */
  durationSlots: number;
  options: PollOptionDto[];
}

/** Option d'un vote de date. */
export interface PollOptionDto {
  id: string;
  date: string;
  slot: DaySlot;
  votes: PollVoteDto[];
}

/** Vote d'un membre sur une option. */
export interface PollVoteDto {
  userId: string;
  pseudo: string;
  /** Nom affiché du votant (AD-2). Étendu par la revue de code de la story 28.2 : sans lui, la liste
   *  des votants nommait le joueur par son pseudo pendant que la liste des manquants, juste en
   *  dessous, le nommait par son nom affiché. */
  displayName: string;
  answer: VoteAnswer;
}

/** Payload de création d'un vote de date (POST /parties/:id/poll). */
export interface CreatePollDto {
  options: { date: string; slot: DaySlot }[];
  scenarioRef?: string | null;
  /** Story 45.4 — fin du vote, un jour `YYYY-MM-DD`. Absent : `defaultPollDeadline`. */
  expiresAt?: string;
}

/**
 * Payload de mutation des options d'un vote OUVERT (PUT /parties/:id/poll/:pollId/options,
 * Story 36.10, dérogation D-16). MJ seul.
 *
 * 🚨 **Jeu DÉCLARATIF COMPLET, jamais un delta.** Le corps décrit l'état d'arrivée voulu : ce que
 * la grille produit après composition. Un `{ add, remove }` obligerait le client à connaître les
 * `id` d'options et à tenir un état intermédiaire.
 *
 * 🚨 **La réconciliation serveur se fait sur la clé métier `date` + `slot`, et une option
 * CONSERVÉE GARDE SON `id`.** `PollVote` est en cascade sur `PollOption` : un « delete all +
 * recreate » détruirait les réponses de TOUS les membres à chaque ajout d'une seule date. Seules
 * les options réellement retirées perdent leurs réponses (Q-22, avertissement préalable côté
 * client).
 *
 * Bornes identiques à `CreatePollDto` : 2 à 40 options, aucune paire `date` + `slot` en double.
 */
export interface SetPollOptionsDto {
  options: { date: string; slot: DaySlot }[];
  /** Story 45.4 — nouvelle fin du vote, un jour `YYYY-MM-DD` ; absent : la fin actuelle est gardée. Repousser la
   *  fin d'un vote de JDR EST sa prolongation. Une date déjà passée est refusée, sauf si elle est inchangée. */
  expiresAt?: string;
  /** Story 47.4 : nouvelle durée du rendez-vous, en créneaux (1 à 45) ; absente = inchangée. Une durée
   *  réellement changée recrée toutes les options : TOUTES les réponses sont effacées (avertissement préalable
   *  côté client). Un créneau `FULL_DAY` n'existe qu'à 1. */
  durationSlots?: number;
}

/** Payload pour voter sur une option (POST /parties/:id/poll/:pollId/vote). */
export interface CastVoteDto {
  optionId: string;
  answer: VoteAnswer;
}

/** Payload pour choisir la date finale d'un vote (PATCH /parties/:id/poll/:pollId/choose). */
export interface ChooseDateDto {
  optionId: string;
}

// ─── Palier P3 : Moteur plugin & Personnages ─────────────────────────────────

/** Système de jeu enregistré dans le registre. */
export interface GameSystemDto {
  id: string;
  name: string;
  version: string;
}

/** Données génériques d'une fiche (structure validée applicativement par validate()). */
export type SheetData = Record<string, unknown>;

/** Stats dérivées d'un personnage. */
export interface DerivedStats {
  PV: number;
  PE: number;
  Condition: number;
  Initiative: number;
  Encombrement: number;
}

/** Fiche de personnage telle que renvoyée par l'API. */
export interface CharacterDto {
  id: string;
  userId: string;
  partieId: string;
  gameSystemId: string;
  sheetData: SheetData;
  derived: DerivedStats;
  portraitUrl: string | null;
  portraitCropData: unknown | null;
  /** Recadrage dédié pour l'export PDF (même forme que `portraitCropData`), indépendant de celui-ci. */
  pdfPortraitCropData: unknown | null;
  createdAt: string;
  updatedAt: string;
  /** Pseudo du propriétaire (joueur ou MJ) — résolu côté serveur, jamais stocké. */
  ownerPseudo: string;
  /** Nom affiché du propriétaire — résolu côté serveur, jamais stocké (AD-2, Story 28.2). */
  ownerDisplayName: string;
  /** Le propriétaire de ce personnage est le MJ de la partie (distinct d'un personnage de joueur). */
  ownerIsMj: boolean;
  /**
   * L'utilisateur qui a demandé cette fiche (le *viewer* de la requête courante) est le MJ de la
   * Partie — **distinct** de `ownerIsMj` (qui parle du propriétaire du personnage, pas de qui
   * consulte). Introduit Story 6.5 (revue de code) pour remplacer l'heuristique frontend
   * "n'importe quel non-propriétaire = MJ", devenue fausse dès qu'un fellow player (ni
   * propriétaire, ni MJ) a pu consulter la fiche d'un coéquipier.
   */
  viewerIsMj: boolean;
  /** Points d'expérience cumulés — seule source de vérité (jamais dépensés, jamais remis à zéro). */
  xp: number;
  /** Association automatique du journal partagé aux rétrospectives de scénario (Story 8.6). Réglage par personnage, pas par compte joueur. */
  journalAutoAssociate: boolean;
  /**
   * Niveau réellement appliqué (1 + nombre de montées de niveau validées), calculé côté API —
   * jamais écrit directement par le client. **Distinct** du niveau potentiel atteignable avec
   * `xp` (cf. `pendingLevels`/`LevelUpBanner`) : un personnage peut avoir assez d'XP pour monter
   * de niveau sans que `level` n'augmente tant que le joueur n'a pas validé le `LevelUpWizard`.
   */
  level: number;
  /**
   * Chemins de fiche retirés de cette réponse par le cadenas de visibilité (Story 31.6) — chemin
   * pointé simple (`"classId"`) ou sous-champ (`"attributes.AGI"`), plus `"derived"` quand
   * `derived` est retiré en entier (dépendance à `attributes`/`levelUps` verrouillée). Toujours
   * renvoyé par l'API (tableau vide pour le propriétaire de la fiche et pour le MJ, qui voient
   * toujours tout — ou quand rien n'est configuré pour la Partie). `sheetData`/`derived` restent
   * typés pleins ci-dessus (contrat DTO existant) : une clé retirée est simplement absente à
   * l'exécution (jamais vide ni nulle), signalée ici.
   *
   * Optionnel dans CE TYPE (pas côté API, qui le peuple systématiquement) : `apps/web/**` est hors
   * périmètre de la Story 31.6 (aucune modification, cf. spec) et
   * `apps/web/src/app/core/characters/character-dto.fixture.ts` construit un `CharacterDto`
   * littéral sans ce champ — le marquer requis casserait sa compilation sans qu'aucune story
   * n'ait mandat de la corriger ici.
   */
  hiddenFields?: string[];
}

/** Personnage enrichi du nom de sa Partie d'origine — forme de réponse propre à `GET /me/characters`
 *  (Story 29.2, D-10), jamais utilisée ailleurs : `CharacterDto` reste inchangé pour tous les autres
 *  appelants. */
export interface MyCharacterDto extends CharacterDto {
  partieName: string;
  /** Libellé de classe résolu côté serveur (Story 29.9, contenu de jeu du système du personnage) —
   *  `null` si `sheetData.classId` est absent ou ne référence aucune entrée du catalogue. */
  classLabel: string | null;
  /** Libellé de type résolu côté serveur, même patron que `classLabel`. */
  typeLabel: string | null;
  /** Libellé du rôle de groupe assigné à ce personnage sur sa Partie (Story 27.2), résolu côté
   *  serveur — `null` si aucun rôle n'est assigné. */
  groupRoleLabel: string | null;
}

/** Une ligne d'une distribution d'XP : le montant accordé à un personnage. */
export interface XpDistributionEntryDto {
  characterId: string;
  amount: number;
  isBonus: boolean;
  /** Identité du propriétaire du personnage crédité — pas celle du MJ qui distribue (AD-2, Story 28.2). */
  ownerPseudo: string;
  ownerDisplayName: string;
}

/** Distribution d'XP faite par le MJ après une session, avec ses entrées par personnage. */
export interface XpDistributionDto {
  id: string;
  partieId: string;
  note?: string;
  createdAt: string;
  entries: XpDistributionEntryDto[];
}

/** Payload de création d'une distribution d'XP (POST /parties/:id/xp-distributions). */
export interface CreateXpDistributionDto {
  /** Calcul assisté (FR-2) — stockés pour audit/affichage uniquement, jamais revérifiés contre `amount`. */
  difficulty?: number;
  breaths?: number;
  monsterLevel?: number;
  entries: { characterId: string; amount: number; isBonus?: boolean }[];
  note?: string;
}

/** Déclencheur d'un instantané de fiche (Story 6.3). */
export type SnapshotTrigger = 'LEVEL_UP' | 'MJ_EDIT';

/** Instantané immuable de la fiche d'un personnage (historique, jamais de restauration). */
export interface CharacterSnapshotDto {
  id: string;
  characterId: string;
  sheetData: SheetData;
  derived: DerivedStats;
  level: number;
  trigger: SnapshotTrigger;
  note?: string;
  createdAt: string;
}

/**
 * Payload de POST /characters/:id/level-up. `capabilities[].type` reste `string` ici (pas
 * `CapabilityType`, qui vit dans `@master-jdr/game-rules` — `packages/shared` ne doit pas en
 * dépendre). Aux niveaux 4/6/10, deux capacités sont octroyées conjointement (Attribut ET
 * spéciale) — le tableau en contient alors deux ; sinon une seule.
 */
export interface CreateLevelUpDto {
  pvAllocated: number;
  peAllocated: number;
  capabilities: { type: string; params: Record<string, unknown> }[];
}

/**
 * Payload de POST /characters/:id/inventory-items. `addedBy` n'existe pas dans ce type —
 * forcé côté serveur, jamais accepté du client (AD-3, Story 6.4).
 */
export interface CreateInventoryItemDto {
  name: string;
  weight?: number; // absent → 0 côté serveur
  price?: string;
  effect?: string;
}

/** Payload de PATCH /characters/:id/inventory-items/:itemId — partiel, au moins un champ. */
export interface UpdateInventoryItemDto {
  name?: string;
  weight?: number;
  price?: string;
  effect?: string;
}

/**
 * Payload de POST /characters/:id/contenants (Story 14.1/14.2) — même forme qu'`individual`,
 * poids obligatoire (contrairement à `individual`, dont le poids reste facultatif — gap
 * pré-existant Story 6.4, non reproduit ici).
 */
export interface CreateContenantDto {
  name: string;
  weight: number;
  price?: string;
  effect?: string;
}

/** Payload de PATCH /characters/:id/contenants/:itemId — partiel, au moins un champ. */
export interface UpdateContenantDto {
  name?: string;
  weight?: number;
  price?: string;
  effect?: string;
}

/**
 * Payload de POST /characters/:id/animaux (Story 14.1/14.2) — **jamais** de propriété `weight`,
 * même optionnelle : un animal n'a jamais de poids (FR8), absence structurelle.
 */
export interface CreateAnimalDto {
  name: string;
  price?: string;
  effect?: string;
}

/** Payload de PATCH /characters/:id/animaux/:itemId — partiel, au moins un champ. */
export interface UpdateAnimalDto {
  name?: string;
  price?: string;
  effect?: string;
}

/** Entrée du journal de notes d'un personnage (Story 6.5) — append-only, jamais éditée/supprimée après création. */
export interface CharacterNoteDto {
  id: string;
  characterId: string;
  text: string;
  shared: boolean;
  /** Scénario auquel cette entrée est manuellement associée (Story 8.6), `null` si aucune. Indépendant de l'association automatique. */
  scenarioId: string | null;
  createdAt: string;
}

/** Payload de POST /characters/:id/notes. */
export interface CreateCharacterNoteDto {
  text: string;
}

/** Payload de PATCH /characters/:id/notes/:noteId/share. */
export interface ToggleNoteShareDto {
  shared: boolean;
}

/** Payload de PATCH /characters/:id/sheet-field (AD-6, édition MJ générique). */
export interface SetSheetFieldDto {
  path: string;
  value: unknown;
}

/** Réponse de PATCH /characters/:id/sheet-field : `warnings` = errors[] consultatif de `validate('mj', ...)`, jamais bloquant (AD-7/NFR3). */
export interface SetSheetFieldResultDto {
  character: CharacterDto;
  warnings: string[];
}

/** Payload de PATCH /characters/:id/xp (édition MJ directe, distincte de la distribution d'XP — AD-6). */
export interface SetXpDto {
  value: number;
}

/** Payload de PATCH /characters/:id/journal-auto-associate (Story 8.6, propriétaire seul). */
export interface SetJournalAutoAssociateDto {
  journalAutoAssociate: boolean;
}

/** Payload de PATCH /characters/:id/notes/:noteId/scenario (Story 8.6, propriétaire seul). `null` = désassocier. */
export interface SetNoteScenarioDto {
  scenarioId: string | null;
}

/** Payload de PATCH /characters/:id/narrative-field (Story 6.7, édition propriétaire-seul). */
export interface UpdateNarrativeFieldDto {
  field: 'sex' | 'age' | 'physicalTraits' | 'homeTown' | 'motivation' | 'personality';
  value: unknown;
}

/**
 * Dimensions du cadre portrait de l'export PDF Ryuutama, mesurées empiriquement en Story 4.6
 * (`apps/api/game-systems/ryuutama/assets/README.md`, section "Zone du portrait"). Consommées
 * par `PortraitCropper` (web) pour que son masque de prévisualisation rectangulaire corresponde
 * au cadre réel du PDF.
 *
 * **Dupliquées, pas partagées**, avec `PORTRAIT_WIDTH`/`PORTRAIT_HEIGHT` dans
 * `apps/api/src/characters/ryuutama-pdf.service.ts`. La duplication est un héritage : elle datait
 * d'une époque où Jest ne transformait pas ce package comme dépendance de workspace, ce qui cassait
 * tout import de valeur runtime côté API. Cette contrainte est levée — `transformIgnorePatterns`
 * transforme désormais `@master-jdr/shared` (cf. la config `jest` d'`apps/api/package.json`), et
 * l'API importe déjà des valeurs d'ici (`GAME_SYSTEMS` dans `parties/dto/create-partie.dto.ts`,
 * `THEMES` dans `auth/auth.service.ts`). Tant que la duplication subsiste : si ces valeurs
 * changent, mettre à jour les deux emplacements.
 */
export const RYUUTAMA_PDF_PORTRAIT_WIDTH = 188.18;
export const RYUUTAMA_PDF_PORTRAIT_HEIGHT = 136.48;
export const RYUUTAMA_PDF_PORTRAIT_ASPECT_RATIO =
  RYUUTAMA_PDF_PORTRAIT_WIDTH / RYUUTAMA_PDF_PORTRAIT_HEIGHT;

/** Payload de création d'un personnage. */
export interface CreateCharacterDto {
  gameSystemId: string;
  sheetData: SheetData;
}

/** Description d'une clé de `sheetSchema` (Story 31.6/31.7) — `lockable`/`lockableFields`
 *  déclarent ce que l'écran de configuration des cadenas (31.7) peut proposer à la coche, sans
 *  aucune liste écrite en dur côté écran. `label`/`lockableFieldLabels` portent les libellés
 *  affichés (mêmes textes que `creationSteps`/la fiche personnage, jamais un nouveau libellé
 *  inventé pour cet écran). */
export interface SheetSchemaFieldDto {
  type: string;
  optional?: boolean;
  fields?: string[];
  lockable?: boolean;
  lockableFields?: string[];
  label: string;
  lockableFieldLabels?: Record<string, string>;
}

/** Réponse de GET /game-systems/:id/schema. */
export interface GameSystemSchemaDto {
  sheetSchema: Record<string, SheetSchemaFieldDto>;
  creationSteps: unknown[];
}

/** Un chemin verrouillé (Story 31.6/31.7) — miroir du retour de `setVisibilityLocks()`/
 *  `getVisibilityLocks()` côté API, jamais réimporté depuis `apps/api`. */
export interface VisibilityLockPathDto {
  fieldKey: string;
  subField: string | null;
}

/** Entrée de contenu générique d'un système de jeu (ex: une classe, un type, une arme). */
export interface ContentEntryDto {
  key: string;
  data: unknown;
}

/** Réponse de GET /game-systems/:id/content — groupé par clé de ContentType. */
export type GameSystemContentDto = Record<string, ContentEntryDto[]>;

// ─── Palier 4 : Infra e-mail & notifications ─────────────────────────────────

/** Payload de POST /auth/forgot-password. */
export interface RequestPasswordResetDto {
  email: string;
}

/** Payload de POST /auth/reset-password. */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// ─── Epic 10 : Homme Dragon (MJ) ───────────────────────────────────────────

/** Race de l'Homme Dragon (Story 10.1) — fixée à la création, détermine les artefacts proposés. */
export type HommeDragonRace = 'DRAGON_VERT' | 'DRAGON_BLEU' | 'DRAGON_ROUGE' | 'DRAGON_NOIR';

/** Fiche du personnage du MJ pour Ryuutama (Story 10.1) — la part saisie et persistée (`sheetData`).
 * Niveau, PS, aventures, historique et éveils en attente sont calculés à la lecture
 * (`HommeDragonDto`, AD-3), jamais stockés ici. */
export interface HommeDragonSheetData {
  race: HommeDragonRace;
  artefact: { key: string; nom?: string; inscription?: string };
  nom: string;
  apparence?: string;
  caractere?: string;
  vocation?: string;
  demeure?: string;
  avatar?: string;
  mondesProteges?: string;
  /** Pouvoirs d'éveil choisis, un par niveau franchi (2-5) — jamais recalculé, c'est un choix
   * du MJ (Story 10.4). Absent sur les fiches créées avant cette story. */
  eveilPowers?: { level: number; key: string }[];
  /** Artefact offert par les hommes-dragons des autres races au niveau 4 (Story 33.7) : choix
   * unique et définitif du MJ, jamais d'artefact de la race du dragon. Le libellé se lit au
   * catalogue `hommeDragonArtefact`. Absent tant que rien n'est choisi. */
  artefactCadeau?: { key: string };
  /** Réserve de souffles du dragon (Story 33.6) : une seule par Homme Dragon, positionnelle
   * (index = numéro d'emplacement − 1), clé d'un souffle du catalogue `souffle` ou `souffleRituel`,
   * `null`/absent = emplacement vide. Écrite uniquement par `PUT …/reserve/:slot`, jamais par le
   * `PATCH` générique ; lue par le MJ seul (la fiche entière lui est réservée). */
  reserve?: (string | null)[];
}

/** Référence légère à un Homme Dragon : `{ id, nom }` (AD-23). Renvoyée par
 * `GET /parties/:id/homme-dragon` (`null` si l'aventure n'en a pas) — ni race, ni niveau, ni réserve. */
export interface HommeDragonRefDto {
  id: string;
  nom: string;
}

/** Un voyageur protégé d'une aventure (AD-23) — convention joueur / personnage : `pseudo` et
 * `displayName` permettent au front d'afficher le nom selon la convention de l'application. */
export interface HommeDragonVoyageurDto {
  userId: string;
  pseudo: string;
  displayName: string;
}

/** Une aventure d'un Homme Dragon (AD-23) : une partie dont `hommeDragonId` est son id, avec les
 * voyageurs protégés (membres de la partie hors MJ) — calculé à la lecture, jamais stocké. */
export interface HommeDragonAventureDto {
  partieId: string;
  nom: string;
  voyageurs: HommeDragonVoyageurDto[];
}

export interface HommeDragonDto {
  id: string;
  userId: string;
  gameSystemId: string;
  sheetData: HommeDragonSheetData;
  createdAt: string;
  updatedAt: string;
  /** Aventures de l'Homme Dragon (0..N, triées par `Partie.createdAt` puis `id`) avec leurs
   * voyageurs protégés — calculé à la lecture, jamais stocké (AD-3, AD-23). Remplace le
   * `partieId` et le `voyageursProteges` plat d'avant la Story 33.8. */
  aventures: HommeDragonAventureDto[];
  /** Scénarios `PASSE` de TOUTES les aventures, chacun avec sa `partieId`, triés par date de
   * clôture puis id croissants — calculé à la lecture, jamais stocké (AD-3, AD-23). */
  historique: { scenarioTitle: string; date: string; participants: string[]; partieId: string }[];
  /** Niveau (1-5) et Points de Souffle max — calculés à la lecture depuis le nombre de scénarios
   * `PASSE` cumulés sur toutes les aventures, jamais stockés (AD-3, Story 10.3, AD-23). */
  derived: { level: number; PS: number };
  /** Miroir de `sheetData.eveilPowers`, toujours un tableau (jamais `undefined`). */
  eveilPowers: { level: number; key: string }[];
  /** Niveaux 2-5 en attente d'un choix de pouvoir d'éveil — calculé à la lecture (AD-3),
   * jamais stocké. Vide si aucun choix n'est en attente. */
  pendingEveilLevels: number[];
}

/**
 * Un Homme Dragon vu depuis « Personnages » (Story 33.5) — lecture agrégée `GET /me/homme-dragons`,
 * volontairement légère : pas de `derived` ni de niveau (calcul par scénarios `PASSE`, fan-out
 * par partie). Une ligne par Homme Dragon, filtrée par propriétaire seul (AD-23) : `aventures`
 * peut être vide (Homme Dragon sans aventure, atteignable par dissociation ou suppression de partie).
 */
export interface MyHommeDragonDto {
  id: string;
  /** Aventures de l'Homme Dragon, triées par `Partie.createdAt` puis `id` ; éventuellement vide. */
  aventures: { partieId: string; nom: string }[];
  gameSystemId: string;
  nom: string;
  race: HommeDragonRace;
  avatar?: string;
  createdAt: string;
}

/** Payload de création (POST /parties/:id/homme-dragon, crée ET lie à la partie) — mêmes champs que la fiche, à plat. */
export type CreateHommeDragonDto = HommeDragonSheetData;

/** Payload de mise à jour (PATCH /homme-dragons/:id) — race jamais éditable après création,
 * ni l'artefact cadeau (choix définitif via POST `artefact-cadeau`, Story 33.7), ni la réserve de
 * souffles (route dédiée `PUT reserve/:slot`, Story 33.6). */
export type UpdateHommeDragonDto = Partial<
  Omit<HommeDragonSheetData, 'race' | 'artefactCadeau' | 'reserve'>
>;

/** Payload de choix d'un pouvoir d'éveil (POST /homme-dragons/:id/eveil-power).
 * Décision utilisateur (Story 10.4) : le catalogue `eveilPower` est un pool commun à toutes les
 * races, sans niveau de déblocage par pouvoir — `level` désigne ici le seuil de niveau franchi
 * pour lequel ce choix est fait (doit appartenir à `pendingEveilLevels`), pas un attribut du
 * pouvoir lui-même. */
export interface ChooseEveilPowerDto {
  level: number;
  key: string;
}

/** Payload du choix de l'artefact cadeau (POST /homme-dragons/:id/artefact-cadeau,
 * Story 33.7) — niveau ≥ 4, choix unique et définitif, artefact d'une autre race que le dragon. */
export interface ChooseArtefactCadeauDto {
  key: string;
}

/** Payload de l'écriture d'un emplacement de la réserve (PUT /homme-dragons/:id/reserve/:slot,
 * Story 33.6) — `key: null` retire le souffle de l'emplacement. Un seul emplacement par appel ; le
 * numéro d'emplacement (1-based) est dans l'URL. */
export interface SetReserveSlotDto {
  key: string | null;
}

// ─── Ludothèque (Palier 10.5, épic 48) ────────────────────────────────────────

/**
 * Clé de regroupement d'un nom de jeu (Story 48.1) — LA normalisation unique, partagée par toutes
 * les couches. Dans cet ordre : décomposition NFD ; suppression des seuls diacritiques combinants
 * latins (U+0300–U+036F — les marques des autres écritures, ex. le dakuten japonais, distinguent des
 * noms et sont gardées) ; suppression des caractères de format invisibles (`\p{Cf}` : espace sans
 * chasse, trait d'union conditionnel, BOM…) ; puis bords rognés, espaces intérieurs réduits à un
 * seul, minuscules. Calculée par l'API à l'écriture et servie dans chaque DTO ; le front regroupe sur
 * la clé reçue, sans la recalculer.
 */
export function boardGameNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\p{Cf}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Un jeu de la Ludothèque d'une personne (Story 48.1) — projection explicite, jamais la ligne brute. */
export interface BoardGameDto {
  id: string;
  name: string;
  nameKey: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  durationMin: number | null;
  createdAt: string;
}

/** Identité publique du propriétaire d'une Ludothèque lue par un tiers (Story 48.3) : pseudo et nom
 *  affiché seulement — jamais d'e-mail. */
export interface UserLibraryOwnerDto {
  userId: string;
  pseudo: string;
  displayName: string;
}

/** Ludothèque d'une personne telle que lue par un tiers (`GET /users/:userId/board-games`, Story 48.3) :
 *  son identité publique et ses jeux, triés comme `GET /me/board-games`. */
export interface UserLibraryDto {
  owner: UserLibraryOwnerDto;
  games: BoardGameDto[];
}

/** Un jeu des membres d'un groupe (Story 50.1) : toutes les copies d'un même nom normalisé (`nameKey`, reçue,
 *  jamais recalculée côté web pour le regroupement) en une ligne, avec leurs propriétaires — pseudo et nom
 *  affiché seulement, jamais d'e-mail. Le nom et les mesures sont ceux de la copie du premier propriétaire
 *  (ordre de `owners`) : ce que la ligne annonce est ce que le filtre teste. */
export interface GroupBoardGameDto {
  nameKey: string;
  name: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  durationMin: number | null;
  owners: UserLibraryOwnerDto[];
}

/** Les jeux des membres actuels d'un groupe (`GET /parties/:id/board-games`, Story 50.1), triés par clé
 *  normalisée ; un groupe sans jeu renvoie `games: []`. */
export interface GroupBoardGamesDto {
  games: GroupBoardGameDto[];
}

/** Combien de fois un membre a reçu le groupe (Story 50.2) — pseudo et nom affiché seulement, jamais d'e-mail. */
export interface HostCountDto {
  userId: string;
  pseudo: string;
  displayName: string;
  count: number;
}

/** Le Compteur d'hôte d'un groupe (`GET /parties/:id/host-counts`, Story 50.2) : chaque membre ACTUEL (0 compris),
 *  du plus grand compte au plus petit, puis par nom. Comptent les conjonctions passées et non annulées du groupe
 *  que le membre a hébergées ; rien n'est stocké. */
export interface HostCountsDto {
  members: HostCountDto[];
}

/** Un jeu apporté à une soirée par un participant (Story 49.2) : le jeu et qui l'apporte — pseudo et nom
 *  affiché seulement, jamais d'e-mail. */
export interface EventBringDto {
  game: BoardGameDto;
  bringer: { userId: string; pseudo: string; displayName: string };
}

/** Les Envies d'un nom de jeu sur place (Story 49.5) : qui a envie d'y jouer ce soir — pseudo et nom affiché
 *  seulement, jamais d'e-mail. `nameKey` est la clé normalisée reçue, jamais recalculée côté web. */
export interface EventEnvyDto {
  nameKey: string;
  users: { userId: string; pseudo: string; displayName: string }[];
}

/** Les jeux sur place d'une soirée à venir (`GET /events/:eventId/board-games`, Story 49.1) : les jeux de
 *  l'hôte, triés par clé normalisée puis nom, et le nombre de participants N (hôte compris, jamais une place
 *  seulement réservée). Story 49.2 : `brings` — les jeux apportés par les participants actuels (triés comme
 *  `games`). Soirée passée, terminée ou annulée : `games` et `brings` vides, N tel que
 *  calculé. Story 49.4 : `games` ne liste plus les jeux que l'hôte a écartés pour cette soirée ; ceux-ci
 *  ne sont rendus QUE à l'hôte, dans `excludedGames` (clé absente pour tout autre lecteur, `[]` sur une soirée
 *  fermée) — la réponse elle-même ne dit rien aux autres. Story 49.5 : `envies` — les Envies des participants
 *  actuels sur les noms sur place (triées par clé puis pseudo), toujours présent, `[]` sur une soirée fermée.
 *  Jamais d'e-mail. */
export interface EventBoardGamesDto {
  games: BoardGameDto[];
  brings: EventBringDto[];
  participantsCount: number;
  envies: EventEnvyDto[];
  excludedGames?: BoardGameDto[];
}

/** Corps de `PUT/DELETE /events/:eventId/envies` (Story 49.5) : la clé normalisée du nom de jeu. */
export interface EventEnvyInput {
  nameKey: string;
}

/** Combien d'apports de soirées encore ouvertes pèsent sur l'un de mes jeux (`GET
 *  /me/board-games/:boardGameId/brought-count`, Story 49.2) — lu avant de le retirer de ma Ludothèque. */
export interface BoardGameBroughtCountDto {
  count: number;
}

/** Décision de droit « lire la Ludothèque d'une personne » (Story 48.3). Cible `{ userId }`, décidée
 *  par `PermissionService.assertLibraryRead` et nulle part ailleurs. Hors de l'union fermée
 *  `PermissionAction`, dont les tables de politique sont indexées par rôle SUR UNE PARTIE : ici la
 *  décision porte sur deux personnes, pas sur une partie. */
export const LIBRARY_READ = 'LIBRARY_READ';

/** Corps de `POST /me/board-games` (Story 48.1) : seul le nom est obligatoire. */
export interface CreateBoardGameInput {
  name: string;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  durationMin?: number | null;
}

/** Corps de `PATCH /me/board-games/:id` (Story 48.2) : partiel — champ absent = inchangé, `null`
 *  efface un nombre ; le nom ne peut être ni `null` ni blanc. */
export interface UpdateBoardGameInput {
  name?: string;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  durationMin?: number | null;
}
