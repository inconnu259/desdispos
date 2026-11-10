import type { CharacterDto, ContentEntryDto, GameSystemContentDto } from '@master-jdr/shared';

/** Nom narratif du personnage, ou libellé de repli si le joueur ne l'a pas renseigné. */
export function characterName(character: CharacterDto): string {
  const narrative = character.sheetData?.['narrative'] as { name?: string } | undefined;
  return narrative?.name?.trim() || 'Personnage sans nom';
}

/** Un chemin de fiche (`"attributes"`, `"attributes.AGI"`, `"equipment"`...) a-t-il été retiré par
 *  un cadenas de visibilité (Story 31.6/31.7) pour ce lecteur ? `hiddenFields` est vide pour le
 *  propriétaire/MJ (jamais masqués) ou une Partie sans configuration — source unique, réutilisée
 *  par `CharacterSheet`/`InventoryTab` au lieu d'une vérification `Set`/`Array.includes` propre à
 *  chacun (correctif de revue, session bmad-build 2026-09-22). */
export function isFieldHidden(character: CharacterDto, path: string): boolean {
  return character.hiddenFields?.includes(path) ?? false;
}

/** Résout `data` de l'entrée de `GameSystemContent` dont la clé correspond, ou `null` si absent. */
export function findContentEntry<T>(
  content: GameSystemContentDto | null | undefined,
  contentType: string,
  key: string | undefined,
): T | null {
  if (!key) return null;
  const entry = content?.[contentType]?.find((e: ContentEntryDto) => e.key === key);
  return (entry?.data as T) ?? null;
}
