---
title: 'Découpe des thèmes et renommage en `atelier-cuivre`'
type: 'refactor'
created: '2026-10-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '56a27305a2eb869446e95f1e89245d5641662317'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-35-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le registre des textes de thème tient en un seul fichier de 1355 lignes : on ne relit pas un univers d'un seul tenant, et une clé manquante dans un thème ne serait découverte qu'à l'affichage. Le thème `medieval-steampunk` doit aussi devenir `atelier-cuivre` (« Atelier Cuivré ») sans qu'aucun compte ne perde son choix.

**Approach:** Un fichier par thème sous `core/theme/tones/`, `grimoire-emeraude` fixant les clés que les deux autres doivent porter (erreur de compilation sinon) ; renommage de l'identifiant partout ; migration des valeurs `User.theme` dans la même story.

## Boundaries & Constraints

**Always:**
- Aucun texte perdu ni modifié à la découpe : 379 clés par thème, valeurs identiques (test de parité existant conservé).
- Sites d'import inchangés : `THEMES`, `THEME_NAMES`, `TONE_MAP`, `Theme` restent exportés par `core/theme/tones` (résolu vers `tones/index.ts`, l'ancien `tones.ts` supprimé). `TONE_MAP` garde son type public `Record<Theme, Record<string, string>>` : la parité se vérifie à la définition de chaque fichier, pas dans l'API des consommateurs.
- `THEMES` (`@master-jdr/shared`) reste la seule liste ; la validation API en découle. Import runtime, jamais `import type`.
- Migration SQL écrite à la main (patron de `20261004120000_homme_dragon_multi_aventures`), idempotente : `UPDATE "User" SET "theme"='atelier-cuivre' WHERE "theme"='medieval-steampunk'`. `NULL` intact.
- Une valeur `jdr-theme` d'avant renommage dans `localStorage` est lue comme `atelier-cuivre`.
- Les identifiants internes du motif visuel (`SteampunkBanner`, `drawSteampunk`, `BANNER_BOUNDS.steampunk`, `auth-band` : `'atelier'`) ne sont pas renommés ; seul l'identifiant de thème l'est.
- Commentaires et messages en français.

**Never:**
- Ne pas modifier le contenu des textes (relecture = 35.3), ni le CI, ni ajouter de dépendance.
- Décision de l'utilisateur : les textes liés à un système de jeu (règles, aides rédigées pour guider le joueur dans la création de personnage, ex. `evolution.levelup_step_pv_pe`) ne sont **pas concernés** par cette story : ni déplacés, ni réécrits, ni audités ici. Leur classement relève de la 35.2.
- Pas de nouvelle clé de ton.

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Compte migré | `User.theme = 'medieval-steampunk'` avant migration | Connexion : thème Atelier Cuivré appliqué | N/A |
| Jamais choisi | `User.theme = NULL` | Inchangé | N/A |
| Cache local ancien | `jdr-theme = 'medieval-steampunk'` | Lu comme `atelier-cuivre` | N/A |
| Clé manquante | thème sans une clé de référence | Échec de `pnpm build` du web | erreur de type |
| Ancienne valeur envoyée à l'API | `PATCH` thème `medieval-steampunk` | Refusée (400) | validation `THEMES` |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts` L8 -- `THEMES` : renommer le littéral.
- `apps/web/src/app/core/theme/tones.ts` (1355 l.) -- blocs : émeraude L16, forêt L474, steampunk L917 ; à éclater en `tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre,index}.ts`. Référence : `ToneKey = keyof typeof grimoireEmeraude`, les deux autres typés `Record<ToneKey, string>`.
- `apps/web/src/app/core/theme/theme-tone.service.ts` -- `readStoredTheme()` : alias de l'ancien nom.
- `apps/web/src/styles.scss` L196-197 -- classe racine `.theme-medieval-steampunk` + titre.
- Consommateurs du littéral : `shared/party-countdown/party-countdown.html:38`, `shared/party-banner/party-banner.ts:134`, `core/parties/party-banner.util.ts` L259/511/536, `features/auth/auth-band/auth-band.ts:18`, `features/account/theme-selector/theme-selector.ts` L20/26, commentaire `calendar-detail-rail.scss:4`, et leurs specs.
- `apps/api/prisma/seed-demo.ts` L411/442 ; specs API (`auth.service.spec.ts:239`, `account.controller.spec.ts` ~L294) ; `apps/api/prisma/migrations/` -- nouvelle migration de données.
- `theme-tone.service.spec.ts` -- tests de parité existants (L422, L497) : les garder.

## Tasks & Acceptance

**Execution:**
- [x] `tones/*` + suppression de `tones.ts` -- découpe, typage depuis la référence, `THEME_NAMES['atelier-cuivre'] = 'Atelier Cuivré'`
- [x] `packages/shared`, `styles.scss`, consommateurs web, `seed-demo.ts` -- renommage de l'identifiant
- [x] `theme-tone.service.ts` -- alias du cache local ancien
- [x] `prisma/migrations/<horodatage>_theme_atelier_cuivre/migration.sql` -- migration des valeurs
- [x] specs web/API -- identifiant renommé ; tests : alias `localStorage`, `THEME_NAMES`, parité conservée

**Acceptance Criteria:**
- Given le registre découpé, when on compare avant/après, then aucun texte n'a changé et chaque thème se relit dans son fichier.
- Given un thème auquel manque une clé de référence, when `pnpm build` du web tourne, then il échoue avant l'exécution.
- Given un compte `medieval-steampunk` avant la migration, when il se connecte après, then il retrouve son thème, affiché « Atelier Cuivré ».

## Implementation Notes

