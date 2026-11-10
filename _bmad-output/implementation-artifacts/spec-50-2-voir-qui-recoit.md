---
title: 'Voir qui reçoit (story 50.2)'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '34e9aac5e1bca8169230dc863df1a3b213c9ec32'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-50-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group cannot tell whether the same person always hosts; the host of each conjunction is only visible card by card.

**Approach:** Add `GET /parties/:id/host-counts` (module `events/`, `PARTIE_READ`, group only) deriving, per current member, how many past, non-cancelled conjunctions they hosted, and a collapsible « Qui ouvre sa porte / Qui accueille le cercle / Qui accueille l'équipage » section (`HostBars`) at the top of the group's « Détails » tab.

## Boundaries & Constraints

**Always:**
- Group only (`isRalliementGroup`): an isolated encounter or a JDR party answers 403 `RALLIEMENT_UNAVAILABLE_MESSAGE`; a non-member gets `PARTIE_READ`'s refusal. Nothing is stored: derived on read.
- Count = events of that partie, `cancelledAt` null, whose first séance (same pick as `listCards`) is past by `isSeancePast` — the shared « passée » rule, never reimplemented; an undated event is never past; the host is `Event.ownerId` (read in `EventsService`, the Event writer — no `ownerId` mention in a new file: `no-direct-owner-read.spec.ts`). Events of someone who left the group, or with no host, are attributed to nobody.
- Response `HostCountsDto { members: { userId, pseudo, displayName, count }[] }`: every current member (0 included), by `count` desc then `displayName`, `pseudo`, `userId`; explicit mapper, never an e-mail.
- ⚠️ Section shown to every group member at the top of « Détails » (above the description), `<details open>` with a 44 px summary naming the themed title; `HostBars`: one row per member with `count > 0` — name, 6 px bar `accent-2` (largest count = 120 px, others proportional), « {n} fois » right-aligned; then « Jamais : {noms} » (`text-muted`) for count 0. Text carries every figure; the bar is decorative. No ranking, medal, highlight, red or new token.
- Reloads on `PartiesService.changed()` (cancellation, departure already emit `partie:{id}`); older reads ignored; a failure shows the neutral `board_games.error_fallback`.
- Theme key `host_counts.title` in the three tone files (EXPERIENCE §3.1); « {n} fois » and « Jamais : {noms} » neutral in `NEUTRAL_KEYS` with a `// Story 50.2 : …` reason. French comments and messages; no dependency install; Docker only.

**Never:** Nothing on JDR parties or isolated encounters; no column, table or migration; no new `PermissionAction`; no change to the existing « Détails » blocks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Counted | past, uncancelled event hosted by a member | member's `count` +1 | N/A |
| Cancelled / future / undated | event cancelled, or today or later, or no date | not counted | N/A |
| Former member | host left the group | absent; their events counted for nobody | N/A |
| Never hosted | member with no event | `count: 0`, listed in « Jamais » | N/A |
| Order | counts 3, 1, 1, 0 | desc, ties by `displayName` | N/A |
| Not a member | other user | refused | 403 `PARTIE_READ` refusal |
| Isolated / JDR | encounter or JDR party | refused | 403 `RALLIEMENT_UNAVAILABLE_MESSAGE` |
| Privacy | any 200 | no `email` in body | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/events/events.service.ts` -- Event writer, already excepted by `no-direct-owner-read.spec.ts`; `listCards` (:549) shows the first-séance pick (`orderBy createdAt, id; take 1`); add the read of past hosted counts here (`isSeancePast` from `seance-span.ts`, `isRalliementGroup` :297).
- `apps/api/src/events/event-board-games.service.ts` -- model for a group-guarded read (`permissions.assert(…, 'PARTIE_READ', { partieId })`, 403 `RALLIEMENT_UNAVAILABLE_MESSAGE`); new service file next to it, registered in `events.module.ts` (providers) and routed from `events.controller.ts` (`@Get('parties/:id/host-counts')`, `ParseUUIDPipe`).
- `packages/shared/src/index.ts` ~:2112 -- add `HostCountDto`, `HostCountsDto`.
- `apps/api/test/characterization/{harness,board-games-group.e2e-spec}.ts` -- group fixtures (`createPartie`, `addMember`); events inserted through Prisma for past dates.
- `apps/web/src/app/features/events/events-api.service.ts` -- add `hostCounts(partieId)`; `conjonctions-tab.ts:128` -- `PartiesService.changed()` effect pattern (firstRun guard) to copy.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:241` -- « Détails » reference zone; insert the section before it for `isGroup()`; `<details>` recipe at :266.
- `apps/web/src/app/core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS`, `VOICED`) -- keys.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- the two DTOs.
- [x] `apps/api/src/events/*` -- count read in `EventsService`, new service + controller route + module, unit tests (matrix), e2e over HTTP (`event-host-counts.e2e-spec.ts`).
- [x] `apps/web/src/app/features/events/events-api.service.ts`, `host-bars/*` -- API call, `HostBars` component + spec (bars, « Jamais », reload, failure).
- [x] `partie-detail.{html,ts}` + spec -- section for groups only, above the description.
- [x] Three tone files + `theme-tone.service.spec.ts` -- title themed, two neutrals.

