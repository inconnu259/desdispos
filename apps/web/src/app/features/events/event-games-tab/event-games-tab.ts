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
import type { EventBoardGamesDto, EventCardDto } from '@master-jdr/shared';
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

/**
 * Onglet des jeux sur place d'une soirée à venir (Story 49.1, épic 49) — lecture seule : les jeux de l'hôte
 * (jamais copiés), le nombre de participants N et ce qui en est jouable. Il ne sert que les soirées OUVERTES ;
 * l'écran qui l'héberge (rencontre isolée, fenêtre d'une conjonction de groupe) ne le pose pas pour une soirée
 * passée, terminée ou annulée.
 *
 * Contenu (EXPERIENCE.md §2.3) : `GamesSummary` (« {n} jeux sur place · {k} jouables à {N} » et la puce
 * « Jouables à {N} »), puis une `GamesSection` repliable « Chez {hôte} » (« Chez moi » pour l'hôte), une ligne
 * `GameRow` par jeu, alphabétique, sans troncature. Sans jeu sur place : une ligne themée et, pour l'hôte et les
 * participants seulement, le lien discret vers « mon cabinet / coffre / râtelier ».
 *
 * Données : la carte de l'événement vient de l'hôte de l'onglet (`card`, la fenêtre d'une conjonction) ou, à défaut,
 * est lue ici par `events-api.list(partieId)` (la rencontre isolée n'en porte qu'une). Le nombre de jeux est remonté
 * par `countChange` pour le libellé de l'onglet (« Reliques · 6 »).
 *
 * Temps réel : la page de la partie tient DÉJÀ la connexion `partie:{id}` et `PartiesService.changed()` est notifié
 * à chaque mutation (jeu ajouté par l'hôte, inscription, désinscription) — l'onglet s'y abonne par un `effect()`
 * (premier passage ignoré), sans ouvrir de connexion ni ajouter de handler. Rechargement protégé par un numéro de
 * requête (une réponse périmée n'écrase pas une plus fraîche), dernier état connu conservé sur un échec transitoire.
 * Quand N change (jamais au premier chargement), une annonce polie le dit dans une région `role="status"` toujours
 * présente — aucun bandeau visible.
 */
@Component({
  selector: 'app-event-games-tab',
  imports: [RouterLink, GamesSummary, GamesSection, GameRow],
  templateUrl: './event-games-tab.html',
  styleUrl: './event-games-tab.scss',
})
export class EventGamesTab {
  protected readonly theme = inject(ThemeToneService);
  private readonly api = inject(EventsApiService);
  private readonly parties = inject(PartiesService);

  readonly partieId = input.required<string>();
  /** La carte de la conjonction, quand l'hôte de l'onglet la tient déjà ; sinon l'onglet la lit lui-même. */
  readonly card = input<EventCardDto | null>(null);
  /** La personne connectée, fournie par l'écran qui héberge l'onglet (jamais lue ici : l'onglet ne dépend d'aucun service de session). */
  readonly currentUserId = input<string | null>(null);
  /** La personne est l'hôte ou participe (rencontre isolée : tout membre/invité). `null` : déduit de la carte. */
  readonly contributor = input<boolean | null>(null);
  /** Nombre de jeux sur place, à chaque lecture — pour le libellé de l'onglet. */
  readonly countChange = output<number>();

  /** Carte lue par l'onglet lui-même (seulement quand `card` n'est pas fourni). */
  private readonly loadedCard = signal<EventCardDto | null>(null);
  private readonly event = computed(() => this.card() ?? this.loadedCard());
  private readonly cardId = computed(() => this.card()?.id ?? null);

  protected readonly data = signal<EventBoardGamesDto | null>(null);
  protected readonly failed = signal(false);
  protected readonly fitOnly = signal(false);
  /** Annonce polie du dernier changement de N (vide tant que N n'a pas changé). */
  protected readonly announcement = signal('');
  protected readonly hostSectionKey = HOST_SECTION_KEY;

  protected readonly games = computed(() => this.data()?.games ?? []);
  /** N : le nombre de participants, tel que calculé par le serveur. */
  protected readonly headcount = computed(() => this.data()?.participantsCount ?? 0);
  protected readonly fitting = computed(
    () => this.games().filter((g) => fitsHeadcount(g, this.headcount())).length,
  );
  /** Les jeux affichés : tous, ou — filtre actif — ceux jouables à N (un jeu sans bornes n'y est jamais). */
  protected readonly visible = computed(() =>
    this.fitOnly() ? this.games().filter((g) => fitsHeadcount(g, this.headcount())) : this.games(),
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

  private sequence = 0;
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
      const dto = await this.api.boardGames(eventId);
      if (sequence !== this.sequence) return;
      this.apply(dto);
    } catch {
      // Échec transitoire : le dernier état connu reste affiché ; sans état, le repli neutre.
      if (sequence === this.sequence) this.failed.set(true);
    }
  }

  private apply(dto: EventBoardGamesDto): void {
    const previous = this.data()?.participantsCount ?? null;
    this.data.set(dto);
    this.failed.set(false);
    if (previous !== null && previous !== dto.participantsCount) {
      this.announcement.set(this.announce(dto));
    }
    if (this.lastCount !== dto.games.length) {
      this.lastCount = dto.games.length;
      this.countChange.emit(dto.games.length);
    }
  }

  /** « 7 participants : 4 jeux jouables à 7. » (accords au singulier pour 1). */
  private announce(dto: EventBoardGamesDto): string {
    const tone = this.theme.tone();
    const total = dto.participantsCount;
    const k = dto.games.filter((g) => fitsHeadcount(g, total)).length;
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
