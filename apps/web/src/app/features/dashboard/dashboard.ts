import {
  Component,
  DestroyRef,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import type { StatusBadgeState } from '../../core/status/status-derivation';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../core/icons/app-icon';
import type { IconName } from '../../core/icons/icon-registry.generated';
import { roleIconName } from '../../core/icons/role-icon-name';
import type {
  DaySlot,
  InvitationDto,
  ListViewMode,
  PartieDto,
  PartieRole,
  PartieSort,
  PartieStatus,
  PartySignalCode,
} from '@master-jdr/shared';
import { PARTIE_SORTS, familyOf } from '@master-jdr/shared';
import {
  ListControlBar,
  type ListControlBarSortOption,
} from '../../shared/list-control-bar/list-control-bar';
import { PartyBanner } from '../../shared/party-banner/party-banner';
import { PartyCountdown } from '../../shared/party-countdown/party-countdown';
import { SystemBadge, systemBadgeGlyph } from '../../shared/system-badge/system-badge';
import { countdownProgress } from '../../core/parties/party-countdown.util';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { OpenPollsService } from '../../core/poll/open-polls.service';
import { PartySignalsService } from '../../core/parties/party-signals.service';
import {
  dominantCategory,
  dominantSignal,
  sortByPriority,
} from '../../core/parties/party-signal-priority';
import { pinFavorites, sortParties } from '../../core/parties/party-sort';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccountService } from '../../core/account/account.service';
import { RealtimeService, userTopic } from '../../core/realtime/realtime.service';
import { gameSystemName, partieKindLabelKey } from '../../core/parties/parties.util';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { fillTone } from '../../core/theme/tone-format';
import { firstValueFrom } from 'rxjs';

/** Signaux purement informatifs (jamais une action à faire) — exclus du regroupement « ce qui
 *  t'attend » (Task 7) et de la teinte de priorité (Task 6, cf. party-signal-priority.ts). */
const NON_ACTIONABLE_SIGNALS: readonly PartySignalCode[] = [
  'PROCHAINE_SEANCE_CONNUE',
  'PARTIE_TERMINEE',
  'PARTIE_ANNULEE',
];

/** Au plus 2 badges visibles, le reste résumé par un compteur (AC3). */
const MAX_VISIBLE_BADGES = 2;

/** Même patron que `partie-detail.ts` (SLOT_LABELS) — réutilisé ici pour le badge
 *  `PROCHAINE_SEANCE_CONNUE`, qui doit afficher la date réelle (DESIGN.md §2/mockup
 *  `q8-navigation.html`, ex. « 12 août, soirée »), pas un libellé générique. */
const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée',
};

/** Teinte de carte (DESIGN.md §7.2 StateRail) — les 4 mêmes teintes que la palette de statut du
 *  thème, quel que soit le mode d'affichage. Toujours renseignée : `tiles()` calcule une valeur
 *  pour chaque partie, il n'existe pas de cas « sans teinte ». */
export type TileTint = 'todo' | 'live' | 'soon' | 'done' | 'cancelled';

export interface PartieTileVm {
  partie: PartieDto;
  signals: PartySignalCode[];
  visibleSignals: PartySignalCode[];
  moreCount: number;
  dominant: PartySignalCode | null;
  tint: TileTint;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    AppIcon,
    NgTemplateOutlet,
    ListControlBar,
    PartyBanner,
    PartyCountdown,
    SystemBadge,
    StatusBadge,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly injector = inject(Injector);
  private readonly invitations = inject(InvitationsService);
  private readonly openPollsSvc = inject(OpenPollsService);
  private readonly partySignalsSvc = inject(PartySignalsService);
  protected readonly theme = inject(ThemeToneService);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contextualNav = inject(ContextualNavService);

  protected readonly allParties = this.myPartiesSvc.allParties;
  protected readonly received = signal<InvitationDto[]>([]);
  protected readonly openPolls = this.openPollsSvc.openPolls;
  protected readonly system = gameSystemName;
  protected readonly kind = (kind: PartieDto['kind']): string =>
    this.theme.tone()[partieKindLabelKey(kind)] ?? kind;

  /** Un ralliement n'est pas une quête de JDR : sa famille vient du registre des systèmes, jamais
   *  d'un identifiant en dur (Story 38.5). Un système inconnu retombe sur « quête » (JDR hérité). */
  private static isRalliement(partie: PartieDto): boolean {
    return familyOf(partie.gameSystemId) === 'ralliement';
  }

