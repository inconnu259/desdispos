# Epic 46 Context: Les éphémérides au service du vote

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The GM turns the windows computed by the scheduling automaton into candidate vote slots in a few gestures: select a window, add it to the vote through the composer, or hide it (hiding follows the GM across devices). The window list becomes collapsible and every right-hand column can be docked to the edge, giving the calendar its width back. The word "destinée" now names only the mode, so the automaton windows are renamed.

## Stories

- Story 46.1: Ranger la colonne de droite et replier les éphémérides
- Story 46.2: Mettre une fenêtre de l'automate en évidence
- Story 46.3: Ajouter une fenêtre au vote
- Story 46.4: Masquer une fenêtre de l'automate

## Requirements & Constraints

- Right-hand column (GM, player, group, destiny board): on ≥ 768 px an arrow docks it into a 44 px edge `side-dock` showing label + counter vertically; below 768 px the automaton list folds vertically. Du / Au / Scruter fields only visible when open/unfolded. State is per-browser, never in the database.
- Automaton windows are GM-only (players keep their aggregated view unchanged). Selecting one highlights it, dims the rest, moves the grid to its period; one at a time; "Ajouter au vote" always goes through the composer (cumulative additions, one validation, one warning); a window of another duration than the rendez-vous is not added (message); a window leaves the list while in the composer or candidate of an open poll of the party, and returns if removed and still free.
- Hiding: invisible to players and to availability; survives reload, new login, other devices; hidden ones can be shown and unhidden.
- Labels per theme: "Éphémérides" (Grimoire, provisional), "Clairières disponibles" (Forêt), "Créneaux calculés par l'automate" (Atelier); no JDR word or "partie" in evening mode.
- JDR must not regress outside listed screens. Every right checked server-side with a refusal test (`docs/security.md`); inputs bounded. Every changed validated screen is flagged ⚠️ in the story with what changes. French comments/errors; no dependency install; Docker only; CI green per story. Real-time per `docs/checklist.md`.

## Technical Decisions

- Mode priority is single: composer > selected window > Destinée. Arming the composer suspends Destinée (`?poll` kept); validation reactivates it on the created/edited poll; cancel restores the previous state. The selected window is an ephemeral signal, never a layer. With the composer open, selecting a card outlines it without dimming other days. During Destinée the GM column keeps a folded footer header "Éphémérides · N"; unfolding and touching a card suspends Destinée, deselecting restores it.
- One pure function in `features/calendar/` computes displayed windows (served windows minus composer cells). `?span` = composer duration field value, 1 outside the composer (duration arrives in epic 47; stays 1 here).
- `isComposableSeance()` (in `@master-jdr/shared`) defines the rendez-vous choice list: to-date seances or seances with an open poll (composer prefilled); the picker is skipped when only one choice. Composer targets the active destiny if it is an open poll of this party the GM can modify (`can.edit`).
- `GET /parties/:id/available-slots`: in the GM nominative view only, exclude (before the cap of 20) windows matching (same start, same duration) an option of an open poll of the party; then exclude hidden ones, returned apart marked `hidden`; each window carries `durationSlots`; past-dated hidden rows ignored on read.
- Hiding model: `SlotWindowHidden(userId, partieId, date @db.Date, startSlot, durationSlots)`, unique on the five columns with a short `map:` index name, written only by `parties/`, `onDelete: Cascade` on user and party; `PUT/DELETE parties/:id/available-slots/hidden`; key copied from the served window, never from a page parameter; new action `SLOT_WINDOW_HIDE` (`OWNER_ONLY` JDR, `NOBODY` rallying); validated body (`DaySlot`, non-past date, `durationSlots` ≥ 1 ≤ shared cap, French 400). One migration per story introducing a table (`pnpm exec prisma` in the container).
- Dock/fold state: one `localStorage` key for all columns, read/write under `try/catch`, open by default, reopened on entering Destinée. Buttons "Ranger la colonne" / "Rouvrir la colonne" with `aria-expanded`; focus returns to ‹ on docking.
- Real-time: atelier reloads `available-slots` on `partie:{id}` and, for the GM, on `user:{id}`; hiding emits the GM's `user:{id}` only.

## UX & Interaction Patterns

- Card states: rest · selected (2 px `{colors.accent-1}` outline; actions "Ajouter au vote" filled, "Masquer" text; other days dimmed .28 except with composer open) · in composer (leaves list, dashed outline on grid) · hidden (55 % opacity, "Démasquer"). Footer link "Afficher les N masquées".
- `SideDock`: 44 px, 12 px left corners, sticky. Estompe never removes pointer or accessibility; focused day stays crisp; `Échap` or re-touch deselects; 44 px targets; no long-press-only feature.

## Cross-Story Dependencies

- Chain 46.1 → 46.2 → 46.3 → 46.4. Requires epic 45 delivered (composer, `?seanceId` arming, picker, `deadline-field`, `ComposeConfirmDialog`) and epic 44 (Destinée state/board, `can`, `?poll`, `partieStatus`).
- Epic 47 later adds duration to composer and automaton (`?span`).
