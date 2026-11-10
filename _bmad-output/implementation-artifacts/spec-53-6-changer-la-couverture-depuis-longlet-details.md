---
title: '53.6 — Change the cover from the Détails tab'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '324e232b6ec62be344bc8417f363b74b3db03718'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A party's page shows no illustrated banner, and changing or removing its cover means opening the edit form, even though the server now says who may (`can.coverUpdate`, 53.5).

**Approach:** A new `features/parties/editable-banner/` wraps `PartyBanner` (large) at the head of the Détails tab and carries the "Changer" / "Retirer" chips, gated by `partie.can.coverUpdate`, saving through `CoverUpload` and giving the fresh party back to `partie-detail`. Web only.

## Boundaries & Constraints

**Always:** ⚠️ validated screen (banner now on the page). `app-editable-banner` (`[partie]: PartieDto` required, output `partieChange`) renders `PartyBanner` `mode="large"` with `partieId`, `partieName`, `coverImageVersion` read from the input, no local copy; `PartyBanner` stays purely presentational. Placement: top of the Détails tab (JDR chronicle, single quest, group), top of the first tab of an evening, above `app-soiree-tab` (an evening has no Détails tab); every member sees the banner; the Shell text header is untouched. Chips (`cover-chips`) are siblings of the banner (never inside, it is `aria-hidden`), top right, 8px from the edge, look of the form chips (Story 38.3: translucent pill, double focus ring, 44px touch target via `::after`, forced-colors border), rendered only if `partie.can.coverUpdate`. With a cover: "Changer" (native file input covering the chip, never `display:none`, reachable by `Tab`/`Enter`/`Space`; `<app-icon name="modifier">`, decorative) and "Retirer" (no icon); text `common.changer` / `common.retirer`, accessible name completed by `partie.cover_change` / `partie.cover_remove` as in the form. Without a cover: one chip, text `partie.cover_add`, same picker and icon, no "Retirer". Chips disabled while `CoverUpload.saving()`; `CoverUpload` is listed in the component's own `providers` (53.5). "Changer": a locally refused file (`refusal()`) shows its existing key (`partie.cover_reject_type` / `_size`) in a snackbar, no network; otherwise `change()`, success → `partieChange.emit(updated)` and a snackbar without action `partie.cover_changed`; failure → snackbar `partie.cover_upload_error`; never an "Annuler". "Retirer": opens `ConfirmDialog` (`destructive: true`, `confirmLabel` `common.retirer`, message `partie.cover_remove_confirm`); declining changes nothing; confirming → `remove()`, success → emit and snackbar `partie.cover_removed`, failure → snackbar `partie.cover_remove_error`. Snackbars via `MatSnackBar.open(msg, undefined, { duration })`. New keys in the three tone files (grimoire "Enluminure changée/retirée", forêt "Image changée/retirée" with tutoiement, atelier "Plaque changée/retirée", plus a confirm message per theme voice); identical text in all three goes to `NEUTRAL_KEYS` (none expected). `partie-detail` handles `(partieChange)` by setting `partie` to the received party; the other members get it through the existing `partie:{id}` that `refreshPartie()` rereads, which also refreshes `can` after a role change. Record the realtime evaluation in Implementation Notes (`docs/checklist.md`).

**Never:** No API or shared change, no new endpoint. Do not touch the form, the footer buttons, `PartyBanner`'s behavior, or any game rule. No second implementation of refusal or double-send rules (always `CoverUpload`). No raw string keys beyond the three new ones.

## I/O & Edge-Case Matrix

