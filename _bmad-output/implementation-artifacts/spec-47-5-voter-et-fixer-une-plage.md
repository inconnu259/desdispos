---
title: 'Voter et fixer une plage (story 47.5)'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '16d9f853dc69aaa54db5087c86b5de09d3e90bed'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-47-4-proposer-des-plages-dans-le-composer.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/mockups/options-plages-longues.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 47.4 a vote can propose spans, but its candidate slots still read as one slot everywhere (board, drawer, scenario sheet, fix-date confirmation), two spans of one vote covering the same slot hide each other, the answer picker names no span, the Destinée dims the days a span covers, and fixing a date reads the vote and option outside any lock.

**Approach:** Write every candidate from start to end, count overlapping spans on a band ("×n") and let the answer picker offer one line per span covering the slot. Show the worst availability of a long candidate on the board. Make fixing a date take the 47.4 lock and re-read poll and option in its transaction (JDR as for a rally).

## Boundaries & Constraints

**Always:**
- Covered candidate bands keep the existing vote marking (47.3 projection); no new tint. `day-detail.utils.ts` stays the single projection: it exposes **all** votes covering a slot (`pollVotes`, one per option, start order, each with its range label) and their count; `pollVote` (first) keeps its meaning, so one-slot output is unchanged.
- "×{n}" (9 px, `{colors.text}`, top-right corner of the Month band / Week cell) only when n ≥ 2; it joins the band's accessible name. Neutral word, kept in `DURATION_TEXT` (47.1 decision).
- Touching a covered vote slot opens the answer picker with **one line per span covering it** (label « ven. 6 soir → dim. 8 après-midi », the current option first = the Destinée's current slot, else chronological), each with the three answers and withdraw; voting always names the option explicitly. One covering span: picker unchanged.
- Board, folded drawer, scenario-sheet vote list (status and response panels, choose-confirm text) and fix-date confirmations (`SealConfirmDialog` slots mode, `DateFixDialog`, Agenda seal) write each candidate start → end when `durationSlots` > 1; one-slot text unchanged. Folded drawer: « n / N · {départ} → {fin} · x oui · fin du vote … ». `aria-live`: « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui ».
- Destinée: days covered by a candidate span are not dimmed (`destinyDates` derives covered days with `spanSlots`).
- Worst availability of a long candidate: **one** pure function in `features/calendar/` (min `available` over `spanSlots` from the loaded heat map; a missing cell → no figure). The board shows « {n} dispos sur toute la plage » on cards of duration > 1, JDR with the heat map loaded; nothing otherwise. ⚠️ new text on a validated screen.
- Fixing a date (JDR and rally): lock party → event (`RendezVousDurationPort.setDurationInTx(tx, pollId)`, duration absent = lock only), then re-read poll (open, of the party) and option in the same transaction; a vanished option → 404 « Option introuvable », nothing written. `chooseDate` (signature unchanged) already writes `end = spanEnd(start, durationSlots)`; the date is written from the re-read option.
- French comments/texts; existing one-slot tests keep their expectations; every right checked server-side (no new route); no dependency install; Docker only; real-time unchanged.

**Never:**
- No change to the composer, duration writes, automaton (`?span`, 47.6), vote DTO shapes, or `bestOption`.
- No second covering/ranking rule outside `day-detail.utils.ts`, `bestOption`, `spanSlots`.
- No availability shown on single-slot candidates or in the group (rally) calendar.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Overlap | duration 3, starts Sat morning and Sat afternoon in one vote | Sat afternoon band shows « ×2 », name lists both | N/A |
| Picker | tap that band | picker with 2 lines, current first, each with answers | N/A |
| One span | tap a slot covered once | picker as today | N/A |
| Board | vote duration 6, option Fri evening | « ven. 6 nov. soir → dim. 8 nov. après-midi »; announce « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui » | N/A |
| Fix JDR | fix 2nd of 3 weekends | seance start/end = span, poll closed, members unavailable on each covered slot | N/A |
| Vanished option | option purged (duration changed) before fixing | nothing written | 404 (JDR and rally) |
| Concurrent | fix and duration change at once | serialized by the lock; fix reads fresh option | N/A |
| Worst availability | 6-slot candidate, heat map `available` 5,2,4,… | « 2 dispos sur toute la plage » | no figure if a cell is missing |
| Destinée | current poll has spans | covered days are not dimmed | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/poll/poll.service.ts:452` `choose` (JDR branch :465-489 reads poll/option outside any lock), `chooseGroupDate` :506 (already locks via `groupVotes.lockConjonction`, rereads option). JDR branch → one tx: `this.duration.setDurationInTx(tx, pollId)` → reread poll → reread option → close + `seanceDate.chooseDate`. `events.service.ts:1318` `chooseDate` (unchanged).
- Web projection: `features/calendar/day-detail.utils.ts` (`buildDayDetail` :288, `pollMatches` :316 only `[0]` kept, `pollLabel` :374, `pollVote` :381, `DaySlotDetail` :65, `spanOf` :218), `poll-track.utils.ts` (`VoteParticipation` :25, `VoteOptionActivatedEvent` :63).
- Badge/aria: `calendar-month-view/*` (`DayBand` ~:90, `buildMonth` :215-240, `voteAt` ~:683, html :182), `calendar-week-view/*` (`eventVote` ~:768, `voteAt` ~:662, html :142), rail `calendar-detail-rail.ts:~198`, Agenda unchanged (one line per option).
- Picker: `calendar-view.ts` `onVoteOptionActivated` :3756, `pickerVote/pickerLabel`, `onVoteAnswerChosen` :3801, `onVoteWithdrawn` :3813; `vote-answer-picker/vote-answer-picker.ts:51` (inputs `vote`, `slotLabel`; keep ARIA menu, focus return, Escape).
- Board/drawer: `calendar-view.ts` `destinyBoard` :1606 (label :1637, announce :1650), `destinySheet` :1679 (folded summary :1688), `destinySlots` :1399, `destinyDates` :1223, `openDestinyFix` :1792 (`rankedEntrySlots`); `destiny-board/destiny-board.ts` (`DestinyBoardSlot`), `destiny-sheet`.
- Labels: `events/event-card.util.ts` (`pollSlotLabel` :416, `rankedPollSlots` :655, `rankedEntrySlots` :692), `calendar/span-label.ts` (`spanShortLabel`, `spanSentence`, `isSpan`), `seal-confirm-dialog`, `events/date-fix-dialog`, `calendar-agenda-view.ts:~620` (`optionLabel`), `poll/poll-status/*`, `poll/poll-response/*`, `scenarios/seance-list/seance-list.html`.
- Availability: `heatmap` signal (`calendar-view.ts:634`, `AggregatedSlotDto`), `calendar/group-availability.utils.ts`; new pure `worstAvailability` beside it, using `spanSlots` (`@master-jdr/shared`).
- Reuse, do not change: `SLOT_PRECEDENCE`, the `group` channel, `bandsAreUniform`, `bestOption`, `answerLabel` vocabulary.

## Tasks & Acceptance

**Execution:**
- [x] `poll/poll.service.ts` -- JDR `choose` in one locked transaction, option reread, 404 -- AD-11
- [x] API tests -- unit (lock order, vanished option 404 JDR and rally, span written from reread option) and e2e (fix 2nd of 3 weekends: span, members unavailable on each slot, concurrent change)
- [x] `day-detail.utils.ts` + month/week/rail -- `pollVotes`/count, "×n", aria; specs incl. matrix rows
- [x] picker + `calendar-view` -- one line per span, current first, explicit option; specs
- [x] board, drawer, announcement, `destinyDates` -- span labels, no dimming of covered days
- [x] labels in sheet vote list, choose-confirm, `SealConfirmDialog`, `DateFixDialog`, Agenda seal -- start → end
- [x] `worstAvailability` + board line; specs; ⚠️ flag changed validated screens (Month/Week band, answer picker, board, drawer, scenario sheet, fix-date confirmations)

**Acceptance Criteria:**
- Given one-slot votes, when any view draws them, then output and tests equal today's.
- Given API typecheck, unit, e2e and web tests, then all pass but the known date-frozen ones; `graphify update .` run.

## Design Notes

Picker lines are built from `pollVotes` of the touched cell (no re-filtering in views). "Current" = the option whose id is `destinyOptionId()`, if it covers the cell. UJ-5 server side: fixing the 2nd weekend writes `end = spanEnd`, `reminderSentAt` null, so the reminder (47.2) leaves the Thursday.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- pass but known date-frozen
- `docker compose exec web pnpm test` -- pass but the 2 known date-frozen `calendar-view` tests

**Manual checks (if no CLI):**
- UJ-5: three weekends proposed, overlap ×n, vote from a covered slot, board/drawer written as spans, fix the second.

## Implementation Notes

- Server: JDR `PollService.choose` runs in one transaction: `RendezVousDurationPort.setDurationInTx(tx, pollId)` (no duration = locks only) → reread poll (open, of the party) → reread option (404) → close + `SeanceDatePort.chooseDate`. The rally path already locked and reread (`lockConjonction`) and is unchanged. No new route, no new right.
- Web: `day-detail.utils.ts` stays the single projection: `DaySlotDetail.pollVotes` / `pollCount` (options of the same vote covering the slot, start order), `entryCoveredDays` (via `spanSlots`) feeds `destinyDates`. "×n" and the picker lines come from it; `VoteOptionActivatedEvent.lines` carries them; the picker shows one group per span from 2 lines. Span words (×n, availability line, announcement) live in `DURATION_TEXT`; board/drawer/sheet/fix-date labels use `candidateSpanShort`/`pollSlotLabel(…, durationSlots)`. `worstAvailability` is in `group-availability.utils.ts`; the board line shows for JDR, duration > 1, heat map loaded.
- ⚠️ Validated screens changed: Month band and Week cell ("×n"), answer picker, destiny board (span labels, availability line), folded drawer and announcement, scenario-sheet vote panels, fix-date confirmations (SealConfirmDialog, DateFixDialog, Agenda seal).
- Not seen in a browser (×n corner, picker groups, board line unchecked visually).

## Spec Change Log

## Review Triage Log

Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap). No intent_gap, no bad_spec, so no loopback. Patches sent to the implementation subagent.

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | JDR `choose` locks the party/event of any `pollId` before checking it belongs to the caller's party; an MJ could hold FOR UPDATE on another party's rows until the 404 rolls back (BH, EC) | medium | patch | Real: `setDurationInTx` locks by poll id first. Read the poll's party inside the transaction and 404 before locking. |
| 2 | Error order changed: a closed poll now takes the locks before the 400 (EC) | low | rejected | Same transaction rereads status under the lock (needed for the race); both errors stay 4xx in French. |
| 3 | `pollCount` counts entries while `pollVotes` drops entries without a vote (EC, BH) | low | patch | Unreachable today (every vote entry carries `vote`) but one-line fix: count the filtered list. |
| 4 | `coveringVotes` groups by the first match's poll when it has no `vote` (EC) | false | rejected | Entries of type `votes-en-cours` are only built with a `vote`. |
| 5 | `pollVote` (input order) may differ from `pollVotes[0]` (earliest start) (EC) | low | rejected | Cosmetic; the picker orders its lines itself and the fix would change `pollVote`'s meaning. |
| 6 | "×n" never announced when the band has no name (EC) | false | rejected | A vote band always carries `span.label`, so `named` is set whenever overlap ≥ 2. |
| 7 | `spanEnd`/`spanSlots` unguarded on a malformed date (BH, EC) | low | rejected | Dates come from the server as ISO strings and are sliced to the day; adding guards is more than a correction. |
| 8 | Picker snapshot stale / closes after each answer (BH, EC) | low | rejected | `writeVote` closes the picker and reloads; the snapshot is never reused. Reopening per span is the chosen gesture. |
| 9 | Seal text built by filling `slot: ''` and stripping " — " depends on the themes' separator (BH, EC, VG) | low | patch | Real fragility; a new key per theme is heavier than needed — a spec pins the " — " separator of the three real themes so a change fails loud. |
| 10 | New words bypass the tone registry (BH) | low | rejected | 47.1 decision recorded: neutral words live in `DURATION_TEXT`. |
| 11 | Creation window chips still write one slot (`event-form.ts`) (BH) | low | patch | Direct fix: pass `durationSlots()` to `pollSlotLabel`. |
| 12 | Dead fields `rangeShort`/`startIndex`/`rangeSentence` (BH) | low | rejected | Asserted by specs and meant for aria; no defect. |
| 13 | "×n" size/contrast/position (BH) | false | rejected | 9 px is the DESIGN token; `.band` is `position: relative` (month scss:211). |
| 14 | No "×n" in the rail or Agenda (BH) | low | rejected | The spec puts the badge on Month/Week; the rail picker gets `lines`. |
| 15 | Concurrency e2e accepts either order (BH, VG) | low | rejected | The unit test pins lock → reread poll → reread option → close → date. |
| 16 | `worstAvailability` silent outside the loaded window (BH) | false | rejected | Spec: no figure when a cell is missing. |
| 17 | Rally vanished-option 404 has no unit test (EC claim) | low | patch | The task list names it; e2e covers it. Add the unit case. |
| 18 | Closed vote with a range in the scenario list untested (VG) | medium | patch | Pre-verified gap (MJ and player branches). |
| 19 | `pollPanel` best line and `pollSlotRows` untested with a range (VG) | medium | patch | Pre-verified gap. |
| 20 | Month/Week `sealCandidate` label untested with a range (VG) | medium | patch | Pre-verified gap. |
| 21 | `any` casts and shadowed `d` in new specs (BH) | low | rejected | Matches the surrounding specs. |
