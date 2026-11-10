---
title: '39.1 — Open a group on its conjonctions'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'ea5c4ddec80496fa57db868855ca4575e9d8958a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-39-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A ralliement group (`CAMPAGNE_EPISODIQUE`) opens on « Détails » with only two tabs; it has no place for its future events and its admins have only « Retranscrire » in the footer (UX-DR6).

**Approach:** ⚠️ The party page derives, for a group, the tabs « Conjonctions » (default) · « Détails » · « Missives » (theme words Conjonctions / Haltes / Réunions). « Conjonctions » shows « À venir » then « Passées » sections and an empty state (events arrive with epic 40). « Détails » keeps the description (no event cards). The admin footer gains « Clore » and « Brûler ». JDR pages are untouched.

## Boundaries & Constraints

**Always:** Tabs come from `familyOf` + `kind` (registry), never a hard-coded system id. Only `kind === 'CAMPAGNE_EPISODIQUE'` gets the new shell; a one-shot encounter (`ONE_SHOT`) keeps today's « Détails » + « Missives » (its page is epic 41). Tab order Conjonctions 0, Détails 1, Missives 2; the default tab is Conjonctions for every member (admin or not). Sections « À venir » / « Passées » are always rendered, each with its own empty line, and the global empty state « Aucune conjonction pour l'instant » shows while both are empty; no event data source exists yet, so lists stay empty. New tone keys (`partie.ralliement_conjonctions_*`: tab label, upcoming, past, empty) in the three theme files, identical order, three voices where words differ (Forêt tutoiement), neutral ones in `NEUTRAL_KEYS`; no banned JDR word (« MJ », « campagne », « scénario », « séance », « joueur », « quête »). « Sceller des secrets » (visibility) never shows for a group. The JDR page, tabs, default tab and tests stay unchanged. Footer decision (human, option A): « Clore »/« Rouvrir » and « Brûler » are wired for real for a group. `RALLIEMENT_POLICY` gives `PARTIE_CLOSE`, `PARTIE_REOPEN` and `PARTIE_DELETE` to the admin only (member and stranger refused, pinned by the policy spec and HTTP e2e); closing sets the same finished state as in JDR (reversible); burning deletes the group with its memberships and emits to every member's `user:` channel after commit. The existing JDR confirmations are reused for the web dialogs. Comments and server messages in French.

