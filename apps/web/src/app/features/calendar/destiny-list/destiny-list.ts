import { Component, computed, inject, input, output } from '@angular/core';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { shortDayLabel } from '../../events/event-card.util';

/** L'état de la personne sur un vote, tel que la pastille le dit (EXPERIENCE §3.2). */
export type DestinyState = 'todo' | 'answered' | 'organizer' | 'not-voting';

/** Un vote ouvert, tel que la liste des destinées le montre. Aucune identité de votant : des noms et des
 *  compteurs. */
export interface DestinyListItem {
  pollId: string;
  /** Le nom de la partie ou du groupe : l'en-tête du groupe de lignes. */
  partieName: string;
  /** Le nom du vote. */
  title: string;
  /** Échéance du vote (ISO), `null` si non définie. */
  expiresAt: string | null;
  /** Le vote est terminé (échéance passée) : il reste ouvert tant qu'une date n'est pas fixée. */
  ended: boolean;
  optionCount: number;
  state: DestinyState;
}

interface DestinyGroup {
  name: string;
  rows: DestinyRow[];
}

interface DestinyRow {
  pollId: string;
  title: string;
  meta: string;
  state: DestinyState;
  stateLabel: string;
}

/**
 * Story 44.3 — la liste des destinées, ouverte par la puce ✦.
 *
 * Composant de **rendu pur** (même patron que `CalendarDisplayPanel`) : il ignore s'il vit dans un menu
 * ancré ou dans un tiroir du bas, et ne détient aucun état. `CalendarView` décide de ce que « choisir » et
 * « quitter » font.
 *
 * Les lignes sont groupées par NOM de partie ; la destinée active s'affiche en tête, avec sa sortie, et
 * n'est pas répétée dans les groupes. Aucun mot du JDR ici : le mode soirée affiche la même liste.
 */
@Component({
  selector: 'app-destiny-list',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './destiny-list.html',
  styleUrl: './destiny-list.scss',
})
export class DestinyList {
  readonly items = input<readonly DestinyListItem[]>([]);
  /** La destinée active, ou `null` hors du mode. */
  readonly activePollId = input<string | null>(null);

  readonly chosen = output<string>();
  readonly quit = output<void>();

  protected readonly theme = inject(ThemeToneService);

  protected readonly active = computed(() => {
    const id = this.activePollId();
    const item = id === null ? undefined : this.items().find((i) => i.pollId === id);
    return item ? this.toRow(item) : null;
  });

  protected readonly groups = computed<DestinyGroup[]>(() => {
    const groups = new Map<string, DestinyRow[]>();
    for (const item of this.items()) {
      if (item.pollId === this.activePollId()) continue;
      const rows = groups.get(item.partieName) ?? [];
      rows.push(this.toRow(item));
      groups.set(item.partieName, rows);
    }
    return [...groups].map(([name, rows]) => ({ name, rows }));
  });

  private toRow(item: DestinyListItem): DestinyRow {
    const tone = this.theme.tone();
    const suffix = item.optionCount === 1 ? 'one' : 'many';
    const meta = item.ended
      ? fillTone(tone[`calendar.destiny_row_ended_${suffix}`], { n: item.optionCount })
      : fillTone(tone[`calendar.destiny_row_open_${suffix}`], {
          date: item.expiresAt ? shortDayLabel(item.expiresAt.substring(0, 10)) : '—',
          n: item.optionCount,
        });
    return {
      pollId: item.pollId,
      title: item.title,
      meta,
      state: item.state,
      stateLabel: tone[`calendar.destiny_state_${item.state.replace('-', '_')}`],
    };
  }
}
