import { Component, computed, inject, input, output } from '@angular/core';
import type { AggregatedSlotDto, AvailableSlotDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AggregatedCreneauCard } from '../aggregated-creneau-card/aggregated-creneau-card';
import { CreneauCard } from '../creneau-card/creneau-card';

type AnySlotDto = AvailableSlotDto | AggregatedSlotDto;

/**
 * Discrimine la vue MJ (nominative) de la vue joueur (agrégée).
 *
 * 🚨 **`'members' in s` ne discrimine plus depuis la story 36.8** : `AggregatedSlotDto` porte
 * désormais un `members?` optionnel (le détail nominatif de la couche « disponibilité du groupe »,
 * servi au seul MJ par `GET /parties/:id/heatmap`). Le test de présence rendait donc `s.members`
 * possiblement `undefined` — attrapé par le compilateur, pas par un test.
 *
 * On discrimine désormais par ce que la vue MJ n'a **pas** : les agrégats. `AvailableSlotDto` ne
 * porte ni `total`, ni `available`, ni `unavailable` — c'est précisément sa définition, et ce
 * discriminant-là ne peut pas devenir ambigu par ajout d'un champ facultatif.
 */
export function isNamedSlot(s: AnySlotDto): s is AvailableSlotDto {
  return !('total' in s);
}

function slotPriority(s: AnySlotDto): number {
  if (isNamedSlot(s)) {
    const hasUnavail = s.members.some((m) => m.status === 'UNAVAILABLE');
    const availCount = s.members.filter((m) => m.status === 'AVAILABLE').length;
    if (hasUnavail) return 3;
    if (availCount === s.members.length) return 0;
    if (availCount > 0) return 1;
    return 2;
  }
  if (s.unavailable > 0) return 3;
  if (s.available === s.total) return 0;
  if (s.available > 0) return 1;
  return 2;
}

function availableCount(s: AnySlotDto): number {
  return isNamedSlot(s) ? s.members.filter((m) => m.status === 'AVAILABLE').length : s.available;
}

@Component({
  selector: 'app-available-slots',
  standalone: true,
  imports: [CreneauCard, AggregatedCreneauCard],
  templateUrl: './available-slots.html',
  styleUrl: './available-slots.scss',
})
export class AvailableSlotsPanel {
  readonly slots = input.required<AnySlotDto[]>();
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  /** Story 46.1 — sous 768 px le titre devient un bouton qui replie la liste (la colonne n'a pas de dock). */
  readonly foldable = input<boolean>(false);
  /** Story 46.1 — la liste est repliée (état partagé, tenu par `ColumnDockService`). Sans effet si non repliable. */
  readonly folded = input<boolean>(false);
  readonly foldToggled = output<void>();

  protected readonly theme = inject(ThemeToneService);

  /** Le titre, avec le nombre de fenêtres une fois la liste connue : « Éphémérides · 18 ». */
  protected readonly title = computed(() => {
    const label = this.theme.tone()['section.slots'];
    return !this.loading() && !this.error() ? `${label} · ${this.slots().length}` : label;
  });

  protected readonly collapsed = computed(() => this.foldable() && this.folded());

  protected readonly sortedSlots = computed(() =>
    [...this.slots()].sort((a, b) => {
      const pa = slotPriority(a);
      const pb = slotPriority(b);
      if (pa !== pb) return pa - pb;
      if (pa === 1) {
        const diff = availableCount(b) - availableCount(a);
        if (diff !== 0) return diff;
      }
      return a.date.localeCompare(b.date);
    }),
  );

  protected isMjSlot(s: AnySlotDto): s is AvailableSlotDto {
    return isNamedSlot(s);
  }
}
