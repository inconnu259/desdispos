---
title: '40.7 — Extend the vote and remind the day before the deadline'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: '438263b07a239a3bf2ab6173fbaa7218baec07b3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-6-fixer-la-date-dune-conjonction.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group poll ends silently at its deadline: the host cannot push it back when people are still missing, and the late voters are never nudged (FR11, FR12, UX-DR12).

**Approach:** The host extends the deadline from the dialog (new capability, group only). The hourly notification task sends, once, the day before the deadline, e-mail #6 to the eligible voters who have not voted; extending re-arms it.

## Boundaries & Constraints

**Always:** Additive migration (`pnpm exec prisma` in the container): `SessionPoll.relanceSentAt DateTime?`. New route `PATCH parties/:id/poll/:pollId/extend` (body: `expiresAt` as `YYYY-MM-DD`, the new deadline day) and new action `POLL_EXTEND` in the closed `PermissionAction` union: ralliement `ADMIN_AND_MEMBERS` + host-only rule in `PermissionService.assert`, JDR `NOBODY` (capability absent from JDR, not exposed there, JDR polls, DTOs and tests unchanged). Group `CAMPAGNE_EPISODIQUE` only (one-shot → 403). Rules, in one transaction under the same locks as 40.6 (Partie then Event row): the poll is `OPEN`, belongs to a conjonction of the party whose date is not set (else 400 French); the new day is strictly after the current deadline day and not before today (else 400); extending is allowed after the deadline has passed while the poll is still open and undated (votes then reopen, as `expiresAt` is the only gate); the new `expiresAt` = end of that day UTC, like creation; `relanceSentAt` is reset to null. `PollService` stays the only writer of `SessionPoll` (reach `events/` through a port as in 40.5/40.6). After commit: `emit(partie:{id})`, `PartieSignalsPort.notifyChanged`. Reminder: the existing hourly `NotificationsService` task sends e-mail #6 once per poll, during the day before the deadline day (`expiresAt − 48 h ≤ now < expiresAt − 24 h`, UTC — verify the arithmetic on the end-of-day convention), only for polls that are `OPEN`, belong to a group conjonction whose seance is undated and have `relanceSentAt` null; recipients = `eligibleVoters(event)` who have no `PollVote` on the poll (one batched read, never per poll or voter); then it writes `relanceSentAt` (guarded update, also when there is no recipient). Template #6 (closed `EmailTemplate` union, common layout, neutral vocabulary, `EmailService`, failures logged never thrown): subject « Plus qu'un jour pour voter : « *Conjonction* » », button « Voter dans le calendrier » to `/parties/:id/guild-calendar`. No reminder for a dated or closed poll, for JDR or one-shot polls; no digest, no other reminder. Web, in `features/events/`: the host panel button « Prolonger le vote » (while the poll is open and undated, deadline passed included) opens the confirmation n° 6 (same pattern as 40.6): « « *Conjonction* » — le vote se termine le *date*. », field « Nouvelle échéance » (native date, minimum the day after the current deadline), text « Les personnes qui n'ont pas encore voté seront relancées la veille de la nouvelle échéance. », « Renoncer » · « Prolonger », busy-guarded and not closable mid-request, server refusal shown; on success the dialog follows the live card. Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No change to JDR poll routes, deadlines or reminders (the 14-day JDR default stays); no reminder other than #6, no digest; no fixing or reopening a date (40.6 is final); no new `'partie:'` handler; no dependency install; no migration beyond `relanceSentAt`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extend | host, open undated poll, new day after current | `expiresAt` moved, `relanceSentAt` null, live for all | — |
| Extend after expiry | deadline passed, poll still open | accepted, votes reopen | — |
| Not host | member, admin non-host, stranger, other group, one-shot, JDR poll | nothing written | 403 / 404 |
| Bad input | same or earlier day, past day, dated or closed poll, other party's poll | nothing written | 400 French |
| Reminder | eve of the deadline | e-mail #6 to eligible non-voters only, once, `relanceSentAt` set | send failure logged |
| After extension | new deadline | reminder sent again the eve of the new deadline | — |
| No reminder | date fixed, poll closed, everyone voted, JDR poll | nothing sent (`relanceSentAt` set when no recipient) | — |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `SessionPoll` :316 (add `relanceSentAt`), migrations dir (last `20261017120000_inscription_status`).
- `apps/api/src/poll/{poll.service.ts,poll.controller.ts,ports/}` -- group branch pattern of `choose` (40.6: Partie → Event locks, `GroupPollChoosePort`, `lockConjonction`) and `create`'s end-of-day deadline; add `extend` and its port; `src/ports/ports.module.ts`.
- `apps/api/src/events/{events.service.ts,group-poll-choice.service.ts,eligible-voters.ts}` -- host check, `eligibleVoters`, poll/vote reads; place the reminder recipients definition here (`reminderRecipients` style, one definition).
- `apps/api/src/permissions/permission.service.ts` (+ spec), `packages/shared/src/index.ts` -- `POLL_EXTEND` cells, `HOST_ONLY_ACTIONS`, extend DTO type.
- `apps/api/src/notifications/notifications.{service,module}.ts` -- hourly task: add the vote-reminder pass beside `remindSeance` (guard model: `isRunning`, guarded `updateMany` for `reminderSentAt`).
- `apps/api/src/email/{email-template.enum.ts,email.service.ts,templates/}` -- template #6 (models: `conjonction-reminder.hbs`, `conjonction-date-fixee.hbs`).
- Tests: poll/events/permission/notifications (unit + `notifications.integration.spec.ts`)/email specs, `test/characterization/{ralliement,permissions}.e2e-spec.ts` (matrix, extension re-arm, reminder once), 37.1 and `reminders.e2e-spec.ts` untouched; derive all dates from today.
- Web `features/events/`: `event-dialog/*` (host panel button), model `date-fix-dialog/*` (new `extend-vote-dialog/`), `events-api.service.ts` (`extend` call), `event-card.util.ts`; tones ×3 + `theme-tone.service.spec.ts`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, §7.9.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/` + `packages/shared/src/index.ts` -- migration, `POLL_EXTEND`, extend DTO type
- [x] `apps/api/src/poll/` + `ports` + `permission.service.ts` (+ specs) -- locked extend through a port, host-only rule
- [x] `apps/api/src/events/` + `notifications/` + `email/` (+ specs) -- reminder recipients, hourly pass, template #6
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- matrix, re-arm after extension, reminder once and only to non-voters
- [x] `apps/web/src/app/features/events/` -- « Prolonger le vote » and confirmation n° 6 (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- confirmation labels

**Acceptance Criteria:**
- Given an open group poll, when the host extends the deadline, then `expiresAt` moves, `relanceSentAt` is cleared and every member's panel shows the new deadline live.
- Given the eve of a poll's deadline, then the eligible members who have not voted get e-mail #6 once; voters, the host's already-voted case and dated or closed polls get nothing.
- Given the deadline was extended after a reminder, then a new reminder goes out the eve of the new deadline.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Route `PATCH parties/:id/poll/:pollId/extend` (`PollController.extend` → `PollService.extend`), même schéma que `choose` : cellule de rôle `POLL_EXTEND` sur `{ partieId }` (ralliement `ADMIN_AND_MEMBERS`, JDR `NOBODY`), puis `GroupPollExtendPort.assertCanExtend` (`GroupPollExtensionService` dans `events/`, lié par `PortsModule`) : rencontre isolée 403, sondage sans conjonction de la partie 400, non-hôte 403 par `PermissionService.assert(POLL_EXTEND, { eventId })`. `POLL_EXTEND` est dans `HOST_ONLY_WHEN_EVENT_TARGETED` (comme `POLL_CHOOSE`) et non dans `HOST_ONLY_ACTIONS` : la route commence par une cible `{ partieId }`.
- Une transaction : `lockConjonction` (Partie puis Event), date non fixée, sondage relu (`OPEN`, de la partie), nouveau jour strictement après le jour d'échéance actuel, `expiresAt` = fin du jour UTC, `relanceSentAt` remis à null. Le jour invalide ou passé est refusé avant la transaction. `PollService.updateInTx` (édition 40.2) remet aussi `relanceSentAt` à null quand l'échéance change.
- Relance : `NotificationsService.processVoteReminders` (après les rappels de séance, indépendante : `try/finally`, ne lève jamais) — une lecture groupée des sondages `OPEN`, `relanceSentAt` nul, `expiresAt` dans `]maintenant + 24 h, maintenant + 48 h]`, séance sans date, partie `CAMPAGNE_EPISODIQUE` de la famille ralliement ; destinataires = `EventsService.voteReminderRecipients` (`eligibleVoters` moins les votants) ; marque `relanceSentAt` par `updateMany` gardé (statut, marque, `expiresAt` lus), y compris sans destinataire. Arithmétique : échéance = fin du jour D UTC (D 23:59:59.999) → fenêtre = jour UTC D−1 (à 1 ms près), jamais le jour D lui-même.
- La tâche écrit `relanceSentAt` directement (précédent : elle écrit déjà `Seance.reminderSentAt`) ; `PollService` reste le seul écrivain pour le reste de `SessionPoll`.
- Web : `ExtendVoteDialog` (patron de `DateFixDialog`), bouton « Prolonger le vote » dans le panneau de l'hôte (`canExtendVote`), `extendMinKey` = max(lendemain de l'échéance, aujourd'hui), `EventsApiService.extend`, clés `partie.ralliement_event_extend_*` dans les trois tons (cinq neutres + repli d'erreur).
- Non vérifié : contrôle manuel Chrome / Mailpit. Échecs préexistants sans rapport : `calendar-view.spec` (2) et `parties.service.spec` (1), dates codées en dur.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | Mail #6 says « se termine demain » with no date | low | ambiguous when read on the deadline day or across time zones; template and payload fix | patch |
| 2 | blind, edge | Reminder lands about 01:00–02:00 French time and fires right after creation or extension when the deadline is within 48 h | low | follows the specified window (`expiresAt − 48 h ≤ now < expiresAt − 24 h`); send-time tuning is a product choice | defer |
| 3 | blind, edge | Duplicate #6 if the mark fails or two instances run | low | same pattern as the day-before session reminder (inherited) | reject |
| 4 | edge | Null `expiresAt`, no upper bound on the new deadline | low | group polls always carry a deadline; a far deadline is the host's choice | reject |
| 5 | blind, edge | Local vs UTC day for the dialog minimum | low | carried: 40.1 triage #10 | carried reject |
| 6 | blind | Members not told when a vote is reopened | low | spec: no other e-mail (« aucune autre relance ») | reject |
| 7 | blind, edge | Extension during sending, host check outside the lock, cron downtime without catch-up | low | microsecond or rare windows | reject |
| 8 | blind | Tautological window unit test; event-dialog test name; no inline feedback on invalid date; missing `SessionPoll` index; English « Poll » wording; naming | low | the window is also asserted on the query and in integration; cosmetic | reject |
| 9 | blind, edge | Orphan poll when the host account is gone | low | already deferred in 40.6 | reject |
| 10 | blind, edge | Spec drift (`HOST_ONLY_WHEN_EVENT_TARGETED`), sprint/process notes | low | documented in the Implementation Notes; conventions | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` (or the repo's migration flow) -- applies; `pnpm typecheck` no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: host extends from the dialog; reminder e-mail #6 in Mailpit after setting a deadline for tomorrow and running the task.
