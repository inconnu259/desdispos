---
title: '37.1 — Freeze current JDR behaviour with characterization tests'
type: 'chore'
created: '2026-10-09'
status: 'done'
baseline_commit: 'b111c2133ee5b40055a8e165f3ca6b95dfcf4f79'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 37 ("la porte") refactors the core (ownerId, Event extraction, seance date span, permission service, calendar ports, per-seance reminders) under a "constant JDR behaviour" exit condition, but current tests mock Prisma call-by-call: they will be rewritten by each refactor and cannot prove behaviour stayed the same.

**Approach:** Add HTTP-level characterization tests (supertest on the real `AppModule`, real Postgres) through the routes whose contract the epic keeps, freezing today's observable behaviour. No production code change.

## Boundaries & Constraints

**Always:** Tests pass on the current code untouched. Each `it(...)` names the frozen behaviour in French (“fige : …”). Data setup goes through HTTP routes; direct Prisma writes are allowed only on tables the epic does not reshape (`User`, `Membership`) and for cleanup. Every run uses a random suffix and deletes what it created in `afterAll` (the local DB is the dev DB). Assertions target status codes, French error messages and DTO key sets — never Prisma call shapes. Comments in French.

**Never:** No dependency install, no `package.json`/lockfile change. No edit under `apps/api/src/` or `prisma/`. No assertion on internal columns that the epic removes (`dateValidee`, `scenarioId`, `Partie.reminderSentAt`) except through the HTTP/DTO output that exposes them today. No refactor of existing unit specs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create ONE_SHOT | `POST /parties` kind ONE_SHOT | 201 PartieDto role `mj`; `GET /parties/:id/scenarios` → exactly 1 BROUILLON scenario titled like the partie, 1 seance | N/A |
| Create campaign | kind CAMPAGNE_LINEAIRE / EPISODIQUE | 201, 0 scenario | N/A |
| getViewable refusals | `GET /parties/:id` by stranger / unknown uuid | 403 / 404 `Partie introuvable` | — |
| getOwned refusals | `PATCH /parties/:id` by member / unknown uuid | 403 / 404 `Partie introuvable` | — |
| Inscription capacity | episodic, scenario A_VENIR, capacity max 1; 2 players POST inscription | 1st 201/200, 2nd 409 with the "nombre maximal d'inscrits" message; re-POST by 1st is idempotent | — |
| Inscription freeze | seance dated via poll choose; POST / DELETE inscription | 400 "inscriptions sont figées" message | — |
| Poll choose | poll with 2 options; MJ chooses option dated D slot S | `GET /parties/:id` → `nextSessionDate` = D, `nextSessionSlot` = S | — |
| Reminder | partie whose chosen date falls in the next 24 h | `NotificationsService.processDueReminders()` sends `session-reminder` once to MJ + members (deduplicated); second call sends nothing for it | EmailService replaced by a fake |
| Party signals | MJ and player of fresh parties | `GET /me/party-signals` → entry per partie with `role`, `status`, `signals` codes (frozen as sets) | — |
| Seance-derived unavailability | player is in partie B with a dated seance; MJ of partie A queries | `GET /parties/A/available-slots` (or heatmap) marks the player unavailable on B's date/slot, without B's identity | — |
| DTO shapes | `GET /parties/:id`, `GET /parties/:id/scenarios` | exact sorted key sets of PartieDto, ScenarioDto, SeanceDto (episodic adds `participants`) | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/main.ts` -- bootstrap middlewares (helmet, express-session + connect-pg-simple, passport, global `ValidationPipe`) that the harness must replicate; `createNestApplication()` alone skips them.
- `apps/api/src/app.module.ts` -- global `ThrottlerGuard` (300/min) + `@Throttle` 5/min on `/auth/login`; `ScheduleModule`; `EmailModule` needs `MAIL_HOST/PORT/FROM`.
- `apps/api/src/auth/auth.controller.ts`, `auth/local.strategy.ts` -- `POST /auth/login {identifier, password}` (argon2 hash).
- `apps/api/src/notifications/notifications.integration.spec.ts` -- reference for real-DB setup, `FakeEmailService`, suffix + cleanup, `prisma.$disconnect()` before `app.close()`.
- `apps/api/src/parties/parties.service.ts` -- `create` L158, `toPartieDto` L115, `getOwned` L281, `getViewable` L289.
- `apps/api/src/scenarios/scenarios.service.ts` -- `inscrire` L779, `desinscrire` L854, `recalculateNextSession` L539, `toDto` L1023, `toSeanceDto` L1119.
- `apps/api/src/poll/poll.service.ts` `choose` L155; route `PATCH /parties/:partieId/poll/:pollId/choose {optionId}`; create poll `POST /scenarios/seances/:id/poll {options:[{date,slot}]}` (2–40).
- Routes: `POST /parties/:id/scenarios`, `PATCH /scenarios/:id/open`, `PATCH /scenarios/seances/:id/capacite {inscriptionMin,inscriptionMax}`, `POST|DELETE /scenarios/seances/:id/inscription`, `GET /me/party-signals`, `GET /parties/:id/available-slots|heatmap`.
- `apps/api/src/availability/availability.service.ts` `getSeanceDerivedUnavailability` L703 (AD-9).
- `apps/api/test/jest-e2e.json`, `.github/workflows/ci.yml` job `e2e` -- already runs `test:e2e` against Postgres with migrations; no CI change expected.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/test/characterization/harness.ts` -- boot `AppModule` with main.ts middlewares, neutralise throttling for tests only, override `EmailService` with a fake; helpers: seed user (argon2 hash) and return a logged-in `supertest.agent`, add membership, cleanup by suffix -- one shared, refactor-proof entry point.
- [x] `apps/api/test/characterization/parties.e2e-spec.ts` -- creation, getOwned/getViewable refusals, DTO shapes, party signals.
- [x] `apps/api/test/characterization/seances.e2e-spec.ts` -- inscription capacity + freeze, poll choose → nextSessionDate/Slot, seance-derived unavailability.
- [x] `apps/api/test/characterization/reminders.e2e-spec.ts` -- day-before reminder via `NotificationsService.processDueReminders()` on data built through HTTP.

