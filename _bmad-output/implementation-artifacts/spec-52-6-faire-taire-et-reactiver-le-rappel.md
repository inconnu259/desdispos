---
title: 'Story 52.6 — Silence the reminder, re-enable it from the Account page'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'c95314c14b83b341528f0cedcfca85ea506f5270'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The "Dispos à déclarer" banner (52.5) has no way out: someone who does not want it sees it on every dashboard visit, and the preference added in 52.4 has no screen.

**Approach:** One web method, `AvailabilityReminderService.setEnabled()`, is the only writer of the preference. The banner's "Ne plus me le rappeler" calls it and confirms with an undoable snackbar; the Account page gets a checkbox that calls the same method. Server unchanged.

## Boundaries & Constraints

**Always:**
- `setEnabled(enabled)` writes `availabilityReminder` through `AccountService.updatePreferences` (`PATCH /me/preferences`), replaces `auth.currentUser` with the returned `AuthUser`, then re-reads `GET /me/availability-reminder`. It is optimistic: `auth.currentUser.availabilityReminder` changes at once, and silencing hides the banner at once. On failure the displayed value and the banner state come back, but only if no later request was made since (same guard as `onLayerToggle`). It resolves to whether the write succeeded.
- Banner: a text button "Ne plus me le rappeler" (identical in the three themes, explicit accessible name). On tap the banner goes away; once written, a snackbar confirms with the action "Annuler" (identical in the three themes): Grimoire "Rappel désactivé. Vous pourrez le réactiver depuis Mon grimoire." · Forêt "Rappel désactivé. Tu pourras le réactiver depuis Mon carnet." · Atelier "Rappel désactivé. Vous pourrez le réactiver depuis Mon établi." "Annuler" calls `setEnabled(true)`; the banner returns if the reminder condition still holds (the re-read). If a write fails, the banner is back and a failure message (a key of the three tone files) says so.
- Account page, right after the "Ce que révèle mon calendrier" block and before the Ludothèque row: a `mat-checkbox` "Me rappeler de déclarer mes dispos" (identical), same pattern as that block's checkboxes, checked from `AuthUser.availabilityReminder` (so checked by default), with a subtitle linked by `aria-describedby`: Grimoire "Un rappel apparaît sur le tableau de bord quand rien n'est déclaré pour les quatre semaines à venir." · Forêt "Un rappel apparaît sur ton tableau de bord quand tu n'as rien noté pour les quatre semaines à venir." · Atelier "Un rappel apparaît sur le tableau de bord quand rien n'est consigné pour les quatre semaines à venir." Ticking or unticking calls `setEnabled()`.
- One preference: silencing from the banner unticks the Account checkbox in the same session, and ticking it brings the banner back; on another device the `user:{id}` event hides or restores the banner without reload, and the checkbox takes the account value at the next `AuthUser` load. The checkbox silences only this reminder: the cards' signals (`GET /me/party-signals`) stay.
- New keys in the three tone files: identical ones are `dashboard.reminder_silence`, `dashboard.reminder_undo`, `account.availability_reminder_label` (added to `NEUTRAL_KEYS`); per theme are `dashboard.reminder_silenced`, `dashboard.reminder_write_error`, `account.availability_reminder_hint`. Existing `--jdr-*` variables only; the button and checkbox are keyboard reachable.

**Never:** a server change; a second writer of the preference; touching the party signals; a new colour token.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Silence | Tap "Ne plus me le rappeler" | Banner gone at once; preference written; snackbar with "Annuler" | Write fails: banner back, failure message |
| Undo | Tap "Annuler" | Preference true again; banner back if the reminder is still due | Write fails: failure message, preference stays off |
| Checkbox | Untick / tick on the Account page | `setEnabled(false/true)`; value shown at once | Write fails: shown value restored unless a later request was made |
| Same session | Silence from the banner, open Account | Checkbox unticked; ticking it restores the banner | N/A |
| Other device | `user:{id}` event | Banner hides / returns without reload | N/A |
| Party signals | Reminder silenced | Cards' signals unchanged | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/core/availability/availability-reminder.service.ts` (52.5) -- `show`, `refresh()`, owner-keyed state; add `setEnabled()`.
- `core/account/account.service.ts` -- `updatePreferences()` (L~58): add `availabilityReminder?: boolean` to its body type.
- `core/auth/auth.service.ts` -- `currentUser` signal replaced by the returned `AuthUser`.
- `features/dashboard/dashboard.html|ts|scss` -- the `reminder-banner` (52.5); `MatSnackBar` not yet used there; the calendar spec/`board-games-page` show snackbar and undo patterns; `dashboard.spec.ts` `createFixture` provides mocks.
- `features/account/account.html|ts` -- block "Ce que révèle mon calendrier" (`mat-checkbox`, `.calendar-intents__why` subtitle) then the `board-games-row`; `onLayerToggle()` is the optimistic-with-rollback pattern; `account.spec.ts`.
- Tone files and `core/theme/theme-tone.service.spec.ts` `NEUTRAL_KEYS`.

## Tasks & Acceptance

