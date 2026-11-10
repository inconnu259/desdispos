---
title: '40.5 — Propose a conjonction by a date poll'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: '85b5bd5c4590bde7348e79cb79fe305fe11d9b89'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group member can only propose a conjonction on a fixed day; they cannot offer several slots and let the group find the best one (FR10, FR11, UX-DR7/8/9).

**Approach:** The creation window gets a working « Sondage de dates »: the member enters candidate slots in the window (no calendar yet) and a deadline; the server opens a poll on the conjonction's seance, with one definition of who may vote and a refusal of any other vote. Card and dialog show the poll state, the member and host situation panels, and each slot's count of available inscrits.

**Scope note (user decision, 2026-10-17):** the group calendar (composer returning slots, voting in `/guild-calendar`, access from the group page, group availabilities, « Voter dans le calendrier ») is story 40.5b, out of this story; until then a group poll is created and read here but voted only through the API.

## Boundaries & Constraints

**Always:** Creation: `POST /parties/:id/events` accepts either a fixed date (40.1) or `pollOptions` (distinct `{ date, slot }`, slot never `FULL_DAY`, at least 2, no business cap — technical guard only) plus `pollDeadline` (`YYYY-MM-DD`, not before today); the two modes are exclusive (French 400). A poll conjonction's seance has no date (`startDate`/`startSlot` null), `Seance.pollId` set; `SessionPoll` is written only by `PollService` (group `expiresAt` = end of the deadline day UTC, instead of the 14-day JDR default; JDR default and 2–40 bounds unchanged); event, seance and poll are created together or not at all. Edit (40.2) of a poll conjonction replaces title, lieu, heure, infos and participation, reconciles the slots by `date|slot` key (kept slots keep their votes, removed ones lose them) and updates the deadline; it never writes a seance date; the mode cannot change. `eligibleVoters(event)` lives in `events/`, single definition: « Tous les membres » → members of the group (host included); limited places → host + `CONFIRMED` inscriptions. Vote and withdraw on the shared routes `POST|DELETE parties/:id/poll/:pollId/vote…`: `POLL_VOTE` opens to group members; for a group poll the server refuses (403/400, French) a voter outside `eligibleVoters`, any vote after `expiresAt`, and once the date is set or the poll is closed; reached through a port bound in `PortsModule` (`poll/` never imports `events/`); JDR vote behavior and tests unchanged (37.1). Only a `CAMPAGNE_EPISODIQUE` group; one-shot → 403. After commit: `emit(partie:{id})` and `notifyChanged`. `EventCardDto` gains a `poll` block (null for a dated conjonction): `id`, `expiresAt`, `status`, `eligibleVoterIds`, `options` (`id`, `date`, `slot`, `availableCount` = inscrits free on that slot from their declared availabilities, computed in one batched read, no names) and `votes` (`optionId`, `userId`, `answer`), explicit projection, group members only. Sign-ups, reservations and « Complet » (40.3/40.4) keep working on an undated seance. Calendar ports, reminders and `nextSessionDate` ignore an undated seance. Web, in `features/events/`: creation toggle « Date fixée | Sondage de dates » enabled; poll mode shows an in-window slot list (day + slot + « Ajouter », removable chips), summary « *N* créneaux · ven. 17 → sam. 25 oct. », field « Le vote se termine le »; edit mode shows the same list and deadline. Card: date line « Date à voter · jusqu'au *date* », badge « Vote en cours » orange while an eligible viewer has not voted, cyan otherwise; sorted after dated ones. Dialog panel, member (status-todo frame): « Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le *date*. », « Vos réponses : *x* créneaux sur *N* », « Meilleur créneau pour l'instant : *date* — *n* oui »; host (accent-1 frame): « Vous êtes l'hôte. Le vote se termine dans *n* jours — *N* créneaux proposés. », « Réponses : *x* sur *N* », best slot, « N'ont pas encore répondu : *noms* » — all computed on screen from `eligibleVoterIds` and `votes`, live from the list; the sheet shows each candidate slot with its available count. No « Fixer la date », « Prolonger » (40.6/40.7) and no « Voter dans le calendrier » (40.5b). Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No migration; no calendar changes, no composer, no group availability route; no fixing or extending the date, no reminder, no e-mail (40.6, 40.7); no change to JDR poll rules, DTOs, signals or tests; no new `'partie:'` handler; no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Propose by poll | ≥ 2 distinct slots + future deadline | 201 card with `poll`, no date, live for all | both/neither mode, 1 slot, duplicates, past deadline → 400 |
| Eligible vote | « Tous » member / limited `CONFIRMED` | accepted, summary updates live | — |
| Not eligible | member not inscribed (limited), stranger, other group | nothing written | 403 / 400 |
| After deadline / dated / closed | `now > expiresAt` | vote and withdraw refused | 400 French |
| Edit slots | host adds / removes a slot | kept slots keep votes, removed lose theirs, deadline updated | non-host 403, past deadline value 400 |
| Coexist | sign-up on an undated poll conjonction | accepted, eligibility follows `CONFIRMED` | — |
| Availability | candidate slot | `availableCount` from inscrits' declarations | — |
| Card / dialog | eligible viewer not voted | orange « Vote en cours », « Vote à faire » panel; host summary | — |
| JDR | any JDR poll | unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/poll/{poll.service.ts,poll.controller.ts,dto/,ports/}` -- `create` :52 (fixed 14-day `expiresAt`; add optional deadline), `castVote`/`withdrawVote` (add group eligibility/deadline via a new port), `setOptions` :~190 (2–40 bounds, reconcile by `optionKey` — reuse for edit), `toDto`; `poll.module.ts`, `src/ports/ports.module.ts` (binding model: `SEANCE_DATE_PORT`).
- `apps/api/src/events/events.service.ts` -- `createInTx` :170 (seance creation, `createSeancePoll` pattern linking `Seance.pollId`), `updateHosted`, `listCards`/`participantsOf` (add `poll` block, `availableCount`), `inscrireConjonction` (undated seance), `occupiedSpansOf`/`ownEventsOf`/`reminderRecipients`; add `eligibleVoters`.
- `apps/api/src/events/{group-events.service.ts,dto/create-event.dto.ts}` -- mode validation, orchestration, signals after commit; `src/availability/` (declarations of members, batched) for `availableCount`.
- `apps/api/src/permissions/permission.service.ts` (+ spec) -- `POLL_VOTE` cell for ralliement; group `POLL_READ` stays closed unless needed; `packages/shared/src/index.ts` -- `EventCardDto.poll`, `CreateEventDto`/`UpdateEventDto` poll fields.
- Tests: `poll.service.spec.ts`, `events.service.spec.ts`, `group-events.service.spec.ts`, `permission.service.spec.ts`, `test/characterization/{ralliement,permissions}.e2e-spec.ts` (matrix, vote refusals, live), 37.1 untouched.
- Web `features/events/`: `event-form/*` (toggle, slot list, deadline), `event-create/*`, `event-dialog/*` (panels, sheet slots), `event-card/*` + `event-card.util.ts` (badge/date line/situation), `events-api.service.ts`; tones ×3 + `theme-tone.service.spec.ts`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, §7.10; `palier-10-4-entrees.md` (what stays for 10.4).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- poll block, create/update poll fields
- [x] `apps/api/src/poll/` + `ports` (+ specs) -- optional deadline on create, group vote/withdraw rules through a port
- [x] `apps/api/src/events/` (+ specs) -- poll creation with the event, `eligibleVoters`, poll block with availability counts, edit of a poll conjonction
- [x] `apps/api/src/permissions/permission.service.ts` (+ spec) -- `POLL_VOTE` for group members
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- matrix, refusals, edit reconcile, coexistence, live
- [x] `apps/web/src/app/features/events/` -- poll mode in form, card, dialog panels, slots sheet (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- poll labels

**Acceptance Criteria:**
- Given a member proposes by poll, when it commits, then every member's tab shows « Date à voter · jusqu'au … » and the badge « Vote en cours », live.
- Given an eligible member, then the panel reads « Vote à faire… » until they have voted; the host sees responses, best slot and who has not answered, updating as votes arrive.
- Given a voter outside `eligibleVoters`, or after the deadline, then the server refuses the vote and nothing is written.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- A poll conjonction is created in one transaction (event, dateless seance with `pollId`, poll via `PollService.createInTx`); group `expiresAt` = end of the deadline day UTC; group slot guard 2–200, JDR 2–40 unchanged.
- `eligibleVoters` in `events/eligible-voters.ts`; vote and withdraw reach it through `GROUP_POLL_VOTE_PORT` (bound to `EventsService` in `PortsModule`), only for the ralliement family.
- `EventCardDto.poll` carries eligible ids, options with `availableCount` (inscrits free, from declarations, one batched read) and votes of eligible voters.
- Review patches: `/me/calendar` `votes-en-cours` excludes group polls until 40.5b; null poll fields give a French 400 and past candidate days are refused on create (not on update, kept slots may have passed); edit form accepts an unchanged past deadline.
- Not verified: Chrome check; the vote is reachable only through the API until 40.5b. A `/security-review` is advised (`POLL_VOTE` opened to group members). Pre-existing date failures unchanged.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | `dateText` strips the last character: « mars », « mai », « juin », « août » truncated | medium | `shortDayLabel(...).replace(/.$/, '')` removes a real letter for dot-less months | patch |
| 2 | blind, edge, verif | Edit form `valid()` blocks an unchanged past deadline the server accepts; no web test of poll edit | medium | host cannot fix lieu/heure after the vote ended; only e2e covers it | patch |
| 3 | edge | `pollOptions: null` / `pollDeadline: null` → TypeError 500; past candidate days accepted by the API | medium | `@IsOptional` lets null pass, service tests `=== undefined`; only the web refuses past slots | patch |
| 4 | verif | Group polls appear in `/me/calendar` `votes-en-cours` for every member | medium | query takes open polls of all own parties, group poll passes `VISIBLE_POLL_WHERE`; no vote UI before 40.5b | patch |
| 5 | blind, verif | `slot-availability.ts` copies the calendar's availability rules, no parity test | low | developer-only drift risk; deferred | defer |
| 6 | edge, blind | Card still reads « Date à voter · jusqu'au … » after the deadline, ended poll is a dead end | low | end states belong to fixing the date (40.6) and extending (40.7) | defer |
| 7 | blind | Member panel asks to vote but no button until 40.5b | low | consequence of the scope split decided by the user | reject |
| 8 | blind | Slot removal without confirmation; slots editable after the deadline | low | static hint shown; host-only; spec silent | reject |
| 9 | blind, edge | Local vs UTC day for the deadline | low | carried: 40.1 triage #10 | carried reject |
| 10 | blind | Vote eligibility check not under the Event lock | low | one stale vote after a concurrent unsubscribe, host-visible, self-healing | reject |
| 11 | blind | `votes` shared with every member; `availableCount` base differs from eligible voters | low | spec asks for votes in the DTO and counts of inscrits (FR10) | reject |
| 12 | edge | Ineligible voter cannot withdraw; FK 500 when a slot is removed mid-vote; availability read unbounded; members load failure shows « — » | low | rare or small-scale (4–20 members) | reject |
| 13 | blind | Duplicated constants, redundant 403, hard-coded colour, process/hygiene notes | low | style only | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: propose by poll with 3 slots, second member sees the orange badge and panel, host sees the summary; votes only through the API until 40.5b.
