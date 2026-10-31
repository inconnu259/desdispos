---
title: 'Écarter un jeu pour ce soir (hôte) (story 49.4)'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: '76407417677acab31712b9d6aeb2adc2b1b1f56e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-49-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A host whose game is unavailable on a given evening (lent out, left at home) cannot say so: everyone still counts on it.

**Approach:** Add `EventGameExcluded`, `PUT/DELETE /events/:eventId/board-games/:boardGameId/exclusion` under a new host-only `EVENT_GAME_EXCLUDE` permission and the event lock, and on the games tab a ⋮ menu on the host's own games with one entry that sets the game aside for that evening, plus a host-only bottom section to put it back.

## Boundaries & Constraints

**Always:**
- Prisma `EventGameExcluded(id uuid, eventId, boardGameId, createdAt)`, `@@unique([eventId, boardGameId])`, `@@index([boardGameId])`, cascade FKs on `Event` and `BoardGame` (no `User` FK); hand-written migration `20261101120000_event_game_excluded`; back-relations and doc comments on `Event` and `BoardGame`; `events/` is the only writer. Deleting a game from the Ludothèque removes its exclusions by cascade (e2e).
- `EVENT_GAME_EXCLUDE` added to `PermissionAction`, `JDR_POLICY` (nobody), `RALLIEMENT_POLICY` (admin + member) and `HOST_ONLY_ACTIONS` (the « hôte » rule: a non-host answers 403 `HOST_ONLY_MESSAGE`, an event without host is refused to all), and to every hard-coded list in `permission.service.spec.ts` (host-only describe in the style of `EVENT_UPDATE — hôte seul`).
- New `EventGameExclusionService` in `events/` (own spec; same lock skeleton as `EventGameBringService.write`): after `assert`, under `SELECT … FOR UPDATE` on the `Event` row with `boardGamesBasis` re-read on the transaction, refusals in this order, one denial test each: not the host 403 (by `assert`) → cancelled 400 → finished/past 400 (same messages as Bring) → game missing or not the host's 404 (same body, through `BoardGamesService.ownedGameIds`). Non-ralliement refused like Bring. PUT = upsert, DELETE = `deleteMany`, both 204 and idempotent; a game deleted mid-write (P2003) → the same 404. After commit, outside the transaction, emit `partie:{partieId}` (try/catch + `logger.warn`). Routes in `events.controller.ts` with `ParseUUIDPipe`.
- `GET /events/:eventId/board-games`: `games` no longer lists set-aside games, for everyone; a new optional `excludedGames: BoardGameDto[]` is returned **only to the host** (key absent for everyone else), `[]` on a closed evening. Set-aside games leave the summary, the header count, `participantsCount`-driven fit and duplicate marking. Brings, `participantsOf` and `broughtCount` are unchanged.
- Web (`EventGamesTab`, host only, evening open): each host row in « Chez moi » gets a ⋮ button (44 px, at the right of the name in `GameRow`, accessible name « Actions pour {jeu} », neutral key) that opens a one-entry menu: « Sceller pour ce soir / Laisser au logis ce soir / Hors service ce soir ». Menu = `role="menu"` / `menuitem`, in one `cdkConnectedOverlay` hosted by the tab (shape of the character-sheet ⋮ and the export menu; no `MatMenu`), arrows / Home / End / `Échap` (focus back to ⋮), backdrop closes. Choosing it removes the game from « Chez moi » at once (optimistic move, busy guard, silent failure + reload as for Bring; focus goes to the next row or the section header, since the ⋮ vanishes). No ⋮ on Brings, on other people's games or for non-hosts.
- Bottom section `GamesSection` key `excluded`, host only, shown only when `excludedGames` is non-empty, even when « Chez moi » is empty: « Scellées ce soir / Restés au logis / Hors service » with the note « visible par vous seul·e » (neutral per-theme wording as EXPERIENCE §3.2) and one new `UnavailableRow` per game: name and measures at 45 % opacity, the themed « Lever le sceau / Ressortir / Remettre en service » button at full contrast, 44 px, named « {libellé} — {jeu} »; pressing it returns the game to « Chez moi » at once for everyone. A DTO without the field reads as `[]`. All four labels themed (not in `NEUTRAL_KEYS`), voices differ across themes; ⋮ and menu aria texts neutral with `// Story 49.4 : …`. The 45 % contrast is the validated design: note the measured ratio in Implementation Notes. No red; French comments and messages; no dependency install; Docker only.

