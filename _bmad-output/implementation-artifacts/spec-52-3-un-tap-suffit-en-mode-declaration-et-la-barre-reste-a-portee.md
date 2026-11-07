---
title: 'Story 52.3 — One tap is enough in declaration mode, and the bar stays within reach'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '5a9b3f4b0308e725d3e8eeb339bfdb39089de806'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 52.2 lights the declaration mode, but a tap still only reads: declaring needs the long-press, and the selection bar sits under the grid, out of sight on a phone.

**Approach:** In `declaration`, the Month and Week views turn a tap into add/remove of a slot, a horizontal drag into an immediate selection, and `Échap` into "empty the selection, else leave the mode"; the selection bar sticks to the bottom; each successful save reports its slot count in a snackbar and keeps the mode on. No server change.

## Boundaries & Constraints

**Always:**
- Tap on a band (morning/afternoon/evening) adds the slot or removes it if selected; the bar shows from the first slot. The rail stays on its day (no `slotSelected`), no vote-answer picker opens, the current-date marker (`currentDate` Month, `currentCell` Week) follows the last tapped slot.
- A tap on the day number adds/removes the whole day (`FULL_DAY`, counts as one slot): Month, the cell outside its bands; Week, the column header `.col-header`.
- A drag starting on a slot along the days selects at once, no long-press, finger or mouse, and ADDS its range to the slots already kept; a drag starting vertical stays a page scroll (36.3 AC5 axis rule, applied to the Week view in this mode as well; `touch-action: pan-y` on the grid in this mode). A double-click is two taps; no `dblclick` handler.
- Removing the last slot hides the bar, the mode stays on; the bar's "Annuler" empties the selection without leaving the mode; "Autre…" keeps each theme's label (`calendar.selbar_other`) and opens the constraints panel as today, mode on.
- "Disponible", "Indisponible" or `Entrée` save through `onBatchDeclareRequested` → `createDeclarationBatch` (conflict dialog included), empty the selection and keep the mode on. After a successful save, direct or after a conflict resolution, a snackbar gives the gesture's slot count (a day = 1), singular/plural: Grimoire "N créneaux déclarés disponibles" / "1 créneau déclaré disponible", "N créneaux déclarés indisponibles" / "1 créneau déclaré indisponible"; Forêt "marqués"/"marqué"; Atelier "consignés"/"consigné". None if the conflict dialog is abandoned; failure keeps the current message; read mode unchanged.
- `selection-bar` receives `interaction`; in `declaration` only it sticks to the screen bottom (`selection-bar-sticky`: `--jdr-surface-bg`, shadow `0 -4px 16px` `--jdr-overlay`, padding 8px 12px), and the grid keeps a reserved margin below so the bar never hides its last row; in read mode it stays in the flow.
- `Échap`: the view empties a non-empty selection, otherwise asks `calendar-view` (new output) to leave the mode, like "Terminer". With focus on the toggle button or the banner, `calendar-view` calls the same view method. A keystroke is handled once; an open panel, list or dialog keeps priority as today.
- Keyboard unchanged (`Espace`, `1/2/3`, `Maj`+arrows, `Entrée`). Read mode and the Composer gesture (45.3) unchanged. Only existing `--jdr-*` variables; new tone keys in the three files, "singular/plural" pairs per theme.
- French comments and messages.

