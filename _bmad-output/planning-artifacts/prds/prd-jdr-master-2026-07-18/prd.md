---
title: 'PRD — Palier 6 : Dette technique accumulée'
status: final
created: '2026-07-18'
updated: '2026-07-18'
---

# PRD: Palier 6 — Dette technique accumulée

## 0. Document Purpose

Ce PRD cadre le Palier 6 : une passe dédiée sur la dette technique accumulée au fil des Paliers 1 à 5, référencée item par item dans `_bmad-output/implementation-artifacts/deferred-work.md` et pré-triée par thème dans `docs/backlog.md` (section Palier 6). Contrairement aux paliers précédents, ce palier n'introduit aucune nouvelle capacité produit visible — il durcit, nettoie et complète des fonctionnalités déjà livrées. Le **quoi** (comportements attendus, testables) vit ici ; le **comment** technique précis (algorithme de hachage, mécanisme de garde exact) est laissé à l'architecture/aux stories, sauf quand un choix impacte directement le comportement observable.

Périmètre confirmé avec l'utilisateur (2026-07-18) : 5 epics, ordre d'implémentation libre (aucune dépendance croisée), critère de fin **exhaustif** — chaque item actuellement listé dans les thèmes ci-dessous doit être traité avant de considérer le palier terminé (pas de re-report accepté, à la différence de la pratique habituelle du projet).

## 1. Vision

Le projet a livré 5 paliers en avançant vite, avec une revue de code adversariale systématique à chaque story — un mécanisme qui produit délibérément plus d'items différés qu'il n'en corrige sur le coup (pour ne pas ralentir chaque story individuelle). Ce palier est le moment de vider ce panier avant d'attaquer la synchronisation temps quasi-réel (Palier 7) et la refonte de contenu (Palier 8), qui vont tous deux retoucher une partie des mêmes fichiers — autant partir d'une base propre.

## 2. Target User

Pas de nouveau persona — ce palier sert les utilisateurs déjà en place (MJ et joueurs de parties Ryuutama) de deux façons :
- **Fiabilité perçue** : moins de « rien ne se passe » après un clic, moins d'états visuellement obsolètes après une action d'un autre membre.
- **Confiance** : posture de sécurité renforcée sur l'authentification et les fichiers uploadés, avant l'ouverture éventuelle à plus d'utilisateurs (Palier 9, durcissement multi-MJ) et la mise en production (Palier 11).

## 3. Glossary

- **Garde anti-double-clic** — Mécanisme empêchant qu'un second clic sur un même bouton, pendant qu'une requête est déjà en vol, déclenche un second appel réseau concurrent.
- **Staleness** — État affiché à l'écran qui ne reflète plus l'état réel côté serveur, parce que la page n'a pas été rechargée après un changement fait ailleurs (autre onglet, autre utilisateur).
- **TOCTOU** (*Time-Of-Check to Time-Of-Use*) — Classe de race condition où une vérification et l'action qui en dépend ne sont pas atomiques.

## 4. Features

### 4.1 Nettoyage synchronisation & anti-double-clic UI

**Description :** Les composants scénario/séance (`ScenarioEditor`, `ScenarioReadDialog`, `ScenarioTimeline`, `SeanceList`) partagent plusieurs lacunes récurrentes identifiées en revue de code depuis l'Epic 7 : pas de garde contre un double-clic sur les actions de mutation, pas de réinitialisation des messages d'erreur quand l'état sous-jacent change ailleurs, pas d'indicateur de chargement sur certains parcours.

**Functional Requirements:**

#### FR-1: Garde anti-double-clic sur les actions de mutation scénario

Un clic sur un CTA de mutation (Marquer Courant, Clôturer le scénario, Participer à cette enquête, et tout CTA équivalent découvert dans le même groupe de composants) ne doit jamais pouvoir déclencher un second appel réseau concurrent tant que le premier est en cours.

**Consequences (testable):**
- Un double-clic rapide sur un même CTA ne produit qu'un seul appel réseau.
- Le CTA reflète visuellement son état "en cours" (désactivé ou équivalent) pendant l'appel.

#### FR-2: Réinitialisation des messages d'erreur obsolètes

Un message d'erreur affiché après l'échec d'une action de mutation (`markCourantError`, `closeError`, `participantError`, erreur d'édition de champ narratif, et équivalents) ne doit pas rester affiché indéfiniment si l'état sous-jacent est rechargé/changé par ailleurs.

