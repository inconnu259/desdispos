import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { atelierPath, familyOf, hasCapability } from '@master-jdr/shared';
import type {
  AnnouncementDto,
  CharacterDto,
  CharacterGroupRoleDto,
  DaySlot,
  GameSystemContentDto,
  InviteLinkDto,
  PartieDto,
  PartieMemberDto,
  SessionPollDto,
  UserSearchResultDto,
  XpDistributionDto,
} from '@master-jdr/shared';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};
import { AuthService } from '../../../core/auth/auth.service';
import { AppIcon } from '../../../core/icons/app-icon';
import { CharacterService } from '../../../core/characters/character.service';
import { characterName, findContentEntry } from '../../../core/characters/character.util';
import { PartiesService } from '../../../core/parties/parties.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { ambiguousUserIds } from '../../../shared/identity/identity-ambiguity.util';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { getRespondedCount, hasUnansweredOptions } from '../../../core/poll/poll.util';
import { seanceState, type StatusBadgeState } from '../../../core/status/status-derivation';
import { toDateKey } from '../../calendar/day-detail.utils';
import { StatusBadge } from '../../../shared/status-badge/status-badge';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { gameSystemName, partieKindLabelKey } from '../../../core/parties/parties.util';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { CharacterSummaryCard } from '../../characters/character-summary-card/character-summary-card';
import { RosterRail } from '../roster-rail/roster-rail';
import { RosterStrip } from '../roster-strip/roster-strip';
import { XpDistributionPanel } from '../xp-distribution-panel/xp-distribution-panel';
import { XpHistory } from '../xp-history/xp-history';
import { ScenarioList } from '../../scenarios/scenario-list/scenario-list';
import { ScenarioOneShotTab } from '../../scenarios/scenario-one-shot-tab/scenario-one-shot-tab';
import { ScenarioTimeline } from '../../scenarios/scenario-timeline/scenario-timeline';
import { AnnouncementFormComponent } from '../../announcements/announcement-form/announcement-form';
import { AnnonceCard } from '../../announcements/annonce-card/annonce-card';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { UnseenAnnouncementsService } from '../../../core/announcements/unseen-announcements.service';
import { scrollToAnnouncement } from '../../../core/announcements/scroll-to-announcement.util';
import { CharacterRolesService } from '../../../core/character-roles/character-roles.service';
import { HommeDragonAventurePanel } from '../../homme-dragon/homme-dragon-aventure-panel/homme-dragon-aventure-panel';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { GroupGamesTab } from '../../board-games/group-games-tab/group-games-tab';
import { HostBars } from '../../events/host-bars/host-bars';
import { LibrarySheet } from '../../board-games/library-sheet/library-sheet';
import { ConjonctionsTab } from '../../events/conjonctions-tab/conjonctions-tab';
import { EventGamesTab } from '../../events/event-games-tab/event-games-tab';
import { SoireeTab } from '../../events/soiree-tab/soiree-tab';
import { EventsApiService } from '../../events/events-api.service';

/** Index de l'onglet "Invitations" — toujours en 2e position pour le MJ (jamais d'onglet "Ma fiche" pour lui). */
const MJ_INVITATIONS_TAB_INDEX = 1;

/** Story 32.1 : longueur minimale de saisie avant d'interroger `GET /users/search` (autocomplétion
 *  par pseudo) — en dessous, aucune requête HTTP n'est émise (décidé par l'utilisateur, 2026-09-22). */
const SEARCH_MIN_LENGTH = 2;

/** Story 32.1 : délai de debounce (ms) avant de déclencher automatiquement `runSearch()` au fil de
 *  la frappe — pas de lib de debounce, un simple `setTimeout` suffit à l'échelle actuelle. */
const SEARCH_DEBOUNCE_MS = 500;