**Never:** server change; a new colour token; persisting the mode; acting on `?declarer=1` (52.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tap adds / removes | Mode on, tap a band twice | Selected then not; bar shown then hidden; mode on | N/A |
| Day number | Tap the Month cell body or Week header | `FULL_DAY` toggled, counts 1 | N/A |
| Drag | Horizontal drag from a slot | Range added to kept slots; vertical drag scrolls | N/A |
| Save | 3 evenings + a day → "Disponible" | "4 créneaux déclarés disponibles", selection empty, mode on | Conflict dialog abandoned: no snackbar; failure: current message |
| Escape | Selection non-empty / empty | Selection emptied / mode off | N/A |
| Read mode | Tap, long-press, drag | As before 52.3 | N/A |

</frozen-after-approval>

## Code Map

- `calendar-month-view/calendar-month-view.ts|html|scss` -- `onCellClick` (L~654, emits `slotSelected` then arbitrates), `onGridPointerMove` (touch branch cancels on move; mouse branch has the axis rule), `armDrag`/`armSelection`/`setRange` (replace the selection), `toggleCell`, `onEscape` (L~1098), `onSelectionCommit`; selection bar at html L~211.
- `calendar-week-view/calendar-week-view.ts|html|scss` -- twin code: `onCellClick` (L~635), `onGridPointerMove` (no axis rule), `armDrag`, `onEscape` (L~1074), `.col-header` (html L~48, no handler today).
- `selection-bar/selection-bar.ts|html|scss` -- pure render component; add `interaction` input and `:host(.selection-bar-sticky)` style.
- `selection.utils.ts` -- shared helpers; a `mergeCells` dedupe/sort helper fits here.
- `calendar-view/calendar-view.ts|html` -- `onBatchDeclareRequested` (L~3723) and `resolveBatchConflicts` (success path after the dialog); `declare-arm` and `.declare-banner` (52.2) get a `keydown.escape`; `viewChild` on the mounted view for the delegation; `[interaction]` already bound to both views.
- Tone files + `theme-tone.service.spec.ts` -- four new snackbar keys per theme (`calendar.declared_available_one/many`, `calendar.declared_unavailable_one/many`), voices differ per theme so not in `NEUTRAL_KEYS`.
- Specs: month, week, selection-bar, `calendar-view.spec.ts` (52.2 describe is the template).

## Tasks & Acceptance

**Execution:**
- [x] tone files -- four snackbar keys x three themes, with `{n}`
- [x] `selection.utils.ts` + month and week views -- tap toggles in `declaration` (no `slotSelected`, marker follows), day number / `.col-header` as `FULL_DAY`, drag without long-press with axis rule and union, `touch-action`, `onEscape` ordering with a new `declarationExitRequested` output, public method for the delegation
- [x] `selection-bar` + views' scss -- `interaction` input, sticky style, grid margin
- [x] `calendar-view.ts|html` -- snackbar after success (direct and after conflict), `Échap` on button and banner, handler for the new output
- [x] specs -- month, week, selection-bar, calendar-view: tap add/remove, day number and header, drag without long-press / vertical start / union, double-click, last slot hides bar, rail still and marker follows, save keeps mode, snackbar singular/plural in three themes, after conflict, absent after abandon, sticky only in `declaration`, `Échap` order and single handling, read mode and Composer intact

**Acceptance Criteria:**
- Given the mode on, when I tap three evenings and a Saturday number then "Disponible", then "4 créneaux déclarés disponibles" shows, the selection is empty and the mode is still on.
- Given the mode off, then every gesture, shortcut and screen is identical to 52.2.

## Implementation Notes

- Implemented directly (no subagent). Views: tap toggles in `declaration` (no `slotSelected`, marker follows), no long-press timer, touch drag follows the axis rule, `dragBase` + `mergeCells` give the add-only drag, `pointercancel` ignored, `onEscape` public with a new `declarationExitRequested` output. `selection-bar` takes `interaction` and sticks via `:host(.selection-bar-sticky)`. `calendar-view`: `announceDeclared()` after each successful save, `onDeclareEscape()` delegating to the mounted view, `endDeclaration()`. Tone keys `calendar.declared_{available,unavailable}_{one,many}` in the three themes.
- Spec deviation to know: the frozen text names `--jdr-on-primary`, `--jdr-text-primary`, `--jdr-surface-bg` and `--jdr-overlay`, which exist nowhere in `styles.scss` (only `--jdr-bg`, `--jdr-surface`, `--jdr-text`, `--jdr-accent-1`, ...). The intent "existing variables only" was kept by mapping them to the real tokens, which also repairs the 52.2 button and banner text colours.
- Not seen in a browser (Claude in Chrome not connected): the sticky bar, the outline and `touch-action: pan-y` over the Month cells (`touch-action: none` in read mode) need an eye on a phone. The recipe of the walkthrough stays manual.
- Verification: web suite 4752 pass, 2 fail (the fixed-date rail tests failing before 52.1); `tsc` clean apart from TS6059.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Blind | `--jdr-surface-bg` / `--jdr-overlay` (sticky bar) are defined nowhere, so the bar had no background or shadow | high | patch — confirmed by grep of `styles.scss`: the same holds for `--jdr-on-primary` and `--jdr-text-primary` used since 52.2. All four exist only in this epic's wording. Replaced by the real tokens `--jdr-surface`, `--jdr-bg` (text on the accent fill, as `status-badge`), `--jdr-text`, and a `color-mix` of `--jdr-bg` for the shadow, each with its hex fallback |
| 2 | Blind, Edge | `pointercancel` (browser takes the scroll) is routed to the tap branch, so starting a scroll could toggle a slot | high | patch — `onGridPointerUp` ignores `pointercancel` in declaration mode, both views; tests added |
| 3 | Blind, Edge, Gap | Stale `dragBase` merged back by `setRange` on a later Maj+arrow | medium | patch — the merge only applies while a drag is armed; test added |
| 4 | Edge, Gap | The long-press timer still armed a drag in declaration, so a slow tap on a selected slot re-added it | medium | patch — no long-press timer in declaration mode, both views; test added |
| 5 | Blind, Edge | Week column header mouse-only | medium | patch — in declaration mode it is `role="button"`, `tabindex="0"` (not for past days), Enter/Space; tests added |
| 6 | Edge | `Échap` on the button or banner ignored an open panel, list or dialog | medium | patch — `onDeclareEscape` returns while any is open; test added |
| 7 | Gap | `mergeCells` dedup untested; weak week assertion; past-day header and Week-view Escape untested | medium | patch — unit tests, overlap assertions, past-header test, Week `Échap` test added |
| 8 | Blind, Edge | A whole day and its partial slots can be selected together, giving an internal 409 on save | medium | defer — the same mix was already possible in read mode (cell body = `FULL_DAY` next to bands); the header only makes it likelier. Dropping same-day partials would change selection rules beyond this story |
| 9 | Blind, Edge | The snackbar counts the gesture's cells even when the user kept some existing declarations in the conflict dialog | low | rejected — the frozen requirement says "le nombre de créneaux du geste" |
| 10 | Edge | The snackbar is skipped if the mode is turned off while the save is awaited | low | rejected — a tap on "Terminer" within the save latency; the fix threads a flag through the recursion |
| 11 | Edge | `announceDeclared` with a count of 0 prints the singular | false | the commit path returns early on an empty selection, so 0 never reaches it |
| 12 | Edge | A mouse vertical move inside a band still ends in a click that toggles | low | rejected — a click with more than 8px of jitter is still a click; fingers get no click after a scroll |
| 13 | Edge | The Week axis rule also applies to the mouse | false | the frozen Boundaries apply it to the Week view in this mode |
| 14 | Blind | `margin-bottom` does not stop a sticky bar hiding rows; no safe-area inset; `SelectionBar` has `composeMode` next to `interaction`; `onEscape` made public; `elementFromPoint` stubbed by assignment; copied twin blocks | low | rejected — values are the frozen ones (reserved margin, `interaction` on the bar); the stubbing and twin-block patterns are the repo's existing ones |
## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 fixed-date rail tests failing before 52.1
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error other than TS6059

**Manual checks (no browser available at planning):**
- Nina's walkthrough on phone and desktop in the personal calendar: three evenings and the Saturday number, bar stuck at the bottom → "Disponible" → snackbar, mode on → two evenings "Indisponible" → "Terminer".
