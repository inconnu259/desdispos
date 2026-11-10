// AD-13 : la liste des thèmes valides est déclarée une seule fois, dans @desdispos/shared —
// ré-exportée ici pour que les sites d'appel existants (import depuis `core/theme/tones`) continuent
// de fonctionner sans modification.
import type { Theme } from '@desdispos/shared';
import { atelierCuivre } from './atelier-cuivre';
import { foretAncienne } from './foret-ancienne';
import { grimoireEmeraude } from './grimoire-emeraude';

export type { Theme } from '@desdispos/shared';
export { THEMES } from '@desdispos/shared';

export const THEME_NAMES: Record<Theme, string> = {
  'grimoire-emeraude': 'Grimoire Émeraude',
  'foret-ancienne': 'Forêt Ancienne',
  'atelier-cuivre': 'Atelier Cuivré',
};

// Type public volontairement large : la parité des clés se vérifie à la définition de chaque
// fichier de thème (typage depuis `grimoire-emeraude`), pas chez les consommateurs.
export const TONE_MAP: Record<Theme, Record<string, string>> = {
  'grimoire-emeraude': grimoireEmeraude,
  'foret-ancienne': foretAncienne,
  'atelier-cuivre': atelierCuivre,
};
