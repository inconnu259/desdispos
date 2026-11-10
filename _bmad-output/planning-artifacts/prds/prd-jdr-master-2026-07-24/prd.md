---
title: 'Palier 8 — Refonte complète des classes et textes Ryuutama'
status: final
created: '2026-07-24'
updated: '2026-07-24'
---

# PRD: Palier 8 — Refonte complète des classes et textes Ryuutama

## 0. Document Purpose

Ce PRD cadre le Palier 8 : combler l'écart entre le contenu Ryuutama actuellement seedé en base (construit au minimum nécessaire, palier après palier, depuis l'Épic 4) et le contenu réel du *Guide du Voyageur*. Ce n'est pas un simple ajout de texte — plusieurs mécaniques de jeu actuellement absentes ou mal modélisées en dépendent (détaillées en §1 Vision).

**Contrainte permanente du projet (NFR4, révisée le 2026-09-25) :** le contenu Ryuutama est versionné dans le dépôt, ses textes étant reformulés à partir du livre (mécaniques conservées, formulation propre au projet — décision utilisateur ; avant cette date : gitignoré pour droits d'auteur), et seedé depuis des fichiers JSON (`apps/api/game-systems/ryuutama/data/*.json`) au démarrage de l'API (`GameSystemService.onApplicationBootstrap()`), jamais codé en dur, jamais lu directement par le frontend (qui passe par `GET /game-systems/:id/content`). Ce palier respecte et étend ce pattern, ne le change pas.

**Mode opératoire propre à ce palier :** l'utilisateur possède le livre physique et dicte le contenu officiel (valeurs, textes, listes) story par story pendant l'implémentation — ce PRD documente la **forme** attendue des données et les mécaniques qui en dépendent, jamais le texte lui-même. Aucun contenu de règles n'est inventé ou deviné par l'agent.

## 1. Vision

Le contenu Ryuutama seedé en base a été construit palier après palier, au minimum nécessaire pour débloquer chaque fonctionnalité (Épic 4 : classes/types/armes bruts, sans texte narratif ; Épic 10 : Homme Dragon, seul contenu déjà enrichi de descriptions). Ce palier comble cet écart : compléter les classes manquantes, donner à chaque élément (classe, type, arme, talent, sort, rôle...) le texte du *Guide du Voyageur* qui lui correspond, et ajouter les mécaniques encore absentes que ce texte réclame — profils d'attributs, restructuration du choix d'arme, achat d'équipement de départ, système de magie, rôles de groupe. Le joueur doit pouvoir construire un personnage qui reflète vraiment les règles du livre, pas une version simplifiée codée au fil des paliers précédents.

## 2. Target User

Pas de nouveau persona — sert directement les utilisateurs déjà en place (MJ et joueurs Ryuutama) : un contenu de jeu plus fidèle et plus complet, moins de règles absentes ou mal transcrites.

## 3. Glossary

- **`ContentType`/`ContentEntry`** — mécanisme Prisma existant (scope `BASE`) qui porte tout le contenu Ryuutama seedé. Ce palier ajoute de nouveaux `ContentType` (sort, rôle, objet achetable...) et enrichit des `ContentEntry` existantes, sans changer le mécanisme.
- **Profil d'attributs (`attribute-patterns.json`)** — répartition des 4 attributs (AGI/ESP/INT/VIG) proposée au joueur à la création. Un seul existe aujourd'hui (« Polyvalent »). Ce palier en ajoute deux : Équilibré, Spécialiste.
- **Catégorie d'arme vs arme précise** — aujourd'hui le joueur choisit directement une catégorie (`arc`, `epee-courte`...) comme arme favorite. Ce palier introduit un niveau intermédiaire : le joueur choisit une arme précise (ex. dague, arbalète), qui appartient à une catégorie (laquelle porte les formules de touche/dégâts/encombrement).
- **Mode pique-nique** — équipement de départ actuel : une liste figée (`FIXED_EQUIPMENT`, `equipment-step.ts`) auto-assignée sans aucun choix du joueur.
- **Budget de départ** — nouvelle mécanique : 1000 Po que le joueur peut dépenser librement dans une liste d'objets achetables figée en fichier, en alternative au mode pique-nique.
- **Rôle de groupe** — un des 4 rôles (cartographe, chef, chroniqueur, intendant) qu'un MJ assigne à un personnage de sa Partie ; nouveau concept, aucun équivalent actuel dans le modèle.

## 4. Features

### 4.1 Contenu textuel enrichi (classes, types, armes, talents, assistant)

**Description :** Aujourd'hui, seuls les artefacts Homme Dragon et les pouvoirs d'éveil (Épic 10) portent un champ `description` narratif. Classes, types et catégories d'armes (contenu de l'Épic 4) n'en ont aucun — ni au niveau de l'entrée elle-même, ni au niveau de leurs sous-éléments (avantages d'un Type, talents d'une Classe). Les étapes de l'assistant de création/évolution de personnage n'ont elles-mêmes aucun texte explicatif propre.

