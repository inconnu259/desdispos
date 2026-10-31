import {
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { boardGameNameKey, type EventEnvyInput } from '@master-jdr/shared';
import { BOARD_GAME_NAME_MAX } from '../../board-games/dto/create-board-game.dto';

/** La clé reçue doit déjà être normalisée : `boardGameNameKey(clé) === clé`. Jamais renormalisée en silence —
 *  une clé fabriquée à la main ou périmée est refusée, pas corrigée en une autre clé que celle que le client a lue. */
@ValidatorConstraint({ name: 'isNormalisedNameKey', async: false })
export class IsNormalisedNameKeyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && boardGameNameKey(value) === value;
  }

  defaultMessage(): string {
    return 'La clé du jeu doit être normalisée (sans majuscule, accent ni espace superflu)';
  }
}

/**
 * Corps de `PUT` et `DELETE /events/:eventId/envies` (Story 49.5) : la clé normalisée du nom de jeu, 1 à 80
 * caractères, déjà normalisée — sinon 400 en français. Pas de `@Transform` : rien n'est rogné ni renormalisé ici.
 */
export class EventEnvyBodyDto implements EventEnvyInput {
  @IsString({ message: 'La clé du jeu doit être un texte' })
  @MinLength(1, { message: 'La clé du jeu est obligatoire' })
  @MaxLength(BOARD_GAME_NAME_MAX, {
    message: `La clé du jeu ne peut pas dépasser ${BOARD_GAME_NAME_MAX} caractères`,
  })
  @Validate(IsNormalisedNameKeyConstraint)
  nameKey!: string;
}
