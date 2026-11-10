import type { ContentEntryDto, HommeDragonRace } from '@master-jdr/shared';
import { RACE_LABELS } from '../homme-dragon-races';

/** Forme (lue défensivement) d'une entrée des catalogues `souffle` / `souffleRituel`. */
export interface SouffleCatalogData {
  label?: string;
  description?: string;
  ps?: number;
  race?: string;
  famille?: string;
}

const dataOf = (entry: ContentEntryDto | undefined): SouffleCatalogData =>
  (entry?.data ?? {}) as SouffleCatalogData;

/** Étiquette d'un souffle : texte toujours écrit, la teinte de race (gemme) ne vient qu'en plus. */
export interface SouffleTag {
  text: string;
  race: HommeDragonRace | null;
}

/** Vue d'un souffle de la réserve, résolue au catalogue (repli lisible sur la clé brute). */
export interface SouffleView {
  key: string;
  label: string;
  /** « 1 PS », `null` si le catalogue ne porte pas de coût. */
  cost: string | null;
  description: string;
  /** `null` pour une clé que les catalogues ne connaissent plus. */
  tag: SouffleTag | null;
}

const FAMILLE_LABELS: Record<string, string> = { temps: 'Temps', destin: 'Destin', pnj: 'PNJ' };

/** Résout une clé de réserve au catalogue `souffle` puis `souffleRituel`. Une clé inconnue (souffle
 *  retiré du catalogue après avoir été placé) reste lisible : libellé = clé brute. */
export function souffleView(
  key: string,
  souffles: readonly ContentEntryDto[],
  rituels: readonly ContentEntryDto[],
): SouffleView {
  const entry = souffles.find((e) => e.key === key);
  const ritual = entry ? undefined : rituels.find((e) => e.key === key);
  const found = entry ?? ritual;
  const d = dataOf(found);
  let tag: SouffleTag | null = null;
  if (entry) {
    const race = d.race as HommeDragonRace | undefined;
    if (race && RACE_LABELS[race]) tag = { text: RACE_LABELS[race], race };
    else if (d.famille)
      tag = { text: `Commun · ${FAMILLE_LABELS[d.famille] ?? d.famille}`, race: null };
  } else if (ritual) {
    tag = { text: 'Rituel', race: null };
  }
  return {
    key,
    label: d.label?.trim() || key,
    cost: typeof d.ps === 'number' ? `${d.ps} PS` : null,
    description: d.description?.trim() ?? '',
    tag,
  };
}

/** Libellé de l'emplacement : « 1 emplacement », « 3 emplacements ». */
export function emplacements(count: number): string {
  return `${count} emplacement${count > 1 ? 's' : ''}`;
}
