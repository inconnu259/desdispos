import type { Request, Response } from 'express';
import { enforceSessionLifetime } from './session-lifetime.middleware';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

function run(session: Record<string, unknown> | undefined) {
  const next = jest.fn();
  const regenerate = jest.fn((cb: (err?: unknown) => void) => cb());
  const req: { session?: Record<string, unknown> } = {
    session: session ? { ...session, regenerate } : undefined,
  };
  enforceSessionLifetime(30 * DAY, () => NOW)(req as unknown as Request, {} as Response, next);
  return { next, regenerate, session: req.session };
}

describe('enforceSessionLifetime', () => {
  it('ignore les sessions anonymes', () => {
    const { next, regenerate } = run({ authenticatedAt: 0 });
    expect(next).toHaveBeenCalledWith();
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('garde une session authentifiée de moins de 30 jours', () => {
    const { next, regenerate } = run({ passport: { user: 'u1' }, authenticatedAt: NOW - 29 * DAY });
    expect(next).toHaveBeenCalledWith();
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('remplace par une session vide une session authentifiée de plus de 30 jours', () => {
    const { next, regenerate } = run({ passport: { user: 'u1' }, authenticatedAt: NOW - 31 * DAY });
    expect(regenerate).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(undefined);
  });

  it('horodate une session authentifiée antérieure au mécanisme', () => {
    const { session, regenerate } = run({ passport: { user: 'u1' } });
    expect(session?.authenticatedAt).toBe(NOW);
    expect(regenerate).not.toHaveBeenCalled();
  });
});
