import type { CharacterDto, PartieMemberDto } from '@master-jdr/shared';
import { characterName } from '../../core/characters/character.util';
import { fillTone } from '../../core/theme/tone-format';
import { pendingLevelsLocal } from '../characters/character-sheet/level-thresholds';

/** Registre de ton courant (`ThemeToneService.tone()`), résolu par l'appelant pour rester réactif. */
type Tone = Readonly<Record<string, string>>;

export interface RosterRow {
  member: PartieMemberDto;
  isMj: boolean;
  character: CharacterDto | null;
  /** Libellé pour les initiales de l'avatar (nom du personnage s'il existe, sinon nom affiché du
   *  joueur) — sans rapport avec `User.displayName` malgré le nom proche, cf. `playerLabel`. */
  avatarLabel: string;
  /** Nom du personnage pour `IdentityLabel`, `null` si aucun personnage (MJ ou slot vide). */
  characterLabel: string | null;
  /** Nom affiché du joueur pour `IdentityLabel` — toujours `member.displayName`. */
  playerLabel: string;
  classLabel: string;
  ariaLabel: string;
  /** Le personnage a franchi un seuil de niveau pas encore traité par son propriétaire (cf. LevelUpBanner). */
  hasPendingLevelUp: boolean;
  /** La ligne correspond à l'utilisateur courant — seul cas où un slot vide doit proposer de créer un personnage. */
  isSelf: boolean;
  /** Libellé du rôle de groupe assigné à ce personnage, ou null si aucun. Reflète toujours l'état
   *  réel — la priorité d'affichage avec hasPendingLevelUp est une règle de template (Story 27.3),
   *  jamais encodée ici. */
  assignedRoleLabel: string | null;
  /** Revue de code (bmad-review, 2026-09-21) : `isSelf && !character` seul ne suffit pas à garder
   *  le slot — il vaut aussi `true` pendant le chargement de `characters()` (avant que
   *  `canCreateCharacter()` ne sache vraiment répondre) et sur un système sans module/une partie
   *  clôturée, deux cas où l'ancien code laissait un slot focusable/cliquable promettre une action
   *  que le clic n'exécutait pas. `canCreate` est la seule source pour l'aria-label, le `tabindex`
   *  et le routage du clic du slot de création — jamais `isSelf` seul. */
  canCreate: boolean;
}

function hasPendingLevelUp(character: CharacterDto | null): boolean {
  if (!character) return false;
  const appliedCount = ((character.sheetData as any)?.levelUps?.length as number | undefined) ?? 0;
  return pendingLevelsLocal(character.xp, appliedCount).length > 0;
}

/** Suffixe d'accessibilité — même info que le badge visuel, jamais un indicateur couleur/icône seul.
 *  Le texte vient du registre de ton (`tone`, lu par l'appelant) : cette fonction pure n'injecte rien. */
function withLevelUpSuffix(tone: Tone, label: string, pending: boolean): string {
  return pending ? fillTone(tone['parties.roster_aria_levelup'], { label }) : label;
}

/** Suffixe d'accessibilité pour le rôle assigné (Story 27.3) — même discipline que
 *  withLevelUpSuffix : jamais un badge visuel seul sans équivalent textuel. Le rôle n'est annoncé
 *  que si aucune montée de niveau n'est en attente (même priorité que le badge visuel). */
function withRoleSuffix(
  tone: Tone,
  label: string,
  assignedRoleLabel: string | null,
  pending: boolean,
): string {
  return assignedRoleLabel && !pending
    ? fillTone(tone['parties.roster_aria_role'], { label, role: assignedRoleLabel })
    : label;
}

/**
 * Construit une ligne de roster par membre — partagé entre `RosterRail` (desktop) et
 * `RosterStrip` (mobile MJ) pour ne pas dupliquer la logique de résolution
 * membre → personnage → libellé d'accessibilité.
 */
export function buildRosterRows(
  members: PartieMemberDto[],
  characters: CharacterDto[],
  ownerId: string | null,
  classLabelFor: (c: CharacterDto) => string,
  roleLabelFor: (c: CharacterDto) => string | null,
  /** Registre de ton courant : source du libellé thématisé du slot d'initiale (Story 29.15,
   *  `roster.create_slot_label` — jamais codé en dur, seule source pour l'aria-label/tooltip du slot
   *  vide de l'utilisateur courant) et des suffixes d'accessibilité (`parties.roster_aria_*`). */
  tone: Tone,
  /** Revue de code (bmad-review, 2026-09-21) : valeur de `canCreateCharacter()` du composant
   *  appelant — `false` tant que `characters()` n'a pas fini de charger, pas seulement quand la
   *  création est réellement impossible. Seule source de `RosterRow.canCreate`. */
  createEligible: boolean,
  currentUserId?: string,
): RosterRow[] {
  return members.map((member) => {
    const isMj = member.userId === ownerId;
    const isSelf = member.userId === currentUserId;
    const character = characters.find((c) => c.userId === member.userId) ?? null;
    if (isMj) {
      const pending = hasPendingLevelUp(character);
      const assignedRoleLabel = character ? roleLabelFor(character) : null;
      return {
        member,
        isMj,
        character,
        avatarLabel: member.displayName,
        characterLabel: null,
        playerLabel: member.displayName,
        classLabel: '',
        ariaLabel: withRoleSuffix(
          tone,
          withLevelUpSuffix(
            tone,
            fillTone(tone['parties.roster_aria_mj'], { name: member.displayName }),
            pending,
          ),
          assignedRoleLabel,
          pending,
        ),
        hasPendingLevelUp: pending,
        isSelf,
        assignedRoleLabel,
        canCreate: false,
      };
    }
    if (!character) {
      const canCreate = isSelf && createEligible;
      return {
        member,
        isMj,
        character,
        avatarLabel: member.displayName,
        characterLabel: null,
        playerLabel: member.displayName,
        classLabel: '',
        ariaLabel: canCreate
          ? fillTone(tone['parties.roster_aria_create'], {
              name: member.displayName,
              action: tone['roster.create_slot_label'],
            })
          : fillTone(tone['parties.roster_aria_no_character'], { name: member.displayName }),
        hasPendingLevelUp: false,
        isSelf,
        assignedRoleLabel: null,
        canCreate,
      };
    }
    const name = characterName(character);
    const classLabel = classLabelFor(character);
    const pending = hasPendingLevelUp(character);
    const assignedRoleLabel = roleLabelFor(character);
    return {
      member,
      isMj,
      character,
      avatarLabel: name,
      characterLabel: name,
      playerLabel: member.displayName,
      classLabel,
      // Deferred-work (2026-08-25) : parenthèses vides si classLabel est vide (ex. "Alice —
      // Fenn ()") — omises quand il n'y a rien à qualifier.
      ariaLabel: withRoleSuffix(
        tone,
        withLevelUpSuffix(
          tone,
          classLabel
            ? fillTone(tone['parties.roster_aria_character_class'], {
                name: member.displayName,
                character: name,
                class: classLabel,
              })
            : fillTone(tone['parties.roster_aria_character'], {
                name: member.displayName,
                character: name,
              }),
          pending,
        ),
        assignedRoleLabel,
        pending,
      ),
      hasPendingLevelUp: pending,
      isSelf,
      assignedRoleLabel,
      canCreate: false,
    };
  });
}
