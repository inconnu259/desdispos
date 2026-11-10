import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { PartySignalsDto } from '@master-jdr/shared';
import { API_BASE } from '../api-base';

const API = API_BASE;

/**
 * `GET /me/party-signals` (Story 29.7, AD-3) : un seul appel pour toutes les parties de
 * l'utilisateur — jamais un appel par partie affichée (AC1). `notifyChanged()` est le contrat
 * public AD-4/AD-14 appelé par `RealtimeService` sur le préfixe `user:` **seul**, jamais `partie:`.
 */
@Injectable({ providedIn: 'root' })
export class PartySignalsService {
  private readonly http = inject(HttpClient);

  readonly signals = signal<Map<string, PartySignalsDto>>(new Map());

  private seq = 0;

  constructor() {
    void this.refresh();
  }

  /** Même patron anti-course que `MyPartiesService.refreshAll()` : une réponse obsolète ne
   *  peut jamais écraser un état plus frais, un échec réseau transitoire garde le dernier état
   *  connu bon plutôt que de vider la carte. Public (Story 29.16) : `MyCharacters.ngOnInit()`
   *  l'appelle directement à l'activation de la route, en plus de `notifyChanged()` sur l'événement
   *  SSE `user:{id}` — l'écran a besoin d'un signal frais dès l'arrivée, pas seulement en cours de
   *  session. */
  async refresh(): Promise<void> {
    const seq = ++this.seq;
    let map: Record<string, PartySignalsDto> | undefined;
    try {
      map = await firstValueFrom(
        this.http.get<Record<string, PartySignalsDto>>(`${API}/me/party-signals`, {
          withCredentials: true,
        }),
      );
    } catch {
      return;
    }
    if (seq !== this.seq) return;
    this.signals.set(new Map(Object.entries(map)));
  }

  /** Contrat public AD-4/AD-14 — `RealtimeService` l'appelle sur un événement SSE `user:{id}`. */
  notifyChanged(): void {
    void this.refresh();
  }
}
