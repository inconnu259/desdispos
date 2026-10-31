import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
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
import { GameRow } from './game-row';
import { GamesSection } from './games-section';
import { GamesSummary } from './games-summary';

/** Clé de la section « Chez {hôte} » / « Chez moi » (état replié retenu dans ce navigateur). */
export const HOST_SECTION_KEY = 'host';
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
 * Temps réel : la page de la partie tient DÉJÀ la connexion `partie:{id}` et `PartiesService.changed()` est notifié
 * à chaque mutation (jeu ajouté, apport, inscription, désinscription) — l'onglet s'y abonne par un `effect()`
 * (premier passage ignoré), sans ouvrir de connexion ni ajouter de handler. Rechargement protégé par un numéro de
 * requête (une réponse périmée n'écrase pas une plus fraîche), dernier état connu conservé sur un échec transitoire.
 * Quand N change (jamais au premier chargement), une annonce polie le dit dans une région `role="status"` toujours
 * présente — aucun bandeau visible.
 */
@Component({
  selector: 'app-event-games-tab',
  imports: [NgTemplateOutlet, RouterLink, GamesSummary, GamesSection, GameRow],
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
  /** Annonce polie du dernier changement de N (vide tant que N n'a pas changé). */
  protected readonly announcement = signal('');
  /** Jeux dont une écriture (apporter / ne plus apporter) est en cours : un second toucher est ignoré. */
  private readonly busy = signal<ReadonlySet<string>>(new Set());
  protected readonly hostSectionKey = HOST_SECTION_KEY;
  protected readonly broughtSectionKey = BROUGHT_SECTION_KEY;
  protected readonly mineSectionKey = MINE_SECTION_KEY;

  private readonly hostGames = computed(() => this.data()?.games ?? []);
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
        };
      });
  });

  /** Sous le filtre « Jouables à {N} », ne garde que les lignes jouables (un jeu sans bornes n'y est jamais). */
  private filtered(items: RowView[]): RowView[] {
    return this.fitOnly()
      ? items.filter((item) => fitsHeadcount(item.game, this.headcount()))
      : items;
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
