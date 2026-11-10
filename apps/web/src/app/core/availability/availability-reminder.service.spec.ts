import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountService } from '../account/account.service';
import { AuthService } from '../auth/auth.service';
import { AvailabilityReminderService } from './availability-reminder.service';

describe('AvailabilityReminderService (Story 52.5)', () => {
  let service: AvailabilityReminderService;
  let http: HttpTestingController;
  interface TestUser {
    id: string;
    availabilityReminder: boolean;
  }
  let currentUser: ReturnType<typeof signal<TestUser | null>>;
  let updatePreferences: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentUser = signal<TestUser | null>({ id: 'u1', availabilityReminder: true });
    updatePreferences = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser } },
        { provide: AccountService, useValue: { updatePreferences } },
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
    currentUser.set({ id: 'u2', availabilityReminder: true });
    expect(service.show()).toBe(false);

    // Le temps réel ne relit pas tant que la nouvelle personne n'a pas demandé sa première lecture.
    service.notifyChanged();
    expect(pending()).toHaveLength(0);

    const second = service.refresh();
    pending()[0].flush('boom', { status: 500, statusText: 'Server Error' });
    await second;
    expect(service.show()).toBe(false);
  });

  describe('setEnabled() — le seul écrivain de la préférence (Story 52.6)', () => {
    const user = (over: Partial<TestUser & { theme: string }> = {}) => ({
      id: 'u1',
      availabilityReminder: true,
      ...over,
    });

    const tick = async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve();
    };

    /** Répond à toutes les relectures en attente (`show` donné) et laisse les promesses se résoudre. */
    async function answerReads(show: boolean): Promise<void> {
      await tick();
      pending().forEach((r) => r.flush({ show }));
      await tick();
    }

    async function showing(): Promise<void> {
      const first = service.refresh();
      pending()[0].flush({ show: true });
      await first;
    }

    it('couper : valeur et bandeau changent AUSSITÔT, l’AuthUser renvoyé remplace celui du compte, puis le rappel est relu', async () => {
      await showing();
      let resolveWrite!: (u: unknown) => void;
      updatePreferences.mockReturnValue(new Promise((r) => (resolveWrite = r)));

      const done = service.setEnabled(false);
      // Optimiste : avant même la réponse du serveur.
      expect(currentUser()!.availabilityReminder).toBe(false);
      expect(service.show()).toBe(false);
      expect(updatePreferences).toHaveBeenCalledWith({ availabilityReminder: false });

      // Le serveur renvoie un AuthUser observablement différent de la valeur optimiste : c'est LUI qui est adopté.
      const fromServer = user({ availabilityReminder: false, theme: 'foret-ancienne' });
      resolveWrite(fromServer);
      await answerReads(false);

      expect(await done).toBe(true);
      expect(currentUser()).toBe(fromServer);
      expect(service.show()).toBe(false);
    });

    it('réactiver : le rappel est écrit à vrai, relu, et le bandeau revient si la règle du serveur le veut', async () => {
      currentUser.set(user({ availabilityReminder: false }));
      updatePreferences.mockResolvedValue(user({ availabilityReminder: true }));

      const done = service.setEnabled(true);
      await answerReads(true);

      expect(await done).toBe(true);
      expect(updatePreferences).toHaveBeenCalledWith({ availabilityReminder: true });
      expect(currentUser()!.availabilityReminder).toBe(true);
      expect(service.show()).toBe(true);
    });

    it('un échec rend la valeur et le bandeau confirmés, relit le rappel, et résout faux', async () => {
      await showing();
      updatePreferences.mockRejectedValue(new Error('réseau'));

      const done = service.setEnabled(false);
      await answerReads(true);

      expect(await done).toBe(false);
      expect(currentUser()!.availabilityReminder).toBe(true);
      expect(service.show()).toBe(true);
    });

    it('un échec ancien ne défait pas un choix plus récent, et ne se signale pas (résout vrai)', async () => {
      // Départ : rappel actif ET bandeau affiché. Le premier choix (couper) échoue, le second (réactiver) réussit.
      await showing();
      let failFirst!: (e: Error) => void;
      updatePreferences
        .mockReturnValueOnce(new Promise((_, rej) => (failFirst = rej)))
        .mockResolvedValueOnce(user({ availabilityReminder: true }));

      const first = service.setEnabled(false);
      const second = service.setEnabled(true);
      failFirst(new Error('réseau'));
      expect(await first).toBe(true);

      await answerReads(true);
      expect(await second).toBe(true);
      expect(currentUser()!.availabilityReminder).toBe(true);
      expect(service.show()).toBe(true);
    });

    it('un échec ancien, parti d’une autre valeur que le choix récent, ne l’écrase pas', async () => {
      // Départ : rappel COUPÉ. Premier choix (réactiver) échoue, second (couper de nouveau) réussit.
      currentUser.set(user({ availabilityReminder: false }));
      let failFirst!: (e: Error) => void;
      updatePreferences
        .mockReturnValueOnce(new Promise((_, rej) => (failFirst = rej)))
        .mockResolvedValueOnce(user({ availabilityReminder: false }));

      const first = service.setEnabled(true);
      const second = service.setEnabled(false);
      failFirst(new Error('réseau'));
      await first;
      await answerReads(false);
      await second;

      expect(currentUser()!.availabilityReminder).toBe(false);
      expect(service.show()).toBe(false);
    });

    it('deux échecs de suite reviennent à la valeur CONFIRMÉE, jamais à l’optimiste du premier choix', async () => {
      await showing();
      let failFirst!: (e: Error) => void;
      let failSecond!: (e: Error) => void;
      updatePreferences
        .mockReturnValueOnce(new Promise((_, rej) => (failFirst = rej)))
        .mockReturnValueOnce(new Promise((_, rej) => (failSecond = rej)));

      const first = service.setEnabled(false);
      const second = service.setEnabled(true);
      failFirst(new Error('réseau'));
      failSecond(new Error('réseau'));
      await first;
      const done = second;
      await answerReads(true);

      expect(await done).toBe(false);
      // Le serveur tenait « vrai » avec le bandeau affiché : c'est ce qui revient, pas le « faux » du premier choix.
      expect(currentUser()!.availabilityReminder).toBe(true);
      expect(service.show()).toBe(true);
    });

    it('une relecture partie AVANT la coupure ne rallume pas le bandeau en revenant', async () => {
      await showing();
      const stale = service.refresh();
      const [staleReq] = pending();
      updatePreferences.mockResolvedValue(user({ availabilityReminder: false }));

      const done = service.setEnabled(false);
      staleReq.flush({ show: true });
      await stale;
      expect(service.show()).toBe(false);

      await answerReads(false);
      await done;
      expect(service.show()).toBe(false);
    });

    it('si la personne change pendant l’écriture, rien n’est touché chez la suivante', async () => {
      await showing();
      let resolveWrite!: (u: unknown) => void;
      updatePreferences.mockReturnValue(new Promise((r) => (resolveWrite = r)));

      const done = service.setEnabled(false);
      currentUser.set(user({ id: 'u2', availabilityReminder: true }));
      resolveWrite(user({ availabilityReminder: false }));

      expect(await done).toBe(false);
      expect(currentUser()!.id).toBe('u2');
      expect(currentUser()!.availabilityReminder).toBe(true);
      expect(pending()).toHaveLength(0);
    });

    it('sans personne connectée, rien n’est écrit', async () => {
      currentUser.set(null);
      expect(await service.setEnabled(false)).toBe(false);
      expect(updatePreferences).not.toHaveBeenCalled();
    });
  });

  it('une réponse qui arrive après un changement de compte est écartée', async () => {
    const done = service.refresh();
    const [req] = pending();

    currentUser.set({ id: 'u2', availabilityReminder: true });
    req.flush({ show: true });
    await done;

    expect(service.show()).toBe(false);
  });
});
