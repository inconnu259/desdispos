import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AnnouncementDto, CreateAnnouncementDto } from '@desdispos/shared';
import { API_BASE } from '../api-base';

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly http = inject(HttpClient);

  // Bug fix (temps réel) : contrat public AD-4 (zéro argument), même forme que
  // AvailabilityService/CharacterService — appelé par RealtimeService sur un événement SSE
  // partie:{id}. Absent jusqu'ici : les annonces publiées par un autre utilisateur/onglet
  // n'apparaissaient jamais sans recharger la page.
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  create(partieId: string, dto: CreateAnnouncementDto): Promise<AnnouncementDto> {
    return firstValueFrom(
      this.http.post<AnnouncementDto>(`${API_BASE}/parties/${partieId}/announcements`, dto, {
        withCredentials: true,
      }),
    );
  }

  listAll(partieId: string): Promise<AnnouncementDto[]> {
    return firstValueFrom(
      this.http.get<AnnouncementDto[]>(`${API_BASE}/parties/${partieId}/announcements`, {
        withCredentials: true,
      }),
    );
  }
}
