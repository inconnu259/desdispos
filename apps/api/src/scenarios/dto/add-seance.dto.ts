import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { DURATION_CAP_MESSAGE } from '../../events/seance-span';

/**
 * Ajout d'une séance (Story 47.1, `POST /scenarios/:id/seances`). Le corps est facultatif : une durée
 * absente vaut 1 créneau (création) ; sinon un entier de 1 à 45 créneaux enchaînés.
 */
export class AddSeanceDto {
  @IsOptional()
  @IsInt({ message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Min(1, { message: 'La durée doit être un entier d’au moins 1 créneau' })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: DURATION_CAP_MESSAGE })
  durationSlots?: number;
}
