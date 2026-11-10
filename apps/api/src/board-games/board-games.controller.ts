import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser, BoardGameDto } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { BoardGamesService } from './board-games.service';
import { CreateBoardGameDto } from './dto/create-board-game.dto';
import { UpdateBoardGameDto } from './dto/update-board-game.dto';

/** Ma Ludothèque (Stories 48.1, 48.2). `@Controller('me')` est déjà pris par le compte : ce
 *  contrôleur porte son propre préfixe. Aucun identifiant de personne en paramètre — toujours la
 *  session. L'identifiant d'un jeu est un `TEXT` : pas de `ParseUUIDPipe`, un identifiant inconnu
 *  aboutit au même 404 qu'un jeu d'autrui. */
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

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBoardGameDto,
  ): Promise<BoardGameDto> {
    return this.boardGames.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.boardGames.remove(user.id, id);
  }
}
