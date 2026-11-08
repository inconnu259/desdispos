import { IsInt, Max, Min } from 'class-validator';

export class SetXpDto {
  @IsInt()
  @Min(0)
  // Au-delà, un entier PostgreSQL déborde (500) — et aucune partie n'en approche.
  @Max(1_000_000)
  value!: number;
}
