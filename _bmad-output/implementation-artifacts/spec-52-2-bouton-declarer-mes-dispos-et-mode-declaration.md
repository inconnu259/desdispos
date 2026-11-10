---
title: 'Story 52.2 — "Déclarer mes dispos" button and declaration mode'
type: 'feature'
created: '2026-11-05'
status: 'done'
baseline_commit: 'ca749f79ad842b56c4a0c0e496e441dee9e4073d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Declaring availability needs the long-press, which nobody discovers. Story 52.1 gave the calendar a single `interaction` signal but nothing lights `declaration` yet.

**Approach:** A button "Déclarer mes dispos" in the calendar controls toggles `setInteraction('declaration')`; while on, a help banner and a grid outline show the mode, and "Terminer" (button or banner) turns it off. Tap-to-select, the sticky bar and `Échap` order come in 52.3; no server change.

## Boundaries & Constraints

**Always:**
- Button on the three routes mounting `calendar-view` only, in `.calendar-controls` right after the Destiny control (kept visible in Agenda, so outside that control's `@if`) and before "Proposer des dates". Outlined `mat-stroked-button` at rest (min-height 36px), with decorative `<app-icon name="declarer-dispos">` and `aria-pressed="false"`; on: filled (`--jdr-accent-1` background, `--jdr-on-primary` text), label "Terminer", `aria-pressed="true"`. "Déclarer mes dispos" and "Terminer" are identical in the three themes and join the identical-keys list of `theme-tone.service.spec.ts`.
- Agenda: tapping the button switches to Month then lights the mode; Month ⇄ Week keeps it; switching to Agenda turns it off.
- Banner `declare-banner` only while on, inside an always-present `role="status"` container (pattern of `.calendar-notice-slot`), under the controls and above the grid: `--jdr-accent-1` at 10% background (`color-mix`), 1px solid `--jdr-accent-1`, radius 12px, padding 8px 12px, text 13px/500 `--jdr-text-primary`, then a "Terminer" action. Texts — Grimoire "Touchez les créneaux où vous êtes disponible ou non, puis validez." · Forêt "Touche les créneaux où tu es disponible ou non, puis valide." · Atelier "Sélectionnez les créneaux où vous êtes disponible ou non, puis validez." (new tone keys).
- Class `declare-grid` on the Month and Week views while on: 2px solid `--jdr-accent-1`, radius 12px; that outline appears nowhere else. Existing `--jdr-*` variables only.
- "Terminer" (button or banner) turns it off; unvalidated selection dropped without confirmation (the views already clear it on `interaction` change).
- Exclusivity through `setInteraction()` only: the Destiny chip and "Proposer des dates" turn the mode off first, then do their usual action; lighting it closes the vote list and rendezvous picker, leaves Destiny and the Composer without writing or navigating (a `group-new` composition hands its draft back with `drafts.finishCompose(partieId)`, no navigation).
- Not persisted in the URL; a `:id` change already resets to `lecture` (52.1).
- French comments and messages.

**Never:** tap-to-select, sticky selection bar, `Échap` change, snackbar (52.3); `?declarer=1` (52.5); new colour token; any change to read-mode gestures or shortcuts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Light / off | Tap button in Month; tap button or banner "Terminer" | `declaration` then `lecture`; banner, outline, `aria-pressed` and label follow | N/A |
| From Agenda | Tap button in Agenda | View becomes Month, mode on | N/A |
| Leave to Agenda | Mode on, choose Agenda | `lecture`, banner gone | N/A |
| Destiny chip | Mode on, tap chip | `lecture`, vote list opens | N/A |
| Propose dates | Mode on, tap "Proposer des dates" | `lecture`, tool opens as today | N/A |
| Light over a tool | Destiny, Composer, open list or picker | Tool off, lists closed, `declaration` on | `group-new` draft returned, no navigation |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts` -- `interaction`/`setInteraction()` (52.1); add `toggleDeclaration()`; `onViewChange` (L~3827) turns the mode off for `agenda`; `toggleDestinyList` and `onProposeClicked` (L~2383) turn it off first.
- `.../calendar-view/calendar-view.html` -- controls row: destiny control sits in `@if (view() !== 'agenda')` just before `#proposeBtn`; add the button between them; banner slot after `.calendar-controls`; `[class.declare-grid]` on `<app-calendar-month-view>` / `<app-calendar-week-view>`.
- `.../calendar-view/calendar-view.scss` -- `.compose-arm` / `.calendar-notice` patterns to follow; add button-on, `declare-banner`, `declare-grid`.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` -- new keys next to `calendar.view_propose_dates`; `core/theme/theme-tone.service.spec.ts` identical-keys list (~L1338).
- `drafts` (`ConjonctionDraftService.finishCompose`) -- reuse for `group-new`; icon `declarer-dispos` already in `core/icons`.
- `calendar-view.spec.ts` -- helper `createCalendarView`; Story 52.1 describe at the end.

## Tasks & Acceptance

**Execution:**
- [x] tone files + `theme-tone.service.spec.ts` -- keys `calendar.declare_btn`, `calendar.declare_done` (identical), `calendar.declare_banner` (per theme) -- UX-DR106
- [x] `calendar-view.ts` -- `toggleDeclaration()` (Agenda→Month, draft handback, `setInteraction`), Agenda exit in `onViewChange`, mode off in chip and propose handlers -- AD-7
- [x] `calendar-view.html` / `.scss` -- button, banner slot, `declare-grid`, styles -- UX-DR1..9
- [x] `calendar-view.spec.ts` -- tests: button place after Destiny control, `aria-pressed`, "Terminer", `app-icon[data-icon="declarer-dispos"]`; Agenda→Month, Month→Agenda off; banner only on, three theme texts; outline; both "Terminer"; chip and "Proposer des dates" turn it off; lighting closes tools; `:id` change

**Acceptance Criteria:**
- Given a calendar route, when I tap "Déclarer mes dispos", then the mode is on with banner and outline, and "Terminer" restores read mode with nothing written.
- Given the mode is off, then no screen, gesture or shortcut differs from 52.1.

## Implementation Notes

- Implemented directly (no subagent). Button, banner slot and `declare-grid` class in `calendar-view.html`; `toggleDeclaration()`, `endDeclaration()` (banner action, refocuses the button), `leaveDeclaration()` in `calendar-view.ts`, called from the Destiny chip, "Proposer des dates", `proposeOther`, `addSelectedWindow`, `?pollList` resolution and `onViewChange('agenda')`. Tone keys `calendar.declare_btn` / `declare_done` (identical, in `NEUTRAL_KEYS` of `theme-tone.service.spec.ts`) and `calendar.declare_banner` (per theme).
- Real-time (CLAUDE.md check): the mode is local UI state with no Partie-scoped data and no new display of server data, so no `changed`/`notifyChanged()` wiring is needed.
- Not seen in a browser (Claude in Chrome was not connected). The filled-button style sets the Material outlined-button tokens as well as `background`/`color`; to be checked by eye. Known gap until Story 52.3: the banner says "puis validez" but taps still run the read path.
- Verification: web suite 4712 pass, 2 fail (the fixed-date rail tests failing before 52.1); `tsc` clean apart from TS6059.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Edge, Gap | `proposeOther` and `addSelectedWindow` open the rendezvous picker without leaving declaration, so two tools show at once | medium | patch — `leaveDeclaration()` added in both (after their early returns); test added |
| 2 | Edge | `applyLink` list branch (`?pollList`) opens the vote list over a lit declaration mode | low | patch — one-line `leaveDeclaration()`; test added |
| 3 | Gap | Lighting the mode from a composer armed by `?seanceId` leaves the param in the URL, so a reload re-arms the composer | medium | patch — `clearArmParam()` when leaving the composer in `toggleDeclaration`; test added |
| 4 | Blind | The banner's "Terminer" disappears with the mode: keyboard focus falls back to the page | medium | patch — banner action calls `endDeclaration()`, which refocuses the toggle button; test asserts `document.activeElement` |
| 5 | Edge | Chip tapped with the list already open closes it instead of opening | false | `setInteraction` closes the lists when the mode lights, so it cannot be open under declaration once #2 is fixed |
| 6 | Blind, Edge | `aria-pressed` plus a label flipping to "Terminer"; two buttons named "Terminer"; `role="status"` region holds a button | low | rejected — all three are fixed by the frozen Boundaries (UX-DR3, UX-DR4, UX-DR8); surfaced to the user in the summary |
| 7 | Blind, Edge | Banner says "puis validez" while taps still run the read path and nothing validates | low | rejected — tap-to-select and validation are Story 52.3 by the frozen Never list; 52.2 alone is not shippable to users without 52.3 |
| 8 | Edge | Button not gated on `loading()` / errors | low | rejected — Boundaries require it always visible on the three routes |
| 9 | Edge | Month ⇄ Week remount drops the in-progress selection silently | low | rejected — selection lives in the views (AD-7); existing behavior of any view switch |
| 10 | Blind | `group-new` check ignores `interaction`; edit-composer cells discarded without confirmation | false | `composeTarget` is only non-null while composing (`exitCompose` clears it); discarding without confirmation is the frozen requirement |
| 11 | Blind | `.declare-grid` border shifts layout by 4px; contrast, forced-colors, reduced-motion, 36px target | low | rejected — values are the frozen ones (2px solid, 36px); not checkable without the browser, which was unavailable |
| 12 | Blind | Tone keys copied into three files; `declare_banner` has no parity check | false | existing convention; `theme-tone.service.spec.ts` already enforces key parity and the identical list |
| 13 | Blind | No SSE evaluation noted (CLAUDE.md) | low | patch — evaluation recorded in Implementation Notes |
## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 fixed-date rail tests failing before 52.1
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error other than TS6059
