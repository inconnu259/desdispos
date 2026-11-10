import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { SouffleGroup } from '@master-jdr/game-rules';

// Page A4 portrait (points PDF, origine en bas à gauche), comme le gabarit officiel.
const PAGE_WIDTH = 595.276;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

const TITLE_SIZE = 18;
const SECTION_SIZE = 14;
const GROUP_SIZE = 12;
const NAME_SIZE = 11;
const BODY_SIZE = 10;
const NOTE_SIZE = 9;
const BODY_LEADING = 13;

const TEXT_COLOR = rgb(0.12, 0.12, 0.12);
const MUTED_COLOR = rgb(0.38, 0.38, 0.38);

export const SOUFFLES_PAGE_TITLE = 'Souffles de mon dragon';
const SOUFFLES_AUTRES_RACES_TITLE = 'Autres races (souffles multicolores)';
const NON_RESERVABLE_NOTE = 'ne peut pas être mis en réserve';

/** Caractère de remplacement d'un glyphe non encodable en WinAnsi. */
const REPLACEMENT_CHAR = '?';

/**
 * Remplace, dans `text`, tout caractère que la police standard `font` (jeu WinAnsi de pdf-lib) ne
 * sait pas encoder — `PDFFont.encodeText()` lève sinon (« WinAnsi cannot encode … ») et ferait
 * échouer tout l'export. Les retours à la ligne sont préservés, les tabulations deviennent des
 * espaces, chaque point de code (emoji compris) donne un seul remplaçant.
 */
export function sanitizeWinAnsi(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let out = '';
  // NFC d'abord : un accent décomposé (e + U+0301) redevient « é », encodable, au lieu de « ? ».
  for (const ch of text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')) {
    if (ch === '\n') out += ch;
    else out += supported.has(ch.codePointAt(0) as number) ? ch : REPLACEMENT_CHAR;
  }
  return out;
}

interface PageFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/** Coupe `text` en lignes de largeur ≤ `maxWidth` (retour à la ligne aux espaces, coupure dure
 * d'un mot plus large que la ligne). Les `\n` d'origine forcent un saut de ligne. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter((w) => w.length > 0);
    let current = '';
    const flush = () => {
      if (current) lines.push(current);
      current = '';
    };
    for (let word of words) {
      // Mot plus large que la ligne : coupé au caractère près.
      while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
        flush();
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        flush();
        current = word;
      } else {
        current = candidate;
      }
    }
    flush();
    if (words.length === 0) lines.push('');
  }
  return lines;
}

/**
 * Ajoute au document une ou plusieurs pages « Souffles de mon dragon » : pour chaque groupe de
 * `availableSouffles()`, le nom du souffle, son coût en PS, la mention « ne peut pas être mis en
 * réserve » le cas échéant, puis son effet (retour à la ligne automatique). Un souffle n'est
 * jamais coupé entre deux pages, et un titre de groupe n'est jamais seul en bas de page.
 *
 * N'ajoute AUCUNE page si `groups` est vide (catalogue `souffle` vide). Tout texte est assaini
 * pour WinAnsi : un glyphe non encodable est remplacé, jamais une erreur d'export. Retourne le
 * nombre de pages ajoutées.
 */
