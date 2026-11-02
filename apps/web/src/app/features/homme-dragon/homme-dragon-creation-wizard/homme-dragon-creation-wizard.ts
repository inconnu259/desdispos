import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { ContentEntryDto, HommeDragonDto, HommeDragonRace } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { CharacterService } from '../../../core/characters/character.service';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  type DetailSurfaceContent,
} from '../../../shared/detail-surface/detail-surface-host';
import {
  ChoiceCard,
  type ChoiceCardOption,
} from '../../characters/character-wizard/choice-card/choice-card';
import { RadioGroupNavDirective } from '../../characters/character-wizard/choice-card/radio-group-nav.directive';
import { RACES, RACE_LABELS, RACE_TAGS } from '../homme-dragon-races';

type StepKey = 'race' | 'artefact' | 'identite' | 'vie' | 'avatar';

interface CreationStep {
  key: StepKey;
  label: string;
}

/** Longueurs maximales de l'API (`create-homme-dragon.dto.ts`). */
const MAX_NOM = 120;
const MAX_ARTEFACT_TEXT = 200;
const MAX_TEXT = 5000;

/**
 * Au-delà de ce nombre de caractères, le texte d'introduction d'une étape est tronqué à 3 lignes
 * derrière « Lire la suite ». Constante en caractères, sans mesure du DOM (rendu testable et sans
 * dépendance à la largeur d'écran).
 */
const INTRO_TRUNCATE_THRESHOLD = 180;

/** Même seuil desktop unique que le reste de l'application (règle établie par la story 31.1). */
const DESKTOP_QUERY = '(min-width: 1024px)';

interface RaceData {
  label?: string;
  description?: string;
  preferences?: string[];
}
interface IntroData {
  text?: string;
}
interface SouffleData {
  label?: string;
  description?: string;
  ps?: number;
  race?: string;
}
interface ArtefactData {
  label?: string;
  race?: string;
  description?: string;
}

/**
 * Parcours guidé de création de l'Homme Dragon (Story 33.3) : 5 étapes — Race, Artefact,
 * Identité, Vie de l'Homme Dragon, Avatar. Composant autonome (réutilisé par la Story 33.5) : il
 * charge lui-même ses catalogues (`hommeDragonRace`, `hommeDragonCreationIntro`,
 * `hommeDragonArtefact`), crée la fiche et émet le résultat via `created`.
 *
 * Les textes d'aide viennent du catalogue ; s'ils manquent (catalogue vide, fetch en échec), le
 * parcours reste complet, sans aide. Aucune donnée de Partie n'y est affichée (hors le titre qui
 * pré-remplit « Mondes protégés ») : aucun câblage SSE.
 */
@Component({
  selector: 'app-homme-dragon-creation-wizard',
  imports: [
    FormsModule,
    MatButtonModule,
    AppIcon,
    MatFormFieldModule,
    MatInputModule,
    ChoiceCard,
    RadioGroupNavDirective,
    DetailSurface,
  ],
  templateUrl: './homme-dragon-creation-wizard.html',
  styleUrl: './homme-dragon-creation-wizard.scss',
})
export class HommeDragonCreationWizard implements OnInit {
  readonly partieId = input.required<string>();
  /** Titre de la Partie — pré-remplit « Mondes protégés », éditable ensuite. */
  readonly partieName = input.required<string>();
  /** Émis avec la fiche créée. */
  readonly created = output<HommeDragonDto>();

