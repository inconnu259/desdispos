---
title: '37.7 — Wire the JDR capabilities to the permission service and forbid direct owner reads'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: 'e55aa060fc1cf1ac33a4318c28ffb090f5729255'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Characters, XP, Homme Dragon, group roles, announcements, invitations, invite links, availability, signals, account, reference assets and the SSE stream still decide rights through `getOwned`/`getViewable` delegates or inline `ownerId` comparisons, and nothing stops a layer-3 feature from running on a system that lacks its capability (AD-1, AD-6).

**Approach:** These modules call `PermissionService.assert` directly with new `PermissionAction`s (partie resolved from character / invitation / invite-link / announcement targets). Capability guards live in the permission layer: an action→capability table makes `assert` refuse a layer-3 action when the partie's system lacks the capability. A source-sweep test fails on any owner read used as a right outside `permissions/`, with a named exception list. `GET /parties` without `role` returns every partie of the user with its role.

## Boundaries & Constraints

**Always:** Same outcomes as today for ryuutama parties. New targets `{ characterId } | { invitationId } | { inviteLinkId } | { announcementId }` stay mutually exclusive in `PermissionTarget`; unknown id → 404 with today's message (`Personnage introuvable`, `Invitation introuvable`, `Lien introuvable`, `Annonce introuvable`). Closed action→capability table in `permissions/`, **WRITE actions only** (user decision 2026-10-10, after review: reads keep their role check and return empty/null as today on a system without the capability): `CHARACTER_CREATE`→`characters`, `CHARACTER_XP_SET`→`xp`, `CHARACTER_SHEET_FIELD_SET`→`characters`, `XP_DISTRIBUTION_CREATE`→`xp`, `HOMME_DRAGON_MANAGE` (create/link)→`hommeDragon`, `GROUP_ROLE_ASSIGN`→`groupRoles`, `ANNOUNCEMENT_CREATE`→`announcements`; read actions, `unlink` (own action `HOMME_DRAGON_UNLINK`, MJ-only), `HOMME_DRAGON_READ` and `ANNOUNCEMENT_MARK_READ` carry no capability; role check first, then capability, refusal 400 `Cette fonctionnalité n'est pas disponible pour le système de jeu de cette partie`. `CharacterService.create` also refuses (400, existing "Système de jeu non supporté" message) a `gameSystemId` different from the partie's. `INVITATION_REVOKE` is MJ-only (the inviter is always the owner, ownership being immutable). `markAnnouncementRead` and `addFavorite` require a role on the announcement's / partie's partie (`ANNOUNCEMENT_MARK_READ`, `PARTIE_READ`). Character-sheet ownership (`getOwnCharacterOrThrow`, `hommeDragon.userId`) is not a partie right and stays. Role-dependent projections use the grant role / `rolesOf`; availability's `ownerId !== userId` visibility decision uses `rolesOf`. Existing French messages kept; bare `ForbiddenException()`s gain the permission messages. `?role=mj|player` and any other value keep today's meaning; absent `role` → all parties (owner or member), role from one `rolesOf`, sorted by `createdAt` desc, same DTO. Comments and errors in French.

**Never:** No change to scenario/poll behaviour or to scenario capability guards (`scenarioLifecycle`, `linearCampaign` — deferred). No anti-spoil change. No web change. No migration, no dependency install. No batch `membersOf` for availability participants (named exception). Do not move `XpDistribution.mjId`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member on MJ-only action | player → xp distribution / role assign / announce / invite | 403 `Action réservée au MJ de la partie` | no write |
| Stranger on any action | non-member → character of a partie | 403 `Vous n'avez pas accès à cette partie` | — |
| Foreign id | MJ of A on character / invitation / link / announcement of B | 403 (partie B resolved from the id) | no IDOR |
| No capability (write) | MJ calls a layer-3 WRITE action on a `draconis` partie | 400 capability message | before any write |
| No capability (read) | member/MJ lists characters/announcements/roles/Homme Dragon of a `draconis` partie | 200 empty / null as today | — |
| Mark foreign announcement | user without role on its partie | 403 | no read row written |
| All parties | user is MJ of A and player of B, `GET /parties` | both, roles `mj` / `player`, newest first | — |
| Role filter | `GET /parties?role=player` | only B, as today | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `PermissionAction` union; add `CHARACTER_{CREATE,LIST,READ,PORTRAIT_READ,NOTES_READ,XP_SET,SHEET_FIELD_SET,HISTORY_READ}`, `XP_DISTRIBUTION_{CREATE,READ}`, `HOMME_DRAGON_MANAGE`, `GROUP_ROLE_{ASSIGN,UNASSIGN,READ}`, `ANNOUNCEMENT_{CREATE,READ,MARK_READ}`, `INVITATION_{CREATE,READ,REVOKE}`, `INVITE_LINK_{CREATE,READ,REVOKE}`, `PARTIE_REFERENCE_ASSET_{READ,MJ_READ}`; `JDR_POLICY` in `permissions/permission.service.ts` is `Record<PermissionAction, …>` (compile-enforced) and its literal copy in `permission.service.spec.ts` must be extended.
- `permissions/permission.service.ts` -- `PermissionTarget`, `resolvePartie`, `PartieGrant.target`; add the four targets, the capability table, `rolesOf` already batched.
- Modules to migrate (getOwned/getViewable calls): `characters/character.service.ts` (L200 create, L374, L419, L668, L1520 getViewable; L874, L932, L1039 getOwned; inline `ownerId` isMj at L286, L434, L523 `findMine` → `rolesOf`, L1531-1545), `xp-distributions` (L24, L94), `homme-dragon` (L89, L124, L147, L172; `RYUUTAMA_ID` checks L91/L130 → capability; inline `ownerId` in `updateMany` L154/L485 stay as write filters, named exceptions), `character-roles` (L52, L100, L112), `announcements` (L41, L76), `invitations` (L27, L52, L146; `revoke` L121-124 inline owner check), `invite-links` (L28, L49, L62; `consumeLink` L118 duplicate-membership 409 is a state check, named exception), `game-systems` (L357-359), `realtime/realtime.controller.ts` L27, `account/account.service.ts` (L99 addFavorite, L149 markAnnouncementRead, L127 filter), `availability/availability.service.ts` (L968 decision; L92/L711/L796 filters; L744 participant sets exceptions), `parties/party-signals.service.ts` L55 (`RYUUTAMA_ID` → `hasCapability(…,'hommeDragon')`).
- `parties/parties.controller.ts` L35-38 and `parties.service.ts` `listForUser` L274-308 -- role param handling. Web always passes `?role=` explicitly: unaffected.
- Sweep exceptions to name (files mentioning `ownerId`, non-spec): `parties/parties.service.ts` (DTO projection, create/update writes, list filter, pass-through to emit/notify helpers), `scenarios/scenarios.service.ts`, `poll/poll.service.ts`, `events/events.service.ts` (Event.ownerId write), `availability`, `homme-dragon` write filters, `invitations/invite-links.service.ts` consumeLink, `account` filter, `characters` projection (`c.userId === partie.ownerId` "is the author the MJ" label), `parties/party-signals.service.ts`; `permissions/` exempt. Notifications read the `owner` relation (not the word) — the sweep also matches `.owner\b`. `XpDistribution.mjId` ignored.
- Specs mocking `getOwned`/`getViewable` in these modules (≈ 60 characters, 22 homme-dragon, 30 game-systems, 20 announcements/character-roles…): move to `PermissionService` mocks; partie mocks must carry `gameSystemId`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts`, `permissions/permission.service.ts`, `permission.service.spec.ts` -- new actions, targets, capability table, pinned literal policy table, a refusal test per new action × role cell, a capability-refusal test per capability.
- [x] `characters/`, `xp-distributions/`, `homme-dragon/`, `character-roles/`, `announcements/`, `invitations/`, `invite-links/`, `game-systems/`, `realtime/`, `account/` (+ specs) -- `assert` with the new actions; capability via the table; remove `RYUUTAMA_ID` capability stand-ins; `markAnnouncementRead`/`addFavorite` gated.
- [x] `availability/availability.service.ts`, `parties/party-signals.service.ts` (+ specs) -- decision via `rolesOf`, capability via `hasCapability`.
- [x] `parties/parties.controller.ts`, `parties.service.ts` (+ specs) -- `GET /parties` all-roles.
- [x] `apps/api/src/permissions/no-direct-owner-read.spec.ts` -- sweeps `apps/api/src` non-spec files; fails on `ownerId` / `.owner` outside `permissions/` and the named exception list (file + reason); the list is asserted to contain only existing files.
- [x] `apps/api/test/characterization/permissions.e2e-spec.ts` -- member refusals (xp distribution, role assignment, announcement create, invitation create), foreign-id refusal (character of another partie), `GET /parties` all-roles + `?role=` unchanged, `markAnnouncementRead` on a foreign announcement refused.

**Acceptance Criteria:**
- Given the sweep test, when a service compares or filters on a partie owner outside the exception list, then the test fails.
- Given a `draconis` partie (legacy), when its MJ calls a characters/xp/homme-dragon/roles/announcements WRITE action, then the capability refusal is returned and nothing is written; its read routes still answer 200.
- Given the suites, then 37.1 characterization tests pass unchanged.

## Implementation Notes

- New targets `characterId`/`invitationId`/`inviteLinkId`/`announcementId` (mutually exclusive); `ACTION_CAPABILITY` checked in `assert` after the role (400 `Cette fonctionnalité n'est pas disponible pour le système de jeu de cette partie`); extended later to write actions only (user decision after review).
- `PermissionService.ownerOf(partie)` added (author identity for announcements) so `announcements/` holds no owner read. `PARTIE_MANAGE`, `getOwned`, `getViewable` removed.
- Sweep `permissions/no-direct-owner-read.spec.ts`: whole-file named exceptions with reasons (parties, scenarios, poll, events, availability, homme-dragon write filters, invite-links `consumeLink`, account filter, characters label projection, notifications `partie.owner`); `party-signals` dropped (no owner read left).
- Behaviour changes: `PUT /me/favorites/:partieId` → 403 without a role on the partie; `markAnnouncementRead` gated by role; `INVITATION_REVOKE` MJ-only; `CharacterService.create` refuses a `gameSystemId` different from the partie's; `GET /parties` without `role` returns all parties (owner or member), newest first.
- Character-sheet ownership (`getOwnCharacterOrThrow`, `hommeDragon.userId`) kept as sheet right, outside partie rights.
- Review patches: capability guard restricted to WRITE actions (user decision; `HOMME_DRAGON_READ`/`HOMME_DRAGON_UNLINK` split, reads return empty/null, mark-read and unlink not blocked); exhaustiveness test of `ACTION_CAPABILITY` vs named opt-outs; `INVITATION_READ` wiring unit + e2e; sweep strips comments and matches relation reads; comments rewrapped. Re-run: unit 1885/1887 (2 deferred date failures), e2e 62/62, typecheck/api build/web build OK, lint 12 pre-existing errors.
- Orchestrator run before review patches: typecheck OK, unit 1874/1876 (2 deferred date failures), e2e 59/59, web build OK, lint 12 pre-existing errors.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind, edge | Capability guard also on READ actions: reads 400 instead of empty on capability-less legacy parties; `unlink` blocked; unseen-announcement badge cannot be cleared | high | Spec's frozen table covered reads; web swallows only the characters error; `markAnnouncementRead` gated while the unseen query is not | intent_gap → user decided: writes only; spec amended; patched |
| 2 | verif-gap | `INVITATION_READ` wiring untested | medium | No test of `listForPartie` nor GET invitations e2e | patch |
| 3 | blind, edge | Over-long comments, misplaced `PermissionTarget` JSDoc, stale `unlink` comment | low | Direct fixes | patch |
| 4 | blind | No exhaustiveness check that layer-3 actions are in `ACTION_CAPABILITY` or opted out | medium | A forgotten entry would silently ungate | patch |
| 5 | blind, edge | Sweep: comments counted, relation-read patterns missed, magic number | medium | Raw-line regex; `select: { owner }` not matched | patch |
| 6 | blind, edge | Sweep exceptions are whole-file | medium | A new owner comparison inside an excepted file passes | defer |
| 7 | blind | `homme-dragon` `linkPartie`/`create` keep `RYUUTAMA_ID` write filter | low | Only ryuutama declares the capability today | patch (comment) |
| 8 | blind, edge | Character owner branch skips `assert` (no capability/membership check) | low | Sheet ownership is not a partie right (spec Always); former-member read is pre-existing | reject |
| 9 | blind, edge | `INVITATION_REVOKE` narrowed to MJ | low | Inviter always the owner (ownership immutable; only owner could invite) | reject |
| 10 | blind | `GET /parties` default changes; bad `role` coerced to mj; no pagination | low | Required by the story; web always passes `role`; coercion is today's contract | reject |
| 11 | blind, edge | Target loaded twice (resolve + service read) | low | Extra indexed read kept for unchanged 404 messages | reject |
| 12 | blind | Generic message replaces `ERR_RYUUTAMA_ONLY`; mismatch message misleading | low | Message requested by spec; mismatch keeps existing message | reject |
| 13 | blind | `announcements.findAll` returns [] for ownerless partie | low | AD-5 unreachable today | reject |
| 14 | blind | `addFavorite`/`markAnnouncementRead` contract change lightly tested | low | Covered by e2e stranger/unknown cases | reject |
| 15 | blind | Export-PDF routes keep `RYUUTAMA_ID` | low | PDF-template specific, not a capability | reject |

## Design Notes

Putting the capability table inside `assert` implements AD-1 ("garde posée par `PermissionService`, jamais par un test local du système"): a layer-3 service cannot forget it, because its only way to a grant is `assert`. The generic `PARTIE_MANAGE` action and the `getOwned`/`getViewable` delegates are removed once no caller remains.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures.
- `docker compose exec web pnpm build` -- expected: OK.
