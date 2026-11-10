import {
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ScenarioDto } from '@master-jdr/shared';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { ScenarioEditor } from '../scenario-editor/scenario-editor';

/**
 * Un ONE_SHOT n'a jamais qu'un seul scénario (auto-créé à la création de la Partie, AD-7) : pas de
 * liste, pas de "+ Nouveau" (le backend rejette toute création supplémentaire). Tant qu'il reste
 * `BROUILLON`, on le trouve via `listDrafts()`. Une fois ouvert aux joueurs (`open()`) ou passé
 * `COURANT`/`PASSE`, il ne remonte plus dans `listDrafts()` : on retombe alors sur `listAll()`
 * (`GET /parties/:id/scenarios`, ajouté par la Story 7.5) qui retourne tous les statuts — ce tab
 * n'affiche pas d'onglet Chronologie séparé (réservé aux campagnes), donc c'est lui qui doit gérer
 * les deux statuts.
 */
@Component({
  selector: 'app-scenario-one-shot-tab',
  imports: [MatButtonModule, ScenarioEditor],
  templateUrl: './scenario-one-shot-tab.html',
  styleUrl: './scenario-one-shot-tab.scss',
})
export class ScenarioOneShotTab implements OnInit {
  private readonly scenarios = inject(ScenariosService);
  private readonly realtime = inject(RealtimeService);
  protected readonly theme = inject(ThemeToneService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partieId = input.required<string>();

  protected readonly scenario = signal<ScenarioDto | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly openError = signal<string | null>(null);
  protected readonly opening = signal(false);
  protected readonly notFound = signal(false);

  constructor() {
    // Story 21.2 (AC2) : réagit au signal générique ScenariosService.changed (RealtimeService).
    // PIÈGE spécifique à ce composant : ScenarioEditor (rendu en enfant) a déjà sa propre
    // réactivité SSE (Story 19.2) qui rafraîchit SA copie interne du scénario — mais le gabarit de
    // CE composant décide de l'affichage du bouton « Ouvrir aux joueurs » via SON PROPRE signal
    // scenario(), jamais celui de l'enfant. Sans cet effect(), le bouton resterait affiché à tort
    // après publication ailleurs. Garde firstRun (même piège que ScenarioEditor/Dashboard, Stories
    // 19.2/21.1) : ScenariosService est providedIn: 'root', son _changed peut déjà porter une
    // valeur avant le montage.
    let firstRun = true;
    effect(() => {
      const change = this.scenarios.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      if (!matchesPartie(change, this.partieId())) return;
      untracked(() => void this.loadScenario());
    });
  }

  private async loadScenario(): Promise<void> {
    try {
      const drafts = await this.scenarios.listDrafts(this.partieId());
      if (drafts.length > 0) {
        this.scenario.set(drafts[0]);
        this.notFound.set(false);
        this.loadError.set(null);
        return;
      }
      const all = await this.scenarios.listAll(this.partieId());
      if (all.length === 0) {
        this.scenario.set(null);
        this.notFound.set(true);
        this.loadError.set(null);
        return;
      }
      this.scenario.set(all[0]);
      this.notFound.set(false);
      this.loadError.set(null);
    } catch {
      this.loadError.set(this.theme.tone()['common.impossible_de_charger_le_scenario_reessayez']);
    }
  }

  async ngOnInit(): Promise<void> {
    // Revue de code : capturer partieId() une seule fois ici (comme ScenarioList/PartieDetail),
    // plutôt que de relire le signal à la destruction — si l'input venait à changer sans
    // réinstanciation du composant, disconnect() fermerait alors la mauvaise connexion.
    const partieId = this.partieId();
    this.realtime.connect(partieTopic(partieId));
    this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(partieId)));
    await this.loadScenario();
  }

  protected async openToPlayers(): Promise<void> {
    const s = this.scenario();
    if (!s || this.opening()) return;
    this.opening.set(true);
    this.openError.set(null);
    try {
      this.scenario.set(await this.scenarios.open(s.id));
    } catch {
      this.openError.set(this.theme.tone()['scenarios.one_shot_open_error']);
    } finally {
      this.opening.set(false);
    }
  }
}
