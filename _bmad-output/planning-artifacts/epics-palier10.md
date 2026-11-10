---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-08/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md'
---

# jdr-master - Epic Breakdown — Palier 10 : Soirées entre amis

## Overview

This document provides the complete epic and story breakdown for jdr-master, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Palier 10 : le calendrier et la planification deviennent la base ; le **ralliement** (rencontres entre amis) s'ajoute au **JDR** comme un système du registre. Numérotation des épics : à partir de **37** (le Palier 9 s'arrête à l'épic 36). Vocabulaire : le code dit `Event` / `Seance` / `Partie` ; l'écran dit « conjonction », « convergence », « ralliement »… selon le thème.

## Requirements Inventory

### Functional Requirements

FR1 : À la création, l'utilisateur choisit le mode par une bascule à deux options placée après le nom (quête | ralliement) ; en ralliement, deux types (isolé = soirée isolée, durable = groupe) et aucun « livre de règles » ; le mode (déduit de la famille du système) n'est plus modifiable ; les parties existantes restent en mode JDR et se comportent comme avant.
FR2 : Soirée isolée — l'hôte invite nominativement ou par lien, sans limite ; il fixe la date directement ou par sondage ; il invite et retire des invités avant la soirée ; une soirée passée est terminée et figée ; jamais rattachée à un groupe ; l'invité nominatif voit « Accepter / Décliner » en tête de page et ne vote qu'après avoir accepté ; la fenêtre de création de la conjonction s'ouvre juste après la création.
FR3 : Groupe — le créateur en est le premier admin ; des membres y proposent des événements ; 1 à 20 membres sans dégradation ; ni scénario de JDR ni personnage (son système est le ralliement).
FR4 : Un admin ajoute des membres (invitation e-mail ou lien visant le groupe) et en retire ; un non-admin ne le peut pas (refus serveur).
FR5 : Un admin nomme un autre membre admin et peut quitter l'office ; plusieurs admins possibles ; le dernier admin qui quitte l'office supprime le groupe après une confirmation (membres et conjonctions comptés, bouton rouge) ; un admin qui quitte l'office reste membre ; « Nommer admin » depuis la liste des membres ; badge sur les admins.
FR6 : Un membre qui quitte ou est retiré perd ses inscriptions et votes à venir (places libérées) ; les événements à venir qu'il héberge sont annulés et les inscrits prévenus ; le passé est conservé ; départ volontaire possible avec le même effet.
FR7 : Effacer son compte (fonction inexistante aujourd'hui) depuis la zone sensible de la page Compte : aperçu de ce qui disparaît (groupes dont on est seul admin, avec membres et conjonctions ; parties de JDR possédées, avec le nombre de joueurs qui perdent leurs personnages), mot de passe exigé, bouton rouge ; un groupe qui garde un autre admin survit ; sinon il est supprimé ; les parties de JDR possédées sont supprimées (autorisé, avec l'avertissement).
FR8 : Tout membre d'un groupe propose un événement dont il est l'hôte (immuable) : nom, date (fixée : jour + créneau ; sondage : créneaux candidats + échéance), lieu, heure de rendez-vous facultative, infos pratiques facultatives, participation ; formulaire dans la même fenêtre que le détail ; l'hôte modifie et annule tant que ce n'est pas passé ; lieu visible de tous les membres ; pas de « MJ du groupe ».
FR9 : Participation — « tous les membres » (s'inscrire = confirmer, sans limite) ou « places limitées » (N) ; l'hôte seul réserve nommément des places, qu'aucun autre ne peut prendre ; décliner libère la place ; premier arrivé premier servi ; « complet » sans liste d'attente ; désinscription libre.
FR10 : Date fixée ou sondage ; en ralliement, sondage et inscriptions coexistent ; chaque créneau candidat montre combien d'inscrits sont disponibles d'après leurs dispos ; inscriptions tardives après la date fixée ; la date ne se rouvre jamais.
FR11 : Le vote s'ouvre dès que les créneaux sont posés (à la création ou plus tard), avec une échéance ; ayants droit : « tous » → membres, places limitées → inscrits, soirée isolée → invités acceptés ; plus de vote après l'échéance ou la date fixée ; seul l'hôte lance, prolonge (capacité nouvelle) et fixe la date ; une prolongation recale la relance ; le vote se fait dans le calendrier, sans plafond de créneaux, la fenêtre affichant un résumé (réponses, meilleur créneau, pour l'hôte « n'ont pas répondu ») et un bouton vers le calendrier du groupe (sans focus jusqu'au Palier 10.4) ; fixer la date = choisir parmi les candidats triés, inscrits prévenus.
FR12 : Sept e-mails — invitation à un groupe, invitation à une soirée isolée, place réservée, date fixée, rappel la veille, relance du vote (une fois, J-1 de l'échéance, aux ayants droit sans réponse), annulation ; aucun digest ni autre relance ; vocabulaire neutre ; tous les e-mails de l'application (existants compris) restylés : bouton plein et pied « Dés Dispos ».
FR13 : Toute décision d'autorisation passe par un point unique qui connaît le mode et le rôle ; la matrice des permissions du mode soirée y est exprimée ; le JDR est inchangé (tests existants sans changement d'attentes) hors la liste fermée de 8 exceptions (bouton de création global, tuiles de liste, filtres, retrait de sa liste, page Compte et suppression de compte, formulaire de création et couverture, e-mails restylés, rappel par séance).
FR14 : Migration — les parties existantes restent en mode JDR sans écriture de mode ; une migration par étape de la porte, sans migration en plusieurs temps (renommage du propriétaire, extraction de l'événement avec le même identifiant, date de séance en plage) ; aucune donnée perdue ; pas de réversibilité exigée (aucune production avant le Palier 11).
FR15 : Hors JDR, l'interface n'emploie ni « MJ », ni « campagne », ni « scénario », ni « séance », ni « joueur » ; libellés dans le registre de textes avec une variante par thème (bascule, types, rencontre et onglet, rôles) ; e-mails neutres ; libellés JDR inchangés sauf le sous-titre des tuiles ; chaque système a une pastille de nom et un badge rond sur la vignette.
FR16 : Annuler une soirée isolée ou un événement (hôte ; admin pour tout événement du groupe), tant que ce n'est pas passé ; confirmé, définitif ; état « annulée » distinct de « terminée », visible, sans action possible ; masqué par défaut avec les terminées, filtrable ; e-mail d'annulation aux inscrits, invités et places réservées.
FR17 : Retirer de sa liste une partie terminée ou annulée (JDR compris) : confirmation, disparition définitive pour soi seul, impossible sur une partie en cours ou à venir.
FR18 : Tout utilisateur connecté peut créer depuis un bouton d'en-tête visible sur toutes les pages (aujourd'hui réservé aux MJ) ; icône seule sur mobile avec le libellé thématique comme nom accessible.

### NonFunctional Requirements

NFR1 : Temps réel — tout composant affichant des données d'un groupe ou d'un événement (inscriptions, places, votes, membres) est câblé sur `changed` / `notifyChanged()` via `RealtimeService` (vérification `docs/checklist.md`) ; toute mutation visible dans la liste d'accueil la rafraîchit sans recharger.
NFR2 : Sécurité — chaque règle de la matrice est vérifiée côté serveur et couverte par un test de refus (`docs/security.md`) ; un membre d'un groupe A ne lit rien d'un groupe B ; aucun IDOR par un identifiant d'événement ou de séance d'une autre partie.
NFR3 : Sécurité du compte — la suppression de compte exige le mot de passe et ne vise que soi ; le retrait de sa liste n'a d'effet que pour son auteur.
NFR4 : Accessibilité — jamais la couleur ni le trait seuls (« annulée » écrit, badges avec un mot) ; zone de toucher ≥ 44 px pour le bouton de création mobile ; texte d'une place réservée en attente à ≥ 4,5:1 ; contraste du rouge de statut vérifié dans les trois thèmes.
NFR5 : Échelle — groupes de 4 à 20 membres, sondages jusqu'à ~20 créneaux sur plusieurs semaines : listes de membres et de votes sans pagination ; lectures de liste en lot (jamais une requête par partie).
NFR6 : Régression — la CI existante (types, build API, tests unitaires + e2e) reste verte à chaque story ; aucune story de ralliement avant la porte (FR13).
NFR7 : Contrat UI — toute modification d'un écran validé est signalée par ⚠️ dans la story, avec ce qui change et pourquoi (13 écarts listés dans l'UX, EXPERIENCE §10).
NFR8 : Langue et conventions du dépôt — commentaires et messages d'erreur en français ; aucune installation de dépendance sans accord ; tout via Docker.

### Additional Requirements

*(Architecture — spine du 2026-10-09, 18 AD ; projet brownfield, aucun starter template.)*

