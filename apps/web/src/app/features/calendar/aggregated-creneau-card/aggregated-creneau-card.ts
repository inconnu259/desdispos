import { Component, computed, inject, input } from '@angular/core';
import type { AggregatedSlotDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

const SLOT_LABELS: Record<string, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
};

@Component({
  selector: 'app-aggregated-creneau-card',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './aggregated-creneau-card.html',
  styleUrl: './aggregated-creneau-card.scss',
})
export class AggregatedCreneauCard {
  readonly slot = input.required<AggregatedSlotDto>();

  protected readonly theme = inject(ThemeToneService);

  protected readonly slotLabel = computed(() => SLOT_LABELS[this.slot().slot] ?? this.slot().slot);

  protected readonly priorityClass = computed(() => {
    const s = this.slot();
    if (s.unavailable === 0 && s.available === s.total) return 'all-available';
    if (s.unavailable === 0 && s.available > 0) return 'mixed';
    if (s.unavailable > 0) return 'has-refusal';
    return 'unknown';
  });

  protected formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z');
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(d);
  }
}
