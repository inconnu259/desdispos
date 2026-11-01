---
title: "jdr-master Experience — Delta Paliers 10.6 à 10.8"
status: final
created: 2026-10-31
updated: 2026-11-01
design: DESIGN.md
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/EXPERIENCE.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/prd.md
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-31-p10-6-8/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-31/.memlog.md
---

# jdr-master — Experience — Delta Paliers 10.6 à 10.8

**Ce document est un delta.** Il décrit comment fonctionnent la déclaration des dispos, le jeu d'icônes et les pages de JDR après les Paliers 10.6 à 10.8 (PRD `prd-jdr-master-2026-10-31-p10-6-8`, FR-1 à FR-14). Tout ce qu'il ne mentionne pas reste tel que le fixent les deltas des Paliers 10.5, 10.4 et 10 et le contrat du Palier 9. Les écarts aux écrans validés sont signalés ⚠️ et listés en §9.

Les §3 à §5 (10.6 et 10.8) ont été rédigés en voie rapide puis validés sur planche par l'utilisateur le 2026-10-31 ; le §6 (10.7) résulte de cinq planches d'icônes choisies une à une.

Planche des écrans clés : [`mockups/key-planche-10-6-10-8.html`](mockups/key-planche-10-6-10-8.html) (cadres A à F). Planches d'icônes et jeu retenu : voir `DESIGN.md`, « Icônes ». En cas d'écart, les spines (ce document et `DESIGN.md`) l'emportent sur toute planche.

## 1. Foundation

- **Supports** : web responsive, téléphone et ordinateur à égalité. On déclare ses dispos aussi souvent sur l'un que sur l'autre ; la fiche de scénario se lit surtout sur téléphone, le MJ la prépare surtout sur ordinateur.
- **Bibliothèque d'interface** : Angular Material 22. Surfaces existantes réutilisées : calendrier (`calendar-view`, vues Mois et Semaine, barre de sélection), tableau de bord, page Compte, page d'une partie (onglets, bannière), fiche de scénario (`scenario-read-dialog`, `scenario-editor`, `seance-list`).
- **Identité visuelle** : `DESIGN.md` de ce dossier.
- **Composants repris du mode soirée** : pastille « Ma situation » et encadré de situation (Palier 10), résumé du vote de la fenêtre d'événement (Palier 10, `event-dialog`), confirmation « Fixer la date… » (Palier 10.4, FR-11).
- **Cadre et ton** : un projet perso, pour une bande d'amis. D'où le ton familier des textes (« apportez vos dés et de quoi grignoter ») et un rappel des dispos régulier, voulu par le porteur du projet pour que chacun pense à mettre ses dispos à jour (FR-4), mais qu'on peut faire taire (FR-5).
- **Sobriété** : rendre la déclaration visible sans encombrer la lecture du calendrier (SM-C1, motif de la décision AC15) ; le bandeau d'aide n'apparaît que lorsque le mode déclaration est allumé.
- **Libellés dans les trois thèmes** : chaque nouveau texte est donné pour Grimoire (vouvoiement), Forêt (tutoiement) et Atelier (vouvoiement) ; une ligne « identique » veut dire que le même texte vaut dans les trois. Certains libellés sont volontairement identiques partout, notamment « Déclarer mes dispos » et le titre « Dispos à déclarer » (les dispos ne sont pas thématisées), ainsi que les pastilles « Ma situation », à la première personne comme sur la carte d'événement du Palier 10.

## 2. Information Architecture

Aucune nouvelle page. Les changements de surface :

