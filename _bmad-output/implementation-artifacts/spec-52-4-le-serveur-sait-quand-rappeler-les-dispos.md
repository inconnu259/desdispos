---
title: 'Story 52.4 — The server knows when to remind about availability'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '42e415344933004261abfe8dbc99a0e4dcc2557b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-52-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing tells a member of an active party that no availability is declared for the coming weeks, and there is no account preference to silence such a reminder. The reminder must be one server-side rule, the same on every device, counted once.

**Approach:** Add `User.availabilityReminder` (default true), a port `ActivePartiesPort` implemented by `EventsService`, `AvailabilityService.reminderDue(userId)` as the only definition of the reminder, `GET /me/availability-reminder` → `{ show }`, the preference on `PATCH /me/preferences`, and a `user:{id}` emission after every declaration write and preference change. Server and shared types only; the web screens come in 52.5 and 52.6.

## Boundaries & Constraints

**Always:**
- `schema.prisma`: `availabilityReminder Boolean @default(true)` on `User`, comment in French like `hideFinishedParties`; additive migration produced with `docker compose exec api pnpm prisma migrate dev --name user_availability_reminder` (binary already present, no install) and committed under `apps/api/prisma/migrations/`; no data backfill.
- `packages/shared/src/index.ts`: export `AVAILABILITY_REMINDER_DAYS = 28` (a value, not a type), type `AvailabilityReminderDto { show: boolean }`, and `availabilityReminder: boolean` on `AuthUser`, filled by `users/to-auth-user.util.ts`. Every fixture building an `AuthUser` (api and web) gets the field.
- Port `apps/api/src/availability/ports/active-parties.port.ts` (token `ACTIVE_PARTIES_PORT`): `hasActivePartie(userId): Promise<boolean>`, true if the user owns (GM, host) or is a member of at least one party, JDR or rally, active per `partieStatus()` + `isPartieActive()`; a pending invitation does not count; implemented by `EventsService` with `progressByPartieIds` (one batched read, never one query per party); bound in `ports/ports.module.ts`. `availability/` imports neither `events/` nor `parties/`.
- `AvailabilityService.reminderDue(userId)` is true iff the preference is true AND `hasActivePartie` AND none of the user's own unexpired declarations (`expiresAt > now`, availability and unavailability alike) overlaps the window from today (included) to today + 27 days (included), via `declarationOverlapsRange` (a recurrence counts as soon as one day falls in the window). "Today" is `todayKeyUtc()`; bounds read like `getMyCalendar` (`parseDateOnly`, UTC start/end of day). Synthetic session unavailability (`getSeanceDerivedUnavailability`) does not count. Recomputed on each read, no scheduled job, no new timezone logic.
- `GET /me/availability-reminder` → `{ show: reminderDue(user.id) }`, controller `availability/me-availability-reminder.controller.ts` declared in `AvailabilityModule`, `AuthenticatedGuard`, no parameter (only your own reminder). `GET /me/party-signals` unchanged and never reads the preference.
- `UpdatePreferencesDto` accepts `availabilityReminder` (`@IsOptional()`, `@IsBoolean()`); `PATCH /me/preferences` writes it and returns the updated `AuthUser`; a non-boolean is a 400.
- Realtime: `emitForUser()` also emits `userTopic(userId)`, after each create, batch, update, delete and split, outside any transaction and never failing the write; `AccountService.updatePreferences` emits `user:{userId}` when, and only when, the DTO carries `availabilityReminder`. No new channel.
- Comments and error messages in French.

