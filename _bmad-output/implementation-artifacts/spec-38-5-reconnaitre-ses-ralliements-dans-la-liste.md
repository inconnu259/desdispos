---
title: '38.5 — Recognise your ralliements in the list'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '62cd7d80d2949faf4c270d85ecd95f1e368aee43'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-38-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The home list is built from two role-split calls (`?role=mj`, `?role=player`) that exclude ralliements since 38.2, shows « Ryuutama · Chronique » as the subtitle, knows only the roles Maître/Héros, and a created ralliement does not appear without a reload (UX-DR14, UX-DR15, AD-13).

**Approach:** ⚠️ The list reads every partie with its role from one `GET /parties` (roles from the server's batched `rolesOf`). Each tile gets a system text chip and a round system badge, a nature-only subtitle and a translated role; the filter panel gains « Genre » and an extended « Rang », plus a « Grouper par type » checkbox. Creating a partie notifies the creator's `user:{id}` channel so the list refreshes without reload.

## Boundaries & Constraints

**Always:** Data: `PartiesService.list()` without role (`GET /parties`) returns all parties with `role` (`mj|player|admin|member`); `MyPartiesService` gets a single `refreshAll()` (anti-race counter kept, no clearing on failure); `allParties` = the full list; `mjParties`/`playerParties` become computed filters on `role === 'mj'|'player'` (consumers `open-polls`, `homme-dragon-sheet`, `my-characters`, `shell` unchanged in behaviour); `refreshMjParties`/`refreshPlayerParties` stay as thin aliases of `refreshAll()` (no double fetch); `notifyChanged()` calls `refreshAll()`; the form (create/edit), the detail page (after delete), join, accept-invitation and favourites refresh through it. Favourite toggling works for every role (it no longer branches on `role === 'mj'`). Server: after the creation transaction commits, `PartiesService.create` emits `userTopic(creator)` for every family (test asserts the emit after commit, none on failure); `GET /me/party-signals` contains no entry or layer-3 code for a ralliement (pin with a test). Tile ⚠️: **chip** — text from `gameSystemName(gameSystemId)` (`Ryuutama`, `Draconis`, `Ralliement`), 11 px, border `rgba(255,255,255,.40)`, pill, padding 1/8 px, text at 85 %, placed after the role indicator, not interactive; **badge** — new standalone SVG component `app-system-badge` (input `systemId`; renders R1 for `ryuutama`, L1 for the ralliement family, nothing for any other system, i.e. Draconis keeps the chip only), 26 px round, glyph 19 px, `aria-hidden="true" focusable="false"`, `currentColor`, **no `<mask>`/`<clipPath>`/`id`**, background `var(--jdr-bg)` (the `primary-bg` token), border `rgba(255,255,255,.28)`; geometry from `ux-designs/ux-jdr-master-2026-10-08/mockups/badge-R1-ryuutama-carte-trajet-de.svg` and `badge-L1-ralliement-feu-de-camp.svg` (viewBox 32; replace R1's hard-coded `#0d0a14` die square by `var(--jdr-bg)`); placement: bottom-right corner of the vignette, offset −6/−6, on a positioned wrapper that is not inside `app-party-banner`; medium mode follows the contract exactly (the vignette is inset 1 rem so the overhang is not clipped by `.tile{overflow:hidden}`), compact mode likewise, large mode (full-width banner) places it inside the banner's bottom-right corner with a 6 px inset (the −6 overhang would be clipped) — recorded as the one deviation. **Subtitle**: quest → `partie.kind_<KIND>` only (« Chronique »); ralliement → `partie.ralliement_kind_<KIND>` (« La convergence des Sortilèges »); the system name appears only in the chip. **Role indicator**: icon + translated word; JDR unchanged (Maître / Héros, themed keys `dashboard.role_mj|role_player`); ralliement from `role` + `kind` — `ONE_SHOT`: admin « Hôte », member « Invité »; `CAMPAGNE_EPISODIQUE`: admin « Admin », member « Membre » (working words per the epic, identical in the three themes, added to `NEUTRAL_KEYS`, marked provisional); shield icon for mj/admin, person icon for player/member; the three hard-coded `role === 'mj'` ternaries (html L223/225/226) and `rowSummary()` (ts L391) use one helper. **Filters** (transient signals, nothing persisted, none counted in the "default changed" flag except Genre and Rang): « Genre » select `Tous / Quêtes / Ralliements` (themed words Quêtes|Sentiers|Missions and Ralliements|Veillées|Rassemblements; filter by `familyOf(gameSystemId)`), « Rang » options `Tous, Maître, Héros, Admin, Membre` (role values `mj, player, admin, member`; generic Admin/Membre words for the filter), existing « Phase » and sort kept; reset-to-default resets Genre and Rang as well. « Grouper par type » checkbox (transient, default off, not counted as deviation): when on, the list renders two sections « Quêtes » and « Ralliements » (themed titles, empty sections omitted), each sorted by the chosen sort without the urgency sub-headings; when off, today's rendering unchanged. New tone keys in the three theme files in identical order with three voices where they differ (Forêt tutoiement, others vouvoiement), neutral ones declared in `NEUTRAL_KEYS`; keys containing `ralliement` must not contain the banned JDR words. A freshly created ralliement is listed with the Ralliement chip, L1 badge, role « Hôte »/« Admin ». Comments and server messages in French.

**Never:** No change to JDR tile content other than the subtitle (system name moves to the chip) and the new chip/badge; no change to sort modes or view-mode persistence; no new role in the server; no cancelled/hidden-list work (epic 42); no invitation flow (epic 39); no change to polls/votes for ralliements. No dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mixed list | user: MJ of a quest, admin of an isolated ralliement, member of a group | 3 tiles, chips Ryuutama/Ralliement/Ralliement, badges R1/L1/L1, roles Maître/Hôte/Membre | — |
| Draconis | legacy Draconis partie | chip « Draconis », no badge | — |
| Genre filter | « Ralliements » | only ralliement tiles | — |
| Rang filter | « Membre » | only `member` rows | — |
| Group by type | on, both kinds present | sections « Quêtes » then « Ralliements » | empty section omitted |
| Create elsewhere | ralliement created in another session | list refreshes without reload | server emit failure never fails the creation |
| Signals | ralliement present | no entry for it in `GET /me/party-signals` | — |
| Favourite | admin favourites a ralliement | works, role-independent | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/dashboard/dashboard.{ts,html,scss}` -- single `#tile` template with 3 modes (`partiesViewMode()`); subtitle html L219-242 `{{ system(gameSystemId) }} · {{ kind(kind) }}` + `.role-indicator` (mat-icon shield|person, aria `dashboard.role_prefix`); compact row `.row__sub` = `rowSummary()` (ts L391, hard-coded MJ/Joueur); `.tile{overflow:hidden}`, `.grid--compact{overflow:hidden}`; `roleFilter` ('all'|'mj'|'player'), `statusFilter`, `filteredParties`, `hasHiddenFinished`, `hasDeviatedFromDefault`, `onResetRequested`, `toggleFavorite` (ts L528-529 branches on `role==='mj'`); `ngOnInit` connects the `user:` SSE (ts L436-441, L449 accept refresh); « Rang » `<select>` options hard-coded (html L40-44); extra filters projected into `shared/list-control-bar` via `[extraFilters]`.
- `apps/web/src/app/core/my-parties/my-parties.service.ts` -- `mjParties`/`playerParties` signals, `allParties = [...mj, ...player]`, `refreshMjParties`/`refreshPlayerParties` with seq counters, `notifyChanged()`; `core/parties/parties.service.ts` L47 `list(role)` → add a role-less call; refresh callers: `shell.ts:92-93`, `dashboard.ts:449,528-529`, `join.ts:54`, `partie-detail.ts:843`, `partie-form.ts:478,509`.
- `apps/web/src/app/core/parties/parties.util.ts` (`gameSystemName`, `partieKindLabelKey`); `core/realtime/realtime.service.ts` ('user:' handler → `myParties.notifyChanged()`).
- New `apps/web/src/app/shared/system-badge/system-badge.ts` (+ spec) -- pattern: `shared/create-icon/create-icon.ts` (aria-hidden, focusable false, no mask/clipPath/id, `:host{display:block;flex:none}`, size by CSS variable); R1/L1 sources in `mockups/badge-*.svg` (no mask/id; R1 die square `#0d0a14` = `--jdr-bg`).
- Tones: `core/theme/tones/*.ts` existing `dashboard.role_prefix|role_mj|role_player|filter_role_label|filter_role_all|filter_status_*|section_*|hide_finished_label`, `partie.kind_*`, `partie.ralliement_kind_*`; spec `core/theme/theme-tone.service.spec.ts` (parity, `NEUTRAL_KEYS` L776, banned words for `ralliement` keys via `non-jdr-words.fixture.ts`).
- API: `parties/parties.service.ts` `create` L183-246 (add `realtimeEvents.emit(userTopic(ownerId))` after the transaction), `listForUser` (role-less branch already uses `rolesOf` in one query), `party-signals.service.ts` (only role-split lists → no ralliement entry).
- Specs to adapt: `dashboard.spec.ts` (`createFixture(...)`, `makeParty(id, role, …)` draconis; subtitle L172, role indicator L193-218, selects L739/L753, rowSummary L809, favourites L1315+), `my-parties.service.spec.ts`, `parties.service.spec.ts` (web), mocks of `MyPartiesService` in `shell.spec`, `partie-form.spec`, `partie-detail.spec`, `join.spec`, `open-polls.service.spec`, `homme-dragon-sheet.spec`, `my-characters.spec`; api `parties.service.spec.ts` (create emit), `party-signals.service.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `shared/system-badge/*` (+ spec) -- R1/L1 badge component.
- [x] `core/my-parties`, `core/parties` (+ specs), refresh call sites -- full list, `refreshAll()`, computed role views.
- [x] `dashboard.{ts,html,scss}` (+ spec) -- chip, badge placement, subtitle, role indicator helper, filters, grouping.
- [x] Tone keys (3 files + spec).
- [x] `parties.service.ts` + spec (API) -- emit after create; test pinning no ralliement in `party-signals`.
- [x] `test/characterization/ralliement.e2e-spec.ts` -- `GET /parties` all-roles list shows the new ralliement with role `admin`; `GET /me/party-signals` has no entry for it.

**Acceptance Criteria:**
- Given a user with a quest, an isolated ralliement and a group, then the list shows each with the right chip, badge (R1/L1, none for Draconis), nature subtitle and translated role.
- Given « Genre » = Ralliements or « Rang » = Membre, then only matching tiles remain; « Grouper par type » shows the two sections.
- Given another session creating a ralliement, then this list refreshes without reload; the server emits `user:{id}` after commit.
- Given the JDR suites, then they pass unchanged except the subtitle/role assertions this story changes.

## Implementation Notes

- API: `PartiesService.create` emits `userTopic(ownerId)` after commit for every family (failure caught and logged; none on a failed transaction). `party-signals` stays built from the role-split lists only (pinned by a unit test and an e2e case).
- Web data: `PartiesService.list()` without role → `GET /parties`; `MyPartiesService.allParties` fed by `refreshAll()` (seq guard, last good state kept on failure); `mjParties`/`playerParties` computed filters; `refreshMjParties`/`refreshPlayerParties` kept as thin aliases; `notifyChanged()` → `refreshAll()`; callers (shell, dashboard accept/favourites, join, partie-detail delete, partie-form create/edit) call `refreshAll()`; favourites no longer branch on role.
- `shared/system-badge` (`app-system-badge`, R1/L1, none for Draconis, 26 px round, glyph 19 px, no mask/clipPath/id, die square from `--jdr-bg`); dashboard: chip after the role indicator, nature-only subtitle, one `roleLabel`/`roleIcon` helper, filters « Genre » / « Rang » (Maître, Héros, Admin, Membre) / « Grouper par type » (transient). Placement: medium and compact −6/−6 on a positioned wrapper outside `app-party-banner`; large mode 6 px inside the banner corner (recorded deviation). Compact badge is 26 px on a 28 px vignette, as the contract says.
- Tones: `dashboard.filter_genre_label|filter_genre_all|group_by_type_label`, `role_ralliement_host|guest|admin|member` (identical in the 3 themes, in `NEUTRAL_KEYS`, provisional), `dashboard.genre_quetes|genre_ralliements` (3 voices).
- `allParties` order is now the server's (`createdAt` desc) instead of MJ-then-player; the dashboard re-sorts, other consumers use it as a lookup. `dashboard.scss` is 4.34 kB (warning threshold 4 kB, error 8 kB).
- Not checked in the live app (the dev user has no parties; creating data was not done): badge/chip pixels, large-mode inset, JDR tile layout inside the new wrappers.
- Review patches: `mjParties`/`playerParties` computed with an id+role+name equality (an `isFavorite`-only refresh no longer re-triggers the open-polls fan-out; new integration spec wiring the real `MyPartiesService` to the real `OpenPollsService`); `allParties` exposed read-only; registry-driven badge (`GAME_SYSTEMS.badge`, `badgeOf`); `var(--jdr-bg, #0d0a14)` fallbacks; stale comments; `refreshAll` asserted after join and confirmed delete; emission-order indices checked. Re-run: api unit 2236/2237 (1 deferred date failure), e2e 111/111, web 2 known calendar-view date failures, builds OK.
- Orchestrator run before review patches: api unit 2235/2236 (1 deferred date failure), e2e 111/111, typecheck OK; web 3191 pass / 2 known calendar-view date failures; web build OK.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | `playerParties` computed yields a new array on every refresh → `OpenPollsService` fan-out per player party on each create/favourite/delete | high | Previously only a player-list refresh wrote it; documented past "tempête de requêtes" bug; no test wires the real services | patch |
| 2 | blind | `allParties` exposed as a writable signal | low | Bypasses the `seq` guard | patch |
| 3 | blind | Badge glyph hard-coded on `'ryuutama'` | medium | Violates the registry-driven principle (CLAUDE.md) | patch |
| 4 | blind, edge | No `--jdr-bg` fallback; vacuous badge test | low | Transparent badge/die if the token is missing | patch |
| 5 | blind | Stale comments citing removed methods; emission-order test accepts -1 indices | low | Direct fixes | patch |
| 6 | verif-gap | `refreshAll` after join / delete never asserted | low | Mocked only | patch |
| 7 | blind | Aliases `refreshMjParties`/`refreshPlayerParties` have no caller | low | Kept on purpose by the spec | reject |
| 8 | blind | « Rang » options Admin/Membre vs tile words Hôte/Invité; shown to users without ralliements | low | Spec: generic words in the filter | reject |
| 9 | blind | Genre/Rang/group combinations give empty or redundant views without feedback | low | UX not specified; plain filters | reject |
| 10 | blind | Badge 26 px on the 28 px compact vignette; hard-coded white borders/11 px chip | low | Exact UX contract values | reject |
| 11 | blind, edge | Creating tab fetches twice (form refresh + SSE) | low | `seq` guard keeps the result consistent | reject |
| 12 | edge | Older refresh success dropped when a newer one fails | low | Next trigger refreshes; edge only | reject |
| 13 | edge | `allParties` order change (createdAt desc) | low | Dashboard re-sorts; other consumers look up | reject |
| 14 | edge | Raw enum/undefined fallbacks in `subtitle`/`roleLabel` for impossible values | low | Server returns only the four roles | reject |
| 15 | edge | Large-mode / wrapper layout shift for JDR tiles unverified | low | Visual check left to the user | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures; build OK (no new SCSS budget error).
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the 1 deferred date failure.

**Manual checks:** the dev DB user has no parties, so the live list is empty; verify with unit tests, and leave the visual check (create a quest and a ralliement from the header button, return to « Mes aventures ») to the user.
