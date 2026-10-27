---
Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap). No intent_gap, no bad_spec, so no loopback. Patches applied directly (the review is done in-session, no implementation subagent to re-engage); checks re-run afterwards (API typecheck, API unit tests of events/scenarios/ports, e2e 426, web tests with only the 2 known date-frozen failures).

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | Form always sends `durationSlots`, a stale card or draft overwrites a duration changed elsewhere (BH, EC, EC claim) | medium | patch (done) | Real: `EventForm.dto()` and `SeanceList` sent it unconditionally. Now sent on creation, and on edit only when the stepper moved; `SeanceList` compares the draft with the server value. Tests updated. |
| 2 | Every infos save takes the Partie/Event locks and fires `notifyPartieSignalsChanged` even when the duration is identical (BH, EC) | medium | patch (done) | Real, a consequence of #1. `EventsService.setInfosPratiques` now returns `{ durationChanged }` and `ScenariosService` notifies only on a real change. |
| 3 | No test for the notification in `setInfosPratiques` (BH, VG) | medium | patch (done) | Confirmed: removing the block failed no test. Two cases added in `scenarios.service.spec.ts` (changed → notified; absent or identical → not). |
| 4 | Web `addSeance` body never proven to carry the duration (VG) | medium | patch (done) | Confirmed: only a `{}` body test existed. Case `addSeance('s1', 6)` added in `core/scenarios/scenarios.service.spec.ts`. |
| 5 | `chooseDate` throws 400 when a multi-slot seance gets a `FULL_DAY` poll option (BH, EC, VG) | medium | defer | Real: JDR poll options may be `FULL_DAY` and a seance can get duration > 1 before its poll exists; the vote cannot then be closed on that option (French message, fixable by editing the options). Fixing it means validating poll option writes, which the frozen intent excludes (poll/composer writes belong to 47.4, FULL_DAY refused beyond 1 there). The "arbitrary seance" part of the claim is false: `Seance.pollId` is `@unique`. |
| 6 | "Past" and cancel guards read only `startDate`, so a long rendez-vous already started is refused edit/cancel (BH) | medium | defer | Real once ranges are long, but the spec's Never list leaves the "past" rule to 47.2 (AC: "passée = fin avant aujourd'hui, partout"). |
| 7 | Consumers of the range (`isFreeOn`, reminder, personal calendar) still read a single slot (BH) | false | rejected | Stated scope: 47.2 and 47.3 own the readers; the diff adds the data only. The schema comment already says the end is written by `events/`. |
| 8 | Duration correction on a date with no slot wipes `endDate` (EC) | medium | patch (done) | Real: `seanceSpanEnd` returned null/null whenever the slot was null. A start without slot now keeps its own day as the end; test added. |
| 9 | Failed infos save hides the French 400 message (EC) | low | patch (done) | Real: generic text replaced the server message. `SeanceList` now shows the server message when there is one. One-line fix. |
| 10 | Untested branches of `setSeanceDurationInTx`: started seance, recalculation, not found, changed flag (BH) | low | patch (done) | Four cases added in `events.service.spec.ts`. |
| 11 | Writer-guard test misses nested relation writes and raw SQL (BH, EC) | low | patch (done) | Both patterns added, with detector tests. Aliased clients stay out of reach of a source scan (accepted). |
| 12 | `SeanceDatePort.chooseDate` doc still says `start = end` (EC) | low | patch (done) | Doc reworded to `end = spanEnd(start, durationSlots)`. |
| 13 | e2e title says "sans corps" but sends `{}` (BH) | low | patch (done) | The test now posts without a body. |
| 14 | `durationSlots: null` reaches `assertDuration` and gets a 400 (EC) | low | rejected | A 400 with a French message on an invalid body is correct; the fix would add a branch for no user-visible gain. |
| 15 | Full-day start with a multi-slot duration reaches the server from the form / stepper not clamped (BH, EC) | false | rejected | The event form offers only morning, afternoon and evening (`EVENT_SLOTS` excludes `FULL_DAY`), and `updateHosted` input uses `EventSlot`. In the session list the stepper disables "Allonger" on a full-day start; a value above 1 there needs a row the server already refuses to create. |
| 16 | Notification inconsistent across write paths (BH) | false | rejected | `GroupEventsService.update` always calls `notifyChanged`, and the vote-closing path notifies as before; only the JDR infos route lacked it and has it now. |
| 17 | Closed poll with no date shows "tant que le vote est ouvert" (EC) | low | rejected | A JDR poll without date is detached by `resetSeanceDate`; the group case is a cancelled event, which is frozen anyway. |
| 18 | No DB `CHECK` on `durationSlots` (BH) | low | rejected | The column is written only by `events/` (guarded by the source test) behind `assertDuration`; adding a check needs a second migration for a case no writer can reach. |
| 19 | Duplicated validation messages and decorator stacks, `scenarios/` DTOs import `events/seance-span` (BH) | low | rejected | Refactor only; `scenarios/` already depends on `events/`, and layer-imports constrains layer 1 only. |
| 20 | Stepper: one step per click, "15 jours" wording from an evening start, `readonly` input name, no aria-live test for readonly/cap (BH, EC) | low | rejected | The 45-slot cap and the one-click counter are the story's own acceptance criteria; the rest is cosmetic. |
| 21 | Spec claim "existing tests keep their expectations" is not literal (EC) | low | rejected | Only fixtures and frozen DTO key lists gained `durationSlots`; no behaviour expectation changed. |

