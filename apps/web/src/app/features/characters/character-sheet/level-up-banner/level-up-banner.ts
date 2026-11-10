import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { CharacterDto } from '@desdispos/shared';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { pendingLevelsLocal } from '../level-thresholds';

@Component({
  selector: 'app-level-up-banner',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './level-up-banner.html',
  styleUrl: './level-up-banner.scss',
})
export class LevelUpBanner {
  protected readonly theme = inject(ThemeToneService);

  readonly character = input.required<CharacterDto>();
  readonly levelUp = output<void>();

  private readonly appliedCount = computed(
    () => ((this.character().sheetData as any)?.levelUps?.length as number | undefined) ?? 0,
  );

  protected readonly pendingLevels = computed(() =>
    pendingLevelsLocal(this.character().xp, this.appliedCount()),
  );

  protected readonly nextLevel = computed(() => this.pendingLevels()[0] ?? null);

  protected readonly bannerText = computed(() => {
    const level = this.nextLevel();
    if (level === null) return '';
    return this.theme.tone()['evolution.levelup_banner'].replace('[N]', String(level));
  });

  protected onClick(): void {
    this.levelUp.emit();
  }
}
