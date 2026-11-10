---
title: "Palier 10.4 — Sondage et Destinée dans le calendrier"
status: final
created: 2026-10-19
updated: 2026-10-20
---

# PRD : Palier 10.4 — Sondage et Destinée dans le calendrier

## 0. Document Purpose

Ce PRD cadre le Palier 10.4 de jdr-master : rendre la **création d'un sondage** et le **suivi d'un vote** faciles dans le calendrier, pour le JDR comme pour le mode soirée. Il reprend la matière recueillie pendant le travail UX du Palier 10 (`_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/palier-10-4-entrees.md`, 2026-10-08), dont il ne rouvre pas les décisions (Destinée enrichie « A + B »). Il prolonge le PRD du Palier 10 (`prds/prd-jdr-master-2026-10-08/`), dont il réutilise le Glossaire.

Il est écrit pour le PM (l'utilisateur) et les workflows suivants (`bmad-ux`, `bmad-architecture`, `bmad-create-epics-and-stories`) : vocabulaire au Glossaire (§3) ; FR propres à ce PRD (une FR d'un autre palier est citée avec son PRD) ; hypothèses en §9 ; technique en `addendum.md`.

**Mise à jour du 2026-10-20, après le travail UX** (`_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/`) : le geste de sélection garde l'ordre des dispos, sélections cumulatives, plus de touche Maj (FR-6) ; plateau en tiroir du bas sur mobile (FR-8) ; le bouton s'appelle « Proposer des dates » (FR-5) ; libellés des fenêtres de l'automate choisis (FR-16) ; ajout de FR-17 (mode et nature expliqués dans le formulaire de création), demandé par l'utilisateur.

**Mise à jour du 2026-10-20, après l'architecture** (`architecture/architecture-jdr-master-2026-10-20-p10-4/`) : le calendrier personnel suit et conclut les votes, mais un sondage se compose dans le calendrier de sa partie ou de son groupe (l'atelier, §3), vers lequel le calendrier personnel aiguille (UJ-2, FR-5, FR-8, FR-10, FR-12) ; repli de la colonne retenu dans le navigateur (FR-4) ; « rendez-vous à dater » précisé (§3) ; ajout de l'échéance dans le composer (FR-18, §4.9) et des **plages longues** (lot PL-1, FR-19 à FR-23, §4.10), décidées avec l'utilisateur ; détail des passages touchés dans `.memlog.md`.

⚠️ **Ce palier modifie des écrans validés** : le calendrier (Épics 30 et 36, Palier 9), la page calendrier du groupe (Story 40.5b) et les accès au vote. Chaque modification est listée en §4.6. Il lève aussi, **pour ce sujet seulement**, la contrainte « le JDR ne change pas » du Palier 10.

## 1. Vision

Créer un sondage dans jdr-master, aujourd'hui, est une épreuve. L'automate calcule bien des créneaux où la troupe est libre (« Fenêtres de la destinée »), mais il en affiche une vingtaine sur 3 000 pixels, et aucune carte ne permet d'en faire quoi que ce soit. Le mode « composer », qui crée réellement un vote, n'est annoncé nulle part. Le mode Destinée, qui met un vote en avant, ne connaît que les votes du mois affiché, ne s'ouvre pas depuis un lien, et ses flèches sautent d'un vote à l'autre au lieu de parcourir ses dates. Le créateur du produit lui-même a « galéré ».

Ce palier fait du calendrier **l'endroit où l'on fabrique et où l'on suit un sondage**. L'organisateur sait qu'un de ses rendez-vous n'a pas encore de date : depuis n'importe quel calendrier, il touche « Proposer des dates », choisit ce rendez-vous dans une courte liste, puis, dans le calendrier de sa partie ou de son groupe, sélectionne des jours comme il déclare ses dispos. Le MJ transforme en quelques gestes les fenêtres de l'automate en créneaux candidats. Le joueur ou le membre qui reçoit « Voter dans le calendrier » arrive directement sur le bon vote, voit ses dates en colonne, et répond. L'organisateur fixe la date au même endroit.

Le Palier 10 a livré le vote de conjonction en s'appuyant sur le « composer » existant, avec une gêne acceptée : peu découvrable, et le lien du vote ouvre le calendrier sans focus. Ce palier lève cette gêne, avant que la bande d'amis ne s'en serve pour de bon.

Et un rendez-vous ne tient pas toujours dans une soirée. Une « journée JDR » occupe un après-midi et une soirée ; un week-end de jeu entre amis, du vendredi soir au dimanche après-midi, est l'une des raisons d'être du projet. Ce palier permet de déclarer, de soumettre au vote, de fixer et d'afficher un rendez-vous qui dure plusieurs créneaux.

## 2. Target User

### 2.1 Jobs To Be Done

- **Dater un rendez-vous sans réfléchir au mécanisme** : en tant que MJ ou hôte, je sais lequel de mes rendez-vous n'a pas de date, je lui propose des dates depuis n'importe quel calendrier, en quelques gestes.
- **Voter là où le lien m'envoie** : en tant que joueur ou membre, je clique sur « Voter », j'arrive sur le vote, je réponds, c'est fini.
- **Ne pas me perdre entre mes parties** : quand j'ai trois parties et deux groupes, je choisis le vote que je veux regarder et je filtre le calendrier sur une partie.
- C'est d'abord pour moi, créateur et MJ, et pour ma bande ; pas pour un public.

### 2.2 Key User Journeys

- **UJ-1. Incon, MJ, tire un sondage des fenêtres de l'automate.**
  Incon prépare la prochaine séance de sa campagne Ryuutama, qui n'a pas encore de date. Il ouvre le calendrier de la partie ; la liste des fenêtres de l'automate est repliée sous un en-tête qui en donne le nombre. Il la déplie, clique sur une fenêtre : le calendrier la met en évidence, le reste s'estompe. Il choisit « Ajouter au vote » : le composer s'ouvre et lui demande pour quel rendez-vous ; il choisit la séance à dater. Il ajoute une deuxième et une troisième fenêtre, qui s'accumulent dans le composer et quittent la liste de l'automate. Il en masque une qui tombe le soir d'un anniversaire. Il valide : le sondage s'ouvre aux joueurs. **Edge case :** il retire une option du sondage ; si l'automate la juge toujours libre, elle revient dans sa liste.

