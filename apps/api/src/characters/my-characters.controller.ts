import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CharacterService } from './character.service';

/**
 * `GET /me/characters` (Story 29.2, AD-4/D-10) : contrôleur dédié, distinct de `CharactersController`
 * (`@Controller('characters')`, dont `@Get(':id')` capterait `'me'` comme un UUID invalide) et de
 * `PartieCharactersController` (scopé à une seule Partie). Restreint aux personnages de l'appelant.
 */
@UseGuards(AuthenticatedGuard)
@Controller('me/characters')
export class MyCharactersController {
  constructor(private readonly characters: CharacterService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.characters.findMine(user.id);
  }
}
