import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../../../core/icons/app-icon';
import { ThemeToneService } from '../../../../core/theme/theme-tone.service';
import { NatureMarker } from '../../../../shared/nature-marker/nature-marker';

/** Une ligne « à créer » (Story 29.16) — croisement du signal `PERSONNAGE_A_CREER`
 *  (`PartySignalsService`) et de `MyPartiesService.allParties()`, assemblé par `MyCharacters`.
 *  Jamais recalculé ici : ce composant ne fait qu'afficher et diviser en pages. */
export interface CharacterCreationEntry {
  /** Nature de la ligne (Story 33.5) : `character` (défaut) mène au wizard de personnage,
   *  `hommeDragon` au parcours de création de l'Homme Dragon de la partie. */
  kind?: 'character' | 'hommeDragon';
  partieId: string;
  gameSystemId: string;
  partieName: string;
}

/** DESIGN.md §4/§7.3 : trois lignes visibles, puis divulgation « Voir les N autres ». */
const VISIBLE_COUNT = 3;

/**
 * Section « À forger » de l'écran « Personnages » (Story 29.16, FR-58) — une ligne par partie
 * éligible, jamais une carte de personnage (bordure pointillée, cf. scss). Composant standalone
 * dédié pour isoler l'affichage et la divulgation 3→N, testable seul (cf. Code Map de la story).
 * N'est rendu que non vide — ni titre ni cadre sinon (EXPERIENCE.md §4.3).
 */
@Component({
  selector: 'app-character-creation-entries',
  imports: [RouterLink, AppIcon, NatureMarker],
  templateUrl: './character-creation-entries.html',
  styleUrl: './character-creation-entries.scss',
})
export class CharacterCreationEntries {
  protected readonly theme = inject(ThemeToneService);

  readonly entries = input.required<CharacterCreationEntry[]>();

  /** Divulgation 3→N (patron du signal d'expansion de `RosterRail`, roster-rail.ts:39,55). */
  protected readonly expanded = signal(false);

  protected readonly visibleEntries = computed(() =>
    this.expanded() ? this.entries() : this.entries().slice(0, VISIBLE_COUNT),
  );

  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.entries().length - VISIBLE_COUNT),
  );

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  /** Même mécanique `.replace()` (remplaceur sous forme de fonction) que
   *  `character.equipment_group_toggle` ailleurs dans l'app — jamais une réimplémentation locale
   *  du remplacement de gabarit. Repli `?? entry.partieId` (même patron défensif que
   *  `MyCharacters.sortLabel()`, `my-characters.ts`) : une clé de thème manquante ne doit jamais
   *  faire planter le rendu, même si la parité ×3 thèmes est déjà couverte par un test dédié. */
  protected entryLabel(entry: CharacterCreationEntry): string {
    const key =
      entry.kind === 'hommeDragon' ? 'my_characters.create_entry_hd' : 'my_characters.create_entry';
    const template = this.theme.tone()[key] ?? '{partie}';
    return template.replace('{partie}', () => entry.partieName);
  }

  /** Cible de la ligne : wizard de personnage, ou fiche/parcours de création de l'Homme Dragon. */
  protected entryLink(entry: CharacterCreationEntry): string[] {
    return entry.kind === 'hommeDragon'
      ? ['/parties', entry.partieId, 'homme-dragon']
      : ['/parties', entry.partieId, 'characters', 'new'];
  }

  /** Les deux natures de ligne peuvent viser une même partie : la clé de suivi les distingue. */
  protected trackKey(entry: CharacterCreationEntry): string {
    return `${entry.kind ?? 'character'}:${entry.partieId}`;
  }

  /** Une seule partie masquée : gabarit singulier dédié (`create_more_one`, sans `{n}`) — « Voir
   *  les 1 autres » est un français incorrect que le pluriel générique produirait sinon. */
  protected moreLabel(): string {
    if (this.hiddenCount() === 1) {
      return this.theme.tone()['my_characters.create_more_one'] ?? '';
    }
    const template = this.theme.tone()['my_characters.create_more'] ?? 'Voir les {n} autres';
    return template.replace('{n}', () => String(this.hiddenCount()));
  }
}
