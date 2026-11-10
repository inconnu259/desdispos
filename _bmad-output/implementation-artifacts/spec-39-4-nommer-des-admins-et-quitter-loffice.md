---
title: '39.4 — Appoint admins and step down from the office'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'a2253dfef3f16372ec68147beb880bdd7c5b7e08'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-39-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A group has exactly one admin forever: nobody can appoint another, nobody can hand the role back, « Retirer » is shown on admins the server always refuses, and the confirmation dialog has no red variant for the irreversible (FR5, UX-DR11, UX-DR12).

**Approach:** ⚠️ In the group « Missives », an admin gets « Nommer admin » on each plain member and « Quitter l'office » on their own row (also in the group footer); both go through a confirmation, the last-admin case announces the deletion of the group with a red button. The server changes roles under a `FOR UPDATE` lock on the partie. `ConfirmDialog` gains a red variant, also used by « Brûler ».

## Boundaries & Constraints

**Always:** Server: new action `PARTIE_MEMBER_ROLE_SET` (admin only for `ralliement`, nobody for `jdr`; matrix + policy spec + HTTP e2e: member 403 admin-only, stranger 403 no-access). `PATCH /parties/:id/members/:userId/role` body `{ role: 'ADMIN' | 'MEMBER', deleteIfLastAdmin?: boolean }`; only two moves exist: appoint another plain member (`ADMIN`), or the caller steps down (own `userId`, `MEMBER`); demoting someone else, appointing an admin or oneself → 409 French message; unknown member 404. The service refuses a `ONE_SHOT` (403 `RALLIEMENT_UNAVAILABLE_MESSAGE`, tested): the policy cell is family-wide, the kind check is in the service. One transaction: `SELECT … FROM "Partie" … FOR UPDATE`, re-read the roles, recount admins, then write. Stepping down as the **last** admin deletes the partie (members and later events via cascade) **only if** `deleteIfLastAdmin` is true; otherwise 409 « dernier administrateur » and nothing changes, so a stale screen can never delete a group. `ownerId` never changes. `removeMember` (ralliement) re-reads the target role inside the same locked transaction (closes 39.3 review finding 12); its refusals stay. After commit (never inside the transaction): `emit(partieTopic)` then `notifyPartieSignalsChanged` with `ownerId`; on deletion read the participants before and emit `userTopic` to each, like `remove()` (extract the shared tail, no duplicate). `PartieMemberDto` gains `role: MembershipRole` (all families, JDR always `MEMBER`). Web: `canAppointAdmin` (group + admin viewer + target `member`), « Retirer » hidden on any admin (the 409 special case in `removeMember()` goes); the Admin badge (shield glyph + the word « Admin », never colour alone) on each admin row of « Missives » only — decided with the user: a group page has no avatar rail, so the 14 px avatar-corner shield is carried by story 40.2 (participant chips), where `epics-palier10.md` is amended so it is not forgotten; confirmations « Nommer *Léa* … » (button « Nommer admin »), « Quitter l'office d'administrateur de « *groupe* » ? Vous restez membre du groupe. » (button « Quitter l'office ») and last-admin (members count, conjonctions count, advice to name another admin first, red « Quitter et supprimer »); `ConfirmData.destructive?: true` renders the confirm button red (`status-unavailable` fill, glyph + word), « Renoncer » unchanged; « Brûler » (`confirmDelete`) uses it. The viewer's admin count comes from `members()`; the request still sends `deleteIfLastAdmin` only from the last-admin dialog. After stepping down as non-last admin the page reloads the partie (role becomes `member`, admin tools disappear); after deletion it leaves to `/`. New tone keys `partie.ralliement_*` in three themes (identical order, banned JDR words swept, neutral ones in `NEUTRAL_KEYS`). Comments and messages in French; JDR behaviour and tests unchanged except the added `role` field.

**Never:** No `leave()`, « Quitter le groupe », voluntary departure or admin removal of admins (39.5); no account deletion; no group avatar rail and no avatar-corner badge here; no one-shot UI; no demotion of another admin; no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Appoint | admin A, plain member L | L becomes `ADMIN`; lists refresh without reload | member 403, stranger 403 |
| Step down, others remain | A, another admin exists | A becomes `MEMBER`, stays in the group | — |
| Step down, last admin | A alone, `deleteIfLastAdmin: true` | partie deleted, every member's list refreshes | flag missing → 409, nothing changes |
| Two admins step down at once | A and B only admins | exactly one stays admin or the group is deleted once; never zero admin without deletion | lock serialises; the second sees the recount |
| One-shot | `ONE_SHOT` ralliement | refused | 403 |
| Bad moves | demote other / appoint admin / appoint self | refused | 409 |

</frozen-after-approval>

## Code Map

- API: `permissions/permission.service.ts` (`JDR_POLICY` :120, `RALLIEMENT_POLICY` :206, `ADMIN_ONLY_MESSAGE`, `RALLIEMENT_UNAVAILABLE_MESSAGE`) + `permission.service.spec.ts` matrix; `packages/shared/src/index.ts` (`PermissionAction` :256, `PartieMemberDto` :517); `parties/parties.controller.ts` (`removeMember` :68, add `PATCH :id/members/:userId/role`) + new DTO in `parties/dto/`; `parties/parties.service.ts` (`listMembers` :403, `removeMember` :426, `remove` :746 emission tail, `notifyPartieSignalsChanged` :998; lock pattern `tx.$queryRaw … FOR UPDATE` as in `events/events.service.ts:163`).
- Web: `features/parties/confirm-dialog/confirm-dialog.ts` (inline template, `ConfirmData`); `partie-detail/partie-detail.{html,ts}` (group Missives :432-464, `canRemoveGroupMember` :238, `removeMember` :822, `confirmDelete` :892, admin footer :546-568, SSE refresh `refreshPartie`); `core/parties/parties.service.ts` (`removeMember` :152, add `setMemberRole`); tones `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` (`partie.ralliement_*` :376-383), `theme-tone.service.spec.ts` (`NEUTRAL_KEYS` :777, banned words).
- Tests to extend: `test/characterization/ralliement.e2e-spec.ts` (new group describe: appoint, step down, last admin, ONE_SHOT, refusals, concurrent step-downs), `parties.service.spec.ts`, `parties.controller` spec if any, `partie-detail.spec.ts`, a `confirm-dialog` spec, `no-direct-owner-read.spec.ts` untouched unless a new `ownerId` read appears.
- Keep: JDR `removeMember`/`remove` behaviour, `leave()` absent, 39.3 refusals of creator/self/admin in `removeMember`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts`, `permission.service.ts` (+ spec) -- `PARTIE_MEMBER_ROLE_SET` in the union and both policies; `role` on `PartieMemberDto` -- closed-union matrix
- [x] `parties.service.ts`, `parties.controller.ts`, new DTO (+ specs) -- locked role change, last-admin deletion with explicit flag, `removeMember` under the lock, shared emission tail
- [x] `ralliement.e2e-spec.ts` -- appoint / step down / last admin / one-shot / refusals / two simultaneous step-downs
- [x] `confirm-dialog.ts`, `partie-detail.{html,ts}`, `parties.service.ts` (web), tones (+ specs) -- red variant, Missives badge and actions, footer « Quitter l'office », « Brûler » red

**Acceptance Criteria:**
- Given a group with several admins, when one steps down, then they are a plain member and the others' lists update without reload.
- Given the last admin, when they confirm « Quitter et supprimer », then the group is gone for every member; without the flag the server refuses.
- Given a plain member or a stranger, when they call the role route, then 403, covered by a test.

## Implementation Notes

- API: `PARTIE_MEMBER_ROLE_SET` (admin only for `ralliement`, nobody for `jdr`); `PATCH /parties/:id/members/:userId/role` → `{ ok, deleted }`, `ONE_SHOT` refused in the service (403); locked transaction (`lockPartie`), roles re-read and admins recounted under the lock; last admin deletes the group only with `deleteIfLastAdmin` (409 `LAST_ADMIN_MESSAGE` otherwise); `removeMember` (group) re-reads caller and target role under the same lock; shared `emitPartieDeleted` tail also used by `remove()`; `PartieMemberDto.role` (JDR always `MEMBER`).
- Web: `ConfirmData.destructive` (red button + glyph + word, « Brûler » uses it); group Missives: Admin badge (shield + word), « Nommer admin », « Quitter l'office » on own row and in the footer (between Clore and Brûler); `stepDownFromOffice` re-reads members before choosing the dialog; the group notice is shown outside the Missives tab so a footer refusal stays visible; `conjonctionCount` is a placeholder 0 (epic 40.1 criterion added). Neutral wording « administrateur » + « Cette personne » (no gender data); the forêt theme tutoies (« Tu restes membre »).
- Epics: story 40.2 carries the 14 px avatar-corner shield (decided with the user: no rail in a group); 40.1 carries the true conjonction count.
- Not done: no live check in a browser (red button, badge, three themes).
- Final run: api typecheck OK, unit 769/770 in parties+permissions (1 known date failure), e2e `ralliement` 54/54; web 3266 pass / 2 known `calendar-view` date failures, build OK. Review: 19 findings, 4 patched, 4 deferred.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | blind | Unrelated Prettier reflow of `partie-detail.html` buries the real hunks | low | Real: ~570 changed lines for ~40 functional ones | patch (baseline restored, functional hunks re-applied) |
| 2 | blind, edge, gap | `conjonctionCount` hard-coded 0 understates the deletion | medium | Known placeholder (no conjonction exists before epic 40) but nothing flagged it | defer (epic 40.1 criterion + deferred work) |
| 3 | blind | « Nommer admin » text omits that an admin can also close, edit, burn | medium | Wording is the validated UX contract | defer (user's call) |
| 4 | blind | Footer « Quitter l'office » refusal shown nowhere outside Missives | medium | `notice()` rendered only in the Missives tab | patch (group notice moved above the footer, test added) |
| 5 | blind, edge | Stale `members()` makes the wrong dialog / sends the flag with an empty list | medium | `adminCount` read from a possibly empty or old list | patch (members re-read before choosing; test added) |
| 6 | blind, edge | Owner without a Membership row refused in `setMemberRole` / `removeMember` | false | Creation always inserts the creator's `ADMIN` row; case unreachable | reject |
| 7 | blind, edge | Post-commit notify can throw → 500 after a committed write | false | `notifyPartieSignalsChanged` → `emitMembersOnlySafe` catches and logs | reject |
| 8 | blind | Repeated row buttons lack member-specific accessible names; red button contrast unchecked | medium | Real, needs new tone keys and a theme-wide contrast pass | defer |
| 9 | blind, gap | Missing tests: appoint vs step-down race, footer hidden for ONE_SHOT, emission assertions | low | Lock proven by the two simultaneous step-downs; the rest is extra coverage | reject |
| 10 | blind | `destructive?: true` typed as literal | low | Exactly what the spec says | reject |
| 11 | blind | No SSE wiring evidence for the role change | false | Page already reloads partie and members on any `partie:` event; user topics notified | reject |
| 12 | blind | Badge is a Missives pill, not the avatar-corner shield | false | Decided with the user, deferred to 40.2 in the epics | reject |
| 13 | gap | In-row « Nommer admin » / « Quitter l'office » buttons never clicked in tests | medium | Only direct method calls and label text were asserted | patch (two DOM-click tests) |
| 14 | edge | `refreshAll()` rejecting after `deleted: true` shows a role error | low | Rare; small guard | patch (try/catch around the refresh) |
| 15 | edge | 409 last-admin on a stale screen offers no way forward | low | The members re-read (row 5) removes the window; the server stays safe | reject |
| 16 | edge | `calendar-view.spec.ts` member literals lack `role` | false | The spec types `members` as `unknown[]` | reject |
| 17 | edge | Appoint allowed on a closed (`TERMINEE`) group | low | No rule in the intent either way | reject |
| 18 | edge | Spec says the 409 special case in web `removeMember()` « goes » but a generic refusal handler remains | low | Handler kept for stale screens, wording only changed; existing tests cover it | reject |
| 19 | edge | `removeMember` gained a new in-transaction 403 for a caller without ADMIN row | low | Same unreachable case as row 6; a demoted caller is correctly refused | reject |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck`, `pnpm test`, `pnpm test:e2e` -- expected: green except the known date failure.
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures.

**Manual checks:** two accounts in a group: appoint, step down, last-admin dialog (red button) in the three themes; « Brûler » red.
