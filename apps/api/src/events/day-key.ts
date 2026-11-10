/** Clé `YYYY-MM-DD` du jour courant en UTC — même convention que le calendrier
 *  (`EventsService.recomputeNextSession` compare au début du jour courant en UTC). */
export function todayKeyUtc(now: Date = new Date()): string {
  return now.toISOString().substring(0, 10);
}

/** Minuit UTC du jour `dayKey`, ou `null` si la clé ne désigne pas un vrai jour du calendrier. */
export function parseDayKey(dayKey: string): Date | null {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().substring(0, 10) === dayKey ? date : null;
}
