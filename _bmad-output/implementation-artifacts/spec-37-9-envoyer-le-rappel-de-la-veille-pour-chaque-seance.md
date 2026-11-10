---
title: '37.9 — Send the day-before reminder for every seance'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: '01ea4731e368fb8b046d3a421fe17999b1b8a544'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The day-before reminder is tracked by `Partie.reminderSentAt` and keyed on `Partie.nextSessionDate`, so a campaign with several dated seances only reminds its first one (AD-12, FR-13 exception 8).

**Approach:** A migration adds `Seance.reminderSentAt`, carries `Partie.reminderSentAt` over onto the seance matching `nextSessionDate`, then drops the `Partie` column. The hourly job reminds each dated seance starting within 24 h whose reminder is unsent, to the same recipients as today (owner + members), with the same e-mail; changing a seance's date re-arms its reminder.

## Boundaries & Constraints

**Always:** Migration hand-written and idempotent against double sends: for every `Partie` with a non-null `reminderSentAt`, set it on the seances whose `startDate`/`startSlot` equal that partie's `nextSessionDate`/`nextSessionSlot` (null-safe slot comparison), then `DROP COLUMN "Partie"."reminderSentAt"`. `NotificationsService` keeps `@Cron(EVERY_HOUR)`, the `isRunning` non-overlap guard, the `[now, now + 24 h]` window (now on `Seance.startDate`), per-seance dedup of recipients, owner skipped when null, mark-after-send even when a send fails, the `session-reminder` template and its data (`partieName`, `sessionDate` formatted as today from the seance's `startDate`/`startSlot`, `link` to the partie). A seance's `reminderSentAt` is set to `null` whenever its span is written or cleared (`EventsService.chooseDate`, `resetSeanceDate`); `recalculateNextSession*` no longer touches reminders. A ONE_SHOT or a campaign with a single upcoming dated seance sends exactly the e-mails it sends today. Comments and errors in French.

