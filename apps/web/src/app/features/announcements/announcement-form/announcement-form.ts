import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import type { AnnouncementDto, ScenarioDto } from '@master-jdr/shared';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { ScenariosService, matchesPartie } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';

@Component({
  selector: 'app-announcement-form',
  standalone: true,
  imports: [FormsModule, MatButtonModule],
  templateUrl: './announcement-form.html',
})
export class AnnouncementFormComponent implements OnInit {
  readonly partieId = input.required<string>();
  readonly published = output<AnnouncementDto>();

  private readonly scenariosSvc = inject(ScenariosService);
  private readonly announcementsSvc = inject(AnnouncementsService);
  protected readonly theme = inject(ThemeToneService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scenarios = signal<ScenarioDto[]>([]);
  // AC4/AD-6 : filtrage frontend uniquement — jamais BROUILLON/A_VENIR dans le sélecteur (annoncer
  // quelque chose de scopé à un contenu pas encore révélé fuiterait indirectement son existence).
  protected readonly eligibleScenarios = computed(() =>
    this.scenarios().filter((s) => s.status === 'COURANT' || s.status === 'PASSE'),
  );

  protected readonly text = signal('');
  protected readonly selectedScenarioId = signal<string | null>(null);
  protected readonly isValid = computed(() => this.text().trim().length > 0);
  protected readonly publishing = signal(false);
  protected readonly justPublished = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Story 21.3 (AC1) : réagit au signal générique ScenariosService.changed (RealtimeService) —
    // un scénario qui change de statut (ex. passe COURANT) pendant que le formulaire reste ouvert
    // doit apparaître dans le sélecteur sans rechargement de page. Garde firstRun (même piège que
    // ScenarioEditor/Dashboard/ScenarioOneShotTab, Stories 19.2/21.1/21.2) : ScenariosService est
    // providedIn: 'root', son _changed peut déjà porter une valeur avant le montage.
    let firstRun = true;
    effect(() => {
      const change = this.scenariosSvc.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      if (!matchesPartie(change, this.partieId())) return;
      untracked(() => void this.loadScenarios());
    });
  }

  ngOnInit(): void {
    // Revue de code Story 21.2 : capturer partieId() une seule fois ici plutôt que de relire le
    // signal à la destruction — si l'input venait à changer sans réinstanciation du composant,
    // disconnect() fermerait alors la mauvaise connexion.
    const partieId = this.partieId();
    this.realtime.connect(partieTopic(partieId));
    this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(partieId)));
    void this.loadScenarios();
  }

  // Revue de code : sans catch, un échec de listAll() (ex. panne réseau) laissait une promesse
  // rejetée non gérée et le sélecteur silencieusement vide, sans retour utilisateur.
  private async loadScenarios(): Promise<void> {
    try {
      this.scenarios.set(await this.scenariosSvc.listAll(this.partieId()));
      this.error.set(null);
      // Revue de code (Story 21.3) : un rechargement temps réel peut faire disparaître le scénario
      // actuellement sélectionné du sélecteur (ex. un autre MJ le repasse en BROUILLON, ou le
      // supprime) — sans ce garde, onSubmit() soumettrait un scenarioId qui n'apparaît plus dans
      // eligibleScenarios(). Lu après le .set() ci-dessus : le computed reflète déjà la nouvelle liste.
      const selected = this.selectedScenarioId();
      if (selected && !this.eligibleScenarios().some((s) => s.id === selected)) {
        this.selectedScenarioId.set(null);
      }
    } catch {
      this.error.set(this.theme.tone()['common.impossible_de_charger_les_scenarios_reessayez']);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (!this.isValid() || this.publishing()) return;
    this.publishing.set(true);
    this.justPublished.set(false);
    this.error.set(null);
    try {
      const created = await this.announcementsSvc.create(this.partieId(), {
        text: this.text().trim(),
        scenarioId: this.selectedScenarioId() ?? undefined,
      });
      this.text.set('');
      this.selectedScenarioId.set(null);
      this.justPublished.set(true);
      this.published.emit(created);
    } catch {
      // Revue de code : un échec de create() (ex. 400 backend, panne réseau) laissait une promesse
      // rejetée non gérée, sans retour utilisateur — le texte/la sélection sont volontairement
      // conservés (pas de reset) pour permettre une nouvelle tentative sans ressaisie.
      this.error.set(this.theme.tone()['announcement.publish_error']);
    } finally {
      this.publishing.set(false);
    }
  }
}
