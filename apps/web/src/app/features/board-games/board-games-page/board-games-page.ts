import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { BoardGameDto, CreateBoardGameInput } from '@master-jdr/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { AppIcon } from '../../../core/icons/app-icon';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService, userTopic } from '../../../core/realtime/realtime.service';
import { fillTone } from '../../../core/theme/tone-format';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { EventsApiService } from '../../events/events-api.service';
import { ConfirmDialog } from '../../parties/confirm-dialog/confirm-dialog';
import { formatBoardGameMeasures } from '../board-game-measures';

/** Durée d'affichage de « Jeu retiré · Annuler » (Story 48.2). */
export const BOARD_GAME_UNDO_DELAY_MS = 8000;

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

const numberText = (value: number | null): string => (value === null ? '' : String(value));

type EntryField = 'name' | 'min' | 'max' | 'duration';

/**
 * Saisie d'un jeu (`QuickAddRow`) — partagée par l'ajout en tête de page et la correction en ligne
 * (Story 48.2) : mêmes champs, mêmes règles (nom requis, max < min bloquant), même gabarit
 * (`#entryFields`). `idPrefix` garde uniques les identifiants reliés par `aria-*`.
 */
class EntryFields {
  readonly name = signal('');
  readonly minPlayers = signal('');
  readonly maxPlayers = signal('');
  readonly durationMin = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  /** Max < min, les deux renseignés : message sous le champ, envoi bloqué. */
  readonly maxBelowMin = computed(() => {
    const min = parseOptionalNumber(this.minPlayers());
    const max = parseOptionalNumber(this.maxPlayers());
    return min !== null && max !== null && max < min;
  });

  readonly canSubmit = computed(
    () => this.name().trim().length > 0 && !this.maxBelowMin() && !this.submitting(),
  );

  constructor(readonly idPrefix: string) {}

  /** Champs du formulaire, nombres lus à l'envoi. */
  values(): CreateBoardGameInput {
    return {
      name: this.name().trim(),
      minPlayers: parseOptionalNumber(this.minPlayers()),
      maxPlayers: parseOptionalNumber(this.maxPlayers()),
      durationMin: parseOptionalNumber(this.durationMin()),
    };
  }

  fill(game: BoardGameDto): void {
    this.name.set(game.name);
    this.minPlayers.set(numberText(game.minPlayers));
    this.maxPlayers.set(numberText(game.maxPlayers));
    this.durationMin.set(numberText(game.durationMin));
    this.error.set(null);
  }

  clear(): void {
    this.name.set('');
    this.minPlayers.set('');
    this.maxPlayers.set('');
    this.durationMin.set('');
  }

  set(field: EntryField, value: string): void {
    // Le refus précédent ne vaut plus pour une saisie modifiée.
    this.error.set(null);
    const target = {
      name: this.name,
      min: this.minPlayers,
      max: this.maxPlayers,
      duration: this.durationMin,
    }[field];
    target.set(value);
  }
}

/**
 * ⚠️ Page « Ma Ludothèque » (Stories 48.1, 48.2 — EXPERIENCE.md §2.4) — route `profile/board-games`,
 * ouverte depuis la ligne du compte. Titre du thème et sous-titre de visibilité dans le bandeau ;
 * saisie en série (`QuickAddRow`) en tête, puis la liste alphabétique. Vide : la saisie seule, sans
 * texte d'incitation.
 *
 * Story 48.2 : ✎ ouvre la même saisie en ligne, préremplie (une seule ligne à la fois), avec
 * « Enregistrer », le `common.annuler` du thème (⚠️ absent de la planche — décision du 2026-10-30) et
 * « Retirer de mon cabinet / coffre / râtelier ». Le retrait est immédiat — sauf, Story 49.2, pour un jeu apporté à
 * des soirées à venir, où une confirmation le précède ; une ligne d'état polie
 * entre la saisie et la liste propose « Jeu retiré · Annuler » pendant 8 s — « Annuler » recrée le jeu.
 *
 * Temps réel : la page ouvre `user:{id}` elle-même et relit la liste sur `BoardGamesService.changed`
 * (les autres onglets de la même personne suivent ajouts, corrections et retraits). Une lecture
 * dépassée par une plus récente — ou par une écriture locale — est ignorée. Une relecture garde les
 * valeurs en cours de correction ; si le jeu corrigé a disparu, la correction se ferme.
 */
