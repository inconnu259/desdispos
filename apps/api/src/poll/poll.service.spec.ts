import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DATE_ALREADY_FIXED_MESSAGE,
  EXTEND_INVALID_DAY_MESSAGE,
  EXTEND_NOT_LATER_MESSAGE,
  GROUP_POLL_OPTION_BOUNDS,
  PAST_OPTION_MESSAGE,
  POLL_DEADLINE_PAST_MESSAGE,
  POLL_FULL_DAY_SPAN_MESSAGE,
  PollService,
} from './poll.service';
import { GROUP_POLL_CHOOSE_PORT } from './ports/group-poll-choose.port';
import { GROUP_POLL_EXTEND_PORT } from './ports/group-poll-extend.port';
import { GROUP_POLL_VOTE_PORT } from './ports/group-poll-vote.port';
import { PARTIE_SIGNALS_PORT } from './ports/partie-signals.port';
import { RENDEZ_VOUS_DURATION_PORT } from './ports/rendez-vous-duration.port';
import { SEANCE_DATE_PORT } from './ports/seance-date.port';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { anyOf, callArg, mockCalls } from '../common/test-utils/jest-typed';
import { HIDDEN_DRAFT_POLL_WHERE, VISIBLE_POLL_WHERE } from '../permissions/scenario-visibility';
import type { DaySlot } from '@master-jdr/shared';

/**
 * Mock construit sans annotation `: any` : l'inference donne un vrai type aux modeles et a leurs
 * `jest.fn()`, ce qui type les assertions au lieu de les laisser passer en aveugle.
 */
function makePrisma() {
  const models = {
    sessionPoll: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      // Anti-spoil serveur : « ce vote est-il celui d'un brouillon caché ? » (0 = non, par défaut).
      count: jest.fn().mockResolvedValue(0),
    },
    pollVote: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    pollOption: {
      findUnique: jest.fn(),
      // Story 36.10 — la mutation d'options n'utilise QUE ces trois-là. `update` est présent
      // uniquement pour pouvoir asserter qu'il n'est JAMAIS appelé : une option conservée garde
      // son id et ne subit aucune écriture.
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    partie: {
      update: jest.fn(),
    },
    // Story 36.6 — effectif de la troupe porté par SessionPollDto.membersCount. 0 Membership par
    // défaut, ce qui donne un effectif de 1 (le MJ) : sans effet sur les tests existants, qui
    // n'assertent pas sur la forme du DTO.
    membership: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
  // $transaction exécute le callback avec le même mock en guise de `tx`. Construit en deux temps :
  // il doit référencer les modèles qui l'accompagnent, ce qu'un littéral unique ne permet pas
  // sans retomber sur `any`.
  return {
    ...models,
    $transaction: jest.fn((fn: (tx: typeof models) => unknown) => fn(models)),
  };
}

/** Story 37.8 : `PartieSignalsPort` — port de la couche 1, implémenté par `parties/`. */
function makePartieSignals() {
  return {
    notifyChanged: jest.fn().mockResolvedValue(undefined),
  };
}

/** Story 37.6 — les droits sont décidés par `PermissionService.assert()`, simulé ici. */
function makePermissions() {
  // Par défaut l'appelant est le MJ de `p1` (aucune restriction anti-spoil) ; les tests joueurs
  // reconfigurent l'autorisation.
  return { assert: jest.fn().mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'mj')) };
}

/** Autorisation délivrée par `ScenariosService.createSeancePoll()` à `create()` (MJ de `p1`). */
const GRANT_P1 = testGrant({ id: 'p1', ownerId: 'mj1' });

/** Story 37.8 : `SeanceDatePort` — port de la couche 1, implémenté par `events/`. */
function makeSeanceDate() {
  return { chooseDate: jest.fn().mockResolvedValue(undefined) };
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

/** Story 47.4 : `RendezVousDurationPort` — implémenté par `events/` (durée inchangée de 1 par défaut). */
function makeDuration() {
  return {
    setDurationInTx: jest.fn().mockResolvedValue({ changed: false, durationSlots: 1 }),
    durationsOf: jest.fn((ids: readonly string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, 1]))),
    ),
  };
}

function opt(date: string, slot: DaySlot) {
  return { date, slot };
}

function makePoll() {
  return {
    id: 'poll1',
    partieId: 'p1',
    status: 'OPEN',
    scenarioRef: null,
    expiresAt: null,
    chosenDate: null,
    chosenSlot: null,
    createdById: 'mj1',
    createdAt: new Date(),
    options: [],
  };
}

