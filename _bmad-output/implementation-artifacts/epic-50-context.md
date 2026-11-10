# Epic 50 Context: Les jeux du groupe et qui reçoit

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Inside a rallying group (ralliement mode only), a member finds who owns a board game (search by name, filter by player count) and sees how often each member has hosted the group. Both views are read-only and optional: nothing is pushed on anyone, and nothing appears on a JDR party or on an isolated encounter. The epic builds on epic 48 (`BoardGame`, `board-games/`, `boardGameNameKey`, `LibrarySheet`) and is independent of epic 49.

## Stories

- Story 50.1: Trouver qui possède un jeu dans le groupe
- Story 50.2: Voir qui reçoit

## Requirements & Constraints

- Group games view: every game of the current members, one line per game (name, player range, duration, owners by `pseudo` / `displayName`), alphabetical, read-only. A removed or departed member disappears at once, live, without reload.
- Search by name plus a single-choice player-count filter (2 · 4 · 6 · 8+; touching the active chip clears it). A game with no player counts is retained by no chip. Footer "{n} jeux chez {m} membres". Empty group: a themed "nobody filled their cabinet yet" text.
- Host counter: per current member, the number of the group's events they own that are not cancelled and whose time range is past; 0 if never. Members who left are neither counted nor listed; their events are attributed to nobody. No counter for an isolated encounter. No ranking, no highlight.
- Never an e-mail of a third party in a DTO (`pseudo` / `displayName` only); inputs bounded and validated; one denial test per refusal case (isolated encounter, JDR party, non-member). 20 members × 300 games each must stay readable and fast on phone.
- French comments and error messages, no dependency install, Docker only, CI green per story; real-time wiring per `docs/checklist.md`; security per `docs/security.md`. Every validated screen modified is flagged ⚠️ in the story.

## Technical Decisions

- 50.1 route: `GET /parties/:id/board-games` in `board-games/` (writer of `BoardGame`), guarded by `PARTIE_READ`, group only (refused for an isolated encounter or a JDR party). Games are grouped by the `nameKey` computed by the API (`boardGameNameKey`, from `@master-jdr/shared`); the web never recomputes it. Explicit projection to the DTO.
- 50.2 route: `GET /parties/:id/host-counts` in `events/`, guarded by `PARTIE_READ`, group only. Derived on read, nothing stored; status "past and not cancelled" comes from the shared event-status function, not a re-implementation.
- Real-time: both views reload on the existing `partie:{id}` channel (member departure, any Ludothèque write by a member already emits it since 48.1; event cancellation for 50.2); web services expose `notifyChanged()`. No new channel.
- Owners open `LibrarySheet` (story 48.3) through the existing `LIBRARY_READ` permission; no new permission action.
- Imposed names: `BoardGame`, `nameKey`, `boardGameNameKey`, `minPlayers`, `maxPlayers`, `durationMin`, `hostCounts`; forbidden identifiers: `games/`, `ludotheque`, `apport`.

## UX & Interaction Patterns

- ⚠️ Group view: a 4th tab inserted after "Conjonctions" ("Conjonctions · Reliques · Détails · Missives", themed label; reliques feminine, trésors/joyaux masculine). The four tabs must fit at 360 px with the longest label of each theme (measure noted in 50.1).
- Tab content: "Chercher un jeu…" field, chips "Jouable à : 2 · 4 · 6 · 8+", one row per game ("chez {noms}", owner names are buttons opening `LibrarySheet`), footer count.
- ⚠️ Group "Détails" tab: collapsible themed section "Qui ouvre sa porte / Qui accueille le cercle / Qui accueille l'équipage" above the settings; `HostBars` (accent-2 bar 6 px high, largest count = 120 px, "{n} fois"), most to least, then "Jamais : {noms}".
- Colours: no new theme token, accent-2 for host bars, never red, no image; 640 px max column above 768 px; 44 px targets; information never carried by colour alone; keyboard-reachable.
- Labels per theme in the three theme files; measures and neutral fragments in `NEUTRAL_KEYS` with their reason; no JDR word.

## Cross-Story Dependencies

- Requires epic 48 delivered (`BoardGame` DTO, `board-games/` module, 48.1's `partie:{id}` emissions, 48.3's `LibrarySheet`).
- 50.1 and 50.2 are independent of each other and of epic 49; 50.1 adds the 4th group tab, 50.2 modifies the existing Détails tab.
