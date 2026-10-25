---
title: 'Story 45.3 — Choisir les jours du vote comme ses dispos'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'f2a8c931a1aa5f93ce35ff5d19777994fe9af4e5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** While the composer is armed, the availability gesture (long press 450 ms or drag, then a scope bar) is switched off in both grids: the organizer can only tap one band at a time, so « every Friday evening of November » takes a dozen taps.

**Approach:** In composition, a long press or a drag selects several days; the selection bar, in a composition version, lets them pick the moment (Journée only in JDR · Matin · Après-m. · Soir) and « Ajouter au vote », « Retirer » or « Annuler ». Each selection ADDS to the slots already designated, without any modifier key. The short tap (36.10) and the keyboard are unchanged.

## Boundaries & Constraints

**Always:**
- Month and Week views, desktop and phone, same behaviour (the two views are twins: every change goes in both). `armSelection` no longer refuses while `composing()`; Shift+arrows and keyboard arming stay as they are (`1` `2` `3`, `Espace` toggle a composed band; `Entrée`, `Échap` unchanged).
- A tap with no selection open toggles ONE band of the composition (unchanged). With a selection open, a tap toggles that band in the SELECTION (as for availabilities). The click a finished gesture emits is swallowed BEFORE the composition toggle, in both views.
- `app-selection-bar` gains a composition mode (`composeMode`, `fullDayAllowed` inputs; `composeAdd`, `composeRemove` outputs; `cancelled` = Annuler): it hides Sceller, Disponible, Indisponible and « Autre… », offers the scope segments (Journée hidden when `fullDayAllowed` is false), « Ajouter au vote » (disabled with a written hint while the scope is a full day where it is refused) and « Retirer ». Labels per theme (3 voices); announcement in plain words; targets 44 px.
- Views emit `composeAdded(cells)` / `composeRemoved(cells)`; only `CalendarView` changes `composedCells`: add = union with the existing cells, dedupe by `composeCellKey`, order kept; remove = difference; a full day for a group/evening target is refused with the existing written reason (`composeRefusal`), never silently. Rules unchanged: two slots minimum, Valider blocked below with its reason; the JDR server bound (40) stays — no API change.
- `Échap` with a selection open closes the bar only; with none it leaves the composer (36.10 AC3). Selection state is cleared when the composer opens or closes. Selecting never writes anything: only « Valider » does.
- Rail, Destinée suspension, `composedKeys` rendering, the 45.1/45.2 flows and the availability gesture outside the composer are untouched. French comments; no dependency; Docker only; no API or shared change.

**Never:**
- No duration, deadline or preview of a range (45.4, epic 47); no change to the compose bar contents; no new route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Drag in Month | composing, drag over 4 days | 4 days selected, composition bar opens, nothing composed yet | N/A |
| Add with a moment | 4 days selected, « Soir », « Ajouter au vote » | 4 Evening slots added to the composition, bar closes | N/A |
| Cumulative | 2 slots composed, then another selection added | union, no loss, no duplicate | N/A |
| Remove | selection over composed bands, « Retirer » | those slots leave the composition | N/A |
| Long press, phone | composing, 450 ms hold on a cell | one day selected, bar opens, trailing click swallowed | N/A |
| Tap, no selection | composing | one band toggles (unchanged) | N/A |
| Tap, selection open | composing | the band toggles in the selection | N/A |
| Full day, evening mode | group target, Journée | segment absent; if the cells are full-day, Ajouter disabled with a hint | refusal text if forced |
| Past or other-month cells | drag over them | ignored, as for availabilities | N/A |
| Échap | bar open / bar closed | closes the bar / leaves the composer | N/A |
| Outside composition | availability gesture | exactly as before | N/A |

</frozen-after-approval>

## Code Map

