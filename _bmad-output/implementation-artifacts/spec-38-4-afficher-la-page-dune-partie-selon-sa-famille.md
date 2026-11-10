---
title: '38.4 — Show the partie page according to its family'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'ddf2317b7b134379910f891e8b89e8b2410a9075'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-38-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After 38.2 a ralliement opens on the JDR page with its sections skipped: one « Détails » tab still carrying the JDR scheduling widget ("séance", guild calendar, next-session badge), JDR wording in tone strings, and a header subtitle whose prefix is not themed (FR15, UX-DR17, AD-1).

**Approach:** ⚠️ The page deduces its tabs from `family` + `kind` (registry): JDR keeps its five tabs untouched; a ralliement shows only « Détails » (description only) and « Missives » (read-only member list for admin and member). No section or action of an absent capability appears. Outside JDR no screen text uses « MJ », « campagne », « scénario », « séance » or « joueur », whatever the theme. The header subtitle names the ralliement type; the create/edit titles stop saying « quête ». The server's refusals for a ralliement are pinned over HTTP.

## Boundaries & Constraints

**Always:** JDR page, tabs, wording and tests unchanged. « Missives » is the existing invitations tab (`partie.invitations_tab_label`: Missives / Appels / Télégrammes) and « Détails » is `parties.detail_tab_details`; ralliement indices stay Détails 0, Missives 1 (the existing `MJ_INVITATIONS_TAB_INDEX = 1` keeps working). « Missives » for a ralliement: member list from `GET /parties/:id/members` (creator listed once, using `members()` not `otherMembers()`), heading `partie.members_title`, **no** « Retirer », search, invitation or link UI, no role badge (`PartieMemberDto` has no role yet; epic 39). « Détails » for a ralliement: description card (and cover banner as today); the scheduling widget (`partie.scheduling_title`, `partie.no_session`, next-session badge, `cta.guild_calendar`, `poll.vote_pending`) is not rendered; the admin keeps the footer « Edit » link, a member sees none. Tabs, subtitle and wording derive from the registry/`familyOf` (`isRalliement()` already exists from 38.2), never from hard-coded system ids. Header subtitle for a ralliement: `${tone['partie.mode_ralliement']} · ${tone['partie.ralliement_kind_<KIND>']}` (themed prefix: Ralliement / Veillée / Rassemblement; Grimoire gives « Ralliement · La convergence des Sortilèges »). New tone keys, in the three theme files in identical order with three distinct voices (tutoiement in Forêt, vouvoiement elsewhere; respect parity, `NEUTRAL_KEYS` and vocabulary tests): `partie.ralliement_new_title` (Nouveau ralliement / Nouvelle veillée / Nouveau rassemblement), `partie.ralliement_edit_title` (Modifier le ralliement / Modifier la veillée / Modifier le rassemblement — adjust to voice), a ralliement variant of every tone string reachable on a ralliement page that currently carries JDR or quest wording (at least `partie.no_description`, `identity.homonymy_warning` on the members list); `PartieForm` sets its contextual title reactively on the mode toggle (new title) and on a ralliement edit (edit title). Server (AD-1): add HTTP tests (admin / member / stranger) to `ralliement.e2e-spec.ts` proving refusal of xp-distributions, homme-dragon, announcements, visibility-locks, characters, invitations and invite links, polls, available-slots/heatmap, member removal, and member cover upload; no server code change expected — if a route is found reachable that should be refused, fix it. Comments in French.

