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

  it('notifyChanged() incrémente `changed`', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
