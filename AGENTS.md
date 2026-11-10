<!-- bmad:context -->
<!-- Verified 2026-08-25 against 7ec746e. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## desdispos

Plateforme web de gestion de parties de JDR, multi-systèmes (MJ + joueurs). Angular 22 + NestJS 11 + Prisma 7 sur PostgreSQL 17, monorepo pnpm, exécution 100 % Docker. Vision dans `docs/spec.md`, feuille de route dans `docs/backlog.md`, démarrage dans `README.md`. Lire `CLAUDE.md` avant d'écrire du code : il porte les règles Docker, dépendances, langue, architecture plugin, temps réel SSE et Context7.

## Politique

- Ne jamais modifier l'état git — commit, branche, push, pull, merge, rebase, reset, stash, tag. Préparer le message ou la marche à suivre ; l'humain exécute.
- Ne jamais éditer `apps/api/game-systems/*/data/*.json` sans demande explicite : contenu de règles curé à la main, transcrit depuis `docs/`. Ne rien y inventer ni générer — le texte est fourni.

## Où sont les choses

- Backend : `apps/api/src/<domaine>/`, un module NestJS par domaine (`auth`, `parties`, `characters`, `realtime`, `scenarios`…).
- Frontend : `apps/web/src/app/core/` pour les services, `features/` pour les pages, `layout/` et `shared/` pour le reste.
- Système de jeu Ryuutama : `apps/api/game-systems/ryuutama/` — `data/*.json` pour le contenu, `assets/` pour les visuels.
- Règles de jeu exécutables, avec leurs tests : `packages/game-rules/`.
- Chercher la doc projet dans `docs/spec.md`, `backlog.md`, `palier-1.md`, `security.md`, `checklist.md` seulement — les autres `docs/*.md` sont du contenu de règles Ryuutama (matière première des JSON), pas de la doc de dev.

## Exécuter et vérifier

- Ne rien lancer sur l'hôte : `docker-compose.yml` monte les `node_modules` dans des volumes Docker nommés, donc les répertoires visibles côté hôte sont vides et les quelques liens de `packages/game-rules/node_modules` pointent dans le vide. Aucun binaire (`eslint`, `jest`, `vitest`, `tsc`, `prisma`) n'y est exécutable — passer par `docker compose exec api|web pnpm <...>`, stack démarrée.
- Lancer chaque suite dans son propre conteneur : `api` ne monte pas les `node_modules` de `web` ni l'inverse, donc `pnpm -r test` depuis un conteneur échoue sur l'autre workspace. Utiliser `docker compose exec api pnpm test`, `docker compose exec web pnpm test`, et `docker compose exec -w /work/packages/game-rules api pnpm test`.
- Ne pas déduire d'une CI verte que tout est vérifié : le front n'a aucun script `typecheck`, c'est `pnpm --filter web build` qui type-vérifie le code Angular. Et CodeQL comme `pnpm audit` tournent dans leurs propres workflows, **hors de la porte `ci-ok`** : ils informent, ils ne bloquent pas un merge.
- Ne pas remettre `typecheck` sur `tsconfig.build.json` : ce dernier sert au build (`nest build`) et exclut `test/` et `**/*spec.ts`. Le `typecheck` passe par `tsconfig.check.json`, qui couvre source + specs + scripts `prisma/` — les specs y ont révélé 101 erreurs de typage de mocks, dont trois mocks qui portaient déjà une annotation mensongère.
- Recréer les volumes `node_modules` après tout changement de `pnpm-lock.yaml` — `docker compose down && docker volume rm project_node_modules_root project_node_modules_api project_node_modules_web && docker compose up -d`. `pnpm install`, **même avec `--frozen-lockfile --force` ou `--filter <projet> --force`**, rapporte un faux succès sur un volume désynchronisé : il se fie à ses fichiers d'état, pas au contenu réel. Observé quatre fois le 2026-08-27 — un script de `package.json` invisible du conteneur, un `prettier` résolu en 3.8.4 alors que le lockfile disait 3.9.6 (le lint contredisait alors la CI), un `prisma` introuvable empêchant l'API de démarrer, et un `apps/api/node_modules` resté vide malgré trois installations annoncées réussies.
- **Toujours supprimer les trois volumes ensemble, `project_node_modules_root` compris.** Les fichiers d'état de pnpm (`.modules.yaml`, `.pnpm-workspace-state-v1.json`) vivent dans le volume racine : tant qu'ils survivent, pnpm considère tous les projets installés et ne repeuple aucun volume vidé, quelle que soit l'option passée. Ne recréer que `project_node_modules_api` ne répare rien — piège vérifié.
- Ne jamais lancer deux installations `pnpm` en parallèle dans deux conteneurs : elles écrivent dans le même store `node_modules_root` et le corrompent (`ERR_PNPM_ENOENT` sur un `rename` de fichier temporaire). Attention, pnpm 11 déclenche un install implicite avant chaque script (`runDepsStatusCheck`) — un simple `docker compose exec api pnpm <...>` suffit à entrer en collision avec un `deps` en cours.
- Ne pas régénérer le client Prisma ni appliquer les migrations à la main : `docker compose up` enchaîne `prisma generate`, `migrate deploy` et le seed admin (idempotent, `upsert` avec `update: {}`) à chaque démarrage.
- Ne pas conclure d'un `pnpm test` vert dans `apps/api` que `@desdispos/game-rules` se charge : tous les specs unitaires qui l'atteignent le neutralisent par `jest.mock('@desdispos/game-rules', …)`. Seuls les e2e (`test/`, config propre, `pnpm test:e2e`) le chargent pour de vrai.
- Ne pas retirer le `moduleNameMapper` `"^(\.{1,2}/.*)\.js$": "$1"` des deux configs Jest d'`apps/api` (bloc `jest` de `package.json` et `test/jest-e2e.json`) : `rewriteRelativeImportExtensions` du `tsconfig.json` réécrit à l'émission les imports `.ts` de `packages/game-rules/src/index.ts` en `.js` qui n'existent pas sur le disque. Sans ce mapper, tout chargement réel du paquet échoue — c'est ce qui cassait `app.e2e-spec.ts` de `3567c58` (2026-07-26) au 2026-08-25.

## Conventions qui s'écartent des défauts

- Ne pas importer `@desdispos/shared` avec `import type` par défaut : le paquet exporte aussi des valeurs runtime (`THEMES`, `GAME_SYSTEMS`, `CALENDAR_LAYER_KEYS`, `checkPartieKindTransition()`). `import type` sur une valeur l'efface et casse à l'exécution — `import type` pour les types, import normal pour les valeurs.

<!-- /bmad:context -->
