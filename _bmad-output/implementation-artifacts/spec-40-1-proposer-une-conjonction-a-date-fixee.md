---
title: '40.1 — Propose a conjonction with a fixed date'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'f4bfcdb90967582d9f704643967408d1a987092d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group's Conjonctions tab (39.1) is an empty shell: nobody can propose a meeting, the group never leaves « À venir », and the last-admin warning (39.4) cites a hard-coded « 0 » conjonctions (FR8, UX-DR6/7/9).

**Approach:** Any group member opens « + Nouvelle conjonction », fills the creation window (fixed date only) and `POST /parties/:id/events` creates, in one `EventsService` transaction, the `Event` (`ownerId` = host) and its single dated `Seance`; cards appear live in « À venir » / « Passées ».

## Boundaries & Constraints

**Always:** New actions `EVENT_CREATE`, `EVENT_LIST` in the closed `PermissionAction` union: ralliement policy `ADMIN_AND_MEMBERS`, JDR policy `NOBODY`; denial tests (unit matrix + e2e: JDR party, stranger, member of another group). Server validation (French messages): title non-blank; date `YYYY-MM-DD`; `startSlot` ∈ MORNING|AFTERNOON|EVENING (never FULL_DAY, never empty); `end = start`; `heureRdv` « HH:MM » label stored as a string, never an instant; `lieu` optional ≤ 80, `notePratique` optional ≤ 200 (36.5 rules); a date before today is refused (today accepted; same day-key convention as the existing calendar code); capacity `null` = « Tous les membres », else integer N ≥ 2 (host counts as one), no upper bound, stepper default 4. Only a `CAMPAGNE_EPISODIQUE` ralliement accepts it (one-shot → 403 unavailable). The seance data goes through `EventsService` (create extended with optional seance data, same transaction, partie lock already taken by `assertCanAddEvent`), then `recalculateNextSessionInTx` in the same transaction. After commit: `emit(partieTopic)` and `PartieSignalsPort.notifyChanged(partieId)` (home list: status, next date). Status: a `CAMPAGNE_EPISODIQUE` ralliement with ≥ 1 event is `EN_COURS` (ralliement one-shot unchanged, JDR unchanged). Calendar ports, ralliement branch: participants of a group event = `event.ownerId` + its inscriptions (host sees their own event in their personal calendar; members' unavailability spans include it, without title/identity); JDR branch unchanged. List route `GET /parties/:id/events/list` (the SSE stream already owns `GET /parties/:id/events`), batched reads, explicit projection: id, title, host id + display name, seance (date, slot, lieu, heureRdv, notePratique, capacity). Web in `features/events/`: tab header (title + filled pill « + Nouvelle conjonction » for every member), sections « À venir » / « Passées » (past = seance day before today), empty state kept. Creation window on `DetailSurface`, order: name* → toggle « Date fixée | Sondage de dates » (poll option visible but disabled) → day (native date input) + slot toggle → optional place → optional time (`type="time"`) → optional practical info → participation « Tous les membres | Places limitées » with a −/+ stepper and « places · vous êtes l'hôte (1 place) » → footer « Renoncer » · « Créer la conjonction » (busy guard, server error shown in the window). ⚠️ `DetailSurface` gains a backward-compatible wide variant (`min(900px, 96vw)`, max-height 94vh, internal scroll, full screen on mobile) used by the conjonction window only; other users keep their defaults. EventCard (UX-DR7): title, `StatusBadge` (« À venir » soon; « Dans *n* jours » with existing `imminenceIntensity` — filled when imminent; « Passé » done), bold date « Sam. 10 oct. · soir », « Hôte : *nom* », place (line omitted when empty), « Ma situation » line + chip (host: « Je participe », past host « J'y étais »; others « Pas inscrit·e » dotted); state always written; 1 px status border + 3 px left bar, imminent 2 px + 4 px; grid `minmax(250px,1fr)`, gap 12 px, one column under 520 px; card not clickable yet (40.2). Live update for all members via the `partie:{id}` signal (checklist). `conjonctionCount` = real number of the group's events (all, past included). Labels in the three tones with theme variants (Conjonction / Halte / Réunion), `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No sign-up, unsubscribe, reservation, edit, detail view, card click, poll or e-mail (40.2–40.7); no `Inscription.status` or other migration; no change to JDR routes, behaviour or tests (37.1 unchanged); no new `'partie:'` handler for an unrelated domain; no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member proposes | valid form, all members | 201; card in « À venir » for every member live; group `EN_COURS`; `nextSessionDate` set | — |
| Limited places | N = 8 (no upper bound) | capacity stored 8 | N < 2 → 400 |
| Invalid input | FULL_DAY / no slot / bad or past date / blank title / bad HH:MM | nothing created | 400 French message |
| Refusals | JDR party, stranger, other group's member, ralliement one-shot | nothing created | 403 |
| Past event | seance day < today | card in « Passées », badge « Passé » | — |
| Calendar | non-creator host | event in host's personal calendar; span in members' unavailabilities | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `PermissionAction` :256 (add `EVENT_CREATE`, `EVENT_LIST`), `DaySlot` :725, `SeanceDto` :587; add `CreateEventDto`/`EventCardDto` shared types.
- `apps/api/src/permissions/permission.service.ts` -- `JDR_POLICY` :120, `RALLIEMENT_POLICY` :212, `assert` :381; spec matrix (JDR table from :58, `JDR_NOBODY` ~:248, `RALLIEMENT_VIEW` ~:470-560).
- `apps/api/src/events/events.service.ts` -- `create` :113 / `createInTx` :129 (always creates an empty seance :147 — extend with optional seance data), `assertCanAddEvent` :162, `recalculateNextSessionInTx` :446, `occupiedSpansOf` :506 (uses `partie.ownerId` :545-549 → ralliement uses `event.ownerId`), `ownEventsOf` :571 (`notMine` :620 hides host's own event), `setInfosPratiques` :346 / `setSeanceCapacity` :326 as rule models; `events.module.ts` (imports nothing — add `PermissionsModule`, controller). No controller/DTO yet. Cycle: `PartiesModule` imports `EventsModule` → use `PARTIE_SIGNALS_PORT` (`src/poll/ports/partie-signals.port.ts`, global `src/ports/ports.module.ts`), never `PartiesService`.
- DTO/controller models: `src/scenarios/dto/set-infos-pratiques.dto.ts` (`HEURE_HH_MM`, `NON_BLANK`), `create-scenario.dto.ts`, `scenarios.controller.ts` (guards, `ParseUUIDPipe`, `@CurrentUser`).
- `apps/api/src/realtime/realtime.controller.ts:22` -- SSE `parties/:id/events` (do not touch; reason for `/events/list`).
- `apps/api/src/parties/parties.service.ts` -- `toPartieDto` :181 status :186; `hasScenarioByPartieId` :304, `hasScenario` :318 count only scenario events → count any event for a ralliement `CAMPAGNE_EPISODIQUE`.
- `apps/api/src/permissions/no-direct-owner-read.spec.ts` -- add new files reading `ownerId` to `EXCEPTIONS` only if unavoidable (prefer mapping in `events.service.ts`, already listed).
- Tests: `test/characterization/harness.ts` (`createPartie(owner,'CAMPAGNE_EPISODIQUE',label,'ralliement')`, `addMember`, `isoDay`), `ralliement.e2e-spec.ts` (constants :26-28, realtime spies), `permissions.e2e-spec.ts`, `events.service.spec.ts` (mock style :1-80, ports :653/:749).
- Web `features/parties/partie-detail/partie-detail.{html,ts}` -- tab :41-60 (sections + empty state, no button yet), `conjonctionCount` :243 used :948, SSE :528, `parties.changed()` effect pattern :561-576; spec :4269 (`{conjonctions}` → '0'), 39.1 tests :3655-3880.
- `shared/detail-surface/detail-surface.{ts,scss}` -- `desktopWidth` px only (:54), `portal` needed inside mat-tab; model usage `features/homme-dragon/reserve-picker/reserve-picker.html`.
- `shared/status-badge/status-badge.ts`, `core/status/status-derivation.ts` (`StatusLabelKey` :31, `StatusBadgeState` :46), `core/status/status-badge.model.ts` (`imminenceIntensity`, `imminenceLabel`, `daysBetweenKeys`); card styles model `scenario-timeline.scss` :44-137.
- Inputs: toggles `partie-form.html` :117-133 (`mat-button-toggle-group`, 44 px), slot toggle `constraint-panel.html` :24-33, date input :78, time input `seance-list.html` :264; `SLOT_LABELS` `features/calendar/agenda-badge.utils.ts:55`; date format `partie-detail.ts:686`.
- Tones `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` (conjonction keys ~:363-374), `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` :777-940), `non-jdr-words.fixture.ts`; `fillTone` `core/theme/tone-format.ts`.
- `core/realtime/realtime.service.ts`, `core/parties/parties.service.ts` (`changed`/`notifyChanged` :42-45, http style).
- UX: mockups `creation-conjonction-desktop-groupe.jpg`, `groupe-desktop-B-onglet-conjonctions.jpg`, mobile variants.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- actions + shared DTO types -- closed unions in shared
- [x] `apps/api/src/permissions/permission.service.ts` (+ spec) -- policy cells -- single decider
- [x] `apps/api/src/events/{events.service.ts,events.controller.ts,dto/create-event.dto.ts,events.module.ts}` (+ spec) -- create with seance data, list, ralliement calendar branch, after-commit signals
- [x] `apps/api/src/parties/parties.service.ts` (+ spec) -- group `EN_COURS` with ≥ 1 event
- [x] `apps/api/test/characterization/ralliement.e2e-spec.ts`, `permissions.e2e-spec.ts` -- create/list/refusals/status/calendar/realtime
- [x] `apps/web/src/app/shared/detail-surface/*` (+ spec) -- ⚠️ wide variant, defaults untouched
- [x] `apps/web/src/app/features/events/` (api service, conjonctions tab, event card, creation form + specs) -- UI + live reload
- [x] `partie-detail.{html,ts,spec.ts}` -- mount the tab, real `conjonctionCount`
- [ ] tones ×3 + `theme-tone.service.spec.ts` -- labels with theme variants

**Acceptance Criteria:**
- Given a member creates a conjonction, when it commits, then every member's tab shows the card in « À venir » without reload and the home list shows the group « En cours ».
- Given the last admin steps down, then the red warning cites the real number of conjonctions.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- New `events/group-events.service.ts` (`GroupEventsService`, not in the Code Map): injecting `PARTIE_SIGNALS_PORT` (= `PartiesService`, which depends on `EventsService`) into `EventsService` would create a provider cycle; the controller calls this thin orchestrator (right, one-shot refusal, day rules, signals after commit). `ownerId` mapping stays in `events.service.ts`, so the owner-read guard needs no new exception.
- `EventsService.createHosted` + optional `CreateEventInput.seance`: dated seance and `recalculateNextSessionInTx` in the same transaction; `listCards` = one batched read, sorted by day then slot.
- Calendar ports: "host + inscrits" only for a ralliement `CAMPAGNE_EPISODIQUE` (`isRalliementGroup`); ralliement `ONE_SHOT` and JDR keep the historical rule (review fix).
- Badge: « Dans *n* jours » within 7 days (`near`), filled only at `imminent` (today / tomorrow, « Aujourd'hui » / « Demain »), per `imminenceIntensity`; the mockup's filled « Dans 2 jours » is therefore outlined here.
- Last-admin warning reads the real count at call time (`EventsApiService.list`) because mat-tab destroys the Conjonctions tab body when another tab is shown.
- Forest theme: « Heure des retrouvailles » and « tu es l'hôte » (the forest voice is tutoiement; « rendez-vous » failed its vouvoiement rule).
- Pre-existing date-fixture failures, unchanged: API `parties.service.spec.ts` AD-9 end-to-end (fixture 2026-09-20), web `calendar-view.spec.ts` rail ×2 (fixture 2026-09-01).
- Not verified: live check in Chrome (two members, live card, one column under 520 px) — Claude in Chrome was not connected.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge, verif | Calendar ports' ralliement branch also catches `ONE_SHOT` (isolée) | medium | `familyOf(...) === 'ralliement'` alone in `occupiedSpansOf`/`ownEventsOf`; spec says group events only, AD-15 isolée = members; latent until epic 41 dates an isolée | patch |
| 2 | blind, edge | `conjonctionCount` stale or 0 when the Conjonctions tab is not mounted | medium | mat-tab destroys inactive bodies; step-down is reachable from Missives (`partie-detail.html:453`) and a page opened on another tab never mounts the list | patch |
| 3 | blind, edge | Shared in-flight `list()` can overwrite the just-created card with a pre-commit snapshot | low | `inFlightList` reuse defeats the tab's `reqId` guard; deleting the sharing fixes it | patch |
| 4 | blind, edge | Same-day conjonctions not ordered by slot | low | `listCards`/`splitEvents` compare day keys only; comparator correction | patch |
| 5 | blind, edge | Places input keeps an invalid typed value while `places()` is unchanged | low | `[value]` does not re-render on an unchanged signal; one-line reset | patch |
| 6 | edge | Empty state shown before first load and beside the load error | low | `@if (events().length === 0)` ignores `loaded()`; direct correction | patch |
| 7 | blind, verif | Stale comment in `hasScenarioByPartieId` ("au moins un scénario") | low | false for the new group query; comment edit | patch |
| 8 | verif | Successful creation path (`onCreated`) untested | gap | pre-verified: no test submits through the tab | patch |
| 9 | verif | List-error banner never asserted | gap | pre-verified: failure test checks stale cards only | patch |
| 10 | blind, edge, verif | Client local "today" vs server UTC "today" | low | in France local ≥ UTC so local today is never refused; only west-of-UTC evenings hit it; fix needs a shared day reference | reject |
| 11 | blind, edge | `capacity` above int4 gives 500 | low | real but absurd input; fix adds a guard against the "no upper bound" decision | reject |
| 12 | blind | DTO `NON_BLANK` vs service `cleaned()` on blank optional fields | low | the web client trims to null; only dead branch, no user harm | reject |
| 13 | blind | Closed group (`closedAt`) still accepts conjonctions | maybe-false | no closed-state write guard exists anywhere (JDR scenarios included); would need a product decision on closed parties | defer |
| 14 | blind | `GET …/events/list` allowed on a ralliement `ONE_SHOT` | false | members reading their own isolée's event leaks nothing; spec refuses creation only | reject |
| 15 | blind, edge | Cancel/Escape while create is in flight | low | the conjonction still arrives through the `partie:{id}` signal; negligible | reject |
| 16 | blind | e2e sort test maps null dates to '' | low | no dateless card can exist in 40.1; test-only | reject |
| 17 | blind | No rate limit on `POST /parties/:id/events` | false | global `ThrottlerGuard` (`app.module.ts:62`) | reject |
| 18 | edge | Host who left the group stays busy through `Event.ownerId` | low | leaving hosts' upcoming events are cancelled by story 42.3 | reject |
| 19 | edge | `todayKey` frozen across midnight | low | page open across midnight; reload fixes it | reject |

## Design Notes

Host occupies one place without an `Inscription` row (AD-15: participants = host + CONFIRMED). The poll option is rendered disabled so the toggle layout matches the UX contract before 40.5. The ⚠️ dialog widening listed in 40.2 lands here because the creation mode is the same window; 40.2 reuses it.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds

**Manual checks (if no CLI):**
- Chrome MCP (logged-in test session): two members of a group; one creates a conjonction; card appears for the other live; mobile width < 520 px shows one column.
