import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import connectPgSimple from 'connect-pg-simple';
import { AppModule } from './app.module';
import { assertProductionEnv, sessionSecret, trustProxySetting, webOrigins } from './config/env';
import { originCheck } from './common/middleware/origin-check.middleware';
import { enforceSessionLifetime } from './auth/session-lifetime.middleware';

async function bootstrap() {
  // Une production avec les secrets publics de .env.dev (ou sans origine https) ne démarre pas.
  assertProductionEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière nginx + Cloudflare Tunnel, sans `trust proxy`, `req.ip` serait l'adresse du proxy pour
  // TOUS les visiteurs (la limite de 5 connexions/min deviendrait commune à tout le monde : 5 essais
  // ratés d'un inconnu bloqueraient chacun) et `req.secure` serait faux. Prod : `TRUST_PROXY=uniquelocal`
  // — seul le réseau Docker est de confiance, et nginx y écrase X-Forwarded-For par CF-Connecting-IP.
  const trustProxy = trustProxySetting();
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);

  // Les portraits sont servis via GET /characters/:id/portrait (AuthenticatedGuard),
  // jamais en fichiers statiques publics — cf. Character.updatePortrait/getPortraitFile.

  // En-têtes de sécurité. `crossOriginResourcePolicy` par défaut ('same-origin') bloquerait
  // le chargement cross-origin des <img src="…/portrait"> (le front est sur un port différent,
  // cf. WEB_ORIGIN) — l'accès reste contrôlé par CORS + AuthenticatedGuard, pas par ce header.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Session stockée en base (Postgres) → révocable. Le cookie ne contient qu'un id de session.
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false, // la table "session" est gérée par Prisma (modèle Session)
      }),
      secret: sessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true, // inaccessible au JS → pas de vol par XSS
        // Prod : HTTPS only dès que la requête est arrivée en HTTPS (vu via `trust proxy` +
        // X-Forwarded-Proto du tunnel) — le site n'est joignable que par le tunnel, en HTTPS.
        secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
        sameSite: 'lax', // mitige le CSRF
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
      },
    }),
  );
  app.use(enforceSessionLifetime());
  app.use(passport.initialize());
  app.use(passport.session());

  // Valide et nettoie les entrées (rejette les champs non déclarés dans les DTO).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Le front (autre origine en dev) doit pouvoir envoyer le cookie → credentials: true.
  // `WEB_ORIGIN` accepte une LISTE d'origines (dev : `localhost:4200` + l'IP LAN du poste pour tester sur
  // un vrai téléphone). En prod, le front et l'API partagent une seule origine publique (nginx relaie
  // `/api`), que `assertProductionEnv` impose en https.
  const origins = webOrigins();
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  // Après CORS (les pré-requêtes OPTIONS y sont traitées), avant les routes : refuse les requêtes qui
  // modifient venues d'une autre origine (CSRF, login CSRF).
  app.use(originCheck(origins));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
