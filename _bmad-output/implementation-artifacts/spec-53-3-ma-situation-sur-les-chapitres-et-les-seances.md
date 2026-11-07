---
title: '53.3 — "Ma situation" on chapters and sessions'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'd205cd2225c926e503e986a14f7d55ee2f11c828'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 53.1 the session badge no longer carries the vote call ("Réponds au vote"), and no JDR surface shows the viewer's situation except the Détails widget: Chronologie, the GM's Chapitres tab and the scenario sheet lost the call to action.

**Approach:** Render a plain "Ma situation" row (label left, `<app-situation-pill>` right) on each session of the Chronologie, on each chapter row of the GM's Chapitres tab (next session), and under the session header of the scenario sheet, all computed by `seanceSituation` / `nextSeanceOf` from 53.1. Web only; no API change.

## Boundaries & Constraints

**Always:** Value = `seanceSituation(seance, currentUserId, isMj, todayKey)` with the single `todayKey` of each screen; `null` → row not rendered. Row is plain text, no interactive element, read with its session, wraps without horizontal overflow (Chronologie is vertical under 768 px). Label `situation.ma_situation` (tone key from 53.2), no new key. The GM sees "Je mène" on every session, drafts included; player-side draft masking in `buildNodes` stays untouched (no pill betrays a draft). A Chronologie chapter card gets no row of its own (its sessions carry theirs). On the Chapitres tab: `nextSeanceOf` then `seanceSituation` with `isMj` true — "Je mène" when the chapter has an upcoming session, no row otherwise; row click/keyboard opening the chapter and "Ouvrir aux joueurs" unchanged. In `seance-list` the row sits directly under the session header (title, state badge, delete) — the epic 54 position — shared by `scenario-editor`, `scenario-read-dialog` and the single-quest Chapter tab. No `<mat-icon>`, no new token. Realtime: no new channel; the surfaces already re-read on `ScenariosService.changed()` (`partie:` prefix); check that answering a vote, enrolling, unenrolling, sealing and closing a poll each emit `partie:{id}` on the API and record the evaluation (`docs/checklist.md`) in Implementation Notes.

**Never:** Touch the Agenda badge, the dashboard signals, the state badge logic, `seanceSituation` / `nextSeanceOf`, or the event card/dialog. Do not add the epic 54 summary or panel.

## I/O & Edge-Case Matrix

