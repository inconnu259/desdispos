---
title: '41.1 — Show an isolated evening on a single page'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'cae009a545ac483af4f6f1b79fcb62981ed33101'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-41-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-8-liberer-places-et-votes-de-qui-quitte-le-groupe.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An isolated evening (ralliement `ONE_SHOT`) still opens on the generic "Détails" + "Missives" tabs, so its single event is nowhere to be seen; the group's list-and-dialog layout does not fit a party that has exactly one event (FR2, UX-DR10).

**Approach:** On the party page, a `ONE_SHOT` ralliement gets two tabs: the first, named per theme in the singular, shows the unique event's detail inline (title + badge, situation panel, sheet — no card, no dialog, no participants list); the second is "Invités" (non-host) or "Invitations" (host) and lists the members. Read-only display: the server rules of the isolated policy already exist and are only covered by tests here.

## Boundaries & Constraints

**Always:** Web only (no API route, DTO, migration or e-mail). The inline detail reuses the blocks of `EventDialog` (one source for situation, poll panel, sheet, slots) through a new `inline` input — never a copied template. In `inline` mode: no `DetailSurface`, no "Refermer", no sign-up / unsubscribe / accept / reserve, no participants block, no "Modifier" (the host edit arrives with 41.2), participation line = "Sur invitation · pas de limite"; the footer is omitted while it holds no action. The event card is read through the existing `GET /parties/:id/events/list` (first and only card), kept live with the same `PartiesService.changed()` effect, request counter and last-known-state rule as `ConjonctionsTab`. The "Invités" / "Invitations" tab is chosen from `partie.role` (`admin` = host), lists `members()` and has no invitation tools (they come with 41.3). The header subtitle "Ralliement · *type*" already exists: keep it. The "Détails" tab, the roster rail and the character tab stay absent for a ralliement. Labels come from the three theme registries (no JDR word; a closed-union key check in `theme-tone.service.spec.ts`). Groups, quests and the JDR page are unchanged; 37.1 characterization tests keep their expectations. French comments and messages; nothing installed; everything through Docker.

**Never:** No host edit, sign-up, poll creation, creation dialog, invitation tool, close/cancel action or status change (41.2–41.4, epic 42); no second event or move of the evening (server already refuses, covered by tests); no per-event invitation; no change to `EventCard`, `ConjonctionsTab` behavior or the group page.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Host opens | `ONE_SHOT` ralliement, role `admin`, undated event | tabs [singular name, "Invitations"], first selected; inline detail with badge "À venir", "Date à fixer", host situation, no footer | — |
| Guest opens | role `member` | tabs [singular name, "Invités"]; members listed in the second tab, none in the first | — |
| Dated evening | event with date, place, time, note | sheet shows them; participation "Sur invitation · pas de limite" | — |
| Live update | `changed()` fires | card reread, detail follows without reload | reread failure keeps the last card |
| Load error | list call fails at first load | message `partie.ralliement_event_list_error` | — |
| Group / quest | `CAMPAGNE_EPISODIQUE` ralliement / JDR | tabs and content unchanged | — |
| Server denial | admin posts a 2nd event, appoints an admin, steps down, moves the evening | 403 "indisponible" / refusals as today | covered by e2e |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- tab group :36–496; add the `ONE_SHOT` ralliement branch (first tab, hide "Détails"); the existing ralliement "Missives" tab :420 splits into group vs isolated labels. `partie-detail.ts` :215–242 (`isRalliement`, `isGroup`, `canInviteMembers`): add `isSoiree`; the subtitle :483 is already right.
- `apps/web/src/app/features/events/event-dialog/event-dialog.{ts,html,scss}` -- add `inline` input; wrap header / body / footer in `ng-template`s rendered either in `app-detail-surface` or in an inline `article`; gate participants, roster actions and edit on `!inline()`. Specs: `event-dialog.spec.ts` (470 lines, must stay green).
- `apps/web/src/app/features/events/soiree-tab/` -- NEW tab component (model: `conjonctions-tab.ts` reload effect / `reqId` / `parties.changed()` firstRun guard; no dialog history, no creation).
- `apps/web/src/app/features/events/event-card.util.ts` -- `participationLine`, `eventSituationTextKey`, `eventBadge` reused as is.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` + `theme-tone.service.spec.ts` (:1405 pattern) -- new keys: `partie.ralliement_soiree_tab` (Conjonction / Halte / Réunion), `partie.ralliement_soiree_guests_tab` ("Invités"), `partie.ralliement_soiree_invitations_tab` ("Invitations"), `partie.ralliement_soiree_participation` ("Sur invitation · pas de limite").
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` :3893 -- test "rencontre isolée : Détails … puis Missives, comme avant" changes on purpose ⚠️.
- `apps/api/test/characterization/ralliement.e2e-spec.ts` -- existing refusals for `ONE_SHOT` (roles :1086, leave :1261, second event :1532, edit :1891, sign-up :2228); add: member/stranger read of the evening's event list.
- Do NOT touch: `GroupEventsService`, `PermissionService` policy, `PartiesService`, `ConjonctionsTab`.

