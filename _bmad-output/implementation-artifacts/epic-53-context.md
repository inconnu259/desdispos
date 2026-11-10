# Epic 53 Context: The JDR party page — my situation, the sequence of sessions, the cover

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Opening a JDR party lands on the sequence of sessions, and a member sees at a glance their own situation on every session; the GM, host or admin changes the cover from the Détails tab. One single "Ma situation" computation and one single pill component serve the whole app (evening events included), party tabs are addressed by key instead of index, and the server tells the web who may change the cover. Epics 51 and 52 are delivered: every icon goes through `<app-icon>`, no `<mat-icon>` may enter the code.

## Stories

- Story 53.1: "Ma situation" computed in one place; "Prochaine séance" widget keeps the vote call
- Story 53.2: One "Ma situation" pill for evenings and JDR alike
- Story 53.3: "Ma situation" on chapters and sessions
- Story 53.4: A party opens on the sequence of its sessions
- Story 53.5: The server says who can change the cover; upload through one unit
- Story 53.6: Change the cover from the Détails tab

## Requirements & Constraints

- Every new text is a key in all three tone files (`apps/web/src/app/core/theme/tones/`), "tu" in the Forest tone. Pill keys are `situation.<snake_case value>`, identical across themes, written with the typographic apostrophe `’` ("J’ai voté", "J’y étais"); `situation.ma_situation` is the row label, not a situation value. All join the intentionally-identical list in `core/theme/theme-tone.service.spec.ts`; a removed key is removed from the three files and their tests.
- Colors only through existing `--jdr-*` variables (`accent-1`, `text-muted`, `status-todo`, `status-live`, `status-done`); no new token. A pill always carries its text; color is never alone. Any change to a validated screen is flagged with a warning sign in review.
- Realtime: no new channel; pills and cover follow the existing `partie:{id}`. Each story adding a party-scoped display records its evaluation per `docs/checklist.md`.
- Out of scope, do not touch: the Agenda badge `calendar.agenda.badge_answer_poll` (`calendar-agenda-view.ts`); dashboard urgency sort and `GET /me/party-signals` (they do not read `seanceState`).
- Phone and desktop on equal footing; actions keyboard reachable. CI green; run `docker compose exec api pnpm typecheck` after any signature or shared-type change (ts-jest does not type-check across files).

## Technical Decisions

- `seanceSituation(seance, viewerId, isMj, todayKey)` and `nextSeanceOf(scenario, todayKey)` live in `core/status/status-derivation.ts` next to `seanceState`: pure (no clock, no Angular), taking the structural `SeanceStateSource`, not `SeanceDto`. They are the only definitions of "Ma situation" and "next session of a chapter".
- `SeanceSituation` = `je_mene | vote_a_faire | j_ai_vote | je_participe | pas_inscrit | j_y_etais`, or `null` (no pill). Precedence: no viewer → null; GM → `je_mene`; open poll → `vote_a_faire` while unanswered options remain (even if enrolled), else `j_ai_vote`; then enrollment rules (registered → `je_participe`, then `j_y_etais` once past; unregistered → `pas_inscrit`, null once past); non-enrollment sessions use the effective date (`poll.chosenDate`, `dateValidee`, `inscription.dateValidee`). "Past" follows `seanceState` (end of range, else date, before `todayKey`; same day is not past). "Answered" is the shared `hasAnswered('jdr', …)` via `hasUnansweredOptions` in `core/poll/poll.util.ts`, never redefined.
- `seanceState` becomes impersonal: loses `viewerId` and the "Réponds au vote" branch; an open poll always yields `status.seance_poll_open`; `status.seance_answer_poll` is removed from `StatusLabelKey`, the three tone files and the tone spec; its three callers (`seance-list.ts`, `scenario-timeline.ts`, `partie-detail.ts`) adapt.
- `shared/situation-pill` (`<app-situation-pill [value]>`) is the only pill in the app; input type `SituationValue` = `SeanceSituation` plus `place_reservee` (evening-only). `eventSituation()` (`features/events/event-card.util.ts`) returns a situation value; the inline `event-card__chip`/`ed__chip` markup and styles are removed. Old `partie.ralliement_event_chip_*` keys migrate to `situation.*`; `partie.ralliement_event_situation` becomes `situation.ma_situation`.
- Tabs (AD-8): closed union `TabKey` = `chapitres | scenario | chronologie | fiches | invitations | homme-dragon | details | conjonctions | jeux | soiree | membres`; state `selectedTabKey: TabKey | null`; a `computed` `tabs()` gives rendered keys in template order; the `mat-tab-group` index is derived only at render. `manualTabIndex`, `defaultTabIndex`, `MJ_INVITATIONS_TAB_INDEX` disappear; no code designates a tab by position. The default tab is fixed once per arrival, after `charactersLoaded`; a role/type/family change or a no-longer-rendered key resets to default; a late-appearing tab never switches the displayed one.
- Cover (AD-8): `PartieDto` gains `can: PartieCan` (`{ coverUpdate: boolean }`, exported from `@master-jdr/shared`, `import type` on consumers), always present like `role`. `permissions/` exports a pure `partieCan(role, partie)` deciding via `refusalFor` (same decision as `assert()`, no DB read), called by `toPartieDto` so every path returning a `PartieDto` carries it. The server stays the sole judge: `PUT`/`DELETE /parties/:id/cover` remain guarded by `assert(…, 'PARTIE_COVER_UPDATE', …)`. Web never infers the right from the role.
- `core/parties/cover-upload.ts` is the only cover-upload unit: `MAX_COVER_SIZE`, accepted types (moved out of `partie-form.ts`), a local-refusal function returning `partie.cover_reject_type`/`partie.cover_reject_size` or `null`, a `saving` signal guarding double sends, `change()`/`remove()` calling `PartiesService.setCoverImage`/`removeCoverImage`. `partie-form` goes through it with unchanged behavior.
- `features/parties/editable-banner/` wraps `PartyBanner` (stays purely presentational, no output) in `large` mode; `partie` read from `partie-detail` input without local copy; emits the updated party up to `partie-detail`. Chips (`cover-chips`) are siblings of the banner (it is `aria-hidden`), top-right at 8px, rendered only if `partie.can.coverUpdate`.
- Tests: Vitest for web (pure functions without TestBed in `status-derivation.spec.ts`), Jest + e2e `apps/api/test/characterization/partie-cover-permission.e2e-spec.ts` for the API.

