import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { InvitationDto } from '@desdispos/shared';
import { InvitationsService } from './invitations.service';
import { API_BASE } from '../api-base';

// L'incohérence est corrigée : le service utilise désormais `API_BASE` (cf. `../api-base`), comme
// tous les autres services. On importe donc la même source ici plutôt que de figer une URL, afin que
// ce test reste valide quel que soit l'hôte depuis lequel l'app est servie.
const API = API_BASE;

const INVITATION: InvitationDto = {
  id: 'inv1',
  partie: { id: 'p1', name: 'Ma Campagne', gameSystemId: 'ryuutama' },
  inviterPseudo: 'MJ',
  status: 'PENDING',
  createdAt: '2026-07-22T00:00:00.000Z',
};

describe('InvitationsService (front)', () => {
  let service: InvitationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listReceived() → GET /invitations avec withCredentials', async () => {
    const p = service.listReceived();
    const req = http.expectOne(`${API}/invitations`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([INVITATION]);
    expect(await p).toEqual([INVITATION]);
  });

  it('accept(id) → POST /invitations/:id/accept avec withCredentials', async () => {
    const p = service.accept('inv1');
    const req = http.expectOne(`${API}/invitations/inv1/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
    await expect(p).resolves.toBeDefined();
  });

  it('decline(id) → POST /invitations/:id/decline avec withCredentials', async () => {
    const p = service.decline('inv1');
    const req = http.expectOne(`${API}/invitations/inv1/decline`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
    await expect(p).resolves.toBeDefined();
  });

  it('notifyChanged() incrémente changed() (Story 21.1)', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
