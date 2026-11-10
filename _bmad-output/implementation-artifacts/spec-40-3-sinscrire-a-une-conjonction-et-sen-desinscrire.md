---
title: '40.3 — Sign up to a conjonction and unsubscribe'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: '1f72a2616cc903837867c15442500b758f1de880'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group member cannot say « I come » or « I no longer come » to a conjonction, so the host cannot count on anyone; and the hourly reminder still mails every member with the JDR « séance » wording, instead of the host and the registered people only (FR9, FR10, FR12).

**Approach:** The EventDialog offers sign-up and « Me désinscrire » (shared seance routes, group branch); sign-ups are written under the `Event` row lock; the card shows « Complet » to non-registered members when no place is left; the day-before reminder for a group goes to `reminderRecipients(seance)` with the new neutral e-mail #5.

## Boundaries & Constraints

**Always:** `SEANCE_INSCRIBE` and `SEANCE_UNSUBSCRIBE` become `ADMIN_AND_MEMBERS` in the ralliement policy (JDR cells and behavior untouched); routes stay `POST|DELETE scenarios/seances/:id/inscription`, which branch by family: JDR path unchanged (episodic only, mandatory capacity, frozen once dated, Seance lock, ScenarioDto response, 37.1 tests unchanged); group path answers the updated `EventCardDto`. Group path accepts only a `CAMPAGNE_EPISODIQUE` group (one-shot → 403 unavailable, as in 40.1/40.2), resolves party from the seance (no IDOR), and runs in one transaction under `SELECT … FOR UPDATE` on the `Event` row (before any count). Rules: capacity `null` = « Tous les membres », sign-up confirms, no limit; limited = first come first served, no waiting list, taken = host + inscriptions (host holds a place without a row), full → 409 French message; late sign-up allowed after the date is set (the date never moves); sign-up and unsubscribe refused (400, French) once the seance day is before today (UTC day key, same convention as 40.1/40.2); signing up twice or the host signing up = idempotent no-op returning the card; unsubscribing is free, idempotent, no-op for the host and for someone not registered. After commit: `emit(partie:{id})` and `PartieSignalsPort.notifyChanged` (home list). `reminderRecipients(seance)` lives in `events/`, one definition: group → host + inscriptions (all rows are confirmed until 40.4); any other family keeps its current recipients. For a group the hourly task sends a NEW template `conjonction-reminder` (closed `EmailTemplate` union, subject « Demain : « *Conjonction* » », body date · lieu, button « Voir la rencontre » to the group page, neutral vocabulary, common layout, sent through `EmailService`, failures logged never thrown); JDR and one-shot keep `session-reminder` and their recipients; `reminderSentAt` handling unchanged. Web, in `features/events/`: dialog situation panel offers « S'inscrire » to a non-registered, non-host member while not past (replaced by the written « Complet » when full); footer « Me désinscrire » for a registered non-host while not past, host keeps « Modifier »; buttons busy-guarded, server refusal shown in the window; participants list, « Ma situation » chip (« Je participe » / « Pas inscrit·e » / « J'y étais ») and the participation line update live from the list (no new handler). Card: grey badge « Complet » (existing grey tone) for a non-registered member when limited places are all taken and the event is not past; registered people and the host keep their normal badge. Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No reservation, `RESERVED`/`Inscription.status` or any migration (40.4); no poll, no e-mail other than #5; no waiting list; no change to JDR routes, DTOs, reminders or tests (37.1 unchanged); no new `'partie:'` handler; no dependency install; no change to the 40.2 edit rules except through the shared lock.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign up, all members | member, upcoming or dated event | 200 card, listed among participants, chip « Je participe », live for all | — |
| Sign up, limited | places left | 200, taken + 1 | — |
| Last place race | two members at once, one place | exactly one accepted | other 409 « complet » |
| Full | limited, taken = capacity, viewer not registered | card badge « Complet », no « S'inscrire » | 409 on direct call |
| Late sign-up | date already set, not past | accepted, date unchanged | — |
| Unsubscribe | registered non-host, not past | 200, place freed, live | past → 400 |
| Idempotence | already registered / host / not registered | card unchanged, no error | — |
| Past | seance day < today | no sign-up, no unsubscribe | 400 |
| Outsiders | stranger, other group's member, JDR route semantics, one-shot, seance of group B via another path | nothing written | 403 / 404 |
| Reminder | group event due in 24 h | e-mail #5 to host + inscrits only, once; JDR unchanged | send failure logged |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `EventCardDto`/`EventParticipantDto` (:727, from 40.2) already carry participants; no new action (cells change only).
- `apps/api/src/permissions/permission.service.ts` (+ spec) -- `SEANCE_INSCRIBE`/`SEANCE_UNSUBSCRIBE` cells (:164-165 JDR, :261-262 ralliement); denial matrix.
- `apps/api/src/events/events.service.ts` -- `inscrire` :660 / `desinscrire` :699 (JDR rules, Seance lock — leave intact), `updateHosted` (Partie → Event lock pattern from 40.2), `listCards`/`participantsOf`, `occupiedSpansOf`/`ownEventsOf` (group participants already host + inscriptions); add group sign-up/unsubscribe and `reminderRecipients`.
- `apps/api/src/events/group-events.service.ts` (+ `events.module.ts` export) -- group orchestration (right, one-shot refusal, past rule, signals after commit), returns the card.
- `apps/api/src/scenarios/scenarios.{controller,service}.ts` -- routes :147-153 and `inscrire`/`desinscrire` :788-852 resolve a scenario (`resolveScenarioOrThrow`): branch by family before it, delegate to `GroupEventsService`; module deps `scenarios.module.ts`.
- `apps/api/src/notifications/notifications.{service,module}.ts` -- `remindSeance` :106 (recipients, template, link); add `EventsModule` import, select event title and place; keep JDR path byte-identical in behavior.
- `apps/api/src/email/{email-template.enum.ts,email.service.ts,templates/}` -- add `conjonction-reminder` to union, `SUBJECTS`, `ACTION_LABELS`, `.hbs` (model: `group-invitation.hbs`, layout `layout.hbs`); email specs.
- Tests: `events.service.spec.ts`, `group-events.service.spec.ts`, `notifications.service.spec.ts`/`.integration.spec.ts`, `email.*.spec.ts`, `test/characterization/ralliement.e2e-spec.ts` (race test, matrix, idempotence), `permissions.e2e-spec.ts`; 37.1 characterization stays untouched.
- Web `features/events/`: `events-api.service.ts` (`inscrire`/`desinscrire`), `event-dialog/*` (panel button, footer, busy/error), `event-card/*` + `event-card.util.ts` (`eventBadge` « Complet », helpers `isFull`), specs in `partie-detail.spec.ts`; tones ×3 + `theme-tone.service.spec.ts`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.4, §7.7.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/permissions/permission.service.ts` (+ spec) -- open the two cells to group members -- single decider
- [x] `apps/api/src/events/{events.service.ts,group-events.service.ts,events.module.ts}` (+ specs) -- locked group sign-up/unsubscribe, `reminderRecipients`
- [x] `apps/api/src/scenarios/{scenarios.controller.ts,scenarios.service.ts}` -- family branch to the group path, JDR untouched
- [x] `apps/api/src/{email,notifications}/` (+ specs) -- template #5 and group recipients
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- matrix, last-place race, late, past, idempotence, denials, live signal
- [x] `apps/web/src/app/features/events/` -- API calls, dialog actions, « Complet » badge, live updates (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- sign-up, unsubscribe, full labels

**Acceptance Criteria:**
- Given a limited event with one place left, when two members sign up at once, then exactly one is accepted and the other sees « Complet ».
- Given a registered member, when they unsubscribe from an upcoming conjonction, then every member's list and open dialog update without reload.
- Given a group conjonction due within 24 h, then only the host and its inscrits get the neutral e-mail #5 once.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Shared routes `POST|DELETE scenarios/seances/:id/inscription` branch by party family in `ScenariosService` after `assert` and the seance lookup; the group branch (`GroupEventsService`) answers an `EventCardDto` (sign-up 201, unsubscribe 200). JDR path untouched.
- `EventsService.inscrireConjonction`/`desinscrireConjonction`: Event row lock before any count; taken places = host (no row) + inscriptions; idempotent no-ops still emit signals.
- `reminderRecipients` in `events/`; `NotificationsService` sends `conjonction-reminder` only to groups, one-shot and JDR keep `session-reminder`.
- « Complet » badge reuses the grey `done` tone with its own text. Departing members' sign-ups are cleaned by 40.8.
- Not verified: Chrome check (two members, last place, « Complet ») and e-mail #5 in Mailpit. Pre-existing date failures unchanged.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | edge, verif | `canSignUp`/`canUnsubscribe` ignore a null `card.seance`: button shown, click does nothing | low | `changeRoster` returns silently without a seance id; unreachable today (40.1 always creates the seance) but one-line fix | patch |
| 2 | verif | Hostless event (`ownerId` null) capacity count never tested | low | all unit/e2e cases have a host; ternary could regress unseen | patch |
| 3 | blind, edge, verif | Departing members keep inscriptions (place, participant, reminder) | medium | real (`PartiesService.leave` only deletes the Membership) but story 40.8 « Libérer places et votes de qui quitte le groupe » owns it | reject (planned 40.8) |
| 4 | blind | Pre-existing `ONE_SHOT` ralliement reminder keeps JDR wording (`session-reminder`) | low | pre-existing, not touched by this change; epic 41 reuses the neutral e-mails | defer |
| 5 | blind | Frozen matrix says « 200 card » while POST answers 201 | low | fix would edit the frozen spec | reject |
| 6 | blind, edge | No-op sign-up/unsubscribe still emits signals | low | harmless refetch, same as the JDR route | reject |
| 7 | blind, edge | Late sign-up after the reminder pass never gets the e-mail | low | `reminderSentAt` is once per seance by design (AD-12), JDR identical | reject |
| 8 | blind | Optional fields in `ReminderSeance`/`DueSeance`; whole `EventsService` injected; family check twice | low | developer-only style, no named divergence | reject |
| 9 | blind, edge | Stale dialog after a lost race (409) until the live reload | low | the winner's sign-up emits `partie:{id}` and reloads the list; only a dead SSE leaves it stale | reject |
| 10 | blind, edge | Local-day (web) vs UTC-day (API) for « passée »; `endDate` unused | low | carried: 40.1 triage #10; ranges are start = end | carried reject |
| 11 | blind | « Complet » badge reuses `status.scenario_passe` label key; muted text contrast | false | `StatusBadge` renders `s.text ?? tone[labelKey]`: the badge text is « Complet »; muted-token contrast is pre-existing | reject |
| 12 | blind | One route, two response shapes; redundant seance read | low | epic decision (shared routes), no discriminator needed per family | reject |
| 13 | edge, blind | Membership removed between `assert` and the transaction; card `undefined` after commit | low | microsecond window / event cannot vanish before epic 42 | reject |
| 14 | edge | Subject HTML-escaping of apostrophes | false | integration test asserts « Demain : « Catane d'automne » » in Mailpit | reject |
| 15 | verif, blind | Race e2e probabilistic; concurrency edit vs sign-up untested | low | lock order asserted in the unit test; edit shares the Event lock | reject |
| 16 | blind | Default `assert` mock in `scenarios.service.spec.ts` changed | false | the new branch reads `grant.partie` first; no expectation changed, 37.1 suites green | reject |
| 17 | blind | Formatting churn, `sprint-status` growth, English spec, empty log sections | low | repo/workflow conventions | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: two members, one signs up, the other's dialog updates; fill the last place, « Complet » on the third member's card; reminder e-mail in Mailpit.
