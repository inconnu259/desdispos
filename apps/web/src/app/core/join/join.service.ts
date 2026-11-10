import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { InviteLinkPreviewDto } from '@desdispos/shared';
import { API_BASE } from '../api-base';

// Source unique de l'URL d'API (cf. core/api-base.ts) — plus de redéfinition en dur ici.
const API = API_BASE;

@Injectable({ providedIn: 'root' })
export class JoinService {
  private readonly http = inject(HttpClient);

  /** Prévisualisation publique d'un lien (pas besoin de session). */
  preview(token: string): Promise<InviteLinkPreviewDto> {
    return firstValueFrom(this.http.get<InviteLinkPreviewDto>(`${API}/invite-links/${token}`));
  }

  /** Rejoindre la partie via le lien (utilisateur connecté). Renvoie l'id de la partie. */
  join(token: string): Promise<{ ok: boolean; partieId: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; partieId: string }>(
        `${API}/invite-links/${token}/join`,
        {},
        { withCredentials: true },
      ),
    );
  }
}
