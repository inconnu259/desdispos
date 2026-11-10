import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CharacterDto, XpDistributionDto } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { characterName } from '../../../core/characters/character.util';
import { IdentityLabel } from '../../../shared/identity/identity-label';

interface DistributionRow {
  distribution: XpDistributionDto;
  total: number;
  entries: {
    characterLabel: string | null;
    playerLabel: string;
    amount: number;
    isBonus: boolean;
  }[];
}

@Component({
  selector: 'app-xp-history',
  standalone: true,
  imports: [DatePipe, IdentityLabel],
  templateUrl: './xp-history.html',
  styleUrl: './xp-history.scss',
})
export class XpHistory {
  protected readonly theme = inject(ThemeToneService);

  readonly distributions = input.required<XpDistributionDto[]>();
  /** Résolution du nom narratif du personnage (`characterId` → nom, s'il en a un). L'identité du
   *  joueur (`ownerDisplayName`) est désormais portée directement par chaque entrée (AD-2, Story
   *  28.2) — plus besoin de la reconstruire via `PartieMemberDto`. */
  readonly characters = input.required<CharacterDto[]>();

  private readonly characterById = computed(() => new Map(this.characters().map((c) => [c.id, c])));

  /** Déjà triées par le backend (`createdAt desc`) — pas de re-tri côté client. */
  protected readonly rows = computed<DistributionRow[]>(() =>
    this.distributions().map((d) => ({
      distribution: d,
      total: d.entries.reduce((sum, e) => sum + e.amount, 0),
      entries: d.entries.map((e) => ({
        characterLabel: this.characterLabelFor(e.characterId),
        playerLabel: e.ownerDisplayName,
        amount: e.amount,
        isBonus: e.isBonus,
      })),
    })),
  );

  /** Toujours un libellé, jamais `null` : deux personnages sans nom appartenant au même joueur
   *  produisaient sinon deux lignes strictement identiques (même nom de joueur, montants
   *  différents), sans aucun moyen de savoir lequel avait reçu quoi — et un personnage non chargé
   *  se déguisait silencieusement en ligne « joueur seul » (revue de code 28.2). */
  private characterLabelFor(characterId: string): string {
    const character = this.characterById().get(characterId);
    if (!character) return this.theme.tone()['parties.xp_history_unknown_character'];
    return characterName(character);
  }
}
