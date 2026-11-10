---
title: 'Story 44.1 — Ne montrer que les actions d''organisateur permises'
type: 'feature'
created: '2026-10-20'
status: 'done'
baseline_commit: '2d3f7b6713042d934c1b69520e29d33fc7e37ccf'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The UI decides organizer actions ("compose", "fix date", "extend vote") by comparing `hostId` to the current user, while the server decides via `PermissionService`. The two can diverge (e.g. a group admin who is not the host), so a button can lead to a 403.

**Approach:** Add `PermissionService.canMany` and an organizer-rights object `can = { propose, edit, choose, extend }` computed server-side, carried by `EventCardDto` and the JDR session DTO (`SeanceDto`). Group-calendar buttons read `can` instead of `hostId`. No JDR screen changes.

## Boundaries & Constraints

**Always:**
- `canMany` runs the same decision rules as `assert()` (role cell, host-only rules, capacity) through one shared pure function; targets are `{ seanceId }` or `{ eventId }` only, never `{ partieId }`.
- Fixed number of queries whatever the number of targets (batch reads; the four `can` flags share one resolution).
- The action→flag mapping lives in `permissions/` only: JDR `SEANCE_POLL_CREATE` / `POLL_OPTIONS_SET` / `POLL_CHOOSE` / `POLL_EXTEND`(denied); ralliement `EVENT_UPDATE{eventId}` / `EVENT_UPDATE{eventId}` / `POLL_CHOOSE{eventId}` / `POLL_EXTEND{eventId}`.
- `can` expresses rights only; state (poll open, date set, cancelled) stays a separate UI condition.
- Unknown target or non-member → all flags `false`, no throw, nothing revealed.
- French comments and error messages; characterization tests stay green; no dependency install; everything through Docker.

**Never:**
- No new route, no `/me/open-polls`, no UI change on any JDR screen (NFR1), no change to `canManageReservations`, `canEdit`, `canCancelEvent` (not in `can`).
- Never read `ownerId` / `hostId` in the UI to decide a poll right after this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Host of a group event | ralliement, viewer = `event.ownerId` | `can = {propose:true, edit:true, choose:true, extend:true}` | N/A |
| Admin, not host | ralliement, role admin, other host | all four `false` | N/A |
| Host account deleted | `ownerId` null | all four `false` | N/A |
| GM on a JDR seance | jdr, viewer is owner | `propose/edit/choose` true, `extend` false | N/A |
| JDR player | jdr, role player | all `false` | N/A |
| Not a member | any | all `false` | N/A |
| Unknown id | seance/event absent | `false` | no 404 from `canMany` |

</frozen-after-approval>

## Code Map

