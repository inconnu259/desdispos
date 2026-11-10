import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { GameSystemController } from './game-system.controller';
import { PartieGameSystemController } from './partie-game-system.controller';
import { GameSystemService } from './game-system.service';

@Module({
  imports: [PermissionsModule],
  controllers: [GameSystemController, PartieGameSystemController],
  providers: [GameSystemService],
  exports: [GameSystemService],
})
export class GameSystemModule {}
