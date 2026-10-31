import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BoardGamesService } from '../board-games/board-games.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import {
  CANCELLED_EVENT_MESSAGE,
  CANCEL_PAST_MESSAGE,
  EVENING_CANCELLED_MESSAGE,
  DATE_FIXED_MESSAGE,
  EventsService,
  FULL_EVENT_MESSAGE,
  POLL_MODE_MESSAGE,
  VOTE_DATE_SET_MESSAGE,
  VOTE_ENDED_MESSAGE,
  VOTE_NOT_ELIGIBLE_MESSAGE,
  EVENING_FINISHED_MESSAGE,
  PAST_EVENT_MESSAGE,
  PAST_ROSTER_MESSAGE,
  RESERVE_ALREADY_MESSAGE,
  RESERVE_HOST_MESSAGE,
  RESERVE_NOT_LIMITED_MESSAGE,
  RESERVE_NOT_MEMBER_MESSAGE,
  RESERVE_TOO_MANY_MESSAGE,
} from './events.service';
import { testGrant } from '../common/test-utils/grant';
import { callArg, mockCalls, objectLike } from '../common/test-utils/jest-typed';
import { VISIBLE_SEANCE_WHERE } from '../permissions/scenario-visibility';

/** Story 37.6 — autorisation délivrée (simulée) par `PermissionService.assert()` sur `p1`. */
const GRANT_P1 = testGrant({ id: 'p1', ownerId: 'mj1' });

const EVENT = {
  id: 'e1',
  partieId: 'p1',
  title: 'Le Marché aux Ombres',
  description: null,
  ownerId: 'mj1',
  createdAt: new Date('2026-10-10T00:00:00.000Z'),
};

