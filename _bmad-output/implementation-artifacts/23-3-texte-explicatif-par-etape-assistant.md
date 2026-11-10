---
baseline_commit: 00cdccedf6d6e2f35591cf6c08a7fab70ce35b91
---

# Story 23.3: Texte explicatif par étape de l'assistant

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a joueur,
I want un texte d'introduction propre à chaque étape de l'assistant de création,
so that je comprenne ce que représente cette étape dans les règles, avant même de faire un choix.

## Acceptance Criteria

1. **Given** une étape du wizard (les 8 étapes supportées : `classId`, `typeId`, `attributes`, `weaponCategoryId`, `fetiqueObject`, `equipment`, `narrative`, `portrait`), **when** l'étape s'affiche, avant toute sélection de l'utilisateur, **then** un texte d'introduction propre à l'étape est visible.
2. **Given** cette même étape, **when** on compare son texte d'introduction aux descriptions des items qu'elle contient (Story 23.1/23.2), **then** les deux textes sont indépendants et jamais confondus visuellement.
3. **Given** le texte d'étape, **when** il est implémenté, **then** il provient de `docs/assistant.md` (chapitre « Créer un Voyageur » du *Guide du Voyageur*, fourni par l'utilisateur) — **jamais inventé**, même règle que les Stories 23.1/23.2. **Décision utilisateur (2026-07-26, 2ᵉ correction) : 7 des 8 textes sont seedés via `ContentType`/`ContentEntry`** (`wizardStepIntro`, `wizard-step-intros.json`, même mécanisme que `classes.json`/`types.json` — AD-1), **pas codés en dur dans `tones.ts`**, ni identiques ni déclinés par thème (un seul texte par étape, indépendant du thème actif) — `tones.ts` doit rester neutre vis-à-vis du système de jeu (l'app prévoit plusieurs systèmes de jeu à terme, cf. AD-9 révisée). Seule l'étape Portrait fait exception (cf. AC5). *(AC3 corrigée une 2ᵉ fois le 2026-07-26 — la version précédente mettait ce texte dans `tones.ts`, une erreur d'architecture signalée par l'utilisateur en revue de code — cf. Dev Notes.)*
5. **Given** l'étape Portrait, **when** cette story est implémentée, **then** `docs/assistant.md` ne fournit aucun texte pour cette étape (propre à cette app, absente du livre) — le texte d'intro reste une phrase factuelle non attribuée au livre, décliné par thème comme le reste de `tones.ts` (seule exception à AC3, confirmée par l'utilisateur : « on garde ce qui est fait »).
4. **Given** le composant `PortraitCropper` (`apps/web/src/app/features/characters/portrait-cropper/`), **when** cette story est implémentée, **then** son texte d'intro pour l'étape Portrait n'est **pas** ajouté à l'intérieur de `PortraitCropper` lui-même — ce composant est partagé avec `character-sheet.ts` (édition de portrait hors création), et y ajouter un texte propre au wizard polluerait un contexte où il n'a pas de sens.

## Tasks / Subtasks

- [x] Task 1 — ~~Ajouter les 8 nouvelles clés de thème~~ → **Seeder 7 textes via `ContentType` + 1 clé de thème pour Portrait** (AC: #1, #3, #5)
  - [x] **Historique : 2 implémentations successives.** V1 (invention totale) → V2 (texte réel mais codé en dur dans `tones.ts`, `STEP_INTRO_TEXT` partagé) → **V3 (finale) : seedé, cf. ci-dessous.**
  - [x] `apps/api/game-systems/ryuutama/data/wizard-step-intros.json` (nouveau, gitignoré) : 7 entrées `{ key, label, text }` (une par étape hors `portrait`), texte réel de `docs/assistant.md`
  - [x] `apps/api/src/game-systems/game-system.service.ts` : nouvelle entrée `CONTENT_TYPES` `{ key: 'wizardStepIntro', label: "Texte d'introduction d'étape (assistant)", file: 'wizard-step-intros.json' }` — même mécanisme générique que `classes`/`types`/etc., aucun nouveau code de lecture
  - [x] `apps/api/game-systems/ryuutama/README.md` mis à jour (nouveau fichier documenté)
  - [x] `apps/web/src/app/core/theme/tones.ts` : `STEP_INTRO_TEXT` et les 3 `...STEP_INTRO_TEXT` retirés — seule `character.step_portrait_intro` reste dans les 3 blocs `TONE_MAP` (étape absente du livre, générique tous systèmes)

- [x] Task 2 — `CharacterWizard` lit le contenu seedé (7 étapes) + le thème (Portrait uniquement) (AC: #1, #2, #4, #5)
  - [x] `character-wizard.ts` : `STEP_INTRO_KEYS` retiré, remplacé par `wizardStepIntros` (`computed<ContentEntryDto[]>` sur `content()?.['wizardStepIntro']`) et `stepIntroText` (`computed` qui cherche l'entrée par `currentStepKey()`, ou lit `theme.tone()['character.step_portrait_intro']` si l'étape est `portrait`)
  - [x] `character-wizard.html` : `<p class="wizard__step-intro">{{ stepIntroText() }}</p>`
  - [x] Aucune injection de `ThemeToneService` ajoutée à `AttributesStep`/`WeaponStep`/`FetishStep`/`EquipmentStep`/`NarrativeStep` — texte d'intro géré uniquement par `CharacterWizard`

- [x] Task 3 — Tests (AC: #1, #2, #3, #5)
  - [x] `character-wizard.spec.ts` : `CONTENT` mock étendu avec `wizardStepIntro` (7 entrées) ; `makeThemeService()` réduit à `character.step_portrait_intro` uniquement
  - [x] Test : le texte d'intro de `classId` est visible dès l'affichage, avant toute sélection
  - [x] Test : passage `classId` → `typeId` remplace le texte d'intro, l'ancien disparaît
  - [x] **Ajouté en revue de code (patch) :** test couvrant les 7 étapes seedées une par une (`currentStepIndex.set(i)`) + test dédié pour le texte thémé de Portrait — corrige le trou de couverture relevé par l'Acceptance Auditor (seules 2/8 étapes étaient testées)
  - [x] Suite complète (943 tests) exécutée, aucune régression

### Review Findings

- [x] [Review][Decision] `STEP_INTRO_TEXT` codé en dur dans `tones.ts` — mauvais emplacement architectural. **Résolu (2026-07-26) :** l'utilisateur a signalé que `tones.ts` doit rester neutre vis-à-vis du système de jeu (plusieurs wizards à venir, Palier 12/13) ; les 7 textes Ryuutama-spécifiques ont été déplacés vers un `ContentType` seedé (`wizardStepIntro`), cohérent avec AD-1. AD-9 révisée en conséquence dans la spine d'architecture. Portrait reste dans `tones.ts` (générique tous systèmes, confirmé par l'utilisateur).
- [x] [Review][Patch] Seules 2 des 8 correspondances étape→texte étaient couvertes par un test — corrigé, un test couvre désormais les 7 étapes seedées + un test dédié pour Portrait [apps/web/src/app/features/characters/character-wizard/character-wizard.spec.ts]
- [x] [Review][Patch] AC2 (« jamais confondus visuellement ») non vérifiable dans le code — règle SCSS ajoutée pour `.wizard__step-intro` (italique, couleur atténuée), distincte visuellement des descriptions d'items [apps/web/src/app/features/characters/character-wizard/character-wizard.scss]
- [x] [Review][Patch] Texte de `character.step_weapon_intro` avait un point final absent de la source — non applicable après la 2ᵉ correction (le texte est désormais dans `wizard-step-intros.json`, retranscrit sans le point final ajouté par erreur)
- [x] [Review][Defer] Apostrophes courbes (`’`) normalisées en apostrophes droites (`'`) lors de la transcription — vérifié : `docs/assistant.md` contient en réalité du mojibake d'encodage (`â€™` au lieu de `’`), la normalisation est une correction, pas une déviation de contenu — deferred, non-issue confirmé

## Dev Notes

- **⚠️ Correction majeure (2026-07-26) : ce texte EST soumis à la règle « jamais inventer ».** La version initiale de cette story affirmait le contraire (« copy UI, pas une transcription du livre ») et une première implémentation avait inventé 24 textes (8 étapes × 3 thèmes) — **erreur signalée par l'utilisateur** : *« pour la story d'avant, je t'ai dit de pas inventer les textes... et là, tu inventes tous les textes »*. L'utilisateur a fourni `docs/assistant.md` (chapitre « Créer un Voyageur » du *Guide du Voyageur*), qui donne le texte réel pour 7 des 8 étapes. Seule l'étape Portrait (absente du livre, propre à cette app) reste un texte non sourcé, explicitement approuvé par l'utilisateur (« on garde ce qui est fait »). Leçon pour les stories futures : ne jamais présumer qu'un texte est « juste de la copy UI » sans vérifier auprès de l'utilisateur s'il existe une source officielle — cf. avertissement déjà renforcé dans `epics-palier8.md` en tête de l'Epic 23.
- **Architecture : centralisé dans `CharacterWizard`, pas dans chaque `*-step.ts`.** Reste vrai après la 2ᵉ correction — `CharacterWizard` lit le contenu seedé et le distribue via `stepIntroText()`, aucun composant d'étape individuel n'a été touché, pour deux raisons factuelles :
  1. Seuls `ClassStep`/`TypeStep` injectent déjà `ThemeToneService` (pour Portrait uniquement, désormais) ; les autres composants d'étape ne l'importent pas et n'ont pas besoin de connaître le contenu seedé — `CharacterWizard` a déjà `content()` chargé pour `classes`/`types`/etc.
  2. **`PortraitCropper` est un composant partagé**, réutilisé par `character-sheet.ts` (édition de portrait hors création de personnage) — y ajouter un texte d'intro propre au *wizard* n'aurait aucun sens dans ce second contexte.
- **⚠️ 2ᵉ correction (2026-07-26, revue de code) : le texte de 7 des 8 étapes a déménagé de `tones.ts` vers un `ContentType` seedé.** La version précédente (« correction 1 ») avait remplacé le texte inventé par le texte réel du livre, mais l'avait laissé codé en dur dans `apps/web/src/app/core/theme/tones.ts` — **erreur d'architecture signalée par l'utilisateur en revue de code** : *« tones.ts doit rester assez neutre au niveau de l'app, [...] pas dépendre de quel type de jeu on fait [...] on va avoir plusieurs modes de jeux avec plusieurs wizards différents »*. AD-9 (spine Palier 8) disait explicitement « codé en dur, jamais seedé » — cette AD elle-même était fondée sur une hypothèse (un seul système de jeu à moyen terme) invalidée par la vision produit réelle de l'utilisateur. **AD-9 révisée** (`[REVISED]`, spine Palier 8) : le texte suit désormais le mécanisme `ContentType`/`ContentEntry` déjà établi (AD-1) — nouveau `ContentType` `wizardStepIntro`, seedé depuis `wizard-step-intros.json`, lu par `CharacterWizard` exactement comme `classes`/`types`. Seule l'étape Portrait (absente du livre, générique à tous les futurs systèmes de jeu) reste dans `tones.ts`. Leçon : une AD écrite pour une story donnée peut devenir obsolète si une contrainte produit plus large (ici, le multi-système futur) n'a pas été anticipée — la questionner explicitement en revue de code est légitime, pas juste appliquer les Dev Notes telles quelles.
- **Aucun changement à `GameSystemSchemaDto.creationSteps`.** Le label court (`currentStepLabel()`, barre de progression) reste distinct du texte d'intro (plus long, sous forme de `ContentEntry`).
- **Distinction avec les descriptions Story 23.1/23.2 (AC2) :** le texte d'intro d'étape (ce que représente le *choix* dans les règles, affiché AVANT toute sélection) est visuellement et sémantiquement séparé de la description d'un item une fois sélectionné (`class-step__description`, `type-step__description`, texte de talent/avantage) — les deux coexistent sur la même page pour `ClassStep`/`TypeStep` sans jamais se chevaucher dans le DOM (le nouveau `<p class="wizard__step-intro">` vit dans `character-wizard.html`, hors de `<app-class-step>`/`<app-type-step>`).

### Texte réel par étape (source : `docs/assistant.md`, seedé via `wizard-step-intros.json` — AC3)

| Clé (`ContentEntry.key`, sauf Portrait) | Texte (source : `docs/assistant.md`) |
|---|---|
| `classId` | « La première chose à faire est de choisir sa classe. Celle-ci correspond à la fois au métier et à la position sociale du voyageur. Les classes recommandées aux débutants sont le chasseur, le guérisseur, le marchand et le ménestrel. L'artisan, le fermier et le noble sont à conseiller aux joueurs qui ont déjà un peu plus l'habitude. » (§ « Choisir sa classe ») |
| `typeId` | « Les voyageurs sont confrontés à des difficultés très diverses et privilégient souvent une même façon de les résoudre. Choisissez un des types suivants : » (§ « Choisir son type », paragraphe général uniquement — cf. note ci-dessous sur les 3 sous-textes Attaque/Technique/Magie) |
| `attributes` | « Avant de partir en voyage, on détermine les quatre attributs des personnages. [...] Ainsi, un personnage polyvalent pourra avoir d8 en VIG, d4 en AGI, d6 en INT et d6 en ESP. » (§ « Déterminer les attributs », texte intégral) |
| `weaponCategoryId` | « Il y a une famille d'armes que le voyageur a appris à manier [...] Quand il utilise tout autre type d'arme, il s'épuise plus rapidement et perd 1 PV par attaque » (§ « Choisir une arme favorite », texte intégral, sans point final — fidèle à la source) |
| `fetiqueObject` | « Votre voyageur possède un objet fétiche qu'il emporte partout avec lui et qui en dit beaucoup sur sa personnalité. Toutefois, celui-ci n'a aucun effet en termes de jeu. Choisissez l'objet en question. » (§ « Choisir son objet fétiche », texte intégral) |
| `equipment` | « Pour les débutants ou les parties rapides, l'option suivante vous permet de jouer et de créer un personnage de façon simplifiée. » (§ « Acheter son équipement » → sous-section « partir en pique-nique » — cf. note ci-dessous) |
| `narrative` | « Prenez le temps de décider des détails suivants : » (§ « Lui donner une personnalité », paragraphe général uniquement — les sous-titres Nom/Sexe-Âge/etc. correspondent à des champs déjà affichés dans `NarrativeStep`, pas réutilisés comme texte d'étape) |
| `portrait` *(hors `wizardStepIntro`, cf. AC5)* | *(reste dans `tones.ts`, déclinée par thème, aucun texte dans le livre)* |

**Notes de correspondance / décisions actées avec l'utilisateur (2026-07-26) :**
- **Type (`typeId`)** : `docs/assistant.md` donne aussi 3 courts textes par type (Attaque/Technique/Magie), différents des descriptions déjà utilisées dans `types.json` (Story 23.1, extraites de `docs/types.md`). Décision utilisateur : **ne pas les utiliser dans cette story** — seul le paragraphe général sert de texte d'étape. Ces 3 courts textes sont pressentis pour une **future fonctionnalité** (aperçu résumé au survol/sélection, avec un clic pour afficher la description complète de `types.json`) — à créer comme story dédiée le moment venu, hors scope ici (notée dans `docs/backlog.md`).
- **Équipement (`equipment`)** : le paragraphe principal du livre (« Acheter son équipement », 1000 Po, achat libre) décrit une mécanique **pas encore implémentée** (Story 26.1). L'étape actuelle est intégralement en mode pique-nique (`FIXED_EQUIPMENT`, auto-assigné). L'utilisateur a complété `docs/assistant.md` avec le texte réel du livre pour l'option pique-nique (§ « partir en pique-nique ») — c'est ce texte, fidèle au mode réellement actif aujourd'hui, qui est utilisé.
- **Portrait** : aucun texte dans le livre (étape propre à cette app, générique à tous les futurs systèmes de jeu). Le texte inventé lors de la première implémentation est conservé tel quel, approuvé explicitement par l'utilisateur — seule exception documentée à la règle « jamais inventer » de cette story, et seule clé qui reste dans `tones.ts`/déclinée par thème (AC5).

### Project Structure Notes

- Backend : `apps/api/game-systems/ryuutama/data/wizard-step-intros.json` (nouveau, gitignoré), `apps/api/src/game-systems/game-system.service.ts` (+1 entrée `CONTENT_TYPES`), `apps/api/game-systems/ryuutama/README.md` (documentation).
- Frontend : `apps/web/src/app/core/theme/tones.ts` (3 blocs `TONE_MAP`, uniquement `character.step_portrait_intro` désormais), `apps/web/src/app/features/characters/character-wizard/character-wizard.ts`, `character-wizard.html`, `character-wizard.scss`, `character-wizard.spec.ts`.
- Aucun fichier de `steps/*/` à modifier — c'est le point central de cette story (AC4, Dev Notes).

### References

- [Source: docs/assistant.md] — texte réel du chapitre « Créer un Voyageur » du *Guide du Voyageur*, source de tous les textes d'étape (sauf Portrait) — fourni par l'utilisateur après 1ʳᵉ correction du 2026-07-26
- [Source: _bmad-output/planning-artifacts/epics-palier8.md#Story 23.3] — user story et Acceptance Criteria d'origine (FR-3)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-07-24/ARCHITECTURE-SPINE.md#AD-9] — **révisée le 2026-07-26** (2ᵉ correction) : texte seedé via `ContentType`/`ContentEntry` (AD-1), jamais codé en dur dans `tones.ts` — Portrait excepté
- [Source: apps/api/src/game-systems/game-system.service.ts#CONTENT_TYPES] — mécanisme de seed générique réutilisé pour `wizardStepIntro`, aucun nouveau code de lecture
- [Source: apps/web/src/app/core/theme/tones.ts] — `TONE_MAP`/`Theme`/3 thèmes existants, `character.step_portrait_intro` seule clé restante liée à cette story
- [Source: apps/web/src/app/features/characters/character-wizard/character-wizard.ts#SUPPORTED_STEP_KEYS] — les 8 clés d'étape à couvrir
- [Source: apps/web/src/app/features/characters/character-wizard/character-wizard.html] — emplacement du `@switch` où centraliser le nouveau texte
- [Source: apps/web/src/app/features/characters/portrait-cropper/] — composant partagé, ne pas y ajouter de texte propre au wizard (AC4)
- [Source: _bmad-output/implementation-artifacts/23-2-descriptions-sous-elements-talents-avantages.md] — story précédente, rappel de la distinction entre texte de règles réel (jamais inventé) et copy UI (cette story)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Implémentée le 2026-07-26 (bmad-dev-story), **V1** : 8 clés de thème (`character.step_*_intro`) dans `TONE_MAP` (24 entrées), texte **inventé** (erreur).
- Câblage centralisé dans `CharacterWizard` et rendu dans `character-wizard.html` juste avant le `@switch` — aucun composant d'étape ni `PortraitCropper` modifié, conformément à la décision d'architecture des Dev Notes (AC4). Cette partie de l'implémentation reste valable dans les 2 corrections suivantes.
- **Correction 1 (2026-07-26, retour utilisateur) :** texte inventé remplacé par le texte réel de `docs/assistant.md`, mais toujours codé en dur dans `tones.ts` (`STEP_INTRO_TEXT` partagé, identique dans les 3 thèmes).
- **Correction 2 (2026-07-26, revue de code, retour utilisateur) :** `tones.ts` doit rester neutre vis-à-vis du système de jeu (multi-systèmes à venir) — les 7 textes Ryuutama-spécifiques déplacés vers un nouveau `ContentType` seedé `wizardStepIntro` (`wizard-step-intros.json`, même mécanisme qu'AD-1). `CharacterWizard` lit désormais `content()?.['wizardStepIntro']` au lieu de `tones.ts` pour ces 7 étapes ; seule Portrait reste dans `tones.ts` (générique tous systèmes). AD-9 révisée dans la spine d'architecture (`[REVISED]`). AC3 et Task 1/2 réécrites en conséquence.
- **Findings de revue de code appliqués dans la foulée :** couverture de test étendue aux 7 étapes seedées + Portrait (était 2/8), règle SCSS ajoutée pour `.wizard__step-intro` (AC2), point final erroné sur le texte de l'arme favorite corrigé lors de la retranscription dans le JSON seedé.
- 943/943 tests web + 898/898 tests API, aucune régression. Lint et `pnpm typecheck` (API) propres.

### File List

- `apps/api/game-systems/ryuutama/data/wizard-step-intros.json` (nouveau, gitignoré — 7 entrées)
- `apps/api/src/game-systems/game-system.service.ts` (+1 entrée `CONTENT_TYPES`)
- `apps/api/game-systems/ryuutama/README.md` (documentation du nouveau fichier)
- `apps/web/src/app/core/theme/tones.ts` (`STEP_INTRO_TEXT` retiré, seule `character.step_portrait_intro` demeure)
- `apps/web/src/app/features/characters/character-wizard/character-wizard.ts` (`wizardStepIntros`, `stepIntroText`)
- `apps/web/src/app/features/characters/character-wizard/character-wizard.html` (`<p class="wizard__step-intro">{{ stepIntroText() }}</p>`)
- `apps/web/src/app/features/characters/character-wizard/character-wizard.scss` (règle `&__step-intro`)
- `apps/web/src/app/features/characters/character-wizard/character-wizard.spec.ts` (mock `CONTENT`/`makeThemeService` mis à jour, 4 tests d'intro)

## Change Log

- 2026-07-26 : Story créée (bmad-create-story). Décision d'architecture : centraliser le texte d'intro dans `CharacterWizard` plutôt que dans chaque composant d'étape.
- 2026-07-26 : Implémentée (bmad-dev-story), V1 avec texte inventé. 941/941 tests web, aucune régression. Statut passé à "review".
- 2026-07-26 : Correction 1 (retour utilisateur). Texte inventé remplacé par le texte réel de `docs/assistant.md`, toujours dans `tones.ts`. 941/941 tests web après correction.
- 2026-07-26 : Revue de code (bmad-code-review). Correction 2 (retour utilisateur, architecture) : 7 des 8 textes déplacés de `tones.ts` vers un `ContentType` seedé (`wizardStepIntro`), AD-9 révisée. 3 findings de revue appliqués (couverture de test, SCSS AC2, ponctuation). 943/943 tests web + 898/898 tests API, aucune régression. Statut passé à "done".
