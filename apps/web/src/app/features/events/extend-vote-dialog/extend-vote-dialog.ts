import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { shortDayLabel } from '../event-card.util';
import { refusalMessage } from '../refusal-message';

export interface ExtendVoteData {
  /** Nom de la conjonction, écrit dans la phrase d'introduction. */
  title: string;
  /** Jour d'échéance actuel (clé `YYYY-MM-DD`), écrit dans la phrase d'introduction ; `null` s'il est inconnu. */
  deadlineKey: string | null;
  /** Plus petit jour proposable (clé `YYYY-MM-DD`) : le lendemain de l'échéance, jamais avant aujourd'hui. */
  minKey: string;
  /** Écrit la nouvelle échéance (`PATCH …/poll/:pollId/extend`). Une erreur reste affichée dans la fenêtre. */
  confirm: (day: string) => Promise<void>;
}

/** Clé de jour `YYYY-MM-DD`. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Story 40.7 — la confirmation « Votre accord » de l'hôte qui prolonge le vote de sa conjonction (UX-DR12,
 * même patron que `DateFixDialog`). La phrase d'introduction rappelle la fin actuelle du vote ; le champ
 * « Nouvelle échéance » est une date native, au plus tôt le lendemain de l'échéance actuelle (jamais avant
 * aujourd'hui) ; le texte dit que ceux qui n'ont pas encore voté seront relancés la veille de la nouvelle
 * échéance.
 *
 * « Renoncer » ne change rien. « Prolonger » est gardé contre le double clic (`busy`) ; tant que la requête
 * court, ni Échap ni le voile ne ferment la fenêtre. Si le serveur refuse (pas l'hôte, date déjà fixée…), son
 * message reste affiché ici et la fenêtre reste ouverte. Au succès elle se ferme en rendant `true`.
 */
@Component({
  selector: 'app-extend-vote-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './extend-vote-dialog.html',
  styleUrl: './extend-vote-dialog.scss',
})
export class ExtendVoteDialog {
  private readonly dialogRef = inject<MatDialogRef<ExtendVoteDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<ExtendVoteData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  /** Le jour choisi (clé `YYYY-MM-DD`), vide tant que rien n'est saisi. */
  protected readonly day = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly heading = computed(() =>
    fillTone(this.theme.tone()['partie.ralliement_event_extend_heading'], {
      title: this.data.title,
      // Le point de l'abréviation (« oct. ») ne doit pas doubler celui qui ferme la phrase.
      date: this.data.deadlineKey ? shortDayLabel(this.data.deadlineKey).replace(/\.$/, '') : '—',
    }),
  );
  /** Un jour valide, pas avant le minimum (le serveur reste juge). */
  protected readonly valid = computed(
    () => DAY_KEY.test(this.day()) && this.day() >= this.data.minKey,
  );

  protected setDay(value: string): void {
    this.day.set(value);
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  protected async confirm(): Promise<void> {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    // Échap et clic sur le voile ne ferment pas la fenêtre pendant l'écriture : la relecture de la liste
    // (`refreshRequested`) dépend de sa fermeture par le succès.
    this.dialogRef.disableClose = true;
    this.error.set(null);
    try {
      await this.data.confirm(this.day());
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(
        refusalMessage(err, this.theme.tone()['partie.ralliement_event_extend_error']),
      );
    } finally {
      this.busy.set(false);
      this.dialogRef.disableClose = false;
    }
  }
}
