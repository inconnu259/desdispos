import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';

export interface InventoryItemView {
  id: string;
  name: string;
  /** Absent pour un animal (jamais de poids, FR8) — absence structurelle, jamais une valeur fictive. */
  weight?: number;
  price?: string;
  effect?: string;
  addedBy: string;
}

@Component({
  selector: 'app-inventory-item-row',
  standalone: true,
  imports: [MatButtonModule, AppIcon],
  templateUrl: './inventory-item-row.html',
  styleUrl: './inventory-item-row.scss',
})
export class InventoryItemRow {
  protected readonly theme = inject(ThemeToneService);

  readonly item = input.required<InventoryItemView>();
  readonly editable = input(false);
  /** Propriétaire seul (DESIGN.md : le MJ "ajoute"/"édite" une ligne, jamais "supprime"). */
  readonly removable = input(false);

  readonly edit = output<void>();
  readonly remove = output<void>();
}
