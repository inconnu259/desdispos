import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CdkConnectedOverlay, type ConnectedPosition } from '@angular/cdk/overlay';
import { RouterLink } from '@angular/router';
import type {
  BoardGameDto,
  EventBoardGamesDto,
  EventBringDto,
  EventCardDto,
} from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { fitsHeadcount } from '../../board-games/board-game-measures';
import { EventsApiService } from '../events-api.service';
import { type EnvyView } from './envy-toggle';
import { GameRow } from './game-row';
import { GamesSection } from './games-section';
import { GamesSummary } from './games-summary';
import { UnavailableRow } from './unavailable-row';

/** Clé de la section « Chez {hôte} » / « Chez moi » (état replié retenu dans ce navigateur). */
export const HOST_SECTION_KEY = 'host';
/** Clé de la section du bas de l'hôte, « Scellées ce soir / Restés au logis / Hors service » (Story 49.4). */
export const EXCLUDED_SECTION_KEY = 'excluded';

/** Story 49.4 — position du menu ⋮ d'une ligne, même patron que le ⋮ de la fiche de personnage : sous le déclencheur,
 *  aligné sur son bord de fin (le ⋮ est à droite de la ligne), repli au-dessus pour les très petites hauteurs. */
const ROW_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];
/** Clé de la section des apports (Story 49.2). */
export const BROUGHT_SECTION_KEY = 'brought';
/** Clé de la section « Dans mon cabinet / coffre / Sur mon râtelier » (Story 49.2). */
export const MINE_SECTION_KEY = 'mine';

/** Qui détient un jeu sur place : l'hôte (chez lui) ou un participant (qui l'apporte). */
interface Holder {
  kind: 'host' | 'bring';
  userId: string | null;
  /** Nom écrit : « moi » quand c'est la personne connectée. */
  name: string;
}

/** Ce qu'une ligne a besoin d'afficher, calculé une fois par l'onglet (qui connaît tous les détenteurs). */
interface RowView {
  game: BoardGameDto;
  duplicateCount: number;
  byText: string | null;
  alsoText: string | null;
  warnText: string | null;
  action: 'bring' | 'unbring' | null;
  /** Story 49.4 : la ligne porte le ⋮ de l'hôte (ses propres jeux seulement). */
  menu: boolean;
  /** Story 49.5 : la ligne porte l'Envie de son nom (jeux de l'hôte et apports, jamais « Dans mon … »). */
  envy: boolean;
}

/** Même ordre que l'API : clé normalisée, puis nom (puis identifiant, voir l'appelant). */
function compareGames(a: BoardGameDto, b: BoardGameDto): number {
  return a.nameKey.localeCompare(b.nameKey, 'fr') || a.name.localeCompare(b.name, 'fr');
}

/** « A, B et C » (« A et B », « A »). */
function joinNames(names: string[]): string {
  return new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(names);
}

