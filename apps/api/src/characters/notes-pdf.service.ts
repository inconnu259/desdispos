import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { CharacterNoteDto } from '@desdispos/shared';
import { mapNotesToPdfFields } from '@desdispos/game-rules';

const PDF_TEMPLATE_PATH = join(
  process.cwd(),
  'game-systems/ryuutama/assets/Ryuutama_fiche_de_notes_edit.pdf',
);

@Injectable()
export class NotesPdfService {
  private readonly logger = new Logger(NotesPdfService.name);
  private templatePromise: Promise<Buffer> | null = null;

  /**
   * Reçoit `notes` déjà filtrées par confidentialité par l'appelant
   * (`CharacterService.getNotes()`, cf. Story 11.2 Dev Notes) — ce service ne fait aucune
   * vérification d'accès lui-même, il ne fait que mettre en page ce qu'on lui donne.
   */
  async fillNotesPdf(notes: CharacterNoteDto[]): Promise<Buffer> {
    const templateBytes = await this.loadTemplate();

    const fields = mapNotesToPdfFields({
      notes: notes.map((n) => ({ text: n.text, createdAt: n.createdAt })),
    });

    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();
    for (const f of fields) {
      if (!f.value) continue;
      try {
        form.getTextField(f.field).setText(f.value);
      } catch (e) {
        this.logger.error(`Échec du remplissage du champ PDF "${f.field}" (value=${f.value})`, e);
        // Deux causes distinctes partagent ce catch — champ AcroForm introuvable/incompatible sur
        // le template (getTextField) OU valeur contenant un caractère non encodable en WinAnsi par
        // pdf-lib (setText) — même convention que EquipmentPdfService (Story 11.1).
        throw new Error(
          `Champ PDF "${f.field}" introuvable/incompatible sur le template notes Ryuutama, ou valeur non encodable. Vérifiez apps/api/game-systems/ryuutama/assets/README.md.`,
        );
      }
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  private loadTemplate(): Promise<Buffer> {
    if (!this.templatePromise) {
      this.templatePromise = readFile(PDF_TEMPLATE_PATH).catch((e) => {
        this.templatePromise = null;
        this.logger.error('Échec du chargement du template PDF notes Ryuutama', e);
        throw new Error(
          'Template PDF notes Ryuutama introuvable. Consultez apps/api/game-systems/ryuutama/assets/README.md',
        );
      });
    }
    return this.templatePromise;
  }
}
