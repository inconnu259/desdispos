# Epic 44 Context: Suivre et conclure un vote, où que l'on soit

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Players, members and organizers (GM or event host) find every open vote of all their active parties in one list (the ✦ chip), reach it directly from a link, browse its candidate slots one by one on a board (right column on desktop, bottom drawer on phone), answer, and — for the organizer — fix the date or extend the vote without going through the scenario sheet or the event window. The epic lays the shared reads of palier 10.4: `GET /me/open-polls`, a single party-status function, the `can` rights object, and `atelierUrl`.

## Stories

- Story 44.1: Ne montrer que les actions d'organisateur permises
- Story 44.2: Voir sur mon calendrier personnel les votes de toutes mes parties
- Story 44.3: Choisir la destinée active dans une liste
- Story 44.4: Suivre un vote sur le plateau de la destinée
- Story 44.5: Suivre un vote dans le tiroir de la destinée, sur téléphone
- Story 44.6: Fixer la date ou prolonger le vote depuis le plateau
- Story 44.7: Arriver en Destinée par un lien
- Story 44.8: Filtrer mon calendrier personnel par partie

## Requirements & Constraints

- "Destinée" is a calendar mode on one open poll (a "rendez-vous" = a `Seance`; JDR session or isolated evening/event). The personal calendar (vitrine) follows and concludes; the party calendar (atelier) composes.
- Organizer rights are decided server-side per target; UI buttons ("Modifier les dates", "Fixer la date…", "Prolonger le vote") show only when the server would not refuse. A non-host admin must no longer see actions they cannot perform. Every right needs a refusal test (`docs/security.md`).
- Confidentiality: no voter `userId` in `/me/open-polls`; no poll of a party the reader is not a member of, nor of a hidden draft (anti-spoil); no voter names in the vitrine; in the atelier, names of non-respondents for the organizer only.
- Real-time: personal calendar reloads `/me/open-polls` on `user:{id}`; atelier on `partie:{id}`; every poll/vote write must call `notifyPartieSignalsChanged` after commit (`docs/checklist.md`).
- JDR must not regress: no JDR screen changes in 44.1; scenario-sheet status panels, sealing and existing fix/extend paths stay unchanged.
- Every validated screen that changes is flagged ⚠️ in its story with what changes. Characterization tests are updated before any contract change (`/me/calendar`, `votes-en-cours`). Mobile: finger-usable, 44 px targets, nothing reachable only by long-press. French comments/errors; no dependency installation; everything through Docker; CI green each story.

## Technical Decisions

- `PermissionService.canMany(userId, action, targets)` applies all `assert` rules (cell, `HOST_ONLY_WHEN_EVENT_TARGETED`, capacity) on targets `{seanceId}` or `{eventId}` — never `{partieId}` alone — in a fixed number of queries. The mapping from actions to `can = { propose, edit, choose, extend }` lives only in `permissions/`. JDR: `SEANCE_POLL_CREATE`, `POLL_OPTIONS_SET`, `POLL_CHOOSE`, `POLL_EXTEND` (denied); ralliement: `EVENT_UPDATE`/`EVENT_UPDATE`/`POLL_CHOOSE`/`POLL_EXTEND` on `{eventId}`. `can` is carried by `OpenPoll`, `DatableSeance`, `EventCardDto` and the JDR atelier session DTO; `canCompose` (`hostId === me`) is replaced.
- `GET /me/open-polls` served by `poll/`; layer-2 data via `OpenPollContextPort.contextOf(userId, pollIds)` (declared in `poll/ports/`, implemented in batch by `events/`, bound in `PortsModule`); `layer-imports.spec.ts` must stay green. `pollVoters()` and `hasAnswered()` are single sources; `eligibleCount` replaces `membersCount`. `partieStatus()` is one pure function in `@master-jdr/shared` fed by a batch `progress` from `events/`.
- `votes-en-cours` leaves `MeCalendarDto` but stays a layer key; `allCalendarEntries()` holds all open polls and the period only filters rendering. Web `OpenPollsService` is fed by `/me/open-polls` (no per-party calls).
- Destinée state is `destinyPollId`; current slot = `optionId`; `?poll` / `?pollList` read at init and rewritten with `Location.replaceState` (no router navigation, which would clear the contextual banner). Entry: Month view (Week in evening mode), drawer collapsed, `destinyEntryOption(poll, today)`. `bestOption(options, today)` is one pure function in `@master-jdr/shared` (also used by `DateFixDialog`). Closing: atelier reads the reason from the payload; vitrine closes on absence after a successful reload; `lastDestinyDates` heuristic removed.
- Fix/extend reuse existing routes and dialogs (`PATCH …/choose`, `PATCH …/extend`, `SealConfirmDialog`, `DateFixDialog`, `ExtendVoteDialog`); no new routes. Links built by `atelierUrl({ partieId, family, role }, params)` in shared (JDR GM → `/calendar`, JDR player and ralliement → `/guild-calendar`), also used by e-mail templates.
- Party filter (44.8) is non-persisted, applied downstream of `allCalendarEntries()`; not part of `activeLayers`/`CALENDAR_LAYER_KEYS`.
- Shared runtime values live in `@master-jdr/shared` (no `import type` on values). `durationSlots` is 1 until epic 47.

## UX & Interaction Patterns

- ✦ chip opens the destiny list (modal drawer < 1024 px, anchored menu above), grouped by party name, each line with name, deadline or "Vote terminé", slot count and a state tag (À faire / Répondu / Organisateur / Vous ne votez pas); chip absent without open poll.
- Board `DestinyBoard` (≥ 768 px, sticky column; 340 px column in the vitrine only while in Destinée) and `DestinySheet` (< 768 px, non-modal bottom drawer, ≈ 120 px collapsed). ‹ n/N › walk candidate slots of the active vote; `aria-live` announcement of the current slot; dimming never removes pointer or accessibility.
- Labels vary per theme with neutral wording in evening mode (no JDR word, no "partie"); messages written once and the URL parameter then removed.

## Cross-Story Dependencies

- Strict chain 44.1 → 44.2 → 44.3 → 44.4 → 44.5 → 44.6 → 44.7 → 44.8; 44.1 (`can`, `canMany`) is required by every later story.
- Epic 45 builds on `can`, `atelierUrl`, `/me/open-polls`; epic 46 on the board and docks; epic 47 on `durationSlots`.
- Depends on palier 10 (epics 37–43) being delivered, and on stories 36.9 (Destinée rules), 40.5b/40.6/40.7 (group fix/extend), 30.5 (personal calendar characterization), 10.8 (scenario-sheet vote unchanged).
