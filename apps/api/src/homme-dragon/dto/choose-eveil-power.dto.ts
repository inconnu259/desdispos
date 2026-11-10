import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const EVEIL_LEVELS = [2, 3, 4, 5] as const;

export class ChooseEveilPowerDto {
  @IsIn(EVEIL_LEVELS)
  level!: (typeof EVEIL_LEVELS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;
}
