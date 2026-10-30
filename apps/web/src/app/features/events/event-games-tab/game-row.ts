import { Component, computed, inject, input } from '@angular/core';
import type { BoardGameDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { fitsHeadcount, formatBoardGameMeasures } from '../../board-games/board-game-measures';

/**
 * `GameRow` (Story 49.1, DESIGN §7.3) — un jeu sur place : son nom, ses mesures (« 2–4 joueurs · 40 min »,
 * omises quand rien n'est renseigné) et, seulement quand `minPlayers ≤ N ≤ maxPlayers` (les deux bornes
 * renseignées), la `FitPill` « jouable à N » — du texte plein, jamais la couleur seule. Ligne en lecture
 * seule : aucune action à ce palier (apporter, écarter et Envie viennent aux Stories 49.2 à 49.5).
 */
@Component({
  selector: 'app-game-row',
  template: `
    <div class="gr">
      <span class="gr__name">{{ game().name }}</span>
      @if (measures() || fits()) {
        <span class="gr__line">
          @if (measures(); as text) {
            <span class="gr__meta">{{ text }}</span>
          }
          @if (fits()) {
            <span class="gr__fit">{{ fitText() }}</span>
          }
        </span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .gr {
      display: flex;
      flex-direction: column;
      gap: 2px;
      box-sizing: border-box;
      min-height: 44px;
      justify-content: center;
      padding: 7px 9px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: var(--mat-sys-surface-container, transparent);
    }

    .gr__name {
      font-size: 13px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .gr__line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .gr__meta {
      font-size: 11px;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
    }

    .gr__fit {
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--jdr-accent-1, var(--mat-sys-primary));
      color: var(--mat-sys-on-primary, #fff);
      font-size: 10px;
      font-weight: 700;
    }
  `,
})
export class GameRow {
  private readonly theme = inject(ThemeToneService);

  readonly game = input.required<BoardGameDto>();
  /** N : le nombre de participants. */
  readonly headcount = input.required<number>();

  protected readonly measures = computed(() =>
    formatBoardGameMeasures(this.game(), this.theme.tone()),
  );
  protected readonly fits = computed(() => fitsHeadcount(this.game(), this.headcount()));
  protected readonly fitText = computed(() =>
    fillTone(this.theme.tone()['event_games.fit_pill'], { total: this.headcount() }),
  );
}
