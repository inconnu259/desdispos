import type { HommeDragonRace } from './validate-homme-dragon.ts';

/** Familles des souffles communs, dans l'ordre du livre (`docs/dragons.md`, « Souffles communs »). */
export type SouffleFamille = 'temps' | 'destin' | 'pnj';

const SOUFFLE_FAMILLES: SouffleFamille[] = ['temps', 'destin', 'pnj'];

/** Libellé et consigne d'usage de chaque famille — transcrits tels quels du livre ; `consigne` est
 * `null` quand le livre n'en donne pas. Même contenu que `SOUFFLE_FAMILLE_INFO` de la fiche web
 * (`homme-dragon-sheet.ts`) : la duplication est consignée dans `deferred-work.md`, pas refactorée
 * dans la story 33.4. */
const SOUFFLE_FAMILLE_INFO: Record<SouffleFamille, { label: string; consigne: string | null }> = {
  temps: {
    label: 'Souffles manipulant le temps',
    consigne: 'ne peuvent pas être mis en réserve, coûtent 2 PS',
  },
  destin: {
    label: 'Souffles manipulant le destin',
    consigne: 'à utiliser juste avant ou après un jet de dés',
  },
  pnj: { label: 'Souffles aidant les PNJ', consigne: null },
};

/** Ordre d'affichage des races — identique à `RACES` côté web. */
const RACES: HommeDragonRace[] = ['DRAGON_VERT', 'DRAGON_BLEU', 'DRAGON_ROUGE', 'DRAGON_NOIR'];

const RACE_LABELS: Record<HommeDragonRace, string> = {
  DRAGON_VERT: 'Dragon Vert',
  DRAGON_BLEU: 'Dragon Bleu',
  DRAGON_ROUGE: 'Dragon Rouge',
  DRAGON_NOIR: 'Dragon Noir',
};

/** Niveau des « souffles multicolores » (`docs/dragons.md`, « Niveaux ») : à partir de là,
 * l'homme-dragon peut choisir des souffles d'une autre race que la sienne. */
export const SOUFFLES_MULTICOLORES_LEVEL = 3;

/** Entrée du catalogue `souffle` telle que renvoyée par `GameSystemService.getContent()` — `data`
 * reste opaque (`unknown`) : c'est la même forme que `ContentEntryDto`, lue défensivement. */
export interface SouffleCatalogEntry {
  key: string;
  data?: unknown;
}

interface SouffleData {
  label?: unknown;
  description?: unknown;
  ps?: unknown;
  race?: unknown;
  famille?: unknown;
  reservable?: unknown;
}

export interface AvailableSouffle {
  key: string;
  /** `label` du catalogue, repli sur la clé si le catalogue n'en porte pas. */
  label: string;
  /** Effet (description du catalogue), chaîne vide si absent. */
  description: string;
  /** Coût en Points de Souffle, `null` si le catalogue ne le porte pas. */
  ps: number | null;
  /** `false` uniquement pour les souffles qui ne peuvent pas être mis en réserve (temps). */
  reservable: boolean;
}

export type SouffleGroupSection = 'communs' | 'race' | 'autres-races';

export interface SouffleGroup {
  section: SouffleGroupSection;
  /** Titre du groupe (famille, ou « Souffles du Dragon X »). */
  title: string;
  /** Consigne d'usage du groupe, `null` si le livre n'en donne pas. */
  consigne: string | null;
  souffles: AvailableSouffle[];
}

function readData(entry: SouffleCatalogEntry): SouffleData {
  const d = entry.data;
  return d && typeof d === 'object' ? (d as SouffleData) : {};
}

function toAvailable(entry: SouffleCatalogEntry): AvailableSouffle {
  const d = readData(entry);
  return {
    key: entry.key,
    label: typeof d.label === 'string' && d.label ? d.label : entry.key,
    description: typeof d.description === 'string' ? d.description : '',
    ps: typeof d.ps === 'number' ? d.ps : null,
    reservable: d.reservable !== false,
  };
}

/**
 * Souffles disponibles pour un Homme Dragon, lus du catalogue `souffle` UNIQUEMENT (jamais des
 * pouvoirs d'éveil), en groupes ordonnés :
 *  1. les souffles communs (sans `race`) par famille — temps, destin, PNJ ;
 *  2. les souffles de la race du dragon ;
 *  3. dès le niveau des souffles multicolores, ceux des trois autres races (une race par groupe,
 *     dans l'ordre d'affichage des races).
 *
 * Un groupe sans entrée est omis ; une entrée commune dont la famille est inconnue est ignorée.
 * L'ordre du catalogue est conservé au sein de chaque groupe. Fonction pure, sans pdf-lib : la
 * règle de disponibilité reste testable seule.
 */
export function availableSouffles(
  level: number,
  race: HommeDragonRace,
  catalogue: readonly SouffleCatalogEntry[],
): SouffleGroup[] {
  const groups: SouffleGroup[] = [];
  const communs = catalogue.filter((e) => !readData(e).race);

  for (const famille of SOUFFLE_FAMILLES) {
    const souffles = communs.filter((e) => readData(e).famille === famille).map(toAvailable);
    if (souffles.length > 0) {
      const info = SOUFFLE_FAMILLE_INFO[famille];
      groups.push({ section: 'communs', title: info.label, consigne: info.consigne, souffles });
    }
  }

  const ofRace = (r: HommeDragonRace): AvailableSouffle[] =>
    catalogue.filter((e) => readData(e).race === r).map(toAvailable);

  const own = ofRace(race);
  if (own.length > 0) {
    groups.push({
      section: 'race',
      title: `Souffles du ${RACE_LABELS[race]}`,
      consigne: null,
      souffles: own,
    });
  }

  if (level >= SOUFFLES_MULTICOLORES_LEVEL) {
    for (const other of RACES.filter((r) => r !== race)) {
      const souffles = ofRace(other);
      if (souffles.length > 0) {
        groups.push({
          section: 'autres-races',
          title: `Souffles du ${RACE_LABELS[other]}`,
          consigne: null,
          souffles,
        });
      }
    }
  }

  return groups;
}