  private static genreOf(partie: PartieDto): 'quete' | 'ralliement' {
    return Dashboard.isRalliement(partie) ? 'ralliement' : 'quete';
  }

  /** Sous-titre de tuile (Story 38.5, UX-DR14) : la seule nature — « Chronique » pour une quête,
   *  « La convergence des Sortilèges » pour un ralliement. Le nom du système n'y figure plus : il
   *  est porté par la pastille `.system-chip`. */
  protected subtitle(partie: PartieDto): string {
    const tone = this.theme.tone();
    if (Dashboard.isRalliement(partie)) {
      return tone[`partie.ralliement_kind_${partie.kind}`] ?? partie.kind;
    }
    return this.kind(partie.kind);
  }

  /** Le badge rond du système existe-t-il pour cette partie ? (R1 Ryuutama, L1 ralliement ; rien
   *  pour Draconis, qui garde la seule pastille texte.) */
  protected hasSystemBadge(partie: PartieDto): boolean {
    return systemBadgeGlyph(partie.gameSystemId) !== null;
  }

  /** Mot du rôle dans la tuile — JDR : Maître / Héros (clés thématisées, inchangées). Ralliement :
   *  rencontre isolée → Hôte / Invité, groupe → Admin / Membre (Story 38.5). Un seul endroit
   *  pour l'indicateur de rôle ET la sous-ligne du mode liste. */
  protected roleLabel(partie: PartieDto): string {
    const tone = this.theme.tone();
    switch (partie.role) {
      case 'mj':
        return tone['dashboard.role_mj'];
      case 'player':
        return tone['dashboard.role_player'];
      case 'admin':
        return tone[
          partie.kind === 'ONE_SHOT'
            ? 'dashboard.role_ralliement_host'
            : 'dashboard.role_ralliement_admin'
        ];
      case 'member':
        return tone[
          partie.kind === 'ONE_SHOT'
            ? 'dashboard.role_ralliement_guest'
            : 'dashboard.role_ralliement_member'
        ];
      default: {
        const exhaustive: never = partie.role;
        return exhaustive;
      }
    }
  }

  /** Icône du rôle : l'unique correspondance `roleIconName` (MJ, admin de groupe, hôte d'une
   *  soirée isolée, joueur/membre), appelée depuis le gabarit. */
  protected readonly roleIconName = roleIconName;

  /** Critères de filtre (AC2/AC5) — purement transitoires (écran), jamais mémorisés sur le compte
   *  (EXPERIENCE.md §4.2 : seul le tri par défaut vit dans les préférences). */
  protected readonly roleFilter = signal<'all' | PartieRole>('all');
  /** Genre (Story 38.5) : quêtes de JDR ou ralliements — transitoire, comme les autres filtres. */
  protected readonly genreFilter = signal<'all' | 'quete' | 'ralliement'>('all');
  /** « Grouper par type » (Story 38.5) : deux sections Quêtes / Ralliements. Transitoire, décoché
   *  par défaut, et jamais compté comme un écart au défaut. */
  protected readonly groupByType = signal(false);
  protected readonly statusFilter = signal<'all' | PartieStatus>('all');
  /** Révélation temporaire des parties terminées (AC6, « restent accessibles à la demande ») —
   *  n'écrit jamais la préférence `hideFinishedParties`, contrairement à la case à cocher. */
  protected readonly showFinishedOverride = signal(false);

  /** Recherche par nom (Story 29.9) — purement transitoire (écran), même statut que
   *  `roleFilter`/`statusFilter` : jamais mémorisée, jamais comptée dans `hasDeviatedFromDefault`
   *  (une saisie de consultation, pas un réglage — même décision que `MyCharacters`). */
  protected readonly searchQuery = signal('');

