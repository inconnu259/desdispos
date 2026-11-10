import {
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AppIcon } from '../../../core/icons/app-icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import type {
  AvailabilityDeclarationDto,
  CreateAvailabilityDto,
  DaySlot,
} from '@master-jdr/shared';
import {
  AvailabilityService,
  ConflictError,
  type ConflictInfo,
} from '../../../core/availability/availability.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import {
  addMonths,
  buildConstraintDto,
  toISODate,
  type ConstraintFormValue,
} from './constraint-panel.utils';

export { buildConstraintDto, type ConstraintFormValue } from './constraint-panel.utils';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
  EVENING: 'Soir',
  FULL_DAY: 'Journée entière',
};

const RECUR_LABEL: Record<string, string> = {
  RECURRING: 'récurrente',
  PUNCTUAL: 'ponctuelle',
};

@Component({
  selector: 'app-constraint-panel',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatButtonToggleModule, AppIcon, MatRadioModule],
  templateUrl: './constraint-panel.html',
  styleUrl: './constraint-panel.scss',
})
export class ConstraintPanel implements OnInit {
  readonly date = input.required<Date>();
  readonly slot = input.required<DaySlot>();
  readonly existingDeclaration = input<AvailabilityDeclarationDto | null>(null);

  readonly saved = output<AvailabilityDeclarationDto>();
  readonly deleted = output<void>();
  readonly cancelled = output<void>();
  readonly formChanged = output<CreateAvailabilityDto | null>();

  private readonly fb = inject(FormBuilder);
  private readonly availabilitySvc = inject(AvailabilityService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeToneService);
  private readonly snack = inject(MatSnackBar);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** null = aucun dialog ; 'modify' = dialog modification récurrente ; 'delete' = dialog suppression récurrente */
  protected readonly splitDialogAction = signal<'modify' | 'delete' | null>(null);
  /** Conflits détectés lors de la création — déclenche le dialog de résolution. */
  protected readonly conflictData = signal<ConflictInfo[] | null>(null);
  /** DTO en attente de résolution de conflit. */
  private pendingConflictDto: CreateAvailabilityDto | null = null;
  protected readonly today = toISODate(new Date());

  protected readonly form = this.fb.nonNullable.group({
    slot: ['MORNING' as DaySlot],
    kind: ['UNAVAILABLE' as 'UNAVAILABLE' | 'AVAILABLE'],
    type: ['PONCTUEL' as 'PONCTUEL' | 'RECURRENT' | 'PLAGE'],
    expiresAt: [''],
    startDate: [''],
    endDate: [''],
  });

  readonly SLOT_LABELS = SLOT_LABELS;

  constructor() {
    // Re-initialise le formulaire à chaque changement de cellule (date / slot / déclaration existante).
    effect(() => {
      const existing = this.existingDeclaration();
      const slot = this.slot();
      this.date(); // suivi — utilisé indirectement dans prefill et tryBuildPreviewDto

      untracked(() => {
        this.splitDialogAction.set(null);
        this.conflictData.set(null);
        this.pendingConflictDto = null;
        this.error.set(null);
        if (existing) {
          this.prefill(existing);
        } else {
          this.form.patchValue({
            slot,
            type: 'PONCTUEL',
            expiresAt: addMonths(new Date(), 6),
            startDate: toISODate(this.date()), // pré-rempli pour PLAGE
          });
        }
      });
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.splitDialogAction.set(null);
      this.conflictData.set(null);
      this.pendingConflictDto = null;
      this.formChanged.emit(this.tryBuildPreviewDto());
    });
    // Émet le preview initial au cas où l'effet a tourné avant que l'abonnement soit actif.
    this.formChanged.emit(this.tryBuildPreviewDto());
  }

  protected get panelTitle(): string {
    const dateLabel = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(this.date());
    return dateLabel;
  }

  protected get isFormValid(): boolean {
    const v = this.form.getRawValue() as ConstraintFormValue;
    if (v.type === 'RECURRENT' && !v.expiresAt) return false;
    if (v.type === 'PLAGE') {
      if (!v.startDate || !v.endDate) return false;
      if (v.endDate < v.startDate) return false;
    }
    return true;
  }

