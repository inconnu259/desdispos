import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CharacterGroupRoleDto } from '@desdispos/shared';
import { API_BASE } from '../api-base';

@Injectable({ providedIn: 'root' })
export class CharacterRolesService {
  private readonly http = inject(HttpClient);

  // Story 27.3 (AD-8) : contrat AD-4 (zéro argument), même forme que
  // HommeDragonService/AnnouncementsService — appelé par RealtimeService sur un événement SSE
  // partie:{id}. Sans ça, un rôle assigné/retiré par le MJ n'apparaîtrait jamais chez les autres
  // membres déjà sur la page sans recharger.
  private readonly _changed = signal(0);
  readonly changed = this._changed.asReadonly();
  notifyChanged(): void {
    this._changed.update((v) => v + 1);
  }

  listForPartie(partieId: string): Promise<CharacterGroupRoleDto[]> {
    return firstValueFrom(
      this.http.get<CharacterGroupRoleDto[]>(`${API_BASE}/parties/${partieId}/character-roles`, {
        withCredentials: true,
      }),
    );
  }
}
