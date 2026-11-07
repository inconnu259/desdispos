import { Component, computed, inject, input } from '@angular/core';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import type { SeanceSituation } from '../../core/status/status-derivation';

/**
 * Story 53.1 — la pastille « Ma situation » : ce que la séance est POUR le lecteur.
 *
 * Elle ne décide de RIEN : `seanceSituation()` (`core/status/status-derivation.ts`) remet une
 * valeur déjà arbitrée, la pastille la rend. Un seul composant pour toute l'appli — les
 * surfaces qui montrent la situation ne la redessinent pas.
 *
 * 🚨 **La pastille porte TOUJOURS son libellé** : la teinte (et la forme du contour) double le
 * mot, elle ne le remplace jamais. Les libellés sont `situation.<valeur>` dans les trois
 * registres de ton, identiques d'un thème à l'autre.
 */
@Component({
  selector: 'app-situation-pill',
  templateUrl: './situation-pill.html',
  styleUrl: './situation-pill.scss',
})
export class SituationPill {
  private readonly theme = inject(ThemeToneService);

  readonly value = input.required<SeanceSituation>();

  protected readonly label = computed(() => this.theme.tone()[`situation.${this.value()}`]);

  protected readonly cssClass = computed(() => `situation-pill--${this.value()}`);
}
