---
baseline_commit: 1af1c8173a34b9c6a48496082b50088165e84c2c
---

# Story 25.2: Création d'une arme libre

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a joueur,
I want créer une arme qui ne figure pas dans la liste,
so that je puisse jouer une arme non couverte par le catalogue, tout en gardant des formules de combat cohérentes.

## Contexte

La Story 25.1 a remplacé le choix direct d'une catégorie (`weaponCategoryId`) par le choix d'une arme précise (`weaponId`, référence au catalogue `weaponItem`) — le joueur choisit une catégorie (étape 1) puis une arme précise dans cette catégorie (étape 2, sauf Mains nues). Mais le catalogue `weapon-items.json` reste fini (16 entrées) : un joueur voulant une arme non couverte (ex. un fléau, un cimeterre) n'a aujourd'hui aucune échappatoire.

Cette story ajoute une **arme libre** : à l'étape 2 du `WeaponStep` (une fois une catégorie choisie), le joueur peut soit choisir une arme du catalogue (`weaponId`, inchangé), soit créer une arme libre en donnant juste un nom — elle hérite alors exactement des formules de toucher/dégâts de la catégorie choisie, comme n'importe quelle arme de cette catégorie.

**Décision de conception actée avec l'utilisateur avant `create-story`** (aucune question ouverte restante) :

- Stockage : `customWeapon: { name: string; categoryId: string }`, **sibling** de `weaponId` sur `RyuutamaSheetData` — jamais les deux renseignés, jamais aucun des deux (AC1).
- Résolution : nouvelle fonction pure `resolveWeapon()` dans `packages/game-rules` qui encapsule la priorité `weaponId` > `customWeapon` (AC3) — remplace tous les appels directs à `resolveWeaponCategory()` chez les 3 consommateurs de lecture (web `WeaponStep`/`CharacterSheet`, API `ryuutama-pdf.service.ts`). `resolveWeaponCategory(weaponId, catalog)` lui-même **n'est pas modifié**, juste enveloppé.
- **Aucun `ContentEntry` créé pour une arme personnalisée** (AC4) — elle reste strictement inline dans `sheetData`, jamais partagée entre personnages (le champ `scope` `MJ`/`PARTIE` de `ContentEntry`, déjà présent dans le schéma, est réservé au Palier 15 homebrew — hors scope ici, ne pas y toucher).
- **Fin-à-fin, pas seulement les ACs de l'epic** : les ACs de l'epic ne couvrent que le stockage/la priorité de résolution — mais `character-sheet.ts` (affichage fiche) et `ryuutama-pdf.service.ts` (export PDF) lisent aujourd'hui `sheetData.weaponId` en dur (Story 25.1). Sans mise à jour, un personnage créé avec une arme libre afficherait une fiche/un PDF sans arme du tout — régression fonctionnelle silencieuse. Ces deux consommateurs sont donc dans le scope de cette story (Task 4/5 ci-dessous), même si l'epic ne les cite pas explicitement.

## Acceptance Criteria

1. **Given** l'étape de choix d'arme (Story 25.1 complétée), **when** le joueur choisit de créer une arme libre, **then** elle est stockée `{ customWeapon: { name: string, categoryId: string } }` dans `sheetData`, sibling de `weaponId` — jamais les deux renseignés, jamais aucun des deux.
2. **Given** une arme personnalisée avec un `categoryId` choisi, **when** ses formules sont calculées, **then** elle hérite exactement des mêmes formules que la catégorie référencée.
3. **Given** le mode d'édition MJ (`validate(data, 'mj', catalog)`, permissif par convention établie), **when** une fiche porte transitoirement à la fois `weaponId` et `customWeapon`, **then** la résolution à la lecture privilégie toujours `weaponId` en premier — un seul chemin déterministe.
4. **Given** `ContentEntry.scope` `MJ`/`PARTIE` (déjà présent dans le schéma, réservé au Palier 15 homebrew), **when** cette story est implémentée, **then** aucune arme personnalisée ne crée de `ContentEntry` — elle reste strictement inline dans `sheetData`, jamais partagée/interrogée entre personnages.

## Tasks / Subtasks

