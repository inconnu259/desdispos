---
title: '40.4 — Reserve a place for members'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'a05abfa0910e1f1a7fa3d7bf1856eafccbc7264c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The host of a limited-places conjonction cannot keep a place for the few members they cannot do without: anyone can take the last place first (FR9, UX-DR8, NFR4).

**Approach:** The host reserves places for named members at creation or later; each reservation is an `Inscription` with new status `RESERVED` that counts in the capacity and never expires. The target gets e-mail #3, the signal `RESERVATION_A_CONFIRMER` and a « Place réservée » situation, and accepts (`CONFIRMED`) or declines (row deleted, place freed). Only the host sees a pending reservation.

## Boundaries & Constraints

**Always:** Additive migration (`pnpm exec prisma` in the container): `Inscription.status` enum `RESERVED | CONFIRMED`, default `CONFIRMED` (existing and JDR rows stay confirmed); closed union `InscriptionStatus` in `@master-jdr/shared`. New routes: `POST scenarios/seances/:id/reservations` (body: member user id) and `DELETE scenarios/seances/:id/reservations/:userId` (host only), `PATCH scenarios/seances/:id/inscription/accept` (the target only); declining reuses `DELETE scenarios/seances/:id/inscription` (deletes a `RESERVED` row, frees the place). New action for reserve/unreserve in the closed `PermissionAction` union: ralliement `ADMIN_AND_MEMBERS` + the host-only rule inside `PermissionService.assert` (extend `HOST_ONLY_ACTIONS`; `{ seanceId }` targets must also resolve the event owner), JDR `NOBODY`; accept/decline need only `SEANCE_INSCRIBE`/`SEANCE_UNSUBSCRIBE`. Group `CAMPAGNE_EPISODIQUE` only (else 403 as in 40.1–40.3). Rules: limited places only (« Tous les membres » → 400); target must be a current member other than the host; not already inscribed (409 French); a reservation counts in the capacity (full → 409); not past (400); accept on a missing/confirmed row = no-op, past → 400. Every write (reserve, unreserve, accept, decline, and 40.3 sign-up) first takes `SELECT … FOR UPDATE` on the `Event` row. `POST /parties/:id/events` accepts optional `reservedUserIds` (distinct members, not the host, limited places only, count ≤ capacity − 1) created `RESERVED` in the same transaction. Capacity floor of 40.2 edit and `FULL` of 40.3 count every row, `RESERVED` included. Visibility, explicit projections: `participants` lists `RESERVED` rows to the host only (each carries `status`); the card carries `myInscription` (`RESERVED | CONFIRMED | null`, the viewer's own) and the seance carries `placesTaken` (host + all rows) so « Complet » and « libres » are right for everyone without exposing who holds a pending place; « inscrits » counts host + `CONFIRMED`. Calendar ports (`occupiedSpansOf`/`ownEventsOf`) and `reminderRecipients` use host + `CONFIRMED` only. After commit: `emit(partie:{id})`, `PartieSignalsPort.notifyChanged`, and `emit(user:{id})` of the target on reserve, unreserve, accept and decline. E-mail #3 (new template in the closed `EmailTemplate` union, common layout, neutral vocabulary, `EmailService`, sent after commit, failure logged never thrown): subject « *Hôte* vous a réservé une place : « *Conjonction* » », button « Répondre » to the group page; one per new reservation. New signal `RESERVATION_A_CONFIRMER` in the closed `PartySignalCode` union, derived server-side in `PartySignalsService` (batched, never per party) for a viewer holding a `RESERVED` row on an upcoming conjonction; wire it through every web record keyed by the union (priority order next to the vote signal, category `deadline`, dashboard label/badge/tone, tones ×3). Web, in `features/events/`: creation window « Réserver une place à des membres » (member chips excluding the host, help « returned to others if declined », only with limited places); the dialog gives the host, while not past, the same picker and a remove action on each reservation; the reserved person sees chip « Place réservée » and, in the situation panel, « Accepter » / « Décliner » (busy-guarded, server refusal shown); the host sees a pending reservation as a dotted chip, faded avatar, text « *Nom* — invité·e, n'a pas encore accepté » at full contrast (≥ 4.5:1); updates live from the list, no new `'partie:'` handler. Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No change to JDR routes, DTOs, reminders or tests (37.1 unchanged); no waiting list, no expiry, no auto-accept; no cleanup on departure (40.8); no poll or date logic (40.5+); no other e-mail; no dependency install; no migration beyond `Inscription.status`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reserve | host, limited, place left, member | `RESERVED` row, counts in capacity, e-mail #3, target signal + live, host sees dotted chip | — |
| At creation | `reservedUserIds` valid | event + reservations in one transaction, one e-mail each | invalid ids/limits → 400 |
| Accept | target with `RESERVED` row | `CONFIRMED`, shown to all as inscrit, signal cleared | past → 400 |
| Decline | target, `DELETE …/inscription` | row deleted, place free | — |
| Unreserve | host removes | row deleted, target notified live | — |
| Held place | limited, full with reservations | others get « Complet » / 409, cannot take it | 409 |
| Refusals | non-host reserves, target not a member / host / already inscribed, « Tous les membres », stranger, other group, JDR, one-shot, past | nothing written | 403 / 400 / 409 |
| Visibility | other member reads the list | no `RESERVED` participant, `placesTaken` right | — |
| Last-place race | reserve vs sign-up, one place | exactly one wins | other 409 |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Inscription` :615 (add `status`), migrations dir (last `20261011120000_membership_role`); `packages/shared/src/index.ts` -- `InscriptionStatus`, `PartySignalCode` :494, `PermissionAction`, `EventCardDto`/`EventCardSeanceDto`/`EventParticipantDto` (:710-750), `CreateEventDto`.
- `apps/api/src/permissions/permission.service.ts` (+ spec) -- cells, `HOST_ONLY_ACTIONS`, `resolveTarget` seance branch (return event owner).
- `apps/api/src/events/events.service.ts` -- `inscrireConjonction`/`desinscrireConjonction` (40.3, Event lock), `participantsOf`/`listCards` (visibility, `placesTaken`, `myInscription`), `createInTx`/`createHosted` (reservations), `updateHosted` count, `occupiedSpansOf`/`ownEventsOf`, `reminderRecipients`; add reserve/unreserve/accept.
- `apps/api/src/events/{group-events.service.ts,dto/create-event.dto.ts}` + `scenarios/scenarios.{controller,service}.ts` -- routes and family branching (model: 40.3 `inscrire`), `userTopic` emission via `RealtimeEventsService` (`realtime/realtime-events.service.ts`), e-mail sending model `invitations/invitations.service.ts:178`.
- `apps/api/src/email/{email-template.enum.ts,email.service.ts,templates/}` -- template #3 (model `conjonction-reminder.hbs`, `group-invitation.hbs`).
- `apps/api/src/parties/party-signals.service.ts` -- add `RESERVATION_A_CONFIRMER` (one batched `inscription` read); web `core/parties/party-signal-priority.ts` (+ spec), `features/dashboard/dashboard.ts` (`signalLabel`/`badgeLabel`/`badgeTone`), `core/status/status-derivation.ts` if keyed by the union.
- Tests: service/permission/email/signals specs, `test/characterization/{ralliement,permissions}.e2e-spec.ts` (race, matrix, visibility, live), 37.1 untouched.
- Web `features/events/`: `event-create/*` + `event-form/*` (picker, group members source: existing members API), `event-dialog/*`, `participant-chip/*` (dotted pending variant), `event-card.util.ts` (`isFull` from `placesTaken`, participation line, situation texts, chip « Place réservée »), `events-api.service.ts`; tones ×3 + `theme-tone.service.spec.ts`.
- UX: `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, §7.10, §8.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/` + `packages/shared/src/index.ts` -- migration, `InscriptionStatus`, DTO/union additions
- [x] `apps/api/src/permissions/permission.service.ts` (+ spec) -- reserve action, host rule on seance targets
- [x] `apps/api/src/events/` + `scenarios/` (+ specs) -- locked reserve/unreserve/accept/decline, creation reservations, visibility, ports, recipients, signals after commit
- [x] `apps/api/src/email/` + `parties/party-signals.service.ts` (+ specs) -- e-mail #3 and `RESERVATION_A_CONFIRMER`
- [x] `apps/api/test/characterization/{ralliement,permissions}.e2e-spec.ts` -- matrix, race, visibility, denials, live
- [x] `apps/web/src/app/{core,features}/` -- signal wiring, creation picker, dialog host/target actions, chips, « Complet » from `placesTaken` (+ specs)
- [x] tones ×3 + `theme-tone.service.spec.ts` -- labels, signal texts

**Acceptance Criteria:**
- Given a host reserves a place, when it commits, then the member gets e-mail #3, the signal and « Place réservée », the host sees the dotted chip, and nobody else sees who holds it.
- Given the only free place is reserved, when another member signs up, then they get « Complet » and 409.
- Given the member accepts, then every list shows them as inscrit; given they decline, then the place is free again.
- Given any JDR party, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Migration `20261017120000_inscription_status` (hand-written, additive, default `CONFIRMED`), applied with `migrate deploy`; `migrate status` up to date.
- Reserve, unreserve, accept and decline (`DELETE …/inscription`) all take the `Event` row lock; every one emits `partie:{id}` and `user:{id}` of the target. Mail #3 is `conjonction-reservation`, sent after commit, one per new reservation.
- Cards: `participants` lists `RESERVED` rows to the host only; `myInscription` and `placesTaken` serve everyone. Calendar ports and `reminderRecipients` use host + `CONFIRMED`.
- Review patch: signing up while holding a `RESERVED` row now confirms it. Removing a reservation of a confirmed person is a no-op.
- Group signals: groups get an entry in `/me/party-signals` only when a place is reserved for the user on an upcoming conjonction.
- Not verified: Chrome check (host reserves, target accepts, third member sees « Complet ») and mail #3 in Mailpit. Pre-existing date failures unchanged.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge, verif | Sign-up by a `RESERVED` holder answers 200 but leaves the row `RESERVED` | medium | `inscrireConjonction` returns on `existing`; reachable by a direct API call, caller believes they joined | patch |
| 2 | verif | `formatSessionDate` (mail #3 date) asserted nowhere | medium | every mail test uses `objectContaining` without `sessionDate` | patch |
| 3 | verif | Signal `startDate >= start of UTC day` only asserted as `any(Date)` | low | `new Date()` would pass and drop today's conjonctions | patch |
| 4 | blind, verif | `session-date.ts` duplicates the reminder's date formatter | low | two copies could diverge; reminder (JDR byte-identical) left untouched | defer |
| 5 | edge | Capacity edited to « Tous les membres » leaves pending reservations | low | harmless: invitee can still accept or decline | reject |
| 6 | edge | `sendMail` throwing inside the creation loop | false | `EmailService.sendMail` catches and returns `{ ok: false }`, never throws | reject |
| 7 | blind, edge | E-mails sent serially in the request, cap 100; toggle re-sends mail #3 | low | bounded by capacity − 1; groups are 4–20 members | reject |
| 8 | blind | No index on `Inscription(userId, status)` for the signal query | low | table holds group sign-ups of a small user base | reject |
| 9 | blind | Group signal entry typed `role: 'player'`, leaks « joueur » | false | dashboard role label reads `PartieDto.role`, not the signals entry | reject |
| 10 | edge | Signal assignment clobbers an existing group entry | false | groups never enter the role lists, so no earlier entry exists | reject |
| 11 | blind, edge | Members list load failure never retried; host chip if user not loaded | low | authenticated page always has the user; failure is transient | reject |
| 12 | blind | Focus loss and no live region after roster actions; decline/remove without confirmation | low | same pattern as 40.3 buttons; reservation can be redone by the host | reject |
| 13 | blind, edge | Pending chip drops the Admin shield | low | cosmetic, text of the invitation stays at full contrast | reject |
| 14 | blind | `InscriptionStatus` has no runtime constant; docs not updated; spec hygiene | low | convention/process only | reject |
| 15 | edge | Reserve vs target leaving the group (no Partie lock) | low | membership check under Event lock; departure cleanup is 40.8 | reject |
| 16 | edge | `ReminderSeance.inscriptions[].status` optional fails open | low | every reader selects `status`; covered by reminder tests | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate dev` (or the repo's migration flow) -- migration applies; `pnpm typecheck` no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- green
- `docker compose exec web pnpm test` -- green; `docker compose exec web pnpm build` -- builds
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: host reserves, target's home list shows the signal and accepts; third member sees « Complet »; e-mail #3 in Mailpit.
