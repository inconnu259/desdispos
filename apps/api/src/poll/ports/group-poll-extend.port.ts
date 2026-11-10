import type { PartieKind } from '@master-jdr/shared';

/**
 * Port de la couche 1 : prolonger le vote d'une conjonction (Story 40.7). Implémenté par `events/`, qui
 * seul connaît la conjonction du sondage et son hôte. Branché par `PortsModule` — `poll/` n'importe
 * jamais `events/`.
 *
 * `PollService` reste l'unique écrivain de `SessionPoll` : il déplace l'échéance dans sa transaction,
 * sous le verrou de la conjonction (`GroupPollVotePort.lockConjonction`). Ce port ne porte que ce que
 * `poll/` ne sait pas : « qui peut prolonger le vote ».
 */
export interface GroupPollExtendPort {
  /**
   * Décide, AVANT toute écriture, que `userId` peut prolonger le vote de la conjonction qui porte ce
   * sondage, et lève sinon une erreur HTTP française, sans rien écrire :
   * - 400 si le sondage n'est rattaché à aucune conjonction de cette partie ;
   * - 403 si `userId` n'est pas l'hôte de la conjonction (administrateur compris).
   * L'appelant a déjà obtenu la cellule de rôle `POLL_EXTEND` sur la partie. Jamais appelé pour le JDR.
   */
  assertCanExtend(
    poll: { id: string; partieId: string },
    partie: { kind: PartieKind },
    userId: string,
  ): Promise<void>;
}

/** Jeton d'injection de `GroupPollExtendPort`. */
export const GROUP_POLL_EXTEND_PORT = Symbol('GROUP_POLL_EXTEND_PORT');
