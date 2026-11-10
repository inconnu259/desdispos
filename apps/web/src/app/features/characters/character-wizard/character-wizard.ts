import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { computeDerived, type DerivedStats, type RyuutamaSheetData } from '@master-jdr/game-rules';
import type { ContentEntryDto, GameSystemContentDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { CharacterService } from '../../../core/characters/character.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import {
  ClassStep,
  type ClassCapabilityPatch,
  type ClassChoicePatch,
} from './steps/class-step/class-step';
import { TypeStep } from './steps/type-step/type-step';
import { MagicStep } from './steps/magic-step/magic-step';
import { AttributesStep } from './steps/attributes-step/attributes-step';
import { WeaponStep } from './steps/weapon-step/weapon-step';
import { FetishStep } from './steps/fetish-step/fetish-step';
import { EquipmentStep } from './steps/equipment-step/equipment-step';
import { NarrativeStep } from './steps/narrative-step/narrative-step';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import { WizardSummary } from './wizard-summary/wizard-summary';
import {
  PortraitCropper,
  type PortraitCropData,
  type PortraitCropResult,
} from '../portrait-cropper/portrait-cropper';

type AttrKey = 'AGI' | 'ESP' | 'INT' | 'VIG';

/** Projection minimale de `RequiredChoice` (cf. class-step.ts) utile au wizard — `kind`/`key` seulement. */
interface RequiredChoiceLike {
  key: string;
  kind: 'eligible-talent' | 'landscape-flavor' | 'closed-list' | 'landscape-capability';
}

/** Les 9 étapes du plugin Ryuutama, portrait inclus (Story 4.5) — `magic` ajoutée Story 23.9. */
const SUPPORTED_STEP_KEYS = new Set([
  'classId',
  'typeId',
  'magic',
  'attributes',
  'weaponId',
  'fetiqueObject',
  'equipment',
  'narrative',
  'portrait',
]);

/**
 * `magic` (Story 23.9) est la toute première étape **conditionnelle** du wizard — visible
 * uniquement si `typeId === 'magie'`. Jusqu'ici, `SUPPORTED_STEP_KEYS` suffisait à filtrer les
 * étapes (un filtre **statique**, jamais dépendant d'une donnée du personnage) : `steps()` est
 * donc désormais dérivé aussi de `sheetData().typeId`, recalculé à chaque changement de type.
 */
const CONDITIONAL_STEP_VISIBILITY: Record<string, (data: Partial<RyuutamaSheetData>) => boolean> = {
  magic: (data) => data.typeId === 'magie',
};

interface CreationStep {
  key: string;
  label: string;
}

/**
 * L'étape Portrait n'a pas de texte dans le *Guide du Voyageur* (propre à cette app, pas au
 * système de jeu) — elle reste seule à vivre dans `tones.ts` (Story 23.3, AC5). Les 7 autres
 * étapes ont leur texte seedé dans `content['wizardStepIntro']` (`ContentType` Ryuutama,
 * cohérent avec AD-1) plutôt que codé en dur, pour rester générique multi-système (retour
 * utilisateur en revue de code du 2026-07-26 — corrige AD-9, cf. story file).
 */
const PORTRAIT_STEP_KEY = 'portrait';

/** Mapping du `field` retourné par `validate()` (packages/game-rules) vers la clé d'étape à rouvrir. */
const FIELD_TO_STEP_KEY: Record<string, string> = {
  classId: 'classId',
  specialtyTypeId: 'classId',
  typeId: 'typeId',
  attributes: 'attributes',
  weaponId: 'weaponId',
  // Règle 6 (Story 23.8) : `field` = `requiredChoices[].key` (ex. "fermier-metier-appoint",
  // "meteomancien-climatophile") — toujours résolu dans l'étape classId.
  'fermier-metier-appoint': 'classId',
  'ermite-metier-appoint': 'classId',
  'ermite-metamorphose': 'classId',
  'dresseur-autorite': 'classId',
  'meteomancien-climatophile': 'classId',
  // Règle 7 (Story 23.9) : choix de magie à la création, toujours résolus dans l'étape magic.
  magicSeason: 'magic',
  knownRitualSpells: 'magic',
  // Story 26.1 : erreur budget (BadRequestException([{field:'equipment',...}])) — déjà couvert
  // par le fallback `?? e.field` (clé de champ = clé d'étape), entrée explicite pour la lisibilité.
  equipment: 'equipment',
};

