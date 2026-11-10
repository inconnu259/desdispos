import type { CharacterDto } from '@desdispos/shared';
import { Test } from '@nestjs/testing';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));
jest.mock('@desdispos/game-rules', () => ({
  mapToPdfFields: jest.fn(
    (
      data: { attributes?: { AGI?: number; ESP?: number; INT?: number; VIG?: number } },
      derived: { PV: number },
      content: {
        classLabel: string;
        capabilityLabels?: { landscape?: Record<string, string> };
      },
    ) => {
      const fields = [
        { field: 'PV max', value: String(derived.PV), kind: 'text' },
        { field: 'Classe 1', value: content.classLabel, kind: 'dropdown' },
        // Même patron que le vrai `mapToPdfFields` (packages/game-rules/src/ryuutama/pdf-field-map.ts) :
        // `String(undefined)` = `"undefined"` quand un seul sous-champ d'attributes est verrouillé
        // (l'objet `attributes` reste présent) — reproduit ici pour exercer le filtrage de
        // `RyuutamaPdfService` (ATTRIBUTE_PDF_FIELDS), pas seulement DERIVED_PDF_FIELDS.
        { field: 'AGI', value: String(data.attributes?.AGI), kind: 'dropdown' },
        { field: 'ESP', value: String(data.attributes?.ESP), kind: 'dropdown' },
        { field: 'INT', value: String(data.attributes?.INT), kind: 'dropdown' },
        { field: 'VIG', value: String(data.attributes?.VIG), kind: 'dropdown' },
      ];
      for (const label of Object.values(content.capabilityLabels?.landscape ?? {})) {
        fields.push({ field: label, value: '+2', kind: 'text' });
      }
      return fields;
    },
  ),
  resolveWeaponCategory: jest.fn(
    (
      weaponId: string,
      catalog: {
        weaponItems: { key: string; label: string; categoryId: string }[];
        weaponCategories: {
          key: string;
          label: string;
          touchFormula: string;
          damageFormula: string;
        }[];
      },
    ) => {
      const item = catalog.weaponItems.find((w) => w.key === weaponId);
      if (!item) return null;
      const category = catalog.weaponCategories.find((c) => c.key === item.categoryId);
      if (!category) return null;
      return {
        weaponLabel: item.label,
        categoryId: category.key,
        categoryLabel: category.label,
        touchFormula: category.touchFormula,
        damageFormula: category.damageFormula,
      };
    },
  ),
  resolveWeapon: jest.fn(
    (
      data: {
        weaponId?: string;
        customWeapon?: { name: string; categoryId: string };
      },
      catalog: {
        weaponItems: { key: string; label: string; categoryId: string }[];
        weaponCategories: {
          key: string;
          label: string;
          touchFormula: string;
          damageFormula: string;
        }[];
      },
    ) => {
      if (data.weaponId) {
        const item = catalog.weaponItems.find((w) => w.key === data.weaponId);
        if (!item) return null;
        const category = catalog.weaponCategories.find((c) => c.key === item.categoryId);
        if (!category) return null;
        return {
          weaponLabel: item.label,
          categoryId: category.key,
          categoryLabel: category.label,
          touchFormula: category.touchFormula,
          damageFormula: category.damageFormula,
        };
      }
      if (data.customWeapon) {
        const category = catalog.weaponCategories.find(
          (c) => c.key === data.customWeapon!.categoryId,
        );
        if (!category) return null;
        return {
          weaponLabel: data.customWeapon.name,
          categoryId: category.key,
          categoryLabel: category.label,
          touchFormula: category.touchFormula,
          damageFormula: category.damageFormula,
        };
      }
      return null;
    },
  ),
}));

import { readFile } from 'node:fs/promises';
import { mapToPdfFields } from '@desdispos/game-rules';
import { RyuutamaPdfService, fitCentered, computePdfCropDraw } from './ryuutama-pdf.service';
import { GameSystemService } from '../game-systems/game-system.service';
import { anyOf, objectLike } from '../common/test-utils/jest-typed';

