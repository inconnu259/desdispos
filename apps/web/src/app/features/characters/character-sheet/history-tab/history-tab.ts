import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CharacterSnapshotDto, GameSystemContentDto } from '@master-jdr/shared';
import { CharacterService } from '../../../../core/characters/character.service';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { fillTone } from '../../../../core/theme/tone-format';
import { snapshotCapabilityChoice } from '../capability-label.util';

@Component({
  selector: 'app-history-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './history-tab.html',
  styleUrl: './history-tab.scss',
})
export class HistoryTab {
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);

  readonly characterId = input.required<string>();
  /** Résout la description des capacités choisies (cf. `capabilityChoice`) — `null` accepté, dégrade gracieusement. */
  readonly content = input<GameSystemContentDto | null>(null);

  protected readonly snapshots = signal<CharacterSnapshotDto[]>([]);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.characterId();
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.loadError.set(null);
    try {
      this.snapshots.set(await this.characterSvc.getHistory(id));
    } catch {
      this.loadError.set(this.theme.tone()['characters_sheet.history_load_error']);
    }
  }

  protected triggerLabel(snapshot: CharacterSnapshotDto): string {
    return snapshot.trigger === 'LEVEL_UP'
      ? fillTone(this.theme.tone()['characters_sheet.history_level'], { level: snapshot.level })
      : this.theme.tone()['evolution.mj_edit_trace'];
  }

  /** Choix de capacité(s) fait(s) à cette montée de niveau (`null` pour un instantané `MJ_EDIT`). */
  protected capabilityChoice(snapshot: CharacterSnapshotDto): string | null {
    return snapshotCapabilityChoice(snapshot, this.content());
  }
}