interface ServerValidationError {
  field: string;
  message: string;
}

@Component({
  selector: 'app-character-wizard',
  standalone: true,
  imports: [
    MatButtonModule,
    AppIcon,
    ClassStep,
    TypeStep,
    MagicStep,
    AttributesStep,
    WeaponStep,
    FetishStep,
    EquipmentStep,
    NarrativeStep,
    PortraitCropper,
    WizardSummary,
    DetailSurface,
  ],
  templateUrl: './character-wizard.html',
  styleUrl: './character-wizard.scss',
})
export class CharacterWizard implements OnInit {
  private readonly characterSvc = inject(CharacterService);
  private readonly partiesSvc = inject(PartiesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly theme = inject(ThemeToneService);

  /** Résolu depuis le paramètre de route `:id` dans `ngOnInit()`. */
  protected partieId = '';
  /** Système de jeu de la partie, résolu dans `ngOnInit()` (jamais codé en dur — cf. Partie.gameSystemId). */
  private gameSystemId = '';

  /**
   * Liste brute reçue du backend (`GameSystemSchemaDto.creationSteps`, filtrée par
   * `SUPPORTED_STEP_KEYS`) — jamais codée en dur, pour que le wizard reste générique et
   * réutilisable par un futur plugin (NFR5). Ne PAS utiliser directement pour la navigation :
   * cf. `steps` ci-dessous, qui filtre en plus les étapes conditionnelles (Story 23.9).
   */
  protected readonly allStepsRaw = signal<CreationStep[]>([]);
  protected readonly loadError = signal<string | null>(null);

  /**
   * Étapes réellement visibles compte tenu des données déjà saisies (Story 23.9 : `magic`
   * n'apparaît que si `typeId === 'magie'`). Recalculée à chaque changement de `sheetData()`.
   */
  protected readonly steps = computed<CreationStep[]>(() =>
    this.allStepsRaw().filter((s) => {
      const visible = CONDITIONAL_STEP_VISIBILITY[s.key];
      return !visible || visible(this.sheetData());
    }),
  );

  /**
   * Piloté par la **clé** de l'étape courante, pas par un index brut (Story 23.9) : si l'étape
   * `magic` disparaît de `steps()` après un aller-retour (le joueur change `typeId` après avoir
   * dépassé cette étape), un simple entier deviendrait incohérent (il pointerait sur la mauvaise
   * étape après le rétrécissement du tableau). `currentStepIndex`/`currentStepKey` ci-dessous
   * sont dérivés de cette clé à chaque lecture, jamais l'inverse — auto-cohérents même si la clé
   * suivie a disparu de `steps()` (repli sur la première étape visible, cf. `currentStepIndex`).
   */
  private readonly currentStepKeyTracked = signal('');
  protected readonly currentStepIndex = computed(() => {
    const idx = this.steps().findIndex((s) => s.key === this.currentStepKeyTracked());
    return idx >= 0 ? idx : 0;
  });
  protected readonly content = signal<GameSystemContentDto | null>(null);
  /**
   * Story 26.1 : `equipment.*` n'est plus pré-rempli côté client — le joueur choisit
   * explicitement entre le nécessaire pré-fait et l'achat libre (`EquipmentStep`), qui peuple
   * `startingEquipment` (clés du catalogue `equipmentItem` + quantités). Champ purement
   * transitoire : `CharacterService.create()` le résout en `equipment.individual`/`contenants`/
   * `animaux` réels (id/addedBy générés serveur) et le retire avant persistance — jamais dans le
   * payload de lecture `CharacterDto`.
   */
  protected readonly sheetData = signal<Partial<RyuutamaSheetData>>({
    startingEquipment: [],
  });
  protected readonly submitting = signal(false);

  /** Feuille « Récap » (téléphone, Story 31.4) : le récapitulatif de la colonne de droite y est rendu. */
  protected readonly recapOpen = signal(false);
  private readonly recapButton = viewChild<ElementRef<HTMLButtonElement>>('recapBtn');
  /** Nombre d'exemplaires d'équipement choisis — pastille du bouton « Récap ». */
  protected readonly cartCount = computed(() =>
    (this.sheetData().startingEquipment ?? []).reduce((n, s) => n + s.quantity, 0),
  );
  protected readonly stepErrors = signal<Record<string, string[]>>({});

  /** Portrait : hors `sheetData` (vit sur `Character.portraitUrl`/`portraitCropData`, uploadé après création). */
  protected readonly pendingPortraitFile = signal<File | null>(null);
  protected readonly pendingCropData = signal<PortraitCropData | null>(null);

  /** Toujours dérivée de `currentStepIndex()`/`steps()` — jamais directement de `currentStepKeyTracked()`, pour rester auto-cohérente si la clé suivie a disparu de `steps()`. */
  protected readonly currentStepKey = computed(
    () => this.steps()[this.currentStepIndex()]?.key ?? '',
  );
  protected readonly currentStepLabel = computed(
    () => this.steps()[this.currentStepIndex()]?.label ?? '',
  );
  /** Titre de la barre de navigation : « Étape 2/9 · Voyage » (rang, total et libellé de l'étape). */
  protected readonly stepProgressText = computed(() =>
    fillTone(this.theme.tone()['characters_wizard.step_progress'], {
      index: this.currentStepIndex() + 1,
      total: this.steps().length,
      label: this.currentStepLabel(),
    }),
  );
  protected readonly wizardStepIntros = computed<ContentEntryDto[]>(
    () => this.content()?.['wizardStepIntro'] ?? [],
  );
  /** Texte d'introduction propre à l'étape courante (Story 23.3) — distinct du label court ci-dessus. */
  protected readonly stepIntroText = computed(() => {
    const key = this.currentStepKey();
    if (key === PORTRAIT_STEP_KEY) return this.theme.tone()['character.step_portrait_intro'];
    const entry = this.wizardStepIntros().find((e) => e.key === key);
    return (entry?.data as { text?: string } | undefined)?.text ?? '';
  });
  protected readonly isFirstStep = computed(() => this.currentStepIndex() === 0);
  protected readonly isLastStep = computed(
    () => this.currentStepIndex() === this.steps().length - 1,
  );

  protected readonly derived = computed<DerivedStats | null>(() => {
    const attrs = this.sheetData().attributes;
    if (!attrs) return null;
    return computeDerived({ ...this.sheetData(), attributes: attrs } as RyuutamaSheetData);
  });

  protected readonly classes = computed<ContentEntryDto[]>(() => this.content()?.['class'] ?? []);
  protected readonly types = computed<ContentEntryDto[]>(() => this.content()?.['type'] ?? []);
  /** Armes précises sélectionnables (Story 25.1) — remplace l'ancien choix direct de catégorie. */
  protected readonly weaponItems = computed<ContentEntryDto[]>(
    () => this.content()?.['weaponItem'] ?? [],
  );
  protected readonly weaponCategories = computed<ContentEntryDto[]>(
    () => this.content()?.['weaponCategory'] ?? [],
  );
  protected readonly landscapes = computed<ContentEntryDto[]>(
    () => this.content()?.['landscape'] ?? [],
  );
  protected readonly seasons = computed<ContentEntryDto[]>(() => this.content()?.['season'] ?? []);
  /** Catalogue de sorts complet — `MagicStep` filtre lui-même rituelle/débutant (Story 23.9). */
  protected readonly spells = computed<ContentEntryDto[]>(() => this.content()?.['spell'] ?? []);
  /** Équipement de départ (Story 26.1) — objets achetables et nécessaires pré-faits. */
  protected readonly equipmentItems = computed<ContentEntryDto[]>(
    () => this.content()?.['equipmentItem'] ?? [],
  );
  protected readonly equipmentPackages = computed<ContentEntryDto[]>(
    () => this.content()?.['equipmentPackage'] ?? [],
  );
  /** Total Po de `sheetData().startingEquipment` — résolu depuis `equipmentItems()`, même calcul
   *  que `EquipmentStep.totalSpent` (dupliqué volontairement, cohérent avec le reste de ce
   *  fichier qui ne partage pas de logique avec les steps). */
  private readonly startingEquipmentTotalGold = computed(() => {
    const items = this.equipmentItems();
    const selection = this.sheetData().startingEquipment ?? [];
    return selection.reduce((sum, s) => {
      const entry = items.find((e) => e.key === s.key);
      const priceGold = (entry?.data as { priceGold?: number } | undefined)?.priceGold ?? 0;
      return sum + priceGold * s.quantity;
    }, 0);
  });
  /** Toutes les entrées du catalogue `attributePattern` (Story 24.1) — plus seulement la première. */
  protected readonly attributePatterns = computed<ContentEntryDto[]>(
    () => this.content()?.['attributePattern'] ?? [],
  );

  /** `requiredChoices` de la classe sélectionnée (Story 23.8) — [] si la classe n'en a aucun. */
  private readonly selectedClassRequiredChoices = computed<RequiredChoiceLike[]>(() => {
    const entry = this.classes().find((c) => c.key === this.sheetData().classId);
    return (
      (entry?.data as { requiredChoices?: RequiredChoiceLike[] } | undefined)?.requiredChoices ?? []
    );
  });

  protected readonly canGoNext = computed(() => {
    const data = this.sheetData();
    switch (this.currentStepKey()) {
      case 'classId': {
        if (!data.classId) return false;
        if (data.classId === 'artisan' && !data.specialtyTypeId?.trim()) return false;
        const allChoicesAnswered = this.selectedClassRequiredChoices().every((choice) => {
          if (choice.kind === 'landscape-capability') {
            return (data.classCapabilities?.length ?? 0) > 0;
          }
          return !!data.classChoices?.[choice.key]?.trim();
        });
        if (!allChoicesAnswered) return false;
        return true;
      }
      case 'typeId':
        return !!data.typeId;
      case 'magic':
        return !!data.magicSeason && (data.knownRitualSpells?.length ?? 0) === 2;
      case 'attributes':
        return !!data.attributes;
      case 'weaponId':
        return (
          !!data.weaponId || !!(data.customWeapon?.name?.trim() && data.customWeapon?.categoryId)
        );
      case 'equipment':
        return (
          (data.startingEquipment?.length ?? 0) > 0 && this.startingEquipmentTotalGold() <= 1000
        );
      default:
        return true;
    }
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.partieId = id;
    // Vrai seulement pendant le chargement du schéma/contenu : un 404 y signifie « ce système n'a
    // pas de module », alors qu'un 404 de `partiesSvc.get()` signifie « partie introuvable ».
    let loadingGameSystem = false;
    try {
      // `partie-detail.ts` passe déjà `gameSystemId` en query param (il l'a chargé juste avant) —
      // évite un aller-retour réseau redondant. Repli sur un fetch de la partie uniquement pour
      // une navigation directe (lien partagé, rechargement de page) où le paramètre est absent.
      const gameSystemIdParam = this.route.snapshot.queryParamMap.get('gameSystemId');
      this.gameSystemId = gameSystemIdParam ?? (await this.partiesSvc.get(id)).gameSystemId;
      loadingGameSystem = true;
      const [schema, content] = await Promise.all([
        this.characterSvc.getGameSystemSchema(this.gameSystemId),
        this.characterSvc.getGameSystemContent(this.gameSystemId),
      ]);
      const allSteps = (schema.creationSteps as CreationStep[]) ?? [];
      this.allStepsRaw.set(allSteps.filter((s) => SUPPORTED_STEP_KEYS.has(s.key)));
      this.content.set(content);
      this.currentStepKeyTracked.set(this.steps()[0]?.key ?? '');
    } catch (err) {
      // Un système de jeu déclaré mais sans module (ex. Draconis, prévu au Palier 13) répond 404 :
      // dire la vraie cause plutôt qu'un « vérifiez votre connexion » trompeur.
      if (loadingGameSystem && err instanceof HttpErrorResponse && err.status === 404) {
        this.loadError.set(this.theme.tone()['characters_wizard.load_error_no_module']);
        return;
      }
      this.loadError.set(this.theme.tone()['characters_wizard.load_error']);
    }
  }

  protected openRecap(): void {
    this.recapOpen.set(true);
  }

  protected closeRecap(): void {
    this.recapOpen.set(false);
    // Le focus revient au bouton d'origine (patron des autres surfaces flottantes).
    queueMicrotask(() => this.recapButton()?.nativeElement.focus());
  }

  protected goNext(): void {
    if (this.submitting() || !this.canGoNext() || this.isLastStep()) return;
    const next = this.steps()[this.currentStepIndex() + 1];
    if (next) this.currentStepKeyTracked.set(next.key);
  }

  protected goPrev(): void {
    if (this.submitting() || this.isFirstStep()) return;
    const prev = this.steps()[this.currentStepIndex() - 1];
    if (prev) this.currentStepKeyTracked.set(prev.key);
  }

  protected onPortraitSaved(result: PortraitCropResult): void {
    this.pendingPortraitFile.set(result.file);
    this.pendingCropData.set(result.cropData);
  }

  /** L'étape Portrait est la dernière — "Passer cette étape" finalise directement (AC1), il n'y a pas d'étape suivante. */
  protected onPortraitSkip(): void {
    this.pendingPortraitFile.set(null);
    this.pendingCropData.set(null);
    void this.onSubmit();
  }

  protected updateSheetData(patch: Partial<RyuutamaSheetData>): void {
    this.sheetData.update((d) => {
      const next = { ...d, ...patch };
      // Une spécialité saisie pour Artisan n'a plus de sens si le joueur change de classe.
      if ('classId' in patch && patch.classId !== 'artisan') {
        delete next.specialtyTypeId;
      }
      // Les choix de magie n'ont plus de sens si le joueur change de type pour autre chose que
      // "magie" (Story 23.9) — même principe que le nettoyage specialtyTypeId ci-dessus.
      if ('typeId' in patch && patch.typeId !== 'magie') {
        delete next.magicSeason;
        delete next.knownRitualSpells;
      }
      // Les choix de classe (Métier d'appoint, Métamorphose, Autorité, Climatophile) ne
      // survivent pas à un changement de classe — ne garder que ceux dont la `key` correspond
      // à un `requiredChoices` de la NOUVELLE classe sélectionnée (Story 23.8).
      if ('classId' in patch) {
        const entry = this.classes().find((c) => c.key === patch.classId);
        const newRequiredChoices =
          (entry?.data as { requiredChoices?: RequiredChoiceLike[] } | undefined)
            ?.requiredChoices ?? [];
        const newKeys = new Set(newRequiredChoices.map((c) => c.key));
        const hasLandscapeCapability = newRequiredChoices.some(
          (c) => c.kind === 'landscape-capability',
        );
        if (next.classChoices) {
          const filtered = Object.fromEntries(
            Object.entries(next.classChoices).filter(([key]) => newKeys.has(key)),
          );
          if (Object.keys(filtered).length > 0) next.classChoices = filtered;
          else delete next.classChoices;
        }
        if (next.classCapabilities && !hasLandscapeCapability) {
          delete next.classCapabilities;
        }
      }
      return next;
    });
  }

  protected onClassChoiceChange(patch: ClassChoicePatch): void {
    this.sheetData.update((d) => ({
      ...d,
      classChoices: { ...(d.classChoices ?? {}), [patch.key]: patch.value },
    }));
  }

  protected onClassCapabilityChange(patch: ClassCapabilityPatch): void {
    this.sheetData.update((d) => ({
      ...d,
      classCapabilities: [{ type: 'landscape', params: { key: patch.landscapeKey } }],
    }));
  }

  protected onAttributesChange(attrs: Record<AttrKey, number> | null): void {
    this.sheetData.update((d) => ({ ...d, attributes: attrs ?? undefined }));
  }

  protected onWeaponIdChange(weaponId: string | null): void {
    this.sheetData.update((d) => ({
      ...d,
      weaponId: weaponId ?? undefined,
      customWeapon: undefined,
    }));
  }

  /** Arme libre (Story 25.2) — sibling exclusif de `weaponId` : la renseigner efface toujours
   *  un `weaponId` précédemment choisi (défense en profondeur, `validate()` reste la source de
   *  vérité côté serveur). */
  protected onCustomWeaponChange(customWeapon: { name: string; categoryId: string } | null): void {
    this.sheetData.update((d) => ({
      ...d,
      customWeapon: customWeapon ?? undefined,
      weaponId: undefined,
    }));
  }

  protected onStartingEquipmentChange(selection: { key: string; quantity: number }[]): void {
    this.sheetData.update((d) => ({ ...d, startingEquipment: selection }));
  }

  protected async onSubmit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.stepErrors.set({});
    try {
      const created = await this.characterSvc.create(this.partieId, {
        gameSystemId: this.gameSystemId,
        sheetData: this.sheetData(),
      });

      const portraitFile = this.pendingPortraitFile();
      if (portraitFile) {
        try {
          await this.characterSvc.updatePortrait(created.id, portraitFile, this.pendingCropData());
        } catch {
          // Le personnage existe déjà : un échec d'upload ne doit pas se présenter comme un
          // échec de création (cf. Dev Notes Story 4.5) — avertissement non bloquant.
          this.snack.open(
            this.theme.tone()['characters_wizard.portrait_upload_warning'],
            undefined,
            { duration: 5000 },
          );
        }
      }

      this.router.navigate(['/parties', this.partieId, 'characters', created.id]);
    } catch (err) {
      this.handleSubmitError(err);
    } finally {
      this.submitting.set(false);
    }
  }

  private handleSubmitError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.snack.open(
        this.theme.tone()['common.une_erreur_inattendue_est_survenue_reessayez'],
        undefined,
        { duration: 4000 },
      );
      return;
    }

