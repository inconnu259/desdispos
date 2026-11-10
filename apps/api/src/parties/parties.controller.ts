import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PartiesService } from './parties.service';
import { ConvertPartieKindDto } from './dto/convert-partie-kind.dto';
import { CreatePartieDto } from './dto/create-partie.dto';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { SlotWindowKeyBody } from './dto/slot-window.dto';
import { GetHeatmapDto } from './dto/get-heatmap.dto';
import { SetMemberRoleDto } from './dto/set-member-role.dto';
import { SetVisibilityLocksDto } from './dto/set-visibility-locks.dto';
import { UpdatePartieDto } from './dto/update-partie.dto';

const DEFAULT_WEEKS = 8;

@UseGuards(AuthenticatedGuard) // toutes les routes /parties exigent une session
@Controller('parties')
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartieDto) {
    return this.parties.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('role') role?: string) {
    // Sans `role` : toutes les parties de l'utilisateur, chacune avec son rôle (Story 37.7).
    // `?role=player` et toute autre valeur gardent leur sens historique (`mj` par défaut).
    const filter = role === undefined ? undefined : role === 'player' ? 'player' : 'mj';
    return this.parties.listForUser(user.id, filter);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.findOneDto(id, user.id);
  }

  /** Story 42.5 : retirer de SA liste une partie terminée ou annulée (définitif, pour soi seul). */
  @Put(':id/hidden')
  hide(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.hide(user.id, id);
  }

  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.listMembers(id, user.id);
  }

  @Get(':id/available-slots')
  getAvailableSlots(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: GetAvailableSlotsDto,
  ) {
    return this.parties.getAvailableSlots(
      id,
      user.id,
      q.weeks ?? DEFAULT_WEEKS,
      q.from,
      q.to,
      q.span ?? 1,
    );
  }

  /** Story 46.4 : masquer une fenêtre de l'automate (MJ d'un JDR, pour lui seul). La fenêtre est celle que
   *  `available-slots` a servie ; `PUT` est idempotent. */
  @Put(':id/available-slots/hidden')
  hideWindow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SlotWindowKeyBody,
  ) {
    return this.parties.hideWindow(id, user.id, dto);
  }

  /** Story 46.4 : démasquer une fenêtre (sans effet si elle ne l'était pas). */
  @Delete(':id/available-slots/hidden')
  showWindow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SlotWindowKeyBody,
  ) {
    return this.parties.showWindow(id, user.id, dto);
  }

  @Get(':id/heatmap')
  getHeatmap(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: GetHeatmapDto) {
    return this.parties.getHeatmap(id, user.id, q.from, q.to);
  }

  /** Quitter soi-même un groupe (Story 39.5). Déclarée AVANT `:id/members/:userId`, qui sinon
   *  capterait `me` comme identifiant de membre. `?deleteIfLastAdmin=true` — et seulement cette
   *  valeur exacte — confirme que le départ du dernier administrateur supprime le groupe. */
  @Delete(':id/members/me')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('deleteIfLastAdmin') deleteIfLastAdmin?: string,
  ) {
    return this.parties.leave(id, user.id, {
      type: 'LEFT',
      deleteIfLastAdmin: deleteIfLastAdmin === 'true',
    });
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.parties.removeMember(id, user.id, targetUserId);
  }

  /** Nommer un administrateur ou quitter l'office (Story 39.4) — groupes seulement. */
  @Patch(':id/members/:userId/role')
  setMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: SetMemberRoleDto,
  ) {
    return this.parties.setMemberRole(id, user.id, targetUserId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePartieDto) {
    return this.parties.update(id, user.id, dto);
  }

  /** Conversion du type d'une partie (Story 29.14) — opération à effets (création de scénario,
   *  semis de participants, rétrogradation de statuts), distincte de l'édition de champs
   *  `PATCH /parties/:id`, qui rejette désormais tout changement de `kind`. */
  @Patch(':id/kind')
  convertKind(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConvertPartieKindDto,
  ) {
    return this.parties.convertKind(id, user.id, dto);
  }

  @Patch(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.close(id, user.id);
  }

  @Patch(':id/reopen')
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.reopen(id, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.remove(id, user.id);
  }

  /**
   * Cadenas de visibilité (Story 31.6) — MJ-only. PUT et non PATCH : le corps décrit l'ÉTAT
   * COMPLET des chemins verrouillés voulus, jamais un delta (même patron que
   * `PUT /parties/:id/poll/:pollId/options`, Story 36.10/D-16).
   */
  @Put(':id/visibility-locks')
  setVisibilityLocks(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetVisibilityLocksDto,
  ) {
    return this.parties.setVisibilityLocks(id, user.id, dto);
  }

  /** Lecture symétrique au PUT ci-dessus (Story 31.7) — même garde MJ-only
   *  (`PARTIE_VISIBILITY_LOCKS_READ`) : un non-MJ atteignant l'URL directement se voit refuser
   *  l'accès (403/404), jamais une liste vide. */
  @Get(':id/visibility-locks')
  getVisibilityLocks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.getVisibilityLocks(id, user.id);
  }
}
