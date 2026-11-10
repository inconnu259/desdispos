import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Story 37.8 (AD-8) — la couche 1 (planification : `availability/`, `poll/`) n'importe jamais une
 * couche supérieure.
 *
 * Les dépendances vers les couches 2 et 3 (`parties/`, `events/`, `scenarios/`, `characters/`…)
 * passent par des PORTS (interface + jeton d'injection, dossiers `availability/ports/` et
 * `poll/ports/`), implémentés par ces couches et liés par `PortsModule`. Ce test balaie les sources
 * non-spec des deux dossiers et applique une LISTE BLANCHE : une importation (statique,
 * `import type`, `export … from`, `require` ou `import()`, littéral ou gabarit) ne peut viser que
 * le dossier du fichier lui-même (ports compris) ou un module transverse — `common/`, `prisma/`,
 * `permissions/`, `realtime/`, `auth/`, `users/`, `email/`. Tout autre module métier voisin
 * échoue, nommé ou non dans une liste d'interdits.
 */

/** Racine balayée : `apps/api/src`. */
const SRC_ROOT = join(__dirname, '..');

/** Dossiers de la couche 1. */
const LAYER_1 = ['availability', 'poll'];

/** Modules transverses, importables par la couche 1 en plus de son propre dossier. */
const ALLOWED = ['common', 'prisma', 'permissions', 'realtime', 'auth', 'users', 'email'];

/** Fichiers sources non-spec de `dir`, chemins relatifs à `SRC_ROOT` (séparateur `/`). */
function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSources(full));
    } else if (
      name.endsWith('.ts') &&
      !name.endsWith('.spec.ts') &&
      !name.endsWith('-spec.ts') &&
      !name.endsWith('.d.ts')
    ) {
      out.push(relative(SRC_ROOT, full).split(sep).join('/'));
    }
  }
  return out;
}

/** Source sans ses commentaires (un commentaire qui MENTIONNE `../parties/…` n'est pas un import).
 *  Les chaînes sont parcourues pour qu'un `//` d'URL ne soit pas pris pour un commentaire. */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      out += ch;
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') {
          out += source[i];
          i++;
        }
        out += source[i] ?? '';
        i++;
      }
      out += ch;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Spécificateurs de module importés par une source (hors commentaires). */
function importedSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g, // import … from '…' / export … from '…'
    /\bimport\s*['"]([^'"]+)['"]/g, // import '…'
    /\bimport\s*\(\s*['"`]([^'"`]+)/g, // import('…') ou import(`…${x}`)
    /\brequire\s*\(\s*['"`]([^'"`]+)/g, // require('…') ou require(`…${x}`)
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Le module de premier niveau (`parties`, `events`…) visé par un spécificateur relatif d'un
 *  fichier de `fromRel`, ou `null` si le spécificateur n'est pas relatif. */
function targetModule(fromRel: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const fromDir = join(SRC_ROOT, fromRel, '..');
  const resolved = relative(SRC_ROOT, join(fromDir, specifier)).split(sep).join('/');
  return resolved.split('/')[0] ?? null;
}

/** Importations hors liste blanche d'une source, au format « fichier → spécificateur ». Un
 *  spécificateur non relatif (paquet npm, `@master-jdr/*`) n'est pas un module métier du dépôt. */
function forbiddenImports(fromRel: string, source: string): string[] {
  const own = fromRel.split('/')[0];
  return importedSpecifiers(source)
    .filter((specifier) => {
      const target = targetModule(fromRel, specifier);
      return target !== null && target !== own && !ALLOWED.includes(target);
    })
    .map((specifier) => `${fromRel} → ${specifier}`);
}

describe('la couche 1 n’importe que son dossier et les modules transverses (Story 37.8, AD-8)', () => {
  const sources = LAYER_1.flatMap((dir) => listSources(join(SRC_ROOT, dir)));

  it('le balayage trouve les sources de la couche 1 (pas un balayage vide ou tronqué)', () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        'availability/availability.service.ts',
        'availability/availability.module.ts',
        'availability/ports/occupied-spans.port.ts',
        'availability/ports/own-events.port.ts',
        'poll/poll.service.ts',
        'poll/poll.module.ts',
        'poll/ports/seance-date.port.ts',
        'poll/ports/partie-signals.port.ts',
        'poll/ports/rendez-vous-duration.port.ts',
      ]),
    );
    expect(sources.some((rel) => rel.endsWith('.spec.ts'))).toBe(false);
  });

  it('aucun fichier de availability/ ou poll/ n’importe un autre module métier (liste blanche)', () => {
    const offenders = sources.flatMap((rel) =>
      forbiddenImports(rel, readFileSync(join(SRC_ROOT, rel), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('PollModule et ScenariosModule ne portent plus de forwardRef', () => {
    for (const rel of ['poll/poll.module.ts', 'scenarios/scenarios.module.ts']) {
      const code = stripComments(readFileSync(join(SRC_ROOT, rel), 'utf8'));
      expect({ rel, forwardRef: /\bforwardRef\b/.test(code) }).toEqual({ rel, forwardRef: false });
    }
  });

  describe('le détecteur', () => {
    it.each([
      "import { PartiesService } from '../parties/parties.service';",
      "import type { Partie } from '../parties/dto/x';",
      "import { EventsService } from '../events/events.service';",
      "import { ScenariosService } from '../scenarios/scenarios.service';",
      "export { EventsModule } from '../events/events.module';",
      "const m = await import('../parties/parties.module');",
      "const m = require('../scenarios/scenarios.service');",
      "import { CharacterService } from '../characters/character.service';",
      "import { X } from '../homme-dragon/homme-dragon.service';",
      "import { X } from '../availability/availability.service';", // `poll/` → `availability/`
      'const m = await import(`../characters/${name}.service`);',
      'const m = require(`../invitations/${name}`);',
    ])('signale : %s', (line) => {
      expect(forbiddenImports('poll/poll.service.ts', line)).toHaveLength(1);
    });

    it.each([
      "import { PermissionService } from '../permissions/permission.service';",
      "import { RealtimeEventsService } from '../realtime/realtime-events.service';",
      "import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';",
      "import { EmailService } from '../email/email.service';",
      "import { PrismaService } from '../prisma/prisma.service';",
      "import { participantCount } from '../common/participant-count.util';",
      "import { OCCUPIED_SPANS_PORT } from './ports/occupied-spans.port';",
      "import { CastVoteDto } from './dto/cast-vote.dto';",
      'const m = await import(`./dto/${name}`);',
      "import type { Prisma } from '@prisma/client';",
      "import { Injectable } from '@nestjs/common'; // ../parties/ dans un commentaire",
      "// import { PartiesService } from '../parties/parties.service';",
    ])('ne signale pas : %s', (line) => {
      expect(forbiddenImports('poll/poll.service.ts', line)).toEqual([]);
    });

    it('ne balaie pas les fichiers *-spec.ts', () => {
      expect(sources.some((rel) => rel.endsWith('-spec.ts'))).toBe(false);
    });

    it('résout les chemins relatifs depuis le dossier du fichier importeur', () => {
      // Depuis `poll/ports/`, `../../events/…` vise bien `events/`; `../x` vise `poll/`.
      expect(
        forbiddenImports('poll/ports/seance-date.port.ts', "import { A } from '../../events/a';"),
      ).toHaveLength(1);
      expect(
        forbiddenImports('poll/ports/seance-date.port.ts', "import { A } from '../poll.service';"),
      ).toEqual([]);
    });
  });
});