- **AR1 — Couches (AD-1)** : trois couches (planification `availability/`, `poll/` → rassemblement `parties/`, `events/`, `invitations/`, `account/` → capacités `scenarios/`, `characters/`, `xp-distributions/`, `homme-dragon/`, `character-roles/`, `announcements/`) + `permissions/` transverse ; une couche n'importe jamais un module du dessus ; la couche 1 déclare des ports implémentés par `events/` ; le `forwardRef` `PollModule → ScenariosModule` disparaît ; une table = un module écrivain (tableau des conventions) ; garde de capacité à l'entrée de chaque service de couche 3 via `PermissionService`.
- **AR2 — Registre des systèmes (AD-2)** : `GAME_SYSTEMS` porte `family` (`jdr` | `ralliement`), `capabilities` ⊆ {characters, scenarioLifecycle, xp, hommeDragon, groupRoles, announcements, linearCampaign}, `kinds`, `openForCreation` ; entrée `ralliement` (aucune capacité, kinds ONE_SHOT + CAMPAGNE_EPISODIQUE, pas de ligne `GameSystem`) ; fonctions `familyOf`, `hasCapability`, `kindsOf`, `isOpenForCreation` remplacent `gameSystemHasModule` ; changement de système entre familles refusé ; conversion de kind via `checkPartieKindTransition` pour le JDR seulement, interdite en ralliement.
- **AR3 — Événement / Scénario (AD-3)** : modèle `Event` (partieId, title, description, ownerId, cancelledAt, createdAt, séances) ; `Scenario` = extension 1:1 à clé primaire = `Event.id`, propre au JDR ; création composite par `EventsService.create(…, extend?)` dans une transaction, émission après validation ; FK `Event.partie` Cascade, `Scenario.event` Cascade, `Event.owner` SetNull ; ONE_SHOT = exactement un événement (vérifié sous verrou) ; `/parties/:id/events` refuse le JDR.
- **AR4 — Date de séance (AD-4)** : `Seance.startDate/startSlot/endDate/endSlot` seule source de la date ; fin de `dateValidee` et de `poll.chosenDate ?? dateValidee` ; `startSlot` vide = journée sans créneau (FULL_DAY pour les dispos) ; jamais deux séances pour une plage ; ce palier n'écrit que `start = end` ; un événement de ralliement a une seule séance ; le sondage s'ouvre dès que les créneaux sont posés.
- **AR5 — Propriétaire (AD-5)** : `Partie.mjId` → `ownerId` (nullable, SetNull), `Event.ownerId` = hôte ; immuable ; affichage « compte supprimé » s'il est vide ; DTO `mjId/mjPseudo/mjDisplayName` → `ownerId/ownerPseudo/ownerDisplayName`, web adapté sans changement visible ; `XpDistribution.mjId` hors périmètre.
- **AR6 — Permission (AD-6)** : `PermissionService.assert(userId, action, target)` (la partie se résout depuis l'événement ou la séance ciblés) ; `PermissionAction` union fermée ; `roleOf` et `rolesOf` en lot ; rôle `mj | player | admin | member` ; politiques jdr / ralliement-isolé (un seul admin, ni nommer ni quitter l'office) / ralliement-groupe ; `eligibleVoters(event)` et `reminderRecipients(seance)` uniques ; DTO d'événement porte les ayants droit (résumé calculé côté écran) ; vote refusé après échéance en ralliement ; test de non-lecture de `ownerId` hors service (liste d'exceptions) ; un test de refus par cellule actions × rôles × familles ; `GET /parties` sans rôle = toutes les parties avec leur rôle.
- **AR7 — Rôles (AD-7)** : `Membership.role` ADMIN | MEMBER (défaut MEMBER) ; créateur d'un ralliement = membre ADMIN ; verrou `FOR UPDATE` sur la partie avant tout recomptage d'admins ; `membersOf(partie)` unique (jdr : propriétaire + membres ; ralliement : membres).
- **AR8 — Inscriptions (AD-8)** : `Inscription.status` RESERVED | CONFIRMED (défaut CONFIRMED) ; réservation par l'hôte, comptée dans la capacité, sans expiration ; accepter → CONFIRMED, décliner → suppression ; verrou `FOR UPDATE` sur l'`Event` commun à inscription, réservation, acceptation, capacité, annulation, choix de date ; JDR inchangé ; ralliement : capacité vide = « tous », inscriptions tardives ; les RESERVED d'autrui servies à l'hôte seul ; soirée isolée = `Invitation` existante → `Membership`.
- **AR9 — Annulation (AD-9)** : `Event.cancelledAt`, ralliement seulement ; sous verrou de l'événement ; fermeture du sondage via `PollService` ; refus de toute action ; exclusion des rappels, indisponibilités, `nextSessionDate` ; e-mail après validation.
- **AR10 — Masquage (AD-10)** : `PartieHidden(userId, partieId)` ; refus serveur si ni TERMINEE ni ANNULEE ; exclusion serveur de toutes les lectures de l'utilisateur ; rouvrir une partie supprime ses masquages.
- **AR11 — Suppression de compte (AD-11)** : `GET /me/deletion-impact`, `DELETE /me` (mot de passe via `AuthService`, sessions coupées par lui) ; une transaction : JDR possédées supprimées, procédure de départ (AR17) pour chaque ralliement, puis le compte ; fichiers selon la règle existante.
- **AR12 — Rappels et e-mails (AD-12)** : `Seance.reminderSentAt` remplace `Partie.reminderSentAt` (toutes familles, JDR mêmes destinataires) ; séances d'événements annulés exclues ; `SessionPoll.relanceSentAt` (une relance, J-1, remise à vide à la prolongation) ; nouveaux gabarits dans `EmailTemplate` ; gabarit commun bouton + pied « Dés Dispos ».
- **AR13 — Signaux et temps réel (AD-13)** : codes de couche 3 seulement si la capacité existe ; nouveaux codes `RESERVATION_A_CONFIRMER`, `PARTIE_ANNULEE` ; parties masquées absentes ; toute mutation visible dans la liste appelle `notifyPartieSignalsChanged` (user:{id} de `membersOf`) après validation ; réservation → aussi user:{id} de la personne visée.
- **AR14 — Routes (AD-14)** : routes existantes inchangées (`parties/:id/scenarios`, `scenarios/:id/*`, `scenarios/seances/:id/*`, `parties/:id/poll/*`) ; nouvelles : `/parties/:id/events`, réservations (POST/DELETE), acceptation d'inscription, `DELETE /parties/:id/members/me`, `PATCH /parties/:id/members/:userId/role`, `GET /me/deletion-impact`, `DELETE /me`, masquage ; web : une page de partie aux onglets déduits de family + kind ; `features/events/`.
- **AR15 — Calendrier (AD-15)** : ports `OccupiedSpansPort` (plages des autres parties, sans titre ni identité) et `OwnEventsPort` (calendrier personnel, avec titres, hors masquées) ; participants : JDR inchangé, ralliement = hôte + CONFIRMED (groupe) ou membres (isolée) ; événements annulés exclus ; `nextSessionDate` = début de la plus proche plage à venir non annulée, une fonction unique d'`EventsService` ; `PollService` n'écrit plus `nextSessionDate`.
- **AR16 — Migration et porte (AD-16, amendé le 2026-10-09)** : une migration par étape de la porte, l'une après l'autre, sans expand/contract (`pnpm exec prisma` dans le conteneur) — ownerId, `Event` avec `id = Scenario.id`, déplacement de partieId/title/description/createdAt, `Seance.eventId`, colonnes de plage remplies depuis le sondage ou `dateValidee`, report de `reminderSentAt` ; les colonnes sans effet dans la porte arrivent avec leur épic (`Membership.role` : 38 ; `Inscription.status`, `relanceSentAt` : 40 ; `cancelledAt`, `PartieHidden` : 42) ; ordre de la porte : caractérisation → ownerId → Event → plage → registre → PermissionService (cœur, puis capacités JDR) → ports → rappels par séance ; condition : CI verte, attentes inchangées sauf les tests de rappel (exception 8), aucun changement visible du JDR hors exceptions.
- **AR17 — Départ d'un membre (AD-17)** : `PartiesService.leave(partieId, userId, cause)` unique (retrait, départ volontaire, suppression de compte) ; sous verrou : inscriptions à venir et votes ouverts supprimés, événements à venir hébergés annulés, `ownerId` vidé, `Membership` retiré, ralliement supprimé s'il n'a plus d'admin ; JDR inchangé.
- **AR18 — Statut (AD-18)** : `PartieStatus` + ANNULEE ; une fonction : JDR inchangé ; isolée : annulée → ANNULEE, `closedAt` ou plage passée → TERMINEE, sinon A_VENIR ; groupe : `closedAt` → TERMINEE, au moins un événement → EN_COURS, sinon A_VENIR.
- **AR19 — Conventions** : unions fermées dans `@master-jdr/shared` (SystemFamily, SystemCapability, PermissionAction, MembershipRole, InscriptionStatus, PartieRole, PartieStatus, PartySignalCode, EmailTemplate) ; noms imposés (`hostId`, `creatorId`, `mjId` interdits hors XpDistribution) ; projections explicites ; lectures en lot ; `emit` hors transaction.

### UX Design Requirements

