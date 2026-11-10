import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { EventsModule } from '../events/events.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PollModule } from '../poll/poll.module';
import { PartiesService } from './parties.service';
import { PartiesController } from './parties.controller';
import { PartyCoverController } from './party-cover.controller';
import { PartySignalsService } from './party-signals.service';
import { MyPartySignalsController } from './my-party-signals.controller';

@Module({
  // Story 37.3 : EventsModule crée l'événement (et sa séance) d'un ONE_SHOT / d'une conversion.
  // Story 37.6 : PermissionsModule (transverse) décide des droits sur la partie.
  // Story 40.8 : PollModule (couche 1, sans retour vers `parties/`) — `leave()` y retire les votes ouverts.
  imports: [AvailabilityModule, EventsModule, PermissionsModule, PollModule],
  controllers: [PartiesController, PartyCoverController, MyPartySignalsController],
  providers: [PartiesService, PartySignalsService],
  exports: [PartiesService], // réutilisé par InvitationsModule (vérifs MJ / appartenance)
})
export class PartiesModule {}
