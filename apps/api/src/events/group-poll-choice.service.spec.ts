import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import type { EmailService } from '../email/email.service';
import { HOST_ONLY_MESSAGE, type PermissionService } from '../permissions/permission.service';
import type { EventsService } from './events.service';
import { GroupPollChoiceService } from './group-poll-choice.service';

// Story 40.6 — côté `events/` de « fixer la date » : droit d'hôte décidé par PermissionService sur
// l'événement du sondage, e-mail « C'est fixé » aux inscrits confirmés après le commit.

const POLL = { id: 'poll-1', partieId: 'g1' };
const GROUPE = { kind: 'CAMPAGNE_EPISODIQUE' as const };

describe('GroupPollChoiceService (Story 40.6)', () => {
  let permissions: { assert: jest.Mock };
  let events: { eventIdOfPoll: jest.Mock; dateFixedNotice: jest.Mock };
  let email: { sendMail: jest.Mock };
  let service: GroupPollChoiceService;

  beforeEach(() => {
    permissions = { assert: jest.fn().mockResolvedValue({}) };
    events = {
      eventIdOfPoll: jest.fn().mockResolvedValue('e1'),
      dateFixedNotice: jest.fn(),
    };
    email = { sendMail: jest.fn().mockResolvedValue({ ok: true }) };
    service = new GroupPollChoiceService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      email as unknown as EmailService,
    );
  });

  describe('assertCanChoose()', () => {
    it('le droit est décidé par PermissionService sur l’ÉVÉNEMENT du sondage (jamais lu ici)', async () => {
      await expect(service.assertCanChoose(POLL, GROUPE, 'hote')).resolves.toBeUndefined();

      expect(events.eventIdOfPoll).toHaveBeenCalledWith('poll-1', 'g1');
      expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_CHOOSE', { eventId: 'e1' });
    });

    it('non-hôte (membre, administrateur) : le refus du service de permission remonte tel quel', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException(HOST_ONLY_MESSAGE));

      await expect(service.assertCanChoose(POLL, GROUPE, 'autre')).rejects.toThrow(
        HOST_ONLY_MESSAGE,
      );
    });

    it('rencontre isolée (ONE_SHOT, Story 41.2) : mêmes règles — le droit est décidé sur l’événement du sondage', async () => {
      await expect(
        service.assertCanChoose(POLL, { kind: 'ONE_SHOT' }, 'hote'),
      ).resolves.toBeUndefined();

      expect(events.eventIdOfPoll).toHaveBeenCalledWith('poll-1', 'g1');
      expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_CHOOSE', { eventId: 'e1' });
    });

    it('sondage rattaché à aucune conjonction de cette partie → 404, aucun droit décidé', async () => {
      events.eventIdOfPoll.mockResolvedValue(null);

      await expect(service.assertCanChoose(POLL, GROUPE, 'hote')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(permissions.assert).not.toHaveBeenCalled();
    });
  });

  describe('notifyDateFixed()', () => {
    const notice = (recipients: { id: string; email: string }[]) => ({
      partieId: 'g1',
      eventTitle: 'Catane',
      startDate: new Date('2026-11-14T00:00:00.000Z'),
      startSlot: 'EVENING' as const,
      lieu: 'Chez Léa',
      recipients,
    });

    it('un e-mail « conjonction-date-fixee » par inscrit : titre, date, lieu, lien vers la page du groupe', async () => {
      events.dateFixedNotice.mockResolvedValue(
        notice([
          { id: 'a', email: 'a@example.com' },
          { id: 'b', email: 'b@example.com' },
        ]),
      );

      await service.notifyDateFixed(POLL);

      expect(email.sendMail).toHaveBeenCalledTimes(2);
      expect(email.sendMail).toHaveBeenNthCalledWith(1, 'conjonction-date-fixee', 'a@example.com', {
        eventTitle: 'Catane',
        sessionDate: 'samedi 14 novembre (soir)',
        lieu: 'Chez Léa',
        link: expect.stringMatching(/\/parties\/g1$/) as string,
      });
      expect(email.sendMail).toHaveBeenNthCalledWith(
        2,
        'conjonction-date-fixee',
        'b@example.com',
        expect.anything(),
      );
    });

    it('Story 47.2 : une plage de plusieurs créneaux est écrite « du … au … »', async () => {
      events.dateFixedNotice.mockResolvedValue({
        ...notice([{ id: 'a', email: 'a@example.com' }]),
        endDate: new Date('2026-11-15T00:00:00.000Z'),
        endSlot: 'AFTERNOON' as const,
      });

      await service.notifyDateFixed(POLL);

      expect(email.sendMail).toHaveBeenCalledWith(
        'conjonction-date-fixee',
        'a@example.com',
        expect.objectContaining({
          sessionDate: 'du samedi 14 novembre (soir) au dimanche 15 novembre (après-midi)',
        }),
      );
    });

    it('aucun inscrit (ou conjonction introuvable) : aucun e-mail', async () => {
      events.dateFixedNotice.mockResolvedValue(notice([]));
      await service.notifyDateFixed(POLL);
      events.dateFixedNotice.mockResolvedValue(null);
      await service.notifyDateFixed(POLL);

      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('échec d’envoi ou de lecture : journalisé, jamais remonté, les autres destinataires sont servis', async () => {
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      events.dateFixedNotice.mockResolvedValue(
        notice([
          { id: 'a', email: 'a@example.com' },
          { id: 'b', email: 'b@example.com' },
        ]),
      );
      email.sendMail.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });

      await expect(service.notifyDateFixed(POLL)).resolves.toBeUndefined();
      expect(email.sendMail).toHaveBeenCalledTimes(2);

      events.dateFixedNotice.mockRejectedValue(new Error('base indisponible'));
      await expect(service.notifyDateFixed(POLL)).resolves.toBeUndefined();
      expect(logged).toHaveBeenCalled();
      logged.mockRestore();
    });
  });
});
