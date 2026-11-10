import type { CharacterDto } from '@master-jdr/shared';
import { Test } from '@nestjs/testing';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));
jest.mock('@master-jdr/game-rules', () => ({
  mapEquipmentToPdfFields: jest.fn(() => [
    { field: 'joueur', value: 'Alice', kind: 'text' },
    { field: 'ObjetRow1', value: 'Corde', kind: 'text' },
    { field: 'PrixRow1', value: '', kind: 'text' },
  ]),
}));

import { readFile } from 'node:fs/promises';
import { mapEquipmentToPdfFields } from '@master-jdr/game-rules';
import { EquipmentPdfService } from './equipment-pdf.service';
import { Logger } from '@nestjs/common';

const mockSetText = jest.fn();
const mockSave = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const mockForm = {
  getTextField: jest.fn(() => ({ setText: mockSetText })),
};
const mockDoc = {
  getForm: jest.fn(() => mockForm),
  save: mockSave,
};

jest.mock('pdf-lib', () => ({
  PDFDocument: { load: jest.fn(() => Promise.resolve(mockDoc)) },
}));

function makeCharacter(overrides: Partial<CharacterDto> = {}): CharacterDto {
  const base: CharacterDto = {
    id: 'c1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    portraitUrl: null,
    portraitCropData: null,
    pdfPortraitCropData: null,
    ownerDisplayName: 'Miren',
    sheetData: {
      narrative: { name: 'Miren' },
      equipment: {
        individual: [
          {
            id: 'i1',
            name: 'Corde',
            weight: 2,
            price: '5po',
            addedBy: 'player',
          },
        ],
        contenants: [{ id: 'c1', name: 'Sac à dos', weight: 3, addedBy: 'player' }],
        animaux: [{ id: 'a1', name: 'Cheval', addedBy: 'player' }],
      },
    },
    derived: { PV: 10, PE: 8, Condition: 10, Initiative: 5, Encombrement: 11 },
    ownerPseudo: 'Alice',
    ownerIsMj: false,
    viewerIsMj: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    xp: 0,
    level: 1,
    journalAutoAssociate: false,
  };
  return Object.assign(base, overrides);
}

describe('EquipmentPdfService', () => {
  let service: EquipmentPdfService;
  const mockReadFile = readFile as jest.Mock;
  const mockMapFields = mapEquipmentToPdfFields as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-bytes'));
    mockMapFields.mockReturnValue([
      { field: 'joueur', value: 'Alice', kind: 'text' },
      { field: 'ObjetRow1', value: 'Corde', kind: 'text' },
      { field: 'PrixRow1', value: '', kind: 'text' },
    ]);

    const module = await Test.createTestingModule({
      providers: [EquipmentPdfService],
    }).compile();
    service = module.get(EquipmentPdfService);
  });

  it('remplit les champs non vides retournés par mapEquipmentToPdfFields', async () => {
    await service.fillEquipmentPdf(makeCharacter());

    expect(mockForm.getTextField).toHaveBeenCalledWith('joueur');
    expect(mockForm.getTextField).toHaveBeenCalledWith('ObjetRow1');
    expect(mockSetText).toHaveBeenCalledWith('Alice');
    expect(mockSetText).toHaveBeenCalledWith('Corde');
  });

  it('champ vide ("PrixRow1") ignoré, jamais écrit', async () => {
    await service.fillEquipmentPdf(makeCharacter());

    expect(mockForm.getTextField).not.toHaveBeenCalledWith('PrixRow1');
  });

  it("construit l'EquipmentPdfInput à partir du personnage (ownerPseudo, nom, encombrementLimit, equipment)", async () => {
    await service.fillEquipmentPdf(makeCharacter());

    expect(mockMapFields).toHaveBeenCalledWith({
      ownerPseudo: 'Alice',
      characterName: 'Miren',
      encombrementLimit: 11,
      equipment: {
        individual: [{ name: 'Corde', weight: 2, price: '5po', effect: undefined }],
        contenants: [{ name: 'Sac à dos', weight: 3, price: undefined, effect: undefined }],
        animaux: [{ name: 'Cheval', price: undefined, effect: undefined }],
      },
    });
  });

  it('template introuvable → erreur explicite pointant vers le README', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(service.fillEquipmentPdf(makeCharacter())).rejects.toThrow(
      'Template PDF équipement Ryuutama introuvable',
    );
  });

  it('échec de setText sur un champ → erreur explicite, pas un crash silencieux', async () => {
    mockForm.getTextField.mockImplementationOnce(() => {
      throw new Error('champ inconnu');
    });

    await expect(service.fillEquipmentPdf(makeCharacter())).rejects.toThrow(
      /introuvable\/incompatible/,
    );
  });

  it('un equipment.group legacy (donnée pré-migration Story 14.1 non migrée) → avertissement loggé, aucun crash (deferred-work, garde-fou ajouté)', async () => {
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation();
    const character = makeCharacter({
      sheetData: {
        narrative: { name: 'Miren' },
        equipment: {
          individual: [],
          contenants: [],
          animaux: [],
          group: ['Ancienne entrée jamais migrée'],
        },
      },
    });

    await service.fillEquipmentPdf(character);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('c1'));
  });

  it('equipment sans group (cas normal) → aucun avertissement', async () => {
    const warnSpy = jest
      .spyOn((service as unknown as { logger: Logger }).logger, 'warn')
      .mockImplementation();

    await service.fillEquipmentPdf(makeCharacter());

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("derived absent (cadenas de visibilité Story 31.6, attributes/levelUps verrouillé) → aucun crash, champ 'limite_enc' omis (jamais un 0 trompeur)", async () => {
    // `character.derived` reste typé plein (`CharacterDto`) mais peut être ABSENT à l'exécution
    // pour un fellow player dont le MJ a verrouillé attributes/levelUps (cf. `hiddenFields`).
    mockMapFields.mockReturnValue([
      { field: 'joueur', value: 'Alice', kind: 'text' },
      { field: 'limite_enc', value: '0', kind: 'text' },
    ]);
    const character = makeCharacter({ derived: undefined as never });

    await expect(service.fillEquipmentPdf(character)).resolves.toBeInstanceOf(Buffer);

    // Le `?? 0` (nécessaire pour ne pas crasher `EquipmentPdfInput.encombrementLimit: number`)
    // reste transmis à mapEquipmentToPdfFields, mais le champ PDF qui en dépend est retiré ensuite
    // — jamais écrit dans le formulaire (revue de code, cohérent avec RyuutamaPdfService).
    expect(mockMapFields).toHaveBeenCalledWith(expect.objectContaining({ encombrementLimit: 0 }));
    expect(mockForm.getTextField).not.toHaveBeenCalledWith('limite_enc');
    expect(mockForm.getTextField).toHaveBeenCalledWith('joueur');
  });
});
