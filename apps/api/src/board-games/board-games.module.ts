import { Module } from '@nestjs/common';
import { BoardGamesController } from './board-games.controller';
import { BoardGamesService } from './board-games.service';

@Module({
  // Story 48.1 : couche 2, seul écrivain de `BoardGame`. Prisma et le bus temps réel sont globaux ;
  // ce module n'importe jamais `events/` (la dépendance ira `events/ → board-games/`, épic 49).
  controllers: [BoardGamesController],
  providers: [BoardGamesService],
  exports: [BoardGamesService],
})
export class BoardGamesModule {}
