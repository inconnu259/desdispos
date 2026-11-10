---
title: 'Story 46.2 — Mettre une fenêtre de l’automate en évidence'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: '1803a5bdb44a97095d51b2cdaa7171d9b0fdc300'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-46-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/46-1-ranger-la-colonne-de-droite-et-replier-les-ephemerides.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The GM reads the automaton windows as a list of cards disconnected from the calendar: to judge whether a slot « tombe bien », they must find its day on the grid by hand.

**Approach:** Touching a card of the GM's automaton list selects that window: the card is outlined with two written actions, its band gets the same outline, every other day is dimmed (the Destinée dimming, .28) and the grid moves to its period. One window at a time; an ephemeral signal, never a layer.

## Boundaries & Constraints

**Always:**
- `apps/web` only: no API, shared, Prisma, route or dependency change; French comments; Docker only; ⚠️ flag the validated screens changed (GM automaton list, month and week grids).
- Selection exists only for the GM's nominative cards (`AvailableSlotDto`, atelier GM column). Players keep the aggregated list, no selection, no action (NFR2). Not in Agenda view (no dimming there; the list is hidden anyway).
- Selected card: 2 px solid `var(--mat-sys-primary)` outline (never dashed: dashed is the composer's), plus the written actions « Ajouter au vote » (filled) and « Masquer » (text), 44 px targets, shown but DISABLED (`aria-disabled`, no handler) — decided with the human: their effect arrives in 46.3 / 46.4, which only enable them. The card header is a real button (`aria-pressed`), so the gesture is keyboard-reachable; the whole card is also tappable.
- Grid: the window's band (month and week, the uniform band included) takes the same outline via a new `windowKey` input on both views (model: `composedKeys`); non-window days take `destinyDates` dimming with a one-element set, `day-cell--dim` semantics unchanged (no pointer or accessibility loss, a focused day stays crisp). Grid moves with `moveGridTo(date)`.
- One window at a time. Touching the selected card again, or `Échap`, deselects (and `Échap` already cancelling the grid selection stays as is). Deselect restores the normal display. The selection also clears when the window leaves the served list, and on leaving the GM atelier.
- Mode priority: composer > selected window > Destinée. With the composer open, selecting a card outlines it and dims nothing. Selecting while a Destinée is active suspends it (`destinyPresentable` false → board replaced by the GM column showing the selected card); deselecting restores it. During a Destinée, the board column keeps at its foot the automaton header « Éphémérides · N », folded; unfolding it shows the cards, and touching one suspends the Destinée.
- Real-time: nothing new (the list already reloads with the party signal).

**Never:**
- No composer, vote or server write from this story, no hide (46.3, 46.4), no hidden-window state. No second selected window, no persisted selection, no new layer.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Select | GM, month view, tap a card | card outlined with actions, band outlined, other days dimmed, grid on its month | N/A |
| Switch | another card tapped | previous deselected, new selected | N/A |
| Deselect | tap same card, or `Échap` | normal display | N/A |
| Composer open | select a card | outlined, nothing dimmed | N/A |
| Destinée active | unfold footer, tap card | board replaced by GM column; deselect brings the board back | N/A |
| Window vanishes | list reload without it | selection cleared | N/A |
| Player | aggregated card | no selection, no actions | N/A |
| Week view | select | cell outlined, other days dimmed | N/A |

</frozen-after-approval>

## Code Map

- `features/calendar/creneau-card/*` -- `selectable`/`selected` inputs, header button `aria-pressed`, whole-card tap, `selectToggled` + `addRequested`/`hideRequested` outputs, outline + action row.
- `features/calendar/available-slots/*` -- `selectable`, `selectedKey`, `slotSelected(slot|null)`; only `isMjSlot` cards get it; footer use needs `foldable` with its own `folded` (already supported, 46.1).
- `calendar-view.{ts,html,scss}` -- `selectedWindow` signal, `onWindowSelected`; `destinyDates` (~L1158) gains the window branch (after `composing()`), `destinyPresentable` (~L1342) gains `!selectedWindow()`; `moveGridTo` (~L1308) reused; document `Échap` listener; clear effect on `availableSlots`/mode; MJ column list `selectable`; board column footer inside `.destiny-board-col` for MJ (local `boardSlotsOpen`).
- `calendar-month-view/*` and `calendar-week-view/*` -- `windowKey` input, `band--window` / `slot-cell--window` (next to `band--composed` ~L254 / `slot-cell--composed` ~L197), aria label gets « fenêtre sélectionnée ».
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- `calendar.window_add`, `calendar.window_hide`, `calendar.window_selected_aria` (neutral keys; mind the Atelier voice-ratio floor, 46.1 note).
- Do not touch: `destiny-board`, API, shared, aggregated card.

## Tasks & Acceptance

**Execution:**
- [x] tones (3) + tone spec -- action and aria keys
- [x] `creneau-card.*` + spec -- selection, actions, a11y
- [x] `available-slots.*` + spec -- plumbing, GM-only
- [x] `calendar-month-view` / `calendar-week-view` + specs -- `windowKey` outline
- [x] `calendar-view.*` + spec -- selection state, dimming, priority, Destinée suspension, footer, `Échap`, vanish, matrix rows
- [x] full web suite, typecheck, lint; Chrome check

**Acceptance Criteria:**
- Given the GM atelier at 1280 px, when I tap a card then its band is outlined, other days are dimmed and the grid shows its month.
- Given a selected card, when I tap it again or press `Échap` then the display is normal.
- Given a Destinée on the board, when I unfold « Éphémérides · N » and tap a card then the Destinée is suspended, and deselecting brings the board back.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); one inline self-review of the diff instead of the review layers.
- `creneau-card`: `selectable` / `selected` inputs, `selectToggled` output, header button `aria-pressed`, whole-card tap, solid primary outline, disabled « Ajouter au vote » / « Masquer » (human decision, enabled in 46.3 / 46.4; their clicks do not bubble to the card). `available-slots`: `selectable`, `selectedKey`, `slotSelected`, exported `availableSlotKey` (same `AAAA-MM-JJ|créneau` format as `composeCellKey`). Month and week views: `windowKey` input, `band--window` / `slot-cell--window`, « fenêtre sélectionnée » added to the accessible names (the uniform band is outlined when the window falls on its day).
- `calendar-view`: `selectedWindow` signal, `onWindowSelected` (moves the grid with `moveGridTo`), `destinyDates` window branch right after the composer check (one-element set, so the existing dimming applies), `destinyPresentable` false while a window is selected (Destinée suspended, `destinyPollId` untouched), document `Échap` through the component `host`, an effect clearing the selection when the atelier/layer/Agenda goes away or the window is no longer served, and the folded « Éphémérides · N » footer in the board column (local `boardSlotsOpen`).
- Tones: `calendar.window_add` / `calendar.window_hide` neutral; `calendar.window_selected_aria` themed (Atelier « créneau de l'automate sélectionné », Forêt « clairière sélectionnée ») — three neutral keys pushed the Atelier voice-ratio test under its floor again, and a themed one brings it back.
- Tests: card (6), available-slots (3), month (3), week (3), calendar-view (10 incl. Destinée suspension, composer, vanish, Agenda, player, `Échap`), tone spec. Web suite OK except the 3 known date-dependent failures; typecheck clean; no new lint finding (remaining ones predate the story).
- Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré, 1264 px, month view): a card selected shows its outline and the two greyed actions, the 25 October evening band is outlined, 41 day cells dimmed; `Échap` clears everything. Not exercised: week view, the Destinée footer, composer open, narrow widths, the other themes.

## Spec Change Log

## Review Triage Log

Inline self-review of the diff (no subagent without an explicit request).

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | The Atelier voice-ratio floor fell again with three new neutral keys | medium | seen in the first full run (410/1173); `window_selected_aria` themed; suite green |
| 2 | Selection clears when the window is absent from a still-loading list | low | the effect waits for `slotsLoading()` to be false before judging absence |
| 3 | `Échap` also cancels a grid selection in progress | low | by design: both gestures share the key, the grid handler does not stop propagation; harmless |
| 4 | Disabled actions are `aria-disabled`, not `disabled`, so they stay focusable | low | wanted: a keyboard user reads that they exist; 46.3 / 46.4 enable them |
| 5 | Footer fold state is separate from the 46.1 column dock | low | decided in Design Notes; the dock only hides the whole column |
| 6 | Week view, Destinée footer, composer and narrow widths not seen in a browser | low | unit tests cover them; the live check covered month view, selection and `Échap` |

## Design Notes

Decided without the human: the window dimming reuses `destinyDates` (one source feeds both views); the selected key is `date|slot`; selection state lives in `calendar-view`, cards stay rendering-only; the board footer reuses `app-available-slots` with a local fold state.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Month and week views, GM atelier, with and without a Destinée and with the composer open.
