import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../theme/theme-tone.service';
import {
  COMMON_ICONS,
  THEMED_ICONS,
  type CommonIconName,
  type IconDrawing,
  type IconName,
  type ThemedIconName,
} from './icon-registry.generated';

/**
 * Icône du jeu propre à chaque thème (palier 10.7). Le dessin vient du registre généré
 * (`icon-registry.generated.ts`, des DONNÉES) et est rendu par liaisons d'attributs de gabarit :
 * jamais d'`innerHTML`, jamais de contournement du sanitiseur, aucun fichier d'icône chargé à la
 * volée (le registre est importé statiquement et fait partie du bundle initial).
 *
 * - Une icône « de sens » suit `ThemeToneService.activeTheme()` en direct (même instance, dessin
 *   remplacé) ; un utilitaire a un seul dessin pour les trois thèmes. Un écran passe un NOM,
 *   jamais un thème.
 * - Sans `label` l'icône est décorative (elle accompagne un texte ou un bouton déjà nommé) ; avec
 *   `label` elle est une image nommée. Le nom d'un bouton ne se donne jamais deux fois.
 * - Taille : `--app-icon-size` (24px par défaut), posée par le parent ; couleur : `currentColor`.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-icon]': 'name()' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--app-icon-size, 24px);
      height: var(--app-icon-size, 24px);
      line-height: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    @if (drawing(); as drawn) {
      <svg
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        [attr.viewBox]="drawn.viewBox"
        [attr.aria-hidden]="label() ? null : 'true'"
        [attr.focusable]="label() ? null : 'false'"
        [attr.role]="label() ? 'img' : null"
        [attr.aria-label]="label() || null"
      >
        @for (el of drawn.elements; track $index) {
          @switch (el.tag) {
            @case ('path') {
              <path
                [attr.d]="el.attrs['d']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('circle') {
              <circle
                [attr.cx]="el.attrs['cx']"
                [attr.cy]="el.attrs['cy']"
                [attr.r]="el.attrs['r']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('ellipse') {
              <ellipse
                [attr.cx]="el.attrs['cx']"
                [attr.cy]="el.attrs['cy']"
                [attr.rx]="el.attrs['rx']"
                [attr.ry]="el.attrs['ry']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('rect') {
              <rect
                [attr.x]="el.attrs['x']"
                [attr.y]="el.attrs['y']"
                [attr.width]="el.attrs['width']"
                [attr.height]="el.attrs['height']"
                [attr.rx]="el.attrs['rx']"
                [attr.ry]="el.attrs['ry']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('line') {
              <line
                [attr.x1]="el.attrs['x1']"
                [attr.y1]="el.attrs['y1']"
                [attr.x2]="el.attrs['x2']"
                [attr.y2]="el.attrs['y2']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('polyline') {
              <polyline
                [attr.points]="el.attrs['points']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
            @case ('polygon') {
              <polygon
                [attr.points]="el.attrs['points']"
                [attr.fill]="el.attrs['fill']"
                [attr.stroke]="el.attrs['stroke']"
                [attr.stroke-width]="el.attrs['stroke-width']"
                [attr.stroke-linecap]="el.attrs['stroke-linecap']"
                [attr.stroke-linejoin]="el.attrs['stroke-linejoin']"
                [attr.fill-rule]="el.attrs['fill-rule']"
                [attr.opacity]="el.attrs['opacity']"
              />
            }
          }
        }
      </svg>
    }
  `,
})
export class AppIcon {
  private readonly theme = inject(ThemeToneService);

  /** Nom de l'icône, typé par l'union générée (71 noms dans un seul espace). */
  readonly name = input.required<IconName>();

  /** Nom accessible d'une icône SEULE (libellé de thème de son concept). Absent = décorative. */
  readonly label = input<string>();

  protected readonly drawing = computed<IconDrawing | null>(() => {
    const name = this.name();
    if (Object.hasOwn(COMMON_ICONS, name)) return COMMON_ICONS[name as CommonIconName];
    if (Object.hasOwn(THEMED_ICONS, name)) {
      return THEMED_ICONS[name as ThemedIconName][this.theme.activeTheme()];
    }
    // Pas d'icône de repli : un nom inconnu (impossible pour un appelant typé) n'affiche rien, et
    // ne doit surtout pas lever dans un computed, ce qui interromprait toute la détection de changements.
    console.error(`app-icon : icône « ${name} » inconnue du registre.`);
    return null;
  });
}
