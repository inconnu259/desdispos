import type { NextFunction, Request, Response } from 'express';

declare module 'express-session' {
  interface SessionData {
    /** Horodatage (ms) de la connexion qui a ouvert cette session — posé par `LocalAuthGuard`. */
    authenticatedAt?: number;
    passport?: { user?: unknown };
  }
}

/** Durée de vie ABSOLUE d'une session authentifiée, quelle que soit l'activité. */
export const SESSION_ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * À placer AVANT `passport.session()`. Le cookie expire 7 jours après la connexion, mais l'expiration
 * côté store glisse à chaque requête : un cookie volé, rejoué au moins une fois par semaine, restait
 * valable indéfiniment. Au-delà de la durée absolue, la session est remplacée par une session vide —
 * `passport.session()` ne trouve alors plus d'utilisateur et la route répond 401/403 comme pour un
 * visiteur anonyme.
 *
 * Une session authentifiée ouverte avant ce mécanisme (sans `authenticatedAt`) reçoit l'horodatage
 * courant : elle expirera au plus tard dans 30 jours.
 */
export function enforceSessionLifetime(maxAgeMs = SESSION_ABSOLUTE_LIFETIME_MS, now = Date.now) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const session = req.session;
    if (!session?.passport?.user) return next();
    if (session.authenticatedAt === undefined) {
      session.authenticatedAt = now();
      return next();
    }
    if (now() - session.authenticatedAt <= maxAgeMs) return next();
    session.regenerate((err) => next(err));
  };
}
