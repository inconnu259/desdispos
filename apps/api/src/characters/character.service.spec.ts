import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

jest.mock('@master-jdr/game-rules', () => ({
  validate: jest.fn(),
  computeDerived: jest.fn(),
  levelForXp: jest.fn((xp: number) => (xp >= 100 ? 2 : 1)),
  pendingLevels: jest.fn(),
  // Story 26.1 : par défaut, sélection vide résolue sans achat (déjà le cas pour la quasi-totalité
  // des tests existants, qui n'exercent pas ce chemin) — chaque test dédié au budget/équipement
  // fournit sa propre implémentation via `mockReturnValue`/`mockImplementation`.
  resolveStartingEquipment: jest.fn(() => ({
    individual: [],
    contenants: [],
    animaux: [],
    totalPriceGold: 0,
    unresolvedKeys: [],
  })),
  LEVEL_TABLE: [
    { level: 2, xp: 100, capabilities: ['attribute'] },
    { level: 3, xp: 600, capabilities: ['landscape'] },
    { level: 4, xp: 1200, capabilities: ['attribute', 'immunity'] },
  ],
}));

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-image-bytes')),
}));

jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, randomUUID: jest.fn(() => 'fixed-uuid') };
});

// Mock partiel : detectImageMime/extensionForImageMime/etc. restent réels (fonctions pures,
// sans effet de bord), seule stripImageMetadata est mockée. Un vrai sharp() sur JPEG_BUFFER
// (signature magique seule, non décodable) ferait échouer tous les tests updatePortrait()
// existants — cf. Story 16.2 Dev Notes.
//
// Story 29.12 (AD-17) : chemin mis à jour vers l'utilitaire extrait (`common/image-upload.util`),
// après suppression de `./image-mime.util`. C'est CE mock qui devenait inopérant sans bruit si le
// chemin n'était pas répercuté (AC7) — cf. le test dédié « le mock mocke encore » ci-dessous, qui
// échouerait si `jest.mock` ci-dessous ne s'appliquait plus à rien.
jest.mock('../common/image-upload.util', () => ({
  ...jest.requireActual<typeof import('../common/image-upload.util')>(
    '../common/image-upload.util',
  ),
  stripImageMetadata: jest.fn(),
}));

import { Prisma } from '@prisma/client';
import {
  validate,
  computeDerived,
  pendingLevels,
  resolveStartingEquipment,
} from '@master-jdr/game-rules';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { stripImageMetadata } from '../common/image-upload.util';
import { CharacterService } from './character.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { PermissionService } from '../permissions/permission.service';
import { UsersService } from '../users/users.service';
import { GameSystemService } from '../game-systems/game-system.service';
import { EmailService } from '../email/email.service';
import { RealtimeEventsService, partieTopic } from '../realtime/realtime-events.service';
import { anyOf, arrayLike, callArg, objectLike } from '../common/test-utils/jest-typed';
import { grantByOwner } from '../common/test-utils/grant';

/**
 * Fiche telle que les assertions la relisent après écriture. Les sous-objets sont déclarés
 * présents : chaque test vient de provoquer précisément l'écriture qu'il vérifie. C'est un type
 * de test, jamais le contrat — celui-ci reste `RyuutamaSheetData` côté game-rules.
 */
type WrittenSheet = {
  attributes: Record<string, number>;
  equipment: {
    individual: Record<string, unknown>[];
    contenants: Record<string, unknown>[];
    animaux: Record<string, unknown>[];
  };
  narrative: Record<string, unknown>;
  levelUps: { capabilities: unknown[] }[];
  [key: string]: unknown;
};

/** `data` du dernier appel enregistré par un mock d'écriture Prisma, fiche relue typée. */
function writtenData(mock: jest.Mock): { sheetData: WrittenSheet } {
  return callArg<{ data: { sheetData: WrittenSheet } }>(mock).data;
}

/** Nom de fichier légitime généré côté serveur (`randomUUID()` + extension) — cf. `image-mime.util.ts`. */
const OLD_PORTRAIT_UUID = '11111111-1111-1111-1111-111111111111';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function makeMulterFile(buffer: Buffer = JPEG_BUFFER): Express.Multer.File {
  return {
    buffer,
    originalname: 'portrait.jpg',
    mimetype: 'image/jpeg',
    size: buffer.length,
  } as Express.Multer.File;
}

/**
 * Mock construit sans annotation `: any` : l'inference donne un vrai type aux modeles et a leurs
 * `jest.fn()`, ce qui type les assertions au lieu de les laisser passer en aveugle.
 */
