---
title: '37.4 — Seance date as a continuous span, single source'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: 'bb0d169b6eec5ce3e17552b03e4ca13c0b3b1744'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A seance's date lives in two places (`poll.chosenDate/chosenSlot` or `Seance.dateValidee`), and every reader recomputes `poll.chosenDate ?? dateValidee` with its own slot convention (AD-4).

**Approach:** One migration adds `Seance.startDate`, `startSlot`, `endDate`, `endSlot`, fills them from the chosen poll option, else from `dateValidee` with an empty slot, `end = start`, then drops `dateValidee`. Every reader reads the span; choosing a poll option writes it (atomically with the poll), resetting a seance date clears it. API responses, web and 37.1 tests unchanged.

## Boundaries & Constraints

**Always:** Migration hand-written and data-preserving (`ADD COLUMN` → `UPDATE … FROM "SessionPoll"` → `UPDATE … dateValidee` → `DROP COLUMN`). Only `start = end` spans are written in this palier; one seance never represents several spans. Empty `startSlot` reads as `FULL_DAY` for availability (AD-9 derived unavailability, personal calendar) and as `null` elsewhere (seance DTO slot, `nextSessionSlot`), exactly as today. DTO contract unchanged: `SeanceDto.dateValidee/slotValidee` = span start/slot; `SeanceInscriptionDto.dateValidee` keeps today's raw semantics — `null` when the date came from a poll, the span start otherwise. `Seance` stays written by `events/`; `SessionPoll` by `poll/`. Comments and errors in French.

