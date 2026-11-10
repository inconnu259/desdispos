---
title: '39.3 — Invite someone into a group'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '84a569a3d976a44ec8d1cdd1cd5833b02f4a47f8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-39-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group admin cannot bring friends in: the server refuses every invitation, link and removal for a ralliement, the « Missives » tab of a group is a read-only list, and the invitation e-mail and join page speak of a « partie » / « grimoire » (FR4, FR12, UX-DR18).

**Approach:** ⚠️ Admins of a group get the existing invitation machinery — by pseudo, by e-mail, by link, plus « Retirer » — in « Missives »; accepting or joining creates a `MEMBER` membership; the e-mail is a new neutral template « *Marc* vous invite à rejoindre « *Groupe* » ». A member only reads the list.

## Boundaries & Constraints

**Always:** Server: `RALLIEMENT_POLICY` gives `INVITATION_CREATE/READ/REVOKE`, `INVITE_LINK_CREATE/READ/REVOKE` and `PARTIE_MEMBER_REMOVE` to the admin only (member 403 admin-only message, stranger 403 no-access, pinned in the policy spec matrix and HTTP e2e). Removal by an admin targets plain members only: the creator, another admin and oneself are refused (409, French message) until 39.4/39.5 bring `leave()` — the owner/last-admin rules are not reinvented here. `accept()` and the link join/`consumeLink` set `role: 'MEMBER'` explicitly; « déjà membre » and « MJ » error texts become neutral wording for a ralliement. Realtime: after each accept/join (invite link, register-with-link included) `notifyPartieSignalsChanged` is called with the partie's `ownerId` (not the inviter: several admins), `emit` stays outside transactions; the members list of other members refreshes through the existing `partie:` SSE without reload. E-mail: new `'group-invitation'` in the closed `EmailTemplate` union (`email-template.enum.ts`), subject `{{inviterName}} vous invite à rejoindre « {{partieName}} »` (check quotes/apostrophes in Mailpit), neutral body (« … sur Dés Dispos, pour organiser vos rencontres entre amis. »), button « Rejoindre le groupe » (`ACTION_LABELS`); the by-e-mail path picks it for a ralliement, fetches the inviter's name (displayName/pseudo), JDR keeps `'invitation'` unchanged. Web: `isGroup` + `role === 'admin'` (a `canInviteMembers` computed) reuses the JDR « Missives » blocks (search by pseudo, e-mail field, links, « Retirer » with confirmation); a plain member keeps the read-only list; the invite-links load effect also runs for a group admin. New tone keys `partie.ralliement_*` for the group variant of those blocks (title, search, invite button, e-mail, links, remove confirm) in the three themes (identical order, three voices where words differ, neutral ones in `NEUTRAL_KEYS`, no banned JDR word, added to the page's banned-word sweep). Any screen an invitee sees for a group invitation (join page and its title, received-invitation card) uses non-JDR wording, picked by `familyOf`. Comments and messages in French; JDR behaviour and tests unchanged.

**Never:** No « Nommer admin », « Quitter l'office/le groupe », `leave()` or last-admin logic (39.4/39.5); no one-shot invitation UI (epic 41; the family-wide policy cell is accepted, the UI is gated to groups); no closed-group guard; no characters at join. No dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Invite by pseudo | admin picks a user | PENDING invitation; invitee accepts → `MEMBER`; other members see them without reload | member 403, stranger 403 |
| Invite by e-mail | admin, unknown or known address | `group-invitation` e-mail with inviter name, button « Rejoindre le groupe » | send failure never fails the call |
| Invite link | admin creates; invitee joins | `MEMBER` membership; refreshed lists | expired/exhausted link refused as today |
| Already a member | creator or member re-joins | 409 neutral wording (no « MJ ») | — |
| Remove | admin removes a member | membership gone, lists refresh | creator / admin / self → 409 |
| JDR | any JDR party | invitations, e-mail, tests unchanged | — |

</frozen-after-approval>

## Code Map

- API: `invitations/invitations.service.ts` (`invite` :~60, `accept` :83 membership upsert :88, `notifyPartieSignalsChanged(…, inv.inviterId)` :106, `revoke`, `inviteByEmail` :141, `sendMail('invitation', …)` :162); `invitations/invite-links.service.ts` (`join` :88, `consumeLink` :107 « MJ » message :119-121, `tx.membership.create` :138, `findOrCreateForEmail` :147); `auth/auth.service.ts` :89-96 (register via link: emits `partieTopic` only); `parties/parties.service.ts` `removeMember` :415 (unconditional `deleteMany`), `notifyPartieSignalsChanged` :971; `permissions/permission.service.ts` `RALLIEMENT_POLICY` :205-273 (invitations/links/`PARTIE_MEMBER_REMOVE` NOBODY), `ADMIN_ONLY` :111.
- E-mail: `email/email-template.enum.ts`, `email/email.service.ts` (`SUBJECTS`, `ACTION_LABELS`), `email/templates/*.hbs`, `email.integration.spec.ts` table.
- Web: `features/parties/partie-detail/partie-detail.{html,ts}` JDR Missives block html :406-483 (gated `isMj()`), read-only group block :485-504, handlers ts :740-830, `loadLinks` effect :428; `core/parties/parties.service.ts` :134-194 (already family-agnostic); `features/join/join.{ts,html}` and `core/join/join.service.ts` (preview has `gameSystemId`); dashboard received-invitation card (`dashboard.html` :1-20); tones `core/theme/tones/*.ts`, `theme-tone.service.spec.ts` (`NEUTRAL_KEYS`, banned words).
- Tests to move/extend: `test/characterization/ralliement.e2e-spec.ts` « capacités de JDR absentes » probes (:388-399, :427 — invitations, links, member removal; the policy is family-wide, so an admin is no longer refused: keep only the member/stranger refusals and drop these from the no-write snapshot) + new describe on a `CAMPAGNE_EPISODIQUE` group; `permission.service.spec.ts` :444-481 (`RALLIEMENT_ADMIN_ONLY` +7); `invitations.service.spec.ts`, `invite-links.service.spec.ts`, `partie-detail.spec.ts` :3444 (admin panel has no controls → now has), join/dashboard specs.

## Tasks & Acceptance

**Execution:**
- [x] `permission.service.ts` (+ spec) -- seven cells admin-only for ralliement.
- [x] `invitations.service.ts`, `invite-links.service.ts`, `auth.service.ts`, `parties.service.ts` (+ specs) -- explicit `MEMBER`, neutral errors, notify with `ownerId`, removal restricted to plain members, group e-mail path with inviter name.
- [x] `email-template.enum.ts`, `email.service.ts`, `group-invitation.hbs` (+ specs, integration row) -- new neutral e-mail.
- [x] `partie-detail.{html,ts}`, join page, dashboard invitation card, tones (+ specs) -- group Missives for admins, neutral invitee wording.
- [x] `ralliement.e2e-spec.ts` -- move invitation/link/removal probes; add the group invite flows and refusals.

**Acceptance Criteria:**
- Given a group, when its admin invites by pseudo, e-mail or link and the invitee accepts, then a `MEMBER` membership exists and the other members' lists update without reload.
- Given a plain member or a stranger, when they call an invitation, link or removal route, then they get a 403 covered by a test.
- Given the group e-mail, then its subject is « *Marc* vous invite à rejoindre « *Groupe* » » with the button « Rejoindre le groupe » and no JDR word.
- Given any JDR party, then invitations, e-mails and tests behave as before.

## Implementation Notes

- API: `RALLIEMENT_POLICY` gives the seven invitation/link/removal cells to the admin only (whole family; a ONE_SHOT admin can call them, pinned by an e2e test until epic 41). `accept()`/`consumeLink()` set `role: 'MEMBER'`, neutral « groupe » conflict texts, notify with the partie's `ownerId`; `AuthService.register()` now also notifies after the transaction (`AuthModule` imports `PartiesModule`). `removeMember` for a ralliement refuses the creator, another admin and oneself (409), 404 for a non-member. New `'group-invitation'` e-mail (neutral, inviter name, button « Rejoindre le groupe »), chosen by `inviteByEmail` for a ralliement. Two named exceptions added to `no-direct-owner-read.spec.ts` (invitations service, auth service: `ownerId` read to feed the notify call, not a right).
- Web: `canInviteMembers` (group + admin) shows the shared invite tools (search, e-mail, links, « Retirer ») in the group « Missives »; members keep the read-only list. New `partie.ralliement_*` and `join.ralliement_*` keys (3 voices), group wording on the join page and the received-invitation card; removal failures fall back to `partie.ralliement_remove_member_error` and reload the list.
- Not done: no pending-invitations list for a group admin, register screens still JDR-worded (see deferred work); nothing checked in a browser or Mailpit UI.
- Final run: api typecheck OK, unit 2266/2267 (1 known date failure), e2e 129/129; web 3234 pass / 2 known calendar-view date failures, build OK. Review: 16 findings, 3 patches, 4 deferred.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap, blind, edge | Invitation/link/removal cells are family-wide: a ONE_SHOT admin can call them by API while the UI hides them; the old refusal probes were deleted and nothing pins the new behaviour | medium | Accepted by the frozen intent (« family-wide policy cell is accepted »); but the contract is now unpinned | patch (pin it by an e2e test) |
| 2 | edge, blind | Group `removeMember` catch sets the notice to null for a non-string message (silent failure), stale 409 notice after a later success, no reload after a 404 | medium | New code in `partie-detail.ts`; real UX defect | patch |
| 3 | verif-gap | « notify after the transaction » for register-by-link asserted nowhere (call arguments only) | low | The title promises an ordering the test cannot see; cheap order assertion | patch |
| 4 | blind | `register()` can fail after the account exists if the notification throws | false | `notifyPartieSignalsChanged` → `emitMembersOnlySafe` catches and logs; it cannot throw | reject |
| 5 | blind, edge | « Retirer » shown on other admins, guaranteed 409; `PartieMemberDto` has no role | low | No second admin can exist before 39.4 (only the creator, who is hidden); 39.4 adds the role it needs | reject (noted in deferred work) |
| 6 | blind | Admin sees no pending-invitations list in a group | medium | Not in the spec's scope (search, e-mail, links, remove); link revoke does exist in the shared tools | defer |
| 7 | blind | No throttle / quota on invitation e-mails; free group name in the subject | medium | Same exposure already exists for JDR (any user can create a party and invite by e-mail); belongs to `/security-review` | defer |
| 8 | edge | Re-inviting by e-mail an address whose single-use link was already consumed gives a dead link | medium | `findOrCreateForEmail` is shared with JDR (pre-existing); removal makes it reachable in both | defer |
| 9 | edge, blind | Register/not-found screens reached from a group link still say « grimoire » | medium | The spec lists the join page and the invitation card; the register screens are a further hop | defer |
| 10 | blind | `notifyPartieSignalsChanged` takes `ownerId` from three callers; two exceptions added to `no-direct-owner-read.spec.ts`; only the owner is notified | low | The exceptions cover reads for a signal, not for a right; the notification already reaches every member (`membersOf`) — the « only owner » claim is false | reject |
| 11 | blind | `inviteTone`/`Join.text` build keys dynamically from a free string | low | Dev-only; keys are covered by the theme parity test | reject |
| 12 | edge | Concurrent promotion between the role read and `deleteMany` in `removeMember` | low | No promotion exists before 39.4 (which takes the party lock) | reject |
| 13 | edge | `Title` override in `Join` not reset / stale on theme change | low | Cosmetic, group links only | reject |
| 14 | blind, verif-gap | E-mail neutrality test is case-sensitive, whole-HTML; subject escaping test skipped without Mailpit; `'Un ami'` fallback untested | low | Pre-existing Mailpit pattern; the CI has Mailpit | reject |
| 15 | blind | Unrelated prettier reflows in three spec files; JDR specs edited (fixtures, `role: 'MEMBER'`) | low | Test-only noise; the JDR changes are the intended signature updates | reject |
| 16 | blind | Post-action notices, 409 through invite UI, admin2 link join, `maxUses`, e2e cleanup, explicit `role: 'MEMBER'` non-behavioural | low | Notices read « Missive envoyée à … » (no banned word); remaining items are cosmetic or covered elsewhere | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures.
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the 1 deferred date failure.

**Manual checks:** invite a second account to a group by pseudo, e-mail (Mailpit) and link; check the e-mail, the join page and the invitee's list in the three themes.
