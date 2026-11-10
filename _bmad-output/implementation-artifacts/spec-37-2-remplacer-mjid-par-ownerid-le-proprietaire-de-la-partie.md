---
title: '37.2 — Replace Partie.mjId with ownerId, the partie owner'
type: 'refactor'
created: '2026-10-09'
status: 'done'
baseline_commit: '8ec6e0650538ca6abffd558260b6aea44c5f176e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The partie owner is stored as `Partie.mjId` (required, `onDelete: Cascade`), a JDR-only name; the shared base for ralliement (epic 38+) needs a system-neutral owner that survives account deletion (AD-5).

**Approach:** One Prisma migration renames the column to `ownerId`, makes it nullable and switches its FK to `SetNull`, without data loss; every reader/writer, the shared DTO (`ownerId/ownerPseudo/ownerDisplayName`), the web code and the seeds follow. No visible change.

## Boundaries & Constraints

**Always:** Migration SQL is hand-written as `ALTER TABLE ... RENAME COLUMN` + `DROP NOT NULL` + FK re-created as `Partie_ownerId_fkey ... ON DELETE SET NULL` — never drop/add (data loss). Prisma relation renamed `mj` → `owner` (relation name `"PartieOwner"`, User back-relation `ownedParties`). A null owner is unreachable today (no code deletes a User) but must type-check: it never satisfies an ownership check, is skipped in recipient/topic/participant lists, and leaves `ownerPseudo/ownerDisplayName` absent. 37.1 characterization tests keep their expectations, except the renamed keys in DTO key-set assertions. Comments in French.

