import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import type { CharacterDto, GameSystemContentDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { CharacterService } from '../../../core/characters/character.service';
import { characterName, findContentEntry, isFieldHidden } from '../../../core/characters/character.util';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { DetailSurface } from '../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  detailContent,
} from '../../../shared/detail-surface/detail-surface-host';
import { talentDetail } from '../../../shared/detail-surface/talent-detail';
import { CharacterAvatar } from '../character-avatar/character-avatar';
import { PortraitPanel } from '../portrait-panel/portrait-panel';
import {
  PortraitCropper,
  type PortraitCropperData,
  type PortraitCropResult,
} from '../portrait-cropper/portrait-cropper';
import { SheetActionsMenu } from './sheet-actions-menu/sheet-actions-menu';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LevelUpBanner } from './level-up-banner/level-up-banner';
import { LevelUpWizard, type LevelUpWizardData } from './level-up-wizard/level-up-wizard';
import { HistoryTab } from './history-tab/history-tab';
import { InventoryTab } from './inventory-tab/inventory-tab';
import { NotesJournal } from './notes-journal/notes-journal';
import { FieldEditPencil, type FieldEditPencilOption } from './field-edit-pencil/field-edit-pencil';
import {
  capabilityDescription,
  getCapabilitiesByType,
  getOtherCapabilities,
} from './capability-label.util';
import {
  resolveWeapon,
  type ResolvedWeapon,
  type WeaponCategoryEntry,
  type WeaponItemEntry,
  type WeaponItemContentData,
  type WeaponCategoryContentData,
} from '@master-jdr/game-rules';

interface ClassTalentFull {
  id?: string;
  name: string;
  effect: { description: string; conditions: string };
  /** Données structurées du catalogue, lues pour le tableau de la surface de détail (31.4). */
  attributes?: string[];
  difficulty?: string;
  description?: string;
}

export type RequiredChoiceKind =
  'eligible-talent' | 'landscape-flavor' | 'closed-list' | 'landscape-capability';

interface RequiredChoiceOption {
  value: string;
  label: string;
}

interface RequiredChoice {
  key: string;
  talentId: string;
  kind: RequiredChoiceKind;
  label: string;
  options?: RequiredChoiceOption[];
}

interface ClassData {
  label: string;
  description?: string;
  talents: ClassTalentFull[];
  requiredChoices?: RequiredChoice[];
}

/**
 * Choix de classe résolu pour affichage (Story 23.8) — le talent emprunté (Métier d'appoint), le
 * paysage narratif (Métamorphose) ou le type de créature (Autorité). Climatophile (kind
 * `landscape-capability`) n'apparaît jamais ici : il est affiché par la section "Paysage/climat
 * favori" existante (`landscapes` ci-dessus), une fois `classCapabilities` fusionné par
 * `getFlatCapabilities()` (Task 6).
 */
export interface ClassChoiceDisplay {
  key: string;
  kind: RequiredChoiceKind;
  label: string;
  talentName?: string;
  talentEffectDescription?: string;
  malus?: string;
  originClassLabel?: string;
  valueLabel?: string;
}

interface SeasonData {
  label: string;
}

interface SpellData {
  name: string;
  description: string;
  peCost: number;
}

/** Saison d'affinité + 2 sorts rituels connus, résolus pour affichage (Story 23.9). */
export interface MagicDisplay {
  seasonLabel: string;
  ritualSpells: { key: string; name: string; description: string; peCost: number }[];
}

interface TypeData {
  label: string;
  description?: string;
  advantages: { name: string; effect: string }[];
}

interface AttributePatternData {
  label: string;
  values: number[];
}

/**
 * Story 31.1 — positions du menu « ⋮ » de la fiche, même patron que `DISPLAY_PANEL_POSITIONS`
 * (`calendar-view.ts`, story 36.14) : sous le déclencheur, aligné sur son bord de départ, avec un
 * repli au-dessus pour les très petites hauteurs. Le déclencheur vit en haut à droite de l'en-tête
 * — priorité à l'alignement `end` plutôt que `start`, pour ne jamais dépasser à droite de l'écran.
 */
const SHEET_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

