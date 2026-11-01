#!/usr/bin/env node
// Générateur du registre d'icônes (palier 10.7, story 51.1).
//
// Lit les SVG sources de `src/assets-src/icons/` (trois dossiers de thème de 30 icônes « de sens »
// + `communes/` de 41 utilitaires) et écrit `src/app/core/icons/icon-registry.generated.ts` : des
// DONNÉES (viewBox + éléments {tag, attrs}), jamais du balisage. `<app-icon>` les rend par
// liaisons d'attributs de gabarit, sans `innerHTML` ni contournement du sanitiseur.
//
// Node seul, aucune dépendance. Tout se lance dans le conteneur `web` (aucun Node sur l'hôte) :
//   docker compose exec web node scripts/generate-icons.mjs            écrit le registre
//   docker compose exec web node scripts/generate-icons.mjs --check    code 1 si le registre committé diffère
//   docker compose exec web node --test 'scripts/*.test.mjs'           tests du générateur
// Options réservées aux tests : --src <dossier> --out <fichier>. Tout autre argument est refusé.
// (`node --test scripts/` ne fonctionne pas : Node 22+ ne parcourt pas un dossier, d'où le motif.)

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SRC = resolve(HERE, '../src/assets-src/icons');
const DEFAULT_OUT = resolve(HERE, '../src/app/core/icons/icon-registry.generated.ts');

/** Dossiers de thème. Ce script ne peut pas importer `THEMES` (TypeScript) : la parité avec
 *  `@master-jdr/shared` est assertée par `icon-registry.spec.ts`. */
export const THEME_DIRS = ['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'];
export const COMMON_DIR = 'communes';

const VIEW_BOX = '0 0 32 32';

/** Balises autorisées dans un dessin, avec les attributs géométriques propres à chacune. */
const ALLOWED_TAGS = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
};

/** Attributs de présentation acceptés sur toute balise de dessin. */
const COMMON_ATTRS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'opacity',
];

/** Balises dont la présence a un message dédié. */
const FORBIDDEN_TAGS = new Set(['mask', 'clippath', 'style', 'script']);

/** Attributs refusés, avec leur raison. Comparés en minuscules. */
const FORBIDDEN_ATTRS = new Set(['id', 'mask', 'clippath', 'clip-path', 'style', 'href', 'xlink:href']);

/** Attributs admis sur la racine `<svg>` (la valeur est imposée : `<app-icon>` les pose lui-même,
 *  une valeur différente changerait silencieusement le dessin). Aucune valeur libre. */
const ROOT_ATTRS = {
  viewBox: VIEW_BOX,
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
  xmlns: 'http://www.w3.org/2000/svg',
};

/** Refuse une balise enfant interdite ou hors liste (appelé dès l'ouverture, avant tout contenu). */
function checkChildTag(name, file) {
  if (FORBIDDEN_TAGS.has(name.toLowerCase())) {
    throw new IconRefusal(file, `balise <${name}> interdite.`);
  }
  if (!Object.hasOwn(ALLOWED_TAGS, name)) {
    throw new IconRefusal(
      file,
      `balise <${name}> interdite (admises : ${Object.keys(ALLOWED_TAGS).join(', ')}).`,
    );
  }
}

/** Erreur de refus : le message est en français et nomme le fichier. */
export class IconRefusal extends Error {
  constructor(file, message) {
    super(`${file} : ${message}`);
    this.name = 'IconRefusal';
  }
}

/**
 * Découpe une source SVG en un arbre minimal. Refuse tout ce qui n'est pas des balises à attributs
 * entre guillemets, des commentaires et des espaces : pas de CDATA, de doctype, d'instruction de
 * traitement ni de texte.
 * @returns {{ name: string, attrs: Record<string,string>, children: any[] }}
 */
