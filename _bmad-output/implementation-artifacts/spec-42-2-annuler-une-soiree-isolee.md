---
title: '42.2 — Cancel an isolated evening'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: '0329fa3ab055ebe3ad046f0985e497dae54c1cec'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-42-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-42-1-annuler-une-conjonction-de-groupe.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-41-4-clore-une-soiree-une-fois-passee.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The host of an isolated evening cannot call it off: guests keep waiting, pending invitations and links stay usable, and the evening can only read "finished" (FR16).

**Approach:** The host cancels the evening's single event before its date, by the 42.1 procedure. The evening takes the new status **ANNULEE** (distinct from TERMINEE) in the unique status function, pending invitations and links are revoked in the same transaction, e-mail #7 goes out after commit, members get the `PARTIE_ANNULEE` signal, and the page and list tile show a written "Annulée" state, frozen.

## Boundaries & Constraints

**Always:** `GroupEventsService.cancel` accepts `ONE_SHOT` ralliement (the 42.1 refusal is lifted); right unchanged (`EVENT_CANCEL`: host or admin — the host is the only admin); finished, closed or already cancelled evenings are refused 400 French through `assertIsolatedOpen`, which now also refuses a cancelled evening. `cancelHosted` gains an optional in-transaction hook returning `{ userIds, emails }`; for an evening it is a new dependency-free `InvitationCleanupService` (invitations/, provided by `EventsModule`) that sets PENDING `Invitation` to REVOKED and open `InviteLink` to `revoked`, and returns the invitees' ids/e-mails plus unused `targetEmail` link addresses. After commit: `user:{id}` emitted for those ids; e-mail #7 (existing template) to the evening's members and those pending guests/addresses, never the host, deduplicated by address (`EventsService.cancellationNotice` uses members for `ONE_SHOT`, registrants for a group; `EventCancellationMailer.send` takes the extra addresses). Status: `PartieStatus` gains `ANNULEE`; `PartieProgress` gains `'cancelled'` (one more batched read, `EventsService.cancelledIsolatedPartieIds`, never per party); cancelled wins over closed/past; groups and JDR unchanged. `close`, `reopen` and rename (`PartiesService.update`) are refused on a cancelled evening; every other write is already refused through `assertIsolatedOpen`. `PartySignalCode` gains `PARTIE_ANNULEE`: a cancelled party carries only that signal (like TERMINEE). Web: tile (all three modes) fades, shows a diagonal red stroke and the written state "Annulée", stays clickable, goes to the finished section; list sort knows ANNULEE; the evening page shows a cancelled banner, hides invitation tools / "Retirer" / close-reopen, and the host sees "Annuler la soirée" (confirmation of 42.1, red button) in the inline detail; the inline detail's own "Annulée" state comes from the card. Texts per theme tone files; red text uses `--color-cancelled-text`. Real-time: `notifyChanged` after commit as in 42.1. French comments/errors; nothing installed; Docker only.

