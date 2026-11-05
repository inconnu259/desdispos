# Epic 52 Context: Declare your availability without hunting for it (Palier 10.6)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A visible button switches the calendar into a "declaration mode" where a single tap selects a slot (no long-press), and the dashboard reminds members of an active party to declare availability when nothing is planned for the coming four weeks. The reminder can be silenced from the banner and re-enabled from the Account page. Today declaring availability requires discovering the long-press gesture, which new users never find. Epic 51 (icons) is delivered: every icon goes through `<app-icon>`, no `<mat-icon>` may enter the code.

## Stories

- Story 52.1: One interaction at a time in the calendar
- Story 52.2: "Déclarer mes dispos" button and declaration mode
- Story 52.3: One tap is enough in declaration mode, and the bar stays within reach
- Story 52.4: The server knows when to remind about availability
- Story 52.5: The "Dispos à déclarer" reminder on the dashboard
- Story 52.6: Silence the reminder, re-enable it from the Account page

## Requirements & Constraints

- Calendar has exactly one active tool at a time; turning one on turns the other off and clears the current selection.
- In read mode nothing changes: short tap reads, long-press/drag opens selection, the Composer gesture of a poll is intact, keyboard shortcuts (`Espace`, `1/2/3`, `Shift`+arrows, `Enter`, `Esc`) are unchanged.
- Declaration mode never persists in the URL; only `?poll=` (Destiny) and `?declarer=1` (reminder entry) are read once then removed.
- The reminder is shown once on the dashboard (never one badge per card); nothing is displayed while loading or on read failure (no flicker). Silencing it must not silence the per-card party signals (`GET /me/party-signals`).
- Every new text is a key in all three tone files (`apps/web/src/app/core/theme/tones/`), "tu" in the Forest tone. Labels identical across themes ("Déclarer mes dispos", "Terminer", "Dispos à déclarer", "Ne plus me le rappeler", "Me rappeler de déclarer mes dispos", snackbar "Annuler") join the intentionally-identical list in `core/theme/theme-tone.service.spec.ts`.
- Colors only through existing `--jdr-*` variables (`accent-1`, `on-primary`, `text-primary`, `surface-bg`, `overlay`, `status-todo`); no new token. Any change to a validated screen is flagged with a warning sign in review.
- Phone and desktop on equal footing; nothing requires long-press; actions are written and keyboard reachable.
- CI green; run `docker compose exec api pnpm typecheck` after any signature or shared-type change (ts-jest does not type-check across files).

## Technical Decisions

- Calendar (AD-7): `calendar-view` holds one signal `interaction: 'lecture' | 'declaration' | 'composer' | 'destinee'`, written only by `setInteraction()`. It replaces the `composing` boolean; `destinyPollId` only says which poll. The input name `mode` (personal vs GM calendar) is unchanged. Selection stays in the month/week views, which read `interaction`. `Esc` empties the selection first, then asks `calendar-view` to go back to `lecture`.
- Reminder (AD-5): `AvailabilityService.reminderDue(userId)` is the single definition: `User.availabilityReminder` true AND user has an active party (JDR or rally) via port `ActivePartiesPort.hasActivePartie` (declared in `availability/`, implemented by the layer that computes progress; `availability/` imports neither `events/` nor `parties/`) AND none of the user's own unexpired `AvailabilityDeclaration` overlaps the next `AVAILABILITY_REMINDER_DAYS` (28, shared constant) days (recurrences included; synthetic session unavailability excluded). Recomputed on each read, no scheduled job.
- API: `GET /me/availability-reminder` -> `{ show: boolean }`, distinct from party-signals; preference `User.availabilityReminder Boolean @default(true)` (additive migration), written by `PATCH /me/preferences` (`@IsBoolean`), returned in `AuthUser`. One table, one writer (`account/` writes, `availability/` reads).
- Realtime: every declaration write and every preference change emits `user:{userId}` in addition to existing emissions (outside transactions, never failing the write); web `AvailabilityReminderService` (`core/availability/`) exposes `notifyChanged()` and registers on the `user:` prefix of `RealtimeService`. No new channel.
- Conventions: Angular control-flow `@if/@for`, signals; shared runtime values (not `import type`) from `@master-jdr/shared`; code comments and error messages in French.

## UX & Interaction Patterns

- Button "Déclarer mes dispos" sits in `.calendar-controls`, after the Destiny chip and before "Proposer des dates"; outlined at rest, filled (`accent-1`/`on-primary`) with label "Terminer" and `aria-pressed` when on. Agenda view has no grid: the button switches to Month first; switching to Agenda turns the mode off.
- When on: a help banner (`role="status"` slot always present) under the controls and a 2px `accent-1` outline around the grid; the selection bar sticks to the bottom of the screen on phone.
- A tap on a band adds/removes a slot; a tap on the day number toggles the whole day; horizontal drag selects without long-press, vertical drag scrolls the page; "Disponible"/"Indisponible"/`Enter` save through the existing batch path and leave the mode on; a snackbar reports the slot count.
- Dashboard reminder: banner using the `status-todo` pattern, primary action opens `/profile/calendar?declarer=1` (Month view, mode on); "Ne plus me le rappeler" silences with an "Annuler" snackbar; Account page gets a checkbox right after the "Ce que révèle mon calendrier" block.
- Persona walkthrough used for recipes: Nina, on phone and desktop.

## Cross-Story Dependencies

- 52.1 -> 52.2 -> 52.3: the `interaction` signal and `setInteraction()` come first; the `declaration` value exists after 52.1 but nothing turns it on until 52.2; tap/sticky bar/`Esc` order land in 52.3.
- 52.4 (server rule, preference, emission, DTO/AuthUser field) precedes 52.5 and 52.6; 52.5 needs 52.2 for the `?declarer=1` entry; 52.6 needs 52.4 and 52.5.
- Existing Composer/Destiny flows (Story 45.2, `?poll=`, `?seanceId=`) must keep working through the refactor.
