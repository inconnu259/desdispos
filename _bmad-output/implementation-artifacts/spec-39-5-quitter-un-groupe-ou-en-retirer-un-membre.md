---
title: '39.5 — Leave a group or remove a member'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: '913ba5383f35602ca0df25646c757e8a1ed9e029'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-39-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group member cannot leave a group, and the admin « Retirer » is an ad hoc delete that refuses the creator forever and owns none of the departure rules (owner cleared, last admin) that epics 40, 42 and 43 must extend (FR6, AD-17).

**Approach:** One procedure `PartiesService.leave(partieId, userId, cause)` becomes the only exit: voluntary departure (`DELETE /parties/:id/members/me`, « Quitter le groupe » in the footer) and admin removal (existing `DELETE /parties/:id/members/:userId`) both go through it, under the partie lock.

## Boundaries & Constraints

**Always:** `leave()` takes the `FOR UPDATE` lock (existing `lockPartie`), re-reads the roles, then: removes the `Membership`; sets `ownerId` to null if the leaver was the owner (ralliement only); if the leaver was the last `ADMIN` of a ralliement, deletes the partie — only when the caller confirmed it (`deleteIfLastAdmin`, same rule and 409 `LAST_ADMIN_MESSAGE` as 39.4), never silently. `cause` is a closed union, `{ type: 'LEFT'; deleteIfLastAdmin?: boolean } | { type: 'REMOVED'; byUserId: string }`, designed so epic 40 (sign-ups, votes), 42 (hosted events) and 43 (account deletion) add steps inside the same transaction with no new route; a comment names those extension points. Removal (`REMOVED`): the remover is re-checked `ADMIN` under the lock; the target must be a plain `MEMBER` (another admin or oneself → 409, French message); the creator is no longer protected once a plain member (the 39.3 creator refusal goes, owner rule now lives in `leave()`). Voluntary (`LEFT`): new action `PARTIE_LEAVE` (ralliement: admin and member; jdr: nobody, matrix + policy spec + e2e); the service refuses a `ONE_SHOT` (403 `RALLIEMENT_UNAVAILABLE_MESSAGE`); an admin may leave on the server (another admin remains → just leaves; last admin → 409 unless `?deleteIfLastAdmin=true`). Route `members/me` is declared before `members/:userId`. JDR: `removeMember` delegates to `leave()` whose JDR branch keeps today's exact behaviour (no lock, no owner change) — existing JDR tests pass unchanged. Realtime after commit only: `partieTopic`, `notifyPartieSignalsChanged` for the remaining members, `userTopic` of the leaver (their list drops the group); on deletion the shared `emitPartieDeleted`. Web: « Quitter le groupe » in the group footer for a plain member only (UX: members leave, admins step down first; footer placement as for « Quitter l'office »), confirmation « Quitter « *groupe* » ? Vous n'en ferez plus partie ; un administrateur devra vous inviter à nouveau pour revenir. » (button « Quitter le groupe »), **not** red (red is reserved to the irreversible, and a re-invitation brings the person back), then `refreshAll()` and back to `/`; refusal shown in the group notice. « Retirer » is offered on any plain member including the creator (role decides, not `ownerId`). New tone keys `partie.ralliement_leave_*` in three themes (rules as 39.4). French comments and messages.

**Never:** No sign-up/vote cleanup or event cancellation (epics 40/42, extension points only); no account deletion; no « Quitter le groupe » for admins in the UI; no change to JDR removal behaviour, wording or tests; no one-shot UI; no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member leaves | plain member, `DELETE members/me` | membership gone; group leaves their list; others' member list refreshes | stranger 403, JDR player 403, one-shot 403 |
| Creator (plain member) leaves | owner who stepped down | membership gone, `ownerId` null, group kept | — |
| Admin leaves, others remain | admin, another admin exists | membership gone, group kept | — |
| Last admin leaves | sole admin | without flag 409, nothing changes; with flag group deleted for all | — |
| Admin removes | plain member (creator included) | membership gone (`ownerId` null if creator) | member 403; target admin / self → 409; unknown 404 |
| JDR removal | MJ removes a player | unchanged behaviour | unchanged |

</frozen-after-approval>

## Code Map

