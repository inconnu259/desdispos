import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MyOpenPollsService } from './my-open-polls.service';

/** Mes sondages de dates ouverts, toutes parties et toutes familles (Story 44.2) — lu par le calendrier
 *  personnel et par le compteur de votes à faire. Hébergé dans `poll/`, jamais un module neuf. */
@UseGuards(AuthenticatedGuard)
@Controller('me/open-polls')
export class MyOpenPollsController {
  constructor(private readonly myOpenPolls: MyOpenPollsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.myOpenPolls.list(user.id);
  }
}
