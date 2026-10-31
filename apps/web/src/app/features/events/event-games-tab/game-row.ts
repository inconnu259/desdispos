import { Component, computed, inject, input, output } from '@angular/core';
import type { BoardGameDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { fitsHeadcount, formatBoardGameMeasures } from '../../board-games/board-game-measures';

/**
 * `GameRow` (Stories 49.1 et 49.2, DESIGN §7.3) — un jeu sur place : son nom, ses mesures (« 2–4 joueurs · 40 min »,
 * omises quand rien n'est renseigné) et, seulement quand `minPlayers ≤ N ≤ maxPlayers` (les deux bornes
 * renseignées), la `FitPill` « jouable à N » — du texte plein, jamais la couleur seule.
 *
 * Story 49.2 : la ligne reçoit, déjà écrits par l'onglet (qui connaît les détenteurs), la `DuplicatePill` « ×N »
 * (`{colors.status-todo}`, toujours en texte), la provenance (« par moi », « par Zoé »), la ligne « aussi chez … /
 * aussi apporté par … », l'avertissement « ⚠ déjà chez … » et une action (« J'apporte », « Je ne l'apporte
 * plus »). L'action est un bouton de 44 px au moins sur la dernière ligne ; occupée, elle est désactivée (un
 * second toucher ne part pas). Ni ♥ ni ⋮ à ce palier (Stories 49.4 et 49.5).
 */
@Component({
  selector: 'app-game-row',
  template: `
    <div class="gr">
      <span class="gr__name">{{ game().name }}</span>
      @if (measures() || fits() || duplicateText()) {
        <span class="gr__line">
          @if (measures(); as text) {
            <span class="gr__meta">{{ text }}</span>
          }
          @if (fits()) {
            <span class="gr__fit">{{ fitText() }}</span>
          }
          @if (duplicateText(); as text) {
            <span class="gr__dup">{{ text }}</span>
          }
        </span>
      }
      @if (byText() || alsoText() || warnText() || actionLabel()) {
        <span class="gr__foot">
          @if (byText() || alsoText() || warnText()) {
            <span class="gr__prov">
              @if (byText(); as text) {
                <span class="gr__by">{{ text }}</span>
              }
              @if (alsoText(); as text) {
                <span class="gr__todo">{{ text }}</span>
              }
              @if (warnText(); as text) {
                <span class="gr__todo gr__warn">{{ text }}</span>
              }
            </span>
          }
          @if (actionLabel(); as label) {
            <button
              type="button"
              class="gr__action"
              [disabled]="actionBusy()"
              [attr.aria-label]="label + ' — ' + game().name"
              (click)="act.emit()"
            >
              {{ label }}
            </button>
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

    /* « ×N » : texte plein sur fond teinté — jamais la couleur seule (DESIGN §7). */
    .gr__dup {
      padding: 1px 7px;
      border: 1px solid color-mix(in srgb, var(--jdr-status-todo, #f0a030) 45%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--jdr-status-todo, #f0a030) 16%, transparent);
      color: var(--jdr-status-todo, #f0a030);
      font-size: 10px;
      font-weight: 700;
    }

    .gr__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px 8px;
    }

    .gr__prov {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 8px;
      font-size: 11px;
    }

    .gr__by {
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
    }

    .gr__todo {
      color: var(--jdr-status-todo, #f0a030);
      font-weight: 600;
    }

    .gr__action {
      box-sizing: border-box;
      min-width: 44px;
      min-height: 44px;
      margin-left: auto;
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
export class GameRow {
  private readonly theme = inject(ThemeToneService);

  readonly game = input.required<BoardGameDto>();
  /** N : le nombre de participants. */
  readonly headcount = input.required<number>();
  /** Nombre de lignes de même nom normalisé sur place ; « ×N » à partir de 2. */
  readonly duplicateCount = input(1);
  /** Provenance écrite : « par moi », « par Zoé » ; `null` pour un jeu de l'hôte. */
  readonly byText = input<string | null>(null);
  /** « aussi chez Léa » / « aussi apporté par Zoé » (tous les autres détenteurs) ; `null` sans doublon. */
  readonly alsoText = input<string | null>(null);
  /** « ⚠ déjà chez Léa » (« Dans mon … » seulement) ; `null` si le jeu n'est pas encore sur place. */
  readonly warnText = input<string | null>(null);
  /** Libellé de l'action de la ligne (« J'apporte », « Je ne l'apporte plus ») ; `null` : ligne en lecture seule. */
  readonly actionLabel = input<string | null>(null);
  /** Une écriture de cette ligne est en cours : l'action est désactivée. */
  readonly actionBusy = input(false);
  /** L'action de la ligne a été touchée. */
  readonly act = output<void>();

  protected readonly measures = computed(() =>
    formatBoardGameMeasures(this.game(), this.theme.tone()),
  );
  protected readonly fits = computed(() => fitsHeadcount(this.game(), this.headcount()));
  protected readonly fitText = computed(() =>
    fillTone(this.theme.tone()['event_games.fit_pill'], { total: this.headcount() }),
  );
  protected readonly duplicateText = computed(() =>
    this.duplicateCount() >= 2
      ? fillTone(this.theme.tone()['event_games.dup_pill'], { n: this.duplicateCount() })
      : null,
  );
}
