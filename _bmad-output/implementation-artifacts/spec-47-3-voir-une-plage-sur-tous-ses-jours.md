---
Pass 1 — three layers (Blind Hunter, Edge Case Hunter, Verification Gap). No intent_gap, no bad_spec, so no loopback. Patches applied directly in-session; web tests re-run afterwards (only the 2 known date-frozen failures remain).

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | `CalendarView.seanceCoveredCells` still used the single-slot rule, so a selection on day 2+ of a range was not flagged as an exception while the grid drew it as a seance; the spec forbade a second covering rule (VG, EC, EC claim) | medium | patch (done) | Real: line `e.date === key && entryCoversSlot(...)`. Now `entryCoversCell`; test with a range whose first day is not the selected cell. |
| 2 | The `spanEndOf` wiring in `CalendarView` (personal and party branches) was covered by no test; every range spec fed hand-made entries (VG) | medium | patch (done) | Real: removing the field read broke nothing. A personal-calendar test checks the range entry carries `endDate`/`endSlot` and a single-slot one carries none. The party branch shares the same helper and the same one-line spread; not duplicated. |
| 3 | `isSpan` had no ordering check, so a reversed range (end before start, or same day with an earlier end slot) drew a span; the spec's "guard end >= start" did not exist (EC, EC claim, BH) | medium | patch (done) | Real. `isSpan` now refuses an end before the start and a same-day end slot not after the start slot; tests added. |
| 4 | `isSpan` read a missing end slot as the start slot while `entryIndexRange` read it as end of day (EC, BH) | low | patch (done) | Real mismatch between label and coverage. `entryIndexRange` now reads a same-day missing end slot as the start slot too; test added. |
| 5 | Start slot `undefined`/`null` vs `FULL_DAY`, and a possibly un-normalised start date in the personal branch, could make a single day a span (BH) | low | patch (done) | `isSpan` treats a missing slot as the whole day; `spanEndOf` normalises both dates to the day key; test added. |
| 6 | Week continuation cells lost the `has-event` style because their text is silenced (BH, EC) | low | patch (done) | Real: the class followed the visible title. It now also follows the presence of a span; test added. |
| 7 | The event card's "past" badge (`isPastEvent`) still used the start day (BH) | medium | patch (done) | Real: contradicted the server rule of 47.2 and the card date written to the end. Now the end; test added. The card's imminence badge and the Agenda's day-distance badge stay on the start (see #19). |
| 8 | "dimanche 1 novembre" instead of "1er novembre" (BH) | low | patch (done) | One-line fix in `spanSentence`; test updated. |
| 9 | New imports sat above the Angular imports in two files (BH) | low | patch (done) | Moved. |
| 10 | `isSpan` is a type guard that narrows the false branch (BH) | low | rejected | The false branch cannot use `end` as a span: the compiler refuses it, so no silent bug. |
| 11 | The vote-span path (`spanOf(poll, …)`, vote connector colour) is not exercised (BH) | low | rejected | Planned groundwork for 47.5 (vote ranges); the spec names it. Removing it now would be redone next story. |
| 12 | The timeline writes the range by its own comparison and a loose regex tests it (BH, EC) | low | rejected | It shows days only by design (a same-day multi-slot seance is one date); a negative test (end same day → no arrow) now backs the rule. |
| 13 | Every covered cell repeats the whole range in its accessible name; "→" is read aloud (BH) | low | rejected | The repetition is the spec ("every covered band has the full accessible name"); the arrow in a text line is read as a word, which is acceptable. |
| 14 | Month, Week and rail could build the seance name from different sources (BH) | low | rejected | All three read the same `DaySlotDetail`; no divergence shown. |
| 15 | Connector CSS duplicated between Month and Week; no RTL or forced-colors rule; literal colour fallbacks (BH) | low | rejected | Cosmetic; the existing band SCSS has the same literal fallbacks and no RTL support anywhere in the app. |
| 16 | Per-cell recomputation, non-null assertions, `isStart` only used by a test, `nameSpansOncePerRow` exported for tests (BH) | low | rejected | 42 cells × few entries; matches the surrounding style. |
| 17 | Agenda ordering and grouping key on the start date only (BH) | low | rejected | A range is one line in the section of its start; no defect shown. |
| 18 | A slot-less start with an end slot gives an odd card label (EC) | low | rejected | Unreachable: a slot-less start keeps its end equal to the start (47.1). |
| 19 | Card imminence badge, Agenda day-distance badge and countdown still count from the start day (BH) | low | defer | Cosmetic wording of how soon a started range is ("hier"); the "past" rules are fixed. |

title: 'Voir une plage sur tous ses jours (story 47.3)'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: 'e41e52dcc39288630b9569e3ba6d3a59c14db097'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-47-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-47-2-etre-occupe-sur-toute-la-plage-dun-rendez-vous.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/mockups/options-plages-longues.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since 47.2 the server serves the end of a multi-slot rendez-vous, but the web still draws it on its start slot only: a weekend looks like one band, and the Agenda, the rail, the scenario sheet and the event window show a single date.

