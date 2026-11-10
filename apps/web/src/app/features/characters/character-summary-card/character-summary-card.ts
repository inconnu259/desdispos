import { Component, computed, inject, input, output } from '@angular/core';
import type { CharacterDto, ListViewMode, MyHommeDragonDto } from '@desdispos/shared';
import { characterName } from '../../../core/characters/character.util';
import { CharacterAvatar } from '../character-avatar/character-avatar';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { NatureMarker } from '../../../shared/nature-marker/nature-marker';
import { hommeDragonName } from '../../../core/homme-dragon/homme-dragon.util';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { pendingLevelsLocal } from '../character-sheet/level-thresholds';

// `CharacterAvatar.size` n'accepte qu'une union fermée (26|38|44|64) — 26 est la plus petite
// taille disponible, retenue pour le mode compact.
const AVATAR_SIZE_BY_DENSITY: Record<ListViewMode, 26 | 44 | 64> = {
  large: 64,
  medium: 44,
  compact: 26,
};

@Component({
  selector: 'app-character-summary-card',
  standalone: true,
  imports: [CharacterAvatar, IdentityLabel, NatureMarker],
  templateUrl: './character-summary-card.html',
  styleUrl: './character-summary-card.scss',
  host: {
    '[class.character-summary-card--large]': "density() === 'large'",
    '[class.character-summary-card--compact]': "density() === 'compact'",
  },
})
export class CharacterSummaryCard {
  protected readonly theme = inject(ThemeToneService);

  /** Personnage affiché. Absent quand la carte porte un Homme Dragon (`hommeDragon`, Story 33.5) :
   *  exactement l'un des deux est fourni. Tous les sites d'appel existants fournissent `character`. */
  readonly character = input<CharacterDto | null>(null);
  /** Homme Dragon du MJ (Story 33.5) — même carte, même densité, avec un `NatureMarker` ; ni
   *  pastille de niveau, ni bulle de montée de niveau, ni statistiques. `null` par défaut :
   *  n'affecte aucun site d'appel existant. */
  readonly hommeDragon = input<MyHommeDragonDto | null>(null);
  readonly className = input<string>('');
  /** N'affiche le badge MJ/pseudo que si le **viewer** est le MJ — jamais pour un joueur (AC3). */
  readonly showOwnerInfo = input(false);
  /** Nom de la Partie d'origine (Story 29.2, AC3) — optionnel, `null` par défaut : n'affecte aucun
   *  des sites d'appel existants (roster, xp-history, partie-detail, scenario-editor…). */
  readonly partieName = input<string | null>(null);
  /** Densité d'affichage (Story 29.9, AC1) — `medium` par défaut : n'affecte aucun site d'appel
   *  existant qui ne la câble pas (roster, xp-history, partie-detail, scenario-editor…). */
  readonly density = input<ListViewMode>('medium');
  /** Libellé de type (Story 29.9) — même statut que `className` (résolu par l'appelant), `null`
   *  par défaut : n'affecte aucun site d'appel existant. */
  readonly typeLabel = input<string | null>(null);
  /** Libellé du rôle de groupe assigné (Story 29.9), `null` par défaut. */
  readonly groupRoleLabel = input<string | null>(null);
  /** Retour utilisateur (Story 29.9) : les stats PV/PE/Initiative/Encombrement n'ont aucune
   *  pertinence sur une liste de sélection (`MyCharacters`) — `true` par défaut pour préserver tous
   *  les sites d'appel existants (roster, xp-history, scenario-editor…) qui en dépendent. */
  readonly showStats = input<boolean>(true);
  /** Distinct de `showOwnerInfo` (qui affiche à un *viewer* de quel joueur est ce personnage) :
   *  ce marqueur signale au *propriétaire* que CE personnage est celui qu'il incarne en tant que
   *  MJ de sa Partie (`MyCharacters`, où mélanger les deux mécanismes afficherait son propre nom
   *  de joueur en boucle sur ses personnages de joueur). `false` par défaut. */
  readonly showMjMarker = input<boolean>(false);

  readonly selected = output<void>();

  protected readonly name = computed(() => {
    const dragon = this.hommeDragon();
    if (dragon) return hommeDragonName(dragon.nom);
    const character = this.character();
    return character ? characterName(character) : '';
  });
  protected readonly avatarSize = computed(() => AVATAR_SIZE_BY_DENSITY[this.density()]);
  /** Gabarit « Niv. {n} » — même patron `.replace()` que `Dashboard.moreLabel()`. */
  protected readonly levelLabel = computed(() =>
    this.theme
      .tone()
      ['character.level_badge'].replace('{n}', String(this.character()?.level ?? '')),
  );

  /** Sous-ligne unique du mode liste (Story 29.9, retour utilisateur) — « Classe · Partie ».
   *  Les deux repères sont conservés en compact ; le type et le rôle de groupe restent réservés aux
   *  modes moyen/grand, où ils tiennent sans écraser le nom. */
  protected readonly compactSubtitle = computed(() =>
    [this.className(), this.partieName()].filter((part): part is string => !!part).join(' · '),
  );

  protected readonly hasPendingLevelUp = computed(() => {
    const c = this.character();
    if (!c) return false;
    const appliedCount = ((c.sheetData as any)?.levelUps?.length as number | undefined) ?? 0;
    return pendingLevelsLocal(c.xp, appliedCount).length > 0;
  });

  protected onClick(): void {
    this.selected.emit();
  }
}