**Acceptance Criteria:**
- Given the current code, when `pnpm test:e2e` runs in the `api` container, then all characterization suites pass and `git diff` shows no change outside `apps/api/test/`.
- Given a suite run, when it finishes, then no row with its suffix remains in the database.
- Given any later story of epic 37, when it runs these suites, then they are its behavioural reference (only reminder expectations may change, in 37.9).

## Implementation Notes

- Files: `apps/api/test/characterization/{harness.ts,parties.e2e-spec.ts,seances.e2e-spec.ts,reminders.e2e-spec.ts}` — 17 new tests; `pnpm test:e2e` 5 suites / 19 tests green (re-run by orchestrator).
- Throttling neutralised by overriding `getOptionsToken()` with `skipIf: () => true`; cron jobs stopped after `app.init()` via `SchedulerRegistry`; session store pool closed in `close()`.
- Reminder test calls public `sendDueReminders()` (wrapper of private `processDueReminders()`).
- 403 asserted by status only: today's body is Nest's default "Forbidden", and 37.6 plans French messages.
- `lint:check` reports 13 pre-existing errors, all under `src/` (untouched); eslint on `test/**` is clean.
- Pre-existing: "worker failed to exit gracefully" warning comes from `test/app.e2e-spec.ts` (not refactored, per spec).
- Review patches applied: MJ also a member of the due partie (dedup exercised); seance key-shape assertions merged into the self-contained freeze test; `isoDay()` computed once per test; PartieDto key sets frozen for POST response, `GET /parties` items (MJ and player) and player `GET /parties/:id`. Re-run: 5 suites / 19 tests green, merged test green alone, typecheck clean.
- Side effect shared with `notifications.integration.spec.ts`: the reminder run marks due dev-DB parties as reminded (emails go to the fake).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, verif-gap | Reminder dedup (MJ also member) not exercised | medium | `partieDatee` only adds players; dedup `Map` at notifications.service.ts:61-62 never hit; matrix row requires it | patch |
| 2 | blind | `app.get(EmailService)` passed as `FakeEmailService` → type error | false | `tsconfig.check.json` includes `test/` and `pnpm typecheck` passes (verified by verif-gap layer and implementer) | reject |
| 3 | blind | No unauthenticated (401) case | low | Real gap, but `AuthenticatedGuard` is not touched by epic 37 and the intent does not list it | reject |
| 4 | blind | Refusals on scenario/seance write routes not covered | low | Intent lists only getOwned/getViewable refusals; 37.6 brings its own refusal-per-cell matrix | reject |
| 5 | blind | PartieDto key sets frozen only for MJ `GET /parties/:id` | low | POST response, list items and player view not asserted; 37.2 rename touches them; fix is direct test additions | patch |
| 6 | blind, edge | Seance key-shape test depends on previous `it` | low | `scenarios.find(... seance.poll)` relies on data from prior test; fails with `-t` | patch |
| 7 | blind, edge | `isoDay()` re-evaluated across write/assert (UTC midnight) | low | Separate `isoDay(20)` calls at seances.e2e-spec.ts:674/711 and :731/738; direct fix | patch |
| 8 | edge | Reminder test fails if UTC midnight passes between setup and run | low | Real but seconds-wide window; fix needs clock pinning | reject |
| 9 | edge | `start()` failure leaks pools; cleanup not per-step; no suffix sweep | low | Only on infrastructure failure; adds guards/branches | reject |
| 10 | edge | `$disconnect()` before `app.close()` | maybe-false | Suites exit cleanly in practice; would need detectOpenHandles on new suites to settle; would be low | reject |
| 11 | edge | Untracked partie if POST body lacks id | false | A failed POST inserts nothing (transaction); a 201 always carries `id` | reject |
| 12 | edge | `sendDueReminders()` no-op if `isRunning` | false | Fresh instance per harness; flag false; test asserts recipients so a no-op would fail loudly | reject |
| 13 | blind, edge, verif-gap | Harness copies main.ts by hand (cookie maxAge, CORS missing); drift undetected | medium | Fix needs a shared `configureApp()` in `src/`, forbidden in this story | defer |
| 14 | blind, edge | Reminder run stamps `reminderSentAt` on due dev-DB parties | medium | Pre-existing pattern (notifications.integration.spec.ts); a restore would write `Partie.reminderSentAt`, removed in 37.9 | defer |
| 15 | edge, verif-gap | Hourly cron of dev API / app.e2e-spec may beat the test | low | Window only at the top of the hour; mitigation needs DB isolation | reject |
| 16 | blind | Heatmap alternative not covered | false | Matrix row reads "available-slots (or heatmap)"; available-slots is covered | reject |
| 17 | blind | Helper inconsistencies / duplicated types | low | Cosmetic; no named harm | reject |
| 18 | blind | Login throttle not characterized | false | Not in the intent; epic 37 does not touch auth | reject |

## Design Notes

Unit specs assert `prisma.x.create` arguments, so 37.2–37.4 must rewrite them; HTTP contracts survive. `dateValidee` has no writing route: freeze is exercised through poll choose, which every story keeps. Signals are compared as sets because their order is not a contract. Key-set assertions (`Object.keys(dto).sort()`) give 37.2 a single mechanical rename point (`mjId` → `ownerId`).

## Verification

**Commands:**
- `docker compose exec api pnpm test:e2e` -- expected: all suites green, including existing `app` and `security-headers`.
- `docker compose exec api pnpm typecheck` -- expected: no error (test files included via `tsconfig.check.json` if covered).
- `docker compose exec api pnpm lint:check` -- expected: no error.
- `git status --short` -- expected: only new files under `apps/api/test/characterization/` (+ this spec).
