import { Component, computed, inject, input, output } from '@angular/core';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import type { RendezvousRow } from './rendezvous.utils';

interface RendezvousGroup {
  name: string;
  rows: RendezvousRow[];
}

/**
 * Story 45.1 — le choix du rendez-vous, ouvert par « Proposer des dates ».
 *
 * Composant de **rendu pur** (même patron que `DestinyList`) : il ignore s'il vit dans un menu ancré ou dans un
 * tiroir du bas, et ne détient aucun état. `CalendarView` décide de ce que « choisir » fait, et saute cette étape
 * quand il n'y a qu'un rendez-vous. Les lignes sont groupées par NOM de partie (en-tête) ; une ligne = un choix.
 */
@Component({
  selector: 'app-rendezvous-picker',
  standalone: true,
  templateUrl: './rendezvous-picker.html',
  styleUrl: './rendezvous-picker.scss',
})
export class RendezvousPicker {
  readonly rows = input<readonly RendezvousRow[]>([]);

  readonly chosen = output<RendezvousRow>();

  protected readonly theme = inject(ThemeToneService);

  protected readonly groups = computed<RendezvousGroup[]>(() => {
    const groups = new Map<string, RendezvousRow[]>();
    for (const row of this.rows()) {
      const list = groups.get(row.partieName) ?? [];
      list.push(row);
      groups.set(row.partieName, list);
    }
    return [...groups].map(([name, rows]) => ({ name, rows }));
  });

  /** La nature d'un rendez-vous, écrite en toutes lettres (« séance sans date », « soirée sans date »). */
  protected natureLabel(row: RendezvousRow): string {
    return this.theme.tone()[`calendar.rendezvous_nature_${row.nature}`];
  }
}
