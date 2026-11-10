import { Component, inject, input, output } from '@angular/core';
import type { CalendarLayerKey } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { CalendarLayerToggle } from '../calendar-layer-toggle/calendar-layer-toggle';

/**
 * Le contenu du panneau « Affichage » (Story 36.14, AC2/AC5) — composant de **rendu pur** : il ne
 * détient aucun état, ne persiste rien, et ignore jusqu'à l'existence des deux surfaces qui
 * l'enveloppent (menu ancré sur ordinateur, feuille montant du bas sur téléphone). C'est ce qui
 * permet « un seul composant, deux présentations » [Source: DESIGN.md:300].
 *
 * 🚨 **La Destinée et « Ajouter des dates » n'entrent jamais ici** (AC12) — ce sont des MODES,
 * pas des filtres, et un mode doit se voir tant qu'il est actif
 * [Source: EXPERIENCE.md:198 ; commentaire déjà posé à l'adresse de cette story dans
 * `calendar-view.html`]. Ce composant ne les connaît pas : l'interdit est structurel.
 *
 * Il réutilise `CalendarLayerToggle` tel quel plutôt que de le réécrire — il était déjà de rendu
 * pur, et il est le seul fichier du calendrier qu'aucune des treize stories de l'épic 36 n'a
 * touché.
 */
@Component({
  selector: 'app-calendar-display-panel',
  standalone: true,
  imports: [CalendarLayerToggle],
  templateUrl: './calendar-display-panel.html',
  styleUrl: './calendar-display-panel.scss',
})
export class CalendarDisplayPanel {
  // 🚨 Aucun `input.required` : le piège a été payé quatre stories de suite (36.9, 36.10, 36.11,
  // 36.12). Chaque entrée porte un défaut rendable.
  readonly keys = input<readonly CalendarLayerKey[]>([]);
  readonly active = input<readonly CalendarLayerKey[]>([]);
  /** AC5 — la légende est fermée par défaut ; cet interrupteur est son seul réglage. */
  readonly legendVisible = input(false);
  /** Story 44.8 — mes parties actives, pour le filtre du calendrier personnel (vide : pas de section). */
  readonly parties = input<readonly { id: string; name: string }[]>([]);
  /** Les parties décochées. */
  readonly hiddenPartieIds = input<ReadonlySet<string>>(new Set());

  readonly layerToggled = output<CalendarLayerKey>();
  readonly partieToggled = output<string>();
  readonly legendToggled = output<void>();
  readonly resetRequested = output<void>();

  protected readonly theme = inject(ThemeToneService);
}
