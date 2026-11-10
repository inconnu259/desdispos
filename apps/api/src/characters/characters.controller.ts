import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { memoryStorage } from 'multer';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { RYUUTAMA_ID } from '../game-systems/supported-game-systems';
import { CharacterService } from './character.service';
import { RyuutamaPdfService } from './ryuutama-pdf.service';
import { EquipmentPdfService } from './equipment-pdf.service';
import { NotesPdfService } from './notes-pdf.service';
import { CreateLevelUpDto } from './dto/create-level-up.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateContenantDto } from './dto/create-contenant.dto';
import { UpdateContenantDto } from './dto/update-contenant.dto';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { CreateCharacterNoteDto } from './dto/create-character-note.dto';
import { ToggleNoteShareDto } from './dto/toggle-note-share.dto';
import { SetJournalAutoAssociateDto } from './dto/set-journal-auto-associate.dto';
import { SetNoteScenarioDto } from './dto/set-note-scenario.dto';
import { SetSheetFieldDto } from './dto/set-sheet-field.dto';
import { SetXpDto } from './dto/set-xp.dto';
import { UpdateNarrativeFieldDto } from './dto/update-narrative-field.dto';
import { ExportCharacterPdfDto } from './dto/export-character-pdf.dto';
import { PortraitCropDataDto } from './dto/portrait-crop-data.dto';

const MAX_PORTRAIT_SIZE = 5 * 1024 * 1024;
// Plafonds du formulaire multipart : UN fichier et quelques champs texte courts. Sans eux, Multer accepte un
// nombre illimité de champs (jusqu'à 1 Mo chacun), lus en mémoire AVANT tout contrôle de droits.
const PORTRAIT_UPLOAD_LIMITS = {
  fileSize: MAX_PORTRAIT_SIZE,
  files: 1,
  fields: 5,
  parts: 6,
  fieldSize: 16 * 1024,
  fieldNameSize: 100,
};

@UseGuards(AuthenticatedGuard)
@Controller('characters')
export class CharactersController {
  constructor(
    private readonly characters: CharacterService,
    private readonly ryuutamaPdf: RyuutamaPdfService,
    private readonly equipmentPdf: EquipmentPdfService,
    private readonly notesPdf: NotesPdfService,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.characters.findOne(id, user.id);
  }

