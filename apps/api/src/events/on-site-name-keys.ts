/** Ce qu'il faut savoir d'une soirée pour dire quels noms de jeu y sont sur place (épic 49, Story 49.5). */
export interface OnSiteNameKeysInput {
  /** Les jeux de l'hôte : identifiant (pour les écarts) et clé normalisée. Vide si l'hôte a disparu. */
  hostGames: { id: string; nameKey: string }[];
  /** Les identifiants des jeux de l'hôte écartés pour cette soirée (`EventGameExcluded`). */
  excludedIds: Iterable<string>;
  /** Les clés normalisées des jeux apportés à cette soirée (`EventGameBring`). */
  bringNameKeys: Iterable<string>;
}

/**
 * Les noms de jeu SUR PLACE d'une soirée (Story 49.5) — l'UNIQUE définition : les clés normalisées des jeux de
 * l'hôte moins ceux qu'il a écartés pour la soirée, plus celles des jeux apportés. Le contrôle d'écriture d'une
 * Envie, la purge des Envies orphelines et la lecture de la route des jeux en partent tous les trois : ils ne
 * peuvent pas diverger. Pure, sans accès base : l'appelant lit les trois ensembles (sur le client de sa
 * transaction quand il écrit).
 */
export function onSiteNameKeys(input: OnSiteNameKeysInput): Set<string> {
  const excluded = new Set(input.excludedIds);
  const keys = new Set<string>();
  for (const game of input.hostGames) {
    if (!excluded.has(game.id)) keys.add(game.nameKey);
  }
  for (const key of input.bringNameKeys) keys.add(key);
  return keys;
}
