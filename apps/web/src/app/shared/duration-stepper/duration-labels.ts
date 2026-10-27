import { spanEnd, type DaySlot } from '@master-jdr/shared';
import { SLOT_LABELS } from '../../features/calendar/agenda-badge.utils';
import { shortDayLabel } from '../../features/events/event-card.util';

/**
 * Story 47.1 (UX-DR14) — les mots de la durée d'un rendez-vous sont fonctionnels et identiques dans les
 * trois thèmes, sans mot du JDR ni « partie » (le compteur sert aussi les soirées). Ils vivent ici,
 * hors du registre des tons : dix clés neutres de plus feraient passer le thème Atelier sous la part de
 * vocabulaire propre que garde `theme-tone.service.spec.ts`.
 */
export const DURATION_TEXT = {
  label: 'Durée',
  shorten: 'Raccourcir',
  lengthen: 'Allonger',
  /** Le plafond de 15 jours, mot pour mot celui du serveur. */
  max: '15 jours au plus : au-delà, créez deux rendez-vous.',
  /** Rendez-vous au vote ouvert et sans date : la durée se lit ici, se règle dans le composer. */
  pollPending: 'La durée se règle dans le composer de dates tant que le vote est ouvert.',
} as const;

/** Un départ de plage : clé de jour `AAAA-MM-JJ` et créneau. */
export interface SpanStart {
  date: string;
  slot: DaySlot;
}

/** « 1 créneau » / « 3 créneaux ». */
export function durationSlotsLabel(slots: number): string {
  return slots === 1 ? '1 créneau' : `${slots} créneaux`;
}

/** « soit 1 jour » / « soit 3 jours » : la longueur en jours, arrondie au jour entamé. */
export function durationDaysLabel(slots: number): string {
  const days = Math.ceil(slots / 3);
  return days === 1 ? 'soit 1 jour' : `soit ${days} jours`;
}

function slotOfDay(day: string, slot: DaySlot): string {
  return `${shortDayLabel(day, false)} ${SLOT_LABELS[slot].toLocaleLowerCase('fr-FR')}`;
}

/** « sam. 14 après-midi → sam. 14 soir » : la plage écrite en clair depuis son départ (« sam. 14 soir » pour
 *  un seul créneau). */
export function durationRangeLabel(start: SpanStart, slots: number): string {
  // Un seul créneau : le départ suffit, une plage « soir → soir » n’apprendrait rien.
  if (slots === 1) return slotOfDay(start.date, start.slot);
  const end = spanEnd(start.date, start.slot, slots);
  return `${slotOfDay(start.date, start.slot)} → ${slotOfDay(end.date, end.slot)}`;
}

/**
 * Ce que le compteur écrit sous la durée : la plage en clair si le départ est connu, sinon « soit N
 * jours » dès 3 créneaux, sinon rien. Une durée que la plage ne supporte pas (journée entière au-delà
 * d'un créneau) n'écrit pas de plage.
 */
export function durationDetail(slots: number, start: SpanStart | null): string {
  if (start && !(start.slot === 'FULL_DAY' && slots > 1)) return durationRangeLabel(start, slots);
  return slots >= 3 ? durationDaysLabel(slots) : '';
}
