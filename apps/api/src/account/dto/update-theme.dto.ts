import { IsIn } from 'class-validator';
import { THEMES, type Theme } from '@desdispos/shared';

export class UpdateThemeDto {
  @IsIn(THEMES)
  theme!: Theme;
}
