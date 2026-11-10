import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import type { PartieDto } from '@master-jdr/shared';
import { AppIcon } from '../../../core/icons/app-icon';
import { CoverUpload } from '../../../core/parties/cover-upload';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { PartyBanner } from '../../../shared/party-banner/party-banner';
import { ConfirmDialog, type ConfirmData } from '../confirm-dialog/confirm-dialog';

/** Durée d'affichage des avis (ms) : sans action, ils se retirent seuls. */
const SNACK_DURATION_MS = 4000;

/**
 * Bannière illustrée de la page d'une partie, avec les puces « Changer » / « Retirer » pour qui a le
 * droit de changer la couverture (Story 53.6, ⚠️ planche UI validée).
 *
 * - `PartyBanner` reste purement présentationnel : la bannière lit `partie()` sans copie locale, et
 *   la partie mise à jour est rendue au parent (`partieChange`), qui détient l'état.
 * - Les puces sont SŒURS de la bannière (jamais dedans : elle est `aria-hidden`) ; elles n'existent que
 *   si le serveur le dit (`partie.can.coverUpdate`) — le web n'infère jamais le droit du rôle.
 * - Dépôt et retrait passent par `CoverUpload` (une instance par composant) : refus local, garde
 *   anti-double envoi et appels réseau n'ont qu'une seule implémentation.
 */
@Component({
  selector: 'app-editable-banner',
  imports: [PartyBanner, AppIcon],
  providers: [CoverUpload],
  templateUrl: './editable-banner.html',
  styleUrl: './editable-banner.scss',
})
export class EditableBanner {
  protected readonly theme = inject(ThemeToneService);
  protected readonly cover = inject(CoverUpload);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  readonly partie = input.required<PartieDto>();
  /** La partie telle que le serveur la renvoie après un dépôt ou un retrait réussi. */
  readonly partieChange = output<PartieDto>();

  protected readonly hasCover = computed(() => this.partie().coverImageVersion !== null);
  protected readonly canUpdate = computed(() => this.partie().can.coverUpdate);

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Remis à zéro pour que redéposer le même fichier déclenche de nouveau `change`.
    input.value = '';
    if (!file) return;

    const tone = this.theme.tone();
    const refusal = this.cover.refusal(file);
    if (refusal) {
      this.notify(tone[refusal]);
      return;
    }
    try {
      const updated = await this.cover.change(this.partie().id, file);
      // `null` : un envoi était déjà en cours, rien n'est parti — pas d'avis.
      if (updated) {
        this.partieChange.emit(updated);
        this.notify(tone['partie.cover_changed']);
      }
    } catch {
      this.notify(tone['partie.cover_upload_error']);
    }
  }

  protected async onRemove(): Promise<void> {
    const tone = this.theme.tone();
    const data: ConfirmData = {
      message: tone['partie.cover_remove_confirm'],
      confirmLabel: tone['common.retirer'],
      destructive: true,
    };
    const ref = this.dialog.open(ConfirmDialog, { data });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    try {
      const updated = await this.cover.remove(this.partie().id);
      if (updated) {
        this.partieChange.emit(updated);
        this.notify(tone['partie.cover_removed']);
        // Le bouton « Retirer » quitte le DOM : le focus passe au champ fichier restant, une fois
        // `saving` retombé (un champ désactivé ne prend pas le focus).
        afterNextRender(() => this.picker()?.nativeElement.focus(), { injector: this.injector });
      }
    } catch {
      this.notify(tone['partie.cover_remove_error']);
    }
  }

  private notify(message: string): void {
    this.snack.open(message, undefined, { duration: SNACK_DURATION_MS });
  }
}
