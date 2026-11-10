/**
 * Port de la couche 1 : prévenir que les signaux d'une partie (FR-12) ont peut-être changé
 * (Story 37.8). Implémenté par `parties/`, qui émet vers chaque participant.
 */
export interface PartieSignalsPort {
  /** À appeler APRÈS la mutation et après l'émission de `partie:{id}` — n'émet que par membre.
   *  Ne lève jamais : un échec d'émission ne doit pas faire passer une écriture réussie pour
   *  un échec. */
  notifyChanged(partieId: string): Promise<void>;
}

/** Jeton d'injection de `PartieSignalsPort`. */
export const PARTIE_SIGNALS_PORT = Symbol('PARTIE_SIGNALS_PORT');