describe('PollService', () => {
  let service: PollService;
  let prisma: ReturnType<typeof makePrisma>;
  let partieSignals: ReturnType<typeof makePartieSignals>;
  let permissions: ReturnType<typeof makePermissions>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;
  let seanceDate: ReturnType<typeof makeSeanceDate>;
  let groupVotes: { assertCanVote: jest.Mock; lockConjonction: jest.Mock };
  let groupChoice: { assertCanChoose: jest.Mock; notifyDateFixed: jest.Mock };
  let groupExtension: { assertCanExtend: jest.Mock };
  let duration: ReturnType<typeof makeDuration>;

  beforeEach(async () => {
    prisma = makePrisma();
    duration = makeDuration();
    partieSignals = makePartieSignals();
    permissions = makePermissions();
    realtimeEvents = makeRealtimeEvents();
    seanceDate = makeSeanceDate();
    groupVotes = {
      assertCanVote: jest.fn().mockResolvedValue(undefined),
      // Story 40.6 : verrou de la conjonction pris dans la transaction d'écriture d'un vote de groupe.
      lockConjonction: jest.fn().mockResolvedValue({ dated: false }),
    };
    groupChoice = {
      assertCanChoose: jest.fn().mockResolvedValue(undefined),
      notifyDateFixed: jest.fn().mockResolvedValue(undefined),
    };
    groupExtension = { assertCanExtend: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        PollService,
        { provide: PrismaService, useValue: prisma },
        { provide: PARTIE_SIGNALS_PORT, useValue: partieSignals },
        { provide: PermissionService, useValue: permissions },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
        { provide: SEANCE_DATE_PORT, useValue: seanceDate },
        { provide: GROUP_POLL_VOTE_PORT, useValue: groupVotes },
        { provide: GROUP_POLL_CHOOSE_PORT, useValue: groupChoice },
        { provide: GROUP_POLL_EXTEND_PORT, useValue: groupExtension },
        { provide: RENDEZ_VOUS_DURATION_PORT, useValue: duration },
      ],
    }).compile();
    service = module.get(PollService);
  });

  it('create() → crée sans jamais appeler findFirst/updateMany (Story 8.8)', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
    });
    expect(prisma.sessionPoll.findFirst).not.toHaveBeenCalled();
    expect(prisma.sessionPoll.updateMany).not.toHaveBeenCalled();
    expect(prisma.sessionPoll.create).toHaveBeenCalledTimes(1);
  });

  it('create() avec un poll OPEN déjà existant sur la Partie → ne le ferme pas (Story 8.8, un vote par Séance, pas par Partie)', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
    });
    expect(prisma.sessionPoll.findFirst).not.toHaveBeenCalled();
    expect(prisma.sessionPoll.updateMany).not.toHaveBeenCalled();
    expect(prisma.sessionPoll.create).toHaveBeenCalledTimes(1);
  });

  it('create() → exécute create dans une transaction Prisma', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ── Story 45.4 — la fin du vote : `defaultPollDeadline`, ou celle choisie ──

  /** Clé de jour `YYYY-MM-DD` (UTC) décalée de `days` jours par rapport à aujourd'hui. */
  const inDays = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().substring(0, 10);
  const endOf = (key: string) => new Date(`${key}T23:59:59.999Z`);
  const writtenDeadline = () =>
    callArg<{ data: { expiresAt: Date } }>(prisma.sessionPoll.create).data.expiresAt;

  it('create() sans échéance, créneaux lointains → la fin de vote proposée : dans 14 jours, fin de ce jour', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt(inDays(60), 'MORNING'), opt(inDays(61), 'AFTERNOON')],
    });
    expect(writtenDeadline()).toEqual(endOf(inDays(14)));
  });

  it('create() sans échéance, premier créneau proche → la veille du premier créneau', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt(inDays(5), 'MORNING'), opt(inDays(9), 'AFTERNOON')],
    });
    expect(writtenDeadline()).toEqual(endOf(inDays(4)));
  });

  it('create() sans échéance, premier créneau aujourd’hui → aujourd’hui, jamais avant', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt(inDays(0), 'EVENING'), opt(inDays(3), 'AFTERNOON')],
    });
    expect(writtenDeadline()).toEqual(endOf(inDays(0)));
  });

  it('create() avec une échéance → la fin de CE jour, quels que soient les créneaux (après le premier permis)', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt(inDays(5), 'MORNING'), opt(inDays(9), 'AFTERNOON')],
      expiresAt: inDays(7),
    });
    expect(writtenDeadline()).toEqual(endOf(inDays(7)));
  });

  it('create() avec une échéance PASSÉE → 400, rien d’écrit', async () => {
    await expect(
      service.create(GRANT_P1, 'mj1', {
        options: [opt(inDays(5), 'MORNING'), opt(inDays(9), 'AFTERNOON')],
        expiresAt: inDays(-1),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.sessionPoll.create).not.toHaveBeenCalled();
  });

  it('create() avec une échéance qui n’est pas un vrai jour → 400, rien d’écrit', async () => {
    await expect(
      service.create(GRANT_P1, 'mj1', {
        options: [opt(inDays(5), 'MORNING'), opt(inDays(9), 'AFTERNOON')],
        expiresAt: '2026-02-30',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.sessionPoll.create).not.toHaveBeenCalled();
  });

  it('create() → émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
    });
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it('create() → notifie aussi PartieSignalsPort.notifyChanged (Story 29.7, AD-14, signal AUCUNE_DATE_NI_VOTE)', async () => {
    prisma.sessionPoll.create.mockResolvedValue(makePoll());
    await service.create(GRANT_P1, 'mj1', {
      options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
    });
    expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
  });

  describe('membersCount — effectif de la troupe (Story 36.6, AC7/AC9)', () => {
    it('create() → renvoie un membersCount = MJ + Membership', async () => {
      prisma.membership.count.mockResolvedValue(3);
      prisma.sessionPoll.create.mockResolvedValue(makePoll());
      const dto = await service.create(GRANT_P1, 'mj1', {
        options: [opt('2026-08-01', 'MORNING')],
      });
      expect(dto.membersCount).toBe(4);
      expect(prisma.membership.count).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
    });

    it('findOpen() → renvoie le même effectif que create()', async () => {
      prisma.membership.count.mockResolvedValue(3);
      prisma.sessionPoll.findFirst.mockResolvedValue(makePoll());
      const dto = await service.findOpen('p1', 'u1');
      expect(dto?.membersCount).toBe(4);
    });

    it('une partie sans aucun membre a un effectif de 1 — le MJ, qui vote (castVote ouvert au MJ comme aux membres, POLL_VOTE)', async () => {
      prisma.membership.count.mockResolvedValue(0);
      prisma.sessionPoll.findFirst.mockResolvedValue(makePoll());
      const dto = await service.findOpen('p1', 'mj1');
      expect(dto?.membersCount).toBe(1);
    });

    it('Story 47.4 — findOpen() porte la durée du rendez-vous, lue par le port', async () => {
      prisma.sessionPoll.findFirst.mockResolvedValue(makePoll());
      duration.durationsOf.mockResolvedValue(new Map([['poll1', 6]]));
      const dto = await service.findOpen('p1', 'u1');
      expect(dto?.durationSlots).toBe(6);
      expect(duration.durationsOf).toHaveBeenCalledWith(['poll1']);
    });

    it('findOpen() sans poll ouvert → aucun comptage inutile', async () => {
      prisma.sessionPoll.findFirst.mockResolvedValue(null);
      const dto = await service.findOpen('p1', 'u1');
      expect(dto).toBeNull();
      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });

  describe('anti-spoil serveur — vote de la séance d’un brouillon caché', () => {
    const joueur = () => permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));

    it('findOpen() : un joueur ne lit que les votes hors brouillon caché (fragment partagé), le MJ lit tout', async () => {
      prisma.sessionPoll.findFirst.mockResolvedValue(null);

      joueur();
      await service.findOpen('p1', 'u1');
      expect(prisma.sessionPoll.findFirst).toHaveBeenLastCalledWith({
        where: { AND: [{ partieId: 'p1', status: 'OPEN' }, VISIBLE_POLL_WHERE] },
        include: expect.anything() as unknown,
      });

      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'mj'));
      await service.findOpen('p1', 'mj1');
      expect(prisma.sessionPoll.findFirst).toHaveBeenLastCalledWith({
        where: { partieId: 'p1', status: 'OPEN' },
        include: expect.anything() as unknown,
      });
    });

    it('échec FERMÉ : un rôle autre que MJ (ici admin) est filtré comme un joueur', async () => {
      prisma.sessionPoll.findFirst.mockResolvedValue(null);
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'admin'));

      await service.findOpen('p1', 'u1');

      expect(prisma.sessionPoll.findFirst).toHaveBeenLastCalledWith({
        where: { AND: [{ partieId: 'p1', status: 'OPEN' }, VISIBLE_POLL_WHERE] },
        include: expect.anything() as unknown,
      });
    });

    it('castVote() : un joueur sur le vote d’un brouillon caché reçoit l’erreur d’un vote inconnu, aucun vote écrit', async () => {
      joueur();
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'OPEN',
      });
      prisma.sessionPoll.count.mockResolvedValue(1);

      const promise = service.castVote('p1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Poll introuvable ou fermé');
      expect(prisma.sessionPoll.count).toHaveBeenCalledWith({
        where: { AND: [{ id: 'poll1' }, HIDDEN_DRAFT_POLL_WHERE] },
      });
      expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('withdrawVote() : même refus pour un joueur, aucune suppression', async () => {
      joueur();
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'OPEN',
      });
      prisma.sessionPoll.count.mockResolvedValue(1);

      await expect(service.withdrawVote('p1', 'poll1', 'opt1', 'u1')).rejects.toThrow(
        'Poll introuvable ou fermé',
      );
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalled();
    });

    it('le MJ vote sur le vote d’un brouillon : aucune requête de masquage', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'mj'));
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'OPEN',
      });
      prisma.pollOption.findUnique.mockResolvedValue({ id: 'opt1', pollId: 'poll1' });
      prisma.pollVote.upsert.mockResolvedValue({});

      await service.castVote('p1', 'poll1', 'mj1', { optionId: 'opt1', answer: 'YES' });

      expect(prisma.sessionPoll.count).not.toHaveBeenCalled();
      expect(prisma.pollVote.upsert).toHaveBeenCalledTimes(1);
    });
  });

  it('create() avec deux options (date,slot) identiques → BadRequestException', async () => {
    await expect(
      service.create(GRANT_P1, 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-01', 'MORNING')],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('🚨 create() — deux options représentant le MÊME instant sous des formats différents → BadRequestException (revue de code, Story 36.10)', async () => {
    // '2026-08-01' et '2026-08-01T00:00:00.000Z' désignent le même instant, mais diffèrent comme
    // chaînes brutes : avant la revue de code, la dédup de create() comparait la chaîne reçue, et
    // ce doublon serait passé — divergent de la clé normalisée qu'utilise setOptions().
    await expect(
      service.create(GRANT_P1, 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-01T00:00:00.000Z', 'MORNING')],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('castVote() deux fois sur la même option → upsert (pas de doublon)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
    });
    prisma.pollVote.upsert.mockResolvedValue({});
    await service.castVote('p1', 'poll1', 'u1', {
      optionId: 'opt1',
      answer: 'YES',
    });
    await service.castVote('p1', 'poll1', 'u1', {
      optionId: 'opt1',
      answer: 'NO',
    });
    expect(prisma.pollVote.upsert).toHaveBeenCalledTimes(2);
    const calls = mockCalls<[{ where: unknown }]>(prisma.pollVote.upsert);
    expect(calls[0][0].where).toEqual({
      optionId_userId: { optionId: 'opt1', userId: 'u1' },
    });
    expect(calls[1][0].where).toEqual({
      optionId_userId: { optionId: 'opt1', userId: 'u1' },
    });
  });

  it('castVote() → émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
    });
    prisma.pollVote.upsert.mockResolvedValue({});
    await service.castVote('p1', 'poll1', 'u1', {
      optionId: 'opt1',
      answer: 'YES',
    });
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it('castVote() → notifie aussi PartieSignalsPort.notifyChanged (Story 29.7, AD-14, signal VOTE_EN_COURS_SANS_REPONSE)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'player'));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
    });
    prisma.pollVote.upsert.mockResolvedValue({});
    await service.castVote('p1', 'poll1', 'u1', {
      optionId: 'opt1',
      answer: 'YES',
    });
    expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
  });

  describe('withdrawVote() (Story 30.1, AD-10)', () => {
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }, 'player'));
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'OPEN',
      });
      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt1',
        pollId: 'poll1',
      });
      prisma.pollVote.deleteMany.mockResolvedValue({ count: 1 });
    });

    it("AC1 — supprime la ligne PollVote de l'appelant sur l'option visée (deleteMany, jamais delete)", async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      expect(prisma.pollVote.deleteMany).toHaveBeenCalledWith({
        where: { optionId: 'opt1', userId: 'u1' },
      });
    });

    it('AC3 — deux retraits par deux utilisateurs différents ne ciblent jamais le userId de l’autre', async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u2');
      const calls = mockCalls<[{ where: unknown }]>(prisma.pollVote.deleteMany);
      expect(calls[0][0].where).toEqual({ optionId: 'opt1', userId: 'u1' });
      expect(calls[1][0].where).toEqual({ optionId: 'opt1', userId: 'u2' });
    });

    it('AC4 — un poll à plusieurs options : le retrait ne cible que l’option visée', async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      expect(prisma.pollVote.deleteMany).toHaveBeenCalledWith({
        where: { optionId: 'opt1', userId: 'u1' },
      });
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalledWith({
        where: { optionId: 'opt2', userId: 'u1' },
      });
    });

    it('idempotent — un second retrait consécutif ne lève jamais (deleteMany tolère 0 ligne)', async () => {
      prisma.pollVote.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.withdrawVote('p1', 'poll1', 'opt1', 'u1')).resolves.toBeUndefined();
    });

    it('retrait sans avoir jamais voté (aucune ligne à supprimer) → résout normalement', async () => {
      prisma.pollVote.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.withdrawVote('p1', 'poll1', 'opt1', 'u1')).resolves.toBeUndefined();
    });

    it('sur un poll CLOSED → BadRequestException, aucune suppression', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'CLOSED',
      });
      await expect(service.withdrawVote('p1', 'poll1', 'opt1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalled();
    });

    it("option inexistante ou n'appartenant pas à ce poll → BadRequestException", async () => {
      prisma.pollOption.findUnique.mockResolvedValue(null);
      await expect(service.withdrawVote('p1', 'poll1', 'opt-inconnu', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalled();
    });

    it('AC5 — n’appelle jamais sessionPoll.update (indépendant de close())', async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartieSignalsPort.notifyChanged (Story 29.7, AD-14, signal VOTE_EN_COURS_SANS_REPONSE)', async () => {
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');
      expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
    });
  });

  it('choose() par non-MJ → ForbiddenException', async () => {
    permissions.assert.mockRejectedValue(new ForbiddenException());
    await expect(service.choose('p1', 'poll1', 'joueur1', { optionId: 'opt1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('choose() → positionne chosenDate/chosenSlot, ferme le poll, délègue la date de séance au port', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    prisma.partie.update.mockResolvedValue({});
    await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'POLL_CHOOSE', { partieId: 'p1' });
    expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
      where: { id: 'poll1' },
      data: { status: 'CLOSED', chosenDate: d, chosenSlot: 'MORNING' },
    });
    // Story 37.8 (AD-15) : la date de séance et `nextSessionDate/Slot` sont écrites par le port.
    expect(seanceDate.chooseDate).toHaveBeenCalledWith(anyOf(Object), 'poll1', d, 'MORNING');
    // PollService n'écrit JAMAIS `Partie` : `events/` est l'unique écrivain de la prochaine séance.
    expect(prisma.partie.update).not.toHaveBeenCalled();
  });

  it('choose() → ferme le poll ET délègue la plage de la séance au port dans la même transaction (Stories 37.4, 37.8)', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.partie.update.mockResolvedValue({});
    // Client de transaction DISTINCT du client racine : une écriture faite hors transaction
    // passerait par `prisma.sessionPoll.update` et ferait échouer ce test.
    // Story 47.5 : le vote et l'option sont relus DANS la transaction, donc sur ce client-là.
    const tx = {
      sessionPoll: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ id: 'poll1', partieId: 'p1', status: 'OPEN' }),
      },
      pollOption: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'opt1', pollId: 'poll1', date: d, slot: 'MORNING' }),
      },
    };
    prisma.$transaction.mockImplementationOnce((fn: (t: never) => unknown) => fn(tx as never));
    await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sessionPoll.update).toHaveBeenCalledWith({
      where: { id: 'poll1' },
      data: { status: 'CLOSED', chosenDate: d, chosenSlot: 'MORNING' },
    });
    expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    expect(seanceDate.chooseDate).toHaveBeenCalledWith(tx, 'poll1', d, 'MORNING');
  });

  it('choose() → échec du port : ni émission ni notification des signaux (tout ou rien, Stories 37.4, 37.8)', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    seanceDate.chooseDate.mockRejectedValue(new Error('boom'));
    await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' })).rejects.toThrow(
      'boom',
    );
    expect(prisma.partie.update).not.toHaveBeenCalled();
    expect(realtimeEvents.emit).not.toHaveBeenCalled();
    expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
  });

  it('choose() → émet un événement temps réel scopé sur la Partie, après la résolution des DEUX écritures (Story 18.1, AC1)', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    prisma.partie.update.mockResolvedValue({});
    await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it('choose() → notifie aussi PartieSignalsPort.notifyChanged (Story 29.7, AD-14)', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    prisma.partie.update.mockResolvedValue({});
    await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });
    expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
  });

  it('choose() sur le même créneau déjà actif → PollService n’écrit pas Partie (la remise à zéro du rappel est décidée par events/, Story 37.8)', async () => {
    const d = new Date('2026-08-01T00:00:00.000Z');
    permissions.assert.mockResolvedValue(
      testGrant({
        id: 'p1',
        ownerId: 'mj1',
        nextSessionDate: d,
        nextSessionSlot: 'MORNING',
      }),
    );
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.pollOption.findUnique.mockResolvedValue({
      id: 'opt1',
      pollId: 'poll1',
      date: d,
      slot: 'MORNING',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });
    expect(prisma.partie.update).not.toHaveBeenCalled();
    expect(seanceDate.chooseDate).toHaveBeenCalledWith(anyOf(Object), 'poll1', d, 'MORNING');
  });

  describe('choose() JDR — fixation sous verrou (Story 47.5, AD-11)', () => {
    const d = new Date('2026-11-13T00:00:00.000Z');
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'OPEN',
      });
      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt2',
        pollId: 'poll1',
        date: d,
        slot: 'EVENING',
      });
      prisma.sessionPoll.update.mockResolvedValue({});
    });

    it('prend le verrou (durée absente = verrous seulement) AVANT de relire le vote et l’option, puis ferme et écrit la date', async () => {
      const order: string[] = [];
      duration.setDurationInTx.mockImplementation(() => {
        order.push('verrou');
        return Promise.resolve({ changed: false, durationSlots: 6 });
      });
      let reads = 0;
      prisma.sessionPoll.findUnique.mockImplementation(() => {
        // 1re lecture : à qui est le vote (avant tout verrou) ; 2e : relecture complète sous le verrou.
        order.push(++reads === 1 ? 'proprietaire' : 'relit-vote');
        return Promise.resolve({ id: 'poll1', partieId: 'p1', status: 'OPEN' });
      });
      prisma.pollOption.findUnique.mockImplementation(() => {
        order.push('relit-option');
        return Promise.resolve({ id: 'opt2', pollId: 'poll1', date: d, slot: 'EVENING' });
      });
      prisma.sessionPoll.update.mockImplementation(() => {
        order.push('ferme');
        return Promise.resolve({});
      });
      seanceDate.chooseDate.mockImplementation(() => {
        order.push('date');
        return Promise.resolve();
      });

      await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' });

      expect(duration.setDurationInTx).toHaveBeenCalledWith(anyOf(Object), 'poll1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['proprietaire', 'verrou', 'relit-vote', 'relit-option', 'ferme', 'date']);
      // La date écrite vient de l'option RELUE sous le verrou.
      expect(seanceDate.chooseDate).toHaveBeenCalledWith(anyOf(Object), 'poll1', d, 'EVENING');
    });

    it('option disparue (purgée par un changement de durée) → 404 « Option introuvable », rien n’est écrit ni émis', async () => {
      prisma.pollOption.findUnique.mockResolvedValue(null);

      const refusal = service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' });
      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow('Option introuvable');
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('vote fermé ou d’une autre partie, relu sous le verrou → refus, rien n’est écrit', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'p1',
        status: 'CLOSED',
      });
      await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' })).rejects.toThrow(
        BadRequestException,
      );
      prisma.sessionPoll.findUnique.mockResolvedValue({
        id: 'poll1',
        partieId: 'autre',
        status: 'OPEN',
      });
      await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
    });

    it('vote d’une AUTRE partie ou inconnu → 404 AVANT tout verrou : le port de durée n’est jamais appelé', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({ id: 'poll1', partieId: 'autre' });
      await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' })).rejects.toThrow(
        NotFoundException,
      );
      prisma.sessionPoll.findUnique.mockResolvedValue(null);
      await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' })).rejects.toThrow(
        NotFoundException,
      );
      expect(duration.setDurationInTx).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
    });

    it('option d’un AUTRE vote → 404', async () => {
      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt2',
        pollId: 'autre',
        date: d,
        slot: 'EVENING',
      });
      await expect(service.choose('p1', 'poll1', 'mj1', { optionId: 'opt2' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });
  });

  it('close() sur un poll OPEN → le ferme', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    await service.close('p1', 'poll1', 'mj1');
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'POLL_CLOSE', { partieId: 'p1' });
    expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
      where: { id: 'poll1' },
      data: { status: 'CLOSED' },
    });
  });

  it('close() → émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    await service.close('p1', 'poll1', 'mj1');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it('close() → notifie aussi PartieSignalsPort.notifyChanged (Story 29.7, AD-14)', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'OPEN',
    });
    prisma.sessionPoll.update.mockResolvedValue({});
    await service.close('p1', 'poll1', 'mj1');
    expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
  });

  it('close() sur un poll déjà CLOSED → BadRequestException', async () => {
    permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
    prisma.sessionPoll.findUnique.mockResolvedValue({
      id: 'poll1',
      partieId: 'p1',
      status: 'CLOSED',
    });
    await expect(service.close('p1', 'poll1', 'mj1')).rejects.toThrow(BadRequestException);
    expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
  });

  // ─── Story 36.10 (D-16) — mutation des options d'un vote ouvert ───────────
  describe('setOptions()', () => {
    /** Poll de départ à DEUX options, chacune portant une réponse. C'est le jeu qui rend
     *  observable l'invariant central : une option conservée ne doit subir AUCUNE écriture. */
    function pollWithOptions() {
      return {
        ...makePoll(),
        options: [
          {
            id: 'optA',
            pollId: 'poll1',
            date: new Date('2026-08-01T00:00:00.000Z'),
            slot: 'MORNING',
            votes: [
              {
                userId: 'u1',
                answer: 'YES',
                user: { pseudo: 'Léa', displayName: 'Léa' },
              },
            ],
          },
          {
            id: 'optB',
            pollId: 'poll1',
            date: new Date('2026-08-02T00:00:00.000Z'),
            slot: 'AFTERNOON',
            votes: [
              {
                userId: 'u2',
                answer: 'NO',
                user: { pseudo: 'Tom', displayName: 'Tom' },
              },
            ],
          },
        ],
      };
    }

    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.sessionPoll.findUnique.mockResolvedValue(pollWithOptions());
    });

    it('→ MJ seul : un refus du service de permission fait rejeter la mutation, sans aucune écriture (AC8)', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());
      await expect(
        service.setOptions('p1', 'poll1', 'joueur1', {
          options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
      expect(prisma.pollOption.createMany).not.toHaveBeenCalled();
    });

    // ── Story 45.4 — la fin du vote d'un vote de JDR ──
    const dayIn = (days: number) =>
      new Date(Date.now() + days * 86_400_000).toISOString().substring(0, 10);
    const keep = [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')];

    it('une NOUVELLE fin du vote est écrite (repousser la fin EST la prolongation du JDR), relance ré-armée', async () => {
      await service.setOptions('p1', 'poll1', 'mj1', { options: keep, expiresAt: dayIn(20) });
      expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        data: { expiresAt: new Date(`${dayIn(20)}T23:59:59.999Z`), relanceSentAt: null },
      });
    });

    it('sans `expiresAt` : la fin actuelle est gardée, aucune écriture de l’échéance', async () => {
      await service.setOptions('p1', 'poll1', 'mj1', { options: keep });
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('une NOUVELLE fin déjà passée → 400, rien d’écrit', async () => {
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', { options: keep, expiresAt: dayIn(-1) }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('une fin INCHANGÉE est acceptée même passée : on corrige les créneaux d’un vote terminé', async () => {
      const past = new Date(`${dayIn(-3)}T23:59:59.999Z`);
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...pollWithOptions(), expiresAt: past });
      await service.setOptions('p1', 'poll1', 'mj1', { options: keep, expiresAt: dayIn(-3) });
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('une fin qui n’est pas un vrai jour → 400', async () => {
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', { options: keep, expiresAt: '2026-13-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('→ poll introuvable : NotFoundException (AC14)', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue(null);
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it("→ poll d'une AUTRE partie : NotFoundException, même si le MJ possède la partie de l'URL (AC14, sécurité)", async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({
        ...pollWithOptions(),
        partieId: 'autre-partie',
      });
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it('→ poll CLOSED : BadRequestException (AC14)', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({
        ...pollWithOptions(),
        status: 'CLOSED',
      });
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it('→ deux options portant la même paire date + slot : BadRequestException (AC14)', async () => {
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'MORNING'), opt('2026-08-01', 'MORNING')],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it('→ moins de 2 options : BadRequestException (AC14, garde de service en plus du DTO)', async () => {
      await expect(
        service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'MORNING')],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it('→ plus de 40 options : BadRequestException (AC14, garde de service en plus du DTO)', async () => {
      const options = Array.from({ length: 41 }, (_, i) =>
        opt(`2026-09-${String(i + 1).padStart(2, '0')}`, 'EVENING'),
      );
      await expect(service.setOptions('p1', 'poll1', 'mj1', { options })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it("🚨 {A,B} → {A,C} : supprime l'id de B et LUI SEUL, crée C seul, et n'écrit JAMAIS sur A (AC5, AC7)", async () => {
      await service.setOptions('p1', 'poll1', 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
      });

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'POLL_OPTIONS_SET', {
        partieId: 'p1',
      });
      // B retirée — et B seule.
      expect(prisma.pollOption.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.pollOption.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['optB'] } },
      });

      // C créée — et C seule.
      expect(prisma.pollOption.createMany).toHaveBeenCalledTimes(1);
      const created = callArg<{ data: { pollId: string; slot: string; date: Date }[] }>(
        prisma.pollOption.createMany,
      ).data;
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ pollId: 'poll1', slot: 'EVENING' });
      expect(created[0].date.toISOString()).toBe('2026-08-03T00:00:00.000Z');

      // 🚨 A conservée : aucune écriture ne la cible, d'aucune manière.
      expect(prisma.pollOption.update).not.toHaveBeenCalled();
      expect(JSON.stringify(prisma.pollOption.deleteMany.mock.calls)).not.toContain('optA');
      expect(JSON.stringify(prisma.pollOption.createMany.mock.calls)).not.toContain('2026-08-01');
    });

    it('→ jeu identique à l’existant : aucune suppression, aucune création (AC5)', async () => {
      await service.setOptions('p1', 'poll1', 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
      });
      expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
      expect(prisma.pollOption.createMany).not.toHaveBeenCalled();
    });

    it('→ suppressions et créations dans UNE SEULE transaction (AC15)', async () => {
      await service.setOptions('p1', 'poll1', 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('→ émet partieTopic ET notifyPartieSignalsChanged, les deux (AC15)', async () => {
      await service.setOptions('p1', 'poll1', 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(partieSignals.notifyChanged).toHaveBeenCalledWith('p1');
    });

    it('→ renvoie le DTO relu, avec membersCount (AC5)', async () => {
      prisma.membership.count.mockResolvedValue(3);
      const dto = await service.setOptions('p1', 'poll1', 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-03', 'EVENING')],
      });
      expect(dto.membersCount).toBe(4);
      expect(dto.id).toBe('poll1');
    });

    describe('durée du rendez-vous (Story 47.4)', () => {
      it('durée absente : verrous seulement (port appelé sans durée), réconciliation, réponses gardées', async () => {
        duration.setDurationInTx.mockResolvedValue({ changed: false, durationSlots: 3 });

        const dto = await service.setOptions('p1', 'poll1', 'mj1', { options: keep });

        expect(duration.setDurationInTx).toHaveBeenCalledWith(
          expect.anything(),
          'poll1',
          undefined,
        );
        expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
        expect(prisma.pollOption.createMany).not.toHaveBeenCalled();
        expect(dto.durationSlots).toBe(3);
      });

      it('durée changée : écrite AVANT les options, toutes recréées (réponses effacées), relance ré-armée', async () => {
        duration.setDurationInTx.mockResolvedValue({ changed: true, durationSlots: 6 });

        const dto = await service.setOptions('p1', 'poll1', 'mj1', {
          options: keep,
          durationSlots: 6,
        });

        expect(duration.setDurationInTx).toHaveBeenCalledWith(expect.anything(), 'poll1', 6);
        expect(prisma.pollOption.deleteMany).toHaveBeenCalledWith({ where: { pollId: 'poll1' } });
        const created = callArg<{ data: { pollId: string; slot: string }[] }>(
          prisma.pollOption.createMany,
        ).data;
        expect(created.map((o) => o.slot)).toEqual(['MORNING', 'AFTERNOON']);
        expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
          where: { id: 'poll1' },
          data: { relanceSentAt: null },
        });
        expect(duration.setDurationInTx.mock.invocationCallOrder[0]).toBeLessThan(
          prisma.pollOption.deleteMany.mock.invocationCallOrder[0],
        );
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(dto.durationSlots).toBe(6);
      });

      it('même durée renvoyée : le port dit « inchangée », aucune purge', async () => {
        duration.setDurationInTx.mockResolvedValue({ changed: false, durationSlots: 3 });

        await service.setOptions('p1', 'poll1', 'mj1', { options: keep, durationSlots: 3 });

        expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
        expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      });

      it('journée entière avec une durée effective de 3 → 400 français, aucune option écrite', async () => {
        duration.setDurationInTx.mockResolvedValue({ changed: true, durationSlots: 3 });

        await expect(
          service.setOptions('p1', 'poll1', 'mj1', {
            options: [opt('2026-08-01', 'FULL_DAY'), opt('2026-08-02', 'AFTERNOON')],
            durationSlots: 3,
          }),
        ).rejects.toThrow(POLL_FULL_DAY_SPAN_MESSAGE);
        expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
        expect(prisma.pollOption.createMany).not.toHaveBeenCalled();
        expect(realtimeEvents.emit).not.toHaveBeenCalled();
      });

      it('journée entière à 1 créneau : acceptée', async () => {
        await service.setOptions('p1', 'poll1', 'mj1', {
          options: [opt('2026-08-01', 'FULL_DAY'), opt('2026-08-02', 'AFTERNOON')],
        });
        expect(prisma.pollOption.createMany).toHaveBeenCalledTimes(1);
      });

      it('le port refuse (vote sans rendez-vous, 404) : l’erreur remonte, rien n’est écrit', async () => {
        duration.setDurationInTx.mockRejectedValue(
          new NotFoundException('Rendez-vous introuvable'),
        );

        await expect(
          service.setOptions('p1', 'poll1', 'mj1', { options: keep, durationSlots: 2 }),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.pollOption.deleteMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('create() avec la durée du rendez-vous (Story 47.4)', () => {
    it('l’écriture rendue à l’appelant crée le vote dans SA transaction, avec la durée effective', async () => {
      prisma.sessionPoll.create.mockResolvedValue(makePoll());
      const tx = { sessionPoll: { create: jest.fn().mockResolvedValue(makePoll()) } };

      const dto = await service.create(
        GRANT_P1,
        'mj1',
        { options: [opt('2026-08-01', 'EVENING'), opt('2026-08-08', 'EVENING')] },
        async (write) => {
          await write(tx as never, 6);
        },
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.sessionPoll.create).toHaveBeenCalledTimes(1);
      expect(dto.durationSlots).toBe(6);
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('journée entière pour 2 créneaux → 400 ; l’erreur remonte par l’appelant, rien n’est émis', async () => {
      const tx = { sessionPoll: { create: jest.fn() } };

      await expect(
        service.create(
          GRANT_P1,
          'mj1',
          { options: [opt('2026-08-01', 'FULL_DAY'), opt('2026-08-08', 'EVENING')] },
          async (write) => {
            await write(tx as never, 2);
          },
        ),
      ).rejects.toThrow(POLL_FULL_DAY_SPAN_MESSAGE);
      expect(tx.sessionPoll.create).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('sans appelant : vote seul, d’une durée 1', async () => {
      prisma.sessionPoll.create.mockResolvedValue(makePoll());
      const dto = await service.create(GRANT_P1, 'mj1', {
        options: [opt('2026-08-01', 'MORNING'), opt('2026-08-02', 'AFTERNOON')],
      });
      expect(dto.durationSlots).toBe(1);
    });
  });

  // ─── Sondage de dates d'une conjonction de groupe (Story 40.5) ───────────────────────────────
  describe('createInTx() — sondage de groupe (Story 40.5)', () => {
    const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
    const options = [
      { date: day('2026-11-14'), slot: 'EVENING' as DaySlot },
      { date: day('2026-11-15'), slot: 'MORNING' as DaySlot },
    ];

    it('écrit dans la transaction de l’appelant, avec l’échéance choisie, sans émettre ni notifier', async () => {
      const tx = { sessionPoll: { create: jest.fn().mockResolvedValue({ id: 'poll-9' }) } };
      const expiresAt = new Date('2026-11-10T23:59:59.999Z');

      const poll = await service.createInTx(tx as never, 'g1', 'host', {
        options,
        expiresAt,
        bounds: GROUP_POLL_OPTION_BOUNDS,
      });

      expect(poll).toEqual({ id: 'poll-9' });
      const data = callArg<{ data: { partieId: string; createdById: string; expiresAt: Date } }>(
        tx.sessionPoll.create,
      ).data;
      expect(data).toEqual(
        expect.objectContaining({ partieId: 'g1', createdById: 'host', expiresAt }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('sans échéance : la fin de vote proposée par la fonction partagée, jamais null', async () => {
      const tx = { sessionPoll: { create: jest.fn().mockResolvedValue({ id: 'p' }) } };
      const far = [
        { date: new Date(Date.now() + 60 * 86_400_000), slot: 'EVENING' as DaySlot },
        { date: new Date(Date.now() + 61 * 86_400_000), slot: 'MORNING' as DaySlot },
      ];
      await service.createInTx(tx as never, 'p1', 'mj1', { options: far });
      const data = callArg<{ data: { expiresAt: Date } }>(tx.sessionPoll.create).data;
      expect(data.expiresAt).toEqual(
        new Date(
          `${new Date(Date.now() + 14 * 86_400_000).toISOString().substring(0, 10)}T23:59:59.999Z`,
        ),
      );
    });

    it('un seul créneau → 400 ; au-delà de la garde technique → 400 ; 41 créneaux acceptés (aucun plafond métier)', async () => {
      const tx = { sessionPoll: { create: jest.fn().mockResolvedValue({ id: 'p' }) } };
      await expect(
        service.createInTx(tx as never, 'g1', 'h', {
          options: options.slice(0, 1),
          bounds: GROUP_POLL_OPTION_BOUNDS,
        }),
      ).rejects.toThrow(BadRequestException);
      const many = (n: number): { date: Date; slot: DaySlot }[] =>
        Array.from({ length: n }, (_, i) => ({
          date: new Date(Date.UTC(2027, 0, 1 + i)),
          slot: 'EVENING',
        }));
      await service.createInTx(tx as never, 'g1', 'h', {
        options: many(41),
        bounds: GROUP_POLL_OPTION_BOUNDS,
      });
      await expect(
        service.createInTx(tx as never, 'g1', 'h', {
          options: many(GROUP_POLL_OPTION_BOUNDS.max + 1),
          bounds: GROUP_POLL_OPTION_BOUNDS,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.sessionPoll.create).toHaveBeenCalledTimes(1);
    });

    it('doublons (même date et créneau) → 400, rien n’est écrit', async () => {
      const tx = { sessionPoll: { create: jest.fn() } };
      await expect(
        service.createInTx(tx as never, 'g1', 'h', {
          options: [options[0], { ...options[0] }],
          bounds: GROUP_POLL_OPTION_BOUNDS,
        }),
      ).rejects.toThrow('Options dupliquées');
      expect(tx.sessionPoll.create).not.toHaveBeenCalled();
    });
  });

  describe('closeInTx() — fermeture du sondage d’une conjonction annulée (Story 42.1)', () => {
    it('ferme le sondage OUVERT dans la transaction de l’appelant, sans rien émettre', async () => {
      const tx = { sessionPoll: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };

      await service.closeInTx(tx as never, 'poll1');

      expect(tx.sessionPoll.updateMany).toHaveBeenCalledWith({
        where: { id: 'poll1', status: 'OPEN' },
        data: { status: 'CLOSED' },
      });
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('un sondage déjà fermé n’est pas touché (le filtre OPEN) et ne lève rien', async () => {
      const tx = { sessionPoll: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };

      await expect(service.closeInTx(tx as never, 'poll1')).resolves.toBeUndefined();
    });
  });

  describe('setOptionsInTx() — créneaux et échéance d’un sondage ouvert (Story 40.5, 47.4)', () => {
    const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
    const future = new Date(Date.now() + 5 * 86_400_000);
    const existing = [
      { id: 'o1', date: day('2026-11-14'), slot: 'EVENING' },
      { id: 'o2', date: day('2026-11-15'), slot: 'MORNING' },
    ];
    const keep = [
      { date: day('2026-11-14'), slot: 'EVENING' as DaySlot },
      { date: day('2026-11-15'), slot: 'MORNING' as DaySlot },
    ];
    let tx: {
      sessionPoll: { findUnique: jest.Mock; update: jest.Mock };
      pollOption: { deleteMany: jest.Mock; createMany: jest.Mock; update: jest.Mock };
    };
    beforeEach(() => {
      tx = {
        sessionPoll: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ status: 'OPEN', expiresAt: future, options: existing }),
          update: jest.fn(),
        },
        pollOption: { deleteMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
      };
    });
    const input = (opts: { date: Date; slot: DaySlot }[], expiresAt = future) => ({
      options: opts,
      expiresAt,
      bounds: GROUP_POLL_OPTION_BOUNDS,
    });

    const NO_PURGE = { purge: false };

    it('réconcilie sur la clé date|slot : le créneau conservé n’est pas touché, le retiré est supprimé, le nouveau créé', async () => {
      await service.setOptionsInTx(
        tx as never,
        'poll1',
        input([
          { date: day('2026-11-14'), slot: 'EVENING' }, // conservé (o1)
          { date: day('2026-11-20'), slot: 'AFTERNOON' }, // nouveau ; o2 retiré
        ]),
        NO_PURGE,
      );

      expect(tx.pollOption.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['o2'] } } });
      expect(tx.pollOption.createMany).toHaveBeenCalledWith({
        data: [{ pollId: 'poll1', date: day('2026-11-20'), slot: 'AFTERNOON' }],
      });
      expect(tx.pollOption.update).not.toHaveBeenCalled();
    });

    it('purge (la durée vient de changer) : toutes les options supprimées puis recréées, relance ré-armée', async () => {
      await service.setOptionsInTx(tx as never, 'poll1', input(keep), { purge: true });

      expect(tx.pollOption.deleteMany).toHaveBeenCalledWith({ where: { pollId: 'poll1' } });
      expect(tx.pollOption.createMany).toHaveBeenCalledWith({
        data: keep.map((o) => ({ pollId: 'poll1', date: o.date, slot: o.slot })),
      });
      expect(tx.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        data: { relanceSentAt: null },
      });
    });

    it('purge avec doublons → 400, rien n’est supprimé', async () => {
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input([keep[0], { ...keep[0] }]), {
          purge: true,
        }),
      ).rejects.toThrow('Options dupliquées');
      expect(tx.pollOption.deleteMany).not.toHaveBeenCalled();
    });

    it('échéance absente : gardée, jamais écrite', async () => {
      await service.setOptionsInTx(
        tx as never,
        'poll1',
        { options: keep, bounds: GROUP_POLL_OPTION_BOUNDS },
        NO_PURGE,
      );
      expect(tx.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('l’échéance modifiée est écrite ; inchangée, rien n’est écrit', async () => {
      await service.setOptionsInTx(tx as never, 'poll1', input(keep), NO_PURGE);
      expect(tx.sessionPoll.update).not.toHaveBeenCalled();
      expect(tx.pollOption.deleteMany).not.toHaveBeenCalled();

      const later = new Date(future.getTime() + 86_400_000);
      await service.setOptionsInTx(tx as never, 'poll1', input(keep, later), NO_PURGE);
      expect(tx.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        // Story 40.7 : une nouvelle échéance ré-arme la relance de la veille.
        data: { expiresAt: later, relanceSentAt: null },
      });
    });

    it('une NOUVELLE échéance passée → 400, rien n’est écrit ; une échéance passée INCHANGÉE est acceptée', async () => {
      const past = new Date(Date.now() - 86_400_000);
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input(keep, past), NO_PURGE),
      ).rejects.toThrow(POLL_DEADLINE_PAST_MESSAGE);
      expect(tx.sessionPoll.update).not.toHaveBeenCalled();

      tx.sessionPoll.findUnique.mockResolvedValue({
        status: 'OPEN',
        expiresAt: past,
        options: existing,
      });
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input(keep, past), NO_PURGE),
      ).resolves.toBeUndefined();
    });

    it('sondage fermé → 400 ; introuvable → 404 ; moins de 2 créneaux → 400', async () => {
      tx.sessionPoll.findUnique.mockResolvedValueOnce({
        status: 'CLOSED',
        expiresAt: future,
        options: existing,
      });
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input(keep), NO_PURGE),
      ).rejects.toThrow('déjà fermé');
      tx.sessionPoll.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input(keep), NO_PURGE),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.setOptionsInTx(tx as never, 'poll1', input([keep[0]]), NO_PURGE),
      ).rejects.toThrow(BadRequestException);
      expect(tx.pollOption.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('vote sur le sondage d’un groupe de ralliement (Story 40.5)', () => {
    const GROUPE = { id: 'g1', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };
    const poll = { id: 'poll1', partieId: 'g1', status: 'OPEN', expiresAt: new Date('2099-01-01') };
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(GROUPE, 'member'));
      prisma.sessionPoll.findUnique.mockResolvedValue(poll);
      prisma.pollOption.findUnique.mockResolvedValue({ id: 'opt1', pollId: 'poll1' });
      prisma.pollVote.upsert.mockResolvedValue({});
    });

    it('castVote : le port décide AVANT toute écriture ; accepté, le vote est écrit', async () => {
      await service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' });

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'POLL_VOTE', { partieId: 'g1' });
      expect(groupVotes.assertCanVote).toHaveBeenCalledWith(poll, GROUPE, 'u1');
      expect(prisma.pollVote.upsert).toHaveBeenCalledTimes(1);
    });

    it('castVote refusé par le port : erreur remontée telle quelle, rien n’est écrit ni émis', async () => {
      groupVotes.assertCanVote.mockRejectedValue(new ForbiddenException('pas éligible'));

      await expect(
        service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' }),
      ).rejects.toThrow('pas éligible');
      expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('withdrawVote refusé par le port : rien n’est supprimé', async () => {
      groupVotes.assertCanVote.mockRejectedValue(new BadRequestException('vote terminé'));

      await expect(service.withdrawVote('g1', 'poll1', 'opt1', 'u1')).rejects.toThrow(
        'vote terminé',
      );
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalled();
    });

    it('un sondage fermé est refusé avant le port', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, status: 'CLOSED' });
      await expect(
        service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' }),
      ).rejects.toThrow('Poll introuvable ou fermé');
      expect(groupVotes.assertCanVote).not.toHaveBeenCalled();
    });

    it('castVote : l’écriture se fait dans UNE transaction, sous le verrou de la conjonction (Story 40.6)', async () => {
      const order: string[] = [];
      groupVotes.lockConjonction.mockImplementation(() => {
        order.push('lock');
        return Promise.resolve({ dated: false });
      });
      prisma.pollVote.upsert.mockImplementation(() => {
        order.push('upsert');
        return Promise.resolve({});
      });

      await service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(groupVotes.lockConjonction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'poll1', partieId: 'g1' }),
      );
      expect(order).toEqual(['lock', 'upsert']);
    });

    it('castVote / withdrawVote : date fixée entre-temps (sous le verrou) → 400, rien n’est écrit', async () => {
      groupVotes.lockConjonction.mockResolvedValue({ dated: true });

      await expect(
        service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' }),
      ).rejects.toThrow(BadRequestException);
      await expect(service.withdrawVote('g1', 'poll1', 'opt1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
      expect(prisma.pollVote.deleteMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('castVote : sondage clos entre-temps (relu sous le verrou) → 400, rien n’est écrit', async () => {
      prisma.sessionPoll.findUnique
        .mockResolvedValueOnce(poll) // lecture initiale, ouvert
        .mockResolvedValueOnce({ status: 'CLOSED' }); // relecture sous le verrou

      await expect(
        service.castVote('g1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' }),
      ).rejects.toThrow('Poll introuvable ou fermé');
      expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
    });

    it('JDR : le port n’est jamais consulté (règles de la Story 37.1 inchangées)', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }, 'player'),
      );
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, partieId: 'p1' });

      await service.castVote('p1', 'poll1', 'u1', { optionId: 'opt1', answer: 'YES' });
      await service.withdrawVote('p1', 'poll1', 'opt1', 'u1');

      expect(groupVotes.assertCanVote).not.toHaveBeenCalled();
      // Story 40.6 : ni verrou ni transaction pour un vote de JDR.
      expect(groupVotes.lockConjonction).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // Story 40.6 — fixer la date d'une conjonction : branche « groupe » de la route partagée `choose`.
  describe('choose() — date d’une conjonction (Story 40.6)', () => {
    const GROUPE = { id: 'g1', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };
    // Un jour à venir (le créneau d'un sondage de groupe ne peut pas être déjà passé).
    const d = new Date(
      `${new Date(Date.now() + 30 * 86_400_000).toISOString().substring(0, 10)}T00:00:00.000Z`,
    );
    const poll = { id: 'poll1', partieId: 'g1', status: 'OPEN', expiresAt: new Date('2020-01-01') };
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(GROUPE, 'member'));
      prisma.sessionPoll.findUnique.mockResolvedValue(poll);
      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt1',
        pollId: 'poll1',
        date: d,
        slot: 'EVENING',
      });
      prisma.sessionPoll.update.mockResolvedValue({});
    });

    it('cellule de rôle sur la partie, droit d’hôte par le port, puis sondage clos + date écrite dans UNE transaction', async () => {
      const order: string[] = [];
      groupChoice.assertCanChoose.mockImplementation(() => {
        order.push('droit');
        return Promise.resolve();
      });
      groupVotes.lockConjonction.mockImplementation(() => {
        order.push('verrou');
        return Promise.resolve({ dated: false });
      });
      prisma.sessionPoll.update.mockImplementation(() => {
        order.push('ferme');
        return Promise.resolve({});
      });
      seanceDate.chooseDate.mockImplementation(() => {
        order.push('date');
        return Promise.resolve();
      });

      await service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' });

      expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_CHOOSE', { partieId: 'g1' });
      expect(groupChoice.assertCanChoose).toHaveBeenCalledWith(
        { id: 'poll1', partieId: 'g1' },
        GROUPE,
        'hote',
      );
      expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        data: { status: 'CLOSED', chosenDate: d, chosenSlot: 'EVENING' },
      });
      expect(seanceDate.chooseDate).toHaveBeenCalledWith(anyOf(Object), 'poll1', d, 'EVENING');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Le droit précède toute écriture ; le verrou précède la fermeture, elle-même suivie de la date.
      expect(order).toEqual(['droit', 'verrou', 'ferme', 'date']);
    });

    it('après le commit : partie:{id}, signaux de l’accueil, puis l’e-mail — dans cet ordre', async () => {
      const order: string[] = [];
      realtimeEvents.emit.mockImplementation(() => order.push('emit'));
      partieSignals.notifyChanged.mockImplementation(() => {
        order.push('signaux');
        return Promise.resolve();
      });
      groupChoice.notifyDateFixed.mockImplementation(() => {
        order.push('mail');
        return Promise.resolve();
      });

      await service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('g1'));
      expect(groupChoice.notifyDateFixed).toHaveBeenCalledWith({ id: 'poll1', partieId: 'g1' });
      expect(order).toEqual(['emit', 'signaux', 'mail']);
    });

    it('l’échéance dépassée ne bloque pas l’hôte', async () => {
      await expect(
        service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' }),
      ).resolves.toBeUndefined();
    });

    it('droit refusé par le port (non-hôte, rencontre isolée) : rien n’est écrit, ni émis, ni envoyé', async () => {
      groupChoice.assertCanChoose.mockRejectedValue(new ForbiddenException('hôte seul'));

      await expect(service.choose('g1', 'poll1', 'autre', { optionId: 'opt1' })).rejects.toThrow(
        'hôte seul',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
    });

    it('date déjà fixée (sous le verrou) → 400, rien n’est écrit ni envoyé', async () => {
      groupVotes.lockConjonction.mockResolvedValue({ dated: true });

      const refusal = service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(DATE_ALREADY_FIXED_MESSAGE);
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('sondage déjà fermé (relu sous le verrou) → 400', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, status: 'CLOSED' });

      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
    });

    it('sondage d’une AUTRE partie ou inconnu → 404 (le port le refuse avant tout droit, la relecture sous verrou aussi)', async () => {
      groupChoice.assertCanChoose.mockRejectedValue(new NotFoundException('Poll introuvable'));
      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();

      groupChoice.assertCanChoose.mockResolvedValue(undefined);
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, partieId: 'autre' });
      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('option disparue (purgée entre-temps) → 404 « Option introuvable », rien n’est écrit, la date n’est pas posée', async () => {
      prisma.pollOption.findUnique.mockResolvedValue(null);

      const refusal = service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' });
      await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
      await expect(refusal).rejects.toThrow('Option introuvable');
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
    });

    it('option d’un AUTRE sondage ou inconnue → 404, sondage non fermé', async () => {
      prisma.pollOption.findUnique.mockResolvedValue({ id: 'opt1', pollId: 'autre', date: d });
      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' })).rejects.toThrow(
        NotFoundException,
      );
      prisma.pollOption.findUnique.mockResolvedValue(null);
      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'zzz' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
    });

    it('créneau dont le jour est passé → 400 français sous le verrou, rien n’est écrit ; aujourd’hui est accepté', async () => {
      const day = (offset: number) =>
        new Date(
          `${new Date(Date.now() + offset * 86_400_000).toISOString().substring(0, 10)}T00:00:00.000Z`,
        );
      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt1',
        pollId: 'poll1',
        date: day(-1),
        slot: 'EVENING',
      });

      const refusal = service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(PAST_OPTION_MESSAGE);
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();

      prisma.pollOption.findUnique.mockResolvedValue({
        id: 'opt1',
        pollId: 'poll1',
        date: day(0),
        slot: 'EVENING',
      });
      await expect(
        service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' }),
      ).resolves.toBeUndefined();
    });

    it('échec de l’écriture de la date : tout est annulé, ni émission ni e-mail', async () => {
      seanceDate.chooseDate.mockRejectedValue(new Error('boom'));

      await expect(service.choose('g1', 'poll1', 'hote', { optionId: 'opt1' })).rejects.toThrow(
        'boom',
      );
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
    });

    it('JDR : le port de groupe n’est jamais consulté, chemin inchangé (Story 37.1)', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }, 'mj'),
      );
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, partieId: 'p1' });

      await service.choose('p1', 'poll1', 'mj1', { optionId: 'opt1' });

      expect(groupChoice.assertCanChoose).not.toHaveBeenCalled();
      expect(groupChoice.notifyDateFixed).not.toHaveBeenCalled();
      expect(groupVotes.lockConjonction).not.toHaveBeenCalled();
      expect(seanceDate.chooseDate).toHaveBeenCalledWith(anyOf(Object), 'poll1', d, 'EVENING');
    });
  });

  describe('extend() — prolonger le vote d’une conjonction (Story 40.7)', () => {
    const GROUPE = { id: 'g1', kind: 'CAMPAGNE_EPISODIQUE', gameSystemId: 'ralliement' };
    const dayKey = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().substring(0, 10);
    const endOfDay = (key: string) => new Date(`${key}T23:59:59.999Z`);
    // Échéance actuelle : dans 3 jours (fin de journée UTC).
    const poll = {
      id: 'poll1',
      partieId: 'g1',
      status: 'OPEN',
      expiresAt: endOfDay(dayKey(3)),
    };
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(GROUPE, 'member'));
      prisma.sessionPoll.findUnique.mockResolvedValue(poll);
      prisma.sessionPoll.update.mockResolvedValue({});
    });

    it('cellule de rôle, droit d’hôte par le port, puis verrou, relecture et écriture dans UNE transaction', async () => {
      const order: string[] = [];
      groupExtension.assertCanExtend.mockImplementation(() => {
        order.push('droit');
        return Promise.resolve();
      });
      groupVotes.lockConjonction.mockImplementation(() => {
        order.push('verrou');
        return Promise.resolve({ dated: false });
      });
      prisma.sessionPoll.update.mockImplementation(() => {
        order.push('prolonge');
        return Promise.resolve({});
      });

      await service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) });

      expect(permissions.assert).toHaveBeenCalledWith('hote', 'POLL_EXTEND', { partieId: 'g1' });
      expect(groupExtension.assertCanExtend).toHaveBeenCalledWith(
        { id: 'poll1', partieId: 'g1' },
        GROUPE,
        'hote',
      );
      // Fin du jour choisi (UTC), comme à la création ; la relance est ré-armée.
      expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        data: { expiresAt: endOfDay(dayKey(10)), relanceSentAt: null },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['droit', 'verrou', 'prolonge']);
    });

    it('après le commit : partie:{id} puis les signaux de l’accueil', async () => {
      const order: string[] = [];
      realtimeEvents.emit.mockImplementation(() => order.push('emit'));
      partieSignals.notifyChanged.mockImplementation(() => {
        order.push('signaux');
        return Promise.resolve();
      });

      await service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('g1'));
      expect(order).toEqual(['emit', 'signaux']);
    });

    it('échéance déjà dépassée mais sondage ouvert : accepté (le vote se rouvre)', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({
        ...poll,
        expiresAt: endOfDay(dayKey(-5)),
      });

      await expect(
        service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(0) }),
      ).resolves.toBeUndefined();
      expect(prisma.sessionPoll.update).toHaveBeenCalledWith({
        where: { id: 'poll1' },
        data: { expiresAt: endOfDay(dayKey(0)), relanceSentAt: null },
      });
    });

    it('même jour ou jour antérieur à l’échéance actuelle → 400, rien n’est écrit ni émis', async () => {
      for (const offset of [3, 2]) {
        const refusal = service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(offset) });
        await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
        await expect(refusal).rejects.toThrow(EXTEND_NOT_LATER_MESSAGE);
      }
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('jour passé → 400 avant toute transaction', async () => {
      const refusal = service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(-1) });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(POLL_DEADLINE_PAST_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('jour qui n’existe pas au calendrier → 400 français', async () => {
      const refusal = service.extend('g1', 'poll1', 'hote', { expiresAt: '2099-02-30' });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(EXTEND_INVALID_DAY_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('date déjà fixée (sous le verrou) → 400, rien n’est écrit', async () => {
      groupVotes.lockConjonction.mockResolvedValue({ dated: true });

      const refusal = service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) });
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(DATE_ALREADY_FIXED_MESSAGE);
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('sondage fermé (relu sous le verrou) → 400 ; sondage d’une AUTRE partie → 404', async () => {
      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, status: 'CLOSED' });
      await expect(
        service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) }),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.sessionPoll.findUnique.mockResolvedValue({ ...poll, partieId: 'autre' });
      await expect(
        service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
    });

    it('droit refusé par le port (non-hôte, rencontre isolée, sondage inconnu) : rien n’est écrit ni émis', async () => {
      groupExtension.assertCanExtend.mockRejectedValue(new ForbiddenException('hôte seul'));

      await expect(
        service.extend('g1', 'poll1', 'autre', { expiresAt: dayKey(10) }),
      ).rejects.toThrow('hôte seul');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sessionPoll.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(partieSignals.notifyChanged).not.toHaveBeenCalled();
    });

    it('cellule de rôle refusée (JDR, étranger) : le port n’est jamais consulté', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('non'));

      await expect(
        service.extend('g1', 'poll1', 'hote', { expiresAt: dayKey(10) }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(groupExtension.assertCanExtend).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