- Implémenté par sous-agent ; diff relu et commandes rejouées par l'étape build. Découpe : `tones/{grimoire-emeraude,foret-ancienne,atelier-cuivre,index}.ts`, `ToneKey = keyof typeof grimoireEmeraude`, `TONE_MAP` garde son type public large. Migration `20261005120000_theme_atelier_cuivre` (UPDATE idempotent).
- La suppression de `tones.ts` a été refusée au sous-agent par le contrôle de permissions ; l'utilisateur l'a faite lui-même.
- Écarts corrigés à la relecture : deux occurrences de `medieval-steampunk` oubliées dans `auth.service.spec.ts` (l'erreur de type du build les a révélées) ; fichiers de thème non conformes à Prettier alors que `tones.ts`, `theme-tone.service.ts` et `auth.service.spec.ts` l'étaient au HEAD (`prettier --write` du projet) ; test API ajouté pour la ligne « ancienne valeur → 400 » de la matrice.
- Vérifié : web 2999/3001 (2 échecs `calendar-view.spec.ts`, dates figées, préexistants), `pnpm build` web propre, API 1549/1551 d'après le sous-agent (2 échecs de date connus) + `account.controller.spec.ts` 40/40 ; aucun texte perdu (comparaison ligne à ligne de l'ancien `tones.ts` au HEAD avec les trois nouveaux fichiers : seules les lignes d'enveloppe diffèrent) ; une clé retirée à `atelier-cuivre` fait échouer le build (TS2741), puis remise ; migration appliquée sur la base de dev (0 `medieval-steampunk`, 2 `atelier-cuivre`, `NULL` intacts).
- Lignes de la matrice sans test automatisé : « compte migré » et « jamais choisi » (migration SQL, vérifiée en l'appliquant à la base de dev), « clé manquante » (erreur de compilation, vérifiée à la main, la CI ne construit pas le front).
- Non vérifié : parcours manuel dans un navigateur (compte de démo en Atelier Cuivré après reconnexion).

## Review Triage Log

- **[verif-gap] Migration SQL sans test de données (UPDATE supprimé ou coquille invisible de la CI)** — `low`, rejeté : la migration est appliquée sur la base de dev (0 `medieval-steampunk` après, `NULL` intacts) ; le dépôt ne teste aucune migration SQL écrite à la main, une infrastructure de test de migration dépasse une correction directe.
- **[edge/verif-gap] `AuthService.syncTheme` n'applique pas l'alias à une valeur de compte `medieval-steampunk` (migration pas encore jouée, déploiement en deux temps)** — `low`, rejeté : aucune production, la migration livrée avec la story réécrit toute ligne existante et l'API refuse désormais l'ancien identifiant en écriture ; garder l'alias côté compte ajouterait une branche pour un état non atteignable une fois migré.
- **[blind/edge] Ancien bundle web qui `PATCH` l'ancien identifiant → 400** — `low`, rejeté : comportement voulu par la matrice (« refusée (400) ») ; aucun client en production.
- **[edge/blind] Alias `localStorage` jamais réécrit, sans critère d'expiration ; chemin `applyVisitTheme()` non testé** — `low`, rejeté : toutes les lectures passent par `readStoredTheme()` (même aide, chemin du constructeur testé) ; inoffensif.
- **[blind/edge] `TONE_MAP` typé large, `ToneKey` non propagé aux consommateurs** — `low`, rejeté : choix gravé dans le bloc figé (« type public large ») pour ne pas casser les consommateurs ; le corriger demande de modifier la spec.
- **[blind] Identifiants internes (`SteampunkBanner`, `drawSteampunk`, `steampunk()`, `'atelier'`) non renommés** — `low`, rejeté : exclu explicitement par le bloc figé.
- **[blind] Test de parité des clés redondant avec le typage** — `low`, rejeté : Vitest ne vérifie pas les types et la CI ne construit pas le front ; ce test est le seul filet côté CI.
- **[blind] Cartes `Record<Theme, …>` écrites à la main qui dériveraient** — `false` : chacune est typée `Record<Theme, …>`, une entrée manquante ne compile pas (build vert).
- **[blind] `Object.hasOwn` demande ES2022** — `false` : la cible web est ES2022 et `pnpm build` passe.
- **[blind] Classe `theme-*` ancienne résiduelle au `body`** — `false` : `applyClass()` retire toute classe `theme-*` avant de poser la sienne.
- **[edge] `tones.ts` supprimé : exports ou commentaires orphelins** — `false` : seuls `THEMES`, `THEME_NAMES`, `TONE_MAP` et `Theme` existaient, tous ré-exportés par `tones/index.ts` ; comparaison ligne à ligne faite, seul l'enveloppe diffère.
- **[blind] Commentaire de `calendar-detail-rail.scss` remanié sans apport** — `low`, rejeté : correction d'une phrase devenue fausse (« prévu à l'épic 35 »), sans enjeu.
- **[blind] `docs/backlog.md:172` cite encore « Médiéval Steampunk »** — patch, appliqué (une ligne).
- **[blind] Commentaire de `calendar-agenda-view.scss` : « thème Steampunk »** — patch, appliqué.
- **[blind] En-tête CSS `.theme-atelier-cuivre` plus court que les deux autres** — patch, appliqué.
- **[blind] Traçabilité réglementaire (IEC 62304) de la migration et du changement de contrat d'API** — hors diff : rappel porté à la présentation, aucun changement de code.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false` -- expected: tout passe (hors échecs préexistants `calendar-view.spec.ts`)
- `docker compose exec api pnpm test` -- expected: aucune régression nouvelle
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front)
- migration appliquée par l'outillage Prisma du projet -- expected: plus aucun `medieval-steampunk` dans `User.theme`

**Manual checks (if no CLI):**
- Compte de démo en Atelier Cuivré (`seed-demo`) : thème retrouvé après reconnexion.
