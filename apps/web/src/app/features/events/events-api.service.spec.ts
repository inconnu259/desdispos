import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EventCardDto } from '@master-jdr/shared';
import { API_BASE as API } from '../../core/api-base';
import { EventsApiService } from './events-api.service';

describe('EventsApiService (Story 40.1)', () => {
  let service: EventsApiService;
  let http: HttpTestingController;

  const card: EventCardDto = {
    id: 'e1',
    title: 'Catane',
    hostId: 'u1',
    hostDisplayName: 'Léa',
    seance: null,
    participants: [],
    myInscription: null,
    cancelled: false,
    can: { propose: false, edit: false, choose: false, extend: false },
    poll: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list → GET /parties/:id/events/list (jamais le flux SSE /events), avec withCredentials', async () => {
    const p = service.list('p1');
    const req = http.expectOne(`${API}/parties/p1/events/list`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([card]);
    expect(await p).toEqual([card]);
  });

  it('boardGames → GET /events/:eventId/board-games, avec withCredentials (Story 49.1)', async () => {
    const dto = { games: [], brings: [], participantsCount: 3, envies: [] };
    const p = service.boardGames('e1');
    const req = http.expectOne(`${API}/events/e1/board-games`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(dto);
    expect(await p).toEqual(dto);
  });

  it('bring → PUT /events/:eventId/board-games/:id/bring, sans corps, avec withCredentials (Story 49.2)', async () => {
    const p = service.bring('e1', 'g1');
    const req = http.expectOne(`${API}/events/e1/board-games/g1/bring`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('unbring → DELETE /events/:eventId/board-games/:id/bring, avec withCredentials (Story 49.2)', async () => {
    const p = service.unbring('e1', 'g1');
    const req = http.expectOne(`${API}/events/e1/board-games/g1/bring`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('exclude → PUT /events/:eventId/board-games/:id/exclusion, sans corps, avec withCredentials (Story 49.4)', async () => {
    const p = service.exclude('e1', 'g1');
    const req = http.expectOne(`${API}/events/e1/board-games/g1/exclusion`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('restore → DELETE /events/:eventId/board-games/:id/exclusion, avec withCredentials (Story 49.4)', async () => {
    const p = service.restore('e1', 'g1');
    const req = http.expectOne(`${API}/events/e1/board-games/g1/exclusion`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('envy → PUT /events/:eventId/envies avec { nameKey }, avec withCredentials (Story 49.5)', async () => {
    const p = service.envy('e1', 'azul');
    const req = http.expectOne(`${API}/events/e1/envies`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ nameKey: 'azul' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('unenvy → DELETE /events/:eventId/envies avec { nameKey } en corps, avec withCredentials (Story 49.5)', async () => {
    const p = service.unenvy('e1', 'azul');
    const req = http.expectOne(`${API}/events/e1/envies`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ nameKey: 'azul' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(p).resolves.toBeUndefined();
  });

  it('un refus d’envy rejette avec la réponse HTTP (400 : nom plus sur place)', async () => {
    const p = service.envy('e1', 'azul');
    http
      .expectOne(`${API}/events/e1/envies`)
      .flush({ message: 'Hors place' }, { status: 400, statusText: 'Bad Request' });
    await expect(p).rejects.toMatchObject({ status: 400 });
  });

  it('un refus de bring rejette avec la réponse HTTP (la page décide quoi en faire)', async () => {
    const p = service.bring('e1', 'g1');
    http
      .expectOne(`${API}/events/e1/board-games/g1/bring`)
      .flush({ message: 'Jeu introuvable' }, { status: 404, statusText: 'Not Found' });
    await expect(p).rejects.toMatchObject({ status: 404 });
  });

  it('broughtCount → GET /me/board-games/:id/brought-count, avec withCredentials (Story 49.2)', async () => {
    const p = service.broughtCount('g1');
    const req = http.expectOne(`${API}/me/board-games/g1/brought-count`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ count: 2 });
    expect(await p).toEqual({ count: 2 });
  });

  it('create → POST /parties/:id/events avec le payload', async () => {
    const dto = { title: 'Catane', date: '2031-10-10', slot: 'EVENING' as const, capacity: null };
    const p = service.create('p1', dto);
    const req = http.expectOne(`${API}/parties/p1/events`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('update → PATCH /parties/:id/events/:eventId avec le payload complet (Story 40.2)', async () => {
    const dto = { title: 'Catane', date: '2031-10-10', slot: 'MORNING' as const, capacity: 6 };
    const p = service.update('p1', 'e1', dto);
    const req = http.expectOne(`${API}/parties/p1/events/e1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(dto);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('cancel → POST /parties/:id/events/:eventId/cancel, sans corps, avec withCredentials (Story 42.1)', async () => {
    const p = service.cancel('p1', 'e1');
    const req = http.expectOne(`${API}/parties/p1/events/e1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toBeNull();
    req.flush({ ...card, cancelled: true });
    expect((await p).cancelled).toBe(true);
  });

  it('inscrire → POST /scenarios/seances/:id/inscription (route partagée), avec withCredentials (Story 40.3)', async () => {
    const p = service.inscrire('s1');
    const req = http.expectOne(`${API}/scenarios/seances/s1/inscription`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('desinscrire → DELETE /scenarios/seances/:id/inscription, avec withCredentials (Story 40.3)', async () => {
    const p = service.desinscrire('s1');
    const req = http.expectOne(`${API}/scenarios/seances/s1/inscription`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('accepter → PATCH /scenarios/seances/:id/inscription/accept, avec withCredentials (Story 40.4)', async () => {
    const p = service.accepter('s1');
    const req = http.expectOne(`${API}/scenarios/seances/s1/inscription/accept`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('reserver → POST /scenarios/seances/:id/reservations avec l’identifiant du membre (Story 40.4)', async () => {
    const p = service.reserver('s1', 'u2');
    const req = http.expectOne(`${API}/scenarios/seances/s1/reservations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ userId: 'u2' });
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('retirerReservation → DELETE /scenarios/seances/:id/reservations/:userId (Story 40.4)', async () => {
    const p = service.retirerReservation('s1', 'u2');
    const req = http.expectOne(`${API}/scenarios/seances/s1/reservations/u2`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(card);
    expect(await p).toEqual(card);
  });

  it('choose → PATCH /parties/:id/poll/:pollId/choose avec l’identifiant du créneau (route partagée, Story 40.6)', async () => {
    const p = service.choose('p1', 'poll-1', 'o2');
    const req = http.expectOne(`${API}/parties/p1/poll/poll-1/choose`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ optionId: 'o2' });
    req.flush(null);
    await expect(p).resolves.toBeNull();
  });

  it('extend → PATCH /parties/:id/poll/:pollId/extend avec le nouveau jour d’échéance (Story 40.7)', async () => {
    const p = service.extend('p1', 'poll-1', '2026-11-02');
    const req = http.expectOne(`${API}/parties/p1/poll/poll-1/extend`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ expiresAt: '2026-11-02' });
    req.flush(null);
    await expect(p).resolves.toBeNull();
  });
});
