import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { refusalMessage } from '../refusal-message';

export interface CancelEventData {
  /** Nom de la conjonction, écrit dans la question. */
  title: string;
  /** Annule la conjonction (`POST …/events/:id/cancel`). Une erreur reste affichée dans la fenêtre. */
  confirm: () => Promise<void>;
}

/**
 * Story 42.1 — la confirmation « Votre accord » de l'annulation d'une conjonction (UX-DR12, ⚠️ nouvelle :
 * le texte n'existait pas dans la table des confirmations). Irréversible, donc bouton de confirmation
 * ROUGE plein ; « Renoncer » ne change rien. Le texte dit que les inscrits seront prévenus par e-mail et
 * que l'action est définitive.
 *
 * « Annuler la conjonction » est gardé contre le double clic (`busy`) ; si le serveur refuse (pas l'hôte,
 * conjonction passée ou déjà annulée…), son message reste affiché ici et la fenêtre reste ouverte. Au
 * succès elle se ferme en rendant `true`.
 */
@Component({
  selector: 'app-cancel-event-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, AppIcon],
  templateUrl: './cancel-event-dialog.html',
  styleUrl: './cancel-event-dialog.scss',
})
export class CancelEventDialog {
  private readonly dialogRef = inject<MatDialogRef<CancelEventDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<CancelEventData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly heading = computed(() =>
    fillTone(this.theme.tone()['partie.ralliement_event_cancel_event_heading'], {
      title: this.data.title,
    }),
  );

  protected cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    // Échap et clic sur le voile ne ferment pas la fenêtre pendant l'écriture : la relecture de la liste
    // dépend de sa fermeture par le succès.
    this.dialogRef.disableClose = true;
    this.error.set(null);
    try {
      await this.data.confirm();
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_event_cancel_event_error']),
      );
    } finally {
      this.busy.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