- **UJ-2. Léa propose des dates depuis son calendrier personnel.**
  Léa, hôte d'une soirée isolée encore sans date, consulte son calendrier personnel. Elle touche « Proposer des dates » : une courte liste montre ses rendez-vous à dater, groupés par partie ; elle choisit sa soirée. Le calendrier de sa soirée (calendrier du groupe) s'ouvre, composer déjà prêt pour ce rendez-vous. Elle sélectionne cinq vendredis du même geste que pour ses dispos, choisit « soir », puis sélectionne un samedi et choisit « après-midi » ; l'échéance proposée lui convient, elle valide. Le vote s'ouvre et elle le voit en Destinée ; la flèche retour la ramène à son calendrier personnel. **Edge case :** elle n'a sélectionné qu'un créneau ; la validation reste bloquée et lui dit pourquoi (deux créneaux minimum).

- **UJ-3. Marc vote depuis le lien, sans chercher.**
  Marc, membre de « La Bande », ouvre une conjonction et clique « Voter dans le calendrier ». Le calendrier du groupe s'ouvre directement en Destinée sur ce sondage : la colonne de droite liste les créneaux candidats avec leurs comptes de oui, le calendrier est placé sur le premier créneau à venir. Il parcourt les dates avec ‹ › ou en cliquant dans la colonne, répond à chacune. **Edge case :** l'hôte a fixé la date entre-temps ; le calendrier s'ouvre normalement, avec un message qui dit que le vote est clos.

- **UJ-4. Incon suit et conclut un vote parmi toutes ses parties.**
  Dans son calendrier personnel, Incon touche la puce ✦ : une liste groupée par partie montre chaque sondage ouvert (nom, échéance, « à faire » / « répondu » / « organisateur »), même ceux dont les dates tombent dans trois mois. Il choisit celui de sa campagne, dont l'échéance est passée ; le calendrier saute au bon mois, le plateau montre le meilleur créneau. Il clique « Fixer la date… » sans passer par la fiche de scénario. Plus tard, il filtre le calendrier sur « La Bande » seulement.

- **UJ-5. Incon organise un week-end jeux.**
  Incon veut réunir ses amis un week-end, du vendredi soir au dimanche après-midi, pour jouer. Il crée la soirée « Week-end jeux » sans date et indique, à la création, sa durée : « du vendredi soir au dimanche après-midi » (six créneaux). Il propose des dates : le composer reprend cette durée, il touche trois vendredis soir de novembre. Chaque date proposée est un week-end entier, que le calendrier montre sur les trois jours. Ses amis votent pour un week-end, pas pour un soir. Incon fixe le deuxième week-end : le week-end apparaît dans le calendrier de chacun, et chacun est désormais occupé du vendredi soir au dimanche après-midi ; le rappel part le jeudi. **Edge case :** il allonge la durée alors que deux amis ont déjà répondu ; l'application le prévient que leurs réponses seront effacées.

- **UJ-6. Incon prépare une journée JDR.**
  Pour le prochain chapitre de sa campagne, Incon veut un après-midi et une soirée d'affilée. Dans le calendrier de la partie, il ouvre le composer pour la séance à dater et choisit la durée « après-midi + soir » : la liste de l'automate ne montre plus que les fenêtres où toute la troupe est libre l'après-midi **et** le soir. Il en ajoute trois au vote et valide.

## 3. Glossary

*Reprend le Glossaire du PRD du Palier 10 (Partie, Groupe, Soirée isolée, Événement, Hôte, Membre, Sondage, Échéance du vote, Dispos, Annulation). Termes propres à ce palier, ou précisés :*

- **Conjonction** — libellé d'interface d'un **Événement** de groupe (PRD du Palier 10, §0). Ce PRD emploie « événement » ; « conjonction » n'apparaît que dans des libellés cités.
- **Rendez-vous** — une unité de jeu organisée, physiquement : en JDR, une **séance** d'un scénario ; en mode soirée, un **événement** d'un groupe ou une **soirée isolée**. Un sondage appartient toujours à un rendez-vous, et un rendez-vous a au plus un sondage ouvert.
- **Partie active** — partie ni close ni annulée, non masquée par l'utilisateur, et, pour une soirée isolée, pas encore passée. *Ratifié en architecture le 2026-10-20.*
- **Organisateur du sondage** — la personne qui peut créer, modifier et conclure le sondage d'un rendez-vous : le **MJ** en mode JDR, l'**hôte** en mode soirée.
- **Rendez-vous à dater** — rendez-vous d'une partie active, sans date fixée et **sans sondage lié**, dont l'utilisateur est l'organisateur du sondage. Un vote fermé sans date ne rend pas le rendez-vous à nouveau à dater (contournement existant, en JDR : remettre la séance sans date). En mode soirée, seule une soirée isolée sans date peut être à dater : un événement de groupe est toujours créé daté ou avec son sondage.
- **Vote** — synonyme d'interface de **Sondage** (« Ajouter au vote », « Voter »).
- **Sondage ouvert** — sondage dont la date n'est pas fixée, ni annulé ni supprimé, **que son échéance soit passée ou non**. Avant l'échéance, les votants peuvent répondre ; après, plus personne ne vote, mais l'organisateur peut encore fixer la date ou prolonger le vote.
- **Sondage clos** — sondage dont la date est fixée, ou qui a été annulé ou supprimé.
- **Créneau candidat** — une date proposée au vote d'un sondage : son **départ** (jour + moment de la journée : matin, après-midi, soir, ou journée entière en JDR). Si le rendez-vous dure plusieurs créneaux, le créneau candidat couvre une plage qui commence à ce départ.
- **Durée du rendez-vous** — nombre de créneaux enchaînés (matin, après-midi, soir, puis matin du lendemain…) que dure le rendez-vous ; facultative, un créneau par défaut ; la même pour tous les créneaux candidats de son sondage.
- **Plage** — période continue couverte par un rendez-vous de plusieurs créneaux, de son départ à sa fin (par exemple : du vendredi soir au dimanche après-midi).
- **Fenêtre de l'automate** — créneau (ou plage, §4.10) où la troupe d'une partie de JDR est disponible, calculé par l'application à partir des dispos. N'existe qu'en calendrier de partie (JDR) ; le MJ en voit la liste détaillée et actionnable, les joueurs une version agrégée inchangée par ce palier.
- **Calendrier de partie** — calendrier d'une partie de JDR, vu par le MJ ou un joueur ; ne montre que cette partie.
- **Calendrier du groupe** — calendrier ouvert depuis un groupe ou une soirée isolée ; ne montre que cette partie, et jamais les dispos des autres membres.
- **Atelier** — terme de ce document (pas un libellé d'interface) pour le calendrier de partie ou le calendrier du groupe : là où l'on compose un sondage, par opposition au calendrier personnel.
- **Meilleur créneau** — créneau candidat à venir qui a le plus de oui, puis le plus de peut-être, puis le plus tôt ; il n'y en a pas tant que personne n'a répondu oui.
- **Journée JDR** — expression employée dans les parcours (UJ-6) pour un rendez-vous de JDR « après-midi + soir » (deux créneaux) ; à ne pas confondre avec la **journée entière**, un créneau unique qui couvre toute la journée.
- **Calendrier personnel** — calendrier de l'utilisateur, toutes parties confondues.
- **Composer** — mode du calendrier où l'organisateur sélectionne les créneaux candidats d'un sondage, avant de valider.
- **Destinée** — mode d'affichage du calendrier qui met **un** sondage ouvert en avant (les jours sans créneau candidat s'estompent). Ce n'est pas un filtre ni une couche ; il ne se persiste pas.
- **Destinée active** — le sondage mis en avant par la Destinée.
- **Liste des destinées** — liste, ouverte par la puce ✦, des sondages ouverts que l'utilisateur peut mettre en avant, groupés par partie.
- **Plateau de la destinée** — la colonne de droite (tiroir sur mobile) quand la Destinée est active : la liste des créneaux candidats de la destinée active, avec leurs comptes de oui.
- **Masquage** — retrait, par le MJ, d'une fenêtre de l'automate de sa liste, sans effet sur les dispos ni sur les autres.

