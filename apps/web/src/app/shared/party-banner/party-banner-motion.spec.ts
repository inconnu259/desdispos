// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit des
// fichiers de style pour les vérifier.
import { readFileSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';

/**
 * Garde exécutable de l'AC6 (Story 29.11) : *« les animations n'animent que des transformations
 * et de l'opacité »*, et de DESIGN.md §8 règle 3.
 *
 * Ce test lit les feuilles de style de la story et vérifie leurs `@keyframes`. Il existe parce que
 * la source la plus tentante à recopier — `mockups/palettes-3-pistes-et-rebours-animes.html` —
 * **viole l'AC6** : ses `@keyframes grow`/`fill`/`approach`/`budmove` animent `width` et `left`,
 * et `budglow`/`starburn` animent `box-shadow`. Sans cette garde, une reprise « fidèle à la
 * maquette » passerait tous les autres tests.
 *
 * Il vérifie aussi qu'une feuille déclarant des `@keyframes` déclare une coupure
 * `prefers-reduced-motion` (AC3) : une animation sans coupure est un défaut d'accessibilité que
 * rien d'autre ne détecte.
 */

// Résolus depuis ce fichier (Review Findings) — un chemin relatif au CWD du test-runner
// romprait silencieusement dès que ce dernier diffère de la racine `apps/web` supposée.
const HERE = dirname(fileURLToPath(import.meta.url));
const STYLESHEETS = [
  resolve(HERE, './party-banner.scss'),
  resolve(HERE, '../party-countdown/party-countdown.scss'),
  // Bande de marque des écrans d'authentification (Story 34.4, matrice « Mouvement »).
  resolve(HERE, '../../features/auth/auth-band/auth-band.scss'),
];

/** Seules propriétés animables. Tout le reste force le navigateur à repeindre la page. */
const ALLOWED_PROPERTIES = new Set(['transform', 'opacity']);

/** Propriétés personnalisées : elles ne sont pas peintes, elles alimentent un `transform`. */
function isCustomProperty(property: string): boolean {
  return property.startsWith('--');
}

interface Keyframes {
  name: string;
  body: string;
}

/** Extraction des blocs `@keyframes`, accolades appariées — une regex naïve s'arrêterait à la
 *  première accolade fermante, c'est-à-dire à la fin du premier palier. */
function extractKeyframes(source: string): Keyframes[] {
  const found: Keyframes[] = [];
  const opener = /@keyframes\s+([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    let depth = 1;
    let i = opener.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    found.push({ name: match[1], body: source.slice(opener.lastIndex, i - 1) });
  }
  return found;
}

/** Propriétés déclarées dans un corps de `@keyframes`, paliers confondus. */
function animatedProperties(body: string): string[] {
  const withoutSelectors = body.replace(/[\d.]+%|\bfrom\b|\bto\b/g, '');
  return Array.from(withoutSelectors.matchAll(/([\w-]+)\s*:/g))
    .map((m) => m[1])
    .filter((property) => !isCustomProperty(property));
}

describe('Garde AC6 — aucune animation hors transform/opacity (Story 29.11)', () => {
  for (const path of STYLESHEETS) {
    it(`${path} : chaque @keyframes n'anime que transform et opacity`, () => {
      const source = readFileSync(path, 'utf8');
      const blocks = extractKeyframes(source);

      // Si ce compte tombe à zéro, c'est que le chemin ou l'extraction sont cassés — le test
      // passerait alors en ne vérifiant rien.
      expect(blocks.length).toBeGreaterThan(0);

      for (const block of blocks) {
        for (const property of animatedProperties(block.body)) {
          expect(
            ALLOWED_PROPERTIES.has(property),
            `@keyframes ${block.name} anime "${property}" — seuls transform et opacity sont autorisés (AC6, DESIGN.md §8 règle 3)`,
          ).toBe(true);
        }
      }
    });

    it(`${path} : déclare une coupure prefers-reduced-motion (AC3)`, () => {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('prefers-reduced-motion: reduce');
    });
  }

  it('les propriétés interdites de la maquette sont bien celles que la garde rejette', () => {
    // Vérifie la garde elle-même sur les `@keyframes` réelles de
    // `palettes-3-pistes-et-rebours-animes.html` : sans cela, un bug d'extraction rendrait tous
    // les tests ci-dessus vacuement verts.
    const mockupKeyframes = `
      @keyframes grow{0%{width:6%}88%{width:94%}100%{width:94%}}
      @keyframes budmove{0%{left:6%}88%{left:92%}100%{left:92%}}
    `;
    const blocks = extractKeyframes(mockupKeyframes);
    expect(blocks.length).toBe(2);

    const rejected = blocks.flatMap((b) =>
      animatedProperties(b.body).filter((p) => !ALLOWED_PROPERTIES.has(p)),
    );
    expect(rejected).toContain('width');
    expect(rejected).toContain('left');
  });
});

describe('Bande d’authentification — repos et réduction des animations (Story 34.4)', () => {
  const source = readFileSync(
    resolve(HERE, '../../features/auth/auth-band/auth-band.scss'),
    'utf8',
  ).replace(/\s+/g, ' ');

  it('la comète n’existe qu’en mouvement : .fly est à opacity 0 de base', () => {
    expect(source).toMatch(/\.fly \{ opacity: 0; \}/);
  });

  it('prefers-reduced-motion coupe tout le décor d’office (animation: none)', () => {
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{ \.scene \* \{ animation: none !important; \} \}/,
    );
  });

  it('la pause fige sur place (animation-play-state: paused), sans retour au repos', () => {
    expect(source).toMatch(/\.is-paused \.scene \* \{ animation-play-state: paused !important; \}/);
  });
});
