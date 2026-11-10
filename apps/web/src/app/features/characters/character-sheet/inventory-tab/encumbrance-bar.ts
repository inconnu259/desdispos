import { Component, computed, inject, input } from '@angular/core';
import { AppIcon } from '../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';

@Component({
  selector: 'app-encumbrance-bar',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './encumbrance-bar.html',
  styleUrl: './encumbrance-bar.scss',
})
export class EncumbranceBar {
  protected readonly theme = inject(ThemeToneService);

  readonly totalWeight = input.required<number>();
  readonly limit = input.required<number>();

  protected readonly overLimit = computed(() => this.totalWeight() > this.limit());
}
