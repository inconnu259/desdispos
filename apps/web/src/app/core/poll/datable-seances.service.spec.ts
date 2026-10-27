import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { DatableSeanceEntry } from '@master-jdr/shared';
import { DatableSeancesService } from './datable-seances.service';

// Story 45.1 — `DatableSeancesService` : une lecture paresseuse de `GET /me/datable-seances`, relue sur
// `user:{id}` seulement une fois démarrée, et sans jamais laisser une réponse périmée écraser une plus fraîche.

function entry(id: string): DatableSeanceEntry {
  return {
    durationSlots: 1,
    seanceId: id,
    partieId: 'p1',
    partieName: 'Partie',
    family: 'jdr',
    kind: 'CAMPAGNE_LINEAIRE',
    title: 'Titre',
    seanceRank: 1,
    seanceCount: 1,
    can: { propose: true, edit: true, choose: true, extend: false },
  };
}

const isRead = (r: { url: string }) => r.url.endsWith('/me/datable-seances');

describe('DatableSeancesService (Story 45.1)', () => {
  let service: DatableSeancesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DatableSeancesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ne lit rien avant le premier refresh, et le temps réel n’y change rien', () => {
    service.notifyChanged();
    http.expectNone(isRead);
    expect(service.loaded()).toBe(false);
  });

  it('refresh lit la liste ; ensuite le temps réel la relit', async () => {
    const first = service.refresh();
    http.expectOne(isRead).flush([entry('s1')]);
    await first;
    expect(service.entries().map((e) => e.seanceId)).toEqual(['s1']);
    expect(service.loaded()).toBe(true);

    service.notifyChanged();
    http.expectOne(isRead).flush([]);
    await vi.waitFor(() => expect(service.entries()).toEqual([]));
  });

  it('une réponse périmée n’écrase pas une plus fraîche', async () => {
    const a = service.refresh();
    const b = service.refresh();
    const [reqA, reqB] = http.match(isRead);
    reqB.flush([entry('frais')]);
    await b;
    reqA.flush([entry('perime')]);
    await a;
    expect(service.entries().map((e) => e.seanceId)).toEqual(['frais']);
  });

  it('un échec garde le dernier état connu bon', async () => {
    const first = service.refresh();
    http.expectOne(isRead).flush([entry('s1')]);
    await first;
    const second = service.refresh();
    http.expectOne(isRead).flush('boom', { status: 500, statusText: 'KO' });
    await second;
    expect(service.entries().map((e) => e.seanceId)).toEqual(['s1']);
  });
});
