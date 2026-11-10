import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CharacterService } from './character.service';
import { CreateCharacterDto } from './dto/create-character.dto';

@UseGuards(AuthenticatedGuard)
@Controller('parties/:id/characters')
export class PartieCharactersController {
  constructor(private readonly characters: CharacterService) {}

  @Post()
  create(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCharacterDto,
  ) {
    return this.characters.create(partieId, user.id, dto);
  }

  @Get()
  findByPartie(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.characters.findByPartie(partieId, user.id);
  }
}
