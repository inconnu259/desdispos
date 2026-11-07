---
title: '53.4 — A party opens on the sequence of its sessions'
type: 'feature'
created: '2026-11-07'
status: 'done'
baseline_commit: '54cd5ca71b4ffd655e81e9b65df61a9b70f56a10'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-53-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `partie-detail` designates its tabs by position (`defaultTabIndex`, `manualTabIndex`, `MJ_INVITATIONS_TAB_INDEX`, an announcement link forced to 0), so a party opens on Détails and any reordering silently breaks the internal links.

**Approach:** Address every tab by a key (`TabKey`), reorder the JDR tabs so the sequence of sessions comes first, and make the default tab a per-role rule. Web only; no API change.

## Boundaries & Constraints

**Always:** Closed union `TabKey` = `chapitres | scenario | chronologie | fiches | invitations | homme-dragon | details | conjonctions | jeux | soiree | membres`. State `selectedTabKey: TabKey | null`; a `computed` `tabs()` returns the rendered keys in template order, and the index bound to `mat-tab-group` exists only at render (`tabs().indexOf(key)`), `(selectedIndexChange)` maps the index back to a key. `manualTabIndex`, `defaultTabIndex`, `MJ_INVITATIONS_TAB_INDEX` and the forced index 0 of the announcement link disappear; no code designates a tab by position. Tab labels per theme do not change. `dynamicHeight` and keyboard navigation of `mat-tab-group` unchanged. Order and default (⚠️ validated screen): GM chronicle Chapitres · Chronologie · Détails · Invitations · (Homme Dragon, Ryuutama), default `chapitres`; GM single quest Scénario ("Chapitre") · Détails · Invitations · (Homme Dragon), default `scenario`; player chronicle Chronologie · Détails · Fiches, default `chronologie`; player single quest Détails · Fiches, default `details`; a player who must create a character (`canCreateCharacter()`, the single predicate of 29.15) lands on `fiches` in both; group and evening keep their order and default (`conjonctions`, `soiree`). The default is fixed once per arrival, after `charactersLoaded`, then never moves: a player reading another tab is not switched to Fiches when characters reload; a change of tab set (GM/player role, party kind after conversion, family) returns to the new default; a selected key no longer rendered returns to the default; a tab appearing later (Homme Dragon, characters loaded) never changes the displayed tab. Internal links name the tab: "+ Inviter" (`openInvitationsTab()`, roster rail and strip, GM only as today) opens `invitations` in chronicle and single quest; the announcement link (`?announcementId=`, Story 29.13) opens `details` then scrolls (`scrollToAnnouncement`); the dashboard "Créer son héros" signal arrives on Fiches by the default rule. Keep one source of truth between `tabs()` and the template conditions. Realtime: tab selection is UI-only, no party-scoped display added, record that in Implementation Notes (`docs/checklist.md`).

**Never:** Touch API, tone labels, tab contents, or the Détails widget (53.1). No lazy-content change. Land nothing else in `partie-detail` (hot spot: one story at a time).

## I/O & Edge-Case Matrix

| Scenario | Viewer / party | Rendered labels order · default |
|---|---|---|
| GM chronicle, with / without Ryuutama | owner, not one-shot | Chapitres · Chronologie · Détails · Invitations (· Homme Dragon) · `chapitres` |
| GM single quest | owner, one-shot | Scénario · Détails · Invitations (· Homme Dragon) · `scenario` |
| Player chronicle / single quest | member | Chronologie · Détails · Fiches · `chronologie` / Détails · Fiches · `details` |
| Player must create a hero | `canCreateCharacter()` | same order · `fiches` (chronicle and single quest) |
| Group / evening | ralliement | unchanged order · `conjonctions` / `soiree` |
| Late characters reload while reading Détails | tab already settled | selection kept |
| Role or kind changes | tab set changes | back to the new default |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- `MJ_INVITATIONS_TAB_INDEX` (l.96); `defaultTabIndex` / `manualTabIndex` / `selectedTabIndex` / `tabSetKey` / `onTabIndexChange` / `openInvitationsTab` (l.494–515); the two settling effects (l.592–613); announcement effect with `manualTabIndex.set(0)` (l.731–745); `canCreateCharacter` (l.380), `charactersLoaded` (l.185), `isGroup` / `isSoiree` / `isRalliement` (l.240–260).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html` (`mat-tab-group` l.51–614) -- tabs today: group blocks (conjonctions, jeux), soirée or Détails, Fiches (l.413), Invitations (l.454), Membres (l.483), soirée games (l.574), Homme Dragon (l.590), Scénario (l.599), Chapitres (l.604), Chronologie (l.609). Move Chapitres/Scénario/Chronologie to the front (they never render for ralliement) so template order matches the order above.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` (7000+ lines) -- existing tests that assume Détails first or an index are rewritten by key.
- Roster components emitting "+ Inviter" (`roster-rail`, `roster-strip`) -- read only; they keep calling `openInvitationsTab()`.

## Tasks & Acceptance

