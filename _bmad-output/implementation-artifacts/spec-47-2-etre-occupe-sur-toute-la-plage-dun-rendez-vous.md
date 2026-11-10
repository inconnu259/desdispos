---
Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap). No intent_gap, no bad_spec, so no loopback. Patches applied directly in-session; checks re-run afterwards (API typecheck, API unit tests with only the known date-frozen failure, e2e 427, web tests with only the 2 known date-frozen failures).

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | `RESERVATION_A_CONFIRMER` still filtered `startDate >= today`, so a reserved place on a started range lost its signal while `acceptReservation` still worked (VG, EC) | medium | patch (done) | Real: `party-signals.service.ts` was the one reader of the rule left on the start. Now `endDate >= today`, or no end and `startDate >= today`; the spec that pinned the old filter now pins the new one. |
| 2 | The GM "future seance" signal and the player's `nextSessionDate > now` read the start only (EC) | medium | patch (done) | Real: the GM branch now also selects `endDate` and the player branch reads `nextSessionEndDate`; a test with a range that started in 2020 and ends in 2099 keeps `PROCHAINE_SEANCE_CONNUE`. |
| 3 | JDR reminder template reads "a lieu le {{sessionDate}}", so a range would read "le du samedi… au dimanche…" (EC) | medium | patch (done) | Real, only `session-reminder.hbs` had a leading "le". The template now takes `sessionPhrase` ("le …" for one slot, "du … au …" for a range); test added. |
| 4 | Party page "Prochaine séance" widget filtered on the start, so a started range showed "À planifier", and its label ignored the end (VG, EC) | medium | patch (done) | Real: `nextSessionBadge` now tests the end and passes it to `seanceState`; `nextSessionLabel` writes "début → fin". Two specs added (started range, ended range). |
| 5 | Vote-reminder line wording differs from the spec ("Durée du rendez-vous : N créneaux" vs "Durée : N créneaux") and the template relies on a whitespace trick (EC, BH, VG) | low | patch (done) | Template reworded to the spec text on one line. Rendering the real template stays untested (the Mailpit integration test skips when Mailpit is down): deferred. |
| 6 | `isSeancePast` and `upcomingSeanceOr` had no direct tests (BH) | low | patch (done) | Unit tests added: no date, same day, no end, started range, ended range, null bound. |
| 7 | The date-fixed e-mail wiring of `formatSessionSpan` had no multi-slot test (BH) | low | patch (done) | Case added in `group-poll-choice.service.spec.ts`. Invitation, reservation and cancellation call sites share the same one-line call and the unit-tested formatter. |
| 8 | Agenda sections, event card and countdown still bucket a started range by its start (BH, EC) | medium | defer | Real, but these are displays: the spec's Never list leaves bands, Agenda, rail and event window to 47.3. The dashboard countdown also skips a started range (acceptable: the badge still shows the range). |
| 9 | Rendering of `conjonction-relance.hbs` with `durationLabel` is not tested end to end (VG) | low | defer | Needs Mailpit in the integration test; the data passed to `sendMail` is asserted. |
| 10 | No backfill of `nextSessionEndDate/EndSlot` for existing parties (BH, EC) | low | rejected | No production data before Palier 11 and no multi-slot seance existed before 47.1; each party's next recalculation fills the columns, and the badge falls back to the single slot meanwhile. |
| 11 | Optional types (`endDate?`, `endSlot?`, `PartieDto.nextSessionEnd*?`, `isSeancePast(start, end?)`) let a forgotten call site compile (BH) | low | rejected | Making them required touches every notice, party and test fixture for a defect no call site shows today (all production sites were switched); the optional DTO fields are a stated decision. |
| 12 | `occupiedSpansOf` unfolds from `durationSlots` while other readers use the stored end; a full-day or slot-less seance with duration > 1 occupies one day (BH, EC) | low | rejected | Both values come from the single `seanceSpanEnd` writer (47.1), and `seanceSpanEnd` refuses full-day above one slot, so they cannot disagree. |
| 13 | `toSeanceDto` may mix a poll start with a seance end (BH) | false | rejected | `dateEffective` is `seance.startDate` since 37.4; `poll.chosenDate` is no longer read there. |
| 14 | `formatSessionRange` duplicates `formatSessionSpan`; range logic exists three times; very long lines (BH) | low | rejected | The reminder service keeps its own slot labels on purpose (output unchanged for one slot); formatting is not enforced by CI. |
| 15 | `endSlot` null prints the end without a slot; fixtures break the end-set-implies-slot invariant (BH, EC) | low | rejected | Unreachable through the writer (both set together, or both null for a slot-less start); fixtures do not assert it. |
| 16 | `started` check in `setSeanceDurationInTx` is start-based (VG) | false | rejected | Intended: the reminder leaves before the start, so only an unstarted seance re-arms it. |

title: 'Être occupé sur toute la plage d''un rendez-vous (story 47.2)'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '9f7bcf6b35cb394f56ca85f7a1860607ecfac76d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-47-1-donner-une-duree-a-un-rendez-vous.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 47.1 a rendez-vous can last several slots, but every reader of its date still sees one slot: participants are free during the rest of a weekend, period filters, "past" checks, next-session logic and e-mails ignore the end.

