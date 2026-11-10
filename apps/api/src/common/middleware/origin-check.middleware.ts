import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Protection CSRF : toute requête qui MODIFIE (POST/PUT/PATCH/DELETE) doit venir d'une origine autorisée
 * du front. `SameSite=lax` seul laisse passer, par exemple, un formulaire auto-soumis vers `/auth/login`
 * depuis un autre site (« login CSRF » : la victime se retrouve connectée au compte de l'attaquant).
 *
 * Un navigateur envoie `Origin` sur toute requête non-GET (même same-origin) ; à défaut on lit `Referer`.
 * Sans aucun des deux, la requête ne vient pas d'un navigateur (curl, tests, sondes) : elle ne porte donc
 * pas les cookies d'une victime et n'est pas un vecteur CSRF — on la laisse passer.
 */
export function originCheck(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source =
      typeof origin === 'string' && origin !== ''
        ? origin === 'null'
          ? null
          : originOf(origin)
        : typeof referer === 'string' && referer !== ''
          ? originOf(referer)
          : undefined;
    if (source === undefined || (source !== null && allowed.has(source))) return next();
    res.status(403).json({ statusCode: 403, message: 'Origine de la requête refusée' });
  };
}
