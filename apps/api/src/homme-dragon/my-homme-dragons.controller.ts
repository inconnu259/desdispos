import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { HommeDragonService } from './homme-dragon.service';

/**
 * `GET /me/homme-dragons` (Story 33.5) : contrôleur dédié, distinct de `HommeDragonController`
 * (routes par partie) et de `HommeDragonSheetController` (`homme-dragons/:id`, la fiche) — même patron que `MyCharactersController`.
 * Une ligne par Homme Dragon de l'appelant, filtrée par propriétaire seul (AD-23) : un Homme Dragon sans aventure y reste visible.
 */
@UseGuards(AuthenticatedGuard)
@Controller('me/homme-dragons')
export class MyHommeDragonsController {
  constructor(private readonly hommeDragon: HommeDragonService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.hommeDragon.findMine(user.id);
  }
}