| Surface | Ce qui change | FR |
|---|---|---|
| Calendriers où la déclaration existe aujourd'hui (Mois, Semaine) : calendrier personnel, calendrier MJ d'une partie de JDR, calendrier d'un groupe | bouton « Déclarer mes dispos » dans la ligne de contrôles ; bandeau du mode déclaration | FR-1 à FR-3 |
| Tableau de bord | bandeau « Dispos à déclarer », au-dessus des listes | FR-4, FR-5 |
| Page Compte | case « Me rappeler de déclarer mes dispos » | FR-5 |
| Page d'une partie de JDR | ordre et onglet par défaut | FR-13 |
| Page d'une partie, JDR et soirée | bannière illustrée en tête de l'onglet Détails, avec « Changer » / « Retirer » | FR-14 |
| Cartes de chapitres et de séances | pastille « Ma situation » ; badge d'état sans situation personnelle | FR-10 |
| Fiche de scénario | séances remontées en tête (joueur) ; encadré de situation par séance ; vote en résumé | FR-11, FR-12 |
| Toute l'application | icônes (§6) | FR-6 à FR-9 |

## 3. Palier 10.6 — Déclarer ses dispos

### 3.1 Le bouton « Déclarer mes dispos »

- **Où** : dans chaque calendrier où l'on peut aujourd'hui déclarer ses dispos, et là seulement : le calendrier personnel, le calendrier MJ d'une partie de JDR, le calendrier d'un groupe. Aucun nouvel endroit ; un calendrier sans déclaration n'a pas le bouton.
- **Place** : dans la ligne `.calendar-controls`, juste après la puce Destinée, avant « Proposer des dates » quand celui-ci existe. Même ligne sur téléphone (elle passe à la ligne si besoin, comme aujourd'hui).
- **Forme** : bouton à contour, même gabarit que « Proposer des dates » (`{components.propose-dates-action}`), avec l'icône de déclaration (§6). Libellé « Déclarer mes dispos », volontairement identique dans les trois thèmes puisque les dispos ne sont pas thématisées (écart assumé au NFR « Trois thèmes » du PRD).
- **Mode allumé** : le bouton devient plein (`aria-pressed="true"`) et son libellé passe à « Terminer ».
- **Vue Agenda** : le bouton reste visible ; le toucher bascule en vue Mois puis allume le mode.

### 3.2 Le bandeau du mode déclaration

Sous la ligne de contrôles, au-dessus de la grille, tant que le mode est allumé :

| Thème | Texte | Action |
|---|---|---|
| Grimoire | « Touchez les créneaux où vous êtes disponible ou non, puis validez. » | « Terminer » |
| Forêt | « Touche les créneaux où tu es disponible ou non, puis valide. » | « Terminer » |
| Atelier | « Sélectionnez les créneaux où vous êtes disponible ou non, puis validez. » | « Terminer » |

La grille porte un liseré `{colors.accent-1}` qui dit « on écrit ici ».

### 3.3 Sélectionner et valider

- Un tap sur une bande (matin, après-midi, soir) l'ajoute ou la retire ; un tap sur le numéro du jour prend la journée. Le glissement au doigt sélectionne directement, sans appui long. Un double-clic vaut deux taps.
- En mode déclaration, le tap ne sert plus à lire : le rail reste sur le jour qu'il affiche ; le repère de date courante suit le dernier créneau touché.
- La barre de sélection existante (portée · Disponible / Indisponible · Autre… · Annuler) apparaît dès le premier créneau. **En mode déclaration, elle colle au bas de l'écran** sur téléphone, pour rester visible quand la grille dépasse l'écran ; sur ordinateur, elle colle au bas de la zone du calendrier. ⚠️ Aujourd'hui elle est dans le flux, sous la grille.
- « Autre… » est le nom générique ; chaque thème garde son libellé actuel : « Autrement… » (Grimoire), « Autre chemin… » (Forêt), « Autre réglage… » (Atelier). Il ouvre le panneau des contraintes comme aujourd'hui.
- Valider (Disponible, Indisponible, `Entrée`) enregistre, vide la sélection et laisse le mode allumé ; une confirmation discrète (snackbar) le dit :

| Thème | Disponible | Indisponible |
|---|---|---|
| Grimoire | « 4 créneaux déclarés disponibles » · « 1 créneau déclaré disponible » | « 4 créneaux déclarés indisponibles » · « 1 créneau déclaré indisponible » |
| Forêt | « 4 créneaux marqués disponibles » · « 1 créneau marqué disponible » | « 4 créneaux marqués indisponibles » · « 1 créneau marqué indisponible » |
| Atelier | « 4 créneaux consignés disponibles » · « 1 créneau consigné disponible » | « 4 créneaux consignés indisponibles » · « 1 créneau consigné indisponible » |

- « Annuler » vide la sélection sans éteindre le mode. Désélectionner le dernier créneau masque la barre ; le mode reste allumé.
- **Clavier** : les raccourcis existants restent (`Espace`, `1/2/3`, `Maj`+flèches, `Entrée`). `Échap` vide la sélection ; s'il n'y a rien à vider, il éteint le mode, comme « Terminer ».
- « Terminer » (bouton ou bandeau) éteint le mode. Si une sélection n'est pas validée, elle est abandonnée sans confirmation : rien n'a encore été enregistré.
- Quitter la page éteint le mode ; une sélection non validée est abandonnée sans confirmation.

### 3.4 Cohabitation avec le Composer et la Destinée

- Mode déclaration allumé : toucher la puce Destinée ou « Proposer des dates » éteint le mode (la sélection en cours est abandonnée) et ouvre l'outil touché, et réciproquement.
- Mode lecture : l'appui long et le glissement ouvrent la sélection comme aujourd'hui (Story 36.3) ; rien ne change.
- Le geste du Composer d'un sondage (Story 45.3), qui réutilise la même sélection, n'est pas modifié.

### 3.5 Le rappel sur le tableau de bord

- **Qui le voit** : tout membre d'au moins une partie active, de JDR ou de soirée. Sans partie active, pas de bandeau.
- **Forme** : un bandeau en tête du tableau de bord, au-dessus des listes de parties, et non une pastille sur chaque carte (un seul rappel, FR-4 ; choix validé sur la planche A, amendement au PRD listé en §9). Il reprend le patron du bandeau fermable déjà employé par la Destinée (`destinyNotice`). Teinte `{colors.status-todo}`. Si le bandeau de la Destinée est présent aussi, le rappel des dispos vient dessous.
- **Textes** : un titre en gras « Dispos à déclarer », identique dans les trois thèmes (§1), puis la phrase de thème :

| Thème | Texte |
|---|---|
| Grimoire | « Rien n'est inscrit à votre almanach pour les quatre semaines à venir. » |
| Forêt | « Rien n'est noté dans ton calendrier lunaire pour les quatre semaines à venir. » |
| Atelier | « Aucune disponibilité au registre horaire pour les quatre semaines à venir. » |

- **Actions** : « Déclarer mes dispos » (bouton plein) ouvre le calendrier personnel en mode déclaration ; « Ne plus me le rappeler » (bouton texte). Les deux sont identiques dans les trois thèmes.
- « Ne plus me le rappeler » fait disparaître le bandeau et affiche une snackbar, avec « Annuler » :

| Thème | Snackbar |
|---|---|
| Grimoire | « Rappel désactivé. Vous pourrez le réactiver depuis Mon grimoire. » |
| Forêt | « Rappel désactivé. Tu pourras le réactiver depuis Mon carnet. » |
| Atelier | « Rappel désactivé. Vous pourrez le réactiver depuis Mon établi. » |

- Le bandeau disparaît en direct dès qu'une déclaration couvre les quatre semaines (canal `user:{id}`).
- Il revient chaque fois que plus rien n'est déclaré sur les quatre semaines à venir : en direct si une suppression vide la période (même canal), au prochain affichage du tableau de bord quand les déclarations sortent de la fenêtre par le seul passage du temps. Une contrainte récurrente (« tous les mardis soir ») compte comme une déclaration pour les semaines qu'elle couvre.

### 3.6 La réactivation dans la page Compte

Une case « Me rappeler de déclarer mes dispos » (identique dans les trois thèmes), cochée par défaut, juste après le bloc « Ce que révèle mon calendrier ». Même patron que les cases de ce bloc. Sous-titre :

| Thème | Sous-titre |
|---|---|
| Grimoire | « Un rappel apparaît sur le tableau de bord quand rien n'est déclaré pour les quatre semaines à venir. » |
| Forêt | « Un rappel apparaît sur ton tableau de bord quand tu n'as rien noté pour les quatre semaines à venir. » |
| Atelier | « Un rappel apparaît sur le tableau de bord quand rien n'est consigné pour les quatre semaines à venir. » |

Cette case ne concerne que ce rappel : les autres signaux à traiter (« Répondez au vote », « Créer son héros »…) ne se font pas taire.

## 4. Palier 10.8 — Cartes et onglets d'une partie de JDR

### 4.1 Pastille « Ma situation »

- **Où** : sur chaque séance des cartes de chapitres (onglet Chapitres, MJ) et de la Chronologie (joueur), en bas de la séance, sur une ligne : « Ma situation » à gauche, la pastille à droite — comme sur la carte d'événement. Sur la carte d'un chapitre, la même ligne reprend la situation de sa prochaine séance.
- **Valeurs et tons** :

| Valeur | Qui | Ton |
|---|---|---|
| Je mène | MJ | `{colors.accent-1}`, contour |
| Vote à faire | joueur, vote ouvert sans réponse | `{colors.status-todo}` |
| J'ai voté | joueur, vote ouvert avec réponse | contour `{colors.status-live}` |
| Je participe | joueur inscrit ; séance sans inscriptions, datée et à venir : tout joueur actuel | `{colors.status-live}` |
| Pas inscrit·e | joueur non inscrit, inscriptions ouvertes ou fermées | pointillé `{colors.text-muted}` |
| J'y étais | séance passée : inscrit (séance à inscriptions) ou joueur actuel (séance sans inscriptions) | `{colors.status-done}` |

Séance **sans inscriptions** (à vote ou datée directement) : « Je participe » puis « J'y étais » valent pour les joueurs **actuels** de la partie, l'application ne gardant pas l'historique des membres (amendement d'architecture, §9).

