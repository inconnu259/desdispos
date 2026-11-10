import { Component, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordReveal } from '../../../shared/password-reveal/password-reveal';
import { PasswordToggle } from '../../../shared/password-reveal/password-toggle';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthAriaInvalid } from '../aria-invalid';
import { fieldErrorKey, rejectInvalidSubmit } from '../auth-form';
import { AuthBand } from '../auth-band/auth-band';

@Component({
  selector: 'app-reset-password',
  imports: [
    AuthBand,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    AuthAriaInvalid,
    PasswordReveal,
    PasswordToggle,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tone = inject(ThemeToneService).tone;

  /**
   * Le lien reçu par e-mail porte le token dans le chemin : /reset-password/:token. Lu de façon
   * réactive (pas via `snapshot`) au cas où Angular réutiliserait l'instance du composant lors
   * d'une navigation ne changeant que ce paramètre (deux liens de reset ouverts successivement).
   */
  protected readonly token = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('token') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('token') ?? '' },
  );
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Message de validation écrit du champ (un seul par champ), ou chaîne vide s'il est valide. */
  protected fieldError(name: 'newPassword'): string {
    const key = fieldErrorKey(this.form.controls[name], 'auth.field_password_min');
    return key ? this.tone()[key] : '';
  }

  async submit(): Promise<void> {
    const token = this.token();
    if (!token) return;
    if (this.form.invalid) {
      // Envoi invalide : jamais muet — messages, focus sur le premier champ invalide, aucun appel.
      rejectInvalidSubmit(this.form, this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const { newPassword } = this.form.getRawValue();
      await this.auth.resetPassword(token, newPassword);
      void this.router.navigate(['/login']);
    } catch {
      this.error.set(this.tone()['common.lien_invalide_ou_expire_merci_de_refaire_une_demande']);
    } finally {
      this.loading.set(false);
    }
  }
}
