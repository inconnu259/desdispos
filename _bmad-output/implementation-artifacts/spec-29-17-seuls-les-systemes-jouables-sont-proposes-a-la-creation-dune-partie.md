---
title: '29.17 — Seuls les systèmes jouables sont proposés à la création d''une partie'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: 'f00ca80f6b585809c806b92044484ca1e6d749cb'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem :** Le formulaire de création de partie propose les 4 systèmes de jeu sans distinction, alors que seul Ryuutama a un module de création de personnage jouable — un MJ peut créer une partie où personne ne pourra jamais créer de personnage. L'indicateur de module existe déjà (`packages/shared`, story 29.15) mais rien ne l'applique encore au formulaire ni côté serveur.

**Approche :** Filtrer les systèmes proposés (création, et tout changement de système en édition) sur `gameSystemHasModule()` ; refuser côté serveur toute création — ou tout changement de système en édition — vers un système sans module, avec un message explicite.

## Boundaries & Constraints

**Always :**
- Seule source de vérité de l'éligibilité = `gameSystemHasModule()`/`GAME_SYSTEMS[].module` (déjà posé par la story 29.15) — jamais une nouvelle liste.
- Création : la liste proposée par `PartieForm` ne contient que les systèmes avec module.
- Édition : le système déjà enregistré de la partie reste visible/sélectionnable dans le menu même sans module (aucune migration, aucune perte de valeur) — mais aucun AUTRE système sans module ne devient choisissable.
- API `PartiesService.create()` : refuse tout `gameSystemId` sans module, `BadRequestException` au texte explicite — même patron que les refus déjà en place dans ce service (texte brut, non thématisé, ex. `partie-service.ts:349-353`).
- API `PartiesService.update()` : refuse un CHANGEMENT vers un système sans module (`dto.gameSystemId` différent de la valeur enregistrée) mais accepte un envoi qui renvoie la valeur déjà enregistrée inchangée — même patron que la garde déjà en place sur `kind` (Story 29.14, `parties.service.ts:349-353`).
- Valeur par défaut du formulaire de création : le premier système avec module (aujourd'hui `ryuutama`), plus jamais `draconis`.
- Corriger le commentaire de `GAME_SYSTEMS` dans `packages/shared/src/index.ts` qui dit encore « story 29.17, hors périmètre ».

**Never :**
- Ne pas toucher `party-signals.service.ts`, `partie-detail.ts`/`canCreateCharacter`, ni `character-wizard.ts` (déjà corrects, stories 29.15/29.16).
- Ne pas ajouter de décorateur `class-validator` personnalisé — le refus vit dans le service, comme toutes les règles métier existantes de ce fichier ; `@IsIn(GAME_SYSTEM_IDS)` des DTO reste tel quel (garde-fou « id connu »).
- Aucune migration Prisma, aucune modification des parties déjà créées sur un système sans module.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Création, formulaire | liste affichée | seuls les systèmes avec module apparaissent | N/A |
| Création, requête API directe sur système sans module | `gameSystemId: 'draconis'` | 400, message explicite, refus avant toute écriture | N/A |
| Édition d'une partie déjà sur système sans module, autres champs modifiés | `gameSystemId` inchangé dans le payload | sauvegarde acceptée, rien ne migre | N/A |
| Édition, tentative de changer vers un autre système sans module | `gameSystemId` différent, sans module | 400, message explicite, refus avant toute écriture | N/A |
| Édition, système actuel sans module | `party.gameSystemId = 'draconis'` | option présente et sélectionnée au chargement du formulaire | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/index.ts:98-109` -- `GAME_SYSTEMS`/`gameSystemHasModule` (déjà là, story 29.15) ; commentaire ligne 103 à corriger.
- `apps/web/src/app/features/parties/partie-form/partie-form.ts:77` -- `systems = GAME_SYSTEMS` (à filtrer) ; `:107` défaut `'draconis'` (à changer) ; `:148-168` `ngOnInit` patch `gameSystemId` à l'édition — source du système actuel pour la liste affichée.
- `apps/web/src/app/features/parties/partie-form/partie-form.html:94-101` -- `<mat-select>` itère `systems`, aucun changement de template requis une fois `systems` filtré côté composant.
- `apps/api/src/parties/parties.service.ts:138-148` -- `create()` écrit `gameSystemId` sans vérification ; `:340-358` `update()` (patron de garde `kind`, `:349-353`, à répliquer pour `gameSystemId`).
- `apps/api/src/parties/dto/create-partie.dto.ts`, `update-partie.dto.ts` -- `@IsIn(GAME_SYSTEM_IDS)` inchangé, la règle module vient du service.
- `apps/api/src/game-systems/supported-game-systems.ts` + `.spec.ts` -- déjà réconciliés avec `GAME_SYSTEMS[].module` (story 29.15), rien à toucher.
- Fixtures `'draconis'` à ajuster côté création uniquement : `apps/api/src/parties/parties.service.spec.ts`, `apps/api/src/parties/parties.controller.spec.ts` -- passer à `'ryuutama'` pour les tests qui créent réellement une partie sans porter sur le module ; garder `'draconis'` pour les tests d'édition/lecture d'une partie déjà existante.
- `apps/web/src/app/features/parties/partie-form/partie-form.spec.ts` -- existant, à étendre.
- Non touchés : `party-signals.service.ts`, `partie-detail.ts`, `character-wizard.ts` (déjà corrects).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` -- corriger le commentaire de `GAME_SYSTEMS` (retirer « story 29.17, hors périmètre ») -- documentation périmée une fois cette story livrée
- [x] `apps/web/src/app/features/parties/partie-form/partie-form.ts` -- `systems` devient un `computed` filtré sur `gameSystemHasModule()` plus le système actuel en édition ; défaut du formulaire = premier système avec module -- seule barrière visible côté formulaire
- [x] `apps/api/src/parties/parties.service.ts` -- `create()` : `BadRequestException` si `!gameSystemHasModule(dto.gameSystemId)` -- AC2, la barrière réelle
- [x] `apps/api/src/parties/parties.service.ts` -- `update()` : même refus, seulement si `gameSystemId` change réellement par rapport à la valeur enregistrée -- ferme la même faille en édition sans casser AC3
- [x] `apps/api/src/parties/parties.service.spec.ts` + `parties.controller.spec.ts` -- ajuster les fixtures `'draconis'` des chemins de création non liés au module vers `'ryuutama'` ; ajouter les cas de refus (création et édition)
- [x] `apps/web/src/app/features/parties/partie-form/partie-form.spec.ts` -- couvrir : liste filtrée en création, système sans module de la partie actuelle resté visible en édition, défaut du formulaire

**Acceptance Criteria:**
- Given le formulaire de création d'une partie, when je choisis le système de jeu, then seuls les systèmes disposant d'un module sont proposés
- Given une requête de création de partie portant un système sans module, when l'API la reçoit, then elle la refuse avec un message explicite
- Given des parties déjà créées sur un système sans module, when je les édite sans changer le système, then la sauvegarde réussit, elles restent consultables et inchangées, sans migration
- Given la même édition mais je tente de choisir un autre système sans module, when je sauvegarde, then l'API refuse avec un message explicite
- Given l'indicateur de module sur les systèmes de jeu, when un nouveau système reçoit son module, then il suffit d'y basculer l'indicateur pour qu'il devienne proposé — aucune autre liste à mettre à jour

## Implementation Notes

- `parties.controller.spec.ts` mocke entièrement `PartiesService` (`create`/`update` sont des
  `jest.fn()`) : la fixture `gameSystemId: 'draconis'` qui y reste (ligne 64) ne traverse jamais la
  vraie garde et n'avait donc pas besoin d'être ajustée — seuls les tests de
  `parties.service.spec.ts` qui appellent réellement `service.create()` ont été passés à
  `'ryuutama'` (Code Map, comme prévu).
- Web : `systems` étant devenu un signal `computed`, `partie-form.html:97` a dû passer de
  `@for (s of systems; ...)` à `@for (s of systems(); ...)` (appel du signal) — sans quoi le build
  Angular échoue (`TS2488`, un `Signal<...>` n'est pas itérable). Non listé explicitement dans le
  Code Map mais mécanique, découvert au premier `docker compose exec web pnpm test`.
- `PartieForm` gagne un signal privé `savedGameSystemId` (même patron que `savedKind`), posé dans
  `ngOnInit()`, pour que `systems` sache garder visible le système déjà enregistré d'une partie en
  édition même sans module.
- Défaut du formulaire dérivé par `GAME_SYSTEMS.find((s) => s.module)?.id`, jamais l'id `'ryuutama'`
  en dur — AC5 (aucune autre liste à mettre à jour si un futur système reçoit son module).

## Spec Change Log

## Review Triage Log

### 2026-09-21 — Review pass
- verdicts: 9 findings — high 0, medium 0, low 8, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind Hunter : le commentaire au-dessus de l'import `@master-jdr/shared` dans `parties.service.ts` affirmait que ces imports « impose `jest.mock('@master-jdr/shared')` » dans `parties.service.spec.ts` — faux (grep : aucun `jest.mock` de ce module dans ce fichier ; `transformIgnorePatterns` de `apps/api/package.json` laisse déjà ts-jest le transformer). Vérifié : l'exigence de mock existe réellement, mais pour `parties.controller.spec.ts` (DTO `@IsIn` évalué au chargement de la classe), pas ce fichier. Corrigé : commentaire réécrit avec la vraie raison.
  - `[low]` `[patch]` Verification Gap (« Other findings ») : même constat que la ligne précédente (inexactitude préexistante sur `checkPartieKindTransition` seul, étendue par ce diff au nouvel import `gameSystemHasModule` plutôt que corrigée) — même correctif, appliqué une seule fois pour les deux lignes.
  - `[low]` `[patch]` Blind Hunter : le test `'un gameSystemId IDENTIQUE (déjà sans module) reste accepté — aucune migration (AC3)'` ne vérifiait que `toHaveBeenCalled()`, jamais le contenu du payload — une régression qui droppe/mute `gameSystemId` sur un renvoi identique passerait inaperçue malgré le nom du test. Corrigé : assertion étendue à `toHaveBeenCalledWith({ where, data: { ..., gameSystemId: 'draconis' } })`.
  - `[low]` `[patch]` Blind Hunter : ni le test de refus `create()` (AC2) ni celui de `update()` (AC4) ne vérifiaient le texte du message de refus — seulement `rejects.toBeInstanceOf(BadRequestException)`, alors que l'AC exige explicitement un « message explicite ». Corrigé : les deux ajoutent `.rejects.toThrow(GAME_SYSTEM_WITHOUT_MODULE_MESSAGE)`.
  - `[low]` `[reject]` Blind Hunter : `partie-form.ts` caste `p.gameSystemId` (un `string` serveur) en `GameSystemId` sans vérification runtime ; si une partie persistée portait un id absent de `GAME_SYSTEMS`, le filtre `systems()` ne le retrouverait jamais. Vérifié : inatteignable par les chemins normaux — `CreatePartieDto`/`UpdatePartieDto` valident déjà `gameSystemId` par `@IsIn(GAME_SYSTEM_IDS)` à la frontière API, donc aucune partie ne peut exister avec un id hors de cette liste via l'application. Le seul scénario réel serait un futur retrait d'un id de `GAME_SYSTEMS` — hors périmètre de cette story (aucune preuve que c'est prévu) ; le correctif ajouterait une garde pour un état non démontré.
  - `[low]` `[reject]` Edge Case Hunter : même constat que la ligne précédente (même fichier, mêmes lignes citées) — même vérification, même rejet.
  - `[false]` `[reject]` Blind Hunter : le test `'AC1 — création : seuls les systèmes...'` utilise une égalité stricte (`toEqual(['ryuutama'])`) plutôt que `toContain`, ce qui obligerait à retoucher le test si un futur système gagne son module — présenté en tension avec AC5. Réfuté : AC5 porte sur la source de données de la fonctionnalité (`gameSystemHasModule()`, source unique), pas sur les assertions de test ; l'égalité stricte est en réalité le test le PLUS rigoureux ici (il détecte aussi un sur-filtrage, qu'un simple `toContain` manquerait).
  - `[low]` `[reject]` Blind Hunter : la section Verification de cette spec rapporte des comptes de tests sans log CI joint, seulement en prose. Rejeté d'office — le correctif consisterait à éditer cette spec elle-même.
  - `[low]` `[reject]` Edge Case Hunter (claim) : la case à cocher des Tasks dit avoir ajusté les fixtures de `parties.controller.spec.ts`, alors que le diff ne touche pas ce fichier. Rejeté d'office — le correctif consisterait à éditer cette spec elle-même ; au demeurant déjà expliqué et justifié dans Implementation Notes (le service y est entièrement mocké, la fixture ne traverse jamais la vraie garde).

### 2026-09-21 — Passe de correctifs externe (`/bmad-review`, après commit `2d0fe1d`)

Revue indépendante hors du cycle interne de `bmad-build` (Adversarial / Edge-Case Hunter / Verification Gap, sur le commit déjà livré). 11 findings au total (Adversarial : 10, Edge-Case Hunter : 1, Verification Gap : aucun). 4 retenus et corrigés après vérification directe du code, présentés à l'utilisateur puis approuvés :
- Test `update()` « changement vers un système AVEC module » : ne vérifiait que `toHaveBeenCalled()`, jamais le payload — même trou que celui déjà corrigé lors de la revue interne sur le test voisin. Corrigé : assertion étendue au payload complet.
- `GAME_SYSTEM_WITHOUT_MODULE_MESSAGE` non exportée, retapée en dur dans 2 assertions de test. Corrigé : exportée depuis `parties.service.ts`, importée dans les specs.
- Repli manquant dans `systems()` (web) pour l'état transitoire « aucun système n'a de module » — `DEFAULT_GAME_SYSTEM_ID` a un repli sur `GAME_SYSTEMS[0]`, `systems()` non, ce qui aurait produit un menu vide avec un contrôle prérempli. Vérifié réel mais inatteignable aujourd'hui (Ryuutama garde toujours son module). Corrigé : repli aligné.
- Aucun test ne couvrait le sens « système AVEC module → système SANS module » dans `update()` (seul « sans module → X » était testé). Vérifié par lecture directe que la garde ne compare que la cible, jamais la source — donc déjà correcte pour les deux sens par construction, pas un bug vivant. Ajouté quand même comme filet de régression, coût marginal.

7 autres findings évalués et non retenus (TOCTOU hors transaction sur `update()` — patron préexistant depuis la story 29.14, pas causé par celle-ci ; absence de test e2e à travers le pipeline HTTP réel — contraire à la convention déjà établie dans ce fichier ; absence de garde contre un futur 2ᵉ système avec module qui orphelinerait des personnages — explicitement hors périmètre aujourd'hui par l'AC5 elle-même ; scintillement de chargement en édition — préexistant sur `name`/`kind`, non spécifique à cette story ; absence de test web sur l'affichage réel du message serveur — mécanisme déjà couvert ailleurs (`convertKind()`) ; tests n'inspectant pas le DOM rendu — risque théorique). Détail dans la réponse à l'utilisateur de cette session, non redupliqué ici.

Revérifié après correctifs : `parties.service.spec.ts` 123/124 (le seul échec est le même défaut préexistant de fixture de date, sans rapport) ; suite web complète 2408/2410 (mêmes 2 échecs préexistants sans rapport).

### 2026-09-22 — Passe `/bmad-code-review` (8 angles, high effort, sur `f00ca80..fd4fbe3`)

Revue indépendante (Adversarial, Edge-Case Hunter, Cross-file Tracer, Reuse, Simplification, Efficiency, Altitude, Conventions — 1 vérificateur par candidat retenu, recall-biased). 7 findings survivent à la vérification (5 CONFIRMED, 2 PLAUSIBLE) ; 6 corrigés après approbation utilisateur, 1 explicitement laissé de côté :

- **Corrigé** — `CharacterService.create()` filtrait encore sur `SUPPORTED_GAME_SYSTEMS` (liste séparée), pas sur `gameSystemHasModule()` — risque de divergence déjà consigné dans `deferred-work.md` lors de la revue de 29-15, qui nommait explicitement cette story comme le point de correction naturel. `SUPPORTED_GAME_SYSTEMS` et son test de parité supprimés (plus qu'une seule source d'éligibilité) ; `RYUUTAMA_ID` conservé (largement utilisé ailleurs).
- **Corrigé** — Repli « aucun système avec module » dupliqué entre `DEFAULT_GAME_SYSTEM_ID` et `systems()` (web), synchronisés à la main. Factorisé en une constante unique `MODULE_ELIGIBLE_GAME_SYSTEMS`.
- **Corrigé** — Garde `gameSystemHasModule()` copiée-collée dans `create()`/`update()`. Factorisée en `PartiesService.assertGameSystemHasModule()`.
- **Corrigé** — Un `gameSystemId` persisté absent de `GAME_SYSTEMS` (décalage frontend/données, non atteignable aujourd'hui via l'app) disparaissait silencieusement du `<mat-select>`. `savedGameSystemId` re-typé `string` (plus de cast `as GameSystemId` non vérifié — résout du même coup le finding du cast dupliqué), `systems()` synthétise une entrée minimale plutôt que de faire disparaître la valeur ; nouveau test dédié.
- **Corrigé** — Deux niveaux de validation de `gameSystemId` (`@IsIn` du DTO, `gameSystemHasModule()` du service) sans point unique documentant ce qui est réellement accepté. Vérifié qu'aucune infrastructure de validateur partagé n'existe dans ce projet (pas de factorisation triviale possible) ; documenté par un commentaire à chaque décorateur plutôt que construit.
- **Corrigé** — Cast `as GameSystemId` dupliqué deux fois dans `ngOnInit()`. Résolu par le même changement de typage que ci-dessus (plus de cast du tout, aux deux endroits).
- **Laissé de côté, consigné dans `deferred-work.md`** — `update()` lit la partie hors transaction (TOCTOU) avant d'évaluer ses gardes puis d'écrire séparément. Vérifié réel et pré-existant : `convertKind()` (story 29.14), donné en exemple du « bon » patron dans les commentaires de ce fichier, a la même faille — ses règles évaluent aussi un instantané lu avant la transaction. Décision explicite avec l'utilisateur : corriger `update()` seul dupliquerait la logique d'ownership de `getOwned()` et créerait une incohérence avec les autres appelants qui garderaient la faille ; une correction cohérente exige de revoir `getOwned()` et tous ses appelants ensemble, hors périmètre de cette story.

Revérifié après correctifs : suite web complète 2409/2411 (+1 nouveau test, mêmes 2 échecs préexistants sans rapport) ; suite API complète 1348/1350 (mêmes 2 échecs préexistants sans rapport).

## Design Notes

`gameSystemHasModule()` encode déjà tout le prédicat requis (story 29.15) — cette story ne fait que le brancher à deux nouveaux points de contrôle (formulaire, service). La garde `update()` reproduit exactement le patron déjà établi pour `kind` dans la même méthode (`parties.service.ts:349-353`, Story 29.14) : refuser un CHANGEMENT, tolérer un envoi qui renvoie la valeur déjà enregistrée — sans quoi chaque sauvegarde d'une partie existante sur un système sans module casserait, ce qui contredirait directement AC3.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- exécuté. 36/36 verts sur `partie-form.spec.ts` (32 existants
  + 4 nouveaux, Story 29.17). 2 échecs préexistants et sans rapport dans
  `calendar-view.spec.ts` (dates en dur `2026-09-01`/`2026-09-20` désormais dans le passé par
  rapport à aujourd'hui 2026-09-21 — dérive de date, pas cette story). Total : 2408/2410.
- `docker compose exec api pnpm test` -- exécuté. 123 tests sur `parties.service.spec.ts`
  (dont les 5 nouveaux cas Story 29.17 : refus `create()`, + 4 dans le nouveau describe `update() —
  garde gameSystemId sans module`), tous verts sauf 1 échec préexistant et sans rapport
  (`getAvailableSlots — AD-9 end-to-end`, date en dur `2026-09-20` désormais passée — même dérive de
  date). `parties.controller.spec.ts` : 12/12 verts, inchangé (le service y est entièrement mocké).
  Sur l'ensemble du repo API : 2 échecs préexistants, même cause (dérive de date), aucun autre lien
  avec cette story.

**Manual checks (if no CLI):**
- Non nécessaire : les commandes CLI ont pu s'exécuter (Docker disponible), couvrant les 5 AC.
