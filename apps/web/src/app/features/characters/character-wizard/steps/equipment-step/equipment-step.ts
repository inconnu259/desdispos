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
import type { ContentEntryDto } from '@master-jdr/shared';
import { AppIcon } from '../../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  type DetailSurfaceContent,
} from '../../../../../shared/detail-surface/detail-surface-host';

interface EquipmentItemEntry {
  key: string;
  label: string;
  priceGold: number;
  nature: 'individual' | 'contenant' | 'animal';
  weight?: number;
  effect?: string;
}

interface EquipmentPackageEntry {
  key: string;
  label: string;
  priceGold: number;
  items: { itemKey: string; quantity: number }[];
}

export type StartingEquipmentSelection = { key: string; quantity: number }[];

/** Budget de départ (AC3, Story 26.1) — jamais dépassé côté serveur (`CharacterService.create()`),
 *  reflété ici uniquement pour l'affichage/le blocage de progression côté wizard. */
export const STARTING_BUDGET_GOLD = 1000;

/** Groupes du catalogue (Story 31.4, DESIGN §7.4), dans l'ordre d'affichage — par `nature`. */
const NATURE_GROUPS = ['individual', 'contenant', 'animal'] as const;

/** Recherche insensible à la casse et aux accents (« epee » trouve « Épée »). */
function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Component({
  selector: 'app-equipment-step',
  standalone: true,
  imports: [AppIcon, DetailSurface],
  templateUrl: './equipment-step.html',
  styleUrl: './equipment-step.scss',
})
export class EquipmentStep {
  readonly equipmentItems = input.required<ContentEntryDto[]>();
  readonly equipmentPackages = input.required<ContentEntryDto[]>();
  readonly selection = input<StartingEquipmentSelection>([]);

  readonly selectionChange = output<StartingEquipmentSelection>();

  protected readonly theme = inject(ThemeToneService);
  /** Texte d'effet d'un objet : même surface partagée que la fiche et le reste du wizard. */
  protected readonly detail = createDetailSurfaceHost();

  protected readonly mode = signal<'kit' | 'shopping'>('kit');
  /** Texte saisi dans la recherche (Story 31.4, D2) — vidé à chaque changement de mode. */
  protected readonly search = signal('');
  /** Filtre du catalogue : tout, ou seulement les objets déjà pris (« Ma sélection », téléphone surtout). */
  protected readonly view = signal<'all' | 'mine'>('all');
  /** Groupes REPLIÉS par l'utilisateur (déployés par défaut). */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly budgetGold = STARTING_BUDGET_GOLD;

  protected readonly itemEntries = computed<EquipmentItemEntry[]>(() =>
    this.equipmentItems().map((entry) => ({
      key: entry.key,
      ...(entry.data as Omit<EquipmentItemEntry, 'key'>),
    })),
  );

  protected readonly packageEntries = computed<EquipmentPackageEntry[]>(() =>
    this.equipmentPackages().map((entry) => ({
      key: entry.key,
      ...(entry.data as Omit<EquipmentPackageEntry, 'key'>),
    })),
  );

  /** Catalogue « Achat libre » regroupé par nature, filtré par la recherche. Les groupes vides
   *  disparaissent (Story 31.4, AC12). */
  protected readonly groups = computed(() => {
    const tone = this.theme.tone();
    const query = normalizeForSearch(this.search().trim());
    const mineOnly = this.view() === 'mine';
    const items = this.itemEntries().filter(
      (item) =>
        (!query || normalizeForSearch(item.label).includes(query)) &&
        (!mineOnly || this.qtyOf(item.key) > 0),
    );
    return NATURE_GROUPS.map((nature) => ({
      nature,
      title: tone[`character.equipment_group_${nature}`],
      // Une nature inattendue (contenu futur mal typé) rejoint « Objets » plutôt que de disparaître.
      items: items.filter((item) =>
        nature === 'individual'
          ? !NATURE_GROUPS.some((n) => n !== 'individual' && n === item.nature)
          : item.nature === nature,
      ),
    })).filter((group) => group.items.length > 0);
  });

  /** Exemplaires déjà pris, tous objets confondus — pastille du filtre « Ma sélection ». */
  protected readonly mineCount = computed(() =>
    this.selection().reduce((n, s) => n + s.quantity, 0),
  );

  protected qtyOf(key: string): number {
    return this.selection().find((s) => s.key === key)?.quantity ?? 0;
  }

  /** Un groupe est ouvert sauf s'il a été replié — et TOUJOURS pendant une recherche ou en vue
   *  « Ma sélection » : un résultat ne doit jamais se cacher dans un groupe replié. */
  protected isGroupOpen(nature: string): boolean {
    if (this.search().trim() || this.view() === 'mine') return true;
    return !this.collapsed().has(nature);
  }

