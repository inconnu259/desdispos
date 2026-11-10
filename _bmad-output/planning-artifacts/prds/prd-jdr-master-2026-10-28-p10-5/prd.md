---
title: "Palier 10.5 — Jeux de société : ludothèque, « j'apporte », compteur d'hôtes"
status: final
created: 2026-10-28
updated: 2026-10-29
---

# PRD : Palier 10.5 — Jeux de société

## 0. Document Purpose

Ce PRD cadre le Palier 10.5 de jdr-master : faire savoir, avant une soirée, **quels jeux de société seront sur place**. Il prolonge le PRD du Palier 10 (`prds/prd-jdr-master-2026-10-08/`), dont il reprend le Glossaire sans le redéfinir (Soirée isolée, Groupe, Événement, Hôte, Invité, Membre, Inscription, Place réservée…) ; le §3 n'ajoute que les termes nouveaux. Il part des quatre puces du backlog (`docs/backlog.md`, §10.5), issues de la forge `_bmad-output/forge/soiree-jeux-de-societe/`, retaillées avec l'utilisateur les 2026-10-28 et 29 : la « bibliothèque commune » devient une vue agrégée, l'« historique des hôtes » se réduit à un compteur. Ambition volontairement modeste, fonctionnalité **entièrement facultative**. Les hypothèses du brouillon ont toutes été confirmées par l'utilisateur ; elles sont listées au §9. L'alternative écartée (import BoardGameGeek) et les pistes techniques vivent dans `addendum.md`.

## 1. Vision

En soirée jeux, personne ne sait d'avance ce qui sera disponible. Selon les fois, quelqu'un arrive avec une pile de boîtes et on ne sait plus quoi choisir ; personne n'apporte rien et il n'y a presque pas de choix ; un ami venu de loin a porté un gros jeu encombrant qui était déjà chez l'hôte ; ou l'on découvre qu'à 6, aucun jeu présent ne se joue à 6.

Le Palier 10.5 donne à chacun une **Ludothèque** : la liste de ses jeux, qu'il tient lui-même, avec le nombre de joueurs et la durée. Sur la fiche d'une soirée, tout le monde voit les **jeux sur place** — ceux de l'hôte et ceux que les Participants ont dit apporter — et peut signaler une **Envie** (« j'ai très envie de jouer à celui-là »). Dans un groupe, on voit les jeux de tous les membres et qui les possède : de quoi monter une soirée autour d'un jeu, ou demander à quelqu'un de l'apporter ou de le prêter. Un petit compteur montre enfin qui reçoit le plus souvent.

Rien de tout cela n'est obligatoire : une soirée sans aucun jeu renseigné fonctionne exactement comme au Palier 10.

## 2. Target User

### 2.1 Jobs To Be Done

