// pdf-lib et game-rules RÉELS (seul le système de fichiers est simulé) : le gabarit officiel est
// gitignoré (sous droits), on en fabrique donc un équivalent avec les mêmes noms de champs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HommeDragonDto } from '@master-jdr/shared';
import { Test } from '@nestjs/testing';

jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));

import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName } from 'pdf-lib';
import { HommeDragonPdfService } from './homme-dragon.pdf.service';
import { GameSystemService } from '../game-systems/game-system.service';

const DATA_DIR = join(process.cwd(), 'game-systems/ryuutama/data');
const readCatalogue = (file: string) =>
  (JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as { key: string }[]).map((data) => ({
    key: data.key,
    data,
  }));

const TEXT_FIELDS = [
  'nom',
  'couleur',
  'niveau',
  'artefact',
  'inscription',
  'avatar',
  'meneur',
  'cree_le',
  'souffle_max',
  'souffle_actuel',
  'nombre_souffles',
  'apparence_caractere',
  'vocation',
  'demeure',
  'monde_protege_1',
  'monde_protege_2',
  'monde_protege_3',
  'eveil_1',
  'eveil_2',
  'eveil_3',
  'eveil_4',
  'souffle_1',
  'souffle_2',
  'souffle_3',
  'souffle_4',
  ...Array.from({ length: 12 }, (_, i) => [
    `sc${i + 1}`,
    `date_sc_${i + 1}`,
    `voy_sc_${i + 1}`,
  ]).flat(),
];
const MULTILINE_FIELDS = ['voyageurs_proteges_1', 'voyageurs_proteges_2'];

async function makeTemplate(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const form = doc.getForm();
  let y = 800;
  for (const name of [...TEXT_FIELDS, ...MULTILINE_FIELDS]) {
    const field = form.createTextField(name);
    if (MULTILINE_FIELDS.includes(name)) field.enableMultiline();
    // Comme dans le vrai gabarit : `nombre_souffles` n'a aucun /DA (taille auto).
    if (name === 'nombre_souffles') field.acroField.dict.delete(PDFName.of('DA'));
    field.addToPage(page, { x: 20, y: (y -= 1), width: 200, height: 12 });
  }
  return Buffer.from(await doc.save());
}

function makeHommeDragon(overrides: Partial<HommeDragonDto> = {}): HommeDragonDto {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis' },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 3, PS: 5 },
    eveilPowers: [],
    pendingEveilLevels: [],
    ...overrides,
  };
}

