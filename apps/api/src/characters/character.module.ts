import { Module } from '@nestjs/common';
import { PartiesModule } from '../parties/parties.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { GameSystemModule } from '../game-systems/game-system.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { CharactersController } from './characters.controller';
import { PartieCharactersController } from './partie-characters.controller';
import { MyCharactersController } from './my-characters.controller';
import { CharacterService } from './character.service';
import { RyuutamaPdfService } from './ryuutama-pdf.service';
import { EquipmentPdfService } from './equipment-pdf.service';
import { NotesPdfService } from './notes-pdf.service';

@Module({
  imports: [PartiesModule, PermissionsModule, GameSystemModule, UsersModule, EmailModule],
  controllers: [CharactersController, PartieCharactersController, MyCharactersController],
  providers: [CharacterService, RyuutamaPdfService, EquipmentPdfService, NotesPdfService],
  exports: [CharacterService],
})
export class CharacterModule {}
