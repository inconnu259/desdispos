---
title: '54.2 — Poll summary, player side'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: 'd34d6d0e6ea5a89b8d7fceac356608bf5b202bb1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-54-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A player reading a session with an open vote must answer slot by slot inside the sheet (`app-poll-response`), with no overview of where the vote stands.

**Approach:** Web only, no API change. Add text lines under the 54.1 box (my answers, best slot, missing count, deadline) via `<app-seance-poll-summary>`, fed by two shared `poll.util` helpers; voting moves to the Destinée only, so `app-poll-response` is deleted. Full ACs: `_bmad-output/planning-artifacts/epics-palier10-6-8.md`, Story 54.2 (l.702-724).

## Boundaries & Constraints

**Always:** `pollRankableOptions(poll)` is the only `SessionPollDto` → ranking adapter (`{optionId, date: 'YYYY-MM-DD', slot, yes, maybe, no}`, served order); best slot = `bestOption(pollRankableOptions(poll), todayKey)`. `pollAnswerCounts(poll)` = `{eligible: membersCount, answered: distinct voters answering EVERY option via hasAnswered('jdr')…, missing: max(0, eligible − answered)}`; `getRespondedCount` / `getMissingVoters` unchanged. Plain text, no interactive element, no names for the player, wraps on phone. Span options use `candidateSpanSentence(option, poll.durationSlots)`, else "samedi 7 novembre, soir". Dated session: date large (18px / 600, `--jdr-text-primary`) in place of the summary; closed poll without date keeps the existing message; no poll → no summary. New texts are tone keys (`scenarios.seance_summary_*`), identical ones in `NEUTRAL_KEYS` ("Tes réponses" differs in Forêt); a tone key is removed only after a search finds no reader left. Realtime: no new channel, record the `docs/checklist.md` evaluation. Flag sheet changes ⚠️.

**Never:** Touch the GM branches, `app-poll-status`, `rankedPollSlots` / `rankedEntrySlots`, the Destinée, the API. No "Voter dans le calendrier" outside the 54.1 box.

## I/O & Edge-Case Matrix

| State | Summary |
|---|---|
| Open poll, no date, I answered 2 of 5 | "Vos réponses : 2 créneaux sur 5" (Forêt "Tes réponses") ; 0 or 1 → "créneau" |
| Best slot exists / none with a "yes" | "Meilleur créneau pour l'instant : samedi 7 novembre, soir — 3 oui" / "Pas encore de meilleur créneau" |
| 3 / 1 / 0 still to answer | "3 personnes n'ont pas encore répondu" / "1 personne n'a pas encore répondu" / line absent |
| Deadline today or later / none / passed | "Échéance : jeudi 5 novembre" / line absent / "Le vote est terminé." (rest stays) |
| Poll closed with a date / without / no poll | large date / existing message / nothing |

</frozen-after-approval>

## Code Map

- `core/poll/poll.util.ts` + `poll.util.spec.ts` -- add `pollRankableOptions`, `pollAnswerCounts` (reuse `votedOptionIds`, `hasAnswered`); `RankableOption` (`packages/shared/src/index.ts` l.1149) lacks `optionId`/`no`: export an extending type here.
- `features/scenarios/seance-poll-summary/` (new) -- `<app-seance-poll-summary>` (inputs `poll`, `todayKey`; current user via `AuthService`; lines as computed text) + spec; best-slot / deadline label helpers beside it (`voteDeadlineLabel` in `seance-situation/seance-situation-box.ts` is the six-day form, not this one).
- `features/scenarios/seance-list/seance-list.{html,ts,scss,spec.ts}` -- html l.~152 and ~211: `app-poll-response` → summary (open poll); date lines get the large style; drop `onPollResponded` and the import; update the specs asserting `app-poll-response`.
- `features/poll/poll-response/` -- delete (component, html, scss, spec); `rg` proves no other consumer (calendar-view mentions are comments only).
- `core/theme/tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre}.ts`, `core/theme/theme-tone.service.spec.ts` (list at l.~1409 holds `cta.withdraw_vote`) -- add summary keys; remove `cta.confirm_votes`, `cta.withdraw_vote`, `pollui.response_not_saved_aria`, `pollui.response_partial_error`, and `poll.vote_closed` / `common.envoi` if the search confirms; KEEP `success.vote_cast`, `success.vote_withdrawn`, `poll.withdraw_error` (read by `calendar-view.ts` l.4062-4096) and `poll.status_title`.
- `features/scenarios/scenario-read-dialog/scenario-read-dialog.spec.ts` -- l.~720 asserts `app-poll-response`.
- `features/calendar/span-label.ts` -- `candidateSpanSentence`, read only.

## Tasks & Acceptance

**Execution:**
- [x] `poll.util.ts` + spec -- both helpers; matrix cases (counts per option, date cut to day, best slot via `bestOption`, partial answer not counted, MJ counted, `missing` never negative, same numbers as an `OpenPollEntry`)
- [x] `seance-poll-summary.*` + spec -- every line in the three themes, singular/plural, span, no deadline, passed deadline, no name
- [x] tone files + `theme-tone.service.spec.ts` -- new keys, `NEUTRAL_KEYS`, removed keys absent
- [x] `seance-list.*` + spec -- summary under the box, large date, closed message, no `app-poll-response`, update after `changed()`
- [x] delete `features/poll/poll-response/` and fix `scenario-read-dialog.spec.ts`
- [x] Implementation Notes -- realtime evaluation; web tests + `tsc`

