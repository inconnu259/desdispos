import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { DatableSeancesService } from './datable-seances.service';

/** Mes rendez-vous qui attendent une date, toutes parties (Story 45.1) — lu par le calendrier personnel. */
@UseGuards(AuthenticatedGuard)
@Controller('me/datable-seances')
export class MyDatableSeancesController {
  constructor(private readonly datableSeances: DatableSeancesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.datableSeances.list(user.id);
  }
}
