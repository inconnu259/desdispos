import * as argon2 from 'argon2';

export interface AdminSeedConfig {
  email: string;
  pseudo: string;
  password: string;
}

/**
 * Lit la config admin depuis l'environnement. Pas de mot de passe par défaut : si
 * `ADMIN_PASSWORD` est absent, on échoue franchement plutôt que de seeder un compte avec
 * une valeur publique (cf. commentaire historique du seed).
 */
export function readAdminSeedConfig(env: NodeJS.ProcessEnv): AdminSeedConfig {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD non défini (cf. .env / .env.dev) — définis-le avant de seeder.',
    );
  }
  return {
    email: env.ADMIN_EMAIL ?? 'admin@desdispos.local',
    pseudo: env.ADMIN_PSEUDO ?? 'admin',
    password,
  };
}

export interface AdminUserUpsertClient {
  user: {
    upsert(args: {
      where: { email: string };
      update: Record<string, never>;
      create: {
        email: string;
        pseudo: string;
        passwordHash: string;
        displayName: string;
        role: 'ADMIN';
      };
    }): Promise<unknown>;
  };
}

/**
 * Idempotent : `update: {}` ne touche jamais un admin déjà seedé (ne réinitialise pas son
 * mot de passe à chaque redémarrage du conteneur).
 */
export async function seedAdmin(
  prisma: AdminUserUpsertClient,
  config: AdminSeedConfig,
): Promise<void> {
  const passwordHash = await argon2.hash(config.password);
  await prisma.user.upsert({
    where: { email: config.email },
    update: {},
    create: {
      email: config.email,
      pseudo: config.pseudo,
      passwordHash,
      displayName: config.pseudo,
      role: 'ADMIN',
    },
  });
}