- `apps/api/src/permissions/permission.service.ts` -- `assert()` L456 holds the rules (`policyFor`, `HOST_ONLY_ACTIONS`, `HOST_ONLY_WHEN_EVENT_TARGETED`, `HOST_OR_ADMIN_ACTIONS`, `ACTION_CAPABILITY`); `resolveTarget()` L597; `rolesOf()` L519 is the batch-role precedent. Extract the rules into a pure decision function reused by `canMany`.
- `apps/api/src/permissions/permission.service.spec.ts`, `test/characterization/permissions.e2e-spec.ts`, `harness.ts` -- unit and e2e patterns for refusal tests.
- `packages/shared/src/index.ts` -- `SeanceDto` L631, `EventCardDto` L852: add `OrganizerCan` and `can`. Runtime values need normal `import`, not `import type`.
- `apps/api/src/events/events.service.ts` -- `listCards()` L492 builds `EventCardDto` (callers: `group-events.service.ts` L108/149/179/296/372); it takes a `PartieGrant`, has no `PermissionService`.
- `apps/api/src/scenarios/scenarios.service.ts` -- `toSeanceDto()` L1179, `loadSeancesBatch()` L1246, `toEnrichedDto()` L1278 (18 call sites, carry `grant.role` but no `userId`); atelier list at L288/L322.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts` -- `groupPollRows` L541 (`canCompose: card.hostId === me`), `startGroupCompose` L1454; `.html` L90. The MJ `canCompose` computed L1219 is JDR: leave it.
- `apps/web/src/app/features/events/event-card.util.ts` -- `canFixDate` L~672 and `canExtendVote` L~692 use `isHostOf`; `event-dialog.ts` L174-184 consumes them.
- Spec fixtures building `EventCardDto`/`SeanceDto` (api and web) need `can` added.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- add `OrganizerCan`, required `can` on `EventCardDto` and `SeanceDto` -- single contract
- [x] `apps/api/src/permissions/permission.service.ts` -- extract shared pure decision from `assert()`; add `canMany(userId, action, targets)` and an organizer-`can` method with the table above; fixed query count -- AR4
- [x] `apps/api/src/events/events.service.ts`, `group-events.service.ts` -- fill `can` on every card via the batch method (pass the viewer through `listCards`) -- one resolution per call
- [x] `apps/api/src/scenarios/scenarios.service.ts` -- thread `userId` to fill `can` on every `SeanceDto` (list and mutation responses) -- JDR payload only, no UI change
- [x] `apps/web/.../calendar-view.ts` and `event-card.util.ts` -- read `card.can.edit` / `can.choose` / `can.extend` instead of `hostId`; drop `canCompose` from `groupPollRows` -- no visible change for the host
- [x] Tests: `permission.service.spec.ts` (matrix above, query count constant for 1 vs N targets); an e2e test: for each family and action, `canMany === true` ⇔ the matching write is not 403, plus the existing `ownerId` non-read test stays green; web specs: admin non-host sees no compose/fix/extend button, host unchanged

**Acceptance Criteria:**
- Given a group where an admin is not the host, when the calendar loads, then no "compose", "fix date" or "extend" button is shown to that admin.
- Given the host, when the same page loads, then all three remain shown exactly as before.
- Given any JDR screen, when this story is delivered, then rendering is unchanged.

## Implementation Notes

- Implemented directly in this session (no subagent: the host session rules forbid spawning one without an explicit user request); the three review layers were replaced by one inline self-review of the diff.
- `PermissionService`: `assert()` now delegates to the pure `refusalFor()`; `canMany()` and `organizerCan()` reuse it. 3 batched reads at most (seances, events, memberships) whatever the number of targets. `PartieGrant` gained `userId` so `ScenariosService.enrich()` can ask for the viewer's rights without threading `userId` through the 17 `toEnrichedDto` call sites.
- `EventsService.listCards()` returns `EventCardBase` (no `can`); `GroupEventsService.cardOf()` / `withCan()` complete the card, so every card returned to the web carries the viewer's `can`.
- Web: `canFixDate(card)` and `canExtendVote(card)` lost their `userId` parameter; group compose button and `startGroupCompose` read `card.can.edit`. The host panel (`p.kind === 'host'`) in the event dialog still derives from `hostId` (display only, not a right): the buttons inside it follow `can`.
- Frozen characterization shapes updated for the added `can` key (SeanceDto, EventCardDto); list read by a non-host admin now expects `can` all false.
- New e2e `organizer-can.e2e-spec.ts` proves `can` ⇔ write not 403 against the real routes (group host / non-host admin / member, JDR GM / player).
- Known unrelated failures (date-dependent, pre-existing): api unit `getAvailableSlots … UNAVAILABLE` (1), web `calendar-week-view` and 2 `calendar-view` rail specs (3).

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Prettier run reformatted unrelated lines in web specs and sources | low | real noise in the diff; the 17 unrelated hunks were reverted (`git apply -R`), only story hunks remain |
| 2 | `canMany` could leak the existence of a target to a non-member | false | unknown target and no-role both return `false`, identical to a refused one; covered by the unit tests on unknown ids and strangers |
| 3 | Host panel in the event dialog still derives from `hostId` | false | display-only, not a right; the buttons inside it follow `can` (test added); changing the panel is outside 44.1 |
| 4 | `can` not refreshed in real time when ownership or role changes | false | cards are reloaded on the existing `partie:{id}` signal; no new channel needed |

## Design Notes

`assert()` and `canMany` must share one decision function (role cell → host rules → capacity) so the ⇔ test cannot drift. `canMany` returns a result aligned with the input targets; an organizer helper resolves targets once and evaluates the four actions on that resolution (4 actions must not mean 4× the queries).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error (ts-jest does not type-check cross-file)
- `docker compose exec api pnpm test` -- expected: all pass
- `docker compose exec api pnpm test:e2e` -- expected: all pass, characterization unchanged
- `docker compose exec web pnpm test` -- expected: all pass
