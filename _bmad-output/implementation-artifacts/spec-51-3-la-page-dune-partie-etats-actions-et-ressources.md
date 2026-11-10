---
title: 'Story 51.3 — Party page icons: states, actions and resources'
type: 'feature'
created: '2026-11-02'
status: 'done'
baseline_commit: 'f5f8e88a190f4a4787d3dd29f3ed74391dbfff62'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The party page (JDR and rallying) still draws its state banners, footer actions, XP/announcement buttons, ten download buttons and the dialog warning with Material Icons: `flag` means both "finished" and "close", `download` repeats ten times, and nothing follows the theme.

**Approach:** Replace 29 `<mat-icon>` (28 in `features/parties/partie-detail/partie-detail.html`, 1 in `confirm-dialog.ts`) with `<app-icon>` from Story 51.1, leaving members, invitations and the two "leave" actions to Story 51.4, and lower the `<mat-icon` ratchet ceiling from 59 to 30.

## Boundaries & Constraints

**Always:**
- Mapping: finished banner `etat-terminee`; cancelled banner `etat-annulee`; footer (all three action blocks) "Modifier" `modifier`, "Visibilité" `cadenas-ferme`, "Clore" `etat-terminee`, "Rouvrir" `rouvrir`, "Supprimer" `supprimer`; "Distribuer l'XP" `distribuer-xp`; announcement publish `proclamer`; the ten download buttons `telecharger`; the two download-sheet chevrons `deplier`; homonymy warning `information`; confirm dialog danger button `avertissement` (no icon when not destructive, as today).
- Chevrons: `deplier` points down; closed sheet rotated −90° (points right as today), open sheet upright. Rewrite the `rotate(90deg)` rule of `.download-sheet__chevron` accordingly.
- Icons next to a written label are decorative (the `app-icon` default). Sizes only through `--app-icon-size`: rewrite the `mat-icon { font-size/width/height }` rules of `partie-detail.scss` that apply to the migrated icons (chips ~1.1rem, closed banner 1rem), and the cancelled banner rule `.closed-banner--cancelled mat-icon { color }` to target `app-icon`. Keep `flex-shrink: 0` rules working for `app-icon`.
- `MatIconModule` leaves `confirm-dialog.ts` (replaced by `AppIcon`). It stays in `partie-detail.ts` (Story 51.4 removes it). Ratchet ceiling 59 → 30 (recount with the test's own algorithm).
- ⚠️ Validated screen touched: party page and confirm dialog. No label, behavior, class name or layout change. Comments in French; `import type` only for `IconName`.

**Never:**
- Touch the member lists, the invitations panel, `person_remove`, `shield`, `admin_panel_settings`, `logout` (×2), `exit_to_app`, `search`, `person_add`, `mail`, `link`, `content_copy`, `link_off` (Story 51.4); read `activeTheme()` to pick an icon; add a fallback icon; change tone files; install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Footer, GM | not finished / finished | "Clore" `etat-terminee` / "Rouvrir" `rouvrir`, plus `modifier`, `cadenas-ferme`, `supprimer` | N/A |
| Footer, group admin or soirée host | same | same icons for `modifier`, `etat-terminee`, `rouvrir`, `supprimer` | N/A |
| Banners | `TERMINEE` / `ANNULEE` | `etat-terminee` / `etat-annulee` beside the written word | N/A |
| Downloads | any of the 10 buttons | all show `data-icon="telecharger"` | N/A |
| Sheets | closed / open | `deplier`, rotated −90° / upright; same motion as before | N/A |
| Confirm dialog | `destructive` true / false | `avertissement` on the confirm button / no icon | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- lines ~10 and 25 (banners), 157 (XP), 172 (announcement), 274 and 313 (chevrons), 285-394 (ten downloads), 609 (homonymy), 649-704 (footer blocks, 11 icons: edit ×2, lock, flag ×3, replay ×3, delete ×2; plus the two `logout`/`exit_to_app` at 700/712 which stay).
- `.../partie-detail.scss` -- `mat-icon` rules ~54, 71, 327 (chips), 380 (banner), 392 (`.closed-banner--cancelled`); chevron rotation ~307; `.icon-bar` ~169.
- `apps/web/src/app/features/parties/confirm-dialog/confirm-dialog.ts` -- inline template line ~30, `MatIconModule` imports at 3 and 18.
- `apps/web/src/app/core/icons/{app-icon.ts,icon-registry.generated.ts}` and `mat-icon-ratchet.spec.ts` -- reuse; ceiling.
- `partie-detail.spec.ts` -- helper `label` (~3988) strips the first word as the icon ligature: it must now only trim (an `app-icon` has no text); the `shield` assertion at ~4556 belongs to 51.4, leave it. `confirm-dialog.spec.ts` -- `mat-icon` assertions at 34, 47, 51.

## Tasks & Acceptance

**Execution:**
- [x] `partie-detail.html`, `partie-detail.scss` -- migrate the 28 listed icons of this file, chevron rotation, `app-icon` size and colour rules
- [x] `confirm-dialog.ts` (+ `confirm-dialog.spec.ts`) -- `avertissement` on the destructive confirm button, `AppIcon` replaces `MatIconModule`, specs read `app-icon[data-icon]`
- [x] `partie-detail.spec.ts` -- fix the `label` helper; tests for every matrix row (icon name per footer action in both blocks, one name `telecharger` for the ten buttons, `deplier` on the two sheets, banners, homonymy)
- [x] `mat-icon-ratchet.spec.ts` -- lower the ceiling to the recounted value (30 expected)

**Acceptance Criteria:**
- Given the party page in any theme, when the theme changes, then meaning icons (states, XP, announcement) change in place and utility icons do not.
- Given `ng test --watch=false`, eslint on touched files and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing; `partie-detail.spec` can time out under full-suite load, check it alone).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Chevron rotation depends on `deplier` orientation, unchecked (blind, edge) | false | rejected | `communes/deplier.svg` is a single-drawing utility, "chevron bas"; closed -90° points right as before, open upright points down as before. |
| 2 | Footer mixes 20px `app-icon` and remaining 24px `mat-icon` (`logout`, `exit_to_app`) (edge) | low | rejected | Transitional: those two icons migrate in Story 51.4. |
| 3 | Per-theme drawing untested on this page (blind, edge) | low | rejected | The theme-following behavior is tested in `app-icon.spec.ts` (51.1) and the dashboard spec (51.2); this story's AC asks for names only. |
| 4 | Mocks without `activeTheme` (56 others) (blind, edge) | low | rejected | The full suite passes (4565/4567, only the 2 known date-frozen failures); no spec currently breaks. |
| 5 | Duplicate `mat-icon`-stripping in spec helpers (blind) | low | rejected | Needed until 51.4 migrates "Quitter"; test-only. |
| 6 | `etat-terminee` reused for "Clore", `cadenas-ferme` always for "Visibilité" (blind) | false | rejected | Mapping imposed by the story's AC. |
| 7 | Icon-size choices (1rem, 1.25rem, 1.1rem), `vertical-align: middle`, spacing (blind, edge) | low | rejected | Visual detail to check in the browser; no behavioral defect shown. |
| 8 | Footer test gaps (annulée soirée, plain member, keyed by label, non-ryuutama downloads) (blind, edge) | low | rejected | Branches rendering no migrated icon; fix adds tests beyond a direct correction. |
| 9 | Reduced-motion for the chevron transition (edge) | low | rejected | The transition pre-exists this story and is unchanged. |
| 10 | Ratchet ceiling is global, import ordering, spec claim of "no layout change" (blind, edge) | low | rejected | Ceiling recount matches 30; import order is cosmetic; sizes are to be eyeballed. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/parties src/app/core/icons` -- expected: no error on touched lines
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: chevron orientation closed/open, footer icons at 16–20 px, cancelled banner icon in red.
