---
title: 'Story 44.3 — Choisir la destinée active dans une liste'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_commit: '7354229493a5739391ef8b6399547128dfb40631'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The ✦ chip only toggles the Destinée on the first open poll, and a vote months away is unreachable. There is no way to pick which vote becomes the active destiny.

**Approach:** ⚠️ The chip opens a list of the open polls (`OpenPollsService.entries`) grouped by party name; choosing a line activates the Destinée on that `pollId`, forces the right view and lands the grid on `destinyEntryOption`. `bestOption` / `destinyEntryOption` become shared pure functions; `DateFixDialog` preselects through `bestOption`.

## Boundaries & Constraints

**Always:**
- Chip click opens the list instead of toggling: modal bottom drawer when `!isDesktop()` (< 1024 px), anchored menu above; Esc or backdrop closes and changes nothing; focus trapped, then returned to the chip. Chip absent without an open poll (36.9 AC10). Atelier list = that party's polls only; vitrine = all active parties'.
- Rows grouped by `partieName`; each: poll `title`, `Fin du vote {date} · N créneaux` or `Vote terminé · N créneaux` (ended = `expiresAt` day < today; singular for 1), state pill with priority organizer (`can.choose`) > `!me.eligible` > answered > todo. Texts per EXPERIENCE §3.1/§3.2, one voice per theme, no JDR word nor "partie" in anything the evening mode shows (`NON_JDR_BANNED_WORDS`).
- Active destiny shown at the head with "Quitter la Destinée" (leaves the mode; not repeated in the groups).
- Choosing a line: `destinyPollId` (never a rank), view Month — Week when `family === 'ralliement'` — even from Agenda, `destinyOptionId = destinyEntryOption(poll, todayKey).optionId`, grid navigated to that date (month/week reload as for a manual navigation). The Destinée dimming and the `votes-en-cours` layer follow 36.9 (`enterDestiny` still lights the layer).
- `bestOption(options, today)`: most yes, then most maybe, then earliest (date, then slot); past options (`date < today`) excluded; `null` if none or no yes. `destinyEntryOption(poll, today)`: vote still open (no `expiresAt` or day ≥ today) → first upcoming option; ended → `bestOption`; fallback in both → first upcoming, else first option.
- `DateFixDialog` preselects via `bestOption` (nothing preselected without a yes; "Fixer la date" stays disabled until a choice). `RankedPollSlot` gains `date` and `slot`; `DateFixData` gains `todayKey`.
- No new network call, no voter identity, French comments, no dependency installation, Docker only.

**Never:**
- No board, no ‹ n/N › change (stays on votes until 44.4), no drawer replié, no `?poll` link (44.7), no party filter (44.8), no change to the scenario-sheet `PollStatusPanel`s.
- `enterDestiny(pollId)` keeps its current low-level contract (existing callers and tests).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No open poll | empty list | no chip | N/A |
| Open vote, upcoming slots | deadline ≥ today | lands on first upcoming slot | N/A |
| Ended vote | deadline < today | lands on `bestOption`, else first upcoming | N/A |
| Slot in another month | pick a vote 3 months ahead | view + month change, range reloaded | N/A |
| Evening vote from Agenda | `family: ralliement` | Week view on its entry slot | N/A |
| Not eligible | `me.eligible` false | pill "Vous ne votez pas", still choosable | N/A |
| Esc / backdrop | list open | closes, mode unchanged, focus on chip | N/A |
| Active destiny | mode on | head line + "Quitter" leaves the mode | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- next to `hasAnswered` (~L968): add `bestOption`, `destinyEntryOption` (generic on `{date, slot, yes, maybe}`); `DaySlot` order MORNING < AFTERNOON < EVENING < FULL_DAY.
- `apps/web/src/app/features/calendar/destiny-control/` -- chip → emits `listRequested`, `aria-haspopup="dialog"` + `aria-expanded` (replaces `aria-pressed`), exposes chip element for anchoring/focus; keep `polls` input and ‹ › as is.
- `apps/web/src/app/features/calendar/destiny-list/` (new, pure render, model on `calendar-display-panel`) -- grouped rows, pills, head with "Quitter"; outputs `chosen(pollId)`, `quit`.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html,scss}` -- `destinyPolls` (~L1020), `enterDestiny`/`exitDestiny` (~L1070), death effect (~L1697); two envelopes copied from the « Affichage » panel (`cdkConnectedOverlay` + `.display-surface*`, `isDesktop()`, `DISPLAY_PANEL_POSITIONS`); `onViewChange`, `onMonthDateChange`, `onWeekDateChange`; `todayKey`; `openPollsSvc.entries()` feeds rows (filtered to `destinyPolls()` ids and the party).
- `apps/web/src/app/features/calendar/calendar-month-view/calendar-month-view.ts` -- `initialDate` is read only in the constructor (~L494): add an effect so a date change while mounted moves the month (week view already has one).
- `apps/web/src/app/features/events/date-fix-dialog/` + `event-card.util.ts` (`rankedPollSlots` ~L637, `RankedPollSlot` ~L620) + `event-dialog.ts` (~L292) -- preselection through `bestOption`.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` (`NEUTRAL_KEYS`, banned-words checks) -- new keys per theme: title, subtitle, quit, open/ended row (one/many), four pills.
- Specs to update/add: `calendar-view.spec.ts` (Destinée block ~L2597, `aria-pressed` test), new `destiny-list.spec.ts`, `destiny-control` spec, `date-fix-dialog.spec.ts`, `best-option` spec (web, imports shared).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `bestOption`, `destinyEntryOption` -- single sources (AR11)
- [x] `event-card.util.ts`, `date-fix-dialog.*`, `event-dialog.ts` -- `date`/`slot` on slots, `todayKey`, preselect via `bestOption` -- no other change
- [x] tones (3 themes) + `theme-tone.service.spec.ts` -- new keys, neutral ones listed, no JDR word in evening-mode keys -- UX-DR14
- [x] `destiny-list` component -- rows, groups, pills, head -- UX-DR10
- [x] `destiny-control.*` -- chip opens the list -- ⚠️ behaviour change
- [x] `calendar-view.*`, `calendar-month-view.ts` -- list state, envelopes, Esc/backdrop/focus, `chooseDestiny`, `destinyOptionId` -- AC flow
- [x] Tests: `bestOption` table, `destinyEntryOption`, list grouping/pills/ended/singular, atelier restriction, chip absent, Esc/backdrop, choose → view/date/option (also from Agenda, evening → Week, other month), quit, `DateFixDialog` preselect, tone parity

