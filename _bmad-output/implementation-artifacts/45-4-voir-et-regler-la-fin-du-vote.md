---
title: 'Story 45.4 — Voir et régler la fin du vote'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: '8ec7fb183d71c5123ef647588868dc7c49b01784'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-45-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The deadline of a poll is invisible and, in JDR, silently fixed to 14 days (`DEFAULT_POLL_TTL_MS`) when a séance poll is created; the composer cannot show or change it, and the organizer of a finished JDR poll has no way to learn that pushing the end back reopens it.

**Approach:** One pure function `defaultPollDeadline(options, today)` in `@master-jdr/shared` proposes the end of the vote; the composer bar shows « Fin du vote : {date} ✎ » (editable with the native date input), follows the slots until touched, and every write carries it. The JDR write routes accept it and the server applies the same function when it is absent; past dates are refused on both sides.

## Boundaries & Constraints

**Always:**
- `defaultPollDeadline(options, today)`: the earlier of « today + 14 days » and « the day before the first slot », never before `today`; inputs and result are `YYYY-MM-DD` day keys; the server turns a day key into the end of that day (UTC, last millisecond), as group polls already do. It replaces `DEFAULT_POLL_TTL_MS` everywhere (`PollService.create`, `createInTx` when no date is given).
- JDR: `POST /scenarios/seances/:id/poll` (`CreateSeancePollDto`) and `PUT /parties/:id/poll/:pollId/options` (`SetPollOptionsDto`) accept an optional `expiresAt` day key (same format and messages as `ExtendPollDto`). Absent on create → the default function; on options it keeps the current one. A new date already past → 400 « L'échéance du vote ne peut pas être passée » (the existing message); an unchanged date is always accepted (so the options of a finished poll can be corrected). Pushing a date back is the JDR extension; no relance exists in JDR. Group/evening: `pollDeadline` already travels with `PATCH …/events/:eventId` and `POST …/events`; changing it already re-arms `relanceSentAt` (`updateInTx`) — keep, add a test; the group routes keep requiring both fields.
- Composer: `app-compose-bar` gains the `deadline-field` (« Fin du vote : {date} ✎ ») and a line explaining the default (« Proposé : dans 14 jours. » / « Proposé : la veille du premier créneau. »). The pencil reveals the native date input (`lang="fr"`, `min` = today); a past date shows the written refusal « La fin du vote ne peut pas être passée. » and blocks Valider; a date after the first slot is allowed. State lives in `CalendarView`: a new vote follows the composed slots (and `today + 14` with none) until the organizer touches the date; editing an existing poll starts on its current end and does not follow. A current end already past is marked « passée » and blocks Valider until pushed back. Labels per theme (3 voices; Cuivré « Clôture du scrutin »); explanation text and refusal in the same voices.
- Writes carry the chosen day: `scenariosSvc.createSeancePoll(seanceId, options, expiresAt)`, `pollSvc.setPollOptions(…, { options, expiresAt })`, and the group `UpdateEventDto.pollDeadline` (instead of the card's current one). ⚠️ In JDR the end, until now silent, becomes visible and editable — the only visible change to the JDR vote.
- The destiny board of a finished JDR poll tells its organizer (`can.edit`): « Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. » (3 voices; board and drawer). No « Prolonger » in JDR.
- French comments and errors; no dependency; Docker only; no migration (`expiresAt` already exists).

**Never:**
- No duration, no « Prolonger » in JDR, no change to group routes' required fields, no relance in JDR, no composer from the vitrine.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default, far slots | slots in 40 days, today T | proposed T+14, hint « dans 14 jours » | N/A |
| Default, near slots | first slot T+5 | proposed T+4, hint « la veille du premier créneau » | N/A |
| Default, first slot today | first slot T | proposed T (never before today) | N/A |
| Follows slots | untouched, add/remove slots | the date recomputes | N/A |
| Touched | organizer picks a date | it stays whatever the slots do | N/A |
| Edit open poll | current end E | field shows E, does not follow | N/A |
| Past date picked | before today | refusal text, Valider blocked | server 400 if forced |
| After first slot | allowed | accepted | N/A |
| Finished JDR poll | end passed, OPEN | field « passée », Valider blocked until pushed back; pushed back → votes reopen | N/A |
| JDR create, no date | API without `expiresAt` | default function applied | N/A |
| JDR options, unchanged date | same `expiresAt` as stored | accepted even if past | N/A |
| Evening deadline changed | PATCH event | `relanceSentAt` cleared | N/A |
| Board, finished JDR | organizer | sentence « Pour rouvrir… » | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- add `defaultPollDeadline` (+ small `addDays` on day keys), `CreateSeancePollDto.expiresAt?`, `CreatePollDto.expiresAt?`, `SetPollOptionsDto.expiresAt?`; `ExtendPollDto` is the format model.
- `apps/api/src/poll/poll.service.ts` -- `DEFAULT_POLL_TTL_MS` (l.27, 156), `create`, `createInTx`, `setOptions`, `endOfDayUtc`, `dayKeyUtc`, `POLL_DEADLINE_PAST_MESSAGE`; `dto/create-poll.dto.ts`, `dto/set-poll-options.dto.ts`, `scenarios/dto/create-seance-poll.dto.ts`, `scenarios/scenarios.controller.ts` + `scenarios.service.ts` `createSeancePoll(seanceId, mjId, options)` (add `expiresAt`).
- `apps/api` tests -- poll service spec (default, past, unchanged, setOptions), e2e `my-open-polls` / `ralliement` style for the JDR routes, relance reset on evening deadline change.
- `apps/web/src/app/core/scenarios/scenarios.service.ts` (`createSeancePoll`), `core/poll/poll.service.ts` (`setPollOptions`), `features/events/events-api.service.ts` (group update).
- `features/calendar/compose-bar/*` -- new inputs/outputs and the `deadline-field` (new small component or inline); `calendar-view.{ts,html}` -- `composeDeadline*` state, `armTarget`, `exitCompose`, `composeCanConfirm`/`composeBlockedReason`, `confirmCompose`, `confirmGroupPoll` (use the chosen day), board model (`reopenHint`), `destiny-board` / `destiny-sheet` html.
- `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- field label, hints, past marker, refusal, pencil aria, reopen sentence.
- Specs: compose-bar (new), `calendar-view.spec.ts` (default follows/touched, edit, past, writes carry the day), destiny-board.
- Do not touch: group routes' required fields, `notifications` relance logic, `ExtendVoteDialog`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared` + API (poll service, DTOs, scenarios) + tests -- `defaultPollDeadline`, `expiresAt` on the JDR writes, replace the 14-day constant
- [ ] web services -- carry the deadline in the three writes
- [ ] tones (3 themes) + tone spec -- field, hints, refusal, reopen sentence
- [x] `compose-bar` + `calendar-view` -- deadline field, state, blocking, writes
- [ ] board and drawer -- reopen sentence
- [ ] Specs -- every matrix row; API and web suites, typecheck

**Acceptance Criteria:**
- Given I compose a new JDR vote with slots in two months, when the bar opens, then it reads « Fin du vote » at today + 14 days with its explanation, and adding earlier slots moves it until I pick a date myself.
- Given I edit a JDR poll whose end has passed, when I open the composer, then the end is marked « passée » and Valider stays blocked until I push it back; once saved the poll accepts answers again.
- Given I create a séance poll through the API without `expiresAt`, then it gets the default function's end, not a fixed 14 days.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- Shared: `defaultPollDeadline` (+ `POLL_DEFAULT_DEADLINE_DAYS`, a private `shiftDayKey`), `expiresAt?` on `CreateSeancePollDto`, `CreatePollDto`, `SetPollOptionsDto`. API: `DEFAULT_POLL_TTL_MS` removed; `PollService.create` takes the chosen day (400 if past or not a real day), `createInTx` defaults through the shared function, `setOptions` writes a NEW end (JDR: no relance) and compares by DAY so a pre-45.4 instant is not « changed » when the client echoes its day; `scenarios` controller/service pass `expiresAt`. Group routes untouched (still require both fields); `updateInTx` already cleared `relanceSentAt` on a changed end (now covered by an e2e).
- Web: `ScenariosService.createSeancePoll(…, expiresAt?)`; `ComposeBar` gains the deadline field (button text « Fin du vote : ven. 6 nov. ✎ », native `<input type="date">` on edit with `min` = today, written « passée » tag, default hint); `CalendarView` keeps `composeDeadlineDay` / `composeDeadlineFixed`, `composeDeadline` (chosen, else `defaultPollDeadline` following the slots), `composeDeadlinePast` (blocks Valider, reason = refusal text), `composeDeadlineHint`; `armTarget` reads the stored end of an existing vote (and `startGroupCompose` now delegates to it); the three writes carry the day; `reopenHint` on the board model (organizer, JDR, ended) rendered by `destiny-board` (the drawer embeds the board). The composition of a conjonction to create shows no field.
- Tones (3 voices): `calendar.compose_deadline_{field,edit_aria,hint_14,hint_eve,hint_today,past,ended_tag}`, `calendar.destiny_reopen_vote` (named without the `destiny_board_` prefix because the 44.4 tone test counts that prefix as JDR-word-free keys).
- Specs: API unit 6 + 5 + 7 (`default-poll-deadline.spec.ts`), e2e `poll-deadline` (9); web: 6 compose-bar, 11 `CalendarView` (default, follows, touched, past, edit, finished poll, write carries the day, group, board hint), existing write expectations now carry `expiresAt`.
- Verification: API typecheck OK; API unit OK except the known date-dependent `parties.service` AD-9 test; API e2e 14 suites, 400 + 1: the account-deletion e2e failed once under the full parallel run and passes alone (6/6), treated as a load flake; web typecheck (app and spec) OK; web suite OK except the 3 known date-dependent failures; eslint: no new finding. Not exercised in a browser: the field, the native picker, the board sentence (the real account has no JDR séance to compose), phone width, the three themes. The running `api` container was not restarted for this story.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | A client echoing the stored day of a pre-45.4 poll (an instant) would be refused as a past « change » | high | `setOptions` compares by day, not timestamp; e2e « fin passée en base » covers the unchanged case |
| 2 | `startGroupCompose` bypassed `armTarget`, so a group edit would silently replace the stored end by the default | high | caught by the existing PATCH test; the method now delegates to `armTarget`; tested |
| 3 | The day key is end-of-day UTC while the web compares with the local `todayKey` | low | same convention as `todayKey` use in 44.x and the group deadline; a few hours of skew around midnight, server stays judge |
| 4 | A native date input cannot be forced to refuse a past date typed by hand | low | `min` guides, the written refusal and the blocked Valider hold, the server refuses too |
| 5 | The deadline field is absent while composing a conjonction to create | low | by design: its end is set in the creation window (40.5b round trip unchanged) |
| 6 | Group routes still require both fields although the story says the server applies the default when absent | low | decided in the spec (Always): JDR writes only |

## Design Notes

Decided without the human: the deadline travels as a day key (like `ExtendPollDto` and `pollDeadline`), the server giving it the end of that day in UTC; the pencil reveals the native `<input type="date">` (the « sélecteur de date existant » of the extend dialog) rather than a new picker; a poll being edited starts on its stored end and never follows the slots; the explanation line shows only while the date is the untouched default; the reopen sentence is for the organizer only; group routes keep demanding both `pollOptions` and `pollDeadline`.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` and `pnpm test` and `pnpm test:e2e` -- expected: pass (the known date-dependent `parties.service` test excepted)
- `docker compose exec web pnpm exec ng test --watch=false` and `tsc --noEmit -p tsconfig.app.json` / `tsconfig.spec.json` -- expected: pass (3 known date-dependent failures excepted)

**Manual checks (if no CLI):**
- Composer armed on a JDR séance and on an evening: default, follow, touch, past, finished poll; the three themes, desktop and phone.
