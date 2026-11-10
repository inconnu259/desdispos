---
title: '38.3 — Change the cover from the banner'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '5341b09eb70d6c57c4c75509594d1f45af7933c9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-38-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The partie form's cover control is a raw "Enluminer… / Choisir un fichier / Aucun fichier choisi" row with a 40 px thumbnail (UX-DR5).

**Approach:** ⚠️ In create and edit, quest and ralliement, that row is replaced by a full-width preview banner (170 px high, radius 14 px) with a translucent « Changer » chip at its bottom-right and, when a personal image exists, a « Retirer » chip beside it. The native file input is hidden under the chip but stays keyboard-operable. No server change; upload keeps going through `PartiesService.setCoverImage`.

## Boundaries & Constraints

**Always:** Keep the cover section first in the DOM with class `.cover-section` (before the name field), `<app-party-banner>` when no file is pending, `<mat-progress-bar>` while saving, and every handler/signal name and event shape (`onCoverFileSelected`, `removeCoverImage`, `clearPendingCover`, `coverSaving`, `coverError`, `coverImageVersion`, `pendingCoverFile`, `pendingCoverPreview`) so existing logic and tests stay valid. Preview: `mode="large"` banner overridden from outside to `height: 170px`, full form width, `border-radius: 14px`, `overflow: hidden` (selector more specific than `:host(.party-banner-host--large)`); a pending file shows its blob URL as a cover-fit image in the same 170 px frame; edit mode with an existing cover shows the real image (`coverImageVersion`); create mode without a file shows the generated banner (id `'nouvelle-partie'` — current behaviour). Chips sit in a `position: relative` wrapper (siblings of the aria-hidden banner, never inside it), bottom-right, offset 12 px: « Changer » — padding 8/15/8/12, pill (999 px), background `rgba(8,6,16,.58)`, backdrop blur 8 px, border `rgba(255,255,255,.30)`, text 13 px / weight 500, 16 px pencil glyph; « Retirer » — same chip look, a real `<button type="button">`, shown only when a personal image exists (stored cover or pending file), placed beside « Changer ». Chip texts come from the existing tone keys `common.changer` / `common.retirer` (themed words), accessible names from `partie.cover_change` / `partie.cover_remove`; no new tone key unless a test requires one. The `<input type="file">` (jpeg/png/webp, same `accept`) is inside the « Changer » `<label>`, covers it with `opacity: 0` and `inset: 0`, never `display:none`/`hidden`, so Tab reaches it and the chip shows a visible focus ring via `:focus-within`/`:focus-visible`; disabled while `coverSaving()` (disabled look on the chip). Each chip has a hit area ≥ 44 px high (min-height or pseudo-element). Progress and error texts keep `aria-live="polite"` / `role="alert"`. A second file pick in create mode revokes the previous blob URL. Remove the superseded `.cover-preview*`, `.cover-actions`, `.cover-upload-label` rules; keep `.cover-progress`, `.cover-status`; no animation added (`prefers-reduced-motion` already handled by the banner). Comments in French.

