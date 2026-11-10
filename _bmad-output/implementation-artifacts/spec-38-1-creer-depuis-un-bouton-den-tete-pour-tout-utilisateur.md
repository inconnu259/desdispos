---
title: '38.1 — Create from a header button, for every user'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '0b6210c107ba1e8b381145bcbb70bd948fff7301'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-38-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The "create a partie" button sits in the Parties page content and only shows for users who already run a partie (`hasMjParties()`), so a player or a newcomer cannot organise anything (FR18, UX-DR1).

**Approach:** ⚠️ The button leaves the page content and the MJ condition: it lives in the global shell header for every logged-in user, with the theme label on desktop and as an icon-only button next to the contextual title on mobile. ⚠️ The generic "+" icon is replaced by the logo's d20 crossed by a pencil (UX-DR2). A click opens `/parties/new`. No server change.

## Boundaries & Constraints

**Always:** Label from the existing tone key `nav.create_game` (Grimoire « Lancer une quête », Forêt « Ouvrir un sentier », Atelier « Initier une mission »); no new key. The button is a link (`routerLink="/parties/new"`) in `Shell` (already behind `authGuard`, so every logged-in user, every page). Desktop (≥768 px): at the right edge of the top `mat-toolbar` after the spacer, filled pill (full button radius) with icon + label. Mobile (≤767 px) on pages that set a contextual title: in `.contextual-header`, right of `.titles`, icon-only, 48 × 40 px, radius 20 px, glyph 26 px, touch target ≥ 44 px high, accessible name = the theme label (`aria-label`), never visible text; the title is never truncated to make room (the button stays an icon). On pages without a contextual title the top toolbar stays visible on mobile and carries the same button, icon-only below 440 px. At any viewport exactly one button is visible and exposed to assistive tech (the other is `display: none`). Icon: a new standalone SVG component, `currentColor`, **no `<mask>`, no `<clipPath>`, no `id`**, `aria-hidden="true" focusable="false"`, readable at 24 px, reproducing `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/mockups/icone-B-de-crayon.svg` (viewBox 32; the d20 is cut around the pencil by explicit geometry instead of a mask; the pencil keeps its outline and tip line). Dashboard: the `.head` block, its styles and the `hasMjParties` use are removed; `MyPartiesService.hasMjParties` and its spec stay. `partie-form.html` keeps using `nav.create_game` as its submit label. Comments in French; no animation added.

