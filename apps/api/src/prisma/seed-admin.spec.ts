import * as argon2 from 'argon2';
import { readAdminSeedConfig, seedAdmin } from './seed-admin';

jest.mock('argon2');

describe('readAdminSeedConfig', () => {
  it('lève si ADMIN_PASSWORD est absent — jamais de mot de passe par défaut public', () => {
    expect(() => readAdminSeedConfig({})).toThrow('ADMIN_PASSWORD');
  });

  it('utilise email/pseudo par défaut si non renseignés dans l’environnement', () => {
    const config = readAdminSeedConfig({ ADMIN_PASSWORD: 'secret' });
    expect(config).toEqual({
      email: 'admin@desdispos.local',
      pseudo: 'admin',
      password: 'secret',
    });
  });

  it('utilise les valeurs de l’environnement quand elles sont fournies', () => {
    const config = readAdminSeedConfig({
      ADMIN_EMAIL: 'boss@example.com',
      ADMIN_PSEUDO: 'boss',
      ADMIN_PASSWORD: 'secret',
    });
    expect(config).toEqual({
      email: 'boss@example.com',
      pseudo: 'boss',
      password: 'secret',
    });
  });
});

describe('seedAdmin', () => {
  function makePrisma() {
    return { user: { upsert: jest.fn() } };
  }

  beforeEach(() => jest.clearAllMocks());

  it('hash le mot de passe (argon2) avant de le stocker — jamais en clair', async () => {
    (argon2.hash as jest.Mock).mockResolvedValue('HASHED');
    const prisma = makePrisma();

    await seedAdmin(prisma, {
      email: 'a@b.c',
      pseudo: 'admin',
      password: 'plain-text',
    });

    expect(argon2.hash).toHaveBeenCalledWith('plain-text');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'a@b.c' },
      update: {},
      create: {
        email: 'a@b.c',
        pseudo: 'admin',
        passwordHash: 'HASHED',
        displayName: 'admin',
        role: 'ADMIN',
      },
    });
  });

  it('upsert idempotent : `update: {}` ne réinitialise jamais un admin déjà seedé au redémarrage', async () => {
    (argon2.hash as jest.Mock).mockResolvedValue('HASHED');
    const prisma = makePrisma();

    await seedAdmin(prisma, {
      email: 'a@b.c',
      pseudo: 'admin',
      password: 'pw',
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });
});
