---
title: 'Ne plus rien apporter quand je ne viens plus (story 49.3)'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '3783d8911017b7822ead3face1719fffb5917f1c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-49-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 49.2, a person who stops attending an evening leaves their `EventGameBring` rows behind: hidden from the tab but still counted by the Ludothèque removal dialog, impossible to delete (403), and back on screen if they rejoin.

**Approach:** One helper in `events/` deletes a person's Brings, called inside the transaction of every path by which they cease to be a participant, so nobody counts on a game that will not come.

## Boundaries & Constraints

**Always:**
- `EventsService.releaseGameBringsInTx(tx, scope, userId): Promise<number>`, next to `releaseUpcomingInscriptionsInTx`, same style: find the Brings, lock the distinct `Event` rows sorted by id (`SELECT … FOR UPDATE`, the lock `EventGameBringService.write` takes, so no Bring slips in after the delete), then `deleteMany` with the same `where`, return the count. `scope` is `{ eventId }` (that event, no date filter) or `{ partieId, upcomingOnly: true }` (events of the partie whose seance passes `upcomingSeanceOr(todayStart)`, `todayStart = parseDayKey(todayKeyUtc())`). The helper emits nothing: each path's existing `partie:{id}` emission after commit already covers it. `EventGameBringService` stays the only writer of Brings from its own routes; this helper is the only other writer, inside `events/`.
- Paths, each deleting inside its own existing transaction, each with one test (unit on the transaction, plus e2e over HTTP):
  1. Unregistration and refusal of a reserved place — `desinscrireConjonction` (`DELETE scenarios/seances/:id/inscription`), event scope, right after the `inscription.deleteMany`; `lockedSeanceOfEvent` must also return the event id.
  2. Host withdraws a reservation — `retirerReservation` (`DELETE scenarios/seances/:id/reservations/:userId`), event scope; defensive (a `RESERVED` person cannot hold a Bring), tested by seeding a row directly.
  3. Leaving the group, removal by an admin, account deletion, and isolated-encounter membership departure — one call in `PartiesService.departGroupInTx`, after `releaseUpcomingInscriptionsInTx`, scope `{ partieId, upcomingOnly: true }` (deletes by `Event.partieId`, not through inscriptions, so isolated evenings are covered); evenings already past keep their rows.
  4. Declining an invitation — `InvitationsService.decline` touches no `Membership` and the invitee is no participant yet: a no-op by construction, pinned by a test that a decline changes no Brings.
- Promotions `RESERVED → CONFIRMED` (`inscrireConjonction`, `accepterReservation`) and event cancellation delete nothing (cancelled evenings are hidden by `eventIsOpen`). Another participant's Brings are never touched.
- Update the `listFor` and `broughtCount` doc comments that defer this cleanup. French comments and messages; no dependency install; Docker only; no schema change, no web change.

**Never:** No change to routes, DTOs, permissions or the 49.2 write checks; no emission from the helper; no deletion of Brings on past evenings for a departure; nothing on JDR parties (their paths stay as they are); identifiers `games/`, `ludotheque`, `apport` forbidden.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unregister | Zoé (confirmed) brought 2 games, withdraws | her 2 Brings gone, others' kept, `partie:` emitted as before | rollback leaves them |
| Leave group | Zoé brought to 2 upcoming evenings, leaves | Brings on both gone | past evening's row kept |
| Removed by admin | same, admin removes Zoé | gone | N/A |
| Account deleted | same, `DELETE /me` | gone (also by `User` cascade) | N/A |
| Isolated | member of a `ONE_SHOT` brought a game, admin removes them | gone, found via `Event.partieId` | N/A |
| Host withdraws reservation | seeded row for a `RESERVED` person | removed (defensive) | N/A |
| Decline invitation | pending invitee | no Bring changed | N/A |
| Promotion | `RESERVED` → `CONFIRMED` | Brings untouched | N/A |
| Failure | later step of the transaction throws | Brings still present | whole transaction rolls back |
| Rejoin | Zoé re-registers after withdrawing | no stale Bring reappears | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/events/events.service.ts` -- `releaseUpcomingInscriptionsInTx` ~:1748-1773 (model for the helper: find → lock sorted ids → `deleteMany`), `desinscrireConjonction` ~:1630-1647 (tx at :1636, `deleteMany` :1640), `lockedSeanceOfEvent` ~:2011-2041 (add `eventId` to the return), `retirerReservation` ~:1699-1715, `inscrireConjonction` ~:1587, `accepterReservation` ~:1723; `events/seance-span.ts` (`upcomingSeanceOr` :62, `isSeancePast` :49).
- `apps/api/src/parties/parties.service.ts` -- `departGroupInTx` ~:614-692 (`releaseUpcomingInscriptionsInTx` call ~:669; last-admin branch cascades by FK), `leave` :575, `eraseMembershipsInTx` :726; `account/account.service.ts` ~:60.
- `apps/api/src/invitations/invitations.service.ts` -- `decline` :191 (no transaction, no membership; no change).
- `apps/api/src/events/event-game-bring.service.ts` -- doc comments of `listFor` and `broughtCount` mention 49.3.
- Tests: `events.service.spec.ts` `releaseUpcomingInscriptionsInTx()` describe ~:2111 (add `eventGameBring` to the `prisma.tx` mock ~:47; lock-then-delete order via `$queryRaw`), `parties.service.spec.ts` `leave()` ~:1669 (`events` mock gets `releaseGameBringsInTx`; call order and rollback), `account.service.spec.ts`; e2e `board-games.e2e-spec.ts` 49.2 describe ~:830 (`setup`, `bringUrl`, `propose`, `signUp`, `bringCount`, past-day trick), `ralliement.e2e-spec.ts` (`leave` ~:1164, removal ~:868, reserve/withdraw ~:2322, isolated + invitations ~:55/:924), `account-deletion.e2e-spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/events/events.service.ts` -- `releaseGameBringsInTx`; calls in `desinscrireConjonction` (+ event id from `lockedSeanceOfEvent`) and `retirerReservation`.
- [x] `apps/api/src/parties/parties.service.ts` -- call in `departGroupInTx`.
- [x] `apps/api/src/events/event-game-bring.service.ts` -- doc comments.
- [x] `apps/api/src/events/events.service.spec.ts`, `parties.service.spec.ts`, `account.service.spec.ts` -- helper (lock order, scope `where`, no emit), call order and rollback per path.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` (and `account-deletion.e2e-spec.ts`) -- one test per path of the matrix, including past-evening row kept, promotion untouched, rejoin, other participants' Brings untouched, `partie:` emission unchanged.

