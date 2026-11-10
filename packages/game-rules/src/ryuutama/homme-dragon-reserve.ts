import { SOUFFLES_RITUELS_LEVEL } from './homme-dragon-derived.ts';
import { SOUFFLES_MULTICOLORES_LEVEL } from './homme-dragon-souffles.ts';
import type { SouffleCatalogEntry } from './homme-dragon-souffles.ts';
import type { HommeDragonRace } from './validate-homme-dragon.ts';
import type { ValidationError, ValidationResult } from './types.ts';

/**
 * Réserve de souffles de l'Homme Dragon (Story 33.6, `docs/dragons.md`) — règles pures, partagées
 * par le serveur (autorité) et la fiche web (grisage des souffles non placeables).
 *
 * La réserve est une liste POSITIONNELLE : l'index vaut « numéro d'emplacement − 1 », la valeur est
 * la clé d'un souffle (catalogue `souffle` ou `souffleRituel`), `null`/absent = emplacement vide.
 */
export type Reserve = readonly (string | null | undefined)[];

/** Raisons écrites d'un refus — mêmes mots sur la fiche (grisage) et dans les erreurs serveur. */
export const RESERVE_REASON_TEMPS = 'Non réservable : souffle du temps';
export const RESERVE_REASON_QUOTA_AUTRE_RACE = "Un seul souffle d'une autre race";
export const RESERVE_REASON_RITUEL = `Admis dès le niveau ${SOUFFLES_RITUELS_LEVEL}`;
export const RESERVE_REASON_AUTRE_RACE_NIVEAU = `Autres races : à partir du niveau ${SOUFFLES_MULTICOLORES_LEVEL}`;
export const RESERVE_REASON_INCONNU = 'Souffle inconnu du catalogue';

/** « Déjà dans l'emplacement N » — raison d'un souffle d'une autre race déjà placé, ou repère non
 * bloquant d'un souffle commun / de la race. */
export function reserveReasonDejaDans(slot: number): string {
  return `Déjà dans l'emplacement ${slot}`;
}

/** Capacité de la réserve : 0 au niveau 1, puis niveau − 1 (`docs/dragons.md`, « Niveaux »). */
export function reserveCapacity(level: number): number {
  return Math.max(level - 1, 0);
}

/** Catalogues nécessaires à la validation : `souffle` et `souffleRituel`. */
export interface ReserveCatalogs {
  souffles: readonly SouffleCatalogEntry[];
  rituels: readonly SouffleCatalogEntry[];
}

/** Nature d'un souffle pour la réserve. `inconnu` = absent des deux catalogues. */
export type ReserveSouffleKind =
  | 'commun'
  | 'temps'
  | 'race'
  | 'autre-race'
  | 'rituel'
  | 'inconnu';

interface RawSouffleData {
  race?: unknown;
  reservable?: unknown;
}

function readData(entry: SouffleCatalogEntry): RawSouffleData {
  const d = entry.data;
  return d && typeof d === 'object' ? (d as RawSouffleData) : {};
}

/**
 * Classe un souffle. `temps` = `reservable: false` (seuls Passé et Futur aujourd'hui), prioritaire
 * sur la race. Un rituel (catalogue `souffleRituel`) n'est JAMAIS « autre race ». Le catalogue
 * `souffle` est consulté avant les rituels.
 */
export function reserveSouffleKind(
  key: string,
  race: HommeDragonRace,
  catalogs: ReserveCatalogs,
): ReserveSouffleKind {
  const entry = catalogs.souffles.find((e) => e.key === key);
  if (entry) {
    const d = readData(entry);
    if (d.reservable === false) return 'temps';
    if (typeof d.race === 'string' && d.race) return d.race === race ? 'race' : 'autre-race';
    return 'commun';
  }
  if (catalogs.rituels.some((e) => e.key === key)) return 'rituel';
  return 'inconnu';
}

function norm(v: string | null | undefined): string | null {
  return v ?? null;
}

/** Numéros (1-based) des emplacements occupés par `key`, hors `exceptIndex` (0-based). */
function slotsHolding(reserve: Reserve, key: string, exceptIndex?: number): number[] {
  const slots: number[] = [];
  reserve.forEach((k, i) => {
    if (i !== exceptIndex && norm(k) === key) slots.push(i + 1);
  });
  return slots;
}

export interface ReservePlacement {
  key: string;
  kind: ReserveSouffleKind;
  /** `true` si le souffle peut être mis dans l'emplacement visé. */
  placeable: boolean;
  /** Raison écrite du refus, `null` si placeable. */
  reason: string | null;
  /** Numéros (1-based) des AUTRES emplacements qui contiennent déjà ce souffle : repère
   * « Déjà dans l'emplacement N » (non bloquant sauf pour une autre race). */
  placedIn: number[];
}

