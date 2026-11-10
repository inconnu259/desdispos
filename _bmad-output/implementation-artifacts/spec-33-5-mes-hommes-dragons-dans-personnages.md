---
title: 'Mes Hommes Dragons dans « Personnages »'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '03148c317a6e5a26f6439e055c02a42f14294b8a'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-33-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-21/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le MJ retrouve les personnages de ses joueurs dans « Personnages », mais pas son Homme Dragon : sa fiche n'a pas de route et n'est atteignable que par l'onglet de la partie, et il n'a aucune entrée de création depuis cet écran.

**Approach:** Une lecture agrégée dédiée `GET /me/homme-dragons` (une requête, sans toucher `MyCharacterDto`) fusionnée côté web avec la liste des personnages ; une carte marquée d'un `NatureMarker` ; une route propre qui ouvre la fiche ; une ligne « Créer un Homme Dragon pour <aventure> » dans la section de création de la 29.16.

## Boundaries & Constraints

**Always:**
- Lecture serveur : `hommeDragon.findMany({ where: { userId, partie: { mjId: userId } }, include: { partie: { select: { id, name } } } })`, tri `createdAt desc`. Le contrat est un **tableau** : jamais de « un par partie » figé (33.8), aucun drapeau `canCreate`. Garde `AuthenticatedGuard`, scopé à l'appelant : un Homme Dragon n'est jamais servi à un autre membre.
- `MyHommeDragonDto` (dans `packages/shared`) léger : `id`, `partieId`, `partieName`, `gameSystemId`, `nom`, `race`, `avatar?`, `createdAt`. Pas de `derived` ni de niveau (aucun `groupBy` de scénarios). Ne pas réutiliser `buildDto` du service (fan-out par partie).
- La carte d'Homme Dragon est la carte de personnage (mêmes densités, même grille) avec un `NatureMarker` neuf (`shared/nature-marker/`) : icône + « Homme Dragon » en moyen/grand, icône seule + `aria-label` en compact, contour `accent-2`, sans fond de statut. « Homme Dragon » n'est jamais thématisé (clé `character.nature_dragon`, identique dans les 3 blocs de `tones.ts`, parité testée). Nom via `IdentityLabel` (mode nom de personnage), repli « Homme Dragon sans nom » comme `HommeDragonSheet`. Pas de pastille de niveau ni de bulle de montée de niveau. Les consommateurs actuels de `CharacterSummaryCard` ne changent pas.
- Recherche sur le nom affiché ; tri « Partie » et « Nom » sur les deux natures ; tri « Niveau » : les Hommes Dragons passent **après** tous les personnages (entre eux : nom de partie). Mode d'affichage inchangé.
- Ouverture : route neuve `parties/:id/homme-dragon` (chargement différé comme les voisines), page qui héberge `HommeDragonSheet` (elle rend déjà le parcours de création quand aucune fiche n'existe). Si l'utilisateur n'est pas MJ d'une partie Ryuutama → redirection vers `/parties/:id`. L'onglet existant de `partie-detail` et sa logique d'index d'onglets restent intacts.
- Création : `CharacterCreationEntries` accepte aussi des lignes d'Homme Dragon (libellé `my_characters.create_entry_hd` : « Créer un Homme Dragon pour {partie} », ajoutée aux 3 thèmes avec le test de parité et de placeholder), lien (`routerLink`) vers la route ci-dessus. Lignes = parties Ryuutama dont je suis MJ portant le signal `HOMME_DRAGON_A_CREER` (le signal n'est pas filtré par système : filtrer `gameSystemId === 'ryuutama'` côté web). Le message de liste vide `empty_with_entries` tient compte de ces lignes.
- Commentaires et messages d'erreur en français.

