import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

// HommeDragonService importe validateHommeDragon/computeHommeDragonDerived/levelForScenariosPasse
// depuis @master-jdr/game-rules (ESM, non transformé par ts-jest) — même mécanisme que ailleurs
// dans le projet (cf. mémoire d'équipe : "game-rules ESM jest.mock") pour éviter "Unexpected token
// export" au chargement du module. levelForScenariosPasse/computeHommeDragonDerived sont réimplémentées
// ici à l'identique (fonctions pures, triviales) plutôt que mockées en jest.fn() — les tests Story 10.3
// vérifient une vraie table de vérité niveau/PS, pas juste que la fonction est appelée.
jest.mock('@master-jdr/game-rules', () => ({
  validateHommeDragon: jest.fn(),
  ARTEFACT_CADEAU_LEVEL: 4,
  // Règles de la réserve (Story 33.6) : testées pour de bon, avec le vrai paquet, dans
  // `homme-dragon.service.reserve.spec.ts`.
  reserveCapacity: (level: number) => Math.max(level - 1, 0),
  validateReserve: jest.fn(() => ({ valid: true, errors: [] })),
  levelForScenariosPasse: (count: number) => {
    const thresholds = [
      { level: 2, scenariosPasse: 1 },
      { level: 3, scenariosPasse: 3 },
      { level: 4, scenariosPasse: 7 },
      { level: 5, scenariosPasse: 12 },
    ];
    let level = 1;
    for (const entry of thresholds) {
      if (count >= entry.scenariosPasse) level = entry.level;
    }
    return level;
  },
  computeHommeDragonDerived: (level: number) => {
    if (level <= 2) return { PS: 3 };
    if (level <= 4) return { PS: 5 };
    return { PS: 10 };
  },
  pendingEveilLevels: (currentLevel: number, appliedLevels: number[]) => {
    const pending: number[] = [];
    for (let level = 2; level <= currentLevel; level++) {
      if (!appliedLevels.includes(level)) pending.push(level);
    }
    return pending;
  },
}));

import { validateHommeDragon } from '@master-jdr/game-rules';
import { HommeDragonService } from './homme-dragon.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { CAPABILITY_UNAVAILABLE_MESSAGE } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';
import { GameSystemService } from '../game-systems/game-system.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { objectLike } from '../common/test-utils/jest-typed';
import { plainToInstance } from 'class-transformer';
import { UpdateHommeDragonDto } from './dto/update-homme-dragon.dto';

const mockValidate = validateHommeDragon as jest.Mock;

function makePrisma() {
  const tx = {
    $queryRaw: jest.fn(),
    hommeDragon: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    partie: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    scenario: {
      count: jest.fn(),
    },
  };
  return {
    hommeDragon: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    partie: {
      findMany: jest.fn(),
    },
    user: {
      findUniqueOrThrow: jest.fn(),
    },
    // Parametre renomme : nomme `tx`, il masquait la variable `tx` ci-dessus et rendait
    // `typeof tx` circulaire (TS2502).
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    tx,
  };
}

/** Story 37.7 : les droits (rôle MJ et capacité `hommeDragon`) sont décidés par `assert()`. */
function makePermissions() {
  return { assert: jest.fn() };
}

function makePartiesService() {
  return {
    notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined),
  };
}

function makeGameSystems() {
  return {
    getContent: jest.fn(),
  };
}

function makeScenarios() {
  return {
    findPasseForParties: jest.fn(),
  };
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

function makeHommeDragon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    },
    createdAt: new Date('2026-07-16T00:00:00.000Z'),
    updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    ...overrides,
  };
}

/** Un scénario `PASSE` tel que rendu par `ScenariosService.findPasseForParties`. */
function makePasse(index: number, partieId = 'p1', overrides: Record<string, unknown> = {}) {
  return {
    id: `s${partieId}-${index}`,
    partieId,
    title: `Scénario ${index}`,
    closedAt: `2026-07-${String(10 + (index % 18)).padStart(2, '0')}T00:00:00.000Z`,
    participants: [],
    ...overrides,
  };
}

const CATALOG_CONTENT = {
  hommeDragonArtefact: [
    {
      key: 'grand-arc',
      data: { key: 'grand-arc', label: 'Grand arc', race: 'DRAGON_ROUGE' },
    },
    {
      key: 'lanterne',
      data: { key: 'lanterne', label: 'Lanterne', race: 'DRAGON_VERT' },
    },
    {
      key: 'sans-race',
      data: { key: 'sans-race', label: 'Sans race' },
    },
  ],
  eveilPower: [
    {
      key: 'escorte-du-dragon',
      data: { key: 'escorte-du-dragon', label: 'Escorte du dragon', ps: 2 },
    },
    {
      key: 'couche-du-dragon',
      data: { key: 'couche-du-dragon', label: 'Couche du dragon', ps: 2 },
    },
  ],
};

