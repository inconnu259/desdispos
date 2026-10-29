import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { BoardGameDto } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService, userTopic } from '../../../core/realtime/realtime.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { formatBoardGameMeasures } from '../board-game-measures';

/** Valeur numérique d'un champ facultatif : vide → `null`, sinon le nombre saisi (le serveur borne). */
function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Message d'une réponse d'erreur de l'API : texte simple, ou premier message de la validation globale. */
function serverMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const message: unknown = (err.error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return null;
}

/** Même ordre que l'API : clé normalisée, puis nom. */
function compareGames(a: BoardGameDto, b: BoardGameDto): number {
  return a.nameKey.localeCompare(b.nameKey, 'fr') || a.name.localeCompare(b.name, 'fr');
}

/**
 * ⚠️ Page « Ma Ludothèque » (Story 48.1, EXPERIENCE.md §2.4) — route `profile/board-games`, ouverte
 * depuis la ligne du compte. Titre du thème et sous-titre de visibilité dans le bandeau ; saisie en
 * série (`QuickAddRow`) en tête, puis la liste alphabétique. Vide : la saisie seule, sans texte
 * d'incitation.
 *
 * Temps réel : la page ouvre `user:{id}` elle-même et relit la liste sur `BoardGamesService.changed`
 * (les autres onglets de la même personne suivent un ajout). Une lecture dépassée par une plus récente
 * — ou par un ajout — est ignorée.
 */
@Component({
  selector: 'app-board-games-page',
  templateUrl: './board-games-page.html',
  styleUrl: './board-games-page.scss',
})
export class BoardGamesPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly boardGames = inject(BoardGamesService);
  private readonly realtime = inject(RealtimeService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeToneService);

  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  /** `null` tant que la première lecture n'a pas abouti. */
  protected readonly games = signal<BoardGameDto[] | null>(null);
  protected readonly loadError = signal(false);

  // Saisie en série : valeurs brutes des champs (les nombres sont lus à l'envoi).
  protected readonly name = signal('');
  protected readonly minPlayers = signal('');
  protected readonly maxPlayers = signal('');
  protected readonly durationMin = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  /** Max < min, les deux renseignés : message sous le champ, envoi bloqué. */
  protected readonly maxBelowMin = computed(() => {
    const min = parseOptionalNumber(this.minPlayers());
    const max = parseOptionalNumber(this.maxPlayers());
    return min !== null && max !== null && max < min;
  });

  protected readonly canSubmit = computed(
    () => this.name().trim().length > 0 && !this.maxBelowMin() && !this.submitting(),
  );

  protected readonly rows = computed(() => {
    const tone = this.theme.tone();
    return (this.games() ?? []).map((game) => ({
      id: game.id,
      name: game.name,
      measures: formatBoardGameMeasures(game, tone),
    }));
  });

  /** Numéro de la dernière lecture ou écriture : une réponse plus ancienne n'écrase rien. */
  private sequence = 0;

  constructor() {
    // Le bandeau suit un changement de thème sans navigation (même patron que l'écran du compte).
    effect(() => {
      const tone = this.theme.tone();
      this.contextualNav.set({
        title: tone['board_games.title'],
        subtitle: tone['board_games.visibility'],
      });
    });

    // Relecture sur `changed` — le premier passage est sauté : ngOnInit() lit déjà la liste.
    let firstRun = true;
    effect(() => {
      this.boardGames.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.load());
    });
  }

  ngOnInit(): void {
    void this.load();
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.realtime.connect(userTopic(userId));
      this.destroyRef.onDestroy(() => this.realtime.disconnect(userTopic(userId)));
    }
  }

  private async load(): Promise<void> {
    const seq = ++this.sequence;
    try {
      const games = await this.boardGames.list();
      if (seq !== this.sequence) return;
      this.games.set(games);
      this.loadError.set(false);
    } catch {
      if (seq !== this.sequence) return;
      // Une relecture ratée garde la liste affichée ; seule une première lecture ratée le dit.
      if (this.games() === null) this.loadError.set(true);
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const created = await this.boardGames.create({
        name: this.name().trim(),
        minPlayers: parseOptionalNumber(this.minPlayers()),
        maxPlayers: parseOptionalNumber(this.maxPlayers()),
        durationMin: parseOptionalNumber(this.durationMin()),
      });
      if (this.games() === null) {
        // Rien n'a encore été lu (première lecture ratée ou en vol) : on relit toute la liste plutôt
        // que de n'afficher que le jeu ajouté.
        void this.load();
      } else {
        // L'ajout prime sur une lecture encore en vol, partie avant lui.
        this.sequence++;
        const list = this.games()!.filter((g) => g.id !== created.id);
        this.games.set([...list, created].sort(compareGames));
      }
      this.name.set('');
      this.minPlayers.set('');
      this.maxPlayers.set('');
      this.durationMin.set('');
      this.nameInput().nativeElement.focus();
    } catch (err) {
      // Champs conservés : l'erreur s'affiche sous la saisie.
      const tone = this.theme.tone();
      this.submitError.set(
        err instanceof HttpErrorResponse && err.status === 409
          ? tone['board_games.duplicate']
          : (serverMessage(err) ?? tone['board_games.error_fallback']),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected onInput(field: 'name' | 'min' | 'max' | 'duration', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Le refus précédent ne vaut plus pour une saisie modifiée.
    this.submitError.set(null);
    const target = {
      name: this.name,
      min: this.minPlayers,
      max: this.maxPlayers,
      duration: this.durationMin,
    }[field];
    target.set(value);
  }
}
