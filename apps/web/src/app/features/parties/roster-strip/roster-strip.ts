import { Component, computed, inject, input, output } from '@angular/core';
import type { CharacterDto, PartieMemberDto } from '@master-jdr/shared';
import { CharacterAvatar } from '../../characters/character-avatar/character-avatar';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { buildRosterRows, type RosterRow } from '../roster-row.util';

/**
 * Bandeau horizontal scrollable (mobile <768px, ouvert à tout membre de la Partie) listant la
 * troupe — pendant mobile de `RosterRail`. Cf. EXPERIENCE.md §2, DESIGN.md §7 RosterStrip.
 */
@Component({
  selector: 'app-roster-strip',
  standalone: true,
  imports: [CharacterAvatar, IdentityLabel],
  templateUrl: './roster-strip.html',
  styleUrl: './roster-strip.scss',
})
export class RosterStrip {
  protected readonly theme = inject(ThemeToneService);

  readonly members = input.required<PartieMemberDto[]>();
  readonly characters = input.required<CharacterDto[]>();
  /** Propriétaire de la partie — `null` si son compte a été supprimé (AD-5) : aucun membre
   *  n'est alors MJ. */
  readonly ownerId = input.required<string | null>();
  readonly hasFreeSlot = input.required<boolean>();
  readonly classLabelFor = input.required<(c: CharacterDto) => string>();
  readonly roleLabelFor = input.required<(c: CharacterDto) => string | null>();

  readonly selectCharacter = output<{ characterId: string }>();
  readonly openInvitations = output<void>();

  protected readonly rows = computed<RosterRow[]>(() =>
    buildRosterRows(
      this.members(),
      this.characters(),
      this.ownerId(),
      this.classLabelFor(),
      this.roleLabelFor(),
      this.theme.tone(),
      // Revue de code (bmad-review, 2026-09-21) : aucun appelant ne câble aujourd'hui de slot de
      // création sur RosterStrip (le composant est ouvert à tout membre, cf. docstring, mais ne
      // reçoit ni condition d'éligibilité ni identité courante) — toujours inéligible pour
      // l'instant. `currentUserId` reste `undefined` (pas `this.mjId()`, bug corrigé : ça rendait
      // `isSelf` vrai pour la ligne du MJ lui-même, sans conséquence aujourd'hui car sa branche
      // `isMj` court-circuite avant `canCreate`, mais une mine pour un futur slot de création bâti
      // sur ce composant).
      false,
      undefined,
    ),
  );

  protected selectRow(row: RosterRow): void {
    if (row.character) this.selectCharacter.emit({ characterId: row.character.id });
  }
}
