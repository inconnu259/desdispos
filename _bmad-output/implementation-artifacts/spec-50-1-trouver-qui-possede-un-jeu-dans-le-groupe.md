---
title: 'Trouver qui possède un jeu dans le groupe (story 50.1)'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: 'db31b8905f4ee174c7c2482639259cba1e70432f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-50-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ludothèques are readable one person at a time (48.3), so a group member cannot see which games the group owns, nor whom to ask for the one they want to try.

**Approach:** Add `GET /parties/:id/board-games` (module `board-games/`, `PARTIE_READ`, group only) returning the current members' games grouped by `nameKey` with their owners, and a read-only 4th group tab (« Reliques / Trésors / Joyaux ») with name search, a single-choice « Jouable à : 2 · 4 · 6 · 8+ » filter and a footer count. Owners open the existing `LibrarySheet`.

## Boundaries & Constraints

**Always:**
- Group only (`CAMPAGNE_EPISODIQUE` of the `ralliement` family, via `familyOf`): an isolated encounter or a JDR party answers the same 403 `RALLIEMENT_UNAVAILABLE_MESSAGE` as `events/`; a non-member gets `PARTIE_READ`'s refusal. No visibility rule recoded in `board-games/`; `board-games/` never imports `events/`.
- Response `GroupBoardGamesDto { games: GroupBoardGameDto[] }`, `GroupBoardGameDto { nameKey, name, minPlayers, maxPlayers, durationMin, owners: { userId, pseudo, displayName }[] }`, through an explicit mapper (never a row spread, never an e-mail). Only **current** `Membership` rows count; grouping on the stored `nameKey`; entries alphabetical by `nameKey`, owners by `displayName`, `pseudo`, `userId`. When copies differ, the entry shows the copy of the first owner in that order (the filter reads those same shown values).
- ⚠️ Group view: the new tab is inserted right after « Conjonctions » (`event_games.tab`, no count), for every member. Content loads only when the tab opens. Read-only: no write action.
- Search (accents and case ignored, matched on `nameKey`, no key recomputed for grouping) and chips 2 · 4 · 6 · 8+ (one active, touching it again clears it; `aria-pressed`): 2/4/6 use `fitsHeadcount`; 8+ keeps games with both bounds set and `maxPlayers ≥ 8`; a game without both bounds is kept by no chip. Rows: name, measures (`formatBoardGameMeasures`), « chez {noms} »; owners are buttons opening `LibrarySheet` (own name plain text « moi »); 44 px; no truncation. Footer « {n} jeux chez {m} membres » counts what is listed (m = distinct owners listed), accorded, `aria-live` polite. No filter match: a neutral line. Empty group: « Personne n'a encore rempli son cabinet / coffre / râtelier. »
- Reloads on `BoardGamesService.changed` (`partie:` already wired, 48.3); older reads are ignored. Departure, removal, join and every Ludothèque write already emit `partie:{id}`: no new emission, no new channel.
- Theme keys in the three tone files; neutral ones in `NEUTRAL_KEYS` with a `// Story 50.1 : …` reason. French comments and messages; no dependency install; Docker only.

