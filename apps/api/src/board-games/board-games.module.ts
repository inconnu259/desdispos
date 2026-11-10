import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { BoardGamesController } from './board-games.controller';
import { BoardGamesService } from './board-games.service';
import { PartyBoardGamesController } from './party-board-games.controller';
import { UserLibraryController } from './user-library.controller';

@Module({
  // Story 48.1 : couche 2, seul écrivain de `BoardGame`. Prisma et le bus temps réel sont globaux ;
  // ce module n'importe jamais `events/` (la dépendance ira `events/ → board-games/`, épic 49).
  // Story 48.3 : lecture de la Ludothèque d'autrui, décidée par `PermissionService` (module transverse).
  // Story 50.1 : les jeux des membres d'un groupe, décidés par `PARTIE_READ` (même module transverse).
  imports: [PermissionsModule],
  controllers: [BoardGamesController, UserLibraryController, PartyBoardGamesController],
  providers: [BoardGamesService],
  exports: [BoardGamesService],
})
export class BoardGamesModule {}