function makePrisma() {
  const models = {
    character: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    characterSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    characterNote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    partie: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    characterGroupRole: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    scenario: {
      findUnique: jest.fn(),
    },
    scenarioParticipant: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Story 31.6 : défaut « rien de verrouillé » (Partie neuve, cf. I/O Matrix du spec) — les
    // tests dédiés au cadenas de visibilité reconfigurent explicitement ce mock.
    partieVisibilityLock: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  // Le client transactionnel réutilise les mêmes mocks (updateMany/snapshot.create) que le client
  // racine — suffisant pour asserter les appels ; le rollback réel n'est pas testé ici.
  // Construit en deux temps : `$transaction` doit référencer les modèles qui l'accompagnent, ce
  // qu'un littéral unique ne permet pas sans retomber sur `any`.
  return {
    ...models,
    $transaction: jest.fn(async (cb: (tx: typeof models) => unknown) => await cb(models)),
  };
}

/** Story 37.7 : les droits (et le rôle de l'appelant) sont décidés par `PermissionService`, simulé ici. */
function makePermissions() {
  return { assert: jest.fn(), roleOf: jest.fn(), rolesOf: jest.fn() };
}

/** Rôle simulé : `ownerId` est le MJ de la partie, tout autre utilisateur y est joueur. */
function roleOwnedBy(ownerId: string) {
  return (_partieId: string, userId: string) =>
    Promise.resolve(userId === ownerId ? 'mj' : 'player');
}

function makePartiesService() {
  return {
    notifyPartieSignalsChanged: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUsersService() {
  return {
    findById: jest.fn(),
  };
}

function makeEmailService() {
  return {
    sendMail: jest.fn().mockResolvedValue({ ok: true }),
  };
}

function makeRealtimeEvents() {
  return { emit: jest.fn() };
}

function makeGameSystemService() {
  return {
    getContent: jest.fn().mockResolvedValue({
      class: [{ key: 'chasseur', data: {} }],
      type: [{ key: 'attaque', data: {} }],
      weaponCategory: [{ key: 'arc', data: {} }],
      weaponItem: [{ key: 'arc-de-chasse', data: { categoryId: 'arc' } }],
      attributePattern: [{ key: 'polyvalent', data: { values: [8, 4, 6, 6] } }],
      equipmentItem: [
        {
          key: 'rations',
          data: {
            label: 'Rations',
            priceGold: 10,
            nature: 'individual',
            weight: 1,
          },
        },
      ],
    }),
  };
}

function validSheet() {
  return {
    classId: 'chasseur',
    typeId: 'attaque',
    weaponId: 'arc-de-chasse',
    attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
  };
}

function makeCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    sheetData: validSheet(),
    derived: {
      PV: 16,
      PE: 12,
      Condition: 14,
      Initiative: 10,
      Encombrement: 11,
    },
    portraitUrl: null,
    portraitCropData: null,
    xp: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CharacterService', () => {
  let service: CharacterService;
  let prisma: ReturnType<typeof makePrisma>;
  let parties: ReturnType<typeof makePartiesService>;
  let permissions: ReturnType<typeof makePermissions>;
  let users: ReturnType<typeof makeUsersService>;
  let gameSystems: ReturnType<typeof makeGameSystemService>;
  let email: ReturnType<typeof makeEmailService>;
  let realtimeEvents: ReturnType<typeof makeRealtimeEvents>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    parties = makePartiesService();
    permissions = makePermissions();
    users = makeUsersService();
    gameSystems = makeGameSystemService();
    email = makeEmailService();
    realtimeEvents = makeRealtimeEvents();
    // Défauts neutres : la plupart des tests ne portent pas sur ownerPseudo/ownerIsMj.
    users.findById.mockResolvedValue({
      id: 'default',
      pseudo: 'default-pseudo',
      email: 'default@example.com',
    });
    permissions.roleOf.mockImplementation(roleOwnedBy('mj-default'));
    permissions.rolesOf.mockResolvedValue(new Map());
    (pendingLevels as jest.Mock).mockReturnValue([]);
    // `jest.clearAllMocks()` ne réinitialise pas l'implémentation posée par un `mockReturnValue()`
    // d'un test précédent (seulement `mock.calls`/`mock.results`) — sans ce reset explicite, un
    // test qui override `resolveStartingEquipment` (ex. clé inconnue) polluerait tous les tests
    // suivants qui ne s'attendent pas à un `startingEquipment` non vide.
    (resolveStartingEquipment as jest.Mock).mockReturnValue({
      individual: [],
      contenants: [],
      animaux: [],
      totalPriceGold: 0,
      unresolvedKeys: [],
    });
    // Défaut passthrough : la plupart des tests updatePortrait() ne portent pas sur le
    // nettoyage EXIF lui-même — sans ce défaut, JPEG_BUFFER (magic bytes seuls) résoudrait
    // `undefined` (jest.fn() nu), cassant l'assertion writeFile(..., JPEG_BUFFER).
    (stripImageMetadata as jest.Mock).mockImplementation((buf: Buffer) => Promise.resolve(buf));
    const module = await Test.createTestingModule({
      providers: [
        CharacterService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartiesService, useValue: parties },
        { provide: PermissionService, useValue: permissions },
        { provide: UsersService, useValue: users },
        { provide: GameSystemService, useValue: gameSystems },
        { provide: EmailService, useValue: email },
        { provide: RealtimeEventsService, useValue: realtimeEvents },
      ],
    }).compile();
    service = module.get(CharacterService);
  });

  it('create() sheetData valide → prisma.character.create appelé avec derived calculé', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    const derived = {
      PV: 16,
      PE: 12,
      Condition: 14,
      Initiative: 10,
      Encombrement: 11,
    };
    (computeDerived as jest.Mock).mockReturnValue(derived);
    prisma.character.create.mockResolvedValue(makeCharacter({ derived }));

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(prisma.character.create).toHaveBeenCalledWith(
      objectLike({
        data: objectLike({
          gameSystemId: 'ryuutama',
          userId: 'u1',
          partieId: 'p1',
          derived,
        }),
      }),
    );
  });

  it('create() → émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
  });

  it('create() → notifie aussi PartiesService.notifyPartieSignalsChanged (Story 29.7, AD-14, signal PERSONNAGE_A_CREER)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(parties.notifyPartieSignalsChanged).toHaveBeenCalledWith('p1', 'mj1');
  });

  it('create() gameSystemId non supporté → BadRequestException, validate/computeDerived non appelés', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );

    await expect(
      service.create('p1', 'u1', {
        gameSystemId: 'conte-de-minuit',
        sheetData: validSheet(),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(validate).not.toHaveBeenCalled();
    expect(computeDerived).not.toHaveBeenCalled();
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() gameSystemId ralliement (sans capacité `characters`, Story 37.5) → refus, message existant', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );

    const promise = service.create('p1', 'u1', {
      gameSystemId: 'ralliement',
      sheetData: validSheet(),
    });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow('Système de jeu non supporté : ralliement');
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() vérifie CHARACTER_CREATE sur la partie visée (rôle et capacité décidés par le service de permission)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', { gameSystemId: 'ryuutama', sheetData: validSheet() });

    expect(permissions.assert).toHaveBeenCalledWith('u1', 'CHARACTER_CREATE', { partieId: 'p1' });
  });

  it('create() partie dont le système n’a pas la capacité characters → refus du service de permission propagé, aucune écriture', async () => {
    permissions.assert.mockRejectedValue(new BadRequestException('capacité indisponible'));

    await expect(
      service.create('p1', 'u1', { gameSystemId: 'ryuutama', sheetData: validSheet() }),
    ).rejects.toThrow('capacité indisponible');
    expect(validate).not.toHaveBeenCalled();
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() gameSystemId différent de celui de la partie → 400 « Système de jeu non supporté », aucune écriture', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'autre-systeme' }),
    );

    const promise = service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });
    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow('Système de jeu non supporté : ryuutama');
    expect(validate).not.toHaveBeenCalled();
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() sheetData avec customWeapon (arme libre, Story 25.2) → prisma.character.create appelé (délègue l’exclusivité mutuelle à validate())', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    const sheetData = {
      ...validSheet(),
      weaponId: undefined,
      customWeapon: { name: 'Fléau maison', categoryId: 'arc' },
    };
    prisma.character.create.mockResolvedValue(makeCharacter({ sheetData }));

    await service.create('p1', 'u1', { gameSystemId: 'ryuutama', sheetData });

    expect(prisma.character.create).toHaveBeenCalledWith(
      objectLike({ data: objectLike({ sheetData }) }),
    );
  });

  describe('create() — revue de sécurité : sheetData filtré', () => {
    beforeEach(() => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (computeDerived as jest.Mock).mockReturnValue({});
      prisma.character.create.mockResolvedValue(makeCharacter());
    });

    it('retire les levelUps et toute clé inconnue avant écriture', async () => {
      await service.create('p1', 'u1', {
        gameSystemId: 'ryuutama',
        sheetData: {
          ...validSheet(),
          levelUps: [{ level: 2, pvAllocated: 3, peAllocated: 0, capabilities: [] }],
          xp: 99999,
          pirate: { bombe: true },
        },
      });

      const written = writtenData(prisma.character.create) as unknown as Record<string, unknown>;
      expect(written.sheetData).not.toHaveProperty('levelUps');
      expect(written.sheetData).not.toHaveProperty('xp');
      expect(written.sheetData).not.toHaveProperty('pirate');
      expect(written.sheetData).toMatchObject(validSheet());
    });

    it.each([
      ['texte narratif trop long', { narrative: { motivation: 'x'.repeat(5001) } }],
      ['champ narratif non textuel', { narrative: { motivation: { a: 1 } } }],
      ['champ narratif inconnu', { narrative: { secret: 'x' } }],
      ['objet fétiche géant', { fetiqueObject: 'x'.repeat(501) }],
    ])('refuse (400) : %s', async (_label, extra) => {
      await expect(
        service.create('p1', 'u1', {
          gameSystemId: 'ryuutama',
          sheetData: { ...validSheet(), ...extra },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.character.create).not.toHaveBeenCalled();
    });
  });

  describe('startingEquipment (Story 26.1)', () => {
    it('sélection valide, total ≤ 1000 Po → personnage créé, equipment.* peuplé avec id/addedBy serveur, startingEquipment absent du sheetData persisté', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (computeDerived as jest.Mock).mockReturnValue({});
      (resolveStartingEquipment as jest.Mock).mockReturnValue({
        individual: [{ name: 'Rations', weight: 1, price: '10 Po' }],
        contenants: [],
        animaux: [],
        totalPriceGold: 20,
        unresolvedKeys: [],
      });
      prisma.character.create.mockResolvedValue(makeCharacter());

      await service.create('p1', 'u1', {
        gameSystemId: 'ryuutama',
        sheetData: {
          ...validSheet(),
          startingEquipment: [{ key: 'rations', quantity: 2 }],
        },
      });

      expect(resolveStartingEquipment).toHaveBeenCalledWith(
        [{ key: 'rations', quantity: 2 }],
        arrayLike([
          objectLike({
            key: 'rations',
            priceGold: 10,
            nature: 'individual',
          }),
        ]),
      );
      const created = writtenData(prisma.character.create).sheetData;
      expect(created.equipment.individual).toEqual([
        {
          name: 'Rations',
          weight: 1,
          price: '10 Po',
          id: 'fixed-uuid',
          addedBy: 'player',
        },
      ]);
      expect(created.startingEquipment).toBeUndefined();
    });

    it('total > 1000 Po → BadRequestException, prisma.character.create non appelé', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      (resolveStartingEquipment as jest.Mock).mockReturnValue({
        individual: [],
        contenants: [],
        animaux: [{ name: 'Monture (grande)', price: '3800 Po' }],
        totalPriceGold: 3800,
        unresolvedKeys: [],
      });

      await expect(
        service.create('p1', 'u1', {
          gameSystemId: 'ryuutama',
          sheetData: {
            ...validSheet(),
            startingEquipment: [{ key: 'monture-grande', quantity: 1 }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.create).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
    });

    it('revue de code (2026-07-29) : startingEquipment non-tableau (objet direct API) → BadRequestException, resolveStartingEquipment jamais appelé avec une valeur non-itérable', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.create('p1', 'u1', {
          gameSystemId: 'ryuutama',
          sheetData: {
            ...validSheet(),
            startingEquipment: { key: 'rations', quantity: 1 } as any,
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('clé de sélection inconnue du catalogue → BadRequestException, prisma.character.create non appelé', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      (resolveStartingEquipment as jest.Mock).mockReturnValue({
        individual: [],
        contenants: [],
        animaux: [],
        totalPriceGold: 0,
        unresolvedKeys: ['clef-inexistante'],
      });

      await expect(
        service.create('p1', 'u1', {
          gameSystemId: 'ryuutama',
          sheetData: {
            ...validSheet(),
            startingEquipment: [{ key: 'clef-inexistante', quantity: 1 }],
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('setSheetField() modifiant equipment.* après création → aucun appel à resolveStartingEquipment (AC6, budget jamais revérifié en édition MJ)', async () => {
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (computeDerived as jest.Mock).mockReturnValue({});
      const character = makeCharacter();
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);
      (resolveStartingEquipment as jest.Mock).mockClear();

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.individual.0',
        value: { name: 'Fléau maison', weight: 1 },
      });

      expect(resolveStartingEquipment).not.toHaveBeenCalled();
    });
  });

  it('create() sheetData avec weaponId ET customWeapon simultanés (Story 25.2, revue de code) → BadRequestException, prisma.character.create non appelé', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({
      valid: false,
      errors: [
        {
          field: 'weaponId',
          message:
            'Une seule arme doit être renseignée : choisie dans le catalogue ou libre, jamais les deux',
        },
      ],
    });
    const sheetData = {
      ...validSheet(),
      customWeapon: { name: 'Fléau maison', categoryId: 'arc' },
    };

    await expect(
      service.create('p1', 'u1', { gameSystemId: 'ryuutama', sheetData }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() sheetData invalide → BadRequestException, prisma.character.create non appelé', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({
      valid: false,
      errors: [{ field: 'classId', message: 'Classe invalide' }],
    });

    await expect(
      service.create('p1', 'u1', {
        gameSystemId: 'ryuutama',
        sheetData: { classId: '' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('create() erreur Prisma P2002 → ConflictException avec message spécifique', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create('p1', 'u1', {
        gameSystemId: 'ryuutama',
        sheetData: validSheet(),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('findOne() par le propriétaire → retourne le personnage', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    const result = await service.findOne('char1', 'u1');
    expect(result.id).toBe('char1');
    expect(permissions.assert).not.toHaveBeenCalled();
  });

  it('findOne() par le MJ (non-propriétaire) → retourne le personnage', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    const result = await service.findOne('char1', 'mj1');
    expect(result.id).toBe('char1');
    expect(permissions.assert).toHaveBeenCalledWith('mj1', 'CHARACTER_READ', {
      characterId: 'char1',
    });
  });

  it('findOne() par un joueur membre de la Partie (ni propriétaire ni MJ) → accès autorisé (Story 6.5, prérequis Notes)', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    const result = await service.findOne('char1', 'joueur-tiers');
    expect(result.id).toBe('char1');
    expect(permissions.assert).toHaveBeenCalledWith('joueur-tiers', 'CHARACTER_READ', {
      characterId: 'char1',
    });
  });

  it('findOne() par non-membre → ForbiddenException', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    permissions.assert.mockRejectedValue(new ForbiddenException());
    await expect(service.findOne('char1', 'stranger')).rejects.toThrow(ForbiddenException);
  });

  it('findOne() personnage introuvable → NotFoundException', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    await expect(service.findOne('unknown', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('findOne() résout ownerPseudo, ownerDisplayName et ownerIsMj (propriétaire = joueur)', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    users.findById.mockResolvedValue({
      id: 'u1',
      pseudo: 'alice',
      displayName: 'Alice au pays',
    });
    permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

    const result = await service.findOne('char1', 'u1');

    expect(result.ownerPseudo).toBe('alice');
    expect(result.ownerDisplayName).toBe('Alice au pays');
    expect(result.ownerIsMj).toBe(false);
  });

  it('findOne() résout ownerIsMj=true quand le propriétaire est le MJ de la partie', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'mj1' }));
    users.findById.mockResolvedValue({
      id: 'mj1',
      pseudo: 'le-mj',
      displayName: 'Le Grand MJ',
    });
    permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

    const result = await service.findOne('char1', 'mj1');

    expect(result.ownerPseudo).toBe('le-mj');
    expect(result.ownerDisplayName).toBe('Le Grand MJ');
    expect(result.ownerIsMj).toBe(true);
  });

  it('findOne() par le propriétaire (non-MJ) → viewerIsMj=false', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    users.findById.mockResolvedValue({ id: 'u1', pseudo: 'alice' });
    permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

    const result = await service.findOne('char1', 'u1');

    expect(result.viewerIsMj).toBe(false);
  });

  it('findOne() par le MJ (non-propriétaire) → viewerIsMj=true, distinct de ownerIsMj', async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );

    const result = await service.findOne('char1', 'mj1');

    expect(result.viewerIsMj).toBe(true);
    expect(result.ownerIsMj).toBe(false); // le propriétaire (u1) n'est pas le MJ
  });

  it("findOne() par un fellow player (ni propriétaire ni MJ) → viewerIsMj=false — corrige l'ambiguïté qui rendait la section Historique visible à tort (revue de code Story 6.5)", async () => {
    prisma.character.findUnique.mockResolvedValue(makeCharacter());
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );

    const result = await service.findOne('char1', 'joueur-tiers');

    expect(result.viewerIsMj).toBe(false);
    expect(result.ownerIsMj).toBe(false);
  });

  describe('findOne() — cadenas de visibilité (Story 31.6)', () => {
    it('Partie neuve, aucune configuration : rien de verrouillé, hiddenFields vide', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      const result = await service.findOne('char1', 'joueur-tiers');

      expect(result.hiddenFields).toEqual([]);
      expect((result.sheetData as { classId?: string }).classId).toBe('chasseur');
      expect(result.derived).toEqual(makeCharacter().derived);
    });

    it('clé simple verrouillée (classId) : absente de sheetData, listée dans hiddenFields, reste inchangé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'classId', subField: null },
      ]);

      const result = await service.findOne('char1', 'joueur-tiers');

      expect((result.sheetData as { classId?: string }).classId).toBeUndefined();
      expect(result.hiddenFields).toEqual(['classId']);
      expect((result.sheetData as { typeId?: string }).typeId).toBe('attaque');
      expect(result.derived).toEqual(makeCharacter().derived);
      // AC3 : « absente de la réponse (jamais vide ou nulle) » — pas seulement `undefined` côté
      // objet JS, la clé doit disparaître de la charge JSON réellement envoyée (`JSON.stringify`
      // omet une propriété `undefined`, `Object.hasOwn` la retrouverait pourtant après `delete`).
      expect(JSON.parse(JSON.stringify(result)).sheetData).not.toHaveProperty('classId');
    });

    it('sous-champ verrouillé (attributes.AGI) : derived retiré en entier, seul AGI absent des autres sous-champs', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'attributes', subField: 'AGI' },
      ]);

      const result = await service.findOne('char1', 'joueur-tiers');

      const attributes = (result.sheetData as { attributes?: Record<string, number> }).attributes;
      expect(attributes?.AGI).toBeUndefined();
      expect(attributes?.ESP).toBe(6);
      expect(attributes?.INT).toBe(6);
      expect(attributes?.VIG).toBe(8);
      expect(result.derived).toBeUndefined();
      expect(result.hiddenFields).toEqual(['attributes.AGI', 'derived']);
      // AC3/AC4 : `derived` doit disparaître de la charge JSON, pas juste être `undefined` côté objet.
      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized).not.toHaveProperty('derived');
      expect(serialized.sheetData).not.toHaveProperty(['attributes', 'AGI']);
    });

    it('le propriétaire voit la fiche entière malgré des verrous configurés (mask jamais résolu)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'u1' }));
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'classId', subField: null },
      ]);

      const result = await service.findOne('char1', 'u1');

      expect(result.hiddenFields).toEqual([]);
      expect((result.sheetData as { classId?: string }).classId).toBe('chasseur');
      // Aucune requête DB pour le masque sur le chemin le plus fréquent (revue de code).
      expect(prisma.partieVisibilityLock.findMany).not.toHaveBeenCalled();
    });

    it('le MJ voit la fiche entière malgré des verrous configurés (mask jamais résolu)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'u1' }));
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'classId', subField: null },
      ]);

      const result = await service.findOne('char1', 'mj1');

      expect(result.hiddenFields).toEqual([]);
      expect((result.sheetData as { classId?: string }).classId).toBe('chasseur');
      expect(prisma.partieVisibilityLock.findMany).not.toHaveBeenCalled();
    });
  });

  it('create() utilise validate et computeDerived de @master-jdr/game-rules', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(validate).toHaveBeenCalledWith(
      {
        ...validSheet(),
        equipment: { individual: [], contenants: [], animaux: [] },
      },
      'strict',
      objectLike({
        validClasses: ['chasseur'],
        validTypes: ['attaque'],
        validWeaponItems: ['arc-de-chasse'],
        validWeaponCategories: ['arc'],
        attributePatterns: [[4, 6, 6, 8]],
      }),
    );
    expect(computeDerived).toHaveBeenCalledWith({
      ...validSheet(),
      equipment: { individual: [], contenants: [], animaux: [] },
    });
  });

  it('create() dérive le catalog de validate() du contenu réellement seedé (GameSystemService.getContent)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(gameSystems.getContent).toHaveBeenCalledWith('ryuutama');
  });

  it('create() ignore un attributePattern malformé (values non-numériques) plutôt que de produire un pattern trié n’importe comment', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    gameSystems.getContent.mockResolvedValue({
      class: [{ key: 'chasseur', data: {} }],
      type: [{ key: 'attaque', data: {} }],
      weaponCategory: [{ key: 'arc', data: {} }],
      attributePattern: [
        { key: 'polyvalent', data: { values: [8, 4, 6, 6] } },
        { key: 'corrompu', data: { values: ['8', '4', '6', '6'] } },
      ],
    });
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(validate).toHaveBeenCalledWith(
      {
        ...validSheet(),
        equipment: { individual: [], contenants: [], animaux: [] },
      },
      'strict',
      objectLike({ attributePatterns: [[4, 6, 6, 8]] }),
    );
  });

  it('create() dérive validSeasons/validDebutantRitualSpells du contenu seedé (Story 23.9)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
    );
    gameSystems.getContent.mockResolvedValue({
      class: [{ key: 'chasseur', data: {} }],
      type: [{ key: 'attaque', data: {} }],
      weaponCategory: [{ key: 'arc', data: {} }],
      attributePattern: [{ key: 'polyvalent', data: { values: [8, 4, 6, 6] } }],
      season: [
        { key: 'printemps', data: {} },
        { key: 'ete', data: {} },
      ],
      spell: [
        {
          key: 'benediction-main-rouge',
          data: { magicType: 'rituelle', tier: 'debutant' },
        },
        { key: 'foudre', data: { magicType: 'saison', tier: 'avance' } },
        {
          key: 'ailes-de-libellule',
          data: { magicType: 'rituelle', tier: 'avance' },
        },
      ],
    });
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter());

    await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(validate).toHaveBeenCalledWith(
      {
        ...validSheet(),
        equipment: { individual: [], contenants: [], animaux: [] },
      },
      'strict',
      objectLike({
        validSeasons: ['printemps', 'ete'],
        validDebutantRitualSpells: ['benediction-main-rouge'],
      }),
    );
  });

  it('create() résout ownerPseudo/ownerDisplayName/ownerIsMj du créateur sans requête partie supplémentaire (réutilise le rôle de l’autorisation)', async () => {
    permissions.assert.mockImplementation(
      grantByOwner({ id: 'p1', ownerId: 'u1', gameSystemId: 'ryuutama' }),
    );
    (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (computeDerived as jest.Mock).mockReturnValue({});
    prisma.character.create.mockResolvedValue(makeCharacter({ userId: 'u1' }));
    users.findById.mockResolvedValue({
      id: 'u1',
      pseudo: 'bob',
      displayName: 'Bobby',
    });

    const result = await service.create('p1', 'u1', {
      gameSystemId: 'ryuutama',
      sheetData: validSheet(),
    });

    expect(result.ownerPseudo).toBe('bob');
    expect(result.ownerDisplayName).toBe('Bobby');
    expect(result.ownerIsMj).toBe(true);
    expect(prisma.partie.findUnique).not.toHaveBeenCalled();
    expect(permissions.roleOf).not.toHaveBeenCalled();
  });

  describe('findByPartie()', () => {
    it('MJ → reçoit tous les personnages, avec le bon pseudo/displayName par personnage (une seule requête user.findMany)', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1' }),
        makeCharacter({ id: 'c2', userId: 'u2' }),
        makeCharacter({ id: 'c3', userId: 'mj1' }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', pseudo: 'alice', displayName: 'Alice au pays' },
        { id: 'u2', pseudo: 'bob', displayName: 'Bobby' },
        { id: 'mj1', pseudo: 'le-mj', displayName: 'Le Grand MJ' },
      ]);

      const result = await service.findByPartie('p1', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'CHARACTER_LIST', { partieId: 'p1' });
      expect(prisma.character.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2', 'mj1'] } },
        select: { id: true, pseudo: true, displayName: true },
      });
      expect(result.map((c) => c.ownerPseudo)).toEqual(['alice', 'bob', 'le-mj']);
      expect(result.map((c) => c.ownerDisplayName)).toEqual([
        'Alice au pays',
        'Bobby',
        'Le Grand MJ',
      ]);
      expect(result.map((c) => c.ownerIsMj)).toEqual([false, false, true]);
    });

    it('joueur → reçoit tous les personnages de la Partie (Story 31.5), pas seulement les siens', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1' }),
        makeCharacter({ id: 'c2', userId: 'u2' }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', pseudo: 'alice' },
        { id: 'u2', pseudo: 'bob' },
      ]);

      const result = await service.findByPartie('p1', 'u1');

      expect(prisma.character.findMany).toHaveBeenCalledWith({
        where: { partieId: 'p1' },
      });
      expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it("cadenas de visibilité (Story 31.6) : appliqué à tout personnage d'autrui pour un joueur — y compris celui du MJ — jamais au sien ni à aucun personnage quand le viewer est le MJ", async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'classId', subField: null },
      ]);
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1' }),
        makeCharacter({ id: 'c2', userId: 'u2' }),
        makeCharacter({ id: 'c3', userId: 'mj1' }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', pseudo: 'alice' },
        { id: 'u2', pseudo: 'bob' },
        { id: 'mj1', pseudo: 'le-mj' },
      ]);

      const asOwner = await service.findByPartie('p1', 'u1');
      const byId = new Map(asOwner.map((c) => [c.id, c]));

      // Son propre personnage : jamais masqué.
      expect((byId.get('c1')!.sheetData as { classId?: string }).classId).toBe('chasseur');
      expect(byId.get('c1')!.hiddenFields).toEqual([]);
      // Personnage d'un autre joueur : masqué.
      expect((byId.get('c2')!.sheetData as { classId?: string }).classId).toBeUndefined();
      expect(byId.get('c2')!.hiddenFields).toEqual(['classId']);
      // Personnage du MJ, vu par un joueur (qui n'est ni son propriétaire ni le MJ) : masqué aussi.
      expect((byId.get('c3')!.sheetData as { classId?: string }).classId).toBeUndefined();
      expect(byId.get('c3')!.hiddenFields).toEqual(['classId']);
      // Résolu une seule fois pour toute la liste (pas de N+1) malgré 2 personnages masqués.
      expect(prisma.partieVisibilityLock.findMany).toHaveBeenCalledTimes(1);

      prisma.partieVisibilityLock.findMany.mockClear();
      const asMj = await service.findByPartie('p1', 'mj1');

      for (const c of asMj) {
        expect((c.sheetData as { classId?: string }).classId).toBe('chasseur');
        expect(c.hiddenFields).toEqual([]);
      }
      // Le MJ voit tout sans jamais résoudre les verrous.
      expect(prisma.partieVisibilityLock.findMany).not.toHaveBeenCalled();
    });

    it('aucun personnage → ne fait aucun appel user.findMany', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.findMany.mockResolvedValue([]);

      const result = await service.findByPartie('p1', 'mj1');

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('userId sans pseudo résolu (défensif) → ownerPseudo vide plutôt que de planter', async () => {
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.findMany.mockResolvedValue([makeCharacter({ id: 'c1', userId: 'orphan' })]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findByPartie('p1', 'mj1');

      expect(result[0].ownerPseudo).toBe('');
      expect(result[0].ownerDisplayName).toBe('');
    });
  });

  describe('findMine() (Story 29.2, AC1/AC3)', () => {
    it('toutes parties confondues → un seul appel user.findById, résolution en lot des noms de Partie', async () => {
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
        makeCharacter({ id: 'c2', userId: 'u1', partieId: 'p2' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([
        { id: 'p1', name: 'La Forêt Noire' },
        { id: 'p2', name: 'Le Donjon Oublié' },
      ]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(
        new Map([
          ['p1', 'player'],
          ['p2', 'mj'],
        ]),
      );

      const result = await service.findMine('u1');

      expect(prisma.character.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.partie.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.partie.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] } },
        select: { id: true, name: true },
      });
      expect(permissions.rolesOf).toHaveBeenCalledTimes(1);
      expect(permissions.rolesOf).toHaveBeenCalledWith('u1', ['p1', 'p2']);
      expect(users.findById).toHaveBeenCalledTimes(1);
      expect(users.findById).toHaveBeenCalledWith('u1');
      expect(result.map((c) => c.partieName)).toEqual(['La Forêt Noire', 'Le Donjon Oublié']);
      expect(result.map((c) => c.ownerPseudo)).toEqual(['alice', 'alice']);
      expect(result.map((c) => c.ownerDisplayName)).toEqual(['Alice au pays', 'Alice au pays']);
    });

    it('isMj varie par Partie (MJ ici, joueur là) — jamais un calcul global', async () => {
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p-mj' }),
        makeCharacter({ id: 'c2', userId: 'u1', partieId: 'p-player' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([
        { id: 'p-mj', name: 'Ma partie' },
        { id: 'p-player', name: 'Partie d’un ami' },
      ]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(
        new Map([
          ['p-mj', 'mj'],
          ['p-player', 'player'],
        ]),
      );

      const result = await service.findMine('u1');

      expect(result.map((c) => c.ownerIsMj)).toEqual([true, false]);
      expect(result.map((c) => c.viewerIsMj)).toEqual([true, false]);
    });

    it("cadenas de visibilité configurés sur la Partie (Story 31.6, revue de code) : findMine() renvoie quand même la fiche complète — le lecteur est toujours le propriétaire de chaque personnage listé ici, aucun masque n'est jamais calculé", async () => {
      users.findById.mockResolvedValue({ id: 'u1', pseudo: 'alice', displayName: 'Alice' });
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'player']]));
      prisma.partieVisibilityLock.findMany.mockResolvedValue([
        { fieldKey: 'classId', subField: null },
      ]);

      const result = await service.findMine('u1');

      expect((result[0].sheetData as { classId?: string }).classId).toBe('chasseur');
      expect(result[0].hiddenFields).toEqual([]);
      expect(prisma.partieVisibilityLock.findMany).not.toHaveBeenCalled();
    });

    it('aucun personnage → tableau vide, aucun appel partie.findMany ni user.findById', async () => {
      prisma.character.findMany.mockResolvedValue([]);

      const result = await service.findMine('u1');

      expect(result).toEqual([]);
      expect(prisma.partie.findMany).not.toHaveBeenCalled();
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('Partie orpheline (défensive) → partieName vide plutôt que de planter', async () => {
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p-disparue' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([]);

      const result = await service.findMine('u1');

      expect(result[0].partieName).toBe('');
      expect(result[0].ownerIsMj).toBe(false);
    });

    it("pas de fuite d'un autre utilisateur — le mock filtre par userId comme le ferait Prisma, les personnages d'un autre appelant sont absents du résultat", async () => {
      const allCharacters = [
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
        makeCharacter({ id: 'c2', userId: 'u2', partieId: 'p2' }),
      ];
      prisma.character.findMany.mockImplementation(({ where }: { where: { userId: string } }) =>
        Promise.resolve(allCharacters.filter((c) => c.userId === where.userId)),
      );
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'mj']]));
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });

      const result = await service.findMine('u1');

      expect(result).toHaveLength(1);
      expect(result.map((c) => c.id)).toEqual(['c1']);
      expect(result.some((c) => c.id === 'c2')).toBe(false);
    });

    it('classLabel/typeLabel résolus depuis le contenu de jeu (Story 29.9)', async () => {
      gameSystems.getContent.mockResolvedValue({
        class: [{ key: 'chasseur', data: { label: 'Chasseur' } }],
        type: [{ key: 'attaque', data: { label: 'Attaque' } }],
      });
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'mj']]));

      const result = await service.findMine('u1');

      expect(gameSystems.getContent).toHaveBeenCalledWith('ryuutama');
      expect(result[0].classLabel).toBe('Chasseur');
      expect(result[0].typeLabel).toBe('Attaque');
    });

    it('classId/typeId absent du catalogue (défensif) → classLabel/typeLabel null, jamais une chaîne vide trompeuse', async () => {
      gameSystems.getContent.mockResolvedValue({ class: [], type: [] });
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'mj']]));

      const result = await service.findMine('u1');

      expect(result[0].classLabel).toBeNull();
      expect(result[0].typeLabel).toBeNull();
    });

    it('groupRoleLabel résolu depuis CharacterGroupRole + contenu groupRole, null si aucun rôle assigné', async () => {
      gameSystems.getContent.mockResolvedValue({
        class: [{ key: 'chasseur', data: { label: 'Chasseur' } }],
        type: [{ key: 'attaque', data: { label: 'Attaque' } }],
        groupRole: [{ key: 'chef', data: { label: 'Chef' } }],
      });
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({ id: 'c1', userId: 'u1', partieId: 'p1' }),
        makeCharacter({ id: 'c2', userId: 'u1', partieId: 'p1' }),
      ]);
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'mj']]));
      prisma.characterGroupRole.findMany.mockResolvedValue([
        { characterId: 'c1', roleKey: 'chef' },
      ]);

      const result = await service.findMine('u1');

      expect(prisma.characterGroupRole.findMany).toHaveBeenCalledWith({
        where: { characterId: { in: ['c1', 'c2'] } },
        select: { characterId: true, roleKey: true },
      });
      expect(result.find((c) => c.id === 'c1')?.groupRoleLabel).toBe('Chef');
      expect(result.find((c) => c.id === 'c2')?.groupRoleLabel).toBeNull();
    });

    it('personnages de systèmes de jeu distincts → un seul getContent() par système, jamais par personnage', async () => {
      prisma.character.findMany.mockResolvedValue([
        makeCharacter({
          id: 'c1',
          userId: 'u1',
          partieId: 'p1',
          gameSystemId: 'ryuutama',
        }),
        makeCharacter({
          id: 'c2',
          userId: 'u1',
          partieId: 'p1',
          gameSystemId: 'ryuutama',
        }),
        makeCharacter({
          id: 'c3',
          userId: 'u1',
          partieId: 'p1',
          gameSystemId: 'homme-dragon',
        }),
      ]);
      prisma.partie.findMany.mockResolvedValue([{ id: 'p1', name: 'La Forêt Noire' }]);
      // Rôle de l'appelant sur chaque partie, lu en une fois par le service de permission.
      permissions.rolesOf.mockResolvedValue(new Map([['p1', 'mj']]));

      await service.findMine('u1');

      expect(gameSystems.getContent).toHaveBeenCalledTimes(2);
      expect(gameSystems.getContent).toHaveBeenCalledWith('ryuutama');
      expect(gameSystems.getContent).toHaveBeenCalledWith('homme-dragon');
    });
  });

  describe('updatePortrait()', () => {
    it('propriétaire + image valide → écrit le fichier et met à jour portraitUrl/portraitCropData', async () => {
      const character = makeCharacter();
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(
        makeCharacter({
          portraitUrl: '/uploads/portraits/fixed-uuid.jpg',
          portraitCropData: { scale: 1.5, offsetX: 0, offsetY: 0 },
        }),
      );

      const result = await service.updatePortrait('char1', 'u1', makeMulterFile(), {
        scale: 1.5,
        offsetX: 0,
        offsetY: 0,
      });

      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('fixed-uuid.jpg'),
        JPEG_BUFFER,
      );
      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: character.updatedAt },
        data: {
          portraitUrl: '/uploads/portraits/fixed-uuid.jpg',
          portraitCropData: { scale: 1.5, offsetX: 0, offsetY: 0 },
        },
      });
      expect(result.portraitUrl).toBe('/uploads/portraits/fixed-uuid.jpg');
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());

      await service.updatePortrait('char1', 'u1', makeMulterFile(), null);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('non-propriétaire (y compris le MJ) → ForbiddenException, aucune écriture disque', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

      await expect(service.updatePortrait('char1', 'mj1', makeMulterFile(), null)).rejects.toThrow(
        ForbiddenException,
      );
      expect(writeFile).not.toHaveBeenCalled();
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('personnage introuvable → NotFoundException', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      await expect(service.updatePortrait('unknown', 'u1', makeMulterFile(), null)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fichier non-image (octets magiques invalides) → BadRequestException, aucune écriture disque', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());

      await expect(
        service.updatePortrait('char1', 'u1', makeMulterFile(Buffer.from('not an image')), null),
      ).rejects.toThrow(BadRequestException);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('nettoie les métadonnées EXIF avant écriture (Story 16.2 AC1) — écrit le buffer nettoyé, pas le buffer brut', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      const cleaned = Buffer.from('cleaned-bytes');
      (stripImageMetadata as jest.Mock).mockResolvedValue(cleaned);

      await service.updatePortrait('char1', 'u1', makeMulterFile(), null);

      expect(stripImageMetadata).toHaveBeenCalledWith(JPEG_BUFFER, { maxDimension: 1024 });
      expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('fixed-uuid.jpg'), cleaned);
    });

    it('AC7 : le jest.mock de stripImageMetadata cible bien le module courant, pas un chemin périmé (garde contre le refactor AD-17)', async () => {
      // Si `jest.mock('../common/image-upload.util', ...)` ne ciblait plus le module réellement
      // importé par `character.service.ts` (chemin périmé après un déplacement), stripImageMetadata
      // serait la VRAIE fonction sharp() au moment de l'appel — appelée sur JPEG_BUFFER (signature
      // magique seule, non décodable), elle rejetterait (cf. test suivant), et l'assertion
      // `writeFile` ci-dessous ne serait jamais atteinte. La valeur mockée est délibérément
      // impossible à produire par un vrai sharp() sur ce buffer, pour qu'aucune coïncidence ne
      // puisse faire passer ce test si le mock devenait inopérant sans bruit (AC7).
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      const marker = Buffer.from('valeur-impossible-a-produire-par-un-vrai-sharp-sur-ce-buffer');
      (stripImageMetadata as jest.Mock).mockResolvedValue(marker);

      await service.updatePortrait('char1', 'u1', makeMulterFile(), null);

      expect(writeFile).toHaveBeenCalledWith(anyOf(String), marker);
    });

    it('signature magique valide mais image indécodable par sharp → BadRequestException, aucune écriture disque (Story 16.2 AC3)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      (stripImageMetadata as jest.Mock).mockRejectedValue(
        new Error('Input buffer has corrupt header'),
      );

      await expect(service.updatePortrait('char1', 'u1', makeMulterFile(), null)).rejects.toThrow(
        BadRequestException,
      );
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('portrait existant → l’ancien fichier est supprimé (remplacement, pas de cumul)', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());

      await service.updatePortrait('char1', 'u1', makeMulterFile(), null);

      expect(unlink).toHaveBeenCalledWith(expect.stringContaining(`${OLD_PORTRAIT_UUID}.jpg`));
    });

    it('conflit de concurrence (updatedAt modifié entretemps) → ConflictException, le nouveau fichier écrit est nettoyé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updatePortrait('char1', 'u1', makeMulterFile(), null)).rejects.toThrow(
        ConflictException,
      );
      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('fixed-uuid.jpg'));
    });

    it('échec de la mise à jour Prisma → le nouveau fichier écrit est nettoyé, erreur propagée', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.updatePortrait('char1', 'u1', makeMulterFile(), null)).rejects.toThrow(
        'db down',
      );
      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('fixed-uuid.jpg'));
    });

    it('résout ownerPseudo/ownerIsMj sur le résultat retourné', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

      const result = await service.updatePortrait('char1', 'u1', makeMulterFile(), null);

      expect(result.ownerPseudo).toBe('alice');
      expect(result.ownerDisplayName).toBe('Alice au pays');
      expect(result.ownerIsMj).toBe(false);
    });
  });

  describe('removePortrait()', () => {
    it('propriétaire avec portrait existant → supprime le fichier et met portraitUrl/portraitCropData à null', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());

      await service.removePortrait('char1', 'u1');

      expect(unlink).toHaveBeenCalledWith(expect.stringContaining(`${OLD_PORTRAIT_UUID}.jpg`));
      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: character.updatedAt },
        data: { portraitUrl: null, portraitCropData: Prisma.JsonNull },
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());

      await service.removePortrait('char1', 'u1');

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('non-propriétaire → ForbiddenException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));
      await expect(service.removePortrait('char1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('conflit de concurrence (updatedAt modifié entretemps) → ConflictException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.removePortrait('char1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('résout ownerPseudo/ownerIsMj sur le résultat retourné', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

      const result = await service.removePortrait('char1', 'u1');

      expect(result.ownerPseudo).toBe('alice');
      expect(result.ownerDisplayName).toBe('Alice au pays');
      expect(result.ownerIsMj).toBe(false);
    });
  });

  describe('updatePdfPortraitCrop()', () => {
    const CROP_DATA = { scale: 1.5, offsetX: 10, offsetY: -20 };

    it('propriétaire avec portrait existant → enregistre pdfPortraitCropData', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(
        makeCharacter({ pdfPortraitCropData: CROP_DATA }),
      );

      const result = await service.updatePdfPortraitCrop('char1', 'u1', CROP_DATA);

      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: character.updatedAt },
        data: { pdfPortraitCropData: CROP_DATA },
      });
      expect(result.pdfPortraitCropData).toEqual(CROP_DATA);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());

      await service.updatePdfPortraitCrop('char1', 'u1', CROP_DATA);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('non-propriétaire → ForbiddenException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));
      await expect(service.updatePdfPortraitCrop('char1', 'stranger', CROP_DATA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('personnage sans portrait → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ portraitUrl: null }));
      await expect(service.updatePdfPortraitCrop('char1', 'u1', CROP_DATA)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('conflit de concurrence (updatedAt modifié entretemps) → ConflictException', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updatePdfPortraitCrop('char1', 'u1', CROP_DATA)).rejects.toThrow(
        ConflictException,
      );
    });

    it('résout ownerPseudo/ownerIsMj sur le résultat retourné', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

      const result = await service.updatePdfPortraitCrop('char1', 'u1', CROP_DATA);

      expect(result.ownerPseudo).toBe('alice');
      expect(result.ownerDisplayName).toBe('Alice au pays');
      expect(result.ownerIsMj).toBe(false);
    });
  });

  describe('getPortraitFile()', () => {
    it('propriétaire → retourne le buffer et le mime déduit de l’extension', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      (readFile as jest.Mock).mockResolvedValue(Buffer.from('bytes'));

      const result = await service.getPortraitFile('char1', 'u1');

      expect(result.mime).toBe('image/jpeg');
      expect(result.buffer).toEqual(Buffer.from('bytes'));
      expect(permissions.assert).not.toHaveBeenCalled();
    });

    it('MJ (non-propriétaire) de la partie → accès autorisé', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await service.getPortraitFile('char1', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'CHARACTER_PORTRAIT_READ', {
        characterId: 'char1',
      });
    });

    it('fellow player (ni propriétaire ni MJ, mais membre de la Partie) → accès autorisé (cohérence avec findOne, revue de code Story 6.5)', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      (readFile as jest.Mock).mockResolvedValue(Buffer.from('bytes'));

      const result = await service.getPortraitFile('char1', 'joueur-tiers');

      expect(result.buffer).toEqual(Buffer.from('bytes'));
    });

    it('tiers (ni propriétaire ni membre de la Partie) → ForbiddenException', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          portraitUrl: `/uploads/portraits/${OLD_PORTRAIT_UUID}.jpg`,
        }),
      );
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.getPortraitFile('char1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('personnage sans portrait → NotFoundException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ portraitUrl: null }));
      await expect(service.getPortraitFile('char1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('personnage introuvable → NotFoundException', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      await expect(service.getPortraitFile('unknown', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyXpDelta()', () => {
    it('incrémente via prisma.character.update (pas updateMany), aucun seuil franchi → pas d’e-mail', async () => {
      prisma.character.update.mockResolvedValue(makeCharacter({ xp: 50 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await service.applyXpDelta('char1', 50);

      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char1' },
        data: { xp: { increment: 50 } },
      });
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.character.update.mockResolvedValue(makeCharacter({ xp: 50, partieId: 'p1' }));
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await service.applyXpDelta('char1', 50);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('franchissement de seuil → déclenche EmailService.sendMail("level-up", ...)', async () => {
      prisma.character.update.mockResolvedValue(
        makeCharacter({ xp: 150, partieId: 'p1', userId: 'u1' }),
      );
      (pendingLevels as jest.Mock).mockReturnValue([2]);
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        email: 'alice@example.com',
      });
      prisma.partie.findUnique.mockResolvedValue({ name: 'Les Brumes' });

      await service.applyXpDelta('char1', 150);

      expect(email.sendMail).toHaveBeenCalledWith(
        'level-up',
        'alice@example.com',
        objectLike({ partieName: 'Les Brumes' }),
      );
    });

    it('toDto() expose xp/level sur les méthodes existantes (findOne) — level = niveau appliqué, pas le potentiel XP', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 150 }));

      const result = await service.findOne('char1', 'u1');

      expect(result.xp).toBe(150);
      // xp=150 franchit le seuil du niveau 2, mais sheetData.levelUps est vide (aucune montée
      // validée) → level doit rester 1, pas 2 (régression : level ne doit jamais dériver de xp).
      expect(result.level).toBe(1);
    });

    it("level reste au niveau courant tant qu'un niveau en attente n'a pas été appliqué, même avec beaucoup d'XP", async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 700 }));

      const result = await service.findOne('char1', 'u1');

      expect(result.level).toBe(1);
    });

    it('level = 1 + nombre de levelUps appliqués, indépendamment de l’xp restant', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          xp: 700,
          sheetData: {
            ...validSheet(),
            levelUps: [
              {
                level: 2,
                pvAllocated: 2,
                peAllocated: 1,
                capabilities: [{ type: 'attribute', params: {} }],
              },
              {
                level: 3,
                pvAllocated: 1,
                peAllocated: 2,
                capabilities: [{ type: 'landscape', params: {} }],
              },
            ],
          },
        }),
      );

      const result = await service.findOne('char1', 'u1');

      expect(result.level).toBe(3);
    });
  });

  describe('setXp()', () => {
    it('non-MJ de la Partie → ForbiddenException, aucune écriture', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setXp('char1', 'stranger', 500)).rejects.toThrow(ForbiddenException);
      // La partie est résolue depuis le personnage par le service de permission (aucun IDOR).
      expect(permissions.assert).toHaveBeenCalledWith('stranger', 'CHARACTER_XP_SET', {
        characterId: 'char1',
      });
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('MJ d’une AUTRE Partie → ForbiddenException (permissions.assert rejette)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ partieId: 'p1' }));
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.setXp('char1', 'mj-autre-partie', 500)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('409 si updatedAt périmé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.setXp('char1', 'mj1', 500)).rejects.toThrow(ConflictException);
      expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
    });

    it('succès → remplacement absolu (pas un increment), snapshot MJ_EDIT créé avec le bon level', async () => {
      const character = makeCharacter({
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ xp: 500 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await service.setXp('char1', 'mj1', 500);

      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: character.updatedAt },
        data: { xp: 500 },
      });
      expect(prisma.characterSnapshot.create).toHaveBeenCalledWith({
        data: objectLike({
          characterId: 'char1',
          trigger: 'MJ_EDIT',
          level: 1,
        }),
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      const character = makeCharacter({
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(
        makeCharacter({ xp: 500, partieId: 'p1' }),
      );
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await service.setXp('char1', 'mj1', 500);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    // Revue de code 28.2 : les 8 méthodes de mutation (updatePortrait, removePortrait,
    // updatePdfPortraitCrop, applyLevelUp, setXp, setSheetField, updateNarrativeField,
    // setJournalAutoAssociate) résolvent toutes l'identité du propriétaire par le **même** point,
    // resolveOwnerInfo(). Ce test le couvre une fois pour toutes plutôt que huit fois à l'identique.
    it('le DTO renvoyé porte ownerDisplayName — couvre resolveOwnerInfo(), point unique des 8 mutations', async () => {
      const character = makeCharacter({
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ xp: 500 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });

      const result = await service.setXp('char1', 'mj1', 500);

      expect(result.ownerPseudo).toBe('alice');
      expect(result.ownerDisplayName).toBe('Alice au pays');
    });

    it('franchissement de seuil → déclenche EmailService.sendMail("level-up", ...), comme applyXpDelta', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(
        makeCharacter({ xp: 150, partieId: 'p1', userId: 'u1' }),
      );
      (pendingLevels as jest.Mock).mockReturnValue([2]);
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        email: 'alice@example.com',
      });
      prisma.partie.findUnique.mockResolvedValue({ name: 'Les Brumes' });
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

      await service.setXp('char1', 'mj1', 150);

      expect(email.sendMail).toHaveBeenCalledWith(
        'level-up',
        'alice@example.com',
        objectLike({ partieName: 'Les Brumes' }),
      );
    });

    it('pas de franchissement de seuil → pas d’e-mail', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ xp: 10 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await service.setXp('char1', 'mj1', 10);

      expect(email.sendMail).not.toHaveBeenCalled();
    });

    it('viewerIsMj: true dans le CharacterDto retourné (le viewer est nécessairement le MJ appelant)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ xp: 10 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);
      users.findById.mockResolvedValue({
        id: 'u1',
        pseudo: 'alice',
        displayName: 'Alice au pays',
      });
      permissions.roleOf.mockImplementation(roleOwnedBy('mj1'));

      const result = await service.setXp('char1', 'mj1', 10);

      expect(result.viewerIsMj).toBe(true);
      expect(result.ownerIsMj).toBe(false);
    });
  });

  describe('setSheetField()', () => {
    beforeEach(() => {
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (computeDerived as jest.Mock).mockReturnValue({});
    });

    it('non-MJ de la Partie → ForbiddenException, aucune écriture', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(
        service.setSheetField('char1', 'stranger', {
          path: 'fetiqueObject',
          value: 'Lanterne',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('non-MJ tentant "xp"/"levelUps" via sheet-field → ForbiddenException (auth vérifiée avant le denylist, AC5)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(
        service.setSheetField('char1', 'stranger', { path: 'xp', value: 999 }),
      ).rejects.toThrow(ForbiddenException);
      expect(permissions.assert).toHaveBeenCalledWith('stranger', 'CHARACTER_SHEET_FIELD_SET', {
        characterId: 'char1',
      });
    });

    it('path racine "xp" → BadRequestException (MJ autorisé)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', { path: 'xp', value: 999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('path racine "levelUps" → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', { path: 'levelUps', value: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('path imbriqué sous "levelUps" (ex. levelUps.0.level) → toujours rejeté (denylist sur le segment racine)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'levelUps.0.level',
          value: 99,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('path "__proto__.polluted" → BadRequestException (protection pollution de prototype)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: '__proto__.polluted',
          value: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(({} as unknown as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('path "equipment" (1 segment, hors equipment.individual.<index>) → BadRequestException, jamais de remplacement en bloc', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment',
          value: {
            individual: [{ id: 'x', name: 'Injecté', weight: 0, addedBy: 'player' }],
            contenants: [],
            animaux: [],
          },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('409 si updatedAt périmé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'fetiqueObject',
          value: 'Lanterne',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
    });

    it('succès sur un champ simple → warnings: [] si validate("mj", ...) ne remonte aucune erreur', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      const result = await service.setSheetField('char1', 'mj1', {
        path: 'fetiqueObject',
        value: 'Lanterne magique',
      });

      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: anyOf(Date) },
        data: objectLike({
          sheetData: objectLike({
            fetiqueObject: 'Lanterne magique',
          }),
        }),
      });
      expect(prisma.characterSnapshot.create).toHaveBeenCalledWith({
        data: objectLike({
          characterId: 'char1',
          trigger: 'MJ_EDIT',
        }),
      });
      expect(result.warnings).toEqual([]);
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ partieId: 'p1' }));
      (validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      await service.setSheetField('char1', 'mj1', {
        path: 'fetiqueObject',
        value: 'Lanterne magique',
      });

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('warnings non vides → écriture quand même effectuée (jamais bloquant, AD-7)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter());
      (validate as jest.Mock).mockReturnValue({
        valid: true,
        errors: [{ field: 'classId', message: 'Classe hors catalogue' }],
      });

      const result = await service.setSheetField('char1', 'mj1', {
        path: 'classId',
        value: 'classe-maison',
      });

      expect(prisma.character.updateMany).toHaveBeenCalled();
      expect(result.warnings).toEqual(['Classe hors catalogue']);
    });

    it('equipment.individual : ajout (index === longueur) génère un nouvel id, addedBy forcé à "mj"', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: {
            individual: [{ id: 'existing-1', name: 'Corde', weight: 1, addedBy: 'player' }],
            contenants: [],
            animaux: [],
          },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.individual.1',
        value: { name: 'Lettre scellée', weight: 0.1, addedBy: 'player' },
      });

      const written = writtenData(prisma.character.updateMany).sheetData;
      expect(written.equipment.individual[1]).toEqual({
        id: 'fixed-uuid',
        name: 'Lettre scellée',
        weight: 0.1,
        addedBy: 'mj',
      });
    });

    it('equipment.individual : édition d’un index existant avec le bon id conserve l’id d’origine, addedBy forcé à "mj"', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: {
            individual: [{ id: 'existing-1', name: 'Corde', weight: 1, addedBy: 'player' }],
            contenants: [],
            animaux: [],
          },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.individual.0',
        value: {
          id: 'existing-1',
          name: 'Corde renforcée',
          weight: 1.5,
          addedBy: 'player',
        },
      });

      const written = writtenData(prisma.character.updateMany).sheetData;
      expect(written.equipment.individual[0]).toEqual({
        id: 'existing-1',
        name: 'Corde renforcée',
        weight: 1.5,
        addedBy: 'mj',
      });
    });

    it('equipment.individual : édition avec un id absent ou périmé (objet déplacé/supprimé entretemps) → ConflictException, jamais d’écrasement du mauvais objet', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: {
            individual: [{ id: 'existing-1', name: 'Corde', weight: 1, addedBy: 'player' }],
            contenants: [],
            animaux: [],
          },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.individual.0',
          value: { id: 'stale-id', name: 'Corde renforcée', weight: 1.5 },
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('equipment.individual : index non canonique ("01") → BadRequestException', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: {
            individual: [{ id: 'existing-1', name: 'Corde', weight: 1, addedBy: 'player' }],
            contenants: [],
            animaux: [],
          },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.individual.01',
          value: { id: 'existing-1', name: 'Corde renforcée', weight: 1.5 },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('equipment.individual : value non-objet (string/array/null) → BadRequestException', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux: [] },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.individual.0',
          value: 'not-an-object',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('equipment.individual : index hors limites → BadRequestException', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux: [] },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.individual.5',
          value: { name: 'Objet fantôme', weight: 0 },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('equipment.individual sans index (2 segments) → BadRequestException', async () => {
      const character = makeCharacter();
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.individual',
          value: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('equipment.contenants : ajout (index === longueur) génère un nouvel id, addedBy forcé à "mj" (Story 14.1)', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux: [] },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.contenants.0',
        value: { name: 'Coffre', weight: 5 },
      });

      const written = writtenData(prisma.character.updateMany).sheetData;
      expect(written.equipment.contenants[0]).toEqual({
        id: 'fixed-uuid',
        name: 'Coffre',
        weight: 5,
        addedBy: 'mj',
      });
    });

    it('equipment.animaux : ajout génère un nouvel id, addedBy forcé à "mj" (Story 14.1, FR8)', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux: [] },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.animaux.0',
        value: { name: 'Cheval' },
      });

      const written = writtenData(prisma.character.updateMany).sheetData;
      expect(written.equipment.animaux[0]).toEqual({
        id: 'fixed-uuid',
        name: 'Cheval',
        addedBy: 'mj',
      });
    });

    it('equipment.animaux : une clé weight injectée dans la valeur est toujours supprimée avant écriture (Story 14.1, AC4)', async () => {
      const character = makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux: [] },
        },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.setSheetField('char1', 'mj1', {
        path: 'equipment.animaux.0',
        value: { name: 'Cheval', weight: 999 },
      });

      const written = writtenData(prisma.character.updateMany).sheetData;
      expect(written.equipment.animaux[0]).not.toHaveProperty('weight');
    });

    it('equipment.<catégorie invalide> → BadRequestException', async () => {
      const character = makeCharacter();
      prisma.character.findUnique.mockResolvedValue(character);
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );

      await expect(
        service.setSheetField('char1', 'mj1', {
          path: 'equipment.group.0',
          value: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateNarrativeField()', () => {
    it('non-propriétaire (y compris MJ de la Partie) → ForbiddenException, aucune écriture', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

      await expect(
        service.updateNarrativeField('char1', 'mj1', {
          field: 'motivation',
          value: 'Venger son village',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('succès sur un champ (motivation) → sheetData.narrative.motivation mis à jour, characterSnapshot.create jamais appelé', async () => {
      const character = makeCharacter({
        sheetData: { ...validSheet(), narrative: { sex: 'Homme' } },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.updateNarrativeField('char1', 'u1', {
        field: 'motivation',
        value: 'Venger son village',
      });

      const data = writtenData(prisma.character.updateMany);
      expect(data.sheetData.narrative).toEqual({
        sex: 'Homme',
        motivation: 'Venger son village',
      });
      expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
    });

    it('value: null vide bien le champ (pas de valeur fantôme)', async () => {
      const character = makeCharacter({
        sheetData: { ...validSheet(), narrative: { sex: 'Homme' } },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.updateNarrativeField('char1', 'u1', {
        field: 'sex',
        value: null,
      });

      const data = writtenData(prisma.character.updateMany);
      expect(data.sheetData.narrative).toEqual({ sex: null });
    });

    it('value omis du body (undefined) → même effet que value: null, la clé disparaît (comportement figé, revue de code)', async () => {
      const character = makeCharacter({
        sheetData: { ...validSheet(), narrative: { sex: 'Homme' } },
      });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.updateNarrativeField('char1', 'u1', {
        field: 'sex',
      } as any);

      const data = writtenData(prisma.character.updateMany);
      expect(data.sheetData.narrative.sex).toBeUndefined();
      // JSON.stringify (sérialisation Prisma) supprime les clés `undefined` — la valeur ne
      // "fantôme" pas côté base, cohérent avec le cas `value: null` testé ci-dessus.
      expect(JSON.parse(JSON.stringify(data.sheetData.narrative))).toEqual({});
    });

    it('409 si updatedAt périmé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateNarrativeField('char1', 'u1', {
          field: 'age',
          value: '25',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('sheetData.narrative initialement undefined (premier champ jamais renseigné) → pas de crash, narrative créé avec juste ce champ', async () => {
      const character = makeCharacter({ sheetData: validSheet() });
      prisma.character.findUnique.mockResolvedValue(character);
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.updateNarrativeField('char1', 'u1', {
        field: 'homeTown',
        value: 'Village de Ryu',
      });

      const data = writtenData(prisma.character.updateMany);
      expect(data.sheetData.narrative).toEqual({ homeTown: 'Village de Ryu' });
    });
  });

  describe('applyLevelUp()', () => {
    const validDto = {
      pvAllocated: 2,
      peAllocated: 1,
      capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
    };

    it('aucun niveau en attente → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 0 }));
      (pendingLevels as jest.Mock).mockReturnValue([]);

      await expect(service.applyLevelUp('char1', 'u1', validDto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('somme PV+PE ≠ 3 → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 150 }));
      (pendingLevels as jest.Mock).mockReturnValue([2]);

      await expect(
        service.applyLevelUp('char1', 'u1', {
          pvAllocated: 1,
          peAllocated: 1,
          capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('attribut déjà à 12 → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(
        makeCharacter({
          xp: 150,
          sheetData: {
            ...validSheet(),
            attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 12 },
          },
        }),
      );
      (pendingLevels as jest.Mock).mockReturnValue([2]);

      await expect(
        service.applyLevelUp('char1', 'u1', {
          pvAllocated: 2,
          peAllocated: 1,
          capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('succès → applique levelUps[]/derived, crée le snapshot', async () => {
      const character = makeCharacter({ xp: 150 });
      prisma.character.findUnique.mockResolvedValue(character);
      (pendingLevels as jest.Mock).mockReturnValue([2]);
      (computeDerived as jest.Mock).mockReturnValue({
        PV: 18,
        PE: 13,
        Condition: 14,
        Initiative: 10,
        Encombrement: 12,
      });
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(makeCharacter({ xp: 150 }));

      await service.applyLevelUp('char1', 'u1', validDto);

      expect(prisma.character.updateMany).toHaveBeenCalledWith({
        where: { id: 'char1', updatedAt: character.updatedAt },
        data: objectLike({
          sheetData: objectLike({
            levelUps: [
              {
                level: 2,
                pvAllocated: 2,
                peAllocated: 1,
                capabilities: validDto.capabilities,
              },
            ],
          }),
        }),
      });
      expect(prisma.characterSnapshot.create).toHaveBeenCalledWith({
        data: objectLike({
          characterId: 'char1',
          level: 2,
          trigger: 'LEVEL_UP',
        }),
      });
    });

    it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
      const character = makeCharacter({ xp: 150 });
      prisma.character.findUnique.mockResolvedValue(character);
      (pendingLevels as jest.Mock).mockReturnValue([2]);
      (computeDerived as jest.Mock).mockReturnValue({});
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(
        makeCharacter({ xp: 150, partieId: 'p1' }),
      );

      await service.applyLevelUp('char1', 'u1', validDto);

      expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
    });

    it('409 si updatedAt périmé (conflit de concurrence)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 150 }));
      (pendingLevels as jest.Mock).mockReturnValue([2]);
      (computeDerived as jest.Mock).mockReturnValue({});
      prisma.character.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.applyLevelUp('char1', 'u1', validDto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
    });

    it('non-propriétaire → ForbiddenException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner', xp: 150 }));

      await expect(service.applyLevelUp('char1', 'stranger', validDto as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('niveau à deux capacités (4) → exige et applique les DEUX (Attribut ET immunité)', async () => {
      const character = makeCharacter({ xp: 1200 });
      prisma.character.findUnique.mockResolvedValue(character);
      (pendingLevels as jest.Mock).mockReturnValue([4]);
      (computeDerived as jest.Mock).mockReturnValue({});
      gameSystems.getContent.mockResolvedValue({
        immunityState: [{ key: 'blesse', data: { label: 'Blessé' } }],
      });
      prisma.character.updateMany.mockResolvedValue({ count: 1 });
      prisma.character.findUniqueOrThrow.mockResolvedValue(character);

      await service.applyLevelUp('char1', 'u1', {
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [
          { type: 'attribute', params: { attribute: 'VIG' } },
          { type: 'immunity', params: { key: 'blesse' } },
        ],
      });

      const data = writtenData(prisma.character.updateMany);
      expect(data.sheetData.attributes.VIG).toBe(10); // 8 + 2
      expect(data.sheetData.levelUps[0].capabilities).toHaveLength(2);
    });

    it("niveau à deux capacités : n'en fournir qu'une → BadRequestException", async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 1200 }));
      (pendingLevels as jest.Mock).mockReturnValue([4]);

      await expect(
        service.applyLevelUp('char1', 'u1', {
          pvAllocated: 2,
          peAllocated: 1,
          capabilities: [{ type: 'attribute', params: { attribute: 'VIG' } }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });

    it('clé de capacité absente du contenu seedé → BadRequestException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter({ xp: 600 }));
      (pendingLevels as jest.Mock).mockReturnValue([3]);
      gameSystems.getContent.mockResolvedValue({
        landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
      });

      await expect(
        service.applyLevelUp('char1', 'u1', {
          pvAllocated: 2,
          peAllocated: 1,
          capabilities: [{ type: 'landscape', params: { key: 'inconnu' } }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.character.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getHistory()', () => {
    it('propriétaire → retourne la liste triée par la base (desc)', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      prisma.characterSnapshot.findMany.mockResolvedValue([
        {
          id: 's2',
          characterId: 'char1',
          sheetData: {},
          derived: {},
          level: 3,
          trigger: 'LEVEL_UP',
          note: null,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
        {
          id: 's1',
          characterId: 'char1',
          sheetData: {},
          derived: {},
          level: 2,
          trigger: 'LEVEL_UP',
          note: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.getHistory('char1', 'u1');

      expect(prisma.characterSnapshot.findMany).toHaveBeenCalledWith({
        where: { characterId: 'char1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.map((s) => s.id)).toEqual(['s2', 's1']);
      expect(result[0].createdAt).toBe('2026-02-01T00:00:00.000Z');
    });

    it('MJ (non-propriétaire) → accès autorisé', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockImplementation(
        grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
      );
      prisma.characterSnapshot.findMany.mockResolvedValue([]);

      await service.getHistory('char1', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'CHARACTER_HISTORY_READ', {
        characterId: 'char1',
      });
    });

    it('ni propriétaire ni MJ → ForbiddenException', async () => {
      prisma.character.findUnique.mockResolvedValue(makeCharacter());
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.getHistory('char1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('personnage introuvable → NotFoundException', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      await expect(service.getHistory('unknown', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('inventoryItems', () => {
    function makeCharacterWithEquipment(individual: unknown[] = []) {
      return makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual, contenants: [], animaux: [] },
        },
      });
    }

    describe('addInventoryItem()', () => {
      it('ajoute un objet avec le poids fourni, addedBy forcé à player, id généré', async () => {
        const character = makeCharacterWithEquipment();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', {
          name: 'Cape',
          weight: 1.2,
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual).toEqual([
          { id: 'fixed-uuid', name: 'Cape', weight: 1.2, addedBy: 'player' },
        ]);
      });

      it('émet un événement temps réel scopé sur la Partie, via writeInventoryChange (Story 18.1, AC1)', async () => {
        const character = makeCharacterWithEquipment();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', {
          name: 'Cape',
          weight: 1.2,
        });

        expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('ajoute un objet sans poids → weight 0', async () => {
        const character = makeCharacterWithEquipment();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', { name: 'Sac' });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual[0]).toEqual({
          id: 'fixed-uuid',
          name: 'Sac',
          weight: 0,
          addedBy: 'player',
        });
      });

      it('addedBy injecté dans le DTO (mock any) est ignoré — toujours player en sortie', async () => {
        const character = makeCharacterWithEquipment();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', {
          name: 'Objet suspect',
          addedBy: 'mj',
        } as any);

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual[0].addedBy).toBe('player');
      });

      it('409 si updatedAt périmé', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithEquipment());
        prisma.character.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.addInventoryItem('char1', 'u1', { name: 'Cape' } as any),
        ).rejects.toThrow(ConflictException);
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(
          service.addInventoryItem('char1', 'stranger', {
            name: 'Cape',
          } as any),
        ).rejects.toThrow(ForbiddenException);
      });

      it("n'appelle jamais characterSnapshot.create (FR-12 exclut l'inventaire)", async () => {
        const character = makeCharacterWithEquipment();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', { name: 'Cape' });

        expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
      });

      it('personnage legacy (equipment.individual encore string[]) → normalisé avant ajout, pas de tableau mixte (défense en profondeur, revue de code)', async () => {
        const character = makeCharacterWithEquipment(['Vieux sac']);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addInventoryItem('char1', 'u1', { name: 'Cape' });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual).toEqual([
          { id: 'fixed-uuid', name: 'Vieux sac', weight: 0, addedBy: 'player' },
          { id: 'fixed-uuid', name: 'Cape', weight: 0, addedBy: 'player' },
        ]);
      });
    });

    describe('updateInventoryItem()', () => {
      it('modifie le nom seul, poids inchangé', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1.2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateInventoryItem('char1', 'u1', 'item-1', {
          name: 'Cape usée',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual[0]).toEqual({
          id: 'item-1',
          name: 'Cape usée',
          weight: 1.2,
          addedBy: 'player',
        });
      });

      it('modifie le poids seul, nom inchangé', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1.2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateInventoryItem('char1', 'u1', 'item-1', {
          weight: 2,
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual[0]).toEqual({
          id: 'item-1',
          name: 'Cape',
          weight: 2,
          addedBy: 'player',
        });
      });

      it('modifie le bon objet parmi plusieurs, quel que soit son index', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          { id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateInventoryItem('char1', 'u1', 'item-2', {
          name: 'Sac usé',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual).toEqual([
          { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          { id: 'item-2', name: 'Sac usé', weight: 2, addedBy: 'player' },
        ]);
      });

      it('itemId introuvable → NotFoundException (jamais un fallback sur un autre objet)', async () => {
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithEquipment([
            { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          ]),
        );

        await expect(
          service.updateInventoryItem('char1', 'u1', 'item-inconnu', {
            name: 'x',
          } as any),
        ).rejects.toThrow(NotFoundException);
      });

      it("objet déjà retiré par une autre requête (id périmé côté client) → NotFoundException, jamais une mauvaise cible (résout la faille d'adressage par index de la revue de code)", async () => {
        // Simule : le personnage tel que relu par CETTE requête ne contient plus l'objet que le
        // client pensait éditer (retiré entretemps par une autre requête, déjà appliquée).
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithEquipment([{ id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' }]),
        );

        await expect(
          service.updateInventoryItem('char1', 'u1', 'item-1', {
            weight: 5,
          } as any),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.character.updateMany).not.toHaveBeenCalled();
      });

      it('409 si updatedAt périmé', async () => {
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithEquipment([
            { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          ]),
        );
        prisma.character.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.updateInventoryItem('char1', 'u1', 'item-1', {
            weight: 2,
          } as any),
        ).rejects.toThrow(ConflictException);
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(
          service.updateInventoryItem('char1', 'stranger', 'item-1', {
            weight: 2,
          } as any),
        ).rejects.toThrow(ForbiddenException);
      });

      it('n’appelle jamais characterSnapshot.create', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateInventoryItem('char1', 'u1', 'item-1', {
          weight: 2,
        });

        expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
      });
    });

    describe('removeInventoryItem()', () => {
      it('retire le bon objet par id, quel que soit son index', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          { id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.removeInventoryItem('char1', 'u1', 'item-1');

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.individual).toEqual([
          { id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' },
        ]);
      });

      it('itemId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithEquipment([]));

        await expect(service.removeInventoryItem('char1', 'u1', 'item-inconnu')).rejects.toThrow(
          NotFoundException,
        );
      });

      it("objet déjà retiré par une autre requête → NotFoundException, jamais suppression d'un autre objet", async () => {
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithEquipment([{ id: 'item-2', name: 'Sac', weight: 2, addedBy: 'player' }]),
        );

        await expect(service.removeInventoryItem('char1', 'u1', 'item-1')).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.character.updateMany).not.toHaveBeenCalled();
      });

      it('409 si updatedAt périmé', async () => {
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithEquipment([
            { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
          ]),
        );
        prisma.character.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.removeInventoryItem('char1', 'u1', 'item-1')).rejects.toThrow(
          ConflictException,
        );
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(service.removeInventoryItem('char1', 'stranger', 'item-1')).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('n’appelle jamais characterSnapshot.create', async () => {
        const character = makeCharacterWithEquipment([
          { id: 'item-1', name: 'Cape', weight: 1, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.removeInventoryItem('char1', 'u1', 'item-1');

        expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
      });
    });

    function makeCharacterWithContenants(contenants: unknown[] = []) {
      return makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants, animaux: [] },
        },
      });
    }

    function makeCharacterWithAnimaux(animaux: unknown[] = []) {
      return makeCharacter({
        sheetData: {
          ...validSheet(),
          equipment: { individual: [], contenants: [], animaux },
        },
      });
    }

    describe('addContenant() (Story 14.1, FR7)', () => {
      it('ajoute un contenant avec le poids fourni, prix/effet, addedBy forcé à player', async () => {
        const character = makeCharacterWithContenants();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addContenant('char1', 'u1', {
          name: 'Sac à dos',
          weight: 2,
          price: '5 po',
          effect: 'Contient 10 objets',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.contenants).toEqual([
          {
            id: 'fixed-uuid',
            name: 'Sac à dos',
            weight: 2,
            price: '5 po',
            effect: 'Contient 10 objets',
            addedBy: 'player',
          },
        ]);
      });

      it('409 si updatedAt périmé', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithContenants());
        prisma.character.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.addContenant('char1', 'u1', { name: 'Sac' } as any)).rejects.toThrow(
          ConflictException,
        );
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(
          service.addContenant('char1', 'stranger', { name: 'Sac' } as any),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('updateContenant()', () => {
      it('modifie le nom/poids/prix/effet du bon contenant par id', async () => {
        const character = makeCharacterWithContenants([
          { id: 'c1', name: 'Sac', weight: 2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateContenant('char1', 'u1', 'c1', {
          weight: 3,
          price: '2 po',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.contenants[0]).toEqual({
          id: 'c1',
          name: 'Sac',
          weight: 3,
          price: '2 po',
          addedBy: 'player',
        });
      });

      it('itemId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithContenants());

        await expect(
          service.updateContenant('char1', 'u1', 'missing', { weight: 1 }),
        ).rejects.toThrow(NotFoundException);
      });

      it('un itemId valide mais appartenant à une autre catégorie (animaux) → NotFoundException, pour la bonne raison (deferred-work, gap de test comblé)', async () => {
        prisma.character.findUnique.mockResolvedValue(
          makeCharacterWithAnimaux([{ id: 'a1', name: 'Monture' }]),
        );

        await expect(service.updateContenant('char1', 'u1', 'a1', { weight: 1 })).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('removeContenant()', () => {
      it('retire le bon contenant par id', async () => {
        const character = makeCharacterWithContenants([
          { id: 'c1', name: 'Sac', weight: 2, addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.removeContenant('char1', 'u1', 'c1');

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.contenants).toEqual([]);
      });

      it('itemId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithContenants());

        await expect(service.removeContenant('char1', 'u1', 'missing')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('addAnimal() (Story 14.1, FR8)', () => {
      it('ajoute un animal avec prix/effet, addedBy forcé à player — jamais de champ weight', async () => {
        const character = makeCharacterWithAnimaux();
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.addAnimal('char1', 'u1', {
          name: 'Cheval',
          price: '20 po',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.animaux).toEqual([
          {
            id: 'fixed-uuid',
            name: 'Cheval',
            price: '20 po',
            addedBy: 'player',
          },
        ]);
        expect(data.sheetData.equipment.animaux[0]).not.toHaveProperty('weight');
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(
          service.addAnimal('char1', 'stranger', { name: 'Cheval' } as any),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('updateAnimal()', () => {
      it('modifie le nom/prix/effet du bon animal par id', async () => {
        const character = makeCharacterWithAnimaux([
          { id: 'a1', name: 'Cheval', addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.updateAnimal('char1', 'u1', 'a1', {
          effect: 'Rapide',
        });

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.animaux[0]).toEqual({
          id: 'a1',
          name: 'Cheval',
          effect: 'Rapide',
          addedBy: 'player',
        });
      });

      it('itemId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithAnimaux());

        await expect(
          service.updateAnimal('char1', 'u1', 'missing', { effect: 'x' }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('removeAnimal()', () => {
      it('retire le bon animal par id', async () => {
        const character = makeCharacterWithAnimaux([
          { id: 'a1', name: 'Cheval', addedBy: 'player' },
        ]);
        prisma.character.findUnique.mockResolvedValue(character);
        prisma.character.updateMany.mockResolvedValue({ count: 1 });
        prisma.character.findUniqueOrThrow.mockResolvedValue(character);

        await service.removeAnimal('char1', 'u1', 'a1');

        const data = writtenData(prisma.character.updateMany);
        expect(data.sheetData.equipment.animaux).toEqual([]);
      });

      it('itemId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacterWithAnimaux());

        await expect(service.removeAnimal('char1', 'u1', 'missing')).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  describe('notes', () => {
    function makeNote(overrides: Record<string, unknown> = {}) {
      return {
        id: 'note-1',
        characterId: 'char1',
        text: 'Une note',
        shared: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
      };
    }

    describe('addNote()', () => {
      it('crée une note avec shared: false par défaut', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.create.mockResolvedValue(makeNote());

        const result = await service.addNote('char1', 'u1', {
          text: 'Une note',
        });

        expect(prisma.characterNote.create).toHaveBeenCalledWith({
          data: { characterId: 'char1', text: 'Une note', shared: false },
        });
        expect(result).toEqual({
          id: 'note-1',
          characterId: 'char1',
          text: 'Une note',
          shared: false,
          scenarioId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      });

      it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.create.mockResolvedValue(makeNote());

        await service.addNote('char1', 'u1', { text: 'Une note' });

        expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(service.addNote('char1', 'stranger', { text: 'x' } as any)).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.characterNote.create).not.toHaveBeenCalled();
      });

      it("n'appelle jamais characterSnapshot.create (FR-12 exclut les notes)", async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.create.mockResolvedValue(makeNote());

        await service.addNote('char1', 'u1', { text: 'x' });

        expect(prisma.characterSnapshot.create).not.toHaveBeenCalled();
      });
    });

    describe('toggleNoteShare()', () => {
      it('bascule shared de false à true', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote({ shared: false }));
        prisma.characterNote.update.mockResolvedValue(makeNote({ shared: true }));

        const result = await service.toggleNoteShare('char1', 'u1', 'note-1', true);

        expect(prisma.characterNote.update).toHaveBeenCalledWith({
          where: { id: 'note-1' },
          data: { shared: true },
        });
        expect(result.shared).toBe(true);
      });

      it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote({ shared: false }));
        prisma.characterNote.update.mockResolvedValue(makeNote({ shared: true }));

        await service.toggleNoteShare('char1', 'u1', 'note-1', true);

        expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('noteId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(null);

        await expect(service.toggleNoteShare('char1', 'u1', 'note-inconnue', true)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('noteId appartient à un AUTRE personnage → NotFoundException (garde anti-énumération)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote({ characterId: 'char-autre' }));

        await expect(service.toggleNoteShare('char1', 'u1', 'note-1', true)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(service.toggleNoteShare('char1', 'stranger', 'note-1', true)).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe('setJournalAutoAssociate()', () => {
      it('propriétaire → écrit journalAutoAssociate et le reflète dans le CharacterDto', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.character.update.mockResolvedValue(makeCharacter({ journalAutoAssociate: true }));
        permissions.assert.mockImplementation(
          grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
        );

        const result = await service.setJournalAutoAssociate('char1', 'u1', true);

        expect(prisma.character.update).toHaveBeenCalledWith({
          where: { id: 'char1' },
          data: { journalAutoAssociate: true },
        });
        expect(result.journalAutoAssociate).toBe(true);
      });

      it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.character.update.mockResolvedValue(makeCharacter({ journalAutoAssociate: true }));
        permissions.assert.mockImplementation(
          grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
        );

        await service.setJournalAutoAssociate('char1', 'u1', true);

        expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('non-propriétaire → ForbiddenException, aucune écriture', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(service.setJournalAutoAssociate('char1', 'stranger', true)).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.character.update).not.toHaveBeenCalled();
      });

      it('personnage introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(null);

        await expect(service.setJournalAutoAssociate('char1', 'u1', true)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.character.update).not.toHaveBeenCalled();
      });
    });

    describe('setNoteScenario()', () => {
      it('propriétaire → associe une note à un scénario de sa Partie (non-épisodique)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue({
          event: { partieId: 'p1' },
        });
        prisma.partie.findUnique.mockResolvedValue({
          kind: 'CAMPAGNE_LINEAIRE',
        });
        prisma.characterNote.update.mockResolvedValue(makeNote({ scenarioId: 'scenario1' }));

        const result = await service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1');

        expect(prisma.characterNote.update).toHaveBeenCalledWith({
          where: { id: 'note-1' },
          data: { scenarioId: 'scenario1' },
        });
        expect(result.scenarioId).toBe('scenario1');
      });

      it('émet un événement temps réel scopé sur la Partie (Story 18.1, AC1)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue({
          event: { partieId: 'p1' },
        });
        prisma.partie.findUnique.mockResolvedValue({
          kind: 'CAMPAGNE_LINEAIRE',
        });
        prisma.characterNote.update.mockResolvedValue(makeNote({ scenarioId: 'scenario1' }));

        await service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1');

        expect(realtimeEvents.emit).toHaveBeenCalledWith(partieTopic('p1'));
      });

      it('CAMPAGNE_EPISODIQUE, personnage participant → association acceptée', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue({
          event: { partieId: 'p1' },
        });
        prisma.partie.findUnique.mockResolvedValue({
          kind: 'CAMPAGNE_EPISODIQUE',
        });
        prisma.scenarioParticipant.findUnique.mockResolvedValue({
          id: 'sp1',
          scenarioId: 'scenario1',
          userId: 'u1',
        });
        prisma.characterNote.update.mockResolvedValue(makeNote({ scenarioId: 'scenario1' }));

        await service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1');

        expect(prisma.scenarioParticipant.findUnique).toHaveBeenCalledWith({
          where: {
            scenarioId_userId: { scenarioId: 'scenario1', userId: 'u1' },
          },
        });
        expect(prisma.characterNote.update).toHaveBeenCalledWith({
          where: { id: 'note-1' },
          data: { scenarioId: 'scenario1' },
        });
      });

      it('CAMPAGNE_EPISODIQUE, personnage NON participant → rejet 400, aucune écriture', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue({
          event: { partieId: 'p1' },
        });
        prisma.partie.findUnique.mockResolvedValue({
          kind: 'CAMPAGNE_EPISODIQUE',
        });
        prisma.scenarioParticipant.findUnique.mockResolvedValue(null);

        await expect(service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('scénario appartenant à une AUTRE Partie → rejet 400 (isolation multi-Partie), aucune écriture', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue({
          event: { partieId: 'partie-autre' },
        });

        await expect(service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('scénario introuvable → rejet 400, aucune écriture', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote());
        prisma.scenario.findUnique.mockResolvedValue(null);

        await expect(service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1')).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('scenarioId null → désassocie, aucune validation de scénario', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote({ scenarioId: 'scenario1' }));
        prisma.characterNote.update.mockResolvedValue(makeNote({ scenarioId: null }));

        await service.setNoteScenario('char1', 'u1', 'note-1', null);

        expect(prisma.scenario.findUnique).not.toHaveBeenCalled();
        expect(prisma.characterNote.update).toHaveBeenCalledWith({
          where: { id: 'note-1' },
          data: { scenarioId: null },
        });
      });

      it('noteId introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(null);

        await expect(
          service.setNoteScenario('char1', 'u1', 'note-inconnue', 'scenario1'),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('noteId appartient à un AUTRE personnage → NotFoundException (garde anti-énumération)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findUnique.mockResolvedValue(makeNote({ characterId: 'char-autre' }));

        await expect(service.setNoteScenario('char1', 'u1', 'note-1', 'scenario1')).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });

      it('non-propriétaire → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter({ userId: 'owner' }));

        await expect(
          service.setNoteScenario('char1', 'stranger', 'note-1', 'scenario1'),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.characterNote.update).not.toHaveBeenCalled();
      });
    });

    describe('getRetrospectiveNotes()', () => {
      const WINDOW_START = new Date('2026-06-01T00:00:00.000Z');
      const WINDOW_END = new Date('2026-06-30T00:00:00.000Z');

      it('journalAutoAssociate: true + fenêtre valide → OR inclut la branche manuelle ET la branche auto', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: true,
        });
        prisma.characterNote.findMany.mockResolvedValue([]);

        await service.getRetrospectiveNotes('char1', 'scenario1', WINDOW_START, WINDOW_END);

        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: {
            characterId: 'char1',
            OR: [
              { scenarioId: 'scenario1', shared: true },
              {
                shared: true,
                createdAt: { gte: WINDOW_START, lte: WINDOW_END },
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('journalAutoAssociate: false → OR ne contient que la branche manuelle (AC2/AC4)', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: false,
        });
        prisma.characterNote.findMany.mockResolvedValue([]);

        await service.getRetrospectiveNotes('char1', 'scenario1', WINDOW_START, WINDOW_END);

        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: {
            characterId: 'char1',
            OR: [{ scenarioId: 'scenario1', shared: true }],
          },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('journalAutoAssociate: true mais fenêtre null/null (aucune séance datée) → seule la branche manuelle s’applique', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: true,
        });
        prisma.characterNote.findMany.mockResolvedValue([]);

        await service.getRetrospectiveNotes('char1', 'scenario1', null, null);

        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: {
            characterId: 'char1',
            OR: [{ scenarioId: 'scenario1', shared: true }],
          },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('note manuellement associée mais NON partagée → jamais incluse (fix revue de code, fuite de confidentialité)', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: false,
        });
        prisma.characterNote.findMany.mockResolvedValue([]);

        await service.getRetrospectiveNotes('char1', 'scenario1', null, null);

        const call = callArg<{ where: { OR: unknown[] } }>(prisma.characterNote.findMany);
        expect(call.where.OR).toContainEqual({
          scenarioId: 'scenario1',
          shared: true,
        });
        expect(call.where.OR).not.toContainEqual({ scenarioId: 'scenario1' });
      });

      it('personnage sans notes pertinentes → tableau vide, jamais une erreur', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: false,
        });
        prisma.characterNote.findMany.mockResolvedValue([]);

        const result = await service.getRetrospectiveNotes('char1', 'scenario1', null, null);

        expect(result).toEqual([]);
      });

      it('mappe les notes trouvées via toNoteDto', async () => {
        prisma.character.findUnique.mockResolvedValue({
          journalAutoAssociate: false,
        });
        prisma.characterNote.findMany.mockResolvedValue([
          makeNote({ id: 'n1', scenarioId: 'scenario1' }),
        ]);

        const result = await service.getRetrospectiveNotes('char1', 'scenario1', null, null);

        expect(result).toEqual([
          {
            id: 'n1',
            characterId: 'char1',
            text: 'Une note',
            shared: false,
            scenarioId: 'scenario1',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      });
    });

    describe('getNotes()', () => {
      it('propriétaire → toutes les entrées (privées + partagées)', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        prisma.characterNote.findMany.mockResolvedValue([
          makeNote({ id: 'n1', shared: false }),
          makeNote({ id: 'n2', shared: true }),
        ]);

        const result = await service.getNotes('char1', 'u1');

        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: { characterId: 'char1' },
          orderBy: { createdAt: 'desc' },
        });
        expect(result).toHaveLength(2);
        expect(permissions.assert).not.toHaveBeenCalled();
      });

      it('MJ → toutes les entrées', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        permissions.assert.mockImplementation(
          grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
        );
        prisma.characterNote.findMany.mockResolvedValue([makeNote({ id: 'n1', shared: false })]);

        await service.getNotes('char1', 'mj1');

        expect(permissions.assert).toHaveBeenCalledWith('mj1', 'CHARACTER_NOTES_READ', {
          characterId: 'char1',
        });
        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: { characterId: 'char1' },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('autre participant (membre non-MJ) → uniquement shared: true', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        permissions.assert.mockImplementation(
          grantByOwner({ id: 'p1', ownerId: 'mj1', gameSystemId: 'ryuutama' }),
        );
        prisma.characterNote.findMany.mockResolvedValue([]);

        await service.getNotes('char1', 'joueur-tiers');

        expect(prisma.characterNote.findMany).toHaveBeenCalledWith({
          where: { characterId: 'char1', shared: true },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('non-participant (ni MJ ni membre) → ForbiddenException', async () => {
        prisma.character.findUnique.mockResolvedValue(makeCharacter());
        permissions.assert.mockRejectedValue(new ForbiddenException());

        await expect(service.getNotes('char1', 'stranger')).rejects.toThrow(ForbiddenException);
      });

      it('personnage introuvable → NotFoundException', async () => {
        prisma.character.findUnique.mockResolvedValue(null);

        await expect(service.getNotes('unknown', 'u1')).rejects.toThrow(NotFoundException);
      });
    });
  });
});