## 4. Features

### 4.1 Fenêtres de l'automate actionnables *(JDR, MJ)*

**Description :** Les fenêtres de l'automate deviennent la matière première d'un sondage. Le MJ en sélectionne une, la voit dans le calendrier, et l'ajoute au vote ou la masque. La liste se replie pour ne plus occuper toute la colonne. Réalise UJ-1. Le mode soirée n'a pas de fenêtres de l'automate : les dispos des membres d'un groupe ne sont pas lisibles par les autres (règle du Palier 10, inchangée).

**Functional Requirements :**

#### FR-1 : Sélectionner une fenêtre de l'automate

Le MJ peut sélectionner une fenêtre de l'automate dans la liste. Réalise UJ-1.

**Consequences (testable) :**
- La fenêtre sélectionnée est mise en évidence dans le calendrier ; tous les autres créneaux sont grisés.
- Le calendrier se déplace sur la période de la fenêtre si elle n'est pas affichée.
- Une seule fenêtre est sélectionnée à la fois ; la désélectionner rend au calendrier son affichage normal.
- La carte sélectionnée propose deux actions écrites : « Ajouter au vote » et « Masquer ».

#### FR-2 : Ajouter une fenêtre au vote

Le MJ peut ajouter la fenêtre sélectionnée au sondage d'un rendez-vous. Réalise UJ-1.

**Consequences (testable) :**
- « Ajouter au vote » passe toujours par le composer : le premier ajout l'ouvre, les suivants s'y accumulent ; rien n'est envoyé aux joueurs avant la validation. *Choisi plutôt qu'un ajout immédiat : on renonce à l'ajout en un clic pour qu'un sondage ouvert ne change qu'une fois, avec un seul avertissement.*
- Le composer vise la destinée active si c'est un sondage de cette partie que le MJ peut modifier ; sinon, le MJ choisit le rendez-vous : une séance qui a déjà un sondage ouvert (le composer s'ouvre prérempli de ses créneaux candidats) ou une séance à dater (le composer s'ouvre avec cette fenêtre pour premier créneau candidat).
- Le composer prend toujours la durée du rendez-vous visé (FR-19). Si la fenêtre choisie n'a pas cette durée, elle n'est pas ajoutée : le composer s'ouvre sans elle, la liste de l'automate se recalcule à la bonne durée, et un message l'explique.
- La validation crée le sondage du rendez-vous, ou le modifie en une seule fois, avec l'avertissement habituel si des réponses sont perdues.
- Une fenêtre **quitte la liste** de l'automate dès qu'elle est dans le composer, ou créneau candidat de n'importe quel sondage ouvert de la partie. Annuler le composer la rend à la liste ; retirée d'un sondage, elle y revient si l'automate la juge toujours libre.

#### FR-3 : Masquer une fenêtre

Le MJ peut masquer une fenêtre de l'automate. Réalise UJ-1.

**Consequences (testable) :**
- La fenêtre masquée disparaît de la liste du MJ ; rien ne change pour les joueurs ni pour les dispos.
- Le masquage survit au rechargement de la page et à une nouvelle connexion, sur tous ses appareils (masquage enregistré sur le serveur, ratifié en architecture).
- Le MJ peut afficher les fenêtres masquées et en démasquer une.

#### FR-4 : Replier la liste de l'automate

Le MJ peut replier et redéplier la liste des fenêtres de l'automate. Réalise UJ-1.

**Consequences (testable) :**
- Sur ordinateur, la colonne de droite entière se range en dock collé au bord droit (flèche ›), et le calendrier reprend toute la largeur ; le dock affiche le libellé et le nombre de fenêtres, et se rouvre (flèche ‹). *Précisé en UX le 2026-10-20.* Le même repli vaut pour la colonne de droite des trois calendriers ; entrer en Destinée rouvre la colonne.
- Sur téléphone, où la colonne est sous la grille, la liste se replie verticalement et n'affiche qu'un en-tête avec le nombre de fenêtres.
- Les champs Du / Au et l'action « Scruter » (période sur laquelle l'automate calcule) ne se montrent que liste dépliée.
- L'état replié / déplié est retenu **dans ce navigateur** ; sur un autre appareil, la colonne s'ouvre dépliée. *Décidé en architecture le 2026-10-20 : c'est un état de navigation, pas une préférence de compte.*

