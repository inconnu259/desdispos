import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser, AvailabilityReminderDto } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AvailabilityService } from './availability.service';

/**
 * `GET /me/availability-reminder` (Story 52.4, AD-5) — faut-il rappeler de déclarer ses dispos ? Une seule règle,
 * `AvailabilityService.reminderDue`, la même sur tous les appareils. Distinct de `GET /me/party-signals`, qui ne
 * lit jamais la préférence. Aucun paramètre : on ne lit que son propre rappel.
 */
@UseGuards(AuthenticatedGuard)
@Controller('me/availability-reminder')
export class MeAvailabilityReminderController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<AvailabilityReminderDto> {
    return { show: await this.availability.reminderDue(user.id) };
  }
}
