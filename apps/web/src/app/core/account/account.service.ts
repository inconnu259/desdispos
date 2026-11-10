import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AccountDeletionImpactDto,
  AnnouncementDto,
  AuthUser,
  CalendarLayerKey,
  CharacterSort,
  ListViewMode,
  PartieSort,
  Theme,
} from '@desdispos/shared';
import { API_BASE } from '../api-base';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  updateDisplayName(displayName: string): Promise<AuthUser> {
    return firstValueFrom(
      this.http.patch<AuthUser>(
        `${API_BASE}/me/display-name`,
        { displayName },
        { withCredentials: true },
      ),
    );
  }

  /** N'applique jamais le thème (AD-13) — lit/écrit uniquement la préférence côté compte. */
  setTheme(theme: Theme): Promise<AuthUser> {
    return firstValueFrom(
      this.http.patch<AuthUser>(`${API_BASE}/me/theme`, { theme }, { withCredentials: true }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.patch<{ ok: true }>(
        `${API_BASE}/me/password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      ),
    );
  }

  requestEmailChange(currentPassword: string, newEmail: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.patch<{ ok: true }>(
        `${API_BASE}/me/email`,
        { currentPassword, newEmail },
        { withCredentials: true },
      ),
    );
  }

  /** Patch partiel (Story 29.8, étendu Story 29.9) — préférences mémorisées sur le compte. */
  updatePreferences(prefs: {
    partiesSort?: PartieSort;
    hideFinishedParties?: boolean;
    availabilityReminder?: boolean;
    partiesViewMode?: ListViewMode;
    charactersViewMode?: ListViewMode;
    charactersSort?: CharacterSort;
    defaultCalendarLayers?: CalendarLayerKey[];
  }): Promise<AuthUser> {
    return firstValueFrom(
      this.http.patch<AuthUser>(`${API_BASE}/me/preferences`, prefs, {
        withCredentials: true,
      }),
    );
  }

  /** Story 43.1 — ce que l'effacement du compte emporterait (lecture seule, recalculé à chaque appel). */
  getDeletionImpact(): Promise<AccountDeletionImpactDto> {
    return firstValueFrom(
      this.http.get<AccountDeletionImpactDto>(`${API_BASE}/me/deletion-impact`, {
        withCredentials: true,
      }),
    );
  }

  /** Story 43.2 — efface le compte connecté ; le mot de passe est dans le corps, jamais dans l'URL. */
  deleteAccount(password: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.delete<{ ok: true }>(`${API_BASE}/me`, {
        body: { password },
        withCredentials: true,
      }),
    );
  }

  addFavorite(partieId: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.put<{ ok: true }>(
        `${API_BASE}/me/favorites/${partieId}`,
        {},
        { withCredentials: true },
      ),
    );
  }

  removeFavorite(partieId: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.delete<{ ok: true }>(`${API_BASE}/me/favorites/${partieId}`, {
        withCredentials: true,
      }),
    );
  }

  getUnseenAnnouncements(): Promise<AnnouncementDto[]> {
    return firstValueFrom(
      this.http.get<AnnouncementDto[]>(`${API_BASE}/me/unseen-announcements`, {
        withCredentials: true,
      }),
    );
  }

  markAnnouncementRead(announcementId: string): Promise<{ ok: true }> {
    return firstValueFrom(
      this.http.put<{ ok: true }>(
        `${API_BASE}/me/announcements-read/${announcementId}`,
        {},
        { withCredentials: true },
      ),
    );
  }
}
