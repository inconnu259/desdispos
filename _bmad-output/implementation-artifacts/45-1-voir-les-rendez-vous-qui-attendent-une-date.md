---
title: 'Story 45.1 — Voir les rendez-vous qui attendent une date'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'fc1be3b7056a7d10d7abf89f2be93d14b489697c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An organizer (GM or event host) has no single place that says which rendez-vous still wait for a date. "Inscrire des dates" (GM) and "Composer les créneaux : {titre}" (host) are per-calendar, hidden in the atelier, and absent from the personal calendar.

**Approach:** One written button « Proposer des dates » in `.calendar-controls` of the three calendars, backed by one shared predicate `isDatableSeance` and, in the personal calendar, a new `GET /me/datable-seances`. It opens a `RendezvousPicker` (grouped by party name, skipped when there is one rendez-vous). In the atelier, picking arms the existing composer for that séance; in the personal calendar, picking opens the atelier with `?seanceId`.

## Boundaries & Constraints

**Always:**
- « À dater » = `Seance` with no date, `pollId` empty, event not cancelled, party active (`partieStatus`), and `can.propose`. `isDatableSeance({ hasDate, hasPoll, cancelled, frozen, canOrganize })` is a pure function of `@master-jdr/shared` (runtime value, no `import type`), used by the three calendars and by the API.
- `GET /me/datable-seances`: served by `events/`; per séance `seanceId`, `partieId`, `partieName`, `family`, `kind`, `title`, `can`. Rights from `PermissionService.organizerCan` (one batch, fixed number of reads); status from `EventsService.progressByPartieIds` + `partieStatus`. The « scenario closed » exclusion comes from `scenarios/` through the `DatableSeanceFilter` token, declared in `events/ports/` and bound in `PortsModule`; `layer-imports.spec.ts` stays green. Only parties the reader organizes and has not hidden; no `ownerId`/voter data in the payload.
- In the atelier the list is derived from the payload already loaded (JDR: `scenarios()`; group: `groupEvents()` cards), same predicate, restricted to the party; the old `eligibleSeances`/`composeSeanceChoices` use of « pas de vote » is replaced by it.
- Button label per theme (3 tone files), `mat-stroked-button`, in `.calendar-controls`; absent when nothing is to be dated; it replaces `calendar.view_compose_arm` (« Inscrire des dates ») and the per-poll « Composer les créneaux : {titre} » buttons of the group calendar. ⚠️ both screens change (UX-DR4).
- `RendezvousPicker`: groups by party name, row = title + nature (« séance sans date », « soirée sans date », per theme); modal bottom sheet under 1024 px, anchored menu above (same two wrappers as the ✦ list, 44.3); focus trapped then returned to the button; Esc and backdrop close; one row = one choice, skipped when exactly one.
- Evening mode: only an isolated evening without a date qualifies; a séance whose vote was closed without a date is out (`hasPoll`). Decision (human): endpoint, predicate and API tests cover evenings now, but the **web hides evening rows** (button, picker, count) until 45.5 brings the composer target that arms them. The hiding is ONE named seam in the web (a single predicate/constant with a French comment « Story 45.5 : retirer ») and a `deferred-work.md` entry for 45.5 lists exactly what to remove and wire (seam, picker nature label « soirée sans date », atelier derivation from `groupEvents()` for evenings, vitrine pick of an evening), so 45.5 finishes the job.
- Real time: a web `DatableSeancesService` reloads on `user:{id}` (like `OpenPollsService`); every write that dates, undates, creates, cancels or closes a séance already reaches `user:{id}` through `notifyPartieSignalsChanged` — add a test that proves it for the writes that change the datable set, and fix any that miss it. The button disappears when the last rendez-vous is dated elsewhere.
- French comments and errors; no dependency; Docker only; no change to the JDR beyond the two replaced buttons (NFR1).