- [x] Task 1 — `packages/game-rules` : champ, catalogue, fonction de résolution unifiée (AC: #1, #2, #3)
  - [x] `packages/game-rules/src/ryuutama/types.ts` :
    - `RyuutamaSheetData.weaponId: string` → `weaponId?: string` (devient optionnel — sibling exclusif de `customWeapon`).
    - Ajouter `customWeapon?: { name: string; categoryId: string };` juste après `weaponId`, avec un docblock expliquant la relation sibling/exclusive (même ton que les autres champs optionnels du fichier, ex. `magicSeason`).
    - `RyuutamaCatalog` : ajouter `validWeaponCategories?: string[]` (projection minimale des clés `weaponCategory`, même convention que `validWeaponItems`/`validSeasons` — nécessaire pour valider `customWeapon.categoryId`).
  - [x] `packages/game-rules/src/ryuutama/resolve-weapon-category.ts` : **ne pas modifier** `resolveWeaponCategory()` (signature/comportement inchangés, la spec `resolve-weapon-category.spec.ts` existante doit rester verte telle quelle). Ajouter une nouvelle fonction exportée dans le même fichier :
    ```ts
    export function resolveWeapon(
      data: { weaponId?: string; customWeapon?: { name: string; categoryId: string } },
      catalog: WeaponResolutionCatalog,
    ): ResolvedWeapon | null {
      if (data.weaponId) return resolveWeaponCategory(data.weaponId, catalog);
      if (data.customWeapon) {
        const category = catalog.weaponCategories.find((c) => c.key === data.customWeapon!.categoryId);
        if (!category) return null;
        return {
          weaponLabel: data.customWeapon.name,
          categoryId: category.key,
          categoryLabel: category.label,
          touchFormula: category.touchFormula,
          damageFormula: category.damageFormula,
        };
      }
      return null;
    }
    ```
    Priorité `weaponId` explicite en premier (AC3). Docblock expliquant que c'est le point d'entrée unique de résolution pour tous les consommateurs de lecture (web + API) — `resolveWeaponCategory` reste utilisable isolément (utilisé en interne ici) mais les 3 sites de lecture listés en Task 4/5 doivent tous migrer vers `resolveWeapon()`.
  - [x] Exporter `resolveWeapon` depuis `packages/game-rules/src/index.ts` (à côté de `resolveWeaponCategory`, même bloc).
  - [x] `packages/game-rules/src/ryuutama/validate.ts`, Règle 4 — remplacer la règle actuelle (`!data.weaponId || !validWeaponItems.includes(...)`) par une validation d'exclusivité mutuelle + validation par branche. **Garder `field: 'weaponId'` sur toutes les erreurs de cette règle** (aucun champ nouveau) — `character-wizard.ts::FIELD_TO_STEP_KEY` route déjà `weaponId` vers l'étape `weaponId`, pas besoin d'y ajouter une entrée `customWeapon`. Logique :
    - `weaponId` ET `customWeapon` tous les deux présents → erreur (« un seul chemin, jamais les deux »).
    - seulement `weaponId` présent → valider comme aujourd'hui (`validWeaponItems.includes`).
    - seulement `customWeapon` présent → valider `name` non vide (`.trim()`) ET `categoryId` présent dans `catalog.validWeaponCategories ?? []`.
    - ni l'un ni l'autre → erreur (comme aujourd'hui pour `weaponId` manquant).
    - Ne pas se contenter de vérifier la présence de `customWeapon` (leçon des revues de code Story 23.8/23.9) — vérifier le contenu (`name` non vide après trim, `categoryId` réellement dans le catalogue).
- [x] Task 2 — Backend : catalogue de validation et export PDF (AC: #2, #3, #4)
  - [x] `apps/api/src/characters/character.service.ts` (`buildRyuutamaCatalog()`) : ajouter `validWeaponCategories: keysOf('weaponCategory')` à l'objet retourné (même pattern `keysOf()` déjà établi, ligne ~251-259).
  - [x] `apps/api/src/characters/ryuutama-pdf.service.ts` (`resolveContent()`, ligne ~399-410) : remplacer l'appel `resolveWeaponCategory(sheetData.weaponId, {...})` par `resolveWeapon({ weaponId: sheetData.weaponId, customWeapon: sheetData.customWeapon }, {...})` — même construction de catalogue (`weaponItems`/`weaponCategories` mappés depuis `content['weaponItem']`/`content['weaponCategory']`), inchangée. `weaponLabel` porte alors le nom de l'arme libre le cas échéant (ex. « Fléau maison ») ; `weaponCategoryId` (résolu depuis `resolvedWeapon?.categoryId`) continue d'alimenter `weaponPdfOption()` pour le dropdown "Arme Fav" — comportement déjà correct sans changement côté `pdf-field-map.ts` puisqu'une arme libre hérite de la catégorie choisie (AC2).
  - [x] `apps/api/src/game-systems/game-system.service.ts::getSchema()` (ligne ~244) : `weaponId: { type: 'string' }` → `weaponId: { type: 'string', optional: true }` ; ajouter `customWeapon: { type: 'object', optional: true }` juste après, pour rester descriptivement exact (cohérent avec `fetiqueObject`/`equipment`/`narrative`, déjà `optional: true`). Aucun changement à `creationSteps` (toujours une seule étape `weaponId`, label "Arme favorite" — l'arme libre est une variante de cette même étape, pas une étape séparée).
- [x] Task 3 — Frontend : `WeaponStep`, création d'une arme libre (AC: #1, #2)
  - [x] `weapon-step.ts` :
    - Nouvel input `readonly customWeapon = input<{ name: string; categoryId: string } | undefined>();`.
    - Nouvel output `readonly customWeaponChange = output<{ name: string; categoryId: string } | null>();`.
    - Nouveau signal local `protected readonly showCustomInput = signal(false);` et `protected readonly customWeaponName = signal('');` — état UI de saisie, pas persisté tel quel (le parent reçoit `customWeaponChange` déjà structuré `{ name, categoryId }`).
    - `itemOptions` (grille étape 2) : ajouter une carte finale de clé constante (ex. `const CUSTOM_WEAPON_KEY = '__custom__';`) libellée « Créer une arme libre », visible dans les mêmes conditions que la grille actuelle (catégorie choisie, pas Mains nues). `selected` de cette carte = `showCustomInput()`.
    - `selectItem(itemKey)` : si `itemKey === CUSTOM_WEAPON_KEY` → `showCustomInput.set(true)`, `weaponIdChange.emit(null)` (efface un `weaponId` précédemment choisi — exclusivité), ne pas encore émettre `customWeaponChange` (attendre une saisie). Sinon (arme du catalogue) → `showCustomInput.set(false)`, `customWeaponChange.emit(null)`, puis `weaponIdChange.emit(itemKey)` comme aujourd'hui.
    - Nouvelle méthode `protected onCustomNameInput(name: string): void` : `customWeaponName.set(name)` ; si `name.trim()` non vide, `customWeaponChange.emit({ name: name.trim(), categoryId: this.selectedCategoryKey()! })` (la catégorie est forcément choisie à ce stade — la carte custom n'apparaît que si `selectedCategoryKey()` est non-null) ; sinon `customWeaponChange.emit(null)` (nom vidé → rien de valide à stocker, cohérent avec la garde de `canGoNext()` côté wizard, cf. Task 4).
    - `selectCategory(categoryKey)` : en plus du comportement existant (reset sur changement réel de catégorie), reset aussi l'état custom : `showCustomInput.set(false)`, `customWeaponName.set('')`, `customWeaponChange.emit(null)` — y compris sur la branche Mains nues (auto-assignation directe d'un `weaponId`, jamais de `customWeapon` pour cette catégorie, cohérent avec `NO_ITEM_CHOICE_CATEGORY`).
    - `resolvedWeapon` computed : basculer de `resolveWeaponCategory(id, {...})` vers `resolveWeapon({ weaponId: this.weaponId(), customWeapon: this.customWeapon() }, {...})` (import `resolveWeapon` depuis `@master-jdr/game-rules`) — l'aperçu « Toucher/Dégâts » sous la grille doit fonctionner identiquement pour une arme catalogue ou une arme libre (AC2).
    - Effet de resynchronisation (constructeur, `hasSyncedFromInput`) : étendre pour aussi resynchroniser depuis `customWeapon()` au retour en arrière sur l'étape (même garde `hasSyncedFromInput`, un seul run) — si `customWeapon()` est renseigné à la première évaluation, positionner `selectedCategoryKey.set(customWeapon.categoryId)`, `showCustomInput.set(true)`, `customWeaponName.set(customWeapon.name)`.
  - [x] `weapon-step.html` : dans la grille étape 2 (`itemOptions()`), la carte `__custom__` s'affiche comme les autres (`app-choice-card`) ; sous la grille, `@if (showCustomInput())` afficher un `<input type="text">` (même pattern `[ngModel]`/`(ngModelChange)` que `fetish-step.html`, importer `FormsModule`) lié à `customWeaponName()`/`onCustomNameInput($event)`, avec un `<label>`/`placeholder` explicite (ex. « Nom de l'arme libre »).
  - [x] `weapon-step.scss` : classe pour l'input libre (`&__custom-input`), cohérente avec les styles existants (`&__detail`/`&__category-description`) — pas de nouvelle librairie, juste du CSS local au composant.
- [x] Task 4 — Câbler `character-wizard.ts`/`.html` (AC: #1)
  - [x] `onWeaponIdChange(weaponId: string | null)` (existant, ligne ~382) : en plus de `weaponId: weaponId ?? undefined`, forcer `customWeapon: undefined` dans le même `update()` — un `weaponId` choisi efface toujours une arme libre précédente (exclusivité, défense en profondeur côté client en plus de `validate()`).
  - [x] Nouvelle méthode `protected onCustomWeaponChange(customWeapon: { name: string; categoryId: string } | null): void` : `this.sheetData.update((d) => ({ ...d, customWeapon: customWeapon ?? undefined, weaponId: undefined }))` — même symétrie inverse.
  - [x] `canGoNext()`/`isStepComplete` (`case 'weaponId':`, ligne ~268) : `return !!data.weaponId;` → `return !!data.weaponId || !!(data.customWeapon?.name?.trim() && data.customWeapon?.categoryId);` — l'étape est complète avec l'un OU l'autre.
  - [x] `character-wizard.html` (`@case ('weaponId')`, ligne ~84-88) : ajouter `[customWeapon]="sheetData().customWeapon"` et `(customWeaponChange)="onCustomWeaponChange($event)"` au binding existant de `<app-weapon-step>`.
- [x] Task 5 — Câbler `CharacterSheet` (affichage fiche) et export PDF — bout-en-bout (AC: #2, #3)
  - [x] `character-sheet.ts` (`weaponData` computed, ligne ~215-227) : lire aussi `sheetData()['customWeapon']` (même cast `as` que `weaponId`) et appeler `resolveWeapon({ weaponId, customWeapon }, { weaponItems, weaponCategories })` (import `resolveWeapon` depuis `@master-jdr/game-rules`) au lieu de `resolveWeaponCategory(weaponId, ...)` — sinon un personnage avec une arme libre afficherait une fiche sans arme (régression silencieuse, hors scope des ACs de l'epic mais requis pour un système cohérent bout-en-bout).
  - [x] `weaponOptions()` (combobox MJ `FieldEditPencil`, édition de `weaponId` par le MJ) : **ne pas toucher** — reste la liste des `weaponItem` du catalogue. Le MJ ne peut pas assigner une arme libre via ce contrôle (hors scope, `customWeapon` n'est jamais édité par le MJ dans cette story).
  - [x] `ryuutama-pdf.service.ts` : déjà couvert par Task 2 (même fonction `resolveWeapon`, un seul appel).
- [x] Task 6 — Tests et suite complète (AC: #1-#4)
  - [x] `packages/game-rules/src/__tests__/resolve-weapon-category.spec.ts` (existant, Story 25.1) : ne pas modifier les tests de `resolveWeaponCategory` ; ajouter un nouveau `describe('resolveWeapon', ...)` dans le même fichier (ou un fichier voisin `resolve-weapon.spec.ts` si plus lisible) couvrant : `weaponId` seul résolu comme `resolveWeaponCategory` ; `customWeapon` seul résolu par catégorie (label = nom custom, formules = catégorie) ; les deux présents → priorité `weaponId` (AC3) ; aucun des deux → `null` ; `customWeapon.categoryId` inconnu du catalogue → `null`.
  - [x] `packages/game-rules/src/__tests__/validate.spec.ts` : nouveaux cas Règle 4 — `customWeapon` seul valide (name+categoryId valides) → pas d'erreur ; `weaponId`+`customWeapon` tous les deux présents → erreur `field: 'weaponId'` ; `customWeapon.name` vide/whitespace → erreur ; `customWeapon.categoryId` hors `validWeaponCategories` → erreur ; ni l'un ni l'autre → erreur (comportement existant conservé, juste re-vérifié).
  - [x] `apps/api/src/characters/character.service.spec.ts` : `buildRyuutamaCatalog()` — vérifier `validWeaponCategories` peuplé depuis le contenu `weaponCategory` (fixtures existantes ont déjà `weaponCategory: [{ key: 'arc', data: {} }]`, ligne ~143/450/477 — étendre l'assertion de catalogue construit). Ajouter un test de création de personnage avec `customWeapon` valide (200) et un cas `weaponId`+`customWeapon` simultanés (400).
  - [x] `apps/api/src/characters/ryuutama-pdf.service.spec.ts` : nouveau test — personnage avec `customWeapon` uniquement → `mapToPdfFields` appelé avec `weaponLabel` = nom custom, `weaponTouchFormula`/`weaponDamageFormula`/`weaponCategoryId` = ceux de la catégorie référencée (même pattern que le test de câblage `weaponId` ajouté en revue de code Story 25.1).
  - [x] `apps/web/.../weapon-step.spec.ts` (existant, 6 tests Story 25.1 — **ne pas casser**) : ajouter des tests — la carte « Créer une arme libre » apparaît en dernière position de la grille étape 2 (pas pour Mains nues) ; la sélectionner affiche l'input texte et efface `weaponId` (émission `null`) ; taper un nom émet `customWeaponChange` avec `{ name, categoryId }` de la catégorie courante ; choisir ensuite une arme du catalogue efface le `customWeapon` (émission `null`) ; changer de catégorie après avoir créé une arme libre réinitialise l'état custom ; retour en arrière avec `customWeapon` déjà renseigné resynchronise correctement (input pré-rempli, catégorie correcte).
  - [x] `apps/web/.../character-wizard.spec.ts` : `canGoNext()`/`isStepComplete` sur l'étape `weaponId` avec seulement `customWeapon` renseigné → `true` ; `onCustomWeaponChange` efface `weaponId` ; `onWeaponIdChange` efface `customWeapon`.
  - [x] `apps/web/.../character-sheet.spec.ts` : `weaponData()` avec un personnage `customWeapon`-only affiche le nom custom + formules de catégorie (pas de carte vide).
  - [x] Suite complète (`docker compose exec api pnpm test`, `docker compose exec web pnpm test`, suite dédiée `packages/game-rules`) — baseline actuelle (post-Story 25.1) : 900 API / 990 web / 156 game-rules, aucune régression attendue au-delà des ajouts listés.
  - [x] `docker compose exec api pnpm typecheck` propre — attention particulière : `weaponId` devient optionnel sur `RyuutamaSheetData`, tout site qui le lisait comme `string` non-nullable (ex. avant Task 1/2, `ryuutama-pdf.service.ts` passait `sheetData.weaponId` directement à `resolveWeaponCategory(weaponId: string, ...)`) doit être migré vers `resolveWeapon()` pour rester valide au typecheck — vérifier qu'aucun site n'a été oublié en compilant.

## Dev Notes

- **`RyuutamaCatalog` (`validate()`) et `WeaponResolutionCatalog` (`resolveWeaponCategory`/`resolveWeapon`) restent deux types distincts** — convention actée en Story 25.1, ne pas les fusionner. `validWeaponCategories` (nouveau) rejoint `validWeaponItems`/`validSeasons`/`requiredChoicesByClass` comme simple projection de clés pour `validate()` ; `WeaponResolutionCatalog` (labels/formules riches) reste construit à la demande par chaque consommateur de lecture depuis les `ContentEntryDto[]` bruts.
- **`resolveWeaponCategory()` n'est pas remplacée, elle est enveloppée** — `resolveWeapon()` est le nouveau point d'entrée pour tous les consommateurs de *lecture* (web `WeaponStep`/`CharacterSheet`, API `ryuutama-pdf.service.ts`), mais réutilise `resolveWeaponCategory()` en interne pour la branche `weaponId`. Ne pas dupliquer la logique de recherche item→catégorie.
- **Exclusivité `weaponId`/`customWeapon` appliquée à 3 niveaux** : (1) UI (`WeaponStep` efface l'un quand l'autre est choisi), (2) wizard (`character-wizard.ts` force l'autre à `undefined` dans le même `update()`), (3) serveur (`validate()`, seule couche qui compte réellement — les deux premières sont de la défense en profondeur/UX, jamais la source de vérité).
- **`weaponId` devient optionnel sur `RyuutamaSheetData`** — c'est un changement de contrat qui peut casser silencieusement tout code qui le traitait comme `string` garanti. Grep exhaustif avant de considérer la task terminée : chercher toute occurrence de `.weaponId` (sheetData) dans `apps/api/src` et `apps/web/src` pour confirmer que les seuls sites affectés sont ceux déjà listés en Task 2/3/4/5 (ils l'étaient déjà en Story 25.1 — 4 consommateurs directs, plus le nouveau `WeaponStep`/`character-wizard.ts` qui l'écrivent).
- **Aucune migration de données** : les personnages existants (Story 25.1, `weaponId` obligatoire) restent valides sans changement — `weaponId` optionnel est un assouplissement, pas une contrainte supplémentaire. `customWeapon` absent par défaut, cohérent avec les autres champs optionnels du modèle (`fetiqueObject`, `magicSeason`, etc.).
- **Pas de nouveau `ContentType`/`ContentEntry`** (AC4) — ne pas créer de route API, DTO, ou seed pour les armes libres. Elles vivent uniquement dans `sheetData: Json` (Prisma), comme `narrative`/`equipment`/`classChoices`. Le champ `ContentEntry.scope` `MJ`/`PARTIE` mentionné dans l'AC est un rappel de non-scope (Palier 15 homebrew), pas une instruction d'implémentation.
- **`FIELD_TO_STEP_KEY` n'a pas besoin d'une entrée `customWeapon`** — toutes les erreurs `validate()` Règle 4 gardent `field: 'weaponId'`, déjà routé vers l'étape `weaponId` (même mapping que Story 25.1, inchangé).
- **UI : la carte « Créer une arme libre » n'apparaît jamais pour Mains nues** — cette catégorie auto-assigne son unique `weaponItem` sans jamais afficher la grille étape 2 (`NO_ITEM_CHOICE_CATEGORY`, comportement Story 25.1 inchangé) ; une arme libre « mains nues » n'a de toute façon aucun sens narratif (formules VIG+AGI/VIG-2 déjà couvertes par l'entrée catalogue existante).
- **Pattern d'input texte libre** : réutiliser exactement le pattern `FormsModule`/`[ngModel]`/`(ngModelChange)` de `fetish-step.html` (`fetiqueObject`) — c'est la seule autre étape du wizard avec un champ texte libre, déjà établi et testé.

### Project Structure Notes

- `packages/game-rules/src/ryuutama/types.ts` (`RyuutamaSheetData.customWeapon`, `weaponId` optionnel, `RyuutamaCatalog.validWeaponCategories`), `resolve-weapon-category.ts` (+`resolveWeapon`, `resolveWeaponCategory` inchangée), `validate.ts` (Règle 4 réécrite), `index.ts` (+export `resolveWeapon`).
- Backend : `apps/api/src/characters/character.service.ts` (`buildRyuutamaCatalog()`), `ryuutama-pdf.service.ts` (`resolveContent()`), `apps/api/src/game-systems/game-system.service.ts` (`getSchema()`).
- Frontend : `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/{weapon-step.ts,.html,.scss}` (extension, pas réécriture complète), `character-wizard.ts`/`.html`, `character-sheet.ts` (`weaponData` computed).
- Aucune migration Prisma (`sheetData: Json`), aucun nouveau `ContentType`/fichier de données seedé.

### References

- [Source: _bmad-output/planning-artifacts/epics-palier8.md#Story 25.2] — Acceptance Criteria d'origine
- [Source: _bmad-output/implementation-artifacts/25-1-choix-arme-precise-rattachee-categorie.md] — story précédente (mêmes fichiers, `resolveWeaponCategory`/`WeaponResolutionCatalog`/`RyuutamaCatalog` déjà en place), pattern de revue de code à anticiper (Blind Hunter + Edge Case Hunter + Acceptance Auditor)
- [Source: packages/game-rules/src/ryuutama/resolve-weapon-category.ts] — `resolveWeaponCategory`/`WeaponResolutionCatalog`/`ResolvedWeapon` existants, à envelopper sans modifier
- [Source: packages/game-rules/src/ryuutama/types.ts:25-91] — `RyuutamaSheetData` actuel (`weaponId: string` à rendre optionnel, `customWeapon` à ajouter en sibling)
- [Source: packages/game-rules/src/ryuutama/validate.ts:54-61] — Règle 4 actuelle à réécrire (exclusivité mutuelle)
- [Source: apps/api/src/characters/character.service.ts:214-260] — `buildRyuutamaCatalog()`, pattern `keysOf()` établi
- [Source: apps/api/src/characters/ryuutama-pdf.service.ts:386-452] — `resolveContent()`, appel `resolveWeaponCategory` à migrer vers `resolveWeapon`
- [Source: apps/api/src/game-systems/game-system.service.ts:235-260] — `getSchema()` (`sheetSchema.weaponId`/`creationSteps`)
- [Source: apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.ts,.html,.scss] — composant à étendre (grille étape 2, resynchronisation)
- [Source: apps/web/src/app/features/characters/character-wizard/steps/fetish-step/fetish-step.html] — pattern `FormsModule`/`ngModel` à réutiliser pour l'input texte libre
- [Source: apps/web/src/app/features/characters/character-wizard/character-wizard.ts:37-92,264-270,380-384] — `SUPPORTED_STEP_KEYS`/`FIELD_TO_STEP_KEY`/`canGoNext()`/`onWeaponIdChange` à étendre
- [Source: apps/web/src/app/features/characters/character-sheet/character-sheet.ts:214-227] — `weaponData` computed à migrer vers `resolveWeapon`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `docker compose exec api sh -c "cd /work/packages/game-rules && pnpm test"` → 10 suites, 166/166 passed (baseline 156 + 10 nouveaux : 5 `resolveWeapon` + 5 Règle 4 `customWeapon`)
- `docker compose exec api pnpm test` → 45 suites, 902/902 passed (baseline 900 + 2 nouveaux : `character.service.spec.ts` customWeapon, `ryuutama-pdf.service.spec.ts` customWeapon)
- `docker compose exec api pnpm typecheck` → clean (`tsc --noEmit -p tsconfig.build.json`)
- `docker compose exec web pnpm test` → 73 suites, 998/998 passed (baseline 990 + 8 nouveaux : 5 `weapon-step.spec.ts` + 2 `character-wizard.spec.ts` + 1 `character-sheet.spec.ts`)
- `docker compose exec web pnpm build` (production) échoue sur un dépassement de budget de bundle (`bundle initial exceeded maximum budget`) — préexistant, sans rapport avec cette story (aucun budget touché par les changements : 3 champs optionnels ajoutés à un type, pas de nouvelle dépendance) ; la compilation AOT elle-même (via `ng test`, qui build en mode development) est propre, confirmant l'absence d'erreur de type introduite par ce palier.

### Completion Notes List

- `resolveWeaponCategory()` (Story 25.1) laissée strictement inchangée — nouvelle fonction `resolveWeapon()` ajoutée dans le même fichier, qui l'enveloppe pour la branche `weaponId` et ajoute la résolution `customWeapon` (label = nom libre, formules héritées de la catégorie référencée).
- `weaponId` devenu optionnel sur `RyuutamaSheetData`, sibling exclusif de `customWeapon` — exclusivité mutuelle appliquée à 3 niveaux (UI `WeaponStep`, wizard `character-wizard.ts`, et `validate()` Règle 4 côté serveur, seule source de vérité réelle).
- Grep exhaustif de `.weaponId`/`sheetData.weaponId` sur `apps/api/src` et `apps/web/src` confirmant que seuls les sites déjà prévus (Task 2/3/4/5) lisaient ce champ — `character-sheet.html` (combobox MJ `weaponOptions()`) volontairement non touché, hors scope (le MJ ne peut pas assigner d'arme libre).
- Bout-en-bout au-delà des ACs de l'epic (décision actée dans le Contexte de la story avant codage) : `character-sheet.ts` (`weaponData` computed) et `ryuutama-pdf.service.ts` (`resolveContent()`) migrés vers `resolveWeapon()` — sans ce câblage, un personnage avec une arme libre aurait affiché une fiche/un PDF sans arme (régression silencieuse).
- `WeaponStep` étendu (pas réécrit) : carte « Créer une arme libre » ajoutée en dernière position de la grille étape 2 (jamais pour Mains nues), input texte réutilisant le pattern `FormsModule`/`ngModel` de `fetish-step.html`, effet de resynchronisation étendu pour reconstruire l'état custom au retour en arrière sur l'étape.
- Suite complète verte sans régression au-delà des ajouts prévus (Task 6) : 166/166 game-rules, 902/902 API, 998/998 web, typecheck API propre.

### File List

- `packages/game-rules/src/ryuutama/types.ts`
- `packages/game-rules/src/ryuutama/resolve-weapon-category.ts`
- `packages/game-rules/src/ryuutama/validate.ts`
- `packages/game-rules/src/index.ts`
- `packages/game-rules/src/__tests__/resolve-weapon-category.spec.ts`
- `packages/game-rules/src/__tests__/validate.spec.ts`
- `apps/api/src/characters/character.service.ts`
- `apps/api/src/characters/character.service.spec.ts`
- `apps/api/src/characters/ryuutama-pdf.service.ts`
- `apps/api/src/characters/ryuutama-pdf.service.spec.ts`
- `apps/api/src/game-systems/game-system.service.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.ts`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.html`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.scss`
- `apps/web/src/app/features/characters/character-wizard/steps/weapon-step/weapon-step.spec.ts`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.ts`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.html`
- `apps/web/src/app/features/characters/character-wizard/character-wizard.spec.ts`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.ts`
- `apps/web/src/app/features/characters/character-sheet/character-sheet.spec.ts`

## Change Log

- 2026-07-29 — Implémentation complète de l'arme libre (`customWeapon`, sibling exclusif de `weaponId`, résolution via `resolveWeapon()`) — Story passée en `review`.
- 2026-07-29 — Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor) : 1 décision utilisateur (Mains nues interdite pour l'arme libre) + 4 patches appliqués (garde de type sur `customWeapon.name`/`categoryId`, limite de 200 caractères, exclusion de `mains-nues`, test d'intégration manquant ajouté), 2 items différés (voir `deferred-work.md`), ~8 écartés. Suite finale : 171/171 tests game-rules (+5), 903/903 tests API (+1), 998/998 tests web, typecheck API propre, aucune régression. Statut passé à `done`.

### Review Findings

- [x] [Review][Decision] `customWeapon.categoryId === 'mains-nues'` doit-il être explicitement rejeté par `validate()` ? — **résolu, interdit** : décision utilisateur d'ajouter Mains nues à une liste exclue dans `validate()` Règle 4, cohérent avec le fait que cette catégorie n'offre jamais de choix côté assistant. Converti en patch ci-dessous.
- [x] [Review][Patch] `customWeapon.name`/`categoryId` non-string (ex. `{ name: 123 }`) fait planter `validate()` au lieu de produire une erreur 400 propre [packages/game-rules/src/ryuutama/validate.ts:70-78] — **corrigé** : gardes `typeof name === 'string'`/`typeof categoryId === 'string'` ajoutées avant tout accès (`.trim()`/`.includes()`), même piège déjà corrigé pour `knownRitualSpells` en Story 23.9. 2 nouveaux tests (`validate.spec.ts`).
- [x] [Review][Patch] `customWeapon.name` n'a aucune limite de longueur dans `validate()` [packages/game-rules/src/ryuutama/validate.ts:70-78] — **corrigé** : `CUSTOM_WEAPON_NAME_MAX_LENGTH = 200`, alignée sur `InventoryItem.name`/`Contenant.name`/`Animal.name` (`@MaxLength(200)`). 2 nouveaux tests (borne à 200 = valide, 201 = invalide).
- [x] [Review][Patch] `categoryId: 'mains-nues'` accepté pour une arme libre — **corrigé** (décision ci-dessus) : `NO_CUSTOM_WEAPON_CATEGORY = 'mains-nues'` explicitement exclue dans `validate()` Règle 4, message d'erreur filtre aussi cette catégorie de la liste suggérée. 1 nouveau test.
- [x] [Review][Patch] Task 6 cochée `[x]` mais sous-tâche non satisfaite : aucun test d'intégration `character.service.spec.ts` pour `weaponId`+`customWeapon` simultanés → 400 — **corrigé** : nouveau test `create() sheetData avec weaponId ET customWeapon simultanés → BadRequestException`.
- [x] [Review][Defer] `weaponId`/`customWeapon` ne forment pas une union discriminée — le typage ne peut pas empêcher les deux ou aucun à la compilation, seul `validate()` l'attrape à l'exécution — deferred, pre-existing (même limitation que `classChoices`/`classCapabilities` et les sous-listes `equipment.*`, convention déjà établie dans ce codebase).
- [x] [Review][Defer] Aucun test couvrant les transitions multi-étapes de `WeaponStep` (custom → catalogue → custom avec une catégorie différente) — deferred, pre-existing pattern de couverture (seules les transitions simples sont testées, aucun bug concret identifié, juste une lacune de couverture).

Dismissed as noise (~8) : `GameSystemService.getSchema().sheetSchema.customWeapon` sans sous-schéma typé (cohérent avec `equipment`/`narrative`, déjà `{ type: 'object' }` sans forme détaillée — champ descriptif, jamais utilisé pour l'enforcement réel) ; risque XSS sur le nom libre affiché (échappement par défaut d'Angular via interpolation `{{ }}`, aucun binding HTML brut introduit) ; réutilisation de `field: 'weaponId'` pour toutes les erreurs Règle 4 (décision explicite de la story, confirmée sans déviation par l'Acceptance Auditor) ; effet de resynchronisation de `WeaponStep` pouvant manquer un état arrivant après le chargement du catalogue (déjà explicitement différé lors de la revue de code de la Story 25.1) ; `canGoNext()` du wizard ne revalidant pas `categoryId` contre le catalogue (pattern préexistant, le cas `weaponId` seul ne le faisait pas non plus) ; incohérence de `.trim()` dans `onCustomNameInput` (relecture du code : le trim est bien appliqué avant l'émission, le finding était inexact) ; comportement du mode `'mj'` de `validate()` « invérifiable depuis le diff » (comportement préexistant, déjà testé, non modifié par cette story) ; absence de `seed-demo.ts` dans le diff (aucune migration de données requise par cette story, hors scope confirmé).
