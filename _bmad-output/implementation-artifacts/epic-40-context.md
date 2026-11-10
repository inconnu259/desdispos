# Epic 40 Context: Les conjonctions d'un groupe

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A ralliement group (`CAMPAGNE_EPISODIQUE`, given its tabs, invitations, admins and single departure procedure in epic 39) gets its actual content: any member proposes a "conjonction" (an `Event` with one `Seance`) that they host, the others sign up or accept a place reserved for them, and the date is either set directly or found together through a date poll (summary, set the date, extend the vote, one reminder the day before the deadline). The vote itself happens in the group calendar's existing "composer" mode until Palier 10.4. Three new e-mails ship (place reserved, date set, vote reminder), and `leave()` now frees the places and votes of whoever leaves. This epic fills the Conjonctions tab that epic 39 left empty. JDR behavior stays unchanged; any change to a validated screen is flagged ⚠️.

## Stories

- Story 40.1: Proposer une conjonction à date fixée
- Story 40.2: Consulter et modifier une conjonction dans sa fenêtre
- Story 40.3: S'inscrire à une conjonction et s'en désinscrire
- Story 40.4: Réserver une place à des membres
- Story 40.5: Proposer une conjonction par sondage de dates
- Story 40.6: Fixer la date d'une conjonction
- Story 40.7: Prolonger le vote et relancer la veille de l'échéance
- Story 40.8: Libérer places et votes de qui quitte le groupe

## Requirements & Constraints

- Any group member proposes a conjonction and is its host (immutable). Fields: name, date (fixed: day + slot; poll: candidate slots + deadline), place, optional meeting time (an "HH:MM" label, never an instant), optional practical info, participation. The host edits it (and later cancels it, epic 42) while it is not past. No "group MJ".
- Participation: "Tous les membres" (signing up = confirming, no limit) or "Places limitées" (N, the host takes one). First come, first served, no waiting list, "Complet" shown to non-registered members. Free unsubscribe while not past. Late sign-ups allowed after the date is set; the date never reopens.
- Only the host reserves named places; a reservation counts in the capacity, never expires, cannot be taken by anyone else; declining frees it.
- Poll: opens as soon as slots are placed (at creation or later), no slot cap; poll and sign-ups coexist. Each candidate slot shows how many registered people are available according to their availabilities. No vote after the deadline or once the date is set. Only the host launches, extends (new capability, absent from JDR, not exposed there) and sets the date.
- The place is visible to all group members and nobody else. A member of group A reads nothing of group B; no IDOR through an event or seance id of another party.
- Every new action gets a server denial test (actions x roles x families matrix).
- E-mails (neutral vocabulary, common layout, sent after commit): #3 "*Léa* vous a réservé une place : « *Conjonction* »" (button "Répondre"); #4 "C'est fixé : « *Conjonction* », *date*" (button "Voir la rencontre"); #5 day-before reminder "Demain : « *Conjonction* »" (date · place, "Voir la rencontre"); #6 "Plus qu'un jour pour voter : « *Conjonction* »" ("Voter dans le calendrier"), sent once, one day before the deadline, only to eligible voters who have not voted. No digest and no other reminder.
- Departure (40.8): the person's `RESERVED` and `CONFIRMED` sign-ups to upcoming conjonctions and votes on open polls are removed; past data kept. Upcoming events they host stay until epic 42 cancels them.
- Scale: 4 to 20 members, ~20 slots over several weeks: no pagination, batched reads (never one query per party or member).
- JDR: sign-up keeps its current rules (episodic only, mandatory capacity, frozen once dated), voting unchanged, reminders keep their recipients and e-mail; 37.1 characterization tests unchanged. French comments and errors; nothing installed; Prisma migrations via `pnpm exec prisma` in the container.

## Technical Decisions

- `POST /parties/:id/events` (list, create with its seance, edit; refuses JDR parties and non-members) on `EventsController` → `EventsService`. `EventsService.create(…)` runs one transaction creating the `Event` (`ownerId` = host) and its single `Seance`; emits after commit. A ralliement event has exactly one seance; this palier writes one-slot ranges only (`start = end`), and a conjonction always has a `startSlot` (never a full day without slot).
- `Seance.startDate/startSlot/endDate/endSlot` are the only date source. Setting the date (or choosing a poll option) writes these columns, closes the poll through `PollService` (only writer of `SessionPoll`/`PollOption`/`PollVote`), then recomputes `nextSessionDate` with the single `EventsService` function. `PollService` no longer writes `nextSessionDate`.
- Existing seance/poll routes stay and are shared by both families: `scenarios/seances/:id/*` (sign-up, capacity, practical info, poll creation), `parties/:id/poll/*` (vote, choice, close). New: `POST …/seances/:id/reservations`, `DELETE …/reservations/:userId` (host), `PATCH …/inscription/accept`.
- Migrations arrive with this epic: `Inscription.status` (`RESERVED` | `CONFIRMED`, default `CONFIRMED`; closed union `InscriptionStatus` in `@master-jdr/shared`) in 40.4, `SessionPoll.relanceSentAt` in 40.7.
- Every write to sign-up, reservation, acceptance, capacity and date choice first takes `SELECT … FOR UPDATE` on the `Event` row (two simultaneous sign-ups on the last place accept only one, tested). `leave()` stays under the party lock and gains the cleanup without new routes.
- `PermissionService.assert(userId, action, target)` is the sole rights decider; for `{eventId}`/`{seanceId}` targets the party is resolved from the target. Group policy: members propose and sign up; the event owner manages the event. No code outside `permissions/` reads `ownerId` for a right.
- `eligibleVoters(event)` and `reminderRecipients(seance)` live in `events/`, one definition each, used by vote, reminder and summary. Group: "tous" → members; limited places → `CONFIRMED` sign-ups. Reminder for a group: host + `CONFIRMED`. In ralliement a vote after `expiresAt` or outside eligible voters is refused.
- The event DTO carries the eligible voters' ids; the vote summary (responses, best slot, "not yet answered") is computed on the screen from that list and the votes, and follows votes in real time. Other people's `RESERVED` rows are served to the host only. DTOs are explicit projections.
- Calendar: ralliement participants of a range = host + `CONFIRMED`; conjonction dates feed `nextSessionDate`, members' unavailabilities (`OccupiedSpansPort`, no title/identity) and personal calendars (`OwnEventsPort`).
- Reminders: the hourly `NotificationsService` task sends per-seance reminders (`Seance.reminderSentAt`) and the single vote reminder (`relanceSentAt`, reset to empty when the deadline is extended; never sent once the date is set). New templates join the closed `EmailTemplate` union, sent through `EmailService` with the common layout.
- Status: a group becomes `EN_COURS` with its first event (single projection function; the front never derives it). `PartieDetail.conjonctionCount` (hard-coded 0 since 39.4) must return the real count.
- Real time: event/seance/sign-up mutations `emit(partie:{id})`; anything visible in the home list (sign-up, reservation, date set, departure) calls `notifyPartieSignalsChanged` after commit; a reservation also emits `user:{id}` of the target. New signal code `RESERVATION_A_CONFIRMER`. `emit` outside transactions; evaluate SSE wiring for every new component (`docs/checklist.md`).
- Web: event creation/detail live in `features/events/`, reusing `DetailSurface`; labels from the theme text registry.

