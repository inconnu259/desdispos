import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { bestOption } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { pollCountsLabel, type RankedPollSlot } from '../event-card.util';
import { refusalMessage } from '../refusal-message';

export interface DateFixData {
  /** Nom de la conjonction, écrit dans la phrase d'introduction. */
  title: string;
  /** Les créneaux du sondage, du plus au moins plébiscité (le premier est présélectionné). */
  slots: readonly RankedPollSlot[];
  /** Aujourd'hui (clé `YYYY-MM-DD`) : `bestOption` en exclut les créneaux passés. */
  todayKey: string;
  /** Écrit la date choisie (`PATCH …/poll/:pollId/choose`). Une erreur reste affichée dans la fenêtre. */
  confirm: (optionId: string) => Promise<void>;
}

/**
 * Story 40.6 — la confirmation « Votre accord » de l'hôte qui fixe la date de sa conjonction (UX-DR12,
 * même principe que la confirmation « Sceller » du calendrier). Les créneaux sont des boutons radio,
 * du plus au moins plébiscité, avec « n oui · n peut-être · n non » ; le meilleur est présélectionné ;
 * le texte dit que la date sera scellée, les inscrits prévenus par e-mail et qu'elle ne se rouvre pas.
 *
 * « Renoncer » ne change rien. « Fixer la date » est gardé contre le double clic (`busy`) ; si le serveur
 * refuse (pas l'hôte, date déjà fixée…), son message reste affiché ici et la fenêtre reste ouverte. Au
 * succès elle se ferme en rendant `true`.
 */
@Component({
  selector: 'app-date-fix-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './date-fix-dialog.html',
  styleUrl: './date-fix-dialog.scss',
})
export class DateFixDialog {
  private readonly dialogRef = inject<MatDialogRef<DateFixDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<DateFixData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  /** Le meilleur créneau (`bestOption`, Story 44.3) est présélectionné ; aucun si tous sont passés ou si
   *  personne n'a dit oui — c'est alors à la personne de choisir. */
  protected readonly selected = signal<string | null>(
    bestOption(this.data.slots, this.data.todayKey)?.id ?? null,
  );
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly heading = computed(() =>
    fillTone(this.theme.tone()['partie.ralliement_event_fix_heading'], {
      title: this.data.title,
    }),
  );
  protected readonly rows = computed(() =>
    this.data.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      counts: pollCountsLabel(slot, this.theme.tone()),
      past: slot.past,
    })),
  );

  protected select(optionId: string): void {
    if (this.data.slots.find((slot) => slot.id === optionId)?.past) return;
    this.selected.set(optionId);
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  protected async confirm(): Promise<void> {
    const optionId = this.selected();
    if (!optionId || this.busy()) return;
    this.busy.set(true);
    // Échap et clic sur le voile ne ferment pas la fenêtre pendant l'écriture : la relecture de la liste
    // (`refreshRequested`) dépend de sa fermeture par le succès.
    this.dialogRef.disableClose = true;
    this.error.set(null);
    try {
      await this.data.confirm(optionId);
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_event_fix_date_error']),
      );
    } finally {
      this.busy.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
