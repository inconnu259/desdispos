---
title: 'Story 51.8 — Remove the Material Icons font'
type: 'chore'
created: '2026-11-02'
status: 'done'
baseline_commit: 'e3dcabbafbdaa06d1e404494ad3a27a154268961'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-51-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every icon of the app now comes from `<app-icon>`, but `index.html` still loads the Material Icons font from Google Fonts, and nothing prevents a `<mat-icon>`, a Material icon import or an icon character from coming back.

**Approach:** Remove the font link, turn the ratchet into a strict repo-wide guard, and record the inventory showing that no Angular Material module in use renders a ligature of that font.

## Boundaries & Constraints

**Always:**
- Inventory first (result written in `## Implementation Notes`): for each Angular Material module imported in `apps/web/src` (button, dialog, input, form-field, card, snack-bar, progress-spinner, tabs, button-toggle, checkbox, radio, toolbar, select, progress-bar, list, badge) establish that it does not render a Material Icons ligature. Already established by the session, to be confirmed against the installed `node_modules/@angular/material`: the only references to `mat-icon` / `.material-icons` in `button`, `button-toggle` and `badge` are content-projection selectors, sizing CSS and a dev warning, none renders a ligature. If any module does depend on the font, stop and report before removing anything.
- `apps/web/src/index.html`: remove `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />`; keep the Roboto link and both `preconnect` lines.
- Replace `core/icons/mat-icon-ratchet.spec.ts` by a strict guard (rename to a name that says so, e.g. `no-material-icons.spec.ts`) that fails if: a template (`.html` and inline `template:` of non-spec `.ts`) contains `<mat-icon`; any non-spec source imports `@angular/material/icon` or uses `MatIconModule` / `MatIconRegistry`; `index.html` mentions `Material+Icons`; a source uses the class `material-icons`; any icon character of this list appears in a template outside comments or in a tone value: `♥ ✦ ⚔ 🌿 ⚙ ✎ ✕ ✓ ▾ ▴ ▸ ⌄ ⌃ ✅ ⚠ ❌ 🔒 🔓 ❮ ❯ ‹ › ☰` (and `&#9829;`, `&#8942;`, `&#9776;`, `&#9662;`). Any legitimate exception found by the scan (e.g. a plain text separator) is listed in the test with its reason, never silently skipped. Existing per-zone guard specs may stay.
- One-off search in `apps/web/src` (templates, code, tone files, outside comments) for the Material names used as icons — `home`, `badge`, `calendar_month`, `person`, `shield`, `flag`, `play_circle`, `schedule`, `event_busy`, `replay`, `visibility_off`, `campaign`, `auto_awesome`, `person_add`, `person_remove`, `admin_panel_settings`, `logout`, `exit_to_app`, `star`, `star_border`, `description` — and report what remains; ordinary words in text or CSS/JS identifiers are not icons. Fix any real leftover with the right `app-icon`.
- Logo, brand strip, generated banner, system badges and creation icon are untouched. Comments in French.

**Never:**
- Remove the Roboto font or its `preconnect`; touch any icon drawing or `app-icon.ts`; install anything; edit `package.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean tree | current sources | strict guard passes | N/A |
| Reintroduction | a `<mat-icon`, a Material icon import, `Material+Icons` in `index.html`, or one of the listed characters in a template | the guard fails and names the file | N/A |
| App start | `index.html` | no request to the Material Icons stylesheet; Roboto still loads | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/index.html` -- line ~19, the Material Icons `<link>`.
- `apps/web/src/app/core/icons/mat-icon-ratchet.spec.ts` -- ceiling 0; sources walker and comment stripping to reuse in the strict spec. Sibling guards: `features/calendar/calendar-icon-characters.spec.ts`, `core/icons/{personnages,compte-soirees-jeux}-icon-characters.spec.ts`.
- `apps/web/src/app/core/theme/tones/*.ts` -- tone values scanned for the characters.
- `apps/web/node_modules/@angular/material/fesm2022/*.mjs` (read-only, inside the container) -- inventory.
- `apps/web/angular.json` -- unchanged; the initial budget stays 1.1MB.

## Tasks & Acceptance

**Execution:**
- [x] Inventory of the Angular Material modules (Implementation Notes)
- [x] `index.html` -- remove the font link
- [x] Strict guard spec replacing the ratchet; fix every leftover it finds; one-off search of the Material names, result in Implementation Notes

**Acceptance Criteria:**
- Given the repo, when the strict guard runs, then it passes, and each reintroduction in the matrix makes it fail naming the file (verify once by a temporary local edit that is then reverted).
- Given `ng test --watch=false` and `ng build`, then they pass (the 2 date-frozen `calendar-view` failures are pre-existing).

