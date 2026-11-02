---
title: 'Story 51.6 — Characters, scenarios and Homme Dragon icons'
type: 'feature'
created: '2026-11-02'
status: 'done'
baseline_commit: '0b7f9ea92f2e3ce41843c19b31212d516c74fc57'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The character sheet, creation wizards, notes, scenarios and Homme Dragon sheet still use Material icons and icon characters (❮ ❯ 🔒 🔓 ▾ ▴ ▸ ✎ ✕ ✓ ⚠ ⋮ ›) that vary by device font, carry no theme identity, and are written into three tone strings.

**Approach:** Replace them with `<app-icon>` (Story 51.1) across `features/characters/`, `features/scenarios/` and `features/homme-dragon/`, strip the characters from the tone files, drop `MatIconModule` from four components, and lower the `<mat-icon` ratchet ceiling by 5 (9 → 4).

## Boundaries & Constraints

**Always:**
- `<mat-icon>` → `<app-icon>`: `arrow_back` → `retour` (`character-sheet.html` ×2, `scenario-detail.html`); the two `description` of `scenario-editor.html` → `document`. `MatIconModule` leaves `character-sheet.ts`, `scenario-detail.ts`, `scenario-editor.ts` and `my-characters.ts` (unused import).
- Characters → icons: notes `🔒 🔓` (`notes-journal.html`, `scenario-read-dialog.html`) → `cadenas-ferme` / `cadenas-ouvert` (same state mapping as today); `❮ ❯` of `character-wizard.html` → `precedent` / `suivant`, in the lone icon buttons (keep their `aria-label`) and before/after the written label of the bottom buttons; the Homme Dragon creation wizard buttons that use `common.precedent_2` / `common.suivant_2` get `precedent` / `suivant` icons before / after their text; `▾ ▴ ▸` of `class-step.html` (open `replier`, closed `deplier`), `equipment-step.html` and `reserve-picker.html` (open `deplier`, closed `deplier` rotated −90° for `▸`) and the `&#9662;` of the export menu in `homme-dragon-sheet.html` → `deplier`; the `›` of `character-creation-entries.html` → `ouvrir`; `field-edit-pencil.html` `✎ ✕ ✓` → `modifier` / `fermer` / `valider`; `inventory-item-row.html` `✎ ✕` → `modifier` / `supprimer`; `⚠` of `encumbrance-bar.html` and `reserve-section.html` → `avertissement`; the saved `✓` of `reserve-section.html` → `valider`; the `&#8942;` (⋮) menu trigger of `character-sheet.html` → `menu-actions`.
- Tone files (all three): `common.precedent_2` / `common.suivant_2` lose `❮ ` / ` ❯`; the three notes sentences lose their ` (🔒)` (rest unchanged: e.g. "…brisez le sceau pour qu’elle apparaisse…"); `scenarios.seances_heure_malformed` loses its leading `⚠️ `. `seance-list.html` (~267, `heureMalformedWarning`) shows a decorative `<app-icon name="avertissement">` before the text.
- A lone icon in a button keeps the button's `aria-label` (never a second name); a lone icon not in a named button gets `label` from an existing tone key (if none exists, report instead of inventing one). Icons beside text are decorative. Sizes only through `--app-icon-size` (replace `font-size` rules that sized the glyphs; keep tap targets and rotation animations). Existing tests for gestures and labels stay green.
- "→" and "+" written in labels stay text. Ratchet ceiling 9 → 4 (recount with the test's own algorithm).
- ⚠️ Validated screens touched: character sheet and wizard, notes, scenarios, Homme Dragon sheet and wizards. Comments in French; `import type` only for `IconName`.

**Never:**
- Change any label other than removing the characters named above; touch other `<mat-icon>`; read `activeTheme()` to pick an icon; add a fallback icon; redraw icons; install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Note lock | `shared` true / false | `cadenas-ouvert` / `cadenas-ferme`, two different names | N/A |
| Wizard nav | first / last step | `precedent` / `suivant` icons; disabled states unchanged | N/A |
| Fold toggles | open / closed | `class-step` `replier` / `deplier`; `equipment-step`, `reserve-picker` `deplier` / `deplier` rotated −90° | N/A |
| Edit pencil | read / edit mode | `modifier` / `valider` + `fermer`, button names unchanged | N/A |
| Bad appointment time | `malformedHeureRdv` set | `avertissement` icon before the tone text without `⚠` | N/A |
| Tone files | 3 themes | no `❮ ❯ 🔒 🔓` in any value, none in `scenarios.seances_heure_malformed` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/characters/character-sheet/` -- `character-sheet.{html,ts}` (arrow_back 4 and 10, ⋮ at ~61, `MatIconModule` 18 and 175); `field-edit-pencil/field-edit-pencil.html` (~24, 33, 43); `inventory-tab/{inventory-item-row,encumbrance-bar}.html`; `notes-journal/notes-journal.html` (~22, 33).
- `.../characters/character-wizard/character-wizard.html` (~15, 25, 138, 145) and `steps/{class-step,equipment-step}/*.html` (~103, ~117); `.../my-characters/my-characters.ts` (unused `MatIconModule` ~3, 39) and `character-creation-entries/character-creation-entries.html` (~22).
- `apps/web/src/app/features/scenarios/` -- `scenario-detail/scenario-detail.{html,ts}`, `scenario-editor/scenario-editor.{html,ts}` (~180, 206), `scenario-read-dialog/scenario-read-dialog.html` (~54), `seance-list/seance-list.{html,ts}` (~267, `heureMalformedWarning`).
- `apps/web/src/app/features/homme-dragon/` -- `homme-dragon-sheet.html` (~30), `reserve-picker.html` (~39), `reserve-section.html` (~21, 111), `homme-dragon-creation-wizard.html` (~241, 261).
- `apps/web/src/app/core/theme/tones/*.ts` -- `common.precedent_2` (~129), `common.suivant_2` (~150), the notes sentences (~936, 933, 930), `scenarios.seances_heure_malformed` (~903, 899, 896).
- `apps/web/src/app/core/icons/{app-icon.ts,mat-icon-ratchet.spec.ts}` and `features/calendar/calendar-icon-characters.spec.ts` -- reuse as pattern (a source-scanning guard spec). Specs that mock `ThemeToneService` with `tone` only need `activeTheme` where a themed icon now renders.

## Tasks & Acceptance

**Execution:**
- [x] `character-sheet`, `field-edit-pencil`, `inventory-*`, `encumbrance-bar`, `notes-journal`, wizards and steps, `my-characters` -- migrate icons and characters, drop `MatIconModule`
- [x] `scenario-detail`, `scenario-editor`, `scenario-read-dialog`, `seance-list` -- icons, warning icon, drop `MatIconModule`
- [x] Homme Dragon sheet, picker, section, creation wizard -- icons
- [x] three tone files -- strip the characters; adapt existing tone tests
- [x] Specs: matrix rows (lock ≠ unlock, wizard arrows, fold toggles, pencil modes, `avertissement` before the bad time in `seance-list.spec.ts`); a guard spec: none of `❮ ❯ 🔒 🔓` in tone values and none of `❮ ❯ 🔒 🔓 ▾ ▴ ▸ ✎ ✕ ✓ ⋮ ›`/`&#9662;`/`&#8942;` in `.html` outside comments under `features/characters/`, `features/scenarios/`, `features/homme-dragon/`; ratchet ceiling

**Acceptance Criteria:**
- Given any theme, when the theme changes, then themed icons (`retour`, `cadenas-*`, `document`) change in place and utility icons do not.
- Given `ng test --watch=false`, eslint on touched lines and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Error-branch back link of the character sheet has no icon assertion (verification-gap) | low | patch (applied) | Confirmed: the new test covered the success branch only; one assertion added to the 403 test. |
| 2 | Guard spec scans `.html` only, not inline `.ts` templates or scss; incomplete glyph list (`▲ − → × ✔`) (blind, edge) | low | rejected | A grep finds no inline template with these characters; the AC lists exactly the characters to remove; `▲` (level-up badge) and `−` are not in UX-DR53. |
| 3 | `▲` badge in `character-summary-card.html`, `✕ ▾ ▸` in `shared/detail-surface` still text (blind, verification-gap) | low | rejected | Out of the AC's character list; `detail-surface` is a shared surface planned for Story 51.7. |
| 4 | Private-note hint lost "(🔒)" and no longer points to the control (blind) | low | rejected | Imposed by the AC ("le reste de la phrase étant inchangé"). |
| 5 | Chevron patterns differ (icon swap vs rotation), rotation uses a transition without reduced-motion guard (blind, edge) | false | rejected | Mapping imposed by the AC (`▸` = `deplier` rotated −90°); the transitions were kept from the existing styles. |
| 6 | Pencil button is 22px, not 44px (edge claim) | low | rejected | Size unchanged by this story; pre-existing. |
| 7 | Shared tone keys `common.precedent_2`/`suivant_2` stripped; test hygiene (`@ts-expect-error`, 60 s timeout, `indexOf`, spec wording vs registry) (blind) | low | rejected | The only consumer (Homme Dragon wizard) gets icons; test-only hygiene; `retour` and `cadenas-*` being utilities is a spec wording slip, the registry is the source of truth. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/characters src/app/features/scenarios src/app/features/homme-dragon src/app/core` -- expected: no error on touched lines
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: wizard arrows, fold toggles orientation, note locks, pencil/inventory buttons keep a 44 px target.
