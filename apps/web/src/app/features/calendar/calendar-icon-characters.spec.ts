// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit les
// sources de l'application pour les inspecter.
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, join, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';

/**
 * Story 51.5 — plus aucun caractère servant d'icône dans les gabarits du calendrier et des sondages
 * (✦ ✅ ❌ ❔ ⚠ ✎ ⌄ ⌃ ▾ ▴ ‹ › ☰ et les entités `&#9776;` / `&#x2630;`) : les pictogrammes passent par `<app-icon>`. Les commentaires
 * de gabarit (HTML) sont ignorés : ils peuvent citer ces caractères pour décrire l'ancien rendu.
 */
const FEATURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICON_CHARACTERS = /[✦✅❌⌄⌃☰⚠✎❔▾▴‹›]|&#9776;|&#x2630;/iu;

function templates(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...templates(path));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

describe('Caractères-icônes des gabarits (story 51.5)', () => {
  it('features/calendar et features/poll ne contiennent plus de caractère-icône en dehors des commentaires', () => {
    const offenders = [
      ...templates(join(FEATURES_DIR, 'calendar')),
      ...templates(join(FEATURES_DIR, 'poll')),
    ]
      .map((file) => ({
        file,
        text: (readFileSync(file, 'utf8') as string).replace(/<!--[\s\S]*?-->/g, ''),
      }))
      .filter(({ text }) => ICON_CHARACTERS.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
    // Lecture de tout le dossier : plus lent que 5 s quand les autres specs tournent en parallèle.
  }, 60_000);
});
