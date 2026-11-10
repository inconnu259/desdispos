import { ForbiddenException, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  MAX_SSE_STREAMS_PER_USER,
  RealtimeController,
  SSE_HEARTBEAT_MS,
} from './realtime.controller';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { RealtimeEventsService, partieTopic, userTopic } from './realtime-events.service';

function makePermissions() {
  return { assert: jest.fn() };
}

/** Requête dont la session est (ou n'est plus) dans le store. */
function fakeReq(state: { valid: boolean } = { valid: true }): Request {
  return {
    sessionID: 'sid1',
    sessionStore: {
      get: (_sid: string, cb: (err: unknown, s: unknown) => void) =>
        cb(null, state.valid ? { passport: { user: 'u1' } } : null),
    },
  } as unknown as Request;
}

describe('RealtimeController', () => {
  let controller: RealtimeController;
  let permissions: ReturnType<typeof makePermissions>;
  let realtimeEvents: RealtimeEventsService;

  beforeEach(async () => {
    permissions = makePermissions();
    realtimeEvents = new RealtimeEventsService();
    const module = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [
        { provide: PermissionService, useValue: permissions },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
      ],
    }).compile();
    controller = module.get(RealtimeController);
  });

  it('membre/MJ de la Partie → PARTIE_READ vérifié, un emit() sur le bon topic remonte un MessageEvent (AC1)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

    const stream = await controller.partieEvents('p1', { id: 'u1' } as any, fakeReq());
    const received = firstValueFrom(stream.pipe(take(1)));

    expect(permissions.assert).toHaveBeenCalledWith('u1', 'PARTIE_READ', { partieId: 'p1' });
    realtimeEvents.emit(partieTopic('p1'));

    await expect(received).resolves.toEqual({ data: {} });
  });

  it('non-membre → ForbiddenException propagée par permissions.assert, subscribe jamais atteint (AC1)', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException());
    const subscribeSpy = jest.spyOn(realtimeEvents, 'subscribe');

    await expect(
      controller.partieEvents('p1', { id: 'stranger' } as any, fakeReq()),
    ).rejects.toThrow(ForbiddenException);
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it("emit() sur un autre topic ne fait remonter aucun MessageEvent sur l'Observable du client (AC1, filtrage traversé sans casse)", async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

    const stream = await controller.partieEvents('p1', { id: 'u1' } as any, fakeReq());
    const receivedFromOther: unknown[] = [];
    stream.subscribe((e) => receivedFromOther.push(e));

    realtimeEvents.emit(partieTopic('autre-id'));

    expect(receivedFromOther).toEqual([]);
  });

  it('un utilisateur authentifié reçoit les événements de son propre topic utilisateur (AC1, Story 21.1)', async () => {
    const stream = controller.userEvents({ id: 'u1' } as any, fakeReq());
    const received = firstValueFrom(stream.pipe(take(1)));

    realtimeEvents.emit(userTopic('u1'));

    await expect(received).resolves.toEqual({ data: {} });
  });

  it("emit() sur le topic d'un AUTRE utilisateur ne fait remonter aucun MessageEvent (AC1, Story 21.1)", () => {
    const stream = controller.userEvents({ id: 'u1' } as any, fakeReq());
    const received: unknown[] = [];
    stream.subscribe((e) => received.push(e));

    realtimeEvents.emit(userTopic('autre-utilisateur'));

    expect(received).toEqual([]);
  });

  describe('revue de sécurité : battement, droit revérifié, plafond', () => {
    afterEach(() => jest.useRealTimers());

    it('émet un « ping » nommé à chaque battement tant que le droit tient', async () => {
      jest.useFakeTimers();
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      const stream = await controller.partieEvents('p1', { id: 'u1' } as any, fakeReq());
      const received: unknown[] = [];
      const sub = stream.subscribe((e) => received.push(e));

      await jest.advanceTimersByTimeAsync(SSE_HEARTBEAT_MS);
      expect(received).toEqual([{ type: 'ping', data: '' }]);
      sub.unsubscribe();
    });

    it('membre retiré : le flux se ferme au battement suivant', async () => {
      jest.useFakeTimers();
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      const stream = await controller.partieEvents('p1', { id: 'u1' } as any, fakeReq());
      let completed = false;
      stream.subscribe({ complete: () => (completed = true) });

      permissions.assert.mockRejectedValue(new ForbiddenException());
      await jest.advanceTimersByTimeAsync(SSE_HEARTBEAT_MS);
      expect(completed).toBe(true);
    });

    it('session révoquée : le flux personnel se ferme au battement suivant', async () => {
      jest.useFakeTimers();
      const state = { valid: true };
      const stream = controller.userEvents({ id: 'u1' } as any, fakeReq(state));
      let completed = false;
      stream.subscribe({ complete: () => (completed = true) });

      state.valid = false;
      await jest.advanceTimersByTimeAsync(SSE_HEARTBEAT_MS);
      expect(completed).toBe(true);
    });

    it(`au-delà de ${MAX_SSE_STREAMS_PER_USER} flux simultanés → 429 ; une fermeture libère une place`, () => {
      const subs = Array.from({ length: MAX_SSE_STREAMS_PER_USER }, () =>
        controller.userEvents({ id: 'u1' } as any, fakeReq()).subscribe(),
      );
      expect(() => controller.userEvents({ id: 'u1' } as any, fakeReq())).toThrow(HttpException);
      // Un autre utilisateur n'est pas concerné.
      expect(() => controller.userEvents({ id: 'u2' } as any, fakeReq())).not.toThrow();

      subs[0].unsubscribe();
      expect(() => controller.userEvents({ id: 'u1' } as any, fakeReq())).not.toThrow();
      subs.forEach((s) => s.unsubscribe());
    });
  });
});