**Functional Requirements:**

#### FR-1: Description sur chaque entrée de contenu de premier niveau

Chaque classe, chaque type et chaque catégorie d'arme porte un champ `description` (texte narratif/règles), au même niveau de détail que `homme-dragon-artefacts.json`/`eveil-powers.json`.

**Consequences (testable):**
- Aucune classe/type/catégorie d'arme seedée n'a de champ `description` vide ou manquant.
- `ClassStep`, `TypeStep` et `WeaponStep` (assistant de création) affichent ce texte là où l'item est présenté, pas seulement son libellé court — ces composants n'ont aujourd'hui aucun champ `description` prévu dans leur modèle de données interne, et sont donc étendus par cette story.

#### FR-2: Description sur les sous-éléments d'une entrée de contenu

Chaque sous-élément d'un type de contenu enrichi par FR-1 (un avantage de Type, un talent de Classe) porte aussi son propre champ `description`.

**Consequences (testable):**
- Un avantage de Type (ex. « Agilité ») et un talent de Classe affichent chacun leur texte propre, distinct du texte de l'entrée parente.

#### FR-3: Texte explicatif par étape de l'assistant

Chaque étape du wizard de création/évolution de personnage (classe, type, attributs, arme, équipement...) affiche un texte d'introduction propre à l'étape, expliquant ce que ce choix signifie dans les règles — indépendant des descriptions des items choisis dans l'étape (FR-1/FR-2).

**Consequences (testable):**
- Une étape du wizard affiche son texte d'introduction même avant toute sélection de l'utilisateur dans cette étape.

---

### 4.2 Classes complètes

**Description :** Le catalogue actuel de 7 classes (`classes.json`) est incomplet par rapport au *Guide du Voyageur*, et chaque classe manque de plusieurs informations que le livre fournit : une liste d'occupations, une liste d'actions, et des talents dont l'effet n'est aujourd'hui qu'une courte chaîne de texte.

**Functional Requirements:**

#### FR-4: Classes manquantes ajoutées

Le catalogue de classes est complété avec les classes du *Guide du Voyageur* absentes aujourd'hui.

**Consequences (testable):**
- Le nombre de classes seedées correspond au nombre de classes réelles du livre (liste exacte fournie par l'utilisateur pendant l'implémentation — `[ASSUMPTION]` ci-dessous).

#### FR-5: Occupations et actions par classe

Chaque classe porte une liste d'occupations et une liste d'actions — texte de référence pur, affiché au joueur comme pistes de jeu/idées de métier. Aucune validation ni mécanique de jeu dessus.

**Consequences (testable):**
- Les deux listes s'affichent sur la classe (assistant de création et/ou fiche) sans qu'aucune sélection ou saisie ne soit requise ou possible dessus.

#### FR-6: Talents enrichis (effet structuré)

Chaque talent d'une classe (toujours exactement 3 par classe) porte : un nom (existant), une description propre du talent, et un effet structuré composé d'une description de l'effet, de ses conditions d'application, des attributs concernés (existant) et d'une difficulté (existant).

**Consequences (testable):**
- Les tests existants de validation des talents (attributs/difficulté) restent valides face à la nouvelle forme, sans modification — seuls les champs description/effet sont additifs, le chemin de lecture attributs/difficulté ne change pas.
- Le talent affiche son propre texte, distinct du texte de description de l'effet.