**Execution:**
- [x] `account.service.ts` + `availability-reminder.service.ts` -- `setEnabled()` and spec cases (write, `auth.currentUser` updated, re-read, optimistic hide, rollback on failure, later-request guard)
- [x] tone files + `NEUTRAL_KEYS` -- the six keys
- [x] `dashboard.html|ts|scss` -- the button, the snackbar flow, failure message
- [x] `account.html|ts` -- the checkbox and its subtitle
- [x] specs -- `dashboard.spec.ts` (banner hidden, preference written, snackbar text in the three themes, "Annuler" re-enables, failure restores the banner), `account.spec.ts` (placed after the calendar block, state from `AuthUser`, toggle and rollback, subtitle per theme, `aria-describedby`, party signals unchanged)

**Acceptance Criteria:**
- Given the banner, when I tap "Ne plus me le rappeler", then it disappears, `availabilityReminder: false` is written, and a snackbar offers "Annuler".
- Given the Account page, when I tick the checkbox again, then the preference is true and the banner returns on the dashboard if the reminder is due.
- Given `docker compose exec web pnpm test`, then it is green except the 2 fixed-date rail tests failing before 52.1.

## Implementation Notes

- Implemented directly (no subagent). `AvailabilityReminderService.setEnabled()` is the only writer: optimistic value and banner, `PATCH` through `AccountService.updatePreferences`, returned `AuthUser` adopted, re-read; rollback to the confirmed value and banner state on the latest write failing; a superseded failure resolves `true`; reads sent before a silencing are discarded; nothing is touched if the person changed meanwhile. Dashboard: `reminder-banner__silence` button, undoable snackbar loaded on demand (like `MatDialog`, for the bundle budget), failure message. Account: `.reminder-pref` checkbox after the calendar block, `aria-describedby` hint. Six tone keys; `dashboard.reminder_silence`, `dashboard.reminder_undo` and `account.availability_reminder_label` are in `NEUTRAL_KEYS`.
- Real-time evaluation (CLAUDE.md, `docs/checklist.md`): the preference change emits `user:{id}` server-side (52.4) and `AvailabilityReminderService` re-reads on the `user:` prefix (52.5), so another device hides or restores the banner without reload; the checkbox takes the account value at the next `AuthUser` load, as the story says. The party signals are untouched.
- Not seen in a browser (Claude in Chrome not connected): the banner with its two actions on a phone, the snackbar and the Account checkbox stay manual.
- Verification: web suite 4801 pass, 2 fail (the fixed-date rail tests failing before 52.1); `tsc` clean apart from TS6059.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Blind, Edge | Two overlapping writes that both fail rolled the last one back to the first one's optimistic value, which no server ever held | high | patch — the rollback target is the CONFIRMED value and banner state, captured when no write is in flight (like `confirmedLayers` on the Account page), then the reminder is re-read; test added |
| 2 | Edge | A read sent before silencing and answered after it re-lit the banner | high | patch — `setEnabled(false)` discards every read issued before it (`appliedSeq = seq + 1`); test added |
| 3 | Gap, Edge | An older write failing after a newer choice resolved `false`, so the dashboard showed a failure message that contradicted the state on screen | medium | patch — a superseded failure resolves `true` (nothing to report); only the latest write's failure resolves `false`; tests added |
| 4 | Edge | The person changing during the write (logout, other account) let the success or rollback touch the next account | medium | patch — nothing is touched once `currentUser().id` differs; test added |
| 5 | Gap | The "newer choice" test and the "returned AuthUser" test could not fail if their guard or assignment were removed | medium | patch — new tests start from values that differ from the final one, assert `show()` and the displayed value, and resolve with an `AuthUser` that differs from the optimistic one |
| 6 | Edge | A second tap during the write sent a second PATCH and a second snackbar | medium | patch — a `silencing` guard; test added |
| 7 | Blind, Edge | `openSnack` unguarded (chunk load failure, destroyed injector) after the preference was written; `onAction` never torn down | medium | patch — guarded, `takeUntilDestroyed`; test added |
| 8 | Blind, Edge | The success path replaces the whole `AuthUser`, losing concurrent changes to other fields | low | rejected — the frozen requirement says the returned `AuthUser` replaces `auth.currentUser` |
| 9 | Blind, Edge | The Account page shows no message when the write fails | low | rejected — the frozen requirement only restores the displayed value there; the message belongs to the banner flow |
| 10 | Blind | The checkbox might not visually revert (binding vs `mat-checkbox` internal state) | false | the binding goes false then back to true, so Angular re-applies it; same pattern as `onLayerToggle` |
| 11 | Blind | Writes may reach the server out of order; no cross-tab propagation or SSE evaluation | low | rejected — last-choice-wins is the existing pattern; the server emits `user:{id}` on a preference change (52.4) and the service re-reads on `user:` (52.5), recorded in the notes |
| 12 | Blind | "Quatre semaines" copy hard-coded; `reminder_silenced` copy duplicates `nav.account`; focus after the banner leaves; post-write re-read failing silently | low | rejected — the sentences are the frozen texts; no focus requirement in the story; the next event or dashboard visit re-reads |
## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 known fixed-date tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error other than TS6059

**Manual checks (no browser available at planning):**
- Silence from the banner, open Account (box unticked), tick it, go back to the dashboard (banner returns); on a second device the banner follows.
