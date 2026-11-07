import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { AnnouncementDto, AuthUser } from '@master-jdr/shared';
import { AccountService } from './account.service';
import { API_BASE } from '../api-base';

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updateDisplayName() appelle PATCH /me/display-name avec withCredentials et renvoie l’utilisateur', async () => {
    const promise = service.updateDisplayName('Nouveau nom');

    const req = http.expectOne(`${API_BASE}/me/display-name`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ displayName: 'Nouveau nom' });
    expect(req.request.withCredentials).toBe(true);

    const response: AuthUser = {
      id: 'u1',
      email: 'a@b.c',
      pseudo: 'alice',
      displayName: 'Nouveau nom',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
      theme: 'grimoire-emeraude',
      hideFinishedParties: false,
      availabilityReminder: true,
      partiesSort: 'urgence',
      partiesViewMode: 'medium',
      charactersViewMode: 'medium',
      charactersSort: 'partie',
      defaultCalendarLayers: [],
    };
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('setTheme() appelle PATCH /me/theme avec withCredentials et renvoie l’utilisateur', async () => {
    const promise = service.setTheme('foret-ancienne');

    const req = http.expectOne(`${API_BASE}/me/theme`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ theme: 'foret-ancienne' });
    expect(req.request.withCredentials).toBe(true);

    const response: AuthUser = {
      id: 'u1',
      email: 'a@b.c',
      pseudo: 'alice',
      displayName: 'alice',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
      theme: 'foret-ancienne',
      hideFinishedParties: false,
      availabilityReminder: true,
      partiesSort: 'urgence',
      partiesViewMode: 'medium',
      charactersViewMode: 'medium',
      charactersSort: 'partie',
      defaultCalendarLayers: [],
    };
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('changePassword() appelle PATCH /me/password avec withCredentials', async () => {
    const promise = service.changePassword('oldpw', 'newpassword123');

    const req = http.expectOne(`${API_BASE}/me/password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      currentPassword: 'oldpw',
      newPassword: 'newpassword123',
    });
    expect(req.request.withCredentials).toBe(true);

    req.flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('updatePreferences() appelle PATCH /me/preferences avec withCredentials et renvoie l’utilisateur (Story 29.8)', async () => {
    const promise = service.updatePreferences({ partiesSort: 'date' });

    const req = http.expectOne(`${API_BASE}/me/preferences`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ partiesSort: 'date' });
    expect(req.request.withCredentials).toBe(true);

    const response: AuthUser = {
      id: 'u1',
      email: 'a@b.c',
      pseudo: 'alice',
      displayName: 'alice',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
      theme: 'grimoire-emeraude',
      hideFinishedParties: false,
      availabilityReminder: true,
      partiesSort: 'date',
      partiesViewMode: 'medium',
      charactersViewMode: 'medium',
      charactersSort: 'partie',
      defaultCalendarLayers: [],
    };
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('updatePreferences() transmet defaultCalendarLayers tel quel (Story 30.4, Task 5)', async () => {
    const promise = service.updatePreferences({
      defaultCalendarLayers: ['mes-seances', 'votes-en-cours'],
    });

    const req = http.expectOne(`${API_BASE}/me/preferences`);
    expect(req.request.body).toEqual({
      defaultCalendarLayers: ['mes-seances', 'votes-en-cours'],
    });

    const response: AuthUser = {
      id: 'u1',
      email: 'a@b.c',
      pseudo: 'alice',
      displayName: 'alice',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
      theme: 'grimoire-emeraude',
      hideFinishedParties: false,
      availabilityReminder: true,
      partiesSort: 'urgence',
      partiesViewMode: 'medium',
      charactersViewMode: 'medium',
      charactersSort: 'partie',
      defaultCalendarLayers: ['mes-seances', 'votes-en-cours'],
    };
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('addFavorite() appelle PUT /me/favorites/:partieId avec withCredentials (Story 29.8)', async () => {
    const promise = service.addFavorite('p1');

    const req = http.expectOne(`${API_BASE}/me/favorites/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('removeFavorite() appelle DELETE /me/favorites/:partieId avec withCredentials (Story 29.8)', async () => {
    const promise = service.removeFavorite('p1');

    const req = http.expectOne(`${API_BASE}/me/favorites/p1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('requestEmailChange() appelle PATCH /me/email avec withCredentials', async () => {
    const promise = service.requestEmailChange('oldpw', 'new@example.com');

    const req = http.expectOne(`${API_BASE}/me/email`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      currentPassword: 'oldpw',
      newEmail: 'new@example.com',
    });
    expect(req.request.withCredentials).toBe(true);

    req.flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('getUnseenAnnouncements() appelle GET /me/unseen-announcements avec withCredentials (Story 29.13)', async () => {
    const promise = service.getUnseenAnnouncements();

    const req = http.expectOne(`${API_BASE}/me/unseen-announcements`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);

    const response: AnnouncementDto[] = [
      {
        id: 'a1',
        partieId: 'p1',
        scenarioId: null,
        text: 'Bienvenue',
        createdAt: '2026-08-01T00:00:00.000Z',
        authorPseudo: 'mj1',
        authorDisplayName: 'Le Meneur',
      },
    ];
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('markAnnouncementRead() appelle PUT /me/announcements-read/:announcementId avec withCredentials (Story 29.13)', async () => {
    const promise = service.markAnnouncementRead('a1');

    const req = http.expectOne(`${API_BASE}/me/announcements-read/a1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });
});
