import { Component, inject, input, output } from '@angular/core';
import type { CalendarLayerKey } from '@desdispos/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

/** Bandeau de bascule des couches du calendrier (Story 30.6, AC1/AC3/AC4) — composant de rendu
 *  pur : l'état des couches actives, la comparaison au défaut et la persistance (jamais depuis
 *  cet écran, encadré n°2 de la story) restent dans `CalendarView`.
 *
 *  ⚠️ Story 36.14 — ce bandeau n'est plus permanent : il vit désormais DANS le panneau
 *  « Affichage » (`CalendarDisplayPanel`), et son bouton « Rétablir » est remonté d'un cran. Il
 *  a deux points d'accès là-haut — le panneau et la pastille de résumé (D-4) — et un composant de
 *  rendu pur n'a pas à savoir lequel l'a appelé. Le composant lui-même est inchangé par ailleurs :
 *  il était déjà pur, c'est le seul fichier du calendrier qu'aucune story de l'épic 36 n'a
 *  touché, et cette story l'a DÉPLACÉ sans le réécrire. */
@Component({
  selector: 'app-calendar-layer-toggle',
  standalone: true,
  templateUrl: './calendar-layer-toggle.html',
  styleUrl: './calendar-layer-toggle.scss',
})
export class CalendarLayerToggle {
  // 🚨 Story 36.14 — `input()` avec défaut et non `input.required()` : le piège du nouvel input
  // obligatoire a été payé quatre stories de suite (36.9, 36.10, 36.11, 36.12), et ce composant
  // gagne un second appelant (`CalendarDisplayPanel`).
  readonly keys = input<readonly CalendarLayerKey[]>([]);
  readonly active = input<readonly CalendarLayerKey[]>([]);

  readonly layerToggled = output<CalendarLayerKey>();

  protected readonly theme = inject(ThemeToneService);

  protected isActive(key: CalendarLayerKey): boolean {
    return this.active().includes(key);
  }
}
