---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/specs/spec-palier9-refonte-ui/SPEC.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260626/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/mockups/contrat-ui-calendrier.html'
lastUpdated: '2026-10-04'
lastChange: "2026-10-04 (sprint change) : épic 33 — story 33.8 prête à planifier (AD-23 faite) : critères d'acceptation réécrits, annotations 33.5 et 33.6 ; FR-59 amendée, D-22 (voir sprint-change-proposal-2026-10-04.md). Précédemment : 2026-10-02 (sprint change) : épic 33 — story 33.6 révisée : une seule réserve de souffles par Homme Dragon, portée par sa fiche (réserve par séance abandonnée), fiche et export PDF de l'Homme Dragon réservés au MJ ; FR-61, D-21, AD-22 (voir sprint-change-proposal-2026-10-02.md). Précédemment : 2026-09-29 (sprint change) : épic 33 — Q-13 corrigée (éveils ≠ souffles), stories 33.6, 33.7, 33.8 ; FR-61 → FR-63, D-21 (voir sprint-change-proposal-2026-09-26.md). Précédemment : 2026-09-20 (sprint change) : épic 29 rouvert — stories 29.15, 29.16, 29.17 ; story 33.5 ; FR-58 → FR-60 (voir sprint-change-proposal-2026-09-20.md). Précédemment : ajout de l'Epic 36 « Calendrier — lisibilité » (FR-49 → FR-57, D-15 → D-18) et de ses 14 stories, ordonnancé après l'épic 30. Ajout EN PLACE — les épics 1 à 35 sont intacts."
epic36StepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
---

# jdr-master — Palier 9 : Découpage en épics

## Overview

Ce document décompose en stories implémentables les exigences du Palier 9 — « Refonte UI & lisibilité de l'état ». Il s'appuie sur quatre contrats produits en amont : le SPEC (21 capacités), le PRD (49 exigences, 14 dérogations serveur), la spine d'architecture (21 décisions) et le contrat d'UX (`DESIGN.md` + `EXPERIENCE.md`), lui-même delta du design system de base du 26 juin.

## Requirements Inventory

### Functional Requirements

**§4.1 — Profil, compte & préférences**

- FR-1 : Écran de compte accessible depuis la navigation
- FR-2 : Thème persisté sur le compte, repli local avant connexion
- FR-3 : Préférences d'affichage mémorisées sur le compte (masquage des parties terminées, mode d'affichage, tri, couches du calendrier)
- FR-4 : Nom affiché modifiable, pseudo immuable
- FR-4b : Levée d'ambiguïté entre noms affichés identiques
- FR-5 : Modification de l'e-mail (double canal, retour arrière un mois)
- FR-6 : Changement de mot de passe en session

**§4.2 — Navigation & liste des parties**

- FR-7 : Suppression de la bascule globale MJ/Joueur
- FR-8 : Distinction visuelle du rôle par partie
- FR-9 : Visibilité de la création de partie, et actions par rôle
- FR-10 : Filtres et tris sur la liste des parties
- FR-11 : Parties favorites
- FR-12 : Signalétique d'état sur les cartes de partie
- FR-44 : Clôture explicite d'une partie par le MJ
- FR-45 : Modes d'affichage de la liste
- FR-47 : Identité visuelle d'une partie
- FR-48 : Navigation principale à quatre destinations
- FR-58 : Point d'entrée explicite de création d'un personnage — sur la partie, et dans « Personnages »
- FR-59 : Les Hommes Dragons des MJ figurent dans « Personnages », avec leur création
- FR-60 : Seuls les systèmes de jeu disposant d'un module peuvent être choisis pour une nouvelle partie
- FR-61 : Réserve de souffles de l'Homme Dragon, composée sur sa fiche (MJ seul)
- FR-62 : Capacités de niveau de l'Homme Dragon (artefact cadeau, souffles rituels)
- FR-63 : Un Homme Dragon pour plusieurs aventures (planifié)
- FR-13 : Notification éphémère d'annonce à la connexion

**§4.3 — Identité : joueur vs personnage**

- FR-14 : Convention unifiée joueur / personnage
- FR-15 : Affichage conjoint là où c'est utile
- FR-16 : Vue « mes personnages »
- FR-17 : Correction de la pastille de montée de niveau

**§4.4 — Fiche & création de personnage**

- FR-18 : Actions d'export regroupées
- FR-19 : Aide contextuelle sur les termes de jeu
- FR-20 : Textes descriptifs consultables sans quitter la fiche
- FR-21 : Refonte du parcours de création de personnage
- FR-22 : Consultation limitée des fiches des compagnons
- FR-23 : Cadenas de visibilité posés par le MJ

**§4.5 — Homme Dragon**

- FR-24 : Fiche Homme Dragon au niveau des fiches joueur
- FR-25 : Formulaire de création guidé
- FR-26 : Souffles communs et par race, seedés et affichés sur la fiche
- FR-27 : Export amélioré
- FR-61 : Réserve de souffles de l'Homme Dragon, composée sur sa fiche
- FR-62 : Capacités de niveau de l'Homme Dragon
- FR-63 : Un Homme Dragon pour plusieurs aventures

**§4.6 — Vue de partie, scénarios & chronologie**

- FR-28 : Réorganisation de la vue de partie
- FR-29 : Refonte de Scénario & Chronologie
- FR-30 : Autocomplétion des invitations sur le pseudo
- FR-31 : Place des fonctionnalités récentes dans les écrans refondus

**§4.7 — Calendrier & votes**

- FR-32 : Saisie des disponibilités repensée, écriture groupée
- FR-33 : Séances datées visibles dans les calendriers
- FR-34 : Options de vote affichées dans le calendrier
- FR-35 : Annulation d'une réponse de vote
- FR-36 : Vue semaine conservée et spécialisée en saisie de masse
- FR-46 : Couches d'affichage du calendrier

**§4.8 — Authentification & entrée**

- FR-37 : Suppression du lien « Créer un compte »
- FR-38 : Messages d'erreur véridiques à la connexion
- FR-39 : Afficher / masquer le mot de passe
- FR-40 : Mise en forme des écrans d'authentification

**§4.9 — Thèmes & textes**

- FR-41 : Revue complète des textes des trois thèmes
- FR-42 : Classement des textes non thématisés
- FR-43 : Réorganisation du stockage des thèmes, et renommage `medieval-steampunk` → `atelier-cuivre`

### NonFunctional Requirements

- NFR-1 : **Jamais la couleur seule.** Toute information encodée par la couleur porte un second signal — icône, libellé, ou traitement typographique. Corollaire : deux teintes pour un même état sous-jacent exigent deux libellés distincts.
- NFR-2 : **Accessibilité — vigilance, pas conformité.** Aucun seuil chiffré en critère d'acceptation, aucun audit rétroactif. Le plancher hérité devient une valeur de conception par défaut, non une recette.
- NFR-3 : **Desktop et mobile à parité** — au sens « aucune surface cassée sur l'un des deux », la cible d'optimisation se décidant surface par surface.
- NFR-4 : **États vides et messages d'erreur au cas par cas**, sur les écrans refondus. Un message d'erreur ne ment jamais sur la cause.
- NFR-5 : **Rien de silencieux côté serveur.** Quatorze dérogations recensées ; toute évolution découverte en cours d'implémentation est remontée avant d'être codée.
- NFR-6 : **Aucun appel réseau proportionnel au nombre de parties.** Ce motif a déjà causé deux incidents de production.
- NFR-7 : **Aucune donnée d'une partie tierce** ne remonte à qui n'en est pas membre, y compris via les calendriers.
- NFR-8 : **Un champ verrouillé ne transite jamais dans une réponse d'API**, exports PDF compris.
- NFR-9 : **`prefers-reduced-motion` coupe toutes les animations**, et aucune animation ne porte d'information — au repos, rien ne manque.
- NFR-10 : **Le pseudo est immuable** : c'est un identifiant de connexion.
- NFR-11 : **Aucun e-mail d'un autre utilisateur n'est exposé à un joueur** ; seul le MJ de la partie le voit.
- NFR-12 : **L'animation n'existe qu'en mode grande carte** — coût batterie et distraction sur une liste.

### Additional Requirements

**Contexte brownfield — aucun template de démarrage.** L'application existe et tourne (Angular 22, NestJS 11, Prisma 7, PostgreSQL 17). Aucune story d'amorçage de projet n'est requise ; toutes les stories modifient de l'existant.

**Modèle de données à faire évoluer** (spine `AD-1`, `AD-8`, `AD-16`, `AD-17`)

- `User` : `displayName` (NOT NULL, migration **et** `register()`), `theme` nullable, `hideFinishedParties`, `partiesViewMode`, `partiesSort`, `charactersViewMode`, `charactersSort`, `calendarLayersSetAt` nullable
- Nouveaux modèles : `PartieFavorite`, `AnnouncementRead`, `EmailChangeToken`, `UserCalendarLayer`
- `Partie` : `closedAt`, `sheetVisibility` (JSON, jamais dans `PartieDto`), `coverImageUrl`

**Contraintes de structure et de frontière**

- `AD-4` : `/me` est une convention de **routage**, pas une frontière de module. `AccountModule` porte l'état de compte seul ; les signaux vivent dans `PartiesModule`, le calendrier dans `AvailabilityModule` (`AD-18`), les personnages dans `CharacterModule`.
- `AD-15` : `PartiesService` projette explicitement vers `PartieDto` — jamais d'objet Prisma brut. `coverImageUrl` fait partie de la projection ; `sheetVisibility` n'y est jamais.
- `AD-3` : `GET /me/party-signals` renvoie une carte `partieId → PartySignalsDto`, avec une union fermée `PartySignalCode` déclarée dans `@master-jdr/shared`.

**Refactors imposés, non optionnels**

- `AD-7` : le filtrage de visibilité s'applique dans `toDto()`, dont la **signature change** — propagation à environ quatorze appels. `getSchema()` gagne une propriété `lockable`, distincte du `fields` existant. `derived` est filtré solidairement.
- `AD-11` : `ModeService` devient `MyPartiesService` — le compteur anti-course et le câblage SSE `user:{id}` sont **conservés à l'identique**.
- `AD-17` : extraction d'un utilitaire d'upload partagé. Le plafond de 5 Mo n'est **pas** extractible (décorateurs de contrôleur, à redéclarer). Consommateurs à mettre à jour : `ryuutama-pdf.service.ts` et le `jest.mock('./image-mime.util')` de `character.service.spec.ts`, qui devient silencieusement inopérant si le chemin change.
- `AD-4`/`AD-6` : extraction de `revokeSessions(userId, exceptSid?)` depuis `AuthService.resetPassword()`, aujourd'hui inlinée dans une transaction.
- `AD-13` : renommage `medieval-steampunk` → `atelier-cuivre`, **emportant la migration des valeurs persistées de `User.theme`**, indissociable de la story qui découpe les fichiers de thème.

**Contrats de forme à respecter**

- `AD-2` : tout DTO d'identité porte `pseudo` **et** `displayName`. Exception : le DTO de recherche ne porte que le pseudo.
- `AD-5` : changement d'e-mail par jetons `CONFIRM`/`REVERT` sur le pattern `PasswordResetToken` ; le retour arrière coupe toutes les sessions et force une réinitialisation.
- `AD-9` : l'indisponibilité dérivée d'une séance est injectée **avant** la séparation vue MJ / vue joueur ; le créneau vient de `SessionPoll.chosenSlot`, sinon `FULL_DAY`.
- `AD-10` : `DELETE /parties/:id/poll/:pollId/vote/:optionId` — le retrait porte sur une option, `PollVote` étant unique par `[optionId, userId]`.
- `AD-14` : toute mutation modifiant un signal émet `partie:{id}` **et** `user:{id}` pour chaque membre concerné ; le front n'écoute que le préfixe `user:`.
- `AD-16` : `layerKey` est une union fermée ; `calendarLayersSetAt` distingue « jamais configuré » de « tout éteint ».
- `AD-18` : charge utile indexée par couche, `{ [layerKey]: Entry[] }` — jamais une liste plate.
- `AD-19` : point de dérivation **unique** de la bannière ; la graine dérive du seul identifiant de partie.
- `AD-20` : les états dépendants du lecteur sont résolus côté client **sur les écrans qui détiennent la charge utile**. La liste des parties relève d'`AD-3`. Le filtrage anti-spoil frontend n'est **jamais** redondant : `findAllForPartie` ne filtre aucun statut.
- `AD-21` : la déclaration en masse est un appel unique, transactionnel et tout-ou-rien.

**À ne pas implémenter**

- **D-12** est d'ampleur nulle : elle figure au PRD pour rester visible, mais ne demande aucun travail tant que son constat tient. `AD-20` en fixe la condition de révision — le jour où l'on voudrait masquer l'identité des autres votants.
- **D-7 n'est plus d'ampleur nulle.** Requalifiée « Faible — actée » le 2026-08-05, **corrigée le 2026-09-25** : les six entrées seedées étaient les **éveils** ; le catalogue manquant était celui de tous les souffles (9 communs, 12 de race), porté par la **story 33.2** (livrée). **D-21** (réserve de souffles, MJ seul) est portée par la **story 33.6**.
- Aucun changement d'environnement, de déploiement ou d'exploitation — propriété du Palier 11.

### UX Design Requirements

