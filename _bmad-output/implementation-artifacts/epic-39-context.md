# Epic 39 Context: Rassembler sa bande

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A ralliement group (`CAMPAGNE_EPISODIQUE`, created in epic 38) becomes a living group: it opens on its list of "conjonctions", admins invite friends by pseudo, e-mail or link, several admins can coexist (appoint, step down from the office), and members leave or are removed through one single departure procedure. Along the way the first ralliement e-mail (group invitation) ships and every app e-mail, existing ones included, moves to a common branded layout. Epic 38 laid the foundations (registry, `Membership.role`, `ralliement` permission policy); epic 40 adds the conjonctions themselves, so the tab opens on an empty state here. JDR behavior stays unchanged except where marked ⚠️ (UI contract: any change to a validated screen is flagged).

## Stories

- Story 39.1: Ouvrir un groupe sur ses conjonctions
- Story 39.2: Donner un gabarit commun à tous les e-mails
- Story 39.3: Inviter quelqu'un dans un groupe
- Story 39.4: Nommer des admins et quitter l'office
- Story 39.5: Quitter un groupe ou en retirer un membre

## Requirements & Constraints

- Only an admin can invite or remove members; a non-admin gets a server refusal, covered by a denial test (actions x roles x families matrix). Admins can appoint other admins; several admins may coexist.
- Accepting a group invitation creates a `Membership` `MEMBER`; the invitation targets the group, not a conjonction.
- Stepping down from the office turns an admin into a plain member. If they are the last admin, stepping down deletes the group (members and conjonctions included) after an explicit confirmation. These actions do not exist for a one-shot encounter (single admin).
- Leaving or being removed: the person loses upcoming sign-ups and open votes, upcoming events they host are cancelled, past data is kept. In this epic only the membership/owner/last-admin parts exist; epic 40 adds sign-up and vote cleanup, epic 42 event cancellation, through the same procedure without new routes.
- JDR: removing a player keeps its current behavior; the JDR tabs and default tab are unchanged.
- E-mails: group-invitation e-mail uses neutral vocabulary (no theme, an invitee may have no account): subject "*Marc* vous invite à rejoindre « *Groupe* »", button "Rejoindre le groupe". Existing e-mails keep their text and recipients; only button and footer change; their tests check only the button and the footer presence.
- Outside JDR, the UI avoids "MJ", "campagne", "scénario", "séance", "joueur"; labels come from the theme text registry.
- Nothing may be installed (repo-wide absolute rule); repo comments and error messages in French.

## Technical Decisions

- `Membership.role` (`ADMIN` | `MEMBER`, default `MEMBER`) already exists (epic 38). `membersOf(partie)` is the single "who is in the party" function (ralliement: memberships only, creator included).
- Any operation that changes the admin count (appoint, step down, leave, removal, later account deletion) first takes `SELECT ... FROM "Partie" WHERE id = ... FOR UPDATE`, then recounts, so two simultaneous departures never leave a group without admin.
- `PartiesService.leave(partieId, userId, cause)` is the only exit path (admin removal, voluntary leave, later account deletion). It runs under the party lock; clears `ownerId` where the person was owner; removes the `Membership`; deletes the ralliement if no admin remains. Design it to be extended by later epics, not duplicated.
- `PermissionService` stays the sole rights decider; the group policy gives admins party-level rights (invite, remove, appoint, delete), members the rest. No code outside `permissions/` reads `ownerId` for a right.
- Routes: `DELETE /parties/:id/members/me` (voluntary leave), `PATCH /parties/:id/members/:userId/role` (appoint admin, step down), member removal reuses the existing members route.
- Every mutation visible in the home list or member lists (new member, role change, leave, removal, deletion) calls `notifyPartieSignalsChanged` after commit (emits `user:{id}` for `membersOf`); `emit` stays outside transactions. New scoped components must be evaluated for SSE wiring (`notifyChanged()`, `docs/checklist.md`).
- Web: one single party page; tabs derived from `family` + `kind` via the registry; theme labels via the text registry. DTOs are explicit projections, never raw Prisma objects.
- E-mails: single `layout.hbs` common layout (full green button, footer "Dés Dispos" replacing "jdr-master"); new templates are added to the closed `EmailTemplate` union in `@master-jdr/shared`; sent through `EmailService`.

## UX & Interaction Patterns

- **Group view (⚠️):** tabs in order "Conjonctions" (default, theme names: Conjonctions / Haltes / Réunions), "Détails", "Missives". Conjonctions tab: sections "À venir" then "Passées", empty state "Aucune conjonction pour l'instant". Détails: description and settings, no event cards. No Homme Dragon / Chapitres / Chronologie for a group. Footer keeps "Retranscrire", "Clore", "Brûler" for admins; "Sceller des secrets" does not exist for a group; adds "Quitter l'office" (admin) and "Quitter le groupe" (plain member only), both in the footer between "Clore" and "Brûler" (39.4/39.5); "Quitter le groupe" is not red (a re-invitation brings the person back).
- **Missives:** members list, invite by pseudo / e-mail / link (admin only; members see the list). "Admin" badge (shield) on each admin, in Missives (a group page has no avatar rail: the 14 px avatar-corner shield moved to epic 40.2, decided with the user); "Nommer admin" on each non-admin member; "Quitter l'office" on one's own admin row; "Retirer" unchanged.
- **Confirmation dialog (⚠️):** "Votre accord" title, "Renoncer" = cancel everywhere; new red variant for irreversible actions, also used by "Brûler". Texts: appoint, "Nommer *Léa* administratrice de « *groupe* » ? Elle pourra ajouter et retirer des membres et nommer d'autres administrateurs." (button "Nommer admin"); other admin remains, "Quitter l'office d'administrateur de « *groupe* » ? Vous restez membre du groupe." (button "Quitter l'office"); last admin, warns the group is deleted with its *n* members and *n* conjonctions, suggests naming another admin first, red button "Quitter et supprimer".
- **E-mail layout (⚠️):** full green button instead of underlined link; footer "Dés Dispos".
- **Accessibility:** never color alone (red accompanied by a word and glyph); badges carry a word; no added animation.

## Cross-Story Dependencies

- Requires epic 38 (group creation, `Membership.role`, ralliement policy, registry, theme text registry). Epic 37 foundation (`PermissionService`, ports) assumed.
- 39.1 first (tab shell); 39.2 independent but must precede 39.3 (invitation e-mail uses the common layout); 39.4 needs 39.3 (Missives actions, red confirmation variant); 39.5 needs 39.4 (last-admin confirmation and locking rules).
- Prepares epic 40 (conjonction cards fill the Conjonctions tab; `leave()` gains sign-up/vote cleanup), epic 42 (event cancellation inside `leave()`), epic 43 (account deletion reuses `leave()`).
- Out of scope: creating conjonctions, one-shot invitations (epic 41), account deletion, removal from one's list.
