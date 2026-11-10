import type { CharacterDto, CharacterSnapshotDto, GameSystemContentDto } from '@desdispos/shared';
import {
  capabilityDescription,
  getCapabilitiesByType,
  getFlatCapabilities,
  getLevelUpEntryForSnapshot,
  getLevelUps,
  type FlatCapability,
  type LevelUpEntry,
} from './capability-label.util';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';

const CONTENT: GameSystemContentDto = {
  landscape: [{ key: 'foret', data: { label: 'Forêt' } }],
  immunityState: [{ key: 'blesse', data: { label: 'Blessé' } }],
  class: [{ key: 'marchand', data: { label: 'Marchand' } }],
  type: [{ key: 'technique', data: { label: 'Technique' } }],
  season: [{ key: 'ete', data: { label: 'Été' } }],
};

describe('getLevelUps', () => {
  it('sheetData.levelUps absent → []', () => {
    const character: CharacterDto = makeCharacterDto({ sheetData: {} });
    expect(getLevelUps(character)).toEqual([]);
  });

  it('sheetData.levelUps présent → renvoyé tel quel', () => {
    const levelUps: LevelUpEntry[] = [
      {
        level: 2,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [{ type: 'attribute', params: {} }],
      },
    ];
    const character: CharacterDto = makeCharacterDto({ sheetData: { levelUps } });
    expect(getLevelUps(character)).toEqual(levelUps);
  });
});

describe('getCapabilitiesByType', () => {
  it('filtre les capacités par type (aplaties depuis levelUps[].capabilities)', () => {
    const levelUps: LevelUpEntry[] = [
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
        capabilities: [{ type: 'landscape', params: { key: 'foret' } }],
      },
      {
        level: 7,
        pvAllocated: 1,
        peAllocated: 2,
        capabilities: [{ type: 'landscape', params: { key: 'montagne' } }],
      },
    ];
    const character: CharacterDto = makeCharacterDto({ sheetData: { levelUps } });

    const landscapes = getCapabilitiesByType(character, 'landscape');
    expect(landscapes).toHaveLength(2);
    expect(landscapes.map((e) => e.capability.params['key'])).toEqual(['foret', 'montagne']);
  });

  it('niveau à deux capacités (4) → les deux sont aplaties et filtrables séparément', () => {
    const levelUps: LevelUpEntry[] = [
      {
        level: 4,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [
          { type: 'attribute', params: { attribute: 'VIG' } },
          { type: 'immunity', params: { key: 'blesse' } },
        ],
      },
    ];
    const character: CharacterDto = makeCharacterDto({ sheetData: { levelUps } });

    expect(getCapabilitiesByType(character, 'attribute')).toHaveLength(1);
    expect(getCapabilitiesByType(character, 'immunity')[0].capability.params['key']).toBe('blesse');
  });

  it('aucune entrée du type demandé → []', () => {
    const character: CharacterDto = makeCharacterDto({ sheetData: {} });
    expect(getCapabilitiesByType(character, 'class')).toEqual([]);
  });
});

