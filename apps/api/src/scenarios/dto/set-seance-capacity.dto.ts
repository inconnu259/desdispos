import { IsInt, Max, Min } from 'class-validator';

export class SetSeanceCapacityDto {
  @IsInt()
  @Min(1)
  @Max(1000)
  inscriptionMin!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  inscriptionMax!: number;
}
