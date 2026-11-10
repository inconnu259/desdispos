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
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { fillTone } from '../../../../../core/theme/tone-format';
import { ChoiceCard, type ChoiceCardOption } from '../../choice-card/choice-card';
import { RadioGroupNavDirective } from '../../choice-card/radio-group-nav.directive';

type AttrKey = 'AGI' | 'ESP' | 'INT' | 'VIG';

interface AttributePatternData {
  label: string;
  values: number[];
}

const ATTR_KEYS: AttrKey[] = ['AGI', 'ESP', 'INT', 'VIG'];
const ATTR_LABELS: Record<AttrKey, string> = {
  AGI: 'Agilité',
  ESP: 'Esprit',
  INT: 'Intelligence',
  VIG: 'Vigueur',
};

@Component({
  selector: 'app-attributes-step',
  standalone: true,
  imports: [ChoiceCard, RadioGroupNavDirective],
  templateUrl: './attributes-step.html',
  styleUrl: './attributes-step.scss',
})
export class AttributesStep {
  readonly patterns = input.required<ContentEntryDto[]>();
  readonly attributes = input<Partial<Record<AttrKey, number>> | undefined>();

  readonly attributesChange = output<Record<AttrKey, number> | null>();

  protected readonly theme = inject(ThemeToneService);

  protected readonly ATTR_KEYS = ATTR_KEYS;
  protected readonly ATTR_LABELS = ATTR_LABELS;

  /** Profil d'attributs choisi (Story 24.1) — `null` tant qu'aucun des 3 profils n'est sélectionné. */
  protected readonly selectedPatternKey = signal<string | null>(null);

  protected readonly patternOptions = computed<ChoiceCardOption[]>(() =>
    this.patterns().map((entry) => {
      const data = entry.data as AttributePatternData;
      return {
        key: entry.key,
        label: data.label,
        detail: [...data.values].sort((a, b) => b - a).join(' · '),
      };
    }),
  );

  protected readonly selectedPatternData = computed<AttributePatternData | null>(() => {
    const entry = this.patterns().find((p) => p.key === this.selectedPatternKey());
    return entry ? (entry.data as AttributePatternData) : null;
  });

  protected readonly values = computed(() => this.selectedPatternData()?.values ?? []);

  /** Assignation courante : attribut -> index (dans `values()`) du chip qui lui est affecté. */
  protected readonly assignment = signal<Partial<Record<AttrKey, number>>>({});

  /** Garantit que la resynchronisation depuis `attributes()` ne se fait qu'une seule fois par
   * instance — sinon nos propres émissions (ex. désélection d'un chip → `null` renvoyé au parent
   * → réinjecté ici en entrée) déclencheraient une réinitialisation destructrice de tout l'état
   * local, écrasant les autres attributs déjà assignés. */
  private hasSyncedFromInput = false;

  constructor() {
    // Resynchronise le profil ET l'assignation locale sur `attributes()` (Story 24.1) : au retour
    // en arrière sur cette étape (composant recréé par le `@switch` du conteneur), retrouve quel
    // profil parmi `patterns()` correspond aux valeurs déjà assignées (comparaison de valeurs
    // triées, même logique que `character-sheet.ts::attributePatternLabel`) ET reconstruit les
    // index de chips sélectionnés — dans le même passage, pour éviter deux renders distincts.
    // Ne s'exécute qu'une fois par instance (cf. `hasSyncedFromInput`) : au-delà, l'état local est
    // la seule source de vérité tant que ce composant vit.
    effect(() => {
      const incoming = this.attributes();
      const patterns = this.patterns();
      untracked(() => {
        if (this.hasSyncedFromInput) return;
        this.hasSyncedFromInput = true;
        if (!incoming) {
          this.assignment.set({});
          return;
        }
        const incomingValues = ATTR_KEYS.map((k) => incoming[k]).filter(
          (v): v is number => v !== undefined,
        );
        if (incomingValues.length !== ATTR_KEYS.length) {
          this.assignment.set({});
          return;
        }
        const sortedIncoming = [...incomingValues].sort((a, b) => a - b);
        const matchedEntry = patterns.find((p) => {
          const sortedPattern = [...(p.data as AttributePatternData).values].sort((a, b) => a - b);
          return (
            sortedPattern.length === sortedIncoming.length &&
            sortedPattern.every((v, i) => v === sortedIncoming[i])
          );
        });
        if (!matchedEntry) {
          this.assignment.set({});
          return;
        }
        this.selectedPatternKey.set(matchedEntry.key);
        const values = (matchedEntry.data as AttributePatternData).values;
        const usedIndices = new Set<number>();
        const reconstructed: Partial<Record<AttrKey, number>> = {};
        for (const attr of ATTR_KEYS) {
          const attrValue = incoming[attr];
          if (attrValue === undefined) continue;
          const idx = values.findIndex((v, i) => v === attrValue && !usedIndices.has(i));
          if (idx >= 0) {
            reconstructed[attr] = idx;
            usedIndices.add(idx);
          }
        }
        this.assignment.set(reconstructed);
      });
    });
  }

