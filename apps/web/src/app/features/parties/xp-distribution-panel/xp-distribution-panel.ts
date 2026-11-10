import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { CharacterDto, CreateXpDistributionDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { fillTone } from '../../../core/theme/tone-format';
import { PartiesService } from '../../../core/parties/parties.service';
import { characterName } from '../../../core/characters/character.util';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { RulesReminder } from './rules-reminder';

/**
 * Seuils XP bruts dupliqués depuis `packages/game-rules/src/ryuutama/leveling.ts` (LEVEL_TABLE) —
 * ce package est Node-only, jamais importé côté Angular (cf. Dev Notes Story 6.2). Seuls les
 * nombres sont dupliqués ici, pas la logique de capacités : l'avertissement (AC5) est indicatif
 * seulement, jamais bloquant — une imprécision mineure ici n'a aucune conséquence fonctionnelle.
 */
const LEVEL_THRESHOLDS = [100, 600, 1200, 2000, 3000, 4200, 5800, 7500, 10000];

function crossesThreshold(currentXp: number, gained: number): boolean {
  return LEVEL_THRESHOLDS.some((t) => currentXp < t && currentXp + gained >= t);
}

/** Table 100/200/300/500 selon la difficulté max du voyage (cf. FR-2, RulesReminder). */
function suggestedFromDifficulty(difficulty: number | null): number {
  if (difficulty === null) return 0;
  if (difficulty <= 3) return 100;
  if (difficulty <= 7) return 200;
  if (difficulty <= 10) return 300;
  return 500;
}

interface XpRow {
  characterId: string;
  included: boolean;
  amount: number;
  bonus: number;
  manuallyEdited: boolean;
}

@Component({
  selector: 'app-xp-distribution-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    RulesReminder,
    IdentityLabel,
  ],
  templateUrl: './xp-distribution-panel.html',
  styleUrl: './xp-distribution-panel.scss',
})
export class XpDistributionPanel {
  protected readonly theme = inject(ThemeToneService);
  protected readonly fillTone = fillTone;
  private readonly parties = inject(PartiesService);

  readonly partieId = input.required<string>();
  readonly characters = input.required<CharacterDto[]>();

  readonly distributed = output<void>();

  protected readonly difficulty = signal<number | null>(null);
  protected readonly breaths = signal(0);
  protected readonly monsterLevel = signal(0);
  protected readonly note = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  private readonly rowsByCharacterId = signal<Map<string, XpRow>>(new Map());

  protected readonly characterName = characterName;

  protected readonly suggestedAmount = computed(
    () =>
      suggestedFromDifficulty(this.difficulty()) + 50 * this.breaths() + 10 * this.monsterLevel(),
  );

  /** Une ligne par personnage — initialisée à 0 XP par défaut (AC1), ré-appliquée si un nouveau
   *  personnage apparaît dans la liste (le panneau ne perd jamais les montants déjà saisis). */
  protected readonly rows = computed<XpRow[]>(() => {
    const map = this.rowsByCharacterId();
    return this.characters().map(
      (c) =>
        map.get(c.id) ?? {
          characterId: c.id,
          included: true,
          amount: 0,
          bonus: 0,
          manuallyEdited: false,
        },
    );
  });

  /** Paires personnage+ligne, dans l'ordre de `characters()` — évite un double `@for` dans le template. */
  protected readonly rowsWithCharacter = computed(() => {
    const rowByCharacterId = new Map(this.rows().map((r) => [r.characterId, r]));
    return this.characters().map((character) => ({
      character,
      row: rowByCharacterId.get(character.id)!,
    }));
  });

  constructor() {
    effect(() => {
      const chars = this.characters();
      const current = this.rowsByCharacterId();
      let changed = false;
      const next = new Map(current);
      for (const c of chars) {
        if (!next.has(c.id)) {
          next.set(c.id, {
            characterId: c.id,
            included: true,
            amount: 0,
            bonus: 0,
            manuallyEdited: false,
          });
          changed = true;
        }
      }
      if (changed) this.rowsByCharacterId.set(next);
    });
  }

  private updateRow(characterId: string, patch: Partial<XpRow>): void {
    const next = new Map(this.rowsByCharacterId());
    const existing = next.get(characterId) ?? {
      characterId,
      included: true,
      amount: 0,
      bonus: 0,
      manuallyEdited: false,
    };
    next.set(characterId, { ...existing, ...patch });
    this.rowsByCharacterId.set(next);
  }

  /** Applique le montant suggéré à toutes les lignes non éditées manuellement (jamais celles déjà ajustées à la main). */
  private applySuggested(): void {
    const suggested = this.suggestedAmount();
    const next = new Map(this.rowsByCharacterId());
    for (const row of this.rows()) {
      if (!row.manuallyEdited) next.set(row.characterId, { ...row, amount: suggested });
    }
    this.rowsByCharacterId.set(next);
  }

  protected setDifficulty(value: string): void {
    const n = value === '' ? null : Number(value);
    // Une difficulté négative n'a pas de sens dans la table de calcul (FR-2) — traitée comme
    // non renseignée plutôt que de produire un montant suggéré trompeur (ex. -5 → 100 XP).
    this.difficulty.set(n !== null && Number.isFinite(n) && n >= 0 ? n : null);
    this.applySuggested();
  }

  protected setBreaths(value: string): void {
    this.breaths.set(Number(value) || 0);
    this.applySuggested();
  }

  protected setMonsterLevel(value: string): void {
    this.monsterLevel.set(Number(value) || 0);
    this.applySuggested();
  }

  protected setAmount(characterId: string, value: string): void {
    this.updateRow(characterId, { amount: Number(value) || 0, manuallyEdited: true });
  }

  protected setBonus(characterId: string, value: string): void {
    // Clampé à 0 : un bonus négatif saisi par erreur ne doit ni être silencieusement ignoré à la
    // soumission (cf. `submit()`, qui n'ajoute une entrée bonus que si `bonus > 0`) ni réduire l'XP.
    this.updateRow(characterId, { bonus: Math.max(0, Number(value) || 0) });
  }

  protected toggleIncluded(characterId: string): void {
    const row = this.rows().find((r) => r.characterId === characterId);
    if (row) this.updateRow(characterId, { included: !row.included });
  }

  protected willLevelUp(character: CharacterDto, row: XpRow): boolean {
    return crossesThreshold(character.xp, row.amount + row.bonus);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const included = this.rows().filter((r) => r.included);
    if (included.length === 0) {
      this.submitError.set(this.theme.tone()['parties.xp_select_one_error']);
      return;
    }

    const entries: CreateXpDistributionDto['entries'] = [];
    for (const row of included) {
      entries.push({ characterId: row.characterId, amount: row.amount });
      if (row.bonus > 0) {
        entries.push({ characterId: row.characterId, amount: row.bonus, isBonus: true });
      }
    }

    this.submitting.set(true);
    this.submitError.set(null);
    try {
      await this.parties.createXpDistribution(this.partieId(), {
        difficulty: this.difficulty() ?? undefined,
        breaths: this.breaths() || undefined,
        monsterLevel: this.monsterLevel() || undefined,
        note: this.note().trim() || undefined,
        entries,
      });
      this.distributed.emit();
    } catch {
      this.submitError.set(this.theme.tone()['parties.xp_distribute_error']);
    } finally {
      this.submitting.set(false);
    }
  }
}
