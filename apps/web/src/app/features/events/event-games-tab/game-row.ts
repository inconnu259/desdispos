import { Component, computed, inject, input, output } from '@angular/core';
import type { BoardGameDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { fitsHeadcount, formatBoardGameMeasures } from '../../board-games/board-game-measures';
import { EnvyToggle, type EnvyView } from './envy-toggle';

/**
 * `GameRow` (Stories 49.1 et 49.2, DESIGN §7.3) — un jeu sur place : son nom, ses mesures (« 2–4 joueurs · 40 min »,
 * omises quand rien n'est renseigné) et, seulement quand `minPlayers ≤ N ≤ maxPlayers` (les deux bornes
 * renseignées), la `FitPill` « jouable à N » — du texte plein, jamais la couleur seule.
 *
 * Story 49.2 : la ligne reçoit, déjà écrits par l'onglet (qui connaît les détenteurs), la `DuplicatePill` « ×N »
 * (`{colors.status-todo}`, toujours en texte), la provenance (« par moi », « par Zoé »), la ligne « aussi chez … /
 * aussi apporté par … », l'avertissement « ⚠ déjà chez … » et une action (« J'apporte », « Je ne l'apporte
 * plus »). L'action est un bouton de 44 px au moins sur la dernière ligne ; occupée, elle est désactivée (un
 * second toucher ne part pas). Story 49.4 : sur ses propres jeux, l'hôte a un ⋮ de 44 px à droite du nom (nom
 * accessible « Actions pour {jeu} ») ; le menu lui-même est tenu par l'onglet.
 *
 * Story 49.5 : sur les lignes de l'hôte et des apports, l'`EnvyToggle` (♥, compte) se pose à droite du nom, avant le ⋮ ;
 * la ligne ne décide rien, elle relaie `envyToggle` et `envyNames` à l'onglet.
 */
@Component({
  selector: 'app-game-row',
  imports: [AppIcon, EnvyToggle],
  template: `
    <div class="gr">
      @if (menuLabel() || envy()) {
        <!-- Story 49.4 : ⋮ de l'hôte sur ses propres jeux ; Story 49.5 : ♥ et compte d'Envies — à droite du nom. -->
        <span class="gr__head">
          <span class="gr__name">{{ game().name }}</span>
          <span class="gr__actions">
            @if (envy(); as e) {
              <app-envy-toggle
                [gameName]="game().name"
                [envy]="e"
                [namesOpen]="envyNamesOpen()"
                (heartTouch)="envyToggle.emit()"
                (countTouch)="envyNames.emit($event)"
              />
            }
            @if (menuLabel(); as label) {
              <button
                type="button"
                class="gr__menu"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuOpen()"
                [attr.aria-label]="label"
                (click)="onMenu($event)"
              >
                <app-icon name="menu-actions" />
              </button>
            }
          </span>
        </span>
      } @else {
        <span class="gr__name">{{ game().name }}</span>
      }
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
                <span class="gr__todo gr__warn">
                  <app-icon class="gr__warn-icon" name="avertissement" />{{ text }}
                </span>
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

    /* Nom à gauche, ⋮ à droite : la cible de 44 px déborde sur le remplissage de la ligne pour ne pas la grossir. */
    .gr__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    /* Les cibles de 44 px (♥, compte, ⋮) débordent sur le remplissage de la ligne pour ne pas la grossir. */
    .gr__actions {
      display: flex;
      flex: none;
      align-items: center;
      margin: -7px -9px -7px 0;
    }

    .gr__menu {
      box-sizing: border-box;
      flex: none;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
      font: inherit;
      /* Pictogramme <app-icon> « menu-actions » : la cible reste de 44 px, l'icône de 20 px. */
      --app-icon-size: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -2px;
      }
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

    /* Avertissement : pictogramme <app-icon> décoratif (14 px) avant le texte. */
    .gr__warn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .gr__warn-icon {
      --app-icon-size: 14px;
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
  /** Story 49.4 : nom accessible du ⋮ (« Actions pour {jeu} ») ; `null` : pas de ⋮ (jeu qui n'est pas à l'hôte, ou lecteur autre que l'hôte). */
  readonly menuLabel = input<string | null>(null);
  /** Le menu de CETTE ligne est ouvert (`aria-expanded`). */
  readonly menuOpen = input(false);
  /** Le ⋮ a été touché : rend le bouton, ancre du menu et cible du retour du focus. */
  readonly menu = output<HTMLElement>();
  /** Story 49.5 : l'Envie du NOM de ce jeu (déjà calculée par l'onglet) ; `null` : pas de ♥ sur cette ligne
   *  (« Dans mon … », jeux écartés). */
  readonly envy = input<EnvyView | null>(null);
  /** La liste des noms de CETTE ligne est ouverte (`aria-expanded` du compte). */
  readonly envyNamesOpen = input(false);
  /** Le ♥ a été touché. */
  readonly envyToggle = output<void>();
  /** Le compte a été touché : rend le bouton, ancre de la liste et cible du retour du focus. */
  readonly envyNames = output<HTMLElement>();

  protected onMenu(event: Event): void {
    this.menu.emit(event.currentTarget as HTMLElement);
  }

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
