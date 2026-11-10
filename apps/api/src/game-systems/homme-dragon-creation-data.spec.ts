import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Story 33.3 — contrôle de forme des VRAIS catalogues du parcours de création de l'Homme Dragon
// (système de fichiers réel, aucun mock). Le wizard lit ces clés par égalité stricte : une
// coquille masquerait une aide sans erreur. La qualité rédactionnelle relève de la revue de
// contenu, pas de ce test.

type RaceEntry = {
  key?: unknown;
  label?: unknown;
  description?: unknown;
  preferences?: unknown;
};

type IntroEntry = { key?: unknown; label?: unknown; text?: unknown };

const DATA_DIR = join(__dirname, '../../game-systems/ryuutama/data');
const RACES = ['DRAGON_VERT', 'DRAGON_BLEU', 'DRAGON_ROUGE', 'DRAGON_NOIR'];
const INTRO_KEYS = [
  'race',
  'artefact',
  'artefactNom',
  'artefactInscription',
  'nom',
  'apparence',
  'caractere',
  'vocation',
  'demeure',
  'mondesProteges',
  'avatar',
];

const isFilled = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

describe('homme-dragon-races.json (données Ryuutama, Story 33.3)', () => {
  const races = JSON.parse(
    readFileSync(join(DATA_DIR, 'homme-dragon-races.json'), 'utf-8'),
  ) as RaceEntry[];

  it('contient exactement les 4 races, aux clés uniques', () => {
    expect(races.map((r) => r.key).sort()).toEqual([...RACES].sort());
  });

  it.each(RACES)('%s : libellé, description et préférences non vides', (key) => {
    const race = races.find((r) => r.key === key)!;
    expect(isFilled(race.label)).toBe(true);
    expect(isFilled(race.description)).toBe(true);
    expect(Array.isArray(race.preferences)).toBe(true);
    const prefs = race.preferences as unknown[];
    expect(prefs.length).toBeGreaterThan(0);
    expect(prefs.every(isFilled)).toBe(true);
  });
});

describe('homme-dragon-creation-intros.json (données Ryuutama, Story 33.3)', () => {
  const intros = JSON.parse(
    readFileSync(join(DATA_DIR, 'homme-dragon-creation-intros.json'), 'utf-8'),
  ) as IntroEntry[];

  it('contient exactement les clés attendues par le wizard, sans doublon', () => {
    const keys = intros.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...INTRO_KEYS].sort());
  });

  it('aucune valeur vide (clé, libellé, texte)', () => {
    const incomplets = intros
      .filter((i) => !isFilled(i.key) || !isFilled(i.label) || !isFilled(i.text))
      .map((i) => String(i.key));
    expect(incomplets).toEqual([]);
  });
});