**Never:** a web change beyond fixtures; a scheduled job; reading the user's timezone; installing a dependency; touching `getSeanceDerivedUnavailability`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Due | Preference on, active party, no declaration | `{ show: true }` | N/A |
| Covered | A declaration inside the window; one on day 27; one on day 28 | `false`; `false`; `true` | N/A |
| Recurrence | Falls in the window / does not | `false` / `true` | N/A |
| Silenced | `PATCH { availabilityReminder: false }` | `false`, `AuthUser` carries `false` | Non-boolean → 400 |
| No active party | Finished, cancelled, past isolated evening, pending invitation only | `false` | N/A |
| Expired / synthetic | Expired declaration; only a dated session's unavailability | `true` | N/A |
| Midnight | Clock just before / after midnight UTC | Window slides by one day | N/A |
| Anonymous | No session | 401 | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `User` model (L15-40, `hideFinishedParties` is the pattern); `prisma/migrations/` (last: `20261102120000_event_game_envy`).
- `packages/shared/src/index.ts` -- `AuthUser` (L53+, `hideFinishedParties` L66); `partieStatus`/`isPartieActive` (L402/409) are the only status definitions.
- `apps/api/src/users/to-auth-user.util.ts` -- single `AuthUser` assembly point (explicit field list).
- `apps/api/src/account/{account.service.ts,account.module.ts,dto/update-preferences.dto.ts}` -- `updatePreferences` (L117); needs `RealtimeEventsService` (realtime module is global).
- `apps/api/src/availability/availability.service.ts` -- `emitForUser` (L109), `getMyCalendar` (L744, same `expiresAt > now` read), `parseDateOnly`, `declarationOverlapsRange` (L801); constructor injects ports by token.
- `apps/api/src/availability/ports/` -- `own-events.port.ts` is the template; `apps/api/src/ports/ports.module.ts` binds tokens with `useExisting: EventsService`; `ports/layer-imports.spec.ts` guards the layering.
- `apps/api/src/events/events.service.ts` -- `progressByPartieIds` (L1935); `events/datable-seances.service.ts` shows the owned-or-member party read; `events/day-key.ts` -- `todayKeyUtc`.
- `apps/api/src/availability/me-calendar.controller.ts` -- controller template; `availability.module.ts`.
- Fixtures with `hideFinishedParties:` -- `common/test-utils/fixtures.ts`, `auth.service.spec.ts`, `local.strategy.spec.ts`, `session.serializer.spec.ts`, `to-auth-user.util.spec.ts`, `account.*.spec.ts`, and web specs (typecheck lists them).
- `apps/api/test/characterization/` -- `harness.ts` and `my-datable-seances.e2e-spec.ts` as the e2e template.

## Tasks & Acceptance

**Execution:**
- [x] `schema.prisma` + migration -- field and additive migration via the Docker command
- [x] shared `index.ts`, `to-auth-user.util.ts`, fixtures -- constant, DTO type, `AuthUser` field
- [x] port file, `EventsService.hasActivePartie`, `ports.module.ts` -- implement and bind
- [x] `availability.service.ts` -- `reminderDue`, `userTopic` in `emitForUser`; `me-availability-reminder.controller.ts` + module
- [x] `update-preferences.dto.ts`, `account.service.ts` -- field, emission on change only
- [x] unit specs -- `availability.service.spec.ts` (`reminderDue` cases of the matrix incl. midnight with a frozen clock, `emitForUser` emits `user:{id}`), `events.service.spec.ts` (`hasActivePartie`: active owned JDR, active group as member, finished, cancelled, past isolated evening, pending invitation), `account.service.spec.ts` (emits with the field, not without), `update-preferences.dto.spec.ts`
- [x] e2e `availability-reminder.e2e-spec.ts` -- 401; true; false after a declaration then true after deleting it; false after the preference; false without an active party; another user's declarations change nothing; `party-signals` identical either way

**Acceptance Criteria:**
- Given a member of an active party with no declaration, when they read `GET /me/availability-reminder`, then `{ show: true }`; after declaring inside the next 28 days, `{ show: false }`.
- Given `docker compose exec api pnpm typecheck`, `pnpm test` and the e2e suite, then all pass and every web fixture compiles with the new field.

## Implementation Notes

