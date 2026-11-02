import { Component, computed, inject, input } from '@angular/core';
import { AppIcon } from '../../core/icons/app-icon';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { PasswordReveal } from './password-reveal';

/**
 * Story 34.2 — bouton œil / œil barré qui pilote une directive `appPasswordReveal`.
 *
 * `<button type="button">` : il ne soumet jamais le formulaire. L'état est porté par la forme de
 * l'icône (œil / œil barré), par `aria-pressed` et par le libellé accessible, jamais par la couleur
 * seule. Les libellés viennent du registre de ton (`auth.password_show` / `auth.password_hide`).
 */
@Component({
  selector: 'app-password-toggle',
  imports: [AppIcon],
  templateUrl: './password-toggle.html',
  styleUrl: './password-toggle.scss',
})
export class PasswordToggle {
  private readonly theme = inject(ThemeToneService);

  /** Directive du champ à piloter (référence de gabarit `#pw="appPasswordReveal"`). */
  readonly for = input.required<PasswordReveal>();

  protected readonly label = computed(
    () => this.theme.tone()[this.for().revealed() ? 'auth.password_hide' : 'auth.password_show'],
  );

  protected onClick(event: Event): void {
    // Sans cela, le clic remonte au conteneur du `mat-form-field`, qui redonne le focus au champ :
    // l'utilisateur au clavier perdrait le focus du bouton à chaque bascule.
    event.stopPropagation();
    this.for().toggle();
  }
}
