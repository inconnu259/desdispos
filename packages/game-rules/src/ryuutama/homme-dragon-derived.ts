/**
 * Table de seuils de niveau de l'Homme Dragon — distincte de `LEVEL_TABLE` du PJ (`leveling.ts`) :
 * indexée sur le nombre de scénarios `PASSE` de la Partie, jamais sur l'XP (qui n'a aucun sens
 * pour l'Homme Dragon, ce n'est pas un personnage joueur).
 */
export const HOMME_DRAGON_LEVEL_THRESHOLDS: { level: number; scenariosPasse: number }[] = [
  { level: 2, scenariosPasse: 1 },
  { level: 3, scenariosPasse: 3 },
  { level: 4, scenariosPasse: 7 },
  { level: 5, scenariosPasse: 12 },
];

/** Niveau à partir duquel le MJ choisit l'artefact cadeau (`docs/dragons.md`, « Niveaux »). */
export const ARTEFACT_CADEAU_LEVEL = 4;

/** Niveau à partir duquel les souffles rituels (mère-dragon) sont consultables. */
export const SOUFFLES_RITUELS_LEVEL = 5;

/** Niveau 1 si en dessous du premier seuil (1 scénario Passé) — même convention que `levelForXp`. */
export function levelForScenariosPasse(count: number): number {
  let level = 1;
  for (const entry of HOMME_DRAGON_LEVEL_THRESHOLDS) {
    if (count >= entry.scenariosPasse) level = entry.level;
  }
  return level;
}

export interface HommeDragonDerivedStats {
  PS: number;
}

/** Fonction pure, ne lève jamais — même convention que `computeDerived()` du PJ. PS : 3 aux
 * niveaux 1-2, 5 aux niveaux 3-4, 10 au niveau 5. */
export function computeHommeDragonDerived(level: number): HommeDragonDerivedStats {
  if (level <= 2) return { PS: 3 };
  if (level <= 4) return { PS: 5 };
  return { PS: 10 };
}

/**
 * Niveaux 2 à `currentLevel` pour lesquels aucun pouvoir d'éveil n'a encore été choisi
 * (`appliedLevels`) — un niveau peut débloquer un choix, jamais le niveau 1 (point de départ,
 * pas un changement de niveau). Contrairement à `pendingLevels()` du PJ (indexé sur la longueur
 * du tableau `levelUps[]`), ici chaque niveau est vérifié par appartenance explicite à
 * `appliedLevels` — plus sûr si un niveau était un jour appliqué hors ordre.
 */
export function pendingEveilLevels(currentLevel: number, appliedLevels: number[]): number[] {
  const pending: number[] = [];
  for (let level = 2; level <= currentLevel; level++) {
    if (!appliedLevels.includes(level)) pending.push(level);
  }
  return pending;
}
