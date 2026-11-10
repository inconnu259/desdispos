import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { CharacterModule } from '../characters/character.module';
import { XpDistributionsController } from './xp-distributions.controller';
import { XpDistributionsService } from './xp-distributions.service';

@Module({
  imports: [PermissionsModule, CharacterModule],
  controllers: [XpDistributionsController],
  providers: [XpDistributionsService],
})
export class XpDistributionsModule {}