export async function drawSoufflesPages(doc: PDFDocument, groups: SouffleGroup[]): Promise<number> {
  if (groups.length === 0) return 0;

  const fonts: PageFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const clean = (t: string) => sanitizeWinAnsi(t, fonts.regular);

  let pagesAdded = 0;
  let page!: PDFPage;
  let y = 0;
  // Groupe dont l'en-tête est déjà dessiné : sert à le rappeler en tête d'une page de suite.
  let activeGroup: SouffleGroup | null = null;

  const newPage = (continued: boolean): void => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pagesAdded++;
    y = PAGE_HEIGHT - MARGIN_TOP;
    const title = clean(continued ? `${SOUFFLES_PAGE_TITLE} (suite)` : SOUFFLES_PAGE_TITLE);
    page.drawText(title, {
      x: MARGIN_X,
      y: y - TITLE_SIZE,
      size: TITLE_SIZE,
      font: fonts.bold,
      color: TEXT_COLOR,
    });
    y -= TITLE_SIZE + 18;

    // Page de suite au milieu d'un groupe : rappeler la section (autres races) et le groupe, pour
    // que le lecteur sache à quoi appartiennent les souffles qui suivent.
    if (continued && activeGroup) {
      if (activeGroup.section === 'autres-races') {
        drawLine(clean(SOUFFLES_AUTRES_RACES_TITLE), fonts.bold, SECTION_SIZE);
        y -= SECTION_SIZE + 10;
      }
      drawLine(clean(`${activeGroup.title} (suite)`), fonts.bold, GROUP_SIZE);
      y -= GROUP_SIZE + 6;
    }
  };

  const ensureRoom = (height: number): void => {
    if (y - height < MARGIN_BOTTOM) newPage(true);
  };

  const drawLine = (text: string, font: PDFFont, size: number, color = TEXT_COLOR): void => {
    page.drawText(text, { x: MARGIN_X, y: y - size, font, size, color });
  };

  // Mise en page d'un souffle (nom, mention, lignes d'effet, hauteur) — calculée avant dessin pour
  // décider du saut de page sans jamais couper un souffle en deux.
  const layoutBlock = (souffle: SouffleGroup['souffles'][number]) => {
    const name = clean(souffle.label);
    const meta: string[] = [];
    if (souffle.ps !== null) meta.push(`${souffle.ps} PS`);
    if (!souffle.reservable) meta.push(NON_RESERVABLE_NOTE);
    const description = clean(souffle.description).trim();
    const lines = description ? wrapText(description, fonts.regular, BODY_SIZE, CONTENT_WIDTH) : [];
    return {
      name,
      metaText: meta.length > 0 ? clean(`  -  ${meta.join('  -  ')}`) : '',
      lines,
      height: NAME_SIZE + 4 + lines.length * BODY_LEADING + 8,
    };
  };

  newPage(false);

  let autresRacesTitled = false;
  for (const group of groups) {
    activeGroup = null;
    const blocks = group.souffles.map(layoutBlock);
    const sectionTitleNeeded = group.section === 'autres-races' && !autresRacesTitled;
    const groupHeaderHeight =
      (sectionTitleNeeded ? SECTION_SIZE + 10 : 0) +
      GROUP_SIZE +
      6 +
      (group.consigne ? NOTE_SIZE + 6 : 0);

    // Le titre de groupe reste avec au moins son premier souffle.
    ensureRoom(groupHeaderHeight + (blocks[0]?.height ?? 0));

    if (sectionTitleNeeded) {
      autresRacesTitled = true;
      drawLine(clean(SOUFFLES_AUTRES_RACES_TITLE), fonts.bold, SECTION_SIZE);
      y -= SECTION_SIZE + 10;
    }
    drawLine(clean(group.title), fonts.bold, GROUP_SIZE);
    y -= GROUP_SIZE + 6;
    if (group.consigne) {
      drawLine(clean(group.consigne), fonts.italic, NOTE_SIZE, MUTED_COLOR);
      y -= NOTE_SIZE + 6;
    }
    activeGroup = group;

    for (const block of blocks) {
      ensureRoom(block.height);
      drawLine(block.name, fonts.bold, NAME_SIZE);
      if (block.metaText) {
        page.drawText(block.metaText, {
          x: MARGIN_X + fonts.bold.widthOfTextAtSize(block.name, NAME_SIZE),
          y: y - NAME_SIZE,
          font: fonts.regular,
          size: NOTE_SIZE,
          color: MUTED_COLOR,
        });
      }
      y -= NAME_SIZE + 4;
      for (const line of block.lines) {
        drawLine(line, fonts.regular, BODY_SIZE);
        y -= BODY_LEADING;
      }
      y -= 8;
    }
    y -= 6;
  }

  return pagesAdded;
}
