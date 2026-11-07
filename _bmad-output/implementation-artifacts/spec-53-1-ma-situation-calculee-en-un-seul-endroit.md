---
title: '53.1 — "Ma situation" computed in one place; "Prochaine séance" widget keeps the vote call'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '7abb9b895d9bdd10dcf3bb92d784ac10a331d4a5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `seanceState` mixes the session's state with the viewer's call to action ("Réponds au vote"), so "my situation" has no single definition and the state badge cannot become impersonal.

**Approach:** Add pure `seanceSituation` and `nextSeanceOf` next to `seanceState`, make `seanceState` impersonal, create the shared `app-situation-pill`, and let the "Prochaine séance" widget carry the vote call through it. Web only; no API change.

## Boundaries & Constraints

**Always:** Pure functions (no clock, no Angular), structural `SeanceStateSource` input. "Answered" is `hasUnansweredOptions` (`core/poll/poll.util.ts`), never redefined. "Past" = end of range (`endDate`), else date, strictly before `todayKey`; same day is not past. Effective date = `poll.chosenDate` → `dateValidee` → `inscription.dateValidee`. Pill colors only through existing `--jdr-*` variables; the pill always carries its text. All new text is a key in the three tone files, identical across themes, typographic apostrophe `’`, added to the identical-keys list of `theme-tone.service.spec.ts`. Shared types and signatures changed → run `docker compose exec api pnpm typecheck`. Realtime: no new channel; the widget keeps following `activePolls` / `partie:{id}`; record the `docs/checklist.md` evaluation in Implementation Notes.

**Never:** Touch the Agenda badge `calendar.agenda.badge_answer_poll` or `GET /me/party-signals`. No new CSS token. No pill on Chronologie, chapter cards, sheet or event card (53.2/53.3). No `viewerId` kept on `seanceState`. Known interim state, accepted: until 53.3, Chronologie, chapter cards and sheet show "Vote ouvert" with no pill — 53.1 to 53.3 ship together.

## I/O & Edge-Case Matrix

`seanceSituation(seance, viewerId, isMj, todayKey)` returns `SeanceSituation` (`je_mene | vote_a_faire | j_ai_vote | je_participe | pas_inscrit | j_y_etais`) or `null`; rules apply in this order:

| Scenario | State | Result |
|---|---|---|
| No viewer | `viewerId` undefined | `null` |
| GM | `isMj`, any state | `je_mene` |
| Open poll, unanswered | `poll.status==='OPEN'`, registered or not | `vote_a_faire` |
| Open poll, answered | all options answered | `j_ai_vote` |
| Enrollment, no open poll | registered / past | `je_participe` / `j_y_etais` |
| Enrollment, no open poll | not registered / past | `pas_inscrit` (full or not) / `null` |
| No enrollment, effective date | upcoming or same day / past | `je_participe` / `j_y_etais` |
| Closed poll, no date | viewer had answered / not | `j_ai_vote` / `null` |
| No date, no poll | — | `null` |

`nextSeanceOf(scenario, todayKey)`: first session in served order whose end is not past (undated is not past); `null` if none or no sessions, GM included.

</frozen-after-approval>

## Code Map

- `apps/web/src/app/core/status/status-derivation.ts` -- `seanceState` (l.140) loses `viewerId` and its `status.seance_answer_poll` branch (open poll → `status.seance_poll_open`, tone `live`); add `SeanceSituation`, `seanceSituation`, `nextSeanceOf`; reuse `dateKeyOf` and the past/`lastKey` logic (extract a shared private helper, no duplicate).
- `apps/web/src/app/core/status/status-derivation.spec.ts` -- seanceState tests l.107–136 and l.265 now expect `seance_poll_open`; add pure tests (no TestBed).
- `apps/web/src/app/features/scenarios/seance-list/seance-list.ts` (l.216), `scenario-timeline/scenario-timeline.ts` (l.392) -- drop the `viewerId` argument; adapt `seance-list.spec.ts` l.1309 and `scenario-timeline.spec.ts` l.1045 ("Réponds au vote" → "Vote en cours").
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` (`nextSessionBadge` l.826), `.html` (l.117) -- adapt the call; new `nextSessionSituation` computed beside it; `partie-detail.spec.ts` l.630–665.
- `apps/web/src/app/shared/situation-pill/` (new: `.ts`, `.html`, `.scss`, `.spec.ts`) -- standalone `<app-situation-pill [value]>`; pattern `shared/status-badge/` (padding 1px 8px, radius 6px as `.status-badge`, 12px/600).
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` -- remove `status.seance_answer_poll` (l.833/825/828), add six `situation.<value>` keys (labels: "Je mène", "Vote à faire", "J’ai voté", "Je participe", "Pas inscrit·e", "J’y étais").
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- drop the key from `STATUS_KEYS` (l.440), the "distingue" test (l.470) and the neutral list (l.790); add the six `situation.*` keys to the identical list.

