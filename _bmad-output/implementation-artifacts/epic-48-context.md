# Epic 48 Context: Ma Ludothèque, et celle des autres

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Every user keeps a personal list of board games (their Ludothèque) on a page opened from their account, with fast manual entry, correction and removal, and can read the Ludothèque of a person they share a ralliement group or an isolated encounter with by touching that person's name. This epic lays the foundation of Palier 10.5 (board games, evening mode only): the `BoardGame` table, the shared `boardGameNameKey` normalisation, the new `board-games/` API module, the `LIBRARY_READ` permission and the `LibrarySheet` drawer. It touches no evening/event yet (epics 49 and 50 build on it). The whole feature is strictly optional: an empty Ludothèque is the normal state and nothing ever nudges the user to fill it.

## Stories

- Story 48.1: Ajouter mes jeux et les retrouver
- Story 48.2: Corriger ou retirer un jeu
- Story 48.3: Consulter la Ludothèque d'une personne

## Requirements & Constraints

- A Game (`BoardGame`) = mandatory name (1–80 chars), optional min/max players (integers 1–99, `max ≥ min`), optional duration in minutes (integer 1–1440); 500 games max per Ludothèque. Validated server-side with `class-validator`. Manual entry only: no catalogue import (BoardGameGeek rejected), no photo, extension, rating or logo.
- Two games with the same normalised name (case, accents, extra spaces ignored) are refused in one Ludothèque, with the theme message (« Ce jeu est déjà dans votre cabinet. » / « …dans ton coffre. » / « …sur votre râtelier. »). Update applies the same rules and recomputes `nameKey`.
- `PATCH`/`DELETE` on someone else's game → 404. Deleting the account deletes the Ludothèque by cascade (tested).
- Optional end to end: no prompt, e-mail or badge anywhere pushes to fill the Ludothèque; empty Ludothèque page shows the entry row only, no incentive text; an empty Ludothèque in the sheet says so without suggesting anything.
- Visibility: a person's Ludothèque is readable by the owner, by members of a ralliement group they both belong to, and by the host and invitees (answered or not, i.e. `PENDING`) of an isolated encounter they share. A JDR party, a declined invitation or an unused invite link open nothing. Refusal is enforced server-side as **404** (never reveal the account exists), never just hidden in the UI.
- Owner DTO exposes `pseudo` + `displayName`, never a third party's e-mail; explicit projection to DTOs.
- Nothing of this palier appears on a JDR party; no JDR screen changes. Volume target: 300 games per Ludothèque stay readable and fast on phone.
- Every modified validated screen is flagged ⚠️ in the story. French comments and error messages; no dependency install; everything via Docker; CI (types, API build, unit + e2e) green at each story. Real-time wiring per `docs/checklist.md`; security per `docs/security.md`.

## Technical Decisions

- `BoardGame(id, ownerId, name, nameKey, minPlayers?, maxPlayers?, durationMin?, createdAt)`, `@@unique([ownerId, nameKey])`, `ownerId → User` `onDelete: Cascade`. One Prisma migration in the story that introduces the table (48.1), no multi-step migration.
- Single writer: new layer-2 module `apps/api/src/board-games/`. It must never import `events/` (dependency goes `events/ → board-games/` in epic 49).
- `boardGameNameKey(name)` (collapse spaces, strip accents, lowercase) is the **single** normalisation function, in `@master-jdr/shared` (runtime value: plain `import`, not `import type`). Computed by the API at write time and served in every DTO; the web groups on the received `nameKey` and never recomputes it (optional pre-check of the input with the same function only). Unit tests: case, accents, spaces. No shared game identity across people.
- Routes (all in `board-games/`): `GET /me/board-games` (alphabetical), `POST /me/board-games`, `PATCH /me/board-games/:id`, `DELETE /me/board-games/:id` (self only); `GET /users/:userId/board-games` guarded by `LIBRARY_READ`.
- Permission: `PermissionTarget` gains `{ userId }`; new action `LIBRARY_READ` decided only in `PermissionService` (no visibility rule recoded in `board-games/`). Refusal test matrix: shared group, isolated encounter accepted / pending / declined, shared JDR only, unknown user → 404.
- Real-time: after commit, outside the transaction, every write of `board-games/` emits `user:{ownerId}` and `partie:{id}` for each ralliement party the owner is a member of. Web Ludothèque service exposes `notifyChanged()` and reloads on `user:{id}` (updates other tabs). No new channel.
- Forbidden identifiers: `games/` (already means the party), `ludotheque`, `apport`. Imposed names: `BoardGame`, `nameKey`, `boardGameNameKey`, `minPlayers`, `maxPlayers`, `durationMin`, `LIBRARY_READ`.
- Web: page Ludothèque and `LibrarySheet` in `apps/web/src/app/features/board-games/`; route under `/profile/`; theme labels in `core/theme/tones/` (three theme files) with neutral keys in `NEUTRAL_KEYS` plus their reason.

