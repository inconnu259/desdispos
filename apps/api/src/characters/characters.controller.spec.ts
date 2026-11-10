import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  StreamableFile,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

jest.mock('@desdispos/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  mapToPdfFields: jest.fn(),
}));

import { CharactersController } from './characters.controller';
import { CharacterService } from './character.service';
import { RyuutamaPdfService } from './ryuutama-pdf.service';
import { EquipmentPdfService } from './equipment-pdf.service';
import { NotesPdfService } from './notes-pdf.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

function makeCharacterService() {
  return {
    findOne: jest.fn(),
    updatePortrait: jest.fn(),
    removePortrait: jest.fn(),
    updatePdfPortraitCrop: jest.fn(),
    getPortraitFile: jest.fn(),
    addInventoryItem: jest.fn(),
    updateInventoryItem: jest.fn(),
    removeInventoryItem: jest.fn(),
    addContenant: jest.fn(),
    updateContenant: jest.fn(),
    removeContenant: jest.fn(),
    addAnimal: jest.fn(),
    updateAnimal: jest.fn(),
    removeAnimal: jest.fn(),
    addNote: jest.fn(),
    toggleNoteShare: jest.fn(),
    setJournalAutoAssociate: jest.fn(),
    setNoteScenario: jest.fn(),
    getNotes: jest.fn(),
    setXp: jest.fn(),
    setSheetField: jest.fn(),
    updateNarrativeField: jest.fn(),
  };
}

function makePdfService() {
  return {
    fillCharacterPdf: jest.fn(),
  };
}

function makeEquipmentPdfService() {
  return {
    fillEquipmentPdf: jest.fn(),
  };
}

function makeNotesPdfService() {
  return {
    fillNotesPdf: jest.fn(),
  };
}

