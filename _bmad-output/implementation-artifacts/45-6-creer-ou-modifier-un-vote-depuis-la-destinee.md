---
title: 'Story 45.6 — Créer ou modifier un vote depuis la Destinée'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: '6abc6fc0bf63a4bdfb6dffe6d09d7dbe7bd9c9e7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An organizer following their vote on the destiny board can fix the date but not edit the dates, and cannot start another poll without leaving the mode. In the personal calendar the control-row button still says « Proposer des dates » even when the active destiny is their own poll, and does not lead to its atelier.

**Approach:** When the active destiny is a vote the organizer can edit (`can.edit`), the board offers « Modifier les dates » and, under its actions, a text link « Proposer des dates pour un autre rendez-vous ». At the atelier « Modifier les dates » arms the prefilled composer; in the personal calendar it opens the atelier on that vote. The link opens the rendez-vous picker (45.1). Everything reuses 45.1–45.5: after a validation the Destinée is on the created or edited vote.

## Boundaries & Constraints

**Always:**
- Gate: the actions use the served `can` only — `can.edit` of the active entry for « Modifier les dates », and `can.edit` plus at least one rendez-vous to date for the link. Absent (not disabled) for anyone else, in the board and in the expanded drawer; the collapsed drawer keeps only « Fixer la date… ».
- « Modifier les dates » (board and control-row button, one behaviour): atelier → `armTarget` on the active vote (`modifiablePoll`, JDR `poll` or group `group-poll`), prefilled with its slots and its end (45.4); personal calendar → navigate to `atelierUrl({ partieId, family, role }, { seanceId, poll })` of the active entry (`role` as `openDestinyWho`), whose arrival arms it (45.2) and keeps the Destinée on `?poll`. Never a composer in the personal calendar.
- Control-row button in the personal calendar: « Modifier les dates » when the active destiny is an entry with `can.edit`, otherwise « Proposer des dates » when rows exist (EXPERIENCE §5.2); the atelier rule of 45.1 is unchanged.
- « Proposer des dates pour un autre rendez-vous »: `RendezvousPicker` of 45.1 (one rendez-vous → straight to the pick, as the button does); the picked rendez-vous arms the composer (atelier) or opens its atelier (personal); validation makes the NEW vote the active destiny (45.2 `reactivateDestiny`). Same picker wrappers, focus return to the button.
- Labels per theme: « Modifier les dates » reuses `calendar.view_modify_dates`; the link is one new key (3 voices; Forêt avoids « rendez-vous », which trips the tutoiement lint) named outside the `calendar.destiny_board_` prefix (the 44.4 tone test counts that prefix). Targets 44 px; the link is a real button styled as text.
- No server, shared or API change. French comments; no dependency; Docker only (PowerShell if Bash is down).

**Never:**
- No « Modifier » / link for a non-organizer or for a vote the server would refuse; no « Prolonger » in JDR; no change to the 45.2 arming, 45.3 gesture, 45.4 deadline or 45.5 evening target; no composer from the vitrine.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Atelier, own vote | Destinée on a vote with `can.edit` | board shows « Modifier les dates » and the link; click → composer prefilled, Destinée suspended | N/A |
| Personal calendar, own vote | active entry `can.edit` | button and board say « Modifier les dates »; click → atelier `?seanceId&poll`, composer armed there | stale notice if no longer editable (45.2) |
| Other rendez-vous | link clicked, several rows | picker opens; picking arms (atelier) / opens atelier (personal) | N/A |
| Other rendez-vous, one row | link clicked | straight to the pick | N/A |
| No row to date | `can.edit` but nothing to propose | « Modifier » only, no link | N/A |
| Not organizer | `can.edit` false | no « Modifier », no link, drawer collapsed shows « Fixer » only if `can.choose` | N/A |
| After validation | create or edit | Destinée on the written vote | refusal kept in the bar |
| Finished JDR vote | end passed, organizer | « Modifier les dates » + the 45.4 sentence (no « Prolonger ») | N/A |
| Group poll | host, open poll | same actions, `group-poll` target | N/A |

</frozen-after-approval>

## Code Map