---

### 4.3 Attributs — profils multiples

**Description :** `attribute-patterns.json` n'a aujourd'hui qu'un seul profil (« Polyvalent », `[8,4,6,6]`) — tous les personnages du jeu sont donc de fait construits sur le même multi-ensemble de valeurs, quel que soit l'ordre choisi. Le livre propose 3 profils distincts : Équilibré, Polyvalent, Spécialiste.

**Functional Requirements:**

#### FR-7: Trois profils d'attributs disponibles

Le catalogue de profils d'attributs passe de 1 à 3 entrées : Équilibré, Polyvalent (existant, valeurs à reconfirmer), Spécialiste (valeurs exactes fournies par l'utilisateur pendant l'implémentation — `[ASSUMPTION]` ci-dessous).

**Consequences (testable):**
- `validate()` accepte les 3 profils comme valides (`attributePatterns` du catalogue).
- L'assistant de création propose un vrai choix entre 3 répartitions distinctes de valeurs — pas 3 permutations d'un même multi-ensemble, contrairement à l'état actuel.

---

### 4.4 Refonte du choix d'arme

**Description :** Le modèle actuel fait choisir au joueur directement une *catégorie* d'arme (`arc`, `epee-courte`...) comme arme favorite — erreur de conception identifiée par l'utilisateur. Dans les règles réelles, le joueur choisit une arme précise (dague, arbalète...) qui appartient à une catégorie ; c'est la catégorie qui porte les formules de touche/dégâts/encombrement.

**Functional Requirements:**

#### FR-8: Choix d'une arme précise rattachée à une catégorie

