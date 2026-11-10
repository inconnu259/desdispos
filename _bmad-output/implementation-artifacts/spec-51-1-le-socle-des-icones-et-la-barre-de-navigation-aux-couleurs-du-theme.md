---
title: 'Story 51.1 — Icon foundation and theme-colored navigation bar'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: 'e1bea4a45ed25e3cacb3352e3b240a177f4edaf8'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app draws every icon with the Material Icons font loaded from Google Fonts: no theme identity, overloaded names (`person`, `flag`, `shield`…), emoji used as icons. Palier 10.7 replaces them with the UX icon set (131 SVGs), but nothing yet reads that set.

**Approach:** Add the foundation (SVG sources, dependency-free generator, committed registry, `<app-icon>`, `roleIconName`, ratchet test) and migrate only the shell navigation bar plus the announcement-banner close cross. Epic 51's other stories build on it.

## Boundaries & Constraints

**Always:**
- Copy the 131 SVGs byte-for-byte from `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/mockups/icones/` (`grimoire-emeraude/`, `foret-ancienne/`, `atelier-cuivre/` ×30, `communes/` ×41) into `apps/web/src/assets-src/icons/`. Never retouch a drawing (✱ retouches included).
- Registry data only: `viewBox` + `{tag, attrs}` elements, tags `path|circle|ellipse|rect|line|polyline|polygon`; SVG comments ignored. 71 names in one `IconName` union (30 meaning icons × 3 themes, 41 utilities × 1).
- Generator refusals (French message naming the file): `id`, `mask`, `clipPath`, `style`, `script`, `href`/`xlink:href`, other tags, `viewBox` ≠ `0 0 32 32`, theme folders with different file names, a name in both a theme and `communes/`. `--check` fails if the committed registry differs.
- `<app-icon>`: standalone, inline SVG via template attribute bindings; `fill="none"`, `stroke="currentColor"`, round caps/joins; `data-icon` on host; size from `--app-icon-size` (default 24px); meaning icons follow `ThemeToneService.activeTheme()` live, utilities fixed; no `label` → `aria-hidden="true"` + `focusable="false"`; with `label` → `role="img"` + `aria-label`, no `aria-hidden`.
- Comments and error messages in French. No new theme token (`currentColor` / `--jdr-accent-1` only).
- Decision (human, 2026-11-01, review): the registry is imported **statically** by `app-icon.ts` (icons present at first render, no lazy chunk, no load-failure state); the `initial` `maximumError` budget in `apps/web/angular.json` is raised from 1MB to 1.1MB to absorb it.