- `calendar-month-view/calendar-month-view.{ts,html}` and `calendar-week-view/calendar-week-view.{ts,html}` -- `armSelection` guard, `onCellClick` order (suppress → composing → selection toggle), `onEscape`, `onScopeChange`, bar bindings, new outputs/inputs, effect clearing the selection on `composing` change; keep both twins identical (comments say so). Reuse `setRange`, `toggleCell`, `selectedCells`.
- `selection-bar/selection-bar.{ts,html,scss}` -- composition mode; `SCOPE_OPTIONS` filtered by `fullDayAllowed`; spec.
- `calendar-view/calendar-view.{ts,html}` -- `onComposeAdded` / `onComposeRemoved`, `composeAllowsFullDay` (not a group target), bindings on both views; reuse `isGroupTarget`, `composeRefusal`, `composedCells`, `composeCellKey`.
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- `calendar.selbar_compose_add`, `_remove`, `_pick_moment`.
- Specs to rewrite: `calendar-month-view.spec.ts` l.1636-1770 and `calendar-week-view.spec.ts` l.1066-1150 (« n'arme plus la sélection » becomes the new behaviour); keep the tap, keyboard and vote-picker-blocked tests.
- Do not touch: `compose-bar`, availability batch commit path (`onSelectionCommit`), API, `packages/shared`.

## Tasks & Acceptance

**Execution:**
- [ ] tones (3 themes) + tone spec -- add / remove / hint labels
- [x] `selection-bar.*` + spec -- composition mode
- [ ] month and week views -- gesture in composition, new outputs, Escape, click order, selection reset
- [x] `calendar-view.*` -- cumulative add / remove, full-day refusal, bindings
- [ ] Specs -- every matrix row in views and `CalendarView`; full web suite and typecheck

**Acceptance Criteria:**
- Given the composer is armed, when I drag across four Fridays and choose « Soir » then « Ajouter au vote », then the four evenings are in the composition and a later selection adds to them.
- Given a selection is open in composition, when I tap « Retirer », then those slots leave the composition and nothing is written.
- Given an evening-mode composer, when I open the bar, then « Journée » is not offered and a full-day add is refused in writing.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- `selection-bar`: `composeMode` / `fullDayAllowed` inputs, `composeAdd` / `composeRemove` outputs, `scopeOptions` (no « Journée » when refused), `addBlocked` (« Ajouter au vote » disabled with a written hint while the scope is a refused full day); Sceller, Disponible, Indisponible and « Autre… » are hidden in composition. Tone keys `calendar.selbar_compose_add`, `_remove`, `_pick_moment` (3 voices).
- Month and Week views (twins, edited identically): `armSelection` no longer refuses while composing (the keyboard still composes directly before reaching it; Shift+arrows stays inert); `onCellClick` swallows the gesture's trailing click BEFORE the composition toggle, and with a selection open a tap toggles the SELECTION; `onEscape` closes an open bar first; `onComposeAdd` / `onComposeRemove` emit `composeAdded` / `composeRemoved` and close the bar; an effect clears the selection whenever `composing()` changes; `composeFullDay` input.
- `CalendarView`: `composeAllowsFullDay` (not a group target), `onComposeAdded` (union by `composeCellKey`, existing order kept, a full day for a group is dropped with the written reason in `composeRefusal`), `onComposeRemoved`; both views are bound to them.
- Specs: the 36.10 « long press no longer arms » test was replaced by 7 month tests and 6 week tests (arming, add, remove, tap with a selection open, Échap order, selection cleared, no « Journée »), 7 bar tests, 5 + 1 `CalendarView` tests (cumulative add, full day in JDR and in a group, remove, no write, bindings). The month test of a second tap needs a `pointerdown` first: in a browser the next tap resets the swallowed-click flag, in jsdom nothing does.
- Verification: web typecheck (app and spec) OK; full web suite OK except the 3 known date-dependent failures; eslint: nothing new (the `calendar-view.ts` finding predates). Not exercised in a browser: the gesture itself (it needs an armed composer, and the real account has no dateless JDR séance; none was created), phone width, the three themes.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | The trailing click of a finished gesture could compose the selected cell | high | the click guard now precedes the composition toggle in both views; tested (month) |
| 2 | An open selection bar could survive leaving or entering the composer | medium | effect clears the selection on `composing()` change in both views; tested |
| 3 | Group full-day add could slip through the bar | medium | segment hidden, Ajouter disabled with a hint, and `onComposeAdded` drops full days with the written reason; tested |
| 4 | The JDR cap of 40 slots contradicts « sans plafond » | low | decided in Design Notes: lifting it is an API change; the existing blocked reason stays |
| 5 | `Maj`+arrows stay inert while composing | low | the story keeps the keyboard unchanged; not a regression |
| 6 | Month and Week duplicate the new methods | low | the two views are declared twins in their own comments; a shared helper would touch availability code outside this story |

## Design Notes

Decided without the human: with a selection open, a tap edits the selection (availability rule) rather than the composition; Échap closes the bar before leaving the composer; the JDR cap of 40 slots stays although the story says « sans plafond » — lifting it is an API change outside this story; the composition bar is the same `app-selection-bar` in a mode, not a new component.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.spec.json` -- expected: no new error (TS6059 excepted)

**Manual checks (if no CLI):**
- Armed composer, Month and Week, mouse drag and phone long press; the three themes; evening-mode (group) refusal.
