import { Component, computed, inject, input } from '@angular/core';
import { AppIcon } from '../../core/icons/app-icon';
import { roleIconName } from '../../core/icons/role-icon-name';
import { ThemeToneService } from '../../core/theme/theme-tone.service';

type IdentityLabelMode = 'joint' | 'single-character' | 'single-player' | 'empty';

@Component({
  selector: 'app-identity-label',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './identity-label.html',
  styleUrl: './identity-label.scss',
})
export class IdentityLabel {
  /** Écu (personnage seul) et silhouette (joueur seul) : les icônes de rôle `mj` / `player`, via
   *  la seule correspondance rôle -> icône de l'application. */
  protected readonly characterIcon = roleIconName('mj');
  protected readonly playerIcon = roleIconName('player');

  readonly characterName = input<string | null>(null);
  readonly playerName = input<string | null>(null);
  /** Pseudo affiché en complément du nom affiché en cas d'homonymie (AC3) — mode `single-player`
   *  uniquement, ignoré silencieusement ailleurs (le nom du personnage lève déjà l'ambiguïté). */
  readonly pseudo = input<string | null>(null);
  readonly ambiguous = input<boolean>(false);

  protected readonly theme = inject(ThemeToneService);

  protected readonly mode = computed<IdentityLabelMode>(() => {
    if (this.characterName() && this.playerName()) return 'joint';
    if (this.characterName()) return 'single-character';
    // `playerName` peut être une chaîne vide et non `null` : l'API renseigne `ownerDisplayName`
    // avec `?? ''` quand le compte propriétaire n'est plus résolvable. Sans cette branche, on
    // rendait une icône silhouette sans aucun texte, et un `aria-label` tronqué à « Joueur »
    // (revue de code 28.2).
    if (this.playerName()) return 'single-player';
    return 'empty';
  });

  protected readonly singleAriaLabel = computed(() => {
    if (this.mode() === 'single-character') {
      return `${this.theme.tone()['identity.character_label']} ${this.characterName()}`;
    }
    const base = `${this.theme.tone()['identity.player_label']} ${this.playerName()}`;
    // Revue de code : le pseudo de désambiguïsation (AC3) est un `<span>` visuel séparé — sans le
    // reprendre ici, deux entrées homonymes ("Même Nom (Alice)" vs "(Bob)") sont annoncées de
    // façon identique par un lecteur d'écran alors qu'elles sont distinguées visuellement.
    if (this.ambiguous() && this.pseudo()) {
      return `${base} (${this.pseudo()})`;
    }
    return base;
  });
}
