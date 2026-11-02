import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import type { ScenarioDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ScenarioEditor } from '../scenario-editor/scenario-editor';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

@Component({
  selector: 'app-scenario-detail',
  imports: [ScenarioEditor, RouterLink, MatButtonModule, AppIcon],
  templateUrl: './scenario-detail.html',
  styleUrl: './scenario-detail.scss',
})
export class ScenarioDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly scenarios = inject(ScenariosService);
  protected readonly theme = inject(ThemeToneService);

  // Transmis par l'état de navigation quand disponible (ScenarioForm après création,
  // ScenarioList/ScenarioTimeline au clic sur une ligne, qui l'ont déjà en mémoire) — évite un
  // aller-retour réseau dans le cas courant. `extras.state` n'est lisible que pendant la navigation
  // en cours, donc capturé ici en constructeur.
  private readonly navigationScenario = inject(Router).getCurrentNavigation()?.extras.state?.[
    'scenario'
  ] as ScenarioDto | undefined;

  protected readonly scenario = signal<ScenarioDto | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loading = signal(true);
  // Lu depuis le paramètre de route `:id` — disponible même en cas d'erreur (contrairement à
  // `scenario().partieId`), pour que le lien "Retour à la partie" fonctionne aussi sur cette branche.
  protected readonly partieId = this.route.snapshot.paramMap.get('id');

  async ngOnInit(): Promise<void> {
    const scenarioId = this.route.snapshot.paramMap.get('scenarioId');
    if (!scenarioId || !this.partieId) {
      this.loadError.set(
        this.theme.tone()['common.scenario_introuvable_revenez_a_la_liste_des_brouillons'],
      );
      this.loading.set(false);
      return;
    }

    if (this.navigationScenario && this.navigationScenario.id === scenarioId) {
      this.scenario.set(this.navigationScenario);
      this.loading.set(false);
      return;
    }

    // Accès direct par URL ou rechargement (F5) : l'état de navigation est perdu. On retrouve le
    // scénario via `GET /parties/:id/scenarios` (AD-6, jamais filtré par statut) plutôt que
    // d'échouer — cet endpoint n'existait pas encore quand cette page a été créée (Stories 7.1-7.3).
    try {
      const found = (await this.scenarios.listAll(this.partieId)).find((s) => s.id === scenarioId);
      if (!found) {
        this.loadError.set(
          this.theme.tone()['common.scenario_introuvable_revenez_a_la_liste_des_brouillons'],
        );
        return;
      }
      this.scenario.set(found);
    } catch {
      this.loadError.set(this.theme.tone()['common.impossible_de_charger_le_scenario_reessayez']);
    } finally {
      this.loading.set(false);
    }
  }
}
