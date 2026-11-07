---
title: '53.2 — One single "Ma situation" pill, for evenings and JDR alike'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'a8e48735d8d75158d3c8cf7e45745c738d71a30b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The event card and the evening dialog still draw their own inline "Ma situation" chip (`event-card__chip`, `ed__chip`, tone keys `partie.ralliement_event_chip_*`), so the application has two pills with different looks; on the card "Vote à faire" wears `status-live` instead of the "to do" tone.

**Approach:** `eventSituation()` returns a situation value, the card and the dialog render `<app-situation-pill>`, the chip markup/styles and the old tone keys disappear, and the row label becomes `situation.ma_situation`. Web only, no API change.

## Boundaries & Constraints

**Always:** `SituationValue` (in `core/status/status-derivation.ts`) = `SeanceSituation | 'place_reservee'`; `app-situation-pill` takes it. `eventSituation()` keeps exactly its current rules and order (Stories 40.4, 40.5, 41.4): vote waiting → `vote_a_faire`; reserved place on an upcoming event → `place_reservee`; not a participant (unless `membersParticipate`) → `pas_inscrit`; else `j_y_etais` once past, `je_participe` before. Pill tones: `place_reservee` like `vote_a_faire` (`--jdr-status-todo` 16 % fill + outline). For `vote_a_faire`, `je_participe`, `place_reservee` the outline is the full token color (53.1 used a 45 % mix; align it: "Je participe" must not change on the card). Labels never change on screen. Keys: `situation.place_reservee` ("Place réservée") and `situation.ma_situation` ("Ma situation") identical in the three themes, added to the identical-keys list; the five `partie.ralliement_event_chip_*` keys and `partie.ralliement_event_situation` are removed from the three tone files and their tests. Evaluate realtime per `docs/checklist.md` (derived from the same card data, no new channel) and note it.

