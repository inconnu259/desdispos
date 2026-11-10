import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { HommeDragonDto, PartieDto } from '@master-jdr/shared';
import { PartiesService } from '../../../core/parties/parties.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { HommeDragonCreationWizard } from '../homme-dragon-creation-wizard/homme-dragon-creation-wizard';

/**
 * Parcours de création de l'Homme Dragon d'une aventure (Story 33.5, AD-23 / Story 33.8) — route
 * `parties/:id/homme-dragon`, atteinte par la ligne « Créer un Homme Dragon pour <aventure> » de
 * « Personnages » ou par l'onglet de la partie. La création est « création + association » : un
 * Homme Dragon naît toujours dans une aventure. À la fin, navigue vers sa fiche
 * `/homme-dragons/:id`.
 *
 * Garde : réservé au MJ d'une partie Ryuutama (redirection vers `/parties/:id` sinon, en
 * remplacement d'historique). Si l'aventure a déjà un Homme Dragon, on redirige vers sa fiche
 * plutôt que de rejouer un parcours que le serveur refuserait (`409`). Le serveur reste l'autorité.
 */
@Component({
  selector: 'app-homme-dragon-creation-page',
  imports: [RouterLink, MatProgressSpinnerModule, HommeDragonCreationWizard],
  templateUrl: './homme-dragon-creation-page.html',
  styleUrl: '../homme-dragon-page/homme-dragon-page.scss',
})
export class HommeDragonCreationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly partiesSvc = inject(PartiesService);
  private readonly hommeDragonSvc = inject(HommeDragonService);
  private readonly auth = inject(AuthService);
  private readonly contextualNav = inject(ContextualNavService);
  protected readonly theme = inject(ThemeToneService);

  protected partieId = '';
  protected readonly partie = signal<PartieDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const p = this.partie();
      if (!p) return;
      this.contextualNav.set({
        title: this.theme.tone()['hd.creation_page_title'],
        subtitle: p.name,
      });
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.theme.tone()['common.partie_introuvable']);
      this.loading.set(false);
      return;
    }
    this.partieId = id;

    let partie: PartieDto;
    try {
      partie = await this.partiesSvc.get(id);
    } catch {
      this.error.set(this.theme.tone()['common.impossible_de_charger_la_partie_reessayez']);
      this.loading.set(false);
      return;
    }

    const isMj = partie.ownerId === this.auth.currentUser()?.id;
    if (!isMj || partie.gameSystemId !== 'ryuutama') {
      void this.router.navigate(['/parties', id], { replaceUrl: true });
      return;
    }

    try {
      const existing = await this.hommeDragonSvc.findForPartie(id);
      if (existing) {
        void this.router.navigate(['/homme-dragons', existing.id], { replaceUrl: true });
        return;
      }
    } catch {
      this.error.set(this.theme.tone()['hd.creation_check_error']);
      this.loading.set(false);
      return;
    }

    this.partie.set(partie);
    this.loading.set(false);
  }

  protected onCreated(created: HommeDragonDto): void {
    void this.router.navigate(['/homme-dragons', created.id], { state: { justCreated: true } });
  }
}
