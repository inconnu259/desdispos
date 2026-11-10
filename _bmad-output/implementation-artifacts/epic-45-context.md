# Epic 45 Context: Proposer des dates en quelques gestes

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The organizer (GM or event host) sees, in any calendar, which rendez-vous are still waiting for a date, proposes dates with the availability gesture in the party calendar (atelier), sees and sets the end of the vote, and creates or edits a poll from Destinée mode. "Lancer le vote" on the scenario sheet leads to the same composer, and the creation form explains each mode and nature in plain words. The epic lays `GET /me/datable-seances`, arming by `?seanceId`, and the single default poll deadline.

## Stories

- Story 45.1: Voir les rendez-vous qui attendent une date
- Story 45.2: Arriver dans le calendrier de la partie avec le composer prêt
- Story 45.3: Choisir les jours du vote comme ses dispos
- Story 45.4: Voir et régler la fin du vote
- Story 45.5: Proposer des dates pour une soirée encore sans date
- Story 45.6: Créer ou modifier un vote depuis la Destinée
- Story 45.7: Comprendre ce qu'on crée

## Requirements & Constraints

- A "rendez-vous" is a `Seance` (JDR session or isolated evening/event). "To date" = no date, no poll, event not cancelled, party active, and the reader has the right to propose. The composer exists only in the atelier; from the vitrine (personal calendar), choosing a rendez-vous opens its atelier with the composer armed and the user stays there after validation.
- Button "Proposer des dates" (becomes "Modifier les dates" when the active destiny is the organizer's own poll) appears in all three calendars, absent when there is nothing to date; in evening mode only an isolated evening without a date qualifies; a session whose poll was closed without a date is not listed.
- Composer: availability gesture (days first, then time of day), cumulative selections without modifier key, short tap toggles one slot, at least two slots, full-day refused in evening mode; validate creates/edits, cancel changes nothing. Poll end date prefilled by one pure function (earliest of 14 days from now or the day before the first slot, never before today), follows slots until touched, editable, past date refused, a date after the first slot allowed. Evening mode: changing it re-arms the reminder; JDR: no reminder, pushing it back is the extension. The JDR deadline, silently fixed until now, becomes visible.
- Creation form: each mode option shows a plain-language line ("Jeu de rôle" / "Soirée entre amis"), each nature an explanation line; identical across the three themes, evening-mode wording uses no JDR word.
- JDR must not regress outside the listed screens (sealing, registrations, sheet content). Server stays judge of every right, with a refusal test per right (`docs/security.md`); no data of a party the reader does not organize leaks. Real-time: the vitrine reloads `/me/datable-seances` on `user:{id}`, the atelier follows `partie:{id}`; each write touching an open poll, a session date or the "to date" set emits and calls `notifyPartieSignalsChanged` after commit.
- Mobile: usable by finger, 44 px targets, nothing reachable only by long press. Every changed validated screen is flagged ⚠️ with what changes. French comments and errors; no dependency installation; everything through Docker; CI green each story.

## Technical Decisions

- `isDatableSeance({ hasDate, hasPoll, cancelled, frozen, canOrganize })` and `isComposableSeance()` are pure functions in `@master-jdr/shared`, serving the three calendars. The vitrine reads `GET /me/datable-seances` (served by `events/`; per session: `seanceId`, `partieId`, party name, `family`, `kind`, title, `can`); the "scenario closed" exclusion comes from `scenarios/` through the `DatableSeanceFilter` token declared in `events/ports/` and bound in `PortsModule`. In the atelier the list is derived from the payload already loaded, with the same predicate.
- Single arming by `?seanceId` (JDR and group alike), independent of the route mode; if the session is neither datable nor holding an editable open poll, or `can.propose`/`can.edit` is missing → normal calendar plus "Ce rendez-vous n'est plus à dater." revealing nothing. `?seanceId` removed on validation and cancel; validation sets `?poll=<pollId>` (returned by the write) and activates Destinée on it. Panel `app-poll-creation` / `pollPanelOpen` (8.7) removed; `ComposeConfirmDialog` keeps only the loss-of-answers warning.
- Mode priority: composer > selected automaton window > Destinée; arming the composer suspends Destinée (`?poll` kept), validation reactivates it on the created/edited poll, cancel restores the previous state. Addresses built by `atelierUrl({ partieId, family, role }, params)`.
- Writes: JDR `POST /scenarios/seances/:id/poll` and `PUT /parties/:id/poll/:pollId/options` accept `expiresAt`; isolated evening via `PATCH /parties/:id/events/:eventId` (41.2, full replacement, other fields re-read from the event card, `EVENT_UPDATE {eventId}` required); group via 40.5b round trip, unchanged. Server refuses a past date and applies `defaultPollDeadline(options, today)` (single, replaces `DEFAULT_POLL_TTL_MS`) when absent.
- Rights come from the `can = { propose, edit, choose, extend }` object (epic 44), never from `hostId`. Shared runtime values live in `@master-jdr/shared` (no `import type` on values). `durationSlots` stays 1 until epic 47.
- Composer UI components: `RendezvousPicker` (grouped by party name, row = name + nature; modal drawer < 1024 px, anchored menu above, skipped when only one rendez-vous, focus trap, Esc), `deadline-field` ("Fin du vote : {date} ✎") inside `app-compose-bar`.

## UX & Interaction Patterns

- Gesture: short tap = one band (unchanged, 36.10); long press 450 ms or drag = several days, then the selection bar offers time of day (Journée JDR only, Matin, Après-m., Soir), "Ajouter au vote", "Retirer", "Annuler"; keyboard unchanged (`1` `2` `3`, `Espace`, Shift+arrows, `Entrée`, `Échap`); works in Month and Week, desktop and phone.
- Labels per theme; neutral wording in evening mode. Past deadline marked "passée" and blocks Validate until pushed back; an explanatory line states the default. JDR finished poll board says "Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote."
- From Destinée (45.6): "Modifier les dates" in the controls row and on the board (atelier arms the prefilled composer; vitrine opens the atelier via `atelierUrl(…, { seanceId, poll })`, Destinée stays on the poll after validation) plus a text link "Proposer des dates pour un autre rendez-vous"; none shown to non-organizers.

## Cross-Story Dependencies

- Chain 45.1 → 45.2 → 45.3 → 45.4 → 45.5 → 45.6; 45.7 is independent (only needs palier 10).
- Requires epic 44: `can` and `canMany`, `/me/open-polls`, `partieStatus`, `atelierUrl`, Destinée state and board, `?poll` handling, `bestOption`.
- Epic 46 builds on the composer and docks; epic 47 adds duration to the composer and gesture. Depends on 40.5b (group composer round trip), 41.2 (event update), 36.3 / 36.10 (availability gesture), 8.7 (panel being removed).
