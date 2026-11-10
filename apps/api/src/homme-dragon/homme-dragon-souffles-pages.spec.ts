// pdf-lib RÉEL ici (pas de mock) : c'est l'encodeur WinAnsi et la mise en page qu'on éprouve.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import type { SouffleGroup } from '@master-jdr/game-rules';
import { drawSoufflesPages, sanitizeWinAnsi } from './homme-dragon-souffles-pages';

interface CatalogueEntry {
  key: string;
  label: string;
  description: string;
  ps: number;
  famille?: string;
  race?: string;
  reservable?: boolean;
}

/** Catalogue `souffle` RÉEL, tel que seedé — la garantie « aucun glyphe ne casse l'export » porte
 * sur les vraies données, pas sur un échantillon. */
const CATALOGUE = JSON.parse(
  readFileSync(join(process.cwd(), 'game-systems/ryuutama/data/souffles.json'), 'utf8'),
) as CatalogueEntry[];

function group(
  souffles: Partial<SouffleGroup['souffles'][number]>[],
  over: Partial<SouffleGroup> = {},
): SouffleGroup {
  return {
    section: 'communs',
    title: 'Souffles manipulant le destin',
    consigne: null,
    souffles: souffles.map((s, i) => ({
      key: `s${i}`,
      label: `Souffle ${i}`,
      description: 'Un effet.',
      ps: 1,
      reservable: true,
      ...s,
    })),
    ...over,
  };
}

describe('sanitizeWinAnsi', () => {
  let doc: PDFDocument;
  beforeAll(async () => {
    doc = await PDFDocument.create();
  });

  it('remplace un glyphe non encodable au lieu de lever, garde accents et apostrophes', async () => {
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const out = sanitizeWinAnsi("Élan d'été – Ω 龍 🐉 ", font);

    expect(out).toContain("Élan d'été");
    expect(out).not.toMatch(/[Ω龍🐉]/u);
    expect(() => font.encodeText(out)).not.toThrow();
  });

  it('un emoji (paire de substitution) donne un seul caractère de remplacement', async () => {
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(sanitizeWinAnsi('a🐉b', font)).toBe('a?b');
  });

  it('un accent décomposé (e + U+0301) redevient « é » au lieu de « ? » (NFC)', async () => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const decomposed = 'e' + String.fromCharCode(0x301) + 'nergie';

    const out = sanitizeWinAnsi(decomposed, font);

    expect(out).toBe('énergie');
    expect(out).not.toContain('?');
  });

  it('préserve les retours à la ligne, normalise CRLF et tabulations', async () => {
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(sanitizeWinAnsi('a\r\nb\tc', font)).toBe('a\nb c');
  });

  it('un texte non assaini lève bien dans pdf-lib (sanity check du garde-fou)', async () => {
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(() => font.encodeText('龍')).toThrow();
  });

  it.each([StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique])(
    "TOUT le catalogue `souffle` réel passe dans l'encodeur de la police %s",
    async (name) => {
      const font = await doc.embedFont(name);

      expect(CATALOGUE.length).toBeGreaterThan(0);
      for (const s of CATALOGUE) {
        for (const text of [s.label, s.description]) {
          // Le catalogue est encodable tel quel (vérifié) : l'assainissement ne doit rien changer…
          expect(sanitizeWinAnsi(text, font)).toBe(text);
          // …et, sans lui, l'encodage ne lève pas non plus sur les données réelles.
          expect(() => font.encodeText(text.replace(/\n/g, ' '))).not.toThrow();
        }
      }
    },
  );
});

