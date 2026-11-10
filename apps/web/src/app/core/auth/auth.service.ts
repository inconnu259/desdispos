import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '@master-jdr/shared';
import { THEMES } from '@master-jdr/shared';
import { API_BASE } from '../api-base';
import { AccountService } from '../account/account.service';
import { ThemeToneService } from '../theme/theme-tone.service';

// Source unique de l'URL d'API (`core/api-base.ts`) — l'URL était auparavant redéfinie en dur ici,
// ce qui cassait tout accès depuis un autre appareil que le poste de dev (la requête partait vers le
// `localhost` du téléphone). Le TODO « passer l'URL par la config d'environnement » reste ouvert et
// est suivi dans docs/backlog.md § Palier 11.
const API = API_BASE;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accountSvc = inject(AccountService);
  private readonly themeSvc = inject(ThemeToneService);

  /** Utilisateur courant (null = non connecté). */
  readonly currentUser = signal<AuthUser | null>(null);
  /** Passe à true une fois la session vérifiée au démarrage. */
  readonly initialized = signal(false);

  private sessionPromise: Promise<void> | null = null;

  /** Restaure la session via le cookie. Dédupliqué : un seul /auth/me même si appelé plusieurs fois. */
  loadSession(): Promise<void> {
    return (this.sessionPromise ??= this.fetchSession());
  }

  private async fetchSession(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${API}/auth/me`, { withCredentials: true }),
      );
      this.currentUser.set(user);
      await this.syncTheme(user);
    } catch {
      this.currentUser.set(null);
    } finally {
      this.initialized.set(true);
    }
  }

  /** `identifier` accepte indifféremment l'email ou le pseudo (cf. LocalStrategy côté API). */
  async login(identifier: string, password: string): Promise<void> {
    const user = await firstValueFrom(
      this.http.post<AuthUser>(
        `${API}/auth/login`,
        { identifier, password },
        { withCredentials: true },
      ),
    );
    this.currentUser.set(user);
    this.initialized.set(true);
    await this.syncTheme(user);
  }

  /**
   * AD-13 : le compte est la seule source de vérité une fois connecté. `theme` non-`null` →
   * `ThemeToneService` l'applique (seul point d'entrée, écrase `localStorage`). `theme` `null`
   * (compte jamais configuré) → le thème local actuel est adopté une seule fois et poussé vers le
   * compte, sans jamais rappeler `setTheme()` (déjà appliqué localement au démarrage, cf. `app.ts`).
   */
  private async syncTheme(user: AuthUser): Promise<void> {
    if (user.theme !== null) {
      // Revue de code : valider avant d'appliquer, comme le fait déjà `readStoredTheme()` pour
      // `localStorage` — une valeur héritée/invalide en base (édition manuelle, migration future)
      // ne doit jamais atteindre `ThemeToneService.setTheme()` telle quelle.
      if ((THEMES as readonly string[]).includes(user.theme)) {
        this.themeSvc.setTheme(user.theme);
      }
      return;
    }
    const themeAtPushTime = this.themeSvc.activeTheme();
    try {
      const pushed = await this.accountSvc.setTheme(themeAtPushTime);
      // Revue de code : si le thème local a changé pendant que cette requête était en vol (ex.
      // clic sur ThemeSelector juste après la connexion), ne pas écraser `currentUser` avec une
      // réponse désormais périmée.
      if (this.themeSvc.activeTheme() === themeAtPushTime) {
        this.currentUser.set(pushed);
      }
    } catch {
      // Non-critique — le thème reste appliqué localement, la synchronisation sera retentée à la
      // prochaine connexion.
    }
  }

  async register(email: string, pseudo: string, password: string, token: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${API}/auth/register`,
        { email, pseudo, password, token },
        { withCredentials: true },
      ),
    );
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${API}/auth/logout`, {}, { withCredentials: true }));
    this.currentUser.set(null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API}/auth/forgot-password`, { email }, { withCredentials: true }),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${API}/auth/reset-password`,
        { token, newPassword },
        { withCredentials: true },
      ),
    );
  }

  async confirmEmailChange(token: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API}/auth/confirm-email-change`, { token }, { withCredentials: true }),
    );
  }

  async rollbackEmailChange(token: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API}/auth/rollback-email-change`, { token }, { withCredentials: true }),
    );
  }
}
