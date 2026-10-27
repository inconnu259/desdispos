import type { Prisma } from '@prisma/client';

/**
 * Port de la couche 1 : la durée du rendez-vous qu'un vote de date propose (Story 47.4, AD-10).
 * Implémenté par `events/`, seul écrivain de `Seance.durationSlots` — `poll/` ne lit ni n'écrit jamais
 * la séance directement.
 */
export interface RendezVousDurationPort {
  /**
   * Dans la transaction de l'appelant, AVANT toute écriture du sondage : verrouille la partie puis
   * l'événement du rendez-vous porté par le vote `pollId` (`FOR UPDATE`, ordre de `updateHosted`), puis
   * écrit sa nouvelle durée. `durationSlots` absent = verrous seulement, `{ changed: false }`. Renvoie
   * `changed` (vrai seulement si la durée a réellement changé) : c'est la seule source de la purge des
   * options ; et la durée EFFECTIVE, relue sous les verrous (garde `FULL_DAY`, DTO servi). 404 si aucun
   * rendez-vous ne porte ce vote alors qu'une durée est donnée (un vote hérité sans séance vaut 1).
   * N'émet rien.
   */
  setDurationInTx(
    tx: Prisma.TransactionClient,
    pollId: string,
    durationSlots?: number,
  ): Promise<{ changed: boolean; durationSlots: number }>;

  /** Durée de chaque vote, par identifiant (une seule lecture). Un vote sans rendez-vous vaut 1. */
  durationsOf(pollIds: readonly string[]): Promise<Map<string, number>>;
}

/** Jeton d'injection de `RendezVousDurationPort`. */
export const RENDEZ_VOUS_DURATION_PORT = Symbol('RENDEZ_VOUS_DURATION_PORT');
