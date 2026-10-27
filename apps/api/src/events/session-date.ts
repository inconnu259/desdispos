import type { DaySlot } from '@master-jdr/shared';

const SLOT_LABELS: Record<DaySlot, string> = {
  MORNING: 'matin',
  AFTERNOON: 'après-midi',
  EVENING: 'soir',
  FULL_DAY: 'toute la journée',
};

/** Date d'une conjonction écrite pour un e-mail (Story 40.4) : « samedi 24 octobre (soir) ». Le jour
 *  est celui de la clé UTC stockée ; sans créneau, seule la date est écrite. */
export function formatSessionDate(date: Date, slot: DaySlot | null): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return slot ? `${formatted} (${SLOT_LABELS[slot]})` : formatted;
}

/** Story 47.2 : le jour de `date` en clé UTC, pour comparer deux bornes sans l'heure. */
const dayKeyOf = (date: Date): string => date.toISOString().substring(0, 10);

/**
 * La plage d'une conjonction écrite pour un e-mail. Un créneau (fin absente, ou identique au début) garde
 * le texte de `formatSessionDate` ; une plage de plusieurs créneaux s'écrit « du samedi 14 novembre (soir)
 * au dimanche 15 novembre (après-midi) ».
 */
export function formatSessionSpan(
  startDate: Date,
  startSlot: DaySlot | null,
  endDate?: Date | null,
  endSlot?: DaySlot | null,
): string {
  const sameDay = !endDate || dayKeyOf(endDate) === dayKeyOf(startDate);
  const sameSlot = (endSlot ?? startSlot) === startSlot;
  if (sameDay && sameSlot) return formatSessionDate(startDate, startSlot);
  const end = endDate ?? startDate;
  return `du ${formatSessionDate(startDate, startSlot)} au ${formatSessionDate(end, endSlot ?? null)}`;
}
