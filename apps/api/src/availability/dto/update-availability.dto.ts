import { IsDateString, IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import type { AvailKind, DaySlot, RecurKind } from '@desdispos/shared';

const AVAIL_KINDS: AvailKind[] = ['UNAVAILABLE', 'AVAILABLE'];
const RECUR_KINDS: RecurKind[] = ['RECURRING', 'PUNCTUAL'];
const DAY_SLOTS: DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'];

export class UpdateAvailabilityDto {
  @IsOptional()
  @IsIn(AVAIL_KINDS)
  kind?: AvailKind;

  @IsOptional()
  @IsIn(RECUR_KINDS)
  recurKind?: RecurKind;

  /** Requis si recurKind est passé à RECURRING dans ce PATCH. */
  @ValidateIf((o: UpdateAvailabilityDto) => o.recurKind === 'RECURRING')
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsIn(DAY_SLOTS)
  slot?: DaySlot;

  /** Requis si recurKind est passé à PUNCTUAL dans ce PATCH. */
  @ValidateIf((o: UpdateAvailabilityDto) => o.recurKind === 'PUNCTUAL')
  @IsDateString()
  startDate?: string | null;

  /**
   * Pour PUNCTUAL : borne de fin explicite.
   * Pour RECURRING : borne de fin de série (utilisé par le modèle SPLIT pour tronquer la série).
   */
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