## Tasks & Acceptance

**Execution:**
- [x] `core/status/status-derivation.ts` -- add `seanceSituation` + `nextSeanceOf`, make `seanceState` impersonal, remove the `StatusLabelKey` member -- single source of "Ma situation"
- [x] `core/status/status-derivation.spec.ts` -- every value and `null` case of the matrix (partial/complete answers, enrollment + open poll registered and not, closed poll, same-day/past/range started), `nextSeanceOf` cases, `seanceState` no longer impersonal -- unit coverage
- [x] `shared/situation-pill/*` -- component and spec (text + tone class of each value, three themes). Tones: `je_mene` 1px `--jdr-accent-1` outline and text; `vote_a_faire` `--jdr-status-todo` 16% fill + outline; `j_ai_vote` `--jdr-status-live` outline and text; `je_participe` `--jdr-status-live` 12% fill + outline; `pas_inscrit` dotted `--jdr-text-muted` outline, full-contrast text; `j_y_etais` `--jdr-status-done` 12% fill, muted text
- [x] tone files + `theme-tone.service.spec.ts` -- keys as in the Code Map
- [x] `seance-list`, `scenario-timeline` + their specs -- signature adaptation
- [x] `partie-detail.ts/.html/.spec.ts` -- widget: no pill for the GM; otherwise `seanceSituation` from the single retained poll (pending one, else first; none when the next session is dated), `isMj` false, pill beside the badge only for `vote_a_faire` / `j_ai_vote`

**Acceptance Criteria:**
- Given a single-quest player with an unanswered open poll, when the Détails tab opens, then the widget shows the state badge "Vote en cours" and the pill "Vote à faire"; after answering in the Destinée, the pill becomes "J’ai voté" without reload
- Given the GM, or a dated next session, when the widget renders, then no pill appears
- Given `status.seance_answer_poll` anywhere in `apps/web/src`, when searched, then it only remains in the Agenda's separate key (`calendar.agenda.badge_answer_poll`), never in tones, `StatusLabelKey` or specs
- Given `pnpm typecheck`, web Vitest suites and the tone-parity tests, when run, then all pass

## Implementation Notes