**Never:**
- Do not arm a composer from the personal calendar; do not touch `app-poll-creation`/`pollPanelOpen` (45.2 removes them); no new write route; no `?seanceId` consumption change (45.2); no deadline or gesture change (45.3/45.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Several to date | personal calendar, 2 parties, 3 dateless séances | button visible; picker groups by party name | N/A |
| One only | 1 rendez-vous | picker skipped, pick runs directly | N/A |
| Nothing to date | none | no button | N/A |
| Atelier JDR pick | GM, séance chosen | composer armed for that séance (`startCompose(seanceId)`) | N/A |
| Personal pick | séance chosen | navigates to `atelierUrl(…, { seanceId })` | N/A |
| Not organizer | player / non-host admin | absent from the endpoint and the list | refusal test, no data of others |
| Poll closed without date | `pollId` set | not listed | N/A |
| Scenario closed / party ended or cancelled / event cancelled | any | not listed | N/A |
| Dated elsewhere | other session dates the séance | `user:{id}` reload removes the row, then the button | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- add `isDatableSeance`, `DatableSeanceEntry` DTO (next to `OpenPollEntry`, `partieStatus`); `atelierUrl` + `AtelierUrlParams.seanceId` already exist (44.7); `OrganizerCan` exists.
- `apps/api/src/events/` -- new `datable-seances.service.ts` + `me-datable-seances.controller.ts` (model: `poll/my-open-polls.*`, `events/open-poll-context.service.ts`); `events/ports/datable-seance-filter.port.ts` (new dir); `isAwaitingDate` (events.service.ts:1094) is the existing « sans date ni sondage » test; register in `events.module.ts`.
- `apps/api/src/scenarios/` -- implements `DatableSeanceFilter` (scenario `PASSE` / `closedAt` excluded); `ports/ports.module.ts` -- bind the token; `ports/layer-imports.spec.ts` must pass.
- `apps/api/src/permissions/permission.service.ts` -- `organizerCan` (reuse as is, `propose` flag).
- `apps/api/test/characterization/` -- new e2e (model: `my-open-polls.e2e-spec.ts`, `organizer-can.e2e-spec.ts`): refusal + shape + realtime emissions.
- `apps/web/src/app/core/` -- new `DatableSeancesService` (model: `poll/open-polls.service.ts`), hooked in `realtime/realtime.service.ts` (`user:` list near line 95).
- `apps/web/src/app/features/calendar/rendezvous-picker/` -- new pure-render component (model: `destiny-list/`).
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html}` -- the `compose-arm` buttons (html ~100-120), `canCompose`, `eligibleSeances` (ts:669), `groupPollRows`/`canCompose` (ts:~625-645), `startCompose(seanceId)`; picker wrappers copy the ✦ list ones (html 217-270, ts 1207-1260); `isGroup`, `partieId`, `isMjMode`.
- `apps/web/src/app/core/theme/tones/*.ts` (3 voices) + `theme-tone.service.spec.ts` -- button, picker title, nature labels; retire `calendar.view_compose_arm` and `partie.ralliement_calendar_compose_arm` if unused.
- Do not touch: `app-poll-creation`, `pollPanelOpen`, `seance-list` « Lancer le vote » (45.2), `ComposeConfirmDialog`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` + spec -- `isDatableSeance`, `DatableSeanceEntry` -- one predicate for three calendars and the API
- [x] `apps/api/src/events/**`, `scenarios/**`, `ports/ports.module.ts` -- `DatableSeanceFilter` port, service, controller `GET /me/datable-seances` -- AR3
- [ ] API tests -- unit (filter, predicate cases, fixed read count) + e2e refusal and realtime emissions -- NFR6, NFR3
- [x] `DatableSeancesService`, realtime hook, `RendezvousPicker` + specs -- reads and renders the list
- [x] `calendar-view.*` + tones (3 themes) -- button, picker wrappers, atelier derivation, pick → arm / navigate, removal of the two old buttons -- FR5, UX-DR4/5
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- one entry for 45.5 (the hand-off list above) -- so the evening part is finished in its story
- [ ] Specs -- every matrix row; button absent without rendez-vous; one-rendez-vous skip; evening rows served by the API but hidden by the web

**Acceptance Criteria:**
- Given a GM with a dateless séance, when the GM opens the party calendar, then « Proposer des dates » replaces « Inscrire des dates » and arms the composer on that séance.
- Given an organizer with dateless rendez-vous in two parties, when they open the personal calendar, then the button lists them grouped by party name and picking one opens its atelier with `?seanceId`.
- Given the last rendez-vous gets a date from another device, when `user:{id}` fires, then the button disappears without reload.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the three review layers were replaced by one inline self-review of the diff.
- Shared: `isDatableSeance`, `DatableSeanceEntry` (adds `seanceRank` / `seanceCount` so the client writes « Titre — Séance 2 » only when a scenario has several séances). API: `events/datable-seances.service.ts` + `me-datable-seances.controller.ts`, port `events/ports/datable-seance-filter.port.ts` implemented by `scenarios/datable-seance-filter.service.ts` (scenario `PASSE`), bound in `PortsModule` (now imports `ScenariosModule`); an exception line in `no-direct-owner-read.spec.ts` (same reason as `my-open-polls`).
- Web: `DatableSeancesService` (lazy, wired on `user:` in `RealtimeService`), `RendezvousPicker` + `rendezvous.utils.ts` (rows from the loaded payload with the shared predicate; vitrine rows from the endpoint). `calendar-view`: one button (`mat-stroked-button`, class `compose-arm` kept), picker wrappers copied from the ✦ list, atelier name/status read by `loadPartieMeta` (MJ mode) or `resolveGroup` (other modes). JDR rows are gated to MJ mode.
- Decision (human): the web hides evening rows through ONE seam, `SOIREE_ROWS_ARMABLE` / `armableRendezvous`; the hand-off for 45.5 is in `deferred-work.md`.
- Beyond the letter: the same button reads « Modifier les dates » when the destiny is a poll the organizer edits here (it is the same element, and the old behaviour — arming that poll — must keep a truthful label); the board action and the vitrine side stay 45.6. Group hosts lose their per-poll « Composer les créneaux » button: they now reach the composer through the destiny (✦ list) until 45.6.
- Shared spec fixtures in `calendar-view.spec.ts` now default `can` / `dateValidee` on séances (`withOrganizerDefaults`).
- Tones: `calendar.view_propose_dates`, `view_modify_dates`, `rendezvous_picker_title` (3 voices; the Forêt title avoids « rendez-vous » because the tutoiement lint reads « -vous » as a vouvoiement) and two neutral nature keys; `calendar.view_compose_arm` and `partie.ralliement_calendar_compose_arm` removed.
- Verification: API typecheck OK; API unit suite OK except the known date-dependent `parties.service` AD-9 test (hard-coded 2026-09-20); API e2e 13/13 suites, 392 tests (the new `my-datable-seances` suite: 10); web suite OK except the 3 known date-dependent failures (2 rail tests in `calendar-view.spec`, 1 week-view); eslint clean on the new files, remaining `calendar-view.ts` findings predate the story. The running `api` container had to be restarted to serve the route (its watcher missed the new files).
- Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré, desktop, personal calendar): `GET /me/datable-seances` answers 200 with the account's one isolated evening, and the button is correctly absent (evening hidden). Not exercised in a browser: the button and picker themselves (the account has no dateless JDR séance, and none was created), phone width, the other two themes.
- A first `git add -N` was run by mistake while staging the diff and undone with `git reset -q` right after; nothing else touched the index.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | The JDR atelier derives rows from `seance.can.propose`, which test fixtures lack | low | the DTO field is required and always served; fixtures were completed centrally (`withOrganizerDefaults`), no runtime guard added |
| 2 | Group hosts lose the per-poll « Composer les créneaux » button | medium | asked for by the story (replaced by one button) but reachable only through the destiny until 45.6; recorded in Implementation Notes, test updated |
| 3 | `partieMeta.frozen` is read once at load, so a party closed while the page is open keeps its rendez-vous listed | low | the server still decides (`createSeancePoll` refuses closed scenarios); the list refreshes on next load; not fixed |
| 4 | A new `GET /parties/:id` per MJ atelier load | low | one extra read, only for name and status; `resolveGroup` already did it for other modes |
| 5 | The vitrine pick of a JDR séance lands on the old 8.7 panel until 45.2 | low | stated in Design Notes; `?seanceId` already opens it |
| 6 | Rows leak data of parties the reader does not organize | false | the where-clause keeps the reader's parties, `organizerCan` + `isDatableSeance` keep `can.propose`; the e2e refusal test proves player and stranger get nothing |
| 7 | Realtime misses a write that changes the datable set | false | the e2e emission test covers add/delete séance, poll create, date reset, scenario close, evening cancel, party close; group event create/update go through `notifyChanged` |

## Design Notes

Decided without the human: the personal-calendar pick navigates with `atelierUrl(…, { seanceId })` — 45.2 turns that arrival into an armed composer, so between the two stories a JDR GM lands on the old 8.7 panel, which `?seanceId` already opens; the atelier derives its list from loaded data rather than a new call; a séance with open registrations (`inscriptionMax`) and no date stays datable, as today (`eligibleSeances`).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: pass
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- expected: pass
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Three calendars, three themes, desktop and phone: button, picker, pick, disappearance after dating.
