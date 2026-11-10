// `@master-jdr/game-rules` RÉEL (pas de jest.mock) : les règles de la réserve (capacité, souffles
// du temps, autre race, rituels) sont l'objet même de ces tests — les mocker ne prouverait rien.
// Le catalogue est celui seedé en base (`game-systems/ryuutama/data`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HommeDragonService } from './homme-dragon.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { GameSystemService } from '../game-systems/game-system.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { objectLike } from '../common/test-utils/jest-typed';

const DATA_DIR = join(process.cwd(), 'game-systems/ryuutama/data');
const readCatalogue = (file: string) =>
  (JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as { key: string }[]).map((data) => ({
    key: data.key,
    data,
  }));

const CONTENT = {
  hommeDragonArtefact: readCatalogue('homme-dragon-artefacts.json'),
  eveilPower: readCatalogue('eveil-powers.json'),
  souffle: readCatalogue('souffles.json'),
  souffleRituel: readCatalogue('souffles-rituels.json'),
};

// 1 scénario PASSE = niveau 2, 3 = niveau 3, 7 = niveau 4, 12 = niveau 5.
const SCENARIOS_FOR_LEVEL: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 12 };

function makeRow(sheetData: Record<string, unknown> = {}) {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis', ...sheetData },
    createdAt: new Date('2026-07-16T00:00:00.000Z'),
    updatedAt: new Date('2026-07-16T00:00:00.000Z'),
  };
}