@Component({
  selector: 'app-board-games-page',
  imports: [AppIcon, NgTemplateOutlet],
  templateUrl: './board-games-page.html',
  styleUrl: './board-games-page.scss',
})
export class BoardGamesPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly boardGames = inject(BoardGamesService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly realtime = inject(RealtimeService);
  private readonly contextualNav = inject(ContextualNavService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly theme = inject(ThemeToneService);

  private readonly statusRegion = viewChild.required<ElementRef<HTMLElement>>('statusRegion');

  /** `null` tant que la première lecture n'a pas abouti. */
  protected readonly games = signal<BoardGameDto[] | null>(null);
  protected readonly loadError = signal(false);

  /** Saisie en série, en tête de page. */
  protected readonly add = new EntryFields('quick-add');
  /** Correction en ligne (Story 48.2) : une seule ligne à la fois. */
  protected readonly edit = new EntryFields('board-game-edit');
  protected readonly editingId = signal<string | null>(null);

  /** Dernier jeu retiré, tant que « Jeu retiré · Annuler » est proposé. */
  protected readonly removed = signal<BoardGameDto | null>(null);
  protected readonly undoing = signal(false);
  /** Refus de la recréation (409 doublon, 400…), affiché dans la ligne d'état. */
  protected readonly undoError = signal<string | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rows = computed(() => {
    const tone = this.theme.tone();
    return (this.games() ?? []).map((game) => ({
      game,
      id: game.id,
      name: game.name,
      measures: formatBoardGameMeasures(game, tone),
      editAria: fillTone(tone['board_games.edit_aria'], { nom: game.name }),
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

    this.destroyRef.onDestroy(() => this.clearUndoTimer());
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
      // Le jeu en cours de correction a disparu (retiré dans un autre onglet) : la correction se
      // ferme. Sinon les valeurs saisies restent telles quelles.
      const editing = this.editingId();
      if (editing !== null && !games.some((g) => g.id === editing)) {
        this.closeEditAfterLoss();
      }
    } catch {
      if (seq !== this.sequence) return;
      // Une relecture ratée garde la liste affichée ; seule une première lecture ratée le dit.
      if (this.games() === null) this.loadError.set(true);
    }
  }

  // ─── Ajout (Story 48.1) ─────────────────────────────────────────────────────

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  async submit(): Promise<void> {
    if (!this.add.canSubmit()) return;
    this.add.submitting.set(true);
    this.add.error.set(null);
    try {
      const created = await this.boardGames.create(this.add.values());
      this.insertLocally(created);
      this.add.clear();
      this.focusNameField();
    } catch (err) {
      // Champs conservés : l'erreur s'affiche sous la saisie.
      this.add.error.set(this.writeErrorMessage(err));
    } finally {
      this.add.submitting.set(false);
    }
  }

  protected onInput(entry: EntryFields, field: EntryField, event: Event): void {
    entry.set(field, (event.target as HTMLInputElement).value);
  }

  // ─── Correction en ligne (Story 48.2) ───────────────────────────────────────

  protected openEdit(game: BoardGameDto): void {
    // Un enregistrement ou un retrait est en vol : son résultat doit retomber sur SA ligne.
    if (this.edit.submitting()) return;
    this.edit.fill(game);
    this.editingId.set(game.id);
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLInputElement>('.board-games-list__row--editing input[name="name"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  /** « Renoncer / Abandonner / Annuler » ou `Échap` : ferme sans enregistrer, focus rendu au ✎. */
  protected closeEdit(): void {
    const id = this.editingId();
    // Pendant un envoi en vol, fermer ne l'annulerait pas : l'écriture aboutirait quand même.
    if (id === null || this.edit.submitting()) return;
    this.editingId.set(null);
    this.edit.error.set(null);
    this.focusEditButton(id);
  }

  protected onEditKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.closeEdit();
  }

  protected onSave(event: Event): void {
    event.preventDefault();
    void this.save();
  }

  async save(): Promise<void> {
    const id = this.editingId();
    if (id === null || !this.edit.canSubmit()) return;
    this.edit.submitting.set(true);
    this.edit.error.set(null);
    try {
      const updated = await this.boardGames.update(id, this.edit.values());
      if (this.games() !== null) {
        // La correction prime sur une lecture encore en vol, partie avant elle.
        this.sequence++;
        const list = this.games()!.filter((g) => g.id !== updated.id);
        this.games.set([...list, updated].sort(compareGames));
      }
      if (this.editingId() === id) this.editingId.set(null);
      this.focusEditButton(id);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        // Retiré ailleurs entre-temps : la liste est relue, la correction se ferme.
        this.closeEditAfterLoss();
        void this.load();
      } else {
        // Champs conservés : l'erreur s'affiche sous la saisie.
        this.edit.error.set(this.writeErrorMessage(err));
      }
    } finally {
      this.edit.submitting.set(false);
    }
  }

  // ─── Retrait et « Annuler » (Story 48.2) ────────────────────────────────────

  /** Retrait du jeu en cours de correction. Story 49.2 : s'il est apporté à des soirées à venir, une confirmation
   *  dit combien (« Ce jeu est apporté à {n} soirée(s) à venir : il en sera retiré. ») AVANT le retrait, qui reste
   *  immédiat ensuite ; sans apport, aucune fenêtre, comme avant. Le compte est lu au clic : s'il échoue, l'erreur
   *  s'affiche sous la saisie et rien n'est retiré. « Renoncer » ne retire rien. */
  async removeEditing(): Promise<void> {
    const id = this.editingId();
    const game = this.games()?.find((g) => g.id === id);
    if (game === undefined || this.edit.submitting()) return;
    this.edit.submitting.set(true);
    this.edit.error.set(null);
    try {
      const count = await this.broughtCount(game);
      if (count === null) return;
      if (count > 0 && !(await this.confirmBrought(count))) return;
      await this.boardGames.remove(game.id);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.closeEditAfterLoss();
        void this.load();
      } else {
        this.edit.error.set(this.writeErrorMessage(err));
      }
      return;
    } finally {
      this.edit.submitting.set(false);
    }

    if (this.games() !== null) {
      this.sequence++;
      this.games.set(this.games()!.filter((g) => g.id !== game.id));
    }
    if (this.editingId() === game.id) this.editingId.set(null);
    this.showRemoved(game);
  }

  /** Combien de soirées à venir attendent ce jeu (Story 49.2). Un jeu déjà retiré ailleurs (404) suit le chemin
   *  du retrait en 404 ; tout autre échec : l'erreur sous la saisie, `null`, rien n'est retiré. */
  private async broughtCount(game: BoardGameDto): Promise<number | null> {
    try {
      return (await this.eventsApi.broughtCount(game.id)).count;
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) throw err;
      this.edit.error.set(this.writeErrorMessage(err));
      return null;
    }
  }

  /** La confirmation (`ConfirmDialog`, sans variante rouge : le jeu se recrée par « Annuler »). */
  private async confirmBrought(count: number): Promise<boolean> {
    const tone = this.theme.tone();
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message:
          count === 1
            ? tone['board_games.remove_brought_one']
            : fillTone(tone['board_games.remove_brought_many'], { n: count }),
        confirmLabel: tone['board_games.remove_btn'],
      },
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** « Jeu retiré · Annuler » pendant 8 s ; un nouveau retrait remplace le message en attente. */
  private showRemoved(game: BoardGameDto): void {
    this.clearUndoTimer();
    this.undoError.set(null);
    this.undoing.set(false);
    this.removed.set(game);
    this.startUndoTimer();
    afterNextRender(
      () => this.statusRegion().nativeElement.querySelector<HTMLButtonElement>('button')?.focus(),
      { injector: this.injector },
    );
  }

  /** « Annuler » : recrée le jeu retiré avec son nom et ses nombres. */
  async undo(): Promise<void> {
    const game = this.removed();
    if (game === null || this.undoing()) return;
    this.undoing.set(true);
    this.clearUndoTimer();
    try {
      const created = await this.boardGames.create({
        name: game.name,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        durationMin: game.durationMin,
      });
      // Le jeu est recréé quoi qu'il arrive : il s'affiche même si un retrait plus récent a remplacé
      // le message (qu'on laisse alors tel quel).
      this.insertLocally(created);
      if (this.removed() !== game) return;
      this.endRemovedMessage();
    } catch (err) {
      if (this.removed() !== game) return;
      // Le refus prend la place de « Annuler » dans la ligne d'état, puis s'efface à son tour.
      const hadFocus = this.focusInsideStatus();
      this.undoError.set(this.writeErrorMessage(err));
      if (hadFocus) this.focusNameField();
      this.startUndoTimer();
    } finally {
      this.undoing.set(false);
    }
  }

  private startUndoTimer(): void {
    this.undoTimer = setTimeout(() => {
      this.undoTimer = null;
      this.endRemovedMessage();
    }, BOARD_GAME_UNDO_DELAY_MS);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer !== null) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  /** Fin du message : le focus qui s'y trouvait revient au champ du nom. */
  private endRemovedMessage(): void {
    this.clearUndoTimer();
    const hadFocus = this.focusInsideStatus();
    this.removed.set(null);
    this.undoError.set(null);
    if (hadFocus) this.focusNameField();
  }

  // ─── Outils ─────────────────────────────────────────────────────────────────

  /** Ajoute localement un jeu écrit par le serveur, à sa place alphabétique. */
  private insertLocally(created: BoardGameDto): void {
    if (this.games() === null) {
      // Rien n'a encore été lu (première lecture ratée ou en vol) : on relit toute la liste plutôt
      // que de n'afficher que le jeu ajouté.
      void this.load();
      return;
    }
    // L'écriture prime sur une lecture encore en vol, partie avant elle.
    this.sequence++;
    const list = this.games()!.filter((g) => g.id !== created.id);
    this.games.set([...list, created].sort(compareGames));
  }

  /** La correction se ferme parce que le jeu n'existe plus : son ✎ a disparu, le focus qui était
   *  dans la ligne revient au champ du nom. */
  private closeEditAfterLoss(): void {
    const row = this.host.nativeElement.querySelector('.board-games-list__row--editing');
    const hadFocus = row !== null && row.contains(document.activeElement);
    this.editingId.set(null);
    this.edit.error.set(null);
    if (hadFocus) this.focusNameField();
  }

  private writeErrorMessage(err: unknown): string {
    const tone = this.theme.tone();
    return err instanceof HttpErrorResponse && err.status === 409
      ? tone['board_games.duplicate']
      : (serverMessage(err) ?? tone['board_games.error_fallback']);
  }

  private focusInsideStatus(): boolean {
    return this.statusRegion().nativeElement.contains(document.activeElement);
  }

  /** Le champ du nom de l'ajout est toujours rendu : focus immédiat. */
  private focusNameField(): void {
    this.host.nativeElement
      .querySelector<HTMLInputElement>('.quick-add--add input[name="name"]')
      ?.focus();
  }

  private focusEditButton(id: string): void {
    afterNextRender(
      () => {
        const buttons =
          this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.board-games-list__edit');
        Array.from(buttons)
          .find((b) => b.dataset['gameId'] === id)
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
