import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { AvailKind, DaySlot, RecurKind } from '@master-jdr/shared';

const AVAIL_KINDS: AvailKind[] = ['UNAVAILABLE', 'AVAILABLE'];
const RECUR_KINDS: RecurKind[] = ['RECURRING', 'PUNCTUAL'];
const DAY_SLOTS: DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'];

export class CreateAvailabilityDto {
  @IsIn(AVAIL_KINDS)
  kind!: AvailKind;

  @IsIn(RECUR_KINDS)
  recurKind!: RecurKind;

  /** Requis pour RECURRING (jour de la semaine 0=dim … 6=sam), ignoré pour PUNCTUAL. */
  @ValidateIf((o: CreateAvailabilityDto) => o.recurKind === 'RECURRING')
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsIn(DAY_SLOTS)
  slot!: DaySlot;

  /** Requis pour PUNCTUAL, ignoré pour RECURRING. */
  @ValidateIf((o: CreateAvailabilityDto) => o.recurKind === 'PUNCTUAL')
  @IsDateString()
  startDate?: string | null;

  /** Requis pour PUNCTUAL, ignoré pour RECURRING. */
  @ValidateIf((o: CreateAvailabilityDto) => o.recurKind === 'PUNCTUAL')
  @IsDateString()
  endDate?: string | null;

  @IsDateString()
  expiresAt!: string;

  /** ID de la déclaration en cours de remplacement — exclue du check de conflits. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  replacingId?: string;

  /** Résolution choisie par l'utilisateur après détection d'un conflit. */
  @IsOptional()
  @IsIn(['overwrite', 'keep'])
  conflictResolution?: 'overwrite' | 'keep';
}