- API `parties/parties.service.ts`: `removeMember` :451 (ralliement branch to fold into `leave()`, 39.3 creator refusal :458), `RALLIEMENT_REMOVE_PROTECTED_MESSAGE` :113, `LAST_ADMIN_MESSAGE` :125, `setMemberRole` :510 (lock/recount/flag pattern to mirror), `lockPartie` :584, `emitPartieDeleted` :592, `notifyPartieSignalsChanged`. `parties.controller.ts` (`DELETE :id/members/:userId` :68). `permissions/permission.service.ts` policies + spec matrix; `packages/shared/src/index.ts` `PermissionAction`.
- Web: `partie-detail/partie-detail.{ts,html}` (`canRemoveGroupMember` :249 drops the `ownerId` test, `stepDownFromOffice` :920 as the model, group footer `mat-card-actions` :550, group notice above it); `core/parties/parties.service.ts` (add `leave(id, deleteIfLastAdmin?)`); tones ×3 + `theme-tone.service.spec.ts`.
- Tests: `test/characterization/ralliement.e2e-spec.ts` (39.3 « refuse de retirer le créateur » :~858-880 becomes « créateur devenu membre retirable, ownerId vide »; new leave describe incl. concurrent last-admin departures); `parties.service.spec.ts` removeMember tests; `partie-detail.spec.ts` (« membre : aucune action au pied de carte » now has « Quitter le groupe »).
- Keep: 39.4 `setMemberRole`, JDR `removeMember` behaviour, `no-direct-owner-read.spec.ts` exception for `parties.service.ts` already covers the owner write.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts`, `permission.service.ts` (+ spec) -- `PARTIE_LEAVE` cell in both policies
- [x] `parties.service.ts`, `parties.controller.ts` (+ specs) -- `leave()` procedure, `/members/me`, `removeMember` delegating, owner cleared, last-admin rule
- [x] `ralliement.e2e-spec.ts` -- matrix rows, refusals, creator removal, concurrent departures
- [x] `partie-detail.{ts,html}`, web `parties.service.ts`, tones (+ specs) -- footer « Quitter le groupe », « Retirer » on the creator-member

**Acceptance Criteria:**
- Given a member who leaves, when it commits, then the group vanishes from their list and the others' member lists update without reload.
- Given two last admins leaving at once with confirmation, then the group is deleted exactly once and never left with zero admin.
- Given any JDR party, then removing a player behaves and tests exactly as before.

## Implementation Notes

- API: `PARTIE_LEAVE` (ralliement admin + member, jdr nobody); `LeaveCause` closed union; `leave()` asserts `PARTIE_MEMBER_REMOVE` (remover) or `PARTIE_LEAVE` (leaver); JDR branch = historical delete + same emissions, no lock; group branch under `lockPartie` with roles re-read, owner cleared by a conditional `updateMany` on `ownerId = userId`; extension points for epics 40/42/43 commented inside the transaction. `removeMember` delegates. `DELETE :id/members/me` (declared first, only `?deleteIfLastAdmin=true` confirms). The last-admin rule is one private helper `deleteGroupOfLastAdmin` shared with 39.4 `setMemberRole`.
- Web: `leave(id, deleteIfLastAdmin?)`; footer « Quitter le groupe » for a plain group member (non-red confirmation, then `refreshAll()` and `/`); « Retirer » decided by role only (creator-member removable). Keys `partie.ralliement_leave_{btn,confirm,error}` (forêt tutoie).
- Not done: no live browser check.
- Final run: api typecheck OK, unit 2313/2314 (1 known date failure), e2e 153/153; web 3279 pass / 2 known `calendar-view` date failures, build OK. Review: 20 findings, 5 patched, 2 deferred (+ manual check).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | gap | `partie:` emission of the deletion branch of `leave()` never asserted | medium | Removing the emit left every test green | patch (ordering assertion added) |
| 2 | gap, blind | Web `PartiesService.leave()` HTTP call untested | medium | Component tests stub the service | patch (two `HttpTestingController` cases) |
| 3 | edge, blind | Leaver's / removed member's page reloads on its own `partie:` event and gets 403 (unhandled), removed member stays on a dead page | medium | `parties.changed()` effect has no 403 path; removed-member case predates 39.5 | defer |
| 4 | edge | JDR MJ calling `members/me` gets « réservée au MJ » | low | API-only path, no UI; wording only | reject |
| 5 | edge, blind | Owner without a Membership row refused / not counted | false | Creation always inserts the creator's `ADMIN` row; unreachable (same as 39.4 row 6) | reject |
| 6 | edge | Claim « both exits under the lock » but JDR has no lock | false | The frozen intent says JDR keeps today's behaviour, no lock | reject |
| 7 | blind | 409 removal message advises « quittez le groupe » to admins who cannot | low | Only admins see it; trivial text edit | patch (hint removed) |
| 8 | blind | Multi-use invite link lets a removed member rejoin alone | medium | `leave()` keeps links; pre-existing since 39.3 | defer |
| 9 | blind | Retry after a lost response leaves the user stuck on a stale page | low | Rare; would add a branch | reject |
| 10 | blind | No busy guard: a second click sends a second DELETE | low | Modal dialog in between; rare | reject |
| 11 | blind | Last-admin deletion logic duplicated in `leave()` and `setMemberRole()` | medium | Two copies of a rule epics 43 will extend | patch (`deleteGroupOfLastAdmin` helper) |
| 12 | blind | Concurrency e2e tests not deterministic | low | Lock ordering also proven by unit tests | reject |
| 13 | blind | Route-order controller test fragile | low | e2e « un membre quitte » also catches it | reject |
| 14 | blind | Owner-cleared unit test asserts an internal call | low | Behaviour covered by e2e on a real DB | reject |
| 15 | blind | Epic context still says the footer placement is open | low | Doc line; trivial | patch (context updated) |
| 16 | blind | `ownerId` read before the lock reused for emissions | low | Worst case an extra `user:` event to a former owner | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the known date failure.
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures.

**Manual checks:** two accounts in a group: member leaves from the footer; admin removes the creator after they stepped down.
