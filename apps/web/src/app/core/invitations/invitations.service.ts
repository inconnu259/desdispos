import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { InvitationDto } from '@desdispos/shared';
import { API_BASE } from '../api-base';

// Source unique de l'URL d'API (cf. core/api-base.ts) — plus de redéfinition en dur ici.
const API = API_BASE;

@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly http = inject(HttpClient);
  // Story 21.1 : première introduction de ce signal (contrat AD-4, même forme que
  // CharacterService/HommeDragonService/PartiesService — compteur incrémenté, zéro information
  // de Partie/utilisateur à porter).
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  // Plusieurs composants montés simultanément peuvent recharger sur le même changed() (cf. bug
  // 429 en rafale sur ScenariosService.listAll, même correctif ici) — les appels concurrents
  // partagent la même requête en vol.
  private inFlightListReceived: Promise<InvitationDto[]> | null = null;

  /** Invitations PENDING reçues par l'utilisateur courant. */
  listReceived(): Promise<InvitationDto[]> {
    if (this.inFlightListReceived) return this.inFlightListReceived;
    const request = firstValueFrom(
      this.http.get<InvitationDto[]>(`${API}/invitations`, { withCredentials: true }),
    ).finally(() => (this.inFlightListReceived = null));
    this.inFlightListReceived = request;
    return request;
  }

  accept(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${API}/invitations/${id}/accept`, {}, { withCredentials: true }),
    );
  }

  decline(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${API}/invitations/${id}/decline`, {}, { withCredentials: true }),
    );
  }
}
