import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { PartieDto } from '@master-jdr/shared';
import { PartiesService } from './parties.service';
import { API_BASE as API } from '../api-base';

describe('PartiesService (front)', () => {
  let service: PartiesService;
  let http: HttpTestingController;

  const partie: PartieDto = {
    id: 'p1',
    name: 'La Nuit',
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj1',
    ownerPseudo: 'mj-pseudo',
    ownerDisplayName: 'MJ Nom',
    createdAt: '2026-01-01T00:00:00.000Z',
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'mj',
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: null,
    can: { coverUpdate: true },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartiesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list(mj) → GET /parties?role=mj avec withCredentials', async () => {
    const p = service.list('mj');
    const req = http.expectOne(`${API}/parties?role=mj`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([partie]);
    expect(await p).toEqual([partie]);
  });

  it('list() sans rôle → GET /parties (toutes les parties, sans paramètre) avec withCredentials (Story 38.5)', async () => {
    const p = service.list();
    const req = http.expectOne(`${API}/parties`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([partie]);
    expect(await p).toEqual([partie]);
  });

  it('hide → PUT /parties/:id/hidden, sans corps utile, avec withCredentials (Story 42.5)', async () => {
    const p = service.hide('p1');
    const req = http.expectOne(`${API}/parties/p1/hidden`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ok: true });
    expect(await p).toEqual({ ok: true });
  });

  it('create → POST avec le payload', async () => {
    const payload = { name: 'La Nuit', kind: 'ONE_SHOT' as const, gameSystemId: 'draconis' };
    const p = service.create(payload);
    const req = http.expectOne(`${API}/parties`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(partie);
    expect(await p).toEqual(partie);
  });

  it('remove → DELETE /parties/:id', async () => {
    const p = service.remove('p1');
    const req = http.expectOne(`${API}/parties/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await p;
  });

  it('leave → DELETE /parties/:id/members/me avec withCredentials, sans confirmation de suppression (Story 39.5)', async () => {
    const p = service.leave('p1');
    const req = http.expectOne((r) => r.url === `${API}/parties/p1/members/me`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.params.has('deleteIfLastAdmin')).toBe(false);
    req.flush({ ok: true, deleted: false });
    expect(await p).toEqual({ ok: true, deleted: false });
  });

  it('leave(id, true) → envoie deleteIfLastAdmin=true (Story 39.5)', async () => {
    const p = service.leave('p1', true);
    const req = http.expectOne((r) => r.url === `${API}/parties/p1/members/me`);
    expect(req.request.params.get('deleteIfLastAdmin')).toBe('true');
    req.flush({ ok: true, deleted: true });
    expect(await p).toEqual({ ok: true, deleted: true });
  });

  it('close → PATCH /parties/:id/close avec withCredentials (Story 29.6)', async () => {
    const p = service.close('p1');
    const req = http.expectOne(`${API}/parties/p1/close`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ...partie, status: 'TERMINEE' });
    expect((await p).status).toBe('TERMINEE');
  });

  it('reopen → PATCH /parties/:id/reopen avec withCredentials (Story 29.6)', async () => {
    const p = service.reopen('p1');
    const req = http.expectOne(`${API}/parties/p1/reopen`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    req.flush(partie);
    expect(await p).toEqual(partie);
  });

  it('getVisibilityLocks → GET /parties/:id/visibility-locks avec withCredentials (Story 31.7)', async () => {
    const locks = [{ fieldKey: 'classId', subField: null }];
    const p = service.getVisibilityLocks('p1');
    const req = http.expectOne(`${API}/parties/p1/visibility-locks`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(locks);
    expect(await p).toEqual(locks);
  });

  it('setVisibilityLocks → PUT /parties/:id/visibility-locks avec le payload et withCredentials (Story 31.7)', async () => {
    const paths = [{ fieldKey: 'attributes', subField: 'AGI' }];
    const p = service.setVisibilityLocks('p1', paths);
    const req = http.expectOne(`${API}/parties/p1/visibility-locks`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ paths });
    expect(req.request.withCredentials).toBe(true);
    req.flush(paths);
    expect(await p).toEqual(paths);
  });

  it('notifyChanged() incrémente changed() (Story 18.3, AD-4)', () => {
    expect(service.changed()).toBe(0);
    service.notifyChanged();
    expect(service.changed()).toBe(1);
    service.notifyChanged();
    expect(service.changed()).toBe(2);
  });
});
