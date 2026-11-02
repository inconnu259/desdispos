// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit les
// sources de l'application pour les inspecter.
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, join, relative, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';
import { TONE_MAP } from '../theme/tones';

/**
 * Garde stricte « plus de Material Icons » (palier 10.7, épic 51, story 51.8).
 *
 * Remplace le cliquet de la migration (plafond de `<mat-icon>` abaissé zone par zone) : toutes les
 * icônes passent désormais par `<app-icon>` et la police Material Icons n'est plus chargée. Ce test
 * échoue, en nommant le fichier fautif, si l'un de ces éléments réapparaît dans les sources
 * (specs exclues) :
 *  - un `<mat-icon` dans un gabarit (`.html` ou `template:` en ligne d'un `.ts`) ;
 *  - un import de `@angular/material/icon`, ou `MatIconModule` / `MatIconRegistry` ;
 *  - la police elle-même : `Material+Icons` / `Material Icons` (lien de `index.html`, `font-family`),
 *    ou la classe `material-icons` ;
 *  - un caractère servant d'icône (`♥ ✦ ⚔ …` et les entités équivalentes) dans un gabarit hors
 *    commentaires, ou dans une valeur de ton (`core/theme/tones/`).
 *
 * `mat-icon-button` (variante de bouton Angular Material) n'est PAS un `<mat-icon>` : il ne rend
 * aucune ligature de la police (inventaire de la story 51.8).
 */

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** `apps/web/src` : couvre aussi `index.html` et `styles.scss`, hors de `app/`. */
const SRC_DIR = resolve(APP_DIR, '..');

/** Caractères servant d'icône, interdits dans un gabarit et dans les tons. */
const ICON_CHARACTERS = /[♥✦⚔🌿⚙✎✕✓▾▴▸⌄⌃✅⚠❌🔒🔓❮❯‹›☰]|&#9829;|&#8942;|&#9776;|&#9662;/u;

/** Nom de la police, quelle que soit la graphie : `Material+Icons`, `Material Icons`, `Material%20Icons`, `MaterialIcons`, `Material Symbols`. */
const MATERIAL_FONT_NAME = /Material(?:[+ ]|%20)?(?:Icons|Symbols)/i;

/**
 * Exceptions légitimes, déclarées ici avec leur raison — jamais ignorées en silence. Clé : chemin
 * relatif à `apps/web/src` (séparateur `/`) ; valeur : la raison. Vide : le scan n'a trouvé aucun
 * séparateur typographique ni autre usage légitime de ces caractères dans les gabarits ou les tons.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {};

/** Fichiers sources à inspecter : `.html`, `.ts` (specs exclues), `.scss`, `.css`. */
function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(html|scss|css)$/.test(entry.name)) files.push(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) files.push(path);
  }
  return files;
}

/** Chemin lisible, relatif à `apps/web/src`, avec `/` comme séparateur. */
function shortName(path: string): string {
  return (relative(SRC_DIR, path) as string).replace(/\\/g, '/');
}

