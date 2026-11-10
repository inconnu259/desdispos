import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { GameSystemDto } from '@desdispos/shared';
import { CharacterService } from './character.service';
import { API_BASE as API } from '../api-base';
import { makeCharacterDto } from './character-dto.fixture';

describe('CharacterService (front)', () => {
  let service: CharacterService;
  let http: HttpTestingController;

  const character = makeCharacterDto({ id: 'c1' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CharacterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getGameSystems() → GET /game-systems avec withCredentials', async () => {
    const p = service.getGameSystems();
    const req = http.expectOne(`${API}/game-systems`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    const systems: GameSystemDto[] = [{ id: 'ryuutama', name: 'Ryuutama', version: '1.0.0' }];
    req.flush(systems);
    expect(await p).toEqual(systems);
  });

  it('getGameSystemSchema(id) → GET /game-systems/:id/schema', async () => {
    const p = service.getGameSystemSchema('ryuutama');
    const req = http.expectOne(`${API}/game-systems/ryuutama/schema`);
    expect(req.request.method).toBe('GET');
    req.flush({ sheetSchema: {}, creationSteps: [] });
    expect(await p).toEqual({ sheetSchema: {}, creationSteps: [] });
  });

  it('getGameSystemContent(id) → GET /game-systems/:id/content', async () => {
    const p = service.getGameSystemContent('ryuutama');
    const req = http.expectOne(`${API}/game-systems/ryuutama/content`);
    expect(req.request.method).toBe('GET');
    const content = { class: [{ key: 'chasseur', data: { label: 'Chasseur' } }] };
    req.flush(content);
    expect(await p).toEqual(content);
  });

  it('create(partieId, dto) → POST /parties/:id/characters avec le payload', async () => {
    const dto = { gameSystemId: 'ryuutama', sheetData: {} };
    const p = service.create('p1', dto);
    const req = http.expectOne(`${API}/parties/p1/characters`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('listByPartie(partieId) → GET /parties/:id/characters', async () => {
    const p = service.listByPartie('p1');
    const req = http.expectOne(`${API}/parties/p1/characters`);
    expect(req.request.method).toBe('GET');
    req.flush([character]);
    expect(await p).toEqual([character]);
  });

  it('listMine() (Story 29.2) → GET /me/characters avec withCredentials', async () => {
    const mine = { ...character, partieName: 'La Forêt Noire' };
    const p = service.listMine();
    const req = http.expectOne(`${API}/me/characters`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([mine]);
    expect(await p).toEqual([mine]);
  });

  it('get(id) → GET /characters/:id avec withCredentials', async () => {
    const p = service.get('c1');
    const req = http.expectOne(`${API}/characters/c1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('exportPdf(id, format) → GET /characters/:id/export.pdf?format=... en blob', async () => {
    const p = service.exportPdf('c1', 'editable');
    const req = http.expectOne(
      (r) => r.url === `${API}/characters/c1/export.pdf` && r.params.get('format') === 'editable',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBe(true);
    const blob = new Blob(['%PDF-1.6'], { type: 'application/pdf' });
    req.flush(blob);
    expect(await p).toEqual(blob);
  });

  it('exportPdf(id, "2pages") → passe le format en query param', async () => {
    const p = service.exportPdf('c1', '2pages');
    const req = http.expectOne(
      (r) => r.url === `${API}/characters/c1/export.pdf` && r.params.get('format') === '2pages',
    );
    req.flush(new Blob());
    await p;
  });

  it('updatePortrait(id, file, cropData) → PUT /characters/:id/portrait en FormData avec file + cropData JSON', async () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const p = service.updatePortrait('c1', file, { scale: 1.2, offsetX: 1, offsetY: -1 });
    const req = http.expectOne(`${API}/characters/c1/portrait`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toBeInstanceOf(FormData);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('cropData')).toBe(JSON.stringify({ scale: 1.2, offsetX: 1, offsetY: -1 }));
    req.flush({ ...character, portraitUrl: '/uploads/portraits/x.jpg' });
    expect((await p).portraitUrl).toBe('/uploads/portraits/x.jpg');
  });

  it('updatePortrait(id, file, null) → FormData sans champ cropData', async () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const p = service.updatePortrait('c1', file, null);
    const req = http.expectOne(`${API}/characters/c1/portrait`);
    const body = req.request.body as FormData;
    expect(body.has('cropData')).toBe(false);
    req.flush(character);
    await p;
  });

  it('removePortrait(id) → DELETE /characters/:id/portrait', async () => {
    const p = service.removePortrait('c1');
    const req = http.expectOne(`${API}/characters/c1/portrait`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ...character, portraitUrl: null });
    expect((await p).portraitUrl).toBeNull();
  });

  it('patchPdfPortraitCrop(id, cropData) → PATCH /characters/:id/pdf-portrait-crop en JSON, sans fichier', async () => {
    const cropData = { scale: 1.4, offsetX: 2, offsetY: -3 };
    const p = service.patchPdfPortraitCrop('c1', cropData);
    const req = http.expectOne(`${API}/characters/c1/pdf-portrait-crop`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(cropData);
    req.flush({ ...character, pdfPortraitCropData: cropData });
    expect((await p).pdfPortraitCropData).toEqual(cropData);
  });

  it('addInventoryItem(id, dto) → POST /characters/:id/inventory-items', async () => {
    const dto = { name: 'Cape', weight: 1.2 };
    const p = service.addInventoryItem('c1', dto);
    const req = http.expectOne(`${API}/characters/c1/inventory-items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('updateInventoryItem(id, itemId, dto) → PATCH /characters/:id/inventory-items/:itemId', async () => {
    const dto = { weight: 2 };
    const p = service.updateInventoryItem('c1', 'item-1', dto);
    const req = http.expectOne(`${API}/characters/c1/inventory-items/item-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('removeInventoryItem(id, itemId) → DELETE /characters/:id/inventory-items/:itemId', async () => {
    const p = service.removeInventoryItem('c1', 'item-2');
    const req = http.expectOne(`${API}/characters/c1/inventory-items/item-2`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('addContenant(id, dto) → POST /characters/:id/contenants (Story 14.2)', async () => {
    const dto = { name: 'Sac à dos', weight: 2 };
    const p = service.addContenant('c1', dto);
    const req = http.expectOne(`${API}/characters/c1/contenants`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('updateContenant(id, itemId, dto) → PATCH /characters/:id/contenants/:itemId', async () => {
    const dto = { weight: 3 };
    const p = service.updateContenant('c1', 'cont-1', dto);
    const req = http.expectOne(`${API}/characters/c1/contenants/cont-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('removeContenant(id, itemId) → DELETE /characters/:id/contenants/:itemId', async () => {
    const p = service.removeContenant('c1', 'cont-2');
    const req = http.expectOne(`${API}/characters/c1/contenants/cont-2`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('addAnimal(id, dto) → POST /characters/:id/animaux (Story 14.2)', async () => {
    const dto = { name: 'Cheval' };
    const p = service.addAnimal('c1', dto);
    const req = http.expectOne(`${API}/characters/c1/animaux`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('updateAnimal(id, itemId, dto) → PATCH /characters/:id/animaux/:itemId', async () => {
    const dto = { effect: 'Rapide' };
    const p = service.updateAnimal('c1', 'ani-1', dto);
    const req = http.expectOne(`${API}/characters/c1/animaux/ani-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('removeAnimal(id, itemId) → DELETE /characters/:id/animaux/:itemId', async () => {
    const p = service.removeAnimal('c1', 'ani-2');
    const req = http.expectOne(`${API}/characters/c1/animaux/ani-2`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('addNote(id, dto) → POST /characters/:id/notes', async () => {
    const dto = { text: 'Une note' };
    const note = {
      id: 'note-1',
      characterId: 'c1',
      text: 'Une note',
      shared: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const p = service.addNote('c1', dto);
    const req = http.expectOne(`${API}/characters/c1/notes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(note);
    expect(await p).toEqual(note);
  });

  it('toggleNoteShare(id, noteId, shared) → PATCH /characters/:id/notes/:noteId/share', async () => {
    const note = {
      id: 'note-1',
      characterId: 'c1',
      text: 'Une note',
      shared: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const p = service.toggleNoteShare('c1', 'note-1', true);
    const req = http.expectOne(`${API}/characters/c1/notes/note-1/share`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ shared: true });
    req.flush(note);
    expect(await p).toEqual(note);
  });

  it('setJournalAutoAssociate(id, value) → PATCH /characters/:id/journal-auto-associate', async () => {
    const character = { id: 'c1', journalAutoAssociate: true };
    const p = service.setJournalAutoAssociate('c1', true);
    const req = http.expectOne(`${API}/characters/c1/journal-auto-associate`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ journalAutoAssociate: true });
    req.flush(character);
    expect(await p).toEqual(character);
  });

  it('setNoteScenario(id, noteId, scenarioId) → PATCH /characters/:id/notes/:noteId/scenario', async () => {
    const note = {
      id: 'note-1',
      characterId: 'c1',
      text: 'Une note',
      shared: true,
      scenarioId: 'scenario1',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const p = service.setNoteScenario('c1', 'note-1', 'scenario1');
    const req = http.expectOne(`${API}/characters/c1/notes/note-1/scenario`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ scenarioId: 'scenario1' });
    req.flush(note);
    expect(await p).toEqual(note);
  });

  it('setNoteScenario(id, noteId, null) → désassocie', async () => {
    const p = service.setNoteScenario('c1', 'note-1', null);
    const req = http.expectOne(`${API}/characters/c1/notes/note-1/scenario`);
    expect(req.request.body).toEqual({ scenarioId: null });
    req.flush({});
    await p;
  });

  it('getNotes(id) → GET /characters/:id/notes', async () => {
    const notes = [
      {
        id: 'note-1',
        characterId: 'c1',
        text: 'Une note',
        shared: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const p = service.getNotes('c1');
    const req = http.expectOne(`${API}/characters/c1/notes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(notes);
    expect(await p).toEqual(notes);
  });

  it('notifyChanged() incrémente changed() (Story 20.1, AC2)', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
