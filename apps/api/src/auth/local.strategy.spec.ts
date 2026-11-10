import { UnauthorizedException } from '@nestjs/common';
import { DEFAULT_CALENDAR_LAYER_KEYS } from '@desdispos/shared';
import { LocalStrategy } from './local.strategy';
import { AuthService } from './auth.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
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

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateUser: jest.Mock };

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as unknown as AuthService);
  });

  it('identifiants invalides (validateUser → null) → UnauthorizedException', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('a@b.c', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("compte valide sans mustResetPassword → renvoie l'utilisateur converti en AuthUser (Story 30.4), attaché à req.user", async () => {
    const user = makeUser();
    authService.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('a@b.c', 'good');

    expect(result).toMatchObject({ id: 'u1', email: 'a@b.c' });
    // AC8 : defaultCalendarLayers toujours résolu, jamais undefined.
    expect(result.defaultCalendarLayers).toEqual(DEFAULT_CALENDAR_LAYER_KEYS);
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('Story 28.6 : mustResetPassword: true → connexion refusée avec un message dédié, même mot de passe correct', async () => {
    const user = makeUser({ mustResetPassword: true });
    authService.validateUser.mockResolvedValue(user);

    await expect(strategy.validate('a@b.c', 'good')).rejects.toThrow(
      'Une réinitialisation de mot de passe est requise avant de vous reconnecter.',
    );
  });
});