**Acceptance Criteria:**
- Given Hugo's open vote, when he opens the sheet, then the box and "Meilleur créneau pour l'instant : samedi 7 novembre, soir — 3 oui" show, and no per-slot answer control exists
- Given a vote answered in the Destinée, when `changed()` fires, then my count, best slot and missing count update without reload

## Implementation Notes

- `core/poll/poll.util.ts`: `PollRankableOption` (`RankableOption` + `optionId`, `no`), `pollRankableOptions`, `pollAnswerCounts` (answered = distinct voters answering every option; eligible = `membersCount`; missing clamped at 0).
- New `features/scenarios/seance-poll-summary/`: `SeancePollSummary` (inputs `poll`, `todayKey`; reads the viewer from `AuthService`; lines: my answers → best slot → missing → deadline or "Le vote est terminé."), `seance-poll-summary-labels.ts` (`bestSlotLabel` with `candidateSpanSentence` for spans, `deadlineDayLabel`). No `isMj` input (added in 54.3).
- `seance-list`: `app-poll-response` replaced by the summary in the two player branches (open poll), `onPollResponded` and the import removed, `--big` date modifier on the three player date sites. `features/poll/poll-response/` deleted; the remaining mentions in `calendar-view.ts`, `vote-answer-picker.*` and `docs/textes-classement.md` are historical comments.
- Tones: 8 `scenarios.seance_summary_*` keys in the 3 files (6 in `NEUTRAL_KEYS`; `my_answers` / `my_answers_one` say "Tes réponses" in Forêt). Removed after a search found no other reader (`apps` + `docs`): `cta.confirm_votes`, `cta.withdraw_vote`, `pollui.response_not_saved_aria`, `pollui.response_partial_error`, `poll.vote_closed`, `common.envoi`. Kept: `success.vote_cast`, `success.vote_withdrawn`, `poll.withdraw_error` (read by `calendar-view.ts`), `poll.status_title`.
- Realtime (`docs/checklist.md`): no new channel. The summary reads the `scenario` entry `seance-list` reloads on `ScenariosService.changed()` (`partie:` prefix); a vote cast in the Destinée emits `partie:{id}` (`PollService.castVote` / `withdrawVote`, verified in 53.3). Component test: an answer received after `changed()` updates "Vos réponses".
- Verification: full web suite 5037+ tests green except the two known date-frozen `calendar-view` tests; `tsc --noEmit -p tsconfig.spec.json` shows only TS6059 noise. Not seen in a browser.
- Review patch: tests added for the large date on the inherited-date and dated-inscription player branches.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge, gap | Deadline day read in UTC against a local `todayKey` | low | Same convention as `pollDeadlineKey` and `destinyEntryOption`; known UTC/local debt. Rejected. |
| 2 | blind | "Ended" rule duplicated instead of a shared `isPollEnded` | low | One-line comparison; fix adds public surface. Rejected. |
| 3 | blind | Partial responders counted as "n'ont pas encore répondu" | false | The AC defines answered as a reply to every option, as the Destinée does. |
| 4 | blind, edge | Voters who left the partie inflate `answered` | false | The server removes a leaving member's answers on an open poll (Story 40.8, AC); `Math.max` is the AC clamp. |
| 5 | blind, gap | Alignment test re-derives the server rule | low | Guards `pollAnswerCounts`' use of `hasAnswered`; the server file is outside this story. Rejected. |
| 6 | blind | Deleted `poll-response.spec.ts` leaves behaviours uncovered | false | Voting and withdrawing live in `VoteAnswerPicker` / `calendar-view`, each with specs; the deletion is the AC. |
| 7 | blind, edge | Stale comments and `docs/textes-classement.md` mention the deleted component | low | Historical comments and a migration note; no behaviour. Rejected. |
| 8 | blind | Neutral/removed keys not recorded in the docs | low | The tone specs are the source of truth. Rejected. |
| 9 | blind | No `aria-live` or title on the summary | false | AC: plain text, no interactive element; the epic forbids announcement roles. |
| 10 | blind | Presentation scatter (`--big` in three spots, slot-label tables, per-call `Intl`) | low | Preference. Rejected. |
| 11 | blind, edge | No test for zero options, null user, malformed date key, stale `todayKey` | low | Unreachable inputs (polls have at least two options, server dates) or the documented frozen `todayKey`. Rejected. |
| 12 | gap | Large date untested on two of three player sites | low | Direct fix: two tests added. |
| 13 | edge | Open poll or poll closed without a sealed date on a session with an inherited date shows the summary, not the date | low | Pre-existing branch order; the AC's "date fixée" is `chosenDate`. A mixed state is not shown to arise. Rejected. |
| 14 | edge | Implementation Notes empty while the task was ticked | low | Process slip, fixed by these notes (realtime evaluation included). |

## Design Notes

The AC lists an `isMj` input; the GM lines belong to 54.3, so it is added there (a dead input here would be unused code).

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green bar the two known date-frozen `calendar-view` tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: only TS6059 noise