  private readonly hommeDragonSvc = inject(HommeDragonService);
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);

  /** Surface « En savoir plus » des cartes de race (même plomberie que la fiche). */
  protected readonly detail = createDetailSurfaceHost();
  /** Race dont le « En savoir plus » est ouvert (contenu projeté dans la surface de détail). */
  protected readonly detailRace = signal<HommeDragonRace | null>(null);

  private readonly breakpointObserver = inject(BreakpointObserver);
  /** Sur desktop, la place ne manque pas : descriptions d'artefact affichées en entier et intros
   *  jamais tronquées (« En savoir plus » / « Lire la suite » n'y économiseraient rien). */
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(DESKTOP_QUERY) },
  );

  protected readonly maxNom = MAX_NOM;
  protected readonly maxArtefactText = MAX_ARTEFACT_TEXT;
  protected readonly maxText = MAX_TEXT;

  // — Catalogues —
  private readonly raceCatalog = signal<ContentEntryDto[]>([]);
  private readonly introCatalog = signal<ContentEntryDto[]>([]);
  private readonly artefactCatalog = signal<ContentEntryDto[]>([]);
  private readonly souffleCatalog = signal<ContentEntryDto[]>([]);

  // — Saisies —
  protected readonly race = signal<HommeDragonRace | null>(null);
  protected readonly artefactKey = signal<string | null>(null);
  protected readonly artefactNom = signal('');
  protected readonly artefactInscription = signal('');
  protected readonly nom = signal('');
  protected readonly apparence = signal('');
  protected readonly caractere = signal('');
  protected readonly vocation = signal('');
  protected readonly demeure = signal('');
  protected readonly mondesProteges = signal('');
  protected readonly avatar = signal('');

  // — État du parcours —
  protected readonly stepIndex = signal(0);
  protected readonly introExpanded = signal(false);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly steps = computed<CreationStep[]>(() => [
    { key: 'race', label: this.theme.tone()['homme-dragon.race_label'] ?? 'Race' },
    { key: 'artefact', label: this.theme.tone()['homme-dragon.artefact_label'] ?? 'Artefact' },
    { key: 'identite', label: 'Identité' },
    { key: 'vie', label: "Vie de l'Homme Dragon" },
    { key: 'avatar', label: 'Avatar' },
  ]);
  protected readonly currentStep = computed(() => this.steps()[this.stepIndex()]);
  /** Indicateur « Étape N/M · <nom de l'étape> » de l'en-tête. */
  protected readonly stepProgress = computed(() =>
    fillTone(this.theme.tone()['hd.wizard_step_progress'], {
      n: this.stepIndex() + 1,
      total: this.steps().length,
      etape: this.currentStep().label,
    }),
  );
  protected readonly isFirstStep = computed(() => this.stepIndex() === 0);
  protected readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);

  // — Étape Race —
  protected readonly raceOptions = computed(() =>
    RACES.map((r) => {
      const data = this.raceData(r);
      const option: ChoiceCardOption = {
        key: r,
        label: RACE_LABELS[r],
        detail: data?.description?.trim() || undefined,
      };
      return { race: r, option, tag: RACE_TAGS[r], hasDetail: !!data?.description?.trim() };
    }),
  );

  // — Étape Artefact —
  protected readonly artefactOptions = computed(() => {
    const r = this.race();
    return this.artefactCatalog()
      .filter((e) => (e.data as ArtefactData | null)?.race === r)
      .map((e) => {
        const data = (e.data ?? {}) as ArtefactData;
        const label = data.label?.trim() || e.key;
        const description = data.description?.trim() || undefined;
        const option: ChoiceCardOption = { key: e.key, label, detail: description };
        // Desktop : la description est déjà affichée en entier sur la carte, pas de déclencheur.
        const detailContent: DetailSurfaceContent | null =
          description && !this.isDesktop() ? { title: label, body: description } : null;
        return { option, detailContent };
      });
  });

  // — Validation par étape —
  protected readonly canGoNext = computed(() => {
    switch (this.currentStep().key) {
      case 'race':
        return !!this.race();
      case 'artefact':
        return !!this.artefactKey() && this.artefactNom().trim().length > 0;
      case 'identite':
        return this.nom().trim().length > 0;
      default:
        return true;
    }
  });

  protected readonly isValid = computed(
    () =>
      !!this.race() &&
      !!this.artefactKey() &&
      this.artefactNom().trim().length > 0 &&
      this.nom().trim().length > 0,
  );

  // — Texte d'introduction de l'étape courante (race, artefact, avatar) —
  protected readonly introText = computed<string | null>(() => {
    const key = this.currentStep().key;
    return key === 'race' || key === 'artefact' || key === 'avatar' ? this.help(key) : null;
  });
  protected readonly introTruncatable = computed(
    () => !this.isDesktop() && (this.introText()?.length ?? 0) > INTRO_TRUNCATE_THRESHOLD,
  );

  /** Contenu du « En savoir plus » de la race ouverte : description, préférences, puis les
   *  artefacts et les souffles propres à cette race, pour aider à choisir (décision 2026-09-29). */
  protected readonly raceInfo = computed(() => {
    const race = this.detailRace();
    if (!race) return null;
    const data = this.raceData(race);
    const preferences = (data?.preferences ?? []).map((p) => p.trim()).filter(Boolean);
    const artefacts = this.artefactCatalog()
      .filter((e) => (e.data as ArtefactData | null)?.race === race)
      .map((e) => {
        const a = (e.data ?? {}) as ArtefactData;
        return { key: e.key, label: a.label?.trim() || e.key, description: a.description?.trim() ?? '' };
      });
    const souffles = this.souffleCatalog()
      .filter((e) => (e.data as SouffleData | null)?.race === race)
      .map((e) => {
        const sf = (e.data ?? {}) as SouffleData;
        return {
          key: e.key,
          label: sf.label?.trim() || e.key,
          ps: sf.ps,
          description: sf.description?.trim() ?? '',
        };
      });
    return {
      description: data?.description?.trim() ?? '',
      preferences: preferences.join(', '),
      artefacts,
      souffles,
    };
  });

  async ngOnInit(): Promise<void> {
    this.mondesProteges.set(this.partieName());
    try {
      const content = await this.characterSvc.getGameSystemContent('ryuutama');
      this.raceCatalog.set(content['hommeDragonRace'] ?? []);
      this.introCatalog.set(content['hommeDragonCreationIntro'] ?? []);
      this.artefactCatalog.set(content['hommeDragonArtefact'] ?? []);
      this.souffleCatalog.set(content['souffle'] ?? []);
    } catch {
      // Non bloquant : le parcours reste complet, sans aide ni artefact proposé.
    }
  }

  /** Texte d'aide du catalogue pour `key`, ou `null` (aucune aide rendue). */
  protected help(key: string): string | null {
    const entry = this.introCatalog().find((e) => e.key === key);
    return (entry?.data as IntroData | undefined)?.text?.trim() || null;
  }

  private raceData(race: HommeDragonRace): RaceData | undefined {
    return this.raceCatalog().find((e) => e.key === race)?.data as RaceData | undefined;
  }

  /** Nom accessible des boutons « En savoir plus » (contient le libellé visible). */
  protected moreAria(nom: string): string {
    return fillTone(this.theme.tone()['hd.wizard_more_aria'], { nom });
  }

  /** Ouvre le « En savoir plus » d'une race (contenu projeté, voir `raceInfo`). */
  protected openRaceDetail(race: HommeDragonRace, event: Event): void {
    this.detailRace.set(race);
    this.detail.openContent({ title: RACE_LABELS[race], body: '' }, event);
  }

  protected onDetailClosed(): void {
    this.detailRace.set(null);
    this.detail.close();
  }

  protected onRaceChange(race: string): void {
    if (race === this.race()) return;
    this.race.set(race as HommeDragonRace);
    // Le nouvel ensemble d'artefacts remplace l'ancien : l'artefact choisi, son nom et son
    // inscription appartenaient à l'ancienne race.
    this.artefactKey.set(null);
    this.artefactNom.set('');
    this.artefactInscription.set('');
  }

  protected goNext(): void {
    if (!this.canGoNext() || this.isLastStep()) return;
    this.stepIndex.update((i) => i + 1);
    this.introExpanded.set(false);
    this.createError.set(null);
  }

  protected goPrev(): void {
    if (this.isFirstStep()) return;
    this.stepIndex.update((i) => i - 1);
    this.introExpanded.set(false);
    this.createError.set(null);
  }

  protected async onSubmit(): Promise<void> {
    if (!this.isValid() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const created = await this.hommeDragonSvc.create(this.partieId(), {
        race: this.race()!,
        artefact: {
          key: this.artefactKey()!,
          nom: this.artefactNom().trim() || undefined,
          inscription: this.artefactInscription().trim() || undefined,
        },
        nom: this.nom().trim(),
        apparence: this.apparence().trim() || undefined,
        caractere: this.caractere().trim() || undefined,
        vocation: this.vocation().trim() || undefined,
        demeure: this.demeure().trim() || undefined,
        avatar: this.avatar().trim() || undefined,
        mondesProteges: this.mondesProteges().trim() || undefined,
      });
      this.created.emit(created);
    } catch (e) {
      // AD-23 : `409` = l'aventure a reçu un Homme Dragon entre-temps (autre onglet) — la création a
      // été annulée côté serveur, aucune fiche orpheline.
      this.createError.set(
        e instanceof HttpErrorResponse && e.status === 409
          ? this.theme.tone()['hd.wizard_create_conflict_error']
          : this.theme.tone()['hd.wizard_create_error'],
      );
    } finally {
      this.creating.set(false);
    }
  }
}
