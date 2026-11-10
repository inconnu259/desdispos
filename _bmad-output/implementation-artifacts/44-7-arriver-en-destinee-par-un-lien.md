---
title: 'Story 44.7 — Arriver en Destinée par un lien'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: '873bbf7148b944adabe64b52445e89c7de578971'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** "Voter dans le calendrier" (conjonction, relance e-mail) and the party page's "vote en attente" land on the bare calendar: the player must find the vote through the ✦ list. Nothing addresses a vote, so a reload or a shared link cannot bring anyone back to it, and each place builds the calendar address on its own.

**Approach:** `?poll=<pollId>` opens the Destinée on that vote; `?pollList` opens the ✦ list. Both are read at init and rewritten with `Location.replaceState` (never a router navigation). One pure `atelierUrl()` in `@master-jdr/shared` builds the address for the web and the e-mail template; the existing vote links use it.

## Boundaries & Constraints

**Always:**
- `atelierUrl({ partieId, family, role }, params)`: JDR + `mj` → `/parties/:id/calendar`; JDR player/other and every `ralliement` → `/parties/:id/guild-calendar`; `params` (`poll`, `pollList`, `seanceId`) are added as an encoded query string, in a stable order; absent params add nothing. Pure, runtime export (no `import type`), unit-tested; the web builds `routerLink` commands from the same path/query pieces.
- `?poll` entry reuses `chooseDestiny`: Month view (Week for `ralliement`), drawer collapsed, `destinyEntryOption(poll, today)`. It waits until `openPollsSvc.loaded()` and, at the atelier, until the party data are loaded — otherwise the death effect would end the mode at once. At the atelier the vote must belong to the routed party and be in `destinyPolls()`.
- `?pollList` opens the ✦ list (atelier: this party's votes; vitrine: all) when it has lines, else nothing. It is consumed once and removed.
- The address follows the mode: on each entry, change or exit of the Destinée, `poll` is set or removed with `Location.replaceState`, keeping every other query parameter (`from`, `to`…). While a `?poll` link still awaits resolution, the address is not touched. A reload keeps the link working.
- Unknown, closed or foreign `?poll`: normal calendar, the notice « Ce vote n'existe pas ou n'est plus ouvert. » once (the 44.6 `destinyNotice`), parameter removed, nothing said about the vote. A party the reader cannot access keeps the page's usual refusal.
- Links moved to `atelierUrl` with `?poll`: "Voter dans le calendrier" of the event window (conjonction and isolated evening) → `?poll=<its pollId>`; "Composer les créneaux" stays without parameter; the relance e-mail link (API, `remindVote`) → `?poll=<poll.id>`; the party page "vote en attente" for a JDR player → `?poll` when exactly one vote is open, else `?pollList`, label unchanged; the board's "voir qui" (vitrine, organizer) → the atelier with `?poll` (role `mj` for a JDR organizer).
- Notice text per theme (neutral wording, no JDR word, no "partie"); French comments; no dependency; Docker only.

**Never:**
- No router navigation to rewrite the address, no new route or endpoint, no `?seanceId` arming (45.x), no change to the dashboard links, no voter identity in any address.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Link to an open vote | `…/guild-calendar?poll=p1` on a conjonction | Week view, Destinée on `p1`, drawer collapsed on first upcoming slot | N/A |
| Reload | address after entry | same Destinée again | N/A |
| JDR, personal | `/profile/calendar?poll=p1` | Month view, Destinée on `p1` | N/A |
| Unknown / closed / foreign | `?poll=zzz` | normal calendar, notice once, `poll` removed | N/A |
| List link | `?pollList` | ✦ list open, parameter removed | no lines → nothing |
| Leave the Destinée | quit / vote ends | `poll` removed, other params kept | N/A |
| Choose in the list | pick `p2` | address now `?poll=p2` | N/A |
| One open JDR vote | player's party page | link `?poll=<id>` | N/A |
| Several open JDR votes | player's party page | link `?pollList` | N/A |
| Relance e-mail | conjonction | link ends `/guild-calendar?poll=<pollId>` | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` (+ spec) -- `atelierUrl`, `atelierPath`, `atelierQuery` (`PartieRole`, `familyOf`/`GameSystemFamily` exist); next to `destinyEntryOption`.
- `apps/api/src/notifications/notifications.service.ts` (~L269) -- relance `link` via `atelierUrl({ partieId, family: 'ralliement', role: 'member' }, { poll: poll.id })` on `WEB_ORIGIN`; update `notifications.service.spec`, `notifications.integration.spec`, `ralliement.e2e-spec` (~L4057) expectations.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,spec.ts}` -- read params in `ngOnInit` (~L2279); `linkPending` + readiness (`openPollsSvc.loaded()`, new `partieDataLoaded` set at the end of `loadForPartieId`); effect applying the link through `chooseDestiny`; effect syncing `poll` on `destinyPollId` with `Location`; `openDestinyWho` (~L1360) → `router.navigateByUrl(atelierUrl(…))`; the 44.4 test expecting `['/parties', id]` is updated.
- `apps/web/src/app/features/events/event-dialog/event-dialog.ts` + `conjonctions-tab` + `soiree-tab` -- `calendarRequested` carries the `pollId` (vote button) or `null` (compose); tabs navigate with `atelierUrl` and `replaceUrl`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.{ts,html}` -- player "vote en attente" link (`activePolls()`), `routerLink` + `queryParams`.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- `calendar.destiny_link_unknown`.
- Reuse: `chooseDestiny`, `destinyNotice`, `destinyListItems`, `OpenPollsService.loaded`, `Location`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared` -- `atelierUrl` + tests -- AR18
- [x] `notifications.service.ts` + its specs -- relance link with `?poll` -- FR14
- [x] tones (3 themes) + tone spec -- unknown-link notice -- UX-DR14
- [x] `calendar-view.*` -- read, apply, sync, "voir qui" -- FR13
- [x] event window, tabs, party page -- links through `atelierUrl` -- FR14
- [x] Tests: each matrix row; `replaceState` used, no router navigation; other query params kept; no early death of the mode at the atelier; foreign party vote refused

**Acceptance Criteria:**
- Given a "Voter dans le calendrier" click on a conjonction, when the group calendar opens, then the Destinée is active on that vote in Week view, the drawer collapsed on the first upcoming slot, and the address reads `?poll=<pollId>`.
- Given the relance e-mail, when its link opens, then the same arrival happens after sign-in.
- Given a link whose vote is closed, when the calendar opens, then it is normal, says so once, and the address has no `poll`.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- Shared: `atelierUrl`, `atelierPath`, `atelierQuery`, `AtelierUrlParams` (tested from `apps/web/.../core/poll/atelier-url.spec.ts`, shared has no test runner of its own). API: the relance e-mail link is `atelierUrl({ …, family: 'ralliement', role: 'member' }, { poll })`; unit, integration and e2e expectations updated and green.
- `calendar-view`: params read in `ngOnInit` into `linkPending`; `partieDataLoaded` (reset at the start, set at the end of `loadForPartieId`) gates both the personal and the atelier case; `applyLink` goes through `chooseDestiny` after checking the vote is served to me, in the page's own list and (atelier) of the routed party; `writeQuery` rewrites the address with `Location.replaceState` (path falls back to `/`: an empty URL is a no-op), only when it changes; two effects (apply, sync). `openDestinyWho` → `router.navigateByUrl(atelierUrl(…, { poll }))`.
- Links: `calendarRequested` now carries `string | null` (vote → pollId, compose → null); the two tabs use `navigateByUrl(atelierUrl(…))`; the party page player link is `calendarLink()` (`atelierPath` + `queryParams`: `poll` for one open vote, `pollList` for several).
- **Root cause found by the browser check:** `OpenPollsService` declared itself `loaded` at start-up while the list of my parties was still empty, so a `?poll` link (and any end-of-mode check) saw « no open poll ». `MyPartiesService` now exposes `loaded` (set after the first successful `GET /parties`) and `OpenPollsService` waits for it before concluding « no party, nothing to load ». Specs and the five `MyPartiesService` mocks of `partie-detail.spec` updated.
- 44.6 follow-up: `loadForPartieId` already reset the Destinée; the tone `calendar.destiny_link_unknown` is the 6th key of the closing block.
- Tests: web suite passes except the 3 known date-dependent failures; `tsc` (app and spec) only TS6059 noise; API `notifications` + `email` suites and the relance e2e green. eslint findings left in `calendar-view.ts` (739, 2026, 2536) are on lines this story did not touch.
- Visual check 2026-10-24 (Chrome, real account, Atelier Cuivré, ≥ 768 px): choosing a vote writes `?poll=<id>`; reload and a link with an extra `from` reopen the same Destinée and keep `from`; quitting removes only `poll`; an unknown id shows the notice once and strips the parameter. Not exercised: the atelier (`/parties/:id/…`) and the group Week view in a browser, the e-mail link in Mailpit, `?pollList`, the party page link, phone width.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | `loaded` of `OpenPollsService` was true before my parties were read, so a valid `?poll` was refused as unknown | high | seen in Chrome (valid id → notice); `MyPartiesService.loaded` added, `OpenPollsService` waits, two new specs |
| 2 | The apply effect ran before `partieId()` was set, so the atelier case was resolved as personal | high | caught by the matrix tests; the effect now waits for `partieDataLoaded` in both contexts |
| 3 | `replaceState('')` is a no-op when the path is empty, leaving a stale `?poll` | medium | caught by the quit test; path falls back to `/` (a real page always has a path) |
| 4 | A link must not open a vote of another party | false | refused by `entry.partieId === partieId()` and by presence in the page's own list; tested |
| 5 | The router's own URL is stale after `replaceState` | low | the router is only navigated at page init and party change, both starting from a fresh URL; the spec requires no router navigation |
| 6 | The vitrine message does not distinguish unknown from closed | false | required: nothing is said about the vote |
| 7 | `partieDataLoaded` stays false if loading throws, leaving the link pending | low | the page is then in its error state; no wrong message is shown |
| 8 | Remaining eslint/prettier findings in `calendar-view.ts` and the tone spec | false | predate this story (same lines as before) |

## Design Notes

Decided without the human: readiness waits for both `/me/open-polls` and, at the atelier, the party data (the shared death effect ends a mode whose vote is missing from the loaded list). The vote must be both served to me and in the page's own list, so a link can never open a vote of another party. "voir qui" gives role `mj` to a JDR organizer, since the server grants `can.choose` there to the GM only.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec api pnpm typecheck` -- expected: no error; `docker compose exec api pnpm test notifications` -- expected: pass
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no new error (TS6059 excepted)

**Manual checks (if no CLI):**
- Open each link kind in Chrome, signed in, three themes; reload keeps the Destinée; the e-mail link in Mailpit.
