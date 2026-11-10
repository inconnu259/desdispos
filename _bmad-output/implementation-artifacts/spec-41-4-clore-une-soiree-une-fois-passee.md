---
title: '41.4 — Close an evening once it is past'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'cea728152ef1416d194ff8f32fadf6b35c9bcc28'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-41-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-41-3-inviter-a-une-soiree-accepter-ou-decliner.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An isolated evening whose date has passed still reads "À venir": the unique status function ignores its date range (AD-18), the list keeps it among upcoming parties, and nothing stops inviting, voting, editing or removing guests after the fact (FR2).

**Approach:** The single status projection of `PartiesService` marks an isolated evening `TERMINEE` once `closedAt` is set or its date range is past (undated stays `A_VENIR`). A finished evening is frozen server-side: no invitation, vote, edit or guest removal. The web shows it finished (banner, badge, "J'y étais"), hides the host's tools, and lets the host close and reopen it.

## Boundaries & Constraints

**Always:** Server, one rule in one place: `EventsService.endedIsolatedPartieIds(partieIds)` (batched, one read) says which isolated evenings have a past range — `endDate ?? startDate` strictly before today (UTC day key, same convention as epic 40; today stays upcoming); `PartiesService` derives status from `closedAt` or that set, in the list (one extra batched read for the isolated ones only, never per party) and for every single-party DTO. Groups and JDR statuses unchanged. Freeze = status `TERMINEE` (past or closed), refused in French (400, tested) for an isolated evening on: invitations by pseudo, by e-mail and link creation (`InvitationsService`, `InviteLinksService`), accepting an invitation or joining by link, guest removal (`PartiesService.leave`, `REMOVED`), the host's edit (`GroupEventsService.update`) and a vote on a closed evening (`assertCanVote`; a past evening is already refused as dated). Reopening a closed evening (`reopen`) unfreezes it unless the date is past. No new route, cell or migration. Web: on a finished evening the first tab shows the finished banner (new key `partie.ralliement_soiree_status_closed_label`, no word of JDR, instead of the group's "dissous" text), the invitation tools, "Retirer" and "Modifier" disappear, the inline detail shows the situation chip « J'y étais » for members (and « Je participe » before), the badge says « Passé » (existing) or « Terminée » when closed, the host's bar gets « Clore » / « Rouvrir » (no « Brûler », cancel is epic 42). The home list already hides finished parties with `dashboard.hide_finished_label`; closing emits the existing signals so tile and page refresh without reload. French comments and messages; nothing installed; Docker only.