**Consequences (testable):**
- Un rechargement externe du scénario (ex. signal `changed`, remontage du composant) efface tout message d'erreur périmé.

#### FR-3: Fraîcheur des listes affichées

Les listes de scénarios (`ScenarioTimeline`) et les composants qui en dépendent reflètent l'état réel côté serveur sans dépendre uniquement d'un remontage complet du composant.

**Consequences (testable):**
- `ScenarioTimeline` se recharge si l'identifiant de Partie change sans que le composant soit détruit/recréé.
- `ScenarioEditor` n'affiche jamais un échec silencieux du chargement des personnages participants (`catch {}` vide) sans au moins un signal d'erreur cohérent avec le reste du composant.
- Le chargement de `ScenarioTimeline` (`loadScenarios()`) ne tente jamais d'écrire dans un signal d'un composant déjà démonté si la requête réseau se résout après la destruction du composant.

#### FR-4: Indicateur de chargement sur l'accès direct à un scénario

L'accès direct par URL ou le rechargement (F5) d'une fiche scénario affiche un indicateur pendant la résolution du fallback réseau, plutôt qu'une page vide sans feedback.

**Consequences (testable):**
- Entre le déclenchement du chargement et la résolution des données, un état de chargement visible est présent.

#### FR-5: Cohérence des brouillons de champ pendant une édition concurrente

Un champ en cours de saisie (ex. `descriptionDraft`) ne doit pas diverger silencieusement d'un rechargement externe du scénario pendant que l'utilisateur tape.

**Décidé avec l'utilisateur (2026-07-18) :** la saisie en cours est conservée par défaut lors d'un rechargement externe — sauf si ce champ précis a été modifié côté serveur entre-temps (autre onglet/utilisateur), auquel cas la valeur serveur est reprise pour ce champ.

**Consequences (testable):**
- Un rechargement externe qui ne touche pas le champ en cours de saisie n'efface jamais ce que l'utilisateur est en train de taper.
- Un rechargement externe qui modifie précisément la valeur serveur du champ en cours de saisie remplace le brouillon local par la nouvelle valeur serveur.

**Out of Scope:**
- Le signal `_changed` (`ScenariosService`) reste non scopé par Partie/scénario — l'item est reclassé perf (cf. §4.5 FR-19), pas un défaut de synchronisation fonctionnelle.

### 4.2 Fusion du système d'inventaire équipement & alignement sur la fiche PDF

**Description :** L'inventaire d'un personnage Ryuutama est aujourd'hui scindé en deux structures distinctes et incohérentes dans l'UI : `equipment.individual` (liste structurée `InventoryItem[]`, nom + poids) et `equipment.group` (simple texte libre, sans poids). Ce palier les unifie en un seul système d'inventaire structuré, et en profite pour aligner le modèle de données sur la vraie structure de la fiche PDF officielle (`Ryuutama-fiche_equipement_edit.pdf`, Story 11.1) — qui distingue déjà objets/contenants/animaux et porte des colonnes prix/effet actuellement non exploitées (`Prix`/`Effets` volontairement laissés vides à l'export, cf. Dev Notes Story 11.1).

**Functional Requirements:**

#### FR-6: Système d'inventaire général unifié, avec prix et effet facultatifs

Un personnage n'a plus qu'une seule liste d'objets d'inventaire général, chacun avec un nom, un poids, un prix facultatif et un effet facultatif — au lieu d'un bloc « Équipement de groupe » texte libre séparé d'un bloc « Inventaire » structuré sans prix/effet.

**Consequences (testable):**
- Un personnage existant migré conserve tous ses objets ; les entrées `individual` gardent leur poids existant, les entrées `group` (historiquement sans poids) reçoivent un poids par défaut de **0** ; prix et effet démarrent vides pour tous les objets migrés (champs inexistants avant ce palier).
- Prix et effet sont tous deux facultatifs — un objet reste valide sans l'un ou l'autre.
- L'UI propriétaire et l'UI MJ exposent toutes deux le système unifié, sans distinction visuelle "groupe vs individuel" héritée de l'ancien modèle.

#### FR-7: Section Contenants

Un personnage dispose d'une section « Contenants » distincte de l'inventaire général, chaque contenant portant un nom, un prix facultatif, un poids et un effet facultatif.

**Consequences (testable):**
- Un contenant est structurellement distinct d'un objet d'inventaire général (catégorie séparée, jamais mélangée).
- Poids obligatoire (cohérent avec l'objectif d'encombrement total), prix/effet facultatifs.

#### FR-8: Section Animaux