  protected readonly sortOptions = PARTIE_SORTS;
  /** Critère de tri effectif — lu depuis le compte, défaut 'urgence' si non connecté (garde). */
  protected readonly partiesSort = computed<PartieSort>(
    () => this.auth.currentUser()?.partiesSort ?? 'urgence',
  );
  protected readonly hideFinishedParties = computed(
    () => this.auth.currentUser()?.hideFinishedParties ?? false,
  );
  /** Mode d'affichage effectif (Story 29.9, AC1/AC4) — même patron que `partiesSort`. */
  protected readonly partiesViewMode = computed<ListViewMode>(
    () => this.auth.currentUser()?.partiesViewMode ?? 'medium',
  );
  /** Options de tri résolues pour `ListControlBar` — le composant partagé reste agnostique du
   *  thème, `Dashboard` résout déjà les libellés via `sortLabel()`. */
  protected readonly sortOptionsForBar = computed<ListControlBarSortOption[]>(() =>
    this.sortOptions.map((sort) => ({ value: sort, label: this.sortLabel(sort) })),
  );
  /** Seuls les filtres rôle/statut « dévient » d'un défaut (AC6) — `partiesSort`/`partiesViewMode`/
   *  `hideFinishedParties` se persistent immédiatement à chaque changement (patron fire-and-forget
   *  déjà établi) et ne peuvent donc jamais s'écarter d'eux-mêmes après coup (Dev Notes). */
  protected readonly hasDeviatedFromDefault = computed(
    () =>
      this.roleFilter() !== 'all' || this.genreFilter() !== 'all' || this.statusFilter() !== 'all',
  );
  /** Densité d'affichage (AC1) — une seule classe CSS pilotant toutes les grilles de la page. */
  protected readonly gridDensityClass = computed(() => `grid--${this.partiesViewMode()}`);
  /** Bouton de révélation (AC6) : visible seulement si le masquage est actif, pas déjà levé, et
   *  qu'il existe au moins une partie terminée à révéler **sous le filtre de rôle actif** — jamais
   *  un bouton dont le clic ne changerait rien (Review Findings : ignorer `roleFilter()` affichait
   *  le bouton même quand les seules parties terminées appartenaient au rôle filtré). */
  protected readonly hasHiddenFinished = computed(() => {
    if (!this.hideFinishedParties() || this.showFinishedOverride() || this.statusFilter() !== 'all')
      return false;
    const role = this.roleFilter();
    const genre = this.genreFilter();
    return this.allParties().some(
      (p) =>
        Dashboard.isFinishedOrCancelled(p) &&
        (role === 'all' || p.role === role) &&
        (genre === 'all' || Dashboard.genreOf(p) === genre),
    );
  });

  /** Filtres rôle/statut + masquage des terminées (AC2, AC5, AC6) — appliqués côté front à la
   *  liste déjà chargée, jamais par un appel serveur supplémentaire. Le masquage ne s'applique
   *  que si le filtre statut est 'all' : filtrer explicitement sur « Terminées » est déjà une
   *  façon d'y accéder « à la demande », cohérente avec le bouton de révélation. */
  private readonly filteredParties = computed<PartieDto[]>(() => {
    const role = this.roleFilter();
    const genre = this.genreFilter();
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const hideFinished =
      this.hideFinishedParties() && !this.showFinishedOverride() && status === 'all';
    return this.allParties().filter((p) => {
      if (role !== 'all' && p.role !== role) return false;
      if (genre !== 'all' && Dashboard.genreOf(p) !== genre) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (hideFinished && Dashboard.isFinishedOrCancelled(p)) return false;
      if (query && !p.name.toLowerCase().includes(query)) return false;
      return true;
    });
  });

  /** Une entrée par partie affichée (Tasks 6/7), désormais calculée sur `filteredParties()`
   *  (Story 29.8) plutôt que `allParties()` — badges/teinte/priorité inchangés (AC4). */
  private readonly tiles = computed<PartieTileVm[]>(() => {
    const signalsMap = this.partySignalsSvc.signals();
    return this.filteredParties().map((partie) => {
      const signals = signalsMap.get(partie.id)?.signals ?? [];
      // PARTIE_TERMINEE est exclu des badges affichés (revue utilisateur post-29.7) : redondant
      // avec .status-indicator, déjà affiché à côté du titre pour toute partie TERMINEE.
      const displaySignals = signals.filter(
        (s) => s !== 'PARTIE_TERMINEE' && s !== 'PARTIE_ANNULEE',
      );
      const sorted = sortByPriority(displaySignals);
      const visibleSignals = sorted.slice(0, MAX_VISIBLE_BADGES);
      const moreCount = Math.max(0, sorted.length - MAX_VISIBLE_BADGES);
      // AC8 : ordre de priorité de teinte « bloque le démarrage » > « échéance »/« en retard ».
      // La palette de statut (--jdr-status-*, Story 29.0) est un invariant à 4 teintes ; faute
      // d'une 5e teinte dédiée (décision UX non tranchée, cf. Review Findings), « échéance » et
      // « en retard » partagent la teinte `soon`, distincte de `todo` réservée au blocage.
      const category = dominantCategory(displaySignals);
      const tint: TileTint =
        partie.status === 'ANNULEE'
          ? 'cancelled'
          : partie.status === 'TERMINEE'
            ? 'done'
            : category === 'blocking'
              ? 'todo'
              : category === 'deadline' || category === 'overdue'
                ? 'soon'
                : partie.status === 'EN_COURS'
                  ? 'live'
                  : 'soon';
      return {
        partie,
        signals,
        visibleSignals,
        moreCount,
        dominant: dominantSignal(displaySignals),
        tint,
      };
    });
  });

