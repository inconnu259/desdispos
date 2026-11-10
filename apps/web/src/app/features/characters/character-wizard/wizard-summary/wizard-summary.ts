import { Component, computed, inject, input, output } from '@angular/core';
import type { DerivedStats, RyuutamaSheetData } from '@master-jdr/game-rules';
import type { ContentEntryDto, GameSystemContentDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';

export interface SummaryRow {
  label: string;
  value: string;
}

export interface CartLine {
  key: string;
  label: string;
  quantity: number;
  priceGold: number;
}

type Selection = { key: string; quantity: number }[];

/**
 * Récapitulatif du voyageur (Story 31.4, contrat UI `ux-jdr-master-2026-08-31`). Un composant, deux
 * hôtes : la colonne de droite sur ordinateur, et la feuille « Récap » sur téléphone (où l'ancien
 * bloc du bas, à moitié caché par les barres fixes, était inutilisable).
 *
 * Deux blocs SÉPARÉS : « Voyageur » (identité, statistiques, lignes qui apparaissent au fil des
 * étapes) puis « Panier » (l'équipement choisi, retirable). Purement présentationnel : aucune
 * donnée n'est modifiée ici, seule la sélection d'équipement est réémise vers le parent.
 */
@Component({
  selector: 'app-wizard-summary',
  standalone: true,
  templateUrl: './wizard-summary.html',
  styleUrl: './wizard-summary.scss',
})
export class WizardSummary {
  readonly sheetData = input.required<Partial<RyuutamaSheetData>>();
  readonly derived = input<DerivedStats | null>(null);
  readonly content = input<GameSystemContentDto | null>(null);

  /** Sélection d'équipement de départ après suppression d'une ligne. */
  readonly equipmentChange = output<Selection>();

  protected readonly theme = inject(ThemeToneService);

  protected readonly ATTRS = ['AGI', 'ESP', 'INT', 'VIG'] as const;

  private entries(type: string): ContentEntryDto[] {
    return this.content()?.[type] ?? [];
  }

  private labelOf(type: string, key: string | undefined): string | undefined {
    if (!key) return undefined;
    const entry = this.entries(type).find((e) => e.key === key);
    return (entry?.data as { label?: string; name?: string } | undefined)?.label ?? undefined;
  }

  /** Titre du bloc : le nom saisi à l'étape Narratif, « Voyageur » tant qu'il est vide. */
  protected readonly title = computed(
    () =>
      this.sheetData().narrative?.name?.trim() ||
      this.theme.tone()['characters_wizard.summary_default_title'],
  );

  /** Lignes du récapitulatif, dans l'ordre du parcours. Une ligne sans valeur n'est pas rendue. */
  protected readonly rows = computed<SummaryRow[]>(() => {
    const d = this.sheetData();
    const rows: SummaryRow[] = [];
    const add = (label: string, value: string | undefined): void => {
      const v = value?.trim();
      if (v) rows.push({ label, value: v });
    };
    add('Classe', this.labelOf('class', d.classId));
    add('Spécialité', d.specialtyTypeId);
    add('Type', this.labelOf('type', d.typeId));
    add('Saison', this.labelOf('season', d.magicSeason));
    const spells = (d.knownRitualSpells ?? [])
      .map((k) => {
        const entry = this.entries('spell').find((e) => e.key === k);
        return (entry?.data as { name?: string } | undefined)?.name ?? '';
      })
      .filter(Boolean);
    add('Sorts', spells.join(', '));
    const weapon = d.customWeapon?.name ?? this.labelOf('weaponItem', d.weaponId);
    add('Arme', weapon);
    add('Fétiche', d.fetiqueObject);
    const n = d.narrative;
    add('Sexe', n?.sex);
    add('Âge', n?.age !== undefined ? String(n.age) : undefined);
    add('Particularités', n?.physicalTraits);
    add('Village', n?.homeTown);
    add('Motivation', n?.motivation);
    add('Personnalité', n?.personality);
    return rows;
  });

  protected readonly attributes = computed(() => this.sheetData().attributes ?? null);

  /** Lignes du panier, résolues depuis le catalogue (clé absente ⇒ ignorée, jamais une erreur). */
  protected readonly cart = computed<CartLine[]>(() => {
    const items = this.entries('equipmentItem');
    return (this.sheetData().startingEquipment ?? []).flatMap((s) => {
      const entry = items.find((e) => e.key === s.key);
      if (!entry) return [];
      const data = entry.data as { label?: string; priceGold?: number };
      return [
        {
          key: s.key,
          label: data.label ?? s.key,
          quantity: s.quantity,
          priceGold: data.priceGold ?? 0,
        },
      ];
    });
  });

  protected readonly cartCount = computed(() => this.cart().reduce((n, l) => n + l.quantity, 0));
  protected readonly cartTotal = computed(() =>
    this.cart().reduce((sum, l) => sum + l.priceGold * l.quantity, 0),
  );

  /** Retirer un article supprime la LIGNE entière (les quantités se règlent dans le catalogue). */
  protected remove(key: string): void {
    this.equipmentChange.emit(
      (this.sheetData().startingEquipment ?? []).filter((s) => s.key !== key),
    );
  }
}
