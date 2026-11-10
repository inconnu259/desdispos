---
title: '37.5 — Declare game systems and their capabilities in a single registry'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: 'e0adb0570ab4f7dfaf2e3349d867d425cee34fde'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-37-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `GAME_SYSTEMS` only carries `module: boolean`, read through `gameSystemHasModule()`, which conflates "has playable characters" with "may be chosen at creation"; there is no notion of family, so ralliement (epic 38) has nowhere to declare itself (AD-2).

**Approach:** Each `GAME_SYSTEMS` entry in `@master-jdr/shared` declares `family`, `capabilities`, `kinds`, `openForCreation`; four readers `familyOf`, `hasCapability`, `kindsOf`, `isOpenForCreation` replace `gameSystemHasModule` everywhere (API and web). A closed `ralliement` entry is added. Changing a partie's system across families and changing the kind of a non-`jdr` partie are refused server-side. No visible JDR change; 37.1 tests unchanged.

## Boundaries & Constraints

**Always:** Registry values: `ryuutama` = `jdr`, all capabilities (`characters`, `scenarioLifecycle`, `xp`, `hommeDragon`, `groupRoles`, `announcements`, `linearCampaign`), kinds `ONE_SHOT`/`CAMPAGNE_LINEAIRE`/`CAMPAGNE_EPISODIQUE`, open; `draconis`, `conte-de-minuit`, `esteren` = `jdr`, same kinds, no capability, closed; `ralliement` (name "Ralliement") = `ralliement`, no capability, kinds `ONE_SHOT`/`CAMPAGNE_EPISODIQUE`, **closed** until epic 38, no `GameSystem` table row. Readers tolerate an unknown id (never throw): `familyOf` → `null`, `hasCapability`/`isOpenForCreation` → `false`, `kindsOf` → `[]`. Mapping of today's uses: creation/system-change eligibility → `isOpenForCreation`; character creation, `PERSONNAGE_A_CREER`, the web create-character entry → `hasCapability(id, 'characters')`. Values imported as values (never `import type`). Errors in French.