**Acceptance Criteria:**
- Given Brings on an upcoming evening, when the bringer unregisters, leaves or is removed from the group, deletes their account, or is removed from an isolated evening, then none of their Brings remain on the affected evenings.
- Given an evening already past, when the bringer leaves the group, then that evening's rows are kept.
- Given the Ludothèque removal dialog, when a bringer has left an evening, then that evening no longer counts in « apporté à n soirée(s) ».
- Given any path above fails after the helper ran, then the whole transaction rolls back and the Brings are still there.

## Implementation Notes

- `retirerReservation` calls the helper only when a `RESERVED` row was actually deleted (so withdrawing a reservation never removes a confirmed person's Brings); `desinscrireConjonction` calls it unconditionally after its `deleteMany` (a non-participant holds none, and it clears older orphans).
- No test was added to `account.service.spec.ts` or `account-deletion.e2e-spec.ts`: `AccountService` mocks `PartiesService` entirely, and the `User` cascade would delete the rows anyway. Account erasure is pinned by the `eraseMembershipsInTx` unit test (helper called with `{ partieId, upcomingOnly: true }`) and a `DELETE /me` e2e in `board-games.e2e-spec.ts` that checks the end state.
- Rollback is unit-tested (the delete throws, the membership is not deleted, nothing is emitted); there is no HTTP-level rollback test.

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge | event scope, several seances | Unregistering from one seance deletes the person's Brings on the whole Event | low | An event holds one seance today (49.1 triage #5) and `participantsOf` is defined on that seance. Rejected | reject |
| 2 | blind, edge | `desinscrireConjonction` vs `retirerReservation` | Release is unconditional in the first, guarded by `count > 0` in the second | low | Intended: a person who is no participant holds no Brings, so the unconditional call is a no-op and also clears pre-49.3 orphans on that event; the reservation path deletes only `RESERVED` rows and must not touch a confirmed person's. Rejected | reject |
| 3 | blind | event lock | Redundant second `FOR UPDATE` on the single-event path | low | One cheap statement, same lock held; skipping it adds a flag. Rejected | reject |
| 4 | blind | old rows | Orphans left by 49.2 are not purged; `broughtCount` comment only true for new rows | low | 49.2 is not deployed (dev data only); the unconditional call on unregister clears them case by case. Rejected | reject |
| 5 | blind | `parties.service.spec` | « triés » not asserted on the leave path | low | The sorted-lock assertion exists in `events.service.spec`; same helper. Rejected | reject |
| 6 | blind | `upcomingOnly` vs `broughtCount` | Purge also removes Brings of cancelled/closed future evenings | low | Deliberately broader: a departing person keeps nothing on upcoming evenings; those evenings are hidden anyway. Rejected | reject |
| 7 | blind | specs | « Today » computed by the test and the service separately | low | Same pattern as the existing `releaseUpcomingInscriptionsInTx` spec; fails only across 00:00 UTC. Rejected | reject |
| 8 | blind | API shape | `upcomingOnly: true` literal; returned count unused | low | Style only; the count serves the unit tests. Rejected | reject |
| 9 | blind, edge | tests | No concurrency or real rollback test; weak decline test; no host-leaves e2e | low | Rollback and lock order are unit-pinned in the repo's style; a host leaving cancels its evenings (42.x) and cannot bring. Rejected | reject |
| 10 | edge | `findMany` before lock | A Bring written concurrently with a departure can survive (no rows found, no lock) | low | Needs a bring and a membership removal in the same instant on an isolated evening; the orphan is hidden by `listFor` and cleared if the person returns. Fix adds a pre-lock query. Rejected | reject |
| 11 | edge, blind | lock set | `deleteMany` could match unlocked events; two sorted lock batches in `departGroupInTx` | low | Other writers hold a single `Event` lock, so no cycle exists; the delete re-uses the locked `where`. Rejected | reject |
| 12 | edge | seance-less event, part-past event | `seances: { some }` misses an event with no seance and purges a part-past one | low | Every event has exactly one seance. Rejected | reject |
| 13 | edge, vgap | tasks / account | Account service spec and account-deletion e2e not touched though listed; account e2e cannot detect the call (`User` cascade) | low | `AccountService` mocks `PartiesService` entirely; the call is pinned by the `eraseMembershipsInTx` unit test. Recorded in Implementation Notes. Rejected | reject |
| 14 | edge | e2e | `toHaveBeenCalledWith` does not catch an extra emission | low | The unit test asserts the exact emission count on the unregister path. Rejected | reject |

## Design Notes

Putting the helper in `EventsService` (not `EventGameBringService`) keeps `PartiesService`'s existing `EventsService` dependency; no new injection, and the module direction stays `events/ → board-games/`.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test` only if a web file changes (none expected) -- known: 3 date-dependent calendar tests; never two pnpm commands in parallel.
