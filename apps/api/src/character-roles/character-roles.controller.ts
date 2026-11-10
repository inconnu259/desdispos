import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CharacterRolesService } from './character-roles.service';
import { AssignGroupRoleDto } from './dto/assign-group-role.dto';

@UseGuards(AuthenticatedGuard)
@Controller()
export class CharacterRolesController {
  constructor(private readonly characterRoles: CharacterRolesService) {}

  @Post('parties/:id/characters/:characterId/role')
  assign(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignGroupRoleDto,
  ) {
    return this.characterRoles.assign(partieId, user.id, characterId, dto.roleKey);
  }

  @Delete('parties/:id/characters/:characterId/role')
  unassign(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characterRoles.unassign(partieId, user.id, characterId);
  }

  @Get('parties/:id/character-roles')
  listForPartie(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.characterRoles.listForPartie(partieId, user.id);
  }
}