function tokenize(source, file) {
  let pos = 0;
  /** @type {any[]} */
  const stack = [];
  /** @type {any} */
  let root = null;

  const fail = (message) => {
    throw new IconRefusal(file, message);
  };

  while (pos < source.length) {
    const lt = source.indexOf('<', pos);
    const text = source.slice(pos, lt === -1 ? source.length : lt);
    if (text.trim() !== '') fail('texte hors balise interdit dans un SVG d’icône.');
    if (lt === -1) break;
    pos = lt;

    if (source.startsWith('<!--', pos)) {
      const end = source.indexOf('-->', pos + 4);
      if (end === -1) fail('commentaire non refermé.');
      pos = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', pos) || source.startsWith('<!', pos) || source.startsWith('<?', pos)) {
      fail('déclaration, doctype, CDATA ou instruction de traitement interdits.');
    }

    // Balise fermante.
    if (source[pos + 1] === '/') {
      const end = source.indexOf('>', pos);
      if (end === -1) fail('balise fermante non terminée.');
      const closing = source.slice(pos + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== closing) fail(`balise fermante </${closing}> inattendue.`);
      pos = end + 1;
      continue;
    }

    // Balise ouvrante : nom puis attributs.
    pos += 1;
    const nameMatch = /^[A-Za-z][\w:-]*/.exec(source.slice(pos));
    if (!nameMatch) fail('balise mal formée.');
    const name = nameMatch[0];
    pos += name.length;
    /** @type {Record<string,string>} */
    const attrs = {};
    let selfClosing = false;
    for (;;) {
      while (pos < source.length && /\s/.test(source[pos])) pos += 1;
      if (pos >= source.length) fail(`balise <${name}> non terminée.`);
      if (source.startsWith('/>', pos)) {
        selfClosing = true;
        pos += 2;
        break;
      }
      if (source[pos] === '>') {
        pos += 1;
        break;
      }
      const attrMatch = /^[^\s=/>]+/.exec(source.slice(pos));
      if (!attrMatch) fail(`attribut mal formé dans <${name}>.`);
      const attrName = attrMatch[0];
      pos += attrName.length;
      while (pos < source.length && /\s/.test(source[pos])) pos += 1;
      if (source[pos] !== '=') fail(`attribut « ${attrName} » sans valeur dans <${name}>.`);
      pos += 1;
      while (pos < source.length && /\s/.test(source[pos])) pos += 1;
      const quote = source[pos];
      if (quote !== '"' && quote !== "'") {
        fail(`valeur de « ${attrName} » sans guillemets dans <${name}>.`);
      }
      const endQuote = source.indexOf(quote, pos + 1);
      if (endQuote === -1) fail(`valeur de « ${attrName} » non terminée dans <${name}>.`);
      if (Object.hasOwn(attrs, attrName)) fail(`attribut « ${attrName} » en double dans <${name}>.`);
      attrs[attrName] = source.slice(pos + 1, endQuote);
      pos = endQuote + 1;
    }

    // Le refus d'une balise précède celui de son contenu (un <style> doit être nommé comme tel).
    if (stack.length > 0) checkChildTag(name, file);
    const node = { name, attrs, children: [] };
    if (stack.length === 0) {
      if (root) fail('plusieurs éléments racine.');
      root = node;
    } else {
      stack[stack.length - 1].children.push(node);
    }
    if (!selfClosing) stack.push(node);
  }

  if (stack.length > 0) fail(`balise <${stack[stack.length - 1].name}> non refermée.`);
  if (!root) fail('aucun élément <svg>.');
  return root;
}

/** Refuse les attributs interdits de `attrs` (id, mask, style, href, gestionnaires d'événements…). */
function checkForbiddenAttrs(attrs, tag, file) {
  for (const name of Object.keys(attrs)) {
    const lower = name.toLowerCase();
    if (FORBIDDEN_ATTRS.has(lower)) {
      throw new IconRefusal(file, `attribut « ${name} » interdit sur <${tag}>.`);
    }
    if (lower.startsWith('on')) {
      throw new IconRefusal(file, `gestionnaire d’événement « ${name} » interdit sur <${tag}>.`);
    }
  }
}

/**
 * Convertit la source d'un SVG en entrée de registre.
 * @param {string} source contenu du fichier
 * @param {string} file nom du fichier, cité dans les messages de refus
 * @returns {{ viewBox: string, elements: { tag: string, attrs: Record<string,string> }[] }}
 */
export function parseSvg(source, file) {
  const root = tokenize(source, file);
  if (root.name !== 'svg') {
    throw new IconRefusal(file, `l’élément racine doit être <svg>, pas <${root.name}>.`);
  }

  checkForbiddenAttrs(root.attrs, 'svg', file);
  const viewBox = root.attrs['viewBox'];
  if (viewBox !== VIEW_BOX) {
    throw new IconRefusal(file, `viewBox « ${viewBox ?? 'absent'} » refusé, « ${VIEW_BOX} » exigé.`);
  }
  for (const [name, value] of Object.entries(root.attrs)) {
    if (!Object.hasOwn(ROOT_ATTRS, name)) {
      throw new IconRefusal(file, `attribut « ${name} » non admis sur la racine <svg>.`);
    }
    if (value !== ROOT_ATTRS[name]) {
      throw new IconRefusal(
        file,
        `attribut racine ${name}="${value}" refusé, « ${ROOT_ATTRS[name]} » exigé (posé par <app-icon>).`,
      );
    }
  }

  const elements = [];
  for (const child of root.children) {
    checkChildTag(child.name, file);
    if (child.children.length > 0) {
      throw new IconRefusal(file, `<${child.name}> ne peut contenir aucun élément.`);
    }
    checkForbiddenAttrs(child.attrs, child.name, file);
    const allowed = new Set([...ALLOWED_TAGS[child.name], ...COMMON_ATTRS]);
    for (const attrName of Object.keys(child.attrs)) {
      if (!allowed.has(attrName)) {
        throw new IconRefusal(file, `attribut « ${attrName} » non admis sur <${child.name}>.`);
      }
    }
    elements.push({ tag: child.name, attrs: { ...child.attrs } });
  }
  if (elements.length === 0) throw new IconRefusal(file, 'aucun élément de dessin.');

  return { viewBox, elements };
}

