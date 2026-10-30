import type { InscriptionStatus } from '@master-jdr/shared';

/** Ce qu'il faut savoir d'une soirée à venir pour dire qui y participe (épic 49). */
export interface ParticipantsOfInput {
  /** `true` : rencontre isolée (`ONE_SHOT` de la famille ralliement) ; `false` : conjonction d'un groupe. */
  isolated: boolean;
  /** Hôte de l'événement (`null` si son compte a disparu). */
  hostId: string | null;
  /** Inscriptions de la séance — lues seulement pour une conjonction de groupe. */
  inscriptions: { userId: string; status: InscriptionStatus }[];
  /** Membres de la partie — lus seulement pour une rencontre isolée. */
  memberIds: string[];
}

/**
 * Qui participe à une soirée (épic 49, Story 49.1) — l'UNIQUE définition de N, à côté d'`eligibleVoters`
 * dont elle diffère exprès : c'est l'effectif à table, pas l'ensemble des votants.
 * - conjonction de groupe : l'hôte + les inscrits CONFIRMÉS (jamais une place seulement réservée), même
 *   quand la conjonction accueille « tous les membres » ;
 * - rencontre isolée : les membres de la partie (l'hôte en est un, créateur `ADMIN`).
 * Dédoublonné, l'ordre d'apparition est conservé (l'hôte d'abord pour un groupe).
 */
export function participantsOf(input: ParticipantsOfInput): string[] {
  if (input.isolated) return [...new Set(input.memberIds)];
  const host = input.hostId ? [input.hostId] : [];
  const confirmed = input.inscriptions.filter((i) => i.status !== 'RESERVED').map((i) => i.userId);
  return [...new Set([...host, ...confirmed])];
}
