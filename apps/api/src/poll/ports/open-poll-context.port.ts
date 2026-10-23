import type { OrganizerCan, PartieStatus } from '@master-jdr/shared';

/**
 * Ce que la couche 2 sait d'un sondage ouvert et que `poll/` ne peut pas lire lui-même (Story 44.2, AD-15) :
 * le rendez-vous (séance) qui le porte, le statut de sa partie, les droits d'organisateur de la personne qui
 * lit et — pour un groupe ou une soirée — qui peut y voter.
 */
export interface OpenPollContext {
  seanceId: string;
  /** Titre du rendez-vous (celui de l'événement). */
  title: string;
  /** Statut de la partie du sondage, dérivé par `partieStatus()` — seule source de « partie active ». */
  status: PartieStatus;
  /** Droits d'organisateur de la personne qui lit sur cette séance (Story 44.1). */
  can: OrganizerCan;
  /** Votants éligibles d'un sondage de GROUPE ou de soirée (`eligibleVoters`) ; `null` en JDR, où les ayants
   *  droit sont le MJ et ses membres (`pollVoters`). */
  groupVoterIds: string[] | null;
}

/**
 * Port de la couche 1 : « que faut-il savoir de ces sondages ouverts pour les servir à cette personne ? »
 * Implémenté EN LOT par `events/` (jamais une requête par sondage), branché par `PortsModule` — `poll/`
 * n'importe jamais `events/`. Un sondage rattaché à aucune séance est absent du résultat.
 */
export interface OpenPollContextPort {
  contextOf(userId: string, pollIds: string[]): Promise<Map<string, OpenPollContext>>;
}

/** Jeton d'injection de `OpenPollContextPort`. */
export const OPEN_POLL_CONTEXT_PORT = Symbol('OPEN_POLL_CONTEXT_PORT');
