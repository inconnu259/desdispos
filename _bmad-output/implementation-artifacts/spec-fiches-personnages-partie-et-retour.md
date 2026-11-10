---
title: 'Onglet « Fiches » générique (tous les personnages de la partie) et bouton retour sur la fiche'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_commit: '310e959eeed19b2629fb4c610f21b2a739cb6f01'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'onglet « Ma fiche » de l'écran de partie (non-MJ) n'affiche que le personnage du
joueur courant — un CTA de création s'il n'en a pas — alors que `characters()` contient déjà tous
les personnages de la partie depuis la Story 31.5. Il n'y a pas de vue rapide, en liste, de tous
les personnages avec leur niveau. Par ailleurs, `CharacterSheet` n'offre aucun moyen de revenir
explicitement à la partie (retour navigateur uniquement).

**Approach:** Transformer l'onglet en liste générique « Fiches » : tous les personnages de la
partie, le sien en premier, avec niveau et classe (réutilise `app-character-summary-card`,
déjà capable d'afficher le niveau). Ajouter un lien « Retour à la partie » en tête de
`CharacterSheet`, sur le patron déjà utilisé par `scenario-detail.html`.

## Boundaries & Constraints

**Always:** L'onglet reste réservé au non-MJ (`@if (!isMj())`, inchangé) — cette story ne touche
pas à la vue MJ, qui a déjà son roster complet. Le lien retour utilise `character().partieId`
(déjà présent sur `CharacterDto`), aucune nouvelle donnée à charger.

**Amendement (renégociation utilisateur, 2026-09-22, en cours de revue)** : `showOwnerInfo` de
`app-character-summary-card` passe à `true` sur cette liste — décision explicite de l'utilisateur
après vérification visuelle réelle (« il faudrait rajouter le nom du joueur aussi, ça sera
beaucoup plus clair comme ça »), qui **déroge sciemment** à la règle générale du composant
(« jamais pour un joueur », AC3 d'une story antérieure, conçue pour le roster/les listes
immersives) — dérogation locale à cet onglet uniquement, la règle générale reste inchangée
partout ailleurs (roster, `MyCharacters`, etc.).

**Never:** Pas de `RouteReuseStrategy` custom pour préserver l'onglet sélectionné au retour —
hors périmètre, changement architectural plus large ; le retour vers l'écran de partie retombe
sur l'onglet par défaut comme c'est déjà le cas aujourd'hui pour toute navigation vers cet écran.
Ne pas toucher au panneau Troupe (roster desktop/mobile) ni à sa logique — il reste tel quel en
plus de cet onglet (décision utilisateur). Ne pas ajouter d'action d'édition/suppression sur les
cartes de personnages d'autrui dans cette liste — lecture seule, navigation uniquement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Joueur avec personnage, partie à plusieurs personnages | `characters()` = [le sien, 2 autres] | liste triée : le sien en premier, puis les autres, chacun avec niveau/classe/nom du joueur | N/A |
| Joueur sans personnage, d'autres en ont | `characters()` = [2 autres, aucun du viewer] | message « aucun personnage » + CTA création si éligible, ET la liste des autres personnages en dessous | N/A |
| Joueur sans personnage, personne d'autre n'en a | `characters()` = [] | message + CTA seulement, aucune liste | N/A |
| Clic sur « Retour à la partie » depuis une fiche | `character().partieId` connu | navigation vers `/parties/:partieId` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts:193-197` (`myCharacters`) --
  laisser inchangé (sert encore `canCreateCharacter`) ; ajouter juste après un nouveau `computed`
  `charactersSelfFirst` qui partitionne `characters()` en `[mine, others]` sur `c.userId ===
  auth.currentUser()?.id` et retourne `[...mine, ...others]` -- alimente la nouvelle liste.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:210-242` (onglet `Ma fiche`)
  -- remplacer la boucle `@for (character of myCharacters(); ...)` (ligne 232) par
  `charactersSelfFirst()` ; garder le bloc « aucun personnage »/CTA (lignes 219-230) tel quel,
  basé sur `myCharacters().length === 0` (l'absence de personnage PERSONNEL, pas de la partie) --
  les deux blocs cohabitent (voir I/O Matrix, cas 2). Ne pas passer `[showOwnerInfo]` à
  `app-character-summary-card` (défaut `false`, cf. Boundaries).
- `apps/web/src/app/core/theme/tones.ts:260,661,1051` (`character.my_sheet_tab_label`) -- changer
  la valeur de `'Ma fiche'` à `'Fiches'` dans les 3 blocs de thème (clé inchangée, seul autre
  consommateur : `partie-detail.html:211`, vérifié sans autre référence).
- `apps/web/src/app/features/characters/character-summary-card/` -- aucune modification, composant
  déjà générique (niveau via `levelLabel`, `showOwnerInfo` déjà à `false` par défaut).
- `apps/web/src/app/features/characters/character-sheet/character-sheet.html:1-5` -- insérer, en
  premier élément de la page (avant `<article class="sheet">`), un lien retour sur le patron de
  `apps/web/src/app/features/scenarios/scenario-detail/scenario-detail.html:1-5`
  (`<a mat-button [routerLink]="['/parties', c.partieId]"><mat-icon>arrow_back</mat-icon>
  {{ theme.tone()['character.back_to_partie_cta'] }}</a>`), à l'intérieur du bloc
  `@else if (character(); as c)` existant (ligne 3) pour disposer de `c.partieId` sans nouvel état
  composant. Ne pas intégrer le lien dans `.sheet__header` (ligne 5) : risque de casser la mise en
  page mobile du header existant pour un gain minime, et patron déjà éprouvé ailleurs dans l'app.
- `apps/web/src/app/core/theme/tones.ts` -- ajouter la clé `character.back_to_partie_cta` (valeur
  `'Retour à la partie'` ou équivalent par thème) dans les 3 blocs, avec le test de parité existant
  (`theme-tone.service.spec.ts`).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- ajouter le computed
  `charactersSelfFirst` -- porte le tri « soi en premier »
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.html` -- boucler sur
  `charactersSelfFirst()` au lieu de `myCharacters()` dans l'onglet -- porte la liste générique
- [x] `apps/web/src/app/core/theme/tones.ts` -- renommer le libellé de l'onglet en « Fiches » +
  ajouter `character.back_to_partie_cta` (3 blocs) -- porte le libellé et le lien retour
- [x] `apps/web/src/app/features/characters/character-sheet/character-sheet.html` -- ajouter le
  lien « Retour à la partie » -- porte le bouton retour
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests : liste
  complète triée soi-premier, cas sans personnage personnel avec d'autres présents, libellé
  d'onglet
- [x] `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts` -- test :
  lien retour présent avec le bon `routerLink`
- [x] `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- vérifier que le test de parité
  existant couvre la nouvelle clé sans modification (sinon l'étendre) -- aucun test existant ne
  couvrait `my_sheet_tab_label`/`back_to_partie_cta` : nouveau describe de parité ajouté

**Acceptance Criteria:**
- Given un joueur ouvre l'onglet « Fiches » de sa partie, when la partie a plusieurs personnages,
  then tous y figurent, le sien en tête, avec niveau et nom du joueur propriétaire visibles
- Given un joueur consulte la fiche d'un personnage, when il clique sur « Retour à la partie »,
  then il revient sur l'écran de la partie correspondante

## Implementation Notes

- Le Code Map décrivait un remplacement de boucle dans un `@else` existant (`@if
  (!charactersLoaded()) {...} @else if (myCharacters().length === 0) {...} @else {...}`), mais
  cette structure est mutuellement exclusive : le message/CTA et la liste ne peuvent jamais
  s'afficher ensemble, ce qui contredit explicitement le cas 2 de l'I/O Matrix (« les deux blocs
  cohabitent »). Restructuré en `@if (!charactersLoaded()) {...} @else { @if
  (myCharacters().length === 0) {...} @if (charactersSelfFirst().length > 0) {...} }` -- deux
  `@if` indépendants dans la même branche `@else`, qui peuvent tous deux rendre. Comportement
  inchangé pour les cas 1/3/4 de la matrice, corrigé pour le cas 2.
- `character.no_character_yet` n'a pas changé de clé ni de sens (toujours « aucun personnage
  PERSONNEL ») malgré le renommage de l'onglet en « Fiches » -- cohérent avec le Code Map (« garder
  le bloc … tel quel »).
- Aucun test de parité existant ne couvrait `character.my_sheet_tab_label` (renommée `character.
  back_to_partie_cta` est nouvelle) ; les deux tâches associées auraient été fausses vertes sans
  ajout d'un describe dédié dans `theme-tone.service.spec.ts`.
- Vérification : `pnpm test` (2418/2420 verts -- 2 échecs pré-existants, sans rapport, dans
  `calendar-view.spec.ts`, dépendants de la date système), `pnpm lint` (0 erreur sur les fichiers
  touchés par cette story ; le reste des erreurs rapportées est une dette de formatage
  pré-existante dans des fichiers non touchés), `ng build --configuration development` (propre,
  avertissements pré-existants sans rapport). Vérification visuelle des 3 thèmes non effectuée
  (accès à l'app nécessite une authentification, hors de portée de cet agent) -- reste à faire par
  l'utilisateur, cf. section Verification.

## Spec Change Log

## Review Triage Log

- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` (`charactersSelfFirst`) —
  **low** — vérifié : refiltre `characters()` indépendamment de `myCharacters()` au lieu de le
  réutiliser ; si la définition de « mon personnage » change un jour dans l'un sans l'autre, les
  deux computed divergent silencieusement. → patch
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html`
  (`@if (charactersSelfFirst().length > 0) { @for (...) }`) — **low** — vérifié : `@for` sans bloc
  `@empty` ne rend déjà rien sur un tableau vide, le `@if` englobant est une garde morte issue du
  refactor. → patch
- Pas de distinction visuelle entre sa propre carte et celles des autres dans l'onglet « Fiches »
  — **medium** — confirmé en vérification visuelle réelle pendant cette revue, et par retour
  direct de l'utilisateur qui a testé l'écran en direct (« il faudrait rajouter le nom du joueur
  aussi, ça sera beaucoup plus clair comme ça ») → patch, cf. amendement du Intent ci-dessus
  (`showOwnerInfo` passe à `true` sur cette liste).
- `character.my_sheet_tab_label` (clé), `.my-sheet-tab` (classe CSS), commentaire
  `/* — état vide "Ma fiche" — */` dans `tones.ts` — **low** — vérifié par 2 couches
  indépendamment : la sémantique est devenue « Fiches » (liste de toute la partie) mais
  l'identifiant interne garde le nom « my/Ma fiche », risque de confusion pour un futur
  développeur. → patch (renommer clé + classe + commentaire ; les titres historiques
  `describe`/`it` de `partie-detail.spec.ts` mentionnant « Ma fiche » sont laissés tels quels,
  cohérent avec la convention du dépôt de garder trace des stories dans les commentaires).
- `character-sheet.html` : le lien « Retour à la partie » n'existe que dans la branche
  `@else if (character(); as c)` ; la branche `@if (loadError(); as error)` (ligne 1-2) n'offre
  toujours aucun moyen de revenir à la partie — **medium** — vérifié en lisant le template : un
  échec de chargement (403, réseau) laisse l'utilisateur bloqué sans navigation, hors retour
  navigateur. → patch
- Risque de chevauchement visuel du lien retour avec l'en-tête de la fiche (pas de style dédié) —
  **false** — réfuté par vérification visuelle réelle (Chrome, session connectée) : rendu propre,
  espacé, aucun chevauchement constaté sur desktop.
- `charactersSelfFirst` non testée pour `auth.currentUser()?.id === undefined` — **false** —
  réfuté : `myCharacters()`, préexistant et non modifié par cette story, a exactement le même
  motif non gardé ; aucun risque nouveau introduit par ce diff.
- Lien retour sans garde `@if (partieId)` contrairement au patron `scenario-detail.html` — **false**
  — réfuté : `CharacterDto.partieId` est un `string` requis (jamais `null`), contrairement au
  `partieId` de `scenario-detail` dérivé de la route (nullable) — la garde serait morte.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- tests `partie-detail`, `character-sheet`,
  `theme-tone.service` verts, reste = baseline
- `docker compose exec web pnpm lint` -- = baseline
- `docker compose exec web pnpm ng build --configuration development` -- propre

**Manual checks (vérification visuelle réelle, 3 thèmes) :**
- En tant que joueur avec personnage : onglet « Fiches » -- le sien en premier, niveaux visibles,
  clic sur un autre personnage ouvre bien sa fiche en lecture seule.
- En tant que joueur sans personnage sur une partie où d'autres en ont : message + CTA, ET liste
  des autres en dessous.
- Depuis une fiche (la sienne et celle d'un compagnon) : bouton retour visible et fonctionnel,
  desktop et mobile.
