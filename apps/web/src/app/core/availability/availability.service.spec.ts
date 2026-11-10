import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { AvailabilityDeclarationDto } from '@desdispos/shared';
import { AvailabilityService } from './availability.service';
import { API_BASE } from '../api-base';

const DECLARATION: AvailabilityDeclarationDto = {
  id: 'decl1',
  userId: 'u1',
  kind: 'UNAVAILABLE',
  recurKind: 'RECURRING',
  dayOfWeek: 3,
  slot: 'EVENING',
  startDate: null,
  endDate: null,
  expiresAt: '2027-01-01T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('AvailabilityService (front)', () => {
  let service: AvailabilityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AvailabilityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMyDeclarations() → GET /availability avec withCredentials', async () => {
    const p = service.getMyDeclarations();
    const req = http.expectOne(`${API_BASE}/availability`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([DECLARATION]);
    expect(await p).toEqual([DECLARATION]);
  });

  it('createDeclaration(dto) → POST /availability avec withCredentials', async () => {
    const p = service.createDeclaration({
      kind: 'UNAVAILABLE',
      recurKind: 'RECURRING',
      dayOfWeek: 3,
      slot: 'EVENING',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    const req = http.expectOne(`${API_BASE}/availability`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ created: [DECLARATION] });
    await expect(p).resolves.toEqual({ created: [DECLARATION] });
  });

  it('updateDeclaration(id, dto) → PATCH /availability/:id avec withCredentials', async () => {
    const p = service.updateDeclaration('decl1', { kind: 'AVAILABLE' });
    const req = http.expectOne(`${API_BASE}/availability/decl1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBe(true);
    req.flush(DECLARATION);
    await expect(p).resolves.toEqual(DECLARATION);
  });

  it('deleteDeclaration(id) → DELETE /availability/:id avec withCredentials', async () => {
    const p = service.deleteDeclaration('decl1');
    const req = http.expectOne(`${API_BASE}/availability/decl1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
    await expect(p).resolves.toBeNull();
  });

  it('createDeclarationBatch(items) → un seul POST /availability/batch avec withCredentials', async () => {
    const items = [
      {
        kind: 'UNAVAILABLE' as const,
        recurKind: 'RECURRING' as const,
        dayOfWeek: 1,
        slot: 'MORNING' as const,
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
      {
        kind: 'UNAVAILABLE' as const,
        recurKind: 'RECURRING' as const,
        dayOfWeek: 2,
        slot: 'AFTERNOON' as const,
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
    ];
    const p = service.createDeclarationBatch(items);
    const req = http.expectOne(`${API_BASE}/availability/batch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ items });
    req.flush({ created: [DECLARATION, DECLARATION] });
    await expect(p).resolves.toEqual({ created: [DECLARATION, DECLARATION] });
  });

  it('createDeclarationBatch(items) → 409 devient une ConflictError portant les conflits du lot', async () => {
    const items = [
      {
        kind: 'UNAVAILABLE' as const,
        recurKind: 'RECURRING' as const,
        dayOfWeek: 1,
        slot: 'MORNING' as const,
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
    ];
    const p = service.createDeclarationBatch(items);
    const req = http.expectOne(`${API_BASE}/availability/batch`);
    req.flush(
      {
        conflicts: [
          {
            id: '',
            kind: 'AVAILABLE',
            slot: 'MORNING',
            recurKind: 'RECURRING',
            startDate: null,
            endDate: null,
            dayOfWeek: 1,
            batchIndex: 0,
          },
        ],
      },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(p).rejects.toMatchObject({
      conflicts: [expect.objectContaining({ batchIndex: 0 })],
    });
  });

  it('splitOccurrence(id, body) → POST /availability/:id/split avec withCredentials', async () => {
    const p = service.splitOccurrence('decl1', { occurrence: '2026-07-01', action: 'delete' });
    const req = http.expectOne(`${API_BASE}/availability/decl1/split`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ created: [], deleted: ['decl1'] });
    await expect(p).resolves.toEqual({ created: [], deleted: ['decl1'] });
  });

  it('notifyChanged() incrémente changed() (bug fix : calendrier MJ jamais notifié)', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
