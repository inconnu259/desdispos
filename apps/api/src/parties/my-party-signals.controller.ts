import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PartySignalsService } from './party-signals.service';

/**
 * `GET /me/party-signals` (Story 29.7, AD-3/AD-4) : contrôleur dédié, même patron que
 * `MyCharactersController` — évite toute collision avec `PartiesController.get(':id')`
 * (`@Controller('parties')`, où `'me'` capterait `'me'` comme un id invalide).
 */
@UseGuards(AuthenticatedGuard)
@Controller('me/party-signals')
export class MyPartySignalsController {
  constructor(private readonly signals: PartySignalsService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.signals.getSignals(user.id);
  }
}