**Never:** Do not rename `XpDistribution.mjId` / its `mj` relation, HommeDragon's PDF `mjPseudo`, or local parameter names like `getOwned(partieId, mjId)` unless they read the Partie field. Do not edit already-applied migrations. No "compte supprimé" UI (arrives with account deletion, AD-11). No `prisma migrate dev` on the dev DB (drift prompt may propose a reset) and no `migrate reset`. No dependency install. No permission-service work (37.6).

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- Partie L59-67 (doc comment, `mjId`, `mj @relation("PartieMJ", Cascade)`), Membership doc L151, User back-relation `mjOfParties` L32. XpDistribution L442-452 untouched.
- `apps/api/prisma/migrations/` -- folder format `YYYYMMDDHHMMSS_snake_case`; latest `20261005120000_theme_atelier_cuivre`. New: `20261009120000_partie_owner_id`.
- `apps/api/src/parties/parties.service.ts` (~35 uses) -- `toPartieDto` L128, `create` L169, `getOwned` L284, `getViewable` L292, `findOneDto` L305-318 (only producer of `mjPseudo/mjDisplayName`; guard null before `findUnique`), `resolveParticipants` L830, `userTopic(partie.mjId)` L594, emit helpers.
- Other prod readers: `characters/character.service.ts`, `availability/availability.service.ts` (L745 `new Set([partie.mjId, ...])` — filter null; L953 type), `invitations/invite-links.service.ts`, `invitations/invitations.service.ts`, `homme-dragon/homme-dragon.service.ts` L154/L485, `account/account.service.ts` L127-138, `announcements/announcements.service.ts` L82-86 (`toDto(a, a.partie.mj)` — non-null required), `parties/party-signals.service.ts` L55, `poll/poll.service.ts` L116/152, `notifications/notifications.service.ts` L53-61 (`[partie.mj, ...]` — filter null), `scenarios/scenarios.service.ts` L846/L879.
- `packages/shared/src/index.ts` -- `PartieDto` L239-255 (`ownerId: string | null`, `ownerPseudo?`, `ownerDisplayName?`), `AnnouncementDto` comment L477.
- `apps/web` prod -- `partie-detail.ts/.html`, `roster-strip.ts`, `roster-rail.ts` (inputs `mjId` → `ownerId`), `roster-row.util.ts`, `homme-dragon-creation-page.ts`, comment in `calendar-agenda-view.ts`.
- Specs referencing the Partie field: api (~15 files, biggest `scenarios.service.spec`, `character.service.spec`, `parties.service.spec`), web (~15 files, biggest `partie-detail.spec`), `notifications.integration.spec.ts`.
- `apps/api/prisma/seed-demo.ts` -- 13 `mjId:`.
- `apps/api/test/characterization/parties.e2e-spec.ts` -- `PARTIE_DTO_KEYS` and list-key filter (L33-35, L172-173).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/20261009120000_partie_owner_id/migration.sql` -- rename field/relation, nullable, SetNull; hand-written rename SQL -- AD-5 without data loss.
- [x] `packages/shared/src/index.ts` -- PartieDto owner fields + comments.
- [x] API prod files of the Code Map -- follow the rename, null-safe as per Boundaries.
- [x] API specs + `notifications.integration.spec.ts` -- mechanical rename of Partie-field fixtures/assertions only.
- [x] `apps/api/prisma/seed-demo.ts` -- rename.
- [x] `apps/web` prod + specs -- rename inputs/fields, no template-visible change.
- [x] `apps/api/test/characterization/parties.e2e-spec.ts` -- rename keys in key-set constants only.

**Acceptance Criteria:**
- Given the dev DB with existing parties, when the migration is applied (`prisma migrate deploy`), then each partie's `ownerId` equals its former `mjId`, the column is nullable and its FK is `ON DELETE SET NULL`.
- Given the migrated schema, when `prisma migrate diff --from-migrations ... --to-schema-datamodel ...` (or `migrate status`) is checked, then schema and migrations agree.
- Given the code, when searching for `mjId|mjPseudo|mjDisplayName` outside migrations, then only XpDistribution, HommeDragon PDF and local parameter names remain.
- Given the whole suite, then 37.1 characterization tests pass with only key renames.

## Implementation Notes

- Migration `20261009120000_partie_owner_id`: drop `Partie_mjId_fkey` → RENAME → DROP NOT NULL → `Partie_ownerId_fkey` SET NULL. md5 of (id, owner) over the 8 dev parties identical before/after; `migrate diff` empty, `migrate status` up to date.
- `getOwned` returns `Partie & { ownerId: string }` (cast after the check) so owner-only callers keep a non-null owner.
- Ownerless partie: skipped in availability participant sets, reminder recipients, `resolveParticipants`; `findOneDto` omits `ownerPseudo/ownerDisplayName`; announcements of an ownerless partie are filtered out (author fields are required strings) — to revisit with AD-11.
- Web roster inputs renamed `ownerId: string | null`.
- Verification (implementer): api typecheck OK; `test:e2e` 19/19; `pnpm test` 1550/1552 — 2 failures hard-code dates now past (party-signals `nextSessionDate` 2026-09-01, parties.service `getAvailableSlots` 2026-09-20), both pass with clock faked to 2026-08-15; web build OK, web tests 3086/3088 (2 known calendar-view date failures); `lint:check` back to the 13 pre-existing errors.
- Review patches: real-Postgres `parties/partie-owner.integration.spec.ts` (owner deleted → partie kept, `ownerId` null, membership intact); `getOwned` returns `{ ...partie, ownerId }` without cast; historical comments restored (harness header, roster-strip). Orchestrator re-run: api typecheck OK, unit 1551/1553 (2 pre-existing date failures), e2e 19/19, `migrate status` up to date, web build OK, web 3086/3088 (2 known calendar-view).
- `graphify update .` not run (command not installed).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap, blind | `ON DELETE SET NULL` (AD-5 core) has no real-DB test; a revert to Cascade passes everything | medium | Only user deletions are test cleanups that delete parties first; CI DB starts empty | patch |
| 2 | blind | `getOwned` unchecked cast `as Partie & { ownerId: string }` | low | Cast survives removal of the check; equality narrowing allows a cast-free return | patch |
| 3 | blind | Rename rewrote historical comments (harness header, roster-strip bug note) into false statements | low | They now name `ownerId` where the referenced past shape/bug was `mjId` | patch |
| 4 | edge | `isMj` true when partie and currentUser both undefined | low | Pre-existing (`mjId` comparison behaved identically); page requires a session | reject |
| 5 | edge | Invite link can be consumed on an ownerless partie | low | Unreachable (no user deletion path); adds a guard branch | reject |
| 6 | blind | Null-owner branches have no unit tests | low | Removing any guard passes `string | null` where `string` is required → caught by `pnpm typecheck` | reject |
| 7 | blind | `InviteLink.createdBy`, `Invitation.inviter`, `XpDistribution.mj` still Cascade on user deletion | medium | schema.prisma L171/L188/L449; AD-5 says no cascade on an owner — account deletion flow is AD-11 | defer |
| 8 | blind | No index on `Partie.ownerId` | low | Pre-existing (`mjId` had none either); hot filters in listForUser/availability/signals | defer |
| 9 | blind | Announcement null-owner filter duplicated, in memory | low | Unreachable case; cosmetic | reject |
| 10 | blind | Web derives MJ from `ownerId === currentUser.id` instead of `role` | medium | Pre-existing pattern (partie-detail.ts:207, homme-dragon-creation-page.ts:72); diverges once a ralliement owner is not MJ (epic 38) | defer |
| 11 | blind | Owner/MJ naming mixed (`mjUser`, messages "déjà le MJ") | low | Correct for JDR, the only family today; 37.6/38 territory | reject |
| 12 | blind | `docs/palier-1.md` and old architecture spines still show `mjId` | low | Historical palier docs, not living reference | reject |
| 13 | blind | No API compat for old web bundles after deploy | false | No production before Palier 11; web and API deploy together | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy && docker compose exec api pnpm exec prisma generate` -- expected: migration applied, client generated.
- `docker compose exec api pnpm typecheck` -- expected: no error (ts-jest does not type-check cross-file).
- `docker compose exec api pnpm test` and `docker compose exec api pnpm test:e2e` -- expected: green.
- `docker compose exec web pnpm test` and `docker compose exec web pnpm build` -- expected: green (2 pre-existing calendar-view date failures may remain; report them).
- `docker compose exec api pnpm exec eslint "test/**/*.ts"` -- expected: clean; `lint:check` has 13 pre-existing `src/` errors — none new.
