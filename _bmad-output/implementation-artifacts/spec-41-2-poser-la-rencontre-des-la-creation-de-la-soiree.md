---
title: '41.2 — Set the meeting right when the evening is created'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'dda916564707f271227cf9956e5091f7bc53c2d6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-41-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-41-1-afficher-une-soiree-isolee-sur-une-seule-page.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-7-prolonger-le-vote-et-relancer-la-veille.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A freshly created isolated evening has an event with no date, and nothing lets its host set one: the server refuses every group event action on a `ONE_SHOT` ralliement (edit, poll vote, set date, extend, relance, reminders), and the creation form ends on a page with nothing to complete (FR2, FR10, FR11).

**Approach:** Right after the evening is created, the page opens the event dialog in creation mode, pre-filled with the name, which completes the event already created (never a second one). Date fixed or date poll follow the epic 40 journey (calendar vote, set date, extend, J-1 relance), with the host plus the evening's members as voters and recipients. Participation is read-only: "Sur invitation · pas de limite".

## Boundaries & Constraints

**Always:** Server: `GroupEventsService.update` accepts a `ONE_SHOT` ralliement (create, sign-up, reservations stay group-only and refused); a `ONE_SHOT` edit refuses a non-null `capacity` or any `reservedUserIds` (400, French). `EventsService.updateHosted` gains the third state "awaiting a date" (no date, no poll): it may write a fixed date, or create the poll (`createPoll` closure, linking `Seance.pollId`) — creation rules apply (past days and past deadline refused, decided by a read-only `isAwaitingDate(eventId)` before choosing the caller's validation); dated and poll states keep their current rules (mode locked, no date change after a poll set it). Lift the group-only guards for the whole ralliement family, nothing else: `PollService.assertGroupVoteKind`, `EventsService.assertCanVote`, `GroupPollChoiceService.assertCanChoose`, `GroupPollExtensionService.assertCanExtend`, the vote-relance query/guard in `NotificationsService`; keep rights in `PermissionService` (host-only cells untouched). Voters (`eligibleVoters`, capacity null) are the host plus the party's members; e-mail #4 goes to the evening's members except the host; the day-before reminder of an isolated evening uses the neutral `conjonction-reminder` (recipients unchanged: owner + members); #6 goes to voters without answer. All writes keep the Partie → Event lock order and emit after commit. Web: after creation, `PartieForm` navigates with router state; `SoireeTab` opens `EventCreate` once from that state (consumed, not replayed on reload) in "soirée" mode: name pre-filled, participation shown read-only, no places/reservation picker, submit = `update` of the existing event; "Renoncer" keeps the "Date à fixer" event. `EventForm` offers the date-mode toggle when the event awaits a date. Inline detail (`EventDialog [inline]`) gives the host "Modifier" while not past and, for polls, "Fixer la date…", "Prolonger le vote", "Voter / Composer dans le calendrier" (refresh and calendar events handled by `SoireeTab`). The calendar page treats every ralliement as a group (`resolveGroup`), and the compose round trip reopens the evening's dialog (`ConjonctionDraftService.takeReopen`). Real time: `changed()` already rereads; mutations call `notifyPartieSignalsChanged` as in epic 40. Groups, quests and JDR unchanged; French comments and errors; nothing installed; Docker only.

**Never:** No sign-up, limited places, reservation or second event in an evening; no invitation tools or accept/decline (41.3); no closing/frozen past evening (41.4), no cancel (42); no per-event invitation; no change to `PermissionService` policy cells.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create then set fixed date | host creates evening, submits the dialog with day + slot | the existing event is updated (no new event), card shows the date, `nextSessionDate` set | past day → 400 |
| Create then poll | dialog in poll mode, ≥ 2 slots + deadline | poll created and linked, event stays undated, members can vote | < 2 slots or past deadline → 400 |
| Renoncer | host closes the dialog | event stays "Date à fixer"; host completes later via "Modifier" | — |
| Limited places | edit sends `capacity` or `reservedUserIds` | refused | 400 |
| Non-host edits | member sends the edit | refused | 403 |
| Vote | member / host votes before the deadline | accepted; stranger or after deadline refused | 403 / 400 |
| Set date / extend | host only | date sealed, e-mail #4 to members; extend re-arms relance | other member 403 |
| Reminders | day before the fixed date; day before the deadline | #5 and #6 to members / voters without answer | — |
| Group / JDR | any other party | unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/events/group-events.service.ts` -- `update` :108 (kind guard to relax for `ONE_SHOT`, isolated rules), `seanceInput` :257 (`create`/`update` validation, `createPoll`+`updatePoll` closures), `seanceOf` stays group-only.
- `apps/api/src/events/events.service.ts` -- `updateHosted` :756 (add the "awaiting a date" branch), new `isAwaitingDate`, `assertCanVote` :1383, `dateFixedNotice` :1469 (recipients: members minus host for `ONE_SHOT`), `reminderRecipients` :1507 (already owner + members for non-group), `voteReminderRecipients` :1537 (members when capacity null, already fine).
- `apps/api/src/poll/poll.service.ts` -- `assertGroupVoteKind` :291, `chooseGroupDate` :440, `extend` :488; ports `poll/ports/group-poll-*.port.ts` doc comments; `events/group-poll-choice.service.ts` :35, `events/group-poll-extension.service.ts` :29.
- `apps/api/src/notifications/notifications.service.ts` -- `remindSeance` :147 (`group` flag chooses the template), `processVoteReminders` :190 query `kind`, `remindVote` :265 guard; `isRalliementGroup` stays the JDR/ralliement splitter elsewhere.
- `apps/web/src/app/features/parties/partie-form/partie-form.ts` :510 -- navigate with `state` after creating a ralliement `ONE_SHOT`.
- `apps/web/src/app/features/events/soiree-tab/*` -- open creation from state, edit, refresh, calendar request, reopen draft; `event-create/*`, `event-form/*` (soirée variant: read-only participation, no reservation, mode toggle when awaiting a date), `event-dialog/*` (inline: edit + poll buttons), `conjonctions-tab.ts` (model for dialog/history/draft plumbing).
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts` :1929 `resolveGroup` -- family `ralliement` instead of kind `CAMPAGNE_EPISODIQUE`.
- Tones (3 themes + `theme-tone.service.spec.ts` neutral list): read-only participation text with "vous invitez ensuite depuis l'onglet Invitations".
- Tests: `ralliement.e2e-spec.ts` (isolated refusals at ~1891, ~2742 and poll/choose/extend cases become allowed ⚠️, with new host/stranger/limited-places/reminder cases), `events.service.spec.ts`, `poll.service.spec.ts`, `notifications.service.spec.ts`, web specs of the touched components.
- Do NOT touch: `PermissionService` policy tables, inscription/reservation services.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api` events/poll/notifications -- guards lifted for the ralliement family, awaiting-date branch, isolated edit rules, recipients and reminder template (+ unit specs)
- [ ] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- update the isolated expectations that change ⚠️; add fixed date, poll, vote, set date, extend, limited-places refusal, non-host and stranger refusals, reminders
- [ ] `apps/web` form/dialog/tab/calendar -- soirée creation dialog from router state, inline edit and poll actions, mode toggle, calendar group resolution (+ specs, tones)

**Acceptance Criteria:**
- Given a host who just created an evening, when the page opens, then the dialog is open over it pre-filled with the name and submitting completes the existing event with a date or a poll.
- Given a poll, when members vote, the host sets the date or extends, then the epic 40 behavior applies with the host plus members as voters and e-mails #4, #5, #6 reaching the evening's members.
- Given groups, quests and JDR, then all existing tests keep their expectations apart from the isolated-evening refusals listed above.

## Implementation Notes

- Implemented directly in the session (no implementation subagent); the review ran inline (no reviewer subagents).
- Server: `updateHosted` has a third state "awaiting a date" (fixed date or poll creation through the caller's `createPoll`); `GroupEventsService.update` serves `ONE_SHOT` (new `ISOLATED_NO_PLACES_MESSAGE`, `isAwaitingDate` decides creation vs modification validation). Guards lifted for the ralliement family in `PollService`, `assertCanVote`, `GroupPollChoiceService`, `GroupPollExtensionService` (their `partie` parameter is now unused, kept as `_partie` to leave the port contract and specs untouched). `dateFixedNotice` mails the members of an isolated evening (host excluded); reminders and the vote relance now cover every ralliement.
- Web: `PartieForm` navigates with `state.soireeCreation`; `SoireeTab` consumes it (or a calendar draft) and opens `EventCreate` in soirée mode (`eventId` → `api.update`); `EventDialog [inline]` shows "Modifier" for the host (an awaiting event opens the creation dialog via `completeRequested`, a dated or poll event edits inline), keeps the poll actions, and drops "Refermer"; `EventForm` gets `soiree` / `initialTitle` and keeps both date modes open while awaiting a date; `CalendarView.resolveGroup` treats every ralliement as a group.
- ⚠️ Intended expectation changes: the `ralliement.e2e-spec.ts` probes and cases that refused vote / set date / extend / edit on an isolated evening now expect the new behavior (404 / 400 for unknown polls, 200 for the host's edit); unit specs of the two poll ports, `assertCanVote`, `dateFixedNotice`, `GroupEventsService.update` and the reminder routing changed accordingly.
- The foret theme tutoie ("tu invites…"), so the read-only participation text of the form is not a neutral key.
- Not done: the visual check in Chrome (create an evening in each theme, vote from a second member, Mailpit) is left to the user.
- Results: API typecheck, unit tests (only the known date failure), full e2e (308); web suite (only the 2 known date failures), `ng build` compiles.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | inline | A guest of an isolated evening who never voted still gets e-mail #4 ("C'est fixé") | low | Intended by the AC: the mail goes to the evening's members | reject |
| 2 | inline | Reload during the creation dialog loses the dialog (only the "Date à fixer" state remains) | low | Same as the group creation dialog; "Modifier" reopens it | reject |
| 3 | inline | `history.replaceState` merges the router's own state to clear the marker | low | Same pattern as `ConjonctionsTab` (state kept, one key changed); covered by a test | reject |
| 4 | inline | Unused `_partie` parameters in three port implementations | low | Port contract and specs kept; unused parameter documented | reject |
| 5 | inline | Race: two completions of an awaiting evening | low | Both run under the Partie → Event lock; the second sees a dated or poll state and gets a 400 | reject |
| 6 | inline | `eslint --fix` reformatted pre-existing lines in a few files | low | Formatting only; calendar-view.ts left untouched | reject |

## Design Notes

Why a third state in `updateHosted`: an isolated evening is born with an undated, poll-less event (38.2), a state no group event ever has, so neither existing branch fits. Keep the check inside the transaction (lock held) and let the caller pick creation or modification validation from a read-only pre-check.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green
- `docker compose exec web pnpm exec ng test --no-watch` -- green apart from the 2 known date failures; `ng build` compiles
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: create an evening, dialog opens, set a date; create another with a poll, vote from a second member in the calendar, set the date; check Mailpit.
