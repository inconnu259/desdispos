import { Component, computed, inject, input, output } from '@angular/core';
import type { ContentEntryDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  detailContent,
} from '../../../../../shared/detail-surface/detail-surface-host';
import { ChoiceCard, type ChoiceCardOption } from '../../choice-card/choice-card';
import { RadioGroupNavDirective } from '../../choice-card/radio-group-nav.directive';

const REQUIRED_RITUAL_SPELL_COUNT = 2;

interface SeasonData {
  label: string;
}

interface SpellData {
  name: string;
  magicType: string;
  tier: string;
  peCost: number;
  description: string;
}

/** Un sort rituel débutant candidat, prêt pour l'affichage (Story 23.9). */
export interface RitualSpellChoice {
  key: string;
  name: string;
  peCost: number;
  description: string;
}

@Component({
  selector: 'app-magic-step',
  standalone: true,
  imports: [ChoiceCard, RadioGroupNavDirective, DetailSurface],
  templateUrl: './magic-step.html',
  styleUrl: './magic-step.scss',
})
export class MagicStep {
  readonly seasons = input.required<ContentEntryDto[]>();
  readonly spells = input.required<ContentEntryDto[]>();
  readonly magicSeason = input<string | undefined>();
  readonly knownRitualSpells = input<string[] | undefined>();

  readonly magicSeasonChange = output<string>();
  readonly knownRitualSpellsChange = output<string[]>();

  protected readonly theme = inject(ThemeToneService);
  protected readonly requiredCount = REQUIRED_RITUAL_SPELL_COUNT;

  protected readonly seasonOptions = computed<ChoiceCardOption[]>(() =>
    this.seasons().map((entry) => ({
      key: entry.key,
      label: (entry.data as SeasonData).label,
    })),
  );

  /**
   * Uniquement les sorts de magie rituelle du palier Débutant (Story 23.9, AC1) — la magie des
   * saisons ne se choisit qu'au niveau de la saison elle-même (`magicSeason`), jamais sort par
   * sort (cf. Dev Notes de la story : ces sorts sont connus automatiquement).
   */
  protected readonly ritualSpellChoices = computed<RitualSpellChoice[]>(() =>
    this.spells()
      .filter((entry) => {
        const data = entry.data as SpellData;
        return data.magicType === 'rituelle' && data.tier === 'debutant';
      })
      .map((entry) => {
        const data = entry.data as SpellData;
        return {
          key: entry.key,
          name: data.name,
          peCost: data.peCost,
          description: data.description,
        };
      }),
  );

  /** Description de chaque sort : derrière la surface de détail (revue de code 31.4, AC2). */
  protected readonly detail = createDetailSurfaceHost();

  /** Aide d'un sort, ou `null` sans description (pas de texte ⇒ pas d'aide). */
  protected spellHelp(spell: RitualSpellChoice) {
    return detailContent(spell.name, spell.description);
  }

  protected isSpellSelected(key: string): boolean {
    return (this.knownRitualSpells() ?? []).includes(key);
  }

  /** Coche non sélectionnée désactivée une fois 2 sorts déjà choisis (contrainte UX « exactement 2 »). */
  protected isSpellDisabled(key: string): boolean {
    const selected = this.knownRitualSpells() ?? [];
    return selected.length >= REQUIRED_RITUAL_SPELL_COUNT && !selected.includes(key);
  }

  protected onSelectSeason(key: string): void {
    this.magicSeasonChange.emit(key);
  }

  protected onToggleSpell(key: string): void {
    const selected = this.knownRitualSpells() ?? [];
    if (selected.includes(key)) {
      this.knownRitualSpellsChange.emit(selected.filter((k) => k !== key));
      return;
    }
    if (selected.length >= REQUIRED_RITUAL_SPELL_COUNT) return;
    this.knownRitualSpellsChange.emit([...selected, key]);
  }
}
