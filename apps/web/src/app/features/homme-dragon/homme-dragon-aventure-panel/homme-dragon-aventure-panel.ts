import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { HommeDragonRefDto, MyHommeDragonDto } from '@master-jdr/shared';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { hommeDragonName } from '../../../core/homme-dragon/homme-dragon.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { ConfirmDialog } from '../../parties/confirm-dialog/confirm-dialog';

/**
 * Panneau d'aventure de l'onglet « Homme Dragon » de `PartieDetail` (Story 33.8, AD-23). La fiche
 * elle-même vit sur `/homme-dragons/:id` : ici, seulement le lien entre CETTE aventure et un Homme
 * Dragon.
 *
 * - Aventure pourvue : lien vers la fiche + « Dissocier » (confirmation courte : le niveau de
 *   l'Homme Dragon peut baisser, rien n'est purgé).
 * - Aventure sans Homme Dragon : « Créer un Homme Dragon » (parcours de création, qui crée ET
 *   associe) et « Associer un existant » parmi les miens.
 *
 * Réservé au MJ d'une partie Ryuutama (l'onglet n'est rendu que dans ce cas) ; le serveur reste
 * l'autorité (`getOwned`, `404` avant `409`).
 */
@Component({
  selector: 'app-homme-dragon-aventure-panel',
  imports: [RouterLink, FormsModule, MatButtonModule],
  templateUrl: './homme-dragon-aventure-panel.html',
  styleUrl: './homme-dragon-aventure-panel.scss',
})
export class HommeDragonAventurePanel implements OnInit {
  readonly partieId = input.required<string>();
  readonly partieName = input.required<string>();

  private readonly hommeDragonSvc = inject(HommeDragonService);
  private readonly dialog = inject(MatDialog);
  protected readonly theme = inject(ThemeToneService);

  /** `undefined` = chargement, `null` = aucune fiche liée, sinon la référence `{ id, nom }`. */
  protected readonly linked = signal<HommeDragonRefDto | null | undefined>(undefined);
  protected readonly mine = signal<MyHommeDragonDto[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly linkedName = computed(() => hommeDragonName(this.linked()?.nom));

  /** Libellé du lien « Créer un Homme Dragon pour <aventure> ». */
  protected readonly createLabel = computed(() =>
    fillTone(this.theme.tone()['hd.panel_create_cta'], { partie: this.partieName() }),
  );

  /** Mes Hommes Dragons associables : tous (un Homme Dragon peut suivre plusieurs aventures). */
  protected readonly associable = computed(() =>
    this.mine().map((hd) => ({
      id: hd.id,
      label: hommeDragonName(hd.nom),
    })),
  );

  constructor() {
    // Temps réel (AD-23) : `changed()` est câblé sur `user:` ; create, link et unlink l'émettent. Même
    // garde `firstRun` que la fiche : le chargement initial de ngOnInit() n'est pas doublé.
    let firstRun = true;
    effect(() => {
      this.hommeDragonSvc.changed();
      if (firstRun) {
        firstRun = false;
        return;
      }
      untracked(() => void this.refresh());
    });
  }

  /** Relit le lien et mes Hommes Dragons après un changement fait ailleurs. Sans effet avant le
   *  chargement initial ni pendant une action en cours (`busy()`) ; un échec garde l'état affiché. */
  private async refresh(): Promise<void> {
    if (this.linked() === undefined || this.busy()) return;
    try {
      const [linked, mine] = await Promise.all([
        this.hommeDragonSvc.findForPartie(this.partieId()),
        this.hommeDragonSvc.listMine(),
      ]);
      if (this.busy()) return;
      this.linked.set(linked);
      this.mine.set(mine);
    } catch {
      // non-bloquant — le panneau garde ce qu'il affichait
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const [linked, mine] = await Promise.all([
        this.hommeDragonSvc.findForPartie(this.partieId()),
        this.hommeDragonSvc.listMine(),
      ]);
      this.linked.set(linked);
      this.mine.set(mine);
    } catch {
      this.loadError.set(this.theme.tone()['hd.panel_load_error']);
    }
  }

  protected async onAssociate(): Promise<void> {
    const hommeDragonId = this.selectedId();
    if (!hommeDragonId || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const dto = await this.hommeDragonSvc.link(this.partieId(), hommeDragonId);
      this.linked.set({ id: dto.id, nom: dto.sheetData.nom });
      this.selectedId.set(null);
    } catch {
      this.actionError.set(this.theme.tone()['hd.panel_associate_error']);
    } finally {
      this.busy.set(false);
    }
  }

  /** Dissocier demande une confirmation courte (motif `ConfirmDialog` de l'application). */
  protected async onDissociate(): Promise<void> {
    const current = this.linked();
    if (!current || this.busy()) return;
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        message: fillTone(this.theme.tone()['hd.panel_dissociate_confirm'], {
          nom: this.linkedName(),
          partie: this.partieName(),
        }),
        confirmLabel: this.theme.tone()['common.dissocier'],
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await this.hommeDragonSvc.unlink(this.partieId(), current.id);
      this.linked.set(null);
    } catch {
      this.actionError.set(this.theme.tone()['hd.panel_dissociate_error']);
    } finally {
      this.busy.set(false);
    }
  }
}