## Implementation Notes

**Inventaire Angular Material 22.1.3** (lu dans `node_modules/@angular/material/fesm2022`, conteneur `web`). Modules importés dans `apps/web/src` : button, dialog, input, form-field, card, snack-bar, progress-spinner, tabs, button-toggle, checkbox, radio, toolbar, select, progress-bar, list, badge. Recherche de `mat-icon`, `material-icons`, `Material Icons`, `MatIcon*`, `fontIcon`, `ligature`, `font-feature-settings` dans chaque `.mjs` (hors `-testing` et `.map`) :

- dialog, input, form-field, card, snack-bar, progress-spinner, tabs, checkbox, radio, toolbar, select, progress-bar, list : aucune référence. Aucune ligature.
- button : uniquement les sélecteurs de projection de contenu `.material-icons`, `mat-icon`, `[matButtonIcon]` dans les `<ng-content select>` des gabarits (lignes 72-73, 95-96, 169-170, 190-191, 234-235, 253-254), la sélection CSS de dimensionnement correspondante et les noms de classe `MatIconButton` / `MatIconAnchor` (variante `mat-icon-button`, simple bouton rond sans ligature). Rien ne rend de ligature.
- button-toggle : `mat-icon` uniquement dans les règles CSS de dimensionnement (lignes 642 et 685). Aucune ligature.
- badge : `mat-icon` uniquement dans un `console.warn` de développement (lignes 124-125) sur un `matBadge` posé sur un `<mat-icon aria-hidden>`. Aucune ligature.
- Hors liste : seuls `button.mjs` et `menu.mjs` mentionnent la classe `.material-icons` (menu n'est pas importé par l'application) ; `MatIconRegistry` n'existe que dans `icon.mjs` et son chunk, non importés.

Conclusion : aucun module utilisé ne dépend de la police ; le lien `Material+Icons` a pu être retiré sans autre changement. Les `mat-icon-button` du dépôt (calendrier, partie-detail, level-up-wizard, list-control-bar...) sont des boutons Material et ne sont pas des `<mat-icon>` (le garde ne les confond pas).

**Recherche ponctuelle des noms Material** (`home`, `badge`, `calendar_month`, `person`, `shield`, `flag`, `play_circle`, `schedule`, `event_busy`, `replay`, `visibility_off`, `campaign`, `auto_awesome`, `person_add`, `person_remove`, `admin_panel_settings`, `logout`, `exit_to_app`, `star`, `star_border`, `description`) dans `apps/web/src` (gabarits, code, tons, scss, hors commentaires) : aucun résidu utilisé comme icône. Seules occurrences : le nom de champ de formulaire `description` (`formControlName`, `fieldPending('description')`, propriété `scenario().description`), la classe CSS `description`, l'entrée `badge` de `choice-card` et la doc de `system-badge`, la classe `star` de la bande de marque (cercles SVG du fond d'`auth-band`, hors périmètre). Aucun correctif nécessaire.

**Recherche des caractères-icônes** (liste de la spec + entités) dans gabarits `.html`, `template:` en ligne et valeurs de tons, hors commentaires : zéro occurrence, donc `EXCEPTIONS` vide dans le garde.

**Garde** : `core/icons/no-material-icons.spec.ts` remplace `mat-icon-ratchet.spec.ts` (supprimé). Il échoue en nommant le fichier sur : `<mat-icon` (hors `mat-icon-button`), import `@angular/material/icon`, `MatIconModule` / `MatIconRegistry`, `Material+Icons` / `Material Icons` (y compris en commentaire de `index.html`), classe `material-icons`, caractère-icône dans un gabarit, caractère-icône dans une valeur de ton. Il vérifie aussi que `index.html` garde Roboto et ses deux `preconnect`. Les specs de zone existantes sont conservées.

**Vérifications** : réintroduction temporaire (lien `Material+Icons` dans `index.html`, `<mat-icon>` et `✓` dans des `.html` isolés, import `MatIconModule` dans un `.ts` isolé) : le garde a échoué en nommant chaque fichier ; tout a été remis en l'état. `ng test --watch=false` : 4677 passent, 2 échecs `calendar-view` (date figée, connus). `pnpm build` : succès, aucune mention de Material Icons dans `dist`, Roboto toujours inliné.

