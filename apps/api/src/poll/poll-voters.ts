import type { GameSystemFamily } from '@master-jdr/shared';

/** Ce qu'il faut savoir d'une partie pour dire qui peut voter sur ses sondages. */
export interface PollVotersInput {
  family: GameSystemFamily;
  /** Propriétaire (MJ) de la partie ; `null` si son compte a disparu. */
  ownerId: string | null;
  /** Membres (`Membership`) de la partie — le MJ n'en a jamais. */
  memberIds: string[];
  /** Votants éligibles d'un sondage de GROUPE ou de soirée, fournis par `events/` (`eligibleVoters`) ;
   *  `null` en JDR. */
  groupVoterIds: string[] | null;
}

/**
 * Qui peut voter sur un sondage (Story 44.2, AD-2) — l'UNIQUE définition lue par l'effectif et les « a
 * répondu » des sondages ouverts :
 * - JDR : le MJ et ses membres (le MJ vote aussi, Story 36.6), dédoublonnés, le MJ d'abord ;
 * - ralliement (groupe, soirée) : les votants éligibles de la conjonction, tels que `events/` les définit.
 */
export function pollVoters(input: PollVotersInput): string[] {
  if (input.family === 'ralliement') return [...new Set(input.groupVoterIds ?? [])];
  const owner = input.ownerId ? [input.ownerId] : [];
  return [...new Set([...owner, ...input.memberIds])];
}