**Approach:** Carry the end on the calendar entry and let the one projection that feeds Month, Week and the rail (`buildDayDetail`) mark every covered slot with the existing seance treatment, joined by small connectors and named once per week row (planche option 2A). The Agenda, the rail, the scenario sheet, the event window and the party widgets write the range from start to end.

## Boundaries & Constraints

**Always:**
- Reuse the existing band markings: a covered slot of a confirmed seance takes the `seance` rank treatment, a covered slot of a vote (future 47.5) the `vote` one. **No new tint.** Mine/others' precedence, layer rules (a layer switched off removes the name and the connectors, never the unavailability) and the party filter stay as they are.
- A `connector` is a 5 px triangle between the last band of a day and the first band of the next day it continues into, Sunday → Monday included (it never relies on the grid gap). The name is written on the first visible covered band of **each week row**, prefixed "← " when the range started before that row. A one-slot entry has no connector and its text is unchanged.
- Every covered band has the full accessible name "Week-end jeux, du vendredi 6 soir au dimanche 8 après-midi" (month omitted when both ends share it); arrows and tints never carry information alone.
- One calendar entry per rendez-vous: the Agenda shows **one** line "ven. 6 nov. soir → dim. 8 nov. après-midi"; the rail shows the range on each covered day, with "(suite)" after the first day.
- A range is "past" in the Agenda sections when its **end** is before today (a started range stays upcoming). Days of a range are not dimmed in Destinée mode by the range itself.
- French comments and texts; existing one-slot tests keep their expectations; no dependency install; Docker only.

**Never:**
- No composer preview or duration work (47.4), no vote ranges, no vote-answer picker change, no fix-date confirmation change (47.5), no automaton change (47.6).
- No server change: the DTOs already carry `endDate`/`endSlot` (47.2).
- Do not duplicate the precedence or the covering rules outside `day-detail.utils.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Weekend range | Seance Fri EVENING → Sun AFTERNOON | Month/Week: Fri evening; Sat 3 slots; Sun morning + afternoon marked as seance; Sun evening free; connectors Fri-evening→Sat-morning, Sat-evening→Sun-morning | N/A |
| Name once per row | Same range across two week rows | name on the first covered band of each row; "← " on the continuation row | N/A |
| Sunday → Monday | Range from Sun EVENING to Mon AFTERNOON | connector on Sun evening (row end) and Mon morning; Monday's name starts with "← " | N/A |
| One slot | Seance of 1 slot | exactly today's band, no connector, no range text | N/A |
| Layer off | `mes-seances` off | bands stay unavailable/seance-ranked, no name, no connector | N/A |
| Rail | Click Sat | three slots listed with "Week-end jeux (suite)" and the range | N/A |
| Agenda | Same range | one line "ven. 6 nov. soir → dim. 8 nov. après-midi" in the section of its start; "passé" only after its end | N/A |
| Sheet / event / list | Dated range | start → end written (scenario sheet, event card and window) | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/calendar/calendar-agenda-view/calendar-agenda-view.ts:56` -- `AgendaEntry`; add optional `endDate`/`endSlot`; `metaLine()` and `sectionIdFor()` (past by end).
- `apps/web/src/app/features/calendar/calendar-view/calendar-view.ts:730` -- `allCalendarEntries()`: feed `endDate/endSlot` from `MyCalendarSeanceEntry` (personal) and `SeanceDto` (party context, guard `end >= start`).
- `apps/web/src/app/features/calendar/day-detail.utils.ts` -- the single projection: `buildDayDetail` (`sameDay` filter, `entryCoversSlot`), `DaySlotDetail`; add `entryCoversCell(entry, dateKey, slot)`, `span` info on the slot detail, "(suite)" label rule.
- `apps/web/src/app/features/calendar/calendar-month-view/calendar-month-view.{ts,html,scss}` -- `buildMonth` (per-row naming pass), `DayBand`, `bandAriaLabel`, connector styles in the band SCSS (`_band-ranks.scss` for the shared treatment, connectors beside it).
- `apps/web/src/app/features/calendar/calendar-week-view/calendar-week-view.{ts,html,scss}` -- same detail via `weekDetails`; name once per week, connectors, aria.
- `apps/web/src/app/features/calendar/calendar-detail-rail/calendar-detail-rail.{ts,html}` -- range + "(suite)".
- New `apps/web/src/app/features/calendar/span-label.ts` (+ spec) -- pure formatters: short "ven. 6 nov. soir → …", sentence "du vendredi 6 soir au dimanche 8 après-midi"; reuse `SLOT_LABELS` (`agenda-badge.utils.ts`) and `shortDayLabel`.
- Surfaces: `features/events/event-card.util.ts:170` (`eventDateLabel`, used by card and window), `features/scenarios/seance-list/seance-list.ts` (`formatSeanceDate`) and `scenario-timeline.ts`, `core/status/status-derivation.ts` (already end-aware).
- Reuse, do not change: `entryCoversSlot`, `SLOT_PRECEDENCE`, `SlotWinner`, `composeSeanceInfo`; `spanSlots`/`spanEnd` in `@master-jdr/shared` for unfolding.

