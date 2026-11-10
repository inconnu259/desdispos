import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ContentEntryDto } from '@master-jdr/shared';
import {
  resolveWeapon,
  type WeaponCategoryEntry,
  type WeaponItemEntry,
  type WeaponItemContentData,
  type WeaponCategoryContentData,
} from '@master-jdr/game-rules';
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  detailContent,
} from '../../../../../shared/detail-surface/detail-surface-host';
import { ChoiceCard, type ChoiceCardOption } from '../../choice-card/choice-card';
import { RadioGroupNavDirective } from '../../choice-card/radio-group-nav.directive';

/** `WeaponCategoryContentData` + `description` (seedée Story 23.1, affichée sous la sélection). */
type WeaponCategoryData = WeaponCategoryContentData & { description: string };
type WeaponItemData = WeaponItemContentData;

interface CustomWeapon {
  name: string;
  categoryId: string;
}

/** Catégorie sans arme précise à choisir : sélectionner la catégorie sélectionne directement
 * l'unique weaponItem qui lui est rattaché (aucune étape 2). */
const NO_ITEM_CHOICE_CATEGORY = 'mains-nues';

/** Clé de la carte « Créer une arme libre » (Story 25.2) — jamais une clé de catalogue réelle. */
const CUSTOM_WEAPON_KEY = '__custom__';

@Component({
  selector: 'app-weapon-step',
  standalone: true,
  imports: [ChoiceCard, RadioGroupNavDirective, FormsModule, DetailSurface],
  templateUrl: './weapon-step.html',
  styleUrl: './weapon-step.scss',
})
export class WeaponStep {
  readonly weaponItems = input.required<ContentEntryDto[]>();
  readonly weaponCategories = input.required<ContentEntryDto[]>();
  readonly weaponId = input<string | undefined>();
  readonly customWeapon = input<CustomWeapon | undefined>();

  readonly weaponIdChange = output<string | null>();

  protected readonly theme = inject(ThemeToneService);

  /** Description de la catégorie d'arme : derrière la surface de détail (revue de code 31.4, AC2). */
  protected readonly detail = createDetailSurfaceHost();
  readonly customWeaponChange = output<CustomWeapon | null>();

  /** État UI de saisie de l'arme libre — le parent ne reçoit que `customWeaponChange`
   *  déjà structuré `{ name, categoryId }`, jamais cet état intermédiaire. */
  protected readonly showCustomInput = signal(false);
  protected readonly customWeaponName = signal('');

  /** Catégorie choisie à l'étape 1 — `null` tant qu'aucune des catégories n'est sélectionnée. */
  protected readonly selectedCategoryKey = signal<string | null>(null);

  private readonly weaponItemEntries = computed<WeaponItemEntry[]>(() =>
    this.weaponItems().map((entry) => ({ key: entry.key, ...(entry.data as WeaponItemData) })),
  );

  private readonly weaponCategoryEntries = computed<WeaponCategoryEntry[]>(() =>
    this.weaponCategories().map((entry) => ({
      key: entry.key,
      ...(entry.data as WeaponCategoryData),
    })),
  );

  protected readonly categoryOptions = computed<ChoiceCardOption[]>(() =>
    this.weaponCategories().map((entry) => {
      const data = entry.data as WeaponCategoryData;
      return {
        key: entry.key,
        label: data.label,
        detail: `Toucher ${data.touchFormula} · Dégâts ${data.damageFormula}`,
      };
    }),
  );

  /** Armes précises de la catégorie sélectionnée + carte « Créer une arme libre » en dernière
   * position (Story 25.2) — vide si aucune catégorie choisie ou si la catégorie n'a pas d'arme
   * précise à choisir (Mains nues, jamais d'arme libre non plus pour cette catégorie). */
  protected readonly itemOptions = computed<ChoiceCardOption[]>(() => {
    const categoryKey = this.selectedCategoryKey();
    if (!categoryKey || categoryKey === NO_ITEM_CHOICE_CATEGORY) return [];
    const catalogItems = this.weaponItems()
      .filter((entry) => (entry.data as WeaponItemData).categoryId === categoryKey)
      .map((entry) => ({ key: entry.key, label: (entry.data as WeaponItemData).label }));
    return [
      ...catalogItems,
      { key: CUSTOM_WEAPON_KEY, label: this.theme.tone()['characters_wizard.weapon_custom_card'] },
    ];
  });

