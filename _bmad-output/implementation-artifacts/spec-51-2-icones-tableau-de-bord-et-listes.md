---
title: 'Story 51.2 — Dashboard and list-control-bar icons'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: '9c26e44ec2fb251e679878d81178bbae934a9115'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard cards and the list control bar still draw their icons with Material Icons (`star`, `shield`, `person`, `flag`…): overloaded meanings (finished vs signal both `flag`; GM and admin both `shield`; player and account both `person`) and no theme identity.

**Approach:** Replace the 11 `<mat-icon>` of `features/dashboard/dashboard.html` and the 5 of `shared/list-control-bar/list-control-bar.html` with `<app-icon>` (Story 51.1), through `roleIconName`, a typed `tintIcon` and `modeIcon`, and lower the `<mat-icon` ratchet ceiling accordingly.

## Boundaries & Constraints

**Always:**
- Mapping: favorite `favori-pose` / `favori-vide` (state read from the shape; the button keeps `favoriteAriaLabel`); hide from list `masquer`; role indicator `roleIconName(partie.role, { soireeIsolee: partie.kind === 'ONE_SHOT' })`; closed `etat-terminee`; cancelled `etat-annulee`; signal badges `signal`; accept / refuse invitation `valider` / `fermer`; list bar: `filtres`, `rechercher` (both search fields), `reinitialiser`, view modes `vue-large` / `vue-moyenne` / `vue-compacte`.
- `roleIcon(partie)` is deleted (replaced by `roleIconName`). `tintIcon(tint)` returns `IconName | null`: `live` → `etat-en-cours`, `soon` → `etat-a-venir`, `done` → `etat-terminee`, `cancelled` → `etat-annulee`, `todo` → `null`; the template renders no icon for `null` (text only, never a fallback). `modeIcon(mode)` returns an `IconName`.
- An icon next to text is decorative (the `app-icon` default); a lone icon in a button is decorative too and the button keeps its accessible name (`favoriteAriaLabel`, `hideAriaLabel`, `modeAriaLabel`), never a second name on the icon. Sizes through `--app-icon-size` set by the parent stylesheet (replace the `mat-icon { font-size/width/height }` rules: signal badge ~0.9rem, favorite and bar buttons ~1.1rem, `.role-icon` keep its current size).
- `MatIconModule` leaves `dashboard.ts` and `list-control-bar.ts`; the ratchet ceiling in `mat-icon-ratchet.spec.ts` drops by 16 (75 → 59, recount with the test's own algorithm).
- ⚠️ Validated screens touched: dashboard cards, list control bar. No label, class name used by other tests, layout or behavior change. Comments in French.

**Never:**
- Touch other `<mat-icon>` usages, labels, tone files, `index.html` or the registry; read `activeTheme()` to choose an icon; add a fallback icon; install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Favorite | `isFavorite` true / false | `data-icon` `favori-pose` / `favori-vide`, button name unchanged | N/A |
| Role | mj / admin of a group / admin of a `ONE_SHOT` / player / member | `role-mj` / `role-admin` / `role-hote` / `role-joueur` / `role-joueur` | N/A |
| Tint | live, soon, done, cancelled, todo | `etat-en-cours`, `etat-a-venir`, `etat-terminee`, `etat-annulee`, `null` | `null` renders text only |
| Status badges | `TERMINEE` / `ANNULEE` | `etat-terminee` / `etat-annulee` next to the written word | N/A |
| Theme switch | `setTheme()` from Account | Meaning icons of the cards change in place, utilities do not | N/A |
| View modes | large / medium / compact | `vue-large` / `vue-moyenne` / `vue-compacte`; button text content stays empty of labels | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/dashboard/dashboard.html` -- 11 `<mat-icon>` (invitation lines 18-19, favorite and hide buttons in the compact list ~222-234 and in the cards ~295-307, role ~317, closed ~323, cancelled ~330, tint ~338, signal badge ~355).
- `apps/web/src/app/features/dashboard/dashboard.ts` -- `roleIcon` (~188, delete), `tintIcon` (~470), `MatIconModule` import (19, 100); `roleLabel` (~161) shows the `ONE_SHOT` test to reuse.
- `apps/web/src/app/features/dashboard/dashboard.scss` -- `mat-icon` rules at ~206 (signal badge) and ~256 (favorite button), `.role-icon` ~165.
- `apps/web/src/app/shared/list-control-bar/list-control-bar.{html,ts,scss}` -- 5 `<mat-icon>`, `modeIcon` (~74), `mat-icon` rule ~63; buttons keep `modeAriaLabel`.
- `apps/web/src/app/core/icons/{app-icon.ts,role-icon-name.ts,icon-registry.generated.ts}` -- reuse; `IconName` type via `import type` only (registry is statically imported by `app-icon.ts`, nothing else should import values).
- `apps/web/src/app/core/icons/mat-icon-ratchet.spec.ts` -- `MAT_ICON_CEILING`.
- `dashboard.spec.ts` (`querySelector('mat-icon')` at ~207, 447, 496, 578, 776; `roleOf` at ~1741 asserting `shield`/`person`) and `list-control-bar.spec.ts` (~66) -- move to `app-icon[data-icon]`.

## Tasks & Acceptance

**Execution:**
- [x] `dashboard.html`, `dashboard.ts`, `dashboard.scss` -- migrate the 11 icons, delete `roleIcon`, type `tintIcon`, drop `MatIconModule`, size via `--app-icon-size`
- [x] `list-control-bar.{html,ts,scss}` -- migrate the 5 icons, `modeIcon` → `IconName`, drop `MatIconModule`
- [x] `dashboard.spec.ts`, `list-control-bar.spec.ts` -- look for `app-icon[data-icon]`; add tests for every matrix row (favorite pair, `tintIcon` per tint without fallback, MJ ≠ group admin ≠ soirée host ≠ player, theme switch changes a card icon but not a utility)
- [x] `mat-icon-ratchet.spec.ts` -- lower the ceiling

**Acceptance Criteria:**
- Given the dashboard in any theme, when the theme changes, then card icons of meaning change without reload and utility icons (`valider`, `fermer`, `filtres`, `rechercher`, `reinitialiser`, `vue-*`) do not.
- Given `ng test --watch=false`, `ng lint` on touched files, and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Invitation accept/refuse icons render at the 24px default instead of a button-icon size (edge) | medium | patch (applied) | Confirmed: no `--app-icon-size` on `mat-card-actions app-icon`; fixed with a 1.125rem rule in `dashboard.scss`. |
| 2 | `--app-icon-size: 1.1rem` declared twice in `list-control-bar.scss` (blind, verification-gap, edge) | false | rejected | The two blocks target different selectors (search wrapper vs toggle/mode/reset buttons); neither is redundant. |
| 3 | `tintIcon` null branch not rendered in a test (blind, edge) | low | rejected | The template gates on `live`/`soon`, so a null result cannot be reached from a render; the unit test covers all five tints. |
| 4 | Theme-switch test could pass vacuously; one theme only; first-match selectors (blind, edge) | low | rejected | Verification-gap checked it: role, closed and favorite drawings are asserted to change; extra iteration would add machinery. |
| 5 | `mj`/other kinds on `ONE_SHOT` untested; `roleIconName` rule in template (blind, edge) | low | rejected | The flag matters only for `admin` and is documented and tested in `role-icon-name.spec.ts` (51.1). |
| 6 | Favorite pair not proven different by shape; `fermer` for refuse; casts and test hygiene in specs (blind) | low | rejected | The 51.1 registry spec already forbids identical drawings in a theme; `fermer` is the mapping imposed by the story; hygiene points do not change behavior. |
| 7 | Detail page still uses Material icons for the same states (edge claim) | low | rejected | Transitional by design: later zone stories, ratchet at 59. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the 2 known `calendar-view` date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/dashboard src/app/shared/list-control-bar src/app/core/icons` -- expected: clean
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: card icons readable at 16 px, favorite pair distinguishable by shape.
