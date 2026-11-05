---
title: 'Story 52.1 — One calendar interaction at a time'
type: 'refactor'
created: '2026-11-05'
status: 'done'
baseline_commit: '25a9728b0bd5ca5024d278f34c0c4878ccfd3110'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `calendar-view` tracks its tools with independent state (`composing` boolean, `destinyPollId`, open lists), so the upcoming declaration mode (Story 52.2) could be lit together with the Composer or the Destiny.

**Approach:** One signal `interaction: 'lecture' | 'declaration' | 'composer' | 'destinee'` (initial `lecture`), written only by `setInteraction()`, replaces `composing`; month and week views receive it instead of `composing`. Pure refactor: nothing visible changes and no screen turns `declaration` on yet.

## Boundaries & Constraints

**Always:**
- `setInteraction()` is the only writer of `interaction`; lighting one tool turns the other off and calls the left tool's exit (`exitDestiny()`, `exitCompose()`, close `destinyListOpen`, close `rendezvousPickerOpen`). `exitDestiny()`/`exitCompose()` stay pure state cleanup and never write `interaction`; every caller that quits a tool (`quitDestiny`, `cancelCompose`, post-save paths, the Destiny-death effect, `loadForPartieId`) goes through `setInteraction()`.
- `destinyPollId` only says *which* poll; `interaction() === 'destinee'` says whether Destiny is active. `interaction() === 'composer'` replaces every `composing()` read (calendar-view, month, week).
- Composer armed from Destiny keeps `destinyPollId`: cancelling returns to `destinee` on the same poll, saving re-enters it on the created/modified poll (Story 45.2, AR16). Composer left with no `destinyPollId` returns to `lecture`.
- `?poll=` still opens Destiny; `?seanceId=` still arms the Composer; `mode` input unchanged.
- Month/week views clear their selection whenever `interaction` changes (their existing `composing` effect now reads `interaction`).
- French comments and messages; no new dependency.

