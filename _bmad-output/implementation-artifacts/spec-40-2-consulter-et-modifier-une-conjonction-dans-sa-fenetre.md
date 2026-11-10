---
title: '40.2 — View and edit a conjonction in its window'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'c01dc5f9ca55fda57646e6149d49173516cd465f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The conjonction cards of 40.1 are inert: a member cannot open one to see its sheet and who takes part, the host cannot correct it, and the admin shield postponed from 39.4 is still missing (FR8, UX-DR8/11/19/20).

**Approach:** A card opens the wide `DetailSurface` as an EventDialog (title + badge → situation panel → sheet → participants → footer). The host switches the same window to edit mode through a new `PATCH /parties/:id/events/:eventId`; the card list carries the participants, so the dialog follows live updates.

## Boundaries & Constraints

**Always:** Action `EVENT_UPDATE` in the closed `PermissionAction` union: ralliement `ADMIN_AND_MEMBERS` plus a host-only rule decided INSIDE `PermissionService.assert` on the `{ eventId }` target (event owner = caller, else 403 French « hôte » message; no code outside `permissions/` reads `ownerId` for a right); JDR `NOBODY`. Route party must equal the event's party (else 404, no IDOR). Only a `CAMPAGNE_EPISODIQUE` group accepts it (one-shot → 403, as in 40.1). Edit = full replacement with the 40.1 `CreateEventDto` rules (title, day, slot, lieu, heureRdv label, notePratique, capacity; host immutable); refused (400, French) when the seance day is before today (UTC day key, same convention as 40.1) or when the new date is past; capacity below current participants (host + inscriptions) refused; capacity `null` = « Tous les membres ». The write takes `SELECT … FOR UPDATE` on the `Event` row, resets `reminderSentAt` when day or slot changes, runs `recalculateNextSessionInTx` in the same transaction, then after commit `emit(partie:{id})` (inside `EventsService`) and `PartieSignalsPort.notifyChanged`. `EventCardDto` gains `participants` (host first, then inscriptions by creation): `userId`, `displayName`, `isHost`, `isAdmin` (`Membership.role`) — one batched read, never per event; explicit projection. Place, sheet and participants reach group members only (`EVENT_LIST`). Web, in `features/events/`: card activates by click and Enter (focusable, accessible name = title); dialog title = conjonction name; focus trapped, returned to the card on close; Esc, « Refermer » and the browser back button close it and leave the list intact (filters, scroll). Dialog order: title + badge → situation panel (your situation, then date, time and place in large type; no vote, no sign-up button yet) → sheet (date, host, place, time, participation « 8 places · 5 inscrits · 3 libres » — host counts as an inscrit — or « Tous les membres », practical info; empty optional rows omitted) → participants (26 px avatar disc with initials + name, own chip bordered accent-1) → footer: host sees « Modifier » while not past, then « Refermer ». Edit mode reuses the creation fields in the same window (shared form component, creation behavior unchanged), footer « Renoncer » · « Enregistrer », server refusal shown in the window. ⚠️ Admin avatars carry a 14 px shield at the corner AND the visible word « Admin » (never glyph alone); drawn from the UX proposal, to review with the user. Labels in the three tones (Conjonction / Halte / Réunion), `NEUTRAL_KEYS` and banned-JDR-words rules respected. The dialog reads its card from the tab's live list by id. French comments and messages.

