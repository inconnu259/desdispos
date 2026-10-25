---
title: 'Story 44.8 — Filtrer mon calendrier personnel par partie'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: '294a9334741f7297655423abe6a13df67216429f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-44-context.md'
  - '{project-root}/docs/security.md'
  - '{project-root}/docs/checklist.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The personal calendar mixes the séances, votes and registrations of every party and group of the reader. With several parties there is no way to look at one or two of them.

**Approach:** The « Affichage » panel of the personal calendar gets a section listing the reader's active parties as checkboxes, all checked. Unchecking one hides its séances, votes and registrations from the grid and the Agenda; availabilities stay. The summary pill announces the filter and restores it. The filter is a page signal: not persisted, not a layer.

## Boundaries & Constraints

**Always:**
- Personal calendar only (`partieId() === null`); the atelier calendars are unchanged. Parties = `MyPartiesService.allParties()` filtered by `isPartieActive(status)`, listed by name (alphabetical), JDR and groups together. The section appears only with at least two active parties (a filter on one is meaningless).
- The filter applies **downstream of `allCalendarEntries()`**, never inside it: `agendaEntries()` drops the entries of hidden parties (`mes-seances`, `votes-en-cours`, `inscriptions-ouvertes`; party read from `partieId` or `vote.partieId`); `buildDayDetail`/`buildMonthDetails`/`buildMonth` and the month and week views take an optional `hiddenPartieIds` — a hidden party's vote vanishes from its slot, and a hidden party's séance stays an **unnamed** unavailability (FR-50, same as a layer turned off). Rail, Destinée dimming, ✦ list and chip, board and drawer, `nextMeaningfulDate` and declarations stay complete.
- Entering a Destinée on a hidden party (list, link, `?poll`) re-checks that party (and `votes-en-cours` is lit, as today).
- The summary pill shows whenever the display differs from the default: layers (existing text), parties (`Affichage filtré · {k} sur {n}`), or both (both counts, one pill). Touching it, or « Rétablir » in the panel, restores layers **and** parties.
- State is a `signal` of the page: reset on any change of calendar identity and on reload; never in `activeLayers`, `CALENDAR_LAYER_KEYS`, `sessionLayers` or the account.
- Section title per theme (« Seulement ces rendez-vous » / « Seulement ceux-ci » / « Restreindre à »); checkboxes are real inputs with 44 px targets; no voter identity; French comments; no dependency; Docker only.

**Never:**
- No change to `/me/calendar` or `/me/open-polls`, no new route, no persistence, no filter in the atelier, no change to the ✦ list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | 3 active parties | section with 3 checked boxes, no pill | N/A |
| Uncheck one | party B | B's séances, votes, registrations gone from grid and Agenda; dispos stay; pill « … 2 sur 3 » | N/A |
| Hidden séance slot | B had a séance | slot still unavailable, unnamed | N/A |
| Rail and ✦ | B unchecked | rail, list, chip, board still full | N/A |
| Enter Destinée on B | B unchecked | B re-checked, votes layer on | N/A |
| Layers and parties | both changed | one pill with both counts; reset restores both | N/A |
| One active party | 1 party | no section | N/A |
| Atelier | `/parties/:id/…` | no section, no filter | N/A |
| Reload | any | filter gone | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/day-detail.utils.ts` -- `buildDayDetail` / `buildMonthDetails` gain a trailing optional `hiddenPartieIds`; add an exported `entryPartieId(e)`; hidden polls are dropped before choosing `poll`, a hidden séance still sets `status`/`winner` but is never `seanceNamed`, `(+1 autre)` counts visible ones.
- `apps/web/src/app/features/calendar/calendar-month-view/calendar-month-view.ts`, `calendar-week-view/calendar-week-view.ts` -- `hiddenPartieIds` input passed to `buildMonth` / `buildMonthDetails`.
- `apps/web/src/app/features/calendar/calendar-display-panel/calendar-display-panel.{ts,html,scss}` -- inputs `parties`, `hiddenPartieIds`; output `partieToggled`; the section after the layers.
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.{ts,html}` -- `MyPartiesService`; `filterParties` (active parties by name), `hiddenPartieIds` signal, `togglePartie`; extend `agendaEntries`, `isOverridden`, `layerSummaryLabel`, `resetToDefault`; pass the set to month/week and both panel instances; `enterDestiny` re-checks; `loadForPartieId` resets.
- `apps/web/src/app/core/theme/tones/*.ts` + `theme-tone.service.spec.ts` -- `calendar.display.section_parties` (3 voices), `calendar.display.filtered_badge_parties` (voiced like `filtered_badge`).
- Reuse: `isPartieActive`, `CalendarLayerToggle` patterns, `calendar.display.filtered_badge`.
- Specs: `day-detail.utils.spec.ts`, panel spec (new), month/week specs only if signatures break, `calendar-view.spec.ts` (new block), tone spec.

## Tasks & Acceptance