**Never:**
- `[innerHTML]`, `DomSanitizer.bypassSecurityTrust*`, `MatIconRegistry`, network loading for icons.
- Any dependency install or `package.json` change; any screen reading `activeTheme()` to choose an icon.
- Touching other `<mat-icon>` usages (dashboard `roleIcon` stays string-based until 51.2); removing the Material font link (Story 51.8); changing any label.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Meaning icon, theme switch | `name="nav-parties"`, `setTheme('foret-ancienne')` | Drawing changes in place, same component instance | N/A |
| Utility icon | `name="fermer"`, any theme | Identical drawing in all three themes | N/A |
| Lone icon | `label="…"` | `role="img"` + `aria-label` | N/A |
| Forbidden SVG | contains `id`/`mask`/`style`/`href`/disallowed tag | Script exits non-zero, French message naming the file | Registry untouched |
| Stale registry | edited SVG, registry not regenerated | `--check` exits non-zero | CI fails |
| Role mapping | `admin` + `soireeIsolee:false` / `true` | `role-admin` / `role-hote`; `member` → `role-joueur` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/layout/shell/shell.html` / `shell.ts` -- 4 nav `<mat-icon>` (home, badge, calendar_month, person) + banner close; drop `MatIconModule` and `<mat-icon>`; `matBadge`, `aria-current` unchanged. `shell.scss` has no `.mat-icon` rule: size the icon through `--app-icon-size`.
- `apps/web/src/app/core/theme/theme-tone.service.ts` -- `activeTheme` signal, source of the theme for `app-icon`; `Theme` type and `THEMES` come from `@master-jdr/shared` (the `.mjs` generator cannot import TS: hardcode the 3 folder names and let the registry spec assert they equal `THEMES`).
- `apps/web/src/app/core/theme/tones/` -- label source for nav; no new tone key needed (nav labels written, icons decorative).
- `apps/web/src/app/shared/party-banner/party-banner-motion.spec.ts` -- precedent for a spec reading files (`node:fs` with `@ts-expect-error`, paths resolved from `import.meta.url`); copy for the ratchet.
- `apps/web/src/app/features/dashboard/dashboard.ts:161` -- `roleLabel` rule for an isolated encounter (`partie.kind === 'ONE_SHOT'`); `PartieRole` = `'mj'|'player'|'admin'|'member'`.
- `apps/web/eslint.config.js` -- prettier runs as an ESLint rule; add the generated registry to `ignores`.
- `.github/workflows/ci.yml` -- `types-build` job: add `node apps/web/scripts/generate-icons.mjs --check` and `node --test apps/web/scripts/` steps (no `package.json` change).
- New: `apps/web/scripts/generate-icons.mjs` + `generate-icons.test.mjs`; `apps/web/src/assets-src/icons/`; `apps/web/src/app/core/icons/{app-icon.ts,app-icon.spec.ts,icon-registry.generated.ts,role-icon-name.ts,role-icon-name.spec.ts,icon-registry.spec.ts,mat-icon-ratchet.spec.ts}`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/assets-src/icons/**` -- copy the 131 SVGs unchanged -- living source (diff against the mockups must be empty at copy time)
- [x] `apps/web/scripts/generate-icons.mjs` -- Node-only generator, refusals, `--check`, prettier-compatible output with "généré par scripts/generate-icons.mjs, ne pas modifier" header -- AD-2
- [x] `apps/web/scripts/generate-icons.test.mjs` -- `node --test`: each refusal, valid conversion, comment skipping, `--check` -- AC
- [x] `apps/web/src/app/core/icons/icon-registry.generated.ts` -- run the generator in the `web` container, commit -- AD-1/2
- [x] `apps/web/src/app/core/icons/app-icon.ts` (+spec) -- standalone component per Always -- AD-3
- [x] `apps/web/src/app/core/icons/role-icon-name.ts` (+spec) -- `roleIconName(role, { soireeIsolee })` -> `IconName`
- [x] `apps/web/src/app/core/icons/icon-registry.spec.ts` -- 71 names (30 + 41, incl. `matin`, `apres-midi`, `soir`, `menu-actions`, `declarer-dispos`), theme keys equal `THEMES`, no two identical drawings within a theme (utilities included)
- [x] `apps/web/src/app/core/icons/mat-icon-ratchet.spec.ts` -- count `<mat-icon` in `.html` and inline templates of `.ts` (specs excluded); ceiling = count measured after this story (expected ~75; recount with the test's own algorithm)
- [x] `apps/web/src/app/layout/shell/shell.{html,ts}` (+`shell.spec.ts`) -- nav → `nav-parties|nav-personnages|nav-calendrier|nav-compte`, close → `fermer`, remove `MatIconModule`; spec asserts `data-icon` per link
- [x] `apps/web/eslint.config.js`, `.github/workflows/ci.yml` -- ignore generated file; CI steps
- [x] `apps/web/angular.json`, `apps/web/src/app/core/icons/app-icon.ts`, `apps/web/src/app/app.config.ts` + specs -- replace the lazy `import()` / `loadIconRegistry` / `PendingTasks` / app initializer with a static import; raise the `initial` `maximumError` to 1.1MB; specs no longer pre-load the registry -- review decision
- [x] Review patches (Review Triage Log #5-#8): `drawing()` must not throw (log with `console.error`, render nothing); generator refuses unknown flags and missing option values (exit 1, French message, tested); `quote()` escapes `\n`/`\r`; fix the stale headers/comments (Docker form, working `node --test` glob, `ROOT_ATTRS`)

**Acceptance Criteria:**
- Given the web container, when `node scripts/generate-icons.mjs --check` runs, then it exits 0 and a second run changes no file.
- Given the shell, when the theme changes, then the four nav icons change with the labels without reload, remain `aria-hidden`, and the badge and `aria-current` behave as before.
- Given the announcement banner, when it shows, then the close button keeps its theme `aria-label` and its icon is decorative.
- Given `docker compose exec web pnpm ng test --watch=false`, `pnpm lint` and `pnpm build`, then all pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Registry loaded by lazy `import()` instead of a static import: nav icons blank until the chunk arrives, "no network loading" boundary arguably crossed (edge claim) | medium | intent_gap | Implementer deviated because a static import took the initial bundle to 1.03 MB, over the `angular.json` 1 MB error budget. Lazy chunk vs raised budget is user-visible and the spec does not settle it. |
| 2 | Chunk load failure leaves mounted icons blank, no retry, untested (verification-gap, blind, edge) | medium | intent_gap (same root as 1) | `loading = null` only helps a newly constructed icon; the shell icons never retry. Exists only with the lazy design. |
| 3 | Not-loaded to loaded transition and `PendingTasks` untested (verification-gap) | medium | intent_gap (same root as 1) | Both specs await `loadIconRegistry()` before creating the fixture. |
| 4 | Lazy-chunk invariant enforced only by a comment (verification-gap, blind) | low | intent_gap (same root as 1) | No `no-restricted-imports` rule; only the budget guards it. |
| 5 | `drawing()` throws inside `computed` for an unknown name; comment says "texte seul" (verification-gap, blind, edge) | low | patch (survives loopback) | `app-icon.ts` throws; unreachable for typed callers but would abort change detection. Smallest fix: `console.error` and render nothing. |
| 6 | CLI: unknown flag (`--chek`) or missing value silently ignored; a `--check` typo rewrites the registry and exits 0 (blind, edge) | medium | patch (survives loopback) | `optionValue` does `resolve(argv[i+1] ?? '')`; only `argv.includes('--check')`. Smallest fix: refuse unknown flags and missing values with exit 1. |
| 7 | Attribute value with a newline breaks the generated TS (edge) | low | patch (survives loopback) | `quote()` escapes only `\` and `'`. No current SVG triggers it; fix is two `replace` calls. |
| 8 | Headers and `ROOT_ATTRS` comment inconsistent (`node --test scripts/` fails, paths relative to `apps/web`, "null = libre" unused) (blind) | low | patch (survives loopback) | Comment-only correction, Docker form `docker compose exec web …`. |
| 9 | Attribute values unvalidated (`fill="red"`, `url(...)`) (blind, edge) | low | rejected | All 131 sources use only `currentColor`/`none`; the fix adds a value grammar. |
| 10 | Whitelist duplicated; `ellipse|line|polyline|polygon` branches untested (blind, edge) | low | rejected | The real registry has only path/circle/rect; the fix adds machinery beyond a direct correction. |
| 11 | Ratchet "is not a ratchet" (blind) | false | rejected | The AC asks for a test failing *above* the remaining count; each story lowers it. |
| 12 | `@ts-expect-error` on `node:*` imports (blind, edge) | false | rejected | Existing precedent in `party-banner-motion.spec.ts`. |
| 13 | No `icons:generate` script (blind) | false | rejected | `package.json` must stay unchanged (AC). |
| 14 | `roleIconName` unused in this story (blind) | false | rejected | Required by the story; first consumers in 51.2+. |
| 15 | Hard-coded counts (blind) | low | rejected | Counts are mandated by the AC. |
| 16 | Raw fs errors, unseparated attributes, whitespace-only `label`, per-icon `PendingTasks`, `roleIconName` default, ratchet counting comments, Thumbs.db, generated line of 101 chars (edge, blind) | low | rejected | Unlikely to be met; fixes add guards. The line length is hidden by the eslint `ignores`. |
| 17 | CI uses `node --test 'apps/web/scripts/*.test.mjs'`, spec said `scripts/` (edge) | false | rejected | `node --test <dir>` fails on Node 24; the glob is the working form. |

## Design Notes

⚠️ Validated screen touched: shell navigation (nav icons replaced). Flag in review. `ajouter` is registered but placed nowhere in this palier; `declarer-dispos` is available for epic 52; `vote` → 54.1, `jeux` → 51.7.

## Verification

**Commands:**
- `docker compose exec web node scripts/generate-icons.mjs --check` -- expected: exit 0
- `docker compose exec web node --test scripts/` -- expected: all pass
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass
- `docker compose exec web pnpm lint && docker compose exec web pnpm build` -- expected: success

**Manual checks (if no CLI):**
- Browser, three themes: nav icons switch with the theme at 16–24px on dark surfaces; keyboard focus ring visible on nav links.
