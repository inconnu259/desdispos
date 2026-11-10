---
title: '43.2 — Erase my account'
type: 'feature'
created: '2026-10-19'
status: 'done'
baseline_commit: '44dd8a5813097dccf3462fb0a8700376906cf7e9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-43-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-43-1-voir-ce-que-leffacement-de-mon-compte-emporterait.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The danger zone of story 43.1 previews what leaving would destroy, but the account cannot actually be erased, and a naive user delete would leave orphan groups and hostless upcoming events (FR7).

**Approach:** `DELETE /me` verifies the password through `AuthService`, then in ONE transaction deletes the owned JDR parties, applies the existing departure procedure to every ralliement membership (group deleted when no admin remains), cuts every session and deletes the user; e-mails, real-time and cookie clearing follow the commit. The dialog's red button becomes live and ends on the public login page with a confirmation.

## Boundaries & Constraints

**Always:** `DELETE /me`, JSON body `{ password }`, no id anywhere, caller = session user, `@Throttle` 5/min like the other auth routes. The password is verified by a new `AuthService` method (argon2, same 401 as `changePassword`); wrong password = 401 and nothing written. One `prisma.$transaction`: (1) delete owned JDR parties; (2) for each other membership, sorted by party id: JDR = delete the membership; ralliement = the SAME departure code as `PartiesService.leave()`, extracted so it runs on a given `tx`, with a new cause `ACCOUNT_DELETION` that confirms last-admin deletion without asking and applies to isolated evenings too; (3) `AuthService.revokeSessions(tx, userId)`; (4) delete the user. A group keeping another admin survives, its upcoming hosted events are cancelled (42.1 procedure), its past events show "compte supprimé". Only after commit: e-mail n° 7 for each cancelled event (host name captured before deletion and passed to the mailer), real-time emissions (departure or party-deleted per party, to remaining members), session cookie cleared and session destroyed. Files follow the existing rule for deletions: none are unlinked (a deleted party leaves its files today); note it in Implementation Notes. Web: the red button is enabled once the password is non-empty, sends it, shows French errors in the dialog (wrong password, other failure) and stays open; on success it closes, clears the local user and navigates to `/login` with a themed "account erased" notice. `PartiesService.leave()` behaviour and its tests stay unchanged.

**Never:** No delete cascade relied on to remove a group a second admin keeps. No file unlinking. No change to 43.1's preview rules. No second password check path outside `AuthService`. No e-mail or emission inside the transaction. No dependency added.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wrong password | bad `password` | nothing changes, session kept | 401 |
| Missing password | empty body | nothing changes | 400 |
| Sole admin | only ADMIN of a group or isolated evening | group deleted with members and events | — |
| Admin among others | another ADMIN exists | group kept, membership gone, `ownerId` emptied | — |
| GM | owns JDR parties with players | parties deleted with characters | — |
| Upcoming host | hosts upcoming event in a surviving group | event cancelled, e-mail n° 7 after commit | mail failure logged only |
| Past host | hosted a past event | event kept, host shown as deleted | — |
| Plain member | member of groups and quests | memberships and registrations/open votes gone | — |
| Other accounts | any other user | data, sessions and groups untouched | — |
| Sessions | user has several sessions | all cut; caller lands logged out | — |
| Failure mid-way | an error inside the transaction | everything rolled back, account intact | 500 |
| Throttle | 6th attempt in a minute | refused | 429 |

</frozen-after-approval>

## Code Map

