import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ContentEntryDto } from '@master-jdr/shared';
import { AppIcon } from '../../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  type DetailSurfaceContent,
} from '../../../../../shared/detail-surface/detail-surface-host';
import { talentDetail } from '../../../../../shared/detail-surface/talent-detail';
import { firstSentence } from '../../choice-card/card-subtitle';
import { ChoiceCard, type ChoiceCardOption } from '../../choice-card/choice-card';
import { ChoiceDetail } from '../../choice-card/choice-detail';
import { RadioGroupNavDirective } from '../../choice-card/radio-group-nav.directive';

interface ClassTalent {
  name: string;
  effect: { description: string; conditions: string };
  description: string;
  attributes?: string[];
  difficulty?: string;
}

export interface RequiredChoiceOption {
  value: string;
  label: string;
}

export type RequiredChoiceKind =
  'eligible-talent' | 'landscape-flavor' | 'closed-list' | 'landscape-capability';

export interface RequiredChoice {
  key: string;
  talentId: string;
  kind: RequiredChoiceKind;
  label: string;
  options?: RequiredChoiceOption[];
}

interface ClassData {
  label: string;
  description: string;
  talents: ClassTalent[];
  occupations: string[];
  actions: string[];
  requiresSpecialty?: boolean;
  specialtyLabel?: string;
  requiredChoices?: RequiredChoice[];
}

export interface ClassChoicePatch {
  key: string;
  value: string;
}

export interface ClassCapabilityPatch {
  key: string;
  landscapeKey: string;
}

@Component({
  selector: 'app-class-step',
  standalone: true,
  imports: [FormsModule, AppIcon, ChoiceCard, ChoiceDetail, RadioGroupNavDirective, DetailSurface],
  templateUrl: './class-step.html',
  styleUrl: './class-step.scss',
})
export class ClassStep {
  readonly classes = input.required<ContentEntryDto[]>();
  readonly classId = input<string | undefined>();
  readonly specialtyTypeId = input<string | undefined>();
  readonly landscapes = input<ContentEntryDto[]>([]);
  readonly classChoices = input<Record<string, string> | undefined>();
  readonly classCapabilities = input<
    { type: string; params: Record<string, unknown> }[] | undefined
  >();

  /** `undefined` = la classe est DÉSÉLECTIONNÉE (re-toucher la carte déployée, piste B). */
  readonly classIdChange = output<string | undefined>();
  readonly specialtyTypeIdChange = output<string>();
  readonly classChoiceChange = output<ClassChoicePatch>();
  readonly classCapabilityChange = output<ClassCapabilityPatch>();

  protected readonly theme = inject(ThemeToneService);

  /** Aide contextuelle sur les termes de règle (FR-19) — même surface partagée que la fiche. */
  protected readonly detail = createDetailSurfaceHost();

  /** Contenu structuré d'un talent (tableau mécanique + récit, DESIGN §7.2) — même fonction que la
   *  fiche. Sans donnée exploitable : `null`, donc aucun déclencheur (AC3 de la 31.3). */
  private talentContent(talent: ClassTalent | undefined): DetailSurfaceContent | null {
    const tone = this.theme.tone();
    return talentDetail(talent, {
      attributes: tone['detail.row_attributes'],
      difficulty: tone['detail.row_difficulty'],
      effect: tone['detail.row_effect'],
      conditions: tone['detail.row_conditions'],
    });
  }

  protected talentHelp(talent: ClassTalent): DetailSurfaceContent | null {
    return this.talentContent(talent);
  }

  /** Un choix de classe n'a pas d'entrée de catalogue propre : son texte est celui du talent
   *  parent, désigné par `talentId`. Sans talent résolu, aucun déclencheur (AC3). Le titre reste
   *  le libellé du CHOIX (« Métier d'appoint »), pas le nom du talent. */
  protected choiceHelp(choice: RequiredChoice): DetailSurfaceContent | null {
    const talent = (this.selectedClassData()?.talents ?? []).find(
      (t) => this.talentIdOf(t) === choice.talentId,
    );
    const content = this.talentContent(talent);
    const title = choice.label?.trim();
    return content && title ? { ...content, title } : null;
  }

