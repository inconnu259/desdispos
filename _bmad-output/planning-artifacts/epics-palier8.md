---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-07-24/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-07-24/ARCHITECTURE-SPINE.md'
---

# jdr-master - Epic Breakdown — Palier 8 : Refonte complète des classes et textes Ryuutama

## Overview

Ce document décompose le PRD du Palier 8 (`prd-jdr-master-2026-07-24`) et la spine d'architecture correspondante (`architecture-jdr-master-2026-07-24`) en epics et stories implémentables. Numérotation des epics dans la continuité du projet : le Palier 7 s'est terminé à l'Epic 22 — ce palier démarre donc à l'**Epic 23**.

## Requirements Inventory

### Functional Requirements

FR1: Chaque classe, chaque type et chaque catégorie d'arme porte un champ `description` (texte narratif/règles), au même niveau de détail que les catalogues Homme Dragon déjà enrichis.
FR2: Chaque sous-élément d'un type de contenu enrichi par FR1 (un avantage de Type, un talent de Classe) porte aussi son propre champ `description`.
FR3: Chaque étape de l'assistant de création/évolution de personnage affiche un texte d'introduction propre à l'étape, indépendant des descriptions des items choisis dedans.
FR4: Le catalogue de classes est complété avec les classes du *Guide du Voyageur* absentes aujourd'hui.
FR5: Chaque classe porte une liste d'occupations et une liste d'actions — texte de référence pur, sans mécanique de jeu.
FR6: Chaque talent d'une classe (toujours exactement 3 par classe) porte un nom, une description propre, et un effet structuré (description, conditions), en plus des attributs et de la difficulté déjà existants.
FR7: Le catalogue de profils d'attributs passe de 1 à 3 entrées : Équilibré, Polyvalent (existant), Spécialiste.
FR8: Le joueur choisit une arme précise dans une liste, chaque arme étant rattachée à une catégorie qui porte les formules de touche/dégâts/encombrement et gagne une description + une liste (non-exhaustive) d'armes types.
FR9: Le joueur peut créer une arme ne figurant pas dans la liste, en la rattachant manuellement à une catégorie existante.
FR10: L'étape équipement de l'assistant propose un choix explicite entre (a) le nécessaire de voyage pré-fait (mode pique-nique existant, enrichi) et (b) un achat libre dans une liste figée d'objets achetables, avec un budget de départ de 1000 Po.
FR11: Un nouveau catalogue porte les règles de magie et la liste des sorts du *Guide du Voyageur*, avec le même niveau de détail que les autres types de contenu enrichis par ce palier.
FR12: Un nouveau catalogue porte exactement les 4 rôles de groupe (cartographe, chef, chroniqueur, intendant), chacun avec une description.
FR13: Le MJ peut assigner un rôle à un personnage de sa Partie. Le joueur ne choisit jamais son propre rôle ; aucun mécanisme de vote.
FR14: Le rôle assigné à un personnage est visible via un badge sur son avatar, dans le même emplacement que le badge de montée de niveau existant — masqué tant qu'une montée de niveau est en attente.
FR15: Une fois FR1 à FR14 implémentées, redemander explicitement à l'utilisateur s'il reste des textes/classes/armes/sorts à ajouter avant de considérer le palier terminé.

### NonFunctional Requirements

Aucune NFR nouvelle propre à ce palier. Contrainte permanente héritée et inchangée :

