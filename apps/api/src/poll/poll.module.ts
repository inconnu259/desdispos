import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { MyOpenPollsController } from './my-open-polls.controller';
import { MyOpenPollsService } from './my-open-polls.service';
import { PollController } from './poll.controller';
import { PollService } from './poll.service';
import { PollVoteCleanupService } from './poll-vote-cleanup.service';

@Module({
  // Story 37.8 : couche 1 — aucune dépendance vers `parties/`, `events/`, `availability/` ni
  // `scenarios/`. La date de séance et les signaux de partie passent par les ports de `poll/ports/`
  // (`SeanceDatePort`, `PartieSignalsPort`), liés par `PortsModule` (global). Plus de forwardRef.
  // Story 37.6 : PermissionsModule (transverse) décide des droits sur la partie.
  imports: [PermissionsModule],
  controllers: [PollController, MyOpenPollsController],
  // Story 40.8 : `PollVoteCleanupService` (sans dépendance) est injecté par `PartiesService.leave()`.
  providers: [PollService, PollVoteCleanupService, MyOpenPollsService],
  // Story 8.7 : ScenariosService orchestre la création d'un poll lié à une séance via
  // PollService.create() — export requis pour l'import cross-module depuis ScenariosModule.
  exports: [PollService, PollVoteCleanupService],
})
export class PollModule {}