| Viewer / party | State | Result |
|---|---|---|
| GM, admin, host | cover | banner + "Changer" + "Retirer" |
| GM | no cover | banner + one "add" chip |
| Player, member, guest | any | banner, no chip |
| Any chip user | wrong type or > 5 MB | refusal snackbar, no call |
| Any chip user | send in flight | chips disabled, one send |
| "Retirer" | confirm / decline | removed + snackbar / nothing |
| Any send | API failure | error snackbar, banner unchanged |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-form/partie-form.html` (l.45–93) and `.scss` (l.140–250) -- chip markup and styles to copy (the form's own code is not changed); `cover-chip`, `cover-file-input`, forced-colors block.
- `apps/web/src/app/shared/party-banner/party-banner.ts` -- inputs `partieId`, `partieName`, `mode`, `coverImageVersion`; `large` is 124px (the form overrides to 170px; here keep `large` as is).
- `apps/web/src/app/core/parties/cover-upload.ts` -- `CoverUpload` (`@Injectable()` per component), `saving`, `refusal(file)`, `change(id, file)`, `remove(id)` returning the party or `null`.
- `apps/web/src/app/features/parties/confirm-dialog/confirm-dialog.ts` -- `ConfirmData` (`message`, `confirmLabel`, `destructive`); open with `MatDialog`, read `afterClosed()` as in `partie-detail.ts` `leaveGroup()` (l.1225).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` (Détails tab l.114, soirée tab l.101–112) and `.ts` (`partie` signal l.184, `refreshPartie()` l.833) -- insert the banner, wire the output; one story in this hot spot.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` (`partie.cover_*` near l.490) and `core/theme/theme-tone.service.spec.ts` (parity, `NEUTRAL_KEYS` l.818) -- three new keys.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts` (l.355, 2096) -- `MatSnackBar` pattern.

## Tasks & Acceptance

**Execution:**
- [x] `features/parties/editable-banner/editable-banner.{ts,html,scss}` -- component per the constraints (chips, picker, snackbars, confirm, `CoverUpload` in providers)
- [x] three tone files + `theme-tone.service.spec.ts` -- `partie.cover_changed`, `partie.cover_removed`, `partie.cover_remove_confirm`
- [x] `partie-detail.{ts,html}` -- banner at the head of Détails and of the evening's first tab; `(partieChange)` sets `partie`; note the realtime evaluation
- [x] `editable-banner.spec.ts` -- chips absent without `can.coverUpdate`; "Changer" + "Retirer" with a cover; one add chip without; change → `setCoverImage` then snackbar per theme, no action; local refusal without call; "Retirer" confirm then `removeCoverImage`, decline no call; chips disabled while sending; both failures
- [x] `partie-detail.spec.ts` -- banner at the head of Détails (JDR, group) and of the evening's first tab; chips for GM, admin, host, absent for player, member, guest; fresh party from the output replaces the banner version

**Acceptance Criteria:**
- Given a GM on a chronicle with a cover, when they open Détails, then the banner shows with "Changer" and "Retirer"; a player sees the banner without chips
- Given a double click on "Changer", when the first send is in flight, then only one image is sent
- Given web Vitest suites and `tsc`, when run, then all pass (bar the two known date-frozen `calendar-view` tests)

## Implementation Notes

