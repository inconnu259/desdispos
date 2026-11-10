---
title: '42.5 — Remove a finished or cancelled party from my list'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: '58a9a580393a6150998ea4d5cdc107856dcc3d6c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-42-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-42-4-filtrer-et-masquer-les-parties-annulees.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A user cannot tidy their home list: finished or cancelled parties, JDR included, stay forever (FR17).

**Approach:** A per-user, permanent "remove from my list" on a TERMINEE or ANNULEE party. A new `PartieHidden(userId, partieId)` table, written by `PUT /parties/:id/hidden`; the server excludes hidden parties from the user's list, signals and personal calendar, with no way to bring them back except reopening a closed party. Entry point (decided with the user): a button on the list tile, next to the favourite star, in the three display modes.

## Boundaries & Constraints

**Always:** Migration adds `PartieHidden` (unique `[userId, partieId]`, cascade on both sides, `createdAt`). `PUT /parties/:id/hidden`, no body, idempotent, acts only for the caller: right = `PARTIE_READ` (any role on the party; stranger 403, unknown 404); refused 400 French unless the party's derived status is TERMINEE or ANNULEE (computed by the unique status function, never by the client). Route handled by `PartiesService.hide`; emits `user:{caller}` after the write. Exclusion, in the server only: `PartiesService.listForUser` (all three branches: no role, `mj`, `player`; `PartySignalsService` reads through it, so signals follow), and `ownEventsOf` (personal calendar and everything derived from its parties). Direct reads by id (`GET /parties/:id`) are left untouched. `PartiesService.reopen` deletes every `PartieHidden` row of the party (all users). An ANNULEE party cannot be reopened, so its hide is final. Web: icon button on the tile (large, medium, compact row), shown only when `status` is TERMINEE or ANNULEE, with an accessible name « Retirer de ma liste »; click opens the existing red-free `ConfirmDialog` with the fixed text « Retirer « *nom* » de votre liste ? Elle disparaîtra définitivement pour vous seul ; les autres participants la conservent. » and button « Retirer » (UX-DR12 n° 4); on yes the web service calls the route and the list reloads (`MyPartiesService.refreshAll`); a refusal keeps the tile. Texts: the sentence and « Retirer » identical in the three themes (contract), the button's accessible name from the tone files. Real-time: other tabs of the user refresh through `user:{id}` (already wired on the home list). French comments/errors; nothing installed; Docker only (`pnpm exec prisma` in the container).

**Never:** No un-hide route or parameter, no hiding of a party in progress or upcoming, no change to what other participants see, no entry point on the party page, no change to 42.4 filters or to the `hideFinishedParties` preference, no direct-read exclusion by id.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hide finished | member of a TERMINEE party | row written, party leaves list, signals, calendar for them only | — |
| Hide cancelled | member of an ANNULEE evening | same | — |
| Again | already hidden | no change | 200 |
| Not over | A_VENIR or EN_COURS | refused | 400 |
| Stranger / unknown | no role / bad id | refused | 403 / 404 |
| Others | another participant | still sees the party | — |
| Reopen | closed party reopened | all hides deleted, party back in every list | — |
| JDR | finished quest, MJ or player | can hide | — |
| Direct read | `GET /parties/:id` of a hidden party | still served | — |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` :120 `PartieFavorite` (pattern; add `PartieHidden`, relations on `User` and `Partie`); new migration after `20261019120000_event_cancelled_at`.
- `apps/api/src/parties/parties.service.ts` -- `listForUser` :447, `favoritePartieIds` :422 (batch pattern), `reopen`, `progressOf`/`toPartieDto` (status); new `hide`; `parties.controller.ts` route; `account/account.controller.ts` `PUT favorites/:partieId` for the idempotent PUT style.
- `apps/api/src/events/events.service.ts` -- `ownEventsOf` :2009 (`partie.findMany` where owner or member).
- `apps/web/src/app/core/parties/parties.service.ts` (HTTP), `core/parties/my-parties.service.ts` (`refreshAll`), `features/dashboard/{dashboard.ts,dashboard.html,dashboard.scss}` (favourite button in 3 templates, `toggleFavorite` pattern), `features/parties/confirm-dialog/confirm-dialog.ts`, tone files + `theme-tone.service.spec.ts`.
- Tests: `parties.service.spec.ts`, `events.service.spec.ts`, controller spec if any, `ralliement.e2e-spec.ts` (or a new e2e file), `dashboard.spec.ts`, web `parties.service.spec.ts`.
- Do NOT touch: `PartiesService.findOneDto`, permission cells, `PartyBanner`, filters.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api` prisma + parties -- `PartieHidden` migration, `hide`, route, list exclusion, `reopen` cleanup (+ specs)
- [x] `apps/api` events -- `ownEventsOf` excludes hidden parties (+ spec)
- [x] `apps/api/test` -- e2e: hide finished/cancelled/JDR, refusals, per-user scope, list/signals/calendar exclusion, reopen restores, idempotence
- [x] `apps/web` core + dashboard + tones -- service call, tile button in the 3 modes, confirmation, refresh (+ specs, ng build)

