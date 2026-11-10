import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { MembershipRole } from '@master-jdr/shared';

const MEMBERSHIP_ROLES: MembershipRole[] = ['ADMIN', 'MEMBER'];

/**
 * Changement de rôle d'un membre de groupe (Story 39.4) — `PATCH /parties/:id/members/:userId/role`.
 * Deux mouvements seulement existent : nommer un membre ordinaire administrateur (`ADMIN`), ou
 * quitter soi-même l'office (`MEMBER`, sur son propre `userId`). Le service refuse tout le reste.
 */
export class SetMemberRoleDto {
  @IsIn(MEMBERSHIP_ROLES)
  role!: MembershipRole;

  /** Confirmation explicite que quitter l'office en étant le DERNIER administrateur supprime le
   *  groupe. Sans elle, le serveur refuse (409) et ne change rien : un écran périmé ne peut jamais
   *  supprimer un groupe. */
  @IsOptional()
  @IsBoolean()
  deleteIfLastAdmin?: boolean;
}