/**
 * Onglet des jeux sur place d'une soirée à venir (Stories 49.1 et 49.2, épic 49) : les jeux de l'hôte (jamais
 * copiés), ce que les participants apportent, le nombre de participants N et ce qui en est jouable. Il ne sert que
 * les soirées OUVERTES ; l'écran qui l'héberge (rencontre isolée, fenêtre d'une conjonction de groupe) ne le pose
 * pas pour une soirée passée, terminée ou annulée.
 *
 * Contenu (EXPERIENCE.md §2.3) : `GamesSummary` (« {n} jeux sur place · {k} jouables à {N} » — jeux de l'hôte ET
 * apports, en lignes —, puce « Jouables à {N} »), puis des `GamesSection` repliables, dans l'ordre :
 * « Chez {hôte} » (« Chez moi » pour l'hôte), « Apportées / Apportés à la veillée / Acheminés » (les apports de
 * tous, les miens compris : « par moi · Je ne l'apporte plus »), « Dans mon cabinet / coffre / Sur mon râtelier »
 * (un participant autre que l'hôte seulement : mes jeux pas encore apportés, chacun avec « J'apporte »). Sans jeu
 * sur place : une ligne themée ; le lien discret vers « mon cabinet » est offert à l'hôte, et — pour un participant —
 * dans sa propre section quand elle est vide (« Votre cabinet est vide. »).
 *
 * Doublons : les lignes de même `nameKey` REÇU (jamais recalculé) — jeux de l'hôte et apports — portent « ×N » et
 * la ligne « aussi chez … / aussi apporté par … » (tous les autres détenteurs) ; dans « Dans mon … », un jeu déjà
 * sur place porte « ⚠ déjà chez … ». Apporter et ne plus apporter agissent aussitôt, sans confirmation : la ligne
 * change de section tout de suite (mise à jour locale), puis la liste est relue. Un refus ou un jeu disparu
 * (400/403/404) échoue en silence et la liste est relue ; un second toucher pendant l'écriture est ignoré.
 *
 * Données : la carte de l'événement vient de l'hôte de l'onglet (`card`, la fenêtre d'une conjonction) ou, à défaut,
 * est lue ici par `events-api.list(partieId)` (la rencontre isolée n'en porte qu'une). Le nombre de lignes sur place
 * est remonté par `countChange` pour le libellé de l'onglet (« Reliques · 6 »). Mes jeux viennent de
 * `BoardGamesService.list()`, lus seulement pour un participant autre que l'hôte.
 *
 * Story 49.4 — écarter un jeu pour ce soir (l'hôte seul) : chaque ligne de « Chez moi » porte un ⋮ qui ouvre un
 * menu d'UNE entrée (« Sceller pour ce soir » etc.), tenu ici par un unique `cdkConnectedOverlay` (`role="menu"`,
 * flèches / Début / Fin / Échap, le fond ferme, le focus revient au ⋮). Choisir l'entrée retire le jeu de « Chez moi »
 * aussitôt (mise à jour locale, même garde « occupé » et même échec silencieux + relecture que l'apport) et le range
 * dans la section du bas, qui n'existe que pour l'hôte et que si `excludedGames` n'est pas vide — même quand « Chez
 * moi » est vide. Son bouton themé remet le jeu à tous aussitôt. Le ⋮ disparaissant avec la ligne, le focus va à la
 * ligne suivante, à défaut à l'en-tête de la section.
 *
 * Story 49.5 — signaler une Envie : sur les lignes de l'hôte et des apports (jamais « Dans mon … » ni la section du bas),
 * l'`EnvyToggle` montre ♥ seul ou « ♥ n » ; l'Envie est lue par NOM REÇU (`nameKey`, jamais recalculé), donc le même nom
 * sur deux lignes montre la même. Seul un participant (`canFill`) bascule — optimiste, garde « occupé » par `nameKey`,
 * échec silencieux + relecture, comme l'apport ; un lecteur en lecture seule voit le compte et la liste des noms (un
 * unique overlay `role="dialog"`, Échap / fond ferment, le focus revient au compte). La seconde puce du résumé, « Les plus
 * appelées », trie chaque section de lignes à Envie par nombre décroissant puis alphabétique, sans toucher aux comptes.
 *
 * Temps réel : la page de la partie tient DÉJÀ la connexion `partie:{id}` et `PartiesService.changed()` est notifié
 * à chaque mutation (jeu ajouté, apport, inscription, désinscription) — l'onglet s'y abonne par un `effect()`
 * (premier passage ignoré), sans ouvrir de connexion ni ajouter de handler. Rechargement protégé par un numéro de
 * requête (une réponse périmée n'écrase pas une plus fraîche), dernier état connu conservé sur un échec transitoire.
 * Quand N change (jamais au premier chargement), une annonce polie le dit dans une région `role="status"` toujours
 * présente — aucun bandeau visible.
 */