**Acceptance Criteria:**
- Given a group with past hosted conjunctions, when a member opens « Détails », then hosts appear most to least with « {n} fois », then « Jamais : … ».
- Given a conjunction is cancelled or its host leaves while the page is open, then the section updates without reload.
- Given an isolated encounter or a JDR party, then no section exists and the route refuses.

## Implementation Notes

- Not seen in a browser: the three themes, 360 px and ≥ 768 px, open/closed section. The bar is drawn as a percentage of its track (track 120 px, 64 px under 480 px), so the largest count is 120 px on desktop and keeps its proportion on phones.
- The section sits in `partie-detail.html` above the reference zone, only when `isGroup()`; the `<details>` is open by default and its collapsed state is not remembered. `board_games.error_fallback` is reused as the neutral failure line.
- Cancellation cannot change a count (a past conjunction cannot be cancelled, and only past ones count); the live reload mainly serves a member leaving or joining. The cancelled-and-then-past state is reached in the e2e by dating the séance after cancelling, as time would.
- Review patches: reset on `partieId` change (as in 50.1), `role="list"` on the list, phone breakpoint with proportional bars.

## Spec Change Log

## Review Triage Log

Reviewers: blind-hunter, edge-case-hunter, verification-gap (the last found nothing).

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | edge | `host-bars.ts` | `partieId` change keeps the previous group's hosts | low | Reachable on route-param reuse; same fix as 50.1 | patch |
| 2 | blind | `host-bars.scss` | Fixed 120 px track squeezes names at 360 px | low | Real; breakpoint plus percentage bars | patch |
| 3 | blind | `host-bars.html` | `list-style: none` drops list semantics in Safari | low | Real, one attribute | patch |
| 4 | blind | `pastHostedCounts` | Only the first séance decides « past » | low | The same pick as `listCards`; a group conjunction has one séance. Rejected | reject |
| 5 | blind, edge | staleness | No refresh when midnight passes | low | No timer exists elsewhere either; a reload or any `partie:` signal rereads. Rejected | reject |
| 6 | blind | `hostCounts` | No in-flight de-duplication | low | Same class as 50.1 #9. Rejected | reject |
| 7 | blind, edge | `HostBars` | No loading state, no retry, borrowed error key | low | Needs new copy; same class as 50.1 #7/#8. Rejected | reject |
| 8 | blind, edge | `pastHostedCounts` | Unbounded read, counted in memory | low | A group's conjunction count is small; no measurement. Rejected | reject |
| 9 | blind | `<details>` | Open state not remembered | false | Frozen decision in the spec | reject |
| 10 | edge | homonyms | Case/accent-only twin names not disambiguated | low | Same as 50.1 #13 class; negligible. Rejected | reject |
| 11 | blind | specs | Unit dates near UTC midnight; no re-join / admin-host / null-host e2e; no recovery-after-failure test | low | Negligible or covered by units. Rejected | reject |
| 12 | blind | styling | Hard-coded radii, fallbacks, rem | low | Same pattern as the 48/49/50.1 components. Rejected | reject |
| 13 | edge | e2e | Cancelled event aged after cancel is unreachable via the API | false | Reachable by time: cancel while upcoming, the date then passes | reject |
| 14 | edge | AC | Cancellation never changes a count (past events cannot be cancelled) | low | True; recorded in Implementation Notes, nothing to fix | reject |

## Design Notes

Counting in `EventsService` keeps the host column out of new files; the permission and group guard live in the new service, like the games read.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build` -- expected: green (known: 3 `calendar` fixed-date tests); never two pnpm commands in parallel.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: section open/closed, bars, « Jamais ».