- `apps/api/src/parties/parties.service.ts` -- `leave()` (l.581): extract the locked transaction body into a `tx`-taking method and the post-commit part into a reusable one; `LeaveCause` (l.131) gains `ACCOUNT_DELETION`; `deleteGroupOfLastAdmin`, `emitDeparture`, `emitPartieDeleted`, `lockPartie` already exist. Add the account-deletion entry points here (owned JDR + memberships), returning what must be emitted/mailed after commit.
- `apps/api/src/auth/auth.service.ts` -- add `verifyPassword(userId, password)` (pattern of `changePassword`, l.299); `revokeSessions(tx, userId)` (l.276) exists.
- `apps/api/src/account/account.{controller,service,module}.ts` -- `DELETE /me` (`@Throttle`, `@Req`), orchestration in `AccountService`; module must import `PartiesModule` and `EventsModule` (exports `EventCancellationMailer`).
- `apps/api/src/events/event-cancellation-mailer.service.ts` + `events.service.ts` `cancellationNotice` (l.1023) -- optional `actorName` so the e-mail still names a deleted host.
- `apps/api/src/account/dto/` -- new DTO `{ password }` like `change-password.dto.ts`.
- Specs: `parties.service.spec.ts` (leave unchanged), `account.*.spec.ts`, `auth.service.spec.ts`; e2e next to `characterization/account-deletion-impact.e2e-spec.ts` with `harness.ts`.
- `apps/web/src/app/core/account/account.service.ts` -- `deleteAccount(password)` (`http.delete` with `body`); `core/auth/auth.service.ts` `currentUser`.
- `apps/web/src/app/features/account/delete-account-dialog/*` and `account.ts` -- enable the button, call, errors, navigation (`logout()` at l.~375 navigates to `/login`).
- `apps/web/src/app/features/auth/login/login.{ts,html}` -- read `?compte=efface` and show the notice; tone files (3 themes) + `theme-tone.service.spec.ts` lists (`NEUTRAL_KEYS`, register checks).
- Do not touch the Prisma schema or `leave()` HTTP behaviour.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/parties/parties.service.ts` -- extract departure into tx-taking + after-commit parts; add `ACCOUNT_DELETION`; add account-deletion entry points -- one procedure (AD-17)
- [x] `apps/api/src/auth/auth.service.ts` -- `verifyPassword`
- [x] `apps/api/src/events/*` -- optional `actorName` in notice and mailer
- [x] `apps/api/src/account/*` -- DTO, route, service orchestration, module imports
- [x] API unit + e2e tests -- every matrix row, plus `leave()` characterization unchanged
- [x] `apps/web` -- service, dialog, account page, login notice, 3 tone files and tone-spec lists, specs
- [x] `docs/checklist.md` real-time item answered in Implementation Notes

**Acceptance Criteria:**
- Given the correct password, when the user confirms, then their data is gone, they are logged out on `/login` with a confirmation, and no group with a remaining admin was removed.
- Given a wrong password, when they confirm, then the dialog stays open with an error and the account is intact.
- Given an upcoming hosted event in a surviving group, when the account is erased, then it is cancelled and its registrants are mailed once, after commit.

## Implementation Notes

- `leave()` keeps its HTTP behaviour: its transaction body became `departGroupInTx` and its post-commit part `afterDeparture`, both reused by the account erasure (`eraseMembershipsInTx`, `announceAccountErasure`). `LeaveCause` gained `ACCOUNT_DELETION`; `leave()` itself refuses it at the type level.
- Throttle: 5 per minute on `DELETE /me`, asserted through the decorator metadata (unit test); the e2e harness does not exercise rate limiting.
- Files: none unlinked (covers, portraits stay on disk, like any party deletion today). Logged in `deferred-work.md`.
- Real-time (`docs/checklist.md`): remaining members get `partie:` / `user:` emissions after commit (departure or party-deleted); the web page of the erased user needs none, it logs out.
- E-mail n° 7 receives the host's display name read before the transaction (`actorName`), so it still names a deleted host.
- Mailer/notice calls keep their old argument shape when no name is given (existing unit tests unchanged).
- Verification: api typecheck clean; api unit 2803 pass, 1 known date-dependent failure (`parties.service.spec` UNAVAILABLE slot); api e2e 366 pass (6 new in `account-deletion.e2e-spec.ts`); web 3636 pass, 3 date-dependent failures (`calendar-view.spec` x2 known, `calendar-week-view.spec` hardcoded 2026-11-03 week, newly reached by the date, untouched by this change). Prettier clean on touched files. Not done: visual check (Chrome/Mailpit, 3 themes), `/security-review`, `/code-review`.

## Spec Change Log

## Review Triage Log

Inline self-review (no reviewer subagents launched: not requested by the user). No finding routed to patch, bad_spec or intent_gap.

| Finding | Verdict | Evidence |
|---------|---------|----------|
| Personal files (portraits, covers) stay on disk after erasure | medium | Real but pre-existing rule of every cascade deletion; spec chose to follow it. Deferred and flagged to the user. |
| `connect.sid` cookie name hard-coded in the controller | low | It is express-session's default and `main.ts` sets no name; a test asserts it. |
| Unauthenticated answers 403 | false | Repo-wide guard behaviour, same as 43.1. |
| Deadlock between two simultaneous erasures sharing groups | low | Partie locks are taken in id order inside each transaction; a deadlock would roll back and surface as 500 with nothing changed. |
| Visual/Mailpit check not done | maybe-false | Claude in Chrome not connected; to do before merge. |

## Design Notes

- Files: the spec asks for "the existing rule for deletions"; today a party delete unlinks nothing (covers, portraits stay on disk), so none are unlinked here. This leaves personal files orphaned: to be logged in `deferred-work.md` and flagged to the user.
- The mailer is called with the host's `displayName` read before the transaction because the user no longer exists after commit.
- Reads of the 43.1 preview and this deletion share no code on purpose; the preview only informs.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- expected: green apart from the 1 known date-dependent unit failure; characterization tests unchanged
- `docker compose exec web pnpm test` -- expected: green apart from the 2 known date-dependent failures

**Manual checks (if no CLI):**
- Chrome + Mailpit: erase a throwaway account hosting an upcoming conjonction in a shared group: e-mail n° 7 received, group kept, login notice shown in each theme.
