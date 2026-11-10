# Epic 49 Context: Les jeux sur place d'une soirée

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Before an evening (ralliement mode only), everyone sees which board games will be on site: the host's Ludothèque, what participants bring, duplicates, and which games are playable at the current head-count. Participants tick what they bring and flag an Envie (wish) on a game; the host can set one of their games aside for that evening only. This epic builds on epic 48 (`BoardGame`, `board-games/`, `boardGameNameKey`) and adds the `events/`-side tables, the `EVENT_GAME_*` permission actions and the games tab. Everything stays optional: an evening with an empty Ludothèque behaves exactly as before. A past, finished or cancelled evening shows no games and no tab.

## Stories

- Story 49.1: Voir les jeux de l'hôte avant la soirée
- Story 49.2: Dire ce que j'apporte, et voir les doublons
- Story 49.3: Ne plus rien apporter quand je ne viens plus
- Story 49.4: Écarter un jeu pour ce soir (hôte)
- Story 49.5: Signaler une Envie

## Requirements & Constraints

- The host's games appear automatically on each of their upcoming evenings and are never copied; a game the host adds shows up immediately. The host never changes (if they leave the group, their upcoming evenings are cancelled).
- A participant other than the host ticks/unticks games from their own Ludothèque as "brought" ("apporté par {pseudo}"). Ceasing to be a participant removes their Bring and Envies. Non-participants, `RESERVED` registrants, and past/finished/cancelled evenings can do none of these actions.
- The host sets aside only their own games, only on an upcoming evening; the game stays in the Ludothèque and on other evenings; only the host sees the set-aside list.
- Reading: games grouped by provenance (at host's, brought). Same normalised name in several places appears at each, marked "×N" with the other holders. A game is "playable at N" only if its player range contains the current participant count; never for a game with no player counts. Live updates without reload.
- Envie: at most one per person, per game name, per evening; each game shows its count and who. A game that leaves the on-site set loses its Envies on that evening.
- Deleting a game from the Ludothèque removes its Brings and set-asides (cascade); a game brought to an upcoming evening needs a confirmation before removal.
- Never an e-mail of a third party in a DTO (`pseudo` / `displayName` only); inputs bounded and validated; one denial test per refusal case. Nothing appears on a JDR party. 300-game Ludothèque must stay readable on phone. French comments/messages, no dependency install, Docker only, CI green per story; real-time wiring per `docs/checklist.md`; security per `docs/security.md`.

## Technical Decisions

- Tables, writer `events/` only: `EventGameBring(eventId, boardGameId, userId)` unique `(eventId, boardGameId)`; `EventGameExcluded(eventId, boardGameId)` unique; `EventGameEnvy(eventId, userId, nameKey)` unique. Cascades on `Event`, `BoardGame`, `User` as relevant. One migration per story introducing its table (49.2, 49.4, 49.5), no multi-step migration. Dependency direction: `events/ → board-games/`, never the reverse.
- `participantsOf(event)` lives in `events/` next to `eligibleVoters`, the single definition: group → host + `CONFIRMED` `Inscription`; isolated encounter → `Membership` of the party; `RESERVED` never. `participantsCount` (N) is its size.
- Envie is keyed on `nameKey` (not a game id): ignored at read if the name is no longer on site; deleted in the same transaction when an `events/` write removes the last source of that name (set-aside, Bring removed, including via 49.3 paths).
- Permissions in `PermissionService` only: new actions `EVENT_GAME_BRING`, `EVENT_GAME_EXCLUDE`, `EVENT_GAME_ENVY`, target `{ eventId }`, ralliement only. Checks run under the event lock: upcoming and not cancelled; caller ∈ `participantsOf`; BRING refused to the host and on another person's game; EXCLUDE only on a host's game. Reads of a past/finished/cancelled evening return an empty list (shared status function). Test cases include non-participant, host bringing, invitee excluding, past, cancelled, `RESERVED`.
- Routes: `GET /events/:eventId/board-games` (`PARTIE_READ`; host's non-excluded games, plus excluded ones for the host only; Brings with porter `pseudo`/`displayName`; Envies `nameKey` + `userId`; `participantsCount`); `PUT/DELETE /events/:eventId/board-games/:boardGameId/bring` and `/exclusion`; `PUT/DELETE /events/:eventId/envies` (body `nameKey`). One read per evening; the "Dans mon …" section is composed web-side from the reader's own Ludothèque.
- Exit paths from `participantsOf` (unregister, declining an invitation or reserved seat, host removing a registration, `PartiesService.leave` / admin removal / account deletion) each delete the person's Brings and Envies in their own transaction (upcoming events only for `leave`).
- Real-time: after commit, outside the transaction, every `events/` game write emits `partie:{partieId}`; web services expose `notifyChanged()`; the tab reloads on that channel (also covers host adding a game via 48.1 and N changing on sign-up/withdrawal). No new channel.
- Web grouping uses the received `nameKey`, never recomputed. Forbidden identifiers: `games/`, `ludotheque`, `apport`. Imposed names: `EventGameBring`, `EventGameExcluded`, `EventGameEnvy`, `participantsOf`, `participantsCount`.

## UX & Interaction Patterns

- ⚠️ Isolated encounter view: third tab after "Conjonction · Invités" (host: "Invitations"), theme label plus on-site count (e.g. "Reliques · 6"). ⚠️ Group `EventDialog`: two tabs at top, "Conjonction" (existing blocks incl. registrants) and the games tab. No tabs for a past/finished/cancelled evening.
- `GamesSummary`: "{n} jeux sur place · {k} jouables à {N}" and two cumulable toggle chips (`aria-pressed`): "Jouables à {N}" and the theme's "most called/awaited/requested" (Envies descending, then alphabetical; added in 49.5). Polite `aria-live` announcement when N changes ("{N} participants : {k} jeux jouables à {N}."), no visible banner.
- `GamesSection`: collapsible sections in order "Chez {hôte}" / "Chez moi", Brings (own included: "par moi · Je ne l'apporte plus"), "Dans mon …" (non-host participant: own non-brought games, "J'apporte", "⚠ déjà chez {nom}"), set-aside section (host only, "visible par vous seul·e"). Header is a button with `aria-expanded` and count ("· 3 sur 6" under filter); expanded by default, state remembered per section in the browser; alphabetical, no truncation.
- `GameRow`: name, right-side actions (♥; ⋮ for host on own games), "{min}–{max} joueurs · {d} min", `FitPill` (`{colors.accent-1}` filled), `DuplicatePill` "×N" plus "aussi chez / aussi apporté par" line (`{colors.status-todo}`, always in text), `OwnerLink` (dotted underline). Bring/unbring: no confirmation, row moves section at once. Host ⋮ has a single themed entry ("Sceller pour ce soir" etc.); `UnavailableRow` is dimmed to 45% with a full-contrast themed "Remettre" that returns the game to everyone at once.
- `EnvyToggle`: ♥ alone with no Envie, "♥ {n}" otherwise; `aria-pressed`; accessible name "{libellé d'Envie} — {jeu}, {n} {appels|envies|demandes}"; active in `{colors.accent-2}`; touching the count opens a small menu of names. A game present twice shows the same Envie on both rows.
- States: no games on site ("Aucune relique sur place pour l'instant." + discreet link "Remplir mon cabinet", themed); non-participant is read-only (no ♥, no "Dans mon …"); game without player counts never "jouable à N" and is excluded by the filter; empty own Ludothèque in a participant's view ("Votre cabinet est vide." + link); a touched game that just vanished fails without a blocking error and the list refreshes.
- Labels per theme in the three theme files (reliques feminine; trésors/joyaux masculine); measures, "Chez {hôte}", "Chez moi", "Jouables à {N}" in `NEUTRAL_KEYS` with reason. No new theme token, no red, no image; 640 px max column above 768 px; 44 px targets; keyboard-reachable actions. Contrast of `{colors.accent-2}` as text must be measured at ≥ 4.5:1 in all three themes and noted in 49.5.

## Cross-Story Dependencies

- Requires epic 48 delivered: `BoardGame` DTO, `nameKey`, `board-games/` module, and 48.1's `partie:{id}` emissions (host-added game shows live). Builds on Palier 10's `PermissionService`, `Inscription` / `Membership` / `Invitation`, event lock and `RealtimeService`.
- 49.1 → 49.2 (Brings, duplicates, "Dans mon …") → 49.3 (cleanup on exit paths) ; 49.1 → 49.4 (set-aside); 49.5 needs 49.2 and 49.4 (Envie purge triggers on Bring removal and set-aside, and on 49.3 paths).
- 49.2 modifies epic 48's Ludothèque page: adds the "brought to {n} upcoming evening(s)" confirmation before removal (⚠️ validated screen).
- Epic 50 is independent of this epic.
