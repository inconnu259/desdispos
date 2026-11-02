// @ts-expect-error — @types/node n'est pas dans les `types` du tsconfig web ; ce test lit les
// sources de l'application pour les inspecter.
import { readFileSync } from 'node:fs';
// @ts-expect-error — idem, voir ci-dessus.
import { dirname, join, resolve } from 'node:path';
// @ts-expect-error — idem, voir ci-dessus.
import { fileURLToPath } from 'node:url';
import { TONE_MAP } from '../theme/tones';

/**
 * Story 51.7 — plus aucun caractère servant d'icône, ni `<svg>` en ligne, dans les gabarits du
 * compte, des soirées, des jeux de société et des surfaces partagées (♥ ✎ ✕ ✓ ▾ ▸ ⋮ › ⚠ et les entités
 * `&#9829;` / `&#8942;`) : les pictogrammes passent par `<app-icon>`. Les commentaires de gabarit
 * (HTML) sont ignorés : ils peuvent citer ces caractères pour décrire l'ancien rendu. Pour un
 * composant à gabarit en ligne, seul le gabarit est inspecté (pas la documentation du fichier).
 */
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Gabarits touchés par la story : fichiers `.html` ou composants à gabarit en ligne (`.ts`). */
const TEMPLATE_FILES = [
  'features/account/account.html',
  'features/account/theme-selector/theme-selector.html',
  'features/account/delete-account-dialog/delete-account-dialog.ts',
  'features/events/cancel-event-dialog/cancel-event-dialog.html',
  'features/events/event-form/event-form.html',
  'features/events/event-games-tab/envy-toggle.ts',
  'features/events/event-games-tab/games-section.ts',
  'features/events/event-games-tab/games-summary.ts',
  'features/events/event-games-tab/game-row.ts',
  'features/board-games/board-games-page/board-games-page.html',
  'features/board-games/group-games-tab/group-games-tab.html',
  'features/parties/partie-form/partie-form.html',
  'shared/password-reveal/password-toggle.html',
  'shared/identity/identity-label.html',
  'shared/detail-surface/detail-surface.html',
];

const ICON_CHARACTERS = /[♥✎✕✓▾▸⋮›⚠]|&#9829;|&#8942;/u;
const INLINE_SVG = /<svg\b/;

/** Le gabarit d'un fichier, commentaires HTML retirés. */
function template(relativePath: string): string {
  const source = readFileSync(join(APP_DIR, relativePath), 'utf8') as string;
  const body = relativePath.endsWith('.ts')
    ? (source.match(/template:\s*`([\s\S]*?)`,/)?.[1] ?? '')
    : source;
  return body.replace(/<!--[\s\S]*?-->/g, '');
}

describe('Caractères-icônes du compte, des soirées, des jeux et des surfaces partagées (story 51.7)', () => {
  it.each(TEMPLATE_FILES)('%s : un gabarit lisible, sans caractère-icône', (file) => {
    const text = template(file);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toMatch(ICON_CHARACTERS);
  });

  it.each(TEMPLATE_FILES)('%s : aucun <svg> en ligne (tout passe par <app-icon>)', (file) => {
    expect(template(file)).not.toMatch(INLINE_SVG);
  });

  it.each(Object.keys(TONE_MAP))(
    '%s : « déjà chez » ne commence plus par ⚠ (le pictogramme est dans le gabarit)',
    (theme) => {
      const tone = TONE_MAP[theme as keyof typeof TONE_MAP] as Record<string, string>;
      expect(tone['event_games.already_at']).toBeTruthy();
      expect(tone['event_games.already_at']).not.toContain('⚠');
    },
  );
});
