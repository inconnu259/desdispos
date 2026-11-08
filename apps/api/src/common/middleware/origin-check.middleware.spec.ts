import type { NextFunction, Request, Response } from 'express';
import { originCheck } from './origin-check.middleware';

function run(method: string, headers: Record<string, string>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next: NextFunction = jest.fn();
  originCheck(['https://desdispos.example', 'http://localhost:4200'])(
    { method, headers } as unknown as Request,
    res as unknown as Response,
    next,
  );
  return { next: next as jest.Mock, res };
}

describe('originCheck (protection CSRF)', () => {
  it('laisse passer les méthodes sûres, quelle que soit l’origine', () => {
    expect(run('GET', { origin: 'https://evil.example' }).next).toHaveBeenCalled();
  });

  it('laisse passer une requête qui modifie depuis une origine autorisée', () => {
    expect(run('POST', { origin: 'https://desdispos.example' }).next).toHaveBeenCalled();
    expect(run('DELETE', { origin: 'http://localhost:4200' }).next).toHaveBeenCalled();
  });

  it('refuse (403) une requête qui modifie depuis une autre origine — login CSRF compris', () => {
    const { next, res } = run('POST', { origin: 'https://evil.example' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('refuse les origines opaques (`null`) et mal formées', () => {
    expect(run('POST', { origin: 'null' }).res.status).toHaveBeenCalledWith(403);
    expect(run('PATCH', { origin: 'pas une url' }).res.status).toHaveBeenCalledWith(403);
  });

  it('sans Origin, juge sur le Referer', () => {
    expect(run('PUT', { referer: 'http://localhost:4200/parties/1' }).next).toHaveBeenCalled();
    expect(run('PUT', { referer: 'https://evil.example/x' }).res.status).toHaveBeenCalledWith(403);
  });

  it('sans Origin ni Referer (client non navigateur, sans cookie de victime) : laisse passer', () => {
    expect(run('POST', {}).next).toHaveBeenCalled();
  });
});
