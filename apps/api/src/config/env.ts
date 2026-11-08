/**
 * Lecture et contrôle des variables d'environnement sensibles. Pas de ConfigModule dans ce projet
 * (cf. email.module.ts, prisma.service.ts) : fonctions pures sur `process.env`, testables en leur passant
 * un objet d'environnement.
 */

type Env = Record<string, string | undefined>;

/** Valeurs de `.env.dev` (fichier versionné, donc PUBLIC) : un serveur de production qui les utilise est
 *  ouvert à quiconque lit le dépôt (sessions forgeables, compte admin connu). */
const DEV_SESSION_SECRET = 'dev-secret-change-me-please';
const DEV_ADMIN_PASSWORD = 'change-me-admin';
const DEV_POSTGRES_PASSWORD = 'changeme';
const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 12;
const DEFAULT_WEB_ORIGIN = 'http://localhost:4200';

/** Origines autorisées du front (CORS, contrôle d'Origin). `WEB_ORIGIN` accepte une LISTE séparée par
 *  des virgules : en dev, `localhost:4200` et l'IP LAN du poste (test sur un vrai téléphone). */
export function webOrigins(env: Env = process.env): string[] {
  return (env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/** Origine publique du front, pour les liens des e-mails : la PREMIÈRE de `WEB_ORIGIN`. Coller la liste
 *  brute dans un lien le cassait dès qu'elle contenait deux origines. */
export function publicWebOrigin(env: Env = process.env): string {
  return webOrigins(env)[0] ?? DEFAULT_WEB_ORIGIN;
}

/** Secret de signature du cookie de session. Plus de valeur de repli : un repli codé en dur rendait les
 *  sessions forgeables dès que la variable manquait, sans la moindre erreur. */
export function sessionSecret(env: Env = process.env): string {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET est requis (variable manquante ou vide)');
  return secret;
}

/** `trust proxy` d'Express, ou `undefined` (pas de proxy de confiance). En prod derrière nginx +
 *  Cloudflare Tunnel : `uniquelocal` (le réseau Docker). Un nombre est accepté (nombre de sauts). */
export function trustProxySetting(env: Env = process.env): string | number | undefined {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return undefined;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/** SMTP : exiger STARTTLS (sinon nodemailer envoie en clair si le serveur ne le propose pas). Par défaut
 *  activé en production, désactivé ailleurs (Mailpit ne parle pas TLS). */
export function mailRequireTls(env: Env = process.env): boolean {
  if (env.MAIL_REQUIRE_TLS !== undefined && env.MAIL_REQUIRE_TLS !== '') {
    return env.MAIL_REQUIRE_TLS === 'true';
  }
  return env.NODE_ENV === 'production';
}

/** Problèmes de configuration bloquants en production (liste vide = OK, ou hors production). */
export function productionEnvProblems(env: Env = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];

  const secret = env.SESSION_SECRET ?? '';
  if (secret.length < MIN_SESSION_SECRET_LENGTH || secret === DEV_SESSION_SECRET) {
    problems.push(
      `SESSION_SECRET doit faire au moins ${MIN_SESSION_SECRET_LENGTH} caractères et ne pas être la valeur de .env.dev`,
    );
  }

  const adminPassword = env.ADMIN_PASSWORD;
  if (
    adminPassword !== undefined &&
    adminPassword !== '' &&
    (adminPassword === DEV_ADMIN_PASSWORD || adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH)
  ) {
    problems.push(
      `ADMIN_PASSWORD doit faire au moins ${MIN_ADMIN_PASSWORD_LENGTH} caractères et ne pas être la valeur de .env.dev`,
    );
  }

  if (
    env.POSTGRES_PASSWORD === DEV_POSTGRES_PASSWORD ||
    (env.DATABASE_URL ?? '').includes(`:${DEV_POSTGRES_PASSWORD}@`)
  ) {
    problems.push('Le mot de passe PostgreSQL ne doit pas être la valeur de .env.dev');
  }

  if (!env.WEB_ORIGIN) {
    problems.push('WEB_ORIGIN est requis (origine publique du site, ex. https://exemple.fr)');
  } else {
    for (const origin of webOrigins(env)) {
      if (!origin.startsWith('https://')) {
        problems.push(`WEB_ORIGIN ne doit contenir que des origines https:// (reçu : ${origin})`);
      }
    }
  }
  return problems;
}

/** Refuse de démarrer une production mal configurée — échouer au boot plutôt que tourner ouvert. */
export function assertProductionEnv(env: Env = process.env): void {
  const problems = productionEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Configuration de production refusée :\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}
