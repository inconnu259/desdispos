import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Story 47.1 (AD-10) — seul `events/` écrit `durationSlots`, `endDate` et `endSlot` d'une `Seance`
 * (`scenarios/` lui passe la durée). Le test balaie les sources non-spec hors `events/` et refuse toute
 * écriture de `Seance` (`create`, `createMany`, `update`, `updateMany`, `upsert`) dont l'appel cite l'un
 * de ces trois champs. Les modèles voisins qui portent aussi `endDate` (déclarations de disponibilité)
 * ne sont pas des écritures de `Seance`.
 */
const SRC_ROOT = join(__dirname, '..');

const WRITE_CALL = /\.seance\s*\.\s*(create|createMany|update|updateMany|upsert)\s*\(/g;
/** Écritures imbriquées d'une relation (`event.update({ data: { seances: { create: … } } })`). */
const NESTED_WRITE = /\bseances\s*:\s*\{\s*(create|createMany|update|updateMany|upsert)\b/g;
/** SQL brut sur la table `Seance`. */
const RAW_WRITE = /\b(UPDATE|INSERT\s+INTO)\s+"Seance"/i;
const SPAN_FIELD = /\b(durationSlots|endDate|endSlot)\b/;

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (name.endsWith('.ts') && !/\.(spec|d)\.ts$|-spec\.ts$/.test(name)) out.push(full);
  }
  return out;
}

/** Texte de l'appel qui s'ouvre à `open` (la parenthèse ouvrante), jusqu'à sa parenthèse fermante. */
function callBody(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

/** Écritures de `Seance` citant un champ de plage, au format « fichier : appel ». */
function spanWrites(file: string, source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  for (const m of code.matchAll(WRITE_CALL)) {
    if (SPAN_FIELD.test(callBody(code, m.index + m[0].length - 1))) {
      found.push(`${relative(SRC_ROOT, file).split(sep).join('/')} : seance.${m[1]}`);
    }
  }
  for (const m of code.matchAll(NESTED_WRITE)) {
    if (SPAN_FIELD.test(code.slice(m.index, m.index + 400))) {
      found.push(`${relative(SRC_ROOT, file).split(sep).join('/')} : seances.${m[1]} (imbriqué)`);
    }
  }
  if (RAW_WRITE.test(code) && SPAN_FIELD.test(code)) {
    found.push(`${relative(SRC_ROOT, file).split(sep).join('/')} : SQL brut sur "Seance"`);
  }
  return found;
}

describe('seul events/ écrit la durée et la fin d’une Seance (Story 47.1, AD-10)', () => {
  const outside = listSources(SRC_ROOT).filter(
    (f) => relative(SRC_ROOT, f).split(sep)[0] !== 'events',
  );

  it('le balayage trouve des sources hors events/ (pas un balayage vide)', () => {
    expect(outside.length).toBeGreaterThan(50);
  });

  it('aucun fichier hors events/ n’écrit durationSlots, endDate ou endSlot d’une Seance', () => {
    const offenders = outside.flatMap((f) => spanWrites(f, readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  describe('le détecteur', () => {
    it('repère une écriture de plage', () => {
      const bad = 'await tx.seance.updateMany({ where: { pollId }, data: { endDate: d } });';
      expect(spanWrites('x/y.ts', bad)).toHaveLength(1);
    });

    it('repère la durée écrite dans un create', () => {
      expect(
        spanWrites('x/y.ts', 'this.prisma.seance.create({ data: { eventId, durationSlots: 2 } })'),
      ).toHaveLength(1);
    });

    it('repère une écriture imbriquée et un SQL brut sur Seance', () => {
      const nested = 'this.prisma.event.update({ where: { id }, data: { seances: { create: { endDate: d } } } });';
      expect(spanWrites('x/y.ts', nested)).toHaveLength(1);
      const raw = 'tx.$executeRaw`UPDATE "Seance" SET "durationSlots" = 3 WHERE "id" = ${id}`;';
      expect(spanWrites('x/y.ts', raw)).toHaveLength(1);
    });

    it('ignore une écriture de Seance sans champ de plage, un commentaire et un autre modèle', () => {
      expect(spanWrites('x/y.ts', 'tx.seance.update({ data: { lieu: null } });')).toEqual([]);
      expect(spanWrites('x/y.ts', '// tx.seance.update({ data: { endDate: d } });')).toEqual([]);
      expect(spanWrites('x/y.ts', 'tx.availability.create({ data: { endDate: d } });')).toEqual([]);
    });
  });
});
