---
title: 'Story 52.5 — The "Dispos à déclarer" reminder on the dashboard'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'c2889788ab25701f64a6b5fe02be2d954db18912'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 52.4 lets the server say whether to remind a member to declare availability, but nothing shows it, and the calendar cannot be opened straight into declaration mode.

**Approach:** A web service reads `GET /me/availability-reminder`; the dashboard shows one banner at the top when it says yes, with an action that opens `/profile/calendar?declarer=1`; the calendar reads that parameter once and lights the declaration mode in Month view. Silencing the reminder is Story 52.6.

## Boundaries & Constraints

**Always:**
- `AvailabilityReminderService` (`apps/web/src/app/core/availability/availability-reminder.service.ts`, `providedIn: 'root'`): a readonly signal `show` (false until the first answer), `refresh()` with the stale-answer guard used by the sibling services (a failure keeps the last known state, so nothing flickers and nothing shows on error), and `notifyChanged()`, which re-reads once a first read has happened. `RealtimeService` registers it on the `user:` prefix next to `partySignals`.
- The dashboard, already connected to `user:{id}`, calls `refresh()` when it opens. When `show()` is true, ONE banner sits at the very top, before the received invitations and the party lists, never one badge per card; none without an active party (the server's answer) nor while loading.
- Banner `reminder-banner` follows the `.calendar-notice` pattern only: background `--jdr-status-todo` at 12%, border 1px solid `--jdr-status-todo`, radius 14px, padding 12px 16px. A `<section aria-labelledby>` with the title "Dispos à déclarer" (14px / 700, identical in the three themes), then the theme sentence (14px / 500, `--jdr-text`): Grimoire "Rien n'est inscrit à votre almanach pour les quatre semaines à venir." · Forêt "Rien n'est noté dans ton calendrier lunaire pour les quatre semaines à venir." · Atelier "Aucune disponibilité au registre horaire pour les quatre semaines à venir." Title, sentence and action wrap on a phone with no horizontal overflow.
- Action: a filled button/link "Déclarer mes dispos" (existing key `calendar.declare_btn`) to `/profile/calendar?declarer=1`, reachable by keyboard. New keys `dashboard.reminder_title` (identical, added to `NEUTRAL_KEYS`) and `dashboard.reminder_body` (per theme) in the three tone files.
- Calendar: `?declarer=1` is read once in `ngOnInit`, beside `?poll=`; the view goes to Month and `setInteraction('declaration')` lights the mode (after the `:id` reset of `loadForPartieId`, which sets `lecture`); the parameter is removed at once (`writeQuery`/`replaceState`), so a reload or Back does not relight it. If `?poll=` is also present, Destiny wins and `declarer` is only removed.
- The banner disappears without reload as soon as a declaration covers the next four weeks (on this or another device, via `user:{id}`), returns live when a deletion empties the period, and reappears on the next dashboard display when declarations leave the window with time. Real-time evaluation (CLAUDE.md): banner on `user:` through the service; the personal calendar is already connected to `user:{id}`.

**Never:** silencing, `setEnabled`, the Account checkbox (52.6); a server change; a new colour token; a per-card badge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Due | `{ show: true }` | One banner at the top with the theme sentence | N/A |
| Not due / loading | `{ show: false }`, or before the first answer | No banner, no placeholder | N/A |
| Read fails | Network error | Last known state kept; banner absent if never read | Silent |
| Live update | `user:{id}` event, now `false` / `true` | Banner disappears / appears without reload | N/A |
| Open the calendar | Tap "Déclarer mes dispos" | `/profile/calendar?declarer=1`: Month view, mode on, parameter removed | N/A |
| With `?poll=` | `?declarer=1&poll=p1` | Destiny opens on `p1`; `declarer` removed, mode off | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/core/parties/party-signals.service.ts` and `core/poll/datable-seances.service.ts` -- patterns for `refresh()`, the stale-answer guard and the lazy `notifyChanged()`; `core/availability/` holds the existing `availability.service.ts` (different role).
- `core/realtime/realtime.service.ts` -- `handlers` table (`user:` entries), `realtime.service.spec.ts` (providers list and per-handler tests).
- `features/dashboard/dashboard.html|ts|scss` -- the template opens with `@if (received().length > 0)`; `ngOnInit` (L~590) connects `user:{id}`; `RouterLink` and `MatButtonModule` already imported; `dashboard.spec.ts` `createFixture` provides mocks per service.
- `features/calendar/calendar-view/calendar-view.ts` -- `ngOnInit` (L~3400, `?poll=` at the `linkPending` block), `writeQuery`, `onViewChange`, `setInteraction`; `loadForPartieId` resets to `lecture`.
- Tone files and `core/theme/theme-tone.service.spec.ts` `NEUTRAL_KEYS`.

## Tasks & Acceptance

**Execution:**
- [x] `availability-reminder.service.ts` + spec -- read, guard, lazy `notifyChanged()`
- [x] `realtime.service.ts` + spec -- `user:` entry (and not `partie:`)
- [x] tone files + `NEUTRAL_KEYS` -- `dashboard.reminder_title`, `dashboard.reminder_body`
- [x] `dashboard.html|ts|scss` -- banner at the top, `refresh()` on open
- [x] `calendar-view.ts` -- `?declarer=1` handling
- [x] specs -- service, realtime, `dashboard.spec.ts` (shown / absent / loading / first in the page / three themes / link with `declarer=1` / disappears after `notifyChanged()` returning false), `calendar-view.spec.ts` (`?declarer=1` → Month, `declaration`, parameter removed; `?poll=` wins)

**Acceptance Criteria:**
- Given a member with nothing declared for four weeks, when the dashboard opens, then the banner is at the top and its action lands on the personal calendar in Month view with the mode on.
- Given `docker compose exec web pnpm test`, then it is green except the 2 fixed-date rail tests failing before 52.1.

## Implementation Notes

- Implemented directly (no subagent). `AvailabilityReminderService` (read, owner-keyed state, lazy `notifyChanged()`, guard against stale answers), registered on `user:` in `RealtimeService`; dashboard banner first in the page (`<section aria-labelledby>`, link `routerLink="/profile/calendar" [queryParams]="{ declarer: 1 }"`), `refresh()` on open; keys `dashboard.reminder_title` (identical, in `NEUTRAL_KEYS`) and `dashboard.reminder_body`; the action reuses `calendar.declare_btn`. `calendar-view.ts` reads `?declarer=1` after the `paramMap` subscription (whose first `loadForPartieId` sets `lecture`), removes it with `writeQuery`, lights Month view + `declaration` unless `?poll=` is present; the two merging navigations now clear `declarer`.
- Real-time evaluation (CLAUDE.md, `docs/checklist.md`): the banner is user-scoped and wired on `user:` through the service; the personal calendar is already connected to `user:{id}`; the dashboard connects to it in `ngOnInit`. No new channel, no `partie:` wiring.
- Not seen in a browser (Claude in Chrome not connected): the banner layout on a phone and the Nina walkthrough stay manual.
- Verification: web suite 4777 pass, 2 fail (the fixed-date rail tests failing before 52.1); `tsc` clean apart from TS6059.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Blind, Edge, Gap | The root singleton keeps the reminder across logout and a login as another user: B sees A's banner, and a failing first read keeps it | high | patch — the answer is stored with the id of the person who asked; `show` is true only for that person; real-time re-reads only for the person whose first read was requested; a response arriving after an account change is dropped; tests added |
| 2 | Blind, Edge | A failed newer request made an older successful response discard itself | medium | patch — the guard compares with the last APPLIED request, not the last requested one; test added |
| 3 | Edge | Navigations with `queryParamsHandling: 'merge'` (range load, range search) re-add `declarer=1` because the Router still holds it, so a reload relights the mode | medium | patch — both navigations pass `declarer: null`; test spies `Router.navigate` |
| 4 | Blind | Ordering test only proves the banner precedes some selectors | low | patch — it now checks the banner is the first element of the page |
| 5 | Blind, Edge | `?declarer=1` is honoured on partie routes too, not only `/profile/calendar` | low | rejected — declaration mode exists on the three calendar routes (52.2); the frozen text reads the parameter in `ngOnInit` without restricting the route |
| 6 | Blind, Edge | `?declarer=1` combined with `?seanceId` or `?pollList`; entry logic not shared with `toggleDeclaration()` | low | rejected — the later link resolution (`applyArming`, `applyLink`) turns the mode off through `setInteraction`; at mount there is no composer or draft to hand back |
| 7 | Blind, Edge | Every `user:` event re-reads after leaving the dashboard; no coalescing | low | rejected — same lazy pattern as `DatableSeancesService`; the server rule is cheap (52.4) |
| 8 | Blind | The copy says "quatre semaines" while the horizon is a server constant | low | rejected — the sentences are the frozen texts; the horizon is the shared constant `AVAILABILITY_REMINDER_DAYS = 28` |
| 9 | Blind | No dismiss or link to the preference on the banner | low | rejected — Story 52.6 |
| 10 | Blind | Colour token choice, hex fallback, contrast on three themes, desktop layout of the `?declarer` specs, `createFixture` positional parameters, no live region on the banner, no `docs/checklist.md` edit | low | rejected — tokens and fallback follow the repo's usage; the checklist evaluation is recorded in Implementation Notes; the banner is a static region present at load |
## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: green except the 2 known fixed-date tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error other than TS6059

**Manual checks (no browser available at planning):**
- Nina's walkthrough: banner → "Déclarer mes dispos" → Month view, mode on, help banner → declare → "Terminer" → back to the dashboard, banner gone.
