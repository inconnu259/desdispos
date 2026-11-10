---
title: 'Capacités de niveau'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd5276daabd34c44e36f501cb96e3a09d466c2aa4'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-33-context.md'
  - '{project-root}/docs/dragons.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La fiche de l'Homme Dragon ne dit pas ce que le dragon a gagné en montant de niveau : le MJ rouvre le livre, ne peut pas choisir l'artefact cadeau du niveau 4, et les souffles rituels du niveau 5 sont absents de l'application.

**Approach:** Enregistrer deux catalogues (`homme-dragon-level-capacities.json`, `souffles-rituels.json`) dans `CONTENT_TYPES` ; afficher sur la fiche les capacités acquises, un choix unique et définitif de l'artefact cadeau (endpoint dédié, modelé sur `chooseEveilPower`) et les souffles rituels consultables dès le niveau 5.

## Boundaries & Constraints

**Always:**
- Clés de catalogue : `hommeDragonLevelCapacity` (fichier `homme-dragon-level-capacities.json`) et `souffleRituel` (fichier `souffles-rituels.json`). Niveau lu sur `hommeDragon().derived.level` (scénarios `PASSE`) ; capacités listées si `level <= niveau` ; carte masquée quand la liste est vide (niveau 1).
- `souffles-rituels.json` gagne `ps: 1` sur ses six entrées (hypothèse du livre documentée dans `docs/dragons.md`, même règle que les autres souffles) ; coût affiché « 1 PS » par `souffleCost()`. Les rituels ne portent ni `race` ni `famille` ni `reservable` : jamais classés « autre race ».
- Rituels : bloc consultable à partir du niveau 5, descriptions via `DetailSurface`/`detailContent()` comme les souffles ; lecture seule, aucune réserve ni décompte. Repli sur la clé si l'entrée manque au catalogue.
- Artefact cadeau : `HommeDragonSheetData.artefactCadeau?: { key: string }` (libellé lu au catalogue d'artefacts). Nouveau `POST parties/:id/homme-dragon/artefact-cadeau` (`ChooseArtefactCadeauDto { key }`), MJ seul (`getOwned`), Ryuutama seul, exécuté comme `chooseEveilPower` : niveau recalculé serveur, `SELECT … FOR UPDATE` dans une transaction, copie (pas de mutation), refus si niveau < 4, si déjà choisi, si clé absente du catalogue `hommeDragonArtefact` ou si l'artefact est de la **race du dragon** ; mêmes codes d'erreur que `chooseEveilPower` ; émission `partieTopic(partieId)` après écriture.
- Interface : à partir du niveau 4 et tant que rien n'est choisi, un choix parmi les artefacts des trois autres races (`ChoiceCard`, teinte de race doublée d'un texte), suivi d'une **confirmation explicite** « Ce choix est définitif » avant l'envoi ; une fois enregistré, le cadeau s'affiche sous l'artefact principal, sans aucun moyen de le modifier. Rien avant le niveau 4.
- Commentaires et messages d'erreur en français.

