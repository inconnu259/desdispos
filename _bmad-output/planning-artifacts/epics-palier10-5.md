---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-29-p10-5/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/EXPERIENCE.md'
---

# jdr-master - Epic Breakdown — Palier 10.5 : Jeux de société

## Overview

This document provides the complete epic and story breakdown for jdr-master, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Palier 10.5 : chacun tient sa Ludothèque ; une soirée montre les jeux sur place (ceux de l'hôte, ceux qu'on apporte), signale les doublons et ce qui se joue au nombre de présents ; un groupe voit les jeux de ses membres et qui reçoit. Mode soirée (ralliement) seulement, entièrement facultatif. Numérotation des épics : à partir de **48** (le Palier 10.4 s'arrête à l'épic 47). Vocabulaire : termes du Glossaire du PRD (Jeu, Ludothèque, Participant, Jeux sur place, Jeu écarté, Apport, Envie, Jeux du groupe, Compteur d'hôte) ; l'interface emploie les libellés par thème d'EXPERIENCE.md §3 (onglet Reliques / Trésors / Joyaux). Références : `docs/checklist.md` (temps réel), `docs/security.md`. Règles valables pour **toutes** les stories : chaque écran validé modifié est signalé ⚠️ (NFR7) ; commentaires et messages d'erreur en français, aucune installation de dépendance sans accord, tout via Docker (NFR8) ; CI verte à chaque story (NFR6).

## Requirements Inventory

### Functional Requirements

FR1 : Tout utilisateur ajoute, modifie et supprime les Jeux de sa Ludothèque, en saisie manuelle : nom obligatoire ; joueurs minimum et maximum facultatifs, entiers, maximum ≥ minimum ; durée facultative en minutes, entier positif ; deux Jeux de même nom (casse et accents ignorés) refusés dans une même Ludothèque ; supprimer un Jeu le retire des Apports et des Envies des soirées à venir ; supprimer son compte supprime sa Ludothèque. Hors périmètre : import d'un catalogue, photo, extensions, notes.
FR2 : Tout est facultatif : créer, rejoindre, héberger une soirée fonctionnent à l'identique avec une Ludothèque vide ; aucune invite, aucun e-mail, aucune pastille ne pousse à la remplir ; une soirée sans jeux sur place affiche un état vide discret avec un lien vers sa Ludothèque.
FR3 : Les Jeux de l'hôte apparaissent d'office dans les jeux sur place de chacune de ses soirées à venir ; un Jeu qu'il ajoute apparaît aussitôt ; l'hôte ne change jamais (s'il quitte le groupe, ses soirées à venir sont annulées, Palier 10).
FR4 : L'hôte écarte l'un de ses Jeux d'une soirée à venir, et l'y remet ; le Jeu écarté disparaît de cette soirée seulement et reste dans sa Ludothèque ; seul l'hôte écarte ses propres Jeux.
FR5 : Un Participant d'une soirée à venir, autre que l'hôte, coche parmi ses Jeux ceux qu'il pense apporter, et les décoche ; l'Apport apparaît « apporté par {pseudo} » ; cesser d'être Participant (désinscription, invitation déclinée) retire ses Apports ; une personne qui n'est pas Participant, ou une soirée passée, annulée ou terminée, ne permet aucun Apport ; un Participant à la Ludothèque vide voit un état vide avec un lien pour ajouter un Jeu.
FR6 : Toute personne qui voit une soirée voit ses jeux sur place, rangés par provenance (chez l'hôte, apportés) ; un même nom présent à plusieurs endroits figure à chacun, marqué « ×N » avec les autres détenteurs (nom normalisé, casse et accents ignorés, sans identité de jeu partagée) ; chaque jeu dont la plage de joueurs contient le nombre actuel de Participants est signalé « jouable à N » (jamais un jeu sans nombre de joueurs) ; la liste se met à jour sans recharger ; une soirée passée, terminée ou annulée n'affiche pas ses jeux.
FR7 : Un Participant d'une soirée à venir signale une Envie sur un jeu sur place, et la retire ; chaque jeu affiche son nombre d'Envies et qui les a signalées ; une Envie au plus par personne, par jeu et par soirée ; un jeu qui quitte les jeux sur place perd ses Envies sur cette soirée.
FR8 : Tout membre d'un groupe consulte les Jeux du groupe : nom, nombre de joueurs, durée, propriétaires ; filtre par nombre de joueurs (et recherche par nom, UX) ; un membre retiré ou parti en disparaît aussitôt ; aucune modification depuis cette vue.
FR9 : La Ludothèque d'une personne est lisible par les membres des groupes dont elle est membre et par l'hôte et les invités (répondu ou non) des mêmes rencontres isolées ; toute autre personne ne peut pas la lire (refus côté serveur, pas un simple masquage).
FR10 : Tout membre d'un groupe voit le Compteur d'hôte de chaque membre : événements passés et non annulés du groupe qu'il a hébergés ; 0 s'il n'a jamais reçu ; les événements d'une personne qui a quitté le groupe ne sont attribués à personne ; pas de compteur pour une rencontre isolée.

### NonFunctional Requirements

NFR1 : Mode soirée seulement — aucune section, aucun libellé de ce palier n'apparaît sur une partie JDR ; aucun écran JDR ne change.
NFR2 : Permissions — chaque droit (écarter, apporter, Envie, lire une Ludothèque) passe par le `PermissionService` du Palier 10, avec un test de refus par cas.
NFR3 : Temps réel — l'onglet des jeux d'une soirée et les Jeux du groupe suivent en direct les Apports, Envies, Jeux écartés, inscriptions et changements de Ludothèque des autres (canaux existants, `docs/checklist.md`).
NFR4 : Volume — une Ludothèque de 300 Jeux et un groupe de 20 membres restent lisibles et rapides sur téléphone.
NFR5 : Mobile et accessibilité — chaque fonction utilisable au doigt, cibles de 44 px ; actions écrites et atteignables au clavier ; aucune information portée par la couleur seule.
NFR6 : Régression et CI — la CI existante (types, build API, tests unitaires + e2e) reste verte à chaque story.
NFR7 : Contrat UI — toute modification d'un écran validé est signalée ⚠️ dans la story (UX EXPERIENCE §10, 7 écarts).
NFR8 : Langue et conventions du dépôt — commentaires et messages d'erreur en français ; aucune installation de dépendance sans accord ; tout via Docker.
NFR9 : Sécurité — entrées bornées et validées (`docs/security.md`) ; aucune Ludothèque lisible hors du cadre de FR9 ; jamais l'e-mail d'un tiers dans un DTO.

### Additional Requirements

- Pas de starter : projet existant (brownfield), aucune dépendance, aucun service, aucune tâche planifiée nouvelle ; une migration Prisma par story qui introduit sa table, sans migration en plusieurs temps (P10-AD-16).
- AD-1 : table `BoardGame(id, ownerId, name, nameKey, minPlayers?, maxPlayers?, durationMin?, createdAt)`, écrivain unique **`board-games/`** (nouveau module de couche 2), `@@unique([ownerId, nameKey])`, `ownerId → User` en `Cascade` ; `nameKey = boardGameNameKey(name)`, fonction unique de `@master-jdr/shared` (espaces réduits, accents retirés, minuscules), calculée à l'écriture par l'API, servie dans tous les DTO ; le web regroupe sur le `nameKey` reçu.
- AD-2 : tables `EventGameBring(eventId, boardGameId, userId)`, `EventGameExcluded(eventId, boardGameId)`, `EventGameEnvy(eventId, userId, nameKey)`, écrivain **`events/`**, cascades sur `Event` et `BoardGame` ; jeux de l'hôte jamais copiés (Ludothèque de `Event.ownerId` moins les écartés) ; Envie portant sur un `nameKey`, ignorée à la lecture si le nom n'est plus sur place, supprimée quand une écriture d'`events/` retire la dernière source de ce nom.
- AD-3 : `participantsOf(event)` dans `events/`, seule définition : groupe → hôte + `Inscription` `CONFIRMED` ; rencontre isolée → `Membership` de la partie ; `RESERVED` jamais ; N = sa taille.
- AD-4 : `PermissionTarget` gagne `{ userId }` ; action `LIBRARY_READ` (lecteur = propriétaire, ou groupe de ralliement partagé, ou rencontre isolée partagée — membre ou invitation `PENDING`) ; JDR, invitation déclinée, lien non utilisé n'ouvrent rien ; refus = 404 ; listes gardées par `PARTIE_READ`.
- AD-5 : actions `EVENT_GAME_BRING`, `EVENT_GAME_EXCLUDE`, `EVENT_GAME_ENVY`, cible `{ eventId }`, ralliement seulement ; sous le verrou de l'événement : soirée à venir et non annulée, appelant ∈ `participantsOf`, `BRING` refusé à l'hôte et sur le jeu d'autrui, `EXCLUDE` sur un jeu de l'hôte seulement ; lecture d'une soirée passée, terminée ou annulée = liste vide.
- AD-6 : toute sortie de `participantsOf` (désinscription, refus d'invitation, retrait d'une inscription, `PartiesService.leave`) supprime dans sa transaction les Apports et Envies de la personne sur l'événement ; suppression d'un `BoardGame` → cascade sur ses Apports et Jeux écartés ; suppression de compte → cascade sur sa Ludothèque (P10-AD-11 inchangé).
- AD-7 : après validation, hors transaction : écriture d'`events/` sur les jeux → `partie:{partieId}` ; écriture de `board-games/` → `partie:{id}` de chaque partie de ralliement dont le propriétaire est membre, et `user:{ownerId}` ; services web avec `notifyChanged()`.
- AD-8 : Compteur d'hôte dérivé par `events/` (événements de la partie dont le membre est `ownerId`, non annulés, plage passée, membres actuels seulement), lu par `PARTIE_READ`.
- Routes : `GET/POST /me/board-games`, `PATCH/DELETE /me/board-games/:id` ; `GET /users/:userId/board-games` (`LIBRARY_READ`) ; `GET /parties/:id/board-games` (groupe) ; `GET /events/:eventId/board-games` ; `PUT/DELETE /events/:eventId/board-games/:boardGameId/bring` et `/exclusion` ; `PUT/DELETE /events/:eventId/envies` (corps : `nameKey`) ; `GET /parties/:id/host-counts` (groupe).
- Charge utile de l'onglet : une lecture par soirée — jeux de l'hôte (non écartés ; écartés en plus pour l'hôte), Apports avec `pseudo` / `displayName` du porteur, Envies (`nameKey`, `userId`), `participantsCount` ; « Dans mon … » composé côté web depuis la Ludothèque du lecteur.
- Validation (`class-validator`) : nom 1–80 caractères ; joueurs entiers 1–99, `max ≥ min` ; durée entière 1–1440 ; 500 Jeux au plus par Ludothèque.
- Tests exigés : `boardGameNameKey` (casse, accents, espaces) ; matrice de refus `LIBRARY_READ` (groupe, isolée acceptée / en attente / déclinée, JDR, inconnu → 404) ; `EVENT_GAME_*` (non participant, hôte qui apporte, invité qui écarte, soirée passée, annulée, `RESERVED`) ; `participantsOf` ; traces effacées par chaque chemin d'AD-6 ; Envie purgée à la dernière source ; Compteur d'hôte (annulé, futur, ancien membre).
- Noms imposés : `BoardGame`, `nameKey`, `boardGameNameKey`, `minPlayers`, `maxPlayers`, `durationMin`, `EventGameBring`, `EventGameExcluded`, `EventGameEnvy`, `participantsOf`, `participantsCount`, `hostCounts` ; interdits : `games/`, `ludotheque` ou `apport` en identifiant.

### UX Design Requirements

UX-DR1 : ⚠️ Vue d'une rencontre isolée : 3ᵉ onglet après « Conjonction · Invités » (hôte : « Invitations »), libellé du thème suivi du compte de jeux sur place (« Reliques · 8 ») ; absent pour une soirée passée, terminée ou annulée.
UX-DR2 : ⚠️ `EventDialog` (conjonction de groupe) : deux onglets en tête, « Conjonction » (blocs existants, inscrits compris) et l'onglet des jeux ; sans onglets pour une soirée passée, terminée ou annulée.
UX-DR3 : `GamesSummary` : « {n} jeux sur place · {k} jouables à {N} » et deux puces à bascule (`aria-pressed`, cumulables) : « Jouables à {N} » et « Les plus {appelées | attendus | demandés} » (tri par Envies décroissantes, puis alphabétique) ; mise à jour en direct.
UX-DR4 : `GamesSection` : sections dans l'ordre « Chez {hôte} / Chez moi », section des Apports (les miens compris, « par moi · Je ne l'apporte plus »), « Dans mon … » (Participant non hôte : mes Jeux non apportés, « J'apporte », « ⚠ déjà chez {nom} »), section des Jeux écartés (hôte seul, « visible par vous seul·e ») ; en-tête bouton `aria-expanded` avec compte (« · 3 sur 6 » sous filtre) ; dépliées au départ, état retenu dans le navigateur par section ; aucune troncature ; ordre alphabétique.
UX-DR5 : `GameRow` et ses pastilles : nom, actions à droite (♥ ; ⋮ pour l'hôte sur ses jeux), « {min}–{max} joueurs · {d} min », `FitPill` « jouable à N » (`{colors.accent-1}` plein), `DuplicatePill` « ×N » et ligne « aussi chez / aussi apporté par » (`{colors.status-todo}`), provenance, `OwnerLink` (soulignement pointillé) ; tokens de DESIGN.md (frontmatter `components`).
UX-DR6 : « J'apporte » / « Je ne l'apporte plus » sans confirmation, le jeu change de section aussitôt ; ⋮ de l'hôte avec une entrée « Sceller pour ce soir » (selon le thème), seulement sur ses jeux d'une soirée à venir.
UX-DR7 : `UnavailableRow` : nom et mesure estompés (45 %), « Remettre » (selon le thème) à plein contraste, rend aussitôt le jeu à « Chez moi » pour tous.
UX-DR8 : `EnvyToggle` : ♥ seul sans Envie, « ♥ {n} » sinon ; bascule `aria-pressed`, nom accessible « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} » ; actif en `{colors.accent-2}` ; toucher le compte ouvre la liste des noms dans un petit menu.
UX-DR9 : ⚠️ Page Ludothèque : entrée dans la page du compte, avant la zone sensible (titre du thème, « {n} jeux », visibilité) ; `QuickAddRow` en tête (nom, joueurs min et max, durée, « Ajouter » ; `Entrée` ajoute ; champs vidés et focus rendu au nom ; nom vide → bouton inactif ; max < min → message sous le champ ; « Seul le nom est obligatoire. ») ; liste alphabétique ; ✎ ouvre la même saisie sur la ligne (« Enregistrer », « Retirer de mon … ») ; retrait immédiat avec « Jeu retiré · Annuler », précédé d'une confirmation si le Jeu est apporté à une soirée à venir ; erreur serveur sous la saisie, champs conservés.
UX-DR10 : ⚠️ Vue d'un groupe : 4ᵉ onglet après « Conjonctions » (« Conjonctions · Reliques · Détails · Missives ») : « Chercher un jeu… », puces « Jouable à : 2 · 4 · 6 · 8+ » (une seule active, re-toucher l'éteint), une ligne par jeu (nom, joueurs, durée, « chez {noms} »), alphabétique, pied « {n} jeux chez {m} membres », lecture seule.
UX-DR11 : ⚠️ Onglet Détails du groupe : section repliable « Qui reçoit » (selon le thème) au-dessus des réglages, `HostBars` (barre `{colors.accent-2}` 6 px, plus grand compte = 120 px, « {n} fois »), du plus au moins, puis « Jamais : {noms} ».
UX-DR12 : ⚠️ `LibrarySheet` : tiroir du bas de `DestinyList`, « Cabinet | Coffre | Râtelier de {nom} · {n} », ligne sur le prêt, lecture seule ; ouverte en touchant un nom (propriétaire d'un jeu, pastille d'inscrit ou d'invité, ligne de Missives — qui deviennent des boutons) ; `Échap`, fond ou glisser ferment ; focus piégé puis rendu au nom touché ; tiroir modal aussi au-delà de 768 px.
UX-DR13 : Libellés : tableau validé d'EXPERIENCE.md §3.1 et textes complémentaires §3.2 dans les trois fichiers de thème (accords : reliques au féminin, trésors et joyaux au masculin) ; clés de §3.3 dans `NEUTRAL_KEYS` avec leur raison ; aucun mot du JDR ; un mot de thème n'appartient qu'à un thème.
UX-DR14 : États (EXPERIENCE.md §5) : aucun jeu sur place (texte + lien discret) ; non-Participant (lecture seule, ni ♥ ni « Dans mon … ») ; hôte ; jeu sans nombre de joueurs (jamais « jouable à N », exclu par le filtre) ; Ludothèque vide (saisie seule, sans incitation) ; un jeu touché qui disparaît : action sans erreur bloquante, liste mise à jour.
UX-DR15 : Accessibilité (EXPERIENCE.md §7) : en-têtes de section nommés avec leur compte ; « jouable à N », « ×N », « déjà chez » en texte ; annonce `aria-live` polie quand N change (« 7 participants : 4 jeux jouables à 7. »), sans bandeau visible ; champs nommés, erreurs reliées par `aria-describedby` ; cibles de 44 px.
UX-DR16 : Couleurs et mise en page (DESIGN.md §2, §4) : aucun token de thème ajouté ; doublon en `{colors.status-todo}`, Envie en `{colors.accent-2}`, jamais de rouge ; colonne de 640 px au plus au-delà de 768 px ; aucune image, note ni logo de catalogue.
UX-DR17 : À vérifier à l'implémentation : les quatre onglets du groupe à 360 px avec le libellé le plus long de chaque thème ; contraste de `{colors.accent-2}` en texte (≥ 4,5:1) dans les trois thèmes.

### FR Coverage Map

FR1 : Epic 48 — tenir sa Ludothèque (saisie manuelle, doublon de nom, suppression)
FR2 : Epic 48 (page sans incitation) et Epic 49 (état vide de l'onglet des jeux)
FR3 : Epic 49 — jeux de l'hôte d'office
FR4 : Epic 49 — écarter un jeu pour une soirée
FR5 : Epic 49 — « J'apporte »
FR6 : Epic 49 — lire les jeux sur place (provenance, ×N, jouable à N)
FR7 : Epic 49 — Envie
FR8 : Epic 50 — Jeux du groupe
FR9 : Epic 48 — lire la Ludothèque d'une personne
FR10 : Epic 50 — Compteur d'hôte

## Epic List

### Epic 48 : Ma Ludothèque, et celle des autres
Chacun tient la liste de ses jeux sur une page ouverte depuis son compte, et consulte celle d'une personne avec qui il partage un groupe ou une rencontre en touchant son nom.
**FRs covered:** FR1, FR2, FR9

### Epic 49 : Les jeux sur place d'une soirée
Avant une soirée, chacun voit ce qu'il y aura (jeux de l'hôte, Apports, doublons, jouables au nombre de présents), coche ce qu'il apporte et signale ses Envies ; l'hôte écarte un jeu indisponible ce soir-là.
**FRs covered:** FR2, FR3, FR4, FR5, FR6, FR7

### Epic 50 : Les jeux du groupe et qui reçoit
Dans un groupe, on trouve qui possède un jeu (recherche, filtre par nombre de joueurs) et on voit qui reçoit le plus souvent.
**FRs covered:** FR8, FR10

## Epic 48 : Ma Ludothèque, et celle des autres

Chacun tient la liste de ses jeux sur une page ouverte depuis son compte, et consulte celle d'une personne avec qui il partage un groupe ou une rencontre en touchant son nom. Pose `BoardGame`, `boardGameNameKey`, le module `board-games/`, l'action `LIBRARY_READ` et la feuille `LibrarySheet`. Ne touche à aucune soirée.

### Story 48.1 : Ajouter mes jeux et les retrouver

As a utilisateur,
I want ajouter mes jeux de société un par un, vite, et les voir listés dans ma Ludothèque,
So that mes amis sachent un jour ce que j'ai, sans que je doive tout ressaisir à chaque soirée.

**Acceptance Criteria:**

**Given** un utilisateur connecté, quel que soit son mode
**When** il ouvre la page de son compte (« Mon grimoire / Mon carnet / Mon établi »)
**Then** ⚠️ une ligne « Mon cabinet de reliques / Mon coffre aux trésors / Mon râtelier · {n} jeux › », avec la phrase de visibilité (EXPERIENCE §3.2), apparaît **avant la zone sensible** et ouvre la page Ludothèque (route sous `/profile/`) (UX-DR9, NFR7)
**And** la migration crée `BoardGame(id, ownerId, name, nameKey, minPlayers?, maxPlayers?, durationMin?, createdAt)`, `@@unique([ownerId, nameKey])`, `ownerId → User` en `Cascade` ; écrivain unique : le nouveau module `apps/api/src/board-games/` (AR AD-1)
**And** `boardGameNameKey(name)` (espaces réduits, accents retirés, minuscules) vit dans `@master-jdr/shared`, calculée par l'API à l'écriture et servie dans le DTO ; tests unitaires casse, accents, espaces (AR tests)
**And** `GET /me/board-games` renvoie mes Jeux par ordre alphabétique ; `POST /me/board-games` crée un Jeu ; projection explicite vers le DTO (P9-AD-15)
**And** la saisie valide côté serveur (`class-validator`) : nom 1–80 caractères obligatoire ; joueurs entiers 1–99, facultatifs, `max ≥ min` ; durée entière 1–1440, facultative ; 500 Jeux au plus ; un nom déjà présent (même `nameKey`) est refusé avec le message du thème « Ce jeu est déjà dans votre cabinet. » (FR1, NFR9)
**And** la page montre `QuickAddRow` en tête (nom, joueurs « à », durée en minutes, « Ajouter », « Seul le nom est obligatoire. ») : `Entrée` ajoute, les champs se vident et le focus revient au nom ; nom vide → bouton inactif ; max < min → message sous le champ relié par `aria-describedby` ; erreur serveur sous la saisie, champs conservés (UX-DR9, UX-DR15)
**And** la liste est alphabétique, une ligne par Jeu (nom, « {min}–{max} joueurs · {d} min » ou ses formes partielles), 44 px minimum ; Ludothèque vide : la saisie seule, sans texte qui pousse à la remplir ; aucune invite, aucun e-mail, aucune pastille ailleurs dans l'application (FR2, UX-DR14)
**And** après validation, une création émet `user:{ownerId}` et `partie:{id}` pour chaque partie de ralliement dont le propriétaire est membre ; le service web de la Ludothèque expose `notifyChanged()` et se recharge sur `user:{id}` (AR AD-7, NFR3)
**And** libellés de la page dans les trois thèmes (EXPERIENCE §3.1, §3.2) ; mesures, champs et « Ajouter » dans `NEUTRAL_KEYS` avec leur raison (UX-DR13)
**And** supprimer le compte supprime la Ludothèque par cascade (test) ; rien de ce palier n'apparaît sur une partie JDR (FR1, NFR1).

### Story 48.2 : Corriger ou retirer un jeu

As a utilisateur,
I want modifier un jeu de ma Ludothèque ou le retirer, avec une chance de me rattraper,
So that ma liste reste juste sans peur de l'erreur.

**Acceptance Criteria:**

**Given** la story 48.1 livrée et une Ludothèque non vide
**When** je touche ✎ sur une ligne
**Then** la même saisie s'ouvre sur la ligne, préremplie, avec « Enregistrer » et « Retirer de mon cabinet / coffre / râtelier » (UX-DR9)
**And** `PATCH /me/board-games/:id` applique les mêmes règles que la création (bornes, `max ≥ min`, nom en double refusé, `nameKey` recalculé) ; `PATCH` et `DELETE` sur le Jeu d'un autre → 404 ; tests de refus (FR1, NFR2, NFR9)
**And** « Retirer » appelle `DELETE /me/board-games/:id` aussitôt et affiche « Jeu retiré · Annuler » quelques secondes ; « Annuler » recrée le Jeu avec les mêmes champs (UX-DR9)
**And** chaque modification ou retrait émet comme à la création (AR AD-7) ; la page se met à jour dans mes autres onglets (NFR3)
**And** le retrait est atteignable au clavier, la confirmation d'annulation est annoncée (`aria-live` poli), cibles de 44 px (NFR5).

### Story 48.3 : Consulter la Ludothèque d'une personne

As a membre d'un groupe ou invité d'une rencontre,
I want toucher le nom de quelqu'un pour voir ses jeux,
So that je sache qui a le jeu que j'aimerais essayer, et à qui le demander.

**Acceptance Criteria:**

**Given** la story 48.1 livrée
**When** je touche le nom d'une personne : une pastille d'inscrit ou d'invité (détail d'une conjonction, onglet « Invités / Invitations » d'une rencontre isolée) ou une ligne de « Missives »
**Then** ⚠️ ces noms deviennent des boutons (aujourd'hui inertes) qui ouvrent `LibrarySheet` : tiroir modal de `DestinyList`, titre « Cabinet / Coffre / Râtelier de {nom} · {n} », ligne sur le prêt du thème (« Pour emprunter un jeu, demandez-le à {nom}. »), liste en lecture seule ; aussi en tiroir au-delà de 768 px (UX-DR12, NFR7)
**And** `GET /users/:userId/board-games` est gardé par la nouvelle action `LIBRARY_READ`, cible `{ userId }` ajoutée à `PermissionTarget` dans `PermissionService` (AR AD-4) : autorisé si lecteur = propriétaire, ou s'ils partagent un groupe de ralliement (`Membership`), ou une rencontre isolée où chacun est membre ou invité `PENDING` ; une partie de JDR, une invitation déclinée ou un lien non utilisé n'ouvrent rien ; refus = **404** (FR9)
**And** matrice de tests de refus : groupe partagé, rencontre isolée acceptée, en attente, déclinée, JDR partagé seulement, inconnu → 404 ; jamais l'e-mail du propriétaire dans le DTO (`pseudo` + `displayName`) (NFR2, NFR9)
**And** `Échap`, le fond assombri ou un glisser vers le bas ferment la feuille ; le focus est piégé puis rendu au nom touché ; nom accessible du bouton : « Voir les jeux de {nom} » `[à valider en story]` (UX-DR12, UX-DR15)
**And** Ludothèque vide : la feuille l'indique sans rien suggérer (FR2) ; libellés dans les trois thèmes (UX-DR13).

## Epic 49 : Les jeux sur place d'une soirée

Avant une soirée, chacun voit ce qu'il y aura (jeux de l'hôte, Apports, doublons, jouables au nombre de présents), coche ce qu'il apporte et signale ses Envies ; l'hôte écarte un jeu indisponible ce soir-là. Pose `participantsOf`, les tables `EventGameBring`, `EventGameExcluded`, `EventGameEnvy`, les actions `EVENT_GAME_*` et l'onglet des jeux. Une soirée passée, terminée ou annulée n'affiche pas ses jeux.

### Story 49.1 : Voir les jeux de l'hôte avant la soirée

As a participant ou membre,
I want un onglet qui me montre les jeux de l'hôte et combien se jouent au nombre de présents,
So that je sache s'il faut apporter quelque chose.

**Acceptance Criteria:**

**Given** l'épic 48 livré et une soirée à venir, non annulée
**When** j'ouvre la soirée
**Then** ⚠️ rencontre isolée : un 3ᵉ onglet après « Conjonction · Invités » (hôte : « Invitations ») ; conjonction de groupe : `EventDialog` gagne deux onglets en tête, « Conjonction » (blocs existants, inscrits compris) et l'onglet des jeux ; libellé du thème suivi du compte (« Reliques · 6 ») (UX-DR1, UX-DR2, NFR7)
**And** `participantsOf(event)` vit dans `events/`, à côté d'`eligibleVoters`, seule définition : groupe → hôte + `Inscription` `CONFIRMED` de la séance ; rencontre isolée → `Membership` de la partie ; `RESERVED` jamais ; tests (AR AD-3)
**And** `GET /events/:eventId/board-games` (gardé par `PARTIE_READ`, ralliement seulement) renvoie les Jeux de la Ludothèque de `Event.ownerId` (jamais copiés), avec `nameKey`, et `participantsCount` ; soirée passée, terminée ou annulée → liste vide (fonction de statut partagée) (AR AD-2, AD-5)
**And** l'onglet montre `GamesSummary` (« {n} jeux sur place · {k} jouables à {N} », N = `participantsCount`) avec la puce à bascule « Jouables à {N} » (`aria-pressed`), puis la section repliable « Chez {hôte} » (« Chez moi » pour l'hôte) : en-tête bouton `aria-expanded` avec compte (« · 3 sur 6 » sous filtre), dépliée au départ, état retenu dans le navigateur, ordre alphabétique, aucune troncature (FR3, FR6, UX-DR3, UX-DR4)
**And** chaque ligne est un `GameRow` : nom, mesure, `FitPill` « jouable à N » si la plage de joueurs contient N, jamais pour un jeu sans nombre de joueurs (exclu par le filtre) ; tokens de DESIGN.md (UX-DR5, UX-DR14, UX-DR16)
**And** aucun jeu sur place : « Aucune relique sur place pour l'instant. » + lien discret « Remplir mon cabinet » (selon le thème) (FR2, UX-DR14)
**And** soirée passée, terminée ou annulée : pas d'onglet ; `EventDialog` revient à ses blocs sans onglets (FR6, UX-DR1, UX-DR2)
**And** l'onglet se recharge sur `partie:{partieId}` : ajout d'un Jeu par l'hôte (émission de 48.1) et inscription ou désinscription (N change) ; quand N change, annonce `aria-live` polie « {N} participants : {k} jeux jouables à {N}. », sans bandeau visible (NFR3, UX-DR15)
**And** libellés dans les trois thèmes et `NEUTRAL_KEYS` (« Chez {hôte} », « Chez moi », « Jouables à {N} », mesure) ; colonne de 640 px au plus au-delà de 768 px ; rien en JDR (UX-DR13, UX-DR16, NFR1).

### Story 49.2 : Dire ce que j'apporte, et voir les doublons

As a participant,
I want cocher les jeux que j'apporte et voir aussitôt ceux qui sont déjà sur place,
So that je ne traverse pas la ville avec une grosse boîte déjà présente.

**Acceptance Criteria:**

**Given** la story 49.1 livrée
**When** je suis Participant d'une soirée à venir, autre que l'hôte, et j'ouvre l'onglet des jeux
**Then** la section « Dans mon cabinet / coffre / Sur mon râtelier » liste mes Jeux non apportés, chacun avec « J'apporte » (selon le thème), et « ⚠ déjà chez {nom} » quand son `nameKey` est déjà sur place ; elle se compose côté web depuis ma Ludothèque ; Ludothèque vide : « Votre cabinet est vide. » + lien (FR5, UX-DR4, UX-DR14)
**And** la migration crée `EventGameBring(eventId, boardGameId, userId)`, unique `(eventId, boardGameId)`, cascades sur `Event`, `BoardGame` et `User` ; écrivain `events/` (AR AD-2)
**And** `PUT/DELETE /events/:eventId/board-games/:boardGameId/bring` est gardé par la nouvelle action `EVENT_GAME_BRING` et, sous le verrou de l'événement, refuse : soirée passée, terminée ou annulée ; appelant hors de `participantsOf` (dont `RESERVED`) ; hôte ; Jeu d'un autre ; un test de refus par cas (AR AD-5, NFR2)
**And** « J'apporte » et « Je ne l'apporte plus » agissent sans confirmation ; le jeu change de section aussitôt ; la section des Apports (« Apportées / Apportés à la veillée / Acheminés ») liste ceux de tous, les miens compris (« par moi · Je ne l'apporte plus »), avec `pseudo` / `displayName` du porteur, jamais d'e-mail (FR5, UX-DR6, P9-AD-2)
**And** un `nameKey` présent à plusieurs endroits figure à chacun avec `DuplicatePill` « ×N » et la ligne « aussi chez {noms} » / « aussi apporté par {noms} » (`{colors.status-todo}`, en texte) ; le web regroupe sur le `nameKey` reçu (FR6, UX-DR5, AR AD-1)
**And** `GamesSummary` gagne les Apports dans ses comptes ; l'en-tête de l'onglet compte tous les jeux sur place (FR6)
**And** chaque écriture émet `partie:{partieId}` après validation (AR AD-7, NFR3)
**And** ⚠️ dans ma Ludothèque (48.2), retirer un Jeu apporté à une soirée à venir passe d'abord par une confirmation « Ce jeu est apporté à {n} soirée(s) à venir : il en sera retiré. » ; le retrait supprime l'Apport par cascade (UX-DR9, AR AD-6)
**And** un jeu touché qui vient de disparaître : l'action échoue sans erreur bloquante et la liste se met à jour (UX-DR14).

### Story 49.3 : Ne plus rien apporter quand je ne viens plus

As a participant qui se retire,
I want que mes Apports disparaissent quand je ne viens plus,
So that personne ne compte sur un jeu qui ne viendra pas.

**Acceptance Criteria:**

**Given** la story 49.2 livrée et des Apports sur une soirée à venir
**When** je cesse d'être Participant : désinscription, refus d'une invitation ou d'une place réservée, retrait de mon inscription par l'hôte, ou départ du groupe / retrait par un admin / suppression de compte (`PartiesService.leave`, P10-AD-17)
**Then** chacun de ces chemins supprime, **dans sa propre transaction**, mes `EventGameBring` sur l'événement concerné (événements à venir pour `leave`) (FR5, AR AD-6)
**And** un test par chemin vérifie qu'il ne reste aucun Apport ; le passé n'est pas conservé (AR tests)
**And** l'onglet des autres se met à jour par l'émission existante de chaque chemin (`partie:{partieId}`) (NFR3).

### Story 49.4 : Écarter un jeu pour ce soir (hôte)

As a hôte,
I want rendre un de mes jeux indisponible pour une soirée, et le remettre si je me suis trompé,
So that personne ne compte sur mon Dixit prêté à ma sœur.

**Acceptance Criteria:**

**Given** la story 49.1 livrée
**When** je suis l'hôte d'une soirée à venir et je touche ⋮ sur un de mes jeux
**Then** une seule entrée, « Sceller pour ce soir / Laisser au logis ce soir / Hors service ce soir », le retire aussitôt de « Chez moi » pour tous ; ⋮ n'existe que sur mes jeux et sur une soirée à venir (FR4, UX-DR6)
**And** la migration crée `EventGameExcluded(eventId, boardGameId)`, unique, cascades sur `Event` et `BoardGame` ; écrivain `events/` (AR AD-2)
**And** `PUT/DELETE /events/:eventId/board-games/:boardGameId/exclusion` est gardé par la nouvelle action `EVENT_GAME_EXCLUDE` (règle « hôte » de `PermissionService`) et refuse, sous le verrou de l'événement : soirée passée, terminée ou annulée ; appelant autre que l'hôte ; Jeu qui n'est pas à l'hôte ; un test de refus par cas (AR AD-5, NFR2)
**And** `GET /events/:eventId/board-games` renvoie les Jeux écartés **à l'hôte seulement** ; pour lui, la section du bas « Scellées ce soir / Restés au logis / Hors service » (« visible par vous seul·e ») liste des `UnavailableRow` (nom et mesure estompés à 45 %, « Lever le sceau / Ressortir / Remettre en service » à plein contraste) ; « Remettre » rend aussitôt le jeu à « Chez moi » pour tous (UX-DR4, UX-DR7)
**And** le Jeu reste dans la Ludothèque et sur les autres soirées ; le retirer de la Ludothèque supprime ses écartements par cascade (FR4, AR AD-6)
**And** chaque écriture émet `partie:{partieId}` après validation ; ⋮ et « Remettre » sont des boutons nommés de 44 px (NFR3, NFR5).

### Story 49.5 : Signaler une Envie

As a participant,
I want dire à quel jeu j'ai très envie de jouer ce soir, et voir les envies des autres,
So that on choisisse vite, et qu'on sache si l'idée plaît vraiment.

**Acceptance Criteria:**

**Given** les stories 49.2 et 49.4 livrées
**When** je suis Participant d'une soirée à venir et je touche ♥ sur un jeu sur place
**Then** `EnvyToggle` bascule (`aria-pressed`), ♥ seul sans Envie, « ♥ {n} » sinon, actif en `{colors.accent-2}` ; nom accessible « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} » ; toucher le compte ouvre la liste des noms dans un petit menu ; un jeu présent deux fois montre la même Envie sur ses deux lignes (FR7, UX-DR8, UX-DR15)
**And** la migration crée `EventGameEnvy(eventId, userId, nameKey)`, unique, cascades sur `Event` et `User` ; écrivain `events/` (AR AD-2)
**And** `PUT/DELETE /events/:eventId/envies` (corps : `nameKey`) est gardé par la nouvelle action `EVENT_GAME_ENVY` et refuse : soirée passée, terminée ou annulée ; appelant hors de `participantsOf` ; `nameKey` qui n'est pas sur place ; un test de refus par cas (AR AD-5, NFR2)
**And** une Envie dont le `nameKey` n'est plus sur place est ignorée à la lecture ; quand une écriture d'`events/` retire la dernière source d'un `nameKey` (Jeu écarté, Apport retiré, y compris par les chemins de 49.3), ses Envies sont supprimées dans la même transaction ; tests (FR7, AR AD-2, AR AD-6)
**And** les chemins de 49.3 suppriment aussi mes Envies sur l'événement (AR AD-6)
**And** `GamesSummary` gagne la puce « Les plus appelées / attendus / demandés » : tri par Envies décroissantes puis alphabétique, dans chaque section, cumulable avec « Jouables à {N} » (UX-DR3)
**And** chaque écriture émet `partie:{partieId}` ; contraste de `{colors.accent-2}` en texte mesuré dans les trois thèmes (≥ 4,5:1) et noté dans la story (NFR3, UX-DR17).

## Epic 50 : Les jeux du groupe et qui reçoit

Dans un groupe, on trouve qui possède un jeu (recherche, filtre par nombre de joueurs) et on voit qui reçoit le plus souvent. S'appuie sur l'épic 48 (Ludothèque, `LibrarySheet`) ; indépendant de l'épic 49.

### Story 50.1 : Trouver qui possède un jeu dans le groupe

As a membre d'un groupe,
I want voir tous les jeux des membres, les chercher et les filtrer par nombre de joueurs,
So that je sache à qui demander le jeu que je veux essayer.

**Acceptance Criteria:**

**Given** l'épic 48 livré
**When** j'ouvre un groupe de ralliement dont je suis membre
**Then** ⚠️ un 4ᵉ onglet s'insère après « Conjonctions » (« Conjonctions · Reliques · Détails · Missives », libellé du thème) (UX-DR10, NFR7)
**And** `GET /parties/:id/board-games` (module `board-games/`, gardé par `PARTIE_READ`, groupe seulement, refus pour une rencontre isolée ou une partie JDR) renvoie les Jeux des membres actuels, regroupés par `nameKey`, chacun avec nom, joueurs, durée et propriétaires (`pseudo` / `displayName`) (FR8, AR AD-4)
**And** l'onglet montre « Chercher un jeu… », les puces « Jouable à : 2 · 4 · 6 · 8+ » (une seule active, re-toucher l'éteint ; un jeu sans nombre de joueurs n'est retenu par aucune), une ligne par jeu, ordre alphabétique, pied « {n} jeux chez {m} membres » ; lecture seule (FR8, UX-DR10)
**And** toucher un propriétaire ouvre sa `LibrarySheet` (48.3) (FR9, UX-DR12)
**And** un membre retiré ou parti disparaît aussitôt : l'onglet se recharge sur `partie:{id}` (départ, et toute écriture de Ludothèque d'un membre, émission de 48.1) (FR8, NFR3)
**And** groupe sans jeu : « Personne n'a encore rempli son cabinet. » (selon le thème) (UX-DR14)
**And** les quatre onglets tiennent à 360 px avec le libellé le plus long de chaque thème ; mesure notée dans la story (UX-DR17, NFR5)
**And** 20 membres et 300 jeux chacun restent lisibles et rapides sur téléphone (NFR4).

### Story 50.2 : Voir qui reçoit

As a membre d'un groupe,
I want voir combien de fois chacun a reçu le groupe,
So that on sache si c'est toujours le même qui accueille.

**Acceptance Criteria:**

**Given** l'épic 48 livré
**When** j'ouvre l'onglet « Détails » d'un groupe de ralliement dont je suis membre
**Then** ⚠️ une section repliable « Qui ouvre sa porte / Qui accueille le cercle / Qui accueille l'équipage » apparaît au-dessus des réglages (UX-DR11, NFR7)
**And** `GET /parties/:id/host-counts` (`events/`, gardé par `PARTIE_READ`, groupe seulement) renvoie, par membre actuel, le nombre d'`Event` de la partie dont il est `ownerId`, non annulés et dont la plage est passée (fonction de statut partagée) ; rien n'est stocké (FR10, AR AD-8)
**And** `HostBars` liste les membres qui ont reçu, du plus au moins (barre `{colors.accent-2}` de 6 px, plus grand compte = 120 px, « {n} fois »), puis « Jamais : {noms} » ; pas de classement ni de mise en avant (FR10, UX-DR11, UX-DR16)
**And** tests : événement annulé, futur, d'un ancien membre (non compté, ancien membre absent), membre sans événement (0, dans « Jamais ») (AR tests)
**And** la section se recharge sur `partie:{id}` (annulation, départ) ; aucune section pour une rencontre isolée ni pour le JDR (NFR3, NFR1).
