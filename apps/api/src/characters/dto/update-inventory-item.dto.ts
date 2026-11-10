import { Transform } from 'class-transformer';
import { trimIfString } from '../../common/dto/trim.transform';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @Transform(trimIfString)
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  weight?: number;

  @IsOptional()
  @IsString()
  @Transform(trimIfString)
  @MaxLength(50)
  price?: string;

  @IsOptional()
  @IsString()
  @Transform(trimIfString)
  @MaxLength(300)
  effect?: string;
}
