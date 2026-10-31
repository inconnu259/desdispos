import { Component, computed, inject, input, output } from '@angular/core';
import type { BoardGameDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { formatBoardGameMeasures } from '../../board-games/board-game-measures';

/**
 * `UnavailableRow` (Story 49.4, DESIGN §7.5) — un jeu de l'hôte écarté pour cette soirée, vu par l'hôte seul, dans la
 * section du bas. Le nom et les mesures sont estompés à 45 % d'opacité (aucun rouge : rien d'irréversible) ; le
 * bouton themé « Lever le sceau / Ressortir / Remettre en service » reste à plein contraste, 44 px au moins, nommé
 * « {libellé} — {jeu} ». Occupé, il est désactivé (un second toucher ne part pas). La ligne ne décide rien : elle
 * émet `restore`, l'onglet écrit.
 */
@Component({
  selector: 'app-unavailable-row',
  template: `
    <div class="ur">
      <span class="ur__info">
        <span class="ur__name">{{ game().name }}</span>
        @if (measures(); as text) {
          <span class="ur__meta">{{ text }}</span>
        }
      </span>
      <button
        type="button"
        class="ur__action"
        [disabled]="busy()"
        [attr.aria-label]="restoreLabel() + ' — ' + game().name"
        (click)="restore.emit()"
      >
        {{ restoreLabel() }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .ur {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      box-sizing: border-box;
      min-height: 44px;
      padding: 7px 9px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: var(--mat-sys-surface-container, transparent);
    }

    /* 45 % d'opacité : le contenu seul, jamais le bouton (DESIGN §7.5). */
    .ur__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      opacity: 0.45;
    }

    .ur__name {
      font-size: 13px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .ur__meta {
      font-size: 11px;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
    }

    .ur__action {
      box-sizing: border-box;
      flex: none;
      min-width: 44px;
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--mat-sys-outline, currentColor);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;

      &:disabled {
        opacity: 0.6;
        cursor: default;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
  `,
})
export class UnavailableRow {
  private readonly theme = inject(ThemeToneService);

  readonly game = input.required<BoardGameDto>();
  /** Libellé themé du bouton (« Lever le sceau », « Ressortir », « Remettre en service »). */
  readonly restoreLabel = input.required<string>();
  /** Une écriture de cette ligne est en cours : le bouton est désactivé. */
  readonly busy = input(false);
  /** Le bouton a été touché : l'onglet remet le jeu à tous. */
  readonly restore = output<void>();

  protected readonly measures = computed(() =>
    formatBoardGameMeasures(this.game(), this.theme.tone()),
  );
}
