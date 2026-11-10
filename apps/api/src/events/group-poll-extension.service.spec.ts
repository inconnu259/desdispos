import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HOST_ONLY_MESSAGE, type PermissionService } from '../permissions/permission.service';
import type { EventsService } from './events.service';
import { GroupPollExtensionService } from './group-poll-extension.service';

// Story 40.7 — côté `events/` de « prolonger le vote » : le droit d'hôte est décidé par PermissionService
// sur l'événement du sondage, jamais lu ici.

const POLL = { id: 'poll-1', partieId: 'g1' };
const GROUPE = { kind: 'CAMPAGNE_EPISODIQUE' as const };

describe('GroupPollExtensionService (Story 40.7)', () => {
  let permissions: { assert: jest.Mock };
  let events: { eventIdOfPoll: jest.Mock };
  let service: GroupPollExtensionService;

  beforeEach(() => {
    permissions = { assert: jest.fn().mockResolvedValue({}) };
    events = { eventIdOfPoll: jest.fn().mockResolvedValue('e1') };
    service = new GroupPollExtensionService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
    );
  });

  it('le droit est décidé par PermissionService sur l’ÉVÉNEMENT du sondage (POLL_EXTEND)', async () => {
    await expect(service.assertCanExtend(POLL, GROUPE, 'hote')).resolves.toBeUndefined();

    expect(events.eventIdOfPoll).toHaveBeenCalledWith('poll-1', 'g1');
    expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_EXTEND', { eventId: 'e1' });
  });

  it('non-hôte (membre, administrateur) : le refus du service de permission remonte tel quel', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException(HOST_ONLY_MESSAGE));

    await expect(service.assertCanExtend(POLL, GROUPE, 'autre')).rejects.toThrow(HOST_ONLY_MESSAGE);
  });

  it('rencontre isolée (ONE_SHOT, Story 41.2) : mêmes règles — le droit est décidé sur l’événement du sondage', async () => {
    await expect(
      service.assertCanExtend(POLL, { kind: 'ONE_SHOT' }, 'hote'),
    ).resolves.toBeUndefined();

    expect(events.eventIdOfPoll).toHaveBeenCalledWith('poll-1', 'g1');
    expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_EXTEND', { eventId: 'e1' });
  });

  it('sondage rattaché à aucune conjonction de cette partie (ou d’une autre) → 400, aucun droit décidé', async () => {
    events.eventIdOfPoll.mockResolvedValue(null);

    await expect(service.assertCanExtend(POLL, GROUPE, 'hote')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(permissions.assert).not.toHaveBeenCalled();
  });
});
