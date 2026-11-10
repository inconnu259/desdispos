---
title: '54.3 — Poll summary GM side, and fix the date from the sheet'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '1ae80932be4be1ecd03b05fadcd6d207cc00d681'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-54-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** To conclude a vote the GM scans a list of slots (`app-poll-status`), with no overview, no names of who has not answered, and a "Clôturer le vote" that asks no confirmation.

**Approach:** Web only, no API change. Extend `<app-seance-poll-summary>` with a GM mode (answers, best slot, named absentees, deadline, "Clôturer le vote" after a confirmation, "Voir dans le calendrier →"); add the `fixer_la_date` box whose "Fixer la date…" opens `SealConfirmDialog` in slot-list mode; remove `app-poll-status`. Full ACs: `_bmad-output/planning-artifacts/epics-palier10-6-8.md`, Story 54.3 (l.726-748).

## Boundaries & Constraints

**Always:** Names come from `getMissingVoters(poll, members)` (`displayName`, else `pseudo`); the list excludes the GM (Story 36.6 debt), so the GM is never named and the count comes from `pollAnswerCounts`; until members are loaded, or if loading failed, the line falls back to the 54.2 count; zero absent → no line. `fixer_la_date` only when `seance.can.choose` (never from the role), vote open, no date; text as the player's box (passed deadline: "Le vote est terminé."), button `scenarios.seance_situation_fix_date`. "Fixer la date…" opens `SealConfirmDialog` with `slots = rankedEntrySlots(pollRankableOptions(poll), todayKey, poll.durationSlots)` (parameter widened to the fields it reads, Destinée unchanged), `pollLabel` = chapter title + session number, `confirm = pollSvc.chooseDate(partieId, poll.id, {optionId})`, `restoreFocus`; `pollActionPending` set BEFORE opening; dismissing changes nothing; on success reload the scenario. "Clôturer le vote": `ConfirmDialog` (`scenarios.close_poll_confirm`, confirm label `common.cloturer_le_vote`, cancel `common.annuler`), then `onClosePoll`. "Voir dans le calendrier →" → `atelierUrl({partieId, family:'jdr', role:'mj'}, {poll})`. Closed without date: the 54.1 box alone. New texts are tone keys (`scenarios.seance_summary_mj_*`, `scenarios.seance_situation_fix_date`, `scenarios.close_poll_confirm`), neutral ones in `NEUTRAL_KEYS`; remove a tone key only after a search finds no reader. Realtime: no new channel, record the `docs/checklist.md` evaluation. Flag sheet changes ⚠️. Last story of Palier 10.8: end with the reminders (plan mode, `/security-review`, `/code-review`, dependency PRs).

**Never:** Touch the player summary lines, the Destinée behaviour, `rankedPollSlots`, the API. "Fixer la date…" never appears outside the box; the fill indicator of an episodic session stays.

## I/O & Edge-Case Matrix

| State (GM, open vote, no date) | Result |
|---|---|
| Members loaded, 2 absent / none | "Réponses : 2 sur 4 joueurs", "N'ont pas encore répondu : Lou, Sam" / line absent |
| Members not loaded or failed | count line "{n} personnes n'ont pas encore répondu" |
| `can.choose` true, deadline ok / passed | box with "Fixer la date…" / box text "Le vote est terminé." |
| `can.choose` false | no `fixer_la_date` box |
| "Fixer la date…" confirmed / dismissed / refused by the server | date shown / unchanged / error stays in the dialog |
| "Clôturer le vote" confirmed / "Renoncer" | `onClosePoll` runs / vote stays open, no call |

</frozen-after-approval>

## Code Map