**Never:** a button, banner, grid outline or text; any gesture/shortcut change (`Espace`, `1/2/3`, `Maj`+arrows, `Entrée`, `Échap`); lighting `declaration` from any screen; assertion changes in existing specs, only their setup.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Exclusivity | `setInteraction(x)` for each pair among the four, `declaration` included | Only `x` is on; left tool's exit called; selection cleared | N/A |
| Destiny → Composer | `destinee` on `p1`, "Modifier les dates" | `composer`, `destinyPollId()` still `p1`, Destiny dates dimming off | N/A |
| Composer cancel / save | From the above | Cancel: `destinee` on `p1`. Save: `destinee` on the created/modified poll | Save error keeps `composer` |
| Destiny poll vanishes | `destinee`, poll gone from the list | `lecture`, notice shown as today | If composing, `composer` stays, only `destinyPollId` clears |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/calendar-interaction.ts` -- new: exported type `CalendarInteraction`, imported by calendar-view and both grid views (avoids a parent import cycle).
- `.../calendar-view/calendar-view.ts` -- `destinyPollId` (L1191), `enterDestiny`/`exitDestiny` (L1259/1283), `composing` (L1991), `destinyDates` (L1236), `destinyPresentable` (L1425), `windowAddable` (L1460), `proposeButton`/`proposeOther`/`addSelectedWindow`, `armTarget` (L2545), `startGroupComposeNew` (L2899), `exitCompose` (L2701) and its callers (L2687, 2837, 2920, 2955, 3035, 3293, 3374), `quitDestiny` (L1960), `reactivateDestiny` (L2854), Destiny-death effect (L3156), `loadForPartieId` (L3364); `destinyListOpen` (L1298), `rendezvousPickerOpen` (L2255).
- `.../calendar-view/calendar-view.html` -- `[composing]` at L320 and L348, `@if (composing() ...)` at L391; `destinyPollId()` bindings (L83, 233, 254) stay.
- `.../calendar-month-view/calendar-month-view.ts|html` and `.../calendar-week-view/calendar-week-view.ts|html` -- `composing` input (L344 / L314) and its guards; the selection-reset effect in each constructor; `[composeMode]="composing()"`.
- `calendar-view.spec.ts`, `calendar-month-view.spec.ts`, `calendar-week-view.spec.ts` -- setup uses `composing: true` / `destinyPollId.set(...)`; `selection-bar` and `compose-bar` specs must stay green untouched.

## Tasks & Acceptance

**Execution:**
- [x] `calendar-interaction.ts` -- add the `CalendarInteraction` union -- shared by three components
- [x] `calendar-view.ts` -- add `interaction` signal and `setInteraction()`; drop `composing`; route all tool entries and exits through it; make Destiny/Composer deriveds read `interaction()` -- AD-7
- [x] `calendar-view.html` -- pass `[interaction]="interaction()"` to both views; replace `composing()` guards -- no visible change
- [x] month and week views -- swap input `composing` for `interaction`, guards become `interaction() === 'composer'`, selection effect reads `interaction`
- [x] the three existing specs -- change setup only (`interaction: 'composer'`; `destinyPollId.set` followed by `setInteraction('destinee')`)
- [x] `calendar-view.spec.ts` -- add tests: sole writer; pairwise exclusivity incl. `declaration`; selection cleared per change; left tool's exit called; Composer ⇄ Destiny chains unchanged

**Acceptance Criteria:**
- Given any calendar route, when I use Destiny, the Composer, `?poll=` or `?seanceId=`, then behavior and screens are identical to before.
- Given `setInteraction('declaration')` called directly, then Destiny, Composer, vote list and rendezvous picker are all off.
- Given the whole web test suite, when run, then it is green and `rg "composing" apps/web/src` finds only unrelated names.

## Implementation Notes

- Implemented directly (no subagent). `interaction` is a read-only view of a private `interactionState`; `setInteraction()` is the only writer. Helpers `leaveCompose()` (back to `destinee` if `destinyPollId` is set, else `lecture`) and `dropDestiny()` route every old `exitCompose()`/`exitDestiny()` caller; `loadForPartieId` calls `setInteraction('lecture')` then both cleanups.
- `destinyDates` and `destinyPresentable` now require `interaction() === 'destinee'`; `composer` still returns `null` first. Template bindings on `destinyPollId()` are unchanged.
- New type file `calendar/calendar-interaction.ts`. Specs: setup only changed (`interaction: 'composer'`, `destinyPollId.set` followed by `setInteraction('destinee')`), plus a new describe (12 pairwise transitions, chain Destinée → Composer → cancel) and one selection-reset test per grid view.
- Verification: web suite 4695 pass, 2 fail (`rail : état de repos` and `AC11` — fixed-date tests already failing before this story, per sprint-status). `tsc` has no error besides the pre-existing TS6059 rootDir noise; eslint has 150 pre-existing prettier errors repo-wide, none introduced. Running prettier on whole files reformatted unrelated code, so the formatting noise was reverted by 3-way merge.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Edge | Choosing a poll in the Destiny list (or `?poll=`) while the Composer is armed exits the Composer silently via `enterDestiny` → `setInteraction('destinee')` | high | patch — the chip stays reachable while composing (`calendar-view.html` shows `app-destiny-control` outside Agenda); before 52.1 composing stayed on. Fixed: `enterDestiny` only lights `destinee` when not in `composer`; test added |
| 2 | Blind, Edge, Gap | Views' selection effect fires on every `interaction` change, so lecture ⇄ destinee now wipes the selection (it never did) | medium | patch — fixed with a `selectionScope` computed in both grids (`destinee` folds into `lecture`); test added, `composer`/`declaration` still clear |
| 3 | Gap | `quitDestiny` / vote-gone effects not asserted on `interaction()` | medium | patch — assertions added (`lecture` after `quitDestiny`, after vote vanishing, `composer` + no poll when composing) |
| 4 | Gap | "valider réactive la Destinée" not asserted on `interaction()`; test title promises validation | medium | patch — creation-confirm test asserts `destinee`; Destiny→Composer test renamed to cancel only |
| 5 | Blind | Test `composer sans vote désigné` passes vacuously (`seanceX` not armed in that scenario) | medium | patch — rewritten with `turnOn('composer')` and asserts the intermediate `composer` |
| 6 | Edge | `dropDestiny` comment says the vote "reste désigné" while the code clears it | low | patch — comment corrected (comment only) |
| 7 | Blind | Doc comments on the views' `interaction` input still describe the `composing` boolean | low | patch — month/week docstrings reworded |
| 8 | Edge | `setInteraction` closes `rendezvousPickerOpen` without resetting `pendingWindow` / refocusing | low | rejected — `proposeOther` and `addSelectedWindow` reset `pendingWindow` before every use; fix would add state coupling (`pickRendezvous` reads it after arming) |
| 9 | Blind, Edge | `setInteraction('destinee')` accepted with no designated poll | low | rejected — only `enterDestiny` lights it and sets the poll first; unreachable in the app, only tests call it directly |
| 10 | Blind | `exitDestiny`/`exitCompose` should be private to `setInteraction` | low | rejected — spec keeps them pure cleanup; `exitDestiny` is protected and called in specs |
| 11 | Blind | Redundant `exitCompose`/`exitDestiny` after `setInteraction('lecture')` in `loadForPartieId` | false | they reset state even when `interaction` is already `lecture` (stale composed cells from the previous partie) |
| 12 | Edge | Same-state `setInteraction` returns early without cleanup | low | rejected — no caller depends on it; `enterDestiny` handles its own resets |
| 13 | Edge | "pure refactor" claim vs pairwise exit rule (destinee → composer keeps the poll) | false | the keep-the-poll exception is stated in the frozen Intent/Boundaries and in the I/O matrix |
| 14 | Blind | `'declaration'` is a forward declaration nothing sets | false | required by the story: the value exists, no screen lights it (Story 52.2) |
| 15 | Blind | `=== 'composer'` repeated ~40 times; spec redefines `Tool` instead of `CalendarInteraction` | low | rejected — the story requires reads through `interaction() === 'composer'` and drops the `composing` name |
| 16 | Blind, Gap | ~40 `composing()).toBe(false)` weakened to `not.toBe('composer')`; tests pair `destinyPollId.set` + `setInteraction` | low | rejected for the bulk — setup-only change demanded by the story; the sites where the target state is known (#3, #4) were tightened |
| 17 | Blind | Untested paths: group-event `stillOpen` effect, `leaveCompose` with a vanished vote, partie-change reset | low | rejected — covered indirectly by existing tests that still pass; not a behavior change |
## Design Notes

Because `destinyPollId` outlives a Composer armed from Destiny, `interaction` cannot be derived from it: `setInteraction('composer')` leaves Destiny's poll untouched, whereas any other target calls `exitDestiny()`.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: all green, including the three calendar specs
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error other than TS6059 rootDir noise
