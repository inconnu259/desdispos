import { isSeancePast } from './seance-span';

/** Pourquoi une soirée n'est plus ouverte : annulée, ou terminée (date passée, ou rencontre isolée close). */
export type EventClosure = 'CANCELLED' | 'ENDED';

/**
 * La règle de statut partagée (épic 49) : une soirée annulée est figée « plus encore » qu'une soirée
 * terminée. Pure : les appelants lui donnent des faits déjà établis — `assertIsolatedOpen` les lit par ses
 * requêtes groupées, `eventIsOpen` les déduit d'un événement chargé.
 */
export function eventClosure(facts: {
  cancelled: boolean;
  finished: boolean;
}): EventClosure | null {
  if (facts.cancelled) return 'CANCELLED';
  return facts.finished ? 'ENDED' : null;
}

/** Ce qu'il faut connaître d'un événement pour dire s'il est encore ouvert. */
export interface EventOpenInput {
  /** Annulation de l'événement (`Event.cancelledAt`). */
  cancelledAt: Date | null;
  /** Plage de la séance — la règle « passée » d'`isSeancePast` (fin, à défaut début). */
  startDate: Date | null;
  endDate: Date | null;
  /** Rencontre isolée : `closedAt` de la partie la termine aussi, sans attendre la date. */
  isolated: boolean;
  partieClosedAt: Date | null;
}

/**
 * Une soirée est ouverte tant qu'elle n'est ni annulée, ni passée (`isSeancePast`), ni — rencontre isolée —
 * close. Lue par la route des jeux sur place et, via `eventClosure`, par `assertIsolatedOpen`.
 */
export function eventIsOpen(event: EventOpenInput, todayKey?: string): boolean {
  const finished =
    isSeancePast(event.startDate, event.endDate, todayKey) ||
    (event.isolated && event.partieClosedAt !== null);
  return eventClosure({ cancelled: event.cancelledAt !== null, finished }) === null;
}
