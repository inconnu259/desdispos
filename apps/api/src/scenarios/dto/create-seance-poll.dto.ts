import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { DaySlot } from '@master-jdr/shared';
// Import RUNTIME : le plafond est une valeur (un `import type` l'effacerait).
import { MAX_SLOT_WINDOW_SLOTS } from '@master-jdr/shared';
import { DURATION_CAP_MESSAGE, DURATION_INVALID_MESSAGE } from '../../events/seance-span';

// Copie exacte de la validation de PollOptionInput (apps/api/src/poll/dto/create-poll.dto.ts) —
// pas de scenarioRef ici, la séance est déjà l'identifiant explicite via l'URL (Story 8.7).
class SeancePollOptionInput {
  @IsDateString()
  date!: string;

  @IsEnum(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'])
  slot!: DaySlot;
}

export class CreateSeancePollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SeancePollOptionInput)
  options!: SeancePollOptionInput[];

  /** Story 45.4 — fin du vote : un jour `YYYY-MM-DD` (la validité calendaire et le passé sont vérifiés par le service). */
  @IsOptional()
  @IsString({ message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  expiresAt?: string;

  /** Story 47.4 — durée du rendez-vous, écrite avec le vote (même transaction) ; absente = inchangée. */
  @IsOptional()
  @IsInt({ message: DURATION_INVALID_MESSAGE })
  @Min(1, { message: DURATION_INVALID_MESSAGE })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: DURATION_CAP_MESSAGE })
  durationSlots?: number;
}
