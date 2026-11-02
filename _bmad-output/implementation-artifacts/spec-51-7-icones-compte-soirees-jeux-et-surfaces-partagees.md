---
title: 'Story 51.7 — Account, evenings, board games and shared surfaces icons'
type: 'feature'
created: '2026-11-02'
status: 'done'
baseline_commit: 'ca239125a625978bd1db4c7330336fc4ae768516'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Account page, evenings, board games and shared surfaces still mix Material icons, icon characters (✎ › ✓ ♥ ▸ ▾ ✕ ⋮ ⚠) and hand-drawn inline SVGs (password eyes, identity shield and silhouette, cover pencil), so the last screens keep device-font icons and no theme identity.

**Approach:** Replace them all with `<app-icon>` (Story 51.1), remove the `⚠` from one tone string, drop `MatIconModule` from the last four components so the `<mat-icon` ratchet ceiling reaches 0 (from 4).

## Boundaries & Constraints

**Always:**
- `<mat-icon>` → `<app-icon>` and `MatIconModule` removed from `account.ts`, `delete-account-dialog.ts`, `theme-selector.ts`, `cancel-event-dialog.ts`: danger pill of `account.html` `supprimer`; `delete-account-dialog.ts` and `cancel-event-dialog.html` `warning` → `avertissement`; active theme check in `theme-selector.html` `actif` (decorative; state stays carried by the button, and `actif` ≠ `valider`).
- Account (`features/account/account.html`): email `✎` → `modifier` (button keeps its `aria-label`); Ludothèque row `›` → `ouvrir`, and that row (`board-games-row`) gets the themed `jeux` icon first, decorative (its title is written; the only `jeux` in this palier); the logout button gets a decorative `quitter` icon before its text.
- `shared/password-reveal/password-toggle.html`: the two inline eyes → `oeil` (hidden) / `oeil-barre` (revealed), same logic as today; these two icons are used only here. `shared/identity/identity-label.html`: shield / silhouette inline SVGs → `<app-icon>` via `roleIconName` (`mj` / `player`); `shared/nature-marker` stays out of the set. `shared/detail-surface/detail-surface.html`: `✕` → `fermer` (accessible name unchanged), `▾ ` / `▸ ` before the narrative toggle text → `deplier` (open) / `deplier` rotated −90° (closed), on every surface using it.
- Board games / evenings: `event-form.html` `✓` → `valider`; `envy-toggle.ts` `&#9829;` (both places) → `envie`, keeping the active state style (`accent-2`) and the accessible names; `games-section.ts` `▸ ▾` → `deplier` (rotated −90° when collapsed); `games-summary.ts` and `features/board-games/group-games-tab/*.html` `✕` of the active chips → `effacer`; `board-games-page.html` `✎` → `modifier`; `game-row.ts` `&#8942;` → `menu-actions` (name "Actions pour {jeu}" and the 44 px target unchanged).
- `event_games.already_at` loses its leading `⚠ ` in the three tone files (rest unchanged); the `warnText` block of `game-row.ts` shows a decorative `avertissement` icon before the text.
- `features/parties/partie-form/partie-form.html`: the inline pencil SVG of the "Changer" cover chip → decorative `<app-icon name="modifier">`; "Retirer" stays without icon; no inline `<svg>` left in the cover chips.
- Icons beside text or in a named button are decorative; a lone icon without a named button gets `label` from an existing tone key (none exists → report). Sizes only through `--app-icon-size` (replace the `font-size` / `width` rules and inline SVG sizing; keep tap targets, rotation transitions, `accent-2` state). Existing behavior and labels unchanged. Ratchet ceiling 4 → 0 (recount with the test's own algorithm).
- ⚠️ Validated screens touched: Account, evenings, board games, password fields (login, signup, reset, account, deletion), identity labels, shared detail surfaces, cover chip. Comments in French; `import type` only for `IconName`.

**Never:**
- Change a label other than removing `⚠ ` from `event_games.already_at`; redraw icons; read `activeTheme()` to pick an icon; add a fallback icon; touch the logo, brand strip, system badges, creation icon or nature marker; remove the Material font link (Story 51.8); install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Theme selector | active / inactive theme | `actif` only on the active one, never `valider` | N/A |
| Password toggle | revealed / hidden | `oeil-barre` / `oeil`, `aria-pressed` unchanged | N/A |
| Envy | mine / not mine / count only | `envie`, active style on mine, names unchanged | N/A |
| Ludothèque row | account page | `jeux` first, changes with the theme; `ouvrir` last | N/A |
| Already at | `warnText` set | `avertissement` icon before the text without `⚠` | N/A |
| Cover chip | form | `modifier` on "Changer", no `<svg>` in `cover-chips` | N/A |
| Tone files | 3 themes | `event_games.already_at` has no `⚠` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/account/` -- `account.{html,ts}` (delete ~191, `✎` ~41, `›` ~112, board-games row ~107, logout ~172), `delete-account-dialog/delete-account-dialog.ts` (~95), `theme-selector/theme-selector.{html,ts}` (~14).
- `apps/web/src/app/features/events/` -- `cancel-event-dialog/cancel-event-dialog.html` (~25), `event-form/event-form.html` (~315), `event-games-tab/{envy-toggle,games-section,games-summary,game-row}.ts` (~39 and 65, ~31, ~32 and 44, ~51 and `warnText` ~82).
- `apps/web/src/app/features/board-games/` -- `board-games-page/board-games-page.html` (~195), `group-games-tab/*.html` (~33).
- `apps/web/src/app/shared/` -- `password-reveal/password-toggle.html`, `identity/identity-label.html` (+ scss sizing), `detail-surface/detail-surface.html` (~20, ~48); `features/parties/partie-form/partie-form.html` (~76).
- `apps/web/src/app/core/theme/tones/*.ts` -- `event_games.already_at` (~395, 391, 398). `core/icons/{app-icon.ts,role-icon-name.ts,mat-icon-ratchet.spec.ts}`; `calendar-icon-characters.spec.ts` and `personnages-icon-characters.spec.ts` as patterns for a source-scanning guard. Specs that mock `ThemeToneService` with `tone` only need `activeTheme` where a themed icon now renders.

## Tasks & Acceptance

**Execution:**
- [x] Account, theme selector, delete-account and cancel-event dialogs -- icons, `MatIconModule` removed
- [x] password toggle, identity label, detail surface, partie-form cover chip -- inline SVGs and characters to `app-icon`
- [x] event-form, envy toggle, games section/summary/row, group games tab, board-games page -- characters to `app-icon`; tone files `event_games.already_at`
- [x] Specs (per matrix row; `account.spec.ts`, `delete-account-dialog.spec.ts`, `cancel-event-dialog.spec.ts`, `partie-form.spec.ts`, `theme-tone.service.spec.ts` as the story names them) plus a guard spec: none of `♥ ✎ ✕ ✓ ▾ ▸ ⋮ ›`, `&#9829;`, `&#8942;`, `<svg` icons in the touched templates outside comments; ratchet ceiling 0

**Acceptance Criteria:**
- Given any theme, when the theme changes, then `jeux`, `envie` and the identity icons change in place and utility icons do not.
- Given `ng test --watch=false`, eslint on touched lines and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Active-chip `effacer` icon and the board-games pencil `modifier` unasserted (verification-gap) | low | patch (applied) | Confirmed by grep of the specs; three `data-icon` assertions added. |
| 2 | Sass mixed-declarations in `cancel-event-dialog.scss` (blind, edge) | low | patch (applied) | Nested `app-icon` block moved after the last declaration. |
| 3 | `identity-label` uses `role-mj` for a character-only label (blind, verification-gap) | low | rejected | Imposed by the story ("`role-mj` / `role-joueur` via `roleIconName`"); noted to the user. |
| 4 | Heart shows outline for both states, state by colour only (edge claim) | false | rejected | The old `♥` was the same glyph in both states, distinguished by pill style; behavior unchanged. |
| 5 | Chip and chevron spacing, `inline-flex`, rem vs px sizes, RTL, margin duplication (blind, edge) | low | rejected | Chip rules already set `inline-flex` and a gap; visual details for the browser check. |
| 6 | Partial `ThemeToneService` mocks elsewhere (`xp-history`, `xp-distribution-panel`) (blind, edge, verification-gap) | low | rejected | The full suite is green; those specs render no icon today. |
| 7 | Guard spec: hand-kept file list, narrow glyph set, brittle inline-template regex, duplicated plumbing (blind, edge) | low | rejected | Same pattern as the sibling guards; Story 51.8 replaces it with a strict repo-wide test. |
| 8 | Screen-reader cue of the old `⚠` in `already_at`; other consumers of the string (blind, edge) | low | rejected | The string is only rendered through `warnText`; the cue now comes from the written "déjà chez". |
| 9 | Added `jeux` and `quitter` icons not flagged; ratchet counts only `<mat-icon`; positional icon lists in `partie-detail.spec` (blind) | low | rejected | Both additions are required by the story and flagged ⚠️ in its text; Story 51.8 makes the test strict. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/account src/app/features/events src/app/features/board-games src/app/shared src/app/features/parties/partie-form src/app/core` -- expected: no error on touched lines
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: password eyes, envy heart active state, identity icons at 16 px, shared detail surfaces, game-row menu 44 px target.