- UX-DR1 : Implémenter les **trois palettes de statut par thème** — douze valeurs hexadécimales — et l'invariant qui les gouverne : quatre statuts distinguables entre eux et éloignés des deux accents de leur thème.
- UX-DR2 : Fixer les **couleurs de texte des badges** : badge plein en `primary-bg` du thème (jamais du blanc) ; badge `done` en `text-muted` et non en `status-done`.
- UX-DR3 : Composant **`StatusBadge`** — cinq variantes (`todo`, `live`, `soon`, `done`, `draft` en contour tireté) et **trois paliers d'imminence** : contour seul au-delà de sept jours, teinté de sept à deux jours, plein la veille et le jour même avec libellé humain.
- UX-DR4 : Composant **`StateRail`** — bande verticale de 4 px, équivalent exact de la pastille du mode liste. En mode liste, la pastille n'est jamais seule : elle est doublée du libellé du signal dominant.
- UX-DR5 : **Bannières génératives, trois compositions thématiques** avec leurs règles de tirage et leurs bornes — Émeraude (ciel étoilé, halo, 1 à 3 comètes), Forêt (deux halos pulsants + tirage exclusif feuilles ou points lumineux), Atelier Cuivré (grille technique constante, manomètre à zone d'exclusion, chaîne de 2 à 6 rouages).
- UX-DR6 : **Trois rendus de bannière par thème** — bannière pleine en grande carte, vignette carrée 44 px en mode moyen, vignette atténuée + monogramme 28 px en mode liste — plus la règle de dérivation du monogramme.
- UX-DR7 : **Mécanique de graine** — hachage déterministe de l'identifiant de partie, jamais persistée, générateur pseudo-aléatoire explicite. Le nom de la partie et la clé de thème n'entrent pas dans la graine.
- UX-DR8 : Créer la **section Motion** du design system — trois règles (`prefers-reduced-motion` coupe tout ; aucune animation ne porte d'information ; n'animer que `transform` et `opacity`) et les animations de bannière par thème, limitées au mode grande carte.
- UX-DR9 : **Compte à rebours thématique** — liane qui pousse, manomètre dont l'aiguille monte, comète qui approche — sur les sept derniers jours, décoratif et redondant, sur la prochaine séance uniquement.
- UX-DR10 : Autoriser le **SVG inline** (amendement du principe n°1 de la base) et constituer la bibliothèque de rouages retenue : dents droites, trapèze + rayons, silhouette pleine. La technique de tracé technique au contour est rejetée.
- UX-DR11 : Composant **`IdentityLabel`** — point de passage unique de tout affichage de nom, portant la règle : deux noms ensemble → typographie seule (italique personnage, romain joueur) ; un seul nom → icône obligatoire (écu ou silhouette).
- UX-DR12 : **Barre de navigation** à quatre destinations — basse sur mobile, haute sur desktop, icônes SVG inline avec libellés.
- UX-DR13 : **`ListControlBar`** — modes en icônes (jamais en libellés texte), masquage au défilement, pastille de résumé signalant tout écart au défaut, révélation par icône. Recherche permanente sur desktop, à un geste sur mobile.
- UX-DR14 : **Trois modes d'affichage** avec leurs densités cibles — grande vignette (~2 par écran mobile), moyen (~4-5), liste (~12).
- UX-DR15 : **`DetailSurface`** adaptative — panneau latéral sur desktop, feuille montant du bas sur mobile — plus la règle d'emploi du dépliant comme exception justifiée au cas par cas.
- UX-DR16 : **Modèle de couches du calendrier** — six couches combinables, trois présentations (Mois, Semaine, Agenda), mémorisation du défaut sur le compte, bascules de visite temporaires, pastille d'écart au défaut avec action « Rétablir ».
- UX-DR17 : **Gestes de sélection** — glissement au créneau en vue Semaine, à la journée entière en vue Mois. Le tap case par case reste fonctionnel, le glissement s'amorce par appui maintenu sur mobile, et un équivalent clavier existe (`Maj` + flèches).
- UX-DR18 : **Signalétique de liste** — table de correspondance des dix signaux vers trois teintes, plafond de deux badges par carte avec résumé « +N », ordre de priorité entre signaux concurrents, et quatre intertitres de regroupement (« Ça t'attend », « En cours », « À venir », « Terminées »).
- UX-DR19 : **Chronologie anti-spoil** — nœuds ancrés sur la ligne, dates affichées, espacement corrigé ; la vue joueur s'arrête au dernier scénario publié, sans espace vide ni compteur trahissant un brouillon.
- UX-DR20 : **Découpe des thèmes** en un fichier par thème, avec `grimoire-emeraude` comme thème de référence dont dérive le typage, et renommage en `atelier-cuivre`.
- UX-DR21 : **Plancher d'accessibilité amendé** — les seuils chiffrés hérités passent de critère de recette à valeur de conception par défaut ; les règles de navigation clavier, d'ordre de focus et d'`aria-label` de la base **restent en vigueur**.
- UX-DR22 : Implémenter les **quatre parcours clés** décrits par le contrat d'UX : l'ouverture rapide sur téléphone, la levée d'ambiguïté d'identité, la recherche de date par le MJ, et l'approche d'une séance.

### FR Coverage Map

Chaque exigence est rattachée à la ou aux stories qui la portent.

| Exigence | Story | Objet |
| --- | --- | --- |
| FR-1 | 28.1 | Écran de compte |
| FR-2 | 28.4 | Thème persisté |
| FR-3 | 28.1 · 29.8 · 29.9 · 30.4 | Mécanisme de préférences, puis chaque préférence par la story qui la consomme |
| FR-4 | 28.1 | Nom affiché modifiable |
| FR-4b | 28.3 | Homonymie signalée |
| FR-5 | 28.6 | Changement d'e-mail |
| FR-6 | 28.5 | Mot de passe en session |
| FR-7 | 29.1 | Bascule supprimée |
| FR-8 | 29.1 | Rôle par partie |
| FR-9 | 29.1 | Création mise en avant |
| FR-10 | 29.8 | Filtres et tris |
| FR-11 | 29.8 | Favoris |
| FR-12 | 29.7 | Signalétique d'état |
| FR-13 | 29.13 | Annonces non vues |
| FR-14 | 28.2 | Convention d'identité |
| FR-15 | 28.2 | Affichage conjoint |
| FR-16 | 29.2 | Vue mes personnages |
| FR-17 | 28.3 | Pastille de niveau |
| FR-18 | 31.1 | Exports regroupés |
| FR-19 | 31.3 | Aide contextuelle |
| FR-20 | 31.2 | Textes descriptifs |
| FR-21 | 31.4 | Parcours de création |
| FR-22 | 31.5 | Fiches des compagnons |
| FR-23 | 31.6 · 31.7 | Filtrage serveur, puis écran de configuration |
| FR-24 | 33.1 | Fiche Homme Dragon |
| FR-25 | 33.3 | Création guidée |
| FR-26 | 33.2 | Souffles communs et par race, seedés et affichés |
| FR-27 | 33.4 | Export amélioré |
| FR-28 | 32.2 | Vue de partie réorganisée |
| FR-29 | 32.3 · 32.4 | États, puis chronologie |
| FR-30 | 32.1 | Autocomplétion |
| FR-31 | 32.2 | Place des fonctionnalités récentes |
| FR-32 | 30.2 · 30.3 | Écriture groupée, puis glissement |
| FR-33 | 30.5 | Séances dans les calendriers |
| FR-34 | 30.5 · 30.6 | Votes en couche, puis à l'écran |
| FR-35 | 30.1 | Retrait d'une réponse |
| FR-36 | 30.3 | Vue semaine spécialisée |
| FR-37 | 34.2 | Lien mort retiré |
| FR-38 | 34.1 | Messages véridiques |
| FR-39 | 34.2 | Mot de passe révélable |
| FR-40 | 34.3 | Mise en forme |
| FR-41 | 35.3 | Revue éditoriale |
| FR-42 | 35.2 | Classement des textes |
| FR-43 | 35.1 | Découpe et renommage |
| FR-44 | 29.6 | Clôture explicite |
| FR-45 | 29.9 | Modes d'affichage |
| FR-46 | 30.4 · 30.5 · 30.6 | Modèle, endpoint, puis interface |
| FR-47 | 29.10 · 29.12 | Bannière générative, puis image de couverture |
| FR-48 | 29.3 | Navigation à quatre destinations |
| FR-58 | 29.15 · 29.16 | Point d'entrée de création d'un personnage |
| FR-59 | 33.5 | Hommes Dragons dans Personnages |
| FR-60 | 29.17 | Systèmes jouables seuls proposés |
| FR-61 | 33.6 | Réserve de souffles |
| FR-62 | 33.7 | Capacités de niveau |
| FR-63 | 33.8 | Homme Dragon multi-aventures (AD-23 faite) |
| *(Q-1)* | 29.14 | Refonte des écrans de création et d'édition de partie |

### Exigences d'UX sans ancrage FR

Trois exigences de design ne découlent d'aucune FR : elles viennent du contrat d'UX et ont leur propre porteur.

| Exigence | Story | Objet |
| --- | --- | --- |
| UX-DR1 · UX-DR2 | 29.0 | Trois palettes de statut, invariant de palette, couleurs de texte des badges |
| UX-DR8 · UX-DR9 | 29.11 | Section Motion du design system, animations de bannière, compte à rebours |
| UX-DR22 | — | Les quatre parcours clés sont couverts par morceaux ; à vérifier de bout en bout à la recette du palier, pas par une story |

## Epic List

### Epic 28 : Compte et identité

L'utilisateur dispose enfin d'un endroit où vivre : il gère son profil, sécurise son compte et règle des préférences qui le suivent d'un appareil à l'autre. Dans le même mouvement, l'application cesse de confondre un joueur et son personnage — le nom affiché entre dans tous les DTO d'identité, et un composant unique porte la convention partout.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-4b, FR-5, FR-6, FR-14, FR-15, FR-17

**Notes d'implémentation :** prérequis dur des épics 29, 31 et 32 — les préférences n'ont nulle part où vivre tant que cet épic n'a pas livré, et la convention d'identité doit précéder les écrans qui l'appliquent. Porte les refactors `AD-4`/`AD-6` (extraction de `revokeSessions`) et les deux points d'écriture obligatoires de `displayName` (migration **et** `register()`).

### Epic 29 : Navigation et listes

L'utilisateur atteint ses parties et ses personnages sans passer par un mode, et voit d'un coup d'œil lesquelles réclament quelque chose de lui. La navigation se restructure en quatre destinations, les listes gagnent leurs modes d'affichage, leurs tris, leurs favoris et leur signalétique d'état.

**FRs covered:** FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-16, FR-44, FR-45, FR-47, FR-48, FR-58, FR-60 · plus la refonte des écrans de création et d'édition de partie (Q-1)

**Notes d'implémentation :** le plus gros épic du palier, mais un seul écran-famille et un seul jeu de fichiers. Porte `AD-11` (`ModeService` → `MyPartiesService`, câblage SSE conservé à l'identique), `AD-15` (projection explicite de `PartieDto`), `AD-3` (appel unique de signaux), `AD-17` et `AD-19` (image de couverture et bannière générative).

**La story 29.0 ouvre l'épic** : elle porte les trois palettes de statut, prérequis dur des stories 29.7, 29.11 et 32.3, qui présupposent toutes quatre teintes distinguables.

**Séquencement à connaître :** la barre de navigation (29.3) livre une destination « Calendrier » qui pointe sur le calendrier **existant** jusqu'à ce que l'épic 30 le refonde. C'est voulu — l'épic 29 ne dépend d'aucun épic suivant.

**Stories 29.4 et 29.5 insérées après correct-course (sprint change, 2026-08-08)**, à l'usage de la barre livrée par 29.3 : le bandeau du haut restait vide sur tous les écrans, et aucun écran ne signalait localement « où je suis, qu'est-ce que je peux faire ici » au-delà des 4 destinations globales. Numérotées 29.4/29.5 pour rester juste après leur prérequis direct (29.3) — les neuf stories suivantes ont glissé d'autant (anciennes 29.4–29.12 → 29.6–29.14). 29.4 pose le mécanisme générique (titre contextuel + sous-navigation locale, appliqué à l'écran Partie qui a déjà la structure d'onglets nécessaire) ; 29.5 l'applique à la fiche personnage, qui n'a aujourd'hui aucune structure de section et doit d'abord être découpée. Aucune des deux ne remplace la barre à 4 destinations (FR-48) : elle reste seule responsable de l'accès global en un geste, la sous-navigation locale s'y ajoute sans jamais la masquer.

**Épic rouvert le 2026-09-20 (sprint change, `sprint-change-proposal-2026-09-20.md`)** : l'usage réel a montré que le point d'entrée de création d'un *personnage* n'était pas évident (une initiale cliquable dans le roster desktop, un onglet sur mobile). 29.17 restreint la création de partie aux systèmes ayant un module (aujourd'hui Ryuutama seul) et pose l'indicateur que lisent 29.15 (bouton explicite sur la partie) et 29.16 (section de création au-dessus de la liste de « Personnages »). Ordre de travail recommandé : **29.17 → 29.15 → 29.16**. La liste de 29.2 reste celle des seuls personnages de l'utilisateur : la section de 29.16 est un bloc distinct, jamais fait de cartes de personnages.

### Epic 30 : Calendrier

L'utilisateur déclare ses disponibilités sans agacement — une sélection par glissement remplace quatre allers-retours — et le calendrier lui dit enfin où en sont ses séances, ses votes et ses inscriptions, sans qu'il ait à faire défiler vers un panneau caché.

**FRs covered:** FR-32, FR-33, FR-34, FR-35, FR-36, FR-46

**Notes d'implémentation :** porte `AD-18` (endpoint unique hébergé dans `AvailabilityModule`), `AD-16` (couches relationnelles), `AD-21` (écriture groupée transactionnelle) et `AD-9` (indisponibilité dérivée injectée avant la séparation des vues).

### Epic 31 : Fiche de personnage

Un joueur lit sa fiche sans avoir le livre à côté, consulte celles de ses compagnons, et le MJ décide de ce qui reste caché. Les exports quittent le premier plan.

**FRs covered:** FR-18, FR-19, FR-20, FR-21, FR-22, FR-23

**Notes d'implémentation :** porte `AD-7`, dont le changement de signature de `toDto()` se propage à une quinzaine d'appels. **FR-23 est le morceau le plus lourd du palier** et le premier candidat à en sortir si le périmètre doit être resserré — il est isolable sans casser le reste de l'épic.

### Epic 32 : Vue de partie et chronologie

Le contenu d'une partie cesse d'être un fouillis : l'action immédiate, la consultation et la référence se séparent, et la chronologie rend enfin lisible l'enchaînement des scénarios et de leurs séances — sans jamais trahir l'existence d'un brouillon.

**FRs covered:** FR-28, FR-29, FR-30, FR-31

**Notes d'implémentation :** l'anti-spoil tient dans la signalétique elle-même (`AD-20`) — le filtrage frontend n'est **jamais** redondant, `findAllForPartie` ne filtrant aucun statut.

### Epic 33 : Homme Dragon

Le MJ crée et consulte son Homme Dragon avec le même soin qu'une fiche de personnage joueur : formulaire guidé, fiche refondue, export au même niveau.

**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-59, FR-61, FR-62, FR-63

**Notes d'implémentation :** **Q-13 corrigée le 2026-09-25.** Les six entrées seedées sont les **éveils** ; les 21 souffles (9 communs, 12 de race) sont seedés et affichés par la story 33.2. Référence des règles : `docs/dragons.md`. Aucun décompte pendant la séance ; le niveau compte les scénarios `PASSE`.

**Stories 33.6, 33.7 et 33.8 ajoutées le 2026-09-29 (sprint change) ; 33.6 révisée le 2026-10-02** : réserve de souffles de l'Homme Dragon (une seule réserve, composée sur sa fiche, MJ seul ; passe UX faite le 2026-10-02), capacités de niveau (artefact cadeau, souffles rituels), et Homme Dragon multi-aventures (architecture faite le 2026-10-04, AD-23). Ordre : 33.3 → 33.4 → 33.5 → 33.7 → 33.6 → 33.8 (la passe UX de la 33.6 est faite). **La 33.8 casse volontairement le contrat des stories 33.5 à 33.7** (routes par Homme Dragon, `404` au lieu de `403`, plus de `partieId` sur la fiche) : AD-23 en liste les consommateurs.

**Story 33.5 ajoutée le 2026-09-20 (sprint change)** : l'Homme Dragon rejoint « Personnages » et s'y crée, une entrée par aventure. Seule story de l'épic à toucher une lecture API agrégée ; elle ne doit pas figer « un par partie » dans son contrat (un même Homme Dragon réutilisé sur plusieurs aventures est repris par la 33.8).

### Epic 34 : Entrée dans l'application

La porte d'entrée cesse de mentir : plus de lien menant à une impasse, un message d'échec qui dit la vraie cause, et des écrans mis en forme pour le mobile.

**FRs covered:** FR-37, FR-38, FR-39, FR-40

**Notes d'implémentation :** épic isolé, sans dépendance sortante — ordonnable librement après l'épic 28.

### Epic 35 : Thèmes et textes

Les trois univers retrouvent un registre cohérent, chaque texte est statué comme thématisé ou non, et le stockage devient relisible thème par thème.

**FRs covered:** FR-41, FR-42, FR-43

**Notes d'implémentation :** **en dernier par construction** — on ne relit les libellés qu'une fois tous les écrans refondus. Porte le renommage `medieval-steampunk` → `atelier-cuivre` et, indissociablement, la **migration des valeurs persistées de `User.theme`** : sans elle, tout compte ayant choisi ce thème le perd silencieusement.

### Epic 36 : Calendrier — lisibilité

L'utilisateur ouvre son calendrier et **voit** ce qui l'attend : sa prochaine séance nommée à son créneau, les votes où on l'attend, où en est le groupe — sans lire une liste ni deviner un point de couleur. Déclarer ses disponibilités devient un geste de sélection, et un conflit cesse d'être un mur.

**FRs covered:** FR-49, FR-50, FR-51, FR-52, FR-53, FR-54, FR-55, FR-56, FR-57 · **amende** FR-32, FR-36, FR-46

**Origine :** retour d'usage du 2026-08-17, après livraison de l'épic 30. L'épic 30 a livré ce que le PRD demandait — les couches existent, séances et votes remontent, la sélection par glissement fonctionne. L'usage a montré que **les informations étaient présentes et illisibles**. Cet épic porte la lisibilité que FR-46 supposait acquise.

**Ordonnancement : juste après l'épic 30, avant l'épic 31.** Le numéro 36 est un choix d'ordre, pas de priorité — les épics 31 à 35 existaient déjà au backlog quand celui-ci a été créé.

**Notes d'implémentation :** porte quatre dérogations serveur — `D-15` (trois champs d'informations pratiques sur `Seance` — heure, lieu, note libre ; *amendé le 2026-08-19*), `D-16` (mutation des options d'un vote ouvert), `D-17` (agrégats de vote dans `GET /me/calendar`), `D-18` (résolution de conflits sur l'écriture groupée). **`D-18` renverse `AD-21`** et la garde formelle de la story 30.2 : la route groupée devait échouer en bloc, elle doit désormais absorber la résolution de conflits *et* le mécanisme de découpe de la story 1.7. C'est la story la plus lourde de l'épic, et avec 36.10 la raison pour laquelle `/security-review` n'est pas optionnel.

**Un seul épic, et non trois :** ces neuf exigences visent toutes le même massif de fichiers — `calendar-view`, les trois vues, le panneau de couches, les composants de vote. Les séparer produirait le cas fautif du découpage par couches techniques : plusieurs épics rejouant les mêmes fichiers.

**Le pari visuel du lot est la story 36.2** — la case à trois bandes. Elle est placée en deuxième position, et non en première, pour une raison précise : livrée seule, elle rendrait la vue mois **muette sur téléphone** jusqu'à l'arrivée du rail, puisque les bandes y perdent leur texte. Le rail (36.1) se construit sur la grille actuelle, est utile dès sa livraison, et supprime cette régression intermédiaire. Le retour sur le pari visuel n'est décalé que d'une story. Si la grille à bandes fatigue à l'usage, la sortie de secours — réglette fine et puces — est documentée en `EXPERIENCE.md` §4.3 ter.

**Contrat d'UI.** `ux-designs/ux-jdr-master-2026-08-04/mockups/contrat-ui-calendrier.html` fait foi : tout élément qu'il dessine sera implémenté tel quel. **Toute story qui en modifierait un doit le signaler par ⚠️ juste avant la partie concernée**, en disant ce qui change et pourquoi.

**Stories 36.15 et 36.16 ajoutées le 2026-08-24**, après la clôture apparente de l'épic (36.14 livrée) : la revue du registre de dette différée (`deferred-work.md`) a fait remonter deux écarts que l'épic laissait ouverts sans les trancher, et l'utilisateur a explicitement décidé de les combler plutôt que de les abandonner. 36.15 referme l'écart avec `contrat-ui-calendrier.html:376` (bouton *Sceller* absent de la barre de sélection de la grille, alors que le contrat d'UI le dessine). 36.16 est la **troisième story serveur** de l'épic (après 36.4/D-18 et 36.10/D-16) : elle comble `MyCalendarSeanceEntry` pour que la section « C'est passé », déjà livrée côté front par la 36.11, cesse d'être structurellement vide en calendrier personnel.

---

## Epic 28 : Compte et identité

L'utilisateur dispose enfin d'un endroit où vivre : il gère son profil, sécurise son compte et règle des préférences qui le suivent d'un appareil à l'autre. Dans le même mouvement, l'application cesse de confondre un joueur et son personnage.

*Point d'entrée : l'écran de compte s'accroche au menu existant. L'épic 29 déplacera l'entrée dans la barre de navigation — l'épic 28 ne dépend donc d'aucun épic suivant.*

### Story 28.1 : Écran de compte et nom affiché

As a utilisateur connecté,
I want un écran regroupant mes informations et mes préférences, où je peux choisir un nom affiché,
So that je décide de la façon dont j'apparais aux autres sans toucher à mon identifiant de connexion.

**Acceptance Criteria:**

**Given** je suis connecté
**When** j'ouvre l'entrée « Compte » du menu existant
**Then** j'accède à un écran regroupant mes informations personnelles
**And** mon pseudo y est affiché sans qu'aucun champ ne permette de le modifier
**And** aucune section vide n'y figure — les préférences apparaîtront avec la première d'entre elles

**Given** la migration a été appliquée sur une base existante
**When** je consulte n'importe quel compte
**Then** son nom affiché vaut son pseudo
**And** aucun compte ne porte un nom affiché vide ou nul

**Given** un nouveau compte est créé par le parcours d'invitation
**When** l'inscription aboutit
**Then** le nom affiché est renseigné à la création par `AuthService.register()`
**And** la contrainte `NOT NULL` n'est jamais violée par une inscription

**Given** je saisis un nouveau nom affiché
**When** j'enregistre
**Then** la valeur est persistée sans contrainte d'unicité
**And** un autre utilisateur peut porter exactement le même nom affiché

### Story 28.2 : Le nom affiché traverse l'application

As a joueur,
I want savoir en permanence si le nom que je lis est celui d'un joueur ou celui d'un personnage,
So that je cesse de deviner à chaque écran.

**Acceptance Criteria:**

**Given** un DTO exposant une identité utilisateur — membres d'une partie, propriétaire d'un personnage, participants, auteur d'annonce, lignes de distribution d'XP, membres d'un créneau
**When** il est renvoyé par l'API
**Then** il porte `pseudo` **et** `displayName`
**And** `displayName` n'est jamais nul, aucun repli n'étant écrit côté front

**Given** un écran affiche un nom de joueur et un nom de personnage ensemble
**When** il les rend
**Then** le nom de personnage est en italique et celui du joueur en romain
**And** aucune de ces deux informations n'est portée par la couleur seule

**Given** un écran n'affiche qu'un seul nom, quel qu'il soit
**When** il le rend
**Then** une icône l'accompagne — écu pour un personnage, silhouette pour un joueur

**Given** n'importe quel affichage d'un nom d'identité dans l'application
**When** il est rendu
**Then** il passe par le composant partagé `IdentityLabel`
**And** aucun template n'applique la convention à la main

**Given** un joueur consulte la liste des membres d'une partie
**When** il la reçoit
**Then** aucun e-mail d'un autre utilisateur n'y figure
**And** le MJ de cette partie, lui, continue de les voir

**Given** la recherche d'utilisateurs pour une invitation
**When** elle renvoie des résultats
**Then** ils ne portent que le pseudo — ni nom affiché, ni e-mail

**Given** l'onglet Détails › Troupe, qui n'affiche aujourd'hui que les joueurs
**When** il est rendu après cette story
**Then** chaque ligne porte le personnage **et** son joueur lorsque le personnage existe
**And** une ligne sans personnage n'affiche que le joueur, accompagné de son icône

### Story 28.3 : Homonymie signalée et pastille de niveau replacée

As a utilisateur,
I want être averti quand mon nom affiché est déjà porté par quelqu'un de ma partie,
So that je choisisse en connaissance de cause d'en changer ou de l'assumer.

**Acceptance Criteria:**

**Given** un autre membre de ma partie porte le même nom affiché que moi
**When** j'ouvre un écran qui nous liste tous les deux
**Then** l'application me le signale et me propose d'en changer
**And** rien n'est bloqué : je peux poursuivre sans rien modifier

**Given** j'ai choisi d'ignorer l'avertissement
**When** je continue à naviguer
**Then** l'avertissement ne réapparaît pas en boucle sur chaque écran

**Given** un écran sans personnage — invitations, gestion des membres, distribution d'XP, disponibilités, auteur d'annonce
**When** deux homonymes y figurent
**Then** le pseudo est affiché en complément pour les distinguer

**Given** un de mes personnages a une montée de niveau disponible
**When** j'ouvre sa fiche
**Then** la pastille de montée de niveau apparaît près du nom du personnage

### Story 28.4 : Thème persisté sur le compte

As a utilisateur,
I want que mon thème me suive d'un appareil à l'autre,
So that je ne le reconfigure pas à chaque fois que je change de téléphone ou d'ordinateur.

**Acceptance Criteria:**

**Given** mon compte n'a jamais eu de thème enregistré
**When** je me connecte
**Then** le thème présent dans mon stockage local est adopté une seule fois et poussé vers mon compte
**And** je ne perds pas le thème que j'utilisais avant la mise à jour

**Given** mon compte porte un thème
**When** je me connecte depuis un autre appareil
**Then** ce thème s'applique
**And** le stockage local de cet appareil est réécrit depuis le compte

**Given** je ne suis pas connecté
**When** j'ouvre un écran d'authentification
**Then** le dernier thème connu localement s'applique sans clignotement

**Given** mon compte porte déjà un thème
**When** une valeur différente traîne dans le stockage local
**Then** elle ne remonte jamais écraser la préférence du compte

**Given** le thème change, quelle qu'en soit la cause
**When** il est appliqué
**Then** `ThemeToneService` en reste le seul applicateur
**And** le service de compte se borne à lire et écrire la préférence

### Story 28.5 : Changement de mot de passe en session

As a utilisateur connecté,
I want changer mon mot de passe sans passer par la procédure d'oubli,
So that je puisse le renouveler quand je le décide.

**Acceptance Criteria:**

**Given** je suis connecté
**When** je fournis mon mot de passe courant et un nouveau mot de passe
**Then** le mot de passe est changé

**Given** le mot de passe courant que je fournis est incorrect
**When** je valide
**Then** le changement échoue et rien n'est modifié

**Given** le changement a réussi
**When** je regarde mes sessions actives
**Then** toutes les autres ont été coupées
**And** la session depuis laquelle j'ai agi reste ouverte

**Given** la réinitialisation par e-mail oublié
**When** elle s'exécute
**Then** elle continue de couper **toutes** les sessions sans exception — l'écart avec le changement en session est délibéré

**Given** l'une ou l'autre de ces deux procédures
**When** elle coupe des sessions
**Then** elle appelle une méthode partagée `revokeSessions(userId, exceptSid?)`
**And** aucun code de coupure de session n'est dupliqué

### Story 28.6 : Changement d'e-mail à double canal

As a utilisateur,
I want changer mon adresse e-mail sans risquer de perdre l'accès à mon compte,
So that une faute de frappe ou une usurpation reste rattrapable.

**Acceptance Criteria:**

**Given** je demande un changement d'adresse
**When** je fournis mon mot de passe courant
**Then** un lien de confirmation part vers la **nouvelle** adresse
**And** un avis de demande part vers l'**ancienne**
**And** l'adresse du compte n'a pas encore changé

**Given** j'ouvre le lien de confirmation reçu sur la nouvelle adresse
**When** je l'active
**Then** l'adresse du compte est remplacée
**And** un lien de retour arrière valable un mois part vers l'ancienne adresse

**Given** un tiers a changé mon adresse à mon insu
**When** j'active le lien de retour arrière depuis mon ancienne boîte
**Then** mon ancienne adresse est restaurée
**And** toutes les sessions actives sont coupées
**And** une réinitialisation de mot de passe est exigée avant toute reconnexion

**Given** un jeton expiré, déjà utilisé, ou inconnu
**When** il est présenté
**Then** il est refusé sans effet de bord

**Given** une adresse mal saisie qui n'aboutit à personne
**When** le lien de confirmation n'est jamais ouvert
**Then** le compte conserve son adresse d'origine et reste accessible

---

## Epic 29 : Navigation et listes

L'utilisateur atteint ses parties et ses personnages sans passer par un mode, et voit d'un coup d'œil lesquelles réclament quelque chose de lui.

*Ordre imposé : les palettes de statut ouvrent l'épic, sinon toute la signalétique se construit sur des teintes qui ne se distinguent pas. La vue « mes personnages » précède la barre de navigation, sinon l'onglet mène au vide. La signalétique d'état suit la clôture, sinon aucun signal ne peut porter le statut « terminée ».*

### Story 29.0 : Palettes de statut des trois thèmes

*Story insérée après le découpage initial : `UX-DR1` et `UX-DR2` n'avaient aucun porteur alors qu'elles conditionnent 29.7, 29.11 et 32.3. Numérotée 29.0 pour ne pas décaler les dix stories suivantes.*

As a utilisateur,
I want que les états se distinguent les uns des autres dans le thème que j'ai choisi,
So that la couleur me dise quelque chose au lieu de tout fondre dans la même teinte.

**Acceptance Criteria:**

**Given** le thème Atelier Cuivré aujourd'hui
**When** on inspecte les jetons de couleur
**Then** `status-available` ne dérive plus de `accent-1`
**And** l'urgence cesse d'être indistinguable de la normalité dans ce thème

**Given** chacun des trois thèmes
**When** ses quatre couleurs de statut sont définies
**Then** elles sont distinguables entre elles
**And** elles sont éloignées des deux accents de ce thème
**And** aucune ne dérive d'un accent

**Given** un badge au palier imminent, donc plein
**When** son texte est rendu
**Then** il prend la couleur de fond primaire du thème, jamais du blanc

**Given** un badge d'état terminé
**When** son texte est rendu
**Then** il prend la couleur de texte atténuée, jamais la teinte `status-done` elle-même

**Given** un thème ajouté plus tard
**When** ses couleurs de statut sont écrites
**Then** l'invariant de palette s'applique à lui comme aux trois autres
**And** la règle est écrite là où un futur auteur de thème la lira

**Given** le rouge
**When** on cherche où il est employé
**Then** il n'est réservé par aucune palette de statut
**And** il reste disponible pour une erreur, une action destructive ou une indisponibilité de créneau

### Story 29.1 : Liste unique des parties

As a utilisateur qui est MJ d'une partie et joueur dans une autre,
I want voir toutes mes parties dans une seule liste,
So that je cesse de basculer entre deux modes pour retrouver ce que je cherche.

**Acceptance Criteria:**

**Given** je cumule les rôles de MJ et de joueur
**When** j'ouvre mes parties
**Then** elles apparaissent toutes dans une liste unique
**And** aucun sélecteur de mode MJ/joueur n'existe plus dans la navigation

**Given** une partie de la liste
**When** elle s'affiche
**Then** mon rôle sur cette partie est indiqué
**And** l'information ne repose pas sur la couleur seule

**Given** je ne suis MJ d'aucune partie
**When** j'ouvre la liste
**Then** aucun bouton proéminent de création n'apparaît
**And** la création reste accessible depuis le menu, sans restriction ajoutée

**Given** je suis MJ d'au moins une partie
**When** j'ouvre la liste
**Then** l'appel à l'action de création est mis en avant

**Given** `ModeService` est refactoré en `MyPartiesService`
**When** le refactor est terminé
**Then** le compteur anti-course et `notifyChanged()` câblé sur le canal `user:{id}` sont conservés à l'identique
**And** la clé de mode en stockage local est supprimée

**Given** `PartiesService` renvoie une partie
**When** elle est sérialisée
**Then** elle passe par une projection explicite qui énumère ses champs
**And** aucun objet Prisma n'est propagé tel quel

### Story 29.2 : Vue « mes personnages »

As a joueur,
I want retrouver tous mes personnages au même endroit,
So that je n'aie pas à me rappeler dans quelle partie j'ai créé lequel.

**Acceptance Criteria:**

**Given** j'ai des personnages dans plusieurs parties
**When** j'ouvre « Mes personnages »
**Then** ils apparaissent tous, toutes parties confondues
**And** la liste ne contient que les miens

**Given** cette vue
**When** elle s'affiche
**Then** elle ne mélange jamais parties et personnages dans une même liste

**Given** un personnage listé
**When** il est rendu
**Then** son nom suit la convention d'identité établie à l'épic 28
**And** la partie dont il provient est indiquée

**Given** je saisis une recherche
**When** je tape
**Then** la liste se filtre sur les personnages correspondants

### Story 29.3 : Navigation à quatre destinations

As a utilisateur sur téléphone,
I want atteindre mes parties, mes personnages, mon calendrier et mon compte sans ouvrir de menu,
So that je passe de l'un à l'autre sans remonter en haut de page.

**Acceptance Criteria:**

**Given** j'utilise l'application sur téléphone
**When** je l'ouvre
**Then** une barre basse propose quatre destinations : Parties, Personnages, Calendrier, Compte

**Given** j'utilise l'application sur desktop
**When** je l'ouvre
**Then** les mêmes quatre entrées apparaissent en barre haute

**Given** une destination est active
**When** la barre s'affiche
**Then** elle est distinguée autrement que par la seule couleur

**Given** la barre est livrée
**When** je cherche l'écran de compte
**Then** il est atteignable depuis la barre, et non plus seulement depuis le menu

**Given** n'importe quel écran de l'application
**When** je veux consulter le calendrier
**Then** il est à un seul geste

### Story 29.4 : Sous-navigation contextuelle des écrans

*Story insérée après correct-course (2026-08-08), à l'usage de la barre livrée par 29.3 : le bandeau du haut restait vide sur tous les écrans, et rien ne signalait localement « où je suis ». Numérotée 29.4 pour rester juste après son prérequis direct — les stories suivantes ont glissé (anciennes 29.4–29.12 → 29.6–29.14). Direction validée sur maquette avec l'utilisateur le 2026-08-09 : voir [`mockups/key-partie-detail-navigation-contextuelle.html`](../ux-designs/ux-jdr-master-2026-08-04/mockups/key-partie-detail-navigation-contextuelle.html) et `EXPERIENCE.md` § Navigation contextuelle locale / Component Patterns §4.8.*

As a utilisateur,
I want que le bandeau du haut m'indique où je suis et que chaque écran propose ses propres sections quand il en a,
So that je comprenne d'un coup d'œil ce que je regarde et ce que je peux y faire, sans deviner.

**Acceptance Criteria:**

**Given** j'ouvre un écran de l'application
**When** le bandeau du haut s'affiche
**Then** il porte un wordmark réduit (cliquable, retour à l'accueil) et un titre contextuel à l'écran (par exemple le nom de la partie sur son écran de détail)
**And** il ne reste jamais vide comme aujourd'hui
**And** un sous-titre n'apparaît que lorsqu'il apporte une information utile non visible ailleurs sur l'écran (par exemple le rôle MJ/joueur sur l'écran de détail d'une partie) — jamais systématique

**Given** la barre à quatre destinations (Parties, Personnages, Calendrier, Compte)
**When** n'importe quel écran s'affiche, y compris ceux dotés d'une sous-navigation locale
**Then** elle reste visible et atteignable en un geste
**And** la sous-navigation locale s'ajoute à elle, elle ne la remplace ni ne la masque jamais

**Given** un écran contextualisé s'affiche (par exemple le détail d'une partie)
**When** la barre à quatre destinations est rendue
**Then** aucune de ses entrées ne porte la teinte ni l'`aria-current` actifs, y compris celle par laquelle on est arrivé
**And** c'est le bandeau contextuel et la sous-navigation locale qui répondent seuls à « où suis-je »

**Given** l'écran de détail d'une partie
**When** il s'affiche
**Then** une sous-navigation locale distincte expose ses sections (au minimum Détail, Ma fiche, Chronologie)
**And** elle réutilise la structure d'onglets déjà en place plutôt que d'en recréer une

**Given** une section de la sous-navigation locale active
**When** elle s'affiche
**Then** elle est distinguée autrement que par la seule couleur, selon le même principe que l'entrée active de la barre globale (29.3, AC3)

**Given** un écran sans sections propres (par exemple Mes parties, Mes personnages)
**When** il s'affiche
**Then** aucune sous-navigation locale vide n'apparaît
**And** seul le titre contextuel du bandeau du haut change

**Given** cette story livrée
**When** je navigue depuis un écran contextualisé vers une autre destination globale
**Then** aucun bouton « Retour » dédié n'est nécessaire — la barre globale, toujours visible, suffit à changer de destination

### Story 29.5 : Fiche personnage en sections routées

*Story insérée après correct-course (2026-08-08), suite directe de 29.4 : la fiche personnage est aujourd'hui une page unique qui empile toutes ses sections (dont l'équipement et le journal) et n'a aucune structure pour recevoir une sous-navigation locale — elle doit d'abord être découpée.*

As a joueur,
I want retrouver l'équipement et le journal de mon personnage dans leurs propres sections plutôt que noyés dans une longue page,
So that je trouve ce que je cherche sans défiler toute la fiche.

**Acceptance Criteria:**

**Given** j'ouvre la fiche d'un personnage
**When** elle s'affiche
**Then** elle est structurée en sections distinctes accessibles depuis la sous-navigation locale (29.4) : au minimum la fiche principale, l'équipement, le journal

**Given** je change de section sur la fiche
**When** je sélectionne une autre entrée de la sous-navigation locale
**Then** le contenu affiché change sans rechargement de page ni perte du contexte courant (personnage, partie)

**Given** l'équipement et le journal désormais dans leurs propres sections
**When** je les consulte
**Then** leur contenu et leur comportement restent identiques à ceux d'aujourd'hui (inventaire, encombrement, entrées de journal) — aucune régression fonctionnelle, seulement un déplacement

**Given** une section de la fiche personnage active
**When** elle s'affiche
**Then** elle suit la même convention de distinction que celle définie en 29.4 — jamais la couleur seule

### Story 29.6 : Clôture explicite d'une partie

As a MJ,
I want déclarer qu'une partie est terminée et pouvoir revenir sur cette décision,
So that mes listes cessent de mélanger ce qui vit et ce qui est fini.

**Acceptance Criteria:**

**Given** je suis MJ d'une partie active
**When** je la déclare terminée
**Then** sa date de clôture est enregistrée

**Given** une partie que j'ai clôturée
**When** je reviens sur ma décision
**Then** la date de clôture est effacée et la partie redevient active

**Given** une partie non clôturée, sans aucun scénario ni séance
**When** son statut est calculé
**Then** il vaut « pas encore commencée »

**Given** le statut d'une partie
**When** il est calculé
**Then** il l'est côté serveur, dans la projection
**And** aucun écran ne le dérive lui-même

**Given** une partie terminée
**When** elle apparaît dans une liste
**Then** elle est visuellement en retrait
**And** elle reste entièrement consultable

### Story 29.7 : Signalétique d'état des parties

As a utilisateur,
I want voir sur chaque partie ce qui réclame une action de ma part,
So that j'ouvre l'application et sache immédiatement quoi faire.

**Acceptance Criteria:**

**Given** j'ai plusieurs parties
**When** la liste se charge
**Then** un seul appel renvoie les signaux de toutes mes parties
**And** aucun appel supplémentaire n'est émis par partie affichée

**Given** les signaux renvoyés
**When** ils sont sérialisés
**Then** chacun est un code appartenant à une union fermée déclarée dans le paquet partagé
**And** une partie sans signal porte un tableau vide, jamais une entrée absente

**Given** une partie réclamant plusieurs actions
**When** sa carte s'affiche
**Then** au plus deux badges sont visibles
**And** le reste est résumé par un compteur

**Given** mon rôle sur une partie et son statut
**When** ils s'affichent
**Then** ils proviennent du serveur
**And** aucun écran ne les recalcule

**Given** une partie terminée
**When** ses signaux sont calculés
**Then** elle ne porte aucun signal d'action
**And** seuls subsistent les signaux de fin, tels qu'un compte-rendu manquant

**Given** une mutation qui modifie un signal
**When** elle aboutit
**Then** elle émet l'événement de la partie **et** celui de chaque membre concerné
**And** l'écran de liste n'écoute que le canal personnel de l'utilisateur

**Given** l'union fermée des codes de signal
**When** elle est déclarée
**Then** elle porte les dix signaux : personnage à créer, vote en cours sans ma réponse, compte-rendu non rédigé, Homme Dragon à créer, aucun membre invité, aucun scénario en cours, aucune date ni vote, rapport de fin manquant, prochaine séance connue, partie terminée
**And** aucun de ces dix n'est absent au motif qu'il serait rare

**Given** plusieurs signaux coexistent sur une même partie
**When** la teinte de la carte est choisie
**Then** elle est celle du signal le plus prioritaire, dans cet ordre : ce qui bloque le démarrage, puis ce qui a une échéance, puis ce qui est en retard
**And** une partie terminée reste en teinte « terminé » même si un rapport de fin manque

**Given** le mode d'affichage liste
**When** une partie y est rendue
**Then** la pastille d'état n'est jamais seule
**And** elle est doublée du libellé du signal dominant

**Given** la liste des parties
**When** elle regroupe ses éléments
**Then** quatre intertitres existent : ce qui t'attend, en cours, à venir, terminées

### Story 29.8 : Filtres, tris et parties favorites

As a utilisateur,
I want filtrer, trier et mettre en avant mes parties,
So that je retrouve ce que je cherche quand la liste s'allonge.

**Acceptance Criteria:**

**Given** je marque une partie comme favorite
**When** je recharge la liste
**Then** elle est mise en avant

**Given** je filtre par rôle ou par statut
**When** j'applique le filtre
**Then** la liste se réduit aux parties correspondantes

**Given** je choisis un critère de tri
**When** je l'applique
**Then** l'ordre change
**And** le critère est mémorisé sur mon compte

**Given** les valeurs de tri des parties
**When** elles sont validées côté serveur
**Then** elles appartiennent à une union fermée déclarée dans le paquet partagé
**And** cette union vaut : urgence, date, nom, type, statut

**Given** les critères de filtre
**When** ils s'affichent dans la barre de contrôles
**Then** ils se limitent au rôle et au statut
**And** la date, le nom et le type sont des critères de **tri**, pas de filtre

**Given** j'active « masquer les parties terminées »
**When** j'ouvre mes listes
**Then** elles sont masquées par défaut
**And** elles restent accessibles à la demande
**And** le masquage est appliqué côté front sur la liste déjà chargée, sans filtre serveur supplémentaire

### Story 29.9 : Modes d'affichage et barre de contrôles

As a utilisateur,
I want choisir la densité d'affichage de mes listes,
So that j'aie le détail quand j'en veux et la compacité quand j'en ai besoin.

**Acceptance Criteria:**

**Given** trois modes existent
**When** je bascule de l'un à l'autre
**Then** la densité change : grande vignette, intermédiaire, liste compacte

**Given** le sélecteur de mode
**When** il s'affiche
**Then** les modes sont représentés par des icônes
**And** aucun libellé texte de mode n'apparaît

**Given** je choisis un mode
**When** je me reconnecte depuis un autre appareil
**Then** ce mode est conservé

**Given** la liste des parties et celle des personnages
**When** leurs préférences sont stockées
**Then** chacune possède sa propre paire mode et tri

**Given** je fais défiler la liste vers le bas
**When** je descends
**Then** la barre de contrôles se masque
**And** elle revient dès que je remonte

**Given** un réglage s'écarte de mon défaut
**When** la liste s'affiche
**Then** une pastille le signale et propose de rétablir

**Given** j'utilise un téléphone
**When** la barre s'affiche
**Then** la recherche n'y est pas permanente
**And** elle reste atteignable par l'icône de révélation

### Story 29.10 : Bannière générative d'une partie

As a utilisateur,
I want que chaque partie porte une identité visuelle stable,
So that je la reconnaisse d'un coup d'œil dans une liste.

**Acceptance Criteria:**

**Given** une partie
**When** sa bannière est rendue
**Then** elle est calculée à partir d'une graine dérivée du seul identifiant de la partie

**Given** je renomme la partie, ou qu'un thème est renommé
**When** la bannière est rendue à nouveau
**Then** elle est rigoureusement identique

**Given** n'importe quel mode d'affichage
**When** la bannière est rendue
**Then** le rendu passe par un point de dérivation unique
**And** deux écrans ne peuvent pas produire deux bannières différentes pour la même partie

**Given** les trois modes d'affichage
**When** ils rendent la bannière
**Then** la grande carte porte la bannière pleine, le mode intermédiaire une vignette carrée, le mode liste une vignette atténuée surmontée du monogramme

**Given** la base de données
**When** on l'inspecte
**Then** ni la graine, ni les paramètres tirés, ni le rendu n'y figurent

**Given** chacun des trois thèmes
**When** une bannière est générée
**Then** elle respecte les règles de tirage de son thème
**And** aucun élément ne pénètre la zone d'exclusion du manomètre dans le thème Atelier Cuivré

### Story 29.11 : Animation des bannières et compte à rebours

As a utilisateur,
I want que l'application ait un peu de vie sans me distraire,
So that l'ambiance serve la lecture au lieu de la parasiter.

**Acceptance Criteria:**

**Given** une carte en mode grande vignette
**When** sa bannière est visible
**Then** l'animation propre à son thème joue

**Given** les modes intermédiaire et liste
**When** ils s'affichent
**Then** aucune animation ne joue

**Given** le réglage système de réduction des animations est actif
**When** j'ouvre l'application
**Then** toute animation est coupée
**And** aucune composition ne perd d'élément — rien ne manque au repos

**Given** une séance programmée dans moins de sept jours
**When** elle s'affiche
**Then** le compte à rebours propre au thème se remplit à mesure que la date approche

**Given** le compte à rebours
**When** il est affiché
**Then** il double le badge et le libellé
**And** il ne porte aucune information que ceux-ci ne portent pas

**Given** les animations de l'application
**When** elles s'exécutent
**Then** elles n'animent que des transformations et de l'opacité

### Story 29.12 : Image de couverture de partie

As a MJ,
I want donner à ma partie une image qui lui ressemble,
So that son identité ne dépende pas seulement de ce que l'algorithme a tiré.

**Acceptance Criteria:**

**Given** je suis MJ d'une partie
**When** je dépose une image de couverture
**Then** elle est enregistrée et devient l'identité visuelle de la partie

**Given** une partie porte une image
**When** elle s'affiche
**Then** l'image remplace la bannière générée dans tous les modes d'affichage
**And** l'animation du thème ne l'accompagne pas

**Given** je retire l'image
**When** je valide
**Then** la bannière générée reprend sa place

**Given** je suis joueur et non MJ de cette partie
**When** je tente de déposer une image
**Then** l'action est refusée

**Given** un dépôt d'image, de portrait ou de couverture
**When** il est traité
**Then** il passe par l'utilitaire partagé : validation du type par octets magiques, nettoyage des métadonnées EXIF, gardes contre la traversée de chemin

**Given** le plafond de taille
**When** il est appliqué au contrôleur de couverture
**Then** il y est redéclaré — il n'est pas factorisable dans l'utilitaire

**Given** le refactor de l'utilitaire est terminé
**When** la suite de tests s'exécute
**Then** le service d'export PDF et le mock du test de personnage ont été mis à jour
**And** aucun test ne passe silencieusement à côté de son sujet

**Given** une image de couverture
**When** elle est servie au navigateur
**Then** c'est par un endpoint sous garde, jamais en fichier statique

**Given** une liste de parties en grande vignette sur téléphone, chacune portant une image de couverture
**When** la liste se charge
**Then** ce ne sont pas les fichiers d'origine qui sont transférés
**And** l'image servie est dimensionnée pour le mode d'affichage demandé
**And** le poids total reste sans rapport avec N fois le plafond de dépôt

### Story 29.13 : Annonces non vues signalées à la connexion

As a joueur,
I want savoir à la connexion qu'une annonce m'attend,
So that je ne découvre pas trois jours plus tard une information qui me concernait.

**Acceptance Criteria:**

**Given** une annonce que je n'ai pas encore vue
**When** je me connecte
**Then** une notification éphémère me la signale

**Given** j'ouvre l'annonce
**When** je la consulte
**Then** la notification disparaît
**And** l'état « vue » est enregistré sur mon compte

**Given** j'ai lu une annonce sur mon téléphone
**When** je me connecte depuis mon ordinateur
**Then** elle ne m'est plus signalée

**Given** les annonces existantes
**When** la fonctionnalité est livrée
**Then** leur portée, leur ciblage et leur emplacement de consultation sont inchangés

### Story 29.14 : Refonte des écrans de création et d'édition de partie

*Porte Q-1, retenue dans le palier 9. **Le périmètre exact reste à arrêter avec l'utilisateur au démarrage de cette story** — le PRD demande explicitement qu'on lui repose la question. Les critères ci-dessous sont ceux qui tiennent quel que soit l'arbitrage ; ils seront complétés à ce moment-là.*

As a MJ,
I want créer et modifier ma partie sur des écrans aussi soignés que le reste de l'application,
So that le premier geste que je fais ne soit pas le plus négligé.

**Acceptance Criteria:**

**Given** le formulaire de création d'une partie
**When** je l'ouvre sur téléphone
**Then** sa hiérarchie visuelle est lisible et aucun contenu n'est tronqué

**Given** le formulaire d'édition
**When** je l'ouvre
**Then** il suit la même grammaire que celui de création — pas deux écrans à apprendre

**Given** une partie que je viens de créer
**When** elle apparaît dans ma liste
**Then** elle porte déjà son identité visuelle et sa signalétique d'état
**And** je peux y déposer une image de couverture depuis l'édition

**Given** un nom de partie affiché sur ces écrans
**When** il est rendu
**Then** il suit la convention d'identité établie à l'épic 28

**Given** le périmètre de la refonte
**When** la story démarre
**Then** la question a été reposée à l'utilisateur et l'arbitrage est consigné ici
**And** aucun champ n'est ajouté ni retiré du modèle sans cette décision

### Story 29.15 : Un bouton clair pour créer son personnage depuis la partie

As a joueur qui rejoint une partie,
I want un bouton explicite « Créer mon personnage » sur l'écran de la partie,
So that je sache tout de suite par où commencer, sans deviner qu'une initiale est cliquable.

**Acceptance Criteria:**

**Given** je suis joueur d'une partie dont le système de jeu dispose d'un module, et je n'y ai pas encore de personnage
**When** j'ouvre le détail de la partie, sur téléphone comme sur ordinateur
**Then** un bouton « Créer mon personnage » est visible, sans changer d'onglet ni défiler
**And** il ouvre l'assistant de création de cette partie

**Given** j'ai déjà un personnage sur cette partie
**When** j'ouvre son détail
**Then** le bouton n'est pas affiché — il ne mène jamais à un refus « vous avez déjà un personnage »

**Given** la partie utilise un système de jeu sans module (indicateur de la story 29.17)
**When** j'ouvre son détail
**Then** aucun bouton de création n'est proposé

**Given** la partie est terminée
**When** j'ouvre son détail
**Then** aucun bouton de création n'est proposé — une aventure close n'accueille plus de personnage (arbitré au run UX du 2026-09-21 ; le serveur, lui, ne l'interdit pas)

**Given** je suis MJ de la partie
**When** j'ouvre son détail
**Then** aucun bouton de personnage joueur n'est proposé
**And** l'entrée de création du MJ est celle de son Homme Dragon (story 33.5) — un MJ n'a pas de personnage joueur, et a un Homme Dragon par aventure

**Given** le slot d'initiale du roster sur ordinateur
**When** il reste affiché
**Then** il conserve son comportement, mais n'est plus le seul point d'entrée

**Given** le bouton
**When** il est rendu
**Then** c'est un vrai lien ou bouton, atteignable au clavier, dont la cible mesure au moins 44 × 44 px
**And** son libellé vient de la micro-copie de thème, jamais codé en dur

*Règle écrite une seule fois :* « puis-je créer un personnage sur cette partie ? » (non-MJ · aucun personnage · système avec module · partie non terminée) est un prédicat partagé avec la story 29.16.

*Contrat UX :* `ux-designs/ux-jdr-master-2026-09-21/` (DESIGN.md, EXPERIENCE.md, planche `mockups/contrat-ui-entree-creation.html`) — un bloc d'invitation en tête de l'onglet Détails plutôt qu'un simple bouton, libellé thématisé `character.create_cta`, slot du rail conservé avec libellé accessible.

### Story 29.16 : Créer un personnage depuis « Personnages »

As a joueur,
I want retrouver, en haut de mes personnages, les aventures où il me reste à créer le mien,
So that la création soit là où je cherche mes personnages.

**Acceptance Criteria:**

**Given** je suis joueur de parties où je n'ai pas encore de personnage, et dont le système dispose d'un module
**When** j'ouvre « Personnages »
**Then** une section placée au-dessus de la liste propose une entrée par partie : « Créer un personnage pour *<nom de l'aventure>* »

**Given** une entrée de cette section
**When** je l'active
**Then** j'arrive sur l'assistant de création de cette partie

**Given** je n'ai aucune partie sans personnage
**When** j'ouvre « Personnages »
**Then** la section n'est pas rendue — jamais un bloc vide

**Given** cette section et la liste
**When** l'écran s'affiche
**Then** la section est visuellement distincte et ne contient aucune carte de personnage
**And** la liste ne contient toujours que mes personnages (story 29.2 inchangée)
**And** la recherche, le tri et le mode d'affichage de la liste ne la masquent ni ne la réordonnent

**Given** je viens de créer mon personnage sur une partie
**When** je reviens sur « Personnages »
**Then** l'entrée de cette partie a disparu et mon personnage figure dans la liste

**Given** une partie dont le système n'a pas de module, qui est terminée, ou dont je suis le MJ
**When** la section est calculée
**Then** elle n'y figure pas (sauf, pour le MJ, l'entrée Homme Dragon de la story 33.5)

**Given** cette section
**When** elle est rendue
**Then** chaque entrée est un vrai lien, atteignable au clavier, cible d'au moins 44 × 44 px
**And** elle réutilise le prédicat et la micro-copie de la story 29.15

*Temps réel :* à évaluer à la création de la story (canal `user:{id}`, `docs/checklist.md`) — le minimum requis est le rafraîchissement au retour de navigation.

*Contrat UX :* `ux-designs/ux-jdr-master-2026-09-21/` — section « À forger » au-dessus de la barre de contrôles (hors masquage au défilement), lignes en bordure pointillée (jamais des cartes), trois lignes puis « Voir les N autres », message de liste vide `my_characters.empty_with_entries` quand la section est affichée. ⚠️ amende le contrat du Palier 9 sur ce point (voir EXPERIENCE.md du delta).

### Story 29.17 : Seuls les systèmes jouables sont proposés à la création d'une partie

As a MJ qui crée une partie,
I want ne choisir qu'un système de jeu que l'application sait réellement faire jouer,
So that je ne crée pas une partie où personne ne pourra ensuite créer de personnage.

**Acceptance Criteria:**

**Given** le formulaire de création d'une partie
**When** je choisis le système de jeu
**Then** seuls les systèmes disposant d'un module sont proposés

**Given** une requête de création de partie portant un système sans module
**When** l'API la reçoit
**Then** elle la refuse avec un message explicite — le formulaire n'est pas la seule barrière

**Given** des parties déjà créées sur un système sans module
**When** je les ouvre
**Then** elles restent consultables et inchangées, sans migration
**And** aucune entrée de création de personnage n'y est offerte

**Given** l'indicateur de module sur les systèmes de jeu
**When** un nouveau système reçoit son module
**Then** il suffit d'y basculer l'indicateur pour qu'il devienne proposé — aucune autre liste à mettre à jour

**Given** un système sans module
**When** l'indicateur est lu par les stories 29.15 et 29.16
**Then** c'est la même source que celle du formulaire et du DTO

*Note :* le message d'erreur explicite du wizard sur un système sans module (correctif séparé, déjà ouvert) reste nécessaire — il protège les parties déjà créées.

---

## Epic 30 : Calendrier

L'utilisateur déclare ses disponibilités sans agacement — une sélection par glissement remplace quatre allers-retours — et le calendrier lui dit enfin où en sont ses séances, ses votes et ses inscriptions, sans qu'il ait à faire défiler vers un panneau caché.

*FR-33 et FR-34 ne sont pas des fonctionnalités séparées dans ce modèle : ce sont des couches. Elles vivent donc dans les stories de couches.*

### Story 30.1 : Retrait d'une réponse de vote

As a joueur,
I want retirer ma réponse à un vote de date, et pas seulement la changer,
So that je puisse redevenir « sans réponse » quand je ne sais plus.

**Acceptance Criteria:**

**Given** j'ai répondu sur un créneau d'un vote en cours
**When** je retire ma réponse
**Then** ma réponse sur ce créneau disparaît

**Given** j'ai retiré ma réponse
**When** l'agrégation du créneau est recalculée
**Then** je suis compté comme n'ayant pas répondu, exactement comme avant mon premier vote

**Given** je tente de retirer la réponse d'un autre membre
**When** j'émets la demande
**Then** elle est refusée

**Given** le vote comporte plusieurs créneaux
**When** je retire ma réponse sur l'un d'eux
**Then** mes réponses sur les autres créneaux sont intactes

**Given** l'action de clôture d'un sondage par le MJ
**When** elle s'exécute
**Then** elle reste inchangée et distincte du retrait d'une réponse

### Story 30.2 : Écriture groupée des disponibilités

As a utilisateur,
I want que déclarer plusieurs créneaux d'un coup ne produise qu'un seul enregistrement,
So that un geste unique ne déclenche pas une rafale de requêtes.

**Acceptance Criteria:**

**Given** je déclare N créneaux en une fois
**When** la déclaration part
**Then** elle est envoyée en un seul appel portant l'ensemble des créneaux
**And** aucune boucle d'appels n'est émise côté client

**Given** un lot de créneaux dont l'un entre en conflit avec une déclaration existante
**When** le lot est traité
**Then** aucun créneau du lot n'est enregistré
**And** l'erreur nomme le créneau fautif

**Given** un lot valide
**When** il est enregistré
**Then** l'écriture est transactionnelle
**And** je ne me retrouve jamais avec une semaine à moitié déclarée

**Given** la détection de conflits existante
**When** un lot est soumis
**Then** elle est appliquée à chaque créneau du lot avant toute écriture

### Story 30.3 : Sélection par glissement sur les grilles

As a utilisateur sur ordinateur,
I want sélectionner plusieurs jours et créneaux d'un seul geste,
So that déclarer une semaine d'absence cesse d'être une corvée.

**Acceptance Criteria:**

**Given** la vue semaine
**When** je glisse d'une cellule à une autre
**Then** tous les créneaux traversés sont sélectionnés
**And** une barre me propose de les déclarer disponibles ou indisponibles en une fois

**Given** la vue mois
**When** je glisse d'un jour à un autre
**Then** ce sont des journées entières qui sont sélectionnées, la finesse par créneau restant au tap

**Given** la vue semaine, quel que soit le support
**When** j'utilise l'application
**Then** le tap case par case reste pleinement fonctionnel et ouvre le panneau de déclaration comme auparavant

**Given** j'utilise un téléphone
**When** je veux amorcer une sélection multiple
**Then** elle démarre par un appui maintenu
**And** un glissement simple continue de faire défiler la page

**Given** je navigue au clavier
**When** je sélectionne une cellule puis étends la plage avec la touche majuscule et les flèches
**Then** la sélection s'étend
**And** la touche entrée valide la déclaration

**Given** une sélection en cours
**When** je l'annule
**Then** aucune déclaration n'est enregistrée

### Story 30.4 : Modèle de couches et préférences

As a utilisateur,
I want choisir ce que mon calendrier me montre,
So that je puisse me concentrer sur ce qui m'intéresse à ce moment-là.

**Acceptance Criteria:**

**Given** les six couches — mes indisponibilités, mes disponibilités, mes séances confirmées, les votes en cours, les inscriptions ouvertes, la disponibilité du groupe
**When** leurs clés sont validées
**Then** elles appartiennent à une union fermée déclarée dans le paquet partagé
**And** aucune clé libre n'est acceptée à l'écriture

**Given** un compte qui n'a jamais réglé ses couches
**When** il ouvre le calendrier
**Then** le jeu de couches par défaut s'applique
**And** le calendrier n'est jamais vide au premier usage

**Given** un utilisateur qui a volontairement tout éteint
**When** il revient
**Then** son choix est respecté et distinct de « jamais réglé »

**Given** je modifie mon jeu de couches par défaut depuis mes préférences
**When** je me connecte depuis un autre appareil
**Then** ce jeu s'applique

**Given** la couche « disponibilité du groupe »
**When** je consulte mon calendrier personnel
**Then** elle est simplement absente — elle n'a de sens que dans une partie

**Given** la couche « disponibilité du groupe » dans le calendrier d'une partie
**When** je suis un joueur de cette partie
**Then** la couche m'est proposée comme aux autres membres
**And** elle me montre des compteurs agrégés, sans identité
**And** je ne perds rien de la lecture agrégée dont je dispose aujourd'hui

**Given** cette même couche
**When** je suis le MJ de la partie
**Then** elle me montre la disponibilité par membre, nommément

**Given** les deux vues de créneaux existantes côté serveur
**When** la couche les expose
**Then** elle les réutilise telles quelles
**And** aucune troisième forme d'agrégation n'est introduite

### Story 30.5 : Endpoint unique du calendrier personnel

As a utilisateur,
I want que mon calendrier se charge d'un seul coup,
So that ajouter une couche demain n'ajoute pas une requête.

**Acceptance Criteria:**

**Given** une plage de dates
**When** le calendrier personnel se charge
**Then** un seul appel renvoie tout ce que les couches savent afficher
**And** aucun appel n'est émis par couche ni par partie

**Given** la charge utile renvoyée
**When** elle est sérialisée
**Then** elle est indexée par clé de couche
**And** une couche sans contenu porte un tableau vide, jamais une clé absente

**Given** une séance datée appartenant à une autre partie que celle consultée
**When** elle est renvoyée dans le calendrier d'une partie
**Then** elle n'apparaît que comme une indisponibilité du participant
**And** ni le nom de la partie, ni son scénario, ni ses participants ne transitent

**Given** mon calendrier personnel
**When** mes séances y sont renvoyées
**Then** elles sont explicites et légendées — toutes les séances y sont les miennes, la notion de partie tierce n'y existe pas

**Given** une séance dont la date est validée sans créneau propre
**When** son créneau est déterminé
**Then** il est lu sur le sondage rattaché, et vaut la journée entière à défaut

**Given** l'indisponibilité dérivée d'une séance
**When** elle est injectée
**Then** elle l'est dans le calcul de statut par membre, avant la séparation entre la vue du MJ et celle des joueurs
**And** les deux vues s'accordent sur le même créneau

**Given** une séance à laquelle je ne participe pas et une partie dont je ne suis pas membre
**When** je consulte n'importe quel calendrier
**Then** rien de cette partie ne m'est renvoyé

### Story 30.6 : Les couches à l'écran et la vue Agenda

As a utilisateur,
I want allumer et éteindre ce que je vois, et disposer d'une vue chronologique,
So that je sache où j'en suis sans reconstruire l'information moi-même.

**Acceptance Criteria:**

**Given** le calendrier
**When** je l'affiche
**Then** trois présentations des mêmes couches sont disponibles : Mois, Semaine et Agenda

**Given** la vue Agenda
**When** je l'ouvre
**Then** elle liste chronologiquement les couches actives — séances à venir, votes en cours, inscriptions ouvertes, mes déclarations

**Given** j'éteins ou j'allume une couche en cours de visite
**When** je quitte puis reviens plus tard
**Then** mon jeu par défaut est rétabli
**And** ma bascule de visite n'est pas devenue mon nouveau défaut

**Given** l'affichage courant s'écarte de mon défaut
**When** je regarde l'écran
**Then** une pastille me le signale et me propose de rétablir

**Given** l'ancien panneau « voir les créneaux calculés »
**When** l'épic est livré
**Then** il n'existe plus comme panneau séparé atteint par un bouton de défilement
**And** son contenu est devenu une couche affichable dans les trois vues

**Given** un vote de date en cours sur une partie, et la couche « votes en cours » allumée
**When** j'ouvre le calendrier **de cette partie**
**Then** les créneaux proposés par le vote y apparaissent
**And** ils sont distingués de mes propres déclarations
**And** aucun appel supplémentaire n'est émis pour les obtenir — le sondage de la partie les renvoie déjà

**Given** j'éteins la couche de mes indisponibilités
**When** un créneau bloqué n'apparaît plus
**Then** la pastille d'écart au défaut reste visible pour me rappeler que l'écran ne montre pas tout

---

## Epic 31 : Fiche de personnage

Un joueur lit sa fiche sans avoir le livre à côté, consulte celles de ses compagnons, et le MJ décide de ce qui reste caché. Les exports quittent le premier plan.

*Les stories 31.6 et 31.7 forment la paire extractible : le PRD désigne FR-23 comme le premier candidat à sortir si le périmètre doit être resserré.*

### Story 31.1 : Exports regroupés dans le menu de la fiche

As a joueur,
I want que les boutons d'export cessent d'occuper le haut de ma fiche,
So that la vue principale montre mon personnage et non des actions que j'utilise rarement.

**Acceptance Criteria:**

**Given** la fiche d'un personnage
**When** je l'ouvre sur téléphone
**Then** aucune action d'export n'occupe la vue principale

**Given** le menu de la fiche
**When** je l'ouvre
**Then** j'y trouve les cinq actions : fiche éditable, fiche deux pages, équipement, notes, et recadrage du portrait pour le PDF

**Given** je déclenche un export depuis le menu
**When** l'action aboutit
**Then** le fichier produit est identique à celui que produisait l'ancien bouton

### Story 31.2 : Surface de détail adaptative

As a joueur,
I want lire le texte d'un talent sans quitter ma fiche ni la voir se déplacer sous mes yeux,
So that je garde mes repères pendant que je lis.

**Acceptance Criteria:**

**Given** un élément de ma fiche portant un texte descriptif — avantage, talent
**When** je l'active
**Then** son texte s'ouvre dans une surface de détail

**Given** j'utilise un ordinateur
**When** la surface s'ouvre
**Then** elle apparaît en panneau latéral
**And** la fiche reste entièrement visible et ne se déplace pas

**Given** j'utilise un téléphone
**When** la surface s'ouvre
**Then** elle monte depuis le bas et se referme d'un geste

**Given** la surface est ouverte sur un élément
**When** j'en active un autre
**Then** son contenu est remplacé, sans empiler les panneaux

**Given** un élément dont le texte est court et qui reste en place
**When** la conception de l'écran le justifie explicitement
**Then** un dépliant en place est admis comme exception documentée
**And** il n'est jamais le comportement par défaut

### Story 31.3 : Aide contextuelle sur les termes de jeu

As a joueur débutant,
I want comprendre un terme du système sans ouvrir le livre,
So that je puisse jouer sans interrompre la partie pour poser une question.

**Acceptance Criteria:**

**Given** un terme de règle affiché sur ma fiche ou dans l'assistant — classe, spécialité, option
**When** je l'active
**Then** son texte explicatif s'affiche dans la surface de détail

**Given** ces textes
**When** ils sont chargés
**Then** ils proviennent du catalogue déjà seedé
**And** aucun texte de règle n'est écrit en dur dans le registre de thèmes

**Given** un terme dont le catalogue ne porte aucun texte
**When** je l'active
**Then** l'application ne propose pas d'aide plutôt que d'afficher un contenu vide

### Story 31.4 : Refonte du parcours de création de personnage

As a joueur qui crée son personnage,
I want un parcours plus lisible et moins bavard en gestes,
So that la création cesse d'être une épreuve avant la première partie.

**Acceptance Criteria:**

**Given** l'assistant de création
**When** je le parcours de bout en bout
**Then** chaque étape est lisible sur téléphone sans défilement horizontal

**Given** une étape offrant des choix
**When** elle s'affiche
**Then** les textes explicatifs déjà seedés y sont accessibles par la surface de détail

**Given** le personnage créé par le parcours refondu
**When** il est enregistré
**Then** il est en tout point équivalent à celui que produisait l'ancien parcours

### Story 31.5 : Consultation des fiches des compagnons

As a joueur,
I want consulter la fiche des autres personnages de ma partie,
So that je sache de quoi mon groupe est capable sans demander à chacun.

**Acceptance Criteria:**

**Given** je suis membre d'une partie
**When** j'ouvre la liste de ses personnages
**Then** tous les personnages de la partie y figurent, pas seulement les miens

**Given** la fiche d'un compagnon
**When** je l'ouvre
**Then** je la consulte en lecture seule

**Given** les notes personnelles d'un compagnon
**When** je consulte sa fiche
**Then** elles restent régies par leur mécanisme existant, inchangé

**Given** une partie dont je ne suis pas membre
**When** je tente d'accéder à un de ses personnages
**Then** l'accès est refusé

### Story 31.6 : Cadenas de visibilité — modèle et filtrage serveur

As a MJ,
I want que ce que je verrouille ne parte jamais vers le navigateur d'un joueur,
So that l'anti-spoil ne se contourne pas en ouvrant les outils de développement.

**Acceptance Criteria:**

**Given** une partie neuve
**When** aucune configuration n'a été posée
**Then** rien n'est verrouillé et tout reste visible

**Given** le schéma de fiche du système de jeu
**When** il déclare ce qui est verrouillable
**Then** il le fait par une propriété dédiée, distincte de celle qui décrit déjà les composantes d'une clé
**And** chaque clé est verrouillable en bloc, une clé de type objet pouvant en plus déclarer ses sous-champs

**Given** un champ verrouillé
**When** un autre joueur consulte la fiche
**Then** la clé est **absente** de la réponse, jamais présente à vide ou à nul
**And** la réponse porte la liste de ce qui a été retiré, pour distinguer « masqué » de « non renseigné »

**Given** une valeur calculée dérivant d'un champ verrouillé
**When** la fiche est sérialisée
**Then** elle est retirée par le même passage
**And** le masquage n'est pas trahi par le calcul

**Given** un joueur demande l'export PDF de la fiche d'un compagnon
**When** le fichier est produit
**Then** les champs verrouillés n'y figurent pas

**Given** le propriétaire de la fiche, ou le MJ de la partie
**When** ils consultent la fiche
**Then** ils la voient entière, aucun filtrage ne leur est appliqué

**Given** le point de sérialisation de la fiche
**When** le filtrage est implémenté
**Then** il est appliqué à cet unique endroit
**And** le masque lui est passé par l'appelant, sans lecture de base à l'intérieur

### Story 31.7 : Écran de configuration des cadenas

As a MJ,
I want cocher ce que mes joueurs ne doivent pas voir sur une fiche type,
So that je règle l'anti-spoil une fois pour toute ma partie.

**Acceptance Criteria:**

**Given** je suis MJ d'une partie
**When** j'ouvre l'écran de configuration de visibilité
**Then** il présente une fiche type dont les éléments verrouillables sont ceux déclarés par le schéma du système de jeu
**And** aucune liste n'est écrite en dur dans l'écran

**Given** je verrouille des éléments et j'enregistre
**When** la configuration est sauvegardée
**Then** elle s'applique à **tous** les personnages de la partie

**Given** un joueur de la partie
**When** il tente d'ouvrir cet écran
**Then** l'accès est refusé

**Given** la configuration d'une partie
**When** un joueur reçoit les données de cette partie
**Then** la configuration elle-même ne lui est jamais transmise

---

## Epic 32 : Vue de partie et chronologie

Le contenu d'une partie cesse d'être un fouillis : l'action immédiate, la consultation et la référence se séparent, et la chronologie rend enfin lisible l'enchaînement des scénarios et de leurs séances — sans jamais trahir l'existence d'un brouillon.

*Point de vigilance : le service qui liste les scénarios ne filtre aucun statut. L'anti-spoil est un rendu frontend par décision explicite du Palier 4 — ce filtrage n'est jamais redondant et ne doit pas être supprimé comme tel.*

### Story 32.1 : Autocomplétion des invitations

As a MJ,
I want que la saisie me propose les joueurs déjà inscrits au fil de la frappe,
So that je n'aie pas à connaître par cœur l'orthographe exacte d'un pseudo.

**Acceptance Criteria:**

**Given** je saisis le début d'un pseudo dans le champ d'invitation
**When** ma saisie atteint la longueur minimale retenue
**Then** les utilisateurs dont le pseudo correspond me sont proposés

**Given** les résultats proposés
**When** ils sont renvoyés
**Then** ils ne portent que le pseudo
**And** aucune adresse e-mail n'y figure, ni n'est utilisée comme critère de recherche

**Given** une saisie plus courte que la longueur minimale
**When** je tape
**Then** aucune requête n'est émise

**Given** une saisie correspondant à de nombreux utilisateurs
**When** les résultats sont renvoyés
**Then** leur nombre est plafonné

**Given** l'invitation par adresse e-mail exacte
**When** je l'utilise
**Then** son chemin actuel est inchangé

### Story 32.2 : Réorganisation de la vue de partie

As a membre d'une partie,
I want que la page de ma partie hiérarchise ce que j'ai à faire, ce que je consulte et ce à quoi je me réfère,
So that je cesse de chercher l'information dans une juxtaposition sans ordre.

**Acceptance Criteria:**

**Given** la vue d'une partie
**When** je l'ouvre
**Then** ce qui appelle une action de ma part est distingué de ce qui relève de la consultation et de la référence

**Given** les fonctionnalités arrivées au fil des paliers — rôles de groupe, distribution d'XP, gestion des membres, rappels par e-mail
**When** la vue est livrée
**Then** chacune a une place assumée et documentée dans la nouvelle hiérarchie
**And** aucune n'a disparu sans décision explicite

**Given** j'ouvre la vue sur téléphone
**When** elle s'affiche
**Then** ce qui appelle une action est visible sans défilement

**Given** je suis joueur, et non MJ
**When** j'ouvre la vue
**Then** les actions réservées au MJ ne me sont pas proposées

### Story 32.3 : États de scénario et de séance

As a membre d'une partie,
I want savoir d'un coup d'œil où en est chaque scénario et chaque séance,
So that je n'aie pas à reconstruire l'état de la campagne dans ma tête.

**Acceptance Criteria:**

**Given** les quatre états de scénario et les six états de séance
**When** ils s'affichent
**Then** ils se partagent quatre teintes seulement
**And** l'état précis est toujours porté par un libellé

**Given** une séance en vote à laquelle je n'ai pas répondu, et une séance en vote à laquelle j'ai répondu
**When** elles s'affichent toutes deux
**Then** elles portent deux libellés distincts
**And** la distinction ne repose pas sur la seule différence de teinte

**Given** un scénario en brouillon, vu par son MJ
**When** il s'affiche
**Then** il est signalé par un contour tireté, un traitement de forme et non de teinte
**And** il reste identifiable par quelqu'un qui distingue mal les couleurs

**Given** une séance dont la date approche
**When** elle s'affiche
**Then** son badge se densifie à mesure que la date se rapproche
**And** le libellé devient humain la veille et le jour même

**Given** une séance passée dont le compte-rendu n'est pas rédigé
**When** elle s'affiche
**Then** elle bascule dans la teinte de ce qui réclame une action

### Story 32.4 : Refonte de la chronologie

As a joueur,
I want comprendre l'enchaînement des scénarios en regardant la chronologie,
So that je sache ce qui a été joué, ce qui se joue et ce qui vient.

**Acceptance Criteria:**

**Given** la chronologie d'une campagne
**When** elle s'affiche
**Then** chaque nœud est ancré sur la ligne chronologique
**And** les dates sont affichées
**And** les scénarios sont espacés de façon lisible

**Given** un scénario de la chronologie
**When** je le regarde
**Then** son état et ses séances sont lisibles sans l'ouvrir

**Given** je suis joueur et la partie comporte un scénario en brouillon
**When** j'affiche la chronologie
**Then** elle s'arrête au dernier scénario publié
**And** aucun espace vide, aucun nœud fantôme, aucun compteur ne trahit l'existence du brouillon

**Given** le MJ de cette même partie
**When** il affiche la chronologie
**Then** il voit son brouillon, distinctement marqué comme non publié
**And** son compteur d'en-tête diffère de celui du joueur, ce qui est le comportement attendu

**Given** le filtrage des scénarios non publiés
**When** il est implémenté
**Then** il est appliqué à l'affichage
**And** il n'est jamais retiré au motif qu'un filtrage serveur le rendrait redondant — celui-ci n'existe pas

---

## Epic 33 : Homme Dragon

Le MJ crée et consulte son Homme Dragon avec le même soin qu'une fiche de personnage joueur, et retrouve en séance les souffles dont son dragon dispose sans rouvrir le livre.

*Q-13 corrigée le 2026-09-25 : les six entrées seedées sont les éveils ; les 21 souffles (9 communs, 12 de race) sont seedés par la 33.2. Référence des règles : `docs/dragons.md`. Aucun décompte pendant la séance ; la réserve de souffles de l'Homme Dragon, composée une fois sur sa fiche, est portée par la 33.6. Le niveau compte les scénarios `PASSE` (décision du 2026-09-25).*

### Story 33.1 : Fiche Homme Dragon refondue

As a MJ,
I want une fiche d'Homme Dragon aussi soignée que celle de mes joueurs,
So that je cesse d'avoir l'impression que ma propre fiche est le parent pauvre de l'application.

**Acceptance Criteria:**

**Given** la fiche de mon Homme Dragon
**When** je l'ouvre sur téléphone
**Then** sa mise en page suit les mêmes principes que celle d'un personnage joueur
**And** aucune information n'y est tronquée

**Given** les éléments de la fiche portant un texte descriptif
**When** je les active
**Then** ils s'ouvrent dans la même surface de détail que sur une fiche joueur

**Given** les données de mon Homme Dragon
**When** la fiche refondue est livrée
**Then** aucune information présente sur l'ancienne fiche n'a disparu

**Given** l'identité affichée sur la fiche
**When** elle est rendue
**Then** elle suit la convention joueur / personnage établie à l'épic 28

### Story 33.2 : Les souffles de mon dragon

As a MJ en pleine séance,
I want voir les souffles dont mon dragon dispose et ce qu'ils font,
So that je les utilise sans interrompre la partie pour ouvrir le livre.

**Acceptance Criteria:**

**Given** le catalogue des souffles
**When** il est seedé
**Then** il distingue les souffles **communs** de ceux **propres à une race de dragon**
**And** la race est portée par le même mécanisme que celui du catalogue d'artefacts, déjà en place

**Given** mon Homme Dragon est d'une race donnée
**When** j'ouvre sa fiche
**Then** j'y vois les souffles communs **et** ceux de sa race
**And** je n'y vois pas ceux des trois autres races
**And** à partir du niveau 3, les souffles des trois autres races sont aussi consultables, dans un bloc replié (souffles multicolores)

**Given** un souffle affiché
**When** je le regarde
**Then** son coût en points de souffle est visible
**And** sa description est accessible sans quitter la fiche

**Given** le contenu seedé
**When** une story de contenu est relue
**Then** la complétude des souffles par race est vérifiée en revue
**And** aucune garde au runtime ne rejette un catalogue incomplet — même discipline que les rôles de groupe du Palier 8

**Given** l'utilisation d'un souffle en séance
**When** elle a lieu
**Then** l'application n'en garde aucune trace — aucun décompte, aucune consommation n'est suivie

**Given** un souffle retiré ou renommé dans le catalogue
**When** le contenu est re-seedé
**Then** les fiches existantes restent lisibles

### Story 33.3 : Formulaire de création guidé

As a MJ qui crée son Homme Dragon,
I want un vrai formulaire accompagné d'explications,
So that je comprenne mes choix au lieu de les subir.

**Acceptance Criteria:**

**Given** je crée un Homme Dragon
**When** le parcours démarre
**Then** il se présente comme un formulaire guidé, et non comme une saisie brute

**Given** une étape offrant un choix — race, artefact
**When** elle s'affiche
**Then** un texte explicatif l'accompagne

**Given** je choisis une race
**When** les artefacts me sont proposés
**Then** seuls ceux de cette race le sont

**Given** l'Homme Dragon créé par le parcours refondu
**When** il est enregistré
**Then** il est en tout point équivalent à celui que produisait l'ancien parcours

**Given** une étape de choix ou un champ du parcours
**When** il s'affiche
**Then** son texte vient du catalogue (`homme-dragon-creation-intros.json`, `homme-dragon-races.json` enregistrés dans `CONTENT_TYPES`), préférences de la race comprises

*UX de référence :* `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md` et `EXPERIENCE.md` (passe `bmad-ux` du 2026-09-23) — parcours en 5 écrans (Race, Artefact, Identité, Vie de l'Homme Dragon, Avatar), teinte de race par carte (liséré + gemme + lueur de coin, DESIGN.md §2/§7), rattrapage vers les champs Material déjà prévus par le spine de base. Mocks de référence : `mockups/key-race-step.html`, `mockups/key-identite-step.html`.

### Story 33.4 : Export PDF au niveau des fiches joueur

As a MJ,
I want un export d'Homme Dragon aussi soigné que celui des fiches joueur,
So that ma fiche imprimée soit utilisable à la table.

**Acceptance Criteria:**

**Given** ma fiche d'Homme Dragon
**When** je l'exporte en PDF
**Then** le rendu atteint le même niveau que l'export d'une fiche de personnage joueur

**Given** les souffles disponibles pour mon dragon
**When** l'export est produit
**Then** ils y figurent avec leur coût, lus depuis le catalogue `souffle` (les éveils restent listés à part)
**And** si une réserve existe (33.6), elle y est imprimée (cases `souffle_1`..`souffle_4`)

**Given** les champs de souffle du modèle de PDF
**When** ils sont remplis
**Then** la valeur maximale reflète le niveau de l'Homme Dragon
**And** aucun champ ne prétend suivre une consommation que l'application ne suit pas

### Story 33.5 : Mes Hommes Dragons dans « Personnages »

As a MJ,
I want retrouver mon Homme Dragon dans « Personnages » et pouvoir l'y créer,
So that mon dragon soit aussi facile à atteindre que les personnages de mes joueurs.

**Acceptance Criteria:**

**Given** je suis MJ de parties Ryuutama où j'ai créé un Homme Dragon
**When** j'ouvre « Personnages »
**Then** chacun apparaît dans la liste, avec la partie dont il provient
**And** sa nature (Homme Dragon, et non personnage joueur) se lit sans l'ouvrir

**Given** un Homme Dragon listé
**When** je l'ouvre
**Then** j'arrive sur sa fiche

**Given** une aventure Ryuutama dont je suis MJ et où je n'ai pas encore d'Homme Dragon (un par aventure — le même dragon utilisé sur plusieurs aventures est hors périmètre)
**When** j'ouvre « Personnages »
**Then** la section de création de la story 29.16 propose « Créer un Homme Dragon pour *<nom de l'aventure>* »
**And** elle m'amène sur le parcours de création de l'Homme Dragon

*Révisé par la 33.8 (AD-23, 2026-10-04) : « un par aventure » n'est plus une règle de modèle. La liste montre un Homme Dragon une seule fois, avec ses aventures ; l'entrée de création reste proposée pour une aventure qui n'en a pas. L'AC de départ est conservé tel quel : il décrit ce qui a été livré.*

**Given** la liste contenant des Hommes Dragons
**When** j'utilise la recherche, le tri ou le mode d'affichage
**Then** ils s'appliquent aux Hommes Dragons comme aux personnages
**And** leur nom suit la convention d'identité de l'épic 28

**Given** une partie dont je ne suis pas le MJ
**When** « Personnages » est calculé
**Then** l'Homme Dragon de son MJ n'y figure jamais

### Story 33.6 : Réserve de souffles

As a MJ qui prépare ma séance,
I want composer sur la fiche de mon Homme Dragon sa réserve de souffles, une seule fois,
So that elle soit mémorisée et imprimée dans l'export PDF sans que je la refasse à chaque séance.

**Acceptance Criteria:**

**Given** mon Homme Dragon est au niveau 1
**When** j'ouvre sa fiche
**Then** la section « Réserve de souffles » affiche seulement la ligne d'information « La réserve de souffles s'ouvre au niveau 2. »
**And** aucun emplacement, aucun composeur et aucun bouton n'est proposé
**And** le serveur refuse toute écriture de réserve

**Given** mon Homme Dragon est au niveau N, de 2 à 5
**When** j'ouvre sa fiche
**Then** la section « Réserve de souffles » figure dans la colonne gauche, juste avant la carte « Souffles »
**And** elle affiche N − 1 emplacements numérotés, tous visibles, vides ou remplis, sous le titre « Niveau N · N − 1 emplacements » (au singulier au niveau 2 : « Niveau 2 · 1 emplacement »)
**And** il n'existe qu'une seule réserve par Homme Dragon : aucune réserve n'est attachée à une séance et aucun écran de séance n'est modifié

**Given** un emplacement vide
**When** je le touche, choisis un souffle dans la fenêtre « Choisir un souffle pour l'emplacement N » puis valide « Mettre dans l'emplacement N »
**Then** le souffle occupe cet emplacement, la fenêtre se ferme et la réserve est enregistrée
**And** un même souffle commun ou de ma race peut occuper plusieurs emplacements, la fenêtre l'indiquant par le repère non bloquant « Déjà dans l'emplacement N »
**And** sur un emplacement rempli, « Changer » rouvre la fenêtre et le souffle choisi remplace l'ancien

**Given** la fenêtre de choix ouverte
**When** elle liste les souffles
**Then** tous les souffles restent listés et consultables, par catégorie repliable (communs par famille, souffles de ma race, souffles des autres races, souffles rituels) : dépliées par défaut, sauf les catégories où rien n'est choisissable, repliées avec leur raison écrite à côté du titre
**And** les souffles du temps (Passé, Futur) sont grisés avec la raison « Non réservable : souffle du temps », jamais masqués, et le serveur les refuse
**And** une ligne grisée se consulte (sa description et sa raison s'affichent dans la zone de détail) mais ne se place pas : « Mettre dans l'emplacement N » reste visible, inactif, avec la raison liée

**Given** mon Homme Dragon est au niveau 2
**When** j'ouvre la fenêtre de choix
**Then** les souffles des autres races sont grisés avec une raison écrite et aucun ne peut être placé

**Given** mon Homme Dragon est au niveau 3 ou plus
**When** je place un souffle d'une autre race
**Then** il n'occupe qu'un seul emplacement et le serveur refuse de le placer une seconde fois
**And** les autres souffles d'une autre race sont grisés avec la raison « Un seul souffle d'une autre race », et le souffle placé indique « Déjà dans l'emplacement N »
**And** l'emplacement qui le contient reste modifiable (« Changer », « Retirer »)

**Given** mon Homme Dragon est au niveau 5
**When** je compose la réserve
**Then** les souffles rituels peuvent y figurer, sans compter comme souffle d'une autre race
**And** avant le niveau 5, ils sont grisés avec la raison « Admis dès le niveau 5 » et le serveur les refuse

**Given** une demande d'écriture de la réserve, quel qu'en soit l'auteur
**When** le serveur la reçoit
**Then** seul le MJ de la partie est admis, pour Ryuutama uniquement
**And** le niveau est recalculé côté serveur et toute la composition résultante est revalidée contre les catalogues `souffle` et `souffleRituel` : capacité N − 1, souffles du temps exclus, au plus un souffle d'une autre race (sur un seul emplacement) dès le niveau 3, rituels dès le niveau 5, souffle inconnu du catalogue refusé
**And** une demande invalide est rejetée sans rien écrire
**And** la réserve ne peut pas être écrite par la modification générale de la fiche

**Given** un joueur de la partie (membre, non MJ)
**When** il appelle la lecture de la fiche de l'Homme Dragon (`GET /parties/:id/homme-dragon`)
**Then** le serveur la refuse (`403`), sans aucune donnée de la fiche ni de la réserve

**Given** un joueur de la partie (membre, non MJ)
**When** il appelle l'export PDF de la fiche de l'Homme Dragon
**Then** le serveur le refuse (`403`) et ne produit aucun PDF

*Révisé par la 33.8 (AD-23, 2026-10-04) : la lecture et l'export passent par `/homme-dragons/:id`, gardés par le propriétaire de l'Homme Dragon ; tout autre appelant reçoit `404`, jamais `403` (l'existence ne fuit pas). L'intention — aucun accès d'un joueur — est inchangée.*

**Given** un joueur de la partie
**When** il parcourt l'application (partie, « Personnages »)
**Then** il ne voit aucune fiche d'Homme Dragon ni section « Réserve de souffles » (garde web existante conservée)
**And** le MJ continue de lire et d'exporter sa fiche comme avant, réserve comprise

**Given** je choisis, change ou retire un souffle
**When** le geste est fait
**Then** il est enregistré immédiatement, sans bouton « Enregistrer »
**And** un seul enregistrement est en vol : pendant l'attente, les boutons d'emplacement sont inactifs (`aria-disabled="true"`), la liste est `aria-busy="true"` et la mention devient « Enregistrement… »
**And** à la réussite, la mention « Enregistrée automatiquement, utilisée pour l'export PDF. » s'affiche sous le titre de la section et la zone de statut annonce « Réserve enregistrée »

**Given** l'enregistrement d'un geste échoue
**When** l'échec est signalé
**Then** le message « Impossible d'enregistrer la réserve. Réessayez. » s'affiche (`role="alert"`, ré-annoncé à chaque échec)
**And** l'emplacement revient à son état précédent : rien n'est vidé ni écrasé
**And** la mention d'enregistrement est masquée tant que l'erreur est affichée

**Given** un emplacement rempli
**When** je touche « Retirer »
**Then** l'emplacement est vidé aussitôt, sans dialogue de confirmation
**And** un bandeau « <Souffle> retiré de l'emplacement N. » accompagné d'un bouton « Annuler » reste affiché quelques secondes (durée à fixer à l'implémentation, 6 s en valeur d'exemple), le décompte étant suspendu tant que le focus ou le survol est sur le bandeau
**And** si l'écriture du retrait échoue, l'emplacement revient à son état précédent et aucun bandeau n'apparaît

**Given** le bandeau d'annulation affiché
**When** j'active « Annuler » (inactif tant que l'écriture du retrait n'est pas terminée)
**Then** le souffle retourne dans le même emplacement, le bandeau disparaît et la zone de statut annonce « <Souffle> remis dans l'emplacement N »
**And** si l'annulation échoue, le message d'erreur habituel s'affiche et l'emplacement reste vide
**And** le bandeau disparaît si l'emplacement est entre-temps occupé, et un nouveau retrait remplace le message (seul le dernier retrait est annulable)
**And** aucun bouton « Vider la réserve » n'existe

**Given** une réserve composée
**When** la séance a lieu ou que j'exporte la fiche
**Then** l'application ne décompte rien : aucun compteur « utilisé » ou « restant », aucun souffle marqué comme consommé

**Given** une réserve composée au niveau N
**When** mon Homme Dragon passe au niveau N + 1
**Then** la réserve existante est conservée et le nouvel emplacement apparaît vide

**Given** une réserve contenant un souffle retiré du catalogue
**When** elle s'affiche
**Then** la ligne reste lisible, son libellé étant la clé brute
**And** elle reste retirable, et « Changer » reste possible

**Given** une réserve composée
**When** j'exporte la fiche en PDF, dans le format éditable comme dans le format 2 pages
**Then** `souffle_1` à `souffle_4` portent le nom du souffle (sans son coût) de l'emplacement de même numéro
**And** un emplacement vide, ou une réserve vide, laisse sa case vide
**And** `nombre_souffles` reste égal à `max(niveau − 1, 0)` et `souffle_actuel` reste vide

**Given** la fenêtre de choix, qui réutilise `DetailSurface`
**When** `DetailSurface` est étendu (emplacements `header` et `footer` personnalisables, hauteur en `dvh` avec zone sûre, `max-height` propre de la zone de détail, bouton de fermeture de 44 px nommé « Fermer la fenêtre » ou « Fermer la feuille », largeur desktop adaptée par usage, `prefers-reduced-motion` respecté)
**Then** la fenêtre est utilisable à 320 × 256 px CSS : en-tête et pied compacts, liste défilante visible, zone de détail à défilement propre
**And** l'extension est rétro-compatible : tous les autres usages de `DetailSurface` sont re-vérifiés (specs relues, passe visuelle mobile et desktop : fermeture à 44 px, focus, mouvement réduit) sans régression

**Given** une navigation au clavier dans la section et la fenêtre
**When** je place ou change un souffle, je retire un souffle, j'annule la fenêtre (« Annuler », Échap ou ✕) ou j'annule un retrait
**Then** une fois le rendu terminé, le focus est sur la cible prévue : « Changer » de l'emplacement après un placement ou un changement, « Choisir un souffle » de l'emplacement après un retrait, « Changer » de l'emplacement rétabli après l'annulation d'un retrait, le déclencheur d'origine après « Annuler », Échap ou ✕ ; jamais sur `<body>`
**And** des tests clavier vérifient chacun de ces cas

**Given** la section et la fenêtre de choix
**When** je les parcours au clavier ou au lecteur d'écran
**Then** chaque ligne de souffle est un `<button>` natif tabulable (Entrée ou Espace pour consulter, `aria-pressed` sur la ligne consultée) et chaque ligne grisée est `aria-disabled="true"` tout en restant focalisable
**And** chaque en-tête de catégorie porte `aria-expanded` et `aria-controls`
**And** une zone `role="status"` persistante annonce les placements, retraits, annulations et enregistrements

**Given** mon Homme Dragon est au niveau 5
**When** la carte « Souffles rituels » (33.7) s'affiche
**Then** elle reste un catalogue de consultation, et sa consigne n'affirme plus « sans réserve ni décompte » : elle indique que ces souffles peuvent être placés dans la réserve, sans décompte

*Décisions du 2026-10-02 (passe UX, `ux-designs/ux-jdr-master-2026-10-01/`) :* une seule réserve par Homme Dragon, sur sa fiche (la réserve par séance et la réserve par défaut du 2026-09-29 sont abandonnées) ; « Vider la réserve » retiré ; annulation temporaire du dernier retrait ; un souffle d'une autre race n'occupe qu'un emplacement ; niveau qui baisse : aucune règle spécifique ; `DetailSurface` étendu de façon rétro-compatible. *Décisions du 2026-09-29 conservées :* réserve visible du MJ seul ; souffles rituels admis dès le niveau 5. *Prérequis :* 33.7 (catalogue des souffles rituels : levé). *Hors AC :* le câblage temps réel multi-appareil de la fiche (signal `changed` / `notifyChanged()` de la partie, `RealtimeService`) est à évaluer à l'implémentation selon `docs/checklist.md`. *Option B2 (2026-10-02) :* la fiche de l'Homme Dragon et son export PDF sont réservés au MJ (la garde de lecture passe de `getViewable` à `getOwned`) ; les specs API qui supposaient la lecture par un membre sont à renverser (sprint change 2026-10-02, §4.9). *À la livraison :* tenir à jour le README du PDF, `docs/dragons.md` et `deferred-work.md`, et renverser les tests qui figent « `souffle_1`..`souffle_4` jamais remplis » (sprint change 2026-10-02, §4.5 et §4.6). *Recommandation :* exprimer les règles de composition (capacité, quota, rituels) en fonctions pures de `packages/game-rules`, partagées par la validation serveur et le grisage web, plutôt que de dupliquer une troisième fois la règle de disponibilité (cf. `deferred-work.md`). *Revues :* mode plan avant la story, puis `/security-review` et `/code-review`.

### Story 33.7 : Capacités de niveau

As a MJ,
I want voir ce que mon dragon a gagné en montant de niveau et choisir son artefact cadeau,
So that je sache ce dont il est capable sans rouvrir le livre.

**Acceptance Criteria:**

**Given** mon Homme Dragon au niveau N
**When** j'ouvre sa fiche
**Then** les capacités acquises jusqu'au niveau N sont listées avec leur description (catalogue `homme-dragon-level-capacities.json` enregistré dans `CONTENT_TYPES`)

**Given** mon Homme Dragon atteint le niveau 4
**When** je choisis son artefact cadeau
**Then** seuls les artefacts des trois autres races me sont proposés
**And** une fois enregistré, le choix ne peut plus être modifié
**And** l'artefact cadeau apparaît sur la fiche à côté de l'artefact principal

**Given** mon Homme Dragon atteint le niveau 5
**When** j'ouvre sa fiche
**Then** les souffles rituels (catalogue `souffles-rituels.json`, enregistré sous la clé `souffleRituel`) sont consultables, avec leur description et le même coût que les autres souffles (1 PS)

**Given** un Homme Dragon sous le niveau 4
**When** sa fiche s'affiche
**Then** aucun choix d'artefact cadeau n'est proposé

### Story 33.8 : Un Homme Dragon pour plusieurs aventures

*Architecture faite le 2026-10-04 (AD-23, spine du Palier 9 ; AD-22 réécrit). Story lourde : migration, routes, front, PDF — la découpe éventuelle se décide à la planification.*

As a MJ,
I want que mon Homme Dragon suive plusieurs groupes et plusieurs mondes,
So that son histoire et son niveau reflètent toutes les aventures qu'il a racontées.

**Acceptance Criteria:**

**Given** un Homme Dragon dont je suis propriétaire et une aventure Ryuutama dont je suis MJ, sans Homme Dragon
**When** je l'associe à cette aventure
**Then** il y apparaît comme Homme Dragon de cette aventure
**And** son historique et son niveau cumulent les scénarios `PASSE` de toutes ses aventures, chaque entrée d'historique portant son aventure

**Given** une aventure qui a déjà un Homme Dragon
**When** j'en associe un autre
**Then** le serveur refuse (`409`) et ne remplace rien
**And** je dois d'abord dissocier le premier

**Given** un Homme Dragon associé à une aventure
**When** je le dissocie
**Then** l'aventure n'a plus d'Homme Dragon et son niveau est recalculé, il peut baisser
**And** aucun éveil, artefact cadeau ni souffle de la réserve n'est supprimé : ce qui dépasse le niveau reste lisible et seuls les nouveaux choix sont refusés
**And** je peux toujours retirer un souffle de la réserve, quel que soit le niveau

**Given** un Homme Dragon qui n'est pas le mien, ou qui n'existe pas
**When** je le lis, l'écris, l'exporte ou l'associe
**Then** la réponse est la même (`404`) dans les deux cas, sans aucune donnée
**And** un joueur de l'aventure n'y a accès ni dans l'application ni par l'API

**Given** un Homme Dragon associé à deux aventures
**When** j'ouvre « Personnages »
**Then** il apparaît une seule fois, avec ses deux aventures
**And** l'ouvrir m'amène sur sa fiche, qui présente les voyageurs protégés **par aventure**

**Given** un Homme Dragon associé à une aventure
**When** cette aventure est supprimée
**Then** l'Homme Dragon subsiste, sans aventure, et reste accessible dans « Personnages »
**And** son niveau est recalculé sur ses aventures restantes

**Given** une aventure portant un Homme Dragon
**When** son système de jeu change
**Then** l'Homme Dragon en est dissocié, sans perdre sa fiche

**Given** une aventure Ryuutama sans Homme Dragon
**When** j'en crée un depuis la section de création
**Then** il est créé et associé à cette aventure en une seule opération
**And** deux créations simultanées pour la même aventure ne donnent jamais deux Hommes Dragons associés ni une fiche orpheline

**Given** les fiches existantes (un Homme Dragon par partie)
**When** le nouveau modèle est livré
**Then** chacune reste intacte et rattachée à sa partie
**And** la migration échoue avec une erreur explicite, sans rien choisir au hasard, si deux fiches visent la même partie ou si une fiche resterait sans lien

**Given** une aventure Ryuutama dont je suis MJ, sans Homme Dragon associé
**When** la liste des parties est calculée
**Then** le signal « Homme Dragon à créer » s'affiche comme avant, sans requête par partie

**Given** deux écritures simultanées sur la même fiche (la réserve et la modification générale, par exemple)
**When** elles aboutissent
**Then** aucune n'écrase l'autre

**Given** ma fiche ouverte
**When** un scénario de l'une de ses aventures passe en `PASSE`
**Then** son niveau et son historique se mettent à jour sans que je recharge

*Prérequis levé :* AD-23 (modèle, routes `PUT`/`DELETE /parties/:id/homme-dragon/:hommeDragonId`, fiche sous `/homme-dragons/:id`, temps réel, migration) et AD-22 réécrite. **Contrat du livré cassé volontairement** (33.5 à 33.7) : la liste des consommateurs à mettre à jour est dans AD-23. À vérifier à l'implémentation : l'absence d'interblocage du verrou `FOR NO KEY UPDATE`, et le comportement d'un deuxième onglet ouvert (il ne se rafraîchit pas sur une écriture de fiche, par choix d'AD-23).

## Epic 34 : Entrée dans l'application

La porte d'entrée cesse de mentir : plus de lien menant à une impasse, un message d'échec qui dit la vraie cause, et des écrans mis en forme pour le mobile.

### Story 34.1 : Messages d'erreur véridiques à la connexion

As a utilisateur qui n'arrive pas à se connecter,
I want savoir si ce sont mes identifiants ou le serveur qui posent problème,
So that je cesse de retaper mon mot de passe alors que l'application est injoignable.

**Acceptance Criteria:**

**Given** je saisis des identifiants incorrects
**When** je valide
**Then** le message me dit que mes identifiants sont invalides

**Given** le serveur est injoignable
**When** je tente de me connecter
**Then** le message me dit que le service est indisponible
**And** il ne prétend pas que mes identifiants sont faux

**Given** une erreur inattendue du serveur
**When** elle survient
**Then** le message reste honnête sur ce que l'application sait
**And** aucune information technique inutile n'est exposée

### Story 34.2 : Champ de mot de passe révélable, lien mort retiré

As a utilisateur,
I want voir ce que je tape dans un champ de mot de passe, et ne pas suivre un lien qui ne mène nulle part,
So that je me trompe moins et je ne perde pas de temps.

**Acceptance Criteria:**

**Given** un champ de mot de passe, sur n'importe quel écran de l'application
**When** j'active la révélation
**Then** je vois le contenu que j'ai saisi
**And** je peux le masquer à nouveau

**Given** la page de connexion
**When** je la consulte
**Then** aucun lien « Créer un compte » n'y figure

**Given** l'inscription sur invitation
**When** je reçois un lien valide
**Then** le parcours d'inscription reste entièrement fonctionnel

### Story 34.3 : Mise en forme des écrans d'authentification

As a futur joueur qui rejoint par un lien,
I want que la première impression soit soignée,
So that l'application inspire confiance avant même que j'aie un compte.

**Acceptance Criteria:**

**Given** les quatre écrans d'authentification et le parcours « rejoindre par lien »
**When** je les ouvre sur téléphone
**Then** leur hiérarchie visuelle est lisible
**And** aucun contenu n'est tronqué ni ne déborde

**Given** un écran comportant une action principale et des actions secondaires
**When** il s'affiche
**Then** l'action principale est distinguée des secondaires

**Given** je ne suis pas connecté
**When** j'ouvre l'un de ces écrans
**Then** il s'affiche dans le dernier thème connu localement, ou dans un thème tiré au hasard si aucun n'est connu, sans clignotement

**Given** un formulaire d'authentification invalide
**When** je le valide
**Then** chaque champ fautif affiche un message qui nomme la règle
**And** le focus va au premier champ fautif et rien n'est envoyé

**Given** n'importe quel écran d'authentification
**When** un lecteur d'écran le parcourt
**Then** la langue est le français, le titre d'onglet nomme l'écran et la structure comporte un titre dans une zone principale
**And** les erreurs et les réussites sont annoncées

*L'identité visuelle (bande animée, logo, emblèmes, accroches par thème) est la story 34.4, dessinée par la passe UX `ux-jdr-master-2026-10-05`.*

### Story 34.4 : Identité visuelle « Dés Dispos » des écrans d'authentification

As a visiteur qui ne connaît pas l'application,
I want comprendre dès l'arrivée qu'il s'agit d'organiser des parties de jeu de rôle entre amis,
So that je sache où j'arrive avant d'avoir lu quoi que ce soit.

**Acceptance Criteria:**

**Given** n'importe quel écran d'authentification, dans chacun des trois thèmes
**When** il s'affiche
**Then** une bande au décor propre au thème, le nom « Dés Dispos », son logo et une accroche propre au thème précèdent la carte

**Given** la bande animée
**When** je clique ou touche le fond animé
**Then** l'animation se fige sur place, et un second clic la relance
**And** avec « réduire les animations » activé, elle reste immobile d'office

**Given** l'application après connexion
**When** je regarde l'onglet du navigateur
**Then** le favicon et le nom reflètent « Dés Dispos »

*Spines : `ux-jdr-master-2026-10-05` (`DESIGN.md`, `EXPERIENCE.md` §2 à §4, §11 b). Dépend de la 34.3 (feuille partagée, structure `<main>`). Le bandeau de navigation de l'application (« master-jdr ») reste à arbitrer à la rédaction de la spec.*

---

## Epic 35 : Thèmes et textes

Les trois univers retrouvent un registre cohérent, chaque texte est statué comme thématisé ou non, et le stockage devient relisible thème par thème.

*En dernier par construction : on ne relit les libellés qu'une fois tous les écrans refondus, donc tous les textes connus.*

### Story 35.1 : Découpe des thèmes et renommage

As a personne qui relit les textes,
I want un fichier par thème, et la certitude qu'aucune clé ne manque nulle part,
So that je puisse relire un univers d'un seul tenant sans jouer aux sept erreurs.

**Acceptance Criteria:**

**Given** le registre de thèmes actuel, en un seul fichier
**When** la découpe est livrée
**Then** chaque thème vit dans son propre fichier
**And** aucun texte n'a été perdu au passage

**Given** une clé présente dans un thème et absente d'un autre
**When** le projet est construit
**Then** l'écart est détecté avant l'exécution
**And** il ne peut plus se découvrir à l'affichage, en production

**Given** le thème `medieval-steampunk`
**When** la story est livrée
**Then** il s'appelle `atelier-cuivre` et s'affiche « Atelier Cuivré »
**And** sa classe racine, ses clés et son type ont suivi

**Given** un compte ayant choisi ce thème avant le renommage
**When** il se connecte après la mise à jour
**Then** il retrouve son thème
**And** la migration des valeurs enregistrées fait partie de cette même story

**Given** le registre de thèmes
**When** il est relu après la découpe
**Then** il ne contient aucun texte de règle propre à un système de jeu

### Story 35.2 : Classement des textes non thématisés

As a personne qui relit les textes,
I want savoir pour chaque texte s'il relève d'un thème ou non,
So that la relecture porte sur un périmètre net et non sur une zone grise.

**Acceptance Criteria:**

**Given** chaque texte affiché par l'application
**When** le classement est terminé
**Then** il est statué comme relevant d'un thème ou non

**Given** un texte officiel du système de jeu
**When** il est classé
**Then** il reste hors thème et n'entre pas dans le registre

**Given** un texte codé en dur dans un composant alors qu'il relève d'un thème
**When** il est identifié
**Then** il rejoint le registre du thème concerné

**Given** un libellé orphelin, présent dans le registre mais utilisé nulle part
**When** il est identifié
**Then** il est supprimé

### Story 35.3 : Revue éditoriale des trois thèmes

As a auteur des textes,
I want relire chaque univers d'un seul tenant,
So that le registre soit cohérent d'un écran à l'autre.

**Acceptance Criteria:**

**Given** un thème
**When** je le relis dans son fichier
**Then** je lis l'intégralité de ses textes sans changer de fichier

**Given** les trois thèmes relus
**When** la revue est terminée
**Then** chacun tient un registre cohérent d'un bout à l'autre de l'application

**Given** les écrans nouveaux ou refondus par ce palier
**When** la revue les couvre
**Then** leurs libellés existent dans les trois thèmes
**And** aucun d'eux ne subsiste dans une formulation générique par défaut

---

## Epic 36 : Calendrier — lisibilité

L'utilisateur ouvre son calendrier et **voit** ce qui l'attend : sa prochaine séance nommée à son créneau, les votes où on l'attend, où en est le groupe — sans lire une liste ni deviner un point de couleur. Déclarer ses disponibilités devient un geste de sélection, et un conflit cesse d'être un mur.

*Épic issu du retour d'usage du 2026-08-17, après livraison de l'épic 30. Ordonnancé juste après lui.*

### Carte de couverture des exigences

| FR | Stories | Ce qui est livré |
| --- | --- | --- |
| FR-49 | 36.2 | La case à trois bandes et la préséance par bande |
| FR-57 | 36.1, 36.3, 36.4 | Le rail, la sélection comme geste, la résolution de conflits |
| FR-50 | 36.2, 36.5 | Titre dans la bande, puis les informations pratiques |
| FR-51 | 36.6, 36.7 | La piste de participation, puis le sélecteur de réponse |
| FR-53 | 36.8 | La disponibilité du groupe sur canal séparé |
| FR-52 | 36.9, 36.10 | Le mode Destinée, puis composer un vote depuis la grille |
| FR-56 | 36.11, 36.12 | L'Agenda par urgence, puis l'Agenda du MJ |
| FR-36 | 36.13 | La grille Semaine à densité variable |
| FR-54, FR-55 | 36.14 | La barre repliée, la légende, les préférences |

### Séquence et portée

| # | Story | Portée |
| --- | --- | --- |
| 36.1 | Le rail de détail | Front |
| **36.2** | La case du mois : trois bandes et la préséance | Front |
| 36.3 | La sélection devient le geste, avec sa portée | Front + dette clavier |
| 36.4 | Résolution de conflits sur l'écriture groupée | **Serveur (D-18)** + front |
| 36.5 | Informations pratiques d'une séance — heure, lieu, note libre | **Serveur (D-15)** + front |
| 36.6 | La piste de participation dans la grille | **Serveur (D-17)** + front |
| 36.7 | Le sélecteur de réponse de vote | Front |
| 36.8 | La disponibilité du groupe sur canal séparé | Front |
| 36.9 | Le mode Destinée et « qui manque » | Front |
| 36.10 | Composer un vote depuis la grille | **Serveur (D-16)** + front |
| 36.11 | La vue Agenda refondue | Front |
| 36.12 | L'Agenda du MJ : options dépliées et scellement | Front — **dépend de Q-25** |
| 36.13 | La grille Semaine à densité variable | Front |
| 36.14 | La barre repliée, la légende, les préférences | Front |

### Convention de lecture du contrat d'UI

`mockups/contrat-ui-calendrier.html` décrit **l'état d'arrivée de l'épic**, pas celui de chaque story. Une story intermédiaire peut donc livrer un écran qui n'y ressemble pas encore complètement — ce n'est **pas** une divergence.

**Le ⚠️ signale autre chose : une story qui s'écarte de la cible finale**, ou qui modifie un comportement déjà livré par un épic précédent. Il est placé juste avant la partie concernée, et dit ce qui change et pourquoi.

**Révision 3 de la planche, 2026-08-17.** Trois décisions prises pendant la rédaction de la story 36.1 ont été répercutées dans la planche **et** dans les spines UX : le **rail est permanent à toutes les largeurs** (il ne disparaît plus au-delà de 500 px), il **nomme toujours ses trois créneaux** (les vides compris), et **activer une ligne portant une séance ouvre le scénario** qui la porte. Les stories 36.11 et 36.13 ont été amendées en conséquence — voir les ⚠️ à leurs AC.

### Story 36.1 : Le rail de détail

As a utilisateur,
I want lire le détail complet d'un jour sans quitter la grille,
So that l'étroitesse d'une case ne me prive pas de l'information.

*Placée **avant** la refonte de la case, délibérément : le rail se construit sur la grille telle qu'elle existe aujourd'hui, il est utile dès sa livraison, et il évite que la story suivante ne rende la vue mois muette sur téléphone entre deux livraisons.*

⚠️ **Trois points tranchés le 2026-08-17, après rédaction de la story.** Ils modifient la planche contractuelle, régénérée en conséquence (révision 3). (1) **Le rail est permanent à toutes les largeurs**, ordinateur compris — il y est la surface la plus riche, la largeur servant à déplier l'information et non à retirer la bande ; la table de densité d'`EXPERIENCE.md` §9, qui le faisait disparaître au-delà de 500 px, est corrigée. (2) **Les trois créneaux sont toujours nommés**, y compris les vides ; le rendu mobile de la planche n'en montrait que deux. (3) **Activer une ligne portant une séance ouvre le scénario qui la porte** — aucun écran de séance n'existe dans l'application, et le scénario est le niveau qui porte le contexte utile.

**Acceptance Criteria:**

**Given** la vue mois ou la vue semaine
**When** l'écran est affiché
**Then** un rail de détail est visible **en permanence** sous la grille, **à toutes les largeurs — téléphone, tablette et ordinateur**
**And** il n'existe aucun geste pour l'ouvrir ou le fermer

**Given** je touche une case, pour quelque raison que ce soit
**When** le toucher est enregistré
**Then** le rail affiche le jour touché
**And** il nomme ses trois créneaux et ce que chacun porte
**And** les trois sont **toujours** nommés — un créneau qui ne porte rien dit son état, il ne disparaît pas

**Given** aucun toucher depuis l'ouverture de l'écran
**When** le rail se peuple
**Then** il montre le prochain jour portant quelque chose

**Given** un jour sans rien
**When** il est touché
**Then** le rail le dit explicitement plutôt que de rester vide

**Given** une ligne du rail qui porte une séance
**When** je la tape
**Then** le **scénario** qui porte cette séance s'ouvre
**And** une ligne qui ne porte rien d'ouvrable n'est pas cliquable et ne s'en donne pas l'air

**Given** une largeur d'écran confortable
**When** le rail est rendu
**Then** il déplie ce que la case abrège
**And** la largeur ne le fait jamais disparaître

### Story 36.2 : La case du mois, trois bandes et la préséance

As a utilisateur,
I want que chaque créneau d'un jour affiche ce qui compte le plus,
So that je cesse de rater une séance derrière un point de couleur.

**Acceptance Criteria:**

**Given** une case de la vue mois
**When** elle est rendue
**Then** elle est découpée en **trois bandes horizontales pleine largeur** — matin en haut, après-midi au milieu, soir en bas
**And** la position verticale porte le créneau, sans icône ni libellé

**Given** un créneau portant plusieurs informations
**When** la bande est rendue
**Then** un seul rang l'occupe, selon l'ordre séance confirmée > vote en cours > mes indisponibilités > mes disponibilités
**And** l'arbitrage se fait **bande par bande**, jamais à la journée

**Given** un rang au-dessus de « mes disponibilités »
**When** il gagne une bande
**Then** il ajoute une **forme** — filet pour une séance, liseré pour un vote, trame pour l'absence de réponse
**And** aucune information n'est portée par la couleur seule

**Given** un jour dont les trois créneaux portent le même état, sans événement
**When** la case est rendue
**Then** les trois bandes fusionnent en une seule
**And** la grille ne se charge pas inutilement

**Given** une bande portant une séance confirmée
**When** la place le permet
**Then** le titre de la séance y est écrit, tronqué si nécessaire

**Given** la couche « mes séances confirmées » éteinte
**When** un créneau porte une séance
**Then** le texte disparaît de la bande
**And** l'indisponibilité qui en découle demeure — elle ne dépend d'aucun réglage

**Given** l'ancienne signalétique — pastille de séance, pastille de groupe, réglette de trois segments
**When** cette story est livrée
**Then** elle est retirée
**And** aucune information qu'elle portait n'est perdue

**Given** une largeur de case inférieure au seuil mobile
**When** la case est rendue
**Then** les bandes perdent leur texte et conservent leur structure

**Given** le geste de déclaration existant
**When** on tape une bande
**Then** il se comporte comme le tap sur un segment aujourd'hui
**And** aucune régression de saisie n'est introduite par cette story

**Given** une largeur inférieure au seuil mobile, où les bandes n'affichent aucun texte
**When** une case porte une séance ou un vote
**Then** le rail livré par la story 36.1 en donne le détail
**And** la vue mois sur téléphone ne dit à aucun moment moins qu'avant cette story

### Story 36.3 : La sélection devient le geste de déclaration

As a utilisateur,
I want déclarer mes disponibilités en sélectionnant, puis en choisissant la portée,
So that le geste suive ma pensée au lieu de me faire remplir un formulaire.

⚠️ **Modifie un comportement livré par la story 30.3.** Le chemin clavier validait une sélection en « indisponible » d'office — décision assumée alors, faute de barre pour exprimer le choix. Cette story rend `Entrée` cohérente avec le pointeur.

**Acceptance Criteria:**

**Given** une case ou une bande sans objet posé
**When** je la tape
**Then** elle devient une sélection d'un seul créneau
**And** la barre de sélection apparaît

**Given** une sélection active
**When** la barre est affichée
**Then** elle propose une portée — journée entière, matin, après-midi, soir
**And** la portée s'applique à **toute** la sélection

**Given** une sélection de plusieurs jours faite en vue mois
**When** je choisis la portée « soir »
**Then** seuls les créneaux du soir sont déclarés

**Given** la barre de sélection
**When** je choisis « Autre… »
**Then** le panneau de déclaration s'ouvre
**And** il reste le seul chemin de la contrainte récurrente

**Given** un glissement vertical dans une case de la vue mois
**When** il se produit
**Then** il fait défiler la page
**And** il ne sélectionne jamais la journée — celle-ci passe par la portée

**Given** une sélection armée
**When** je presse `Entrée`
**Then** elle est validée avec **ce que la barre affiche**
**And** le résultat est identique à un clic sur le bouton correspondant

**Given** aucune sélection armée
**When** je presse `Espace` sur une case
**Then** la journée entière est sélectionnée
**And** `Entrée` reste réservée à la validation

**Given** une sélection en cours
**When** je presse `Échap`
**Then** elle est annulée sans rien enregistrer

**Given** un double-clic ou un clic droit sur la grille
**When** il se produit
**Then** il ne déclenche aucune action propre
**And** ces deux gestes restent **délibérément réservés** — leur attribuer un sens rouvrirait l'ambiguïté avec la sélection, qu'un double-clic déclenche de toute façon au premier appui

### Story 36.4 : Résolution de conflits sur l'écriture groupée

As a utilisateur,
I want choisir ce qu'il advient des créneaux déjà déclarés que ma sélection recouvre,
So that un conflit cesse de faire échouer tout mon geste.

⚠️ **Renverse une décision de l'épic 30.** `AD-21` et la story 30.2 avaient tranché que la route groupée échoue en bloc, avec une garde interdisant d'y faire passer le panneau de déclaration — faute d'écrasement et de découpe. Cette story lève la garde : la route groupée doit absorber les deux.

**Acceptance Criteria:**

**Given** un lot recouvrant des créneaux déjà déclarés
**When** il est soumis
**Then** l'application propose **Remplacer**, **Conserver** ou **Au cas par cas**
**And** elle ne refuse plus le lot

**Given** le dialogue de conflit
**When** il s'affiche
**Then** il **nomme** les créneaux concernés, il ne se contente pas de les compter

**Given** je choisis « Au cas par cas »
**When** la résolution démarre
**Then** les conflits défilent un par un
**And** chaque décision ne porte que sur son créneau

**Given** je choisis « Remplacer »
**When** l'écriture s'exécute
**Then** seules **mes propres déclarations** sont remplacées
**And** une indisponibilité dérivée d'une séance demeure

**Given** une séance ultérieurement annulée
**When** le créneau est relu
**Then** la disponibilité revient d'elle-même, sans écriture

**Given** le mécanisme de découpe de la story 1.7
**When** un lot recouvre partiellement une déclaration existante
**Then** la découpe s'applique dans le lot comme elle s'appliquait au chemin unitaire

**Given** la détection de conflits existante
**When** le lot est traité
**Then** son prédicat est réutilisé, jamais dupliqué
**And** les déclarations actives sont lues une seule fois pour tout le lot

**Given** un lot résolu
**When** il est enregistré
**Then** l'écriture reste transactionnelle
**And** une seule émission temps réel est produite

### Story 36.5 : Les informations pratiques d'une séance

As a joueur,
I want savoir où l'on joue, à quelle heure on se retrouve et quoi apporter,
So that je n'aie pas à chercher l'information ailleurs.

**Acceptance Criteria:**

*⚠️ AC1 et AC2 amendées le 2026-08-19 : la dérogation D-15 portait à l'origine **un seul champ de texte libre**. Elle en porte désormais **trois**, séparés — voir `sprint-change-proposal-2026-08-19.md`.*

**Given** une séance
**When** le MJ l'édite depuis la chronologie du scénario
**Then** il peut saisir une **heure de rendez-vous**, un **lieu** et une **note libre**, tous trois facultatifs
**And** l'heure est saisie par un contrôle qui n'accepte qu'un format horaire
**And** lui seul peut les écrire

**Given** ces trois champs
**When** ils sont spécifiés
**Then** l'heure est une **étiquette** et non un instant — une chaîne que rien ne parse, ne compare, ne trie ni ne calcule
**And** ils n'introduisent **aucune durée, aucun fuseau, aucun lieu structuré**
**And** **aucun calcul** n'est fait à partir de leur contenu
**And** la chaîne de disponibilité continue de raisonner au **créneau de journée**

**Given** une séance portant ces informations
**When** elle s'affiche sur un créneau, dans le rail ou dans l'agenda
**Then** elles sont rendues **telles quelles**, tronquées si la place manque
**And** quand la place manque, la **note libre cède la première**, l'heure et le lieu tenant plus longtemps

**Given** une séance sans aucune de ces informations
**When** elle s'affiche
**Then** rien n'est réservé ni affiché à leur place
**And** il en va de même pour chaque champ absent pris séparément

**Given** un membre qui n'est pas le MJ de la partie
**When** il tente d'écrire ce champ
**Then** la demande est refusée

### Story 36.6 : La piste de participation d'un vote

As a membre d'une partie,
I want voir combien de personnes ont répondu sur un créneau, et pas seulement leur avis,
So that je distingue un créneau plébiscité d'un créneau voté par une seule personne.

**Acceptance Criteria:**

**Given** un créneau proposé au vote
**When** sa piste est rendue
**Then** la piste **entière représente l'effectif de la troupe**
**And** la portion remplie dit combien ont répondu

**Given** les réponses données
**When** la piste est remplie
**Then** les couleurs distinguent oui, peut-être et non
**And** la portion restante porte la trame « personne ne s'est prononcé »

**Given** un créneau où une seule personne sur quatre a répondu oui
**When** on le compare à un créneau où les quatre ont répondu oui
**Then** les deux pistes **diffèrent visiblement**

**Given** la place disponible
**When** la piste est rendue en vue semaine, dans le rail ou dans l'agenda
**Then** un compteur « 3 / 4 » double la forme
**And** il est abandonné en vue mois étroite

**Given** j'ai répondu sur un créneau
**When** il s'affiche
**Then** ma réponse est rappelée **en toutes lettres**, jamais par la seule couleur

**Given** le calendrier personnel
**When** il charge les votes en cours
**Then** l'appel unique existant renvoie désormais les compteurs et ma réponse
**And** aucun appel supplémentaire n'est émis

**Given** le calendrier d'une partie
**When** il affiche la même lecture
**Then** il la dérive des signaux déjà chargés
**And** n'émet aucun appel réseau supplémentaire

### Story 36.7 : Le sélecteur de réponse de vote

As a joueur,
I want répondre à un vote depuis le calendrier en un geste clair,
So that je n'aie pas à retrouver un panneau séparé.

**Acceptance Criteria:**

**Given** une bande portant une option de vote
**When** je la tape
**Then** un sélecteur s'ouvre, ancré sur cette bande
**And** il propose oui, peut-être, non

**Given** j'ai déjà répondu
**When** le sélecteur s'ouvre
**Then** ma réponse courante y est marquée
**And** une entrée « Retirer ma réponse » est proposée

**Given** le retrait d'une réponse
**When** il est demandé
**Then** il passe par ce sélecteur
**And** aucun second chemin de retrait ne subsiste dans le calendrier

**Given** le sélecteur ouvert
**When** je le ferme sans choisir
**Then** ma réponse est inchangée

**Given** un vote clos ou une partie dont je ne suis pas membre
**When** la bande est touchée
**Then** aucun sélecteur ne s'ouvre

### Story 36.8 : La disponibilité du groupe sur un canal séparé

As a membre d'une partie,
I want voir où en est le groupe même quand mon créneau porte déjà autre chose,
So that la couche cesse d'être masquée dès que j'ai déclaré quelque chose.

**Acceptance Criteria:**

**Given** la couche « disponibilité du groupe » active
**When** une bande est rendue
**Then** la disponibilité du groupe s'affiche sur un **canal distinct** du fond de la bande
**And** elle n'entre jamais dans l'arbitrage de préséance

**Given** une bande portant une séance ou un vote
**When** la couche est active
**Then** la disponibilité du groupe y reste visible

**Given** je suis joueur
**When** la couche est active
**Then** je vois une **jauge** remplie à proportion des membres disponibles
**And** aucune identité n'est exposée

**Given** je suis le MJ et la partie compte au plus six membres
**When** la couche est active
**Then** je vois **une marque par membre**, dans un ordre fixe
**And** la position identifie la personne, la couleur son statut

**Given** une partie de plus de six membres
**When** je suis le MJ
**Then** l'affichage retombe sur la jauge

**Given** un créneau où personne n'est disponible et où personne ne s'est prononcé
**When** il est comparé à un créneau où tout le monde est bloqué
**Then** les deux se distinguent visuellement

**Given** le rail de détail
**When** un jour est affiché
**Then** il nomme les membres et leur statut, quel que soit le rôle

**Given** le calendrier personnel
**When** il est affiché
**Then** cette couche en est absente

**Given** la section « Fenêtres de la destinée »
**When** elle est affichée
**Then** elle liste les membres nommément pour le MJ
**And** des compteurs sans identité pour un joueur

### Story 36.9 : Le mode Destinée et le panneau réduit à « qui manque »

As a membre d'une partie,
I want concentrer le calendrier sur un vote à la fois,
So that je choisisse une date sans lire une liste à côté de la grille.

**Acceptance Criteria:**

**Given** au moins un vote ouvert
**When** j'active le mode Destinée
**Then** tout ce qui ne relève pas du vote courant s'estompe
**And** les créneaux proposés restent pleinement lisibles

**Given** plusieurs votes ouverts
**When** le mode est actif
**Then** je passe de l'un à l'autre par une navigation explicite
**And** le vote courant est nommé

**Given** le mode Destinée actif
**When** j'utilise la grille
**Then** **aucun geste ne change de signification**
**And** seul l'affichage est modifié

**Given** le panneau « Vote en cours »
**When** cette story est livrée
**Then** il se réduit aux membres qui n'ont pas répondu et à ceux qui ont répondu
**And** la liste des créneaux groupés par jour disparaît

**Given** le mode Destinée
**When** la barre de contrôles est rendue
**Then** il reste visible en dehors du panneau des couches
**And** son état actif se voit sans ouvrir quoi que ce soit

### Story 36.10 : Composer un vote depuis la grille

As a MJ,
I want désigner les créneaux d'un vote sur le calendrier,
So that je cesse de saisir des dates dans un formulaire séparé.

**Acceptance Criteria:**

**Given** je suis MJ et je choisis d'ajouter des dates
**When** le mode de composition s'arme
**Then** il se signale visuellement pendant toute sa durée
**And** une barre persistante permet de valider ou d'annuler

**Given** le mode de composition actif
**When** je tape un créneau
**Then** il est ajouté aux options, ou retiré s'il y était déjà
**And** rien n'est enregistré avant validation

**Given** le mode actif
**When** je presse `Échap` ou j'annule
**Then** aucune option n'est modifiée

**Given** un vote inexistant
**When** je valide une composition
**Then** le vote est créé avec les créneaux désignés

**Given** un vote déjà ouvert
**When** je valide un ajout ou un retrait d'options
**Then** ses options sont modifiées
**And** les réponses portées par les options conservées sont intactes

**Given** une option sur laquelle des membres ont voté
**When** je demande son retrait
**Then** l'écran m'avertit **avant**, en nommant le nombre de votants concernés
**And** je peux renoncer

**Given** un retrait confirmé
**When** il s'exécute
**Then** les réponses portées par cette option sont supprimées
**And** celles des autres créneaux sont intactes

**Given** un membre qui n'est pas MJ
**When** il tente de composer un vote
**Then** la demande est refusée

**Given** le sélecteur « Planifier un vote pour : »
**When** cette story est livrée
**Then** il est retiré de l'Oracle

### Story 36.11 : La vue Agenda refondue

As a utilisateur,
I want que l'agenda me dise ce qu'on attend de moi,
So that je n'aie pas à me représenter une liste de dates.

**Acceptance Criteria:**

**Given** la vue agenda
**When** elle est rendue
**Then** elle s'organise en trois sections — ce qui m'attend, ce qui est programmé, ce qui est passé
**And** **aucun jour ne figure en en-tête de section**

**Given** une entrée quelconque
**When** elle est rendue
**Then** sa date est une propriété de la ligne

**Given** une séance à inscription ouverte, donc sans date
**When** l'agenda est rendu
**Then** elle figure dans « ce qui m'attend »
**And** son absence de date n'est pas une anomalie d'affichage

**Given** un vote auquel je n'ai pas répondu
**When** il est rendu
**Then** son libellé dit qu'on attend ma réponse
**And** il change quand j'ai répondu

**Given** une entrée portant une séance
**When** je la tape
**Then** le **scénario** qui porte cette séance s'ouvre — ⚠️ *précisé le 2026-08-17 : la formulation d'origine, « la séance s'ouvre », supposait un écran de séance qui n'existe pas. Règle générale : une surface nomme la séance, l'activer ouvre le niveau au-dessus. Même cible que l'AC correspondante de la story 36.1.*

**Given** un téléphone
**When** j'ouvre le calendrier
**Then** l'agenda est la vue affichée par défaut

**Given** la couche « les inscriptions ouvertes »
**When** cette story est livrée
**Then** son interrupteur disparaît de la barre de contrôles
**And** sa clé reste dans la préférence de compte, sans migration

### Story 36.12 : L'Agenda du MJ, options dépliées et scellement

As a MJ,
I want trancher un vote depuis l'agenda,
So that je n'aie pas à changer de vue pour faire ce qu'on attend de moi.

**Bloquée par Q-25** — la définition d'un vote « mûr » doit être tranchée avant l'implémentation.

**Acceptance Criteria:**

**Given** un vote ouvert et mûr
**When** l'agenda est rendu pour le MJ
**Then** ses options se déplient dans la ligne
**And** elles sont triées par faveur

**Given** un vote ouvert qui n'est pas mûr
**When** l'agenda est rendu
**Then** la ligne reste compacte

**Given** une option dépliée
**When** elle est rendue
**Then** elle porte sa piste de participation
**And** un moyen de la sceller

**Given** l'option la plus favorable
**When** les options sont rendues
**Then** elle est mise en avant
**And** les autres restent accessibles et scellables

**Given** une séance sans date proposée
**When** l'agenda est rendu pour le MJ
**Then** la ligne propose de lancer un vote

**Given** un joueur
**When** le même agenda est rendu
**Then** il voit la même structure de ligne et son propre choix
**And** aucun moyen de sceller

### Story 36.13 : La grille Semaine à densité variable

As a utilisateur sur téléphone,
I want que la vue semaine reste utilisable en portrait,
So that je n'aie pas à choisir entre voir la semaine et lire ce qu'elle contient.

**Acceptance Criteria:**

**Given** la vue semaine, quelle que soit la largeur
**When** elle est rendue
**Then** elle conserve ses **sept colonnes**
**And** la gouttière porte une icône par créneau — lever, plein jour, nuit

**Given** ces icônes
**When** elles sont rendues
**Then** chacune porte un libellé accessible explicite

**Given** une largeur inférieure au seuil
**When** une cellule porte un événement
**Then** elle en affiche un seul mot
**And** le rail de détail donne le reste

**Given** une largeur supérieure au seuil — paysage, tablette, ordinateur
**When** une cellule porte un événement
**Then** elle affiche son titre et ses informations pratiques
**And** le rail **demeure** et déplie ce que la cellule abrège — ⚠️ *corrigé le 2026-08-17 : cette AC disait « le rail devient inutile », ce qui autorisait à l'escamoter. Tranché : le rail est permanent à toutes les largeurs (story 36.1). Ce qui varie avec la largeur est la densité de la **cellule**, jamais la présence du rail.*
**And** aucune règle de cette story ne masque le rail

**Given** le passage d'une largeur à l'autre
**When** il se produit
**Then** aucune vue supplémentaire n'est instanciée
**And** la sélection par glissement se comporte identiquement

**Given** la vue mois
**When** elle est rendue
**Then** elle ne porte **pas** ces icônes — la position y dit déjà le créneau

### Story 36.14 : La barre repliée, la légende et les préférences

As a utilisateur,
I want que les réglages cessent d'occuper l'écran et que j'arrive sur ce qui m'intéresse,
So that le calendrier commence en haut de la page.

**Acceptance Criteria:**

**Given** la barre de contrôles
**When** l'écran est au repos
**Then** elle tient sur **une seule ligne**, partagée avec la bascule de vues
**And** les couches ne s'y affichent plus en bande permanente

**Given** un bouton d'affichage
**When** je l'active
**Then** un panneau présente les couches — menu ancré sur ordinateur, feuille montant du bas sur téléphone

**Given** un affichage identique au défaut
**When** la barre est rendue
**Then** aucune pastille de résumé n'apparaît

**Given** un affichage qui s'écarte du défaut
**When** la barre est rendue
**Then** une pastille le signale
**And** elle porte l'action de rétablissement

**Given** la légende
**When** le panneau est ouvert
**Then** elle s'y règle
**And** elle est fermée par défaut

**Given** la légende affichée
**When** elle est rendue
**Then** elle sépare ce qui se passe d'explication de ce qui en demande une
**And** chaque entrée reproduit exactement le traitement réel de la case

**Given** l'écran de compte
**When** je règle ce que révèle mon calendrier
**Then** les choix sont posés en **intentions** — mes disponibilités et indisponibilités, mes séances, les votes, la disponibilité du groupe

**Given** ce réglage
**When** j'ouvre un calendrier
**Then** il définit l'état d'arrivée
**And** les filtres de l'écran restent librement modifiables

**Given** des bascules faites en cours de visite
**When** je reviens sur **le même** calendrier dans **la même** session
**Then** elles sont conservées

**Given** un rechargement, une déconnexion, ou l'ouverture d'un **autre** calendrier
**When** l'écran s'affiche
**Then** le réglage de compte s'applique de nouveau

**Given** la mémoire de session
**When** elle est implémentée
**Then** elle n'exige aucun mécanisme de détection de retour dans l'application
**And** aucune clé de couche existante n'est migrée

### Story 36.15 : Sceller depuis la barre de sélection de la grille

As a MJ,
I want sceller un vote directement depuis la barre de sélection de la grille, sans détour par l'Agenda ou la fiche de scénario,
So that je conclus l'action là où je viens de désigner le créneau.

**Contexte.** `contrat-ui-calendrier.html:376` et `EXPERIENCE.md:577` dessinent un bouton *Sceller* dans la barre de sélection de la grille (MJ, créneau sélectionné, vote ouvert). Aucune story de l'épic ne l'a livré : la 36.9 a retiré l'ancien `onChooseDate()`, la 36.12 n'a scellé que depuis l'Agenda. Le scellement doit réutiliser `PollService.chooseDate()`, déjà consommé par `CalendarAgendaView` (36.12) et par `SeanceList.onChoose()` — **avec confirmation avant écriture**, décision actée le 2026-08-24 (`deferred-work.md`) pour les deux chemins existants ; ce troisième chemin doit s'y conformer dès sa livraison, pas dans une revue ultérieure.

**Acceptance Criteria:**

**Given** une sélection portant sur un **créneau unique**, dans la barre de sélection de la grille
**When** l'utilisateur connecté est **MJ** de la partie, et ce créneau correspond exactement à une **option** d'un `SessionPoll` **OPEN** de cette partie (même date, même `slot`)
**Then** un bouton *Sceller* apparaît dans la barre de sélection

**Given** ce même contexte
**When** le créneau sélectionné ne correspond à **aucune** option d'un vote ouvert de la partie
**Then** aucun bouton *Sceller* n'apparaît

**Given** cette même barre
**When** l'utilisateur connecté n'est **pas** MJ de la partie
**Then** aucun bouton *Sceller* n'apparaît, quel que soit le créneau sélectionné (l'action reste réservée au MJ, cohérent avec `SeanceList`/l'Agenda)

**Given** une sélection portant sur **plusieurs** créneaux (plage)
**When** la barre de sélection est rendue
**Then** aucun bouton *Sceller* n'apparaît (l'action ne s'applique qu'à un créneau unique, résolu sans ambiguïté vers une option)

**Given** le bouton *Sceller* activé
**When** l'utilisateur clique dessus
**Then** une confirmation est demandée avant toute écriture (même formulation que `SeanceList.onChoose()` : « Sceller cette date ? Le vote sera définitivement clôturé. »)
**And** un refus n'appelle aucune API et laisse la sélection intacte

**Given** la confirmation acceptée
**When** l'écriture réussit
**Then** `PollService.chooseDate()` est appelé avec le `pollId` et l'`optionId` résolus
**And** le vote passe `CLOSED`, la sélection de grille est effacée
**And** le rail de détail et l'Agenda reflètent le nouvel état sans rechargement manuel (réutilisation des signaux de rechargement déjà en place, pattern `refreshScenario()`/`notifyChanged()`)

**Given** l'écriture échoue (réseau, 403, vote déjà clos entre-temps)
**When** la réponse d'erreur revient
**Then** un message d'erreur clair est affiché
**And** la sélection n'est pas perdue silencieusement

### Story 36.16 : « C'est passé » en calendrier personnel

As a joueur ou MJ consultant son calendrier personnel,
I want voir mes séances passées dont le compte-rendu manque,
So that je retrouve en un endroit unique ce qui reste à documenter, sans dépendre du contexte d'une partie précise.

**Contexte — story SERVEUR (troisième dérogation de l'épic après D-16/36.10 et D-18/36.4), PÉRIMÈTRE CORRIGÉ le 2026-08-24 en `create-story`.** La section « C'est passé » a été livrée côté front par la 36.11 mais reste **structurellement vide** en calendrier personnel (`/profile/calendar`). L'analyse initiale (36.11) parlait de « deux changements serveur » ; en lisant `getMyCalendar()`, un seul des deux en est vraiment un : **`GET /me/calendar` ne renvoie pas `compteRendu`** (`MyCalendarSeanceEntry` ne le porte pas). La seconde moitié du problème — « la plage part d'aujourd'hui » — **n'est PAS une limite serveur** : `getMyCalendar(userId, from, to)` filtre déjà sur les bornes `from`/`to` **que le client envoie**, sans jamais les forcer à `today`. C'est `CalendarView.fromDateStr` (front, `signal(CalendarView.todayIso())`) qui ne demande jamais de plage passée en contexte personnel. Cette story livre le morceau serveur (`compteRenduManquant`) ; le morceau front est **volontairement laissé de côté** ici, `fromDateStr`/`toDateStr` étant un signal **partagé** avec le formulaire de recherche MJ (dette déjà consignée, non tranchée : `deferred-work.md`, section 30.6). L'élargir sans note attentive risquerait de faire fuiter une plage passée dans le formulaire MJ au changement de route (36.14 : le composant survit désormais au changement de `:id`). Fichiers : `packages/shared/src/index.ts` (`MyCalendarSeanceEntry`), `apps/api/src/availability/availability.service.ts` (`buildMySeancesLayer`).

**Acceptance Criteria:**

**Given** une séance passée dont `compteRendu` n'est pas renseigné
**When** `MyCalendarSeanceEntry` est construit pour cette séance
**Then** elle porte `compteRenduManquant: true`

**Given** une séance passée dont `compteRendu` est renseigné
**When** `MyCalendarSeanceEntry` est construit
**Then** elle porte `compteRenduManquant: false`

**Given** une plage `[from, to]` incluant des dates passées, envoyée explicitement par l'appelant
**When** `GET /me/calendar` est appelé avec cette plage
**Then** les séances passées qualifiantes sont retournées avec leur `compteRenduManquant`, **sans qu'aucun changement serveur supplémentaire ne soit nécessaire** (le filtrage par plage est déjà piloté par l'appelant, pas par une borne serveur figée sur « aujourd'hui »)

**Given** une séance d'une partie où l'utilisateur n'est **ni** MJ **ni** membre
**When** `GET /me/calendar` est appelé par cet utilisateur
**Then** cette séance n'apparaît jamais (aucune régression sur le scope d'accès existant)

**Given** cette story livrée seule, sans son pendant front
**When** le calendrier personnel affiche l'Agenda
**Then** la section « C'est passé » **reste vide en pratique** — `fromDateStr` ne demande toujours pas de plage passée en contexte personnel. Ce n'est pas un défaut de cette story : c'est une limite de périmètre assumée, à lever par une décision séparée sur `deferred-work.md` (signal `fromDateStr`/`toDateStr` partagé avec le formulaire MJ).

**Given** l'élargissement de la plage vers le passé
**When** une partie porte un historique long de séances
**Then** aucune limite de pagination n'est requise par cette story (le item de dette `deferred-work.md` sur l'absence de borne inférieure dans `getSeanceDerivedUnavailability`/`getMyCalendar`, story 30.5, reste hors périmètre — performance pure, pas fonctionnel)
