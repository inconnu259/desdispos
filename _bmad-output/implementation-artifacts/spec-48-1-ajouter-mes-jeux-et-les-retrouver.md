---
title: 'Ajouter mes jeux et les retrouver (story 48.1)'
type: 'feature'
created: '2026-10-29'
status: 'done'
baseline_commit: 'b11ae3c6c17af76d2a33a2dad992f9916516f3a5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-48-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A user has nowhere to record the board games they own, so friends cannot know what is available and nothing exists for later evenings (epics 49–50) to build on.

**Approach:** Add the `BoardGame` table and a new layer-2 API module `board-games/` (`GET`/`POST /me/board-games`) with the shared `boardGameNameKey()` normalisation, and a web Ludothèque page (`/profile/board-games`) opened from a new account-page row: a quick-add row on top, then the alphabetical list. Wired on the `user:{id}` real-time signal.

## Boundaries & Constraints

**Always:**
- `BoardGame(id uuid, ownerId, name, nameKey, minPlayers Int?, maxPlayers Int?, durationMin Int?, createdAt)`, `@@unique([ownerId, nameKey])`, `owner → User onDelete: Cascade`; one hand-written migration. `board-games/` is the only writer and never imports `events/`.
- `boardGameNameKey(name)` in `@master-jdr/shared` (value import): trim, collapse inner whitespace to one space, strip diacritics (NFD + remove combining marks), lowercase. API computes it at write; every DTO carries it. `name` is stored trimmed. Shared `BoardGameDto { id, name, nameKey, minPlayers|null, maxPlayers|null, durationMin|null, createdAt: string }`, built by an explicit `toBoardGameDto()` mapper (no spread).
- Validation (`class-validator` + `trimIfString`): name 1–80 required; players integers 1–99 optional, `max ≥ min` when both set (400); duration integer 1–1440 optional; 501st game → 400; same `nameKey` → 409 (P2002 via `hasPrismaErrorCode`). All server messages in French.
- `GET /me/board-games` sorted by `nameKey` then `name`. After commit, outside the transaction, a creation emits `user:{ownerId}` and `partie:{id}` for each **ralliement** party the owner is a member of (try/catch + `logger.warn`, never a 500).
- Web: the 409 shows the theme duplicate message (« Ce jeu est déjà dans votre cabinet. » / « …dans ton coffre. » / « …sur votre râtelier. »); other errors show the server message (fallback neutral). Error under the entry, fields kept.
- ⚠️ Account page (validated screen): a row « {theme title} · {n} jeu(x) › » + visibility sentence, inserted right after the « Ce que révèle mon calendrier » block (mockup order), so before the danger zone; it is a `routerLink` to `/profile/board-games`, 44 px min.
- Page: contextual-nav title = theme title, visibility subtitle; `QuickAddRow` (Nom, Joueurs « à », Durée en minutes, « Ajouter », hint « Seul le nom est obligatoire. »); `Entrée` in any field submits; success clears fields and refocuses name; empty/blank name → button disabled; max < min → message under the field via `aria-describedby`, submit blocked. List: one row per game, 44 px min, no truncation; ≥ 768 px a 640 px centered column. Empty: entry row only, no incentive text.
- Measures (neutral): « {min}–{max} joueurs » (min = max → « {n} joueur(s) »), min only « {min}+ joueurs », max only « jusqu'à {max} joueurs », duration « {d} min », joined by « · »; nothing when absent. Counts: `_one` (n ≤ 1) « {n} jeu », `_many` « {n} jeux ».
- Theme keys in the three tone files; neutral ones (fields, « à », « Ajouter », hint, measures, counts, max<min message, error fallback) in `NEUTRAL_KEYS` with a `// Story 48.1 : …` reason.
- Web service in `core/board-games/` exposes `changed`/`notifyChanged()`, registered in `RealtimeService` handlers under `user:`; the page connects `userTopic(me)` and reloads on `changed` (first run skipped, stale-safe). The account row loads its count on init.
- French comments and messages; no dependency install; Docker only.