**Approach:** Make the stored range (`startDate/startSlot/endDate/endSlot` of the `Seance`) the single thing every server reader uses: `events/` unfolds it slot by slot through `spanSlots` for the occupied-spans port (so unavailability, heat map and automaton inherit), period filters test overlap, "past" means the end is before today, and e-mails, the next session and the parties list write the range.

## Boundaries & Constraints

**Always:**
- Seance output DTOs `SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry` gain `endDate`/`endSlot`, read from the `Seance` and never from `poll.chosenDate`; their existing start fields (`date`/`slot`, `dateValidee`/`slotValidee`) keep their meaning. `PartieDto` gains optional `nextSessionEndDate`/`nextSessionEndSlot`, written by `events/` with `Partie.nextSessionDate/Slot` (new nullable columns, one migration).
- "Past" = end before today (UTC day, today stays upcoming), everywhere a past rule exists: edit refusal, cancellation, sign-up guards, upcoming filters, party status, next session, web `seanceState`. A range already started stays upcoming until its end; `nextSessionDate` stays the start, so a started range is still the next session.
- `occupiedSpansOf` keeps `{ date, slot }` per entry but returns one entry per covered slot (`FULL_DAY` or missing slot = a single `FULL_DAY` entry, as today); a one-slot seance gives exactly today's output. The port stays identity-free.
- The reminder still leaves the day before the **start**. E-mails (date fixed, reminder, reservation, invitation, cancellation) write a multi-slot range as "du samedi 14 novembre (soir) au dimanche 15 novembre (après-midi)"; one slot keeps today's text. The vote-reminder e-mail adds one line "Durée : N créneaux" when N > 1.
- Two rendez-vous that overlap are shown through the availability and never refused by any write.
- French comments and errors; existing one-slot test expectations do not change; no dependency install; Docker only.

