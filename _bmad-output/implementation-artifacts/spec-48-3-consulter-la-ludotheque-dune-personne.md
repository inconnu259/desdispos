---
title: 'Consulter la Ludothèque d''une personne (story 48.3)'
type: 'feature'
created: '2026-10-30'
status: 'done'
baseline_commit: '48d4563201918c935006ea399c371e1755444f10'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-48-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A person's Ludothèque (48.1–48.2) can only be read by its owner, so nobody knows who has the game they would like to try, or whom to ask.

**Approach:** Add `GET /users/:userId/board-games`, guarded by a new `LIBRARY_READ` decision made only in `PermissionService` (refusal = 404), and a read-only `LibrarySheet` bottom drawer opened by touching a person's name in the three places names are inert today.

## Boundaries & Constraints

**Always:**
- `LIBRARY_READ` target `{ userId }`, decided only in `permissions/`; no visibility rule recoded in `board-games/`. Allowed when reader = owner, OR both hold a `Membership` in the same `ralliement`-family Partie, OR both are, in the same isolated encounter (`ONE_SHOT` ralliement Partie), host (`Partie.ownerId`), member, or invitee with `Invitation.status = PENDING`. Nothing else opens: JDR party, `DECLINED`/`REVOKED` invitation, unused `InviteLink`, unknown user. **Every** refusal, unknown user included, is the same 404 and message. The closed-union convention applies if it fits; else a dedicated `assertLibraryRead`, noted in Implementation Notes. The encounter's own state (cancelled, past) is not considered.
- Response `UserLibraryDto { owner: { userId, pseudo, displayName }, games: BoardGameDto[] }` through an explicit mapper, games sorted like `listMine`; never an e-mail. Same single-writer module `board-games/`; reuse `toBoardGameDto`.
- ⚠️ Names become buttons at (accessible name, decision 2026-10-30, themed key `board_games.open_aria`: « Voir le cabinet de {nom} » / « Voir le coffre de {nom} » / « Voir le râtelier de {nom} »): (a) non-pending, non-own `ParticipantChip` in the conjonction detail (`event-dialog`); (b) rows of the `Missives` tab of a group and (c) of the `Invités / Invitations` tab of an isolated encounter, both in `partie-detail.html` (`ralliement-members`), own row excepted; 44 px. Existing buttons of a row stay separate. The JDR `Missives` tab is unchanged.
- ⚠️ `LibrarySheet`: standalone component; modal bottom drawer at every width: backdrop, fixed bottom surface, radius 18 px top, `surface-container-high`, 40×4 px grip; `cdkTrapFocus`; `Échap` (stopping propagation so a host dialog stays open), backdrop and swipe-down on the grip/title (pointer events) close it, and — decision 2026-10-30, flagged ⚠️ (absent from the mockup) — a visible 44 px « Fermer » button in the header, so touch screen-reader users can close it; focus returns to the touched name; stacks above `DetailSurface` (z 199/200). Title « Cabinet / Coffre / Râtelier de {nom} · {n} », loan line, read-only rows with `formatBoardGameMeasures`, no truncation, scrolls past 80 vh. Empty library (decision 2026-10-30, themed key): « Le cabinet de {nom} est vide. » / « Le coffre de {nom} est vide. » / « Le râtelier de {nom} est vide. », nothing else.
- The sheet re-reads while open on `BoardGamesService.changed`; add a `partie:` handler in `RealtimeService` calling `notifyChanged()`; stale reads ignored (sequence). A 404 on read shows the neutral `board_games.error_fallback`.
- Theme keys in the three tone files; neutral ones in `NEUTRAL_KEYS` with a `// Story 48.3 : …` reason. French comments and messages; no dependency install; Docker only.