## UX & Interaction Patterns

- ⚠️ Account page (« Mon grimoire / Mon carnet / Mon établi »): a row « Mon cabinet de reliques / Mon coffre aux trésors / Mon râtelier · {n} jeux › » with the visibility sentence below, placed **before the sensitive zone**; opens the Ludothèque page.
- Page: theme title, visibility subtitle, `QuickAddRow` on top (`{colors.surface-high}`, outline border, radius 12 px): Nom, Joueurs « à », Durée en minutes, « Ajouter », hint « Seul le nom est obligatoire. ». `Entrée` in any field adds; fields clear and focus returns to name; empty name → button disabled; max < min → message under the field via `aria-describedby`; server error under the entry, fields kept.
- List: alphabetical, one row per game (name, « {min}–{max} joueurs · {d} min » or partial forms), 44 px min, no truncation; ≥ 768 px: 640 px max centered column.
- ✎ opens the same entry inline, prefilled, with « Enregistrer » and « Retirer de mon cabinet / coffre / râtelier ». Removal is immediate with « Jeu retiré · Annuler » for a few seconds (polite `aria-live`); « Annuler » recreates the game with the same fields. (The "brought to an upcoming evening" pre-confirmation is added later by 49.2.)
- ⚠️ `LibrarySheet`: reuses the `DestinyList` bottom drawer (modal, 40×4 px handle, radius 18 px top, `{colors.surface-container-high}`), modal also above 768 px. Title « Cabinet / Coffre / Râtelier de {nom} · {n} », loan line (« Pour emprunter un jeu, demandez-le à {nom}. » / « …demande-le à {nom}. » / « Pour un prêt, adressez-vous à {nom}. »), read-only list. `Échap`, backdrop or swipe down close; focus trapped then returned to the touched name.
- ⚠️ Entry points become buttons (inert today): registrant/invitee chips (group conjunction detail, « Invités / Invitations » tab of an isolated encounter) and « Missives » rows. Accessible name « Voir les jeux de {nom} » (to validate in story). Owner names elsewhere use `OwnerLink` (dotted underline).
- Labels: content says « jeux »; only titles use the theme word (reliques feminine, trésors/joyaux masculine). Measures, field labels, « Ajouter », « Seul le nom est obligatoire. », « Jeu retiré · Annuler » go to `NEUTRAL_KEYS`. No new theme token, no red, no image.

## Cross-Story Dependencies

- 48.1 → 48.2 (edit/remove reuse the entry row and emissions) ; 48.1 → 48.3 (sheet reads `BoardGame` DTO). 48.2 and 48.3 are independent of each other.
- Epic 49 (games on site of an evening) reads the host's Ludothèque through `events/` and relies on 48.1's `partie:{id}` emissions; 49.2 adds the removal confirmation to 48.2's page. Epic 50 (group games, host counter) reuses `board-games/`, `nameKey` grouping and `LibrarySheet`.
- Builds on Palier 10's `PermissionService`, `Membership` / `Invitation` model, `RealtimeService` channels, and Palier 10.4's `DestinyList` drawer.
