import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PORTRAITS_DIR, extractPortraitFilename } from '../characters/portrait-paths';
import { COVERS_DIR, coverImageVersion } from '../parties/parties.service';
import { DOCUMENTS_DIR } from '../scenarios/document-storage.util';
import { isValidUploadFilename } from '../common/image-upload.util';
import { isValidDocumentFilename } from '../scenarios/document-mime.util';

/** Un fichier non référencé plus jeune que ça est peut-être en cours d'envoi (écrit sur disque juste avant
 *  la ligne en base) : on n'y touche pas. */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

const COVER_DERIVATIVE_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(large|medium|compact)\.webp$/i;

interface UploadFolder {
  dir: string;
  /** Le nom a-t-il la forme d'un fichier que NOUS écrivons ? (on n'efface jamais autre chose) */
  isOurs: (name: string) => boolean;
  /** Clé de référence en base pour ce nom (nom de fichier, ou stem pour les couvertures). */
  keyOf: (name: string) => string;
  /** Clés référencées par au moins une ligne. */
  referenced: Set<string | null>;
}

/**
 * Efface les fichiers envoyés que plus aucune ligne ne référence (revue de sécurité 2026-11). Supprimer une
 * partie, un groupe ou un compte efface les lignes en CASCADE (personnages, documents, couverture) mais
 * jamais les fichiers : portraits et documents restaient sur le disque indéfiniment — y compris après
 * l'effacement d'un compte (RGPD). Un balayage unique couvre tous ces chemins sans toucher à chaque
 * transaction : un fichier est effacé s'il a la forme d'un de nos fichiers, n'est référencé par aucune
 * ligne et a plus d'une heure.
 */
@Injectable()
export class OrphanUploadsService {
  private readonly logger = new Logger(OrphanUploadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(now: number = Date.now()): Promise<number> {
    const [characters, parties, documents] = await Promise.all([
      this.prisma.character.findMany({
        where: { portraitUrl: { not: null } },
        select: { portraitUrl: true },
      }),
      this.prisma.partie.findMany({
        where: { coverImageUrl: { not: null } },
        select: { coverImageUrl: true },
      }),
      this.prisma.scenarioDocument.findMany({ select: { filename: true } }),
    ]);
    const portraits = new Set(characters.map((c) => extractPortraitFilename(c.portraitUrl)));
    const coverStems = new Set(parties.map((p) => coverImageVersion(p.coverImageUrl)));
    const documentNames = new Set(documents.map((d) => d.filename));

    const folders: UploadFolder[] = [
      {
        dir: PORTRAITS_DIR,
        isOurs: isValidUploadFilename,
        keyOf: (n) => n,
        referenced: portraits,
      },
      {
        dir: COVERS_DIR,
        isOurs: (n) => COVER_DERIVATIVE_RE.test(n),
        keyOf: (n) => COVER_DERIVATIVE_RE.exec(n)?.[1] ?? n,
        referenced: coverStems,
      },
      {
        dir: DOCUMENTS_DIR,
        isOurs: isValidDocumentFilename,
        keyOf: (n) => n,
        referenced: documentNames,
      },
    ];

    let removed = 0;
    for (const folder of folders) {
      removed += await this.sweepFolder(folder, now);
    }
    if (removed > 0) this.logger.log(`${removed} fichier(s) envoyé(s) orphelin(s) effacé(s)`);
    return removed;
  }

  private async sweepFolder(folder: UploadFolder, now: number): Promise<number> {
    let names: string[];
    try {
      names = await readdir(folder.dir);
    } catch {
      return 0; // dossier encore jamais créé : rien à balayer
    }
    let removed = 0;
    for (const name of names) {
      if (!folder.isOurs(name) || folder.referenced.has(folder.keyOf(name))) continue;
      const path = join(folder.dir, name);
      try {
        const { mtimeMs } = await stat(path);
        if (now - mtimeMs < ORPHAN_GRACE_MS) continue;
        await unlink(path);
        removed += 1;
      } catch (e) {
        this.logger.warn(`Échec d'effacement du fichier orphelin ${path}`, e as Error);
      }
    }
    return removed;
  }
}
