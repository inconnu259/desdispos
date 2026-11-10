import { Test } from '@nestjs/testing';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));
jest.mock('@desdispos/game-rules', () => ({
  mapNotesToPdfFields: jest.fn(() => [
    { field: 'Note.0.0', value: '01/07/2026', kind: 'text' },
    { field: 'Note.0.1', value: 'Première entrée', kind: 'text' },
    { field: 'Note.1.0', value: '', kind: 'text' },
  ]),
}));

import { readFile } from 'node:fs/promises';
import { mapNotesToPdfFields } from '@desdispos/game-rules';
import { NotesPdfService } from './notes-pdf.service';
import type { CharacterNoteDto } from '@desdispos/shared';

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

function makeNotes(overrides: Partial<Record<string, unknown>>[] = []): CharacterNoteDto[] {
  const defaults = [
    {
      id: 'n1',
      characterId: 'c1',
      text: 'Première entrée',
      shared: false,
      scenarioId: null,
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  ];
  return (overrides.length ? overrides : defaults) as unknown as CharacterNoteDto[];
}

describe('NotesPdfService', () => {
  let service: NotesPdfService;
  const mockReadFile = readFile as jest.Mock;
  const mockMapFields = mapNotesToPdfFields as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-bytes'));
    mockMapFields.mockReturnValue([
      { field: 'Note.0.0', value: '01/07/2026', kind: 'text' },
      { field: 'Note.0.1', value: 'Première entrée', kind: 'text' },
      { field: 'Note.1.0', value: '', kind: 'text' },
    ]);

    const module = await Test.createTestingModule({
      providers: [NotesPdfService],
    }).compile();
    service = module.get(NotesPdfService);
  });

  it('remplit les champs non vides retournés par mapNotesToPdfFields', async () => {
    await service.fillNotesPdf(makeNotes());

    expect(mockForm.getTextField).toHaveBeenCalledWith('Note.0.0');
    expect(mockForm.getTextField).toHaveBeenCalledWith('Note.0.1');
    expect(mockSetText).toHaveBeenCalledWith('01/07/2026');
    expect(mockSetText).toHaveBeenCalledWith('Première entrée');
  });

  it('champ vide ("Note.1.0") ignoré, jamais écrit', async () => {
    await service.fillNotesPdf(makeNotes());

    expect(mockForm.getTextField).not.toHaveBeenCalledWith('Note.1.0');
  });

  it('projette les notes (text/createdAt) vers mapNotesToPdfFields', async () => {
    await service.fillNotesPdf(makeNotes());

    expect(mockMapFields).toHaveBeenCalledWith({
      notes: [{ text: 'Première entrée', createdAt: '2026-07-01T00:00:00.000Z' }],
    });
  });

  it('liste de notes vide → PDF généré sans erreur (aucun champ rempli)', async () => {
    mockMapFields.mockReturnValue([
      { field: 'Note.0.0', value: '', kind: 'text' },
      { field: 'Note.0.1', value: '', kind: 'text' },
    ]);

    await expect(service.fillNotesPdf([])).resolves.toBeInstanceOf(Buffer);
    expect(mockForm.getTextField).not.toHaveBeenCalled();
  });

  it('template introuvable → erreur explicite pointant vers le README', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(service.fillNotesPdf(makeNotes())).rejects.toThrow(
      'Template PDF notes Ryuutama introuvable',
    );
  });

  it('échec de setText sur un champ → erreur explicite, pas un crash silencieux', async () => {
    mockForm.getTextField.mockImplementationOnce(() => {
      throw new Error('champ inconnu');
    });

    await expect(service.fillNotesPdf(makeNotes())).rejects.toThrow(/introuvable\/incompatible/);
  });
});