**Never:** No change to validation rules (5 MiB, types), to the upload flow after create (`created_but_cover_failed` path), to the API, to the banner's generation seed, or to the dashboard tiles. No new dependency. Do not apply the chip styling to other screens.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create, no file | open `/parties/new` | 170 px generated banner, « Changer » chip only | — |
| Pick a file (create) | valid jpeg ≤ 5 MiB | banner shows the image; « Changer » + « Retirer » chips | wrong type / size → existing reject messages |
| Retire (create) | click « Retirer » | back to the generated banner, blob URL revoked | — |
| Edit with cover | stored cover | real image in the banner, both chips | — |
| Edit, change | pick a file | uploads immediately (existing flow), progress bar, new version shown | upload error → existing `cover_upload_error` |
| Keyboard | Tab to the chip | chip shows a focus ring; Enter/Space opens the file chooser | — |
| Saving | `coverSaving()` | chips disabled | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-form/partie-form.html` L42-86 -- `<section class="cover-section">`: current `<img class="cover-preview cover-preview--file">` (88×88), `<app-party-banner class="cover-preview" mode="medium" [partieId]="editId() ?? 'nouvelle-partie'" …>` (44×44), `.cover-actions` with `<label class="cover-upload-label">` containing the visible file input and a `mat-button` « Retirer »; progress/status/error outside the section.
- `partie-form.ts` -- cover signals/methods listed above; `ACCEPTED_COVER_MIMES`, `MAX_COVER_SIZE`; blob URL not revoked on a second pick (fix).
- `partie-form.scss` L88-128 -- `.cover-section`, `.cover-preview`, `.cover-preview--file`, `.cover-actions`, `.cover-upload-label` (replace); `.cover-progress`, `.cover-status` (keep); 2.6 kB source, budget 4 kB warn.
- `apps/web/src/app/shared/party-banner/party-banner.{ts,html,scss}` -- inputs `partieId`, `partieName`, `mode` (`large|medium|compact`), `coverImageVersion`; large host 124 px, inner radius `8px 8px 0 0`, animation only under `:host(.party-banner-host--large)`, reduced-motion handled; real image URL `/parties/:id/cover?mode=large&v=…`.
- `partie-form.spec.ts` -- describe "image de couverture (29.12)" L398 queries `.cover-section` (L407/413/572), `app-party-banner` (L408/414), `mat-progress-bar` (L542); other cover tests call methods directly; ordering test L572 needs `.cover-section` before the name input.
- Tones: `common.changer` ("Changer"/"Échanger"/"Substituer"), `common.retirer` ("Retirer"/"Ôter"/"Démonter"), `partie.cover_change` / `cover_remove` as aria names; no new key expected.

## Tasks & Acceptance

**Execution:**
- [x] `partie-form.html` + `partie-form.scss` -- banner preview, chips, hidden-under-chip file input, focus/disabled/hit-area styles; remove the old rules.
- [x] `partie-form.ts` -- minimal template support (e.g. computed chip visibility), revoke blob on re-pick.
- [x] `partie-form.spec.ts` -- tests: banner/ chip structure in create and edit (quest and ralliement), « Retirer » visibility, input not `hidden`/`display:none` and inside the chip label, chip names, disabled while saving, blob URL revoked on re-pick; existing cover tests green.

**Acceptance Criteria:**
- Given the create or edit form, in either mode, when it renders, then the cover section is the first block, shows a 170 px / 14 px-radius preview and no visible native file control, and « Changer » is reachable by keyboard.
- Given a personal image (stored or pending), then « Retirer » appears next to « Changer »; without one it does not.
- Given the existing form logic and tests, then they pass unchanged apart from selectors the spec lists above.

## Implementation Notes

- `partie-form.html/.scss/.ts`: `.cover-section` first block wrapping `.cover-frame` (170 px, radius 14 px, `overflow: hidden`); preview = `app-party-banner mode="large"` (override via `.cover-frame .cover-banner`) or the pending blob `<img class="cover-image">`; `.cover-chips` beside the banner (never inside it): « Retirer » button (when `hasPersonalCover`) then « Changer » label with a 16 px pencil SVG and the file input inside it (`opacity: 0; inset: 0`); chip texts `common.changer`/`common.retirer`; 44 px hit area via `::after`; second pick revokes the previous blob URL. No new tone key; old `.cover-preview*`/`.cover-actions`/`.cover-upload-label` rules removed.
- Visual check (Chrome MCP, orchestrator, Grimoire theme; the first Chrome tab had gone to the background — viewport 0 — so a new tab was used; screenshots still timed out, so metrics were read from the DOM): banner 170 px high, 14 px radius, spanning the whole form width (512 px); « Changer » chip 100 × 34 px, 12 px from the right and bottom edges, background `rgba(8, 6, 16, 0.58)`, blur 8 px, radius 999 px, 13 px / 500, 44 px hit area; file input `opacity: 0`, not hidden, first in the tab order; no native « Choisir un fichier » text; clicking the chip reaches the input. NOT verified in the browser: the keyboard focus ring (a real Tab press landed elsewhere in the background tab) — to check by hand — and the Forêt/Atelier themes.
- Review patches: `(change)` wiring tested by dispatching `change` on the real input (create and edit); invalid picks keep the previous preview; edit-mode removal tested (success and API failure); chip texts and accessible names per theme (aria-label starts with the visible word — WCAG 2.5.3); chips/input disabled while `coverSaving() || saving()`; pending blob URL revoked on destroy (`DestroyRef`); URL stubs restored; focus ring doubled (white outline + dark ring) and a forced-colors border. Re-run: web 3130 pass, 2 known calendar-view date failures, build OK.
- Orchestrator run before review patches: web 3120/3122 (2 known calendar-view date failures), web build OK without a new SCSS budget error.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | File input `(change)` wiring untested (all tests call `onCoverFileSelected` directly) | medium | A dropped binding would ship green | patch |
| 2 | blind, edge | Pending blob URL never revoked on component destroy | medium | No `DestroyRef`; cancel/navigate leaks | patch |
| 3 | blind, edge | Global `URL` stubs not restored in specs | low | `beforeEach` overwrites without restore | patch |
| 4 | edge, blind | Accessible name omits the visible theme word (WCAG 2.5.3) | medium | "Substituer" vs aria "Changer la plaque" | patch |
| 5 | edge | Chips/input stay active while the create submit is in progress | low | `saving()` not in the disabled condition | patch |
| 6 | blind | Focus ring white only; invisible on bright covers; no forced-colors | low | Single `outline: 2px solid #fff` | patch |
| 7 | blind | Missing tests: invalid pick keeps previous preview, edit-mode removal, theme-specific chip text | low | Not covered | patch |
| 8 | edge | Broken blob image (valid MIME, corrupt file) leaves an empty frame | low | MIME/size validated; a corrupt file uploads and the server rejects with the generic error | reject |
| 9 | blind | `::after` hit area over the transparent input | false | Measured in the browser: chip click reaches the input via label activation | reject |
| 10 | edge | Banner bound to the typed name regenerates per keystroke | false | Large banner is seeded by id only; the name feeds the compact monogram only (inventory) | reject |
| 11 | blind | Hard-coded chip colours, no `backdrop-filter` fallback, 170 px constant duplicated | low | Exact values are the UX contract | reject |
| 12 | blind | Narrow-phone overflow with long themed labels | low | Frame ≥ 340 px; chips ≈ 100–110 px each | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 known `calendar-view` date failures.
- `docker compose exec web pnpm build` -- expected: OK (no new SCSS budget error).

**Manual checks (visual, `mcp__claude-in-chrome__*` on `http://localhost:4200/parties/new`, never the built-in browser; do not submit):** banner 170 px with 14 px radius spanning the form, « Changer » chip at the bottom-right (12 px offset), no native « Choisir un fichier » text visible, Tab focus ring on the chip, in quest and in ralliement mode.