**Never:**
- Ne pas modifier `souffles.json`, `availableSouffles()`, `chooseEveilPower`, le calcul du niveau, ni rendre `artefact`/`eveilPowers`/`artefactCadeau` modifiables par `PATCH` (ajouter `artefactCadeau` au `Omit` de `UpdateHommeDragonDto`).
- Pas de migration Prisma (colonne JSON), pas de nouvelle dépendance, pas de réserve (33.6), pas d'impression de l'artefact cadeau ni des rituels dans le PDF (hors périmètre, 33.4 livrée).

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Niveau 1 | aucune capacité acquise | pas de carte « Capacités », pas de choix cadeau, pas de rituels | N/A |
| Niveau 3 | `reserve`, `augmentation-du-souffle`, `souffles-multicolores` | 3 capacités listées avec description ; aucun choix cadeau | N/A |
| Niveau 4, rien choisi | race verte | choix limité aux artefacts bleu/rouge/noir ; confirmation puis enregistrement | N/A |
| Niveau 4, choix fait | `artefactCadeau` présent | cadeau affiché à côté de l'artefact principal ; plus de sélecteur | N/A |
| POST niveau < 4 | niveau 3 | refus, rien écrit | même code que `chooseEveilPower` |
| POST artefact de sa race / clé inconnue | `key` invalide | refus, rien écrit | idem |
| POST second choix | `artefactCadeau` déjà présent | refus, valeur inchangée | idem |
| POST par un non-MJ | autre membre | refusé | idem `getOwned` |
| Niveau 5 | rituels au catalogue | 6 rituels, « 1 PS » chacun, consultables ; absents aux niveaux 1-4 | N/A |
| Entrée retirée du catalogue | clé `artefactCadeau` inconnue | libellé = clé brute | N/A |
| Autre appareil | cadeau choisi ailleurs | fiche rafraîchie par le signal `changed` | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/game-systems/game-system.service.ts` (`CONTENT_TYPES` L53-124, dernier `souffle` ~L109) -- ajouter les deux entrées ; le seed est idempotent au démarrage, sans script.
- `apps/api/game-systems/ryuutama/data/souffles-rituels.json` -- ajouter `ps: 1` ; `homme-dragon-level-capacities.json` -- inchangé (6 entrées, `level` 2 à 5).
- `apps/api/src/game-systems/souffles-data.spec.ts`, `game-system.service.spec.ts` (~L59-96) -- patrons des tests de données et d'enregistrement.
- `apps/api/src/homme-dragon/homme-dragon.service.ts` (`chooseEveilPower` ~L162, `buildArtefactCatalog` ~L305) + `homme-dragon.controller.ts` (`POST eveil-power` ~L55) + `dto/choose-eveil-power.dto.ts` -- patron du nouvel endpoint ; `homme-dragon.service.spec.ts` ~L1040-1235 -- patron de tests.
- `packages/shared/src/index.ts` (`HommeDragonSheetData` ~L1181, `UpdateHommeDragonDto` ~L1238, `ChooseEveilPowerDto` ~L1245) -- `artefactCadeau`, `ChooseArtefactCadeauDto`. `packages/game-rules/src/ryuutama/validate-homme-dragon.ts` (~L16) duplique `HommeDragonSheetData` : l'aligner.
- `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` -- `chooseArtefactCadeau(partieId, dto)` sur le modèle de `chooseEveilPower`.
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.{ts,html,scss,spec.ts}` -- signaux de catalogues chargés dans `ngOnInit` (~L186, `getGameSystemContent('ryuutama')`) ; carte artefact html L73-104 ; bloc souffles L188-247 (`#souffleList`, `souffleCost`, `detailContent`) ; `ChoiceCard` : voir `homme-dragon-creation-wizard.ts` ~L92 et L167-190 ; spec : `describe('Souffles (Story 33.2)')` ~L786, bloc temps réel ~L1009.
- `docs/dragons.md`, `apps/api/game-systems/ryuutama/README.md` -- répercuter `ps: 1` et les deux catalogues.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/game-systems/game-system.service.ts` + `souffles-rituels.json` -- enregistrer `hommeDragonLevelCapacity` et `souffleRituel`, ajouter `ps: 1` -- exposition par l'endpoint de contenu existant
- [x] `packages/shared/src/index.ts` + `packages/game-rules/.../validate-homme-dragon.ts` -- type `artefactCadeau`, DTO, `Omit` du PATCH -- contrat
- [x] `apps/api/src/homme-dragon/*` -- endpoint `artefact-cadeau` et règles serveur -- choix unique, définitif, MJ seul
- [x] `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` -- méthode `chooseArtefactCadeau`
- [x] `apps/web/.../homme-dragon-sheet/*` -- carte des capacités, choix + confirmation, cadeau affiché, bloc rituels
- [x] Tests API (enregistrement, données, endpoint : niveau, doublon, race, clé, non-MJ, émission, pas de mutation), web (matrice, confirmation, repli sur la clé, temps réel), docs -- couvre la matrice

**Acceptance Criteria:**
- Given un dragon au niveau N, when j'ouvre sa fiche, then les capacités de niveau ≤ N sont listées avec leur description.
- Given un dragon au niveau ≥ 4 sans cadeau, when je choisis puis confirme un artefact d'une autre race, then il est enregistré définitivement et affiché à côté de l'artefact principal.
- Given un dragon au niveau 5, when j'ouvre sa fiche, then les six rituels sont consultables à « 1 PS », sans réserve ni décompte.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- **[blind/edge/gap] Entrée de catalogue sans `race` acceptée comme cadeau définitif côté serveur (`buildArtefactCatalog` la mappe à `''`, l'UI l'exclut)** — `medium`, patch : garde `!entry.race` + test.
- **[gap] Aucun test ne prouve que `update()` (PATCH) conserve un `artefactCadeau` déjà enregistré** — `medium`, patch : test de préservation (pré-vérifié par la couche verification-gap) ; `update()` inchangé, le type `Omit` et la liste blanche du DTO interdisent déjà l'écriture.
- **[blind/edge] Bloc `alertdialog` sans gestion du focus, message d'erreur du cadeau non annoncé** — `medium`, patch : focus sur la confirmation, retour du focus au bouton stable, `role="alert"`.
- **[blind/edge] Niveau calculé hors du verrou de ligne (TOCTOU sur un scénario rouvert)** — `low`, rejeté : même mécanique que `chooseEveilPower` (patron imposé par la spec), un scénario `PASSE` ne redescend pas en pratique, et le docstring ne prétend pas que le niveau est lu sous le verrou ; restructurer dépasse une correction directe.
- **[blind/edge] `artefactCadeau` écrasable via `update()`** — `false` : `UpdateHommeDragonDto` l'exclut au type et la liste blanche (`forbidNonWhitelisted`) rejette le champ en 400 (test de contrôleur) ; le cas de préservation est couvert par le patch ci-dessus.
- **[blind/edge] `key` sans `@MaxLength`** — `low`, rejeté : une clé surdimensionnée n'est pas au catalogue et reçoit un 400 ; même DTO que `ChooseEveilPowerDto`.
- **[edge] `selectedCadeauKey` périmé après rafraîchissement ; état de confirmation persistant si le cadeau arrive d'un autre appareil** — `low`/`false` : le serveur valide la clé (400), et la carte entière disparaît (`canChooseCadeau`) dès que `artefactCadeau` existe ; l'état mort est invisible.
- **[edge] `artefactCadeau` mal formé ; capacité au `level` non numérique silencieusement écartée** — `low`/`false` : le serveur n'écrit que `{ key }` validé ; la complétude du catalogue relève de la revue de contenu (aucune garde runtime, cf. contexte d'épopée) et du test de données.
- **[blind] Échec d'enregistrement sans rechargement de la fiche** — `low`, rejeté : le signal `changed` la rafraîchit, cas « déjà choisi ailleurs » rare et sans perte.
- **[blind] « 1 PS » présenté comme règle alors que le livre ne donne pas de coût** — `false` : décision du 2026-09-29 (épopée 33), AC de la story ; l'hypothèse est documentée dans `docs/dragons.md`.
- **[blind] Duplication avec `chooseEveilPower`, `sheetData: sheetData`, deux `HommeDragonSheetData`, mixin sans `@error`, grille à une colonne, quatre `[class.…]`** — `low`, rejetés : patron imposé par la spec et style existant des mêmes fichiers ; duplication des deux interfaces préexistante ; aucun effet utilisateur.
- **[blind/gap] Tests de bornes web (rituels niveaux 2-3, capacités niveau 2 et 5), e2e, double envoi concurrent, dérive fixtures/JSON** — `low`, rejetés : la borne est pinnée (3/4, 1/4) et le verrou est testé ; ajouts sans défaut démontré.
- **[blind/gap] Cadeau et rituels absents du PDF** — `medium`, defer : fonctionnalité voisine non demandée par les critères de la story ; consigné dans `deferred-work.md`.

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`parties.service.spec.ts`, `party-signals.service.spec.ts`)
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/homme-dragon/**/*.spec.ts"` -- expected: tous les tests passent (idem `core/**`)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front)

**Manual checks (if no CLI):**
- Redémarrer l'API pour re-seeder ; dragon de niveau 4 puis 5 : choix cadeau avec confirmation, affichage, rituels ; compte joueur : aucune modification possible.