NFR4 (héritée, inchangée) : le contenu Ryuutama reste gitignoré (droits d'auteur) et seedé depuis des fichiers JSON au démarrage de l'API (`GameSystemService.onApplicationBootstrap()`), jamais codé en dur, jamais lu directement par le frontend. *(NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.)*

### Additional Requirements

- **Aucun starter/template greenfield** — projet brownfield existant, aucune Story 1 d'amorçage de dépôt nécessaire.
- Quatre nouveaux `ContentType`/`ContentEntry` à ajouter à `CONTENT_TYPES` (`game-system.service.ts`) : `weaponItem`, `spell`, `groupRole`, `equipmentItem` — même mécanisme de seed que l'existant (AD-1).
- Nouveau modèle Prisma `CharacterGroupRole` (migration requise) avec deux contraintes d'unicité (`[partieId, roleKey]`, `[partieId, characterId]`) (AD-5).
- Nouveau module backend dédié `apps/api/src/character-roles/` (module/service/controller), incluant un endpoint de liste (`GET /parties/:id/character-roles`) en plus des endpoints d'assignation/retrait (AD-6).
- Restructuration `RyuutamaSheetData.weaponCategoryId` → `weaponId` + `customWeapon?` — touche `packages/game-rules` (`validate.ts`, `types.ts`, nouvelle fonction `resolveWeaponCategory`), et 4 consommateurs frontend/backend existants à mettre à jour : `pdf-field-map.ts`, `character-sheet.ts`, `GameSystemService.getSchema()`, `character-wizard.ts` (AD-2).
- Nouveau champ `priceGold: number` + `nature: 'individual'|'contenant'|'animal'` sur le catalogue `equipmentItem`, distinct du prix texte libre existant sur `InventoryItem` (AD-4).
- Validation du budget de départ (1000 Po) côté serveur, dans `CharacterService.create()` uniquement — jamais re-vérifiée sur une édition MJ ultérieure (AD-4).
- Extension de `RosterRow` (`roster-row.util.ts`) avec `assignedRoleLabel`, alimentée par le nouvel endpoint de liste, priorité au badge de montée de niveau existant (AD-7).
- Câblage temps réel : `CharacterRolesService` (backend) doit `emit(partieTopic(...))` en fin de mutation ; `PartieDetail` doit relire les rôles assignés sur le signal `changed` existant — aucune nouvelle entrée `RealtimeService.handlers` requise (AD-8, réutilise le contrat du Palier 7).
- Aucune migration des personnages existants pour la refonte d'arme — `seed-demo.ts` mis à jour, pas de script de migration one-off (décision produit, cf. PRD §5).
- Reset global de la base de dev attendu au déploiement de ce palier (cohérent avec la décision ci-dessus).

### UX Design Requirements

Aucun contrat UX pour ce palier (confirmé avec l'utilisateur) — aucune refonte visuelle prévue, reportée au Palier 9.

### FR Coverage Map

FR1: Epic 23 - Description sur chaque entrée de contenu de premier niveau (classe/type/arme)
FR2: Epic 23 - Description sur les sous-éléments (avantage de Type, talent de Classe)
FR3: Epic 23 - Texte explicatif par étape de l'assistant
FR4: Epic 23 - Classes manquantes ajoutées
FR5: Epic 23 - Occupations et actions par classe
FR6: Epic 23 - Talents enrichis (effet structuré)
FR7: Epic 24 - Trois profils d'attributs disponibles
FR8: Epic 25 - Choix d'une arme précise rattachée à une catégorie
FR9: Epic 25 - Création d'une arme libre
FR10: Epic 26 - Choix entre nécessaire pré-fait et achat libre (budget 1000 Po)
FR11: Epic 23 - Catalogue de sorts et règles de magie
FR12: Epic 27 - Catalogue des 4 rôles
FR13: Epic 27 - Assignation d'un rôle par le MJ
FR14: Epic 27 - Affichage du rôle assigné (badge)
FR15: Epic 27 - Rappel de vérification de complétude en fin de palier

## Epic List

### Epic 23: Contenu Ryuutama enrichi
Le joueur retrouve, à chaque étape de création, les textes et le contenu réels du *Guide du Voyageur* — classes complètes avec occupations/actions/talents détaillés, descriptions sur types/armes/sous-éléments, catalogue de sorts disponible.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR11

### Epic 24: Profils d'attributs
Le joueur choisit entre 3 profils d'attributs distincts (Équilibré, Polyvalent, Spécialiste) au lieu d'un seul imposé.
**FRs covered:** FR7

### Epic 25: Refonte du choix d'arme
Le joueur choisit une arme précise (dague, arbalète...) plutôt qu'une catégorie abstraite, avec possibilité de créer une arme libre.
**FRs covered:** FR8, FR9

### Epic 26: Équipement de départ
Le joueur choisit entre le nécessaire de voyage pré-fait ou un achat libre avec un budget de 1000 Po.
**FRs covered:** FR10

### Epic 27: Rôles de groupe
Le MJ assigne un rôle de groupe (cartographe, chef, chroniqueur, intendant) à un personnage de sa Partie, visible via un badge sur l'avatar.
**FRs covered:** FR12, FR13, FR14, FR15

## Epic 23: Contenu Ryuutama enrichi

Le joueur retrouve, à chaque étape de création, les textes et le contenu réels du *Guide du Voyageur* — classes complètes avec occupations/actions/talents détaillés, descriptions sur types/armes/sous-éléments, catalogue de sorts disponible.

**⚠️ Règle absolue pour toutes les stories de cet épic (23.1 à 23.8) et toute future story portant sur du texte officiel : ne jamais inventer/halluciner de contenu, même partiellement, même pour combler un champ qui semble manquer.** Si la source (`docs/*.md`, fournie par l'utilisateur) ne documente pas un élément à la granularité attendue par une Acceptance Criteria (ex. pas de paragraphe narratif à un niveau donné), **ne pas écrire un texte plausible pour combler ce vide** — soit omettre le champ, soit s'arrêter et demander confirmation à l'utilisateur avant d'implémenter. Erreur commise et corrigée pendant l'implémentation de la Story 23.2 (description inventée sur les avantages de type, alors que `docs/types.md` n'a qu'un tableau à 2 colonnes Avantages/Effets, sans texte narratif par avantage) — ne pas la reproduire sur les stories suivantes (23.3 à 23.8, ainsi que toute story future de contenu Ryuutama).

### Story 23.1: Descriptions sur classes, types et catégories d'armes

As a joueur,
I want voir une description narrative sur chaque classe, type et catégorie d'arme que je peux choisir,
So that je comprenne le sens de mon choix, pas seulement un nom et des chiffres.

**Acceptance Criteria:**

**Given** le catalogue `classes`/`types`/`weaponCategory` seedé
**When** une entrée est chargée
**Then** elle porte un champ `description` non vide, au même niveau de détail que `homme-dragon-artefacts.json`/`eveil-powers.json`

**Given** l'assistant de création de personnage
**When** le joueur consulte `ClassStep` ou `TypeStep`
**And** aucun champ `description` n'existe aujourd'hui dans le modèle de données interne de ces composants
**Then** la description de l'item survolé/sélectionné s'affiche à l'écran

**Given** `WeaponStep`, entièrement réécrit par la Story 25.1 (choix d'une arme précise plutôt que d'une catégorie)
**When** cette story (23.1) est implémentée
**Then** elle se limite à ajouter le champ `description` aux données `weapon-categories.json` — aucun câblage d'affichage dans `WeaponStep` ici, pour éviter de refaire ce travail lors de la réécriture de la Story 25.1 (qui affichera cette description dans sa propre UI)

### Story 23.2: Correction et enrichissement des talents de classe et avantages de type

As a joueur,
I want voir une description propre à chaque talent de classe et à chaque avantage de type, et que ces talents/avantages correspondent réellement aux règles du livre,
So that je comprenne ce que chaque talent/avantage fait concrètement, sans jouer avec des noms/effets approximés absents du livre.

*(Scope élargi le 2026-07-26, décision utilisateur, suite à la découverte que 6/7 classes et 2/3 types ont des talents/avantages seedés ne correspondant pas au* Guide du Voyageur *— cf. story file pour le détail complet.)*

**Acceptance Criteria:**

**Given** une classe ou un type seedé
**When** ses talents/avantages sont chargés
**Then** ils correspondent réellement aux talents/avantages du livre (nom, effet, attributs, difficulté) — pas seulement les entrées déjà correctes par coïncidence (Artisan, type Attaque)

**Given** un talent ou un avantage (corrigé si besoin)
**When** il est chargé
**Then** il porte son propre champ `description`, distinct de la description de l'entrée parente

**Given** `ClassStep`/`TypeStep`
**When** un talent ou un avantage est affiché
**Then** son texte propre s'affiche, jamais confondu avec le texte de la classe/du type parent

**Given** cette story
**When** elle est complétée
**Then** elle ne restructure pas `effect` (reste `string` — la forme `{ description, conditions }` est le scope différé de la Story 23.6/AD-10)

### Story 23.3: Texte explicatif par étape de l'assistant

As a joueur,
I want un texte d'introduction propre à chaque étape de l'assistant de création,
So that je comprenne ce que représente cette étape dans les règles, avant même de faire un choix.

**Acceptance Criteria:**

**Given** une étape du wizard (classe, type, attributs, arme, équipement...)
**When** l'étape s'affiche, avant toute sélection de l'utilisateur
**Then** un texte d'introduction propre à l'étape est visible

**Given** cette même étape
**When** on compare son texte d'introduction aux descriptions des items qu'elle contient (Story 23.1/23.2)
**Then** les deux textes sont indépendants — le texte d'étape reste codé en dur dans le composant, jamais seedé (pas de 5ᵉ type de contenu créé pour ça)

### Story 23.4: Classes manquantes ajoutées

As a MJ ou joueur,
I want retrouver toutes les classes du *Guide du Voyageur* dans le catalogue,
So that je ne sois pas limité aux 7 classes actuellement seedées.

**Acceptance Criteria:**

**Given** le catalogue `classes.json` actuel (7 entrées)
**When** ce palier est terminé
**Then** le nombre de classes seedées correspond au nombre de classes réelles du livre (contenu fourni par l'utilisateur pendant cette story)

**Given** une classe nouvellement ajoutée
**When** elle est seedée
**Then** elle respecte la forme de `classes.json` telle qu'elle existe au moment de cette story (label, talents, description) — les champs occupations/actions/effet structuré n'existent pas encore à ce stade et seront ajoutés rétroactivement à *toutes* les classes (existantes et nouvelles) par les Stories 23.5/23.6, sans précondition sur celle-ci

**Given** une classe nouvellement ajoutée dont la `key` entrerait en collision avec une classe existante
**When** le contenu est seedé
**Then** ce cas est évité par la discipline d'auteur du contenu (vérification manuelle avant merge) — aucune garde runtime, cohérent avec l'absence de garde équivalente sur les autres catalogues

### Story 23.5: Occupations et actions par classe

As a joueur,
I want voir une liste d'occupations et une liste d'actions pour ma classe,
So that j'aie des pistes de jeu et d'idées de métier pour mon personnage.

**Acceptance Criteria:**

**Given** une classe seedée
**When** elle est chargée
**Then** elle porte une liste d'occupations et une liste d'actions

**Given** l'assistant de création ou la fiche de personnage
**When** ces deux listes sont affichées
**Then** aucune sélection ni saisie n'est possible dessus — texte de référence pur, aucune validation

### Story 23.6: Talents enrichis (effet structuré)

As a joueur,
I want comprendre précisément l'effet, les conditions, les attributs et la difficulté de chaque talent,
So that je sache exactement ce que mon talent permet de faire et sous quelles conditions.

**Acceptance Criteria:**

**Given** un talent de classe (toujours exactement 3 par classe)
**When** il est chargé
**Then** il porte `{ name, description, effect: { description, conditions }, attributes, difficulty }` — `attributes`/`difficulty` restent des champs frères de `effect`, jamais imbriqués dessous

**Given** les tests existants de validation des talents
**When** la nouvelle forme est en place
**Then** ils restent valides sans modification — seuls `description`/`effect.description`/`effect.conditions` sont additifs

**Given** l'affichage d'un talent dans l'assistant/la fiche
**When** il est présenté
**Then** son propre texte (description du talent) est visible, distinct du texte de description de l'effet

### Story 23.7: Catalogue de sorts

As a MJ,
I want un catalogue des règles de magie et de la liste des sorts du livre,
So that je dispose du contenu officiel même si la mécanique de lancement de sort n'est pas encore jouable.

**Acceptance Criteria:**

**Given** le mécanisme `GameSystemService.seedRyuutama()`/`CONTENT_TYPES`
**When** ce palier est implémenté
**Then** un nouveau `ContentType` `spell` est seedé depuis `spells.json`, même mécanisme que les catalogues existants (aucun nouveau système de lecture)

**Given** un sort seedé
**When** il est chargé
**Then** il porte au minimum un nom et une description/effet non vide

**Given** la mécanique d'apprentissage/lancement de sort
**When** cette story est complétée
**Then** elle reste explicitement hors scope — catalogue de contenu seul, mécanique différée (Open Question 2 du PRD)

### Story 23.8: Cas particuliers de création propres à certaines classes

As a joueur,
I want que l'assistant de création me propose les choix spécifiques imposés par ma classe (au-delà de la spécialité de l'Artisan, déjà gérée),
So that mon personnage respecte réellement les règles du livre pour ces classes plutôt que d'ignorer silencieusement une mécanique de création qui leur est propre.

**Contexte (cas détectés dans `docs/classes.md`) :**

- **Fermier** — talent *Métier d'appoint* : à la création, peut choisir un talent d'une **autre classe** à condition que ce talent implique un test (colonne Attributs renseignée dans le livre, un « - » signifiant « pas de test » donc non éligible) ; le personnage subit alors un malus de -1 permanent sur l'utilisation de ce talent emprunté.
- **Ermite** (ajouté par la Story 23.4) — même talent *Métier d'appoint* que le Fermier (talent emprunté à une autre classe, malus -1) **et** talent *Métamorphose* : à l'acquisition, doit choisir un type de paysage (le personnage peut ensuite se transformer en n'importe quel animal vivant sur ce paysage).
- **Dresseur** (ajouté par la Story 23.4) — talent *Autorité* : à l'acquisition, doit choisir un type de créature parmi animaux/plantes fantastiques/créations magiques/démons/morts-vivants — mécanique structurellement proche de la spécialité de l'Artisan (`requiresSpecialty`), mais avec une liste fermée d'options plutôt qu'une saisie libre.
- **Météomancien** (ajouté par la Story 23.4) — talent *Climatophile* : donne un « climat favori » supplémentaire ; **à vérifier avec l'utilisateur** si ce choix est distinct du système de climat favori déjà existant ailleurs dans la fiche de personnage, ou s'il s'agit d'une resélection propre à ce talent.
- Aucun cas de choix à la création détecté pour Chasseur, Guérisseur, Marchand, Ménestrel, Noble, Navigateur, Professeur (dépend des classes ajoutées par la Story 23.4 pour ces 3 dernières).

**Acceptance Criteria:**

**Given** le modèle de données actuel des classes (`talents: ClassTalent[]`, pas de mécanisme générique de choix à l'acquisition en dehors de `requiresSpecialty`/`specialtyLabel` propre à l'Artisan)
**When** cette story est implémentée
**Then** un mécanisme de données générique permet de déclarer, par classe, un ou plusieurs choix requis à la création (ex. « emprunter un talent à une autre classe ayant un test », « choisir un type de paysage/créature dans une liste ») — pas un champ ad hoc par classe

**Given** un joueur qui sélectionne une classe portant un choix requis (Fermier, ou Ermite/Dresseur/Météomancien selon confirmation ci-dessus une fois la Story 23.4 en place)
**When** il arrive à `ClassStep` de l'assistant de création
**Then** l'interface propose le choix spécifique correspondant (ex. liste des talents éligibles d'autres classes pour le Fermier/l'Ermite, liste fermée de paysages/créatures pour l'Ermite/le Dresseur) et bloque la progression si le choix n'est pas fait

**Given** le talent *Métier d'appoint* (Fermier, Ermite)
**When** le joueur choisit un talent d'une autre classe
**Then** seuls les talents dont `attributes` est renseigné (non « - »/vide) sont proposés, et le malus de -1 est appliqué et visible sur ce talent dans la fiche de personnage résultante

**Given** cette story
**When** elle est complétée
**Then** elle ne redéfinit ni ne retire le mécanisme existant `requiresSpecialty`/`specialtyLabel` de l'Artisan — elle ajoute un mécanisme complémentaire pour les autres classes, sans régression sur l'Artisan

### Story 23.9: Choix de la magie à la création (type Magie)

As a joueur,
I want, en choisissant le type Magie, sélectionner ma saison d'affinité et les sorts de magie rituelle que je connais,
So that mon personnage magicien soit réellement jouable dès sa création, pas seulement le type qui l'annonce.

**Contexte :** le type Magie (`types.json`) donne déjà accès aux deux formes de magie simultanément (décision actée à la Story 23.7 — avantages « Grimoire » et « Lié aux saisons » tous deux accordés). Le catalogue de sorts existe (Story 23.7, `spells.json`, `ContentType` `spell`). Cette story câble le choix côté assistant de création :

- **Magie des saisons** : le joueur choisit **une seule** saison d'affinité (`printemps`/`ete`/`automne`/`hiver`, catalogue `season` existant) — un choix fixe, non modifiable après coup à ce stade (pas de mécanique de re-choix prévue).
- **Magie rituelle** : le joueur choisit ses sorts rituels connus parmi ceux du palier « Débutant » (niveaux 1-3, `minLevel: 1`) — nombre exact de sorts à la création à trancher avec l'utilisateur (le livre indique « deux nouveaux sorts à chaque montée de niveau », donc probablement 2 sorts au niveau 1).

**Acceptance Criteria (à affiner avant `create-story`) :**

**Given** un personnage dont `typeId` vaut `magie`
**When** l'assistant de création arrive à l'étape Type (ou une étape dédiée juste après)
**Then** le joueur doit choisir une saison d'affinité parmi les 4 du catalogue `season`, et sélectionner ses sorts de magie rituelle connus parmi ceux de `tier: "debutant"` du catalogue `spell` — la progression bloque tant que ces choix ne sont pas faits

**Given** cette story
**When** elle est complétée
**Then** elle ne câble aucune mécanique de lancement de sort (test INT+ESP, dépense de PE, ciblage) — uniquement le choix à la création. La progression des sorts connus aux montées de niveau suivantes (nouveaux sorts rituels à chaque niveau, déblocage automatique des paliers Intermédiaire/Avancé pour la saison) reste hors scope, différée à une story ultérieure.

**Ouvert à trancher avant `create-story`** : nombre exact de sorts rituels choisis au niveau 1 ; forme du/des nouveau(x) champ(s) sur `RyuutamaSheetData` (ex. `seasonAffinity: string`, `knownRitualSpells: string[]`) ; où dans l'assistant ce choix s'insère (nouvelle étape dédiée vs sous-section de l'étape Type) ; affichage sur la fiche de personnage et export PDF (déjà confirmé : aucun champ PDF dédié à la magie, cf. Story 23.7).

## Epic 24: Profils d'attributs

Le joueur choisit entre 3 profils d'attributs distincts (Équilibré, Polyvalent, Spécialiste) au lieu d'un seul imposé.

### Story 24.1: Trois profils d'attributs disponibles

As a joueur,
I want choisir entre 3 profils d'attributs distincts (Équilibré, Polyvalent, Spécialiste),
So that mon personnage ait une vraie diversité de build, pas seulement des permutations d'un même jeu de valeurs.

**Acceptance Criteria:**

**Given** le catalogue `attribute-patterns.json` actuel (1 seule entrée, « Polyvalent »)
**When** ce palier est implémenté
**Then** le catalogue passe à 3 entrées : Équilibré, Polyvalent (valeurs reconfirmées), Spécialiste (valeurs fournies par l'utilisateur pendant cette story)

**Given** `validate()` (`packages/game-rules`)
**When** un personnage est créé avec l'un des 3 profils
**Then** `attributePatterns` du catalogue accepte les 3 comme valides

**Given** l'assistant de création (`AttributesStep`)
**When** le joueur arrive à l'étape des attributs
**Then** il voit un vrai choix entre 3 répartitions de valeurs distinctes — pas 3 permutations du même multi-ensemble, contrairement à l'état actuel

## Epic 25: Refonte du choix d'arme

Le joueur choisit une arme précise (dague, arbalète...) plutôt qu'une catégorie abstraite, avec possibilité de créer une arme libre.

### Story 25.1: Choix d'une arme précise rattachée à une catégorie

As a joueur,
I want choisir une arme précise (dague, arbalète...) plutôt qu'une catégorie abstraite,
So that mon choix reflète vraiment les règles du livre — la catégorie continue de déterminer mes formules de combat.

**Acceptance Criteria:**

**Given** le catalogue `weapon-categories.json` existant (arc, épée courte, épée longue, hache, lance), enrichi d'une description par la Story 23.1
**When** ce palier est implémenté
**Then** un nouveau `ContentType` `weaponItem` est seedé (`weapon-items.json`), chaque entrée portant `{ key, label, categoryId }` ; `WeaponStep` (entièrement réécrit ici) affiche la description de la catégorie résolue en plus de celle de l'arme précise choisie, et gagne une liste non-exhaustive d'armes types par catégorie

**Given** `RyuutamaSheetData.weaponCategoryId`
**When** cette story est complétée
**Then** ce champ est remplacé par `weaponId: string` (référence une entrée `weaponItem`) — la catégorie n'est plus jamais stockée directement

**Given** un personnage avec un `weaponId` choisi
**When** ses formules de touche/dégâts/encombrement sont calculées
**Then** elles sont dérivées à la lecture via `resolveWeaponCategory(weaponId, catalog)` (nouvelle fonction pure, `packages/game-rules`), jamais stockées en double

**Given** les 4 consommateurs existants de `weaponCategoryId` (vérifiés brownfield)
**When** cette story est complétée
**Then** ils lisent tous `weaponId` : `pdf-field-map.ts` (`weaponPdfOption`), `character-sheet.ts` (affichage fiche), `GameSystemService.getSchema()` (clé d'étape), `character-wizard.ts` (`SUPPORTED_STEP_KEYS`/`FIELD_TO_STEP_KEY`)

**Given** `RyuutamaCatalog.validWeaponItems`
**When** `validate()` vérifie une fiche
**Then** cette liste est une projection du catalogue `weaponItem` complet (`entries.map(e => e.key)`), jamais reconstruite séparément de la liste utilisée par `resolveWeaponCategory`

**Given** aucune migration prévue pour les personnages existants (décision produit)
**When** ce palier est déployé
**Then** `seed-demo.ts` est mis à jour pour refléter le nouveau modèle — pas de script de migration one-off, reset de la base de dev attendu

### Story 25.2: Création d'une arme libre

As a joueur,
I want créer une arme qui ne figure pas dans la liste,
So that je puisse jouer une arme non couverte par le catalogue, tout en gardant des formules de combat cohérentes.

**Acceptance Criteria:**

**Given** l'étape de choix d'arme (Story 25.1 complétée)
**When** le joueur choisit de créer une arme libre
**Then** elle est stockée `{ customWeapon: { name: string, categoryId: string } }` dans `sheetData`, sibling de `weaponId` — jamais les deux renseignés, jamais aucun des deux

**Given** une arme personnalisée avec un `categoryId` choisi
**When** ses formules sont calculées
**Then** elle hérite exactement des mêmes formules que la catégorie référencée

**Given** le mode d'édition MJ (`validate(data, 'mj', catalog)`, permissif par convention établie)
**When** une fiche porte transitoirement à la fois `weaponId` et `customWeapon`
**Then** la résolution à la lecture privilégie toujours `weaponId` en premier — un seul chemin déterministe

**Given** `ContentEntry.scope` `MJ`/`PARTIE` (déjà présent dans le schéma, réservé au Palier 15 homebrew)
**When** cette story est implémentée
**Then** aucune arme personnalisée ne crée de `ContentEntry` — elle reste strictement inline dans `sheetData`, jamais partagée/interrogée entre personnages

## Epic 26: Équipement de départ

Le joueur choisit entre le nécessaire de voyage pré-fait ou un achat libre avec un budget de 1000 Po.

### Story 26.1: Choix entre nécessaire pré-fait et achat libre

As a joueur,
I want choisir entre le nécessaire de voyage pré-fait et un achat libre avec un budget de 1000 Po,
So that je puisse personnaliser mon équipement de départ au lieu de recevoir automatiquement une liste figée.

**Acceptance Criteria:**

**Given** le mode pique-nique actuel (`FIXED_EQUIPMENT`, `equipment-step.ts`, auto-assigné sans choix)
**When** ce palier est implémenté
**Then** l'étape équipement propose un choix explicite entre (a) le nécessaire pré-fait, enrichi avec le contenu réel du livre, et (b) un achat libre

**Given** un nouveau `ContentType` `equipmentItem`
**When** il est seedé (`equipment-items.json`)
**Then** chaque entrée porte `{ key, label, priceGold: number, nature: 'individual'|'contenant'|'animal', ...description/effet }` — `priceGold` numérique, distinct du champ `price` texte libre existant sur `InventoryItem`

**Given** un joueur qui achète des objets pour un total donné
**When** `CharacterService.create()` reçoit la sélection
**Then** le total ne peut pas dépasser 1000 Po — validation serveur, au moment de la création uniquement, rejet via `BadRequestException` (même convention que les autres validations de `CharacterService.create()`)

**Given** un objet acheté avec `nature: 'animal'`
**When** il est converti en entrée d'inventaire
**Then** il ne porte jamais de poids (cohérent avec `Animal = Omit<InventoryItem, 'weight'>` déjà en place)

**Given** un achat validé (pique-nique ou libre)
**When** le personnage est créé
**Then** le résultat alimente `equipment.individual`/`contenants`/`animaux` existants (Épic 14) — aucun nouveau modèle d'inventaire, `id` généré serveur, `addedBy: 'player'`

**Given** une édition ultérieure de l'équipement par le MJ (mécanisme `sheet-field` existant)
**When** elle a lieu après la création
**Then** elle n'est jamais re-vérifiée contre le budget de 1000 Po — cohérent avec l'édition MJ sans contrainte déjà établie

## Epic 27: Rôles de groupe

Le MJ assigne un rôle de groupe (cartographe, chef, chroniqueur, intendant) à un personnage de sa Partie, visible via un badge sur l'avatar.

### Story 27.1: Catalogue des 4 rôles

As a MJ,
I want un catalogue des 4 rôles de groupe (cartographe, chef, chroniqueur, intendant),
So that je puisse ensuite les assigner aux personnages de ma Partie.

**Acceptance Criteria:**

**Given** le mécanisme `CONTENT_TYPES`/`GameSystemService.seedRyuutama()`
**When** ce palier est implémenté
**Then** un nouveau `ContentType` `groupRole` est seedé depuis `group-roles.json`, exactement 4 entrées (cartographe, chef, chroniqueur, intendant), chacune avec une description

**Given** cette contrainte de nombre
**When** le contenu est seedé
**Then** elle est assurée par la discipline d'auteur du contenu (comme « exactement 3 talents par classe »), pas par une garde runtime

### Story 27.2: Assignation d'un rôle par le MJ

As a MJ,
I want assigner un rôle de groupe à un personnage de ma Partie,
So that les joueurs sachent qui tient quel rôle sans avoir à le gérer eux-mêmes.

**Acceptance Criteria:**

**Given** un nouveau modèle Prisma `CharacterGroupRole { id, characterId, partieId, roleKey, assignedAt }`
**When** cette story est implémentée
**Then** deux contraintes d'unicité sont en place : `[partieId, roleKey]` (un seul titulaire par rôle par Partie) et `[partieId, characterId]` (un personnage ne porte jamais deux rôles à la fois)

**Given** un nouveau module dédié `CharacterRolesModule` (`apps/api/src/character-roles/`)
**When** le MJ assigne ou retire un rôle
**Then** seul le MJ de la Partie peut écrire (`getOwned`) ; tout membre peut lire (`getViewable`) — aucun nouveau guard NestJS

**Given** un `characterId` ciblé
**When** une assignation est demandée
**Then** le service vérifie explicitement que ce personnage appartient bien au `partieId` avant toute écriture

**Given** un `roleKey` déjà tenu par un autre personnage
**When** le MJ tente de l'assigner à un second personnage
**Then** la requête échoue explicitement (`ConflictException`) — jamais une éviction silencieuse de l'ancien titulaire (le MJ doit d'abord le retirer explicitement)

**Given** les endpoints `POST`/`DELETE /parties/:id/characters/:characterId/role` et `GET /parties/:id/character-roles`
**When** une assignation ou un retrait réussit
**Then** `CharacterRolesService` appelle `realtimeEvents.emit(partieTopic(partieId))` en fin de méthode, même discipline que les autres services de mutation

### Story 27.3: Affichage du rôle assigné (badge)

As a joueur ou MJ,
I want voir le rôle assigné à chaque personnage directement sur son avatar,
So that toute la table sache qui tient quel rôle sans avoir à le demander.

**Acceptance Criteria:**

**Given** `RosterRow` (`roster-row.util.ts`) et son badge `hasPendingLevelUp` existant
**When** cette story est implémentée
**Then** `RosterRow` gagne un champ `assignedRoleLabel`, alimenté par `GET /parties/:id/character-roles` + le catalogue `groupRole`

**Given** un personnage avec un rôle assigné ET une montée de niveau en attente
**When** le roster s'affiche
**Then** seul le badge de montée de niveau est visible, jamais les deux simultanément — dès que la montée de niveau est traitée, le badge de rôle redevient visible

**Given** le signal temps réel déjà en place sur `PartieDetail` (topic `partie:{id}`, Palier 7)
**When** un rôle est assigné/retiré par le MJ
**Then** le roster affiché chez tout membre de la Partie se met à jour sans rechargement de page — aucune nouvelle entrée `RealtimeService.handlers`, réutilise le signal `changed` de `CharacterService`

### Story 27.4: Vérification de complétude en fin de palier

As a MJ (utilisateur du projet),
I want qu'on me redemande explicitement s'il reste du contenu à ajouter une fois tout implémenté,
So that le palier ne se termine pas avec des textes/classes/armes/sorts oubliés.

**Acceptance Criteria:**

**Given** les Stories 23.1 à 27.3 toutes complétées
**When** cette story démarre
**Then** l'agent/le développeur redemande explicitement à l'utilisateur s'il reste des textes, classes, armes, sorts ou autres éléments de contenu à ajouter

**Given** ce rappel
**When** il est fait
**Then** c'est une seule fois, en fin de palier — pas répété à chaque story, et sans aucune mécanique de code ni test automatisé associé (cohérent avec la convention SSE déjà établie, Palier 7 FR-15)
