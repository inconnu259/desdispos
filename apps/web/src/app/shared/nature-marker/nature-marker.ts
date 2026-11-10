import { Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../../core/theme/theme-tone.service';

/**
 * Marqueur de nature (Story 33.5, DESIGN.md §7.4) — posé après le nom d'une carte de « Personnages »
 * quand l'élément n'est pas un personnage joueur. N'existe que pour l'Homme Dragon aujourd'hui ;
 * à rendre générique (entrée `nature`) le jour où une autre nature apparaît.
 *
 * Icône + mot « Homme Dragon » en moyen/grand ; icône seule + `aria-label` en compact (mode
 * liste). La nature est portée par le mot ou le libellé accessible, jamais par la seule couleur :
 * le contour `accent-2` n'est qu'un renfort. « Homme Dragon » est un nom propre du système, jamais
 * thématisé (clé `character.nature_dragon`, identique dans les trois thèmes).
 */
@Component({
  selector: 'app-nature-marker',
  standalone: true,
  templateUrl: './nature-marker.html',
  styleUrl: './nature-marker.scss',
})
export class NatureMarker {
  /** `true` en mode liste : icône seule, le mot passe dans `aria-label`. */
  readonly compact = input(false);

  private readonly theme = inject(ThemeToneService);
  protected readonly label = computed(
    () => this.theme.tone()['character.nature_dragon'] ?? 'Homme Dragon',
  );
}
