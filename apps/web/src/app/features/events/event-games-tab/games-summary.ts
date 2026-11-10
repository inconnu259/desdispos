import { Component, computed, inject, input, model } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';

/**
 * `GamesSummary` (Story 49.1, DESIGN §7.1) — l'en-tête de l'onglet des jeux sur place : « {n} jeux sur
 * place · {k} jouables à {N} » sur une ligne (chaque morceau accordé avec son nombre), puis la puce à bascule
 * « Jouables à {N} » (`aria-pressed`, éteinte au départ). Puce active : fond `accent-1` à 18 % avec ✕. Le
 * texte dit toujours l'état — jamais la couleur seule. Sans jeu sur place, il n'y a rien à filtrer : la puce
 * n'est pas posée.
 *
 * Story 49.5 : une seconde puce à bascule, « Les plus appelées / attendus / demandés » (`aria-pressed`, éteinte au
 * départ, même rendu actif), cumulable avec la première ; elle ne filtre rien et ne touche pas aux comptes du résumé :
 * l'onglet trie chaque section par Envies décroissantes, puis alphabétique.
 */
@Component({
  selector: 'app-games-summary',
  imports: [AppIcon],
  template: `
    <div class="gsum">
      <p class="gsum__line">{{ line() }}</p>
      @if (total() > 0) {
        <div class="gsum__chips">
          <button
            type="button"
            class="gsum__chip"
            [class.gsum__chip--on]="fitOnly()"
            [attr.aria-pressed]="fitOnly()"
            (click)="fitOnly.set(!fitOnly())"
          >
            {{ filterLabel() }}
            @if (fitOnly()) {
              <app-icon name="effacer" />
            }
          </button>
          <button
            type="button"
            class="gsum__chip"
            [class.gsum__chip--on]="sortEnvy()"
            [attr.aria-pressed]="sortEnvy()"
            (click)="sortEnvy.set(!sortEnvy())"
          >
            {{ sortLabel() }}
            @if (sortEnvy()) {
              <app-icon name="effacer" />
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .gsum {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 9px 10px;
      border: 1px solid var(--mat-sys-outline, rgba(255, 255, 255, 0.2));
      border-radius: 12px;
      background: var(--mat-sys-surface-container-high, transparent);
    }

    .gsum__line {
      margin: 0;
      font-size: 14.5px;
      font-weight: 700;
      color: var(--jdr-text, var(--mat-sys-on-surface));
    }

    .gsum__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .gsum__chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--mat-sys-outline, currentColor);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.8125rem;
      /* Pictogramme <app-icon> « effacer » de la puce active (décoratif). */
      --app-icon-size: 14px;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }

    .gsum__chip--on {
      border-color: var(--jdr-accent-1, var(--mat-sys-primary));
      background: color-mix(in srgb, var(--jdr-accent-1, var(--mat-sys-primary)) 18%, transparent);
      font-weight: 600;
    }
  `,
})
export class GamesSummary {
  private readonly theme = inject(ThemeToneService);

  /** Nombre de jeux sur place. */
  readonly total = input.required<number>();
  /** Parmi eux, ceux jouables au nombre de participants. */
  readonly fitting = input.required<number>();
  /** N : le nombre de participants. */
  readonly headcount = input.required<number>();
  /** Filtre « Jouables à {N} » actif. */
  readonly fitOnly = model(false);
  /** Story 49.5 : tri « Les plus appelées » actif. */
  readonly sortEnvy = model(false);

  /** « {n} jeu(x) sur place · {k} jouable(s) à {N} » : chaque morceau s'accorde avec son propre nombre — « jeu »
   *  pour n ≤ 1, « jouable » pour k = 1 seulement (k = 0 reste au pluriel). */
  protected readonly line = computed(() => {
    const tone = this.theme.tone();
    const n = this.total();
    const k = this.fitting();
    return fillTone(tone['event_games.summary'], {
      games: fillTone(
        tone[n <= 1 ? 'event_games.summary_games_one' : 'event_games.summary_games_many'],
        {
          n,
        },
      ),
      playable: fillTone(
        tone[k === 1 ? 'event_games.summary_playable_one' : 'event_games.summary_playable_many'],
        { k, total: this.headcount() },
      ),
    });
  });

  protected readonly filterLabel = computed(() =>
    fillTone(this.theme.tone()['event_games.filter_fit'], { total: this.headcount() }),
  );

  protected readonly sortLabel = computed(() => this.theme.tone()['event_games.sort_envy']);
}
