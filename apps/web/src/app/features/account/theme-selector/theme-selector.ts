import { Component, inject } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AccountService } from '../../../core/account/account.service';
import type { Theme } from '../../../core/theme/tones';

@Component({
  selector: 'app-theme-selector',
  imports: [AppIcon],
  templateUrl: './theme-selector.html',
  styleUrl: './theme-selector.scss',
})
export class ThemeSelector {
  protected readonly themeSvc = inject(ThemeToneService);
  private readonly accountSvc = inject(AccountService);

  protected readonly gradients: Record<Theme, string> = {
    'grimoire-emeraude': 'linear-gradient(135deg, #1a0a30 20%, #9b6dff)',
    'foret-ancienne': 'linear-gradient(135deg, #080f0a 25%, #2ecc71)',
    'atelier-cuivre': 'linear-gradient(135deg, #1a1008 25%, #cd7f32)',
  };

  protected readonly accents: Record<Theme, string> = {
    'grimoire-emeraude': '#9b6dff',
    'foret-ancienne': '#2ecc71',
    'atelier-cuivre': '#cd7f32',
  };

  protected selectTheme(theme: Theme): void {
    this.themeSvc.setTheme(theme);
    // Fire-and-forget : le thème est déjà appliqué visuellement, un échec réseau isolé n'a pas
    // besoin d'un message d'erreur dédié (la prochaine sélection ou connexion resynchronisera).
    void this.accountSvc.setTheme(theme);
  }
}
