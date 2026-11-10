import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Story 33.2 — contrôle de forme du VRAI `souffles.json` (système de fichiers réel, aucun mock) :
// la fiche Homme Dragon filtre sur `race`/`famille` par égalité stricte, une coquille
// (`"famille": "PNJ"`, `"race": "DRAGON_ROUGE "`) masquerait donc des souffles sans erreur.
// Le contenu des textes relève de la revue de contenu, pas de ce test.

type SouffleEntry = {
  key?: unknown;
  label?: unknown;
  description?: unknown;
  ps?: unknown;
  race?: unknown;
  famille?: unknown;
  reservable?: unknown;
};

const SOUFFLES_PATH = join(__dirname, '../../game-systems/ryuutama/data/souffles.json');
const FAMILLES = ['temps', 'destin', 'pnj'];
const RACES = ['DRAGON_VERT', 'DRAGON_BLEU', 'DRAGON_ROUGE', 'DRAGON_NOIR'];

describe('souffles.json (données Ryuutama, Story 33.2)', () => {
  const souffles = JSON.parse(readFileSync(SOUFFLES_PATH, 'utf-8')) as SouffleEntry[];
  const communs = souffles.filter((s) => !('race' in s));
  const label = (s: SouffleEntry) => String(s.key);

  it('contient 21 entrées aux clés uniques', () => {
    expect(Array.isArray(souffles)).toBe(true);
    expect(souffles).toHaveLength(21);
    const keys = souffles.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('9 souffles communs (sans race), chacun rattaché à une famille connue', () => {
    expect(communs).toHaveLength(9);
    for (const s of communs) {
      expect({ key: label(s), famille: s.famille }).toEqual({
        key: label(s),
        famille: expect.stringMatching(new RegExp(`^(${FAMILLES.join('|')})$`)),
      });
    }
  });

  it.each(RACES)('exactement 3 souffles pour %s, sans famille', (race) => {
    const deLaRace = souffles.filter((s) => s.race === race);
    expect(deLaRace).toHaveLength(3);
    for (const s of deLaRace) {
      expect({ key: label(s), aUneFamille: 'famille' in s }).toEqual({
        key: label(s),
        aUneFamille: false,
      });
    }
  });

  it('aucune race hors des quatre races connues', () => {
    const racesInconnues = souffles
      .filter((s) => 'race' in s && !RACES.includes(s.race as string))
      .map(label);
    expect(racesInconnues).toEqual([]);
  });

  it('coût 2 PS et non réservable exactement sur la famille temps, 1 PS sans champ reservable ailleurs', () => {
    for (const s of souffles) {
      const attendu =
        s.famille === 'temps'
          ? { key: label(s), ps: 2, reservable: false }
          : { key: label(s), ps: 1, reservable: undefined };
      expect({
        key: label(s),
        ps: s.ps,
        reservable: 'reservable' in s ? s.reservable : undefined,
      }).toEqual(attendu);
    }
  });

  it('libellé et description non vides sur chaque entrée', () => {
    const incomplets = souffles
      .filter(
        (s) =>
          typeof s.label !== 'string' ||
          s.label.trim() === '' ||
          typeof s.description !== 'string' ||
          s.description.trim() === '',
      )
      .map(label);
    expect(incomplets).toEqual([]);
  });
});
