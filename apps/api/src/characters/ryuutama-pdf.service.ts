import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  type PDFImage,
} from 'pdf-lib';
import type { CharacterDto, DerivedStats } from '@master-jdr/shared';
import {
  mapToPdfFields,
  resolveWeapon,
  type RyuutamaSheetData,
  type RyuutamaPdfContent,
  type WeaponItemContentData,
  type WeaponCategoryContentData,
} from '@master-jdr/game-rules';
import { GameSystemService } from '../game-systems/game-system.service';
import { RYUUTAMA_ID } from '../game-systems/supported-game-systems';
import {
  MAX_PORTRAIT_OFFSET,
  MAX_PORTRAIT_SCALE,
  MIN_PORTRAIT_OFFSET,
  MIN_PORTRAIT_SCALE,
} from './dto/portrait-crop-data.dto';
import { readPortraitFile } from './character.service';

const PDF_TEMPLATE_PATH = join(
  process.cwd(),
  'game-systems/ryuutama/assets/Ryuutama_fiche_de_voyageur_big_edit.pdf',
);

// Story 31.6 : stub neutre passé à `mapToPdfFields()` (packages/game-rules) quand `derived` est
// ABSENT (verrouillé pour ce lecteur) — cette fonction lit `derived.PV`/`PE`/`Initiative` sans
// garde (hors périmètre de cette story, cf. spec Code Map). Le stub évite le crash ; les 3 champs
// AcroForm qui en dépendent sont ensuite retirés nous-mêmes (`DERIVED_PDF_FIELDS`) plutôt que de
// laisser des zéros trompeurs dans le PDF.
const DEFAULT_DERIVED_STATS: DerivedStats = {
  PV: 0,
  PE: 0,
  Condition: 0,
  Initiative: 0,
  Encombrement: 0,
};
const DERIVED_PDF_FIELDS = new Set(['PV max', 'PE max', 'Initiative']);

// Story 31.6 (revue de code) : `AGI`/`ESP`/`INT`/`VIG` sont des dropdowns PDF — un SEUL sous-champ
// verrouillé (`sheetData.attributes` reste présent, seule la clé ciblée est retirée par le masque)
// fait produire `String(undefined)` = `"undefined"` par `mapToPdfFields()` pour le dropdown
// correspondant, une option qui n'existe pas sur le template : pdf-lib lève. Retirés nous-mêmes
// (même patron que `DERIVED_PDF_FIELDS`) plutôt que de planter l'export.
const ATTRIBUTE_PDF_FIELDS = ['AGI', 'ESP', 'INT', 'VIG'] as const;

/**
 * Zone du portrait sur la page 1 du template — le cadre orné (vignes/feuilles) en haut à
 * droite de la page, au-dessus de la ligne HD/Créé le. Coordonnées **vérifiées visuellement**
 * (rendu de la page via PyMuPDF à 4x zoom, mesure par scan de pixels sur les 4 bords du cadre
 * à plusieurs positions, croisée avec les champs AcroForm voisins connus, confirmée par une
 * incrustation de vérification superposée sur le rendu réel) — bord intérieur du cadre.
 * Remplace l'estimation initiale (90×110, jamais vérifiée) très en-deçà de la vraie zone et
 * mal positionnée, cf. captures utilisateur lors de la revue de la Story 4.6.
 * Dupliquées avec `RYUUTAMA_PDF_PORTRAIT_WIDTH/HEIGHT` (`@master-jdr/shared`, consommées par
 * `PortraitCropper` côté web). Héritage, plus une nécessité : la duplication datait d'une époque
 * où Jest ne transformait pas ce package comme dépendance de workspace (`node_modules`, hors
 * `rootDir` de l'API), et où tout import de valeur runtime cassait la suite `api`
 * (`SyntaxError: Unexpected token 'export'`). `transformIgnorePatterns` couvre désormais
 * `@master-jdr/shared` et l'API importe déjà des valeurs de ce package (`GAME_SYSTEMS` dans
 * `parties/dto/create-partie.dto.ts`, `THEMES` dans `auth/auth.service.ts`) : ces constantes
 * pourraient donc être importées plutôt que redéclarées. Tant que ce n'est pas fait, si ces
 * valeurs changent, mettre à jour les deux emplacements.
 */
