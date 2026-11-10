import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'node:fs/promises';
import { GameSystemService } from './game-system.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permissions/permission.service';
import { testGrant } from '../common/test-utils/grant';

function makePrisma() {
  return {
    gameSystem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    contentType: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    contentEntry: {
      upsert: jest.fn(),
    },
  };
}

/** Story 37.7 : les droits sont décidés par `PermissionService.assert()`, simulé ici. */
function makePermissions() {
  return { assert: jest.fn() };
}

describe('GameSystemService', () => {
  let service: GameSystemService;
  let prisma: ReturnType<typeof makePrisma>;
  let permissions: ReturnType<typeof makePermissions>;
  const mockReadFile = readFile as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = makePrisma();
    permissions = makePermissions();
    const module = await Test.createTestingModule({
      providers: [
        GameSystemService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissions },
      ],
    }).compile();
    service = module.get(GameSystemService);
  });

  it('seedRyuutama() enregistre les catalogues Homme Dragon (races, textes de création, capacités de niveau, souffles rituels) avec toutes leurs entrées (Stories 33.3 et 33.7)', async () => {
    // Vrai répertoire de données (cwd Jest = apps/api) : seul le module fs/promises est mocké
    // dans ce fichier, on le redirige vers l'implémentation réelle pour ce test.
    const actualFs = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
    mockReadFile.mockImplementation((path: string, enc: BufferEncoding) =>
      actualFs.readFile(path, enc),
    );
    const contentTypeIds: Record<string, string> = {};
    prisma.contentType.upsert.mockImplementation(({ create }: { create: { key: string } }) => {
      contentTypeIds[create.key] = `ct-${create.key}`;
      return Promise.resolve({ id: `ct-${create.key}` });
    });

    await service.seedRyuutama();

    const dataDir = join(process.cwd(), 'game-systems/ryuutama/data');
    const countEntries = (file: string): number =>
      (JSON.parse(readFileSync(join(dataDir, file), 'utf-8')) as unknown[]).length;
    const entryUpserts = (typeKey: string): unknown[] =>
      prisma.contentEntry.upsert.mock.calls.filter(
        ([arg]: [{ create: { contentTypeId: string } }]) =>
          arg.create.contentTypeId === `ct-${typeKey}`,
      );

    for (const [typeKey, file] of [
      ['hommeDragonRace', 'homme-dragon-races.json'],
      ['hommeDragonCreationIntro', 'homme-dragon-creation-intros.json'],
      ['hommeDragonLevelCapacity', 'homme-dragon-level-capacities.json'],
      ['souffleRituel', 'souffles-rituels.json'],
    ]) {
      expect(prisma.contentType.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ gameSystemId: 'ryuutama', key: typeKey }),
        }),
      );
      expect(entryUpserts(typeKey)).toHaveLength(countEntries(file));
    }
    expect(entryUpserts('hommeDragonRace')).toHaveLength(4);
    expect(entryUpserts('hommeDragonLevelCapacity')).toHaveLength(6);
    expect(entryUpserts('souffleRituel')).toHaveLength(6);
  });

  it('getContent("ryuutama") → retourne le contenu groupé par clé de ContentType', async () => {
    prisma.contentType.findMany.mockResolvedValue([
      {
        key: 'class',
        entries: [
          { key: 'artisan', data: { label: 'Artisan' } },
          { key: 'chasseur', data: { label: 'Chasseur' } },
        ],
      },
      {
        key: 'weaponCategory',
        entries: [{ key: 'arc', data: { label: 'Arc' } }],
      },
    ]);

    const result = await service.getContent('ryuutama');

    expect(result).toEqual({
      class: [
        { key: 'artisan', data: { label: 'Artisan' } },
        { key: 'chasseur', data: { label: 'Chasseur' } },
      ],
      weaponCategory: [{ key: 'arc', data: { label: 'Arc' } }],
    });
    expect(prisma.contentType.findMany).toHaveBeenCalledWith({
      where: { gameSystemId: 'ryuutama' },
      include: { entries: { where: { scope: 'BASE' } } },
    });
  });

  it('getContent("unknown") → NotFoundException', async () => {
    await expect(service.getContent('unknown')).rejects.toThrow(NotFoundException);
    expect(prisma.contentType.findMany).not.toHaveBeenCalled();
  });

  it('getContent() en cache après le premier appel → un seul aller-retour DB pour plusieurs appels', async () => {
    prisma.contentType.findMany.mockResolvedValue([
      { key: 'class', entries: [{ key: 'chasseur', data: {} }] },
    ]);

    const first = await service.getContent('ryuutama');
    const second = await service.getContent('ryuutama');

    expect(prisma.contentType.findMany).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  describe('getSchema', () => {
    it('"ryuutama" présent en base → retourne le schéma', async () => {
      prisma.gameSystem.findUnique.mockResolvedValue({
        id: 'ryuutama',
        name: 'Ryuutama',
        version: '1.0.0',
      });
      const schema = await service.getSchema('ryuutama');
      expect(schema.sheetSchema).toBeDefined();
      expect(prisma.gameSystem.findUnique).toHaveBeenCalledWith({
        where: { id: 'ryuutama' },
      });
    });

    it('id absent de la base → NotFoundException "introuvable" (distinct du cas ci-dessous)', async () => {
      prisma.gameSystem.findUnique.mockResolvedValue(null);
      await expect(service.getSchema('ryuutama')).rejects.toThrow('Système de jeu introuvable');
    });

    it('id présent en base mais aucun schéma codé → NotFoundException "aucun schéma implémenté" (pas confondu avec "introuvable")', async () => {
      prisma.gameSystem.findUnique.mockResolvedValue({
        id: 'conte-de-minuit',
        name: 'Conte de Minuit',
        version: '1.0.0',
      });
      await expect(service.getSchema('conte-de-minuit')).rejects.toThrow(
        'Aucun schéma implémenté pour ce système de jeu',
      );
    });

    it('déclare `lockable` sur les 10 clés (Story 31.6) et `lockableFields` sur attributes, mirroir de `fields`', async () => {
      prisma.gameSystem.findUnique.mockResolvedValue({
        id: 'ryuutama',
        name: 'Ryuutama',
        version: '1.0.0',
      });
      const schema = await service.getSchema('ryuutama');
      const sheetSchema = schema.sheetSchema as Record<
        string,
        { lockable?: boolean; lockableFields?: string[]; fields?: string[] }
      >;
      const lockableKeys = [
        'classId',
        'specialtyTypeId',
        'typeId',
        'attributes',
        'weaponId',
        'customWeapon',
        'fetiqueObject',
        'equipment',
        'startingEquipment',
        'narrative',
      ];
      for (const key of lockableKeys) {
        expect(sheetSchema[key]?.lockable).toBe(true);
      }
      // Hors périmètre (décision utilisateur 2026-09-22) : ces clés existent mais ne sont PAS
      // déclarées `lockable` — la lacune reste préexistante, jamais comblée par cette story.
      expect(sheetSchema).not.toHaveProperty('levelUps');

      expect(sheetSchema.attributes.lockableFields).toEqual(sheetSchema.attributes.fields);
      // Aucune autre clé objet n'a de sous-champs déclarés ici (pas de `fields` à mirroir).
      expect(sheetSchema.customWeapon.lockableFields).toBeUndefined();
      expect(sheetSchema.equipment.lockableFields).toBeUndefined();
      expect(sheetSchema.narrative.lockableFields).toBeUndefined();
    });

    it('déclare un `label` sur chaque clé et `lockableFieldLabels` sur attributes (Story 31.7) — écran schema-driven, aucun libellé en dur côté écran', async () => {
      prisma.gameSystem.findUnique.mockResolvedValue({
        id: 'ryuutama',
        name: 'Ryuutama',
        version: '1.0.0',
      });
      const schema = await service.getSchema('ryuutama');
      const sheetSchema = schema.sheetSchema as Record<
        string,
        { label?: string; lockableFieldLabels?: Record<string, string> }
      >;
      const expectedLabels: Record<string, string> = {
        classId: 'Classe',
        specialtyTypeId: 'Spécialité',
        typeId: 'Type',
        attributes: 'Attributs',
        weaponId: 'Arme favorite',
        customWeapon: 'Arme personnalisée',
        fetiqueObject: 'Objet fétiche',
        equipment: 'Équipement',
        startingEquipment: 'Équipement de départ',
        narrative: 'Narratif',
      };
      for (const [key, label] of Object.entries(expectedLabels)) {
        expect(sheetSchema[key].label).toBe(label);
      }
      expect(sheetSchema.attributes.lockableFieldLabels).toEqual({
        AGI: 'AGI',
        ESP: 'ESP',
        INT: 'INT',
        VIG: 'VIG',
      });
      // Seul `attributes` a des sous-champs déclarés — aucune autre clé n'a de libellés de sous-champ.
      expect(sheetSchema.customWeapon.lockableFieldLabels).toBeUndefined();
      expect(sheetSchema.equipment.lockableFieldLabels).toBeUndefined();
      expect(sheetSchema.narrative.lockableFieldLabels).toBeUndefined();
    });
  });

  describe('getAssetFile', () => {
    beforeEach(() => {
      mockReadFile.mockResolvedValue(Buffer.from('pdf-bytes'));
    });

    it('clé "member" (journal) + membre → fichier retourné, PARTIE_REFERENCE_ASSET_READ vérifié (pas la lecture MJ)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

      const result = await service.getAssetFile('p1', 'ryuutama', 'journal', 'u1');

      expect(permissions.assert).toHaveBeenCalledWith('u1', 'PARTIE_REFERENCE_ASSET_READ', {
        partieId: 'p1',
      });
      expect(permissions.assert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(Buffer.from('pdf-bytes'));
    });

    it('clé "member" (carte) + non-membre → l\'erreur du service de permission est propagée', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.getAssetFile('p1', 'ryuutama', 'carte', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('clé "mj" (monde) + MJ → fichier retourné, PARTIE_REFERENCE_ASSET_MJ_READ vérifié (pas la lecture membre)', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

      const result = await service.getAssetFile('p1', 'ryuutama', 'monde', 'mj1');

      expect(permissions.assert).toHaveBeenCalledWith('mj1', 'PARTIE_REFERENCE_ASSET_MJ_READ', {
        partieId: 'p1',
      });
      expect(permissions.assert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(Buffer.from('pdf-bytes'));
    });

    it('clé "mj" (structure) + joueur non-MJ → l\'erreur du service de permission est propagée', async () => {
      permissions.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.getAssetFile('p1', 'ryuutama', 'structure', 'player1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("clé inconnue → NotFoundException explicite, aucune vérification d'accès déclenchée", async () => {
      await expect(service.getAssetFile('p1', 'ryuutama', 'inexistante', 'u1')).rejects.toThrow(
        'Fiche introuvable',
      );
      expect(permissions.assert).not.toHaveBeenCalled();
    });

    it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
      'clé "%s" (propriété héritée d\'Object) → NotFoundException explicite, jamais un crash ni un accès accordé (revue de code)',
      async (key) => {
        await expect(service.getAssetFile('p1', 'ryuutama', key, 'u1')).rejects.toThrow(
          'Fiche introuvable',
        );
        expect(permissions.assert).not.toHaveBeenCalled();
        expect(mockReadFile).not.toHaveBeenCalled();
      },
    );

    it('systemId inconnu → NotFoundException, aucune résolution de clé tentée', async () => {
      await expect(service.getAssetFile('p1', 'conte-de-minuit', 'journal', 'u1')).rejects.toThrow(
        'Système de jeu introuvable',
      );
      expect(permissions.assert).not.toHaveBeenCalled();
    });

    it('fichier absent du disque → erreur explicite pointant vers le README', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getAssetFile('p1', 'ryuutama', 'journal', 'u1')).rejects.toThrow(
        /introuvable sur le disque/,
      );
    });

    describe('fiches réservées au MJ (Story 12.2)', () => {
      const MJ_KEYS = [
        'monde',
        'monstre',
        'ville',
        'objectif-chasse',
        'objectif-quete',
        'objectif-voyage',
        'oeuf-de-bataille',
        'structure',
      ];

      it.each(MJ_KEYS)(
        'clé "%s" + MJ authentifié → fichier retourné, PARTIE_REFERENCE_ASSET_MJ_READ vérifié sur la bonne Partie (AC1)',
        async (key) => {
          permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'mj1' }));

          const result = await service.getAssetFile('p1', 'ryuutama', key, 'mj1');

          expect(permissions.assert).toHaveBeenCalledWith('mj1', 'PARTIE_REFERENCE_ASSET_MJ_READ', {
            partieId: 'p1',
          });
          expect(permissions.assert).toHaveBeenCalledTimes(1);
          expect(result).toEqual(Buffer.from('pdf-bytes'));
        },
      );

      it.each(MJ_KEYS)(
        'clé "%s" + joueur non-MJ → ForbiddenException propagée, jamais un fichier vide (AC2)',
        async (key) => {
          permissions.assert.mockRejectedValue(new ForbiddenException());

          await expect(service.getAssetFile('p1', 'ryuutama', key, 'player1')).rejects.toThrow(
            ForbiddenException,
          );
          expect(mockReadFile).not.toHaveBeenCalled();
        },
      );

      it('clé MJ inexistante ("objectif-peche") → NotFoundException explicite (AC3)', async () => {
        await expect(
          service.getAssetFile('p1', 'ryuutama', 'objectif-peche', 'mj1'),
        ).rejects.toThrow('Fiche introuvable');
        expect(permissions.assert).not.toHaveBeenCalled();
      });
    });

    it('les 12 clés de la table sont résolues vers un fichier sans lever d\'erreur "Fiche introuvable"', async () => {
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'u1' }));
      permissions.assert.mockResolvedValue(testGrant({ id: 'p1', ownerId: 'u1' }));
      const keys = [
        'journal',
        'carte',
        'evenements',
        'monde',
        'monstre',
        'ville',
        'provisions',
        'objectif-chasse',
        'objectif-quete',
        'objectif-voyage',
        'oeuf-de-bataille',
        'structure',
      ];
      for (const key of keys) {
        await expect(service.getAssetFile('p1', 'ryuutama', key, 'u1')).resolves.toEqual(
          Buffer.from('pdf-bytes'),
        );
      }
    });
  });
});
