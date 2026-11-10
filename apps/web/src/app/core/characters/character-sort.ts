import type { CharacterSort, MyCharacterDto } from '@desdispos/shared';
import { characterName } from './character.util';

/** Tri pur (Story 29.9, AC1/AC4) — ne mute jamais le tableau reçu en entrée. Même patron que
 *  `party-sort.ts` (Story 29.8) : copie défensive, repli sur l'ordre d'origine si `sort` sort un
 *  jour de `CHARACTER_SORTS`. */
export function sortCharacters(
  characters: readonly MyCharacterDto[],
  sort: CharacterSort,
): MyCharacterDto[] {
  const copy = [...characters];
  switch (sort) {
    case 'niveau':
      // Plus haut niveau en premier (cohérent avec « urgence » qui met en avant ce qui compte le
      // plus) — décision d'implémentation, aucune AC ne fixe le sens.
      return copy.sort((a, b) => b.level - a.level);
    case 'partie':
      return copy.sort((a, b) => a.partieName.localeCompare(b.partieName));
    case 'nom':
      return copy.sort((a, b) => characterName(a).localeCompare(characterName(b)));
    default:
      // Repli défensif (même patron que party-sort.ts, Review Findings Story 29.8) : une valeur
      // de compte périmée ne doit jamais faire planter l'affichage.
      return copy;
  }
}