describe('drawSoufflesPages', () => {
  it('aucun groupe → aucune page ajoutée, document intact', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const added = await drawSoufflesPages(doc, []);

    expect(added).toBe(0);
    expect(doc.getPageCount()).toBe(1);
  });

  it('ajoute au moins une page et produit un PDF rechargeable', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    const added = await drawSoufflesPages(doc, [
      group([{ label: 'Chance', ps: 1, description: 'Réussite critique automatique.' }]),
    ]);
    const reloaded = await PDFDocument.load(await doc.save());

    expect(added).toBe(1);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it('libellé, description et mention exotiques (glyphes hors WinAnsi) → export réussi', async () => {
    const doc = await PDFDocument.create();

    await expect(
      drawSoufflesPages(doc, [
        group([{ label: 'Dragon 龍 🐉', description: 'Effet Ω avec\ttab\net saut de ligne.' }], {
          title: 'Titre ✨',
          consigne: 'Consigne ☠',
        }),
      ]),
    ).resolves.toBe(1);
    await expect(doc.save()).resolves.toBeInstanceOf(Uint8Array);
  });

  it("description vide, mot plus long que la ligne : pas d'erreur", async () => {
    const doc = await PDFDocument.create();

    await expect(
      drawSoufflesPages(doc, [group([{ description: '' }, { description: 'x'.repeat(400) }])]),
    ).resolves.toBe(1);
  });

  it('catalogue réel niveau 5 : pages ajoutées, souffles des autres races présents, nom de chaque souffle dessiné', async () => {
    const { availableSouffles } = await import('@master-jdr/game-rules');
    const groups = availableSouffles(
      5,
      'DRAGON_ROUGE',
      CATALOGUE.map((c) => ({ key: c.key, data: c })),
    );
    const texts: string[] = [];
    const spy = jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
      this: PDFPage,
      text: string,
    ) {
      texts.push(text);
      return undefined;
    });

    const doc = await PDFDocument.create();
    const added = await drawSoufflesPages(doc, groups);
    spy.mockRestore();

    expect(added).toBeGreaterThanOrEqual(1);
    expect(texts).toContain('Souffles de mon dragon');
    expect(texts).toContain('Autres races (souffles multicolores)');
    // Niveau 5 : toutes les entrées du catalogue sont disponibles (communs + 4 races).
    for (const c of CATALOGUE) expect(texts).toContain(c.label);
  });

  it("15+ souffles à longue description → plusieurs pages, un souffle n'est jamais coupé", async () => {
    const long = 'Un effet très long qui se répète pour occuper plusieurs lignes. '
      .repeat(8)
      .trim();
    const souffles = Array.from({ length: 16 }, (_, i) => ({
      label: `Souffle ${i}`,
      description: long,
    }));
    const drawn: { page: PDFPage; text: string }[] = [];
    const spy = jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
      this: PDFPage,
      text: string,
    ) {
      drawn.push({ page: this, text });
      return undefined;
    });

    const doc = await PDFDocument.create();
    const added = await drawSoufflesPages(doc, [group(souffles)]);
    spy.mockRestore();

    expect(added).toBeGreaterThan(1);
    // Regroupe les lignes dessinées par souffle : du nom du souffle jusqu'au suivant.
    const pages = doc.getPages();
    let currentPage: PDFPage | null = null;
    let blocksSplit = 0;
    for (const d of drawn) {
      if (/^Souffle \d+$/.test(d.text)) currentPage = d.page;
      else if (d.text.startsWith('  -  ')) continue;
      else if (currentPage && !/^Souffles /.test(d.text) && d.page !== currentPage) blocksSplit++;
    }
    expect(blocksSplit).toBe(0);
    expect(pages.length).toBe(added);
  });

  describe("page de suite au milieu d'un groupe", () => {
    const LONG = 'Un effet très long qui se répète pour occuper plusieurs lignes. '
      .repeat(8)
      .trim();
    const many = Array.from({ length: 16 }, (_, i) => ({
      label: `Souffle ${i}`,
      description: LONG,
    }));

    async function drawnTextsByPage(groups: SouffleGroup[]) {
      const drawn: { page: PDFPage; text: string }[] = [];
      const spy = jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
        this: PDFPage,
        text: string,
      ) {
        drawn.push({ page: this, text });
        return undefined;
      });
      const doc = await PDFDocument.create();
      await drawSoufflesPages(doc, groups);
      spy.mockRestore();
      return doc.getPages().map((pg) => drawn.filter((d) => d.page === pg).map((d) => d.text));
    }

    it('le titre du groupe est rappelé « (suite) » en tête de la page suivante', async () => {
      const pages = await drawnTextsByPage([group(many)]);

      expect(pages.length).toBeGreaterThan(1);
      expect(pages[0]).toContain('Souffles manipulant le destin');
      expect(pages[1]).toContain('Souffles manipulant le destin (suite)');
      expect(pages[1]).not.toContain('Souffles manipulant le destin');
    });

    it('dans « autres races », le titre de section est aussi rappelé sur la page de suite', async () => {
      const pages = await drawnTextsByPage([
        group(many, { section: 'autres-races', title: 'Souffles du Dragon Bleu' }),
      ]);

      expect(pages.length).toBeGreaterThan(1);
      expect(pages[1]).toContain('Autres races (souffles multicolores)');
      expect(pages[1]).toContain('Souffles du Dragon Bleu (suite)');
    });

    it("un saut de page AVANT l'en-tête d'un groupe ne produit pas de « (suite) » parasite", async () => {
      const tenLines = Array.from({ length: 10 }, () => 'ligne').join('\n');
      // Le premier groupe remplit presque la page ; le second démarre sur la page suivante, avec
      // son vrai titre (pas de « (suite) » puisqu'aucun de ses souffles n'est encore posé).
      const pages = await drawnTextsByPage([
        group(
          Array.from({ length: 4 }, (_, i) => ({ label: `Souffle ${i}`, description: tenLines })),
        ),
        group([{ label: 'Autre', description: LONG }], { title: 'Souffles du Dragon Noir' }),
      ]);
      const all = pages.flat();

      expect(pages.length).toBeGreaterThan(1);

      expect(all).toContain('Souffles du Dragon Noir');
      expect(all).not.toContain('Souffles du Dragon Noir (suite)');
    });
  });
});