| Scenario | State | Row |
|---|---|---|
| Player, open poll, unanswered / answered | Chronologie or sheet | "Vote à faire" / "J’ai voté" |
| Player, dated session, enrolled / not / past | — | "Je participe" or "J’y étais" / "Pas inscrit·e" / none if not enrolled and past |
| Player, undated session without vote, or closed poll unanswered | — | no row, badge only |
| GM, any session (draft included) | Chronologie or sheet | "Je mène" |
| GM, chapter with an upcoming session / none | Chapitres tab | "Je mène" / no row |
| Another member answers, enrolls, or a date is fixed | `changed()` fires | pill updates without reload |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/shared/situation-line/` (new) -- standalone `<app-situation-line [value]>` rendering label + pill, nothing when `null`; reused by the three surfaces so the markup lives once (pattern of `shared/situation-pill/`).
- `apps/web/src/app/features/scenarios/scenario-timeline/scenario-timeline.{ts,html,scss}` (html l.28–35, scss `.card-seances__row` l.121; `currentUserId` l.262 kept for this story, `todayKey`, `isMj`) -- add `seanceSituation(seance)` helper; row becomes two lines (label + badge, then situation).
- `apps/web/src/app/features/scenarios/scenario-list/scenario-list.{ts,html,scss}` (`scenario-row` html l.24–39, scss l.41) -- inject `AuthService`, add `todayKey` and a chapter helper (`nextSeanceOf` + `seanceSituation`, `isMj` true); the row keeps its flex layout and wraps the situation line under it.
- `apps/web/src/app/features/scenarios/seance-list/seance-list.{ts,html}` (header html l.7–22; `currentUserId` l.77, `isMj`, `todayKey` l.205) -- row directly after `seance-row__header`.
- `apps/web/src/app/core/status/status-derivation.ts` -- read only (`seanceSituation`, `nextSeanceOf`).
- Specs: `scenario-timeline.spec.ts`, `scenario-list.spec.ts`, `seance-list.spec.ts` (see Tasks); old "Vote en cours" badge assertions stay valid.
- API (read only, for the realtime check): `apps/api/src/poll/poll.service.ts` (castVote, withdrawVote, choose, close), `apps/api/src/scenarios/scenarios.service.ts` (`inscrire`/`desinscrire` emit through `EventsService`).
- `apps/web/src/app/features/scenarios/scenario-read-dialog/scenario-read-dialog.{html,ts,spec.ts}` (html l.138-144 hard-codes `[isMj]="false"` on `app-seance-list` to keep MJ controls hidden; `isMj` computed l.77 from `data.isMj`) -- loop 1: the GM reaches this dialog for PASSE chapters and must read "Je mène" there too.

## Tasks & Acceptance

**Execution:**
- [x] `shared/situation-line/*` -- component and spec (renders label + pill; nothing for `null`)
- [x] `scenario-timeline.*` + spec -- row per session; player cases "Vote à faire", "J’ai voté", "Je participe", "Pas inscrit·e", "J’y étais", no row for undated/no-vote and closed-unanswered; GM "Je mène" (draft included); update after a `changed()` that brings an answer
- [x] `scenario-list.*` + spec -- chapter row; "Je mène" for an upcoming session, none without; click still opens the chapter
- [x] `seance-list.*` + spec -- row under the header, player and GM sides
- [x] Assert that none of the three templates renders "Réponds au vote"; verify and note the five API emissions
- [x] Loop 1 (review finding, bad_spec): `seance-list.ts` -- new optional input `situationIsMj` (defaults to `isMj()`) used only for the situation row; `scenario-read-dialog.html` -- bind `[situationIsMj]="isMj()"` while keeping `[isMj]="false"` (MJ controls stay hidden); tests: read dialog with `isMj: true` on a PASSE chapter → "Je mène", player → player pill; `seance-list.spec.ts` for the input
- [x] Loop 1 (review finding, patch): `scenario-list.scss` -- `.scenario-row__title` gets `flex: 1 1 0` so `flex-wrap` only ever wraps the situation line and rows without one behave as before

**Acceptance Criteria:**
- Given a player whose next Chronologie session has an open unanswered poll, when they vote in the Destinée and return, then the row shows "J’ai voté" (Hugo's route)
- Given a chapter card in the Chronologie, when it renders, then it has no row of its own and each of its sessions has its own
- Given the three surfaces, when rendered at phone and desktop width, then the row stays text-only and wraps without horizontal overflow
- Given web Vitest suites and `tsc`, when run, then all pass (bar the two known date-frozen `calendar-view` tests)

## Implementation Notes

- `shared/situation-line/` (`<app-situation-line [value]>`) rend `<p class="situation-line">` (libellé `situation.ma_situation` + `<app-situation-pill>`), rien pour `null`. Texte seul, `flex-wrap`, aucun token ni clé nouvelle.
- Chronologie : `<li class="card-seances__row">` devient une colonne (`.card-seances__line` = libellé + badge d'état, puis la ligne). Helper `seanceSituation(seance)` = `seanceSituation(seance, currentUserId(), isMj(), todayKey)`. `buildNodes` intact : un brouillon n'est jamais rendu côté joueur, donc aucune pastille ne le trahit. La carte de chapitre n'a pas de ligne propre.
- Chapitres (`scenario-list`) : `AuthService` injecté, `todayKey` figé, `chapterSituation(scenario)` = `nextSeanceOf` puis `seanceSituation(next, userId, true, todayKey)` ; la ligne `li.scenario-row` passe en `flex-wrap`, la ligne de situation prend `flex: 1 0 100%` sous le titre/badge/bouton. Clic/clavier de la ligne et « Ouvrir aux joueurs » inchangés.
- Fiche (`seance-list`) : `<app-situation-line>` directement après `.seance-row__header`, commun aux branches ; partagé par `scenario-editor`, `scenario-read-dialog` et l'onglet Chapitre d'une quête unique.
- Évaluation temps réel (`docs/checklist.md`) : aucun canal nouveau. Les trois surfaces relisent déjà sur `ScenariosService.changed()` filtré par préfixe `partie:` (`scenario-timeline` via `matchesPartie`, `scenario-list` idem, `seance-list` via `refreshScenario`). Émissions `partie:{id}` vérifiées côté API : répondre à un vote `PollService.castVote` (l.357) et `withdrawVote` (l.445) ; s'inscrire / se désinscrire `EventsService.inscrire` (l.1558) / `desinscrire` (l.1575), appelés par `ScenariosService.inscrire`/`desinscrire` ; sceller `PollService.choose` (l.500, et `chooseGroupDate` l.544 pour un groupe) ; clore un vote `PollService.close` (l.683). Rien à ajouter.
- Test de chaque gabarit : aucun ne rend « Réponds au vote » (assertion dans les trois specs).
- `tsc --noEmit -p tsconfig.spec.json` : seules les erreurs TS6059 (rootDir de `packages/game-rules`) déjà présentes sont listées, aucune nouvelle.
- Boucle 1 : `SeanceList` gagne l'entrée optionnelle `situationIsMj` (défaut `isMj()`), utilisée uniquement par la ligne « Ma situation » ; `scenario-read-dialog.html` lie `[situationIsMj]="isMj()"` en gardant `[isMj]="false"` (contrôles MJ cachés), donc le MJ lit « Je mène » sur ses chapitres PASSE. `.scenario-row__title` passe à `flex: 1 1 0` (`min-width: 0` conservé) : le `flex-wrap` ne renvoie plus que la ligne de situation. Tests : `scenario-read-dialog.spec.ts` (MJ → « Je mène » sans contrôle MJ, joueur → « J’y étais ») et `seance-list.spec.ts` (défaut, `situationIsMj` true/false). Specs scenarios + situation-line : 361 tests verts.

## Spec Change Log

- Loop 1 — finding: the read dialog (opened by the GM for PASSE chapters) feeds `app-seance-list` with `isMj=false`, so the GM read the player's situation ("J’y étais" or no line) on sessions they ran while the Chronologie said "Je mène". Amended: Code Map and Tasks name the read dialog and a `situationIsMj` input that does not unhide MJ controls. Known-bad state avoided: passing `[isMj]="isMj()"` to the dialog's list would expose delete/edit controls in a read-only dialog. KEEP: shared `app-situation-line`, the `:host:empty` rule, the three surfaces' wiring, the Chapitres `chapterSituation`, all existing tests. Code is not reverted (git writes are forbidden here and the rest is correct): the same implementer applies the fix on top.

## Review Triage Log

| # | Pass | Layer | Finding | Verdict | Evidence / route |
|---|------|-------|---------|---------|------------------|
| 1 | 1 | gap | Read dialog feeds `app-seance-list` `isMj=false`: the GM reads the player's situation on PASSE chapters | high | Real (GM reaches the dialog for PASSE chapters; Chronologie says "Je mène"). bad_spec → Spec Change Log entry, `situationIsMj` input added, loop 1. Fixed, verified by dialog and list specs. |
| 2 | 1 | blind, edge | `.scenario-row` `flex-wrap` could wrap title/badge/button of rows without a situation line | low | Real risk, direct fix: `.scenario-row__title` base `flex: 1 1 0`. Patched in loop 1. |
| 3 | 1, 2 | blind, edge | `chapterSituation` hard-codes `isMj=true` | false | `ScenarioList` is mounted only for the GM (`partie-detail.html` ~l.604); the epic fixes `isMj` true for this tab. |
| 4 | 1, 2 | blind, edge | `todayKey` frozen at construction (tab open past midnight) | low | Frozen by the spec ("single `todayKey` of each screen", same pattern as the Chronologie and `SeanceList`). Rejected. |
| 5 | 1, 2 | blind, edge | "Je mène" on undated sessions / every session including past ones, noise for the GM | false | Frozen: `nextSeanceOf` keeps undated sessions (53.1), the GM sees "Je mène" on every session, drafts included. |
| 6 | 1 | blind | Timeline row restructured (`card-seances__line`) without a warning mark | false | Existing timeline tests pass untouched; the screen is flagged with the warning sign in the presentation. |
| 7 | 1, 2 | blind, edge | `.card-seances__line` does not wrap | false | Same non-wrapping row as before the story (label + badge). |
| 8 | 1, 2 | blind | `:host:empty` fragile / untested; `<p>` markup; repeated label for screen readers; line not a live region | low | Plain text row is the spec; the pill is an inline span; no named harm beyond the existing pattern. Rejected. |
| 9 | 1, 2 | blind | Duplicated `seanceSituation` wrappers, per-cycle `chapterSituation`, `situationIsMj` API shape | low | Design preferences; each surface owns its own viewer/role/`todayKey`. Rejected. |
| 10 | 1, 2 | blind, edge | Test hygiene (unaccented titles, duplicated fixtures, missing boundary cases) | low | Cosmetic; boundary cases of `seanceSituation` / `nextSeanceOf` are covered in `status-derivation.spec.ts` (53.1). Rejected. |
| 11 | 1, 2 | blind, edge | Realtime: only the Chronologie has a `changed()` test; API emissions not evidenced | false | The three surfaces share `ScenariosService.changed()`; the five API emissions were read in `PollService` / `EventsService` and noted in Implementation Notes. |
| 12 | 2 | edge | `currentUserId()` undefined before auth resolves | false | `currentUserId` is a signal; rows appear when it settles. |
| 13 | 2 | edge | `situationIsMj` null typing | low | Only `isMj()` booleans are bound. Rejected. |
| 14 | 2 | gap | No verification gaps | — | Both passes: none beyond #1. |

Loop 1 verification: full web suite 4900 passed, 2 failed (the two known date-frozen `calendar-view` tests); `tsc` shows only TS6059 noise.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green except the two known `calendar-view` date-frozen tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: no new error
