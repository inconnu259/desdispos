---
title: '37.3 — Extract the base Event; Scenario becomes its JDR extension'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: 'ec62aa217bf099f6787efb189817329080570435'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sessions, polls and inscriptions hang off `Scenario`, a JDR-only object; ralliement (epic 38+) must reuse them without a hidden scenario and without rewriting references (AD-3).

**Approach:** One migration creates `Event` with, for each `Scenario`, a row of the **same `id`** carrying `partieId`, `title`, `description`, `createdAt` (moved) and `ownerId` (= partie owner), and renames `Seance.scenarioId` → `eventId`. A new layer-2 module `events/` owns `Event` and **every write to `Seance` (except `compteRendu`) and `Inscription`** (decision 2026-10-10: full move now, per AD-1's writers table); `ScenariosService` keeps the extension and creates through `EventsService.create(…, extend)` in one transaction, emitting after commit. Routes, DTOs and web unchanged; 37.1 tests unchanged.

## Boundaries & Constraints

**Always:** Migration hand-written, data-preserving (INSERT…SELECT then drop moved columns), FKs `Event.partie` Cascade, `Scenario.event` (PK = `Event.id`) Cascade, `Event.owner` SetNull, `Seance.event` Cascade; `ScenarioDocument`, `ScenarioParticipant`, `Announcement`, `CharacterNote` keep pointing at `Scenario.id` (same values). `ONE_SHOT` = exactly one event, checked inside the creating transaction under `SELECT … FROM "Partie" … FOR UPDATE`. DTO fields stay (`ScenarioDto.partieId/title/description/createdAt` projected from the event, `SeanceDto.scenarioId` = `eventId`). JDR-only guards (scenario status BROUILLON/PASSE, partie kind, anti-spoil) stay in `ScenariosService`, which then delegates the write to `EventsService`; seance-level rules (row lock, capacity, date freeze, idempotence, 400/409 messages) move with the write, unchanged. `Seance.compteRendu` stays written by `scenarios/`. Realtime emit after commit, never inside a transaction. Comments and errors in French.

**Never:** No `/parties/:id/events` routes, no `Event.cancelledAt` (epic 42), no seance date-span columns (37.4), no registry/permission work (37.5–37.7), no calendar ports (37.8). No `prisma migrate dev`/`reset` on the dev DB. No dependency install. No change to `packages/shared` DTO shapes or to `apps/web`.

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- Scenario L529-549 (`@@index([partieId, status])`), Seance L553-574 (`scenarioId` Cascade), relations from `CharacterNote` (SetNull), `ScenarioParticipant` (`scenarioId_userId` key), `ScenarioDocument`, `Announcement`; `Partie.scenarios` L84.
- New migration `apps/api/prisma/migrations/20261010120000_event_extraction/` (format `YYYYMMDDHHMMSS_snake_case`, after `20261009120000_partie_owner_id`).
- `apps/api/src/scenarios/scenarios.service.ts` (1278 lines) -- writers `create` L67+L79 (two calls, no tx today), `update` L98 (title/description → Event); seance/inscription writers moving to `EventsService`: `addSeance` L517, `deleteSeance` L618, `createSeancePoll` L679 (pollId attach; the poll itself stays in `PollService`), `resetSeanceDate` L712, `setSeanceCapacity` L762, `inscrire` L779-848 (raw lock L811 `SELECT id FROM "Seance" … FOR UPDATE`), `desinscrire` L854-881, `setInfosPratiques` L930; `setCompteRendu` L894 stays; raw SQL lock L404 `SELECT id FROM "Scenario" WHERE "partieId"` (markCourant, linear) → must lock via a join on `Event`; readers by `partieId`/`createdAt` L204, L228, L309-314, L406, L541, L593-602, L1183; mappers `toDto` L1023, `toSeanceDto` L1134, `toEnrichedDto` L1209, `loadRetrospectiveNotes` L1248; `resolveScenarioOrThrow` L1164.
- `apps/api/src/parties/parties.service.ts` -- `create` L177-186 (ONE_SHOT scenario + seance in a tx), `convertKind` L479-527 (create, counts, `updateMany` by `partieId`), counts/groupBy L203, L216, L429, L492.
- Readers through the relation: `parties/party-signals.service.ts` L66-108, `availability/availability.service.ts` L724-740, L808-813, mappers L941-979, L1063-1090, `characters/character.service.ts` L1421-1428, `homme-dragon/homme-dragon.service.ts` L569/L587.
- Modules: ScenariosModule imports `[PartiesModule, CharacterModule, forwardRef(PollModule)]`; PartiesModule imports `[AvailabilityModule]`. `EventsModule` must import only Prisma (global) so both can import it.
- Specs to adapt (mock shapes only): scenarios.service.spec (~264 hits), availability, character, parties, party-signals, announcements, homme-dragon, scenarios.controller, account specs; `notifications.integration.spec.ts`, `parties/partie-owner.integration.spec.ts` if they create scenarios.
- `apps/api/prisma/seed-demo.ts` -- 12 `scenario.create` + 12 `seance.create` (`scenarioId`).

## Tasks & Acceptance

**Execution:**
- [x] `schema.prisma` + migration -- `Event` model (index on `partieId`), Scenario extension (PK FK to Event, index on `status`), `Seance.eventId`; SQL: create table, INSERT…SELECT joining `Partie` for `ownerId`, rename + re-FK `Seance`, drop moved Scenario columns and old FK/index.
- [x] `apps/api/src/events/events.module.ts`, `events.service.ts` (+ spec) -- `create(input, extend?)` and a transaction-scoped variant for callers already in a tx; ONE_SHOT check under partie lock; seance lifecycle (create/add/delete), pollId attach/reset, capacity, practical info, inscribe/unsubscribe with their locks and messages; emits after commit.
- [x] `scenarios/` -- create via `EventsService.create(…, extend)`; title/description edits write `Event`; seance/inscription routes keep their JDR guards then delegate to `EventsService`; queries/locks/mappers read through `event`.
- [x] `parties/parties.service.ts` -- ONE_SHOT creation and `convertKind` create events through `EventsService` (transaction variant) with an inline extension writing the Scenario row, as today.
- [x] Other readers (signals, availability, characters, homme-dragon) -- query through `event`.
- [x] Specs + seed -- adapt mocks/fixtures to the new shape, no expectation change.

**Acceptance Criteria:**
- Given the dev DB, when the migration is applied, then `count(Event) = count(Scenario)`, every `Event.id` equals a `Scenario.id` with identical `partieId/title/description/createdAt`, `Event.ownerId` = partie owner, and every seance/document/note/participant still resolves to the same scenario.
- Given a ONE_SHOT partie, when a second event is created (e.g. `POST /parties/:id/scenarios`), then it is refused as today.
- Given the suites, then 37.1 characterization tests pass unchanged and `prisma migrate status` reports no drift.

## Implementation Notes

- Migration `20261010120000_event_extraction` applied: counts + md5 of scenarios, seances, documents, notes, participants, announcements identical before/after; 23 events for 23 scenarios, `Event.ownerId` = partie owner, no orphan seance; `migrate diff` empty, `migrate status` up to date.
- `events/` (module imports nothing but global Prisma/Realtime): `create`/`createInTx` (ONE_SHOT check under `SELECT … FROM "Partie" … FOR UPDATE`), `updateInTx`, seance lifecycle, `createSeancePoll(partieId, seance, createPoll)` (PollService still creates the poll), `resetSeanceDate`, capacity, practical info, `inscrire`/`desinscrire` (lock + messages unchanged); methods take a `partieId` already resolved by the caller's access check (to revisit in 37.6).
- `recalculateNextSession` moved into `EventsService` (ahead of 37.8) so seance delete/reset recalc then emit; `ScenariosService.recalculateNextSession` kept as a thin wrapper (PollController unchanged).
- `markCourant` lock: `SELECT … FROM "Scenario" s JOIN "Event" e … FOR UPDATE OF s`. Internal flattened row keeps DTOs identical; `SeanceDto.scenarioId` = `eventId`.
- `PartiesService` uses `createInTx` with an inline extension writing the Scenario row (Design Notes); partie status counts `Event`.
- seed-demo: `createScenario()` helper (event + nested scenario). Specs: mock shapes adapted in 6 files, no expectation change.
- Orchestrator re-run: typecheck OK, unit 1573/1575 (2 deferred date failures), e2e 19/19, `migrate status` up to date, web build OK.
- Review patches: real-DB e2e for linear `markCourant` (200 then 409); seed JSDoc restored; stale refs fixed (`EventsService.inscrire()`, `resolveScenarioOrThrow(eventId)`); `ScenarioRow` derived from Prisma types. Re-run: unit 1573/1575 (2 deferred), e2e 20/20, typecheck OK, lint 13 pre-existing errors.
- `seed:demo` not run (rewrites dev DB). Dev API may need a restart after `prisma generate`.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | markCourant rewritten lock SQL only checked against a `$queryRaw` mock | medium | spec asserts call count only; no e2e reaches `/courant`; implementer's real-DB check was a deleted temp file | patch |
| 2 | blind, verif-gap | Orphaned JSDoc in seed-demo (`createScenario` inserted between doc and `createTokenSecret`) | low | Doc now above the wrong function; direct move | patch |
| 3 | blind | Stale refs: availability comment cites `ScenariosService.inscrire()`, `resolveScenarioOrThrow(scenarioId)` gets `eventId`, over-long comment | low | Rule moved to `EventsService.inscrire()`; direct correction | patch |
| 4 | blind | `ScenarioRow` hand-copied, new columns silently dropped by `toRow()` | low | No compile-time link to Prisma types; direct type derivation | patch |
| 5 | verif-gap, blind | Data-moving migration only ever applied to an empty DB in CI | medium | Manual check done on dev DB (23 events, md5 identical) but not repeatable | defer |
| 6 | edge | convertKind counts without lock; concurrent create may get the ONE_SHOT 400 | low | Race pre-existing (no lock before); now it fails closed instead of creating a 2nd scenario | reject |
| 7 | blind | `create<T>` returns `undefined as T` without `extend` | low | Type-only; no caller does it; fix adds overloads | reject |
| 8 | blind | `hasScenario` now counts `Event` | low | Identical today (every JDR event has a Scenario); ralliement semantics belong to epic 38 | reject |
| 9 | blind | JDR wording in `EventsService` messages | low | Messages must stay identical (constant behaviour); neutral wording comes with ralliement | reject |
| 10 | blind | Composite `Scenario(partieId, status)` index replaced by `Event(partieId)` + `Scenario(status)` | low | Small tables; partieId filter still indexed | reject |
| 11 | blind | `Event.ownerId` snapshotted, never synced | false | AD-5: owner = creator, immutable | reject |
| 12 | blind | events.service.spec misses lock-409, poll-freeze unsubscribe, null-poll, recalc-unchanged cases | false | Those cases still run in scenarios.service.spec through the real `EventsService` (expectations unchanged) | reject |
| 13 | blind | SSE emit now fires inside EventsService before reload/signals | low | Write is committed when emit fires; clients refetch; no visible change | reject |
| 14 | blind | No Event delete path / extension-less JDR event | low | No scenario-delete route exists; cascade covers partie deletion | reject |
| 15 | blind | ScenariosService spec aliases tx and outer mocks | low | Test-structure nicety; transaction use covered by real-DB e2e | reject |

## Design Notes

`PartiesService` (layer 2) cannot import `ScenariosService` (layer 3); it keeps writing the Scenario extension row through an inline `extend` callback passed to `EventsService`, exactly the write it does today — a known exception to the writers table, to be closed when capabilities route layer-3 work (37.5–37.7).

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy && docker compose exec api pnpm exec prisma generate` -- expected: applied; row-count/md5 check before/after.
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; 19/19 e2e.
- `docker compose exec api pnpm exec prisma migrate status` -- expected: up to date.
- `docker compose exec web pnpm build` -- expected: OK (contract unchanged).