/**
 * Peut-on mettre le souffle `key` dans l'emplacement `slotIndex` (0-based) de la réserve actuelle ?
 * Le quota « autre race » se calcule HORS de l'emplacement visé : remplacer le souffle d'une autre
 * race par un autre souffle d'une autre race, sur son propre emplacement, reste possible.
 * Ne vérifie PAS la capacité (le numéro d'emplacement est supposé valide).
 */
export function reservePlacement(
  key: string,
  slotIndex: number,
  reserve: Reserve,
  level: number,
  race: HommeDragonRace,
  catalogs: ReserveCatalogs,
): ReservePlacement {
  const kind = reserveSouffleKind(key, race, catalogs);
  const placedIn = slotsHolding(reserve, key, slotIndex);
  let reason: string | null = null;

  switch (kind) {
    case 'temps':
      reason = RESERVE_REASON_TEMPS;
      break;
    case 'inconnu':
      reason = RESERVE_REASON_INCONNU;
      break;
    case 'rituel':
      if (level < SOUFFLES_RITUELS_LEVEL) reason = RESERVE_REASON_RITUEL;
      break;
    case 'autre-race': {
      if (level < SOUFFLES_MULTICOLORES_LEVEL) {
        reason = RESERVE_REASON_AUTRE_RACE_NIVEAU;
        break;
      }
      // Quota hors emplacement visé : un autre emplacement contient-il un souffle d'une autre race ?
      for (let i = 0; i < reserve.length; i++) {
        const other = norm(reserve[i]);
        if (i === slotIndex || other === null) continue;
        if (reserveSouffleKind(other, race, catalogs) !== 'autre-race') continue;
        reason = other === key ? reserveReasonDejaDans(i + 1) : RESERVE_REASON_QUOTA_AUTRE_RACE;
        break;
      }
      break;
    }
    default:
      break;
  }

  return { key, kind, placeable: reason === null, reason, placedIn };
}

/**
 * `reservePlacement()` pour chaque souffle de `keys`, indexé par clé — un seul passage pour le
 * grisage de la fenêtre de choix.
 */
export function reservePlacements(
  keys: readonly string[],
  slotIndex: number,
  reserve: Reserve,
  level: number,
  race: HommeDragonRace,
  catalogs: ReserveCatalogs,
): Record<string, ReservePlacement> {
  const out: Record<string, ReservePlacement> = {};
  for (const key of keys) {
    out[key] = reservePlacement(key, slotIndex, reserve, level, race, catalogs);
  }
  return out;
}

/**
 * Valide la composition COMPLÈTE d'une réserve (autorité serveur). `previous` est la réserve
 * stockée avant le geste : un emplacement inchangé est toléré même s'il ne respecterait plus les
 * règles d'aujourd'hui (souffle retiré du catalogue, niveau qui baisse, surplus d'emplacements —
 * aucune purge, la ligne reste lisible et retirable). Seul ce qui est nouvellement placé est
 * contrôlé emplacement par emplacement ; le quota « un seul souffle d'une autre race, sur un
 * seul emplacement » se contrôle toujours sur l'ensemble.
 */
export function validateReserve(
  reserve: Reserve,
  level: number,
  race: HommeDragonRace,
  catalogs: ReserveCatalogs,
  previous: Reserve = [],
): ValidationResult {
  const errors: ValidationError[] = [];
  const capacity = reserveCapacity(level);
  let autreRaceSlots = 0;

  reserve.forEach((raw, i) => {
    const key = norm(raw);
    if (key === null) return;
    const field = `reserve[${i}]`;
    const unchanged = norm(previous[i]) === key;
    const kind = reserveSouffleKind(key, race, catalogs);

    if (kind === 'autre-race') autreRaceSlots++;
    if (unchanged) return;

    if (i >= capacity) {
      errors.push({
        field,
        message: `Emplacement ${i + 1} hors capacité (${capacity} emplacement${capacity > 1 ? 's' : ''} au niveau ${level})`,
      });
      return;
    }
    if (kind === 'inconnu') {
      errors.push({ field, message: RESERVE_REASON_INCONNU });
    } else if (kind === 'temps') {
      errors.push({ field, message: RESERVE_REASON_TEMPS });
    } else if (kind === 'rituel' && level < SOUFFLES_RITUELS_LEVEL) {
      errors.push({ field, message: RESERVE_REASON_RITUEL });
    } else if (kind === 'autre-race' && level < SOUFFLES_MULTICOLORES_LEVEL) {
      errors.push({ field, message: RESERVE_REASON_AUTRE_RACE_NIVEAU });
    }
  });

  if (autreRaceSlots > 1) {
    errors.push({ field: 'reserve', message: RESERVE_REASON_QUOTA_AUTRE_RACE });
  }

  return { valid: errors.length === 0, errors };
}
