import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { AvailabilityReminderService } from './availability-reminder.service';

describe('AvailabilityReminderService (Story 52.5)', () => {
  let service: AvailabilityReminderService;
  let http: HttpTestingController;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;

  beforeEach(() => {
    currentUser = signal<{ id: string } | null>({ id: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser } },
      ],
    });
    service = TestBed.inject(AvailabilityReminderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  const pending = () => http.match((r) => r.url.endsWith('/me/availability-reminder'));

  it('ne lit rien avant le premier refresh() et reste faux (aucun clignotement)', () => {
    expect(service.show()).toBe(false);
    service.notifyChanged();
    expect(pending()).toHaveLength(0);
  });

  it('refresh() lit GET /me/availability-reminder avec les cookies et expose la réponse', async () => {
    const done = service.refresh();
    const [req] = pending();
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(service.show()).toBe(false);

    req.flush({ show: true });
    await done;

    expect(service.show()).toBe(true);
  });

  it('sans personne connectée, refresh() ne lit rien', async () => {
    currentUser.set(null);
    await service.refresh();
    expect(pending()).toHaveLength(0);
    expect(service.show()).toBe(false);
  });

  it('notifyChanged() relit une fois une première lecture faite, et peut éteindre le rappel', async () => {
    const first = service.refresh();
    pending()[0].flush({ show: true });
    await first;
    expect(service.show()).toBe(true);

    service.notifyChanged();
    const [again] = pending();
    expect(again).toBeDefined();
    again.flush({ show: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.show()).toBe(false);
  });

  it('un échec garde le dernier état connu : rien ne s’affiche si rien n’a jamais été lu', async () => {
    const done = service.refresh();
    pending()[0].flush('boom', { status: 500, statusText: 'Server Error' });
    await done;
    expect(service.show()).toBe(false);
  });

  it('un échec ne retire pas un rappel déjà affiché', async () => {
    const first = service.refresh();
    pending()[0].flush({ show: true });
    await first;

    const second = service.refresh();
    pending()[0].flush('boom', { status: 500, statusText: 'Server Error' });
    await second;

    expect(service.show()).toBe(true);
  });

  it('une réponse plus ancienne qu’une réponse déjà appliquée n’écrase jamais un état plus frais', async () => {
    const older = service.refresh();
    const newer = service.refresh();
    const [reqOlder, reqNewer] = pending();

    reqNewer.flush({ show: false });
    await newer;
    reqOlder.flush({ show: true });
    await older;

    expect(service.show()).toBe(false);
  });

  it('une réponse plus ancienne reste valable quand la plus récente a échoué', async () => {
    const older = service.refresh();
    const newer = service.refresh();
    const [reqOlder, reqNewer] = pending();

    reqNewer.flush('boom', { status: 500, statusText: 'Server Error' });
    await newer;
    reqOlder.flush({ show: true });
    await older;

    expect(service.show()).toBe(true);
  });

  it('le rappel d’un compte ne s’affiche jamais chez le suivant, même si sa première lecture échoue', async () => {
    const first = service.refresh();
    pending()[0].flush({ show: true });
    await first;
    expect(service.show()).toBe(true);

    // Déconnexion puis connexion d'une autre personne dans la même page.
    currentUser.set(null);
    expect(service.show()).toBe(false);
    currentUser.set({ id: 'u2' });
    expect(service.show()).toBe(false);

    // Le temps réel ne relit pas tant que la nouvelle personne n'a pas demandé sa première lecture.
    service.notifyChanged();
    expect(pending()).toHaveLength(0);

    const second = service.refresh();
    pending()[0].flush('boom', { status: 500, statusText: 'Server Error' });
    await second;
    expect(service.show()).toBe(false);
  });

  it('une réponse qui arrive après un changement de compte est écartée', async () => {
    const done = service.refresh();
    const [req] = pending();

    currentUser.set({ id: 'u2' });
    req.flush({ show: true });
    await done;

    expect(service.show()).toBe(false);
  });
});