**Never:**
- Ne pas modifier `findMine`, `MyCharacterDto`/`CharacterDto`, `CHARACTER_SORTS`, `sortCharacters`, `PERSONNAGE_A_CREER`, `HommeDragonService.create/findOne/buildDto`, la contrainte `@@unique` Prisma, `party-signals.service.ts`, ni les inputs de `HommeDragonSheet`.
- Pas de migration, pas de nouvelle dépendance, pas de temps réel neuf (chargement à l'entrée sur l'écran, comme aujourd'hui ; le signal `user:{id}` rafraîchit déjà les lignes de création).
- Pas de même dragon sur plusieurs aventures (33.8).

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| MJ avec 2 dragons | 2 parties Ryuutama | 2 cartes marquées « Homme Dragon », chacune avec sa partie ; une seule lecture `/me/homme-dragons` | N/A |
| Joueur d'une partie | dragon de son MJ | Absent de sa liste et de la réponse | N/A |
| Ancien MJ | dragon dont `partie.mjId ≠ userId` | Non servi | N/A |
| Tri « Niveau » | personnages + dragons | Dragons en dernier | N/A |
| Recherche | texte = nom du dragon | Dragon retenu | N/A |
| Partie Ryuutama sans dragon | signal `HOMME_DRAGON_A_CREER` | Ligne de création ; disparaît après création | N/A |
| Partie non Ryuutama / terminée | signal absent ou système ≠ ryuutama | Aucune ligne | N/A |
| Aucun élément mais une ligne de création | — | Message `empty_with_entries` | N/A |
| Échec de la lecture des dragons | erreur réseau | Les personnages restent affichés | message d'erreur discret, pas de page vide |
| Route sans droit | utilisateur non MJ | Redirection vers `/parties/:id` | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/characters/my-characters.controller.ts` -- patron du contrôleur `/me/…` (garde, `@CurrentUser`) ; ne pas modifier.
- `apps/api/src/homme-dragon/` -- nouveau `MyHommeDragonsController` (`@Controller('me/homme-dragons')`) + méthode `findMine(userId)` du service (requête unique, pas de `buildDto`) ; enregistrer dans le module. Patrons de tests : `homme-dragon.controller.spec.ts`, `character.service.spec.ts` (`describe findMine`, ~L1006).
- `packages/shared/src/index.ts` -- `MyHommeDragonDto` près de `HommeDragonDto` (~L1196) ; `HommeDragonSheetData.avatar` est une chaîne.
- `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` -- `listMine()` (GET `/me/homme-dragons`) ; `apps/web/src/app/core/characters/character-sort.ts` -- ne pas modifier, ajouter le tri fusionné dans un module voisin pur et testé.
- `apps/web/src/app/features/characters/my-characters/my-characters.{ts,html,spec.ts}` -- chargement parallèle des deux listes (`all` L41, `ngOnInit` L105, `searchFiltered` L65, `creationEntries` L84, `emptyMessageKey` L92) ; `open()` L118 ouvre la route dragon pour un dragon.
- `apps/web/src/app/features/characters/character-summary-card/` -- carte partagée par roster, xp-history, partie-detail, scenario-editor : tout ajout optionnel, comportement actuel par défaut ; `CharacterAvatar` exige un `characterId` (prévoir un repli pour le dragon, rendu de `avatar` aligné sur `HommeDragonSheet`).
- `apps/web/src/app/features/characters/my-characters/character-creation-entries/` -- entrées `{partieId, gameSystemId, partieName}` → ajouter un type d'entrée dragon et son lien.
- `apps/web/src/app/core/theme/tones.ts` (+ `theme-tone.service.spec.ts` ~L295) -- `my_characters.create_entry_hd`, `character.nature_dragon` dans les 3 thèmes (la seconde n'existe pas encore dans le code).
- `apps/web/src/app/app.routes.ts` (L71 `characters`, L98-110 patron `loadComponent`) -- route `parties/:id/homme-dragon` ; nouvelle page dans `features/homme-dragon/` qui charge le nom de la partie et rend `HommeDragonSheet`.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/` et `homme-dragon-creation-wizard/` -- réutilisés tels quels (le wizard émet `created`).
- DESIGN.md §7.4 / EXPERIENCE.md §4.3-4.4 (`ux-designs/ux-jdr-master-2026-09-21/`) -- spécification visuelle du marqueur et de la section.
- `docs/checklist.md` -- vérification temps réel à consigner dans les notes.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- `MyHommeDragonDto` -- contrat de la lecture agrégée
- [x] `apps/api/src/homme-dragon/*` -- `findMine` + contrôleur `/me/homme-dragons` + module -- lecture unique, MJ seul
- [x] `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` + tri fusionné pur -- `listMine()` et ordre « Niveau » en dernier
- [x] `shared/nature-marker/` + `tones.ts` -- marqueur de nature, clés des 3 thèmes
- [x] `character-summary-card` + `my-characters` -- carte et liste fusionnées, recherche/tri/mode, ouverture par la route
- [x] `character-creation-entries` + `my-characters` -- lignes « Créer un Homme Dragon pour … », message de liste vide
- [x] `app.routes.ts` + page d'accueil de la fiche -- route `parties/:id/homme-dragon` et redirection hors MJ
- [x] Tests API (filtre MJ, un autre membre, ancien MJ, tableau vide, pas de fan-out), shared/web (tri, recherche, marqueur compact/large, ligne de création, parité des tons, échec partiel de la lecture) -- couvre la matrice

**Acceptance Criteria:**
- Given un MJ ayant des Hommes Dragons, when il ouvre « Personnages », then chacun s'y lit comme Homme Dragon (icône + mot, ou icône + `aria-label` en compact) avec sa partie, et s'ouvre sur sa fiche.
- Given une aventure Ryuutama dont je suis MJ sans dragon, when j'ouvre « Personnages », then la section de création propose « Créer un Homme Dragon pour <aventure> » et mène au parcours de création.
- Given n'importe quel autre membre de la partie, when « Personnages » est calculé, then le dragon du MJ n'y figure jamais.

## Implementation Notes

- Implémenté par sous-agent, diff relu et commandes rejouées par l'étape build : web ciblé 1163/1163, API complet 1463/1465 (les 2 échecs préexistants connus : `parties.service.spec.ts`, `party-signals.service.spec.ts`), `pnpm build` web propre hors avertissements de budget connus (rapport du sous-agent).
- Écart corrigé à la relecture : le sous-agent avait thématisé le verbe de `my_characters.create_entry_hd` (« Éveiller… », « Assembler… ») ; la spec impose « Créer un Homme Dragon pour {partie} » dans les trois thèmes.
- `CharacterSummaryCard.character` devient optionnel (`input<CharacterDto | null>(null)`) pour porter un Homme Dragon via l'input `hommeDragon` ; tous les sites d'appel existants le fournissent toujours.
- Le message d'échec partiel de la lecture des dragons est écrit en dur en français dans le gabarit (pas de clé de thème).
- Hors périmètre de ce diff : `apps/web/.../calendar-view.spec.ts` a 2 échecs à la suite web complète (non vérifiés sur arbre propre, code non touché).
- Non vérifié : parcours manuel dans un navigateur (MJ avec dragon + aventure sans dragon, trois densités, aller-retour de création, compte joueur) ; aucun test contre une vraie base pour « autre membre » et « ancien MJ » (assertion sur la clause `where` avec Prisma mocké).

## Spec Change Log

## Review Triage Log

- **[verif-gap] `GET /me/homme-dragons` jamais exercé via le câblage Nest (chemin, garde, module)** — `medium`, patch : le spec du contrôleur appelle la méthode directement avec la garde neutralisée ; retirer le contrôleur du module ou renommer le chemin laisserait tout vert alors que le web perdrait tous les dragons.
- **[edge] `raceLabels[race]` non défendu (race inconnue d'une ligne ancienne)** — `low`, patch : correction d'un opérateur (`?? ''`).
- **[blind/edge/gap] La liste des dragons n'est chargée qu'à l'entrée : un dragon créé depuis un autre appareil fait disparaître la ligne de création (SSE `user:{id}`) sans faire apparaître la carte avant rechargement ; évaluation temps réel de `docs/checklist.md` non consignée** — `medium`, defer : le bloc figé exclut tout temps réel neuf (« chargement à l'entrée sur l'écran ») ; le retour du wizard recharge l'écran, seul le cas multi-appareil reste. Consigné dans `deferred-work.md`.
- **[verif-gap] Aucun test de table de routes (`parties/:id/homme-dragon`)** — `low`, rejeté : le dépôt n'a aucun test de ce type, la route tient en trois lignes et son chemin est identique à celui des deux sources de navigation (relu dans le diff) ; ajouter une infrastructure de test de routes dépasse une correction directe.
- **[edge] `HommeDragonPage` : `route.snapshot` lu une fois (changement de `:id` sans détruire le composant)** — `low`, rejeté : le seul chemin d'entrée est « Personnages » ou l'URL directe, qui recréent le composant ; correctif = souscription, branche supplémentaire.
- **[edge] Redirection tardive après destruction de la page** — `low`, rejeté : navigation de remplacement vers la partie déjà visée, scénario improbable.
- **[edge] `auth.currentUser()` non hydraté au rechargement → MJ redirigé à tort** — `false` : `authGuard` (`auth.guard.ts`) attend `loadSession()` avant d'activer la route.
- **[blind/edge] Bandeau contextuel jamais vidé à la sortie de la page** — `false` : `ContextualNavService` se vide sur `NavigationStart`.
- **[edge] `creationEntries` sans contrôle de rôle MJ** — `false` : `HOMME_DRAGON_A_CREER` n'est émis que dans la branche MJ de `party-signals.service.ts` (le `else` de la branche joueur).
- **[blind/edge] `characterId=''` transmis à l'avatar du dragon (graine commune, URL de portrait vide)** — `false` : l'URL de portrait n'est construite que si `portraitUrl` est renseigné (il vaut `null` pour un dragon) ; les initiales dépendent du nom.
- **[edge] `sheetData` nul/malformé fait tomber toute la liste ; `orderBy` sans tie-break ; tri `partie`/`nom` sans tie-break** — `low`, rejeté : colonne JSON obligatoire validée à la création (même lecture que `buildDto`) ; ex æquo improbables et sans conséquence fonctionnelle.
- **[blind] `CharacterSummaryCard` : « exactement l'un des deux » non garanti à la compilation** — `low`, rejeté : tous les sites d'appel fournissent `character` (relu), un garde-fou ou une union ajouterait de l'API publique.
- **[blind] `'ryuutama'` en dur, message d'échec en français en dur sans retry, erreur jamais effacée, contraste de `NatureMarker`, `title`+`aria-label` dupliqués, libellé de repli redondant, pagination à deux lignes par partie, `include` vs `select`** — `low`/`false`, rejetés : le dépôt fait déjà ces deux choix ailleurs (`partie-detail.html`), la lecture n'est faite qu'une fois par entrée d'écran (aucun retry attendu), la variable `--jdr-accent-2` est celle que DESIGN.md §7.4 impose, `sheetData` est nécessaire à la projection, les lignes sont comptées par entrée.
- **[blind] Incohérences de suivi (statut du spec vs sprint-status, journal vide, `docs/backlog.md`, rappel `/security-review`)** — `false` : propres à l'étape en cours ; le rappel de revue de sécurité est porté par l'étape de présentation.

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`parties.service.spec.ts`, `party-signals.service.spec.ts`)
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/characters/**/*.spec.ts"` -- expected: tous les tests passent (idem `core/**`, `shared/**`, `features/homme-dragon/**`)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front)

**Manual checks (if no CLI):**
- Avec un MJ ayant un dragon et une aventure Ryuutama sans dragon : carte + marqueur aux trois densités, ligne de création, création puis retour, tri « Niveau » ; compte joueur de la même partie : aucun dragon.
