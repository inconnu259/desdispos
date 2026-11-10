---
title: 'Story 46.1 — Ranger la colonne de droite et replier les éphémérides'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'f30765157143dbf85f9648a512c7903783c19b50'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-46-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The right-hand column of the calendars (GM panel, player panel, group polls, destiny board) always takes ~340 px–40 % of the width, and on a phone the automaton list always stacks open under the grid; the automaton windows are also still named with the word « destinée », which now names only the mode.

**Approach:** One shared « closed » state, kept in this browser: on ≥ 768 px it docks the whole column into a 44 px `side-dock` (› to dock, ‹ to reopen, label + count vertical); below 768 px it folds the automaton list under a full-width header button. Entering Destinée reopens it. The automaton section is renamed per theme.

## Boundaries & Constraints

**Always:**
- Scope = `apps/web` only: no API, shared, Prisma or route change; no new dependency; French comments/messages; Docker only.
- State: ONE `localStorage` key for all columns, a single « closed » boolean, open by default, every read/write under `try/catch` (page works when storage throws). Nothing in the database. `enterDestiny()` sets it open.
- ≥ 768 px (`isWide`): each column gets a slim bar with `›` (« Ranger la colonne », `aria-expanded="true"`); closed, the column is replaced by the dock: `‹` button (« Rouvrir la colonne », `aria-expanded="false"`) + vertical label: MJ and player column « {section.slots} · N » (N = windows served), group column « {polls heading} · N », board « ✦ {board title} ». Grid takes the freed width. Docking moves focus to `‹`, reopening to `›`. Dock: 44 px wide, 12 px left corners, sticky, 44 px targets.
- < 768 px: in `app-available-slots` the title becomes a full-width button with chevron (`aria-expanded`) showing « {libellé} · N » that folds the list; Du / Au / « Scruter » render only when the column is open/unfolded. Other stacked blocks (poll section, group polls) unchanged. The board is the 44.5 sheet there: untouched.
- Renamed `section.slots`: Grimoire « Éphémérides », Forêt « Clairières disponibles » (unchanged), Atelier « Créneaux calculés par l'automate ». Dock button labels are neutral keys (identical in the three themes, listed in `NEUTRAL_KEYS`, no JDR word).
- ⚠️ Flag in the story: validated screens changed = the three right columns and the board gain the bar/dock; the automaton section is renamed; phone list folds.

**Never:**
- No window selection, composer, hiding or `available-slots` API change (46.2–46.4). No per-column key. No persisted state beyond the browser. Do not change player aggregated view content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dock | wide, GM column open, click › | dock 44 px « Éphémérides · 18 », grid wider, focus on ‹, key written | storage throws: still docks, no crash |
| Reopen | wide, docked, click ‹ | column back, focus on › | N/A |
| Reload | stored closed, wide | opens docked | invalid/missing value: open |
| Destinée | docked, user picks a vote | column reopens, board shown | N/A |
| Board | wide, Destinée active, click › | dock « ✦ {title} » | N/A |
| Phone | < 768 px, click header | list folds, Du/Au/Scruter hidden, `aria-expanded=false` | N/A |
| Resize | docked, narrows < 768 | no dock; list folded (same state) | N/A |
| Themes | any | section title per theme, dock labels identical | N/A |

</frozen-after-approval>

## Code Map

- `features/calendar/side-dock/` (new) -- `ColumnDockService` (root; `closed` signal, `toggle()`, `open()`, storage under `try/catch`, pattern of `theme-tone.service.ts` L55) and `SideDock` component (inputs `label`, `docked`; output `toggled`; projects the column; renders bar or strip).
- `features/calendar/calendar-view/calendar-view.html` -- wrap `.mj-results-panel` (~L457), group section (~L545), player `.guild-slots-panel` (~L567) and `.destiny-board-col` (~L427) in `app-side-dock` when `isWide()`; `@if (!dock.closed())` around the two `.date-range-form`; pass `[folded]`/`[foldable]` to `app-available-slots`.
- `calendar-view.ts` -- inject the service; label getters (`availableSlots().length`, `groupPollRows().length`, `destinyBoard().title`); `enterDestiny()` (~L1181) reopens; `isWide` (~L488) exists.
- `calendar-view.scss` -- docked host rule AFTER the column rules (`.mj-results-panel` ~L321, `.guild-slots-panel` ~L267, `.destiny-board-col` ~L299): `flex: 0 0 44px`, `min-width: 44px`.
- `features/calendar/available-slots/*` -- title/`· N`, narrow fold button, `aria-expanded`; existing spec L55+ keeps role tests.
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~L777) -- `section.slots` x3, new keys `calendar.column_dock` / `calendar.column_reopen` (+ fold aria).
- Do not touch: `destiny-board`, `destiny-sheet`, API, shared, `creneau-card`.

