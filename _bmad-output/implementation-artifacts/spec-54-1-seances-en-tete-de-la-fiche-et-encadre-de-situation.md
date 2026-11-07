---
title: '54.1 — Sessions first on the sheet, and a box that says what to do'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'bc89fe0d26f10580ccbea8b30ceb748591d73e50'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-54-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the scenario sheet the sessions come last, and each session buries what the viewer must do (vote, enrol, start the vote) in per-branch buttons.

**Approach:** Web only, no API change. Player read dialog: sessions right after title/badge. In `seance-list`, a presentational `<app-seance-situation>` box (carrying the "Ma situation" line) replaces the scattered action buttons; a pure `seanceSituationBox()` decides which box. Full ACs: `_bmad-output/planning-artifacts/epics-palier10-6-8.md`, Story 54.1 (l.675-700).

## Boundaries & Constraints

**Always:** Box value comes from `seanceSituation` (never recomputed); the line is rendered inside the box or alone (`app-situation-line`), never twice. Every new text is a key of the three tone files (`apps/web/src/app/core/theme/tones/`), identical ones in `NEUTRAL_KEYS`; buttons reuse existing keys. Colors: `--jdr-status-todo` (player) / `--jdr-accent-1` (GM) border, 8 % tint, 10px radius, `10px 12px` padding; no new token, no `role="status"`, 44px button, wraps on phone, disabled while `pollActionPending()`. Actions keep `onInscrire` / `onDesinscrire` / `goToCalendarForSeance` / `onResetSeanceDate`. "Voter dans le calendrier" asks the host to close (new `seance-list` output) then `router.navigateByUrl(atelierUrl({partieId, family:'jdr', role:'player'}, {poll: poll.id}))`. Realtime: no new channel; record the `docs/checklist.md` evaluation in Implementation Notes. Flag every sheet change ⚠️.

**Never:** Touch `seanceSituation`, the Destinée/calendar, event dialog, API. No box for the GM while the vote is open (`app-poll-status` + "Clôturer le vote" stay until 54.3). No box for the GM inside `scenario-read-dialog` (`isMj()` false, `situationIsMj` true): `seanceSituationBox` takes the controls flag, MJ values require it. Do not remove `app-poll-response` (54.2) nor `app-poll-status` (54.3).

## I/O & Edge-Case Matrix

| Viewer / state | Box | Text + action |
|---|---|---|
| Player, `vote_a_faire`, deadline today or later / none | `voter` | `seance_situation_vote_open` ("jeudi" within 6 days, else "jeudi 12 novembre") / `…_no_deadline` + `…_vote_in_calendar` |
| Player, `vote_a_faire`, deadline passed | `null` | line only |
| Player, `j_ai_vote` + inscription: not enrolled with room / enrolled / full | `participer` / `se_desinscrire` / `null` | follows enrolment, situation not recomputed |
| Player, `pas_inscrit` (no date) with room / full | `participer` / `null` | `…_not_registered` + `scenarios.seances_inscrire` |
| Player, `je_participe` (no date) | `se_desinscrire` | `…_registered` (Forêt "Tu participes.") + `scenarios.seances_desinscrire` (text button) |
| Player, dated session (enrolled or not), closed poll | `null` | line + date or message as today |
| GM controls, no date nor poll (linear, or episodic with capacity) | `lancer_le_vote` | `…_no_date` + `common.lancer_le_vote` with `<app-icon name="vote">` |
| GM controls, closed poll without date | `reinitialiser_la_date` | `common.vote_cloture_sans_date_retenue` + outlined `common.reinitialiser_la_date` |
| GM controls: open vote, dated, episodic without capacity | `null` | existing UI |

</frozen-after-approval>

## Code Map

- `features/scenarios/seance-list/seance-list.{html,ts,scss,spec.ts}` -- html l.26-253: order header → box or line → date/vote/inscription → infos → compte rendu; old buttons at l.93-101, 129-142, 152-171, 190-197, 214-230 go; `onInscrire/onDesinscrire/goToCalendarForSeance/onResetSeanceDate`, `todayKey`, `currentUserId`, `situationIsMj` reused; add output + box wiring.
- `features/scenarios/seance-situation/` (new) -- `seance-situation.{ts,html,scss,spec.ts}` presentational (inputs: box, situation, text, busy; outputs: action); `seance-situation-box.{ts,spec.ts}` pure function + deadline label helper (`daysBetweenKeys`, `core/status/status-badge.model.ts`; deadline day = `expiresAt.substring(0,10)`, as `pollDeadlineKey`).
- `features/scenarios/scenario-read-dialog/scenario-read-dialog.{html,ts,spec.ts}` -- html: badge (or restricted note) → `app-seance-list` (now l.138) → description/durations → past blocks → announcements → participants; bind the new output to `close()` (cf. `editResume`).
- `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts` + `core/theme/theme-tone.service.spec.ts` -- 6 `scenarios.seance_situation_*` keys (vote_open, vote_open_no_deadline, vote_in_calendar, not_registered, registered, no_date); only `registered` differs per theme.
- `features/events/event-dialog/event-dialog.scss` `.ed__situation` -- style model, read only.
- `docs/checklist.md` -- realtime evaluation format.

## Tasks & Acceptance

**Execution:**
- [x] `seance-situation-box.ts` + spec -- pure function, every matrix row, no TestBed
- [x] `seance-situation.*` + spec -- borders, line first, action emitted/disabled, `app-icon[data-icon="vote"]`
- [x] tone files + `theme-tone.service.spec.ts` -- new keys, `NEUTRAL_KEYS`
- [x] `seance-list.*` + spec -- box/line placement, old buttons removed (each action once), navigations to `guild-calendar?poll=` and `?seanceId=`, three themes, update after `changed()`
- [x] `scenario-read-dialog.*` + spec -- order, restricted chapter, close before navigating, no GM box
- [x] Implementation Notes -- realtime evaluation; run `docker compose exec web pnpm exec ng test --watch=false`