- `features/calendar/destiny-board/destiny-board.{ts,html,scss}` -- `DestinyBoardActions` gains optional `modifyLabel` / `otherLabel`; outputs `modifyRequested`, `otherRequested`; keep existing specs valid (fields optional).
- `features/calendar/destiny-sheet/destiny-sheet.{ts,html}` -- forward the two outputs from the embedded board.
- `features/calendar/calendar-view/calendar-view.{ts,html}` -- `destinyActions(entry)` (new labels from `entry.can.edit` and `rendezvousRows().length`), `openDestinyModify()` (atelier: `armTarget(modifiablePoll())`; vitrine: `navigateByUrl(atelierUrl(…, { seanceId, poll }))`), `openRendezvousPickerFromBoard()` (reuse `onProposeClicked` logic: one row → `pickRendezvous`, else open the picker), `proposeButton` (vitrine « modify » when the active entry has `can.edit`), `onProposeClicked` modify branch → `openDestinyModify`; bind the two outputs on board and sheet in the html (l.423-445).
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- the link key (3 voices).
- Specs: destiny-board spec, destiny-sheet spec, `calendar-view.spec.ts` (new block).
- Do not touch: `armTarget` / `applyArming` / `reactivateDestiny` logic, API, shared.

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + tone spec -- the link label
- [x] board and drawer -- two actions and outputs
- [x] `calendar-view` -- modify (atelier and vitrine), link, control-row button in the vitrine
- [x] Specs -- every matrix row; full web suite and typecheck

**Acceptance Criteria:**
- Given I organize the active vote at its atelier, when I touch « Modifier les dates » on the board, then the composer opens prefilled with its slots and its end, and validating keeps the Destinée on that vote.
- Given I follow my vote in the personal calendar, when I touch « Modifier les dates », then its atelier opens with the composer armed.
- Given I touch « Proposer des dates pour un autre rendez-vous », when I pick one and validate, then the new vote is the active destiny.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff. Work ran through PowerShell (Bash unavailable).
- `destiny-board`: `DestinyBoardActions.modifyLabel` / `otherLabel` (optional, existing specs untouched), outputs `modifyRequested` / `otherRequested`, a « Modifier les dates » button in the actions row and the « autre rendez-vous » link as a real button under it (44 px, rendered as text); `destiny-sheet` forwards both from the embedded board (the collapsed drawer still shows only « Fixer la date… »).
- `calendar-view`: `destinyActions` adds the two labels from `entry.can.edit` (the link only when `rendezvousRows()` is not empty); `openDestinyModify()` is the single handler for the control-row button and the board — atelier → `armTarget(modifiablePoll())`, personal calendar → `navigateByUrl(atelierUrl({ partieId, family, role }, { seanceId, poll }))` (`mj` for a JDR, `player` otherwise); `proposeOther()` (the old « propose » branch of `onProposeClicked`, now shared with the link: one row skips the picker); `proposeButton` returns `modify` in the personal calendar when the active entry has `can.edit`. Tone key `calendar.destiny_other_rendezvous` (3 voices; Forêt reads « …pour un autre événement » because « rendez-vous » trips its tutoiement lint).
- No server, shared or API change. The 45.2 arrival does the rest: `?seanceId` arms the prefilled composer and `?poll` keeps the Destinée; validation lands on the written vote.
- Specs: 3 board tests, 1 drawer test, 8 `CalendarView` tests (atelier modify prefilled, link with several / one row, no row → no link, non-organizer, one behaviour for button and board, personal calendar navigation for JDR and group, personal link, non-organizer personal button). In the atelier tests the séance `can` and the served entry `can` are given the same value, as the server does.
- Verification: web typecheck (app and spec) OK; full web suite OK except the 3 known date-dependent failures; eslint: no new finding (the `calendar-view.ts` `no-useless-assignment` predates). Not exercised in a browser: the board actions and the personal-calendar hand-off (the real account has no JDR séance to compose), phone width, the three themes.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | A non-organizer could be offered « Modifier » or the link | medium | both labels derive from the served `entry.can.edit` only; tested in the atelier and the personal calendar |
| 2 | The link could open an empty picker | low | shown only when `rendezvousRows()` is not empty; tested |
| 3 | The personal calendar could arm a composer | false | `openDestinyModify` only navigates there; the arrival (45.2) arms at the atelier; tested |
| 4 | Two handlers for the button and the board could drift | low | one method `openDestinyModify`, one `proposeOther`; tested together |
| 5 | The collapsed drawer lacks the two actions | low | by spec (44.5/44.6): they live in the expanded board |
| 6 | `proposeButton` reads « Modifier » in the personal calendar for an entry whose séance no longer accepts edits | low | the atelier arrival then shows the stale notice (45.2); the server stays judge |

## Design Notes

Decided without the human: the link appears only when something is left to propose (a link that opens an empty picker would be a dead end); the control-row button and the board action share one handler; the collapsed drawer keeps only « Fixer la date… » (spec 44.5/44.6), the other two actions live in the expanded board; the personal-calendar button follows the active entry's `can.edit`, not the party role.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Own vote in an atelier and in the personal calendar, then the link with one and several rendez-vous; the three themes, desktop and phone.