**Acceptance Criteria:**
- Given two parties with open polls, when I touch ✦ in my calendar, then both parties' votes appear grouped by name and choosing one activates it on its entry slot, even months away.
- Given the list is open, when I press Esc, then it closes, nothing changed and focus is back on ✦.
- Given an evening vote, when I choose it from the Agenda on a phone, then the Week view shows its entry slot.

## Implementation Notes

- Implemented directly in this session (session rules forbid spawning a subagent without an explicit request); the three review layers were replaced by one inline self-review of the diff.
- Shared: `bestOption`, `destinyEntryOption`, `RankableOption` next to `hasAnswered`. Web: new `destiny-list` (pure render), `destiny-control` now emits `listRequested` and exposes its chip element, `calendar-view` holds `destinyListOpen`, `destinyListItems`, `destinyOptionId`, `chooseDestiny`, `quitDestiny` and the two envelopes (desktop `cdkConnectedOverlay`, phone sheet) reusing the « Affichage » classes; `toggleDestiny` removed (nothing calls it any more). `calendar-month-view` follows `initialDate` changes while mounted. `DateFixDialog` takes `todayKey` and preselects through `bestOption`; `RankedPollSlot` carries `date`/`slot`.
- Tones: 11 keys per theme (`calendar.destiny_list_*`, `_quit`, `_row_*`, `_state_*`); only `calendar.destiny_state_organizer` is neutral (listed in `NEUTRAL_KEYS`).
- Tests: web 3669 pass; the only failures are the 3 known date-dependent ones (2 `calendar-view` rail specs, 1 `calendar-week-view`). API typecheck OK. Remaining eslint findings in `calendar-view.ts` (703, 1579, 2013) are on lines this story did not touch.
- Process note: a mistaken `git add -N .` marked the new files as intent-to-add (no content staged); left as is, no further git writes.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Month view's new `initialDate` effect could reset the month in a non-UTC timezone (the view emits UTC dates built from local getters) | medium | fixed: the effect returns when the shown month matches the local OR UTC reading of the date; test `chooseDestiny` other-month passes |
| 2 | `cdkConnectedOverlay` detaches on Esc by itself, so `destinyListOpen` could stay true | false | `(overlayKeydown)` handler sets it to false; Esc test asserts the list is gone and focus is on the chip |
| 3 | `destinyListOpen` stays true while the chip is hidden (Agenda, desktop) and would pop open on return to Month | low | not reachable from the UI (backdrop blocks view changes, chip hidden in Agenda); `chooseDestiny` and Esc close it; fix would add a branch for no real case |
| 4 | `destinyOptionId` is written but not rendered yet | low | intended: 44.4's board reads it; asserted by tests |
| 5 | `DateFixDialog` no longer preselects without a yes | medium | decided in the spec (AC « aucune sans oui »), tested, recorded in Design Notes |
| 6 | Prettier/eslint errors reported on `calendar-view.ts` lines 703, 1579, 2013 | false | lines predate this story (`git blame` region of 36.x/40.5b), none in the diff |

## Design Notes

Decisions taken without the human (invisible or forced by the AC): `DateFixDialog` no longer preselects when nobody said yes (AC "aucune sans oui" + EXPERIENCE §10); the chip's `aria-pressed` becomes `aria-expanded` (the mode is still stated in the chip text); the list is built from `destinyPolls()` (authoritative set and order) enriched by `OpenPollsService.entries()`, a poll without an entry is not listed.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error
- `docker compose exec api pnpm typecheck` -- expected: no error (shared consumed by api)

**Manual checks (if no CLI):**
- Chip → list in the three themes, desktop menu and phone drawer; Esc/backdrop; choose a far-away vote.
