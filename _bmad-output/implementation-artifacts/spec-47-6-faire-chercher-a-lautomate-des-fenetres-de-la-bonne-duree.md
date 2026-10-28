---
title: "Faire chercher à l'automate des fenêtres de la bonne durée (story 47.6)"
type: 'feature'
created: '2026-10-28'
status: 'done'
baseline_commit: '037edb41aa6c5daf93431ad6dcdc44f92ea76164'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-47-4-proposer-des-plages-dans-le-composer.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The automaton only serves one-slot windows (`durationSlots` hard-coded to 1), so an organiser composing a 2-slot or weekend rendez-vous gets windows where the troupe is free on the first slot only.

**Approach:** `GET /parties/:id/available-slots?span=N` serves windows of N consecutive slots ranked on each member's worst status over the span; the column asks with the composer's current duration (1 outside it), writes each window as a range, and only adds a window to a vote of the same duration.

## Boundaries & Constraints

**Always:**
- `span` optional integer 1..45 (`MAX_SLOT_WINDOW_SLOTS`), default 1, 400 in French otherwise; no new route, no new right (same `PARTIE_AVAILABILITY_READ`). Every start (`date`, `slot`) of the range is a window start; its slots are `spanSlots(start, N)` (may run past `to`). Member status = worst over the span (`UNAVAILABLE` > `UNKNOWN` > `AVAILABLE`); the MJ-unavailable hard exclusion, the 4-level priority, the tie rules and the cap of 20 are unchanged and applied to those worst statuses. Compute each slot status once per member and look windows up (no recomputation per window). Each served window carries `durationSlots = N`.
- Exclusion of already-proposed windows (MJ nominative view) and hiding compare **start and duration**: open-poll option keys become `date|slot|durationSlots` (durations via `RendezVousDurationPort.durationsOf`, a poll without seance = 1); the hidden key uses the window's own `durationSlots` (today `|1`). The aggregated players' view takes `span` too (worst-status counts) but keeps its shape and its no-exclusion rule.
- Web: the column requests `span` = `composeDuration()` while composing, 1 otherwise; it reloads when that value changes (stale responses dropped by a request id). Each MJ card with `durationSlots` > 1 shows its range in one line (« sam. après-midi → sam. soir », via the `span-label` helpers); one-slot cards unchanged; the players' aggregated card unchanged.
- A window is added to a composition only if `window.durationSlots === composeDuration()`. Outside the composer, a window picked for a rendez-vous of another duration opens the composer at the rendez-vous's duration **without** the window; the list reloads at that duration and `composeRefusal` says « Cette fenêtre ne dure pas {n} créneaux : elle n'a pas été ajoutée. » (neutral words in `DURATION_TEXT`).
- French comments/texts; one-slot behaviour and existing tests unchanged; no dependency install; Docker only; real-time unchanged.