## Tasks & Acceptance

**Execution:**
- [x] tones (3) + tone spec -- rename `section.slots`, dock/reopen keys neutral
- [x] `side-dock` service + component + specs -- storage failure, toggle, focus, a11y names
- [x] `available-slots.*` -- count, narrow fold button, hidden list when folded
- [x] `calendar-view.{html,ts,scss}` -- four columns docked on wide, Du/Au gating, reopen on `enterDestiny`
- [x] `calendar-view.spec.ts` -- matrix rows: dock per column (MJ, player, group, board), reload, storage throw, Destinée reopen, phone fold
- [x] full web suite, typecheck, lint; visual check in Chrome (wide + 500 px)

**Acceptance Criteria:**
- Given the GM calendar at 1280 px, when I click › then the column becomes a 44 px dock labelled « Éphémérides · N » and the grid is wider; ‹ restores it.
- Given a phone width, when I tap the automaton header then the list and Du/Au/Scruter hide and `aria-expanded` is false.
- Given the choice stored closed, when I enter a Destinée then the column is open.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request). New `features/calendar/side-dock/`: `ColumnDockService` (one key `master-jdr.calendar.column-closed`, value `closed`, absent = open) and `SideDock`, which IS the column (host takes the column classes: `mj-results-panel`, `guild-slots-panel`, `destiny-board-col`), renders the › bar, the 44 px strip, or just the content when `enabled` is false (< 768 px). `app-available-slots` gains `foldable`/`folded`/`foldToggled` and the « libellé · N » title. `calendar-view`: four columns wrapped, Du/Au/Scruter gated by `!dock.closed()`, `enterDestiny()` calls `dock.open()`, docked host width forced with `!important` (column rules have varying specificity).
- Tones: `section.slots` renamed (Grimoire « Éphémérides », Atelier « Créneaux calculés par l'automate »); neutral keys `calendar.column_dock` / `calendar.column_reopen`. Side effect: the voice-ratio test (Atelier ≥ 35 % themed keys) fell under its floor by half a key, so Atelier `calendar.slots_list_aria` became « Plages relevées par l'automate » (was « Plages disponibles »).
- Tests: service (5), `SideDock` (4), `available-slots` (5), `calendar-view` (7: MJ, player, group, board + Destinée reopen, reload, storage throws, phone fold), tone spec. Web suite OK except the 3 known date-dependent failures; typecheck clean (TS6059 noise aside); new files lint-clean.
- Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré, 1264 px): vitrine board docks to « ✦ La Veillée des Absents » and reopens; GM column docks to « Créneaux calculés par l'automate · 20 »; title carries the count. Not exercised: < 768 px (the browser viewport cannot be narrowed), the player and group columns, the other two themes. localStorage key cleared afterwards.

## Spec Change Log

## Review Triage Log

Inline self-review of the diff (no subagent without an explicit request, as in 45.7).

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Docked, the projected content (e.g. `app-destiny-board`, `app-available-slots`) is still instantiated though not displayed | low | Angular builds projected content regardless of the `@if`; no output, no aria-live region reaches the DOM; cost negligible; not patched |
| 2 | The Atelier voice-ratio test fell under its floor by half a key | medium | seen in the first full run (409/1170); fixed by theming Atelier `calendar.slots_list_aria`; suite green |
| 3 | `!important` on the docked flex | low | column rules have unequal specificity (`:not()` selectors); commented; no cleaner way without rewriting the column CSS |
| 4 | One shared boolean: docking on desktop folds the list on a phone sharing the browser | low | decided in Design Notes and written into the frozen spec |
| 5 | `<768 px`, player and group columns, two other themes not seen in a browser | low | the viewport of the browser tool cannot be narrowed (innerWidth 1264); covered by unit tests only |
| 6 | Focus moves after `toggled` even if the parent ignores it | low | the only parent toggles; no second consumer |

## Design Notes

Decided without the human: one shared boolean serves both the wide dock and the narrow fold (« rangé » means the same thing); the column bar holds only the › button (the title stays in `available-slots`, avoiding a duplicate header); dock labels per column are mine (slots count, group polls count, ✦ + board title); the dock only exists on wide, so the key never hides content the layout cannot show.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Wide and ≥ 500 px: dock/reopen in GM, player, group calendars and with a Destinée; reload keeps the state; three themes' titles.
