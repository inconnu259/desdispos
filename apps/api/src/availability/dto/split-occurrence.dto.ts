import { IsDateString, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AvailKind, DaySlot } from '@desdispos/shared';

const AVAIL_KINDS: AvailKind[] = ['UNAVAILABLE', 'AVAILABLE'];
const DAY_SLOTS: DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'];

export class SplitModifyDto {
  @IsIn(AVAIL_KINDS)
  kind!: AvailKind;

  @IsIn(DAY_SLOTS)
  slot!: DaySlot;
}

export class SplitOccurrenceDto {
  @IsDateString()
  occurrence!: string;

  @IsIn(['modify', 'delete'])
  action!: 'modify' | 'delete';

  /** Requis quand action = 'modify'. Validé manuellement dans le service. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SplitModifyDto)
  dto?: SplitModifyDto;
}
