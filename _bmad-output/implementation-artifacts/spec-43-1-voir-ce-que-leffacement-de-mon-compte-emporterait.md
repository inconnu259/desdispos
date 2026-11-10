---
title: '43.1 — See what erasing my account would take away'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'cedf8b3c32d5f564934fcc28c34041e0481aac68'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-43-context.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no way to erase an account, and nothing tells a user what leaving would destroy: groups where they are the only admin, and JDR parties they run (FR7).

**Approach:** A "Zone sensible" section on the Account page opens a red confirmation dialog listing what would disappear, fed by a read-only `GET /me/deletion-impact`. The deletion itself (`DELETE /me`) is story 43.2.

## Boundaries & Constraints

**Always:** `GET /me/deletion-impact` on `AccountController`, no parameter, reads only the connected user, writes nothing. Reads are batched (no per-party query loop). Groups = ralliement parties (isolated evenings included, AD-11) where the user's `Membership.role` is ADMIN and no other ADMIN exists; each gives `{ id, name, memberCount, eventCount }` (all memberships; all events). JDR = parties of family `jdr` with `ownerId` = user; each gives `{ id, name, playerCount }`, `playerCount` = distinct users other than the owner holding a `Character` there. Groups keeping another admin and parties where the user is a mere member are absent. The preview is fetched on each dialog opening. Dialog = `ConfirmDialog` look ("Votre accord", "Renoncer", solid red button with icon + word, `--color-unavailable`); lists with no entry are omitted; section and dialog texts live in the three theme tones, French, with fixed texts identical across themes. Danger zone below the logout row: rule, label "Zone sensible", one sentence at 13 px, red-outlined pill "Effacer mon compte" with an 18 px trash icon.

**Never:** No `DELETE /me`, no deletion of anything, no `LeaveCause` change (all story 43.2). No schema change, no new dependency. No admin-appointing shortcut inside the dialog. No change to the logout button.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sole admin | admin of a group, no other ADMIN | group listed with member and event counts | — |
| Shared admin | another ADMIN exists | group not listed | — |
| Isolated evening | creator of a rencontre isolée | listed (1 event) | — |
| GM | owns a quest, 2 players with characters | quest listed, `playerCount` 2 | — |
| Plain member | member of groups and quests | both lists empty | dialog omits both lists |
| Nothing owned | no group, no quest | `{ groups: [], jdrParties: [] }` | dialog still opens |
| Anonymous | no session | — | 401 |
| Other accounts | another user's data | never returned | — |
| Recompute | user names another admin, reopens dialog | group gone from the list | — |
| Fetch fails | network or 5xx | no dialog opens | inline French error under the pill |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` -- add `AccountDeletionImpactDto` (+ group / JDR item types); `familyOf`, `GAME_SYSTEMS` already exported (runtime values, never `import type`).
- `apps/api/src/account/account.service.ts` -- add `getDeletionImpact(userId)`; derive ralliement ids from `GAME_SYSTEMS` like `notifications.service.ts:25` (`RALLIEMENT_SYSTEM_IDS`), jdr ids the same way; `groupBy` for member, admin and event counts, one `character.findMany({ distinct })`.
- `apps/api/src/account/account.controller.ts` -- `@Get('deletion-impact')`, user from `req.user`; guard already class-level.
- `apps/api/src/account/account.{service,controller}.spec.ts` -- unit tests (mock Prisma / service, like existing specs; controller spec already mocks `@master-jdr/game-rules`).
- `apps/api/test/characterization/harness.ts` -- e2e harness (data created through HTTP routes, `Membership` written directly); add `apps/api/test/account-deletion-impact.e2e-spec.ts` with it.
- `apps/web/src/app/core/account/account.service.ts` -- add `getDeletionImpact()`.
- `apps/web/src/app/features/account/account.{ts,html,scss}` -- danger zone under `.logout-row`; opens the dialog through `MatDialog`; `account.spec.ts` holds the tone mock to extend.
- `apps/web/src/app/features/account/delete-account-dialog/` -- new standalone dialog; copy the red-button style of `parties/confirm-dialog/confirm-dialog.ts` (`.confirm-destructive`), do not modify `ConfirmDialog`.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,atelier-cuivre,foret-ancienne}.ts` -- new `account.danger_*` / `account.delete_*` keys in all three (a spec enforces identical key sets); plurals via `_one` keys + `fillTone` (`tone-format.ts`).
- Do not touch `PartiesService.leave()`, `AuthService`, Prisma schema.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- add the impact DTO -- shared contract
- [x] `apps/api/src/account/account.service.ts` + `account.controller.ts` -- implement the read route -- AC data
- [x] `apps/api/src/account/*.spec.ts` + `apps/api/test/account-deletion-impact.e2e-spec.ts` -- matrix rows incl. isolation between accounts and 401 -- NFR3
- [x] `apps/web/src/app/core/account/account.service.ts` -- client call
- [x] `apps/web/src/app/features/account/delete-account-dialog/*` -- dialog + spec (lists omitted when empty, plurals, password field, red button)
- [x] `apps/web/src/app/features/account/account.{ts,html,scss}` + `account.spec.ts` -- danger zone, fetch on click, error line
- [x] three tone files -- all texts; `docs/checklist.md` real-time item answered in Implementation Notes