**Never:** No sign-up, unsubscribe, reservation, poll, e-mail or cancellation (40.3–40.7, epic 42); no migration; no change to the 40.1 create route semantics, to JDR routes or to 37.1 tests; no new `'partie:'` handler; no dependency install; no change to `DetailSurface` defaults.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open | member clicks or presses Enter on a card | dialog with sheet + participants; focus in, back to card on close | — |
| Host edits | upcoming event, valid change | 200 + card; list and open dialogs update live; `nextSessionDate` recomputed | — |
| Not host | other member PATCHes | nothing written | 403 |
| Outsiders | stranger, member of another group, JDR party, one-shot, event of group B via group A route | nothing written, nothing read | 403 / 404 |
| Past | event day < today, or new date past | nothing written; no « Modifier » button | 400 French |
| Capacity | N < participants | nothing written | 400 French |
| Back / Esc | dialog open | list restored intact | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `PermissionAction` :331 (`EVENT_UPDATE`), `EventCardDto` :726 (+ `participants`, `EventParticipantDto`), `CreateEventDto` :701 (`UpdateEventDto` = same shape).
- `apps/api/src/permissions/permission.service.ts` (+ spec) -- `JDR_POLICY` :194 / `RALLIEMENT_POLICY` :288 cells; `assert` :391, `resolveTarget` eventId branch :521 (load `ownerId` there for the host rule); matrix specs.
- `apps/api/src/events/events.service.ts` -- `listCards` :246 (add participants: one inscriptions read + one memberships read), `createInTx` :170 (seance field model), `chooseDate` :433 (`reminderSentAt` reset), `setInfosPratiques` :480, `inscrire` :505 (lock pattern); add `updateHosted`.
- `apps/api/src/events/group-events.service.ts` + `events.controller.ts` + `dto/create-event.dto.ts` -- day/past rules (`parseDayKey`, `todayKeyUtc`), `update` + `PATCH :id/events/:eventId`; reuse DTO validation via an `UpdateEventDto`.
- Tests: `events.service.spec.ts`, `group-events.service.spec.ts`, `test/characterization/ralliement.e2e-spec.ts`, `permissions.e2e-spec.ts`, harness `createPartie`/`addMember`.
- Web `features/events/`: `event-card/*` (click/Enter, `open` output), `conjonctions-tab/*` (selected id, focus return, history entry on open + `popstate` close — verify no clash with the Angular router), `event-create/*` (extract shared form), `event-card.util.ts` (situation, participation line, date label), `events-api.service.ts` (`update`); new `event-dialog/`, `participant-chip/`.
- `shared/detail-surface/*` -- wide variant already exists (40.1), reuse; focus restore is the tab's job.
- Tones `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` (keys ~:376-406), `theme-tone.service.spec.ts` (`NEUTRAL_KEYS`), `non-jdr-words.fixture.ts`; admin word key `partie.ralliement_admin_badge`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, mockup `conjonction-v2-desktop-hote-resume.jpg`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- action, participant DTO, `UpdateEventDto` -- closed unions in shared
- [x] `apps/api/src/permissions/permission.service.ts` (+ spec) -- `EVENT_UPDATE` cells and host-only rule -- single decider
- [x] `apps/api/src/events/{events.service.ts,group-events.service.ts,events.controller.ts,dto}` (+ specs) -- participants in cards, locked update, PATCH route
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- edit, denial matrix, IDOR, past, capacity, participants, live signal
- [x] `apps/web/src/app/features/events/` -- clickable card, EventDialog, participant chip with shield, edit mode, tab wiring, api `update` (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- dialog, situation, participation, admin labels

**Acceptance Criteria:**
- Given a member opens a card, when the dialog shows, then the order is badge → situation → sheet → participants → footer and closing restores focus to the card and the list unchanged.
- Given the host edits an upcoming conjonction, when saved, then every member's card and open dialog show the change without reload.
- Given an admin among the participants, then their chip shows the 14 px shield and the word « Admin ».
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Edit is a full replacement (title + the single seance); the host stays immutable. `PATCH` resolves the party from the event, 404 when it differs from the route.
- Host-only rule lives in `PermissionService.assert` (`HOST_ONLY_ACTIONS`); `resolveTarget` returns the event owner for `{ eventId }` targets.
- `updateHosted` locks Partie, then Event, then recalculates `nextSessionDate` in the same transaction; `reminderSentAt` is reset only when day or slot changes.
- Creation fields extracted into `event-form/`, shared by creation and edit mode. Card title is a native button stretched over the card (review patch).
- Dialog history: one `pushState` entry with a marker on open; Esc, « Refermer » and Back close it. Not checked against the real router in a browser.
- Not verified: live check in Chrome (two members, full screen under 520 px, shield drawing). Pre-existing date-fixture failures unchanged: API `parties.service.spec.ts`, web `calendar-view.spec.ts` ×2.
- ⚠️ To review with the user: the admin shield drawing and the situation/sheet texts written by the agent.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | Card is `role="button"`: children presentational (date, badge, situation unread by screen readers); Space opens on keydown, focus moves before keyup | medium | `event-card.html` article with role/tabindex/keydown handlers; spec asks accessible name = title only | patch |
| 2 | edge | `updateHosted` locks Event then Partie, opposite of Partie-first paths (createInTx, future leave cleanup) | low | `events.service.ts` raw lock then `recalculateNextSessionInTx`; no Event-first-then-Partie caller exists yet, trivial reorder | patch |
| 3 | blind | Tautological tone regex `/^[^|]+|[^|]+$/` | low | `theme-tone.service.spec.ts:1429`, alternation matches any non-empty string | patch |
| 4 | verif | `nextSessionDate` after edit not pinned to the edited value | medium | e2e group minimum is isoDay(6) before and after | patch |
| 5 | verif | Capacity count `where` (host excluded) never asserted | low | unit tests mock `count` with fixed numbers | patch |
| 6 | edge | `inscrire` locks Seance, `updateHosted` locks Event: capacity cut vs concurrent sign-up not serialized | medium | real, but ralliement `SEANCE_INSCRIBE` is `NOBODY` until 40.3, which takes the Event lock per epic decision | defer |
| 7 | blind, edge | `FULL_DAY` slot / null date silently rewritten or unsaveable by the edit form | medium | unreachable now (40.1 writes only the 3 slots, no poll); reachable with 40.5 chooseDate | defer |
| 8 | edge | Event deleted between open and PATCH gives « Scénario introuvable » (banned JDR word) | low | historic message of `resolveTarget`; events cannot be deleted until epic 42 | defer |
| 9 | blind, edge | Local-day (web) vs UTC-day (API) for « passée » / « Modifier » | low | same trade-off as 40.1 triage #10 | carried reject |
| 10 | blind, edge | Orphan history entry on tab destroy, double open before async `back()`, Forward onto marker | low | dialog is modal, route changes and a second open within the same tick are unreachable; Forward lands harmlessly | reject |
| 11 | blind | Esc / Back in edit mode discards unsaved edits | low | same behavior as the creation window validated in 40.1; no dirty-state rule in the spec | reject |
| 12 | blind, edge | Stepper floor ignores participant count; prefill read once | low | server refuses with a French message; client check adds a branch for a rare case | reject |
| 13 | blind | Former members stay listed as participants | low | departure cleanup of sign-ups is story 40.8 | reject |
| 14 | edge | Owner without Membership row not flagged admin | low | owner always has a membership row in a group; legacy JDR shape only | reject |
| 15 | edge | `saved.emit` after Esc while PATCH in flight throws (caught) | low | live `partie:{id}` reload refreshes the list anyway | reject |
| 16 | edge | Selected card momentarily absent closes dialog | false | `reload` replaces the list atomically with the server list; card present | reject |
| 17 | blind | No guard when card missing after PATCH commit | low | same pattern as create; event cannot vanish before 42 | reject |
| 18 | blind, verif | `EventForm` `(ngSubmit)` relay never fires (no submit button) | low | same as creation window in 40.1; harmless | reject |
| 19 | blind | Formatting churn, `sprint-status` `last_updated` growth, spec in English, empty log sections | low | repo/workflow conventions | reject |
| 20 | blind, verif | Untested: reminder re-arm path, null owner, focus fallback, empty participants | low | gaps are cosmetic; main paths pinned | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: two members, host edits, other member's open dialog updates; back button and Esc restore the list; width < 520 px full screen.