**Never:** Nothing on JDR parties or isolated encounters; no new theme token, no red, no image; no new `PermissionAction`; no migration; forbidden identifiers `games/`, `ludotheque`, `apport`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grouped | two members own « Azul » / « azul » | one entry, two owners | N/A |
| Former member | member left or removed | their games absent | N/A |
| Empty | no member owns a game | `games: []`, themed empty line | N/A |
| Not a member | other user | refused | 403 `PARTIE_READ` refusal |
| Isolated / JDR | encounter or JDR party member | refused | 403 `RALLIEMENT_UNAVAILABLE_MESSAGE` |
| Chip 8+ | game 2–10 / game without bounds | kept / dropped | N/A |
| Privacy | any 200 | no `email` in body | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/board-games/board-games.{service,module}.ts`, `user-library.controller.ts` -- add `listOfGroup(userId, partieId)` (`permissions.assert(…, 'PARTIE_READ', { partieId })` returns `partie`; local `kind` + `familyOf` check), a new `@Controller('parties')` file for `:id/board-games` (follow sibling parties routes' param handling), mapper next to `toBoardGameDto`. `no-direct-owner-read.spec.ts` already excepts `board-games/`.
- `packages/shared/src/index.ts` ~:2113-2200 -- `BoardGameDto`, `UserLibraryDto`, `boardGameNameKey`; add the two DTOs.
- `apps/api/test/characterization/{harness,board-games.e2e-spec}.ts` -- `createPartie(owner, kind, label, 'ralliement')`, `addMember`; matrix over HTTP.
- `apps/web/src/app/core/board-games/board-games.service.ts` -- add `listOfGroup(partieId)`; `core/realtime/realtime.service.ts:122` already bumps `changed` on `partie:`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.{html,ts,scss}` -- tabs at html:56-67 (group's « Conjonctions »); sheet wiring and `.library-open` button style to copy (ts:405-434, scss:400); `isGroup` ts:228. Tab indices are positional.
- `apps/web/src/app/features/board-games/library-sheet/` -- reuse as is; `board-game-measures.ts` -- `formatBoardGameMeasures`, `formatBoardGameCount`, `fitsHeadcount`; `features/events/event-games-tab/games-summary.ts` -- chip look to copy (`aria-pressed`, accent-1 18 % + ✕).
- `apps/web/src/app/core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777) -- `event_games.tab` reused; `board_games.*` keys to extend.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `GroupBoardGamesDto`, `GroupBoardGameDto`.
- [x] `apps/api/src/board-games/*` -- `listOfGroup`, mapper, controller, module wiring, unit tests (grouping across case/accents, ex-member absent, owners order, refusals, no e-mail).
- [x] `apps/api/test/characterization/board-games-group.e2e-spec.ts` -- the I/O matrix over HTTP (new file next to `board-games.e2e-spec.ts`).
- [x] `apps/web/src/app/core/board-games/*` -- `listOfGroup` + spec.
- [x] `apps/web/src/app/features/board-games/group-games-tab/*` -- component, pure filter helpers, spec (search, chips, footer, empty, reload, sheet focus return).
- [x] `partie-detail.{html,ts}` + spec -- 4th tab after « Conjonctions », group only (no `.scss` change needed).
- [x] Three tone files + `theme-tone.service.spec.ts` -- empty line themed; search placeholder, filter label, owners line, footer, no-match, « moi » neutral.

**Acceptance Criteria:**
- Given a group member, when they open the tab, then every current member's games appear once per name with their owners, alphabetically.
- Given the search or a chip, when set, then only matching games stay; touching the active chip clears it.
- Given a member leaves or is removed while the tab is open, then their games disappear without a reload.
- Given a JDR party or an isolated encounter, then no new tab exists and the route refuses.
- Given 20 members × 300 games, then the tab stays responsive on a phone; the four tabs fit at 360 px with the longest label of each theme (measured and noted), else only their padding is reduced.

## Implementation Notes

- Not seen in a browser: the 360 px fit of the four group tabs (longest label of each theme) was NOT measured, so the acceptance criterion « measured and noted » is open; `partie-detail.scss` is untouched, so if the Material tab header scrolls at 360 px only the padding should be reduced. Also unseen: the three themes, ≥ 768 px, 20 × 300 games on a phone (only `content-visibility: auto` is in place, no measurement).
- The tab label reuses `event_games.tab` (Reliques / Trésors / Joyaux, no count). New keys: `board_games.group_empty` (themed), and neutral `group_search`, `group_fit_label`, `group_fit_chip_aria`, `group_owners_prefix`, `group_owner_me`, `group_footer`, `group_footer_members_one/many`, `group_no_match`. `group_no_match` (« Aucun jeu ne correspond. ») and the polite `aria-live` footer are new copy/decisions absent from EXPERIENCE.md §3: to validate.
- Existing `partie-detail.spec.ts` tab-index literals for groups shifted by one (Reliques is index 1): Détails 2, Missives 3; the banned-word sweep now also covers the Reliques tab.
- Review patches: footer hidden while « no match » shows; the tab resets games, search, chip and an open sheet when `partieId` changes; an open sheet closes on 403/404; owner tie-break (pseudo, then id) now pinned by a unit test; refusal message asserted in e2e.

## Spec Change Log

## Review Triage Log

Reviewers: blind-hunter, edge-case-hunter, verification-gap. A first pass saw a diff missing the modified files (pathspec error on my side) and was rerun on the full diff; the first edge-case report is triaged below with the rest.

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | edge | `partie-detail.spec.ts` banned-word test | Group still clicked index 2, now « Détails » instead of « Missives » | medium | Real: the Missives sweep was silently lost | patch |
| 2 | blind, edge, vgap | `group-games-tab.html` footer | « 0 jeu chez 0 membre » beside the no-match line | low | Real, trivial fix (hide footer) | patch |
| 3 | vgap, blind | `compareOwners` tests | pseudo / id tie-break not pinned by a test | medium | Deleting the two clauses left every test green | patch |
| 4 | blind, edge | `group-games-tab.ts` | `partieId` change keeps previous group's games, search, chip | low | Reachable on route-param reuse; one-block reset | patch |
| 5 | edge | `group-games-tab.ts` | Open `LibrarySheet` survives a 403/404 | low | Real, one-line fix | patch |
| 6 | edge, blind | e2e / unit titles | Refusal message unasserted; title typo; weak `owners.length` assertion | low | Real, test-only | patch |
| 7 | blind, edge | tab, no loading state | Blank panel until first read | low | Needs new copy; same class as 48.3 #9. Rejected | reject |
| 8 | blind, edge | tab, no retry | First-read failure waits for a realtime signal | low | Lazy tab is rebuilt on each open, which rereads. Rejected | reject |
| 9 | blind, edge | effect on `changed` | Whole list refetched on each tick; payload unbounded | low | Imposed by NFR3/AD-7 wiring; a server cap would silently truncate. Rejected | reject |
| 10 | blind, edge | search | No debounce; per-keystroke recompute; `aria-live` footer chatter | low | Frozen decision (polite footer); no measurement shows lag. Rejected | reject |
| 11 | edge, blind | filter | A query of only invisible characters filters nothing | low | Negligible. Rejected | reject |
| 12 | edge | `board-games.service.ts` | Entry order follows DB collation of `nameKey` | low | Same ordering as `listMine`. Rejected | reject |
| 13 | edge, blind | `compareOwners` | `localeCompare` base sensitivity vs byte order | false | Spec says « nom affiché » ordering; test pins the result. | reject |
| 14 | blind, edge | route | 404 unknown vs 403 non-member reveals a partie id exists | low | Same behaviour as every `PARTIE_READ` route. Rejected | reject |
| 15 | blind | route | « Current members » ignores membership status; per-user library visibility bypassed | false | `Membership` has no status column; `LIBRARY_READ` already opens the same people | reject |
| 16 | blind | `currentUserId` null | Own name briefly a button | false | Route sits under `authGuard`, which resolves the user first (48.1 triage #14) | reject |
| 17 | blind | `listOfGroup` | « Is a group » predicate duplicated from `events/` | low | `board-games/` may not import `events/`. Rejected | reject |
| 18 | blind, edge | a11y | No `role="search"`, hover state, list semantics for owners | low | Cosmetic. Rejected | reject |
| 19 | blind | spec | Hard-coded tab indexes in `partie-detail.spec.ts` | low | Pre-existing style. Rejected | reject |
| 20 | edge, vgap | unit vs e2e | Former-member exclusion only covered by e2e; e2e in a new file, not the named one | low | The HTTP matrix runs the real query; file name is cosmetic. Rejected | reject |
| 21 | edge | 360 px fit | Claimed measurement absent | medium | Real but cannot be measured without a browser; recorded in Implementation Notes and the summary | defer |

## Design Notes

Per-copy measures can differ across owners; the entry shows the first owner's so what the row says is what the filter tests. Footer `m` counts owners listed, not all members, so « chez 3 membres » stays true under a filter. The tab content is lazy (`matTabContent`) so the up-to-6 000-game read happens only on demand.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 2 `calendar-view` fixed-date tests); never two pnpm commands in parallel.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: tab order and fit, search, chips, owner sheet and focus return, keyboard.
