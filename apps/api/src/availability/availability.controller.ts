import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityBatchDto } from './dto/create-availability-batch.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { SplitOccurrenceDto } from './dto/split-occurrence.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@UseGuards(AuthenticatedGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAvailabilityDto) {
    return this.availability.create(user.id, dto);
  }

  // Déclarée avant :id/split : "batch" n'est pas un :id donc aucune collision réelle,
  // mais on garde l'ordre explicite par prudence (Story 30.2, Task 6).
  @Post('batch')
  createBatch(@CurrentUser() user: AuthUser, @Body() dto: CreateAvailabilityBatchDto) {
    return this.availability.createBatch(user.id, dto.items);
  }

  @Get()
  findActive(@CurrentUser() user: AuthUser) {
    return this.availability.findActive(user.id);
  }

  @Post(':id/split')
  splitOccurrence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SplitOccurrenceDto,
  ) {
    return this.availability.splitOccurrence(id, user.id, dto.occurrence, dto.action, dto.dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availability.update(id, user.id, dto);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availability.softDelete(id, user.id);
  }
}
