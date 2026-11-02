import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppIcon } from '../../../core/icons/app-icon';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';

/** Un créneau du lot en conflit avec une déclaration persistée. Plusieurs entrées peuvent
 *  porter le MÊME `batchIndex` (un créneau peut heurter deux déclarations) : le défilé les
 *  regroupe, une décision ne portant que sur un créneau (AC3).
 *  ⚠️ Distinct de `ConflictEntry` (`core/availability/availability.service.ts`), qui porte la
 *  forme brute renvoyée par le serveur : celui-ci est la forme déjà résolue en libellé
 *  affichable, construite par `CalendarView` avant l'ouverture du dialogue. */
export interface ConflictSlotLabel {
  batchIndex: number;
  /** Libellé lisible du créneau — c'est lui que le dialogue NOMME (AC2). */
  label: string;
}

export interface ConflictDialogData {
  /** La valeur que le geste déclare. Le dialogue en tire lui-même les mots (accord, ordre des mots) du
   *  registre de ton : l'appelant ne lui passe plus un libellé tout fait, que le dialogue accordait
   *  en y collant un “s”. */
  kind: 'AVAILABLE' | 'UNAVAILABLE';
  /** L'intention du geste, rappelée sous le titre : « du 3 au 9 août, le soir ». */
  intentLabel: string;
  conflicts: ConflictSlotLabel[];
  /** Nombre de créneaux du lot SANS conflit, pour dire ce qu'il advient d'eux. */
  freeCount: number;
  /** Créneaux couverts par une séance : ligne d'exception, jamais une option (AC11). */
  seanceExceptions: string[];
}

/** Décision par créneau, indexée par `batchIndex`. `null` = abandon, rien n'est écrit. */
export type ConflictResolutionByIndex = Record<number, 'overwrite' | 'keep'>;

/**
 * Dialogue de résolution de conflits sur l'écriture groupée (Story 36.4, dérogation D-18).
 *
 * Il ne connaît AUCUN service HTTP, volontairement : « Au cas par cas » est un parcours
 * entièrement client qui compose des décisions et les rend à son appelant, lequel n'émet
 * qu'UN SEUL appel à la fin (AC10). Un appel par décision reproduirait le fan-out que tout
 * le palier combat, et serait le seul endroit où le limiteur de débit redeviendrait un sujet.
 *
 * Il ne réutilise pas le bloc « Écraser / Garder l'existant » inline de `ConstraintPanel` :
 * celui-ci n'a ni rôle de dialogue, ni piège de focus, ni région live. C'est le contre-exemple,
 * pas le modèle. Le vocabulaire suivi est celui du contrat d'UI (Remplacer / Conserver / Au cas
 * par cas), le panneau gardant le sien.
 */
@Component({
  selector: 'app-conflict-dialog',
  imports: [MatDialogModule, MatButtonModule, AppIcon],
  templateUrl: './conflict-dialog.html',
  styleUrl: './conflict-dialog.scss',
})
export class ConflictDialog {
  private readonly dialogRef =
    inject<MatDialogRef<ConflictDialog, ConflictResolutionByIndex | null>>(MatDialogRef);
  protected readonly data = inject<ConflictDialogData>(MAT_DIALOG_DATA);
  protected readonly theme = inject(ThemeToneService);

  /** `false` tant que les trois issues sont proposées, `true` pendant le défilé (AC3). */
  protected readonly walking = signal(false);
  protected readonly stepIndex = signal(0);
  private readonly decisions = signal<ConflictResolutionByIndex>({});

  /** Un créneau par décision : deux conflits sur le même créneau n'en demandent qu'une (AC3). */
  protected readonly steps = computed<ConflictSlotLabel[]>(() => {
    const seen = new Set<number>();
    return this.data.conflicts.filter((c) => {
      if (seen.has(c.batchIndex)) return false;
      seen.add(c.batchIndex);
      return true;
    });
  });

  /** Les libellés, dédoublonnés, dans l'ordre du lot — ce que chaque choix nomme. */
  protected readonly conflictLabels = computed(() => this.steps().map((s) => s.label));

  protected readonly title = computed(() => {
    const n = this.steps().length;
    const key = n === 1 ? 'calendar.conflict_title_one' : 'calendar.conflict_title_many';
    return fillTone(this.theme.tone()[key], { n });
  });

