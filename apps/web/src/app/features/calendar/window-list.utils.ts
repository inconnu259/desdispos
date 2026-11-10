import type { AggregatedSlotDto, AvailableSlotDto } from '@master-jdr/shared';

type AnySlot = AvailableSlotDto | AggregatedSlotDto;

/** La clé d'une fenêtre (`AAAA-MM-JJ|créneau`) : celle des grilles (`composeCellKey`) et de la liste. */
export function windowKeyOf(slot: { date: string; slot: string }): string {
  return `${slot.date}|${slot.slot}`;
}

/**
 * Story 46.3 (AR8) — LA fonction qui décide des fenêtres de l'automate affichées : celles que le serveur sert, moins
 * celles qui sont déjà dans le composer. Une fenêtre quitte la liste dès qu'elle y est (elle apparaît en liseré tireté
 * sur la grille) et y revient quand on la retire ou qu'on annule. Sans composer (`composedKeys` nul), la liste servie.
 * Le serveur retire déjà celles d'un sondage ouvert ; ici, seulement ce qui n'est pas encore écrit.
 */
export function displayedWindows<T extends AnySlot>(
  served: readonly T[],
  composedKeys: ReadonlySet<string> | null,
): T[] {
  if (!composedKeys || composedKeys.size === 0) return [...served];
  return served.filter((s) => !composedKeys.has(windowKeyOf(s)));
}
