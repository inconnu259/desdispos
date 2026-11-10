import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateXpDistributionDto } from './dto/create-xp-distribution.dto';
import { XpDistributionsService } from './xp-distributions.service';

@UseGuards(AuthenticatedGuard)
@Controller('parties/:id/xp-distributions')
export class XpDistributionsController {
  constructor(private readonly xpDistributions: XpDistributionsService) {}

  @Post()
  create(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateXpDistributionDto,
  ) {
    return this.xpDistributions.createDistribution(partieId, user.id, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.xpDistributions.listForPartie(partieId, user.id, pagination);
  }
}
