import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { bestOption } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { pollCountsLabel, type RankedPollSlot } from '../../events/event-card.util';
import { refusalMessage } from '../../events/refusal-message';

export interface SealConfirmData {
  /** Le créneau qui sera retenu, déjà formaté — « ven. 28 août, soir ». La confirmation doit
   *  NOMMER ce qu'elle scelle : « Confirmer ? » ne dit pas quelle date on grave. */
  dateLabel: string;
  /** Le scénario (ou la partie) que porte le vote, pour lever toute ambiguïté quand plusieurs
   *  votes sont ouverts en parallèle — ce qui est le cas normal depuis la story 8.8. */
  pollLabel: string;
}

/**
 * Story 44.6 — le mode « liste de créneaux » : la Destinée fixe la date d'un vote de JDR depuis son plateau, sans
 * la ligne d'agenda qui nommait déjà le créneau. La confirmation liste donc les créneaux candidats avec leurs
 * réponses, le meilleur présélectionné (aucun sans « oui »), et écrit elle-même (`confirm`) pour garder le refus
 * du serveur sous les yeux. Le mode Agenda (`SealConfirmData`) ne change pas.
 */
export interface SealSlotsData {
  pollLabel: string;
  /** Du plus au moins plébiscité (le premier est le meilleur). */
  slots: readonly RankedPollSlot[];
  /** Aujourd'hui (clé `YYYY-MM-DD`) : `bestOption` en exclut les créneaux passés. */
  todayKey: string;
  /** Écrit la date choisie (`PATCH …/poll/:pollId/choose`). Une erreur reste affichée dans la fenêtre. */
  confirm: (optionId: string) => Promise<void>;
}

/**
 * Story 36.12, AC11 — la dernière question avant un scellement.
 *
 * 🚨 **Pourquoi une confirmation ici alors que la fiche de scénario n'en demande aucune.**
 * `PollService.choose()` fait passer le vote à `CLOSED`, pose `chosenDate`/`chosenSlot` et écrit
 * `Partie.nextSessionDate` : **il n'existe aucun retour en arrière côté produit**. Sur la fiche de
 * scénario, le bouton vit à côté de la liste complète des options et de leurs votants — le geste y
 * est délibéré par construction. Dans l'Agenda, il est à un doigt d'un bouton de réponse, sur une
 * ligne qu'on vient peut-être seulement de déplier. Le projet confirme déjà les pertes chiffrées
 * (`ComposeConfirmDialog`, story 36.10) ; une perte irréversible mérite au moins autant.
 *
 * ⚠️ L'asymétrie avec la fiche de scénario est consignée — l'harmoniser est une décision produit,
 * pas une décision de cette story.
 *
 * Il n'écrit rien : il rend une décision à `CalendarView`, qui émet l'unique appel.
 */
@Component({
  selector: 'app-seal-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './seal-confirm-dialog.html',
  styleUrl: './seal-confirm-dialog.scss',
})
export class SealConfirmDialog {
  private readonly dialogRef = inject<MatDialogRef<SealConfirmDialog, boolean>>(MatDialogRef);
  private readonly rawData = inject<SealConfirmData | SealSlotsData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  /** Mode Agenda : le créneau est déjà nommé par l'appelant. */
  protected readonly data: SealConfirmData | null = 'slots' in this.rawData ? null : this.rawData;
  /** Mode liste de créneaux (Story 44.6). */
  protected readonly slotsData: SealSlotsData | null =
    'slots' in this.rawData ? this.rawData : null;

  protected readonly selected = signal<string | null>(
    this.slotsData ? (bestOption(this.slotsData.slots, this.slotsData.todayKey)?.id ?? null) : null,
  );
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly rows = this.slotsData
    ? this.slotsData.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        counts: pollCountsLabel(slot, this.theme.tone()),
        past: slot.past,
      }))
    : [];

  protected select(optionId: string): void {
    if (this.rows.find((row) => row.id === optionId)?.past) return;
    this.selected.set(optionId);
  }

  protected async confirm(): Promise<void> {
    if (!this.slotsData) {
      this.dialogRef.close(true);
      return;
    }
    const optionId = this.selected();
    if (!optionId || this.busy()) return;
    this.busy.set(true);
    // Échap et clic sur le voile ne ferment pas la fenêtre pendant l'écriture (même règle que `DateFixDialog`).
    this.dialogRef.disableClose = true;
    this.error.set(null);
    try {
      await this.slotsData.confirm(optionId);
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(refusalMessage(err, this.theme.tone()['calendar.view_seal_error']));
    } finally {
      this.busy.set(false);
      this.dialogRef.disableClose = false;
    }
  }

  /** `false` plutôt que `undefined` pour un clic explicite sur *Renoncer*. Une fermeture par
   *  `Échap` ou par un clic à côté ne passe PAS par ici — `MatDialogRef` la ferme avec `undefined`
   *  directement — mais l'appelant (`CalendarView.onSealRequested`) teste `!confirmed`, donc les
   *  deux valeurs (`false` et `undefined`) sont traitées identiquement comme un renoncement. */
  protected cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }
}