**Never:** No change to `packages/shared`, `apps/web`, or the 37.1 characterization expectations. No ranges with `end ≠ start`, no new UI to set a date directly. No calendar ports or removal of `PollService`'s `nextSessionDate` write (37.8). No `prisma migrate dev`/`reset` on the dev DB. No dependency install.

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Seance` L574 (`dateValidee` L582), `SessionPoll` L309 (`chosenDate/chosenSlot`, `seance` back-relation), `DaySlot` L261. New migration `20261010130000_seance_date_span` (after `20261010120000_event_extraction`).
- `apps/api/src/events/events.service.ts` -- freeze checks `inscrire` L257/L276, `desinscrire` L297 (`poll?.chosenDate ?? dateValidee` → `startDate`); `SeanceWithPoll` type L31; `resetSeanceDate` L194 (clear span); `recalculateNextSession` L329 (read span, slot null when empty). New tx-scoped writer for the chosen poll date.
- `apps/api/src/poll/poll.service.ts` `choose` L155-191 -- closes poll + writes `Partie.nextSessionDate`; must also write the seance span (seance found by `pollId`) in the same transaction through `EventsService`. `poll.module.ts` imports `PartiesModule`, `AvailabilityModule`, `forwardRef(ScenariosModule)`, not `EventsModule` yet (no cycle: `EventsModule` imports nothing).
- `apps/api/src/scenarios/scenarios.service.ts` -- `toSeanceDto` L1023-1053 (L1031 effective date, L1035 slot, L1050 raw inscription date), `include: {poll:true}` L717/L753 (may drop if no longer needed), `loadRetrospectiveNotes` L1170 (works on DTO; keep), stale comment ~L574 ("poll NOT deleted").
- `apps/api/src/availability/availability.service.ts` -- AD-9 L703-738 (`?? 'FULL_DAY'`), `getMyCalendar` L783-811, `buildMySeancesLayer` L940-983, `buildOpenInscriptionsLayer` L1063-1082.
- `apps/api/src/parties/party-signals.service.ts:85` -- `OR [dateValidee not null, poll.chosenDate not null]` → `startDate: { not: null }`.
- Specs: `scenarios.service.spec` (~53 `dateValidee`), `availability.service.spec` (~27), `events.service.spec` (~6), `parties.service.spec` (1), `poll.service.spec` (choose). Seed `apps/api/prisma/seed-demo.ts`: 4 `dateValidee` writes (L1192, L1243, L1274, L1369 loop) and 4 chosen polls (L675, L893, L1404, L1521) whose seances need the span.

## Tasks & Acceptance

**Execution:**
- [x] `schema.prisma` + migration -- span columns (`DateTime?`, `DaySlot?`), backfill, drop `dateValidee`.
- [x] `events/events.service.ts` (+ spec) -- span-based freeze/recalc/reset; `setSpanFromPollInTx(tx, pollId, date, slot)` writing `start = end`.
- [x] `poll/poll.service.ts`, `poll.module.ts` (+ spec) -- `choose` closes the poll and writes the span in one `$transaction`; import `EventsModule` (temporary layer-1 → layer-2 import, replaced by a port in 37.8).
- [x] `scenarios/scenarios.service.ts`, `availability/availability.service.ts`, `parties/party-signals.service.ts` -- read the span with the slot conventions above; inscription DTO date as specified.
- [x] Specs + `seed-demo.ts` -- fixtures to the span shape, no expectation change; seeded chosen polls also get their seance span.

**Acceptance Criteria:**
- Given the dev DB, when the migration is applied, then for every seance `startDate = endDate = coalesce(poll.chosenDate, dateValidee)` and `startSlot = endSlot = poll.chosenSlot` (null when the date came from `dateValidee`), with unchanged row counts.
- Given an open poll on a seance, when the MJ chooses an option, then the seance span equals that option and the poll is CLOSED — both or neither.
- Given a dated seance, when its date is reset, then the span is cleared and `nextSessionDate` recalculated.
- Given the suites, then 37.1 characterization tests pass unchanged and `prisma migrate status` reports no drift.

## Implementation Notes

- Migration `20261010130000_seance_date_span`: snapshot of `coalesce(poll.chosenDate, dateValidee)` + poll slot (23 seances, 18 dated) identical to `startDate/startSlot` after deploy; no `start ≠ end`; `migrate diff` empty, `migrate status` up to date.
- `EventsService.setSpanFromPollInTx(tx, pollId, date, slot)` (updateMany by `pollId`, never emits); `PollService.choose` closes the poll and writes the span in one `$transaction`; `PollModule` imports `EventsModule` (temporary, 37.8).
- `inscription.dateValidee` = `null` when the poll has a chosen date, span start otherwise. Known loss: a seance that had both a chosen poll and a legacy `dateValidee` loses that raw value (AD-4 makes it unlikely).
- `schema.prisma` rebuilt from HEAD + this change after `prisma format` reformatted unrelated models (9-line diff). Seed type-checks, not run (rewrites dev DB).
- Review patches: choose test uses a distinct `tx` (asserts poll close and span on `tx`, none on `prisma`); e2e positive check of `COMPTE_RENDU_NON_REDIGE` after dating by vote; scenarios spec fixtures/titles aligned on the span (sealed-vote fixture kept at 2026-09-02/EVENING: a sealed vote fills the span); `SeanceDated` docstring. Re-run: unit 1576/1578 (2 deferred), e2e 21/21, typecheck OK, lint 13 pre-existing errors.
- Orchestrator re-run: typecheck OK, unit 1576/1578 (2 deferred date failures), e2e 20/20, `migrate status` up to date, web build OK.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap, edge, blind | choose "same transaction" test cannot detect a write outside the tx (mock `tx` = `prisma` models) | medium | makePrisma passes the shared `models` object as `tx`; moving `sessionPoll.update` out still passes | patch |
| 2 | verif-gap | `COMPTE_RENDU_NON_REDIGE` never checked positively after the filter change | medium | Unit mock ignores `where`; e2e only asserts absence | patch |
| 3 | blind | Stale fixtures/titles in scenarios spec; unexplained fixture change (2026-08-15/null → 2026-09-02/EVENING) | low | Fixtures carry unused `poll` fields; changed fixture alters scenario under test | patch |
| 4 | blind | `SeanceDated` docstring still names the old dual read | low | Direct comment fix | patch |
| 5 | verif-gap, blind | Data backfill not tested on old-format rows | medium | Carried by the 37.3 deferred migration-on-data check; manual snapshot match done | defer (carried) |
| 6 | blind | `loadRetrospectiveNotes` still reads `poll.chosenDate ?? inscription.dateValidee` | low | Pre-existing logic on the DTO; inscription date semantics kept by spec → behaviour constant | reject |
| 7 | blind | `inscription.dateValidee` derived from poll presence | false | Required by the frozen spec to keep today's raw semantics | reject |
| 8 | blind | CLOSED check outside the transaction (concurrent choose) | low | Pre-existing race (no guard before either) | reject |
| 9 | blind | `partie.update`/emit outside the transaction | low | Spec's all-or-nothing scope is poll + span; nextSessionDate write moves in 37.8 | reject |
| 10 | blind, edge | No CHECK constraints on span coherence | low | Only `start = end` writers exist; adds DDL | reject |
| 11 | blind | No index on `Seance.startDate` | low | Small tables; no measured need | reject |
| 12 | blind | `deleteSeance` comment says poll deleted | false | `EventsService.deleteSeance` does delete the linked poll (events.service.ts) | reject |
| 13 | blind | Comments in shared/web still describe `dateValidee` column | low | Spec forbids touching shared/web; DTO field still named `dateValidee` | reject |
| 14 | blind | Seed duplicates chosen date/slot on poll and seance | low | Seed-only; no runtime drift | reject |
| 15 | edge | Legacy dual-dated seance loses raw `dateValidee` in inscription DTO | low | Accepted in spec (AD-4), recorded in notes | reject |

## Design Notes

`PollService` is layer 1 and should not import `events/` (AD-1); it already imports `parties/` and `scenarios/`, which 37.8 removes with ports. Writing the span inside `choose`'s transaction keeps today's atomicity (the date was one poll row) — a best-effort call from `PollController` would let a closed poll exist without a seance date.

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy && docker compose exec api pnpm exec prisma generate` -- expected: applied; before/after check that each seance's span equals its former effective date.
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; e2e 20/20.
- `docker compose exec api pnpm exec prisma migrate status` -- expected: up to date.
- `docker compose exec web pnpm build` -- expected: OK.
