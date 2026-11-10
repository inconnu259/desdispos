# Epic 42 Context: Annuler et ranger

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Hosts (and group admins) can cancel a ralliement event ("conjonction") or an isolated evening before its date, with participants warned by e-mail, so nobody travels for nothing. Cancelled is a status distinct from finished. Users can then filter or hide cancelled/finished parties, and permanently remove a finished or cancelled party (JDR included) from their own list. Cancellation is ralliement-only; JDR never becomes ANNULEE.

## Stories

- Story 42.1: Annuler une conjonction de groupe
- Story 42.2: Annuler une soirée isolée
- Story 42.3: Annuler les conjonctions de qui quitte le groupe
- Story 42.4: Filtrer et masquer les parties annulées
- Story 42.5: Retirer de sa liste une partie terminée ou annulée

## Requirements & Constraints

- Who: the event host, or any admin of the group, only while the event is not past. A plain member, or anyone on a past event, is refused server-side (denial tests required for every new action).
- Cancellation is final: no undo, no reopening. A cancelled event refuses every later action (registration, reservation, vote, date, edit). An open date poll is closed by the poll service.
- A cancelled event leaves reminders, vote nudges, derived unavailabilities, `nextSessionDate` and personal calendars.
- E-mail #7 "Annulée : « *Conjonction* »" ("*Hôte* a annulé … Vous n'avez rien à faire.", button "Voir") goes to registered members and reserved places, sent only after the transaction commits, in the common e-mail layout with neutral vocabulary (no "MJ/séance/joueur" outside JDR).
- Accessibility: state is always written ("Annulée"), never colour or stroke alone; the status red must meet contrast in all three themes, verified and recorded in the story.
- Red is reserved for "irreversible" and "cancelled" (status-unavailable token). Confirmations for irreversible actions use a solid red button in the "Votre accord" dialog, "Renoncer" being the cancel button.
- The "remove from my list" confirmation text and button are fixed ("Retirer « *nom* » de votre liste ? Elle disparaîtra définitivement pour vous seul ; les autres participants la conservent." / "Retirer"). No wording exists yet for the cancel-event confirmation: it must be written and flagged.
- Hiding is per user and affects only its author; a hidden party is excluded server-side from every read of that user (list, signals, personal calendar) with no parameter to bring it back; reopening a closed party deletes its hides. Hiding is refused unless the party is TERMINEE or ANNULEE.
- Every story: CI stays green, characterization tests unchanged, batched reads, real-time wiring evaluated (`docs/checklist.md`), ⚠️ on any deviation from a validated screen, French comments/errors, nothing installed, everything through Docker.

## Technical Decisions

- Data: migration adds `Event.cancelledAt` (ralliement only) in 42.1, and `PartieHidden(userId, partieId)` in 42.5; migrations run with `pnpm exec prisma` in the container.
- Cancellation runs under the `FOR UPDATE` lock on the `Event` (shared with registration, reservation, capacity and date choice); poll closing goes through `PollService`; e-mail and real-time emission happen outside the transaction, after commit.
- Status is computed by one projection function: isolated evening: cancelled → ANNULEE, `closedAt` or past range → TERMINEE, else A_VENIR; group: `closedAt` → TERMINEE, ≥1 event → EN_COURS, else A_VENIR. `PartieStatus` gains ANNULEE. The front never derives status.
- Permissions: `PermissionService.assert(userId, action, target)` is the single decision point; new action(s) for cancelling and hiding go through it. Host/admin roles come from the existing policy (isolated: owner only admin).
- Isolated evening cancellation (42.2) reuses the 42.1 procedure on its single event, also revokes pending invitations and invitation links, and notifies members plus nominative guests who have not answered; members see the `PARTIE_ANNULEE` signal.
- Departure of a host (42.3) calls the 42.1 procedure inside the single `PartiesService.leave()` transaction, for upcoming hosted events only; past ones stay intact.
- Hiding route is dedicated: `PUT /parties/:id/hidden`. List projections read in batch.
- Signals/real-time: new code `PARTIE_ANNULEE`; every mutation visible in the home list calls `notifyPartieSignalsChanged` after commit; hidden parties are absent from signals.
- Shared unions (`PartieStatus`, `PartySignalCode`, `EmailTemplate`) live in `@master-jdr/shared`; use runtime values, not `import type`, for values.

## UX & Interaction Patterns

- Cancel entry point: "Annuler la conjonction" in the event dialog footer ("Modifier · Annuler la conjonction" for the host; admins also see it), shown only before the date.
- Cancelled card: stays in its section and stays clickable; content faded to 50 %, semi-transparent red diagonal stroke (status-unavailable at ~60 %), written badge "Annulée". The dialog shows the "Annulée" state at the top with no action available.
- Home list ⚠️: "Phase" filter gains "Annulée"; the "hide closed" checkbox (`dashboard.hide_finished_label`, per-theme wording) also hides cancelled and its label must say so in all three themes; the user's saved preference keeps its current behaviour. Filters apply to quests and ralliements alike.
- "Retirer de ma liste": entry point (tile menu or party detail) is not designed (open UX item); choose it at the start of 42.5 and review it with the user.

## Cross-Story Dependencies

- Requires epic 41 (isolated evening, TERMINEE status) and epic 40 (event dialog, poll, `leave()` cleanup, e-mails).
- Chain: 42.1 → 42.2 → 42.4 → 42.5; 42.3 needs 40.8 and 42.1.
- Epic 43 (account deletion) later reuses `leave()`, including the cancellation of hosted upcoming events.