**Never:** No filters or hiding of cancelled parties (42.4), no "remove from my list" (42.5), no group changes, no new route, migration or e-mail template, no JDR status.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Host cancels | upcoming or undated evening, guests, pending invites, link | event cancelled, status ANNULEE, invitations/links revoked, mail to members + pending guests, signals | — |
| Not host | guest member, stranger | refused | 403 |
| Past / closed / cancelled | any of them | refused | 400 |
| Frozen | invite, accept, join by link, vote, edit, remove guest, close, reopen, rename | refused | 400 |
| Pending guest | PENDING invitee, unused e-mail link | mailed once, invitation REVOKED, accept refused | — |
| Status | cancelled and also closed | ANNULEE | — |
| List | tile of a cancelled evening | written "Annulée", stroke, clickable, finished section | — |
| Group / JDR | any | unchanged | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `PartieStatus` :354, `PartySignalCode` :503.
- `apps/api/src/events/events.service.ts` -- `cancelHosted`, `cancellationNotice`, `assertIsolatedOpen`, `endedIsolatedPartieIds`; add `cancelledIsolatedPartieIds`.
- `apps/api/src/events/{group-events.service.ts,event-cancellation-mailer.service.ts,events.module.ts}`; new `apps/api/src/invitations/invitation-cleanup.service.ts` (models `Invitation` status, `InviteLink.revoked`/`targetEmail`).
- `apps/api/src/parties/parties.service.ts` -- `PartieProgress` :186, `toPartieDto`, `progressByPartieId`, `progressOf`, `close`, `reopen`, `update`; `parties/party-signals.service.ts` :180 (TERMINEE branch pattern).
- Web: `core/parties/{party-sort,party-signal-priority}.ts`, `features/dashboard/{dashboard.ts,dashboard.html,dashboard.scss}` (tint, TERMINEE branches), `features/parties/partie-detail/{partie-detail.ts,partie-detail.html}` (`isSoireeFinished`, banner :8), `features/events/{soiree-tab,event-dialog}` (`canCancel` is `!inline()` today), tone files + `theme-tone.service.spec.ts`.
- Tests: `events.service.spec.ts`, `group-events.service.spec.ts`, mailer spec, new cleanup spec, `parties.service.spec.ts`, `party-signals.service.spec.ts`, `ralliement.e2e-spec.ts`, dashboard / partie-detail / soiree-tab / event-dialog specs, sort spec.
- Do NOT touch: group cancel behaviour, `leave()`, 42.1 permission cells.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared` + `apps/api` events/invitations -- statuses and signal code, hook, cleanup service, notice for members, `cancelledIsolatedPartieIds`, `assertIsolatedOpen` (+ specs)
- [x] `apps/api` parties + group-events -- status ANNULEE, close/reopen/update guards, signal, cancel for the evening, mails and emissions (+ specs)
- [x] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- host cancels, refusals, frozen actions, status, signal, invitations, mails
- [x] `apps/web` -- tile states, sort, evening page banner and tools, cancel button in the inline detail, tones (+ specs, ng build)

**Acceptance Criteria:**
- Given an upcoming isolated evening, when its host confirms, then its single event is cancelled by the 42.1 procedure, its status is ANNULEE, pending invitations and links are revoked and members plus pending guests get e-mail #7.
- Given a cancelled evening, then no further action is accepted (server-refused), members see `PARTIE_ANNULEE`, and the tile and page show "Annulée" without reload.
- Given a group or a JDR party, then statuses and behaviour are unchanged.

## Implementation Notes

- Implemented directly in the session (no implementation or review subagents: this run only allows them on an explicit user request).
- Server: `PartieStatus` + `ANNULEE`, `PartySignalCode` + `PARTIE_ANNULEE`; `EventsService.cancelledIsolatedPartieIds` (one batched read), `assertIsolatedOpen` refuses a cancelled evening (`EVENING_CANCELLED_MESSAGE`); `cancelHosted` takes an `afterCancel` hook and returns `{ userIds, emails }` (emits `user:{id}` for revoked invitees after commit); `InvitationCleanupService` (invitations/, no dependency, provided by `EventsModule`) revokes PENDING invitations and open links and returns who to mail, read before revoking. `GroupEventsService.cancel` now accepts `ONE_SHOT` (refused 400 when finished, closed or already cancelled); `cancellationNotice` lists the members of an evening; `EventCancellationMailer.send` takes the extra addresses (first spelling kept, deduplicated). `PartiesService`: progress `'cancelled'` wins over closed/past; `close`, `reopen`, `update` refused on a cancelled evening. `PartySignalsService` reads cancelled evenings with one grouped query (membership-based: the direct-owner-read guard forbids `ownerId` there) and, only when some exist, `listForUser`.
- Web: dashboard tile and compact row (fade, diagonal stroke, written « Annulée » with pictogram, clickable, filed with the finished ones), sort and signal priority know ANNULEE; evening page banner « annulée », « Modifier »/« Clore »/« Rouvrir » hidden, inline detail offers the cancel button (42.1 confirmation) to the host of an open evening; two neutral tone keys.
- Decision: the evening's button reuses the theme's event wording (« Annuler la conjonction » / halte / réunion) rather than a new « Annuler la soirée » key: the first tab is already named after that word in the singular.
- Results: API typecheck clean; unit tests green apart from the known date failure (`parties.service.spec` AD-9); full e2e 346 green (6 new); web suite green apart from the 2 known date failures; `ng build` compiles.
- Not done: visual check in Chrome (tile in the three modes and themes, evening page, invitee list) and Mailpit; `/security-review` and `/code-review` to run. Filters and hiding of cancelled parties are 42.4.

## Spec Change Log

## Review Triage Log

Inline review (no reviewer subagents in this run).

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | The dashboard status filter and the « hide finished » checkbox do not know ANNULEE | low | Explicitly 42.4 (« Never » list); the tile is filed with the finished section and stays visible | reject |
| 2 | blind | The evening's cancel button says « Annuler la conjonction », not « Annuler la soirée » | low | Same word as the first tab of the evening in each theme; a dedicated key adds a duplicate label | reject |
| 3 | edge | A pending invitation accepted at the same instant as the cancel could create a membership | false | Accept goes through `assertIsolatedOpen` (event cancelled) and the invitation is REVOKED under the Partie/Event locks taken by the cancel transaction | reject |
| 4 | edge | Signals now run one more grouped read, and `listForUser` again when a cancelled evening exists | low | One query per call, `listForUser` only when needed; unit test pins the batch | reject |
| 5 | edge | Open links without an address notify nobody | false | By design: a shareable link has no recipient; it is revoked | reject |
| 6 | gap | A closed evening cannot be cancelled | false | Spec: finished or closed evenings are refused 400; reopen first | reject |

## Design Notes

`InvitationCleanupService` is dependency-free and provided by `EventsModule`, like `PollVoteCleanupService`: `InvitationsModule` imports `EventsModule`, so the reverse import would cycle. Pending recipients must be read inside the transaction because revoking removes the PENDING state the notice would read.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green apart from the known date failure
- `docker compose exec web pnpm exec ng test --no-watch` -- green apart from the 2 known date failures; `ng build` compiles
- `graphify update .`

**Manual checks (if no CLI):**
- Chrome MCP: cancel an evening as host; tile, page and invitee list in the three themes.
