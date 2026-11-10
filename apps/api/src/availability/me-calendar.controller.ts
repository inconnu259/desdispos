import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { MeCalendarQueryDto } from './dto/me-calendar-query.dto';

/** Endpoint unique du calendrier personnel (AD-18, Story 30.5) — hébergé dans AvailabilityModule,
 *  jamais un CalendarModule neuf. */
@UseGuards(AuthenticatedGuard)
@Controller('me/calendar')
export class MeCalendarController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  getMyCalendar(@CurrentUser() user: AuthUser, @Query() q: MeCalendarQueryDto) {
    return this.availability.getMyCalendar(user.id, q.from, q.to);
  }
}
