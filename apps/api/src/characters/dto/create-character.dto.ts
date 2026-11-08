import { IsNotEmpty, IsNotEmptyObject, IsString, MaxLength } from 'class-validator';
import { MaxJsonSize } from '../../common/dto/max-json-size.validator';

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  gameSystemId: string;

  /**
   * `IsNotEmptyObject()` rejette déjà null, les tableaux et `{}` (cf. son implémentation :
   * `isObject()` exclut explicitement les tableaux, puis vérifie qu'il reste au moins une clé
   * propre) — pas besoin d'un validateur custom pour ça.
   */
  @IsNotEmptyObject()
  @MaxJsonSize(50_000)
  sheetData: Record<string, unknown>;
}