  private prefill(d: AvailabilityDeclarationDto): void {
    let type: 'PONCTUEL' | 'RECURRENT' | 'PLAGE' = 'PONCTUEL';
    if (d.recurKind === 'RECURRING') {
      type = 'RECURRENT';
    } else if (d.startDate && d.endDate) {
      const cellDateStr = toISODate(this.date());
      if (d.startDate !== d.endDate || d.startDate !== cellDateStr) {
        type = 'PLAGE';
      }
    }
    // En mode PLAGE : utiliser les bornes de la déclaration existante.
    // Sinon (PONCTUEL / RECURRENT) : pré-remplir startDate avec la date cliquée
    // pour que le passage à PLAGE propose une valeur sensée par défaut.
    const isExistingRange = type === 'PLAGE';
    this.form.patchValue({
      slot: d.slot,
      kind: d.kind as 'UNAVAILABLE' | 'AVAILABLE',
      type,
      expiresAt: d.expiresAt.substring(0, 10),
      startDate: isExistingRange ? (d.startDate ?? '') : toISODate(this.date()),
      endDate: isExistingRange ? (d.endDate ?? '') : '',
    });
  }

  private tryBuildPreviewDto(): CreateAvailabilityDto | null {
    const v = this.form.getRawValue() as ConstraintFormValue;
    if (v.type === 'RECURRENT' && !v.expiresAt) return null;
    if (v.type === 'PLAGE' && (!v.startDate || !v.endDate)) return null;
    try {
      return buildConstraintDto(v, this.date());
    } catch {
      return null;
    }
  }

  // ── Sauvegarde ──────────────────────────────────────────────────────────────

  protected async onSave(): Promise<void> {
    if (!this.isFormValid || this.saving()) return;
    const existing = this.existingDeclaration();
    if (existing?.recurKind === 'RECURRING') {
      this.splitDialogAction.set('modify');
      return;
    }
    await this.doActualSave();
  }

  /** "Toutes les occurrences" depuis le dialog modify. */
  protected async onSplitAll(): Promise<void> {
    if (this.saving()) return;
    this.splitDialogAction.set(null);
    await this.doActualSave();
  }

  /** "Ce jour uniquement" depuis le dialog modify. */
  protected async onSplitThisDay(): Promise<void> {
    if (this.saving()) return;
    this.splitDialogAction.set(null);
    this.saving.set(true);
    this.error.set(null);
    try {
      const existing = this.existingDeclaration()!;
      const occurrence = toISODate(this.date());
      const v = this.form.getRawValue() as ConstraintFormValue;
      const result = await this.availabilitySvc.splitOccurrence(existing.id, {
        occurrence,
        action: 'modify',
        dto: { kind: v.kind as 'UNAVAILABLE' | 'AVAILABLE', slot: v.slot },
      });
      this.snack.open(this.theme.tone()['success.constraint_saved'], undefined, { duration: 3000 });
      this.saved.emit(result.created[0] ?? existing);
    } catch {
      this.error.set(this.theme.tone()['calendar.constraint_occurrence_modify_error']);
    } finally {
      this.saving.set(false);
    }
  }

  private async doActualSave(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const existing = this.existingDeclaration();
    let dto: CreateAvailabilityDto | null = null;
    try {
      const raw = buildConstraintDto(this.form.getRawValue() as ConstraintFormValue, this.date());
      dto = existing ? { ...raw, replacingId: existing.id } : raw;
      // Créer avant de supprimer : si la création échoue, l'ancienne déclaration est préservée.
      const result = await this.availabilitySvc.createDeclaration(dto);
      if (existing) await this.availabilitySvc.deleteDeclaration(existing.id);
      this.snack.open(this.theme.tone()['success.constraint_saved'], undefined, { duration: 3000 });
      this.saved.emit(result.created[0] ?? existing!);
    } catch (err) {
      if (err instanceof ConflictError && dto) {
        this.conflictData.set(err.conflicts);
        this.pendingConflictDto = dto;
        return;
      }
      this.error.set(this.theme.tone()['common.impossible_d_enregistrer_la_contrainte']);
    } finally {
      this.saving.set(false);
    }
  }