Le joueur choisit une arme précise dans une liste, chaque arme étant rattachée à une catégorie. La catégorie continue de porter les formules de touche/dégâts/encombrement (comme aujourd'hui) et gagne une description + sa propre liste (non-exhaustive) d'armes types (`[ASSUMPTION]` ci-dessous sur la liste de catégories retenue).

**Consequences (testable):**
- Le calcul des formules de touche/dégâts d'un personnage dépend de la catégorie de l'arme choisie, jamais de l'arme elle-même directement.
- Chaque catégorie affiche sa description et au moins une arme type dans sa liste.

#### FR-9: Création d'une arme libre

Le joueur peut créer une arme ne figurant pas dans la liste, en la rattachant manuellement à une des catégories existantes (pour en hériter les formules).

**Consequences (testable):**
- Une arme créée librement produit les mêmes formules de touche/dégâts qu'une arme prédéfinie de la même catégorie.

**Out of Scope:**
- Migration automatique des personnages existants (dont `weaponCategoryId` référence aujourd'hui directement une catégorie) — aucune migration écrite ; le seed de test (`seed-demo.ts`) est simplement mis à jour pour refléter le nouveau modèle (cf. §5 Non-Goals — pas de mise en production à ce jour).

---

### 4.5 Équipement de départ

**Description :** L'étape équipement de l'assistant assigne aujourd'hui automatiquement une liste figée (« mode pique-nique », `FIXED_EQUIPMENT`) sans aucun choix du joueur. Le livre permet aussi un achat libre avec un budget de départ.

**Functional Requirements:**

#### FR-10: Choix entre nécessaire pré-fait et achat libre

L'étape équipement de l'assistant propose un choix explicite entre (a) le nécessaire de voyage pré-fait (mode pique-nique existant, à compléter/enrichir avec le contenu réel du livre) et (b) un achat libre dans une liste figée d'objets achetables (nouveau `ContentType`, seedé en JSON — prix, poids, effet, description), avec un budget de départ de 1000 Po (`[ASSUMPTION]` ci-dessous sur la fixité de ce budget).

**Consequences (testable):**
- Un personnage créé via l'achat libre ne peut pas dépasser 1000 Po de dépense au total.
- Dans les deux cas (pique-nique ou achat), le résultat alimente le même modèle d'inventaire déjà en place (`equipment.individual`/`contenants`/`animaux`, Épic 14) — aucun nouveau modèle d'inventaire.

**Out of Scope:**
- Plusieurs listes d'objets/règles d'équipement du livre seront saisies avec leur description dans le contenu seedé (pour ne pas perdre le texte), mais une seule sera réellement câblée dans l'assistant ce palier — les autres attendent la refonte UI du Palier 9.

---

### 4.6 Système de magie

**Description :** Le type « Magie » existe (bonus PE + 3 avantages) mais aucune règle de magie ni liste de sorts n'existe nulle part dans le modèle actuel.

**Functional Requirements:**

#### FR-11: Catalogue de sorts et règles de magie

Un nouveau `ContentType` porte les règles de magie et la liste des sorts du *Guide du Voyageur*, avec le même niveau de détail (description/effet) que les autres types de contenu enrichis par ce palier.

**Consequences (testable):**
- Chaque sort seedé a au minimum un nom et une description/effet non vide.

**Note :** le mécanisme exact d'apprentissage/lancement d'un sort par un personnage (limité par PE, restrictions par classe/type...) n'est pas encore spécifié à ce stade — cf. Open Question 2. Ce PRD acte le besoin d'un catalogue de sorts complet (`[ASSUMPTION]` ci-dessous) ; la mécanique de jeu qui l'exploite sera précisée avec l'utilisateur au moment de la story correspondante.

---

### 4.7 Rôles de groupe

**Description :** 4 rôles clés du livre (cartographe, chef, chroniqueur, intendant) n'existent pas du tout dans le modèle actuel. Décidé avec l'utilisateur : ce n'est pas le joueur qui choisit son rôle (ambiguïté initiale résolue) — c'est le MJ qui l'assigne, typiquement après une discussion de groupe en début de partie.

**Functional Requirements:**

#### FR-12: Catalogue des 4 rôles

Un nouveau `ContentType` porte exactement les 4 rôles (cartographe, chef, chroniqueur, intendant), chacun avec une description — jamais plus de 4, jamais moins.

**Consequences (testable):**
- Le catalogue de rôles contient exactement 4 entrées.

#### FR-13: Assignation d'un rôle par le MJ

Le MJ peut assigner un rôle à un personnage de sa Partie. Le joueur ne choisit jamais son propre rôle ; aucun mécanisme de vote.

**Consequences (testable):**
- Seul le MJ de la Partie peut assigner/modifier un rôle sur un personnage de cette Partie.
- Un rôle donné n'a jamais plus d'un titulaire à la fois dans une même Partie.

#### FR-14: Affichage du rôle assigné (badge)

Le rôle assigné à un personnage est visible via un badge sur son avatar, dans le même emplacement que le badge de montée de niveau existant (`RosterRow.hasPendingLevelUp`, `roster-row.util.ts`). Le badge de rôle est masqué tant qu'une montée de niveau est en attente sur ce personnage (priorité au badge de montée de niveau).

**Consequences (testable):**
- Un personnage avec un rôle assigné ET une montée de niveau en attente n'affiche que le badge de montée de niveau, jamais les deux superposés.
- Dès que la montée de niveau est traitée, le badge de rôle redevient visible (si un rôle est toujours assigné).

---

### 4.8 Vérification finale de complétude

**Description :** Le contenu de ce palier est dicté au fil de l'eau par l'utilisateur (cf. §0), story par story. Rien ne garantit qu'après FR-1 à FR-14, tout le texte/contenu pertinent du *Guide du Voyageur* aura été couvert — ce n'est pas une garde automatisée possible (contenu textuel, pas une règle de code), seulement un rappel humain à ne pas oublier en fin de palier.

**Functional Requirements:**

#### FR-15: Rappel de vérification de complétude en fin de palier

Une fois FR-1 à FR-14 implémentées, l'agent/le développeur redemande explicitement à l'utilisateur s'il reste des textes, classes, armes, sorts ou autres éléments de contenu à ajouter avant de considérer le palier terminé.

**Consequences (testable):**
- Le rappel est fait une seule fois, en fin de palier (dernière story ou juste après), pas répété à chaque story individuelle.
- Aucune mécanique de code ni test automatisé associé — une vérification humaine/agent documentée suffit (cohérent avec le contexte hobby et avec la convention déjà établie pour la vérification SSE, Palier 7 FR-15).

## 5. Non-Goals (Explicit)

- Aucune mécanique de sélection/vote du rôle par les joueurs eux-mêmes — assignation MJ uniquement (décidé).
- Aucune migration automatique des personnages existants pour la refonte du choix d'arme (FR-8/FR-9) — le projet n'est pas en production ; seul `seed-demo.ts` est mis à jour pour refléter le nouveau modèle.
- Aucune UI multi-listes pour l'équipement (FR-10) — une seule liste est câblée ce palier, les autres attendent le Palier 9 (refonte UI).
- Aucune mécanique de jeu sur les occupations/actions par classe (FR-5) — texte de référence uniquement.
- Aucune refonte visuelle générale de l'assistant de création ni de `ScenarioTimeline` (le défaut visuel déjà noté dans le backlog reste au Palier 9).

## 6. MVP Scope

### 6.1 In Scope
- FR-1 à FR-15 (contenu textuel enrichi, classes complètes, profils d'attributs, refonte du choix d'arme, équipement de départ, catalogue de sorts, rôles de groupe, rappel de complétude en fin de palier).

### 6.2 Out of Scope for MVP
- Tout ce qui figure en §5 Non-Goals.
- La mécanique exacte d'apprentissage/lancement de sort (FR-11) — catalogue de contenu seul dans ce palier, mécanique à préciser en story.

## 7. Success Metrics

Contexte hobby — pas de métriques quantitatives formelles.

- **Succès** : un joueur qui crée un personnage Ryuutama retrouve, à chaque étape, le texte et les choix réels du *Guide du Voyageur* (classes complètes, profils d'attributs distincts, arme précise, équipement au choix, sorts listés) — plus une version simplifiée codée au minimum.
- **Contre-mesure** : ne pas transformer ce palier en refonte UI générale (Palier 9) ni en moteur de règles de magie complet et jouable dès ce palier (FR-11 = contenu, pas mécanique) — rester sur la donnée et les mécaniques explicitement actées ci-dessus.

## 8. Open Questions

1. **Contenu exact** (classes manquantes précises, valeurs des 3 profils d'attributs, liste d'armes/catégories, liste de sorts, liste d'objets achetables) — fourni par l'utilisateur pendant l'implémentation, story par story. Non bloquant pour ce PRD (mode opératoire acté en §0).
2. **Mécanique de sorts (FR-11)** : comment un personnage apprend/choisit ses sorts, limite par PE, restrictions éventuelles par classe/type — à trancher avec l'utilisateur au moment de la story correspondante.
3. **Forme exacte des nouveaux champs Prisma/DTO** pour le choix d'arme (FR-8 : `weaponId` référençant une catégorie, vs. structure actuelle `weaponCategoryId`) — laissé à l'architecture/dev-story.
4. **Rôle de groupe (FR-13)** : un rôle assigné est-il réassignable/transférable librement par le MJ par la suite, ou fixé une fois posé ? Non précisé — à clarifier au moment de la story.

## 9. Assumptions Index

- [ASSUMPTION §4.2 FR-4] Le nombre exact de classes manquantes et leur contenu (talents, occupations, actions) sont inconnus à ce stade — l'utilisateur les fournira pendant l'implémentation.
- [ASSUMPTION §4.3 FR-7] Les valeurs numériques exactes des profils Équilibré et Spécialiste (et confirmation des valeurs de Polyvalent) sont inconnues à ce stade.
- [ASSUMPTION §4.4 FR-8] La liste des catégories d'armes reste celle déjà seedée (arc, épée courte, épée longue, hache, lance) sauf indication contraire de l'utilisateur — seule la liste d'armes précises par catégorie est nouvelle.
- [ASSUMPTION §4.5 FR-10] Le budget de départ (1000 Po) est fixe pour tout personnage, indépendant de la classe/du type choisi, sauf indication contraire.
- [ASSUMPTION §4.6 FR-11] Le catalogue de sorts est capturé ce palier même si sa mécanique d'usage (Open Question 2) n'est précisée qu'à la story correspondante — décision explicite de l'utilisateur (« dans ce palier, en entier »).