**Never:** No write action in the sheet; nothing on JDR party screens; no e-mail in any DTO; no `OwnerLink` outside this story's three places (epic 49 adds it); no new theme token, no red, no image; identifiers `games/`, `ludotheque`, `apport` forbidden.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own | reader = owner | 200 own library | N/A |
| Shared group | both members of a ralliement group | 200 `{owner, games}` | N/A |
| Encounter accepted | both members of one isolated encounter | 200 | N/A |
| Encounter pending | reader = host, owner invited `PENDING` (and reverse) | 200 | N/A |
| Encounter declined | owner's invitation `DECLINED` or `REVOKED` | 404 | web: neutral error |
| JDR only | share only a JDR party | 404 | N/A |
| Unused link | owner never joined via `InviteLink` | 404 | N/A |
| Unknown | random id | 404, same body as above | N/A |
| Empty library | allowed, no games | 200, `games: []` | sheet shows the themed empty line only |
| Privacy | any 200 | body has no `email` | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/permissions/permission.service.ts` -- `PermissionTarget` (:38), `assert` (:551), `refusalFor`, `roleOf`; no 404-on-refusal path today. `packages/shared/src/index.ts` ~:281 `PermissionAction` closed union; tables `JDR_POLICY`/`RALLIEMENT_POLICY` are `Record<PermissionAction,…>`; `permission.service.spec.ts` hard-coded lists (~:100-190).
- `apps/api/prisma/schema.prisma` -- `Membership` :221 (`userId_partieId`), `Invitation` :234 (`inviteeUserId`, `status`), `Partie` :66 (`kind`, `gameSystemId`, `ownerId`). Isolated encounter = `ONE_SHOT` + ralliement family (`isRalliementGroup`, `parties.service.ts:259`); ralliement ids idiom `board-games.service.ts:25`.
- `apps/api/src/permissions/no-direct-owner-read.spec.ts` -- forbids `ownerId`/`.owner` outside `permissions/`; `board-games/` already excepted.
- `apps/api/src/board-games/board-games.{controller,service}.ts` -- add `@Controller('users')` route `:userId/board-games` (new controller file; ids are TEXT, no pipe), reuse `listMine` ordering; `permissions.module.ts` is transverse (Prisma only).
- `apps/api/test/characterization/{harness,board-games.e2e-spec}.ts` -- `createPartie(owner, kind, label, 'ralliement')`, `addMember`; invitations helper to find.
- `apps/web/src/app/core/board-games/board-games.service.ts` -- add `listOf(userId)`; `core/realtime/realtime.service.ts` (:87-120) add `partie:` handler (+ its spec mocks).
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{html:240-258,scss:117-158}` -- inline drawer recipe to copy (backdrop, `role="dialog"`, `cdkTrapFocus`, Escape); `DestinyList` itself is a plain list, not a shell. `calendar/destiny-sheet/destiny-sheet.scss:21,52` -- 18 px radius and 40×4 grip.
- `apps/web/src/app/shared/detail-surface/` -- host of `event-dialog`, z 199/200, does not return focus.
- `features/events/participant-chip/participant-chip.{html,ts}`; `features/events/event-dialog/event-dialog.html:218-249`; `features/parties/partie-detail/partie-detail.html:466-515` + `shared/identity/identity-label` (wrap, do not edit other users).
- `features/board-games/board-game-measures.ts` -- `formatBoardGameMeasures`, `formatBoardGameCount`; tones `core/theme/tones/*.ts` + `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777, `VOICED` ~:2282); `fillTone` in `core/theme/tone-format.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `UserLibraryDto`, `LIBRARY_READ` wiring.
- [x] `apps/api/src/permissions/*` -- `LIBRARY_READ` decision + matrix tests.
- [x] `apps/api/src/board-games/*` -- route, service method, mapper, unit tests.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` -- I/O matrix over HTTP.
- [x] `apps/web/src/app/core/board-games/*`, `core/realtime/*` -- `listOf`, `partie:` handler, specs.
- [x] `apps/web/src/app/features/board-games/library-sheet/*` -- component, swipe, focus, spec.
- [x] `participant-chip`, `event-dialog`, `partie-detail` + specs -- names as buttons opening the sheet.
- [x] Three tone files + `theme-tone.service.spec.ts` -- keys, `NEUTRAL_KEYS`.

**Acceptance Criteria:**
- Given a member of a group, when they touch another member's name in the conjonction detail or `Missives`, then `LibrarySheet` opens with that person's games and the loan line; closing returns focus to that name.
- Given an isolated encounter, when the host or an invitee touches a name in `Invités / Invitations`, then the sheet opens; a declined invitee's library answers 404.
- Given the sheet is open and the owner adds a game, then the list updates without closing.
- Given a JDR party screen, then no name there became a button.

## Implementation Notes

- Review (2026-10-30): human decision adds a visible neutral « Fermer » button (`board_games.sheet_close`) to the sheet header, absent from the mockup; the dialog name falls back to `board_games.error_fallback` in the error state.
- Flagged for the human, not changed (frozen decisions): a `PENDING` invitee opens libraries before accepting, and a cancelled or past encounter keeps mutual access. Not seen in a browser: three themes, 360/768 px, swipe on a touch device.

- `LIBRARY_READ` n'entre pas dans l'union fermée `PermissionAction` : ses tables `JDR_POLICY` / `RALLIEMENT_POLICY` sont indexées par RÔLE SUR UNE PARTIE, alors que cette décision porte sur deux personnes. Décision dédiée `PermissionService.assertLibraryRead(readerId, ownerUserId)` (un seul `findFirst` sur `Partie`, 404 `LIBRARY_NOT_FOUND_MESSAGE` pour tout refus) ; la constante `LIBRARY_READ` et `UserLibraryDto` sont dans `@master-jdr/shared`. La liste des systèmes `ralliement` y est lue à l'appel, non à l'import (un spec mocke `@master-jdr/shared`).
- Titre de la feuille : `{n}` est le nombre brut (« Cabinet de Zoé · 12 »), tel que l'écrit la spec. Ludothèque vide : la ligne du thème seule, sans titre ni ligne de prêt. Aucune clé neutre n'est ajoutée : les quatre clés (`open_aria`, `sheet_title`, `sheet_loan`, `sheet_empty`) sont voisées.
- Deux homonymes dans « Missives » : le `{nom}` du bouton et de la feuille porte le pseudo, « Même Nom (bob) ».
- `RealtimeService` : le handler `partie:` ajouté relance aussi la page « Ma Ludothèque » sur tout `partie:` reçu (relecture idempotente, la page ne se connecte qu'à `user:`).

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge | `assertLibraryRead` | `PENDING` invitee opens libraries before consenting | low | Imposed by the epic AC and the frozen matrix (« en attente → 200 »); fix edits the spec. Flagged to the human in the summary. Rejected | reject |
| 2 | blind, edge | `assertLibraryRead` | Cancelled/past encounter or stale `PENDING` still opens access | low | Frozen decision (« encounter state is not considered »). Rejected | reject |
| 3 | blind | `UserLibraryController` | No throttling / id bound on the new route | false | `ThrottlerGuard` is a global `APP_GUARD` (`app.module.ts:65`) | reject |
| 4 | blind, edge | `shared` `LIBRARY_READ` | Exported constant not referenced by code | low | Imposed identifier of the epic; no behaviour at stake. Rejected | reject |
| 5 | vgap, blind, edge | `emitForOwner` | A `PENDING` invitee (no `Membership`) writing a game emits no `partie:`: host's open sheet does not refresh | low | Real but niche (invitee pending + host watching + live write); the sheet re-reads on every open and the emission rule is 48.1's. Fix adds an invitation query branch. Rejected | reject |
| 6 | blind, edge, vgap | `realtime.service.ts` `partie:` | Every `partie:` message bumps `changed`: extra GETs while a sheet is open, page re-reads | low | Only subscribers mounted at the time react (sheet, Ludothèque page, never on a partie screen together); the spec decided this wiring. Rejected | reject |
| 7 | blind | `library-sheet` | No visible close control | medium | Real a11y gap (touch screen readers cannot Escape or swipe). Human decided 2026-10-30: add « Fermer » | patch |
| 8 | blind, edge | `library-sheet` | Dialog name stays « Voir le cabinet de X » in the error state | low | Real and reachable (404); one-line fix on `dialogLabel` | patch |
| 9 | blind, edge | `library-sheet` | Blank sheet while the first read is in flight | low | Short, needs a new themed copy; the validated empty state is « nothing suggested ». Rejected | reject |
| 10 | blind | `UserLibraryDto.owner` | `owner` not used by the sheet (host-supplied name shown) | low | Required by the frozen DTO (pseudo + displayName); costs one indexed read. Rejected | reject |
| 11 | blind, edge | `library-sheet` Escape | No `isComposing` / `defaultPrevented` check, no scroll lock, no exit animation, hard-coded z-index and colour fallback | low | No text input in the sheet; stacking is above `DetailSurface` as specced. Rejected | reject |
| 12 | blind, edge | `library-sheet` | Older read dropped when a newer one fails; previous person's games shown if `userId` changes | low | The sheet is created per opening and modal, so neither can occur. Rejected | reject |
| 13 | edge | `partie-detail.html` | Sheet inside lazy `mat-tab` content | low | Modal backdrop blocks tab switching while open. Rejected | reject |
| 14 | blind, edge | entry points | Buttons offered for people whose library answers 404 | low | Event participants and listed members all hold a `Membership` or hosting role, which the rule opens; the 404 path shows the error line. Rejected | reject |
| 15 | edge | chip / row | Own chip or row briefly a button while `currentUser()` is null | false | Route sits under `authGuard`, which resolves the user first (48.1 triage #14) | reject |
| 16 | edge | controller | NUL byte in `:userId` → 500 instead of 404 | low | Same root as 48.2 triage #23 (rejected); `carried` | reject |
| 17 | edge | `realtime.service.spec` | Retired 48.1 test « user: only » | false | Replaced by two tests that state the new contract (`user:` and `partie:`) | reject |
| 18 | edge | `z-index` | Sheet would sit under a `MatDialog` host | false | No `MatDialog` hosts it; hosts are `DetailSurface` and a `mat-tab` | reject |
| 19 | edge | focus return | Trigger re-rendered by a refresh → focus on body | low | Same as 48.2 class of DOM-query findings; needs a refresh during the open sheet. Rejected | reject |
| 20 | blind | tests | Brittle `JSON.stringify` query test; missing e2e (former member, `ACCEPTED` without row, cancelled) | low | The HTTP matrix runs the real database (vgap checked: flipping the status filter, `ONE_SHOT` or ralliement filter fails it); those states cannot exist or are frozen | reject |
| 21 | blind | `fillTone` | A display name containing `{n}` is replaced by the count | false | `fillTone` is a single-pass regex replace (`tone-format.ts`) | reject |
| 22 | blind | `board-games.service.ts` | Writer service depends on `PermissionService`; `g.family` vs `familyOf` | low | Imposed by « no visibility rule recoded in board-games/ »; no behaviour at stake | reject |

## Design Notes

`DestinyList` is a plain list; the modal drawer the epic cites is inline in `CalendarView` with no grip or swipe, so `LibrarySheet` is a new standalone shell built from `DESIGN.md` §7.6 (⚠️ deviation from « reuses the `DestinyList` drawer », same look).

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 2 `calendar-view` fixed-date tests); never two pnpm commands in parallel.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: open from each entry point, swipe/Échap/backdrop, focus return, keyboard.