**Never:**
- No change to the composer's cells, duration writes, votes, or the picker/board (47.4–47.5); no new window states; no availability figure on cards.
- No second worst-status rule in the web: the server alone ranks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Span 2 | member busy only on Sat evening, `span=2` | window starting Sat afternoon ranks as "has a refusal"; Fri evening → Sat morning stays all-free | N/A |
| MJ busy mid-span | MJ UNAVAILABLE on 2nd slot | window excluded | N/A |
| Default | no `span` | identical output to today, `durationSlots: 1` | N/A |
| Bounds | `span=0`, `span=46`, `span=x` | nothing served | 400 French |
| Exclusion | open poll of duration 2 with option Sat afternoon | `span=2`: that window removed; `span=1`: Sat afternoon window still served | N/A |
| Hiding | window hidden at duration 2 | hidden only at duration 2 | N/A |
| Players | player asks `span=3` | aggregated rows, worst-status counts, no exclusion | N/A |
| Add, same duration | composer at 2, 2-slot window | added as a start | N/A |
| Add, other duration | list at 1, rendez-vous of 3, "Ajouter au vote" | composer opens at 3 without the window; list reloads at 3; message shown | N/A |
| Stepper | composer 1 → 2 | column reloads with `span=2`, cards show ranges | stale response ignored |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts:1519` `getAvailableSlots` (two near-identical slot loops with `durationSlots: 1` :1570/:1594; priority :1608; exclusion :1636; hidden `|1` :1645; cap :1646/:1653); `parties.controller.ts:62`; `dto/get-available-slots.dto.ts` (add `span`); `availability.service.ts` `computeSlotStatus` (:857, reuse).
- `apps/api/src/poll/poll-vote-cleanup.service.ts:52` `openOptionKeys` (inject `RENDEZ_VOUS_DURATION_PORT`, 47.4; key with duration); `parties/` stays free of poll tables.
- `packages/shared/src/index.ts` `spanSlots` (:1076), `AvailableSlotDto.durationSlots` (:1363), `MAX_SLOT_WINDOW_SLOTS` (:1372).
- Web `core/poll/poll.service.ts:20` `getAvailableSlots` (add `span`); `calendar-view.ts` `loadAvailableSlots` (:4146), `refreshMjPanels` (:4053), `selectedWindow` (:1435, carry `durationSlots`), `addSelectedWindow` (:2408), `addWindowCell` (:2433), `pendingWindow` (:2248) / `pickRendezvous` (:2380), `composeDuration`/`armDuration` (47.4), `composeRefusal`; `displayedWindows` (`window-list.utils.ts`, key `date|slot` still enough at one duration).
- `available-slots/available-slots.ts` (`availableSlotKey`), `creneau-card/creneau-card.{ts,html}` (:13-14 date and slot lines → one range line when `durationSlots` > 1), `calendar/span-label.ts` (`candidateSpanShort`), `shared/duration-stepper/duration-labels.ts` (`DURATION_TEXT`).
- Reuse, do not change: priority/tie rules, `SlotWindowKeyBody`, hide routes, `bestOption`.

## Tasks & Acceptance

**Execution:**
- [x] `parties/dto/get-available-slots.dto.ts` + controller -- `span` param, bounds, French 400
- [x] `parties/parties.service.ts` + `poll/poll-vote-cleanup.service.ts` -- windows of N slots on worst status, precomputed slot grid, duration-aware exclusion and hiding
- [x] API tests -- unit (matrix rows Span 2, MJ busy, Default, Exclusion, Hiding, Players, Bounds) and e2e (`span` over HTTP: window ranks, `durationSlots`, 400s, player view)
- [x] `core/poll/poll.service.ts` + `calendar-view.ts` -- `span` request, reload on duration change with request id, same-duration add rule, message, composer at the rendez-vous's duration
- [x] `creneau-card` (+ panel) -- range line; ⚠️ flag changed validated screens (automaton list cards, composer "Ajouter au vote" flow)
- [x] Web specs for every matrix row

**Acceptance Criteria:**
- Given a one-slot composition or no composer, when the list loads, then requests, rows and tests equal today's except the explicit `span`.
- Given API typecheck, unit, e2e and web tests, then all pass but the known date-frozen ones; `graphify update .` run.

## Design Notes

UJ-6 server side: with `span=2` on an afternoon+evening duration, a member refusing the evening alone makes the afternoon window a "refusal" window and the free ones rise; the list reloads when the stepper moves.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- pass but known date-frozen
- `docker compose exec web pnpm test` -- pass but the 2 known date-frozen `calendar-view` tests

**Manual checks (if no CLI):**
- UJ-6: set the duration to afternoon+evening, the list recomputes as ranges, add three windows, validate.

## Implementation Notes

- Server: `GET …/available-slots?span=N` (DTO 1..45 integer, French 400, default 1). Every start of the range is a window start; statuses are computed once per member per slot and each window takes the worst over `spanSlots` (UNAVAILABLE > UNKNOWN > AVAILABLE); the MJ hard exclusion, 4-level priority, tie rules and cap of 20 apply to those worst statuses. `openOptionKeys` returns `date|slot|durationSlots` (durations through `RendezVousDurationPort.durationsOf`); the hidden key uses the window's own duration. The players' view takes `span` and keeps its shape.
- Web: `slotsSpan` = composer duration while composing, else 1; an effect reloads the list when it changes, a request id drops stale answers (the panel hides the list while loading). A window is added only when its duration equals `composeDuration()`, otherwise `composeRefusal` gets « Cette fenêtre ne dure pas {n} créneaux : elle n'a pas été ajoutée. » (`DURATION_TEXT`). Cards with `durationSlots` > 1 show one range line (`candidateSpanShort`, so it includes the day number and month).
- ⚠️ Validated screens changed: automaton list cards (range line), "Ajouter au vote" flow (refusal message, reload on stepper change).
- Not seen in a browser (range line styling, reload on stepper change, UJ-6 walkthrough). SSE: the reload is local (composer duration) plus the existing `refreshMjPanels` paths; no new domain signal.

## Spec Change Log

## Review Triage Log

Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap: no gap). No intent_gap, no bad_spec, so no loopback.

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | A failed reload is never retried (`slotsSpanAsked` set before the request) and the list keeps the old span (BH, EC) | low | rejected | Same behaviour as before this story (a failed load kept the old list and showed the error); the next `refreshMjPanels` retries. |
| 2 | Stale cards stay selectable while the list reloads (BH, EC) | false | rejected | `available-slots.html` shows the list only when `!loading()`; the add rule also refuses a mismatched duration with a message. |
| 3 | Client sends `span=NaN` on a bad value (EC) | false | rejected | The only source is `composeDuration()` (integer 1..45 from the stepper). |
| 4 | Span check happens after permission/declaration reads when the DTO is bypassed (EC) | low | rejected | The DTO is the gate for every HTTP call; the service check is a safety net for direct calls only. |
| 5 | `openOptionKeys` reads options and durations in two non-transactional reads (BH, EC) | low | patch | Real but harmless (worst case: one window not excluded); documented in the method comment. |
| 6 | Only the start cell of a selected multi-slot window is highlighted on the grid (EC) | low | rejected | Not in the spec; showing the span of a selected window would be a new grid state. |
| 7 | Card text longer than the spec example (month and day number) (EC claim) | low | rejected | `candidateSpanShort` is the label every other surface uses; one wrapping line. |
| 8 | Windows near the range end are classified on slots beyond `to` (BH) | false | rejected | The window really covers those slots; the spec says it may run past `to`. |
| 9 | Span message duplicated between DTO and service (BH) | low | patch | Direct fix: the service reuses `SPAN_MESSAGE`. |
| 10 | Card controls have no range in an accessible name (BH) | false | rejected | The controls are text buttons inside the card whose header carries the range; no control names the start alone. |
| 11 | URL built by concatenation; positional parameters (BH) | low | rejected | Matches the existing method; covered by the new `poll.service` specs. |
| 12 | No server tests at span > 1 for the cap, `weeks` branch, ordering over many (BH) | low | rejected | The verification-gap layer, which reads the tests, found none missing; the cap and ordering code is unchanged. |
| 13 | Allocation cost of the worst-status fold at span 45 (BH) | low | rejected | Bounded by 366 days × 3 slots × 45 × members, a few hundred thousand tiny operations; no measured problem. |
| 14 | Two near-duplicate refusal strings in `DURATION_TEXT` (BH) | low | rejected | Singular/plural wording; no defect. |
| 15 | No docs/backlog or checklist update, no SSE review (BH) | false | rejected | SSE reviewed: nothing new scoped to a Partie; docs are updated at the end of the palier. |