## Tasks & Acceptance

**Execution:**
- [x] `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- four keys per theme, no JDR word
- [x] `features/events/event-dialog/*` (+ spec) -- `inline` input and the ng-template layout; inline-mode cases tested
- [x] `features/events/soiree-tab/*` (+ spec) -- load, live reread, inline detail, error state
- [x] `features/parties/partie-detail/partie-detail.{html,ts}` (+ spec) -- isolated tabs (singular name, Invités/Invitations), no "Détails"; update the 3893 test; group/JDR witnesses unchanged
- [x] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- event list of an isolated evening: member reads exactly one card, stranger and non-member refused

**Acceptance Criteria:**
- Given a `ONE_SHOT` ralliement, when a member opens it, then the first tab is the singular theme name with the detail inline and without participants, there is no "Détails" tab, and the second tab is "Invités" or "Invitations" by role.
- Given the evening's event changes, then the page follows without reload.
- Given a group, a quest or an evening seen by a stranger, then nothing changes or access is refused as before.

## Implementation Notes

- Implemented directly in the session (no implementation subagent): web only, plus an e2e block in `ralliement.e2e-spec.ts`. The review ran inline (three lenses, no reviewer subagents).
- New `SoireeTab` (`features/events/soiree-tab/`) reads the party's event list and renders `EventDialog` with `[inline]="true"`; `EventDialog` now builds head / body / foot as `ng-template`s rendered either in `DetailSurface` or in an inline `article`.
- Surprise: the server's event card lists only inscriptions (host for an isolated evening), not the members. So inline mode passes `membersParticipate` to `eventSituationTextKey` (a guest "participe"), and the "Invités" tab lists `members()`; the e2e test pins only what the server does (host among participants, members from the members route).
- ⚠️ Intended expectation changes in existing specs: 38.4 "deux onglets / Détails / thème" cases now use a group fixture (the isolated evening has no "Détails" tab); the 39.1 isolated-evening test expects [singular name, Invitations].
- `eslint --fix` also reformatted untouched lines of some spec files (prettier drift that predated this story); non-spec files it touched without my edits were restored.
- Web suite: only the 2 known date failures (`calendar-view.spec.ts`). API typecheck and `ralliement.e2e-spec.ts` (203) green.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | inline | The evening's `description` (asked at creation) is shown nowhere any more: "Détails" is gone and the event sheet has no description line | medium | Reachable only through the admin's "Modifier" form; UX-DR10 and the 41.1 AC list no place for it | defer (intent question for the user, see deferred-work.md) |
| 2 | inline | Host's second tab is labelled "Invitations" while it only lists members until 41.3 adds the invitation tools | low | Spec decision recorded; 41.3 follows in the same epic | reject |
| 3 | inline | Empty event list renders nothing, no message | low | A `ONE_SHOT` ralliement always holds its event (created in the same transaction); matrix row says nothing is rendered | reject |
| 4 | inline | `eventSituationTextKey` gains a boolean parameter | low | One caller passes it; documented and tested | reject |
| 5 | inline | Today's "Passé" uses the local day while the API uses UTC | low | Same convention as every other event screen of epic 40 | reject |
| 6 | inline | `eslint --fix` reformatted pre-existing lines in specs | low | Formatting only, tests green | reject |

## Design Notes

`EventDialog` gets `<ng-template #head|#body|#foot>` and renders `@if (inline()) { <article class="ed ed--inline">…outlets… } @else { <app-detail-surface>…outlets… }`; `detail-header` / `detail-footer` attributes stay on real elements so projection keeps working. Edit and roster actions are forced off in inline mode for this story; 41.2 re-enables the host edit.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- green (known date failures only); `docker compose exec web pnpm exec tsc -p tsconfig.app.json --noEmit` if the project has no web typecheck script
- `docker compose exec api pnpm typecheck` and `pnpm test:e2e` -- green
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP (session already connected): create an isolated evening in each theme; host sees "Invitations", an added member sees "Invités"; resize to mobile.
