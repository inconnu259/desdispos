import { DEFAULT_CALENDAR_LAYER_KEYS } from '@desdispos/shared';
import { SessionSerializer } from './session.serializer';
import { UsersService } from '../users/users.service';
import { callArg } from '../common/test-utils/jest-typed';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
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

describe('SessionSerializer (GET /auth/me)', () => {
  let serializer: SessionSerializer;
  let users: { findByIdWithCalendarLayers: jest.Mock };

  beforeEach(() => {
    users = { findByIdWithCalendarLayers: jest.fn() };
    serializer = new SessionSerializer(users as unknown as UsersService);
  });

  it('serializeUser stocke uniquement l’id en session', () => {
    const done = jest.fn();
    serializer.serializeUser({ id: 'u1' }, done);
    expect(done).toHaveBeenCalledWith(null, 'u1');
  });

  it('deserializeUser id inconnu (compte supprimé) → done(null, null)', async () => {
    users.findByIdWithCalendarLayers.mockResolvedValue(null);
    const done = jest.fn();
    await serializer.deserializeUser('gone', done);
    expect(done).toHaveBeenCalledWith(null, null);
  });

  it('AC8 (Story 30.4) : defaultCalendarLayers jamais undefined — compte n’ayant jamais réglé la préférence', async () => {
    users.findByIdWithCalendarLayers.mockResolvedValue(makeUser());
    const done = jest.fn();
    await serializer.deserializeUser('u1', done);
    const user = callArg<{ defaultCalendarLayers: string[]; passwordHash?: string }>(done, 0, 1);
    expect(user.defaultCalendarLayers).toEqual(DEFAULT_CALENDAR_LAYER_KEYS);
    expect(user.passwordHash).toBeUndefined();
  });

  it('AC8 : defaultCalendarLayers reflète le réglage explicite du compte', async () => {
    users.findByIdWithCalendarLayers.mockResolvedValue(
      makeUser({
        calendarLayersSetAt: new Date('2026-02-01T00:00:00.000Z'),
        calendarLayers: [{ id: 'l1', userId: 'u1', layerKey: 'mes-seances' }],
      }),
    );
    const done = jest.fn();
    await serializer.deserializeUser('u1', done);
    const user = callArg<{ defaultCalendarLayers: string[]; passwordHash?: string }>(done, 0, 1);
    expect(user.defaultCalendarLayers).toEqual(['mes-seances']);
  });
});
