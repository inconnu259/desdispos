import { Component, ElementRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { PasswordReveal } from '../../../shared/password-reveal/password-reveal';
import { PasswordToggle } from '../../../shared/password-reveal/password-toggle';
import { AuthAriaInvalid } from '../aria-invalid';
import { fieldErrorKey, rejectInvalidSubmit } from '../auth-form';
import { AuthBand } from '../auth-band/auth-band';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly theme = inject(ThemeToneService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly tone = this.theme.tone;

  /** Story 43.2 : on arrive d'un compte tout juste effacé (`?compte=efface`) — message de confirmation. */
  protected readonly accountDeleted = this.route.snapshot.queryParamMap.get('compte') === 'efface';

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  /** Message de validation écrit du champ (un seul par champ), ou chaîne vide s'il est valide. */
  protected fieldError(name: 'identifier' | 'password'): string {
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
      const { identifier, password } = this.form.getRawValue();
      await this.auth.login(identifier, password);
      void this.router.navigate(['/']);
    } catch (err) {
      this.error.set(this.theme.tone()[this.failureToneKey(err)]);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Classe l'échec de connexion d'après l'`HttpErrorResponse` (statut et corps) pour ne jamais
   * mentir sur la cause. Ne renvoie qu'une clé de ton : ni `err.message`, ni statut, ni corps du
   * serveur n'atteignent l'écran.
   */
  private failureToneKey(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) return 'auth.login_unexpected';
    const { status } = err;
    if (status === 401) {
      // Le 401 par défaut de Nest porte le message `Unauthorized` (identifiants invalides). Un
      // message personnalisé (aujourd'hui : compte à réinitialisation imposée, story 28.6) n'est
      // émis qu'avec le bon mot de passe. Jamais de distinction compte inexistant / mot de passe
      // incorrect : la connexion accepte e-mail ou pseudo.
      return this.hasCustomMessage(err.error) ? 'auth.login_reset_required' : 'auth.login_invalid';
    }
    if (status === 429) return 'auth.login_throttled';
    if (status === 0 || status === 502 || status === 503 || status === 504) {
      return 'auth.login_unavailable';
    }
    return 'auth.login_unexpected';
  }

  // Seul un corps OBJET portant un message texte non vide, différent de Unauthorized, est un
  // message personnalisé. Un corps chaîne (page HTML d'un proxy/WAF : Angular ne produit une
  // chaîne que pour un corps non JSON), nul ou un message tableau/vide reste « identifiants
  // invalides ».
  private hasCustomMessage(body: unknown): boolean {
    if (typeof body !== 'object' || body === null || !('message' in body)) return false;
    const { message } = body;
    if (typeof message !== 'string') return false;
    const text = message.trim().toLowerCase();
    return text !== '' && text !== 'unauthorized';
  }
}
