import type { Prisma } from '@prisma/client';
import type { DaySlot } from '@master-jdr/shared';

/**
 * Port de la couche 1 : poser la date d'une séance quand un vote est clos (Story 37.8, AD-15).
 * Implémenté par `events/`, écrivain unique des séances ET de `Partie.nextSessionDate/Slot`.
 */
export interface SeanceDatePort {
  /**
   * Dans la transaction de l'appelant : écrit la plage de la séance rattachée au vote `pollId`
   * (`end = spanEnd(start, Seance.durationSlots)`, soit `start = end` pour un créneau), puis recalcule la prochaine séance de la partie. Le vote clos, la date et la
   * valeur dérivée sont ainsi validés ensemble ou pas du tout. N'émet jamais : l'appelant émet
   * après son commit. Une date passée n'est jamais retenue comme prochaine séance.
   */
  chooseDate(
    tx: Prisma.TransactionClient,
    pollId: string,
    date: Date,
    slot: DaySlot,
  ): Promise<void>;
}

/** Jeton d'injection de `SeanceDatePort`. */
export const SEANCE_DATE_PORT = Symbol('SEANCE_DATE_PORT');
