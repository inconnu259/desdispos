import { BadRequestException } from '@nestjs/common';
import { MAX_SLOT_WINDOW_SLOTS, spanEnd, type DaySlot } from '@master-jdr/shared';
import { parseDayKey } from './day-key';

/** Story 47.1 : durée hors bornes (entier de 1 à 45 créneaux). */
export const DURATION_INVALID_MESSAGE = 'La durée doit être un entier d’au moins 1 créneau';
export const DURATION_CAP_MESSAGE = '15 jours au plus : au-delà, créez deux rendez-vous.';
export const DURATION_FULL_DAY_MESSAGE = 'Une journée entière ne dure qu’un créneau';
export const DURATION_POLL_PENDING_MESSAGE =
  'La durée d’un rendez-vous au vote ouvert se règle dans le composer de dates.';

/** Durée valide d'un rendez-vous : entier de 1 à `MAX_SLOT_WINDOW_SLOTS`, sinon 400 écrit. */
export function assertDuration(durationSlots: number): void {
  if (!Number.isInteger(durationSlots) || durationSlots < 1) {
    throw new BadRequestException(DURATION_INVALID_MESSAGE);
  }
  if (durationSlots > MAX_SLOT_WINDOW_SLOTS) throw new BadRequestException(DURATION_CAP_MESSAGE);
}

/**
 * Story 47.1 (AD-14) — **la** fonction d'`events/` qui calcule la fin d'une plage : tout écrivain de
 * plage de `Seance` (création, modification, choix d'une option de vote, correction de durée) l'appelle
 * et pose ses deux valeurs, jamais `end = start` par défaut. Sans début (séance à dater), pas de fin ;
 * un début sans créneau garde pour fin son propre jour.
 * Une durée hors bornes, ou `FULL_DAY` au-delà d'un créneau, est un 400 écrit.
 */
export function seanceSpanEnd(
  startDate: Date | null,
  startSlot: DaySlot | null,
  durationSlots: number,
): { endDate: Date | null; endSlot: DaySlot | null } {
  assertDuration(durationSlots);
  if (!startDate) return { endDate: null, endSlot: null };
  // Date sans créneau (« sans créneau » à l'affichage) : pas de plage à étendre, la fin reste le début.
  if (!startSlot) return { endDate: startDate, endSlot: null };
  if (startSlot === 'FULL_DAY' && durationSlots > 1) {
    throw new BadRequestException(DURATION_FULL_DAY_MESSAGE);
  }
  const end = spanEnd(startDate.toISOString().substring(0, 10), startSlot, durationSlots);
  return { endDate: parseDayKey(end.date), endSlot: end.slot };
}