  /** Story 42.4 : « clos » au sens de la case à cocher — terminée OU annulée (statut `ANNULEE`, Story 42.2).
   *  La préférence enregistrée (`hideFinishedParties`) garde son nom et sa valeur ; seule sa portée s'élargit. */
  private static isFinishedOrCancelled(partie: PartieDto): boolean {
    return partie.status === 'TERMINEE' || partie.status === 'ANNULEE';
  }

  private static hasActionableSignal(signals: readonly PartySignalCode[]): boolean {
    return signals.some((s) => !NON_ACTIONABLE_SIGNALS.includes(s));
  }

  /** Tri + favoris en tête (Story 29.8, AC1/AC3), appliqué une seule fois sur `tiles()` — jamais
   *  redondant avec les intertitres, qui filtrent ensuite ce même tableau déjà ordonné. Favoris
   *  toujours en tête au sein de n'importe quel sous-groupe : `pinFavorites()` est une partition
   *  stable sur tout le tableau, donc l'ordre relatif favori-avant-non-favori survit à un filtre
   *  ultérieur (Dev Notes : « appliquée après le tri, avant le découpage en intertitres »). */
  private readonly orderedTiles = computed<PartieTileVm[]>(() => {
    const ts = this.tiles();
    const byPartieId = new Map<string, PartieTileVm>(ts.map((t) => [t.partie.id, t]));
    const sortedParties = pinFavorites(
      sortParties(
        ts.map((t) => t.partie),
        this.partiesSort(),
        this.partySignalsSvc.signals(),
      ),
    );
    return sortedParties.map((p) => byPartieId.get(p.id)!);
  });

  /** Quatre intertitres (AC10) — décision d'implémentation (aucune AC ne tranche l'ordre exact
   *  entre « a un signal d'action » et le statut EN_COURS/A_VENIR) : une partie non terminée avec
   *  au moins un signal actionnable va dans « ce qui t'attend », quel que soit son statut ;
   *  sinon elle se range par statut. Une partie TERMINEE va toujours dans « terminées », même si
   *  elle porte un signal de fin actionnable (compte-rendu/rapport manquant) — cohérent avec AC5
   *  (une partie terminée ne porte plus de signal *d'action*, seulement des signaux de fin).
   *  N'existent que pour le tri 'urgence' (Story 29.8, décision documentée en Dev Notes/Completion
   *  Notes) : tout autre critère bascule sur `flatTiles`, une liste plate unique. */
  protected readonly awaitingTiles = computed(() =>
    this.orderedTiles().filter(
      (t) =>
        t.partie.status !== 'TERMINEE' &&
        t.partie.status !== 'ANNULEE' &&
        Dashboard.hasActionableSignal(t.signals),
    ),
  );
  protected readonly ongoingTiles = computed(() =>
    this.orderedTiles().filter(
      (t) => t.partie.status === 'EN_COURS' && !Dashboard.hasActionableSignal(t.signals),
    ),
  );
  protected readonly upcomingTiles = computed(() =>
    this.orderedTiles().filter(
      (t) => t.partie.status === 'A_VENIR' && !Dashboard.hasActionableSignal(t.signals),
    ),
  );
  protected readonly finishedTiles = computed(() =>
    this.orderedTiles().filter(
      (t) => t.partie.status === 'TERMINEE' || t.partie.status === 'ANNULEE',
    ),
  );
  /** Liste plate (Story 29.8) utilisée à la place des 4 intertitres dès que le tri s'écarte de
   *  'urgence' — trier par nom/date/type/statut à l'intérieur de 4 groupes n'aurait pas de sens
   *  pour un utilisateur qui veut un ordre global (Dev Notes, décision documentée). */
  protected readonly flatTiles = this.orderedTiles;

