import type { DaySlot } from '@master-jdr/shared';

/**
 * Une plage occupée par une séance datée (Story 37.8, AD-9) : la date (jour UTC) et le créneau,
 * RIEN d'autre. Ni titre, ni identifiant de partie, ni identité : la non-fuite entre parties est
 * structurelle, elle découle de cette forme et non d'un filtrage en aval.
 */
export interface OccupiedSpan {
  date: Date;
  slot: DaySlot;
}

/**
 * Port de la couche 1 (planification) : « sur quoi chaque utilisateur est-il déjà engagé, toutes
 * parties confondues ? ». Déclaré ici pour que `availability/` n'importe jamais une couche
 * supérieure ; implémenté par `events/` (Story 37.8), branché par `PortsModule`.
 */
export interface OccupiedSpansPort {
  /**
   * Pour chaque utilisateur demandé (clé toujours présente, éventuellement vide), les plages des
   * séances datées de CHACUNE des parties où il participe — propriétaire ou membre ; pour une
   * campagne épisodique, propriétaire ou inscrit à cette séance. Un créneau de début vide se lit
   * `FULL_DAY` ; une séance sans date est ignorée.
   */
  occupiedSpansOf(userIds: string[]): Promise<Map<string, OccupiedSpan[]>>;
}

/** Jeton d'injection de `OccupiedSpansPort`. */
export const OCCUPIED_SPANS_PORT = Symbol('OCCUPIED_SPANS_PORT');
