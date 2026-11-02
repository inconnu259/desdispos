import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { AccountDeletionImpactDto } from '@master-jdr/shared';
import { AccountService } from '../../../core/account/account.service';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { PasswordReveal } from '../../../shared/password-reveal/password-reveal';
import { PasswordToggle } from '../../../shared/password-reveal/password-toggle';

export interface DeleteAccountDialogData {
  pseudo: string;
  impact: AccountDeletionImpactDto;
}

/**
 * Story 43.1 (UX-DR12, confirmation n° 1) — « Effacer votre compte ? » : ce qui disparaîtrait avec
 * lui, le champ du mot de passe et le bouton rouge. Les listes vides sont omises.
 *
 * Story 43.2 : le bouton rouge efface le compte (`DELETE /me`) une fois le mot de passe saisi.
 * « Renoncer » ne change rien.
 */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    AppIcon,
    MatInputModule,
    PasswordReveal,
    PasswordToggle,
  ],
  template: `
    <h2 mat-dialog-title>{{ tone()['parties.confirm_title'] }}</h2>
    <mat-dialog-content>
      <p class="intro">{{ intro }}</p>

      @if (data.impact.groups.length > 0) {
        <section class="impact-list" data-testid="impact-groups">
          <h3>{{ tone()['account.delete_groups_title'] }}</h3>
          <ul>
            @for (g of data.impact.groups; track g.id) {
              <li>{{ groupLine(g) }}</li>
            }
          </ul>
        </section>
      }

      @if (data.impact.jdrParties.length > 0) {
        <section class="impact-list" data-testid="impact-jdr">
          <h3>{{ tone()['account.delete_jdr_title'] }}</h3>
          <ul>
            @for (p of data.impact.jdrParties; track p.id) {
              <li>{{ jdrLine(p) }}</li>
            }
          </ul>
        </section>
      }

      <p class="irreversible">{{ tone()['account.delete_irreversible'] }}</p>

      <mat-form-field appearance="outline">
        <mat-label>{{ tone()['account.current_password_label'] }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="current-password"
          [formControl]="password"
          appPasswordReveal
          #pw="appPasswordReveal"
        />
        <app-password-toggle matSuffix [for]="pw" />
      </mat-form-field>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ tone()['common.annuler'] }}</button>
      <button
        mat-flat-button
        class="confirm-destructive"
        [disabled]="!hasPassword() || busy()"
        (click)="confirm()"
      >
        <app-icon name="avertissement" />
        {{ tone()['account.delete_confirm_btn'] }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .intro,
    .irreversible {
      margin: 0 0 0.75rem;
    }
    .impact-list {
      margin: 0 0 0.75rem;
    }
    .impact-list h3 {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .impact-list ul {
      margin: 0;
      padding-left: 1.25rem;
    }
    .error {
      margin: 0.5rem 0 0;
      color: var(--color-unavailable, #b00020);
    }
    mat-form-field {
      width: 100%;
    }
    .confirm-destructive {
      --mat-button-filled-container-color: var(--color-unavailable);
      --mat-button-filled-label-text-color: #fff;
      --mat-button-filled-hover-state-layer-color: #fff;
      --mat-button-filled-ripple-color: #fff;
      font-weight: 600;
      /* Pictogramme <app-icon> décoratif avant le texte. */
      --app-icon-size: 18px;
    }
    .confirm-destructive app-icon {
      margin-right: 0.4rem;
    }
  `,
})
export class DeleteAccountDialog {
  protected readonly data = inject<DeleteAccountDialogData>(MAT_DIALOG_DATA);
  private readonly theme = inject(ThemeToneService);
  private readonly account = inject(AccountService);
  private readonly dialogRef = inject<MatDialogRef<DeleteAccountDialog, boolean>>(MatDialogRef);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tone = this.theme.tone;
  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly hasPassword = toSignal(
    this.password.valueChanges.pipe(map((v) => v.length > 0)),
    {
      initialValue: false,
    },
  );

  /** Efface le compte (Story 43.2). Succès : la fenêtre se ferme sur `true`, c'est la page Compte qui
   *  déconnecte et change d'écran. Échec : la fenêtre reste ouverte avec un message écrit, rien n'a changé. */
  protected async confirm(): Promise<void> {
    if (!this.password.value || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.account.deleteAccount(this.password.value);
      this.dialogRef.close(true);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : null;
      const tone = this.tone();
      this.error.set(
        status === 401
          ? tone['account.password_wrong_current']
          : status === 429
            ? tone['account.delete_throttled']
            : tone['account.delete_error'],
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected get intro(): string {
    return fillTone(this.tone()['account.delete_intro'], { pseudo: this.data.pseudo });
  }

  /** « 1 membre » / « 3 membres » : un seul au singulier, 0 compris (français). */
  private plural(base: string, n: number): string {
    const tone = this.tone();
    return fillTone(tone[`${base}_${n > 1 ? 'many' : 'one'}`], { n });
  }

  protected groupLine(g: AccountDeletionImpactDto['groups'][number]): string {
    return fillTone(this.tone()['account.delete_group_line'], {
      name: g.name,
      members: this.plural('account.delete_members', g.memberCount),
      events: this.plural('account.delete_events', g.eventCount),
    });
  }

  protected jdrLine(p: AccountDeletionImpactDto['jdrParties'][number]): string {
    const tone = this.tone();
    if (p.playerCount === 0)
      return fillTone(tone['account.delete_jdr_line_none'], { name: p.name });
    const key = p.playerCount === 1 ? 'account.delete_jdr_line_one' : 'account.delete_jdr_line';
    return fillTone(tone[key], { name: p.name, n: p.playerCount });
  }
}
