import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const RACES = ['DRAGON_VERT', 'DRAGON_BLEU', 'DRAGON_ROUGE', 'DRAGON_NOIR'] as const;

export class ArtefactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inscription?: string;
}

export class CreateHommeDragonDto {
  @IsIn(RACES)
  race!: (typeof RACES)[number];

  @IsObject()
  @ValidateNested()
  @Type(() => ArtefactDto)
  artefact!: ArtefactDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  apparence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caractere?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  vocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  demeure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  mondesProteges?: string;
}