- Realtime evaluation (`docs/checklist.md`): `app-editable-banner` is nested in `partie-detail`, which already holds the `partie:{id}` connection and rereads the party through `refreshPartie()` on any `partie:` event. The banner reads `partie()` from its input with no local copy, so another member's cover change (new `coverImageVersion`) and a role change (fresh `can`) reach it through that existing path. No new channel, no `changed`/`notifyChanged()` wiring, no `RealtimeService` call in the component. The author's own change is applied at once through `(partieChange)` (`partie.set(updated)`).
- `PartyBanner` untouched; chips and picker styles copied from `partie-form.scss` (the form is unchanged), anchored top-right at 8px.
- Tone keys added in the three tone files (distinct voices, none in `NEUTRAL_KEYS`): `partie.cover_changed`, `partie.cover_removed`, `partie.cover_remove_confirm`.
- Verification: web Vitest 4965 pass, 2 fail (the two known date-frozen `calendar-view` tests); `tsc --noEmit` on `tsconfig.spec.json` and `tsconfig.app.json`: no error other than the pre-existing `TS6059` rootDir noise from `packages/game-rules`. Not checked here: a player seeing the new image without reload (needs two sessions), visual check on phone/desktop in the three themes.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind | No realtime wiring or documented decision | false | The evaluation is recorded in Implementation Notes: `partie-detail` already holds `partie:{id}` and `refreshPartie()` rereads the party. |
| 2 | blind | `partie.cover_remove_confirm` names a JDR object ("grimoire", "sentier", "mission") but the banner also shows on groups and evenings | low | Real wording defect on non-JDR parties, direct correction. Patched: the three confirm texts name no object. |
| 3 | blind, edge | Focus drops to `<body>` after "Retirer" (the focused button leaves the DOM) | low | Real for keyboard users on every removal; small fix. Patched: focus moves to the remaining picker after a successful removal, one test. |
| 4 | blind, edge | A double click on "Retirer" opens two confirmation dialogs | false | The dialog opens synchronously; its backdrop covers the button before a second click lands, and a keyboard Enter moves focus into the dialog. A second `remove()` is also refused by `CoverUpload.saving`. |
| 5 | blind | No visible progress while uploading (`partie.cover_uploading` unused) | low | The frozen intent defines the in-flight feedback as disabled chips plus the snackbar on the validated screen. Adding progress text is a UI choice for the human's visual review, flagged in the presentation. Rejected. |
| 6 | blind | Accessible names stutter ("Retirer — Retirer l'enluminure"); no `aria-label` on the add chip | false | Required verbatim by the spec (same names as the form chips, Story 38.3); the add chip is named by its text. |
| 7 | blind | Hard-coded colors, px sizes, no forced-colors ring | false | Copied from the form chips as the spec says (look of Story 38.3, forced-colors border already there). |
| 8 | blind | Tone read before `await` can be stale after a theme switch | low | Negligible: a theme switch during a few seconds of upload. Rejected. |
| 9 | blind, edge | Every failure maps to the generic error snackbar | false | The spec fixes failure → `partie.cover_upload_error` / `partie.cover_remove_error`; a revoked right self-heals through the party refetch. |
| 10 | blind | Test gaps: `null` result, `input.value` reset, weak `setTimeout`, long lines | low | Patched where direct: tests for the reset and the `null` result, prettier on the new spec. The `setTimeout` check is the existing pattern. |
| 11 | blind | Banner only inside Détails; two instances each with its own `CoverUpload` | false | Placement is frozen by the epic; the two instances are mutually exclusive (a party renders either the evening tab or Détails). |
| 12 | gap | The `(partieChange)` binding of the evening's banner is not tested | low | Real test gap, test-only. Patched: an evening case of the replace-the-party test. |
| 13 | gap | `input.value` reset not asserted | low | Same patch as #10 (the layer proposed deferring; a one-line assertion is cheaper). |
| 14 | gap | Test name "un seul onglet porte la bannière" claims more than it checks | low | Cosmetic. Patched: renamed. |
| 15 | edge | `emit()` on a destroyed output ref, or a handler error, reported as an upload failure | false | `OutputEmitterRef.emit` on a destroyed ref only warns (NG0953); a throwing parent handler is hypothetical. |
| 16 | edge | The `partie` input switches id during a send and the old DTO replaces the new party | low | `partie-detail` reads `route.snapshot` once, so a reused instance with another id is a pre-existing limitation, not reachable from this change. Rejected. |
| 17 | edge | `remove()` returning `null` ends silently after a confirm | low | Only when a send is already in flight, in which case the chips are disabled. Rejected. |
| 18 | edge | A stale `refreshPartie()` can overwrite the just-applied cover | low | Self-healing: the cover change itself emits `partie:{id}` and triggers a fresher refetch. Rejected. |
| 19 | edge | A valid image with an empty browser-reported MIME type is refused | low | The rule is `CoverUpload`'s (53.5, same as the form), outside this change. Rejected. |
| 20 | edge | Empty tone entries would give an empty `aria-label` | false | Parity tests guarantee every key has text in the three themes. |

Patches verified: full web suite 4970 passed, 2 failed (the two known date-frozen `calendar-view` tests); `tsc --noEmit -p tsconfig.spec.json` shows no error beyond TS6059.

## Verification

**Commands:**
- `docker compose exec -T web pnpm exec ng test --watch=false` -- expected: green except the two known `calendar-view` date-frozen tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: no new error

**Manual checks (if no CLI):**
- Phone and desktop, three themes: change then remove a JDR and an evening cover; a player on the page sees the new image without reload (not checkable here: note it)
