import { Component, computed, input } from '@angular/core';
import type { ScenarioStatus } from '@master-jdr/shared';
import { scenarioState } from '../../../core/status/status-derivation';
import { StatusBadge } from '../../../shared/status-badge/status-badge';

/**
 * Story 32.3 — simple ADAPTATEUR : `ScenarioStatus` → état, puis la `StatusBadge` partagée.
 *
 * Ce composant ne porte plus ni libellé, ni couleur, ni feuille de style propre (les trois ont
 * rejoint `core/status` et `shared/status-badge`). Il survit parce que ses trois sites d'appel —
 * la chronologie, l'éditeur et le dialogue de lecture — passent un `status`, pas un état : les
 * réaligner d'un coup ne demandait donc de toucher aucun de ces trois gabarits.
 */
@Component({
  selector: 'app-scenario-status-badge',
  imports: [StatusBadge],
  templateUrl: './scenario-status-badge.html',
})
export class ScenarioStatusBadge {
  readonly status = input.required<ScenarioStatus>();

  protected readonly state = computed(() => scenarioState(this.status()));
}
