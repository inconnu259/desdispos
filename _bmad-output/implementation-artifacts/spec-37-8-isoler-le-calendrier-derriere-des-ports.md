---
title: '37.8 — Isolate the calendar behind ports'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: '51ccbce21932799168c8d32c044db89ebb83574a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The calendar (`availability/`) and the date poll (`poll/`) are layer 1 yet depend on layer 2/3: availability imports `parties/participant-count.util`, poll imports `PartiesService`, `EventsService` and (via its controller) `ScenariosService` behind a `forwardRef`; poll also writes `Partie.nextSessionDate` itself (AD-15).

**Approach:** Layer 1 declares ports — `OccupiedSpansPort`, `OwnEventsPort` (availability), `SeanceDatePort`, `PartieSignalsPort` (poll) — as interface + injection token in its own folder; `events/` and `parties/` implement them, wired by one global composition module. `nextSessionDate/Slot` has a single writer, `EventsService.recalculateNextSession`, run inside the date-choosing transaction; `PollService` no longer writes it. Same observable calendar, unavailability and next-session behaviour; 37.1 tests unchanged.

## Boundaries & Constraints

**Always:** After the change no non-spec file under `availability/` or `poll/` imports from `parties/`, `scenarios/` or `events/` (module or service), and `PollModule`/`ScenariosModule` lose their `forwardRef`; `permissions/` stays importable. Tokens and interfaces live in `availability/ports/` and `poll/ports/`; ports are bound in a global `apps/api/src/ports/ports.module.ts` (imports `EventsModule` and `PartiesModule`, `useExisting`), imported by `AppModule`. `OccupiedSpansPort.occupiedSpansOf(userIds)` returns, per user, only `{ date, slot }` spans (today's rules: dated seances of every partie where the user participates — owner or member, or owner/inscribed for `CAMPAGNE_EPISODIQUE`; empty start slot reads `FULL_DAY`; undated skipped) and carries no title, partie id or identity. `OwnEventsPort.ownEventsOf(userId, roles, range)` returns the reader's parties `{ id, name, kind }` plus the current `mes-seances` and `inscriptions-ouvertes` entries (same fields, same display rules: episodic seances only for the MJ or an inscribed user, `FULL_DAY` default slot); `votes-en-cours` and group counts stay in availability on its own Prisma reads. `SeanceDatePort.chooseDate(tx, pollId, date, slot)` writes the seance span and recalculates `nextSessionDate/Slot` inside the caller's transaction (`recalculateNextSessionInTx`); `reminderSentAt` still resets only when the date or slot changes. `PartieSignalsPort.notifyChanged(partieId, ownerId)` replaces the six `notifyPartieSignalsChanged` calls. `participantCount` moves to `common/`. Comments and errors in French.

**Never:** No change to routes, DTOs or web. No change to who sees what in the calendar. No new export of titles through `OccupiedSpansPort`. No migration, no dependency install. Do not touch `AvailabilityDeclaration` logic or the polls layer queries beyond the dependency rewiring.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Choose a future date | MJ chooses option D | poll CLOSED, seance span = D, `Partie.nextSessionDate` = nearest upcoming span of the partie, all in one transaction | rollback leaves poll OPEN |
| Choose past date | option dated before today UTC | poll CLOSED, span written, `nextSessionDate` ignores the past span (nearest upcoming or null) | — |
| Occupied elsewhere | user is player in B with a dated seance | MJ of A sees them UNAVAILABLE that slot; response has no B id/name/owner | — |
| Own calendar | `GET /me/calendar` | same five layers and entries as today | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/availability/availability.service.ts` (1298 lines) -- `getSeanceDerivedUnavailability` L707 (AD-9; → `OccupiedSpansPort`), `getMyCalendar` L787 (5 parallel queries; `partie.findMany` + `seance.findMany` → `OwnEventsPort`), `buildMySeancesLayer` L945, `buildOpenInscriptionsLayer` L1069 (own events), `buildOpenPollsLayer` L1016 (stays, Prisma on `SessionPoll`/`membership.groupBy`), `affectedPartieIds` L89 (stays, realtime plumbing), import of `../parties/participant-count.util` L24, `PermissionService.rolesOf` (stays).
- `apps/api/src/poll/poll.service.ts` -- imports `PartiesService` (6 × `notifyPartieSignalsChanged`: L83, 128, 164, 212, 296, 314), `EventsService` (`setSpanFromPollInTx`), `countParticipants`; `choose` L167-213 writes `Partie.nextSessionDate/Slot/reminderSentAt` outside the transaction. `poll.controller.ts` L72-95 calls `ScenariosService.recalculateNextSession` best-effort.
- `apps/api/src/events/events.service.ts` -- `recalculateNextSession` L380 (already the single function; add `…InTx`), `setSpanFromPollInTx` L269; implements the two availability ports and `SeanceDatePort`. `scenarios.service.ts` L581 wrapper and its spec suite (L3063-3291) removed.
- `apps/api/src/parties/parties.service.ts` -- implements `PartieSignalsPort` (wraps `notifyPartieSignalsChanged`); still calls `AvailabilityService` (layer 2 → 1, unchanged).
- `apps/api/src/parties/participant-count.util.ts` (+ spec) → `common/`; importers: availability, poll, `scenarios.service.ts` L21.
- Modules: `availability.module.ts`, `poll.module.ts` (drop `PartiesModule`, `AvailabilityModule`, `EventsModule`, `forwardRef(ScenariosModule)`), `scenarios.module.ts` (drop `forwardRef(PollModule)`), `app.module.ts` (+ `PortsModule`).
- Specs: `availability.service.spec.ts` (2373 lines; ports as a 4th/5th constructor arg; `getActiveDeclarationsWithSeances` suite L1347-1638, `getMyCalendar` suite L1639-2373), `poll.service.spec.ts` (`choose` tests L394-545), `poll.controller.spec.ts` (3 `choose` tests), `events.service.spec.ts`; `permissions/no-direct-owner-read.spec.ts` exceptions for availability/poll/events to adjust. E2E reference (unchanged): `seances.e2e-spec.ts` L174-199 (next session) and L225-268 (AD-9).

## Tasks & Acceptance

**Execution:**
- [x] `availability/ports/*`, `poll/ports/*` -- interfaces + tokens (no imports from other business modules).
- [x] `events/events.service.ts` (+ spec) -- implement `OccupiedSpansPort`, `OwnEventsPort`, `SeanceDatePort`; add `recalculateNextSessionInTx`; reuse the existing queries moved from availability.
- [x] `parties/parties.service.ts` -- implement `PartieSignalsPort`; `ports/ports.module.ts` + `app.module.ts` wiring.
- [x] `availability/availability.service.ts` (+ spec) -- consume the two ports; no `parties/` import.
- [x] `poll/poll.service.ts`, `poll.controller.ts`, `poll.module.ts` (+ specs) -- consume `SeanceDatePort`/`PartieSignalsPort`; `choose` writes only poll + delegates date; controller no longer calls scenarios.
- [x] `scenarios/` -- drop the `recalculateNextSession` wrapper and the `forwardRef`.
- [x] `common/participant-count.util.ts` -- move + importers.
- [x] `permissions/no-direct-owner-read.spec.ts`, a new `apps/api/src/ports/layer-imports.spec.ts` -- the latter sweeps non-spec files of `availability/` and `poll/` and fails on imports of `parties/`, `scenarios/`, `events/`.

**Acceptance Criteria:**
- Given the import sweep, when `availability/` or `poll/` imports a layer-2/3 module, then the test fails.
- Given the suites, then 37.1 characterization tests (calendar, unavailability, next session) pass unchanged.
- Given `DELETE`-free code search, then `Partie.nextSessionDate` is written only in `events/`.

## Implementation Notes

- Ports: `availability/ports/{occupied-spans,own-events}.port.ts`, `poll/ports/{seance-date,partie-signals}.port.ts`; global `ports/ports.module.ts` binds them with `useExisting` (EventsService ×3, PartiesService ×1), imported by `AppModule`.
- `OwnEventsPort.ownEventsOf(userId, roles, range)`: `roles` is a batch resolver callback `(partieIds) => Promise<Map>` (parties are only known after the port reads them); availability passes `ids => permissions.rolesOf(userId, ids)` — still one batched query.
- `EventsService.chooseDate(tx, pollId, date, slot)` writes the span and runs `recalculateNextSessionInTx`; `PollService.choose` writes only the poll and delegates, in one transaction. `participantCount` moved to `common/`.
- Intended behaviour changes (AD-15): a past chosen date no longer becomes `nextSessionDate`; a recalculation failure now rolls back the whole choice (was swallowed by the controller after commit); `reminderSentAt` resets when the nearest upcoming span changes (not merely when the chosen option differs from the old value).
- `getMyCalendar` now runs in two steps (declarations + port in parallel, then polls and group counts): same result, one extra sequential round trip.
- Review patches: `recalculateNextSessionInTx` takes `SELECT … FOR UPDATE` on the Partie row before reading seances; `chooseDate` looks the poll up before writing; `PartieSignalsPort.notifyChanged(partieId)` (parties looks the owner up, never throws; poll no longer mentions the owner, two sweep exceptions removed) with adapter tests; layer-import sweep is an allowlist; stale comments fixed. Re-run: unit 1935/1937 (2 deferred date failures), e2e 62/62, typecheck/api build/web build OK, `migrate status` up to date, lint 12 pre-existing errors.
- Orchestrator run before review patches: typecheck OK, unit 1920/1922 (2 deferred date failures), e2e 62/62, api+web build OK, lint 12 pre-existing errors; no import from `parties/`, `scenarios/`, `events/` left in `availability/` or `poll/`.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge | Two polls of one partie chosen concurrently: recompute from a stale snapshot, last writer wins | medium | READ COMMITTED, no lock in `recalculateNextSessionInTx` | patch |
| 2 | blind | `chooseDate` writes the span before checking the poll exists | low | updateMany precedes the findUnique/404 | patch |
| 3 | blind | Port carries `ownerId`; poll reads the owner and needs sweep exceptions | medium | `notifyChanged(partieId, ownerId)`; parties can look the owner up | patch |
| 4 | verif-gap, blind | `PartiesService.notifyChanged` adapter untested | medium | poll spec mocks the port; parties spec never calls it | patch |
| 5 | blind | Layer-import sweep forbids only parties/scenarios/events, scans `*-spec.ts` | medium | Other upper-layer imports would pass | patch |
| 6 | blind | Stale references to removed APIs (prisma comment, seed, signals, scenarios), unused `asRows` | low | Direct comment fixes (web comment left, spec forbids web changes) | patch |
| 7 | edge | Recalc failure now rolls back the whole choice | low | Intended by AD-15 (single writer in the transaction); recorded in notes | reject |
| 8 | edge | Legacy poll with no seance: recalc may reset nextSessionDate | low | Previously the controller recalculated right after anyway; same end state | reject |
| 9 | blind | `ownEventsOf` loads all seances, range applied in memory | low | Same unfiltered read as before the move | reject |
| 10 | blind | `getMyCalendar` extra sequential round trip | low | Documented in notes; no measured issue | reject |
| 11 | blind, edge | Roles resolver leaks into port contract; role missing treated as non-MJ | low | Batch resolver needed by design; every returned partie gets a role | reject |
| 12 | blind | Participant rule duplicated across occupiedSpansOf/ownEventsOf/membersOf | low | Batch variants of `membersOf` deferred in 37.7 | reject |
| 13 | blind | `reminderSentAt` not reset when choosing a non-nearest date | low | Reminders target the nearest upcoming span; intended nuance, recorded | reject |
| 14 | blind | Redundant day normalisation; kind typing in spec fixtures; no checklist doc update | low | Cosmetic | reject |
| 15 | edge | Span validity not validated in availability | low | Produced only by our own port | reject |

## Design Notes

A third and fourth port (`SeanceDatePort`, `PartieSignalsPort`) are needed beyond the two in the story text: poll was found to depend on `PartiesService.notifyPartieSignalsChanged` and on `EventsService.setSpanFromPollInTx`. Running the recalculation inside the choosing transaction replaces the controller's best-effort call: the committed date can no longer diverge from `nextSessionDate`. The single behavioural nuance is intended by AD-15: a chosen date in the past no longer becomes `nextSessionDate`.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; e2e 62/62.
- `docker compose exec api pnpm build` and `docker compose exec web pnpm build` -- expected: OK.
