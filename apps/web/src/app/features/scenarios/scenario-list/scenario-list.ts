import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import type { ScenarioDto, ScenarioStatus } from '@master-jdr/shared';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { ScenarioStatusBadge } from '../scenario-status-badge/scenario-status-badge';
import { SituationLine } from '../../../shared/situation-line/situation-line';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import {
  nextSeanceOf,
  seanceSituation,
  type SeanceSituation,
} from '../../../core/status/status-derivation';
import { toDateKey } from '../../calendar/day-detail.utils';

/** Une section de la liste : un état, son libellé de registre, ses scénarios. */
interface ScenarioSection {
  status: ScenarioStatus;
  labelKey: string;
  scenarios: ScenarioDto[];
}

/**
 * L'ordre des sections : ce qui se prépare, ce qui se joue, ce qui vient, ce qui est derrière.
 *
 * 🚨 `BROUILLON` en tête n'est pas un détail d'affichage : cet onglet est **MJ seul**
 * (`PartieDetail` ne le rend jamais à un joueur), et c'est la seule surface où le MJ retrouve ses
 * brouillons. Ouvrir cet onglet aux joueurs exigerait de filtrer cette section — le masquage
 * anti-spoil est un rendu frontend, aucun filtrage serveur ne l'assure (décision du Palier 4).
 */
const SECTIONS: { status: ScenarioStatus; labelKey: string }[] = [
  { status: 'BROUILLON', labelKey: 'status.scenario_brouillon' },
  { status: 'COURANT', labelKey: 'status.scenario_courant' },
  { status: 'A_VENIR', labelKey: 'status.scenario_a_venir' },
  { status: 'PASSE', labelKey: 'status.scenario_passe' },
];

@Component({
  selector: 'app-scenario-list',
  imports: [MatButtonModule, ScenarioStatusBadge, SituationLine],
  templateUrl: './scenario-list.html',
  styleUrl: './scenario-list.scss',
})
export class ScenarioList implements OnInit {
  private readonly scenarios = inject(ScenariosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeToneService);

  /**
   * Jour courant figé à la CONSTRUCTION, une seule fois pour tout l'onglet — même patron que
   * `ScenarioTimeline.todayKey` : deux chapitres rendus de part et d'autre de minuit ne doivent pas
   * comparer à deux « aujourd'hui » différents.
   */
  private readonly todayKey = toDateKey(new Date());

  // Optionnel : rempli par le parent quand intégré directement dans un onglet (`PartieDetail`) ;
  // sinon repli sur le paramètre de route `:id`, quand ce composant est chargé via la route
  // `parties/:id/scenarios/drafts`.
  readonly partieId = input<string | undefined>(undefined);

  protected readonly scenarioList = signal<ScenarioDto[]>([]);
  protected readonly loadError = signal<string | null>(null);

  private loadGeneration = 0;
  private destroyed = false;

  private resolvePartieId(): string | undefined {
    return this.partieId() ?? this.route.snapshot.paramMap.get('id') ?? undefined;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    // Story 21.2 (AC1) : réagit au signal générique ScenariosService.changed (RealtimeService,
    // Story 19.1) — un co-MJ qui crée/publie/supprime un scénario ailleurs doit être reflété ici
    // sans rechargement de page. Garde firstRun (même piège que ScenarioEditor/Dashboard, Stories
    // 19.2/21.1) : ScenariosService est providedIn: 'root', son _changed peut déjà porter une
    // valeur avant le montage — sans ce garde, la première exécution de cet effect() (déclenchée à
    // la CONSTRUCTION, avant ngOnInit()) provoquerait un refetch redondant.
    let firstRun = true;
    effect(() => {
      const change = this.scenarios.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      const partieId = untracked(() => this.resolvePartieId());
      if (!partieId || !matchesPartie(change, partieId)) return;
      untracked(() => void this.load(partieId));
    });
  }

  /**
   * Les quatre sections, dans l'ordre de `SECTIONS`, celles qui sont vides en moins.
   *
   * Tri : `COURANT` et `A_VENIR` suivent l'ordre de campagne (création croissante, celui que sert
   * déjà l'API) ; `BROUILLON` et `PASSE` sont rendus du plus récent au plus ancien — on écrit son
   * dernier brouillon et on relit son dernier scénario joué bien plus souvent que les premiers.
   */
  protected readonly sections = computed<ScenarioSection[]>(() => {
    const all = this.scenarioList();
    return SECTIONS.map(({ status, labelKey }) => {
      const scenarios = all.filter((s) => s.status === status);
      if (status === 'BROUILLON' || status === 'PASSE') {
        scenarios.reverse();
      }
      return { status, labelKey, scenarios };
    }).filter((section) => section.scenarios.length > 0);
  });

  protected readonly isEmpty = computed(() => this.scenarioList().length === 0);

  private async load(partieId: string): Promise<void> {
    const generation = ++this.loadGeneration;
    try {
      // `listAll()` sert TOUS les statuts, brouillons compris (le serveur n'en filtre aucun) et
      // déduplique les requêtes concurrentes : monté à côté de la chronologie, cet onglet
      // n'ajoute donc aucun appel réseau.
      const scenarios = await this.scenarios.listAll(partieId);
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.scenarioList.set(scenarios);
      this.loadError.set(null);
    } catch {
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.loadError.set(this.theme.tone()['common.impossible_de_charger_les_scenarios_reessayez']);
    }
  }

  async ngOnInit(): Promise<void> {
    const partieId = this.resolvePartieId();
    if (!partieId) {
      this.loadError.set(this.theme.tone()['common.partie_introuvable']);
      return;
    }
    this.realtime.connect(partieTopic(partieId));
    this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(partieId)));
    await this.load(partieId);
  }

  /**
   * Story 53.3 — « Ma situation » d'un chapitre : celle de la PROCHAINE séance (`nextSeanceOf`),
   * calculée par `seanceSituation()` — jamais redéfinie ici. Cet onglet est MJ seul : `isMj` vaut
   * `true`, donc « Je mène » quand une séance reste à venir, `null` (aucune ligne) sinon.
   */
  protected chapterSituation(scenario: ScenarioDto): SeanceSituation | null {
    const next = nextSeanceOf(scenario, this.todayKey);
    if (!next) return null;
    return seanceSituation(next, this.auth.currentUser()?.id, true, this.todayKey);
  }

  protected newScenario(): void {
    void this.router.navigate(['/parties', this.resolvePartieId(), 'scenarios', 'new']);
  }

  protected openScenario(scenario: ScenarioDto): void {
    void this.router.navigate(['/parties', this.resolvePartieId(), 'scenarios', scenario.id], {
      state: { scenario },
    });
  }

  /**
   * Publier un brouillon le fait **migrer** de la section « Brouillon » vers « À venir ».
   *
   * 🚨 Retirer la ligne de la liste (ce que faisait l'onglet quand il n'affichait QUE les
   * brouillons) donnerait ici l'impression que le scénario a disparu, alors que sa section
   * d'arrivée est juste en dessous. On remplace donc l'entrée par le scénario renvoyé par le
   * serveur, seul porteur du nouveau statut.
   */
  protected async openToPlayers(scenario: ScenarioDto, event: Event): Promise<void> {
    event.stopPropagation();
    const opened = await this.scenarios.open(scenario.id);
    this.scenarioList.update((list) => list.map((s) => (s.id === opened.id ? opened : s)));
  }
}