title: 'Donner une durée à un rendez-vous (story 47.1)'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: 'f2e07a939646d20db7e3f09901c7d0c2c14bb164'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A rendez-vous (`Seance`) is always one slot: `end = start` is hard-coded in every span writer, so an organiser cannot record an evening, a game day or a weekend as such.

**Approach:** Add `Seance.durationSlots` (default 1), written only by `events/`; one pure `spanEnd`/`spanSlots` pair in `@master-jdr/shared`; one `events/` function keeps `end = spanEnd(start, durationSlots)` for every writer. Event window (evening mode) and JDR session add/edit gain a "Durée" stepper, and every seance output DTO carries `durationSlots`.

## Boundaries & Constraints

**Always:**
- Input DTOs: `durationSlots` absent = unchanged on update (also the full-replacement `PATCH` of an event), 1 only when creating a `Seance`; integer 1..`MAX_SLOT_WINDOW_SLOTS` (45), else 400 "15 jours au plus : au-delà, créez deux rendez-vous.". `FULL_DAY` only with duration 1 (400 otherwise).
- Correcting the duration of a **dated** seance (also when its date came from a vote) recomputes the end, clears `reminderSentAt` if the start is not past, recomputes `nextSessionDate`, emits `partie:{id}` + `notifyPartieSignalsChanged`, sends no e-mail. Editing another field never changes the span.
- No write sets `end = start` by default; `createInTx`, `updateHosted`, event creation, session edit and `SeanceDatePort.chooseDate` all call the one maintenance function (`chooseDate` keeps one-slot behaviour at duration 1).
- Output DTOs `SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry`, `DatableSeanceEntry` require `durationSlots`. Duration rides the route that carries it: no new permission action.
- French comments and errors; JDR behaviour unchanged at duration 1; existing tests keep their expectations; no dependency install; Docker only.

