import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GAME_SYSTEMS } from '@master-jdr/shared';
import type { PartieKind } from '@master-jdr/shared';

const GAME_SYSTEM_IDS: string[] = GAME_SYSTEMS.map((s) => s.id);
const PARTIE_KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

export class CreatePartieDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  // N'atteste que « id connu » (tous les GAME_SYSTEMS, ouverts ou non) — la règle « ouvert à la
  // création » est appliquée séparément par PartiesService.create() via isOpenForCreation()
  // (Story 29.17, registre depuis la Story 37.5). Aucun ValidatorConstraint partagé n'existe dans
  // ce projet pour unifier les deux niveaux ; un futur point d'entrée acceptant gameSystemId doit
  // reproduire la vérification du service, ce décorateur seul ne l'empêche pas (revue de code).
  @IsIn(GAME_SYSTEM_IDS)
  gameSystemId!: string;

  @IsIn(PARTIE_KINDS)
  kind!: PartieKind;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