### 4.2 Créer un sondage depuis le calendrier

**Description :** L'organisateur sait qu'un de ses rendez-vous n'a pas de date. Où qu'il soit, le calendrier lui offre une entrée visible pour lui créer un sondage : il choisit le rendez-vous dans une courte liste, puis sélectionne des jours comme il déclare ses dispos. Un organisateur n'a jamais beaucoup de rendez-vous à dater en même temps : une liste suffit. Vaut pour le MJ et pour l'hôte. Réalise UJ-2.

**Functional Requirements :**

#### FR-5 : « Créer un sondage » et choix du rendez-vous

L'organisateur du sondage peut, depuis le calendrier, créer le sondage d'un de ses rendez-vous à dater. Réalise UJ-2.

**Consequences (testable) :**
- L'action « Créer un sondage » (libellé d'interface : « Proposer des dates », variantes par thème en UX ; « Modifier les dates » quand la destinée active est un sondage de l'organisateur) est un bouton écrit et atteignable au clavier, jamais une icône seule, présent dans le calendrier personnel, le calendrier de partie et le calendrier du groupe.
- Elle ouvre la liste des **rendez-vous à dater** de l'utilisateur, groupés par partie. En calendrier de partie ou du groupe, la liste est restreinte à cette partie ; s'il n'y en a qu'un, il est choisi d'office.
- Le bouton est **caché** quand l'utilisateur n'a aucun rendez-vous à dater : il n'est organisateur d'aucune partie active, ou aucun de ses rendez-vous n'est plus à dater (§3 : déjà une date, ou un sondage lié).
- Choisir un rendez-vous ouvre le composer (FR-6) pour ce rendez-vous ; le serveur reste juge du droit de créer.
- Le composer n'existe que dans l'atelier (§3). Depuis le calendrier personnel, choisir un rendez-vous **ouvre son atelier** (calendrier de sa partie ou de son groupe), composer déjà prêt ; après la validation, on y reste, Destinée active sur le nouveau sondage. *Décidé en architecture le 2026-10-20 : le calendrier personnel suit et conclut les votes, il ne les compose pas.*
- En mode soirée, le bouton n'apparaît que pour une soirée isolée sans date (§3).
- En mode soirée, l'aller-retour existant depuis la fenêtre de création d'un événement (Story 40.5b) est conservé.

**Out of Scope :**
- Créer un nouvel événement de groupe directement depuis le calendrier (voir §6.2).

#### FR-6 : Sélectionner des jours comme pour ses dispos

L'organisateur peut sélectionner les créneaux candidats avec le même geste que la déclaration de ses dispos. Réalise UJ-2.

**Consequences (testable) :**
- Le geste de sélection (taper, glisser sur plusieurs jours) est le même que celui des dispos ; le calendrier indique clairement qu'on compose un sondage, et pour quel rendez-vous.
- Comme pour les dispos, l'organisateur **sélectionne d'abord des jours**, puis choisit le moment (matin, après-midi, soir ; journée entière en JDR) : chaque jour sélectionné devient un créneau candidat à ce moment-là (« tous les vendredis soir de novembre »). *Amendé le 2026-10-20 (UX) : la version « moment d'abord » inversait le geste des dispos.*
- Chaque nouvelle sélection **s'ajoute** aux créneaux déjà choisis, ce qui permet de mêler les moments sans touche de modification, au doigt comme à la souris. Un tap court ajoute ou retire un seul créneau.
- Deux créneaux candidats minimum, sans plafond métier ; la journée entière reste refusée en mode soirée, avec la raison écrite (règle existante), et n'est possible en JDR que pour un rendez-vous d'un créneau.
- Le composer affiche aussi l'échéance du vote (FR-18) et la durée du rendez-vous (FR-19).
- Valider crée ou modifie le sondage du rendez-vous ; annuler ne change rien.

### 4.3 Destinée enrichie

**Description :** La Destinée devient le moyen de suivre et de conclure un vote. On choisit la destinée active dans une liste qui couvre toutes ses parties actives (A) ; une fois active, la colonne de droite devient le plateau de la destinée (B). Les flèches ‹ n/N › ne parcourent plus les votes mais les créneaux candidats du vote actif. L'organisateur peut créer, modifier et conclure son sondage sans quitter la Destinée. Décision « A + B » prise pendant l'UX du Palier 10. Réalise UJ-3, UJ-4.

**Functional Requirements :**

#### FR-7 : Choisir la destinée active dans une liste

L'utilisateur peut ouvrir la liste des destinées depuis la puce ✦ et y choisir la destinée active. Réalise UJ-4.

