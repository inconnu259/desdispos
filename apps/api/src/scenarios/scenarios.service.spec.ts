import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

jest.mock('./document-mime.util', () => ({
  detectDocumentMime: jest.fn(),
  isStructurallyValidPdf: jest.fn(),
}));
jest.mock('./document-storage.util', () => ({
  writeDocumentFile: jest.fn(),
  readDocumentFile: jest.fn(),
  deleteDocumentFile: jest.fn(),
}));
// CharacterService (import réel pour servir de jeton DI, cf. plus bas) importe transitivement
// @master-jdr/game-rules (ESM, non transformé par ts-jest) — même mock que character.service.spec.ts
// pour éviter "Unexpected token export" au chargement du module.
jest.mock('@master-jdr/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  pendingLevels: jest.fn(),
  LEVEL_TABLE: [],
}));

import { detectDocumentMime, isStructurallyValidPdf } from './document-mime.util';
import { deleteDocumentFile, readDocumentFile, writeDocumentFile } from './document-storage.util';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { CharacterService } from '../characters/character.service';
import { PollService } from '../poll/poll.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { ScenariosService } from './scenarios.service';
import { BoardGamesService } from '../board-games/board-games.service';
import { EventsService } from '../events/events.service';
import { GroupEventsService } from '../events/group-events.service';
import { PermissionService } from '../permissions/permission.service';
import { anyOf, objectLike } from '../common/test-utils/jest-typed';
import { testGrant } from '../common/test-utils/grant';
import { VISIBLE_SCENARIO_WHERE } from '../permissions/scenario-visibility';

function makePrisma() {
  const tx = {
    // Défaut : verrou de partie pris par `EventsService.createInTx` (garde ONE_SHOT).
    $queryRaw: jest.fn().mockResolvedValue([{ kind: 'CAMPAGNE_LINEAIRE' }]),
    scenario: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    seance: {
      findUniqueOrThrow: jest.fn(),
    },
    inscription: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };
  const prismaMock = {
    // Story 37.3 — événement de base (écrit par `EventsService`).
    event: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      // Story 37.6 — `EventsService` vérifie que l'événement écrit appartient à la partie de
      // l'autorisation (1 = oui).
      count: jest.fn().mockResolvedValue(1),
    },
    scenario: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    scenarioDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    scenarioParticipant: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    seance: {
      // Story 37.6 — idem pour la séance écrite.
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    sessionPoll: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    inscription: {
      deleteMany: jest.fn(),
    },
    // Story 36.6 — effectif de la troupe (SessionPollDto.membersCount). 0 Membership par défaut,
    // soit un effectif de 1 (le MJ) : aucun effet sur les tests existants.
    membership: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    partie: {
      update: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    tx,
  };
  // Story 37.3 — `EventsService.create()` et `update()` écrivent dans une transaction : les mêmes
  // mocks servent à l'intérieur et à l'extérieur, pour que les assertions restent sur `prisma.*`.
  Object.assign(tx, {
    event: prismaMock.event,
    seance: {
      ...tx.seance,
      create: prismaMock.seance.create,
      // Recalcul de la prochaine séance à l'ouverture d'un scénario (dans la transaction).
      findMany: prismaMock.seance.findMany,
      // Story 47.1 : correction de durée d'une séance (lecture puis écriture sous verrou).
      findUnique: prismaMock.seance.findUnique,
      update: prismaMock.seance.update,
    },
    partie: prismaMock.partie,
  });
  Object.assign(tx.scenario, {
    create: prismaMock.scenario.create,
    update: prismaMock.scenario.update,
  });
  return prismaMock;
}

/** Story 37.3 — champs portés par l'événement de base d'un scénario. */
const EVENT_FIELDS = ['partieId', 'title', 'description', 'createdAt', 'partie'];

/** Story 37.3 — les fixtures décrivent un scénario « à plat » (forme historique) ; Prisma renvoie
 *  désormais l'extension avec son événement de base (`include: { event: true }`). */
function withEvent<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => withEvent(v)) as T;
  if (!value || typeof value !== 'object' || 'event' in value) return value;
  const flat = value as Record<string, unknown>;
  const event: Record<string, unknown> = { id: flat.id, ownerId: null };
  const extension: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(flat)) {
    if (EVENT_FIELDS.includes(key)) event[key] = v;
    else extension[key] = v;
  }
  return { ...extension, event } as T;
}

/** Story 37.3 — `Seance.scenarioId` est devenu `eventId` (mêmes valeurs). */
function asSeance<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => asSeance(v)) as T;
  if (!value || typeof value !== 'object' || !('scenarioId' in value)) return value;
  const { scenarioId, ...rest } = value as Record<string, unknown>;
  return { ...rest, eventId: scenarioId } as T;
}

/** Story 37.3 — un scénario créé = un `Event` (créé par `EventsService`) + son extension. */
function mockCreatedScenario(prisma: ReturnType<typeof makePrisma>, flat: Record<string, unknown>) {
  const { event, ...extension } = withEvent(flat);
  prisma.event.create.mockResolvedValue(event);
  prisma.scenario.create.mockResolvedValue(extension);
}

function makeParties() {
  return {
    notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined),
  };
}

/** Story 37.6 — les droits sont décidés par `PermissionService.assert()`, simulé ici : une
 *  autorisation (`testGrant`) ou un refus selon le test. */
function makePermissions() {
  // Story 40.3 : par défaut une autorisation de partie JDR — `inscrire`/`desinscrire` lisent la famille
  // de la partie de l'autorisation dès que la séance est trouvée. Chaque test peut la remplacer.
  return {
    assert: jest.fn().mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' })),
    // Story 44.1 : les droits d'organisateur des séances (`can`) sont calculés par `PermissionService`
    // en un lot aligné sur les cibles — simulé ici (le calcul lui-même est testé dans permissions/).
    organizerCan: jest
      .fn()
      .mockImplementation((_userId: string, targets: unknown[]) =>
        Promise.resolve(targets.map(() => SEANCE_CAN)),
      ),
  };
}

/** Droits d'organisateur simulés d'une séance (Story 44.1) : un MJ de JDR — jamais `extend`. */
const SEANCE_CAN = { propose: true, edit: true, choose: true, extend: false };

function makeCharacters() {
  return {
    findAllByPartie: jest.fn().mockResolvedValue([]),
    getRetrospectiveNotes: jest.fn().mockResolvedValue([]),
  };
}

function makePollService() {
  return { create: jest.fn() };
}

/** Story 47.4 — `PollService.create` simulé : comme le vrai, il confie l'écriture du vote à l'appelant
 *  (`EventsService.createSeancePoll`, transaction unique) puis rend le vote créé. */
function pollCreates(pollService: ReturnType<typeof makePollService>, pollId: string) {
  pollService.create.mockImplementation(
    async (
      _grant: unknown,
      _userId: unknown,
      _dto: unknown,
      persist?: (write: (tx: unknown, durationSlots: number) => Promise<{ id: string }>) => Promise<void>,
    ) => {
      await persist?.(async () => ({ id: pollId }));
      return { id: pollId };
    },
  );
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

const VALID_SCENARIO_ID = '22222222-2222-4222-a222-222222222222';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: Buffer.from('%PDF-1.4\n...'),
    originalname: 'lettre-ossian.pdf',
    size: 12,
    ...overrides,
  } as Express.Multer.File;
}

describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: ReturnType<typeof makePrisma>;
  let parties: ReturnType<typeof makeParties>;
  let permissions: ReturnType<typeof makePermissions>;
  let characters: ReturnType<typeof makeCharacters>;
  let pollService: ReturnType<typeof makePollService>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;
  let groupEvents: {
    accepter: jest.Mock;
    reserver: jest.Mock;
    retirerReservation: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Défaut : la plupart des tests uploadDocument() mockent detectDocumentMime → 'application/pdf'
    // sans porter sur la validation structurelle elle-même — sans ce défaut, isStructurallyValidPdf
    // (jest.fn() nu, non mocké explicitement) résoudrait `undefined`, faussement falsy.
    (isStructurallyValidPdf as jest.Mock).mockResolvedValue(true);
    prisma = makePrisma();
    parties = makeParties();
    permissions = makePermissions();
    characters = makeCharacters();
    pollService = makePollService();
    realtimeEvents = makeRealtimeEvents();
    // Chaque transition d'état (toEnrichedDto) charge désormais les séances — [] par défaut pour
    // les tests qui ne portent pas explicitement sur `seances` (AC7, jamais undefined).
    prisma.seance.findMany.mockResolvedValue([]);
    // Idem pour les participants (branche CAMPAGNE_EPISODIQUE de toEnrichedDto) — [] par défaut
    // pour les tests Story 8.3 qui utilisent ce kind sans porter sur `participants`.
    prisma.scenarioParticipant.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        ScenariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartiesService, useValue: parties },
        { provide: PermissionService, useValue: permissions },
        { provide: CharacterService, useValue: characters },
        { provide: PollService, useValue: pollService },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
        // Story 37.3 — l'EventsService réel, sur les mêmes mocks Prisma/temps réel.
        EventsService,
        // Story 49.5 — `EventsService` lit les noms de jeu sur place par `BoardGamesService` (jamais atteint ici).
        { provide: BoardGamesService, useValue: {} },
        // Story 40.3 — branche « groupe » des routes d'inscription (jamais atteinte par ces tests JDR).
        {
          provide: GroupEventsService,
          useValue: {
            inscrire: jest.fn(),
            desinscrire: jest.fn(),
            accepter: jest.fn(),
            reserver: jest.fn(),
            retirerReservation: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(ScenariosService);
    groupEvents = module.get(GroupEventsService);
  });

  describe('places réservées d’une conjonction (Story 40.4)', () => {
    const GROUPE = {
      id: 'g1',
      ownerId: 'a',
      kind: 'CAMPAGNE_EPISODIQUE',
      gameSystemId: 'ralliement',
    };
    const grant = (partie: Record<string, unknown> = GROUPE) =>
      testGrant(partie, 'member', { eventId: 'e1', seanceId: 'se1' });

    it('reserver : droit SEANCE_RESERVE décidé sur la SÉANCE (jamais la route), puis délégation au groupe', async () => {
      const g = grant();
      permissions.assert.mockResolvedValue(g);
      groupEvents.reserver.mockResolvedValue({ id: 'e1' });

      await expect(service.reserver('se1', 'hote', 'cible')).resolves.toEqual({ id: 'e1' });

      expect(permissions.assert).toHaveBeenCalledWith('hote', 'SEANCE_RESERVE', {
        seanceId: 'se1',
      });
      expect(groupEvents.reserver).toHaveBeenCalledWith(g, 'hote', 'cible');
    });

    it('retirerReservation : même droit, puis délégation au groupe', async () => {
      const g = grant();
      permissions.assert.mockResolvedValue(g);

      await service.retirerReservation('se1', 'hote', 'cible');

      expect(permissions.assert).toHaveBeenCalledWith('hote', 'SEANCE_RESERVE', {
        seanceId: 'se1',
      });
      expect(groupEvents.retirerReservation).toHaveBeenCalledWith(g, 'hote', 'cible');
    });

    it.each(['reserver', 'retirerReservation'] as const)(
      '%s : un refus de droit (non-hôte, étranger, JDR) remonte, rien n’est délégué',
      async (method) => {
        permissions.assert.mockRejectedValue(new ForbiddenException('pas l’hôte'));

        await expect(service[method]('se1', 'autre', 'cible')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(groupEvents.reserver).not.toHaveBeenCalled();
        expect(groupEvents.retirerReservation).not.toHaveBeenCalled();
      },
    );

    it('accepter : droit SEANCE_INSCRIBE (comme s’inscrire) sur la séance, puis délégation au groupe', async () => {
      const g = grant();
      permissions.assert.mockResolvedValue(g);
      groupEvents.accepter.mockResolvedValue({ id: 'e1' });

      await expect(service.accepterReservation('se1', 'cible')).resolves.toEqual({ id: 'e1' });

      expect(permissions.assert).toHaveBeenCalledWith('cible', 'SEANCE_INSCRIBE', {
        seanceId: 'se1',
      });
      expect(groupEvents.accepter).toHaveBeenCalledWith(g, 'cible');
    });

    it('accepter : une partie de JDR est refusée (403) — la réservation n’existe que dans un groupe', async () => {
      permissions.assert.mockResolvedValue(
        grant({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(service.accepterReservation('se1', 'joueur')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(groupEvents.accepter).not.toHaveBeenCalled();
    });

    it('accepter : un refus de droit (étranger) remonte tel quel', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException('pas accès'));

      await expect(service.accepterReservation('se1', 'etranger')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(groupEvents.accepter).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('crée un scénario BROUILLON rattaché à la Partie (AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      mockCreatedScenario(prisma, {
        id: 's1',
        partieId: 'p1',
        title: 'Le Marché aux Ombres',
        description: null,
        status: 'BROUILLON',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        closedAt: null,
      });

      const result = await service.create('p1', 'mj1', {
        title: 'Le Marché aux Ombres',
      });

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_CREATE', { partieId: 'p1' });
      // Story 37.3 : `partieId`/`title` sur l'événement de base, `status` sur son extension.
      expect(prisma.event.create).toHaveBeenCalledWith(
        objectLike({
          data: objectLike({
            partieId: 'p1',
            title: 'Le Marché aux Ombres',
          }),
        }),
      );
      expect(prisma.scenario.create).toHaveBeenCalledWith(
        objectLike({
          data: objectLike({
            id: 's1',
            status: 'BROUILLON',
          }),
        }),
      );
      expect(result.status).toBe('BROUILLON');
      expect(result.id).toBe('s1');
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      mockCreatedScenario(prisma, {
        id: 's1',
        partieId: 'p1',
        title: 'Le Marché aux Ombres',
        description: null,
        status: 'BROUILLON',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        closedAt: null,
      });

      await service.create('p1', 'mj1', { title: 'Le Marché aux Ombres' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('crée automatiquement une première Seance rattachée (le scénario a toujours besoin d’au moins une date à planifier)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      mockCreatedScenario(prisma, {
        id: 's1',
        partieId: 'p1',
        title: 'Le Marché aux Ombres',
        description: null,
        status: 'BROUILLON',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        closedAt: null,
      });

      await service.create('p1', 'mj1', { title: 'Le Marché aux Ombres' });

      expect(prisma.seance.create).toHaveBeenCalledWith({
        data: { eventId: 's1' },
      });
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture (AC2)', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.create('p1', 'stranger', { title: 'Test' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenario.create).not.toHaveBeenCalled();
    });

    it('Partie ONE_SHOT → rejet, aucune écriture (FR-1 : un seul scénario, jamais créé manuellement)', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'ONE_SHOT',
        }),
      );

      await expect(service.create('p1', 'mj1', { title: 'Second scénario' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.scenario.create).not.toHaveBeenCalled();
    });

    it('Partie CAMPAGNE_LINEAIRE → autorisée (pas de restriction de kind)', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      mockCreatedScenario(prisma, {
        id: 's1',
        partieId: 'p1',
        title: 'Chapitre 1',
        description: null,
        status: 'BROUILLON',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        closedAt: null,
      });

      const result = await service.create('p1', 'mj1', {
        title: 'Chapitre 1',
      });
      expect(result.status).toBe('BROUILLON');
    });

    it('plusieurs créations indépendantes créent chacune un BROUILLON, sans contrainte d’ordre (AC6)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.event.create
        .mockResolvedValueOnce({
          id: 's1',
          partieId: 'p1',
          title: 'A',
          description: null,
          ownerId: 'mj1',
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
        })
        .mockResolvedValueOnce({
          id: 's2',
          partieId: 'p1',
          title: 'B',
          description: null,
          ownerId: 'mj1',
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
        });
      prisma.scenario.create
        .mockResolvedValueOnce({
          id: 's1',
          status: 'BROUILLON',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          closedAt: null,
        })
        .mockResolvedValueOnce({
          id: 's2',
          status: 'BROUILLON',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          closedAt: null,
        });

      const first = await service.create('p1', 'mj1', { title: 'A' });
      const second = await service.create('p1', 'mj1', { title: 'B' });

      expect(first.status).toBe('BROUILLON');
      expect(second.status).toBe('BROUILLON');
      expect(prisma.scenario.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('update()', () => {
    it('édite un scénario hors PASSE (AC4)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          title: 'Nouveau titre',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      const result = await service.update('s1', 'mj1', {
        title: 'Nouveau titre',
      });

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_UPDATE', { eventId: 's1' });
      // Story 37.3 : le titre vit sur l'événement de base, écrit par `EventsService`.
      expect(prisma.event.update).toHaveBeenCalledWith(
        objectLike({
          where: { id: 's1' },
          data: objectLike({ title: 'Nouveau titre' }),
        }),
      );
      expect(result.title).toBe('Nouveau titre');
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          title: 'Nouveau titre',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.update('s1', 'mj1', { title: 'Nouveau titre' });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('CAMPAGNE_EPISODIQUE : participants restent peuplés dans le DTO retourné après update() (non-régression)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          title: 'Nouveau titre',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: 's1',
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
      ]);

      const result = await service.update('s1', 'mj1', {
        title: 'Nouveau titre',
      });

      expect(result.participants).toEqual([
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
      ]);
    });

    it('scénario PASSE → rejet, aucune écriture (AC5)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'PASSE',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

      await expect(
        service.update('s1', 'mj1', { description: 'nouvelle description' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.update('s1', 'stranger', { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });
  });

  describe('uploadDocument()', () => {
    it('upload avec scenarioId → ScenarioDocument rattaché au scénario (AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      (detectDocumentMime as jest.Mock).mockReturnValue('application/pdf');
      (writeDocumentFile as jest.Mock).mockResolvedValue('uuid.pdf');
      prisma.scenarioDocument.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        scenarioId: VALID_SCENARIO_ID,
        originalName: 'lettre-ossian.pdf',
        sizeBytes: 12,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      });

      const result = await service.uploadDocument('p1', 'mj1', makeFile(), VALID_SCENARIO_ID);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_DOCUMENT_UPLOAD', {
        partieId: 'p1',
      });
      expect(prisma.scenarioDocument.create).toHaveBeenCalledWith(
        objectLike({
          data: objectLike({
            partieId: 'p1',
            scenarioId: VALID_SCENARIO_ID,
          }),
        }),
      );
      expect(result.scenarioId).toBe(VALID_SCENARIO_ID);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue('application/pdf');
      (writeDocumentFile as jest.Mock).mockResolvedValue('uuid.pdf');
      prisma.scenarioDocument.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        scenarioId: null,
        originalName: 'regles-maison.pdf',
        sizeBytes: 12,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      });

      await service.uploadDocument('p1', 'mj1', makeFile());

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('upload sans scenarioId → scenarioId: null (AC3)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue('application/pdf');
      (writeDocumentFile as jest.Mock).mockResolvedValue('uuid.pdf');
      prisma.scenarioDocument.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        scenarioId: null,
        originalName: 'regles-maison.pdf',
        sizeBytes: 12,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      });

      const result = await service.uploadDocument('p1', 'mj1', makeFile());

      expect(prisma.scenario.findUnique).not.toHaveBeenCalled();
      expect(prisma.scenarioDocument.create).toHaveBeenCalledWith(
        objectLike({
          data: objectLike({ partieId: 'p1', scenarioId: null }),
        }),
      );
      expect(result.scenarioId).toBeNull();
    });

    it('upload sur un scénario PASSE → rejet, aucune écriture (exigence croisée 7.1 AC5)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'PASSE',
        }),
      );

      await expect(
        service.uploadDocument('p1', 'mj1', makeFile(), VALID_SCENARIO_ID),
      ).rejects.toThrow(BadRequestException);
      expect(writeDocumentFile).not.toHaveBeenCalled();
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('upload sur un scenarioId n’appartenant pas à la Partie → rejet', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'AUTRE_PARTIE',
          status: 'BROUILLON',
        }),
      );

      await expect(
        service.uploadDocument('p1', 'mj1', makeFile(), VALID_SCENARIO_ID),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('scenarioId inexistant → 404, aucune écriture', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadDocument('p1', 'mj1', makeFile(), VALID_SCENARIO_ID),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('fichier non reconnu (ni PDF ni texte) → rejet, aucune écriture (AC1/AC2)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue(null);

      await expect(service.uploadDocument('p1', 'mj1', makeFile())).rejects.toThrow(
        BadRequestException,
      );
      expect(writeDocumentFile).not.toHaveBeenCalled();
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('PDF détecté par signature magique mais structurellement invalide → rejet, aucune écriture (Story 16.1 AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue('application/pdf');
      (isStructurallyValidPdf as jest.Mock).mockResolvedValue(false);

      await expect(service.uploadDocument('p1', 'mj1', makeFile())).rejects.toThrow(
        BadRequestException,
      );
      expect(writeDocumentFile).not.toHaveBeenCalled();
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('fichier texte détecté → isStructurallyValidPdf jamais appelé, upload réussit (Story 16.1 AC3, non-régression texte)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue('text/plain');
      (writeDocumentFile as jest.Mock).mockResolvedValue('uuid.txt');
      prisma.scenarioDocument.create.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        scenarioId: null,
        originalName: 'regles-maison.txt',
        sizeBytes: 12,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      });

      const result = await service.uploadDocument('p1', 'mj1', makeFile());

      expect(isStructurallyValidPdf).not.toHaveBeenCalled();
      expect(result.scenarioId).toBeNull();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.uploadDocument('p1', 'stranger', makeFile())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('scenarioId malformé (pas un UUID) → rejet, aucune écriture', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

      await expect(service.uploadDocument('p1', 'mj1', makeFile(), 'not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.scenario.findUnique).not.toHaveBeenCalled();
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('scenarioId fourni en chaîne vide → rejet explicite, jamais traité comme absent', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

      await expect(service.uploadDocument('p1', 'mj1', makeFile(), '')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.scenarioDocument.create).not.toHaveBeenCalled();
    });

    it('échec de l’insertion Prisma → nettoie le fichier orphelin puis relance l’erreur', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      (detectDocumentMime as jest.Mock).mockReturnValue('application/pdf');
      (writeDocumentFile as jest.Mock).mockResolvedValue('uuid.pdf');
      const dbError = new Error('DB down');
      prisma.scenarioDocument.create.mockRejectedValue(dbError);

      await expect(service.uploadDocument('p1', 'mj1', makeFile())).rejects.toThrow(dbError);
      expect(deleteDocumentFile).toHaveBeenCalledWith('uuid.pdf');
    });
  });

  describe('listDocuments()', () => {
    const scenarioIn = (status: string) =>
      prisma.scenario.findUnique.mockResolvedValue(withEvent({ id: 's1', partieId: 'p1', status }));
    const WITH_SCENARIO_DOCS = {
      where: { OR: [{ scenarioId: 's1' }, { partieId: 'p1', scenarioId: null }] },
    };
    const LIBRARY_ONLY = { where: { partieId: 'p1', scenarioId: null } };

    it('anti-spoil serveur — joueur, scénario COURANT/PASSE : documents du scénario ET bibliothèque', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
      );
      prisma.scenarioDocument.findMany.mockResolvedValue([]);

      for (const status of ['COURANT', 'PASSE']) {
        scenarioIn(status);
        await service.listDocuments('s1', 'u1');
        expect(prisma.scenarioDocument.findMany).toHaveBeenLastCalledWith(
          objectLike(WITH_SCENARIO_DOCS),
        );
      }
    });

    it('anti-spoil serveur — joueur, scénario A_VENIR (ou brouillon de ONE_SHOT) : bibliothèque seule', async () => {
      prisma.scenarioDocument.findMany.mockResolvedValue([]);

      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', kind: 'CAMPAGNE_EPISODIQUE' }, 'player'),
      );
      scenarioIn('A_VENIR');
      await service.listDocuments('s1', 'u1');
      expect(prisma.scenarioDocument.findMany).toHaveBeenLastCalledWith(objectLike(LIBRARY_ONLY));

      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind: 'ONE_SHOT' }, 'player'));
      scenarioIn('BROUILLON');
      await service.listDocuments('s1', 'u1');
      expect(prisma.scenarioDocument.findMany).toHaveBeenLastCalledWith(objectLike(LIBRARY_ONLY));
    });

    it('anti-spoil serveur — joueur, brouillon caché (hors ONE_SHOT) : 404, aucune lecture de document', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
      );
      scenarioIn('BROUILLON');

      await expect(service.listDocuments('s1', 'u1')).rejects.toThrow(NotFoundException);
      expect(prisma.scenarioDocument.findMany).not.toHaveBeenCalled();
    });

    it('combine documents du scénario ET bibliothèque de Partie (AC4) — le MJ, même sur un BROUILLON', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }));
      prisma.scenarioDocument.findMany.mockResolvedValue([]);

      await service.listDocuments('s1', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SCENARIO_DOCUMENTS_READ', {
        eventId: 's1',
      });
      expect(prisma.scenarioDocument.findMany).toHaveBeenCalledWith(
        objectLike({
          where: {
            OR: [{ scenarioId: 's1' }, { partieId: 'p1', scenarioId: null }],
          },
        }),
      );
    });

    it('le MJ lit les documents de tout statut, même BROUILLON (aucun filtre pour lui)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }));
      prisma.scenarioDocument.findMany.mockResolvedValue([
        {
          id: 'd1',
          partieId: 'p1',
          scenarioId: 's1',
          originalName: 'x.pdf',
          sizeBytes: 1,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
        },
      ]);

      const result = await service.listDocuments('s1', 'u1');
      expect(result).toHaveLength(1);
    });

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);
      await expect(service.listDocuments('s1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('non-membre → 403 propagé par permissions.assert', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: 's1',
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.listDocuments('s1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listLibraryDocuments()', () => {
    it('ne renvoie que les documents scenarioId: null d’une Partie sans aucun scénario créé', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.scenarioDocument.findMany.mockResolvedValue([]);

      await service.listLibraryDocuments('p1', 'u1');

      expect(prisma.scenario.findUnique).not.toHaveBeenCalled();
      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SCENARIO_DOCUMENTS_READ', {
        partieId: 'p1',
      });
      expect(prisma.scenarioDocument.findMany).toHaveBeenCalledWith(
        objectLike({
          where: { partieId: 'p1', scenarioId: null },
        }),
      );
    });
  });

  describe('getDocumentFile()', () => {
    const scenarioDocument = (scenarioStatus: string | null) => ({
      id: 'd1',
      partieId: 'p1',
      scenarioId: scenarioStatus === null ? null : 's1',
      scenario: scenarioStatus === null ? null : { status: scenarioStatus },
      filename: 'uuid.pdf',
      originalName: 'lettre-ossian.pdf',
    });

    it('anti-spoil serveur — joueur : 404 pour un document ciblé sur un scénario BROUILLON ou A_VENIR, aucun octet lu', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));

      for (const status of ['BROUILLON', 'A_VENIR']) {
        prisma.scenarioDocument.findUnique.mockResolvedValue(scenarioDocument(status));
        await expect(service.getDocumentFile('d1', 'u1')).rejects.toThrow('Document introuvable');
      }
      expect(readDocumentFile).not.toHaveBeenCalled();
    });

    it('anti-spoil serveur — joueur : document d’un scénario COURANT/PASSE ou de la bibliothèque servi', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      (readDocumentFile as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('bytes'),
        mime: 'application/pdf',
      });

      for (const status of ['COURANT', 'PASSE', null]) {
        prisma.scenarioDocument.findUnique.mockResolvedValue(scenarioDocument(status));
        await expect(service.getDocumentFile('d1', 'u1')).resolves.toMatchObject({
          originalName: 'lettre-ossian.pdf',
        });
      }
    });

    it('téléchargement réussi pour le MJ, quel que soit le statut du scénario parent', async () => {
      prisma.scenarioDocument.findUnique.mockResolvedValue(scenarioDocument('BROUILLON'));
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }));
      (readDocumentFile as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('bytes'),
        mime: 'application/pdf',
      });

      const result = await service.getDocumentFile('d1', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SCENARIO_DOCUMENTS_READ', {
        partieId: 'p1',
      });
      expect(result.originalName).toBe('lettre-ossian.pdf');
      expect(result.mime).toBe('application/pdf');
    });

    it('document introuvable → 404', async () => {
      prisma.scenarioDocument.findUnique.mockResolvedValue(null);
      await expect(service.getDocumentFile('d1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('fichier disque manquant → 404', async () => {
      prisma.scenarioDocument.findUnique.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        filename: 'uuid.pdf',
        originalName: 'x.pdf',
      });
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      (readDocumentFile as jest.Mock).mockResolvedValue(null);

      await expect(service.getDocumentFile('d1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('non-membre → 403 propagé par permissions.assert', async () => {
      prisma.scenarioDocument.findUnique.mockResolvedValue({
        id: 'd1',
        partieId: 'p1',
        filename: 'uuid.pdf',
        originalName: 'x.pdf',
      });
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.getDocumentFile('d1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listDrafts()', () => {
    it('retourne uniquement les scénarios BROUILLON de la Partie (AC2)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.listDrafts('p1', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_DRAFTS_READ', {
        partieId: 'p1',
      });
      expect(prisma.scenario.findMany).toHaveBeenCalledWith({
        where: { event: { partieId: 'p1' }, status: 'BROUILLON' },
        orderBy: { event: { createdAt: 'desc' } },
        include: { event: true },
      });
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune lecture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.listDrafts('p1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.scenario.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findPasseForParties() (AD-23, lecture en lot)', () => {
    const user = (userId: string) => ({ pseudo: userId, displayName: `Nom ${userId}` });
    const passe = (id: string, partieId: string, kind: string, closedAt: string) => ({
      id,
      partieId,
      title: `Scénario ${id}`,
      closedAt: new Date(closedAt),
      partie: { kind },
    });

    it('aucune partie → aucune requête', async () => {
      const result = await service.findPasseForParties([]);

      expect(result.scenarios).toEqual([]);
      expect(result.membersByPartie.size).toBe(0);
      expect(prisma.scenario.findMany).not.toHaveBeenCalled();
      expect(prisma.membership.findMany).not.toHaveBeenCalled();
      expect(prisma.scenarioParticipant.findMany).not.toHaveBeenCalled();
    });

    it('trois requêtes groupées pour N parties, jamais de garde d’accès ni de boucle par partie', async () => {
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          passe('s1', 'p1', 'ONE_SHOT', '2026-01-01T00:00:00.000Z'),
          passe('s2', 'p2', 'CAMPAGNE_EPISODIQUE', '2026-02-01T00:00:00.000Z'),
          passe('s3', 'p3', 'CAMPAGNE_LINEAIRE', '2026-03-01T00:00:00.000Z'),
        ]),
      );
      prisma.membership.findMany.mockResolvedValue([]);

      await service.findPasseForParties(['p1', 'p2', 'p3']);

      expect(prisma.scenario.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        objectLike({
          where: {
            event: { partieId: { in: ['p1', 'p2', 'p3'] } },
            status: 'PASSE',
            closedAt: { not: null },
          },
          orderBy: [{ closedAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(prisma.membership.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioParticipant.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioParticipant.findMany).toHaveBeenCalledWith(
        objectLike({ where: { scenarioId: { in: ['s2'] } } }),
      );
      expect(permissions.assert).not.toHaveBeenCalled();
    });

    it('épisodique → inscrits du scénario ; sinon tous les membres de la partie', async () => {
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          passe('s1', 'p1', 'CAMPAGNE_LINEAIRE', '2026-01-01T00:00:00.000Z'),
          passe('s2', 'p2', 'CAMPAGNE_EPISODIQUE', '2026-02-01T00:00:00.000Z'),
        ]),
      );
      prisma.membership.findMany.mockResolvedValue([
        { partieId: 'p1', userId: 'alice', user: user('alice') },
        { partieId: 'p1', userId: 'bob', user: user('bob') },
        { partieId: 'p2', userId: 'alice', user: user('alice') },
        { partieId: 'p2', userId: 'carla', user: user('carla') },
      ]);
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        { scenarioId: 's2', userId: 'carla', user: user('carla') },
      ]);

      const { scenarios, membersByPartie } = await service.findPasseForParties(['p1', 'p2']);

      expect(scenarios[0].participants.map((p) => p.pseudo)).toEqual(['alice', 'bob']);
      expect(scenarios[1].participants.map((p) => p.pseudo)).toEqual(['carla']);
      expect(membersByPartie.get('p2')?.map((m) => m.userId)).toEqual(['alice', 'carla']);
    });

    it('closedAt rendu en ISO, ordre du tri serveur conservé, partieId porté par chaque scénario', async () => {
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          passe('a', 'p2', 'ONE_SHOT', '2026-01-01T10:00:00.000Z'),
          passe('b', 'p1', 'ONE_SHOT', '2026-01-02T10:00:00.000Z'),
        ]),
      );

      const { scenarios } = await service.findPasseForParties(['p1', 'p2']);

      expect(scenarios.map((s) => [s.id, s.partieId, s.closedAt])).toEqual([
        ['a', 'p2', '2026-01-01T10:00:00.000Z'],
        ['b', 'p1', '2026-01-02T10:00:00.000Z'],
      ]);
    });

    it("aucun scénario épisodique → pas de requête d'inscrits", async () => {
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([passe('s1', 'p1', 'ONE_SHOT', '2026-01-01T00:00:00.000Z')]),
      );

      await service.findPasseForParties(['p1']);

      expect(prisma.scenarioParticipant.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findAllForPartie()', () => {
    it('lecture ouverte à tout membre (SCENARIO_READ, pas une action MJ), tri chronologique croissant avec tie-breaker id (Story 17.1) — le joueur sans les brouillons cachés', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SCENARIO_READ', { partieId: 'p1' });
      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        objectLike({
          where: { AND: [{ event: { partieId: 'p1' } }, VISIBLE_SCENARIO_WHERE] },
          orderBy: [{ event: { createdAt: 'asc' } }, { id: 'asc' }],
        }),
      );
    });

    it('échec FERMÉ : un rôle autre que MJ (ici member) est filtré comme un joueur', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'member'));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'u1');

      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        objectLike({ where: { AND: [{ event: { partieId: 'p1' } }, VISIBLE_SCENARIO_WHERE] } }),
      );
    });

    it('le MJ lit la liste sans aucun filtre de statut', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'mj'));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'mj1');

      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        objectLike({ where: { event: { partieId: 'p1' } } }),
      );
    });

    it('skip/take fournis → transmis tels quels à Prisma (AC1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'u1', { skip: 20, take: 10 });

      expect(prisma.scenario.findMany).toHaveBeenCalledWith(objectLike({ skip: 20, take: 10 }));
    });

    it('skip/take absents → aucune limite appliquée (comportement par défaut inchangé)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.scenario.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'u1');

      expect(prisma.scenario.findMany).toHaveBeenCalledWith(
        objectLike({ skip: undefined, take: undefined }),
      );
    });

    it('inscriptions triées par createdAt asc avec tie-breaker id (AC2, Story 17.1)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.scenario.findMany.mockResolvedValue([]);
      prisma.seance.findMany.mockResolvedValue([]);

      await service.findAllForPartie('p1', 'u1');

      expect(prisma.seance.findMany).toHaveBeenCalledWith(
        objectLike({
          include: objectLike({
            inscriptions: objectLike({
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
          }),
        }),
      );
    });

    it('le MJ reçoit un scénario BROUILLON avec tout son contenu', async () => {
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'mj'),
      );
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Brouillon secret',
            description: 'Le meurtrier est le notaire',
            status: 'BROUILLON',
            dureeHeures: 4,
            dureeSeances: 2,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'mj1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 's1',
        status: 'BROUILLON',
        description: 'Le meurtrier est le notaire',
        dureeHeures: 4,
        dureeSeances: 2,
      });
    });

    describe('anti-spoil serveur — masquage du contenu pour un joueur', () => {
      const row = (status: string) => ({
        id: 's1',
        partieId: 'p1',
        title: 'La Tour',
        description: 'Le meurtrier est le notaire',
        status,
        dureeHeures: 4,
        dureeSeances: 2,
        resumeFin: null,
        createdAt: new Date('2026-07-01'),
        closedAt: null,
      });
      const seanceRow = {
        id: 'se1',
        eventId: 's1',
        pollId: null,
        poll: null,
        inscriptionMin: null,
        inscriptionMax: null,
        inscriptions: [],
        startDate: new Date('2099-01-02T00:00:00Z'),
        startSlot: 'EVENING',
        compteRendu: 'Spoil du compte rendu',
        heureRdv: null,
        lieu: null,
        notePratique: null,
        createdAt: new Date('2026-07-01'),
      };

      it('Story 44.1 : les droits d’organisateur des séances sont demandés en UN lot, pour le lecteur, et portés par chaque séance', async () => {
        permissions.assert.mockResolvedValue(
          testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
        );
        permissions.organizerCan.mockResolvedValue([
          { propose: false, edit: false, choose: false, extend: false },
          { propose: true, edit: true, choose: true, extend: false },
        ]);
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('COURANT')]));
        prisma.seance.findMany.mockResolvedValue([seanceRow, { ...seanceRow, id: 'se2' }]);

        const [dto] = await service.findAllForPartie('p1', 'u1');

        expect(permissions.organizerCan).toHaveBeenCalledTimes(1);
        expect(permissions.organizerCan).toHaveBeenCalledWith('u1', [
          { seanceId: 'se1' },
          { seanceId: 'se2' },
        ]);
        expect(dto.seances.map((s) => s.can.edit)).toEqual([false, true]);
      });

      it('A_VENIR : ni description, ni durées, ni compte rendu ; titre et séances (dates) conservés', async () => {
        permissions.assert.mockResolvedValue(
          testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('A_VENIR')]));
        prisma.seance.findMany.mockResolvedValue([seanceRow]);

        const [dto] = await service.findAllForPartie('p1', 'u1');

        expect(dto).toMatchObject({
          title: 'La Tour',
          status: 'A_VENIR',
          description: null,
          dureeHeures: null,
          dureeSeances: null,
        });
        expect(dto.seances).toHaveLength(1);
        expect(dto.seances[0]).toMatchObject({
          id: 'se1',
          compteRendu: null,
          dateValidee: '2099-01-02T00:00:00.000Z',
        });
      });

      it('Story 47.2 : la séance porte la fin de sa plage, lue de la Seance ; sans fin, le début', async () => {
        permissions.assert.mockResolvedValue(
          testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('A_VENIR')]));
        prisma.seance.findMany.mockResolvedValue([
          {
            ...seanceRow,
            startSlot: 'EVENING',
            endDate: new Date('2099-01-03T00:00:00.000Z'),
            endSlot: 'AFTERNOON',
          },
          { ...seanceRow, id: 'se2', startSlot: 'MORNING', endDate: null, endSlot: null },
          { ...seanceRow, id: 'se3', startDate: null, startSlot: null, endDate: null, endSlot: null },
        ]);

        const [dto] = await service.findAllForPartie('p1', 'u1');

        expect(dto.seances[0]).toMatchObject({
          dateValidee: '2099-01-02T00:00:00.000Z',
          slotValidee: 'EVENING',
          endDate: '2099-01-03T00:00:00.000Z',
          endSlot: 'AFTERNOON',
        });
        expect(dto.seances[1]).toMatchObject({
          endDate: '2099-01-02T00:00:00.000Z',
          endSlot: 'MORNING',
        });
        expect(dto.seances[2]).toMatchObject({ endDate: null, endSlot: null });
      });

      it('ONE_SHOT BROUILLON (exemption) : listé, contenu masqué, séances conservées', async () => {
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind: 'ONE_SHOT' }, 'player'));
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('BROUILLON')]));
        prisma.seance.findMany.mockResolvedValue([seanceRow]);

        const [dto] = await service.findAllForPartie('p1', 'u1');

        expect(dto).toMatchObject({ status: 'BROUILLON', description: null, dureeHeures: null });
        expect(dto.seances[0]).toMatchObject({ id: 'se1', compteRendu: null });
      });

      it('COURANT : contenu complet pour le joueur', async () => {
        permissions.assert.mockResolvedValue(
          testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'player'),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('COURANT')]));
        prisma.seance.findMany.mockResolvedValue([seanceRow]);

        const [dto] = await service.findAllForPartie('p1', 'u1');

        expect(dto).toMatchObject({
          description: 'Le meurtrier est le notaire',
          dureeHeures: 4,
          dureeSeances: 2,
        });
        expect(dto.seances[0].compteRendu).toBe('Spoil du compte rendu');
      });

      it('A_VENIR : le MJ garde tout', async () => {
        permissions.assert.mockResolvedValue(
          testGrant({ id: 'p1', kind: 'CAMPAGNE_LINEAIRE' }, 'mj'),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([row('A_VENIR')]));
        prisma.seance.findMany.mockResolvedValue([seanceRow]);

        const [dto] = await service.findAllForPartie('p1', 'mj1');

        expect(dto.description).toBe('Le meurtrier est le notaire');
        expect(dto.seances[0].compteRendu).toBe('Spoil du compte rendu');
      });
    });

    it("Story 36.6 (AC7/AC9/AC10) — le SessionPollDto d'une séance porte l'effectif MJ + membres, compté UNE seule fois pour tout l'appel", async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(3);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            startDate: null,
            startSlot: null,
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'OPEN',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              chosenSlot: null,
              options: [],
            },
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].poll?.membersCount).toBe(4);
      // AD-3 : jamais un comptage par séance ni par sondage — un seul pour l'appel entier.
      expect(prisma.membership.count).toHaveBeenCalledTimes(1);
      expect(prisma.membership.count).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
    });

    // Story 32.3 — 🚨 le trou que ce correctif bouche : `dateValidee` ne vivait que dans le bloc
    // `inscription`, lui-même absent dès que `inscriptionMax` est nul. Une séance de campagne
    // linéaire datée par héritage n'exposait donc AUCUNE date, et son état n'était pas dérivable.
    it('Story 32.3 — dateValidee/slotValidee à la racine : date héritée sans vote ni inscription', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(1);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            startDate: new Date('2026-08-15T00:00:00.000Z'),
            startSlot: null,
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: null,
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].dateValidee).toBe('2026-08-15T00:00:00.000Z');
      // Plage sans créneau (date posée hors vote) — même convention que
      // `recalculateNextSession()`, qui pose `slot: null` dans ce cas.
      expect(result[0].seances[0].slotValidee).toBeNull();
      // Additif : le bloc `inscription` n'apparaît toujours pas sans `inscriptionMax`.
      expect(result[0].seances[0].inscription).toBeUndefined();
    });

    it('Story 32.3 — un vote SCELLÉ l’emporte, et apporte son créneau', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(1);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            // Story 37.4 : la plage est la seule source lue — un vote scellé l'a posée à sa date et
            // son créneau (cf. migration `seance_date_span`, qui fait prévaloir le vote).
            startDate: new Date('2026-09-02T00:00:00.000Z'),
            startSlot: 'EVENING',
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'CLOSED',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: new Date('2026-09-02T00:00:00.000Z'),
              chosenSlot: 'EVENING',
              options: [],
            },
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].dateValidee).toBe('2026-09-02T00:00:00.000Z');
      expect(result[0].seances[0].slotValidee).toBe('EVENING');
    });

    it('Story 32.3 — un vote OUVERT ne prête jamais son créneau à la date héritée', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(1);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            startDate: new Date('2026-08-15T00:00:00.000Z'),
            startSlot: null,
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'OPEN',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              // Créneau résiduel : rien ne le rattache à la date héritée tant que rien n'est scellé.
              chosenSlot: 'MORNING',
              options: [],
            },
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].dateValidee).toBe('2026-08-15T00:00:00.000Z');
      expect(result[0].seances[0].slotValidee).toBeNull();
    });

    // 🚨 Le test qui prouve que la condition est bien `chosenDate` et NON `status === 'CLOSED'` :
    // un vote clos sans date retenue ne scelle rien, la date héritée reste la date effective.
    it('Story 32.3 — vote CLOS SANS date retenue : la date héritée gagne, sans créneau', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(1);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            startDate: new Date('2026-08-15T00:00:00.000Z'),
            startSlot: null,
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'CLOSED',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              chosenSlot: 'MORNING',
              options: [],
            },
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].dateValidee).toBe('2026-08-15T00:00:00.000Z');
      expect(result[0].seances[0].slotValidee).toBeNull();
    });

    it('deferred-work (2026-08-24) : toSessionPollDto() porte displayName sur chaque vote — défaut pré-existant, PollVoteDto.displayName est requis mais poll était typé any (invisible au compilateur)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1' }, 'player'));
      prisma.membership.count.mockResolvedValue(1);
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Les Cendres',
            description: null,
            status: 'EN_COURS',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
        ]),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'se1',
            scenarioId: 's1',
            createdAt: new Date('2026-07-01'),
            startDate: null,
            startSlot: null,
            inscriptionMin: null,
            inscriptionMax: null,
            inscriptions: [],
            heureRdv: null,
            lieu: null,
            notePratique: null,
            poll: {
              id: 'poll1',
              partieId: 'p1',
              status: 'OPEN',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              chosenSlot: null,
              options: [
                {
                  id: 'opt1',
                  date: new Date('2026-08-01'),
                  slot: 'EVENING',
                  votes: [
                    {
                      userId: 'u1',
                      answer: 'YES',
                      user: { pseudo: 'Alice', displayName: 'Alice au pays' },
                    },
                  ],
                },
              ],
            },
          },
        ]),
      );

      const result = await service.findAllForPartie('p1', 'u1');

      expect(result[0].seances[0].poll?.options[0].votes[0]).toEqual({
        userId: 'u1',
        pseudo: 'Alice',
        displayName: 'Alice au pays',
        answer: 'YES',
      });
    });

    it('non-membre → 403 propagé par permissions.assert, aucune lecture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.findAllForPartie('p1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.scenario.findMany).not.toHaveBeenCalled();
    });

    it('CAMPAGNE_EPISODIQUE : chaque ScenarioDto porte ses participants exacts (AC7)', async () => {
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.scenario.findMany.mockResolvedValue(
        withEvent([
          {
            id: 's1',
            partieId: 'p1',
            title: 'Enquête 1',
            description: null,
            status: 'COURANT',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-01'),
            closedAt: null,
          },
          {
            id: 's2',
            partieId: 'p1',
            title: 'Enquête 2',
            description: null,
            status: 'COURANT',
            dureeHeures: null,
            dureeSeances: null,
            resumeFin: null,
            createdAt: new Date('2026-07-02'),
            closedAt: null,
          },
        ]),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: 's1',
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
        {
          scenarioId: 's1',
          userId: 'u2',
          user: { pseudo: 'Bob', displayName: 'Bobby' },
        },
      ]);

      const result = await service.findAllForPartie('p1', 'u1');

      expect(prisma.scenarioParticipant.findMany).toHaveBeenCalledWith({
        where: { scenarioId: { in: ['s1', 's2'] } },
        include: { user: { select: { pseudo: true, displayName: true } } },
      });
      expect(result.find((s) => s.id === 's1')?.participants).toEqual([
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
        { userId: 'u2', pseudo: 'Bob', displayName: 'Bobby' },
      ]);
      expect(result.find((s) => s.id === 's2')?.participants).toEqual([]);
    });

    it.each(['CAMPAGNE_LINEAIRE', 'ONE_SHOT'])(
      '%s : participants toujours undefined, scenarioParticipant.findMany jamais appelé (AC1/AD-4)',
      async (kind) => {
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind }, 'player'));
        prisma.scenario.findMany.mockResolvedValue(
          withEvent([
            {
              id: 's1',
              partieId: 'p1',
              title: 'Chapitre 1',
              description: null,
              status: 'COURANT',
              dureeHeures: null,
              dureeSeances: null,
              resumeFin: null,
              createdAt: new Date('2026-07-01'),
              closedAt: null,
            },
          ]),
        );

        const result = await service.findAllForPartie('p1', 'u1');

        expect(result[0].participants).toBeUndefined();
        expect(prisma.scenarioParticipant.findMany).not.toHaveBeenCalled();
      },
    );

    describe('retrospectiveNotes (AC5, AC7, Story 8.6)', () => {
      function makeScenario(overrides: Record<string, unknown> = {}) {
        return {
          id: 's1',
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01'),
          closedAt: null,
          ...overrides,
        };
      }

      it('status !== PASSE → retrospectiveNotes undefined, CharacterService jamais appelé (AC7)', async () => {
        permissions.assert.mockResolvedValue(
          testGrant(
            {
              id: 'p1',
              kind: 'CAMPAGNE_LINEAIRE',
            },
            'player',
          ),
        );
        prisma.scenario.findMany.mockResolvedValue(
          withEvent([makeScenario({ status: 'COURANT' })]),
        );

        const result = await service.findAllForPartie('p1', 'u1');

        expect(result[0].retrospectiveNotes).toBeUndefined();
        expect(characters.findAllByPartie).not.toHaveBeenCalled();
        expect(characters.getRetrospectiveNotes).not.toHaveBeenCalled();
      });

      it('PASSE, CAMPAGNE_LINEAIRE → agrège les notes de TOUS les membres de la Partie', async () => {
        permissions.assert.mockResolvedValue(
          testGrant(
            {
              id: 'p1',
              kind: 'CAMPAGNE_LINEAIRE',
            },
            'player',
          ),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([makeScenario({ status: 'PASSE' })]));
        characters.findAllByPartie.mockResolvedValue([
          { id: 'char1', userId: 'u1' },
          { id: 'char2', userId: 'u2' },
        ]);
        characters.getRetrospectiveNotes
          .mockResolvedValueOnce([
            {
              id: 'n1',
              characterId: 'char1',
              text: 'A',
              shared: true,
              scenarioId: null,
              createdAt: '2026-07-01T00:00:00.000Z',
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'n2',
              characterId: 'char2',
              text: 'B',
              shared: false,
              scenarioId: 's1',
              createdAt: '2026-07-02T00:00:00.000Z',
            },
          ]);

        const result = await service.findAllForPartie('p1', 'u1');

        expect(characters.findAllByPartie).toHaveBeenCalledWith('p1');
        expect(characters.getRetrospectiveNotes).toHaveBeenCalledWith('char1', 's1', null, null);
        expect(characters.getRetrospectiveNotes).toHaveBeenCalledWith('char2', 's1', null, null);
        expect(result[0].retrospectiveNotes).toEqual([
          objectLike({ id: 'n1' }),
          objectLike({ id: 'n2' }),
        ]);
      });

      it('PASSE, CAMPAGNE_EPISODIQUE → agrège seulement les personnages des participants du scénario', async () => {
        permissions.assert.mockResolvedValue(
          testGrant(
            {
              id: 'p1',
              kind: 'CAMPAGNE_EPISODIQUE',
            },
            'player',
          ),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([makeScenario({ status: 'PASSE' })]));
        prisma.scenarioParticipant.findMany.mockResolvedValue([
          {
            scenarioId: 's1',
            userId: 'u1',
            user: { pseudo: 'Alice', displayName: 'Alice au pays' },
          },
        ]);
        characters.findAllByPartie.mockResolvedValue([
          { id: 'char1', userId: 'u1' },
          { id: 'char2', userId: 'u2' },
        ]);
        characters.getRetrospectiveNotes.mockResolvedValue([]);

        await service.findAllForPartie('p1', 'u1');

        expect(characters.getRetrospectiveNotes).toHaveBeenCalledTimes(1);
        expect(characters.getRetrospectiveNotes).toHaveBeenCalledWith('char1', 's1', null, null);
      });

      it('fenêtre calculée à partir de poll.chosenDate/inscription.dateValidee mixtes (min/max)', async () => {
        permissions.assert.mockResolvedValue(
          testGrant(
            {
              id: 'p1',
              kind: 'CAMPAGNE_LINEAIRE',
            },
            'player',
          ),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([makeScenario({ status: 'PASSE' })]));
        prisma.seance.findMany.mockResolvedValue(
          asSeance([
            {
              id: 'seance1',
              scenarioId: 's1',
              poll: {
                id: 'poll1',
                partieId: 'p1',
                status: 'CLOSED',
                scenarioRef: null,
                expiresAt: null,
                chosenDate: new Date('2026-06-10T00:00:00.000Z'),
                chosenSlot: 'MORNING',
                options: [],
              },
              inscriptions: [],
              compteRendu: null,
              createdAt: new Date('2026-06-01'),
            },
            {
              id: 'seance2',
              scenarioId: 's1',
              poll: null,
              inscriptionMin: 2,
              inscriptionMax: 5,
              startDate: new Date('2026-06-20T00:00:00.000Z'),
              startSlot: null,
              inscriptions: [],
              compteRendu: null,
              createdAt: new Date('2026-06-05'),
            },
          ]),
        );
        characters.findAllByPartie.mockResolvedValue([{ id: 'char1', userId: 'u1' }]);
        characters.getRetrospectiveNotes.mockResolvedValue([]);

        await service.findAllForPartie('p1', 'u1');

        expect(characters.getRetrospectiveNotes).toHaveBeenCalledWith(
          'char1',
          's1',
          new Date('2026-06-10T00:00:00.000Z'),
          new Date('2026-06-20T00:00:00.000Z'),
        );
      });

      it('aucune séance datée → fenêtre null/null, seule la branche manuelle s’applique côté CharacterService', async () => {
        permissions.assert.mockResolvedValue(
          testGrant(
            {
              id: 'p1',
              kind: 'CAMPAGNE_LINEAIRE',
            },
            'player',
          ),
        );
        prisma.scenario.findMany.mockResolvedValue(withEvent([makeScenario({ status: 'PASSE' })]));
        prisma.seance.findMany.mockResolvedValue(
          asSeance([
            {
              id: 'seance1',
              scenarioId: 's1',
              poll: null,
              inscriptions: [],
              compteRendu: null,
              createdAt: new Date('2026-06-01'),
            },
          ]),
        );
        characters.findAllByPartie.mockResolvedValue([{ id: 'char1', userId: 'u1' }]);
        characters.getRetrospectiveNotes.mockResolvedValue([]);

        await service.findAllForPartie('p1', 'u1');

        expect(characters.getRetrospectiveNotes).toHaveBeenCalledWith('char1', 's1', null, null);
      });
    });
  });

  describe('participate()', () => {
    it('CAMPAGNE_EPISODIQUE : upsert créé, participants renvoyés (AC2)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.scenarioParticipant.upsert.mockResolvedValue({});
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Enquête',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: VALID_SCENARIO_ID,
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
      ]);

      const result = await service.participate(VALID_SCENARIO_ID, 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SCENARIO_PARTICIPATE', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.scenarioParticipant.upsert).toHaveBeenCalledWith({
        where: {
          scenarioId_userId: { scenarioId: VALID_SCENARIO_ID, userId: 'u1' },
        },
        create: { scenarioId: VALID_SCENARIO_ID, userId: 'u1' },
        update: {},
      });
      expect(result.participants).toEqual([
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
      ]);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.scenarioParticipant.upsert.mockResolvedValue({});
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Enquête',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01'),
          closedAt: null,
        }),
      );

      await service.participate(VALID_SCENARIO_ID, 'u1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('second appel du même joueur → upsert toujours appelé, aucune exception (idempotence, AC2)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.scenarioParticipant.upsert.mockResolvedValue({});
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Enquête',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: VALID_SCENARIO_ID,
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
      ]);

      await service.participate(VALID_SCENARIO_ID, 'u1');
      await expect(service.participate(VALID_SCENARIO_ID, 'u1')).resolves.toBeDefined();
      expect(prisma.scenarioParticipant.upsert).toHaveBeenCalledTimes(2);
    });

    it.each(['ONE_SHOT', 'CAMPAGNE_LINEAIRE'])(
      '%s → rejet 400, scenarioParticipant.upsert jamais appelé (AC6)',
      async (kind) => {
        prisma.scenario.findUnique.mockResolvedValue(
          withEvent({
            id: VALID_SCENARIO_ID,
            partieId: 'p1',
            status: 'COURANT',
          }),
        );
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind }, 'player'));

        await expect(service.participate(VALID_SCENARIO_ID, 'u1')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.scenarioParticipant.upsert).not.toHaveBeenCalled();
      },
    );

    it('anti-spoil serveur — un joueur sur un brouillon caché reçoit 404, aucune écriture', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({ id: VALID_SCENARIO_ID, partieId: 'p1', status: 'BROUILLON' }),
      );
      for (const kind of ['CAMPAGNE_EPISODIQUE', 'CAMPAGNE_LINEAIRE']) {
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', kind }, 'player'));
        const promise = service.participate(VALID_SCENARIO_ID, 'u1');
        await expect(promise).rejects.toThrow(NotFoundException);
        await expect(promise).rejects.toThrow('Scénario introuvable');
      }
      expect(prisma.scenarioParticipant.upsert).not.toHaveBeenCalled();
    });

    it('anti-spoil serveur — un joueur ne rejoint pas un scénario PASSE (400), aucune écriture', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({ id: VALID_SCENARIO_ID, partieId: 'p1', status: 'PASSE' }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', kind: 'CAMPAGNE_EPISODIQUE' }, 'player'),
      );

      await expect(service.participate(VALID_SCENARIO_ID, 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.scenarioParticipant.upsert).not.toHaveBeenCalled();
    });

    it('non-membre → 403 propagé par permissions.assert, aucune écriture (AC5)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.participate(VALID_SCENARIO_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenarioParticipant.upsert).not.toHaveBeenCalled();
    });

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.participate(VALID_SCENARIO_ID, 'u1')).rejects.toThrow(NotFoundException);
      expect(prisma.scenarioParticipant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('open()', () => {
    it('anti-spoil serveur — recalcule nextSessionDate/Slot de la partie (les séances du scénario deviennent éligibles)', async () => {
      const future = new Date(Date.UTC(2099, 0, 2));
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({ id: VALID_SCENARIO_ID, partieId: 'p1', status: 'BROUILLON' }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Le Marché aux Ombres',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce([{ startDate: future, startSlot: 'EVENING' }]);

      await service.open(VALID_SCENARIO_ID, 'mj1');

      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { nextSessionDate: future, nextSessionSlot: 'EVENING', nextSessionEndDate: future, nextSessionEndSlot: 'EVENING' },
      });
      // Statut et recalcul dans UNE transaction, la partie verrouillée AVANT la lecture des
      // séances (FOR UPDATE), puis l'écriture de la prochaine séance.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const order = (m: jest.Mock) => m.mock.invocationCallOrder[0];
      expect(order(prisma.tx.$queryRaw)).toBeGreaterThan(order(prisma.scenario.update));
      expect(order(prisma.seance.findMany)).toBeGreaterThan(order(prisma.tx.$queryRaw));
      expect(order(prisma.partie.update)).toBeGreaterThan(order(prisma.seance.findMany));
    });

    it('transition BROUILLON → A_VENIR réussie (AC3)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Le Marché aux Ombres',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      const result = await service.open(VALID_SCENARIO_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_STATUS_CHANGE', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.scenario.update).toHaveBeenCalledWith(
        objectLike({
          where: { id: VALID_SCENARIO_ID },
          data: { status: 'A_VENIR' },
        }),
      );
      expect(result.status).toBe('A_VENIR');
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Le Marché aux Ombres',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.open(VALID_SCENARIO_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (deferred-work, SSE calendrier personnel)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Le Marché aux Ombres',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.open(VALID_SCENARIO_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('CAMPAGNE_EPISODIQUE : participants restent peuplés dans le DTO retourné après open() (non-régression)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.update.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Enquête',
          description: null,
          status: 'A_VENIR',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: VALID_SCENARIO_ID,
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
      ]);

      const result = await service.open(VALID_SCENARIO_ID, 'mj1');

      expect(result.participants).toEqual([
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
      ]);
    });

    it.each(['A_VENIR', 'COURANT', 'PASSE'])(
      'scénario déjà %s → rejet, aucune écriture (AC4)',
      async (status) => {
        prisma.scenario.findUnique.mockResolvedValue(
          withEvent({
            id: VALID_SCENARIO_ID,
            partieId: 'p1',
            status,
          }),
        );
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

        await expect(service.open(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(BadRequestException);
        expect(prisma.scenario.update).not.toHaveBeenCalled();
      },
    );

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.open(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.open(VALID_SCENARIO_ID, 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });
  });

  describe('markCourant()', () => {
    it('CAMPAGNE_LINEAIRE, aucun autre COURANT → transition réussie sous verrou (AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValue(null);
      prisma.tx.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.tx.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 2',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      const result = await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_STATUS_CHANGE', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.scenario.findFirst).toHaveBeenCalledWith({
        where: { event: { partieId: 'p1' }, status: 'COURANT' },
      });
      expect(prisma.tx.scenario.updateMany).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID, status: 'A_VENIR' },
        data: { status: 'COURANT' },
      });
      expect(result.status).toBe('COURANT');
    });

    it('CAMPAGNE_LINEAIRE : émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValue(null);
      prisma.tx.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.tx.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 2',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('CAMPAGNE_LINEAIRE : notifie aussi PartiesService.notifyPartieSignalsChanged (Story 29.7, AD-14, signal AUCUN_SCENARIO_EN_COURS)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValue(null);
      prisma.tx.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.tx.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 2',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('CAMPAGNE_LINEAIRE, statut changé sous le nez du verrou (count 0) → 409, aucune écriture (AC1, TOCTOU)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValue(null);
      prisma.tx.scenario.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markCourant(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tx.scenario.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('CAMPAGNE_LINEAIRE, un scénario déjà COURANT → 409, aucune écriture (AC2)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValue(
        withEvent({
          id: 'autre-scenario',
          partieId: 'p1',
          status: 'COURANT',
        }),
      );

      await expect(service.markCourant(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tx.scenario.updateMany).not.toHaveBeenCalled();
    });

    it('CAMPAGNE_EPISODIQUE, un COURANT existant → transition réussie sans verrou (AC3)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Digression',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([]);

      const result = await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.scenario.updateMany).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID, status: 'A_VENIR' },
        data: { status: 'COURANT' },
      });
      expect(result.status).toBe('COURANT');
    });

    it('CAMPAGNE_EPISODIQUE (branche non-transactionnelle) : émet un événement temps réel (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Digression',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([]);

      await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('statut changé sous le nez de l’écriture directe (count 0, hors CAMPAGNE_LINEAIRE) → 409 (AC1, TOCTOU)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markCourant(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.scenario.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('ONE_SHOT → transition réussie sans verrou (AC6)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'ONE_SHOT',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'One-shot',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-12T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      const result = await service.markCourant(VALID_SCENARIO_ID, 'mj1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('COURANT');
    });

    it.each(['BROUILLON', 'COURANT', 'PASSE'])(
      'statut source %s (≠ A_VENIR) → rejet, aucune écriture (AC4)',
      async (status) => {
        prisma.scenario.findUnique.mockResolvedValue(
          withEvent({
            id: VALID_SCENARIO_ID,
            partieId: 'p1',
            status,
          }),
        );
        permissions.assert.mockResolvedValue(
          testGrant({
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_LINEAIRE',
          }),
        );

        await expect(service.markCourant(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
      },
    );

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.markCourant(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune lecture/écriture (AC5)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.markCourant(VALID_SCENARIO_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('COURANT → transition réussie vers PASSE, closedAt renseigné (AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      const closedAt = new Date('2026-07-13T10:00:00.000Z');
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'PASSE',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt,
        }),
      );

      const result = await service.close(VALID_SCENARIO_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_STATUS_CHANGE', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.scenario.updateMany).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID, status: 'COURANT' },
        data: { status: 'PASSE', closedAt: anyOf(Date) },
      });
      expect(result.status).toBe('PASSE');
      expect(result.closedAt).toEqual(closedAt.toISOString());
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'PASSE',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: new Date('2026-07-13T10:00:00.000Z'),
        }),
      );

      await service.close(VALID_SCENARIO_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (Story 29.7, AD-14, signal AUCUN_SCENARIO_EN_COURS)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'PASSE',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: new Date('2026-07-13T10:00:00.000Z'),
        }),
      );

      await service.close(VALID_SCENARIO_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('CAMPAGNE_EPISODIQUE : participants restent peuplés dans le DTO retourné après close() (non-régression)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Enquête',
          description: null,
          status: 'PASSE',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: new Date('2026-07-13T10:00:00.000Z'),
        }),
      );
      prisma.scenarioParticipant.findMany.mockResolvedValue([
        {
          scenarioId: VALID_SCENARIO_ID,
          userId: 'u1',
          user: { pseudo: 'Alice', displayName: 'Alice au pays' },
        },
      ]);

      const result = await service.close(VALID_SCENARIO_ID, 'mj1');

      expect(result.participants).toEqual([
        { userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' },
      ]);
    });

    it.each(['BROUILLON', 'A_VENIR', 'PASSE'])(
      'statut source %s (≠ COURANT) → rejet, aucune écriture (AC2)',
      async (status) => {
        prisma.scenario.findUnique.mockResolvedValue(
          withEvent({
            id: VALID_SCENARIO_ID,
            partieId: 'p1',
            status,
          }),
        );
        permissions.assert.mockResolvedValue(
          testGrant({
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_LINEAIRE',
          }),
        );

        await expect(service.close(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(BadRequestException);
        expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
      },
    );

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.close(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune lecture/écriture (AC3)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.close(VALID_SCENARIO_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenario.updateMany).not.toHaveBeenCalled();
    });

    it('count 0 (course concurrente) → 409, aucune reconstruction du DTO', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(ConflictException);
      expect(prisma.scenario.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('AC5 : après close() sur CAMPAGNE_LINEAIRE, markCourant() sur un autre A_VENIR de la même Partie réussit sans 409', async () => {
      // close() du scénario COURANT
      prisma.scenario.findUnique.mockResolvedValueOnce(
        withEvent({
          id: 'courant-1',
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValueOnce(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.scenario.findUniqueOrThrow.mockResolvedValueOnce(
        withEvent({
          id: 'courant-1',
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'PASSE',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: new Date('2026-07-13T10:00:00.000Z'),
        }),
      );

      await service.close('courant-1', 'mj1');

      // markCourant() sur un second scénario A_VENIR — plus aucun COURANT après la clôture ci-dessus
      prisma.scenario.findUnique.mockResolvedValueOnce(
        withEvent({
          id: 'a-venir-2',
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );
      permissions.assert.mockResolvedValueOnce(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.tx.scenario.findFirst.mockResolvedValueOnce(null);
      prisma.tx.scenario.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.tx.scenario.findUniqueOrThrow.mockResolvedValueOnce(
        withEvent({
          id: 'a-venir-2',
          partieId: 'p1',
          title: 'Chapitre 2',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      const promoted = await service.markCourant('a-venir-2', 'mj1');

      expect(promoted.status).toBe('COURANT');
      expect(prisma.tx.scenario.findFirst).toHaveBeenCalledWith({
        where: { event: { partieId: 'p1' }, status: 'COURANT' },
      });
    });
  });

  describe('addSeance()', () => {
    it('scénario PASSE → rejet 400, aucune création de séance (Story 17.2 AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'PASSE',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await expect(service.addSeance(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });

    it('crée une Seance rattachée au scénario, seances peuplées dans le DTO retourné (AC1, AC7)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: 3,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 'seance-1',
            scenarioId: VALID_SCENARIO_ID,
            poll: null,
            compteRendu: null,
            createdAt: new Date('2026-07-13T00:00:00.000Z'),
          },
        ]),
      );

      const result = await service.addSeance(VALID_SCENARIO_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_ADD', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.seance.create).toHaveBeenCalledWith({
        data: { eventId: VALID_SCENARIO_ID, durationSlots: 1 },
      });
      expect(result.seances).toEqual([
        {
          id: 'seance-1',
          scenarioId: VALID_SCENARIO_ID,
          poll: undefined,
          inscription: undefined,
          // Story 32.3 : la date effective (et son créneau) remontent à la RACINE du DTO, pour
          // qu'une séance datée sans vote ni inscription expose enfin une date exploitable.
          dateValidee: null,
          slotValidee: null,
          endDate: null,
          endSlot: null,
          compteRendu: null,
          // Story 36.5 : les trois champs d'informations pratiques figurent désormais dans
          // SeanceDto. Une séance qui n'en porte aucun les expose à null — jamais absents,
          // pour que le client n'ait pas à distinguer « absent » de « vide ».
          heureRdv: null,
          lieu: null,
          notePratique: null,
          createdAt: '2026-07-13T00:00:00.000Z',
          // Story 44.1 : les droits d'organisateur de la personne qui lit, servis par `PermissionService`.
          can: SEANCE_CAN,
        },
      ]);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: 3,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.addSeance(VALID_SCENARIO_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (deferred-work, SSE calendrier personnel)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: 3,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: null,
        }),
      );

      await service.addSeance(VALID_SCENARIO_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('aucun plafond — une 3e séance se crée sans erreur', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          title: 'Chapitre 1',
          description: null,
          status: 'COURANT',
          dureeHeures: null,
          dureeSeances: null,
          resumeFin: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          closedAt: null,
        }),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: 's1',
            scenarioId: VALID_SCENARIO_ID,
            poll: null,
            compteRendu: null,
            createdAt: new Date(),
          },
          {
            id: 's2',
            scenarioId: VALID_SCENARIO_ID,
            poll: null,
            compteRendu: null,
            createdAt: new Date(),
          },
          {
            id: 's3',
            scenarioId: VALID_SCENARIO_ID,
            poll: null,
            compteRendu: null,
            createdAt: new Date(),
          },
        ]),
      );

      const result = await service.addSeance(VALID_SCENARIO_ID, 'mj1');

      expect(result.seances).toHaveLength(3);
    });

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.addSeance(VALID_SCENARIO_ID, 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.addSeance(VALID_SCENARIO_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteSeance()', () => {
    const FIRST_SEANCE_ID = '55555555-5555-4555-a555-555555555555';
    const SECOND_SEANCE_ID = '66666666-6666-4666-a666-666666666666';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'Chapitre 1',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('séance non-première → suppression réussie (AC5)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_DELETE', {
        seanceId: SECOND_SEANCE_ID,
      });
      expect(prisma.seance.delete).toHaveBeenCalledWith({
        where: { id: SECOND_SEANCE_ID },
      });
    });

    it('émet un événement temps réel scopé sur la Partie, via recalculateNextSession (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (deferred-work, SSE calendrier personnel)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('référence scénario orpheline → 404 explicite, pas de 500 (Story 17.2 AC2)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('erreur Prisma autre que P2025 → propagée telle quelle, pas absorbée en 404 (revue de code, Story 17.2)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      const otherError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
      prisma.scenario.findUniqueOrThrow.mockRejectedValue(otherError);

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toBe(otherError);
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('TOCTOU : seance.delete() lève P2025 (déjà supprimée concurremment) → 404 propre, pas un 500 (deferred-work 2026-08-25)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );
      prisma.seance.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.sessionPoll.delete).not.toHaveBeenCalled();
    });

    it('TOCTOU : erreur Prisma autre que P2025 sur seance.delete() → propagée telle quelle', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );
      const otherError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
      prisma.seance.delete.mockRejectedValue(otherError);

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toBe(otherError);
    });

    it('séance liée à un vote (OPEN ou CLOSED) → le SessionPoll est supprimé avec elle (revue de code : plus d’orphelin)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll-orphan',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(prisma.seance.delete).toHaveBeenCalledWith({
        where: { id: SECOND_SEANCE_ID },
      });
      expect(prisma.sessionPoll.delete).toHaveBeenCalledWith({
        where: { id: 'poll-orphan' },
      });
    });

    it('séance sans vote lié → aucun appel à sessionPoll.delete', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(prisma.sessionPoll.delete).not.toHaveBeenCalled();
    });

    it('première séance du scénario → rejet 400, aucune suppression', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: FIRST_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await expect(service.deleteSeance(FIRST_SEANCE_ID, 'mj1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune suppression', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('scénario PASSE (clôturé) → rejet 400, aucune suppression (revue de code)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await expect(service.deleteSeance(SECOND_SEANCE_ID, 'mj1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.delete).not.toHaveBeenCalled();
    });

    it('détection de la première séance : tie-breaker `id` sur `createdAt` égal (revue de code)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SECOND_SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValueOnce(
        asSeance([
          {
            id: FIRST_SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      );

      await service.deleteSeance(SECOND_SEANCE_ID, 'mj1');

      expect(prisma.seance.findMany).toHaveBeenCalledWith({
        where: { eventId: VALID_SCENARIO_ID },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1,
      });
    });
  });

  describe('createSeancePoll()', () => {
    const SEANCE_ID = '33333333-3333-4333-a333-333333333333';
    const POLL_ID = '44444444-4444-4444-a444-444444444444';
    const OPTIONS = [
      { date: '2026-08-01T00:00:00.000Z', slot: 'AFTERNOON' as const },
      { date: '2026-08-02T00:00:00.000Z', slot: 'AFTERNOON' as const },
    ];

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'Chapitre 1',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('ONE_SHOT/CAMPAGNE_LINEAIRE : création + liaison réussie dans le même appel (AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow
        .mockResolvedValueOnce(withEvent(mockScenario()))
        .mockResolvedValueOnce(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      pollCreates(pollService, POLL_ID);
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            poll: {
              id: POLL_ID,
              partieId: 'p1',
              status: 'OPEN',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              chosenSlot: null,
              options: [],
            },
            compteRendu: null,
            createdAt: new Date('2026-07-13T00:00:00.000Z'),
          },
        ]),
      );

      const result = await service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_POLL_CREATE', {
        seanceId: SEANCE_ID,
      });
      // Story 37.6 : le vote reçoit l'autorisation de la séance (partie `p1`), plus un `partieId` nu.
      expect(pollService.create).toHaveBeenCalledWith(
        objectLike({ partieId: 'p1' }),
        'mj1',
        { options: OPTIONS },
        expect.any(Function),
      );
      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { pollId: POLL_ID },
      });
      expect(result.seances[0].poll?.id).toBe(POLL_ID);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow
        .mockResolvedValueOnce(withEvent(mockScenario()))
        .mockResolvedValueOnce(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      pollCreates(pollService, POLL_ID);

      await service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('Story 47.4 — la durée est écrite avec le vote, dans la même transaction, avant Seance.pollId', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          eventId: VALID_SCENARIO_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
          durationSlots: 1,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow
        .mockResolvedValueOnce(withEvent(mockScenario()))
        .mockResolvedValueOnce(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', ownerId: 'mj1', kind: 'CAMPAGNE_LINEAIRE' }),
      );
      pollCreates(pollService, POLL_ID);
      prisma.seance.findMany.mockResolvedValue([]);

      await service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS, undefined, 6);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.seance.update).toHaveBeenNthCalledWith(1, {
        where: { id: SEANCE_ID },
        data: { durationSlots: 6, endDate: null, endSlot: null },
      });
      expect(prisma.seance.update).toHaveBeenNthCalledWith(2, {
        where: { id: SEANCE_ID },
        data: { pollId: POLL_ID },
      });
    });

    it('CAMPAGNE_EPISODIQUE : création + liaison réussie, coexiste avec inscription (Story 8.8, Décision 1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow
        .mockResolvedValueOnce(withEvent(mockScenario()))
        .mockResolvedValueOnce(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      pollCreates(pollService, POLL_ID);
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            inscriptionMin: 4,
            inscriptionMax: 6,
            poll: {
              id: POLL_ID,
              partieId: 'p1',
              status: 'OPEN',
              scenarioRef: null,
              expiresAt: null,
              chosenDate: null,
              chosenSlot: null,
              options: [],
            },
            inscriptions: [{ userId: 'u2', user: { pseudo: 'Bob' } }],
            compteRendu: null,
            createdAt: new Date('2026-07-13T00:00:00.000Z'),
          },
        ]),
      );

      const result = await service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_POLL_CREATE', {
        seanceId: SEANCE_ID,
      });
      // Story 37.6 : le vote reçoit l'autorisation de la séance (partie `p1`), plus un `partieId` nu.
      expect(pollService.create).toHaveBeenCalledWith(
        objectLike({ partieId: 'p1' }),
        'mj1',
        { options: OPTIONS },
        expect.any(Function),
      );
      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { pollId: POLL_ID },
      });
      // Coexistence poll + inscription sur le même SeanceDto (Décision 1, AD-4 révisé).
      expect(result.seances[0].poll?.id).toBe(POLL_ID);
      expect(result.seances[0].inscription?.max).toBe(6);
    });

    it('séance déjà liée à un poll → rejet 400, aucun poll créé, aucune écriture (pas d’écrasement silencieux)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'ancien-poll',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      pollCreates(pollService, POLL_ID);

      await expect(service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS)).rejects.toThrow(
        BadRequestException,
      );
      // Story 47.4 : `PollService` prépare le vote, mais `EventsService` refuse avant d'ouvrir la transaction —
      // le vote n'est jamais écrit.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('scénario PASSE (clôturé) → rejet 400, aucun poll créé, aucune écriture (revue de code, 2026-07-14)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await expect(service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS)).rejects.toThrow(
        BadRequestException,
      );
      expect(pollService.create).not.toHaveBeenCalled();
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.createSeancePoll(SEANCE_ID, 'mj1', OPTIONS)).rejects.toThrow(
        NotFoundException,
      );
      expect(pollService.create).not.toHaveBeenCalled();
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucun poll créé, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.createSeancePoll(SEANCE_ID, 'stranger', OPTIONS)).rejects.toThrow(
        ForbiddenException,
      );
      expect(pollService.create).not.toHaveBeenCalled();
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });
  });

  describe('resetSeanceDate() (Story 8.8, AC4)', () => {
    const SEANCE_ID = '33333333-3333-4333-a333-333333333333';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'Chapitre 1',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('détache le poll et efface la plage de date, déclenche le recalcul de nextSessionDate', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue([]);

      await service.resetSeanceDate(SEANCE_ID, 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_DATE_RESET', {
        seanceId: SEANCE_ID,
      });
      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: {
          pollId: null,
          startDate: null,
          startSlot: null,
          endDate: null,
          endSlot: null,
          reminderSentAt: null,
        },
      });
      // Recalcul déclenché : Partie relue/réécrite via recalculateNextSession().
      expect(prisma.partie.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: objectLike({
          nextSessionDate: null,
          nextSessionSlot: null,
          nextSessionEndDate: null,
          nextSessionEndSlot: null,
        }),
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue([]);

      await service.resetSeanceDate(SEANCE_ID, 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (deferred-work, SSE calendrier personnel)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue([]);

      await service.resetSeanceDate(SEANCE_ID, 'mj1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('le SessionPoll lié est supprimé (revue de code : sans séance, le vote perd son sens — plus d’orphelin)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue([]);

      await service.resetSeanceDate(SEANCE_ID, 'mj1');

      expect(prisma.sessionPoll.delete).toHaveBeenCalledWith({
        where: { id: 'poll1' },
      });
    });

    it('séance sans poll lié (plage posée hors vote) → aucun appel à sessionPoll.delete', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: null,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue([]);

      await service.resetSeanceDate(SEANCE_ID, 'mj1');

      expect(prisma.sessionPoll.delete).not.toHaveBeenCalled();
    });

    it('scénario PASSE (clôturé) → rejet 400, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await expect(service.resetSeanceDate(SEANCE_ID, 'mj1')).rejects.toThrow(BadRequestException);
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.resetSeanceDate(SEANCE_ID, 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          pollId: 'poll1',
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.resetSeanceDate(SEANCE_ID, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });
  });

  describe('setSeanceCapacity()', () => {
    const SEANCE_ID = '55555555-5555-4555-a555-555555555555';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'La Dette du Forgeron',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('scénario PASSE → rejet 400, aucune écriture (Story 17.2 AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );

      await expect(service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('CAMPAGNE_EPISODIQUE : capacité enregistrée, reflétée dans le DTO retourné (AC1, AC9)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );
      prisma.seance.findMany.mockResolvedValue(
        asSeance([
          {
            id: SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
            poll: null,
            inscriptionMin: 4,
            inscriptionMax: 6,
            startDate: null,
            startSlot: null,
            inscriptions: [],
            compteRendu: null,
            createdAt: new Date('2026-07-13T00:00:00.000Z'),
          },
        ]),
      );

      const result = await service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_CAPACITY_SET', {
        seanceId: SEANCE_ID,
      });
      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { inscriptionMin: 4, inscriptionMax: 6 },
      });
      expect(result.seances[0].inscription).toEqual({
        min: 4,
        max: 6,
        inscrits: [],
        dateValidee: null,
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );

      await service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (deferred-work, SSE calendrier personnel)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );

      await service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6);

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('non-épisodique (CAMPAGNE_LINEAIRE) → rejet 400, aucune écriture (AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await expect(service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('max < min → rejet 400, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_EPISODIQUE',
        }),
      );

      await expect(service.setSeanceCapacity(SEANCE_ID, 'mj1', 6, 4)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.setSeanceCapacity(SEANCE_ID, 'mj1', 4, 6)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setSeanceCapacity(SEANCE_ID, 'stranger', 4, 6)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });
  });

  describe('inscrire()', () => {
    const SEANCE_ID = '66666666-6666-4666-a666-666666666666';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'La Dette du Forgeron',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('référence scénario orpheline → 404 explicite, pas de 500 (Story 17.2 AC2)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'An operation failed because it depends on one or more records that were required but not found.',
          { code: 'P2025', clientVersion: '7.8.0' },
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(NotFoundException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('scénario BROUILLON → rejet 400 pour le MJ, aucune inscription créée (Story 17.2 AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'BROUILLON' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'mj',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'mj1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('anti-spoil serveur — scénario BROUILLON caché : un joueur reçoit 404 « Séance introuvable » (avant le 400), aucune inscription', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'BROUILLON' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', ownerId: 'mj1', kind: 'CAMPAGNE_EPISODIQUE' }, 'player'),
      );

      const promise = service.inscrire(SEANCE_ID, 'u1');
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Séance introuvable');
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('scénario PASSE → rejet 400, aucune inscription créée (Story 17.2 AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('nouvel inscrit, count < max → Inscription créée sous verrou (AC2, AC5)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue(null);
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          inscriptionMax: 6,
        }),
      );
      prisma.tx.inscription.count.mockResolvedValue(2);
      prisma.seance.findMany.mockResolvedValue([]);

      await service.inscrire(SEANCE_ID, 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SEANCE_INSCRIBE', {
        seanceId: SEANCE_ID,
      });
      expect(prisma.tx.$queryRaw).toHaveBeenCalled();
      expect(prisma.tx.inscription.count).toHaveBeenCalledWith({
        where: { seanceId: SEANCE_ID },
      });
      expect(prisma.tx.inscription.create).toHaveBeenCalledWith({
        data: { seanceId: SEANCE_ID, userId: 'u1' },
      });
    });

    it('notifie PartiesService.notifyPartieSignalsChanged avec le ownerId de la Partie, pas userId (deferred-work, SSE calendrier personnel)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue(null);
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          inscriptionMax: 6,
        }),
      );
      prisma.tx.inscription.count.mockResolvedValue(2);
      prisma.seance.findMany.mockResolvedValue([]);

      await service.inscrire(SEANCE_ID, 'u1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('capacité modifiée entre la lecture initiale et la transaction → utilise la valeur relue sous le verrou', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6, // valeur périmée : setSeanceCapacity() a réduit le max entretemps
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue(null);
      // Valeur fraîche sous le verrou : max abaissé à 2, déjà atteint par 2 inscrits.
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          inscriptionMax: 2,
        }),
      );
      prisma.tx.inscription.count.mockResolvedValue(2);

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('déjà inscrit (idempotent) — ne recompte jamais le quota, même si max déjà atteint par d’autres (AC2 vs AC4)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue({
        seanceId: SEANCE_ID,
        userId: 'u1',
      });
      prisma.seance.findMany.mockResolvedValue([]);

      await service.inscrire(SEANCE_ID, 'u1');

      expect(prisma.tx.seance.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('nouvel inscrit, count >= max → rejet 409, aucune écriture (AC4)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue(null);
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          inscriptionMax: 6,
        }),
      );
      prisma.tx.inscription.count.mockResolvedValue(6);

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('capacité non définie (inscriptionMax null) → rejet 400', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: null,
          inscriptionMax: null,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('date déjà validée (plage sans créneau, posée hors vote) → rejet 400, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('date choisie via un vote clôturé (plage posée) → rejet 400, aucune écriture (Story 8.8, gap gel du roster)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('date validée (plage posée par un vote) concurremment entre le check initial et la lecture sous verrou → rejet 409, aucune écriture (TOCTOU, revue de code 2026-07-14)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
          poll: null, // pas encore de date validée au moment du check initial hors transaction
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.tx.inscription.findUnique.mockResolvedValue(null);
      // Le MJ a choisi une date (choose()) entre le check initial et l'acquisition du verrou.
      prisma.tx.seance.findUniqueOrThrow.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          inscriptionMax: 6,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.tx.inscription.count).not.toHaveBeenCalled();
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('non-épisodique → rejet 400', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
          startDate: null,
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_LINEAIRE',
          },
          'player',
        ),
      );

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.inscrire(SEANCE_ID, 'u1')).rejects.toThrow(NotFoundException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });

    it('non-membre → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          inscriptionMin: 4,
          inscriptionMax: 6,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.inscrire(SEANCE_ID, 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.tx.inscription.create).not.toHaveBeenCalled();
    });
  });

  describe('desinscrire()', () => {
    const SEANCE_ID = '77777777-7777-4777-a777-777777777777';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'La Dette du Forgeron',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('anti-spoil serveur — un joueur sur la séance d’un brouillon caché reçoit 404, aucune suppression', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({ id: SEANCE_ID, scenarioId: VALID_SCENARIO_ID }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'BROUILLON' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant({ id: 'p1', ownerId: 'mj1', kind: 'CAMPAGNE_EPISODIQUE' }, 'player'),
      );

      await expect(service.desinscrire(SEANCE_ID, 'u1')).rejects.toThrow('Séance introuvable');
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();
    });

    it('retrait réussi (AC3)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await service.desinscrire(SEANCE_ID, 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'SEANCE_UNSUBSCRIBE', {
        seanceId: SEANCE_ID,
      });
      expect(prisma.inscription.deleteMany).toHaveBeenCalledWith({
        where: { seanceId: SEANCE_ID, userId: 'u1' },
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await service.desinscrire(SEANCE_ID, 'u1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie PartiesService.notifyPartieSignalsChanged avec le ownerId de la Partie, pas userId (deferred-work, SSE calendrier personnel)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await service.desinscrire(SEANCE_ID, 'u1');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('scénario PASSE → retrait toujours autorisé (décision explicite, Story 17.2 AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(
        withEvent(mockScenario({ status: 'PASSE' })),
      );
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await service.desinscrire(SEANCE_ID, 'u1');

      expect(prisma.inscription.deleteMany).toHaveBeenCalledWith({
        where: { seanceId: SEANCE_ID, userId: 'u1' },
      });
    });

    it('non-inscrit → no-op silencieux, aucune erreur (AC3)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );
      prisma.inscription.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.desinscrire(SEANCE_ID, 'u1')).resolves.toBeDefined();
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.desinscrire(SEANCE_ID, 'u1')).rejects.toThrow(NotFoundException);
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();
    });

    it('non-membre → 403 propagé par permissions.assert', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.desinscrire(SEANCE_ID, 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();
    });

    it('date déjà validée (plage sans créneau, posée hors vote) → rejet 400, aucune écriture (roster figé après validation MJ)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.desinscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();
    });

    it('date choisie via un vote clôturé (plage posée) → rejet 400, aucune écriture (Story 8.8, gap gel du roster)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          startSlot: null,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant(
          {
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_EPISODIQUE',
          },
          'player',
        ),
      );

      await expect(service.desinscrire(SEANCE_ID, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.inscription.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('setCompteRendu()', () => {
    const SEANCE_ID = '99999999-9999-4999-a999-999999999999';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'La Dette du Forgeron',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it.each(['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'] as const)(
      '%s : compte-rendu enregistré, aucune restriction de kind (AC1)',
      async (kind) => {
        prisma.seance.findUnique.mockResolvedValue(
          asSeance({
            id: SEANCE_ID,
            scenarioId: VALID_SCENARIO_ID,
          }),
        );
        prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
        permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1', kind }));

        await service.setCompteRendu(SEANCE_ID, 'mj1', 'Les PJ ont vaincu le dragon.');

        expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_COMPTE_RENDU_SET', {
          seanceId: SEANCE_ID,
        });
        expect(prisma.seance.update).toHaveBeenCalledWith({
          where: { id: SEANCE_ID },
          data: { compteRendu: 'Les PJ ont vaincu le dragon.' },
        });
      },
    );

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setCompteRendu(SEANCE_ID, 'mj1', 'texte');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (Story 29.7, AD-14, signal COMPTE_RENDU_NON_REDIGE)', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setCompteRendu(SEANCE_ID, 'mj1', 'texte');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('chaîne vide acceptée — efface un compte-rendu déjà rédigé', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setCompteRendu(SEANCE_ID, 'mj1', '');

      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { compteRendu: '' },
      });
    });

    it('séance introuvable → 404', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.setCompteRendu(SEANCE_ID, 'mj1', 'texte')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setCompteRendu(SEANCE_ID, 'stranger', 'texte')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });
  });

  // ─── setInfosPratiques (Story 36.5, D-15 amendée) ────────────────────────
  describe('setInfosPratiques()', () => {
    const SEANCE_ID = '33333333-3333-4333-a333-333333333333';

    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'Scénario',
        description: null,
        status: 'COURANT',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        seances: [],
        ...overrides,
      };
    }

    const PAYLOAD = {
      heureRdv: '20:30',
      lieu: 'chez Marc',
      notePratique: 'pensez aux dés',
    };

    function arrange(kind = 'CAMPAGNE_LINEAIRE') {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1', kind }));
    }

    it.each(['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'] as const)(
      '%s : les trois champs enregistrés, aucune restriction de kind (AC1)',
      async (kind) => {
        arrange(kind);

        await service.setInfosPratiques(SEANCE_ID, 'mj1', PAYLOAD);

        expect(prisma.seance.update).toHaveBeenCalledWith({
          where: { id: SEANCE_ID },
          data: PAYLOAD,
        });
      },
    );

    it('Story 47.1 : une durée corrigée notifie les calendriers personnels', async () => {
      arrange();
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          durationSlots: 1,
          startDate: null,
          startSlot: null,
          pollId: null,
        }),
      );

      await service.setInfosPratiques(SEANCE_ID, 'mj1', { ...PAYLOAD, durationSlots: 3 });

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('Story 47.1 : sans durée, ou à durée identique, aucune notification', async () => {
      arrange();
      await service.setInfosPratiques(SEANCE_ID, 'mj1', PAYLOAD);

      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
          durationSlots: 3,
          startDate: null,
          startSlot: null,
          pollId: null,
        }),
      );
      await service.setInfosPratiques(SEANCE_ID, 'mj1', { ...PAYLOAD, durationSlots: 3 });

      expect(parties.notifyPartieSignalsChanged).not.toHaveBeenCalled();
    });

    it('AC1 : les trois champs sont écrits en UNE seule mise à jour', async () => {
      arrange();

      await service.setInfosPratiques(SEANCE_ID, 'mj1', PAYLOAD);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SEANCE_PRACTICAL_INFO_SET', {
        seanceId: SEANCE_ID,
      });
      expect(prisma.seance.update).toHaveBeenCalledTimes(1);
    });

    it('AC4 : null est accepté et VIDE le champ', async () => {
      arrange();

      await service.setInfosPratiques(SEANCE_ID, 'mj1', {
        heureRdv: null,
        lieu: null,
        notePratique: null,
      });

      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { heureRdv: null, lieu: null, notePratique: null },
      });
    });

    it('AC4 : un seul champ renseigné, les deux autres vidés', async () => {
      arrange();

      await service.setInfosPratiques(SEANCE_ID, 'mj1', {
        heureRdv: null,
        lieu: 'en visio',
        notePratique: null,
      });

      expect(prisma.seance.update).toHaveBeenCalledWith({
        where: { id: SEANCE_ID },
        data: { heureRdv: null, lieu: 'en visio', notePratique: null },
      });
    });

    it('AC5 : non-MJ → 403 propagé par permissions.assert, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(
        asSeance({
          id: SEANCE_ID,
          scenarioId: VALID_SCENARIO_ID,
        }),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setInfosPratiques(SEANCE_ID, 'stranger', PAYLOAD)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('séance introuvable → 404, aucune écriture', async () => {
      prisma.seance.findUnique.mockResolvedValue(null);

      await expect(service.setInfosPratiques('inconnue', 'mj1', PAYLOAD)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.seance.update).not.toHaveBeenCalled();
    });

    it('émet un événement temps réel sur la partie', async () => {
      arrange();

      await service.setInfosPratiques(SEANCE_ID, 'mj1', PAYLOAD);

      expect(realtimeEvents.emit).toHaveBeenCalledWith('partie:p1');
    });

    // AC2 — la garde n°2 rendue exécutable : heureRdv n'est jamais interprétée.
    it('AC2 : heureRdv est transmise telle quelle, sans être convertie en date', async () => {
      arrange();

      await service.setInfosPratiques(SEANCE_ID, 'mj1', PAYLOAD);

      const written = (prisma.seance.update.mock.calls[0] as [{ data: { heureRdv: unknown } }])[0]
        .data;
      expect(typeof written.heureRdv).toBe('string');
      expect(written.heureRdv).toBe('20:30');
      expect(written.heureRdv).not.toBeInstanceOf(Date);
    });
  });

  describe('setResumeFin()', () => {
    function mockScenario(overrides: Record<string, unknown> = {}) {
      return {
        id: VALID_SCENARIO_ID,
        partieId: 'p1',
        title: 'La Dette du Forgeron',
        description: null,
        status: 'PASSE',
        dureeHeures: null,
        dureeSeances: null,
        resumeFin: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        closedAt: null,
        ...overrides,
      };
    }

    it('scénario PASSE : résumé de fin enregistré (AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.update.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setResumeFin(
        VALID_SCENARIO_ID,
        'mj1',
        'Les PJ ont vaincu le dragon et sauvé le village.',
      );

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'SCENARIO_UPDATE', {
        eventId: VALID_SCENARIO_ID,
      });
      expect(prisma.scenario.update).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID },
        data: { resumeFin: 'Les PJ ont vaincu le dragon et sauvé le village.' },
        include: { event: true },
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.update.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setResumeFin(VALID_SCENARIO_ID, 'mj1', 'texte');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('notifie aussi PartiesService.notifyPartieSignalsChanged (Story 29.7, AD-14, signal RAPPORT_FIN_MANQUANT)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.update.mockResolvedValue(withEvent(mockScenario()));
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setResumeFin(VALID_SCENARIO_ID, 'mj1', 'texte');

      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('chaîne vide acceptée — efface un résumé déjà rédigé', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent(mockScenario({ resumeFin: 'Ancien résumé' })),
      );
      prisma.scenario.update.mockResolvedValue(withEvent(mockScenario({ resumeFin: '' })));
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setResumeFin(VALID_SCENARIO_ID, 'mj1', '');

      expect(prisma.scenario.update).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID },
        data: { resumeFin: '' },
        include: { event: true },
      });
    });

    it('rédaction acceptée une seconde fois après une première écriture (AC3, non-régression)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent(mockScenario({ resumeFin: 'Premier jet' })),
      );
      prisma.scenario.update.mockResolvedValue(
        withEvent(mockScenario({ resumeFin: 'Version corrigée' })),
      );
      prisma.scenario.findUniqueOrThrow.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockResolvedValue(
        testGrant({
          id: 'p1',
          ownerId: 'mj1',
          kind: 'CAMPAGNE_LINEAIRE',
        }),
      );

      await service.setResumeFin(VALID_SCENARIO_ID, 'mj1', 'Version corrigée');

      expect(prisma.scenario.update).toHaveBeenCalledWith({
        where: { id: VALID_SCENARIO_ID },
        data: { resumeFin: 'Version corrigée' },
        include: { event: true },
      });
    });

    it.each(['BROUILLON', 'A_VENIR', 'COURANT'] as const)(
      'statut %s : rejet 400, aucune écriture (AC2)',
      async (status) => {
        prisma.scenario.findUnique.mockResolvedValue(withEvent(mockScenario({ status })));
        permissions.assert.mockResolvedValue(
          testGrant({
            id: 'p1',
            ownerId: 'mj1',
            kind: 'CAMPAGNE_LINEAIRE',
          }),
        );

        await expect(service.setResumeFin(VALID_SCENARIO_ID, 'mj1', 'texte')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.scenario.update).not.toHaveBeenCalled();
      },
    );

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.setResumeFin(VALID_SCENARIO_ID, 'mj1', 'texte')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });

    it('non-MJ → 403 propagé par permissions.assert, aucune écriture (AC5)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(withEvent(mockScenario()));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setResumeFin(VALID_SCENARIO_ID, 'stranger', 'texte')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.scenario.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyScenarioBelongsToPartie() (Story 9.1, AD-2)', () => {
    const OTHER_PARTIE_ID = 'p2';

    it('scénario existant et appartenant à la Partie → résout sans erreur', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'COURANT',
        }),
      );

      await expect(
        service.verifyScenarioBelongsToPartie(VALID_SCENARIO_ID, 'p1'),
      ).resolves.toBeUndefined();
    });

    it('scénario BROUILLON de la Partie → résout sans erreur (AC7, aucune validation de statut)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'BROUILLON',
        }),
      );

      await expect(
        service.verifyScenarioBelongsToPartie(VALID_SCENARIO_ID, 'p1'),
      ).resolves.toBeUndefined();
    });

    it('scénario A_VENIR de la Partie → résout sans erreur (AC7, aucune validation de statut)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: 'p1',
          status: 'A_VENIR',
        }),
      );

      await expect(
        service.verifyScenarioBelongsToPartie(VALID_SCENARIO_ID, 'p1'),
      ).resolves.toBeUndefined();
    });

    it('scénario introuvable → 404', async () => {
      prisma.scenario.findUnique.mockResolvedValue(null);

      await expect(service.verifyScenarioBelongsToPartie(VALID_SCENARIO_ID, 'p1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('scénario appartenant à une autre Partie → 400 (AC3)', async () => {
      prisma.scenario.findUnique.mockResolvedValue(
        withEvent({
          id: VALID_SCENARIO_ID,
          partieId: OTHER_PARTIE_ID,
          status: 'COURANT',
        }),
      );

      await expect(service.verifyScenarioBelongsToPartie(VALID_SCENARIO_ID, 'p1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
