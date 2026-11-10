import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import helmet from 'helmet';
import { randomBytes, randomUUID } from 'node:crypto';
import passport from 'passport';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { enforceSessionLifetime } from '../../src/auth/session-lifetime.middleware';
import { originCheck } from '../../src/common/middleware/origin-check.middleware';
import { sessionSecret, webOrigins } from '../../src/config/env';
import { EmailService } from '../../src/email/email.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Banc d'essai commun des tests de caractérisation (Story 37.1).
 *
 * Point d'entrée unique, volontairement indépendant des formes Prisma que l'épic 37 remanie
 * (`mjId` → `ownerId`, `Scenario`, `Seance.dateValidee`, `Partie.reminderSentAt` devenu
 * `Seance.reminderSentAt`) : les données sont créées par les routes HTTP, seules les tables `User`
 * et `Membership` (non remaniées) sont écrites en direct, et le nettoyage supprime par identifiant ce que le banc a lui-même créé.
 *
 * La base locale est la base de dev : chaque exécution tire un suffixe aléatoire et efface tout
 * ce qu'elle a créé dans `close()`.
 */

/** Espion d'e-mails : aucun envoi réseau, chaque appel est consigné pour les assertions. */
export class FakeEmailService {
  calls: { template: string; to: string; data: Record<string, unknown> }[] = [];

  sendMail(template: string, to: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
    this.calls.push({ template, to, data });
    return Promise.resolve({ ok: true });
  }
}

export type Agent = ReturnType<typeof request.agent>;

export interface TestUser {
  id: string;
  email: string;
  pseudo: string;
  displayName: string;
  /** Agent supertest déjà connecté (cookie de session conservé entre les requêtes). */
  agent: Agent;
}

/** Lecture typée du corps d'une réponse (évite les `any` implicites de supertest). */
export function body<T>(res: Response): T {
  return res.body as T;
}

/** Clés triées d'un objet JSON — la forme d'un DTO, sans ses valeurs. */
export function keysOf(value: unknown): string[] {
  return Object.keys(value as Record<string, unknown>).sort();
}

/** Date `YYYY-MM-DD` (UTC) décalée de `days` jours par rapport à aujourd'hui. */
export function isoDay(days: number): string {
  const now = new Date();
  const ms =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + days * 86_400_000;
  return new Date(ms).toISOString().substring(0, 10);
}

export class Harness {
  readonly suffix = randomUUID().slice(0, 8);
  /** Mot de passe de test généré pour cette exécution, jamais réutilisé ailleurs. */
  private readonly password = randomBytes(12).toString('hex');

  /** Mot de passe de tous les comptes de cette exécution (Story 43.2 : `DELETE /me` l'exige). */
  get userPassword(): string {
    return this.password;
  }
  private readonly userIds: string[] = [];
  private readonly partieIds: string[] = [];
  private userCounter = 0;

  private constructor(
    readonly app: INestApplication<App>,
    readonly prisma: PrismaService,
    readonly email: FakeEmailService,
    private readonly sessionStore: { close(): unknown },
  ) {}