  /** « Grouper par type » (Story 38.5) : les tuiles déjà triées et épinglées (favoris en tête),
   *  simplement réparties par genre — chaque section garde donc l'ordre du tri choisi, sans les
   *  intertitres d'urgence. Une section vide n'est pas rendue (cf. le gabarit). */
  protected readonly questTiles = computed(() =>
    this.orderedTiles().filter((t) => Dashboard.genreOf(t.partie) === 'quete'),
  );
  protected readonly ralliementTiles = computed(() =>
    this.orderedTiles().filter((t) => Dashboard.genreOf(t.partie) === 'ralliement'),
  );

  /** Libellé de thème d'un code de signal — clé `partie.signal_<code>` en minuscule. */
  protected signalLabel(code: PartySignalCode): string {
    return this.theme.tone()[`partie.signal_${code.toLowerCase()}`] ?? code;
  }

  /** Système affiché sur la carte d'une invitation reçue. Pour un groupe de ralliement (Story 39.3),
   *  le mot du thème (« Ralliement » / « Veillée » / « Rassemblement ») remplace le nom du système :
   *  l'invité peut n'avoir jamais vu de JDR, aucun mot de la famille JDR ne doit apparaître. */
  protected invitationSystemLabel(inv: InvitationDto): string {
    return familyOf(inv.partie.gameSystemId) === 'ralliement'
      ? this.theme.tone()['partie.mode_ralliement']
      : gameSystemName(inv.partie.gameSystemId);
  }

  /** Story 41.3 : pastille « Invitation à accepter » (`todo`, écrite) d'une invitation à une rencontre
   *  de ralliement — une quête garde sa carte telle quelle. */
  protected pendingInvitationChip(inv: InvitationDto): StatusBadgeState | null {
    if (familyOf(inv.partie.gameSystemId) !== 'ralliement') return null;
    return {
      tone: 'todo',
      labelKey: 'status.scenario_a_venir',
      draft: false,
      text: this.theme.tone()['dashboard.invitation_pending_chip'],
    };
  }

  /** Mention « invité par <pseudo> » d'une invitation reçue (gabarit lu dans le registre). */
  protected invitedByLabel(pseudo: string): string {
    return fillTone(this.theme.tone()['dashboard.invitation_invited_by'], { pseudo });
  }

  /** Gabarit « +{n} » (AC3) — même patron `.replace()` que `partie.notice_invited` ailleurs. */
  protected moreLabel(n: number): string {
    return this.theme.tone()['partie.signal_more_count'].replace('{n}', String(n));
  }

