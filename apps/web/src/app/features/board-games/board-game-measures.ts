import type { BoardGameDto } from '@master-jdr/shared';
import { fillTone } from '../../core/theme/tone-format';

type Tone = Record<string, string>;
type Measures = Pick<BoardGameDto, 'minPlayers' | 'maxPlayers' | 'durationMin'>;

/**
 * Mesures d'un jeu (Story 48.1), neutres dans les trois thèmes : « {min}–{max} joueurs » (min = max :
 * « {n} joueur(s) »), min seul « {min}+ joueurs », max seul « jusqu'à {max} joueurs », puis « {d} min »,
 * reliés par « · ». Chaîne vide quand rien n'est renseigné — la ligne ne montre alors que le nom.
 */
export function formatBoardGameMeasures(game: Measures, tone: Tone): string {
  const parts: string[] = [];
  const { minPlayers: min, maxPlayers: max, durationMin } = game;
  if (min !== null && max !== null) {
    if (min === max) {
      const key =
        min <= 1
          ? 'board_games.measure_players_exact_one'
          : 'board_games.measure_players_exact_many';
      parts.push(fillTone(tone[key], { n: min }));
    } else {
      parts.push(fillTone(tone['board_games.measure_players_range'], { min, max }));
    }
  } else if (min !== null) {
    parts.push(fillTone(tone['board_games.measure_players_min'], { min }));
  } else if (max !== null) {
    parts.push(fillTone(tone['board_games.measure_players_max'], { max }));
  }
  if (durationMin !== null) {
    parts.push(fillTone(tone['board_games.measure_duration'], { d: durationMin }));
  }
  return parts.join(' · ');
}

/** « {n} jeu » (n ≤ 1) ou « {n} jeux ». */
export function formatBoardGameCount(n: number, tone: Tone): string {
  return fillTone(tone[n <= 1 ? 'board_games.count_one' : 'board_games.count_many'], { n });
}

/**
 * Story 49.1 : un jeu est « jouable à N » quand `minPlayers ≤ N ≤ maxPlayers`, les deux bornes renseignées.
 * Un jeu sans nombre de joueurs — ou avec une seule borne — n'est jamais jouable (il reste affiché, sans
 * pastille, et le filtre « Jouables à N » l'exclut).
 */
export function fitsHeadcount(
  game: Pick<BoardGameDto, 'minPlayers' | 'maxPlayers'>,
  n: number,
): boolean {
  return (
    game.minPlayers !== null &&
    game.maxPlayers !== null &&
    game.minPlayers <= n &&
    n <= game.maxPlayers
  );
}