const mockSetText = jest.fn();
const mockSetFontSize = jest.fn();
const mockSelect = jest.fn();
const mockFlatten = jest.fn();
const mockSave = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const mockDrawImage = jest.fn<
  void,
  [unknown, { x: number; y: number; width: number; height: number }]
>();
const mockPushOperators = jest.fn();
const mockPage = { drawImage: mockDrawImage, pushOperators: mockPushOperators };
const mockEmbeddedImage = { width: 100, height: 100 };
const mockEmbedJpg = jest.fn().mockResolvedValue(mockEmbeddedImage);
const mockEmbedPng = jest.fn().mockResolvedValue(mockEmbeddedImage);
const mockForm = {
  getTextField: jest.fn(() => ({
    setText: mockSetText,
    setFontSize: mockSetFontSize,
  })),
  getDropdown: jest.fn(() => ({ select: mockSelect })),
  flatten: mockFlatten,
};
const mockDoc = {
  getForm: jest.fn(() => mockForm),
  getPages: jest.fn(() => [mockPage]),
  embedJpg: mockEmbedJpg,
  embedPng: mockEmbedPng,
  save: mockSave,
};

jest.mock('pdf-lib', () => ({
  PDFDocument: { load: jest.fn(() => Promise.resolve(mockDoc)) },
  pushGraphicsState: jest.fn(() => 'pushGraphicsState'),
  popGraphicsState: jest.fn(() => 'popGraphicsState'),
  rectangle: jest.fn(() => 'rectangle'),
  clip: jest.fn(() => 'clip'),
  endPath: jest.fn(() => 'endPath'),
}));

function makeContentService() {
  return {
    getContent: jest.fn().mockResolvedValue({
      class: [
        {
          key: 'chasseur',
          data: {
            label: 'Chasseur',
            talents: [
              {
                name: 'Chasse',
                effect: {
                  description: 'Nourrit le groupe selon le résultat du test',
                  conditions: 'Avant le test de campement. Une fois par jour.',
                },
              },
            ],
          },
        },
        { key: 'marchand', data: { label: 'Marchand' } },
      ],
      type: [{ key: 'attaque', data: { label: 'Attaque' } }],
      weaponCategory: [
        {
          key: 'arc',
          data: {
            label: 'Arc',
            touchFormula: 'AGI+INT-2',
            damageFormula: 'AGI',
          },
        },
      ],
      weaponItem: [
        {
          key: 'arc-de-chasse',
          data: { label: 'Arc de chasse', categoryId: 'arc' },
        },
      ],
      landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
      immunityState: [{ key: 'blesse', data: { label: 'Blessé' } }],
    }),
  };
}

function makeCharacter(overrides: Partial<CharacterDto> = {}): CharacterDto {
  const base: CharacterDto = {
    id: 'char1',
    userId: 'u1',
    partieId: 'p1',
    gameSystemId: 'ryuutama',
    sheetData: {
      classId: 'chasseur',
      typeId: 'attaque',
      weaponId: 'arc-de-chasse',
      attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
    },
    derived: {
      PV: 16,
      PE: 12,
      Condition: 14,
      Initiative: 10,
      Encombrement: 11,
    },
    portraitUrl: null,
    portraitCropData: null,
    pdfPortraitCropData: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ownerPseudo: 'alice',
    ownerIsMj: false,
    xp: 0,
    ownerDisplayName: 'Alice',
    viewerIsMj: false,
    journalAutoAssociate: false,
    level: 1,
  };
  return Object.assign(base, overrides);
}

