import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordReveal } from '../../../shared/password-reveal/password-reveal';
import { PasswordToggle } from '../../../shared/password-reveal/password-toggle';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { AuthAriaInvalid } from '../aria-invalid';
import { fieldErrorKey, rejectInvalidSubmit, type MinLengthToneKey } from '../auth-form';
import { AuthBand } from '../auth-band/auth-band';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tone = inject(ThemeToneService).tone;

  /** Inscription sur invitation : le token vient du lien (/join → /register?token=…). */
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    pseudo: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Message de validation écrit du champ (un seul par champ), ou chaîne vide s'il est valide. */
  protected fieldError(name: 'email' | 'pseudo' | 'password'): string {
    const minLengthKey: Partial<Record<typeof name, MinLengthToneKey>> = {
      pseudo: 'auth.field_pseudo_min',
      password: 'auth.field_password_min',
    };
    const key = fieldErrorKey(this.form.controls[name], minLengthKey[name]);
    return key ? this.tone()[key] : '';
  }

  async submit(): Promise<void> {
    if (!this.token) return;
    if (this.form.invalid) {
      // Envoi invalide : jamais muet — messages, focus sur le premier champ invalide, aucun appel.
      rejectInvalidSubmit(this.form, this.host.nativeElement);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const { email, pseudo, password } = this.form.getRawValue();
      await this.auth.register(email, pseudo, password, this.token);
      await this.auth.login(email, password);
      void this.router.navigate(['/']);
    } catch {
      this.error.set(this.tone()['auth.register_error']);
    } finally {
      this.loading.set(false);
    }
  }
}
