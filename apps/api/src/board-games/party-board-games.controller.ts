import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthUser, GroupBoardGamesDto } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { BoardGamesService } from './board-games.service';

/** Les jeux des membres d'un groupe, en lecture seule (Story 50.1). Préfixe `parties` comme les autres routes
 *  d'une partie ; l'identifiant est lu tel quel (un identifiant inconnu aboutit au refus de `PARTIE_READ`). */
@UseGuards(AuthenticatedGuard)
@Controller('parties')
export class PartyBoardGamesController {
  constructor(private readonly boardGames: BoardGamesService) {}

  @Get(':id/board-games')
  listOfGroup(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GroupBoardGamesDto> {
    return this.boardGames.listOfGroup(user.id, id);
  }
}
