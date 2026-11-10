import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { AuthService } from '../auth/auth.service';
import { AccountService } from './account.service';
import { UpdateDisplayNameDto } from './dto/update-display-name.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';

@UseGuards(AuthenticatedGuard)
@Controller('me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  @Patch('display-name')
  updateDisplayName(@Req() req: Request, @Body() dto: UpdateDisplayNameDto) {
    return this.account.updateDisplayName((req.user as { id: string }).id, dto.displayName);
  }

  @Patch('theme')
  updateTheme(@Req() req: Request, @Body() dto: UpdateThemeDto) {
    return this.account.updateTheme((req.user as { id: string }).id, dto.theme);
  }

  @Patch('preferences')
  updatePreferences(@Req() req: Request, @Body() dto: UpdatePreferencesDto) {
    return this.account.updatePreferences((req.user as { id: string }).id, dto);
  }

  @Put('favorites/:partieId')
  addFavorite(@Req() req: Request, @Param('partieId') partieId: string) {
    return this.account.addFavorite((req.user as { id: string }).id, partieId);
  }

  @Delete('favorites/:partieId')
  removeFavorite(@Req() req: Request, @Param('partieId') partieId: string) {
    return this.account.removeFavorite((req.user as { id: string }).id, partieId);
  }

  /** Story 43.1 — aperçu en lecture seule de ce que l'effacement du compte emporterait ; ne vise
   *  que l'utilisateur connecté (aucun identifiant en paramètre). */
  @Get('deletion-impact')
  getDeletionImpact(@Req() req: Request) {
    return this.account.getDeletionImpact((req.user as { id: string }).id);
  }

  @Get('unseen-announcements')
  getUnseenAnnouncements(@Req() req: Request) {
    return this.account.getUnseenAnnouncements((req.user as { id: string }).id);
  }

  @Put('announcements-read/:announcementId')
  markAnnouncementRead(@Req() req: Request, @Param('announcementId') announcementId: string) {
    return this.account.markAnnouncementRead((req.user as { id: string }).id, announcementId);
  }

  /** Story 43.2 — efface le compte connecté (aucun identifiant en paramètre). Même plafond de débit que les
   *  routes d'authentification : le mot de passe y est testé. La session et son cookie tombent avec le compte. */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Delete()
  async deleteAccount(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ ok: true }> {
    const result = await this.account.deleteAccount((req.user as { id: string }).id, dto.password);
    // Ses sessions sont déjà révoquées en base ; on referme celle de la requête et on retire le cookie.
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('connect.sid');
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Patch('password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      (req.user as { id: string }).id,
      dto.currentPassword,
      dto.newPassword,
      req.sessionID,
    );
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Patch('email')
  requestEmailChange(@Req() req: Request, @Body() dto: RequestEmailChangeDto) {
    return this.auth.requestEmailChange(
      (req.user as { id: string }).id,
      dto.currentPassword,
      dto.newEmail,
    );
  }
}
