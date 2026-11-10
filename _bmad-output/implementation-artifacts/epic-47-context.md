# Epic 47 Context: Des rendez-vous sur plusieurs créneaux

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A game day or a games weekend is proposed, voted, fixed and displayed as a span of consecutive slots. The duration is declared when creating an event/session, set with a counter in the composer, previewed as a full span, shown as linked bands everywhere, makes participants unavailable across the whole span, and drives the scheduling automaton to windows of the right length. The duration stays correctable at any time. This epic touches the core of dates (span readers, e-mails, "past"), hence it ships last in the palier.

## Stories

- Story 47.1: Donner une durée à un rendez-vous
- Story 47.2: Être occupé sur toute la plage d'un rendez-vous
- Story 47.3: Voir une plage sur tous ses jours
- Story 47.4: Proposer des plages dans le composer
- Story 47.5: Voter et fixer une plage
- Story 47.6: Faire chercher à l'automate des fenêtres de la bonne durée

## Requirements & Constraints

- One duration per rendez-vous (`Seance`), in consecutive slots, 1 by default, 15 days max (45 slots; message "15 jours au plus : au-delà, créez deux rendez-vous."). Whole-day (`FULL_DAY`) only at duration 1.
- Duration is declared at creation (event in evening mode, session in JDR; dated or to-date) and corrected any time (composer before the date, event window or session editor after). The span grows or shrinks for everyone. Editing another field never changes the duration.
- A span displays on every day it covers (Month, Week, Agenda, rail, board, drawer); long fixed dates show as a span in the scenario sheet, event window, party list, fix-date confirmation; "date fixed", reminder and relance e-mails give the span; the reminder leaves the day before the start.
- A long fixed date makes its participants unavailable on every covered slot (evening → next morning included); a long candidate shows its worst availability over the span; overlap between rendez-vous is shown, never refused; a rendez-vous is "past" only once its end is past.
- JDR must not regress outside listed screens; existing one-slot test expectations do not change. Every right checked server-side with a refusal test (`docs/security.md`); inputs bounded. Every changed validated screen is flagged ⚠️ in the story. French comments/errors; no dependency install; Docker only; CI green per story. Real-time per `docs/checklist.md`.

## Technical Decisions

- `Seance.durationSlots Int @default(1)`; only `events/` writes `durationSlots`, `endDate`, `endSlot` (source test on the model of `layer-imports.spec.ts`). `PollOption` stays a start only; options of one poll may overlap; uniqueness = start (`date|slot`).
- `spanEnd()` / `spanSlots()` are the single pure functions in `@master-jdr/shared` (chain `MORNING → AFTERNOON → EVENING → next MORNING`; `FULL_DAY` expanded to three slots). `bestOption(options, today)` also single in shared.
- Input DTOs: absent `durationSlots` = unchanged on update (even `PATCH` of an event, despite its full replacement), 1 only on creation. Output DTOs describing a seance (`SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry`, `DatableSeance`) require `durationSlots` and carry start/end read from the `Seance`, never from `poll.chosenDate`.
- A dated seance always satisfies `end = spanEnd(start, durationSlots)`, maintained by one `events/` function used by every span writer; no write defaults `end = start`. Correcting duration on a dated seance recomputes the end, clears `reminderSentAt` if start not past, recomputes `nextSessionDate`, emits `partie:{id}` + `notifyPartieSignalsChanged`, sends no e-mail.
- Write order (one transaction): lock party → lock event → `setDurationInTx` (via `RendezVousDurationPort` in `poll/ports/`, bound in `PortsModule`, added to `layer-imports.spec.ts`) → `setOptionsInTx(tx, pollId, {options, expiresAt, bounds}, {purge: changed})`. `purge` comes only from `setDurationInTx`'s return; a changed duration recreates options and votes and clears `relanceSentAt`. JDR poll creation becomes atomic (duration + poll + `Seance.pollId`). `chooseDate` (`SeanceDatePort`, signature unchanged) writes the full span, relocks and rereads in its transaction, vanished option → 404.
- `OccupiedSpan` becomes a span unfolded slot by slot by `events/` via `spanSlots`; unavailability, heatmap and automaton inherit. Period filters test overlap; "past" = end before today everywhere.
- `GET /parties/:id/available-slots?span=N` keeps the current ranking applied to each member's worst status over `spanSlots`; each window carries `durationSlots`; exclusion and hiding compare start and duration. A window only joins a poll of the same duration.
- Front: one pure function in `features/calendar/` for the loss warning (all answers if duration differs, else those of removed options), used by the dialog and the pre-write recheck; one for the worst availability of a long option. `durationSlots` at the root of `SessionPollDto`, `EventPollDto`, `OpenPoll` (a poll without seance = 1). Conjunction draft (40.5b) carries duration both ways. One option = one agenda entry with start and end.

## UX & Interaction Patterns

- `DurationStepper`: three-segment pill "− n créneaux +", `{colors.outline}` border, ± in `{colors.accent-1}` greyed at bounds (1, cap), 44 px targets, "Raccourcir" / "Allonger", `aria-live` announcement of value and span; same component in composer, event window, session editor. Span written in clear when the date is set ("sam. 14 après-midi → sam. 14 soir"), else "soit N jours" from 3 slots.
- Composer: Durée row always initialised to the target's `Seance.durationSlots`; each chosen slot is a start; touching/hovering a start lights the existing preview state on its whole span; touching a designated start removes the span; touching another band sets a new start. With duration > 1, "Journée" disappears and an already-set whole-day cell is removed with a message; in Month view, touching a whole cell switches to Week.
- `SpanBands`: covered bands take the nature's existing marking (vote: `status-todo` 16 % fill + 3 px edge; session: existing treatment), no new tint; `connector` 5 px triangle between days incl. Sunday → Monday; name on first visible band per week row ("←" if started before); "×{n}" 9 px corner if several spans of one vote overlap a slot; Agenda one line "départ → fin"; rail every covered day, "(suite)" after the first; full accessible name per band; arrows never carry information alone. No estompe on a poll's days in Destinée.
- Voting on a covered slot opens the answer picker with one line per span, current first; voting always names the option explicitly. Board, drawer, scenario-sheet vote list and fix-date confirmation write each candidate start → end; folded drawer: "n / N · {départ} → {fin} · x oui · fin du vote …"; announcement "Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui".

## Cross-Story Dependencies

- Chain 47.1 → 47.2 → 47.3 → 47.4 → 47.5 → 47.6, each requiring the previous delivered; builds on epics 44 (Destinée, board, `can`, `?poll`), 45 (composer, `?seanceId`, deadline field, confirm dialog) and 46 (automaton windows, `?span` kept at 1 until 47.6).
- 47.5 closes UJ-5 (weekend: propose three Fridays, vote, fix the second, reminder Thursday); 47.6 closes UJ-6 (set duration, automaton recomputes, add three windows shown as spans, validate).
