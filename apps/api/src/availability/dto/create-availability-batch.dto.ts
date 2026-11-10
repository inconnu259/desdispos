import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AvailKind, DaySlot, RecurKind } from '@desdispos/shared';

const AVAIL_KINDS: AvailKind[] = ['UNAVAILABLE', 'AVAILABLE'];
const RECUR_KINDS: RecurKind[] = ['RECURRING', 'PUNCTUAL'];
const DAY_SLOTS: DaySlot[] = ['MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY'];
const CONFLICT_RESOLUTIONS = ['overwrite', 'keep'];

/** Un élément du lot : mêmes règles que CreateAvailabilityDto, sans replacingId (qui n'a de
 *  sens que depuis le panneau, lequel remplace une déclaration précise).
 *
 *  `conflictResolution` était lui aussi absent de dessein (Story 30.2, AD-21) ; la Story 36.4
 *  le rouvre, PAR ITEM, au titre de la dérogation D-18 — le parcours « Au cas par cas » décide
 *  créneau par créneau, une résolution globale au lot ne pourrait pas l'exprimer. */
export class CreateAvailabilityBatchItemDto {
  @IsIn(AVAIL_KINDS)
  kind!: AvailKind;

  @IsIn(RECUR_KINDS)
  recurKind!: RecurKind;

  /** Requis pour RECURRING (jour de la semaine 0=dim … 6=sam), ignoré pour PUNCTUAL. */
  @ValidateIf((o: CreateAvailabilityBatchItemDto) => o.recurKind === 'RECURRING')
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsIn(DAY_SLOTS)
  slot!: DaySlot;

  /** Requis pour PUNCTUAL, ignoré pour RECURRING. */
  @ValidateIf((o: CreateAvailabilityBatchItemDto) => o.recurKind === 'PUNCTUAL')
  @IsDateString()
  startDate?: string | null;

  /** Requis pour PUNCTUAL, ignoré pour RECURRING. */
  @ValidateIf((o: CreateAvailabilityBatchItemDto) => o.recurKind === 'PUNCTUAL')
  @IsDateString()
  endDate?: string | null;

  @IsDateString()
  expiresAt!: string;

  /** Résolution choisie pour CE créneau (Story 36.4). Union fermée validée : jamais une
   *  chaîne libre, cette valeur pilotant une écriture destructive (« overwrite » expire
   *  des déclarations existantes). */
  @IsOptional()
  @IsIn(CONFLICT_RESOLUTIONS)
  conflictResolution?: 'overwrite' | 'keep';
}

export class CreateAvailabilityBatchDto {
  @IsArray()
  // Messages explicites (AC9) : le client doit pouvoir distinguer les deux cas sans
  // dépendre du texte par défaut de class-validator.
  @ArrayMinSize(1, { message: 'Le lot ne peut pas être vide' })
  // Plafond dimensionné sur le geste de sélection visé par la Story 30.3 : une semaine
  // (7 jours × 3 créneaux MORNING/AFTERNOON/EVENING = 21) ; une sélection multi-semaines
  // reste plausible, d'où une marge au-delà d'une seule semaine.
  @ArrayMaxSize(42, { message: 'Le lot dépasse le plafond de 42 créneaux' })
  @ValidateNested({ each: true })
  @Type(() => CreateAvailabilityBatchItemDto)
  items!: CreateAvailabilityBatchItemDto[];
}
