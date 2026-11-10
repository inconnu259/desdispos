import type { Prisma } from '@prisma/client';
import type { PartieKind, PartieRole, ScenarioStatus } from '@master-jdr/shared';

/**
 * Anti-spoil côté serveur (PRD FR-5/FR-6) : DÉFINITION UNIQUE de ce qu'un joueur n'a pas le droit
 * de voir d'un scénario. Le MJ voit tout, sans exception ; la règle s'applique à tout autre rôle
 * (cf. `isSpoilRestricted`, qui échoue fermé).
 *
 * Vocabulaire :
 * - **brouillon caché** : scénario `BROUILLON` d'une partie qui n'est PAS un `ONE_SHOT`. Pour un
 *   joueur il n'existe pas — ni lui, ni ses séances, votes, documents, annonces, dates.
 * - **contenu masqué** : scénario `A_VENIR`, ou brouillon de `ONE_SHOT` (exemption : son scénario
 *   unique reste listé et ses séances/dates/votes restent utilisables, mais son contenu — description,
 *   durées, compte rendu, documents, annonces ciblées — est masqué comme celui d'un `A_VENIR`).
 * - **scénario diffusé** : `COURANT` ou `PASSE` — seul état où les documents ciblés et les annonces
 *   ciblées sont servis aux joueurs.
 *
 * Les services reçoivent le rôle de `PermissionService.assert()` et passent par ces helpers : un
 * nouveau chemin de lecture n'a qu'une chose à réutiliser, jamais une règle à recopier. Fichier
 * transverse : il n'importe que des types.
 */

/** Statuts d'un scénario dont le contenu ciblé (documents, annonces) est servi aux joueurs. */
export const RELEASED_STATUSES: readonly ScenarioStatus[] = ['COURANT', 'PASSE'];

/** Seul le MJ voit tout. */
export function isGameMaster(role: PartieRole | null | undefined): boolean {
  return role === 'mj';
}

/**
 * Les règles anti-spoil s'appliquent à TOUT rôle qui n'est pas exactement `mj` (joueur, mais aussi
 * rôle inconnu, absent ou futur) : elles échouent FERMÉES — jamais ouvertes — pour qu'un rôle
 * inattendu ne voie pas ce qu'un joueur ne voit pas.
 */
export function isSpoilRestricted(role: PartieRole | null | undefined): boolean {
  return !isGameMaster(role);
}

/** Un scénario brouillon d'une partie non `ONE_SHOT` est invisible des joueurs. */
export function isHiddenDraft(status: ScenarioStatus, kind: PartieKind): boolean {
  return status === 'BROUILLON' && kind !== 'ONE_SHOT';
}

/** Le contenu du scénario (description, durées, compte rendu) est masqué aux joueurs : `A_VENIR`,
 *  ou brouillon d'un `ONE_SHOT` (exemption : le scénario reste listé, son contenu non). */
export function isContentMasked(status: ScenarioStatus, kind: PartieKind): boolean {
  return status === 'A_VENIR' || (status === 'BROUILLON' && kind === 'ONE_SHOT');
}

/** Scénario dont les documents ciblés et les annonces ciblées sont servis aux joueurs. */
export function isReleased(status: ScenarioStatus): boolean {
  return RELEASED_STATUSES.includes(status);
}

/** Un joueur ne doit jamais voir le contenu de ce scénario : brouillon caché OU contenu masqué.
 *  Garde-fou des projections DTO — un brouillon caché est filtré bien avant d'y arriver. */
export function isRedactedForPlayer(status: ScenarioStatus, kind: PartieKind): boolean {
  return isHiddenDraft(status, kind) || isContentMasked(status, kind);
}

// ─── Fragments Prisma réutilisables ────────────────────────────────────────────────────────────

/** Scénario brouillon caché (à utiliser sur un `ScenarioWhereInput`). */
export const HIDDEN_DRAFT_SCENARIO_WHERE: Prisma.ScenarioWhereInput = {
  status: 'BROUILLON',
  event: { partie: { kind: { not: 'ONE_SHOT' } } },
};

/** Scénario visible d'un joueur dans une liste : tout sauf un brouillon caché. */
export const VISIBLE_SCENARIO_WHERE: Prisma.ScenarioWhereInput = {
  NOT: HIDDEN_DRAFT_SCENARIO_WHERE,
};

/** Séance d'un brouillon caché (`SeanceWhereInput`). */
export const HIDDEN_DRAFT_SEANCE_WHERE: Prisma.SeanceWhereInput = {
  event: { scenario: { is: HIDDEN_DRAFT_SCENARIO_WHERE } },
};

/** Séance visible d'un joueur : tout sauf celle d'un brouillon caché. */
export const VISIBLE_SEANCE_WHERE: Prisma.SeanceWhereInput = {
  NOT: HIDDEN_DRAFT_SEANCE_WHERE,
};

/** Vote de date rattaché à la séance d'un brouillon caché (`SessionPollWhereInput`). */
export const HIDDEN_DRAFT_POLL_WHERE: Prisma.SessionPollWhereInput = {
  seance: { is: HIDDEN_DRAFT_SEANCE_WHERE },
};

/** Vote de date visible d'un joueur : tout sauf celui d'un brouillon caché. */
export const VISIBLE_POLL_WHERE: Prisma.SessionPollWhereInput = {
  NOT: HIDDEN_DRAFT_POLL_WHERE,
};

/** Annonce visible d'un joueur : de toute la partie (`scenarioId` nul), ou ciblée sur un scénario
 *  diffusé (`COURANT`/`PASSE`). */
export const RELEASED_ANNOUNCEMENT_WHERE: Prisma.AnnouncementWhereInput = {
  OR: [{ scenarioId: null }, { scenario: { is: { status: { in: [...RELEASED_STATUSES] } } } }],
};