  /** Libellé d'un badge de signal — cas particulier `PROCHAINE_SEANCE_CONNUE` (Bug fix, revue
   *  utilisateur post-29.7) : affiche la date réelle (`Partie.nextSessionDate`/`nextSessionSlot`,
   *  déjà chargés, jamais recalculés — AD-3) plutôt qu'un libellé générique, conformément au
   *  mockup `q8-navigation.html` (« 12 août, soirée ») et à DESIGN.md §2/§3. Même patron de
   *  formatage que `partie-detail.ts` (`SLOT_LABELS` + `Intl.DateTimeFormat`). */
  protected badgeLabel(code: PartySignalCode, partie: PartieDto): string {
    if (code === 'PROCHAINE_SEANCE_CONNUE' && partie.nextSessionDate) {
      try {
        const date = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(partie.nextSessionDate));
        const slot = partie.nextSessionSlot ? `, ${SLOT_LABELS[partie.nextSessionSlot]}` : '';
        const start = `${date}${slot}`;
        // Story 47.2 : une plage de plusieurs créneaux se lit « début → fin » ; un créneau seul reste inchangé.
        const end = partie.nextSessionEndDate;
        const sameDay = !end || end.substring(0, 10) === partie.nextSessionDate.substring(0, 10);
        const sameSlot = (partie.nextSessionEndSlot ?? partie.nextSessionSlot) === partie.nextSessionSlot;
        if (!end || (sameDay && sameSlot)) return start;
        const endDate = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(end));
        const endSlot = partie.nextSessionEndSlot ? `, ${SLOT_LABELS[partie.nextSessionEndSlot]}` : '';
        return `${start} → ${endDate}${endSlot}`;
      } catch {
        return this.signalLabel(code);
      }
    }
    return this.signalLabel(code);
  }

  /** Teinte d'un badge (AC9 + retour utilisateur post-29.7) : `PROCHAINE_SEANCE_CONNUE` est une
   *  information, pas une action à faire — il ne doit pas porter la couleur d'urgence
   *  `--jdr-status-todo` comme les autres badges, mais `--jdr-status-soon` (« à venir »),
   *  cohérent avec la teinte de carte `.tile--soon`. */
  protected badgeTone(code: PartySignalCode): 'todo' | 'soon' {
    return code === 'PROCHAINE_SEANCE_CONNUE' ? 'soon' : 'todo';
  }

  /** Icône du signal non chromatique accompagnant la teinte de carte pour les tuiles sans badge
   *  visible (AC9 : jamais la couleur seule) — cf. `tintLabel()`. */
  protected tintIcon(tint: TileTint): IconName | null {
    switch (tint) {
      case 'live':
        return 'etat-en-cours';
      case 'soon':
        return 'etat-a-venir';
      case 'done':
        return 'etat-terminee';
      case 'cancelled':
        return 'etat-annulee';
      case 'todo':
        // Pas d'icône de repli : sans dessin pour ce sens, le gabarit n'affiche que le texte.
        return null;
    }
  }

  /** Libellé non chromatique doublant la teinte de carte `.tile--live`/`.tile--soon`/`.tile--closed`
   *  (Patch revue de code, Story 29.7 : ces tuiles pouvaient n'afficher qu'une couleur sans aucun
   *  badge quand la partie ne porte aucun signal, violant AC9/P-1). `.tile--awaiting` (todo) n'a pas
   *  besoin de ce fallback : elle n'existe que lorsqu'un signal actionnable est présent, donc au
   *  moins un badge est toujours visible. */
  protected tintLabel(tint: TileTint): string {
    if (tint === 'cancelled') return this.theme.tone()['dashboard.status_cancelled_badge'];
    if (tint === 'done') return this.theme.tone()['dashboard.status_closed_badge'];
    if (tint === 'live') return this.theme.tone()['dashboard.section_ongoing'];
    return this.theme.tone()['dashboard.section_upcoming'];
  }

  /** Instant de référence du compte à rebours (Story 29.11), figé au montage.
   *  **Une seule source pour tout l'écran** : un `new Date()` par tuile pourrait placer deux
   *  tuiles de part et d'autre d'une frontière de jour et leur donner des progressions
   *  incohérentes. Figé plutôt que réactif : un compte à rebours qui « avance » en cours de
   *  session serait imperceptible (sept jours) et coûterait un timer permanent. */
  private readonly countdownNow = signal(new Date());

  /** L'unique partie portant un compte à rebours (DESIGN.md §7.4 : « il n'apparaît que sur un
   *  seul élément à la fois : la prochaine séance »). La séance la plus proche parmi celles à
   *  moins de sept jours — sans cette règle, une liste entière afficherait des comptes à rebours,
   *  et l'élément cesserait de désigner *la* prochaine séance. */
  protected readonly countdownPartieId = computed<string | null>(() => {
    const now = this.countdownNow();
    let bestId: string | null = null;
    let bestDate = Number.POSITIVE_INFINITY;
    for (const partie of this.filteredParties()) {
      if (countdownProgress(partie.nextSessionDate, now) === null) continue;
      const time = new Date(partie.nextSessionDate!).getTime();
      // countdownProgress() borne une séance déjà passée à 1 (jamais null) — sans cette garde, une
      // date passée non purgée (nextSessionDate n'est jamais effacé après coup, item différé connu
      // depuis la revue 29.7) gagnerait toujours la comparaison sur un horodatage plus ancien que
      // toute vraie prochaine séance, et confisquerait le compte à rebours indéfiniment.
      if (time < now.getTime()) continue;
      if (time < bestDate) {
        bestDate = time;
        bestId = partie.id;
      }
    }
    return bestId;
  });

  /** Progression à afficher pour CETTE partie, ou `null` si elle ne porte pas le compte à
   *  rebours de l'écran. */
  protected countdownFor(partie: PartieDto): number | null {
    if (partie.id !== this.countdownPartieId()) return null;
    return countdownProgress(partie.nextSessionDate, this.countdownNow());
  }

  /** Sous-ligne du mode liste (AC1, DESIGN.md §4.1) — « Rôle · libellé du signal dominant ».
   *
   *  §4.1 est explicite : « En mode liste, la pastille n'est jamais seule » — elle est doublée du
   *  libellé du signal dominant. Sans signal, on retombe sur le libellé de teinte (« En cours »,
   *  « À venir », « Terminée »), jamais sur rien : c'est cette ligne qui satisfait P-1 en mode
   *  liste, là où les modes moyen/grand s'appuient sur les badges et `.status-indicator`.
   *  Le rôle y est repris parce que `.role-indicator` n'est pas rendu dans ce gabarit. */
  protected rowSummary(t: PartieTileVm): string {
    const role = this.roleLabel(t.partie);
    const detail = t.dominant ? this.badgeLabel(t.dominant, t.partie) : this.tintLabel(t.tint);
    return `${role} · ${detail}`;
  }

  /** Compteur unique du mode liste (§4.1 bis : « En mode liste, un seul compteur ») — le total des
   *  signaux affichables, pas les deux badges + « +N » des modes moyen/grand. */
  protected rowCount(t: PartieTileVm): number {
    return t.visibleSignals.length + t.moreCount;
  }

  /** Libellé accessible du compteur — le nombre nu ne dit pas de quoi il parle. */
  protected rowCountAriaLabel(n: number): string {
    return this.theme.tone()['dashboard.row_signal_count_aria'].replace('{n}', String(n));
  }

  /** Libellé de thème d'un critère de tri (Story 29.8) — clé `dashboard.sort_<critère>`. */
  protected sortLabel(sort: PartieSort): string {
    return this.theme.tone()[`dashboard.sort_${sort}`] ?? sort;
  }

  /** Libellé non chromatique de l'étoile de favori (jamais l'icône/la couleur seule, AC1). */
  protected favoriteAriaLabel(isFavorite: boolean): string {
    return isFavorite
      ? this.theme.tone()['dashboard.favorite_remove_aria']
      : this.theme.tone()['dashboard.favorite_add_aria'];
  }

  constructor() {
    // Story 21.1 (AC2) : réagit au signal générique InvitationsService.changed (RealtimeService).
    // PIÈGE (même classe que Story 20.1/20.2, mais SANS le piège de timing associé) : Dashboard a
    // DÉJÀ un chargement dédié dans ngOnInit(). La première exécution d'un effect() a lieu à la
    // CONSTRUCTION du composant — un garde firstRun neutralise cette première exécution pour
    // éviter un refetch redondant avec celui que ngOnInit() fait juste après.
    let firstRun = true;
    effect(() => {
      this.invitations.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.loadInvitations());
    });
  }

  async ngOnInit(): Promise<void> {
    this.contextualNav.set({ title: this.theme.tone()['nav.my_games'] });
    const id = this.auth.currentUser()?.id;
    if (id) {
      this.realtime.connect(userTopic(id));
      this.destroyRef.onDestroy(() => this.realtime.disconnect(userTopic(id)));
    }
    await this.loadInvitations();
  }

  async accept(inv: InvitationDto): Promise<void> {
    await this.invitations.accept(inv.id);
    this.received.update((list) => list.filter((i) => i.id !== inv.id));
    await this.myPartiesSvc.refreshAll();
  }

  async decline(inv: InvitationDto): Promise<void> {
    await this.invitations.decline(inv.id);
    this.received.update((list) => list.filter((i) => i.id !== inv.id));
  }

  private async loadInvitations(): Promise<void> {
    try {
      this.received.set(await this.invitations.listReceived());
    } catch {
      this.received.set([]);
    }
  }

  /** Mémorisation du critère de tri (AC3) — appliqué immédiatement côté client (déjà reflété par
   *  `partiesSort()`, lu depuis `auth.currentUser()`), l'appel réseau est fire-and-forget (même
   *  patron que `theme-selector.ts` : un échec isolé n'empêche pas le tri de s'appliquer).
   *  Review Findings : un échec serveur restaure l'ancienne valeur locale plutôt que de laisser
   *  l'UI mentir sur ce qui est réellement persisté. */
  protected onSortChange(sort: PartieSort): void {
    const previous = this.auth.currentUser();
    if (previous) this.auth.currentUser.set({ ...previous, partiesSort: sort });
    this.account.updatePreferences({ partiesSort: sort }).catch(() => {
      if (previous) this.auth.currentUser.set(previous);
    });
  }

  /** Préférence « masquer les parties terminées » (AC6) — même patron fire-and-forget que le tri,
   *  même rollback en cas d'échec (Review Findings). */
  protected onHideFinishedChange(hide: boolean): void {
    const previous = this.auth.currentUser();
    if (previous) this.auth.currentUser.set({ ...previous, hideFinishedParties: hide });
    this.account.updatePreferences({ hideFinishedParties: hide }).catch(() => {
      if (previous) this.auth.currentUser.set(previous);
    });
    // Un nouveau réglage repart sans révélation temporaire active (évite l'incohérence « masquage
    // activé mais case déjà levée par un clic précédent »).
    this.showFinishedOverride.set(false);
  }

  /** Mode d'affichage (Story 29.9, AC1/AC3) — même patron fire-and-forget + rollback que
   *  `onSortChange()`/`onHideFinishedChange()` (Review Findings Story 29.8, à ne pas régresser). */
  protected onViewModeChange(mode: ListViewMode): void {
    const previous = this.auth.currentUser();
    if (previous) this.auth.currentUser.set({ ...previous, partiesViewMode: mode });
    this.account.updatePreferences({ partiesViewMode: mode }).catch(() => {
      if (previous) this.auth.currentUser.set(previous);
    });
  }

  /** Rétablit les filtres transitoires (Story 29.9, AC6) — seuls réglages comptés dans
   *  `hasDeviatedFromDefault()` (rôle, genre, statut), jamais mémorisés côté compte. */
  protected onResetRequested(): void {
    this.roleFilter.set('all');
    this.genreFilter.set('all');
    this.statusFilter.set('all');
  }

  /** Garde anti-double-clic (Review Findings) — un `partieId` déjà en vol ignore les clics
   *  suivants tant que la requête + le rechargement n'ont pas abouti. */
  private readonly pendingFavorites = signal<ReadonlySet<string>>(new Set());

  /** Vrai si un clic sur l'étoile de cette partie est déjà en cours de traitement. */
  /** Story 42.5 : « Retirer de ma liste » n'est offert que sur une partie terminée ou annulée (le serveur
   *  refuse sinon). Parties retirées en cours de confirmation/écriture : le bouton est désactivé. */
  private readonly pendingHides = signal<ReadonlySet<string>>(new Set());

  protected canHide(partie: PartieDto): boolean {
    return partie.status === 'TERMINEE' || partie.status === 'ANNULEE';
  }

  protected isHidePending(partieId: string): boolean {
    return this.pendingHides().has(partieId);
  }

  protected hideAriaLabel(partie: PartieDto): string {
    return fillTone(this.theme.tone()['dashboard.hide_party_aria'], { name: partie.name });
  }

  /** Story 42.5 (UX-DR12 n° 4) : confirmation « Votre accord », puis retrait définitif pour soi seul ; la
   *  liste est relue par `MyPartiesService.hide`. « Renoncer » ne change rien. */
  protected async confirmHide(partie: PartieDto): Promise<void> {
    if (!this.canHide(partie) || this.pendingHides().has(partie.id)) return;
    const tone = this.theme.tone();
    // La fenêtre de confirmation n'est chargée qu'au premier clic : l'écran d'accueil (bundle initial) ne
    // porte ni `MatDialog` ni `ConfirmDialog` (budget du bundle initial).
    const [{ MatDialog }, { ConfirmDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('../parties/confirm-dialog/confirm-dialog'),
    ]);
    const ref = this.injector.get(MatDialog).open(ConfirmDialog, {
      data: {
        message: fillTone(tone['dashboard.hide_party_confirm'], { name: partie.name }),
        confirmLabel: tone['dashboard.hide_party_confirm_btn'],
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.pendingHides.update((s) => new Set(s).add(partie.id));
    try {
      await this.myPartiesSvc.hide(partie.id);
    } catch {
      // Refus ou échec réseau : la tuile reste, rien n'a changé (le serveur est seul juge).
    } finally {
      this.pendingHides.update((s) => {
        const next = new Set(s);
        next.delete(partie.id);
        return next;
      });
    }
  }

  protected isFavoritePending(partieId: string): boolean {
    return this.pendingFavorites().has(partieId);
  }

  /** Favori (AC1) — rechargement de la liste unique (Story 38.5), quel que soit le rôle. */
  protected async toggleFavorite(partie: PartieDto): Promise<void> {
    if (this.pendingFavorites().has(partie.id)) return;
    this.pendingFavorites.update((s) => new Set(s).add(partie.id));
    try {
      if (partie.isFavorite) {
        await this.account.removeFavorite(partie.id);
      } else {
        await this.account.addFavorite(partie.id);
      }
      // Une seule liste pour tous les rôles (Story 38.5) : le favori marche pour un ralliement
      // comme pour une quête, sans brancher sur le rôle.
      await this.myPartiesSvc.refreshAll();
    } finally {
      this.pendingFavorites.update((s) => {
        const next = new Set(s);
        next.delete(partie.id);
        return next;
      });
    }
  }
}
