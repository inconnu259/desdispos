import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { CharacterDto, GameSystemContentDto } from '@master-jdr/shared';
import { CharacterService } from '../../../../core/characters/character.service';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { fillTone } from '../../../../core/theme/tone-format';
import { ChoiceCard, type ChoiceCardOption } from '../../character-wizard/choice-card/choice-card';
import {
  LEVEL_TABLE_LOCAL,
  pendingLevelsLocal,
  type CapabilityTypeLocal,
} from '../level-thresholds';

export interface LevelUpWizardData {
  character: CharacterDto;
  content: GameSystemContentDto | null;
}

const ATTRIBUTE_KEYS = ['AGI', 'ESP', 'INT', 'VIG'] as const;

/** Mapping type de capacité → clé de contenu data-driven seedé (`GameSystemContentDto`). */
const CONTENT_KEY_BY_CAPABILITY: Partial<Record<CapabilityTypeLocal, string>> = {
  landscape: 'landscape',
  class: 'class',
  immunity: 'immunityState',
  type: 'type',
  'dragon-protection': 'season',
};

@Component({
  selector: 'app-level-up-wizard',
  standalone: true,
  imports: [MatButtonModule, ChoiceCard],
  templateUrl: './level-up-wizard.html',
  styleUrl: './level-up-wizard.scss',
})
export class LevelUpWizard {
  private readonly characterSvc = inject(CharacterService);
  protected readonly theme = inject(ThemeToneService);
  private readonly dialogRef =
    inject<MatDialogRef<LevelUpWizard, CharacterDto | null>>(MatDialogRef);
  private readonly dialogData = inject<LevelUpWizardData>(MAT_DIALOG_DATA);

  protected readonly ATTRIBUTE_KEYS = ATTRIBUTE_KEYS;

  private readonly character = signal<CharacterDto>(this.dialogData.character);
  protected readonly content = signal<GameSystemContentDto | null>(this.dialogData.content);

  private readonly appliedCount = computed(
    () => ((this.character().sheetData as any)?.levelUps?.length as number | undefined) ?? 0,
  );

  /**
   * Recalculé à chaque mise à jour de `character()` (après chaque appel `levelUp()` réussi) —
   * l'entrée déjà appliquée n'y figure plus, donc toujours prendre `pendingLevels()[0]` comme
   * niveau courant (pas d'index qui pointerait hors-tableau après rétrécissement de la liste).
   */
  protected readonly pendingLevels = computed(() =>
    pendingLevelsLocal(this.character().xp, this.appliedCount()),
  );

  /** Capturé une seule fois à l'ouverture — sert de dénominateur pour la barre de progression. */
  private readonly initialPendingCount = this.pendingLevels().length;
  protected readonly totalSteps = this.initialPendingCount;
  /** Indices fixes des segments de progression (jamais recalculé) — cf. `currentStepNumber`. */
  protected readonly progressSteps = Array.from({ length: this.totalSteps }, (_, i) => i);
  protected readonly currentStepNumber = computed(
    () => this.initialPendingCount - this.pendingLevels().length + 1,
  );

  protected readonly currentLevel = computed(() => this.pendingLevels()[0] ?? null);

  /** Toutes les capacités octroyées à ce niveau (Attribut ET spéciale aux niveaux 4/6/10). */
  protected readonly capabilityTypes = computed<CapabilityTypeLocal[]>(() => {
    const level = this.currentLevel();
    if (level === null) return [];
    return LEVEL_TABLE_LOCAL.find((entry) => entry.level === level)?.capabilities ?? [];
  });

  /** Ce niveau accorde-t-il un point d'attribut (à répartir dans la grille) ? */
  protected readonly attributeRequired = computed(() =>
    this.capabilityTypes().includes('attribute'),
  );

  /** Capacité spéciale (non-Attribut) du niveau, si présente — au plus une par niveau. */
  protected readonly specialType = computed<CapabilityTypeLocal | null>(
    () => this.capabilityTypes().find((t) => t !== 'attribute') ?? null,
  );