  protected readonly selectedCategoryData = computed<WeaponCategoryData | null>(() => {
    const entry = this.weaponCategories().find((c) => c.key === this.selectedCategoryKey());
    return entry ? (entry.data as WeaponCategoryData) : null;
  });

  /** Aide de la catégorie sélectionnée, ou `null` sans texte au catalogue (pas de texte ⇒ pas d'aide). */
  protected readonly categoryHelp = computed(() => {
    const data = this.selectedCategoryData();
    return detailContent(data?.label, data?.description);
  });

  protected readonly resolvedWeapon = computed(() =>
    resolveWeapon(
      { weaponId: this.weaponId(), customWeapon: this.customWeapon() },
      { weaponItems: this.weaponItemEntries(), weaponCategories: this.weaponCategoryEntries() },
    ),
  );

  private hasSyncedFromInput = false;

  constructor() {
    // Resynchronise la catégorie sélectionnée depuis `weaponId()`/`customWeapon()` (retour en
    // arrière sur l'étape, composant recréé) : retrouve la catégorie de l'arme déjà choisie pour
    // réafficher la bonne étape 2. Ne s'exécute qu'une fois par instance, comme AttributesStep
    // (Story 24.1).
    effect(() => {
      const id = this.weaponId();
      const custom = this.customWeapon();
      const items = this.weaponItemEntries();
      untracked(() => {
        if (this.hasSyncedFromInput) return;
        if (items.length === 0) return;
        this.hasSyncedFromInput = true;
        if (id) {
          const item = items.find((w) => w.key === id);
          if (item) this.selectedCategoryKey.set(item.categoryId);
          return;
        }
        if (custom) {
          this.selectedCategoryKey.set(custom.categoryId);
          this.showCustomInput.set(true);
          this.customWeaponName.set(custom.name);
        }
      });
    });
  }

  /** Choisir une catégorie différente invalide l'arme précédemment choisie (elle appartenait à
   * une autre catégorie). Recliquer sur la catégorie déjà sélectionnée est un no-op. Mains nues
   * n'a pas d'arme précise à choisir : la sélectionner assigne directement son unique weaponItem. */
  protected selectCategory(categoryKey: string): void {
    if (this.selectedCategoryKey() === categoryKey) return;
    this.selectedCategoryKey.set(categoryKey);
    this.showCustomInput.set(false);
    this.customWeaponName.set('');
    this.customWeaponChange.emit(null);
    if (categoryKey === NO_ITEM_CHOICE_CATEGORY) {
      const item = this.weaponItems().find(
        (entry) => (entry.data as WeaponItemData).categoryId === categoryKey,
      );
      this.weaponIdChange.emit(item?.key ?? null);
      return;
    }
    this.weaponIdChange.emit(null);
  }

  /** `selected` d'une carte de la grille étape 2 — la carte custom l'est via `showCustomInput()`
   *  (pas `weaponId()`, qui reste `undefined` tant que l'arme libre n'a pas de nom valide). */
  protected isItemSelected(itemKey: string): boolean {
    if (itemKey === CUSTOM_WEAPON_KEY) return this.showCustomInput();
    return !this.showCustomInput() && this.weaponId() === itemKey;
  }

  protected selectItem(itemKey: string): void {
    if (itemKey === CUSTOM_WEAPON_KEY) {
      this.showCustomInput.set(true);
      this.weaponIdChange.emit(null);
      return;
    }
    this.showCustomInput.set(false);
    this.customWeaponName.set('');
    this.customWeaponChange.emit(null);
    this.weaponIdChange.emit(itemKey);
  }

  protected onCustomNameInput(name: string): void {
    this.customWeaponName.set(name);
    const categoryId = this.selectedCategoryKey();
    const trimmed = name.trim();
    this.customWeaponChange.emit(trimmed && categoryId ? { name: trimmed, categoryId } : null);
  }
}