**Acceptance Criteria:**
- Given any logged-in user, when they open the Account page, then "Zone sensible" appears below "Fermer le grimoire" with the red-outlined pill and an 18 px trash icon.
- Given the pill clicked, when the preview loads, then the dialog shows the pseudo, the non-empty lists, the irreversibility sentence, a password field and a red "Effacer mon compte" button; "Renoncer" closes it with no request beyond the GET.
- Given a group with a second admin, when the dialog opens, then that group is absent.

## Implementation Notes

- Matrix row "Anonymous → 401": the repo-wide `AuthenticatedGuard` answers 403 without a session on every guarded route; the e2e asserts 403. The guard was not changed (out of scope, would alter every route). Flag to the user.
- Real-time (`docs/checklist.md`): none needed, the preview is recomputed at each dialog opening and nothing is pushed to other users.
- Tone keys: fixed contract texts (`account.delete_*`, `account.danger_title`) are identical in the three themes and added to `NEUTRAL_KEYS`; `account.delete_*` is excluded from the tutoiement/vouvoiement check (contract texts stay vouvoyés); `danger_explain` and `danger_load_error` follow each theme's register.
- Verification: api typecheck clean; api unit 2785 pass, 1 known date-dependent failure (`parties.service.spec` UNAVAILABLE slot); api e2e 360 pass (7 new); web 3627 pass, 2 known date-dependent failures (`calendar-view.spec`). Not done: visual check in Chrome (3 themes, contrast), `/security-review`, `/code-review`.

- The e2e file lives at `apps/api/test/characterization/account-deletion-impact.e2e-spec.ts` (next to its harness), not `apps/api/test/`.

## Review Triage Log

Inline self-review (no reviewer subagents launched: not requested by the user). No finding routed to patch, bad_spec or intent_gap.

| Finding | Verdict | Evidence |
|---------|---------|----------|
| Event count includes cancelled events | low | The group is deleted whole, so every event is lost; counting all is truthful. Kept. |
| Unauthenticated answers 403, matrix says 401 | low | Repo-wide `AuthenticatedGuard` behaviour on every route; wording of the matrix, not a defect of this change. Flagged to user. |
| Red confirm button is disabled | false | Intended (Design Notes): deletion is story 43.2. |
| Visual check (3 themes, contrast) not done | maybe-false | Claude in Chrome was not connected; to do before merge. |

## Design Notes

- Real-time: the preview is computed on every opening, so no SSE wiring is needed; record this against `docs/checklist.md`.
- In 43.1 the red button exists but is `disabled` (the deletion arrives in 43.2, which enables it and sends the password); a live button that does nothing would be worse than an inert one. Flag this to the user at review.
- ⚠️ UX-DR13 / UX-DR12 are validated contracts: fixed texts follow EXPERIENCE.md #1 verbatim; section wording around them is new and must be flagged ⚠️ in the PR notes.

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: no errors
- `docker compose exec api pnpm test` and `pnpm test:e2e` -- expected: green, characterization tests unchanged
- `docker compose exec web pnpm test` -- expected: green apart from the 2 known date-dependent failures

**Manual checks (if no CLI):**
- Chrome: Account page in each of the 3 themes: section, pill, dialog, "Renoncer"; red meets contrast.
