import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AggregatedSlotDto,
  AvailableSlotDto,
  CastVoteDto,
  ChooseDateDto,
  OpenPollEntry,
  SessionPollDto,
  SetPollOptionsDto,
  SlotWindowKeyDto,
} from '@master-jdr/shared';
import { API_BASE } from '../api-base';

@Injectable({ providedIn: 'root' })
export class PollService {
  private readonly http = inject(HttpClient);

  getAvailableSlots(
    partieId: string,
    weeks?: number,
    from?: string,
    to?: string,
    span?: number,
  ): Promise<(AvailableSlotDto | AggregatedSlotDto)[]> {
    // Story 47.6 — `span` : la durée des fenêtres, en créneaux (absente = 1 côté serveur).
    const spanQuery = span === undefined ? '' : `span=${span}`;
    let url: string;
    if (from && to) {
      url = `${API_BASE}/parties/${partieId}/available-slots?from=${from}&to=${to}`;
    } else if (weeks !== undefined) {
      url = `${API_BASE}/parties/${partieId}/available-slots?weeks=${weeks}`;
    } else {
      url = `${API_BASE}/parties/${partieId}/available-slots`;
    }
    if (spanQuery) url += `${url.includes('?') ? '&' : '?'}${spanQuery}`;
    return firstValueFrom(
      this.http.get<(AvailableSlotDto | AggregatedSlotDto)[]>(url, { withCredentials: true }),
    );
  }

  /** Story 46.4 — masque une fenêtre de l'automate (MJ d'un JDR, pour lui seul). `window` est la clé de la fenêtre
   *  telle que `available-slots` l'a servie. */
  async hideWindow(partieId: string, window: SlotWindowKeyDto): Promise<void> {
    await firstValueFrom(
      this.http.put(`${API_BASE}/parties/${partieId}/available-slots/hidden`, window, {
        withCredentials: true,
      }),
    );
  }

  /** Story 46.4 — rend une fenêtre masquée à la liste. */
  async showWindow(partieId: string, window: SlotWindowKeyDto): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${API_BASE}/parties/${partieId}/available-slots/hidden`, {
        body: window,
        withCredentials: true,
      }),
    );
  }

  getHeatmap(partieId: string, from: string, to: string): Promise<AggregatedSlotDto[]> {
    return firstValueFrom(
      this.http.get<AggregatedSlotDto[]>(
        `${API_BASE}/parties/${partieId}/heatmap?from=${from}&to=${to}`,
        { withCredentials: true },
      ),
    );
  }

  /** Mes sondages ouverts, toutes parties et toutes familles (Story 44.2) — `GET /me/open-polls`. */
  getMyOpenPolls(): Promise<OpenPollEntry[]> {
    return firstValueFrom(
      this.http.get<OpenPollEntry[]>(`${API_BASE}/me/open-polls`, { withCredentials: true }),
    );
  }

  getCurrentPoll(partieId: string): Promise<SessionPollDto | null> {
    return firstValueFrom(
      this.http.get<SessionPollDto | null>(`${API_BASE}/parties/${partieId}/poll`, {
        withCredentials: true,
      }),
    );
  }

  closePoll(partieId: string, pollId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_BASE}/parties/${partieId}/poll/${pollId}`, {
        withCredentials: true,
      }),
    );
  }

  castVote(partieId: string, pollId: string, dto: CastVoteDto): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${API_BASE}/parties/${partieId}/poll/${pollId}/vote`, dto, {
        withCredentials: true,
      }),
    );
  }

  chooseDate(partieId: string, pollId: string, dto: ChooseDateDto): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${API_BASE}/parties/${partieId}/poll/${pollId}/choose`, dto, {
        withCredentials: true,
      }),
    );
  }

  /** Retire ma réponse sur une option (Story 30.1, AD-10) — supprime la ligne côté serveur,
   *  jamais une réponse vide. */
  withdrawVote(partieId: string, pollId: string, optionId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_BASE}/parties/${partieId}/poll/${pollId}/vote/${optionId}`, {
        withCredentials: true,
      }),
    );
  }

  /**
   * Story 36.10 (D-16) — remplace le jeu d'options d'un vote OUVERT par celui composé sur la
   * grille. MJ seul, côté serveur.
   *
   * 🚨 `dto.options` est le jeu **complet** voulu, jamais un delta : ce qui n'y est pas est retiré,
   * et le retrait d'une option supprime les réponses qu'elle portait. L'avertissement préalable
   * (AC6) est de la responsabilité de l'appelant — ce service n'avertit pas, il écrit.
   *
   * ⚠️ Ne sert JAMAIS à créer un vote : un vote exige une `Seance`, donc
   * `ScenariosService.createSeancePoll()`.
   */
  setPollOptions(
    partieId: string,
    pollId: string,
    dto: SetPollOptionsDto,
  ): Promise<SessionPollDto> {
    return firstValueFrom(
      this.http.put<SessionPollDto>(`${API_BASE}/parties/${partieId}/poll/${pollId}/options`, dto, {
        withCredentials: true,
      }),
    );
  }
}
