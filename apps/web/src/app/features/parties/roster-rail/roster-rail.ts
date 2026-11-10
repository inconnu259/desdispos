import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { CharacterDto, PartieMemberDto } from '@master-jdr/shared';
import { CharacterAvatar } from '../../characters/character-avatar/character-avatar';
import { AppIcon } from '../../../core/icons/app-icon';
import { IdentityLabel } from '../../../shared/identity/identity-label';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { buildRosterRows, type RosterRow } from '../roster-row.util';

/**
 * Panneau permanent (desktop ≥1024px) listant la troupe d'une Partie — remplace
 * l'ancien onglet "Personnages". Replié par défaut (avatars seuls), se déplie via
 * un bouton dédié (jamais au survol). Cf. EXPERIENCE.md §2/§7, DESIGN.md §7 RosterRail.
 */
@Component({
  selector: 'app-roster-rail',
  standalone: true,
  imports: [AppIcon, CharacterAvatar, IdentityLabel],
  templateUrl: './roster-rail.html',
  styleUrl: './roster-rail.scss',
})
export class RosterRail {
  protected readonly theme = inject(ThemeToneService);

  readonly members = input.required<PartieMemberDto[]>();
  readonly characters = input.required<CharacterDto[]>();
  /** Propriétaire de la partie — `null` si son compte a été supprimé (AD-5) : aucun membre
   *  n'est alors MJ. */
  readonly ownerId = input.required<string | null>();
  readonly currentUserId = input.required<string>();
  /** Revue de code (bmad-review, 2026-09-21) : `canCreateCharacter()` du parent — `false` tant que
   *  `characters()` charge encore, pas seulement quand la création est réellement impossible. Seule
   *  source de `RosterRow.canCreate`, jamais réévaluée localement. */
  readonly canCreateCharacter = input.required<boolean>();
  readonly hasFreeSlot = input.required<boolean>();
  readonly classLabelFor = input.required<(c: CharacterDto) => string>();
  readonly roleLabelFor = input.required<(c: CharacterDto) => string | null>();

  readonly selectCharacter = output<{ characterId: string }>();
  readonly createCharacter = output<void>();
  readonly openInvitations = output<void>();

  protected readonly expanded = signal(false);

  protected readonly rows = computed<RosterRow[]>(() =>
    buildRosterRows(
      this.members(),
      this.characters(),
      this.ownerId(),
      this.classLabelFor(),
      this.roleLabelFor(),
      this.theme.tone(),
      this.canCreateCharacter(),
      this.currentUserId(),
    ),
  );

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected selectRow(row: RosterRow): void {
    if (row.character) this.selectCharacter.emit({ characterId: row.character.id });
    else if (row.canCreate) this.createCharacter.emit();
  }
}