/** Noms de fichiers `.svg` d'un dossier, triés. Refuse tout autre fichier ou nom non kebab-case. */
function listSvgNames(dir, label) {
  const names = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.svg')) {
      throw new IconRefusal(`${label}/${entry.name}`, 'seuls des fichiers .svg sont admis ici.');
    }
    const name = entry.name.slice(0, -4);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      throw new IconRefusal(`${label}/${entry.name}`, 'nom d’icône en kebab-case minuscule exigé.');
    }
    names.push(name);
  }
  return names.sort();
}

/**
 * Lit les dossiers sources et construit le registre en mémoire (rien n'est écrit ici).
 * @param {string} srcDir racine des sources (dossiers de thème + `communes/`)
 */
export function buildRegistry(srcDir) {
  const themed = {};
  const common = {};

  const themeNames = {};
  for (const theme of THEME_DIRS) {
    const dir = join(srcDir, theme);
    if (!existsSync(dir)) throw new IconRefusal(theme, 'dossier de thème introuvable.');
    themeNames[theme] = listSvgNames(dir, theme);
  }
  const reference = themeNames[THEME_DIRS[0]];
  for (const theme of THEME_DIRS.slice(1)) {
    const names = themeNames[theme];
    const missing = reference.filter((n) => !names.includes(n));
    const extra = names.filter((n) => !reference.includes(n));
    if (missing.length > 0 || extra.length > 0) {
      const details = [
        ...missing.map((n) => `${n}.svg manque dans ${theme}/`),
        ...extra.map((n) => `${n}.svg en trop dans ${theme}/`),
      ].join(' ; ');
      throw new IconRefusal(
        `${theme}/`,
        `les dossiers de thème doivent contenir les mêmes fichiers que ${THEME_DIRS[0]}/ (${details}).`,
      );
    }
  }

  const commonDir = join(srcDir, COMMON_DIR);
  if (!existsSync(commonDir)) throw new IconRefusal(COMMON_DIR, 'dossier introuvable.');
  const commonNames = listSvgNames(commonDir, COMMON_DIR);
  for (const name of commonNames) {
    if (reference.includes(name)) {
      throw new IconRefusal(
        `${COMMON_DIR}/${name}.svg`,
        `le nom « ${name} » existe déjà dans les dossiers de thème : un nom ne peut être à la fois de sens et utilitaire.`,
      );
    }
  }

  for (const name of reference) {
    themed[name] = {};
    for (const theme of THEME_DIRS) {
      const file = `${theme}/${name}.svg`;
      themed[name][theme] = parseSvg(readFileSync(join(srcDir, file), 'utf8'), file);
    }
  }
  for (const name of commonNames) {
    const file = `${COMMON_DIR}/${name}.svg`;
    common[name] = parseSvg(readFileSync(join(srcDir, file), 'utf8'), file);
  }

  return { themed, common };
}

const quote = (value) =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name));

function renderDrawing(drawing, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`{`, `${pad}  viewBox: ${quote(drawing.viewBox)},`, `${pad}  elements: [`];
  for (const el of drawing.elements) {
    lines.push(`${pad}    {`, `${pad}      tag: ${quote(el.tag)},`, `${pad}      attrs: {`);
    for (const [name, value] of Object.entries(el.attrs)) {
      lines.push(`${pad}        ${key(name)}: ${quote(value)},`);
    }
    lines.push(`${pad}      },`, `${pad}    },`);
  }
  lines.push(`${pad}  ],`, `${pad}}`);
  return lines.join('\n');
}

