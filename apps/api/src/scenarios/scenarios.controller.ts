import {
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
  Query,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { AddSeanceDto } from './dto/add-seance.dto';
import { CreateSeancePollDto } from './dto/create-seance-poll.dto';
import { ReservePlaceDto } from './dto/reserve-place.dto';
import { SetSeanceCapacityDto } from './dto/set-seance-capacity.dto';
import { SetCompteRenduDto } from './dto/set-compte-rendu.dto';
import { SetInfosPratiquesDto } from './dto/set-infos-pratiques.dto';
import { SetResumeFinDto } from './dto/set-resume-fin.dto';

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
// Plafonds du formulaire multipart : UN fichier et quelques champs texte courts. Sans eux, Multer accepte un
// nombre illimité de champs (jusqu'à 1 Mo chacun), lus en mémoire AVANT tout contrôle de droits.
const DOCUMENT_UPLOAD_LIMITS = {
  fileSize: MAX_DOCUMENT_SIZE,
  files: 1,
  fields: 5,
  parts: 6,
  fieldSize: 16 * 1024,
  fieldNameSize: 100,
};

/**
 * En-tête `Content-Disposition` d'un document téléchargé. `originalName` vient du client
 * (file.originalname) : jamais interpolé tel quel dans un en-tête HTTP.
 * - caractères de contrôle (dont CR/LF : injection d'en-tête), guillemets, `\`, `/` retirés ;
 * - extension IMPOSÉE par le type réel du fichier (`.pdf` / `.txt`) : un nom `regles.hta` ou `.bat` ne
 *   doit pas faire ouvrir un contenu PDF/texte avec une application dangereuse ;
 * - `filename` ASCII de repli + `filename*` UTF-8 (RFC 5987) pour les noms accentués.
 */
export function documentContentDisposition(originalName: string, mime: string): string {
  const extension = mime === 'application/pdf' ? '.pdf' : '.txt';
  // eslint-disable-next-line no-control-regex -- retrait volontaire des caractères de contrôle
  const cleaned = originalName.replace(/[\x00-\x1f\x7f"\\/]/g, '').trim();
  const dot = cleaned.lastIndexOf('.');
  const base = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 150) || 'document';
  const filename = `${base}${extension}`;
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@UseGuards(AuthenticatedGuard)
@Controller()
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Post('parties/:id/scenarios')
  create(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScenarioDto,
  ) {
    return this.scenarios.create(partieId, user.id, dto);
  }

  @Patch('scenarios/:id')
  update(
    @Param('id', ParseUUIDPipe) scenarioId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateScenarioDto,
  ) {
    return this.scenarios.update(scenarioId, user.id, dto);
  }

  @Get('parties/:id/scenarios/drafts')
  listDrafts(@Param('id', ParseUUIDPipe) partieId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.listDrafts(partieId, user.id);
  }

  @Get('parties/:id/scenarios')
  findAll(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.scenarios.findAllForPartie(partieId, user.id, pagination);
  }

  @Patch('scenarios/:id/open')
  open(@Param('id', ParseUUIDPipe) scenarioId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.open(scenarioId, user.id);
  }

  @Patch('scenarios/:id/courant')
  markCourant(@Param('id', ParseUUIDPipe) scenarioId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.markCourant(scenarioId, user.id);
  }

  @Patch('scenarios/:id/passe')
  close(@Param('id', ParseUUIDPipe) scenarioId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.close(scenarioId, user.id);
  }

  @Patch('scenarios/:id/resume-fin')
  setResumeFin(
    @Param('id', ParseUUIDPipe) scenarioId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetResumeFinDto,
  ) {
    return this.scenarios.setResumeFin(scenarioId, user.id, dto.resumeFin);
  }

  @Post('scenarios/:id/participate')
  participate(@Param('id', ParseUUIDPipe) scenarioId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.participate(scenarioId, user.id);
  }

  @Post('scenarios/:id/seances')
  addSeance(
    @Param('id', ParseUUIDPipe) scenarioId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto?: AddSeanceDto,
  ) {
    return this.scenarios.addSeance(scenarioId, user.id, dto?.durationSlots);
  }

  @Delete('scenarios/seances/:id')
  deleteSeance(@Param('id', ParseUUIDPipe) seanceId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.deleteSeance(seanceId, user.id);
  }

  @Post('scenarios/seances/:id/poll')
  createSeancePoll(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSeancePollDto,
  ) {
    return this.scenarios.createSeancePoll(
      seanceId,
      user.id,
      dto.options,
      dto.expiresAt,
      dto.durationSlots,
    );
  }

  @Patch('scenarios/seances/:id/reset-date')
  resetSeanceDate(@Param('id', ParseUUIDPipe) seanceId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.resetSeanceDate(seanceId, user.id);
  }

  @Patch('scenarios/seances/:id/capacite')
  setSeanceCapacity(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetSeanceCapacityDto,
  ) {
    return this.scenarios.setSeanceCapacity(
      seanceId,
      user.id,
      dto.inscriptionMin,
      dto.inscriptionMax,
    );
  }

  @Post('scenarios/seances/:id/inscription')
  inscrire(@Param('id', ParseUUIDPipe) seanceId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.inscrire(seanceId, user.id);
  }

  @Delete('scenarios/seances/:id/inscription')
  desinscrire(@Param('id', ParseUUIDPipe) seanceId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.desinscrire(seanceId, user.id);
  }

  /** Story 40.4 : accepter la place qui m'est réservée (groupe de ralliement). */
  @Patch('scenarios/seances/:id/inscription/accept')
  accepterReservation(@Param('id', ParseUUIDPipe) seanceId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.accepterReservation(seanceId, user.id);
  }

  /** Story 40.4 : l'hôte d'une conjonction réserve une place à un membre. */
  @Post('scenarios/seances/:id/reservations')
  reserver(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReservePlaceDto,
  ) {
    return this.scenarios.reserver(seanceId, user.id, dto.userId);
  }

  /** Story 40.4 : l'hôte retire la réservation d'un membre. */
  @Delete('scenarios/seances/:id/reservations/:userId')
  retirerReservation(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scenarios.retirerReservation(seanceId, user.id, targetUserId);
  }

  @Patch('scenarios/seances/:id/compte-rendu')
  setCompteRendu(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetCompteRenduDto,
  ) {
    return this.scenarios.setCompteRendu(seanceId, user.id, dto.compteRendu);
  }

  // Story 36.5 — informations pratiques (D-15). Un seul PATCH pour les trois champs : le MJ les
  // saisit ensemble. Comme partout dans ce contrôleur, l'autorisation MJ est vérifiée EN SERVICE
  // (PermissionService.assert), pas par un guard de route.
  @Patch('scenarios/seances/:id/infos-pratiques')
  setInfosPratiques(
    @Param('id', ParseUUIDPipe) seanceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetInfosPratiquesDto,
  ) {
    return this.scenarios.setInfosPratiques(seanceId, user.id, dto);
  }

  @Post('parties/:id/documents')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: DOCUMENT_UPLOAD_LIMITS,
    }),
  )
  uploadDocument(
    @Param('id', ParseUUIDPipe) partieId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_SIZE })],
        errorHttpStatusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      }),
    )
    file: Express.Multer.File,
    @Body('scenarioId') scenarioId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scenarios.uploadDocument(partieId, user.id, file, scenarioId);
  }

  @Get('scenarios/:id/documents')
  listDocuments(@Param('id', ParseUUIDPipe) scenarioId: string, @CurrentUser() user: AuthUser) {
    return this.scenarios.listDocuments(scenarioId, user.id);
  }

  @Get('parties/:id/documents')
  listLibraryDocuments(
    @Param('id', ParseUUIDPipe) partieId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scenarios.listLibraryDocuments(partieId, user.id);
  }

  @Get('documents/:id')
  async downloadDocument(
    @Param('id', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const { buffer, mime, originalName } = await this.scenarios.getDocumentFile(
      documentId,
      user.id,
    );
    return new StreamableFile(buffer, {
      type: mime,
      disposition: documentContentDisposition(originalName, mime),
    });
  }
}