function makePrisma() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ kind: 'CAMPAGNE_LINEAIRE' }]),
    event: {
      create: jest.fn().mockResolvedValue(EVENT),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      update: jest.fn(),
      // Story 42.3 : conjonctions à venir de l'hôte qui sort, et leur annulation en lot.
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    seance: {
      create: jest.fn().mockResolvedValue({ id: 'se1' }),
      findUniqueOrThrow: jest.fn(),
      // Story 40.3 : séance (et hôte de son événement) relue sous le verrou de l'événement.
      findUnique: jest.fn(),
      // Story 47.1 : durée de la séance du vote, lue par `chooseDate`.
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    // Story 37.8 : `chooseDate` lit le vote (sa partie) et recalcule la prochaine séance DANS la
    // transaction fournie.
    sessionPoll: { findUnique: jest.fn().mockResolvedValue({ partieId: 'p1' }) },
    partie: {
      update: jest.fn(),
    },
    inscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // Story 40.8 : inscriptions à venir de qui quitte le groupe.
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Story 40.4 : appartenance des personnes à qui une place est réservée.
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    // Story 49.3 : jeux apportés par une personne qui cesse d'être participante.
    eventGameBring: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    // Story 49.5 : Envies d'une personne qui cesse d'être participante, et celles que ses apports retirés
    // laissent orphelines ; jeux écartés lus pour décider ce qui est encore sur place.
    eventGameEnvy: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    eventGameExcluded: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    tx,
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    // Story 37.6 — appartenance à la partie de l'autorisation (1 = la séance/l'événement en est).
    // Story 40.1 : `listCards` lit les événements de la partie (cartes de conjonctions).
    event: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      // Story 40.4 : de quoi écrire l'e-mail d'une place réservée.
      findUnique: jest.fn(),
      // Story 41.3 : de quoi écrire l'e-mail d'invitation à une soirée.
      findFirst: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    seance: {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      update: jest.fn(),
      // Story 40.5 : séance d'un sondage (vote d'un groupe).
      findUnique: jest.fn(),
      // Story 41.2 : l'événement attend-il sa date ?
      findFirst: jest.fn(),
    },
    // Story 40.5 : sondages des cartes (créneaux + réponses) et disponibilités déclarées des inscrits.
    sessionPoll: { delete: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    availabilityDeclaration: { findMany: jest.fn().mockResolvedValue([]) },
    inscription: { deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    // Story 40.2 : rôle de groupe des participants d'une carte.
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    partie: {
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('EventsService (Story 37.3)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let realtime: { emit: jest.Mock };
  let boardGames: { nameKeysOfOwner: jest.Mock; nameKeysByIds: jest.Mock };
  let service: EventsService;

  beforeEach(() => {
    prisma = makePrisma();
    realtime = { emit: jest.fn() };
    boardGames = {
      nameKeysOfOwner: jest.fn().mockResolvedValue([]),
      nameKeysByIds: jest.fn().mockResolvedValue([]),
    };
    service = new EventsService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeEventsService,
      boardGames as unknown as BoardGamesService,
    );
  });

  describe('create()', () => {
    it('crée l’événement, son extension et sa première séance dans UNE transaction, puis émet', async () => {
      const extend = jest.fn().mockResolvedValue({ id: 'e1', status: 'BROUILLON' });

      const result = await service.create(GRANT_P1, { title: EVENT.title, ownerId: 'mj1' }, extend);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.event.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', title: EVENT.title, description: null, ownerId: 'mj1' },
      });
      expect(extend).toHaveBeenCalledWith(prisma.tx, EVENT);
      expect(prisma.tx.seance.create).toHaveBeenCalledWith({ data: { eventId: 'e1' } });
      expect(result).toEqual({ event: EVENT, extension: { id: 'e1', status: 'BROUILLON' } });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('n’émet rien si la transaction échoue (émission après validation seulement)', async () => {
      const extend = jest.fn().mockRejectedValue(new Error('échec extension'));

      await expect(
        service.create(GRANT_P1, { title: 'X', ownerId: 'mj1' }, extend),
      ).rejects.toThrow('échec extension');
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('ONE_SHOT déjà pourvu d’un événement → 400, aucune écriture', async () => {
      prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'ONE_SHOT' }]);
      prisma.tx.event.findFirst.mockResolvedValue({ id: 'existant' });

      await expect(
        service.create(GRANT_P1, { title: 'Second', ownerId: 'mj1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tx.event.create).not.toHaveBeenCalled();
      expect(prisma.tx.seance.create).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('ONE_SHOT sans événement → création autorisée (le premier, créé avec la partie)', async () => {
      prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'ONE_SHOT' }]);

      await service.create(GRANT_P1, { title: 'Unique', ownerId: 'mj1' });

      expect(prisma.tx.event.findFirst).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
        select: { id: true },
      });
      expect(prisma.tx.event.create).toHaveBeenCalledTimes(1);
    });

    it('partie introuvable sous le verrou → 404', async () => {
      prisma.tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.create(testGrant({ id: 'absente', ownerId: null }), { title: 'X', ownerId: null }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tx.event.create).not.toHaveBeenCalled();
    });
  });

  describe('createHosted() — conjonction à date fixée (Story 40.1)', () => {
    const DAY = new Date('2026-11-14T00:00:00.000Z');
    const SEANCE = {
      date: DAY,
      slot: 'EVENING' as const,
      lieu: 'Lyon 3e',
      heureRdv: '20:30',
      notePratique: 'Apportez un jeu',
      capacity: 8,
    };

    it('écrit l’événement (hôte = propriétaire de l’événement) et sa séance datée dans UNE transaction, recalcule la prochaine date, puis émet', async () => {
      prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);

      await service.createHosted(GRANT_P1, 'hote', { title: 'Catane', seance: SEANCE });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.event.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', title: 'Catane', description: null, ownerId: 'hote' },
      });
      expect(prisma.tx.seance.create).toHaveBeenCalledWith({
        data: {
          eventId: 'e1',
          startDate: DAY,
          startSlot: 'EVENING',
          endDate: DAY,
          endSlot: 'EVENING',
          durationSlots: 1,
          lieu: 'Lyon 3e',
          heureRdv: '20:30',
          notePratique: 'Apportez un jeu',
          inscriptionMax: 8,
        },
      });
      // Verrou de la partie (assertCanAddEvent) puis verrou du recalcul, même transaction.
      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.tx.seance.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.tx.partie.update).toHaveBeenCalledTimes(1);
      expect(prisma.partie.update).not.toHaveBeenCalled();
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('capacité nulle = « tous les membres » : aucune capacité écrite', async () => {
      await service.createHosted(GRANT_P1, 'hote', {
        title: 'X',
        seance: { ...SEANCE, capacity: null, lieu: null, heureRdv: null, notePratique: null },
      });

      expect(prisma.tx.seance.create).toHaveBeenCalledWith({
        data: objectLike({
          inscriptionMax: null,
          lieu: null,
          heureRdv: null,
          notePratique: null,
        }),
      });
    });

    it('n’émet rien si la transaction échoue', async () => {
      prisma.tx.seance.create.mockRejectedValue(new Error('échec séance'));

      await expect(
        service.createHosted(GRANT_P1, 'hote', { title: 'X', seance: SEANCE }),
      ).rejects.toThrow('échec séance');
      expect(realtime.emit).not.toHaveBeenCalled();
    });
  });

  describe('createHosted() — places réservées à la création (Story 40.4)', () => {
    const DAY = new Date('2026-11-14T00:00:00.000Z');
    const SEANCE = {
      date: DAY,
      slot: 'EVENING' as const,
      lieu: null,
      heureRdv: null,
      notePratique: null,
      capacity: 4,
    };
    const members = (...ids: string[]) =>
      prisma.tx.membership.findMany.mockResolvedValue(ids.map((userId) => ({ userId })));
    const create = (seance: Record<string, unknown>) =>
      service.createHosted(GRANT_P1, 'hote', {
        title: 'Catane',
        seance: { ...SEANCE, ...seance },
      });

    it('écrit les lignes RESERVED dans la MÊME transaction que l’événement, puis émet partie: et user: de chaque cible', async () => {
      prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
      members('a', 'b');

      await create({ reservedUserIds: ['a', 'b'] });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const { data } = callArg<{ data: { userId: string; createdAt: Date }[] }>(
        prisma.tx.inscription.createMany,
      );
      expect(data).toEqual([
        { seanceId: 'se1', userId: 'a', status: 'RESERVED', createdAt: expect.any(Date) as Date },
        { seanceId: 'se1', userId: 'b', status: 'RESERVED', createdAt: expect.any(Date) as Date },
      ]);
      // Ordre d'inscription = ordre choisi : un horodatage strictement croissant.
      expect(data[1].createdAt.getTime()).toBeGreaterThan(data[0].createdAt.getTime());
      expect(callArg(prisma.tx.membership.findMany)).toEqual(
        objectLike({ where: { partieId: 'p1', userId: { in: ['a', 'b'] } } }),
      );
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtime.emit).toHaveBeenCalledWith(userTopic('a'));
      expect(realtime.emit).toHaveBeenCalledWith(userTopic('b'));
    });

    it('sans réservation : aucune lecture d’appartenance ni écriture d’inscription', async () => {
      await create({});
      await create({ reservedUserIds: [] });

      expect(prisma.tx.membership.findMany).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.createMany).not.toHaveBeenCalled();
    });

    it.each([
      [
        'places non limitées',
        { capacity: null, reservedUserIds: ['a'] },
        RESERVE_NOT_LIMITED_MESSAGE,
      ],
      ['une personne deux fois', { reservedUserIds: ['a', 'a'] }, 'deux places'],
      ['l’hôte lui-même', { reservedUserIds: ['hote'] }, RESERVE_HOST_MESSAGE],
      [
        'plus de places que capacité − 1',
        { capacity: 3, reservedUserIds: ['a', 'b', 'c'] },
        RESERVE_TOO_MANY_MESSAGE,
      ],
    ])('refus 400 (%s) : rien n’est écrit ni émis', async (_label, seance, message) => {
      members('a', 'b', 'c');

      const refusal = create(seance);

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(message);
      expect(prisma.tx.inscription.createMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('capacité − 1 réservations exactement : acceptée', async () => {
      members('a', 'b', 'c');

      await create({ capacity: 4, reservedUserIds: ['a', 'b', 'c'] });

      expect(prisma.tx.inscription.createMany).toHaveBeenCalledTimes(1);
    });

    it('une personne qui n’est pas membre du groupe → 400, rien n’est émis', async () => {
      members('a');

      const refusal = create({ reservedUserIds: ['a', 'etranger'] });

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(RESERVE_NOT_MEMBER_MESSAGE);
      expect(prisma.tx.inscription.createMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });
  });

  describe('pastHostedCounts() — Compteur d’hôte (Story 50.2)', () => {
    const dayDate = (offset: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    };
    const hosted = (hostId: string | null, start: Date | null, end: Date | null = start) => ({
      ownerId: hostId,
      seances: start === null && end === null ? [] : [{ startDate: start, endDate: end }],
    });

    it('lit les événements de la partie non annulés et avec un hôte, la première séance seulement', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.pastHostedCounts('p1');

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', cancelledAt: null, ownerId: { not: null } },
        select: {
          ownerId: true,
          seances: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
            select: { startDate: true, endDate: true },
          },
        },
      });
    });

    it('ne compte que les plages passées (la règle isSeancePast), par hôte', async () => {
      prisma.event.findMany.mockResolvedValue([
        hosted('lea', dayDate(-3)),
        hosted('lea', dayDate(-9)),
        hosted('tom', dayDate(-1)),
        // Aujourd'hui et à venir : pas encore passées.
        hosted('tom', dayDate(0)),
        hosted('tom', dayDate(5)),
        // Plage commencée hier, finie demain : toujours en cours.
        hosted('tom', dayDate(-1), dayDate(1)),
      ]);

      const counts = await service.pastHostedCounts('p1');

      expect(Object.fromEntries(counts.map((c) => [c.hostId, c.count]))).toEqual({
        lea: 2,
        tom: 1,
      });
    });

    it('un événement sans date, sans séance ou sans hôte n’est attribué à personne', async () => {
      prisma.event.findMany.mockResolvedValue([
        hosted('lea', null, null),
        { ownerId: 'lea', seances: [] },
        hosted(null, dayDate(-4)),
      ]);

      await expect(service.pastHostedCounts('p1')).resolves.toEqual([]);
    });
  });

  describe('listCards() — cartes de conjonctions (Story 40.1)', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      id: 'e1',
      title: 'Catane',
      ownerId: 'hote',
      owner: { displayName: 'Léa' },
      seances: [
        {
          id: 'se1',
          startDate: new Date('2026-11-14T00:00:00.000Z'),
          startSlot: 'EVENING',
          lieu: 'Lyon 3e',
          heureRdv: '20:30',
          notePratique: null,
          inscriptionMax: 8,
          durationSlots: 1,
        },
      ],
      ...over,
    });

    it('projection explicite : hôte, séance unique (date en clé de jour), capacité', async () => {
      prisma.event.findMany.mockResolvedValue([row()]);

      const cards = await service.listCards(GRANT_P1, 'viewer');

      expect(cards).toEqual([
        {
          id: 'e1',
          title: 'Catane',
          hostId: 'hote',
          hostDisplayName: 'Léa',
          seance: {
            id: 'se1',
            date: '2026-11-14',
            slot: 'EVENING',
            lieu: 'Lyon 3e',
            heureRdv: '20:30',
            notePratique: null,
            capacity: 8,
            endDate: '2026-11-14',
            endSlot: 'EVENING',
            durationSlots: 1,
            placesTaken: 1,
          },
          participants: [
            {
              userId: 'hote',
              displayName: 'Léa',
              isHost: true,
              isAdmin: false,
              status: 'CONFIRMED',
            },
          ],
          myInscription: null,
          poll: null,
          cancelled: false,
        },
      ]);
      // Une seule lecture, scopée à la partie de l'autorisation.
      expect(prisma.event.findMany).toHaveBeenCalledTimes(1);
      expect(callArg(prisma.event.findMany)).toEqual(objectLike({ where: { partieId: 'p1' } }));
    });

    it('même jour : tri par créneau (matin < après-midi < soir), pas par ordre de création', async () => {
      const at = (id: string, slot: string) =>
        row({ id, seances: [{ ...row().seances[0], startSlot: slot }] });
      prisma.event.findMany.mockResolvedValue([
        at('soir', 'EVENING'),
        at('matin', 'MORNING'),
        at('aprem', 'AFTERNOON'),
      ]);

      const cards = await service.listCards(GRANT_P1, 'viewer');

      expect(cards.map((c) => c.id)).toEqual(['matin', 'aprem', 'soir']);
    });

    it('hôte disparu → identité nulle ; tri par date, sans date en dernier', async () => {
      prisma.event.findMany.mockResolvedValue([
        row({ id: 'sans-date', seances: [{ ...row().seances[0], startDate: null }] }),
        row({
          id: 'tard',
          ownerId: null,
          owner: null,
          seances: [{ ...row().seances[0], startDate: new Date('2026-12-01T00:00:00Z') }],
        }),
        row({ id: 'tot' }),
      ]);

      const cards = await service.listCards(GRANT_P1, 'viewer');

      expect(cards.map((c) => c.id)).toEqual(['tot', 'tard', 'sans-date']);
      expect(cards[1]).toEqual(objectLike({ hostId: null, hostDisplayName: null }));
    });

    it('participants : hôte d’abord, puis les inscrits par ordre d’inscription ; rôle admin lu en lot (Story 40.2)', async () => {
      prisma.event.findMany.mockResolvedValue([
        row(),
        row({
          id: 'e2',
          ownerId: 'autre',
          owner: { displayName: 'Max' },
          seances: [{ ...row().seances[0], id: 'se2' }],
        }),
      ]);
      prisma.inscription.findMany.mockResolvedValue([
        { seanceId: 'se1', userId: 'ami', status: 'CONFIRMED', user: { displayName: 'Zoé' } },
        // L'hôte inscrit lui-même n'est listé qu'une fois.
        { seanceId: 'se1', userId: 'hote', status: 'CONFIRMED', user: { displayName: 'Léa' } },
        { seanceId: 'se2', userId: 'ami', status: 'CONFIRMED', user: { displayName: 'Zoé' } },
      ]);
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'ami', role: 'ADMIN' },
        { userId: 'hote', role: 'MEMBER' },
      ]);

      const cards = await service.listCards(GRANT_P1, 'viewer');

      const byId = Object.fromEntries(cards.map((c) => [c.id, c.participants]));
      expect(byId.e1).toEqual([
        { userId: 'hote', displayName: 'Léa', isHost: true, isAdmin: false, status: 'CONFIRMED' },
        { userId: 'ami', displayName: 'Zoé', isHost: false, isAdmin: true, status: 'CONFIRMED' },
      ]);
      expect(byId.e2).toEqual([
        { userId: 'autre', displayName: 'Max', isHost: true, isAdmin: false, status: 'CONFIRMED' },
        { userId: 'ami', displayName: 'Zoé', isHost: false, isAdmin: true, status: 'CONFIRMED' },
      ]);
      // L'hôte occupe une place sans ligne : hôte + inscrit (l'hôte inscrit n'est pas recompté).
      expect(cards.find((c) => c.id === 'e1')?.seance?.placesTaken).toBe(2);
      // Une lecture d'inscriptions et UNE d'appartenances pour tous les événements, jamais par carte.
      expect(prisma.inscription.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.membership.findMany).toHaveBeenCalledTimes(1);
      expect(callArg(prisma.membership.findMany)).toEqual(
        objectLike({ where: objectLike({ partieId: 'p1' }) }),
      );
    });

    describe('visibilité des places réservées (Story 40.4)', () => {
      const rows = [
        { seanceId: 'se1', userId: 'ami', status: 'CONFIRMED', user: { displayName: 'Zoé' } },
        { seanceId: 'se1', userId: 'invite', status: 'RESERVED', user: { displayName: 'Sam' } },
      ];

      it('l’hôte voit la place réservée (avec son statut) ; elle compte dans les places prises', async () => {
        prisma.event.findMany.mockResolvedValue([row()]);
        prisma.inscription.findMany.mockResolvedValue(rows);

        const [card] = await service.listCards(GRANT_P1, 'hote');

        expect(card.participants.map((p) => [p.userId, p.status])).toEqual([
          ['hote', 'CONFIRMED'],
          ['ami', 'CONFIRMED'],
          ['invite', 'RESERVED'],
        ]);
        expect(card.seance?.placesTaken).toBe(3);
        expect(card.myInscription).toBeNull();
      });

      it('un autre membre ne voit pas qui tient la place réservée, mais « placesTaken » la compte', async () => {
        prisma.event.findMany.mockResolvedValue([row()]);
        prisma.inscription.findMany.mockResolvedValue(rows);

        const [card] = await service.listCards(GRANT_P1, 'ami');

        expect(card.participants.map((p) => p.userId)).toEqual(['hote', 'ami']);
        expect(JSON.stringify(card)).not.toContain('invite');
        expect(JSON.stringify(card)).not.toContain('Sam');
        expect(card.seance?.placesTaken).toBe(3);
        expect(card.myInscription).toBe('CONFIRMED');
      });

      it('la personne à qui la place est réservée n’est pas listée mais lit sa propre ligne (myInscription)', async () => {
        prisma.event.findMany.mockResolvedValue([row()]);
        prisma.inscription.findMany.mockResolvedValue(rows);

        const [card] = await service.listCards(GRANT_P1, 'invite');

        expect(card.participants.map((p) => p.userId)).toEqual(['hote', 'ami']);
        expect(card.myInscription).toBe('RESERVED');
        expect(card.seance?.placesTaken).toBe(3);
      });

      it('un membre sans ligne : myInscription nul', async () => {
        prisma.event.findMany.mockResolvedValue([row()]);
        prisma.inscription.findMany.mockResolvedValue(rows);

        const [card] = await service.listCards(GRANT_P1, 'etranger');

        expect(card.myInscription).toBeNull();
      });
    });

    it('sans événement : aucune lecture de participants', async () => {
      await service.listCards(GRANT_P1, 'viewer');
      expect(prisma.inscription.findMany).not.toHaveBeenCalled();
      expect(prisma.membership.findMany).not.toHaveBeenCalled();
    });

    it('restreinte à des identifiants donnés (carte d’un événement tout juste créé)', async () => {
      await service.listCards(GRANT_P1, 'viewer', ['e9']);

      expect(callArg(prisma.event.findMany)).toEqual(
        objectLike({ where: { partieId: 'p1', id: { in: ['e9'] } } }),
      );
    });
  });

  describe('updateHosted() — modification par l’hôte (Story 40.2)', () => {
    const NEW_DAY = new Date('2026-12-01T00:00:00.000Z');
    const INPUT = {
      title: 'Catane v2',
      seance: {
        date: NEW_DAY,
        slot: 'AFTERNOON' as const,
        lieu: 'Paris',
        heureRdv: '14:00',
        notePratique: null,
        capacity: 6,
      },
    };
    const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });
    const futureDay = () => new Date(Date.now() + 5 * 86_400_000);

    function existing(over: Record<string, unknown> = {}) {
      prisma.tx.event.findUnique.mockResolvedValue({
        ownerId: 'hote',
        seances: [{ id: 'se1', startDate: futureDay(), startSlot: 'EVENING', durationSlots: 1 }],
        ...over,
      });
    }

    it('verrouille la ligne Event, remplace titre et séance, recalcule la prochaine date, puis émet', async () => {
      existing();
      prisma.tx.inscription.count.mockResolvedValue(2);

      await service.updateHosted(GRANT_E1, 'e1', INPUT);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Ordre des verrous : la Partie d'abord (comme createInTx et leave), puis l'Event, puis le
      // recalcul reprend le verrou de la Partie déjà tenu — jamais l'Event avant la Partie.
      const locks = prisma.tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
      expect(locks).toHaveLength(3);
      expect(locks[0]).toContain('FROM "Partie"');
      expect(locks[1]).toContain('FROM "Event"');
      expect(locks[2]).toContain('FROM "Partie"');
      expect(prisma.tx.$queryRaw.mock.calls[0][1]).toBe('p1');
      expect(prisma.tx.$queryRaw.mock.calls[1][1]).toBe('e1');
      expect(prisma.tx.event.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { title: 'Catane v2' },
      });
      expect(prisma.tx.seance.update).toHaveBeenCalledWith({
        where: { id: 'se1' },
        data: {
          startDate: NEW_DAY,
          startSlot: 'AFTERNOON',
          endDate: NEW_DAY,
          endSlot: 'AFTERNOON',
          durationSlots: 1,
          lieu: 'Paris',
          heureRdv: '14:00',
          notePratique: null,
          inscriptionMax: 6,
          reminderSentAt: null,
        },
      });
      expect(prisma.tx.partie.update).toHaveBeenCalledTimes(1);
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('même jour et même créneau : le rappel de la veille n’est pas ré-armé', async () => {
      const day = futureDay();
      existing({ seances: [{ id: 'se1', startDate: day, startSlot: 'EVENING', durationSlots: 1 }] });

      await service.updateHosted(GRANT_E1, 'e1', {
        ...INPUT,
        seance: { ...INPUT.seance, date: day, slot: 'EVENING' },
      });

      const { data } = callArg<{ data: Record<string, unknown> }>(prisma.tx.seance.update);
      expect('reminderSentAt' in data).toBe(false);
    });

    it('capacité nulle = tous les membres, jamais refusée', async () => {
      existing();
      prisma.tx.inscription.count.mockResolvedValue(9);

      await service.updateHosted(GRANT_E1, 'e1', {
        ...INPUT,
        seance: { ...INPUT.seance, capacity: null },
      });

      expect(prisma.tx.seance.update).toHaveBeenCalledWith({
        where: { id: 'se1' },
        data: objectLike({ inscriptionMax: null }),
      });
    });

    it('capacité inférieure aux participants (hôte + inscrits) → 400, rien n’est écrit ni émis', async () => {
      existing();
      // 3 inscrits + l'hôte = 4 participants.
      prisma.tx.inscription.count.mockResolvedValue(3);

      const refusal = service.updateHosted(GRANT_E1, 'e1', {
        ...INPUT,
        seance: { ...INPUT.seance, capacity: 3 },
      });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(/participants actuels \(4\)/);
      expect(prisma.tx.event.update).not.toHaveBeenCalled();
      expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('le comptage des inscrits vise la séance et EXCLUT l’hôte ; un hôte aussi inscrit n’est compté qu’une fois', async () => {
      existing();
      // La base renvoie 2 inscrits hors hôte (la ligne d'inscription de l'hôte est exclue du
      // comptage) : l'effectif réel est 3 (2 + l'hôte), une capacité de 3 est donc acceptée.
      prisma.tx.inscription.count.mockResolvedValue(2);

      await service.updateHosted(GRANT_E1, 'e1', {
        ...INPUT,
        seance: { ...INPUT.seance, capacity: 3 },
      });

      expect(prisma.tx.inscription.count).toHaveBeenCalledWith({
        where: { seanceId: 'se1', userId: { not: 'hote' } },
      });
      expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
    });

    it('capacité égale aux participants → acceptée', async () => {
      existing();
      prisma.tx.inscription.count.mockResolvedValue(3);

      await service.updateHosted(GRANT_E1, 'e1', {
        ...INPUT,
        seance: { ...INPUT.seance, capacity: 4 },
      });
      expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
    });

    it('conjonction passée (jour strictement avant aujourd’hui) → 400, rien n’est écrit', async () => {
      existing({
        seances: [
          { id: 'se1', startDate: new Date(Date.now() - 2 * 86_400_000), startSlot: 'EVENING', durationSlots: 1 },
        ],
      });

      const refusal = service.updateHosted(GRANT_E1, 'e1', INPUT);
      await expect(refusal).rejects.toThrow(PAST_EVENT_MESSAGE);
      expect(prisma.tx.event.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('une conjonction d’aujourd’hui reste modifiable', async () => {
      existing({ seances: [{ id: 'se1', startDate: new Date(), startSlot: 'EVENING', durationSlots: 1 }] });

      await service.updateHosted(GRANT_E1, 'e1', INPUT);
      expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
    });

    it('événement d’une autre partie que celle de l’autorisation → 404 avant toute transaction', async () => {
      prisma.event.count.mockResolvedValue(0);

      await expect(
        service.updateHosted(testGrant({ id: 'p1', ownerId: 'mj1' }, 'member'), 'e9', INPUT),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('événement sans séance (supprimé entre-temps) → 404, rien n’est écrit', async () => {
      existing({ seances: [] });

      await expect(service.updateHosted(GRANT_E1, 'e1', INPUT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.tx.event.update).not.toHaveBeenCalled();
    });
  });

  describe('durée d’un rendez-vous (Story 47.1)', () => {
    const START = new Date(Date.UTC(2099, 0, 2));
    const NEXT = new Date(Date.UTC(2099, 0, 3));
    const BASE = { lieu: null, heureRdv: null, notePratique: null, capacity: null };
    const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });

    describe('création', () => {
      beforeEach(() => {
        prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
      });

      it('3 créneaux depuis un soir : la plage s’étend au lendemain après-midi', async () => {
        await service.createHosted(GRANT_P1, 'hote', {
          title: 'Week-end',
          seance: { ...BASE, date: START, slot: 'EVENING', durationSlots: 3 },
        });

        expect(prisma.tx.seance.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            startDate: START,
            startSlot: 'EVENING',
            endDate: NEXT,
            endSlot: 'AFTERNOON',
            durationSlots: 3,
          }),
        });
      });

      it('durée absente à la création : 1 créneau, fin = départ', async () => {
        await service.createHosted(GRANT_P1, 'hote', {
          title: 'Soirée',
          seance: { ...BASE, date: START, slot: 'EVENING' },
        });

        expect(prisma.tx.seance.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ endDate: START, endSlot: 'EVENING', durationSlots: 1 }),
        });
      });

      it.each([
        ['46 créneaux', 'EVENING' as const, 46, '15 jours au plus : au-delà, créez deux rendez-vous.'],
        ['0 créneau', 'EVENING' as const, 0, 'La durée doit être un entier d’au moins 1 créneau'],
        ['journée entière sur 2 créneaux', 'FULL_DAY' as const, 2, 'Une journée entière ne dure qu’un créneau'],
      ])('%s → 400 français, rien n’est écrit ni émis', async (_label, slot, durationSlots, message) => {
        await expect(
          service.createHosted(GRANT_P1, 'hote', {
            title: 'Trop long',
            seance: { ...BASE, date: START, slot: slot as 'EVENING', durationSlots },
          }),
        ).rejects.toThrow(message);
        expect(prisma.tx.seance.create).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });
    });

    describe('updateHosted()', () => {
      function existing(seance: Record<string, unknown>) {
        prisma.tx.event.findUnique.mockResolvedValue({
          ownerId: 'hote',
          seances: [{ id: 'se1', pollId: null, ...seance }],
        });
      }
      // Minuit UTC dans 5 jours : la fin d'une plage est toujours à minuit UTC (clé de jour).
      const day = () => new Date(new Date(Date.now() + 5 * 86_400_000).toISOString().substring(0, 10));
      const input = (date: Date, over: Record<string, unknown> = {}) => ({
        title: 'Week-end',
        seance: { ...BASE, date, slot: 'EVENING' as const, ...over },
      });

      it('durée absente : un rendez-vous de 3 créneaux le reste, fin comprise', async () => {
        const d = day();
        existing({ startDate: d, startSlot: 'EVENING', durationSlots: 3 });

        await service.updateHosted(GRANT_E1, 'e1', input(d));

        const data = prisma.tx.seance.update.mock.calls[0][0].data;
        expect(data).toEqual(expect.objectContaining({ durationSlots: 3, endSlot: 'AFTERNOON' }));
        expect(data.endDate.getTime()).toBe(d.getTime() + 86_400_000);
        // Rien n’a bougé : le rappel de la veille n’est pas ré-armé.
        expect(data).not.toHaveProperty('reminderSentAt');
      });

      it('durée corrigée sur une séance datée : fin recalculée et rappel ré-armé', async () => {
        const d = day();
        existing({ startDate: d, startSlot: 'EVENING', durationSlots: 3 });

        await service.updateHosted(GRANT_E1, 'e1', input(d, { durationSlots: 1 }));

        expect(prisma.tx.seance.update).toHaveBeenCalledWith({
          where: { id: 'se1' },
          data: expect.objectContaining({
            durationSlots: 1,
            endDate: d,
            endSlot: 'EVENING',
            reminderSentAt: null,
          }),
        });
        expect(prisma.tx.partie.update).toHaveBeenCalledTimes(1);
      });

      it('modifier un autre champ ne change jamais la plage', async () => {
        const d = day();
        existing({ startDate: d, startSlot: 'EVENING', durationSlots: 2 });

        await service.updateHosted(GRANT_E1, 'e1', input(d, { lieu: 'Chez Marc' }));

        const data = prisma.tx.seance.update.mock.calls[0][0].data;
        expect(data).toEqual(expect.objectContaining({ lieu: 'Chez Marc', durationSlots: 2, endSlot: 'MORNING' }));
      });

      it('Story 47.4 — vote ouvert sans date : la durée changée par le composer est écrite AVANT les créneaux, purgés', async () => {
        existing({ startDate: null, startSlot: null, pollId: 'poll-1', durationSlots: 1 });
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: 'poll-1',
        });
        const updatePoll = jest.fn();

        await service.updateHosted(GRANT_E1, 'e1', {
          title: 'Week-end',
          seance: { ...BASE, date: null, slot: null, updatePoll, durationSlots: 2 },
        });

        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(1, {
          where: { id: 'se1' },
          data: { durationSlots: 2, endDate: null, endSlot: null },
        });
        expect(updatePoll).toHaveBeenCalledWith(prisma.tx, 'poll-1', { purge: true });
        expect(prisma.tx.seance.update.mock.invocationCallOrder[0]).toBeLessThan(
          updatePoll.mock.invocationCallOrder[0],
        );
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('séance au vote ouvert : la même durée (renvoyée par le formulaire) réconcilie sans purge', async () => {
        existing({ startDate: null, startSlot: null, pollId: 'poll-1', durationSlots: 3 });
        const updatePoll = jest.fn();

        await service.updateHosted(GRANT_E1, 'e1', {
          title: 'Week-end',
          seance: { ...BASE, date: null, slot: null, updatePoll, durationSlots: 3 },
        });

        expect(updatePoll).toHaveBeenCalledWith(prisma.tx, 'poll-1', { purge: false });
        expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
      });

      it('Story 47.4 — l’écriture des créneaux échoue : l’erreur remonte, rien n’est émis', async () => {
        existing({ startDate: null, startSlot: null, pollId: 'poll-1', durationSlots: 1 });
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: 'poll-1',
        });
        const updatePoll = jest.fn().mockRejectedValue(new Error('créneaux refusés'));

        await expect(
          service.updateHosted(GRANT_E1, 'e1', {
            title: 'Week-end',
            seance: { ...BASE, date: null, slot: null, updatePoll, durationSlots: 2 },
          }),
        ).rejects.toThrow('créneaux refusés');
        expect(realtime.emit).not.toHaveBeenCalled();
      });
    });

    describe('setInfosPratiques() — durée', () => {
      const INFOS = { heureRdv: null, lieu: 'Lyon', notePratique: null };

      it('séance datée : durée, fin et rappel écrits sous les verrous, prochaine date recalculée', async () => {
        const d = new Date(Date.now() + 5 * 86_400_000);
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: d,
          startSlot: 'EVENING',
          pollId: null,
        });

        await service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 3 });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        const locks = prisma.tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
        expect(locks[0]).toContain('FROM "Partie"');
        expect(locks[1]).toContain('FROM "Event"');
        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(1, {
          where: { id: 'se1' },
          data: expect.objectContaining({
            durationSlots: 3,
            endSlot: 'AFTERNOON',
            reminderSentAt: null,
          }),
        });
        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(2, {
          where: { id: 'se1' },
          data: { heureRdv: null, lieu: 'Lyon', notePratique: null },
        });
        expect(prisma.tx.partie.update).toHaveBeenCalledTimes(1);
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('dit si la durée a changé : oui pour une correction, non pour la même valeur', async () => {
        const d = new Date(Date.now() + 5 * 86_400_000);
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: d,
          startSlot: 'EVENING',
          pollId: null,
        });
        await expect(
          service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 3 }),
        ).resolves.toEqual({ durationChanged: true });

        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 3,
          startDate: d,
          startSlot: 'EVENING',
          pollId: null,
        });
        await expect(
          service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 3 }),
        ).resolves.toEqual({ durationChanged: false });
        await expect(service.setInfosPratiques(GRANT_P1, 'se1', INFOS)).resolves.toEqual({
          durationChanged: false,
        });
      });

      it('départ déjà passé : la fin est recalculée mais le rappel n’est pas ré-armé', async () => {
        const past = new Date(Date.now() - 3 * 86_400_000);
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: past,
          startSlot: 'EVENING',
          pollId: null,
        });

        await service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 3 });

        const data = prisma.tx.seance.update.mock.calls[0][0].data;
        expect(data).toEqual(expect.objectContaining({ durationSlots: 3, endSlot: 'AFTERNOON' }));
        expect(data).not.toHaveProperty('reminderSentAt');
      });

      it('date sans créneau : la fin reste le jour du début, rien n’est effacé', async () => {
        const d = new Date(Date.now() + 5 * 86_400_000);
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: d,
          startSlot: null,
          pollId: null,
        });

        await service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 2 });

        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(1, {
          where: { id: 'se1' },
          data: expect.objectContaining({ durationSlots: 2, endDate: d, endSlot: null }),
        });
      });

      it('séance disparue sous les verrous → 404, rien n’est écrit ni émis', async () => {
        prisma.tx.seance.findUnique.mockResolvedValue(null);

        await expect(
          service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 2 }),
        ).rejects.toThrow('Séance introuvable');
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('même durée : seules les informations pratiques sont écrites', async () => {
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 3,
          startDate: null,
          startSlot: null,
          pollId: null,
        });

        await service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 3 });

        expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
        expect(prisma.tx.partie.update).not.toHaveBeenCalled();
      });

      it('séance sans date : la durée est posée sans fin ni rappel', async () => {
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: null,
        });

        await service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 2 });

        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(1, {
          where: { id: 'se1' },
          data: { durationSlots: 2, endDate: null, endSlot: null },
        });
      });

      it('séance au vote ouvert et sans date → 400, aucune écriture', async () => {
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: 'poll-1',
        });

        await expect(
          service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 2 }),
        ).rejects.toThrow('se règle dans le composer de dates');
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('durée hors bornes → 400 avant toute transaction', async () => {
        await expect(
          service.setInfosPratiques(GRANT_P1, 'se1', { ...INFOS, durationSlots: 46 }),
        ).rejects.toThrow('15 jours au plus');
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('durée absente : aucune transaction, durée inchangée', async () => {
        await service.setInfosPratiques(GRANT_P1, 'se1', INFOS);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.seance.update).toHaveBeenCalledWith({ where: { id: 'se1' }, data: INFOS });
      });
    });

    it('chooseDate() écrit la plage complète de la séance (3 créneaux depuis un soir)', async () => {
      prisma.tx.seance.findFirst.mockResolvedValue({ durationSlots: 3 });

      await service.chooseDate(prisma.tx as unknown as Prisma.TransactionClient, 'poll1', START, 'EVENING');

      expect(prisma.tx.seance.updateMany).toHaveBeenCalledWith({
        where: { pollId: 'poll1' },
        data: {
          startDate: START,
          startSlot: 'EVENING',
          endDate: NEXT,
          endSlot: 'AFTERNOON',
          reminderSentAt: null,
        },
      });
    });

    it('addSeance() porte la durée demandée ; au-delà de 45 créneaux → 400 sans écriture', async () => {
      await service.addSeance(GRANT_P1, 'e1', 4);
      expect(prisma.seance.create).toHaveBeenCalledWith({ data: { eventId: 'e1', durationSlots: 4 } });

      prisma.seance.create.mockClear();
      await expect(service.addSeance(GRANT_P1, 'e1', 46)).rejects.toThrow('15 jours au plus');
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });
  });

  it('createInTx() n’ouvre pas de transaction et n’émet pas — l’appelant émet après son commit', async () => {
    await service.createInTx(prisma.tx as unknown as Prisma.TransactionClient, {
      partieId: 'p1',
      title: 'X',
      ownerId: 'mj1',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.tx.seance.create).toHaveBeenCalledWith({ data: { eventId: 'e1' } });
    expect(realtime.emit).not.toHaveBeenCalled();
  });

  describe('séances', () => {
    const seance = { id: 'se2', eventId: 'e1', pollId: 'poll1' };

    it('addSeance() crée une séance rattachée à l’événement et émet', async () => {
      await service.addSeance(GRANT_P1, 'e1');

      expect(prisma.seance.create).toHaveBeenCalledWith({
        data: { eventId: 'e1', durationSlots: 1 },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('deleteSeance() refuse la première séance de l’événement', async () => {
      prisma.seance.findMany.mockResolvedValueOnce([{ id: 'se2' }]);

      await expect(service.deleteSeance(GRANT_P1, seance)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('deleteSeance() supprime la séance PUIS son vote, recalcule la prochaine date et émet', async () => {
      prisma.seance.findMany.mockResolvedValueOnce([{ id: 'se1' }]);

      await service.deleteSeance(GRANT_P1, seance);

      expect(prisma.seance.delete).toHaveBeenCalledWith({ where: { id: 'se2' } });
      expect(prisma.sessionPoll.delete).toHaveBeenCalledWith({ where: { id: 'poll1' } });
      expect(prisma.partie.update).toHaveBeenCalled();
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('deleteSeance() concurrente (P2025) → 404 propre', async () => {
      prisma.seance.findMany.mockResolvedValueOnce([{ id: 'se1' }]);
      prisma.seance.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('absente', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(service.deleteSeance(GRANT_P1, seance)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('createSeancePoll() refuse une séance déjà liée AVANT de créer le vote', async () => {
      const createPoll = jest.fn();

      await expect(
        service.createSeancePoll(GRANT_P1, seance, undefined, createPoll),
      ).rejects.toThrow('Cette séance est déjà liée à un vote de date');
      expect(createPoll).not.toHaveBeenCalled();
    });

    it('createSeancePoll() pose Seance.pollId du vote créé par l’appelant, dans la transaction, et émet', async () => {
      prisma.tx.seance.findUnique.mockResolvedValue({ pollId: null, durationSlots: 1 });
      const createPoll = jest.fn().mockResolvedValue({ id: 'poll9' });

      await service.createSeancePoll(GRANT_P1, { ...seance, pollId: null }, undefined, createPoll);

      expect(createPoll).toHaveBeenCalledWith(prisma.tx, 1);
      expect(prisma.tx.seance.update).toHaveBeenCalledWith({
        where: { id: 'se2' },
        data: { pollId: 'poll9' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    describe('createSeancePoll() atomique (Story 47.4)', () => {
      const free = { ...seance, pollId: null };

      it('verrou de la partie puis de l’événement, durée écrite, vote créé avec cette durée, puis pollId', async () => {
        prisma.tx.seance.findUnique
          .mockResolvedValueOnce({ pollId: null, durationSlots: 1 })
          .mockResolvedValueOnce({ durationSlots: 1, startDate: null, startSlot: null, pollId: null });
        const createPoll = jest.fn().mockResolvedValue({ id: 'poll9' });

        await service.createSeancePoll(GRANT_P1, free, 6, createPoll);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        const locks = prisma.tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
        expect(locks[0]).toContain('FROM "Partie"');
        expect(locks[1]).toContain('FROM "Event"');
        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(1, {
          where: { id: 'se2' },
          data: { durationSlots: 6, endDate: null, endSlot: null },
        });
        expect(createPoll).toHaveBeenCalledWith(prisma.tx, 6);
        expect(prisma.tx.seance.update).toHaveBeenNthCalledWith(2, {
          where: { id: 'se2' },
          data: { pollId: 'poll9' },
        });
      });

      it('durée absente : la durée actuelle de la séance est celle du vote, rien d’autre n’est écrit', async () => {
        prisma.tx.seance.findUnique.mockResolvedValueOnce({ pollId: null, durationSlots: 3 });
        const createPoll = jest.fn().mockResolvedValue({ id: 'poll9' });

        await service.createSeancePoll(GRANT_P1, free, undefined, createPoll);

        expect(createPoll).toHaveBeenCalledWith(prisma.tx, 3);
        expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
      });

      it('la création du vote échoue : l’erreur remonte, aucune émission (la transaction annule la durée)', async () => {
        prisma.tx.seance.findUnique
          .mockResolvedValueOnce({ pollId: null, durationSlots: 1 })
          .mockResolvedValueOnce({ durationSlots: 1, startDate: null, startSlot: null, pollId: null });
        const createPoll = jest.fn().mockRejectedValue(new Error('vote refusé'));

        await expect(service.createSeancePoll(GRANT_P1, free, 6, createPoll)).rejects.toThrow(
          'vote refusé',
        );
        // Le pollId n'est jamais posé ; la durée écrite l'a été dans la transaction qui échoue.
        expect(prisma.tx.seance.update).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: { pollId: expect.anything() } }),
        );
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('déjà liée sous les verrous (création concurrente) → 400, aucun vote créé', async () => {
        prisma.tx.seance.findUnique.mockResolvedValueOnce({ pollId: 'autre', durationSlots: 1 });
        const createPoll = jest.fn();

        await expect(service.createSeancePoll(GRANT_P1, free, 6, createPoll)).rejects.toThrow(
          'Cette séance est déjà liée à un vote de date',
        );
        expect(createPoll).not.toHaveBeenCalled();
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('durée hors bornes → 400 avant toute transaction', async () => {
        await expect(service.createSeancePoll(GRANT_P1, free, 46, jest.fn())).rejects.toThrow(
          '15 jours au plus',
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('RendezVousDurationPort (Story 47.4)', () => {
      const tx = () => prisma.tx as unknown as Prisma.TransactionClient;

      it('setDurationInTx() verrouille la partie puis l’événement du vote, puis écrit la durée (vote ouvert accepté)', async () => {
        prisma.tx.sessionPoll.findUnique.mockResolvedValue({
          partieId: 'p1',
          seance: { id: 'se2', eventId: 'e1' },
        });
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: 'poll1',
        });

        await expect(service.setDurationInTx(tx(), 'poll1', 3)).resolves.toEqual({
          changed: true,
          durationSlots: 3,
        });

        const locks = prisma.tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
        expect(locks[0]).toContain('FROM "Partie"');
        expect(prisma.tx.$queryRaw.mock.calls[0][1]).toBe('p1');
        expect(locks[1]).toContain('FROM "Event"');
        expect(prisma.tx.$queryRaw.mock.calls[1][1]).toBe('e1');
        expect(prisma.tx.seance.update).toHaveBeenCalledWith({
          where: { id: 'se2' },
          data: { durationSlots: 3, endDate: null, endSlot: null },
        });
      });

      it('même durée : rien n’est écrit, changed faux', async () => {
        prisma.tx.sessionPoll.findUnique.mockResolvedValue({
          partieId: 'p1',
          seance: { id: 'se2', eventId: 'e1' },
        });
        prisma.tx.seance.findUnique.mockResolvedValue({
          durationSlots: 3,
          startDate: null,
          startSlot: null,
          pollId: 'poll1',
        });

        await expect(service.setDurationInTx(tx(), 'poll1', 3)).resolves.toEqual({
          changed: false,
          durationSlots: 3,
        });
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('durée absente : verrous seulement, durée relue sous les verrous', async () => {
        prisma.tx.sessionPoll.findUnique.mockResolvedValue({
          partieId: 'p1',
          seance: { id: 'se2', eventId: 'e1' },
        });
        prisma.tx.seance.findUnique.mockResolvedValue({ durationSlots: 4 });

        await expect(service.setDurationInTx(tx(), 'poll1')).resolves.toEqual({
          changed: false,
          durationSlots: 4,
        });
        expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(2);
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('vote introuvable → 404 ; vote sans séance : 404 pour une durée donnée, 1 sinon', async () => {
        prisma.tx.sessionPoll.findUnique.mockResolvedValueOnce(null);
        await expect(service.setDurationInTx(tx(), 'nope', 2)).rejects.toBeInstanceOf(
          NotFoundException,
        );

        prisma.tx.sessionPoll.findUnique.mockResolvedValue({ partieId: 'p1', seance: null });
        await expect(service.setDurationInTx(tx(), 'legacy', 2)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(service.setDurationInTx(tx(), 'legacy')).resolves.toEqual({
          changed: false,
          durationSlots: 1,
        });
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('durationsOf() : une lecture, 1 pour un vote sans séance', async () => {
        prisma.seance.findMany.mockResolvedValue([{ pollId: 'a', durationSlots: 6 }]);

        const durations = await service.durationsOf(['a', 'b']);

        expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
        expect([...durations.entries()]).toEqual([
          ['a', 6],
          ['b', 1],
        ]);
        prisma.seance.findMany.mockClear();
        expect((await service.durationsOf([])).size).toBe(0);
        expect(prisma.seance.findMany).not.toHaveBeenCalled();
      });
    });

    it('chooseDate() pose une plage start = end sur la séance du vote, sans émettre', async () => {
      const d = new Date('2026-11-03T00:00:00.000Z');

      await service.chooseDate(
        prisma.tx as unknown as Prisma.TransactionClient,
        'poll1',
        d,
        'EVENING',
      );

      expect(prisma.tx.seance.updateMany).toHaveBeenCalledWith({
        where: { pollId: 'poll1' },
        data: {
          startDate: d,
          startSlot: 'EVENING',
          endDate: d,
          endSlot: 'EVENING',
          // Nouvelle date → rappel de la veille ré-armé (Story 37.9).
          reminderSentAt: null,
        },
      });
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('chooseDate() recalcule la prochaine séance de la partie du vote DANS la transaction fournie (Story 37.8, AD-15)', async () => {
      const future = new Date(Date.UTC(2099, 0, 2));
      prisma.tx.seance.findMany.mockResolvedValue([{ startDate: future, startSlot: 'EVENING' }]);

      await service.chooseDate(
        prisma.tx as unknown as Prisma.TransactionClient,
        'poll1',
        future,
        'EVENING',
      );

      expect(prisma.tx.sessionPoll.findUnique).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        select: { partieId: true },
      });
      // Anti-spoil serveur : seules les séances qui ne sont pas celles d'un brouillon caché
      // comptent (fragment partagé `VISIBLE_SEANCE_WHERE`).
      expect(prisma.tx.seance.findMany).toHaveBeenCalledWith({
        where: { AND: [{ event: { partieId: 'p1', cancelledAt: null } }, VISIBLE_SEANCE_WHERE] },
        select: { startDate: true, startSlot: true, endDate: true, endSlot: true },
      });
      expect(prisma.tx.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: future, nextSessionSlot: 'EVENING', nextSessionEndDate: future, nextSessionEndSlot: 'EVENING' },
      });
      // Rien n'est écrit hors de la transaction de l'appelant.
      expect(prisma.partie.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('chooseDate() : une date passée est écrite sur la séance mais n’est pas retenue comme prochaine séance', async () => {
      const past = new Date(Date.UTC(2020, 0, 2));
      prisma.tx.seance.findMany.mockResolvedValue([{ startDate: past, startSlot: 'MORNING' }]);

      await service.chooseDate(
        prisma.tx as unknown as Prisma.TransactionClient,
        'poll1',
        past,
        'MORNING',
      );

      expect(prisma.tx.seance.updateMany).toHaveBeenCalledWith({
        where: { pollId: 'poll1' },
        data: {
          startDate: past,
          startSlot: 'MORNING',
          endDate: past,
          endSlot: 'MORNING',
          reminderSentAt: null,
        },
      });
      expect(prisma.tx.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: null, nextSessionSlot: null, nextSessionEndDate: null, nextSessionEndSlot: null },
      });
    });

    it('chooseDate() : un vote introuvable lève 404 sans recalcul', async () => {
      prisma.tx.sessionPoll.findUnique.mockResolvedValue(null);

      await expect(
        service.chooseDate(
          prisma.tx as unknown as Prisma.TransactionClient,
          'poll-inconnu',
          new Date(),
          'EVENING',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tx.partie.update).not.toHaveBeenCalled();
      // Le vote est cherché AVANT toute écriture : rien n'a été écrit sur les séances.
      expect(prisma.tx.seance.updateMany).not.toHaveBeenCalled();
    });

    it('resetSeanceDate() détache le vote, le supprime, recalcule et émet', async () => {
      await service.resetSeanceDate(GRANT_P1, seance);

      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: 'se2' },
        data: {
          pollId: null,
          startDate: null,
          startSlot: null,
          endDate: null,
          endSlot: null,
          // Plage effacée → plus de rappel en attente pour cette séance (Story 37.9).
          reminderSentAt: null,
        },
      });
      expect(prisma.sessionPoll.delete).toHaveBeenCalledWith({ where: { id: 'poll1' } });
      expect(prisma.partie.update).toHaveBeenCalled();
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('setSeanceCapacity() refuse max < min, sans écriture', async () => {
      await expect(service.setSeanceCapacity(GRANT_P1, 'se2', 4, 2)).rejects.toThrow(
        'Le maximum doit être supérieur ou égal au minimum',
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('setInfosPratiques() écrit les trois champs tels quels et émet', async () => {
      await service.setInfosPratiques(GRANT_P1, 'se2', {
        heureRdv: '20:30',
        lieu: null,
        notePratique: 'Apporter des dés',
      });

      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: 'se2' },
        data: { heureRdv: '20:30', lieu: null, notePratique: 'Apporter des dés' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });
  });

  describe('appartenance à la partie de l’autorisation (Story 37.6)', () => {
    const seanceB = { id: 'seance-b', eventId: 'event-b', pollId: null };

    it('séance d’une autre partie → 404 « Séance introuvable », aucune écriture', async () => {
      prisma.seance.count.mockResolvedValue(0);

      await expect(service.resetSeanceDate(GRANT_P1, seanceB)).rejects.toThrow(
        new NotFoundException('Séance introuvable'),
      );
      await expect(service.deleteSeance(GRANT_P1, seanceB)).rejects.toThrow('Séance introuvable');
      await expect(service.setSeanceCapacity(GRANT_P1, 'seance-b', 1, 2)).rejects.toThrow(
        'Séance introuvable',
      );
      await expect(
        service.inscrire(GRANT_P1, { id: 'seance-b', inscriptionMax: 2, startDate: null }, 'u1'),
      ).rejects.toThrow('Séance introuvable');
      expect(prisma.seance.count).toHaveBeenCalledWith({
        where: { id: 'seance-b', event: { partieId: 'p1' } },
      });
      expect(prisma.seance.update).not.toHaveBeenCalled();
      expect(prisma.seance.delete).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('événement d’une autre partie → 404 « Scénario introuvable », aucune séance créée', async () => {
      prisma.event.count.mockResolvedValue(0);

      await expect(service.addSeance(GRANT_P1, 'event-b')).rejects.toThrow(
        new NotFoundException('Scénario introuvable'),
      );
      expect(prisma.event.count).toHaveBeenCalledWith({
        where: { id: 'event-b', partieId: 'p1' },
      });
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });

    it('autorisation délivrée sur la séance elle-même → aucune requête d’appartenance', async () => {
      const grant = testGrant({ id: 'p1' }, 'mj', { eventId: 'e1', seanceId: 'se2' });

      await service.setInfosPratiques(grant, 'se2', {
        heureRdv: null,
        lieu: null,
        notePratique: null,
      });

      expect(prisma.seance.count).not.toHaveBeenCalled();
      expect(prisma.seance.update).toHaveBeenCalled();
    });
  });

  describe('inscriptions', () => {
    const open = { id: 'se1', inscriptionMax: 2, startDate: null };

    it('capacité non définie → 400, aucune transaction', async () => {
      await expect(
        service.inscrire(GRANT_P1, { ...open, inscriptionMax: null }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('date validée (vote scellé) → 400, roster figé', async () => {
      await expect(
        service.inscrire(GRANT_P1, { ...open, startDate: new Date() }, 'u1'),
      ).rejects.toThrow('Cette séance a déjà une date validée — les inscriptions sont figées');
    });

    it('verrou FOR UPDATE puis inscription, émission après validation', async () => {
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue({ ...open });

      await service.inscrire(GRANT_P1, open, 'u1');

      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.inscription.create).toHaveBeenCalledWith({
        data: { seanceId: 'se1', userId: 'u1' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('déjà inscrit → idempotent, aucun comptage ni création', async () => {
      prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1' });

      await service.inscrire(GRANT_P1, open, 'u1');

      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('plafond atteint sous le verrou → 409', async () => {
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue({ ...open });
      prisma.tx.inscription.count.mockResolvedValue(2);

      await expect(service.inscrire(GRANT_P1, open, 'u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('desinscrire() : date validée → 400 ; sinon retrait idempotent et émission', async () => {
      await expect(
        service.desinscrire(GRANT_P1, { id: 'se1', startDate: new Date() }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();

      await service.desinscrire(GRANT_P1, { id: 'se1', startDate: null }, 'u1');
      expect(prisma.inscription.deleteMany).toHaveBeenCalledWith({
        where: { seanceId: 'se1', userId: 'u1' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });
  });

  // Story 40.3 : inscription et désinscription à une conjonction (groupe de ralliement).
  describe('inscrireConjonction() / desinscrireConjonction() (Story 40.3)', () => {
    const GRANT_SE1 = testGrant({ id: 'p1', ownerId: 'a' }, 'member', {
      eventId: 'e1',
      seanceId: 'se1',
    });
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

    /** Séance relue sous le verrou : date, capacité et hôte de l'événement. */
    function locked(
      over: {
        startDate?: Date | null;
        inscriptionMax?: number | null;
        ownerId?: string | null;
      } = {},
    ) {
      prisma.tx.seance.findUnique.mockImplementation((args: { select: Record<string, unknown> }) =>
        Promise.resolve(
          'eventId' in args.select
            ? { eventId: 'e1' }
            : {
                startDate: 'startDate' in over ? over.startDate : inDays(3),
                inscriptionMax: 'inscriptionMax' in over ? over.inscriptionMax : 4,
                event: { ownerId: 'ownerId' in over ? over.ownerId : 'hote' },
              },
        ),
      );
    }

    it('verrouille la ligne Event AVANT de relire la séance et de compter, puis inscrit et émet', async () => {
      locked();
      prisma.tx.inscription.count.mockResolvedValue(1);

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
      expect(callArg<string>(prisma.tx.$queryRaw, 0, 1)).toBe('e1');
      expect(prisma.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.tx.inscription.count.mock.invocationCallOrder[0],
      );
      expect(prisma.tx.inscription.create).toHaveBeenCalledWith({
        data: { seanceId: 'se1', userId: 'u1' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('capacité nulle (« Tous les membres ») : aucun comptage, aucune limite', async () => {
      locked({ inscriptionMax: null });

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
    });

    it('places prises = l’hôte (sans ligne) + les inscrits : la dernière place est accordée', async () => {
      locked({ inscriptionMax: 4 });
      prisma.tx.inscription.count.mockResolvedValue(2);

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.tx.inscription.count).toHaveBeenCalledWith({
        where: { seanceId: 'se1', userId: { not: 'hote' } },
      });
      expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
    });

    it('événement sans hôte (compte supprimé) : comptage SANS filtre sur l’hôte, la dernière place est accordée', async () => {
      locked({ ownerId: null, inscriptionMax: 2 });
      prisma.tx.inscription.count.mockResolvedValue(1);

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.tx.inscription.count).toHaveBeenCalledWith({ where: { seanceId: 'se1' } });
      expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
    });

    it('événement sans hôte : inscrits = capacité → 409, rien n’est écrit', async () => {
      locked({ ownerId: null, inscriptionMax: 2 });
      prisma.tx.inscription.count.mockResolvedValue(2);

      await expect(service.inscrireConjonction(GRANT_SE1, 'se1', 'u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('complet : hôte + inscrits = capacité → 409, rien n’est écrit ni émis', async () => {
      locked({ inscriptionMax: 3 });
      prisma.tx.inscription.count.mockResolvedValue(2);

      const refusal = service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      await expect(refusal).rejects.toBeInstanceOf(ConflictException);
      await expect(refusal).rejects.toThrow(FULL_EVENT_MESSAGE);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('inscription tardive : la date est posée mais pas passée → acceptée, la séance n’est pas modifiée', async () => {
      locked({ startDate: inDays(1) });

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
      expect(prisma.tx.seance.update).not.toHaveBeenCalled();
    });

    it('déjà inscrit : idempotent, aucun comptage ni création — même sur une conjonction pleine', async () => {
      locked({ inscriptionMax: 3 });
      prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1', status: 'CONFIRMED' });

      await expect(service.inscrireConjonction(GRANT_SE1, 'se1', 'u1')).resolves.toBeUndefined();

      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.updateMany).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalledWith(userTopic('u1'));
    });

    it('place RÉSERVÉE : s’inscrire la confirme (sous le verrou, sans comptage ni nouvelle ligne) et notifie la personne (Story 40.4)', async () => {
      locked({ inscriptionMax: 3 });
      prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1', status: 'RESERVED' });

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
      expect(prisma.tx.inscription.updateMany).toHaveBeenCalledWith({
        where: { seanceId: 'se1', userId: 'u1', status: 'RESERVED' },
        data: { status: 'CONFIRMED' },
      });
      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(realtime.emit).toHaveBeenNthCalledWith(1, partieTopic('p1'));
      expect(realtime.emit).toHaveBeenNthCalledWith(2, userTopic('u1'));
    });

    it('l’hôte qui s’inscrit : idempotent, aucune ligne créée', async () => {
      locked();

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'hote');

      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it.each(['inscrireConjonction', 'desinscrireConjonction'] as const)(
      'jour passé : %s est refusé (400), rien n’est écrit ni émis',
      async (method) => {
        locked({ startDate: inDays(-1) });

        const refusal = service[method](GRANT_SE1, 'se1', 'u1');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(PAST_ROSTER_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
        expect(prisma.tx.inscription.deleteMany).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      },
    );

    it('aujourd’hui n’est pas passé : inscription acceptée', async () => {
      locked({ startDate: new Date(Date.UTC(2000, 0, 1)) });
      jest.useFakeTimers().setSystemTime(new Date('2000-01-01T23:00:00.000Z'));
      try {
        await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');
      } finally {
        jest.useRealTimers();
      }
      expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
    });

    it('séance disparue (supprimée entre-temps) → 404', async () => {
      prisma.tx.seance.findUnique.mockResolvedValue(null);

      await expect(service.inscrireConjonction(GRANT_SE1, 'se1', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.desinscrireConjonction(GRANT_SE1, 'se1', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('séance d’une autre partie que celle de l’autorisation → 404 avant toute transaction', async () => {
      prisma.seance.count.mockResolvedValue(0);
      const grantAutre = testGrant({ id: 'p1', ownerId: 'a' }, 'member', { eventId: 'e9' });

      await expect(service.inscrireConjonction(grantAutre, 'se9', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.desinscrireConjonction(grantAutre, 'se9', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('désinscrire : sous le même verrou, retire la ligne de l’appelant (deleteMany) puis émet', async () => {
      locked();

      await service.desinscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
      expect(prisma.tx.inscription.deleteMany).toHaveBeenCalledWith({
        where: { seanceId: 'se1', userId: 'u1' },
      });
      expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('désinscrire : l’hôte ne se désinscrit pas de sa propre conjonction (aucun retrait)', async () => {
      locked();

      await service.desinscrireConjonction(GRANT_SE1, 'se1', 'hote');

      expect(prisma.tx.inscription.deleteMany).not.toHaveBeenCalled();
      // Story 49.3 : l'hôte n'est pas concerné, aucun apport n'est cherché.
      expect(prisma.tx.eventGameBring.findMany).not.toHaveBeenCalled();
      expect(prisma.tx.eventGameBring.deleteMany).not.toHaveBeenCalled();
    });

    it('Story 49.3 — désinscrire : supprime les apports de la personne sur CETTE soirée, après le retrait de la ligne, dans la même transaction', async () => {
      locked();
      const ordre: string[] = [];
      prisma.tx.inscription.deleteMany.mockImplementation(() => {
        ordre.push('inscription');
        return Promise.resolve({ count: 1 });
      });
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }, { eventId: 'e1' }]);
      prisma.tx.eventGameBring.deleteMany.mockImplementation(() => {
        ordre.push('apports');
        return Promise.resolve({ count: 2 });
      });

      await service.desinscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(ordre).toEqual(['inscription', 'apports']);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.eventGameBring.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', eventId: 'e1' },
      });
      // Émission inchangée : `partie:` (et `user:` car une ligne d'inscription est partie).
      expect(realtime.emit).toHaveBeenNthCalledWith(1, partieTopic('p1'));
      expect(realtime.emit).toHaveBeenNthCalledWith(2, userTopic('u1'));
    });

    it("Story 49.3 — désinscrire : un échec de la suppression des apports remonte et n'émet rien (la transaction annule tout)", async () => {
      locked();
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }]);
      prisma.tx.eventGameBring.deleteMany.mockRejectedValue(new Error('échec apports'));

      await expect(service.desinscrireConjonction(GRANT_SE1, 'se1', 'u1')).rejects.toThrow(
        'échec apports',
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it("Story 49.3 — s'inscrire (promotion d'une place réservée) ne supprime aucun apport", async () => {
      locked();
      prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1', status: 'RESERVED' });

      await service.inscrireConjonction(GRANT_SE1, 'se1', 'u1');

      expect(prisma.tx.inscription.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.tx.eventGameBring.findMany).not.toHaveBeenCalled();
      expect(prisma.tx.eventGameBring.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('réserver / retirer / accepter une place (Story 40.4)', () => {
    const GRANT_SE1 = testGrant({ id: 'p1', ownerId: 'a' }, 'member', {
      eventId: 'e1',
      seanceId: 'se1',
    });
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

    /** Séance relue sous le verrou : date, capacité et hôte de l'événement (comme pour 40.3). */
    function locked(
      over: {
        startDate?: Date | null;
        inscriptionMax?: number | null;
        ownerId?: string | null;
      } = {},
    ) {
      prisma.tx.seance.findUnique.mockImplementation((args: { select: Record<string, unknown> }) =>
        Promise.resolve(
          'eventId' in args.select
            ? { eventId: 'e1' }
            : {
                startDate: 'startDate' in over ? over.startDate : inDays(3),
                inscriptionMax: 'inscriptionMax' in over ? over.inscriptionMax : 4,
                event: { ownerId: 'ownerId' in over ? over.ownerId : 'hote' },
              },
        ),
      );
      prisma.tx.membership.findMany.mockResolvedValue([{ userId: 'cible' }]);
    }

    describe('reserverPlace()', () => {
      it('verrouille la ligne Event AVANT de compter, écrit une ligne RESERVED puis émet partie: et user: de la cible', async () => {
        locked();
        prisma.tx.inscription.count.mockResolvedValue(1);

        await service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
        expect(callArg<string>(prisma.tx.$queryRaw, 0, 1)).toBe('e1');
        expect(prisma.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
          prisma.tx.inscription.count.mock.invocationCallOrder[0],
        );
        expect(prisma.tx.inscription.create).toHaveBeenCalledWith({
          data: { seanceId: 'se1', userId: 'cible', status: 'RESERVED' },
        });
        expect(realtime.emit).toHaveBeenNthCalledWith(1, partieTopic('p1'));
        expect(realtime.emit).toHaveBeenNthCalledWith(2, userTopic('cible'));
      });

      it('la dernière place libre peut être réservée ; toute ligne (réservée ou confirmée) compte dans la capacité', async () => {
        locked({ inscriptionMax: 4 });
        // Hôte + 2 lignes (une confirmée, une réservée) = 3 places prises sur 4.
        prisma.tx.inscription.count.mockResolvedValue(2);

        await service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        expect(prisma.tx.inscription.count).toHaveBeenCalledWith({
          where: { seanceId: 'se1', userId: { not: 'hote' } },
        });
        expect(prisma.tx.inscription.create).toHaveBeenCalledTimes(1);
      });

      it('complet (les places réservées comptent) → 409, rien n’est écrit ni émis', async () => {
        locked({ inscriptionMax: 3 });
        prisma.tx.inscription.count.mockResolvedValue(2);

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(ConflictException);
        await expect(refusal).rejects.toThrow(FULL_EVENT_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('déjà inscrit ou déjà réservé → 409 en français, rien n’est écrit', async () => {
        locked();
        prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1' });

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(ConflictException);
        await expect(refusal).rejects.toThrow(RESERVE_ALREADY_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });

      it('« Tous les membres » (capacité nulle) → 400, aucun comptage', async () => {
        locked({ inscriptionMax: null });

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(RESERVE_NOT_LIMITED_MESSAGE);
        expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });

      it('l’hôte lui-même → 400', async () => {
        locked();

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'hote');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(RESERVE_HOST_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });

      it('une personne qui n’est pas (ou plus) membre du groupe → 400', async () => {
        locked();
        prisma.tx.membership.findMany.mockResolvedValue([]);

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(RESERVE_NOT_MEMBER_MESSAGE);
        expect(callArg(prisma.tx.membership.findMany)).toEqual(
          objectLike({ where: { partieId: 'p1', userId: { in: ['cible'] } } }),
        );
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });

      it('conjonction passée → 400, rien n’est écrit ni émis', async () => {
        locked({ startDate: inDays(-1) });

        const refusal = service.reserverPlace(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(PAST_ROSTER_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('séance d’une autre partie que celle de l’autorisation → 404 avant toute transaction', async () => {
        prisma.seance.count.mockResolvedValue(0);
        const grantAutre = testGrant({ id: 'p1', ownerId: 'a' }, 'member', { eventId: 'e9' });

        await expect(service.reserverPlace(grantAutre, 'se9', 'cible')).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('retirerReservation()', () => {
      it('sous le même verrou, ne supprime QUE la ligne RESERVED de la cible, puis émet partie: et user:', async () => {
        locked();

        await service.retirerReservation(GRANT_SE1, 'se1', 'cible');

        expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
        expect(prisma.tx.inscription.deleteMany).toHaveBeenCalledWith({
          where: { seanceId: 'se1', userId: 'cible', status: 'RESERVED' },
        });
        expect(realtime.emit).toHaveBeenNthCalledWith(1, partieTopic('p1'));
        expect(realtime.emit).toHaveBeenNthCalledWith(2, userTopic('cible'));
      });

      it('Story 49.3 (défensif) — supprime les apports de la cible sur cette soirée quand la réservation est retirée', async () => {
        locked();
        prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }]);
        prisma.tx.eventGameBring.deleteMany.mockResolvedValue({ count: 1 });

        await service.retirerReservation(GRANT_SE1, 'se1', 'cible');

        expect(prisma.tx.eventGameBring.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'cible', eventId: 'e1' },
        });
      });

      it('Story 49.3 — rien à retirer (inscription confirmée ou absente) : aucun apport touché', async () => {
        locked();
        prisma.tx.inscription.deleteMany.mockResolvedValue({ count: 0 });

        await service.retirerReservation(GRANT_SE1, 'se1', 'cible');

        expect(prisma.tx.eventGameBring.findMany).not.toHaveBeenCalled();
        expect(prisma.tx.eventGameBring.deleteMany).not.toHaveBeenCalled();
      });

      it('rien à retirer (inscription confirmée ou absente) : idempotent, la cible n’est pas notifiée', async () => {
        locked();
        prisma.tx.inscription.deleteMany.mockResolvedValue({ count: 0 });

        await expect(
          service.retirerReservation(GRANT_SE1, 'se1', 'cible'),
        ).resolves.toBeUndefined();

        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
        expect(realtime.emit).not.toHaveBeenCalledWith(userTopic('cible'));
      });

      it('conjonction passée → 400, rien n’est supprimé', async () => {
        locked({ startDate: inDays(-1) });

        await expect(service.retirerReservation(GRANT_SE1, 'se1', 'cible')).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(prisma.tx.inscription.deleteMany).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });
    });

    describe('accepterReservation()', () => {
      it('sous le même verrou, passe la ligne RESERVED de l’appelant à CONFIRMED (la capacité ne change pas), puis émet', async () => {
        locked();

        await service.accepterReservation(GRANT_SE1, 'se1', 'cible');

        expect(callArg<string[]>(prisma.tx.$queryRaw, 0, 0).join('?')).toContain('FROM "Event"');
        expect(prisma.tx.inscription.updateMany).toHaveBeenCalledWith({
          where: { seanceId: 'se1', userId: 'cible', status: 'RESERVED' },
          data: { status: 'CONFIRMED' },
        });
        expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
        expect(realtime.emit).toHaveBeenNthCalledWith(1, partieTopic('p1'));
        expect(realtime.emit).toHaveBeenNthCalledWith(2, userTopic('cible'));
      });

      it('ligne absente ou déjà confirmée : sans effet (aucune notification de la personne)', async () => {
        locked();
        prisma.tx.inscription.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.accepterReservation(GRANT_SE1, 'se1', 'cible'),
        ).resolves.toBeUndefined();

        expect(realtime.emit).not.toHaveBeenCalledWith(userTopic('cible'));
      });

      it('conjonction passée → 400, rien n’est écrit ni émis', async () => {
        locked({ startDate: inDays(-1) });

        const refusal = service.accepterReservation(GRANT_SE1, 'se1', 'cible');

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(PAST_ROSTER_MESSAGE);
        expect(prisma.tx.inscription.updateMany).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('Story 49.3 — la promotion RESERVED → CONFIRMED ne supprime aucun apport', async () => {
        locked();

        await service.accepterReservation(GRANT_SE1, 'se1', 'cible');

        expect(prisma.tx.eventGameBring.findMany).not.toHaveBeenCalled();
        expect(prisma.tx.eventGameBring.deleteMany).not.toHaveBeenCalled();
      });
    });

    describe('décliner = désinscrireConjonction()', () => {
      it('supprime la ligne (réservée comprise) et notifie la personne ; rien de supprimé → pas de notification', async () => {
        locked();

        await service.desinscrireConjonction(GRANT_SE1, 'se1', 'cible');
        expect(realtime.emit).toHaveBeenCalledWith(userTopic('cible'));

        realtime.emit.mockClear();
        prisma.tx.inscription.deleteMany.mockResolvedValue({ count: 0 });
        await service.desinscrireConjonction(GRANT_SE1, 'se1', 'cible');
        expect(realtime.emit).not.toHaveBeenCalledWith(userTopic('cible'));
      });
    });

    describe('inscrireConjonction() face à une place réservée', () => {
      it('« Complet » : les places réservées comptent — un autre membre reçoit 409 sur la dernière place tenue', async () => {
        locked({ inscriptionMax: 3 });
        // Hôte + 1 confirmé + 1 RESERVED = 3 places prises sur 3.
        prisma.tx.inscription.count.mockResolvedValue(2);

        await expect(service.inscrireConjonction(GRANT_SE1, 'se1', 'autre')).rejects.toThrow(
          FULL_EVENT_MESSAGE,
        );
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });

      it('la personne qui tient une place réservée n’est jamais rejetée : sa ligne existe déjà (idempotent)', async () => {
        locked({ inscriptionMax: 3 });
        prisma.tx.inscription.findUnique.mockResolvedValue({ id: 'i1' });

        await expect(
          service.inscrireConjonction(GRANT_SE1, 'se1', 'cible'),
        ).resolves.toBeUndefined();

        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      });
    });

    describe('reservationNotice()', () => {
      it('titre, hôte, date, lieu et adresses des destinataires, en deux lectures', async () => {
        prisma.event.findUnique.mockResolvedValue({
          title: 'Catane',
          owner: { displayName: 'Léa' },
          seances: [
            { startDate: new Date('2026-11-14T00:00:00Z'), startSlot: 'EVENING', lieu: 'Lyon' },
          ],
        });
        prisma.user.findMany.mockResolvedValue([{ id: 'cible', email: 'cible@example.com' }]);

        const notice = await service.reservationNotice('e1', ['cible']);

        expect(notice).toEqual({
          eventTitle: 'Catane',
          hostName: 'Léa',
          startDate: new Date('2026-11-14T00:00:00Z'),
          startSlot: 'EVENING',
          endDate: null,
          endSlot: null,
          lieu: 'Lyon',
          recipients: [{ id: 'cible', email: 'cible@example.com' }],
        });
      });

      it('conjonction disparue → null', async () => {
        prisma.event.findUnique.mockResolvedValue(null);

        await expect(service.reservationNotice('e1', ['cible'])).resolves.toBeNull();
      });
    });
  });

  describe('releaseUpcomingInscriptionsInTx() — départ du groupe (Story 40.8)', () => {
    const today = new Date().toISOString().substring(0, 10);

    it("sans inscription à venir : rien n'est verrouillé ni supprimé", async () => {
      prisma.tx.inscription.findMany.mockResolvedValue([]);
      await expect(
        service.releaseUpcomingInscriptionsInTx(prisma.tx as never, 'p1', 'u1'),
      ).resolves.toBe(0);
      expect(prisma.tx.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.deleteMany).not.toHaveBeenCalled();
    });

    it('verrouille les événements concernés (triés, sans doublon) PUIS supprime les lignes à venir de la personne', async () => {
      const ordre: string[] = [];
      prisma.tx.inscription.findMany.mockResolvedValue([
        { seance: { eventId: 'evB' } },
        { seance: { eventId: 'evA' } },
        { seance: { eventId: 'evB' } },
      ]);
      prisma.tx.$queryRaw.mockImplementation((_s: TemplateStringsArray, id: string) => {
        ordre.push(`verrou:${id}`);
        return Promise.resolve([{ id }]);
      });
      prisma.tx.inscription.deleteMany.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve({ count: 3 });
      });

      await expect(
        service.releaseUpcomingInscriptionsInTx(prisma.tx as never, 'p1', 'u1'),
      ).resolves.toBe(3);

      expect(ordre).toEqual(['verrou:evA', 'verrou:evB', 'delete']);
      // Aucune émission : l'appelant émet après son commit.
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it("ne vise que la personne, la partie, et les séances d'aujourd'hui ou plus tard (jour UTC) ou sans date — réservées comme confirmées", async () => {
      prisma.tx.inscription.findMany.mockResolvedValue([{ seance: { eventId: 'evA' } }]);
      await service.releaseUpcomingInscriptionsInTx(prisma.tx as never, 'p1', 'u1');
      const where = callArg<{ where: Prisma.InscriptionWhereInput }>(
        prisma.tx.inscription.deleteMany,
      ).where;
      expect(where).toEqual({
        userId: 'u1',
        seance: {
          event: { partieId: 'p1' },
          OR: [
            { startDate: null },
            { endDate: { gte: new Date(`${today}T00:00:00.000Z`) } },
            { endDate: null, startDate: { gte: new Date(`${today}T00:00:00.000Z`) } },
          ],
        },
      });
      // Aucun filtre de statut : `RESERVED` et `CONFIRMED` sont libérés.
      expect(JSON.stringify(where)).not.toContain('status');
      // La même condition sert à choisir les verrous et à supprimer.
      expect(callArg<{ where: unknown }>(prisma.tx.inscription.findMany).where).toEqual(where);
    });
  });

  describe('releaseGameBringsInTx() — sortie d’une soirée (Story 49.3)', () => {
    const today = new Date().toISOString().substring(0, 10);

    it("sans apport : rien n'est verrouillé ni supprimé", async () => {
      prisma.tx.eventGameBring.findMany.mockResolvedValue([]);

      await expect(
        service.releaseGameBringsInTx(prisma.tx as never, { eventId: 'e1' }, 'u1'),
      ).resolves.toBe(0);

      expect(prisma.tx.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.tx.eventGameBring.deleteMany).not.toHaveBeenCalled();
    });

    it('verrouille les soirées concernées (triées, sans doublon) PUIS supprime les apports de la personne, sans rien émettre', async () => {
      const ordre: string[] = [];
      prisma.tx.eventGameBring.findMany.mockResolvedValue([
        { eventId: 'evB' },
        { eventId: 'evA' },
        { eventId: 'evB' },
      ]);
      prisma.tx.$queryRaw.mockImplementation((s: TemplateStringsArray, id: string) => {
        expect(s.join('?')).toContain('FROM "Event"');
        expect(s.join('?')).toContain('FOR UPDATE');
        ordre.push(`verrou:${id}`);
        return Promise.resolve([{ id }]);
      });
      prisma.tx.eventGameBring.deleteMany.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve({ count: 3 });
      });

      await expect(
        service.releaseGameBringsInTx(
          prisma.tx as never,
          { partieId: 'p1', upcomingOnly: true },
          'u1',
        ),
      ).resolves.toBe(3);

      expect(ordre).toEqual(['verrou:evA', 'verrou:evB', 'delete']);
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('portée { eventId } : cette soirée seulement, sans filtre de date', async () => {
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }]);

      await service.releaseGameBringsInTx(prisma.tx as never, { eventId: 'e1' }, 'u1');

      const where = callArg<{ where: unknown }>(prisma.tx.eventGameBring.deleteMany).where;
      expect(where).toEqual({ userId: 'u1', eventId: 'e1' });
      // La même condition sert à choisir les verrous et à supprimer.
      expect(callArg<{ where: unknown }>(prisma.tx.eventGameBring.findMany).where).toEqual(where);
    });

    it("portée { partieId, upcomingOnly } : les soirées de la partie dont la séance est sans date, ou d'aujourd'hui ou plus tard (jour UTC)", async () => {
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }]);

      await service.releaseGameBringsInTx(
        prisma.tx as never,
        { partieId: 'p1', upcomingOnly: true },
        'u1',
      );

      const where = callArg<{ where: unknown }>(prisma.tx.eventGameBring.deleteMany).where;
      expect(where).toEqual({
        userId: 'u1',
        event: {
          partieId: 'p1',
          seances: {
            some: {
              OR: [
                { startDate: null },
                { endDate: { gte: new Date(`${today}T00:00:00.000Z`) } },
                { endDate: null, startDate: { gte: new Date(`${today}T00:00:00.000Z`) } },
              ],
            },
          },
        },
      });
      expect(callArg<{ where: unknown }>(prisma.tx.eventGameBring.findMany).where).toEqual(where);
    });
  });

  describe('releaseGameBringsInTx() — Envies de la personne (Story 49.5)', () => {
    it('sans apport mais avec des Envies : les soirées sont verrouillées (triées) et SES Envies supprimées', async () => {
      const ordre: string[] = [];
      prisma.tx.eventGameBring.findMany.mockResolvedValue([]);
      prisma.tx.eventGameEnvy.findMany.mockImplementation((args: { distinct?: string[] }) =>
        Promise.resolve(args.distinct ? [] : [{ eventId: 'evB' }, { eventId: 'evA' }]),
      );
      prisma.tx.$queryRaw.mockImplementation((_s: TemplateStringsArray, id: string) => {
        ordre.push(`verrou:${id}`);
        return Promise.resolve([{ id }]);
      });
      prisma.tx.eventGameEnvy.deleteMany.mockImplementation(() => {
        ordre.push('envies');
        return Promise.resolve({ count: 2 });
      });

      await expect(
        service.releaseGameBringsInTx(prisma.tx as never, { eventId: 'e1' }, 'u1'),
      ).resolves.toBe(0);

      expect(ordre).toEqual(['verrou:evA', 'verrou:evB', 'envies']);
      expect(callArg<{ where: unknown }>(prisma.tx.eventGameEnvy.deleteMany).where).toEqual({
        userId: 'u1',
        eventId: 'e1',
      });
    });

    it('les soirées verrouillées sont celles des apports OU des Envies, sans doublon', async () => {
      const locked: string[] = [];
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'evA' }]);
      prisma.tx.eventGameEnvy.findMany.mockImplementation((args: { distinct?: string[] }) =>
        Promise.resolve(args.distinct ? [] : [{ eventId: 'evA' }, { eventId: 'evC' }]),
      );
      prisma.tx.$queryRaw.mockImplementation((_s: TemplateStringsArray, id: string) => {
        locked.push(id);
        return Promise.resolve([{ id }]);
      });

      await service.releaseGameBringsInTx(
        prisma.tx as never,
        { partieId: 'p1', upcomingOnly: true },
        'u1',
      );

      expect(locked).toEqual(['evA', 'evC']);
      const envyWhere = callArg<{ where: unknown }>(prisma.tx.eventGameEnvy.deleteMany).where;
      expect(envyWhere).toEqual(
        callArg<{ where: unknown }>(prisma.tx.eventGameBring.deleteMany).where,
      );
    });

    it('purge ensuite les Envies des autres dont le nom n’est plus tenu par personne, soirée par soirée', async () => {
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ eventId: 'e1' }]);
      prisma.tx.eventGameEnvy.findMany.mockImplementation((args: { distinct?: string[] }) =>
        Promise.resolve(args.distinct ? [{ nameKey: 'azul' }] : []),
      );
      prisma.tx.event.findUnique.mockResolvedValue({ ownerId: 'hote' });

      await service.releaseGameBringsInTx(prisma.tx as never, { eventId: 'e1' }, 'u1');

      // Plus aucune source de « azul » : ses Envies sont supprimées (après celles de la personne).
      expect(prisma.tx.eventGameEnvy.deleteMany).toHaveBeenLastCalledWith({
        where: { eventId: 'e1', nameKey: { in: ['azul'] } },
      });
    });
  });

  describe('releaseOrphanEnviesInTx() et onSiteNameKeysInTx() (Story 49.5)', () => {
    const envied = (...keys: string[]) =>
      prisma.tx.eventGameEnvy.findMany.mockResolvedValue(keys.map((nameKey) => ({ nameKey })));

    it('aucune Envie : rien n’est lu d’autre, rien n’est supprimé', async () => {
      envied();

      await expect(service.releaseOrphanEnviesInTx(prisma.tx as never, 'e1')).resolves.toBe(0);

      expect(boardGames.nameKeysOfOwner).not.toHaveBeenCalled();
      expect(prisma.tx.eventGameEnvy.deleteMany).not.toHaveBeenCalled();
    });

    it('supprime les Envies d’un nom que plus aucune source ne porte, garde les autres', async () => {
      envied('azul', 'go');
      prisma.tx.event.findUnique.mockResolvedValue({ ownerId: 'hote' });
      boardGames.nameKeysOfOwner.mockResolvedValue([{ id: 'g2', nameKey: 'go' }]);
      prisma.tx.eventGameEnvy.deleteMany.mockResolvedValue({ count: 3 });

      await expect(service.releaseOrphanEnviesInTx(prisma.tx as never, 'e1')).resolves.toBe(3);

      expect(prisma.tx.eventGameEnvy.deleteMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', nameKey: { in: ['azul'] } },
      });
    });

    it('un nom écarté chez l’hôte mais encore apporté par un invité garde ses Envies', async () => {
      envied('azul');
      prisma.tx.event.findUnique.mockResolvedValue({ ownerId: 'hote' });
      boardGames.nameKeysOfOwner.mockResolvedValue([{ id: 'g1', nameKey: 'azul' }]);
      prisma.tx.eventGameExcluded.findMany.mockResolvedValue([{ boardGameId: 'g1' }]);
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ boardGameId: 'g9' }]);
      boardGames.nameKeysByIds.mockResolvedValue(['azul']);

      await expect(service.releaseOrphanEnviesInTx(prisma.tx as never, 'e1')).resolves.toBe(0);

      expect(boardGames.nameKeysByIds).toHaveBeenCalledWith(['g9'], prisma.tx);
      expect(prisma.tx.eventGameEnvy.deleteMany).not.toHaveBeenCalled();
    });

    it('lit les noms par BoardGamesService, sur le client de la transaction', async () => {
      envied('azul');
      prisma.tx.event.findUnique.mockResolvedValue({ ownerId: 'hote' });

      await service.releaseOrphanEnviesInTx(prisma.tx as never, 'e1');

      expect(boardGames.nameKeysOfOwner).toHaveBeenCalledWith('hote', prisma.tx);
    });

    it('sans hôte (compte supprimé) : pas de jeux d’hôte, les apports restent sur place', async () => {
      prisma.tx.eventGameBring.findMany.mockResolvedValue([{ boardGameId: 'g9' }]);
      boardGames.nameKeysByIds.mockResolvedValue(['catane']);

      const keys = await service.onSiteNameKeysInTx(prisma.tx as never, 'e1', null);

      expect(boardGames.nameKeysOfOwner).not.toHaveBeenCalled();
      expect([...keys]).toEqual(['catane']);
    });
  });

  describe('voteReminderRecipients() (Story 40.7)', () => {
    const u = (id: string) => ({ id, email: `${id}@example.com` });
    const poll = (over: {
      votes?: string[];
      inscriptionMax?: number | null;
      inscriptions?: { status: 'RESERVED' | 'CONFIRMED'; user: { id: string; email: string } }[];
      owner?: { id: string; email: string } | null;
    }) => ({
      votes: (over.votes ?? []).map((userId) => ({ userId })),
      seance: {
        inscriptionMax: over.inscriptionMax ?? null,
        inscriptions: over.inscriptions ?? [],
        event: {
          owner: over.owner === undefined ? u('hote') : over.owner,
          // Un compte supprimé n'a plus de ligne de membre : l'hôte disparu n'est plus dans la liste.
          partie: {
            memberships: (over.owner === null ? ['a', 'b', 'c'] : ['hote', 'a', 'b', 'c']).map(
              (id) => ({
                user: u(id),
              }),
            ),
          },
        },
      },
    });
    const ids = (list: { id: string }[]) => list.map((r) => r.id);

    it('« Tous les membres » : les membres qui n’ont aucune réponse — l’hôte d’abord, les votants exclus', () => {
      expect(ids(service.voteReminderRecipients(poll({ votes: ['a'] })))).toEqual([
        'hote',
        'b',
        'c',
      ]);
    });

    it('places limitées : l’hôte et les inscrits CONFIRMÉS sans réponse — jamais une place réservée ni un autre membre', () => {
      const recipients = service.voteReminderRecipients(
        poll({
          inscriptionMax: 4,
          votes: ['hote'],
          inscriptions: [
            { status: 'CONFIRMED', user: u('a') },
            { status: 'RESERVED', user: u('b') },
          ],
        }),
      );

      expect(ids(recipients)).toEqual(['a']);
    });

    it('tout le monde a voté → aucun destinataire', () => {
      expect(ids(service.voteReminderRecipients(poll({ votes: ['hote', 'a', 'b', 'c'] })))).toEqual(
        [],
      );
    });

    it('hôte disparu : les membres restent, sans plantage ; un inscrit aussi membre n’est listé qu’une fois', () => {
      const recipients = service.voteReminderRecipients(
        poll({ owner: null, inscriptions: [{ status: 'CONFIRMED', user: u('a') }] }),
      );

      expect(ids(recipients)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('reminderRecipients() (Story 40.3)', () => {
    const u = (id: string) => ({ id, email: `${id}@example.com` });
    const partie = (over: Record<string, unknown> = {}) => ({
      kind: 'CAMPAGNE_EPISODIQUE' as const,
      gameSystemId: 'ralliement',
      owner: u('admin'),
      memberships: [u('admin'), u('a'), u('b'), u('c')].map((user) => ({ user })),
      ...over,
    });
    const ids = (list: { id: string }[]) => list.map((r) => r.id);

    it('groupe : l’hôte puis les inscrits — ni l’administrateur ni les autres membres', () => {
      const recipients = service.reminderRecipients({
        inscriptions: [{ user: u('b') }, { user: u('c') }],
        event: { owner: u('a'), partie: partie() },
      });

      expect(ids(recipients)).toEqual(['a', 'b', 'c']);
    });

    it('groupe : un hôte aussi inscrit n’est listé qu’une fois ; hôte disparu → les inscrits seuls', () => {
      expect(
        ids(
          service.reminderRecipients({
            inscriptions: [{ user: u('a') }, { user: u('b') }],
            event: { owner: u('a'), partie: partie() },
          }),
        ),
      ).toEqual(['a', 'b']);
      expect(
        ids(
          service.reminderRecipients({
            inscriptions: [{ user: u('b') }],
            event: { owner: null, partie: partie() },
          }),
        ),
      ).toEqual(['b']);
    });

    it('groupe : une place seulement RÉSERVÉE ne reçoit pas le rappel (Story 40.4)', () => {
      const recipients = service.reminderRecipients({
        inscriptions: [
          { status: 'CONFIRMED', user: u('b') },
          { status: 'RESERVED', user: u('c') },
        ],
        event: { owner: u('a'), partie: partie() },
      });

      expect(ids(recipients)).toEqual(['a', 'b']);
    });

    it('groupe sans aucun inscrit : l’hôte seul', () => {
      expect(
        ids(
          service.reminderRecipients({
            inscriptions: [],
            event: { owner: u('a'), partie: partie() },
          }),
        ),
      ).toEqual(['a']);
    });

    it('JDR : le propriétaire et les membres, dédoublonnés ; les inscrits ne changent rien', () => {
      const recipients = service.reminderRecipients({
        inscriptions: [{ user: u('b') }],
        event: {
          owner: u('a'),
          partie: partie({ kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ryuutama' }),
        },
      });

      expect(ids(recipients)).toEqual(['admin', 'a', 'b', 'c']);
    });

    it('rencontre isolée de ralliement : garde les destinataires historiques (propriétaire + membres)', () => {
      const recipients = service.reminderRecipients({
        inscriptions: [],
        event: { owner: u('a'), partie: partie({ kind: 'ONE_SHOT' }) },
      });

      expect(ids(recipients)).toEqual(['admin', 'a', 'b', 'c']);
    });

    it('JDR, brouillon caché : le propriétaire seul (anti-spoil)', () => {
      const recipients = service.reminderRecipients({
        event: {
          scenario: { status: 'BROUILLON' },
          partie: partie({ kind: 'CAMPAGNE_LINEAIRE', gameSystemId: 'ryuutama' }),
        },
      });

      expect(ids(recipients)).toEqual(['admin']);
    });
  });

  describe('recalculateNextSession() (Story 8.8, Décision 2 ; seul écrivain de nextSession, Story 37.8)', () => {
    const NOW = new Date('2026-07-14T12:00:00.000Z');
    const FUTURE_NEAR = new Date('2026-08-01T00:00:00.000Z');
    const FUTURE_FAR = new Date('2026-09-01T00:00:00.000Z');
    const PAST = new Date('2026-06-01T00:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("n'émet PAS d'événement temps réel directement (Story 18.1) — couvert par ses appelants deleteSeance()/resetSeanceDate()", async () => {
      prisma.seance.findMany.mockResolvedValue([]);

      await service.recalculateNextSession('p1');

      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('plusieurs séances actives → Partie.nextSessionDate reflète la plus proche dans le futur', async () => {
      prisma.seance.findMany.mockResolvedValue([
        {
          id: 's1',
          startDate: FUTURE_FAR,
          startSlot: 'MORNING',
        },
        {
          id: 's2',
          startDate: FUTURE_NEAR,
          startSlot: 'EVENING',
        },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          nextSessionDate: FUTURE_NEAR,
          nextSessionSlot: 'EVENING',
          nextSessionEndDate: FUTURE_NEAR,
          nextSessionEndSlot: 'EVENING',
        },
      });
    });

    it("séance datée d'aujourd'hui (même jour que NOW, minuit) → toujours retenue comme prochaine séance", async () => {
      const TODAY = new Date('2026-07-14T00:00:00.000Z');
      prisma.seance.findMany.mockResolvedValue([
        {
          id: 's1',
          startDate: TODAY,
          startSlot: 'MORNING',
        },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          nextSessionDate: TODAY,
          nextSessionSlot: 'MORNING',
          nextSessionEndDate: TODAY,
          nextSessionEndSlot: 'MORNING',
        },
      });
    });

    it('date passée ignorée — seules les dates futures comptent', async () => {
      prisma.seance.findMany.mockResolvedValue([
        {
          id: 's1',
          startDate: PAST,
          startSlot: 'MORNING',
        },
        {
          id: 's2',
          startDate: FUTURE_FAR,
          startSlot: 'AFTERNOON',
        },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          nextSessionDate: FUTURE_FAR,
          nextSessionSlot: 'AFTERNOON',
          nextSessionEndDate: FUTURE_FAR,
          nextSessionEndSlot: 'AFTERNOON',
        },
      });
    });

    it('plage sans créneau (date posée hors vote) → utilisée, slot null', async () => {
      prisma.seance.findMany.mockResolvedValue([
        { id: 's1', startDate: FUTURE_NEAR, startSlot: null },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          nextSessionDate: FUTURE_NEAR,
          nextSessionSlot: null,
          nextSessionEndDate: FUTURE_NEAR,
          nextSessionEndSlot: null,
        },
      });
    });

    it('aucune date future → nextSessionDate/nextSessionSlot remis à null', async () => {
      prisma.seance.findMany.mockResolvedValue([
        { id: 's1', startDate: null, startSlot: null },
        { id: 's2', startDate: PAST, startSlot: null },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          nextSessionDate: null,
          nextSessionSlot: null,
          nextSessionEndDate: null,
          nextSessionEndSlot: null,
        },
      });
    });

    it('le recalcul de la prochaine séance ne touche jamais aux rappels (Story 37.9)', async () => {
      prisma.seance.findMany.mockResolvedValue([
        { id: 's1', startDate: FUTURE_NEAR, startSlot: 'EVENING' },
      ]);

      await service.recalculateNextSession('p1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: FUTURE_NEAR, nextSessionSlot: 'EVENING', nextSessionEndDate: FUTURE_NEAR, nextSessionEndSlot: 'EVENING' },
      });
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('recalculateNextSessionInTx() verrouille la ligne Partie AVANT de lire les séances (Story 37.8, concurrence)', async () => {
      prisma.tx.seance.findMany.mockResolvedValue([]);

      await service.recalculateNextSessionInTx(
        prisma.tx as unknown as Prisma.TransactionClient,
        'p1',
      );

      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = mockCalls<[readonly string[], ...unknown[]]>(
        prisma.tx.$queryRaw,
      )[0];
      expect(strings.join('?')).toContain('FROM "Partie"');
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(values).toEqual(['p1']);
      expect(prisma.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.tx.seance.findMany.mock.invocationCallOrder[0],
      );
    });

    it('recalculateNextSessionInTx() écrit dans la transaction fournie, jamais via le client global (Story 37.8)', async () => {
      prisma.tx.seance.findMany.mockResolvedValue([
        { startDate: FUTURE_NEAR, startSlot: 'EVENING' },
      ]);

      await service.recalculateNextSessionInTx(
        prisma.tx as unknown as Prisma.TransactionClient,
        'p1',
      );

      expect(prisma.tx.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: FUTURE_NEAR, nextSessionSlot: 'EVENING', nextSessionEndDate: FUTURE_NEAR, nextSessionEndSlot: 'EVENING' },
      });
      expect(prisma.seance.findMany).not.toHaveBeenCalled();
      expect(prisma.partie.update).not.toHaveBeenCalled();
      expect(realtime.emit).not.toHaveBeenCalled();
    });
  });

  // ─── Plage de plusieurs créneaux (Story 47.2, AD-14) ──────────────────────────────────────

  describe('plage de plusieurs créneaux (Story 47.2)', () => {
    const SAT = new Date('2026-11-14T00:00:00.000Z');
    const SUN = new Date('2026-11-15T00:00:00.000Z');
    const DAY = 86_400_000;
    const midnight = (offsetDays: number) =>
      new Date(new Date(Date.now() + offsetDays * DAY).toISOString().substring(0, 10));
    const longSeance = (over: Record<string, unknown> = {}) => ({
      id: 'sL',
      startDate: SAT,
      startSlot: 'EVENING',
      endDate: SUN,
      endSlot: 'AFTERNOON',
      durationSlots: 3,
      inscriptions: [],
      event: { partieId: 'B', ownerId: null },
      ...over,
    });

    describe('occupiedSpansOf — la plage est dépliée créneau par créneau', () => {
      beforeEach(() => {
        prisma.partie.findMany.mockResolvedValue([
          { id: 'B', kind: 'CAMPAGNE_LINEAIRE', ownerId: 'mjB', memberships: [{ userId: 'u1' }] },
        ]);
      });

      it('3 créneaux depuis un soir : le soir, puis le matin et l’après-midi du lendemain, pour chaque participant', async () => {
        prisma.seance.findMany.mockResolvedValue([longSeance()]);

        const map = await service.occupiedSpansOf(['u1', 'mjB']);

        const expected = [
          { date: SAT, slot: 'EVENING' },
          { date: SUN, slot: 'MORNING' },
          { date: SUN, slot: 'AFTERNOON' },
        ];
        expect(map.get('u1')).toEqual(expected);
        expect(map.get('mjB')).toEqual(expected);
        // Chaque participant a ses propres objets.
        expect(map.get('u1')![0]).not.toBe(map.get('mjB')![0]);
      });

      it('un seul créneau, une journée entière ou une date sans créneau : une seule entrée, comme avant', async () => {
        prisma.seance.findMany.mockResolvedValue([
          longSeance({ id: 'a', durationSlots: 1, endDate: SAT, endSlot: 'EVENING' }),
          longSeance({ id: 'b', startSlot: 'FULL_DAY', durationSlots: 1 }),
          longSeance({ id: 'c', startSlot: null, durationSlots: 1 }),
        ]);

        const map = await service.occupiedSpansOf(['u1']);

        expect(map.get('u1')).toEqual([
          { date: SAT, slot: 'EVENING' },
          { date: SAT, slot: 'FULL_DAY' },
          { date: SAT, slot: 'FULL_DAY' },
        ]);
      });

      it('deux rendez-vous qui se chevauchent occupent tous deux leurs créneaux — rien n’est refusé', async () => {
        prisma.seance.findMany.mockResolvedValue([
          longSeance(),
          longSeance({ id: 'sM', startDate: SUN, startSlot: 'MORNING', durationSlots: 2 }),
        ]);

        const map = await service.occupiedSpansOf(['u1']);

        expect(map.get('u1')).toHaveLength(5);
        expect(
          map.get('u1')!.filter((s) => s.date.getTime() === SUN.getTime() && s.slot === 'MORNING'),
        ).toHaveLength(2);
      });

      it('une plage qui traverse un changement de mois et d’année', async () => {
        prisma.seance.findMany.mockResolvedValue([
          longSeance({ startDate: new Date('2026-12-31T00:00:00Z'), durationSlots: 2 }),
        ]);

        const map = await service.occupiedSpansOf(['u1']);

        expect(map.get('u1')).toEqual([
          { date: new Date('2026-12-31T00:00:00Z'), slot: 'EVENING' },
          { date: new Date('2027-01-01T00:00:00Z'), slot: 'MORNING' },
        ]);
      });
    });

    describe('ownEventsOf — filtre de période par chevauchement', () => {
      const row = (over: Record<string, unknown> = {}) => ({
        id: 'sL',
        eventId: 'ev1',
        startDate: new Date('2026-10-31T00:00:00Z'),
        startSlot: 'EVENING',
        endDate: new Date('2026-11-01T00:00:00Z'),
        endSlot: 'MORNING',
        durationSlots: 2,
        inscriptions: [],
        inscriptionMin: null,
        inscriptionMax: null,
        event: { partieId: 'A', title: 'Week-end', ownerId: null },
        ...over,
      });
      const window = (from: string, to: string) => ({
        fromMs: Date.parse(`${from}T00:00:00.000Z`),
        toMs: Date.parse(`${to}T23:59:59.999Z`),
      });
      const roles = () => jest.fn().mockResolvedValue(new Map([['A', 'mj']]));

      beforeEach(() => {
        prisma.partie.findMany.mockResolvedValue([{ id: 'A', name: 'P', kind: 'ONE_SHOT' }]);
        prisma.seance.findMany.mockResolvedValue([row()]);
      });

      it('une séance du 31 au 1ᵉʳ apparaît dans octobre ET dans novembre, avec sa fin', async () => {
        const october = await service.ownEventsOf('me', roles(), window('2026-10-01', '2026-10-31'));
        const november = await service.ownEventsOf('me', roles(), window('2026-11-01', '2026-11-30'));

        expect(october.seances).toHaveLength(1);
        expect(november.seances).toHaveLength(1);
        expect(november.seances[0]).toMatchObject({
          date: '2026-10-31',
          slot: 'EVENING',
          endDate: '2026-11-01',
          endSlot: 'MORNING',
        });
      });

      it('hors de la plage, ni avant son début ni après sa fin', async () => {
        const before = await service.ownEventsOf('me', roles(), window('2026-10-01', '2026-10-30'));
        const after = await service.ownEventsOf('me', roles(), window('2026-11-02', '2026-11-30'));

        expect(before.seances).toHaveLength(0);
        expect(after.seances).toHaveLength(0);
      });
    });

    describe('« passée » = la fin est avant aujourd’hui', () => {
      const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });
      const INPUT = (date: Date) => ({
        title: 'Week-end',
        seance: {
          date,
          slot: 'EVENING' as const,
          lieu: null,
          heureRdv: null,
          notePratique: null,
          capacity: null,
        },
      });
      const existing = (seance: Record<string, unknown>) =>
        prisma.tx.event.findUnique.mockResolvedValue({
          ownerId: 'hote',
          cancelledAt: null,
          seances: [{ id: 'se1', pollId: null, durationSlots: 3, startSlot: 'EVENING', ...seance }],
        });

      it('modification : une plage commencée hier et finissant demain reste modifiable', async () => {
        existing({ startDate: midnight(-1), endDate: midnight(1), endSlot: 'AFTERNOON' });

        await service.updateHosted(GRANT_E1, 'e1', INPUT(midnight(-1)));

        expect(prisma.tx.seance.update).toHaveBeenCalled();
      });

      it('modification : une plage finie hier est refusée', async () => {
        existing({ startDate: midnight(-3), endDate: midnight(-1), endSlot: 'AFTERNOON' });

        await expect(service.updateHosted(GRANT_E1, 'e1', INPUT(midnight(-3)))).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('annulation : commencée hier, finissant demain → annulable ; finie hier → refusée', async () => {
        const closePoll = jest.fn();
        existing({ startDate: midnight(-1), endDate: midnight(1) });
        await service.cancelHosted(GRANT_E1, 'e1', closePoll);
        expect(prisma.tx.event.update).toHaveBeenCalledTimes(1);

        prisma.tx.event.update.mockClear();
        existing({ startDate: midnight(-3), endDate: midnight(-1) });
        await expect(service.cancelHosted(GRANT_E1, 'e1', closePoll)).rejects.toThrow(
          'passé',
        );
        expect(prisma.tx.event.update).not.toHaveBeenCalled();
      });

      it('inscription : une plage commencée reste ouverte, une plage finie est figée', async () => {
        const run = async (seance: Record<string, unknown>) => {
          prisma.tx.seance.findUnique.mockReset();
          prisma.tx.seance.findUnique
            .mockResolvedValueOnce({ eventId: 'ev1' })
            .mockResolvedValueOnce({
              inscriptionMax: null,
              event: { ownerId: 'hote', cancelledAt: null },
              ...seance,
            });
          await service.inscrireConjonction(GRANT_P1, 'se1', 'membre');
        };

        await expect(
          run({ startDate: midnight(-1), endDate: midnight(1) }),
        ).resolves.toBeUndefined();
        await expect(run({ startDate: midnight(-3), endDate: midnight(-1) })).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('prochaine séance — une plage commencée en fait partie jusqu’à sa fin', () => {
      it('commencée hier, finissant demain : retenue, avec sa fin', async () => {
        const start = midnight(-1);
        const end = midnight(1);
        prisma.seance.findMany.mockResolvedValue([
          { startDate: start, startSlot: 'EVENING', endDate: end, endSlot: 'AFTERNOON' },
        ]);

        await service.recalculateNextSession('p1');

        expect(prisma.partie.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: {
            nextSessionDate: start,
            nextSessionSlot: 'EVENING',
            nextSessionEndDate: end,
            nextSessionEndSlot: 'AFTERNOON',
          },
        });
      });

      it('finie hier : ignorée', async () => {
        prisma.seance.findMany.mockResolvedValue([
          {
            startDate: midnight(-3),
            startSlot: 'EVENING',
            endDate: midnight(-1),
            endSlot: 'AFTERNOON',
          },
        ]);

        await service.recalculateNextSession('p1');

        expect(prisma.partie.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: {
            nextSessionDate: null,
            nextSessionSlot: null,
            nextSessionEndDate: null,
            nextSessionEndSlot: null,
          },
        });
      });

      it('entre deux plages à venir, la plus proche par son début', async () => {
        const near = midnight(2);
        prisma.seance.findMany.mockResolvedValue([
          { startDate: midnight(9), startSlot: 'MORNING', endDate: midnight(10), endSlot: 'MORNING' },
          { startDate: near, startSlot: 'EVENING', endDate: midnight(3), endSlot: 'AFTERNOON' },
        ]);

        await service.recalculateNextSession('p1');

        expect(prisma.partie.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: expect.objectContaining({
            nextSessionDate: near,
            nextSessionEndDate: midnight(3),
            nextSessionEndSlot: 'AFTERNOON',
          }),
        });
      });
    });

    describe('listCards et notices portent la fin', () => {
      it('la carte de conjonction expose la fin de la plage', async () => {
        prisma.event.findMany.mockResolvedValue([
          {
            id: 'e1',
            title: 'Week-end',
            ownerId: 'hote',
            cancelledAt: null,
            owner: { displayName: 'Léa' },
            seances: [
              {
                id: 'se1',
                startDate: SAT,
                startSlot: 'EVENING',
                endDate: SUN,
                endSlot: 'AFTERNOON',
                lieu: null,
                heureRdv: null,
                notePratique: null,
                inscriptionMax: null,
                pollId: null,
                durationSlots: 3,
              },
            ],
          },
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.seance).toMatchObject({
          date: '2026-11-14',
          slot: 'EVENING',
          endDate: '2026-11-15',
          endSlot: 'AFTERNOON',
          durationSlots: 3,
        });
      });
    });
  });

  // ─── Ports du calendrier (Story 37.8) ───────────────────────────────────────────────────────

  describe('occupiedSpansOf() — OccupiedSpansPort (AD-9)', () => {
    const seanceB = (over: Record<string, unknown> = {}) => ({
      id: 'sB',
      startDate: new Date('2026-09-10T00:00:00Z'),
      startSlot: 'EVENING',
      inscriptions: [],
      event: { partieId: 'B' },
      ...over,
    });

    it('renvoie une entrée vide par utilisateur quand aucune partie n’est trouvée', async () => {
      const map = await service.occupiedSpansOf(['u1', 'u2']);

      expect([...map.keys()]).toEqual(['u1', 'u2']);
      expect(map.get('u1')).toEqual([]);
      expect(prisma.seance.findMany).not.toHaveBeenCalled();
    });

    it('un membre d’une partie ONE_SHOT est occupé sur la plage de sa séance datée — { date, slot } SEULEMENT', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'B', kind: 'ONE_SHOT', ownerId: 'mjB', memberships: [{ userId: 'u1' }] },
      ]);
      prisma.seance.findMany.mockResolvedValue([seanceB()]);

      const map = await service.occupiedSpansOf(['u1']);

      expect(map.get('u1')).toEqual([{ date: new Date('2026-09-10T00:00:00Z'), slot: 'EVENING' }]);
      // Aucun titre, aucun identifiant de partie, aucune identité : la forme l'interdit.
      expect(Object.keys(map.get('u1')![0]).sort()).toEqual(['date', 'slot']);
    });

    it('créneau de début vide → FULL_DAY ; séance sans date ignorée', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'B', kind: 'CAMPAGNE_LINEAIRE', ownerId: 'mjB', memberships: [{ userId: 'u1' }] },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({ startSlot: null }),
        seanceB({ id: 'sans-date', startDate: null }),
      ]);

      const map = await service.occupiedSpansOf(['u1']);

      expect(map.get('u1')).toEqual([{ date: new Date('2026-09-10T00:00:00Z'), slot: 'FULL_DAY' }]);
    });

    it('campagne épisodique : seuls le propriétaire et les inscrits à CETTE séance sont occupés', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'CAMPAGNE_EPISODIQUE',
          ownerId: 'mjB',
          memberships: [{ userId: 'inscrit' }, { userId: 'absent' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({ inscriptions: [{ userId: 'inscrit' }] }),
      ]);

      const map = await service.occupiedSpansOf(['mjB', 'inscrit', 'absent']);

      expect(map.get('mjB')).toHaveLength(1);
      expect(map.get('inscrit')).toHaveLength(1);
      expect(map.get('absent')).toEqual([]);
    });

    it('propriétaire absent (compte supprimé) : seuls les membres sont concernés ; jamais d’utilisateur non demandé', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'ONE_SHOT',
          ownerId: null,
          memberships: [{ userId: 'u1' }, { userId: 'x' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([seanceB()]);

      const map = await service.occupiedSpansOf(['u1']);

      expect([...map.keys()]).toEqual(['u1']);
      expect(map.get('u1')).toHaveLength(1);
    });

    it('rencontre isolée de ralliement (ONE_SHOT) datée : règle historique inchangée — propriétaire et tous les membres', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'ONE_SHOT',
          gameSystemId: 'ralliement',
          ownerId: 'createur',
          memberships: [{ userId: 'createur' }, { userId: 'autre' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({ event: { partieId: 'B', ownerId: 'hote-ailleurs' } }),
      ]);

      const map = await service.occupiedSpansOf(['createur', 'autre', 'hote-ailleurs']);

      expect(map.get('createur')).toHaveLength(1);
      expect(map.get('autre')).toHaveLength(1);
      expect(map.get('hote-ailleurs')).toEqual([]);
    });

    it('ralliement (Story 40.1) : l’HÔTE de l’événement et les inscrits sont occupés — ni le propriétaire de la partie ni les autres membres', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'CAMPAGNE_EPISODIQUE',
          gameSystemId: 'ralliement',
          ownerId: 'createur',
          memberships: [{ userId: 'createur' }, { userId: 'hote' }, { userId: 'autre' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({ event: { partieId: 'B', ownerId: 'hote' } }),
      ]);

      const map = await service.occupiedSpansOf(['createur', 'hote', 'autre']);

      expect(map.get('hote')).toEqual([
        { date: new Date('2026-09-10T00:00:00Z'), slot: 'EVENING' },
      ]);
      expect(map.get('createur')).toEqual([]);
      expect(map.get('autre')).toEqual([]);
    });

    it('ralliement (Story 40.4) : une place seulement RÉSERVÉE n’occupe pas le calendrier, l’inscription confirmée si', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'CAMPAGNE_EPISODIQUE',
          gameSystemId: 'ralliement',
          ownerId: 'createur',
          memberships: [{ userId: 'reservee' }, { userId: 'confirmee' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({
          event: { partieId: 'B', ownerId: 'hote' },
          inscriptions: [
            { userId: 'reservee', status: 'RESERVED' },
            { userId: 'confirmee', status: 'CONFIRMED' },
          ],
        }),
      ]);

      const map = await service.occupiedSpansOf(['reservee', 'confirmee']);

      expect(map.get('reservee')).toEqual([]);
      expect(map.get('confirmee')).toHaveLength(1);
    });

    it('ralliement : hôte disparu → seuls les inscrits sont occupés', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          id: 'B',
          kind: 'CAMPAGNE_EPISODIQUE',
          gameSystemId: 'ralliement',
          ownerId: 'createur',
          memberships: [{ userId: 'inscrit' }],
        },
      ]);
      prisma.seance.findMany.mockResolvedValue([
        seanceB({ event: { partieId: 'B', ownerId: null }, inscriptions: [{ userId: 'inscrit' }] }),
      ]);

      const map = await service.occupiedSpansOf(['createur', 'inscrit']);

      expect(map.get('inscrit')).toHaveLength(1);
      expect(map.get('createur')).toEqual([]);
    });

    it('deux requêtes au total, jamais une par utilisateur ni par partie', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'B', kind: 'ONE_SHOT', ownerId: 'mjB', memberships: [{ userId: 'u1' }] },
        { id: 'C', kind: 'ONE_SHOT', ownerId: 'mjC', memberships: [{ userId: 'u2' }] },
      ]);
      prisma.seance.findMany.mockResolvedValue([]);

      await service.occupiedSpansOf(['u1', 'u2']);

      expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('ownEventsOf() — OwnEventsPort', () => {
    const RANGE = {
      fromMs: Date.parse('2026-10-01T00:00:00.000Z'),
      toMs: Date.parse('2026-10-31T23:59:59.999Z'),
    };
    const partieA = { id: 'A', name: 'Ma Partie', kind: 'ONE_SHOT' };
    const episodique = { id: 'A', name: 'Ma Partie', kind: 'CAMPAGNE_EPISODIQUE' };
    const seance = (over: Record<string, unknown> = {}) => ({
      id: 'se1',
      eventId: 'ev1',
      startDate: new Date('2026-10-10T00:00:00Z'),
      startSlot: 'MORNING',
      inscriptions: [],
      inscriptionMin: null,
      inscriptionMax: null,
      event: { partieId: 'A', title: 'Le Donjon Oublié' },
      ...over,
    });
    const rolesOf = (role: 'mj' | 'player') => jest.fn().mockResolvedValue(new Map([['A', role]]));

    it('sans partie : rien, et aucune lecture de séances ni de rôles', async () => {
      const roles = rolesOf('mj');

      const own = await service.ownEventsOf('me', roles, RANGE);

      expect(own).toEqual({ parties: [], seances: [], inscriptionsOuvertes: [] });
      expect(prisma.seance.findMany).not.toHaveBeenCalled();
      expect(roles).not.toHaveBeenCalled();
    });

    it('rend mes parties et mes séances avec titres (mes propres parties), rôles résolus UNE fois en lot', async () => {
      prisma.partie.findMany.mockResolvedValue([partieA, { ...partieA, id: 'B' }]);
      prisma.seance.findMany.mockResolvedValue([seance()]);
      const roles = rolesOf('mj');

      const own = await service.ownEventsOf('me', roles, RANGE);

      expect(own.parties).toEqual([partieA, { ...partieA, id: 'B' }]);
      expect(own.seances).toEqual([
        {
          seanceId: 'se1',
          partieId: 'A',
          partieName: 'Ma Partie',
          scenarioId: 'ev1',
          scenarioTitle: 'Le Donjon Oublié',
          date: '2026-10-10',
          slot: 'MORNING',
          endDate: '2026-10-10',
          endSlot: 'MORNING',
          heureRdv: null,
          lieu: null,
          notePratique: null,
          compteRenduManquant: true,
        },
      ]);
      expect(roles).toHaveBeenCalledTimes(1);
      expect(roles).toHaveBeenCalledWith(['A', 'B']);
      expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
    });

    it('une séance hors de la fenêtre ou sans date n’est pas dans mes séances ; créneau vide → FULL_DAY', async () => {
      prisma.partie.findMany.mockResolvedValue([partieA]);
      prisma.seance.findMany.mockResolvedValue([
        seance({ id: 'hors', startDate: new Date('2026-12-01T00:00:00Z') }),
        seance({ id: 'sans-date', startDate: null }),
        seance({ id: 'plein', startSlot: null }),
      ]);

      const own = await service.ownEventsOf('me', rolesOf('mj'), RANGE);

      expect(own.seances.map((s) => [s.seanceId, s.slot])).toEqual([['plein', 'FULL_DAY']]);
    });

    it('épisodique : le MJ voit la séance sans inscription, un membre non inscrit ne la voit pas, un inscrit oui', async () => {
      prisma.partie.findMany.mockResolvedValue([episodique]);
      prisma.seance.findMany.mockResolvedValue([seance({ inscriptions: [{ userId: 'autre' }] })]);

      expect((await service.ownEventsOf('me', rolesOf('mj'), RANGE)).seances).toHaveLength(1);
      expect((await service.ownEventsOf('me', rolesOf('player'), RANGE)).seances).toEqual([]);

      prisma.seance.findMany.mockResolvedValue([seance({ inscriptions: [{ userId: 'me' }] })]);
      expect((await service.ownEventsOf('me', rolesOf('player'), RANGE)).seances).toHaveLength(1);
    });

    it('inscriptions ouvertes : épisodique, capacité définie, sans date — jamais filtrées par la fenêtre', async () => {
      prisma.partie.findMany.mockResolvedValue([episodique]);
      prisma.seance.findMany.mockResolvedValue([
        seance({
          id: 'ouverte',
          startDate: null,
          startSlot: null,
          inscriptionMin: null,
          inscriptionMax: 4,
          inscriptions: [{ userId: 'me' }, { userId: 'autre' }],
        }),
        seance({ id: 'datee', inscriptionMax: 4 }),
        seance({ id: 'sans-capacite', startDate: null, inscriptionMax: null }),
      ]);

      const own = await service.ownEventsOf('me', rolesOf('player'), RANGE);

      expect(own.inscriptionsOuvertes).toEqual([
        {
          seanceId: 'ouverte',
          partieId: 'A',
          partieName: 'Ma Partie',
          scenarioId: 'ev1',
          scenarioTitle: 'Le Donjon Oublié',
          inscriptionMin: 0,
          inscriptionMax: 4,
          inscritsCount: 2,
          jeSuisInscrit: true,
        },
      ]);
    });

    it('anti-spoil : un joueur ignore les séances d’un brouillon caché (hors ONE_SHOT), le MJ les voit toutes', async () => {
      prisma.partie.findMany.mockResolvedValue([episodique]);
      prisma.seance.findMany.mockResolvedValue([
        seance({
          id: 'brouillon-datee',
          inscriptions: [{ userId: 'me' }],
          event: {
            partieId: 'A',
            title: 'Secret',
            scenario: { status: 'BROUILLON' },
          },
        }),
        seance({
          id: 'brouillon-ouverte',
          startDate: null,
          startSlot: null,
          inscriptionMax: 4,
          event: { partieId: 'A', title: 'Secret', scenario: { status: 'BROUILLON' } },
        }),
        seance({
          id: 'ouvert',
          inscriptions: [{ userId: 'me' }],
          event: { partieId: 'A', title: 'Public', scenario: { status: 'A_VENIR' } },
        }),
      ]);

      const joueur = await service.ownEventsOf('me', rolesOf('player'), RANGE);
      expect(joueur.seances.map((s) => s.seanceId)).toEqual(['ouvert']);
      expect(joueur.inscriptionsOuvertes).toEqual([]);

      const mj = await service.ownEventsOf('me', rolesOf('mj'), RANGE);
      expect(mj.seances.map((s) => s.seanceId)).toEqual(['brouillon-datee', 'ouvert']);
      expect(mj.inscriptionsOuvertes.map((s) => s.seanceId)).toEqual(['brouillon-ouverte']);
    });

    it('anti-spoil, échec FERMÉ : un rôle inconnu (absent de la table des rôles) est traité comme un joueur', async () => {
      prisma.partie.findMany.mockResolvedValue([episodique]);
      prisma.seance.findMany.mockResolvedValue([
        seance({
          inscriptions: [{ userId: 'me' }],
          event: { partieId: 'A', title: 'Secret', scenario: { status: 'BROUILLON' } },
        }),
      ]);

      const own = await service.ownEventsOf('me', jest.fn().mockResolvedValue(new Map()), RANGE);

      expect(own.seances).toEqual([]);
    });

    it('anti-spoil : le brouillon d’un ONE_SHOT reste dans le calendrier du joueur (exemption)', async () => {
      prisma.partie.findMany.mockResolvedValue([partieA]);
      prisma.seance.findMany.mockResolvedValue([
        seance({
          event: { partieId: 'A', title: 'One-shot', scenario: { status: 'BROUILLON' } },
        }),
      ]);

      const own = await service.ownEventsOf('me', rolesOf('player'), RANGE);

      expect(own.seances.map((s) => s.seanceId)).toEqual(['se1']);
    });

    it('rencontre isolée de ralliement (ONE_SHOT) datée : règle historique — tout membre la voit, hôte ou non', async () => {
      prisma.partie.findMany.mockResolvedValue([{ ...partieA, gameSystemId: 'ralliement' }]);
      prisma.seance.findMany.mockResolvedValue([
        seance({ event: { partieId: 'A', title: 'Soirée', ownerId: 'quelquun', scenario: null } }),
      ]);
      const membre = jest.fn().mockResolvedValue(new Map([['A', 'member']]));

      const own = await service.ownEventsOf('me', membre, RANGE);

      expect(own.seances.map((s) => s.seanceId)).toEqual(['se1']);
    });

    it('ralliement (Story 40.1) : l’hôte voit son événement, un membre non inscrit non ; la sortie garde sa forme', async () => {
      const groupe = { ...episodique, gameSystemId: 'ralliement' };
      prisma.partie.findMany.mockResolvedValue([groupe]);
      prisma.seance.findMany.mockResolvedValue([
        seance({ event: { partieId: 'A', title: 'Catane', ownerId: 'me', scenario: null } }),
      ]);
      // Le rôle de partie ne décide pas : un simple membre hôte voit son événement.
      const roles = jest.fn().mockResolvedValue(new Map([['A', 'member']]));

      const own = await service.ownEventsOf('me', roles, RANGE);

      expect(own.parties).toEqual([episodique]);
      expect(own.seances.map((s) => [s.seanceId, s.scenarioTitle])).toEqual([['se1', 'Catane']]);

      const admin = jest.fn().mockResolvedValue(new Map([['A', 'admin']]));
      expect((await service.ownEventsOf('autre', admin, RANGE)).seances).toEqual([]);
    });

    it('ralliement (Story 40.4) : une place seulement RÉSERVÉE n’est pas dans mes séances, une inscription confirmée si', async () => {
      const groupe = { ...episodique, gameSystemId: 'ralliement' };
      prisma.partie.findMany.mockResolvedValue([groupe]);
      const roles = jest.fn().mockResolvedValue(new Map([['A', 'member']]));
      const dated = (status: string) =>
        seance({
          event: { partieId: 'A', title: 'Catane', ownerId: 'hote', scenario: null },
          inscriptions: [{ userId: 'me', status }],
        });

      prisma.seance.findMany.mockResolvedValue([dated('RESERVED')]);
      expect((await service.ownEventsOf('me', roles, RANGE)).seances).toEqual([]);

      prisma.seance.findMany.mockResolvedValue([dated('CONFIRMED')]);
      expect((await service.ownEventsOf('me', roles, RANGE)).seances).toHaveLength(1);
    });

    it('inscriptions ouvertes : une partie non épisodique n’en a jamais', async () => {
      prisma.partie.findMany.mockResolvedValue([partieA]);
      prisma.seance.findMany.mockResolvedValue([
        seance({ startDate: null, startSlot: null, inscriptionMax: 4 }),
      ]);

      const own = await service.ownEventsOf('me', rolesOf('mj'), RANGE);

      expect(own.inscriptionsOuvertes).toEqual([]);
    });
  });

  // ─── Sondage de dates d'une conjonction (Story 40.5) ─────────────────────────────────────────
  describe('conjonction à sondage de dates (Story 40.5)', () => {
    const SEANCE_POLL = {
      date: null,
      slot: null,
      lieu: 'Lyon 3e',
      heureRdv: null,
      notePratique: null,
      capacity: null,
    };

    describe('createHosted()', () => {
      it('écrit le sondage (callback) DANS la transaction, puis la séance SANS date qui porte pollId', async () => {
        prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
        const order: string[] = [];
        prisma.tx.event.create.mockImplementation(() => {
          order.push('event');
          return Promise.resolve(EVENT);
        });
        prisma.tx.seance.create.mockImplementation(() => {
          order.push('seance');
          return Promise.resolve({ id: 'se1' });
        });
        const createPoll = jest.fn((tx: unknown) => {
          order.push('poll');
          expect(tx).toBe(prisma.tx);
          return Promise.resolve({ id: 'poll-1' });
        });

        await service.createHosted(GRANT_P1, 'hote', {
          title: 'Catane',
          seance: { ...SEANCE_POLL, createPoll },
        });

        expect(order).toEqual(['event', 'poll', 'seance']);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.tx.seance.create).toHaveBeenCalledWith({
          data: {
            eventId: 'e1',
            pollId: 'poll-1',
            startDate: null,
            startSlot: null,
            endDate: null,
            endSlot: null,
            durationSlots: 1,
            lieu: 'Lyon 3e',
            heureRdv: null,
            notePratique: null,
            inscriptionMax: null,
          },
        });
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('tout ou rien : si le sondage échoue, aucune séance n’est écrite et rien n’est émis', async () => {
        prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
        const createPoll = jest
          .fn()
          .mockRejectedValue(new BadRequestException('Options dupliquées'));

        await expect(
          service.createHosted(GRANT_P1, 'hote', {
            title: 'X',
            seance: { ...SEANCE_POLL, createPoll },
          }),
        ).rejects.toThrow('Options dupliquées');
        expect(prisma.tx.seance.create).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('séance sans date ET sans sondage (ou datée ET avec sondage) → 400, rien n’est écrit', async () => {
        prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
        const day = new Date('2026-11-14T00:00:00.000Z');

        await expect(
          service.createHosted(GRANT_P1, 'hote', { title: 'X', seance: SEANCE_POLL }),
        ).rejects.toThrow(POLL_MODE_MESSAGE);
        await expect(
          service.createHosted(GRANT_P1, 'hote', {
            title: 'X',
            seance: {
              ...SEANCE_POLL,
              date: day,
              slot: 'EVENING',
              createPoll: jest.fn().mockResolvedValue({ id: 'p' }),
            },
          }),
        ).rejects.toThrow(POLL_MODE_MESSAGE);
        expect(prisma.tx.seance.create).not.toHaveBeenCalled();
      });

      it('une séance sans date ne fait jamais entrer de date dans la prochaine séance de la partie (le recalcul n’ajoute aucune date)', async () => {
        prisma.tx.$queryRaw.mockResolvedValue([{ kind: 'CAMPAGNE_EPISODIQUE' }]);
        prisma.tx.seance.findMany.mockResolvedValue([{ startDate: null, startSlot: null }]);

        await service.createHosted(GRANT_P1, 'hote', {
          title: 'X',
          seance: { ...SEANCE_POLL, createPoll: jest.fn().mockResolvedValue({ id: 'p' }) },
        });

        expect(prisma.tx.partie.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: { nextSessionDate: null, nextSessionSlot: null, nextSessionEndDate: null, nextSessionEndSlot: null },
        });
      });
    });

    describe('updateHosted()', () => {
      const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });
      const pollSeance = (over: Record<string, unknown> = {}) =>
        prisma.tx.event.findUnique.mockResolvedValue({
          ownerId: 'hote',
          seances: [{ id: 'se1', startDate: null, startSlot: null, pollId: 'poll-1', durationSlots: 1, ...over }],
        });

      it('délègue créneaux et échéance au callback (dans la transaction), n’écrit JAMAIS de date de séance', async () => {
        pollSeance();
        prisma.tx.inscription.count.mockResolvedValue(1);
        const updatePoll = jest.fn().mockResolvedValue(undefined);

        await service.updateHosted(GRANT_E1, 'e1', {
          title: 'Catane v2',
          seance: { ...SEANCE_POLL, capacity: 6, updatePoll },
        });

        expect(updatePoll).toHaveBeenCalledWith(prisma.tx, 'poll-1', { purge: false });
        expect(prisma.tx.seance.update).toHaveBeenCalledWith({
          where: { id: 'se1' },
          data: { lieu: 'Lyon 3e', heureRdv: null, notePratique: null, inscriptionMax: 6 },
        });
        expect(prisma.tx.partie.update).toHaveBeenCalledTimes(1);
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('en attente de date (soirée isolée, Story 41.2) : un sondage est créé dans la transaction et la séance le porte, sans date', async () => {
        pollSeance({ pollId: null });
        prisma.tx.inscription.count.mockResolvedValue(0);
        const createPoll = jest.fn().mockResolvedValue({ id: 'poll-9' });

        await service.updateHosted(GRANT_E1, 'e1', {
          title: 'Soirée',
          seance: { ...SEANCE_POLL, capacity: null, createPoll },
        });

        expect(createPoll).toHaveBeenCalledWith(prisma.tx);
        expect(prisma.tx.seance.update).toHaveBeenCalledWith({
          where: { id: 'se1' },
          data: {
            pollId: 'poll-9',
            durationSlots: 1,
            lieu: 'Lyon 3e',
            heureRdv: null,
            notePratique: null,
            inscriptionMax: null,
          },
        });
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('en attente de date : une date fixée est écrite (plage d’un créneau), le rappel est ré-armé', async () => {
        pollSeance({ pollId: null });
        prisma.tx.inscription.count.mockResolvedValue(0);
        const day = new Date(Date.now() + 5 * 86_400_000);
        day.setUTCHours(0, 0, 0, 0);

        await service.updateHosted(GRANT_E1, 'e1', {
          title: 'Soirée',
          seance: {
            date: day,
            slot: 'EVENING',
            lieu: null,
            heureRdv: null,
            notePratique: null,
            capacity: null,
          },
        });

        const data = callArg<{ data: Record<string, unknown> }>(prisma.tx.seance.update).data;
        expect(data).toEqual(
          objectLike({
            startDate: day,
            startSlot: 'EVENING',
            endDate: day,
            endSlot: 'EVENING',
            reminderSentAt: null,
          }),
        );
        expect(data).not.toHaveProperty('pollId');
      });

      it('en attente de date : un sondage sans fermeture de création → 400, rien n’est écrit', async () => {
        pollSeance({ pollId: null });
        prisma.tx.inscription.count.mockResolvedValue(0);

        await expect(
          service.updateHosted(GRANT_E1, 'e1', { title: 'X', seance: { ...SEANCE_POLL } }),
        ).rejects.toThrow(POLL_MODE_MESSAGE);
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('isAwaitingDate() : séance sans date ni sondage seulement', async () => {
        prisma.seance.findFirst.mockResolvedValue({ startDate: null, pollId: null });
        await expect(service.isAwaitingDate('e1')).resolves.toBe(true);
        prisma.seance.findFirst.mockResolvedValue({ startDate: null, pollId: 'poll-1' });
        await expect(service.isAwaitingDate('e1')).resolves.toBe(false);
        prisma.seance.findFirst.mockResolvedValue({ startDate: new Date(), pollId: null });
        await expect(service.isAwaitingDate('e1')).resolves.toBe(false);
        prisma.seance.findFirst.mockResolvedValue(null);
        await expect(service.isAwaitingDate('e1')).resolves.toBe(false);
      });

      it('le mode ne change pas : date fournie pour une conjonction à sondage, ou sondage pour une conjonction datée → 400', async () => {
        pollSeance();
        await expect(
          service.updateHosted(GRANT_E1, 'e1', {
            title: 'X',
            seance: {
              ...SEANCE_POLL,
              date: new Date('2026-12-01T00:00:00.000Z'),
              slot: 'EVENING',
            },
          }),
        ).rejects.toThrow(POLL_MODE_MESSAGE);

        pollSeance({ pollId: null, startDate: new Date(Date.now() + 5 * 86_400_000) });
        await expect(
          service.updateHosted(GRANT_E1, 'e1', {
            title: 'X',
            seance: { ...SEANCE_POLL, updatePoll: jest.fn() },
          }),
        ).rejects.toThrow(POLL_MODE_MESSAGE);
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('échec du callback (échéance passée…) : rien n’est écrit ni émis', async () => {
        pollSeance();
        prisma.tx.inscription.count.mockResolvedValue(0);
        const updatePoll = jest.fn().mockRejectedValue(new BadRequestException('échéance passée'));

        await expect(
          service.updateHosted(GRANT_E1, 'e1', {
            title: 'X',
            seance: { ...SEANCE_POLL, updatePoll },
          }),
        ).rejects.toThrow('échéance passée');
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });
    });

    describe('listCards() — bloc poll', () => {
      const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
      const row = (over: Record<string, unknown> = {}) => ({
        id: 'e1',
        title: 'Catane',
        ownerId: 'hote',
        owner: { displayName: 'Léa' },
        seances: [
          {
            id: 'se1',
            startDate: null,
            startSlot: null,
            lieu: null,
            heureRdv: null,
            notePratique: null,
            inscriptionMax: null,
            pollId: 'poll-1',
          },
        ],
        ...over,
      });
      const pollRow = {
        id: 'poll-1',
        expiresAt: new Date('2026-11-10T23:59:59.999Z'),
        status: 'OPEN',
        options: [
          { id: 'o2', date: day('2026-11-15'), slot: 'MORNING' },
          { id: 'o1', date: day('2026-11-14'), slot: 'EVENING' },
        ],
        votes: [
          { optionId: 'o1', userId: 'hote', answer: 'YES' },
          { optionId: 'o1', userId: 'parti', answer: 'NO' },
        ],
      };
      const decl = (userId: string, slot: string, from: string, to: string) => ({
        userId,
        kind: 'AVAILABLE',
        recurKind: 'PUNCTUAL',
        dayOfWeek: null,
        slot,
        startDate: day(from),
        endDate: day(to),
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      });

      it('conjonction datée : poll null, aucune lecture de sondage', async () => {
        prisma.event.findMany.mockResolvedValue([
          row({
            seances: [
              {
                ...row().seances[0],
                pollId: null,
                startDate: day('2026-11-14'),
                startSlot: 'EVENING',
              },
            ],
          }),
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.poll).toBeNull();
        expect(prisma.sessionPoll.findMany).not.toHaveBeenCalled();
        expect(prisma.availabilityDeclaration.findMany).not.toHaveBeenCalled();
      });

      it('« Tous les membres » : votants éligibles = membres du groupe (hôte compris), créneaux triés, réponses des éligibles', async () => {
        prisma.event.findMany.mockResolvedValue([row()]);
        prisma.sessionPoll.findMany.mockResolvedValue([pollRow]);
        // rosterOf lit les appartenances (rôles) ; le sondage relit les membres du groupe.
        prisma.membership.findMany.mockResolvedValue([
          { userId: 'hote', role: 'MEMBER' },
          { userId: 'ami', role: 'ADMIN' },
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.seance).toEqual(objectLike({ date: null, slot: null }));
        expect(card.poll).toEqual({
          id: 'poll-1',
          expiresAt: '2026-11-10T23:59:59.999Z',
          status: 'OPEN',
          eligibleVoterIds: ['hote', 'ami'],
          options: [
            { id: 'o1', date: '2026-11-14', slot: 'EVENING', availableCount: 0 },
            { id: 'o2', date: '2026-11-15', slot: 'MORNING', availableCount: 0 },
          ],
          // La réponse de « parti » (non éligible) n'est pas servie.
          votes: [{ optionId: 'o1', userId: 'hote', answer: 'YES' }],
        });
        expect(callArg(prisma.sessionPoll.findMany)).toEqual(
          objectLike({ where: { id: { in: ['poll-1'] }, partieId: 'p1' } }),
        );
      });

      it('places limitées : hôte + inscrits CONFIRMÉS, jamais une place seulement réservée ; availableCount = inscrits libres (UNE lecture des disponibilités)', async () => {
        prisma.event.findMany.mockResolvedValue([
          row({ seances: [{ ...row().seances[0], inscriptionMax: 4 }] }),
        ]);
        prisma.sessionPoll.findMany.mockResolvedValue([pollRow]);
        prisma.inscription.findMany.mockResolvedValue([
          { seanceId: 'se1', userId: 'ami', status: 'CONFIRMED', user: { displayName: 'Zoé' } },
          { seanceId: 'se1', userId: 'invite', status: 'RESERVED', user: { displayName: 'Sam' } },
        ]);
        prisma.availabilityDeclaration.findMany.mockResolvedValue([
          decl('hote', 'EVENING', '2026-11-14', '2026-11-14'),
          decl('ami', 'FULL_DAY', '2026-11-14', '2026-11-16'),
          // « invite » n'est pas inscrit : sa disponibilité ne compte pas (et n'est pas même demandée).
          decl('invite', 'EVENING', '2026-11-14', '2026-11-14'),
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.poll?.eligibleVoterIds).toEqual(['hote', 'ami']);
        expect(card.poll?.options).toEqual([
          { id: 'o1', date: '2026-11-14', slot: 'EVENING', availableCount: 2 },
          { id: 'o2', date: '2026-11-15', slot: 'MORNING', availableCount: 1 },
        ]);
        expect(prisma.availabilityDeclaration.findMany).toHaveBeenCalledTimes(1);
        const where = callArg<{ where: { userId: { in: string[] } } }>(
          prisma.availabilityDeclaration.findMany,
        ).where;
        expect([...where.userId.in].sort()).toEqual(['ami', 'hote']);
      });

      it('plusieurs conjonctions à sondage : une lecture de sondages, une de disponibilités (pas de requête par carte)', async () => {
        prisma.event.findMany.mockResolvedValue([
          row(),
          row({
            id: 'e2',
            seances: [{ ...row().seances[0], id: 'se2', pollId: 'poll-2' }],
          }),
        ]);
        prisma.sessionPoll.findMany.mockResolvedValue([
          pollRow,
          { ...pollRow, id: 'poll-2', votes: [] },
        ]);

        const cards = await service.listCards(GRANT_P1, 'viewer');

        expect(cards.map((c) => c.poll?.id)).toEqual(['poll-1', 'poll-2']);
        expect(prisma.sessionPoll.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.availabilityDeclaration.findMany).toHaveBeenCalledTimes(1);
      });

      it('tri : les conjonctions à sondage (sans date) viennent après les datées', async () => {
        prisma.event.findMany.mockResolvedValue([
          row({ id: 'sondage' }),
          row({
            id: 'datee',
            seances: [
              {
                ...row().seances[0],
                pollId: null,
                startDate: day('2026-12-01'),
                startSlot: 'EVENING',
              },
            ],
          }),
        ]);
        prisma.sessionPoll.findMany.mockResolvedValue([pollRow]);

        const cards = await service.listCards(GRANT_P1, 'viewer');

        expect(cards.map((c) => c.id)).toEqual(['datee', 'sondage']);
      });
    });

    describe('assertCanVote() — GroupPollVotePort', () => {
      const POLL = { id: 'poll-1', partieId: 'p1', expiresAt: new Date(Date.now() + 86_400_000) };
      const GROUPE = { kind: 'CAMPAGNE_EPISODIQUE' as const };
      const seanceRow = (over: Record<string, unknown> = {}) =>
        prisma.seance.findUnique.mockResolvedValue({
          startDate: null,
          inscriptionMax: null,
          inscriptions: [],
          event: {
            partieId: 'p1',
            ownerId: 'hote',
            partie: {
              id: 'p1',
              kind: 'CAMPAGNE_EPISODIQUE',
              gameSystemId: 'ralliement',
              closedAt: null,
            },
          },
          ...over,
        });

      it('soirée isolée close (même sans date) : le vote est refusé (400), une soirée ouverte reste ouverte (Story 41.4)', async () => {
        const isolated = (closedAt: Date | null) => ({
          partieId: 'p1',
          ownerId: 'hote',
          partie: { id: 'p1', kind: 'ONE_SHOT', gameSystemId: 'ralliement', closedAt },
        });
        seanceRow({ event: isolated(new Date()) });
        await expect(service.assertCanVote(POLL, { kind: 'ONE_SHOT' }, 'hote')).rejects.toThrow(
          EVENING_FINISHED_MESSAGE,
        );

        seanceRow({ event: isolated(null) });
        prisma.seance.findMany.mockResolvedValue([]);
        await expect(
          service.assertCanVote(POLL, { kind: 'ONE_SHOT' }, 'hote'),
        ).resolves.toBeUndefined();
      });

      it('« Tous les membres » : un membre du groupe vote, un étranger est refusé (403)', async () => {
        seanceRow();
        prisma.membership.findMany.mockResolvedValue([{ userId: 'hote' }, { userId: 'ami' }]);

        await expect(service.assertCanVote(POLL, GROUPE, 'ami')).resolves.toBeUndefined();
        await expect(service.assertCanVote(POLL, GROUPE, 'hote')).resolves.toBeUndefined();
        const refusal = service.assertCanVote(POLL, GROUPE, 'etranger');
        await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
        await expect(refusal).rejects.toThrow(VOTE_NOT_ELIGIBLE_MESSAGE);
      });

      it('places limitées : l’hôte et les confirmés votent ; un membre non inscrit ou seulement réservé est refusé', async () => {
        seanceRow({
          inscriptionMax: 4,
          inscriptions: [
            { userId: 'ami', status: 'CONFIRMED' },
            { userId: 'invite', status: 'RESERVED' },
          ],
        });

        await expect(service.assertCanVote(POLL, GROUPE, 'ami')).resolves.toBeUndefined();
        await expect(service.assertCanVote(POLL, GROUPE, 'hote')).resolves.toBeUndefined();
        await expect(service.assertCanVote(POLL, GROUPE, 'invite')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        await expect(service.assertCanVote(POLL, GROUPE, 'membre')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        // Places limitées : les membres du groupe ne sont pas même lus.
        expect(prisma.membership.findMany).not.toHaveBeenCalled();
      });

      it('après l’échéance → 400 ; date déjà fixée → 400 ; rien n’est lu au-delà', async () => {
        seanceRow();
        const ended = service.assertCanVote(
          { ...POLL, expiresAt: new Date(Date.now() - 1000) },
          GROUPE,
          'hote',
        );
        await expect(ended).rejects.toBeInstanceOf(BadRequestException);
        await expect(ended).rejects.toThrow(VOTE_ENDED_MESSAGE);

        seanceRow({ startDate: new Date('2026-11-14T00:00:00.000Z') });
        const dated = service.assertCanVote(POLL, GROUPE, 'hote');
        await expect(dated).rejects.toBeInstanceOf(BadRequestException);
        await expect(dated).rejects.toThrow(VOTE_DATE_SET_MESSAGE);
        expect(prisma.membership.findMany).not.toHaveBeenCalled();
      });

      it('sondage rattaché à aucune conjonction de cette partie → 400 ; rencontre isolée : mêmes règles (Story 41.2)', async () => {
        prisma.seance.findUnique.mockResolvedValue(null);
        await expect(service.assertCanVote(POLL, GROUPE, 'hote')).rejects.toThrow(
          'Poll introuvable ou fermé',
        );

        seanceRow({ event: { partieId: 'autre', ownerId: 'hote' } });
        await expect(service.assertCanVote(POLL, GROUPE, 'hote')).rejects.toBeInstanceOf(
          BadRequestException,
        );

        // Story 41.2 : la soirée isolée vote comme un groupe — l'hôte est un votant éligible.
        seanceRow();
        await expect(
          service.assertCanVote(POLL, { kind: 'ONE_SHOT' }, 'hote'),
        ).resolves.toBeUndefined();
      });
    });
  });

  // Story 40.6 — fixer la date d'une conjonction depuis son sondage.
  describe('fixer la date d’une conjonction (Story 40.6)', () => {
    const POLL = { id: 'poll-1', partieId: 'p1' };

    describe('lockConjonction() — verrou partie puis événement', () => {
      it('prend le verrou de la partie PUIS celui de l’événement du sondage, et dit si la date est fixée', async () => {
        const order: string[] = [];
        prisma.tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
          order.push(strings.join('?').includes('"Partie"') ? 'partie' : 'event');
          return Promise.resolve([]);
        });
        prisma.tx.seance.findUnique
          .mockResolvedValueOnce({ event: { id: 'e1', partieId: 'p1' } })
          .mockResolvedValueOnce({ startDate: null, event: { cancelledAt: null } });

        await expect(service.lockConjonction(prisma.tx as never, POLL)).resolves.toEqual({
          dated: false,
        });
        expect(order).toEqual(['partie', 'event']);

        prisma.tx.seance.findUnique
          .mockResolvedValueOnce({ event: { id: 'e1', partieId: 'p1' } })
          .mockResolvedValueOnce({
            startDate: new Date('2026-11-14T00:00:00.000Z'),
            event: { cancelledAt: null },
          });
        await expect(service.lockConjonction(prisma.tx as never, POLL)).resolves.toEqual({
          dated: true,
        });
      });

      it('sondage rattaché à aucune conjonction de cette partie → 400, aucun verrou pris', async () => {
        prisma.tx.seance.findUnique.mockResolvedValueOnce(null);
        await expect(service.lockConjonction(prisma.tx as never, POLL)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        prisma.tx.seance.findUnique.mockResolvedValueOnce({
          event: { id: 'e1', partieId: 'autre' },
        });
        await expect(service.lockConjonction(prisma.tx as never, POLL)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(prisma.tx.$queryRaw).not.toHaveBeenCalled();
      });
    });

    describe('eventIdOfPoll()', () => {
      it('renvoie l’événement du sondage s’il est de cette partie, sinon null', async () => {
        prisma.seance.findUnique.mockResolvedValue({ event: { id: 'e1', partieId: 'p1' } });
        await expect(service.eventIdOfPoll('poll-1', 'p1')).resolves.toBe('e1');
        await expect(service.eventIdOfPoll('poll-1', 'autre')).resolves.toBeNull();
        prisma.seance.findUnique.mockResolvedValue(null);
        await expect(service.eventIdOfPoll('poll-1', 'p1')).resolves.toBeNull();
      });
    });

    describe('endedIsolatedPartieIds() et assertIsolatedOpen() — Story 41.4', () => {
      it('une seule lecture groupée : fin de plage (à défaut début) strictement avant le début du jour UTC ; liste vide : aucune lecture', async () => {
        prisma.seance.findMany.mockResolvedValue([
          { event: { partieId: 'a' } },
          { event: { partieId: 'a' } },
          { event: { partieId: 'c' } },
        ]);

        const ended = await service.endedIsolatedPartieIds(['a', 'b', 'c']);

        expect([...ended].sort()).toEqual(['a', 'c']);
        expect(prisma.seance.findMany).toHaveBeenCalledTimes(1);
        const where = callArg<{
          where: { OR: { endDate?: { lt: Date } | null; startDate?: { lt: Date } }[] };
        }>(prisma.seance.findMany).where;
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        expect(where.OR[0].endDate).toEqual({ lt: startOfToday });
        expect(where.OR[1]).toEqual({ endDate: null, startDate: { lt: startOfToday } });

        prisma.seance.findMany.mockClear();
        await expect(service.endedIsolatedPartieIds([])).resolves.toEqual(new Set());
        expect(prisma.seance.findMany).not.toHaveBeenCalled();
      });

      it('soirée terminée (close ou passée) → 400 ; ouverte, groupe, JDR → sans effet ni lecture inutile', async () => {
        const evening = (over: Record<string, unknown> = {}) => ({
          id: 'p1',
          kind: 'ONE_SHOT' as const,
          gameSystemId: 'ralliement',
          closedAt: null,
          ...over,
        });
        prisma.seance.findMany.mockResolvedValue([]);
        await expect(service.assertIsolatedOpen(evening())).resolves.toBeUndefined();

        await expect(service.assertIsolatedOpen(evening({ closedAt: new Date() }))).rejects.toThrow(
          EVENING_FINISHED_MESSAGE,
        );

        prisma.seance.findMany.mockResolvedValue([{ event: { partieId: 'p1' } }]);
        await expect(service.assertIsolatedOpen(evening())).rejects.toBeInstanceOf(
          BadRequestException,
        );

        prisma.seance.findMany.mockClear();
        await expect(
          service.assertIsolatedOpen(
            evening({ kind: 'CAMPAGNE_EPISODIQUE', closedAt: new Date() }),
          ),
        ).resolves.toBeUndefined();
        await expect(
          service.assertIsolatedOpen(evening({ gameSystemId: 'ryuutama', closedAt: new Date() })),
        ).resolves.toBeUndefined();
        expect(prisma.seance.findMany).not.toHaveBeenCalled();
      });
    });

    describe('boardGamesBasis() — Story 49.1', () => {
      const START = new Date('2026-11-05T00:00:00.000Z');

      it('conjonction de groupe : hôte, annulation, plage et inscriptions de la première séance ; aucune lecture des membres', async () => {
        prisma.event.findUnique.mockResolvedValue({
          ownerId: 'host',
          cancelledAt: null,
          seances: [
            {
              startDate: START,
              endDate: START,
              inscriptions: [{ userId: 'a', status: 'RESERVED' }],
            },
          ],
        });

        const basis = await service.boardGamesBasis('e1', { id: 'p1', isolated: false });

        expect(basis).toEqual({
          hostId: 'host',
          cancelledAt: null,
          startDate: START,
          endDate: START,
          inscriptions: [{ userId: 'a', status: 'RESERVED' }],
          memberIds: [],
        });
        const args = callArg<{
          where: unknown;
          select: { seances: { take: number; select: Record<string, unknown> } };
        }>(prisma.event.findUnique);
        expect(args.where).toEqual({ id: 'e1' });
        expect(args.select.seances.take).toBe(1);
        expect(Object.keys(args.select.seances.select)).toContain('inscriptions');
        expect(prisma.membership.findMany).not.toHaveBeenCalled();
      });

      it('rencontre isolée : les membres de la partie, sans lire les inscriptions', async () => {
        prisma.event.findUnique.mockResolvedValue({
          ownerId: 'host',
          cancelledAt: null,
          seances: [{ startDate: null, endDate: null }],
        });
        prisma.membership.findMany.mockResolvedValue([{ userId: 'host' }, { userId: 'm1' }]);

        const basis = await service.boardGamesBasis('e1', { id: 'p2', isolated: true });

        expect(basis).toMatchObject({
          hostId: 'host',
          startDate: null,
          endDate: null,
          inscriptions: [],
          memberIds: ['host', 'm1'],
        });
        const args = callArg<{ select: { seances: { select: Record<string, unknown> } } }>(
          prisma.event.findUnique,
        );
        expect(Object.keys(args.select.seances.select)).not.toContain('inscriptions');
        expect(callArg<{ where: unknown }>(prisma.membership.findMany).where).toEqual({
          partieId: 'p2',
        });
      });

      it('événement inconnu : null ; événement sans séance : plage vide', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(service.boardGamesBasis('e1', { id: 'p1', isolated: false })).resolves.toBeNull();

        prisma.event.findUnique.mockResolvedValue({
          ownerId: null,
          cancelledAt: null,
          seances: [],
        });
        await expect(
          service.boardGamesBasis('e1', { id: 'p1', isolated: false }),
        ).resolves.toMatchObject({ hostId: null, startDate: null, endDate: null, inscriptions: [] });
      });

      it('Story 49.2 : relit sur le client fourni (transaction) sans toucher au client global', async () => {
        const tx = {
          event: {
            findUnique: jest.fn().mockResolvedValue({
              ownerId: 'host',
              cancelledAt: null,
              seances: [{ startDate: null, endDate: null }],
            }),
          },
          membership: { findMany: jest.fn().mockResolvedValue([{ userId: 'host' }]) },
        };

        const basis = await service.boardGamesBasis(
          'e1',
          { id: 'p2', isolated: true },
          tx as never,
        );

        expect(basis).toMatchObject({ hostId: 'host', memberIds: ['host'] });
        expect(tx.event.findUnique).toHaveBeenCalledTimes(1);
        expect(tx.membership.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.event.findUnique).not.toHaveBeenCalled();
        expect(prisma.membership.findMany).not.toHaveBeenCalled();
      });
    });

    describe('invitationNotice() — Story 41.3', () => {
      const event = (seance: Record<string, unknown> | null) => ({
        title: 'Soirée',
        seances: seance ? [seance] : [],
      });

      it('événement sans date ni sondage : titre seul', async () => {
        prisma.event.findFirst.mockResolvedValue(
          event({ startDate: null, startSlot: null, lieu: null, poll: null }),
        );
        await expect(service.invitationNotice('p1')).resolves.toEqual({
          eventTitle: 'Soirée',
          startDate: null,
          startSlot: null,
          endDate: null,
          endSlot: null,
          deadline: null,
          lieu: null,
        });
      });

      it('date fixée : jour, créneau, lieu ; sondage ouvert : échéance du vote ; sondage clos : aucune échéance', async () => {
        const day = new Date('2026-11-14T00:00:00.000Z');
        prisma.event.findFirst.mockResolvedValue(
          event({ startDate: day, startSlot: 'EVENING', lieu: 'Chez Léa', poll: null }),
        );
        await expect(service.invitationNotice('p1')).resolves.toEqual(
          objectLike({ startDate: day, startSlot: 'EVENING', deadline: null, lieu: 'Chez Léa' }),
        );

        const deadline = new Date('2026-10-25T23:59:59.999Z');
        prisma.event.findFirst.mockResolvedValue(
          event({
            startDate: null,
            startSlot: null,
            lieu: null,
            poll: { status: 'OPEN', expiresAt: deadline },
          }),
        );
        await expect(service.invitationNotice('p1')).resolves.toEqual(objectLike({ deadline }));

        prisma.event.findFirst.mockResolvedValue(
          event({
            startDate: null,
            startSlot: null,
            lieu: null,
            poll: { status: 'CLOSED', expiresAt: deadline },
          }),
        );
        await expect(service.invitationNotice('p1')).resolves.toEqual(
          objectLike({ deadline: null }),
        );
      });

      it('partie sans événement : null', async () => {
        prisma.event.findFirst.mockResolvedValue(null);
        await expect(service.invitationNotice('p1')).resolves.toBeNull();
      });
    });

    describe('dateFixedNotice()', () => {
      const day = new Date('2026-11-14T00:00:00.000Z');
      const seanceRow = (over: Record<string, unknown> = {}) => ({
        startDate: day,
        startSlot: 'EVENING',
        lieu: 'Chez Léa',
        event: {
          title: 'Catane',
          partieId: 'p1',
          ownerId: 'hote',
          partie: { kind: 'CAMPAGNE_EPISODIQUE', memberships: [] },
        },
        inscriptions: [
          { user: { id: 'a', email: 'a@example.com' } },
          { user: { id: 'b', email: 'b@example.com' } },
        ],
        ...over,
      });

      it('soirée isolée (Story 41.2) : destinataires = membres de la partie, hôte exclu, sans inscription', async () => {
        prisma.seance.findUnique.mockResolvedValue(
          seanceRow({
            inscriptions: [],
            event: {
              title: 'Soirée',
              partieId: 'p1',
              ownerId: 'hote',
              partie: {
                kind: 'ONE_SHOT',
                memberships: [
                  { user: { id: 'hote', email: 'hote@example.com' } },
                  { user: { id: 'a', email: 'a@example.com' } },
                  { user: { id: 'b', email: 'b@example.com' } },
                ],
              },
            },
          }),
        );

        const notice = await service.dateFixedNotice('poll-1');

        expect(notice?.recipients).toEqual([
          { id: 'a', email: 'a@example.com' },
          { id: 'b', email: 'b@example.com' },
        ]);
      });

      it('destinataires = inscrits CONFIRMÉS (requête filtrée), hôte exclu, une adresse chacun', async () => {
        prisma.seance.findUnique.mockResolvedValue(
          seanceRow({
            inscriptions: [
              { user: { id: 'hote', email: 'hote@example.com' } },
              { user: { id: 'a', email: 'a@example.com' } },
            ],
          }),
        );

        const notice = await service.dateFixedNotice('poll-1');

        expect(notice).toEqual({
          partieId: 'p1',
          eventTitle: 'Catane',
          startDate: day,
          startSlot: 'EVENING',
          lieu: 'Chez Léa',
          recipients: [{ id: 'a', email: 'a@example.com' }],
        });
        expect(callArg(prisma.seance.findUnique)).toEqual(
          objectLike({
            where: { pollId: 'poll-1' },
            select: objectLike({
              inscriptions: objectLike({ where: { status: 'CONFIRMED' } }),
            }),
          }),
        );
      });

      it('aucun inscrit : liste vide (aucun e-mail) ; séance sans date ou introuvable : null', async () => {
        prisma.seance.findUnique.mockResolvedValue(seanceRow({ inscriptions: [] }));
        expect((await service.dateFixedNotice('poll-1'))?.recipients).toEqual([]);

        prisma.seance.findUnique.mockResolvedValue(seanceRow({ startDate: null }));
        await expect(service.dateFixedNotice('poll-1')).resolves.toBeNull();
        prisma.seance.findUnique.mockResolvedValue(null);
        await expect(service.dateFixedNotice('poll-1')).resolves.toBeNull();
      });
    });

    describe('listCards() — le bloc de sondage disparaît une fois la date fixée', () => {
      const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
      const row = (seance: Record<string, unknown>) => ({
        id: 'e1',
        title: 'Catane',
        ownerId: 'hote',
        owner: { displayName: 'Léa' },
        seances: [
          {
            id: 'se1',
            startDate: null,
            startSlot: null,
            lieu: null,
            heureRdv: null,
            notePratique: null,
            inscriptionMax: null,
            pollId: 'poll-1',
            ...seance,
          },
        ],
      });
      const pollRow = (status: string) => ({
        id: 'poll-1',
        expiresAt: new Date('2026-11-10T23:59:59.999Z'),
        status,
        options: [{ id: 'o1', date: day('2026-11-14'), slot: 'EVENING' }],
        votes: [],
      });

      it('séance datée par le sondage (pollId posé, sondage clos) : poll null, date normale, aucune lecture de sondage', async () => {
        prisma.event.findMany.mockResolvedValue([
          row({ startDate: day('2026-11-14'), startSlot: 'EVENING' }),
        ]);
        prisma.sessionPoll.findMany.mockResolvedValue([pollRow('CLOSED')]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.poll).toBeNull();
        expect(card.seance).toEqual(objectLike({ date: '2026-11-14', slot: 'EVENING' }));
        expect(prisma.sessionPoll.findMany).not.toHaveBeenCalled();
      });

      it('sondage fermé mais séance sans date : poll null ; sondage ouvert : bloc servi', async () => {
        prisma.event.findMany.mockResolvedValue([row({})]);
        prisma.sessionPoll.findMany.mockResolvedValue([pollRow('CLOSED')]);
        expect((await service.listCards(GRANT_P1, 'viewer'))[0].poll).toBeNull();

        prisma.sessionPoll.findMany.mockResolvedValue([pollRow('OPEN')]);
        expect((await service.listCards(GRANT_P1, 'viewer'))[0].poll?.status).toBe('OPEN');
      });
    });

    describe('updateHosted() — une date fixée depuis un sondage ne bouge plus', () => {
      const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });
      const fixedDay = new Date(Date.now() + 5 * 86_400_000);
      fixedDay.setUTCHours(0, 0, 0, 0);
      const fixedSeance = (over: Record<string, unknown> = {}) =>
        prisma.tx.event.findUnique.mockResolvedValue({
          ownerId: 'hote',
          seances: [
            { id: 'se1', startDate: fixedDay, startSlot: 'EVENING', pollId: 'poll-1', durationSlots: 1, ...over },
          ],
        });
      const input = (over: Record<string, unknown> = {}) => ({
        title: 'Catane v2',
        seance: {
          date: fixedDay,
          slot: 'EVENING' as const,
          lieu: 'Nouveau lieu',
          heureRdv: '20:30',
          notePratique: null,
          capacity: null,
          ...over,
        },
      });

      it('lieu, heure, infos et capacité restent modifiables ; la date n’est pas réécrite en base', async () => {
        fixedSeance();
        prisma.tx.inscription.count.mockResolvedValue(0);

        await service.updateHosted(GRANT_E1, 'e1', input({ capacity: 6 }));

        const data = callArg<{ data: Record<string, unknown> }>(prisma.tx.seance.update).data;
        expect(data).toEqual(
          objectLike({ lieu: 'Nouveau lieu', heureRdv: '20:30', inscriptionMax: 6 }),
        );
        // Jour et créneau inchangés : le rappel de la veille n'est pas ré-armé.
        expect(data).not.toHaveProperty('reminderSentAt');
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('changer le jour ou le créneau → 400 français, rien n’est écrit ni émis', async () => {
        fixedSeance();
        const otherDay = new Date(fixedDay.getTime() + 86_400_000);

        const refusal = service.updateHosted(GRANT_E1, 'e1', input({ date: otherDay }));
        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(DATE_FIXED_MESSAGE);
        await expect(
          service.updateHosted(GRANT_E1, 'e1', input({ slot: 'MORNING' })),
        ).rejects.toThrow(DATE_FIXED_MESSAGE);
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('envoyer des champs de sondage pour une conjonction datée → 400 (le mode ne change pas)', async () => {
        fixedSeance();
        await expect(
          service.updateHosted(GRANT_E1, 'e1', input({ date: null, slot: null })),
        ).rejects.toThrow(POLL_MODE_MESSAGE);
        expect(prisma.tx.seance.update).not.toHaveBeenCalled();
      });

      it('une conjonction proposée à date fixée (sans sondage) garde sa modification de jour (Story 40.2)', async () => {
        fixedSeance({ pollId: null });
        prisma.tx.inscription.count.mockResolvedValue(0);
        const otherDay = new Date(fixedDay.getTime() + 86_400_000);

        await service.updateHosted(GRANT_E1, 'e1', input({ date: otherDay }));

        expect(prisma.tx.seance.update).toHaveBeenCalledTimes(1);
      });
    });
  });

  // Story 42.1 — annuler une conjonction de groupe (AD-9).
  describe('annulation d’une conjonction (Story 42.1)', () => {
    const GRANT_E1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'e1' });
    const GRANT_SE1 = testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', {
      eventId: 'e1',
      seanceId: 'se1',
    });
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);
    const dayStart = (date: Date) =>
      new Date(`${date.toISOString().substring(0, 10)}T00:00:00.000Z`);

    function existing(over: Record<string, unknown> = {}) {
      prisma.tx.event.findUnique.mockResolvedValue({
        cancelledAt: null,
        seances: [{ startDate: dayStart(inDays(5)), pollId: null, durationSlots: 1 }],
        ...over,
      });
    }

    describe('cancelHosted()', () => {
      it('verrouille la Partie PUIS l’Event, écrit cancelledAt, recalcule la prochaine date, puis émet', async () => {
        existing();
        const closePoll = jest.fn();

        await service.cancelHosted(GRANT_E1, 'e1', closePoll);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        const locks = prisma.tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
        expect(locks[0]).toContain('FROM "Partie"');
        expect(locks[1]).toContain('FROM "Event"');
        expect(prisma.tx.$queryRaw.mock.calls[1][1]).toBe('e1');
        expect(prisma.tx.event.update).toHaveBeenCalledWith({
          where: { id: 'e1' },
          data: { cancelledAt: expect.any(Date) },
        });
        // Le recalcul reprend le verrou de la partie et exclut les conjonctions annulées.
        expect(prisma.tx.seance.findMany).toHaveBeenCalledWith(
          objectLike({
            where: {
              AND: [{ event: { partieId: 'p1', cancelledAt: null } }, VISIBLE_SEANCE_WHERE],
            },
          }),
        );
        expect(closePoll).not.toHaveBeenCalled();
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('ferme le sondage de la conjonction par la fermeture de l’appelant, dans la même transaction', async () => {
        existing({ seances: [{ startDate: null, pollId: 'poll-1', durationSlots: 1 }] });
        const closePoll = jest.fn();

        await service.cancelHosted(GRANT_E1, 'e1', closePoll);

        expect(closePoll).toHaveBeenCalledWith(prisma.tx, 'poll-1');
        expect(prisma.tx.event.update).toHaveBeenCalledTimes(1);
      });

      it('une conjonction du jour peut encore être annulée', async () => {
        existing({ seances: [{ startDate: dayStart(new Date()), pollId: null, durationSlots: 1 }] });

        await service.cancelHosted(GRANT_E1, 'e1', jest.fn());

        expect(prisma.tx.event.update).toHaveBeenCalledTimes(1);
      });

      it('déjà annulée → 400, rien d’écrit ni d’émis', async () => {
        existing({ cancelledAt: new Date() });
        const closePoll = jest.fn();

        const refusal = service.cancelHosted(GRANT_E1, 'e1', closePoll);

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
        expect(prisma.tx.event.update).not.toHaveBeenCalled();
        expect(closePoll).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('jour passé → 400, rien d’écrit ni d’émis', async () => {
        existing({ seances: [{ startDate: dayStart(inDays(-2)), pollId: 'poll-1', durationSlots: 1 }] });
        const closePoll = jest.fn();

        const refusal = service.cancelHosted(GRANT_E1, 'e1', closePoll);

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(CANCEL_PAST_MESSAGE);
        expect(prisma.tx.event.update).not.toHaveBeenCalled();
        expect(closePoll).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('événement disparu → 404', async () => {
        prisma.tx.event.findUnique.mockResolvedValue(null);

        await expect(service.cancelHosted(GRANT_E1, 'e1', jest.fn())).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('événement d’une autre partie que celle de l’autorisation → 404, aucune transaction', async () => {
        prisma.event.count.mockResolvedValue(0);

        await expect(
          service.cancelHosted(
            testGrant({ id: 'p1', ownerId: 'mj1' }, 'member', { eventId: 'autre' }),
            'e9',
            jest.fn(),
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('soirée isolée annulée (Story 42.2)', () => {
      it('cancelHosted : le crochet s’exécute dans la transaction, ses invités sont émis après le commit et rendus', async () => {
        existing();
        const afterCancel = jest
          .fn()
          .mockResolvedValue({ userIds: ['i1', 'i2'], emails: ['a@x.fr'] });

        const extras = await service.cancelHosted(GRANT_E1, 'e1', jest.fn(), afterCancel);

        expect(afterCancel).toHaveBeenCalledWith(prisma.tx);
        expect(extras).toEqual({ userIds: ['i1', 'i2'], emails: ['a@x.fr'] });
        expect(realtime.emit).toHaveBeenCalledWith(partieTopic('p1'));
        expect(realtime.emit).toHaveBeenCalledWith(userTopic('i1'));
        expect(realtime.emit).toHaveBeenCalledWith(userTopic('i2'));
      });

      it('cancelHosted sans crochet (groupe) : aucun invité, rien d’autre émis', async () => {
        existing();

        await expect(service.cancelHosted(GRANT_E1, 'e1', jest.fn())).resolves.toEqual({
          userIds: [],
          emails: [],
        });
        expect(realtime.emit).toHaveBeenCalledTimes(1);
      });

      it('cancelHosted : un refus (déjà annulée) n’exécute pas le crochet', async () => {
        existing({ cancelledAt: new Date() });
        const afterCancel = jest.fn();

        await expect(service.cancelHosted(GRANT_E1, 'e1', jest.fn(), afterCancel)).rejects.toThrow(
          CANCELLED_EVENT_MESSAGE,
        );
        expect(afterCancel).not.toHaveBeenCalled();
      });

      it('cancelledIsolatedPartieIds : UNE lecture groupée des événements annulés ; liste vide, aucune lecture', async () => {
        prisma.event.findMany.mockResolvedValue([{ partieId: 'a' }, { partieId: 'c' }]);

        const ids = await service.cancelledIsolatedPartieIds(['a', 'b', 'c']);

        expect([...ids].sort()).toEqual(['a', 'c']);
        expect(prisma.event.findMany).toHaveBeenCalledTimes(1);
        expect(callArg<{ where: unknown }>(prisma.event.findMany).where).toEqual({
          partieId: { in: ['a', 'b', 'c'] },
          cancelledAt: { not: null },
        });
        prisma.event.findMany.mockClear();
        await expect(service.cancelledIsolatedPartieIds([])).resolves.toEqual(new Set());
        expect(prisma.event.findMany).not.toHaveBeenCalled();
      });

      it('assertIsolatedOpen refuse (400) une soirée annulée, même ni close ni passée', async () => {
        prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);

        const refusal = service.assertIsolatedOpen({
          id: 'p1',
          kind: 'ONE_SHOT',
          gameSystemId: 'ralliement',
          closedAt: null,
        });

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(EVENING_CANCELLED_MESSAGE);
      });
    });

    describe('plus aucune action sur une conjonction annulée', () => {
      /** Séance relue sous le verrou : l'événement est annulé. */
      function lockedCancelled() {
        prisma.tx.seance.findUnique.mockImplementation(
          (args: { select: Record<string, unknown> }) =>
            Promise.resolve(
              'eventId' in args.select
                ? { eventId: 'e1' }
                : {
                    startDate: dayStart(inDays(3)),
                    inscriptionMax: 4,
                    event: { ownerId: 'hote', cancelledAt: new Date() },
                  },
            ),
        );
        prisma.tx.membership.findMany.mockResolvedValue([{ userId: 'cible' }]);
      }

      it.each([
        ['s’inscrire', () => service.inscrireConjonction(GRANT_SE1, 'se1', 'u1')],
        ['se désinscrire', () => service.desinscrireConjonction(GRANT_SE1, 'se1', 'u1')],
        ['réserver une place', () => service.reserverPlace(GRANT_SE1, 'se1', 'cible')],
        ['retirer une réservation', () => service.retirerReservation(GRANT_SE1, 'se1', 'cible')],
        ['accepter une place', () => service.accepterReservation(GRANT_SE1, 'se1', 'u1')],
      ])('%s est refusé (400), sans écriture ni émission', async (_label, act) => {
        lockedCancelled();

        const refusal = act();

        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
        expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
        expect(prisma.tx.inscription.deleteMany).not.toHaveBeenCalled();
        expect(prisma.tx.inscription.updateMany).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('la modification par l’hôte est refusée (400), sous le verrou', async () => {
        existing({ cancelledAt: new Date() });

        await expect(
          service.updateHosted(GRANT_E1, 'e1', {
            title: 'X',
            seance: {
              date: dayStart(inDays(9)),
              slot: 'EVENING',
              lieu: null,
              heureRdv: null,
              notePratique: null,
              capacity: null,
            },
          }),
        ).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
        expect(prisma.tx.event.update).not.toHaveBeenCalled();
        expect(realtime.emit).not.toHaveBeenCalled();
      });

      it('voter, fixer la date ou prolonger le vote (lockConjonction) est refusé (400)', async () => {
        prisma.tx.seance.findUnique
          .mockResolvedValueOnce({ event: { id: 'e1', partieId: 'p1' } })
          .mockResolvedValueOnce({ startDate: null, event: { cancelledAt: new Date() } });

        await expect(
          service.lockConjonction(prisma.tx as never, { id: 'poll-1', partieId: 'p1' }),
        ).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
      });

      it('un vote est refusé en amont (assertCanVote, 400)', async () => {
        prisma.seance.findUnique.mockResolvedValue({
          startDate: null,
          inscriptionMax: null,
          inscriptions: [],
          event: {
            partieId: 'p1',
            ownerId: 'hote',
            cancelledAt: new Date(),
            partie: {
              id: 'p1',
              kind: 'CAMPAGNE_EPISODIQUE',
              gameSystemId: 'ralliement',
              closedAt: null,
            },
          },
        });

        await expect(
          service.assertCanVote(
            { id: 'poll-1', partieId: 'p1', expiresAt: new Date(Date.now() + 86_400_000) },
            { kind: 'CAMPAGNE_EPISODIQUE' },
            'hote',
          ),
        ).rejects.toThrow(CANCELLED_EVENT_MESSAGE);
      });
    });

    describe('la carte et les lectures', () => {
      it('listCards() dit « annulée » et ne sert plus de sondage', async () => {
        prisma.event.findMany.mockResolvedValue([
          {
            id: 'e1',
            title: 'Catane',
            ownerId: 'hote',
            cancelledAt: new Date(),
            owner: { displayName: 'Léa' },
            seances: [
              {
                id: 'se1',
                startDate: null,
                startSlot: null,
                lieu: null,
                heureRdv: null,
                notePratique: null,
                inscriptionMax: null,
                pollId: 'poll-1',
              },
            ],
          },
        ]);
        prisma.sessionPoll.findMany.mockResolvedValue([
          {
            id: 'poll-1',
            expiresAt: null,
            status: 'CLOSED',
            options: [],
            votes: [],
          },
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.cancelled).toBe(true);
        expect(card.poll).toBeNull();
      });

      it('listCards() : une conjonction non annulée n’est pas « annulée »', async () => {
        prisma.event.findMany.mockResolvedValue([
          {
            id: 'e1',
            title: 'Catane',
            ownerId: 'hote',
            cancelledAt: null,
            owner: { displayName: 'Léa' },
            seances: [],
          },
        ]);

        const [card] = await service.listCards(GRANT_P1, 'viewer');

        expect(card.cancelled).toBe(false);
      });

      it('occupiedSpansOf() ne lit que les événements non annulés', async () => {
        prisma.partie.findMany.mockResolvedValue([
          { id: 'B', kind: 'ONE_SHOT', ownerId: 'mjB', memberships: [{ userId: 'u1' }] },
        ]);
        prisma.seance.findMany.mockResolvedValue([]);

        await service.occupiedSpansOf(['u1']);

        expect(callArg<{ where: unknown }>(prisma.seance.findMany).where).toEqual({
          event: { partieId: { in: ['B'] }, cancelledAt: null },
        });
      });

      it('ownEventsOf() exclut les parties que l’utilisateur a retirées de sa liste (Story 42.5)', async () => {
        prisma.partie.findMany.mockResolvedValue([]);

        await service.ownEventsOf('me', jest.fn().mockResolvedValue(new Map()), {
          fromMs: 0,
          toMs: 1,
        });

        expect(callArg<{ where: unknown }>(prisma.partie.findMany).where).toEqual({
          OR: [{ ownerId: 'me' }, { memberships: { some: { userId: 'me' } } }],
          hiddenBy: { none: { userId: 'me' } },
        });
      });

      it('ownEventsOf() ne lit que les événements non annulés', async () => {
        prisma.partie.findMany.mockResolvedValue([
          { id: 'A', name: 'Ma Partie', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' },
        ]);
        prisma.seance.findMany.mockResolvedValue([]);

        await service.ownEventsOf('me', jest.fn().mockResolvedValue(new Map()), {
          fromMs: 0,
          toMs: 1,
        });

        expect(callArg<{ where: unknown }>(prisma.seance.findMany).where).toEqual({
          event: { partieId: { in: ['A'] }, cancelledAt: null },
        });
      });
    });

    describe('cancellationNotice()', () => {
      const notice = (over: Record<string, unknown> = {}) =>
        prisma.event.findUnique.mockResolvedValue({
          title: 'Catane',
          partieId: 'p1',
          ownerId: 'hote',
          cancelledAt: new Date(),
          owner: { id: 'hote', email: 'hote@example.com' },
          partie: { kind: 'CAMPAGNE_EPISODIQUE', memberships: [] },
          seances: [
            {
              startDate: new Date('2026-11-14T00:00:00Z'),
              startSlot: 'EVENING',
              inscriptions: [
                { user: { id: 'a', email: 'a@example.com' } },
                { user: { id: 'b', email: 'b@example.com' } },
                { user: { id: 'a', email: 'a@example.com' } },
              ],
            },
          ],
          ...over,
        });

      it('quand l’hôte annule : inscrits confirmés et réservés, l’hôte exclu, dédoublonnés', async () => {
        notice();
        prisma.user.findUnique.mockResolvedValue({ displayName: 'Léa' });

        const result = await service.cancellationNotice('e1', 'hote');

        expect(result).toEqual({
          partieId: 'p1',
          eventTitle: 'Catane',
          actorName: 'Léa',
          startDate: new Date('2026-11-14T00:00:00Z'),
          startSlot: 'EVENING',
          endDate: null,
          endSlot: null,
          recipients: [
            { id: 'a', email: 'a@example.com' },
            { id: 'b', email: 'b@example.com' },
          ],
        });
      });

      it('quand un administrateur annule : l’hôte est prévenu aussi, l’auteur jamais', async () => {
        notice();
        prisma.user.findUnique.mockResolvedValue({ displayName: 'Marc' });

        const result = await service.cancellationNotice('e1', 'a');

        expect(result?.actorName).toBe('Marc');
        expect(result?.recipients.map((r) => r.id)).toEqual(['hote', 'b']);
      });

      it('soirée isolée : les membres de la soirée (pas d’inscriptions), l’hôte qui annule exclu', async () => {
        notice({
          partie: {
            kind: 'ONE_SHOT',
            memberships: [
              { user: { id: 'hote', email: 'hote@example.com' } },
              { user: { id: 'm1', email: 'm1@example.com' } },
              { user: { id: 'm2', email: 'm2@example.com' } },
            ],
          },
        });
        prisma.user.findUnique.mockResolvedValue({ displayName: 'Léa' });

        const result = await service.cancellationNotice('e1', 'hote');

        expect(result?.recipients.map((r) => r.id)).toEqual(['m1', 'm2']);
      });

      it('conjonction disparue ou pas annulée → null', async () => {
        prisma.event.findUnique.mockResolvedValue(null);
        await expect(service.cancellationNotice('e1', 'hote')).resolves.toBeNull();

        notice({ cancelledAt: null });
        await expect(service.cancellationNotice('e1', 'hote')).resolves.toBeNull();
      });
    });
  });

  // Story 42.3 — annuler les conjonctions à venir de qui quitte le groupe (AD-17).
  describe('cancelUpcomingHostedInTx() — départ d’un hôte (Story 42.3)', () => {
    const hosted = (id: string, pollIds: (string | null)[] = [null]) => ({
      id,
      seances: pollIds.map((pollId) => ({ pollId })),
    });

    it('lit les conjonctions À VENIR de l’hôte (sans date, ou jour ≥ aujourd’hui) non annulées, triées par identifiant', async () => {
      prisma.tx.event.findMany.mockResolvedValue([]);

      await expect(
        service.cancelUpcomingHostedInTx(prisma.tx as never, 'p1', 'hote', jest.fn()),
      ).resolves.toEqual([]);

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      expect(prisma.tx.event.findMany).toHaveBeenCalledWith({
        where: {
          partieId: 'p1',
          ownerId: 'hote',
          cancelledAt: null,
          seances: {
            some: {
              OR: [
                { startDate: null },
                { endDate: { gte: startOfToday } },
                { endDate: null, startDate: { gte: startOfToday } },
              ],
            },
          },
        },
        select: { id: true, seances: { select: { pollId: true } } },
        orderBy: { id: 'asc' },
      });
      // Rien à annuler : ni verrou, ni écriture.
      expect(prisma.tx.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.tx.event.updateMany).not.toHaveBeenCalled();
    });

    it('verrouille chaque Event dans l’ordre, écrit cancelledAt, ferme les sondages, recalcule la prochaine date, sans émettre', async () => {
      prisma.tx.event.findMany.mockResolvedValue([hosted('e1', ['poll-1']), hosted('e2')]);
      prisma.tx.event.updateMany.mockResolvedValue({ count: 2 });
      const closePolls = jest.fn().mockResolvedValue(1);

      const ids = await service.cancelUpcomingHostedInTx(
        prisma.tx as never,
        'p1',
        'hote',
        closePolls,
      );

      expect(ids).toEqual(['e1', 'e2']);
      const locks = prisma.tx.$queryRaw.mock.calls.map((c) => [(c[0] as string[]).join('?'), c[1]]);
      expect(locks.slice(0, 2).map((l) => l[1])).toEqual(['e1', 'e2']);
      expect(String(locks[0][0])).toContain('FROM "Event"');
      // Le recalcul de la prochaine date reprend le verrou de la partie, déjà tenu par l’appelant.
      expect(String(locks[2][0])).toContain('FROM "Partie"');
      expect(prisma.tx.event.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1', 'e2'] }, cancelledAt: null },
        data: { cancelledAt: expect.any(Date) },
      });
      expect(closePolls).toHaveBeenCalledWith(prisma.tx, ['poll-1']);
      expect(prisma.tx.seance.findMany).toHaveBeenCalledWith(
        objectLike({
          where: { AND: [{ event: { partieId: 'p1', cancelledAt: null } }, VISIBLE_SEANCE_WHERE] },
        }),
      );
      expect(realtime.emit).not.toHaveBeenCalled();
    });

    it('rien d’écrit en dessous du verrou (annulée entre-temps) : aucun sondage fermé, aucune annulation rendue', async () => {
      prisma.tx.event.findMany.mockResolvedValue([hosted('e1', ['poll-1'])]);
      prisma.tx.event.updateMany.mockResolvedValue({ count: 0 });
      const closePolls = jest.fn();

      await expect(
        service.cancelUpcomingHostedInTx(prisma.tx as never, 'p1', 'hote', closePolls),
      ).resolves.toEqual([]);
      expect(closePolls).not.toHaveBeenCalled();
    });
  });
});
