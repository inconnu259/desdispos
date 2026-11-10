import { Component, inject, input } from '@angular/core';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import type { SituationValue } from '../../core/status/status-derivation';
import { SituationPill } from '../situation-pill/situation-pill';

/**
 * Story 53.3 — la ligne « Ma situation » : le libellé à gauche, la pastille à droite.
 *
 * Elle ne décide de RIEN : la valeur vient de `seanceSituation()` (`core/status/status-derivation.ts`),
 * calculée par la surface qui l'héberge. `null` = aucune ligne (ni libellé orphelin, ni espace
 * réservé). Texte seul, aucun élément interactif : la ligne se lit avec sa séance et passe à la
 * ligne plutôt que de déborder.
 */
@Component({
  selector: 'app-situation-line',
  imports: [SituationPill],
  templateUrl: './situation-line.html',
  styleUrl: './situation-line.scss',
})
export class SituationLine {
  protected readonly theme = inject(ThemeToneService);

  readonly value = input<SituationValue | null>(null);
}
