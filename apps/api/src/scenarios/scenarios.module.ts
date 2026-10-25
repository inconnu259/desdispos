import { Module } from '@nestjs/common';
import { PartiesModule } from '../parties/parties.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { CharacterModule } from '../characters/character.module';
import { PollModule } from '../poll/poll.module';
import { EventsModule } from '../events/events.module';
import { ScenarioDatableSeanceFilter } from './datable-seance-filter.service';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';

@Module({
  // AD-11 : lecture seule de CharacterService pour agréger retrospectiveNotes (Story 8.6) —
  // jamais d'accès Prisma direct à CharacterNote depuis ScenariosModule.
  // Story 8.7 : PollModule importé pour orchestrer createSeancePoll() (PollService.create()
  // appelé tel quel, CreatePollDto inchangé — P2-AD-2).
  // Story 37.3 : EventsModule écrit l'événement de base, les séances et les inscriptions — ce
  // service garde les gardes JDR puis lui délègue l'écriture.
  // Story 37.6 : PermissionsModule (transverse) décide des droits sur la partie, l'événement et
  // la séance.
  imports: [PartiesModule, PermissionsModule, CharacterModule, EventsModule, PollModule],
  controllers: [ScenariosController],
  providers: [ScenariosService, ScenarioDatableSeanceFilter],
  exports: [ScenariosService, ScenarioDatableSeanceFilter],
})
export class ScenariosModule {}