  @Get(':id/export.pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ExportCharacterPdfDto,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const character = await this.characters.findOne(id, user.id);
    if (character.gameSystemId !== RYUUTAMA_ID) {
      throw new BadRequestException(
        `Export PDF non supporté pour le système de jeu "${character.gameSystemId}"`,
      );
    }
    const pdfBytes = await this.ryuutamaPdf.fillCharacterPdf(character, query.format);
    return new StreamableFile(pdfBytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="fiche-${id}-${query.format}.pdf"`,
    });
  }

  @Get(':id/export-equipment.pdf')
  async exportEquipmentPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const character = await this.characters.findOne(id, user.id);
    if (character.gameSystemId !== RYUUTAMA_ID) {
      throw new BadRequestException(
        `Export PDF non supporté pour le système de jeu "${character.gameSystemId}"`,
      );
    }
    const pdfBytes = await this.equipmentPdf.fillEquipmentPdf(character);
    return new StreamableFile(pdfBytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="equipement-${id}.pdf"`,
    });
  }

  @Get(':id/export-notes.pdf')
  async exportNotesPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const character = await this.characters.findOne(id, user.id);
    if (character.gameSystemId !== RYUUTAMA_ID) {
      throw new BadRequestException(
        `Export PDF non supporté pour le système de jeu "${character.gameSystemId}"`,
      );
    }
    const notes = await this.characters.getNotes(id, user.id);
    const pdfBytes = await this.notesPdf.fillNotesPdf(notes);
    return new StreamableFile(pdfBytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="notes-${id}.pdf"`,
    });
  }

  @Get(':id/portrait')
  async getPortrait(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const { buffer, mime } = await this.characters.getPortraitFile(id, user.id);
    return new StreamableFile(buffer, { type: mime });
  }

  @Put(':id/portrait')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Rejette la requête pendant le streaming, avant de bufferiser un fichier surdimensionné
      // en mémoire (le `ParseFilePipe` ci-dessous ne s'exécute qu'APRÈS que Multer a fini de lire
      // le body) — cf. `MulterExceptionFilter` pour le remappage de l'erreur Multer en 413.
      limits: PORTRAIT_UPLOAD_LIMITS,
    }),
  )
  async updatePortrait(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_PORTRAIT_SIZE })],
        errorHttpStatusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      }),
    )
    file: Express.Multer.File,
    @Body('cropData') cropDataRaw: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    let cropData: PortraitCropDataDto | null = null;
    if (cropDataRaw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(cropDataRaw);
      } catch {
        throw new BadRequestException('cropData doit être un JSON valide');
      }
      const dto = plainToInstance(PortraitCropDataDto, parsed);
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        throw new BadRequestException(
          'cropData invalide : scale/offsetX/offsetY doivent être des nombres dans les bornes attendues',
        );
      }
      cropData = dto;
    }
    return this.characters.updatePortrait(id, user.id, file, cropData);
  }

  @Delete(':id/portrait')
  removePortrait(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.characters.removePortrait(id, user.id);
  }

  @Patch(':id/pdf-portrait-crop')
  updatePdfPortraitCrop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cropData: PortraitCropDataDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.updatePdfPortraitCrop(id, user.id, cropData);
  }

  @Post(':id/level-up')
  levelUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLevelUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.applyLevelUp(id, user.id, dto);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.characters.getHistory(id, user.id);
  }

  @Post(':id/inventory-items')
  addInventoryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.addInventoryItem(id, user.id, dto);
  }

  @Patch(':id/inventory-items/:itemId')
  updateInventoryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (
      dto.name === undefined &&
      dto.weight === undefined &&
      dto.price === undefined &&
      dto.effect === undefined
    ) {
      throw new BadRequestException(
        'Au moins un champ (name, weight, price ou effect) doit être fourni',
      );
    }
    return this.characters.updateInventoryItem(id, user.id, itemId, dto);
  }

  @Delete(':id/inventory-items/:itemId')
  removeInventoryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.removeInventoryItem(id, user.id, itemId);
  }

  @Post(':id/contenants')
  addContenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.addContenant(id, user.id, dto);
  }

  @Patch(':id/contenants/:itemId')
  updateContenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateContenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (
      dto.name === undefined &&
      dto.weight === undefined &&
      dto.price === undefined &&
      dto.effect === undefined
    ) {
      throw new BadRequestException(
        'Au moins un champ (name, weight, price ou effect) doit être fourni',
      );
    }
    return this.characters.updateContenant(id, user.id, itemId, dto);
  }

  @Delete(':id/contenants/:itemId')
  removeContenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.removeContenant(id, user.id, itemId);
  }

  @Post(':id/animaux')
  addAnimal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAnimalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.addAnimal(id, user.id, dto);
  }

  @Patch(':id/animaux/:itemId')
  updateAnimal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateAnimalDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (dto.name === undefined && dto.price === undefined && dto.effect === undefined) {
      throw new BadRequestException('Au moins un champ (name, price ou effect) doit être fourni');
    }
    return this.characters.updateAnimal(id, user.id, itemId, dto);
  }

  @Delete(':id/animaux/:itemId')
  removeAnimal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.removeAnimal(id, user.id, itemId);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCharacterNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.addNote(id, user.id, dto);
  }

  @Patch(':id/notes/:noteId/share')
  toggleNoteShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: ToggleNoteShareDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.toggleNoteShare(id, user.id, noteId, dto.shared);
  }

  @Patch(':id/journal-auto-associate')
  setJournalAutoAssociate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetJournalAutoAssociateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.setJournalAutoAssociate(id, user.id, dto.journalAutoAssociate);
  }

  @Patch(':id/notes/:noteId/scenario')
  setNoteScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: SetNoteScenarioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.setNoteScenario(id, user.id, noteId, dto.scenarioId);
  }

  @Get(':id/notes')
  getNotes(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.characters.getNotes(id, user.id);
  }

  @Patch(':id/xp')
  setXp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetXpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.setXp(id, user.id, dto.value);
  }

  @Patch(':id/sheet-field')
  setSheetField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSheetFieldDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.setSheetField(id, user.id, dto);
  }

  @Patch(':id/narrative-field')
  updateNarrativeField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNarrativeFieldDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.characters.updateNarrativeField(id, user.id, dto);
  }
}
