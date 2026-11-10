---
title: "jdr-master Experience — Delta Palier 10.4 Sondage et Destinée dans le calendrier"
status: final
created: 2026-10-20
updated: 2026-10-20
design: DESIGN.md
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/mockups/contrat-ui-calendrier.html
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/.working/extrait-sources.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/.memlog.md
---

# jdr-master — Experience — Delta Palier 10.4

**Ce document est un delta.** Il décrit comment fonctionnent, dans le calendrier, la création d'un sondage et le suivi d'un vote après le Palier 10.4 (PRD `prd-jdr-master-2026-10-19-p10-4`, FR-1 à FR-23). Tout ce qu'il ne mentionne pas reste tel que le fixent le contrat du calendrier (Palier 9, `ux-jdr-master-2026-08-04/`) et le delta du Palier 10. Les écarts aux écrans validés sont signalés ⚠️ et listés en §10.

Il amende le PRD sur un point, décidé avec l'utilisateur le 2026-10-20 : **le geste de sélection garde l'ordre des dispos** (on sélectionne les jours, puis on choisit le moment), et une sélection s'ajoute à la précédente. Plus de touche Maj ni d'équivalent tactile (PRD FR-6).

**Mise à jour du 2026-10-20, après l'architecture** (spine `architecture-jdr-master-2026-10-20-p10-4`) et la mise à jour du PRD :
- **Atelier et vitrine.** On compose un sondage seulement dans le calendrier de la partie ou du groupe (l'« atelier ») ; le calendrier personnel (la « vitrine ») suit et conclut les votes, et aiguille vers l'atelier. Le plateau de la vitrine ne nomme personne.
- **Échéance** visible et modifiable dans le composer (PRD FR-18, §2.8).
- **Plages longues** : un rendez-vous peut durer plusieurs créneaux : la durée se règle au compteur, la plage s'affiche en bandes reliées (PRD FR-19 à FR-23, §2.8 à §2.10). Options comparées : [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html) ; retenues : **1A** et **2A**.
- **PRD aligné** : d'abord avec ce delta (FR-5, FR-6, FR-7, FR-8, FR-16, FR-17), puis après l'architecture (FR-2, FR-4, FR-5, FR-7, FR-8, FR-10 à FR-15, FR-18 à FR-23).

En cas de conflit avec une planche de `mockups/`, **ce document gagne**.

---

## 1. Foundation

- **Form-factor** : web responsive. Le MJ prépare surtout sur ordinateur, joueurs et membres votent surtout sur téléphone (P9, amendement 2). Les deux supports sont des cibles de premier rang pour la Destinée.
- **UI system** : Angular Material 22, composant unique `CalendarView` derrière trois routes : `/parties/:id/calendar` (calendrier de partie, MJ), `/parties/:id/guild-calendar` (joueur de JDR et groupe), `/profile/calendar` (calendrier personnel). Dans ce document, **atelier** = calendrier de partie ou du groupe (on y compose), **vitrine** = calendrier personnel.
- **Identité visuelle** : `DESIGN.md` de ce dossier, qui hérite du Palier 10 et du Palier 9.

## 2. Information Architecture

### 2.1 Ce qui apparaît où

| Élément | Calendrier de partie (MJ) | Calendrier de partie (joueur) / du groupe | Calendrier personnel |
| --- | --- | --- | --- |
| Fenêtres de l'automate (§2.2) | oui, colonne de droite | joueur : version agrégée inchangée, sans action ; groupe : non | non |
| « Proposer des dates » (§2.3) | oui, si un rendez-vous de la partie est à dater | hôte : oui, si une soirée sans date l'attend | oui, si l'utilisateur a au moins un rendez-vous à dater ; **ouvre l'atelier** |
| Composer (§2.3, §2.8) | oui | hôte : oui | **non** : aiguille vers l'atelier |
| Puce ✦ et liste des destinées (§2.4) | votes de cette partie | votes de cette partie | votes de toutes les parties actives |
| Plateau de la destinée (§2.5) | remplace la colonne de droite ; noms des absents pour le MJ | remplace la colonne de droite ; noms des absents pour l'hôte | colonne qui apparaît avec la Destinée (≥ 768 px) ; **nombre** d'absents, jamais de noms |
| Filtre par partie (§2.6) | non (déjà restreint) | non (déjà restreint) | oui, dans « Affichage » |
| Votes sur la grille | votes de la partie | votes de la partie | ⚠️ votes de **toutes** les parties actives, groupes et soirées compris (la Story 40.5 les excluait) |

Sous 768 px, le plateau est un **tiroir du bas** dans les trois calendriers ; le reste de la colonne de droite reste empilé sous la grille, comme aujourd'hui.

### 2.2 ⚠️ Fenêtres de l'automate (colonne MJ)

Planche : [`mockups/proposition-colonne-mj-ephemerides.html`](mockups/proposition-colonne-mj-ephemerides.html). Ordre de la colonne MJ, inchangé sauf la liste : bloc « qui manque » par vote ouvert (ou « Aucun conseil de date en cours. »), puis **la liste de l'automate**, désormais :

1. **En-tête** « Éphémérides · 18 » (libellé du thème, §3.1).
   - **≥ 768 px** : une flèche **›** dans l'en-tête de la colonne **range toute la colonne de droite en dock** collé au bord droit ; le calendrier reprend toute la largeur. Le dock (bande verticale étroite) porte une flèche **‹** pour la rouvrir et, en vertical, le libellé et le compteur (« Éphémérides · 18 »). Demandé par l'utilisateur le 2026-10-20.
   - **< 768 px** : la colonne étant empilée sous la grille, l'en-tête replie la liste verticalement (chevron).
   - État retenu **dans ce navigateur**, un seul pour toutes les colonnes de droite ; ouverte par défaut ; entrer en Destinée la rouvre. *Décidé en architecture le 2026-10-20.*
2. **Colonne ouverte / liste dépliée** : champs Du / Au et « Scruter », puis les cartes, puis le lien « Afficher les N masquées » s'il y en a.
3. **Carte sélectionnée** : « Ajouter au vote » et « Masquer ». « Ajouter au vote » verse la fenêtre dans le vote de la **destinée active** si le MJ peut le modifier ; sinon il ouvre le choix du rendez-vous, qui liste les séances sans date **et** celles dont le vote est ouvert (composer prérempli de leurs dates). Composer déjà ouvert : la fenêtre y entre directement.
4. **Pendant le composer**, la liste se recalcule à la durée du composer (§2.8) : chaque carte montre alors sa plage (« ven. soir → dim. après-midi »). Hors composer, les fenêtres durent un créneau.
5. Les joueurs gardent leur version agrégée, inchangée (ni exclusion des fenêtres proposées, ni masquage).

### 2.3 ⚠️ « Proposer des dates » et le choix du rendez-vous

Le bouton « Proposer des dates » remplace, dans la ligne de contrôles, le bouton d'armement du composer (« Inscrire des dates ») et les boutons « Composer les créneaux : {titre} » de l'hôte. Il porte le PRD FR-5 (« Créer un sondage » y était un nom de travail) :

1. Toucher « Proposer des dates » ouvre le **choix du rendez-vous** : ses rendez-vous à dater, groupés par partie (nom propre en en-tête). En calendrier de partie ou du groupe, seuls ceux de cette partie ; **s'il n'y en a qu'un, l'étape est sautée**. En mode soirée, seule une soirée sans date peut y figurer (un événement de groupe naît daté ou avec son vote). Une séance dont le vote a été fermé sans date n'y figure pas ; la remettre sans date depuis sa fiche la rend de nouveau proposable.
   - ⚠️ **Dans la vitrine**, choisir un rendez-vous **ouvre son atelier** (calendrier de sa partie ou de son groupe), composer déjà armé. Après Valider, on y reste, Destinée active sur le nouveau vote ; Annuler laisse aussi l'utilisateur dans l'atelier, en calendrier normal (Destinée rétablie si elle était active) ; dans les deux cas, la flèche ← ramène au calendrier personnel. *Décidé en architecture le 2026-10-20.*
2. Le rendez-vous choisi arme le composer, avec la barre `app-compose-bar` : « Pour : {nom du rendez-vous} », compte, **Durée** et **Fin du vote** (§2.8), Valider, Annuler. En calendrier du groupe, l'armement bascule en vue Semaine (règle 40.5b conservée).
3. **⚠️ Le rendez-vous se choisit avant, plus à la validation.** La fenêtre de validation (`ComposeConfirmDialog`) ne garde que sa face « avertissement de perte de réponses ».

Quand la destinée active est un sondage dont l'utilisateur est l'organisateur, le même bouton devient « Modifier les dates » et arme le composer prérempli (créneaux, durée, fin du vote) ; dans la vitrine, il ouvre l'atelier. Armer le composer **suspend** la Destinée (plateau et estompe masqués) ; Valider la rétablit sur le vote créé ou modifié, Annuler rend l'état précédent. Le bouton est **absent** quand il n'y a rien à proposer ni à modifier.

L'aller-retour depuis la fenêtre « Nouvelle conjonction » (« Choisir les créneaux dans le calendrier », 40.5b) est conservé ; la durée fait l'aller et le retour avec les créneaux.

« Lancer le vote » (fiche de scénario) arme désormais ce même composer ; ⚠️ l'ancien panneau de création d'un vote (Story 8.7) disparaît.

### 2.4 ⚠️ La puce ✦ et la liste des destinées

- La puce reste hors du panneau « Affichage » (c'est un mode, pas un filtre). **Elle ouvre désormais la liste des destinées** (tiroir modal sous 1024 px, menu ancré au-delà). Planche : [`mockups/proposition-tiroir-destinee-mobile.html`](mockups/proposition-tiroir-destinee-mobile.html), écran ①.
- La liste groupe par partie les **sondages ouverts** que l'utilisateur peut voir, échéance passée comprise. Chaque ligne : nom du vote, « Fin du vote {date} · N créneaux » ou « Vote terminé · N créneaux », pastille d'état (§5.2).
- Une destinée active s'affiche en tête de liste, avec « Quitter la Destinée ». `[ASSUMPTION]`
- Choisir une ligne active la Destinée et place la grille sur le premier créneau candidat **à venir** ; après l'échéance, sur le meilleur créneau (le plus de oui, puis de peut-être, puis le plus tôt ; options passées exclues). *Ratifié en architecture.*
- Le filtre par partie (§2.6) ne touche ni la liste ni la puce.
- Sans sondage ouvert, la puce reste **absente** (Story 36.9, AC10) : choix validé par l'utilisateur le 2026-10-20 ; le PRD FR-7 est ajusté en conséquence.
- La Destinée n'existe pas en vue Agenda (36.9). **Toute** entrée en Destinée (liste, lien, après validation) affiche la vue Mois (Semaine en mode soirée) et replie le tiroir mobile.

### 2.5 ⚠️ Le plateau de la destinée

Planche : écrans ② et ③.

- **Tiroir replié** (mobile) : nom du vote ; « n / N · {départ} → {fin} · x oui · fin du vote … » (pour un créneau unique : « n / N · {date} {moment} · x oui · fin du vote … ») ; pastille d'état ; « Voir les N dates » et, pour l'organisateur, « Fixer la date… ».
- **Tiroir déplié / colonne de droite** : titre ; sous-titre « Fin du vote {date} · x réponses sur N » (« Vote terminé le {date} · plus de vote possible » ensuite) ; liste des créneaux candidats dans l'ordre chronologique, chacun avec ses oui et une barre, « meilleur » sur le meilleur créneau, le courant entouré ; une plage s'écrit du départ à la fin (« ven. 6 soir → dim. 8 après-midi ») ; actions de l'organisateur.
- **Qui n'a pas répondu** : à l'atelier, « N'ont pas … : {noms} » (clé existante) **pour l'organisateur seulement**, « {n} n'ont pas encore répondu » pour les autres. ⚠️ Dans la vitrine, jamais de noms : « {n} n'ont pas encore répondu » et, pour l'organisateur, le lien « voir qui », qui ouvre l'atelier sur ce vote.
- **Actions de l'organisateur**, avant comme après la fin du vote :
  - « Modifier les dates » (composer prérempli ; dans la vitrine, ouvre l'atelier) et « Fixer la date… » ;
  - en mode soirée, « Prolonger le vote ». En JDR, pas de « Prolonger » : le MJ repousse la fin du vote en modifiant les dates ; une fois le vote terminé, le plateau le lui dit (« Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. ») ;
  - sous ces actions, un lien texte « Proposer des dates pour un autre rendez-vous » ouvre le choix du rendez-vous (FR-5, FR-10) ; le nouveau vote devient la destinée active.
- **Colonne MJ** : le plateau garde en pied l'en-tête replié « Éphémérides · N » ; le déplier et toucher une carte suspend la Destinée, la désélection la rétablit.
- **Un votant** n'a pas d'action dans le plateau : il répond **sur la grille**, avec le sélecteur de réponse existant (Oui / Peut-être / Non / Retirer ma réponse).

### 2.6 Filtre par partie (calendrier personnel)

Dans le panneau « Affichage », sous « Ce que je vois », une section « Seulement » `[ASSUMPTION]` liste les parties actives par leur nom, en cases à cocher, toutes cochées par défaut. Décocher une partie masque, sur la grille et dans l'Agenda, ses séances, votes et inscriptions ; les dispos restent. La liste des destinées, la puce ✦, le plateau, le rail de détail et les indisponibilités ne sont **pas** filtrés ; entrer en Destinée sur une partie décochée la recoche et rallume « Votes en cours » dans « Ce que je vois ». La pastille de résumé l'annonce (« Affichage filtré · 2 sur 3 »). Le filtre est perdu au rechargement de la page.

### 2.7 ⚠️ Formulaire de création — mode et nature expliqués

Ajout demandé par l'utilisateur le 2026-10-20, rattaché au 10.4 (PRD FR-17). Les noms de thème restent ; une **ligne en clair**, identique dans les trois thèmes, dit ce qu'ils désignent.

- **Bascule de mode** (`mode-switch`, P10 §7.2) : chaque option sur deux lignes, le nom du thème puis la ligne en clair, pour voir les deux choix avant de cliquer.
- **Nature** : sous chaque option, une ligne d'explication ; l'option choisie garde la sienne visible.

| Choix | Grimoire / Forêt / Atelier | Ligne en clair |
| --- | --- | --- |
| Mode JDR | Quête / Sentier / Mission | Jeu de rôle |
| Mode soirée | Ralliement / Veillée / Rassemblement | Soirée entre amis |
| Nature JDR `ONE_SHOT` | Quête unique / Sentier court / Mission unique | Une seule séance : l'histoire commence et se termine le même soir. |
| Nature JDR `CAMPAGNE_LINEAIRE` | Chronique / Longue marche / Programme | Une histoire suivie sur plusieurs séances, avec la même troupe. |
| Nature JDR `CAMPAGNE_EPISODIQUE` | Chronique épisodique / Longue marche par étapes / Programme à cycles | Plusieurs séances complètes chacune ; les joueurs peuvent changer d'une séance à l'autre. |
| Nature soirée isolée | La conjonction des Esprits / La halte au gué / La réunion d'établi | Un rendez-vous unique : on invite, on trouve une date, et c'est fini. |
| Nature groupe | La convergence des Sortilèges / La grande transhumance / Le grand chantier | Une bande d'amis durable : chaque membre peut proposer des rencontres, chez lui, quand il veut. |

Ces clés entrent dans `NEUTRAL_KEYS`, raison : « explication en clair, volontairement hors thème ». Les lignes du mode soirée n'emploient aucun mot du JDR. Les mêmes lignes accompagnent la nature partout où on peut la changer ensuite (édition de la partie). `[ASSUMPTION]`

### 2.8 ⚠️ Le composer : durée et fin du vote

Planche : [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html), option **1A**. La barre `app-compose-bar` gagne deux lignes sous « Pour : … » :

1. **Durée** : compteur « − {n} créneau(x) + », prérempli avec la durée du rendez-vous (**1 créneau** par défaut, sans mention « facultatif »). À côté, en clair :
   - dès qu'un départ est choisi, **la plage** au départ du premier créneau sélectionné : « ven. soir → dim. après-midi » ;
   - sinon, dès 3 créneaux, **la traduction en jours** : « soit 2 jours », « soit 1 jour et 1 créneau ». `[ASSUMPTION]` pour les cas non multiples de 3.
   - Plafond : 15 jours (45 créneaux) ; le + se grise et un message l'explique (§3.1).
2. **Fin du vote** : « Fin du vote : {date} ✎ ».
   - **Défaut** : la plus tôt de ces dates, dans 14 jours ou la veille du premier créneau ; jamais avant aujourd'hui. Une ligne explique le défaut (« Proposé : dans 14 jours » ou « Proposé : la veille du premier créneau »). Tant qu'on n'a pas touché la date, elle suit les créneaux ajoutés ou retirés.
   - **Saisie** : le crayon ouvre le sélecteur de date existant ; une date passée est refusée avec sa raison.
   - **Après la fin du vote** (modification) : le champ montre la date passée, marquée « passée », et Valider reste bloqué tant qu'elle n'est pas repoussée.

Règles :
- Changer la durée **change celle du rendez-vous**. Si le vote a déjà des réponses, Valider ouvre l'avertissement de perte, qui compte **toutes** les réponses (« Changer la durée efface les {n} réponses déjà données. »).
- Avec une durée de plus d'un créneau, la portée « Journée » disparaît de la barre de sélection ; une case journée déjà posée est retirée, et un message l'explique (§3.1) ; en vue Mois, toucher une case entière bascule en Semaine.
- Une fenêtre de l'automate d'une autre durée n'est pas ajoutée : le composer s'ouvre sans elle, la liste se recalcule, et un message l'explique (§3.1).
- **Une seule durée par vote** dans ce palier (des durées différentes dans un même vote sont notées pour plus tard). Les plages d'un même vote **peuvent se chevaucher** (§2.9) ; deux créneaux candidats au même départ sont impossibles.

### 2.9 ⚠️ Une plage sur plusieurs jours

Option **2A**, bandes reliées : chaque créneau couvert prend le marquage existant (liseré orange d'un vote, filet d'une séance fixée), une petite flèche relie la dernière bande d'un jour à la première du lendemain, et le nom s'écrit sur la première bande visible (détail : DESIGN §7.8). Partout :

| Surface | Rendu |
| --- | --- |
| Mois | bandes reliées, sur chaque jour couvert ; le reste du jour reste libre et lisible |
| Semaine | même principe, créneau par créneau, d'une colonne à l'autre |
| Agenda | **une** ligne par plage : « ven. 6 nov. soir → dim. 8 nov. après-midi » |
| Rail de détail | la plage apparaît sur chaque jour couvert, avec « (suite) » hors du premier |
| Plateau, tiroir, liste du vote de la fiche de scénario, confirmation « Fixer la date… » | le créneau candidat s'écrit du départ à la fin |
| Fenêtre de l'événement, fiche de scénario, liste des parties | la date fixée s'écrit du départ à la fin |
| E-mails « date fixée », relance, rappel de séance | la date devient « du vendredi 6 novembre au soir au dimanche 8 après-midi » ; le rappel part la veille du départ |

- **Aperçu** : pendant la sélection (et au survol à la souris), toucher un départ allume l'état d'aperçu existant (pointillé vert) sur **toutes** les bandes de la plage ; on voit ce qu'on propose avant de le valider.
- **Disponibilité** d'un créneau candidat long (jauge, plateau, conflit) : la plus défavorable de la plage. Un chevauchement avec un autre rendez-vous se voit mais n'est jamais refusé.
- **Estompe** de la Destinée : aucun jour couvert par une plage n'est estompé.
- **Chevauchement** dans un même vote : une bande couverte par plusieurs plages porte « ×2 » (ou « ×3 ») ; la toucher pour voter ouvre le sélecteur de réponse avec **une ligne par plage** (« ven. 6 soir → dim. 8 après-midi »), le créneau courant en tête. Dans le plateau, chaque plage reste une ligne distincte.
- **Occupé** : dans les autres calendriers, chaque créneau d'une plage fixée prend le marquage d'indisponibilité existant ; une plage commencée reste « à venir » (prochaine séance, liste des parties) jusqu'à sa fin.

### 2.10 ⚠️ Durée à la création, et corrigée ensuite

- La fenêtre de création d'un événement (mode soirée) et l'ajout d'une séance (JDR) portent le même compteur **Durée**, prérempli à 1 créneau. Si la date est déjà saisie, il écrit la plage en clair (« sam. 14 après-midi → sam. 14 soir ») ; sinon, la traduction en jours.
- Dans la fenêtre d'un événement, changer la durée d'un vote qui a des réponses ouvre le même avertissement de perte que le composer (§2.8).
- On corrige la durée à tout moment : dans le composer tant que la date n'est pas fixée ; une fois la date fixée, dans la fenêtre de l'événement ou l'éditeur de séance, et la plage s'étend ou se réduit pour tout le monde en direct. Pas d'e-mail pour cette correction.
- Modifier un autre champ (lieu, heure, note) ne change jamais la durée.

## 3. Voice and Tone

### 3.1 Libellés par thème

Toute clé nouvelle a une voix par thème, ou entre dans `NEUTRAL_KEYS` avec sa raison. Aucun mot du JDR (MJ, campagne, scénario, séance, joueur, quête) ni « partie » dans un libellé que le mode soirée affiche. Libellés **provisoires**, à valider sur l'application. `[ASSUMPTION]`

| Usage | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| Usage | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| Fenêtres de l'automate (`section.slots`) ⚠️ | **Éphémérides** *(provisoire ; repli : Augures du calendrier)* | Clairières disponibles *(inchangé)* | **Créneaux calculés par l'automate** |
| Carte sélectionnée — ajouter | Ajouter au vote | Ajoute au vote | Verser au vote |
| Carte sélectionnée — masquer | Masquer | Masque | Écarter |
| Pied de liste | Afficher les {n} masquées | Montre les {n} masquées | Afficher les {n} écartées |
| Carte masquée | Démasquer | Fais-la revenir | Réintégrer |
| Bouton de proposition | Proposer des dates | Propose des dates | Soumettre des dates |
| Bouton de modification | Modifier les dates | Modifie les dates | Réviser les dates |
| Titre du choix du rendez-vous | Quel rendez-vous dater ? | Quel rendez-vous veux-tu dater ? | Rendez-vous à planifier |
| Filtre par partie (section) | Seulement ces rendez-vous | Seulement ceux-ci | Restreindre à |
| Titre de la liste des destinées | Choisir une destinée | Choisis une destinée | Sélectionner une destinée |
| Sous-titre de la liste | Tous vos votes ouverts, quel que soit le mois. | Tous tes votes ouverts, quel que soit le mois. | Tous vos votes ouverts, tous mois confondus. |
| Quitter le mode | Quitter la Destinée | Quitte la Destinée | Sortir de la Destinée |
| Tiroir replié — déplier | Voir les {n} dates | Déplie les {n} dates | Détailler les {n} dates |
| Absents, nombre | {n} n'ont pas encore répondu | {n} n'ont pas encore répondu | {n} réponses manquantes |
| Absents, lien (organisateur, vitrine) | voir qui | voir qui | voir le détail |
| Rouvrir un vote JDR (plateau) | Pour rouvrir le vote, modifiez les dates et repoussez la fin du vote. | Pour rouvrir le vote, modifie les dates et repousse la fin du vote. | Pour rouvrir le scrutin, révisez les dates et repoussez la clôture. |
| Autre rendez-vous (plateau) | Proposer des dates pour un autre rendez-vous | Propose des dates pour un autre rendez-vous | Soumettre des dates pour un autre rendez-vous |
| Vote terminé (liste, plateau) | Vote terminé · plus de vote possible | Vote terminé · plus de vote possible | Scrutin clos · plus de vote possible |
| Suite d'une plage (rail) | (suite) | (suite) | (suite) |
| Plusieurs plages sur un créneau | ×{n} | ×{n} | ×{n} |
| Composer — durée | Durée | Durée | Durée |
| Composer — unité | {n} créneau · {n} créneaux | {n} créneau · {n} créneaux | {n} créneau · {n} créneaux |
| Traduction en jours | soit {j} jour(s) [et {r} créneau(x)] | soit {j} jour(s) [et {r} créneau(x)] | soit {j} jour(s) [et {r} créneau(x)] |
| Composer — échéance | Fin du vote | Fin du vote | Clôture du scrutin |
| Défaut de l'échéance | Proposé : dans 14 jours. / Proposé : la veille du premier créneau. | Proposé : dans 14 jours. / Proposé : la veille du premier créneau. | Par défaut : dans 14 jours. / Par défaut : la veille du premier créneau. |
| Fin du vote passée (refus) | La fin du vote ne peut pas être passée. | La fin du vote ne peut pas être passée. | La clôture du scrutin ne peut pas être passée. |
| Perte de réponses (durée) | Changer la durée efface les {n} réponses déjà données. | Changer la durée efface les {n} réponses déjà données. | Changer la durée efface les {n} réponses consignées. |
| Fenêtre d'une autre durée | Cette fenêtre ne dure pas {n} créneaux : elle n'a pas été ajoutée. | Cette fenêtre ne dure pas {n} créneaux : elle n'a pas été ajoutée. | Ce créneau calculé ne dure pas {n} créneaux : il n'a pas été versé. |
| Journée retirée (durée > 1) | Une durée de plusieurs créneaux ne se combine pas avec une journée entière. | Une durée de plusieurs créneaux ne se combine pas avec une journée entière. | Une durée de plusieurs créneaux exclut la journée entière. |
| Plafond | 15 jours au plus : au-delà, créez deux rendez-vous. | 15 jours au plus : au-delà, crée deux rendez-vous. | 15 jours au plus : au-delà, planifier deux rendez-vous. |
| Vote clos, atelier : date fixée | Ce vote est clos : sa date est fixée. | Ce vote est clos : sa date est fixée. | Ce scrutin est clos : sa date est fixée. |
| Vote clos, atelier : annulé | Ce vote est clos : le rendez-vous est annulé. | Ce vote est clos : le rendez-vous est annulé. | Ce scrutin est clos : le rendez-vous est annulé. |
| Vote clos, atelier : autre raison | Ce vote est clos. | Ce vote est clos. | Ce scrutin est clos. |
| ⚠️ Vote clos, vitrine (message neutre) | Ce vote n'est plus ouvert. | Ce vote n'est plus ouvert. | Ce scrutin n'est plus ouvert. |
| Lien vers un vote clos ou inexistant | Ce vote n'existe pas ou n'est plus ouvert. | Ce vote n'existe pas ou n'est plus ouvert. | Ce scrutin n'existe pas ou est clos. |
| Lien vers un rendez-vous qui n'est plus à dater | Ce rendez-vous n'est plus à dater. | Ce rendez-vous n'est plus à dater. | Ce rendez-vous n'est plus à planifier. |

« Scruter », « Fixer la date… », « Prolonger le vote », « Voter dans le calendrier », « N'ont pas … » : clés existantes, inchangées. Les clés de durée et d'échéance sans voix propre (« Durée », unités, « soit … », « (suite) », « ×{n} ») entrent dans `NEUTRAL_KEYS` : raison « mesure, volontairement hors thème ». Les libellés d'accessibilité (« Ranger la colonne », « Rouvrir la colonne », « Raccourcir », « Allonger », « Destinée : {nom} », « Créneau {n} sur {N}, … », « {x} réponses sur {N} », « Affichage filtré · {k} sur {n} », libellé vertical du dock) y entrent aussi : raison « libellé d'accessibilité ou de mesure, volontairement hors thème ».

### 3.2 Pastilles d'état (liste des destinées)

| État | Grimoire | Forêt | Atelier |
| --- | --- | --- | --- |
| à répondre | À faire | À faire | À traiter |
| a répondu | Répondu | Répondu | Consigné |
| organisateur | Organisateur | Organisateur | Organisateur |
| ne vote pas | Vous ne votez pas | Tu ne votes pas | Non votant |

« Organisateur » et « meilleur » : candidats à `NEUTRAL_KEYS` (mot de travail, identique partout).

### 3.3 Nature d'un rendez-vous (choix du rendez-vous)

JDR : « séance sans date », ou « séance au vote ouvert » (quand le choix part d'une fenêtre de l'automate ; composer prérempli). Mode soirée : seule une soirée isolée peut y figurer, « soirée sans date » dans les trois thèmes.

## 4. Component Patterns

| Composant | Comportement |
| --- | --- |
| `DestinySheet` (mobile) | Non modal. Deux hauteurs, repliée et dépliée ; on bascule par la poignée (glisser) ou le bouton « Voir les N dates » (`aria-expanded`). Ne masque jamais toute la grille repliée. Se ferme avec la Destinée. |
| `DestinyBoard` (≥ 768 px) | Colonne sticky, défilement interne. Remplace le contenu de la colonne de droite tant que la Destinée est active ; le contenu habituel revient à la sortie. |
| `DestinyList` | Modal (tiroir) sous 1024 px, menu ancré au-delà. Échap ou fond assombri ferment sans rien changer. |
| `RendezvousPicker` | Tiroir modal sous 1024 px, menu ancré au-delà (une ligne = un choix, sans bouton de confirmation). Toucher la ligne arme le composer (atelier) ou ouvre l'atelier du rendez-vous, composer armé (vitrine). Sauté s'il n'y a qu'un rendez-vous. |
| `SideDock` (≥ 768 px) | Toute colonne de droite du calendrier (colonne MJ, joueur, groupe, plateau de la destinée) se range en dock par la flèche › de son en-tête et se rouvre par la flèche ‹ du dock. Le dock montre en vertical ce qu'il contient (« Éphémérides · 18 », « ✦ Chapitre 4 »). Rangée, la colonne libère toute la largeur pour la grille. État retenu dans ce navigateur, un seul pour toutes les colonnes. |
| `AutomateList` | Sous 768 px : en-tête bouton (`aria-expanded`) qui replie la liste. Cartes sélectionnables une à la fois. |
| Barre de sélection en composition | La barre des dispos (36.3), en version composition : « N jours sélectionnés », portée (Journée en JDR seulement, et seulement pour une durée d'un créneau · Matin · Après-m. · Soir), « Ajouter au vote », « Retirer », « Annuler ». Chaque jour × moment choisi est un **départ** ; l'aperçu montre la plage entière. |
| `app-compose-bar` | ⚠️ Cible, compte cumulé, raison de blocage (moins de 2 créneaux), **Durée** (compteur ±, plage ou jours en clair) et **Fin du vote** (date + crayon, défaut expliqué), Valider, Annuler. |
| `DurationStepper` | Compteur « − n créneaux + » ; boutons nommés « Raccourcir » / « Allonger » ; − grisé à 1, + grisé au plafond ; même composant dans le composer, la fenêtre d'un événement et l'éditeur de séance. |
| `SpanBands` | Rendu d'une plage en bandes reliées (§2.9) ; chaque bande couverte porte un nom accessible complet (§7). |

## 5. State Patterns

### 5.1 La Destinée

| État | Puce ✦ | Plateau | Grille |
| --- | --- | --- | --- |
| Aucun sondage ouvert | absente | — | normale |
| Sondages ouverts, aucun actif | « ✦ Destinée » | — | normale |
| Actif, avant la fin du vote | « ✦ Destinée · {nom} », chevrons si ≥ 2 créneaux | liste + comptes en direct | jours sans créneau estompés ; votants répondent sur la grille |
| Actif, fin du vote passée | idem | « Vote terminé · plus de vote possible » ; organisateur : Fixer la date…, Modifier les dates, Prolonger (soirée) ; en JDR, la phrase « Pour rouvrir le vote… » | idem, sélecteur de réponse en lecture seule |
| Le sondage devient clos (date fixée, annulé, supprimé) | revient à l'état précédent | se ferme | atelier : message avec la raison (« Ce vote est clos… ») ; vitrine : « Ce vote n'est plus ouvert. » (§3.1) ; la date fixée apparaît |
| Le créneau courant disparaît (dates modifiées) | inchangée | se replace sur le créneau d'entrée | — |
| Composer armé | inchangée | suspendu (masqué) | estompe de la Destinée retirée ; rétablie à la validation ou à l'annulation |

### 5.2 Bouton « Proposer des dates »

| Situation | Bouton |
| --- | --- |
| Au moins un rendez-vous à dater (dans le contexte) | « Proposer des dates » |
| Destinée active dont on est organisateur | « Modifier les dates » (vitrine : ouvre l'atelier) |
| Les deux | « Modifier les dates » ; proposer pour un autre rendez-vous passe par le lien du plateau (§2.5) |
| Rien à dater, rien à modifier | absent |

### 5.3 Fenêtre de l'automate

Au repos · sélectionnée (contour, actions, autres jours estompés) · dans le composer (sortie de la liste, liseré tireté sur la grille) · masquée (cachée ; visible estompée via « Afficher les N masquées »). Annuler le composer rend les fenêtres à la liste. Quand une fenêtre est sélectionnée, la grille se place sur sa période. Une fenêtre déjà proposée dans un vote ouvert de la partie n'est pas listée ; retirée de ce vote, elle revient si elle est toujours libre.

### 5.4 États vides et erreurs

- Lien direct vers un sondage clos ou inexistant : calendrier normal + message écrit, une fois ; le paramètre est retiré de l'adresse.
- Lien qui arme le composer pour un rendez-vous qui n'est plus à dater ni modifiable : calendrier normal + message écrit, sans rien dire du rendez-vous.
- Lien vers une partie sans accès : refus habituel, sans rien dire du sondage.
- Liste de l'automate vide : en-tête « Éphémérides · 0 », déplié, message existant.
- Refus du serveur à la validation : erreur existante `calendar-error--compose`, composer conservé.

### 5.5 En direct

La liste des destinées, le choix du rendez-vous, la liste de l'automate, le bouton « Proposer des dates », les comptes du plateau et les plages suivent en direct les changements des autres. Un rendez-vous daté ailleurs pendant qu'on compose : à la validation, « Ce rendez-vous n'est plus à dater. », composer fermé.

## 6. Interaction Primitives

Les quatre principes du Palier 9 (§6 bis) tiennent : le rail suit, **la Destinée ne réassigne aucun geste**, **seule la composition réassigne le tap**.

- **Composition (⚠️ geste des dispos)** :
  - un tap court ajoute ou retire **une** bande (inchangé, 36.10) ; un appui maintenu (450 ms) ou un glissement sélectionne **plusieurs jours**, puis la barre de sélection fait choisir le moment et « Ajouter au vote ». Chaque sélection **s'ajoute** aux créneaux déjà désignés. Clavier inchangé (`1` `2` `3`, `Espace`, `Maj`+flèches pour étendre la plage, `Entrée`, `Échap`) ;
  - avec une durée de plus d'un créneau, le geste ne change pas : chaque créneau désigné est un **départ** et l'aperçu montre sa plage entière (§2.9). Toucher le départ d'une plage déjà désignée la retire ; toucher une autre bande, même couverte par une plage, y pose un nouveau départ (chevauchement permis).
- **Fenêtre de l'automate** : toucher une carte la sélectionne ; la retoucher, ou `Échap`, la désélectionne. Composer ouvert, toucher une carte l'entoure **sans estomper** les autres jours, et « Ajouter au vote » la verse directement dans le composer. Pendant une sélection, l'estompe de la fenêtre remplace celle de la Destinée ; la désélection la rétablit. Priorité unique, ratifiée en architecture : **composer > fenêtre sélectionnée > Destinée**.
- **Plateau** : toucher un créneau candidat le rend courant et place la grille dessus ; ‹ › font de même pas à pas. Toucher une bande de vote sur la grille ouvre le sélecteur de réponse (inchangé) et rend ce créneau courant.
- **Lien direct** : l'adresse porte l'identifiant du sondage (`?poll=`) ; `?pollList` ouvre la liste des destinées restreinte à la partie ; `?seanceId=` arme le composer pour un rendez-vous. À l'ouverture : vue Mois (Semaine pour un vote du mode soirée, groupe ou soirée isolée, y compris dans le calendrier personnel), même si l'Agenda est la vue par défaut sur mobile ; Destinée active ; tiroir replié.
- **Liens existants redirigés** (PRD FR-14) : « Voter dans le calendrier » (conjonction et e-mail de relance) et « vote en attente » (page d'une partie, joueur) ouvrent par le lien direct ; plusieurs sondages ouverts → liste des destinées de la partie. « Lancer le vote » (fiche de scénario, MJ) arme le composer pour cette séance, choix du rendez-vous sauté.
- **Fixer la date** depuis le plateau : `SealConfirmDialog` en JDR, `DateFixDialog` en mode soirée ; la confirmation liste les créneaux candidats (plage comprise) avec leurs oui, le meilleur en tête et présélectionné ; sans aucun oui, rien n'est présélectionné et l'étiquette « meilleur » n'apparaît nulle part (après la fin du vote sans meilleur, la Destinée s'ouvre sur le premier créneau). « Prolonger le vote » : `ExtendVoteDialog`.

## 7. Accessibility Floor

- Les flèches › et ‹ du dock sont des boutons nommés (« Ranger la colonne », « Rouvrir la colonne ») avec `aria-expanded` ; ranger la colonne rend le focus à la flèche ‹.
- Le tiroir replié est une région nommée (« Destinée : {nom} ») ; son bouton de dépliage porte `aria-expanded`. Le déplier ne piège pas le focus.
- La liste des destinées et le choix du rendez-vous piègent le focus, se ferment par `Échap` et rendent le focus à leur bouton.
- Changer de créneau courant annonce, en `aria-live` poli : « Créneau 2 sur 5, samedi 18 octobre, soir, 4 oui » (pour une plage : « Créneau 2 sur 5, du vendredi 6 soir au dimanche 8 après-midi, 4 oui »).
- L'estompe ne retire ni pointeur ni accessibilité ; un jour focalisé reste net (36.9).
- Cibles de 44 px par défaut ; aucune action accessible par le seul glissement du tiroir (le bouton existe).
- `prefers-reduced-motion` : le tiroir change de hauteur sans animation.
- Le compteur de durée annonce, en `aria-live` poli, la nouvelle valeur et sa plage (« 6 créneaux, du vendredi soir au dimanche après-midi »). « Fin du vote » est un champ nommé dont la ligne d'explication sert de description accessible.
- Chaque bande d'une plage porte un nom complet (« Week-end jeux, du vendredi 6 soir au dimanche 8 après-midi ») : les flèches de continuité ne portent jamais seules l'information.

## 8. Key Flows

Mêmes protagonistes que le PRD (UJ-1 à UJ-6).

1. **UJ-1 — Incon tire un sondage des éphémérides.** Calendrier de partie, colonne MJ : il déplie « Éphémérides · 18 », touche une carte (la bande s'entoure, le reste s'estompe), « Ajouter au vote » ; le composer s'arme « Pour : Chapitre 5 — La foire aux dragons » (seul rendez-vous à dater : choix sauté). Il ajoute deux autres cartes, en masque une, puis glisse sur trois vendredis et choisit « Soir » dans la barre : ils s'ajoutent. **Climax** : Valider ouvre le vote, la Destinée s'active dessus.
2. **UJ-2 — Léa propose des dates depuis son calendrier personnel.** « Proposer des dates » → choix du rendez-vous : sa soirée sans date. ⚠️ Le calendrier de sa soirée s'ouvre, composer armé ; elle glisse sur cinq jours, choisit « Soir », puis touche un samedi et choisit « Après-m. ». « Fin du vote » propose une date qui lui va. **Climax** : la barre affiche 6 créneaux, Valider est actif ; elle valide, la Destinée s'ouvre sur son vote.
3. **UJ-3 — Marc vote depuis le lien.** « Voter dans le calendrier » → calendrier du groupe en Semaine, Destinée active, tiroir replié sur le premier créneau. Il répond sur la grille, ‹ › pour la date suivante. **Climax** : « 6 / 6 », il a tout répondu sans chercher.
4. **UJ-4 — Incon conclut un vote échu.** Calendrier personnel, puce ✦ → la liste, toutes parties : « Chapitre 4 — Vote terminé — Organisateur ». La Destinée s'ouvre sur le meilleur créneau. **Climax** : « Fixer la date… » dans le tiroir, confirmation, la date apparaît sur la grille, le mode se ferme sur « Ce vote n'est plus ouvert. » (vitrine).
5. **UJ-5 — Incon organise un week-end jeux.** Il crée « Week-end jeux » sans date, Durée « 6 créneaux · soit 2 jours ». Proposer des dates : le composer reprend la durée de 6 créneaux ; il touche un vendredi soir, l'aperçu allume vendredi soir → dimanche après-midi ; puis deux autres vendredis. **Climax** : trois week-ends en bandes reliées, « Fin du vote : mar. 3 nov. » ; il valide.
6. **UJ-6 — Incon prépare une journée JDR.** Calendrier de partie, composer pour la séance à dater ; il touche + sur Durée : « 2 créneaux · sam. après-midi → sam. soir ». La liste des éphémérides se recalcule : seules restent les fenêtres libres l'après-midi et le soir. **Climax** : il ajoute trois fenêtres, chacune montrée en plage, et valide.

## 9. Responsive & Platform

| Largeur | Plateau | Liste des destinées / choix du rendez-vous | Vue par défaut |
| --- | --- | --- | --- |
| < 768 px | tiroir du bas | tiroir modal | Agenda (sauf lien direct ou Destinée active : Mois, Semaine pour un vote du mode soirée) |
| 768–1023 px | colonne de droite | tiroir modal | Mois |
| ≥ 1024 px | colonne de droite | menu ancré | Mois |

## 10. ⚠️ Écarts aux écrans validés

| # | Écran validé | Ce qui change | Pourquoi |
| --- | --- | --- | --- |
| 1 | Colonne MJ (P9, 36.x) | colonne rangeable en dock à droite (›/‹) sur ordinateur, liste repliable sur mobile ; cartes actionnables, masquage ; Du / Au / Scruter sous l'en-tête | FR-1 à FR-4 ; le calendrier récupère toute la place |
| 2 | Libellés `section.slots` | Grimoire « Éphémérides », Atelier « Créneaux calculés par l'automate » | FR-16 ; « validés » laissait croire à des dates confirmées |
| 3 | Ligne de contrôles | « Proposer des dates » / « Modifier les dates » remplace « Inscrire des dates » et « Composer les créneaux : {titre} » | FR-5, FR-10 ; un seul point d'entrée, trouvable |
| 4 | `ComposeConfirmDialog` (36.10) | le choix de la séance passe **avant** le composer ; la fenêtre ne garde que l'avertissement de perte | FR-2, FR-5 |
| 5 | Composer (36.10) | le geste de sélection des dispos (36.3) s'ajoute au tap ; sélections cumulatives | FR-6, amendé |
| 6 | Mode Destinée (36.9) | la puce ouvre une liste ; les chevrons parcourent les créneaux du vote, plus les votes ; plateau en colonne ou tiroir | FR-7 à FR-9 |
| 7 | Calendrier personnel | colonne de droite pendant la Destinée (≥ 768 px) ; section « Seulement » dans « Affichage » | FR-8, FR-15 |
| 8 | Calendrier du groupe (40.5b) | ouverture en Destinée par lien ; « Composer les créneaux : {titre} » remplacé (#3) | FR-13, FR-14 |
| 9 | Fenêtre d'une conjonction, e-mail de relance, page d'une partie, fiche de scénario | destination des liens vers le calendrier, pas leur forme | FR-14 |
| 10 | Formulaire de création (P10 §2.3, `mode-switch` §7.2) | bascule sur deux lignes avec « Jeu de rôle » / « Soirée entre amis » ; ligne d'explication sous chaque nature | FR-17 ; les noms de thème seuls restaient obscurs |
| 11 | Calendrier personnel | plus de composer : « Proposer / Modifier les dates » ouvre l'atelier ; plateau sans noms ; message de fin neutre ; votes de groupe et de soirée sur la grille | architecture (atelier / vitrine), FR-5, FR-7, FR-8, FR-12 |
| 12 | Panneau de création d'un vote (Story 8.7) | retiré : « Lancer le vote » arme le composer | FR-14 |
| 13 | `app-compose-bar` (36.10) | lignes Durée et Fin du vote | FR-18, FR-19 |
| 14 | Vues Mois, Semaine, Agenda, rail, plateau, fiche, fenêtre d'événement, liste des parties, e-mails | une plage s'affiche sur tous ses jours (bandes reliées) | FR-20, FR-21 |
| 15 | Fenêtre de création / modification d'un événement (P10), éditeur de séance (JDR) | compteur Durée | FR-23 |
| 16 | Liste de l'automate (MJ) | recalculée à la durée du composer ; cartes en plage | FR-22 |
| 17 | Colonne de droite des calendriers personnel, joueur et du groupe, plateau compris | rangeable en dock (›/‹), comme la colonne MJ (#1) | FR-4 |

## 11. Open Items

1. **« Éphémérides »** est provisoire : à confronter aux retours de la bande ; repli « Augures du calendrier ».
2. **Libellés du §3** (y compris durée et échéance) : tous provisoires, à relire sur l'application dans les trois thèmes.
3. **Surfaces sans planche** (choix de l'utilisateur) : choix du rendez-vous, barre de sélection en composition sur mobile, plateau en colonne sur ordinateur, filtre « Seulement », formulaire de création expliqué ; et, depuis l'architecture, rail « (suite) », Agenda en une ligne, e-mails en plage, compteur dans la fenêtre d'un événement. Construites à partir des tableaux de ce document (§2.8 à §2.10 pour les quatre dernières).
4. **Forêt : « Sentier »** désigne le mode JDR, la nature « Sentier court » et le bouton « Ouvrir un sentier ». Lisible avec la ligne « Jeu de rôle » ; à renommer plus tard si ça gêne encore à l'usage.
5. **Durées différentes dans un même vote** : hors de ce palier, notées au backlog (« Idées / plus tard »).
