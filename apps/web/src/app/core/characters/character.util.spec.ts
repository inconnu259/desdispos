import type { GameSystemContentDto } from '@master-jdr/shared';
import { characterName, findContentEntry, isFieldHidden } from './character.util';
import { makeCharacterDto as makeCharacter } from './character-dto.fixture';

describe('characterName', () => {
  it('retourne le nom narratif si renseigné', () => {
    const c = makeCharacter({ sheetData: { narrative: { name: 'Fenn' } } });
    expect(characterName(c)).toBe('Fenn');
  });

  it('retourne un libellé de repli si le nom est absent', () => {
    const c = makeCharacter({ sheetData: {} });
    expect(characterName(c)).toBe('Personnage sans nom');
  });

  it('retourne un libellé de repli si le nom est une chaîne vide/espaces', () => {
    const c = makeCharacter({ sheetData: { narrative: { name: '   ' } } });
    expect(characterName(c)).toBe('Personnage sans nom');
  });
});

describe('findContentEntry', () => {
  const CONTENT: GameSystemContentDto = {
    class: [{ key: 'menestrel', data: { label: 'Ménestrel' } }],
  };

  it("retourne les données de l'entrée dont la clé correspond", () => {
    expect(findContentEntry<{ label: string }>(CONTENT, 'class', 'menestrel')).toEqual({
      label: 'Ménestrel',
    });
  });

  it('retourne null si la clé est absente', () => {
    expect(findContentEntry(CONTENT, 'class', undefined)).toBeNull();
  });

  it('retourne null si aucune entrée ne correspond à la clé', () => {
    expect(findContentEntry(CONTENT, 'class', 'inconnu')).toBeNull();
  });

  it('retourne null si le contenu est null/undefined', () => {
    expect(findContentEntry(null, 'class', 'menestrel')).toBeNull();
    expect(findContentEntry(undefined, 'class', 'menestrel')).toBeNull();
  });
});

describe('isFieldHidden (correctif de revue, session bmad-build 2026-09-22)', () => {
  it('true si le chemin figure dans hiddenFields', () => {
    const c = makeCharacter({ hiddenFields: ['attributes', 'equipment'] });
    expect(isFieldHidden(c, 'attributes')).toBe(true);
    expect(isFieldHidden(c, 'equipment')).toBe(true);
  });

  it('false si le chemin ne figure pas dans hiddenFields', () => {
    const c = makeCharacter({ hiddenFields: ['attributes'] });
    expect(isFieldHidden(c, 'equipment')).toBe(false);
  });

  it('false si hiddenFields est absent/vide (propriétaire, MJ, ou partie sans configuration)', () => {
    const c = makeCharacter({ hiddenFields: undefined });
    expect(isFieldHidden(c, 'attributes')).toBe(false);
    expect(isFieldHidden(makeCharacter({ hiddenFields: [] }), 'attributes')).toBe(false);
  });

  it('distingue un sous-champ (attributes.AGI) de la clé entière (attributes)', () => {
    const c = makeCharacter({ hiddenFields: ['attributes.AGI'] });
    expect(isFieldHidden(c, 'attributes.AGI')).toBe(true);
    expect(isFieldHidden(c, 'attributes')).toBe(false);
  });
});