  /** Choisir un profil différent invalide l'assignation courante (Story 24.1, AC4) — les valeurs
   * des 2 profils ne se correspondent pas terme à terme, une assignation partielle du profil
   * précédent n'a aucun sens pour le nouveau. Recliquer sur le profil déjà sélectionné est un no-op. */
  protected selectPattern(key: string): void {
    if (this.selectedPatternKey() === key) return;
    this.selectedPatternKey.set(key);
    this.assignment.set({});
    this.attributesChange.emit(null);
  }

  /** Valeurs DISTINCTES du profil, par ordre décroissant (Story 31.4, DESIGN §7.3) : une seule puce
   *  par valeur — plus de deux « 6 » visuellement identiques mais distincts. */
  protected readonly distinctValues = computed(() =>
    [...new Set(this.values())].sort((a, b) => b - a),
  );

  /** Nombre d'attributs déjà assignés — pour le résumé « n valeurs sur 4 placées ». */
  protected readonly placedCount = computed(
    () => Object.values(this.assignment()).filter((i) => i !== undefined).length,
  );

  /** Fin de la bannière « Profil X — n valeurs sur 4 placées » (singulier ou pluriel selon n). */
  protected bannerTail(): string {
    const n = this.placedCount();
    const key =
      n > 1
        ? 'characters_wizard.attributes_banner_many'
        : 'characters_wizard.attributes_banner_one';
    return fillTone(this.theme.tone()[key], { n, total: ATTR_KEYS.length });
  }

  private valueOf(attr: AttrKey): number | undefined {
    const idx = this.assignment()[attr];
    return idx === undefined ? undefined : this.values()[idx];
  }

  /** Exemplaires de `value` encore à placer : occurrences dans le profil − indices déjà assignés. */
  protected remaining(value: number): number {
    const total = this.values().filter((v) => v === value).length;
    const used = Object.values(this.assignment()).filter(
      (i) => i !== undefined && this.values()[i] === value,
    ).length;
    return total - used;
  }

  /** Le badge « ×N » n'existe que pour une valeur présente plusieurs fois dans le profil, et
   *  disparaît quand elle est épuisée. */
  protected showCount(value: number): boolean {
    return this.values().filter((v) => v === value).length > 1 && this.remaining(value) > 0;
  }

  protected isChipSelected(attr: AttrKey, value: number): boolean {
    return this.valueOf(attr) === value;
  }

  /** Épuisée = plus aucun exemplaire à placer ET pas sélectionnée dans CETTE rangée (on peut
   *  toujours reprendre sa propre valeur pour la retirer). */
  protected isChipExhausted(attr: AttrKey, value: number): boolean {
    return !this.isChipSelected(attr, value) && this.remaining(value) === 0;
  }

  /** Nom accessible : la valeur, plus le compteur quand il existe (« 6, encore 2 à placer »). */
  protected chipLabel(value: number): string {
    return this.showCount(value)
      ? fillTone(this.theme.tone()['characters_wizard.attributes_chip_remaining'], {
          value,
          n: this.remaining(value),
        })
      : `${value}`;
  }

  protected selectChip(attr: AttrKey, value: number): void {
    if (this.isChipExhausted(attr, value)) return;

    // Recliquer sur la valeur déjà sélectionnée pour cet attribut la désélectionne (bouton bascule) :
    // libère l'exemplaire pour les autres attributs et redevient incomplet (next désactivé).
    if (this.isChipSelected(attr, value)) {
      const rest = { ...this.assignment() };
      delete rest[attr];
      this.assignment.set(rest);
      this.emitIfComplete(rest);
      return;
    }

    // L'état interne reste indexé par emplacement du profil (resynchronisation inchangée) : on
    // prend le plus petit index libre portant cette valeur, l'ancien index de cette rangée étant
    // libéré par le remplacement.
    const usedByOthers = new Set(
      Object.entries(this.assignment())
        .filter(([a, idx]) => a !== attr && idx !== undefined)
        .map(([, idx]) => idx as number),
    );
    const index = this.values().findIndex((v, i) => v === value && !usedByOthers.has(i));
    if (index < 0) return;
    const next = { ...this.assignment(), [attr]: index };
    this.assignment.set(next);
    this.emitIfComplete(next);
  }

  private emitIfComplete(next: Partial<Record<AttrKey, number>>): void {
    const complete = ATTR_KEYS.every((k) => next[k] !== undefined);
    if (!complete) {
      this.attributesChange.emit(null);
      return;
    }
    const values = this.values();
    this.attributesChange.emit({
      AGI: values[next.AGI!],
      ESP: values[next.ESP!],
      INT: values[next.INT!],
      VIG: values[next.VIG!],
    });
  }
}
