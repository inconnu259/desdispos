import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { HommeDragonService } from './homme-dragon.service';
import { CreateHommeDragonDto } from './dto/create-homme-dragon.dto';

/**
 * Routes PAR PARTIE (AD-23), gardées par le service de permission (MJ de la partie) : elles ne
 * font que créer, lier, délier et référencer. La fiche elle-même vit sous `homme-dragons/:id`
 * (`HommeDragonSheetController`), gardée par son propriétaire.
 */
@UseGuards(AuthenticatedGuard)
@Controller('parties/:id/homme-dragon')
export class HommeDragonController {
  constructor(private readonly hommeDragon: HommeDragonService) {}

  /** Crée ET lie, dans une même transaction (Ryuutama seul, `409` si la partie en a déjà un). */
  @Post()
  create(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateHommeDragonDto,
  ) {
    return this.hommeDragon.create(partieId, user.id, dto);
  }

  /** `{ id, nom }` de l'Homme Dragon lié à l'aventure, ou `null`. */
  @Get()
  findForPartie(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.hommeDragon.findForPartie(partieId, user.id);
  }

  /** Associe un Homme Dragon existant à l'aventure (`404` avant `409`, `400` hors Ryuutama). */
  @Put(':hommeDragonId')
  link(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('hommeDragonId', ParseUUIDPipe) hommeDragonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hommeDragon.link(partieId, hommeDragonId, user.id);
  }

  /** Dissocie l'Homme Dragon de l'aventure — la fiche est conservée, rien n'est purgé. */
  @Delete(':hommeDragonId')
  unlink(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('hommeDragonId', ParseUUIDPipe) hommeDragonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hommeDragon.unlink(partieId, hommeDragonId, user.id);
  }
}
