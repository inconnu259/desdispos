import { Component, computed, inject, input, output } from '@angular/core';
import type { ContentEntryDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../../../core/theme/theme-tone.service';
import { DetailSurface } from '../../../../../shared/detail-surface/detail-surface';
import {
  createDetailSurfaceHost,
  detailContent,
} from '../../../../../shared/detail-surface/detail-surface-host';
import { firstSentence } from '../../choice-card/card-subtitle';
import { ChoiceCard, type ChoiceCardOption } from '../../choice-card/choice-card';
import { ChoiceDetail } from '../../choice-card/choice-detail';
import { RadioGroupNavDirective } from '../../choice-card/radio-group-nav.directive';

interface TypeAdvantage {
  name: string;
  effect: string;
}

interface TypeData {
  label: string;
  description: string;
  advantages: TypeAdvantage[];
}

@Component({
  selector: 'app-type-step',
  standalone: true,
  imports: [ChoiceCard, ChoiceDetail, RadioGroupNavDirective, DetailSurface],
  templateUrl: './type-step.html',
  styleUrl: './type-step.scss',
})
export class TypeStep {
  readonly types = input.required<ContentEntryDto[]>();
  readonly typeId = input<string | undefined>();

  /** `undefined` = le type est DÉSÉLECTIONNÉ (re-toucher la carte déployée, piste B). */
  readonly typeIdChange = output<string | undefined>();

  protected readonly theme = inject(ThemeToneService);

  /** Aide contextuelle sur les termes de règle (FR-19) — même surface partagée que la fiche. */
  protected readonly detail = createDetailSurfaceHost();
  /** Règle AC3 : pas de texte au catalogue ⇒ pas de déclencheur. */
  protected readonly help = detailContent;

  protected readonly options = computed<ChoiceCardOption[]>(() =>
    this.types().map((entry) => {
      const data = entry.data as TypeData;
      return {
        key: entry.key,
        label: data.label,
        detail: firstSentence(data.description),
      };
    }),
  );

  protected readonly selectedTypeData = computed<TypeData | null>(() => {
    const entry = this.types().find((t) => t.key === this.typeId());
    return entry ? (entry.data as TypeData) : null;
  });

  /** Re-toucher le type déjà choisi le désélectionne : la carte déployée se referme. */
  protected onSelect(key: string): void {
    this.typeIdChange.emit(key === this.typeId() ? undefined : key);
  }
}