- Les tons suivent la spec du Palier 10 ; le code actuel de la carte d'événement, où « Vote à faire » est en `status-live`, s'aligne au passage sur `status-todo` (amendement au PRD, §9).
- **Sans pastille** (la ligne « Ma situation » n'est pas affichée ; le badge d'état suffit) : séance passée sans participation du joueur ; séance à dater sans vote, côté joueur ; vote clôturé sans date, côté joueur qui n'avait pas répondu (s'il avait répondu, « J'ai voté » reste) ; carte d'un chapitre sans séance à venir. Le MJ garde « Je mène » dans tous les cas.
- **Libellés** : à la première personne, identiques dans les trois thèmes, comme sur la carte d'événement du Palier 10 (§1).
- **Temps réel** : la pastille suit le signal `changed` de la partie (`RealtimeService`) : un vote, une inscription ou une date fixée par quelqu'un d'autre la met à jour sans recharger la page.
- **Badge d'état** : il ne porte plus « Répondez au vote » ; il affiche l'état de la séance (« Vote ouvert »…). L'appel à l'action passe dans la pastille.

### 4.2 Onglets

| Rôle | Ordre | Par défaut |
|---|---|---|
| MJ, chronique | Chapitres · Chronologie · Détails · Missives · (Homme Dragon) | Chapitres |
| MJ, quête unique | Chapitre · Détails · Missives · (Homme Dragon) | Chapitre |
| Joueur, chronique | Chronologie · Détails · Folios | Chronologie, sauf personnage à créer → Folios |
| Joueur, quête unique | Détails · Folios | Détails, sauf personnage à créer → Folios |

