// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit les
// sources de l'application pour les compter.
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, join, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';

/**
 * Cliquet de la migration vers `<app-icon>` (palier 10.7, épic 51).
 *
 * Compte les `<mat-icon` des gabarits (`.html` et gabarits en ligne des `.ts`, specs exclues) et
 * échoue au-delà du plafond (17 après la story 51.4). Chaque story de zone BAISSE le plafond après
 * avoir migré sa zone ; aucune ne peut l'élever : à partir de la story 51.1, plus aucun nouveau
 * `<mat-icon>`.
 * La dernière story (51.8) fixe le plafond à zéro et durcit ce test.
 */

/** Plafond mesuré après la story 51.4. À ABAISSER, jamais à relever. */
const MAT_ICON_CEILING = 17;

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.name.endsWith('.html')) files.push(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) files.push(path);
  }
  return files;
}

/** Nombre de `<mat-icon` d'un fichier ; les commentaires HTML d'un `.html` ne comptent pas. */
function countMatIcons(path: string): number {
  let text = readFileSync(path, 'utf8') as string;
  if (path.endsWith('.html')) text = text.replace(/<!--[\s\S]*?-->/g, '');
  return (text.match(/<mat-icon\b/g) ?? []).length;
}

describe('Cliquet <mat-icon> (épic 51)', () => {
  it('le nombre de <mat-icon> des gabarits ne dépasse pas le plafond', () => {
    const perFile = sourceFiles(APP_DIR)
      .map((file) => ({ file, count: countMatIcons(file) }))
      .filter((entry) => entry.count > 0);
    const total = perFile.reduce((sum, entry) => sum + entry.count, 0);
    expect(
      total,
      `${total} <mat-icon> pour un plafond de ${MAT_ICON_CEILING} : migrer vers <app-icon> ou, ` +
        `si une zone vient d'être migrée, abaisser le plafond.\n` +
        perFile.map((e) => `  ${e.count}  ${e.file}`).join('\n'),
    ).toBeLessThanOrEqual(MAT_ICON_CEILING);
    // Lecture de tout l'arbre des sources : plus lent que 5 s quand les autres specs tournent en parallèle.
  }, 60_000);
});