**Execution:**
- [x] `partie-detail.ts` -- `TabKey`, `tabs()`, `selectedTabKey`, default-tab rule, settle-once effect keyed on role/kind/family, key-based `openInvitationsTab()` and announcement link; remove the three index constructs
- [x] `partie-detail.html` -- reorder tabs, drive `selectedIndex` from `tabs().indexOf(key)`, `(selectedIndexChange)` back to a key
- [x] `partie-detail.spec.ts` -- label order and default for each matrix row (GM chronicle with and without Ryuutama, GM single quest, player chronicle, player single quest, hero to create in both, group, evening); "+ Inviter" opens Invitations (both GM cases); announcement link opens Détails and scrolls; selection kept when a tab appears; back to default on role and kind change; reader not switched to Fiches on late characters; old index-based tests rewritten by key

**Acceptance Criteria:**
- Given Hugo, player of a chronicle, when the party opens, then he lands on Chronologie; given Marc, its GM, then on Chapitres, his upcoming session reading "Je mène"
- Given any internal link or signal, when it fires, then the tab is chosen by key and no remaining code mentions a tab position
- Given web Vitest suites and `tsc`, when run, then all pass (bar the two known date-frozen `calendar-view` tests)

## Implementation Notes

- Temps réel (`docs/checklist.md`) : la sélection d'onglet est un état purement d'interface, aucun affichage scopé à la Partie n'est ajouté — aucun câblage `changed`/`notifyChanged()` nécessaire.
- `tabs()` est la seule source de vérité : le gabarit lit chaque condition d'onglet via `hasTab(clé)`. L'index du `mat-tab-group` n'existe qu'au rendu (`tabs().indexOf(displayedTabKey())`), `(selectedIndexChange)` le ramène à une clé.
- `displayedTabKey` = sélection si encore rendue, sinon onglet d'arrivée courant (`defaultTabKey()`). Un seul effet fige l'arrivée (une fois, après `charactersLoaded`) et la réarme sur changement de `tabSetKey` (rôle MJ/joueur, nature, famille) ou sur une clé qui n'est plus rendue.
- Revue : Détails et Jeux (groupe / soirée) rendent chacun sous leur propre `hasTab(...)` ; `defaultTabKey()` retombe sur `tabs()[0]` quand la règle d'arrivée désigne une clé non rendue (jamais d'index -1).
- Tests : `createFixtureOnDetails` / option `openTab` (par clé) pour les tests qui lisent le contenu de « Détails », désormais non rendu à l'arrivée d'un MJ (Chapitres) ou d'un joueur (Chronologie).

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|-------|---------|---------|------------------|
| 1 | blind, edge | Détails (`@else` of soirée) and the group Jeux tab do not read `hasTab()`; "single source of truth" overstated, drift risk between `tabs()` and the template | medium | Real developer-side drift risk (changing a rule in `tabs()` only would map clicks to the wrong key); no wrong behavior today, both orders are asserted by tests. Patched: Détails under `hasTab('details')`, group Jeux under `hasTab('jeux') && isGroup()`. |
| 2 | blind, edge | `defaultTabKey()` may return a key that is not rendered (`[selectedIndex]` = -1) | low | Not reachable with real fixtures today, trivial guard. Patched: falls back to `tabs()[0]`, one test. |
| 3 | edge | Announcement link lost if announcements load before the party, or consumed on a soirée | false | `ngOnInit` loads the party before announcements (verified by the gap layer); campaign announcements live in Détails only, which a soirée has none of. |
| 4 | blind | Arrival effect wipes a selection made before the first settle | false | Selections come from UI or from the announcement link, both after the party is loaded. |
| 5 | blind | Player who must create a hero briefly sees Chronologie before Fiches | low | By spec: the default waits for `charactersLoaded`; same transient pattern as before (it was Détails). Rejected. |
| 6 | blind | Pending-vote pill and announcements now sit behind a tab click | false | Frozen by the epic (order and default tab per role, UX-DR77 to UX-DR80); flagged with the warning sign in the presentation. |
| 7 | blind | Query-param addressing of tabs | false | Out of scope of this story. |
| 8 | blind | Tests: private state casts, noop animations in helper, missing parity table / late-arrival nuances | low | Gap layer: label-order and click tests assert `tabs()` and rendered tabs; cosmetic otherwise. Rejected. |
| 9 | blind | `tabSetKey` ignores `isSoireeOpen` | false | A closing evening removes Jeux, caught by the "key no longer rendered" rule. |
| 10 | edge | `onTabIndexChange` may store a wrong key if `tabs()` changed before Material emits | low | Tabs append at the end or follow role changes that reset the selection; no demonstrated case. Rejected. |
| 11 | gap | No verification gaps | — | Layer reported none. |

Patches verified: full web suite 4917 passed, 2 failed (the two known date-frozen `calendar-view` tests); `tsc` shows no error beyond TS6059.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test --watch=false` -- expected: green except the two known `calendar-view` date-frozen tests
- `docker compose exec web pnpm exec tsc --noEmit -p tsconfig.spec.json` -- expected: no new error
