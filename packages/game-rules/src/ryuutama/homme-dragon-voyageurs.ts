/** Un voyageur protégé, tel que porté par une aventure de `HommeDragonDto` (`@master-jdr/shared`) —
 * miroir local minimal (jamais d'import de `shared`, même convention que le reste du package). */
export interface HommeDragonVoyageur {
  userId: string;
  pseudo: string;
}

/** Une aventure de l'Homme Dragon vue par l'aplatissement : seuls ses voyageurs comptent ici. */
export interface HommeDragonAventureVoyageurs {
  voyageurs: HommeDragonVoyageur[];
}

/**
 * Aplatit les voyageurs de toutes les aventures d'un Homme Dragon en une liste unique, dédoublonnée
 * par `userId` (AD-23) : un joueur présent dans deux aventures n'est imprimé qu'une fois sur la
 * fiche PDF, qui n'a pas de notion d'aventure. L'ordre est celui de première apparition (aventures
 * dans l'ordre reçu, voyageurs dans l'ordre de chaque aventure) — stable d'une impression à l'autre.
 * Fonction unique : le PDF ne recalcule jamais cet aplatissement ailleurs.
 */
export function flattenVoyageursProteges(
  aventures: readonly HommeDragonAventureVoyageurs[],
): HommeDragonVoyageur[] {
  const seen = new Set<string>();
  const result: HommeDragonVoyageur[] = [];
  for (const aventure of aventures) {
    for (const voyageur of aventure.voyageurs) {
      if (seen.has(voyageur.userId)) continue;
      seen.add(voyageur.userId);
      result.push({ userId: voyageur.userId, pseudo: voyageur.pseudo });
    }
  }
  return result;
}
