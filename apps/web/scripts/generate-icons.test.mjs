// Tests du générateur d'icônes (aucune dépendance), à lancer dans le conteneur web :
//   docker compose exec web node --test 'scripts/*.test.mjs'
// Le motif est nécessaire : `node --test scripts/` ne parcourt pas un dossier (Node 22+). Même commande en CI.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  THEME_DIRS,
  UsageError,
  buildRegistry,
  parseArgs,
  parseSvg,
  renderRegistry,
  run,
} from './generate-icons.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'generate-icons.mjs');
const ROOT_OPEN =
  '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const svg = (body, open = ROOT_OPEN) => `${open}${body}</svg>`;
const VALID_BODY = '<path stroke-width="2" d="M8 8 L24 24"/>';

const tmpDirs = [];
function makeTmp() {
  const dir = mkdtempSync(join(tmpdir(), 'generate-icons-'));
  tmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

/** Arbre minimal valide : 1 icône de sens (x3 thèmes) + 1 utilitaire. */
function makeSrc(overrides = {}) {
  const src = makeTmp();
  const files = {
    'grimoire-emeraude/nav-a.svg': svg(VALID_BODY),
    'foret-ancienne/nav-a.svg': svg('<path d="M1 1 L2 2"/>'),
    'atelier-cuivre/nav-a.svg': svg('<circle cx="16" cy="16" r="8"/>'),
    'communes/fermer.svg': svg('<path d="M8 8 L24 24 M24 8 L8 24"/>'),
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(dirname(join(src, rel)), { recursive: true });
    writeFileSync(join(src, rel), content);
  }
  return src;
}

describe('parseSvg — conversion valide', () => {
  it('convertit viewBox et éléments, dans l’ordre', () => {
    const drawing = parseSvg(
      svg('<path stroke-width="2" d="M1 1"/><circle cx="1" cy="2" r="3"/><rect x="1" y="2" width="3" height="4" rx="1"/>'),
      'a.svg',
    );
    assert.equal(drawing.viewBox, '0 0 32 32');
    assert.deepEqual(drawing.elements, [
      { tag: 'path', attrs: { 'stroke-width': '2', d: 'M1 1' } },
      { tag: 'circle', attrs: { cx: '1', cy: '2', r: '3' } },
    ].concat([{ tag: 'rect', attrs: { x: '1', y: '2', width: '3', height: '4', rx: '1' } }]));
  });

  it('accepte ellipse, line, polyline et polygon', () => {
    const drawing = parseSvg(
      svg(
        '<ellipse cx="1" cy="1" rx="2" ry="3"/><line x1="0" y1="0" x2="1" y2="1"/><polyline points="0,0 1,1"/><polygon points="0,0 1,1 2,0"/>',
      ),
      'a.svg',
    );
    assert.deepEqual(
      drawing.elements.map((e) => e.tag),
      ['ellipse', 'line', 'polyline', 'polygon'],
    );
  });

  it('ignore les commentaires SVG, y compris entre deux éléments', () => {
    const drawing = parseSvg(
      svg(`<!-- Titre --><path d="M1 1"/>
<!-- Fermoir <path d="M9 9"/> -->
<path fill="currentColor" stroke="none" d="M2 2"/>`),
      'a.svg',
    );
    assert.equal(drawing.elements.length, 2);
    assert.equal(drawing.elements[1].attrs.fill, 'currentColor');
  });

  it('accepte un élément écrit avec balise fermante vide', () => {
    assert.equal(parseSvg(svg('<path d="M1 1"></path>'), 'a.svg').elements.length, 1);
  });
});

describe('parseSvg — refus (message français nommant le fichier)', () => {
  const cases = [
    ['attribut id', svg('<path id="x" d="M1 1"/>'), /id/],
    ['attribut mask', svg('<path mask="url(#m)" d="M1 1"/>'), /mask/],
    ['attribut clip-path', svg('<path clip-path="url(#c)" d="M1 1"/>'), /clip-path/],
    ['balise clipPath', svg('<clipPath><path d="M1 1"/></clipPath>'), /clipPath/],
    ['balise mask', svg('<mask><path d="M1 1"/></mask>'), /mask/],
    ['attribut style', svg('<path style="fill:red" d="M1 1"/>'), /style/],
    ['balise style', svg('<style>path{fill:red}</style>'), /style/],
    ['balise script', svg('<script>alert(1)</script>'), /script/],
    ['attribut href', svg('<path href="#x" d="M1 1"/>'), /href/],
    ['attribut xlink:href', svg('<path xlink:href="#x" d="M1 1"/>'), /xlink:href/],
    ['gestionnaire onclick', svg('<path onclick="x()" d="M1 1"/>'), /onclick/],
    ['balise hors liste (g)', svg('<g><path d="M1 1"/></g>'), /<g>/],
    ['balise hors liste (text)', svg('<text>a</text>'), /<text>/],
    ['attribut hors liste', svg('<path transform="rotate(3)" d="M1 1"/>'), /transform/],
    ['viewBox différent', svg(VALID_BODY, ROOT_OPEN.replace('0 0 32 32', '0 0 24 24')), /viewBox/],
    ['viewBox absent', svg(VALID_BODY, '<svg fill="none">'), /viewBox/],
    ['attribut racine altéré', svg(VALID_BODY, ROOT_OPEN.replace('stroke-linejoin="round"', 'stroke-linejoin="butt"')), /stroke-linejoin/],
    ['texte hors balise', svg('hello<path d="M1 1"/>'), /texte/],
    ['CDATA', svg('<![CDATA[x]]>'), /CDATA/],
    ['aucun élément', svg(''), /aucun élément/],
    ['commentaire non refermé', svg('<!-- x <path d="M1 1"/>'), /commentaire/],
  ];
  for (const [label, source, pattern] of cases) {
    it(label, () => {
      assert.throws(
        () => parseSvg(source, 'grimoire-emeraude/nav-a.svg'),
        (err) =>
          err.message.startsWith('grimoire-emeraude/nav-a.svg : ') &&
          pattern.test(err.message) &&
          /[éèàêô]|interdit|exigé|refus|admis|aucun|texte/.test(err.message),
      );
    });
  }
});

describe('buildRegistry — règles entre dossiers', () => {
  it('construit 1 icône de sens x 3 thèmes et 1 utilitaire', () => {
    const registry = buildRegistry(makeSrc());
    assert.deepEqual(Object.keys(registry.themed), ['nav-a']);
    assert.deepEqual(Object.keys(registry.themed['nav-a']).sort(), [...THEME_DIRS].sort());
    assert.deepEqual(Object.keys(registry.common), ['fermer']);
  });

  it('refuse des dossiers de thème aux noms de fichiers différents', () => {
    const src = makeSrc({ 'atelier-cuivre/nav-b.svg': svg(VALID_BODY) });
    assert.throws(() => buildRegistry(src), /atelier-cuivre.*mêmes fichiers/);
  });

  it('refuse un nom présent à la fois dans un thème et dans communes/', () => {
    const src = makeSrc({ 'communes/nav-a.svg': svg(VALID_BODY) });
    assert.throws(() => buildRegistry(src), /communes\/nav-a\.svg.*déjà/);
  });

  it('refuse un fichier qui n’est pas un .svg', () => {
    const src = makeSrc({ 'communes/notes.txt': 'x' });
    assert.throws(() => buildRegistry(src), /communes\/notes\.txt/);
  });

  it('refuse un nom non kebab-case', () => {
    const src = makeSrc({ 'communes/Mauvais_Nom.svg': svg(VALID_BODY) });
    assert.throws(() => buildRegistry(src), /kebab-case/);
  });

  it('nomme le fichier fautif d’un thème', () => {
    const src = makeSrc({ 'foret-ancienne/nav-a.svg': svg('<path id="x" d="M1 1"/>') });
    assert.throws(() => buildRegistry(src), /^IconRefusal: foret-ancienne\/nav-a\.svg : /);
  });
});

describe('parseArgs — ligne de commande stricte', () => {
  it('lit --check, --src et --out', () => {
    const options = parseArgs(['--check', '--src', 'a', '--out', 'b.ts']);
    assert.equal(options.check, true);
    assert.equal(options.srcDir, resolve('a'));
    assert.equal(options.outFile, resolve('b.ts'));
    assert.deepEqual(parseArgs([]), { check: false });
  });

  it('refuse un argument inconnu (faute de frappe sur --check)', () => {
    assert.throws(() => parseArgs(['--chek']), (e) => e instanceof UsageError && /--chek/.test(e.message));
    assert.throws(() => parseArgs(['positionnel']), UsageError);
  });

  it('refuse --src et --out sans valeur', () => {
    assert.throws(() => parseArgs(['--src']), /--src attend une valeur/);
    assert.throws(() => parseArgs(['--out', '--check']), /--out attend une valeur/);
  });
});

describe('renderRegistry', () => {
  it('échappe retours à la ligne, apostrophes et antislashs dans les valeurs', () => {
    const registry = buildRegistry(makeSrc());
    registry.common.fermer.elements[0].attrs.d = "a\nb\rc'd\\e";
    const out = renderRegistry(registry);
    assert.ok(out.includes("d: 'a\\nb\\rc\\'d\\\\e',"));
  });

  it('est déterministe et porte l’en-tête « généré, ne pas modifier »', () => {
    const registry = buildRegistry(makeSrc());
    const a = renderRegistry(registry);
    assert.equal(a, renderRegistry(buildRegistry(makeSrc())));
    assert.match(a.split('\n')[0], /généré par scripts\/generate-icons\.mjs, ne pas modifier/);
    assert.match(a, /export type IconName = ThemedIconName \| CommonIconName;/);
    assert.match(a, /'nav-a'/);
    assert.match(a, /fermer/);
  });
});

describe('run — écriture et --check', () => {
  const quiet = { log: () => {}, error: () => {} };

  it('écrit le registre puis --check réussit, une seconde exécution ne change rien', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    assert.equal(run({ srcDir: src, outFile: out, ...quiet }), 0);
    const first = readFileSync(out, 'utf8');
    assert.equal(run({ srcDir: src, outFile: out, check: true, ...quiet }), 0);
    assert.equal(run({ srcDir: src, outFile: out, ...quiet }), 0);
    assert.equal(readFileSync(out, 'utf8'), first);
  });

  it('--check échoue si un SVG a changé sans régénération', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    run({ srcDir: src, outFile: out, ...quiet });
    writeFileSync(join(src, 'communes/fermer.svg'), svg('<path d="M9 9 L10 10"/>'));
    const errors = [];
    assert.equal(
      run({ srcDir: src, outFile: out, check: true, log: () => {}, error: (m) => errors.push(m) }),
      1,
    );
    assert.match(errors.join('\n'), /n’est pas à jour/);
  });

  it('--check échoue si le registre est absent', () => {
    const src = makeSrc();
    assert.equal(run({ srcDir: src, outFile: join(makeTmp(), 'absent.ts'), check: true, ...quiet }), 1);
  });

  it('tolère des fins de ligne CRLF dans le registre committé', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    run({ srcDir: src, outFile: out, ...quiet });
    writeFileSync(out, readFileSync(out, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal(run({ srcDir: src, outFile: out, check: true, ...quiet }), 0);
  });

  it('un SVG interdit : code non nul, message français, registre intact', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    run({ srcDir: src, outFile: out, ...quiet });
    const before = readFileSync(out, 'utf8');
    writeFileSync(join(src, 'atelier-cuivre/nav-a.svg'), svg('<path style="x" d="M1 1"/>'));
    const errors = [];
    assert.equal(run({ srcDir: src, outFile: out, log: () => {}, error: (m) => errors.push(m) }), 1);
    assert.match(errors.join('\n'), /atelier-cuivre\/nav-a\.svg/);
    assert.equal(readFileSync(out, 'utf8'), before);
  });
});

describe('ligne de commande', () => {
  it('un argument inconnu : code 1, message français, registre non réécrit', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    const result = spawnSync(process.execPath, [SCRIPT, '--chek', '--src', src, '--out', out], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /argument « --chek » inconnu/);
    assert.throws(() => readFileSync(out), /ENOENT/);
  });

  it('--src sans valeur : code 1', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--src'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--src attend une valeur/);
  });

  it('sort avec le code 1 et un message sur stderr pour un SVG interdit', () => {
    const src = makeSrc({ 'communes/fermer.svg': svg('<path id="x" d="M1 1"/>') });
    const out = join(makeTmp(), 'registry.generated.ts');
    const result = spawnSync(process.execPath, [SCRIPT, '--src', src, '--out', out], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /communes\/fermer\.svg/);
  });

  it('--check sort avec le code 0 quand le registre est à jour', () => {
    const src = makeSrc();
    const out = join(makeTmp(), 'registry.generated.ts');
    assert.equal(spawnSync(process.execPath, [SCRIPT, '--src', src, '--out', out]).status, 0);
    assert.equal(spawnSync(process.execPath, [SCRIPT, '--check', '--src', src, '--out', out]).status, 0);
  });
});