## UX & Interaction Patterns

- "Ma situation" row: label left, pill right, plain text, no interactive element, wraps without horizontal overflow (Chronologie is vertical under 768 px). Rendered on Chronologie session rows, on each Chapitres-tab chapter row for the GM (next session via `nextSeanceOf`, "Je mène"; clicking/keyboard opening the chapter and "Ouvrir aux joueurs" unchanged), and under the session header in the scenario sheet (`seance-list`, shared by `scenario-editor`, `scenario-read-dialog`, single-quest Chapter tab). Null value → row not rendered. Player-side anti-spoil masking of drafts in `buildNodes` is unchanged; GM sees "Je mène" on drafts too.
- Pill tones: `je_mene` accent-1 outline; `vote_a_faire` status-todo 16% fill + outline; `j_ai_vote` status-live outline; `je_participe` status-live 12% fill; `pas_inscrit` dotted text-muted outline; `j_y_etais` status-done 12% fill, muted text; `place_reservee` like `vote_a_faire`. Template 1px 8px padding, state-badge radius, 12px/600. On the event card, "Vote à faire" moves status-live → status-todo, "J’y étais" and "Place réservée" align to the new tones (user-validated 2026-11-01).
- Details widget "Prochaine séance": pill beside the badge for `vote_a_faire`/`j_ai_vote` only, never for the GM; a single-quest player always sees "Vote à faire" there.
- Tab order/default: GM chronicle Chapitres · Chronologie · Détails · Invitations · (Homme Dragon, Ryuutama), default `chapitres`; GM single quest Scénario ("Chapitre") · Détails · Invitations · (Homme Dragon), default `scenario`; player chronicle Chronologie · Détails · Fiches, default `chronologie`; player single quest Détails · Fiches, default `details`; a player who must create a character (`canCreateCharacter()`) lands on `fiches`; group and evening keep their order (`conjonctions`, `soiree`). Tab labels per theme unchanged. "+ Inviter" opens `invitations`; announcement link opens `details` then scrolls to it.
- Cover chips: with cover, "Changer" (native file input covering the chip, keyboard reachable) and "Retirer" (no icon); without cover a single add chip (`partie.cover_add`). Change saves immediately, success snackbar without action (`partie.cover_changed`), failure `partie.cover_upload_error`, never "Annuler". "Retirer" opens the existing `confirm-dialog` (`destructive`, message `partie.cover_remove_confirm`), success `partie.cover_removed`, failure `partie.cover_remove_error`. Chips disabled while saving, finger-sized targets. The banner also shows on the first tab of an evening (no Détails tab) and on group Détails; page header keeps the Shell text banner.

## Cross-Story Dependencies

- 53.1 → 53.2 (pill, `situation.*` keys) → 53.3 (rows). 53.1 to 53.3 ship together in one production release: between 53.1 and 53.3, Chronologie, chapter cards and sheet show session state ("Vote ouvert") without a pill.
- 53.4's "Je mène" recipe depends on 53.3; 53.5 precedes 53.6 (`can.coverUpdate`, `cover-upload`); 53.6 uses `app-icon` and `confirm-dialog` from epic 51.
- `partie-detail.html/.ts/.spec.ts` is a hot spot (53.1, 53.2 test, 53.4, 53.6): land stories sequentially, never in parallel; tone files and `theme-tone.service.spec.ts` also take additions/removals in most stories (merge-conflict risk).
- Epic 54 builds on `seanceSituation` and the row placed by 53.3 (placed directly under the session header), without changing the computation.
