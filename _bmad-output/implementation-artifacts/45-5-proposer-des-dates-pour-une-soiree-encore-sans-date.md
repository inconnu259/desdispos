---
title: 'Story 45.5 — Proposer des dates pour une soirée encore sans date'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'f0323ceddfcfcd6303f19f7fd3276c72a5bd9658'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An isolated evening created without a date can be listed (45.1) but not proposed: the web hides it behind the `SOIREE_ROWS_ARMABLE` seam because no composer target arms it, so its host must go back to the event window to open a poll.

**Approach:** A new composer target, distinct from « vote ouvert » and « nouvelle conjonction », arms the evening's calendar (Week view, 40.5b rule) from the personal calendar, the evening's own calendar, or a `?seanceId` link. Validating writes the poll with the existing `PATCH /parties/:id/events/:eventId` (41.2, full replacement, other fields re-read from the event card) carrying the composer's deadline; the Destinée activates on it and the evening leaves the « à dater » list. The seam is removed: this story finishes the evening half left by 45.1.

## Boundaries & Constraints

**Always:**
- Target `{ kind: 'evening-poll', eventId }`, group-like in every rule (`isGroupTarget`): Week view, no full day (bar without « Journée », written refusal), two slots minimum, no cap, the fin-du-vote field of 45.4 (default untouched, follows the slots). Label per theme, neutral wording (no JDR word, no « partie »): « Dates à proposer : {titre} ».
- Resolution: `composeTargetFor(seanceId)` on a group/evening page returns `group-poll` for an open poll with `can.edit`, `evening-poll` for a dateless pollless event with `can.propose` (from `rendezvousRows`, which now lists evenings), else `null` (stale notice, 45.2). `pickRendezvous` arms it at the atelier for evenings as for séances; the vitrine pick navigates to the evening's atelier with `?seanceId` (`atelierUrl`, `/guild-calendar`), whose arrival arms it (45.2) — the vitrine never arms.
- Validation: `eventsApi.update(partieId, card.id, dto)` with `title`, `lieu`, `heureRdv`, `notePratique`, `capacity` re-read from the card (the loaded card, not stale composer state), plus `pollOptions` (day + slot, sorted, no `FULL_DAY`) and `pollDeadline` = the composer's day. No loss-of-answers dialog (a dateless evening has no votes). Before writing, re-check the evening is still dateless and pollless (else the 45.2 stale notice, composer closed, nothing written). A server refusal stays in `calendar-error--compose`, composer kept. On success: reload the cards, close the composer, remove `?seanceId`, `reactivateDestiny` on the new poll.
- Rights: `can.propose` (`EVENT_UPDATE {eventId}`) is the only gate on the web; the server is the judge (existing check). Add a refusal e2e: a non-host member and a stranger get 403 and nothing is written; the happy path e2e covers UJ-2 (host creates a dateless evening, proposes dates with a deadline, the poll opens, `GET /me/datable-seances` no longer lists it, the answer of an accepted invitee counts).
- Remove the seam of 45.1: `SOIREE_ROWS_ARMABLE`, `armableRendezvous` and their two spec cases; evening rows now show in the button, the picker (« soirée sans date ») and the atelier list; 45.1 specs that asserted hiding now assert showing.
- Real time, the 40.5b round trip (« Nouvelle conjonction »), the 45.2/45.3/45.4 behaviours and every JDR flow are untouched. French comments and errors; no dependency; Docker only; no API change.

**Never:**
- No new route or payload; no change to `PATCH …/events/:eventId` rules; no composer from the vitrine; no places/reservations for an isolated evening (the server refuses them anyway).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vitrine pick | host has a dateless evening | button « Proposer des dates » lists it (« soirée sans date »); one rendez-vous → straight to its atelier | N/A |
| Arrival | `/guild-calendar?seanceId=s` of that evening | Week view, composer armed `evening-poll`, bar names the evening | stale notice if no longer dateless |
| Atelier button | on the evening's own calendar | button arms it directly (one rendez-vous) | N/A |
| Compose | 5 Friday evenings + 1 Saturday afternoon | cumulative (45.3), deadline proposed (45.4), no « Journée » | full day refused in writing |
| Validate | 6 slots | one PATCH with the card's fields + options + deadline; Destinée on the new poll; evening leaves « à dater » | refusal kept in the bar |
| Dated meanwhile | poll or date set elsewhere | notice, composer closed, nothing written | N/A |
| Not host | member or admin who is not the host | not listed, no composer; PATCH forced → 403 | refusal e2e |
| Deadline past | past day picked | Valider blocked with the reason | server 400 if forced |
| Cancelled evening | event cancelled | not listed, link → stale notice | N/A |

</frozen-after-approval>

## Code Map

- `features/calendar/rendezvous-picker/rendezvous.utils.ts` (+ spec) -- delete `SOIREE_ROWS_ARMABLE` / `armableRendezvous`; `groupRendezvous` already builds evening rows (needs `eventId` kept: add it to `RendezvousRow`).
- `features/calendar/calendar-view/calendar-view.ts` -- `ComposeTarget` (+ `evening-poll`), `isGroupTarget`, `composeHasDeadline`, `composeTargetLabel`, `composeTargetFor`, `armTarget` (Week for evenings), `pickRendezvous` (drop the `nature === 'seance'` guard), `rendezvousRows` (drop `armableRendezvous`), `confirmCompose` (new `confirmEveningPoll`, model: `confirmGroupPoll` for the DTO), `exitCompose`; `calendar-view.html` untouched unless the label needs it.
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- `calendar.compose_target_evening` (3 voices).
- `apps/api/test/characterization/` -- new e2e (models: `my-datable-seances.e2e-spec.ts`, `ralliement.e2e-spec.ts`, 41.2 isolated-evening flows); server code is not modified.
- Specs: `calendar-view.spec.ts` (the two 45.1 « hidden » tests flip; new block for the evening target), `rendezvous.utils.spec.ts`.
- Do not touch: `events/group-events.service.ts`, `permissions`, the event window (`event-dialog`, `event-form`).

