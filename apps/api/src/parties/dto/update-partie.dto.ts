import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GAME_SYSTEMS } from '@master-jdr/shared';
import type { PartieKind } from '@master-jdr/shared';

const GAME_SYSTEM_IDS: string[] = GAME_SYSTEMS.map((s) => s.id);
const PARTIE_KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

export class UpdatePartieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  // N'atteste que « id connu » — voir le même commentaire dans create-partie.dto.ts. La règle
  // « a un module » (et « un changement, pas la valeur déjà enregistrée ») vit dans
  // PartiesService.update() (Story 29.17).
  @IsOptional()
  @IsIn(GAME_SYSTEM_IDS)
  gameSystemId?: string;

  @IsOptional()
  @IsIn(PARTIE_KINDS)
  kind?: PartieKind;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
