import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { PartieKind } from '@desdispos/shared';

const PARTIE_KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];

/**
 * Conversion du type d'une partie (Story 29.14) — `PATCH /parties/:id/kind`.
 *
 * Volontairement séparé d'`UpdatePartieDto` : la conversion n'est pas une édition de champ mais une
 * opération à effets, et `courantScenarioId` est un paramètre transitoire qui n'a rien à faire dans
 * un DTO d'édition générique.
 */
export class ConvertPartieKindDto {
  @IsIn(PARTIE_KINDS)
  kind!: PartieKind;

  /** Scénario qui reste `COURANT` quand la conversion vers une campagne linéaire en trouve
   *  plusieurs. Exigé par le serveur dans ce seul cas — la matrice le signale
   *  (`requiresCourantChoice`), le service le valide (appartenance à la partie + statut réel). */
  @IsOptional()
  @IsUUID()
  courantScenarioId?: string;
}