@Component({
  selector: 'app-event-games-tab',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    CdkConnectedOverlay,
    GamesSummary,
    GamesSection,
    GameRow,
    UnavailableRow,
  ],
  templateUrl: './event-games-tab.html',
  styleUrl: './event-games-tab.scss',
})
export class EventGamesTab {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);
  private readonly library = inject(BoardGamesService);

  readonly partieId = input.required<string>();
  /** La carte de la conjonction, quand l'hôte de l'onglet la tient déjà ; sinon l'onglet la lit lui-même. */
  readonly card = input<EventCardDto | null>(null);
  /** La personne connectée, fournie par l'écran qui héberge l'onglet (jamais lue ici : l'onglet ne dépend d'aucun service de session). */
  readonly currentUserId = input<string | null>(null);
  /** La personne est l'hôte ou participe (rencontre isolée : tout membre/invité). `null` : déduit de la carte. */
  readonly contributor = input<boolean | null>(null);
  /** Nombre de lignes sur place (jeux de l'hôte + apports), à chaque lecture — pour le libellé de l'onglet. */
  readonly countChange = output<number>();

  /** Carte lue par l'onglet lui-même (seulement quand `card` n'est pas fourni). */
  private readonly loadedCard = signal<EventCardDto | null>(null);
  private readonly event = computed(() => this.card() ?? this.loadedCard());
  private readonly cardId = computed(() => this.card()?.id ?? null);

  protected readonly data = signal<EventBoardGamesDto | null>(null);
  /** Ma Ludothèque (participant autre que l'hôte seulement) ; `null` tant qu'elle n'a pas été lue. */
  private readonly myGames = signal<BoardGameDto[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly fitOnly = signal(false);
  /** Story 49.5 : tri « Les plus appelées » (cumulable avec « Jouables à N »). */
  protected readonly sortEnvy = signal(false);
  /** Annonce polie du dernier changement de N (vide tant que N n'a pas changé). */
  protected readonly announcement = signal('');
  /** Jeux dont une écriture (apporter / ne plus apporter) est en cours : un second toucher est ignoré. */
  private readonly busy = signal<ReadonlySet<string>>(new Set());
  /** Story 49.5 : noms (`nameKey`) dont une Envie est en cours d'écriture — le même nom sur deux lignes est gardé ensemble. */
  private readonly envyBusy = signal<ReadonlySet<string>>(new Set());
  protected readonly hostSectionKey = HOST_SECTION_KEY;
  protected readonly broughtSectionKey = BROUGHT_SECTION_KEY;
  protected readonly mineSectionKey = MINE_SECTION_KEY;
  protected readonly excludedSectionKey = EXCLUDED_SECTION_KEY;
  protected readonly ROW_MENU_POSITIONS = ROW_MENU_POSITIONS;

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  /** Le jeu dont le menu ⋮ est ouvert ; `null` : menu fermé. Un seul menu à la fois, tenu par l'onglet. */
  protected readonly menuGame = signal<BoardGameDto | null>(null);
  /** Le ⋮ qui a ouvert le menu (ancre du menu, cible du retour du focus) ; l'hôte de l'onglet tant que rien n'est ouvert. */
  protected readonly menuOrigin = signal<HTMLElement>(this.host.nativeElement);

  /** Story 49.5 : la ligne dont la liste des noms d'Envie est ouverte ; `null` : fermée. Une seule liste à la fois. */
  protected readonly envyNamesGame = signal<{ id: string; name: string; nameKey: string } | null>(
    null,
  );
  /** Le compte qui a ouvert la liste (ancre, cible du retour du focus) ; l'hôte de l'onglet tant que rien n'est ouvert. */
  protected readonly envyNamesOrigin = signal<HTMLElement>(this.host.nativeElement);

  private readonly hostGames = computed(() => this.data()?.games ?? []);
  /** Story 49.4 : les jeux que l'hôte a écartés pour cette soirée — vide pour tout autre lecteur (clé absente). */
  protected readonly excludedGames = computed(() =>
    this.isHost() ? (this.data()?.excludedGames ?? []) : [],
  );
  /** La section du bas n'existe que pour l'hôte et qu'avec au moins un jeu écarté — même si « Chez moi » est vide. */
  protected readonly showExcluded = computed(() => this.excludedGames().length > 0);
  private readonly brings = computed(() => this.data()?.brings ?? []);
  /** Lignes sur place : jeux de l'hôte + apports (des lignes, pas des noms distincts). */
  protected readonly siteTotal = computed(() => this.hostGames().length + this.brings().length);
  /** N : le nombre de participants, tel que calculé par le serveur. */
  protected readonly headcount = computed(() => this.data()?.participantsCount ?? 0);
  protected readonly fitting = computed(
    () =>
      [...this.hostGames(), ...this.brings().map((b) => b.game)].filter((g) =>
        fitsHeadcount(g, this.headcount()),
      ).length,
  );

  private readonly isHost = computed(() => {
    const hostId = this.event()?.hostId ?? null;
    return hostId !== null && hostId === this.currentUserId();
  });
  protected readonly sectionTitle = computed(() =>
    this.isHost()
      ? this.theme.tone()['event_games.host_section_self']
      : fillTone(this.theme.tone()['event_games.host_section'], {
          nom: this.event()?.hostDisplayName ?? '',
        }),
  );
  /** Le lien vers « mon cabinet » n'est offert qu'à l'hôte et aux participants — jamais à un membre en lecture seule. */
  protected readonly canFill = computed(
    () => this.contributor() ?? (this.isHost() || this.event()?.myInscription === 'CONFIRMED'),
  );
  /** « Dans mon … » : un participant autre que l'hôte (jamais un lecteur seul, jamais l'hôte). */
  protected readonly showMine = computed(() => this.canFill() && !this.isHost());

  /** Story 49.5 : l'Envie de chaque NOM reçu (`nameKey`, jamais recalculé) — le même nom sur deux lignes montre la même. */
  protected readonly envyViews = computed(() => {
    const me = this.currentUserId();
    const canToggle = this.canFill();
    const meName = this.theme.tone()['event_games.holder_me'];
    const views = new Map<string, EnvyView>();
    for (const envy of this.data()?.envies ?? []) {
      views.set(envy.nameKey, {
        count: envy.users.length,
        mine: me !== null && envy.users.some((u) => u.userId === me),
        canToggle,
        users: envy.users.map((u) => ({
          userId: u.userId,
          displayName: u.userId === me ? meName : u.displayName,
        })),
      });
    }
    return views;
  });
  /** L'Envie d'un nom que personne n'a signalé : ♥ seul. */
  protected readonly noEnvy = computed<EnvyView>(() => ({
    count: 0,
    mine: false,
    canToggle: this.canFill(),
    users: [],
  }));
  /** Les noms de la liste ouverte, tenus à jour par la relecture (liste vide : l'overlay se referme). */
  protected readonly envyNamesList = computed(() => {
    const game = this.envyNamesGame();
    return game === null ? [] : (this.envyViews().get(game.nameKey)?.users ?? []);
  });
  protected readonly envyNamesOpen = computed(
    () => this.envyNamesGame() !== null && this.envyNamesList().length > 0,
  );

  /** Les détenteurs de chaque nom normalisé (clé REÇUE du serveur, jamais recalculée). */
  private readonly holders = computed(() => {
    const tone = this.theme.tone();
    const me = this.currentUserId();
    const hostId = this.event()?.hostId ?? null;
    const byKey = new Map<string, Holder[]>();
    const add = (key: string, holder: Holder) =>
      byKey.set(key, [...(byKey.get(key) ?? []), holder]);
    const hostName =
      hostId !== null && hostId === me
        ? tone['event_games.holder_me']
        : (this.event()?.hostDisplayName ?? '');
    for (const game of this.hostGames()) {
      add(game.nameKey, { kind: 'host', userId: hostId, name: hostName });
    }
    for (const bring of this.brings()) {
      add(bring.game.nameKey, {
        kind: 'bring',
        userId: bring.bringer.userId,
        name:
          bring.bringer.userId === me ? tone['event_games.holder_me'] : bring.bringer.displayName,
      });
    }
    return byKey;
  });

  /** « aussi chez {hôte} » et/ou « aussi apporté par {porteurs} » : tous les AUTRES détenteurs du même nom. */
  private alsoText(
    key: string,
    self: { kind: 'host' | 'bring'; userId: string | null },
  ): string | null {
    const tone = this.theme.tone();
    const others = (this.holders().get(key) ?? []).filter(
      (h) => !(h.kind === self.kind && h.userId === self.userId),
    );
    const parts: string[] = [];
    const hosts = others.filter((h) => h.kind === 'host').map((h) => h.name);
    const bringers = others.filter((h) => h.kind === 'bring').map((h) => h.name);
    if (hosts.length > 0) {
      parts.push(fillTone(tone['event_games.also_at'], { noms: joinNames(hosts) }));
    }
    if (bringers.length > 0) {
      parts.push(fillTone(tone['event_games.also_brought_by'], { noms: joinNames(bringers) }));
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  private readonly hostItems = computed<RowView[]>(() => {
    const hostId = this.event()?.hostId ?? null;
    return this.hostGames().map((game) => ({
      game,
      duplicateCount: this.holders().get(game.nameKey)?.length ?? 1,
      byText: null,
      alsoText: this.alsoText(game.nameKey, { kind: 'host', userId: hostId }),
      warnText: null,
      action: null,
      menu: this.isHost(),
      envy: true,
    }));
  });

  private readonly broughtItems = computed<RowView[]>(() => {
    const tone = this.theme.tone();
    const me = this.currentUserId();
    return this.brings().map((bring) => {
      const mine = bring.bringer.userId === me;
      return {
        game: bring.game,
        duplicateCount: this.holders().get(bring.game.nameKey)?.length ?? 1,
        byText: mine
          ? tone['event_games.by_me']
          : fillTone(tone['event_games.by_other'], { nom: bring.bringer.displayName }),
        alsoText: this.alsoText(bring.game.nameKey, {
          kind: 'bring',
          userId: bring.bringer.userId,
        }),
        warnText: null,
        action: mine ? 'unbring' : null,
        menu: false,
        envy: true,
      };
    });
  });

  /** Mes jeux pas encore apportés ici, chacun avec « J'apporte » et, s'il est déjà sur place, « ⚠ déjà chez … ». */
  private readonly mineItems = computed<RowView[]>(() => {
    const tone = this.theme.tone();
    const me = this.currentUserId();
    const brought = new Set(
      this.brings()
        .filter((b) => b.bringer.userId === me)
        .map((b) => b.game.id),
    );
    return (this.myGames() ?? [])
      .filter((game) => !brought.has(game.id))
      .map((game) => {
        const there = this.holders().get(game.nameKey) ?? [];
        return {
          game,
          duplicateCount: 1,
          byText: null,
          alsoText: null,
          warnText:
            there.length > 0
              ? fillTone(tone['event_games.already_at'], {
                  nom: joinNames(there.map((h) => h.name)),
                })
              : null,
          action: 'bring',
          menu: false,
          envy: false,
        };
      });
  });

  /**
   * Sous le filtre « Jouables à {N} », ne garde que les lignes jouables (un jeu sans bornes n'y est jamais). Story 49.5 :
   * sous le tri « Les plus appelées », range les lignes qui portent une Envie par nombre d'Envies décroissant, puis
   * alphabétique (même ordre que l'API) — jamais « Dans mon … », dont les lignes n'ont pas d'Envie. Le tri ne retire rien :
   * les comptes « k sur n » ne suivent que le filtre.
   */
  private filtered(items: RowView[]): RowView[] {
    const fit = this.fitOnly()
      ? items.filter((item) => fitsHeadcount(item.game, this.headcount()))
      : items;
    if (!this.sortEnvy() || !fit.some((item) => item.envy)) return fit;
    const views = this.envyViews();
    const count = (item: RowView) => views.get(item.game.nameKey)?.count ?? 0;
    return [...fit].sort(
      (a, b) =>
        count(b) - count(a) || compareGames(a.game, b.game) || a.game.id.localeCompare(b.game.id),
    );
  }

  protected readonly hostView = computed(() => this.filtered(this.hostItems()));
  protected readonly broughtView = computed(() => this.filtered(this.broughtItems()));
  protected readonly mineView = computed(() => this.filtered(this.mineItems()));
  protected readonly hostTotal = computed(() => this.hostItems().length);
  protected readonly broughtTotal = computed(() => this.broughtItems().length);
  protected readonly mineTotal = computed(() => this.mineItems().length);
  protected readonly mineLoaded = computed(() => this.myGames() !== null);
  /** Ma Ludothèque est lue ET vide (et non « pas encore lue ») : « Votre cabinet est vide. » */
  protected readonly libraryEmpty = computed(() => (this.myGames()?.length ?? -1) === 0);

  private sequence = 0;
  private mineSequence = 0;
  private lastCount: number | null = null;

  constructor() {
    // Chargement initial, et rechargement si la partie ou la conjonction affichée change.
    effect(() => {
      this.partieId();
      this.cardId();
      untracked(() => void this.reload());
    });

    let firstRun = true;
    effect(() => {
      this.parties.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.reload());
    });

    // La liste des noms se referme pour de bon quand elle n'a plus rien à dire (dernière Envie partie) ou que la ligne
    // qui porte son compte a disparu (jeu écarté, apport retiré, filtre) : sans cela une Envie ultérieure la rouvrirait
    // d'elle-même, ancrée sur un bouton détruit. Le focus n'est rendu que s'il était dans la liste.
    effect(() => {
      const game = this.envyNamesGame();
      if (game === null) return;
      const rowPresent = [...this.hostView(), ...this.broughtView()].some(
        (item) => item.game.id === game.id,
      );
      if (rowPresent && this.envyNamesList().length > 0) return;
      untracked(() => {
        const hadFocus = document.querySelector('.egt-names')?.contains(document.activeElement);
        const trigger = this.envyNamesOrigin();
        this.closeEnvyNames(false);
        // Le focus est rendu APRÈS le rendu qui retire la ligne : avant, le compte est encore dans le DOM.
        if (hadFocus === true) {
          afterNextRender(() => this.restoreEnvyFocus(trigger, game), { injector: this.injector });
        }
      });
    });

    // La personne devient participante après le premier chargement (inscription acceptée) : sa Ludothèque est lue.
    let wasMine = false;
    effect(() => {
      const mine = this.showMine();
      untracked(() => {
        if (mine && !wasMine && this.data() !== null) void this.loadMine();
        wasMine = mine;
      });
    });
  }

  protected isBusy(gameId: string): boolean {
    return this.busy().has(gameId);
  }

  protected onAct(item: RowView): void {
    if (item.action === 'bring') void this.write(item.game, true);
    else if (item.action === 'unbring') void this.write(item.game, false);
  }

  /** Nom accessible du ⋮ d'une ligne (« Actions pour Azul ») ; `null` : la ligne n'en porte pas. */
  protected menuLabel(item: RowView): string | null {
    return item.menu
      ? fillTone(this.theme.tone()['event_games.menu_trigger_aria'], { nom: item.game.name })
      : null;
  }

  protected menuAriaLabel(): string {
    return fillTone(this.theme.tone()['event_games.menu_aria'], {
      nom: this.menuGame()?.name ?? '',
    });
  }

  /** Le ⋮ d'une ligne a été touché : ouvre le menu de ce jeu, ancré sur le bouton, le focus sur son entrée. */
  protected openMenu(game: BoardGameDto, trigger: HTMLElement): void {
    this.menuOrigin.set(trigger);
    this.menuGame.set(game);
    // Le menu n'existe dans le DOM qu'après le prochain rendu : le focus va sur sa première entrée.
    afterNextRender(() => this.menuItems()[0]?.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  /** Referme le menu ; `restoreFocus` rend le focus au ⋮ (sauf quand la ligne va disparaître). */
  protected closeMenu(restoreFocus: boolean): void {
    const trigger = this.menuOrigin();
    this.menuGame.set(null);
    if (restoreFocus) trigger.focus();
  }

  /** Les entrées du menu ouvert — dans le conteneur d'overlays du CDK, hors du DOM de l'onglet. */
  private menuItems(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.egt-menu [role="menuitem"]'));
  }

  /** Clavier du menu (patron WAI-ARIA « menu button ») : Échap referme et rend le focus au ⋮, les flèches bouclent sur
   *  les entrées, Début / Fin vont aux extrémités ; Tab referme et laisse le focus continuer depuis le ⋮. */
  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => {
      event.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.closeMenu(true);
        break;
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(items.length - 1);
        break;
      case 'Tab':
        // Le focus passe au ⋮ AVANT la fermeture (l'entrée focalisée va disparaître) ; pas de preventDefault.
        this.closeMenu(true);
        break;
    }
  }

  /** Story 49.5 : le ♥ d'une ligne a été touché — bascule mon Envie sur ce NOM. */
  protected onEnvyToggle(nameKey: string): void {
    const mine = this.envyViews().get(nameKey)?.mine ?? false;
    void this.setEnvy(nameKey, !mine);
  }

  /** Story 49.5 : le compte d'une ligne a été touché — ouvre la liste des noms, ancrée sur le bouton, le focus dessus. */
  protected openEnvyNames(game: BoardGameDto, trigger: HTMLElement): void {
    this.envyNamesOrigin.set(trigger);
    this.envyNamesGame.set({ id: game.id, name: game.name, nameKey: game.nameKey });
    afterNextRender(
      () => document.querySelector<HTMLElement>('.egt-names')?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  /** Referme la liste ; `restoreFocus` rend le focus au compte qui l'a ouverte. */
  protected closeEnvyNames(restoreFocus: boolean): void {
    const trigger = this.envyNamesOrigin();
    const game = this.envyNamesGame();
    this.envyNamesGame.set(null);
    if (restoreFocus) this.restoreEnvyFocus(trigger, game);
  }

  /** Rend le focus au compte ; s'il a disparu avec sa ligne, au ♥ d'une ligne du même nom, à défaut il n'est pas déplacé. */
  private restoreEnvyFocus(trigger: HTMLElement, game: { nameKey: string } | null): void {
    if (trigger.isConnected) {
      trigger.focus();
      return;
    }
    if (game === null) return;
    const ids = new Set(
      [...this.hostView(), ...this.broughtView()]
        .filter((item) => item.game.nameKey === game.nameKey)
        .map((item) => item.game.id),
    );
    const li = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('li[data-game-id]'),
    );
    li.find((el) => ids.has(el.dataset['gameId'] ?? ''))
      ?.querySelector<HTMLElement>('.et__heart')
      ?.focus();
  }

  /** Clavier de la liste : Échap referme et rend le focus au compte ; Tab referme et laisse le focus continuer. */
  protected onEnvyNamesKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeEnvyNames(true);
    } else if (event.key === 'Tab') {
      this.closeEnvyNames(true);
    }
  }

  protected envyNamesAriaLabel(): string {
    return fillTone(this.theme.tone()['event_games.envy_names_aria'], {
      nom: this.envyNamesGame()?.name ?? '',
    });
  }

  /**
   * Signaler / retirer mon Envie sur un NOM (Story 49.5) : le ♥ et le compte changent AUSSITÔT (mise à jour locale), puis
   * l'écriture part et la liste est relue — le serveur est seul juge. Même garde que l'apport, mais par `nameKey` (deux
   * lignes du même nom partagent l'Envie et la garde) ; un refus (400/403) ou un nom disparu n'affiche rien de bloquant,
   * la relecture remet la liste d'aplomb. Seul un participant bascule.
   */
  private async setEnvy(nameKey: string, on: boolean): Promise<void> {
    const eventId = this.event()?.id ?? null;
    const me = this.currentUserId();
    if (eventId === null || me === null || !this.canFill() || this.envyBusy().has(nameKey)) return;
    this.envyBusy.update((s) => new Set(s).add(nameKey));
    this.data.update((dto) => {
      if (dto === null) return dto;
      const current = dto.envies.find((e) => e.nameKey === nameKey);
      const users = (current?.users ?? []).filter((u) => u.userId !== me);
      if (on) users.push({ userId: me, pseudo: '', displayName: '' });
      const others = dto.envies.filter((e) => e.nameKey !== nameKey);
      const envies = (users.length > 0 ? [...others, { nameKey, users }] : others).sort((a, b) =>
        a.nameKey.localeCompare(b.nameKey, 'fr'),
      );
      return { ...dto, envies };
    });
    try {
      await (on ? this.api.envy(eventId, nameKey) : this.api.unenvy(eventId, nameKey));
    } catch {
      // Refus ou nom disparu : rien de bloquant — la relecture ci-dessous dit l'état réel.
    }
    try {
      await this.reload();
    } finally {
      this.envyBusy.update((s) => {
        const next = new Set(s);
        next.delete(nameKey);
        return next;
      });
    }
  }

  /** L'entrée unique du menu a été choisie : le jeu quitte « Chez moi » aussitôt. */
  protected onExcludeChosen(): void {
    const game = this.menuGame();
    if (game === null) return;
    this.closeMenu(false);
    void this.setAside(game, true);
  }

  /** « Lever le sceau / Ressortir / Remettre en service » : le jeu retourne dans « Chez moi », pour tous. */
  protected onRestore(game: BoardGameDto): void {
    void this.setAside(game, false);
  }

  /**
   * Écarter / remettre un jeu pour cette soirée (Story 49.4) : le jeu change de section AUSSITÔT (mise à jour locale),
   * puis l'écriture part et la liste est relue — le serveur est seul juge. Même garde que l'apport : un refus
   * (400/403) ou un jeu disparu (404) n'affiche rien de bloquant, la relecture remet la liste d'aplomb ; un second
   * toucher sur le même jeu pendant l'écriture est ignoré. Le bouton touché disparaît avec la ligne : le focus va à la
   * ligne voisine, à défaut à l'en-tête de la section.
   */
  private async setAside(game: BoardGameDto, aside: boolean): Promise<void> {
    const eventId = this.event()?.id ?? null;
    if (eventId === null || !this.isHost() || this.busy().has(game.id)) return;
    this.busy.update((s) => new Set(s).add(game.id));
    this.focusNeighbour(game, aside);
    this.data.update((dto) => {
      if (dto === null) return dto;
      const games = dto.games.filter((g) => g.id !== game.id);
      const excluded = (dto.excludedGames ?? []).filter((g) => g.id !== game.id);
      const byName = (a: BoardGameDto, b: BoardGameDto) =>
        compareGames(a, b) || a.id.localeCompare(b.id);
      return aside
        ? { ...dto, games, excludedGames: [...excluded, game].sort(byName) }
        : { ...dto, games: [...games, game].sort(byName), excludedGames: excluded };
    });
    try {
      await (aside ? this.api.exclude(eventId, game.id) : this.api.restore(eventId, game.id));
    } catch {
      // Refus ou jeu disparu : rien de bloquant — la relecture ci-dessous dit l'état réel.
    }
    try {
      await this.reload();
    } finally {
      this.busy.update((s) => {
        const next = new Set(s);
        next.delete(game.id);
        return next;
      });
    }
  }

  /** Après le prochain rendu, donne le focus à la ligne voisine de celle qui part, sinon à l'en-tête de sa section
   *  (puis à celui de l'autre section) — la ligne touchée, et son bouton avec elle, ne sont plus dans le DOM. */
  private focusNeighbour(game: BoardGameDto, aside: boolean): void {
    const leaving = aside ? HOST_SECTION_KEY : EXCLUDED_SECTION_KEY;
    const arriving = aside ? EXCLUDED_SECTION_KEY : HOST_SECTION_KEY;
    const control = aside ? '.gr__menu' : '.ur__action';
    const rows = aside ? this.hostView().map((i) => i.game) : this.excludedGames();
    const at = rows.findIndex((g) => g.id === game.id);
    const next = rows[at + 1] ?? rows[at - 1] ?? null;
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const section = (key: string) =>
          root.querySelector<HTMLElement>(`app-games-section[data-section="${key}"]`);
        const neighbour =
          next === null
            ? undefined
            : Array.from(section(leaving)?.querySelectorAll<HTMLElement>('li') ?? []).find(
                (li) => li.dataset['gameId'] === next.id,
              );
        const target =
          neighbour?.querySelector<HTMLElement>(control) ??
          section(leaving)?.querySelector<HTMLElement>('.gs__header') ??
          section(arriving)?.querySelector<HTMLElement>('.gs__header');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Apporter / ne plus apporter : la ligne change de section AUSSITÔT (mise à jour locale), puis l'écriture part et
   * la liste est relue — le serveur est seul juge. Un refus (400/403) ou un jeu disparu (404) n'affiche rien de
   * bloquant : la relecture remet la liste d'aplomb. Un second toucher sur le même jeu pendant l'écriture est ignoré.
   */
  private async write(game: BoardGameDto, bring: boolean): Promise<void> {
    const eventId = this.event()?.id ?? null;
    const me = this.currentUserId();
    if (eventId === null || me === null || this.busy().has(game.id)) return;
    this.busy.update((s) => new Set(s).add(game.id));
    this.data.update((dto) => {
      if (dto === null) return dto;
      const others = dto.brings.filter((b) => b.game.id !== game.id);
      const mine: EventBringDto[] = bring
        ? [{ game, bringer: { userId: me, pseudo: '', displayName: '' } }]
        : [];
      return {
        ...dto,
        brings: [...others, ...mine].sort(
          (a, b) => compareGames(a.game, b.game) || a.game.id.localeCompare(b.game.id),
        ),
      };
    });
    try {
      await (bring ? this.api.bring(eventId, game.id) : this.api.unbring(eventId, game.id));
    } catch {
      // Refus ou jeu disparu : rien de bloquant — la relecture ci-dessous dit l'état réel.
    }
    try {
      await this.reload();
    } finally {
      this.busy.update((s) => {
        const next = new Set(s);
        next.delete(game.id);
        return next;
      });
    }
  }

  private async reload(): Promise<void> {
    const sequence = ++this.sequence;
    try {
      let eventId = this.card()?.id ?? null;
      if (eventId === null) {
        const list = await this.api.list(this.partieId());
        if (sequence !== this.sequence) return;
        const first = list[0] ?? null;
        this.loadedCard.set(first);
        eventId = first?.id ?? null;
      }
      // Aucun événement lu (rencontre sans événement) : rien à montrer.
      if (eventId === null) return;
      // Ma Ludothèque se lit en parallèle, pour un participant autre que l'hôte seulement.
      const mine = this.showMine() ? this.loadMine() : null;
      const dto = await this.api.boardGames(eventId);
      if (sequence !== this.sequence) return;
      this.apply(dto);
      await mine;
    } catch {
      // Échec transitoire : le dernier état connu reste affiché ; sans état, le repli neutre.
      if (sequence === this.sequence) this.failed.set(true);
    }
  }

  /** Lit ma Ludothèque ; un échec garde la dernière lecture (la section n'apparaît pas tant qu'il n'y en a aucune). */
  private async loadMine(): Promise<void> {
    const sequence = ++this.mineSequence;
    try {
      const games = await this.library.list();
      if (sequence === this.mineSequence) this.myGames.set(games);
    } catch {
      // Échec transitoire : on garde ce qu'on avait.
    }
  }

  private apply(dto: EventBoardGamesDto): void {
    const previous = this.data()?.participantsCount ?? null;
    this.data.set(dto);
    this.failed.set(false);
    if (previous !== null && previous !== dto.participantsCount) {
      this.announcement.set(this.announce(dto));
    }
    const count = dto.games.length + dto.brings.length;
    if (this.lastCount !== count) {
      this.lastCount = count;
      this.countChange.emit(count);
    }
  }

  /** « 7 participants : 4 jeux jouables à 7. » (accords au singulier pour 1). */
  private announce(dto: EventBoardGamesDto): string {
    const tone = this.theme.tone();
    const total = dto.participantsCount;
    const k = [...dto.games, ...dto.brings.map((b) => b.game)].filter((g) =>
      fitsHeadcount(g, total),
    ).length;
    return fillTone(tone['event_games.announce'], {
      participants: fillTone(
        tone[total <= 1 ? 'event_games.participants_one' : 'event_games.participants_many'],
        { total },
      ),
      playable: fillTone(tone[k <= 1 ? 'event_games.playable_one' : 'event_games.playable_many'], {
        k,
        total,
      }),
    });
  }
}
