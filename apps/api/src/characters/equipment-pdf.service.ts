import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { CharacterDto } from '@master-jdr/shared';
import { mapEquipmentToPdfFields, type RyuutamaSheetData } from '@master-jdr/game-rules';

const PDF_TEMPLATE_PATH = join(
  process.cwd(),
  'game-systems/ryuutama/assets/Ryuutama-fiche_equipement_edit.pdf',
);

// Story 31.6 (revue de code) : nom du champ AcroForm rempli depuis `encombrementLimit`
// (`mapEquipmentToPdfFields`, packages/game-rules/src/ryuutama/equipment-pdf-field-map.ts) — retiré
// plutôt qu'exporté avec un `0` trompeur quand `derived` est absent (même patron que
// `DERIVED_PDF_FIELDS` dans `RyuutamaPdfService`).
const ENCOMBREMENT_PDF_FIELD = 'limite_enc';

@Injectable()
export class EquipmentPdfService {
  private readonly logger = new Logger(EquipmentPdfService.name);
  private templatePromise: Promise<Buffer> | null = null;

  async fillEquipmentPdf(character: CharacterDto): Promise<Buffer> {
    const templateBytes = await this.loadTemplate();
    const sheetData = character.sheetData as unknown as RyuutamaSheetData;

    // Deferred-work (2026-08-24) — garde-fou informationnel : la migration one-off Story 14.1
    // (`migrateEquipmentUnify`) est censée avoir traité toute fiche pré-existante, mais rien ne
    // signalait plus une fiche qui aurait échappé à cette migration. `group` n'existe pas sur
    // `RyuutamaSheetData['equipment']` (type courant) — un survivant ne peut donc venir que d'une
    // donnée non migrée en base.
    const legacyGroup = (sheetData.equipment as { group?: unknown } | undefined)?.group;
    if (Array.isArray(legacyGroup) && legacyGroup.length > 0) {
      this.logger.warn(
        `Personnage ${character.id} porte encore un equipment.group non migré (${legacyGroup.length} entrée(s)), ignoré silencieusement par l'export PDF.`,
      );
    }

    const rawFields = mapEquipmentToPdfFields({
      ownerPseudo: character.ownerPseudo,
      characterName: sheetData.narrative?.name ?? '',
      // Story 31.6 : `derived` (typé plein dans `CharacterDto`) peut être ABSENT à l'exécution
      // quand `attributes`/`levelUps` est verrouillé pour ce lecteur (`hiddenFields` le signale) —
      // le `?? 0` évite un crash sur `EquipmentPdfInput.encombrementLimit: number` (non-optionnel),
      // le champ PDF correspondant est ensuite retiré ci-dessous plutôt qu'exporté à `0`.
      encombrementLimit: character.derived?.Encombrement ?? 0,
      equipment: {
        individual: (sheetData.equipment?.individual ?? []).map((i) => ({
          name: i.name,
          weight: i.weight,
          price: i.price,
          effect: i.effect,
        })),
        contenants: (sheetData.equipment?.contenants ?? []).map((c) => ({
          name: c.name,
          weight: c.weight,
          price: c.price,
          effect: c.effect,
        })),
        animaux: (sheetData.equipment?.animaux ?? []).map((a) => ({
          name: a.name,
          price: a.price,
          effect: a.effect,
        })),
      },
    });
    // Retire `limite_enc` (jamais un `0` trompeur) quand `derived` est absent — cohérent avec
    // `RyuutamaPdfService` (revue de code, même état masqué traité de façon identique).
    const fields = character.derived
      ? rawFields
      : rawFields.filter((f) => f.field !== ENCOMBREMENT_PDF_FIELD);

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
        // pdf-lib (setText) — même convention que HommeDragonPdfService (Story 10.5, revue de code).
        throw new Error(
          `Champ PDF "${f.field}" introuvable/incompatible sur le template équipement Ryuutama, ou valeur non encodable. Vérifiez apps/api/game-systems/ryuutama/assets/README.md.`,
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
        this.logger.error('Échec du chargement du template PDF équipement Ryuutama', e);
        throw new Error(
          'Template PDF équipement Ryuutama introuvable. Consultez apps/api/game-systems/ryuutama/assets/README.md',
        );
      });
    }
    return this.templatePromise;
  }
}
