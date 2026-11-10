import { Module } from '@nestjs/common';
import { PartiesModule } from '../parties/parties.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { GameSystemModule } from '../game-systems/game-system.module';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { HommeDragonController } from './homme-dragon.controller';
import { HommeDragonSheetController } from './homme-dragons.controller';
import { MyHommeDragonsController } from './my-homme-dragons.controller';
import { HommeDragonService } from './homme-dragon.service';
import { HommeDragonPdfService } from './homme-dragon.pdf.service';

@Module({
  // Story 10.2 (AD-3) : ScenariosModule pour l'historique des scénarios PASSE — import à sens
  // unique, ScenariosModule n'a besoin de rien en retour, aucun forwardRef nécessaire (même
  // situation que AnnouncementsModule → ScenariosModule, Story 9.1).
  imports: [PartiesModule, PermissionsModule, GameSystemModule, ScenariosModule],
  controllers: [HommeDragonController, HommeDragonSheetController, MyHommeDragonsController],
  providers: [HommeDragonService, HommeDragonPdfService],
  exports: [HommeDragonService],
})
export class HommeDragonModule {}
