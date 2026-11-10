---
title: 'Scenario anti-spoil enforced server-side'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
baseline_commit: '7efa92f1bd137ec7173dc6f7886f248acef6e9e0'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Scenario anti-spoil (PRD FR-5/FR-6: a draft is invisible to players, an announced scenario shows no description/documents) is only a front-end rendering rule (AD-6 of palier 4). A player calling the API directly can list `BROUILLON` scenarios with their descriptions, seances, polls and documents, download documents of unreleased scenarios, join a draft or a past scenario, and read dates/polls of drafts through the calendar, next-session date, signals and announcements.

**Approach:** One shared definition of "hidden from players" in `permissions/`, applied by role (`grant.role === 'player'`; the MJ sees everything, unchanged) at every server read path. Web unchanged.

## Boundaries & Constraints

**Always:** Single definition (pure function + reusable Prisma `where` fragments in `permissions/`, no copies): a scenario is a **hidden draft** when `status = BROUILLON` and its partie is not `ONE_SHOT`. For a player: (1) hidden drafts are absent from `GET /parties/:id/scenarios`, their documents answer 404, `POST /scenarios/:id/participate` answers 404 on them, and `PASSE` participation answers 400; (2) their seances, polls (read, vote, withdraw), `mes-seances`, `inscriptions-ouvertes`, `votes-en-cours` and the `VOTE_EN_COURS_SANS_REPONSE` signal are ignored (polls: same 404/400 as an unknown poll); (3) `Partie.nextSessionDate/Slot` is the nearest upcoming span of non-hidden seances (for every viewer, MJ included), recalculated also when a scenario is opened; (4) `A_VENIR` scenarios (non-draft) are returned without `description`, `dureeHeures`, `dureeSeances`, seance `compteRendu`; title, seances, polls, inscriptions and `participants` stay; (5) scenario-scoped documents are served only for `COURANT`/`PASSE` scenarios (library documents `scenarioId = null` always); (6) **reminders (user decision after review):** the day-before reminder of a seance of a hidden draft goes to the owner only; once the scenario is opened, members are reminded as before (the 37.9 episodic e2e case must open its scenario first); (7) announcements scoped to a scenario that is not `COURANT`/`PASSE` are hidden (list and unseen), whole-partie announcements stay. **ONE_SHOT exemption (user decision):** its single scenario stays listed and its seances, dates and polls stay accessible to players, but while `BROUILLON` its content (description, durations, `compteRendu`, documents, scoped announcements) is masked exactly like (4)–(6). MJ behaviour is unchanged everywhere. Existing French messages and status codes reused (`Scénario introuvable`, `Poll introuvable`). Comments and errors in French.