describe('RyuutamaPdfService', () => {
  let service: RyuutamaPdfService;
  let gameSystems: ReturnType<typeof makeContentService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // `readFile` sert à la fois le template PDF (mis en cache) et la lecture d'un éventuel
    // portrait (`readPortraitFile`, `character.service.ts` depuis Story 29.12) — distingue les
    // deux par le chemin demandé.
    (readFile as jest.Mock).mockImplementation((path: string) => {
      if (String(path).includes('portraits')) {
        return Promise.reject(new Error('ENOENT'));
      }
      return Promise.resolve(Buffer.from('fake-pdf-bytes'));
    });
    mockEmbedJpg.mockResolvedValue(mockEmbeddedImage);
    mockEmbedPng.mockResolvedValue(mockEmbeddedImage);
    gameSystems = makeContentService();
    const module = await Test.createTestingModule({
      providers: [RyuutamaPdfService, { provide: GameSystemService, useValue: gameSystems }],
    }).compile();
    service = module.get(RyuutamaPdfService);
  });

  it("format 'editable' : ne flatten pas le formulaire", async () => {
    const result = await service.fillCharacterPdf(makeCharacter(), 'editable');
    expect(mockFlatten).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Buffer);
  });

  it("format '2pages' : flatten le formulaire après remplissage", async () => {
    await service.fillCharacterPdf(makeCharacter(), '2pages');
    expect(mockFlatten).toHaveBeenCalledTimes(1);
  });

  it('remplit les champs texte et dropdown résolus depuis le contenu', async () => {
    await service.fillCharacterPdf(makeCharacter(), 'editable');
    expect(mockForm.getTextField).toHaveBeenCalledWith('PV max');
    expect(mockSetText).toHaveBeenCalledWith('16');
    expect(mockForm.getDropdown).toHaveBeenCalledWith('Classe 1');
    expect(mockSelect).toHaveBeenCalledWith('Chasseur');
  });

  it("derived absent (cadenas de visibilité Story 31.6, attributes/levelUps verrouillé) → aucun crash, champ 'PV max' non écrit", async () => {
    // `character.derived` reste typé plein (`CharacterDto`) mais peut être ABSENT à l'exécution
    // pour un fellow player dont le MJ a verrouillé attributes/levelUps (cf. `hiddenFields`).
    // `mapToPdfFields` (packages/game-rules, mocké ci-dessus comme la vraie implémentation) lit
    // `derived.PV` sans garde — sans le stub + filtrage de `RyuutamaPdfService`, ceci crasherait.
    const character = makeCharacter({ derived: undefined as never });

    const result = await service.fillCharacterPdf(character, 'editable');

    expect(result).toBeInstanceOf(Buffer);
    expect(mockForm.getTextField).not.toHaveBeenCalledWith('PV max');
    expect(mockSetText).not.toHaveBeenCalledWith('16');
    // Le reste de la fiche (non dérivé) continue de se remplir normalement.
    expect(mockForm.getDropdown).toHaveBeenCalledWith('Classe 1');
  });

  it("un seul sous-champ d'attributes verrouillé (Story 31.6, revue de code) → aucun crash, dropdown AGI non écrit, ESP/INT/VIG inchangés", async () => {
    // Reproduit exactement ce que `CharacterService.toDto()` produit pour un verrou ciblé
    // `attributes.AGI` : `sheetData.attributes` reste un objet (les autres sous-champs présents),
    // seule la clé `AGI` est retirée — et `derived` est retiré en entier (dépend d'`attributes`).
    // Sans le filtrage `ATTRIBUTE_PDF_FIELDS`, `mapToPdfFields` produirait `String(undefined)` =
    // `"undefined"` pour le dropdown AGI, une option inexistante sur le template : pdf-lib lève.
    const character = makeCharacter({
      derived: undefined as never,
      sheetData: {
        classId: 'chasseur',
        typeId: 'attaque',
        weaponId: 'arc-de-chasse',
        attributes: { ESP: 6, INT: 6, VIG: 8 },
      },
    });

    const result = await service.fillCharacterPdf(character, 'editable');

    expect(result).toBeInstanceOf(Buffer);
    expect(mockForm.getDropdown).not.toHaveBeenCalledWith('AGI');
    expect(mockSelect).not.toHaveBeenCalledWith('undefined');
    expect(mockForm.getDropdown).toHaveBeenCalledWith('ESP');
    expect(mockForm.getDropdown).toHaveBeenCalledWith('INT');
    expect(mockForm.getDropdown).toHaveBeenCalledWith('VIG');
  });

  it('charge le template une seule fois (cache mémoire)', async () => {
    await service.fillCharacterPdf(makeCharacter(), 'editable');
    await service.fillCharacterPdf(makeCharacter(), '2pages');
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('résout une arme libre (customWeapon, Story 25.2) via resolveWeapon et transmet weaponLabel = nom libre / formules = catégorie référencée', async () => {
    await service.fillCharacterPdf(
      makeCharacter({
        sheetData: {
          classId: 'chasseur',
          typeId: 'attaque',
          weaponId: undefined,
          customWeapon: { name: 'Fléau maison', categoryId: 'arc' },
          attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
        },
      }),
      'editable',
    );

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({
        weaponLabel: 'Fléau maison',
        weaponTouchFormula: 'AGI+INT-2',
        weaponDamageFormula: 'AGI',
        weaponCategoryId: 'arc',
      }),
    );
  });

  it("résout ownerPseudo du CharacterDto et le transmet à mapToPdfFields (champ 'Joueur')", async () => {
    await service.fillCharacterPdf(makeCharacter({ ownerPseudo: 'bob' }), 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({ ownerPseudo: 'bob' }),
    );
  });

  it("résout l'arme via resolveWeaponCategory et transmet weaponLabel/formules/categoryId à mapToPdfFields (Story 25.1)", async () => {
    await service.fillCharacterPdf(makeCharacter(), 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({
        weaponLabel: 'Arc de chasse',
        weaponTouchFormula: 'AGI+INT-2',
        weaponDamageFormula: 'AGI',
        weaponCategoryId: 'arc',
      }),
    );
  });

  it('résout capabilityLabels (landscape/immunity/class) depuis le contenu seedé (Story 6.3)', async () => {
    await service.fillCharacterPdf(makeCharacter(), 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({
        capabilityLabels: {
          landscape: { foret: 'Forêt' },
          immunity: { blesse: 'Blessé' },
          class: { chasseur: 'Chasseur', marchand: 'Marchand' },
        },
      }),
    );
  });

  it("transmet xp du CharacterDto à mapToPdfFields (champ 'PX')", async () => {
    await service.fillCharacterPdf(makeCharacter({ xp: 250 }), 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({ xp: 250 }),
    );
  });

  it('résout la classe secondaire (capacité class, niveau 5) depuis sheetData.levelUps', async () => {
    const withSecondaryClass = makeCharacter({
      sheetData: {
        classId: 'chasseur',
        typeId: 'attaque',
        weaponId: 'arc-de-chasse',
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
        levelUps: [
          {
            level: 5,
            pvAllocated: 0,
            peAllocated: 3,
            capabilities: [{ type: 'class', params: { key: 'marchand' } }],
          },
        ],
      },
    });
    await service.fillCharacterPdf(withSecondaryClass, 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({
        secondaryClassLabel: 'Marchand',
      }),
    );
  });

  it('résout landscapeDropdownValue depuis le premier paysage obtenu (levelUps type landscape)', async () => {
    const withLandscape = makeCharacter({
      sheetData: {
        classId: 'chasseur',
        typeId: 'attaque',
        weaponId: 'arc-de-chasse',
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
        levelUps: [
          {
            level: 3,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'landscape', params: { key: 'foret' } }],
          },
        ],
      },
    });
    await service.fillCharacterPdf(withLandscape, 'editable');

    expect(mapToPdfFields).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      objectLike({ landscapeDropdownValue: 'Forêt' }),
    );
  });

  it('champ auto-size connu (paysage/immunité) => setFontSize(8) appliqué avant setText, jamais sur un champ normal', async () => {
    const withLandscape = makeCharacter({
      sheetData: {
        classId: 'chasseur',
        typeId: 'attaque',
        weaponId: 'arc-de-chasse',
        attributes: { AGI: 4, ESP: 6, INT: 6, VIG: 8 },
        levelUps: [
          {
            level: 3,
            pvAllocated: 1,
            peAllocated: 2,
            capabilities: [{ type: 'landscape', params: { key: 'foret' } }],
          },
        ],
      },
    });
    await service.fillCharacterPdf(withLandscape, 'editable');

    // Le mock mapToPdfFields (cf. jest.mock ci-dessus) pousse un champ "Forêt" quand
    // capabilityLabels.landscape est peuplé — vérifie que setFontSize est appliqué dessus,
    // jamais sur "PV max" (champ normal, déjà 14pt sur le vrai template).
    expect(mockSetFontSize).toHaveBeenCalledWith(8);
    expect(mockSetFontSize).toHaveBeenCalledTimes(1);
  });

  describe('intégration du portrait (Story 4.6)', () => {
    const PORTRAIT_UUID = '11111111-1111-1111-1111-111111111111';

    it('personnage sans portrait => drawImage jamais appelé (AC6)', async () => {
      await service.fillCharacterPdf(makeCharacter(), 'editable');
      expect(mockDrawImage).not.toHaveBeenCalled();
      expect(mockEmbedJpg).not.toHaveBeenCalled();
      expect(mockEmbedPng).not.toHaveBeenCalled();
    });

    it('portrait JPEG => embedJpg puis drawImage sur la page 1 (AC5)', async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('jpeg-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
      });

      await service.fillCharacterPdf(character, 'editable');

      expect(mockEmbedJpg).toHaveBeenCalledWith(Buffer.from('jpeg-bytes'));
      expect(mockEmbedPng).not.toHaveBeenCalled();
      expect(mockDrawImage).toHaveBeenCalledWith(
        mockEmbeddedImage,
        objectLike({
          x: anyOf(Number),
          y: anyOf(Number),
        }),
      );
      // Image carrée (100x100) dans un cadre 188.18x136.48 => mise à l'échelle par la plus
      // petite proportion (136.48/100=1.3648), jamais de déformation ni de débordement du cadre.
      const call = mockDrawImage.mock.calls[0][1];
      expect(call.width).toBeCloseTo(136.48);
      expect(call.height).toBeCloseTo(136.48);
      expect(call.width).toBeLessThanOrEqual(188.18);
      expect(call.height).toBeLessThanOrEqual(136.48);
    });

    it('portrait embarqué avec des dimensions 0×0 => zone laissée vide, pas de crash (division par zéro évitée)', async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('jpeg-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      mockEmbedJpg.mockResolvedValueOnce({ width: 0, height: 0 });
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
      });

      await expect(service.fillCharacterPdf(character, 'editable')).resolves.not.toThrow();
      expect(mockDrawImage).not.toHaveBeenCalled();
    });

    it('template sans page => erreur explicite plutôt qu’un crash silencieux sur getPages()[0]', async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('jpeg-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      mockDoc.getPages.mockReturnValueOnce([]);
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
      });

      await expect(service.fillCharacterPdf(character, 'editable')).rejects.toThrow('sans page');
    });

    it('portrait PNG => embedPng puis drawImage', async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.png`,
      });

      await service.fillCharacterPdf(character, 'editable');

      expect(mockEmbedPng).toHaveBeenCalledWith(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      expect(mockEmbedJpg).not.toHaveBeenCalled();
      expect(mockDrawImage).toHaveBeenCalled();
    });

    it('portrait WEBP => ni embedJpg/embedPng ni drawImage (limitation pdf-lib documentée, pas de crash)', async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('webp-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.webp`,
      });

      await expect(service.fillCharacterPdf(character as any, 'editable')).resolves.toBeInstanceOf(
        Buffer,
      );
      expect(mockEmbedJpg).not.toHaveBeenCalled();
      expect(mockEmbedPng).not.toHaveBeenCalled();
      expect(mockDrawImage).not.toHaveBeenCalled();
    });

    it('portraitUrl invalide (nom de fichier non conforme) => zone laissée vide, pas de crash', async () => {
      const character = makeCharacter({
        portraitUrl: '/uploads/portraits/../../etc/passwd',
      });
      await expect(service.fillCharacterPdf(character as any, 'editable')).resolves.toBeInstanceOf(
        Buffer,
      );
      expect(mockDrawImage).not.toHaveBeenCalled();
    });

    it("embedJpg/embedPng qui échoue (fichier corrompu, rejeté par le parseur strict de pdf-lib) => n'interrompt pas l'export (dégradation gracieuse)", async () => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('corrupted-jpeg-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
      mockEmbedJpg.mockRejectedValue(new Error('Invalid JPEG'));
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
      });

      await expect(service.fillCharacterPdf(character as any, 'editable')).resolves.toBeInstanceOf(
        Buffer,
      );
      expect(mockDrawImage).not.toHaveBeenCalled();
    });
  });

  describe('recadrage dédié du portrait (Story 4.7)', () => {
    const PORTRAIT_UUID = '22222222-2222-2222-2222-222222222222';

    beforeEach(() => {
      (readFile as jest.Mock).mockImplementation((path: string) => {
        if (String(path).includes('portraits')) {
          return Promise.resolve(Buffer.from('jpeg-bytes'));
        }
        return Promise.resolve(Buffer.from('fake-pdf-bytes'));
      });
    });

    it('pdfPortraitCropData renseigné => clip path appliqué puis drawImage (AC3)', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
        pdfPortraitCropData: { scale: 1.5, offsetX: 10, offsetY: -10 },
      });

      await service.fillCharacterPdf(character, 'editable');

      expect(mockPushOperators).toHaveBeenCalledWith(
        'pushGraphicsState',
        'rectangle',
        'clip',
        'endPath',
      );
      expect(mockPushOperators).toHaveBeenCalledWith('popGraphicsState');
      expect(mockDrawImage).toHaveBeenCalledWith(
        mockEmbeddedImage,
        objectLike({
          x: anyOf(Number),
          y: anyOf(Number),
          width: anyOf(Number),
          height: anyOf(Number),
        }),
      );
    });

    it('drawImage qui lève pendant le clip path => popGraphicsState toujours appelé (état graphique jamais laissé déséquilibré)', async () => {
      mockDrawImage.mockImplementationOnce(() => {
        throw new Error('drawImage failed unexpectedly');
      });
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
        pdfPortraitCropData: { scale: 1.5, offsetX: 10, offsetY: -10 },
      });

      await expect(service.fillCharacterPdf(character, 'editable')).rejects.toThrow(
        'drawImage failed unexpectedly',
      );

      expect(mockPushOperators).toHaveBeenCalledWith('popGraphicsState');
    });

    it('pdfPortraitCropData absent (null) => comportement 4.6 inchangé, pas de clip path (AC4)', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
        pdfPortraitCropData: null,
      });

      await service.fillCharacterPdf(character, 'editable');

      expect(mockPushOperators).not.toHaveBeenCalled();
      expect(mockDrawImage).toHaveBeenCalled();
    });

    it('pdfPortraitCropData malformé (forme inattendue) => dégradation gracieuse vers fitCentered, pas de crash', async () => {
      const character = makeCharacter({
        portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
        pdfPortraitCropData: { foo: 'bar' },
      });

      await expect(service.fillCharacterPdf(character as any, 'editable')).resolves.toBeInstanceOf(
        Buffer,
      );
      expect(mockPushOperators).not.toHaveBeenCalled();
      expect(mockDrawImage).toHaveBeenCalled();
    });

    it.each([
      ['scale NaN', { scale: NaN, offsetX: 0, offsetY: 0 }],
      ['scale Infinity', { scale: Infinity, offsetX: 0, offsetY: 0 }],
      ['scale négatif', { scale: -1, offsetX: 0, offsetY: 0 }],
      ['scale hors bornes DTO (>3)', { scale: 10, offsetX: 0, offsetY: 0 }],
      ['offsetX hors bornes DTO (>100)', { scale: 1, offsetX: 500, offsetY: 0 }],
      ['offsetY hors bornes DTO (<-100)', { scale: 1, offsetX: 0, offsetY: -500 }],
    ])(
      'pdfPortraitCropData avec %s (donnée legacy/corrompue) => dégradation gracieuse vers fitCentered, pas de géométrie invalide',
      async (_label, cropData) => {
        const character = makeCharacter({
          portraitUrl: `/uploads/portraits/${PORTRAIT_UUID}.jpg`,
          pdfPortraitCropData: cropData,
        });

        await expect(service.fillCharacterPdf(character, 'editable')).resolves.toBeInstanceOf(
          Buffer,
        );
        expect(mockPushOperators).not.toHaveBeenCalled();
        expect(mockDrawImage).toHaveBeenCalled();
      },
    );
  });

  it('template PDF absent => erreur explicite pointant vers le README', async () => {
    (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    const gs = makeContentService();
    const module = await Test.createTestingModule({
      providers: [RyuutamaPdfService, { provide: GameSystemService, useValue: gs }],
    }).compile();
    const freshService = module.get(RyuutamaPdfService);
    await expect(freshService.fillCharacterPdf(makeCharacter() as any, 'editable')).rejects.toThrow(
      /README/,
    );
  });
});