**Never:** No edit/remove (48.2), no `/users/:id/board-games`, `LIBRARY_READ` or `LibrarySheet` (48.3); nothing on events or JDR screens; no prompt, e-mail or badge pushing to fill the Ludothèque; identifiers `games/`, `ludotheque`, `apport` forbidden; no new theme token, no red, no image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create full | `{name:' Azul ', minPlayers:2, maxPlayers:4, durationMin:40}` | 201, DTO `name:'Azul'`, `nameKey:'azul'` | N/A |
| Name only | `{name:'Skull'}` | 201, numbers `null` | N/A |
| Duplicate | `Azul` exists, POST `'  ÀZUL '` | 409 | web: theme duplicate message, fields kept |
| Bad bounds | name `''`/81 chars, players 0/100/2.5, duration 0/1441, max 2 < min 3 | 400 French | message under entry |
| Cap | 500 games exist | 400 French | message under entry |
| Order | `zèbre`, `Azul`, `éclipse` | Azul, éclipse, zèbre | N/A |
| Emission | owner in 1 ralliement + 1 JDR party | `user:{owner}` + `partie:{ralliement}` only | emit failure logged, 201 kept |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `User` :15-54 (add `boardGames BoardGame[]`); copy `PartieFavorite`/`PartieHidden` :126-151 style (`///` French doc, uuid, `createdAt`).
- `apps/api/prisma/migrations/20261019130000_partie_hidden/migration.sql` -- SQL template; new dir `20261029120000_board_game` (latest is `20261027130000_…`).
- `apps/api/src/availability/` -- module template: `@CurrentUser() user: AuthUser` (`common/current-user.decorator.ts`), `@UseGuards(AuthenticatedGuard)`, emission helper :91-120 (`affectedPartieIds`, `emitForUser` try/catch), mapper style :825.
- `apps/api/src/account/dto/update-display-name.dto.ts` -- DTO style (`@Transform(trimIfString)`, `!:`); `common/prisma-error.util.ts` `hasPrismaErrorCode`.
- `apps/api/src/realtime/realtime-events.service.ts` -- `emit`, `partieTopic`, `userTopic` (module is `@Global`).
- `apps/api/src/notifications/notifications.service.ts:25` -- local `RALLIEMENT_SYSTEM_IDS` from `GAME_SYSTEMS` (copy; filter `membership.partie.gameSystemId in`).
- `apps/api/src/app.module.ts` -- register `BoardGamesModule`. `@Controller('me')` is taken: use `@Controller('me/board-games')`.
- `packages/shared/src/index.ts` -- single export file; add `boardGameNameKey`, `BoardGameDto`. No runner there: test it from an api jest spec.
- `apps/api/test/characterization/harness.ts` -- `Harness.start`, `createUser`, `createPartie(owner, kind, label, 'ralliement')`, `addMember`, `body<T>()`.
- `apps/api/test/characterization/account-deletion.e2e-spec.ts` :86, asserts ~:180-215 -- add BoardGame cascade count.
- `apps/web/src/app/features/account/account.{ts,html,scss,spec.ts}` -- calendar intents block ~:88-100, danger zone ~:168; spec `makeThemeService()` must get new keys; add `RouterLink` import.
- `apps/web/src/app/app.routes.ts` -- shell children; mirror `profile/calendar` (:165) with lazy `loadComponent`.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` -- `ToneKey` from grimoire; `fillTone` in `core/theme/tone-format.ts`.
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts:777` -- `NEUTRAL_KEYS` (tests :1145/:1150 enforce both directions).
- `apps/web/src/app/core/realtime/realtime.service.{ts,spec.ts}` -- inject service (:51-63), add `user:` handler (:88-120); spec mocks every injected service (:85-142).
- `apps/web/src/app/core/invitations/invitations.service{,.spec}.ts` -- service + HttpTestingController pattern (`API_BASE`, `withCredentials`).
- `apps/web/src/app/features/homme-dragon/homme-dragon-page/homme-dragon-page.ts:44-49` and `homme-dragon-aventure-panel.ts:73-84` -- channel connect/disconnect and reload-on-`changed` effect.
- `apps/web/src/app/features/calendar/selection-bar/selection-bar.html:62-72` -- `aria-describedby` precedent; `scenario-editor.ts:44-49` -- `extractErrorMessage`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- add `boardGameNameKey()` and `BoardGameDto` -- single normalisation for every layer.
- [x] `apps/api/prisma/schema.prisma` + `migrations/20261029120000_board_game/migration.sql` -- model and table (unique index `"BoardGame_ownerId_nameKey_key"`, FK cascade) -- AD-1.
- [x] `apps/api/src/board-games/{board-games.module,board-games.controller,board-games.service}.ts`, `dto/create-board-game.dto.ts` -- routes, validation, cap, 409, sort, after-commit emission; register in `app.module.ts`.
- [x] `apps/api/src/board-games/board-game-name-key.spec.ts`, `board-games.service.spec.ts`, `dto/create-board-game.dto.spec.ts` -- normalisation (case, accents, spaces), emission (ralliement only, failure swallowed), DTO bounds.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` -- I/O matrix over HTTP (401 without session too); `account-deletion.e2e-spec.ts` -- BoardGame count 0 after deletion.
- [x] `apps/web/src/app/core/board-games/board-games.service{,.spec}.ts` -- `list()`, `create()`, `changed`, `notifyChanged()`; wire into `realtime.service.ts` + its spec.
- [x] `apps/web/src/app/features/board-games/board-games-page/*` -- page, `QuickAddRow` behaviour, list, measure formatting, real-time reload; spec.
- [x] `apps/web/src/app/app.routes.ts` -- `profile/board-games`.
- [x] `apps/web/src/app/features/account/account.{ts,html,scss,spec.ts}` -- ⚠️ row with count + visibility.
- [x] Three tone files + `theme-tone.service.spec.ts` -- keys, `NEUTRAL_KEYS` with reason, per-theme presence test.

**Acceptance Criteria:**
- Given a logged-in user in any mode, when they open their account page, then the row « Mon cabinet de reliques · 0 jeu › » (per theme) and its visibility sentence appear before the danger zone and lead to the Ludothèque page.
- Given the page, when the user types a name and presses `Entrée` in any field, then the game appears in alphabetical position, fields clear and focus returns to the name.
- Given another tab of the same user on the page, when a game is added, then that tab reloads its list without a refresh.
- Given an account with games, when it is deleted, then its `BoardGame` rows are gone.
- Given any JDR party screen, then nothing of this story appears.

## Implementation Notes

- Unauthenticated access returns 403, not 401: `AuthenticatedGuard` answers 403 across the whole API (same as `DELETE /me`); the e2e asserts 403.
- `permissions/no-direct-owner-read.spec.ts` gains a named exception for `board-games/board-games.service.ts` (`BoardGame.ownerId` is a game's owner, imposed name, not a party owner).
- `theme-tone.service.spec.ts`: the ">35 % theme vocabulary" check now measures voiced keys only (excludes `NEUTRAL_KEYS`); the 18 neutral keys of this story had pushed Grimoire Émeraude to 416/1199.
- Two extra neutral keys `board_games.field_players_{min,max}_aria` name the player inputs; messages use the text colour (no red).
- Account row count is read on init only: the account page opens no `user:` channel, so a game added in another tab shows on next visit.

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge, vgap | `board-games.service.ts` create | 500 cap exceeded by concurrent POSTs (count+create at READ COMMITTED) | low | Real: two transactions both read 499; bounded by burst size. Fix is one `SELECT … FOR UPDATE` on the owner row, the existing pattern of `events.service.ts:865` | patch |
| 2 | blind, edge | web `board-games.service.ts` list() | shared in-flight promise returns a pre-write snapshot to a reload triggered after the write | medium | Real: a `user:` event arriving while an older list() is pending reuses it; the newest-sequence load then overwrites with the stale list (own add can vanish). Page and account row are never on screen together, so dropping the sharing is a pure deletion | patch |
| 3 | vgap | web service spec | no test that a later list() issues a new request | low | Moot once sharing is removed (#2); replaced by a "each call → own request" test | patch |
| 4 | blind, edge | `board-games-page.ts` submit | after a failed first load, a successful add shows only the new game and hides the error | low | Real: `(games() ?? [])` + `loadError.set(false)`. Direct fix: reload instead of local insert when nothing was loaded | patch |
| 5 | blind | `board-games-page.ts` onInput | submit error stays after the user edits the fields | low | Real; one-line clear in `onInput` | patch |
| 6 | blind | `board-games-page.ts` | stored error text keeps the old theme after a theme switch | low | Real but needs a theme switch mid-error; fix adds state. Rejected | reject |
| 7 | blind, edge | `packages/shared` boardGameNameKey | trim/collapse runs before mark stripping (`"Azul ́"` → `"azul "`); `\p{M}` merges distinct non-Latin names (ガ/カ, Indic); zero-width chars survive | low | Real per NFD tables. Direct correction: strip U+0300–U+036F and format chars first, then trim/collapse | patch |
| 8 | edge | `packages/shared` boardGameNameKey | œ/æ/ß/ł/ligatures not folded | false | Spec and FR1 ask case, accents, spaces only; œ is a letter, not an accent | reject |
| 9 | vgap | `board-games.service.ts:497` | empty-key guard (combining-marks-only name) untested | low | Real gap: DTO passes `'́'`, nothing exercises the guard. One unit test | patch |
| 10 | blind | e2e | no test that a client `ownerId` field is refused | low | Real gap on the endpoint's ownership guarantee (relies on global `forbidNonWhitelisted`). One e2e row | patch |
| 11 | blind, edge | `board-games-page.ts` sort | client `localeCompare('fr')` vs DB collation may place a fresh add differently until reload | low | Only digits/punctuation edge orderings, corrected on next read; fix adds collation work. Rejected | reject |
| 12 | blind, edge | `board-games-page.ts` parseOptionalNumber | `badInput` number text silently sent as null | low | Needs typing non-numeric text in a numeric field; fix adds validity branches per field. Rejected | reject |
| 13 | edge | `board-games-page.ts` reset | garbage text stays after reset when signal already '' | low | Same root and same rarity as #12. Rejected | reject |
| 14 | edge | `board-games-page.ts` ngOnInit | `currentUser()` null at init → no channel | false | Route sits under the shell's `authGuard`, which resolves the user before activation | reject |
| 15 | blind, edge | `account.ts` ngOnInit | account count not refreshed on other-tab adds; full list fetched for a count | low | Account page opens no `user:` channel; fixing means a new connection. ≤500 small DTOs. Recorded in Implementation Notes | reject |
| 16 | blind | `board-games.service.ts` | cap message shown raw, says « Ludothèque » | low | Only reachable at 500 games; neutral French message. Rejected | reject |
| 17 | blind | page | refetch on own echo and every `user:` event | false | Existing pattern of every `user:` handler (AD-3); sequence guard keeps it correct | reject |
| 18 | blind | `theme-tone.service.spec.ts` | 35 % check now excludes all NEUTRAL_KEYS | low | Measures voiced keys only, which is the check's purpose; no named regression. Logged in Implementation Notes for human review | reject |
| 19 | blind | tone spec | "identical in three themes" test covers 12 of 18 neutral keys | false | `NEUTRAL_KEYS` test (:1150) already fails any listed key that differs between themes | reject |
| 20 | blind, edge | spec | 401 in spec vs 403 in code | low | Fix is editing this spec; deviation logged in Implementation Notes | reject |
| 21 | vgap | `app.routes.ts` | `profile/board-games` route untested | medium | Real; no protected route in the app has a route-level test (`profile/calendar` neither) | defer |
| 22 | blind | page | no loading state / retry on load error | low | Empty-until-loaded is the validated empty state; retry not in UX contract. Rejected | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` then `pnpm exec prisma generate` and `prisma migrate status` -- expected: up to date.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green.
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (never two pnpm commands in parallel across containers).

**Manual checks:**
- In the three themes, the account row and the page at 360 px and ≥ 768 px (640 px column); empty state shows only the entry.
