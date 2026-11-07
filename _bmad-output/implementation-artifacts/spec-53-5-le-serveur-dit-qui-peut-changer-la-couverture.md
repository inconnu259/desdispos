---
title: '53.5 — The server says who can change the cover; upload goes through one unit'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'd9067b721df8ac3427ff63bb186edb1b0b7a158c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web cannot know whether the viewer may change the cover without guessing from the role, and the cover upload rules (type, size, double-send guard) live inside `partie-form` only, so the Détails banner of 53.6 would have to copy them.

**Approach:** `PartieDto` carries a server-computed `can.coverUpdate` (decided by the same function as `assert()`), and a single web unit `core/parties/cover-upload.ts` owns refusal rules, the `saving` guard and the two calls; `partie-form` goes through it with unchanged behavior.

## Boundaries & Constraints

**Always:** `PartieDto` gains `can: PartieCan`, `PartieCan = { coverUpdate: boolean }`, exported from `@master-jdr/shared` (consumers `import type`), always present like `role`, never inferred by the web from the role. `permissions/` exports a pure `partieCan(role, partie)` that decides through `refusalFor` for a party target (same decision as `assert()`, no database read); `toPartieDto` calls it, so every path returning a `PartieDto` carries the flag (`findOneDto`, `listForUser`, create, update, close, reopen, cover). `PUT` and `DELETE /parties/:id/cover` stay guarded by `assert(…, 'PARTIE_COVER_UPDATE', …)`; the server remains sole judge (`docs/security.md`). Values: JDR GM → true; player → false; group admin → true; plain group member → false; evening host (creator, `ADMIN`) → true; evening guest → false. `cover-upload.ts` exports `MAX_COVER_SIZE` and the accepted types (moved out of `partie-form.ts`), a function returning the refusal key (`partie.cover_reject_type`, `partie.cover_reject_size`) or `null`, a `saving` signal guarding double sends, `change(partieId, file)` and `remove(partieId)` calling `PartiesService.setCoverImage` / `removeCoverImage`, returning the updated party, doing nothing while a send is in flight and letting failures bubble. `partie-form` uses it: `coverSaving` becomes the unit's `saving`, no local refusal or double-click guard remains, the deferred send of the creation goes through it too; behavior unchanged (preview of the pending file on creation, `coverLocked` while the form sends, current error messages). Web `PartieDto` fixtures receive `can`. Run `docker compose exec api pnpm typecheck` (shared type changed).

**Never:** Expose the cover controls on the Détails banner (53.6). No new endpoint, no database read for `can`, no change to who may write. No raw string keys beyond the two refusal keys already in the tones.

## I/O & Edge-Case Matrix