    if (err.status === 409) {
      const message = typeof err.error?.message === 'string' ? err.error.message : undefined;
      this.snack.open(
        message ?? this.theme.tone()['characters_wizard.already_has_character'],
        undefined,
        { duration: 4000 },
      );
      this.router.navigate(['/parties', this.partieId]);
      return;
    }

    if (err.status === 400) {
      const rawMessage = err.error?.message;
      const errors: ServerValidationError[] = Array.isArray(rawMessage)
        ? rawMessage.filter(
            (e): e is ServerValidationError =>
              typeof e === 'object' && e !== null && typeof e.field === 'string',
          )
        : [];

      if (errors.length === 0) {
        // Corps 400 générique (ex. validation DTO renvoyant un tableau de strings) : pas de
        // champ exploitable pour rouvrir une étape précise, mais on informe quand même l'utilisateur.
        const genericMessage =
          typeof rawMessage === 'string'
            ? rawMessage
            : this.theme.tone()['characters_wizard.invalid_data'];
        this.snack.open(genericMessage, undefined, { duration: 4000 });
        return;
      }

      const grouped: Record<string, string[]> = {};
      for (const e of errors) {
        const stepKey = FIELD_TO_STEP_KEY[e.field] ?? e.field;
        (grouped[stepKey] ??= []).push(e.message);
      }
      this.stepErrors.set(grouped);

      const firstStepKey = FIELD_TO_STEP_KEY[errors[0].field] ?? errors[0].field;
      this.currentStepKeyTracked.set(firstStepKey);
      return;
    }

    this.snack.open(
      this.theme.tone()['common.une_erreur_inattendue_est_survenue_reessayez'],
      undefined,
      { duration: 4000 },
    );
  }
}
