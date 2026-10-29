import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, BoardGameDto } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { BoardGamesService } from './board-games.service';
import { CreateBoardGameDto } from './dto/create-board-game.dto';

/** Ma Ludothèque (Story 48.1). `@Controller('me')` est déjà pris par le compte : ce contrôleur
 *  porte son propre préfixe. Aucun identifiant de personne en paramètre — toujours la session. */
@UseGuards(AuthenticatedGuard)
@Controller('me/board-games')
export class BoardGamesController {
  constructor(private readonly boardGames: BoardGamesService) {}

  @Get()
  listMine(@CurrentUser() user: AuthUser): Promise<BoardGameDto[]> {
    return this.boardGames.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardGameDto): Promise<BoardGameDto> {
    return this.boardGames.create(user.id, dto);
  }
}
