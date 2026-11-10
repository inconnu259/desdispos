import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AppIcon } from '../../../core/icons/app-icon';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

export interface ConfirmData {
  message: string;
  confirmLabel?: string;
  /** Variante rouge pour une action irréversible (Story 39.4, UX-DR11) : le bouton de
   *  confirmation prend le fond `--color-unavailable`, avec un pictogramme ET le mot — jamais la
   *  couleur seule. « Renoncer » reste inchangé. */
  destructive?: true;
  /** Avertissement affiché SOUS le message, précédé d'un pictogramme décoratif (ex. « aucun vote sur cette
   *  date »). Reste hors du message : la question demeure une phrase simple. */
  warning?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, AppIcon],
  template: `
    <h2 mat-dialog-title>{{ theme.tone()['parties.confirm_title'] }}</h2>
    <mat-dialog-content>
      {{ data.message }}
      @if (data.warning) {
        <p class="confirm-warning"><app-icon name="avertissement" /> {{ data.warning }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ theme.tone()['common.annuler'] }}</button>
      <button
        mat-flat-button
        [mat-dialog-close]="true"
        [class.confirm-destructive]="data.destructive === true"
      >
        @if (data.destructive) {
          <app-icon name="avertissement" />
        }
        {{ data.confirmLabel ?? theme.tone()['common.supprimer'] }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .confirm-warning {
      --app-icon-size: 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0.75rem 0 0;
    }
    .confirm-destructive {
      --mat-button-filled-container-color: var(--color-unavailable);
      --mat-button-filled-label-text-color: #fff;
      --mat-button-filled-hover-state-layer-color: #fff;
      --mat-button-filled-ripple-color: #fff;
      font-weight: 600;
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);
}
