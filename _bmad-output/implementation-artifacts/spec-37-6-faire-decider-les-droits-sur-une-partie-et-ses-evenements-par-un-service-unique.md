---
title: '37.6 — A single service decides rights on a partie and its events'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: '9f3e5112b6176c5dc27e061910cd296acc0254cd'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rights on a partie are decided in ~40 places (`getOwned`/`getViewable`, inline `ownerId === userId`, membership lookups, inline 403/404), each reading the owner its own way; ralliement (epic 38) needs other policies, which is impossible to add safely while rights are scattered (AD-6).

**Approach:** A transverse `permissions/` module (imports only Prisma and the shared registry) exposes `assert(userId, action, target)` → a grant `{ partieId, role }`, `roleOf(partieId, userId)`, `rolesOf(userId, partieIds)` (one query) and `membersOf(partie)`; it applies the `jdr` policy (owner alone organises/administers, members read and participate). `PartiesService`, `ScenariosService`, `EventsService` and `PollService` decide every right through it. Same outcomes as today for every route; 37.1 tests unchanged.

## Boundaries & Constraints

**Always:** `target = { partieId } | { eventId } | { seanceId }`; for event/seance targets the partie is resolved from the target, never taken from a route param. Unknown target → 404 with today's message (`Partie introuvable`, `Scénario introuvable`, `Séance introuvable`); refused → 403 with a French message (`Action réservée au MJ de la partie` for MJ-only actions, `Vous n'avez pas accès à cette partie` otherwise) instead of today's bare English "Forbidden" — the only intended observable change. `PermissionAction` is a closed `SCREAMING_SNAKE` union in `@master-jdr/shared` covering every existing action of these four modules (partie read/update/convert/close/reopen/delete/members/visibility/cover; scenario create/update/status/drafts/documents/participate; seance add/delete/reset/capacity/compte-rendu/practical-info/poll/inscribe/unsubscribe; poll read/vote/choose/options/close). Role values `'mj' | 'player'` (`'admin' | 'member'` declared for epic 38, unused); a null owner is never `'mj'`. Role-dependent projections (member emails, slot/heatmap detail, `PartieDto.role`) use `roleOf`, not `ownerId`. `EventsService` methods take the grant returned by `assert` instead of a bare `partieId`. `getOwned`/`getViewable` remain as thin delegates for 37.7 modules. Existing poll-belongs-to-partie and option-belongs-to-poll checks and their status codes (400 on vote, 404 elsewhere) are kept. Comments in French.

**Never:** No change to who may do what, to anti-spoil behaviour (members can still read drafts through the API — deferred), to routes or DTO shapes. No migration on 37.7 modules (characters, xp, homme-dragon, character-roles, announcements, invitations, availability, party-signals, account, game-systems, realtime) beyond compiling against the delegates. No `GET /parties` without role (37.7). No source-sweeping test (37.7). No dependency install, no DB migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| MJ-only action by member | player calls any MJ-only action | 403 `Action réservée au MJ de la partie` | no write |
| Any action by non-member | stranger, any action | 403 `Vous n'avez pas accès à cette partie` | — |
| Seance of another partie | `seanceId` of partie B by MJ of A | 403 (partie B resolved from the seance) | no IDOR |
| Unknown target | random uuid for partie/event/seance | 404 with today's message | — |
| Ownerless partie | `ownerId` null, member acts | member rights only; nobody is `mj` | — |
| Batch roles | `rolesOf(user, [A,B,C])` | `{A:'mj', B:'player'}`, C absent, one query | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts` -- `getOwned` L295-301, `getViewable` L304-313 (bare `ForbiddenException()`), `findOneDto` L323, `listMembers` L343/L357 (emails to MJ), `getAvailableSlots` L927-936/L1037, `getHeatmap` L1055-1064/L1103 (inline 404/403 + `isMj`), `resolveParticipants` L867-918 (owner + memberships, ordered `joinedAt, userId` — becomes `membersOf`), `toPartieDto` callers with hard-coded `'mj'` after `getOwned`. 13 `getOwned`/`getViewable` calls.
- `apps/api/src/scenarios/scenarios.service.ts` -- 22 calls (O×15, V×7); seance routes resolve partie via `resolveScenarioOrThrow(seance.eventId)`; `uploadDocument` L163-167 body `scenarioId` check (keep); `verifyScenarioBelongsToPartie` L857; `createSeancePoll` → `PollService.create` runs `getOwned` twice.
- `apps/api/src/poll/poll.service.ts` -- 7 calls; belongs checks L98-298 (keep). Controller path `parties/:id/poll`.
- `apps/api/src/events/events.service.ts` -- methods take caller-resolved `partieId` (doc L53-55); `assertCanAddEvent` L113.
- Module graph: `PartiesModule` imports `AvailabilityModule`, `EventsModule`; Poll ↔ Scenarios `forwardRef`; `AvailabilityModule` cannot import `PartiesModule` — `PermissionsModule` must import neither.
- Specs: `scenarios.service.spec` (~156 `getOwned`/`getViewable` mock setups), `poll.service.spec` (~17), `parties.service.spec` (real `getOwned`/`getViewable` via Prisma mocks L814-841), `events.service.spec`; `parties/partie-owner.integration.spec.ts` (null owner, real DB).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `PermissionAction` union, `PartieRole` type.
- [x] `apps/api/src/permissions/{permissions.module,permission.service}.ts` -- `assert`, `roleOf`, `rolesOf`, `membersOf`, jdr policy table (action → allowed roles); typed grant only it can build.
- [x] `apps/api/src/permissions/permission.service.spec.ts` -- one refusal test per action × role cell (`player`, non-member) of the jdr policy, plus 404s, ownerless partie, IDOR via seance/event of another partie, `rolesOf` single query.
- [x] `parties/`, `scenarios/`, `poll/` services (+ controllers if they pass ids) -- replace every right decision by `assert`/`roleOf`; `getOwned`/`getViewable` delegate; `resolveParticipants` uses `membersOf`.
- [x] `events/events.service.ts` -- accept the grant instead of a bare `partieId`.
- [x] Specs of these four modules -- mock `PermissionService` instead of `getOwned`/`getViewable`; no expectation change except French 403 messages.
- [x] `apps/api/test/characterization/permissions.e2e-spec.ts` (new) -- over HTTP: member refused on one MJ-only route per module (403 + message), stranger refused on a seance route, seance of another partie refused.

**Acceptance Criteria:**
- Given the four modules, when searching for `ownerId ===`/`!==`, `isMj =` or membership lookups deciding access, then none remain outside `permissions/` and DTO projections.
- Given the suites, then 37.1 characterization tests pass unchanged.

## Implementation Notes

- `PermissionAction`: closed union of 36 actions incl. generic `PARTIE_MANAGE` (owner only) used by the `getOwned` delegate for 37.7 modules; `PartieRole` = `'mj' | 'player' | 'admin' | 'member'`.
- `permissions/`: `assert` → branded `PartieGrant { partieId, role, partie }`; `JDR_POLICY: Record<PermissionAction, roles>` (exhaustive by type); ralliement and unknown systems fall back on the jdr policy until epic 38; `roleOf`, `rolesOf` (one query, `Map`), `membersOf` (replaces `resolveParticipants`, same order/dedup).
- Scenario routes assert `{ eventId }`, seance routes `{ seanceId }`, poll routes `{ partieId }` + existing poll/option checks (400/404 kept). `PollService.create(grant, …)` no longer double-checks.
- Observable change as specified: French 403 bodies — also reaching 37.7 modules through the `getOwned`/`getViewable` delegates (web shows `err.error.message`).
- Rights check now precedes the scenario/seance read: one extra read per seance/event route; a missing scenario row behind an existing event gives 403 to a stranger instead of 404 (JDR events always have a Scenario).
- Review patches: literal JDR policy table pinned (25 MJ-only, 11 member) and per-cell tests driven from it; e2e member refusals with no write on poll choose/options, practical info, close, plus member vote allowed, cross-partie scenario refusal, stranger leaves no inscription; `assert` action asserted in poll/scenarios specs; mutually exclusive `PermissionTarget`; grant carries `action` + resolved target and `EventsService` refuses (404) a seance/event outside `grant.partieId`; exhaustive `toDtoRole`; stale names fixed. Re-run: unit 1722/1724 (2 deferred date failures), e2e 34/34, typecheck OK, web build OK, lint 13 pre-existing errors.
- Orchestrator run: typecheck OK, unit 1720/1722 (2 deferred date failures), e2e 28/28, web build OK, lint 13 pre-existing errors.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap, blind, edge | Policy tests tautological (derived from `JDR_POLICY`, `arrayContaining` subset): flipping an MJ-only cell fails nothing | high | permission.service.spec L71-95; parties spec refusals use non-members only | patch |
| 2 | verif-gap | Action chosen per call site untested (choose, options, practical info, close); poll spec mocks `assert` without checking action | medium | No `'POLL_` in poll spec; no member e2e on these routes | patch |
| 3 | blind | `PermissionTarget` accepts mixed `{partieId, seanceId}`; route partie wins | medium | Non-discriminated union; `'partieId' in target` tested first | patch |
| 4 | blind, edge | Grant not tied to target/action; EventsService writes do not check ownership of the seance/event | medium | `deleteSeance(grantA, seanceB)` type-checks and writes B | patch |
| 5 | blind, edge | `toDtoRole` maps future roles to `player` silently | low | Non-exhaustive; direct switch | patch |
| 6 | blind, edge | Stale titles/comments citing `getOwned`/`getViewable`/`resolveParticipants` | low | Direct rename | patch |
| 7 | blind | E2E only refusals / only seance cross-partie | low | Covered by patch #2 additions | patch |
| 8 | blind, verif-gap | `roleOf`/`rolesOf` without production caller | low | Required by spec; `rolesOf` consumed by 37.7 (`GET /parties` all roles) | reject |
| 9 | blind | 403 bodies change in unmigrated modules via delegates | low | Intended: delegates are the spec's design; recorded in notes | reject |
| 10 | blind | Double read of seance/event per route | low | One extra indexed read; no visible effect | reject |
| 11 | blind | 403-before-404 on event targets | low | JDR events always have a Scenario; ralliement routes come with epic 38 | reject |
| 12 | blind | New PartiesService branches without unit tests | low | Behaviour same (caller is owner); null-owner paths unreachable | reject |
| 13 | edge | Poll `createdById` from a separate `userId` | low | Same user that obtained the grant in the same call | reject |
| 14 | edge | Brand forgeable by cast | low | Cast is explicit and reviewable; tests rely on it | reject |
| 15 | edge | `listForUser`/signals derive role from `ownerId` filters | low | `GET /parties` roles are 37.7's AC | reject |

## Design Notes

The grant type (e.g. a class with a private constructor or a branded type) makes "checked before writing" a compile-time fact for `EventsService`: no grant, no call. Poll routes keep target `{ partieId }` plus their existing poll/option ownership checks — the poll target type is not in AD-6.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures.
- `docker compose exec web pnpm build` -- expected: OK.
