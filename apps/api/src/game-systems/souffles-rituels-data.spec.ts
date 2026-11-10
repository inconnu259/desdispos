import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Story 33.7 — contrôle de forme des VRAIS `souffles-rituels.json` et
// `homme-dragon-level-capacities.json` (système de fichiers réel, aucun mock). Le contenu des
// textes relève de la revue de contenu, pas de ce test.

type Entry = Record<string, unknown>;

const DATA_DIR = join(__dirname, '../../game-systems/ryuutama/data');
const lire = (file: string): Entry[] =>
  JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')) as Entry[];

describe('souffles-rituels.json (données Ryuutama, Story 33.7)', () => {
  const rituels = lire('souffles-rituels.json');
  const cle = (e: Entry) => String(e.key);

  it('contient 6 entrées aux clés uniques', () => {
    expect(rituels).toHaveLength(6);
    const keys = rituels.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('chaque rituel coûte 1 PS (hypothèse du livre, docs/dragons.md)', () => {
    expect(rituels.map((e) => ({ key: cle(e), ps: e.ps }))).toEqual(
      rituels.map((e) => ({ key: cle(e), ps: 1 })),
    );
  });

  it('aucun rituel ne porte de race, de famille ni de champ reservable (jamais « autre race »)', () => {
    for (const e of rituels) {
      expect({
        key: cle(e),
        race: 'race' in e,
        famille: 'famille' in e,
        reservable: 'reservable' in e,
      }).toEqual({ key: cle(e), race: false, famille: false, reservable: false });
    }
  });

  it('libellé et description non vides sur chaque entrée', () => {
    const incomplets = rituels
      .filter(
        (e) =>
          typeof e.label !== 'string' ||
          e.label.trim() === '' ||
          typeof e.description !== 'string' ||
          e.description.trim() === '',
      )
      .map(cle);
    expect(incomplets).toEqual([]);
  });
});

describe('homme-dragon-level-capacities.json (données Ryuutama, Story 33.7)', () => {
  const capacites = lire('homme-dragon-level-capacities.json');

  it('6 entrées aux clés uniques, niveau entier entre 2 et 5', () => {
    expect(capacites).toHaveLength(6);
    expect(new Set(capacites.map((e) => e.key)).size).toBe(6);
    for (const e of capacites) {
      expect(Number.isInteger(e.level)).toBe(true);
      expect(e.level as number).toBeGreaterThanOrEqual(2);
      expect(e.level as number).toBeLessThanOrEqual(5);
    }
  });

  it("l'artefact cadeau est au niveau 4", () => {
    expect(capacites.find((e) => e.key === 'artefact-cadeau')?.level).toBe(4);
  });
});
