---
title: 'Réserve de souffles'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5126bfc30ab3f481d276892071854a84e9caff5f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-33-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-01/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-01/DESIGN.md'
  - '{project-root}/docs/dragons.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le MJ remplit à la main, sur le PDF, la réserve de souffles de son Homme Dragon, à chaque impression ; l'application ne la connaît pas, et la fiche comme son export sont lisibles par tout membre de la partie.

**Approach:** Une réserve unique par Homme Dragon, composée sur sa fiche (N − 1 emplacements numérotés, fenêtre de choix, enregistrement automatique), qui remplit `souffle_1..4` de l'export PDF ; fiche et export réservés au MJ. Les critères d'acceptation font foi dans la section « Story 33.6 » d'`epics.md` (décisions du 2026-10-02), le comportement et les textes dans EXPERIENCE.md / DESIGN.md et la planche `mockups/key-reserve-final.html` (les spines gagnent).

## Boundaries & Constraints

**Always:**
- Donnée : `HommeDragonSheetData.reserve?: (string | null)[]`, positionnelle (index = emplacement − 1, clé d'un souffle du catalogue `souffle` ou `souffleRituel`, `null`/absent = vide). Colonne JSON existante : aucune migration.
- Règles pures dans `packages/game-rules` (nouveau `homme-dragon-reserve.ts`, exporté, testé) : `reserveCapacity(level) = max(level − 1, 0)` (le mapping PDF cesse de dupliquer la formule), `validateReserve(...)` et un calcul par souffle « placeable ou raison » pour le grisage web. Règles : capacité ; `reservable: false` exclus (« Non réservable : souffle du temps ») ; autre race (`data.race` ≠ race du dragon) interdite avant le niveau 3, puis un seul souffle sur un seul emplacement (« Un seul souffle d'une autre race ») ; rituels dès le niveau 5 (« Admis dès le niveau 5 »), jamais comptés « autre race » ; un souffle commun, de race ou rituel peut occuper plusieurs emplacements ; clé inconnue refusée si nouvellement placée, tolérée si déjà présente (lisible, retirable). Le serveur reste l'autorité ; web et serveur partagent ces fonctions.
- Écriture : `PUT parties/:id/homme-dragon/reserve/:slot`, corps `{ key: string | null }` (`null` = retirer), un emplacement à la fois (choix d'architecture, valide AD-22). Calque de `chooseArtefactCadeau` : `getOwned`, Ryuutama seul, niveau recalculé (scénarios `PASSE`), transaction avec `SELECT … FOR UPDATE`, `sheetData` copié, geste appliqué à la liste lue sous verrou, composition résultante revalidée, `400` sans écriture si invalide, émission `partieTopic(partieId)`, retour `HommeDragonDto`. Niveau 1 : toute écriture refusée. Aucune purge d'un surplus après baisse de niveau. `reserve` exclu de `UpdateHommeDragonDto` (type `Omit` et liste blanche du DTO de classe).
- Lecture : `HommeDragonService.findOne` passe de `getViewable` à `getOwned` (`403` pour tout non-MJ) ; l'export PDF en hérite. Le web n'a aucun appelant non-MJ. Renverser les specs API qui supposent la lecture par un membre (`homme-dragon.service.spec.ts` : `findOne`, voyageursProteges/historique, derived, eveilPowers, test « MJ ou membre, NFR1 ») et réécrire le docblock de `findOne`.
- PDF : `souffle_1..4` = libellé du souffle de l'emplacement de même numéro (catalogues `souffle` + `souffleRituel`, repli sur la clé), nom sans coût ; vide si emplacement/réserve vide ; formats éditable et 2 pages ; `nombre_souffles = reserveCapacity` et `souffle_actuel` vide inchangés. Renverser les tests qui figent « `souffle_1..4` jamais remplis ».
- `DetailSurface` étendu de façon rétro-compatible : slots `header` et `footer` par projection nommée (zone de détail épinglée dans le pied), `dvh` avec zone sûre, `max-height` propre du pied, fermeture 44 px nommée « Fermer la fenêtre » (≥ 1024 px) ou « Fermer la feuille », largeur par usage (réserve : 620 px), `prefers-reduced-motion`. Sans slot, rendu identique ; classes `.detail-surface-*` inchangées. Critère : utilisable à 320 × 256 px. Re-vérifier chaque usage (character-sheet, character-wizard et ses 5 étapes, homme-dragon-creation-wizard, homme-dragon-sheet, `talent-detail`) : specs rejouées.
- Web : deux nouveaux composants (`features/homme-dragon/reserve-section/`, `reserve-picker/`), la fiche n'insère que `<app-reserve-section>` juste avant la carte « Souffles » (le picker embarque sa propre `DetailSurface`). Le budget de style de la fiche est déjà dépassé : rien de nouveau dans son scss. Comportement conforme aux spines : niveau 1 = ligne d'info seule ; enregistrement automatique, un seul en vol (`aria-disabled`/`aria-busy`), mention, erreur `role="alert"` recréée à chaque échec et retour à l'état précédent ; « Retirer » sans confirmation + bandeau inline « Annuler » (≈ 6 s, valeur à fixer, décompte suspendu au focus/survol, pas de `MatSnackBar`) ; focus après rendu (`afterNextRender`) jamais sur `<body>` ; zone `role="status"` persistante ; lignes de souffle en `<button>`, grisées en `aria-disabled` ; catégories repliables (`aria-expanded`/`aria-controls`), repliées par défaut seulement si rien n'est choisissable. Réécrire la consigne de la carte « Souffles rituels » (« peuvent être placés dans la réserve, sans décompte »). La fiche rafraîchie par `changed` ne doit pas écraser une écriture en vol.
- Livrer aussi : README du PDF (`apps/api/game-systems/ryuutama/assets/README.md` ~L89), `docs/dragons.md` ~L227, clôture des deux entrées « réserve » de `deferred-work.md` (archive). Commentaires et messages d'erreur en français.

**Never:**
- Aucun décompte, aucun champ ni écran de séance, aucune modification de `SeanceDto`, aucun « Vider la réserve », aucun souffle masqué (grisé avec raison), aucune règle propre à la baisse de niveau.
- Pas de migration, pas de nouvelle dépendance, pas de second seuil desktop, pas de fourche de `DetailSurface`, pas de changement du calcul du niveau, de `souffles.json`, de `MyHommeDragonDto` ni de `findMine`.
- La réserve n'est jamais écrite par le `PATCH` générique ni servie à un non-MJ.

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Niveau 1 | fiche ouverte | ligne « La réserve de souffles s'ouvre au niveau 2. », aucun emplacement | PUT refusé (400), rien écrit |
| Niveau 2 à 5 | niveau N | N − 1 emplacements, pastille « Niveau N · k emplacements » (singulier au niveau 2) | N/A |
| Placer / changer | emplacement vide ou rempli | souffle enregistré, focus sur « Changer » | N/A |
| Même souffle ×2 | commun ou de la race | autorisé, repère « Déjà dans l'emplacement N » | N/A |
| Souffle du temps | Passé / Futur | grisé, raison écrite, non placeable | PUT 400 |
| Autre race, niveau 2 | souffle d'une autre race | grisé, non placeable | PUT 400 |
| Autre race, niveau ≥ 3 | un déjà placé | autres grisés « Un seul souffle d'une autre race » ; même souffle ×2 refusé | PUT 400 |
| Rituel | niveau 4 / niveau 5 | grisé « Admis dès le niveau 5 » / placeable, pas « autre race » | PUT 400 au niveau 4 |
| Clé retirée du catalogue | déjà dans la réserve | libellé = clé, retirable, « Changer » possible | nouvelle clé inconnue : 400 |
| Retrait puis « Annuler » | dernier retrait | souffle remis dans le même emplacement ; disparaît si occupé | échec : emplacement inchangé, erreur |
| Échec réseau / serveur | tout geste | état précédent restauré, « Impossible d'enregistrer la réserve. Réessayez. » | N/A |
| Joueur de la partie | GET fiche, export PDF, PUT | aucune donnée | 403 |
| Export PDF MJ | réserve de 2 sur 3 | `souffle_1`, `souffle_2` remplis, `souffle_3` vide, `nombre_souffles = 3` | N/A |
| Montée de niveau | réserve conservée | nouvel emplacement vide | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/homme-dragon/homme-dragon.service.ts` -- `findOne` L341 (`getViewable` → `getOwned`), patron `chooseArtefactCadeau` L249-319 (catalogues via `getContent`, `buildArtefactCatalog` L387) ; ajouter `setReserveSlot`. `homme-dragon.controller.ts` (route à côté de `artefact-cadeau`), `dto/choose-artefact-cadeau.dto.ts` (modèle de DTO ; `key` nullable : valider dans le service ou `@ValidateIf`), `main.ts` L44-48 (`forbidNonWhitelisted`).
- `homme-dragon.service.spec.ts` -- mock `jest.mock('@master-jdr/game-rules')` L10-41 (y ajouter les nouveaux exports), `makePrisma`/`arrange` du describe `chooseArtefactCadeau` L556-717 (patron), `CATALOG_CONTENT` L129-151 (ajouter `souffle`, `souffleRituel`) ; tests `getViewable` à renverser listés ci-dessus. `homme-dragon.controller.spec.ts` L180-198 (patron PATCH → 400).
- `packages/shared/src/index.ts` -- `HommeDragonSheetData` ~L1181, `UpdateHommeDragonDto` ~L1243 (Omit + `'reserve'`), DTO d'écriture près de `ChooseArtefactCadeauDto`. `packages/game-rules/src/ryuutama/validate-homme-dragon.ts` ~L14 (miroir local à étendre, sans règle de réserve), `homme-dragon-souffles.ts` (`availableSouffles`, réutilisable), `homme-dragon-derived.ts` (constantes de niveau), `index.ts`.
- `packages/game-rules/src/ryuutama/homme-dragon-pdf-field-map.ts` L47-57 (docblock « 33.6 »), L92 (formule dupliquée), L103-105 ; `apps/api/src/homme-dragon/homme-dragon.pdf.service.ts` L44-109, `resolveCatalogues` L127-142 (ajouter `souffleRituel`, table clé → libellé). Tests : `__tests__/homme-dragon-pdf-field-map.spec.ts` L221-228, `homme-dragon.pdf.service.real.spec.ts` L106-122 (mock `getContent` L97-100), `homme-dragon.pdf.service.spec.ts` L51-61.
- `apps/web/src/app/shared/detail-surface/` -- `detail-surface.{ts,html,scss}` (ng-content unique L50, close 32 px, `85vh`/`80vh`, pas de reduced-motion), `detail-surface-host.ts` `close()` ; specs `detail-surface.spec.ts`, `detail-surface-host.spec.ts`, `talent-detail.spec.ts`, et les usages (character-sheet L622, character-wizard L162, class/equipment/magic/type/weapon-step, homme-dragon-creation-wizard L267). Les tests ciblent les classes `.detail-surface-*` (ne pas renommer).
- `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/` -- html : colonne gauche L72-364, insertion avant « Souffles » L293, consigne rituels L333-335 ; ts : patron focus `afterNextRender` L473-496, état d'écriture cadeau L408-517, `effect()` temps réel L171-195 ; spec L1416 lignes (`makeHommeDragonService`, `settle`, catalogue `CATALOG`, test « sans mention de réserve » ~L1251 à adapter). `core/homme-dragon/homme-dragon.service.ts` (`chooseArtefactCadeau` : modèle de `setReserveSlot`). `race-tint.scss`, `homme-dragon-races.ts` (teintes). Pages hôtes à rejouer : `homme-dragon-page`, `partie-detail`.
- Spines UX : `EXPERIENCE.md` §3 (textes), §4-§7, `DESIGN.md` §7, planche `mockups/key-reserve-final.html` (P1-P6).

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/index.ts` + `packages/game-rules/src/ryuutama/{homme-dragon-reserve.ts,validate-homme-dragon.ts,homme-dragon-pdf-field-map.ts}` + `index.ts` + tests -- type `reserve`, DTO, règles pures, remplissage `souffle_1..4`
- [x] `apps/api/src/homme-dragon/*` + `dto/` -- route `PUT reserve/:slot`, `findOne` MJ seul, mapping libellés PDF, specs créés et renversés
- [x] `apps/web/src/app/shared/detail-surface/*` -- extension rétro-compatible, specs de tous les usages rejouées
- [x] `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` -- `setReserveSlot`
- [x] `apps/web/src/app/features/homme-dragon/{reserve-section,reserve-picker}/*` + fiche -- sections, fenêtre, bandeau d'annulation, focus, statut, consigne des rituels, tests (dont clavier)
- [x] `README` du PDF, `docs/dragons.md`, `deferred-work.md` -- mise à jour de livraison

**Acceptance Criteria:**
- Given un Homme Dragon de niveau 4, when le MJ place trois souffles valides puis exporte le PDF, then `souffle_1..3` portent leurs noms et rien n'est décompté.
- Given un joueur de la partie, when il lit la fiche ou exporte le PDF du dragon, then `403` sans donnée.
- Given la fenêtre de choix à 320 × 256 px, when on la parcourt au clavier, then liste, détail et boutons restent atteignables et le focus ne tombe jamais sur `<body>`.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- **[gap] Aucun test ne prouve que `sheetData.reserve` survit à `update()`, `chooseEveilPower()` et `chooseArtefactCadeau()`** — `medium`, patch : tests de préservation ajoutés (pré-vérifié par la couche verification-gap).
- **[blind/edge] `update()` (PATCH) lit puis réécrit tout `sheetData` sans verrou : un PATCH lu avant et écrit après un `PUT reserve/:slot` efface le geste de réserve** — `low`, defer : défaut préexistant de `update()` (même fenêtre contre `chooseEveilPower`/`chooseArtefactCadeau`), seulement rendu plus atteignable par l'écriture à chaque clic ; le corriger revient à verrouiller `update()` (hors périmètre, consigné dans `deferred-work.md`).
- **[blind/edge] Niveau calculé hors du verrou de ligne** — `low`, rejeté : même mécanique que `chooseEveilPower`/`chooseArtefactCadeau` (patron imposé par la spec), un scénario `PASSE` ne redescend pas en pratique.
- **[blind/edge] Niveau 1 avec surplus : un retrait est refusé ; surplus hors capacité invisible dans l'interface mais imprimé dans le PDF ; global quota d'autre race rejetant un geste sans rapport après un changement de catalogue** — `low`, rejetés : cas de baisse de niveau que l'utilisateur a explicitement exclu (« aucune règle spécifique, le MJ se débrouille », 2026-10-02) ; l'AC impose de refuser toute écriture au niveau 1.
- **[blind/edge] Message d'erreur unique « Réessayez » (400/403 confondus avec le réseau), pas de relecture après un refus** — `low`, rejeté : message unique recommandé par la proposition de correction (point 6, validé) ; le signal `changed` resynchronise la fiche.
- **[edge] `written` non réinitialisé si l'entrée change de dragon ; écriture sans effet (clé identique) qui écrit et émet quand même** — `low`, rejetés : la page est recréée à chaque partie (une fiche par route), et le geste sans effet n'a aucune conséquence fonctionnelle.
- **[edge] Clé `constructor`/`__proto__` dans `reserveLabels`** — `false` : une clé ne peut entrer dans la réserve que si elle est au catalogue (ou déjà stockée) ; aucun souffle ne porte ce nom.
- **[blind] `CreateHommeDragonDto` accepte `reserve` au niveau du type** — `false` : la liste blanche du DTO de classe (`forbidNonWhitelisted`) rejette le champ à la création, comme `artefactCadeau`.
- **[blind] Constantes de capacité dupliquées (`MAX_RESERVE_SLOTS`, `PDF_RESERVE_BOXES`), libellé long ou clé brute imprimé dans une case du PDF, commentaire de valeur d'exemple de `UNDO_DELAY_MS`, lignes Prettier, garde `updatedAt` dupliquée** — `low`, rejetés : le gabarit PDF a 4 cases par construction, la clé brute est le repli décidé, le reste est cosmétique.
- **[blind/edge/claim] `DetailSurface` : « rétro-compatible » contredit par le bouton 44 px, le libellé « Fermer la fenêtre/feuille », `dvh`, la marge du titre et le conteneur de contenu ; `portal` et le thème ; hauteurs split plafonnées à 85dvh** — `false`/`low` : ces changements communs à tous les usages sont énoncés par la spec (fermeture 44 px nommée, `dvh`, zone sûre) ; le thème est porté par `body` (`theme-tone.service.ts`), donc hérité sous `<body>` ; la hauteur utile à 320 × 256 px a été mesurée dans le navigateur.
- **[blind] Signal temps réel `partie:{id}` émis à toute la partie pour une donnée réservée au MJ** — `low`, rejeté : décision de l'AD-22 (le signal ne porte aucune donnée) ; l'évaluation du câblage reste à consigner selon `docs/checklist.md`.
- **[blind] Docs (`spec.md`, `security.md`, `backlog.md`) non mises à jour pour la lecture MJ seul** — `false` : aucun de ces documents ne promet l'accès des membres à la fiche du dragon (`backlog.md` L94 ne parle que de la fiche et de son export).

## Verification

**Commands:**
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`parties.service.spec.ts`, `party-signals.service.spec.ts`)
- `docker compose exec web pnpm exec ng test web --watch=false` -- expected: tous les tests passent (au moins `shared/detail-surface`, `features/homme-dragon`, `features/characters`, `core/**`)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (avertissements de budget connus, aucune erreur de budget)
- game-rules : `vitest run` dans `packages/game-rules` -- expected: tout passe

**Manual checks (if no CLI):**
- Dragon de niveau 2 à 5 (redémarrer l'API) : composer, changer, retirer, annuler, export PDF dans les deux formats ; compte joueur : 403 ; fenêtre à 320 px et zoom 400 %, clavier seul, trois thèmes.