- `features/scenarios/seance-poll-summary/` + spec -- add `isMj`, `members`, `membersLoaded`, `busy` inputs, outputs `closePoll` / `seeInCalendar`; MJ lines (no "Vos réponses"); `MatDialog` + `ConfirmDialog` (`features/parties/confirm-dialog/`) for the close confirmation.
- `features/scenarios/seance-situation/seance-situation-box.ts` + `seance-situation.ts/html` + specs -- `fixer_la_date` (source type gains `can`), text, button.
- `features/scenarios/seance-list/seance-list.{html,ts,spec.ts}` -- html l.~111-131 and ~177-195: `app-poll-status` + old "Clôturer" buttons → summary (open vote); `onFixDate`, `MatDialog`, new `membersLoaded` input; drop `onChoose` and `PollStatusPanel`; rewrite the specs asserting `app-poll-status` and the "onChoose" tests.
- `features/scenarios/scenario-editor/scenario-editor.{ts,html}` -- `membersLoaded` signal (set on success), pass it; fix the comment at l.~305 (names of the summary, not `PollStatusPanel`).
- `features/events/event-card.util.ts` l.~678 -- widen `rankedEntrySlots` options to `Pick<OpenPollOption, 'optionId'|'date'|'slot'|'yes'|'maybe'|'no'>`; `calendar-view.spec.ts` stays green.
- `features/calendar/seal-confirm-dialog/seal-confirm-dialog.ts` l.~34-47 -- the comment opposing the sheet ("sans confirmation") to the Agenda.
- `features/poll/poll-status/` -- delete after `rg` shows no consumer (calendar-view and poll-missing mention it in comments only).
- `core/theme/tones/*` + `theme-tone.service.spec.ts` -- new keys; remove keys only `poll-status` read (candidates: `alert.missing_player`, `alert.all_responded`, `pollui.status_choose_confirm`, `pollui.status_choose_no_vote_warning`, `pollui.status_voters_aria`, `pollui.status_missing_aria`); KEEP `cta.choose_date`, `poll.status_title` (poll-missing) and any other key with a reader.

## Tasks & Acceptance

**Execution:**
- [x] summary component + spec -- GM lines, fallback, close confirmation (confirm / renounce), "Voir dans le calendrier →"
- [x] `seance-situation-box` + component + specs -- `fixer_la_date` (open, passed deadline, no `can.choose`)
- [x] `rankedEntrySlots` widening, `SealConfirmDialog` comment
- [x] `seance-list.*` + `scenario-editor.*` + specs -- wiring, `onFixDate` (best slot first and preselected, `chooseDate` then reload, dismiss, double tap opens one dialog), no `app-poll-status`
- [x] delete `features/poll/poll-status/`, tone keys + `theme-tone.service.spec.ts`
- [x] Implementation Notes -- realtime evaluation; web tests + `tsc`; final reminders

**Acceptance Criteria:**
- Given Marc's open vote, when he opens the sheet, then "N'ont pas encore répondu : Lou" and the best slot show, "Fixer la date…" preselects it, and confirming shows the date
- Given a player answering in the Destinée, when `changed()` fires, then count, absentees and best slot update without reload

## Implementation Notes

