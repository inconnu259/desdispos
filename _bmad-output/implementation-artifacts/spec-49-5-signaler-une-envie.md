---
title: 'Signaler une Envie (story 49.5)'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: '43e884f18c776cf696b9061018b9bde9f3c99e1e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-49-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the games tab people cannot say which game they most want to play tonight, so choosing is slow and nobody knows whether an idea really pleases.

**Approach:** Add `EventGameEnvy` keyed on `nameKey`, `PUT/DELETE /events/:eventId/envies` under a new `EVENT_GAME_ENVY` permission and the event lock, Envies in the games read, a ♥ toggle with a count on every on-site row, and a « Les plus appelées » sort chip; Envies are purged whenever a game stops being on site or its holder stops attending.

## Boundaries & Constraints

**Always:**
- Prisma `EventGameEnvy(id uuid, eventId, userId, nameKey, createdAt)`, `@@unique([eventId, userId, nameKey])`, `@@index([userId])`, cascade FKs on `Event` and `User` (no `BoardGame` FK); migration `20261102120000_event_game_envy`; back-relations on `Event` and `User`; `events/` is the only writer.
- `EVENT_GAME_ENVY` in `PermissionAction`, `JDR_POLICY` (nobody), `RALLIEMENT_POLICY` (admin + member), not host-only, and in the hard-coded lists of `permission.service.spec.ts` (describe in the `EVENT_GAME_BRING` style).
- « On site » = `nameKey` of the host's games minus `EventGameExcluded` ∪ `nameKey` of the Brings of the event. One pure function `onSiteNameKeys` (new file in `events/`) is the single definition, used by the write check, the purge and the read. `nameKey`s are read through new `BoardGamesService` methods (`nameKeysOfOwner`, `nameKeysByIds`, both taking a transaction client); `events/` never reads `BoardGame` directly.
- New `EventGameEnvyService` in `events/` (own spec; lock skeleton of `EventGameExclusionService.write`). `PUT` and `DELETE` body `{ nameKey }` validated by a DTO (string, 1–80, already normalised: `boardGameNameKey(nameKey) === nameKey`, else 400 French; never re-normalised silently). Under `SELECT … FOR UPDATE` on the `Event` row, `PUT` refuses in this order, one denial test each: cancelled 400 → finished/past 400 → caller not in `participantsOf` (RESERVED included) 403 → `nameKey` not on site 400. `DELETE` keeps the lock and the closed-evening refusals but skips the participant and on-site checks (removing one's own row is harmless). Both answer 204, idempotent; non-ralliement refused like Bring. After commit, outside the transaction, emit `partie:{partieId}` (try/catch + `logger.warn`).
- Purge, in the same transaction as the write: a helper `EventsService.releaseOrphanEnviesInTx(tx, eventId)` deletes the event's Envies whose `nameKey` is no longer on site, called after `exclude()` (49.4), after `unbring()` (49.2), and after the Brings deletion in `releaseGameBringsInTx` for each locked event (49.3 paths: unregistration, reservation withdrawal, departure/removal/account deletion). A `nameKey` still held by another source (host copy, another bringer) survives. `EventsService` receives `BoardGamesService` for this (update the specs that construct it).
- The 49.3 paths also delete the departing person's **own** Envies on those events: `releaseGameBringsInTx` finds events from the person's Brings ∪ Envies (it no longer stops when they hold no Brings), same scope `where`, same sorted locks.
- Read: `EventBoardGamesDto.envies: EventEnvyDto[]` (always present, `[]` on a closed evening), `EventEnvyDto = { nameKey, users: { userId, pseudo, displayName }[] }`, only on-site names and current participants, stable order (`nameKey`, then pseudo), never an email. An Envy whose name left the site is ignored at read (covers Ludothèque deletions and renames; a rename leaving an old Envy behind is an accepted limitation, noted).
- Web (`EventGamesTab`/`GameRow`): on host rows and « Apportées » rows (not « Dans mon … », not set-aside rows) an `EnvyToggle`: ♥ alone with no Envie, « ♥ {n} » otherwise; the ♥ is a button with `aria-pressed` and accessible name « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} » (singular/plural unit keys); touching the count (a second 44 px button) opens a small overlay listing the names (displayName, « moi » for me; `role="dialog"` with an `aria-label`, `Échap`/backdrop close, focus returns to the count). The same `nameKey` on two rows shows the same Envie on both (lookup per received `nameKey`). Only a Participant (`canFill`) can toggle; a read-only viewer sees the count (names menu) but no ♥ toggle. Toggle is optimistic with its own busy guard keyed by `nameKey`, silent failure + reload, as for Bring.
- `GamesSummary` gains a second chip « Les plus appelées / Les plus attendus / Les plus demandés » (`aria-pressed`, hidden when there is no game on site), cumulable with « Jouables à N »: inside each section, sort by Envies descending then alphabetical; it never changes the « k sur n » counts (only the fit filter does).
- Themed keys (3 distinct voices, not in `NEUTRAL_KEYS`): Envie button (« Cette relique m'appelle / J'ai envie d'y jouer / Je veux l'essayer »), unit singular and plural (« appel(s) / envie(s) / demande(s) »), sort chip; neutral keys (count button and names menu aria) in `NEUTRAL_KEYS` with `// Story 49.5 : …`. Contrast (decision 2026-11-01): the active ♥ and count TEXT use `color-mix(in srgb, var(--jdr-accent-2) 55%, var(--jdr-text))` in the three themes (≥ 4.5:1 required; raw `accent-2` text measures ≈ 3.3:1 in Atelier Cuivré), while border and fill stay raw `accent-2`; the measured ratios of the final text in the three themes are written in Implementation Notes (surfaces: row `surface-container`, `surface-container-high`, and the active-state fill). No new theme token, no red, no image; 44 px targets; 640 px column.
- French comments and messages; no dependency install; Docker only.

