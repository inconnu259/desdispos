---
title: 'Proposer des plages dans le composer (story 47.4)'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '885e3c03059947a8efa505b73b1bd3e7688df973'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-47-3-voir-une-plage-sur-tous-ses-jours.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A rendez-vous has a duration since 47.1, but the composer still proposes one-slot options: the organiser cannot set the duration while proposing dates, cannot see the span a start would cover, and the server refuses any duration change on a seance whose poll is open.

**Approach:** Add the `DurationStepper` to the compose bar, initialised to the target seance's `durationSlots`; every designated cell is a start whose whole span is lit with the existing preview look. The server writes duration and options in one locked transaction (`RendezVousDurationPort.setDurationInTx` → `PollService.setOptionsInTx`), purging options and answers only when the duration really changed; poll DTOs carry `durationSlots` at their root.

## Boundaries & Constraints

**Always:**
- Write order, one transaction: lock `Partie` then `Event` (`FOR UPDATE`, `updateHosted` order) → `setDurationInTx` → `setOptionsInTx(tx, pollId, { options, expiresAt, bounds }, { purge: changed })`. `purge` comes only from `setDurationInTx`'s return. Purge = delete all options (votes cascade) and recreate them without `planOptions`, and clear `relanceSentAt`; otherwise reconcile on `date|slot` as today.
- `durationSlots` absent from `PUT …/options`, `POST …/seances/:id/poll` or `PATCH …/events/:id` = unchanged (1 only at seance creation). Validated integer 1..45 (`MAX_SLOT_WINDOW_SLOTS`), 400 in French. A `FULL_DAY` option with an effective duration > 1 is refused (400). Rights stay those of the carrying route (`POLL_OPTIONS_SET`, `SEANCE_POLL_CREATE`, `EVENT_UPDATE`); refusal tests per route.
- JDR poll creation writes duration, poll and `Seance.pollId` in one transaction (8.7 non-atomicity lifted); the "already linked" guard is re-read under the locks.
- `poll/` reads/writes `Seance` only through `RendezVousDurationPort` (declared in `poll/ports/`, bound in `PortsModule` to `EventsService`, listed in `layer-imports.spec.ts`). `setDurationInTx` delegates to the existing `EventsService.setSeanceDurationInTx`, which now accepts an undated open-poll seance on this path only (the practical-info editor and the event window keep refusing it).
- `durationSlots` required at the root of `SessionPollDto`, `EventPollDto`, `OpenPoll` (poll without seance = 1, read by `durationsOf`).
- Composer: duration row always initialised to the target's `Seance.durationSlots` (draft's value for `group-new`); the range is written from the earliest designated start. Tapping a designated start removes it; tapping any other band, even covered, adds a start (current toggle by `date|slot`, unchanged). Duration > 1: "Journée" leaves the selection bar, already designated `FULL_DAY` cells are removed with a written message, and in Month a tap on a whole-day cell switches to Week on that day without adding anything.
- Loss warning: one pure function in `features/calendar/` counts **all** answers when the duration differs from the target's, else those of removed options; used for the dialog and the pre-write recheck, JDR and group alike. Text: « Changer la durée efface les {n} réponses déjà données. »
- Each poll option feeds one agenda entry carrying start and end (`spanEnd` with the poll's `durationSlots`), so the 47.3 projection draws candidate spans; one-slot options are unchanged.
- French comments/texts; new neutral words go to `DURATION_TEXT` (47.1 decision); no dependency install; Docker only; real-time unchanged (`partie:{id}` + `notifyChanged` already emitted by every write).

**Never:**
- No "×n" overlap badge, per-span vote picker, worst-availability aggregate, fix-date change (47.5); no automaton `?span` (47.6).
- No new tint; no second covering rule outside `day-detail.utils.ts` / `spanSlots`.
- No duration stepper enabled in the event window or seance editor under an open poll (stays read-only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keep duration | `PUT …/options` without `durationSlots`, poll of 3 slots with answers | duration stays 3, kept options keep answers | N/A |
| Change duration | same poll, `durationSlots: 6`, same options | options recreated, 0 answers, `relanceSentAt` null, `SessionPollDto.durationSlots` 6 | N/A |
| Concurrent | two `PUT` 1→3 at once | one purge only; second reconciles | N/A |
| Full day | option `FULL_DAY` with duration 3 | nothing written | 400 French |
| Atomic create | `POST …/poll` `durationSlots: 6`, poll creation fails | seance duration unchanged, no pollId | error propagated |
| Group | composer on open conjunction poll, duration 1→2 | `PATCH` purges and recreates options | N/A |
| Preview | duration 6, tap Fri evening | Fri evening start + Sat ×3 + Sun morning/afternoon lit as preview; stepper "ven. … soir → dim. … après-midi" | N/A |
| Day cell | duration 2, Month, tap whole day | view switches to Week on that day, nothing added | N/A |
| Warning | duration changed, 4 answers | dialog says 4 answers lost | recheck refuses if count grew |

</frozen-after-approval>

## Code Map

- `apps/api/src/poll/poll.service.ts` -- `setOptions` (:532, tx body :573), `updateInTx` (:177, group), `create` (:101), `createInTx` (:139), `planOptions` (:693), `toDto` (:713). `setOptionsInTx` replaces both tx bodies; deadline "changed" compared by day (both current callers are end-of-day), changed → write + `relanceSentAt: null`; past new deadline → `POLL_DEADLINE_PAST_MESSAGE`.
- `apps/api/src/poll/dto/set-poll-options.dto.ts`, `apps/api/src/scenarios/dto/create-seance-poll.dto.ts` -- optional `durationSlots` (`@IsInt @Min(1) @Max(MAX_SLOT_WINDOW_SLOTS)`).
- New `apps/api/src/poll/ports/rendez-vous-duration.port.ts` -- `setDurationInTx(tx, pollId, n?)` (locks; `n` absent = lock only, `{changed:false}`; 404 if no seance), `durationsOf(pollIds)`; pattern `seance-date.port.ts`. Bind in `ports/ports.module.ts`; add to `ports/layer-imports.spec.ts:131`.
- `apps/api/src/events/events.service.ts` -- `setSeanceDurationInTx` (:1373, open-poll refusal :1386 → option), `updateHosted` (:836; refusal :897 lifted for the group composer path, `updatePoll(tx, pollId, { purge })`), `createSeancePoll` (:1232, becomes one tx), `EventPollDto` builder (:720), `EventSeanceInput.updatePoll` (:82).
- `apps/api/src/events/group-events.service.ts:366` -- closures → `setOptionsInTx`.
- `apps/api/src/scenarios/scenarios.service.ts:712` (`createSeancePoll`), its `toSessionPollDto`; `apps/api/src/poll/my-open-polls.service.ts:135` (hard-coded `durationSlots: 1`).
- `packages/shared/src/index.ts` -- `SessionPollDto` (:1521), `EventPollDto` (:942), `SetPollOptionsDto` (:1586), `CreateSeancePollDto` (:793).
- Web `features/calendar/calendar-view/calendar-view.ts` -- `armTarget` (:2316), `onComposeToggled` (:2401), `onComposeAdded` (:2426), `composeAllowsFullDay` (:2421), `confirmCompose` (:2508, warning :2531-2576), `startGroupComposeNew` (:2653), `confirmGroupNew` (:2679), `confirmEveningPoll` (:2692), `confirmGroupPoll` (:2732), option entries (:802, :838, personal :980), `spanEndOf` (:265); template `app-compose-bar` (calendar-view.html:388).
- `features/calendar/compose-bar/compose-bar.{ts,html,scss}` -- add the Durée row (`app-duration-stepper`, `shared/duration-stepper/`).
- `features/calendar/compose-confirm-dialog/compose-confirm-dialog.ts` -- `durationChanged` variant of the text.
- `features/calendar/calendar-month-view/*`, `calendar-week-view/*` -- `composedKeys`/`isBandComposed`/`isCellComposed`, `.preview` styles (month scss:222, week scss:178), `composeFullDay`; add span-cover input + hover.
- `features/events/conjonction-draft.service.ts`, `event-form/event-form.ts` (`snapshot`/`restore`, :245-264) -- draft `durationSlots` both ways.
- `core/poll/poll.service.ts:128`, `core/scenarios/scenarios.service.ts:163` -- pass `durationSlots`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- DTO fields above
- [x] `poll/ports/rendez-vous-duration.port.ts` + `ports.module.ts` + `layer-imports.spec.ts` -- port, binding, listed
- [x] `events/events.service.ts` -- port implementation, open-poll option, atomic `createSeancePoll`, group duration change via purge, `EventPollDto.durationSlots`
- [x] `poll/poll.service.ts` + DTOs + `group-events.service.ts` + `scenarios.service.ts` + `my-open-polls.service.ts` -- `setOptionsInTx`, ordered tx, FULL_DAY refusal, DTO `durationSlots`
- [x] API tests -- unit (purge / no purge / absent keeps / FULL_DAY / 404 / atomic rollback / group), e2e (matrix rows 1-3, refusal tests), frozen DTO shapes updated
- [x] `features/calendar/compose-loss.utils.ts` + `compose-span.utils.ts` (+ specs) -- loss count; covered keys of starts via `spanSlots`
- [x] Compose bar, dialog, Month/Week views, `calendar-view` -- stepper, init, FULL_DAY removal + message, Month→Week, preview + hover, payloads (`durationSlots` only when changed), option entries with end, draft round trip
- [x] Web tests for every matrix row; ⚠️ flag changed validated screens (compose bar, selection bar, Month/Week composition, compose confirm dialog)

**Acceptance Criteria:**
- Given a one-slot target, when composing, then grid, payloads and existing tests are unchanged except the visible Durée row.
- Given API typecheck, unit, e2e and web tests, then all pass but the known date-frozen ones; `graphify update .` run.

## Implementation Notes

- Server: `RendezVousDurationPort` (`poll/ports/`, bound to `EventsService` in `PortsModule`, listed in `layer-imports.spec.ts`). `setDurationInTx` also returns the EFFECTIVE duration (re-read under the locks) — needed for the `FULL_DAY` guard and the served DTO; `changed` stays the only source of `purge`. A legacy poll without seance accepts an absent duration (locks the party only, duration 1) and refuses a given one (404), so `PUT …/options` keeps working on such polls.
- `PollService.setOptionsInTx` replaces `updateInTx` and the old `setOptions` tx body; the deadline is compared by day for both callers, and a changed deadline (or a purge) clears `relanceSentAt` for JDR too (it was group-only before).
- JDR creation: `PollService.create(grant, user, dto, persist?)` hands its write to `EventsService.createSeancePoll(grant, seance, durationSlots, write)`, which opens the one transaction (locks, re-read "already linked" guard, duration, poll, `Seance.pollId`). The early "already linked" refusal on the caller's read is kept (no transaction opened).
- Group: `updateHosted` writes a changed duration of an undated open poll (`setSeanceDurationInTx(…, { allowOpenPoll: true })`) then calls `updatePoll(tx, pollId, { purge })`. The practical-info editor still refuses (no option passed). Because the event window and the group composer share `PATCH …/events/:id`, the event window's refusal stays client-side (its stepper is read-only under an open poll, 47.1); the 47.1 e2e that expected a 400 on that PATCH now expects the write.
- Web: `compose-span.utils.ts` (`composeSpanKeys` via `spanSlots`, `earliestStart`) and `compose-loss.utils.ts` (`composeLoss`), each with a spec. `CalendarView` holds `composeDuration` / `composeTargetDuration`, arms them from the target (poll DTO, else seance; draft for `group-new`), sends `durationSlots` only when it differs, and uses `composeLoss` for the dialog and the pre-write recheck (JDR and group). Option entries carry `endDate/endSlot` via `spanEnd` (party and personal contexts). Neutral words in `DURATION_TEXT` (`lossMany/lossOne`, `fullDayRemoved`, `fullDayRefused`).
- Month/Week: new inputs `composeCoverKeys` + `composeDuration`; `.band--span-preview` / `.slot-cell--span-preview` (accent 22 % + 1.5 px dotted, DESIGN `preview`) on covered bands and on the hovered band's would-be span. A Month day rendered "uniform" unfolds into its three bands when a start or a covered slot touches it (duration > 1 only), otherwise a covered Saturday could not show.
- ⚠️ Validated screens changed: compose bar (new Durée row), selection bar during composition ("Journée" hidden when duration > 1), Month/Week composition (span preview, uniform-day unfolding, Month whole-day tap → Week), compose confirm dialog (duration-changed wording, note hidden).
- Not seen in a browser (preview colours, hover, unfolding unchecked visually).
- Tests: API unit (port, purge/no purge, absent keeps, FULL_DAY, 404, atomic create rollback, group purge) + new e2e `poll-duration.e2e-spec.ts` (matrix rows 1-3, full day, atomic create, refusals per route, group, `/me/open-polls`); web specs for every matrix row. API: all green but the known date-frozen `parties.service.spec` AD-9 test; web: all green but the 2 known date-frozen `calendar-view` tests. `graphify update .` run.

## Spec Change Log

## Review Triage Log

Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap). No intent_gap, no bad_spec, so no loopback. Patches sent to the implementation subagent.

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | `PATCH …/events/:id` now accepts a changed duration on an open poll from any caller, the event window included; the frozen text says the event window keeps refusing (BH) | low | rejected | Real but unavoidable: the group composer and the event window share the route and both send `pollOptions`, so the server cannot tell them apart. Only the host (`EVENT_UPDATE`) can do it, by crafting a request; the event window's stepper is read-only under an open poll (47.1). |
| 2 | `setOptionsInTx` does not check FULL_DAY against the duration (BH) | false | rejected | JDR goes through `setOptions` → `assertFullDayAlone`; the group DTO refuses `FULL_DAY`. No reachable path. |
| 3 | `setDurationInTx` reads the poll→seance link before the locks; a concurrent reset could write a duration onto a detached seance (BH) | false | rejected | A reset deletes the poll, so `setOptionsInTx` then 404s inside the same transaction, which rolls the duration back. |
| 4 | The concurrent-PUT e2e could pass with a double purge if A reads its response after B commits (BH) | low | rejected | The test is weaker than it looks, but the invariant (second writer sees the new duration under the lock → `changed:false`) is pinned by the port unit tests (lock order, same duration → nothing written). |
| 5 | A vote with an option id removed by a purge could 500 on an FK race (BH) | low | rejected | `castVote` 404s on a missing option; the read/delete race already existed for reconciled removals (36.10). |
| 6 | `composeTargetDuration` is not re-read before writing; a duration changed elsewhere while composing makes the payload/warning compare against a stale value (BH, EC) | low | rejected | Needs the same host to change the same seance's duration in another tab during composition; the fix adds a guard branch. |
| 7 | Month `onBandHover` previews a span from a past band, Week does not (BH, EC) | low | patch | Real; one-condition fix, twin of `onCellHover`. |
| 8 | Hover can unfold the next Month day and reflow the grid (BH) | low | rejected | The hovered cell keeps its place; only another cell's inner bands split. Cosmetic. |
| 9 | Preview is mouse-only (no keyboard/touch hover) (BH) | low | rejected | Designated starts light their span on every input mode (cover keys); the hover is the extra the UX names "au survol à la souris". |
| 10 | Back to 1 slot, the "journées retirées" message stays (BH, EC) | low | patch | Real; direct correction in `onComposeDurationChanged`. |
| 11 | `PollService.create` turns a missing `write` call into a 404 (BH) | low | rejected | Unreachable programming error; the only caller always writes once. |
| 12 | The "full day lasts one slot" and duration-bound texts are worded in several places (BH) | low | rejected | Layer rule: `poll/` cannot import `events/`; texts agree in substance. |
| 13 | JDR deadline change now clears `relanceSentAt` (BH, EC claim) | false | rejected | `relanceSentAt` is only read by the group relance job (`notifications.service.ts:299`); writing null on a JDR poll has no effect. Recorded in Implementation Notes. |
| 14 | On touch, the emulated `mouseenter` sticks after a tap, so an un-designated start keeps its span lit (EC) | medium | patch | Real: no `mouseleave` until another element is touched; switch to pointer events filtered on `pointerType === 'mouse'`. |
| 15 | Error order: invalid options now 400 before "déjà liée" (EC) | low | rejected | Both are 400s in French; the early "déjà liée" check on the caller read is kept anyway. |
| 16 | Existing one-slot tests were edited (extra `undefined` arg, narrowed selector) (EC claim) | low | rejected | Mechanical signature changes; the expectations on behaviour are unchanged. |
| 17 | Group-poll and personal-calendar option span ends untested (VG) | medium | patch | Pre-verified gap: every fixture at duration 1. |
| 18 | Web `createSeancePoll` body with `durationSlots` untested (VG) | medium | patch | Pre-verified gap. |
| 19 | Evening-poll duration arming and PATCH payload untested (VG) | medium | patch | Pre-verified gap. |
| 20 | JDR FULL_DAY refusal at duration > 1 via "Ajouter au vote" / Week tap untested (VG) | low | patch | Pre-verified gap; two test cases. |

## Design Notes

Preview: designated starts keep `band--composed` (dashed); the other bands of their spans and, on mouse hover over a band, that band's would-be span get the existing `.preview` look (accent 22 % + dotted), via one pure helper returning covered `date|slot` keys (`spanSlots`, `FULL_DAY` only at 1). Voting from a covered candidate band targets the option that covers it (47.5 adds the per-span picker).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- pass but known date-frozen
- `docker compose exec web pnpm test` -- pass but the 2 known date-frozen `calendar-view` tests

**Manual checks (if no CLI):**
- UJ-5 composer part: duration 6, three Fridays evening, preview shows each weekend, validate, Destinée shows spans.
