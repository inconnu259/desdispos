jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-cover-bytes')),
}));

// Doit être un UUID valide (pas une étiquette lisible) : `extractUploadFilename()` (appelé par
// `coverImageVersion()` en lecture) valide la forme du nom de fichier par regex — une valeur
// mockée hors-format ferait échouer silencieusement l'extraction et casserait les assertions sur
// `dto.coverImageVersion` de façon trompeuse (défense en profondeur qui se retournerait contre le
// test).
jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    randomUUID: jest.fn(() => '99999999-9999-9999-9999-999999999999'),
  };
});

// Mock partiel, même patron que character.service.spec.ts : detectImageMime/mimeForExtension/etc.
// restent réels (fonctions pures), seule stripImageMetadata est mockée (passthrough) pour éviter
// qu'un vrai sharp() sur un buffer de test (signature magique seule) échoue.
jest.mock('../common/image-upload.util', () => ({
  ...jest.requireActual<typeof import('../common/image-upload.util')>(
    '../common/image-upload.util',
  ),
  stripImageMetadata: jest.fn((buf: Buffer) => Promise.resolve(buf)),
}));

// `sharp` mocké pour le redimensionnement des dérivées (Task 5) — seule la chaîne
// resize()/webp()/toBuffer() est exercée par PartiesService, jamais autoOrient() (qui vit dans
// stripImageMetadata, lui-même mocké en passthrough ci-dessus).
const sharpResizeCalls: unknown[] = [];
jest.mock('sharp', () => {
  // Construit en deux temps : `resize`/`webp` renvoient la chaîne qui les contient, ce qu'un
  // littéral unique ne permet pas d'exprimer sans retomber sur `any`.
  const chain: {
    resize: jest.Mock;
    webp: jest.Mock;
    toBuffer: jest.Mock;
  } = {
    resize: jest.fn(),
    webp: jest.fn(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized-webp-bytes')),
  };
  chain.resize.mockImplementation((opts: unknown) => {
    sharpResizeCalls.push(opts);
    return chain;
  });
  chain.webp.mockImplementation(() => chain);
  return jest.fn(() => chain);
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import type { AggregatedSlotDto, AvailableSlotDto, PartieKind } from '@master-jdr/shared';
import { GAME_SYSTEMS, isOpenForCreation, kindsOf } from '@master-jdr/shared';
import { AvailabilityService } from '../availability/availability.service';
import type { EventCancellationMailer } from '../events/event-cancellation-mailer.service';
import { EVENING_CANCELLED_MESSAGE, EventsService } from '../events/events.service';
import type { BoardGamesService } from '../board-games/board-games.service';
import { PollVoteCleanupService } from '../poll/poll-vote-cleanup.service';
import {
  ADMIN_ONLY_MESSAGE,
  PermissionService,
  RALLIEMENT_UNAVAILABLE_MESSAGE,
} from '../permissions/permission.service';
import { VISIBLE_SEANCE_WHERE } from '../permissions/scenario-visibility';
import { PrismaService } from '../prisma/prisma.service';
import {
  GAME_SYSTEM_FAMILY_CHANGE_MESSAGE,
  GAME_SYSTEM_WITHOUT_MODULE_MESSAGE,
  HIDE_NOT_OVER_MESSAGE,
  HIDE_WINDOW_PAST_MESSAGE,
  KIND_NOT_ALLOWED_FOR_SYSTEM_MESSAGE,
  LAST_ADMIN_MESSAGE,
  PartiesService,
  RALLIEMENT_REMOVE_PROTECTED_MESSAGE,
  ROLE_ALREADY_ADMIN_MESSAGE,
  ROLE_DEMOTE_OTHER_MESSAGE,
  ROLE_SELF_APPOINT_MESSAGE,
  RALLIEMENT_TYPE_LOCKED_MESSAGE,
} from './parties.service';
import { GetAvailableSlotsDto } from './dto/get-available-slots.dto';
import { RealtimeEventsService, partieTopic, userTopic } from '../realtime/realtime-events.service';
import { anyOf, arrayLike, callArg, objectLike, stringLike } from '../common/test-utils/jest-typed';
import type { Prisma } from '@prisma/client';

describe('PartiesService', () => {
  let service: PartiesService;
  let prisma: {
    partie: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    membership: {
      update: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    event: {
      create: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    scenario: {
      create: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    scenarioParticipant: {
      createMany: jest.Mock;
    };
    seance: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    inscription: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    eventGameBring: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    // Story 49.5 : Envies de qui sort d'un groupe (les siennes partent avec lui).
    eventGameEnvy: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    partieFavorite: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    partieHidden: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    slotWindowHidden: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    partieVisibilityLock: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let avail: {
    getActiveDeclarations: jest.Mock;
    getActiveDeclarationsWithSeances: jest.Mock;
    computeSlotStatus: jest.Mock;
  };
  let realtimeEvents: { emit: jest.Mock };
  let polls: {
    removeOpenVotesInTx: jest.Mock;
    closePollsInTx: jest.Mock;
    openOptionKeys: jest.Mock;
  };
  let mailer: { send: jest.Mock };

  const partie = {
    id: 'p1',
    name: 'La Nuit',
    kind: 'ONE_SHOT',
    gameSystemId: 'draconis',
    description: null,
    ownerId: 'mj1',
    createdAt: new Date(),
    nextSessionDate: null,
    nextSessionSlot: null,
    nextSessionEndDate: null,
    nextSessionEndSlot: null,
  };

  beforeEach(() => {
    // Les mocks de `node:fs/promises`/`sharp` sont au niveau module (jest.mock ci-dessus) : sans
    // ce reset, l'historique d'appels (writeFile/unlink) fuiterait d'un test à l'autre, faussant
    // les assertions `toHaveBeenCalledTimes`/`not.toHaveBeenCalled` des tests de couverture.
    jest.clearAllMocks();
    const p = {
      partie: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        // Story 39.5 : remise à `null` du propriétaire qui sort d'un groupe (aucune ligne par défaut).
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn(),
      },
      membership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      // Story 37.3 — événement de base (porteur de `partieId`, compté pour `status`).
      event: {
        create: jest.fn().mockResolvedValue({ id: 'scenario1' }),
        // Défaut « sans scénario » (status: A_VENIR) — les tests de dérivation ci-dessous
        // reconfigurent explicitement ces mocks quand ils veulent tester EN_COURS/TERMINEE.
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        // Story 42.3 : conjonctions à venir de qui sort d'un groupe (défaut : aucune) et leur annulation.
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Verrou de la partie pris par `EventsService.createInTx` (garde ONE_SHOT).
      $queryRaw: jest.fn().mockResolvedValue([{ kind: 'ONE_SHOT' }]),
      scenario: {
        create: jest.fn().mockResolvedValue({ id: 'scenario1' }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      scenarioParticipant: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      seance: {
        create: jest.fn(),
        // Recalcul de `nextSessionDate` à la conversion de type (séances éligibles, anti-spoil).
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Story 40.8 : libération des inscriptions à venir de qui sort d'un groupe (défaut : aucune).
      inscription: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Story 49.3 : jeux apportés par qui sort d'un groupe (défaut : aucun).
      eventGameBring: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Story 49.5 : Envies de qui sort d'un groupe (défaut : aucune).
      eventGameEnvy: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Défaut « aucun favori » — les tests dédiés au favori (Story 29.8) reconfigurent
      // explicitement ces mocks.
      partieFavorite: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Story 42.5 : masquage « Retirer de ma liste » (défaut : rien de masqué).
      partieHidden: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Story 46.4 : fenêtres de l'automate masquées (défaut : aucune).
      slotWindowHidden: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Story 31.6 — les tests dédiés au cadenas de visibilité reconfigurent explicitement.
      partieVisibilityLock: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    // $transaction exécute le callback avec le même mock en guise de `tx`
    prisma = {
      ...p,
      $transaction: jest.fn((fn: (tx: typeof p) => unknown) => fn(p)),
    };
    avail = {
      getActiveDeclarations: jest.fn().mockResolvedValue(new Map()),
      // getAvailableSlots/getHeatmap appellent cette variante (AD-9, Story 30.5) — le mock reflète
      // getActiveDeclarations par défaut ; les tests AD-9 dédiés reconfigurent explicitement.
      getActiveDeclarationsWithSeances: jest.fn().mockResolvedValue(new Map()),
      computeSlotStatus: jest.fn().mockReturnValue('UNKNOWN'),
    };
    realtimeEvents = { emit: jest.fn() };
    polls = {
      removeOpenVotesInTx: jest.fn().mockResolvedValue(0),
      closePollsInTx: jest.fn().mockResolvedValue(0),
      // Story 46.3 — aucun créneau proposé par un sondage ouvert, par défaut.
      openOptionKeys: jest.fn().mockResolvedValue(new Set<string>()),
    };
    mailer = { send: jest.fn().mockResolvedValue(undefined) };
    service = new PartiesService(
      prisma as unknown as PrismaService,
      avail as unknown as AvailabilityService,
      realtimeEvents as unknown as RealtimeEventsService,
      new EventsService(
        prisma as unknown as PrismaService,
        realtimeEvents as unknown as RealtimeEventsService,
        {} as unknown as BoardGamesService,
      ),
      // Story 37.6 — le vrai service de permission, sur les mêmes mocks Prisma : les droits
      // restent exercés de bout en bout (partie lue, puis `Membership` si l'appelant n'est pas
      // le propriétaire), comme l'étaient `getOwned`/`getViewable`.
      new PermissionService(prisma as unknown as PrismaService),
      polls as unknown as PollVoteCleanupService,
      mailer as unknown as EventCancellationMailer,
    );
  });

  it('create attache le ownerId', async () => {
    prisma.partie.create.mockResolvedValue(partie);
    await service.create('mj1', {
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'ryuutama',
    });
    expect(prisma.partie.create).toHaveBeenCalledWith({
      data: objectLike({
        ownerId: 'mj1',
        name: 'La Nuit',
        description: null,
      }),
    });
  });

  it("create renvoie une partie projetée avec role: 'mj' (revue de code, AC6) — le créateur est toujours MJ", async () => {
    prisma.partie.create.mockResolvedValue(partie);
    const dto = await service.create('mj1', {
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'ryuutama',
    });
    expect(dto).toEqual({
      id: partie.id,
      name: partie.name,
      kind: partie.kind,
      gameSystemId: partie.gameSystemId,
      description: partie.description,
      ownerId: partie.ownerId,
      createdAt: partie.createdAt.toISOString(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
      role: 'mj',
      status: 'EN_COURS',
      isFavorite: false,
      coverImageVersion: null,
    });
  });

  it('create() ONE_SHOT ne fait aucun appel scenario.count/groupBy — hasScenario connu synchronement (Story 29.6)', async () => {
    prisma.partie.create.mockResolvedValue(partie);
    await service.create('mj1', {
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'ryuutama',
    });
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.event.groupBy).not.toHaveBeenCalled();
  });

  it('create CAMPAGNE_LINEAIRE renvoie status: A_VENIR (aucun scénario auto-créé, Story 29.6)', async () => {
    prisma.partie.create.mockResolvedValue({
      ...partie,
      kind: 'CAMPAGNE_LINEAIRE',
    });
    const dto = await service.create('mj1', {
      name: 'Les Chroniques',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: 'ryuutama',
    });
    expect(dto.status).toBe('A_VENIR');
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.event.groupBy).not.toHaveBeenCalled();
  });

  it('create ONE_SHOT crée automatiquement son scénario unique BROUILLON dans la même transaction (AC3, Story 7.1)', async () => {
    prisma.partie.create.mockResolvedValue(partie);
    await service.create('mj1', {
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'ryuutama',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: {
        partieId: partie.id,
        title: partie.name,
        description: null,
        ownerId: partie.ownerId,
      },
    });
    expect(prisma.scenario.create).toHaveBeenCalledWith({
      data: { id: 'scenario1', status: 'BROUILLON' },
    });
    expect(prisma.seance.create).toHaveBeenCalledWith({
      data: { eventId: 'scenario1' },
    });
  });

  it('create CAMPAGNE_LINEAIRE/CAMPAGNE_EPISODIQUE ne crée aucun scénario automatique (Story 7.1)', async () => {
    prisma.partie.create.mockResolvedValue({
      ...partie,
      kind: 'CAMPAGNE_LINEAIRE',
    });
    await service.create('mj1', {
      name: 'Les Chroniques',
      kind: 'CAMPAGNE_LINEAIRE',
      gameSystemId: 'ryuutama',
    });
    expect(prisma.scenario.create).not.toHaveBeenCalled();

    await service.create('mj1', {
      name: 'Agence',
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ryuutama',
    });
    expect(prisma.scenario.create).not.toHaveBeenCalled();
  });

  it('create() refuse un gameSystemId sans module, avant toute écriture (Story 29.17, AC2)', async () => {
    const promise = service.create('mj1', {
      name: 'La Nuit',
      kind: 'ONE_SHOT',
      gameSystemId: 'draconis',
    });
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    // AC2 : message explicite — pas seulement le type d'exception (revue de code).
    await expect(promise).rejects.toThrow(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.partie.create).not.toHaveBeenCalled();
  });

  describe('create() — types admis par le registre (Story 38.2)', () => {
    const ALL_KINDS: PartieKind[] = ['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'];
    const cases = GAME_SYSTEMS.filter((g) => isOpenForCreation(g.id)).flatMap((g) =>
      ALL_KINDS.map((kind) => ({
        id: g.id as string,
        kind,
        allowed: kindsOf(g.id).includes(kind),
      })),
    );

    it.each(cases)(
      'système $id, kind $kind : admis=$allowed (exactement kindsOf)',
      async ({ id, kind, allowed }) => {
        prisma.partie.create.mockResolvedValue({ ...partie, gameSystemId: id, kind });
        const promise = service.create('mj1', { name: 'Test', kind, gameSystemId: id });
        if (allowed) {
          await expect(promise).resolves.toBeDefined();
        } else {
          await expect(promise).rejects.toBeInstanceOf(BadRequestException);
          expect(prisma.partie.create).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe('create() — ralliement (Story 38.2)', () => {
    const ralliement = { ...partie, gameSystemId: 'ralliement', name: 'Soirée' };

    it('rencontre isolée : partie ONE_SHOT + un événement + une séance non datée, SANS scénario, créateur membre ADMIN, rôle admin', async () => {
      prisma.partie.create.mockResolvedValue(ralliement);

      const dto = await service.create('mj1', {
        name: 'Soirée',
        kind: 'ONE_SHOT',
        gameSystemId: 'ralliement',
      });

      expect(prisma.partie.create).toHaveBeenCalledWith({
        data: objectLike({ gameSystemId: 'ralliement', ownerId: 'mj1', kind: 'ONE_SHOT' }),
      });
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: { userId: 'mj1', partieId: 'p1', role: 'ADMIN' },
      });
      expect(prisma.event.create).toHaveBeenCalledTimes(1);
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', title: 'Soirée', description: null, ownerId: 'mj1' },
      });
      expect(prisma.seance.create).toHaveBeenCalledTimes(1);
      expect(prisma.scenario.create).not.toHaveBeenCalled();
      // Une seule transaction : partie, membership, événement et séance ensemble.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(dto.role).toBe('admin');
      expect(dto.ownerId).toBe('mj1');
      // Aucun Scenario n'existe : le statut n'est jamais dérivé d'un scénario (A_VENIR, comme GET).
      expect(dto.status).toBe('A_VENIR');
    });

    it('groupe (CAMPAGNE_EPISODIQUE) : partie + membership ADMIN, aucun événement', async () => {
      prisma.partie.create.mockResolvedValue({ ...ralliement, kind: 'CAMPAGNE_EPISODIQUE' });

      const dto = await service.create('mj1', {
        name: 'Les voisins',
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
      });

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: { userId: 'mj1', partieId: 'p1', role: 'ADMIN' },
      });
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.seance.create).not.toHaveBeenCalled();
      expect(prisma.scenario.create).not.toHaveBeenCalled();
      expect(dto.role).toBe('admin');
      expect(dto.status).toBe('A_VENIR');
    });

    it('CAMPAGNE_LINEAIRE refusée (400), avant toute écriture', async () => {
      const promise = service.create('mj1', {
        name: 'Soirée',
        kind: 'CAMPAGNE_LINEAIRE',
        gameSystemId: 'ralliement',
      });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(KIND_NOT_ALLOWED_FOR_SYSTEM_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.partie.create).not.toHaveBeenCalled();
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it('une quête ONE_SHOT garde hasScenario vrai à la création (statut EN_COURS, inchangé)', async () => {
      prisma.partie.create.mockResolvedValue(partie);
      const dto = await service.create('mj1', {
        name: 'La Nuit',
        kind: 'ONE_SHOT',
        gameSystemId: 'ryuutama',
      });
      expect(dto.status).toBe('EN_COURS');
    });

    it('une quête ne reçoit AUCUN membership à la création (comportement JDR inchangé)', async () => {
      prisma.partie.create.mockResolvedValue(partie);
      await service.create('mj1', {
        name: 'La Nuit',
        kind: 'ONE_SHOT',
        gameSystemId: 'ryuutama',
      });
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    // Story 38.5 : la liste d'accueil du créateur se rafraîchit sans rechargement (canal user:{id}).
    describe('émission temps réel après la création (Story 38.5)', () => {
      const cas = [
        { famille: 'quête', gameSystemId: 'ryuutama', kind: 'ONE_SHOT' as const },
        { famille: 'ralliement isolé', gameSystemId: 'ralliement', kind: 'ONE_SHOT' as const },
        {
          famille: 'ralliement durable',
          gameSystemId: 'ralliement',
          kind: 'CAMPAGNE_EPISODIQUE' as const,
        },
      ];

      it.each(cas)(
        '$famille : émet userTopic(créateur) APRÈS la validation de la transaction',
        async ({ gameSystemId, kind }) => {
          const ordre: string[] = [];
          prisma.partie.create.mockResolvedValue({ ...partie, gameSystemId, kind });
          prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
            const result = await fn(prisma);
            ordre.push('commit');
            return result;
          });
          realtimeEvents.emit.mockImplementation((topic: string) => {
            if (topic === userTopic('mj1')) ordre.push('emit');
          });

          await service.create('mj1', { name: 'Test', kind, gameSystemId });

          expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
          expect(ordre.indexOf('commit')).toBeGreaterThanOrEqual(0);
          expect(ordre.indexOf('emit')).toBeGreaterThanOrEqual(0);
          expect(ordre.indexOf('emit')).toBeGreaterThan(ordre.indexOf('commit'));
          expect(ordre.filter((o) => o === 'emit')).toHaveLength(1);
        },
      );

      it('aucune émission userTopic si la transaction échoue', async () => {
        prisma.partie.create.mockRejectedValue(new Error('boom'));
        await expect(
          service.create('mj1', { name: 'Test', kind: 'ONE_SHOT', gameSystemId: 'ralliement' }),
        ).rejects.toThrow('boom');
        expect(realtimeEvents.emit).not.toHaveBeenCalledWith(userTopic('mj1'));
      });

      it("un échec d'émission ne fait jamais échouer la création", async () => {
        prisma.partie.create.mockResolvedValue(ralliement);
        realtimeEvents.emit.mockImplementation(() => {
          throw new Error('SSE indisponible');
        });
        const dto = await service.create('mj1', {
          name: 'Soirée',
          kind: 'ONE_SHOT',
          gameSystemId: 'ralliement',
        });
        expect(dto.role).toBe('admin');
      });
    });
  });

  it('listForUser(player) renvoie les parties des memberships, projetées avec role: player', async () => {
    prisma.membership.findMany.mockResolvedValue([{ partie }]);
    expect(await service.listForUser('u', 'player')).toEqual([
      {
        id: partie.id,
        name: partie.name,
        kind: partie.kind,
        gameSystemId: partie.gameSystemId,
        description: partie.description,
        ownerId: partie.ownerId,
        createdAt: partie.createdAt.toISOString(),
        nextSessionDate: null,
        nextSessionSlot: null,
        nextSessionEndDate: null,
        nextSessionEndSlot: null,
        role: 'player',
        status: 'A_VENIR',
        isFavorite: false,
        coverImageVersion: null,
      },
    ]);
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      objectLike({
        // Story 42.5 : les parties retirées de sa liste n'y figurent plus.
        where: { userId: 'u', partie: { hiddenBy: { none: { userId: 'u' } } } },
        include: { partie: true },
      }),
    );
  });

  describe('listForUser() sans rôle — toutes mes parties (Story 37.7)', () => {
    const partieB = {
      ...partie,
      id: 'p2',
      name: 'Autre partie',
      ownerId: 'mj-autre',
      createdAt: new Date(partie.createdAt.getTime() + 1_000),
    };

    it('MJ de A et joueur de B : les deux parties, rôles mj / player lus en une fois, la plus récente d’abord', async () => {
      // 1er appel : la liste (déjà triée createdAt desc) ; 2e : la lecture en lot des rôles.
      prisma.partie.findMany
        .mockResolvedValueOnce([partieB, { ...partie, ownerId: 'u' }])
        .mockResolvedValueOnce([
          { id: 'p1', ownerId: 'u' },
          { id: 'p2', ownerId: 'mj-autre' },
        ]);

      const dtos = await service.listForUser('u');

      expect(dtos.map((d) => [d.id, d.role])).toEqual([
        ['p2', 'player'],
        ['p1', 'mj'],
      ]);
      expect(prisma.partie.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          OR: [{ ownerId: 'u' }, { memberships: { some: { userId: 'u' } } }],
          hiddenBy: { none: { userId: 'u' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      // Une seule lecture de rôles pour toutes les parties, jamais une par partie.
      expect(prisma.partie.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('même forme de DTO que les listes filtrées (statut, favori, couverture)', async () => {
      prisma.partie.findMany
        .mockResolvedValueOnce([partieB])
        .mockResolvedValueOnce([{ id: 'p2', ownerId: 'mj-autre' }]);

      expect(await service.listForUser('u')).toEqual([
        {
          id: 'p2',
          name: 'Autre partie',
          kind: partieB.kind,
          gameSystemId: partieB.gameSystemId,
          description: partieB.description,
          ownerId: 'mj-autre',
          createdAt: partieB.createdAt.toISOString(),
          nextSessionDate: null,
          nextSessionSlot: null,
          nextSessionEndDate: null,
          nextSessionEndSlot: null,
          role: 'player',
          status: 'A_VENIR',
          isFavorite: false,
          coverImageVersion: null,
        },
      ]);
    });

    it('ralliement : rôles admin / member dans la liste sans rôle (Story 38.2)', async () => {
      const r1 = { ...partieB, id: 'r1', gameSystemId: 'ralliement', ownerId: 'u' };
      const r2 = { ...partieB, id: 'r2', gameSystemId: 'ralliement', ownerId: 'autre' };
      prisma.partie.findMany.mockResolvedValueOnce([r1, r2]).mockResolvedValueOnce([
        { id: 'r1', ownerId: 'u', gameSystemId: 'ralliement', memberships: [{ role: 'ADMIN' }] },
        {
          id: 'r2',
          ownerId: 'autre',
          gameSystemId: 'ralliement',
          memberships: [{ role: 'MEMBER' }],
        },
      ]);

      const dtos = await service.listForUser('u');

      expect(dtos.map((d) => [d.id, d.role])).toEqual([
        ['r1', 'admin'],
        ['r2', 'member'],
      ]);
    });

    it('listes par rôle (mj / player) : les ralliements sont exclus (Story 38.2)', async () => {
      const r = { ...partieB, id: 'r1', gameSystemId: 'ralliement', ownerId: 'u' };
      prisma.partie.findMany.mockResolvedValue([r, { ...partie, ownerId: 'u' }]);
      prisma.membership.findMany.mockResolvedValue([
        { partie: r },
        { partie: { ...partieB, id: 'p9', gameSystemId: 'ryuutama' } },
      ]);

      expect((await service.listForUser('u', 'mj')).map((d) => d.id)).toEqual(['p1']);
      expect((await service.listForUser('u', 'player')).map((d) => d.id)).toEqual(['p9']);
    });

    it('groupe de ralliement (Story 40.1) : EN_COURS dès sa première conjonction (tout événement compte), une rencontre isolée garde la règle du scénario', async () => {
      const groupe = {
        ...partieB,
        id: 'g1',
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
        ownerId: 'u',
      };
      const vide = { ...groupe, id: 'g2' };
      const isolee = { ...groupe, id: 'r1', kind: 'ONE_SHOT' };
      prisma.partie.findMany.mockResolvedValueOnce([groupe, vide, isolee]).mockResolvedValueOnce(
        ['g1', 'g2', 'r1'].map((id) => ({
          id,
          ownerId: 'u',
          gameSystemId: 'ralliement',
          memberships: [{ role: 'ADMIN' }],
        })),
      );
      prisma.event.groupBy.mockImplementation(({ where }: { where: { scenario?: unknown } }) =>
        Promise.resolve(where.scenario ? [] : [{ partieId: 'g1', _count: { _all: 1 } }]),
      );

      const dtos = await service.listForUser('u');

      expect(dtos.map((d) => [d.id, d.status])).toEqual([
        ['g1', 'EN_COURS'],
        ['g2', 'A_VENIR'],
        ['r1', 'A_VENIR'],
      ]);
      // Deux lectures groupées au plus : les groupes sans filtre de scénario, les autres avec.
      expect(prisma.event.groupBy).toHaveBeenCalledTimes(2);
      expect(prisma.event.groupBy).toHaveBeenCalledWith({
        by: ['partieId'],
        where: { partieId: { in: ['g1', 'g2'] } },
        _count: { _all: true },
      });
      expect(prisma.event.groupBy).toHaveBeenCalledWith({
        by: ['partieId'],
        where: { partieId: { in: ['r1'] }, scenario: { isNot: null } },
        _count: { _all: true },
      });
    });

    it('aucune partie → liste vide, sans lecture de rôles', async () => {
      prisma.partie.findMany.mockResolvedValueOnce([]);

      expect(await service.listForUser('u')).toEqual([]);
      expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
    });
  });

  it('listForUser(mj) renvoie les parties dont je suis MJ, projetées avec role: mj (revue de code)', async () => {
    prisma.partie.findMany.mockResolvedValue([partie]);
    expect(await service.listForUser('mj1', 'mj')).toEqual([
      {
        id: partie.id,
        name: partie.name,
        kind: partie.kind,
        gameSystemId: partie.gameSystemId,
        description: partie.description,
        ownerId: partie.ownerId,
        createdAt: partie.createdAt.toISOString(),
        nextSessionDate: null,
        nextSessionSlot: null,
        nextSessionEndDate: null,
        nextSessionEndSlot: null,
        role: 'mj',
        status: 'A_VENIR',
        isFavorite: false,
        coverImageVersion: null,
      },
    ]);
  });

  it('listForUser(mj) : status: EN_COURS quand scenario.groupBy renvoie un compte > 0 pour la partie (Story 29.6)', async () => {
    prisma.partie.findMany.mockResolvedValue([partie]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 2 } }]);
    const [dto] = await service.listForUser('mj1', 'mj');
    expect(dto.status).toBe('EN_COURS');
  });

  it('listForUser(mj) : status: TERMINEE quand closedAt est renseigné, quel que soit le nombre de scénarios (Story 29.6)', async () => {
    prisma.partie.findMany.mockResolvedValue([
      { ...partie, closedAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);
    prisma.event.groupBy.mockResolvedValue([{ partieId: 'p1', _count: { _all: 3 } }]);
    const [dto] = await service.listForUser('mj1', 'mj');
    expect(dto.status).toBe('TERMINEE');
  });

  it('listForUser(mj) : scenario.groupBy appelé une seule fois pour N parties (pas de N+1, AD-3)', async () => {
    const partieB = { ...partie, id: 'p2' };
    prisma.partie.findMany.mockResolvedValue([partie, partieB]);
    await service.listForUser('mj1', 'mj');
    expect(prisma.event.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.event.groupBy).toHaveBeenCalledWith({
      by: ['partieId'],
      where: { partieId: { in: ['p1', 'p2'] }, scenario: { isNot: null } },
      _count: { _all: true },
    });
    expect(prisma.event.count).not.toHaveBeenCalled();
  });

  describe('isFavorite (Story 29.8)', () => {
    it('listForUser(mj) : une partie favorite porte isFavorite: true, une autre isFavorite: false', async () => {
      const partieB = { ...partie, id: 'p2' };
      prisma.partie.findMany.mockResolvedValue([partie, partieB]);
      prisma.partieFavorite.findMany.mockResolvedValue([{ partieId: 'p1' }]);
      const [dtoA, dtoB] = await service.listForUser('mj1', 'mj');
      expect(dtoA.isFavorite).toBe(true);
      expect(dtoB.isFavorite).toBe(false);
    });

    it('listForUser(mj) : partieFavorite.findMany appelé une seule fois pour N parties (pas de N+1, AD-3)', async () => {
      const partieB = { ...partie, id: 'p2' };
      prisma.partie.findMany.mockResolvedValue([partie, partieB]);
      await service.listForUser('mj1', 'mj');
      expect(prisma.partieFavorite.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.partieFavorite.findMany).toHaveBeenCalledWith({
        where: { userId: 'mj1', partieId: { in: ['p1', 'p2'] } },
        select: { partieId: true },
      });
    });

    it('listForUser(player) : une partie favorite porte isFavorite: true', async () => {
      prisma.membership.findMany.mockResolvedValue([{ partie }]);
      prisma.partieFavorite.findMany.mockResolvedValue([{ partieId: 'p1' }]);
      const [dto] = await service.listForUser('u', 'player');
      expect(dto.isFavorite).toBe(true);
    });

    it('create() : isFavorite: false, aucune requête partieFavorite émise', async () => {
      prisma.partie.create.mockResolvedValue(partie);
      const dto = await service.create('mj1', {
        name: 'La Nuit',
        kind: 'ONE_SHOT',
        gameSystemId: 'ryuutama',
      });
      expect(dto.isFavorite).toBe(false);
      expect(prisma.partieFavorite.findUnique).not.toHaveBeenCalled();
      expect(prisma.partieFavorite.findMany).not.toHaveBeenCalled();
    });

    it('findOneDto() : isFavorite toujours présent (true si favori)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.partieFavorite.findUnique.mockResolvedValue({
        id: 'f1',
        userId: 'mj1',
        partieId: 'p1',
      });
      const dto = await service.findOneDto('p1', 'mj1');
      expect(dto.isFavorite).toBe(true);
      expect(prisma.partieFavorite.findUnique).toHaveBeenCalledWith({
        where: { userId_partieId: { userId: 'mj1', partieId: 'p1' } },
      });
    });

    it('update()/close()/reopen() : isFavorite toujours présent dans le DTO retourné', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue(partie);
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.partieFavorite.findUnique.mockResolvedValue({
        id: 'f1',
        userId: 'mj1',
        partieId: 'p1',
      });

      const updated = await service.update('p1', 'mj1', {
        name: 'Nouveau nom',
      });
      expect(updated.isFavorite).toBe(true);

      const closed = await service.close('p1', 'mj1');
      expect(closed.isFavorite).toBe(true);

      const reopened = await service.reopen('p1', 'mj1');
      expect(reopened.isFavorite).toBe(true);
    });
  });

  it("toPartieDto() n'énumère que les champs du DTO — un champ Prisma non listé (ex. futur ajout de colonne) ne fuite jamais (revue de code, AC6)", async () => {
    prisma.partie.findMany.mockResolvedValue([
      { ...partie, sheetVisibility: { secret: true }, internalFlag: 'nope' },
    ]);
    const [dto] = await service.listForUser('mj1', 'mj');
    expect(dto).not.toHaveProperty('sheetVisibility');
    expect(dto).not.toHaveProperty('internalFlag');
    expect(Object.keys(dto).sort()).toEqual(
      [
        'id',
        'name',
        'kind',
        'gameSystemId',
        'description',
        'ownerId',
        'createdAt',
        'nextSessionDate',
        'nextSessionSlot',
        'nextSessionEndDate',
        'nextSessionEndSlot',
        'role',
        'status',
        'isFavorite',
        'coverImageVersion',
      ].sort(),
    );
  });

  it("toPartieDto() n'énumère que les champs du DTO côté branche player aussi (revue de code, AC6)", async () => {
    prisma.membership.findMany.mockResolvedValue([
      {
        partie: {
          ...partie,
          sheetVisibility: { secret: true },
          internalFlag: 'nope',
        },
      },
    ]);
    const [dto] = await service.listForUser('u', 'player');
    expect(dto).not.toHaveProperty('sheetVisibility');
    expect(dto).not.toHaveProperty('internalFlag');
    expect(Object.keys(dto).sort()).toEqual(
      [
        'id',
        'name',
        'kind',
        'gameSystemId',
        'description',
        'ownerId',
        'createdAt',
        'nextSessionDate',
        'nextSessionSlot',
        'nextSessionEndDate',
        'nextSessionEndSlot',
        'role',
        'status',
        'isFavorite',
        'coverImageVersion',
      ].sort(),
    );
  });

  describe('coverImageVersion (Story 29.12, AD-19)', () => {
    it('sans couverture (coverImageUrl null) → coverImageVersion null', async () => {
      prisma.partie.findMany.mockResolvedValue([{ ...partie, coverImageUrl: null }]);
      const [dto] = await service.listForUser('mj1', 'mj');
      expect(dto.coverImageVersion).toBeNull();
    });

    it('avec une couverture valide → coverImageVersion est le stem UUID, sans extension ni préfixe', async () => {
      prisma.partie.findMany.mockResolvedValue([
        {
          ...partie,
          coverImageUrl: '/uploads/covers/11111111-1111-1111-1111-111111111111.webp',
        },
      ]);
      const [dto] = await service.listForUser('mj1', 'mj');
      expect(dto.coverImageVersion).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('coverImageUrl corrompu (mauvais préfixe ou format invalide) → coverImageVersion null, jamais une exception', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { ...partie, coverImageUrl: '/uploads/portraits/x.jpg' },
      ]);
      const [dto] = await service.listForUser('mj1', 'mj');
      expect(dto.coverImageVersion).toBeNull();
    });
  });

  describe('setCoverImage/removeCoverImage/getCoverFile (Story 29.12, Task 10)', () => {
    function makeCoverFile(buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0])) {
      return {
        buffer,
        originalname: 'cover.jpg',
        mimetype: 'image/jpeg',
        size: buffer.length,
      } as Express.Multer.File;
    }

    beforeEach(() => {
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj-pseudo',
        displayName: 'MJ Nom',
      });
    });

    it('AC1 : dépôt → coverImageUrl renseigné en DB, les 3 dérivées écrites sur disque', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        coverImageUrl: '/uploads/covers/99999999-9999-9999-9999-999999999999.webp',
      });
      prisma.partie.findUniqueOrThrow.mockResolvedValue({
        ...partie,
        coverImageUrl: '/uploads/covers/99999999-9999-9999-9999-999999999999.webp',
      });

      const dto = await service.setCoverImage('p1', 'mj1', makeCoverFile());

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          coverImageUrl: '/uploads/covers/99999999-9999-9999-9999-999999999999.webp',
        },
      });
      expect(writeFile).toHaveBeenCalledTimes(3);
      expect(writeFile).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-large.webp'),
        anyOf(Buffer),
      );
      expect(writeFile).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-medium.webp'),
        anyOf(Buffer),
      );
      expect(writeFile).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-compact.webp'),
        anyOf(Buffer),
      );
      expect(dto.coverImageVersion).toBe('99999999-9999-9999-9999-999999999999');
    });

    it('AC9 : chaque dérivée est redimensionnée pour son mode — dimensions distinctes par mode, jamais une largeur unique', async () => {
      sharpResizeCalls.length = 0;
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue(partie);
      prisma.partie.findUniqueOrThrow.mockResolvedValue(partie);

      await service.setCoverImage('p1', 'mj1', makeCoverFile());

      expect(sharpResizeCalls).toContainEqual(
        objectLike({ width: 640, height: 248, fit: 'cover' }),
      );
      expect(sharpResizeCalls).toContainEqual(objectLike({ width: 88, height: 88, fit: 'cover' }));
      expect(sharpResizeCalls).toContainEqual(objectLike({ width: 56, height: 56, fit: 'cover' }));
    });

    it('AC4 : joueur non-MJ → ForbiddenException, aucune écriture disque', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId: 'mj1'
      await expect(service.setCoverImage('p1', 'autre', makeCoverFile())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(writeFile).not.toHaveBeenCalled();
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('fichier non-image (octets magiques invalides) → BadRequestException, aucune écriture disque', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(
        service.setCoverImage('p1', 'mj1', makeCoverFile(Buffer.from('not an image'))),
      ).rejects.toThrow(BadRequestException);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('remplacement → les 3 dérivées de l’ancienne couverture sont supprimées, pas laissées orphelines', async () => {
      const OLD_STEM = '22222222-2222-2222-2222-222222222222';
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        coverImageUrl: `/uploads/covers/${OLD_STEM}.webp`,
      });
      prisma.partie.update.mockResolvedValue(partie);
      prisma.partie.findUniqueOrThrow.mockResolvedValue(partie);

      await service.setCoverImage('p1', 'mj1', makeCoverFile());

      expect(unlink).toHaveBeenCalledWith(stringLike(`${OLD_STEM}-large.webp`));
      expect(unlink).toHaveBeenCalledWith(stringLike(`${OLD_STEM}-medium.webp`));
      expect(unlink).toHaveBeenCalledWith(stringLike(`${OLD_STEM}-compact.webp`));
    });

    it('échec DB après écriture disque → les dérivées fraîchement écrites sont nettoyées, erreur propagée', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockRejectedValue(new Error('db down'));

      await expect(service.setCoverImage('p1', 'mj1', makeCoverFile())).rejects.toThrow('db down');
      expect(unlink).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-large.webp'),
      );
      expect(unlink).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-medium.webp'),
      );
      expect(unlink).toHaveBeenCalledWith(
        stringLike('99999999-9999-9999-9999-999999999999-compact.webp'),
      );
    });

    it('dépôt émet un événement temps réel scopé sur la Partie et ses membres (AD-14)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue(partie);
      prisma.partie.findUniqueOrThrow.mockResolvedValue(partie);

      await service.setCoverImage('p1', 'mj1', makeCoverFile());

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
    });

    it('AC3 : retrait → coverImageUrl remis à null, les 3 dérivées supprimées', async () => {
      const STEM = '33333333-3333-3333-3333-333333333333';
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        coverImageUrl: `/uploads/covers/${STEM}.webp`,
      });
      prisma.partie.update.mockResolvedValue({
        ...partie,
        coverImageUrl: null,
      });
      prisma.partie.findUniqueOrThrow.mockResolvedValue({
        ...partie,
        coverImageUrl: null,
      });

      const dto = await service.removeCoverImage('p1', 'mj1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { coverImageUrl: null },
      });
      expect(unlink).toHaveBeenCalledWith(stringLike(`${STEM}-large.webp`));
      expect(dto.coverImageVersion).toBeNull();
    });

    it('AC4 : retrait par un joueur non-MJ → ForbiddenException, aucune écriture', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(service.removeCoverImage('p1', 'autre')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('retrait émet un événement temps réel scopé sur la Partie et ses membres (AD-14)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue(partie);
      prisma.partie.findUniqueOrThrow.mockResolvedValue(partie);

      await service.removeCoverImage('p1', 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
    });

    it('getCoverFile : lit la dérivée du mode demandé et renvoie le jeton de version', async () => {
      const STEM = '44444444-4444-4444-4444-444444444444';
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        coverImageUrl: `/uploads/covers/${STEM}.webp`,
      });
      (readFile as jest.Mock).mockResolvedValue(Buffer.from('derivative-bytes'));

      const result = await service.getCoverFile('p1', 'mj1', 'medium');

      expect(readFile).toHaveBeenCalledWith(stringLike(`${STEM}-medium.webp`));
      expect(result).toEqual({
        buffer: Buffer.from('derivative-bytes'),
        mime: 'image/webp',
        version: STEM,
      });
    });

    it('getCoverFile : aucune couverture (coverImageUrl null) → null, jamais un accès disque', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        coverImageUrl: null,
      });
      const result = await service.getCoverFile('p1', 'mj1', 'large');
      expect(result).toBeNull();
      expect(readFile).not.toHaveBeenCalled();
    });

    it('getCoverFile : coverImageUrl renseigné mais fichier absent du disque → null, jamais une exception (CAP-20)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        coverImageUrl: '/uploads/covers/55555555-5555-5555-5555-555555555555.webp',
      });
      (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await expect(service.getCoverFile('p1', 'mj1', 'large')).resolves.toBeNull();
    });

    it('getCoverFile : non-membre et non-MJ → ForbiddenException (PARTIE_READ)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId: 'mj1'
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.getCoverFile('p1', 'etranger', 'large')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  it('findOneDto : retourne ownerPseudo/ownerDisplayName et role: mj pour le MJ (PARTIE_READ inchangé)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.user.findUnique.mockResolvedValue({
      pseudo: 'mj-pseudo',
      displayName: 'MJ Nom',
    });
    const dto = await service.findOneDto('p1', 'mj1');
    expect(dto).toEqual({
      id: partie.id,
      name: partie.name,
      kind: partie.kind,
      gameSystemId: partie.gameSystemId,
      description: partie.description,
      ownerId: partie.ownerId,
      createdAt: partie.createdAt.toISOString(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
      role: 'mj',
      status: 'A_VENIR',
      ownerPseudo: 'mj-pseudo',
      ownerDisplayName: 'MJ Nom',
      isFavorite: false,
      coverImageVersion: null,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'mj1' },
      select: { pseudo: true, displayName: true },
    });
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  it('findOneDto : retourne ownerPseudo/ownerDisplayName et role: player pour un joueur consultant la même partie', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.membership.findUnique.mockResolvedValue({
      userId: 'u',
      partieId: 'p1',
    });
    prisma.user.findUnique.mockResolvedValue({
      pseudo: 'mj-pseudo',
      displayName: 'MJ Nom',
    });
    const dto = await service.findOneDto('p1', 'u');
    expect(dto).toEqual({
      id: partie.id,
      name: partie.name,
      kind: partie.kind,
      gameSystemId: partie.gameSystemId,
      description: partie.description,
      ownerId: partie.ownerId,
      createdAt: partie.createdAt.toISOString(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
      role: 'player',
      status: 'A_VENIR',
      ownerPseudo: 'mj-pseudo',
      ownerDisplayName: 'MJ Nom',
      isFavorite: false,
      coverImageVersion: null,
    });
  });

  it('findOneDto : status: EN_COURS quand la partie a au moins un scénario (Story 29.6)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.event.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    const dto = await service.findOneDto('p1', 'mj1');
    expect(dto.status).toBe('EN_COURS');
    expect(prisma.event.count).toHaveBeenCalledWith({
      where: { partieId: 'p1', scenario: { isNot: null } },
    });
  });

  it('findOneDto : un groupe de ralliement avec une conjonction est EN_COURS — tout événement compte (Story 40.1)', async () => {
    prisma.partie.findUnique.mockResolvedValue({
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
    });
    prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.event.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    const dto = await service.findOneDto('p1', 'membre');
    expect(dto.status).toBe('EN_COURS');
    expect(prisma.event.count).toHaveBeenCalledWith({ where: { partieId: 'p1' } });
  });

  it('findOneDto : status: TERMINEE quand closedAt est renseigné, même avec des scénarios (Story 29.6)', async () => {
    prisma.partie.findUnique.mockResolvedValue({
      ...partie,
      closedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    prisma.event.count.mockResolvedValue(3);
    prisma.user.findUnique.mockResolvedValue(null);
    const dto = await service.findOneDto('p1', 'mj1');
    expect(dto.status).toBe('TERMINEE');
  });

  it('findOneDto : 403 si ni MJ ni membre (getViewable inchangée)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(service.findOneDto('p1', 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("findOneDto : renvoie la partie projetée (avec role), sans ownerPseudo/ownerDisplayName, si l'utilisateur MJ est introuvable (revue de code, pas de 500)", async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.user.findUnique.mockResolvedValue(null);
    const dto = await service.findOneDto('p1', 'mj1');
    expect(dto).toEqual({
      id: partie.id,
      name: partie.name,
      kind: partie.kind,
      gameSystemId: partie.gameSystemId,
      description: partie.description,
      ownerId: partie.ownerId,
      createdAt: partie.createdAt.toISOString(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
      role: 'mj',
      status: 'A_VENIR',
      isFavorite: false,
      coverImageVersion: null,
    });
    expect((dto as unknown as Record<string, unknown>).ownerPseudo).toBeUndefined();
  });

  it('removeMember : MJ uniquement, puis supprime le membership', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeMember('p1', 'mj1', 'u');
    expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
      where: { partieId: 'p1', userId: 'u' },
    });
  });

  it('removeMember : 403 si pas le MJ (aucune suppression)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    await expect(service.removeMember('p1', 'autre', 'u')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
  });

  it('removeMember : bug fix — émet partieTopic (roster) et userTopic (liste de Parties du joueur retiré)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeMember('p1', 'mj1', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u'));
  });

  it('removeMember : notifie aussi le MJ via userTopic (Story 29.7, AD-14, signal AUCUN_MEMBRE_INVITE réapparaissant si dernier membre retiré)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'mj1',
      pseudo: 'mj-pseudo',
      displayName: 'MJ Nom',
    });
    prisma.membership.findMany.mockResolvedValue([]);
    await service.removeMember('p1', 'mj1', 'u');
    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
  });

  // Story 39.3 : l'administrateur d'un groupe retire un simple membre — et lui seul.
  describe('removeMember() — groupe de ralliement (Story 39.3)', () => {
    const groupe = {
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
      ownerId: 'admin1',
    };
    const roles: Record<string, 'ADMIN' | 'MEMBER'> = {
      admin1: 'ADMIN',
      admin2: 'ADMIN',
      membre1: 'MEMBER',
      membre2: 'MEMBER',
    };

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(groupe);
      prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', pseudo: 'a', displayName: 'A' });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string } } }) => {
          const role = roles[where.userId_partieId.userId];
          return Promise.resolve(role ? { userId: where.userId_partieId.userId, role } : null);
        },
      );
    });

    it("l'admin retire un simple membre : adhésion supprimée, listes rafraîchies", async () => {
      await service.removeMember('p1', 'admin1', 'membre1');
      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', userId: 'membre1' },
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('membre1'));
    });

    it.each([
      ['le créateur resté administrateur', 'admin2', 'admin1'],
      ['un autre administrateur', 'admin1', 'admin2'],
      ['soi-même (administrateur)', 'admin1', 'admin1'],
    ])('refuse de retirer %s : 409, aucune suppression', async (_libelle, appelant, cible) => {
      const promise = service.removeMember('p1', appelant, cible);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(RALLIEMENT_REMOVE_PROTECTED_MESSAGE);
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    // Story 39.5 : le rôle décide, pas `ownerId` — le créateur redevenu simple membre se retire.
    it('le créateur redevenu simple membre est retiré : adhésion supprimée, ownerId remis à null', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...groupe, ownerId: 'membre1' });
      prisma.partie.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.removeMember('p1', 'admin1', 'membre1')).resolves.toEqual({ ok: true });
      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', userId: 'membre1' },
      });
      expect(prisma.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'membre1' },
        data: { ownerId: null },
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('membre1'));
    });

    it('un membre ordinaire ne retire personne : 403 « réservée aux administrateurs »', async () => {
      const promise = service.removeMember('p1', 'membre1', 'membre2');
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(ADMIN_ONLY_MESSAGE);
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    it('cible sans adhésion : 404, aucune suppression', async () => {
      await expect(service.removeMember('p1', 'admin1', 'inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    // Story 39.4 : la relecture du rôle de la cible se fait sous le verrou de la partie.
    it('retire sous le verrou de la partie, dans une seule transaction (Story 39.4)', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation(() => {
        ordre.push('verrou');
        return Promise.resolve([{ id: 'p1' }]);
      });
      prisma.membership.deleteMany.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve({ count: 1 });
      });
      await service.removeMember('p1', 'admin1', 'membre1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(ordre).toEqual(['verrou', 'delete']);
    });

    it('cible nommée administrateur entre-temps : relue sous le verrou, 409, aucune suppression', async () => {
      roles.membre1 = 'ADMIN';
      try {
        await expect(service.removeMember('p1', 'admin1', 'membre1')).rejects.toBeInstanceOf(
          ConflictException,
        );
      } finally {
        roles.membre1 = 'MEMBER';
      }
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    it("l'appelant qui a quitté l'office entre-temps ne retire plus personne : 403", async () => {
      roles.admin2 = 'MEMBER';
      try {
        // Décision de droit prise sur un rôle ADMIN, puis rôle relu MEMBER sous le verrou.
        prisma.membership.findUnique
          .mockResolvedValueOnce({ userId: 'admin2', role: 'ADMIN' })
          .mockResolvedValueOnce({ userId: 'admin2', role: 'MEMBER' });
        await expect(service.removeMember('p1', 'admin2', 'membre1')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      } finally {
        roles.admin2 = 'ADMIN';
      }
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });
  });

  // Story 42.5 : « Retirer de ma liste » — masquage définitif, par utilisateur, d'une partie terminée ou annulée.
  describe('retirer de sa liste (Story 42.5)', () => {
    const closed = { ...partie, closedAt: new Date('2026-01-01T00:00:00Z') };

    it('une partie terminée (JDR compris) : ligne écrite sans doublon, puis user:{id} émis', async () => {
      prisma.partie.findUnique.mockResolvedValue(closed);

      await expect(service.hide('mj1', 'p1')).resolves.toEqual({ ok: true });

      expect(prisma.partieHidden.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'mj1', partieId: 'p1' }],
        skipDuplicates: true,
      });
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
    });

    it('une soirée isolée annulée : retirable, même non close', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        kind: 'ONE_SHOT',
        gameSystemId: 'ralliement',
        ownerId: 'admin1',
      });
      prisma.membership.findUnique.mockResolvedValue({ userId: 'admin1', role: 'ADMIN' });
      prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);

      await expect(service.hide('admin1', 'p1')).resolves.toEqual({ ok: true });
      expect(prisma.partieHidden.createMany).toHaveBeenCalledTimes(1);
    });

    it('une partie à venir ou en cours : refusée (400), rien d’écrit ni d’émis', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);

      const refusal = service.hide('mj1', 'p1');
      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(HIDE_NOT_OVER_MESSAGE);

      prisma.event.count.mockResolvedValue(1);
      await expect(service.hide('mj1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.partieHidden.createMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('un étranger à la partie : refusé (403), rien d’écrit', async () => {
      prisma.partie.findUnique.mockResolvedValue(closed);
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(service.hide('etranger', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.partieHidden.createMany).not.toHaveBeenCalled();
    });

    it('une partie inconnue : 404', async () => {
      prisma.partie.findUnique.mockResolvedValue(null);

      await expect(service.hide('mj1', 'zzz')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('listForUser(mj) exclut les parties retirées de SA liste', async () => {
      prisma.partie.findMany.mockResolvedValue([]);

      await service.listForUser('mj1', 'mj');

      expect(callArg<{ where: unknown }>(prisma.partie.findMany).where).toEqual({
        ownerId: 'mj1',
        hiddenBy: { none: { userId: 'mj1' } },
      });
    });

    it('reopen supprime les masquages de TOUS les utilisateurs de la partie', async () => {
      prisma.partie.findUnique.mockResolvedValue(closed);
      prisma.partie.update.mockResolvedValue({ ...closed, closedAt: null });

      await service.reopen('p1', 'mj1');

      expect(prisma.partieHidden.deleteMany).toHaveBeenCalledWith({ where: { partieId: 'p1' } });
    });
  });

  // Story 42.2 : une rencontre isolée annulée a le statut ANNULEE et n'accepte plus aucune action.
  describe('soirée isolée annulée (Story 42.2)', () => {
    const soiree = {
      ...partie,
      kind: 'ONE_SHOT',
      gameSystemId: 'ralliement',
      ownerId: 'admin1',
      closedAt: null,
    };

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(soiree);
      prisma.membership.findUnique.mockResolvedValue({ userId: 'admin1', role: 'ADMIN' });
    });

    it('findOneDto : annulée → ANNULEE, même clôturée ; non annulée et close → TERMINEE', async () => {
      prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);
      prisma.partie.findUnique.mockResolvedValue({ ...soiree, closedAt: new Date() });
      await expect(service.findOneDto('p1', 'admin1')).resolves.toMatchObject({
        status: 'ANNULEE',
      });
      expect(callArg<{ where: unknown }>(prisma.event.findMany).where).toEqual({
        partieId: { in: ['p1'] },
        cancelledAt: { not: null },
      });

      prisma.event.findMany.mockResolvedValue([]);
      await expect(service.findOneDto('p1', 'admin1')).resolves.toMatchObject({
        status: 'TERMINEE',
      });
    });

    it('listForUser : le statut des soirées annulées vient d’UNE lecture groupée, jamais une par partie', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { ...soiree, id: 'a', memberships: [{ role: 'ADMIN' }] },
        { ...soiree, id: 'b', memberships: [{ role: 'ADMIN' }] },
      ]);
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([{ partieId: 'a' }]);

      const list = await service.listForUser('admin1');

      expect(list.map((p) => [p.id, p.status])).toEqual([
        ['a', 'ANNULEE'],
        ['b', 'A_VENIR'],
      ]);
      expect(prisma.event.findMany).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['close', (svc: PartiesService) => svc.close('p1', 'admin1')],
      ['reopen', (svc: PartiesService) => svc.reopen('p1', 'admin1')],
      ['update (renommer)', (svc: PartiesService) => svc.update('p1', 'admin1', { name: 'Autre' })],
    ])('%s est refusé (400) sur une soirée annulée, rien n’est écrit', async (_label, act) => {
      prisma.event.findMany.mockResolvedValue([{ partieId: 'p1' }]);

      const refusal = act(service);

      await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
      await expect(refusal).rejects.toThrow(EVENING_CANCELLED_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('close reste permis sur une soirée non annulée (Story 41.4 inchangée)', async () => {
      prisma.event.findMany.mockResolvedValue([]);
      prisma.partie.update.mockResolvedValue({ ...soiree, closedAt: new Date() });

      await expect(service.close('p1', 'admin1')).resolves.toMatchObject({ status: 'TERMINEE' });
    });
  });

  // Story 39.5 : quitter soi-même un groupe — la même procédure `leave()` que le retrait.
  describe('leave() — départ volontaire (Story 39.5)', () => {
    const groupe = {
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
      ownerId: 'admin1',
    };
    const roles: Record<string, 'ADMIN' | 'MEMBER'> = {};

    beforeEach(() => {
      for (const k of Object.keys(roles)) delete roles[k];
      Object.assign(roles, { admin1: 'ADMIN', membre1: 'MEMBER' });
      prisma.partie.findUnique.mockResolvedValue(groupe);
      prisma.partie.delete.mockResolvedValue(groupe);
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
      prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
      prisma.membership.count.mockResolvedValue(1);
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', pseudo: 'a', displayName: 'A' });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string } } }) => {
          const role = roles[where.userId_partieId.userId];
          return Promise.resolve(role ? { userId: where.userId_partieId.userId, role } : null);
        },
      );
    });

    it('un membre quitte le groupe : adhésion supprimée sous le verrou, puis émissions après le commit', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation(() => {
        ordre.push('verrou');
        return Promise.resolve([{ id: 'p1' }]);
      });
      prisma.membership.deleteMany.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve({ count: 1 });
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const result = await fn(prisma);
        ordre.push('commit');
        return result;
      });
      realtimeEvents.emit.mockImplementation((topic: string) => ordre.push(topic));
      // Participants restants (membersOf) : le créateur, administrateur.
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'admin1', pseudo: 'a', displayName: 'A' } },
      ]);

      await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).resolves.toEqual({
        ok: true,
        deleted: false,
      });

      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', userId: 'membre1' },
      });
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(ordre.slice(0, 3)).toEqual(['verrou', 'delete', 'commit']);
      // Sa liste perd le groupe ; celle des autres (et leur liste de membres) se rafraîchit.
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('membre1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('admin1'));
      expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf(partieTopic('p1')));
    });

    it('le créateur redevenu simple membre quitte : ownerId remis à null, le groupe reste', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...groupe, ownerId: 'membre1' });
      prisma.partie.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).resolves.toEqual({
        ok: true,
        deleted: false,
      });
      expect(prisma.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'membre1' },
        data: { ownerId: null },
      });
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      // Propriétaire remis à null : les participants restants ne sont plus « propriétaire d'abord ».
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("un administrateur part alors qu'un autre reste : il quitte simplement le groupe", async () => {
      roles.admin2 = 'ADMIN';
      prisma.membership.count.mockResolvedValue(2);
      await expect(service.leave('p1', 'admin1', { type: 'LEFT' })).resolves.toEqual({
        ok: true,
        deleted: false,
      });
      expect(prisma.membership.count).toHaveBeenCalledWith({
        where: { partieId: 'p1', role: 'ADMIN' },
      });
      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', userId: 'admin1' },
      });
      // Créateur sortant : propriétaire remis à null.
      expect(prisma.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'admin1' },
        data: { ownerId: null },
      });
      expect(prisma.partie.delete).not.toHaveBeenCalled();
    });

    it.each([undefined, false])(
      'dernier administrateur, deleteIfLastAdmin %s : 409 « dernier administrateur », rien ne change',
      async (flag) => {
        const promise = service.leave('p1', 'admin1', { type: 'LEFT', deleteIfLastAdmin: flag });
        await expect(promise).rejects.toBeInstanceOf(ConflictException);
        await expect(promise).rejects.toThrow(LAST_ADMIN_MESSAGE);
        expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
        expect(prisma.partie.updateMany).not.toHaveBeenCalled();
        expect(prisma.partie.delete).not.toHaveBeenCalled();
        expect(realtimeEvents.emit).not.toHaveBeenCalled();
      },
    );

    it('dernier administrateur avec confirmation : groupe supprimé, chaque participant notifié après le commit', async () => {
      const ordre: string[] = [];
      prisma.membership.findMany.mockImplementation(() => {
        ordre.push('lecture');
        return Promise.resolve([{ userId: 'admin1' }, { userId: 'membre1' }]);
      });
      prisma.partie.delete.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve(groupe);
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const result = await fn(prisma);
        ordre.push('commit');
        return result;
      });
      realtimeEvents.emit.mockImplementation((topic: string) => ordre.push(topic));

      await expect(
        service.leave('p1', 'admin1', { type: 'LEFT', deleteIfLastAdmin: true }),
      ).resolves.toEqual({ ok: true, deleted: true });

      expect(prisma.partie.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
      for (const id of ['admin1', 'membre1']) {
        expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic(id));
      }
      expect(ordre.indexOf('lecture')).toBeLessThan(ordre.indexOf('delete'));
      expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf(userTopic('membre1')));
      // La page du groupe déjà ouverte chez les autres membres est prévenue, après le commit.
      expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf(partieTopic('p1')));
    });

    it('Story 40.8 : libère les places à venir puis les votes ouverts, sous le verrou, avant de supprimer l’adhésion', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        ordre.push(strings.join('?').includes('"Partie"') ? 'verrou-partie' : 'verrou-event');
        return Promise.resolve([{ id: 'x' }]);
      });
      prisma.inscription.findMany.mockResolvedValue([
        { seance: { eventId: 'evB' } },
        { seance: { eventId: 'evA' } },
        { seance: { eventId: 'evB' } },
      ]);
      prisma.inscription.deleteMany.mockImplementation(() => {
        ordre.push('inscriptions');
        return Promise.resolve({ count: 3 });
      });
      polls.removeOpenVotesInTx.mockImplementation(() => {
        ordre.push('votes');
        return Promise.resolve(2);
      });
      prisma.membership.deleteMany.mockImplementation(() => {
        ordre.push('adhesion');
        return Promise.resolve({ count: 1 });
      });

      await service.leave('p1', 'membre1', { type: 'LEFT' });

      expect(ordre).toEqual([
        'verrou-partie',
        'verrou-event',
        'verrou-event',
        'inscriptions',
        'votes',
        'adhesion',
      ]);
      // Seules les inscriptions de la personne, du groupe, à venir (jour UTC aujourd'hui ou plus tard) ou sans date.
      const { where } = callArg<{ where: Prisma.InscriptionWhereInput }>(
        prisma.inscription.deleteMany,
      );
      expect(where).toEqual({
        userId: 'membre1',
        seance: {
          event: { partieId: 'p1' },
          OR: [
            { startDate: null },
            {
              endDate: {
                gte: new Date(`${new Date().toISOString().substring(0, 10)}T00:00:00.000Z`),
              },
            },
            {
              endDate: null,
              startDate: {
                gte: new Date(`${new Date().toISOString().substring(0, 10)}T00:00:00.000Z`),
              },
            },
          ],
        },
      });
      expect(polls.removeOpenVotesInTx).toHaveBeenCalledWith(expect.anything(), 'p1', 'membre1');
    });

    it('Story 40.8 : un retrait par un administrateur libère aussi les places et les votes de la cible', async () => {
      await service.leave('p1', 'membre1', { type: 'REMOVED', byUserId: 'admin1' });
      expect(prisma.inscription.findMany).toHaveBeenCalled();
      expect(polls.removeOpenVotesInTx).toHaveBeenCalledWith(expect.anything(), 'p1', 'membre1');
    });

    it('Story 49.3 : supprime les apports à venir de la personne après ses places, sous le verrou, avant de supprimer l’adhésion', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        ordre.push(strings.join('?').includes('"Partie"') ? 'verrou-partie' : 'verrou-event');
        return Promise.resolve([{ id: 'x' }]);
      });
      prisma.eventGameBring.findMany.mockResolvedValue([{ eventId: 'evB' }, { eventId: 'evA' }]);
      prisma.eventGameBring.deleteMany.mockImplementation(() => {
        ordre.push('apports');
        return Promise.resolve({ count: 2 });
      });
      polls.removeOpenVotesInTx.mockImplementation(() => {
        ordre.push('votes');
        return Promise.resolve(0);
      });
      prisma.membership.deleteMany.mockImplementation(() => {
        ordre.push('adhesion');
        return Promise.resolve({ count: 1 });
      });

      await service.leave('p1', 'membre1', { type: 'LEFT' });

      // Les verrous `Event` des apports sont pris (triés) avant leur suppression, puis viennent votes et adhésion.
      expect(ordre).toEqual([
        'verrou-partie',
        'verrou-event',
        'verrou-event',
        'apports',
        'votes',
        'adhesion',
      ]);
      // Seuls les apports de la personne, sur les soirées À VENIR de CE groupe (isolées comprises : lues par
      // `Event.partieId`, pas par les inscriptions).
      const today = new Date().toISOString().substring(0, 10);
      expect(callArg<{ where: unknown }>(prisma.eventGameBring.deleteMany).where).toEqual({
        userId: 'membre1',
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
      // `partie:` émis après le commit, comme avant : aucune émission supplémentaire de l'étape.
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('Story 49.3 : un retrait par un administrateur supprime aussi les apports de la cible', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue([{ eventId: 'evA' }]);

      await service.leave('p1', 'membre1', { type: 'REMOVED', byUserId: 'admin1' });

      expect(
        callArg<{ where: { userId: string } }>(prisma.eventGameBring.deleteMany).where,
      ).toEqual(objectLike({ userId: 'membre1' }));
    });

    it('Story 49.5 : une personne sans apport mais avec des Envies les perd (soirées verrouillées, triées) ; les Envies des autres restent', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        ordre.push(strings.join('?').includes('"Partie"') ? 'verrou-partie' : 'verrou-event');
        return Promise.resolve([{ id: 'x' }]);
      });
      prisma.eventGameBring.findMany.mockResolvedValue([]);
      prisma.eventGameEnvy.findMany.mockImplementation((args: { distinct?: string[] }) =>
        Promise.resolve(args.distinct ? [] : [{ eventId: 'evB' }, { eventId: 'evA' }]),
      );
      prisma.eventGameEnvy.deleteMany.mockImplementation(() => {
        ordre.push('envies');
        return Promise.resolve({ count: 2 });
      });

      await service.leave('p1', 'membre1', { type: 'LEFT' });

      expect(ordre).toEqual(['verrou-partie', 'verrou-event', 'verrou-event', 'envies']);
      // Seulement SES Envies, sur les soirées à venir de ce groupe : jamais celles d'un autre.
      const where = callArg<{ where: { userId: string; event: { partieId: string } } }>(
        prisma.eventGameEnvy.deleteMany,
      ).where;
      expect(where.userId).toBe('membre1');
      expect(where.event.partieId).toBe('p1');
      expect(prisma.membership.deleteMany).toHaveBeenCalled();
    });

    it('Story 49.3 : un échec de la suppression des apports laisse l’adhésion en place (transaction annulée)', async () => {
      prisma.eventGameBring.findMany.mockResolvedValue([{ eventId: 'evA' }]);
      prisma.eventGameBring.deleteMany.mockRejectedValue(new Error('boom'));

      await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).rejects.toThrow('boom');

      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('Story 49.3 : le dernier administrateur supprime le groupe sans purge des apports (cascade)', async () => {
      await service.leave('p1', 'admin1', { type: 'LEFT', deleteIfLastAdmin: true });

      expect(prisma.eventGameBring.findMany).not.toHaveBeenCalled();
      expect(prisma.eventGameBring.deleteMany).not.toHaveBeenCalled();
    });

    it('Story 40.8 : un échec du nettoyage laisse l’adhésion en place (transaction annulée)', async () => {
      polls.removeOpenVotesInTx.mockRejectedValue(new Error('boom'));
      await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).rejects.toThrow('boom');
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    // Story 42.3 : les conjonctions à venir de l'hôte qui sort sont annulées dans la même transaction.
    describe('conjonctions hébergées (Story 42.3)', () => {
      const hosted = (id: string, pollId: string | null = null) => ({ id, seances: [{ pollId }] });

      it('annule les conjonctions à venir de l’hôte sous le verrou, ferme leurs sondages, AVANT de supprimer l’adhésion ; e-mails après le commit', async () => {
        const ordre: string[] = [];
        prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
          ordre.push(strings.join('?').includes('"Partie"') ? 'verrou-partie' : 'verrou-event');
          return Promise.resolve([{ id: 'x' }]);
        });
        prisma.event.findMany.mockResolvedValue([hosted('evA', 'poll-A'), hosted('evB')]);
        prisma.event.updateMany.mockImplementation(() => {
          ordre.push('annulation');
          return Promise.resolve({ count: 2 });
        });
        polls.closePollsInTx.mockImplementation(() => {
          ordre.push('sondages');
          return Promise.resolve(1);
        });
        prisma.membership.deleteMany.mockImplementation(() => {
          ordre.push('adhesion');
          return Promise.resolve({ count: 1 });
        });
        prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          const result = await fn(prisma);
          ordre.push('commit');
          return result;
        });
        mailer.send.mockImplementation((_p: string, eventId: string) => {
          ordre.push(`mail-${eventId}`);
          return Promise.resolve();
        });

        await service.leave('p1', 'membre1', { type: 'LEFT' });

        // Les conjonctions de l'hôte uniquement, de ce groupe, non annulées, à venir.
        expect(callArg<{ where: Record<string, unknown> }>(prisma.event.findMany).where).toEqual(
          objectLike({ partieId: 'p1', ownerId: 'membre1', cancelledAt: null }),
        );
        expect(polls.closePollsInTx).toHaveBeenCalledWith(expect.anything(), ['poll-A']);
        expect(ordre.slice(0, 7)).toEqual([
          'verrou-partie',
          'verrou-event',
          'verrou-event',
          'annulation',
          'sondages',
          'verrou-partie',
          'adhesion',
        ]);
        // Les e-mails n° 7 partent APRÈS le commit, un jeu par conjonction, au nom de la personne qui part.
        expect(mailer.send).toHaveBeenCalledTimes(2);
        expect(mailer.send).toHaveBeenCalledWith('p1', 'evA', 'membre1');
        expect(mailer.send).toHaveBeenCalledWith('p1', 'evB', 'membre1');
        expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf('mail-evA'));
      });

      it('un retrait par un administrateur annule aussi les conjonctions à venir de la cible, mail au nom de la cible', async () => {
        prisma.event.findMany.mockResolvedValue([hosted('evA')]);
        prisma.event.updateMany.mockResolvedValue({ count: 1 });

        await service.leave('p1', 'membre1', { type: 'REMOVED', byUserId: 'admin1' });

        expect(callArg<{ where: Record<string, unknown> }>(prisma.event.findMany).where).toEqual(
          objectLike({ ownerId: 'membre1' }),
        );
        expect(mailer.send).toHaveBeenCalledWith('p1', 'evA', 'membre1');
      });

      it('un membre qui n’héberge rien : aucune annulation ni e-mail', async () => {
        await service.leave('p1', 'membre1', { type: 'LEFT' });

        expect(prisma.event.updateMany).not.toHaveBeenCalled();
        expect(polls.closePollsInTx).not.toHaveBeenCalled();
        expect(mailer.send).not.toHaveBeenCalled();
      });

      it('un échec de l’annulation annule tout le départ : adhésion intacte, rien émis ni envoyé', async () => {
        prisma.event.findMany.mockResolvedValue([hosted('evA')]);
        prisma.event.updateMany.mockRejectedValue(new Error('boom'));

        await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).rejects.toThrow('boom');

        expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
        expect(realtimeEvents.emit).not.toHaveBeenCalled();
        expect(mailer.send).not.toHaveBeenCalled();
      });

      it('le dernier administrateur supprime le groupe sans annuler ni envoyer (cascade)', async () => {
        await service.leave('p1', 'admin1', { type: 'LEFT', deleteIfLastAdmin: true });

        expect(prisma.event.findMany).not.toHaveBeenCalled();
        expect(mailer.send).not.toHaveBeenCalled();
      });
    });

    it('Story 40.8 : le dernier administrateur supprime le groupe sans nettoyage (cascade)', async () => {
      await service.leave('p1', 'admin1', { type: 'LEFT', deleteIfLastAdmin: true });
      expect(prisma.inscription.findMany).not.toHaveBeenCalled();
      expect(polls.removeOpenVotesInTx).not.toHaveBeenCalled();
    });

    it("un simple membre n'est jamais « dernier administrateur » : aucun recomptage, le drapeau est ignoré", async () => {
      await service.leave('p1', 'membre1', { type: 'LEFT', deleteIfLastAdmin: true });
      expect(prisma.membership.count).not.toHaveBeenCalled();
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1', userId: 'membre1' },
      });
    });

    it('refus : étranger au groupe (403), rien écrit', async () => {
      await expect(service.leave('p1', 'etranger', { type: 'LEFT' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refus : une rencontre à usage unique (ONE_SHOT) → 403 « indisponible », aucune transaction', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...groupe, kind: 'ONE_SHOT' });
      const promise = service.leave('p1', 'membre1', { type: 'LEFT' });
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refus : un joueur de JDR ne quitte pas lui-même la partie (403), rien écrit', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.membership.findUnique.mockResolvedValue({ userId: 'u', role: 'MEMBER' });
      await expect(service.leave('p1', 'u', { type: 'LEFT' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    it('membre déjà parti entre la décision et le verrou : 403, rien écrit', async () => {
      prisma.membership.findUnique
        .mockResolvedValueOnce({ userId: 'membre1', role: 'MEMBER' })
        .mockResolvedValueOnce(null);
      await expect(service.leave('p1', 'membre1', { type: 'LEFT' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.membership.deleteMany).not.toHaveBeenCalled();
    });

    it('JDR : le retrait par le MJ ne prend aucun verrou et ne touche jamais au propriétaire', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await service.removeMember('p1', 'mj1', 'u');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.partie.updateMany).not.toHaveBeenCalled();
    });
  });

  // Story 39.4 : nommer un administrateur / quitter l'office, sous le verrou de la partie.
  describe('setMemberRole() — groupe de ralliement (Story 39.4)', () => {
    const groupe = {
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
      ownerId: 'admin1',
    };
    const roles: Record<string, 'ADMIN' | 'MEMBER'> = {};

    beforeEach(() => {
      for (const k of Object.keys(roles)) delete roles[k];
      Object.assign(roles, { admin1: 'ADMIN', membre1: 'MEMBER' });
      prisma.partie.findUnique.mockResolvedValue(groupe);
      prisma.partie.delete.mockResolvedValue(groupe);
      prisma.membership.update.mockResolvedValue({});
      prisma.membership.count.mockResolvedValue(1);
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'admin1' },
        { userId: 'membre1' },
        { userId: 'membre2' },
      ]);
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', pseudo: 'a', displayName: 'A' });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string } } }) => {
          const role = roles[where.userId_partieId.userId];
          return Promise.resolve(role ? { userId: where.userId_partieId.userId, role } : null);
        },
      );
    });

    it('nomme un membre ordinaire administrateur : rôle ADMIN écrit sous le verrou, listes rafraîchies', async () => {
      const ordre: string[] = [];
      prisma.$queryRaw.mockImplementation(() => {
        ordre.push('verrou');
        return Promise.resolve([{ id: 'p1' }]);
      });
      prisma.membership.update.mockImplementation(() => {
        ordre.push('update');
        return Promise.resolve({});
      });
      realtimeEvents.emit.mockImplementation((topic: string) => ordre.push(topic));
      // Lecture des participants pour `user:{id}` (membersOf), après le commit.
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'admin1', pseudo: 'a', displayName: 'A' } },
        { user: { id: 'membre1', pseudo: 'm', displayName: 'M' } },
      ]);

      await expect(
        service.setMemberRole('p1', 'admin1', 'membre1', { role: 'ADMIN' }),
      ).resolves.toEqual({ ok: true, deleted: false });

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { userId_partieId: { userId: 'membre1', partieId: 'p1' } },
        data: { role: 'ADMIN' },
      });
      // Émission après l'écriture, jamais avant : le verrou et l'update précèdent le topic.
      expect(ordre.slice(0, 2)).toEqual(['verrou', 'update']);
      expect(ordre.indexOf(partieTopic('p1'))).toBeGreaterThan(ordre.indexOf('update'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('admin1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('membre1'));
    });

    it('refus : un membre ordinaire ne nomme personne (403, rien écrit)', async () => {
      roles.membre2 = 'MEMBER';
      const promise = service.setMemberRole('p1', 'membre1', 'membre2', { role: 'ADMIN' });
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(ADMIN_ONLY_MESSAGE);
      expect(prisma.membership.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('refus : étranger au groupe (403)', async () => {
      await expect(
        service.setMemberRole('p1', 'etranger', 'membre1', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('refus : se nommer soi-même → 409', async () => {
      const promise = service.setMemberRole('p1', 'admin1', 'admin1', { role: 'ADMIN' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(ROLE_SELF_APPOINT_MESSAGE);
    });

    it('refus : nommer un administrateur → 409', async () => {
      roles.admin2 = 'ADMIN';
      const promise = service.setMemberRole('p1', 'admin1', 'admin2', { role: 'ADMIN' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(ROLE_ALREADY_ADMIN_MESSAGE);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('refus : membre inconnu → 404', async () => {
      await expect(
        service.setMemberRole('p1', 'admin1', 'inconnu', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refus : retirer l'office à un autre → 409", async () => {
      roles.admin2 = 'ADMIN';
      const promise = service.setMemberRole('p1', 'admin1', 'admin2', { role: 'MEMBER' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(ROLE_DEMOTE_OTHER_MESSAGE);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('refus : une rencontre à usage unique (ONE_SHOT) → 403 « indisponible »', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...groupe, kind: 'ONE_SHOT' });
      const promise = service.setMemberRole('p1', 'admin1', 'membre1', { role: 'ADMIN' });
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refus : une partie de JDR → 403, aucune transaction', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(
        service.setMemberRole('p1', 'mj1', 'u', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("quitter l'office alors qu'un autre administrateur reste : devient MEMBER, le groupe reste", async () => {
      prisma.membership.count.mockResolvedValue(2);
      await expect(
        service.setMemberRole('p1', 'admin1', 'admin1', { role: 'MEMBER' }),
      ).resolves.toEqual({ ok: true, deleted: false });
      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { userId_partieId: { userId: 'admin1', partieId: 'p1' } },
        data: { role: 'MEMBER' },
      });
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('dernier administrateur sans confirmation : 409 « dernier administrateur », rien ne change', async () => {
      const promise = service.setMemberRole('p1', 'admin1', 'admin1', { role: 'MEMBER' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(LAST_ADMIN_MESSAGE);
      expect(prisma.membership.update).not.toHaveBeenCalled();
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('dernier administrateur, deleteIfLastAdmin false : même refus', async () => {
      await expect(
        service.setMemberRole('p1', 'admin1', 'admin1', {
          role: 'MEMBER',
          deleteIfLastAdmin: false,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.partie.delete).not.toHaveBeenCalled();
    });

    it('dernier administrateur avec confirmation : groupe supprimé, chaque participant notifié après le commit', async () => {
      const ordre: string[] = [];
      prisma.membership.findMany.mockImplementation(() => {
        ordre.push('lecture');
        return Promise.resolve([
          { userId: 'admin1' },
          { userId: 'membre1' },
          { userId: 'membre2' },
        ]);
      });
      prisma.partie.delete.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve(groupe);
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const result = await fn(prisma);
        ordre.push('commit');
        return result;
      });
      realtimeEvents.emit.mockImplementation((topic: string) => ordre.push(topic));

      await expect(
        service.setMemberRole('p1', 'admin1', 'admin1', {
          role: 'MEMBER',
          deleteIfLastAdmin: true,
        }),
      ).resolves.toEqual({ ok: true, deleted: true });

      expect(prisma.partie.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      for (const id of ['admin1', 'membre1', 'membre2']) {
        expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic(id));
      }
      // Lecture des participants avant la suppression ; aucune émission avant le commit.
      expect(ordre.indexOf('lecture')).toBeLessThan(ordre.indexOf('delete'));
      expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf(userTopic('membre1')));
      expect(ordre.indexOf('commit')).toBeLessThan(ordre.indexOf(partieTopic('p1')));
    });

    it("l'appelant devenu simple membre entre la décision et le verrou : 403, rien écrit", async () => {
      prisma.membership.findUnique
        .mockResolvedValueOnce({ userId: 'admin1', role: 'ADMIN' })
        .mockResolvedValueOnce({ userId: 'admin1', role: 'MEMBER' });
      await expect(
        service.setMemberRole('p1', 'admin1', 'admin1', {
          role: 'MEMBER',
          deleteIfLastAdmin: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('partie disparue entre la décision et le verrou : 404', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(
        service.setMemberRole('p1', 'admin1', 'membre1', { role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('update() émet un événement temps réel scopé sur la Partie (Story 18.3, AC1)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.partie.update.mockResolvedValue({ ...partie, name: 'Nouveau nom' });
    await service.update('p1', 'mj1', { name: 'Nouveau nom' });
    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it("update() renvoie une partie projetée avec role: 'mj' (revue de code, AC6) — PARTIE_UPDATE garantit que l'appelant est MJ", async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.partie.update.mockResolvedValue({ ...partie, name: 'Nouveau nom' });
    const dto = await service.update('p1', 'mj1', { name: 'Nouveau nom' });
    expect(dto).toEqual({
      id: partie.id,
      name: 'Nouveau nom',
      kind: partie.kind,
      gameSystemId: partie.gameSystemId,
      description: partie.description,
      ownerId: partie.ownerId,
      createdAt: partie.createdAt.toISOString(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
      role: 'mj',
      status: 'A_VENIR',
      isFavorite: false,
      coverImageVersion: null,
    });
  });

  describe('close/reopen (Story 29.6, AD-8/AD-14)', () => {
    beforeEach(() => {
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj-pseudo',
        displayName: 'MJ Nom',
      });
    });

    it('close() : MJ uniquement (403 sinon, aucun update)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(service.close('p1', 'autre')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('close() : renseigne closedAt (AC1)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-09T00:00:00.000Z'),
      });
      await service.close('p1', 'mj1');
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { closedAt: anyOf(Date) },
      });
    });

    it('close() : renvoie status: TERMINEE', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-09T00:00:00.000Z'),
      });
      const dto = await service.close('p1', 'mj1');
      expect(dto.status).toBe('TERMINEE');
    });

    it('close() : émet partieTopic(id) et userTopic(userId) pour le MJ et chaque membre résolu (AD-14)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-09T00:00:00.000Z'),
      });
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' } },
        { user: { id: 'u2', pseudo: 'Bob', displayName: 'Bob' } },
      ]);
      await service.close('p1', 'mj1');
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u2'));
    });

    it('close() sur une partie CAMPAGNE sans aucun scénario : recalcule hasScenario plutôt que de le supposer (Story 29.6, Task 5)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        kind: 'CAMPAGNE_LINEAIRE',
      });
      prisma.event.count.mockResolvedValue(0);
      prisma.partie.update.mockResolvedValue({
        ...partie,
        kind: 'CAMPAGNE_LINEAIRE',
        closedAt: new Date('2026-08-09T00:00:00.000Z'),
      });
      const dto = await service.close('p1', 'mj1');
      // closedAt prime toujours sur hasScenario dans toPartieDto() — TERMINEE quel que soit le
      // nombre de scénarios (cf. tests de dérivation ci-dessus).
      expect(dto.status).toBe('TERMINEE');
    });

    it('reopen() : MJ uniquement (403 sinon, aucun update)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(service.reopen('p1', 'autre')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('reopen() : efface closedAt (AC2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      prisma.partie.update.mockResolvedValue({ ...partie, closedAt: null });
      await service.reopen('p1', 'mj1');
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { closedAt: null },
      });
    });

    it('reopen() : la partie redevient active — status: A_VENIR sans scénario, EN_COURS sinon (AC2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      prisma.partie.update.mockResolvedValue({ ...partie, closedAt: null });
      prisma.event.count.mockResolvedValue(0);
      const dto = await service.reopen('p1', 'mj1');
      expect(dto.status).toBe('A_VENIR');
    });

    it('reopen() : émet partieTopic(id) et userTopic(userId) pour le MJ et chaque membre résolu (AD-14)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        closedAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      prisma.partie.update.mockResolvedValue({ ...partie, closedAt: null });
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' } },
      ]);
      await service.reopen('p1', 'mj1');
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
    });
  });

  describe('notifyPartieSignalsChanged (Story 29.7, AD-14)', () => {
    it("émet userTopic(userId) pour le MJ et chaque membre résolu, MAIS PAS partieTopic (déjà émis par l'appelant — revue de code, double émission corrigée)", async () => {
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' } },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj-pseudo',
        displayName: 'MJ Nom',
      });
      await service.notifyPartieSignalsChanged('p1', 'mj1');
      expect(realtimeEvents.emit).not.toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
    });

    it("n'échoue jamais l'appelant si l'émission lève une exception (même garde que close()/reopen())", async () => {
      prisma.membership.findMany.mockRejectedValue(new Error('boom'));
      await expect(service.notifyPartieSignalsChanged('p1', 'mj1')).resolves.toBeUndefined();
    });
  });

  describe('notifyChanged — adaptateur de PartieSignalsPort (Story 37.8)', () => {
    it('lit le propriétaire lui-même et produit la même émission par membre, sans partieTopic', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ownerId: 'mj1' });
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' } },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj-pseudo',
        displayName: 'MJ Nom',
      });

      await service.notifyChanged('p1');

      expect(prisma.partie.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        select: { ownerId: true },
      });
      expect(realtimeEvents.emit).not.toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
    });

    it("ne lève jamais : ni si l'émission échoue, ni si la lecture du propriétaire échoue", async () => {
      prisma.partie.findUnique.mockResolvedValue({ ownerId: 'mj1' });
      prisma.membership.findMany.mockRejectedValue(new Error('boom'));
      await expect(service.notifyChanged('p1')).resolves.toBeUndefined();

      prisma.partie.findUnique.mockRejectedValue(new Error('base indisponible'));
      await expect(service.notifyChanged('p1')).resolves.toBeUndefined();
    });

    it('partie introuvable : rien émis', async () => {
      prisma.partie.findUnique.mockResolvedValue(null);

      await service.notifyChanged('p1');

      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });
  });

  it('remove : vérifie la propriété puis supprime', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    prisma.partie.delete.mockResolvedValue(partie);
    await service.remove('p1', 'mj1');
    expect(prisma.partie.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it("remove : émet user: au MJ (AD-23) — la FK délie l'Homme Dragon, son signal et « Personnages » changent", async () => {
    prisma.partie.findUnique.mockResolvedValue({ ...partie, hommeDragonId: 'hd1' });
    prisma.partie.delete.mockResolvedValue(partie);

    await service.remove('p1', 'mj1');

    expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
    // La partie n'existe plus : aucun canal partie:{id}.
    expect(realtimeEvents.emit).not.toHaveBeenCalledWith(partieTopic('p1'));
  });

  // Story 39.1 : brûler un groupe emporte ses adhésions (cascade) — chaque membre voit sa liste changer.
  describe('remove() — groupe de ralliement (Story 39.1)', () => {
    const groupe = {
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
      ownerId: 'admin1',
    };

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(groupe);
      prisma.partie.delete.mockResolvedValue(groupe);
      prisma.user.findUnique.mockResolvedValue({ id: 'admin1', pseudo: 'a', displayName: 'A' });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_partieId: { userId: string } } }) =>
          Promise.resolve(
            where.userId_partieId.userId === 'admin1'
              ? { userId: 'admin1', role: 'ADMIN' }
              : where.userId_partieId.userId === 'membre1'
                ? { userId: 'membre1', role: 'MEMBER' }
                : null,
          ),
      );
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'admin1', pseudo: 'a', displayName: 'A' } },
        { user: { id: 'membre1', pseudo: 'm', displayName: 'M' } },
        { user: { id: 'membre2', pseudo: 'n', displayName: 'N' } },
      ]);
    });

    it("l'admin brûle : chaque membre est notifié sur user:, une seule fois, après la suppression", async () => {
      const ordre: string[] = [];
      // La lecture des participants (membersOf → membership.findMany) doit précéder la suppression :
      // les adhésions partent en cascade avec la partie.
      const membres = [
        { user: { id: 'admin1', pseudo: 'a', displayName: 'A' } },
        { user: { id: 'membre1', pseudo: 'm', displayName: 'M' } },
        { user: { id: 'membre2', pseudo: 'n', displayName: 'N' } },
      ];
      prisma.membership.findMany.mockImplementation(() => {
        ordre.push('lecture');
        return Promise.resolve(ordre.includes('delete') ? [] : membres);
      });
      prisma.partie.delete.mockImplementation(() => {
        ordre.push('delete');
        return Promise.resolve(groupe);
      });
      realtimeEvents.emit.mockImplementation((topic: string) => ordre.push(topic));

      await service.remove('p1', 'admin1');

      expect(realtimeEvents.emit).toHaveBeenCalledTimes(3);
      for (const id of ['admin1', 'membre1', 'membre2']) {
        expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic(id));
      }
      expect(realtimeEvents.emit).not.toHaveBeenCalledWith(partieTopic('p1'));
      expect(ordre.indexOf('lecture')).toBeGreaterThanOrEqual(0);
      expect(ordre.indexOf('lecture')).toBeLessThan(ordre.indexOf('delete'));
      expect(ordre.indexOf('delete')).toBeLessThan(ordre.indexOf(userTopic('membre1')));
    });

    it('un membre ne brûle pas : 403, rien supprimé, rien émis', async () => {
      await expect(service.remove('p1', 'membre1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });
  });

  it('remove : rien émis quand la suppression est refusée (non-MJ)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);

    await expect(service.remove('p1', 'autre')).rejects.toBeInstanceOf(ForbiddenException);

    expect(realtimeEvents.emit).not.toHaveBeenCalled();
  });

  it('remove : 403 si pas le MJ (et aucune suppression)', async () => {
    prisma.partie.findUnique.mockResolvedValue(partie);
    await expect(service.remove('p1', 'autre')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.partie.delete).not.toHaveBeenCalled();
  });

  describe('listMembers', () => {
    it("renvoie displayName pour chaque membre, et l'e-mail uniquement si le demandeur est le MJ", async () => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId = 'mj1'
      prisma.membership.findMany.mockResolvedValue([
        {
          joinedAt: new Date('2026-01-01'),
          user: {
            id: 'u1',
            pseudo: 'Alice',
            displayName: 'Alice au pays',
            email: 'alice@b.c',
          },
        },
      ]);

      const asMj = await service.listMembers('p1', 'mj1');
      expect(asMj[0]).toMatchObject({
        userId: 'u1',
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        email: 'alice@b.c',
      });

      prisma.membership.findUnique.mockResolvedValue({
        userId: 'u1',
        partieId: 'p1',
      });
      const asMember = await service.listMembers('p1', 'u1');
      expect(asMember[0]).toMatchObject({
        userId: 'u1',
        pseudo: 'Alice',
        displayName: 'Alice au pays',
      });
      expect(asMember[0].email).toBeUndefined();
    });

    it("expose le rôle d'adhésion pour un groupe, et toujours MEMBER pour une partie de JDR (Story 39.4)", async () => {
      const lignes = [
        {
          role: 'ADMIN',
          joinedAt: new Date('2026-01-01'),
          user: { id: 'a1', pseudo: 'Ada', displayName: 'Ada', email: 'a@b.c' },
        },
        {
          role: 'MEMBER',
          joinedAt: new Date('2026-01-02'),
          user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice', email: 'u@b.c' },
        },
      ];
      prisma.membership.findMany.mockResolvedValue(lignes);
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        kind: 'CAMPAGNE_EPISODIQUE',
        gameSystemId: 'ralliement',
        ownerId: 'a1',
      });
      prisma.membership.findUnique.mockResolvedValue({ userId: 'a1', role: 'ADMIN' });
      const groupe = await service.listMembers('p1', 'a1');
      expect(groupe.map((m) => m.role)).toEqual(['ADMIN', 'MEMBER']);

      // JDR : même un rôle ADMIN en base ne sort jamais de l'API.
      prisma.partie.findUnique.mockResolvedValue(partie);
      const jdr = await service.listMembers('p1', 'mj1');
      expect(jdr.map((m) => m.role)).toEqual(['MEMBER', 'MEMBER']);
    });

    it('lève ForbiddenException si ni MJ ni membre (aucune requête membership)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.listMembers('p1', 'stranger')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.membership.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getAvailableSlots', () => {
    const members = [
      {
        userId: 'u1',
        user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
      },
      { userId: 'u2', user: { id: 'u2', pseudo: 'Bob', displayName: 'Bob' } },
    ];

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId = 'mj1'
      prisma.membership.findMany.mockResolvedValue(members);
      avail.getActiveDeclarationsWithSeances.mockResolvedValue(
        new Map([
          ['u1', []],
          ['u2', []],
        ]),
      );
      avail.computeSlotStatus.mockReturnValue('UNKNOWN');
    });

    it('appelle getActiveDeclarations une seule fois pour N membres (pas de N+1)', async () => {
      await service.getAvailableSlots('p1', 'mj1', 1);
      expect(avail.getActiveDeclarationsWithSeances).toHaveBeenCalledTimes(1);
      expect(avail.getActiveDeclarationsWithSeances).toHaveBeenCalledWith(['u1', 'u2']);
    });

    it('les créneaux avec membres non-MJ UNAVAILABLE sont classés en priorité 3 (fins de liste)', async () => {
      // Premier appel (u1 sur le 1er slot) = UNAVAILABLE ; tous les suivants = UNKNOWN
      // Avec 1 semaine = 21 créneaux, le créneau UNAVAILABLE (priorité 3) arrive en 21ème
      // position → exclu par slice(0, 20). Non hard-exclu : seulement de-priorisé.
      avail.computeSlotStatus.mockReturnValueOnce('UNAVAILABLE').mockReturnValue('UNKNOWN');

      const results = (await service.getAvailableSlots('p1', 'mj1', 1)) as AvailableSlotDto[];
      expect(results.length).toBeLessThanOrEqual(20);
      // Le créneau UNAVAILABLE ne figure pas dans les 20 premiers (relégué en priorité 3)
      expect(results.every((r) => r.members.every((m) => m.status !== 'UNAVAILABLE'))).toBe(true);
    });

    it('inclut un créneau si tous les membres sont UNKNOWN', async () => {
      avail.computeSlotStatus.mockReturnValue('UNKNOWN');

      const results = (await service.getAvailableSlots('p1', 'mj1', 1)) as AvailableSlotDto[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].members.every((m) => m.status === 'UNKNOWN')).toBe(true);
    });

    it("n'inclut pas un membre retiré (absent de memberships) dans le calcul", async () => {
      // Seul u1 est encore membre (u2 a été retiré)
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'u1', user: { id: 'u1', pseudo: 'Alice' } },
      ]);
      avail.getActiveDeclarationsWithSeances.mockResolvedValue(new Map([['u1', []]]));

      await service.getAvailableSlots('p1', 'mj1', 1);
      expect(avail.getActiveDeclarationsWithSeances).toHaveBeenCalledWith(['u1']);
    });

    it('renvoie au plus 20 créneaux (limite de résultats)', async () => {
      avail.computeSlotStatus.mockReturnValue('UNKNOWN');
      const results = await service.getAvailableSlots('p1', 'mj1', 8);
      expect(results.length).toBeLessThanOrEqual(20);
    });

    describe('fenêtres déjà proposées par un sondage ouvert (Story 46.3)', () => {
      const FROM = '2030-03-04';
      const TO = '2030-03-14'; // 11 jours = 33 créneaux : le plafond de 20 joue

      it('le MJ ne reçoit pas une fenêtre qui coïncide avec une option d’un sondage ouvert', async () => {
        polls.openOptionKeys.mockResolvedValue(new Set(['2030-03-04|MORNING|1']));
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          1,
          FROM,
          TO,
        )) as AvailableSlotDto[];

        expect(polls.openOptionKeys).toHaveBeenCalledWith(prisma, 'p1');
        expect(results.some((r) => r.date === '2030-03-04' && r.slot === 'MORNING')).toBe(false);
        // Le même jour, un autre créneau reste proposé : seul le DÉPART identique est exclu.
        expect(results[0]).toMatchObject({ date: '2030-03-04', slot: 'AFTERNOON' });
      });

      it('l’exclusion précède le plafond : la liste garde ses 20 fenêtres', async () => {
        polls.openOptionKeys.mockResolvedValue(
          new Set(['2030-03-04|MORNING|1', '2030-03-04|AFTERNOON|1', '2030-03-04|EVENING|1']),
        );
        const results = await service.getAvailableSlots('p1', 'mj1', 1, FROM, TO);
        expect(results).toHaveLength(20);
        expect((results as AvailableSlotDto[]).some((r) => r.date === '2030-03-04')).toBe(false);
      });

      it('sans sondage ouvert, la liste est celle d’avant', async () => {
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          1,
          FROM,
          TO,
        )) as AvailableSlotDto[];
        expect(results[0]).toMatchObject({ date: '2030-03-04', slot: 'MORNING' });
      });

      it('un joueur reçoit la vue agrégée, intacte, sans que les sondages soient lus', async () => {
        polls.openOptionKeys.mockResolvedValue(new Set(['2030-03-04|MORNING']));
        prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });
        const results = (await service.getAvailableSlots(
          'p1',
          'u1',
          1,
          FROM,
          TO,
        )) as AggregatedSlotDto[];

        expect(polls.openOptionKeys).not.toHaveBeenCalled();
        expect(results[0]).toMatchObject({ date: '2030-03-04', slot: 'MORNING' });
        expect(results[0]).not.toHaveProperty('members');
      });
    });

    describe('fenêtres de plusieurs créneaux (Story 47.6)', () => {
      const FROM = '2030-03-08'; // un vendredi
      const TO = '2030-03-10';
      const dateOf = (d: Date) => d.toISOString().substring(0, 10);
      type Decls = { who: string }[];
      /** Statut par (membre, jour, créneau) précis ; tout le reste est AVAILABLE. */
      const statusMap = (busy: Record<string, string>) =>
        avail.computeSlotStatus.mockImplementation(
          (decls: Decls, d: Date, slot: string) =>
            busy[`${decls[0]?.who}|${dateOf(d)}|${slot}`] ?? 'AVAILABLE',
        );
      const row = (date: string, startSlot: string, durationSlots: number) => ({
        date: new Date(`${date}T00:00:00.000Z`),
        startSlot,
        durationSlots,
      });
      const ask = (span?: number, userId = 'mj1') =>
        service.getAvailableSlots('p1', userId, 1, FROM, TO, span);

      beforeEach(() => {
        avail.getActiveDeclarationsWithSeances.mockResolvedValue(
          new Map([
            ['u1', [{ who: 'u1' }]],
            ['u2', [{ who: 'u2' }]],
          ]),
        );
        prisma.slotWindowHidden.findMany.mockResolvedValue([]);
      });

      it('span 2 : un refus du SEUL soir classe la fenêtre de l’après-midi « avec refus » ; vendredi soir → samedi matin reste tout-libre', async () => {
        statusMap({ 'u1|2030-03-09|EVENING': 'UNAVAILABLE' });
        const results = (await ask(2)) as AvailableSlotDto[];

        expect(results.every((r) => r.durationSlots === 2)).toBe(true);
        const sat = results.find((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')!;
        expect(sat.members.find((m) => m.userId === 'u1')!.status).toBe('UNAVAILABLE');
        const fri = results.find((r) => r.date === '2030-03-08' && r.slot === 'EVENING')!;
        expect(fri.members.every((m) => m.status === 'AVAILABLE')).toBe(true);
        // Les fenêtres tout-libres passent avant celle qui a un refus.
        expect(results.indexOf(fri)).toBeLessThan(results.indexOf(sat));
        // Chaque créneau précis n'est calculé qu'une fois par membre (pas de recalcul par fenêtre).
        const keys = avail.computeSlotStatus.mock.calls.map(
          (c: [Decls, Date, string]) => `${c[0][0]?.who}|${dateOf(c[1])}|${c[2]}`,
        );
        expect(new Set(keys).size).toBe(keys.length);
      });

      it('le pire statut gagne : UNAVAILABLE > UNKNOWN > AVAILABLE', async () => {
        statusMap({
          'u1|2030-03-09|MORNING': 'UNKNOWN',
          'u2|2030-03-09|MORNING': 'UNKNOWN',
          'u2|2030-03-09|AFTERNOON': 'UNAVAILABLE',
        });
        const results = (await ask(2)) as AvailableSlotDto[];
        const w = results.find((r) => r.date === '2030-03-09' && r.slot === 'MORNING')!;
        expect(w.members.map((m) => m.status)).toEqual(['UNKNOWN', 'UNAVAILABLE']);
      });

      it('une fenêtre qui déborde de « to » est servie (ses créneaux dépassent la plage)', async () => {
        statusMap({ 'u1|2030-03-11|MORNING': 'UNAVAILABLE' });
        const results = (await ask(2)) as AvailableSlotDto[];
        const w = results.find((r) => r.date === '2030-03-10' && r.slot === 'EVENING')!;
        expect(w.members.find((m) => m.userId === 'u1')!.status).toBe('UNAVAILABLE');
      });

      it('le MJ indisponible sur le 2e créneau exclut la fenêtre', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'mj1', pseudo: 'MJ' });
        prisma.membership.findMany.mockResolvedValue([
          { userId: 'u1', user: { id: 'u1', pseudo: 'Alice' } },
        ]);
        avail.getActiveDeclarationsWithSeances.mockResolvedValue(
          new Map([
            ['mj1', [{ who: 'mj1' }]],
            ['u1', [{ who: 'u1' }]],
          ]),
        );
        statusMap({ 'mj1|2030-03-09|AFTERNOON': 'UNAVAILABLE' });
        const results = (await ask(2)) as AvailableSlotDto[];
        // Départ samedi matin (couvre samedi après-midi) et départ samedi après-midi : exclus.
        expect(results.some((r) => r.date === '2030-03-09' && r.slot === 'MORNING')).toBe(false);
        expect(results.some((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')).toBe(false);
        expect(results.some((r) => r.date === '2030-03-09' && r.slot === 'EVENING')).toBe(true);
      });

      it('sans span : durationSlots 1, une fenêtre par créneau, statuts du créneau', async () => {
        statusMap({ 'u1|2030-03-09|EVENING': 'UNAVAILABLE' });
        const results = (await ask()) as AvailableSlotDto[];
        expect(results).toHaveLength(9);
        expect(results.every((r) => r.durationSlots === 1)).toBe(true);
        const w = results.find((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')!;
        expect(w.members.every((m) => m.status === 'AVAILABLE')).toBe(true);
      });

      it('l’exclusion compare le départ ET la durée', async () => {
        polls.openOptionKeys.mockResolvedValue(new Set(['2030-03-09|AFTERNOON|2']));
        const two = (await ask(2)) as AvailableSlotDto[];
        expect(two.some((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')).toBe(false);
        const one = (await ask(1)) as AvailableSlotDto[];
        expect(one.some((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')).toBe(true);
      });

      it('le masquage ne vaut que pour la durée de la fenêtre masquée', async () => {
        prisma.slotWindowHidden.findMany.mockResolvedValue([row('2030-03-09', 'AFTERNOON', 2)]);
        const two = (await ask(2)) as AvailableSlotDto[];
        expect(two.filter((r) => r.hidden).map((r) => `${r.date}|${r.slot}`)).toEqual([
          '2030-03-09|AFTERNOON',
        ]);
        const one = (await ask(1)) as AvailableSlotDto[];
        expect(one.some((r) => r.hidden)).toBe(false);
      });

      it('un joueur demande span 3 : lignes agrégées au pire statut, sans exclusion ni forme nouvelle', async () => {
        prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });
        polls.openOptionKeys.mockResolvedValue(new Set(['2030-03-09|AFTERNOON|3']));
        statusMap({ 'u2|2030-03-09|EVENING': 'UNAVAILABLE' });
        const results = (await ask(3, 'u1')) as AggregatedSlotDto[];
        expect(polls.openOptionKeys).not.toHaveBeenCalled();
        const w = results.find((r) => r.date === '2030-03-09' && r.slot === 'AFTERNOON')!;
        expect(w).toEqual({
          date: '2030-03-09',
          slot: 'AFTERNOON',
          available: 1,
          unavailable: 1,
          unknown: 0,
          total: 2,
        });
      });

      it.each([0, 46, 1.5, Number.NaN])('span %p : refusé en français', async (span) => {
        await expect(ask(span)).rejects.toThrow(/entier de 1 à 45 créneaux/);
      });
    });

    describe('fenêtres masquées par le MJ (Story 46.4)', () => {
      const FROM = '2030-03-04';
      const TO = '2030-03-14';
      const row = (date: string, startSlot: string, durationSlots = 1) => ({
        date: new Date(`${date}T00:00:00.000Z`),
        startSlot,
        durationSlots,
      });

      it('retire les fenêtres masquées AVANT le plafond, puis les sert à part, marquées hidden', async () => {
        prisma.slotWindowHidden.findMany.mockResolvedValue([
          row('2030-03-04', 'MORNING'),
          row('2030-03-04', 'EVENING'),
        ]);
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          1,
          FROM,
          TO,
        )) as AvailableSlotDto[];

        const visible = results.filter((r) => !r.hidden);
        const apart = results.filter((r) => r.hidden);
        expect(visible).toHaveLength(20);
        expect(visible.some((r) => r.date === '2030-03-04' && r.slot === 'MORNING')).toBe(false);
        expect(apart.map((r) => `${r.date}|${r.slot}`)).toEqual([
          '2030-03-04|MORNING',
          '2030-03-04|EVENING',
        ]);
        // Les masquées viennent APRÈS toutes les visibles, et toute fenêtre porte sa durée.
        expect(results.slice(-2).every((r) => r.hidden)).toBe(true);
        expect(results.every((r) => r.durationSlots === 1)).toBe(true);
      });

      it('ne lit que les lignes de CE MJ et de CETTE partie, dates passées exclues', async () => {
        await service.getAvailableSlots('p1', 'mj1', 1, FROM, TO);
        const where = prisma.slotWindowHidden.findMany.mock.calls[0][0].where;
        expect(where).toMatchObject({ userId: 'mj1', partieId: 'p1' });
        expect(where.date.gte.getTime()).toBeLessThanOrEqual(Date.now());
        expect(where.date.gte.getUTCHours()).toBe(0);
      });

      it('une fenêtre masquée d’une autre durée n’est pas la même fenêtre', async () => {
        prisma.slotWindowHidden.findMany.mockResolvedValue([row('2030-03-04', 'MORNING', 2)]);
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          1,
          FROM,
          TO,
        )) as AvailableSlotDto[];
        expect(results.some((r) => r.hidden)).toBe(false);
        expect(results[0]).toMatchObject({ date: '2030-03-04', slot: 'MORNING' });
      });

      it('un joueur : vue agrégée intacte, aucune ligne masquée lue', async () => {
        prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });
        prisma.slotWindowHidden.findMany.mockResolvedValue([row('2030-03-04', 'MORNING')]);
        const results = (await service.getAvailableSlots(
          'p1',
          'u1',
          1,
          FROM,
          TO,
        )) as AggregatedSlotDto[];
        expect(prisma.slotWindowHidden.findMany).not.toHaveBeenCalled();
        expect(results[0]).toMatchObject({ date: '2030-03-04', slot: 'MORNING' });
        expect(results.some((r) => 'hidden' in r || 'durationSlots' in r)).toBe(false);
      });
    });

    it('trie par priorité : AVAILABLE avant UNKNOWN, UNAVAILABLE en dernier', async () => {
      // Alterne AVAILABLE / UNAVAILABLE par participant pour créer des priorités mixtes
      // (MJ absent du mock → seuls u1/u2 sont participants)
      let callCount = 0;
      avail.computeSlotStatus.mockImplementation(() => {
        callCount++;
        // Tous les slots homogènes sauf les 2 premiers : u1=AVAILABLE, u2=UNAVAILABLE
        if (callCount === 1) return 'AVAILABLE';
        if (callCount === 2) return 'UNAVAILABLE';
        return 'AVAILABLE';
      });
      const results = (await service.getAvailableSlots('p1', 'mj1', 1)) as AvailableSlotDto[];
      expect(results.length).toBeGreaterThan(0);
      // Les 20 premiers résultats ne doivent PAS commencer par le créneau mixte (priorité 1)
      // avant un créneau all-AVAILABLE (priorité 0) — vérifier que le tri est respecté
      for (let i = 1; i < results.length; i++) {
        const pa = results[i - 1].members.some((m) => m.status === 'UNAVAILABLE')
          ? 3
          : results[i - 1].members.every((m) => m.status === 'AVAILABLE')
            ? 0
            : results[i - 1].members.some((m) => m.status === 'AVAILABLE')
              ? 1
              : 2;
        const pb = results[i].members.some((m) => m.status === 'UNAVAILABLE')
          ? 3
          : results[i].members.every((m) => m.status === 'AVAILABLE')
            ? 0
            : results[i].members.some((m) => m.status === 'AVAILABLE')
              ? 1
              : 2;
        expect(pa).toBeLessThanOrEqual(pb);
      }
    });

    describe('Q1 : exclusion hard MJ UNAVAILABLE', () => {
      const mjUser = { id: 'mj1', pseudo: 'MJ' };
      const memberU1 = { userId: 'u1', user: { id: 'u1', pseudo: 'Alice' } };

      beforeEach(() => {
        prisma.partie.findUnique.mockResolvedValue(partie);
        prisma.user.findUnique.mockResolvedValue(mjUser);
        prisma.membership.findMany.mockResolvedValue([memberU1]);
        avail.getActiveDeclarationsWithSeances.mockResolvedValue(
          new Map([
            ['mj1', []],
            ['u1', []],
          ]),
        );
      });

      it('hard-exclut tout créneau où le MJ est UNAVAILABLE', async () => {
        avail.computeSlotStatus.mockReturnValue('UNAVAILABLE');
        const results = await service.getAvailableSlots('p1', 'mj1', 1);
        expect(results).toHaveLength(0);
      });

      it('conserve un créneau où le MJ est AVAILABLE et un joueur est UNAVAILABLE (Q2B)', async () => {
        // mj1 → AVAILABLE, u1 → UNAVAILABLE sur le premier créneau
        let callIdx = 0;
        avail.computeSlotStatus.mockImplementation(() => {
          // Participants = [mj1, u1] — alterne par participant
          const isEven = callIdx++ % 2 === 0;
          return isEven ? 'AVAILABLE' : 'UNAVAILABLE'; // mj=AVAILABLE, u1=UNAVAILABLE
        });
        // Story 37.6 : l'appartenance est lue par `PermissionService` (ligne `Membership` de l'appelant).
        prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });
        const results = (await service.getAvailableSlots('p1', 'u1', 1)) as AggregatedSlotDto[];
        expect(results.length).toBeGreaterThan(0);
        // Au moins un créneau doit avoir unavailable > 0 (Q2B)
        expect(results.some((r) => r.unavailable > 0)).toBe(true);
      });
    });

    it('renvoie AvailableSlotDto[] (avec members) pour le MJ', async () => {
      const results = (await service.getAvailableSlots('p1', 'mj1', 1)) as AvailableSlotDto[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('members');
      expect(results[0].members[0]).toMatchObject({
        userId: 'u1',
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        status: 'UNKNOWN',
      });
    });

    it('renvoie AggregatedSlotDto[] (sans identité) pour un membre non-MJ', async () => {
      // player1 est membre mais pas MJ
      prisma.membership.findMany.mockResolvedValue([
        ...members,
        { userId: 'player1', user: { id: 'player1', pseudo: 'Charlie' } },
      ]);
      avail.getActiveDeclarationsWithSeances.mockResolvedValue(
        new Map([
          ['u1', []],
          ['u2', []],
          ['player1', []],
        ]),
      );
      avail.computeSlotStatus.mockReturnValue('UNKNOWN');
      // Story 37.6 : l'appartenance est lue par `PermissionService` (ligne `Membership` de l'appelant).
      prisma.membership.findUnique.mockResolvedValue({ userId: 'player1', partieId: 'p1' });

      const results = (await service.getAvailableSlots('p1', 'player1', 1)) as AggregatedSlotDto[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('available');
      expect(results[0]).toHaveProperty('unavailable');
      expect(results[0]).toHaveProperty('unknown');
      expect(results[0]).toHaveProperty('total');
      expect(results[0]).not.toHaveProperty('members');
    });

    it('lève ForbiddenException si ni MJ ni membre', async () => {
      await expect(service.getAvailableSlots('p1', 'stranger', 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    describe('filtrage from/to', () => {
      beforeEach(() => {
        prisma.partie.findUnique.mockResolvedValue(partie);
        prisma.membership.findMany.mockResolvedValue(members);
        avail.getActiveDeclarationsWithSeances.mockResolvedValue(
          new Map([
            ['u1', []],
            ['u2', []],
          ]),
        );
        avail.computeSlotStatus.mockReturnValue('AVAILABLE');
      });

      it('restreint les résultats à la plage from/to', async () => {
        const from = '2026-08-01';
        const to = '2026-08-03';
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          8,
          from,
          to,
        )) as AvailableSlotDto[];
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((r) => r.date >= from && r.date <= to)).toBe(true);
      });

      it('ne retourne aucun créneau hors de la plage from/to', async () => {
        const from = '2026-08-01';
        const to = '2026-08-01';
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          8,
          from,
          to,
        )) as AvailableSlotDto[];
        expect(results.every((r) => r.date === '2026-08-01')).toBe(true);
        expect(results.some((r) => r.date !== '2026-08-01')).toBe(false);
      });

      it('lève BadRequestException si from > to', async () => {
        await expect(
          service.getAvailableSlots('p1', 'mj1', 8, '2026-08-31', '2026-08-01'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('sans from/to, appel avec weeks fonctionne (rétrocompat)', async () => {
        const results = (await service.getAvailableSlots('p1', 'mj1', 1)) as AvailableSlotDto[];
        expect(avail.getActiveDeclarationsWithSeances).toHaveBeenCalledTimes(1);
        expect(results.length).toBeGreaterThanOrEqual(0);
      });

      it("accepte from === to (plage d'un seul jour)", async () => {
        const results = (await service.getAvailableSlots(
          'p1',
          'mj1',
          8,
          '2026-08-15',
          '2026-08-15',
        )) as AvailableSlotDto[];
        expect(results.every((r) => r.date === '2026-08-15')).toBe(true);
        expect(results.length).toBe(3);
      });

      it('lève BadRequestException si seulement from est fourni', async () => {
        await expect(
          service.getAvailableSlots('p1', 'mj1', 8, '2026-08-01', undefined),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('lève BadRequestException si seulement to est fourni', async () => {
        await expect(
          service.getAvailableSlots('p1', 'mj1', 8, undefined, '2026-08-31'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('lève BadRequestException si la plage dépasse 366 jours', async () => {
        await expect(
          service.getAvailableSlots('p1', 'mj1', 8, '2024-01-01', '2025-12-31'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('getAvailableSlots — AD-9 end-to-end (Story 30.5)', () => {
    // Câblage réel PartiesService + AvailabilityService (pas de mock sur avail) : vérifie que la
    // production appelle bien getActiveDeclarationsWithSeances et que la dérivation traverse
    // effectivement jusqu'aux deux vues (AC3, AC6), sans identité de la Partie tierce (AC3).
    const partieA = {
      id: 'A',
      name: 'Partie A',
      kind: 'ONE_SHOT',
      gameSystemId: 'draconis',
      description: null,
      ownerId: 'mjA',
      createdAt: new Date(),
      nextSessionDate: null,
      nextSessionSlot: null,
      nextSessionEndDate: null,
      nextSessionEndSlot: null,
    };

    it("un membre occupé par une séance datée d'une autre Partie (B) apparaît UNAVAILABLE dans le calendrier de A, pour la vue MJ ET la vue joueur, sans qu'aucun champ ne nomme la Partie B", async () => {
      const p: any = {
        partie: {
          findUnique: jest.fn().mockResolvedValue(partieA),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'B',
              kind: 'ONE_SHOT',
              ownerId: 'mjB',
              memberships: [{ userId: 'u1' }],
            },
          ]),
        },
        membership: {
          // Story 37.6 : appartenance de l'appelant lue par `PermissionService`.
          findUnique: jest.fn().mockResolvedValue({ userId: 'u1', partieId: 'A' }),
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'u1',
              user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice' },
            },
          ]),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'mjA', pseudo: 'MJ', displayName: 'MJ' }),
        },
        availabilityDeclaration: { findMany: jest.fn().mockResolvedValue([]) },
        slotWindowHidden: { findMany: jest.fn().mockResolvedValue([]) },
        seance: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'seanceB1',
              startDate: new Date('2026-09-20T00:00:00Z'),
              startSlot: 'EVENING',
              inscriptions: [],
              event: { partieId: 'B' },
            },
          ]),
        },
      };
      const realtime = { emit: jest.fn() } as unknown as RealtimeEventsService;
      const permissions = new PermissionService(p);
      // Story 37.8 : les ports du calendrier sont câblés sur la vraie implémentation (`events/`),
      // comme `PortsModule` en production — les attentes de ce test restent celles de la 37.1.
      const realEvents = new EventsService(p, realtime, {} as unknown as BoardGamesService);
      const realAvailability = new AvailabilityService(
        p,
        { emit: jest.fn() } as unknown as RealtimeEventsService,
        permissions,
        realEvents,
        realEvents,
      );
      const svc = new PartiesService(
        p,
        realAvailability,
        realtime,
        new EventsService(p, realtime, {} as unknown as BoardGamesService),
        permissions,
        {
          removeOpenVotesInTx: jest.fn(),
          openOptionKeys: jest.fn().mockResolvedValue(new Set<string>()),
        } as unknown as PollVoteCleanupService,
        { send: jest.fn() } as unknown as EventCancellationMailer,
      );

      const mjResults = (await svc.getAvailableSlots(
        'A',
        'mjA',
        8,
        '2026-09-20',
        '2026-09-20',
      )) as AvailableSlotDto[];
      const eveningMj = mjResults.find((r) => r.slot === 'EVENING')!;
      expect(eveningMj.members.find((m) => m.userId === 'u1')!.status).toBe('UNAVAILABLE');
      const mjSerialized = JSON.stringify(mjResults);
      expect(mjSerialized).not.toContain('mjB');
      expect(mjSerialized).not.toContain('partieB');

      const playerResults = (await svc.getAvailableSlots(
        'A',
        'u1',
        8,
        '2026-09-20',
        '2026-09-20',
      )) as AggregatedSlotDto[];
      const eveningPlayer = playerResults.find((r) => r.slot === 'EVENING')!;
      expect(eveningPlayer.unavailable).toBeGreaterThanOrEqual(1);

      // AC6 : getHeatmap (pas seulement la branche non-MJ de getAvailableSlots) doit s'accorder
      // avec la vue MJ sur le même créneau, sans nommer la Partie B non plus.
      const heatmap = await svc.getHeatmap('A', 'u1', '2026-09-20', '2026-09-20');
      const eveningHeatmap = heatmap.find((r) => r.slot === 'EVENING')!;
      expect(eveningHeatmap.unavailable).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(heatmap)).not.toContain('mjB');
    });
  });

  describe('getHeatmap — disponibilité du groupe nominative (Story 36.8)', () => {
    /** Pose une partie à trois participants : le MJ `mj1` plus deux membres, chacun avec un
     *  statut distinct sur le créneau du matin. Les statuts sont dérivés du `userId` pour que
     *  l'assertion puisse vérifier l'APPARIEMENT identité ↔ statut, et pas seulement la présence
     *  d'une liste (AC4 : « la position identifie la personne, la couleur son statut »). */
    function setupTroupe(): void {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.membership.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', pseudo: 'alice', displayName: 'Alice' },
        },
        { userId: 'u2', user: { id: 'u2', pseudo: 'bob', displayName: 'Bob' } },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj',
        displayName: 'Le MJ',
      });
      avail.getActiveDeclarationsWithSeances.mockResolvedValue(
        new Map([
          ['mj1', []],
          ['u1', []],
          ['u2', []],
        ]),
      );
      const byUser: Record<string, string> = {
        mj1: 'AVAILABLE',
        u1: 'UNAVAILABLE',
        u2: 'UNKNOWN',
      };
      // `computeSlotStatus(decls, date, slot)` ne reçoit pas l'utilisateur : on l'identifie par
      // le tableau de déclarations, dont l'identité de référence est celle posée dans la Map
      // ci-dessus. Le mock rejoue donc l'ordre d'appel de `participants.map(...)`.
      let call = 0;
      const order = ['mj1', 'u1', 'u2'];
      avail.computeSlotStatus.mockImplementation(() => byUser[order[call++ % order.length]]);
    }

    it('sert `members` au MJ, dans l’ordre fixe de la troupe, statut apparié à l’identité (AC4)', async () => {
      setupTroupe();

      const heatmap = await service.getHeatmap('p1', 'mj1', '2026-09-01', '2026-09-01');

      const morning = heatmap.find((r) => r.slot === 'MORNING')!;
      expect(morning.members).toEqual([
        {
          userId: 'mj1',
          pseudo: 'mj',
          displayName: 'Le MJ',
          status: 'AVAILABLE',
        },
        {
          userId: 'u1',
          pseudo: 'alice',
          displayName: 'Alice',
          status: 'UNAVAILABLE',
        },
        { userId: 'u2', pseudo: 'bob', displayName: 'Bob', status: 'UNKNOWN' },
      ]);
      // Les agrégats restent servis à l'identique : le champ s'AJOUTE, il ne remplace rien.
      expect(morning.total).toBe(3);
      expect(morning.available).toBe(1);
    });

    it("n'expose AUCUNE identité à un joueur — la clé est ABSENTE, jamais un tableau vide (AC14)", async () => {
      setupTroupe();
      // Story 37.6 : l'appartenance est lue par `PermissionService` (ligne `Membership` de l'appelant).
      prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });

      const heatmap = await service.getHeatmap('p1', 'u1', '2026-09-01', '2026-09-01');

      const morning = heatmap.find((r) => r.slot === 'MORNING')!;
      // `hasOwnProperty` et non `toBeUndefined()` : un `members: undefined` explicite passerait
      // la seconde assertion tout en sérialisant la clé dans certaines configurations.
      expect(Object.prototype.hasOwnProperty.call(morning, 'members')).toBe(false);
      const serialized = JSON.stringify(heatmap);
      expect(serialized).not.toContain('alice');
      expect(serialized).not.toContain('Alice');
      expect(serialized).not.toContain('u2');
    });

    it("ordonne les membres par date d'adhésion — sans quoi « la position identifie la personne » est faux (AC4)", async () => {
      setupTroupe();

      await service.getHeatmap('p1', 'mj1', '2026-09-01', '2026-09-01');

      // Revue de code : `userId` en départage — `joinedAt` seul ne garantit pas un ordre stable
      // si deux membres partagent le même timestamp (invitation groupée).
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        objectLike({
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        }),
      );
    });
  });

  describe('convertKind (Story 29.14 — garde de conversion de type)', () => {
    // La VRAIE matrice de `@master-jdr/shared` est exercée ici : les verdicts ne sont jamais
    // simulés, ils sont produits par l'état que ces tests posent dans les mocks Prisma. La table
    // de vérité elle-même (les 6 transitions × leurs états limites) est couverte séparément par
    // `apps/web/src/app/core/parties/partie-kind-transition.spec.ts`.
    const campagne = { ...partie, kind: 'CAMPAGNE_LINEAIRE', closedAt: null };
    const episodique = {
      ...partie,
      kind: 'CAMPAGNE_EPISODIQUE',
      closedAt: null,
    };

    /** Pose le nombre de scénarios total et le nombre de COURANT vus par la conversion.
     *  Distingue les deux appels par leur clause `where`, plutôt que par leur ordre. */
    function setScenarioCounts(total: number, courant: number): void {
      prisma.scenario.count.mockImplementation((args?: { where?: { status?: string } }) =>
        Promise.resolve(args?.where?.status === 'COURANT' ? courant : total),
      );
    }

    /** Vrai si AUCUNE écriture n'a eu lieu, sur aucune des quatre tables concernées (AC10). */
    function expectNoWrites(): void {
      expect(prisma.partie.update).not.toHaveBeenCalled();
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.scenario.create).not.toHaveBeenCalled();
      expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
      expect(prisma.scenarioParticipant.createMany).not.toHaveBeenCalled();
      expect(prisma.seance.create).not.toHaveBeenCalled();
    }

    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(campagne);
      prisma.partie.update.mockResolvedValue({
        ...campagne,
        kind: 'ONE_SHOT',
      });
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'mj1',
        pseudo: 'mj-pseudo',
        displayName: 'MJ Nom',
      });
      setScenarioCounts(1, 0);
    });

    it('MJ uniquement : 403 pour un non-MJ, et aucune écriture', async () => {
      await expect(service.convertKind('p1', 'autre', { kind: 'ONE_SHOT' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expectNoWrites();
    });

    it('Story 38.2 — ralliement : 403 par la politique (même pour son admin), sans consulter la matrice, aucune lecture ni écriture', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...episodique, gameSystemId: 'ralliement' });

      const promise = service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' });
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(RALLIEMENT_UNAVAILABLE_MESSAGE);
      // La matrice lit les compteurs de scénarios dans la transaction : ni l'une ni les autres.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.scenario.count).not.toHaveBeenCalled();
      expectNoWrites();
    });

    it('Story 37.5 — système inconnu du registre : non refusé par la garde de famille', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        closedAt: null,
        gameSystemId: 'systeme-disparu',
      });

      await service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_LINEAIRE' });

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { kind: 'CAMPAGNE_LINEAIRE' },
      });
    });

    it('Cas 1 — ONE_SHOT → CAMPAGNE_LINEAIRE : autorisée sans condition', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, closedAt: null });

      await service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_LINEAIRE' });

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { kind: 'CAMPAGNE_LINEAIRE' },
      });
    });

    it('anti-spoil serveur — la conversion recalcule nextSessionDate/Slot (un brouillon n’est caché que hors ONE_SHOT) dans la même transaction', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, closedAt: null });
      prisma.partie.update.mockResolvedValue({ ...partie, kind: 'CAMPAGNE_LINEAIRE' });
      const future = new Date(Date.UTC(2099, 0, 2));
      prisma.seance.findMany.mockResolvedValue([{ startDate: future, startSlot: 'EVENING' }]);

      const dto = await service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_LINEAIRE' });

      expect(prisma.seance.findMany).toHaveBeenCalledWith({
        where: { AND: [{ event: { partieId: 'p1', cancelledAt: null } }, VISIBLE_SEANCE_WHERE] },
        select: { startDate: true, startSlot: true, endDate: true, endSlot: true },
      });
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: future, nextSessionSlot: 'EVENING', nextSessionEndDate: future, nextSessionEndSlot: 'EVENING' },
      });
      expect(dto.nextSessionDate).toBe(future.toISOString());
    });

    it('AC10 — refus (3 scénarios → ONE_SHOT) : BadRequest levée AVANT toute écriture', async () => {
      setScenarioCounts(3, 0);

      await expect(service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expectNoWrites();
    });

    it('AC6 — le message de refus nomme la cause réelle et le nombre en jeu', async () => {
      setScenarioCounts(3, 0);

      await expect(service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' })).rejects.toThrow(/3/);
    });

    it('Règle C — partie clôturée : refus avec un message distinct invitant à rouvrir', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...campagne,
        closedAt: new Date(),
      });

      await expect(service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' })).rejects.toThrow(
        /rouvr/i,
      );
      expectNoWrites();
    });

    it('Règle C — la clôture prime sur un refus qui serait sinon dû au nombre de scénarios', async () => {
      setScenarioCounts(5, 0);
      prisma.partie.findUnique.mockResolvedValue({
        ...campagne,
        closedAt: new Date(),
      });

      await expect(service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' })).rejects.toThrow(
        /rouvr/i,
      );
    });

    it('Cas 3 à 1 scénario : autorisée, écrit le kind et rien d’autre', async () => {
      await service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' });

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { kind: 'ONE_SHOT' },
      });
      expect(prisma.scenario.create).not.toHaveBeenCalled();
      expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
      expect(prisma.scenarioParticipant.createMany).not.toHaveBeenCalled();
    });

    it('AC7 — cas 3 à 0 scénario : crée un scénario BROUILLON titré du nom de la partie, ET sa séance', async () => {
      setScenarioCounts(0, 0);
      prisma.event.create.mockResolvedValue({ id: 'sc-neuf' });

      await service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: { partieId: 'p1', title: campagne.name, description: null, ownerId: 'mj1' },
      });
      expect(prisma.scenario.create).toHaveBeenCalledWith({
        data: { id: 'sc-neuf', status: 'BROUILLON' },
      });
      expect(prisma.seance.create).toHaveBeenCalledWith({
        data: { eventId: 'sc-neuf' },
      });
    });

    it('AC8 — cas 4 : inscrit chaque membre à chaque scénario existant', async () => {
      prisma.scenario.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

      await service.convertKind('p1', 'mj1', {
        kind: 'CAMPAGNE_EPISODIQUE',
      });

      const call = callArg<{ data: unknown[] }>(prisma.scenarioParticipant.createMany);
      expect(call.data).toEqual(
        arrayLike([
          { scenarioId: 's1', userId: 'u1' },
          { scenarioId: 's1', userId: 'u2' },
          { scenarioId: 's2', userId: 'u1' },
          { scenarioId: 's2', userId: 'u2' },
        ]),
      );
      expect(call.data).toHaveLength(4);
    });

    it('AC8 — le semis est idempotent : skipDuplicates, rejouer ne crée aucun doublon', async () => {
      prisma.scenario.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u1' }]);

      await service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_EPISODIQUE' });

      expect(prisma.scenarioParticipant.createMany).toHaveBeenCalledWith(
        objectLike({ skipDuplicates: true }),
      );
    });

    it('semis sans aucun membre : aucun appel createMany à vide', async () => {
      prisma.scenario.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.membership.findMany.mockResolvedValue([]);

      await service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_EPISODIQUE' });

      expect(prisma.scenarioParticipant.createMany).not.toHaveBeenCalled();
    });

    it('AC9 — effet DEMOTE_EXTRA_COURANTS : rétrograde en A_VENIR tous les COURANT sauf celui désigné', async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);
      prisma.scenario.findUnique.mockResolvedValue({
        id: 'sc-garde',
        event: { partieId: 'p1' },
        status: 'COURANT',
      });

      await service.convertKind('p1', 'mj1', {
        kind: 'CAMPAGNE_LINEAIRE',
        courantScenarioId: 'sc-garde',
      });

      expect(prisma.scenario.updateMany).toHaveBeenCalledWith({
        where: { event: { partieId: 'p1' }, status: 'COURANT', id: { not: 'sc-garde' } },
        data: { status: 'A_VENIR' },
      });
    });

    it('AC9 — la rétrogradation ne touche ni séances, ni votes, ni dates (Règle A)', async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);
      prisma.scenario.findUnique.mockResolvedValue({
        id: 'sc-garde',
        event: { partieId: 'p1' },
        status: 'COURANT',
      });

      await service.convertKind('p1', 'mj1', {
        kind: 'CAMPAGNE_LINEAIRE',
        courantScenarioId: 'sc-garde',
      });

      // Seul `status` est écrit : aucune suppression de séance, aucun champ de date touché.
      expect(callArg<{ data: unknown }>(prisma.scenario.updateMany).data).toEqual({
        status: 'A_VENIR',
      });
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });

    it('requiresCourantChoice sans courantScenarioId : BadRequest, aucune écriture', async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);

      await expect(
        service.convertKind('p1', 'mj1', { kind: 'CAMPAGNE_LINEAIRE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrites();
    });

    it("courantScenarioId d'une AUTRE partie : BadRequest, aucune écriture", async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);
      prisma.scenario.findUnique.mockResolvedValue({
        id: 'sc-ailleurs',
        event: { partieId: 'p-autre' },
        status: 'COURANT',
      });

      await expect(
        service.convertKind('p1', 'mj1', {
          kind: 'CAMPAGNE_LINEAIRE',
          courantScenarioId: 'sc-ailleurs',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrites();
    });

    it('courantScenarioId qui n’est pas COURANT : BadRequest, aucune écriture', async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);
      prisma.scenario.findUnique.mockResolvedValue({
        id: 'sc-brouillon',
        event: { partieId: 'p1' },
        status: 'BROUILLON',
      });

      await expect(
        service.convertKind('p1', 'mj1', {
          kind: 'CAMPAGNE_LINEAIRE',
          courantScenarioId: 'sc-brouillon',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrites();
    });

    it('courantScenarioId introuvable : BadRequest, aucune écriture', async () => {
      prisma.partie.findUnique.mockResolvedValue(episodique);
      setScenarioCounts(4, 2);
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(
        service.convertKind('p1', 'mj1', {
          kind: 'CAMPAGNE_LINEAIRE',
          courantScenarioId: 'sc-fantome',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expectNoWrites();
    });

    it('AD-14 — émet partieTopic et userTopic pour le MJ et chaque membre après un succès', async () => {
      // `resolveParticipants()` lit les memberships avec `include: { user }` — forme différente du
      // `select: { userId }` utilisé par le semis de participants.
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'u1-pseudo', displayName: 'U1' } },
      ]);

      await service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
    });

    it('une émission qui échoue ne transforme pas un commit réussi en 500 (patron close()/reopen())', async () => {
      prisma.membership.findMany.mockRejectedValue(new Error('boom'));

      await expect(service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' })).resolves.toMatchObject({
        id: 'p1',
      });
    });

    it("renvoie un PartieDto projeté avec role: 'mj' (AD-15)", async () => {
      const dto = await service.convertKind('p1', 'mj1', { kind: 'ONE_SHOT' });
      expect(dto).toMatchObject({ id: 'p1', role: 'mj', kind: 'ONE_SHOT' });
    });
  });

  describe('update() — verrou contre le changement de type silencieux (Story 29.14, Task 4)', () => {
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        kind: 'CAMPAGNE_LINEAIRE',
      });
      prisma.partie.update.mockResolvedValue({
        ...partie,
        kind: 'CAMPAGNE_LINEAIRE',
      });
    });

    it('un kind DIFFÉRENT est rejeté, sans écriture — la conversion a sa propre route', async () => {
      await expect(service.update('p1', 'mj1', { kind: 'ONE_SHOT' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un kind IDENTIQUE reste accepté — le formulaire renvoie toujours les quatre champs', async () => {
      await expect(
        service.update('p1', 'mj1', {
          name: 'Nouveau nom',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      ).resolves.toBeDefined();
      expect(prisma.partie.update).toHaveBeenCalled();
    });

    it('sans kind du tout : enregistrement normal', async () => {
      await service.update('p1', 'mj1', { name: 'Nouveau nom' });
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom' },
      });
    });
  });

  describe('update() — garde gameSystemId sans module (Story 29.17, AC3/AC4)', () => {
    // `partie` (fixture module-level) porte déjà gameSystemId: 'draconis', sans module — sert ici de
    // partie déjà enregistrée sur un système sans module, même patron que le `kind` ci-dessus.
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      prisma.partie.update.mockResolvedValue(partie);
    });

    it('un gameSystemId DIFFÉRENT vers un système sans module est rejeté, sans écriture (AC4)', async () => {
      const promise = service.update('p1', 'mj1', { gameSystemId: 'conte-de-minuit' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      // AC4 : message explicite — pas seulement le type d'exception (revue de code).
      await expect(promise).rejects.toThrow(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un gameSystemId DIFFÉRENT vers un système sans module est rejeté même en partant d’un système AVEC module (AC4)', async () => {
      // Contrairement au cas ci-dessus (source déjà sans module), celui-ci part d'une partie sur
      // ryuutama (avec module) — la garde ne compare que la cible, jamais la source, donc les deux
      // sens doivent être refusés de la même façon (revue de code).
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ryuutama' });
      const promise = service.update('p1', 'mj1', { gameSystemId: 'draconis' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un gameSystemId IDENTIQUE (déjà sans module) reste accepté — aucune migration (AC3)', async () => {
      await expect(
        service.update('p1', 'mj1', { name: 'Nouveau nom', gameSystemId: 'draconis' }),
      ).resolves.toBeDefined();
      // AC3 : gameSystemId inchangé doit vraiment atteindre l'écriture tel quel — pas seulement
      // « update() a été appelé » (revue de code : un régression qui le dropperait/muterait
      // passerait sinon inaperçue malgré le nom du test).
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom', gameSystemId: 'draconis' },
      });
    });

    it('sans gameSystemId du tout : enregistrement normal, sans toucher au système existant', async () => {
      await service.update('p1', 'mj1', { name: 'Nouveau nom' });
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom' },
      });
    });

    it('un changement vers un système AVEC module reste accepté', async () => {
      await expect(
        service.update('p1', 'mj1', { gameSystemId: 'ryuutama' }),
      ).resolves.toBeDefined();
      // Même exigence que sur le cas « identique » ci-dessus : vérifier le payload écrit, pas
      // seulement que update() a été appelé (revue de code). AD-23 : le changement de système
      // remet le lien Homme Dragon à NULL dans la MÊME instruction.
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { gameSystemId: 'ryuutama', hommeDragonId: null },
      });
    });
  });

  describe('update() — changement de famille de système refusé (Story 37.5)', () => {
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ryuutama' });
      prisma.partie.update.mockResolvedValue(partie);
    });

    it('une partie jdr ne passe pas sur ralliement : 400 nommant le changement de famille, sans écriture', async () => {
      const promise = service.update('p1', 'mj1', { gameSystemId: 'ralliement' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(GAME_SYSTEM_FAMILY_CHANGE_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('une partie ralliement ne passe pas sur un système jdr (même ouvert) — le type est définitif (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ralliement' });
      const promise = service.update('p1', 'mj1', { gameSystemId: 'ryuutama' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(RALLIEMENT_TYPE_LOCKED_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un système inconnu du registre ne devient pas un ralliement (400 famille), aucune écriture (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'systeme-disparu' });
      const promise = service.update('p1', 'mj1', { gameSystemId: 'ralliement' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(GAME_SYSTEM_FAMILY_CHANGE_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('renommer une rencontre isolée renomme son événement unique, dans la même transaction (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        kind: 'ONE_SHOT',
      });
      prisma.partie.update.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        name: 'Neuf',
      });
      prisma.event.findFirst.mockResolvedValue({ id: 'ev1' });

      await service.update('p1', 'mj1', { name: 'Neuf' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'ev1' },
        data: { title: 'Neuf' },
      });
    });

    it('un groupe ou un nom inchangé ne touche à aucun événement (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        kind: 'CAMPAGNE_EPISODIQUE',
      });
      prisma.partie.update.mockResolvedValue({ ...partie, gameSystemId: 'ralliement' });
      await service.update('p1', 'mj1', { name: 'Neuf' });

      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        kind: 'ONE_SHOT',
      });
      await service.update('p1', 'mj1', { name: partie.name });

      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('un admin ne change pas le kind d’un ralliement (400), aucune écriture (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        kind: 'ONE_SHOT',
      });
      const promise = service.update('p1', 'mj1', { kind: 'CAMPAGNE_EPISODIQUE' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(RALLIEMENT_TYPE_LOCKED_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un membre ne modifie pas un ralliement : 403 « réservée aux administrateurs », aucune écriture (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ralliement' });
      prisma.membership.findUnique.mockResolvedValue({ userId: 'm', role: 'MEMBER' });
      const promise = service.update('p1', 'm', { name: 'Nouveau nom' });
      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(ADMIN_ONLY_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('un admin renomme son ralliement en renvoyant les mêmes kind et système : accepté, rôle admin (Story 38.2)', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        kind: 'ONE_SHOT',
      });
      prisma.partie.update.mockResolvedValue({
        ...partie,
        gameSystemId: 'ralliement',
        name: 'Nouveau nom',
      });
      const dto = await service.update('p1', 'mj1', {
        name: 'Nouveau nom',
        kind: 'ONE_SHOT',
        gameSystemId: 'ralliement',
      });
      expect(dto.role).toBe('admin');
    });

    it('renvoyer le gameSystemId ralliement inchangé reste accepté', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ralliement' });
      await expect(
        service.update('p1', 'mj1', { name: 'Nouveau nom', gameSystemId: 'ralliement' }),
      ).resolves.toBeDefined();
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom', gameSystemId: 'ralliement' },
      });
    });

    it('même famille vers un système fermé (ryuutama → draconis) : message « sans module », pas celui de famille', async () => {
      const promise = service.update('p1', 'mj1', { gameSystemId: 'draconis' });
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE);
      await expect(promise).rejects.not.toThrow(GAME_SYSTEM_FAMILY_CHANGE_MESSAGE);
      expect(prisma.partie.update).not.toHaveBeenCalled();
    });

    it('système courant inconnu du registre → ryuutama : non bloqué par la garde de famille', async () => {
      prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'systeme-disparu' });
      await expect(
        service.update('p1', 'mj1', { gameSystemId: 'ryuutama' }),
      ).resolves.toBeDefined();
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { gameSystemId: 'ryuutama', hommeDragonId: null },
      });
    });
  });

  describe('update() — remise à NULL du lien Homme Dragon (AD-23, Story 33.8)', () => {
    // La partie est sur un système SANS module ('draconis') et porte un Homme Dragon (état fictif :
    // seul le test de remise à NULL nous intéresse) ; on la fait passer sur Ryuutama.
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'draconis',
        hommeDragonId: 'hd1',
      });
      prisma.partie.update.mockResolvedValue({ ...partie, gameSystemId: 'ryuutama' });
    });

    it('changement de gameSystemId : hommeDragonId remis à NULL dans le même UPDATE, jamais dans un second statement', async () => {
      await service.update('p1', 'mj1', { gameSystemId: 'ryuutama' });

      expect(prisma.partie.update).toHaveBeenCalledTimes(1);
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { gameSystemId: 'ryuutama', hommeDragonId: null },
      });
    });

    it('émet partie:{id} puis les signaux (user: du MJ et des membres) quand le système change', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'u1', pseudo: 'Alice', displayName: 'Alice' } },
      ]);
      prisma.user.findUnique.mockResolvedValue({ id: 'mj1', pseudo: 'mj', displayName: 'MJ' });

      await service.update('p1', 'mj1', { gameSystemId: 'ryuutama' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('mj1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('u1'));
    });

    it('système INCHANGÉ : le lien est conservé (aucun hommeDragonId dans le payload), aucun signal supplémentaire', async () => {
      prisma.partie.findUnique.mockResolvedValue({
        ...partie,
        gameSystemId: 'ryuutama',
        hommeDragonId: 'hd1',
      });

      await service.update('p1', 'mj1', { name: 'Nouveau nom', gameSystemId: 'ryuutama' });

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom', gameSystemId: 'ryuutama' },
      });
      expect(realtimeEvents.emit).not.toHaveBeenCalledWith(userTopic('mj1'));
    });

    it('sans gameSystemId : le lien est conservé', async () => {
      await service.update('p1', 'mj1', { name: 'Nouveau nom' });

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nouveau nom' },
      });
    });
  });

  describe('setVisibilityLocks() — Story 31.6, cadenas de visibilité', () => {
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId: 'mj1'
    });

    it('MJ seul : joueur non-MJ → ForbiddenException, aucune écriture', async () => {
      await expect(
        service.setVisibilityLocks('p1', 'joueur1', { paths: [{ fieldKey: 'classId' }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('MJ : remplace intégralement les verrous existants (deleteMany puis createMany, une seule transaction)', async () => {
      await service.setVisibilityLocks('p1', 'mj1', {
        paths: [{ fieldKey: 'classId' }, { fieldKey: 'attributes', subField: 'AGI' }],
      });

      expect(prisma.partieVisibilityLock.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
      expect(prisma.partieVisibilityLock.createMany).toHaveBeenCalledWith({
        data: [
          { partieId: 'p1', fieldKey: 'classId', subField: null },
          { partieId: 'p1', fieldKey: 'attributes', subField: 'AGI' },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('jeu vide : deleteMany appelé, createMany jamais (aucune ligne à créer)', async () => {
      await service.setVisibilityLocks('p1', 'mj1', { paths: [] });

      expect(prisma.partieVisibilityLock.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
      expect(prisma.partieVisibilityLock.createMany).not.toHaveBeenCalled();
    });

    it('chemins dupliqués (même fieldKey+subField) → BadRequestException, aucune écriture', async () => {
      await expect(
        service.setVisibilityLocks('p1', 'mj1', {
          paths: [
            { fieldKey: 'attributes', subField: 'AGI' },
            { fieldKey: 'attributes', subField: 'AGI' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('renvoie le jeu de verrous persisté', async () => {
      const result = await service.setVisibilityLocks('p1', 'mj1', {
        paths: [{ fieldKey: 'classId' }],
      });
      expect(result).toEqual([{ fieldKey: 'classId', subField: null }]);
    });
  });

  describe('getVisibilityLocks() — Story 31.7, lecture symétrique au PUT', () => {
    beforeEach(() => {
      prisma.partie.findUnique.mockResolvedValue(partie); // ownerId: 'mj1'
    });

    it('MJ seul : joueur non-MJ → ForbiddenException, aucune lecture de verrou', async () => {
      await expect(service.getVisibilityLocks('p1', 'joueur1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.partieVisibilityLock.findMany).not.toHaveBeenCalled();
    });

    it('partie introuvable → NotFoundException (même garde getOwned() que le PUT)', async () => {
      prisma.partie.findUnique.mockResolvedValue(null);
      await expect(service.getVisibilityLocks('p1', 'mj1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('MJ : lit les verrous persistés pour cette partie, même forme {fieldKey, subField}[]', async () => {
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { partieId: 'p1', fieldKey: 'classId', subField: null },
        { partieId: 'p1', fieldKey: 'attributes', subField: 'AGI' },
      ]);

      const result = await service.getVisibilityLocks('p1', 'mj1');

      expect(prisma.partieVisibilityLock.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
      expect(result).toEqual([
        { fieldKey: 'classId', subField: null },
        { fieldKey: 'attributes', subField: 'AGI' },
      ]);
    });

    it('aucun verrou posé → tableau vide (pas une erreur)', async () => {
      prisma.partieVisibilityLock.findMany.mockResolvedValue([]);
      const result = await service.getVisibilityLocks('p1', 'mj1');
      expect(result).toEqual([]);
    });
  });

  describe('eraseMembershipsInTx() / announceAccountErasure() — effacement de compte (Story 43.2)', () => {
    const tx = () => prisma as unknown as Prisma.TransactionClient;

    beforeEach(() => {
      prisma.partie.findMany.mockResolvedValue([]);
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.partie.delete.mockResolvedValue({});
      prisma.$queryRaw.mockResolvedValue([{ id: 'g1' }]);
      prisma.membership.deleteMany.mockResolvedValue({ count: 1 });
      prisma.membership.count.mockResolvedValue(2);
    });

    it('supprime les parties de JDR possédées (joueurs relevés avant), pas les groupes', async () => {
      prisma.partie.findMany.mockResolvedValue([
        { id: 'q1', gameSystemId: 'ryuutama' },
        { id: 'g9', gameSystemId: 'ralliement' },
      ]);
      prisma.membership.findMany
        .mockResolvedValueOnce([{ userId: 'j1' }, { userId: 'j2' }]) // joueurs de q1
        .mockResolvedValueOnce([]); // adhésions du compte

      const effects = await service.eraseMembershipsInTx(tx(), 'u1');

      expect(prisma.partie.delete).toHaveBeenCalledTimes(1);
      expect(prisma.partie.delete).toHaveBeenCalledWith({ where: { id: 'q1' } });
      expect(effects.deletedJdr).toEqual([{ partieId: 'q1', participantIds: ['j1', 'j2'] }]);
    });

    it('joueur d’une partie de JDR : il perd sa ligne d’adhésion, sans verrou', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { partieId: 'q2', partie: { gameSystemId: 'ryuutama', ownerId: 'mj1' } },
      ]);

      const effects = await service.eraseMembershipsInTx(tx(), 'u1');

      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'q2', userId: 'u1' },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(effects.jdrDepartures).toEqual([{ partieId: 'q2', ownerId: 'mj1' }]);
    });

    it('seul administrateur : le groupe est supprimé sans demander de confirmation', async () => {
      prisma.membership.findMany
        .mockResolvedValueOnce([
          { partieId: 'g1', partie: { gameSystemId: 'ralliement', ownerId: 'u1' } },
        ])
        .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'm1' }]); // participants lus avant
      prisma.membership.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.membership.count.mockResolvedValue(1);

      const effects = await service.eraseMembershipsInTx(tx(), 'u1');

      expect(prisma.partie.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(effects.groupDepartures[0].outcome).toMatchObject({
        deleted: true,
        participantIds: ['u1', 'm1'],
      });
    });

    it('administrateur parmi d’autres : le groupe survit, adhésion retirée, ownerId vidé', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { partieId: 'g1', partie: { gameSystemId: 'ralliement', ownerId: 'u1' } },
      ]);
      prisma.membership.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.membership.count.mockResolvedValue(2);
      prisma.partie.updateMany.mockResolvedValue({ count: 1 });

      const effects = await service.eraseMembershipsInTx(tx(), 'u1');

      expect(prisma.partie.delete).not.toHaveBeenCalled();
      expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
        where: { partieId: 'g1', userId: 'u1' },
      });
      expect(prisma.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'g1', ownerId: 'u1' },
        data: { ownerId: null },
      });
      expect(effects.groupDepartures[0].outcome).toMatchObject({
        deleted: false,
        ownerCleared: true,
      });
    });

    it('Story 49.3 : effacement du compte — les apports à venir du compte sont supprimés dans la même procédure de départ', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { partieId: 'g1', partie: { gameSystemId: 'ralliement', ownerId: 'mj1' } },
      ]);
      prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER' });
      prisma.eventGameBring.findMany.mockResolvedValue([{ eventId: 'evA' }]);

      await service.eraseMembershipsInTx(tx(), 'u1');

      expect(callArg<{ where: unknown }>(prisma.eventGameBring.deleteMany).where).toEqual(
        objectLike({ userId: 'u1', event: objectLike({ partieId: 'g1' }) }),
      );
    });

    it('lit les adhésions dans l’ordre des identifiants (ordre de verrouillage stable)', async () => {
      await service.eraseMembershipsInTx(tx(), 'u1');

      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, orderBy: { partieId: 'asc' } }),
      );
    });

    it('annonce après coup : e-mail n° 7 au nom de l’hôte effacé, temps réel pour les parties supprimées', async () => {
      await service.announceAccountErasure('u1', 'Alice au pays', {
        deletedJdr: [{ partieId: 'q1', participantIds: ['j1'] }],
        jdrDepartures: [],
        groupDepartures: [
          {
            partieId: 'g1',
            ownerId: 'u1',
            outcome: {
              deleted: false,
              ownerCleared: true,
              participantIds: [],
              cancelledEventIds: ['e1'],
            },
          },
        ],
      });

      expect(mailer.send).toHaveBeenCalledWith('g1', 'e1', 'u1', [], 'Alice au pays');
      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('q1'));
      expect(realtimeEvents.emit).toHaveBeenCalledWith(userTopic('j1'));
    });

    it('un échec d’annonce est journalisé, jamais remonté', async () => {
      realtimeEvents.emit.mockImplementation(() => {
        throw new Error('sse');
      });

      await expect(
        service.announceAccountErasure('u1', 'A', {
          deletedJdr: [{ partieId: 'q1', participantIds: [] }],
          jdrDepartures: [],
          groupDepartures: [],
        }),
      ).resolves.toBeUndefined();
    });
  });

  // Story 46.4 — masquer / démasquer une fenêtre de l'automate.
  describe('masquer une fenêtre de l’automate (Story 46.4)', () => {
    const DAY = '2099-03-06';
    const body = { date: DAY, startSlot: 'EVENING' as const, durationSlots: 1 };

    describe.each([
      ['hideWindow', 'createMany'],
      ['showWindow', 'deleteMany'],
    ] as const)('%s', (method, write) => {
      it('le MJ écrit sa propre ligne et émet seulement son canal user:', async () => {
        prisma.partie.findUnique.mockResolvedValue(partie); // ownerId = 'mj1'
        await expect(service[method]('p1', 'mj1', body)).resolves.toEqual({ ok: true });

        const call = prisma.slotWindowHidden[write].mock.calls[0][0];
        const payload = method === 'hideWindow' ? call.data[0] : call.where;
        expect(payload).toMatchObject({
          userId: 'mj1',
          partieId: 'p1',
          startSlot: 'EVENING',
          durationSlots: 1,
        });
        expect(payload.date.toISOString()).toBe(`${DAY}T00:00:00.000Z`);
        expect(realtimeEvents.emit).toHaveBeenCalledTimes(1);
        expect(realtimeEvents.emit).toHaveBeenCalledWith('user:mj1');
      });

      it('un joueur est refusé : rien d’écrit, rien d’émis', async () => {
        prisma.partie.findUnique.mockResolvedValue(partie);
        prisma.membership.findUnique.mockResolvedValue({ userId: 'u1', partieId: 'p1' });
        await expect(service[method]('p1', 'u1', body)).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.slotWindowHidden[write]).not.toHaveBeenCalled();
        expect(realtimeEvents.emit).not.toHaveBeenCalled();
      });

      it('un étranger à la partie est refusé', async () => {
        prisma.partie.findUnique.mockResolvedValue(partie);
        prisma.membership.findUnique.mockResolvedValue(null);
        await expect(service[method]('p1', 'intrus', body)).rejects.toThrow();
        expect(prisma.slotWindowHidden[write]).not.toHaveBeenCalled();
      });

      it('un ralliement est refusé, même à son créateur', async () => {
        prisma.partie.findUnique.mockResolvedValue({ ...partie, gameSystemId: 'ralliement' });
        await expect(service[method]('p1', 'mj1', body)).rejects.toThrow();
        expect(prisma.slotWindowHidden[write]).not.toHaveBeenCalled();
      });
    });

    it('masquer : idempotent (skipDuplicates)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await service.hideWindow('p1', 'mj1', body);
      expect(prisma.slotWindowHidden.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    });

    it('masquer une date passée : 400 en français, rien d’écrit', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(
        service.hideWindow('p1', 'mj1', { ...body, date: '2020-01-01' }),
      ).rejects.toThrow(HIDE_WINDOW_PAST_MESSAGE);
      expect(prisma.slotWindowHidden.createMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('démasquer une fenêtre passée reste permis (nettoyage)', async () => {
      prisma.partie.findUnique.mockResolvedValue(partie);
      await expect(
        service.showWindow('p1', 'mj1', { ...body, date: '2020-01-01' }),
      ).resolves.toEqual({ ok: true });
    });
  });
});

describe('GetAvailableSlotsDto', () => {
  it('accepte weeks=16 (valeur max)', async () => {
    const dto = plainToInstance(GetAvailableSlotsDto, { weeks: '16' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejette weeks=17 (dépasse le max)', async () => {
    const dto = plainToInstance(GetAvailableSlotsDto, { weeks: '17' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'weeks')).toBe(true);
  });

  it('accepte weeks absent (optionnel)', async () => {
    const dto = plainToInstance(GetAvailableSlotsDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
