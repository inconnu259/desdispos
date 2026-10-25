---
title: 'Story 45.2 — Arriver dans le calendrier de la partie avec le composer prêt'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'a0ab782fccd18d260df7b2e35e11149ec8f1252f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Choosing a rendez-vous in the personal calendar or touching « Lancer le vote » on the scenario sheet lands on an atelier that either shows the old 8.7 panel (`app-poll-creation`, JDR GM only) or nothing; the composer asks for the séance only at validation, and arming it does not suspend the Destinée.

**Approach:** `?seanceId` arms the composer for that rendez-vous in the atelier — JDR or group, whatever the route mode — prefilled when the séance already holds an editable open poll; the rendez-vous is chosen BEFORE the composer, so the confirm dialog keeps only the loss-of-answers warning; the 8.7 panel is removed. Armed composer suspends the Destinée; validation reactivates it on the created or edited poll and sets `?poll`.

## Boundaries & Constraints

**Always:**
- Arming reads `?seanceId` once at init, resolves it when the party data is loaded, and only at an atelier (`partieId()` set): the personal calendar never arms a composer. Target from the loaded payload and the served `can`, never from the route mode or `hostId`: JDR séance with an OPEN poll and `can.edit` → `{kind:'poll'}` prefilled; dateless pollless séance of a non-closed scenario with `can.propose` → `{kind:'new', seanceId}` (the id becomes required); group event with an open poll and `can.edit` → `group-poll`. Anything else (including an isolated evening: Story 45.5) → normal calendar, notice « Ce rendez-vous n'est plus à dater. » (one new key, 3 voices — Cuivré « …à planifier. »), `?seanceId` removed, nothing said of the séance.
- While `?seanceId` arms, it stays in the address; it is removed on cancel and on successful validation (`Location.replaceState` via `writeQuery`, never router navigation). Armed from a link in Agenda view: switch to Month (group: Week, existing rule).
- « Lancer le vote » (seance-list) navigates with `atelierUrl({ partieId, family: 'jdr', role: 'mj' }, { seanceId })`; the vitrine pick (45.1) already does the same and stays.
- Composer vs Destinée (AR16): `destinyPollId` is untouched while composing, but the estompe (`destinyDates`) is null and the board stays hidden (already) while `composing()`; the ✦ chip stays. Validation: create → read the new poll id from the returned scenario, edit → the edited poll id, then `chooseDestiny` on it (Destinée active, `?poll` written by the existing effect); cancel → state exactly as before.
- Validation of a `new` target whose séance is no longer datable (dated elsewhere meanwhile) → notice « Ce rendez-vous n'est plus à dater. », composer closed, nothing written; the server stays judge of the rest (its refusal stays in `calendar-error--compose`, composer kept).
- `ComposeConfirmDialog` loses its « new » face and the séance selector: data = counts + `group?`; it opens only when answers would be lost (JDR and group); creating opens no dialog. Retire the dead keys.
- Remove `<app-poll-creation>`, `pollPanelOpen`, `lockedSeanceId`, `closePollPanel`, `onPollCreated`, the locked-seance hint, and delete the orphaned `PollCreationComponent` (files, specs, its `pollui.creation_*` keys and the hint key). ⚠️ screens changed: atelier arrival (panel gone), confirm dialog (selector gone), Destinée (suspended while composing).
- Real time, rights and refusal paths unchanged; French comments and errors; no dependency; Docker only; no API change.

