---
title: '41.3 — Invite to an evening, accept or decline'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'f7d2a10cd9556f9f28196dd87960aa5096e4a413'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-41-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-41-2-poser-la-rencontre-des-la-creation-de-la-soiree.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The host of an isolated evening has no way to invite anyone: the "Invitations" tab (41.1) only lists members, the invitation tools exist for groups only, and an invited person gets no e-mail telling them about the evening (FR2, FR12 #2).

**Approach:** Reuse the existing party-level `Invitation` / invite link machinery (rights already open to the evening's host, no limit). Add e-mail #2 for evenings and the host-side tools on the "Invitations" tab. The nominative guest answers from the home list's received invitations (decision of 2026-10-18, no read access to the page before accepting), which gets the "Invitation à accepter" chip.

## Boundaries & Constraints

**Always:** Server: no new route, cell or migration. `INVITATION_*` / `INVITE_LINK_*` stay host(admin)-only; a guest or stranger is refused. Add the closed-union template `soiree-invitation` (subject « *Marc* vous invite : « *Soirée* » », body with the date line — fixed date, or « date à voter jusqu'au … », or « date à fixer » — and the place when known, neutral vocabulary, button « Accepter ou décliner », common layout) sent by `InvitationsService` for a `ONE_SHOT` ralliement only, both for the pseudo invitation (`invite`) and by e-mail (`inviteByEmail`: known account → link to the home page, unknown address → the existing join link); a mail failure never fails the invitation. Event data for the mail comes from a new read-only `EventsService.invitationNotice(partieId)` (invitations never read event tables). Groups and JDR keep their exact mails and behavior. Accepting creates the `Membership` (existing), which makes the guest an eligible voter and a participant; a non-accepted invitee cannot vote (403, tested); declining keeps the existing `DECLINED` status. Removing a guest goes through `leave(REMOVED)`, which already deletes their open votes (test it for a soirée). Realtime: invitation and acceptance already emit `user:{id}` / `partie:{id}`; the host's page and lists must refresh (tested on the web side). Web: on a `ONE_SHOT` evening the host's tab shows guests (members except the host) with « Retirer », the invitation tools (pseudo search, e-mail, link create / revoke) and « Aucun invité pour l'instant » when empty; no « Nommer admin », « Quitter l'office » or admin badge (`isGroupAdmin` stays group-only; `canInviteMembers` covers group and evening). The notice line (« Missive envoyée à… ») shows for any ralliement. Received invitations of a ralliement carry the chip « Invitation à accepter » (`todo` tone, written text) beside Accepter / Refuser. French comments and messages; nothing installed; Docker only.

**Never:** No page or event read access for a pending invitee, no banner on the evening page (decided out); no pending-invitation list on the host tab; no change to who may quit (guests of an evening still cannot leave); no frozen past evening (41.4); no cancel (42).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Invite by pseudo | host invites an existing user | invitation PENDING, invitee refreshed live, e-mail #2 to them | already member → 409 |
| Invite by e-mail, known | host enters a known address | invitation + e-mail #2 with link to home | — |
| Invite by e-mail, unknown | unknown address | invite link + e-mail #2 with join link | — |
| Many guests | host invites a 13th, 14th… | accepted, no limit | — |
| Accept | invitee accepts | membership, voter and participant; host page and lists refresh | not the invitee → 404 |
| Decline | invitee declines | status DECLINED, tile leaves the list | already treated → 409 |
| Not accepted | invitee votes | refused | 403 |
| Remove guest | host removes an accepted guest | membership and open votes gone | non-host 403 |
| Non-host invites | guest or stranger | refused | 403 |
| Group / JDR | any other party | unchanged mails and tools | — |

</frozen-after-approval>

## Code Map

- `apps/api/src/invitations/invitations.service.ts` -- `invite` :31 (add the evening mail), `inviteByEmail` :151 (third branch for `ONE_SHOT`), `accept`/`decline` unchanged; module `invitations.module.ts` imports `EventsModule` for `EventsService`.
- `apps/api/src/events/events.service.ts` -- new `invitationNotice(partieId)` (first event, its seance, poll deadline, place).
- `apps/api/src/email/{email-template.enum.ts,email.service.ts,templates/soiree-invitation.hbs}` + `email.service.spec.ts`, `email.integration.spec.ts` (template lists, subject, button).
- `apps/api/src/parties/parties.service.ts` `leave()` :519 -- already clears open votes for any ralliement; only tested here.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.{ts,html}` -- `canInviteMembers` :254, `isGroupAdmin` :261, tab 2 block (ralliement members) and its invite tools `#inviteTools`, notice `@if (isGroup() && notice())`; `otherMembers` :362.
- `apps/web/src/app/features/dashboard/dashboard.{ts,html}` -- received invitation tile, `invitationSystemLabel`; `StatusBadge` for the chip.
- Tones (3 themes) + `theme-tone.service.spec.ts` -- `partie.ralliement_soiree_guests_empty`, `dashboard.invitation_pending_chip`.
- Tests: `ralliement.e2e-spec.ts` (new describe, mails via `h.email.calls`), `invitations.service.spec.ts`, `events.service.spec.ts`, `partie-detail.spec.ts`, `dashboard.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api` email + events + invitations -- template, `invitationNotice`, evening branches of `invite` / `inviteByEmail` (+ unit specs, email specs)
- [ ] `apps/api/test/characterization/ralliement.e2e-spec.ts` -- evening invitations: host-only, no limit, mails, accept / decline, vote refusal then success, remove guest clears votes
- [ ] `apps/web` partie-detail + dashboard + tones -- host tools and empty state on the evening's tab, group-only admin actions kept, chip on received invitations (+ specs)

**Acceptance Criteria:**
- Given the host of an isolated evening, when they invite by pseudo, e-mail or link, then the invitation exists without any count limit and the invitee receives e-mail #2 with the common layout.
- Given an invited user, when they accept from the home list, then they are a member and an eligible voter and the host's page updates without reload; before accepting they cannot vote.
- Given the host removes an accepted guest, then their open votes disappear.
- Given groups and JDR, then their invitation mails and tools are unchanged.

## Implementation Notes

- Implemented directly in the session (no implementation subagent); the review ran inline (no reviewer subagents).
- Server: template `soiree-invitation` (enum, subject, button, `.hbs`); `EventsService.invitationNotice`; `InvitationsService` sends e-mail #2 for a `ONE_SHOT` ralliement from `invite` (pseudo) and `inviteByEmail` (unknown address: join link; known account: a single mail, `invite` sends it); `InvitationsModule` now imports `EventsModule`. No route, cell or migration. `leave(REMOVED)` already cleared open votes for every ralliement: only tested.
- Web: `canInviteMembers` covers group and evening, `isGroupAdmin` is now group-only (no "Nommer admin" / "Quitter l'office" for an evening); the host's tab shows the empty state « Aucun invité pour l'instant »; the notice shows for any ralliement; received ralliement invitations carry the chip « Invitation à accepter » (`StatusBadge`, `todo`).
- ⚠️ Intended expectation changes in `partie-detail.spec.ts`: the 38.4 admin "no management" listing test is now member-only, the 39.3 isolated "no invitation interface" test now expects the host's tools and a guest without any, the 39.4 isolated test keeps "no badge / no role action" but allows the host's "Retirer".
- Unchanged by design: guests of an evening still cannot leave; no pending-invitation list on the host tab; no banner on the page (decision 2026-10-18).
- Environment note: `WEB_ORIGIN` is a comma-separated list in this dev setup, so the link of an e-mail built from it (as every existing mail does) contains both origins; not touched here.
- Results: API typecheck, unit tests (only the known date failure), full e2e (316); web suite (only the 2 known date failures).
- Not done: Mailpit and Chrome checks are left to the user.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | inline | The host cannot see or revoke pending invitations on the tab | low | Same as quests today (the API has `GET invitations`, no UI); the spec excludes it | reject |
| 2 | inline | A guest who declines leaves a `DECLINED` row rather than a deleted one | low | Existing behavior, spec keeps it | reject |
| 3 | inline | The e-mail #2 link of a known account goes to the home page, not the evening | low | The guest cannot read the evening before accepting; decided with the user | reject |
| 4 | inline | `isGroupAdmin` no longer aliases `canInviteMembers` | low | Needed so an evening host does not get group-only admin actions; covered by tests | reject |
| 5 | inline | `WEB_ORIGIN` comma list leaks into mail links | low | Pre-existing in every mail, out of scope | defer (noted) |

## Design Notes

Decision of 2026-10-18 (user): the invitee responds from the home list; the epic's "bandeau en tête de page" is not built because a pending invitee has no read access to the page, which would need a new role and restricted reads.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- green apart from the known date failure
- `docker compose exec web pnpm exec ng test --no-watch` -- green apart from the 2 known date failures; `ng build` compiles
- `graphify update .`

**Manual checks (if no CLI):**
- Mailpit: invite a known and an unknown address to an evening; Chrome MCP: accept from a second account, vote, host removes the guest.