## UX & Interaction Patterns

- **Conjonctions tab:** "+ Nouvelle conjonction" (any member), sections "À venir" then "Passées". **EventCard**: title, status badge, bold date ("Date à voter · jusqu'au …" during a poll), host, place, "Ma situation" line + chip; nothing more on the card. Grid 250 px min, one column under 520 px. Badges: "Vote en cours" orange (not voted) / cyan (voted), "Inscriptions ouvertes" cyan, "À venir" rose, "Dans *n* jours" full rose with 2 px border and 4 px left bar, "Complet" grey, "Passé" grey. Situation chips: "Je participe", "Vote à faire", "Place réservée", "Pas inscrit·e" (dotted), "J'y étais".
- **EventDialog (⚠️ `DetailSurface` widened to `min(900px, 96vw)`, 94 vh, internal scroll, full screen on mobile):** order title + badge → situation panel → the sheet (date, host, place, time, participation "8 places · 5 inscrits · 3 libres" or "Tous les membres", practical info) → participants → footer ("Me désinscrire" or host "Modifier", then "Refermer"). Dialog title = conjonction name; focus trapped then returned to the card; Esc, "Refermer" and browser back restore the list intact (filters, scroll).
- **Creation mode (same dialog):** name; toggle "Date fixée | Sondage de dates" (poll: "Choisir les créneaux dans le calendrier" opens the group calendar in "composer" mode, then a summary "4 créneaux · ven. 17 → sam. 25 oct." and "Le vote se termine le"); place; "HH:MM" time; practical info; participation with stepper and "Réserver une place à des membres" chips (help: returned to others if declined); footer "Renoncer" · "Créer la conjonction".
- **Situation panel:** member (status-todo frame): "Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le *date*.", "Vos réponses : *x* créneaux sur *N*", "Meilleur créneau pour l'instant : *date* — *n* oui", button "Voter dans le calendrier" (to `/parties/:id/guild-calendar`, no focus on the vote). Host (accent-1 frame): "Vous êtes l'hôte. Le vote se termine dans *n* jours — *N* créneaux proposés.", "Réponses : *x* sur *N*", best slot, "N'ont pas encore répondu : *noms*", "Fixer la date…", "Prolonger le vote", "Voir dans le calendrier →". Once dated: panel replaced by date, time and place in large type. No voting inside the dialog.
- **Participants:** 26 px avatar + name, own chip bordered accent-1; pending reservation visible to host only, dotted chip, faded avatar, text "*Nom* — invité·e, n'a pas encore accepté" at full contrast (≥ 4.5:1). ⚠️ Admin avatars carry the 14 px shield in the corner (not yet drawn: follow the UX proposal, review with the user), with "Admin" also as text.
- **Confirmations ("Votre accord", "Renoncer" = cancel):** "Fixer la date" lists slots as radio buttons sorted best first with "*n* oui · *n* peut-être · *n* non", best preselected, text "La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles." "Prolonger": "« *Conjonction* » — le vote se termine le *date*.", field "Nouvelle échéance" (later than current), "Les personnes qui n'ont pas encore voté seront relancées la veille de la nouvelle échéance."
- **Accessibility:** state always written, never color or stroke alone; no added animation.

## Cross-Story Dependencies

- Requires epic 39 (Conjonctions tab shell, common e-mail layout, `leave()` under party lock, last-admin confirmation) and epic 37 foundations (`Event`/`Seance` range, `PermissionService`, calendar ports, per-seance reminders).
- Strict chain: 40.1 → 40.2 → 40.3 → 40.4 → 40.5 → 40.6 → 40.7; 40.8 needs 39.5 and 40.7.
- Prepares epic 41 (isolated evening reuses the dialog, poll, fixed date and e-mails; eligible voters = accepted guests), epic 42 (cancellation under the same `Event` lock, inside `leave()`), Palier 10.4 (vote in the calendar, "Destinée" focus, long ranges).
- Out of scope: cancelling a conjonction, isolated evenings, multiple seances per event, redesigning the calendar/poll screens.
