import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { testGrant } from '../common/test-utils/grant';
import { callArg } from '../common/test-utils/jest-typed';
import type { PermissionService } from '../permissions/permission.service';
import { RALLIEMENT_UNAVAILABLE_MESSAGE } from '../permissions/permission.service';
import type { EmailService } from '../email/email.service';
import {
  GROUP_POLL_OPTION_BOUNDS,
  POLL_DEADLINE_PAST_MESSAGE,
  type PollService,
} from '../poll/poll.service';
import type { CreateEventDto } from './dto/create-event.dto';
import type { InvitationCleanupService } from '../invitations/invitation-cleanup.service';
import type { EventCancellationMailer } from './event-cancellation-mailer.service';
import { POLL_MODE_MESSAGE, type EventSeanceInput, type EventsService } from './events.service';
import {
  GroupEventsService,
  INVALID_DAY_MESSAGE,
  ISOLATED_NO_PLACES_MESSAGE,
  PAST_DAY_MESSAGE,
} from './group-events.service';

/** Clé `YYYY-MM-DD` (UTC) décalée de `days` jours par rapport à aujourd'hui. */
function isoDay(days: number): string {
  const now = new Date();
  const ms =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + days * 86_400_000;
  return new Date(ms).toISOString().substring(0, 10);
}

const GROUPE = { id: 'g1', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };
const CARD = {
  id: 'e1',
  title: 'Catane',
  hostId: 'u1',
  hostDisplayName: 'Léa',
  seance: null,
  participants: [],
  myInscription: null,
  poll: null,
  cancelled: false,
};

// Story 44.1 : la carte servie porte les droits d'organisateur de la personne qui lit (`PermissionService.organizerCan`).
const CAN = { propose: true, edit: true, choose: false, extend: true };
const SERVED = { ...CARD, can: CAN };