describe('HommeDragonService.setReserveSlot() (Story 33.6, AD-23, règles réelles)', () => {
  let service: HommeDragonService;
  const tx = {
    $queryRaw: jest.fn(),
    hommeDragon: { findFirst: jest.fn(), update: jest.fn() },
    scenario: { count: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    partie: { findMany: jest.fn() },
  };
  const parties = { notifyPartieSignalsChanged: jest.fn() };
  const permissions = { assert: jest.fn() };
  const gameSystems = { getContent: jest.fn() };
  const scenarios = { findPasseForParties: jest.fn() };
  const realtimeEvents = { emit: jest.fn() };

  /** Dragon rouge au niveau demandé, avec la réserve stockée donnée. */
  function arrange(level: number, reserve?: (string | null)[]) {
    // Niveau calculé sous le verrou (comptage dans la transaction) puis relu pour le DTO (lecture
    // en lot) : les deux racontent la même histoire.
    const passe = SCENARIOS_FOR_LEVEL[level];
    tx.scenario.count.mockResolvedValue(passe);
    prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'Aventure' }]);
    scenarios.findPasseForParties.mockResolvedValue({
      scenarios: Array.from({ length: passe }, (_, i) => ({
        id: `s${i}`,
        partieId: 'p1',
        title: `Scénario ${i}`,
        closedAt: '2026-07-10T00:00:00.000Z',
        participants: [],
      })),
      membersByPartie: new Map(),
    });
    const row = makeRow(reserve ? { reserve } : {});
    tx.hommeDragon.findFirst.mockResolvedValue(row);
    tx.hommeDragon.update.mockImplementation(({ data }: { data: { sheetData: object } }) =>
      Promise.resolve({ ...row, sheetData: data.sheetData }),
    );
    return row;
  }

  const written = () =>
    (tx.hommeDragon.update.mock.calls[0] as [{ data: { sheetData: { reserve: unknown } } }])[0].data
      .sheetData.reserve;

  beforeEach(async () => {
    jest.clearAllMocks();
    gameSystems.getContent.mockResolvedValue(CONTENT);
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

  it('place un souffle valide : verrou de ligne, écriture, émission, DTO avec la réserve', async () => {
    arrange(4);

    const dto = await service.setReserveSlot('hd1', 'mj1', 1, { key: 'courage' });

    // Fiche adressée par son id, jamais par une partie (AD-23) : aucune décision de droit de partie.
    expect(permissions.assert).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.hommeDragon.findFirst).toHaveBeenCalledWith({ where: { id: 'hd1', userId: 'mj1' } });
    expect(tx.hommeDragon.update).toHaveBeenCalledWith({
      where: { id: 'hd1' },
      data: { sheetData: objectLike({ nom: 'Ignis', reserve: ['courage'] }) },
    });
    // Une écriture de fiche n'émet rien (AD-23) : le client se met à jour avec la réponse.
    expect(realtimeEvents.emit).not.toHaveBeenCalled();
    expect(parties.notifyPartieSignalsChanged).not.toHaveBeenCalled();
    expect(dto.sheetData.reserve).toEqual(['courage']);
    expect(dto.derived.level).toBe(4);
  });

  it('applique le geste à la liste lue sous verrou : les autres emplacements sont conservés', async () => {
    arrange(4, ['courage', null, 'chance']);

    await service.setReserveSlot('hd1', 'mj1', 2, { key: 'defi' });

    expect(written()).toEqual(['courage', 'defi', 'chance']);
  });

  it('remplit les emplacements intermédiaires par null (positionnel)', async () => {
    arrange(4);

    await service.setReserveSlot('hd1', 'mj1', 3, { key: 'chance' });

    expect(written()).toEqual([null, null, 'chance']);
  });

  it('retire un souffle avec { key: null }', async () => {
    arrange(4, ['courage', 'chance']);

    await service.setReserveSlot('hd1', 'mj1', 1, { key: null });

    expect(written()).toEqual([null, 'chance']);
  });

  it("retirer au-delà de la fin de la liste n'allonge pas la réserve", async () => {
    arrange(4, ['courage']);

    await service.setReserveSlot('hd1', 'mj1', 3, { key: null });

    expect(written()).toEqual(['courage']);
  });

  it('un même souffle commun ou de la race peut occuper plusieurs emplacements', async () => {
    arrange(4, ['courage', 'chance']);

    await service.setReserveSlot('hd1', 'mj1', 3, { key: 'courage' });

    expect(written()).toEqual(['courage', 'chance', 'courage']);
  });

  it("ne mute jamais l'objet sheetData lu (copie)", async () => {
    const row = arrange(4, ['courage']);
    const originalReserve = (row.sheetData as unknown as { reserve: string[] }).reserve;

    await service.setReserveSlot('hd1', 'mj1', 2, { key: 'chance' });

    expect(originalReserve).toEqual(['courage']);
  });

  it('montée de niveau : la réserve existante est conservée, le nouvel emplacement est vide', async () => {
    arrange(5, ['courage', 'chance']);

    const dto = await service.setReserveSlot('hd1', 'mj1', 1, { key: 'defi' });

    expect(dto.derived.level).toBe(5);
    expect(dto.sheetData.reserve).toEqual(['defi', 'chance']);
  });

  describe('refus (400, rien écrit, rien émis)', () => {
    async function expectRejected(slot: number, key: string | null) {
      await expect(service.setReserveSlot('hd1', 'mj1', slot, { key })).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.hommeDragon.update).not.toHaveBeenCalled();
      expect(realtimeEvents.emit).not.toHaveBeenCalled();
    }

    it('niveau 1 : tout ajout refusé', async () => {
      arrange(1);
      await expectRejected(1, 'chance');
    });

    it('emplacement au-delà de la capacité (niveau 2 : un seul emplacement)', async () => {
      arrange(2);
      await expectRejected(2, 'chance');
    });

    it.each([0, -1, 5, 1.5, Number.NaN])('numéro d’emplacement invalide : %s', async (slot) => {
      arrange(5);
      await expectRejected(slot, 'chance');
    });

    it('souffle du temps (Passé, Futur)', async () => {
      arrange(5);
      await expectRejected(1, 'passe');
      await expectRejected(1, 'futur');
    });

    it('clé inconnue nouvellement placée', async () => {
      arrange(5);
      await expectRejected(1, 'souffle-fantome');
    });

    it('souffle d’une autre race au niveau 2', async () => {
      arrange(2);
      await expectRejected(1, 'nostalgie');
    });

    it('niveau 3+ : un deuxième souffle d’une autre race', async () => {
      arrange(3, ['nostalgie', null]);
      await expectRejected(2, 'amour');
    });

    it('niveau 3+ : le même souffle d’une autre race une seconde fois', async () => {
      arrange(3, ['nostalgie', null]);
      await expectRejected(2, 'nostalgie');
    });

    it('rituel au niveau 4', async () => {
      arrange(4);
      await expectRejected(1, 'rituel-du-tabou');
    });
  });

  it('niveau 3 : un souffle d’une autre race est accepté (sur un seul emplacement)', async () => {
    arrange(3);

    await service.setReserveSlot('hd1', 'mj1', 1, { key: 'nostalgie' });

    expect(written()).toEqual(['nostalgie']);
  });

  it('niveau 3+ : changer le souffle d’une autre race sur son propre emplacement reste possible', async () => {
    arrange(3, ['nostalgie', null]);

    await service.setReserveSlot('hd1', 'mj1', 1, { key: 'amour' });

    expect(written()).toEqual(['amour', null]);
  });

  it('niveau 5 : un rituel est accepté et ne compte pas comme « autre race »', async () => {
    arrange(5, ['nostalgie', null, null, null]);

    await service.setReserveSlot('hd1', 'mj1', 2, { key: 'rituel-du-tabou' });

    expect(written()).toEqual(['nostalgie', 'rituel-du-tabou', null, null]);
  });

  it('souffle retiré du catalogue déjà présent : toléré, retirable, « Changer » possible', async () => {
    arrange(4, ['souffle-fantome', null, null]);
    await service.setReserveSlot('hd1', 'mj1', 2, { key: 'chance' });
    expect(written()).toEqual(['souffle-fantome', 'chance', null]);

    jest.clearAllMocks();
    arrange(4, ['souffle-fantome', null, null]);
    await service.setReserveSlot('hd1', 'mj1', 1, { key: null });
    expect(written()).toEqual([null, null, null]);

    jest.clearAllMocks();
    arrange(4, ['souffle-fantome', null, null]);
    await service.setReserveSlot('hd1', 'mj1', 1, { key: 'courage' });
    expect(written()).toEqual(['courage', null, null]);
  });

  it('baisse de niveau : aucune purge du surplus, le retrait du surplus reste possible', async () => {
    // Réserve de 3 emplacements stockée, niveau actuel 3 (capacité 2).
    arrange(3, ['courage', 'chance', 'defi']);
    await service.setReserveSlot('hd1', 'mj1', 3, { key: null });
    expect(written()).toEqual(['courage', 'chance', null]);

    // Une autre écriture légitime ne purge pas le surplus.
    jest.clearAllMocks();
    arrange(3, ['courage', 'chance', 'defi']);
    await service.setReserveSlot('hd1', 'mj1', 1, { key: 'chance' });
    expect(written()).toEqual(['chance', 'chance', 'defi']);
  });

  it('retrait permis à tout niveau, y compris 1 : la réserve conservée au-dessus du niveau reste retirable', async () => {
    arrange(1, ['courage', 'chance']);

    await service.setReserveSlot('hd1', 'mj1', 1, { key: null });

    expect(written()).toEqual([null, 'chance']);
  });

  it('niveau 1 : le contenu conservé est affiché tel quel, jamais purgé par un retrait voisin', async () => {
    arrange(1, ['courage', 'chance']);

    const dto = await service.setReserveSlot('hd1', 'mj1', 2, { key: null });

    expect(dto.derived.level).toBe(1);
    expect(dto.sheetData.reserve).toEqual(['courage', null]);
  });

  it("Homme Dragon absent ou d'un autre propriétaire → NotFoundException identique, rien écrit", async () => {
    arrange(4);
    tx.hommeDragon.findFirst.mockResolvedValue(null);

    await expect(service.setReserveSlot('hd1', 'stranger', 1, { key: 'chance' })).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.hommeDragon.findFirst).toHaveBeenCalledWith({
      where: { id: 'hd1', userId: 'stranger' },
    });
    expect(tx.hommeDragon.update).not.toHaveBeenCalled();
    expect(realtimeEvents.emit).not.toHaveBeenCalled();
  });

  it('le niveau est calculé sous le verrou, dans la transaction (jamais avant)', async () => {
    arrange(4);
    const order: string[] = [];
    tx.$queryRaw.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve([]);
    });
    tx.scenario.count.mockImplementation(() => {
      order.push('niveau');
      return Promise.resolve(7);
    });

    await service.setReserveSlot('hd1', 'mj1', 1, { key: 'courage' });

    expect(order).toEqual(['lock', 'niveau']);
  });
});