**Never:** No change to which systems are offered or to any screen. No ralliement creation path, no capability guard on layer-3 services (37.7), no permission work (37.6). No DB migration. No dependency install. `GameSystem` table untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create JDR | `POST /parties` `gameSystemId: 'ryuutama'` | 201 as today | — |
| Create closed | `gameSystemId: 'draconis'` or `'ralliement'` | 400, current "no module" message | — |
| Cross-family change | `PATCH /parties/:id` jdr partie → `gameSystemId: 'ralliement'` | 400, French message naming the family change | refused before any write |
| Kind change outside jdr | `PATCH /parties/:id/kind` on a non-`jdr` partie (unit-level, no such partie can be created yet) | 400 | `checkPartieKindTransition` not consulted |
| Unknown id | readers called with `'inconnu'` | `null` / `false` / `[]` | no throw |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` L98-118 -- `GAME_SYSTEMS` (`as const`, `module` flag), `GameSystemId`, `gameSystemHasModule`; doc comment lists consumers. Add `GameSystemFamily`, `GameSystemCapability` types and the four readers; remove `gameSystemHasModule`.
- API consumers: `parties/parties.service.ts` L28 import, `assertGameSystemHasModule` L154-163 (create) and L389-391 (system change in `update`), `convertKind` L434 (`checkPartieKindTransition`); `characters/character.service.ts` L14/L205; `parties/party-signals.service.ts` L2/L148; comment in `parties/dto/create-partie.dto.ts` L14-16 (validator keeps "known id" only).
- Web consumers: `features/parties/partie-detail/partie-detail.ts` L27/L247; `features/parties/partie-form/partie-form.ts` L12, L46-57 (`MODULE_ELIGIBLE_GAME_SYSTEMS`), L139-158 (synthetic entry `{ id, name, module: false }`); `core/parties/parties.util.ts` (`gameSystemName`), `dashboard.ts`, `join.ts` read `GAME_SYSTEMS` (names only).
- Specs mocking `GAME_SYSTEMS` shape: `parties/parties.controller.spec.ts` L7, `realtime/realtime.module.spec.ts` L10; specs touching `gameSystemHasModule` behaviour in parties/character/party-signals specs and web partie-form/partie-detail specs.
- Seed comment `apps/api/prisma/seed-demo.ts` L162.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- registry fields, types, four readers, updated doc comment.
- [x] `apps/api/src/game-systems/game-systems-registry.spec.ts` (new) -- registry values per system and reader behaviour incl. unknown ids.
- [x] `apps/api/src/parties/parties.service.ts` (+ spec) -- creation/system-change via `isOpenForCreation`; refuse cross-family system change; `convertKind` refuses non-`jdr` and applies `checkPartieKindTransition` only to `jdr`.
- [x] `characters/character.service.ts`, `parties/party-signals.service.ts` (+ specs) -- `hasCapability(id, 'characters')`.
- [x] Web `partie-detail.ts`, `partie-form.ts` (+ specs) -- same mapping; synthetic entry fits the new shape.
- [x] Specs mocking `GAME_SYSTEMS`, seed comment -- new shape / reader names.

**Acceptance Criteria:**
- Given the code, when searching for `gameSystemHasModule` and `.module` reads of `GAME_SYSTEMS`, then none remain.
- Given the web, when opening the create-partie form, then the offered systems are exactly as today (Ryuutama only).
- Given the suites, then 37.1 characterization tests pass unchanged.

## Implementation Notes

- Registry in `packages/shared`: `GameSystemFamily`, `GameSystemCapability`, `GameSystemEntry`; `GAME_SYSTEMS ... as const satisfies readonly GameSystemEntry[]`; readers tolerate unknown ids. `gameSystemHasModule` removed.
- `PartiesService.update()`: family check (new `GAME_SYSTEM_FAMILY_CHANGE_MESSAGE`) before the openness check; skipped when the current system is unknown. `convertKind()`: refuses a known non-`jdr` family (`KIND_CONVERSION_NOT_JDR_MESSAGE`) before the transaction.
- Web: `OPEN_GAME_SYSTEMS` via `isOpenForCreation`; `GameSystemOption = {id, name}`; registry read elsewhere only for names (no list shows "Ralliement").
- New `apps/api/src/game-systems/game-systems-registry.spec.ts`.
- Review patches: `convertKind` refuses only a known non-`jdr` family (aligned with `update()`); tests for unknown-system update/convert, unchanged ralliement resend, ryuutama → draconis keeps the openness message, ralliement has no PERSONNAGE_A_CREER, character creation refuses ralliement; comments rewrapped/corrected; spec mocks reduced to `{id, name}`. Re-run: api unit 1594/1596 (2 deferred), e2e 21/21, web (known calendar-view failures only), web build OK, lint 13 pre-existing errors.
- Orchestrator run: typecheck OK, api unit 1588/1590 (2 deferred date failures), e2e 21/21, web 1 failing file (known calendar-view date failures), web build OK.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | edge, blind, verif-gap | `convertKind` refuses unknown-system parties (null family) with a wrong reason; asymmetric with `update()` | low | `familyOf` → null !== 'jdr'; previously convertible | patch |
| 2 | verif-gap, blind | Null-family branch, unchanged-ralliement resend, family-before-openness order untested | low | No spec uses an unregistered current id or a closed same-family target | patch |
| 3 | blind | "(+ specs)" tasks for party-signals/character not done | low | No ralliement case for PERSONNAGE_A_CREER nor CharacterService.create | patch |
| 4 | blind | Capability comment claims no hard-coded system id | low | `RYUUTAMA_ID` checks remain (37.7) | patch |
| 5 | blind, edge | Spec mocks claim registry shape, lack `kinds`, wrong capabilities | low | jest.mock factories untyped | patch |
| 6 | blind | New comment lines exceed 100 cols | low | Prettier does not rewrap comments | patch |
| 7 | edge | `CharacterService.create` gates on `dto.gameSystemId`, not the partie's system | medium | Pre-existing (was `gameSystemHasModule(dto.gameSystemId)`); capability guard by partie is 37.7 | defer |
| 8 | edge, blind | `kindsOf` never enforced at creation/conversion | low | Invisible while ralliement is closed; must land before epic 38 opens it | defer |
| 9 | edge, blind | Web form offers cross-family systems / kind conversions on a ralliement partie | low | No ralliement partie can exist yet; epic 38 builds the ralliement form | defer |
| 10 | blind | `linearCampaign` capability vs `CAMPAGNE_LINEAIRE` kind overlap | low | Capability = layer-3 features, kind = allowed type (AD-2); no runtime conflict | reject |
| 11 | blind | Stale "sans module" wording, constant name | low | Message frozen for constant behaviour; cosmetic | reject |
| 12 | blind | Family message hard-codes two families | low | Only two families exist (AD-2) | reject |
| 13 | blind | Registry spec lives in apps/api | low | `packages/shared` has no test runner; cosmetic | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no error.
- `docker compose exec api pnpm test` / `pnpm test:e2e` -- expected: green except the 2 deferred date failures; e2e 21/21.
- `docker compose exec web pnpm test` -- expected: green except the 2 known calendar-view date failures.
- `docker compose exec web pnpm build` -- expected: OK.