interface NarrativeFields {
  sex?: string;
  age?: string;
  physicalTraits?: string;
  homeTown?: string;
  motivation?: string;
  personality?: string;
}

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [
    CharacterAvatar,
    RouterLink,
    MatButtonModule,
    AppIcon,
    MatTabsModule,
    PortraitPanel,
    LevelUpBanner,
    HistoryTab,
    InventoryTab,
    NotesJournal,
    FieldEditPencil,
    IdentityLabel,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    CdkTrapFocus,
    SheetActionsMenu,
    DetailSurface,
  ],
  templateUrl: './character-sheet.html',
  styleUrl: './character-sheet.scss',
})
export class CharacterSheet implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly characterSvc = inject(CharacterService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeToneService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpointObserver = inject(BreakpointObserver);

  /**
   * Story 31.1 — même seuil unique du projet que `CalendarView.DESKTOP_QUERY` (36.14),
   * `partie-detail` et `list-control-bar` : ne pas en introduire un second.
   */
  private static readonly DESKTOP_QUERY = '(min-width: 1024px)';
  protected readonly isDesktop = toSignal(
    this.breakpointObserver.observe(CharacterSheet.DESKTOP_QUERY).pipe(map((r) => r.matches)),
    { initialValue: this.breakpointObserver.isMatched(CharacterSheet.DESKTOP_QUERY) },
  );

  protected readonly sheetMenuOpen = signal(false);
  protected readonly SHEET_MENU_POSITIONS = SHEET_MENU_POSITIONS;
  private readonly sheetMenuTrigger = viewChild<ElementRef<HTMLButtonElement>>('sheetMenuTrigger');

  protected toggleSheetMenu(): void {
    this.sheetMenuOpen.update((open) => !open);
  }

  /** AC7 — rendre le focus au déclencheur : sans quoi un utilisateur clavier retombe en haut du
   *  document (même patron que `CalendarView.closeDisplayPanel()`, story 36.14). */
  protected closeSheetMenu(): void {
    this.sheetMenuOpen.set(false);
    this.sheetMenuTrigger()?.nativeElement.focus();
  }

  protected onSheetMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeSheetMenu();
    }
  }

  /**
   * Surface de détail des talents/avantages/sorts (FR-20) et des termes de règle (FR-19).
   * L'état, le jeton d'ouverture et le retour du focus vivent dans `createDetailSurfaceHost()`,
   * partagé avec l'assistant de création — un seul emplacement ouvert à la fois, jamais une pile.
   */
  protected readonly detail = createDetailSurfaceHost();

  /** Règle AC3 partagée avec l'assistant : pas de texte au catalogue ⇒ pas de déclencheur. */
  protected readonly help = detailContent;

  /** Tableau mécanique + récit d'un talent (31.4, DESIGN §7.2) — même fonction que l'assistant. */
  protected talentHelp(talent: ClassTalentFull) {
    const tone = this.theme.tone();
    return talentDetail(talent, {
      attributes: tone['detail.row_attributes'],
      difficulty: tone['detail.row_difficulty'],
      effect: tone['detail.row_effect'],
      conditions: tone['detail.row_conditions'],
    });
  }

  // Requêtes par nom de ref plutôt que refs de template croisant les blocs `@if` (les pencils
  // sont déclarés dans des blocs conditionnels distincts de ceux qui masquent l'affichage
  // statique — viewChild() résout indépendamment de l'imbrication, contrairement à une variable
  // de template référencée hors de son bloc de déclaration, revue de code).
  protected readonly vigPencil = viewChild<FieldEditPencil>('vigPencil');
  protected readonly agiPencil = viewChild<FieldEditPencil>('agiPencil');
  protected readonly intPencil = viewChild<FieldEditPencil>('intPencil');
  protected readonly espPencil = viewChild<FieldEditPencil>('espPencil');
  protected readonly xpPencil = viewChild<FieldEditPencil>('xpPencil');
  protected readonly weaponPencil = viewChild<FieldEditPencil>('weaponPencil');
  protected readonly fetishPencil = viewChild<FieldEditPencil>('fetishPencil');
  protected readonly sexPencil = viewChild<FieldEditPencil>('sexPencil');
  protected readonly agePencil = viewChild<FieldEditPencil>('agePencil');
  protected readonly physicalTraitsPencil = viewChild<FieldEditPencil>('physicalTraitsPencil');
  protected readonly homeTownPencil = viewChild<FieldEditPencil>('homeTownPencil');
  protected readonly motivationPencil = viewChild<FieldEditPencil>('motivationPencil');
  protected readonly personalityPencil = viewChild<FieldEditPencil>('personalityPencil');

  /** Id de la partie lu depuis la route (une seule fois, comme `characterId` plus bas) — exposé
   *  pour le lien « Retour à la partie », utilisé à la fois par la branche succès (`c.partieId`,
   *  déjà en place) et par la branche d'erreur (`loadError()`), qui n'a elle aucune donnée
   *  personnage chargée pour le déduire. Sans ça, un échec de chargement (403, erreur réseau)
   *  laissait l'utilisateur sans moyen de revenir à sa partie autre que le bouton retour du
   *  navigateur. */
  protected readonly partieId = this.route.snapshot.paramMap.get('id');

  protected readonly character = signal<CharacterDto | null>(null);
  protected readonly content = signal<GameSystemContentDto | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly exportError = signal<string | null>(null);
  protected readonly exporting = signal<'editable' | '2pages' | null>(null);
  protected readonly exportEquipmentError = signal<string | null>(null);
  protected readonly exportingEquipment = signal(false);
  protected readonly exportNotesError = signal<string | null>(null);
  protected readonly exportingNotes = signal(false);
  protected readonly portraitError = signal<string | null>(null);

  protected readonly sheetData = computed(
    () => (this.character()?.sheetData ?? {}) as Record<string, unknown>,
  );
  protected readonly name = computed(() => {
    const c = this.character();
    return c ? characterName(c) : '';
  });

  /**
   * Le MJ peut consulter la fiche d'un personnage de ses joueurs (lecture seule), mais jamais
   * modifier son portrait — seul le propriétaire le peut (FR39, cf. Dev Notes Story 4.5). Le CTA
   * "Modifier le portrait" ne doit donc s'afficher que pour le propriétaire.
   */
  protected readonly isOwner = computed(
    () => !!this.character() && this.character()?.userId === this.auth.currentUser()?.id,
  );

  /** AC6 — le recadrage PDF n'apparaît dans le menu que pour le propriétaire d'un personnage qui
   *  porte déjà un portrait — même garde que `editPdfPortraitCrop()` ci-dessous. */
  protected readonly showPdfCropInMenu = computed(
    () => this.isOwner() && !!this.character()?.portraitUrl,
  );

  /**
   * Le viewer est le MJ de la Partie — lu directement depuis `CharacterDto.viewerIsMj` (résolu
   * côté serveur, Story 6.5 revue de code), **pas** une heuristique "tout non-propriétaire = MJ".
   * Cette ancienne heuristique était fausse dès qu'un fellow player (ni propriétaire, ni MJ) a pu
   * consulter la fiche d'un coéquipier (`findOne` élargi à tout participant, cf. Story 6.5) : il
   * aurait alors vu à tort la section Historique et le badge MJ. `!isOwner()` reste requis en plus
   * du champ API : un MJ consultant **sa propre** fiche (`viewerIsMj` API = true, `isOwner()` =
   * true aussi) ne doit pas afficher le badge "vous consultez la fiche de quelqu'un d'autre" —
   * `isOwner()` prime toujours (cf. tests dédiés).
   */
  protected readonly viewerIsMj = computed(
    () => !this.isOwner() && (this.character()?.viewerIsMj ?? false),
  );

  /**
   * Sous-navigation locale (Story 29.5) — même patron que `PartieDetail` (29.4) : `mat-tab-group`
   * piloté par un `selectedIndex`/`(selectedIndexChange)` purement local, aucune route Angular
   * enfant, aucun état persisté dans l'URL (cf. story 29.5, Décision d'implémentation).
   */
  protected readonly hasHistoryTab = computed(() => this.isOwner() || this.viewerIsMj());
  // Reset l'onglet manuel si l'ensemble d'onglets change de forme (apparition/disparition de
  // l'onglet Historique) — même garde que PartieDetail.tabSetKey (29.4), évite un selectedIndex
  // qui pointerait sur un onglet qui n'existe plus.
  protected readonly tabSetKey = computed(() => `${this.hasHistoryTab()}`);
  protected readonly manualTabIndex = signal<number | null>(null);
  protected readonly selectedTabIndex = computed(() => this.manualTabIndex() ?? 0);

  protected onTabIndexChange(index: number): void {
    this.manualTabIndex.set(index);
  }

  protected readonly classData = computed<ClassData | null>(() =>
    findContentEntry<ClassData>(
      this.content(),
      'class',
      this.sheetData()['classId'] as string | undefined,
    ),
  );

  protected readonly typeData = computed<TypeData | null>(() =>
    findContentEntry<TypeData>(
      this.content(),
      'type',
      this.sheetData()['typeId'] as string | undefined,
    ),
  );

  /** Arme précise + catégorie résolue (Story 25.1), ou arme libre (Story 25.2, `customWeapon`,
   *  priorité à `weaponId` si les deux sont transitoirement présents — édition MJ). */
  protected readonly weaponData = computed<ResolvedWeapon | null>(() => {
    const weaponId = this.sheetData()['weaponId'] as string | undefined;
    const customWeapon = this.sheetData()['customWeapon'] as
      { name: string; categoryId: string } | undefined;
    if (!weaponId && !customWeapon) return null;
    const weaponItems: WeaponItemEntry[] = (this.content()?.['weaponItem'] ?? []).map((entry) => ({
      key: entry.key,
      ...(entry.data as WeaponItemContentData),
    }));
    const weaponCategories: WeaponCategoryEntry[] = (this.content()?.['weaponCategory'] ?? []).map(
      (entry) => ({ key: entry.key, ...(entry.data as WeaponCategoryContentData) }),
    );
    return resolveWeapon({ weaponId, customWeapon }, { weaponItems, weaponCategories });
  });

  /** Texte de règle de la catégorie d'arme — absent de `ResolvedWeapon` (qui ne porte que ce qui
   *  sert au calcul), relu du catalogue par la clé déjà résolue. */
  protected readonly weaponCategoryDescription = computed<string | undefined>(
    () =>
      findContentEntry<{ description?: string }>(
        this.content(),
        'weaponCategory',
        this.weaponData()?.categoryId,
      )?.description,
  );

  /**
   * Saison d'affinité + 2 sorts rituels connus (Story 23.9) — `null` pour tout personnage dont
   * `typeId !== 'magie'`. Ne concerne jamais Climatophile (Story 23.8, `classCapabilities`),
   * affiché lui via la section "Paysage/climat favori" existante.
   */
  protected readonly magicData = computed<MagicDisplay | null>(() => {
    if (this.sheetData()['typeId'] !== 'magie') return null;
    const seasonKey = this.sheetData()['magicSeason'] as string | undefined;
    const seasonLabel = findContentEntry<SeasonData>(this.content(), 'season', seasonKey)?.label;
    if (!seasonLabel) return null;

    const spellKeys = (this.sheetData()['knownRitualSpells'] as string[] | undefined) ?? [];
    const ritualSpells = spellKeys
      .map((key) => {
        const data = findContentEntry<SpellData>(this.content(), 'spell', key);
        return data
          ? { key, name: data.name, description: data.description, peCost: data.peCost }
          : null;
      })
      .filter((s): s is MagicDisplay['ritualSpells'][number] => s !== null);

    return { seasonLabel, ritualSpells };
  });

  /** Suggestions catalogue pour la combobox de l'arme de prédilection (AC7, Story 6.7). */
  protected readonly weaponOptions = computed<FieldEditPencilOption[]>(() =>
    (this.content()?.['weaponItem'] ?? []).map((entry) => ({
      key: entry.key,
      label: (entry.data as WeaponItemContentData).label,
    })),
  );

  /** Spécialité texte libre de la classe Artisan (seule classe l'exigeant), sinon `undefined`. */
  protected readonly specialtyTypeId = computed<string | undefined>(
    () => this.sheetData()['specialtyTypeId'] as string | undefined,
  );

  /**
   * Capacités sans section structurelle dédiée (Protection d'un dragon, Voyage légendaire, et
   * tout type futur du même genre) — petit encart générique, cf. EXPERIENCE.md §4. Le choix fait
   * pour chaque montée de niveau structurelle (Attribut/Paysage/Immunité/Classe/Type) est, lui,
   * visible directement dans la section Historique (fusion Historique/choix, cf. `HistoryTab`).
   */
  protected readonly otherCapabilities = computed(() => {
    const c = this.character();
    if (!c) return [];
    return getOtherCapabilities(c).map((entry) => ({
      level: entry.level,
      text: capabilityDescription(entry, this.content()),
    }));
  });

  /**
   * Classe secondaire (capacité 'class', niveau 5) — sous-bloc de la section Vocation, cf.
   * EXPERIENCE.md §4 "Intégration des capacités dans la fiche". Un seul choix possible par
   * `LEVEL_TABLE` (contrairement au paysage/climat, obtenu jusqu'à 2 fois).
   */
  protected readonly secondaryClass = computed<ClassData | null>(() => {
    const c = this.character();
    if (!c) return null;
    const key = getCapabilitiesByType(c, 'class')[0]?.capability.params['key'] as
      string | undefined;
    return findContentEntry<ClassData>(this.content(), 'class', key);
  });

  /** Type secondaire (capacité 'type', niveau 6) — sous-bloc de la section Voie. */
  protected readonly secondaryType = computed<TypeData | null>(() => {
    const c = this.character();
    if (!c) return null;
    const key = getCapabilitiesByType(c, 'type')[0]?.capability.params['key'] as string | undefined;
    return findContentEntry<TypeData>(this.content(), 'type', key);
  });

  /** Paysages/climats favoris obtenus (capacité 'landscape', niveaux 3 et 7 — jusqu'à 2). */
  protected readonly landscapes = computed<string[]>(() => {
    const c = this.character();
    if (!c) return [];
    return getCapabilitiesByType(c, 'landscape')
      .map(
        (entry) =>
          findContentEntry<{ label: string }>(
            this.content(),
            'landscape',
            entry.capability.params['key'] as string | undefined,
          )?.label,
      )
      .filter((label): label is string => !!label);
  });

  /**
   * Choix de classe résolus pour affichage (Story 23.8) — talent emprunté (Métier d'appoint),
   * paysage narratif (Métamorphose), type de créature (Autorité). Le climat de Climatophile
   * (kind `landscape-capability`) n'est jamais inclus ici : il apparaît via la section
   * "Paysage/climat favori" existante (`landscapes` ci-dessus), cf. Task 6/Dev Notes.
   */
  protected readonly classChoiceDisplays = computed<ClassChoiceDisplay[]>(() => {
    const data = this.classData();
    if (!data?.requiredChoices?.length) return [];
    const classChoices =
      (this.sheetData()['classChoices'] as Record<string, string> | undefined) ?? {};

    return data.requiredChoices
      .map((choice): ClassChoiceDisplay | null => {
        if (choice.kind === 'landscape-capability') return null;
        const value = classChoices[choice.key];
        if (!value) return null;

        if (choice.kind === 'eligible-talent') {
          const [originClassKey, talentId] = value.split(':');
          const originClassData = findContentEntry<ClassData>(
            this.content(),
            'class',
            originClassKey,
          );
          const talent = originClassData?.talents.find((t) => t.id === talentId);
          // Valeur malformée ou talent introuvable (revue de code, 2026-07-26) : ne pas afficher
          // un malus/label incomplets avec un nom de talent vide — préférer ne rien afficher.
          if (!talent) return null;
          return {
            key: choice.key,
            kind: choice.kind,
            label: choice.label,
            talentName: talent.name,
            talentEffectDescription: talent.effect.description,
            malus: '-1',
            originClassLabel: originClassData?.label,
          };
        }

        if (choice.kind === 'landscape-flavor') {
          const landscapeLabel = findContentEntry<{ label: string }>(
            this.content(),
            'landscape',
            value,
          )?.label;
          return {
            key: choice.key,
            kind: choice.kind,
            label: choice.label,
            valueLabel: landscapeLabel ?? value,
          };
        }

        // closed-list (ex. Autorité du Dresseur)
        const optionLabel = choice.options?.find((o) => o.value === value)?.label;
        return {
          key: choice.key,
          kind: choice.kind,
          label: choice.label,
          valueLabel: optionLabel ?? value,
        };
      })
      .filter((d): d is ClassChoiceDisplay => d !== null);
  });

  /** Immunités obtenues (capacité 'immunity', niveau 4). */
  protected readonly immunities = computed<string[]>(() => {
    const c = this.character();
    if (!c) return [];
    return getCapabilitiesByType(c, 'immunity')
      .map(
        (entry) =>
          findContentEntry<{ label: string }>(
            this.content(),
            'immunityState',
            entry.capability.params['key'] as string | undefined,
          )?.label,
      )
      .filter((label): label is string => !!label);
  });

  /** Chemins retirés par le cadenas de visibilité pour ce lecteur (Story 31.6/31.7) — vide pour le
   *  propriétaire/MJ (jamais masqués) ou une Partie sans configuration. Sert uniquement à distinguer
   *  « masqué par le MJ » de « non renseigné » là où une section entière disparaîtrait sinon
   *  silencieusement (correctif de revue, session bmad-build 2026-09-22) — pas une refonte de chaque
   *  section. Délègue à `isFieldHidden()` (`character.util.ts`), partagée avec `InventoryTab` — une
   *  seule vérification `hiddenFields`, jamais deux implémentations indépendantes. */
  protected isHidden(path: string): boolean {
    const c = this.character();
    return !!c && isFieldHidden(c, path);
  }

  protected readonly attributes = computed<{
    AGI: number;
    ESP: number;
    INT: number;
    VIG: number;
  } | null>(
    () =>
      (this.sheetData()['attributes'] as { AGI: number; ESP: number; INT: number; VIG: number }) ??
      null,
  );

  /** Nom du pattern d'attributs dont les valeurs (triées) correspondent à celles du personnage.
   *  Correctif de revue (session bmad-build 2026-09-22) : si un seul sous-champ est verrouillé
   *  (ex. `attributes.AGI`), la valeur manquante ne doit jamais entrer dans la comparaison — sans
   *  cette garde, `undefined` comparé numériquement (`NaN`) rendait la détection du patron
   *  imprévisible au lieu de simplement l'écarter. */
  protected readonly attributePatternLabel = computed<string | null>(() => {
    const attrs = this.attributes();
    const c = this.character();
    if (!attrs || !c) return null;
    if (
      ['attributes', 'attributes.AGI', 'attributes.ESP', 'attributes.INT', 'attributes.VIG'].some(
        (path) => isFieldHidden(c, path),
      )
    ) {
      return null;
    }
    const sortedOwn = [attrs.AGI, attrs.ESP, attrs.INT, attrs.VIG].sort((a, b) => a - b);
    const patterns = this.content()?.['attributePattern'] ?? [];
    for (const p of patterns) {
      const data = p.data as AttributePatternData;
      const sortedPattern = [...data.values].sort((a, b) => a - b);
      if (
        sortedPattern.length === sortedOwn.length &&
        sortedPattern.every((v, i) => v === sortedOwn[i])
      ) {
        return data.label;
      }
    }
    return null;
  });

  protected readonly fetiqueObject = computed<string | undefined>(
    () => this.sheetData()['fetiqueObject'] as string | undefined,
  );

  protected readonly narrative = computed<NarrativeFields>(
    () => (this.sheetData()['narrative'] as NarrativeFields) ?? {},
  );

  constructor() {
    // Story 20.1 (AC1) : réagit au signal générique CharacterService.changed (RealtimeService).
    // PIÈGE (même classe que ScenarioEditor, Story 19.2 Task 1) : CharacterSheet a DÉJÀ un
    // chargement dédié dans ngOnInit() (fetch au montage). La première exécution d'un effect() a
    // lieu à la CONSTRUCTION du composant — si `changed()` porte déjà une valeur (mutation locale
    // antérieure dans la même session applicative, CharacterService étant `providedIn: 'root'`),
    // cette première exécution déclencherait un refetch REDONDANT avec celui que ngOnInit() fait
    // juste après. Le flag `firstRun` neutralise uniquement cette toute première exécution.
    let firstRun = true;
    effect(() => {
      this.characterSvc.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.refreshCharacter());
    });

    effect(() => {
      this.tabSetKey();
      untracked(() => this.manualTabIndex.set(null));
    });
  }

  // Utilisée UNIQUEMENT par l'effect() ci-dessus — PAS par le fetch initial de ngOnInit(), qui
  // reste ciblé par le paramètre de route characterId (jamais par this.character(), pas encore
  // garanti peuplé au moment où ngOnInit() s'exécute, même piège de timing que Story 19.2).
  private async refreshCharacter(): Promise<void> {
    const c = this.character();
    if (!c) return;
    try {
      this.character.set(await this.characterSvc.get(c.id));
    } catch {
      // non-bloquant — la fiche affichée reste telle quelle si le rafraîchissement échoue
    }
  }

  async ngOnInit(): Promise<void> {
    const partieId = this.partieId;
    if (partieId) {
      this.realtime.connect(partieTopic(partieId));
      this.destroyRef.onDestroy(() => this.realtime.disconnect(partieTopic(partieId)));
    }

    const characterId = this.route.snapshot.paramMap.get('characterId');
    if (!characterId) {
      this.loadError.set(this.theme.tone()['characters_sheet.not_found']);
      return;
    }
    try {
      this.character.set(await this.characterSvc.get(characterId));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 403) {
        this.loadError.set(this.theme.tone()['characters_sheet.access_denied']);
      } else {
        this.loadError.set(this.theme.tone()['characters_sheet.load_error']);
      }
      return;
    }
    try {
      const gameSystemId = this.character()!.gameSystemId;
      this.content.set(await this.characterSvc.getGameSystemContent(gameSystemId));
    } catch {
      // Contenu non critique pour l'affichage : la fiche reste consultable, seuls les
      // labels/talents/avantages résolus resteront vides.
    }
  }

  /**
   * Story 31.1, AC4 — le menu se ferme AVANT que l'action ne parte : un export part en tâche de
   * fond, le recadrage ouvre son propre `MatDialog`, et les deux se marcheraient dessus
   * visuellement si le menu restait ouvert par-dessus.
   */
  protected onSheetMenuExportEditable(): void {
    this.closeSheetMenu();
    void this.exportPdf('editable');
  }

  protected onSheetMenuExport2Pages(): void {
    this.closeSheetMenu();
    void this.exportPdf('2pages');
  }

  protected onSheetMenuExportEquipment(): void {
    this.closeSheetMenu();
    void this.exportEquipmentPdf();
  }

  protected onSheetMenuExportNotes(): void {
    this.closeSheetMenu();
    void this.exportNotesPdf();
  }

  protected onSheetMenuCropPdfPortrait(): void {
    this.closeSheetMenu();
    this.editPdfPortraitCrop();
  }

  /** Revue de code 31.1 — un export en vol n'est plus visible (le menu se referme avant même que
   *  l'appel ne parte, AC4), donc la garde qui vivait dans `[disabled]` sur les boutons de l'ancien
   *  en-tête a disparu avec eux. Reprise ici, à l'entrée de chaque méthode : sans elle, rouvrir le
   *  menu et recliquer pendant qu'un export est encore en vol lance un second appel concurrent qui
   *  écrase silencieusement les signaux `exporting*`/`export*Error` partagés par le premier. */
  private exportInFlight(): boolean {
    return this.exporting() !== null || this.exportingEquipment() || this.exportingNotes();
  }

  protected async exportPdf(format: 'editable' | '2pages'): Promise<void> {
    const c = this.character();
    if (!c || this.exportInFlight()) return;
    this.exportError.set(null);
    this.exporting.set(format);
    try {
      const blob = await this.characterSvc.exportPdf(c.id, format);
      const url = URL.createObjectURL(blob);
      const safeName = (this.name() || 'personnage').replace(/[^a-z0-9-_]+/gi, '_');
      const link = document.createElement('a');
      link.href = url;
      link.download = `fiche-${safeName}-${format}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.exportError.set(this.theme.tone()['character.export_error']);
    } finally {
      this.exporting.set(null);
    }
  }

  protected async exportEquipmentPdf(): Promise<void> {
    const c = this.character();
    if (!c || this.exportInFlight()) return;
    this.exportEquipmentError.set(null);
    this.exportingEquipment.set(true);
    try {
      const blob = await this.characterSvc.exportEquipmentPdf(c.id);
      const url = URL.createObjectURL(blob);
      const safeName = (this.name() || 'personnage').replace(/[^a-z0-9-_]+/gi, '_');
      const link = document.createElement('a');
      link.href = url;
      link.download = `equipement-${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.exportEquipmentError.set(this.theme.tone()['character.export_error']);
    } finally {
      this.exportingEquipment.set(false);
    }
  }

  protected async exportNotesPdf(): Promise<void> {
    const c = this.character();
    if (!c || this.exportInFlight()) return;
    this.exportNotesError.set(null);
    this.exportingNotes.set(true);
    try {
      const blob = await this.characterSvc.exportNotesPdf(c.id);
      const url = URL.createObjectURL(blob);
      const safeName = (this.name() || 'personnage').replace(/[^a-z0-9-_]+/gi, '_');
      const link = document.createElement('a');
      link.href = url;
      link.download = `notes-${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.exportNotesError.set(this.theme.tone()['character.export_error']);
    } finally {
      this.exportingNotes.set(false);
    }
  }

  private portraitDialogOpen = false;

  protected editPortrait(): void {
    if (this.portraitDialogOpen || !this.isOwner()) return;
    const c = this.character();
    if (!c) return;
    this.portraitError.set(null);
    this.portraitDialogOpen = true;
    const ref = this.dialog.open<PortraitCropper, PortraitCropperData, PortraitCropResult | null>(
      PortraitCropper,
      { data: { characterId: c.id } },
    );
    ref.afterClosed().subscribe((result) => {
      this.portraitDialogOpen = false;
      if (!result) return;
      void this.savePortrait(c.id, result);
    });
  }

  private async savePortrait(characterId: string, result: PortraitCropResult): Promise<void> {
    try {
      const updated = await this.characterSvc.updatePortrait(
        characterId,
        result.file,
        result.cropData,
      );
      this.character.set(updated);
    } catch {
      this.portraitError.set(this.theme.tone()['characters_sheet.portrait_save_error']);
    }
  }

  /**
   * Recadrage dédié à l'export PDF (Story 4.7) : propriétaire seul, uniquement si un portrait
   * existe déjà (rien à recadrer sinon) — même garde que `editPortrait()`.
   */
  protected editPdfPortraitCrop(): void {
    if (this.portraitDialogOpen || !this.isOwner()) return;
    const c = this.character();
    if (!c || !c.portraitUrl) return;
    this.portraitError.set(null);
    this.portraitDialogOpen = true;
    const ref = this.dialog.open<PortraitCropper, PortraitCropperData, PortraitCropResult | null>(
      PortraitCropper,
      {
        data: {
          characterId: c.id,
          shape: 'rect',
          initialCropData: c.pdfPortraitCropData as PortraitCropResult['cropData'] | null,
        },
      },
    );
    ref.afterClosed().subscribe((result) => {
      this.portraitDialogOpen = false;
      if (!result) return;
      void this.savePdfPortraitCrop(c.id, result);
    });
  }

  private async savePdfPortraitCrop(
    characterId: string,
    result: PortraitCropResult,
  ): Promise<void> {
    try {
      const updated = await this.characterSvc.patchPdfPortraitCrop(characterId, result.cropData);
      this.character.set(updated);
    } catch {
      this.portraitError.set(this.theme.tone()['characters_sheet.pdf_crop_save_error']);
    }
  }

  protected openLevelUpWizard(): void {
    if (this.portraitDialogOpen) return;
    const c = this.character();
    if (!c) return;
    this.portraitDialogOpen = true;
    const ref = this.dialog.open<LevelUpWizard, LevelUpWizardData, CharacterDto | null>(
      LevelUpWizard,
      { data: { character: c, content: this.content() } },
    );
    ref.afterClosed().subscribe((updated) => {
      this.portraitDialogOpen = false;
      if (updated) this.character.set(updated);
    });
  }

  protected readonly fieldEditWarning = signal<string | null>(null);
  protected readonly fieldEditError = signal<string | null>(null);

  /** Édition MJ générique d'un champ (AD-6) — attributs, objet fétiche, cf. `FieldEditPencil`. */
  protected async submitFieldEdit(path: string, value: string | number): Promise<void> {
    const c = this.character();
    if (!c) return;
    this.fieldEditError.set(null);
    this.fieldEditWarning.set(null);
    try {
      const result = await this.characterSvc.setSheetField(c.id, path, value);
      this.character.set(result.character);
      if (result.warnings.length > 0) {
        this.fieldEditWarning.set(result.warnings.join(' '));
      }
    } catch {
      this.fieldEditError.set(this.theme.tone()['evolution.mj_edit_error']);
    }
  }

  /** Édition MJ directe de l'XP (AD-6, endpoint dédié distinct de `submitFieldEdit`). */
  protected async submitXpEdit(value: string | number): Promise<void> {
    const c = this.character();
    if (!c) return;
    this.fieldEditError.set(null);
    try {
      this.character.set(await this.characterSvc.setXp(c.id, Number(value)));
    } catch {
      this.fieldEditError.set(this.theme.tone()['evolution.mj_edit_error']);
    }
  }

  /** Édition propriétaire-seul d'un champ narratif (Story 6.7) — chemin dédié, pas `sheet-field`. */
  protected async submitNarrativeFieldEdit(field: string, value: string | number): Promise<void> {
    const c = this.character();
    if (!c) return;
    this.fieldEditError.set(null);
    try {
      this.character.set(await this.characterSvc.updateNarrativeField(c.id, field, value));
    } catch {
      this.fieldEditError.set(this.theme.tone()['evolution.narrative_edit_error']);
    }
  }
}
