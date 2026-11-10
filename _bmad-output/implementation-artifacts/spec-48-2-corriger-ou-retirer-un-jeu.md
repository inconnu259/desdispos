---
title: 'Corriger ou retirer un jeu (story 48.2)'
type: 'feature'
created: '2026-10-30'
status: 'done'
baseline_commit: '0162f48822172452d136eb77476ac0b11a7a7ac6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-48-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 48.1 a game can be added to the Ludothèque but never corrected or removed, so one typo or a sold game stays forever.

**Approach:** Add `PATCH`/`DELETE /me/board-games/:id` (same rules as creation, 404 on someone else's game, same after-commit emissions) and, on the Ludothèque page, a ✎ per row that opens the same entry inline, prefilled, with « Enregistrer » and « Retirer de mon cabinet / coffre / râtelier »; removal is immediate with « Jeu retiré · Annuler » for a few seconds, « Annuler » recreating the game.

## Boundaries & Constraints

**Always:**
- `PATCH` partial: absent field = unchanged, `null` clears a number, `name` may not be `null`/blank. Same bounds as creation; `max ≥ min` checked on the **merged** values (400); new `nameKey` recomputed with `boardGameNameKey`; clash with another of my games → 409 (renaming a game to itself or changing only its case/accents is allowed). Response 200 with `toBoardGameDto`.
- `DELETE` → 204. Any id not owned by me (someone else's, unknown) → 404 for both routes, same message, nothing changed or emitted. Each successful write emits exactly like creation (`emitForOwner`, after commit, failure logged).
- Web: one row in edit at a time; ✎ is a button named « Modifier {nom} » (44 px). The edit row reuses the `QuickAddRow` fields and rules (max < min message, `Entrée` saves, error under the entry, fields kept); success closes it and the list stays sorted.
- ⚠️ Decision (2026-10-30): the edit row also has the existing themed `common.annuler` button (« Renoncer » / « Abandonner » / « Annuler ») next to « Enregistrer »; it and `Échap` close the edit without saving (button absent from the mockup — flagged).
- « Retirer » calls `DELETE` at once; the row disappears and a polite `aria-live` status line **between the entry row and the list** (in the page flow, no overlay — decision 2026-10-30) shows « Jeu retiré · Annuler » for 8 s. « Annuler » `POST`s the removed game's name and numbers; a 409/400 shows its message there. A new removal replaces the pending message.
- After a remove, focus goes to « Annuler »; when the message ends with focus inside it, focus goes to the name field. After save or close, focus returns to that row's ✎.
- A `changed` reload while a row is in edit keeps the typed values; if that game is gone, the edit closes. `PATCH` 404 → the list reloads and the edit closes.
- Theme keys: `board_games.remove_btn` (« Retirer de mon cabinet » / « Retirer de mon coffre » / « Retirer de mon râtelier »), `board_games.save_btn` (« Enregistrer » in the three themes, `NEUTRAL_KEYS`), `board_games.edit_aria` and `board_games.removed` / `board_games.undo_btn` (neutral, reason `// Story 48.2 : …`).
- French comments and messages; no dependency install; Docker only.

**Never:** No removal pre-confirmation (49.2 adds it); no `LibrarySheet` or `/users/:id/board-games` (48.3); nothing on events or JDR screens; no new theme token, no red, no image; identifiers `games/`, `ludotheque`, `apport` forbidden.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rename | `Azul` → `{name:' Azul Summer '}` | 200, `nameKey:'azul summer'`, numbers kept | N/A |
| Case only | `Azul` → `{name:'AZUL'}` | 200, `name:'AZUL'` | N/A |
| Clash | `Azul`, `Skull`; Skull → `'azul'` | 409 | web: theme duplicate message |
| Merged bounds | `{min:3,max:5}` → `{maxPlayers:2}` | 400 French | message under edit |
| Clear | `{durationMin:null}` | 200, `durationMin:null` | N/A |
| Null name | `{name:null}` / `{name:'  '}` | 400 | N/A |
| Foreign | other user's id, PATCH or DELETE | 404, row untouched | N/A |
| Delete | own id | 204, then GET omits it; emits | N/A |
| Undo | remove `Azul 2–4 · 40`, « Annuler » | new `Azul` with same fields | 409 → duplicate message |

</frozen-after-approval>

## Code Map

- `apps/api/src/board-games/board-games.service.ts` -- add `update(ownerId,id,dto)` / `remove(ownerId,id)`; reuse `toBoardGameDto`, `emitForOwner`, `hasPrismaErrorCode('P2002')` → 409, `NotFoundException` French. Read `{id, ownerId}` with `findFirst` in the update transaction; delete with `deleteMany({id, ownerId})` and `count === 0` → 404.
- `apps/api/src/board-games/board-games.controller.ts` -- `@Patch(':id')`, `@Delete(':id') @HttpCode(204)`; ids are `TEXT` (no `ParseUUIDPipe`: unknown → 404).
- `apps/api/src/board-games/dto/create-board-game.dto.ts` -- bounds constants; new `dto/update-board-game.dto.ts` uses `@ValidateIf(o => o.name !== undefined)` for `name` (pattern of `scenarios/dto/update-scenario.dto.ts`), `@IsOptional` for numbers.
- `packages/shared/src/index.ts:2114` -- add `UpdateBoardGameInput` (all optional) next to `CreateBoardGameInput`.
- `apps/api/test/characterization/board-games.e2e-spec.ts` -- extend with the matrix (403 anonymous too); `Harness.createUser`, `body<T>()`, `RealtimeEventsService` spy as in existing emission test.
- `apps/web/src/app/core/board-games/board-games.service{,.spec}.ts` -- add `update(id, input)` and `remove(id)` (HttpTestingController pattern there).
- `apps/web/src/app/features/board-games/board-games-page/board-games-page.{ts,html,scss,spec.ts}` -- reuse `parseOptionalNumber`, `serverMessage`, `compareGames`, `sequence` guard (bump it on local writes). Extract the entry fields into a template block or small component shared by add and edit rather than duplicating markup.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777) -- new keys.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `UpdateBoardGameInput`.
- [x] `apps/api/src/board-games/dto/update-board-game.dto.ts` + spec -- partial validation, null name refused.
- [x] `apps/api/src/board-games/board-games.{service,controller}.ts` + `board-games.service.spec.ts` -- update/remove, merged bounds, 404, 409, emissions.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` -- I/O matrix over HTTP.
- [x] `apps/web/src/app/core/board-games/board-games.service{,.spec}.ts` -- `update`, `remove`.
- [x] `apps/web/src/app/features/board-games/board-games-page/*` -- ✎, inline edit, remove, undo message and timer, focus rules, reload while editing; spec.
- [x] Three tone files + `theme-tone.service.spec.ts` -- keys and `NEUTRAL_KEYS` reasons.

**Acceptance Criteria:**
- Given a non-empty Ludothèque, when I touch ✎ on a row, then the same entry opens on that row, prefilled, with « Enregistrer » and the theme removal button.
- Given a game removed by mistake, when I press « Annuler » within 8 s, then it is back in the list with the same name, players and duration.
- Given a second tab of mine on the page, when I edit or remove a game, then that tab updates without a refresh.
- Given keyboard only, then ✎, « Enregistrer », « Retirer » and « Annuler » are reachable and the removal is announced politely.

## Implementation Notes

- `PATCH` validates the body (400) before ownership (404): a foreign id sent with an invalid body answers 400. The row lock is taken on `BoardGame` (id + owner) before the merged-bounds check.
- The entry fields of add and edit live in one `<ng-template #entryFields>` driven by an `EntryFields` class; element ids carry a per-instance prefix so `aria-describedby` stays unique.
- A `DELETE` 404 behaves like a `PATCH` 404 (list re-read, edit closed, no undo message). A refused « Annuler » replaces the button on the status line and re-arms the 8 s timer.
- `openEdit()` and `closeEdit()` (Échap, « Renoncer ») do nothing while a save/remove is in flight.
- Not done: the manual check in the three themes (Chrome session logged out, no credentials typed). Pre-existing failures outside this story: 1 API unit test (AD-9, fixed date) and 2 web `calendar-view` tests (fixed date).

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge | `board-games-page.ts` save/removeEditing/openEdit | Async result of row A lands on row B: error text, `submitting` reset, 404 closing the wrong edit, focus jump | medium | Real: `openEdit()` resets `edit.submitting` and `editingId` while a request is in flight; failure/finally paths do not check the id. Direct fix: `openEdit` and `closeEdit` do nothing while `edit.submitting()` | patch |
| 2 | blind | `board-games-page.ts` closeEdit | Renoncer/Échap during an in-flight save looks like a cancel but the PATCH still lands | low | Real; same one-line guard as #1 | patch |
| 3 | blind | tone `common.annuler` vs `undo_btn` | Two « Annuler » in Atelier Cuivré | low | « Jeu retiré · Annuler » is validated copy (EXPERIENCE.md §3.2); fixing means changing a validated label. Rejected | reject |
| 4 | blind | undo timer | 8 s window not extendable (WCAG 2.2.1) | low | Spec fixes « quelques secondes » / 8 s by decision; the fix edits the frozen spec. Rejected | reject |
| 5 | blind | undo | Undo recreates (new id, two emissions) rather than restores | low | Imposed by the epic AC (« Annuler recrée le Jeu »); nothing references a game id yet. Rejected | reject |
| 6 | blind, edge, vgap | `board-games-page.ts` undo() | `if (removed() !== game) return` after `create` resolves drops the recreated game from the list when a newer removal replaced the message | medium | Real: server created it, list only catches up via the SSE echo. Direct fix: `insertLocally(created)` before that guard | patch |
| 7 | blind | undo() after destroy | `catch` arms a timer after component destruction | low | Needs destruction during an in-flight create and a refused one; timer only calls `endRemovedMessage`. Rejected | reject |
| 8 | blind, edge | `EntryFields.values()` | PATCH sends all four fields, overwriting a change made in another tab to an untouched field | low | Real but needs two tabs editing the same game inside one open edit; fix adds a diff against the loaded game. Rejected | reject |
| 9 | blind, edge | `update()` empty/unchanged body | A no-op PATCH still writes and emits | low | Real but harmless (other tabs reload); a server-side comparison adds branches. Rejected | reject |
| 10 | blind | service spec | Lock only checked through SQL text | false | Same convention as 48.1 `create` lock test (`board-games.service.spec.ts:170`); vgap layer checked it and did not file it | reject |
| 11 | blind | service spec | Missing API tests (update emission failure, cap on undo, odd ids) | low | Update shares `emitForOwner` with create and remove, both tested; no named regression. Rejected | reject |
| 12 | blind | `update-board-game.dto.ts` | Validators duplicated from the create DTO | low | Same pattern as the repo's `update-scenario.dto.ts`; constants are shared. Rejected | reject |
| 13 | blind | page template | `ng-template` context untyped | low | Fix adds a context-guard directive. Rejected | reject |
| 14 | blind | page | DOM `querySelector` focus helpers | low | Covered by the page spec's focus assertions. Rejected | reject |
| 15 | blind | html/scss | Dead class `quick-add__remove` (no rule) | low | Real: used at html:99, no scss rule. Direct deletion | patch |
| 16 | blind | scss | Hard-coded colour fallbacks, absolute `--idle` | false | Same fallbacks as the 48.1 list styles; the idle region is the visually-hidden pattern | reject |
| 17 | blind | api | DELETE retried after a lost response answers 404 | false | The page treats a 404 as « already gone » and reloads | reject |
| 18 | blind | docs | No docs/checklist update in the diff | false | Page and service were wired on `user:` in 48.1; this story adds no new scoped component | reject |
| 19 | vgap | page spec | No test of a failed DELETE (500/400 and 404) from « Retirer » | medium | Real: all five remove tests mock `remove` as resolved; dropping the `return` after the catch passes every test | patch |
| 20 | vgap | page spec | Refused undo: timer re-arm unpinned | low | Real: deleting `startUndoTimer()` in the catch leaves the message forever and no test fails. One fake-timer assertion | patch |
| 21 | edge | `openEdit()` | Switching rows silently discards typed corrections | low | By design (one edit at a time); keeping or asking first needs dirty tracking. Rejected | reject |
| 22 | edge | `parseOptionalNumber` | Unparsable text in a number field saves as `null` | low | Same root as 48.1 triage #12 (rejected); `carried` | reject |
| 23 | edge | controller | Path id with a NUL byte → 500 instead of 404 | low | Real for a crafted request only; no data exposed, no JDR/ownership effect. Guard adds a branch. Rejected | reject |
| 24 | edge | `save()` 404 | `closeEditAfterLoss` closes whichever row is open now | medium | Same root as #1 (fixed by it) | patch |
| 25 | edge | `save()` success | Focus pulled to the old row's ✎ after Échap/other row | low | Same root as #1 (fixed by it) | patch |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green.
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (never two pnpm commands in parallel across containers).

**Manual checks:**
- In the three themes, at 360 px and ≥ 768 px: edit row, removal, undo line, keyboard path.