- `seanceSituationBox`: new `fixer_la_date` (MJ controls, open vote, no date, `seance.can.choose`); the source type gains an optional `can`. `SeanceSituationComponent` renders it like the player's vote box (passed deadline → `scenarios.seance_summary_ended`), plain button `scenarios.seance_situation_fix_date`, GM border.
- `SeancePollSummary`: new inputs `isMj`, `members`, `membersLoaded`, `busy`; outputs `closePoll`, `seeInCalendar`. GM lines: "Réponses : x sur n joueurs" (`pollAnswerCounts`) → best slot → named absentees (`getMissingVoters`, `displayName` else `pseudo`; count fallback while the list is not loaded) → deadline; then "Clôturer le vote" (`ConfirmDialog`, `scenarios.close_poll_confirm`, confirm label `common.cloturer_le_vote`) and "Voir dans le calendrier →".
- `SeanceList`: `app-poll-status` and the old "Clôturer" buttons replaced by the summary in the two GM open-vote branches; `onChoose` removed, `onFixDate` added (`SealConfirmDialog` slot-list mode, `rankedEntrySlots(pollRankableOptions(poll), …)`, `pollActionPending` set before opening, reload on success); `goToCalendarForPoll(pollId, role)`; input `membersLoaded`. `ScenarioEditor` sets `membersLoaded` after `members()` resolves and passes it; its comment now names the summary.
- `rankedEntrySlots` is generic over the six fields it reads (Destinée unchanged); the `SealConfirmDialog` comment no longer opposes the sheet to the Agenda. `features/poll/poll-status/` deleted (so `features/poll/` is gone; `calendar-icon-characters.spec.ts` no longer scans it).
- Tones: 5 keys added (`scenarios.seance_summary_mj_answers`, `…_mj_waiting`, `…_see_in_calendar`, `scenarios.seance_situation_fix_date` neutral; `scenarios.close_poll_confirm` one voice per theme). Removed after a search of `apps`: `pollui.status_voters_aria`, `pollui.status_missing_aria`, `pollui.status_choose_confirm`, `pollui.status_choose_no_vote_warning`, `scenarios.seances_choose_error`. Kept: `cta.choose_date` (SealConfirmDialog), `poll.status_title` and `alert.all_responded` (poll-missing), `alert.missing_player` (creneau-card), `calendar.util_answer_*`, and `common.oui` / `common.non` / `common.peut_etre` (listed by the tone spec).
- Realtime (`docs/checklist.md`): no new channel. The summary and the box read the `scenario` entry `seance-list` reloads on `ScenariosService.changed()` (`partie:` prefix); an answer, a sealing or a close from the Destinée emits `partie:{id}` (`PollService.castVote` / `choose` / `close`, verified in 53.3). Tested: an answer received after `changed()` removes the absentee line. The members list is loaded once by the editor (as for the old panel): names may lag a member joining until the editor reloads.
- Verification: full web suite green except the two known date-frozen `calendar-view` tests; `tsc --noEmit -p tsconfig.spec.json` shows only TS6059 noise. Not seen in a browser.
- Review patches: `ScenarioEditor` tests for the `members` / `membersLoaded` hand-off (names, and count fallback on failure); episodic-branch wiring test; click-driven "Clôturer le vote" test (confirm / renounce); the best slot is ranked first even when served second; `isMj` computed re-wrapped.
- Palier 10.8 is complete (last story of the document): reminders for the user — plan mode before non-trivial development, `/security-review` and `/code-review`, review of the dependency-update PRs (`docs/checklist.md`, CLAUDE.md "Rappels").

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge | `onFixDate` has no `catch` / unhandled rejection | low | `dialog.open` does not throw; `refreshScenario` catches itself; the server refusal stays in the dialog (AC). Rejected. |
| 2 | blind, edge | GM in the read dialog gets the box with a player summary | false | The box is gated by the controls flag (`isMj()` false there) so the GM gets no box; covered by a 54.1 test. |
| 3 | blind, edge | Per-voter detail, "tous ont répondu" banner and zero-vote warning gone with the panel | false | Intended by the AC (summary replaces the list; zero absent → line disappears; slot-list dialog, no-yes slot not preselected). |
| 4 | blind | `getMissingVotersForOption` now has no production caller | low | Small tested util; deleting it adds churn for no named harm. Rejected. |
| 5 | blind | "Clôturer le vote" lost the warn colour | false | AC: outlined button. |
| 6 | blind, edge | "x sur n joueurs" includes the GM; names list excludes the GM | false | The AC documents the debt (Story 36.6): the GM is never named and the count comes from `membersCount`. |
| 7 | blind | Weak tests (direct calls, hand-confirmed dialog) | medium | Part real: click-driven close test and ranked-first test added (see 12, 13). |
| 8 | blind, edge | UTC deadline day vs local `todayKey`, "terminé" next to an open vote | low | Same convention as 54.1 / 54.2 and the Destinée; the AC wants "Le vote est terminé." with the date still fixable. Rejected. |
| 9 | blind | Duplicated summary block; `membersLoaded` never refreshed | low | Two branches already duplicated everything; refreshing the list is the old panel's behaviour too. Rejected. |
| 10 | blind | Style (line length), docs/backlog entries | low | Line re-wrapped; docs not required by the AC. |
| 11 | gap | Editor → fiche `members` / `membersLoaded` hand-off untested | medium | Real; two `ScenarioEditor` tests added. |
| 12 | gap | Episodic branch wiring untested | medium | Real; test added (names, calendar link, fill indicator). |
| 13 | gap | Click on "Clôturer" not wired in a `SeanceList` test; best slot not proven first | medium | Real; click-driven close test and reversed-order ranking test added. |
| 14 | edge | Summary destroyed while the confirmation is open, then confirmed | low | Rare; Angular tolerates an emit on a destroyed output. Rejected. |
| 15 | edge | Every slot past: box offers "Fixer la date…" with nothing selectable | low | Same behaviour as the Destinée's dialog; the server stays judge. Rejected. |
| 16 | edge | `findIndex` -1 gives "Séance 0" | low | The session comes from the rendered list; unreachable. Rejected. |
| 17 | edge | Names stale after a member joins | low | See 9. Rejected. |
| 18 | edge | Implementation Notes empty | low | Process slip, fixed by these notes. |

## Design Notes

`getMissingVoters` lists current members only, so absentees named and the count may differ by the GM; the count line is the authority for "Réponses : x sur n".

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green bar the two known date-frozen `calendar-view` tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: only TS6059 noise