describe('HommeDragonPdfService (pdf-lib réel)', () => {
  let service: HommeDragonPdfService;
  let getContent: jest.Mock;
  let template: Buffer;

  beforeAll(async () => {
    template = await makeTemplate();
  });

  beforeEach(async () => {
    (readFile as jest.Mock).mockResolvedValue(template);
    getContent = jest.fn().mockResolvedValue({
      hommeDragonArtefact: readCatalogue('homme-dragon-artefacts.json'),
      souffle: readCatalogue('souffles.json'),
      souffleRituel: readCatalogue('souffles-rituels.json'),
    });
    const module = await Test.createTestingModule({
      providers: [HommeDragonPdfService, { provide: GameSystemService, useValue: { getContent } }],
    }).compile();
    service = module.get(HommeDragonPdfService);
  });

  const load = (bytes: Buffer) => PDFDocument.load(bytes);

  it('niveau 3, éditable : champs de souffle corrects, formulaire conservé, pages de souffles ajoutées', async () => {
    const doc = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );
    const form = doc.getForm();

    expect(form.getTextField('souffle_max').getText()).toBe('5');
    expect(form.getTextField('nombre_souffles').getText()).toBe('2');
    expect(form.getTextField('souffle_actuel').getText() ?? '').toBe('');
    for (const n of [1, 2, 3, 4]) {
      expect(form.getTextField(`souffle_${n}`).getText() ?? '').toBe('');
    }
    expect(form.getFields().length).toBeGreaterThan(0);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('police intermédiaire : 10,5 pt sur inscription, scénario et date ; zones déjà petites inchangées', async () => {
    const dto = makeHommeDragon({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc', inscription: 'Une inscription assez longue pour déborder' },
        nom: 'Ignis',
      },
      historique: [
        {
          scenarioTitle: 'La Route des Lanternes',
          date: '2026-06-12',
          participants: ['Ana'],
          partieId: 'p1',
        },
      ],
    });
    const doc = await load(await service.fillHommeDragonPdf(dto, 'admin', 'editable'));
    const form = doc.getForm();
    const da = (name: string) => form.getTextField(name).acroField.getDefaultAppearance() ?? '';

    // eveil_1 reste vide : la taille s'applique aussi aux cases à remplir à la main.
    for (const name of [
      'inscription',
      'sc1',
      'date_sc_1',
      'nom',
      'eveil_1',
      'souffle_1',
      'nombre_souffles',
    ]) {
      expect(da(name)).toContain('10.5 Tf');
    }
    for (const name of ['voy_sc_1', 'voyageurs_proteges_1']) {
      expect(da(name)).not.toContain('10.5 Tf');
    }
  });

  it('réserve de 2 sur 3 emplacements (niveau 4) : souffle_1 et souffle_2 portent le nom seul, souffle_3 vide, rien décompté', async () => {
    const dto = makeHommeDragon({
      derived: { level: 4, PS: 5 },
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        reserve: ['courage', 'chance', null],
      },
    });
    const form = (await load(await service.fillHommeDragonPdf(dto, 'admin', 'editable'))).getForm();

    expect(form.getTextField('souffle_1').getText()).toBe('Courage');
    expect(form.getTextField('souffle_2').getText()).toBe('Chance');
    expect(form.getTextField('souffle_3').getText() ?? '').toBe('');
    expect(form.getTextField('souffle_4').getText() ?? '').toBe('');
    expect(form.getTextField('nombre_souffles').getText()).toBe('3');
    expect(form.getTextField('souffle_actuel').getText() ?? '').toBe('');
  });

  it('réserve avec un souffle rituel : libellé du catalogue `souffleRituel`', async () => {
    const dto = makeHommeDragon({
      derived: { level: 5, PS: 10 },
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        reserve: ['rituel-du-tabou'],
      },
    });
    const form = (await load(await service.fillHommeDragonPdf(dto, 'admin', 'editable'))).getForm();

    expect(form.getTextField('souffle_1').getText()).toBe('Rituel du tabou');
  });

  it('souffle retiré du catalogue : la clé brute est imprimée (la ligne reste lisible)', async () => {
    const dto = makeHommeDragon({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        reserve: ['souffle-retire'],
      },
    });
    const form = (await load(await service.fillHommeDragonPdf(dto, 'admin', 'editable'))).getForm();

    expect(form.getTextField('souffle_1').getText()).toBe('souffle-retire');
  });

  it("format '2pages' avec une réserve : export réussi, formulaire aplati", async () => {
    const dto = makeHommeDragon({
      derived: { level: 4, PS: 5 },
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        reserve: ['courage', 'chance'],
      },
    });
    const doc = await load(await service.fillHommeDragonPdf(dto, 'admin', '2pages'));

    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it('niveau 1 : nombre_souffles = 0, souffle_max = 3', async () => {
    const doc = await load(
      await service.fillHommeDragonPdf(
        makeHommeDragon({ derived: { level: 1, PS: 3 } }),
        'admin',
        'editable',
      ),
    );

    expect(doc.getForm().getTextField('nombre_souffles').getText()).toBe('0');
    expect(doc.getForm().getTextField('souffle_max').getText()).toBe('3');
  });

  it('niveau 5 : nombre_souffles = 4, souffle_max = 10', async () => {
    const doc = await load(
      await service.fillHommeDragonPdf(
        makeHommeDragon({ derived: { level: 5, PS: 10 } }),
        'admin',
        'editable',
      ),
    );

    expect(doc.getForm().getTextField('nombre_souffles').getText()).toBe('4');
    expect(doc.getForm().getTextField('souffle_max').getText()).toBe('10');
  });

  it("format '2pages' : formulaire aplati (aucun champ restant), pages de souffles présentes", async () => {
    const doc = await load(await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', '2pages'));

    expect(doc.getForm().getFields()).toHaveLength(0);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('les pages de souffles sont identiques dans les deux formats (même nombre de pages)', async () => {
    const editable = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );
    const flat = await load(await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', '2pages'));

    expect(flat.getPageCount()).toBe(editable.getPageCount());
  });

  it('niveau 3 imprime plus de pages de souffles que le niveau 1 (autres races dès le niveau 3)', async () => {
    const lvl1 = await load(
      await service.fillHommeDragonPdf(
        makeHommeDragon({ derived: { level: 1, PS: 3 } }),
        'admin',
        'editable',
      ),
    );
    const lvl3 = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );

    expect(lvl3.getPageCount()).toBeGreaterThan(lvl1.getPageCount());
  });

  it('catalogue `souffle` vide → aucune page ajoutée, gabarit rempli, export réussi', async () => {
    getContent.mockResolvedValue({ hommeDragonArtefact: [], souffle: [] });

    const doc = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );

    expect(doc.getPageCount()).toBe(1);
    expect(doc.getForm().getTextField('nom').getText()).toBe('Ignis');
  });

  it('artefact sans nom personnalisé → libellé du catalogue, jamais la clé', async () => {
    const doc = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );

    expect(doc.getForm().getTextField('artefact').getText()).toBe('Grand arc');
  });

  it('artefact inconnu du catalogue → clé brute en dernier recours', async () => {
    getContent.mockResolvedValue({ hommeDragonArtefact: [], souffle: [] });

    const doc = await load(
      await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    );

    expect(doc.getForm().getTextField('artefact').getText()).toBe('grand-arc');
  });

  it('cinq voyageurs protégés → tous imprimés, répartis sur les deux zones, un par ligne', async () => {
    const doc = await load(
      await service.fillHommeDragonPdf(
        makeHommeDragon({
          aventures: [
            {
              partieId: 'p1',
              nom: 'Aventure',
              voyageurs: ['a', 'b', 'c', 'd', 'e'].map((p) => ({
                userId: `u${p}`,
                pseudo: `pseudo-${p}`,
                displayName: `Nom ${p}`,
              })),
            },
          ],
        }),
        'admin',
        'editable',
      ),
    );

    expect(doc.getForm().getTextField('voyageurs_proteges_1').getText()).toBe(
      'pseudo-a\npseudo-b\npseudo-c',
    );
    expect(doc.getForm().getTextField('voyageurs_proteges_2').getText()).toBe('pseudo-d\npseudo-e');
  });

  it('caractère hors WinAnsi dans un nom ou un pseudo → remplacé, export réussi, aplatissement compris', async () => {
    const dto = makeHommeDragon({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc', nom: 'Arc 龍' },
        nom: 'Ignis 🐉 Ω',
      },
      aventures: [
        {
          partieId: 'p1',
          nom: 'Aventure',
          voyageurs: [{ userId: 'u1', pseudo: 'Zoé ✨', displayName: 'Zoé' }],
        },
      ],
    });

    await expect(service.fillHommeDragonPdf(dto, 'admin', 'editable')).resolves.toBeInstanceOf(
      Buffer,
    );
    await expect(service.fillHommeDragonPdf(dto, 'admin', '2pages')).resolves.toBeInstanceOf(
      Buffer,
    );
  });

  it('libellé du catalogue avec un glyphe hors WinAnsi → export réussi', async () => {
    getContent.mockResolvedValue({
      hommeDragonArtefact: [{ key: 'grand-arc', data: { label: 'Arc 龍' } }],
      souffle: [
        {
          key: 'x',
          data: { label: 'Souffle ☠', famille: 'destin', ps: 1, description: 'Effet Ω 🐉' },
        },
      ],
    });

    await expect(
      service.fillHommeDragonPdf(makeHommeDragon(), 'admin', '2pages'),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