- **Invité** : savoir ce qu'il y aura sur place, pour ne pas transporter un doublon et pour apporter ce qui manque.
- **Hôte** : montrer ses jeux sans rien ressaisir à chaque soirée, et retirer ceux qui ne seront pas disponibles ce soir-là.
- **Tous les Participants** : vérifier qu'il existe au moins un jeu jouable au nombre de présents ; dire à quoi on a envie de jouer.
- **Membre d'un groupe** : découvrir qui possède un jeu qu'on aimerait essayer, pour proposer une soirée ou demander un prêt (le prêt se règle hors de l'appli).
- **Groupe** : voir d'un coup d'œil si c'est toujours la même personne qui reçoit.

### 2.2 Non-Users (v1)

- Les collectionneurs qui cherchent un outil de catalogue complet (cotes, extensions, photos, valeur) : BoardGameGeek fait cela, pas nous.
- Le mode JDR : rien de ce palier ne s'y affiche.

### 2.3 Key User Journeys

- **UJ-1. Léa, hôte, montre ses jeux sans rien faire de plus.**
  Léa a rempli sa Ludothèque une fois, il y a un mois (une vingtaine de jeux). Elle propose un événement dans son groupe pour samedi. Sur la fiche de l'événement, ses jeux apparaissent d'office parmi les jeux sur place. Son *Dixit* est prêté à sa sœur : elle l'écarte pour cette soirée ; il disparaît de la fiche mais reste dans sa Ludothèque. Avec Léa, six Participants sont attendus ; la fiche lui montre que trois de ses jeux se jouent à 6.

- **UJ-2. Tom, qui vient de loin, n'apporte pas un doublon.**
  Tom habite à une heure de route et pense apporter *Terraforming Mars*, sa grosse boîte. Il ouvre la fiche de la soirée : le jeu est déjà sur place, chez Léa. Il coche à la place *Skull*, petit et jouable à 6, qui n'y était pas. Les autres voient désormais « *Skull* — apporté par Tom ». **Edge case :** Tom se désinscrit ; *Skull* quitte les jeux sur place.

- **UJ-3. Sam signale une Envie, puis monte une soirée.**
  Sam voit *Skull* sur la fiche et signale une Envie ; deux autres font de même, et la fiche affiche « 3 envies ». Une semaine plus tard, dans les Jeux du groupe, Sam découvre que Karim possède *Cascadia*, qu'il voulait essayer. Il propose un événement et, hors de l'appli, demande à Karim de l'apporter.

## 3. Glossary

*Termes ajoutés à ceux du PRD du Palier 10, employés tels quels dans tout le document.*

- **Jeu** — entrée de la Ludothèque d'une personne : un nom (obligatoire), un nombre de joueurs minimum et maximum, une durée en minutes (facultatifs). Appartient à une seule personne ; deux personnes qui possèdent le même jeu ont chacune leur Jeu.
- **Ludothèque** — l'ensemble des Jeux d'une personne, qu'elle seule modifie. Peut être vide.
- **Participant** — personne attendue à une soirée : l'hôte, plus les invités ayant accepté (soirée isolée) ou les membres inscrits (événement) ; une place réservée, invitation pas encore acceptée, n'en fait pas partie. *(Corrigé à l'architecture le 2026-10-29.)*
- **Jeux sur place** — pour une soirée isolée ou un événement : les Jeux de l'hôte non écartés, plus les Apports des autres Participants.
- **Jeu écarté** — Jeu de l'hôte qu'il retire des jeux sur place d'une soirée précise, sans le retirer de sa Ludothèque.
- **Apport** — déclaration, par un Participant, qu'il pense apporter l'un de ses Jeux à une soirée précise.
- **Envie** — signal d'un Participant, sur une soirée précise, qu'il a envie de jouer à l'un des jeux sur place. Une par personne et par jeu.
- **Jeux du groupe** — vue agrégée des Ludothèques de tous les membres d'un groupe, chaque jeu suivi de qui le possède. Ce n'est pas une entité à part : rien ne s'y ajoute directement.
- **Compteur d'hôte** — nombre d'événements passés et non annulés qu'un membre a hébergés dans un groupe.

## 4. Features

### 4.1 Ludothèque

**Description :** Chaque utilisateur tient sa Ludothèque dans une section dédiée de la page « Mon compte ». La saisie est entièrement manuelle : un nom et, si on le souhaite, le nombre de joueurs (minimum et maximum) et la durée. Une Ludothèque vide est l'état normal ; l'appli ne relance personne pour la remplir.

#### FR-1 : Gérer sa Ludothèque

Tout utilisateur peut ajouter, modifier et supprimer les Jeux de sa Ludothèque. Réalise UJ-1.

**Consequences (testable):**
- Un Jeu sans nom est refusé ; nombre de joueurs et durée sont facultatifs.
- Le nombre de joueurs se saisit en deux entiers, minimum et maximum (un seul nombre ne permettrait pas de dire « jouable à 6 ») ; un maximum inférieur au minimum est refusé.
- La durée se saisit en minutes, entier positif.
- Deux Jeux de même nom dans une même Ludothèque sont refusés, la comparaison ignorant casse et accents.
- Supprimer un Jeu le retire des Apports et des Envies des soirées à venir ; rien n'est conservé pour les soirées passées, qui n'affichent pas leurs jeux (FR-6). *(Corrigé à l'architecture le 2026-10-29.)*
- Supprimer son compte supprime sa Ludothèque.

**Out of Scope:**
- Import depuis BoardGameGeek ou tout autre catalogue (voir `addendum.md`).
- Photo, extensions, âge, complexité, notes.

#### FR-2 : Facultatif de bout en bout

Aucune action du mode soirée n'exige une Ludothèque remplie.

**Consequences (testable):**
- Créer, rejoindre et héberger une soirée fonctionnent à l'identique avec une Ludothèque vide.
- Aucune invite, aucun e-mail, aucune pastille ne pousse à la remplir. Une soirée sans jeux sur place affiche un état vide discret, avec un lien vers sa Ludothèque.

### 4.2 Jeux sur place d'une soirée

**Description :** Sur la fiche d'une soirée isolée ou d'un événement, une section liste les jeux sur place : ceux de l'hôte, puis ceux apportés, chacun avec son propriétaire. Elle répond aux quatre situations du §1 : choisir parmi beaucoup, voir qu'il manque des jeux, éviter un doublon, vérifier qu'un jeu se joue au nombre de Participants. Réalise UJ-1, UJ-2, UJ-3.

#### FR-3 : Jeux de l'hôte affichés d'office

Les Jeux de la Ludothèque de l'hôte apparaissent dans les jeux sur place de chaque soirée qu'il héberge, sans action de sa part. Réalise UJ-1.

**Consequences (testable):**
- Un Jeu ajouté par l'hôte à sa Ludothèque apparaît sur ses soirées à venir.
- L'hôte d'un événement ne change jamais : s'il quitte le groupe, ses événements à venir sont annulés (Palier 10). *(Corrigé à l'architecture le 2026-10-29.)*

#### FR-4 : Écarter un Jeu pour une soirée

L'hôte peut écarter l'un de ses Jeux des jeux sur place d'une soirée à venir, et l'y remettre. Réalise UJ-1.

**Consequences (testable):**
- Un Jeu écarté disparaît de la fiche de cette soirée seulement ; il reste dans la Ludothèque et sur les autres soirées.
- Seul l'hôte écarte ses propres Jeux.

#### FR-5 : « J'apporte »

Un Participant d'une soirée à venir, autre que l'hôte, peut cocher parmi les Jeux de sa Ludothèque ceux qu'il pense apporter, et les décocher. Réalise UJ-2.

**Consequences (testable):**
- Un Apport apparaît dans les jeux sur place avec « apporté par {pseudo} ».
- Cesser d'être Participant (désinscription, invitation déclinée) retire tous ses Apports de cette soirée.
- Une personne qui n'est pas Participant, ou une soirée passée, annulée ou terminée, ne permet aucun Apport.
- Un Participant à la Ludothèque vide voit l'option inerte, avec un lien pour ajouter un Jeu.

#### FR-6 : Lire les jeux sur place

Toute personne qui voit la fiche d'une soirée voit ses jeux sur place, rangés par provenance (chez l'hôte, apportés). Réalise UJ-1, UJ-2.

**Consequences (testable):**
- Un même nom présent plusieurs fois (hôte et Apport, ou deux Apports) figure à chaque endroit où il se trouve, marqué « ×N » et accompagné du nom des autres détenteurs : c'est ce qui rend le doublon visible avant le départ, et permet aux détenteurs d'annuler ou de se concerter. Le rapprochement se fait par nom normalisé (casse et accents ignorés) ; il n'existe pas d'identité de jeu partagée. *(Amendé par l'UX le 2026-10-29 — `ux-designs/ux-jdr-master-2026-10-29/EXPERIENCE.md` §2.3 ; les Jeux du groupe, FR-8, gardent une ligne par jeu.)*
- Chaque jeu dont la plage de joueurs contient le nombre actuel de Participants est signalé « jouable à N ». Un jeu sans nombre de joueurs n'est jamais signalé.
- La liste se met à jour sans recharger la page quand un Apport, une Envie, un Jeu écarté ou un Participant change (voir NFR temps réel).
- Une soirée passée, terminée ou annulée n'affiche pas ses jeux sur place. *(Corrigé à l'architecture le 2026-10-29.)*

#### FR-7 : Signaler une Envie

Un Participant d'une soirée à venir peut signaler une Envie sur l'un de ses jeux sur place, et la retirer. Réalise UJ-3.

**Consequences (testable):**
- Chaque jeu affiche son nombre d'Envies et qui les a signalées.
- Une personne signale au plus une Envie par jeu et par soirée.
- Un jeu qui quitte les jeux sur place (Jeu écarté, Apport retiré) perd ses Envies sur cette soirée.

**Notes:** L'Envie est volontairement minimale : elle sert à mesurer le besoin réel (SM-2) avant d'imaginer un tri, un vote ou une liste d'envies permanente.

### 4.3 Jeux du groupe et visibilité des Ludothèques

**Description :** Dans un groupe, une vue liste les Jeux de tous les membres, regroupés par nom, chacun avec ses propriétaires. Elle sert à découvrir qui a quoi, pour proposer une soirée ou demander un prêt (hors de l'appli). Réalise UJ-3.

#### FR-8 : Jeux du groupe

Tout membre d'un groupe peut consulter les Jeux du groupe.

**Consequences (testable):**
- Chaque jeu affiche nom, nombre de joueurs, durée et propriétaires.
- On peut filtrer par nombre de joueurs (« jouable à N »).
- Un membre retiré du groupe, ou qui le quitte, en disparaît aussitôt.
- La vue ne permet aucune modification ; on modifie un Jeu dans sa propre Ludothèque.

#### FR-9 : Qui voit la Ludothèque de qui

La Ludothèque d'une personne est lisible par les membres des groupes dont elle est membre, et par les personnes invitées aux mêmes soirées isolées qu'elle.

**Consequences (testable):**
- Dans une soirée isolée, l'hôte et tous les invités, qu'ils aient répondu ou non, voient la Ludothèque de chacun des autres (pas seulement leurs Apports).
- Une personne qui ne partage ni groupe ni soirée isolée avec moi ne peut pas lire ma Ludothèque : refus côté serveur, pas seulement masquage.

### 4.4 Compteur d'hôte

**Description :** Sur la page d'un groupe, chaque membre est accompagné du nombre d'événements qu'il y a hébergés. Pas de classement, pas de rappel : juste de quoi voir si c'est toujours le même qui reçoit. L'historique des événements du groupe, avec leur hôte, existe déjà (Palier 10) et n'est pas repris ici.

#### FR-10 : Afficher le Compteur d'hôte

Tout membre d'un groupe voit le Compteur d'hôte de chaque membre.

**Consequences (testable):**
- Seuls comptent les événements passés et non annulés du groupe.
- Un membre qui n'a jamais reçu affiche 0.
- Les événements hébergés par une personne qui a quitté le groupe ne sont attribués à personne.
- Le compteur ne concerne pas les soirées isolées.

### Cross-cutting NFRs

- **Mode soirée seulement.** Aucune section, aucun libellé de ce palier n'apparaît sur une partie JDR.
- **Permissions.** Chaque droit de ce palier (écarter, apporter, signaler une Envie, lire une Ludothèque) passe par le point unique des règles de permission du Palier 10 (FR-13 du PRD 10).
- **Temps réel.** La fiche d'une soirée et la vue des Jeux du groupe sont câblées sur le signal de changement de leur partie, comme le reste du mode soirée (`docs/checklist.md`) ; modifier sa Ludothèque met à jour les soirées et les groupes concernés.
- **Volume.** Une Ludothèque de 300 Jeux et un groupe de 20 membres restent lisibles et rapides à afficher sur téléphone (ordres de grandeur, pas des limites imposées).

## 5. Non-Goals (Explicit)

- Pas de catalogue de jeux partagé ni d'import BoardGameGeek : chacun saisit ses Jeux à la main.
- Pas de suivi de prêt dans l'appli ; le prêt se règle entre amis.
- Pas de bibliothèque propre au groupe (Jeux appartenant au groupe) : les Jeux du groupe ne font qu'agréger.
- Pas de liste d'envies permanente, de vote sur le jeu de la soirée, ni de recommandation.
- Pas d'e-mail, de notification ou de rappel lié aux jeux.
- Pas de classement ni d'incitation autour du Compteur d'hôte.

## 6. MVP Scope

### 6.1 In Scope

- Ludothèque personnelle, saisie manuelle (FR-1, FR-2).
- Jeux sur place d'une soirée : Jeux de l'hôte, Jeux écartés, Apports, regroupement par nom, « jouable à N » (FR-3 à FR-6).
- Envie sur un jeu sur place (FR-7).
- Jeux du groupe et règle de visibilité des Ludothèques (FR-8, FR-9).
- Compteur d'hôte (FR-10).

### 6.2 Out of Scope for MVP

- Import BoardGameGeek : enregistrement de l'appli, jeton et logo obligatoire, un coût que l'ambition du palier ne justifie pas (perspective).
- Suivi de prêt : évolution future possible.
- Envie hors d'une soirée (liste d'envies sur le profil) : à décider selon SM-2.

## 7. Success Metrics

Palier à usage privé : le succès se juge à l'usage par la bande, pas à des chiffres fins.

- **SM-1** : Dans le mois qui suit la livraison, au moins la moitié des membres ayant participé à un événement du groupe ont une Ludothèque non vide. Valide FR-1, FR-3.
- **SM-2** : Des Envies sont signalées sur au moins une soirée sur deux ; sinon, on n'ira pas plus loin sur ce sujet. Valide FR-7.
- **SM-3** : Plus d'histoire de doublon transporté pour rien, ni de soirée sans jeu jouable au nombre de présents. Valide FR-5, FR-6.

**Counter-metrics (do not optimize)**
- **SM-C1** : Taux de remplissage des Ludothèques — ne pas le pousser par des relances : la fonctionnalité doit rester facultative (FR-2). Contrebalance SM-1.

## 8. Open Questions

*Toutes résolues par l'UX le 2026-10-29 (`ux-designs/ux-jdr-master-2026-10-29/`).*

1. ~~Libellés de l'interface~~ — fixés par thème (EXPERIENCE.md §3) : onglet Reliques / Trésors / Joyaux, etc.
2. ~~Tri des jeux sur place~~ — filtres « Jouables à N » et « Les plus … » (par Envies), sections par provenance (EXPERIENCE.md §2.3).
3. ~~Recherche dans les Jeux du groupe~~ — recherche par nom et filtre « jouable à » (EXPERIENCE.md §2.5).

## 9. Hypothèses confirmées

*Faites au brouillon et confirmées par l'utilisateur le 2026-10-29.*

- §2.2, NFR — Rien de ce palier ne s'affiche en mode JDR.
- §4.1 — Ludothèque gérée depuis « Mon compte ».
- FR-1 — Nombre de joueurs en deux champs, minimum et maximum.
- FR-1 — Doublon de nom refusé dans une même Ludothèque, casse et accents ignorés.
- FR-1 — Supprimer un Jeu le retire des soirées à venir (les soirées passées n'affichent plus de jeux, architecture 2026-10-29).
- FR-2 — État vide discret avec lien vers sa Ludothèque.
- ~~FR-3 — Les jeux sur place suivent un changement d'hôte.~~ Sans objet : l'hôte ne change jamais (architecture 2026-10-29).
- FR-5 — Option « J'apporte » inerte avec lien si la Ludothèque est vide.
- FR-6 — Regroupement par nom normalisé, sans identité de jeu partagée.
- ~~FR-6 — Section figée et lisible après la soirée.~~ Remplacé : une soirée passée ou annulée n'affiche pas ses jeux (architecture 2026-10-29).
- FR-8 — Filtre par nombre de joueurs dans les Jeux du groupe.
- FR-9 — Dans une soirée isolée, la Ludothèque est visible de l'hôte et de tous les invités, répondu ou non.
- FR-10 — Événements d'un ancien membre attribués à personne.
- NFR — Ordres de grandeur : 300 Jeux par Ludothèque, 20 membres par groupe.

*Précisé à la revue, après confirmation :* le terme **Participant** (§3) et la valeur de N dans « jouable à N » (nombre de Participants, hôte compris).