  protected toggleGroup(nature: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(nature)) next.delete(nature);
      else next.add(nature);
      return next;
    });
  }

  protected setView(view: 'all' | 'mine'): void {
    this.view.set(view);
  }

  protected groupLabel(title: string, count: number): string {
    return this.theme
      .tone()
      ['character.equipment_group_toggle'].replace('{group}', () => title)
      .replace('{n}', () => String(count));
  }

  protected qtyLabel(kind: 'less' | 'more', name: string): string {
    return this.theme.tone()[`character.equipment_qty_${kind}`].replace('{name}', () => name);
  }

  protected readonly hasNoResult = computed(
    () => this.search().trim().length > 0 && this.groups().length === 0,
  );

  /** Remplissage de la jauge de budget, plafonné à 100 %. */
  protected readonly budgetPercent = computed(() =>
    Math.min(100, Math.round((this.totalSpent() / STARTING_BUDGET_GOLD) * 100)),
  );

  protected readonly budgetText = computed(() =>
    this.theme
      .tone()
      ['character.equipment_budget'].replace('{spent}', String(this.totalSpent()))
      .replace('{total}', String(STARTING_BUDGET_GOLD)),
  );

  protected readonly overBudgetText = computed(() =>
    this.theme
      .tone()
      ['character.equipment_over_budget'].replace(
        '{n}',
        String(this.totalSpent() - STARTING_BUDGET_GOLD),
      ),
  );

  /** Aide d'un objet : son texte `effect`, ou `null` sans texte — l'appelant ne rend alors AUCUN
   *  déclencheur (« pas de texte ⇒ pas d'aide »). Deux modes (pré-fait et achat libre), une règle. */
  protected itemHelp(item: EquipmentItemEntry | undefined): DetailSurfaceContent | null {
    const title = item?.label?.trim();
    const effect = item?.effect?.trim();
    if (!title || !effect) return null;
    return {
      title,
      body: '',
      rows: [{ label: this.theme.tone()['detail.row_effect'], value: effect }],
    };
  }

  protected helpByKey(key: string): DetailSurfaceContent | null {
    return this.itemHelp(this.itemEntries().find((e) => e.key === key));
  }

  protected onSearch(value: string): void {
    this.search.set(value);
  }

  /** Fusion des 2 nécessaires (toujours proposés ensemble, aucune AC ne demande de choisir entre
   *  les 2) en une seule sélection `{key,quantity}[]` — quantités agrégées si une clé apparaît
   *  dans les deux (aucun cas réel aujourd'hui, mais garde le code correct). */
  private kitSelection(): StartingEquipmentSelection {
    const merged = new Map<string, number>();
    for (const pkg of this.packageEntries()) {
      for (const item of pkg.items) {
        merged.set(item.itemKey, (merged.get(item.itemKey) ?? 0) + item.quantity);
      }
    }
    return [...merged.entries()].map(([key, quantity]) => ({ key, quantity }));
  }

  /** Lignes du panier résolues (nom/prix/poids) pour l'affichage — clés absentes du catalogue
   *  silencieusement ignorées (contenu pas encore chargé), jamais une erreur d'affichage. */
  protected readonly selectedLines = computed(() =>
    this.selection()
      .map((s) => {
        const entry = this.itemEntries().find((e) => e.key === s.key);
        return entry ? { key: s.key, quantity: s.quantity, entry } : null;
      })
      .filter(
        (line): line is { key: string; quantity: number; entry: EquipmentItemEntry } =>
          line !== null,
      ),
  );

  protected readonly totalSpent = computed(() =>
    this.selectedLines().reduce((sum, line) => sum + line.entry.priceGold * line.quantity, 0),
  );

  protected readonly remaining = computed(() => STARTING_BUDGET_GOLD - this.totalSpent());

  protected readonly overBudget = computed(() => this.totalSpent() > STARTING_BUDGET_GOLD);

  private hasSyncedFromInput = false;

  constructor() {
    // Resynchronise le mode affiché depuis `selection()` (retour en arrière sur l'étape) — même
    // pattern que WeaponStep (Story 25.1/25.2) : ne s'exécute qu'une fois par instance.
    effect(() => {
      const selection = this.selection();
      const packages = this.packageEntries();
      untracked(() => {
        if (this.hasSyncedFromInput) return;
        if (packages.length === 0) return;
        this.hasSyncedFromInput = true;
        if (selection.length === 0) return;
        const kit = this.kitSelection();
        const isKit =
          selection.length === kit.length &&
          selection.every((s) => kit.some((k) => k.key === s.key && k.quantity === s.quantity));
        this.mode.set(isKit ? 'kit' : 'shopping');
      });
    });
  }

  protected selectMode(mode: 'kit' | 'shopping'): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.search.set('');
    this.view.set('all');
    this.selectionChange.emit(mode === 'kit' ? this.kitSelection() : []);
  }

  protected addItem(key: string): void {
    const current = this.selection();
    const existing = current.find((s) => s.key === key);
    const next = existing
      ? current.map((s) => (s.key === key ? { ...s, quantity: s.quantity + 1 } : s))
      : [...current, { key, quantity: 1 }];
    this.selectionChange.emit(next);
  }

  /** Résolution nom affiché pour une ligne de nécessaire pré-fait (mode `'kit'`, lecture seule). */
  protected labelFor(key: string): string {
    return this.itemEntries().find((e) => e.key === key)?.label ?? key;
  }

  protected removeItem(key: string): void {
    const next = this.selection()
      .map((s) => (s.key === key ? { ...s, quantity: s.quantity - 1 } : s))
      .filter((s) => s.quantity > 0);
    this.selectionChange.emit(next);
  }
}
