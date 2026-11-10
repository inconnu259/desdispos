import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

/**
 * Décision des droits sur une partie et ses événements (Story 37.6, AD-6) — module TRANSVERSE.
 * N'importe aucun module métier (seul `PrismaService`, global, est injecté) : `parties/`,
 * `events/`, `scenarios/`, `poll/` et à terme `availability/` peuvent tous l'importer sans cycle.
 */
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
