import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import type { HommeDragonDto, HommeDragonRace } from '@master-jdr/shared';
import { availableSouffles, mapHommeDragonToPdfFields } from '@master-jdr/game-rules';
import type { SouffleCatalogEntry } from '@master-jdr/game-rules';
import { GameSystemService } from '../game-systems/game-system.service';
import { RYUUTAMA_ID } from '../game-systems/supported-game-systems';
import type { HommeDragonPdfFormat } from './dto/export-homme-dragon-pdf.dto';
import { drawSoufflesPages, sanitizeWinAnsi } from './homme-dragon-souffles-pages';

const PDF_TEMPLATE_PATH = join(
  process.cwd(),
  'game-systems/ryuutama/assets/Ryuutama_fiche_homme-dragon_big_edit.pdf',
);

/** Dupliquée depuis `homme-dragon-sheet.ts` (frontend) plutôt que partagée : `@master-jdr/shared`
 * est une frontière types-only, effacée au runtime (même contrainte déjà documentée dans
 * `ryuutama-pdf.service.ts` pour `RYUUTAMA_PDF_PORTRAIT_WIDTH/HEIGHT`). */
const RACE_LABELS: Record<HommeDragonRace, string> = {
  DRAGON_VERT: 'Dragon Vert',
  DRAGON_BLEU: 'Dragon Bleu',
  DRAGON_ROUGE: 'Dragon Rouge',
  DRAGON_NOIR: 'Dragon Noir',
};

/** Taille de police intermédiaire des champs du gabarit : le gabarit officiel met la plupart des
 * champs à 12 pt (les textes longs — inscription, scénario, date — débordent) alors que
 * « Apparence - Caractère » est à 9 pt ; 10,5 pt tient entre les deux. */
const FIELD_FONT_SIZE = 10.5;

/** Champs déjà plus petits dans le gabarit (zones multilignes et lignes « Voyageurs : ») : leur
 * taille d'origine est conservée, elle est plus petite que `FIELD_FONT_SIZE`. */
const KEEP_TEMPLATE_FONT_SIZE = /^(apparence_caractere|voyageurs_proteges_\d+|voy_sc_\d+)$/;

@Injectable()
export class HommeDragonPdfService {
  private readonly logger = new Logger(HommeDragonPdfService.name);
  private templatePromise: Promise<Buffer> | null = null;

  constructor(private readonly gameSystems: GameSystemService) {}

  async fillHommeDragonPdf(
    hommeDragon: HommeDragonDto,
    mjPseudo: string,
    format: HommeDragonPdfFormat,
  ): Promise<Buffer> {
    const templateBytes = await this.loadTemplate();
    const catalogues = await this.resolveCatalogues(hommeDragon.sheetData.artefact.key);

    const fields = mapHommeDragonToPdfFields(hommeDragon, {
      raceLabel: RACE_LABELS[hommeDragon.sheetData.race],
      mjPseudo,
      eveilPowerLabels: catalogues.eveilPowerLabels,
      artefactLabel: catalogues.artefactLabel,
      reserveLabels: catalogues.reserveLabels,
    });

    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();
    // Police par défaut des champs du formulaire (Helvetica, WinAnsi) : sert à remplacer tout
    // caractère non encodable — un nom ou un libellé exotique ne doit jamais faire échouer l'export.
    const fieldFont = await doc.embedFont(StandardFonts.Helvetica);
    // Taille appliquée à TOUS les champs texte (remplis ou non) : en format éditable, ce que le MJ
    // écrit à la main dans une case vide (éveil, cases de réserve…) garde la même taille.
    for (const field of form.getFields()) {
      if (!(field instanceof PDFTextField) || KEEP_TEMPLATE_FONT_SIZE.test(field.getName()))
        continue;
      try {
        // `nombre_souffles` n'a aucun /DA dans le gabarit (taille auto, donc trop grande pour la
        // case « Nombre Max ») : on lui en donne un explicite, avec la police du gabarit (`Helv`).
        if (field.acroField.getDefaultAppearance() === undefined) {
          field.acroField.setDefaultAppearance(`/Helv ${FIELD_FONT_SIZE} Tf 0 g`);
        } else {
          field.setFontSize(FIELD_FONT_SIZE);
        }
      } catch (e) {
        // `setFontSize` lève si le champ n'a pas de taille dans son /DA : il garde alors sa taille.
        this.logger.warn(`Taille de police non appliquée au champ PDF "${field.getName()}"`, e);
      }
    }
    for (const f of fields) {
      if (!f.value) continue;
      try {
        form.getTextField(f.field).setText(sanitizeWinAnsi(f.value, fieldFont));
      } catch (e) {
        this.logger.error(`Échec du remplissage du champ PDF "${f.field}" (value=${f.value})`, e);
        throw new Error(
          `Champ PDF "${f.field}" introuvable/incompatible sur le template Homme Dragon. Vérifiez apps/api/game-systems/ryuutama/assets/README.md.`,
        );
      }
    }

    // Les souffles ne tiennent pas dans le gabarit (4 cases de réserve seulement) : pages ajoutées
    // après lui, identiques dans les deux formats. Aucune page si le catalogue est vide.
    const groups = availableSouffles(
      hommeDragon.derived.level,
      hommeDragon.sheetData.race,
      catalogues.souffles,
    );
    await drawSoufflesPages(doc, groups);

    if (format === '2pages') {
      form.flatten();
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  private loadTemplate(): Promise<Buffer> {
    if (!this.templatePromise) {
      this.templatePromise = readFile(PDF_TEMPLATE_PATH).catch((e) => {
        this.templatePromise = null;
        this.logger.error('Échec du chargement du template PDF Homme Dragon', e);
        throw new Error(
          'Template PDF Homme Dragon introuvable. Consultez apps/api/game-systems/ryuutama/assets/README.md',
        );
      });
    }
    return this.templatePromise;
  }

  /** Catalogues Ryuutama utiles à l'export, résolus en un seul `getContent()` : libellés des
   * pouvoirs d'éveil, libellé de l'artefact, entrées `souffle` (jamais `eveilPower` pour ces
   * dernières — éveils et souffles restent distincts) et table clé → libellé des souffles et des
   * souffles rituels pour les cases de la réserve (`souffle_1..4`, Story 33.6). */
  private async resolveCatalogues(artefactKey: string): Promise<{
    eveilPowerLabels: Record<string, string>;
    artefactLabel: string | undefined;
    souffles: SouffleCatalogEntry[];
    reserveLabels: Record<string, string>;
  }> {
    const content = await this.gameSystems.getContent(RYUUTAMA_ID);
    const eveilPowerLabels: Record<string, string> = {};
    for (const entry of content['eveilPower'] ?? []) {
      const label = (entry.data as { label?: string })?.label;
      if (label) eveilPowerLabels[entry.key] = label;
    }
    const artefactEntry = (content['hommeDragonArtefact'] ?? []).find((e) => e.key === artefactKey);
    const artefactLabel =
      (artefactEntry?.data as { label?: string } | undefined)?.label || undefined;
    const reserveLabels: Record<string, string> = {};
    for (const entry of [...(content['souffle'] ?? []), ...(content['souffleRituel'] ?? [])]) {
      const label = (entry.data as { label?: string })?.label;
      if (label) reserveLabels[entry.key] = label;
    }
    return { eveilPowerLabels, artefactLabel, souffles: content['souffle'] ?? [], reserveLabels };
  }
}
