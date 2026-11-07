import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AvailabilityReminderDto } from '@master-jdr/shared';
import { API_BASE } from '../api-base';
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