**Never:** No tab content beyond the above (no conjunctions, no event cards, no admin badge/nomination/leave — epics 39–41), no members search/invite UI, no change to roster rail/strip for JDR, no change to scenarios/characters code paths, no role-label words (UX §3.4 working words are not validated), no list-tile/filter work (38.5), no dependency install.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ralliement, admin | open a ralliement page | tabs Détails + Missives; footer Edit link | — |
| Ralliement, member | same, as member | same tabs, member list read-only, no Edit link | — |
| Forbidden words | ralliement DOM in each theme | none of « MJ », « campagne », « scénario », « séance », « joueur » (any case) | — |
| Subtitle | each theme | `Ralliement/Veillée/Rassemblement · <type>` | — |
| JDR page | any JDR partie | identical to before | — |
| Create/edit title | toggle to ralliement; edit a ralliement | title follows the mode with the ralliement keys | — |
| Direct API | member/admin hits an absent-capability route | refused (403/400) as pinned | no write |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.{html,ts}` -- tabs are `@if` blocks: Détails (always), Fiches `!isMj() && !isRalliement()`, Missives `isMj()` (html L376-453), Homme Dragon literal (ryuutama), Scénario(s) `isMj()`, Chronologie `kind!=='ONE_SHOT' && !isRalliement()`; `isRalliement()` ts L210, `isMj` excludes ralliement ts L216, `MJ_INVITATIONS_TAB_INDEX` ts L83, `defaultTabIndex` ts L333, subtitle effect ts L405-417, ralliement guard in `ngOnInit` ts L702-725, `members()`/`otherMembers()` ts L273, footer html L533, scheduling widget in the Détails « Action » zone.
- `apps/web/src/app/features/parties/partie-form/partie-form.ts` L256-258 (`contextualNav.title` set once in `ngOnInit`), L277 (edit), `mode()` / `isRalliement` computed (~L156).
- Tones: `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` (section "formulaire de partie : mode ralliement (Story 38.2)" for placement; existing keys `partie.mode_ralliement`, `partie.ralliement_kind_ONE_SHOT|CAMPAGNE_EPISODIQUE`, `partie.invitations_tab_label`, `parties.detail_tab_details`, `partie.members_title`); `core/theme/theme-tone.service.spec.ts` (parity ~L62, `NEUTRAL_KEYS` L776, voice tests, 38.2 key block ~L1177).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- helpers `createFixture(partie, userId, options)`, `makePartie`, tone mock `makeToneService` (Grimoire only → parameterise by theme); describe "ralliement, garde minimale" L3200-3316 (icon-bar hrefs exactly `['/parties/party-1/edit']`); JDR guards L1406, L1975-2097.
- `apps/api/test/characterization/ralliement.e2e-spec.ts` L202 -- extend with the AD-1 HTTP refusals; policy table `permissions/permission.service.ts` (`RALLIEMENT_POLICY`) already refuses all but READ / MEMBERS_READ / COVER_READ (admin+member) and UPDATE / COVER_UPDATE (admin).

## Tasks & Acceptance

**Execution:**
- [x] Tone keys (3 files + spec) -- new titles and ralliement wording variants.
- [x] `partie-detail.{html,ts}` -- ralliement tab set, Missives member list (read-only), Détails description only, themed subtitle; JDR untouched.
- [x] `partie-form.ts` -- reactive ralliement titles.
- [x] `partie-detail.spec.ts`, `partie-form.spec.ts` -- tabs for admin and member, no scheduling widget, members listed once with no management UI, subtitle in the three themes (theme-parametrised tone mock), banned-word sweep of the ralliement DOM per theme, JDR page unchanged, title follows the mode.
- [x] `ralliement.e2e-spec.ts` -- HTTP refusals listed in Always.

**Acceptance Criteria:**
- Given a ralliement page for an admin or a member, then exactly two tabs « Détails » and « Missives » render, the scheduling widget does not, and the member list shows the creator once without any management control.
- Given any theme, then the ralliement page DOM contains none of the five banned words.
- Given a JDR page, then its tests and tabs are unchanged.

## Implementation Notes

- Tone keys (3 files, identical order, 3 voices): `partie.ralliement_new_title` (Nouveau ralliement / Nouvelle veillée / Nouveau rassemblement), `partie.ralliement_edit_title` (Retranscrire le ralliement / Rebattre la veillée / Recalibrer le rassemblement — mirrors the existing quest `partie.edit_title` verbs), `partie.ralliement_no_description`, `identity.ralliement_homonymy_warning`, `partie.ralliement_status_closed_label` (added beyond the spec; unreachable until a ralliement can be closed).
- `partie-detail`: ralliement = tabs « Détails » (description card only) + « Missives » (`members()`, heading `partie.members_title`, no management UI); the Action/Consultation zones are wrapped in `@if (!isRalliement())`; subtitle `${mode_ralliement} · ${ralliement_kind_<KIND>}`. JDR page untouched (Ryuutama control test).
- `partie-form`: contextual title set by an `effect` that follows the mode toggle and the family on edit. Side effect: after a created partie whose cover upload failed, the form switches to edit mode and the title becomes the edit title.
- `ralliement.e2e-spec.ts`: admin/member/stranger refused on xp-distributions, homme-dragon, announcements, visibility-locks, characters, invitations/by-email, invite-links, poll (all verbs), available-slots/heatmap, member removal, cover for a member; no server change needed.
- Not checked in the live app (a ralliement would have to be created in the dev DB): left to the user (create one from the header button and open it).
- Review patches: homonym disambiguation tested in the Missives list; shared `NON_JDR_BANNED_WORDS` (now incl. « quête ») used by the page and tone specs, also scanning the shared tone strings the page renders; ralliement edit title not set until the partie is loaded; `partie.ralliement_save_error` / `partie.ralliement_created_but_cover_failed` variants; AD-1 e2e probes extended (scenarios, seance routes, character-roles, assets), positive 200 control, self-contained no-write test. Re-run: web 2 known calendar-view date failures only, web build OK, api typecheck OK, e2e 110/110.
- Orchestrator run before review patches: web 3152 pass / 2 known calendar-view date failures, web build OK, api typecheck OK, e2e 109/109.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verif-gap | Homonym disambiguation in the Missives member list untested | medium | Fixture has distinct display names; deleting `[ambiguous]` passes | patch |
| 2 | blind, verif-gap | Page-level banned-word sweep omits « quête » and shared keys | medium | Tone spec bans it, page spec does not; shared keys unscanned | patch |
| 3 | blind, edge | Ralliement edit title flashes the quest wording until the partie loads | medium | `isRalliement()` false before load | patch |
| 4 | edge | `save_error` / `created_but_cover_failed` carry quest wording on ralliement screens | low | « Cette mission… » / « Ce sentier… » | patch |
| 5 | blind, edge | AD-1 probe list omits scenarios, character-roles, seance routes; no positive 200 control; "aucune écriture" test order-dependent | medium | e2e review | patch |
| 6 | blind | Closed-state wording variant unreachable | low | Policy refuses close/reopen; kept until epic 42 (cancellation) | reject |
| 7 | blind | « Missives » reuses the invitations label/classes; no empty state or admin marker | low | Label mandated by the story; admin marker is epic 39 | reject |
| 8 | blind | Realtime refresh of `members()` not evaluated | low | Members change only with epic 39 flows | reject |
| 9 | blind | Référence zone contents unverified | low | Only the description card remains in Détails | reject |
| 10 | blind | Register/gender inconsistencies, template indentation, `?? p.kind` fallback | low | Cosmetic | reject |

## Verification

**Commands:**
- `docker compose exec web pnpm test` / `pnpm build` -- expected: green except the 2 known `calendar-view` date failures; build OK.
- `docker compose exec api pnpm test:e2e` / `pnpm typecheck` -- expected: green.

**Manual checks:** none against the live app — a ralliement must exist in the dev DB and the agent does not create data there; the page is verified by unit tests. Visual check left to the user (create a ralliement from the header button and open it).