| Viewer | Party | `can.coverUpdate` |
|---|---|---|
| GM | JDR | `true` |
| Player | JDR | `false` |
| Admin | group | `true` |
| Member | group | `false` |
| Host (creator, `ADMIN`) | evening | `true` |
| Guest | evening | `false` |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` (`PartieDto` l.576–611; `PartieRole` l.285) -- add `PartieCan` and `can` on `PartieDto`.
- `apps/api/src/permissions/permission.service.ts` -- `refusalFor` (l.532, takes `userId`, `action`, `role`, `partie`, `resolved`, `eventOwnerId`), cells `PARTIE_COVER_UPDATE` (JDR `OWNER_ONLY` l.173, ralliement `ADMIN_ONLY` l.288); export pure `partieCan(role, partie)` beside it (a party target needs no event owner).
- `apps/api/src/parties/parties.service.ts` -- `toPartieDto` (l.222) and its callers (l.327, 351, 463, 481, 494, 509, 1021, 1186, 1206, 1219, 1248, 1392, 1419) call `partieCan`; cover handlers (l.1320, 1397) keep `assert`.
- `apps/web/src/app/core/parties/cover-upload.ts` (new) + `.spec.ts`; `parties.service.ts` `setCoverImage` / `removeCoverImage` (l.118, 127) are the only HTTP calls.
- `apps/web/src/app/features/parties/partie-form/partie-form.ts` -- `ACCEPTED_COVER_MIMES` (l.48), `MAX_COVER_SIZE` (l.86), `coverSaving` (l.133), local refusal and guards (l.360–419), deferred send (l.496–499); `partie-form.html` for the "Changer" / "Retirer" chips.
- Web specs holding `PartieDto` literals (15 files, e.g. `partie-detail.spec.ts`, `dashboard.spec.ts`, `shell.spec.ts`) -- add `can`.

## Tasks & Acceptance

**Execution:**
- [x] `shared` + `permission.service.ts` + `parties.service.ts` -- `PartieCan`, `partieCan`, `toPartieDto` wiring
- [x] API tests -- `permission.service.spec.ts`: `partieCan` on the six cases and agreement with `assert` on the same cells; `parties.service.spec.ts`: `findOneDto` and `listForUser` carry `can.coverUpdate` by role; e2e `apps/api/test/characterization/partie-cover-permission.e2e-spec.ts`: `GET /parties/:id` flag true for GM and group admin, false for a player and a member, `PUT /parties/:id/cover` still 403 for a player
- [x] `cover-upload.ts` + spec -- type/size refusal with no network call, `saving` during a send, second call ignored, failure bubbles and frees `saving`
- [x] `partie-form.ts` + spec -- go through the unit; existing cover tests stay green; verify (Story 38.3) that editing a JDR party offers "Changer", and "Retirer" once a cover exists, restore a missing chip, note the result
- [x] Web `PartieDto` fixtures -- add `can`

**Acceptance Criteria:**
- Given the six viewer/party pairs, when `GET /parties/:id` or the list is read, then `can.coverUpdate` matches the table, and a player's `PUT /parties/:id/cover` is still 403
- Given a double click on "Changer", when the first send is in flight, then no second image is sent
- Given `docker compose exec api pnpm typecheck`, the API tests and the web suite, when run, then all pass (bar the two known date-frozen `calendar-view` tests)

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind | `can.coverUpdate` has no consumer in the web yet | false | By design: the Détails banner that reads it is Story 53.6. |
| 2 | blind, edge | `change()` returns `null` for "refused" or "busy" and the creation path treats `null` as success | low | Not reachable: on creation nothing is sent before `submit()` (the file waits in `pendingCoverFile`) so no send is in flight, and the file was already checked by the same rule when picked. Rejected. |
| 3 | blind, edge | `coverSaving` is now also true during the post-create upload (progress bar shows) | low | Small visible nuance, harmless: the form is already locked by `saving` then and navigation follows. Rejected. |
| 4 | blind, edge | `can` stale after a role change (realtime) | low | `can` is part of the party payload re-read when the party is refetched on `partie:{id}` (role changes already emit it); no display reads it before 53.6, which must verify the refresh. Rejected, carried to 53.6. |
| 5 | blind | `partieCan` passes `userId: ''` to `refusalFor` (invisible coupling) | low | No `PARTIE_COVER_UPDATE` cell reads `userId`; the unit test agrees with `assert()` on the cover cell. Rejected. |
| 6 | blind | `partieCan` tests weaker than their labels (host/guest rows equal group rows, `.catch(() => false)`) | low | Host and guest are roles `admin` / `member` in the decision; cosmetic test hygiene. Rejected. |
| 7 | blind | e2e does not assert a 2xx for the GM/admin | low | The existing cover e2e/unit tests cover the grant side; the new e2e pins the flag and the 403s. Rejected. |
| 8 | blind | `accept` list duplicated in templates, double `refusal()` entry points | low | Pre-existing duplication outside the story. Rejected. |
| 9 | blind | Formatting churn in `partie-form.spec.ts` and `parties.service.spec.ts` | low | Prettier output on touched files; no behavior. Rejected, mentioned in the presentation. |
| 10 | edge | Second pick during an upload is dropped silently | false | Same behavior as the previous local guard (`if (coverSaving()) return`). |
| 11 | gap | No verification gaps | — | Layer reported none. |

Verification: `api pnpm typecheck` clean; permission/parties unit specs 913 passed, 1 failed (the known date-frozen `parties` test); new e2e 6 of 6; web suite 4930 passed, 2 failed (the two known date-frozen `calendar-view` tests).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error
- `docker compose exec api pnpm test` and the characterization e2e -- expected: green (note the known date-frozen `parties` API test if it fails)
- `docker compose exec -T web pnpm exec ng test --watch=false` -- expected: green except the two known `calendar-view` tests