**Recette visuelle du 2026-11-02** (navigateur, 1264 px, fond sombre des trois thèmes ; planche temporaire servie par le serveur de dev, supprimée et `favicon.svg` restauré à l'identique, thème du compte remis sur Atelier). Le jeu de données n'a aucune partie terminée ni annulée : `etat-terminee`, `etat-annulee`, `masquer` et `distribuer-xp` ont été jugés sur une planche à 16 px agrandie 4×, les autres à l'écran (tableau de bord et page Compte en Atelier, tableau de bord en Grimoire). Pas de test à 360 px.

- Lisibles : navigation (3 thèmes), cartes (favori, rôle, signal), barre des listes (`filtres`, `rechercher`, `vue-*`), page Compte en Atelier (`actif`, `jeux`, `ouvrir`, `quitter`, `supprimer`), `menu-affichage`, `vue-compacte`, `actif` / `dispo-partiel` / `dispo-non` / `effacer` (formes distinctes), `quitter-groupe` (3 thèmes), `role-admin` à 14 px (Grimoire clé, Atelier chevrons), Atelier `etat-terminee` (levier) / `etat-annulee` (chaîne rompue), Forêt `etat-terminee` (cairn) / `etat-annulee` (cairn renversé), Atelier `distribuer-xp`.
- **À signaler à l'utilisateur (dessins non retouchés)** : (1) Grimoire `etat-terminee` / `etat-annulee` : deux livres au cachet, la différence (cachet fêlé) est à peine visible à 16 px, le mot écrit à côté les distingue ; (2) Forêt `masquer` (œil clos sous un rameau) se lit comme un griffonnage et Atelier `masquer` (iris) comme une spirale ; (3) Forêt `role-admin` (couronne de bois) à 14 px est à la limite ; (4) l'icône `quitter` de « Couper la vapeur » (Atelier) est un peu plus haute que la ligne de texte.

## Spec Change Log

## Review Triage Log

| # | Finding (layer) | Verdict | Route | Evidence |
|---|-----------------|---------|-------|----------|
| 1 | Guard looks for `<mat-icon` only in backtick `template:` literals; the deleted ratchet scanned the whole `.ts` text (quoted templates, const strings) (blind, edge) | medium | patch (applied) | Confirmed: `app.ts` already uses a single-quoted template. Whole comment-stripped `.ts` text now checked, with two self-tests. |
| 2 | `index.html` check passes with the googleapis preconnect line deleted (edge, claim) | low | patch (applied) | `toContain('https://fonts.googleapis.com')` was satisfied by the Roboto href; now asserts both `rel="preconnect"` links. |
| 3 | Font-name regex too narrow (Material Symbols, `%20`, lowercase) (blind, edge) | low | patch (applied) | Single case-insensitive constant shared by the scan and the `index.html` test, with self-tests. |
| 4 | `▲` (U+25B2) in `character-summary-card.html` not in the character list (blind, edge) | low | defer | Not in the AC's list (it lists `▴`); an icon-like level-up badge glyph, the user may want an icon for it. Logged in deferred-work. |
| 5 | Character list incomplete (`⋮`, `✔`, `×`, hex and named entities), `.ts` string constants and `.scss` content not scanned for characters (blind, edge) | low | rejected | The AC fixes the list; widening it adds false-positive risk; no occurrence exists today. |
| 6 | Guard limited to `apps/web/src` (`angular.json`, `package.json`) (blind, edge) | low | rejected | Out of the story's scope (index.html and sources); a font package would need a dependency install, which is forbidden without agreement. |
| 7 | `EXCEPTIONS` map hygiene, `stripComments` on strings, `endsWith('index.html')`, empty `TONE_MAP`, docs naming the old ratchet (blind, edge) | low | rejected | `EXCEPTIONS` is empty and its use is documented; fixes add guards; the epic context is regenerated when planning docs change. |
| 8 | No runtime check for leftover ligature text (blind) | low | rejected | The inventory shows no Angular Material module renders such a ligature; the static guard covers the app's own sources. |
## Verification

**Commands:**
- `docker compose exec web pnpm ng test --watch=false` -- expected: all pass but the known date-frozen failures
- `docker compose exec web pnpm build` -- expected: success, no Material Icons reference left in `dist`

**Manual checks (if no CLI):**
- Recette at 16 px, three themes, dark surfaces, by the session or the user (not by the implementer): Grimoire `etat-terminee` / `etat-annulee`; Atelier `masquer` and `distribuer-xp`; `menu-affichage` / `vue-compacte` and `actif` / `dispo-partiel`; `quitter` / `quitter-groupe` Atelier; `dispo-non` / `effacer`; `role-admin` at 14 px. Each pair is judged readable or reported; no redraw without the user's agreement.