describe('fitCentered', () => {
  it('image carrée dans un cadre plus large que haut => limitée par la hauteur, centrée horizontalement', () => {
    const result = fitCentered(100, 100, 10, 20, 90, 50);
    // scale = min(90/100, 50/100) = 0.5 => 50x50, centré dans 90x50
    expect(result).toEqual({
      x: 10 + (90 - 50) / 2,
      y: 20,
      width: 50,
      height: 50,
    });
  });

  it('image large (paysage) dans un cadre portrait => limitée par la largeur, centrée verticalement', () => {
    const result = fitCentered(200, 100, 0, 0, 90, 110);
    // scale = min(90/200, 110/100) = 0.45 => 90x45, centré verticalement dans 90x110
    expect(result.width).toBeCloseTo(90);
    expect(result.height).toBeCloseTo(45);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo((110 - 45) / 2);
  });

  it('image haute (portrait) dans un cadre carré => limitée par la hauteur, centrée horizontalement', () => {
    const result = fitCentered(100, 200, 0, 0, 110, 110);
    // scale = min(110/100, 110/200) = 0.55 => 55x110
    expect(result.width).toBeCloseTo(55);
    expect(result.height).toBeCloseTo(110);
    expect(result.x).toBeCloseTo((110 - 55) / 2);
    expect(result.y).toBeCloseTo(0);
  });

  it('ne dépasse jamais les dimensions du cadre, quel que soit le ratio source', () => {
    const cases: [number, number][] = [
      [1, 1000],
      [1000, 1],
      [50, 50],
      [90, 110],
      [1, 1],
    ];
    for (const [w, h] of cases) {
      const result = fitCentered(w, h, 5, 5, 90, 110);
      expect(result.width).toBeLessThanOrEqual(90 + 1e-9);
      expect(result.height).toBeLessThanOrEqual(110 + 1e-9);
      expect(result.x).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(result.y).toBeGreaterThanOrEqual(5 - 1e-9);
    }
  });
});

