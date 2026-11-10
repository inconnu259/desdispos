---
title: 'Story 44.6 — Fixer la date ou prolonger le vote depuis le plateau'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: 'a67e8ea5cb27704609aad55b61a8b623702b5d01'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The board (≥ 768 px) and the drawer (< 768 px) only show a vote. The organizer still has to leave the Destinée for the scenario sheet or the event window to fix the date or extend the vote; and when the vote closes under the Destinée it ends silently, with no reason.

**Approach:** The organizer fixes the date or extends the vote from the board and the drawer, through the existing dialogs and routes. The Destinée closes when its vote is no longer open and says why, once. UX state table: EXPERIENCE §5.1.

## Boundaries & Constraints

**Always:**
- Rights come from the entry's `can` (`choose` → "Fixer la date…", `extend` → "Prolonger le vote", soirée only; never in JDR). Buttons also show after the deadline passed; the server stays the judge.
- "Fixer la date…" (board and expanded drawer: in the board; collapsed drawer: next to "Voir les N dates"). Opens `SealConfirmDialog` for `family: 'jdr'`, `DateFixDialog` for `'ralliement'`, listing the candidate slots with their yes/maybe/no, ordered like `rankedPollSlots`, `bestOption(…, today)` first and preselected, nothing preselected without a yes, past days not selectable. `SealConfirmDialog` gains an optional slot-list mode (radio list, confirm callback, server refusal kept in the dialog like `DateFixDialog`); its current Agenda use stays byte-for-byte unchanged.
- Writes are `PATCH /parties/:id/poll/:pollId/choose` and `…/extend` with the exact existing effects; `partieId` from the entry in the vitrine, from the route at the atelier; no new route, no API change. "Prolonger le vote" opens `ExtendVoteDialog` (deadline and minimum day from the entry's `expiresAt`, same minimum rule as `extendMinKey`).
- After a successful write: atelier → `reloadVotes` + `openPollsSvc.refresh()`; vitrine → `openPollsSvc.refresh()` and the personal calendar reload. The board then reflects the new state (extend) or the Destinée closes (fix).
- Closing is silent today: the Destinée now sets a one-shot notice (`role="status"`, dismissible, cleared on the next entry into a Destinée). Atelier: reason read from the data already loaded — JDR poll `CLOSED` with `chosenDate` or group `seance.date` → « Ce vote est clos : sa date est fixée. »; group event `cancelled` → « … le rendez-vous est annulé. »; anything else (including deleted) → « Ce vote est clos. ». Vitrine: the entry absent after a successful reload (`loaded`) → « Ce vote n'est plus ouvert. ». No other vote takes its place.
- A deadline that passes never closes the Destinée; the board says so and keeps "Fixer la date…".
- Tones for the three themes (neutral wording in evening mode, no JDR word, no "partie"); 44 px targets; no voter `userId` in the DOM; French comments; no dependency; Docker only. Reuse existing keys (`partie.ralliement_event_fix_date_btn`, extend labels) where they fit.

**Never:**
- No "Modifier les dates", no "Pour rouvrir le vote…" phrase (they come with the story that makes them true), no `?poll` link (44.7), no party filter (44.8), no change to the scenario sheet, the event window or the Agenda seal, no new route or endpoint.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fix, soirée | `can.choose`, ralliement, confirm | e-mail path of 40.6, Destinée closes with the reason | server refusal shown in the dialog, dialog stays open |
| Fix, JDR | `can.choose`, jdr, confirm | séance sealed, vote closed, Destinée closes | idem |
| No yes at all | every slot 0 yes | nothing preselected, confirm disabled until a choice | N/A |
| Extend | `can.extend`, soirée | deadline moves, Destinée stays, board updated | server refusal in the dialog |
| No right | `can.choose` false | no button, board readable | N/A |
| JDR | `can.extend` false | no "Prolonger" | N/A |
| Ended | deadline passed | "Fixer la date…" still shown | N/A |
| Closed elsewhere (atelier) | poll gone, reason in payload | Destinée closes, matching message | unknown reason → « Ce vote est clos. » |
| Closed elsewhere (vitrine) | entry absent after reload | Destinée closes, « Ce vote n'est plus ouvert. » | reload failed → Destinée kept |
| Drawer collapsed | organizer, < 768 px | "Fixer la date…" beside "Voir les N dates" | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/destiny-board/destiny-board.{ts,html,scss}` -- model gains `actions` (`fixLabel`, `extendLabel`, both nullable); outputs `fixRequested`, `extendRequested`; buttons in a footer row.
- `apps/web/src/app/features/calendar/destiny-sheet/destiny-sheet.{ts,html,scss}` -- model gains `fixLabel`; collapsed actions row shows it beside the toggle; output `fixRequested`; forwards the board's two outputs.
- `apps/web/src/app/features/calendar/seal-confirm-dialog/seal-confirm-dialog.{ts,html}` -- optional `slots`, `todayKey`, `confirm`; radio list + busy + error; model on `events/date-fix-dialog`.
- `apps/web/src/app/features/events/event-card.util.ts` -- reuse `RankedPollSlot`, `pollSlotLabel`, `pollCountsLabel`, `extendMinKey` logic (add a variant taking `deadlineKey`); a helper turning an `OpenPollEntry` into ranked slots.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html}` -- `destinyBoard`/`destinySheet` models carry the actions from `destinyEntry().can`; `openDestinyFix()`, `openDestinyExtend()` (dialogs via `MatDialog`, writes via `PollService.chooseDate` / `EventsApiService.extend` resolved with `injector.get`, refresh as in `writeVote` ~L2768); `destinyNotice` signal + template line; the death effect (~L1981) computes the reason (`scenarios()`, `groupEvents()`) before `exitDestiny()`; `enterDestiny` clears the notice.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- notice keys (`calendar.destiny_closed_fixed`, `_cancelled`, `_generic`, `_gone`), board action/dismiss labels; update `NEUTRAL_KEYS`.
- Reuse: `DateFixDialog`, `ExtendVoteDialog`, `refusalMessage`, `bestOption`, `shortDayLabel`, `fillTone`, `openPollsSvc.loaded()`.
- Specs: `destiny-board`, `destiny-sheet`, `seal-confirm-dialog` (new), `calendar-view` (new block after 44.5's), tone spec.

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + `theme-tone.service.spec.ts` -- notice and action keys, neutral ones listed, no JDR word -- UX-DR14
- [x] `seal-confirm-dialog` -- slot-list mode, Agenda path untouched -- FR11
- [x] `event-card.util.ts` -- entry → ranked slots, extend minimum from a deadline key -- reuse
- [x] `destiny-board` + `destiny-sheet` -- action buttons and outputs, collapsed "Fixer la date…" -- AC flow
- [x] `calendar-view.*` -- fix / extend flows, refresh, notice, close reasons -- FR12, AR6
- [x] Tests: each matrix row; Agenda seal dialog unchanged; refusal kept in the dialog; no write without confirm; notice shown once and cleared on re-entry; `can` gates the buttons in board and drawer

**Acceptance Criteria:**
- Given I organize a soirée vote on my personal calendar, when I touch "Fixer la date…" in the board, confirm the preselected best slot, then the Destinée closes with « Ce vote n'est plus ouvert. » and the date is fixed.
- Given a collapsed drawer on a vote I organize, when I look at it, then "Fixer la date…" sits beside "Voir les N dates" and opens the same confirmation.
- Given a JDR vote in the atelier, when its date is fixed from elsewhere, then the Destinée closes with « Ce vote est clos : sa date est fixée. ».

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- `SealConfirmDialog` gained a slot-list mode (`SealSlotsData`: radio list, `bestOption` preselected, own `confirm`, refusal kept in the dialog); the Agenda mode is unchanged in behaviour (its two buttons now carry `disabled`/`aria-busy` attributes). `event-card.util.ts`: `rankedEntrySlots` (same order as `rankedPollSlots`, from an `OpenPollEntry`) and `extendMinKeyFrom`.
- `destiny-board` takes `actions` (`fixLabel`, `extendLabel`) and emits `fixRequested`/`extendRequested`; `destiny-sheet` shows `fixLabel` beside the toggle only when collapsed (expanded, the board's own button is the only one) and forwards both outputs.
- `calendar-view`: `destinyActions` from `can` (+ `family`), `openDestinyFix` / `openDestinyExtend` (guarded by `pollActionPending`), `refreshAfterDestinyWrite`, `destinyNotice` (`role="status"` slot always in the DOM), `destinyCloseReason` read from `scenarios()` / `groupEvents()`; the death effect sets the notice; `enterDestiny` clears it.
- Tones: 5 neutral-voiced keys per theme (`calendar.destiny_closed_{fixed,cancelled,generic,gone}`, `calendar.destiny_notice_dismiss` neutral). Forêt says « la rencontre est annulée » because its tutoiement test rejects « rendez-vous » (contains « vous »). Existing keys reused for the buttons.
- Tests: web suite passes except the 3 known date-dependent failures; `tsc` (app and spec) shows only the TS6059 noise. Remaining eslint findings in `calendar-view.ts` (738, 1966, 2438) are on lines this story did not touch.
- Visual check 2026-10-24 (Chrome, iframe 375 px, real account, Atelier Cuivré): collapsed drawer 116 px with « Voir les 2 dates » + « Fixer la date… » (44 px); confirmation opened and cancelled WITHOUT confirming (real vote). That vote's two slots are past, so none is selectable — same rule as `DateFixDialog` (the server refuses a past day). Not exercised: a real fix or extend, the board at ≥ 768 px, the other two themes, the closing notice in a browser.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | After a `:id` change on the reused instance, the death effect would set « Ce vote est clos. » in the new partie | medium | the Destinée was never reset there; fixed in `loadForPartieId` (exit + clear notice), test added |
| 2 | A vote whose every slot is past cannot be fixed (no selectable slot) | low | same rule as `DateFixDialog` and the server (past day refused); the dialog says why; extending or editing dates is the way out |
| 3 | `SealConfirmDialog` Agenda buttons now carry `disabled`/`aria-busy` attributes | low | behaviour identical, Agenda specs unchanged and green |
| 4 | Vitrine always says « n'est plus ouvert », even after the organizer's own fix | false | exactly what the story asks for the vitrine (no payload to read) |
| 5 | `refreshAfterDestinyWrite` runs `refreshMjPanels` for a group | false | it returns early for a group (no slots/heatmap) |
| 6 | Double tap opens two confirmations | false | `pollActionPending` set before opening; tested |
| 7 | Remaining eslint/prettier findings in `calendar-view.ts` | false | predate this story (same lines as before) |

## Design Notes

Decided without the human: the JDR confirmation is `SealConfirmDialog` extended with an optional slot list rather than reusing `DateFixDialog`, whose wording is the group's (e-mails to registrants); extending it leaves the Agenda seal untouched. The notice is an inline `role="status"` line, not a snackbar, so it stays readable and dismissible.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no new error (TS6059 rootDir noise excepted)

**Manual checks (if no CLI):**
- Fix and extend on a soirée and a JDR vote, board and drawer, three themes; the notice reads once and clears on the next entry.
