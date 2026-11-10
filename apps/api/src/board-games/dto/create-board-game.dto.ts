import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateBoardGameInput } from '@master-jdr/shared';
import { trimIfString } from '../../common/dto/trim.transform';

/** Bornes d'un jeu de la Ludothèque (épic 48) — reprises telles quelles par les tests. */
export const BOARD_GAME_NAME_MAX = 80;
export const BOARD_GAME_PLAYERS_MIN = 1;
export const BOARD_GAME_PLAYERS_MAX = 99;
export const BOARD_GAME_DURATION_MIN = 1;
export const BOARD_GAME_DURATION_MAX = 1440;

/**
 * Ajout d'un jeu à ma Ludothèque (Story 48.1, `POST /me/board-games`). Seul le nom est obligatoire
 * (1 à 80 caractères, rogné) ; joueurs entiers de 1 à 99 et durée entière de 1 à 1440 minutes sont
 * facultatifs (absents ou `null`). La règle croisée `max ≥ min` et le plafond de 500 jeux sont
 * vérifiés par le service (400, en français) : ils ne tiennent pas dans un seul champ.
 */
export class CreateBoardGameDto implements CreateBoardGameInput {
  @Transform(trimIfString)
  @IsString({ message: 'Le nom du jeu doit être un texte' })
  @MinLength(1, { message: 'Le nom du jeu est obligatoire' })
  @MaxLength(BOARD_GAME_NAME_MAX, {
    message: `Le nom du jeu ne peut pas dépasser ${BOARD_GAME_NAME_MAX} caractères`,
  })
  name!: string;

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
