import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { AnnouncementDto } from '@desdispos/shared';
import { AccountService } from '../account/account.service';
import { AuthService } from '../auth/auth.service';

/** Story 29.13 : annonces non vues, agrégées sur toutes les Parties du joueur en un seul appel
 *  batché (AD-3). Aucun câblage SSE (AD-14, état strictement personnel) — chargé une fois à la
 *  connexion (login() ou restauration de session), retiré localement au marquage lu. */
@Injectable({ providedIn: 'root' })
export class UnseenAnnouncementsService {
  private readonly accountSvc = inject(AccountService);
  private readonly authSvc = inject(AuthService);

  readonly unseenAnnouncements = signal<AnnouncementDto[]>([]);
  readonly count = computed(() => this.unseenAnnouncements().length);

  private wasLoggedIn = false;
  // Incrémenté à chaque transition d'utilisateur : une réponse load() en vol dont la génération
  // ne correspond plus à la génération courante est jetée (poste partagé, changement d'utilisateur
  // pendant la requête en vol).
  private loadGeneration = 0;
  private readonly pendingMarkRead = new Set<string>();

  constructor() {
    effect(() => {
      const user = this.authSvc.currentUser();
      // untracked() : ne réagir qu'à la transition null <-> utilisateur portée par currentUser(),
      // jamais aux écritures internes de ce bloc (même patron qu'OpenPollsService.refresh()).
      untracked(() => {
        if (user && !this.wasLoggedIn) {
          this.wasLoggedIn = true;
          this.loadGeneration++;
          void this.load(this.loadGeneration);
        } else if (!user) {
          this.wasLoggedIn = false;
          this.loadGeneration++;
          this.unseenAnnouncements.set([]);
        }
      });
    });
  }

  private async load(generation: number): Promise<void> {
    try {
      const announcements = await this.accountSvc.getUnseenAnnouncements();
      if (generation !== this.loadGeneration) return;
      this.unseenAnnouncements.set(announcements);
    } catch {
      // Échec transitoire : la notification sera simplement absente jusqu'à la prochaine connexion.
    }
  }

  async markRead(announcementId: string): Promise<void> {
    if (this.pendingMarkRead.has(announcementId)) return;
    this.pendingMarkRead.add(announcementId);
    try {
      await this.accountSvc.markAnnouncementRead(announcementId);
      this.unseenAnnouncements.update((list) => list.filter((a) => a.id !== announcementId));
    } catch {
      // Échec transitoire : l'id reste dans la liste, un prochain clic sur AnnonceCard réessaiera.
    } finally {
      this.pendingMarkRead.delete(announcementId);
    }
  }
}
