import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { CharacterGroupRoleDto } from '@desdispos/shared';
import { CharacterRolesService } from './character-roles.service';
import { API_BASE } from '../api-base';

describe('CharacterRolesService', () => {
  let service: CharacterRolesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CharacterRolesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listForPartie() appelle GET /parties/:id/character-roles avec withCredentials', async () => {
    const promise = service.listForPartie('p1');

    const req = http.expectOne(`${API_BASE}/parties/p1/character-roles`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);

    const response: CharacterGroupRoleDto[] = [
      {
        id: 'role1',
        characterId: 'char1',
        partieId: 'p1',
        roleKey: 'cartographe',
        assignedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });

  it('notifyChanged() incrémente le signal changed() (contrat AD-8, zéro argument)', () => {
    const before = service.changed();
    service.notifyChanged();
    expect(service.changed()).toBe(before + 1);
  });
});