  /** Le mot de la valeur déclarée (« disponible » / « indisponible »), invariable : il s'insère dans
   *  « Vous déclarez … », « passent en … » et « redevenez … ». */
  protected readonly kindWord = computed(
    () =>
      this.theme.tone()[
        this.data.kind === 'AVAILABLE'
          ? 'calendar.conflict_kind_available'
          : 'calendar.conflict_kind_unavailable'
      ],
  );

  /** Tête de l'issue « Remplacer », phrase entière : l'accord (« devient » / « deviennent », « disponible » /
   *  « disponibles ») et l'ordre des mots vivent dans le registre, une clé par cas. */
  protected readonly overwriteLead = computed(() => {
    const n = this.steps().length;
    const kind = this.data.kind === 'AVAILABLE' ? 'available' : 'unavailable';
    const key = `calendar.conflict_overwrite_${kind}_${n === 1 ? 'one' : 'many'}`;
    return fillTone(this.theme.tone()[key], { n });
  });

  /** Issue « Conserver » : « Ce créneau reste comme il est » / « Ces 3 restent comme ils sont ». */
  protected readonly keepLead = computed(() => {
    const n = this.steps().length;
    const key = n === 1 ? 'calendar.conflict_keep_one' : 'calendar.conflict_keep_many';
    return fillTone(this.theme.tone()[key], { n });
  });

  /** Ce qu'il advient des créneaux du lot sans conflit (affiché dès qu'il y en a au moins un). */
  protected readonly freeLabel = computed(() => {
    const n = this.data.freeCount;
    const key = n === 1 ? 'calendar.conflict_free_one' : 'calendar.conflict_free_many';
    return fillTone(this.theme.tone()[key], { n, kind: this.kindWord() });
  });

  protected readonly walkthroughCount = computed(() => {
    const n = this.steps().length;
    const key =
      n > 1
        ? 'calendar.conflict_walkthrough_count_many'
        : 'calendar.conflict_walkthrough_count_one';
    return fillTone(this.theme.tone()[key], { n });
  });

  /** Verbe de la ligne d'exception, accordé avec le nombre de séances. */
  protected readonly exceptionVerb = computed(() => {
    const key =
      this.data.seanceExceptions.length > 1
        ? 'calendar.conflict_exception_many'
        : 'calendar.conflict_exception_one';
    return this.theme.tone()[key];
  });

  protected readonly exceptionDetail = computed(() =>
    fillTone(this.theme.tone()['calendar.conflict_exception_detail'], {
      kind: this.kindWord(),
    }),
  );

  protected readonly currentStep = computed(() => this.steps()[this.stepIndex()]);

  protected readonly progressLabel = computed(() =>
    fillTone(this.theme.tone()['calendar.util_counter'], {
      n: this.stepIndex() + 1,
      total: this.steps().length,
    }),
  );

  /** Annonce en toutes lettres : le compteur seul ne dit pas de QUEL créneau il s'agit (AC15). */
  protected readonly stepAnnouncement = computed(() => {
    const step = this.currentStep();
    if (!step) return '';
    return fillTone(this.theme.tone()['calendar.conflict_step_announcement'], {
      progress: this.progressLabel(),
      label: step.label,
    });
  });

  protected onChoose(resolution: 'overwrite' | 'keep'): void {
    const all: ConflictResolutionByIndex = {};
    for (const step of this.steps()) all[step.batchIndex] = resolution;
    this.dialogRef.close(all);
  }

  protected onWalkthrough(): void {
    this.walking.set(true);
    this.stepIndex.set(0);
    this.decisions.set({});
  }

  protected onStepDecision(resolution: 'overwrite' | 'keep'): void {
    const step = this.currentStep();
    if (!step) return;
    const next = { ...this.decisions(), [step.batchIndex]: resolution };
    this.decisions.set(next);

    // Rien n'est écrit tant que le défilé n'est pas terminé : la dernière décision seule
    // referme le dialogue et rend le lot complet à l'appelant (AC10).
    if (this.stepIndex() + 1 >= this.steps().length) {
      this.dialogRef.close(next);
      return;
    }
    this.stepIndex.update((i) => i + 1);
  }

  /** Abandon — y compris en cours de défilé : aucune des décisions déjà prises n'est rendue. */
  protected onCancel(): void {
    this.dialogRef.close(null);
  }
}