describe('capabilityDescription', () => {
  it('attribute → "Attribut : {code}"', () => {
    const entry: FlatCapability = {
      level: 2,
      capability: { type: 'attribute', params: { attribute: 'VIG' } },
    };
    expect(capabilityDescription(entry, null)).toBe('Attribut : VIG');
  });

  it('landscape → résout le libellé depuis le contenu seedé', () => {
    const entry: FlatCapability = {
      level: 3,
      capability: { type: 'landscape', params: { key: 'foret' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe('Paysage/climat favori : Forêt');
  });

  it('immunity → résout le libellé depuis le contenu seedé', () => {
    const entry: FlatCapability = {
      level: 4,
      capability: { type: 'immunity', params: { key: 'blesse' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe('Immunité : Blessé');
  });

  it('class → résout le libellé depuis le contenu seedé', () => {
    const entry: FlatCapability = {
      level: 5,
      capability: { type: 'class', params: { key: 'marchand' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe('Classe supplémentaire : Marchand');
  });

  it('type → résout le libellé depuis le contenu seedé', () => {
    const entry: FlatCapability = {
      level: 6,
      capability: { type: 'type', params: { key: 'technique' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe('Type supplémentaire : Technique');
  });

  it('dragon-protection → résout la saison depuis le contenu seedé', () => {
    const entry: FlatCapability = {
      level: 9,
      capability: { type: 'dragon-protection', params: { key: 'ete' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe("Protection d'un dragon : Été");
  });

  it('legendary-journey → texte fixe, aucune résolution de contenu nécessaire', () => {
    const entry: FlatCapability = {
      level: 10,
      capability: { type: 'legendary-journey', params: {} },
    };
    expect(capabilityDescription(entry, null)).toBe('Voyage légendaire débloqué');
  });

  it('clé introuvable dans le contenu → repli sur la clé brute plutôt que planter', () => {
    const entry: FlatCapability = {
      level: 3,
      capability: { type: 'landscape', params: { key: 'inconnu' } },
    };
    expect(capabilityDescription(entry, CONTENT)).toBe('Paysage/climat favori : inconnu');
  });
});

describe('getFlatCapabilities (Story 23.8 : fusion de classCapabilities)', () => {
  it('sheetData.classCapabilities absent → seules les capacités de levelUps[] sont retournées', () => {
    const levelUps: LevelUpEntry[] = [
      {
        level: 2,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [{ type: 'attribute', params: {} }],
      },
    ];
    const character: CharacterDto = makeCharacterDto({ sheetData: { levelUps } });
    expect(getFlatCapabilities(character)).toEqual([
      { level: 2, capability: { type: 'attribute', params: {} } },
    ]);
  });

  it('classCapabilities présent → fusionné avec level: 1 conventionnel, sans toucher levelUps[]', () => {
    const levelUps: LevelUpEntry[] = [
      {
        level: 2,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [{ type: 'attribute', params: {} }],
      },
    ];
    const classCapabilities = [{ type: 'landscape', params: { key: 'foret' } }];
    const character: CharacterDto = makeCharacterDto({
      sheetData: { levelUps, classCapabilities },
    });

    const flat = getFlatCapabilities(character);
    expect(flat).toEqual([
      { level: 2, capability: { type: 'attribute', params: {} } },
      { level: 1, capability: { type: 'landscape', params: { key: 'foret' } } },
    ]);
    // levelUps[] lui-même reste inchangé (jamais fusionné dedans, cf. calcul du niveau).
    expect(getLevelUps(character)).toEqual(levelUps);
  });

  it('getCapabilitiesByType inclut les entrées de classCapabilities (ex. Climatophile dans "landscape")', () => {
    const classCapabilities = [{ type: 'landscape', params: { key: 'foret' } }];
    const character: CharacterDto = makeCharacterDto({
      sheetData: { classCapabilities },
    });
    const landscapes = getCapabilitiesByType(character, 'landscape');
    expect(landscapes).toHaveLength(1);
    expect(landscapes[0].level).toBe(1);
  });

  it('Historique (getLevelUpEntryForSnapshot) non affecté par classCapabilities — lit exclusivement levelUps[]', () => {
    const levelUps: LevelUpEntry[] = [
      {
        level: 2,
        pvAllocated: 2,
        peAllocated: 1,
        capabilities: [{ type: 'attribute', params: {} }],
      },
    ];
    const snapshot: CharacterSnapshotDto = {
      id: 's1',
      characterId: 'char1',
      sheetData: {
        levelUps,
        classCapabilities: [{ type: 'landscape', params: { key: 'foret' } }],
      },
      derived: { PV: 16, PE: 12, Condition: 14, Initiative: 10, Encombrement: 11 },
      level: 2,
      trigger: 'LEVEL_UP',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(getLevelUpEntryForSnapshot(snapshot)).toEqual(levelUps[0]);
  });
});