**Never:** No Envie on « Dans mon … » or set-aside rows; no Envie by `boardGameId`; nothing on JDR screens; identifiers `games/`, `ludotheque`, `apport` forbidden; no email in any DTO; no purge from `board-games/` writes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Envy | participant PUTs `azul` (on site) | 204; `envies` lists them; `partie:` emitted | N/A |
| Unenvy | DELETE | 204; gone | absent → 204 |
| Repeat PUT | already there | 204, one row | N/A |
| Off site | `nameKey` held by no source | 400 | no write |
| Not participant | stranger, unregistered member, `RESERVED` | 403 | no write |
| Closed | cancelled / past / finished | 400 | no write |
| Bad key | `' Azul '`, `''`, 81 chars | 400 French | no write |
| Two sources | host + guest hold `azul`, guest unbrings | Envies survive | N/A |
| Last source | host sets aside `azul`, no Bring | all its Envies deleted, same transaction | rollback keeps them |
| Last Bring | only a guest's Bring of `azul`, unbrought | Envies deleted | N/A |
| Own exit | Zoé (no Brings) has Envies, unregisters or leaves | her Envies gone, others' kept | past evening kept on leave |
| Read | any viewer | only on-site names, participants only | closed → `[]` |
| Sort | « Les plus appelées » on | per section: count desc, then A→Z; « k sur n » unchanged | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `EventGameBring` ~:794, `EventGameExcluded` ~:813 (style), `Event` ~:623, `User` ~:55 (back-relations); latest migration `20261101120000_event_game_excluded`.
- `packages/shared/src/index.ts` -- `PermissionAction` ~:373, `EventBoardGamesDto` ~:2149 (+ `UserLibraryOwnerDto` identity shape ~:2122).
- `apps/api/src/permissions/permission.service.ts` / `.spec.ts` -- `JDR_POLICY` ~:238, `RALLIEMENT_POLICY` ~:365, lists `JDR_NOBODY` ~:179, `RALLIEMENT_VIEW` ~:500, `EVENT_GAME_BRING` describe ~:747.
- `apps/api/src/events/event-game-exclusion.service.ts` (`exclude` :50, `write` :88-137 skeleton), `event-game-bring.service.ts` (`unbring` :69), `event-board-games.service.ts` (read, closed branch :62-64, ctor + spec ~:60-70), `events.service.ts` (`releaseGameBringsInTx` :1792-1816 with its early return :1808, call sites :1642/:1714; ctor :365 gains `BoardGamesService`), `events.controller.ts` ~:102, `events.module.ts`; `parties/parties.service.ts` :672.
- `apps/api/src/board-games/board-games.service.ts` -- `ownedGameIds` :127 (pattern for `db` client); DTO style `board-games/dto/create-board-game.dto.ts` (`BOARD_GAME_NAME_MAX`), spec `create-board-game.dto.spec.ts`.
- Specs constructing `EventsService` with `new`: `availability.service.spec.ts:58`, `notifications.service.spec.ts:47`, `events.service.spec.ts:139`, `parties.service.spec.ts:315/3325/3337`; `events.service.spec.ts` `releaseGameBringsInTx()` describe ~:2258; `parties.service.spec.ts` `leave()` ~:1892; e2e `board-games.e2e-spec.ts` 49.2–49.4 describes (~:833, :1176-1334, :1363), `account-deletion.e2e-spec.ts` ~:144/:223.
- `apps/web/src/app/features/events/event-games-tab/*` -- `game-row.ts` (`.gr__head`, ⋮ at -7px margin, inputs/outputs), `event-games-tab.{ts,html}` (`RowView` :60, `hostItems` :263, `broughtItems` :276, `mineItems` :299 no ♥, `holders` :217, `canFill` :210, `write()` :542, `setAside()` :476, overlay + `menuItems()` ~:401-424, `ROW_MENU_POSITIONS` :41), `games-summary.ts` (`fitOnly` model, chip), `events-api.service.ts` (+ spec: `envy`, `unenvy` with `body`).
- Tokens: `apps/web/src/styles.scss` (`--jdr-accent-2`, `--jdr-accent-2-rgb`, `--mat-sys-surface-container(-high)`); hex per theme: grimoire accent-2 `#9b6dff` on `#1a1428`, forêt `#f0c040` on `#0f1f12`, atelier `#4a7c59` on `#2a1e10`.
- `core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS`, Story 49 block ~:1166, `VOICED` ~:2428); `DESIGN.md` §7.3/7.4, `EXPERIENCE.md` §3.1/§4/§5.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/*` -- model, back-relations, migration `20261102120000_event_game_envy`.
- [x] `packages/shared/src/index.ts`, `apps/api/src/permissions/*` -- `EVENT_GAME_ENVY`, `EventEnvyDto`, `envies`, policy cells, spec lists + describe.
- [x] `apps/api/src/board-games/*` -- `nameKeysOfOwner`, `nameKeysByIds` + specs.
- [x] `apps/api/src/events/*` -- `on-site-name-keys.ts`, `EventGameEnvyService` + DTO + routes + module, `releaseOrphanEnviesInTx`, extended `releaseGameBringsInTx`, purge calls in `exclude`/`unbring`, read extension; update every spec that builds `EventsService`.
- [x] `apps/api/test/characterization/*` -- I/O matrix over HTTP (one denial per case, purge per path, own-Envy purge per exit path, cascade on Event and User, read, emission).
- [x] `apps/web/.../event-games-tab/*`, `events-api.service.ts` -- toggle, count and names overlay, summary chip and sort, specs.
- [x] Three tone files, `theme-tone.service.spec.ts`, `styles` -- keys, contrast treatment, measured ratios in Implementation Notes.

**Acceptance Criteria:**
- Given an on-site game on an open evening, when a participant touches ♥, then it becomes pressed with « ♥ 1 », others see the count, and the same name on a second row shows the same Envie.
- Given a name held by no source any more (set aside, last Bring withdrawn, the only holder left), then its Envies are gone and a PUT for it is refused with 400.
- Given a person who stops attending, then their own Envies on those evenings are deleted with their Brings; another person's Envies are untouched.
- Given « Les plus appelées » on together with « Jouables à N », then each section is sorted by Envies then A→Z and the « k sur n » counts follow only the fit filter.
- Given any JDR party screen, then nothing of this story appears.

## Implementation Notes

**Contraste mesuré (WCAG, Python, sRGB)** — texte actif = `color-mix(in srgb, accent-2 55%, text)`, remplissage actif = `accent-2` 16 % sur la surface de la ligne. Surfaces : ligne `surface-container`, `surface-container-high`, remplissage actif sur chacune.

| Thème | texte final | / `surface-container` | / `surface-container-high` | / remplissage actif (ligne) | / remplissage actif (high) | `accent-2` brut / ligne |
|---|---|---|---|---|---|---|
| Grimoire Émeraude | `#bea1f8` | 8,21 | 7,50 | 6,66 | 6,03 | 5,13 |
| Forêt Ancienne | `#e3d686` | 11,62 | 9,57 | 8,18 | 6,71 | 10,06 |
| Atelier Cuivré | `#95ac8f` | 6,64 | 5,63 | 5,67 | 4,85 | 3,34 (raw, refusé) |

Tous ≥ 4,5:1. Bordure et remplissage restent en `accent-2` brut.

**Choix et limites**
- `onSiteNameKeys` prend `{ hostGames: {id, nameKey}[], excludedIds, bringNameKeys }` (les écarts se retirent par identifiant de jeu) ; `BoardGamesService.nameKeysOfOwner(ownerId, tx)` rend donc `{id, nameKey}[]`. Écriture/purge : tous les apports de la soirée ; lecture : apports des participants actuels (états équivalents, les sorties purgent les apports).
- `EnvyToggle` : ♥ (pastille 28 px dans une cible de 44 px) + compte (second bouton de 44 px, texte souligné en pointillé). Lecteur en lecture seule : un seul bouton « ♥ n ». Sous « Les plus appelées », « Dans mon … » garde son ordre alphabétique (ses lignes n'ont pas d'Envie).
- Renommage d'un jeu dans la Ludothèque / suppression : l'Envie laissée est ignorée à la lecture (limite acceptée, pas de purge depuis `board-games/`).
- `RALLIEMENT_SYSTEM_IDS` de `board-games.service.ts` est lu à l'appel (et non à l'import) : `events.service.ts` importe désormais ce module, et un spec double `@master-jdr/shared` sans `GAME_SYSTEMS`.
- Non vérifié : contrôle visuel en navigateur (extension Chrome non connectée) — trois thèmes, 360 / ≥ 768 px, clavier, à faire à la main.

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge | `envyNamesOpen` / `closeEnvyNames` | When the last Envie disappears the overlay hides but `envyNamesGame` stays set: a later Envie reopens it unprompted, anchored on a destroyed button; also when the row leaves | medium | Real: an SSE reload makes the sequence easy. Direct fix: clear `envyNamesGame` when its list empties or its row is gone | patch |
| 2 | blind | `DELETE …/envies` | Payload carried in a request body | low | Frozen by the epic AC (« corps : `nameKey` »). Rejected | reject |
| 3 | blind, edge | stale rows | Ludothèque deletion, rename or host-account deletion leave Envie rows that only the read hides; schema comment says « purgée » | low | Accepted by the AC and the spec (« ignorée à la lecture », noted as a limitation); the e2e pins it. Rejected | reject |
| 4 | blind | `releaseGameBringsInTx` | Per-event queries under locks; name no longer fits | low | One departure touches a handful of evenings; rename is churn. Rejected | reject |
| 5 | blind | `EventsService` ctor | Gains `BoardGamesService`, stubs in unrelated specs | low | Frozen by the spec (« `EventsService` receives `BoardGamesService` »). Rejected | reject |
| 6 | blind | `ralliementSystemIds()` | Constant turned into a function | low | Needed so partial mocks of `@master-jdr/shared` still load; negligible cost. Rejected | reject |
| 7 | blind, edge | `closedAt` | Read from the pre-lock grant | low | Same accepted limit as 49.2 and 49.4. Rejected | reject |
| 8 | blind | a11y | Heart label built by concatenation, « 0 appel » | low | The AC fixes the name « {libellé} — {jeu}, {n} {unité} », n = 0 included. Rejected | reject |
| 9 | blind | layout | Three 44 px targets in the row head at 360 px | low | On the manual checks (as for 49.4). Rejected | reject |
| 10 | blind | DTO | Validator normalises oversized input; constant imported from another DTO | low | Bounded request body; trivial cost. Rejected | reject |
| 11 | blind | tests | No lock-serialisation, `hostId: null` read or dialog Tab tests | low | Lock order is unit-pinned in the repo's style. Rejected | reject |
| 12 | edge | `setEnvy` | `reload()` rejection unhandled | false | `reload()` catches its own errors (49.2 behaviour) | reject |
| 13 | edge | busy guard | A second tap during a write is dropped | low | Intended double-tap guard, same as Bring. Rejected | reject |
| 14 | edge | `listFor` | Large `IN` list of names | low | A Ludothèque holds at most 500 games. Rejected | reject |
| 15 | edge | DTO bound | A key longer than 80 for a valid 80-char name | false | `boardGameNameKey` only strips marks and collapses spaces: never longer than the name | reject |
| 16 | edge | return value | `releaseGameBringsInTx` returns Brings only | low | Callers emit unconditionally. Rejected | reject |
| 17 | vgap | `account-deletion.e2e` | The `User` cascade of `EventGameEnvy` is not exercised: the account e2e passes with the application purge alone | medium | Real (vgap demonstrated it: `Restrict` would still pass); a person with an Envie on a past evening could fail to delete their account unnoticed. Add the e2e next to the Bring assertions | patch |

## Design Notes

The « on site » set is a pure function over data the three callers already hold, so the write check, the purge and the read can never disagree. Keying Envies on `nameKey` (not a game id) is what lets the same name on two rows, or a name that returns, share one wish.

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` then `pnpm exec prisma generate` and `prisma migrate status` -- expected: up to date.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 3 date-dependent calendar tests); never two pnpm commands in parallel. Restart the `api` container before browser checks.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: ♥ and count by keyboard, names overlay, duplicate name on two rows, sort chip with the fit chip, read-only viewer, text legible on the active state.
