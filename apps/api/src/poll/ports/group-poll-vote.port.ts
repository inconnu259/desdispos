import type { Prisma } from '@prisma/client';
import type { PartieKind } from '@master-jdr/shared';

/**
 * Port de la couche 1 : « cette personne peut-elle voter sur ce sondage de groupe ? » (Story 40.5).
 * Implémenté par `events/`, qui seul connaît la conjonction du sondage, ses inscrits et la définition
 * unique des votants éligibles (`eligibleVoters`). Branché par `PortsModule` — `poll/` n'importe
 * jamais `events/`.
 */
export interface GroupPollVotePort {
  /**
   * Vérifie qu'un vote (ou son retrait) de `userId` sur le sondage d'un GROUPE de ralliement est
   * recevable, et lève sinon une erreur HTTP française, sans rien écrire :
   * - 403 si `userId` n'est pas un votant éligible de la conjonction ;
   * - 400 si le sondage n'est rattaché à aucune conjonction de cette partie, si la date est déjà
   *   fixée, ou si l'échéance (`expiresAt`) est dépassée.
   * L'appelant a déjà décidé du droit de rôle (`POLL_VOTE`) et vérifié que le sondage est ouvert et
   * appartient à la partie. Jamais appelé pour une partie de JDR.
   */
  assertCanVote(
    poll: { id: string; partieId: string; expiresAt: Date | null },
    partie: { kind: PartieKind },
    userId: string,
  ): Promise<void>;

  /**
   * Story 40.6 : dans la transaction de l'appelant, prend le verrou de ligne de la partie PUIS celui de
   * l'événement du sondage, et dit si la date de la conjonction est déjà fixée. Un vote (ou son retrait)
   * et la fixation de la date relisent leur état après ce verrou : l'un des deux gagne, l'autre voit le
   * sondage fermé. Lève 400 si le sondage n'est rattaché à aucune conjonction de cette partie. Jamais
   * appelé pour une partie de JDR.
   */
  lockConjonction(
    tx: Prisma.TransactionClient,
    poll: { id: string; partieId: string },
  ): Promise<{ dated: boolean }>;
}

/** Jeton d'injection de `GroupPollVotePort`. */
export const GROUP_POLL_VOTE_PORT = Symbol('GROUP_POLL_VOTE_PORT');
