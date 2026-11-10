import { spanSlots, type DaySlot } from '@master-jdr/shared';
import { composeCellKey } from './selection.utils';
import { toDateKey } from './day-detail.utils';

/** Un départ de plage désigné dans le composer (jour local et créneau). */
export interface ComposeStart {
  date: Date;
  slot: DaySlot;
}

/**
 * Story 47.4 — les créneaux qu'allument les plages des départs désignés, en clés `AAAA-MM-JJ|CRÉNEAU`
 * (`composeCellKey`), départs EXCLUS : un départ garde son trait tireté (`band--composed`), les autres bandes de
 * sa plage prennent l'aperçu. Le dépliage est celui de `spanSlots` (`@master-jdr/shared`), seule règle de
 * couverture : soir → matin du lendemain. À 1 créneau rien n'est allumé (la grille reste celle d'avant), et une
 * journée entière n'existe qu'à 1 : au-delà, elle n'a pas de plage.
 */
export function composeSpanKeys(
  starts: readonly ComposeStart[],
  durationSlots: number,
): ReadonlySet<string> {
  const covered = new Set<string>();
  if (!Number.isInteger(durationSlots) || durationSlots <= 1) return covered;
  const startKeys = new Set(starts.map((s) => composeCellKey(s.date, s.slot)));
  for (const start of starts) {
    if (start.slot === 'FULL_DAY') continue;
    for (const s of spanSlots(toDateKey(start.date), start.slot, durationSlots)) {
      const key = `${s.date}|${s.slot}`;
      if (!startKeys.has(key)) covered.add(key);
    }
  }
  return covered;
}

/** Story 47.4 — le premier départ désigné (jour puis créneau), d'où la plage s'écrit sous le compteur. */
export function earliestStart(starts: readonly ComposeStart[]): ComposeStart | null {
  const rank: Record<DaySlot, number> = { FULL_DAY: -1, MORNING: 0, AFTERNOON: 1, EVENING: 2 };
  let best: ComposeStart | null = null;
  for (const s of starts) {
    if (
      !best ||
      toDateKey(s.date) < toDateKey(best.date) ||
      (toDateKey(s.date) === toDateKey(best.date) && rank[s.slot] < rank[best.slot])
    ) {
      best = s;
    }
  }
  return best;
}
