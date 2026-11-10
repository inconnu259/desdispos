import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { AnnouncementDto } from '@desdispos/shared';
import { AnnouncementsService } from './announcements.service';
import { API_BASE } from '../api-base';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnnouncementsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create() appelle POST /parties/:id/announcements avec le DTO, withCredentials', async () => {
    const promise = service.create('p1', { text: 'Une annonce', scenarioId: 's1' });

    const req = http.expectOne(`${API_BASE}/parties/p1/announcements`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Une annonce', scenarioId: 's1' });
    expect(req.request.withCredentials).toBe(true);

    const response: AnnouncementDto = {
      id: 'ann1',
      partieId: 'p1',
      scenarioId: 's1',
      text: 'Une annonce',
      createdAt: '2026-07-15T00:00:00.000Z',
      authorPseudo: 'le-mj',
      authorDisplayName: 'Le Grand MJ',
    };
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('listAll() appelle GET /parties/:id/announcements avec withCredentials (Story 9.2)', async () => {
    const promise = service.listAll('p1');

    const req = http.expectOne(`${API_BASE}/parties/p1/announcements`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);

    const response: AnnouncementDto[] = [
      {
        id: 'ann1',
        partieId: 'p1',
        scenarioId: null,
        text: 'Une annonce',
        createdAt: '2026-07-15T00:00:00.000Z',
        authorPseudo: 'le-mj',
        authorDisplayName: 'Le Grand MJ',
      },
    ];
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });
});
