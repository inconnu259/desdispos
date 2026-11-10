---
title: '40.6 — Set the date of a conjonction'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'c1e8e7d663cbcf7b4b0d67335a8f312b9d6d409a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-5-proposer-une-conjonction-par-sondage-de-dates.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group poll (40.5, 40.5b) can collect votes but never end: the host cannot choose the winning slot, so the conjonction stays « Date à voter » forever and nobody is told when it is settled (FR11, FR12, UX-DR12).

**Approach:** From the host panel, « Fixer la date… » opens a confirmation listing the candidate slots best-first with their counts; confirming seals the date under the `Event` lock (seance range written, poll closed, `nextSessionDate` recomputed), then e-mail #4 goes to the inscrits. The panel becomes date, time and place.

## Boundaries & Constraints

**Always:** Reuse the shared route `PATCH parties/:id/poll/:pollId/choose` (body `optionId`) with a group branch (the poll's family decides; JDR path, `POLL_CHOOSE`, DTO and tests unchanged); `PollService` stays the only writer of `SessionPoll`, `events/` the only writer of the seance range and `nextSessionDate` (reach `events/` through a port bound in `PortsModule`, like `GROUP_POLL_VOTE_PORT`). `POLL_CHOOSE` opens to group members in the ralliement policy and the host-only rule is decided in `PermissionService.assert` (a non-host member or admin gets 403, tested); `CAMPAGNE_EPISODIQUE` group only (one-shot → 403). One transaction under `SELECT … FOR UPDATE` on the `Event` row (Partie lock first, as in 40.2): re-check the poll is `OPEN`, belongs to the conjonction and that `optionId` is one of its options (else 400/404, French); write `startDate`/`endDate`/slots from the option (`start = end`, never `FULL_DAY`), reset `reminderSentAt`, close the poll (`CLOSED`, chosen date and slot), recompute `nextSessionDate` with the single `EventsService` function. A date already set, or a poll no longer open, is refused (400): the date never reopens, no « unset » route is added. Deadline passed does not block the host from fixing. After commit: `emit(partie:{id})`, `PartieSignalsPort.notifyChanged`, then e-mail #4 (new template in the closed `EmailTemplate` union, common layout, neutral vocabulary, through `EmailService`, failures logged never thrown): subject « C'est fixé : « *Conjonction* », *date* », body date · lieu, button « Voir la rencontre » to the group page; recipients = the `CONFIRMED` inscrits, host excluded, one e-mail each (decision: « les inscrits »); none if there is none. Once dated: votes and withdrawals refused (poll closed), sign-ups and reservations keep working (late sign-ups allowed, date unchanged), the day-before reminder (37.9/40.3), calendar ports and personal calendars treat it as a dated conjonction; the 40.2 edit keeps title, lieu, heure, infos and capacity but can no longer change the day or slot (the date never reopens; refused 400 if sent). The event card drops its poll block once dated and shows the normal date line and badges. Web, in `features/events/`: the host panel button « Fixer la date… » (enabled only while the poll is open and has at least one slot) opens the confirmation « Votre accord » (« Renoncer » · « Fixer la date »): radio list of the slots sorted best first (yes desc, maybe desc, no asc, then date), each « *n* oui · *n* peut-être · *n* non », best preselected, text « La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles. »; busy-guarded, server refusal shown; on success the dialog follows the live card (panel replaced by date, time and place in large type, as for any dated conjonction). Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No migration; no « Prolonger le vote », no vote reminder, no mail #6 (40.7); no reopening or editing of a fixed date; no change to JDR choose/close/vote behavior, DTOs or tests (37.1 unchanged); no new `'partie:'` handler; no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fix the date | host, open poll, valid option | seance dated, poll closed, `nextSessionDate` updated, live for all, mail #4 to confirmed inscrits after commit | — |
| Confirmation | host opens « Fixer la date… » | slots best-first with counts, best preselected, sealing text | « Renoncer » changes nothing |
| Not host | other member, admin non-host, stranger, other group, one-shot, JDR route semantics | nothing written | 403 / 404 |
| Bad target | option of another poll, unknown option, poll already closed or date already set | nothing written | 400/404 French |
| Race | two fixes or fix vs vote at once | one wins under the lock, the other refused | 400 |
| After fixing | vote, withdraw | refused; sign-up and reservation still accepted | 400 for votes |
| Edit | host edits a fixed conjonction | day/slot refused, other fields accepted | 400 French |
| Mail | send failure | logged, transaction untouched | — |
| JDR | any JDR poll | unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/poll/{poll.service.ts,poll.controller.ts,ports/}` -- `choose` :~330 (JDR path: `POLL_CHOOSE`, transaction, `SeanceDatePort.chooseDate` :356), `castVote` group branch + `GROUP_POLL_VOTE_PORT` (model for the new port), `ports/ports.module.ts` (`src/ports/ports.module.ts` bindings).
- `apps/api/src/events/events.service.ts` -- `chooseDate` :944 (writes the range, resets `reminderSentAt`, recalculates), `assertCanVote` :1309, `updateHosted` (poll-mode detection and mode lock from 40.5: add the « fixed date: no day/slot change » rule), `listCards`/`pollsOf` :603 (poll block must be null once dated/closed), `recalculateNextSessionInTx`, `reminderRecipients`, roster reads (CONFIRMED inscrits) for the mail.
- `apps/api/src/events/{group-events.service.ts,events.controller.ts}` -- orchestration after commit (signals, mail), model: `sendReservationEmails` (40.4) and `inscrire` (40.3).
- `apps/api/src/permissions/permission.service.ts` (+ spec) -- `POLL_CHOOSE` cell for ralliement, `HOST_ONLY_ACTIONS` (needs the event of a poll target: resolve through the poll's seance, or have the caller assert on `{ eventId }`).
- `apps/api/src/email/{email-template.enum.ts,email.service.ts,templates/}` -- template #4 (models: `conjonction-reservation.hbs`, `conjonction-reminder.hbs`); `src/events/session-date.ts` for the date text.
- Tests: poll/events/group-events/permission/email specs, `test/characterization/{ralliement,permissions}.e2e-spec.ts` (matrix, race under the lock, mail, live), 37.1 untouched.
- Web `features/events/`: `event-dialog/*` (host panel button, confirmation, panel after dating), `event-card/*` + `event-card.util.ts` (best-first slot ordering helper next to the 40.5 summary helpers), `events-api.service.ts` (`choose` call on the shared route); tones ×3 + `theme-tone.service.spec.ts`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, §7.9 (confirmation pattern).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/poll/` + `ports` + `permission.service.ts` (+ specs) -- group branch of choose through a port, `POLL_CHOOSE` for groups, host-only rule
- [x] `apps/api/src/events/` (+ specs) -- locked date fixing, poll block dropped once dated, edit rule on a fixed date, mail #4 after commit
- [x] `apps/api/src/email/` (+ specs) -- template #4
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- matrix, race, late sign-up, mail, live
- [x] `apps/web/src/app/features/events/` -- « Fixer la date… », confirmation with ordered radios, dated panel (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- confirmation labels

**Acceptance Criteria:**
- Given an open group poll, when the host confirms a slot, then the conjonction is dated, the poll closed, `nextSessionDate` recomputed, every member's card and dialog update live, and the confirmed inscrits receive e-mail #4 once after commit.
- Given any non-host, or an already dated conjonction, then the server refuses and nothing is written.
- Given a fixed conjonction, then no vote is accepted, sign-ups still are, and the day/slot cannot be edited.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Shared route `PATCH parties/:id/poll/:pollId/choose`: `PollService.choose` branches on the party's family after the `POLL_CHOOSE` cell gate on `{ partieId }`. Group branch = `chooseGroupDate`: `GroupPollChoosePort.assertCanChoose` (one-shot 403, unknown poll 404, host rule via `PermissionService.assert(POLL_CHOOSE, { eventId })`), then one transaction (`GroupPollVotePort.lockConjonction`: Partie then Event `FOR UPDATE`, poll re-read, option check, poll `CLOSED`, `SeanceDatePort.chooseDate`), then `emit`, `notifyChanged`, `notifyDateFixed` (mail #4). JDR path untouched.
- `PermissionService`: `POLL_CHOOSE` opens to admin and member in the ralliement policy; the host-only rule applies in the ralliement family when the target resolves an event (`HOST_ONLY_WHEN_EVENT_TARGETED`); a `{ partieId }` target is the role-cell gate only, `PollService` always re-asserts on `{ eventId }` for a group.
- `lockConjonction` is also taken by group vote and withdraw (one transaction, re-read of the poll under the lock): a vote racing the fixing is serialized, the loser sees a closed poll (400).
- New `GroupPollChoiceService` in `events/` (separate class: `GroupEventsService` depends on `PollService`, which depends on the port), bound in `PortsModule`. Mail #4 = template `conjonction-date-fixee`, recipients `CONFIRMED` inscrits minus the host, read after commit by `EventsService.dateFixedNotice`.
- Cards: no poll block once the seance is dated or the poll is not `OPEN`. Edit (`updateHosted`): a conjonction dated through a poll (`pollId` set and `startDate` set) is edited in fixed mode; changing its day or slot is refused (400, `DATE_FIXED_MESSAGE`); a conjonction proposed with a fixed date keeps the 40.2 behavior (its day stays editable).
- Web: `DateFixDialog` (MatDialog « Votre accord », radios best first, busy guard, server refusal shown in the dialog); `EventDialog` host panel button « Fixer la date… » and `refreshRequested` output (the tab re-reads the list); `rankedPollSlots`/`canFixDate` helpers; `EventsApiService.choose`.
- Not verified: Chrome/Mailpit manual check. Pre-existing failures unrelated to this story: `calendar-view.spec` (2) and `parties.service.spec` (1), hard-coded September dates.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | Server seals an option whose day is already past | medium | a poll left open for weeks lets the host fix a past slot: no reminder, past `nextSessionDate`, edits refused by the past-day guard | patch |
| 2 | blind | Escape/backdrop closes the confirmation mid-request, `refreshRequested` never fires | low | host tab stays on the open-poll panel until the live signal | patch |
| 3 | blind, verif | Fix vs vote race only unit-tested with a same-object mock | medium | demonstration: writing on `this.prisma` instead of `tx` leaves every test green | patch |
| 4 | blind | No fallback when the host account is gone (`ownerId` null), nobody can fix | low | edge of epic 42 / account deletion; poll stays open | defer |
| 5 | verif | Tab wiring `(refreshRequested)="refresh()"` has no spec | low | live signal updates the dialog anyway; the tab never had a spec | defer |
| 6 | blind, edge | Mail sent serially inside the request; side effects after commit not isolated | low | same pattern as 40.4; `notifyChanged` never throws by contract | reject |
| 7 | blind | Host not re-checked under the lock; eligibility not re-run under the lock | low | microsecond window | reject |
| 8 | blind | Vote path takes the Partie lock (hot path) | low | lock order Partie → Event keeps updateHosted deadlock-free; 4–20 members | reject |
| 9 | blind | Port cohesion, French wording of refusals, dead branch, mail link without event id | low | style only; same link as the other conjonction mails | reject |
| 10 | blind | Recipients not joined to current membership | low | departure cleanup is story 40.8 | reject |
| 11 | blind | Dialog styling tokens, focus after success, tone key duplication, process notes | low | cosmetic or conventions; contrast to check in the manual pass | reject |
| 12 | edge | « no day/slot change » compares only `startDate`/`startSlot` | low | ranges are start = end | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: host fixes the date from the dialog, other member's dialog switches to the dated panel; mail #4 in Mailpit.