  protected readonly options = computed<ChoiceCardOption[]>(() =>
    this.classes().map((entry) => {
      const data = entry.data as ClassData;
      return {
        key: entry.key,
        label: data.label,
        detail: firstSentence(data.description),
      };
    }),
  );

  protected readonly selectedClassData = computed<ClassData | null>(() => {
    const entry = this.classes().find((c) => c.key === this.classId());
    return entry ? (entry.data as ClassData) : null;
  });

  protected readonly isArtisan = computed(() => this.classId() === 'artisan');

  /** Talents éligibles à l'emprunt (Métier d'appoint) : toutes les classes sauf la sélectionnée, uniquement ceux impliquant un test. */
  protected readonly eligibleTalentOptions = computed<ChoiceCardOption[]>(() =>
    this.classes()
      .filter((entry) => entry.key !== this.classId())
      .flatMap((entry) => {
        const data = entry.data as ClassData;
        return data.talents
          .filter((t) => (t.attributes?.length ?? 0) > 0)
          .map((t) => ({
            key: `${entry.key}:${this.talentIdOf(t)}`,
            label: `${t.name} (${data.label})`,
          }));
      }),
  );

  protected readonly landscapeOptions = computed<ChoiceCardOption[]>(() =>
    this.landscapes().map((entry) => ({
      key: entry.key,
      label: (entry.data as { label?: string }).label ?? entry.key,
    })),
  );

  private talentIdOf(talent: ClassTalent): string {
    // `id` n'est pas typé dans `ClassTalent` (non nécessaire aux autres usages du composant),
    // mais est bien présent sur le contenu seedé depuis la Story 23.4.
    return (talent as unknown as { id: string }).id ?? talent.name;
  }

  protected optionsForChoice(choice: RequiredChoice): { key: string; label: string }[] {
    switch (choice.kind) {
      case 'eligible-talent':
        return this.eligibleTalentOptions();
      case 'landscape-flavor':
      case 'landscape-capability':
        return this.landscapeOptions();
      case 'closed-list':
        return (choice.options ?? []).map((o) => ({ key: o.value, label: o.label }));
      default:
        // Contenu seedé malformé (`kind` imprévu) — aucune option plutôt qu'un crash de rendu
        // sur le `@for` du template (revue de code, 2026-07-26).
        return [];
    }
  }

  protected valueForChoice(choice: RequiredChoice): string {
    if (choice.kind === 'landscape-capability') {
      return (this.classCapabilities()?.[0]?.params?.['key'] as string | undefined) ?? '';
    }
    return this.classChoices()?.[choice.key] ?? '';
  }

  /** Re-toucher la classe déjà choisie la désélectionne : la carte déployée se referme. */
  protected onSelect(key: string): void {
    this.classIdChange.emit(key === this.classId() ? undefined : key);
  }

  /** Classe pour laquelle « Occupations et actions » est déplié — dérivé de la classe (comme le récit
   *  de la surface de détail) : replié à CHAQUE nouvelle sélection, sans effet ni remise à zéro. */
  private readonly referenceOpenFor = signal<string | undefined>(undefined);
  protected readonly referenceOpen = computed(
    () => !!this.classId() && this.referenceOpenFor() === this.classId(),
  );

  protected toggleReference(): void {
    this.referenceOpenFor.set(this.referenceOpen() ? undefined : this.classId());
  }

  protected onSpecialtyInput(value: string): void {
    this.specialtyTypeIdChange.emit(value);
  }

  protected onChoiceInput(choice: RequiredChoice, value: string): void {
    if (choice.kind === 'landscape-capability') {
      this.classCapabilityChange.emit({ key: choice.key, landscapeKey: value });
    } else {
      this.classChoiceChange.emit({ key: choice.key, value });
    }
  }
}
