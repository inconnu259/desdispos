import type { DaySlot } from '@master-jdr/shared';
import { SLOT_LABELS } from '../../calendar/agenda-badge.utils';
import { candidateSpanSentence } from '../../calendar/span-label';

/** « samedi 7 novembre » (le premier du mois s'écrit « 1er »), d'une clé de jour `YYYY-MM-DD`. */
function fullDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return d === 1 ? text.replace(/\b1\b/, '1er') : text;
}

/**
 * Story 54.2 — le créneau du « Meilleur créneau pour l'instant » : « samedi 7 novembre, soir » ; un
 * rendez-vous de plusieurs créneaux s'écrit avec sa plage par `candidateSpanSentence` (« du vendredi 6 soir
 * au dimanche 8 après-midi »), jamais recalculée ici.
 */
export function bestSlotLabel(
  option: { date: string; slot: DaySlot },
  durationSlots: number,
): string {
  const span = candidateSpanSentence(option, durationSlots);
  if (span) return span;
  const day = fullDay(option.date.substring(0, 10));
  return `${day}, ${SLOT_LABELS[option.slot].toLocaleLowerCase('fr-FR')}`;
}

/** « jeudi 5 novembre » : l'échéance d'un vote (toujours jour et date, contrairement à l'encadré). */
export function deadlineDayLabel(expiresAt: string): string {
  return fullDay(expiresAt.substring(0, 10));
}