**Acceptance Criteria:**
- Given Hugo's open unanswered vote, when he opens the sheet, then sessions are first, the box offers "Voter dans le calendrier", the Destinée opens on that poll and, back, the pill says "J’ai voté"
- Given a session answered/enrolled elsewhere, when `changed()` fires, then the box moves to the next case or disappears without reload
- Given phone width, when rendered, then text and button wrap with no horizontal overflow

## Implementation Notes

- New `features/scenarios/seance-situation/`: `seance-situation-box.ts` (pure `seanceSituationBox(seance, situation, isMj, viewerId, todayKey, episodic = false)` + `voteDeadlineLabel`) and `SeanceSituationComponent` (`<app-seance-situation>`, class renamed to avoid the `SeanceSituation` type clash). The optional sixth parameter `episodic` is the one deviation from the AC signature: without it an episodic session lacking capacity cannot be told apart from a linear one.
- `seance-list`: `@let situation` / `@let box`, box replaces the line (the line is rendered inside it); `todayKey` became protected; new `leaving` output; `onBoxAction` reuses `onInscrire` / `onDesinscrire` / `goToCalendarForSeance` / `onResetSeanceDate`. Old buttons removed from the branches; dated linear session without a vote keeps its date and plain "Lancer le vote"; sealed date keeps its date and reset button.
- `scenario-read-dialog`: order badge (or restricted note) → sessions → description/durations → past blocks → announcements → participants; `(leaving)="close()"`; `app-seance-list` gets a 0.75rem block margin.
- Tones: 6 `scenarios.seance_situation_*` keys in the 3 files, 5 in `NEUTRAL_KEYS`, `registered` ("Vous participez." / Forêt "Tu participes.") outside it.
- Realtime (`docs/checklist.md`): no new channel. The box reads the `scenario` entry that `seance-list` reloads on `ScenariosService.changed()` (`partie:` prefix); the five API emissions (castVote, withdrawVote, inscrire/desinscrire, choose, close) were verified in 53.3. Component test: an answer received after `changed()` removes the box.
- Verification: full web suite 5035 passed, 2 failed (the two known date-frozen `calendar-view` tests); `tsc --noEmit -p tsconfig.spec.json` shows only TS6059 noise. Not seen in a browser.
- Review patches: closed poll with an inherited root date but no sealed date keeps date + reset in the linear MJ branch; the box is hidden while the capacity form of that session is open; `situationBox` takes the already computed situation (computed once per session).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge, gap | Deadline read from the UTC part of `expiresAt`, compared with a local `todayKey` | low | Same convention as `pollDeadlineKey` / `isPollOpen` (event-card.util) and the known UTC/local debt; fix would add branches. Rejected. |
| 2 | edge | `voteDeadlineLabel` throws on an unparseable `expiresAt` | low | Server-produced ISO value, unreachable. Rejected. |
| 3 | blind | Deadline today reads as "samedi" | low | The frozen AC says weekday alone within six days; cosmetic. Rejected. |
| 4 | blind, edge | Full session has no "complet" cue | false | AC: "complète, pas d'encadré, la ligne « Pas inscrit·e » suffit". |
| 5 | blind | Focus lost when the action button swaps | low | The old separate inscrire / désinscrire buttons were destroyed the same way. Rejected. |
| 6 | blind, edge | Linear MJ closed poll without `chosenDate` but with a root date loses message and reset | medium | Real regression (box null because dated, old branch removed). Patch: branch also on `resolvedDate`; test added. |
| 7 | blind, edge | `leaving` not bound by every host | false | `scenario-editor` (MJ) never gets the player `voter` box; the read dialog binds it. |
| 8 | blind | Six positional parameters; `hasDate` duplicates `resolvedDate` | low | Signature set by the AC; developer preference. Rejected. |
| 9 | blind | `seanceSituation` computed twice per change detection | low | Direct fix, applied (one `@let situation`). |
| 10 | blind, edge | `onBoxAction` / box switch not exhaustive; stale `voter` click | low | Unlikely, adds guards. Rejected. |
| 11 | blind | Three near-identical buttons in `seance-situation.html` | low | Preference. Rejected. |
| 12 | blind | Block margin on an empty `app-seance-list` | low | Cosmetic. Rejected. |
| 13 | blind | `registered` not asserted outside `NEUTRAL_KEYS` | false | The existing neutral-keys test already fails if a neutral key gets a voice, and it differs in Forêt. |
| 14 | blind, edge | `todayKey` frozen at construction | low | Documented pattern of `SeanceList`; spec says one `todayKey` per screen. Rejected. |
| 15 | edge | Box "Lancer le vote" shown beside the open capacity form | medium | Real (the old button was hidden during edit). Patched: box hidden while editing; test added. |
| 16 | edge | Box `voter` and inline `app-poll-response` coexist | false | Intended until Story 54.2 (spec Never). |
| 17 | edge | MJ episodic loses "Lancer le vote" when poll open or dated | false | The old button only existed in the undated, voteless branch. |
| 18 | edge | Pill after returning from the Destinée unverified | false | Pill update on the Chronologie is Story 53.3 behaviour, outside this diff. |
| 19 | gap | No verification gap found | n/a | Pre-verified by the layer. |

## Design Notes

A dated session with enrolment keeps today's behaviour (date only, no unenrol button), hence `null`. `seanceSituationBox(seance, situation, isMj, viewerId, todayKey)` returns `voter | participer | se_desinscrire | lancer_le_vote | reinitialiser_la_date | null`.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green bar the two known date-frozen `calendar-view` tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: only existing TS6059 noise
