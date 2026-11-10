import type { PartieDto, PartieSort, PartySignalsDto } from '@master-jdr/shared';
import { dominantCategory, type SignalCategory } from './party-signal-priority';
import { partieKindSortRank } from './parties.util';

/** Ordre des catégories de priorité pour le tri 'urgence' (Story 29.7, réutilisé tel quel) —
 *  une partie sans signal se comporte comme « aucune catégorie », classée après 'informative'. */
const CATEGORY_ORDER: readonly SignalCategory[] = [
  'blocking',
  'deadline',
  'overdue',
  'informative',
];

const STATUS_ORDER: Record<PartieDto['status'], number> = {
  A_VENIR: 0,
  EN_COURS: 1,
  TERMINEE: 2,
  ANNULEE: 3,
};

function categoryRank(partie: PartieDto, signalsMap: Map<string, PartySignalsDto>): number {
  // Une partie terminée n'est jamais « urgente » (cf. party-signal-priority.ts, PARTIE_TERMINEE
  // toujours hors-catégorie/dernier) — classée après toute autre partie, quel que soit son signal.
  if (partie.status === 'TERMINEE' || partie.status === 'ANNULEE') return CATEGORY_ORDER.length;
  const signals = signalsMap.get(partie.id)?.signals ?? [];
  const category = dominantCategory(signals);
  const idx = category ? CATEGORY_ORDER.indexOf(category) : -1;
  return idx === -1 ? CATEGORY_ORDER.length - 1 : idx;
}

/** Tri pur (Story 29.8, AC3/AC4) — ne mute jamais le tableau reçu en entrée. `urgence` réutilise
 *  `dominantCategory()` (Story 29.7), jamais une nouvelle table de priorité dupliquée. */
export function sortParties(
  parties: readonly PartieDto[],
  sort: PartieSort,
  signalsMap: Map<string, PartySignalsDto>,
): PartieDto[] {
  const copy = [...parties];
  switch (sort) {
    case 'urgence':
      return copy.sort((a, b) => categoryRank(a, signalsMap) - categoryRank(b, signalsMap));
    case 'date':
      return copy.sort((a, b) => {
        if (a.nextSessionDate === null && b.nextSessionDate === null) return 0;
        if (a.nextSessionDate === null) return 1;
        if (b.nextSessionDate === null) return -1;
        return a.nextSessionDate.localeCompare(b.nextSessionDate);
      });
    case 'nom':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'type':
      // Rang explicite par type (Campagne < Campagne épisodique < One-shot) : l'ordre ne dépend
      // ni du thème actif ni de l'orthographe d'une clé de ton.
      return copy.sort((a, b) => partieKindSortRank(a.kind) - partieKindSortRank(b.kind));
    case 'statut':
      return copy.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    default:
      // Repli défensif (Review Findings) : une valeur de compte périmée, sortie de PARTIE_SORTS
      // (ex. après une future extension de l'union non rétrocompatible), ne doit jamais faire
      // planter orderedTiles().map() — ordre d'origine conservé plutôt qu'un throw ou undefined.
      return copy;
  }
}

/** Favoris en tête (FR-11, Story 29.8) — partition stable, indépendante du tri choisi : ne mute
 *  jamais le tableau reçu en entrée, conserve l'ordre relatif au sein de chaque sous-groupe. */
export function pinFavorites<T extends { isFavorite: boolean }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
}
