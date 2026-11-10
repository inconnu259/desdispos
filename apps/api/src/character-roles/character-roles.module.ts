import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { GameSystemModule } from '../game-systems/game-system.module';
import { CharacterRolesController } from './character-roles.controller';
import { CharacterRolesService } from './character-roles.service';

@Module({
  imports: [PermissionsModule, GameSystemModule],
  controllers: [CharacterRolesController],
  providers: [CharacterRolesService],
})
export class CharacterRolesModule {}
