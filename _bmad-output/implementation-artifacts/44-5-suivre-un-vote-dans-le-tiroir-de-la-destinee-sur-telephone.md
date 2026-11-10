---
title: 'Story 44.5 — Suivre un vote dans le tiroir de la destinée, sur téléphone'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: '4e60b5e18d42170cbd4309ca651e286375539577'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Below 768 px an active Destinée shows nothing about the vote: no board (44.4 is ≥ 768 px only), only the ‹ n/N › chevrons and the dimmed grid. A phone user cannot see the current slot's yes count, the deadline or their state, nor list the other slots, without leaving the grid.

**Approach:** ⚠️ Below 768 px the board becomes a non-modal bottom drawer `DestinySheet` (mockup `mockups/proposition-tiroir-destinee-mobile.html`, panels ② and ③). Collapsed (≈ 120 px) it summarises the current slot; expanded it holds the full 44.4 board. The usual right-hand content stays stacked under the grid, unchanged.

## Boundaries & Constraints

**Always:**
- Sheet shown only when `!isWide()` (< 768 px), a Destinée is active, its `OpenPollEntry` is known, view ≠ Agenda, not composing — the exact mirror of `destinyBoardShown`. It closes with the Destinée; it opens **collapsed** on each entry (`enterDestiny`/`exitDestiny` reset it).
- Collapsed content: poll title, `n / N · {date} {moment} · x oui · fin du vote {date}` (`vote terminé` once ended; deadline part omitted without `expiresAt`), the state pill (`À faire` / `Répondu` / `Organisateur` / `Vous ne votez pas`, reusing `calendar.destiny_state_*` and one shared state derivation with `destinyListItems`), and `Voir les N dates`. Expanded: the 44.4 board (same `destinyBoard()` model, no second source) and a `Replier` button.
- Toggle by the handle **or** the "Voir les N dates" button, both `aria-expanded` + `aria-controls`; no action reachable by dragging only. Touching a slot in the expanded sheet keeps it expanded (chevrons stay reachable above).
- Region `role="region"` named `Destinée : {nom}`; no focus trap, not modal (no backdrop). One `aria-live="polite"` region in the sheet announces the slot on each change (the embedded board's own region is switched off to avoid a double announcement).
- Fixed above the shell's bottom nav (`--shell-nav-bar-height` + safe-area), z-index below dialogs/overlays. Collapsed it never hides the whole grid; the page gets matching bottom padding so no content stays unreachable. 44 px targets. `prefers-reduced-motion`: no height animation.
- Tones for the three themes, neutral wording in evening mode (no JDR word, no "partie"); no voter `userId` in the DOM; French comments; no dependency; Docker only.

**Never:**
- No "Fixer la date…" / "Prolonger" / "Modifier" (44.6), no `?poll` link (44.7), no party filter (44.8), no change ≥ 768 px, no change to the stacked right-hand content below 768 px, no new route or endpoint, no change to the two `PollStatusPanel`s.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Entry | < 768 px, choose a vote | sheet collapsed, grid + usual column intact | N/A |
| Expand | handle or "Voir les N dates" | `aria-expanded=true`, full board, button reads `Replier` | N/A |
| Walk | ‹ / › or touch a slot | summary/current slot update, announced once | N/A |
| Ended | `expiresAt` day < today | `vote terminé`, no "fin du vote {date}" | N/A |
| No deadline | `expiresAt` null | summary without a deadline part | N/A |
| Leave | quit the Destinée / poll vanishes | sheet gone | N/A |
| Not shown | ≥ 768 px, Agenda, composing | no sheet (board or usual column as before) | N/A |
| Organizer, vitrine | `can.choose` | pill `Organisateur`; expanded board keeps "voir qui" | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/destiny-sheet/` (new, pure render, model on `destiny-board`) -- `DestinySheetModel` `{ region, title, summary, state, stateLabel, board, datesLabel, hideLabel, expandAria, collapseAria, announcement }`; input `model`, `expanded`; outputs `toggled`, `slotChosen`, `whoRequested`; hosts `<app-destiny-board [announce]="false">`.
- `apps/web/src/app/features/calendar/destiny-board/destiny-board.{ts,html}` -- add `announce = input(true)`; live region rendered only when true.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html,scss}` -- factor the state derivation out of `destinyListItems` (~L1136) into one private helper; add `destinySheetExpanded`, `destinySheetShown`, `destinySheet` (model, reuses `destinyBoard()`); reset in `enterDestiny`/`exitDestiny` (~L1100); template: `<app-destiny-sheet>` after the board `<aside>` (~L356); `calendar-page--sheet-collapsed/-expanded` bottom padding in SCSS.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~L777, 44.4 block ~L2060) -- 8 `calendar.destiny_sheet_*` keys: `region`, `deadline_open`, `deadline_ended`, `dates_one`, `dates_many`, `hide`, `expand_aria`, `collapse_aria` (`deadline_*` differ per theme; the other six are neutral).
- Reuse: `shortDayLabel`, `SLOT_LABELS`, `fillTone`, `destinyBoard()`/`destinyEntry()`/`destinySlotPosition()`, `openDestinyWho`, `chooseDestinySlot`, `todayKey`. Fixed-sheet pattern: `.display-surface--sheet` in `calendar-view.scss` and `shell.scss` nav bar (`--shell-nav-bar-height`).
- Specs: new `destiny-sheet.spec.ts`; `calendar-view.spec.ts` (new block next to "plateau de la destinée (Story 44.4)", ~L5072; `desktop: false` fakes < 768 px); `destiny-board.spec.ts` (`announce`); tone spec.

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + `theme-tone.service.spec.ts` -- 8 sheet keys, neutral ones listed, no JDR word -- UX-DR14
- [x] `destiny-board.*` -- `announce` input (default true) -- single live region
- [x] `destiny-sheet` component (+ scss: handle, peek, pill, fixed position above nav, reduced motion) -- UX-DR11
- [x] `calendar-view.*` -- shown rule, expanded state + resets, sheet model, shared state helper, template, bottom padding -- AC flow
- [x] Tests: sheet render (collapsed text, expanded board, both toggles with `aria-expanded`/`aria-controls`, region name, single live region); CalendarView (shown < 768 px only, collapsed on entry, re-collapsed after leave/re-enter, not in Agenda/composing/wide, usual column still stacked, walk updates summary, ended/no-deadline summaries, pill states, "voir qui" through the sheet); tone parity

