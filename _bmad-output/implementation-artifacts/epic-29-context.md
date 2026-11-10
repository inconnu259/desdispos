# Epic 29 Context: Navigation et listes

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Today the user must switch between an MJ mode and a player mode to reach their parties, and nothing on a party card tells them at a glance what needs their attention. This epic removes that mode switch, gives parties and characters their own unified lists reachable from a four-destination main navigation, and adds a server-computed signal system so a user can open the app and immediately know what requires action — while also giving each party a stable visual identity (generated banner or uploaded cover) and closing the loop with explicit party closure and an unseen-announcements notice at login.

## Stories

- Story 29.0: Status color palettes for the three themes
- Story 29.1: Single unified list of parties (removes the MJ/player mode toggle)
- Story 29.2: "My characters" view across all parties
- Story 29.3: Four-destination main navigation (Parties, Characters, Calendar, Account)
- Story 29.4: Contextual sub-navigation on screens (header + local tabs)
- Story 29.5: Character sheet split into routed sections
- Story 29.6: Explicit closure of a party by the MJ
- Story 29.7: Action-needed signage on party cards
- Story 29.8: Filters, sorting and favorite parties
- Story 29.9: Display density modes and shared control bar
- Story 29.10: Generative party banner
- Story 29.11: Banner animation and session countdown
- Story 29.12: Uploadable party cover image
- Story 29.13: Unseen-announcement notice at login
- Story 29.14: Redesign of party creation/edit screens
- Story 29.15: Explicit "create my character" button on a party's screen
- Story 29.16: Character-creation entry points from "Characters"
- Story 29.17: Only game systems with a playable module are offered when creating a party

## Requirements & Constraints

- No global MJ role: role is evaluated per party, never globally. Creating a party stays open to any user; only the prominence of the create action depends on already being MJ of one.
- Party status has exactly one persisted state (closure date); "ongoing"/"not yet started" are derived server-side, never stored.
- Action signals for the whole party list return in a single call, server-computed via batched queries — never one request per party (this fan-out has already caused two production incidents). Signal codes are a fixed closed set of ten; a party with none carries an empty list. At most two badges per card, rest collapse into a counter; a closed party shows only end-of-life signals.
- View mode and sort order are remembered per account, independently for the parties and characters lists (disjoint sort vocabularies); hiding finished parties is display-only on an already-loaded list, not a server filter.
- A cover image reuses the shared upload safeguards used for portraits (magic-byte MIME check, EXIF stripping, path-traversal guards) and is only ever served through a guarded endpoint, resized per display mode — never the original file, never static hosting. Only the MJ may set it.
- Only game systems with a playable module can be chosen when creating a party, enforced both in the form and server-side; existing parties on unsupported systems stay untouched, just without a character-creation entry point.
- Every state conveyed by color is doubled by a non-chromatic signal; status palettes must stay distinguishable from each other and from each theme's own accents.

## Technical Decisions

- `ModeService` becomes `MyPartiesService`: its anti-race counter and `notifyChanged()` (wired to the personal SSE channel) are preserved as-is; the mode toggle and its localStorage key are dropped, the unified list layered on top.
- Party reads go through an explicit projection (mirroring characters' `toDto()`) enumerating every field — no raw Prisma object ever leaves the service; it carries derived status, caller role, and cover image URL.
- The signals endpoint returns a map of party ID to a fixed-shape DTO (role, status, signal codes) from a closed union declared in the shared package; existing role-scoped list endpoints keep their contract.
- Real-time: purely personal state (preferences, favorites, seen announcements) refreshes locally, no SSE emission. A mutation shared across a party emits on that party's channel and on each affected member's personal channel; list screens subscribe only to the personal channel.
- Display-mode and sort preferences are typed scalar columns on the user, one pair for parties and a separate pair for characters — never shared, never a generic key/value or JSON blob.
- The generated banner is derived through a single function, seeded only from the party's ID (never name or theme), never persisted; an uploaded cover always takes precedence, and theme animation never accompanies an uploaded image.
- The cover-image upload utility refactor has ripple effects: the PDF export service and an existing character-service test mock need updating so no test silently stops covering its subject.
- The "system has a module" flag is a single boolean on the shared game-systems constant, read without a network call by the creation form, server validation, and every character-creation entry point.

## UX & Interaction Patterns

- The four-destination nav (bottom bar mobile, top bar desktop) is the sole "where can I go" surface; it never highlights an entry once a screen shows its own contextual header and local sub-navigation, which alone answer "where am I now."
- Cards render in three shared display densities (large / medium / compact); a status pastille is never shown alone, always paired with a label naming the dominant signal. The list groups under four urgency subheadings.
- The list control bar hides on scroll, reappears on scroll-up, shows a summary chip when a setting departs from default (with one-tap reset), and reveals search behind an icon on mobile while always visible on desktop.
- One predicate ("can I create a character here?") and its microcopy are shared between the party-detail invite block and the "Characters" screen's creation entries; when false, nothing renders. A MJ's equivalent entry is their Homme Dragon, not a player character.
- Character/player identity display always goes through one shared component, never styled ad hoc per screen.

## Cross-Story Dependencies

- 29.0 (status palettes) ships before 29.7 and 29.11, which render signal/countdown colors on top of it.
- 29.2 ("my characters" view) precedes 29.3 (four-destination nav), otherwise the new tab points at nothing.
- 29.6 (explicit closure) precedes 29.7 (status signage), which needs a "closed" status to signal.
- 29.5 (character sheet sections) directly continues 29.4 (contextual sub-navigation), reusing its structure.
- 29.15 and 29.16 share one creation predicate and microcopy, both depend on 29.17's module flag, and both surface a MJ-side entry owned by epic 33 (Homme Dragon).
- The character/player identity convention used throughout is established in epic 28, not redefined here.