- Implemented directly (no subagent). Migration `20261107120000_user_availability_reminder` (additive column, default true). Port `ActivePartiesPort` bound in `PortsModule`; `EventsService.hasActivePartie` reads owned-or-member parties not yet closed, then `progressByPartieIds` in one batch. `AvailabilityService.reminderDue`, `emitForUser` with a separate guarded `user:` emission, `MeAvailabilityReminderController`; `AccountService.updatePreferences` emits `user:{id}` only when `availabilityReminder` is in the DTO.
- Migration deviation to know: `prisma migrate dev` refused to run — it wanted to RESET the dev schema because the already-applied migration `20261010140000_seance_reminder_sent_at` was modified afterwards. The reset was declined (data loss). The SQL was computed read-only with `prisma migrate diff --from-config-datasource --to-schema` (a single `ALTER TABLE ... ADD COLUMN`), written into the migration folder and applied with `prisma migrate deploy`. A fresh clone is unaffected; the checksum drift on that older migration is pre-existing and still needs a decision.
- Matrix deviation: the frozen matrix says 401 without a session; `AuthenticatedGuard` answers 403 across the repo, so the e2e asserts 403.
- `availability/` cannot import `events/day-key`, so "today" is the same `toISOString().substring(0, 10)` expression, commented.
- Verification: API typecheck clean; API unit 3399 pass, 1 fail (`parties.service.spec` AD-9 test, fixed date 2026-09-20 now past: it passes with the clock set to 2026-09-10); API e2e 604 pass; web 4752 pass, 2 fail (the fixed-date rail tests).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route / evidence |
|---|--------|---------|---------|------------------|
| 1 | Edge | `PATCH { availabilityReminder: null }` passes `@IsOptional()`, reaches Prisma on a non-nullable column (500) and trips the emit gate | high | patch — `@ValidateIf(v !== undefined)` + `@IsBoolean()` makes `null` a 400; DTO unit test and e2e case added |
| 2 | Blind, Edge | A throwing `user:` emit skipped every `partie:` emit (shared try) | medium | patch — `emitForUser` guards the two emissions separately; test added both ways (parties lookup failing still emits `user:`; `user:` throwing still emits `partie:`) |
| 3 | Blind, Edge | `hasActivePartie` loaded the whole closed history on every reminder read | medium | patch — `closedAt: null` in the `where` (a closed party is never active under `partieStatus`, so the result is unchanged); test updated |
| 4 | Blind | Weak recurrence tests, duplicated `user:` assertion in the batch test, extra override lines in `dashboard.spec.ts` | low | patch — three recurrence cases added (starts after the window, starts inside, bounded outside), duplicate removed, noise lines removed |
| 5 | Edge | Spec says 401 without a session; the repo's `AuthenticatedGuard` answers 403 | low | rejected as a code change — the e2e asserts 403 like every other e2e of the repo; the frozen matrix wording is wrong, flagged to the user |
| 6 | Blind, Edge | Reminder not re-announced when membership, party status or the passing of time change | low | rejected — AD-5 assumes the cost: accepting an invitation already emits `user:`, time is recomputed on read (52.5 re-reads on display) |
| 7 | Edge | "Today" is inlined instead of `todayKeyUtc()` | low | rejected — `availability/` may not import `events/` (`layer-imports.spec.ts`); same expression, commented |
| 8 | Blind | UTC-only day boundary, slot granularity, throttling, no web consumer yet, nits (logger order, alignment, prettier) | low | rejected — UTC is the calendar's convention; the web screens are Stories 52.5-52.6; formatting is outside CI; throttling is a `/security-review` item for the end of the palier |
## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error
- `docker compose exec api pnpm test` -- expected: green
- `docker compose exec api pnpm test:e2e` -- expected: green (check the script name in `apps/api/package.json`)
- `docker compose exec web pnpm test` -- expected: green except the 2 fixed-date rail tests failing before 52.1
