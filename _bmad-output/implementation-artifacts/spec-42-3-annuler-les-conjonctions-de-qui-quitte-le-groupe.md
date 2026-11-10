---
title: '42.3 — Cancel the conjunctions of whoever leaves the group'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: '12c38ae026582882a03642ed307a410e1ddfbc2e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-42-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-42-1-annuler-une-conjonction-de-groupe.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A member who leaves or is removed keeps hosting upcoming conjunctions (story 40.8 left them): registrants wait for an evening with no host (FR6, AD-17).

**Approach:** Inside the single `PartiesService.leave()` transaction, the upcoming conjunctions the departing person hosts are cancelled by the story 42.1 procedure; after commit their registrants get e-mail #7. Past conjunctions are untouched and keep their displayed host.

## Boundaries & Constraints

**Always:** Group departures only (`leave()` ralliement branch, voluntary or removal); JDR unchanged; the last-admin path that deletes the group does no cancelling. "Upcoming" = same rule as `releaseUpcomingInscriptionsInTx`: undated, or day ≥ today (UTC); events already cancelled are skipped. New `EventsService.cancelUpcomingHostedInTx(tx, partieId, hostId, closePolls)`: under the held Partie lock, locks the matching `Event` rows (sorted by id), sets `cancelledAt`, hands the polls to `closePolls` (new `PollVoteCleanupService.closePollsInTx`, `poll/` stays the `SessionPoll` writer, no cycle), recomputes next session; returns the cancelled event ids; emits nothing. It runs after `removeOpenVotesInTx` and before the membership delete. Any failure rolls the whole departure back. E-mail sending moves out of `GroupEventsService` into a new `EventCancellationMailer` (events/, depends on `EventsService` + `EmailService`, exported) used by both 42.1 `cancel()` and `leave()`; it keeps the 42.1 rules (confirmed + reserved registrants, canceller excluded, failures logged never raised) and the actor is the departing host. Mails are sent after commit, one set per cancelled event; real-time emissions are the existing `emitDeparture` ones (they already refresh every member's list and signals). French comments/errors; nothing installed; Docker only.

**Never:** No new route, cell, migration, e-mail template or web change; no change to who may leave; no cancelling on the isolated evening; no touching past conjunctions; epic 43 (account deletion) not started.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Host leaves | hosts one upcoming dated + one undated poll event, with registrants | both cancelled in the leave transaction, poll closed, registrants mailed | — |
| Host removed | admin removes a member who hosts an upcoming event | same cancellation, mail names the removed host | — |
| Past + upcoming | hosts one past and one upcoming | only the upcoming is cancelled; the past keeps its host and registrants | — |
| Already cancelled | hosted event cancelled earlier | skipped, no second mail | — |
| Hosts nothing | plain member | no event touched, no mail | — |
| Last admin | deletes the group | cascade as before, no cancelling, no mail | — |
| Failure inside | cancelling throws | membership, places and votes intact, nothing emitted or mailed | rollback |
| Mail failure | send fails | departure and cancellations stay, error logged | — |
| JDR | MJ removes a player | unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts` -- `leave()` :545 (extension point comment at :622), `LeaveCause`, constructor :233, `emitDeparture`; add the mailer dependency and the post-commit mail call.
- `apps/api/src/events/events.service.ts` -- `releaseUpcomingInscriptionsInTx` (same "upcoming" rule and lock pattern), `cancelHosted`, `cancellationNotice`, `recalculateNextSessionInTx`; add `cancelUpcomingHostedInTx`.
- `apps/api/src/events/group-events.service.ts` -- `sendCancellationEmails` and its `email` use move to the mailer; constructor loses `EmailService` only if nothing else uses it (reservation e-mails still do: keep it).
- New `apps/api/src/events/event-cancellation-mailer.service.ts`; `events.module.ts` provides and exports it.
- `apps/api/src/poll/poll-vote-cleanup.service.ts` -- add `closePollsInTx`.
- Tests: `parties.service.spec.ts` (:261 and :2663 constructions, leave describes :1455+, `polls` mock :260), `group-events.service.spec.ts`, new mailer spec, `events.service.spec.ts`, `poll-vote-cleanup.service.spec.ts`, `ralliement.e2e-spec.ts` (40.8 describe pattern at the end of epic 40).
- Do NOT touch: `cancelHosted`/`EVENT_CANCEL` rules, web, templates, `setMemberRole`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api` poll + events -- `closePollsInTx`, `cancelUpcomingHostedInTx`, `EventCancellationMailer` (+ specs)
- [x] `apps/api` parties + group-events -- `leave()` cancels hosted upcoming events in its transaction and mails after commit; 42.1 `cancel()` uses the mailer (+ specs)
- [x] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- host leaves / is removed with an upcoming and a past event, last admin, rollback, mails

**Acceptance Criteria:**
- Given a member hosting an upcoming and a past conjunction, when they leave or are removed, then only the upcoming one is cancelled in the same transaction and its registrants get e-mail #7 after commit.
- Given a departure that fails midway, then nothing is cancelled, released or mailed.
- Given a JDR party or the last-admin deletion, then behaviour is unchanged.

## Implementation Notes

- Implemented directly in the session (no implementation or review subagents: this run only allows them on an explicit user request).
- `PollVoteCleanupService.closePollsInTx`; `EventsService.cancelUpcomingHostedInTx` (hosted, not cancelled, undated or day ≥ today; event rows locked sorted after the Partie lock; `cancelledAt`; polls handed to the closure; next session recomputed; returns the ids). `PartiesService.leave()` calls it after the vote cleanup and before the membership delete; the ids leave the transaction in its outcome and `EventCancellationMailer.send` runs after `emitDeparture`, once per event, actor = the departing person. The last-admin branch returns no ids.
- `EventCancellationMailer` (events/, exported by `EventsModule`) now owns the e-mail #7 sending; `GroupEventsService.cancel` delegates to it (its own copy and its unit tests moved to `event-cancellation-mailer.service.spec.ts`). No migration, route, template or web change.
- Results: API typecheck clean; unit tests green apart from the known date failure (`parties.service.spec` AD-9); full e2e 340 green (6 new). Web untouched.
- Not done: nothing visual to check; `/security-review` and `/code-review` still to run (`leave()` is the shared departure path).

## Spec Change Log

## Review Triage Log

Inline review (no reviewer subagents in this run).

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | edge | The pre-lock read of hosted events could miss one cancelled/created meanwhile | false | `leave()` holds the Partie lock; every Event writer (create, cancel, update) takes the Partie lock first, so the set cannot change during the transaction | reject |
| 2 | edge | A removed guest of an isolated evening could host events | false | Isolated evenings have one event owned by their admin, who cannot be removed; the query is empty | reject |
| 3 | blind | Mails are sent one by one after the departure answer is built | low | Same sequential pattern as 42.1/40.4; groups are 4 to 20 members | reject |
| 4 | edge | If an e-mail send throws, later events are not mailed | false | `EventCancellationMailer.send` catches everything per call and never raises | reject |
| 5 | gap | Past-day boundary differs between `cancelHosted` and the new method | false | Both use the UTC day key rule of 40.8/42.1 (today stays cancellable/upcoming); covered by the `findMany` filter test | reject |

## Design Notes

The mailer exists because `PartiesService` cannot depend on `GroupEventsService` (that one receives `PartiesService` through `PARTIE_SIGNALS_PORT`); `EventsService` stays free of `EmailService`, as for the reservation and date-fixed mails.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green apart from the known date failure
- `graphify update .`
