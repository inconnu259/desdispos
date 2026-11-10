# Epic 51 Context: Un jeu d'icônes propre à chaque thème

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace every Material Icons glyph, emoji and icon-like character in the web app with a purpose-drawn icon set: 30 "meaning" icons drawn once per theme (Grimoire émeraude, Forêt ancienne, Atelier de cuivre) and 41 utility icons shared by the three themes. Each icon carries a single meaning (no two concepts share a drawing inside a theme), icons switch with the theme at once, and the Material Icons font is no longer loaded from a third-party service. Palier 10.7, delivered before production.

## Stories

- Story 51.1: Le socle des icônes, et la barre de navigation aux couleurs du thème
- Story 51.2: Tableau de bord et barre des listes
- Story 51.3: La page d'une partie — états, actions et ressources
- Story 51.4: Membres, invitations et gouvernance du groupe
- Story 51.5: Calendrier, Destinée et sondages
- Story 51.6: Personnages, scénarios et Homme Dragon
- Story 51.7: Compte, soirées, jeux de société et surfaces partagées
- Story 51.8: Retirer la police Material Icons

## Requirements & Constraints

- Migration is by screen zone; `<mat-icon>` and `<app-icon>` coexist until the last story. From 51.1 on, no new `<mat-icon>`. Emoji and icon characters are replaced in the story of their zone (each file touched once).
- Drawings are fixed by the UX: never retouched in code, including the user's ✱ retouches (squirrel for Forêt personnages, orb-staff for Grimoire joueur, crossed wands for Grimoire membres, lone chalice for Grimoire jeux). Any change needs the user's agreement. Where a mockup board and the UX spines disagree, the spines win.
- Accessibility: an icon next to text is decorative (`aria-hidden="true"`, `focusable="false"`); a lone icon gets the theme label of its concept (from `core/theme/tones/`), carried by either its button (`aria-label`) or the icon (`label`), never both. Two-state icons (favori, lien, cadenas, œil, dispo oui/partiel/non) differ by shape, not by colour alone. No fallback icon: a concept without an icon is shown as text only.
- Typographic "→" and "+" inside labels stay text. No label changes, except member-list titles losing their emoji ("Compagnons" / "Habitants" / "Équipage"). Logo, brand strip, generated banner, system badges and creation icon are out of scope.
- Legibility 16–24 px (14 px for avatar badges) on the dark surfaces of the three themes (all themes are dark).
- Any validated screen whose icon changes is flagged ⚠️ in review. French comments and messages, no dependency install (no `package.json` change), Docker only, CI green per story; labels exist in the three tone files.

## Technical Decisions

- One component `<app-icon name="…">` in `core/icons/` reads a generated data registry (`viewBox` + `{tag, attrs}` elements, tags limited to path/circle/ellipse/rect/line/polyline/polygon). Forbidden: `[innerHTML]` for icons, `DomSanitizer.bypassSecurityTrust*`, `MatIconRegistry`, network loading. `name` is typed by the generated `IconName` union (71 names in one namespace).
- Registry `icon-registry.generated.ts` is produced by `apps/web/scripts/generate-icons.mjs` (Node only, no dependency, run in the `web` container) from `apps/web/src/assets-src/icons/` (initial copy of the 131 SVGs from the UX mockups `icones/`: three theme folders of 30 + `communes/` of 41). The generated file is committed with a "generated, do not edit" header. The script rejects `id`, `mask`, `clipPath`, `style`, `script`, `href`/`xlink:href`, tags outside the list, a `viewBox` other than `0 0 32 32`, theme folders with differing file names, and a name present both in a theme and in `communes/`; `--check` fails if the committed registry differs. Generator tests use `node --test`; tests and `--check` run in CI.
- Same icon name across themes; `app-icon` picks the drawing from `ThemeToneService.activeTheme()` for meaning icons, a single drawing for utilities. A screen passes a name, never a theme. Host element carries `data-icon`; size via `--app-icon-size` (24 px default; 14 badge, 16 inline, 20 labelled button); `stroke="currentColor"`, round caps/joins, no new theme token.
- `roleIconName(role, { soireeIsolee })` is the only role → icon mapping (`mj` → role-mj; `player` and ralliement `member` → role-joueur; `admin` of a group → role-admin; `admin` of an isolated encounter, i.e. `partie.kind === 'ONE_SHOT'` → role-hote). `roleIcon`, `tintIcon`, `modeIcon` and favori helpers return an `IconName`. The Admin shield on avatars is replaced by `role-admin`, also as a 14 px badge.
- A ratchet test counts `<mat-icon` in templates (`.html` and inline templates, excluding specs) and fails above the post-story count; each zone story lowers the ceiling. The last story makes it strict (also fails on an `@angular/material/icon` import or `Material+Icons` in `index.html`), after verifying that no used Angular Material component renders a Material Icons ligature. The Roboto text font stays loaded.

## UX & Interaction Patterns

- One family per theme: Grimoire = book (states are one book open/sealed/cracked/reopened, hourglass excepted); Forêt = path (footsteps, horizon, cairn up/knocked down, antler crown for governance; no campfire, reserved for the ralliement L1 badge); Atelier = lectern (pressure machine, unrolled plan, lever down/up, broken chain for cancel; the bare gear is reserved for Membres).
- Concept → drawing mapping lives in the UX icon tables (nav, roles, party states, party actions, group governance, transverse meanings, utilities): the build reads the SVG source, not this file.
- Replace the overloaded Material names: terminé ≠ signal (`flag`), compte ≠ joueur (`person`), MJ ≠ admin (`shield`), suivant ≠ ouvrir (`chevron_right`), accepter ≠ thème actif (`check`). Cadenas pair only for shared/private notes and the party Visibilité button; `oeil`/`oeil-barre` stay reserved to the password eye.
- Recette at 16 px in the three themes (and `role-admin` at 14 px) on a fixed list of pairs, in Story 51.8; unreadable pairs are reported to the user, never redrawn.

## Cross-Story Dependencies

- 51.1 precedes every story that adds an icon, including epics 52–54. It also provides `declarer-dispos` (used by epic 52) and migrates the shell navigation; `vote` is placed in Story 54.1 and `jeux` in Story 51.7; `ajouter` is registered but unused in this palier.
- 51.2–51.7 each lower the ratchet ceiling; 51.8 runs last, requires the ceiling at zero, and ends the palier (remind the user: plan mode, `/security-review`, `/code-review`, dependency PRs).
- Epics 53/54 add `situation-pill` and cover chips that use `app-icon`; they depend on 51.1 only.
