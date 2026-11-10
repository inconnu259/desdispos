import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

@Component({
  selector: 'app-scenario-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './scenario-form.html',
  styleUrl: './scenario-form.scss',
})
export class ScenarioForm {
  private readonly fb = inject(FormBuilder);
  private readonly scenarios = inject(ScenariosService);
  protected readonly theme = inject(ThemeToneService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    dureeHeures: [null as number | null],
    dureeSeances: [null as number | null],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const partieId = this.route.snapshot.paramMap.get('id');
    if (!partieId) return;
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    const payload = {
      title: v.title,
      description: v.description || undefined,
      dureeHeures: v.dureeHeures ?? undefined,
      dureeSeances: v.dureeSeances ?? undefined,
    };
    try {
      const scenario = await this.scenarios.create(partieId, payload);
      void this.router.navigate(['/parties', partieId, 'scenarios', scenario.id], {
        state: { scenario },
      });
    } catch (err) {
      this.error.set(
        err instanceof HttpErrorResponse && typeof err.error?.message === 'string'
          ? err.error.message
          : this.theme.tone()['scenarios.form_save_error'],
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    const partieId = this.route.snapshot.paramMap.get('id');
    void this.router.navigate(partieId ? ['/parties', partieId] : ['/']);
  }
}