  protected readonly pvAllocated = signal(0);
  protected readonly peAllocated = signal(0);
  protected readonly selectedAttribute = signal<string | null>(null);
  protected readonly selectedContentKey = signal<string | null>(null);

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly attributes = computed(
    () => this.character().sheetData['attributes'] as Record<string, number> | undefined,
  );

  protected readonly contentOptionsForSpecialType = computed<ChoiceCardOption[]>(() => {
    const type = this.specialType();
    if (!type) return [];
    const key = CONTENT_KEY_BY_CAPABILITY[type];
    if (!key) return [];
    const entries = this.content()?.[key] ?? [];
    return entries.map((e) => ({
      key: e.key,
      label: ((e.data as { label?: string })?.label ?? e.key) as string,
    }));
  });

  protected readonly canSubmit = computed(() => {
    if (this.pvAllocated() + this.peAllocated() !== 3) return false;
    if (this.attributeRequired() && !this.selectedAttribute()) return false;
    const special = this.specialType();
    if (special && special !== 'legendary-journey' && !this.selectedContentKey()) return false;
    return true;
  });

  constructor() {
    this.resetStep();
  }

  private resetStep(): void {
    this.pvAllocated.set(0);
    this.peAllocated.set(0);
    this.selectedAttribute.set(null);
    this.selectedContentKey.set(null);
  }

  /** Suffixe du titre (« — Niveau N »), lu du registre pour suivre le thème. */
  protected levelTitleSuffix(level: number): string {
    return fillTone(this.theme.tone()['characters_sheet.levelup_title_level'], { level });
  }

  /** aria-label des boutons − / + d'une statistique (le nom de la statistique reste un libellé de fiche). */
  protected statAria(direction: 'decrease' | 'increase', stat: string): string {
    const key =
      direction === 'decrease'
        ? 'characters_sheet.levelup_decrease_aria'
        : 'characters_sheet.levelup_increase_aria';
    return fillTone(this.theme.tone()[key], { stat });
  }

  protected isAttributeDisabled(attr: string): boolean {
    const value = this.attributes()?.[attr] ?? 0;
    if (value < 12) return false;
    return ATTRIBUTE_KEYS.some((a) => (this.attributes()?.[a] ?? 0) < 12);
  }

  protected incrementPv(): void {
    if (this.pvAllocated() + this.peAllocated() >= 3) return;
    this.pvAllocated.update((v) => v + 1);
  }

  protected decrementPv(): void {
    if (this.pvAllocated() <= 0) return;
    this.pvAllocated.update((v) => v - 1);
  }

  protected incrementPe(): void {
    if (this.pvAllocated() + this.peAllocated() >= 3) return;
    this.peAllocated.update((v) => v + 1);
  }

  protected decrementPe(): void {
    if (this.peAllocated() <= 0) return;
    this.peAllocated.update((v) => v - 1);
  }

  protected selectAttribute(attr: string): void {
    if (this.isAttributeDisabled(attr)) return;
    this.selectedAttribute.set(attr);
  }

  protected selectContentKey(key: string): void {
    this.selectedContentKey.set(key);
  }

  protected async confirm(): Promise<void> {
    if (this.submitting() || !this.canSubmit()) return;

    const capabilities: { type: string; params: Record<string, unknown> }[] = [];
    if (this.attributeRequired()) {
      capabilities.push({ type: 'attribute', params: { attribute: this.selectedAttribute() } });
    }
    const special = this.specialType();
    if (special) {
      capabilities.push({
        type: special,
        params: special === 'legendary-journey' ? {} : { key: this.selectedContentKey() },
      });
    }

    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const updated = await this.characterSvc.levelUp(this.character().id, {
        pvAllocated: this.pvAllocated(),
        peAllocated: this.peAllocated(),
        capabilities,
      });
      this.character.set(updated);
      if (this.pendingLevels().length > 0) {
        this.resetStep();
      } else {
        this.dialogRef.close(updated);
      }
    } catch {
      this.submitError.set(this.theme.tone()['characters_sheet.levelup_save_error']);
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