- **UX-DR1 — Bouton de création global (⚠️)** : bureau, bord droit de la barre du haut, pilule pleine avec le libellé du thème ; mobile, à droite du titre de l'en-tête contextuel, icône seule 48 × 40 avec zone de toucher 44 px et le libellé du thème en nom accessible ; visible pour tout utilisateur connecté, sur toutes les pages ; le titre n'est jamais raccourci.
- **UX-DR2 — Icône de création** : d20 du logo traversé d'un crayon, trou découpé autour du crayon, `currentColor`, contour 2 px, lisible à 24 px ; redessinée sans masque ni identifiant (règle du logo) ; source `mockups/icone-B-de-crayon.svg`.
- **UX-DR3 — Formulaire de création (⚠️)** : ordre couverture → nom → bascule → champs du mode → description (toujours dernière) ; libellés « nom » et « nature » qui suivent le mode.
- **UX-DR4 — ModeSwitch** : bascule à deux options (libellés par thème), groupe nommé, `aria-pressed` / radiogroup, définitive après création ; changer d'option reconfigure les champs sans effacer nom ni description ; « Quête » → livre de règles + nature de la quête ; « Ralliement » → nature du ralliement (deux types).
- **UX-DR5 — Couverture (⚠️)** : bannière d'aperçu pleine largeur 170 px, arrondi 14 px ; puce translucide « Changer » (flou, crayon 16 px) en bas à droite ; seconde puce « Retirer » si image personnelle ; `<input type=file>` natif masqué sous la puce ; bannière générée par défaut.
- **UX-DR6 — Vue d'un groupe (⚠️)** : onglets Conjonctions (par défaut) · Détails · Missives ; onglet Conjonctions = titre + bouton « + Nouvelle conjonction » (tout membre), sections « À venir » puis « Passées », état vide ; Détails = description et réglages, sans cartes d'événements ; pas d'Homme Dragon / Chapitres / Chronologie ; pied : Retranscrire, Clore, Brûler + Quitter l'office / Quitter le groupe.
- **UX-DR7 — EventCard** : titre, badge d'état, date en gras (« Date à voter · jusqu'au … » en sondage), hôte, lieu, ligne « Ma situation » + pastille ; cadre et barre gauche selon l'état (imminent : badge plein, bord 2 px, barre 4 px) ; grille 250 px mini, une colonne sous 520 px ; clic / Entrée ouvre la fenêtre.
- **UX-DR8 — EventDialog** : `DetailSurface` élargie à `min(900px, 96vw)`, 94 vh, défilement interne ; ordre titre + badge → encadré de situation → La fiche → Inscrits → pied ; encadré membre (cadre status-todo, « Vote à faire », cases « Vos réponses » et « Meilleur créneau », bouton « Voter dans le calendrier ») ; encadré hôte (cadre accent-1, « Réponses », « Meilleur créneau », « N'ont pas encore répondu », « Fixer la date… », « Prolonger le vote », « Voir dans le calendrier ») ; inscrits en pastilles avatar 26 px + nom, la sienne bordée ; place réservée en attente visible de l'hôte seul, pastille pointillée, texte à plein contraste ; Échap, « Refermer » et retour du navigateur rendent la liste intacte et le focus à la carte.
- **UX-DR9 — Fenêtre « Nouvelle conjonction »** : même fenêtre en mode création ; ouverte après la création d'une soirée isolée ou par « + Nouvelle conjonction » ; champs : nom ; date (bascule Date fixée | Sondage ; fixée = jour + créneau ; sondage = bouton « Choisir les créneaux dans le calendrier » + résumé des créneaux + « Le vote se termine le ») ; lieu ; heure de rendez-vous facultative (étiquette HH:MM) ; infos pratiques ; participation (groupe : Tous les membres | Places limitées avec stepper et « Réserver une place à des membres » en puces + aide ; isolée : « Sur invitation · pas de limite ») ; pied Renoncer / Créer la conjonction.
- **UX-DR10 — Vue d'une soirée isolée** : même page, onglet « Conjonction » = détail en ligne (pas de liste ni de fenêtre) ; sous-titre « Ralliement · <type> » ; pas d'onglet Détails ; onglet « Invités » (liste, côté invité) / « Invitations » (liste et gestion, côté hôte) ; bandeau « Accepter / Décliner » en tête tant que l'invité nominatif n'a pas répondu.
- **UX-DR11 — Missives enrichi** : badge « Admin » (bouclier) sur chaque admin ; « Nommer admin » sur chaque membre non admin ; « Quitter l'office » sur sa propre ligne d'admin ; « Retirer » inchangé.
- **UX-DR12 — Confirmations (⚠️ `ConfirmDialog`)** : titre « Votre accord », « Renoncer » = annuler partout ; bouton **rouge** plein pour l'irréversible ; textes exacts des 7 fenêtres : effacer mon compte (liste groupes + parties de JDR + champ mot de passe), dernier admin qui quitte (« Quitter et supprimer »), admin parmi d'autres (« Quitter l'office »), retirer de ma liste, fixer la date (liste des créneaux triés, meilleur présélectionné, texte « scellée, inscrits prévenus, non rouverte, inscriptions tardives possibles »), prolonger le vote (« Nouvelle échéance », relance recalée), nommer admin.
- **UX-DR13 — Zone sensible du Compte (⚠️)** : section sous « Fermer le grimoire » (déconnexion), filet, étiquette « Zone sensible », phrase d'explication, pilule contour rouge « Effacer mon compte » avec corbeille 18 px.
- **UX-DR14 — Liste d'accueil (⚠️)** : tuile de ralliement (sous-titre = nature, indicateur de rôle) ; tuile de quête : sous-titre réduit à la nature ; filtres « Genre » (Tous / Quêtes / Ralliements), « Rang » étendu (admin, membre…), « Phase » + « Annulée » ; cases « Grouper par type » (sections Quêtes / Ralliements) et « Masquer les clos et les annulés ».
- **UX-DR15 — SystemChip + SystemBadge** : pastille texte du nom du système (11 px, après le rôle) ; badge rond 26 px au coin bas-droit de la vignette, glyphe 19 px, décoratif ; glyphes R1 Ryuutama (carte pliée + trajet + dé) et L1 Ralliement (feu de camp) redessinés sans masque ni identifiant ; Draconis sans badge pour l'instant.
- **UX-DR16 — Carte annulée** : contenu estompé à 50 %, trait diagonal rouge semi-transparent sur toute la carte, mention « Annulée » ; reste cliquable.
- **UX-DR17 — Libellés par thème** : table EXPERIENCE §3.1 (bascules Ralliement | Quête, Veillée | Sentier, Rassemblement | Mission ; types La conjonction des Esprits / La convergence des Sortilèges, La halte au gué / La grande transhumance, La réunion d'établi / Le grand chantier ; rencontre et onglet Conjonctions / Haltes / Réunions ; boutons « + Nouvelle … ») ; textes de l'encadré de situation (§3.3) ; « Quitter l'office » ; rôles de travail (Admin, Membre, Hôte, Invité) en attendant les variantes de thème.
- **UX-DR18 — E-mails** : sept gabarits (sujets et corps de EXPERIENCE §3.5) en vocabulaire neutre ; gabarit commun bouton vert plein + pied « Dés Dispos » appliqué aussi aux e-mails existants.
- **UX-DR19 — Accessibilité** : état écrit, jamais la couleur ou le trait seuls ; rouge accompagné d'un mot et d'un glyphe ; fenêtre au titre = nom de la conjonction, focus piégé puis rendu ; bascule annoncée ; aucune animation ajoutée.
- **UX-DR20 — Responsive** : en-tête mobile icône seule sous 440 px (mesures 399 / 422 / 437 px avec libellé), à revérifier sur un téléphone réel ; fenêtre pleine largeur sur mobile ; cartes en une colonne sous 520 px.

### FR Coverage Map

FR1 : Epic 38 — bascule quête | ralliement, types, mode définitif
FR2 : Epic 41 — soirée isolée, invitations accepter / décliner, terminée une fois passée
FR3 : Epic 38 (création d'un groupe, créateur admin) · Epic 39 (vie du groupe)
FR4 : Epic 39 — ajouter et retirer des membres
FR5 : Epic 39 — admins multiples, nommer, quitter l'office
FR6 : Epic 39 — procédure de départ (retrait, départ volontaire)
FR7 : Epic 43 — effacer son compte
FR8 : Epic 40 — proposer une conjonction (fenêtre de création)
FR9 : Epic 40 — participation, places réservées
FR10 : Epic 40 — date fixée ou sondage, inscriptions tardives
FR11 : Epic 40 — cycle du sondage, fixer, prolonger, vote dans le calendrier
FR12 : Epic 37 (rappel par séance) · Epic 39 (gabarit commun, invitation au groupe) · Epic 40 (place réservée, date fixée, relance) · Epic 41 (invitation à une soirée) · Epic 42 (annulation)
FR13 : Epic 37 — service de permission (puis tests de refus ajoutés par chaque épic pour ses actions)
FR14 : Epic 37 — migrations de la porte, une par étape
FR15 : Epic 38 — libellés par thème, pastilles et badges (puis libellés propres à chaque épic)
FR16 : Epic 42 — annulation
FR17 : Epic 42 — retirer de sa liste
FR18 : Epic 38 — bouton de création global


## Epic List

### Epic 37 : La porte — un socle commun, sans rien changer au JDR
Les MJ et les joueurs gardent un JDR identique, posé sur un socle commun (événement, séance en plage, propriétaire, registre des systèmes, service de permission, ports du calendrier) prêt pour le ralliement et les futurs systèmes. Ordre imposé par AD-16 ; seule évolution visible : le rappel par séance (exception 8). Condition de sortie : CI verte, attentes des tests inchangées hors rappels. *Exception assumée au principe « valeur utilisateur » : exigée par le PRD (FR13) et l'architecture (AD-16).*
**FRs covered:** FR13, FR14 (fondation de toutes les autres)

### Epic 38 : Tout le monde peut créer, et voir ses ralliements
N'importe quel utilisateur connecté crée une quête ou un ralliement (soirée isolée ou groupe) depuis un bouton d'en-tête, et le retrouve dans sa liste, reconnaissable à sa pastille et à son badge de système.
**FRs covered:** FR1, FR18, FR15, FR3 (création)

### Epic 39 : Rassembler sa bande
Un groupe vit : vue à onglets, invitations, admins multiples (nommer, quitter l'office), départ et retrait d'un membre par une procédure unique ; premier e-mail du ralliement et gabarit commun restylé pour tous les e-mails.
**FRs covered:** FR3, FR4, FR5, FR6, FR12 (invitation au groupe, gabarit commun)

### Epic 40 : Les conjonctions d'un groupe
Un membre propose une conjonction ; les autres s'y inscrivent ou acceptent une place réservée ; la date est fixée directement ou trouvée ensemble par un sondage (résumé, fixer la date, prolonger, relance J-1).
**FRs covered:** FR8, FR9, FR10, FR11, FR12 (place réservée, date fixée, relance du vote)

### Epic 41 : La soirée isolée
On organise une rencontre unique avec ses invités : page sans liste, invitations à accepter ou décliner, fenêtre de création ouverte d'emblée, statut « terminée » une fois passée.
**FRs covered:** FR2, FR12 (invitation à une soirée isolée)

### Epic 42 : Annuler et ranger
On annule une conjonction ou une soirée isolée (prévenant les participants), et chacun retire de sa liste ce qui est terminé ou annulé, JDR compris.
**FRs covered:** FR16, FR17, FR12 (annulation)

### Epic 43 : Effacer son compte
Un utilisateur quitte l'application en sachant ce qui disparaît : zone sensible, aperçu de l'impact, confirmation rouge avec mot de passe, suppression en une transaction.
**FRs covered:** FR7

### Exigences transverses à toutes les stories

Chaque story, sans le répéter dans ses critères :
- garde la CI verte (types, build API, tests unitaires + e2e) et les tests de caractérisation de 37.1 inchangés hors exceptions de FR13 (NFR6) ;
- ajoute un test de refus serveur pour chaque nouvelle action ou cellule de la matrice (NFR2, AD-6) ;
- évalue le câblage temps réel de tout composant qu'elle ajoute ou touche, selon `docs/checklist.md` (NFR1) ;
- marque ⚠️ tout écart à un écran validé, avec ce qui change et pourquoi (NFR7) ;
- lit en lot (jamais une requête par partie ou par membre) et affiche sans pagination les listes de membres, d'inscrits, de votes et de créneaux, pour des groupes de 4 à 20 personnes et des sondages d'une vingtaine de créneaux (NFR5, FR3) ;
- écrit commentaires et messages d'erreur en français, n'installe aucune dépendance sans accord, et passe par Docker (`pnpm exec prisma` dans le conteneur pour les migrations) (NFR8).

## Epic 37 : La porte — un socle commun, sans rien changer au JDR

Les MJ et les joueurs gardent un JDR identique, posé sur un socle commun prêt pour le ralliement et les futurs systèmes. Ordre imposé par AD-16. **Aucune story de ralliement ne démarre avant la fin de cet épic.** Condition de sortie : CI verte (types, build API, tests unitaires + e2e), attentes des tests existants inchangées sauf les tests de rappel (exception 8 de FR13), aucun changement visible du JDR hors les exceptions de FR13. Chaque étape de la porte livre sa propre migration, l'une après l'autre, sans migration en plusieurs temps (aucune production avant le Palier 11).

### Story 37.1 : Figer le comportement actuel du JDR par des tests de caractérisation

As a MJ ou joueur de JDR,
I want que le comportement actuel de mes parties soit figé par des tests avant tout refactor,
So that la porte ne change rien à ma façon de jouer sans que ce soit détecté.

**Acceptance Criteria:**

**Given** le code actuel, avant toute autre story de l'épic
**When** les tests de caractérisation sont ajoutés pour les zones touchées par la porte
**Then** ils couvrent au minimum : création d'une partie (et le scénario + la séance créés pour un `ONE_SHOT`), les refus de `getOwned` / `getViewable` (403 / 404), l'inscription et sa capacité en épisodique (y compris le gel dès qu'une date existe), le choix d'une date par sondage et l'écriture de `nextSessionDate` / `nextSessionSlot`, le rappel de la veille (`NotificationsService`), `GET /me/party-signals` (rôle, statut, codes), les indisponibilités issues des séances d'autres parties (P9-AD-9), et la forme des DTO de partie et de scénario
**And** ces tests passent sur le code actuel sans aucune modification du code de production
**And** chaque test nomme le comportement qu'il fige, en français, pour servir de référence aux stories suivantes.

### Story 37.2 : Remplacer `mjId` par `ownerId`, le propriétaire de la partie

As a MJ,
I want que ma partie connaisse son propriétaire sous un nom qui vaut pour tous les systèmes,
So that le même socle serve au JDR et, plus tard, au ralliement, sans que rien ne change pour moi.

**Acceptance Criteria:**

**Given** la story 37.1 livrée
**When** la migration renomme `Partie.mjId` en `ownerId`, le rend nullable et passe sa clé étrangère en `onDelete: SetNull` (AD-5)
**Then** aucune donnée n'est perdue et chaque partie existante garde son propriétaire
**And** les DTO exposent `ownerId`, `ownerPseudo`, `ownerDisplayName` à la place de `mjId`, `mjPseudo`, `mjDisplayName`, et le code web est adapté sans aucun changement visible
**And** `XpDistribution.mjId` n'est pas renommé (hors périmètre, AD-5)
**And** les tests de caractérisation de 37.1 passent sans changement d'attentes (hors renommage des champs dans les assertions de forme).

### Story 37.3 : Extraire l'événement de base, le scénario devenant son extension JDR

As a MJ,
I want que mes scénarios reposent sur un « événement » commun, avec le même identifiant,
So that le ralliement puisse réutiliser séances, sondages et inscriptions sans rien dupliquer, et sans réécrire mes données.

**Acceptance Criteria:**

**Given** la story 37.2 livrée
**When** la migration crée `Event` avec, pour chaque `Scenario` existant, une ligne de **même `id`**, y déplace `partieId`, `title`, `description`, `createdAt`, ajoute `Event.ownerId` rempli avec le propriétaire de la partie, et renomme `Seance.scenarioId` en `eventId` (AD-3, AD-16)
**Then** séances, documents, notes et participants existants pointent toujours vers le bon objet
**And** `EventsService` (nouveau module `events/`, couche 2) possède `Event` et ses séances ; `ScenariosService` ne garde que l'extension et crée un scénario par `EventsService.create(…, extend)` dans une seule transaction, l'émission temps réel partant après validation
**And** les clés étrangères sont `Event.partie` Cascade, `Scenario.event` Cascade, `Event.owner` SetNull
**And** une partie `ONE_SHOT` contient exactement un événement, vérifié sous verrou de la partie
**And** les routes `parties/:id/scenarios` et `scenarios/:id/*` gardent leur contrat ; les tests de 37.1 passent sans changement d'attentes.

### Story 37.4 : Poser la date d'une séance en plage continue, une seule source

As a MJ ou joueur,
I want que la date d'une séance soit stockée à un seul endroit, avec son créneau,
So that toutes les vues (calendrier, rappels, prochaine séance) lisent la même date.

**Acceptance Criteria:**

**Given** la story 37.3 livrée
**When** la migration crée `Seance.startDate`, `startSlot`, `endDate`, `endSlot` et les remplit depuis `poll.chosenDate` / `poll.chosenSlot`, sinon depuis `dateValidee` avec un créneau vide, avec `end = start`, puis supprime `dateValidee` (AD-4)
**Then** tous les lecteurs qui utilisaient `poll.chosenDate ?? dateValidee` lisent désormais ces colonnes, et fixer une date ou choisir une option de sondage les écrit
**And** un `startSlot` vide se lit `FULL_DAY` pour les dispos et reste « sans créneau » à l'affichage, comme aujourd'hui
**And** aucune séance n'est dédoublée pour représenter une plage ; seules des plages `start = end` sont écrites dans ce palier
**And** les tests de 37.1 passent sans changement d'attentes.

### Story 37.5 : Déclarer les systèmes et leurs capacités dans un registre unique

As a MJ,
I want que chaque système de jeu déclare sa famille et ses capacités au même endroit,
So that l'application sache ce qu'une partie peut faire sans recopier de liste.

**Acceptance Criteria:**

**Given** la story 37.4 livrée
**When** `GAME_SYSTEMS` (`@master-jdr/shared`) porte pour chaque système `family`, `capabilities`, `kinds`, `openForCreation` (AD-2)
**Then** `ryuutama` est `jdr`, porte toutes les capacités et les trois `kind`, ouvert à la création ; `draconis` et les autres systèmes sans module sont `jdr`, fermés à la création
**And** l'entrée `ralliement` existe (famille `ralliement`, aucune capacité, `kinds` ONE_SHOT et CAMPAGNE_EPISODIQUE) mais reste **fermée à la création** jusqu'à l'épic 38
**And** `familyOf`, `hasCapability`, `kindsOf`, `isOpenForCreation` remplacent `gameSystemHasModule` partout, front et API
**And** changer le système d'une partie vers une autre famille est refusé côté serveur ; `checkPartieKindTransition` ne s'applique qu'à la famille `jdr`
**And** les tests de 37.1 passent sans changement d'attentes.

### Story 37.6 : Faire décider les droits sur une partie et ses événements par un service unique

As a MJ ou joueur,
I want que chaque droit sur une partie soit décidé au même endroit,
So that aucune route ne m'accorde ou ne me refuse quelque chose différemment des autres.

**Acceptance Criteria:**

**Given** la story 37.5 livrée
**When** `PermissionService` (module transverse `permissions/`) expose `assert(userId, action, target)`, `roleOf`, `rolesOf` (en lot) et la politique `jdr` (AD-6)
**Then** pour une cible événement ou séance, la partie est **résolue depuis la cible**, jamais lue dans la route (pas d'IDOR) ; refus 403, introuvable 404, messages en français
**And** `PermissionAction` est une union fermée dans `@master-jdr/shared` couvrant les actions existantes du JDR
**And** `PartiesService`, `ScenariosService`, `EventsService` et `PollService` passent par ce service au lieu de lire le propriétaire ; `getOwned` / `getViewable` y délèguent
**And** une fonction unique `membersOf(partie)` (JDR : propriétaire + `Membership`) sert aux comptes et aux listes
**And** chaque cellule actions × rôles de la famille `jdr` a un test de refus ; les tests de 37.1 passent sans changement d'attentes.

### Story 37.7 : Brancher les capacités JDR sur le service de permission et interdire les lectures directes

As a MJ ou joueur,
I want que personnages, XP, Homme Dragon, rôles de groupe, annonces, invitations et dispos suivent la même règle de droits,
So that le socle soit complet avant d'accueillir le ralliement.

**Acceptance Criteria:**

**Given** la story 37.6 livrée
**When** `characters`, `xp-distributions`, `homme-dragon`, `character-roles`, `announcements`, `invitations`, `invite-links`, `availability`, `party-signals` et `account` passent par `PermissionService`
**Then** l'entrée de chaque service de couche 3 vérifie la capacité du système de la partie (AD-1)
**And** un test balaie les sources et échoue si le propriétaire d'une partie est lu pour décider d'un droit hors de `permissions/`, des projections et des migrations (liste d'exceptions nommée)
**And** `GET /parties` sans paramètre de rôle renvoie toutes les parties de l'utilisateur avec leur rôle ; `?role=mj|player` garde son contrat
**And** les tests de 37.1 passent sans changement d'attentes.

### Story 37.8 : Isoler le calendrier derrière des ports

As a joueur,
I want que mon calendrier et mes indisponibilités restent exacts quand d'autres systèmes arriveront,
So that le calendrier devienne la base commune sans dépendre du JDR.

**Acceptance Criteria:**

**Given** la story 37.7 livrée
**When** `availability/` et `poll/` déclarent `OccupiedSpansPort` et `OwnEventsPort`, implémentés par `events/` et fournis par injection (AD-15)
**Then** ni `availability/` ni `poll/` n'importent plus `parties/` ni `scenarios/`, et le `forwardRef` `PollModule → ScenariosModule` disparaît
**And** `OccupiedSpansPort` ne transmet aucun titre ni aucune identité d'une autre partie ; `OwnEventsPort` alimente le calendrier personnel avec les règles d'affichage actuelles
**And** `nextSessionDate` / `nextSessionSlot` sont recalculés par une seule fonction d'`EventsService` (début de la plus proche plage à venir), appelée après toute écriture de date ; `PollService` ne les écrit plus
**And** les tests de 37.1 (calendrier, indisponibilités, prochaine séance) passent sans changement d'attentes.

### Story 37.9 : Envoyer le rappel de la veille pour chaque séance

As a joueur de JDR,
I want recevoir un rappel la veille de chacune de mes séances datées,
So that je n'oublie aucune séance, et plus seulement la prochaine de la partie.

**Acceptance Criteria:**

**Given** la story 37.8 livrée
**When** la migration crée `Seance.reminderSentAt`, y reporte `Partie.reminderSentAt` sur la séance correspondant à `nextSessionDate` si un rappel était déjà parti, puis supprime la colonne de `Partie` (AD-12, AD-16)
**Then** aucun rappel n'est envoyé deux fois après la migration
**And** la tâche horaire de `NotificationsService` (garde de non-chevauchement inchangée) envoie la veille le rappel de **chaque** séance datée, aux mêmes destinataires qu'aujourd'hui (membres de la partie)
**And** pour une partie de JDR à une seule prochaine séance, l'e-mail reçu est identique à aujourd'hui ; une partie épisodique à plusieurs séances datées en reçoit un par séance (exception 8 de FR13)
**And** seuls les tests de `NotificationsService` qui portaient sur `Partie.reminderSentAt` changent d'attentes ; tous les autres tests de 37.1 passent inchangés.

## Epic 38 : Tout le monde peut créer, et voir ses ralliements

N'importe quel utilisateur connecté crée une quête ou un ralliement (soirée isolée ou groupe) depuis un bouton d'en-tête, et le retrouve dans sa liste, reconnaissable à sa pastille et à son badge de système. Les écrans validés modifiés portent ⚠️ (contrat UI).

### Story 38.1 : Créer depuis un bouton d'en-tête, pour tout utilisateur

As a joueur ou nouvel inscrit,
I want un bouton pour créer, visible partout dans l'application,
So that je puisse organiser quelque chose même si je ne suis MJ d'aucune partie.

**Acceptance Criteria:**

**Given** un utilisateur connecté, MJ ou non, sur n'importe quelle page
**When** il regarde l'en-tête
**Then** ⚠️ le bouton de création n'est plus dans le contenu de la page « Parties » ni réservé aux MJ (`hasMjParties()`) : il est dans l'en-tête, pour tout utilisateur connecté (FR18, UX-DR1)
**And** sur bureau, il est au bord droit de la barre du haut, en pilule pleine avec le libellé du thème (« Lancer une quête », « Ouvrir un sentier », « Initier une mission »)
**And** sur mobile, il est à droite du titre de l'en-tête contextuel, en icône seule de 48 × 40 avec une zone de toucher de 44 px, son nom accessible étant le libellé du thème ; le titre n'est jamais raccourci (UX-DR20)
**And** ⚠️ l'icône est le d20 du logo traversé d'un crayon, en SVG `currentColor`, sans masque ni identifiant, lisible à 24 px ; elle remplace le « + » (UX-DR2)
**And** un clic ouvre `/parties/new`.

### Story 38.2 : Choisir quête ou ralliement à la création

As a utilisateur qui crée,
I want choisir entre une quête de JDR et un ralliement, puis le type de ralliement,
So that je crée exactement ce que je veux organiser.

**Acceptance Criteria:**

**Given** la story 38.1 livrée
**When** l'utilisateur ouvre le formulaire de création
**Then** ⚠️ l'ordre est : couverture → nom → **bascule** → champs du mode → description (toujours dernière) (UX-DR3)
**And** la bascule à deux options porte les libellés du thème (Ralliement | Quête, Veillée | Sentier, Rassemblement | Mission), est un groupe nommé annoncé (`aria-pressed` ou radiogroup), et changer d'option reconfigure les champs suivants sans effacer le nom ni la description (UX-DR4)
**And** « Quête » propose le livre de règles puis la nature de la quête (comportement actuel) ; « Ralliement » propose seulement la nature du ralliement, avec ses deux types (isolé, durable) aux noms du thème (UX-DR17)
**And** l'entrée `ralliement` du registre est **ouverte à la création** ; créer un ralliement isolé crée une partie `ONE_SHOT` avec son unique `Event` et sa séance non datée, sans `Scenario` ; créer un groupe crée une partie `CAMPAGNE_EPISODIQUE`
**And** la migration ajoute `Membership.role` (`ADMIN` | `MEMBER`, défaut `MEMBER`, union fermée partagée) ; le créateur d'un ralliement est inscrit comme membre `ADMIN` dans la même transaction (AD-7)
**And** la politique `ralliement` de `PermissionService` couvre « voir » et « modifier la partie », avec des tests de refus
**And** le libellé du bouton final en mode ralliement et les libellés de champs des thèmes forêt et atelier, non arrêtés par l'UX (open items n° 3 et 4), sont proposés au début de la story et relus avec l'utilisateur ; « La halte au gué » reste le nom provisoire
**And** le mode ne peut plus changer : la bascule n'apparaît pas à l'édition, et le serveur refuse tout changement de famille ou de forme d'un ralliement (FR1).

### Story 38.3 : Changer la couverture depuis la bannière

As a utilisateur qui crée ou modifie une partie,
I want voir la bannière en grand et la changer d'un geste,
So that la couverture ne soit plus une ligne brute avec un bouton de navigateur.

**Acceptance Criteria:**

**Given** le formulaire de création ou d'édition, en quête comme en ralliement
**When** l'utilisateur regarde le haut du formulaire
**Then** ⚠️ la ligne « Enluminer… / Choisir un fichier / Aucun fichier choisi » et la vignette de 40 px sont remplacées par une bannière d'aperçu pleine largeur de 170 px, arrondie à 14 px (UX-DR5)
**And** une puce translucide « Changer » (flou, crayon de 16 px) est posée en bas à droite de la bannière ; l'`<input type=file>` natif est masqué sous elle
**And** si une image personnelle existe, une seconde puce « Retirer » apparaît à côté
**And** sans image personnelle, l'aperçu est la bannière générée (comportement actuel) ; l'envoi passe par l'utilitaire d'upload existant (P9-AD-17).

### Story 38.4 : Afficher la page d'une partie selon sa famille

As a membre d'un ralliement,
I want une page qui ne me parle pas de MJ, de scénario ni de personnage,
So that un ralliement ne ressemble pas à une partie de JDR vidée.

**Acceptance Criteria:**

**Given** les stories 38.2 et 38.3 livrées
**When** un utilisateur ouvre une partie
**Then** les onglets se déduisent de `family` + `kind` via le registre : le JDR garde ses cinq onglets inchangés ; un ralliement n'affiche que « Détails » et « Missives » à ce stade (les onglets de conjonctions arrivent aux épics 39 et 41)
**And** aucune section ni action d'une capacité absente n'apparaît (XP, Homme Dragon, personnages, scénarios, visibilité), et le serveur refuse ces actions pour un ralliement (AD-1)
**And** hors JDR, l'interface n'emploie ni « MJ », ni « campagne », ni « scénario », ni « séance », ni « joueur » ; les libellés passent par le registre de textes, une variante par thème (FR15, UX-DR17)
**And** le sous-titre de l'en-tête dit le type de ralliement (« Ralliement · La convergence des Sortilèges »).

### Story 38.5 : Reconnaître ses ralliements dans la liste

As a utilisateur qui a des quêtes et des ralliements,
I want les distinguer d'un coup d'œil et pouvoir les filtrer,
So that ma liste reste lisible quand les deux se mélangent.

**Acceptance Criteria:**

**Given** la story 38.4 livrée
**When** l'utilisateur ouvre sa liste d'accueil
**Then** ⚠️ chaque tuile porte une pastille texte avec le nom du système (« Ryuutama », « Draconis », « Ralliement ») et un badge rond de 26 px au coin de la vignette (glyphe de 19 px, décoratif) : R1 pour Ryuutama, L1 pour le ralliement, en SVG sans masque ni identifiant ; Draconis n'a que la pastille (UX-DR15)
**And** ⚠️ le sous-titre des tuiles est réduit à la nature (« Chronique », « La convergence des Sortilèges ») ; l'indicateur de rôle affiche le rôle traduit (JDR : Maître / Héros ; ralliement : libellés de travail Admin, Membre, Hôte, Invité selon le type)
**And** ⚠️ le panneau de filtres gagne « Genre » (Tous / Quêtes / Ralliements), un « Rang » étendu aux rôles du ralliement, et une case « Grouper par type » qui divise la liste en sections Quêtes et Ralliements (UX-DR14)
**And** les rôles de toute la liste viennent de `rolesOf` en lot (union `mj | player | admin | member`) ; `GET /me/party-signals` n'émet aucun code de couche 3 pour un ralliement (AD-13)
**And** créer un ralliement rafraîchit la liste sans recharger (canal `user:{id}`).

## Epic 39 : Rassembler sa bande

Un groupe vit : vue à onglets, invitations, admins multiples (nommer, quitter l'office), départ et retrait d'un membre par une procédure unique. Premier e-mail du ralliement, et gabarit commun restylé pour tous les e-mails de l'application.

### Story 39.1 : Ouvrir un groupe sur ses conjonctions

As a membre d'un groupe,
I want arriver sur l'onglet des conjonctions de mon groupe,
So that je voie d'abord ce qui se prépare.

**Acceptance Criteria:**

**Given** un groupe de ralliement (épic 38)
**When** un membre ouvre la page du groupe
**Then** ⚠️ les onglets sont, dans l'ordre, « Conjonctions » (ouvert par défaut), « Détails », « Missives », avec les noms du thème (« Conjonctions », « Haltes », « Réunions ») ; une partie de JDR garde ses onglets et son onglet par défaut (UX-DR6)
**And** l'onglet « Conjonctions » affiche ses sections « À venir » puis « Passées », et un état vide « Aucune conjonction pour l'instant » tant qu'il n'y en a pas
**And** « Détails » porte la description et les réglages, sans cartes d'événements
**And** le pied de page garde « Retranscrire », « Clore » et « Brûler » pour les admins ; « Sceller des secrets » n'existe pas pour un groupe.

### Story 39.2 : Donner un gabarit commun à tous les e-mails

As a destinataire d'un e-mail de l'application,
I want des e-mails à la marque « Dés Dispos », avec un vrai bouton,
So that je reconnaisse l'expéditeur et trouve l'action d'un coup d'œil.

**Acceptance Criteria:**

**Given** les gabarits existants (invitation, rappel de séance, mot de passe, changement d'e-mail, niveau)
**When** un e-mail part
**Then** ⚠️ son action est un bouton vert plein et non plus un lien souligné, et son pied dit « Dés Dispos » et non plus « jdr-master » (exception 7 de FR13, UX-DR18)
**And** le gabarit commun est unique (`layout.hbs`) et sert à tous les e-mails, existants et futurs
**And** le texte et les destinataires des e-mails existants ne changent pas ; leurs tests ne vérifient que la présence du bouton et du pied.

### Story 39.3 : Inviter quelqu'un dans un groupe

As a admin d'un groupe,
I want inviter des amis par leur pseudo, leur e-mail ou un lien,
So that ma bande rejoigne le groupe.

**Acceptance Criteria:**

**Given** les stories 39.1 et 39.2 livrées
**When** un admin invite depuis « Missives » (recherche de pseudo, e-mail, lien d'invitation)
**Then** l'invitation vise le **groupe** ; l'accepter crée un `Membership` `MEMBER` (FR4)
**And** seul un admin peut inviter ou retirer : un membre non admin reçoit un refus serveur, couvert par un test (matrice, AD-6)
**And** l'e-mail « *Marc* vous invite à rejoindre « *Groupe* » » part avec le gabarit commun, en vocabulaire neutre et avec le bouton « Rejoindre le groupe » (FR12, UX-DR18)
**And** un nouveau membre apparaît dans la liste des autres membres sans rechargement (`notifyPartieSignalsChanged`, AD-13).

### Story 39.4 : Nommer des admins et quitter l'office

As a admin d'un groupe,
I want nommer d'autres admins et pouvoir rendre mon rôle,
So that le groupe ne dépende pas d'une seule personne.

**Acceptance Criteria:**

**Given** la story 39.3 livrée
**When** un admin consulte « Missives »
**Then** chaque admin porte un badge « Admin » (bouclier), dans « Missives » et sur son avatar du rail ; chaque membre non admin a l'action « Nommer admin » ; sa propre ligne porte « Quitter l'office », aussi proposé au pied de page de la vue (UX-DR6, UX-DR11) ; le badge d'avatar, non dessiné, suit la proposition de l'UX (bouclier de 14 px au coin de l'avatar) et est relu avec l'utilisateur
**And** « Nommer admin » ouvre la confirmation « Nommer *Léa* administratrice… » puis passe le membre en `ADMIN` (`PATCH /parties/:id/members/:userId/role`)
**And** « Quitter l'office » ouvre « Quitter l'office d'administrateur… ? Vous restez membre du groupe. » quand il reste un autre admin ; s'il est le dernier, la confirmation annonce la suppression du groupe avec ses membres et ses conjonctions, et le bouton « Quitter et supprimer » est **rouge** (FR5, UX-DR12)
**And** ⚠️ la fenêtre de confirmation (« Votre accord », « Renoncer » = annuler) gagne une variante rouge pour l'irréversible, aussi utilisée par « Brûler » (supprimer le groupe)
**And** toute opération qui change le nombre d'admins prend d'abord un verrou `FOR UPDATE` sur la partie puis recompte : deux départs simultanés ne laissent jamais un groupe sans admin (AD-7)
**And** ces actions n'existent pas pour une soirée isolée ; un non-admin reçoit un refus serveur testé.

### Story 39.5 : Quitter un groupe ou en retirer un membre

As a membre d'un groupe,
I want pouvoir partir de moi-même, et qu'un admin puisse retirer quelqu'un,
So that le groupe reflète la bande réelle.

**Acceptance Criteria:**

**Given** la story 39.4 livrée
**When** un membre choisit « Quitter le groupe » dans le pied de page, ou qu'un admin choisit « Retirer » sur un membre
**Then** les deux passent par la procédure unique `PartiesService.leave(partieId, userId, cause)` (AD-17), sous verrou de la partie
**And** le `Membership` est retiré ; si la personne était propriétaire, `ownerId` devient vide ; si c'était le dernier admin, le groupe est supprimé après la confirmation de la story 39.4
**And** le départ volontaire passe par `DELETE /parties/:id/members/me` ; un retrait par un non-admin est refusé
**And** `leave()` est la seule porte de sortie et s'étendra sans nouvelle route : l'épic 40 y ajoute le retrait des inscriptions et des votes à venir, l'épic 42 l'annulation des événements que la personne hébergeait
**And** le groupe disparaît de la liste de la personne partie, et la liste des membres des autres se met à jour sans rechargement
**And** en JDR, le retrait d'un joueur garde son comportement actuel.

## Epic 40 : Les conjonctions d'un groupe

Un membre propose une conjonction ; les autres s'y inscrivent ou acceptent une place réservée ; la date est fixée directement ou trouvée ensemble par un sondage (résumé, fixer la date, prolonger, relance la veille de l'échéance). Le vote lui-même se fait dans le calendrier du groupe, en mode « composer » existant, en attendant le Palier 10.4.

### Story 40.1 : Proposer une conjonction à date fixée

As a membre d'un groupe,
I want proposer une conjonction avec un jour et un créneau,
So that la bande sache quand et où on se retrouve.

**Acceptance Criteria:**

**Given** l'épic 39 livré
**When** un membre clique « + Nouvelle conjonction » dans l'onglet Conjonctions
**Then** la fenêtre de conjonction s'ouvre en mode création, avec dans l'ordre : nom (obligatoire), bascule « Date fixée | Sondage de dates » (seule « Date fixée » est active dans cette story), lieu, heure de rendez-vous facultative (étiquette « HH:MM », jamais un instant), infos pratiques facultatives, participation « Tous les membres | Places limitées » avec un stepper du nombre de places (l'hôte en occupe une), et le pied « Renoncer » · « Créer la conjonction » (UX-DR9, FR8)
**And** `POST /parties/:id/events` crée, dans une transaction d'`EventsService`, l'`Event` dont le membre est l'hôte (`ownerId`, immuable) et son unique séance datée (`startDate`/`startSlot`, `end = start`) ; la route refuse une partie de JDR et un non-membre, refus testés (AD-3, AD-6)
**And** la conjonction apparaît sous forme de carte dans « À venir », sans rechargement chez tous les membres ; une fois sa date passée, elle passe dans « Passées » (UX-DR7, NFR1)
**And** la carte montre le titre, le badge d'état (« À venir », « Dans *n* jours » en plein quand la date est proche, « Passé »), la date en gras, l'hôte, le lieu et la ligne « Ma situation » ; la grille garde des cartes de 250 px minimum, une seule colonne sous 520 px
**And** le groupe passe au statut « En cours » dès sa première conjonction (AD-18), et sa date entre dans `nextSessionDate`, les indisponibilités des membres et leur calendrier personnel (AD-15)
**And** un `startSlot` est toujours renseigné pour une conjonction : un ralliement n'écrit jamais de journée sans créneau
**And** l'avertissement rouge du dernier admin qui quitte l'office (story 39.4) cite le vrai nombre de conjonctions du groupe, et non plus le « 0 » provisoire de `conjonctionCount` dans `PartieDetail`.

### Story 40.2 : Consulter et modifier une conjonction dans sa fenêtre

As a membre d'un groupe,
I want ouvrir une conjonction par-dessus la liste et y voir ma situation d'abord,
So that je sache tout de suite ce qu'on attend de moi.

**Acceptance Criteria:**

**Given** la story 40.1 livrée
**When** un membre clique ou appuie sur Entrée sur une carte
**Then** ⚠️ la fenêtre (`DetailSurface`) s'élargit à `min(900px, 96vw)` et 94 vh avec un défilement interne, pour la conjonction seulement ; plein écran sur mobile (UX-DR8, UX-DR20)
**And** l'ordre est : titre + badge d'état → encadré de situation → la fiche (date, hôte, lieu, heure, participation « 8 places · 5 inscrits · 3 libres » ou « Tous les membres », infos pratiques) → inscrits en pastilles (avatar 26 px + nom, la sienne bordée) → pied
**And** le titre de la fenêtre est le nom de la conjonction ; le focus y est piégé, puis rendu à la carte ; Échap, « Refermer » et le retour du navigateur rendent la liste intacte (UX-DR19)
**And** l'hôte voit « Modifier » au pied : la même fenêtre repasse en mode édition, tant que la conjonction n'est pas passée ; un autre membre reçoit un refus serveur, testé (FR8)
**And** le lieu est visible de tous les membres du groupe et de personne d'autre (NFR2)
**And** ⚠️ le badge d'admin reporté de la story 39.4 (sa page de groupe n'a pas de rail d'avatars) : dans les pastilles d'inscrits, l'avatar d'un admin du groupe porte le bouclier de 14 px au coin (UX-DR11) ; badge non dessiné, il suit la proposition de l'UX et est relu avec l'utilisateur ; le mot « Admin » reste porté en texte pour l'accessibilité (la couleur ou le glyphe ne portent jamais seuls).

### Story 40.3 : S'inscrire à une conjonction et s'en désinscrire

As a membre d'un groupe,
I want dire que je viens, ou que je ne viens plus,
So that l'hôte sache sur qui compter.

**Acceptance Criteria:**

**Given** la story 40.2 livrée
**When** un membre s'inscrit depuis la fenêtre
**Then** en « Tous les membres », s'inscrire confirme sa venue, sans limite ; en « Places limitées », premier arrivé, premier servi, sans liste d'attente, et la carte affiche « Complet » à qui n'est pas inscrit quand il n'y a plus de place (FR9)
**And** l'inscription reste possible après la date fixée (inscription tardive) ; la date, elle, ne bouge pas (FR10)
**And** la désinscription est libre, par « Me désinscrire » au pied, tant que la conjonction n'est pas passée
**And** toute écriture d'inscription ou de capacité prend d'abord le verrou `FOR UPDATE` de la ligne `Event` : deux inscriptions simultanées sur la dernière place n'en acceptent qu'une, testé (AD-8)
**And** en JDR, l'inscription garde son comportement actuel (épisodique seul, capacité obligatoire, gel dès qu'une date existe) : les tests de 37.1 passent inchangés
**And** la pastille « Ma situation » dit « Je participe », « Pas inscrit·e » ou « J'y étais », écrite et pas seulement colorée ; la liste des inscrits se met à jour chez tous sans rechargement
**And** `reminderRecipients(seance)` couvre le groupe : l'hôte et les inscrits `CONFIRMED` reçoivent la veille l'e-mail n° 5 « Demain : « *Conjonction* » » (date · lieu, bouton « Voir la rencontre »), en vocabulaire neutre avec le gabarit commun ; le JDR garde ses destinataires et son e-mail (AD-12, AD-15, FR12).

### Story 40.4 : Réserver une place à des membres

As a hôte d'une conjonction à places limitées,
I want garder une place à quelques membres précis,
So that mes amis indispensables ne se la fassent pas prendre.

**Acceptance Criteria:**

**Given** la story 40.3 livrée
**When** la migration ajoute `Inscription.status` (`RESERVED` | `CONFIRMED`, défaut `CONFIRMED`, union fermée partagée), et que l'hôte choisit des membres dans « Réserver une place à des membres », à la création ou ensuite
**Then** chaque réservation est une inscription `RESERVED` qui compte dans la capacité, n'expire jamais, et que l'hôte seul peut créer ou retirer (`POST …/seances/:id/reservations`, `DELETE …/reservations/:userId`) ; refus testés (AD-8, AD-14)
**And** la personne visée reçoit l'e-mail n° 3 « *Léa* vous a réservé une place : « *Conjonction* » », bouton « Répondre », avec le gabarit commun (FR12)
**And** elle voit le signal `RESERVATION_A_CONFIRMER` dans sa liste et la pastille « Place réservée » ; l'accepter (`PATCH …/inscription/accept`) la passe en `CONFIRMED`, la décliner supprime la ligne et libère la place (AD-13)
**And** l'hôte seul voit une réservation non acceptée, en pastille pointillée au texte à plein contraste (≥ 4,5:1) ; les autres membres ne la voient pas et la voient comme inscrite une fois acceptée (UX-DR8, NFR4)
**And** réservation, acceptation et refus passent par le verrou de l'`Event` ; chacune émet vers les membres et vers `user:{id}` de la personne visée.

### Story 40.5 : Proposer une conjonction par sondage de dates

As a membre qui propose une conjonction,
I want proposer plusieurs créneaux et une échéance,
So that on trouve ensemble le jour qui arrange le plus de monde.

**Acceptance Criteria:**

**Given** la story 40.4 livrée
**When** le membre choisit « Sondage de dates » dans la fenêtre de création
**Then** le bouton « Choisir les créneaux dans le calendrier » ouvre le calendrier du groupe en mode « composer » existant ; au retour, la fenêtre résume les créneaux (« 4 créneaux · ven. 17 → sam. 25 oct. », modifiable), et un champ « Le vote se termine le » fixe l'échéance (UX-DR9)
**And** le sondage s'ouvre dès que les créneaux sont posés, à la création ou plus tard, sans plafond de créneaux ; sondage et inscriptions coexistent (FR10, FR11, AD-4)
**And** `eligibleVoters(event)` est l'unique définition des ayants droit : « Tous les membres » → membres du groupe ; « Places limitées » → inscrits `CONFIRMED` ; le DTO de l'événement porte leurs identifiants (AD-6)
**And** un vote hors des ayants droit, ou après l'échéance, est refusé par le serveur en ralliement, testé ; en JDR, le vote garde son comportement actuel
**And** la carte affiche « Date à voter · jusqu'au *date* » et le badge « Vote en cours », orange tant que je n'ai pas voté, cyan ensuite (UX-DR7)
**And** l'encadré de situation d'un ayant droit dit « Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le *date*. », avec « Vos réponses : *x* créneaux sur *N* », « Meilleur créneau pour l'instant : *date* — *n* oui » et le bouton « Voter dans le calendrier » vers le calendrier du groupe, sans focus sur ce vote (Palier 10.6)
**And** l'encadré de l'hôte dit « Vous êtes l'hôte. Le vote se termine dans *n* jours — *N* créneaux proposés. », avec « Réponses : *x* sur *N* », « Meilleur créneau » et « N'ont pas encore répondu : *noms* » ; ce résumé est calculé côté écran depuis les ayants droit et les votes, et suit les votes en temps réel (NFR1)
**And** chaque créneau candidat montre combien d'inscrits sont disponibles d'après leurs dispos (FR10).

### Story 40.6 : Fixer la date d'une conjonction

As a hôte d'une conjonction en sondage,
I want choisir la date parmi les créneaux, du plus au moins plébiscité,
So that le vote se conclue et que tout le monde soit prévenu.

**Acceptance Criteria:**

**Given** la story 40.5 livrée
**When** l'hôte clique « Fixer la date… » dans l'encadré
**Then** la confirmation n° 5 liste les créneaux en boutons radio, triés du plus au moins plébiscité avec leurs « *n* oui · *n* peut-être · *n* non », le meilleur présélectionné, et le texte « La date sera scellée et les inscrits prévenus par e-mail. Elle ne pourra plus être rouverte ; les inscriptions tardives restent possibles. » (UX-DR12)
**And** fixer la date, sous le verrou de l'`Event`, écrit la plage de la séance, ferme le sondage et recalcule `nextSessionDate` par la fonction unique d'`EventsService` ; seul l'hôte le peut, refus testé (FR11, AD-8)
**And** les inscrits reçoivent l'e-mail n° 4 « C'est fixé : « *Conjonction* », *date* », bouton « Voir la rencontre », envoyé après validation de la transaction (FR12)
**And** la date ne se rouvre jamais, et plus aucun vote n'est accepté ; l'encadré de situation est remplacé par la date, l'heure et le lieu en grand
**And** la date fixée alimente rappels de la veille (story 37.9), indisponibilités et calendriers personnels.

### Story 40.7 : Prolonger le vote et relancer la veille de l'échéance

As a hôte d'une conjonction en sondage,
I want repousser l'échéance, et que les retardataires soient relancés une fois,
So that le vote ne se termine pas avant que tout le monde ait répondu.

**Acceptance Criteria:**

**Given** la story 40.6 livrée
**When** la migration ajoute `SessionPoll.relanceSentAt`, et que l'hôte clique « Prolonger le vote »
**Then** la confirmation n° 6 affiche « « *Conjonction* » — le vote se termine le *date*. », un champ « Nouvelle échéance » postérieure à l'actuelle, et « Les personnes qui n'ont pas encore voté seront relancées la veille de la nouvelle échéance. » (UX-DR12)
**And** prolonger met à jour l'échéance et remet `relanceSentAt` à vide ; seul l'hôte le peut, refus testé ; c'est une capacité nouvelle, sans équivalent dans le JDR, qui n'y est pas exposée (FR11)
**And** la tâche horaire de `NotificationsService` envoie, un jour avant l'échéance et **une seule fois**, l'e-mail n° 6 « Plus qu'un jour pour voter : « *Conjonction* » », bouton « Voter dans le calendrier », aux seuls ayants droit (`eligibleVoters`) qui n'ont pas voté, puis écrit `relanceSentAt` (AD-12)
**And** aucune relance ne part pour un sondage dont la date est fixée ; aucun autre e-mail récapitulatif ni aucune autre relance n'existe (FR12)
**And** les tests couvrent : envoi unique, destinataires sans réponse seulement, nouvel envoi après une prolongation.

### Story 40.8 : Libérer places et votes de qui quitte le groupe

As a membre d'un groupe,
I want que les places et les votes d'une personne partie soient libérés,
So that les conjonctions à venir reflètent ceux qui viendront vraiment.

**Acceptance Criteria:**

**Given** les stories 39.5 et 40.7 livrées
**When** un membre quitte le groupe ou en est retiré, par `PartiesService.leave()`
**Then** ses inscriptions `RESERVED` et `CONFIRMED` aux conjonctions **à venir** sont supprimées, ce qui libère les places, et ses votes sur les sondages **ouverts** sont supprimés (FR6, AD-17)
**And** le passé est conservé : il reste parmi les participants des conjonctions passées
**And** les conjonctions à venir dont il est l'hôte restent en place jusqu'à l'épic 42, qui les annulera dans cette même procédure
**And** les fenêtres et les cartes concernées se mettent à jour chez tous les membres sans rechargement ; un test couvre le départ d'un inscrit sur la dernière place.

## Epic 41 : La soirée isolée

On organise une rencontre unique avec ses invités : page sans liste, invitations à accepter ou décliner, fenêtre de création ouverte d'emblée, statut « terminée » une fois passée. Elle réutilise la fenêtre, le sondage, la date fixée et les e-mails de l'épic 40 ; seuls changent les ayants droit (les invités acceptés) et la mise en page.

### Story 41.1 : Afficher une soirée isolée sur une seule page

As a hôte ou invité d'une soirée isolée,
I want une page qui montre directement la rencontre,
So that je n'aie pas à chercher la seule chose qui compte dans une liste.

**Acceptance Criteria:**

**Given** l'épic 40 livré
**When** un membre ouvre une soirée isolée (ralliement `ONE_SHOT`)
**Then** le premier onglet, au nom du thème au singulier (« Conjonction », « Halte », « Réunion »), affiche **en ligne** le détail de son unique événement (titre + badge, encadré de situation, fiche, pied), sans carte ni fenêtre ; il n'y a pas d'onglet « Détails » (UX-DR10)
**And** le second onglet est « Invités » pour un invité (liste des participants) et « Invitations » pour l'hôte (liste et gestion) ; la liste des participants n'apparaît pas dans le premier onglet
**And** le sous-titre de l'en-tête dit « Ralliement · *type* » (« Ralliement · La conjonction des Esprits »)
**And** la politique `ralliement` + `ONE_SHOT` s'applique : un seul admin, le propriétaire, qui est l'hôte ; ni « Nommer admin » ni « Quitter l'office », refusés par le serveur et testés (AD-6)
**And** la soirée ne se rattache jamais à un groupe : aucune route ne permet de la déplacer, ni de lui ajouter un second événement (exactement un événement, AD-3) (FR2).

### Story 41.2 : Poser la rencontre dès la création de la soirée

As a hôte qui vient de créer une soirée isolée,
I want que la fenêtre de la rencontre s'ouvre tout de suite,
So that je fixe la date ou lance le sondage sans chercher où le faire.

**Acceptance Criteria:**

**Given** la story 41.1 livrée
**When** l'hôte valide le formulaire de création d'une soirée isolée
**Then** la fenêtre de conjonction s'ouvre en mode création par-dessus la page de la soirée, pré-remplie avec le nom, et elle complète l'**événement déjà créé** avec la partie (story 38.2) au lieu d'en créer un second (UX-DR9, FR2)
**And** la participation y est en lecture seule : « Sur invitation · pas de limite — vous invitez ensuite depuis l'onglet Invitations » ; ni places limitées ni réservations
**And** la date se fixe directement (jour + créneau) ou par sondage, avec le même parcours que les stories 40.5 à 40.7 ; les ayants droit au vote sont les membres de la soirée, c'est-à-dire l'hôte et les invités acceptés (`eligibleVoters`, AD-6)
**And** « Renoncer » laisse la soirée créée, avec une rencontre « Date à fixer » que l'hôte complète plus tard depuis le premier onglet
**And** l'hôte modifie la rencontre tant qu'elle n'est pas passée ; les e-mails n° 4 (date fixée), n° 5 (veille) et n° 6 (relance) partent aux membres de la soirée.

### Story 41.3 : Inviter à une soirée, accepter ou décliner

As a hôte d'une soirée isolée,
I want inviter qui je veux, sans limite, et savoir qui vient,
So that la soirée réunisse les bonnes personnes.

**Acceptance Criteria:**

**Given** la story 41.2 livrée
**When** l'hôte invite depuis l'onglet « Invitations » (recherche de pseudo, e-mail, lien d'invitation, création ou révocation d'un lien)
**Then** l'invitation est l'`Invitation` existante au niveau de la partie, sans limite de nombre ; l'hôte seul invite et retire, refus testés (AD-8, FR2)
**And** l'invité reçoit l'e-mail n° 2 « *Marc* vous invite : « *Soirée* » » (« date à voter jusqu'au … · chez … »), bouton « Accepter ou décliner », avec le gabarit commun (FR12)
**And** tant qu'un invité nominatif n'a pas répondu, un bandeau « Accepter / Décliner » s'affiche en tête de page, avant tout vote ; la pastille dit « Invitation à accepter » ; l'invitation reste dans la section « invitations » existante de sa liste (AD-13)
**And** accepter crée le `Membership` et ouvre le vote ; décliner supprime l'invitation ; un invité qui n'a pas accepté ne peut pas voter, refus testé (FR2, FR11)
**And** l'hôte retire un invité avant la soirée par la procédure `leave()` : ses votes ouverts disparaissent ; l'onglet « Invitations » affiche « Aucun invité pour l'instant » quand il est vide
**And** chaque réponse met à jour la page de l'hôte et la liste d'accueil sans rechargement (NFR1).

### Story 41.4 : Clore une soirée une fois passée

As a hôte ou invité,
I want qu'une soirée passée apparaisse terminée et ne bouge plus,
So that ma liste distingue ce qui vient de ce qui a eu lieu.

**Acceptance Criteria:**

**Given** la story 41.3 livrée
**When** la date d'une soirée isolée est passée, ou qu'elle a été close
**Then** son statut est « Terminée » par la fonction unique de statut : isolée → `closedAt` ou plage passée → TERMINEE, sinon A_VENIR (AD-18) ; sans date fixée, elle reste « À venir »
**And** la soirée passée est figée : plus d'invitation, de vote, de modification ni de retrait d'invité, refusés par le serveur et testés (FR2)
**And** la tuile de la liste et le badge de la rencontre passent à « Terminée » / « Passé » sans rechargement, et la soirée est masquée par la case existante qui masque les parties closes (`dashboard.hide_finished_label`)
**And** la pastille « Ma situation » dit « J'y étais » pour les membres.

## Epic 42 : Annuler et ranger

On annule une conjonction ou une soirée isolée (prévenant les participants), et chacun retire de sa liste ce qui est terminé ou annulé, JDR compris.

### Story 42.1 : Annuler une conjonction de groupe

As a hôte d'une conjonction, ou admin du groupe,
I want annuler une conjonction qui n'aura pas lieu,
So that personne ne se déplace pour rien.

**Acceptance Criteria:**

**Given** l'épic 41 livré
**When** la migration ajoute `Event.cancelledAt` (ralliement seulement), et que l'hôte, ou tout admin du groupe, choisit « Annuler la conjonction » au pied de la fenêtre avant sa date
**Then** une confirmation à bouton **rouge** demande l'accord ; l'annulation est définitive et sans retour (FR16, UX-DR12)
**And** sous le verrou de l'`Event`, `cancelledAt` est écrit et le sondage éventuel est fermé par `PollService` ; toute action ultérieure (inscription, réservation, vote, date, modification) est refusée par le serveur ; un membre ni hôte ni admin ne peut pas annuler, et une conjonction passée non plus : refus testés (AD-9)
**And** une conjonction annulée sort des rappels, des relances, des indisponibilités, de `nextSessionDate` et des calendriers personnels (AD-12, AD-15)
**And** l'e-mail n° 7 « Annulée : « *Conjonction* » » (« *Hôte* a annulé … Vous n'avez rien à faire. », bouton « Voir ») part après validation aux inscrits et aux places réservées (FR12)
**And** la carte annulée reste dans sa section et reste cliquable : contenu estompé à 50 %, trait diagonal rouge semi-transparent, badge « Annulée » écrit ; la fenêtre affiche l'état « Annulée » en tête, sans aucune action (UX-DR16, NFR4)
**And** le rouge de statut atteint le contraste requis dans les trois thèmes, vérifié et noté dans la story (NFR4).

### Story 42.2 : Annuler une soirée isolée

As a hôte d'une soirée isolée,
I want annuler la soirée,
So that mes invités sachent qu'elle n'aura pas lieu.

**Acceptance Criteria:**

**Given** la story 42.1 livrée
**When** l'hôte annule la rencontre de sa soirée avant sa date
**Then** la même procédure qu'en 42.1 s'applique à son unique événement ; la soirée prend le statut **ANNULEE**, distinct de TERMINEE, par la fonction unique de statut (AD-18)
**And** l'e-mail n° 7 part aux membres de la soirée et aux invités nominatifs qui n'ont pas encore répondu ; les invitations en attente et les liens d'invitation sont révoqués (FR16)
**And** les membres voient le signal `PARTIE_ANNULEE` ; la tuile de la liste affiche l'état « Annulée » (trait diagonal, mot écrit) et reste cliquable ; tout se met à jour sans rechargement (AD-13, UX-DR16)
**And** une soirée annulée n'accepte plus aucune action, refus testés.

### Story 42.3 : Annuler les conjonctions de qui quitte le groupe

As a membre d'un groupe,
I want que les conjonctions d'un hôte parti soient annulées et que leurs inscrits soient prévenus,
So that personne n'attende une soirée sans hôte.

**Acceptance Criteria:**

**Given** les stories 40.8 et 42.1 livrées
**When** un membre quitte le groupe ou en est retiré par `PartiesService.leave()`
**Then** les conjonctions **à venir** dont il est l'hôte sont annulées par la procédure de la story 42.1, dans la même transaction, et leurs inscrits reçoivent l'e-mail n° 7 après validation (FR6, AD-17)
**And** les conjonctions passées qu'il a hébergées restent intactes, avec leur hôte affiché
**And** un test couvre le départ d'un hôte qui a une conjonction à venir et une passée.

### Story 42.4 : Filtrer et masquer les parties annulées

As a utilisateur,
I want filtrer ma liste sur les annulées, ou les masquer avec les terminées,
So that ma liste ne montre que ce qui compte.

**Acceptance Criteria:**

**Given** la story 42.2 livrée
**When** l'utilisateur ouvre le panneau de filtres de sa liste d'accueil
**Then** ⚠️ le filtre « Phase » gagne « Annulée », et la case « Masquer les … clos » (`dashboard.hide_finished_label`, libellé par thème : « Masquer les grimoires clos »…) masque aussi les annulées, et son libellé le dit dans les trois thèmes ; la préférence enregistrée de l'utilisateur garde son comportement actuel (UX-DR14)
**And** les filtres s'appliquent aux quêtes comme aux ralliements ; une partie de JDR n'a jamais le statut ANNULEE.

### Story 42.5 : Retirer de sa liste une partie terminée ou annulée

As a utilisateur, MJ, joueur ou membre,
I want retirer définitivement de ma liste une partie terminée ou annulée,
So that ma liste ne s'encombre pas de ce qui est fini.

**Acceptance Criteria:**

**Given** la story 42.4 livrée
**When** la migration crée `PartieHidden(userId, partieId)`, et que l'utilisateur choisit « Retirer de ma liste » sur une partie terminée ou annulée, JDR compris
**Then** la confirmation n° 4 dit « Retirer « *nom* » de votre liste ? Elle disparaîtra définitivement pour vous seul ; les autres participants la conservent. », bouton « Retirer » (UX-DR12, FR17)
**And** le masquage passe par sa route dédiée (`PUT /parties/:id/hidden`, AD-14) ; le serveur refuse le retrait d'une partie ni TERMINEE ni ANNULEE, refus testé ; le masquage ne vise que son auteur (NFR3, AD-10)
**And** une partie masquée est exclue côté serveur de toutes les lectures de l'utilisateur : liste, signaux, calendrier personnel, sans paramètre pour la réafficher
**And** rouvrir une partie close supprime ses masquages
**And** le point d'entrée (menu de la tuile ou détail de la partie) est choisi au début de la story et relu avec l'utilisateur, car il n'est pas dessiné (open item UX n° 6).

## Epic 43 : Effacer son compte

Un utilisateur quitte l'application en sachant ce qui disparaît : zone sensible, aperçu de l'impact, confirmation rouge avec mot de passe, suppression en une transaction. Fonction inexistante aujourd'hui, ouverte à tous, MJ et seuls admins compris (exception 5 de FR13).

### Story 43.1 : Voir ce que l'effacement de mon compte emporterait

As a utilisateur,
I want savoir, avant d'effacer mon compte, ce qui disparaîtra avec lui,
So that je puisse d'abord confier mes groupes à quelqu'un d'autre.

**Acceptance Criteria:**

**Given** l'épic 42 livré
**When** l'utilisateur ouvre sa page Compte
**Then** ⚠️ une section « Zone sensible » apparaît sous « Fermer le grimoire » (déconnexion) : un filet, l'étiquette « Zone sensible », une phrase d'explication et une pilule à contour rouge « Effacer mon compte » avec une corbeille de 18 px (UX-DR13, FR7)
**And** `GET /me/deletion-impact` renvoie, pour l'utilisateur connecté seulement : les groupes dont il est le **seul** admin (nom, nombre de membres, nombre de conjonctions) et les parties de JDR qu'il possède (nom, nombre de joueurs qui y perdront leurs personnages) ; les groupes qui gardent un autre admin n'y figurent pas (AD-11)
**And** la pilule ouvre la confirmation n° 1 : « Effacer votre compte « *pseudo* » ? Seront supprimés avec lui : … Cette action est irréversible. Pour confirmer, saisissez votre mot de passe. », avec les deux listes, le champ mot de passe et le bouton **rouge** « Effacer mon compte » ; les listes vides sont omises (UX-DR12)
**And** « Renoncer » referme sans rien changer ; l'utilisateur peut aller nommer un autre admin puis revenir, et l'aperçu est recalculé à l'ouverture.

### Story 43.2 : Effacer mon compte

As a utilisateur,
I want effacer mon compte en une fois, en confirmant avec mon mot de passe,
So that mes données quittent l'application sans laisser de groupes orphelins.

**Acceptance Criteria:**

**Given** la story 43.1 livrée
**When** l'utilisateur saisit son mot de passe et confirme
**Then** `DELETE /me` vérifie le mot de passe par `AuthService` ; un mot de passe faux est refusé sans rien modifier, avec la limitation de débit des routes d'authentification ; la route ne vise que l'utilisateur connecté, sans identifiant en paramètre (NFR3, AD-11)
**And** dans **une seule transaction** : les parties de JDR qu'il possède sont supprimées (avec leurs personnages, comme une suppression de partie aujourd'hui) ; pour chaque ralliement dont il est membre, la procédure `PartiesService.leave(…, 'account-deletion')` s'applique (inscriptions et votes à venir retirés, conjonctions à venir hébergées annulées, groupe supprimé s'il n'a plus d'admin, `ownerId` vidé ailleurs) ; puis le compte est supprimé (AD-17)
**And** un groupe qui garde un autre admin survit ; ses conjonctions passées affichent leur hôte comme « compte supprimé » (AD-5)
**And** après la validation seulement : les e-mails d'annulation (n° 7) partent, les membres concernés sont notifiés en temps réel, et les fichiers de l'utilisateur sont traités selon la règle existante des suppressions
**And** `AuthService` coupe toutes ses sessions ; l'utilisateur arrive déconnecté sur l'accueil public, avec un message confirmant l'effacement
**And** les tests couvrent : mot de passe faux, seul admin (groupe supprimé), admin parmi d'autres (groupe conservé), MJ (parties de JDR supprimées), hôte d'une conjonction à venir (annulée), et l'absence d'effet sur les autres comptes ; les invitations et liens que l'utilisateur avait créés disparaissent avec lui (cascade existante), ce que la story note.
