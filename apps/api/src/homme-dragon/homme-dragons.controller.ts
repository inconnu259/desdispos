import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { HommeDragonService } from './homme-dragon.service';
import { HommeDragonPdfService } from './homme-dragon.pdf.service';
import { UpdateHommeDragonDto } from './dto/update-homme-dragon.dto';
import { ChooseEveilPowerDto } from './dto/choose-eveil-power.dto';
import { ChooseArtefactCadeauDto } from './dto/choose-artefact-cadeau.dto';
import { SetReserveSlotDto } from './dto/set-reserve-slot.dto';
import { ExportHommeDragonPdfDto } from './dto/export-homme-dragon-pdf.dto';

/**
 * La fiche d'un Homme Dragon, adressée par son `id` (AD-23) et résolue par `{ id, userId: appelant }` :
 * un Homme Dragon absent ou appartenant à un autre répond `404` dans les deux cas — jamais `403`,
 * son existence ne fuit pas. Lecture et écritures sont réservées à son propriétaire (MJ).
 */
@UseGuards(AuthenticatedGuard)
@Controller('homme-dragons/:id')
export class HommeDragonSheetController {
  constructor(
    private readonly hommeDragon: HommeDragonService,
    private readonly hommeDragonPdf: HommeDragonPdfService,
  ) {}

  @Get()
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.hommeDragon.findOne(id, user.id);
  }

  @Patch()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateHommeDragonDto,
  ) {
    return this.hommeDragon.update(id, user.id, dto);
  }

  @Post('eveil-power')
  chooseEveilPower(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChooseEveilPowerDto,
  ) {
    return this.hommeDragon.chooseEveilPower(id, user.id, dto);
  }

  @Post('artefact-cadeau')
  chooseArtefactCadeau(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChooseArtefactCadeauDto,
  ) {
    return this.hommeDragon.chooseArtefactCadeau(id, user.id, dto);
  }

  /** Écriture d'un emplacement de la réserve de souffles (Story 33.6) : `slot` 1-based,
   * `{ key: null }` retire le souffle. Jamais par le `PATCH` générique. */
  @Put('reserve/:slot')
  setReserveSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', ParseIntPipe) slot: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetReserveSlotDto,
  ) {
    return this.hommeDragon.setReserveSlot(id, user.id, slot, dto);
  }

  @Get('export.pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ExportHommeDragonPdfDto,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const hommeDragon = await this.hommeDragon.findOne(id, user.id);
    const mjPseudo = await this.hommeDragon.getOwnerPseudo(hommeDragon.userId);
    const pdfBytes = await this.hommeDragonPdf.fillHommeDragonPdf(
      hommeDragon,
      mjPseudo,
      query.format,
    );
    return new StreamableFile(pdfBytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="homme-dragon-${id}-${query.format}.pdf"`,
    });
  }
}
