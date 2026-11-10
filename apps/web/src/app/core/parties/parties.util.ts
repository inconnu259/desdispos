import { GAME_SYSTEMS } from '@master-jdr/shared';
import type { PartieKind } from '@master-jdr/shared';

export function gameSystemName(id: string): string {
  return GAME_SYSTEMS.find((s) => s.id === id)?.name ?? id;
}

/** Clé de ton du libellé d'un type de partie (sous-titre de tuile, bandeau de la partie, formulaire).
 *  C'est la même série `partie.kind_*` partout : un seul vocabulaire thématisé pour une même notion.
 *  Les appelants gardent le repli `?? kind` (type inconnu → valeur d'API brute). */
export function partieKindLabelKey(kind: PartieKind): string {
  return `partie.kind_${kind}`;
}

/** Rang de tri d'un type de partie : Campagne < Campagne épisodique < One-shot. L'ordre est posé
 *  explicitement, jamais déduit de l'orthographe d'une clé ou d'un libellé : il ne dépend ni du thème
 *  actif ni de la façon dont un thème nomme un type (verrouillé par `party-sort.spec.ts`). */
const KIND_SORT_RANK: Record<PartieKind, number> = {
  CAMPAGNE_LINEAIRE: 0,
  CAMPAGNE_EPISODIQUE: 1,
  ONE_SHOT: 2,
};

export function partieKindSortRank(kind: PartieKind): number {
  return KIND_SORT_RANK[kind] ?? Number.MAX_SAFE_INTEGER;
}
