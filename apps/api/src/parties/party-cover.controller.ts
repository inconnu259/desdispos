import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { PartiesService } from './parties.service';
import { GetCoverDto } from './dto/get-cover.dto';

// Redéclaré, jamais factorisé dans l'utilitaire partagé (AC6, AD-17) — même valeur que
// `characters.controller.ts:MAX_PORTRAIT_SIZE`, mais un décorateur de classe ne peut pas lire une
// constante importée d'un autre domaine sans perdre la garantie d'indépendance qu'AD-17 demande.
const MAX_COVER_SIZE = 5 * 1024 * 1024;
// Plafonds du formulaire multipart : UN fichier et quelques champs texte courts. Sans eux, Multer accepte un
// nombre illimité de champs (jusqu'à 1 Mo chacun), lus en mémoire AVANT tout contrôle de droits.
const COVER_UPLOAD_LIMITS = {
  fileSize: MAX_COVER_SIZE,
  files: 1,
  fields: 5,
  parts: 6,
  fieldSize: 16 * 1024,
  fieldNameSize: 100,
};

/**
 * Endpoints d'image de couverture d'une partie (Story 29.12, AD-17/AD-19). Vit dans
 * `PartiesModule` : la Partie possède son image, pas un domaine séparé. **Jamais de fichier
 * statique** (AC8) — chaque lecture passe par ce contrôleur sous garde d'authentification.
 */
@UseGuards(AuthenticatedGuard)
@Controller('parties')
export class PartyCoverController {
  constructor(private readonly parties: PartiesService) {}

  @Get(':id/cover')
  async getCover(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetCoverDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.parties.getCoverFile(id, user.id, query.mode);
    if (!file) {
      // Review Findings : le Cache-Control ci-dessous ne doit JAMAIS s'appliquer à cette branche
      // — posé via `@Header()` (décorateur de méthode), il s'appliquerait aussi à ce 404, qu'un
      // navigateur/CDN mémoriserait alors comme « immuable » pendant un an (CAP-20 : un fichier
      // disparu du disque alors que la DB le référence encore est un état prévu, pas une erreur
      // rare). D'où un `res.set()` conditionnel dans la seule branche de succès, plutôt qu'un
      // `@Header()` déclaratif.
      throw new NotFoundException("Cette partie n'a pas de couverture");
    }
    // Cache-busting : le jeton de version (déjà porté par l'URL via le paramètre `v` que le front
    // ajoute, cf. `PartieDto.coverImageVersion`) suffit à invalider le cache navigateur après un
    // remplacement. L'ETag ci-dessous permet en plus une revalidation conditionnelle efficace.
    // `private` : la couverture est réservée aux membres connectés — un cache partagé (proxy, CDN) ne
    // doit jamais la garder et la resservir à d'autres.
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.set('ETag', `"${file.version}-${query.mode}"`);
    return new StreamableFile(file.buffer, { type: file.mime });
  }

  @Put(':id/cover')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Rejette la requête pendant le streaming, avant de bufferiser un fichier surdimensionné en
      // mémoire (le `ParseFilePipe` ci-dessous ne s'exécute qu'APRÈS que Multer a fini de lire le
      // body) — cf. `MulterExceptionFilter` pour le remappage de l'erreur Multer en 413.
      limits: COVER_UPLOAD_LIMITS,
    }),
  )
  setCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_COVER_SIZE })],
        errorHttpStatusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.parties.setCoverImage(id, user.id, file);
  }

  @Delete(':id/cover')
  removeCover(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.parties.removeCoverImage(id, user.id);
  }
}
