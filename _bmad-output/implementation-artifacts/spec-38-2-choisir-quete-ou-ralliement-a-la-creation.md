---
title: '38.2 — Choose quest or ralliement at creation'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'baa643492d7641724b98a63d6aa65d6ba2ea4fee'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-38-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only JDR parties can be created: the `ralliement` registry entry is closed, a partie has no member role, and the create form knows only quests (FR1, FR3, AD-7).

**Approach:** The `ralliement` entry opens to creation. An isolated ralliement creates a `ONE_SHOT` partie with one `Event` and one undated `Seance`, no `Scenario`; a group creates a `CAMPAGNE_EPISODIQUE` partie. A migration adds `Membership.role` (`ADMIN | MEMBER`); the creator is inserted as `ADMIN` in the same transaction. `PermissionService` gets a `ralliement` policy ("see", "edit the partie"). ⚠️ The create form gets a two-option mode toggle (field order: cover → name → toggle → mode fields → description) with theme labels; the mode cannot change afterwards.

## Boundaries & Constraints

**Always:** `ownerId` stays the creator (AD-5) and the creator also gets a `Membership` `ADMIN`; in a ralliement the role is derived from `Membership.role` only (`ADMIN` → `'admin'`, `MEMBER` → `'member'`; an owner without a membership row counts as `'admin'`); the owner is never `'mj'` there. `MembershipRole` is a closed shared union; `PartieDto.role` widens to `PartieRole` and `toDtoRole` stops throwing. Creation: `kindsOf(gameSystemId)` is enforced (400 for `ralliement` + `CAMPAGNE_LINEAIRE`, French message); a ralliement stores `gameSystemId: 'ralliement'`; the isolated type calls `EventsService.createInTx` **without** an extension (title = partie name, `ownerId`), the group creates no event. Ralliement policy (complete `Record`, compiler-enforced): allowed `PARTIE_READ`, `PARTIE_MEMBERS_READ`, `PARTIE_COVER_READ` for `admin`+`member`; `PARTIE_UPDATE`, `PARTIE_COVER_UPDATE` for `admin`; every other action refused for every role with 403 `Cette action n'est pas disponible pour ce type de partie`; an admin-only refusal for a member says `Action réservée aux administrateurs de la partie`; a non-member gets `NO_ACCESS_MESSAGE`; one refusal test per cell (admin / member / stranger). `rolesOf`/`roleOf`/`roleIn` branch on the partie's family (`rolesOf` also selects `gameSystemId` and the membership `role`). Server refuses, for a ralliement, any `PATCH /parties/:id` whose `kind` or `gameSystemId` differs from the stored one (400 `Le type d'un ralliement ne peut pas être modifié`) and `PATCH …/kind` (refused by policy). The role-split lists (`GET /parties?role=mj|player`, and so `party-signals`) exclude ralliement parties (they appear only in the all-roles list with role `admin`/`member`, consumed by 38.5). Web, ⚠️: order cover → name → **toggle** → mode fields → description (description always last); toggle = `mat-button-toggle-group`, two options, min height 44 px, announced as a named group, ralliement left / quest right, default quest; switching reconfigures the following fields without clearing name or description; absent on edit; quest mode = rule book + nature (current behaviour), ralliement mode = only the nature field with the two types (isolated → `ONE_SHOT`, durable → `CAMPAGNE_EPISODIQUE`). Theme labels (user-validated 2026-10-11) — toggle: Grimoire « Ralliement | Quête », Forêt « Veillée | Sentier », Atelier « Rassemblement | Mission »; nature field / name field: Grimoire « Nature du ralliement » / « Nom du ralliement », Forêt « Nature de la veillée » / « Nom de la veillée », Atelier « Régime du rassemblement » / « Nom du rassemblement »; isolated type: « La conjonction des Esprits » / « La halte au gué » (provisional name) / « La réunion d'établi »; durable type: « La convergence des Sortilèges » / « La grande transhumance » / « Le grand chantier »; **ralliement submit button**: « Convoquer le ralliement » / « Allumer la veillée » / « Monter le rassemblement » (quest keeps `nav.create_game`). New tone keys go in the three theme files in identical order, with tutoiement in Forêt and vouvoiement elsewhere, and respect the parity and `NEUTRAL_KEYS` tests. Minimal web guard: a freshly created ralliement opens at `/parties/:id` without error toasts — capability-bound loads (scenarios, characters, …) are skipped when the capability is absent (the full family page is 38.4). Comments and server messages in French.

**Never:** No tabs/page redesign (38.4), no cover banner redesign (38.3), no list tiles/filters (38.5), no invitations/admin management/leave (epic 39), no event creation for groups, no removal of an `ADMIN`. No change to JDR behaviour or to its policy. No dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Isolated ralliement | `POST /parties` `gameSystemId:'ralliement'`, `ONE_SHOT` | 201; partie + 1 Event + 1 undated Seance, no Scenario; creator Membership `ADMIN`; role `admin` | — |
| Group | same, `CAMPAGNE_EPISODIQUE` | 201; partie + creator `ADMIN` membership, no Event | — |
| Bad kind | `ralliement` + `CAMPAGNE_LINEAIRE` | 400 | no write |
| Quest unchanged | `ryuutama` + any kind | as today | — |
| Member edits | member `PATCH /parties/:id` on a ralliement | 403 `Action réservée aux administrateurs de la partie` | no write |
| Layer-3 on ralliement | any scenario/character/xp action | refused (403 indisponible; writes may also hit the capability 400) | no write |
| Change of type | admin `PATCH` with another `kind`/`gameSystemId` | 400 `Le type d'un ralliement ne peut pas être modifié` | no write |
| Lists | creator of a ralliement | absent from `?role=mj` and `?role=player`; present in all-roles with role `admin` | — |
| Form | create mode | toggle shown, quest default; edit mode | toggle absent | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- `GAME_SYSTEMS` `ralliement` `openForCreation: false` (~L190, comment ~L141) → true; `PartieRole` (L234), `PermissionAction` union; add `MembershipRole`; `PartieDto.role` (~L450, `'mj'|'player'`) → `PartieRole`.
- `apps/api/prisma/schema.prisma` -- `Membership` L154 (add `enum MembershipRole`, `role MembershipRole @default(MEMBER)`); new migration `20261011120000_membership_role` after `20261010140000_seance_reminder_sent_at` (hand-written, default fills existing rows).
- `apps/api/src/parties/dto/create-partie.dto.ts` + `parties.service.ts` -- `create` L189-227 (`assertGameSystemOpenForCreation` L183, ONE_SHOT scenario branch L211-217, `toPartieDto(…,'mj',…)` L225), `toDtoRole` L118, `update` L396-447, `convertKind` L460, `listForUser` L297-316 and no-role branch, `listMembers` L356 (creator now listed).
- `apps/api/src/events/events.service.ts` L129-149 `createInTx(tx, input, extend?)` -- optional extension already supported.
- `apps/api/src/permissions/permission.service.ts` -- `policyFor` L212 (ralliement falls back on `JDR_POLICY` — replace), `jdrRole` L229, `assert` L250, `roleOf` L269, `rolesOf` L280, private `roleIn` L422; messages constants. Specs: `permission.service.spec.ts` literal tables (extend with a ralliement table), "ralliement refuse aussi" case L428-434 (owner no longer `mj` there).
- Known places that assume the owner is not a membership (do not fix beyond scope; record): `common/participant-count.util.ts` (`+1`, used by availability votes layer and poll/scenarios counts), `invite-links.service.ts` consumeLink (409 "déjà le MJ"), `ownEventsOf` role test for episodic. Add to `deferred-work.md`.
- Web: `features/parties/partie-form/partie-form.{ts,html,scss,spec.ts}` (cover section, name, system `mat-select`, kind toggle group, description, submit label `editId() ? partie.save_btn : nav.create_game`; `createComponent(editId, …)` spec helper; "propose les 3 types" test counts toggles = 3 and will change), `core/parties/parties.service.ts` `PartiePayload` L19 / create L69, `core/parties/parties.util.ts`, `features/parties/partie-detail/partie-detail.ts` (capability-bound loads), role consumers of `PartieDto.role`.
- Tones: `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` ("— formulaire de partie —", same order; `Record<ToneKey,string>` parity), `core/theme/theme-tone.service.spec.ts` (parity L65, `NEUTRAL_KEYS`, voice regexes L1074-1090).
- Fixtures to flip: `parties.service.spec.ts` L359 "refuse ralliement", `game-systems-registry.spec.ts` L57-65, `parties.controller.spec.ts` L7-17 mock of shared, e2e `parties.e2e-spec.ts` create block.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared`, `schema.prisma` + migration -- registry open, `MembershipRole`, `PartieDto.role` widened.
- [x] `parties/` -- create (kinds check, ralliement branch, creator ADMIN), list filtering, family/kind-change guard, `toDtoRole`; specs.
- [x] `permissions/` -- ralliement policy, family-aware role derivation, messages; literal-table specs with one refusal test per cell; no-direct-owner-read exceptions adjusted.
- [x] `test/characterization/ralliement.e2e-spec.ts` (new) -- create both types over HTTP, member/stranger refusals, change-of-type refusal, role-split lists exclusion, all-roles list.
- [x] Web: tones (3 files + spec), `PartieForm` toggle/fields/submit label/edit mode (+ spec), `PartiePayload`, minimal `partie-detail` guard.
- [x] `deferred-work.md` -- the owner-is-not-a-member assumptions listed in the Code Map.

**Acceptance Criteria:**
- Given a user who is MJ of nothing, when they create an isolated ralliement, then the partie has exactly one Event, one undated Seance, no Scenario, and they are `ADMIN` member; a group has an `ADMIN` membership and no Event.
- Given a ralliement partie, when a member tries to edit it, then 403 with the admin-only message; when an admin tries to change its kind or system, then 400.
- Given the three themes, then the toggle, field and submit labels follow the validated list above and the tone parity tests pass.
- Given the suites, then 37.1 characterization tests and the anti-spoil suite pass unchanged.

## Implementation Notes

- Migration `20261011120000_membership_role` (enum `MembershipRole`, `role` default `MEMBER`) applied; `migrate status` up to date.
- `RALLIEMENT_POLICY` complete record; role derivation family-aware in `assert`/`roleOf`/`rolesOf`; new messages `ADMIN_ONLY_MESSAGE`, `RALLIEMENT_UNAVAILABLE_MESSAGE`. `toDtoRole` removed; `PartieDto.role: PartieRole`.
- `create`: `kindsOf` enforced; ralliement creates the creator's `ADMIN` membership; isolated type creates Event + undated Seance via `createInTx` without extension; group creates no event. Role-split lists exclude ralliement parties.
- Web: 8 new tone keys in three themes (validated texts; `partie.mode_label` wording chosen by the implementer: « Genre du grimoire » / « Genre de la piste » / « Genre de l'opération »); toggle, field order, edit-mode derivation; quest rule-book list excludes the `ralliement` entry; minimal `PartieDetail` guard (no JDR loads, subtitle with type labels, admin keeps an Edit link).
- Outside the spec: `harness.ts` optional `gameSystemId`/member role; `testTimeout: 30000` in `test/jest-e2e.json` (parallel e2e hooks timed out at 5 s in 3 of 5 runs once the suite count grew) — kept.
- The contextual header title in ralliement create mode still reads « Nouvelle quête » (`partie.new_title`): the spec defines no ralliement title (open point for 38.4).
- `KIND_CONVERSION_NOT_JDR_MESSAGE` guard in `convertKind` is unreachable for a ralliement (policy refuses first, 403); kept as defence in depth.
- Review patches: `hasScenario` now counts only Events carrying a Scenario (create/get/list consistent; a ralliement one-shot is `A_VENIR`); renaming an isolated ralliement renames its Event in one transaction; a PATCH towards the `ralliement` family is refused unless the partie already is one (covers an unknown stored system); vacuous party-signals e2e assertion fixed; parameterised `kindsOf` create test; realtime reload guards of the ralliement detail page tested. Re-run: unit 2229/2230 (1 deferred date failure), e2e 104/104, typecheck/api build/web build OK, web 2 known calendar-view date failures.
- Visual check (Chrome MCP, orchestrator, Grimoire theme): screenshots timed out (renderer), so verified through the DOM on `/parties/new`: order cover → name → toggle → rule book/nature → description; toggle « Ralliement | Quête » with Quête pressed by default, 44 px, named group « Genre du grimoire »; ralliement mode = « Nom du ralliement », no rule book, types « La conjonction des Esprits » / « La convergence des Sortilèges », submit « Convoquer le ralliement »; name and description preserved on switching; quest mode restored with « Lancer une quête ». Nothing was submitted. Forêt/Atelier not checked in the browser (theme follows the account).
- Orchestrator run before review patches: typecheck OK, unit 2219/2220 (1 deferred date failure), e2e 102/102, `migrate status` up to date, api+web build OK, web 2 known calendar-view date failures, lint 12 pre-existing errors.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind | Create response reports `hasScenario: true` for a ralliement one-shot (no Scenario) | medium | `toPartieDto(..., dto.kind === 'ONE_SHOT', ...)`; list/get say false | patch |
| 2 | blind | Event title goes stale when the ralliement one-shot is renamed | low | Event created with `partie.name`, rename does not touch it | patch |
| 3 | edge | A partie with an unknown stored system can be PATCHed to `ralliement` without ADMIN membership/event | medium | `familyOf` null skips the cross-family check | patch |
| 4 | blind | e2e party-signals assertion vacuous | low | Checks keys not containing an id, no control partie | patch |
| 5 | blind | `kindsOf` create guard tested for one case only | low | Registry contract unpinned | patch |
| 6 | verif-gap | Realtime reload guards of the ralliement detail page untested | medium | Guard test only covers mount | patch |
| 7 | verif-gap | Admin cover upload/removal on a ralliement not covered end to end | low | Service passes the grant role through; policy cell pinned; cover flow is story 38.3 | defer |
| 8 | blind, edge | Sole ADMIN's account deleted: Membership cascades, ownerId set null, no admin left | medium | AD-5/AD-11 account-deletion flow; invariant "at least one admin" not designed yet | defer |
| 9 | blind | `participantCount` double-counts the creator (owner is a member) | low | Already recorded in deferred-work by the implementer; no ralliement poll/seance yet | reject |
| 10 | blind | Client still derives `isMj` from `ownerId` | low | Pre-existing, deferred in 37.7 | reject |
| 11 | blind | Consumers of the widened `PartieDto.role` not audited | low | Web role lists use the role-split endpoints (ralliement excluded); the only DTO with admin is `GET /parties/:id` for a ralliement | reject |
| 12 | blind, edge | `KIND_CONVERSION_NOT_JDR_MESSAGE` guard now unreachable | low | Kept as defence in depth, noted | reject |
| 13 | blind | Global e2e `testTimeout` change | low | Fixes a measured flake; recorded in notes | reject |
| 14 | blind | Role filtering in memory in `listForUser` | low | Small lists; no measured issue | reject |
| 15 | blind, edge | Form edge cases (mode restore, brief quest flash on edit load, member opening the edit route) | low | Cosmetic / pre-existing exposure | reject |
| 16 | blind | SSE wiring not evaluated | low | Create flow refreshes via the web's own refresh; `user:{id}` live refresh is story 38.5 | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy && docker compose exec api pnpm exec prisma generate` -- expected: applied; existing memberships read `MEMBER`; `migrate status` up to date.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the 1 deferred date failure; e2e green incl. the new suite.
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures; build OK.

**Manual checks (visual, `mcp__claude-in-chrome__*` on `http://localhost:4200`, never the built-in browser):** create form in the current theme — field order, toggle default and switching without losing name/description, ralliement creation lands on a page without error toasts; edit page has no toggle.
