---
title: 'Story 51.5 — Calendar, Destiny and poll icons'
type: 'feature'
created: '2026-11-02'
status: 'done'
baseline_commit: 'd9e656f8a6b95b43ed20bb92923000b3e52002e6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The calendar, the Destiny (vote) surfaces and the polls still use Material icons, hand-drawn inline SVGs and icon characters (✦ ☰ ‹ › ⌄ ⌃ ▾ ▴ ✎ ✅ ⚠ ❌ ❔) as icons: they differ per device font, carry no theme identity, and the availability counters are told apart by emoji colour.

**Approach:** Replace them all with `<app-icon>` (Story 51.1) across `features/calendar/` and `features/poll/`, move the "no vote" warning out of a tone string into a `ConfirmDialog` field, drop `MatIconModule` from the three calendar components that used it, and lower the `<mat-icon` ratchet ceiling by 8 (17 → 9).

## Boundaries & Constraints

**Always:**
- `<mat-icon>`: month and week views `precedent` / `suivant` / `aujourdhui` (button accessible names unchanged); `constraint-panel` close `fermer`, delete `supprimer`. `MatIconModule` leaves `calendar-month-view.ts`, `calendar-week-view.ts`, `constraint-panel.ts`.
- Characters → icons, same orientation as today: the three `⚠` before confirmation prompts of `constraint-panel.html` → `avertissement`; `✦` → `destinee` in `destiny-control.html` (chip), `destiny-list.html`, `destiny-board.html`, `conflict-dialog.html` and the side dock; `☰` ("Affichage" trigger in `calendar-view.html`, a `&#9776;` entity) → `menu-affichage`; `‹ ›` of `destiny-control.html` and `side-dock.html` → `precedent` / `suivant`; `destiny-sheet.html` `⌄ ⌃` (expanded / collapsed) → `deplier` / `replier`; `available-slots.html` `▾ ▴` (folded / unfolded) → `deplier` / `replier`; `compose-bar.html` `✎` → `modifier`.
- Side dock: `boardDockLabel` (`calendar-view.ts`) returns the title only; `side-dock` gets the icon name as a separate input and renders it before the label (vertical label stays readable).
- Availability counters: `STATUS_ICONS` of `creneau-card.ts`, `aggregated-creneau-card.html` (✅ ⚠️ ❌) and `ANSWER_ICONS` of `poll-status.ts` (✅ ❌ ❔) → `dispo-oui` / `dispo-partiel` / `dispo-non` (YES / MAYBE-unknown / NO). Numbers and `title`s stay. The unsaved-answer `⚠` of `poll-response.html` → `avertissement` with `label` = `pollui.response_not_saved_aria` (the name moves from the span to the icon, never both). `poll-status` and `poll-response` are deleted in 54.2/54.3: only the minimum.
- `pollui.status_choose_no_vote_warning` loses its leading `⚠️ ` in the three tone files (rest of the sentence unchanged). `ConfirmData` (`confirm-dialog.ts`) gets an optional `warning?: string`, shown under the message preceded by a decorative `avertissement` icon; `onChooseClick` (`poll-status.ts`) passes it instead of concatenating it to the question.
- Slot icons (morning / afternoon / evening) drawn inline in `calendar-week-view.html` (rows, keep `row.label` as the `label`) and `calendar-detail-rail.html` (decorative) → `matin` / `apres-midi` / `soir`.
- Icons beside text or inside a button with an `aria-label` are decorative; sizes only through `--app-icon-size` (replace `font-size`/`width` rules and glyph classes that sized the old characters). Keyboard shortcuts and gestures unchanged (existing tests stay green). Ratchet ceiling 17 → 9 (recount with the test's own algorithm).
- ⚠️ Validated screens touched: calendars (month, week, agenda), Destiny surfaces, constraint panel, poll status, confirm dialog. Comments in French; `import type` only for `IconName`.

**Never:**
- Change a label other than the `⚠️` of `pollui.status_choose_no_vote_warning`; touch `→`/`+` written in labels; touch other `<mat-icon>` or the sealing/date-fix flows; read `activeTheme()` to pick an icon; add a fallback icon; redraw icons; install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Counters | oui / partiel / non in `creneau-card`, `aggregated-creneau-card`, `poll-status` | `dispo-oui` / `dispo-partiel` / `dispo-non`, three distinct names, numbers and titles kept | N/A |
| Destiny chip | any theme | `destinee` icon, changes in place on theme switch | N/A |
| Dock | board open | dock label is the title; `destinee` comes from the icon input | N/A |
| Chooser, no vote | "Choisir cette date" on an option without votes | confirm dialog shows `avertissement` before the warning, message is the plain question | N/A |
| Chooser, votes | option with votes | no warning block, no icon | N/A |
| Unsaved answer | `poll-response` option error | `avertissement` named `pollui.response_not_saved_aria` | N/A |
| Tone files | 3 themes | `pollui.status_choose_no_vote_warning` has no `⚠` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/{calendar-month-view,calendar-week-view}/*.html|ts` -- 3 `<mat-icon>` each (lines ~8, 16, 25), `MatIconModule`; week view rows 64-75 inline SVG slots.
- `.../constraint-panel/constraint-panel.{html,ts}` -- `close` ~12, `delete` ~107, `⚠` ~116, 136, 158.
- `.../destiny-control`, `destiny-list`, `destiny-board`, `conflict-dialog` (`✦` at html ~13, 10, 3, 66), `destiny-sheet` (~56), `available-slots` (~11), `compose-bar` (~44), `side-dock` (~15, 29, label input ~40), `calendar-detail-rail` (~19-30 slot SVGs), `aggregated-creneau-card` (~7-11), `creneau-card.ts` (`STATUS_ICONS` ~16).
- `.../calendar-view/calendar-view.{html,ts}` -- trigger ~58 (`&#9776;`), `boardDockLabel` ~1547, dock binding ~444.
- `apps/web/src/app/features/poll/{poll-status,poll-response}` -- `ANSWER_ICONS` (`.ts` ~34), counters (`.html` ~15), `onChooseClick` (~109), `⚠` (`poll-response.html` ~31).
- `apps/web/src/app/features/parties/confirm-dialog/confirm-dialog.ts` -- `ConfirmData`, inline template (already imports `AppIcon`).
- `apps/web/src/app/core/theme/tones/*.ts` -- `pollui.status_choose_no_vote_warning` (~1286, 1283, 1288).
- `apps/web/src/app/core/icons/{app-icon.ts,mat-icon-ratchet.spec.ts}` -- reuse; ceiling. Specs that mock `ThemeToneService` with `tone` only must gain `activeTheme` where an themed icon now renders.

## Tasks & Acceptance

**Execution:**
- [x] `calendar-month-view`, `calendar-week-view`, `constraint-panel` (html, ts, scss) -- icons, drop `MatIconModule`
- [x] Destiny surfaces, `calendar-view` trigger and dock label, `side-dock`, `destiny-sheet`, `available-slots`, `compose-bar`, slot SVGs -- characters and inline SVGs to `app-icon`
- [x] Counters (`creneau-card`, `aggregated-creneau-card`, `poll-status`) and `poll-response`
- [x] `confirm-dialog.ts` `warning` field, `poll-status.ts` `onChooseClick`, the three tone files
- [x] Specs: update and add tests per matrix row (three distinct counter names across the three components; Destiny chip changes with the theme; no `✦ ✅ ❌ ⌄ ⌃ ☰` left in the templates of `features/calendar/` and `features/poll/`; tone strings; confirm dialog with and without `warning`; `poll-status.spec.ts`, `confirm-dialog.spec.ts`); ratchet ceiling

**Acceptance Criteria:**
- Given any theme, when the theme changes, then the Destiny icon changes in place and the utility icons do not.
- Given `ng test --watch=false`, eslint on touched files and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures may remain, pre-existing; `partie-detail.spec` may time out under full-suite load, check it alone).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Counters (aggregated card, poll-status) and creneau-card status lost their spoken meaning: decorative icons beside bare numbers, `aria-label` on a role-less span (blind, edge) | medium | patch (applied) | Confirmed in the templates; icons now carry a `label` from existing tone keys, the status span has `role="img"`. |
| 2 | Chevron mapping (`deplier`/`replier`) and nav/action icon names pinned by no test (verification-gap, blind, edge) | medium | patch (applied) | Confirmed by grep of the specs; `data-icon` assertions added per component, plus a small `destiny-list.spec.ts`. |
| 3 | Character guard incomplete (`⚠ ✎ ❔ ▾ ▴ ‹ ›`, hex entity) (blind, edge) | low | patch (applied) | Direct extension of the forbidden set; `.ts` inline templates stay out (their comments legitimately cite the characters). |
| 4 | Invisible U+FE0F literal in a regex of `poll-status.spec.ts` (blind) | low | patch (applied) | Written as an escape. |
| 5 | Delete button icon at the 24px default (edge) | low | patch (applied) | Sized 1.125rem in `constraint-panel.scss`. |
| 6 | `UNKNOWN` and `MAYBE` share `dispo-partiel`; `deplier` named for the glyph, not the state (blind, verification-gap) | false | rejected | Both mappings are imposed by the story's AC (same orientation as the old glyphs). |
| 7 | Side-dock icon spacing wrong in `vertical-rl` (edge) | false | rejected | The icon is a flex sibling of the label, outside the vertical writing-mode box; `margin-block-end` is vertical there. |
| 8 | `creneau-card` fallback `❓` removed; unknown status renders blank (blind, edge) | low | rejected | `SlotStatus` is a closed union; `app-icon` logs an error. |
| 9 | Warning block semantics, missing-tone guard, `inline-flex` wrapping, 22px chevron targets, import order, test style (blind, edge) | low | rejected | Pre-existing or cosmetic; fixes add guards; `poll-status`/`poll-response` are deleted in 54.2/54.3. |
| 10 | Ratchet is global, no per-zone zero check (blind) | low | rejected | The AC asks for a ceiling; Story 51.8 makes it strict. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/calendar src/app/features/poll src/app/features/parties/confirm-dialog src/app/core` -- expected: no error on touched lines
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: counters readable at 14-16 px and told apart by shape, Destiny chip, vertical dock label, week-view slot icons, chevron orientations.