**Never:** No cancellation (epic 42), no new status code, no change to groups' status or to JDR, no per-minute job (status is derived at read time), no change to who may leave, no new pending-invitation UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Past date | isolated evening dated yesterday | status `TERMINEE` in list and detail | — |
| Today | dated today | `A_VENIR` | — |
| No date | undated, not closed | `A_VENIR` | — |
| Closed early | host closes an upcoming evening | `TERMINEE`, frozen, signals emitted | — |
| Reopen | host reopens a closed, not past evening | `A_VENIR`, unfrozen | past date stays finished |
| Frozen writes | invite / link / accept / join / remove guest / edit on a finished evening | refused | 400 / 409 French |
| Vote closed | member votes on a closed undated evening | refused | 400 |
| Hide finished | checkbox on | finished evening hidden from the list | — |
| Group / JDR | any other party | status and writes unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts` -- `toPartieDto` :183 and every caller (`create` :276/:300, `listForUser` :399–442, `findOneDto` :455, `update`/`close`/`reopen` and the others at :836–1211), `hasScenario` / `hasScenarioByPartieId` :319–348 (become progress readers returning `{ started, ended }`), `leave` :519 (refuse `REMOVED` on a finished isolated evening), `close`/`reopen` :1001–1040.
- `apps/api/src/events/events.service.ts` -- new `endedIsolatedPartieIds`; `assertCanVote` :1383 (closed evening).
- `apps/api/src/events/group-events.service.ts` -- `update` (isolated frozen).
- `apps/api/src/invitations/{invitations.service.ts,invite-links.service.ts}` -- freeze guards (`invite`, `inviteByEmail`, link create, `accept`, join).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.{ts,html}` -- banner (`p.status === 'TERMINEE'` :8), tools and "Retirer" gating, icon bar close/reopen for the evening host :559.
- `apps/web/src/app/features/events/{soiree-tab,event-dialog}` -- `frozen` input (no "Modifier"), situation chip in the inline head (`eventSituation`, `membersParticipate`).
- Tones (3 themes) + `theme-tone.service.spec.ts`: banner key.
- Tests: `parties.service.spec.ts`, `events.service.spec.ts`, `invitations.service.spec.ts`, `invite-links.service.spec.ts`, `group-events.service.spec.ts`, `ralliement.e2e-spec.ts`, `partie-detail.spec.ts`, `event-dialog.spec.ts`, `soiree-tab.spec.ts`.
- Do NOT touch: `PermissionService` cells, group status rule `isRalliementGroup`.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api` parties/events/invitations -- status projection with the ended set, freeze guards, closed-evening vote refusal (+ unit specs)
- [ ] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- statuses (past, today, undated, closed, reopened), frozen writes, list batching unchanged
- [ ] `apps/web` partie-detail + soiree-tab + event-dialog + tones -- finished banner, frozen tools, chip, close / reopen (+ specs)

**Acceptance Criteria:**
- Given an isolated evening whose date is past or that was closed, then its status is « Terminée » everywhere and the home checkbox hides it; undated or dated today it stays « À venir ».
- Given a finished evening, when anyone invites, votes, edits or removes a guest, then the server refuses in French.
- Given a group or a JDR party, then statuses and writes are unchanged.

## Implementation Notes

- Implemented directly in the session (no implementation subagent); the review ran inline (no reviewer subagents).
- Server: `PartiesService` derives status from a `PartieProgress` (`'none' | 'started' | 'ended'`) instead of the former `hasScenario` boolean (`progressOf` for one party, `progressByPartieId` for a batch, which adds ONE grouped read only for the isolated evenings of the list). `EventsService.endedIsolatedPartieIds` answers "range past" for a batch and `assertIsolatedOpen` is the single freeze guard (`EVENING_FINISHED_MESSAGE`, 400), called from `invite`, `inviteByEmail`, `accept`, link creation and `consumeLink` (join and registration), `leave(REMOVED)`, `GroupEventsService.update` and `assertCanVote`. No route, cell or migration.
- Web: `PartieDetail` derives `isSoireeFinished` from the server `status`, shows the soirée's own banner, hides the host's invitation tools and "Retirer", passes `frozen` to `SoireeTab` / `EventDialog` (no "Modifier"), and gives the evening host « Clore » / « Rouvrir » (no « Brûler »). The inline detail shows the situation chip (« Je participe » / « J'y étais »). `eventSituation` gained `membersParticipate`.
- ⚠️ Intended expectation changes: two `partie-detail.spec.ts` tests that said the isolated evening's bar has no button now expect « Clore ».
- Behavior to know: the status flips at read time (UTC day boundary); a list already on screen shows « Terminée » at its next refresh, immediately after a close or reopen (existing signals).
- Results: API typecheck, unit tests (only the known date failure), full e2e (323); web suite (only the 2 known date failures), `ng build` compiles.
- Not done: the visual check in Chrome (past evening on the list, checkbox, close / reopen) is left to the user.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | inline | A list already open does not flip to « Terminée » at midnight without a refresh | low | Status is derived at read time (spec: no per-minute job); close and reopen refresh through the existing signals | reject |
| 2 | inline | `consumeLink` reads the party outside the join transaction for the freeze check | low | Only a read guard; a concurrent close at that instant yields at worst one last join, same window as the lock-free reads elsewhere | reject |
| 3 | inline | `close` closes an evening with pending invitations, which then cannot be accepted | low | Intended: finished means frozen; declining stays possible | reject |
| 4 | inline | The host's bar uses the quest's close label (« Clore le grimoire ») | low | Same keys as groups today; theme vocabulary review belongs to the labels story | reject |

## Design Notes

The status rule lives in one place per layer: `EventsService.endedIsolatedPartieIds` answers "is the range past" for a batch, `PartiesService` is the only deriver of `PartieStatus`, and the freeze reads that status instead of re-deciding it.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green apart from the known date failure
- `docker compose exec web pnpm exec ng test --no-watch` -- green apart from the 2 known date failures; `ng build` compiles
- `graphify update .`

**Manual checks (if no CLI):**
- Chrome MCP: an evening dated in the past shows « Terminée » on the home list and page; the checkbox hides it; close then reopen an upcoming one.