const PARTIE_RYUUTAMA = { id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama', name: 'Ma Campagne' };

describe('HommeDragonService', () => {
  let service: HommeDragonService;
  let prisma: ReturnType<typeof makePrisma>;
  let parties: ReturnType<typeof makePartiesService>;
  let permissions: ReturnType<typeof makePermissions>;
  let gameSystems: ReturnType<typeof makeGameSystems>;
  let scenarios: ReturnType<typeof makeScenarios>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;

  /**
   * Prépare le monde d'un Homme Dragon : sa ligne (relue sous verrou ET en lecture simple), ses
   * aventures et leurs scénarios `PASSE`. `passeCount` scénarios `PASSE` sont répartis sur les
   * aventures données (la première par défaut) : le comptage sous verrou et la lecture en lot
   * racontent la même histoire.
   */
  function arrange(
    options: {
      sheetData?: Record<string, unknown>;
      passeCount?: number;
      aventures?: { id: string; name: string }[];
      members?: Record<string, { userId: string; pseudo: string; displayName: string }[]>;
      scenarios?: ReturnType<typeof makePasse>[];
    } = {},
  ) {
    const row = makeHommeDragon(options.sheetData ? { sheetData: options.sheetData } : {});
    const aventures = options.aventures ?? [{ id: 'p1', name: 'Ma Campagne' }];
    const passes =
      options.scenarios ??
      Array.from({ length: options.passeCount ?? 0 }, (_, i) =>
        makePasse(i, aventures[0]?.id ?? 'p1'),
      );
    prisma.tx.hommeDragon.findFirst.mockResolvedValue(row);
    prisma.hommeDragon.findFirst.mockResolvedValue(row);
    prisma.tx.hommeDragon.update.mockImplementation(({ data }: { data: { sheetData: object } }) =>
      Promise.resolve({ ...row, sheetData: data.sheetData }),
    );
    prisma.tx.scenario.count.mockResolvedValue(passes.length);
    prisma.partie.findMany.mockResolvedValue(aventures);
    scenarios.findPasseForParties.mockResolvedValue({
      scenarios: passes,
      membersByPartie: new Map(Object.entries(options.members ?? {})),
    });
    return row;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    parties = makePartiesService();
    permissions = makePermissions();
    gameSystems = makeGameSystems();
    scenarios = makeScenarios();
    realtimeEvents = makeRealtimeEvents();
    gameSystems.getContent.mockResolvedValue(CATALOG_CONTENT);
    mockValidate.mockReturnValue({ valid: true, errors: [] });
    scenarios.findPasseForParties.mockResolvedValue({ scenarios: [], membersByPartie: new Map() });
    prisma.partie.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        HommeDragonService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartiesService, useValue: parties },
        { provide: PermissionService, useValue: permissions },
        { provide: GameSystemService, useValue: gameSystems },
        { provide: ScenariosService, useValue: scenarios },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
      ],
    }).compile();
    service = module.get(HommeDragonService);
  });

  describe('create() — crée ET lie (AD-23)', () => {
    const dto = {
      race: 'DRAGON_ROUGE' as const,
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    };

    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(PARTIE_RYUUTAMA));
      prisma.tx.hommeDragon.create.mockResolvedValue(makeHommeDragon());
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 1 });
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'Ma Campagne' }]);
    });

    it('création et lien dans UNE transaction : aucune fiche sans partieId, lien posé par un updateMany conditionnel', async () => {
      const result = await service.create('p1', 'mj1', dto);

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'HOMME_DRAGON_MANAGE', {
        partieId: 'p1',
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.hommeDragon.create).toHaveBeenCalledWith({
        data: {
          userId: 'mj1',
          gameSystemId: 'ryuutama',
          sheetData: objectLike({ race: 'DRAGON_ROUGE', nom: 'Ignis' }),
        },
      });
      expect(prisma.tx.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama', hommeDragonId: null },
        data: { hommeDragonId: 'hd1' },
      });
      expect(result.id).toBe('hd1');
      expect(result.sheetData.nom).toBe('Ignis');
      expect(result.aventures.map((a) => a.partieId)).toEqual(['p1']);
      expect(result).not.toHaveProperty('partieId');
    });

    it('émet partie:{id} puis notifyPartieSignalsChanged, APRÈS la transaction (P7-AD-2)', async () => {
      const order: string[] = [];
      prisma.$transaction.mockImplementation(async (cb: (t: typeof prisma.tx) => unknown) => {
        const out = await cb(prisma.tx);
        order.push('commit');
        return out;
      });
      realtimeEvents.emit.mockImplementation(() => order.push('emit'));
      parties.notifyPartieSignalsChanged.mockImplementation(() => {
        order.push('signals');
        return Promise.resolve();
      });

      await service.create('p1', 'mj1', dto);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
      expect(order).toEqual(['commit', 'emit', 'signals']);
    });

    it('mondesProteges non fourni → pré-rempli avec partie.name', async () => {
      await service.create('p1', 'mj1', dto);

      expect(prisma.tx.hommeDragon.create).toHaveBeenCalledWith({
        data: objectLike({ sheetData: objectLike({ mondesProteges: 'Ma Campagne' }) }),
      });
    });

    it('mondesProteges fourni par le DTO → conservé tel quel, pas écrasé', async () => {
      await service.create('p1', 'mj1', { ...dto, mondesProteges: 'Monde perso' });

      expect(prisma.tx.hommeDragon.create).toHaveBeenCalledWith({
        data: objectLike({ sheetData: objectLike({ mondesProteges: 'Monde perso' }) }),
      });
    });

    it('artefact hors catalogue/mauvaise race → BadRequestException, aucune transaction', async () => {
      mockValidate.mockReturnValue({
        valid: false,
        errors: [{ field: 'artefact.key', message: 'invalide' }],
      });

      await expect(service.create('p1', 'mj1', dto)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('système sans la capacité hommeDragon → BadRequestException du service de permission, rien écrit', async () => {
      permissions.assert.mockRejectedValue(new BadRequestException(CAPABILITY_UNAVAILABLE_MESSAGE));

      await expect(service.create('p1', 'mj1', dto)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.tx.hommeDragon.create).not.toHaveBeenCalled();
    });

    it('le lien perd la course (zéro ligne) → 409, la transaction annule la création, rien émis', async () => {
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.create('p1', 'mj1', dto)).rejects.toThrow(ConflictException);
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(parties.notifyPartieSignalsChanged).not.toHaveBeenCalled();
    });

    it('non-MJ → ForbiddenException propagée par permissions.assert, aucune écriture', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.create('p1', 'stranger', dto)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('link() (AD-23)', () => {
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(PARTIE_RYUUTAMA));
      arrange({ aventures: [{ id: 'p1', name: 'Ma Campagne' }] });
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 1 });
    });

    it('pose le lien : verrou HommeDragon, relecture {id, userId}, puis UN updateMany conditionnel', async () => {
      const order: string[] = [];
      prisma.tx.$queryRaw.mockImplementation(() => {
        order.push('lock');
        return Promise.resolve([]);
      });
      prisma.tx.hommeDragon.findFirst.mockImplementation(() => {
        order.push('relecture');
        return Promise.resolve(makeHommeDragon());
      });
      prisma.tx.partie.updateMany.mockImplementation(() => {
        order.push('partie');
        return Promise.resolve({ count: 1 });
      });

      const dto = await service.link('p1', 'hd1', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'HOMME_DRAGON_MANAGE', {
        partieId: 'p1',
      });
      // Ordre de prise des verrous fixé par AD-23 : HommeDragon puis Partie.
      expect(order).toEqual(['lock', 'relecture', 'partie']);
      expect(prisma.tx.hommeDragon.findFirst).toHaveBeenCalledWith({
        where: { id: 'hd1', userId: 'mj1' },
      });
      expect(prisma.tx.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama', hommeDragonId: null },
        data: { hommeDragonId: 'hd1' },
      });
      expect(dto.id).toBe('hd1');
    });

    it('émet partie:{id} puis notifyPartieSignalsChanged', async () => {
      await service.link('p1', 'hd1', 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('Homme Dragon absent ou étranger → 404 AVANT tout 409, aucune écriture de partie', async () => {
      prisma.tx.hommeDragon.findFirst.mockResolvedValue(null);
      // Même si la partie était déjà pourvue, la réponse est un 404 : aucun oracle d'existence.
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.link('p1', 'hd-etranger', 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.tx.partie.updateMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('système sans la capacité hommeDragon → 400 du service de permission, rien écrit', async () => {
      permissions.assert.mockRejectedValue(new BadRequestException(CAPABILITY_UNAVAILABLE_MESSAGE));

      await expect(service.link('p1', 'hd1', 'mj1')).rejects.toThrow(BadRequestException);
      expect(prisma.tx.partie.updateMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('partie déjà pourvue (zéro ligne) → 409, rien changé, rien émis', async () => {
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.link('p1', 'hd1', 'mj1')).rejects.toThrow(ConflictException);
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(parties.notifyPartieSignalsChanged).not.toHaveBeenCalled();
    });

    it('non-MJ de la partie → ForbiddenException propagée par permissions.assert', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.link('p1', 'hd1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('unlink() (AD-23)', () => {
    beforeEach(() => {
      permissions.assert.mockResolvedValue(testGrant(PARTIE_RYUUTAMA));
      arrange({ aventures: [] });
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 1 });
    });

    it('délie : verrou, updateMany « WHERE id AND hommeDragonId = :h », sheetData intact (rien purgé)', async () => {
      const dto = await service.unlink('p1', 'hd1', 'mj1');

      // Action dédiée, sans capacité : une partie sortie du système se délie toujours.
      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'HOMME_DRAGON_UNLINK', {
        partieId: 'p1',
      });
      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.partie.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'mj1', hommeDragonId: 'hd1' },
        data: { hommeDragonId: null },
      });
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
      expect(dto.aventures).toEqual([]);
    });

    it('non-MJ → ForbiddenException propagée par permissions.assert, rien délié', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.unlink('p1', 'hd1', 'joueur1')).rejects.toThrow(ForbiddenException);
      expect(prisma.tx.partie.updateMany).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('émet partie:{id} puis notifyPartieSignalsChanged', async () => {
      await service.unlink('p1', 'hd1', 'mj1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
    });

    it('partie qui ne porte pas cet Homme Dragon (zéro ligne) → 404, rien émis', async () => {
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.unlink('p1', 'hd1', 'mj1')).rejects.toThrow(NotFoundException);
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('Homme Dragon étranger → 404', async () => {
      prisma.tx.hommeDragon.findFirst.mockResolvedValue(null);

      await expect(service.unlink('p1', 'hd-etranger', 'mj1')).rejects.toThrow(NotFoundException);
      expect(prisma.tx.partie.updateMany).not.toHaveBeenCalled();
    });

    it('non-MJ → ForbiddenException propagée par permissions.assert', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.unlink('p1', 'hd1', 'stranger')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findForPartie() (AD-23)', () => {
    it("partie sans Homme Dragon → null, jamais d'exception", async () => {
      permissions.assert.mockResolvedValue(testGrant({ ...PARTIE_RYUUTAMA, hommeDragonId: null }));

      await expect(service.findForPartie('p1', 'mj1')).resolves.toBeNull();
      // Lecture MJ seul, sans capacité : null sur un système sans Homme Dragon, jamais un 400.
      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'HOMME_DRAGON_READ', {
        partieId: 'p1',
      });
      expect(prisma.hommeDragon.findFirst).not.toHaveBeenCalled();
    });

    it('partie liée → référence { id, nom } uniquement', async () => {
      permissions.assert.mockResolvedValue(testGrant({ ...PARTIE_RYUUTAMA, hommeDragonId: 'hd1' }));
      prisma.hommeDragon.findFirst.mockResolvedValue(makeHommeDragon());

      const ref = await service.findForPartie('p1', 'mj1');

      expect(ref).toEqual({ id: 'hd1', nom: 'Ignis' });
      expect(prisma.hommeDragon.findFirst).toHaveBeenCalledWith({
        where: { id: 'hd1', userId: 'mj1' },
      });
    });

    it('joueur de la partie (non MJ) → ForbiddenException propagée par permissions.assert, aucune donnée lue', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.findForPartie('p1', 'joueur1')).rejects.toThrow(ForbiddenException);
      expect(prisma.hommeDragon.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update() (PATCH)', () => {
    it('toute écriture de fiche : transaction, verrou FOR NO KEY UPDATE, relecture {id, userId} sous verrou', async () => {
      arrange();

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.hommeDragon.findFirst).toHaveBeenCalledWith({
        where: { id: 'hd1', userId: 'mj1' },
      });
      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: { sheetData: objectLike({ nom: 'Pyros', race: 'DRAGON_ROUGE' }) },
      });
      expect(permissions.assert).not.toHaveBeenCalled();
    });

    it('verrou pris AVANT la relecture, et SELECT … FOR NO KEY UPDATE sur la ligne par id', async () => {
      arrange();
      const order: string[] = [];
      prisma.tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        order.push(`lock:${strings.join('?')}`);
        return Promise.resolve([]);
      });
      prisma.tx.hommeDragon.findFirst.mockImplementation(() => {
        order.push('relecture');
        return Promise.resolve(makeHommeDragon());
      });

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(order[0]).toContain('FOR NO KEY UPDATE');
      expect(order[0]).toContain('"HommeDragon"');
      expect(order[1]).toBe('relecture');
    });

    it("n'émet rien (AD-23) : ni partie:, ni user:, ni signaux", async () => {
      arrange();

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(realtimeEvents.emit).not.toHaveBeenCalled();
      expect(parties.notifyPartieSignalsChanged).not.toHaveBeenCalled();
    });

    it('conserve artefactCadeau, eveilPowers et réserve déjà enregistrés (jamais écrasés par le PATCH)', async () => {
      arrange({
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          artefactCadeau: { key: 'lanterne' },
          eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
          reserve: ['courage', null],
        },
      });

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: {
          sheetData: objectLike({
            nom: 'Pyros',
            artefactCadeau: { key: 'lanterne' },
            eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
            reserve: ['courage', null],
          }),
        },
      });
    });

    it("changement d'artefact vers une nouvelle clé sans nom/inscription → conserve le nom/inscription existants (merge)", async () => {
      arrange({
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc', nom: 'Flamme', inscription: 'Pour toujours' },
          nom: 'Ignis',
        },
      });

      await service.update('hd1', 'mj1', { artefact: { key: 'grand-arc' } });

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: {
          sheetData: objectLike({
            artefact: { key: 'grand-arc', nom: 'Flamme', inscription: 'Pour toujours' },
          }),
        },
      });
    });

    it("champs absents du PATCH (instance de DTO aux champs optionnels à `undefined`) → la fiche existante n'est pas effacée", async () => {
      arrange();

      await service.update('hd1', 'mj1', {
        nom: undefined,
        artefact: undefined,
        vocation: 'Veiller',
      });

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: {
          sheetData: objectLike({
            nom: 'Ignis',
            artefact: { key: 'grand-arc' },
            vocation: 'Veiller',
          }),
        },
      });
    });

    it('vraie instance de DTO (plainToInstance) avec artefact { key } seul → nom et inscription déjà enregistrés conservés', async () => {
      arrange({
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc', nom: 'Flamme', inscription: 'Pour toujours' },
          nom: 'Ignis',
        },
      });
      const dto = plainToInstance(UpdateHommeDragonDto, { artefact: { key: 'grand-arc' } });
      // Garde du test : l'instance porte bien `nom`/`inscription` en undefined (cible ES2023).
      expect(Object.keys(dto.artefact as object)).toEqual(
        expect.arrayContaining(['key', 'nom', 'inscription']),
      );

      await service.update('hd1', 'mj1', dto);

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: {
          sheetData: objectLike({
            nom: 'Ignis',
            artefact: { key: 'grand-arc', nom: 'Flamme', inscription: 'Pour toujours' },
          }),
        },
      });
    });

    it('revalidé contre le catalogue : refus 400, aucune écriture', async () => {
      arrange();
      mockValidate.mockReturnValue({
        valid: false,
        errors: [{ field: 'nom', message: 'obligatoire' }],
      });

      await expect(service.update('hd1', 'mj1', { nom: '' })).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it("ne mute jamais l'objet sheetData relu (copie)", async () => {
      const row = arrange();
      const before = JSON.stringify(row.sheetData);

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(JSON.stringify(row.sheetData)).toBe(before);
    });

    it('Homme Dragon absent ou étranger → 404 identique, aucune écriture', async () => {
      arrange();
      prisma.tx.hommeDragon.findFirst.mockResolvedValue(null);

      await expect(service.update('hd1', 'stranger', { nom: 'Pyros' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });
  });

  describe('chooseArtefactCadeau() (Story 33.7, AD-23)', () => {
    const LEVEL_4 = 7; // 7 scénarios PASSE = niveau 4

    it("niveau calculé sous le verrou : scenario.count appelé avec exactement le prédicat d'aventure (PASSE, clos, partie liée à l'Homme Dragon)", async () => {
      arrange({ passeCount: 3 });

      await service.update('hd1', 'mj1', { nom: 'Pyros' });

      expect(prisma.tx.scenario.count).toHaveBeenCalledTimes(1);
      expect(prisma.tx.scenario.count).toHaveBeenCalledWith({
        where: {
          status: 'PASSE',
          closedAt: { not: null },
          event: { partie: { hommeDragonId: 'hd1' } },
        },
      });
    });

    it("niveau 4 + artefact d'une autre race → cadeau enregistré, verrou de ligne pris, rien émis", async () => {
      arrange({ passeCount: LEVEL_4 });

      const dto = await service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' });

      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: { sheetData: objectLike({ artefactCadeau: { key: 'lanterne' } }) },
      });
      expect(dto.sheetData.artefactCadeau).toEqual({ key: 'lanterne' });
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('niveau calculé SOUS le verrou : une dissociation concurrente ne laisse pas écrire pour un niveau périmé', async () => {
      arrange({ passeCount: LEVEL_4 });
      // Le verrou est pris, puis une dissociation validée juste avant nous fait tomber à 3 scénarios.
      prisma.tx.scenario.count.mockResolvedValue(3);

      await expect(service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('niveau 5 : toujours autorisé (niveau ≥ 4)', async () => {
      arrange({ passeCount: 12 });

      await service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' });

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledTimes(1);
    });

    it('conserve la réserve déjà enregistrée (Story 33.6)', async () => {
      arrange({
        passeCount: LEVEL_4,
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          reserve: ['courage'],
        },
      });

      await service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' });

      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: { sheetData: objectLike({ reserve: ['courage'] }) },
      });
    });

    it('niveau 3 → BadRequestException, aucune écriture', async () => {
      arrange({ passeCount: 3 });

      await expect(service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('artefact de la race du dragon → BadRequestException', async () => {
      arrange({ passeCount: LEVEL_4 });

      await expect(
        service.chooseArtefactCadeau('hd1', 'mj1', { key: 'grand-arc' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('clé absente du catalogue, ou entrée sans race → BadRequestException', async () => {
      arrange({ passeCount: LEVEL_4 });

      await expect(service.chooseArtefactCadeau('hd1', 'mj1', { key: 'inconnu' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.chooseArtefactCadeau('hd1', 'mj1', { key: 'sans-race' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('second choix (cadeau déjà présent) → BadRequestException, valeur inchangée', async () => {
      arrange({
        passeCount: LEVEL_4,
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          artefactCadeau: { key: 'lanterne' },
        },
      });

      await expect(service.chooseArtefactCadeau('hd1', 'mj1', { key: 'lanterne' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('Homme Dragon absent ou étranger → 404 identique', async () => {
      arrange({ passeCount: LEVEL_4 });
      prisma.tx.hommeDragon.findFirst.mockResolvedValue(null);

      await expect(
        service.chooseArtefactCadeau('hd1', 'stranger', { key: 'lanterne' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });
  });

  describe('chooseEveilPower() (Story 10.4, AD-23)', () => {
    it('niveau en attente + clé valide → choix enregistré, append sans écraser les précédents, rien émis', async () => {
      arrange({
        passeCount: 3, // niveau 3
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          reserve: ['courage'],
          eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
        },
      });

      const dto = await service.chooseEveilPower('hd1', 'mj1', {
        level: 3,
        key: 'couche-du-dragon',
      });

      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.tx.hommeDragon.update).toHaveBeenCalledWith({
        where: { id: 'hd1' },
        data: {
          sheetData: objectLike({
            reserve: ['courage'],
            eveilPowers: [
              { level: 2, key: 'escorte-du-dragon' },
              { level: 3, key: 'couche-du-dragon' },
            ],
          }),
        },
      });
      expect(dto.eveilPowers).toHaveLength(2);
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    });

    it('niveau calculé sous le verrou : un niveau devenu supérieur au niveau réel est refusé', async () => {
      arrange({ passeCount: 3 });
      prisma.tx.scenario.count.mockResolvedValue(1); // dissociation concurrente : niveau 2

      await expect(
        service.chooseEveilPower('hd1', 'mj1', { level: 3, key: 'escorte-du-dragon' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('niveau pas en attente (déjà pourvu) → BadRequestException', async () => {
      arrange({
        passeCount: 1,
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
        },
      });

      await expect(
        service.chooseEveilPower('hd1', 'mj1', { level: 2, key: 'couche-du-dragon' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('clé inconnue du catalogue → BadRequestException', async () => {
      arrange({ passeCount: 1 });

      await expect(
        service.chooseEveilPower('hd1', 'mj1', { level: 2, key: 'inconnu' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('pouvoir déjà choisi pour un autre niveau (pool commun) → BadRequestException', async () => {
      arrange({
        passeCount: 3,
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
        },
      });

      await expect(
        service.chooseEveilPower('hd1', 'mj1', { level: 3, key: 'escorte-du-dragon' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tx.hommeDragon.update).not.toHaveBeenCalled();
    });

    it('Homme Dragon absent ou étranger → 404 identique', async () => {
      arrange({ passeCount: 1 });
      prisma.tx.hommeDragon.findFirst.mockResolvedValue(null);

      await expect(
        service.chooseEveilPower('hd1', 'stranger', { level: 2, key: 'escorte-du-dragon' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOwnerPseudo()', () => {
    it("retourne le pseudo de l'utilisateur (le MJ, propriétaire de la fiche)", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ pseudo: 'admin' });

      await expect(service.getOwnerPseudo('mj1')).resolves.toBe('admin');
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'mj1' },
        select: { pseudo: true },
      });
    });
  });

  describe('findOne() — fiche adressée par son id, gardée par son propriétaire (AD-23)', () => {
    it('résolue par { id, userId: appelant }, sans passer par une partie', async () => {
      arrange();

      const dto = await service.findOne('hd1', 'mj1');

      expect(prisma.hommeDragon.findFirst).toHaveBeenCalledWith({
        where: { id: 'hd1', userId: 'mj1' },
      });
      expect(permissions.assert).not.toHaveBeenCalled();
      expect(dto.id).toBe('hd1');
      expect(dto).not.toHaveProperty('partieId');
      expect(dto).not.toHaveProperty('voyageursProteges');
    });

    it('absent ou appartenant à un autre → NotFoundException, dans les deux cas, jamais 403', async () => {
      prisma.hommeDragon.findFirst.mockResolvedValue(null);

      const absent = service.findOne('inexistant', 'mj1');
      const etranger = service.findOne('hd1', 'stranger');

      await expect(absent).rejects.toThrow(NotFoundException);
      await expect(etranger).rejects.toThrow(NotFoundException);
      await expect(etranger).rejects.not.toBeInstanceOf(ForbiddenException);
    });

    it('la réserve est servie au propriétaire avec la fiche (sheetData.reserve)', async () => {
      arrange({
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          reserve: ['courage', null],
        },
      });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.sheetData.reserve).toEqual(['courage', null]);
    });

    it('Homme Dragon sans aucune aventure : la fiche s’ouvre normalement (niveau 1, aventures vides)', async () => {
      arrange({ aventures: [] });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.aventures).toEqual([]);
      expect(dto.historique).toEqual([]);
      expect(dto.derived).toEqual({ level: 1, PS: 3 });
      // Aucune lecture de scénarios inutile : la lecture en lot reçoit un tableau vide.
      expect(scenarios.findPasseForParties).toHaveBeenCalledWith([]);
    });
  });

  describe('findMine() (Story 33.5, AD-23)', () => {
    it('une seule requête filtrée sur userId SEUL, triée createdAt desc, aventures triées createdAt puis id', async () => {
      prisma.hommeDragon.findMany.mockResolvedValue([]);

      await service.findMine('mj1');

      expect(prisma.hommeDragon.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.hommeDragon.findMany).toHaveBeenCalledWith({
        where: { userId: 'mj1' },
        include: {
          parties: {
            select: { id: true, name: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('aucun Homme Dragon → tableau vide', async () => {
      prisma.hommeDragon.findMany.mockResolvedValue([]);

      await expect(service.findMine('mj1')).resolves.toEqual([]);
    });

    it('projette la forme légère : aventures [{ partieId, nom }], sans niveau ni partieId à plat', async () => {
      prisma.hommeDragon.findMany.mockResolvedValue([
        {
          ...makeHommeDragon({
            sheetData: {
              race: 'DRAGON_BLEU',
              artefact: { key: 'x' },
              nom: 'Kaien',
              avatar: 'data:image/png;base64,abc',
            },
          }),
          parties: [
            { id: 'p1', name: 'La Route des Lanternes' },
            { id: 'p2', name: 'Les Annales de Brume' },
          ],
        },
      ]);

      const [item] = await service.findMine('mj1');

      expect(item).toEqual({
        id: 'hd1',
        aventures: [
          { partieId: 'p1', nom: 'La Route des Lanternes' },
          { partieId: 'p2', nom: 'Les Annales de Brume' },
        ],
        gameSystemId: 'ryuutama',
        nom: 'Kaien',
        race: 'DRAGON_BLEU',
        avatar: 'data:image/png;base64,abc',
        createdAt: '2026-07-16T00:00:00.000Z',
      });
      expect(item).not.toHaveProperty('partieId');
      expect(item).not.toHaveProperty('partieName');
      expect(item).not.toHaveProperty('derived');
    });

    it('un Homme Dragon sans aventure reste visible, avec aventures: [] ; avatar omis quand absent', async () => {
      prisma.hommeDragon.findMany.mockResolvedValue([{ ...makeHommeDragon(), parties: [] }]);

      const [item] = await service.findMine('mj1');

      expect(item.aventures).toEqual([]);
      expect(item).not.toHaveProperty('avatar');
    });

    it('plusieurs Hommes Dragons → un tableau, une ligne par Homme Dragon', async () => {
      prisma.hommeDragon.findMany.mockResolvedValue([
        { ...makeHommeDragon({ id: 'hd1' }), parties: [{ id: 'p1', name: 'A' }] },
        { ...makeHommeDragon({ id: 'hd2' }), parties: [] },
      ]);

      const result = await service.findMine('mj1');

      expect(result.map((r) => r.id)).toEqual(['hd1', 'hd2']);
    });
  });

  describe('bloc dérivé unique : aventures, historique, niveau (AD-3, AD-23)', () => {
    const member = (userId: string) => ({ userId, pseudo: userId, displayName: `Nom ${userId}` });

    it('aventures triées par la lecture (createdAt puis id), voyageurs { userId, pseudo, displayName } par aventure', async () => {
      arrange({
        aventures: [
          { id: 'p1', name: 'Les Vents du Nord' },
          { id: 'p2', name: "L'Archipel" },
        ],
        members: { p1: [member('alice'), member('bob')], p2: [member('alice')] },
      });

      const dto = await service.findOne('hd1', 'mj1');

      expect(prisma.partie.findMany).toHaveBeenCalledWith({
        where: { hommeDragonId: 'hd1' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true },
      });
      expect(dto.aventures).toEqual([
        {
          partieId: 'p1',
          nom: 'Les Vents du Nord',
          voyageurs: [
            { userId: 'alice', pseudo: 'alice', displayName: 'Nom alice' },
            { userId: 'bob', pseudo: 'bob', displayName: 'Nom bob' },
          ],
        },
        {
          partieId: 'p2',
          nom: "L'Archipel",
          voyageurs: [{ userId: 'alice', pseudo: 'alice', displayName: 'Nom alice' }],
        },
      ]);
    });

    it('une aventure sans membre → voyageurs: []', async () => {
      arrange({ aventures: [{ id: 'p1', name: 'Solo' }] });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.aventures[0].voyageurs).toEqual([]);
    });

    it('UNE lecture en lot pour toutes les aventures — jamais une boucle par partie', async () => {
      arrange({
        aventures: [
          { id: 'p1', name: 'A' },
          { id: 'p2', name: 'B' },
          { id: 'p3', name: 'C' },
        ],
      });

      await service.findOne('hd1', 'mj1');

      expect(scenarios.findPasseForParties).toHaveBeenCalledTimes(1);
      expect(scenarios.findPasseForParties).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
    });

    it('historique cumulé sur toutes les aventures, chaque entrée portant sa partieId, ordre de la lecture en lot conservé', async () => {
      arrange({
        aventures: [
          { id: 'p1', name: 'A' },
          { id: 'p2', name: 'B' },
        ],
        scenarios: [
          makePasse(0, 'p2', {
            id: 's-a',
            title: 'Premier',
            closedAt: '2026-01-01T00:00:00.000Z',
            participants: [member('carla')],
          }),
          makePasse(1, 'p1', {
            id: 's-b',
            title: 'Second',
            closedAt: '2026-01-02T00:00:00.000Z',
            participants: [member('alice'), member('bob')],
          }),
        ],
      });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.historique).toEqual([
        {
          scenarioTitle: 'Premier',
          date: '2026-01-01T00:00:00.000Z',
          participants: ['carla'],
          partieId: 'p2',
        },
        {
          scenarioTitle: 'Second',
          date: '2026-01-02T00:00:00.000Z',
          participants: ['alice', 'bob'],
          partieId: 'p1',
        },
      ]);
    });

    it('niveau atteint PAR CUMUL : 1 + 11 scénarios PASSE sur deux aventures → niveau 5 (aucune aventure seule n’y arrive)', async () => {
      const passes = [
        makePasse(0, 'p1'),
        ...Array.from({ length: 11 }, (_, i) => makePasse(i, 'p2')),
      ];
      arrange({
        aventures: [
          { id: 'p1', name: 'La Route des Lanternes' },
          { id: 'p2', name: 'Les Annales de Brume' },
        ],
        scenarios: passes,
      });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.historique).toHaveLength(12);
      expect(dto.derived).toEqual({ level: 5, PS: 10 });
    });

    it('aucun scénario PASSE → historique vide, niveau 1, PS 3', async () => {
      arrange();

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.historique).toEqual([]);
      expect(dto.derived).toEqual({ level: 1, PS: 3 });
    });

    it('éveils en attente : niveau 2 sans eveilPowers → [2] ; plusieurs seuils franchis → tous les niveaux manquants', async () => {
      arrange({ passeCount: 1 });
      expect((await service.findOne('hd1', 'mj1')).pendingEveilLevels).toEqual([2]);

      arrange({ passeCount: 12 });
      expect((await service.findOne('hd1', 'mj1')).pendingEveilLevels).toEqual([2, 3, 4, 5]);
    });

    it('éveil déjà choisi pour le niveau atteint → rien en attente ; eveilPowers miroir de sheetData', async () => {
      arrange({
        passeCount: 1,
        sheetData: {
          race: 'DRAGON_ROUGE',
          artefact: { key: 'grand-arc' },
          nom: 'Ignis',
          eveilPowers: [{ level: 2, key: 'escorte-du-dragon' }],
        },
      });

      const dto = await service.findOne('hd1', 'mj1');

      expect(dto.pendingEveilLevels).toEqual([]);
      expect(dto.eveilPowers).toEqual([{ level: 2, key: 'escorte-du-dragon' }]);
    });

    it('create/update/link/unlink retournent le même bloc dérivé que findOne', async () => {
      arrange({ passeCount: 3, aventures: [{ id: 'p1', name: 'A' }] });
      permissions.assert.mockResolvedValue(testGrant({ ...PARTIE_RYUUTAMA, hommeDragonId: 'hd1' }));
      prisma.tx.partie.updateMany.mockResolvedValue({ count: 1 });

      const fromUpdate = await service.update('hd1', 'mj1', { nom: 'Pyros' });
      const fromLink = await service.link('p1', 'hd1', 'mj1');
      const fromUnlink = await service.unlink('p1', 'hd1', 'mj1');

      for (const dto of [fromUpdate, fromLink, fromUnlink]) {
        expect(dto.derived.level).toBe(3);
        expect(dto.aventures.map((a) => a.partieId)).toEqual(['p1']);
        expect(dto.historique).toHaveLength(3);
      }
    });
  });
});