const PORTRAIT_X = 344.87;
const PORTRAIT_Y = 646.92;
const PORTRAIT_WIDTH = 188.18;
const PORTRAIT_HEIGHT = 136.48;

export type PdfExportFormat = 'editable' | '2pages';

export interface PdfPortraitCropData {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calcule position/taille pour dessiner une image centrée dans un cadre, en conservant son
 * ratio d'origine (équivalent PDF de `object-fit: contain` centré) — l'image ne déborde jamais
 * du cadre et n'est jamais déformée. Fonction pure, testable indépendamment de pdf-lib.
 */
export function fitCentered(
  imageWidth: number,
  imageHeight: number,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = frameX + (frameWidth - width) / 2;
  const y = frameY + (frameHeight - height) / 2;
  return { x, y, width, height };
}

/**
 * Calcule position/taille pour dessiner une image (surdimensionnée puis clippée au cadre, cf.
 * `embedPortrait`) selon un recadrage utilisateur `{ scale, offsetX, offsetY }` (Story 4.7,
 * même forme que `PortraitCropDataDto` / le widget `PortraitCropper` web).
 *
 * Reproduit visuellement `object-fit: contain` (base, `scale=1` montre l'image entière, jamais
 * rognée — contrairement à `cover` qui masquerait toujours une partie de l'image si son ratio ne
 * correspond pas à celui du cadre) + `transform: translate(offsetX%, offsetY%) scale(scale)`
 * (CSS, `PortraitCropper`) pour zoomer/déplacer au-delà de cette vue de base (fonction pure,
 * testable indépendamment de `pdf-lib`).
 */
export function computePdfCropDraw(
  imageWidth: number,
  imageHeight: number,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number,
  cropData: PdfPortraitCropData,
): { x: number; y: number; width: number; height: number } {
  const containScale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const totalScale = containScale * cropData.scale;
  const width = imageWidth * totalScale;
  const height = imageHeight * totalScale;
  const baseX = frameX + (frameWidth - width) / 2;
  const baseY = frameY + (frameHeight - height) / 2;

  // Marge disponible avant que le cadre ne dépasse des bords de l'image mise à l'échelle — borne
  // l'offset pour ne jamais révéler de zone hors de l'image source. À scale=1 (contain), l'image
  // ne dépasse le cadre dans aucun axe : la marge est nulle, l'offset est entièrement ignoré
  // (aucun intérêt à déplacer une image déjà entièrement visible).
  const maxOffsetXPixels = Math.max(0, (width - frameWidth) / 2);
  const maxOffsetYPixels = Math.max(0, (height - frameHeight) / 2);
  // Un pourcentage CSS dans `translate()` se résout contre la boîte de layout de l'élément
  // (ici : le cadre/conteneur, taille fixe), PAS contre sa taille une fois `scale()` appliqué
  // dans le même `transform` — sinon un même `offsetX` produirait un déplacement différent
  // selon le zoom, ce qui décorrèle visuellement l'export PDF de l'aperçu web.
  const offsetXPixels = Math.min(
    maxOffsetXPixels,
    Math.max(-maxOffsetXPixels, (cropData.offsetX / 100) * frameWidth),
  );
  const offsetYPixels = Math.min(
    maxOffsetYPixels,
    Math.max(-maxOffsetYPixels, (cropData.offsetY / 100) * frameHeight),
  );

  // CSS translate Y positif = vers le bas de l'écran ; l'axe Y de pdf-lib augmente vers le haut
  // de la page — un déplacement "vers le bas" côté web se traduit par une position Y décroissante.
  return { x: baseX + offsetXPixels, y: baseY - offsetYPixels, width, height };
}

/** Un nombre fini dans `[min, max]` — rejette `NaN`/`Infinity` en plus des valeurs hors bornes. */
function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Valide `scale`/`offsetX`/`offsetY` avec les mêmes bornes que `PortraitCropDataDto` (déjà
 * appliquées à l'écriture, cf. `updatePdfPortraitCrop`) — une donnée legacy/corrompue en base
 * (ou un accès direct à la colonne hors du chemin API validé) ne doit jamais atteindre
 * `computePdfCropDraw` avec un `NaN`/`Infinity`/hors bornes qui produirait une géométrie
 * dégénérée ; dégradation gracieuse vers `fitCentered` dans ce cas (cf. `embedPortrait`).
 */
function parsePdfPortraitCropData(value: unknown): PdfPortraitCropData | null {
  if (typeof value !== 'object' || value === null) return null;
  const { scale, offsetX, offsetY } = value as PdfPortraitCropData;
  if (
    !isFiniteInRange(scale, MIN_PORTRAIT_SCALE, MAX_PORTRAIT_SCALE) ||
    !isFiniteInRange(offsetX, MIN_PORTRAIT_OFFSET, MAX_PORTRAIT_OFFSET) ||
    !isFiniteInRange(offsetY, MIN_PORTRAIT_OFFSET, MAX_PORTRAIT_OFFSET)
  ) {
    return null;
  }
  return { scale, offsetX, offsetY };
}

interface ClassContentData {
  label: string;
  talents: {
    name: string;
    effect: { description: string; conditions: string };
    attributes?: string[];
  }[];
}

interface TypeContentData {
  label: string;
}

interface LabelledContentData {
  label: string;
}

/** Construit une map `key → label` depuis une liste d'entrées de contenu seedé (`ContentEntryDto[]`). */
function labelMap(entries: { key: string; data: unknown }[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries ?? []) {
    const label = (entry.data as LabelledContentData | undefined)?.label;
    if (label) map[entry.key] = label;
  }
  return map;
}

@Injectable()
export class RyuutamaPdfService {
  private readonly logger = new Logger(RyuutamaPdfService.name);
  private templatePromise: Promise<Buffer> | null = null;

  constructor(private readonly gameSystems: GameSystemService) {}

  async fillCharacterPdf(character: CharacterDto, format: PdfExportFormat): Promise<Buffer> {
    const templateBytes = await this.loadTemplate();
    const sheetData = character.sheetData as unknown as RyuutamaSheetData;
    const derived = character.derived;
    const content = await this.resolveContent(sheetData, character.ownerPseudo, character.xp);

    const rawFields = mapToPdfFields(sheetData, derived ?? DEFAULT_DERIVED_STATS, content);
    // Story 31.6 : `derived` (typé plein dans `CharacterDto`) peut être absent à l'exécution quand
    // `attributes`/`levelUps` est verrouillé pour ce lecteur (`hiddenFields` le signale) — retire
    // les champs qui en dérivent plutôt que d'exporter le stub ci-dessus. `attributes` (typé plein
    // dans `RyuutamaSheetData`) peut, de la même façon, avoir un sous-champ individuel absent
    // (verrouillage ciblé, ex. `attributes.AGI`) sans que la clé `attributes` elle-même disparaisse
    // — retire alors le seul dropdown concerné (cf. `ATTRIBUTE_PDF_FIELDS`).
    const fields = rawFields.filter((f) => {
      if (!derived && DERIVED_PDF_FIELDS.has(f.field)) return false;
      if (
        (ATTRIBUTE_PDF_FIELDS as readonly string[]).includes(f.field) &&
        sheetData.attributes?.[f.field as (typeof ATTRIBUTE_PDF_FIELDS)[number]] === undefined
      ) {
        return false;
      }
      return true;
    });
    // Champs auto-size du template officiel (résistances par terrain, statuts d'immunité) :
    // leur `DA` (`/Font 0 Tf`) laisse pdf-lib calculer une taille disproportionnée pour un texte
    // aussi court ("+2"/"Immunisé") — forcer une petite taille explicite, alignée sur les champs
    // normaux du template qui utilisent ~9-14pt selon leur hauteur réelle (constaté visuellement,
    // à réajuster si besoin après un export réel).
    const smallFontFields = new Set([
      ...Object.values(content.capabilityLabels?.landscape ?? {}),
      ...Object.values(content.capabilityLabels?.immunity ?? {}),
    ]);

    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();
    for (const f of fields) {
      if (!f.value) continue;
      try {
        if (f.kind === 'text') {
          const textField = form.getTextField(f.field);
          if (smallFontFields.has(f.field)) textField.setFontSize(8);
          textField.setText(f.value);
        } else {
          form.getDropdown(f.field).select(f.value);
        }
      } catch (e) {
        this.logger.error(
          `Échec du remplissage du champ PDF "${f.field}" (kind=${f.kind}, value=${f.value})`,
          e,
        );
        throw new Error(
          `Champ PDF "${f.field}" introuvable ou incompatible sur le template Ryuutama. Vérifiez apps/api/game-systems/ryuutama/assets/README.md.`,
        );
      }
    }
    await this.embedPortrait(doc, character.portraitUrl, character.pdfPortraitCropData);

    if (format === '2pages') {
      form.flatten();
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  /**
   * Dessine le portrait dans la zone dédiée de la page 1 (pas un champ AcroForm, cf.
   * `PORTRAIT_X/Y/WIDTH/HEIGHT`). Ne fait rien si le personnage n'a pas de portrait (AC6) —
   * la zone reste vide, cohérent avec le comportement déjà établi pour `PortraitPanel` sur le
   * web. `pdf-lib` 1.x ne sait embarquer que JPEG/PNG (`embedJpg`/`embedPng`) — pas de méthode
   * WEBP native : un portrait WEBP reste visible sur le web mais n'apparaît pas dans le PDF
   * pour ce palier (limitation documentée, pas un bug).
   *
   * Si `pdfPortraitCropData` est renseigné (Story 4.7), applique ce recadrage utilisateur au lieu
   * du centrage automatique `fitCentered` (Story 4.6, AC4 — comportement inchangé sans recadrage
   * dédié). `pdf-lib` ne sait pas dessiner une sous-région d'une image embarquée : l'image
   * surdimensionnée est dessinée puis clippée au cadre via un clip path bas niveau
   * (`pushGraphicsState`/`rectangle`/`clip`/`endPath`/`popGraphicsState`).
   */
  private async embedPortrait(
    doc: PDFDocument,
    portraitUrl: string | null,
    pdfPortraitCropData: unknown,
  ): Promise<void> {
    const portrait = await readPortraitFile(portraitUrl);
    if (!portrait) return;

    if (portrait.mime !== 'image/jpeg' && portrait.mime !== 'image/png') {
      this.logger.warn(
        `Portrait au format ${portrait.mime} non embarquable dans le PDF (pdf-lib ne supporte que JPEG/PNG) — zone laissée vide.`,
      );
      return;
    }

    let image: PDFImage;
    try {
      image =
        portrait.mime === 'image/jpeg'
          ? await doc.embedJpg(portrait.buffer)
          : await doc.embedPng(portrait.buffer);
    } catch (e) {
      // Un portrait a passé la validation par octets magiques à l'upload (Story 4.5) mais peut
      // rester rejeté par le parseur strict de pdf-lib (fichier tronqué/corrompu) — ne jamais
      // faire échouer tout l'export PDF pour ça, la zone reste simplement vide (dégradation
      // gracieuse, cohérent avec AC6).
      this.logger.warn(
        "Échec de l'intégration du portrait dans le PDF — zone laissée vide",
        e as Error,
      );
      return;
    }

    if (image.width <= 0 || image.height <= 0) {
      // Image embarquée de dimensions dégénérées (0×0) — extrêmement improbable après un passage
      // réussi par embedJpg/embedPng, mais fitCentered/computePdfCropDraw diviseraient par zéro
      // (NaN/Infinity) sans cette garde. Dégradation gracieuse : zone laissée vide, comme un
      // portrait manquant (AC6).
      this.logger.warn(
        `Portrait embarqué avec des dimensions invalides (${image.width}×${image.height}) — zone laissée vide.`,
      );
      return;
    }

    const pages = doc.getPages();
    const page = pages[0];
    if (!page) {
      throw new Error('Template PDF Ryuutama sans page — fichier corrompu ou mal chargé.');
    }
    const cropData = parsePdfPortraitCropData(pdfPortraitCropData);
    if (cropData) {
      const { x, y, width, height } = computePdfCropDraw(
        image.width,
        image.height,
        PORTRAIT_X,
        PORTRAIT_Y,
        PORTRAIT_WIDTH,
        PORTRAIT_HEIGHT,
        cropData,
      );
      page.pushOperators(
        pushGraphicsState(),
        rectangle(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_WIDTH, PORTRAIT_HEIGHT),
        clip(),
        endPath(),
      );
      try {
        page.drawImage(image, { x, y, width, height });
      } finally {
        // Toujours dépiler l'état graphique, même si `drawImage` lève — sinon la pile
        // push/pop de la page resterait déséquilibrée pour tout ce qui serait dessiné après.
        page.pushOperators(popGraphicsState());
      }
      return;
    }

    const { x, y, width, height } = fitCentered(
      image.width,
      image.height,
      PORTRAIT_X,
      PORTRAIT_Y,
      PORTRAIT_WIDTH,
      PORTRAIT_HEIGHT,
    );
    page.drawImage(image, { x, y, width, height });
  }

  private loadTemplate(): Promise<Buffer> {
    if (!this.templatePromise) {
      this.templatePromise = readFile(PDF_TEMPLATE_PATH).catch((e) => {
        this.templatePromise = null;
        this.logger.error('Échec du chargement du template PDF Ryuutama', e);
        throw new Error(
          'Template PDF Ryuutama introuvable. Consultez apps/api/game-systems/ryuutama/assets/README.md',
        );
      });
    }
    return this.templatePromise;
  }

  private async resolveContent(
    sheetData: RyuutamaSheetData,
    ownerPseudo: string,
    xp: number,
  ): Promise<RyuutamaPdfContent> {
    const content = await this.gameSystems.getContent(RYUUTAMA_ID);
    const classEntry = content['class']?.find((c) => c.key === sheetData.classId);
    const typeEntry = content['type']?.find((t) => t.key === sheetData.typeId);
    const classData = classEntry?.data as ClassContentData | undefined;
    const typeData = typeEntry?.data as TypeContentData | undefined;

    // Story 25.1 : la catégorie (et ses formules) se dérive désormais de `weaponId` à la lecture,
    // jamais stockée en double — résolue une seule fois ici, jamais recalculée par pdf-field-map.ts.
    // Story 25.2 : `resolveWeapon` couvre aussi l'arme libre (`customWeapon`), priorité à `weaponId`.
    const resolvedWeapon = resolveWeapon(
      { weaponId: sheetData.weaponId, customWeapon: sheetData.customWeapon },
      {
        weaponItems: (content['weaponItem'] ?? []).map((entry) => ({
          key: entry.key,
          ...(entry.data as WeaponItemContentData),
        })),
        weaponCategories: (content['weaponCategory'] ?? []).map((entry) => ({
          key: entry.key,
          ...(entry.data as WeaponCategoryContentData),
        })),
      },
    );

    const levelUps = sheetData.levelUps ?? [];
    // Chaque montée de niveau accorde 1 ou 2 capacités (niveaux 4/6/10) — aplatir pour retrouver
    // une capacité par type, quel que soit le niveau qui l'a octroyée.
    const capabilities = levelUps.flatMap((e) => e.capabilities);
    // Classe secondaire (capacité 'class', niveau 5) — un seul choix possible par LEVEL_TABLE,
    // pas de boucle nécessaire (contrairement au paysage/climat, obtenu jusqu'à 2 fois).
    const secondaryClassKey = capabilities.find((c) => c.type === 'class')?.params['key'] as
      string | undefined;
    const secondaryClassData = content['class']?.find((c) => c.key === secondaryClassKey)?.data as
      ClassContentData | undefined;

    // Paysage/climat résumé (dropdown "Paysage climat") : un seul champ pour jusqu'à 2 obtenus
    // (niveaux 3 et 7) — le premier obtenu, faute de pouvoir en représenter deux sur ce dropdown
    // (les 22 champs de résistance individuels, eux, couvrent chaque paysage obtenu séparément).
    const landscapeKey = capabilities.find((c) => c.type === 'landscape')?.params['key'] as
      string | undefined;
    const landscapeDropdownValue = content['landscape']?.find((l) => l.key === landscapeKey)
      ?.data as { label?: string } | undefined;

    return {
      classLabel: classData?.label ?? '',
      classTalents: classData?.talents ?? [],
      typeLabel: typeData?.label ?? '',
      weaponLabel: resolvedWeapon?.weaponLabel ?? '',
      weaponTouchFormula: resolvedWeapon?.touchFormula ?? '',
      weaponDamageFormula: resolvedWeapon?.damageFormula ?? '',
      weaponCategoryId: resolvedWeapon?.categoryId ?? '',
      ownerPseudo,
      xp,
      secondaryClassLabel: secondaryClassData?.label,
      secondaryClassTalents: secondaryClassData?.talents,
      landscapeDropdownValue: landscapeDropdownValue?.label,
      capabilityLabels: {
        landscape: labelMap(content['landscape']),
        immunity: labelMap(content['immunityState']),
        class: labelMap(content['class']),
      },
    };
  }
}
