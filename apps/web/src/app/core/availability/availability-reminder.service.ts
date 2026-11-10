import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuthUser, AvailabilityReminderDto } from '@master-jdr/shared';
import { API_BASE } from '../api-base';
import { AccountService } from '../account/account.service';
import { AuthService } from '../auth/auth.service';

/**
 * Le rappel « Dispos à déclarer » (Story 52.5, AD-5) : UNE lecture, `GET /me/availability-reminder`, dont la règle
 * est entièrement côté serveur (`AvailabilityService.reminderDue`) — le web n'en recalcule rien. Le tableau de bord
 * en tire son bandeau.
 *
 * Paresseux : rien n'est lu avant le premier `refresh()` (l'ouverture du tableau de bord), et le temps réel
 * (`user:{id}`) ne relit qu'après cela. `show` reste faux tant qu'aucune réponse n'est arrivée : aucun clignotement.
 *
 * L'état appartient à UNE personne : le service est un singleton de page, et la déconnexion ne recharge pas la page. La
 * réponse est donc rangée avec l'identifiant de la personne qui l'a demandée, et `show` n'est vrai que pour elle — le
 * rappel d'un compte précédent ne s'affiche jamais chez le suivant, même si sa première lecture échoue.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityReminderService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);

  private readonly state = signal(false);
  /** La personne dont `state` est la réponse. */
  private readonly owner = signal<string | null>(null);

  /** Faut-il rappeler de déclarer ses dispos ? Faux avant la première réponse, après un échec jamais suivi d'un succès,
   *  et pour toute autre personne que celle dont la réponse est gardée. */
  readonly show = computed(() => {
    const id = this.auth.currentUser()?.id ?? null;
    return id !== null && this.owner() === id && this.state();
  });

  /** La personne pour qui une première lecture a été demandée : le temps réel ne relit que pour elle. */
  private startedFor: string | null = null;
  // Compteurs de requête : une réponse plus ancienne que la dernière APPLIQUÉE ne peut jamais écraser un état plus
  // frais ; une plus ancienne que la dernière DEMANDÉE reste valable si la plus récente a échoué.
  private seq = 0;
  private appliedSeq = 0;

  /** Contrat public — `RealtimeService` l'appelle sur un événement `user:{id}` : toute écriture de déclaration, tout
   *  changement de la préférence, toute acceptation d'invitation y préviennent. */
  notifyChanged(): void {
    const id = this.auth.currentUser()?.id ?? null;
    if (id !== null && this.startedFor === id) void this.refresh();
  }

  // Compteur d'écritures : un retour arrière ne s'applique que si AUCUNE écriture plus récente n'a été demandée depuis
  // (même garde que `Account.onLayerToggle()`) — sinon il écraserait un second choix pourtant bien parti.
  private writeSeq = 0;
  // Écritures en vol. Quand il n'y en a aucune, la valeur du compte ET l'état du bandeau sont CONFIRMÉS : c'est la
  // cible du retour arrière (comme `confirmedLayers` de la page Compte), jamais la valeur optimiste d'une écriture
  // précédente qu'aucun serveur n'a tenue.
  private inFlight = 0;
  private confirmed = true;
  private confirmedShowing = false;

  /**
   * Story 52.6 (AD-5) — LE SEUL écrivain de la préférence « Me rappeler de déclarer mes dispos » côté web : le bandeau
   * (« Ne plus me le rappeler », « Annuler ») et la case de la page Compte passent tous deux ici.
   *
   * Optimiste : la valeur affichée (`AuthUser.availabilityReminder`) change aussitôt et, en la coupant, le bandeau
   * disparaît aussitôt (une lecture partie avant et revenue après n'est pas appliquée). L'écriture
   * (`PATCH /me/preferences`) renvoie l'`AuthUser` à jour, qui remplace celui du compte ; le rappel est ensuite relu
   * (réactivé, il revient dès que la règle du serveur est remplie).
   *
   * Échec de la DERNIÈRE écriture demandée : la valeur et le bandeau reviennent à ce qui était confirmé, puis le rappel
   * est relu ; résout `false`. Échec d'une écriture déjà dépassée par un choix plus récent : rien n'est défait, et
   * résout `true` — l'appelant n'a rien à signaler, le choix récent parle pour lui. Résout aussi `false` sans personne
   * connectée, et sans rien toucher si le compte a changé pendant l'écriture.
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    const previous = this.auth.currentUser();
    if (!previous) return false;
    if (this.inFlight === 0) {
      this.confirmed = previous.availabilityReminder;
      this.confirmedShowing = this.state();
    }
    const write = ++this.writeSeq;
    this.inFlight++;
    this.auth.currentUser.set({ ...previous, availabilityReminder: enabled });
    if (!enabled) {
      this.state.set(false);
      // Une lecture partie avant ce choix ne doit pas rallumer le bandeau en revenant.
      this.appliedSeq = this.seq + 1;
    }

    let updated: AuthUser | null;
    try {
      updated = await this.account.updatePreferences({ availabilityReminder: enabled });
    } catch {
      updated = null;
    }
    this.inFlight--;
    // La personne a changé (déconnexion, autre compte) pendant l'écriture : rien de ce qui suit ne la concerne plus.
    if (this.auth.currentUser()?.id !== previous.id) return false;

    if (updated === null) {
      if (write !== this.writeSeq) return true;
      const latest = this.auth.currentUser()!;
      this.auth.currentUser.set({ ...latest, availabilityReminder: this.confirmed });
      this.state.set(this.confirmed ? this.confirmedShowing : false);
      void this.refresh();
      return false;
    }
    this.confirmed = enabled;
    if (write === this.writeSeq) this.auth.currentUser.set(updated);
    await this.refresh();
    return true;
  }

  /** Relit le rappel. Un échec transitoire garde le dernier état connu bon (pour cette personne). */
  async refresh(): Promise<void> {
    const id = this.auth.currentUser()?.id ?? null;
    if (id === null) return;
    this.startedFor = id;
    const seq = ++this.seq;
    let dto: AvailabilityReminderDto;
    try {
      dto = await firstValueFrom(
        this.http.get<AvailabilityReminderDto>(`${API_BASE}/me/availability-reminder`, {
          withCredentials: true,
        }),
      );
    } catch {
      return;
    }
    // Réponse plus ancienne qu'une réponse déjà appliquée, ou personne qui a changé entre-temps : écartée.
    if (seq < this.appliedSeq || this.auth.currentUser()?.id !== id) return;
    this.appliedSeq = seq;
    this.owner.set(id);
    this.state.set(dto.show === true);
  }
}