  /** L'utilisateur choisit d'écraser les déclarations conflictuelles. */
  protected async onConflictOverwrite(): Promise<void> {
    await this.resolveConflict('overwrite');
  }

  /** L'utilisateur choisit de garder l'existant en créant autour. */
  protected async onConflictKeep(): Promise<void> {
    await this.resolveConflict('keep');
  }

  /** L'utilisateur annule la création. */
  protected onConflictCancel(): void {
    this.conflictData.set(null);
    this.pendingConflictDto = null;
  }

  private async resolveConflict(resolution: 'overwrite' | 'keep'): Promise<void> {
    const dto = this.pendingConflictDto;
    if (!dto || this.saving()) return;
    this.conflictData.set(null);
    this.pendingConflictDto = null;
    this.saving.set(true);
    this.error.set(null);
    const existing = this.existingDeclaration();
    try {
      const result = await this.availabilitySvc.createDeclaration({
        ...dto,
        conflictResolution: resolution,
      });
      if (existing) await this.availabilitySvc.deleteDeclaration(existing.id);
      this.snack.open(this.theme.tone()['success.constraint_saved'], undefined, { duration: 3000 });
      this.saved.emit(result.created[0] ?? existing!);
    } catch {
      this.error.set(this.theme.tone()['common.impossible_d_enregistrer_la_contrainte']);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Suppression ─────────────────────────────────────────────────────────────

  protected onDeleteClick(): void {
    if (this.saving()) return;
    const existing = this.existingDeclaration();
    if (!existing) return;
    if (existing.recurKind === 'RECURRING') {
      this.splitDialogAction.set('delete');
    } else {
      void this.doDelete(existing);
    }
  }

  /** "Ce jour uniquement" depuis le dialog delete. */
  protected async onDeleteThisDay(): Promise<void> {
    if (this.saving()) return;
    this.splitDialogAction.set(null);
    this.saving.set(true);
    this.error.set(null);
    try {
      const existing = this.existingDeclaration()!;
      const occurrence = toISODate(this.date());
      await this.availabilitySvc.splitOccurrence(existing.id, { occurrence, action: 'delete' });
      this.deleted.emit();
    } catch {
      this.error.set(this.theme.tone()['calendar.constraint_occurrence_delete_error']);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * "De ce jour jusqu'à la fin" depuis le dialog delete.
   * Si l'occurrence est le premier jour de la série → soft-delete complet.
   * Sinon → tronque la série en posant endDate = D - 7 jours.
   */
  protected async onDeleteTail(): Promise<void> {
    if (this.saving()) return;
    this.splitDialogAction.set(null);
    const existing = this.existingDeclaration();
    if (!existing) return;
    const d = this.date();
    const occurrenceStr = toISODate(d);

    if (existing.startDate === occurrenceStr) {
      // Premier jour : supprime toute la série
      await this.doDelete(existing);
      return;
    }

    // Sinon : tronque — endDate = D - 7 (UTC pour rester cohérent avec le reste du codebase)
    const dMinus7 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 7));
    const dMinus7Str = toISODate(dMinus7);
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.availabilitySvc.updateDeclaration(existing.id, { endDate: dMinus7Str });
      this.deleted.emit();
    } catch {
      this.error.set(this.theme.tone()['calendar.constraint_modify_error']);
    } finally {
      this.saving.set(false);
    }
  }

  /** "Toute la série" depuis le dialog delete. */
  protected async onDeleteAll(): Promise<void> {
    if (this.saving()) return;
    this.splitDialogAction.set(null);
    const existing = this.existingDeclaration();
    if (existing) await this.doDelete(existing);
  }

  private async doDelete(existing: AvailabilityDeclarationDto): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.availabilitySvc.deleteDeclaration(existing.id);
      this.deleted.emit();
    } catch {
      this.error.set(this.theme.tone()['calendar.constraint_delete_error']);
    } finally {
      this.saving.set(false);
    }
  }

  protected recurLabel(recurKind: string): string {
    return RECUR_LABEL[recurKind] ?? recurKind;
  }
}
