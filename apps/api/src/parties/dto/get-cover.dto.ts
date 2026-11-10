import { IsIn } from 'class-validator';
import { LIST_VIEW_MODES, type ListViewMode } from '@desdispos/shared';

/**
 * `mode` validé contre l'union fermée des modes d'affichage (Story 29.12, AC9) — jamais une
 * largeur arbitraire venue du client, ce qui serait un vecteur de déni de service par
 * redimensionnement.
 */
export class GetCoverDto {
  @IsIn(LIST_VIEW_MODES)
  mode!: ListViewMode;
}
