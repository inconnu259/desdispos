import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { HommeDragonDto } from '@master-jdr/shared';
import { HommeDragonService } from './homme-dragon.service';
import { API_BASE } from '../api-base';

function makeDto(overrides: Partial<HommeDragonDto> = {}): HommeDragonDto {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    },
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 1, PS: 3 },
    eveilPowers: [],
    pendingEveilLevels: [],
    ...overrides,
  };
}

describe('HommeDragonService', () => {
  let service: HommeDragonService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HommeDragonService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMine() appelle GET /me/homme-dragons avec withCredentials et rend le tableau', async () => {
    const promise = service.listMine();

    const req = http.expectOne(`${API_BASE}/me/homme-dragons`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    const payload = [
      {
        id: 'hd1',
        aventures: [{ partieId: 'p1', nom: 'Le Convoi du Nord' }],
        gameSystemId: 'ryuutama',
        nom: 'Skarn',
        race: 'DRAGON_VERT' as const,
        createdAt: '2026-07-16T00:00:00.000Z',
      },
    ];
    req.flush(payload);

    await expect(promise).resolves.toEqual(payload);
  });

  it('findOne() appelle GET /homme-dragons/:id (la fiche, par son id) avec withCredentials', async () => {
    const promise = service.findOne('hd1');

    const req = http.expectOne(`${API_BASE}/homme-dragons/hd1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);

    req.flush(makeDto());

    await expect(promise).resolves.toEqual(makeDto());
  });

  it('findOne() : les appels concurrents pour le même Homme Dragon partagent une seule requête en vol', async () => {
    const a = service.findOne('hd1');
    const b = service.findOne('hd1');

    const req = http.expectOne(`${API_BASE}/homme-dragons/hd1`);
    req.flush(makeDto());

    await expect(Promise.all([a, b])).resolves.toEqual([makeDto(), makeDto()]);
  });

  it('findForPartie() appelle GET /parties/:id/homme-dragon et rend { id, nom } ou null', async () => {
    const lie = service.findForPartie('p1');
    const req = http.expectOne(`${API_BASE}/parties/p1/homme-dragon`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: 'hd1', nom: 'Ignis' });
    await expect(lie).resolves.toEqual({ id: 'hd1', nom: 'Ignis' });

    const libre = service.findForPartie('p2');
    http.expectOne(`${API_BASE}/parties/p2/homme-dragon`).flush(null);
    await expect(libre).resolves.toBeNull();
  });

  it('link() appelle PUT /parties/:id/homme-dragon/:hommeDragonId, withCredentials', async () => {
    const promise = service.link('p1', 'hd1');

    const req = http.expectOne(`${API_BASE}/parties/p1/homme-dragon/hd1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeDto());

    await expect(promise).resolves.toEqual(makeDto());
  });

  it('unlink() appelle DELETE /parties/:id/homme-dragon/:hommeDragonId, withCredentials', async () => {
    const promise = service.unlink('p1', 'hd1');

    const req = http.expectOne(`${API_BASE}/parties/p1/homme-dragon/hd1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeDto());

    await expect(promise).resolves.toEqual(makeDto());
  });

  it('create() appelle POST /parties/:id/homme-dragon avec le DTO, withCredentials', async () => {
    const dto = { race: 'DRAGON_ROUGE' as const, artefact: { key: 'grand-arc' }, nom: 'Ignis' };
    const promise = service.create('p1', dto);

    const req = http.expectOne(`${API_BASE}/parties/p1/homme-dragon`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.withCredentials).toBe(true);

    req.flush(makeDto());

    await expect(promise).resolves.toEqual(makeDto());
  });

  it('update() appelle PATCH /homme-dragons/:id avec le DTO, withCredentials', async () => {
    const dto = { artefact: { key: 'grande-epee' } };
    const promise = service.update('hd1', dto);

    const req = http.expectOne(`${API_BASE}/homme-dragons/hd1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(dto);
    expect(req.request.withCredentials).toBe(true);

    req.flush(
      makeDto({
        sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grande-epee' }, nom: 'Ignis' },
      }),
    );

    await expect(promise).resolves.toBeDefined();
  });

  it('chooseEveilPower() appelle POST /homme-dragons/:id/eveil-power avec le DTO, withCredentials', async () => {
    const dto = { level: 2, key: 'escorte-du-dragon' };
    const promise = service.chooseEveilPower('hd1', dto);

    const req = http.expectOne(`${API_BASE}/homme-dragons/hd1/eveil-power`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.withCredentials).toBe(true);

    req.flush(makeDto({ eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }] }));

    await expect(promise).resolves.toBeDefined();
  });

  it('chooseArtefactCadeau() appelle POST /homme-dragons/:id/artefact-cadeau avec le DTO, withCredentials (Story 33.7)', async () => {
    const dto = { key: 'lanterne' };
    const promise = service.chooseArtefactCadeau('hd1', dto);

    const req = http.expectOne(`${API_BASE}/homme-dragons/hd1/artefact-cadeau`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.withCredentials).toBe(true);

    req.flush(makeDto());

    await expect(promise).resolves.toBeDefined();
  });

  it.each([{ key: 'courage' }, { key: null }])(
    'setReserveSlot() appelle PUT /homme-dragons/:id/reserve/:slot avec le DTO, withCredentials (Story 33.6)',
    async (dto) => {
      const promise = service.setReserveSlot('hd1', 2, dto);

      const req = http.expectOne(`${API_BASE}/homme-dragons/hd1/reserve/2`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      expect(req.request.withCredentials).toBe(true);

      req.flush(makeDto());

      await expect(promise).resolves.toBeDefined();
    },
  );

  it.each(['editable', '2pages'] as const)(
    'exportPdf(hommeDragonId, "%s") → GET /homme-dragons/:id/export.pdf?format=... en blob, withCredentials',
    async (format) => {
      const promise = service.exportPdf('hd1', format);

      const req = http.expectOne(
        (r) =>
          r.url === `${API_BASE}/homme-dragons/hd1/export.pdf` && r.params.get('format') === format,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      expect(req.request.withCredentials).toBe(true);
      const blob = new Blob(['%PDF-1.6'], { type: 'application/pdf' });
      req.flush(blob);

      await expect(promise).resolves.toEqual(blob);
    },
  );

  it('notifyChanged() incrémente changed() (Story 20.2, AC2)', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