**Acceptance Criteria:**
- Given a phone-width calendar, when I choose a vote in the ✦ list, then a collapsed drawer shows the title, `2 / 5 · … · 4 oui · fin du vote …`, my state pill and "Voir les 5 dates", and the grid stays visible.
- Given the collapsed drawer, when I touch "Voir les 5 dates" or the handle, then the full board appears (`aria-expanded="true"`) and touching a slot moves the grid to its day.
- Given the Destinée is left, when the list closes, then the drawer is gone and the stacked column is unchanged.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the three review layers were replaced by one inline self-review of the diff.
- New `destiny-sheet` (pure render): handle button (bar + title + summary when collapsed, bar only and an explicit label when expanded), state pill, hidden body hosting `<app-destiny-board [announce]="false">`, "Voir les N dates" / "Replier" button, one `aria-live` region. `destiny-board` gained `announce` (default true).
- `calendar-view`: `destinyPresentable` factored out of `destinyBoardShown`; `destinySheetShown` is its `!isWide()` mirror; `destinySheetExpanded` is reset in `enterDestiny`/`exitDestiny`; `destinyStateOf` shared by the list and the sheet; page classes `calendar-page--sheet` / `--sheet-open` add bottom padding below 768 px.
- Tones: 7 `calendar.destiny_sheet_*` keys per theme (`expand_aria` dropped during self-review: collapsed, the handle is named by its own text, so the key and the model field were dead); 5 neutral, 2 (`deadline_*`) with a theme voice. The Code Map above still says 8 keys.
- Tests: web suite passes except the 3 known date-dependent failures (2 `calendar-view` rail specs, 1 `calendar-week-view`); `tsc` shows only the existing TS6059 rootDir noise. Remaining eslint findings in `calendar-view.ts` (732, 1833, 2299) are on lines this story did not touch.
- Visual check done 2026-10-24 in Chrome (same-origin iframe at 375 × 812, real account, one ended vote with 2 slots, organizer): collapsed 116 px above the bottom nav with the grid visible; expanded 306 px with the full board and the live region unique; wording right in the three themes (Atelier Cuivré « scrutin clos », Grimoire and Forêt « vote terminé »). Not exercised: `prefers-reduced-motion`, a real touch device, a vote with answers (yes bar), the player pill states.
- Process note: step 3 said to stage the diff and a `git add -N .` marked new files intent-to-add (no content staged) — the same slip as 44.3/44.4 against the repo's git rule.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | `expandAria` and its tone key were never read (dead field/key) | low | grep found no consumer; removed with its tests, 7 keys remain |
| 2 | Expanded state survives a narrow → wide → narrow rotation | low | the sheet unmounts at ≥ 768 px and returns as the user left it; harmless, resets on any entry or exit |
| 3 | Fixed sheet could overlap the shell's bottom nav or other fixed panels | false | `bottom` adds `--shell-nav-bar-height` + safe-area (nav is z-index 10, sheet 11); display panel and constraint sheet are z-index 200 and stay above |
| 4 | Two live regions would announce the slot twice | false | board's region switched off by `announce=false`; tested (one `aria-live` collapsed and expanded) |
| 5 | Collapsed sheet could hide the whole grid on a short screen | low | collapsed height is ≈ 120 px; verified only by design, real-device check listed under Verification |
| 6 | `aria-controls` points at a `hidden` empty body when collapsed | false | the element exists (tested); an empty hidden controlled region is valid |
| 7 | Remaining eslint/prettier findings in `calendar-view.ts` and the tone spec | false | predate this story (lines 732, 1833, 2299; same lines as before) |
| 8 | `git add -N .` run in step 3 | low | process slip, no content staged; reported in the closing message |

## Design Notes

Decided without the human (invisible or forced): the expanded sheet stays open after a slot is touched, since the ‹ › chevrons above remain reachable and collapsing would lose the list; the handle toggle's accessible name is its text when collapsed and an explicit label when expanded; the embedded board's live region is disabled so the sheet owns the single announcement.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no new error (TS6059 rootDir noise excepted)

**Manual checks (if no CLI):**
- 375 px, three themes: collapsed ≈ 120 px above the bottom nav, expanded board scrolls inside, grid never fully covered when collapsed, reduced motion has no animation.
