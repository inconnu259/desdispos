import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class XpDistributionEntryInput {
  @IsUUID()
  characterId!: string;

  // Review finding : XP "jamais dépensé, jamais remis à zéro" (cf. packages/shared/src/index.ts)
  // — un montant négatif ferait décroître Character.xp via le même chemin qu'un gain.
  @IsInt()
  @Min(0)
  @Max(100_000)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  isBonus?: boolean;
}

export class CreateXpDistributionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // borne défensive — pas de limite fonctionnelle sur la taille d'une troupe
  @ValidateNested({ each: true })
  @Type(() => XpDistributionEntryInput)
  entries!: XpDistributionEntryInput[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  breaths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  monsterLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