**Never:** No web change. No other reminder-email change: template, data and the window are untouched. No change to `occupiedSpansOf`/available-slots (anonymous dates, AD-9) nor to `Partie.status`. No new role, no migration, no dependency install. The 37.1 characterization tests keep their expectations (they use ONE_SHOT or opened scenarios); only the two `permissions.e2e-spec.ts` poll tests that act on a never-opened draft of a campaign may change their setup (open the scenario first) — not their expected statuses.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Player lists | campaign with a draft and a COURANT scenario | only the COURANT one | — |
| MJ lists | same | both, unchanged | — |
| Player on announced scenario | A_VENIR | title, seances, polls, participants; no description/durations/compte rendu | — |
| Document of draft | player `GET /documents/:id` of a draft's document | 404 | no bytes |
| Library document | `scenarioId` null | served as today | — |
| Join | player `participate` on draft / PASSE | 404 / 400 | no write |
| Draft poll | player reads/votes a poll of a draft's seance | not listed; vote → same error as unknown poll | no vote stored |
| ONE_SHOT draft | player on the single BROUILLON scenario | listed, content masked, seances/polls usable | — |
| Reminder of a hidden draft | seance of a draft due within 24 h | only the owner is mailed | — |
| Next session | only seance with a date belongs to a draft | `nextSessionDate` null; becomes the date after `open` | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/scenarios/scenarios.service.ts` -- `findAllForPartie` L259-328 (comment "aucun filtrage"), `listDocuments` L212-224, `getDocumentFile` L883-904, `participate` L530-553, `toDto`/`toSeanceDto` (redaction), `open()` (add next-session recalculation), `loadSeances*`; `verifyScenarioBelongsToPartie` L875 (announcements creation, unchanged).
- `apps/api/src/poll/poll.service.ts` -- `findOpen` L89-96, `castVote` L98, `withdrawVote` L140 (role from `grant.role`; poll → `seance` back-relation → event → scenario status).
- `apps/api/src/events/events.service.ts` -- `ownEventsOf` L581-633 (`mes-seances`, `inscriptions-ouvertes`, receives `roles`), `recomputeNextSession` L440-473 (exclude hidden-draft seances).
- `apps/api/src/availability/availability.service.ts` -- `votes-en-cours` input L774-784 (`buildOpenPollsLayer`), uses `roles` map already resolved via `rolesOf`.
- `apps/api/src/parties/party-signals.service.ts` -- poll query L91-99 / L153-157 for the player list.
- `apps/api/src/announcements/announcements.service.ts` L73-89 and `account/account.service.ts` L130-150 -- scoped-announcement filters for players.
- New `apps/api/src/permissions/scenario-visibility.ts` (+ spec) -- `isHiddenDraft(status, kind)`, `isContentMasked(status, kind)` (ONE_SHOT draft or A_VENIR), `hiddenDraftSeanceWhere`, etc. `permissions/` is exempt from the owner-read sweep and importable by every layer.
- Specs to flip/extend: `scenarios.service.spec.ts` L802 (`listDocuments` "aucun filtre"), L865 (`getDocumentFile`), L1099 (`findAllForPartie` returns BROUILLON), L~1055 where-clause assertion; `announcements.service.spec.ts` L218; `test/characterization/permissions.e2e-spec.ts` L61-87, L134, L192-199 (poll on a never-opened campaign draft).

## Tasks & Acceptance

**Execution:**
- [x] `permissions/scenario-visibility.ts` (+ spec) -- the shared definition and Prisma fragments.
- [x] `scenarios/scenarios.service.ts` (+ spec) -- list filter, redaction, documents, participate, `open()` recalculation.
- [x] `poll/poll.service.ts`, `events/events.service.ts`, `availability/availability.service.ts`, `parties/party-signals.service.ts` (+ specs) -- poll/calendar/signal/next-session paths.
- [x] `announcements/announcements.service.ts`, `account/account.service.ts` (+ specs) -- scoped announcements.
- [x] `test/characterization/anti-spoil.e2e-spec.ts` (new) -- over HTTP, player vs MJ: draft absent from list, A_VENIR redacted, draft poll not listed/votable, `participate` 404/400, `nextSessionDate` rules, ONE_SHOT exemption (content masked, poll usable); `permissions.e2e-spec.ts` setup adjusted as stated.

**Acceptance Criteria:**
- Given a campaign draft, when a player calls any scenario, poll, calendar, signal, document or announcement read path, then no field of the draft (title, description, seance, date, poll, document, announcement) is returned.
- Given the MJ of the same partie, then every response is as before except `nextSessionDate/Slot` (see Always 3).
- Given the suites, then the 37.1 characterization tests pass unchanged (except the stated setup of two permissions e2e tests).

## Implementation Notes

- `permissions/scenario-visibility.ts`: pure predicates + Prisma fragments (`VISIBLE_SCENARIO_WHERE`, `VISIBLE_SEANCE_WHERE`, `VISIBLE_POLL_WHERE`, hidden-draft and released-announcement variants); every rule applies by role, MJ unchanged.
- Beyond the spec: `desinscrire` answers 404 for a player on a hidden-draft seance; `convertKind` recomputes `nextSessionDate/Slot` in its transaction (ONE_SHOT → campaign turns the draft into a hidden one); `recalculateNextSessionInTx` returns the new values.
- Intended MJ-visible effect: `nextSessionDate` ignores hidden-draft seances for everyone until the scenario is opened.
- Review patches: reminders of a hidden-draft seance go to the owner only (user decision); anti-spoil filters fail closed (`isSpoilRestricted`: anything but `mj`); `inscrire` answers 404 for a restricted role on a hidden draft; `open()` updates status and recalculates the next session in one transaction under the Partie lock; MJ date signals read the partie's own seances; `markAnnouncementRead` honours released announcements; real-DB integration spec of the visibility fragments (seanceless legacy polls kept). Re-run: unit 2020/2021 (1 deferred date failure), e2e 88/88, typecheck/api build/web build OK, lint 12 pre-existing errors.
- Orchestrator run before review patches: typecheck OK, unit 1994/1996 (2 deferred date failures), e2e 86/86 (new anti-spoil suite, 23 tests), api+web build OK, lint 12 pre-existing errors, prettier clean on touched files.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge, verif-gap | Reminder e-mails give players the date of a hidden-draft seance | high | `processDueReminders` filters only on date window; spec Never forbade the change | intent_gap → user decided: owner-only reminder; spec amended; patched |
| 2 | blind, edge | `isPlayerRole` / `ownEventsOf` fail open on an unknown or missing role | high | `role === 'player'` gating; availability already fails closed | patch |
| 3 | blind, edge | `inscrire` answers 400 on a hidden draft (existence oracle) vs 404 elsewhere | medium | Player can tell existing draft seance from unknown id | patch |
| 4 | blind, edge | `open()` recomputes next session outside a transaction and without the Partie lock | medium | Concurrent `chooseDate` can overwrite; failure leaves status changed | patch |
| 5 | edge | MJ signals `AUCUNE_DATE_NI_VOTE`/`PROCHAINE_SEANCE_CONNUE` change with `nextSessionDate` | medium | Shared persisted value now excludes drafts for the MJ too | patch |
| 6 | edge | `markAnnouncementRead` probes/marks announcements of unreleased scenarios | medium | No `RELEASED_ANNOUNCEMENT_WHERE` in that path | patch |
| 7 | edge | `NOT` over the one-to-one back relation may drop seanceless legacy polls; untested | medium | No test with a seanceless poll | patch |
| 8 | blind | Unchecked `.expect(201)` on e2e announcement setup; docs/security.md outdated | low | Direct fixes | patch |
| 9 | edge | Persisted `nextSessionDate` from before the change stays until a recalculation | low | No production data yet; recorded in docs/security.md | reject |
| 10 | edge | Practical info (`heureRdv`, `lieu`, `notePratique`) and `resumeFin` not redacted for A_VENIR | low | Spec lists the redacted fields; practical info is scheduling data | reject |
| 11 | blind | `participate` PASSE 400 is scope creep | low | Required by the spec's Always item 1 | reject |
| 12 | blind | Extra query load / nested relation filters | low | Small tables; no measured issue | reject |
| 13 | blind | Realtime events on draft edits reach player clients | low | Clients refetch and receive nothing new; no content in the event | reject |
| 14 | blind | Redundant predicates; web not updated; brittle `where`-shape unit asserts | low | Cosmetic; contract unchanged (fields already nullable) | reject |
| 15 | edge | e2e `permissions` setup opens scenario A once in `beforeAll` | low | Statuses expected unchanged; spec allowed a setup change | reject |
| 16 | blind | `occupiedSpansOf` still includes draft dates | low | Anonymous spans, AD-9, excluded in the spec | reject |

## Design Notes

The rule lives next to `PermissionService` because both answer "what may this role see": services receive the role from `assert` and pass it to the shared fragments, so a new read path has one obvious helper to reuse. `nextSessionDate` is one persisted value shared by all viewers, hence the choice to exclude hidden drafts for everyone (the MJ already sees draft dates in the scenario list).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; e2e green incl. the new suite.
- `docker compose exec api pnpm build` and `docker compose exec web pnpm build` -- expected: OK.
