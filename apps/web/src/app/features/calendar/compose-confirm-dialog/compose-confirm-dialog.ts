import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { durationLossLabel } from '../../../shared/duration-stepper/duration-labels';

export interface ComposeConfirmData {
  /** Nombre de créneaux que la composition va poser. */
  slotCount: number;
  /** Combien de créneaux sont retirés. */
  removedCount: number;
  /** Combien de RÉPONSES seront supprimées avec eux (AC6 — c'est CE nombre que l'écran doit nommer). */
  voterCount: number;
  /** Story 40.5b : conjonction d'un groupe — mêmes questions, avec les mots du groupe (créneaux, pas
   *  de séance). Absent pour un vote de JDR, dont les textes ne changent pas. */
  group?: boolean;
  /** ⚠️ Story 47.4 : la durée du rendez-vous change — TOUTES les options sont recréées, `voterCount` compte alors
   *  toutes les réponses (`composeLoss`) et l'avertissement le dit en ces termes. */
  durationChanged?: boolean;
}

/**
 * Story 36.10 — la dernière question avant l'écriture ; Story 45.2 — réduite à une seule face.
 *
 * ⚠️ Le rendez-vous se choisit AVANT le composer (« Proposer des dates », `?seanceId`), plus à la validation :
 * ce dialogue n'a plus de sélecteur de séance et ne s'ouvre qu'à une seule condition — modifier un vote
 * retire des créneaux qui portent des réponses. Il avertit AVANT, en nommant le nombre de votants concernés,
 * et laisse renoncer (AC6, Q-22).
 *
 * Il n'écrit rien : il rend une décision à `CalendarView` (`true` = continuer, `null` = renoncer), qui émet
 * l'unique appel.
 */
@Component({
  selector: 'app-compose-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './compose-confirm-dialog.html',
  styleUrl: './compose-confirm-dialog.scss',
})
export class ComposeConfirmDialog {
  private readonly dialogRef =
    inject<MatDialogRef<ComposeConfirmDialog, true | null>>(MatDialogRef);
  protected readonly data = inject<ComposeConfirmData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  /** Clé de texte selon l'origine : JDR (`calendar.compose_confirm_*`) ou groupe. */
  protected tk(suffix: string): string {
    return this.data.group
      ? `partie.ralliement_calendar_confirm_${suffix}`
      : `calendar.compose_confirm_${suffix}`;
  }

  protected readonly title = computed(
    () => this.theme.tone()[this.data.group ? this.tk('title') : this.tk('title_modify')],
  );
  /** Note sous l'avertissement : les réponses des créneaux conservés ne sont pas touchées. */
  protected readonly note = computed(() => this.theme.tone()[this.tk('note')]);

  /** AC6 — le nombre de votants est NOMMÉ, jamais résumé en « des réponses seront perdues ». */
  protected readonly warning = computed(() => {
    const { removedCount, voterCount } = this.data;
    // Story 47.4 — mots neutres, identiques dans les trois thèmes (`DURATION_TEXT`, décision de la 47.1).
    if (this.data.durationChanged) return durationLossLabel(voterCount);
    const tone = this.theme.tone();
    const slotsKey = this.tk(removedCount > 1 ? 'slots_many' : 'slots_one');
    const votesKey = this.tk(voterCount > 1 ? 'responses_many' : 'responses_one');
    const warningKey = this.tk(voterCount > 1 ? 'warning_many' : 'warning_one');
    return fillTone(tone[warningKey], {
      slots: fillTone(tone[slotsKey], { n: removedCount }),
      votes: fillTone(tone[votesKey], { n: voterCount }),
    });
  });

  /** Nombre de créneaux que la composition va poser, accordé en nombre. */
  protected readonly summary = computed(() => {
    const { slotCount } = this.data;
    const key = this.tk(slotCount > 1 ? 'summary_many' : 'summary_one');
    return fillTone(this.theme.tone()[key], { n: slotCount });
  });

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  /** `null` = on renonce. L'appelant garde sa composition intacte (AC6). */
  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
