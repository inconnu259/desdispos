import type { InscriptionStatus } from '@master-jdr/shared';

/** Ce qu'il faut savoir d'une conjonction pour dire qui peut voter sur son sondage de dates. */
export interface EligibleVotersInput {
  /** Hôte de la conjonction (`null` si son compte a disparu). */
  hostId: string | null;
  /** Capacité de la séance : `null` = « Tous les membres », sinon un nombre de places limitées. */
  inscriptionMax: number | null;
  /** Inscriptions de la séance (une place seulement réservée n'est pas une participation). */
  inscriptions: { userId: string; status: InscriptionStatus }[];
  /** Membres actuels du groupe — lus seulement quand la conjonction accueille tous les membres. */
  memberIds: string[];
}

/**
 * Qui peut voter sur le sondage de dates d'une conjonction (Story 40.5) — l'UNIQUE définition, lue par
 * le refus d'un vote, par la projection des cartes (`eligibleVoterIds`) et, plus tard, par le rappel
 * et la fixation de la date :
 * - « Tous les membres » (`inscriptionMax` nul) : les membres du groupe, hôte compris ;
 * - places limitées : l'hôte + les inscrits CONFIRMÉS (jamais une place seulement réservée).
 * Dédoublonné, l'ordre d'apparition est conservé (l'hôte d'abord).
 */
export function eligibleVoters(input: EligibleVotersInput): string[] {
  const host = input.hostId ? [input.hostId] : [];
  const others =
    input.inscriptionMax === null
      ? input.memberIds
      : input.inscriptions.filter((i) => i.status !== 'RESERVED').map((i) => i.userId);
  return [...new Set([...host, ...others])];
}
