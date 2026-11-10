# Epic 41 Context: La soirée isolée

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A "soirée isolée" is a one-off ralliement (`ralliement` family, kind `ONE_SHOT`) that a host organises with invited guests. It reuses everything epic 40 built for groups (event dialog, date poll, fixed date, e-mails) and only changes the page layout (no list, the single event is shown inline) and who may vote (the host plus guests who accepted). The epic delivers: the single-page layout, the creation dialog opened right after the party is created, invitations with accept/decline, and the "terminée" status once the date has passed. JDR behavior stays unchanged; any change to a validated screen is flagged ⚠️.

## Stories

- Story 41.1: Afficher une soirée isolée sur une seule page
- Story 41.2: Poser la rencontre dès la création de la soirée
- Story 41.3: Inviter à une soirée, accepter ou décliner
- Story 41.4: Clore une soirée une fois passée

## Requirements & Constraints

- A soirée isolée has exactly one event (verified under lock), is never attached to a group, and cannot be moved or given a second event. The host is the owner and the only admin: no "Nommer admin", no "Quitter l'office" (server-refused, tested).
- The host invites by pseudo search, e-mail or invitation link, with no limit, and removes guests before the evening. A nominative guest sees "Accepter / Décliner" at the top of the page until they answer, and may vote only after accepting. Declining deletes the invitation; accepting creates the `Membership`.
- Eligible voters = host + accepted guests (`eligibleVoters`). Participation is read-only: "Sur invitation · pas de limite", no limited places, no reservations.
- Date is fixed directly or by poll, with the same journey as stories 40.5–40.7. The host edits the event while it is not past.
- A past evening is frozen: no invitation, vote, edit or guest removal (server-refused, tested). Status: cancelled → ANNULEE (epic 42), `closedAt` or past range → TERMINEE, otherwise A_VENIR; with no date set it stays "À venir".
- E-mail #2 (invitation to an isolated evening, "*Marc* vous invite : « *Soirée* »", button "Accepter ou décliner") plus #4/#5/#6 reused for the evening's members, all in the common layout and neutral vocabulary.
- Every new action gets a server denial test; batched reads; real-time wiring evaluated for every component (`docs/checklist.md`). French comments and errors; nothing installed; everything through Docker.

## Technical Decisions

- Single `PermissionService.assert(userId, action, target)` decides rights; policy `ralliement` + `ONE_SHOT` has one admin (the owner). `eligibleVoters(event)` and `reminderRecipients(seance)` live in `events/`, one definition each; for an isolated evening the voters/recipients are the party's members.
- The evening's invitation is the existing party-level `Invitation` → `Membership` (no per-event invitation, no limit). Removing a guest goes through the single `PartiesService.leave()` procedure (open votes removed).
- The creation dialog completes the event already created with the party (story 38.2) instead of creating a second one. "Renoncer" leaves a "Date à fixer" event the host completes later from the first tab.
- Status is computed by the single projection function (AD-18); the front never derives it. Real time: mutations visible in the home list call `notifyPartieSignalsChanged` after commit; emit outside transactions; the "Invitation à accepter" signal stays in the existing invitations section of the list.
- Web: one party page whose tabs derive from family + kind; event UI lives in `features/events/`, reusing `DetailSurface`/event detail in-line; labels from the theme text registry.

## UX & Interaction Patterns

- Same page as a group but the first tab, named per theme in the singular ("Conjonction", "Halte", "Réunion"), shows the event detail inline (title + badge, situation panel, sheet, footer) — no card, no dialog. No "Détails" tab. Second tab: "Invités" (guest view, participants list) or "Invitations" (host view, list and management, empty state "Aucun invité pour l'instant"). The participants list is not in the first tab.
- Header subtitle: "Ralliement · *type*" (e.g. "Ralliement · La conjonction des Esprits").
- Banner "Accepter / Décliner" at the top of the page for an unanswered nominative guest; chip "Invitation à accepter". Situation chip "J'y étais" once past; badge "Terminée" / "Passé"; hidden by the existing "hide finished" checkbox.
- Creation dialog opens over the evening page, pre-filled with the name; same fields as the group version except participation (read-only text pointing to the Invitations tab).
- State always written, never color alone.

## Cross-Story Dependencies

- Requires epic 40 delivered (event dialog, poll, set date, extend vote, reminders, `leave()` cleanup), epic 38 (creation of an isolated evening, page by family) and epic 37 foundations.
- Strict chain: 41.1 → 41.2 → 41.3 → 41.4.
- Prepares epic 42 (cancelling an isolated evening, "annulée" state) and epic 43 (account deletion).
- Out of scope: cancellation, groups, multiple events per evening.
