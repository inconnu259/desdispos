import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { BoardGameDto } from '@master-jdr/shared';
import { BoardGamesService } from './board-games.service';
import { API_BASE } from '../api-base';

const AZUL: BoardGameDto = {
  id: 'g1',
  name: 'Azul',
  nameKey: 'azul',
  minPlayers: 2,
  maxPlayers: 4,
  durationMin: 40,
  createdAt: '2026-10-29T10:00:00.000Z',
};

describe('BoardGamesService (Story 48.1)', () => {
  let service: BoardGamesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BoardGamesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() → GET /me/board-games avec withCredentials', async () => {
    const p = service.list();
    const req = http.expectOne(`${API_BASE}/me/board-games`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([AZUL]);
    expect(await p).toEqual([AZUL]);
  });

  it('listOf() → GET /users/:userId/board-games avec withCredentials, identifiant encodé (Story 48.3)', async () => {
    const library = { owner: { userId: 'u 2', pseudo: 'zoe', displayName: 'Zoé' }, games: [AZUL] };
    const p = service.listOf('u 2');
    const req = http.expectOne(`${API_BASE}/users/u%202/board-games`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(library);
    expect(await p).toEqual(library);
  });

  it('listOf() : un refus (404) rejette avec la réponse HTTP', async () => {
    const p = service.listOf('u2').catch((e: unknown) => e);
    http
      .expectOne(`${API_BASE}/users/u2/board-games`)
      .flush({ message: 'Ludothèque introuvable' }, { status: 404, statusText: 'Not Found' });
    expect(((await p) as { status: number }).status).toBe(404);
  });

  it('listOfGroup() → GET /parties/:id/board-games avec withCredentials, identifiant encodé (Story 50.1)', async () => {
    const dto = {
      games: [
        {
          nameKey: 'azul',
          name: 'Azul',
          minPlayers: 2,
          maxPlayers: 4,
          durationMin: 40,
          owners: [{ userId: 'u1', pseudo: 'lea', displayName: 'Léa' }],
        },
      ],
    };
    const p = service.listOfGroup('p 1');
    const req = http.expectOne(`${API_BASE}/parties/p%201/board-games`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(dto);
    expect(await p).toEqual(dto);
  });

  it('listOfGroup() : un refus (403) rejette avec la réponse HTTP', async () => {
    const p = service.listOfGroup('p1').catch((e: unknown) => e);
    http
      .expectOne(`${API_BASE}/parties/p1/board-games`)
      .flush({ message: 'refus' }, { status: 403, statusText: 'Forbidden' });
    expect(((await p) as { status: number }).status).toBe(403);
  });

  it('list() : chaque appel émet sa propre requête, jamais un instantané partagé', async () => {
    const a = service.list();
    const b = service.list();
    const pending = http.match(`${API_BASE}/me/board-games`);
    expect(pending).toHaveLength(2);
    pending[0].flush([]);
    pending[1].flush([AZUL]);
    expect(await a).toEqual([]);
    expect(await b).toEqual([AZUL]);

    // Un appel après la réponse du premier repart lui aussi au serveur.
    const c = service.list();
    http.expectOne(`${API_BASE}/me/board-games`).flush([AZUL, AZUL]);
    expect(await c).toHaveLength(2);
  });

  it('create() → POST /me/board-games avec le corps et withCredentials', async () => {
    const p = service.create({ name: 'Azul', minPlayers: 2, maxPlayers: 4, durationMin: 40 });
    const req = http.expectOne(`${API_BASE}/me/board-games`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({
      name: 'Azul',
      minPlayers: 2,
      maxPlayers: 4,
      durationMin: 40,
    });
    req.flush(AZUL);
    expect(await p).toEqual(AZUL);
  });

  it('update() → PATCH /me/board-games/:id avec le corps partiel et withCredentials', async () => {
    const p = service.update('g1', { name: 'Azul Summer', durationMin: null });
    const req = http.expectOne(`${API_BASE}/me/board-games/g1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ name: 'Azul Summer', durationMin: null });
    req.flush({ ...AZUL, name: 'Azul Summer', nameKey: 'azul summer', durationMin: null });
    expect((await p).name).toBe('Azul Summer');
  });

  it('remove() → DELETE /me/board-games/:id avec withCredentials', async () => {
    const p = service.remove('g1');
    const req = http.expectOne(`${API_BASE}/me/board-games/g1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('notifyChanged() incrémente `changed`', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