Les noms d'onglets ci-dessus sont les libellés Grimoire. Noms génériques employés par le PRD : Fiches = Folios, Invitations = Missives, Scénario (quête unique) = Chapitre ; Chapitres, Chronologie et Détails gardent leur nom.

« + Inviter » ouvre toujours Invitations (Missives en Grimoire). Les autres accès internes qui visent un onglet précis (le signal « Créer son héros » vers Fiches, par exemple) l'ouvrent aussi après le réordonnancement : un onglet se désigne par son nom, jamais par sa position.

### 4.3 Couverture depuis l'onglet Détails (JDR et soirée)

- **Où** : la page d'une partie n'a pas de bannière illustrée dans son en-tête (c'est le bandeau texte commun à l'application). L'**onglet Détails s'ouvre sur la bannière illustrée** de la partie (la même que sur le tableau de bord), qui porte les pastilles (amendement d'architecture, §9).
- **Les deux modes** : vaut pour la page d'une partie de JDR comme pour celle d'une soirée.
- Pastilles « Changer » et « Retirer » en haut à droite de cette bannière, même aspect que dans le formulaire (Palier 10, couverture V1). Visibles seulement pour qui peut modifier la partie (MJ, hôte, admin).
- **Libellés** : ceux du formulaire, déjà thématisés (`partie.cover_change`, `partie.cover_remove`, `partie.cover_add`) : « Changer l'enluminure » / « Retirer l'enluminure » (Grimoire), « Changer l'image » / « Retirer l'image » (Forêt), « Changer la plaque » / « Retirer la plaque » (Atelier).
- « Changer » ouvre le même sélecteur d'image que le formulaire ; la couverture est enregistrée aussitôt, avec une snackbar sans « Annuler » : « Enluminure changée » (Grimoire), « Image changée » (Forêt), « Plaque changée » (Atelier).
- « Retirer » demande d'abord une confirmation (fenêtre de confirmation existante), puis retire ; snackbar sans « Annuler » : « Enluminure retirée » / « Image retirée » / « Plaque retirée ».
- Pas d'« Annuler » : le serveur supprime l'ancienne image dès le changement (amendement d'architecture, §9).
- **Sans couverture** (la bannière générée s'affiche) : « Retirer » est absente ; la pastille unique prend le libellé d'ajout du formulaire, « Enluminer ce grimoire » (Grimoire), « Donner un visage au sentier » (Forêt), « Ajouter une plaque d'identification » (Atelier), et ouvre le même sélecteur.

## 5. Palier 10.8 — Fiche de scénario

### 5.1 Ordre

- **Joueur** (`scenario-read-dialog`) : titre et badge → **séances** → description, durées → (passé) résumé, journal → annonces → participants. Les séances remontent en tête, alors qu'elles sont aujourd'hui en dernier ⚠️ (amendement au PRD, §9). La fiche de lecture n'affiche pas de documents joints (pas plus qu'aujourd'hui) : rien à placer.
- **MJ** (`scenario-editor`) : inchangé, les séances y sont déjà en tête après l'ajout de séance ; les documents joints restent à leur place actuelle.

### 5.2 Une séance

Dans l'ordre : titre de la séance → **encadré de situation** (quand une action est attendue) → date ou vote en résumé → infos pratiques → compte rendu.

- **Encadré de situation** : version compacte de l'encadré de la fenêtre d'événement (`{components.seance-situation}`), affichée seulement quand une action est attendue. Sinon, la séance affiche simplement sa ligne « Ma situation ». L'encadré associe un texte et une action ; les boutons reprennent les libellés de thème actuels de la séance (« Participer », « Me désinscrire », « Lancer le vote » sont les noms génériques) :

| Cas | Grimoire | Forêt | Atelier |
|---|---|---|---|
| Joueur, vote à faire | « Le vote est ouvert jusqu'à jeudi. » + « Voter dans le calendrier » | identique | identique |
| Joueur, inscriptions ouvertes, pas inscrit·e | « Pas encore inscrit·e. » + « Inscrire mon nom » | « Pas encore inscrit·e. » + « Rejoindre la clairière » | « Pas encore inscrit·e. » + « M'inscrire » |
| Joueur, inscrit·e (action en bouton texte) | « Vous participez. » + « Retirer mon nom » | « Tu participes. » + « Me retirer de la clairière » | « Vous participez. » + « Me désinscrire » |
| MJ, séance sans date ni vote | « Pas encore de date. » + « Convoquer le conseil » | « Pas encore de date. » + « Réunir le cercle » | « Pas encore de date. » + « Ouvrir le scrutin » |
| MJ, vote ouvert | « Le vote est ouvert jusqu'à jeudi. » + « Fixer la date… » | identique | identique |
| MJ, vote clôturé sans date | « Conseil clos sans date scellée. » + « Effacer la date scellée » | « Cercle clos sans date choisie. » + « Défaire la date » | « Scrutin clôturé sans date retenue. » + « Purger la date » |

- « Lancer le vote » ouvre le Composer, comme aujourd'hui.
- « Réinitialiser la date » (nom générique de l'action de la dernière ligne, qui existe déjà sur la séance) ramène la séance à « Pas encore de date ».

### 5.3 Vote en résumé

Le résumé reprend celui de la fenêtre d'événement (Palier 10), présenté en lignes :

| Joueur | MJ |
|---|---|
| « Vos réponses : x créneaux sur N » | « Réponses : x sur N joueurs » |
| « Meilleur créneau pour l'instant : samedi soir — 3 oui » ou « Pas encore de meilleur créneau » | idem |
| « 2 personnes n'ont pas encore répondu » | « N'ont pas encore répondu : Lou, Sam » |
| « Échéance : jeudi 5 novembre » | idem |
| *(l'action « Voter dans le calendrier » est dans l'encadré de situation)* | « Clôturer le vote » (contour), « Voir dans le calendrier → » (texte) ; « Fixer la date… » est dans l'encadré |

L'action principale n'apparaît qu'une fois, dans l'encadré de situation (§5.2) ; le résumé ne porte que les actions secondaires. Le badge d'état « Vote ouvert » garde son ton actuel.

- **Thèmes** : les lignes reprennent les textes du résumé de soirée, identiques dans les trois thèmes, sauf « Vos réponses : x créneaux sur N », qui devient en Forêt « Tes réponses : x créneaux sur N ». « Clôturer le vote » garde ses libellés de thème actuels : « Clore le conseil » (Grimoire), « Clore le cercle » (Forêt), « Clôturer le scrutin » (Atelier).
- **Temps réel** : le résumé suit le signal `changed` de la partie (`RealtimeService`), comme la pastille (§4.1).
- **Vote clôturé sans date** : le résumé laisse place au message actuel (« Conseil clos sans date scellée. » / « Cercle clos sans date choisie. » / « Scrutin clôturé sans date retenue. »), repris dans l'encadré du MJ (§5.2).
- Rendez-vous de plusieurs créneaux : le meilleur créneau s'affiche avec sa plage (« du vendredi soir au dimanche après-midi »).
- « Fixer la date… » ouvre la confirmation de la Destinée (radios, meilleur créneau présélectionné) ; effet identique à « Sceller ce créneau ».
- « Clôturer le vote » demande une confirmation (fenêtre de confirmation existante ; « Renoncer » laisse le vote ouvert). Il n'en avait pas : ajout décidé le 2026-11-01, à l'écriture de la story 54.3, le bouton étant désormais voisin de « Fixer la date… ».
- Date fixée : le résumé laisse place à la date, en grand.
- ⚠️ Disparaissent de la fiche : `app-poll-response` (vote créneau par créneau du joueur) et la liste « Choisir cette date » / « Sceller ce créneau » de `app-poll-status`.

## 6. Palier 10.7 — Icônes

Le dessin est fixé dans `DESIGN.md` (§Components, « Icônes ») ; cette section fixe le comportement.

- **Changement de thème** : les icônes de sens changent en même temps que les libellés, sans rechargement. Les icônes utilitaires ne changent pas.
- **Un sens, une icône** : dans un thème, deux concepts ne partagent jamais un dessin. Les surcharges d'aujourd'hui sont levées : terminé / signal (`flag`), compte / joueur (`person`), MJ / admin (`shield`), suivant / ouvrir (`chevron_right`), accepter / thème actif (`check`).
- **États par la forme** : favori posé ou non, lien actif ou révoqué, cadenas ouvert ou fermé, œil ouvert ou barré, compteurs de dispos (oui · partiel · non) se distinguent par le dessin, jamais par la seule couleur.
- **Note partagée ou non** : c'est la paire `cadenas-ouvert` / `cadenas-ferme` qui la porte (note partagée / privée, à la place de 🔓 🔒). Verrouiller une note et la partager relèvent d'un seul et même sens : qui peut la voir ; le cadenas ne sert ailleurs qu'au bouton Visibilité de la partie (aujourd'hui `lock`), qui dit la même chose. `oeil` / `oeil-barre` restent à l'œil du mot de passe.
- **Pas d'icône de repli** : un concept ou un état sans icône s'affiche sans icône (texte seul). L'actuel repli sur `flag` disparaît, sans être remplacé par `information` ni par une autre icône.
- **Fond clair** : les trois thèmes sont sombres (`color-scheme: dark`) ; il n'y a pas de fond clair de thème à vérifier. Les icônes sont lues sur leurs surfaces sombres, de 16 à 24 px et dès 14 px en badge.
- **Nom accessible** : une icône seule (bouton sans texte, badge sur un avatar) porte un `aria-label` tiré du libellé de thème ; une icône accompagnée de texte est `aria-hidden`.
- **Plus d'emoji ni de caractère-icône** : ⚔ 🌿 ⚙ des titres de membres, ♥ de l'envie, ✦ de la Destinée, ✎ ✕ ✓ ▾ ▴ ▸ ⌄ ⌃, ✅ ⚠️ ❌ des compteurs, 🔒 🔓 des notes, ❮ ❯ de la pagination, ‹ › de la navigation du mois : tous remplacés (table de correspondance en `DESIGN.md`).
- **Typographie, pas icône** : « → » et « + » écrits dans un libellé de texte (« Voir dans le calendrier → », « + Inviter », « + Ajouter une séance », « + Lancer le vote ») font partie du texte, comme une ponctuation ; ce ne sont pas des icônes et ils restent.
- **Libellés de thème inchangés** : seuls les titres de la liste des membres perdent leur emoji (« Compagnons », « Habitants », « Équipage »).
- **Hors périmètre** : logo, bande de marque, bannière générée, badges de système et icône de création restent tels quels.

## 7. Key Flows

- **Nina déclare ses dispos (UJ-1).**
  1. Tableau de bord : le bandeau « Dispos à déclarer — Rien n'est inscrit à votre almanach… » est en tête.
  2. Elle touche « Déclarer mes dispos » : le calendrier personnel s'ouvre en Mois, mode allumé, bandeau d'aide au-dessus de la grille.
  3. Elle touche trois soirées et le numéro du samedi (la journée entière compte pour un seul créneau) ; la barre de sélection colle au bas de l'écran.
  4. **Elle touche « Disponible » : « 4 créneaux déclarés disponibles ».** Le mode reste allumé.
  5. Elle ajoute deux soirées « Indisponible », puis « Terminer ». De retour au tableau de bord, le bandeau a disparu.
- **Hugo vote (UJ-3).**
  1. Il ouvre la partie : elle s'ouvre sur la Chronologie.
  2. La prochaine séance porte « Vote à faire ».
  3. Il ouvre la fiche : les séances sont en tête ; l'encadré dit « Le vote est ouvert jusqu'à jeudi. » ; le résumé montre « Meilleur créneau pour l'instant : samedi 7 novembre, soir — 3 oui ».
  4. **« Voter dans le calendrier » ouvre la Destinée sur ce sondage ; il répond.**
  5. De retour, la pastille dit « J'ai voté ».
- **Marc fixe la date (UJ-3, MJ).**
  1. La partie s'ouvre sur les Chapitres ; la séance porte « Je mène ».
  2. Dans la fiche, le résumé dit « N'ont pas encore répondu : Lou » et « Meilleur créneau pour l'instant : samedi 7 novembre, soir — 3 oui ».
  3. **« Fixer la date… », samedi soir présélectionné, il confirme.** La séance affiche sa date.

## 8. Accessibility Floor (delta)

- Le bouton du mode déclaration annonce son état (`aria-pressed`) ; le bandeau est une région `status` lue à l'allumage.
- Les pastilles « Ma situation » portent leur texte : la couleur n'est jamais seule.
- Le bandeau du tableau de bord et ses deux actions sont atteignables au clavier ; « Ne plus me le rappeler » a un nom explicite.

## 9. Écarts aux écrans validés ⚠️

- Calendrier : nouveau bouton dans la ligne de contrôles ; bandeau du mode ; barre de sélection collante en mode déclaration (Épics 30 et 36, Story 36.3).
- Tableau de bord : nouveau bandeau de rappel en tête.
- Page Compte : nouvelle case.
- Page d'une partie de JDR : ordre et onglet par défaut ; bannière illustrée avec ses pastilles en tête de l'onglet Détails.
- Page d'une soirée : bannière illustrée avec ses pastilles en tête de l'onglet Détails.
- Cartes de chapitres et de séances : pastille « Ma situation » ; badge d'état sans « Répondez au vote ».
- Carte d'événement (soirée) : « Vote à faire » passe en `status-todo`, conformément à la spec du Palier 10.
- Fiche de scénario : séances en tête côté joueur ; encadré de situation ; vote en résumé (amende le PRD du 10.4, FR-11 et §4.7).
- Icônes : l'écu Admin des avatars (Palier 10) laisse place à l'icône admin de chaque thème.

**Amendements au PRD, validés par l'utilisateur le 2026-10-31 ⚠️**
- FR-4 : le rappel est un bandeau unique en tête du tableau de bord, titré « Dispos à déclarer », et non une pastille (signal à traiter) sur chaque carte (§3.5, planche A).
- NFR « Mode soirée non régressé » : sur la carte d'événement de soirée, « Vote à faire » passe en `status-todo`, alignement sur la spec du Palier 10 (§4.1).
- FR-11 : dans la fiche de scénario du joueur, les séances remontent au-dessus de la description ; le PRD ne prévoyait de changement qu'à l'intérieur de chaque séance (§5.1).
- FR-8 : l'écu Admin n'est pas repris ; il est remplacé par l'icône admin de chaque thème (`role-admin`), y compris en badge de 14 px sur l'avatar (`DESIGN.md`, « Icônes »).

**Amendements de l'architecture, validés par l'utilisateur le 2026-11-01 ⚠️** (`architecture-jdr-master-2026-11-01-p10-6-8`, AD-6 et AD-8)
- §4.3 : les pastilles de couverture se placent sur une bannière illustrée en tête de l'onglet Détails, la page d'une partie n'ayant pas de bannière dans son en-tête.
- §4.3 : pas d'« Annuler » après un changement de couverture ; « Retirer » demande une confirmation.
- §4.1 : « Je participe » et « J'y étais » d'une séance sans inscriptions valent pour les joueurs actuels de la partie.
- §4.1, carte d'événement (soirée) : avec la pastille unique, « J'y étais » passe en `status-done` et « Place réservée » en `status-todo`, comme le voulait la spec du Palier 10 (alignement complet décidé le 2026-11-01, à l'écriture de la story 53.2).

**Hors UX, à reprendre en architecture / stories**
- Retrait de la police Material chargée depuis Google Fonts, une fois toutes les icônes remplacées (NFR du 10.7).
- Vérifier que le formulaire d'édition d'une partie de JDR propose bien « Changer » et « Retirer » (Story 38.3, FR-14).
