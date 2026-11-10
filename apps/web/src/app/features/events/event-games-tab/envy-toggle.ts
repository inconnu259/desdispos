import { Component, computed, inject, input, output } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';

/** Ce que la ligne d'un jeu sait de l'Envie de son nom (Story 49.5) — calculé une fois par l'onglet. */
export interface EnvyView {
  /** Combien de participants ont signalé une Envie sur ce NOM. */
  count: number;
  /** La personne connectée en a signalé une. */
  mine: boolean;
  /** Seul un participant (`canFill`) bascule ; un lecteur en lecture seule voit le compte mais pas de ♥. */
  canToggle: boolean;
  /** Qui a envie (nom affiché), pour la liste ouverte par le compte. */
  users: { userId: string; displayName: string }[];
}

/**
 * `EnvyToggle` (Story 49.5, DESIGN §7.4) — le ♥ d'une ligne de jeu : ♥ seul quand personne n'a envie, « ♥ {n} »
 * sinon. Le ♥ est un bouton de 44 px (`aria-pressed`, nom « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} ») ;
 * le compte est un second bouton de 44 px qui ouvre la liste des noms (portée par l'onglet : un seul overlay). Actif
 * (j'ai signalé), le ♥ et le compte passent en `accent-2` : le TEXTE en mélange assombri de `accent-2` et du texte du
 * thème (≥ 4,5:1 mesuré dans les trois thèmes — l'`accent-2` brut tombe à ≈ 3,3:1 dans l'Atelier Cuivré), la bordure et
 * le remplissage en `accent-2` brut. Le texte dit toujours l'état : jamais la couleur seule. Lecteur en lecture seule :
 * un seul bouton « ♥ {n} » (liste des noms), pas de bascule. Le composant ne décide rien : il émet, l'onglet écrit.
 */
@Component({
  selector: 'app-envy-toggle',
  imports: [AppIcon],
  template: `
    <span class="et">
      @if (envy().canToggle) {
        <button
          type="button"
          class="et__heart"
          [attr.aria-pressed]="envy().mine"
          [attr.aria-label]="heartLabel()"
          (click)="heartTouch.emit()"
        >
          <span class="et__pill" [class.et__pill--on]="envy().mine" aria-hidden="true">
            <app-icon name="envie" />
          </span>
        </button>
        @if (envy().count > 0) {
          <button
            type="button"
            class="et__count"
            [class.et__count--on]="envy().mine"
            aria-haspopup="dialog"
            [attr.aria-expanded]="namesOpen()"
            [attr.aria-label]="countLabel()"
            (click)="onNames($event)"
          >
            {{ envy().count }}
          </button>
        }
      } @else if (envy().count > 0) {
        <button
          type="button"
          class="et__count et__count--solo"
          [class.et__count--on]="envy().mine"
          aria-haspopup="dialog"
          [attr.aria-expanded]="namesOpen()"
          [attr.aria-label]="countLabel()"
          (click)="onNames($event)"
        >
          <app-icon class="et__solo-icon" name="envie" /> {{ envy().count }}
        </button>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .et {
      display: inline-flex;
      align-items: center;
    }

    .et__heart,
    .et__count {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--jdr-text-muted, var(--mat-sys-on-surface-variant));
      font: inherit;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -2px;
      }
    }

    /* Le ♥ : une pastille de 28 px dans une cible de 44 px. Actif : bordure et remplissage en accent-2 brut, glyphe en
       texte mélangé (contraste mesuré, voir les notes de la Story 49.5). */
    .et__pill {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--mat-sys-outline, currentColor);
      border-radius: 999px;
      /* Pictogramme <app-icon> « envie » : sa taille passe par la variable, plus par font-size. */
      --app-icon-size: 16px;
      line-height: 1;
    }

    .et__pill--on {
      border-color: var(--jdr-accent-2, var(--mat-sys-secondary));
      background: color-mix(
        in srgb,
        var(--jdr-accent-2, var(--mat-sys-secondary)) 16%,
        transparent
      );
      color: color-mix(
        in srgb,
        var(--jdr-accent-2, var(--mat-sys-secondary)) 55%,
        var(--jdr-text, var(--mat-sys-on-surface))
      );
    }

    /* Le compte : du texte souligné en pointillé (comme les noms de personnes), pas une seconde pastille. */
    .et__count {
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }

    .et__count--solo {
      gap: 3px;
      padding: 0 6px;
    }

    .et__solo-icon {
      --app-icon-size: 16px;
    }

    .et__count--on {
      color: color-mix(
        in srgb,
        var(--jdr-accent-2, var(--mat-sys-secondary)) 55%,
        var(--jdr-text, var(--mat-sys-on-surface))
      );
    }
  `,
})
export class EnvyToggle {
  private readonly theme = inject(ThemeToneService);

  /** Le nom du jeu de la ligne (nom accessible). */
  readonly gameName = input.required<string>();
  readonly envy = input.required<EnvyView>();
  /** La liste des noms de CETTE ligne est ouverte (`aria-expanded`). */
  readonly namesOpen = input(false);
  /** Le ♥ a été touché. */
  readonly heartTouch = output<void>();
  /** Le compte a été touché : rend le bouton, ancre de la liste et cible du retour du focus. */
  readonly countTouch = output<HTMLElement>();

  /** « appel / envie / demande » (singulier pour 0 et 1, comme le reste de l'onglet). */
  private readonly unit = computed(
    () =>
      this.theme.tone()[
        this.envy().count <= 1 ? 'event_games.envy_unit_one' : 'event_games.envy_unit_many'
      ],
  );

  /** « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} ». */
  protected readonly heartLabel = computed(
    () =>
      `${this.theme.tone()['event_games.envy_btn']} — ${this.gameName()}, ${this.envy().count} ${this.unit()}`,
  );

  protected readonly countLabel = computed(() =>
    fillTone(this.theme.tone()['event_games.envy_count_aria'], {
      nom: this.gameName(),
      n: this.envy().count,
      unite: this.unit(),
    }),
  );

  protected onNames(event: Event): void {
    this.countTouch.emit(event.currentTarget as HTMLElement);
  }
}