**Never:**
- No composer from the vitrine; no isolated-evening target (45.5); no deadline/duration/gesture work (45.3, 45.4); no new route or payload; the 40.5b round trip (« Nouvelle conjonction ») stays as is.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New vote | `/parties/:id/calendar?seanceId=s` , s dateless, `can.propose` | composer armed `{new, s}`, empty, Month, bar names the rendez-vous, no dialog on validation | N/A |
| Edit vote | s holds an OPEN poll, `can.edit` | composer prefilled with its options, target `poll` | N/A |
| Group host | `/guild-calendar?seanceId=s`, open poll, `can.edit` | `group-poll` armed, Week | N/A |
| Stale link | s dated, scenario closed, no right, unknown, other party | normal calendar, notice once, param removed | nothing revealed |
| Vitrine | `/profile/calendar?seanceId=s` | ignored, never armed | N/A |
| Suspension | Destinée on poll X, then arm | estompe and board off, `?poll=X` kept; cancel → X as before | N/A |
| Validate create | `new` | one write, Destinée on the created poll, `?poll` set, `?seanceId` removed, stays at atelier | refusal → error, composer kept |
| Validate edit with answers lost | removed options hold votes | dialog warns, then writes | cancel dialog → nothing written |
| Dated meanwhile | séance dated elsewhere while composing | notice, composer closed, nothing written | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts` -- `ngOnInit` (reads `seanceId`, sets pending), `startCompose` / `canCompose` / `composeSeanceChoices` / `composeCanConfirm` / `composeBlockedReason` / `confirmCompose` / `cancelCompose` / `exitCompose`, `ComposeTarget` (`seanceId` required), `rendezvousRows` / `modifiablePoll` (drop `isMjMode()` gates, read `can`), `destinyDates` (null while composing), `chooseDestiny`, `writeQuery`, `destinyNotice`, `applyLink` (pattern to copy); remove `pollPanelOpen`, `lockedSeanceId`, `closePollPanel`, `onPollCreated`, `mjSlots` if unused.
- `calendar-view.html` -- remove the `@if (pollPanelOpen() …)` block and the import of `PollCreationComponent`.
- `features/calendar/compose-confirm-dialog/*` -- slim to the warning face (ts, html, spec); `seance-list/seance-list.ts` (+ spec) -- `goToCalendarForSeance` → `atelierUrl`, `router.navigateByUrl`.
- `features/poll/poll-creation/*` -- delete; `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- add `calendar.compose_link_stale`; remove `pollui.creation_*`, `calendar.view_locked_seance_hint`, `calendar.compose_confirm_seance_*`, `calendar.view_compose_blocked_no_seance` (and `common.lancer_le_vote` if orphaned).
- `calendar-view.spec.ts` -- rewrite the `?seanceId` block (l.396-475), the 36.10 tests using `startCompose()` for a new vote or the dialog selector; `withOrganizerDefaults` default `can` becomes organizer-true, tests needing refusal pass NOBODY explicitly.
- Reuse: `applyLink`/`writeQuery` pattern, `showGridForCompose`, `onPollLaunchRequested`, `ScenariosService.createSeancePoll` (returns the scenario).

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + tone spec -- stale notice; drop dead keys
- [x] `compose-confirm-dialog.*` + spec -- warning-only dialog
- [x] `calendar-view.ts/html` -- arming from `?seanceId`, `can`-based targets, suspension, validation → Destinée, stale handling, remove 8.7 panel
- [x] `poll-creation/*` -- delete the orphaned component and its keys
- [x] `seance-list.ts` + spec -- « Lancer le vote » via `atelierUrl`
- [x] Specs -- every matrix row; rewrite old `?seanceId` / 36.10 tests; full web suite and typecheck

**Acceptance Criteria:**
- Given a GM on the scenario sheet, when they touch « Lancer le vote », then the party calendar opens with the composer armed for that séance and no dialog asks for it again.
- Given an organizer armed on a séance while a Destinée is active, when they validate, then the Destinée is on the created or edited poll and the address carries `?poll`, not `?seanceId`.
- Given a link to a séance that is no longer datable, when the calendar opens, then it is normal and says so once.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- `calendar-view.ts`: `composeTargetFor(seanceId)` (target from the loaded payload and `can`), `armTarget` (cells from `activePolls()` / `groupPolls()`, Week for a group, Month when coming from Agenda), `applyArming` fed by `armPending` (read once at init, resolved by an effect when `partieDataLoaded()` and `groupResolved()`), `clearArmParam` (`writeQuery`, called on cancel, validation and stale link), `reactivateDestiny` (refresh `/me/open-polls`, then `chooseDestiny`). `ComposeTarget` `new` now requires `seanceId`; `composeSeanceChoices`, `pollPanelOpen`, `lockedSeanceId`, `closePollPanel`, `onPollCreated`, `mjSlots` removed; `canCompose`, `rendezvousRows`, `modifiablePoll` read `can`, with no `isMjMode()` gate; `destinyDates` is null while composing; the bar names the rendez-vous for a `new` target.
- `confirmCompose`: a `new` target no longer asks for a séance; it re-checks that the séance is still datable (else notice + `cancelCompose`), the dialog opens only when removed options carry answers, and success reads the created poll id from the scenario returned by `createSeancePoll`. The group path reactivates the Destinée on the edited poll.
- `ComposeConfirmDialog`: one face (warning), returns `true | null`; `PollCreationComponent` deleted with its specs and 12 `pollui.creation_*` keys, `success.poll_created`, `calendar.view_locked_seance_hint`, `calendar.compose_confirm_seance_*`, `calendar.view_compose_blocked_no_seance`; new key `calendar.compose_link_stale` (the Forêt voice reads « Ce moment n’est plus à dater. » because « rendez-vous » trips the tutoiement lint on « -vous »). `common.lancer_le_vote` stays (seance-list button). « Lancer le vote » now goes through `atelierUrl` / `navigateByUrl`.
- Specs: the `?seanceId` block was rewritten (new vote, edit, route-mode independence, six stale cases, vitrine ignored, suspension and cancel, create validation, dated-meanwhile); the 36.10 / 36.12 / 40.5b tests were adapted (`startCompose('seanceX')`, no dialog on create, dialog result `true`); `withOrganizerDefaults` now defaults to organizer rights and tests needing a refusal pass `can` explicitly.
- Verification: web typecheck (app and spec) OK; full web suite OK except the 3 known date-dependent failures (2 rail tests in `calendar-view.spec`, 1 week-view); eslint: no new finding (remaining `calendar-view.ts` ones predate). Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré, desktop): on a real JDR party, `/calendar?seanceId=<unknown>` shows « Ce rendez-vous n’est plus à planifier. », leaves a normal calendar with no composer and no old panel, and the address loses `seanceId`. Not exercised in a browser: arming, suspension and validation (the account has no dateless JDR séance and none was created), phone width, the other two themes. The mocked `ActivatedRoute` of the spec makes the router drop `seanceId` while loading, so « the param stays while armed » is asserted as « nothing removes it » (no `replaceState`).

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | An armed composer could write while the séance was dated elsewhere | medium | `confirmCompose` re-checks the rows before any write and closes with the notice; tested |
| 2 | `?seanceId` read once at init: a route reuse on another party keeps the old pending value | low | same limit as `?poll` (44.7), `armPending` is consumed on first resolution; not fixed |
| 3 | `reactivateDestiny` depends on `/me/open-polls` being refreshed | low | refresh awaited first; if the entry is still missing, `enterDestiny` is used and the board waits for the realtime refresh |
| 4 | Deleting `PollCreationComponent` drops its snack « Vote créé ! » | low | the Destinée now opens on the created poll, which is the visible confirmation required by the story |
| 5 | A rendez-vous of a party the reader does not belong to is armable by link | false | the target is looked up only in the loaded payload of the page's own party; a foreign id finds nothing (tested « autre partie ») |
| 6 | The vitrine arms a composer through `?seanceId` | false | the param is read only when the route has a party `:id`; tested |
| 7 | Rights decided by route mode somewhere | false | `canCompose`, `rendezvousRows`, `modifiablePoll`, `composeTargetFor` read `can` only; tested with a « personal » route |

## Design Notes

Decided without the human: an isolated-evening `?seanceId` falls into the stale notice until 45.5 (the UI cannot produce it); after a validation the Destinée always lands on the written poll, even if another was active; the dated-meanwhile check is made at validation (EXPERIENCE §5.5); `PollCreationComponent` is deleted rather than orphaned.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.spec.json` -- expected: no new error (TS6059 excepted)

**Manual checks (if no CLI):**
- GM: scenario sheet → « Lancer le vote » → composer armed; validate with a Destinée active elsewhere; a stale link; the three themes, desktop and phone.
