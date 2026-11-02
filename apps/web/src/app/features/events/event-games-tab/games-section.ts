import { Component, computed, inject, input } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { formatBoardGameCount } from '../../board-games/board-game-measures';
import { GamesSectionStateService } from './games-section-state.service';

let nextUid = 0;

/**
 * `GamesSection` (Story 49.1, DESIGN §7.2) — une section repliable de l'onglet des jeux. L'en-tête est un
 * bouton sur toute la ligne (44 px au moins, `aria-expanded`) : titre, compte (« · 6 », ou « · 3 sur 6 »
 * quand un filtre est actif), chevron (▾ déplié, ▸ replié). Son nom accessible inclut le compte
 * (« Chez Léa, 6 jeux »). Dépliée au départ ; l'état replié est retenu dans ce navigateur, par `sectionKey`
 * (`GamesSectionStateService`). Replier garde le compte. Le contenu (les lignes) est projeté.
 */
@Component({
  selector: 'app-games-section',
  imports: [AppIcon],
  template: `
    <section class="gs">
      <h3 class="gs__heading">
        <button
          type="button"
          class="gs__header"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-controls]="bodyId"
          [attr.aria-label]="ariaLabel()"
          (click)="toggle()"
        >
          <span class="gs__title">{{ title() }}</span>
          <span class="gs__count">{{ countText() }}</span>
          <app-icon class="gs__chevron" [class.gs__chevron--closed]="collapsed()" name="deplier" />
        </button>
      </h3>
      @if (note(); as text) {
        <p class="gs__note">{{ text }}</p>
      }
      <div class="gs__body" [id]="bodyId" [hidden]="collapsed()">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .gs__heading {
      margin: 0;
    }

    .gs__header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 44px;
      padding: 0 2px;
      border: 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(255, 255, 255, 0.12));
      background: transparent;
      color: var(--jdr-text, var(--mat-sys-on-surface));
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }

    .gs__title {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .gs__count {
      font-weight: 400;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
    }

    /* Pictogramme <app-icon> « déplier » (16 px) : vers le bas déplié, tourné de −90° replié. */
    .gs__chevron {
      --app-icon-size: 16px;
      margin-left: auto;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
      transition: rotate 0.15s ease;
    }

    .gs__chevron--closed {
      rotate: -90deg;
    }

    @media (prefers-reduced-motion: reduce) {
      .gs__chevron {
        transition: none;
      }
    }

    .gs__note {
      margin: 4px 2px 0;
      font-size: 11px;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
    }

    .gs__body {
      padding-top: 6px;
    }
  `,
  // Story 49.4 : repère stable de la section (le focus y revient quand la ligne touchée a disparu).
  host: { '[attr.data-section]': 'sectionKey()' },
})
export class GamesSection {
  private readonly theme = inject(ThemeToneService);
  private readonly state = inject(GamesSectionStateService);

  /** Identifiant stable de la section, sous lequel l'état replié est retenu. */
  readonly sectionKey = input.required<string>();
  readonly title = input.required<string>();
  /** Nombre de jeux de la section, tous filtres ignorés. */
  readonly total = input.required<number>();
  /** Nombre de jeux visibles sous le filtre actif ; `null` : aucun filtre. */
  readonly shown = input<number | null>(null);
  /** Story 49.4 : mention discrète sous l'en-tête (« visible par vous seul·e »), toujours visible, même replié. */
  readonly note = input<string | null>(null);

  protected readonly bodyId = `games-section-${++nextUid}`;
  protected readonly collapsed = computed(() => this.state.collapsed().has(this.sectionKey()));

  protected readonly countText = computed(() => {
    const shown = this.shown();
    const tone = this.theme.tone();
    return shown === null
      ? fillTone(tone['event_games.section_count'], { n: this.total() })
      : fillTone(tone['event_games.section_count_filtered'], { k: shown, n: this.total() });
  });

  protected readonly ariaLabel = computed(() => {
    const shown = this.shown();
    const tone = this.theme.tone();
    const compte =
      shown === null
        ? formatBoardGameCount(this.total(), tone)
        : fillTone(
            tone[
              this.total() <= 1
                ? 'event_games.section_aria_filtered_one'
                : 'event_games.section_aria_filtered'
            ],
            { k: shown, n: this.total() },
          );
    return fillTone(tone['event_games.section_aria'], { titre: this.title(), compte });
  });

  protected toggle(): void {
    this.state.toggle(this.sectionKey());
  }
}
