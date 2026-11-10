---
title: '40.5b — Group calendar for a conjonction poll'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'e884702ae4e47db7113490270c0004dc79ff3363'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-40-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-40-5-proposer-une-conjonction-par-sondage-de-dates.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 40.5 opens date polls on group conjonctions, but nobody can use them from the interface: the calendar page of a group loads data the server refuses to groups, offers no composer to the host and no way to vote, and no link leads to it from a group (FR10, FR11, UX-DR9; split from 40.5 by user decision, 2026-10-17).

**Approach:** The existing calendar page (`/parties/:id/guild-calendar`, personal mode) learns the group case: it loads the group's conjonction polls from the events list, shows their slots as vote tracks the eligible member answers (existing vote picker, shared vote routes), and lets the host compose slots on the grid, for a poll already open or for the creation window. The group page and the dialog link to it.

## Boundaries & Constraints

**Always:** A group is detected from the party (ralliement family, `CAMPAGNE_EPISODIQUE`); for a group the page skips every call the server refuses to groups (`available-slots`, `heatmap`, scenarios list, MJ panels, `refreshMjPanels`) and never shows the layer « disponibilité du groupe »; the member's own availability declarations and layers keep working. Group polls come from `GET /parties/:id/events/list` (`EventCardDto.poll`, status `OPEN`, undated seance): one vote entry per option, label = conjonction title, slot as served, `VoteParticipation` built from `poll.votes` and `total = eligibleVoterIds.length`; the page reloads that list on the same live signal that reloads scenarios (no new `'partie:'` handler). The vote picker opens only for an eligible viewer before the deadline (`eligibleVoterIds`, `expiresAt`, status `OPEN`); others see the tracks and counts read-only; answers go through `castVote`/`withdrawVote` on the shared routes, server remains judge. Host compose: the grid arms « composer » for the host of an open poll conjonction (not past deadline restrictions beyond the server's) seeding cells from its options; cells are `MORNING|AFTERNOON|EVENING` only (`FULL_DAY` refused with a written reason), at least 2, no business cap (technical guard = server's); on confirm the page sends `PATCH /parties/:id/events/:eventId` as the full replacement with the card's other fields (title, lieu, heure, infos, capacity) and the new `pollOptions` + unchanged `pollDeadline` (YYYY-MM-DD from `expiresAt`), never `date`/`slot`; the existing removal warning shows how many answers are lost (from `poll.votes`). Creation round trip: the window's « Choisir les créneaux dans le calendrier » stores the draft (title, lieu, heure, infos, participation, reservations, deadline, slots) in a root-level service, navigates to the same page with composer armed for « nouvelle conjonction » (no server call), and on confirm or cancel returns to the group page with the creation window reopened and the draft restored, slots summarized (`N créneaux · ven. 17 → sam. 25 oct.`, editable); the in-window slot list of 40.5 stays. Entry points (written, focusable, never icon-only): link « Calendrier du groupe » in the Conjonctions tab header; in the dialog, « Voter dans le calendrier » (eligible member, panel `Vote à faire`) and « Composer les créneaux » (host), going to the page without focusing the vote (that is Palier 10.4); the 39.1 spec assertion that a group has no calendar link is updated to this contract. JDR calendar behavior, props, routes and existing `calendar-view` specs unchanged; MJ mode untouched. Labels in the three tones, `NEUTRAL_KEYS` and banned-JDR-words rules respected. French comments and messages.

**Never:** No new server route, action or migration (shared routes and the 40.5 edit route suffice); no « Fixer la date », « Prolonger », reminder or e-mail (40.6, 40.7); no group availability heatmap or per-slot nominative data (`PARTIE_AVAILABILITY_READ` stays closed); no Palier 10.4 work (Destinée focus, filter by party); no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open page as group member | `/parties/:id/guild-calendar` | grid, own declarations, vote tracks of the group's open polls; no 403 call, no group-availability layer | list failure → visible error, last state kept |
| Vote | eligible member before deadline | answer saved, tracks update live | server refusal shown |
| Read-only | non-eligible member, or deadline passed | tracks and counts, no picker | — |
| Host composes (open poll) | ≥ 2 cells, `FULL_DAY` refused | `PATCH` full replacement, kept slots keep votes, loss count warned | server 400 shown |
| Compose for creation | cells chosen, confirm or cancel | back to group page, creation window reopened with draft and slots | cancel keeps the draft |
| Entry points | group tab, dialog | links reach the page, no vote focus | — |
| JDR / MJ | any JDR party | unchanged | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html}` -- `loadForPartieId` :1448 (calls to skip for groups), `loadScenarios` :1526, `activePolls`/`allCalendarEntries` :445-581 (vote entries from `scenarios()`), `onVoteOptionActivated` :1839, `writeVote` :1913, compose state :976-1127 (`composeCanConfirm`/`composeBlockedReason` 2..40 :1038-1054, `canCompose` :1057, `startCompose` :1073, `confirmCompose` :1145), `availableLayerKeys`/`defaultLayersForContext` :282-292, `refreshMjPanels` :2049, back button `location.back()`; reuse `compose-bar/`, `compose-confirm-dialog/` ('poll' mode), `poll-track.utils.ts` (`VoteParticipation`).
- `apps/web/src/app/app.routes.ts` :130-133 -- `guild-calendar` route (`data.mode = 'personal'`), add only what the group case needs (no guard change).
- `apps/web/src/app/features/events/` -- `events-api.service.ts` (`list`, `update`), `event-form/*` (payload builder, draft source), `event-create/*`, `conjonctions-tab/*` (header link, reopen creation with the draft; `history.pushState` dialog entry must survive the round trip), `event-dialog/*` (poll panel buttons); new root-level draft service for the creation round trip.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- the « no calendar link for a group » assertion (:3488) to update; `core/parties` service for the party lookup (family / kind).
- Tones `core/theme/tones/*.ts`, `theme-tone.service.spec.ts`; UX `ux-jdr-master-2026-10-08/DESIGN.md` §7.7, `palier-10-4-entrees.md`.
- Server contracts to rely on, not change: `EventPollDto` (`packages/shared/src/index.ts`), `PATCH /parties/:id/events/:eventId`, `POST|DELETE /parties/:id/poll/:pollId/vote…`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/features/calendar/calendar-view/*` (+ specs) -- group case: skipped loads, poll entries from the events list, read-only/eligibility, host compose for an open poll, compose-for-creation target
- [x] `apps/web/src/app/features/events/` (+ specs) -- draft service, creation round trip, header link, dialog buttons
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- update the group link assertion
- [x] tones ×3 + `theme-tone.service.spec.ts` -- links, composer reasons, read-only texts

**Acceptance Criteria:**
- Given an eligible member opens the group calendar, when they answer a slot, then the vote is saved and every member's tracks update live.
- Given the host composes new slots on the grid for an open poll, when they confirm, then the conjonction's slots are replaced, kept slots keep their votes, and the loss count was warned.
- Given a member starts « Nouvelle conjonction » by poll and picks slots on the calendar, when they return, then the creation window reopens with their draft and the slot summary.
- Given any JDR party or the MJ calendar, then all existing tests pass with unchanged expectations.

## Implementation Notes

- Groupe détecté par `PartiesService.get` (`familyOf` = ralliement et `CAMPAGNE_EPISODIQUE`), jamais en mode MJ ; échec de lecture = comportement d'une quête. `EventsApiService` n'est résolu qu'à la demande (`Injector`) pour ne pas tirer HttpClient dans le calendrier JDR.
- Cibles de composition ajoutées à `ComposeTarget` : `group-poll` (PATCH complet, avertissement via `ComposeConfirmDialog` `group: true`) et `group-new` (aucun appel serveur, `ConjonctionDraftService`). Armer bascule en vue Semaine (seule vue à créneaux précis) ; `FULL_DAY` refusé avec raison écrite.
- Retour du calendrier : `router.navigate(['/parties', id], { replaceUrl: true })` ; le dialogue de détail remplace de même son entrée d'historique (`replaceUrl`) pour ne pas laisser d'entrée fantôme.
- Non vérifié : contrôle visuel Chrome (extension non connectée) ; `pnpm test:e2e` API non relancé (aucun changement serveur). Web : tests verts hors les 2 échecs de date connus ; `pnpm build` OK.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge, verif | `groupPollRows` deadline `replace(/.$/, '')` truncates dot-less months | medium | same defect as 40.5 triage #1; « mars », « mai », « juin », « août » lose a letter | patch |
| 2 | blind, edge | Group PATCH built from the card captured before the warning dialog | medium | full replacement could overwrite a concurrent edit of other fields; `fresh` is already re-read | patch |
| 3 | verif | Stale-answer guard in `confirmGroupPoll` untested | medium | removing the `fresh` block leaves every spec green on the one destructive write | patch |
| 4 | blind, edge | Draft lost / reopen flag stranded when leaving by browser Back | medium | only Retour/Annuler/confirm call `finishCompose`; spec says the draft survives | patch |
| 5 | edge | Seeded slots may lie outside the displayed week | low | host sees an empty grid; one-line fix | patch |
| 6 | verif | Untested: route reuse for a group, `member-done` dialog button, `group-new` week switch | low | mutation of each leaves specs green | patch |
| 7 | blind | Hard-coded 2026-11/12 dates in new specs | medium | become past within weeks, like the known 2026-09 failures | patch |
| 8 | verif | Legend wiring for groups unchecked | low | static wiring | defer |
| 9 | blind, edge | Dup history entry after the round trip; Back lands on the same page once | low | cosmetic | reject |
| 10 | blind | Host who is also eligible has no « Voter dans le calendrier » in the dialog | low | the tab header link « Calendrier du groupe » reaches the page | reject |
| 11 | blind, edge | Silent tap for non-eligible / past-deadline; view can leave Week mid-compose; refusal wording | low | side panel states the reason; agenda-hides-bar is the existing JDR compose behavior | reject |
| 12 | edge | SSE before `resolveGroup`, `get` failure fallback, stale `pollActionPending`, expired poll arming, popstate restore | low | transient or rare; documented fallback to previous behavior | reject |
| 13 | blind | `ComposeConfirmDialog` key building, `mode: 'new'` with `group`; process/hygiene notes | low | style only | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- green except the 2 known date failures; `pnpm build` -- builds
- `docker compose exec api pnpm test:e2e` -- green (no server change expected)
- `graphify update .` after the code changes

**Manual checks (if no CLI):**
- Chrome MCP: member of a group votes from the calendar; host recomposes slots; creation round trip keeps the draft; JDR calendar unchanged.
