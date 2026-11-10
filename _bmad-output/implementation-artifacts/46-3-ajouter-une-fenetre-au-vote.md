---
title: 'Story 46.3 — Ajouter une fenêtre au vote'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'a3e69147746ca798808f03c33410f219fde84bf1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-46-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/46-2-mettre-une-fenetre-de-lautomate-en-evidence.md'
  - '{project-root}/docs/security.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A selected automaton window (46.2) cannot yet become a vote slot: « Ajouter au vote » is disabled, so the GM still re-draws on the grid what the automaton already found. And a window already proposed in an open vote keeps being offered.

**Approach:** « Ajouter au vote » always goes through the composer (cumulative additions, one validation, one warning). A window leaves the list while it is in the composer or a candidate of an open vote of the party, and comes back when removed and still free; the server drops already-proposed windows from the GM's list.

## Boundaries & Constraints

**Always:**
- Where the window goes, in this order: composer already open → it enters directly; else the active Destinée is an open vote of this party the GM can modify (`can.edit`) → composer armed prefilled with its slots plus the window; else the rendez-vous choice opens listing COMPOSABLE seances (to date, or carrying an open vote the GM can edit, nature « séance au vote ouvert », composer prefilled); one choice is taken without asking. Picking from this choice adds the window right after arming.
- `isComposableSeance()` is a pure function in `@master-jdr/shared` (reusing `isDatableSeance`); the GM's open-vote rows come from the scenarios already loaded. The picker gains the nature `seance-poll` (neutral tone key, identical in the three themes, no new layout).
- After adding, the selection clears (the window is now a composer cell). ONE pure function in `features/calendar/` computes the displayed windows: served windows minus composer cells (key `AAAA-MM-JJ|créneau`); the grid shows composer cells with the existing dashed treatment; cancelling the composer hands the windows back.
- Server (`GET /parties/:id/available-slots`, `PartiesService`): in the nominative GM view ONLY, after sorting and BEFORE the cap of 20, drop windows whose date and slot equal an option of an OPEN poll of the party (duration is 1 until epic 47). The aggregated players' view is unchanged. The option keys are read through the `poll/` module (`PollVoteCleanupService`, dependency-free, already injected), never by a new `parties/` Prisma read of poll tables. A window removed from a vote returns on the next read if still free.
- Validation stays the existing one (create or modify in one go, usual loss-of-answers warning, Destinée reactivates on the written vote); the composer's existing limits apply. The atelier already reloads `available-slots` on `partie:{id}`; do not add a channel.
- « Masquer » stays disabled (46.4). ⚠️ Flag changed validated screens: the automaton list (windows leave it), the rendez-vous choice (new nature).
- `apps/web`, `packages/shared`, `apps/api/src/parties` + `poll`; no migration, no dependency, French comments/errors, Docker only.

