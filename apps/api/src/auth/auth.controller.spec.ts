import type { Request } from 'express';

// AuthController -> AuthService -> import RUNTIME (pas `import type`) de THEMES depuis
// @desdispos/shared (ESM, non transformé par ts-jest) — même piège déjà documenté pour
// GAME_SYSTEMS/@desdispos/game-rules (Story 28.4, revue de code).
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: {
    recordSession: jest.Mock;
    forgetSession: jest.Mock;
    confirmEmailChange: jest.Mock;
    rollbackEmailChange: jest.Mock;
  };

  beforeEach(() => {
    auth = {
      recordSession: jest.fn().mockResolvedValue(undefined),
      forgetSession: jest.fn().mockResolvedValue(undefined),
      confirmEmailChange: jest.fn(),
      rollbackEmailChange: jest.fn(),
    };
    controller = new AuthController(auth as unknown as AuthService);
  });

  describe('login', () => {
    it('enregistre la UserSession (userId, sid) après req.login() et renvoie req.user', async () => {
      const req = {
        user: { id: 'u1' },
        sessionID: 'sess1',
      } as unknown as Request;

      const result = await controller.login(req);

      expect(auth.recordSession).toHaveBeenCalledWith('u1', 'sess1');
      expect(result).toBe(req.user);
    });
  });

  describe('logout', () => {
    it('supprime la UserSession (via forgetSession) avant la destruction de la session', async () => {
      const callOrder: string[] = [];
      const req = {
        sessionID: 'sess1',
        logout: (cb: (err?: Error) => void) => {
          callOrder.push('logout');
          cb();
        },
        session: {
          destroy: (cb: () => void) => {
            callOrder.push('session.destroy');
            cb();
          },
        },
      } as unknown as Request;
      auth.forgetSession.mockImplementation(() => {
        callOrder.push('forgetSession');
        return Promise.resolve();
      });

      const result = await controller.logout(req);

      expect(auth.forgetSession).toHaveBeenCalledWith('sess1');
      expect(callOrder).toEqual(['logout', 'forgetSession', 'session.destroy']);
      expect(result).toEqual({ ok: true });
    });

    it('un échec de forgetSession (best-effort) ne bloque pas la destruction de la session', async () => {
      const callOrder: string[] = [];
      const req = {
        sessionID: 'sess1',
        logout: (cb: (err?: Error) => void) => {
          callOrder.push('logout');
          cb();
        },
        session: {
          destroy: (cb: () => void) => {
            callOrder.push('session.destroy');
            cb();
          },
        },
      } as unknown as Request;
      auth.forgetSession.mockRejectedValue(new Error('DB down'));

      const result = await controller.logout(req);

      expect(callOrder).toEqual(['logout', 'session.destroy']);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('confirmEmailChange', () => {
    it('délègue à AuthService.confirmEmailChange avec le token du corps', async () => {
      auth.confirmEmailChange.mockResolvedValue({ ok: true });

      const result = await controller.confirmEmailChange({
        token: 'tok1.secret',
      });

      expect(auth.confirmEmailChange).toHaveBeenCalledWith('tok1.secret');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('rollbackEmailChange', () => {
    it('délègue à AuthService.rollbackEmailChange avec le token du corps', async () => {
      auth.rollbackEmailChange.mockResolvedValue({ ok: true });

      const result = await controller.rollbackEmailChange({
        token: 'rb1.secret',
      });

      expect(auth.rollbackEmailChange).toHaveBeenCalledWith('rb1.secret');
      expect(result).toEqual({ ok: true });
    });
  });
});
