import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  // Story 9.1 (AD-2) : import à sens unique — ScenariosModule n'a besoin de rien en retour,
  // contrairement au cycle ScenariosModule ↔ PollModule (Story 8.8) — aucun forwardRef nécessaire.
  imports: [PermissionsModule, ScenariosModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
