import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthBand } from '../auth-band/auth-band';

@Component({
  selector: 'app-confirm-email-change',
  imports: [AuthBand, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './confirm-email-change.html',
  styleUrl: './confirm-email-change.scss',
})
export class ConfirmEmailChange {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  protected readonly tone = inject(ThemeToneService).tone;
  /** Conteneur `role="status"` persistant : reçoit le focus quand le bouton activé disparaît. */
  private readonly status = viewChild<ElementRef<HTMLElement>>('status');

  // Même patron que ResetPassword : lecture réactive (pas `snapshot` seul) au cas où l'instance
  // de composant serait réutilisée entre deux liens ouverts successivement.
  protected readonly token = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('token') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('token') ?? '' },
  );
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmed = signal(false);

  async confirm(): Promise<void> {
    const token = this.token();
    if (!token) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmEmailChange(token);
      this.confirmed.set(true);
      afterNextRender(() => this.status()?.nativeElement.focus(), { injector: this.injector });
    } catch {
      // Aucune redirection automatique : l'utilisateur peut déjà être connecté ailleurs, on le
      // laisse choisir sa prochaine action.
      this.error.set(this.tone()['common.lien_invalide_ou_expire_merci_de_refaire_une_demande']);
    } finally {
      this.loading.set(false);
    }
  }
}
