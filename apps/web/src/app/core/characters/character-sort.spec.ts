import type { MyCharacterDto } from '@desdispos/shared';
import { sortCharacters } from './character-sort';
import { makeCharacterDto } from './character-dto.fixture';

function makeMyCharacter(overrides: Partial<MyCharacterDto> = {}): MyCharacterDto {
  return {
    ...makeCharacterDto(overrides),
    partieId: overrides.partieId ?? 'p1',
    partieName: overrides.partieName ?? 'La Forêt Noire',
    classLabel: overrides.classLabel ?? null,
    typeLabel: overrides.typeLabel ?? null,
    groupRoleLabel: overrides.groupRoleLabel ?? null,
  };
}

describe('sortCharacters (Story 29.9)', () => {
  it('niveau : décroissant, le plus haut niveau en premier', () => {
    const low = makeMyCharacter({ id: 'a', level: 2 });
    const high = makeMyCharacter({ id: 'b', level: 8 });

    const sorted = sortCharacters([low, high], 'niveau');

    expect(sorted.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('partie : ordre alphabétique du nom de la Partie', () => {
    const zebre = makeMyCharacter({ id: 'a', partieName: 'Zebre' });
    const abbaye = makeMyCharacter({ id: 'b', partieName: 'Abbaye' });

    const sorted = sortCharacters([zebre, abbaye], 'partie');

    expect(sorted.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('nom : ordre alphabétique du nom du personnage (characterName())', () => {
    const zebre = makeMyCharacter({ id: 'a', sheetData: { narrative: { name: 'Zebre' } } });
    const abbaye = makeMyCharacter({ id: 'b', sheetData: { narrative: { name: 'Abbaye' } } });

    const sorted = sortCharacters([zebre, abbaye], 'nom');

    expect(sorted.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('valeur hors union (défensif) : ne plante pas, renvoie une copie dans l’ordre d’origine', () => {
    const a = makeMyCharacter({ id: 'a' });
    const b = makeMyCharacter({ id: 'b' });

    const sorted = sortCharacters([a, b], 'inconnu' as never);

    expect(sorted.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('ne mute jamais le tableau reçu en entrée', () => {
    const a = makeMyCharacter({ id: 'a', partieName: 'Zebre' });
    const b = makeMyCharacter({ id: 'b', partieName: 'Abbaye' });
    const input = [a, b];

    sortCharacters(input, 'partie');

    expect(input).toEqual([a, b]);
  });
});
