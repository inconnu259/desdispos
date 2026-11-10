# Epic 43 Context: Effacer son compte

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A user can leave the application knowing what disappears: a sensitive zone on the Account page, a preview of the impact, a red confirmation requiring the password, and a deletion done in a single transaction. The feature does not exist today; it is open to everyone, including GMs (MJ) and sole admins (exception 5 of the JDR-frozen rule). Account deletion must never leave orphan groups.

## Stories

- Story 43.1: Voir ce que l'effacement de mon compte emporterait
- Story 43.2: Effacer mon compte

## Requirements & Constraints

- Preview lists only what the user would take down: groups where they are the **sole** admin (name, member count, event count) and JDR parties they own (name, number of players who lose their characters). Groups keeping another admin are absent. Empty lists are omitted from the confirmation.
- Deletion requires the password, targets only the connected user (no id in the route), and is rate-limited like the other authentication routes. A wrong password changes nothing.
- A group keeping another admin survives; its past events show their host as "compte supprimé". A group left without admin is deleted. Owned JDR parties are deleted with their characters (allowed, with the warning).
- After commit only: cancellation e-mails (#7), real-time notifications to affected members, user files handled by the existing deletion rule. All sessions are cut by `AuthService`; the user lands logged out on the public home with a confirmation message.
- Invitations and links created by the user disappear with them through the existing cascade (to be noted in the story).
- Tests required: wrong password, sole admin (group deleted), admin among others (group kept), GM (JDR deleted), host of an upcoming event (cancelled), no effect on other accounts.
- Every story: CI stays green, characterization tests unchanged, batched reads, real-time wiring evaluated (`docs/checklist.md`), ⚠️ on any deviation from a validated screen, French comments/errors, nothing installed, everything through Docker.

## Technical Decisions

- Routes: `GET /me/deletion-impact` (43.1) and `DELETE /me` (43.2); password checked and sessions cut by `AuthService`.
- One transaction: owned JDR parties deleted; for each ralliement membership, `PartiesService.leave(partieId, userId, 'account-deletion')` (upcoming registrations and open votes removed, upcoming hosted events cancelled via the 42.1 procedure, `ownerId` emptied, membership removed, group deleted if no admin remains); then the account itself.
- `Partie.ownerId` / `Event.ownerId` are nullable with SetNull; display falls back to "compte supprimé".
- Shared types/values live in `@master-jdr/shared` (runtime values must not use `import type`).

## UX & Interaction Patterns

- ⚠️ "Zone sensible" section on the Account page, below "Fermer le grimoire" (logout): rule line, label "Zone sensible", one explanatory sentence, red-outlined pill "Effacer mon compte" with an 18 px trash icon.
- Confirmation #1 in the "Votre accord" dialog (`ConfirmDialog`): "Effacer votre compte « *pseudo* » ? Seront supprimés avec lui : … Cette action est irréversible. Pour confirmer, saisissez votre mot de passe." with both lists, a password field, and a solid **red** "Effacer mon compte" button; "Renoncer" cancels everywhere. The preview is recomputed each time the dialog opens, so the user can go name another admin and come back.

## Cross-Story Dependencies

- Requires epic 42 delivered (reuses `leave()` and the cancellation procedure) and epics 39-40 (group admins, `leave()` cleanup).
- 43.2 builds on 43.1 (preview endpoint, section, dialog).