  /**
   * Démarre le vrai `AppModule` avec les middlewares de `main.ts` (helmet, session Postgres,
   * passport, `ValidationPipe` global) — `createNestApplication()` seul ne les pose pas.
   */
  static async start(): Promise<Harness> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Limitation de débit neutralisée pour les tests seulement : une suite enchaîne bien plus de
      // 5 connexions par minute sur `/auth/login`. La configuration réelle n'est pas modifiée.
      .overrideProvider(getOptionsToken())
      .useValue({ throttlers: [{ ttl: 60_000, limit: 300 }], skipIf: () => true })
      .overrideProvider(EmailService)
      .useClass(FakeEmailService)
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });

    // Même chaîne de middlewares que main.ts (à garder alignée si main.ts évolue).
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    const PgSession = connectPgSimple(session);
    const sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
    });
    app.use(
      session({
        store: sessionStore,
        secret: sessionSecret(),
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
      }),
    );
    app.use(enforceSessionLifetime());
    app.use(passport.initialize());
    app.use(passport.session());
    app.enableCors({ origin: webOrigins(), credentials: true });
    app.use(originCheck(webOrigins()));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    // Une écoute unique, sur un port éphémère de la boucle locale (`app.close()` la referme). Sans elle,
    // supertest ouvre puis REFERME un port à chaque requête : des requêtes parallèles (`Promise.all` de
    // `createUser`) se marchaient dessus — la première à finir fermait le port pendant qu'une autre s'y
    // connectait (`connect ECONNRESET` intermittent en CI, Story 43.2).
    await app.listen(0, '127.0.0.1');

    // Les tâches planifiées (rappel horaire) ne doivent pas tourner en parallèle des tests : le
    // rappel est déclenché explicitement par la suite qui le caractérise.
    const scheduler = app.get(SchedulerRegistry);
    for (const job of scheduler.getCronJobs().values()) {
      void job.stop();
    }

    return new Harness(app, app.get(PrismaService), app.get(EmailService), sessionStore);
  }

  /** Crée un utilisateur (hash argon2) et renvoie un agent supertest connecté. */
  async createUser(label: string): Promise<TestUser> {
    this.userCounter += 1;
    const handle = `c37-${label}-${this.userCounter}-${this.suffix}`;
    // En minuscules, comme l'application stocke toute adresse (`normalizeEmail`) : écrite telle quelle
    // en base, une étiquette en majuscules (`DECLINED`) rendait la connexion impossible (401).
    const email = `${handle}@test.local`.toLowerCase();
    const user = await this.prisma.user.create({
      data: {
        email,
        pseudo: handle,
        displayName: `Caractérisation ${label} ${this.suffix}`,
        passwordHash: await argon2.hash(this.password),
      },
    });
    this.userIds.push(user.id);

    const agent = request.agent(this.app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ identifier: email, password: this.password })
      .expect(201);
    return {
      id: user.id,
      email,
      pseudo: user.pseudo,
      displayName: user.displayName,
      agent,
    };
  }

  /** Ajoute un joueur à une partie (table `Membership`, non remaniée par l'épic). */
  async addMember(
    partieId: string,
    user: TestUser,
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
  ): Promise<void> {
    await this.prisma.membership.create({ data: { userId: user.id, partieId, role } });
  }

  /** Crée une partie par `POST /parties` et l'enregistre pour le nettoyage. */
  async createPartie(
    owner: TestUser,
    kind: 'ONE_SHOT' | 'CAMPAGNE_LINEAIRE' | 'CAMPAGNE_EPISODIQUE',
    label: string = kind,
    gameSystemId: string = 'ryuutama',
  ): Promise<{ res: Response; id: string; name: string }> {
    const name = `C37 ${label} ${this.suffix}`;
    const res = await owner.agent.post('/parties').send({ name, kind, gameSystemId });
    const id = (res.body as { id?: string }).id;
    if (id) this.partieIds.push(id);
    return { res, id: id ?? '', name };
  }

  /** Efface tout ce que l'exécution a créé, puis arrête l'application. */
  async close(): Promise<void> {
    try {
      // Parties d'abord (cascade : scénarios, séances, votes, inscriptions…) : ne jamais compter
      // sur la cascade depuis l'utilisateur, que l'épic rend `SetNull` sur le propriétaire.
      if (this.partieIds.length > 0) {
        await this.prisma.partie.deleteMany({ where: { id: { in: this.partieIds } } });
      }
      if (this.userIds.length > 0) {
        // Sessions express (table `session`, sans clé étrangère) retrouvées par l'index inverse.
        const sessions = await this.prisma.userSession.findMany({
          where: { userId: { in: this.userIds } },
          select: { sid: true },
        });
        if (sessions.length > 0) {
          await this.prisma.session.deleteMany({
            where: { sid: { in: sessions.map((s) => s.sid) } },
          });
        }
        await this.prisma.user.deleteMany({ where: { id: { in: this.userIds } } });
      }
    } finally {
      // PrismaService ne ferme pas son pool à `app.close()` : sans ceci Jest ne sort pas proprement.
      await this.prisma.$disconnect();
      await this.app.close();
      // Le magasin de sessions ouvre son propre pool pg : le fermer aussi.
      await this.sessionStore.close();
    }
  }
}
