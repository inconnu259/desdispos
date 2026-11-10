import type { PartieKind } from '@master-jdr/shared';

/**
 * Port de la couche 1 : fixer la date d'une conjonction depuis son sondage (Story 40.6). Implémenté par
 * `events/`, qui seul connaît la conjonction du sondage, son hôte, ses inscrits et son e-mail. Branché
 * par `PortsModule` — `poll/` n'importe jamais `events/`.
 *
 * `PollService` reste l'unique écrivain de `SessionPoll` : il ferme le sondage dans sa transaction, et
 * l'écriture de la plage de la séance passe par `SeanceDatePort`. Ce port ne porte que ce que
 * `poll/` ne sait pas : « qui peut fixer la date » et « prévenir les inscrits ».
 */
export interface GroupPollChoosePort {
  /**
   * Décide, AVANT toute écriture, que `userId` peut fixer la date de la conjonction qui porte ce sondage,
   * et lève sinon une erreur HTTP française, sans rien écrire :
   * - 404 si le sondage n'est rattaché à aucune conjonction de cette partie ;
   * - 403 si `userId` n'est pas l'hôte de la conjonction (administrateur compris).
   * L'appelant a déjà obtenu la cellule de rôle `POLL_CHOOSE` sur la partie. Jamais appelé pour le JDR.
   */
  assertCanChoose(
    poll: { id: string; partieId: string },
    partie: { kind: PartieKind },
    userId: string,
  ): Promise<void>;

  /**
   * APRÈS le commit : l'e-mail « C'est fixé » part vers les inscrits confirmés de la conjonction (l'hôte
   * exclu). Ne lève jamais : un échec de lecture ou d'envoi est journalisé et n'annule rien.
   */
  notifyDateFixed(poll: { id: string; partieId: string }): Promise<void>;
}

/** Jeton d'injection de `GroupPollChoosePort`. */
export const GROUP_POLL_CHOOSE_PORT = Symbol('GROUP_POLL_CHOOSE_PORT');
