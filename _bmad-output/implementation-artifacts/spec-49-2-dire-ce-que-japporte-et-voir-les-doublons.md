---
title: 'Dire ce que j''apporte, et voir les doublons (story 49.2)'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '1dbb5093018317cfe41911a8bd95f524f59b0d0b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-49-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the games tab (49.1) a participant can see the host's games but cannot say which of theirs they bring, so people still risk arriving with a box already on site.

**Approach:** Add the `EventGameBring` table, `PUT/DELETE /events/:eventId/board-games/:boardGameId/bring` under a new `EVENT_GAME_BRING` permission and the event lock, extend `GET /events/:eventId/board-games` with the Brings, and on the tab add the « Dans mon cabinet / coffre / Sur mon râtelier » and « Apportées » sections with duplicate marking. In the 48.2 Ludothèque page, removing a game brought to upcoming evenings now asks for a confirmation first.

## Boundaries & Constraints

**Always:**
- Prisma `EventGameBring(id uuid, eventId, boardGameId, userId, createdAt)`, `@@unique([eventId, boardGameId])`, cascade FKs on `Event`, `BoardGame`, `User`; one hand-written migration `20261031120000_event_game_bring`; `events/` is the only writer; doc comments on `BoardGame` updated.
- `EVENT_GAME_BRING` added to `PermissionAction`, `JDR_POLICY` (nobody) and `RALLIEMENT_POLICY` (admin + member), and to every hard-coded list in `permission.service.spec.ts`; not a host-only action. New `EventGameBringService` in `events/`, routes in `events.controller.ts` (`ParseUUIDPipe`), PUT and DELETE answer 204, both idempotent.
- Under `SELECT … FOR UPDATE` on the `Event` row (re-reading `boardGamesBasis` on the transaction client), refusals in this pinned order, one denial test each: evening cancelled (400 `EVENING_CANCELLED_MESSAGE` / `CANCELLED_EVENT_MESSAGE`) or finished/past (400 `EVENING_FINISHED_MESSAGE` / `PAST_ROSTER_MESSAGE`) → caller not in `participantsOf` (RESERVED included) 403 → caller is the host 403 → `BoardGame` missing or owned by someone else 404 (same body). JDR partie and strangers are refused by `assert` (403). No email anywhere.
- Game ownership is read through `BoardGamesService` (new `ownedGameIds`-style helper); no `prisma.boardGame` read in `events/`. After commit, outside the transaction, every write emits `partie:{partieId}` (try/catch + `logger.warn`, never a 500).
- `EventBoardGamesDto` gains `brings: EventBringDto[]` = `{ game: BoardGameDto, bringer: { userId, pseudo, displayName } }`, only Brings of current `participantsOf`, empty when the evening is closed; games for them come from a new `BoardGamesService.listByIds`. Account deletion cascades Brings (extend the account-deletion e2e). Cleanup on leaving is 49.3, not here.
- Web, tab (`EventGamesTab`): sections in order « Chez {hôte} », « Apportées / Apportés à la veillée / Acheminés » (everyone's Brings, shown when any; own row « par moi · Je ne l'apporte plus » with that action, others « par {nom} »), « Dans mon cabinet / coffre / Sur mon râtelier » (only for a Participant other than the host, i.e. `canFill && !isHost`; my games not yet brought, from `BoardGamesService.list()`, each with « J'apporte »; empty library → « Votre cabinet est vide. » + the existing link). Each is a `GamesSection` with its own remembered state key. Bring/unbring act at once, no confirmation, the row moves sections at once (local update then `reload()`); a refusal or vanished game (403/404/400) fails silently and reloads; per-game busy guard against double taps.
- Duplicates, grouped on the received `nameKey` over host games + Brings (never recomputed): `DuplicatePill` « ×N » and the text line « aussi chez {noms} » / « aussi apporté par {noms} » (all other holders; joined « A, B et C »); in « Dans mon … » a game already on site shows « ⚠ déjà chez {nom} » (status-todo token, always text). `GamesSummary` and the tab header count include Brings (rows, not distinct names); `Jouables à N` filter and `FitPill` apply to every row. Empty-site line of 49.1 stays when host games and Brings are both empty, with the participant section below it.
- Ludothèque removal (⚠️ 48.2 screen): new `GET /me/board-games/:boardGameId/brought-count` in `events/` (`{ count }`: Brings of the caller's own game on evenings still open; 404 for another's game); in `BoardGamesPage.removeEditing()`, when `count > 0` a `ConfirmDialog` « Ce jeu est apporté à {n} soirée(s) à venir : il en sera retiré. » (`_one`: « à 1 soirée à venir ») precedes the immediate removal; `0` → no dialog as today; a failed count → error under the entry, nothing removed. The cascade deletes the Brings; the existing `emitForOwner` refreshes open tabs.
- Themed keys (reliques/trésors/joyaux voices, `vous`/`tu`) for the two section titles, « J'apporte », « Je ne l'apporte plus » (EXPERIENCE §3.1) and « Votre cabinet est vide » (3 distinct voices, not in `NEUTRAL_KEYS`); neutral keys (« ×{n} », « aussi … », « ⚠ déjà chez », « par … », the removal message) in `NEUTRAL_KEYS` with `// Story 49.2 : …`. Tokens of DESIGN.md §7.1/7.3, no new theme token, no red, 44 px targets, 640 px column. French comments and messages; no dependency install; Docker only.

**Never:** No exclusion, Envie, `OwnerLink`, cleanup on departure (49.3/49.4/49.5); no Bring for the host; nothing on JDR screens; identifiers `games/`, `ludotheque`, `apport` forbidden; no email in any DTO.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bring | participant PUTs own game, open evening | 204, row in « Apportées », leaves « Dans mon … », `partie:` emitted | N/A |
| Unbring | DELETE own Bring | 204, back in « Dans mon … » | absent Bring → 204 |
| Repeat PUT | already brought | 204, one row | N/A |
| Closed | cancelled / past / finished | 400 French, nothing written | no emission |
| Not participant | stranger, member not signed up, `RESERVED` | 403 | no write |
| Host | host PUTs own game | 403 | no write |
| Other's game | someone else's id / unknown id | 404, same body | no write |
| Duplicate | host has « Azul », Zoé brings « azul » | both rows « ×2 », « aussi apporté par Zoé » / « aussi chez Léa » | N/A |
| Already on site | my « Azul » vs host's | « ⚠ déjà chez Léa » next to « J'apporte » | N/A |
| Read | any viewer | `brings` only of participants, no email | closed → `[]` |
| Remove brought game | game brought to 2 open evenings | dialog « …2 soirées… », then removal, Brings gone | cancel → nothing |
| Remove, none | count 0 | no dialog, as before | count fails → error, no removal |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `User` :15, `BoardGame` :158 (comment « Seul board-games/ écrit »), `Event` :601, `Inscription` :694 as style model; latest migration `20261029120000_board_game/migration.sql` for SQL style.
- `packages/shared/src/index.ts` -- `PermissionAction` ~:281, `BoardGameDto` :2103, `EventBoardGamesDto` :2131.
- `apps/api/src/permissions/permission.service.ts` -- `JDR_POLICY` ~:153, `RALLIEMENT_POLICY` ~:260; `permission.service.spec.ts` lists (`JDR_NOBODY`, `RALLIEMENT_VIEW`, `MJ_ONLY`/`MEMBER_ACTIONS`, ~:179/:496/:66) and describes in the `EVENT_CANCEL` style.
- `apps/api/src/events/events.service.ts` -- lock pattern :873/:2009 (`lockedSeanceOfEvent`), `boardGamesBasis` :1919 (give it a client parameter), messages `CANCELLED_EVENT_MESSAGE`, `EVENING_CANCELLED_MESSAGE`, `EVENING_FINISHED_MESSAGE`, `PAST_ROSTER_MESSAGE`; `events/event-is-open.ts` (`eventClosure`), `participants-of.ts`, `event-board-games.service.ts` (+ spec), `events.controller.ts`, `events.module.ts`.
- `apps/api/src/board-games/board-games.service.ts` -- `toBoardGameDto`, `remove` (update its « l'épic 49 l'ajoutera » comment), `emitForOwner`; add `listByIds` and an ownership helper.
- `apps/api/test/characterization/board-games.e2e-spec.ts` (49.1 describe ~:591: `setupGroup`, `propose`, `signUp`, emit spy, `keysOf`), `account-deletion.e2e-spec.ts` :143.
- `apps/web/src/app/features/events/event-games-tab/*` -- `event-games-tab.{ts,html}` (`canFill`, `isHost`, `reload`, `countChange`), `game-row.ts`, `games-section.ts`, `games-summary.ts`, `games-section-state.service.ts`; `events-api.service.ts` (+ spec) for `bring`/`unbring`/`broughtCount`; `core/board-games/board-games.service.ts` (`list`, `changed`).
- `apps/web/src/app/features/board-games/board-games-page/board-games-page.{ts,html}` -- `removeEditing` ~:333; `features/parties/confirm-dialog/confirm-dialog.ts` and its usage in `dashboard.ts` ~:674 (lazy `MatDialog`).
- `core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777, 49.1 block ~:1167, `VOICED` ~:2400); `DESIGN.md` §7.1/7.3, `EXPERIENCE.md` §2.3, §3.1, §5.1.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/*` -- model + migration `20261031120000_event_game_bring`.
- [x] `packages/shared/src/index.ts`, `apps/api/src/permissions/*` -- `EVENT_GAME_BRING`, `EventBringDto`, policy cells, spec lists + matrix describe.
- [x] `apps/api/src/board-games/board-games.service.ts` -- `listByIds`, ownership helper, comment fix + spec.
- [x] `apps/api/src/events/*` -- `EventGameBringService`, `boardGamesBasis` client, read extension, `brought-count`, routes, module + specs.
- [x] `apps/api/test/characterization/*` -- I/O matrix over HTTP, account-deletion cascade.
- [x] `apps/web/.../event-games-tab/*`, `events-api.service.ts` -- sections, rows, pills, actions, counts + specs.
- [x] `apps/web/.../board-games-page/*` -- removal confirmation + spec.
- [x] Three tone files, `theme-tone.service.spec.ts` -- keys.

**Acceptance Criteria:**
- Given an open evening and my Ludothèque, when I touch « J'apporte » on a game, then it appears at once under « Apportées » (« par moi · Je ne l'apporte plus ») for everyone, and « Dans mon … » no longer lists it.
- Given a game with the same normalised name already on site, then both rows carry « ×N » and the « aussi … » line, and in « Dans mon … » it shows « ⚠ déjà chez {nom} ».
- Given a game brought to an upcoming evening, when I remove it from my Ludothèque, then a confirmation states how many evenings and the Bring disappears with the game.
- Given a game that vanished meanwhile, when I touch its action, then nothing blocks and the list refreshes.
- Given any JDR party screen, then nothing of this story appears.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | vgap, blind | `event-game-bring.service.ts` lock | `FOR UPDATE` on `Event` never pinned: a mock only counts `$queryRaw`; moving, weakening or removing it passes every test | medium | Real (vgap demonstrated it); the lock is the headline safety property. Unit assertion on the SQL text and its order before the basis read | patch |
| 2 | vgap, blind, edge | `broughtCount` | Counts Brings of people who left (`listFor` hides them) | low | Real but temporary: Story 49.3 (next, same epic) purges leavers' Brings in the departure transaction. Rejected | reject |
| 3 | blind, edge | `unbring` | A leaver cannot delete their stale Bring (403) and it reappears on rejoin | low | Same root as #2, removed by 49.3. Rejected | reject |
| 4 | blind | `confirmBrought` | Undo recreates the game but not its Brings; no destructive style | low | Message wording and « no red » are fixed by the spec/epic; the dialog states « il en sera retiré ». Rejected | reject |
| 5 | blind | `write()` web | Failures are silent | false | Frozen decision: a refused or vanished action fails silently and reloads | reject |
| 6 | blind, edge | optimistic state | Optimistic row stays if the write and the reload both fail | low | Needs two consecutive failures; the next `partie:` signal reloads. Rejected | reject |
| 7 | blind, edge | removal dialog | Count can be stale between `GET` and `DELETE`; dialog open during a reload | low | The cascade is the real behaviour and the dialog is a courtesy; a server-confirmed count adds API surface. Rejected | reject |
| 8 | blind | services | `isolated` rule and group guard copied in three places | low | Same one-line predicate as 49.1; no divergence today. Rejected | reject |
| 9 | blind | `broughtCount` | Loads all Brings then filters in JS | low | One game has a handful of Brings. Rejected | reject |
| 10 | blind | `unbring` | Vanished game answers 404, not 204 | false | Frozen matrix: unknown game → 404 (same body); the web treats it silently | reject |
| 11 | blind | `eventIsOpen` | Undated (poll-phase) conjonctions accept Brings | low | Same open rule as the 49.1 tab, which shows it; no spec decision against. Rejected | reject |
| 12 | blind | a11y | Pill text size, glyph, fallback colour contrast | low | Contrast stays on the manual checks (as 49.1); text carries the meaning. Rejected | reject |
| 13 | blind, edge | tests | Concurrency and P2003 only mocked | low | Same root as #1 for the lock; the e2e covers the sequential matrix. Rejected | reject |
| 14 | blind | web | Extra Ludothèque fetch on every reload | low | Cheap read, short-lived tab. Rejected | reject |
| 15 | blind | realtime | Add/update path not covered by an e2e emission test | low | `emitForOwner` is 48.1's tested code. Rejected | reject |
| 16 | blind | docs | No docs/security.md or checklist update | low | Security review is the step the project runs next (`/security-review`). Rejected | reject |
| 17 | blind, vgap, edge | `listFor` test, optimistic sort | Test titled « départagés par pseudo » while the service has no such tie-break; client ties on pseudo, API on id | low | Real: mislabelled test and a visible reorder after the reload. Direct: rename the test, tie-break the client on `game.id` | patch |
| 18 | edge | `event-games-tab.html` | « Dans mon … » renders an empty header when the library is non-empty but every game is brought | medium | Real: a section with no rows and no message. Hide it unless there are rows or the library is empty | patch |
| 19 | edge | realtime vs optimistic | A reload between update and commit flickers the row | low | Cosmetic and self-correcting. Rejected | reject |
| 20 | edge | `hostName` | Blank host name in « aussi chez » | low | The card carries the host name whenever the host has games. Rejected | reject |

## Design Notes

`brought-count` lives in `events/` because `board-games/` must never import `events/` and only `events/` knows which evenings are still open; it is read lazily at the removal click, so the Ludothèque load stays cheap.

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` then `pnpm exec prisma generate` and `prisma migrate status` -- expected: up to date.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 2 `calendar-view` fixed-date tests); never two pnpm commands in parallel. Restart the `api` container before browser checks.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: bring/unbring, duplicates, empty own cabinet, removal confirmation, host view without « Dans mon … ».