describe('CharactersController', () => {
  let controller: CharactersController;
  let characters: ReturnType<typeof makeCharacterService>;
  let ryuutamaPdf: ReturnType<typeof makePdfService>;
  let equipmentPdf: ReturnType<typeof makeEquipmentPdfService>;
  let notesPdf: ReturnType<typeof makeNotesPdfService>;

  beforeEach(async () => {
    characters = makeCharacterService();
    ryuutamaPdf = makePdfService();
    equipmentPdf = makeEquipmentPdfService();
    notesPdf = makeNotesPdfService();
    const module = await Test.createTestingModule({
      controllers: [CharactersController],
      providers: [
        { provide: CharacterService, useValue: characters },
        { provide: RyuutamaPdfService, useValue: ryuutamaPdf },
        { provide: EquipmentPdfService, useValue: equipmentPdf },
        { provide: NotesPdfService, useValue: notesPdf },
      ],
    }).compile();
    controller = module.get(CharactersController);
  });

  it('exportPdf() charge le personnage via findOne (403/404 déjà gérés) puis retourne un StreamableFile', async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: {},
    };
    characters.findOne.mockResolvedValue(character);
    ryuutamaPdf.fillCharacterPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    const result = await controller.exportPdf('char1', { format: 'editable' }, {
      id: 'u1',
    } as any);

    expect(characters.findOne).toHaveBeenCalledWith('char1', 'u1');
    expect(ryuutamaPdf.fillCharacterPdf).toHaveBeenCalledWith(character, 'editable');
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('exportPdf() propage le 403 de findOne (non-propriétaire/non-MJ)', async () => {
    characters.findOne.mockRejectedValue(new ForbiddenException());

    await expect(
      controller.exportPdf('char1', { format: 'editable' }, {
        id: 'stranger',
      } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(ryuutamaPdf.fillCharacterPdf).not.toHaveBeenCalled();
  });

  it("exportPdf() appelle fillCharacterPdf avec format='2pages'", async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: {},
    };
    characters.findOne.mockResolvedValue(character);
    ryuutamaPdf.fillCharacterPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    await controller.exportPdf('char1', { format: '2pages' }, {
      id: 'u1',
    } as any);

    expect(ryuutamaPdf.fillCharacterPdf).toHaveBeenCalledWith(character, '2pages');
  });

  it("exportPdf() rejette un personnage d'un autre système de jeu que Ryuutama (BadRequestException)", async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'conte-de-minuit',
      sheetData: {},
      derived: {},
    };
    characters.findOne.mockResolvedValue(character);

    await expect(
      controller.exportPdf('char1', { format: 'editable' }, {
        id: 'u1',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(ryuutamaPdf.fillCharacterPdf).not.toHaveBeenCalled();
  });

  it('exportEquipmentPdf() charge le personnage via findOne puis retourne un StreamableFile', async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: { Encombrement: 11 },
      ownerPseudo: 'Alice',
    };
    characters.findOne.mockResolvedValue(character);
    equipmentPdf.fillEquipmentPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    const result = await controller.exportEquipmentPdf('char1', {
      id: 'u1',
    } as any);

    expect(characters.findOne).toHaveBeenCalledWith('char1', 'u1');
    expect(equipmentPdf.fillEquipmentPdf).toHaveBeenCalledWith(character);
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it("exportEquipmentPdf() rejette un personnage d'un autre système de jeu que Ryuutama (BadRequestException)", async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'conte-de-minuit',
      sheetData: {},
      derived: { Encombrement: 11 },
      ownerPseudo: 'Alice',
    };
    characters.findOne.mockResolvedValue(character);

    await expect(controller.exportEquipmentPdf('char1', { id: 'u1' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(equipmentPdf.fillEquipmentPdf).not.toHaveBeenCalled();
  });

  it('exportEquipmentPdf() propage le 403 de findOne (accès refusé)', async () => {
    characters.findOne.mockRejectedValue(new ForbiddenException());

    await expect(controller.exportEquipmentPdf('char1', { id: 'stranger' } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(equipmentPdf.fillEquipmentPdf).not.toHaveBeenCalled();
  });

  it('exportEquipmentPdf() fonctionne pour le MJ exportant un personnage joueur (AC3)', async () => {
    const character = {
      id: 'char1',
      userId: 'player1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: { Encombrement: 11 },
      ownerPseudo: 'Bob',
      ownerIsMj: false,
      viewerIsMj: true,
    };
    characters.findOne.mockResolvedValue(character);
    equipmentPdf.fillEquipmentPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    const result = await controller.exportEquipmentPdf('char1', {
      id: 'mj1',
    } as any);

    expect(characters.findOne).toHaveBeenCalledWith('char1', 'mj1');
    expect(equipmentPdf.fillEquipmentPdf).toHaveBeenCalledWith(character);
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('exportNotesPdf() charge le personnage, récupère les notes via getNotes() puis retourne un StreamableFile', async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: {},
    };
    const notes = [
      {
        id: 'n1',
        characterId: 'char1',
        text: 'Une note',
        shared: true,
        scenarioId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ];
    characters.findOne.mockResolvedValue(character);
    characters.getNotes.mockResolvedValue(notes);
    notesPdf.fillNotesPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    const result = await controller.exportNotesPdf('char1', {
      id: 'u1',
    } as any);

    expect(characters.findOne).toHaveBeenCalledWith('char1', 'u1');
    expect(characters.getNotes).toHaveBeenCalledWith('char1', 'u1');
    expect(notesPdf.fillNotesPdf).toHaveBeenCalledWith(notes);
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it("exportNotesPdf() rejette un personnage d'un autre système de jeu que Ryuutama (BadRequestException)", async () => {
    const character = {
      id: 'char1',
      gameSystemId: 'conte-de-minuit',
      sheetData: {},
      derived: {},
    };
    characters.findOne.mockResolvedValue(character);

    await expect(controller.exportNotesPdf('char1', { id: 'u1' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(characters.getNotes).not.toHaveBeenCalled();
    expect(notesPdf.fillNotesPdf).not.toHaveBeenCalled();
  });

  it('exportNotesPdf() propage le 403 de findOne (accès refusé)', async () => {
    characters.findOne.mockRejectedValue(new ForbiddenException());

    await expect(controller.exportNotesPdf('char1', { id: 'stranger' } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(notesPdf.fillNotesPdf).not.toHaveBeenCalled();
  });

  it("exportNotesPdf() — AC3 : le MJ exportant les notes d'un joueur reçoit la liste complète telle que retournée par getNotes() (privées incluses, décision utilisateur : rien n'est privé pour le MJ)", async () => {
    const character = {
      id: 'char1',
      userId: 'player1',
      gameSystemId: 'ryuutama',
      sheetData: {},
      derived: {},
      ownerIsMj: false,
      viewerIsMj: true,
    };
    const notesIncludingPrivate = [
      {
        id: 'n1',
        characterId: 'char1',
        text: 'Note privée',
        shared: false,
        scenarioId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'n2',
        characterId: 'char1',
        text: 'Note partagée',
        shared: true,
        scenarioId: null,
        createdAt: '2026-07-02T00:00:00.000Z',
      },
    ];
    characters.findOne.mockResolvedValue(character);
    characters.getNotes.mockResolvedValue(notesIncludingPrivate);
    notesPdf.fillNotesPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

    await controller.exportNotesPdf('char1', { id: 'mj1' } as any);

    expect(characters.getNotes).toHaveBeenCalledWith('char1', 'mj1');
    // Aucun filtrage côté controller : la liste passée à fillNotesPdf() est EXACTEMENT celle
    // renvoyée par getNotes() (référence égale), y compris la note privée — le controller ne doit
    // jamais reconstruire un sous-ensemble.
    expect(notesPdf.fillNotesPdf).toHaveBeenCalledWith(notesIncludingPrivate);
  });

  it('updatePortrait() parse cropData JSON et délègue à CharacterService', async () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;
    characters.updatePortrait.mockResolvedValue({
      id: 'char1',
      portraitUrl: '/uploads/portraits/x.jpg',
    });

    await controller.updatePortrait(
      'char1',
      file,
      JSON.stringify({ scale: 1.2, offsetX: 0, offsetY: 0 }),
      { id: 'u1' } as any,
    );

    expect(characters.updatePortrait).toHaveBeenCalledWith('char1', 'u1', file, {
      scale: 1.2,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('updatePortrait() cropData JSON invalide → BadRequestException', async () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    await expect(
      controller.updatePortrait('char1', file, '{not-json', {
        id: 'u1',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(characters.updatePortrait).not.toHaveBeenCalled();
  });

  it('updatePortrait() sans cropData → passe null au service', async () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;
    characters.updatePortrait.mockResolvedValue({ id: 'char1' });

    await controller.updatePortrait('char1', file, undefined, {
      id: 'u1',
    } as any);

    expect(characters.updatePortrait).toHaveBeenCalledWith('char1', 'u1', file, null);
  });

  it('updatePortrait() cropData hors bornes (scale > 3) → BadRequestException', async () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    await expect(
      controller.updatePortrait(
        'char1',
        file,
        JSON.stringify({ scale: 10, offsetX: 0, offsetY: 0 }),
        { id: 'u1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(characters.updatePortrait).not.toHaveBeenCalled();
  });

  it('updatePortrait() cropData de forme incorrecte (champ non numérique) → BadRequestException', async () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    await expect(
      controller.updatePortrait(
        'char1',
        file,
        JSON.stringify({ scale: 'beaucoup', offsetX: 0, offsetY: 0 }),
        { id: 'u1' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(characters.updatePortrait).not.toHaveBeenCalled();
  });

  it('removePortrait() délègue à CharacterService', async () => {
    characters.removePortrait.mockResolvedValue({
      id: 'char1',
      portraitUrl: null,
    });

    await controller.removePortrait('char1', { id: 'u1' } as any);

    expect(characters.removePortrait).toHaveBeenCalledWith('char1', 'u1');
  });

  it('updatePdfPortraitCrop() délègue à CharacterService', async () => {
    const cropData = { scale: 1.5, offsetX: 10, offsetY: -10 };
    characters.updatePdfPortraitCrop.mockResolvedValue({
      id: 'char1',
      pdfPortraitCropData: cropData,
    });

    await controller.updatePdfPortraitCrop('char1', cropData, {
      id: 'u1',
    } as any);

    expect(characters.updatePdfPortraitCrop).toHaveBeenCalledWith('char1', 'u1', cropData);
  });

  it('getPortrait() délègue à CharacterService et retourne un StreamableFile', async () => {
    characters.getPortraitFile.mockResolvedValue({
      buffer: Buffer.from('image-bytes'),
      mime: 'image/jpeg',
    });

    const result = await controller.getPortrait('char1', { id: 'u1' } as any);

    expect(characters.getPortraitFile).toHaveBeenCalledWith('char1', 'u1');
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('addInventoryItem() délègue à CharacterService', async () => {
    characters.addInventoryItem.mockResolvedValue({ id: 'char1' });

    await controller.addInventoryItem('char1', { name: 'Cape', weight: 1.2 }, {
      id: 'u1',
    } as any);

    expect(characters.addInventoryItem).toHaveBeenCalledWith('char1', 'u1', {
      name: 'Cape',
      weight: 1.2,
    });
  });

  it('updateInventoryItem() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.updateInventoryItem.mockResolvedValue({ id: 'char1' });

    await controller.updateInventoryItem(
      'char1',
      '22222222-2222-2222-2222-222222222222',
      { weight: 2 },
      { id: 'u1' } as any,
    );

    expect(characters.updateInventoryItem).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
      { weight: 2 },
    );
  });

  it('removeInventoryItem() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.removeInventoryItem.mockResolvedValue({ id: 'char1' });

    await controller.removeInventoryItem('char1', '22222222-2222-2222-2222-222222222222', {
      id: 'u1',
    } as any);

    expect(characters.removeInventoryItem).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
    );
  });

  it('addContenant() délègue à CharacterService (Story 14.1)', async () => {
    characters.addContenant.mockResolvedValue({ id: 'char1' });

    await controller.addContenant('char1', { name: 'Sac', weight: 2 }, {
      id: 'u1',
    } as any);

    expect(characters.addContenant).toHaveBeenCalledWith('char1', 'u1', {
      name: 'Sac',
      weight: 2,
    });
  });

  it('updateContenant() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.updateContenant.mockResolvedValue({ id: 'char1' });

    await controller.updateContenant(
      'char1',
      '22222222-2222-2222-2222-222222222222',
      { weight: 3 },
      { id: 'u1' } as any,
    );

    expect(characters.updateContenant).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
      { weight: 3 },
    );
  });

  it('removeContenant() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.removeContenant.mockResolvedValue({ id: 'char1' });

    await controller.removeContenant('char1', '22222222-2222-2222-2222-222222222222', {
      id: 'u1',
    } as any);

    expect(characters.removeContenant).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
    );
  });

  it('addAnimal() délègue à CharacterService (Story 14.1)', async () => {
    characters.addAnimal.mockResolvedValue({ id: 'char1' });

    await controller.addAnimal('char1', { name: 'Cheval' }, {
      id: 'u1',
    } as any);

    expect(characters.addAnimal).toHaveBeenCalledWith('char1', 'u1', {
      name: 'Cheval',
    });
  });

  it('updateAnimal() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.updateAnimal.mockResolvedValue({ id: 'char1' });

    await controller.updateAnimal(
      'char1',
      '22222222-2222-2222-2222-222222222222',
      { effect: 'Rapide' },
      { id: 'u1' } as any,
    );

    expect(characters.updateAnimal).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
      { effect: 'Rapide' },
    );
  });

  it('removeAnimal() délègue à CharacterService avec itemId (UUID)', async () => {
    characters.removeAnimal.mockResolvedValue({ id: 'char1' });

    await controller.removeAnimal('char1', '22222222-2222-2222-2222-222222222222', {
      id: 'u1',
    } as any);

    expect(characters.removeAnimal).toHaveBeenCalledWith(
      'char1',
      'u1',
      '22222222-2222-2222-2222-222222222222',
    );
  });

  it('addNote() délègue à CharacterService', async () => {
    characters.addNote.mockResolvedValue({ id: 'note-1' });

    await controller.addNote('char1', { text: 'Une note' }, {
      id: 'u1',
    } as any);

    expect(characters.addNote).toHaveBeenCalledWith('char1', 'u1', {
      text: 'Une note',
    });
  });

  it('toggleNoteShare() délègue à CharacterService', async () => {
    characters.toggleNoteShare.mockResolvedValue({
      id: 'note-1',
      shared: true,
    });

    await controller.toggleNoteShare(
      'char1',
      '33333333-3333-3333-3333-333333333333',
      { shared: true },
      { id: 'u1' } as any,
    );

    expect(characters.toggleNoteShare).toHaveBeenCalledWith(
      'char1',
      'u1',
      '33333333-3333-3333-3333-333333333333',
      true,
    );
  });

  it('setJournalAutoAssociate() délègue à CharacterService', async () => {
    characters.setJournalAutoAssociate.mockResolvedValue({
      id: 'char1',
      journalAutoAssociate: true,
    });

    await controller.setJournalAutoAssociate('char1', { journalAutoAssociate: true }, {
      id: 'u1',
    } as any);

    expect(characters.setJournalAutoAssociate).toHaveBeenCalledWith('char1', 'u1', true);
  });

  it('setNoteScenario() délègue à CharacterService', async () => {
    characters.setNoteScenario.mockResolvedValue({
      id: 'note-1',
      scenarioId: 'scenario1',
    });

    await controller.setNoteScenario(
      'char1',
      '33333333-3333-3333-3333-333333333333',
      { scenarioId: 'scenario1' },
      { id: 'u1' } as any,
    );

    expect(characters.setNoteScenario).toHaveBeenCalledWith(
      'char1',
      'u1',
      '33333333-3333-3333-3333-333333333333',
      'scenario1',
    );
  });

  it('getNotes() délègue à CharacterService', async () => {
    characters.getNotes.mockResolvedValue([]);

    await controller.getNotes('char1', { id: 'u1' } as any);

    expect(characters.getNotes).toHaveBeenCalledWith('char1', 'u1');
  });

  it('setXp() délègue à CharacterService', async () => {
    characters.setXp.mockResolvedValue({ id: 'char1', xp: 500 });

    await controller.setXp('char1', { value: 500 }, { id: 'mj1' } as any);

    expect(characters.setXp).toHaveBeenCalledWith('char1', 'mj1', 500);
  });

  it('setSheetField() délègue à CharacterService avec le dto complet', async () => {
    characters.setSheetField.mockResolvedValue({
      character: { id: 'char1' },
      warnings: [],
    });

    await controller.setSheetField('char1', { path: 'fetiqueObject', value: 'Lanterne' }, {
      id: 'mj1',
    } as any);

    expect(characters.setSheetField).toHaveBeenCalledWith('char1', 'mj1', {
      path: 'fetiqueObject',
      value: 'Lanterne',
    });
  });

  it('updateNarrativeField() délègue à CharacterService avec le dto complet', async () => {
    characters.updateNarrativeField.mockResolvedValue({ id: 'char1' });

    await controller.updateNarrativeField(
      'char1',
      { field: 'motivation', value: 'Venger son village' },
      { id: 'u1' } as any,
    );

    expect(characters.updateNarrativeField).toHaveBeenCalledWith('char1', 'u1', {
      field: 'motivation',
      value: 'Venger son village',
    });
  });

  describe('validation HTTP réelle (ValidationPipe global)', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [CharactersController],
        providers: [
          { provide: CharacterService, useValue: characters },
          { provide: RyuutamaPdfService, useValue: ryuutamaPdf },
          { provide: EquipmentPdfService, useValue: equipmentPdf },
          { provide: NotesPdfService, useValue: notesPdf },
        ],
      })
        .overrideGuard(AuthenticatedGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest<{ user?: unknown }>();
            req.user = { id: 'u1' };
            return true;
          },
        })
        .compile();

      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('format invalide → 400 via le pipeline HTTP réel', async () => {
      characters.findOne.mockResolvedValue({
        id: 'char1',
        gameSystemId: 'ryuutama',
        sheetData: {},
        derived: {},
      });

      await request(app.getHttpServer())
        .get('/characters/11111111-1111-1111-1111-111111111111/export.pdf')
        .query({ format: '1page' })
        .expect(400);

      expect(ryuutamaPdf.fillCharacterPdf).not.toHaveBeenCalled();
    });

    it('format=editable → 200 via le pipeline HTTP réel', async () => {
      characters.findOne.mockResolvedValue({
        id: 'char1',
        gameSystemId: 'ryuutama',
        sheetData: {},
        derived: {},
      });
      ryuutamaPdf.fillCharacterPdf.mockResolvedValue(Buffer.from('pdf-bytes'));

      await request(app.getHttpServer())
        .get('/characters/11111111-1111-1111-1111-111111111111/export.pdf')
        .query({ format: 'editable' })
        .expect(200);
    });

    it('portrait trop volumineux (>5 Mo) → 413 via le pipeline HTTP réel (multer + ParseFilePipe)', async () => {
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);

      await request(app.getHttpServer())
        .put('/characters/11111111-1111-1111-1111-111111111111/portrait')
        .attach('file', oversized, 'portrait.jpg')
        .expect(413);

      expect(characters.updatePortrait).not.toHaveBeenCalled();
    });

    it('portrait de taille valide → CharacterService.updatePortrait est appelé', async () => {
      characters.updatePortrait.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        portraitUrl: '/uploads/portraits/x.jpg',
      });
      const small = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      await request(app.getHttpServer())
        .put('/characters/11111111-1111-1111-1111-111111111111/portrait')
        .attach('file', small, 'portrait.jpg')
        .expect(200);

      expect(characters.updatePortrait).toHaveBeenCalled();
    });

    it('PATCH pdf-portrait-crop avec scale hors bornes (>3) → 400 via le pipeline HTTP réel', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/pdf-portrait-crop')
        .send({ scale: 5, offsetX: 0, offsetY: 0 })
        .expect(400);

      expect(characters.updatePdfPortraitCrop).not.toHaveBeenCalled();
    });

    it('PATCH pdf-portrait-crop avec des valeurs valides → CharacterService.updatePdfPortraitCrop est appelé', async () => {
      characters.updatePdfPortraitCrop.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        pdfPortraitCropData: { scale: 1.5, offsetX: 10, offsetY: -10 },
      });

      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/pdf-portrait-crop')
        .send({ scale: 1.5, offsetX: 10, offsetY: -10 })
        .expect(200);

      expect(characters.updatePdfPortraitCrop).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { scale: 1.5, offsetX: 10, offsetY: -10 },
      );
    });

    it('POST inventory-items avec addedBy dans le body → 400 (ValidationPipe whitelist, AD-3)', async () => {
      await request(app.getHttpServer())
        .post('/characters/11111111-1111-1111-1111-111111111111/inventory-items')
        .send({ name: 'Objet suspect', weight: 1, addedBy: 'mj' })
        .expect(400);

      expect(characters.addInventoryItem).not.toHaveBeenCalled();
    });

    it('POST inventory-items sans weight → 200, CharacterService appelé', async () => {
      characters.addInventoryItem.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
      });

      await request(app.getHttpServer())
        .post('/characters/11111111-1111-1111-1111-111111111111/inventory-items')
        .send({ name: 'Sac' })
        .expect(201);

      expect(characters.addInventoryItem).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { name: 'Sac' },
      );
    });

    it('POST inventory-items sans name → 400 (class-validator)', async () => {
      await request(app.getHttpServer())
        .post('/characters/11111111-1111-1111-1111-111111111111/inventory-items')
        .send({ weight: 1 })
        .expect(400);

      expect(characters.addInventoryItem).not.toHaveBeenCalled();
    });

    it('PATCH inventory-items/:itemId avec addedBy dans le body → 400', async () => {
      await request(app.getHttpServer())
        .patch(
          '/characters/11111111-1111-1111-1111-111111111111/inventory-items/22222222-2222-2222-2222-222222222222',
        )
        .send({ addedBy: 'mj' })
        .expect(400);

      expect(characters.updateInventoryItem).not.toHaveBeenCalled();
    });

    it('PATCH inventory-items/:itemId avec itemId non UUID → 400 (ParseUUIDPipe)', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/inventory-items/abc')
        .send({ weight: 2 })
        .expect(400);

      expect(characters.updateInventoryItem).not.toHaveBeenCalled();
    });

    it('DELETE inventory-items/:itemId → 200, CharacterService appelé', async () => {
      characters.removeInventoryItem.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
      });

      await request(app.getHttpServer())
        .delete(
          '/characters/11111111-1111-1111-1111-111111111111/inventory-items/22222222-2222-2222-2222-222222222222',
        )
        .expect(200);

      expect(characters.removeInventoryItem).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        '22222222-2222-2222-2222-222222222222',
      );
    });

    it('POST notes sans text → 400 (class-validator)', async () => {
      await request(app.getHttpServer())
        .post('/characters/11111111-1111-1111-1111-111111111111/notes')
        .send({})
        .expect(400);

      expect(characters.addNote).not.toHaveBeenCalled();
    });

    it('POST notes avec text valide → 201, CharacterService appelé', async () => {
      characters.addNote.mockResolvedValue({
        id: 'note-1',
        characterId: '11111111-1111-1111-1111-111111111111',
        text: 'Une note',
        shared: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      await request(app.getHttpServer())
        .post('/characters/11111111-1111-1111-1111-111111111111/notes')
        .send({ text: 'Une note' })
        .expect(201);

      expect(characters.addNote).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { text: 'Une note' },
      );
    });

    it('PATCH notes/:noteId/share avec shared non-booléen → 400', async () => {
      await request(app.getHttpServer())
        .patch(
          '/characters/11111111-1111-1111-1111-111111111111/notes/22222222-2222-2222-2222-222222222222/share',
        )
        .send({ shared: 'yes' })
        .expect(400);

      expect(characters.toggleNoteShare).not.toHaveBeenCalled();
    });

    it('PATCH notes/:noteId/share avec un champ non déclaré → 400 (whitelist)', async () => {
      await request(app.getHttpServer())
        .patch(
          '/characters/11111111-1111-1111-1111-111111111111/notes/22222222-2222-2222-2222-222222222222/share',
        )
        .send({ shared: true, text: 'injection' })
        .expect(400);

      expect(characters.toggleNoteShare).not.toHaveBeenCalled();
    });

    it('PATCH notes/:noteId/share avec shared valide → 200, CharacterService appelé', async () => {
      characters.toggleNoteShare.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        shared: true,
      });

      await request(app.getHttpServer())
        .patch(
          '/characters/11111111-1111-1111-1111-111111111111/notes/22222222-2222-2222-2222-222222222222/share',
        )
        .send({ shared: true })
        .expect(200);

      expect(characters.toggleNoteShare).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        '22222222-2222-2222-2222-222222222222',
        true,
      );
    });

    it('GET notes → 200, CharacterService appelé', async () => {
      characters.getNotes.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/characters/11111111-1111-1111-1111-111111111111/notes')
        .expect(200);

      expect(characters.getNotes).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
      );
    });

    it('PATCH xp avec value non-entier → 400 (class-validator)', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/xp')
        .send({ value: 12.5 })
        .expect(400);

      expect(characters.setXp).not.toHaveBeenCalled();
    });

    it('PATCH xp avec value négatif → 400', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/xp')
        .send({ value: -1 })
        .expect(400);

      expect(characters.setXp).not.toHaveBeenCalled();
    });

    it('PATCH xp avec value valide → 200, CharacterService appelé', async () => {
      characters.setXp.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        xp: 500,
      });

      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/xp')
        .send({ value: 500 })
        .expect(200);

      expect(characters.setXp).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        500,
      );
    });

    it('PATCH sheet-field sans path → 400 (class-validator)', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/sheet-field')
        .send({ value: 'x' })
        .expect(400);

      expect(characters.setSheetField).not.toHaveBeenCalled();
    });

    it('PATCH sheet-field avec value: null → 200 (null autorisé, on vide un champ)', async () => {
      characters.setSheetField.mockResolvedValue({
        character: { id: '11111111-1111-1111-1111-111111111111' },
        warnings: [],
      });

      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/sheet-field')
        .send({ path: 'fetiqueObject', value: null })
        .expect(200);

      expect(characters.setSheetField).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { path: 'fetiqueObject', value: null },
      );
    });

    it('PATCH sheet-field avec un champ supplémentaire non déclaré → 400 (whitelist)', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/sheet-field')
        .send({ path: 'fetiqueObject', value: 'Lanterne', extra: 'intrus' })
        .expect(400);

      expect(characters.setSheetField).not.toHaveBeenCalled();
    });

    it('PATCH sheet-field avec path/value valides → 200, CharacterService appelé', async () => {
      characters.setSheetField.mockResolvedValue({
        character: { id: '11111111-1111-1111-1111-111111111111' },
        warnings: [],
      });

      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/sheet-field')
        .send({ path: 'fetiqueObject', value: 'Lanterne' })
        .expect(200);

      expect(characters.setSheetField).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { path: 'fetiqueObject', value: 'Lanterne' },
      );
    });

    it('PATCH narrative-field avec field hors liste autorisée (ex. "xp") → 400', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/narrative-field')
        .send({ field: 'xp', value: 999 })
        .expect(400);

      expect(characters.updateNarrativeField).not.toHaveBeenCalled();
    });

    it('PATCH narrative-field avec field hors liste autorisée (ex. "classId") → 400', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/narrative-field')
        .send({ field: 'classId', value: 'chasseur' })
        .expect(400);

      expect(characters.updateNarrativeField).not.toHaveBeenCalled();
    });

    it('PATCH narrative-field avec un champ supplémentaire non déclaré → 400 (whitelist)', async () => {
      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/narrative-field')
        .send({ field: 'motivation', value: 'x', extra: 'intrus' })
        .expect(400);

      expect(characters.updateNarrativeField).not.toHaveBeenCalled();
    });

    it('PATCH narrative-field avec field/value valides → 200, CharacterService appelé', async () => {
      characters.updateNarrativeField.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
      });

      await request(app.getHttpServer())
        .patch('/characters/11111111-1111-1111-1111-111111111111/narrative-field')
        .send({ field: 'motivation', value: 'Venger son village' })
        .expect(200);

      expect(characters.updateNarrativeField).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'u1',
        { field: 'motivation', value: 'Venger son village' },
      );
    });
  });
});