**Never:**
- No write from the window itself, no server write route, no second composer, no change to the aggregated view, no duration handling (47).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Composer open | add selected window | joins composer cells, leaves list, selection cleared | N/A |
| Destinée on own vote | add | composer armed with vote's slots + window | N/A |
| One composable seance | add, no composer, no Destinée | composer armed on it, choice skipped | N/A |
| Several | add | choice opens (to date and open-vote rows); pick arms, window added | Esc closes, window stays selected |
| Cancel | composer cancelled | window back in list | N/A |
| Already proposed | window equals an option of an open vote | GM list omits it before the cap of 20 | N/A |
| Removed from vote | option dropped, read again | window listed again if free | N/A |
| Player | aggregated read | identical to before | N/A |
| Nothing composable | none | « Ajouter au vote » absent of effect: no row, no target | no write |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` (~L407) -- `isComposableSeance` next to `isDatableSeance`.
- `apps/api/src/poll/poll-vote-cleanup.service.ts` -- `openOptionKeys(db, partieId): Promise<Set<string>>` (OPEN polls only); `apps/api/src/parties/parties.service.ts` (`getAvailableSlots` ~L1512, `slice(0, 20)`) filters `sorted` when `nominative`; specs `parties.service.spec.ts` (`polls` mock ~L277 gains the method; new tests next to `describe('getAvailableSlots')` ~L2600) and an e2e/controller refusal-unchanged check for the player view.
- `features/calendar/rendezvous-picker/rendezvous.utils.ts` -- `RendezvousNature` + `'seance-poll'`, `jdrComposable()`; `rendezvous-picker.ts` reads `calendar.rendezvous_nature_seance-poll` (key per nature).
- `features/calendar/` new `window-list.utils.ts` (pure displayed-windows function) + spec.
- `calendar-view.{ts,html}` -- `addSelectedWindow()` (~after `onWindowSelected`), picker mode (window vs propose) + pending window, `composableRows`, `displayedSlots` replacing `availableSlots()` for the two MJ lists (and `slotsDockLabel` count), `armTarget` (~L2147) and `startCompose` (~L2190) reused, `onComposeAdded` semantics; `creneau-card` enables « Ajouter au vote » (`addRequested` output, keeps `aria-disabled` only for « Masquer »), `available-slots` forwards it.
- Tones x3 + tone spec -- `calendar.rendezvous_nature_seance-poll` neutral (mind the Atelier voice-ratio floor).
- Do not touch: heatmap, aggregated cards, composer write paths.

## Tasks & Acceptance

**Execution:**
- [x] shared `isComposableSeance` + spec
- [x] API: `openOptionKeys`, exclusion before the cap, specs (nominative excludes, aggregated unchanged, cap after exclusion)
- [x] picker nature + `jdrComposable` + tone + specs
- [x] `window-list.utils` + spec; `creneau-card` / `available-slots` output
- [x] `calendar-view` flow + specs for every matrix row
- [x] web suite, API unit + e2e, typecheck (web, API), lint; Chrome check

**Acceptance Criteria:**
- Given a selected window and no composer, when I press « Ajouter au vote » with a single seance to date, then the composer opens on it with the window as a slot, and the window leaves the list.
- Given an open vote proposing a window, when the GM reads available-slots, then that window is absent and the list still holds up to 20 others; a player's read is unchanged.
- Given I cancel the composer, then the windows I had added are listed again.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); one inline self-review of the diff.
- Shared: `isComposableSeance` (reuses `isDatableSeance`). API: `PollVoteCleanupService.openOptionKeys(db, partieId)` (OPEN polls, keys `AAAA-MM-JJ|CRÉNEAU`), read by `PartiesService.getAvailableSlots()` only in the nominative view, filter applied after sorting and before `slice(0, 20)`; the aggregated view never calls it. Tests: 4 service cases + 2 on `openOptionKeys` + one HTTP characterization (`seances.e2e-spec.ts`: GM loses the proposed windows, player's aggregated view keeps them).
- Web: `window-list.utils.ts` (`displayedWindows`, the single function of AR8); `jdrComposable()` + nature `seance_poll` (neutral tone key `calendar.rendezvous_nature_seance_poll`); `CalendarView.addSelectedWindow()` / `addWindowCell()` / `composableRows` / `displayedSlots` / `windowAddable`, picker `rendezvousPickerMode` (`propose` | `window`) with a pending window; `creneau-card` / `available-slots` output `addRequested` and input `canAdd`.
- Decided during build: the window picker always uses the modal sheet (the anchored menu hangs off the « Proposer des dates » button, which may be absent when only open-vote seances are composable); « Ajouter au vote » is `aria-disabled` when there is nowhere to add (no composer, no editable Destinée vote, no composable seance) rather than a silent click.
- Verification: web suite OK except the 3 known date-dependent failures; web and API typecheck clean; API unit 2867/2868 — the one failure (`AD-9 end-to-end` in `parties.service.spec.ts`) fixes its seance at 2026-09-20 and the derived unavailability expires a day later, so it fails since that date passed (not touched by this story, recorded in `deferred-work.md`); API e2e `seances` 7/7 and `ralliement` 258/258.
- Visual check 2026-10-25 (Chrome, real account, GM atelier): the account's party has no composable seance, so « Ajouter au vote » shows disabled (the « nowhere to add » case). The positive flows (composer, picker, Destinée vote) are covered by 12 `calendar-view` tests but were not exercised in a browser.

## Spec Change Log

## Review Triage Log

Inline self-review of the diff (no subagent without an explicit request).

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | « Ajouter au vote » did nothing when no seance was composable (seen in Chrome) | medium | fixed: `canAdd` / `windowAddable`, button `aria-disabled`, test added |
| 2 | Exclusion keys use UTC `toISOString()` of the option date | low | options are stored at UTC midnight (`@db.DateTime` written from `YYYY-MM-DD`), same convention as `getAvailableSlots` dates |
| 3 | `openOptionKeys(this.prisma, …)` passes the Prisma client as `db` | low | typed `Pick<TransactionClient, 'pollOption'>`; keeps `poll/` free of `parties/` and the service dependency-free |
| 4 | Closed polls of the party are not excluded | low | by intent (« vote ouvert »): a sealed vote's date is covered by derived unavailability |
| 5 | The window picker is a modal sheet even on desktop | low | decided: the anchor button may not exist; recorded above |
| 6 | Positive flows not seen in a browser | low | no composable seance on the test account; unit tests cover each matrix row |
| 7 | Pre-existing `AD-9 end-to-end` unit failure | low | date-dependent fixture (2026-09-20), unrelated; deferred |

## Design Notes

Decided without the human: the exclusion key is date + slot (duration arrives with 47); option keys are read through `poll/` because `parties/` must not read poll tables; the window picker is the existing picker in a second mode rather than a new component; open-vote rows are derived from loaded scenarios, not a new endpoint.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec api pnpm typecheck` and `docker compose exec api pnpm test` (+ `pnpm test:e2e` for poll/parties) -- expected: pass

**Manual checks (if no CLI):**
- GM atelier: select, add (with/without Destinée, one vs several seances), cancel, validate; reload shows the window gone from the list.