**Consequences (testable) :**
- La liste montre les **sondages ouverts** que l'utilisateur peut voir (règle d'accès existante), groupés par partie ; chaque ligne donne le nom du vote, son échéance (« échéance passée » le cas échéant) et l'état de l'utilisateur : « à faire », « répondu », « organisateur » ou « vous ne votez pas ».
- En calendrier personnel, elle couvre toutes les **parties actives** de l'utilisateur, quel que soit le mois affiché. En calendrier de partie ou du groupe, elle ne montre que cette partie.
- Choisir une ligne active la Destinée sur ce sondage (voir FR-13 pour la vue et le créneau d'entrée).
- Les votes de groupe et de soirée isolée apparaissent aussi sur la grille du calendrier personnel, comme ceux du JDR.
- Sans sondage ouvert, la puce ✦ n'apparaît pas (comportement existant, Story 36.9 ; décidé en UX le 2026-10-20).

#### FR-8 : Plateau de la destinée

Quand la Destinée est active, la colonne de droite devient le plateau de la destinée. Réalise UJ-3, UJ-4.

**Consequences (testable) :**
- Le plateau liste les créneaux candidats de la destinée active, dans l'ordre chronologique, avec le nombre de oui de chacun.
- Cliquer un créneau candidat recentre le calendrier sur sa date.
- Les comptes se mettent à jour en direct quand un autre participant vote.
- Après l'échéance, le plateau reste consultable, sans vote possible ; il l'indique.
- Le plateau remplace le contenu habituel de la colonne tant que la Destinée est active ; le quitter rend la colonne habituelle.
- Dans l'atelier, le plateau nomme ceux qui n'ont pas répondu, **à l'organisateur seulement** (règle actuelle) ; les autres participants en voient le nombre. Dans le calendrier personnel, il en donne **le nombre** et, pour l'organisateur, un lien « voir qui » vers l'atelier : aucun nom de votant n'apparaît dans le calendrier personnel (règle de confidentialité existante).
- Pendant le composer ou la sélection d'une fenêtre de l'automate, la Destinée est suspendue (plateau et estompe masqués) ; valider la rétablit sur le sondage créé ou modifié, annuler rend l'état précédent.
- Sur mobile, le plateau s'ouvre en tiroir en bas de l'écran, replié (créneau courant) ou déplié (tous les créneaux) ; la grille reste visible tiroir replié.

#### FR-9 : Parcourir les dates du vote actif

Les flèches ‹ n/N › parcourent les créneaux candidats de la destinée active. Réalise UJ-3.

**Consequences (testable) :**
- n/N désigne le rang du créneau courant parmi les créneaux candidats du vote actif.
- Chaque flèche déplace le calendrier sur le créneau précédent ou suivant ; le créneau courant est marqué dans le plateau.
- Les flèches ne changent plus de vote : changer de vote passe par la liste des destinées (FR-7).

#### FR-10 : Créer et modifier le sondage depuis la Destinée

L'organisateur du sondage peut, depuis la Destinée, modifier les créneaux candidats de la destinée active ou créer un nouveau sondage. Réalise UJ-5.

**Consequences (testable) :**
- « Modifier » ouvre le composer prérempli avec les créneaux candidats, l'échéance et la durée ; à la validation, la Destinée reste active sur ce sondage. Depuis le calendrier personnel, « Modifier » ouvre l'atelier (FR-5).
- « Créer » suit le même chemin que FR-5 (choix d'un rendez-vous à dater, puis composer) ; le nouveau sondage devient la destinée active.
- Ces actions n'apparaissent pas pour qui n'est pas organisateur.

#### FR-11 : Fixer la date depuis la Destinée

L'organisateur du sondage peut fixer la date de la destinée active depuis le plateau de la destinée. Réalise UJ-4.

**Consequences (testable) :**
- Le plateau propose à l'organisateur « Fixer la date… », avant comme après l'échéance ; la confirmation liste les créneaux candidats avec leurs comptes (et leur plage, §4.10), le meilleur créneau (§3) en tête et présélectionné ; sans meilleur créneau, rien n'est présélectionné.
- Confirmer produit exactement l'effet du chemin existant : en JDR, celui de « Sceller ce créneau » (séance confirmée, vote fermé) ; en mode soirée, celui de « Fixer la date… » d'un événement (Story 40.6 : date posée, vote fermé, e-mail « date fixée » aux inscrits).
- Prolonger le vote : en mode soirée, l'organisateur le peut depuis le plateau, comme le permet le chemin existant (Story 40.7) ; en JDR, il n'y a pas de bouton « Prolonger » : le MJ repousse l'échéance en modifiant le sondage (FR-18), y compris après l'échéance.
- Une fois la date fixée, la Destinée se ferme sur un message (FR-12), et la date apparaît dans le calendrier.
- Les chemins existants (fiche de scénario, fenêtre de l'événement) restent en place.

#### FR-12 : Fin d'une destinée

La Destinée se termine proprement quand son sondage devient clos. Réalise UJ-3.

**Consequences (testable) :**
- Si la destinée active devient un sondage clos pendant la consultation (date fixée, annulé, supprimé), le mode se ferme avec un message ; aucun autre sondage ne prend sa place sans action de l'utilisateur.
- Dans l'atelier, le message dit pourquoi (date fixée, annulé…). Dans le calendrier personnel, il est neutre (« Ce vote n'est plus ouvert ») : ce calendrier ne connaît que les votes ouverts.
- L'échéance qui passe ne ferme **pas** la Destinée (FR-8).

### 4.4 Accès direct et filtre par partie

**Description :** On arrive sur un vote par un lien, et on peut restreindre le calendrier personnel à une partie. Réalise UJ-3, UJ-4.

**Functional Requirements :**

#### FR-13 : Ouvrir le calendrier en Destinée sur un sondage précis

Un lien peut ouvrir le calendrier directement en Destinée sur un sondage donné. Réalise UJ-3.

**Consequences (testable) :**
- Les adresses du calendrier personnel, du calendrier de partie et du calendrier du groupe acceptent un paramètre qui désigne le sondage ; l'ouvrir active la Destinée sur ce sondage.
- **Toute entrée en Destinée** (lien, liste, après validation) affiche la vue Mois (Semaine en mode soirée), même si l'Agenda est la vue habituelle, et se place sur le premier créneau candidat à venir, ou sur le meilleur créneau une fois l'échéance passée ; sur mobile, le tiroir s'ouvre replié.
- Le lien est partageable et survit à un rechargement de la page. Un lien peut aussi ouvrir directement la liste des destinées restreinte à une partie (FR-14).
- Sondage clos ou inexistant : le calendrier s'ouvre normalement, avec un message écrit.
- Utilisateur qui n'a pas accès à la partie : refus habituel, aucune information sur le sondage.

#### FR-14 : Brancher les liens de vote existants

Les accès au vote existants conduisent au sondage, en Destinée. Réalise UJ-3.

**Consequences (testable) :**
- **Partout**, un lien qui mène au calendrier pour voter y arrive en Destinée sur le bon sondage.
- « Voter dans le calendrier » d'un événement ouvre le calendrier du groupe en Destinée sur son sondage (lève la gêne acceptée au Palier 10, FR-11 du Palier 10).
- Le bouton « Voter dans le calendrier » de l'e-mail de relance avant l'échéance (Story 40.7) fait de même. C'est aujourd'hui le seul e-mail qui porte un lien de vote.
- Page d'une partie, côté joueur : le bouton « vote en attente » ouvre le calendrier en Destinée sur ce sondage ; si la partie a plusieurs sondages ouverts, il ouvre la liste des destinées restreinte à cette partie.
- Fiche de scénario, côté MJ : « Lancer le vote » d'une séance ouvre le composer pour cette séance (chemin de FR-5, rendez-vous déjà choisi). L'ancien panneau de création d'un vote (Story 8.7) disparaît.
- Un lien vers un rendez-vous qui n'est plus à dater ni modifiable (daté entre-temps, par exemple) ouvre le calendrier normalement, avec un message écrit.

**Out of Scope :**
- Le vote lui-même dans la fiche de scénario (liste des créneaux, réponse, « Sceller ce créneau ») ne change pas. Le remplacer par un résumé et un bouton vers le calendrier, comme pour un événement, relève du **Palier 10.8** (« vote en résumé plutôt qu'en liste »).
- Pas de nouvel e-mail (par exemple à l'ouverture d'un vote de JDR).

#### FR-15 : Filtrer le calendrier personnel par partie

Dans son calendrier personnel, l'utilisateur peut restreindre l'affichage à une ou plusieurs parties. Réalise UJ-4.

**Consequences (testable) :**
- Le panneau « Affichage » propose, en plus des natures existantes, la liste des parties actives de l'utilisateur (JDR et soirée), cochables, sous un libellé neutre en mode soirée.
- Le filtre s'applique aux entrées de la grille et de l'Agenda (séances, votes, …) ; les dispos de l'utilisateur, qui ne dépendent d'aucune partie, restent visibles.
- La liste des destinées, la puce ✦, le plateau et les indisponibilités ne sont pas filtrés ; entrer en Destinée sur une partie décochée la recoche.
- Le filtre n'est pas enregistré dans le compte : il est perdu au rechargement de la page ou en quittant le calendrier. *On renonce à le retrouver d'une visite à l'autre pour ne pas ajouter de préférence de compte.*
- Un filtre actif se voit dans la pastille de résumé du panneau.

**Out of Scope :**
- Le calendrier de partie et le calendrier du groupe, qui ne montrent déjà que leur partie (§3 ; Story 36.1 AC7).

### 4.5 Vocabulaire

#### FR-16 : Un mot, un sens

Le mot « destinée » ne désigne plus qu'une chose dans l'interface : le mode Destinée.

**Consequences (testable) :**
- Les fenêtres de l'automate reçoivent un autre libellé : « Éphémérides » en Grimoire Émeraude (provisoire), « Clairières disponibles » en Forêt Ancienne (inchangé), « Créneaux calculés par l'automate » en Atelier Cuivré.
- Les nouveaux libellés de ce palier existent dans les trois thèmes, et respectent les règles du mode soirée : aucun mot du JDR, et le mot « partie » n'y apparaît pas (liste des destinées, liste des rendez-vous à dater, filtre).

### 4.6 Écrans validés modifiés ⚠️

Ce palier modifie des contrats UI validés ; chaque écart doit être porté dans la planche UX du palier :

- Calendrier de partie, colonne MJ (Épic 36) : liste de l'automate repliable et actionnable ; libellé renommé.
- Calendriers personnel, de partie et du groupe : bouton « Proposer des dates » (action « Créer un sondage », FR-5) et liste des rendez-vous à dater.
- Mode Destinée (Story 36.9) : liste des destinées, plateau, sens des flèches ‹ n/N ›, fixation de la date, vue et créneau d'entrée (FR-13).
- Panneau « Affichage » du calendrier personnel (Épic 36) : filtre par partie.
- Calendrier du groupe (Story 40.5b) : ouverture en Destinée.
- Fenêtre d'un événement (Palier 10) : le lien « Voter dans le calendrier » change de destination, pas de libellé.
- Page d'une partie de JDR et fiche de scénario : les boutons qui mènent au calendrier changent de destination (FR-14), pas de forme.
- Formulaire de création (Palier 10) : bascule de mode et choix de la nature expliqués (FR-17).
- Composer (Story 36.10) : champs échéance (FR-18) et durée (FR-19) ; l'échéance du JDR, jusqu'ici fixée en silence à 14 jours, devient visible.
- Fenêtre de création et de modification d'un événement (Palier 10), éditeur de séance (JDR) : durée facultative (FR-23).
- Grille, Agenda, rail, plateau, tiroir, fenêtre de l'événement : une plage s'affiche sur tous ses jours ; fiche de scénario (y compris la liste du vote) et confirmation « Fixer la date… » : un créneau candidat de plusieurs créneaux y apparaît avec sa plage (FR-20).
- E-mails « date fixée », relance du vote et rappels de séance : la date devient une plage quand elle en est une ; dans la relance du vote, le lien change aussi de destination (FR-14).
- Colonne de droite des calendriers personnel et du groupe : repliable en dock, comme celle du MJ (FR-4).
- Calendrier personnel : les votes de groupe et de soirée isolée s'affichent sur la grille (Story 40.5 les en excluait).
- Ancien panneau de création d'un vote (Story 8.7) : retiré, remplacé par le composer ; la confirmation du composer ne garde que l'avertissement de perte de réponses.

### 4.7 Exigences transverses

- **JDR non régressé hors périmètre** : seuls les écrans de §4.6 changent, et seulement comme il y est dit ; scellement d'un créneau, inscriptions et contenu de la fiche de scénario sont inchangés, sauf l'affichage en plage (FR-20) et l'échéance visible (FR-18).
- **Confidentialité des dispos** : aucune nouvelle donnée de dispo d'un autre membre n'est exposée en mode soirée ; les fenêtres de l'automate restent réservées au MJ d'une partie de JDR.
- **Temps réel** : les comptes du plateau, la liste des destinées, la liste des rendez-vous à dater, la liste de l'automate et les plages (durée, indisponibilités) suivent les changements des autres en direct (canal existant).
- **Mobile** : chaque fonction est utilisable au doigt sur un téléphone ; aucune n'exige un appui long pour être trouvée.
- **Accessibilité** : actions écrites et atteignables au clavier ; l'estompe de la Destinée ne porte jamais seule une information.

### 4.8 Formulaire de création *(ajouté le 2026-10-20)*

**Description :** Les noms de thème (Quête, Sentier, Ralliement, La halte au gué…) donnent leur couleur à l'application mais ne disent pas ce qu'ils désignent. Demandé par l'utilisateur pendant l'UX du 10.4 : les garder, et ajouter une explication en clair.

#### FR-17 : Mode et nature expliqués

À la création d'une partie, l'utilisateur comprend, sans connaître le vocabulaire du thème, ce que désigne chaque mode et chaque nature.

**Consequences (testable) :**
- Chaque option de la bascule de mode affiche, sous son nom de thème, une ligne en clair : « Jeu de rôle » ou « Soirée entre amis ».
- Chaque nature (trois en JDR, deux en mode soirée) affiche une ligne d'explication en clair (textes : UX `EXPERIENCE.md` §2.7).
- Ces lignes sont identiques dans les trois thèmes ; celles du mode soirée n'emploient aucun mot du JDR.

### 4.9 Échéance du vote *(ajouté le 2026-10-20, après l'architecture)*

**Description :** L'organisateur sait, dès qu'il compose, quand le vote se termine. Une échéance raisonnable est proposée : si elle lui convient, il valide sans y toucher.

**Functional Requirements :**

#### FR-18 : Échéance proposée et modifiable

L'organisateur voit et peut modifier l'échéance du vote dans le composer, en JDR comme en mode soirée. Réalise UJ-2.

**Consequences (testable) :**
- Le composer affiche l'échéance, préremplie avec la plus tôt de ces deux dates : dans 14 jours, ou la veille du premier créneau candidat ; jamais avant aujourd'hui.
- Tant que l'organisateur n'a pas touché le champ, l'échéance proposée suit les créneaux qu'il ajoute ou retire.
- Il peut choisir une autre date ; une date passée est refusée, avec la raison écrite.
- En modification, le champ montre l'échéance actuelle. En mode soirée, la changer réarme la relance envoyée la veille de l'échéance, comme le fait « Prolonger » ; en JDR, il n'y a pas de relance (inchangé).
- Une échéance postérieure au premier créneau candidat est permise.
- En JDR, l'échéance, jusqu'ici fixée en silence à 14 jours, devient visible et modifiable, ce qui permet au MJ de prolonger son vote (FR-11).

### 4.10 Plages longues (lot PL-1) *(ajouté le 2026-10-20, après l'architecture)*

**Description :** Un rendez-vous peut durer plus d'un créneau : une journée JDR (après-midi + soir), un week-end jeux (du vendredi soir au dimanche après-midi). L'organisateur le sait dès la création, mais n'est pas obligé de la déclarer : la durée est facultative. Les participants votent pour la plage entière, et la date fixée occupe tout le monde sur toute la plage. Vaut pour le JDR et le mode soirée. Réalise UJ-5, UJ-6.

**Functional Requirements :**

#### FR-19 : Durée dans le composer

L'organisateur voit et peut changer, dans le composer, la durée du rendez-vous. Réalise UJ-5, UJ-6.

**Consequences (testable) :**
- Le composer reprend la durée du rendez-vous (FR-23), un créneau par défaut ; la modifier ici modifie celle du rendez-vous lui-même.
- La durée s'exprime en clair (« après-midi + soir », « 6 créneaux : du vendredi soir au dimanche après-midi » pour un départ un vendredi soir), pas seulement en nombre de créneaux.
- Chaque créneau sélectionné est le **départ** d'une plage de cette durée, quel que soit son moment ; la sélection montre toute la plage en surbrillance, du départ à la fin, pour qu'on voie ce qu'on propose. *Choisi par l'utilisateur le 2026-10-20 : pas de moment de départ imposé, l'aperçu suffit.*
- Tous les créneaux candidats d'un sondage ont la même durée.
- Les plages d'un même sondage peuvent se chevaucher (par exemple, avec 6 créneaux : vendredi soir → dimanche après-midi, et samedi matin → lundi matin) ; deux créneaux candidats identiques sont impossibles. *Décidé par l'utilisateur le 2026-10-20 ; des durées différentes dans un même vote sont notées pour plus tard (backlog).*
- Changer la durée d'un sondage qui a déjà des réponses efface toutes ses réponses, après un avertissement qui le dit.
- Avec une durée de plus d'un créneau, la journée entière n'est pas proposée.
- Durée maximale : 15 jours ; au-delà, on crée deux rendez-vous. *Décidé par l'utilisateur le 2026-10-20 : le vrai garde-fou est de pouvoir corriger (FR-23).*

#### FR-20 : Une plage s'affiche sur tous ses jours

Un créneau candidat ou une date fixée de plusieurs créneaux se voit sur chacun des jours qu'il couvre. Réalise UJ-5.

**Consequences (testable) :**
- Mois, Semaine, Agenda, rail, plateau et tiroir montrent le départ et la fin de la plage ; aucun jour couvert n'est estompé en Destinée.
- Une date fixée de plusieurs créneaux s'affiche en plage partout où une date fixée s'affiche : fiche de scénario (y compris la liste du vote), fenêtre de l'événement, liste des parties, confirmation « Fixer la date… ».
- Un créneau couvert par plusieurs plages du même vote le montre ; y répondre précise à quelle plage on répond.
- Les e-mails « date fixée », relance du vote et rappels de séance donnent la plage.
- Le rappel part la veille du **départ**.

#### FR-21 : Occupé sur toute la plage

Une date fixée de plusieurs créneaux rend indisponibles, sur chacun de ses créneaux, ceux qui y participent (les mêmes personnes que pour une séance d'un créneau). Réalise UJ-5.

**Consequences (testable) :**
- Dans les autres calendriers, la plage apparaît indisponible sur tous ses créneaux, y compris au passage du soir au lendemain matin.
- Pour un créneau candidat de plusieurs créneaux, la disponibilité affichée est la plus défavorable de la plage.
- Un chevauchement avec un autre rendez-vous est signalé par cette disponibilité, jamais refusé.
- Un rendez-vous n'est « passé » qu'une fois sa **fin** passée.

#### FR-22 : L'automate cherche des fenêtres de la bonne durée

Quand le MJ compose pour un rendez-vous de plusieurs créneaux, l'automate cherche des fenêtres de cette durée. Réalise UJ-6.

**Consequences (testable) :**
- Pendant le composer, la liste de l'automate ne propose que des fenêtres de la durée du rendez-vous, classées selon les critères actuels, appliqués à toute la plage ; hors composer, des fenêtres d'un créneau.
- Une fenêtre ne s'ajoute qu'à un sondage de même durée (FR-2).

#### FR-23 : Déclarer la durée à la création, et la corriger

L'organisateur peut indiquer la durée d'un rendez-vous en le créant, sans y être obligé, et la corriger ensuite. Réalise UJ-5.

**Consequences (testable) :**
- La fenêtre de création d'un événement (mode soirée) et l'ajout d'une séance (JDR) proposent une durée facultative ; laissée vide, le rendez-vous dure un créneau. Vaut pour un rendez-vous daté d'emblée comme pour un rendez-vous à dater. *Confirmé par l'utilisateur le 2026-10-20 pour le JDR.*
- L'organisateur peut corriger la durée à tout moment : avant la date, dans le composer (FR-19) ou la fenêtre de l'événement ; une fois la date fixée, dans la fenêtre de l'événement ou l'éditeur de séance, et la plage s'étend ou se réduit pour tout le monde (calendriers, indisponibilités, rappel).
- Modifier un autre champ (lieu, heure, note) ne change jamais la durée.

## 5. Non-Goals (Explicit)

- Pas de découvrabilité générale de la déclaration des dispos (Palier 10.6) ; ce palier ne rend découvrable que la création d'un sondage.
- Pas de dispos de groupe visibles en mode soirée, ni de fenêtres de l'automate pour un groupe.
- Pas de sondage détaché d'un rendez-vous.
- Pas de jeu d'icônes (10.7), pas de report des acquis UX côté JDR (10.8) : en particulier, le vote de la fiche de scénario garde sa forme actuelle.
- Pas de nouveau type de vote (vote sur autre chose qu'une date, vote à classement).
- Pas de durée différente d'un créneau candidat à l'autre dans un même sondage.
- Pas de liste des jeux apportés (« j'apporte ») : Palier 10.5.
- Pas de blocage des chevauchements : seule la disponibilité les signale (FR-21).
- Pas d'horaires dans une plage : des créneaux seulement (l'heure de rendez-vous existante reste celle du départ).
- Pas d'e-mail quand la durée d'un rendez-vous daté est corrigée : les calendriers suivent en direct.

## 6. MVP Scope

### 6.1 In Scope

- Fenêtres de l'automate sélectionnables, ajoutables au vote, masquables, liste repliable (FR-1 à FR-4).
- Bouton « Proposer des dates » (action « Créer un sondage ») dans les trois calendriers, choix du rendez-vous à dater, sélection de jours (FR-5, FR-6).
- Destinée enrichie A + B : liste, plateau, flèches, création / modification, fixation de la date, fin propre (FR-7 à FR-12).
- Ouverture directe en Destinée, liens de vote branchés, filtre du calendrier personnel par partie (FR-13 à FR-15).
- Un seul sens pour « destinée » (FR-16).
- Mode et nature expliqués dans le formulaire de création (FR-17).
- Échéance proposée et modifiable dans le composer (FR-18).
- Plages longues : durée facultative à la création et dans le composer, affichage, indisponibilité, automate (FR-19 à FR-23).
  `[NOTE FOR PM]` Ajoutées au palier après l'architecture, à la demande de l'utilisateur. Elles touchent le cœur des dates (indisponibilités, « passé », e-mails) : leurs stories viennent après le delta UX (§8) ; FR-1 à FR-18 n'en dépendent pas et peuvent avancer avant.

### 6.2 Out of Scope for MVP

- **Créer un nouvel événement de groupe directement depuis le calendrier** (« Créer un sondage » qui ouvrirait la fenêtre de création d'un événement). `[NOTE FOR PM]` L'utilisateur veut du recul : à réévaluer après la mise en production, sur l'application réelle et les retours de la bande. Noté dans `docs/backlog.md`, « Idées / plus tard ».
- Le reste : voir §5. Rien de ce qui est listé dans le backlog du 10.4 n'est différé.

## 7. Success Metrics

- **SM-1** : un membre de la bande qui n'a jamais vu la fonction crée un sondage pour son rendez-vous, sans aide, en moins d'une minute. Valide FR-5, FR-6.
- **SM-2** : un membre qui clique « Voter » répond sans avoir à chercher le vote dans le calendrier. Valide FR-13, FR-14.
- **SM-3** : Incon suit un vote jusqu'à sa date fixée depuis la Destinée, sans passer par la fiche de scénario ni par la fenêtre de l'événement. Valide FR-7 à FR-11.
- **SM-4** : Incon organise un week-end jeux, du choix des dates à la date fixée, avec un seul sondage et sans écrire la durée ailleurs que dans le formulaire ou le composer. Valide FR-19 à FR-21, FR-23. FR-22 n'a pas de métrique propre : UJ-6 en est le parcours de vérification.
- **SM-C1** (à ne pas optimiser) : le nombre de fonctions visibles dans la colonne de droite. Ajouter des actions ne doit pas refaire une colonne de 3 000 pixels ; contrebalance SM-1 et SM-3.

## 8. Open Questions

*Le stockage du masquage et de l'état replié a été tranché en architecture le 2026-10-20 : masquage sur le serveur (FR-3), repli dans le navigateur (FR-4).*

1. **Delta UX** pour l'échéance (FR-18) et les plages longues (FR-19 à FR-23) : place des champs, présentation de la durée en clair, rendu d'une plage sur plusieurs jours dans chaque vue.

## 9. Assumptions Index

Aucune hypothèse ouverte : celles des versions précédentes ont été ratifiées en architecture ou tranchées par l'utilisateur le 2026-10-20 (voir `.memlog.md`).