describe('computePdfCropDraw', () => {
  it('zoom neutre (scale=1, offset=0) => image ENTIÈRE visible (équivalent object-fit: contain), jamais rognée', () => {
    const result = computePdfCropDraw(100, 100, 10, 20, 90, 50, {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    // containScale = min(90/100, 50/100) = 0.5 => 50x50 (l'image entière tient dans le cadre)
    expect(result.width).toBeCloseTo(50);
    expect(result.height).toBeCloseTo(50);
    expect(result.x).toBeCloseTo(10 + (90 - 50) / 2);
    expect(result.y).toBeCloseTo(20 + (50 - 50) / 2);
  });

  it("à scale=1 (contain), l'offset est sans effet (marge nulle dans les deux axes) — l'image entière étant déjà visible, rien à révéler en la déplaçant", () => {
    const result = computePdfCropDraw(100, 100, 0, 0, 100, 50, {
      scale: 1,
      offsetX: 100,
      offsetY: 100,
    });
    // containScale = min(1, 0.5) = 0.5 => 50x50 ; marge nulle (0) dans les deux axes.
    expect(result.x).toBeCloseTo(0 + (100 - 50) / 2);
    expect(result.y).toBeCloseTo(0 + (50 - 50) / 2);
  });

  it("un offsetX/offsetY modéré (non clampé) se résout en pourcentage du CADRE, pas de l'image mise à l'échelle — sinon le même offset produirait un déplacement différent selon le zoom, décorrélant le rendu PDF de l'aperçu web `PortraitCropper` (CSS `transform: translate(%) scale()`, le pourcentage se résout contre la boîte de layout de l'élément, non affectée par `scale()` dans le même transform)", () => {
    // Cadre 100x50, image carrée 100x100 : containScale = min(1, 0.5) = 0.5 (contrainte Y).
    // À scale=1, la marge est nulle (cf. test précédent) — comparaison à des zooms >1 à la place.
    const atZoom2 = computePdfCropDraw(100, 100, 0, 0, 100, 50, {
      scale: 2,
      offsetX: 0,
      offsetY: 10,
    });
    const atZoom3 = computePdfCropDraw(100, 100, 0, 0, 100, 50, {
      scale: 3,
      offsetX: 0,
      offsetY: 10,
    });
    // Le déplacement en pixels induit par offsetY=10% doit être IDENTIQUE aux deux zooms
    // (10% × frameHeight=50 = 5px), et non proportionnel à la hauteur dessinée (qui varie).
    const baseYAtZoom2 = 0 + (50 - 100 * 0.5 * 2) / 2; // -25
    const baseYAtZoom3 = 0 + (50 - 100 * 0.5 * 3) / 2; // -50
    expect(atZoom2.y).toBeCloseTo(baseYAtZoom2 - 5);
    expect(atZoom3.y).toBeCloseTo(baseYAtZoom3 - 5);
  });

  it('zoom maximal (scale=3) avec offset aux bornes (±100) => déplacement borné par la marge disponible, image couvre toujours le cadre', () => {
    const result = computePdfCropDraw(100, 100, 0, 0, 90, 50, {
      scale: 3,
      offsetX: 100,
      offsetY: 100,
    });
    // containScale = 0.5, totalScale = 1.5 => 150x150 ; marge = (150-90)/2=30 (x), (150-50)/2=50 (y)
    expect(result.width).toBeCloseTo(150);
    expect(result.height).toBeCloseTo(150);
    // Le cadre reste toujours entièrement couvert : x+width >= frameX+frameWidth, x <= frameX, etc.
    expect(result.x).toBeLessThanOrEqual(0);
    expect(result.x + result.width).toBeGreaterThanOrEqual(90);
    expect(result.y).toBeLessThanOrEqual(0);
    expect(result.y + result.height).toBeGreaterThanOrEqual(50);
  });

  it("offset qui pousserait la région hors de l'image source (scale=1, cadre de même ratio que l'image) => clampé à 0 (aucune marge disponible dans aucun axe), jamais d'erreur", () => {
    // Cadre carré à la même proportion que l'image (60x60 vs 100x100) : containScale=0.6=coverScale
    // ici (ratios identiques) => l'image à l'échelle (60x60) correspond exactement au cadre.
    const result = computePdfCropDraw(100, 100, 0, 0, 60, 60, {
      scale: 1,
      offsetX: 100,
      offsetY: -100,
    });
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.width).toBeCloseTo(60);
    expect(result.height).toBeCloseTo(60);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });
});