**Acceptance Criteria:**
- Given a finished or cancelled party, when a participant confirms « Retirer », then it disappears from their list, signals and personal calendar for good while the others keep it.
- Given a party that is upcoming or in progress, then the server refuses (400) and the tile offers no button.
- Given a closed party that is reopened, then every user's hide of it is gone.

## Implementation Notes

- Implemented directly in the session (no implementation or review subagents: this run only allows them on an explicit user request). Entry point chosen with the user: the list tile.
- Server: model `PartieHidden` + migration `20261019130000_partie_hidden` (applied with `migrate deploy`, client regenerated); `PartiesService.hide` (`PARTIE_READ` right, status from the unique function, 400 unless TERMINEE/ANNULEE, `createMany` with `skipDuplicates`, `user:{id}` emitted) behind `PUT /parties/:id/hidden`; `listForUser` (three branches) and `EventsService.ownEventsOf` filter on `hiddenBy: { none: { userId } }`, so `PartySignalsService` and every calendar layer follow; `reopen` deletes the party's hides for all users. `GET /parties/:id` still serves a hidden party.
- Web: `PartiesService.hide`, `MyPartiesService.hide` (PUT then `refreshAll`), a discreet eye-off button next to the favourite star on the card and the compact row (`canHide`: TERMINEE or ANNULEE), `ConfirmDialog` (non-destructive, « Retirer ») loaded lazily by dynamic import: importing `MatDialog`/`ConfirmDialog` statically pushed the initial bundle 22 kB over its 1 MB error budget. Texts: aria name and button identical in the 3 themes; the confirmation sentence keeps its words, the forest theme tutoies it (« ta liste », « toi seul »), as every other confirmation of that theme.
- Results: API typecheck clean; unit tests green apart from the known date failure (`parties.service.spec` AD-9); full e2e 353 green (7 new); web suite green apart from the 2 known date failures; `ng build` compiles (initial 935 kB, under the 1 MB error line).
- Not done: visual check in Chrome (button in the three modes and themes, reload, reopen as MJ); `/security-review` and `/code-review` to run (new per-user write route and server-side exclusion).

## Spec Change Log

## Review Triage Log

Inline review (no reviewer subagents in this run).

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | A hidden party is still reachable by id and by its routes | low | Specified (« Never »: no direct-read exclusion); the list, signals and calendar are the user's reads | reject |
| 2 | edge | A closed party hidden by a user, then reopened, returns for every user | false | Intended by the story: reopening deletes all hides | reject |
| 3 | edge | `occupiedSpansOf` (unavailabilities) still counts a hidden finished evening dated in the future | low | A hidden party is finished or cancelled; cancelled ones are already excluded, a closed future evening is rare and the spec limits the exclusion to list, signals and personal calendar | reject |
| 4 | edge | Concurrent double hide could raise a unique violation | false | `createMany` with `skipDuplicates` is a single `ON CONFLICT DO NOTHING` statement; e2e idempotence passes | reject |
| 5 | blind | No user feedback when the server refuses a hide | low | The tile stays; the button is only offered on TERMINEE/ANNULEE, so a refusal means a stale list, fixed by the next refresh | reject |
| 6 | edge | Another user's hide row could be written | false | The row takes `userId` from the session only; the route has no user parameter | reject |

## Design Notes

Hiding is a separate table (not a flag on `Membership`): an owner has no membership row and the table must also serve parties where the user is only owner. Exclusion lives in the two server readers that define "my parties" so every derived read (signals, calendar layers) follows without a parameter.

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` then `generate`; `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green apart from the known date failure
- `docker compose exec web pnpm exec ng test --no-watch` -- green apart from the 2 known date failures; `ng build` compiles
- `graphify update .`

**Manual checks (if no CLI):**
- Chrome MCP: hide a finished and a cancelled party from the tile in the three modes; reload; reopen as MJ.