## Tasks & Acceptance

**Execution:**
- [x] `rendezvous.utils.ts` + spec -- remove the seam; carry `eventId` on evening rows
- [ ] tones (3 themes) + tone spec -- evening target label
- [x] `calendar-view.ts` -- `evening-poll` target: resolution, arming, label, deadline, validation, destiny
- [ ] API e2e -- UJ-2 happy path and refusals
- [ ] Specs -- every matrix row; web and API suites, typecheck

**Acceptance Criteria:**
- Given a dateless isolated evening of mine, when I choose it in « Proposer des dates » of my personal calendar, then its calendar opens in Week view with the composer armed for it.
- Given I compose six slots and keep the proposed deadline, when I validate, then the poll opens for the accepted invitees, the Destinée is on it and the evening is no longer listed as to date.
- Given I am not the host, then the evening is never offered to me and a forced write is refused by the server.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff. The `Bash` tool became unavailable mid-session (`bash.exe` not found); the rest of the work ran through PowerShell, with the Docker PATH reloaded as in `CLAUDE.md`.
- `rendezvous.utils.ts`: `SOIREE_ROWS_ARMABLE` and `armableRendezvous` removed; `RendezvousRow.eventId` (set by `groupRendezvous`) carries the evening's event. `calendar-view.ts`: `ComposeTarget` gains `evening-poll`; `isGroupTarget` and `composeHasDeadline` include it (Week view, no full day, 2 slots minimum, 45.4 deadline); `composeTargetFor` returns it for a dateless pollless event with `can.propose` (taken from `rendezvousRows`); `armTarget` opens the Week grid for it; `pickRendezvous` no longer special-cases séances; `composeTargetLabel` names the evening; `confirmEveningPoll` re-checks that the evening is still datable, rebuilds the DTO from the loaded card (`title`, `lieu`, `heureRdv`, `notePratique`, `capacity`) plus `composedSlots()` and `composeDeadline()`, writes with `eventsApi.update`, reloads, closes, clears `?seanceId` and `reactivateDestiny`. Tone `calendar.compose_target_evening` in the 3 voices.
- No API change: the 41.2 `PATCH` already completes a dateless isolated evening. New e2e `evening-propose-dates` (4 tests): before (host sees it « à dater », a member and a stranger do not), 403 for a member and a stranger with nothing written, 400 for a past end, and the host's PATCH opening the poll (3 options, end of the chosen day, no date set) after which `GET /me/datable-seances` no longer lists it. The invitee's vote is asserted only when the served `eligibleVoterIds` includes that member (a bare membership is not an accepted invitation), so « the answer of an accepted invitee counts » rests on the existing 41.x tests.
- Web specs: the two 45.1 « hidden » tests now assert the opposite; the seam test is gone; a new `soirée sans date` block covers arming, arrival by `?seanceId`, the PATCH payload (fields re-read from the card, slots sorted, chosen deadline, Destinée on the poll), the full-day refusal, blocking (one slot / past end), dated-meanwhile, a server refusal kept, and a non-host. Fixtures for an evening need `status` on the party (the server always sends it; a missing status reads as frozen).
- Verification: web typecheck (app and spec) OK; full web suite OK except the 3 known date-dependent failures; eslint: no new finding (`calendar-view.ts` `no-useless-assignment` predates); API typecheck OK; the new e2e passes (4/4); the API unit and the other e2e suites were not rerun (no API code changed). Not exercised in a browser: UJ-2 on a real evening (the real account's isolated evening exists but nothing was written to it), phone width, the three themes.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | The evening target could write after the evening was dated or launched elsewhere | medium | `confirmEveningPoll` re-checks `rendezvousRows` before writing, notice + `cancelCompose`; tested |
| 2 | The DTO could be built from stale composer state | medium | every field but the slots and the deadline is re-read from the loaded card at validation; tested on the payload |
| 3 | An evening of a frozen party (status missing) reads as frozen and disappears | low | the server always serves `status`; only test fixtures lacked it and were fixed |
| 4 | The invitee-vote assertion of the e2e is conditional | low | a bare membership is not an accepted invitation; the existing 41.x tests cover accepted invitees; noted |
| 5 | A non-host could be offered the evening | false | `groupRendezvous` needs `can.propose`, the server serves it only to the host; e2e and unit tests cover it |
| 6 | The evening target breaks the 40.5b round trip | false | `group-new` is untouched; `evening-poll` writes through the existing PATCH and never touches the creation draft |

## Design Notes

Decided without the human: the target is a fourth `ComposeTarget` kind rather than a flavour of `group-poll` (it creates a poll instead of editing one, and has no votes to lose); the server needs no change because 41.2 already completes an evening with the same PATCH; the closing `deferred-work.md` entry of 45.1 is fulfilled by this story and stays as history.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec api pnpm typecheck` and `pnpm test:e2e` -- expected: pass

**Manual checks (if no CLI):**
- UJ-2 end to end on a real isolated evening: vitrine → atelier → compose → validate; the three themes, desktop and phone.