/** Retire les commentaires HTML puis, hors `.html`, les commentaires de code (bloc et ligne). */
function stripComments(text: string, isMarkup: boolean): string {
  const withoutHtml = text.replace(/<!--[\s\S]*?-->/g, '');
  if (isMarkup) return withoutHtml;
  return withoutHtml.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Les gabarits d'un fichier : le fichier entier pour un `.html`, les `template:` en ligne d'un `.ts`. */
function templatesOf(path: string, text: string): string[] {
  if (path.endsWith('.html')) return [text];
  if (!path.endsWith('.ts')) return [];
  return [...text.matchAll(/template:\s*`([\s\S]*?)`/g)].map((match) => match[1]);
}

/** Problèmes d'un fichier (texte brut), chacun sous la forme « raison ». */
function problemsOf(path: string, raw: string): string[] {
  const problems: string[] = [];
  const isMarkup = path.endsWith('.html');
  const code = stripComments(raw, isMarkup);

  // `<mat-icon` suivi d'autre chose qu'un suffixe de nom (donc pas `<mat-icon-button`).
  const templates = templatesOf(path, raw).map((template) => stripComments(template, true));
  // Un `.ts` est aussi vérifié en entier : gabarit entre apostrophes, dans une constante, une chaîne...
  const wholeTs = path.endsWith('.ts') && /<mat-icon(?![\w-])/.test(code);
  if (wholeTs || templates.some((template) => /<mat-icon(?![\w-])/.test(template))) {
    problems.push('contient un <mat-icon> (utiliser <app-icon>)');
  }
  if (templates.some((template) => ICON_CHARACTERS.test(template))) {
    problems.push("contient un caractère servant d'icône dans un gabarit (utiliser <app-icon>)");
  }

  if (!path.endsWith('.html') && !path.endsWith('.scss') && !path.endsWith('.css')) {
    if (/@angular\/material\/icon\b/.test(code)) {
      problems.push("importe '@angular/material/icon'");
    }
    if (/\bMatIcon(Module|Registry)\b/.test(code)) {
      problems.push('utilise MatIconModule / MatIconRegistry');
    }
  }
  if (/material-icons/.test(code)) {
    problems.push("utilise la classe 'material-icons'");
  }
  // Y compris les commentaires d'`index.html` : la police ne doit plus y être mentionnée du tout.
  if (MATERIAL_FONT_NAME.test(path.endsWith('index.html') ? raw : code)) {
    problems.push('mentionne la police Material Icons');
  }
  return problems;
}

describe('Plus de Material Icons (épic 51, story 51.8)', () => {
  it('aucune source ne réintroduit <mat-icon>, un import Material icon, la police ou un caractère-icône', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const name = shortName(file);
      const problems = problemsOf(file, readFileSync(file, 'utf8') as string);
      if (problems.length === 0) continue;
      if (name in EXCEPTIONS) continue; // exception documentée dans EXCEPTIONS, avec sa raison
      violations.push(...problems.map((problem) => `${name} : ${problem}`));
    }
    expect(violations, violations.join('\n')).toEqual([]);
    // Lecture de tout l'arbre des sources : plus lent que 5 s quand les autres specs tournent en parallèle.
  }, 60_000);

  it('index.html ne charge plus la police Material Icons mais garde Roboto', () => {
    const html = readFileSync(join(SRC_DIR, 'index.html'), 'utf8') as string;
    expect(html).not.toMatch(MATERIAL_FONT_NAME);
    expect(html).not.toContain('fonts.googleapis.com/icon');
    expect(html).toContain('family=Roboto');
    // Les deux `preconnect` eux-mêmes (le href googleapis seul figure aussi dans la feuille Roboto).
    const preconnects = [...html.matchAll(/<link\b[^>]*\brel="preconnect"[^>]*>/g)].map((m) => m[0]);
    expect(preconnects.some((link) => link.includes('href="https://fonts.googleapis.com"'))).toBe(true);
    expect(preconnects.some((link) => link.includes('href="https://fonts.gstatic.com"'))).toBe(true);
  });

  it.each(Object.keys(TONE_MAP))('%s : aucune valeur de ton ne contient de caractère-icône', (theme) => {
    const tone = TONE_MAP[theme as keyof typeof TONE_MAP] as Record<string, unknown>;
    const fautives = Object.entries(tone)
      .filter(([, value]) => typeof value === 'string' && ICON_CHARACTERS.test(value))
      .map(([key, value]) => `${key} = ${String(value)}`);
    expect(fautives, fautives.join('\n')).toEqual([]);
  });

  describe('le détecteur échoue sur chaque réintroduction (en nommant la raison)', () => {
    it('<mat-icon> dans un .html, dans un template en ligne, mais pas mat-icon-button ni un commentaire', () => {
      expect(problemsOf('a.html', '<mat-icon>home</mat-icon>')).toHaveLength(1);
      expect(problemsOf('a.ts', 'x = { template: `<mat-icon>home</mat-icon>`, y: 1 }')).toHaveLength(1);
      expect(problemsOf('a.ts', "x = { template: '<mat-icon>home</mat-icon>' }")).toHaveLength(1);
      expect(problemsOf('a.ts', "const T = '<mat-icon>home</mat-icon>';")).toHaveLength(1);
      expect(problemsOf('a.html', '<button mat-icon-button>x</button>')).toEqual([]);
      expect(problemsOf('a.html', '<!-- <mat-icon>home</mat-icon> -->')).toEqual([]);
    });

    it("un import ou un symbole de l'icône Material", () => {
      expect(problemsOf('a.ts', "import { MatIconModule } from '@angular/material/icon';").length).toBe(2);
      expect(problemsOf('a.ts', 'inject(MatIconRegistry)')).toHaveLength(1);
      expect(problemsOf('a.ts', "// jamais d'import de '@angular/material/icon'")).toEqual([]);
    });

    it('la police et la classe', () => {
      expect(
        problemsOf('index.html', '<link href="https://fonts.googleapis.com/icon?family=Material+Icons" />'),
      ).toHaveLength(1);
      expect(problemsOf('index.html', '<!-- Material+Icons -->')).toHaveLength(1);
      expect(problemsOf('a.html', '<span class="material-icons">x</span>')).toHaveLength(1);
      expect(problemsOf('a.scss', ".x { font-family: 'Material Icons'; }")).toHaveLength(1);
      for (const graphie of ['material icons', 'Material Symbols', 'Material%20Icons', 'MaterialIcons', 'Material+Symbols+Outlined']) {
        expect(problemsOf('a.scss', `.x { font-family: '${graphie}'; }`), graphie).toHaveLength(1);
      }
    });

    it("chaque caractère-icône dans un gabarit, hors commentaire", () => {
      for (const character of [...'♥✦⚔🌿⚙✎✕✓▾▴▸⌄⌃✅⚠❌🔒🔓❮❯‹›☰']) {
        expect(problemsOf('a.html', `<span>${character}</span>`), character).toHaveLength(1);
      }
      for (const entity of ['&#9829;', '&#8942;', '&#9776;', '&#9662;']) {
        expect(problemsOf('a.html', `<span>${entity}</span>`), entity).toHaveLength(1);
      }
      expect(problemsOf('a.html', '<!-- ♥ -->')).toEqual([]);
      expect(problemsOf('a.ts', "x = { template: `<b>✓</b>` }")).toHaveLength(1);
    });
  });
});
