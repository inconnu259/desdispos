---
title: "Palier 10 — Soirées entre amis (mode soirée, groupes, socle de permissions)"
status: final
created: 2026-10-08
updated: 2026-10-08
---

# PRD : Palier 10 — Soirées entre amis

## 0. Document Purpose

Ce PRD cadre le Palier 10 de jdr-master : permettre d'organiser des soirées entre amis (jeux de société, sans personnages ni mécaniques de JDR) avec les outils déjà présents dans l'application — dispos persistantes, sondage de date, inscriptions, invitations, e-mails. Il découle de la séance de forge `_bmad-output/forge/soiree-jeux-de-societe/` (statut *hardened*, 2026-10-07), dont il reprend les décisions verrouillées ; il ne les rouvre pas.

Il est écrit pour le PM (l'utilisateur) et les workflows suivants (`bmad-ux`, `bmad-architecture`, `bmad-create-epics-and-stories`). Le vocabulaire est ancré au Glossaire (§3), les FR sont globalement numérotées, les hypothèses non confirmées sont tagguées `[ASSUMPTION]` et indexées en §9. Le détail technique (état du code, forme du refactor) vit dans `addendum.md`.

Ce palier est suivi de plusieurs paliers **avant la mise en production** (Palier 11) : **10.4** sondage et mode « Destinée » du calendrier (touche aussi le JDR), **10.5** liste de jeux par personne, « j'apporte », historique des hôtes, bibliothèque commune, **10.6** dispos découvrables, **10.7** jeu d'icônes sur mesure, **10.8** reporter côté JDR les acquis UX. Tous sont hors périmètre ici (§5).

**Mise à jour du 2026-10-08, après le travail UX** (`_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/`) : ajout de la suppression de compte (FR-7), de l'annulation (FR-16), du retrait de sa liste (FR-17) et de la création ouverte à tous (FR-18) ; le vote se fait dans le calendrier (FR-11) ; sept e-mails (FR-12) ; liste fermée d'**exceptions** à « le JDR ne change pas » (FR-13). Comparaison complète : `reconcile-prd.md` du dossier UX. Dans l'interface, « soirée », « groupe » et « événement » deviennent **ralliement**, **convergence** et **conjonction** (variantes par thème : UX `EXPERIENCE.md` §3.1) ; ce PRD garde les noms de travail.

## 1. Vision

Aujourd'hui, jdr-master sait organiser des parties de JDR : un MJ, des joueurs, un sondage de date, des inscriptions. Mais une soirée entre amis — jeux de société, repas chez quelqu'un — est le même problème social (« quand, chez qui, qui vient ? ») sans aucune des contraintes du JDR. Doodle ne le résout pas : version gratuite limitée à 10 choix, pas de sondage sur une longue période, dates à saisir à la main, aucune fonction ajoutable. Surtout, les disponibilités de chacun sont déjà saisies une fois pour toutes dans l'application.

Ce palier fait du **mode soirée** la base de l'application et du **mode JDR** une spécialisation de celle-ci : le mode JDR ajoute les contraintes du MJ (un seul hôte, sondage *ou* inscriptions, création des scénarios) à ce que le mode soirée permet librement. Deux formes de soirée existent : la **soirée isolée** (on invite, on trouve une date, c'est fini) et le **groupe** (une bande d'amis de 4 à 20 personnes où tout membre peut proposer un événement chez lui, avec ou sans sondage de date).

Pour y arriver sans toucher au JDR existant, le palier commence par un **refactor à comportement constant** : les règles « qui peut faire quoi » aujourd'hui dispersées dans le code (le créateur MJ est lu dans 13 services) passent par un point unique. Le cœur est ainsi prêt à porter d'autres systèmes de JDR plus tard (Conte de Minuit, Draconis) et le mode soirée sans duplication.

## 2. Target User

### 2.1 Jobs To Be Done

- **Organiser** une soirée chez moi avec une quinzaine d'amis aux emplois du temps compliqués, sans échange de 80 messages pour trouver une date.
- **Proposer** une soirée à ma bande sans être « l'organisateur officiel » : n'importe quel membre peut lancer une idée, chez lui, à sa façon.
- **Participer** : dire « ça m'intéresse », donner mes dispos, voter, sans ressaisir mes disponibilités à chaque fois.
- C'est d'abord pour moi, en tant que créateur du produit et organisateur de ma propre bande ; les autres sont mes amis, pas un public.

### 2.2 Non-Users (v1)

- Le grand public : pas de découverte de groupes ni de soirées publiques, pas d'inscription ouverte hors d'un groupe.
- Les « invités d'un soir » sans appartenance : il n'existe pas ; qui veut des invités extérieurs crée une soirée isolée.

### 2.3 Key User Journeys

- **UJ-1. Incon réunit douze amis aux dispos impossibles pour une soirée à lui.**
  - **Persona + context :** Incon, organisateur de sa bande, veut une soirée jeux chez lui d'ici deux mois ; la moitié des invités travaillent en horaires décalés.
  - **Entry state :** connecté, aucune soirée en cours.
  - **Path :** il crée une *soirée isolée* en mode soirée, invite douze personnes (nominativement, plus un lien partagé dans le groupe de discussion), lance un sondage sur une plage de huit semaines. Les invités répondent grâce à leurs dispos déjà saisies.
  - **Climax :** le sondage fait ressortir un samedi où onze personnes sont libres ; il fixe la date.
  - **Resolution :** chaque invité reçoit l'e-mail de date fixée, puis un rappel la veille. La soirée passée, elle est terminée.
  - **Edge case :** un invité répond après la fixation de la date — il peut encore confirmer sa venue, la date ne bouge pas.

- **UJ-2. Léa propose une soirée ouverte à six places dans la bande.**
  - **Persona + context :** Léa, membre d'un groupe de quinze amis, a un salon pour six personnes et envie de jouer ce mois-ci.
  - **Entry state :** membre du groupe, connectée.
  - **Path :** elle propose un événement chez elle, six places, date par sondage. Elle réserve deux places en invitant nominativement Marc et Sam. Quatre autres membres s'inscrivent et donnent leurs dispos. Une semaine plus tard, elle lance le vote ; les inscrits votent. Elle fixe la date.
  - **Climax :** les six places sont occupées, la date est fixée, et un membre qui n'avait pas voté a reçu la relance la veille de l'échéance.
  - **Resolution :** un septième membre arrive trop tard : plus de place, pas de liste d'attente — il lit simplement « complet ».
  - **Edge case :** Sam décline l'invitation ; sa place réservée est libérée et le premier arrivé la prend.

- **UJ-3. Incon veut supprimer son compte.**
  - **Persona + context :** Incon, seul admin d'un groupe de quinze personnes, décide de supprimer son compte.
  - **Entry state :** connecté, admin unique du groupe « La Bande ».
  - **Path :** depuis la page Compte, zone sensible, il choisit « Effacer mon compte » ; une fenêtre liste ce qui sera supprimé avec lui — le groupe « La Bande », faute d'un autre admin, avec ses événements, et ses parties de JDR s'il en est MJ — et demande son mot de passe.
  - **Climax :** il annule, nomme Léa admin, puis relance.
  - **Resolution :** son compte est supprimé, le groupe survit avec Léa pour admin.

## 3. Glossary

*Les termes ci-dessous sont employés tels quels dans tout le PRD.*

- **Mode** — nature d'un ensemble de personnes et d'événements : **soirée** (ralliement : base, sans personnages) ou **JDR** (avec les capacités et les contraintes du MJ). **Déduit de la famille du système** choisi (architecture AD-2) : aucune colonne ne le stocke. Choisi à la création, non modifiable ensuite.
- **Système** — entrée du registre des systèmes : le **ralliement** (famille « ralliement », aucune capacité de JDR) ou un système de JDR (Ryuutama, plus tard Conte de Minuit, Draconis…). Chaque système déclare sa famille et ses capacités ; un « système de JDR » est un système de la famille JDR.
- **Soirée isolée** — rendez-vous unique entre un hôte et ses invités ; pas de limite d'invités ; terminé une fois passé. Remplace le « one-shot » hors JDR.
- **Groupe** — ensemble durable de membres (4 à 20 en pratique) où l'on propose des événements. Remplace les « campagnes » hors JDR.
- **Événement** — une soirée proposée dans un groupe ; a un hôte, une participation, une date.
- **Créateur** — personne qui a créé un groupe ou une soirée isolée.
- **Admin** — membre d'un groupe qui en gère les membres et les admins. Le créateur l'est d'office ; il peut y en avoir plusieurs.
- **Membre** — personne appartenant à un groupe (admins compris).
- **Hôte** — personne chez qui se tient une soirée isolée ou un événement, et qui le gère. En mode JDR, l'hôte est le MJ.
- **Invité** — personne invitée à une soirée isolée, ou invitée nominativement à un événement (place réservée).
- **Participation** — règle de qui peut venir à un événement : **tous** les membres, ou **places limitées** (nombre fixé par l'hôte).
- **Place réservée** — place d'un événement à places limitées attribuée par l'hôte à un membre qu'il a invité nominativement ; rendue libre si l'invité décline.
- **Inscription** — déclaration d'intérêt d'un membre pour un événement ; occupe une place s'il y en a.
- **Sondage** — vote pour choisir la date d'un événement ou d'une soirée isolée parmi des créneaux candidats.
- **Échéance du vote** — date limite du sondage.
- **Partie** — entité technique existante de l'application qui porte à la fois une partie de JDR et, après ce palier, une soirée isolée ou un groupe ; le mot n'apparaît pas dans l'interface du mode soirée.
- **Dispos** — disponibilités persistantes de l'utilisateur, saisies une fois dans l'application et réutilisées partout.
- **Annulation** — état d'une soirée isolée ou d'un événement annulé par son hôte (ou, dans un groupe, par un admin) ; les participants en sont prévenus et la carte reste visible jusqu'à ce que chacun la retire de sa liste.
- **Retrait de sa liste** — masquage définitif, **pour un seul utilisateur**, d'une partie terminée ou annulée ; sans effet pour les autres participants.
- **Quitter l'office** — pour un admin, abandonner son rôle d'admin (il reste membre). Ne pas confondre avec « Renoncer », bouton d'annulation des fenêtres de confirmation.

## 4. Features

### 4.1 Modes et formes de soirée

**Description :** À la création, on choisit ce que l'on organise : une soirée de jeux de société (mode soirée, sous la forme d'une soirée isolée ou d'un groupe) ou une partie de JDR avec son système (mode JDR, comportement actuel inchangé). Le choix est définitif. Toutes les parties existantes sont, à la migration, en mode JDR : rien ne change pour elles. Realizes UJ-1, UJ-2.

#### FR-1 : Choisir le mode à la création

Un utilisateur choisit à la création : soirée isolée, groupe, ou JDR (avec son système).

**Consequences (testable) :**
- Le mode d'une entité créée ne peut plus être modifié, par aucun acteur, y compris admin.
- Le choix d'un système de JDR (« livre de règles ») n'est proposé qu'en mode JDR ; une soirée ou un groupe a pour système le **ralliement**, qui n'a aucune capacité de JDR.
- Après migration, toute partie existante est en mode JDR et se comporte comme avant.
- Le choix se fait par une bascule à deux options (quête | ralliement) placée après le nom ; l'option ralliement propose deux types — le type isolé (soirée isolée) et le type durable (groupe) — et aucun système de JDR.

#### FR-2 : Soirée isolée

Un créateur, devenu hôte, organise une soirée isolée : il invite des personnes nominativement ou par lien, sans limite d'invités, et fixe la date directement ou par sondage.

**Consequences (testable) :**
- L'hôte peut inviter et retirer des invités à tout moment avant la soirée.
- Une soirée isolée passée est marquée terminée et n'accepte plus de modification.
- Une soirée isolée n'est jamais rattachée à un groupe.
- Un invité nominatif voit « Accepter / Décliner » en tête de page tant qu'il n'a pas répondu, et ne peut voter qu'après avoir accepté `[ASSUMPTION]`.
- Après la création d'une soirée isolée, la fenêtre de création de sa conjonction s'ouvre immédiatement (FR-8).

**Out of Scope :** inscription libre (réservée aux membres d'un groupe).

#### FR-3 : Groupe

Un utilisateur crée un groupe ; il en est le créateur et premier admin. Le groupe regroupe des membres qui proposent des événements.

**Consequences (testable) :**
- Un groupe contient de 1 à 20 membres sans dégradation d'usage `[ASSUMPTION : 20 est un repère de dimensionnement, pas une limite imposée]`.
- Un groupe en mode soirée n'a ni scénario de JDR ni personnage ; son système est le ralliement.

### 4.2 Gouvernance du groupe

**Description :** L'admin gère qui est dans le groupe ; les membres, eux, proposent et hébergent mais n'invitent pas dans le groupe. Un groupe peut avoir plusieurs admins. Realizes UJ-3.

#### FR-4 : Gérer les membres

Un admin ajoute des membres (invitation par e-mail ou lien d'invitation visant le **groupe**) et en retire.

**Consequences (testable) :**
- Un non-admin ne peut ni ajouter ni retirer un membre (refus côté serveur).
- Une invitation ou un lien d'invitation fait rejoindre le groupe, pas seulement un événement.

#### FR-5 : Gérer les admins

Un admin peut nommer un autre membre admin et **quitter l'office** (abandonner son propre rôle d'admin) ; s'il est le seul admin, quitter l'office supprime le groupe.

**Consequences (testable) :**
- Un groupe peut avoir plusieurs admins simultanément.
- Le dernier admin peut quitter l'office : le groupe est alors supprimé, après une fenêtre de confirmation qui le lui annonce, avec le nombre de membres et de conjonctions concernés (bouton rouge).
- Un admin qui a quitté l'office reste membre (tant que le groupe existe).
- « Nommer admin » se fait depuis la liste des membres ; un admin s'affiche avec un badge.

#### FR-6 : Retrait d'un membre

Quand un membre quitte ou est retiré, il disparaît de ses inscriptions et de ses votes sur les événements à venir ; les événements passés conservent sa trace.

**Consequences (testable) :**
- Les places qu'il occupait ou réservait sont libérées.
- Les événements à venir dont il est l'hôte sont annulés, et les inscrits prévenus par e-mail `[ASSUMPTION]`.
- Un membre peut quitter le groupe de lui-même, avec le même effet qu'un retrait `[ASSUMPTION]`.

#### FR-7 : Effacer son compte

**L'application n'a aujourd'hui aucune suppression de compte** (ni écran, ni route serveur) : ce palier la crée. Un utilisateur efface son propre compte depuis la page Compte (zone sensible, sous la déconnexion). Une fenêtre de confirmation liste ce qui sera supprimé avec lui et exige son mot de passe.

**Consequences (testable) :**
- La confirmation affiche le nom de chaque **groupe** dont il est le seul admin (avec son nombre de membres et de conjonctions) et de chaque **partie de JDR** dont il est le MJ (avec le nombre de joueurs qui y perdent leurs personnages).
- Si un groupe a un autre admin, il survit sans changement autre que la perte d'un admin.
- Si le groupe n'a aucun autre admin, il est supprimé, ainsi que ses événements, inscriptions et votes.
- Une partie de JDR dont le compte est MJ est supprimée avec ses personnages, y compris ceux des autres joueurs (comportement existant de la base) ; la suppression de compte reste **autorisée** dans ce cas, avec l'avertissement.
- Sans le mot de passe correct, rien n'est supprimé.
- Le bouton de confirmation est en rouge (action irréversible).

**Out of Scope :** suppression d'un compte par un administrateur de la plateforme ; transfert automatique d'un groupe ou d'une partie.

**Notes :** `[NOTE FOR PM]` supprimer le dernier admin d'un groupe de 20 personnes, ou le MJ d'une partie, détruit tout son historique. Décision assumée par le PM (2026-10-08) ; les garde-fous sont l'avertissement détaillé et le mot de passe.


### 4.3 Événements du groupe

**Description :** Tout membre propose un événement dans le groupe et en est l'hôte, chez lui. L'hôte choisit la participation et la façon de fixer la date. Le sondage et les inscriptions cohabitent librement en mode soirée. Realizes UJ-2.

#### FR-8 : Proposer un événement

Tout membre propose un événement dont il est l'hôte ; il renseigne un nom, un lieu, une participation et un mode de date.

**Consequences (testable) :**
- Un événement a exactement un hôte ; il ne change pas pendant la vie de l'événement `[ASSUMPTION]`.
- Un membre n'est jamais « MJ du groupe » : il n'y a pas de rôle à tour de rôle.
- L'hôte peut modifier son événement et l'annuler tant qu'il n'est pas passé ; l'annulation prévient les inscrits par e-mail.
- Le lieu de l'événement est visible de tous les membres du groupe.
- Le formulaire renseigne : nom, mode de date (fixée ou sondage), lieu, heure de rendez-vous (facultative), infos pratiques (facultatives) et participation. Il s'ouvre dans la même fenêtre que le détail de l'événement.
- En mode « date fixée », l'hôte choisit un jour et un créneau (matin, après-midi, soir) ; en mode « sondage », il choisit les créneaux candidats dans le calendrier et l'échéance du vote.

#### FR-9 : Participation à un événement

L'hôte choisit : **tous** les membres, ou **places limitées** (N places).

**Consequences (testable) :**
- En participation « tous », s'inscrire signifie confirmer sa venue ; il n'y a aucune limite de places.
- En places limitées, l'hôte peut inviter nommément des membres : chaque invité détient une place réservée, que personne d'autre ne peut prendre.
- Un invité qui décline libère sa place ; elle redevient disponible au premier membre qui s'inscrit.
- Les places non réservées se prennent par inscription, premier arrivé premier servi.
- Un événement complet affiche « complet » ; il n'y a pas de liste d'attente.
- Un membre peut se désinscrire à tout moment ; sa place est libérée.
- Seul l'hôte de l'événement invite nommément ; aucun autre membre ni admin ne le fait à sa place.
- Si l'hôte réserve toutes les places (N = nombre d'invités), l'événement est de fait « sur invitation » — pas de mode distinct `[ASSUMPTION]`.

#### FR-10 : Date fixée ou par sondage

L'hôte fixe la date d'emblée, ou ouvre un sondage de dates.

**Consequences (testable) :**
- En mode soirée, un événement peut avoir un sondage et des inscriptions en même temps ; la règle « sondage *ou* inscriptions » ne s'applique qu'en mode JDR.
- Chaque créneau candidat du sondage affiche combien d'inscrits sont disponibles d'après leurs dispos déjà saisies, sans qu'ils les ressaisissent.
- Après fixation de la date, des inscriptions tardives restent possibles ; la date n'est jamais rouverte.

#### FR-11 : Cycle d'un événement par sondage

L'hôte propose l'événement ; le vote s'ouvre **dès que les créneaux candidats sont posés**, à la création ou plus tard, avec une échéance ; les intéressés peuvent s'inscrire avant ou pendant le vote ; les votants choisissent ; l'hôte fixe la date.

**Consequences (testable) :**
- Pour un événement en participation « tous », tous les membres peuvent voter ; en places limitées, seuls les inscrits peuvent voter.
- Une personne qui s'inscrit avant l'échéance du vote peut voter ; après l'échéance ou après fixation de la date, elle ne vote plus.
- Seul l'hôte lance le vote et fixe la date.
- Pour une soirée isolée, les invités votent ; l'hôte lance le vote, le prolonge et fixe la date comme pour un événement.
- Le vote a toujours une échéance, choisie par l'hôte au lancement du vote ; l'hôte peut la prolonger tant que la date n'est pas fixée. **Prolonger une échéance est une capacité nouvelle** : l'échéance n'est aujourd'hui fixée qu'à la création du sondage.
- Une échéance prolongée déplace d'autant la relance automatique de FR-12 (une seule relance par vote, calée sur l'échéance en vigueur).
- **Le vote se fait dans le calendrier** (comme pour un sondage de JDR), sans plafond de créneaux : la fenêtre de l'événement affiche un résumé (réponses données, meilleur créneau, pour l'hôte qui n'a pas répondu) et un bouton qui ouvre le calendrier du groupe. En attendant le Palier 10.4, ce calendrier s'ouvre sans focus sur le vote concerné.
- L'hôte fixe la date en choisissant un créneau dans la liste des candidats, du plus au moins plébiscité ; les inscrits sont prévenus par e-mail ; la date ne se rouvre pas.

### 4.4 E-mails et rappels

**Description :** Le mode soirée réutilise l'infrastructure e-mail et le rappel du Palier 4, sans mécanisme nouveau, et ajoute une seule relance automatique. Realizes UJ-1, UJ-2.

#### FR-12 : Messages du mode soirée

L'application envoie un e-mail pour : (1) invitation à rejoindre un groupe, (2) invitation à une soirée isolée, (3) place réservée, (4) date fixée, (5) rappel la veille, (6) relance du vote, (7) **annulation**.

**Consequences (testable) :**
- La relance du vote part automatiquement un jour avant l'échéance, une seule fois, aux seuls ayants droit qui n'ont pas encore voté.
- Aucun digest ni autre relance automatique n'est envoyé.
- Le vocabulaire des e-mails est **neutre** (« groupe », « rencontre ») et identique pour tous : un invité sans compte n'a pas de thème.
- **Tous** les e-mails de l'application, existants compris, portent un bouton plein à la place du lien souligné et un pied « Dés Dispos » (le pied actuel dit « jdr-master »).

### 4.5 Socle de permissions et migration *(porte du palier)*

**Description :** Premier épic du palier. Avant toute fonctionnalité de soirée, les règles « qui peut faire quoi » dans une partie passent par un point unique, paramétré par le mode, sans que le JDR change d'un pouce. Aucune story de soirée ne démarre tant que cette porte n'est pas franchie.

#### FR-13 : Point unique des règles de permission

Toute décision d'autorisation sur une partie (modifier, inviter, lancer un vote, créer un contenu…) passe par un seul point, qui connaît le mode et le rôle de l'acteur.

**Consequences (testable) :**
- Le comportement du mode JDR est identique avant/après : la suite de tests existante (unitaires + e2e) passe sans modification de ses attentes, **sous réserve de la liste fermée d'exceptions ci-dessous**.
- L'interface du mode JDR est visuellement et fonctionnellement inchangée, **hors ces exceptions décidées**, qui touchent des écrans partagés avec le JDR : (1) le bouton de création, déplacé dans l'en-tête et ouvert à tous (FR-18) ; (2) les tuiles de la liste d'accueil : pastille et badge de système, sous-titre réduit à la nature ; (3) les filtres de la liste (Genre, Phase « annulée », case « Grouper par type », « Masquer les clos et les annulés ») ; (4) le retrait de sa liste (FR-17) ; (5) la page Compte et la suppression de compte (FR-7) ; (6) l'ordre du formulaire de création et la couverture ; (7) les e-mails existants restylés (FR-12) ; (8) le rappel de la veille devient **par séance** (architecture AD-12) : même e-mail et mêmes destinataires pour une partie de JDR à une prochaine séance, mais une partie épisodique qui a plusieurs séances datées reçoit un rappel pour chacune. Le calendrier, le sondage, l'inscription et les écrans internes de la partie de JDR restent inchangés (Paliers 10.4 et 10.8).
- Les règles du mode soirée (matrice ci-dessous) sont exprimées via le même point, pas dans des services dispersés.
- Dimensionné pour les deux cas réels (soirée, JDR), pas pour un cadre générique spéculatif.

**Matrice des permissions — mode soirée** *(le mode JDR reste tel qu'aujourd'hui)* :

*Les rôles se cumulent : un admin qui héberge un événement a aussi les droits de l'hôte.*

| Action | Admin | Membre | Hôte de l'événement |
|---|---|---|---|
| Ajouter / retirer un membre du groupe | oui | non | non (sauf s'il est admin) |
| Nommer un admin / renoncer | oui | non | non (sauf s'il est admin) |
| Supprimer le groupe | oui | non | non |
| Proposer un événement | oui | oui | — |
| Modifier son événement | non | non | oui |
| Annuler un événement (FR-16) | oui (tout événement du groupe) | non | oui (le sien) |
| Inviter nommément à un événement | non | non | oui |
| S'inscrire / se désinscrire | oui | oui | oui |
| Lancer le vote, fixer la date, prolonger le vote | non | non | oui |
| Voter | selon FR-11 | selon FR-11 | selon FR-11 |
| Retirer de sa liste une partie terminée ou annulée (FR-17) | oui | oui | oui |
| Effacer son propre compte (FR-7) | oui | oui | oui |

*Soirée isolée : l'hôte (= créateur) est seul à agir ; les invités répondent, votent et se désinscrivent.*

#### FR-14 : Migration

Les parties existantes ont toutes un système de la famille JDR : elles sont en mode JDR sans rien écrire. Les migrations de la porte (AD-16, une par étape, sans migration en plusieurs temps) renomment le propriétaire (`ownerId`), extraient l'événement du scénario avec le même identifiant, et posent la date d'une séance en plage.

**Consequences (testable) :**
- Aucune donnée existante n'est perdue ni modifiée en dehors du mode.
- Aucune production n'existe avant le Palier 11 : la migration n'a pas à être réversible.

### 4.6 Vocabulaire hors JDR

#### FR-15 : Libellés propres au mode soirée

Hors du mode JDR, l'interface remplace le vocabulaire de JDR : « MJ » devient hôte / créateur / admin selon le contexte ; « campagne », « scénario », « séance », « joueur » ne figurent pas dans l'interface du mode soirée.

**Consequences (testable) :**
- Les libellés passent par le registre de textes existant (Épic 35), pas en dur, avec **une variante par thème** (grimoire, forêt, atelier) : bascule, noms des deux types, nom d'une rencontre et de son onglet, rôles (admin, membre, hôte, invité). Les e-mails font exception (vocabulaire neutre, FR-12).
- Les libellés du mode JDR sont inchangés, à l'exception du sous-titre des tuiles (le nom du système passe dans une pastille).
- Chaque système (Ryuutama, ralliement, plus tard Draconis) a une pastille de nom et un badge rond sur la vignette de ses parties.

#### FR-16 : Annuler une soirée isolée ou un événement

L'hôte annule sa soirée isolée ou son événement tant qu'il n'est pas passé ; dans un groupe, un admin peut annuler tout événement du groupe. L'annulation est confirmée, définitive et prévient les participants par e-mail.

**Consequences (testable) :**
- Une partie annulée a un état distinct de « terminée » : elle reste visible des participants, marquée « annulée », sans plus aucune action possible.
- Elle est masquée par défaut dans la liste d'accueil (même case que les parties terminées) et filtrable par la phase « annulée ».
- Les inscrits, invités et places réservées reçoivent l'e-mail d'annulation.

#### FR-17 : Retirer de sa liste

Un utilisateur peut retirer de sa liste une partie **terminée ou annulée** : elle disparaît définitivement pour lui seul. Cela vaut aussi pour les parties de JDR terminées.

**Consequences (testable) :**
- Une confirmation précise que les autres participants gardent la partie.
- La partie n'apparaît plus dans aucune liste ni filtre de cet utilisateur, et n'est pas supprimée pour les autres.
- Une partie en cours ou à venir ne peut pas être retirée de sa liste.

#### FR-18 : Créer, pour tout utilisateur

Tout utilisateur connecté peut créer une soirée isolée, un groupe ou une partie de JDR, depuis un bouton situé dans l'en-tête de l'application, visible sur toutes les pages. Aujourd'hui le bouton n'apparaît qu'aux utilisateurs déjà MJ d'au moins une partie.

**Consequences (testable) :**
- Un utilisateur sans aucune partie, ou uniquement joueur, voit le bouton et peut créer.
- Sur mobile, le bouton est une icône seule dont le libellé thématique est le nom accessible.

### Cross-cutting NFRs

- **Temps réel (SSE)** : tout composant affichant des données d'un groupe ou d'un événement (inscriptions, places, votes, membres) est évalué pour un câblage sur `changed`/`notifyChanged()` via `RealtimeService`, selon `docs/checklist.md`.
- **Sécurité** : chaque règle de la matrice est vérifiée côté serveur et couverte par un test de refus (cf. `docs/security.md`) ; un membre d'un groupe A ne lit rien d'un groupe B. La suppression de compte (FR-7) exige le mot de passe et s'applique à soi seul ; le retrait de sa liste (FR-17) n'a d'effet que pour l'utilisateur qui l'a demandé.
- **Accessibilité** : jamais la couleur ni le trait seuls (état « annulée » écrit, badges avec un mot) ; zone de toucher d'au moins 44 px pour le bouton de création mobile ; le texte d'une place réservée en attente garde un contraste d'au moins 4,5:1.
- **Échelle** : groupes de 4 à 20 membres, sondages sur plusieurs semaines : les listes de membres et de votes tiennent sans pagination.
- **Régression** : la CI existante (types, build API, tests unitaires + e2e) reste verte à chaque story.

## 5. Non-Goals (Explicit)

- Pas de liste de jeux par personne, de « j'apporte », d'historique ou d'équilibre des hôtes, ni de bibliothèque commune de jeux : Palier 10.5.
- Pas d'« invité d'un soir » sans appartenance au groupe.
- Pas de rôle de MJ qui change à chaque événement.
- Pas de sondage de dates avec places attribuées après coup (« cas A »).
- Pas de liste d'attente.
- Pas de changement de mode après création.
- Pas de cadre générique spéculatif : le refactor se dimensionne sur les deux cas réels.
- Pas de découverte publique de groupes ni de soirées.
- Pas de modification du JDR existant ni de son interface, **hors la liste fermée d'exceptions de FR-13**.
- Pas de refonte du sondage ni du mode « Destinée » du calendrier (Palier 10.4), ni des dispos découvrables (10.6), ni du jeu d'icônes (10.7), ni de report côté JDR (10.8).
- Pas de suppression de compte par un administrateur de la plateforme, ni de transfert automatique de groupe ou de partie.

## 6. MVP Scope

### 6.1 In Scope

- Socle de permissions à comportement constant (la porte), choix et migration du mode.
- Soirée isolée et groupe, admins multiples, membres.
- Événements de groupe : participation tous / places limitées avec places réservées, date fixée ou sondage, inscriptions tardives.
- Sept e-mails du mode soirée, dont une relance du vote et l'annulation ; tous les e-mails restylés.
- Libellés propres au mode soirée, par thème ; pastille et badge de système.
- Annulation, retrait de sa liste, suppression de compte, création ouverte à tous.

### 6.2 Out of Scope for MVP

- Tout le périmètre du Palier 10.5 (jeux, historique des hôtes).
- Digest, relances multiples, notifications push.
- Transfert automatique d'admin lors d'une suppression de compte (le groupe est supprimé si aucun autre admin).
- Vote dans la fenêtre de l'événement, plafond de créneaux : le vote est dans le calendrier (FR-11) ; sa refonte est au Palier 10.4.

## 7. Success Metrics

**Primary**
- **SM-1** : une vraie soirée organisée de bout en bout dans l'application avec ma bande (proposer, s'inscrire, voter, fixer la date). Validates FR-8 à FR-12.
- **SM-2** : zéro régression du JDR : suite de tests existante verte, interface JDR inchangée **hors les exceptions listées en FR-13**. Validates FR-13, FR-14.

**Secondary**
- **SM-3** : j'utilise le mode soirée pour au moins deux soirées réelles sans retourner à un échange de messages pour trouver la date. Validates FR-10, FR-11.

**Counter-metrics (do not optimize)**
- **SM-C1** : le nombre de relances ou d'e-mails envoyés — on ne cherche pas à maximiser la participation par la pression. Counterbalances FR-12.
- **SM-C2** : la généricité du cœur — ne pas anticiper des cas non réels au-delà de soirée et JDR. Counterbalances SM-2.

## 8. Open Questions

Aucune question bloquante pour démarrer. Résolues pendant le cadrage : fusion des campagnes du forge (ne concerne que les formes de soirée ; le JDR garde ses types actuels), échéance du vote (donnée par l'hôte, prolongeable), annulation par un admin et visibilité du lieu (voir FR-8, FR-16, matrice FR-13), suppression de compte pour un MJ (autorisée avec avertissement, FR-7).

À traiter avant ou pendant l'implémentation (détail : UX `EXPERIENCE.md` §11) :
1. Noms de rôles par thème (admin, membre, hôte, invité), nom de la rencontre isolée en forêt (provisoire), bouton final du formulaire en mode ralliement.
2. Définition de « partie active » pour la liste des destinées (Palier 10.4) : ni close ni annulée ?
3. Contraste du rouge de statut en texte dans les trois thèmes ; revue d'accessibilité non lancée.
4. Où se lance « Retirer de sa liste », et où se placent « Quitter l'office » / « Quitter le groupe ».
5. Badge d'admin sur l'avatar : décidé, non dessiné.

## 9. Assumptions Index

- FR-3 : 20 membres est un repère de dimensionnement, pas une limite.
- FR-6 : les événements à venir d'un hôte retiré sont annulés ; un membre peut quitter de lui-même.
- FR-8 : l'hôte d'un événement ne change pas.
- FR-9 : « sur invitation » = places limitées entièrement réservées, pas de mode distinct.
- FR-2 : un invité nominatif ne vote qu'après avoir accepté.
- FR-7 : le mot de passe est demandé pour effacer un compte.
