import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { PartySignalsDto } from '@desdispos/shared';
import { PartySignalsService } from './party-signals.service';
import { API_BASE as API } from '../api-base';

describe('PartySignalsService', () => {
  let service: PartySignalsService;
  let http: HttpTestingController;

  const dto: PartySignalsDto = {
    role: 'mj',
    status: 'EN_COURS',
    signals: ['AUCUN_MEMBRE_INVITE'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartySignalsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('un seul appel GET /me/party-signals au montage (AC1), avec withCredentials', () => {
    const req = http.expectOne(`${API}/me/party-signals`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ p1: dto });
  });

  it('role/status/signals ressortent tels quels du DTO — aucune transformation (AC4)', async () => {
    const req = http.expectOne(`${API}/me/party-signals`);
    req.flush({ p1: dto });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.signals().get('p1')).toEqual(dto);
  });

  it('une partie absente de la réponse est absente de la Map (jamais une valeur inventée)', async () => {
    const req = http.expectOne(`${API}/me/party-signals`);
    req.flush({ p1: dto });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.signals().has('p2')).toBe(false);
  });

  it('notifyChanged() déclenche un second appel GET (AC6, appelé par RealtimeService sur user:{id})', async () => {
    http.expectOne(`${API}/me/party-signals`).flush({ p1: dto });
    await Promise.resolve();
    await Promise.resolve();
    service.notifyChanged();
    const req = http.expectOne(`${API}/me/party-signals`);
    expect(req.request.method).toBe('GET');
    req.flush({ p1: { ...dto, signals: [] } });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.signals().get('p1')).toEqual({ ...dto, signals: [] });
  });

  it('un échec réseau transitoire conserve le dernier état connu bon (jamais de .set(new Map()))', async () => {
    http.expectOne(`${API}/me/party-signals`).flush({ p1: dto });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.signals().get('p1')).toEqual(dto);

    service.notifyChanged();
    http
      .expectOne(`${API}/me/party-signals`)
      .flush('erreur', { status: 500, statusText: 'Internal Server Error' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.signals().get('p1')).toEqual(dto);
  });
});
