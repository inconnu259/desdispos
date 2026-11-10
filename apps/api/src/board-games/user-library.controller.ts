import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthUser, UserLibraryDto } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { BoardGamesService } from './board-games.service';

/** Ludothèque d'une AUTRE personne, en lecture seule (Story 48.3). Préfixe propre : `me/board-games`
 *  est celui de ma Ludothèque. L'identifiant d'une personne est un `TEXT` : pas de `ParseUUIDPipe`, un
 *  identifiant inconnu aboutit au même 404 qu'un refus de droit (rien ne révèle que le compte existe). */
@UseGuards(AuthenticatedGuard)
@Controller('users')
export class UserLibraryController {
  constructor(private readonly boardGames: BoardGamesService) {}

  @Get(':userId/board-games')
  listOf(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<UserLibraryDto> {
    return this.boardGames.listOf(user.id, userId);
  }
}
