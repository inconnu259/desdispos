import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { InviteLinksService } from './invite-links.service';
import { CreateInviteLinkDto } from './dto/create-invite-link.dto';

@Controller()
export class InviteLinksController {
  constructor(private readonly links: InviteLinksService) {}

  @UseGuards(AuthenticatedGuard)
  @Post('parties/:id/invite-links')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateInviteLinkDto) {
    return this.links.create(id, user.id, dto);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('parties/:id/invite-links')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.links.listForPartie(id, user.id);
  }

  @UseGuards(AuthenticatedGuard)
  @Delete('invite-links/:id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.links.revoke(id, user.id);
  }

  // Public : prévisualisation avant inscription (un nouveau venu n'a pas encore de session).
  @Get('invite-links/:token')
  preview(@Param('token') token: string) {
    return this.links.preview(token);
  }

  @UseGuards(AuthenticatedGuard)
  @Post('invite-links/:token/join')
  join(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.links.join(token, user.id);
  }
}
