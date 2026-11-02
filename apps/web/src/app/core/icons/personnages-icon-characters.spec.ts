// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit les
// sources de l'application pour les inspecter.
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, join, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';
import { TONE_MAP } from '../theme/tones';

/**
 * Story 51.6 — plus aucun caractère servant d'icône dans les gabarits des personnages, des
 * scénarios et de l'Homme Dragon (❮ ❯ 🔒 🔓 ▾ ▴ ▸ ✎ ✕ ✓ ⋮ › ⚠ et les entités `&#9662;` / `&#8942;`),
 * et plus de ❮ ❯ 🔒 🔓 dans les valeurs des trois fichiers de ton : les pictogrammes passent par
 * `<app-icon>`. Les commentaires de gabarit (HTML) sont ignorés : ils peuvent citer ces
 * caractères pour décrire l'ancien rendu.
 */
const FEATURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../features');
const ZONES = ['characters', 'scenarios', 'homme-dragon'];

const TEMPLATE_ICON_CHARACTERS = /[❮❯🔒🔓▾▴▸✎✕✓⋮›⚠]|&#9662;|&#8942;/u;
const TONE_ICON_CHARACTERS = /[❮❯🔒🔓]/u;

function templates(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...templates(path));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

describe('Caractères-icônes des personnages, scénarios et Homme Dragon (story 51.6)', () => {
  it('les gabarits ne contiennent plus de caractère-icône en dehors des commentaires', () => {
    const offenders = ZONES.flatMap((zone) => templates(join(FEATURES_DIR, zone)))
      .map((file) => ({
        file,
        text: (readFileSync(file, 'utf8') as string).replace(/<!--[\s\S]*?-->/g, ''),
      }))
      .filter(({ text }) => TEMPLATE_ICON_CHARACTERS.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
    // Lecture de plusieurs dossiers : plus lent que 5 s quand les autres specs tournent en parallèle.
  }, 60_000);

  it.each(Object.keys(TONE_MAP))('%s : aucun ❮ ❯ 🔒 🔓 dans les valeurs du ton', (theme) => {
    const tone = TONE_MAP[theme as keyof typeof TONE_MAP] as Record<string, string>;
    const offenders = Object.entries(tone)
      .filter(([, value]) => TONE_ICON_CHARACTERS.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it.each(Object.keys(TONE_MAP))(
    '%s : « heure illisible » ne commence plus par ⚠ (le pictogramme est dans le gabarit)',
    (theme) => {
      const tone = TONE_MAP[theme as keyof typeof TONE_MAP] as Record<string, string>;
      expect(tone['scenarios.seances_heure_malformed']).toBeTruthy();
      expect(tone['scenarios.seances_heure_malformed']).not.toContain('⚠');
    },
  );
});