describe('GroupEventsService (Story 40.1)', () => {
  let permissions: { assert: jest.Mock; organizerCan: jest.Mock };
  let events: {
    createHosted: jest.Mock;
    updateHosted: jest.Mock;
    isAwaitingDate: jest.Mock;
    assertIsolatedOpen: jest.Mock;
    inscrireConjonction: jest.Mock;
    desinscrireConjonction: jest.Mock;
    accepterReservation: jest.Mock;
    reserverPlace: jest.Mock;
    retirerReservation: jest.Mock;
    reservationNotice: jest.Mock;
    cancelHosted: jest.Mock;
    listCards: jest.Mock;
  };
  let signals: { notifyChanged: jest.Mock };
  let email: { sendMail: jest.Mock };
  let mailer: { send: jest.Mock };
  let cleanup: { revokePendingInTx: jest.Mock };
  let polls: { createInTx: jest.Mock; setOptionsInTx: jest.Mock; closeInTx: jest.Mock };
  let service: GroupEventsService;
  const order: string[] = [];

  const dto = (over: Partial<CreateEventDto> = {}): CreateEventDto => ({
    title: '  Catane  ',
    date: isoDay(3),
    slot: 'EVENING',
    ...over,
  });

  beforeEach(() => {
    order.length = 0;
    permissions = {
      assert: jest.fn().mockResolvedValue(testGrant(GROUPE, 'member')),
      organizerCan: jest
        .fn()
        .mockImplementation((_userId: string, targets: unknown[]) =>
          Promise.resolve(targets.map(() => CAN)),
        ),
    };
    events = {
      createHosted: jest.fn(() => {
        order.push('create');
        return Promise.resolve({ event: { id: 'e1' }, extension: undefined });
      }),
      updateHosted: jest.fn(() => {
        order.push('update');
        return Promise.resolve();
      }),
      isAwaitingDate: jest.fn().mockResolvedValue(false),
      assertIsolatedOpen: jest.fn().mockResolvedValue(undefined),
      inscrireConjonction: jest.fn(() => {
        order.push('inscrire');
        return Promise.resolve();
      }),
      desinscrireConjonction: jest.fn(() => {
        order.push('desinscrire');
        return Promise.resolve();
      }),
      accepterReservation: jest.fn(() => {
        order.push('accepter');
        return Promise.resolve();
      }),
      reserverPlace: jest.fn(() => {
        order.push('reserver');
        return Promise.resolve();
      }),
      retirerReservation: jest.fn(() => {
        order.push('retirer');
        return Promise.resolve();
      }),
      reservationNotice: jest.fn().mockResolvedValue({
        eventTitle: 'Catane',
        hostName: 'Léa',
        startDate: new Date('2026-11-14T00:00:00Z'),
        startSlot: 'EVENING',
        lieu: 'Lyon 3e',
        recipients: [{ id: 'u2', email: 'u2@example.com' }],
      }),
      // Story 42.1 : annulation d'une conjonction.
      cancelHosted: jest.fn(() => {
        order.push('cancel');
        return Promise.resolve({ userIds: [], emails: [] });
      }),
      listCards: jest.fn().mockResolvedValue([CARD]),
    };
    email = {
      sendMail: jest.fn(() => {
        order.push('email');
        return Promise.resolve({ ok: true });
      }),
    };
    signals = {
      notifyChanged: jest.fn(() => {
        order.push('signals');
        return Promise.resolve();
      }),
    };
    polls = {
      createInTx: jest.fn().mockResolvedValue({ id: 'poll-1' }),
      setOptionsInTx: jest.fn().mockResolvedValue(undefined),
      closeInTx: jest.fn().mockResolvedValue(undefined),
    };
    cleanup = {
      revokePendingInTx: jest
        .fn()
        .mockResolvedValue({ userIds: ['i1'], emails: ['i1@example.com'] }),
    };
    mailer = {
      send: jest.fn(() => {
        order.push('cancel-mail');
        return Promise.resolve();
      }),
    };
    service = new GroupEventsService(
      permissions as unknown as PermissionService,
      events as unknown as EventsService,
      signals,
      email as unknown as EmailService,
      polls as unknown as PollService,
      mailer as unknown as EventCancellationMailer,
      cleanup as unknown as InvitationCleanupService,
    );
  });

  describe('cancel() — Story 42.1', () => {
    const grantE1 = () => testGrant(GROUPE, 'member', { eventId: 'e1' });

    it('droit EVENT_CANCEL sur l’événement, annulation, puis signaux, e-mail n° 7 (service partagé) et carte', async () => {
      permissions.assert.mockResolvedValue(grantE1());

      const card = await service.cancel('g1', 'e1', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'EVENT_CANCEL', { eventId: 'e1' });
      expect(events.cancelHosted).toHaveBeenCalledWith(
        expect.objectContaining({ partieId: 'g1' }),
        'e1',
        expect.any(Function),
        // Un groupe ne passe aucun crochet d'invitations (Story 42.2).
        undefined,
      );
      // L'e-mail n° 7 est confié au service partagé (Story 42.3), l'auteur étant l'appelant.
      expect(mailer.send).toHaveBeenCalledWith('g1', 'e1', 'u1', []);
      // Écriture validée, puis signaux de l'accueil, puis e-mail — jamais l'inverse.
      expect(order).toEqual(['cancel', 'signals', 'cancel-mail']);
      expect(card).toEqual(SERVED);
    });

    it('la fermeture du sondage passée à l’écriture appelle PollService.closeInTx', async () => {
      permissions.assert.mockResolvedValue(grantE1());
      await service.cancel('g1', 'e1', 'u1');
      const close = callArg<unknown>(events.cancelHosted, 0, 2) as (
        tx: unknown,
        pollId: string,
      ) => Promise<void>;
      const tx = {};

      await close(tx, 'poll-1');

      expect(polls.closeInTx).toHaveBeenCalledWith(tx, 'poll-1');
    });

    it('événement d’une autre partie que celle de la route → 404, rien d’écrit', async () => {
      permissions.assert.mockResolvedValue(grantE1());

      await expect(service.cancel('autre', 'e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
      expect(events.cancelHosted).not.toHaveBeenCalled();
    });

    describe('rencontre isolée (ONE_SHOT, Story 42.2)', () => {
      const evening = () => testGrant({ ...GROUPE, kind: 'ONE_SHOT' }, 'admin', { eventId: 'e1' });

      it('s’annule aussi : soirée encore ouverte, invitations révoquées dans la transaction, invités prévenus', async () => {
        permissions.assert.mockResolvedValue(evening());
        events.cancelHosted.mockResolvedValue({ userIds: ['i1'], emails: ['i1@example.com'] });

        const card = await service.cancel('g1', 'e1', 'u1');

        expect(events.assertIsolatedOpen).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'g1' }),
        );
        // Le crochet transmis à l'écriture révoque les invitations de la partie, dans la transaction.
        const hook = callArg<(tx: unknown) => Promise<unknown>>(events.cancelHosted, 0, 3);
        const tx = {};
        await hook(tx);
        expect(cleanup.revokePendingInTx).toHaveBeenCalledWith(tx, 'g1');
        // Les adresses des invités sans réponse partent avec l'e-mail n° 7.
        expect(mailer.send).toHaveBeenCalledWith('g1', 'e1', 'u1', ['i1@example.com']);
        expect(card).toEqual(SERVED);
      });

      it('un groupe ne passe aucun crochet : ses invitations ne bougent pas', async () => {
        permissions.assert.mockResolvedValue(grantE1());

        await service.cancel('g1', 'e1', 'u1');

        expect(callArg<unknown>(events.cancelHosted, 0, 3)).toBeUndefined();
        expect(events.assertIsolatedOpen).not.toHaveBeenCalled();
      });

      it('soirée terminée, close ou déjà annulée : refusée (400), rien n’est écrit', async () => {
        permissions.assert.mockResolvedValue(evening());
        events.assertIsolatedOpen.mockRejectedValue(new BadRequestException('figée'));

        await expect(service.cancel('g1', 'e1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
        expect(events.cancelHosted).not.toHaveBeenCalled();
        expect(mailer.send).not.toHaveBeenCalled();
      });
    });

    it('un refus de droit remonte tel quel, rien n’est écrit ni envoyé', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('non'));

      await expect(service.cancel('g1', 'e1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
      expect(events.cancelHosted).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('un refus de l’écriture (déjà annulée, passée) remonte, sans signal ni e-mail', async () => {
      permissions.assert.mockResolvedValue(grantE1());
      events.cancelHosted.mockRejectedValue(new BadRequestException('annulée'));

      await expect(service.cancel('g1', 'e1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(signals.notifyChanged).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('droit EVENT_CREATE sur la partie, hôte = l’appelant, séance datée nettoyée, puis signaux et carte', async () => {
      const card = await service.create(
        'g1',
        'u1',
        dto({ lieu: ' Lyon 3e ', heureRdv: '20:30', notePratique: '   ', capacity: 8 }),
      );

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'EVENT_CREATE', { partieId: 'g1' });
      const [, hostId, input] = events.createHosted.mock.calls[0] as [unknown, string, unknown];
      expect(hostId).toBe('u1');
      const day = isoDay(3);
      expect(input).toEqual({
        title: 'Catane',
        seance: {
          date: new Date(`${day}T00:00:00.000Z`),
          slot: 'EVENING',
          lieu: 'Lyon 3e',
          heureRdv: '20:30',
          notePratique: null,
          capacity: 8,
        },
      });
      // Signaux de la liste d'accueil APRÈS l'écriture validée.
      expect(order).toEqual(['create', 'signals']);
      expect(signals.notifyChanged).toHaveBeenCalledWith('g1');
      expect(callArg<string[]>(events.listCards, 0, 2)).toEqual(['e1']);
      // La carte est celle de l'hôte (qui voit les places réservées en attente).
      expect(callArg<string>(events.listCards, 0, 1)).toBe('u1');
      expect(card).toEqual(SERVED);
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('places réservées à la création (Story 40.4) : transmises à l’écriture, puis UN e-mail par membre, après le commit', async () => {
      events.reservationNotice.mockResolvedValue({
        eventTitle: 'Catane',
        hostName: 'Léa',
        startDate: new Date('2026-11-14T00:00:00Z'),
        startSlot: 'EVENING',
        lieu: 'Lyon 3e',
        recipients: [
          { id: 'u2', email: 'u2@example.com' },
          { id: 'u3', email: 'u3@example.com' },
        ],
      });

      await service.create('g1', 'u1', dto({ capacity: 4, reservedUserIds: ['u2', 'u3'] }));

      const [, , input] = events.createHosted.mock.calls[0] as [
        unknown,
        unknown,
        { seance: { reservedUserIds?: string[] } },
      ];
      expect(input.seance.reservedUserIds).toEqual(['u2', 'u3']);
      expect(order).toEqual(['create', 'signals', 'email', 'email']);
      expect(events.reservationNotice).toHaveBeenCalledWith('e1', ['u2', 'u3']);
      expect(email.sendMail).toHaveBeenCalledTimes(2);
      expect(email.sendMail).toHaveBeenCalledWith(
        'conjonction-reservation',
        'u2@example.com',
        expect.objectContaining({
          hostName: 'Léa',
          eventTitle: 'Catane',
          lieu: 'Lyon 3e',
          link: expect.stringContaining('/parties/g1') as string,
        }),
      );
    });

    it('un échec d’e-mail (envoi refusé ou lecture en erreur) est journalisé et ne remonte jamais', async () => {
      email.sendMail.mockResolvedValue({ ok: false });
      await expect(
        service.create('g1', 'u1', dto({ capacity: 4, reservedUserIds: ['u2'] })),
      ).resolves.toEqual(SERVED);

      events.reservationNotice.mockRejectedValue(new Error('base indisponible'));
      await expect(
        service.create('g1', 'u1', dto({ capacity: 4, reservedUserIds: ['u2'] })),
      ).resolves.toEqual(SERVED);
    });

    it('capacité absente = « tous les membres » (null)', async () => {
      await service.create('g1', 'u1', dto());

      const [, , input] = events.createHosted.mock.calls[0] as [
        unknown,
        unknown,
        { seance: { capacity: number | null } },
      ];
      expect(input.seance.capacity).toBeNull();
    });

    it('aujourd’hui est accepté', async () => {
      await service.create('g1', 'u1', dto({ date: isoDay(0) }));
      expect(events.createHosted).toHaveBeenCalledTimes(1);
    });

    it('un jour passé est refusé (400), rien n’est écrit', async () => {
      const refusal = service.create('g1', 'u1', dto({ date: isoDay(-1) }));
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(PAST_DAY_MESSAGE);
      expect(events.createHosted).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });

    it('une date inexistante est refusée (400)', async () => {
      await expect(service.create('g1', 'u1', dto({ date: '2031-02-31' }))).rejects.toThrow(
        INVALID_DAY_MESSAGE,
      );
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('rencontre isolée (ONE_SHOT) : 403 « indisponible », rien n’est écrit', async () => {
      permissions.assert.mockResolvedValue(testGrant({ ...GROUPE, kind: 'ONE_SHOT' }, 'admin'));

      const refusal = service.create('g1', 'u1', dto());
      await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
      await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('un refus de droit remonte tel quel, rien n’est écrit', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('refus'));

      await expect(service.create('g1', 'u1', dto())).rejects.toThrow('refus');
      expect(events.createHosted).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });
  });

  describe('create() — sondage de dates (Story 40.5)', () => {
    const pollDto = (over: Partial<CreateEventDto> = {}): CreateEventDto => ({
      title: 'Catane',
      pollOptions: [
        { date: isoDay(3), slot: 'EVENING' },
        { date: isoDay(4), slot: 'MORNING' },
      ],
      pollDeadline: isoDay(2),
      ...over,
    });
    const seanceOf = (): EventSeanceInput =>
      (events.createHosted.mock.calls[0] as [unknown, unknown, { seance: EventSeanceInput }])[2]
        .seance;

    it('séance sans date, sondage écrit par PollService (échéance = fin du jour, bornes de groupe), puis signaux', async () => {
      const card = await service.create('g1', 'u1', pollDto({ capacity: 4 }));

      const seance = seanceOf();
      expect(seance.date).toBeNull();
      expect(seance.slot).toBeNull();
      expect(seance.capacity).toBe(4);
      const tx = { tx: true } as never;
      await expect(seance.createPoll?.(tx)).resolves.toEqual({ id: 'poll-1' });
      expect(polls.createInTx).toHaveBeenCalledWith(tx, 'g1', 'u1', {
        options: [
          { date: new Date(`${isoDay(3)}T00:00:00.000Z`), slot: 'EVENING' },
          { date: new Date(`${isoDay(4)}T00:00:00.000Z`), slot: 'MORNING' },
        ],
        expiresAt: new Date(`${isoDay(2)}T23:59:59.999Z`),
        bounds: GROUP_POLL_OPTION_BOUNDS,
      });
      expect(order).toEqual(['create', 'signals']);
      expect(card).toEqual(SERVED);
    });

    it('l’échéance d’aujourd’hui est acceptée', async () => {
      await service.create('g1', 'u1', pollDto({ pollDeadline: isoDay(0) }));
      expect(events.createHosted).toHaveBeenCalledTimes(1);
    });

    it('échéance passée → 400, rien n’est écrit', async () => {
      const refusal = service.create('g1', 'u1', pollDto({ pollDeadline: isoDay(-1) }));
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(POLL_DEADLINE_PAST_MESSAGE);
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('échéance ou créneau inexistant → 400', async () => {
      await expect(
        service.create('g1', 'u1', pollDto({ pollDeadline: '2031-02-31' })),
      ).rejects.toThrow(INVALID_DAY_MESSAGE);
      await expect(
        service.create(
          'g1',
          'u1',
          pollDto({ pollOptions: [{ date: '2031-02-31', slot: 'EVENING' }] }),
        ),
      ).rejects.toThrow(INVALID_DAY_MESSAGE);
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('un jour de créneau passé est refusé à la création (400, message du jour passé), aujourd’hui est accepté', async () => {
      const refusal = service.create(
        'g1',
        'u1',
        pollDto({
          pollOptions: [
            { date: isoDay(-1), slot: 'EVENING' },
            { date: isoDay(3), slot: 'MORNING' },
          ],
        }),
      );
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(PAST_DAY_MESSAGE);
      expect(events.createHosted).not.toHaveBeenCalled();

      await service.create(
        'g1',
        'u1',
        pollDto({
          pollOptions: [
            { date: isoDay(0), slot: 'EVENING' },
            { date: isoDay(3), slot: 'MORNING' },
          ],
        }),
      );
      expect(events.createHosted).toHaveBeenCalledTimes(1);
    });

    it('un champ de sondage à null vaut absent : jamais une erreur 500, un 400 français', async () => {
      const nul = (over: Record<string, unknown>) => ({ ...pollDto(), ...over });
      // Une seule moitié du sondage (l'autre null) : 400 « créneaux et une échéance ».
      for (const sent of [nul({ pollOptions: null }), nul({ pollDeadline: null })]) {
        const refusal = service.create('g1', 'u1', sent);
        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow('créneaux et une échéance');
      }
      // Les deux à null, sans date : aucun mode.
      await expect(
        service.create('g1', 'u1', nul({ pollOptions: null, pollDeadline: null })),
      ).rejects.toThrow(POLL_MODE_MESSAGE);
      // Une date fixée avec un sondage à null reste une date fixée.
      await service.create(
        'g1',
        'u1',
        nul({ pollOptions: null, pollDeadline: null, date: isoDay(3), slot: 'EVENING' }),
      );
      expect(events.createHosted).toHaveBeenCalledTimes(1);
    });

    it('les deux modes à la fois, ou aucun → 400 français, rien n’est écrit', async () => {
      const both = service.create('g1', 'u1', pollDto({ date: isoDay(3), slot: 'EVENING' }));
      await expect(both).rejects.toBeInstanceOf(BadRequestException);
      await expect(both).rejects.toThrow(POLL_MODE_MESSAGE);
      await expect(service.create('g1', 'u1', { title: 'Catane' })).rejects.toThrow(
        POLL_MODE_MESSAGE,
      );
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('sondage sans échéance ou sans créneaux → 400', async () => {
      await expect(
        service.create('g1', 'u1', pollDto({ pollDeadline: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create('g1', 'u1', pollDto({ pollOptions: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('rencontre isolée (ONE_SHOT) : 403, rien n’est écrit', async () => {
      permissions.assert.mockResolvedValue(testGrant({ ...GROUPE, kind: 'ONE_SHOT' }, 'admin'));
      await expect(service.create('g1', 'u1', pollDto())).rejects.toThrow(
        RALLIEMENT_UNAVAILABLE_MESSAGE,
      );
      expect(events.createHosted).not.toHaveBeenCalled();
    });

    it('modification : la séance reste sans date, créneaux et échéance vont à PollService (échéance passée laissée à son contrôle)', async () => {
      await service.update('g1', 'e1', 'u1', pollDto({ pollDeadline: isoDay(-1) }));

      const [, , input] = events.updateHosted.mock.calls[0] as [
        unknown,
        unknown,
        { seance: EventSeanceInput },
      ];
      expect(input.seance.date).toBeNull();
      const tx = { tx: true } as never;
      await input.seance.updatePoll?.(tx, 'poll-1', { purge: true });
      // Story 47.4 : la purge décidée par l'écriture de la durée est transmise telle quelle.
      expect(polls.setOptionsInTx).toHaveBeenCalledWith(
        tx,
        'poll-1',
        expect.objectContaining({
          expiresAt: new Date(`${isoDay(-1)}T23:59:59.999Z`),
          bounds: GROUP_POLL_OPTION_BOUNDS,
        }),
        { purge: true },
      );
    });
  });

  describe('update() — Story 40.2', () => {
    it('droit EVENT_UPDATE sur l’événement (jamais sur la partie), séance nettoyée, puis signaux et carte', async () => {
      const card = await service.update(
        'g1',
        'e1',
        'u1',
        dto({ lieu: ' Lyon 3e ', heureRdv: '19:00', notePratique: '  ', capacity: null }),
      );

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'EVENT_UPDATE', { eventId: 'e1' });
      const [, eventId, input] = events.updateHosted.mock.calls[0] as [unknown, string, unknown];
      expect(eventId).toBe('e1');
      expect(input).toEqual({
        title: 'Catane',
        seance: {
          date: new Date(`${isoDay(3)}T00:00:00.000Z`),
          slot: 'EVENING',
          lieu: 'Lyon 3e',
          heureRdv: '19:00',
          notePratique: null,
          capacity: null,
        },
      });
      expect(order).toEqual(['update', 'signals']);
      expect(signals.notifyChanged).toHaveBeenCalledWith('g1');
      expect(callArg<string[]>(events.listCards, 0, 2)).toEqual(['e1']);
      expect(card).toEqual(SERVED);
    });

    it('les places réservées d’une modification sont ignorées (réservation tardive = route dédiée)', async () => {
      await service.update('g1', 'e1', 'u1', dto({ capacity: 4, reservedUserIds: ['u2'] }));

      const [, , input] = events.updateHosted.mock.calls[0] as [
        unknown,
        unknown,
        { seance: { reservedUserIds?: string[] } },
      ];
      expect(input.seance.reservedUserIds).toBeUndefined();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('événement d’une autre partie que celle de la route → 404, rien n’est écrit', async () => {
      permissions.assert.mockResolvedValue(testGrant({ ...GROUPE, id: 'g2' }, 'member'));

      await expect(service.update('g1', 'e1', 'u1', dto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(events.updateHosted).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });

    describe('rencontre isolée (ONE_SHOT, Story 41.2)', () => {
      beforeEach(() => {
        permissions.assert.mockResolvedValue(testGrant({ ...GROUPE, kind: 'ONE_SHOT' }, 'admin'));
      });

      it('l’hôte complète l’événement unique : mise à jour, signaux, carte à jour, capacité vide', async () => {
        const card = await service.update('g1', 'e1', 'u1', dto());

        expect(events.updateHosted).toHaveBeenCalledTimes(1);
        const [, , input] = events.updateHosted.mock.calls[0] as [
          unknown,
          unknown,
          { seance: EventSeanceInput },
        ];
        expect(input.seance.capacity).toBeNull();
        expect(order).toEqual(['update', 'signals']);
        expect(card).toEqual(SERVED);
      });

      it('places limitées ou places réservées → 400, rien n’est écrit', async () => {
        await expect(service.update('g1', 'e1', 'u1', dto({ capacity: 4 }))).rejects.toThrow(
          ISOLATED_NO_PLACES_MESSAGE,
        );
        await expect(
          service.update(
            'g1',
            'e1',
            'u1',
            dto({ reservedUserIds: ['11111111-1111-4111-8111-111111111111'] }),
          ),
        ).rejects.toThrow(ISOLATED_NO_PLACES_MESSAGE);
        expect(events.updateHosted).not.toHaveBeenCalled();
      });

      it('en attente de date : un créneau ou une échéance passés sont refusés comme à la création', async () => {
        events.isAwaitingDate.mockResolvedValue(true);
        const poll = (over: Partial<CreateEventDto>) =>
          dto({
            date: undefined,
            slot: undefined,
            pollOptions: [
              { date: isoDay(3), slot: 'EVENING' },
              { date: isoDay(4), slot: 'MORNING' },
            ],
            pollDeadline: isoDay(2),
            ...over,
          });

        await expect(
          service.update(
            'g1',
            'e1',
            'u1',
            poll({
              pollOptions: [
                { date: isoDay(-1), slot: 'EVENING' },
                { date: isoDay(4), slot: 'MORNING' },
              ],
            }),
          ),
        ).rejects.toThrow(PAST_DAY_MESSAGE);
        await expect(
          service.update('g1', 'e1', 'u1', poll({ pollDeadline: isoDay(-1) })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(events.updateHosted).not.toHaveBeenCalled();

        await service.update('g1', 'e1', 'u1', poll({}));
        expect(events.updateHosted).toHaveBeenCalledTimes(1);
      });

      it('déjà daté ou à sondage : un créneau conservé devenu passé reste toléré (modification)', async () => {
        events.isAwaitingDate.mockResolvedValue(false);
        await service.update(
          'g1',
          'e1',
          'u1',
          dto({
            date: undefined,
            slot: undefined,
            pollOptions: [
              { date: isoDay(-1), slot: 'EVENING' },
              { date: isoDay(4), slot: 'MORNING' },
            ],
            pollDeadline: isoDay(-1),
          }),
        );
        expect(events.updateHosted).toHaveBeenCalledTimes(1);
      });
    });

    it('nouvelle date passée ou inexistante → 400, rien n’est écrit', async () => {
      await expect(service.update('g1', 'e1', 'u1', dto({ date: isoDay(-1) }))).rejects.toThrow(
        PAST_DAY_MESSAGE,
      );
      await expect(service.update('g1', 'e1', 'u1', dto({ date: '2031-02-31' }))).rejects.toThrow(
        INVALID_DAY_MESSAGE,
      );
      expect(events.updateHosted).not.toHaveBeenCalled();
    });

    it('un refus de droit (non-hôte) remonte tel quel, rien n’est écrit ni signalé', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('pas l’hôte'));

      await expect(service.update('g1', 'e1', 'u2', dto())).rejects.toThrow('pas l’hôte');
      expect(events.updateHosted).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });

    it('un refus de l’écriture (passée, capacité) ne signale rien', async () => {
      events.updateHosted.mockRejectedValue(new BadRequestException('trop petit'));

      await expect(service.update('g1', 'e1', 'u1', dto())).rejects.toThrow('trop petit');
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });
  });

  describe('inscrire() / desinscrire() — Story 40.3', () => {
    const grantSeance = (over: Record<string, unknown> = {}) =>
      testGrant({ ...GROUPE, ...over }, 'member', { eventId: 'e1', seanceId: 'se1' });

    it('inscrire : écrit sous le verrou de l’événement avec la séance de l’autorisation, puis signaux et carte', async () => {
      const grant = grantSeance();

      const card = await service.inscrire(grant, 'u2');

      expect(events.inscrireConjonction).toHaveBeenCalledWith(grant, 'se1', 'u2');
      expect(order).toEqual(['inscrire', 'signals']);
      expect(signals.notifyChanged).toHaveBeenCalledWith('g1');
      expect(callArg<string[]>(events.listCards, 0, 2)).toEqual(['e1']);
      expect(card).toEqual(SERVED);
    });

    it('desinscrire : retire puis signale, renvoie la carte', async () => {
      const grant = grantSeance();

      const card = await service.desinscrire(grant, 'u2');

      expect(events.desinscrireConjonction).toHaveBeenCalledWith(grant, 'se1', 'u2');
      expect(order).toEqual(['desinscrire', 'signals']);
      expect(card).toEqual(SERVED);
    });

    it.each(['inscrire', 'desinscrire'] as const)(
      '%s : rencontre isolée (ONE_SHOT) → 403 « indisponible », rien n’est écrit',
      async (method) => {
        const refusal = service[method](grantSeance({ kind: 'ONE_SHOT' }), 'u2');

        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
        expect(events.inscrireConjonction).not.toHaveBeenCalled();
        expect(events.desinscrireConjonction).not.toHaveBeenCalled();
        expect(signals.notifyChanged).not.toHaveBeenCalled();
      },
    );

    it.each(['inscrire', 'desinscrire'] as const)(
      '%s : une autorisation qui ne vise pas de séance → 404, rien n’est écrit',
      async (method) => {
        const grant = testGrant(GROUPE, 'member', { eventId: 'e1' });

        await expect(service[method](grant, 'u2')).rejects.toBeInstanceOf(NotFoundException);
        expect(events.inscrireConjonction).not.toHaveBeenCalled();
      },
    );

    it('un refus de l’écriture (complet, passé) ne signale rien', async () => {
      events.inscrireConjonction.mockRejectedValue(new BadRequestException('complet'));

      await expect(service.inscrire(grantSeance(), 'u2')).rejects.toThrow('complet');
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });
  });

  describe('reserver() / retirerReservation() / accepter() — Story 40.4', () => {
    const grantSeance = (over: Record<string, unknown> = {}) =>
      testGrant({ ...GROUPE, ...over }, 'member', { eventId: 'e1', seanceId: 'se1' });

    it('reserver : écrit, signale, envoie UN e-mail « Répondre » vers la page du groupe, renvoie la carte de l’hôte', async () => {
      const grant = grantSeance();

      const card = await service.reserver(grant, 'u1', 'u2');

      expect(events.reserverPlace).toHaveBeenCalledWith(grant, 'se1', 'u2');
      expect(order).toEqual(['reserver', 'email', 'signals']);
      expect(events.reservationNotice).toHaveBeenCalledWith('e1', ['u2']);
      expect(email.sendMail).toHaveBeenCalledTimes(1);
      expect(email.sendMail).toHaveBeenCalledWith(
        'conjonction-reservation',
        'u2@example.com',
        expect.objectContaining({
          hostName: 'Léa',
          eventTitle: 'Catane',
          sessionDate: 'samedi 14 novembre (soir)',
        }),
      );
      expect(signals.notifyChanged).toHaveBeenCalledWith('g1');
      expect(callArg<string>(events.listCards, 0, 1)).toBe('u1');
      expect(callArg<string[]>(events.listCards, 0, 2)).toEqual(['e1']);
      expect(card).toEqual(SERVED);
    });

    it('reserver : un refus de l’écriture (complet, déjà inscrit…) n’envoie aucun e-mail et ne signale rien', async () => {
      events.reserverPlace.mockRejectedValue(new BadRequestException('complet'));

      await expect(service.reserver(grantSeance(), 'u1', 'u2')).rejects.toThrow('complet');
      expect(events.reservationNotice).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
      expect(signals.notifyChanged).not.toHaveBeenCalled();
    });

    it('reserver : un e-mail en échec n’annule pas la réservation (journalisé, jamais remonté)', async () => {
      email.sendMail.mockResolvedValue({ ok: false });

      await expect(service.reserver(grantSeance(), 'u1', 'u2')).resolves.toEqual(SERVED);
      expect(signals.notifyChanged).toHaveBeenCalledWith('g1');
    });

    it('retirerReservation : retire puis signale, sans e-mail, renvoie la carte de l’hôte', async () => {
      const grant = grantSeance();

      const card = await service.retirerReservation(grant, 'u1', 'u2');

      expect(events.retirerReservation).toHaveBeenCalledWith(grant, 'se1', 'u2');
      expect(order).toEqual(['retirer', 'signals']);
      expect(email.sendMail).not.toHaveBeenCalled();
      expect(callArg<string>(events.listCards, 0, 1)).toBe('u1');
      expect(card).toEqual(SERVED);
    });

    it('accepter : confirme la place de l’appelant puis signale, sans e-mail, renvoie sa carte', async () => {
      const grant = grantSeance();

      const card = await service.accepter(grant, 'u2');

      expect(events.accepterReservation).toHaveBeenCalledWith(grant, 'se1', 'u2');
      expect(order).toEqual(['accepter', 'signals']);
      expect(email.sendMail).not.toHaveBeenCalled();
      expect(callArg<string>(events.listCards, 0, 1)).toBe('u2');
      expect(card).toEqual(SERVED);
    });

    it.each(['reserver', 'retirerReservation', 'accepter'] as const)(
      '%s : rencontre isolée (ONE_SHOT) → 403 « indisponible », rien n’est écrit',
      async (method) => {
        const grant = grantSeance({ kind: 'ONE_SHOT' });
        const refusal =
          method === 'accepter'
            ? service.accepter(grant, 'u2')
            : service[method](grant, 'u1', 'u2');

        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
        expect(events.reserverPlace).not.toHaveBeenCalled();
        expect(events.retirerReservation).not.toHaveBeenCalled();
        expect(events.accepterReservation).not.toHaveBeenCalled();
        expect(email.sendMail).not.toHaveBeenCalled();
      },
    );

    it('une autorisation qui ne vise pas de séance → 404, rien n’est écrit', async () => {
      const grant = testGrant(GROUPE, 'member', { eventId: 'e1' });

      await expect(service.reserver(grant, 'u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
      expect(events.reserverPlace).not.toHaveBeenCalled();
    });
  });

  describe('list()', () => {
    it('droit EVENT_LIST, puis les cartes de la partie de l’autorisation vues par l’appelant', async () => {
      const cards = await service.list('g1', 'u2');

      expect(permissions.assert).toHaveBeenCalledWith('u2', 'EVENT_LIST', { partieId: 'g1' });
      expect(events.listCards).toHaveBeenCalledTimes(1);
      expect(callArg<string>(events.listCards, 0, 1)).toBe('u2');
      expect(cards).toEqual([SERVED]);
      // Story 44.1 : les droits d'organisateur sont ceux de la personne qui lit, calculés en UN lot sur
      // les événements listés — jamais déduits de `hostId`.
      expect(permissions.organizerCan).toHaveBeenCalledTimes(1);
      expect(permissions.organizerCan).toHaveBeenCalledWith('u2', [{ eventId: 'e1' }]);
    });
  });
});
