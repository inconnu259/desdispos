import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { fillTone } from '../../../../core/theme/tone-format';

export interface FieldEditPencilOption {
  key: string;
  label: string;
}

let nextDatalistId = 0;

@Component({
  selector: 'app-field-edit-pencil',
  standalone: true,
  imports: [MatButtonModule, AppIcon],
  templateUrl: './field-edit-pencil.html',
  styleUrl: './field-edit-pencil.scss',
})
export class FieldEditPencil {
  /** Nom du champ pour l'aria-label ("Modifier [label]") — DESIGN.md/EXPERIENCE.md §8. */
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly type = input<'text' | 'number'>('text');
  /** Suggestions catalogue optionnelles (ex. armes seedées) — combobox, jamais un select strict (AC7 Story 6.7). */
  readonly options = input<FieldEditPencilOption[]>([]);
  readonly confirm = output<string | number>();

  protected readonly theme = inject(ThemeToneService);
  /** aria-label du crayon : « Modifier [label] » — le nom du champ reste un libellé de fiche. */
  protected readonly fieldEditAria = computed(() =>
    fillTone(this.theme.tone()['characters_sheet.field_edit_aria'], { label: this.label() }),
  );

  protected readonly datalistId = `field-edit-pencil-datalist-${nextDatalistId++}`;

  private readonly _editing = signal(false);
  /**
   * Exposé en lecture seule (revue de code, frustration utilisateur) : l'appelant masque son
   * propre affichage de la valeur pendant l'édition, pour ne plus jamais montrer le texte et le
   * champ éditable côte à côte (deux représentations de la même valeur à la fois).
   */
  readonly editing = this._editing.asReadonly();
  protected readonly draft = signal<string | number>('');

  protected startEdit(): void {
    this.draft.set(this.value());
    this._editing.set(true);
  }

  protected cancel(): void {
    this._editing.set(false);
  }

  protected onInput(raw: string): void {
    if (this.type() === 'number') {
      // `Number('')` vaut 0, pas NaN — un champ vidé doit bloquer la soumission, pas soumettre
      // silencieusement 0 (revue de code, même classe de bug déjà corrigée pour le poids d'inventaire).
      this.draft.set(raw.trim() === '' ? NaN : Number(raw));
    } else {
      this.draft.set(raw);
    }
  }

  protected submit(): void {
    const value = this.draft();
    if (typeof value === 'number' && Number.isNaN(value)) return;
    this._editing.set(false);
    this.confirm.emit(value);
  }
}