**Execution:**
- [x] tones (3 themes) + tone spec -- section title and party pill -- UX-DR13/14
- [x] `day-detail.utils.ts` + spec -- hidden-party rule: votes vanish, séances unnamed but blocking -- FR-50
- [x] month and week views -- pass-through input
- [x] display panel -- party checkboxes -- FR15
- [x] `calendar-view.*` -- state, filtering of the Agenda, pill, reset, Destinée re-check, reset on identity change
- [x] Tests: every matrix row; filter absent from `activeLayers` and session memory; rail/list/chip untouched

**Acceptance Criteria:**
- Given three active parties on my personal calendar, when I uncheck one in « Affichage », then its séances, votes and registrations leave the grid and the Agenda, the pill reads « Affichage filtré · 2 sur 3 », and touching the pill brings everything back.
- Given a party unchecked, when I choose one of its votes in the ✦ list, then the party is checked again and the Destinée opens on that vote.
- Given I reload the page, then no party is hidden.

## Implementation Notes

- Implemented directly in this session (no subagent without an explicit request); the review layers were replaced by one inline self-review of the diff.
- `day-detail.utils.ts`: `entryPartieId`, and a trailing optional `hiddenPartieIds` on `buildDayDetail` / `buildMonthDetails`. A hidden party's votes are dropped before the slot's poll is chosen; its séance is still the `blockingSeance` (status `UNAVAILABLE`, winner `seance`) but is never named, and a visible séance of the same slot is preferred for the label. `buildMonth` and the week view pass the set through (new `hiddenPartieIds` input on both views).
- `calendar-view`: `MyPartiesService` injected; `hiddenPartieIds` signal, `filterParties` (active parties by name, only from two), `hiddenPartieCount`, `hiddenForViews` (`null` without an active filter), `togglePartie`; `isOverridden` is now layers OR parties (`layersOverridden` keeps the old test); `agendaEntries` drops hidden parties; `resetToDefault` clears the filter; `enterDestiny` re-checks the party of the chosen vote; `loadForPartieId` clears it.
- Pill: the existing `calendar.display.filtered_badge` template is reused for all three cases by replacing its `{n} sur {total}` — layers (« 3 sur 4 »), parties (« 2 sur 3 »), or both (« 3 sur 4 · 2 sur 3 ») — so no new badge key was needed (the spec planned `filtered_badge_parties`; dropped). One tone key added: `calendar.display.section_parties` (three voices).
- Panel: `parties` / `hiddenPartieIds` inputs, `partieToggled` output, a `fieldset` of real checkboxes (44 px rows).
- Tests: web suite passes except the 3 known date-dependent failures; `tsc` (app and spec) only TS6059 noise. Remaining eslint findings in `calendar-view.ts` (797, 2097, 2609) are on lines this story did not touch.
- Visual check 2026-10-25 (Chrome, real account, Atelier Cuivré, desktop): 8 active parties listed under « Restreindre à »; unchecking 3 took the Agenda from 6 entries to 2 while the full list stayed 6, the grid kept the hidden parties' séances as unnamed unavailable bands, the pill read « Affichage filtré · 5 sur 8 · Rétablir »; choosing a hidden party's vote in the ✦ list re-checked it (6 sur 8); the pill restored everything. Not exercised: phone width, the other two themes, the week view in a browser.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Hiding a party must not lift the unavailability its séance causes | medium | would break FR-50 and the story's « indisponibilités restent »; `blockingSeance` keeps status and rank, tested in `day-detail` and in the month view |
| 2 | A hidden party id kept in the set after the party ended would count in the pill | low | `hiddenPartieCount` counts only parties of the listed set; no stale count |
| 3 | The filter could leak into an atelier calendar or a reload | false | reset in `loadForPartieId`, `filterParties` empty off the personal calendar; tested |
| 4 | Combining counts by string replacement depends on the badge template | low | the three themes share `{n} sur {total}` (tested through the Grimoire text and checked live in Cuivré) |
| 5 | The filter reaches the Destinée / ✦ list | false | they read the unfiltered lists; asserted in the spec |
| 6 | `isOverridden` now also reads parties, changing a computed other specs know | false | the layer part is `layersOverridden`, unchanged; existing 36.14 specs green |
| 7 | Remaining eslint/prettier findings in `calendar-view.ts` | false | predate this story (same lines as before) |
| 8 | `calendar-display-panel.spec.ts` was overwritten by the first commit, erasing its 8 existing tests | high | seen in the commit's file list (`M`, 82 deletions); restored from the previous commit with the 3 new tests appended (11 pass) in a follow-up commit |

## Design Notes

Decided without the human: the section shows from two active parties up; a hidden party's séance keeps blocking its slot unnamed (the rule of a layer turned off) rather than disappearing, since FR-50 and the story's own « indisponibilités restent » ask for it; with layers and parties both changed, one pill carries both counts rather than two pills.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: pass (3 known date-dependent failures excepted)
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.app.json` -- expected: no new error (TS6059 excepted)

**Manual checks (if no CLI):**
- Personal calendar with two or more parties, three themes, desktop and phone: uncheck, pill, reset, enter a Destinée on a hidden party.
