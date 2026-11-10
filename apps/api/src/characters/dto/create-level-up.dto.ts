import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MaxJsonSize } from '../../common/dto/max-json-size.validator';

class CapabilityDto {
  @IsString()
  @MaxLength(50)
  type!: string;

  @IsObject()
  @MaxJsonSize(2000)
  params!: Record<string, unknown>;
}

export class CreateLevelUpDto {
  @IsInt()
  @Min(0)
  @Max(3)
  pvAllocated!: number;

  @IsInt()
  @Min(0)
  @Max(3)
  peAllocated!: number;

  /**
   * Capacités octroyées à ce niveau. Un niveau accorde 1 ou 2 capacités (2 aux niveaux 4/6/10,
   * cf. `LEVEL_TABLE` — Attribut ET spéciale, jamais un choix exclusif). Le service revalide que
   * l'ensemble des types fourni correspond exactement à celui attendu pour le niveau.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => CapabilityDto)
  capabilities!: CapabilityDto[];
}