**Never:** Touch the cancelled card (no "Ma situation" row, Story 42.1), row order, the situation panel text (`partie.ralliement_event_situation_*` keys stay), its actions (S'inscrire / Accepter / Décliner) or accessible names. No `<mat-icon>`. No new CSS token.

## I/O & Edge-Case Matrix

| Scenario | State | `eventSituation()` |
|---|---|---|
| Vote waits for me | `needsVote` | `vote_a_faire` (before every other row) |
| Reserved place, upcoming | `hasReservedPlace`, not past | `place_reservee` |
| Reserved place, past | never accepted | `pas_inscrit` |
| Not a participant | no inscription, no `membersParticipate` | `pas_inscrit` |
| Participant or host, upcoming / past | — | `je_participe` / `j_y_etais` |
| Evening (`membersParticipate`) | any member, upcoming / past | `je_participe` / `j_y_etais` |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/events/event-card.util.ts` (l.274–306) -- `EventSituation` interface and `eventSituation()` → return `SituationValue`; `eventSituationTextKey` untouched.
- `apps/web/src/app/core/status/status-derivation.ts` -- export `SituationValue` beside `SeanceSituation`.
- `apps/web/src/app/shared/situation-pill/` (`.ts`, `.scss`, `.spec.ts`) -- input type `SituationValue`; add `situation-pill--place_reservee`; full-color outlines.
- `apps/web/src/app/features/events/event-card/event-card.{html,scss,ts}` (html l.26–31, scss l.102–119) -- `<app-situation-pill>`, import it, drop chip rules, label key `situation.ma_situation`.
- `apps/web/src/app/features/events/event-dialog/event-dialog.{html,scss,ts}` (html l.34–43, scss l.70–90, ts l.252) -- same swap; keep `ed__chip-row`.
- `apps/web/src/app/core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` -- remove the six keys (l.576–582/621/656 area), add the two new ones next to the `situation.*` block.
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts` (l.1037–1040, 1070, 1094, 1793, 1842) -- migrate to `situation.*`, add absence checks for the removed keys.
- Specs to rewrite: `features/events/event-card.util.spec.ts` (l.132–252, 415–431, 546–552), `event-dialog/event-dialog.spec.ts`, `features/parties/partie-detail/partie-detail.spec.ts` (`.event-card__chip`, `.ed__chip` and old keys: l.5123–5149, 5394, 5860–5886, 6206–6208, 6268–6334, 7253–7264).

## Tasks & Acceptance

**Execution:**
- [x] `status-derivation.ts`, `situation-pill/*` -- `SituationValue`, `place_reservee` tone, full-color outlines, spec cases
- [x] `event-card.util.ts` + spec -- value-returning `eventSituation`, every matrix row
- [x] `event-card.*`, `event-dialog.*` -- pill swap, dead styles removed, row label key
- [x] tone files + `theme-tone.service.spec.ts` -- key migration
- [x] `event-dialog.spec.ts`, `partie-detail.spec.ts` -- assertions on `app-situation-pill` / `situation.*`; `vote_a_faire` tone for a waiting vote

**Acceptance Criteria:**
- Given a group or evening, when its cards and dialog render, then every "Ma situation" pill is an `app-situation-pill` and no `event-card__chip` / `ed__chip` markup or rule remains
- Given a vote waiting for me, when the card renders, then "Vote à faire" carries the `vote_a_faire` tone; "J’y étais" and "Place réservée" carry the 53.1 tones; "Je participe" and "Pas inscrit·e" look as before
- Given the removed keys, when searched in `apps/web/src`, then none remains; the displayed texts are unchanged
- Given web Vitest suites and `tsc`, when run, then all pass (bar the two known date-frozen `calendar-view` tests)

## Implementation Notes

- Realtime (`docs/checklist.md`) : évalué, aucun câblage à ajouter. La pastille de la carte et du dialogue dérive de la même donnée de carte (`EventCardDto`) que la carte elle-même, déjà rafraîchie par le canal `partie:{id}` existant ; aucun nouveau canal, aucun nouveau signal `changed`.
- Les six anciennes clés (`partie.ralliement_event_situation`, `partie.ralliement_event_chip_*`) ne subsistent que comme chaînes de la liste d'absence de `theme-tone.service.spec.ts` (garde voulue par la spec).
- Vérification : `tsc --noEmit` (spec + app) sans nouvelle erreur ; `ng test --watch=false` : 4866 passés, 2 échecs = les deux tests `calendar-view` figés sur la date.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge | Full-color outlines change the shared pill on every 53.1 surface, not only event cards, without a warning mark | low | The frozen Boundaries decide it; 53.1's own AC already said "outline in the token color" (45 % was a 53.1 deviation). Rejected; flagged with the warning sign in the presentation. |
| 2 | blind | Pill variants disagree on border strength | false | After the change every variant uses a full-strength outline (je_mene, j_ai_vote, pas_inscrit, j_y_etais already did). |
| 3 | blind | Old chip layout (`flex: 0 0 auto`, nowrap) may be lost | false | `.situation-pill` keeps `flex: 0 0 auto` and `white-space: nowrap`; a nowrap flex item cannot shrink below its content. |
| 4 | blind, edge | Dialog pill loses its accent look / "look as before" only approximate | false | The intent is one single pill app-wide (53.2 title); only the card tones are promised unchanged. |
| 5 | blind, edge | `situationChip`, "chip" comment and doc still say chip | low | Real misnomer, direct fix: `situationChip` renamed `situation`, comment reworded. Patched. |
| 6 | blind | Dialog tests only cover je_participe / j_y_etais | low | partie-detail specs cover pas_inscrit, place_reservee and vote_a_faire through card and dialog. Rejected. |
| 7 | blind | Leftover references to removed keys not grepped | false | Repo-wide search: only the absence-check list of `theme-tone.service.spec.ts` and an untracked `dist/` build output. |
| 8 | blind | `situation.ma_situation` lives in the `situation.*` namespace | false | Frozen by the epic (key name decided in planning). |
| 9 | blind | `SituationValue` location and breadth | false | Frozen by the epic (`core/status/`, union of `SeanceSituation` and `place_reservee`). |
| 10 | blind | Test title reads as a tautology | low | Direct fix: title reworded. Patched. |
| 11 | blind | Process gaps (graphify, realtime note) | false | Realtime evaluation recorded in Implementation Notes; graph updated at presentation. |
| 12 | gap | No verification gaps | — | Layer reported none. |

Patches applied: rename `situationChip` → `situation` (event-dialog.ts/.html), comment in `event-card.ts`, test title in `event-card.util.spec.ts`; affected suites re-run (472 passed).

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green except the two known `calendar-view` date-frozen tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: no new error
