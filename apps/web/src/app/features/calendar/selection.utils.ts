import type { AvailKind, CreateAvailabilityBatchItem, DaySlot } from '@desdispos/shared';
import { toISODate } from './constraint-panel/constraint-panel.utils';
import type { WeekCell } from './calendar-week-view/calendar-week-view';

export interface SelectedCell {
  date: Date;
  slot: DaySlot;
}

/** Délai d'appui maintenu (ms) avant l'armement d'une sélection tactile (AC4). Partagé entre les
 *  deux vues pour éviter toute dérive si l'une est ajustée sans l'autre. */
export const LONG_PRESS_MS = 450;

/** Seuil de déplacement (px) au-delà duquel un pointeur souris arme une sélection (pas d'appui
 *  maintenu requis pour la souris — seulement pour le tactile, cf. AC4). */
export const MOVE_THRESHOLD_PX = 8;

/** Type de pointeur reconnu par le geste de sélection (sous-ensemble de `PointerEvent['pointerType']`). */
export type GesturePointerType = 'mouse' | 'touch' | 'pen';

/** Plage de cellules entre `anchor` et `current`, sur la ligne de créneau de `anchor` uniquement
 *  (le glissement en vue semaine reste horizontal, au créneau — cf. maquette de référence). Si
 *  `current` porte un autre slot, il est ignoré : seule sa position (jour) compte. */
export function weekRangeCells(
  anchor: SelectedCell,
  current: SelectedCell,
  cells: WeekCell[],
): SelectedCell[] {
  const anchorIndex = cells.findIndex((c) => c.date.getTime() === anchor.date.getTime());
  const currentIndex = cells.findIndex((c) => c.date.getTime() === current.date.getTime());
  if (anchorIndex === -1 || currentIndex === -1) return [];
  const [start, end] =
    anchorIndex <= currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex];
  return cells.slice(start, end + 1).map((c) => ({ date: c.date, slot: anchor.slot }));
}

/** Plage de jours entre `anchor` et `current`, toujours triée dans l'ordre chronologique
 *  quel que soit le sens du glissement — pas de notion de ligne/colonne, la vue mois sélectionne
 *  à la journée entière. */
export function monthRangeDays(anchor: Date, current: Date): Date[] {
  const [start, end] =
    anchor.getTime() <= current.getTime() ? [anchor, current] : [current, anchor];
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Un item PUNCTUAL par cellule (startDate = endDate = ce jour) — jamais RECURRING (Story 30.3,
 *  encadré n°3). Même forme que buildConstraintDto() cas PONCTUEL, généralisée à N jours. */
export function buildBatchItems(
  cells: SelectedCell[],
  kind: AvailKind,
): CreateAvailabilityBatchItem[] {
  return cells.map((cell) => {
    const dateStr = toISODate(cell.date);
    return {
      kind,
      recurKind: 'PUNCTUAL',
      slot: cell.slot,
      startDate: dateStr,
      endDate: dateStr,
      expiresAt: new Date(dateStr + 'T23:59:59Z').toISOString(),
    };
  });
}

/**
 * Story 36.10 — clé d'un créneau composé, `YYYY-MM-DD|SLOT`.
 *
 * 🚨 **Datée par sa JOURNÉE, jamais par `getTime()`.** Les deux extrémités qu'elle doit faire
 * coïncider ne sont pas de même nature : d'un côté les `Date` LOCALES que les grilles
 * construisent, de l'autre les dates ISO d'options de vote venues du serveur, dont le reste du
 * calendrier ne lit déjà que les dix premiers caractères. Une clé fondée sur l'horodatage ferait
 * diverger les deux dans tout fuseau non nul, et un créneau déjà proposé n'apparaîtrait pas
 * comme composé.
 *
 * Point UNIQUE de la convention, partagé par `CalendarView` et les deux vues de grille.
 */
export function composeCellKey(date: Date, slot: DaySlot): string {
  return `${toISODate(date)}|${slot}`;
}

/**
 * Story 52.3 — réunit des créneaux sans doublon, triés par date (l'ordre existant d'un même jour est gardé). Sert au
 * glissement du mode déclaration, qui AJOUTE sa plage aux créneaux déjà retenus au lieu de les remplacer.
 */
export function mergeCells(
  base: readonly SelectedCell[],
  added: readonly SelectedCell[],
): SelectedCell[] {
  const seen = new Set<string>();
  const merged: SelectedCell[] = [];
  for (const cell of [...base, ...added]) {
    const key = composeCellKey(cell.date, cell.slot);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(cell);
  }
  return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
}
