import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { UpdateBoardGameInput } from '@master-jdr/shared';
import { trimIfString } from '../../common/dto/trim.transform';
import {
  BOARD_GAME_DURATION_MAX,
  BOARD_GAME_DURATION_MIN,
  BOARD_GAME_NAME_MAX,
  BOARD_GAME_PLAYERS_MAX,
  BOARD_GAME_PLAYERS_MIN,
} from './create-board-game.dto';

/**
 * Correction d'un jeu de ma Ludothèque (Story 48.2, `PATCH /me/board-games/:id`). Partielle : un
 * champ absent reste inchangé, `null` efface un nombre. Mêmes bornes qu'à la création. La règle
 * croisée `max ≥ min` est vérifiée par le service sur les valeurs FUSIONNÉES (400).
 */
export class UpdateBoardGameDto implements UpdateBoardGameInput {
  // `ValidateIf` (pas `IsOptional`) : `name` est NOT NULL en base — `IsOptional` laisserait passer
  // `null` (pas seulement l'absence) ; ici seul un nom absent saute la validation.
  @ValidateIf((o: UpdateBoardGameDto) => o.name !== undefined)
  @Transform(trimIfString)
  @IsString({ message: 'Le nom du jeu doit être un texte' })
  @MinLength(1, { message: 'Le nom du jeu est obligatoire' })
  @MaxLength(BOARD_GAME_NAME_MAX, {
    message: `Le nom du jeu ne peut pas dépasser ${BOARD_GAME_NAME_MAX} caractères`,
  })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'Le nombre minimum de joueurs doit être un entier' })
  @Min(BOARD_GAME_PLAYERS_MIN, {
    message: `Le nombre minimum de joueurs doit être compris entre ${BOARD_GAME_PLAYERS_MIN} et ${BOARD_GAME_PLAYERS_MAX}`,
  })
  @Max(BOARD_GAME_PLAYERS_MAX, {
    message: `Le nombre minimum de joueurs doit être compris entre ${BOARD_GAME_PLAYERS_MIN} et ${BOARD_GAME_PLAYERS_MAX}`,
  })
  minPlayers?: number | null;

  @IsOptional()
  @IsInt({ message: 'Le nombre maximum de joueurs doit être un entier' })
  @Min(BOARD_GAME_PLAYERS_MIN, {
    message: `Le nombre maximum de joueurs doit être compris entre ${BOARD_GAME_PLAYERS_MIN} et ${BOARD_GAME_PLAYERS_MAX}`,
  })
  @Max(BOARD_GAME_PLAYERS_MAX, {
    message: `Le nombre maximum de joueurs doit être compris entre ${BOARD_GAME_PLAYERS_MIN} et ${BOARD_GAME_PLAYERS_MAX}`,
  })
  maxPlayers?: number | null;

  @IsOptional()
  @IsInt({ message: 'La durée doit être un nombre entier de minutes' })
  @Min(BOARD_GAME_DURATION_MIN, {
    message: `La durée doit être comprise entre ${BOARD_GAME_DURATION_MIN} et ${BOARD_GAME_DURATION_MAX} minutes`,
  })
  @Max(BOARD_GAME_DURATION_MAX, {
    message: `La durée doit être comprise entre ${BOARD_GAME_DURATION_MIN} et ${BOARD_GAME_DURATION_MAX} minutes`,
  })
  durationMin?: number | null;
}
