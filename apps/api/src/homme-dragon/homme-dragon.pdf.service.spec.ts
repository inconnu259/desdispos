import type { HommeDragonDto } from '@master-jdr/shared';
import { Test } from '@nestjs/testing';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));
jest.mock('@master-jdr/game-rules', () => ({
  mapHommeDragonToPdfFields: jest.fn(() => [
    { field: 'nom', value: 'Ignis', kind: 'text' },
    { field: 'niveau', value: '3', kind: 'text' },
    { field: 'inscription', value: '', kind: 'text' },
  ]),
  availableSouffles: jest.fn(() => []),
}));
// Le dessin des pages de souffles a sa propre suite (pdf-lib réel) : ici on vérifie seulement
// l'orchestration du service.
jest.mock('./homme-dragon-souffles-pages', () => ({
  drawSoufflesPages: jest.fn().mockResolvedValue(0),
  sanitizeWinAnsi: jest.fn((text: string) => text),
}));

import { readFile } from 'node:fs/promises';
import { availableSouffles, mapHommeDragonToPdfFields } from '@master-jdr/game-rules';
import { HommeDragonPdfService } from './homme-dragon.pdf.service';
import { drawSoufflesPages, sanitizeWinAnsi } from './homme-dragon-souffles-pages';
import { GameSystemService } from '../game-systems/game-system.service';

const mockSetText = jest.fn();
const mockSave = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const mockFlatten = jest.fn();
const mockForm = {
  getTextField: jest.fn(() => ({ setText: mockSetText })),
  getFields: jest.fn(() => []),
  flatten: mockFlatten,
};
const mockDoc = {
  getForm: jest.fn(() => mockForm),
  embedFont: jest.fn().mockResolvedValue({ name: 'helvetica' }),
  save: mockSave,
};

jest.mock('pdf-lib', () => ({
  PDFDocument: { load: jest.fn(() => Promise.resolve(mockDoc)) },
  StandardFonts: { Helvetica: 'Helvetica' },
}));

function makeGameSystems() {
  return {
    getContent: jest.fn().mockResolvedValue({
      eveilPower: [
        {
          key: 'escorte-du-dragon',
          data: { key: 'escorte-du-dragon', label: 'Escorte du dragon' },
        },
      ],
      hommeDragonArtefact: [
        { key: 'grand-arc', data: { key: 'grand-arc', label: 'Grand arc', race: 'DRAGON_ROUGE' } },
      ],
      souffle: [{ key: 'passe', data: { key: 'passe', label: 'Passé', famille: 'temps', ps: 2 } }],
      souffleRituel: [
        {
          key: 'rituel-du-tabou',
          data: { key: 'rituel-du-tabou', label: 'Rituel du tabou', ps: 1 },
        },
      ],
    }),
  };
}

function makeHommeDragon(overrides: Partial<HommeDragonDto> = {}): HommeDragonDto {
  const base: HommeDragonDto = {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 3, PS: 5 },
    eveilPowers: [],
    pendingEveilLevels: [],
  };
  return Object.assign(base, overrides);
}

describe('HommeDragonPdfService', () => {
  let service: HommeDragonPdfService;
  let gameSystems: ReturnType<typeof makeGameSystems>;
  const mockReadFile = readFile as jest.Mock;
  const mockMapFields = mapHommeDragonToPdfFields as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    (sanitizeWinAnsi as jest.Mock).mockImplementation((text: string) => text);
    gameSystems = makeGameSystems();
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-bytes'));
    mockMapFields.mockReturnValue([
      { field: 'nom', value: 'Ignis', kind: 'text' },
      { field: 'niveau', value: '3', kind: 'text' },
      { field: 'inscription', value: '', kind: 'text' },
    ]);

    const module = await Test.createTestingModule({
      providers: [HommeDragonPdfService, { provide: GameSystemService, useValue: gameSystems }],
    }).compile();
    service = module.get(HommeDragonPdfService);
  });

  it('remplit les champs non vides retournés par mapHommeDragonToPdfFields', async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockForm.getTextField).toHaveBeenCalledWith('nom');
    expect(mockForm.getTextField).toHaveBeenCalledWith('niveau');
    expect(mockSetText).toHaveBeenCalledWith('Ignis');
    expect(mockSetText).toHaveBeenCalledWith('3');
  });

  it('champ vide ("inscription") ignoré, jamais écrit', async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockForm.getTextField).not.toHaveBeenCalledWith('inscription');
  });

  it("résout le libellé du pouvoir d'éveil via GameSystemService.getContent()", async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(gameSystems.getContent).toHaveBeenCalledWith('ryuutama');
    expect(mockMapFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        raceLabel: 'Dragon Rouge',
        mjPseudo: 'admin',
        eveilPowerLabels: { 'escorte-du-dragon': 'Escorte du dragon' },
      }),
    );
  });

  it('résout les libellés de réserve depuis les catalogues `souffle` et `souffleRituel`', async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockMapFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reserveLabels: { passe: 'Passé', 'rituel-du-tabou': 'Rituel du tabou' },
      }),
    );
  });

  it("résout le libellé de l'artefact du catalogue et le passe au mapping", async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockMapFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ artefactLabel: 'Grand arc' }),
    );
  });

  it('artefact absent du catalogue → artefactLabel undefined (le mapping replie sur la clé)', async () => {
    gameSystems.getContent.mockResolvedValue({ eveilPower: [], souffle: [] });

    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockMapFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ artefactLabel: undefined }),
    );
  });

  it('calcule les souffles disponibles avec niveau, race et entrées du catalogue `souffle`', async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(availableSouffles).toHaveBeenCalledWith(3, 'DRAGON_ROUGE', [
      { key: 'passe', data: { key: 'passe', label: 'Passé', famille: 'temps', ps: 2 } },
    ]);
    expect(drawSoufflesPages).toHaveBeenCalledWith(mockDoc, []);
  });

  it('catalogue `souffle` absent → aucune entrée passée, export réussi', async () => {
    gameSystems.getContent.mockResolvedValue({});

    await expect(
      service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    ).resolves.toBeInstanceOf(Buffer);
    expect(availableSouffles).toHaveBeenCalledWith(3, 'DRAGON_ROUGE', []);
  });

  it("format 'editable' : ne flatten pas le formulaire", async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockFlatten).not.toHaveBeenCalled();
  });

  it("format '2pages' : flatten le formulaire, pages de souffles ajoutées avant", async () => {
    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', '2pages');

    expect(mockFlatten).toHaveBeenCalledTimes(1);
    expect((drawSoufflesPages as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      mockFlatten.mock.invocationCallOrder[0],
    );
  });

  it("assainit chaque valeur avant setText (jamais d'erreur WinAnsi)", async () => {
    (sanitizeWinAnsi as jest.Mock).mockImplementation((t: string) => t.replace('Ignis', 'Ign?s'));

    await service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable');

    expect(mockSetText).toHaveBeenCalledWith('Ign?s');
  });

  it('template introuvable → erreur explicite pointant vers le README', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(
      service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    ).rejects.toThrow('Template PDF Homme Dragon introuvable');
  });

  it('échec de setText sur un champ → erreur explicite, pas un crash silencieux', async () => {
    mockForm.getTextField.mockImplementationOnce(() => {
      throw new Error('champ inconnu');
    });

    await expect(
      service.fillHommeDragonPdf(makeHommeDragon(), 'admin', 'editable'),
    ).rejects.toThrow(/introuvable\/incompatible/);
  });
});