**Never:** No « + Nouvelle conjonction » button, event model or card (epic 40); no invitation, « Nommer admin », « Quitter l'office/le groupe » or `leave()` (39.3–39.5); no e-mail work (39.2). No dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Group, member | `CAMPAGNE_EPISODIQUE`, role `member` | Tabs Conjonctions (open) · Détails · Missives; empty state; footer has no action | — |
| Group, admin | role `admin` | Same tabs; footer « Retranscrire », « Clore »/« Rouvrir », « Brûler » (no « Sceller des secrets ») | — |
| One-shot ralliement | `ONE_SHOT` | Détails + Missives as today | — |
| JDR | Ryuutama / Draconis | Tabs and default tab unchanged | — |
| Non-admin on the group server routes | member calls close/reopen/delete | 403 | refusal tested (policy matrix) |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.{html,ts}` -- `<mat-tab-group>` html L36-510; Détails first tab (L41), ralliement Missives tab L465-483 (`members()`, `partie.members_title`), JDR-only tabs behind `isMj()`/`!isRalliement()`; `isRalliement` ts L210, `defaultTabIndex` ts L333, `selectedTabIndex`/`manualTabIndex`/`tabSetKey` ts L335-345; header subtitle effect ts L405-417; footer `<mat-card-actions>` html L544-574 (ralliement admin = edit link only, L566). Add `isGroup` (ralliement + `CAMPAGNE_EPISODIQUE`) computed; make Conjonctions the first tab for a group.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` + `core/theme/theme-tone.service.spec.ts` (parity, `NEUTRAL_KEYS` ~L776, banned words via `non-jdr-words.fixture.ts`) -- new keys next to the Story 38.4 `ralliement_*` block.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- `createFixture`, `makePartie`, describe « ralliement, garde minimale » (~L3200) to extend; JDR control tests must stay green.
- API (Clore/Brûler wired, option A): `apps/api/src/permissions/permission.service.ts` `RALLIEMENT_POLICY` L205-221 (`PARTIE_CLOSE/REOPEN/DELETE: NOBODY`), `permission.service.spec.ts`, `parties/parties.service.ts` `close/reopen/remove` L683-728, `test/characterization/ralliement.e2e-spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] Tone keys (3 files + spec) -- Conjonctions tab label, sections, empty state.
- [x] `partie-detail.{html,ts}` -- group tab shell, default tab, admin footer Retranscrire / Clore-Rouvrir / Brûler.
- [x] `partie-detail.spec.ts` -- group tabs/order/default/empty state/footer; one-shot and JDR unchanged.
- [x] API policy + specs -- admin-only close/reopen/delete for a ralliement; member and stranger 403; delete notifies every member.

**Acceptance Criteria:**
- Given a group, when a member opens it, then tabs are Conjonctions (open), Détails, Missives with the theme words, « À venir » then « Passées », and « Aucune conjonction pour l'instant ».
- Given a group, then « Détails » shows the description and no event cards, and no « Sceller des secrets » exists.
- Given a group admin, when they close, reopen or burn it, then it works and a member is refused with 403.
- Given a JDR party or a one-shot ralliement, then its tabs and default tab are unchanged.

## Implementation Notes

- Web: `isGroup` (ralliement family + `CAMPAGNE_EPISODIQUE`) prepends a « Conjonctions » tab (index 0, default for everyone; Détails 1, Missives 2) with « À venir » / « Passées » sections, their empty lines and the global empty state; no data source until epic 40. `ONE_SHOT` ralliement and JDR pages unchanged. Admin footer of a group: Retranscrire, Clore/Rouvrir, Brûler (existing `closeGame`/`reopenGame`/`confirmDelete`, existing theme wording); no « Sceller des secrets ». Six `partie.ralliement_conjonctions_*` tone keys (tab label and global empty text themed; sections and their empty lines neutral, in `NEUTRAL_KEYS`).
- API: `RALLIEMENT_POLICY` gives `PARTIE_CLOSE/REOPEN/DELETE` to the admin only, for the whole ralliement family (a one-shot host can therefore close or burn through the API; the UI offers it for groups only). `PartiesService.remove` reads a ralliement's participants before the delete (memberships cascade), then emits `user:{id}` to each after it. Tests: policy spec, service spec (read-before-delete ordering pinned), e2e close/reopen/burn + 403 for member and stranger, web describe « un groupe s'ouvre sur ses conjonctions », tone spec. 38.4 fixture default moved to `ONE_SHOT`; 38.2 footer test uses a one-shot.
- Not checked in the live app: the three themes, tab layout (no SCSS added), footer buttons.
- Final run: api typecheck OK, api unit 2238/2239 (1 known date failure `getAvailableSlots`), e2e 115/115; web 3215 pass / 2 known calendar-view date failures, build OK (run before the two review patches, which touched API files only). Review: 14 findings, 2 patches, 12 rejected.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | Participants read before `partie.delete` not pinned by a test | medium | Static `membership.findMany` stub: moving the read after the delete still passes while real members would never be notified | patch |
| 2 | blind | Over-long line in the reworded `RALLIEMENT_POLICY` doc comment | low | Direct formatting fix | patch |
| 3 | blind, edge | `PARTIE_CLOSE/REOPEN/DELETE` are admin-only for every ralliement, so a `ONE_SHOT` host can close or burn via the API while the UI hides it | low | Frozen intent grants the cells family-wide; the host owns the one-shot; a kind-dependent policy adds complexity; epic 41 reworks that page | reject |
| 4 | blind | No SCSS for `.conjonctions*` | low | Plain `h3` + `.muted` reuse existing page styles; pixel check is a manual item | reject |
| 5 | blind | Three empty messages shown together; static `role="status"` | low | The frozen intent asks for exactly this (sections always rendered, global empty state while both are empty); epic 40 replaces it | reject |
| 6 | blind, edge | Prepended tab shifts indexes; `tabSetKey` ignores `isGroup`; tab inserted if `partie()` loads late | false | The tab group renders only inside `@if (partie(); as p)`; the route id is a snapshot (no component reuse); fixed-index paths (`MJ_INVITATIONS_TAB_INDEX`, announcement scroll to 0) are MJ-only | reject |
| 7 | edge | `membersOf` failure aborts the burn with a 500 | low | Fails safe (nothing deleted); `close()`/`reopen()` tolerance does not apply to a read that gates a delete | reject |
| 8 | blind, edge | Late joiner or open detail page not notified after a burn | low | No join flow before 39.3; JDR delete already emits nothing on `partie:{id}` — pre-existing | reject |
| 9 | edge | `closeGame`/`reopenGame`/`confirmDelete` have no error handling | low | Unchanged pre-existing code; two admins cannot coexist before 39.4 | reject |
| 10 | blind | Dialog and snackbar wording of close/burn reused from JDR, not swept by the banned-word test | low | Spec says to reuse the existing confirmations; the strings contain no banned word | reject |
| 11 | blind | 38.4 fixture switched to `ONE_SHOT`, less group coverage | low | Same `isRalliement()` guards serve both kinds; the 39.1 describe covers the group page | reject |
| 12 | blind | Cascade e2e counts memberships only; double close/reopen/delete responses unspecified | low | Memberships are the only group-owned rows at this stage; unspecified cases behave as in JDR | reject |
| 13 | edge | « Détails » of a group may still show event-style blocks | false | Zones Action/Consultation sit behind `@if (!isRalliement())` since 38.4 | reject |
| 14 | blind | `docs/backlog.md` / `docs/spec.md` not updated | low | Bookkeeping lives in the sprint file and specs; no doc claims the old behaviour | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the 1 deferred date failure.

**Manual checks:** create a group from the header button and open it in the three themes; check tab words and the default tab.