**Never:** No new e-mail template, no recipient change (episodic campaigns still reach all members, not only inscribed ones), no relance of polls (epic 40), no cancelled-event filter (epic 42), no change to `nextSessionDate/Slot` logic. No `prisma migrate dev`/`reset` on the dev DB. No dependency install, no web change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single seance due | partie with one dated seance in ≤ 24 h | owner + members get the same e-mail as before; seance marked; second run sends nothing | send failure logged, seance still marked |
| Several seances due | episodic campaign, 2 dated seances in ≤ 24 h | each member gets one reminder per seance | — |
| Not yet due / undated | seance > 24 h away or without date | nothing sent | — |
| Date changes | seance already reminded, then its date is reset and re-chosen | reminder re-armed (`reminderSentAt` null) and sent for the new date | — |
| Migration | partie already reminded for `nextSessionDate` D | the seance(s) dated D carry `reminderSentAt`; no resend after deploy | — |
| Overlapping runs | job still running at the next tick | second run skipped with a warning | — |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Partie.reminderSentAt` L75 (to drop), `Seance` (add `reminderSentAt DateTime?`). New migration `20261010140000_seance_reminder_sent_at` after `20261010130000_seance_date_span`.
- `apps/api/src/notifications/notifications.service.ts` -- `processDueReminders` queries `partie.findMany({ nextSessionDate window, reminderSentAt: null })` with `owner` + `memberships`; formats via `formatSessionDate`; marks `partie.update({ reminderSentAt })`. Rewrite on `seance.findMany({ startDate window, reminderSentAt: null })` including `event.partie.{name, id, owner, memberships}`; its `partie.owner` read keeps its named exception in `permissions/no-direct-owner-read.spec.ts` (rewrite the reason).
- `apps/api/src/events/events.service.ts` -- `recomputeNextSession`/`recalculateNextSession*` (~L405-465: `reminderSentAt` reset on change → remove), `chooseDate` (span write: add `reminderSentAt: null`), `resetSeanceDate` (~L246-251: add `reminderSentAt: null`).
- `apps/api/src/poll/poll.service.ts` L188 -- comment citing the reset; update.
- Specs: `notifications.service.spec.ts`, `notifications.integration.spec.ts` (real DB: due / not yet due / no date), `events.service.spec.ts` (reset assertions move from Partie to Seance), `scenarios.service.spec.ts` (remaining `reminderSentAt` fixtures); e2e `test/characterization/reminders.e2e-spec.ts` stays unchanged and green (ONE_SHOT, owner + members once, second run empty); add a new e2e case for the several-seances exception.
- `apps/api/prisma/seed-demo.ts` -- `reminderSentAt: null` on parties (L1077, L1406, L1526) removed; the reminder demo seance keeps `reminderSentAt` null.

## Tasks & Acceptance

**Execution:**
- [x] `schema.prisma` + migration -- add `Seance.reminderSentAt`, backfill from `Partie`, drop the `Partie` column.
- [x] `events/events.service.ts` (+ spec) -- reset on span write/clear; drop the partie-level reset.
- [x] `notifications/notifications.service.ts` (+ unit and integration specs) -- per-seance reminder job.
- [x] `permissions/no-direct-owner-read.spec.ts`, comments in `poll.service.ts`, `seed-demo.ts`, `scenarios.service.spec.ts` -- follow the move.
- [x] `test/characterization/reminders.e2e-spec.ts` -- add one case: an episodic campaign with two dated seances within 24 h reminds every member once per seance (existing case untouched).

**Acceptance Criteria:**
- Given the dev DB, when the migration is applied, then `Partie.reminderSentAt` is gone and each previously reminded partie's matching seances carry the old timestamp; no reminder is re-sent for them.
- Given the existing characterization reminder test, then it passes unchanged.
- Given the suites, then the only changed expectations are those of `NotificationsService` and of the `events` reset assertions that carried `Partie.reminderSentAt`.

## Implementation Notes

- Migration `20261010140000_seance_reminder_sent_at`: dev DB had one reminded partie (timestamp 2026-10-06 19:00) and one matching seance; after deploy that seance carries the identical timestamp, `Partie.reminderSentAt` is dropped, `migrate status` up to date.
- `NotificationsService`: `seance.findMany({ startDate in [now, now+24h], reminderSentAt: null })` with `event.partie.{owner, memberships}`; one e-mail per recipient per seance (a member can get several mails for several same-day seances — product decision of the spec); the `partie.owner` read keeps its named sweep exception.
- `EventsService.chooseDate` / `resetSeanceDate` re-arm the seance (`reminderSentAt: null`); `recomputeNextSession` no longer touches reminders. Re-choosing the same date re-arms too (a poll can only be chosen once, so unreachable in practice).
- Review patches: the post-send mark is `updateMany` guarded by the seance's `startDate`/`startSlot` (no overwrite of a re-armed null, no P2025); per-seance try/catch so one failure does not stop the run; leftover mock and over-long lines cleaned; migration header comment states who inherits the flag (comment-only edit, `migrate status` still up to date). Re-run: unit 1942/1944 (2 deferred date failures), e2e 63/63, typecheck/api build/web build OK, lint 12 pre-existing errors.
- Orchestrator run before review patches: typecheck OK, unit 1940/1942 (2 deferred date failures), e2e 63/63 (new episodic multi-seance case), web build OK, `migrate status` up to date, lint 12 pre-existing errors.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | edge | Mark-after-send `update` can overwrite a re-armed null after a date change, and P2025 aborts the loop | medium | `seance.update({ where: { id } })` after sends; race with `chooseDate`/`resetSeanceDate` | patch |
| 2 | blind | One failing seance aborts the run for the others | medium | No per-seance try/catch | patch |
| 3 | blind | Over-long comment/log lines, leftover `findUniqueOrThrow` mock in scenarios spec | low | Direct cleanup | patch |
| 4 | blind, edge | Migration comment does not state which seances inherit the flag | low | Header comment only | patch |
| 5 | verif-gap, blind | Data backfill untested on old-shape rows (and same-day other-slot seance is re-reminded) | medium | Carried by the deferred migration-on-data check; manual snapshot match done | defer (carried) |
| 6 | blind, edge | Re-choosing the same date re-arms the reminder | low | A poll closes at choose; `chooseDate` cannot re-run on a dated seance | reject |
| 7 | blind, edge | Claim-first / multi-replica double send; crash between send and mark | low | `isRunning` guard is in-process by spec; spec mandates mark-after-send | reject |
| 8 | blind | No index on `Seance.startDate` | low | Small tables; no measured need | reject |
| 9 | blind, edge | Unbounded `findMany` | low | Per-hour due set is small | reject |
| 10 | blind | Several mails per member for same-day seances | low | Spec decision (one reminder per seance), recorded in notes | reject |
| 11 | blind | Window ignores slot / closed parties; `resetSeanceDate` not transactional | low | Pre-existing | reject |
| 12 | blind | Test-gap wishes (window gte, orderBy, multi-seance integration) | low | Multi-seance covered by the new e2e case | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy && docker compose exec api pnpm exec prisma generate` -- expected: applied; before/after check that every partie with `reminderSentAt` has matching seance(s) marked.
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; e2e 62/62 plus the new case.
- `docker compose exec api pnpm exec prisma migrate status` -- expected: up to date.
- `docker compose exec api pnpm build` and `docker compose exec web pnpm build` -- expected: OK.
