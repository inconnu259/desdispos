import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthAriaInvalid } from '../aria-invalid';
import { fieldErrorKey, rejectInvalidSubmit } from '../auth-form';
import { AuthBand } from '../auth-band/auth-band';

@Component({
  selector: 'app-forgot-password',
  imports: [
    AuthBand,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    AuthAriaInvalid,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly tone = inject(ThemeToneService).tone;
  /** Conteneur `role="status"` persistant : reçoit le focus quand le formulaire disparaît. */
  private readonly status = viewChild<ElementRef<HTMLElement>>('status');

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Toujours le même message générique après un envoi réussi (AC1, anti-énumération). */
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /** Message de validation écrit du champ (un seul par champ), ou chaîne vide s'il est valide. */
  protected fieldError(name: 'email'): string {
    const key = fieldErrorKey(this.form.controls[name]);
    return key ? this.tone()[key] : '';
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      // Envoi invalide : jamais muet — messages, focus sur le premier champ invalide, aucun appel.
      rejectInvalidSubmit(this.form, this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const { email } = this.form.getRawValue();
      await this.auth.requestPasswordReset(email);
      this.sent.set(true);
      // Le bouton activé disparaît avec le formulaire : le focus passe au message de confirmation.
      afterNextRender(() => this.status()?.nativeElement.focus(), { injector: this.injector });
    } catch {
      this.error.set(this.tone()['auth.forgot_error']);
    } finally {
      this.loading.set(false);
    }
  }
}
