---
title: 'Story 51.4 — Members, invitations and group governance icons'
type: 'feature'
created: '2026-11-02'
status: 'done'
baseline_commit: 'a78dba793476b9dc496eed51bdfdfba518566b6e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The member lists, governance gestures, invitations panel, admin badge and roster-rail toggle still use Material icons, a generic shield, hand-drawn inline SVG and the characters ⚔ 🌿 ⚙ ‹ ›. GM and admin share `shield`, and the member-list title carries an emoji.

**Approach:** Replace them with `<app-icon>` (Story 51.1), remove the emoji from the three tone files, drop `MatIconModule` from `partie-detail.ts`, and lower the `<mat-icon` ratchet ceiling from 30 to 17.

## Boundaries & Constraints

**Always:**
- Mapping in `features/parties/partie-detail/partie-detail.html` (13 `<mat-icon>`): admin badge `role-admin`; "Nommer admin" `nommer-admin`; "Quitter l'office" `quitter-office`, in the list and in the footer; "Retirer" a player or member `retirer-membre` (both lists); footer "Quitter le groupe" `quitter-groupe`; invitations panel: invite button `inviter`, "Rechercher" `rechercher`, "Inviter par e-mail" `email`, "Générer un lien" `lien`, copy `copier`, revoke `lien-revoque`. A "+" written in a label stays text.
- The member-list title (two `<h3>` using `partie.members_title`) is preceded by a decorative `membres` icon tinted with `--jdr-accent-1`. In the three tone files `partie.members_title` loses its emoji: "Compagnons" (grimoire), "Habitants" (forêt), "Équipage" (atelier); no other label changes.
- `features/events/participant-chip/participant-chip.html`: the inline `pc__shield` SVG becomes `<app-icon name="role-admin">` with `--app-icon-size: 14px`, same corner placement (keep the `pc__shield` class for positioning and tint), decorative because "Admin" is written beside it. Anywhere the admin badge is shown without that word it carries `label` = `partie.ralliement_admin_badge` (today nowhere: all uses write the word).
- `features/parties/roster-rail/roster-rail.html`: `‹` / `›` become `precedent` / `suivant`, same orientation as today (`‹` when expanded, `›` when collapsed); the toggle keeps its `aria-label`; the icon is decorative.
- Icons beside written labels, or lone icons in a button that has an `aria-label`, are decorative (the default); the name stays on the button (`common.copier`, `common.revoquer`). Sizes only through `--app-icon-size` (rewrite the `.admin-badge mat-icon` rule, and size button icons ~1.25rem like Story 51.3).
- `MatIconModule` leaves `partie-detail.ts`; `AppIcon` is imported where used. Ratchet ceiling 30 → 17 (recount with the test's own algorithm).
- ⚠️ Validated screens touched: member lists, invitations panel, footer governance actions, participant chip, roster rail. Comments in French; `import type` only for `IconName`.

**Never:**
- Touch other `<mat-icon>` usages or labels; read `activeTheme()` to pick an icon; add a fallback icon; install anything. Do not redraw icons.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin badge | group member with `ADMIN` | `role-admin` beside the written word, no `shield` | N/A |
| Governance | appoint / step down / remove / leave | `nommer-admin` / `quitter-office` (list and footer) / `retirer-membre` / `quitter-groupe` | N/A |
| Invitations | search, invite, e-mail, link, copy, revoke | the six icons above; copy and revoke keep their `aria-label` | N/A |
| Titles | each of the 3 themes | `partie.members_title` has no ⚔ 🌿 ⚙ | N/A |
| Chip | participant `isAdmin` | `app-icon[data-icon=role-admin]` at 14px, changes with the theme | N/A |
| Rail | expanded / collapsed | `precedent` / `suivant` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- `<mat-icon>` at ~464, 515, 521, 527, 533 (member lists), 700, 712 (footer), 733-775 (panel); `<h3>` titles at ~452 and 486.
- `.../partie-detail.scss` -- `.admin-badge mat-icon` ~386; `.icon-bar__btn app-icon` rule from 51.3 (reuse); `.partie-detail.ts` `MatIconModule` imports (~16, ~109).
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` -- `partie.members_title` (~756, 748, 751).
- `apps/web/src/app/features/events/participant-chip/participant-chip.{html,scss,ts,spec.ts}` -- inline SVG ~6, `.pc__shield` ~39; its spec mocks `ThemeToneService` with `tone` only: add `activeTheme`; existing assertion `.pc__shield` at ~84.
- `apps/web/src/app/features/parties/roster-rail/roster-rail.{html,ts,scss,spec.ts}` -- toggle text `‹ ›` at html:9.
- `partie-detail.spec.ts` -- `shield` assertion ~4556, title tests ~3658, ~3835, ~4342; the `label`/`footerIcons` helpers strip remaining `mat-icon` text and can be simplified to `trim` now.
- `apps/web/src/app/core/icons/{app-icon.ts,mat-icon-ratchet.spec.ts}` -- reuse; ceiling.

## Tasks & Acceptance

**Execution:**
- [x] `partie-detail.{html,scss,ts}` -- migrate the 13 icons, `membres` before both titles, drop `MatIconModule`
- [x] three tone files -- remove the emoji from `partie.members_title`
- [x] `participant-chip.{html,scss,ts}` -- `role-admin` 14px badge; `roster-rail.{html,ts,scss}` -- `precedent` / `suivant`
- [x] specs -- update `partie-detail`, `participant-chip`, `roster-rail` (names, no emoji in any of the 3 titles, badge changes with the theme, one icon per governance gesture, simplified helpers); ratchet ceiling

**Acceptance Criteria:**
- Given the group page in any theme, when the theme changes, then `role-admin` and the governance icons change in place and the utility icons (`email`, `lien`, `copier`, `rechercher`, `precedent`…) do not.
- Given `ng test --watch=false`, eslint on touched files and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing; `partie-detail.spec` may time out under full-suite load, check it alone).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Chip admin badge lost the surface-coloured outline of the old shield; may blend into the avatar at 14px (blind, edge, verification-gap) | maybe-false | defer | Cannot be settled in jsdom; needs a look at the three themes. Story 51.8's recette already judges `role-admin` at 14px and reports it to the user rather than redrawing. Logged in deferred-work. |
| 2 | 14px size of the chip badge no longer asserted (blind, verification-gap) | low | rejected | jsdom does not apply the component styles reliably; covered by the same visual check as #1. |
| 3 | Chip badge theme-following only tested in the group-members test (edge) | low | rejected | `role-admin` is a themed icon, covered by `app-icon.spec.ts` (51.1) and the new group test. |
| 4 | Icon-to-label spacing in Material buttons, equal-specificity scss order, `mat-icon` scss rules left dead (blind) | low | rejected | Order is verified by the edge reviewer (badge stays 1rem); spacing is a visual detail for the browser check. |
| 5 | Emoji test limited to the three removed characters; other users of `members_title` (blind) | low | rejected | Verified: the key is only used by the two `<h3>`; the AC names exactly those characters. |
| 6 | Spec brittleness (copy strings, row index, protected signal, mock factories, duplicate `settle` helper) (blind) | low | rejected | Test-only hygiene; the fixes add machinery. |
| 7 | `MatIconModule` removal without per-template guard (blind) | false | rejected | Edge and verification-gap traced it: 0 `<mat-icon` left in the template, ratchet recount 17. |
| 8 | Mocks lacking `activeTheme` in `soiree-tab` / `event-create` specs; `precedent`/`suivant` are common icons (edge) | low | rejected | Nothing breaks today (full suite green); no admin participant used there. |
| 9 | RTL, focus ring, story numbers in comments (blind) | low | rejected | No RTL support exists in the app; comments follow the repo's habit of citing stories. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm exec eslint src/app/features/parties src/app/features/events/participant-chip src/app/core` -- expected: no error on touched lines
- `docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes, 360 px and desktop: badge at 14 px readable on the avatar, `membres` tinted, rail arrow orientation.