**Never:**
- No display work beyond the dashboard party badge and `seanceState`: bands, Agenda, rail, board, scenario sheet, event window and the composer belong to 47.3–47.5. No automaton change (it inherits). No change to poll DTOs or poll option writes.
- No new write path for the range: only `events/` writes it (47.1 source test stays green).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Long range occupies | Seance Sat EVENING × 3 | each participant has UNAVAILABLE on Sat EVENING, Sun MORNING, Sun AFTERNOON | N/A |
| One slot unchanged | Seance of 1 slot / legacy without slot | exactly one entry (slot, or `FULL_DAY`) | N/A |
| Overlap kept | Two seances overlapping | both created; both span sets returned | no refusal |
| Period overlap | Seance 31 Oct → 1 Nov | listed in the October and the November window | N/A |
| Started range | Start yesterday, end tomorrow | not past: editable, cancellable, still next session | N/A |
| Ended range | End yesterday | past: edit and cancel refused, not next session | existing 400 messages |
| Date fixed e-mail | 3-slot range | range sentence; 1 slot unchanged | N/A |
| Reminder timing | Range starting in 20 h | reminder sent; none at the end | N/A |
| Parties list | Next range 2 days | badge shows start → end | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:75` -- `Partie.nextSessionDate/Slot`; add `nextSessionEndDate`/`nextSessionEndSlot`; migration `20261027130000_partie_next_session_end` (additive, nullable).
- `apps/api/src/events/events.service.ts` -- sole owner of range readers: `occupiedSpansOf` (:~2155, unfold with `spanSlots`), `ownEventsOf` (:~2231, overlap filter + `endDate/endSlot`), `listCards` projection (:~547), `recomputeNextSession` (:~2100, end-based candidates, writes the end), `updateHosted` past check (:~866), `cancelHosted` (:~989), `cancelUpcomingHostedInTx` filter (:~1020), `assertNotPast` + callers (:~1458–1594), upcoming filter (:~1620), `endedIsolatedPartieIds` (already end-based, reuse its rule), notices `dateFixedNotice`/`reservationNotice`/`invitationNotice`/`cancellationNotice` (add end). Add one `isSeancePast`/past-where helper and one `Partie` next-session writer extension.
- `apps/api/src/events/session-date.ts` -- `formatSessionDate`; add `formatSessionSpan(start, startSlot, end, endSlot)` used by every e-mail.
- `apps/api/src/availability/ports/occupied-spans.port.ts`, `availability.service.ts:705` -- port doc ("plage dépliée"); consumer unchanged.
- `apps/api/src/notifications/notifications.service.ts:154` (reminder, own `formatSessionDate`), `:262` (vote reminder, `conjonction-relance.hbs`), `events/group-events.service.ts:259`, `group-poll-choice.service.ts:46`, `event-cancellation-mailer.service.ts:51`, `invitations/invitations.service.ts:101` -- switch to `formatSessionSpan`.
- `apps/api/src/scenarios/scenarios.service.ts` (`toSeanceDto`), `parties/parties.service.ts:235` (`toPartieDto`) -- add the end fields.
- `packages/shared/src/index.ts` -- `SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry`, `PartieDto`.
- Web: `core/status/status-derivation.ts` (`seanceState`, `SeanceStateSource`), `features/dashboard/dashboard.ts:431` (`badgeLabel`); fixtures of the three DTOs.
- Reuse: `spanSlots`, `spanEnd`, `seanceSpanEnd` (47.1), `isConfirmed`, `isRalliementGroup`.

## Tasks & Acceptance

**Execution:**
- [x] Prisma schema + migration -- two nullable columns on `Partie`
- [x] `events.service.ts` -- unfold occupied spans; overlap period filter; end in DTOs and notices; one past rule applied to edit, cancel, sign-up guards, upcoming filters, next session (+ end columns)
- [x] `session-date.ts` + e-mail call sites + `conjonction-relance.hbs` -- range sentence, duration line
- [x] `shared`, `scenarios.service.ts`, `parties.service.ts` -- DTO end fields
- [x] Web `seanceState`, dashboard badge, fixtures -- range-aware, scripted fixture fixes
- [x] Tests -- every matrix row (unit + e2e), N-slot unavailability through the availability API, one-slot outputs byte-identical, e-mail texts, characterization shapes updated

**Acceptance Criteria:**
- Given a one-slot seance, when anything reads it, then output and behaviour equal today's.
- Given CI (typecheck, API build, unit + e2e), then it stays green; `graphify update .` run.

## Implementation Notes

- Implementation done directly in the session (no implementation subagent), from the spec.
- Migration `20261027130000_partie_next_session_end` hand-written (SQL), applied to the dev database in the api container, client regenerated.
- `events/seance-span.ts` gains `isSeancePast(start, end?)` (the single "past" rule: end, else start, strictly before today UTC) and `upcomingSeanceOr(startOfToday)` (the Prisma form: no date, or `endDate >= today`, or no end and `startDate >= today`). Applied to `updateHosted`, `cancelHosted`, `assertNotPast` (all conjunction sign-up guards), `cancelUpcomingHostedInTx`, `releaseUpcomingInscriptionsInTx`, `recomputeNextSession`. `endedIsolatedPartieIds` was already end-based.
- `occupiedSpansOf` unfolds a range with `spanSlots(start, startSlot, Seance.durationSlots)`; a one-slot, full-day or slot-less seance keeps its single entry. `ownEventsOf` filters by overlap and serves `endDate`/`endSlot`; `listCards`, `toSeanceDto` and the four e-mail notices serve the end too.
- `Partie.nextSessionEndDate/EndSlot` are written by `recomputeNextSession` with the start; `PartieDto.nextSessionEndDate/EndSlot` are optional (served as `null` or a value) to avoid touching every party fixture. A range already started stays the "next session" until its end, so `nextSessionDate` can be in the past during a weekend; `party-signals` already reads a past `nextSessionDate` as absent, so that signal drops while the range runs (accepted).
- E-mails: `formatSessionSpan` (events/session-date.ts) writes "du … (soir) au … (après-midi)"; the reminder keeps its own slot labels (`formatSessionRange` in `notifications.service.ts`). The vote-reminder template gets an optional "Durée du rendez-vous : N créneaux." line. The reminder still leaves 24 h before the start (query unchanged).
- Web: `seanceState` reads `endDate` (a started range is not "à débriefer"); the dashboard badge writes "début → fin". `endDate`/`endSlot` are required on `SeanceDto`, `EventCardSeanceDto` and `MyCalendarSeanceEntry`; fixtures fixed by script.
- Tests: new blocks in `events.service.spec.ts` ("plage de plusieurs créneaux"), `session-date.spec.ts`, `notifications.service.spec.ts`, `scenarios.service.spec.ts`, `status-derivation.spec.ts`, `dashboard.spec.ts`; e2e "plage de plusieurs créneaux" in `seances.e2e-spec.ts` (availability through `available-slots`, `/me/calendar` overlap); frozen shapes of the characterization tests updated (`endDate`, `endSlot`, `nextSessionEnd*`), and the 42.1 "past cancel" fixture now sets both ends of the range.
- Checked: API `typecheck` and `build` OK; API unit tests 2992 OK except 1 known date-frozen test ("AD-9 end-to-end", deferred-work); e2e 427 OK; web tests 4013+ OK except 2 known date-frozen tests in `calendar-view.spec.ts`. Not seen in a browser.

## Spec Change Log

## Review Triage Log

## Design Notes

A range starting Sat EVENING × 3 unfolds to (Sat EVENING, Sun MORNING, Sun AFTERNOON). "Past" for a started range: `endDate >= startOfToday UTC` means upcoming; rows without `endDate` fall back to `startDate`. Prisma filter: `OR: [{ endDate: { gte } }, { endDate: null, startDate: { gte } }]`.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- expected: all pass but the known date-frozen test
- `docker compose exec web pnpm test` -- expected: all pass but the 2 known date-frozen tests
- `docker compose exec api pnpm exec prisma migrate status` -- expected: up to date
