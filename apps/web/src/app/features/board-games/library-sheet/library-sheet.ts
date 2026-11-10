import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import type { UserLibraryDto } from '@master-jdr/shared';
import { BoardGamesService } from '../../../core/board-games/board-games.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { formatBoardGameMeasures } from '../board-game-measures';

/** Distance de glissement vers le bas (px) à partir de laquelle le tiroir se ferme au relâchement. */
export const LIBRARY_SHEET_SWIPE_CLOSE_PX = 80;

/**
 * ⚠️ `LibrarySheet` (Story 48.3, EXPERIENCE.md §2.4) — la Ludothèque d'UNE personne, en lecture seule,
 * dans un tiroir modal du bas (aussi au-delà de 768 px) : voile, surface fixe en bas, rayon haut de
 * 18 px, `surface-container-high`, poignée de 40 × 4 px. Titre « Cabinet / Coffre / Râtelier de {nom} ·
 * {n} », ligne de prêt, puis les jeux (nom, mesures), sans troncature ; la surface défile au-delà de
 * 80 vh. Une Ludothèque vide le dit en une ligne du thème, sans rien suggérer.
 *
 * Aucune action d'écriture. Fermeture : `Échap` (écouté en capture sur le document et arrêté — une
 * fenêtre d'hôte, `DetailSurface` ou `MatDialog`, reste ouverte), clic sur le voile, glissement vers
 * le bas sur la poignée ou le titre. Le focus est piégé, puis rendu à l'élément touché
 * (`returnFocus`) — l'hôte ne le fait pas à sa place.
 *
 * Empilement : l'hôte est déplacé sous `<body>` après le premier rendu (comme `DetailSurface`
 * `portal`) pour échapper à tout contexte d'empilement ou bloc conteneur d'une fenêtre qui l'ouvre ;
 * voile et surface sont au-dessus de la `DetailSurface` (z 199/200).
 *
 * Temps réel : la feuille se relit sur `BoardGamesService.changed` pendant qu'elle est ouverte (la page
 * de la partie est déjà abonnée à `partie:{id}`, que toute écriture d'un jeu émet). Une lecture
 * dépassée par une plus récente est ignorée. Un 404 — droit perdu, compte inconnu — montre le repli
 * neutre `board_games.error_fallback`.
 */
@Component({
  selector: 'app-library-sheet',
  imports: [CdkTrapFocus],
  templateUrl: './library-sheet.html',
  styleUrl: './library-sheet.scss',
})
export class LibrarySheet {
  private readonly boardGames = inject(BoardGamesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly theme = inject(ThemeToneService);

  /** La personne dont on lit la Ludothèque. */
  readonly userId = input.required<string>();
  /** Son nom, tel que l'écran de l'hôte l'affiche (la touche qu'on vient d'activer). */
  readonly name = input.required<string>();
  /** L'élément touché pour ouvrir : le focus lui revient à la fermeture. */
  readonly returnFocus = input<HTMLElement | null>(null);
  readonly closed = output<void>();

  protected readonly library = signal<UserLibraryDto | null>(null);
  protected readonly failed = signal(false);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Numéro de la dernière lecture : une réponse plus ancienne n'écrase rien. */
  private sequence = 0;

  protected readonly title = computed(() => {
    const library = this.library();
    if (library === null) return null;
    return fillTone(this.theme.tone()['board_games.sheet_title'], {
      nom: this.name(),
      n: library.games.length,
    });
  });

  /** Nom accessible du dialogue : le repli neutre en cas d'échec, le titre une fois la liste lue, sinon
   *  l'invite de l'ouverture. */
  protected readonly dialogLabel = computed(() => {
    if (this.failed()) return this.theme.tone()['board_games.error_fallback'];
    return (
      this.title() ?? fillTone(this.theme.tone()['board_games.open_aria'], { nom: this.name() })
    );
  });

  protected readonly loanLine = computed(() =>
    fillTone(this.theme.tone()['board_games.sheet_loan'], { nom: this.name() }),
  );

  protected readonly emptyLine = computed(() =>
    fillTone(this.theme.tone()['board_games.sheet_empty'], { nom: this.name() }),
  );

  protected readonly rows = computed(() => {
    const tone = this.theme.tone();
    return (this.library()?.games ?? []).map((game) => ({
      id: game.id,
      name: game.name,
      measures: formatBoardGameMeasures(game, tone),
    }));
  });

  // ─── Glissement vers le bas ──────────────────────────────────────────────────

  /** Décalage vertical suivi pendant le glissement (px, jamais négatif). */
  protected readonly dragOffset = signal(0);
  private dragStartY: number | null = null;
  private dragPointerId: number | null = null;

  constructor() {
    // Première lecture, puis relecture sur chaque `changed` (temps réel) ou changement de personne.
    effect(() => {
      const userId = this.userId();
      this.boardGames.changed();
      untracked(() => void this.load(userId));
    });

    afterNextRender(() => {
      const host = this.host.nativeElement;
      if (host.parentElement !== document.body) document.body.appendChild(host);
      // Un nœud déplacé perd le focus : on le donne à la surface (le piège de focus l'y garde).
      this.panel()?.nativeElement.focus();
    });

    // Capture sur le document : `Échap` ferme CETTE feuille avant qu'un dialogue d'hôte ne le voie.
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close();
    };
    document.addEventListener('keydown', onEscape, true);

    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', onEscape, true);
      // L'hôte déplacé n'est plus un descendant du composant parent : Angular ne le retirerait pas.
      this.host.nativeElement.remove();
      const target = this.returnFocus();
      if (target?.isConnected) target.focus();
    });
  }

  private async load(userId: string): Promise<void> {
    const seq = ++this.sequence;
    try {
      const library = await this.boardGames.listOf(userId);
      if (seq !== this.sequence) return;
      this.library.set(library);
      this.failed.set(false);
    } catch (err) {
      if (seq !== this.sequence) return;
      // Droit perdu ou compte inconnu : plus rien à montrer. Toute autre panne garde la liste déjà lue.
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.library.set(null);
        this.failed.set(true);
      } else if (this.library() === null) {
        this.failed.set(true);
      }
    }
  }

  /** Le bouton « Fermer » : un pointeur posé dessus ne doit pas armer le glissement de l'en-tête (la
   *  capture du pointeur lui volerait le clic). */
  protected stopPointer(event: Event): void {
    event.stopPropagation();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onGripPointerDown(event: PointerEvent): void {
    // Souris : le bouton principal seulement.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.dragStartY = event.clientY;
    this.dragPointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected onGripPointerMove(event: PointerEvent): void {
    if (this.dragStartY === null || event.pointerId !== this.dragPointerId) return;
    this.dragOffset.set(Math.max(0, event.clientY - this.dragStartY));
  }

  protected onGripPointerUp(event: PointerEvent): void {
    if (this.dragStartY === null || event.pointerId !== this.dragPointerId) return;
    const distance = Math.max(0, event.clientY - this.dragStartY);
    this.resetDrag();
    if (distance >= LIBRARY_SHEET_SWIPE_CLOSE_PX) this.close();
  }

  protected onGripPointerCancel(): void {
    this.resetDrag();
  }

  private resetDrag(): void {
    this.dragStartY = null;
    this.dragPointerId = null;
    this.dragOffset.set(0);
  }
}