## Tasks & Acceptance

**Execution:**
- [x] `span-label.ts` + spec -- short and sentence formatters, month shown only when it differs
- [x] `day-detail.utils.ts` -- `entryCoversCell`, `span` info (first/last, continuesBefore/After, key, label, range), "(suite)" rule; unit tests incl. week/month boundaries
- [x] `calendar-agenda-view` + `calendar-view` -- entry end fields, one-line meta, past by end
- [x] Month and Week views -- seance marking of covered slots, connectors, name once per row with "←", full accessible names, styles
- [x] Rail -- range line and "(suite)"
- [x] Event card/window, scenario sheet and timeline -- start → end when the end differs
- [x] Tests -- every matrix row; fixtures scripted; ⚠️ flag the changed validated screens (Month, Week, Agenda, rail, scenario sheet, event window)

**Acceptance Criteria:**
- Given a one-slot seance, when any view draws it, then output and tests equal today's.
- Given the web tests and the API checks, then they stay green but the known date-frozen tests; `graphify update .` run.

## Implementation Notes

- Implementation done directly in the session (no implementation subagent), from the spec. Web only: no server, schema or shared change (the DTOs already carry `endDate`/`endSlot` since 47.2).
- `calendar/span-label.ts` (+ `span-range.spec.ts`): pure `isSpan`, `spanShortLabel` ("ven. 6 nov. soir → dim. 8 nov. après-midi"), `spanSentence` ("du vendredi 6 soir au dimanche 8 après-midi", month only when it differs) and the neutral word `SPAN_CONTINUED` ("(suite)"). Like the duration words of 47.1 it stays out of the tone registry (the own-vocabulary guard of `theme-tone.service.spec.ts`). The module imports nothing from `events/` (no cycle).
- `AgendaEntry.endDate/endSlot` are set by `CalendarView` only for a real span (`spanEndOf` returns `{}` for a single slot), so single-slot entries — and every test comparing them — are unchanged.
- `day-detail.utils.ts` stays the one projection: `entryIndexRange` (linear rank `day*3 + slot`), `entryCoversCell`, `entryTouchesDay`, and `DaySlotDetail.span` (`SlotSpan`: key, label, range, shortRange, isStart, isFirstDay, continuesBefore/After, index/startIndex). The span follows the winning rank and the layer rules, like the text.
- Month: `nameSpansOncePerRow()` writes the name on the first covered band of each week row, "← " when it is not the start; `bandAriaLabel` always says "label, range" for a span band. Connectors are `band--span-next/prev` (5 px triangle inside the band, so the grid gap and Sunday → Monday need nothing). Week: `firstSpanIndex` names the first visible cell of the week, `slot-cell--span-next/prev` carry the same triangle at the cell edge (in Week the evening and the next morning are not neighbours, so the triangle only marks continuity). Rail: "(suite) · range" line and the range in the open-scenario label. Agenda: one line "début → fin", "scheduled" until the END (`sectionIdFor`). Event card/window (`eventDateLabel`), scenario sheet (`formatSeanceDate`) and timeline node date write the range.
- Decisions: the range text of the card is "Ven. 6 nov. soir → dim. 8 nov. après-midi" style (short label, capitalised); the timeline shows days only ("6 nov. → 8 nov."); no change to the seal dialog, vote picker or composer.
- ⚠️ Validated screens changed: Month and Week grids, Agenda, detail rail, scenario sheet ("Date retenue"), scenario timeline card, event card and window.
- Tests: new `span-range.spec.ts`; blocks added to the Month, Week, Agenda, rail, event-card-util, seance-list and scenario-timeline specs. Web 4050+ OK except the 2 known date-frozen tests in `calendar-view.spec.ts`. Not seen in a browser (connectors and names are unchecked visually).

## Spec Change Log

## Review Triage Log

## Design Notes

Covering test on a linear index: `idx(date, slot) = dayNumber * 3 + {MORNING:0, AFTERNOON:1, EVENING:2}`; a range covers a cell when `idx(start) <= idx(cell) <= idx(end)`, a `FULL_DAY` start or cell covers its three slots. The connector after a band exists when the next index is also covered and falls on another day (`EVENING → MORNING`); before a band when the previous index is covered on another day.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- expected: all pass but the 2 known date-frozen tests
- `docker compose exec api pnpm typecheck` -- expected: no errors (no server change)

**Manual checks (if no CLI):**
- Month/Week with a 6-slot weekend: bands, connectors, names, then Agenda, rail, scenario sheet, event window.
