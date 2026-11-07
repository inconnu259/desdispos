import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { MeCalendarController } from './me-calendar.controller';
import { MeAvailabilityReminderController } from './me-availability-reminder.controller';

@Module({
  // Story 37.7 : PermissionsModule (transverse) décide du rôle de l'utilisateur sur ses parties.
  // Story 37.8 : couche 1 — les séances des parties (plages occupées, calendrier personnel)
  // arrivent par les ports de `availability/ports/`, liés par `PortsModule` (global) ; ce module
  // n'importe aucune couche supérieure.
  imports: [PermissionsModule],
  controllers: [AvailabilityController, MeCalendarController, MeAvailabilityReminderController],
  providers: [AvailabilityService],
  exports: [AvailabilityService], // consommé par PartiesModule
})
export class AvailabilityModule {}
