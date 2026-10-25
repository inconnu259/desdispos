import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import type { DaySlot } from '@master-jdr/shared';

class PollOptionInput {
  @IsDateString()
  date!: string;

  @IsEnum(['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'])
  slot!: DaySlot;
}

export class CreatePollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PollOptionInput)
  options!: PollOptionInput[];

  @IsOptional()
  @IsString()
  scenarioRef?: string | null;

  /** Story 45.4 — fin du vote : un jour `YYYY-MM-DD` (la validité calendaire et le passé sont vérifiés par le service). */
  @IsOptional()
  @IsString({ message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "L'échéance du vote doit être au format AAAA-MM-JJ" })
  expiresAt?: string;
}