@Component({
  selector: 'app-partie-detail',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    NgTemplateOutlet,
    MatCardModule,
    MatButtonModule,
    AppIcon,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    CharacterSummaryCard,
    RosterRail,
    RosterStrip,
    XpDistributionPanel,
    XpHistory,
    ScenarioList,
    ScenarioOneShotTab,
    ScenarioTimeline,
    AnnouncementFormComponent,
    AnnonceCard,
    HommeDragonAventurePanel,
    IdentityLabel,
    StatusBadge,
    ConjonctionsTab,
    SoireeTab,
    EventGamesTab,
    GroupGamesTab,
    HostBars,
    LibrarySheet,
  ],
  templateUrl: './partie-detail.html',
  styleUrl: './partie-detail.scss',
})
export class PartieDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly parties = inject(PartiesService);
  private readonly realtime = inject(RealtimeService);
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly scenariosSvc = inject(ScenariosService);
  private readonly announcementsSvc = inject(AnnouncementsService);
  private readonly unseenAnnouncementsSvc = inject(UnseenAnnouncementsService);
  private readonly characterRolesSvc = inject(CharacterRolesService);
  private readonly characterSvc = inject(CharacterService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);
  protected readonly theme = inject(ThemeToneService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsApi = inject(EventsApiService);

  private static readonly DESKTOP_QUERY = '(min-width: 1024px)';

  /** Aucun champ de capacité/nombre de places max sur `PartieDto` — le slot "+ Inviter" du roster
   *  reste donc toujours visible pour le MJ (seul rôle habilité à inviter), sans notion de capacité. */
  protected readonly hasFreeSlot = true;

  protected readonly partie = signal<PartieDto | null>(null);
  protected readonly members = signal<PartieMemberDto[]>([]);
  // Story 8.8 (revue de code) : plusieurs votes actifs peuvent désormais coexister sur une même
  // Partie (Décision 2) — remplace l'ancien `activePoll` unique (`PollService.getCurrentPoll()`,
  // hypothèse « un seul poll par Partie » invalidée). Chargé via ScenariosService.listAll(), même
  // source que CalendarView/ScenarioTimeline.
  protected readonly activePolls = signal<SessionPollDto[]>([]);
  protected readonly links = signal<InviteLinkDto[]>([]);
  protected readonly characters = signal<CharacterDto[]>([]);
  // Revue de code (Story 29.15) : `characters()` démarre à `[]` et n'est peuplé que tardivement
  // dans `ngOnInit()` (après `loadMembers`/`loadActivePolls`/`announcements`), alors que `partie()`
  // (qui déclenche le rendu du tab group) l'est bien plus tôt. Sans ce garde, un joueur ayant déjà
  // un personnage atterrissait brièvement sur "Ma fiche" (CTA de création visible) avant d'être
  // basculé silencieusement vers "Détails" une fois `characters()` chargé — flicker/redirection non
  // désirée. `canCreateCharacter` exige désormais ce signal avant de statuer.
  protected readonly charactersLoaded = signal(false);
  protected readonly xpDistributions = signal<XpDistributionDto[]>([]);
  protected readonly showXpPanel = signal(false);
  protected readonly showAnnouncementForm = signal(false);
  // Story 9.2 : liste complète (campagne + scopée) chargée une fois, filtrée côté client par
  // consommateur (AD-6 — même principe que activePolls/ScenariosService.listAll()).
  protected readonly announcements = signal<AnnouncementDto[]>([]);
  // Story 29.13 (révision) : id transmis en query param par le bandeau du Shell — consommé une
  // seule fois dès que l'annonce apparaît dans campaignAnnouncements() (cf. effect() au constructeur).
  private pendingScrollAnnouncementId = this.route.snapshot.queryParamMap.get('announcementId');
  private announcementsReqId = 0;
  private characterRolesReqId = 0;
  // Story 27.3 : liste des rôles de groupe assignés sur cette Partie, chargée une fois puis
  // rafraîchie sur le signal temps réel (même principe que announcements/characters).
  protected readonly characterRoles = signal<CharacterGroupRoleDto[]>([]);
  protected readonly campaignAnnouncements = computed(() =>
    this.announcements().filter((a) => a.scenarioId === null),
  );
  protected readonly campaignScopeLabel = computed(() =>
    this.partie()?.kind === 'ONE_SHOT'
      ? this.theme.tone()['announcement.scope_oneshot_label']
      : this.theme.tone()['announcement.scope_campaign_label'],
  );
  // Story 29.13 (révision) : le marquage « vue » se déclenche sur un clic explicite de l'utilisateur
  // sur AnnonceCard (opened()), plus au simple affichage.
  protected readonly unseenAnnouncementIds = computed(
    () => new Set(this.unseenAnnouncementsSvc.unseenAnnouncements().map((a) => a.id)),
  );
  protected readonly gameSystemContent = signal<GameSystemContentDto | null>(null);
  protected readonly search = signal('');
  protected readonly results = signal<UserSearchResultDto[]>([]);
  // Story 32.1 : minuteur du debounce d'autocomplétion — annulé/réarmé à chaque frappe, jamais lu
  // ailleurs qu'ici et dans le nettoyage à la destruction du composant.
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly notice = signal<string | null>(null);
  protected readonly inviteEmail = signal('');
  protected readonly invitingByEmail = signal(false);
  protected readonly inviteEmailError = signal<string | null>(null);
  protected readonly referenceAssetError = signal<string | null>(null);
  protected readonly downloadingReferenceAsset = signal(false);
  protected readonly prepAssetError = signal<string | null>(null);
  protected readonly downloadingPrepAsset = signal(false);

  /** Story 38.2/38.4 : un ralliement n'a ni
   *  scénario, ni personnage, ni annonce, ni rôle de groupe — le serveur refuse ces lectures (403).
   *  Les chargements qui en dépendent sont donc sautés, sans quoi la page d'un ralliement fraîchement
   *  créé lèverait des erreurs. */
  protected readonly isRalliement = computed(
    () => familyOf(this.partie()?.gameSystemId ?? '') === 'ralliement',
  );

  /** Story 39.1 : un groupe (ralliement `CAMPAGNE_EPISODIQUE`) s'ouvre sur ses conjonctions. Dérivé
   *  de la famille et de la nature — jamais d'un id de système codé en dur. Une rencontre unique
   *  (`ONE_SHOT`) est une soirée isolée (`isSoiree`). */
  protected readonly isGroup = computed(
    () => this.isRalliement() && this.partie()?.kind === 'CAMPAGNE_EPISODIQUE',
  );

  /** Story 41.1 : une soirée isolée (ralliement `ONE_SHOT`) s'ouvre sur le détail EN LIGNE de son
   *  unique événement : pas de liste, pas d'onglet « Détails ». Même dérivation que `isGroup`
   *  (famille + nature, jamais un id de système codé en dur). */
  protected readonly isSoiree = computed(
    () => this.isRalliement() && this.partie()?.kind === 'ONE_SHOT',
  );

  /** Story 41.4 : une soirée terminée (close ou date passée, `status` du serveur) est figée — ni invitation,
   *  ni « Retirer », ni « Modifier » ; le serveur refuse aussi (400). */
  protected readonly isSoireeFinished = computed(
    () => this.isSoiree() && ['TERMINEE', 'ANNULEE'].includes(this.partie()?.status ?? ''),
  );
  /** Story 42.2 : une soirée annulée (statut `ANNULEE` du serveur) est figée comme une terminée, et ne peut ni
   *  être close, ni rouverte, ni renommée — le bandeau dit « annulée », jamais « terminée ». */
  protected readonly isSoireeCancelled = computed(
    () => this.isSoiree() && this.partie()?.status === 'ANNULEE',
  );
  protected readonly isSoireeOpen = computed(() => this.isSoiree() && !this.isSoireeFinished());

  /** Story 49.1 : nombre de jeux sur place de la soirée, remonté par son onglet (`null` tant qu'il n'est pas lu). */
  protected readonly soireeGamesCount = signal<number | null>(null);
  /** Libellé du troisième onglet d'une soirée à venir : « Reliques · 6 » (thème), sans compte avant la première lecture. */
  protected readonly soireeGamesTabLabel = computed(() => {
    const count = this.soireeGamesCount();
    const tone = this.theme.tone();
    return count === null
      ? tone['event_games.tab']
      : fillTone(tone['event_games.tab_count'], { n: count });
  });

  /** Libellé du second onglet d'un ralliement : « Missives » (thème) pour un groupe ; pour une soirée
   *  isolée, « Invitations » côté hôte (administrateur) et « Invités » côté invité (Story 41.1). */
  protected readonly membersTabLabel = computed(() => {
    const tone = this.theme.tone();
    if (!this.isSoiree()) return tone['partie.invitations_tab_label'];
    return this.partie()?.role === 'admin'
      ? tone['partie.ralliement_soiree_invitations_tab']
      : tone['partie.ralliement_soiree_guests_tab'];
  });

  /** Le MJ a accès à l'invitation et à la gestion des membres/liens. Jamais dans un ralliement :
   *  son créateur y est `admin` (rôle serveur), pas MJ — sa page et ses actions sont celles de sa famille (Story 38.4). */
  protected readonly isMj = computed(
    () => this.partie()?.ownerId === this.auth.currentUser()?.id && !this.isRalliement(),
  );

  /** Story 39.3 : l'administrateur d'un GROUPE invite (pseudo, e-mail, lien) et retire un membre
   *  depuis « Missives ». Le rôle vient du serveur (`PartieDto.role`), jamais de `ownerId` : un groupe
   *  compte plusieurs administrateurs. La rencontre isolée n'a pas cette interface (epic 41). */
  protected readonly canInviteMembers = computed(
    () => (this.isGroup() || this.isSoireeOpen()) && this.partie()?.role === 'admin',
  );

  /** Story 39.4 : l'utilisateur courant est administrateur de ce GROUPE (jamais d'une rencontre
   *  isolée, ni d'une quête). Même condition que `canInviteMembers`, nommée pour ce qu'elle dit ici :
   *  nommer un administrateur, quitter l'office. */
  protected readonly isGroupAdmin = computed(
    () => this.isGroup() && this.partie()?.role === 'admin',
  );

  /** Story 39.4 : nombre de conjonctions du groupe, pour l'avertissement du dernier administrateur.
   *  Story 40.1 : nombre RÉEL (passées comprises), remonté par l'onglet des conjonctions à chaque
   *  lecture de la liste. L'onglet n'est monté que lorsqu'il est affiché : l'avertissement relit
   *  donc la liste au moment même (`stepDownFromOffice`) — cette valeur n'est que le repli. */
  protected readonly conjonctionCount = signal(0);

  /** « Retirer » n'est offert que sur un membre ordinaire que le serveur acceptera de retirer : ni
   *  soi-même, ni un administrateur (Story 39.4 : son rôle vient de `members()`). Story 39.5 : c'est
   *  le rôle qui décide, plus `ownerId` — le créateur redevenu simple membre se retire comme les
   *  autres. Sur écran périmé, le serveur refuse quand même (409), message affiché (`removeMember`). */
  protected canRemoveGroupMember(member: PartieMemberDto): boolean {
    return (
      this.canInviteMembers() &&
      member.role !== 'ADMIN' &&
      member.userId !== this.auth.currentUser()?.id
    );
  }

  /** Story 39.5 : « Quitter le groupe » n'est offert qu'au simple membre d'un GROUPE. Un
   *  administrateur quitte d'abord l'office (UX : les membres partent, les admins se démettent) ; la
   *  rencontre isolée n'a pas cette action (epic 41). */
  protected readonly canLeaveGroup = computed(
    () => this.isGroup() && this.partie()?.role === 'member',
  );

  /** Story 39.4 : « Nommer admin » sur chaque membre ordinaire, pour l'administrateur d'un groupe. */
  protected canAppointAdmin(member: PartieMemberDto): boolean {
    return this.isGroupAdmin() && member.role === 'MEMBER';
  }

  /** Story 39.4 : « Quitter l'office » sur SA PROPRE ligne d'administrateur. */
  protected canStepDown(member: PartieMemberDto): boolean {
    return (
      this.isGroupAdmin() &&
      member.role === 'ADMIN' &&
      member.userId === this.auth.currentUser()?.id
    );
  }

  /** Libellé de l'outil d'invitation : clé `partie.<nom>` pour une quête, variante
   *  `partie.ralliement_<nom>` pour un ralliement (aucun mot de JDR hors de la famille JDR). */
  protected inviteTone(name: string): string {
    const tone = this.theme.tone();
    return this.isRalliement() ? tone[`partie.ralliement_${name}`] : tone[`partie.${name}`];
  }

  /** Story 32.2 (revue de code) : la zone Consultation de l'onglet Détails ne doit jamais se rendre
   *  avec un titre de zone et aucun contenu — un joueur sans annonce de campagne ni bandeau
   *  transitoire n'a ni `notice()`, ni `isMj()` (historique d'XP), ni `campaignAnnouncements()`. */
  protected readonly hasConsultationContent = computed(
    () => !!this.notice() || this.isMj() || this.campaignAnnouncements().length > 0,
  );

  /** Personnages de l'utilisateur courant sur cette partie (pas ceux des autres joueurs). */
  protected readonly myCharacters = computed(() => {
    const userId = this.auth.currentUser()?.id;
    return this.characters().filter((c) => c.userId === userId);
  });

  /** Story « Fiches » : tous les personnages de la partie, le sien en tête — alimente l'onglet
   *  générique (distinct de `myCharacters`, toujours utilisé par `canCreateCharacter`). Revue de
   *  code : partitionne `characters()` à partir des ids déjà présents dans `myCharacters()` plutôt
   *  que de refiltrer indépendamment sur `userId` — une seule définition de « mine », jamais deux
   *  risquant de diverger si l'une change sans l'autre. */
  protected readonly charactersSelfFirst = computed(() => {
    const mine = this.myCharacters();
    const mineIds = new Set(mine.map((c) => c.id));
    const others = this.characters().filter((c) => !mineIds.has(c.id));
    return [...mine, ...others];
  });

  protected readonly characterName = characterName;

  /** Prédicat unique (Story 29.15) : pas MJ · aucun personnage sur cette partie · système avec la
   *  capacité `characters` (Story 37.5, registre) · partie non terminée. Réutilisé tel quel par
   *  la visibilité du bouton de création, l'onglet par défaut et le tooltip du slot roster —
   *  jamais réécrit ailleurs (réutilisé tel quel par la story 29.16). */
  protected readonly canCreateCharacter = computed(() => {
    const p = this.partie();
    return (
      !!p &&
      this.charactersLoaded() &&
      !this.isMj() &&
      this.myCharacters().length === 0 &&
      hasCapability(p.gameSystemId, 'characters') &&
      p.status !== 'TERMINEE'
    );
  });

  /** `isMatched` est synchrone — évite un flash d'un rendu desktop sur un premier chargement mobile. */
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(PartieDetail.DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(PartieDetail.DESKTOP_QUERY) },
  );

  /** Liens d'invitation actifs uniquement — un lien révoqué ne doit plus jamais s'afficher (cf. AC6). */
  protected readonly activeLinks = computed(() => this.links().filter((l) => !l.revoked));

  /** Membres autres que le MJ — utilisé pour l'action « Retirer » dans l'onglet Invitations. */
  protected readonly otherMembers = computed(() => {
    const ownerId = this.partie()?.ownerId;
    return this.members().filter((m) => m.userId !== ownerId);
  });

  /** AC3 : ambiguïté calculée sur `members()` en entier (pas `otherMembers()`) — détection
   *  cohérente entre la Troupe mobile et la gestion des membres (deux vues du même roster). */
  protected readonly ambiguousMembers = computed(() => ambiguousUserIds(this.members()));

  protected isMemberAmbiguous(userId: string): boolean {
    return this.ambiguousMembers().has(userId);
  }

  /** ⚠️ Story 48.3 : la Ludothèque ouverte par le nom d'un membre (`null` = fermée). */
  protected readonly library = signal<{
    userId: string;
    name: string;
    trigger: HTMLElement;
  } | null>(null);

  /** Nom montré d'un membre ; deux homonymes sont départagés par leur pseudo, comme dans la ligne. */
  private libraryNameOf(member: PartieMemberDto): string {
    return this.isMemberAmbiguous(member.userId)
      ? `${member.displayName} (${member.pseudo})`
      : member.displayName;
  }

  protected libraryOpenAria(member: PartieMemberDto): string {
    return fillTone(this.theme.tone()['board_games.open_aria'], {
      nom: this.libraryNameOf(member),
    });
  }

  protected openLibrary(member: PartieMemberDto, event: Event): void {
    this.library.set({
      userId: member.userId,
      name: this.libraryNameOf(member),
      trigger: event.currentTarget as HTMLElement,
    });
  }

  protected closeLibrary(): void {
    this.library.set(null);
  }

  /** FR-4b/AC1 : l'utilisateur courant partage-t-il son nom affiché avec un autre membre — joueur
   *  ou MJ (jamais un `Membership`, cf. Découverte story 28.3, comparé séparément via `partie().ownerDisplayName`) ? */
  protected readonly homonymousWith = computed(() => {
    const me = this.auth.currentUser();
    const p = this.partie();
    if (!me) return false;
    const displayName = me.displayName;
    if (this.members().some((m) => m.userId !== me.id && m.displayName === displayName))
      return true;
    return !!p && p.ownerId !== me.id && p.ownerDisplayName === displayName;
  });

  /** Mémorisé en `sessionStorage` (pas de préférence compte persistée, AC2) — s'efface à la
   *  fermeture de l'onglet, l'avertissement peut alors réapparaître dans une nouvelle session. */
  protected readonly homonymyDismissed = signal(false);

  private homonymyStorageKey(partieId: string, userId: string): string {
    return `homonymy-dismissed:${partieId}:${userId}`;
  }

  /** Revue de code : `sessionStorage` peut lever (navigation privée Safari ancienne génération,
   *  iframe sandboxée, politique de blocage du stockage) — ne doit jamais faire échouer le
   *  chargement de la page ni l'action « Ignorer », juste dégrader silencieusement. */
  private readHomonymyDismissed(partieId: string, userId: string): boolean {
    try {
      return !!sessionStorage.getItem(this.homonymyStorageKey(partieId, userId));
    } catch {
      return false;
    }
  }

  protected dismissHomonymyWarning(): void {
    const p = this.partie();
    const me = this.auth.currentUser();
    if (!p || !me) return;
    try {
      sessionStorage.setItem(this.homonymyStorageKey(p.id, me.id), '1');
    } catch {
      // Dégradation silencieuse : le bandeau reste ignoré pour ce rendu, mais réapparaîtra
      // potentiellement à la prochaine navigation si le stockage reste inaccessible.
    }
    this.homonymyDismissed.set(true);
  }

  /** Onglet "Ma fiche" sélectionné par défaut quand il reste à créer son personnage (même prédicat
   *  que le bouton, desktop et mobile confondus, Story 29.15) ; sinon "Détails" (index 0) — le MJ
   *  n'a jamais cet onglet, donc toujours "Détails" par défaut. */
  protected readonly defaultTabIndex = computed(() => (this.canCreateCharacter() ? 1 : 0));

  private readonly manualTabIndex = signal<number | null>(null);

  protected readonly selectedTabIndex = computed(
    () => this.manualTabIndex() ?? this.defaultTabIndex(),
  );

  /** Détermine l'ensemble des onglets rendus — un changement invalide toute sélection manuelle
   *  antérieure. Ne dépend plus de l'appareil (Story 29.15) : l'onglet "Ma fiche" se rend
   *  désormais pour tout joueur non-MJ, desktop compris — seul le rôle MJ/joueur fait varier le
   *  jeu d'onglets. */
  private readonly tabSetKey = computed(() => `${this.isMj()}`);

  protected onTabIndexChange(index: number): void {
    this.manualTabIndex.set(index);
  }

  /** Ouvre l'onglet Invitations depuis le slot "+ Inviter" du roster (MJ uniquement — seul rôle où cet onglet existe). */
  protected openInvitationsTab(): void {
    if (this.isMj()) this.manualTabIndex.set(MJ_INVITATIONS_TAB_INDEX);
  }

  protected onSelectRosterCharacter(event: { characterId: string }): void {
    const p = this.partie();
    if (p) this.openCharacterSheet(p.id, event.characterId);
  }

  /** Slot "créer mon personnage" du roster desktop (joueur sans personnage sur cette partie) —
   *  seul point d'entrée équivalent au CTA de l'onglet "Ma fiche" (mobile) sur cette vue. Revue de
   *  code (Story 29.15) : le slot reste toujours visible (initiale/avatar + aria-label
   *  `roster.create_slot_label`) mais ne doit naviguer que dans les mêmes conditions que ce CTA —
   *  même prédicat `canCreateCharacter()`, jamais réécrit ailleurs. */
  protected createCharacter(p: PartieDto): void {
    if (!this.canCreateCharacter()) return;
    void this.router.navigate(['/parties', p.id, 'characters', 'new'], {
      queryParams: { gameSystemId: p.gameSystemId },
    });
  }

  /** Label de classe résolu depuis le contenu seedé (jamais codé en dur). */
  protected classLabel(character: CharacterDto): string {
    const classId = (character.sheetData as { classId?: string })?.classId;
    const entry = findContentEntry<{ label?: string }>(this.gameSystemContent(), 'class', classId);
    return entry?.label ?? '';
  }

  /** Champ fonction stable (pas une méthode liée) pour l'input `classLabelFor` de RosterRail/RosterStrip. */
  protected readonly classLabelFor = (character: CharacterDto): string =>
    this.classLabel(character);

  /** Libellé du rôle de groupe assigné à ce personnage, ou null (Story 27.3) — réutilise
   *  `findContentEntry`/`gameSystemContent` déjà en place pour `classLabelFor`, aucun nouveau fetch. */
  protected readonly roleLabelFor = (character: CharacterDto): string | null => {
    const role = this.characterRoles().find((r) => r.characterId === character.id);
    if (!role) return null;
    // Revue de code : .trim() — un libellé de catalogue mal saisi avec un espace de tête/fin ne
    // doit jamais produire un badge visuellement vide (charAt(0) = espace) tout en restant "truthy".
    const label = findContentEntry<{ label?: string }>(
      this.gameSystemContent(),
      'groupRole',
      role.roleKey,
    )?.label?.trim();
    return label || null;
  };

  constructor() {
    // Story 29.4 : bandeau contextuel — réactif (partie() se résout de façon asynchrone), pas un
    // simple appel statique dans ngOnInit(). Correction post-test : le sous-titre porte le
    // système de jeu et le type de partie (ex. « Ryuutama · Campagne épisodique ») — portait
    // auparavant le rôle MJ, retiré du bandeau (déjà visible via les actions MJ-only de l'écran).
    // Reprend le mat-card-header retiré de la carte (partie-detail.html) plutôt que de dupliquer.
    effect(() => {
      const p = this.partie();
      if (!p) return;
      this.contextualNav.set({
        title: p.name,
        // Story 38.2/38.4 : un ralliement dit sa nature avec ses propres mots (jamais "Quête unique")
        // et son préfixe est celui du thème (Ralliement / Veillée / Rassemblement), pas le nom du
        // registre — « Ralliement · La convergence des Sortilèges ».
        subtitle: this.isRalliement()
          ? `${this.theme.tone()['partie.mode_ralliement']} · ${
              this.theme.tone()[`partie.ralliement_kind_${p.kind}`] ?? p.kind
            }`
          : `${this.system(p.gameSystemId)} · ${this.kind(p.kind)}`,
      });
    });

    effect(() => {
      // Story 39.3 : l'administrateur d'un groupe liste lui aussi les liens d'invitation.
      if (this.isMj() || this.canInviteMembers()) void this.loadLinks();
    });

    effect(() => {
      if (this.isMj()) void this.loadXpDistributions();
    });

    // Revue de code (bmad-review, 2026-09-21) : `tabSettled` figé une seule fois par « session » de
    // rôle MJ/joueur (réarmé par tabSetKey ci-dessous), pas suivi en continu. Sans ce gel,
    // `defaultTabIndex()` restant réactif à `canCreateCharacter()`, un joueur déjà en train de lire
    // « Détails » pouvait être basculé vers « Ma fiche » sans avoir rien demandé dès que
    // `charactersLoaded()` passait à `true` (ou plus tard, si `canCreateCharacter()` change encore
    // en cours de visite, ex. personnage créé ailleurs et rechargé par le signal temps réel) — AC1
    // ne couvre que l'atterrissage initial, pas une bascule surprise ultérieure.
    let tabSettled = false;
    effect(() => {
      this.tabSetKey();
      untracked(() => {
        this.manualTabIndex.set(null);
        tabSettled = false;
      });
    });

    effect(() => {
      if (tabSettled || !this.charactersLoaded()) return;
      tabSettled = true;
      untracked(() => {
        if (this.manualTabIndex() === null) this.manualTabIndex.set(this.defaultTabIndex());
      });
    });

    // Story 18.3 : remplace le patch visibilitychange (retour de focus d'onglet, bug-fix
    // 2026-07-17, AC2 — un seul mécanisme de rafraîchissement pour ce composant) par le signal
    // temps réel SSE. `id` vient du snapshot de route, lu une seule fois (même limitation
    // préexistante que `ngOnInit`, qui fait de même) : si Angular réutilisait cette instance de
    // composant sur un simple changement de `:id` (comportement par défaut pour une route
    // `parties/:id` sans `RouteReuseStrategy` custom — vérifié, aucune n'est déclarée dans cette
    // app), la connexion resterait liée à l'ancien id. Aucun parcours de navigation actuel de
    // l'app ne déclenche ce cas (pas de lien direct d'une Partie vers une autre) — limitation
    // connue, différée (revue de code Story 18.3, voir deferred-work.md), pas propre au SSE.
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.realtime.connect(partieTopic(id));
      this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(id)));
    }

    // Story 32.1 : déclenchement automatique de la recherche d'invitation au fil de la frappe,
    // debounced à 500 ms, sous garde de longueur minimale (2 caractères) — le bouton/(keyup.enter)
    // restent un déclenchement manuel de secours (runSearch() applique la même garde).
    effect(() => {
      const q = this.search();
      untracked(() => {
        if (this.searchDebounceTimer !== null) {
          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = null;
        }
        if (q.trim().length < SEARCH_MIN_LENGTH) {
          this.results.set([]);
          return;
        }
        this.searchDebounceTimer = setTimeout(() => {
          this.searchDebounceTimer = null;
          void this.runSearch();
        }, SEARCH_DEBOUNCE_MS);
      });
    });
    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
    });
    // Garde firstRun (même piège que partout ailleurs, cf. l'effect characterSvc.changed() juste
    // en dessous) : le signal peut déjà porter une valeur avant le montage — sans cette garde,
    // refreshPartie()/loadMembers() étaient rechargés une seconde fois inutilement au montage, en
    // plus du chargement initial.
    let firstRunParties = true;
    effect(() => {
      this.parties.changed();
      if (firstRunParties) {
        firstRunParties = false;
        return;
      }
      // Bug fix (temps réel) : un nouveau membre (invitation acceptée, lien rejoint) n'apparaissait
      // jamais dans le roster/l'onglet Invitations sans recharger — étend le rechargement déjà
      // déclenché ici sur tout événement partie: (même wildcard générique que refreshPartie()) à
      // la liste des membres.
      untracked(() => {
        void this.refreshPartie();
        void this.loadMembers();
      });
    });

    // Bug fix (temps réel) : le MJ ne voyait jamais apparaître un personnage nouvellement créé par
    // un joueur sans recharger — CharacterService.changed() est un simple compteur (comme dans
    // CharacterSheet), aucun filtrage matchesPartie possible/nécessaire ici. Garde firstRun (même
    // piège que partout ailleurs) : le signal peut déjà porter une valeur avant le montage.
    let firstRunCharacters = true;
    effect(() => {
      this.characterSvc.changed();
      if (firstRunCharacters) {
        firstRunCharacters = false;
        return;
      }
      untracked(() => void this.reloadCharacters());
    });

    // Bug fix (temps réel, production) : un nouveau sondage de date créé sur une Séance pendant
    // que cette page est déjà ouverte n'apparaissait jamais dans le widget "Vote ouvert"
    // (activePolls n'était chargé qu'une fois dans ngOnInit). Même garde `matchesPartie` que
    // CalendarView/ScenarioEditor/ScenarioList pour ce même signal.
    let firstRunScenarios = true;
    effect(() => {
      const change = this.scenariosSvc.changed();
      if (firstRunScenarios) {
        firstRunScenarios = false;
        return;
      }
      if (!id || !matchesPartie(change, id)) return;
      untracked(() => void this.loadActivePolls(id));
    });

    // Bug fix (temps réel, production) : une annonce publiée par le MJ (ou dans un autre onglet)
    // n'apparaissait jamais sans recharger la page — AnnouncementsService n'était pas câblé au
    // signal temps réel.
    let firstRunAnnouncements = true;
    effect(() => {
      this.announcementsSvc.changed();
      if (firstRunAnnouncements) {
        firstRunAnnouncements = false;
        return;
      }
      untracked(() => void this.reloadAnnouncements());
    });

    // Story 27.3 : un rôle de groupe assigné/retiré par le MJ n'apparaissait jamais dans le
    // roster des autres membres déjà sur la page sans recharger — même garde firstRun que les
    // autres effects temps réel de ce composant.
    let firstRunCharacterRoles = true;
    effect(() => {
      this.characterRolesSvc.changed();
      if (firstRunCharacterRoles) {
        firstRunCharacterRoles = false;
        return;
      }
      untracked(() => void this.reloadCharacterRoles());
    });

    // Story 29.13 (révision du 2026-08-13, retour utilisateur) : clic sur le bandeau du Shell —
    // force l'onglet "Détails" (0, où vivent les annonces de campagne) puis défile jusqu'à
    // l'annonce visée dès qu'elle apparaît dans campaignAnnouncements(). Après `tabSetKey()`
    // (qui remet `manualTabIndex` à `null` uniquement sur un changement de rôle MJ/joueur — plus sur
    // un changement d'appareil/breakpoint desktop-mobile depuis Story 29.15) pour ne pas être écrasé.
    effect(() => {
      const id = this.pendingScrollAnnouncementId;
      if (!id) return;
      const found = this.campaignAnnouncements().some((a) => a.id === id);
      if (!found) return;
      untracked(() => {
        this.pendingScrollAnnouncementId = null;
        this.manualTabIndex.set(0);
        scrollToAnnouncement(id);
      });
    });
  }

  /** Story 29.13 (révision) : « j'ouvre l'annonce » = clic explicite sur AnnonceCard, plus le
   *  simple affichage (qui refermait la notification avant que l'utilisateur n'ait pu la voir). */
  protected markAnnouncementOpened(announcementId: string): void {
    void this.unseenAnnouncementsSvc.markRead(announcementId);
  }

  /** Recharge `characters` seul (roster) — réutilisé par l'effet temps réel et par
   *  `onXpDistributed()` (extrait pour éviter la duplication de `listByPartie(...).catch(...)`).
   *  Bug fix (revue de code) : un échec réseau transitoire ne doit jamais vider le roster affiché —
   *  même risque déjà corrigé pour `MyPartiesService` (garder le dernier état connu bon). */
  private async reloadCharacters(): Promise<void> {
    const p = this.partie();
    if (!p || this.isRalliement()) return;
    try {
      this.characters.set(await this.characterSvc.listByPartie(p.id));
    } catch {
      // Échec transitoire : on garde le dernier état connu bon, pas de `.set([])`.
    }
  }

  /** Recharge `partie` sans re-déclencher tout `ngOnInit` (membres/scénarios/annonces restent
   *  inchangés) — évite un aller-retour réseau superflu pour des données qui ont leurs propres
   *  chemins de rafraîchissement déjà établis (`loadMembers`, `onAnnouncementPublished`, etc.). */
  private async refreshPartie(): Promise<void> {
    const id = this.partie()?.id;
    if (!id) return;
    this.partie.set(await this.parties.get(id));
  }

  /** Libellé formaté de la prochaine séance, ou null si aucune date confirmée. */
  protected readonly nextSessionLabel = computed(() => {
    const p = this.partie();
    if (!p?.nextSessionDate) return null;
    try {
      const d = new Date(p.nextSessionDate);
      const date = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
        .format(d)
        .toLocaleLowerCase('fr-FR');
      const slot = p.nextSessionSlot ? ` — ${SLOT_LABELS[p.nextSessionSlot]}` : '';
      const start = `${date}${slot}`;
      // Story 47.2 : une plage de plusieurs créneaux se lit « début → fin ».
      const end = p.nextSessionEndDate;
      const sameDay = !end || end.substring(0, 10) === p.nextSessionDate.substring(0, 10);
      const sameSlot = (p.nextSessionEndSlot ?? p.nextSessionSlot) === p.nextSessionSlot;
      if (!end || (sameDay && sameSlot)) return start;
      const endLabel = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
        .format(new Date(end))
        .toLocaleLowerCase('fr-FR');
      const endSlot = p.nextSessionEndSlot ? ` — ${SLOT_LABELS[p.nextSessionEndSlot]}` : '';
      return `${start} → ${endLabel}${endSlot}`;
    } catch {
      return null;
    }
  });

  /** Jour courant figé à la construction — même raison que `CalendarView.todayKey` et
   *  `SeanceList.todayKey` : une seule source de « aujourd'hui » par écran. */
  private readonly todayKey = toDateKey(new Date());

  /**
   * Story 32.3 — l'état du widget « Prochaine séance », porté par le badge partagé.
   *
   * Le widget n'a JAMAIS de `SeanceDto` : il ne connaît que la date agrégée au niveau de la Partie
   * (`nextSessionDate`/`nextSessionSlot`, posées par `recalculateNextSession()`) et les votes
   * actifs. C'est exactement pour ce cas que `seanceState()` prend une forme structurelle plutôt
   * que le DTO complet — fabriquer ici une fausse séance aurait été pire.
   *
   * 🚨 **Une date déjà passée n'est pas remontée.** `recalculateNextSession()` ne retient que le
   * futur, mais un recalcul en retard (SSE manqué) pourrait laisser une date périmée : sans ce
   * filtre, un widget intitulé « Prochaine séance » afficherait « À débriefer », un état qui
   * appartient à la LISTE des séances, pas à lui.
   *
   * 🚨 **Le vote retenu est celui qui attend MA réponse**, s'il y en a un. Avec plusieurs votes
   * actifs, prendre le premier venu masquerait l'appel à l'action — exactement ce que la story
   * cherche à rendre visible.
   */
  protected readonly nextSessionBadge = computed<StatusBadgeState>(() => {
    const p = this.partie();
    const me = this.auth.currentUser()?.id;
    const polls = this.activePolls();
    const pending = me ? polls.find((poll) => hasUnansweredOptions(poll, me)) : undefined;
    const dateKey = p?.nextSessionDate ? p.nextSessionDate.substring(0, 10) : null;
    // Story 47.2 : la prochaine séance peut avoir commencé — c'est la FIN de la plage qui la rend passée.
    const lastKey = (p?.nextSessionEndDate ?? p?.nextSessionDate)?.substring(0, 10) ?? null;
    const scheduled = dateKey && lastKey && lastKey >= this.todayKey ? p!.nextSessionDate : null;
    return seanceState(
      {
        // 🚨 Un vote n'est retenu QUE tant que la prochaine séance n'a pas de date : `activePolls()`
        // est scopé à la PARTIE, pas à une séance. Avec une date confirmée, transmettre un vote
        // ouvert ailleurs ferait afficher « Réponds au vote » sous la date d'une AUTRE séance.
        poll: scheduled ? undefined : (pending ?? polls[0]),
        dateValidee: scheduled,
        slotValidee: p?.nextSessionSlot ?? null,
        endDate: scheduled ? (p?.nextSessionEndDate ?? null) : null,
      },
      me,
      this.todayKey,
    );
  });

  /**
   * Story 44.7 — le lien du joueur vers le calendrier de la partie : avec UN vote ouvert il arrive en Destinée sur
   * ce vote (`?poll`), avec plusieurs il ouvre la liste ✦ (`?pollList`) — c'est à lui de choisir, rien n'est choisi à
   * sa place. Sans vote, le calendrier tout court. Le chemin vient de `atelierPath` : une seule règle de route.
   */
  protected readonly calendarLink = computed(() => {
    const p = this.partie();
    const polls = this.activePolls();
    const commands = [
      atelierPath({
        partieId: p?.id ?? '',
        family: p ? (familyOf(p.gameSystemId) ?? 'jdr') : 'jdr',
        role: 'player',
      }),
    ];
    const queryParams: Record<string, string> =
      polls.length === 1 ? { poll: polls[0].id } : polls.length > 1 ? { pollList: '' } : {};
    return { commands, queryParams };
  });

  protected readonly system = gameSystemName;
  protected readonly kind = (kind: PartieDto['kind']): string =>
    this.theme.tone()[partieKindLabelKey(kind)] ?? kind;

  // Un seul poll actif → détail « X/Y réponses » précis (comportement historique conservé).
  // Plusieurs → l'agrégation par réponse individuelle n'a plus de sens à ce niveau (chaque poll a
  // son propre roster de réponses), le libellé devient un simple compte de votes en cours.
  protected readonly respondedCount = computed(() => {
    const polls = this.activePolls();
    return polls.length === 1 ? getRespondedCount(polls[0], this.members()) : 0;
  });

  protected pollStatusLabel(): string {
    const polls = this.activePolls();
    if (polls.length === 1) {
      // Deferred-work (2026-08-24) : `{total}` prend `poll.membersCount` (MJ compris, valeur
      // serveur), pas `this.members().length` (exclut le MJ, `GET /parties/:id/members` ne lui
      // pose jamais de ligne `Membership`) — même dénominateur que le panneau du calendrier
      // (story 36.6), qui avait le même bug à deux Y avant sa correction.
      return this.theme
        .tone()
        ['poll.status_summary'].replace('{responded}', String(this.respondedCount()))
        .replace('{total}', String(polls[0].membersCount));
    }
    return fillTone(this.theme.tone()['parties.detail_polls_in_progress'], { count: polls.length });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.partie.set(await this.parties.get(id));
    const me = this.auth.currentUser();
    if (me) {
      this.homonymyDismissed.set(this.readHomonymyDismissed(id, me.id));
    }
    await this.loadMembers();
    await this.loadActivePolls(id);
    // Story 38.2 : ces chargements relèvent de capacités du JDR, absentes d'un ralliement.
    if (this.isRalliement()) {
      this.charactersLoaded.set(true);
      return;
    }
    this.announcements.set(await this.announcementsSvc.listAll(id).catch(() => []));
    this.characters.set(await this.characterSvc.listByPartie(id).catch(() => []));
    this.charactersLoaded.set(true);
    this.characterRoles.set(await this.characterRolesSvc.listForPartie(id).catch(() => []));
    this.gameSystemContent.set(
      await this.characterSvc.getGameSystemContent(this.partie()!.gameSystemId).catch(() => null),
    );
    // loadLinks() déclenché réactivement par effect() dans le constructeur
  }

  protected openCharacterSheet(partieId: string, characterId: string): void {
    this.router.navigate(['/parties', partieId, 'characters', characterId]);
  }

  async runSearch(): Promise<void> {
    // Revue de code (Story 32.1) : un déclenchement manuel (bouton/(keyup.enter)) n'annulait jamais
    // le minuteur du debounce — un `runSearch()` redondant pouvait alors partir ~500 ms plus tard.
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    const q = this.search().trim();
    this.notice.set(null);
    // Story 32.1 : garde de longueur minimale avant tout appel réseau — s'applique aussi bien au
    // déclenchement automatique (debounce) qu'au bouton/(keyup.enter) manuel de secours.
    if (q.length < SEARCH_MIN_LENGTH) {
      this.results.set([]);
      return;
    }
    const found = await this.parties.searchUsers(q);
    // Revue de code (Story 32.1) : une réponse plus ancienne peut résoudre après une plus récente
    // (double déclenchement manuel/auto rapproché) — n'applique le résultat que si la saisie n'a pas
    // changé depuis l'appel, sinon une réponse périmée écraserait des résultats déjà plus frais.
    if (this.search().trim() !== q) return;
    // On masque le MJ et les membres déjà présents.
    const memberIds = new Set(this.members().map((m) => m.userId));
    this.results.set(found.filter((u) => u.id !== this.partie()?.ownerId && !memberIds.has(u.id)));
  }

  async invite(user: UserSearchResultDto): Promise<void> {
    const p = this.partie();
    if (!p) return;
    await this.parties.inviteUser(p.id, user.id);
    this.results.update((list) => list.filter((u) => u.id !== user.id));
    this.notice.set(this.theme.tone()['partie.notice_invited'].replace('{name}', user.pseudo));
  }

  async inviteByEmail(): Promise<void> {
    if (this.invitingByEmail()) return; // évite les doubles soumissions (Entrée répétée, double-clic)
    const p = this.partie();
    const email = this.inviteEmail().trim();
    if (!p || !email) return;
    this.invitingByEmail.set(true);
    this.inviteEmailError.set(null);
    try {
      const result = await this.parties.inviteByEmail(p.id, email);
      if (result.ok) {
        this.notice.set(this.theme.tone()['partie.notice_invited_email'].replace('{email}', email));
        this.inviteEmail.set('');
      } else {
        this.inviteEmailError.set(this.theme.tone()['partie.notice_invite_email_error']);
      }
    } catch {
      this.inviteEmailError.set(this.theme.tone()['partie.notice_invite_email_error']);
    } finally {
      this.invitingByEmail.set(false);
    }
  }

  async removeMember(member: PartieMemberDto): Promise<void> {
    const p = this.partie();
    if (!p) return;
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(
          this.theme.tone()[
            this.isRalliement()
              ? 'partie.ralliement_remove_member_confirm'
              : 'parties.detail_remove_member_confirm'
          ],
          { name: member.displayName, partie: p.name },
        ),
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    // Groupe (Story 39.3) : un refus précédent ne doit pas rester affiché après une nouvelle tentative.
    if (this.isRalliement()) this.notice.set(null);
    try {
      await this.parties.removeMember(p.id, member.userId);
    } catch (error) {
      // Groupe : « Retirer » n'est jamais offert sur un administrateur (Story 39.4), mais un écran
      // périmé (membre nommé entre-temps, droits changés) peut encore recevoir un refus du serveur —
      // message en français, affiché tel quel, sinon repli sur le libellé du thème. Quête :
      // comportement inchangé (l'erreur remonte).
      if (!this.isRalliement()) throw error;
      this.notice.set(
        this.refusalMessage(error, this.theme.tone()['partie.ralliement_remove_member_error']),
      );
      // La liste est rechargée : l'échec peut venir d'un état périmé (membre déjà parti, droits changés).
      await this.loadMembers();
      return;
    }
    await this.loadMembers();
  }

  /** Message de refus renvoyé par le serveur (texte français), ou le libellé de repli du thème quand
   *  la réponse n'en porte pas de textuel (réseau, 403, 404, message en tableau). */
  private refusalMessage(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: unknown } } | null)?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  /** Story 39.4 : l'administrateur d'un groupe en nomme un autre. Confirmation, puis rechargement de
   *  la liste (le rôle change, « Retirer » disparaît de la ligne). Un refus du serveur est affiché. */
  async appointAdmin(member: PartieMemberDto): Promise<void> {
    const p = this.partie();
    if (!p || !this.canAppointAdmin(member)) return;
    const tone = this.theme.tone();
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(tone['partie.ralliement_appoint_confirm'], {
          name: member.displayName,
          partie: p.name,
        }),
        confirmLabel: tone['partie.ralliement_appoint_btn'],
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.notice.set(null);
    try {
      await this.parties.setMemberRole(p.id, member.userId, { role: 'ADMIN' });
    } catch (error) {
      this.notice.set(this.refusalMessage(error, tone['partie.ralliement_role_error']));
    }
    await this.loadMembers();
  }

  /** Story 39.4 : l'administrateur d'un groupe quitte l'office (reste membre). S'il en est le DERNIER
   *  (compte tiré de `members()`), la confirmation annonce la suppression du groupe, en rouge, et
   *  seule celle-ci envoie `deleteIfLastAdmin`. Le serveur reste juge : une réponse `deleted` renvoie
   *  à l'accueil, sinon la page recharge la partie (rôle `member`, outils d'administrateur retirés). */
  async stepDownFromOffice(): Promise<void> {
    const p = this.partie();
    const me = this.auth.currentUser();
    if (!p || !me || !this.isGroupAdmin()) return;
    const tone = this.theme.tone();
    // Liste relue AVANT de choisir la confirmation : une liste vide (pas encore chargée) ou périmée
    // ferait annoncer — ou taire — la suppression du groupe à tort. Le serveur reste juge.
    this.notice.set(null);
    try {
      await this.loadMembers();
    } catch (error) {
      this.notice.set(this.refusalMessage(error, tone['partie.ralliement_role_error']));
      return;
    }
    const adminCount = this.members().filter((m) => m.role === 'ADMIN').length;
    const lastAdmin = adminCount <= 1;
    // Story 40.1 : le nombre réel de conjonctions est relu ici (l'onglet des conjonctions peut ne
    // jamais avoir été affiché) ; un échec retombe sur la dernière valeur connue.
    if (lastAdmin) {
      try {
        this.conjonctionCount.set((await this.eventsApi.list(p.id)).length);
      } catch {
        // repli : dernière valeur connue
      }
    }
    const ref = this.dialog.open(ConfirmDialog, {
      data: lastAdmin
        ? {
            message: fillTone(tone['partie.ralliement_last_admin_confirm'], {
              partie: p.name,
              members: this.members().length,
              conjonctions: this.conjonctionCount(),
            }),
            confirmLabel: tone['partie.ralliement_last_admin_btn'],
            destructive: true,
          }
        : {
            message: fillTone(tone['partie.ralliement_step_down_confirm'], { partie: p.name }),
            confirmLabel: tone['partie.ralliement_step_down_btn'],
          },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.notice.set(null);
    try {
      const result = await this.parties.setMemberRole(
        p.id,
        me.id,
        lastAdmin ? { role: 'MEMBER', deleteIfLastAdmin: true } : { role: 'MEMBER' },
      );
      if (result.deleted) {
        // Le groupe n'existe plus : un échec du rafraîchissement de la liste ne change rien à la suite.
        try {
          await this.myPartiesSvc.refreshAll();
        } catch {
          // non bloquant : la liste d'accueil se rechargera à l'arrivée
        }
        void this.router.navigate(['/']);
        return;
      }
    } catch (error) {
      this.notice.set(this.refusalMessage(error, tone['partie.ralliement_role_error']));
    }
    // Succès ou refus sur écran périmé : rôle et liste sont relus depuis le serveur.
    await Promise.all([this.refreshPartie(), this.loadMembers()]);
  }

  /** Story 39.5 : un simple membre quitte le groupe. Confirmation (bouton NON rouge : une nouvelle
   *  invitation le ramène, ce n'est pas irréversible), puis liste d'accueil rafraîchie et retour à
   *  l'accueil. Un refus du serveur est affiché dans l'avis du groupe, et la page relue (rôle changé
   *  entre-temps). */
  async leaveGroup(): Promise<void> {
    const p = this.partie();
    if (!p || !this.canLeaveGroup()) return;
    const tone = this.theme.tone();
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(tone['partie.ralliement_leave_confirm'], { partie: p.name }),
        confirmLabel: tone['partie.ralliement_leave_btn'],
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.notice.set(null);
    try {
      await this.parties.leave(p.id);
    } catch (error) {
      this.notice.set(this.refusalMessage(error, tone['partie.ralliement_leave_error']));
      try {
        await Promise.all([this.refreshPartie(), this.loadMembers()]);
      } catch {
        // non bloquant : l'avis reste affiché, l'état sera relu au prochain changement
      }
      return;
    }
    // Le départ est enregistré : un échec du rafraîchissement de la liste ne change rien à la suite.
    try {
      await this.myPartiesSvc.refreshAll();
    } catch {
      // non bloquant : la liste d'accueil se rechargera à l'arrivée
    }
    void this.router.navigate(['/']);
  }

  async createLink(): Promise<void> {
    const p = this.partie();
    if (!p) return;
    await this.parties.createInviteLink(p.id, {});
    await this.loadLinks();
  }

  async revokeLink(link: InviteLinkDto): Promise<void> {
    await this.parties.revokeInviteLink(link.id);
    await this.loadLinks();
  }

  joinUrl(token: string): string {
    return `${location.origin}/join/${token}`;
  }

  async copyLink(token: string): Promise<void> {
    await navigator.clipboard?.writeText(this.joinUrl(token));
    this.notice.set(this.theme.tone()['partie.notice_copy']);
  }

  /** Réversible (AC2) — pas de `ConfirmDialog`, contrairement à `confirmDelete()` (irréversible).
   *  Mise à jour directe du signal local, même immédiateté que `invite()`/`createLink()`. */
  async closeGame(p: PartieDto): Promise<void> {
    this.partie.set(await this.parties.close(p.id));
  }

  async reopenGame(p: PartieDto): Promise<void> {
    this.partie.set(await this.parties.reopen(p.id));
  }

  async confirmDelete(p: PartieDto): Promise<void> {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(this.theme.tone()['parties.detail_delete_confirm'], { partie: p.name }),
        // Story 39.4 (UX-DR11) : irréversible, donc le bouton de confirmation est rouge.
        destructive: true,
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    await this.parties.remove(p.id);
    await this.myPartiesSvc.refreshAll();
    void this.router.navigate(['/']);
  }

  private async loadMembers(): Promise<void> {
    const p = this.partie();
    if (p) this.members.set(await this.parties.members(p.id));
  }

  private async loadActivePolls(partieId: string): Promise<void> {
    // Story 38.2 : pas de scénario ni de vote dans un ralliement (lecture refusée par le serveur).
    if (this.isRalliement()) return;
    try {
      const scenarios = await this.scenariosSvc.listAll(partieId);
      const polls: SessionPollDto[] = [];
      for (const scenario of scenarios) {
        for (const seance of scenario.seances) {
          if (seance.poll?.status === 'OPEN') polls.push(seance.poll);
        }
      }
      this.activePolls.set(polls);
    } catch {
      // non-bloquant — le bandeau reste utilisable sans la liste des votes actifs
    }
  }

  private async loadLinks(): Promise<void> {
    const p = this.partie();
    if (p) this.links.set(await this.parties.inviteLinks(p.id));
  }

  private async loadXpDistributions(): Promise<void> {
    const p = this.partie();
    if (p) this.xpDistributions.set(await this.parties.listXpDistributions(p.id));
  }

  /** Après une distribution confirmée : recharge `characters`/`xpDistributions` — c'est le parent
   *  qui recharge, pas le panneau lui-même (AD-10, pas de rechargement indépendant par composant). */
  protected async onXpDistributed(): Promise<void> {
    if (!this.partie()) return;
    this.showXpPanel.set(false);
    await this.reloadCharacters();
    await this.loadXpDistributions();
  }

  /** Story 9.2 : recharge la liste après publication — sans ça, l'annonce fraîchement publiée par
   *  le MJ n'apparaîtrait dans son propre flux qu'au prochain rechargement de page. Réutilisée par
   *  l'effect `announcementsSvc.changed()` (bug fix temps réel, cf. constructeur). */
  protected async onAnnouncementPublished(): Promise<void> {
    await this.reloadAnnouncements();
  }

  private async reloadAnnouncements(): Promise<void> {
    const p = this.partie();
    if (!p || this.isRalliement()) return;
    const reqId = ++this.announcementsReqId;
    const list = await this.announcementsSvc.listAll(p.id).catch(() => this.announcements());
    if (reqId === this.announcementsReqId) this.announcements.set(list);
  }

  /** Story 27.3 : recharge `characterRoles` seul — un échec réseau transitoire ne doit jamais
   *  vider les badges déjà affichés (même discipline que `reloadCharacters()`). Revue de code :
   *  garde d'ordre de requêtes (même pattern que `reloadAnnouncements()`) — deux événements
   *  `changed()` rapprochés ne doivent jamais laisser une réponse périmée écraser un état plus frais. */
  private async reloadCharacterRoles(): Promise<void> {
    const p = this.partie();
    if (!p || this.isRalliement()) return;
    const reqId = ++this.characterRolesReqId;
    const list = await this.characterRolesSvc
      .listForPartie(p.id)
      .catch(() => this.characterRoles());
    if (reqId === this.characterRolesReqId) this.characterRoles.set(list);
  }

  /**
   * Story 12.1/12.2 : téléchargement d'une fiche de référence Ryuutama servie telle quelle.
   * `section` scope l'état de chargement/erreur à la section appelante (`.reference-sheets` vs
   * `.prep-sheets`) — deux sections distinctes peuvent coexister sur le même écran (MJ sur une
   * Partie Ryuutama), un état partagé ferait fuiter l'erreur/le disabled de l'une vers l'autre.
   */
  protected async downloadAsset(key: string, section: 'reference' | 'prep'): Promise<void> {
    const p = this.partie();
    const downloading =
      section === 'reference' ? this.downloadingReferenceAsset : this.downloadingPrepAsset;
    const error = section === 'reference' ? this.referenceAssetError : this.prepAssetError;
    if (!p || downloading()) return;
    error.set(null);
    downloading.set(true);
    try {
      const blob = await this.characterSvc.getGameSystemAsset(p.id, p.gameSystemId, key);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${key}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      error.set(this.theme.tone()['partie.asset_download_error']);
    } finally {
      downloading.set(false);
    }
  }
}
