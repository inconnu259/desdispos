import type { MyCharacterDto, MyHommeDragonDto } from '@master-jdr/shared';
import { makeCharacterDto } from './character-dto.fixture';
import { filterMyItems, itemName, mergeMyItems, sortMyItems } from './my-characters-items';

function makeMyCharacter(overrides: Partial<MyCharacterDto> = {}): MyCharacterDto {
  return {
    ...makeCharacterDto(overrides),
    partieName: overrides.partieName ?? 'La Forêt Noire',
    classLabel: null,
    typeLabel: null,
    groupRoleLabel: null,
  };
}

function makeDragon(overrides: Partial<MyHommeDragonDto> = {}): MyHommeDragonDto {
  return {
    id: 'hd1',
    aventures: [{ partieId: 'p1', nom: 'Le Convoi du Nord' }],
    gameSystemId: 'ryuutama',
    nom: 'Skarn',
    race: 'DRAGON_VERT',
    createdAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

const named = (id: string, name: string, extra: Partial<MyCharacterDto> = {}) =>
  makeMyCharacter({ id, sheetData: { narrative: { name } }, ...extra });

describe('my-characters-items (Story 33.5)', () => {
  it('mergeMyItems : personnages puis Hommes Dragons, tagués par nature', () => {
    const items = mergeMyItems([named('c1', 'Alma')], [makeDragon({ id: 'hd1' })]);

    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ['character', 'c1'],
      ['hommeDragon', 'hd1'],
    ]);
  });

  it('itemName : nom du personnage, nom du dragon, repli lisible pour un dragon sans nom', () => {
    const [c, d, anon] = mergeMyItems(
      [named('c1', 'Alma')],
      [makeDragon({ nom: 'Skarn' }), makeDragon({ id: 'hd2', nom: '  ' })],
    );

    expect(itemName(c)).toBe('Alma');
    expect(itemName(d)).toBe('Skarn');
    expect(itemName(anon)).toBe('Homme Dragon sans nom');
  });

  describe('filterMyItems', () => {
    const items = mergeMyItems([named('c1', 'Alma')], [makeDragon({ nom: 'Skarn' })]);

    it('requête vide → tout', () => {
      expect(filterMyItems(items, '  ')).toHaveLength(2);
    });

    it('retient un dragon sur son nom, insensible à la casse', () => {
      expect(filterMyItems(items, 'SKAR').map((i) => i.id)).toEqual(['hd1']);
    });

    it('retient un personnage sur son nom', () => {
      expect(filterMyItems(items, 'alm').map((i) => i.id)).toEqual(['c1']);
    });

    it('aucune correspondance → vide', () => {
      expect(filterMyItems(items, 'zzz')).toEqual([]);
    });
  });

  describe('sortMyItems', () => {
    it('niveau : tous les personnages (plus haut niveau d’abord), puis les dragons par première aventure', () => {
      const items = mergeMyItems(
        [named('low', 'A', { level: 1 }), named('high', 'B', { level: 7 })],
        [
          makeDragon({ id: 'hdZ', aventures: [{ partieId: 'pz', nom: 'Zéphyr' }] }),
          makeDragon({ id: 'hdA', aventures: [{ partieId: 'pa', nom: 'Abbaye' }] }),
        ],
      );

      expect(sortMyItems(items, 'niveau').map((i) => i.id)).toEqual(['high', 'low', 'hdA', 'hdZ']);
    });

    it('partie : les deux natures confondues, par nom de partie', () => {
      const items = mergeMyItems(
        [named('c1', 'Alma', { partieName: 'Zéphyr' })],
        [makeDragon({ id: 'hd1', aventures: [{ partieId: 'pa', nom: 'Abbaye' }] })],
      );

      expect(sortMyItems(items, 'partie').map((i) => i.id)).toEqual(['hd1', 'c1']);
    });

    it('partie : un Homme Dragon se range sur sa PREMIÈRE aventure, pas sur les suivantes', () => {
      const items = mergeMyItems(
        [named('c1', 'Alma', { partieName: 'Mistral' })],
        [
          makeDragon({
            id: 'hdMulti',
            aventures: [
              { partieId: 'p1', nom: 'Zéphyr' },
              { partieId: 'p2', nom: 'Abbaye' },
            ],
          }),
        ],
      );

      // « Zéphyr » (première aventure) après « Mistral », bien que « Abbaye » le précède.
      expect(sortMyItems(items, 'partie').map((i) => i.id)).toEqual(['c1', 'hdMulti']);
    });

    it('partie : les Hommes Dragons sans aventure viennent en dernier, après les personnages', () => {
      const items = mergeMyItems(
        [named('c1', 'Alma', { partieName: 'Zéphyr' })],
        [
          makeDragon({ id: 'hdSans', aventures: [] }),
          makeDragon({ id: 'hdAvec', aventures: [{ partieId: 'p1', nom: 'Abbaye' }] }),
        ],
      );

      expect(sortMyItems(items, 'partie').map((i) => i.id)).toEqual(['hdAvec', 'c1', 'hdSans']);
    });

    it('niveau : un Homme Dragon sans aventure passe après ceux qui en ont', () => {
      const items = mergeMyItems(
        [named('c1', 'Alma', { level: 1 })],
        [
          makeDragon({ id: 'hdSans', aventures: [] }),
          makeDragon({ id: 'hdAvec', aventures: [{ partieId: 'p1', nom: 'Zéphyr' }] }),
        ],
      );

      expect(sortMyItems(items, 'niveau').map((i) => i.id)).toEqual(['c1', 'hdAvec', 'hdSans']);
    });

    it('nom : les deux natures confondues, par nom affiché', () => {
      const items = mergeMyItems([named('c1', 'Zorn')], [makeDragon({ id: 'hd1', nom: 'Ambre' })]);

      expect(sortMyItems(items, 'nom').map((i) => i.id)).toEqual(['hd1', 'c1']);
    });

    it('ne mute pas le tableau reçu', () => {
      const items = mergeMyItems([named('c1', 'Zorn')], [makeDragon({ nom: 'Ambre' })]);
      const before = items.map((i) => i.id);

      sortMyItems(items, 'nom');

      expect(items.map((i) => i.id)).toEqual(before);
    });

    it('critère inconnu → ordre d’origine', () => {
      const items = mergeMyItems([named('c1', 'Zorn')], [makeDragon()]);

      expect(sortMyItems(items, 'inconnu' as never).map((i) => i.id)).toEqual(['c1', 'hd1']);
    });
  });
});
