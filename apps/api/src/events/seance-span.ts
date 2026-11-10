import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MAX_SLOT_WINDOW_SLOTS, spanEnd, type DaySlot } from '@master-jdr/shared';
import { parseDayKey, todayKeyUtc } from './day-key';

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

/**
 * Story 47.2 (AD-14) — **la** règle « passée » : la fin de la plage (à défaut son début) est strictement
 * avant le jour courant UTC. Aujourd'hui reste à venir, et une plage commencée y reste jusqu'à sa fin.
 * Une séance sans date n'est jamais passée.
 */
export function isSeancePast(
  startDate: Date | null,
  endDate?: Date | null,
  todayKey: string = todayKeyUtc(),
): boolean {
  const last = endDate ?? startDate;
  return last !== null && last !== undefined && last.toISOString().substring(0, 10) < todayKey;
}

/**
 * Story 47.2 — le même prédicat pour Prisma : les séances À VENIR, c'est-à-dire sans date ou dont la fin
 * (à défaut le début) est aujourd'hui ou plus tard. À glisser dans un `OR` de `where`.
 */
export function upcomingSeanceOr(startOfToday: Date | null): Prisma.SeanceWhereInput[] {
  return [
    { startDate: null },
    ...(startOfToday
      ? [{ endDate: { gte: startOfToday } }, { endDate: null, startDate: { gte: startOfToday } }]
      : []),
  ];
}