**Never:**
- No change to `OccupiedSpan`, availability, display of spans, e-mails, "past" rule, composer, automaton or `SessionPollDto`/`EventPollDto`/`OpenPoll` (stories 47.2–47.6).
- Duration of a seance with an undated poll is NOT editable here (it is set in the composer, 47.4): changing it is a 400 "La durée d'un rendez-vous au vote ouvert se règle dans le composer de dates." — the dialogs show it read-only; creating a poll with a duration is allowed.
- `scenarios/`, `parties/` and `poll/` never write `durationSlots`/`endDate`/`endSlot` of a `Seance`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dated creation | event on Sat EVENING, `durationSlots: 3` | seance start Sat EVENING, end Sun AFTERNOON, duration 3 | N/A |
| Default | creation without `durationSlots` | duration 1, `end = start` | N/A |
| Unchanged | `PATCH` event without `durationSlots` on a 3-slot seance | stays 3, end unchanged | N/A |
| Correct dated | duration 3 → 1 on dated seance, start in future | end recomputed, `reminderSentAt` null, `nextSessionDate` recalculated, no e-mail | N/A |
| Month edge | start 31 Oct EVENING, duration 2 | end 1 Nov MORNING | N/A |
| Whole day | `FULL_DAY` start with duration 2 | refused | 400 French message |
| Cap | `durationSlots: 46` or 0 | refused | 400 "15 jours au plus…" / integer ≥ 1 |
| Poll pending | change duration, seance has `pollId` and no date | refused | 400 composer message |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:627` -- `Seance`; add `durationSlots Int @default(1)`; fix the "start = end" comment. Migration `prisma/migrations/20261027120000_seance_duration_slots/migration.sql` (`ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT 1`), `pnpm exec prisma generate` in the container.
- `packages/shared/src/index.ts` -- `DaySlot` (:1001), `EventSlot`, `MAX_SLOT_WINDOW_SLOTS` (:1289, reuse as the cap), `CreateEventDto` (:831), `SetInfosPratiquesDto` (:756), `SeanceDto` (:702), `EventCardSeanceDto` (:869), `MyCalendarSeanceEntry` (:1323), `DatableSeanceEntry` (:1394). Add `spanEnd`, `spanSlots`, optional `durationSlots` inputs, required outputs, an add-seance payload.
- `apps/api/src/events/events.service.ts` -- sole writer: `createInTx` (:357, :387-399), `updateHosted` (:803, writes at :889-919), `addSeance` (:1128, no input today), `chooseDate` (:1227, `start=end` at :1243), `setInfosPratiques` (:1274), `resetSeanceDate` (:1199, clears span), `recalculateNextSessionInTx` (:2004), `EventSeanceInput` (:63), `listCards` seance projection (:547), my-calendar builder (:2216). New `events/` helper for end maintenance + duration validation.
- `apps/api/src/events/dto/create-event.dto.ts` + `group-events.service.ts` (`seanceInput` :310) -- accept/forward `durationSlots`.
- `apps/api/src/events/datable-seances.service.ts:90` -- add `durationSlots` to the entry.
- `apps/api/src/scenarios/scenarios.controller.ts:109` (`POST scenarios/:id/seances`, no body), `scenarios.service.ts:647` (`addSeance`), `:961` (`setInfosPratiques`), `toSeanceDto` (:1203) -- pass the duration down, expose it. New DTO beside `dto/set-infos-pratiques.dto.ts`.
- `apps/api/src/ports/layer-imports.spec.ts` -- pattern for the new source test (only `events/` writes the three `Seance` fields; `availability`'s `endDate` is another model).
- Web: `core/scenarios/scenarios.service.ts:149` (`addSeance`), `features/scenarios/scenario-editor/scenario-editor.ts:438` (add button), `features/scenarios/seance-list/seance-list.{ts,html}` (infos-pratiques editor :257, `onSetInfosPratiques` :373), `features/events/event-form/event-form.{ts,html}` (used by `event-create`, `event-dialog`), `features/events/event-card.util.ts:406` (`pollSlotLabel`, reuse `SLOT_LABELS` from `features/calendar/agenda-badge.utils`), `core/theme/tones/*` (`NEUTRAL_KEYS`). New `shared/duration-stepper/`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration -- add column and apply -- persistence of the duration
- [x] `packages/shared/src/index.ts` -- `spanEnd`/`spanSlots` (chain MORNING → AFTERNOON → EVENING → next MORNING; `FULL_DAY` unchanged by `spanEnd`, expanded to three slots by `spanSlots`), DTO fields -- single source of span arithmetic
- [x] `apps/api/src/events/events.service.ts` + helper -- one function computing/validating the span, used by all writers; duration correction path; poll-pending refusal -- invariant `end = spanEnd`
- [x] `apps/api/src/events/dto/create-event.dto.ts`, `group-events.service.ts`, `datable-seances.service.ts` -- input and output wiring
- [x] `apps/api/src/scenarios/*` -- add-seance body, infos route and `toSeanceDto` carry the duration
- [x] `apps/api/src/events/` source test -- only `events/` writes the three fields (layer-imports pattern)
- [x] Tests (unit, API integration/e2e characterisation) -- all I/O matrix rows, `spanEnd`/`spanSlots` edges (evening → next day, month end, `FULL_DAY`), concurrent-safe unchanged-duration `PATCH`
- [x] `apps/web/src/app/shared/duration-stepper/` -- "− n créneaux +" pill, 44 px targets, "Raccourcir"/"Allonger", greyed at 1 and 45, `aria-live`, clear range when dated ("sam. 14 après-midi → sam. 14 soir") else "soit N jours" from 3 slots, cap message; theme-neutral strings
- [x] `event-form`, `scenario-editor`, `seance-list` + web services -- stepper (default 1, no "facultatif"; read-only when the poll is pending); fix typed fixtures/specs
- [x] ⚠️ Flag in the story: event window and session add/edit (validated screens) gain a Durée row

**Acceptance Criteria:**
- Given a one-slot seance, when nothing sets a duration, then every screen and test behaves as before.
- Given any seance output DTO, then `durationSlots` is present.
- Given CI (typecheck, API build, unit + e2e tests), then it stays green; `graphify update .` run.

## Implementation Notes

- Implementation done directly in the session (no subagent), from the spec.
- Migration `20261027120000_seance_duration_slots` hand-written (SQL), applied to the dev database (`prisma migrate deploy` in the api container), client regenerated.
- `@master-jdr/shared`: `spanEnd` / `spanSlots` work on `YYYY-MM-DD` day keys (UTC) and return `{ date, slot }`; `DatedSlot` exported; `AddSeanceDto` added; the cap is `MAX_SLOT_WINDOW_SLOTS` (45), already there since 46.4.
- `events/seance-span.ts` holds `assertDuration` and `seanceSpanEnd` (the single end-of-span function). `EventsService.setSeanceDurationInTx(tx, partieId, seanceId, n)` is the duration-correction function under locks, ready to be wrapped by `RendezVousDurationPort` in 47.4. `updateHosted` applies the same rule inline (one seance read, locks already held).
- Accepted deviation from UX-DR14: the stepper words (Durée, Raccourcir, Allonger, créneau(x), soit N jours, the cap message, the read-only reason) live in `shared/duration-stepper/duration-labels.ts` (`DURATION_TEXT`), not in the tone registry. Ten more neutral keys pushed the Atelier theme under the 35 % own-vocabulary guard of `theme-tone.service.spec.ts` (414/1188), and "créez" would also have hit the Forêt tutoiement rule. Stories 47.3+ that add neutral words must decide the same way.
- A one-slot span is written as its start alone ("sam. 14 soir"), not "soir → soir".
- Tests: `seance-span.spec.ts`, `seance-span-writers.spec.ts` (source test), three DTO specs, `events.service.spec.ts` (block "durée d'un rendez-vous"), e2e `seance-duration.e2e-spec.ts`, `duration-stepper.spec.ts`, event-form / scenario-editor / seance-list specs; frozen shapes of the characterization tests updated (`durationSlots`).
- ⚠️ Validated screens changed: event create/edit window (Durée row between day/slot and place), scenario editor header (stepper beside "Ajouter une séance"), seance practical-info form (stepper before save; read-only under an open poll without date).
- Checked: API `typecheck` and `build` OK; API unit tests 2964 OK except 1 known date-frozen test ("AD-9 end-to-end", deferred-work); e2e 426 OK; web tests 4012 OK except 2 known date-frozen tests in `calendar-view.spec.ts` (2026-09-01). Not seen in a browser.

## Spec Change Log

## Review Triage Log

## Design Notes

`spanSlots` for a `FULL_DAY` start returns that day's three slots; `spanEnd(FULL_DAY, 1)` returns the same day `FULL_DAY` (duration > 1 throws, callers map it to the 400). Sat EVENING × 3 → Sat EVENING, Sun MORNING, Sun AFTERNOON → end Sun AFTERNOON.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- expected: all pass
- `docker compose exec web pnpm test` -- expected: all pass
- `docker compose exec api pnpm exec prisma migrate status` -- expected: schema up to date

**Manual checks (if no CLI):**
- Evening mode: create a 3-slot dated event, reopen it: stepper shows 3 and the range; JDR: add a session with 2 slots, edit its infos, duration kept.
