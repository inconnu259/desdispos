import {
  assertProductionEnv,
  mailRequireTls,
  productionEnvProblems,
  publicWebOrigin,
  sessionSecret,
  trustProxySetting,
  webOrigins,
} from './env';

const PROD_OK = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'x'.repeat(48),
  ADMIN_PASSWORD: 'un-mot-de-passe-solide',
  POSTGRES_PASSWORD: 'pg-solide',
  DATABASE_URL: 'postgresql://jdr:pg-solide@db:5432/jdr',
  WEB_ORIGIN: 'https://desdispos.example',
};

describe('webOrigins / publicWebOrigin', () => {
  it('découpe la liste, retire les espaces et la barre finale', () => {
    const env = { WEB_ORIGIN: ' http://localhost:4200/ , http://192.168.1.10:4200 ,' };
    expect(webOrigins(env)).toEqual(['http://localhost:4200', 'http://192.168.1.10:4200']);
    // Les liens des e-mails n'utilisent que la première origine (la liste brute les cassait).
    expect(publicWebOrigin(env)).toBe('http://localhost:4200');
  });

  it('retombe sur localhost:4200 sans WEB_ORIGIN', () => {
    expect(publicWebOrigin({})).toBe('http://localhost:4200');
  });
});

describe('sessionSecret', () => {
  it("lève une erreur au lieu d'un repli codé en dur", () => {
    expect(() => sessionSecret({})).toThrow(/SESSION_SECRET/);
    expect(sessionSecret({ SESSION_SECRET: 's' })).toBe('s');
  });
});

describe('trustProxySetting', () => {
  it('absent → pas de proxy de confiance ; nombre → nombre de sauts ; sinon texte', () => {
    expect(trustProxySetting({})).toBeUndefined();
    expect(trustProxySetting({ TRUST_PROXY: '1' })).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY: 'uniquelocal' })).toBe('uniquelocal');
  });
});

describe('mailRequireTls', () => {
  it('par défaut : exigé en production seulement ; la variable explicite prime', () => {
    expect(mailRequireTls({ NODE_ENV: 'production' })).toBe(true);
    expect(mailRequireTls({})).toBe(false);
    expect(mailRequireTls({ NODE_ENV: 'production', MAIL_REQUIRE_TLS: 'false' })).toBe(false);
    expect(mailRequireTls({ MAIL_REQUIRE_TLS: 'true' })).toBe(true);
  });
});

describe('productionEnvProblems / assertProductionEnv', () => {
  it('hors production : aucun contrôle', () => {
    expect(productionEnvProblems({ SESSION_SECRET: 'dev-secret-change-me-please' })).toEqual([]);
  });

  it('production correctement configurée : démarre', () => {
    expect(() => assertProductionEnv(PROD_OK)).not.toThrow();
  });

  it.each([
    ['secret de .env.dev', { SESSION_SECRET: 'dev-secret-change-me-please' }, /SESSION_SECRET/],
    ['secret trop court', { SESSION_SECRET: 'court' }, /SESSION_SECRET/],
    ['secret absent', { SESSION_SECRET: undefined }, /SESSION_SECRET/],
    ['admin de .env.dev', { ADMIN_PASSWORD: 'change-me-admin' }, /ADMIN_PASSWORD/],
    ['mot de passe PostgreSQL de .env.dev', { POSTGRES_PASSWORD: 'changeme' }, /PostgreSQL/],
    [
      'DATABASE_URL avec le mot de passe de .env.dev',
      { DATABASE_URL: 'postgresql://jdr:changeme@db:5432/jdr' },
      /PostgreSQL/,
    ],
    ['WEB_ORIGIN absent', { WEB_ORIGIN: undefined }, /WEB_ORIGIN est requis/],
    ['WEB_ORIGIN en http', { WEB_ORIGIN: 'http://192.168.1.10:4200' }, /https/],
  ])('refuse de démarrer : %s', (_label, override, message) => {
    expect(() => assertProductionEnv({ ...PROD_OK, ...override })).toThrow(message);
  });

  it("ADMIN_PASSWORD absent à l'exécution de l'API : accepté (il ne sert qu'au seed)", () => {
    expect(productionEnvProblems({ ...PROD_OK, ADMIN_PASSWORD: undefined })).toEqual([]);
  });
});