- **Realtime (`docs/checklist.md`)** : aucun nouveau canal. Le widget « Prochaine séance » lit `activePolls()` / `partie()` (déjà rafraîchis via `partie:{id}` / `RealtimeService`) ; `retainedPoll`, `nextSessionBadge` et `nextSessionSituation` sont des `computed` sur ces signaux, donc la pastille passe de « Vote à faire » à « J’ai voté » sans rechargement. La pastille partagée est purement présentationnelle (aucune donnée propre).
- `status-derivation.ts` : helpers privés `lastKeyOf` / `isPastSeance` (source unique du « passé », partagée par `seanceState`, `seanceSituation`, `nextSeanceOf`). `nextSeanceOf` est générique (`{ seances?: readonly S[] }`) pour rendre le type de séance d’entrée.
- `scenario-timeline.ts` conserve `currentUserId` (désormais sans lecteur dans ce fichier) : 53.3 le réutilise pour les lignes « Ma situation ».
- `theme-tone.service.spec.ts` : le test « textes contractuels » comptait 24 clés `status.*` ; il en compte 23 après retrait de `status.seance_answer_poll`.
- Vérifs : `ng test` complet vert hors 2 échecs de `calendar-view.spec.ts` (rail « prochain jour porteur », hors périmètre, aucun lien avec `status-derivation`) ; `api pnpm typecheck` OK ; `tsc --noEmit` web (app + spec) sans erreur hors le bruit TS6059 rootDir préexistant ; eslint propre sur les fichiers touchés.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge | Open poll on a past session: badge "À débriefer" next to pill "Vote à faire" (`seanceSituation` checks open poll before past, `seanceState` checks past first) | low | Real but needs an OPEN poll on a session whose date is already past (inconsistent data, rare). The frozen matrix fixes this order. Rejected: fix would deviate from the frozen matrix; revisit in 53.3/54.1 if seen in practice. |
| 2 | blind | `je_participe` / `j_y_etais` ignore the viewer's own answer on a dated session without enrollment | false | Explicit rule in the frozen matrix (effective date, current member of the party). Not a defect against intent. |
| 3 | blind | "Single place" not delivered: `nextSeanceOf` has no caller, pill only in `partie-detail` | false | By design: 53.2 and 53.3 add the other surfaces; interim state accepted in the frozen Boundaries. |
| 4 | blind, edge | `ScenarioTimeline.currentUserId` now unread | low | Kept on purpose for 53.3 (rows "Ma situation"); `tsc` and ESLint raise nothing. Rejected. |
| 5 | blind, edge | `nextSeanceOf` follows served order, undated session can come first | false | Frozen contract: "first session in served order whose end is not past (undated is not past)". |
| 6 | blind | Pill accessibility (no prefix, contrast unchecked, fallback colors) | low | Same pattern and tokens as `status-badge`; the pill always carries its text. Rejected: no named harm beyond existing badge behavior. |
| 7 | blind | Weak tests (multi-poll answered path, missing user, tone key missing) | low | Pure-function cases are covered in `status-derivation.spec.ts`; tone keys are type-checked and parity-tested. Rejected. |
| 8 | blind | Widget builds a fake session `{ poll }` and filters the result | low | Spec explicitly asks for `seanceSituation` from the retained poll, filtered to two values. Design preference only. Rejected. |
| 9 | blind | `situation.*` keys inserted mid `status.seance_*` block in tone files | low | Cosmetic ordering, no behavior; rejected. |
| 10 | blind, edge | Realtime refresh: pill follows `activePolls()` | false | `activePolls` is reloaded by `scenariosSvc.changed()` filtered by `matchesPartie` (existing wiring, `partie-detail.ts` ~l.688-700) and keeps only `OPEN` polls; evaluation recorded in Implementation Notes. |
| 11 | blind | Docs/Agenda still say "Réponds au vote" | false | Agenda key is explicitly out of scope; `docs/textes-classement.md` lines refer to another key (`partie.signal_vote_en_cours_sans_reponse`). |
| 12 | edge | Empty-string `viewerId`, non-OPEN/CLOSED poll status, null session entries | false | User ids are non-empty; `PollStatus` is `'OPEN' \| 'CLOSED'`; `seances` entries are never null. |
| 13 | edge | Closed poll + enrollment, viewer voted but not registered gets `pas_inscrit` | false | Frozen matrix: enrollment rules apply once the poll is closed. |
| 14 | edge | `retainedPoll` could keep a non-open poll | false | `activePolls` only ever holds `OPEN` polls (`loadActivePolls`). |
| 15 | edge | GM flicker while `isMj()` loads | false | Widget renders only inside the loaded party, where `isMj()` is already derived. |
| 16 | edge | Vote call lost outside the widget until 53.3 | false | Accepted interim state, frozen Boundaries. |
| 17 | gap | No verification gaps | — | Layer reported none. |

All findings rejected: no patch, no deferral, no loopback.

## Verification

**Commands:**
- `docker compose exec web pnpm exec vitest run` -- expected: all green (status-derivation, situation-pill, tone parity, partie-detail, seance-list, scenario-timeline)
- `docker compose exec api pnpm typecheck` -- expected: no error
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no error
