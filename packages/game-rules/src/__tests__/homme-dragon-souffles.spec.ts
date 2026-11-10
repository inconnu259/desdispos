import { describe, it, expect } from 'vitest';
import { availableSouffles } from '../ryuutama/homme-dragon-souffles';
import type { SouffleCatalogEntry } from '../ryuutama/homme-dragon-souffles';

function entry(key: string, data: Record<string, unknown> = {}): SouffleCatalogEntry {
  return { key, data: { label: key.toUpperCase(), ps: 1, ...data } };
}

const CATALOGUE: SouffleCatalogEntry[] = [
  entry('passe', { famille: 'temps', ps: 2, reservable: false, description: 'Remonte le temps.' }),
  entry('chance', { famille: 'destin' }),
  entry('fuite', { famille: 'pnj' }),
  entry('nostalgie', { race: 'DRAGON_VERT' }),
  entry('amour', { race: 'DRAGON_BLEU' }),
  entry('defi', { race: 'DRAGON_ROUGE' }),
  entry('courage', { race: 'DRAGON_ROUGE' }),
  entry('massacre', { race: 'DRAGON_NOIR' }),
];

const keys = (groups: ReturnType<typeof availableSouffles>) =>
  groups.map((g) => g.souffles.map((s) => s.key));

describe('availableSouffles', () => {
  it('niveau 1, race Rouge : communs par famille + souffles rouges, aucune autre race', () => {
    const groups = availableSouffles(1, 'DRAGON_ROUGE', CATALOGUE);

    expect(keys(groups)).toEqual([['passe'], ['chance'], ['fuite'], ['defi', 'courage']]);
    expect(groups.map((g) => g.section)).toEqual(['communs', 'communs', 'communs', 'race']);
    expect(groups[3].title).toBe('Souffles du Dragon Rouge');
  });

  it('niveau 2 : toujours pas de souffles multicolores', () => {
    const groups = availableSouffles(2, 'DRAGON_ROUGE', CATALOGUE);

    expect(groups.some((g) => g.section === 'autres-races')).toBe(false);
  });

  it("dès le niveau 3 : les trois autres races, une par groupe, dans l'ordre des races", () => {
    const groups = availableSouffles(3, 'DRAGON_ROUGE', CATALOGUE);
    const others = groups.filter((g) => g.section === 'autres-races');

    expect(others.map((g) => g.title)).toEqual([
      'Souffles du Dragon Vert',
      'Souffles du Dragon Bleu',
      'Souffles du Dragon Noir',
    ]);
    expect(keys(others)).toEqual([['nostalgie'], ['amour'], ['massacre']]);
  });

  it("les communs restent en tête dans l'ordre temps / destin / PNJ, quel que soit l'ordre du catalogue", () => {
    const shuffled = [...CATALOGUE].reverse();

    const groups = availableSouffles(1, 'DRAGON_VERT', shuffled);

    expect(groups.slice(0, 3).map((g) => g.souffles[0].key)).toEqual(['passe', 'chance', 'fuite']);
  });

  it('consigne des familles : temps et destin en portent une, PNJ aucune', () => {
    const groups = availableSouffles(1, 'DRAGON_VERT', CATALOGUE);

    expect(groups[0].consigne).toMatch(/pas être mis en réserve/);
    expect(groups[1].consigne).toBeTruthy();
    expect(groups[2].consigne).toBeNull();
  });

  it('souffle : coût, effet et réservabilité lus du catalogue', () => {
    const [temps] = availableSouffles(1, 'DRAGON_VERT', CATALOGUE);

    expect(temps.souffles[0]).toEqual({
      key: 'passe',
      label: 'PASSE',
      description: 'Remonte le temps.',
      ps: 2,
      reservable: false,
    });
  });

  it('libellé absent → repli sur la clé ; coût et effet absents → null / chaîne vide', () => {
    const groups = availableSouffles(1, 'DRAGON_VERT', [
      { key: 'mystere', data: { famille: 'destin' } },
    ]);

    expect(groups[0].souffles[0]).toEqual({
      key: 'mystere',
      label: 'mystere',
      description: '',
      ps: null,
      reservable: true,
    });
  });

  it('catalogue vide → aucun groupe', () => {
    expect(availableSouffles(5, 'DRAGON_NOIR', [])).toEqual([]);
  });

  it('entrée commune de famille inconnue ou sans data → ignorée, sans erreur', () => {
    const groups = availableSouffles(1, 'DRAGON_VERT', [
      entry('etrange', { famille: 'inconnue' }),
      { key: 'vide' },
      { key: 'nul', data: null },
    ]);

    expect(groups).toEqual([]);
  });

  it('un groupe sans entrée est omis (race sans souffle)', () => {
    const groups = availableSouffles(1, 'DRAGON_NOIR', [entry('fuite', { famille: 'pnj' })]);

    expect(groups.map((g) => g.section)).toEqual(['communs']);
  });
});
