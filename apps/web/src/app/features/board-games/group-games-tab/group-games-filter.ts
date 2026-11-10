import { boardGameNameKey, type GroupBoardGameDto } from '@master-jdr/shared';
import { fitsHeadcount } from '../board-game-measures';

/** Les puces « Jouable à : 2 · 4 · 6 · 8+ » (Story 50.1) : `8` désigne « 8+ ». */
export const GROUP_FIT_CHOICES = [2, 4, 6, 8] as const;
export type GroupFitChoice = (typeof GROUP_FIT_CHOICES)[number];

/**
 * Un jeu est retenu par la puce `n` quand il est jouable à `n` joueurs (`fitsHeadcount`) ; pour « 8+ », quand
 * ses deux bornes sont renseignées et que son maximum atteint 8 — il est alors jouable à un nombre d'au moins 8.
 * Un jeu sans nombre de joueurs, ou avec une seule borne, n'est retenu par aucune puce.
 */
export function matchesGroupFit(
  game: Pick<GroupBoardGameDto, 'minPlayers' | 'maxPlayers'>,
  choice: GroupFitChoice,
): boolean {
  if (choice === 8) {
    return game.minPlayers !== null && game.maxPlayers !== null && game.maxPlayers >= 8;
  }
  return fitsHeadcount(game, choice);
}

/**
 * Filtre la liste des jeux du groupe : recherche par nom (casse et accents ignorés, sur la clé normalisée reçue
 * — la clé de la saisie est calculée par la fonction partagée, celle des jeux n'est jamais recalculée) et
 * puce de nombre de joueurs (une seule à la fois). Sans recherche ni puce, la liste est rendue telle quelle.
 */
export function filterGroupGames(
  games: GroupBoardGameDto[],
  query: string,
  fit: GroupFitChoice | null,
): GroupBoardGameDto[] {
  const key = boardGameNameKey(query);
  if (key === '' && fit === null) return games;
  return games.filter(
    (game) =>
      (key === '' || game.nameKey.includes(key)) && (fit === null || matchesGroupFit(game, fit)),
  );
}

/** Combien de personnes distinctes possèdent au moins l'un des jeux listés. */
export function countGroupOwners(games: GroupBoardGameDto[]): number {
  return new Set(games.flatMap((game) => game.owners.map((owner) => owner.userId))).size;
}
