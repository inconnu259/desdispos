import { Type } from 'class-transformer';
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/** Story 47.6 : refus écrit d'une durée de fenêtre hors bornes (ou non entière). */
export const SPAN_MESSAGE = `La durée des fenêtres doit être un entier de 1 à ${MAX_SLOT_WINDOW_SLOTS} créneaux`;

export class GetAvailableSlotsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(16)
  weeks?: number;

  /** Story 47.6 : durée des fenêtres servies, en créneaux consécutifs (1 par défaut). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: SPAN_MESSAGE })
  @Min(1, { message: SPAN_MESSAGE })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: SPAN_MESSAGE })
  span?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
