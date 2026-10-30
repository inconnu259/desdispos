---
title: 'Voir les jeux de l''hôte avant la soirée (story 49.1)'
type: 'feature'
created: '2026-10-30'
status: 'done'
baseline_commit: '582a98b54ea041585c995d09d4283efeef04beaf'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-49-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Before an evening, nobody can tell which board games will be there or how many suit the head-count, so people cannot know whether to bring something.

**Approach:** Add `GET /events/:eventId/board-games` (host's Ludothèque, `participantsCount`, shared open/closed status) and a « jeux sur place » tab: a 3rd tab of the isolated-encounter screen, and two tabs (« Conjonction » + games) in the group `EventDialog`. Read-only here; Bring, set-aside and Envie come in 49.2–49.5.

## Boundaries & Constraints

**Always:**
- `participantsOf` in `events/`, next to `eligibleVoters`, the **single** definition of N: group → host + `CONFIRMED` `Inscription` of the seance; isolated encounter (`ONE_SHOT` ralliement) → `Membership` of the partie; `RESERVED` never; de-duplicated. Pure function + loader, unit-tested. A shared pure `eventIsOpen` (false if `cancelledAt`, seance past by `isSeancePast`, or isolated with `closedAt`/ended) feeds both this route and `assertIsolatedOpen` without changing its behaviour.
- Route in `events.controller.ts`, `ParseUUIDPipe`, `PermissionService.assert(user,'PARTIE_READ',{eventId})`; a non-ralliement partie is refused as `group-events.service.ts` already does (`RALLIEMENT_UNAVAILABLE_MESSAGE`, 403). Response `EventBoardGamesDto { games: BoardGameDto[]; participantsCount: number }`, games alphabetical by `nameKey` then `name`; closed event → `games: []`, `participantsCount` as computed. No new `BoardGame` read in `events/`: add `BoardGamesService.listOfOwner(hostId)` (reuse `toBoardGameDto`); `EventsModule` imports `BoardGamesModule`, never the reverse. New `events/` files must not use the tokens `ownerId` / `.owner` (name the field `hostId`) or add a named exception in `no-direct-owner-read.spec.ts`.
- Host without `Event.ownerId` (null) → empty games. Host's games are never copied. No emission on read.
- ⚠️ Tabs: isolated encounter (`partie-detail`, after « Conjonction · Invités / Invitations »): shown only while open (`isSoiree && !isSoireeFinished`); the tab component loads the event card itself via `events-api.list(partieId)` and reports its count through an output (pattern `countChange`). Group `EventDialog`: a tab strip « Conjonction » (default; all existing blocks, registrants included) and the games tab, only when the event is open (`!past && !cancelled && !frozen`); otherwise the dialog is unchanged, no strip. Label « Reliques / Trésors / Joyaux · {n} ».
- Tab content (neutral keys unless noted): `GamesSummary` « {n} jeux sur place · {k} jouables à {N} » (`_one` form for n ≤ 1) with the toggle chip « Jouables à {N} » (`aria-pressed`, off at start); then one collapsible section « Chez {hôte displayName} » (« Chez moi » for the host), header button `aria-expanded`, count « · 6 » (« · 3 sur 6 » under the filter), expanded at start, state kept per section in the browser (shape of `ColumnDockService`, all storage in try/catch); rows alphabetical, no truncation, `GameRow`: name, `formatBoardGameMeasures`, `FitPill` « jouable à N » (text, never colour alone) only when `minPlayers ≤ N ≤ maxPlayers` with both set; a game without player counts never fits and is excluded by the filter.
- Empty (no games on site): « Aucune relique / Aucun trésor / Aucun joyau sur place pour l'instant. » (themed) plus — decision 2026-10-30 — only for the host and registered/invited participants (a read-only member never sees it) — the discreet themed link « Remplir mon cabinet / coffre » / « Garnir mon râtelier » to `profile/board-games`.
- Real-time: the tab reloads on `PartiesService.changed()` (already fired on `partie:{id}`; covers host game adds from 48.1 and sign-ups/withdrawals), first run skipped, stale-safe sequence. When N changes (not on first load) a polite always-present `role="status"` region announces « {N} participants : {k} jeux jouables à {N}. », no visible banner.
- Layout: single column, 640 px max above 768 px, 44 px targets, tokens of `DESIGN.md` §7.1–7.3, no new theme token, no red, no image. Themed keys in the three tone files; neutral keys in `NEUTRAL_KEYS` with `// Story 49.1 : …` reasons. French comments and messages; no dependency install; Docker only. Nothing on JDR screens.

**Never:** No Bring, set-aside, Envie, `OwnerLink` or « Dans mon … » section; no write route; identifiers `games/`, `ludotheque`, `apport` forbidden; no email in any DTO.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Group, upcoming | host has 3 games; host + 2 `CONFIRMED` | 200, 3 games, `participantsCount: 3` | N/A |
| Reserved | one `RESERVED` registrant | not counted | N/A |
| Isolated | host + 2 members | `participantsCount: 3` from `Membership` | N/A |
| Fit | N = 4; ranges 2–4, 5–8, none | pill only on the first; filter keeps only it | N/A |
| Closed | past, `cancelledAt` set, or isolated `closedAt` | `games: []`; web shows no tab | N/A |
| No host | `Event.ownerId` null | `games: []` | N/A |
| Member not registered | group member, no inscription | 200 (read-only view) | N/A |
| Stranger | not a member of the partie | 403, same as `PARTIE_READ` | N/A |
| JDR partie | event target of a JDR partie | refused (403) | N/A |
| Unknown event | random uuid | 404 | N/A |
| Empty library | host has none | `games: []` | web: empty line + link |

</frozen-after-approval>

## Code Map

- `apps/api/src/events/eligible-voters.ts` -- model for the pure `participantsOf` (+ spec); `Inscription` (`status` `RESERVED|CONFIRMED`), `Membership`; `isConfirmed()` `events.service.ts:289`.
- `apps/api/src/events/events.service.ts` -- `isRalliementGroup` :283, `assertIsolatedOpen` :1883, `endedIsolatedPartieIds` :1851, `isSeancePast` (`seance-span.ts:49`); already excepted in `no-direct-owner-read.spec.ts`.
- `apps/api/src/events/events.controller.ts` + `group-events.service.ts` :94/:130 -- route style, `assert(...,{eventId})`, `RALLIEMENT_UNAVAILABLE_MESSAGE`; `events.module.ts` imports.
- `apps/api/src/board-games/board-games.service.ts` -- `listMine` :91, `toBoardGameDto` :48; add `listOfOwner`.
- `packages/shared/src/index.ts` ~:2123 -- add `EventBoardGamesDto`.
- `apps/api/test/characterization/{harness,board-games.e2e-spec,ralliement.e2e-spec}.ts` -- `createPartie`, `addMember`, event creation `POST /parties/:id/events`, inscription `POST /scenarios/seances/:id/inscription`, reservations; spy on `RealtimeEventsService.emit`.
- `apps/web/src/app/features/events/event-dialog/event-dialog.{ts,html,scss}` -- no tabs today; inputs `card`, `inline`, `frozen`; `past()`, `cancelled()`; hosted in `shared/detail-surface`; `app-library-sheet` at the bottom. Hosts: `conjonctions-tab.html:82`, `soiree-tab.html:10`.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.{ts,html}` -- `mat-tab-group` :51, members tab :466-542, `isSoiree` :233, `isSoireeFinished` :239, `membersTabLabel` :251, `countChange` pattern :64/:283; `features/events/soiree-tab` (`api.list(partieId)`, reload pattern).
- `apps/web/src/app/features/events/events-api.service.ts` -- add `boardGames(eventId)`.
- `apps/web/src/app/features/calendar/side-dock/column-dock.service.ts` -- remembered-state shape; `calendar/destiny-control/destiny-control.scss` chip style.
- `apps/web/src/app/features/board-games/board-game-measures.ts` -- measures and counts; fit helper new. `core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` ~:777). `DESIGN.md` §7.1–7.3 and `EXPERIENCE.md` §2.2–2.3, §5.3.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `EventBoardGamesDto`.
- [x] `apps/api/src/events/participants-of.ts`, `event-is-open.ts` + specs -- single N definition and shared status; `assertIsolatedOpen` reuses it.
- [x] `apps/api/src/board-games/board-games.service.ts` -- `listOfOwner` + spec.
- [x] `apps/api/src/events/{events.controller,events.module}.ts` + service method -- route, guard, closed → empty.
- [x] `apps/api/test/characterization/board-games.e2e-spec.ts` -- I/O matrix over HTTP.
- [x] `apps/web/src/app/features/events/event-games-tab/*` -- tab, summary, section, row, pill, remembered state, live announcement + specs.
- [x] `event-dialog`, `partie-detail` + specs -- tabs (open events only).
- [x] `events-api.service.ts`, three tone files, `theme-tone.service.spec.ts` -- API call, keys, `NEUTRAL_KEYS`.

**Acceptance Criteria:**
- Given an open group conjunction, when I open it, then a « Conjonction » tab (unchanged content) and the games tab with the host's games and the count in its label appear.
- Given an open isolated encounter, when I open it, then the games tab follows « Conjonction · Invités / Invitations ».
- Given a past, finished or cancelled evening, then no tab appears and the dialog is as before.
- Given the host adds a game, or someone signs up, then an open tab updates without a refresh and N-driven fit pills follow.
- Given any JDR party screen, then nothing of this story appears.

## Implementation Notes

- Écart au texte gelé (accord du résumé) : `GamesSummary` accorde chaque morceau avec son propre nombre — « jeu(x) sur place » (forme « jeu » pour n ≤ 1) et « jouable » pour k = 1 seulement (k = 0 reste « jouables ») — au lieu d'accorder tout sur n. Clés neutres : `event_games.summary` (`{games} · {playable}`), `summary_games_one/many`, `summary_playable_one/many` (la clé `summary_one` disparaît) ; le nom accessible d'un en-tête filtré s'accorde avec n (`section_aria_filtered_one`). Toutes dans `NEUTRAL_KEYS` (`// Story 49.1`).

## Spec Change Log

## Review Triage Log

| # | Source | Location | Finding | Verdict | Evidence | Route |
|---|--------|----------|---------|---------|----------|-------|
| 1 | blind | `participants-of.ts` | Filter is `!== 'RESERVED'`, not `=== 'CONFIRMED'` | low | `InscriptionStatus` has only those two values; same convention as `eligibleVoters` and `isConfirmed()`. Rejected | reject |
| 2 | blind | `event_games.summary` | « 1 jouables à 3 » and « 1 sur 1 jeux »: plural chosen on `n`, not on `k` | medium | Real and visible: the summary line is the tab's headline and the spec's own wording locks the `n` form only. Direct fix: singular key for `k` ≤ 1 (and the same for the section aria label) | patch |
| 3 | blind, edge | tab after cancel | A closed event reads as an empty library when the dialog stays open and reloads | low | The card is refreshed by the same `partie:` signal and hides the tab (`gamesAvailable`); needs a stale card. Adding a flag changes the DTO the spec fixed. Rejected | reject |
| 4 | blind | `listOfOwner` | Skips `assertLibraryRead`: a weaker path to the host's library | low | Imposed by the AC (`PARTIE_READ` on the event); members of the partie are exactly who may see the evening's games. Rejected | reject |
| 5 | blind, edge, vgap | `assertIsolatedOpen` / `eventIsOpen` | Two « finished » predicates; first seance only | low | An event holds one seance today (vgap checked); the e2e covers past and closed on the route. Rejected | reject |
| 6 | blind, edge, vgap | `event-games-tab.ts` reload | Stale data when the card id changes, or after a 403/404 reload | low | The tab is created per dialog or screen and never switches event in place; a lost membership leaves the screen. Rejected | reject |
| 7 | blind, edge | `games-section-state.service.ts` | One global `host` key collapses every evening's section | low | Spec: state « kept per section » like the dock (one key per section kind). Decision, not defect. Rejected | reject |
| 8 | blind | `event-dialog.html` | Block template rendered in two branches; tab recreated when `showTabs` flips; label logic duplicated | low | Flips only when editing or closing; refetch is cheap. Rejected | reject |
| 9 | blind | a11y | Tabpanel `tabindex`, unchecked contrast, identical live strings | low | Panel holds focusable buttons; contrast stays on the manual checks; strings change with N. Rejected | reject |
| 10 | blind | `event-dialog.spec.ts` | New `describe` sits between a comment and the block it labels | low | Real, cosmetic; direct move | patch |
| 11 | blind | `boardGamesBasis` | Cast after conditional `select`; serial reads | low | Works and is covered by tests; refactor adds code. Rejected | reject |
| 12 | blind | tests | Missing UTC-boundary, host-left, concurrent-delete e2e | low | Boundary is `isSeancePast`'s own tested rule; the others are not reachable states. Rejected | reject |
| 13 | edge | live region | Announcement lost while the games panel is `hidden` | low | The announcement concerns the games tab; the user is not on it. Rejected | reject |
| 14 | edge | seance `take:1` | Wrong seance read with several | low | Same root as #5. Rejected | reject |
| 15 | edge | claims | JDR party could host the dialog; `partie:` is the only trigger | false | `EventDialog` is only hosted by ralliement screens; 48.1 emits `partie:` for the host's game adds | reject |
| 16 | vgap | `event-dialog.ts` `!inline()` | Not pinned by any test: dropping it nests a second strip and tab in the isolated screen with every test green | medium | Real regression gap (vgap demonstrated it) | patch |
| 17 | vgap | `partie-detail.html` | `contributor` and `currentUserId` wiring untested (link, « Chez moi ») | medium | Real: removing either input leaves all tests green | patch |

## Design Notes

Group `participantsOf` follows the epic literally (host + `CONFIRMED` inscriptions), even for « tous les membres » events — it is the head-count at the table, not the voter set.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm lint:check` -- expected: green (known: 1 AD-9 fixed-date unit test).
- `docker compose exec web pnpm test`, `pnpm build`, `pnpm lint` -- expected: green (known: 2 `calendar-view` fixed-date tests); never two pnpm commands in parallel. Restart the `api` container before browser checks (hot reload does not pick up changes under Docker/Windows).

**Manual checks:**
- Three themes, 360 px and ≥ 768 px: both tab hosts, collapse state kept after reload, filter chip, live announcement, past/cancelled evening shows no tab.