**Never:** No change to the form, to routes, to the API or to the MJ/player lists. No rename of tone keys. No new dependency. No breakpoint listener in TypeScript (pure CSS media queries).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Newcomer, desktop | user with no partie, ≥768 px, any page | pill « label » at the top-right, click → `/parties/new` | — |
| MJ, desktop | user with parties | same single pill; none in the Dashboard | — |
| Mobile with title | ≤767 px, page sets a title | icon-only 48 × 40 button right of the title, title intact, `aria-label` = label | — |
| Mobile without title | ≤767 px, no contextual title | toolbar visible with the button, icon-only < 440 px | — |
| Theme switch | Forêt / Atelier | label and `aria-label` follow the theme | — |
| Unauthenticated | login / register pages | no button (no Shell) | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/layout/shell/shell.{html,scss,ts}` + `shell.spec.ts` -- toolbar `<span class="spacer">` (html L4-17), `.contextual-header` (L95-105) with `.wordmark-compact` and `.titles`, mobile rule `@media (max-width: 767px)` (scss L176), `.hidden-mobile` on the toolbar when a title is set; `theme = ThemeToneService`; spec uses `createFixture(...)`, `ContextualNavService.set({title})`, mock tone `TONE_MAP`. `shell.scss` is ~6.9 kB raw against a 4 kB component-style warning (8 kB error): keep additions compact.
- `apps/web/src/app/features/dashboard/dashboard.{html,scss,ts}` + `dashboard.spec.ts` -- remove `@if (hasMjParties()) { .head … }` (html L1-5), `.head` (scss L1-6), `hasMjParties` (ts L115); spec "CTA de création conditionnel" (L233-243) becomes "no `/parties/new` link in the Dashboard"; clean the `createFixture` positional arg 4 and mock `hasMjParties`.
- `apps/web/src/app/core/my-parties/my-parties.service.ts` L13 `hasMjParties` -- keep (spec L37-40).
- `apps/web/src/app/core/theme/tones/*` -- `nav.create_game` exists in the 3 themes; `theme-tone.service.spec.ts` already lists it as high-visibility.
- `apps/web/src/app/shared/brand/brand-logo.ts` -- pattern for an inline SVG component (`viewBox`, `currentColor`, `fill-rule="evenodd"`, sized by a CSS variable); new `shared/create-icon/create-icon.ts` (+ spec: no `mask`, `clipPath` or `id`, `aria-hidden`, `currentColor`).
- `apps/web/src/app/app.routes.ts` L92 -- `parties/new` lazy `PartieForm` inside the Shell block with `authGuard`; unchanged.
- Visual references: `ux-designs/ux-jdr-master-2026-10-08/mockups/` — `icone-B-de-crayon.svg`, `icone-svg-planche-tailles.jpg`, `entree-desktop-D1-barre-du-haut.png`, `entree-mobile-M1-droite-du-titre.png`.

## Tasks & Acceptance

**Execution:**
- [x] `shared/create-icon/create-icon.ts` (+ spec) -- the maskless d20 + pencil SVG component.
- [x] `layout/shell/shell.{html,scss,ts}` (+ spec) -- desktop pill in the toolbar, mobile icon-only button in the contextual header, single visible button per viewport, `aria-label`, focus-visible style, touch-target sizing.
- [x] `features/dashboard/*` (+ spec) -- remove the page button and its condition.

**Acceptance Criteria:**
- Given any logged-in user (no partie, player only, MJ), when the shell renders, then a link to `/parties/new` labelled with `nav.create_game` of the active theme is present in the top toolbar, and the Dashboard contains no such link.
- Given a page with a contextual title, when the shell renders, then the title element carries no truncation logic and the contextual header contains the icon-only link with `aria-label` = the theme label.
- Given the icon, then its markup has no `mask`, `clipPath` or `id` and is `aria-hidden`.

## Implementation Notes

- New `shared/create-icon/create-icon.ts` (`app-create-icon`, `--create-icon-size`, default 24 px): d20 cut around the pencil by explicit geometry (cut points computed with the mockup mask's 2.3 offset), no mask/clipPath/id.
- Shell: desktop pill `create-cta--bar` after the toolbar spacer (icon-only below 440 px), mobile `create-cta--header` (48 × 40, radius 20, glyph 26, `::after` for the 44 px target) right of `.titles`; the header one is `display:none` from 768 px, the toolbar one is `display:none` via `.hidden-mobile` on pages with a title. `.titles .t1` loses `nowrap`/ellipsis (title never truncated, now wraps).
- Dashboard: `.head` block, styles and `hasMjParties` use removed; `MyPartiesService.hasMjParties` and its spec kept (spec instruction).
- Visual check (Chrome MCP, orchestrator): desktop pill top-right, no button in the page; mobile checked in a 375 px iframe (window resize does not change the viewport): toolbar hidden, 48 × 40 icon-only button with `aria-label`, title 248 px intact; icon reads as a d20 crossed by a pencil at 26 px. NOT checked visually: Forêt Ancienne and Atelier Cuivré (the theme comes from the account; changing it was not done) — covered by unit tests on labels only.
- Review patches: `hidden-mobile` class pinned in the shell spec; the second outline cut end moved to (18.14, 24.10) (distance 2.305 to the pencil polygon) with exported `PENCIL_POINTS`/`D20_CUT_ENDS` and a computed-distance test; hover/active/forced-colors states; atelier-cuivre label asserted; icon spec on attributes instead of regexes. Known residue: with butt caps one corner of two outline cuts sits ~1.6 from the pencil (visible gap ~0.6 vs ~1.3 in the mockup). Re-checked in the browser after the patch (icon still reads as d20 + pencil). Re-run: web build OK, web tests green except the 2 known calendar-view date failures.
- Orchestrator run before review patches: web 3093/3095 (2 known calendar-view date failures), web build OK.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | `hidden-mobile` class on the toolbar (single-button invariant) untested | medium | Only DOM link counts asserted | patch |
| 2 | edge | Outline cut end (18.98, 23.62) is 1.67 from the pencil shoulder, not 2.3 | medium | Computed distance; spec/mockup mask uses 2.3 | patch |
| 3 | blind | No hover/active/forced-colors feedback on the hand-made link | low | Only `:focus-visible` | patch |
| 4 | blind | Icon spec brittle (innerHTML regexes) and does not check geometry | low | Fixed with the geometry test | patch |
| 5 | blind | `atelier-cuivre` label not asserted | low | Two themes tested | patch |
| 6 | blind | Pill may vanish into the primary toolbar | false | Seen in the browser: green pill clearly visible on the Grimoire toolbar | reject |
| 7 | blind, edge | Button also shown on `/parties/new` and edit pages | low | Spec: every page for every logged-in user | reject |
| 8 | edge | Unsaved form lost by an always-present link | low | Same exposure as the existing nav links | reject |
| 9 | blind | Empty Dashboard lost its in-page CTA | low | Required by the story; header carries the action | reject |
| 10 | blind | `hasMjParties` dead code | low | Kept on purpose (spec) with its own test | reject |
| 11 | blind, edge | `.titles` wrapping unbounded for very long titles | low | "Title never truncated" is the spec | reject |
| 12 | edge | Pill overflow at 440–767 px with the longest label | low | Measured thresholds 399/422/437 px; icon-only below 440 | reject |
| 13 | blind | Visual contrast in Forêt/Atelier not verified | low | Theme follows the account; manual check by the user | defer |

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 known `calendar-view` date failures.
- `docker compose exec web pnpm build` -- expected: OK (the existing SCSS budget warnings only).

**Manual checks (visual, with `mcp__claude-in-chrome__*` on `http://localhost:4200`, session already open — never the built-in browser):**
- In the three themes: desktop pill at the top-right of the bar; ≤767 px icon-only button right of the title on a page with a title (e.g. « Mes aventures »), title not shortened at 360 px; icon readable at 24 px against the planche reference.
