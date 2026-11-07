import { DEFAULT_CALENDAR_LAYER_KEYS } from '@master-jdr/shared';
import { toAuthUser, type UserForAuth } from './to-auth-user.util';

function makeUser(overrides: Partial<UserForAuth> = {}): UserForAuth {
  return {
    id: 'u1',
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    passwordHash: 'HASH',
    role: 'USER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    theme: null,
    mustResetPassword: false,
    partiesSort: 'urgence',
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    calendarLayersSetAt: null,
    calendarLayers: [],
    ...overrides,
  };
}

describe('toAuthUser (Story 30.4)', () => {
  it('retire toujours passwordHash', () => {
    const result = toAuthUser(makeUser());
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('convertit createdAt (Date) en chaîne ISO', () => {
    const result = toAuthUser(makeUser());
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ne laisse fuiter aucune colonne interne (mustResetPassword, calendarLayersSetAt) dans la forme AuthUser', () => {
    const result = toAuthUser(
      makeUser({
        mustResetPassword: true,
        calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );
    expect((result as unknown as Record<string, unknown>).mustResetPassword).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).calendarLayersSetAt).toBeUndefined();
  });

  it('accepte un enregistrement dont passwordHash a déjà été retiré (cas AuthService.validateUser())', () => {
    const user = makeUser();
    delete (user as unknown as Record<string, unknown>).passwordHash;
    const result = toAuthUser(user);
    expect(result.id).toBe('u1');
  });

  describe('defaultCalendarLayers (AD-16)', () => {
    it('jamais réglé (calendarLayersSetAt: null) → jeu par défaut, quel que soit le contenu de calendarLayers', () => {
      const result = toAuthUser(makeUser({ calendarLayersSetAt: null, calendarLayers: [] }));
      expect(result.defaultCalendarLayers).toEqual(DEFAULT_CALENDAR_LAYER_KEYS);
    });

    it('réglé explicitement à vide → tableau vide, pas le défaut', () => {
      const result = toAuthUser(
        makeUser({
          calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
          calendarLayers: [],
        }),
      );
      expect(result.defaultCalendarLayers).toEqual([]);
    });

    it('réglé à un sous-ensemble → exactement ce sous-ensemble', () => {
      const result = toAuthUser(
        makeUser({
          calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
          calendarLayers: [
            { id: 'l1', userId: 'u1', layerKey: 'mes-seances' },
            { id: 'l2', userId: 'u1', layerKey: 'votes-en-cours' },
          ],
        }),
      );
      expect(result.defaultCalendarLayers).toEqual(['mes-seances', 'votes-en-cours']);
    });
  });
});