/** Produit le texte TypeScript du registre (déterministe : noms triés, ordre des thèmes figé). */
export function renderRegistry(registry) {
  const themedNames = Object.keys(registry.themed).sort();
  const commonNames = Object.keys(registry.common).sort();
  const out = [];
  out.push(
    '// Fichier généré par scripts/generate-icons.mjs, ne pas modifier.',
    '// Source : src/assets-src/icons/. Régénérer : `docker compose exec web node scripts/generate-icons.mjs`.',
    '',
    "import type { Theme } from '@master-jdr/shared';",
    '',
    '/** Balises admises dans un dessin (cf. la liste blanche du générateur). */',
    `export type IconTag = ${Object.keys(ALLOWED_TAGS).map(quote).join(' | ')};`,
    '',
    '/** Un élément de dessin : balise et attributs, rien d’autre. */',
    'export interface IconElement {',
    '  readonly tag: IconTag;',
    '  readonly attrs: Readonly<Record<string, string>>;',
    '}',
    '',
    '/** Un dessin : son viewBox et ses éléments. */',
    'export interface IconDrawing {',
    '  readonly viewBox: string;',
    '  readonly elements: readonly IconElement[];',
    '}',
    '',
    '/** Icônes « de sens » : un dessin par thème. */',
    `export const THEMED_ICON_NAMES = [`,
    ...themedNames.map((n) => `  ${quote(n)},`),
    '] as const;',
    '',
    '/** Utilitaires : un seul dessin pour les trois thèmes. */',
    `export const COMMON_ICON_NAMES = [`,
    ...commonNames.map((n) => `  ${quote(n)},`),
    '] as const;',
    '',
    'export type ThemedIconName = (typeof THEMED_ICON_NAMES)[number];',
    'export type CommonIconName = (typeof COMMON_ICON_NAMES)[number];',
    'export type IconName = ThemedIconName | CommonIconName;',
    '',
    'export const THEMED_ICONS: Readonly<Record<ThemedIconName, Readonly<Record<Theme, IconDrawing>>>> = {',
  );
  for (const name of themedNames) {
    out.push(`  ${key(name)}: {`);
    for (const theme of THEME_DIRS) {
      out.push(`    ${key(theme)}: ${renderDrawing(registry.themed[name][theme], 4)},`);
    }
    out.push('  },');
  }
  out.push('};', '', 'export const COMMON_ICONS: Readonly<Record<CommonIconName, IconDrawing>> = {');
  for (const name of commonNames) {
    out.push(`  ${key(name)}: ${renderDrawing(registry.common[name], 2)},`);
  }
  out.push('};', '');
  return out.join('\n');
}

const normalize = (text) => text.replace(/\r\n/g, '\n');

/**
 * Point d'entrée programmatique. Renvoie le code de sortie ; n'écrit rien en cas de refus.
 * @param {{ srcDir?: string, outFile?: string, check?: boolean, log?: (m: string) => void, error?: (m: string) => void }} options
 */
export function run({ srcDir = DEFAULT_SRC, outFile = DEFAULT_OUT, check = false, log = console.log, error = console.error } = {}) {
  let text;
  try {
    text = renderRegistry(buildRegistry(srcDir));
  } catch (e) {
    if (e instanceof IconRefusal) {
      error(`generate-icons : ${e.message}`);
      return 1;
    }
    throw e;
  }
  const where = relative(process.cwd(), outFile) || outFile;
  if (check) {
    const current = existsSync(outFile) ? normalize(readFileSync(outFile, 'utf8')) : null;
    if (current !== text) {
      error(
        `generate-icons : ${where} n’est pas à jour avec les SVG sources. Relancer « node scripts/generate-icons.mjs » et committer le résultat.`,
      );
      return 1;
    }
    log(`generate-icons : ${where} est à jour.`);
    return 0;
  }
  const current = existsSync(outFile) ? normalize(readFileSync(outFile, 'utf8')) : null;
  if (current === text) {
    log(`generate-icons : ${where} déjà à jour.`);
    return 0;
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text, 'utf8');
  log(`generate-icons : ${where} écrit.`);
  return 0;
}

/**
 * Lit les arguments de la ligne de commande. Tout ce qui n'est pas connu est refusé : une faute de
 * frappe (`--chek`) ne doit jamais réécrire le registre en silence.
 * @param {string[]} argv arguments après le nom du script
 * @returns {{ check: boolean, srcDir?: string, outFile?: string }}
 */
export function parseArgs(argv) {
  const options = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--src' || arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`l’option ${arg} attend une valeur.`);
      }
      options[arg === '--src' ? 'srcDir' : 'outFile'] = resolve(value);
      i += 1;
    } else {
      throw new UsageError(
        `argument « ${arg} » inconnu (admis : --check, --src <dossier>, --out <fichier>).`,
      );
    }
  }
  return options;
}

/** Erreur d'usage de la ligne de commande. */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = run(parseArgs(process.argv.slice(2)));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(`generate-icons : ${e.message}`);
    process.exitCode = 1;
  }
}
