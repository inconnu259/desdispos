import { describe, it, expect } from 'vitest';
import { mapHommeDragonToPdfFields } from '../ryuutama/homme-dragon-pdf-field-map';
import type { HommeDragonPdfInput } from '../ryuutama/homme-dragon-pdf-field-map';

function makeDto(overrides: Partial<HommeDragonPdfInput> = {}): HommeDragonPdfInput {
  return {
    sheetData: {
      race: 'DRAGON_ROUGE',
      artefact: { key: 'grand-arc' },
      nom: 'Ignis',
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 1, PS: 3 },
    eveilPowers: [],
    ...overrides,
  };
}

function field(
  fields: ReturnType<typeof mapHommeDragonToPdfFields>,
  name: string,
): string | undefined {
  return fields.find((f) => f.field === name)?.value;
}

const CONTENT = {
  raceLabel: 'Dragon Rouge',
  mjPseudo: 'admin',
  eveilPowerLabels: {
    'escorte-du-dragon': 'Escorte du dragon',
    'couche-du-dragon': 'Couche du dragon',
    'attaque-du-dragon': 'Attaque du dragon',
  },
};

describe('mapHommeDragonToPdfFields', () => {
  it('champs simples mappés correctement', () => {
    const dto = makeDto({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc', nom: 'Le Perceur', inscription: 'Pour Ignis' },
        nom: 'Ignis',
        avatar: 'Un dragon rouge ailé',
        vocation: 'Guide des voyageurs',
        demeure: 'Une auberge de montagne',
        mondesProteges: 'Ma Campagne',
      },
      derived: { level: 3, PS: 5 },
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'nom')).toBe('Ignis');
    expect(field(fields, 'couleur')).toBe('Dragon Rouge');
    expect(field(fields, 'niveau')).toBe('3');
    expect(field(fields, 'artefact')).toBe('Le Perceur');
    expect(field(fields, 'inscription')).toBe('Pour Ignis');
    expect(field(fields, 'avatar')).toBe('Un dragon rouge ailé');
    expect(field(fields, 'meneur')).toBe('admin');
    expect(field(fields, 'vocation')).toBe('Guide des voyageurs');
    expect(field(fields, 'demeure')).toBe('Une auberge de montagne');
    expect(field(fields, 'monde_protege_1')).toBe('Ma Campagne');
    expect(field(fields, 'souffle_max')).toBe('5');
  });

  it("cree_le formaté en fr-FR (JJ/MM/AAAA), jamais l'ordre ISO", () => {
    const dto = makeDto({ createdAt: '2026-07-01T00:00:00.000Z' });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'cree_le')).toBe('01/07/2026');
  });

  it("date_sc_N formatée en fr-FR (JJ/MM/AAAA), jamais l'ordre ISO", () => {
    const dto = makeDto({
      historique: [
        {
          scenarioTitle: 'Premier scénario',
          date: '2026-07-10T00:00:00.000Z',
          participants: ['alice'],
        },
      ],
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'date_sc_1')).toBe('10/07/2026');
  });

  it('artefact sans nom personnalisé → libellé du catalogue, jamais la clé', () => {
    const dto = makeDto({
      sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis' },
    });

    const fields = mapHommeDragonToPdfFields(dto, { ...CONTENT, artefactLabel: 'Grand arc' });

    expect(field(fields, 'artefact')).toBe('Grand arc');
  });

  it('artefact avec nom personnalisé → le nom du MJ prime sur le libellé du catalogue', () => {
    const dto = makeDto({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc', nom: 'Le Perceur' },
        nom: 'Ignis',
      },
    });

    const fields = mapHommeDragonToPdfFields(dto, { ...CONTENT, artefactLabel: 'Grand arc' });

    expect(field(fields, 'artefact')).toBe('Le Perceur');
  });

  it('artefact sans nom (espaces seuls) → libellé du catalogue', () => {
    const dto = makeDto({
      sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc', nom: '   ' }, nom: 'Ignis' },
    });

    const fields = mapHommeDragonToPdfFields(dto, { ...CONTENT, artefactLabel: 'Grand arc' });

    expect(field(fields, 'artefact')).toBe('Grand arc');
  });

  it('artefact inconnu du catalogue → repli sur la clé brute (dernier recours)', () => {
    const dto = makeDto({
      sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis' },
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'artefact')).toBe('grand-arc');
  });

  it('champs narratifs optionnels absents → chaîne vide, jamais undefined', () => {
    const dto = makeDto({
      sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis' },
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'avatar')).toBe('');
    expect(field(fields, 'vocation')).toBe('');
    expect(field(fields, 'demeure')).toBe('');
    expect(field(fields, 'inscription')).toBe('');
    expect(field(fields, 'monde_protege_1')).toBe('');
    expect(field(fields, 'monde_protege_2')).toBe('');
    expect(field(fields, 'monde_protege_3')).toBe('');
  });

  it('apparence_caractere concatène apparence et caractère quand les deux existent', () => {
    const dto = makeDto({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        apparence: 'Grand et ailé',
        caractere: 'Calme et protecteur',
      },
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'apparence_caractere')).toBe('Grand et ailé\n\nCalme et protecteur');
  });

  it('apparence_caractere : un seul des deux renseigné → celui-là seul, pas de séparateur orphelin', () => {
    const dto1 = makeDto({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        apparence: 'Grand et ailé',
      },
    });
    const dto2 = makeDto({
      sheetData: {
        race: 'DRAGON_ROUGE',
        artefact: { key: 'grand-arc' },
        nom: 'Ignis',
        caractere: 'Calme',
      },
    });

    expect(field(mapHommeDragonToPdfFields(dto1, CONTENT), 'apparence_caractere')).toBe(
      'Grand et ailé',
    );
    expect(field(mapHommeDragonToPdfFields(dto2, CONTENT), 'apparence_caractere')).toBe('Calme');
  });

  it('apparence_caractere : aucun des deux renseigné → chaîne vide', () => {
    const dto = makeDto({
      sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grand-arc' }, nom: 'Ignis' },
    });

    expect(field(mapHommeDragonToPdfFields(dto, CONTENT), 'apparence_caractere')).toBe('');
  });

  it.each([
    { level: 1, PS: 3, reserve: '0' },
    { level: 3, PS: 5, reserve: '2' },
    { level: 5, PS: 10, reserve: '4' },
  ])(
    'niveau $level : souffle_max = $PS, nombre_souffles = $reserve, souffle_actuel vide',
    ({ level, PS, reserve }) => {
      const fields = mapHommeDragonToPdfFields(makeDto({ derived: { level, PS } }), CONTENT);

      expect(field(fields, 'souffle_max')).toBe(String(PS));
      expect(field(fields, 'nombre_souffles')).toBe(reserve);
      expect(field(fields, 'souffle_actuel')).toBe('');
    },
  );

  it('nombre_souffles ne descend jamais sous 0 (niveau anormal)', () => {
    const fields = mapHommeDragonToPdfFields(makeDto({ derived: { level: 0, PS: 3 } }), CONTENT);

    expect(field(fields, 'nombre_souffles')).toBe('0');
  });

  it('souffle_1..4 : cases vides quand la réserve est absente ou vide', () => {
    for (const reserve of [undefined, [], [null, null, null]]) {
      const base = makeDto();
      const fields = mapHommeDragonToPdfFields(
        makeDto({ sheetData: { ...base.sheetData, reserve } }),
        CONTENT,
      );

      for (const n of [1, 2, 3, 4]) expect(field(fields, `souffle_${n}`)).toBe('');
    }
  });

  it("souffle_1..4 : le nom du souffle (sans coût) de l'emplacement de même numéro", () => {
    const base = makeDto({ derived: { level: 4, PS: 5 } });
    const fields = mapHommeDragonToPdfFields(
      makeDto({
        derived: base.derived,
        sheetData: { ...base.sheetData, reserve: ['courage', 'rituel-du-tabou', null] },
      }),
      { ...CONTENT, reserveLabels: { courage: 'Courage', 'rituel-du-tabou': 'Rituel du tabou' } },
    );

    expect(field(fields, 'souffle_1')).toBe('Courage');
    expect(field(fields, 'souffle_2')).toBe('Rituel du tabou');
    expect(field(fields, 'souffle_3')).toBe('');
    expect(field(fields, 'souffle_4')).toBe('');
    // Rien n'est décompté.
    expect(field(fields, 'nombre_souffles')).toBe('3');
    expect(field(fields, 'souffle_actuel')).toBe('');
  });

  it('souffle_N : repli sur la clé brute si le souffle a quitté le catalogue', () => {
    const base = makeDto();
    const fields = mapHommeDragonToPdfFields(
      makeDto({ sheetData: { ...base.sheetData, reserve: ['souffle-retire'] } }),
      CONTENT,
    );

    expect(field(fields, 'souffle_1')).toBe('souffle-retire');
  });

  it("voyageurs : tous imprimés, répartis dans l'ordre sur les deux zones, un par ligne", () => {
    const dto = makeDto({
      aventures: [
        {
          voyageurs: [
            { userId: 'u1', pseudo: 'alice' },
            { userId: 'u2', pseudo: 'bob' },
            { userId: 'u3', pseudo: 'carla' },
            { userId: 'u4', pseudo: 'dave' },
            { userId: 'u5', pseudo: 'eve' },
          ],
        },
      ],
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'voyageurs_proteges_1')).toBe('alice\nbob\ncarla');
    expect(field(fields, 'voyageurs_proteges_2')).toBe('dave\neve');
    expect(fields.some((f) => f.field === 'voyageurs_proteges_3')).toBe(false);
  });

  it('un seul voyageur → première zone seule, seconde vide', () => {
    const fields = mapHommeDragonToPdfFields(
      makeDto({ aventures: [{ voyageurs: [{ userId: 'u1', pseudo: 'alice' }] }] }),
      CONTENT,
    );

    expect(field(fields, 'voyageurs_proteges_1')).toBe('alice');
    expect(field(fields, 'voyageurs_proteges_2')).toBe('');
  });

  it('deux aventures partageant un joueur → dédoublonné, ordre de première apparition', () => {
    const fields = mapHommeDragonToPdfFields(
      makeDto({
        aventures: [
          {
            voyageurs: [
              { userId: 'u1', pseudo: 'alice' },
              { userId: 'u2', pseudo: 'bob' },
            ],
          },
          {
            voyageurs: [
              { userId: 'u2', pseudo: 'bob' },
              { userId: 'u3', pseudo: 'carla' },
            ],
          },
        ],
      }),
      CONTENT,
    );

    expect(field(fields, 'voyageurs_proteges_1')).toBe('alice\nbob');
    expect(field(fields, 'voyageurs_proteges_2')).toBe('carla');
  });

  it('aucune aventure ou aventures sans voyageur → champs vides, pas undefined', () => {
    const fields = mapHommeDragonToPdfFields(makeDto({ aventures: [] }), CONTENT);

    expect(field(fields, 'voyageurs_proteges_1')).toBe('');
    expect(field(fields, 'voyageurs_proteges_2')).toBe('');
  });

  it('historique : mappé dans son ordre chronologique (sc1 = le plus ancien)', () => {
    const dto = makeDto({
      historique: [
        {
          scenarioTitle: 'Premier scénario',
          date: '2026-01-01T00:00:00.000Z',
          participants: ['alice', 'bob'],
        },
        {
          scenarioTitle: 'Second scénario',
          date: '2026-02-01T00:00:00.000Z',
          participants: ['alice'],
        },
      ],
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'sc1')).toBe('Premier scénario');
    expect(field(fields, 'voy_sc_1')).toBe('alice, bob');
    expect(field(fields, 'sc2')).toBe('Second scénario');
    expect(field(fields, 'voy_sc_2')).toBe('alice');
  });

  it('historique > 12 → seuls les 12 plus récents sont gardés (sc1..sc12)', () => {
    const historique = Array.from({ length: 15 }, (_, i) => ({
      scenarioTitle: `Scénario ${i}`,
      date: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      participants: ['alice'],
    }));
    const dto = makeDto({ historique });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    // Les 3 plus anciens (index 0,1,2 → "Scénario 0/1/2") sont exclus, sc1 démarre à "Scénario 3".
    expect(field(fields, 'sc1')).toBe('Scénario 3');
    expect(field(fields, 'sc12')).toBe('Scénario 14');
    expect(fields.some((f) => f.field === 'sc13')).toBe(false);
  });

  it('historique vide → toutes les lignes sc1..12/date_sc_1..12/voy_sc_1..12 vides', () => {
    const fields = mapHommeDragonToPdfFields(makeDto({ historique: [] }), CONTENT);

    for (let i = 1; i <= 12; i++) {
      expect(field(fields, `sc${i}`)).toBe('');
      expect(field(fields, `date_sc_${i}`)).toBe('');
      expect(field(fields, `voy_sc_${i}`)).toBe('');
    }
  });

  it('eveil_1..4 mappés par NIVEAU (2/3/4/5), pas par ordre du tableau eveilPowers[]', () => {
    // Remplissage hors-ordre : niveau 3 choisi avant niveau 2 (permis par l'API depuis la
    // revue de code de la Story 10.4) — eveil_1 doit quand même refléter le niveau 2.
    const dto = makeDto({
      eveilPowers: [
        { level: 3, key: 'couche-du-dragon' },
        { level: 2, key: 'escorte-du-dragon' },
      ],
    });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'eveil_1')).toBe('Escorte du dragon');
    expect(field(fields, 'eveil_2')).toBe('Couche du dragon');
    expect(field(fields, 'eveil_3')).toBe('');
    expect(field(fields, 'eveil_4')).toBe('');
  });

  it('eveil_N vide si aucun choix fait pour ce niveau, jamais la clé technique brute', () => {
    const dto = makeDto({ eveilPowers: [{ level: 5, key: 'attaque-du-dragon' }] });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'eveil_1')).toBe('');
    expect(field(fields, 'eveil_4')).toBe('Attaque du dragon');
    expect(fields.some((f) => f.value === 'attaque-du-dragon')).toBe(false);
  });

  it("eveil_N vide (pas la clé brute) si le catalogue n'a plus de libellé pour la clé choisie", () => {
    const dto = makeDto({ eveilPowers: [{ level: 2, key: 'pouvoir-retire-du-catalogue' }] });

    const fields = mapHommeDragonToPdfFields(dto, CONTENT);

    expect(field(fields, 'eveil_1')).toBe('');
    expect(fields.some((f) => f.value === 'pouvoir-retire-du-catalogue')).toBe(false);
  });

  it('tous les champs sont de type text (aucun dropdown/checkbox sur ce template)', () => {
    const fields = mapHommeDragonToPdfFields(makeDto(), CONTENT);

    expect(fields.every((f) => f.kind === 'text')).toBe(true);
  });
});
