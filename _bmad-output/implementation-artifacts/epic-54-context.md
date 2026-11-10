# Epic 54 Context: La fiche de scénario dit d'abord quoi faire

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

On the scenario sheet (the "fiche"), each séance opens with the action expected from the viewer; voting happens in the calendar (the "Destinée"); the GM concludes from the sheet without scanning the slot list. Everything is web-side, in `features/scenarios/seance-list/` (rendered by `scenario-read-dialog` for players and `scenario-editor` for the GM, single-quest Chapter tab included). No API change: everything derives from `SeanceDto`, `SessionPollDto` and, for GM-side names, the already-loaded members list. Epic 53 is delivered: `seanceSituation` / `nextSeanceOf` (`core/status/`) are the only definitions of "Ma situation", `shared/situation-pill` the only pill, and each séance on the sheet already carries its "Ma situation" line. Epics 51/52 are delivered: all icons go through `<app-icon>`, no `<mat-icon>`.

## Stories

- Story 54.1: Séances at the top of the sheet, and a box that says what to do
- Story 54.2: Poll summary, player side
- Story 54.3: Poll summary GM side, and fix the date from the sheet

## Requirements & Constraints

- Every new text is a key in the three tone files (`apps/web/src/app/core/theme/tones/`), second-person informal in the Forest theme; reserved prefixes `scenarios.seance_situation_*` (box) and `scenarios.seance_summary_*` (summary). A text identical across the three themes joins `NEUTRAL_KEYS` in `core/theme/theme-tone.service.spec.ts`. Buttons reuse existing theme keys (`scenarios.seances_inscrire`, `scenarios.seances_desinscrire`, `common.lancer_le_vote`, `common.reinitialiser_la_date`, `common.cloturer_le_vote`), never a copy. A removed key leaves all three files and their tests, after a search proving no reader remains.
- Colors only through existing `--jdr-*` variables (`accent-1`, `status-todo`, `text-primary`, `text-muted`); no new token. The box always carries text plus a written action: border color never conveys alone who must act.
- The scenario sheet is a validated screen: every change to it is flagged ⚠️ in review.
- Out of scope: the Destinée and calendar (apart from the existing `?poll=` reading), the event dialog and every evening-mode screen. "→" and "+" written inside a label stay plain text.
- Phone and desktop equal; actions keyboard-reachable; 44px touch targets; no horizontal overflow on phones. CI green; run `docker compose exec api pnpm typecheck` after any shared signature/type change.
- Each story records its real-time evaluation per `docs/checklist.md`.

## Technical Decisions

- "Ma situation" is computed only by `seanceSituation`; the box takes that value as input and never recomputes it. "Has answered" is the shared `hasAnswered('jdr', …)` rule (via `core/poll/poll.util.ts`); named absentees come from `getMissingVoters`; best slot from `bestOption` (`@master-jdr/shared`), fed by a single `SessionPollDto` → `RankableOption` adapter. No hand-written count in a component.
- Real-time: no new channel. Box and summary read the `scenario` entry of `seance-list`, reloaded on `ScenariosService.changed()` (`partie:` prefix of `RealtimeService`).
- Calendar deep link: `atelierUrl({ partieId, family: 'jdr', role }, { poll })`, read once by `calendar-view`; the read dialog closes before navigating (like `editResume()` in `scenario-read-dialog.ts`).
- Server decides permissions: use `seance.can.choose`, never deduce from role.
- `scenario-read-dialog` does not load the members list: players only ever see counts, never names. The members list (`partiesService.members`) excludes the GM (known debt from Story 36.6).
- Vitest conventions: pure functions tested without TestBed; the web app is zoneless (no zone.js).

## UX & Interaction Patterns

- Sheet order for players (⚠️ amends the PRD): chapter title and badge → séances → description and durations → (past chapter) end summary, journal, retrospective notes → announcements → participants. A restricted "upcoming" chapter keeps its note in place of badge and description, séances right after the title. The GM sheet keeps its own order.
- Inside a séance: header (title, state badge, delete) → situation box when an action is expected, otherwise the "Ma situation" line alone → date, vote or registration → practical info → report.
- Situation box: compact version of the event dialog situation panel (`.ed__situation`), 10px radius, 1.5px border (`--jdr-status-todo` player, `--jdr-accent-1` GM), 8% tint background; no `role="status"`; disabled during `pollActionPending`.
- Vote is cast in the Destinée only; the sheet shows a text summary (best slot, answer counts, deadline) and one action per situation.

## Cross-Story Dependencies

- 54.1 builds on 53.3 (the "Ma situation" line on each séance) and keeps the GM's `app-poll-status` list and "Clôturer le vote" in place until 54.3.
- 54.2 builds on 54.1's box; it introduces `pollRankableOptions` / `pollAnswerCounts` and removes `features/poll/poll-response/`.
- 54.3 builds on 54.1 and 54.2: adds `fixer_la_date` to the box, the GM summary lines, reuses `SealConfirmDialog` and removes `features/poll/poll-status/`; it is the last story of Palier 10.8 and ends with the reminders (plan mode, `/security-review`, `/code-review`, dependency PRs).
- `seance-list.html/.ts/.spec.ts` and `scenario-read-dialog` are touched by several stories: keep layers additive, avoid moving the 53.3 line twice.
