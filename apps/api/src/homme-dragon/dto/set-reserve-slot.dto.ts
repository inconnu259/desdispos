import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Écriture d'un emplacement de la réserve de souffles (Story 33.6) — `key: null` retire le
 * souffle. La validité de la clé (catalogues, capacité, quota d'autre race…) est vérifiée par le
 * service, pas ici ; `key` absent est refusé (seul `null` explicite retire). */
export class SetReserveSlotDto {
  @ValidateIf((o: SetReserveSlotDto) => o.key !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string | null;
}
