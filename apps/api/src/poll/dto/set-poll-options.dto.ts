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

/** Story 47.4 : refus d'une durée hors bornes — mêmes textes que `events/seance-span.ts` (la couche 1
 *  n'importe pas `events/`). */
export const POLL_DURATION_INVALID_MESSAGE = 'La durée doit être un entier d’au moins 1 créneau';
export const POLL_DURATION_CAP_MESSAGE = '15 jours au plus : au-delà, créez deux rendez-vous.';

// Copie exacte de la validation de PollOptionInput (apps/api/src/poll/dto/create-poll.dto.ts) —
// même patron que create-seance-poll.dto.ts (Story 8.7). Pas de scenarioRef ici : le vote existe
// déjà, cette route ne touche QUE ses options.
class SetPollOptionInput {
  @IsDateString()
  date!: string;

  @IsEnum(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'])
  slot!: DaySlot;
}

/**
 * Story 36.10 (D-16) — jeu DÉCLARATIF COMPLET des options voulues, jamais un delta.
 *
 * Bornes identiques à `CreatePollDto` : un vote à une seule option n'est pas un vote, et la
 * charge doit rester bornée. Le dédoublonnage `date` + `slot` est fait par le service, comme
 * pour la création.
 */
export class SetPollOptionsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SetPollOptionInput)
  options!: SetPollOptionInput[];

  /** Story 45.4 — fin du vote : un jour `YYYY-MM-DD` (la validité calendaire et le passé sont vérifiés par le service). */
  @IsOptional()
  @IsString({ message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  expiresAt?: string;

  /** Story 47.4 — nouvelle durée du rendez-vous, en créneaux ; absente = inchangée. */
  @IsOptional()
  @IsInt({ message: POLL_DURATION_INVALID_MESSAGE })
  @Min(1, { message: POLL_DURATION_INVALID_MESSAGE })
  @Max(MAX_SLOT_WINDOW_SLOTS, { message: POLL_DURATION_CAP_MESSAGE })
  durationSlots?: number;
}
