---
title: '40.8 — Free places and votes of whoever leaves the group'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'f2b7c9f487aafcf9a965a099332bf0c13f8f93bc'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-7-prolonger-le-vote-et-relancer-la-veille.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Someone who leaves a group, or is removed from it, keeps their places and votes on upcoming conjonctions: the places stay taken, they stay among the participants and the eligible voters, and they would still get reminders (FR6, AD-17; the extension point left in `PartiesService.leave()` by 39.5).

**Approach:** Inside the single exit procedure `PartiesService.leave()`, under the party lock, the group's upcoming sign-ups and reservations of the leaver are deleted, and so are their votes on open polls. Past data stays. No new route.

## Boundaries & Constraints

**Always:** Only the group path of `leave()` (`CAMPAGNE_EPISODIQUE` of the ralliement family), in the same transaction and under the same `SELECT … FOR UPDATE` of the party, for both `LEFT` and `REMOVED`; the JDR path and the one-shot ralliement are untouched; the last-admin departure that deletes the group needs no cleanup (cascade). Inside that transaction, after the party lock: take the `Event` row locks of the affected conjonctions (ids sorted, lock order Partie → Event as in 40.2–40.7), then delete the leaver's `Inscription` rows (`RESERVED` and `CONFIRMED`) on seances of the party's events that are upcoming — the seance day is today or later in UTC (same day-key convention), or the seance is undated (open poll) — and the leaver's `PollVote` rows on the party's `OPEN` polls. `events/` stays the only writer of `Inscription` (new `EventsService` method in `…InTx` style, never emitting) and `PollService` the only writer of `PollVote` (new `…InTx` method, never emitting); `PartiesService` only calls them (mind the module graph: no cycle). Kept: inscriptions on past conjonctions (the person stays among their participants, without admin flag), votes on closed or dated polls, and the upcoming conjonctions the leaver hosts (they stay until epic 42, which will cancel them inside this same procedure). No new migration, route, action, e-mail or signal. After commit, the existing `emitDeparture` already emits `partie:{id}` and `user:{id}` of the leaver and calls `notifyChanged`: cards, dialogs, « Complet », eligible voters, summaries and the home signal `RESERVATION_A_CONFIRMER` update for everyone without reload — no new web code unless a gap is found. A departure frees the last place: right after it, another member can sign up on that conjonction (tested). French comments and messages.

**Never:** No change to JDR behavior, DTOs, routes or tests (37.1 unchanged); no deletion of past inscriptions or closed-poll votes; no cancelling of hosted conjonctions (epic 42); no account-deletion handling (epic 43); no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Voluntary departure | member inscribed on upcoming conjonctions | their rows deleted, places freed, live for all | — |
| Removal by an admin | member with a `RESERVED` row | row deleted, place freed, their signal cleared | — |
| Last place | full limited conjonction, an inscrit leaves | another member signs up successfully afterwards | — |
| Open poll | leaver voted on an open group poll | their votes deleted, summaries recomputed live | — |
| Kept | past conjonction, closed or dated poll, hosted upcoming conjonction | unchanged | — |
| Undated | poll conjonction with their inscription | row deleted (counts as upcoming) | — |
| Last admin | group deleted | no cleanup needed, existing behavior | — |
| JDR / one-shot | any other party | unchanged | — |
| Atomicity | failure inside the cleanup | membership still present, nothing half-done | transaction rolls back |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts` -- `leave()` :519 (transaction after `lockPartie`; the extension-point comment at :588 lists epic 40; `emitDeparture` :~610 already emits and notifies), `LeaveCause`.
- `apps/api/src/events/events.service.ts` -- add the `…InTx` release of a user's upcoming inscriptions (Event locks sorted, upcoming rule with `todayKeyUtc` from `events/day-key.ts`); model: `inscrireConjonction`/`desinscrireConjonction` (Event lock), `listCards`/`participantsOf` (past participants who left stay listed).
- `apps/api/src/poll/poll.service.ts` -- add the `…InTx` removal of a user's votes on open polls of a party (`createInTx`/`updateInTx` style); module graph: `parties/parties.module.ts`, `events/events.module.ts`, `poll/poll.module.ts` (no cycle; `PartiesService` already injects `EventsService`).
- Tests: `parties.service.spec.ts` (leave unit cases, mocks of the two methods), `events.service.spec.ts`, `poll.service.spec.ts`, `test/characterization/ralliement.e2e-spec.ts` (departure and removal scenarios, last place, poll votes, kept rows, live), `permissions.e2e-spec.ts` untouched; derive dates from today.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/events/events.service.ts` (+ spec) -- release of the leaver's upcoming sign-ups under the Event locks
- [x] `apps/api/src/poll/poll.service.ts` (+ spec) -- removal of the leaver's votes on open polls
- [x] `apps/api/src/parties/parties.service.ts` (+ spec) -- call both inside `leave()` for the group path
- [x] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- matrix: voluntary and removal, last place, open poll votes, kept rows, hosted conjonction kept, live emissions

**Acceptance Criteria:**
- Given a member inscribed on the last place of a conjonction, when they leave or are removed, then the place is freed in the same transaction and every member's card updates live.
- Given a member who voted on an open poll, when they leave, then their votes are gone and the host's summary no longer counts them.
- Given past conjonctions, closed polls and conjonctions the leaver hosts, then they are unchanged.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | `PartiesService` injects `PollService` with `forwardRef` (provider cycle through `PARTIE_SIGNALS_PORT`) | medium | 37.8 removed every `forwardRef` on purpose; spec said no cycle; a poll-module provider depending only on Prisma avoids it | patch |
| 2 | edge, verif, blind | Sign-up or vote of the leaver in flight can insert a row after the cleanup (membership checked before the transaction, lock set read before locking) | low | millisecond window between a membership check and its own transaction; the ex-member cannot start a new one | reject |
| 3 | edge, blind | Multi-day or earlier-slot-today seances count as upcoming/past by day key | low | ranges are start = end; the spec fixes the day-key convention (today or later) | reject |
| 4 | blind, edge | Dead `parseDayKey` null branch; sequential Event locks; test `today` computed at describe time | low | style or midnight-only flake | reject |
| 5 | blind | Open polls past their deadline lose the leaver's votes | low | spec: votes on open polls are deleted; dated polls are already closed | reject |
| 6 | blind | Departed host: hosted conjonctions keep reminders, hosted poll cannot be dated | low | spec: hosted upcoming conjonctions stay until epic 42 (and 40.6 deferred the orphan host) | reject |
| 7 | blind | No host notification when a reservation vanishes; counts discarded; no web live test; unit boundary assertions | low | not required by the spec; e2e covers the live emissions | reject |
| 8 | blind | Process, language, tracker notes | low | conventions | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- unchanged (known date failures only)
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: two members, one inscribed leaves, the other's card shows the freed place live.
