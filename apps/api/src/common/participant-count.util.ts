/**
 * Story 36.6 — l'effectif d'une partie, défini UNE SEULE FOIS.
 *
 * **La règle : effectif = le MJ + ses `Membership`.**
 *
 * Deux définitions incompatibles coexistaient dans le code avant cette story :
 * - `resolveParticipants()` (`parties.service.ts`, devenu `PermissionService.membersOf()` en
 *   Story 37.6) construit `[mjUser, ...memberships]` et alimente `AggregatedSlotDto.total` —
 *   **avec** le MJ ;
 * - `listMembers()` / `GET /parties/:id/members` renvoie les seuls `Membership` — **sans** le MJ,
 *   « le MJ n'étant jamais un `Membership` ».
 *
 * Or le MJ **peut voter** : `PollService.castVote()` est ouvert au MJ comme aux membres
 * (`POLL_VOTE`). Compter la troupe sans lui rendait « 5 / 4 » possible, et faisait afficher
 * deux dénominateurs différents sur la même case (la piste de participation et la jauge de
 * disponibilité du groupe). **Tranché le 2026-08-20 : le MJ compte.**
 *
 * ⚠️ Pourquoi une fonction PURE plutôt qu'une méthode de service : `AvailabilityService` en a
 * besoin (`GET /me/calendar`) et **ne peut pas injecter `PartiesService`** — `AvailabilityModule`
 * exporte `AvailabilityService` et est consommé PAR `PartiesModule`, l'inverse créerait un cycle
 * de modules Nest. Une fonction sans DI traverse la frontière sans la casser, et garantit qu'il
 * n'existe qu'une formule. Story 37.8 : le fichier vit désormais dans `common/` — `availability/` et
 * `poll/` (couche 1) ne doivent importer ni `parties/` ni aucune couche supérieure.
 *
 * @param membershipCount nombre de lignes `Membership` de la partie (le MJ n'en a jamais).
 */
export function participantCount(membershipCount: number): number {
  return membershipCount + 1;
}

/** Le client Prisma tel que `countParticipants` l'emploie — typé structurellement, jamais par
 *  injection : c'est ce qui lui permet de traverser la frontière de module (cf. ci-dessus). */
interface MembershipCounter {
  membership: { count(args: { where: { partieId: string } }): Promise<number> };
}

/**
 * Le comptage complet pour UNE partie, à l'usage de tout service disposant d'un client Prisma
 * (`PollService`, `ScenariosService`).
 *
 * ⚠️ **Réservé au cas « une partie ».** Ne jamais l'appeler en boucle sur N parties : AD-3
 * proscrit le fan-out par partie. Le calendrier personnel (`AvailabilityService.getMyCalendar`)
 * fait un `membership.groupBy` unique et applique `participantCount()` lui-même.
 */
export async function countParticipants(
  prisma: MembershipCounter,
  partieId: string,
): Promise<number> {
  return participantCount(await prisma.membership.count({ where: { partieId } }));
}