**Never:** No Envie and no purge-by-`nameKey` (49.5); no exclusion of other people's games; nothing on JDR screens; no change to Bring routes; identifiers `games/`, `ludotheque`, `apport` forbidden; no email in any DTO.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set aside | host PUTs own game, open evening | 204; game gone from everyone's `games`, in the host's `excludedGames`; `partie:` emitted | N/A |
| Put back | host DELETEs | 204; back in `games` for everyone | absent → 204 |
| Repeat PUT | already set aside | 204, one row | N/A |
| Non-host | member / admin PUTs | 403 `HOST_ONLY_MESSAGE` | no write, no emission |
| Closed | cancelled / past / finished | 400 French | no write |
| Not host's game | guest's or unknown game | 404, same body | no write |
| Read, host | one game set aside | `games` without it, `excludedGames` with it | N/A |
| Read, other | same evening | no `excludedGames` key | N/A |
| Duplicate | host's « Azul » set aside, guest brings « azul » | no « ×2 » on the guest's row | N/A |
| Ludothèque removal | set-aside game deleted | exclusion row gone (cascade) | N/A |
| Everything set aside | all host games excluded | « Chez moi » empty line + bottom section | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `EventGameBring` ~:790 (model + SQL style), `Event` ~:621, `BoardGame` ~:171 (add back-relations); latest migration `20261031120000_event_game_bring/migration.sql`.
- `packages/shared/src/index.ts` -- `PermissionAction` ~:373, `EventBoardGamesDto` ~:2143 (comment style from 49.2).
- `apps/api/src/permissions/permission.service.ts` -- `JDR_POLICY` ~:238, `RALLIEMENT_POLICY` ~:363, `HOST_ONLY_ACTIONS` :401, `refusalFor` :518-563; `permission.service.spec.ts` lists ~:190/:518 and the `EVENT_UPDATE — hôte seul` describe ~:626.
- `apps/api/src/events/event-game-bring.service.ts` -- `write()` :153-212 skeleton (lock, basis, refusal order, P2003, emit) and its spec (`expectEventLockedFirst`); `events.module.ts` providers; `events.controller.ts` ~:79-98 routes.
- `apps/api/src/events/event-board-games.service.ts` -- `list()` :29-64 (filter excluded, host-only field; its spec has 4 ctor mocks, add a 5th); `board-games.service.ts` `listOfOwner`, `ownedGameIds`.
- `apps/api/test/characterization/board-games.e2e-spec.ts` -- 49.2/49.3 describes (`setup`, `bringUrl`, `propose`, past/cancel tricks, emit spy, ownerId-null trick).
- `apps/web/src/app/features/events/event-games-tab/*` -- `event-games-tab.{ts,html}` (`isHost` :149, `hostItems`, `write()` :340, `reload`, `#rows` template, section keys), `game-row.ts` (add header row with ⋮), `games-section.ts` (add optional note), new `unavailable-row.ts`; `events-api.service.ts` (`exclude`/`restore` like `bring`/`unbring`).
- Menu patterns: `features/characters/character-sheet/character-sheet.{ts,html,scss}` (`SHEET_MENU_POSITIONS`, trigger, overlay) and `features/homme-dragon/homme-dragon-sheet` (role=menu keys, focus).
- `core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777, `VOICED` tables); `DESIGN.md` §7.3/7.5, `EXPERIENCE.md` §3.1/§3.2/§5.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/*` -- model + migration `20261101120000_event_game_excluded`.
- [x] `packages/shared/src/index.ts`, `apps/api/src/permissions/*` -- `EVENT_GAME_EXCLUDE`, `excludedGames`, policy cells, host-only list, specs.
- [x] `apps/api/src/events/*` -- `EventGameExclusionService`, routes, module, read filtering + host-only field, specs.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` -- I/O matrix over HTTP (one denial per case, cascade, emission, read per role).
- [x] `apps/web/.../event-games-tab/*`, `events-api.service.ts` -- ⋮ menu, `UnavailableRow`, section, optimistic flow + specs.
- [x] Three tone files, `theme-tone.service.spec.ts` -- keys, voices.

**Acceptance Criteria:**
- Given an upcoming evening I host, when I touch ⋮ on one of my games and choose the entry, then it leaves « Chez moi » for everybody at once and appears in my bottom section.
- Given a set-aside game, when I press « Remettre » (themed), then it is back in « Chez moi » for everybody at once.
- Given a guest or non-host member, then they never see ⋮, the bottom section or `excludedGames`, and the routes refuse them (403).
- Given a past, finished or cancelled evening, then no set-aside is possible (400) and nothing is listed.
- Given any JDR party screen, then nothing of this story appears.

## Implementation Notes

- **Contraste de `UnavailableRow` à 45 % d'opacité** (mesuré, WCAG 2.x, contenu estompé sur `--mat-sys-surface-container` de la ligne ; l'opacité s'applique au bloc nom + mesures, jamais au bouton « Remettre », à plein contraste) : nom (`--jdr-text`) Grimoire 3,76:1, Forêt 3,87:1, Atelier 3,75:1 ; mesures (`--jdr-text-muted`) Grimoire 2,20:1, Forêt 2,33:1, Atelier 2,24:1 ; pour mémoire, le nom à plein contraste vaut 13,1 à 14,1:1. Le 45 % est la planche validée (DESIGN §7.5) : le nom passe 3:1 mais pas 4,5:1, les mesures n'atteignent pas 3:1 — l'information est aussi portée par le titre de section, et le bouton nommé « {libellé} — {jeu} » reste à plein contraste.
- La lecture ôte les jeux écartés par filtrage en mémoire de `listOfOwner` (aucune lecture de `BoardGame` hors de `board-games/`) ; `excludedGames` n'est calculé que pour l'hôte (clé absente sinon, `[]` sur une soirée fermée).
- `EventGameExclusionService` n'a pas de condition « participant » (l'hôte l'est toujours) : la propriété du jeu est lue avec l'identifiant de l'appelant, que `assert` a établi comme hôte de l'événement.

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind, edge | `write()` host check | « Is the host » decided by `assert` before the lock; a host change or deleted account between the two still writes | low | The host never changes (epic); a deleted host takes the games with it by cascade, so `ownedGameIds` answers 404. Rejected | reject |
| 2 | edge | `partie.closedAt` | Read from the pre-lock grant, not re-read under the lock | low | Same accepted limit as 49.2 (closing a partie does not take the `Event` lock). Rejected | reject |
| 3 | blind, edge | ⋮ menu | Open menu not reconciled when a reload removes its game | low | Needs the game to vanish (another tab) while the menu is open; ordinary reloads keep it. Fix adds an effect. Rejected | reject |
| 4 | edge | `onExcludeChosen`, `focusNeighbour` | Focus falls to body when the action is ignored (busy); wrong neighbour for a stale game | low | Needs a double action or a stale menu. Rejected | reject |
| 5 | blind, edge | optimistic move | Stays on screen if the write and the reload both fail | low | Same as 49.2 triage #6 (`carried`); the next `partie:` signal reloads. Rejected | reject |
| 6 | blind | live region | The move between sections is not announced | low | Not required by the spec; the section header counts change. Rejected | reject |
| 7 | blind | silent failure | No feedback on failure | false | Frozen decision (silent failure + reload), same as Bring | reject |
| 8 | blind | `theme-tone.service.spec.ts` | Prettier re-wrapped unrelated describes | low | Formatting only, repo-wide CRLF/prettier debt; reverting is more churn. Rejected | reject |
| 9 | blind | migration date | `20261101…` ahead of today | false | Sorts after `20261031120000`, the only ordering that matters | reject |
| 10 | blind | no-op writes | `exclude`/`restore` with nothing to change still emit `partie:` | low | Frozen: every write emits; a no-op repeat is rare and harmless (tabs reload). Rejected | reject |
| 11 | blind | orphan rows | Exclusion rows linger if the host disappears | low | The host never changes; rows cascade with `Event`/`BoardGame`. Rejected | reject |
| 12 | blind | duplicated menu code | Overlay/keyboard code copied from the character sheet; global `document` lookup of `.egt-menu` | low | The spec asks for « the shape of » those menus; one instance per tab. Rejected | reject |
| 13 | blind | `excludedGames?` | Optional field as the visibility contract | low | Frozen design (key absent for non-hosts), tested by key presence. Rejected | reject |
| 14 | blind | note a11y | « Visible par vous seul·e » not tied by `aria-describedby` | low | A hint, not a control; the section title and note are adjacent. Rejected | reject |
| 15 | blind | naming | `host` ElementRef next to host concepts | low | Cosmetic. Rejected | reject |
| 16 | edge | privacy claim | A member can infer set-aside games by diffing with the host's Ludothèque (48.3) | low | True and by design: the Ludothèque is readable by group members; the story only keeps the list out of this response. The Design Notes wording overstates; fixing means editing the spec. Flagged to the human in the summary | reject |
| 17 | vgap | `events-api.service.spec.ts` | No test of `exclude`/`restore` verb, URL, `withCredentials` | medium | Real: every other test mocks the service; a typo in the path or a `post` would ship green (vgap demonstrated it). Copy the `bring`/`unbring` cases | patch |
| 18 | vgap | `list()` reads | Three reads outside a transaction can be momentarily inconsistent | low | Self-heals on the next reload. Rejected | reject |

## Design Notes

`excludedGames` is absent (not empty) for non-hosts so the response itself leaks nothing; a non-host cannot learn which games the host set aside.

## Verification

**Commands:**
- `docker compose exec api pnpm exec prisma migrate deploy` then `pnpm exec prisma generate` and `prisma migrate status` -- expected: up to date.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 3 date-dependent calendar tests); never two pnpm commands in parallel. Restart the `api` container before browser checks.

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: ⋮ menu by keyboard, set aside / put back, host view with everything set aside, guest view, 45 % rows legible.