Un personnage dispose d'une section « Animaux » distincte, chaque animal portant un nom, un prix facultatif et un effet facultatif — **sans poids** (un animal ne compte pas dans l'encombrement porté, cohérent avec la fiche PDF officielle qui n'a pas de colonne encombrement pour ce bloc).

**Consequences (testable):**
- Un animal n'a jamais de champ poids/encombrement dans le modèle ni dans l'UI.

#### FR-9: Export PDF équipement aligné sur le modèle enrichi

L'export PDF équipement (`mapEquipmentToPdfFields`, Story 11.1) mappe désormais les colonnes `Prix`/`Effets` de l'inventaire général, et remplit les blocs « Contenant » et « Animal » du template — tous les trois actuellement laissés vides faute de données correspondantes dans le modèle.

**Consequences (testable):**
- Un objet d'inventaire général avec un prix/effet renseigné les voit apparaître dans le PDF exporté, plus laissés vides par défaut.
- Les contenants et animaux du personnage apparaissent dans leurs blocs dédiés du PDF, dans la limite physique du template (3 lignes contenant, 3 lignes animal — au-delà, troncature silencieuse sans erreur, même convention que la troncature déjà en place à 21 objets d'inventaire général, Story 11.1).
- Aucune régression sur le mapping déjà existant des 21 emplacements d'inventaire général (Blocs A/B du template).

**Out of Scope:**
- Aucun catalogue d'équipement partagé/campagne — reste un inventaire individuel par personnage (cohérent avec le Non-Goal déjà acté au Palier 5).
- Aucune limite artificielle du nombre de contenants/animaux saisissables dans l'app elle-même — seule l'exportation PDF tronque silencieusement au-delà de la capacité physique du template (FR-9).

### 4.3 Durcissement sécurité — authentification & réinitialisation de mot de passe

**Description :** Le flux « mot de passe oublié » (Palier 4, Story 5.4) a été livré avec plusieurs limitations de sécurité explicitement différées faute de nécessité immédiate. Avant l'ouverture à plus d'utilisateurs et la mise en production (Paliers 9-11), ce palier les referme.

**Functional Requirements:**

#### FR-10: Protection du token de réinitialisation au repos

Un token de réinitialisation de mot de passe n'est jamais récupérable en clair depuis une lecture de la base de données.

**Consequences (testable):**
- La valeur stockée en base pour un token de reset ne permet pas de reconstituer le token original sans le posséder déjà (mécanisme exact — hachage — laissé à l'architecture, cohérent avec `argon2` déjà utilisé pour les mots de passe).

#### FR-11: Invalidation des sessions actives lors d'un reset réussi

Un changement de mot de passe réussi via le flux de réinitialisation invalide les sessions actives existantes du compte.

**Consequences (testable):**
- Après un reset réussi, une session ouverte avant le reset (y compris potentiellement par un tiers non autorisé) n'est plus valide.

#### FR-12: Confirmation par e-mail après changement de mot de passe

Un e-mail de confirmation est envoyé au titulaire du compte après un changement de mot de passe réussi (via reset).

**Consequences (testable):**
- L'e-mail est envoyé de façon best-effort (cohérent avec le reste de l'infra e-mail du projet — un échec d'envoi ne bloque jamais le reset lui-même).

#### FR-13: Limitation de débit par e-mail sur le flux de reset

En complément du rate-limit par IP déjà en place, une limitation de débit s'applique aussi par adresse e-mail ciblée sur `/auth/forgot-password`.

**Consequences (testable):**
- Des tentatives répétées de reset visant la même adresse e-mail, depuis des IP différentes, sont elles aussi limitées.

#### FR-14: Purge des tokens de réinitialisation expirés

Les tokens de réinitialisation expirés ne s'accumulent pas indéfiniment en base.

**Consequences (testable):**
- Un mécanisme (job planifié ou nettoyage opportuniste) retire les tokens expirés — fréquence/déclencheur laissés à l'architecture.

**Out of Scope (risques déjà évalués et explicitement non repris dans ce palier) :**
- Canal de timing sur `requestPasswordReset` (travail additionnel visible uniquement sur la branche "utilisateur trouvé") — déjà accepté en Dev Notes de la Story 5.4, pas de NFR de temps de réponse constant requis en contexte hobby.
- Normalisation de casse dans la recherche par e-mail — comportement déjà cohérent avec le reste de l'application (register/login), changement systémique hors périmètre d'un palier de reset.

### 4.4 Durcissement sécurité — fichiers & uploads

**Description :** Les mécanismes de détection de type de fichier (documents de scénario, portraits) reposent sur des heuristiques légères, suffisantes en contexte hobby mais contournables par un utilisateur malveillant.

**Functional Requirements:**

#### FR-15: Détection de type de fichier renforcée pour les documents de scénario

La validation des documents uploadés (PDF/texte) résiste mieux à un fichier délibérément malformé/polyglotte que la simple vérification de signature magique actuelle.

**Consequences (testable):**
- Un fichier construit pour passer la détection actuelle sans être un PDF/texte valide est plus difficile à faire accepter (le niveau de rigueur exact — validation structurelle complète vs. renforcement ciblé — est laissé à l'architecture, proportionné au risque réel en contexte hobby).

#### FR-16: Nettoyage des métadonnées EXIF des portraits uploadés

Un portrait de personnage uploadé ne conserve pas ses métadonnées EXIF (position GPS notamment) une fois stocké par l'application.

**Consequences (testable):**
- Un portrait uploadé avec des métadonnées EXIF (GPS ou autre) n'en conserve aucune trace récupérable après upload.

**Out of Scope:**
- Le choix de la dépendance de traitement d'image (`sharp` pressenti) est un détail d'implémentation, pas un FR.

#### FR-17: En-tête de sécurité sur les téléchargements de documents

Les réponses de téléchargement de documents de scénario incluent l'en-tête `X-Content-Type-Options: nosniff`.

**Consequences (testable):**
- L'en-tête est présent sur la réponse HTTP de `GET /documents/:id` (et toute route équivalente de téléchargement de fichier utilisateur).

### 4.5 Robustesse mineure & performance

**Description :** Items de robustesse identifiés en revue de code, individuellement mineurs, sans urgence au volume actuel du projet mais qui méritent d'être traités en une seule passe plutôt que dispersés story par story.

**Functional Requirements:**

#### FR-18: Pagination des listes non bornées

Les endpoints qui renvoient une liste potentiellement longue sans plafond (historique de distributions XP, liste complète des scénarios d'une Partie) supportent une forme de pagination ou de limite explicite.

**Consequences (testable):**
- `GET /parties/:id/xp-distributions` et `GET /parties/:id/scenarios` (ou équivalents) n'imposent plus de charger l'intégralité de l'historique en une seule réponse non bornée.

#### FR-19: Portée du signal de changement scénario

Le signal `ScenariosService._changed` (frontend) est scopé par Partie plutôt que global à toute l'application.

**Consequences (testable):**
- Une mutation sur une Partie ne déclenche plus de rechargement complet des composants `ScenarioTimeline` ouverts sur une Partie différente.

#### FR-20: Ordre déterministe des inscriptions affichées

La liste des inscrits à une séance épisodique (`Seance.inscriptions`) est renvoyée dans un ordre déterministe (ex. par date d'inscription).

**Consequences (testable):**
- Deux chargements successifs de la même séance renvoient les inscrits dans le même ordre.

#### FR-21: Garde de statut sur les mutations de séance

Les méthodes de mutation de `Seance` qui n'ont actuellement aucune vérification du statut du scénario parent (`setSeanceCapacity`, `inscrire`, `desinscrire`, `validerDate`, `addSeance`) gagnent une garde cohérente — comportement exact (rejet vs. autorisation documentée) à trancher en story, au cas par cas.

**Consequences (testable):**
- Le comportement de chaque méthode vis-à-vis d'un scénario `BROUILLON`/`PASSE` est explicitement décidé et testé, plutôt qu'un défaut non intentionnel.

#### FR-22: Idempotence des endpoints de mutation sensibles à un double envoi

Les endpoints `POST` dont un double-clic résiduel produirait un effet de bord dupliqué (ex. `POST /parties/:id/xp-distributions`) sont couverts par la garde anti-double-clic déjà posée en FR-1.

**Consequences (testable):**
- Un double-clic rapide sur le CTA déclenchant l'appel ne produit pas deux effets de bord distincts en base.

**Out of Scope:**
- Un vrai retry réseau (hors double-clic, ex. reprise automatique après coupure) reste un risque accepté, cohérent avec les autres non-atomicités déjà acceptées dans ce projet — pas d'idempotence serveur dédiée (clé d'idempotence, contrainte unique) dans ce palier.

#### FR-23: Gestion défensive des références orphelines

Les méthodes de `ScenariosService` qui résolvent actuellement une relation (`scenario`, etc.) via `findUniqueOrThrow` sans gestion d'erreur dédiée ne laissent pas fuiter une erreur `500` non contrôlée si la clé étrangère se révèle orpheline.

**Consequences (testable):**
- Une FK orpheline (cas normalement impossible en usage courant, mais non gardé aujourd'hui) produit une erreur explicite plutôt qu'un `500` brut.

#### FR-24: Index de dédoublonnage des liens d'invitation

La requête de dédoublonnage des invitations par e-mail (`InviteLinksService.findOrCreateForEmail`) s'appuie sur un index DB `(partieId, targetEmail)`.

**Consequences (testable):**
- L'index existe en base après migration ; la requête de dédoublonnage n'effectue plus un scan complet de la table.

**Out of Scope:**
- La dette de type-safety généralisée (`toDto()` typé `any` dans plusieurs services) reste explicitement hors périmètre de ce palier — traitée au fil de l'eau en touchant les fichiers concernés, pas de story dédiée (décision actée le 2026-07-18).

## 5. Non-Goals (Explicit)

- Aucune nouvelle capacité produit visible par l'utilisateur final — ce palier est un durcissement, pas une feature.
- Aucun changement de comportement fonctionnel des scénarios/séances/inscriptions au-delà de ce qui est listé en §4.1/§4.5 — pas de nouvelle règle métier.
- La dette de type-safety généralisée (`any` sur `toDto()`) — cf. §4.5 Out of Scope.
- Le canal de timing sur `requestPasswordReset` et la normalisation de casse e-mail — cf. §4.3 Out of Scope, risques déjà explicitement acceptés.
- Les races conditions (TOCTOU) mineures déjà classées "risque accepté" (création concurrente de poll, invite-links, transition `BROUILLON→A_VENIR`, `verifyScenarioBelongsToPartie`) — décision définitive actée le 2026-07-18, ne seront pas retraitées dans ce palier ni ailleurs.
- Toute synchronisation temps quasi-réel entre client et serveur — objet du Palier 7 (SSE), pas de ce palier.
- Tout ajout de contenu Ryuutama (classes/textes manquants) — objet du Palier 8, pas de ce palier.

## 6. MVP Scope

### 6.1 In Scope
- FR-1 à FR-24 (5 epics : nettoyage sync/anti-double-clic, fusion inventaire équipement + alignement PDF, sécurité auth/reset, sécurité fichiers/uploads, robustesse mineure/perf).

### 6.2 Out of Scope for MVP
- Tout ce qui figure en §5 Non-Goals.
- `[NOTE FOR PM]` Le critère de fin de ce palier est exhaustif (décision explicite du 2026-07-18) — contrairement aux paliers précédents où un item mineur pouvait repartir en `deferred-work.md` sans bloquer la story. À l'implémentation, si un item s'avère significativement plus complexe que prévu, revenir vers l'utilisateur avant de le re-différer silencieusement.

## 7. Success Metrics

Contexte hobby — pas de métriques quantitatives formelles.

- **Succès** : `deferred-work.md` ne contient plus aucun item actif relevant des 5 thèmes de ce palier une fois terminé (au-delà des exclusions explicites de §5).
- **Contre-mesure** : ne pas transformer ce palier en refactor général — un item hors des 5 thèmes définis, même repéré en cours de route, reste noté pour un futur palier plutôt que traité ici (éviter le scope creep sur un palier déjà volontairement large).

## 8. Open Questions

1. **FR-21 (garde de statut séance)** : pour chaque méthode concernée, le bon comportement est-il un rejet strict ou une simple documentation du comportement actuel (permissif) ? Décision explicitement laissée ouverte (2026-07-18) — à évaluer méthode par méthode à l'implémentation, pas théoriquement ici.

## 9. Assumptions Index

- [ASSUMPTION §4.3 FR-10] Le mécanisme de protection du token de reset réutilise `argon2`, déjà en place pour les mots de passe du projet, plutôt qu'un nouvel algorithme — cohérence avec l'existant, à confirmer en architecture.
- [ASSUMPTION §4.4 FR-16] Le nettoyage EXIF passe par une nouvelle dépendance (`sharp`, déjà pressentie dans `deferred-work.md`) — pas d'implémentation manuelle du parsing EXIF.
- [ASSUMPTION §4.2 FR-6/7/8] La migration Prisma des personnages existants (`equipment.group`/`individual` → modèle unifié + sections Contenants/Animaux vides) se fait automatiquement au déploiement, sans action manuelle demandée aux utilisateurs.
