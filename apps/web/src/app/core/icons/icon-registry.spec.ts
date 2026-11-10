// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test compare le
// registre aux dossiers de SVG sources.
import { readdirSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';
import { THEMES } from '../theme/tones';
import {
  COMMON_ICONS,
  COMMON_ICON_NAMES,
  THEMED_ICONS,
  THEMED_ICON_NAMES,
  type IconDrawing,
} from './icon-registry.generated';

const SOURCES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../assets-src/icons');

const ALLOWED_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];

describe('Registre d’icônes généré', () => {
  it('compte 71 noms : 30 icônes de sens et 41 utilitaires, sans recouvrement', () => {
    expect(THEMED_ICON_NAMES).toHaveLength(30);
    expect(COMMON_ICON_NAMES).toHaveLength(41);
    expect(new Set([...THEMED_ICON_NAMES, ...COMMON_ICON_NAMES]).size).toBe(71);
  });

  it('contient les utilitaires attendus par les paliers 10.7 et 10.8', () => {
    for (const name of [
      'matin',
      'apres-midi',
      'soir',
      'menu-actions',
      'declarer-dispos',
      'ajouter',
      'fermer',
    ] as const) {
      expect(COMMON_ICON_NAMES).toContain(name);
    }
    for (const name of [
      'nav-parties',
      'nav-personnages',
      'nav-calendrier',
      'nav-compte',
    ] as const) {
      expect(THEMED_ICON_NAMES).toContain(name);
    }
  });

  it('chaque icône de sens porte un dessin pour chacun des thèmes de @master-jdr/shared', () => {
    for (const name of THEMED_ICON_NAMES) {
      expect(Object.keys(THEMED_ICONS[name]).sort()).toEqual([...THEMES].sort());
    }
  });

  it('les noms correspondent exactement aux fichiers de assets-src/icons', () => {
    const names = (dir: string) =>
      (readdirSync(resolve(SOURCES, dir)) as string[]).map((f) => f.replace(/\.svg$/, '')).sort();
    expect([...THEMED_ICON_NAMES].sort()).toEqual(names(THEMES[0]));
    for (const theme of THEMES) expect(names(theme)).toEqual(names(THEMES[0]));
    expect([...COMMON_ICON_NAMES].sort()).toEqual(names('communes'));
  });

  it('tous les dessins ont le viewBox 0 0 32 32 et des balises de la liste blanche', () => {
    const all: IconDrawing[] = [
      ...Object.values(COMMON_ICONS),
      ...THEMED_ICON_NAMES.flatMap((n) => THEMES.map((t) => themedDrawing(n, t))),
    ];
    expect(all).toHaveLength(41 + 30 * 3);
    for (const drawing of all) {
      expect(drawing.viewBox).toBe('0 0 32 32');
      expect(drawing.elements.length).toBeGreaterThan(0);
      for (const el of drawing.elements) expect(ALLOWED_TAGS).toContain(el.tag);
    }
  });

  it.each([...THEMES])(
    'un dessin = un sens : aucun doublon dans le thème %s, utilitaires compris',
    (theme) => {
      const byDrawing = new Map<string, string>();
      const entries: [string, IconDrawing][] = [
        ...THEMED_ICON_NAMES.map((n): [string, IconDrawing] => [n, themedDrawing(n, theme)]),
        ...COMMON_ICON_NAMES.map((n): [string, IconDrawing] => [n, COMMON_ICONS[n]]),
      ];
      for (const [name, drawing] of entries) {
        const signature = JSON.stringify(drawing);
        const twin = byDrawing.get(signature);
        expect(twin, `${name} et ${twin} ont le même dessin dans ${theme}`).toBeUndefined();
        byDrawing.set(signature, name);
      }
    },
  );
});

function themedDrawing(name: (typeof THEMED_ICON_NAMES)[number], theme: (typeof THEMES)[number]) {
  return THEMED_ICONS[name][theme];
}
