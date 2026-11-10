---
title: "Paliers 10.6 à 10.8 — Finitions UX avant la mise en production (dispos, icônes, acquis soirée côté JDR)"
status: final
created: 2026-10-31
updated: 2026-11-01
scope: personal / scope-1
---

# PRD : Paliers 10.6 à 10.8 — Finitions UX avant la mise en production

## 0. Document Purpose

Ce PRD cadre ensemble trois petits paliers de jdr-master, tous placés avant la mise en production (Palier 11) : **10.6** rendre la déclaration des dispos découvrable, **10.7** doter l'application d'un jeu d'icônes propre, décliné par thème, **10.8** faire profiter le JDR des acquis d'interface des paliers soirée (10, 10.4, 10.5). Chaque palier a sa section (§4.1 à §4.3) et les FR sont numérotées à la suite, pour que backlog et épics restent découpés par palier.

Il reprend sans les redéfinir les Glossaires des PRD des Paliers 10 (`prds/prd-jdr-master-2026-10-08/`), 10.4 (`prds/prd-jdr-master-2026-10-19-p10-4/`) et 10.5 (`prds/prd-jdr-master-2026-10-28-p10-5/`) ; le §3 n'ajoute que les termes nouveaux. Il part des puces du backlog (`docs/backlog.md`, §10.6 à §10.8) retaillées avec l'utilisateur le 2026-10-31. Les constats sur le code actuel sont dans `.working/`, le rapprochement avec les sources dans `reconcile-sources.md`, la relecture qualité dans `review-rubric.md` ; la grille d'icônes par thème, destinée à l'UX, est dans `addendum.md`. Rédigé en voie rapide, puis relu : les hypothèses du brouillon ont toutes été confirmées par l'utilisateur et sont rappelées au §9.

## 1. Vision

L'application fonctionne, mais trois aspérités gênent encore un nouvel arrivant. Pour déclarer ses dispos, il faut un **appui long** sur le calendrier que rien n'annonce : un geste peu naturel, sans convention sur ordinateur, qu'on ne trouve que si on le connaît déjà. Les **icônes** sont celles, génériques, de Material, identiques dans les trois thèmes alors que tout le reste de l'interface parle grimoire, forêt ou atelier ; certaines veulent dire deux choses, d'autres sont des emoji qui changent d'aspect selon l'appareil. Enfin, le mode soirée a reçu une interface pensée « ma situation d'abord » et un vote qui se fait dans le calendrier ; **le JDR**, resté inchangé par contrainte du Palier 10, n'en profite pas encore.

Ces paliers corrigent les trois. Un bouton visible fait passer le calendrier en **mode déclaration**, où un simple tap suffit, et le tableau de bord signale les dispos manquantes. Chaque thème reçoit **ses propres icônes**, tirées de son vocabulaire (un écureuil pour les Compagnons de la forêt, une tête d'automate dans le thème Atelier), sur une base commune d'icônes utilitaires. Et les pages de JDR adoptent ce qui a fait ses preuves côté soirée : la situation de chacun sur les cartes, une fiche de scénario qui dit d'abord quoi faire, le vote en résumé avec un bouton vers le calendrier, une partie qui s'ouvre sur la suite de ses séances.

## 2. Target User

### 2.1 Jobs To Be Done

- **Nouveau joueur ou membre** : trouver seul comment dire quand il est disponible, sans qu'on lui montre le geste.
- **Joueur de JDR** : voir d'un coup d'œil, sur la page de la partie, ce qu'il a à faire (voter, s'inscrire) et le faire en un geste.
- **MJ** : retrouver ses chapitres dès l'ouverture d'une partie ; suivre un vote d'un coup d'œil et le conclure sans parcourir une liste.
- **Tous** : une interface dont les icônes parlent la langue du thème choisi, et dont chaque icône n'a qu'un sens.

### 2.2 Key User Journeys

- **UJ-1. Nina, nouvelle joueuse, déclare ses dispos sans aide.**
  Nina vient de rejoindre la partie de JDR de Marc. Sur son tableau de bord, le signal « Dispos à déclarer » l'attend. Elle le touche : le calendrier s'ouvre en mode déclaration, un bandeau lui dit « Touchez les créneaux où vous êtes disponible ». Elle touche trois soirées et un samedi entier, choisit « Disponible », valide ; le mode reste allumé, elle ajoute deux soirées « Indisponible », puis touche « Terminer ». Le signal a disparu. **Edge case :** sur ordinateur, sans passer par le signal, elle trouve le bouton « Déclarer mes dispos » dans l'en-tête du calendrier.

- **UJ-2. Karim passe en thème Forêt.**
  Karim choisit le thème Forêt ancienne. La barre de navigation change d'icônes : un sentier pour « Mes pérégrinations », un écureuil pour « Compagnons », un croissant de lune pour le calendrier lunaire. Sur une partie, le Guide porte une lanterne et les voyageurs un bâton de marche. Plus aucun emoji dans les titres : la feuille des « Habitants » prend la teinte du thème.

- **UJ-3. Hugo, joueur de JDR, vote sans chercher.**
  Hugo ouvre sa partie, qui affiche d'emblée la Chronologie, la suite de ses séances. La prochaine porte la pastille « Vote à faire ». Il ouvre la fiche de scénario : pour cette séance, sa situation et l'action « Voter dans le calendrier » viennent en tête ; en dessous, le vote en résumé (ses réponses : aucune ; meilleur créneau : samedi soir ; 2 personnes n'ont pas répondu ; échéance : jeudi). Le bouton ouvre le calendrier en Destinée sur ce sondage ; il vote. De retour, la pastille indique « J'ai voté ». **Edge case :** Marc, le MJ, ouvre la partie sur ses Chapitres ; sa séance porte « Je mène ». Dans la fiche, le résumé lui donne les noms de ceux qui n'ont pas répondu ; il fixe la date par « Fixer la date… », sans parcourir l'ancienne liste créneau par créneau.

## 3. Glossary

*Termes ajoutés à ceux des PRD des Paliers 10, 10.4 et 10.5, employés tels quels dans tout le document. « Atelier » désigne ici le thème Atelier de cuivre, jamais le terme du 10.4 (calendrier où l'on compose un sondage), que ce PRD n'emploie pas.*

- **Mode déclaration** — état du calendrier, allumé et éteint par l'utilisateur, où un tap sur un créneau le sélectionne pour y déclarer une dispo ou une indisponibilité. C'est le « mode modification » de la Story 36.3 rendu explicite : il ne s'éteint que par « Terminer », en quittant la page, ou en passant au Composer ou à la Destinée. Hors de ce mode, le calendrier est en **mode lecture** : un tap affiche le jour dans le rail.
- **Raccourci de déclaration** — l'appui long (450 ms) et le glissement existants (Story 36.3), qui ouvrent une sélection depuis le mode lecture.
- **Signal à traiter** — pastille existante sur le tableau de bord et la page d'une partie, qui nomme une action attendue de l'utilisateur (« Répondez au vote », « Créer son héros »…).
- **Icône de sens** — icône d'un concept propre à l'application (destinations, rôles, états d'une partie, actions de MJ, d'hôte ou d'admin), dessinée une fois par thème.
- **Icône utilitaire** — icône d'une action d'interface générique (fermer, retour, rechercher, télécharger…), dessinée une seule fois pour les trois thèmes.
- **Ma situation** — ce qu'est l'utilisateur pour une séance précise : « Je mène » (MJ), « Vote à faire », « J'ai voté », « Je participe », « Pas inscrit·e », « J'y étais ». Distincte de l'**état** de la séance (à dater au sens du 10.4, vote ouvert, datée, passée).
- **Fiche de scénario** — fenêtre existante qui présente un scénario et ses séances : en lecture pour le joueur (`scenario-read-dialog`), en éditeur pour le MJ (`scenario-editor`).
- **Vote en résumé** — présentation d'un sondage en quelques lignes (mes réponses, meilleur créneau, qui n'a pas répondu, échéance) à la place de la liste des créneaux, accompagnée d'un bouton vers le calendrier en Destinée.

## 4. Features

### 4.1 Palier 10.6 — Déclarer ses dispos, découvrable

**Description :** Le calendrier gagne un bouton visible « Déclarer mes dispos » qui allume le mode déclaration. Dans ce mode, un tap sélectionne un créneau, la barre de sélection existante (portée, Disponible / Indisponible, « Autre… », Annuler) s'applique comme aujourd'hui, et le mode reste allumé après validation pour enchaîner. Le mode lecture garde son comportement actuel, sans barre qui surgit (motif de la décision AC15 du 2026-08-18). Le tableau de bord signale les dispos manquantes et mène directement au calendrier en mode déclaration. Réalise UJ-1.

⚠️ **Modifie un écran validé** : le calendrier (Épics 30 et 36, Story 36.3 AC15 à AC17).

#### FR-1 : Allumer et éteindre le mode déclaration

Dans tout calendrier où il peut aujourd'hui déclarer ses dispos, l'utilisateur allume le mode déclaration par un bouton toujours visible, et peut l'éteindre. Réalise UJ-1.

**Consequences (testable):**
- Le bouton est visible sans geste préalable, sur téléphone comme sur ordinateur, dans chaque calendrier où la déclaration existe aujourd'hui. (les mêmes calendriers qu'aujourd'hui ; pas de nouvel endroit)
- Mode allumé, un bandeau ou un état du bouton dit clairement qu'on est en train de déclarer, avec une action « Terminer ».
- Le mode déclaration, le Composer et la Destinée s'excluent : allumer l'un éteint les deux autres. Le libellé du bouton se distingue de « Proposer des dates » (Composer), son voisin.
- Le mode ne survit pas à la sortie de la page.
- Le bouton et le mode sont atteignables et utilisables au clavier ; les raccourcis clavier existants (`Espace`, `1/2/3`, `Maj`+flèches, `Entrée`, `Échap`) restent valables.

#### FR-2 : Sélectionner au tap en mode déclaration

En mode déclaration, un tap ajoute ou retire un créneau de la sélection, et la barre de sélection existante s'applique. Réalise UJ-1.

**Consequences (testable):**
- Un tap sur une bande matin / après-midi / soir sélectionne ce créneau ; un tap sur le jour sélectionne la journée, comme dans la sélection actuelle.
- Une fois une déclaration validée, la sélection est vidée mais le mode reste allumé ; retirer le dernier créneau sélectionné ne l'éteint pas non plus (contrairement au mode modification actuel, AC17). (pour remplir un mois d'affilée)
- Le glissement au doigt sélectionne directement, sans appui long préalable. Un double-clic vaut deux taps.
- En mode déclaration, le tap ne sert plus à lire : le rail ne suit pas la sélection ; le repère de date courante (AC16) suit le dernier créneau touché.
- « Autre… » ouvre le panneau des contraintes comme aujourd'hui (récurrent, modification, suppression).

#### FR-3 : Conserver les raccourcis

En mode lecture, l'appui long et le glissement ouvrent toujours une sélection, comme aujourd'hui. (gardés comme raccourcis pour qui les connaît)

**Consequences (testable):**
- Un tap court en mode lecture n'ouvre aucune barre (AC15 inchangé).
- Le Composer d'un sondage (Story 45.3), qui réutilise le même geste, n'est pas modifié par ce palier.

#### FR-4 : Signaler les dispos à déclarer

Le tableau de bord affiche un signal à traiter « Dispos à déclarer » quand l'utilisateur n'a rien déclaré pour les semaines à venir ; le toucher ouvre son calendrier en mode déclaration. C'est un **rappel** régulier, pas seulement une porte de découverte : le porteur du projet tient à ce que chacun pense à mettre ses dispos à jour. Réalise UJ-1.

**Consequences (testable):**
- Le signal concerne tout membre d'au moins une partie active, de JDR ou de soirée, puisque les dispos alimentent l'automate du JDR comme les comptes des sondages de soirée (PRD 10, FR-10).
- Il apparaît une seule fois, pas une fois par partie.
- Il apparaît quand l'utilisateur n'a aucune dispo ni indisponibilité déclarée sur les quatre semaines à venir, et revient chaque fois que c'est de nouveau le cas. Une contrainte récurrente (« tous les mardis soir ») compte comme une déclaration pour les semaines qu'elle couvre.
- Il disparaît dès qu'une déclaration couvre cette période, sans recharger la page.
- Libellé propre à chaque thème, comme les autres signaux.

#### FR-5 : Faire taire le rappel des dispos

L'utilisateur peut faire taire durablement le signal « Dispos à déclarer », et le réactiver depuis ses options.

**Consequences (testable):**
- Le signal porte une action « Ne plus me le rappeler » ; une fois choisie, il ne réapparaît plus, quelle que soit la période.
- Le choix est mémorisé sur le compte : il vaut sur tous les appareils.
- La page Compte (« Mon grimoire », « Mon carnet », « Mon établi ») propose une option pour réactiver le rappel ; une fois le rappel réactivé, le signal réapparaît dès que la condition de FR-4 est remplie.
- Le choix ne vaut que pour ce signal : les autres signaux à traiter (« Répondez au vote », « Créer son héros »…) ne se font pas taire.

**Out of Scope:**
- Tutoriel, visite guidée ou bulles d'aide « première visite » : non retenus le 2026-10-31.
- Rappel par e-mail des dispos manquantes.

### 4.2 Palier 10.7 — Jeu d'icônes sur mesure, par thème

**Description :** Toutes les icônes de l'application deviennent des dessins propres à jdr-master, en deux niveaux. Les **icônes de sens** sont dessinées une fois par thème, à partir du vocabulaire de ce thème (grille de départ dans `addendum.md` §A, retouchée par l'utilisateur). Les **icônes utilitaires** sont communes aux trois thèmes mais redessinées dans le style de l'application. Les icônes surchargées sont séparées, les métaphores trompeuses remplacées (porte-voix pour une proclamation, étincelles pour l'XP, maison pour « Mes parties »…), et les emoji ou caractères spéciaux qui tiennent lieu d'icônes disparaissent. Réalise UJ-2.

Les dessins sont produits par l'agent, en SVG maison, comme l'icône de création (dé et crayon) et les badges de système du Palier 10 : l'UX propose des planches par thème, l'utilisateur les valide. Aucune bibliothèque d'icônes tierce. Ce PRD fixe le périmètre et les règles. Volume estimé : une trentaine de concepts × trois thèmes, plus une vingtaine d'utilitaires, soit de l'ordre de 110 dessins.

#### FR-6 : Icônes de sens déclinées par thème

Chaque concept de la liste ci-dessous a une icône par thème ; changer de thème change ses icônes immédiatement. Réalise UJ-2.

Concepts : destinations (Mes parties, Personnages, Calendrier, Compte) ; rôles (MJ, joueur, admin de groupe, hôte) ; états d'une partie (en cours, à venir, terminée, annulée) ; rouvrir ; masquer de ma liste ; proclamation ; distribuer l'XP ; inviter ; retirer un joueur ; nommer admin ; quitter l'office ; quitter le groupe ; favori ; signal à traiter ; vote ; Destinée (aujourd'hui ✦) ; document joint ; jeux de société ; envie ; titre de la liste des membres.

**Consequences (testable):**
- Dans chacun des trois thèmes, chaque concept de la liste a son icône, et deux concepts n'y partagent jamais la même.
- Les icônes prennent la teinte du thème, comme le texte qu'elles accompagnent.
- Les retouches de l'utilisateur sont respectées : Forêt, Compagnons = petit animal (écureuil ou similaire) ; Grimoire, joueur = bâton de mage ou baguette ; Grimoire, jeux de société = une relique seule ; Grimoire, membres = symbole magique. (Grimoire, bâton pour le joueur et baguettes croisées pour les membres, pour qu'ils ne se confondent pas)

#### FR-7 : Icônes utilitaires communes

Les actions génériques ont une icône dessinée pour l'application, la même dans les trois thèmes. Réalise UJ-2.

**Consequences (testable):**
- Le jeu couvre au moins : fermer, retour, précédent / suivant, ouvrir, déplier, aujourd'hui, ajouter, modifier, supprimer, effacer, valider, rechercher, filtres, réinitialiser, télécharger, copier, e-mail, lien, information, avertissement, cadenas, afficher le mot de passe, vues de liste.
- Une seule icône « télécharger » sert aux dix téléchargements actuels.
- Les icônes à deux états (favori posé ou non, lien actif ou révoqué, verrou ouvert ou fermé, note partagée ou non) se distinguent par la forme, pas seulement par la couleur.

#### FR-8 : Lever les surcharges

Chaque sens a sa propre icône. Réalise UJ-2.

**Consequences (testable):**
- « Terminée » et « signal à traiter » n'ont plus la même icône (aujourd'hui `flag`, y compris en icône de repli).
- « Compte » et « joueur » n'ont plus la même icône (aujourd'hui `person`).
- « MJ » et « admin de groupe » n'ont plus la même icône sur le tableau de bord (aujourd'hui `shield` pour les deux). L'écu Admin déjà présent sur les avatars (Palier 10) est repris dans le nouveau style.
- « Suivant » et « ouvrir » (aujourd'hui `chevron_right`) n'ont plus la même icône ; « accepter » et « thème actif » (aujourd'hui `check`) non plus.

#### FR-9 : Plus d'emoji ni de caractère tenant lieu d'icône

Aucun emoji ni caractère spécial ne sert d'icône dans l'interface. Réalise UJ-2.

**Consequences (testable):**
- Les titres de la liste des membres (⚔ 🌿 ⚙) affichent une icône teintée à la place de l'emoji ; les fichiers de ton ne contiennent plus ces emoji.
- Les caractères ♥ ✦ ✎ ✕ ✓ ▾ ▴ ▸ ⌄ ⌃ ✅ ⚠️ ❌ 🔒 🔓 ❮ ❯ employés comme icônes sont remplacés par des icônes de sens ou utilitaires.

**Out of Scope:**
- Le logo, la bande de marque, la bannière générée, les badges de système (R1, L1) et l'icône de création (dé et crayon) : déjà sur mesure, inchangés. Les autres SVG existants (marqueur de nature, œil du mot de passe, pictos du calendrier, crayon de couverture) sont repris dans le nouveau jeu.
- Animations d'icônes.

**Feature-specific NFRs:**
- Les icônes sont lisibles de 16 à 24 px, et dès 14 px pour les badges posés sur un avatar, sur fond clair comme sombre de chaque thème.
- Une icône seule (sans texte visible) porte un nom accessible ; une icône accompagnée de texte est décorative.
- Les icônes ne dépendent plus d'une police chargée depuis un service tiers. (la police Material de Google Fonts est retirée une fois tout remplacé)

### 4.3 Palier 10.8 — Le JDR profite des acquis des paliers soirée

**Description :** Le Palier 10 a laissé le JDR inchangé, tandis que les paliers 10, 10.4 et 10.5 ont donné au mode soirée une interface « situation d'abord » et un vote qui se fait dans le calendrier. Ce palier les reporte sur les pages de JDR : la situation de chacun sur les cartes, une fiche de scénario qui commence par l'action à faire et présente le vote en résumé, une partie qui s'ouvre sur la suite de ses séances, et le changement de couverture depuis l'onglet Détails. Les règles du JDR ne changent pas : une séance a toujours soit un vote, soit des inscriptions, et voter n'inscrit pas. Réalise UJ-3.

⚠️ **Modifie des écrans validés** : page d'une partie de JDR (ordre et onglet par défaut), cartes de chapitres et de séances, fiche de scénario et son vote. ⚠️ **Amende le PRD du 10.4** : sa FR-11 (« les chemins existants [fiche de scénario] restent en place ») et son §4.7 (« contenu de la fiche de scénario inchangé ») — le vote dans la fiche change de forme, changement que le 10.4 avait renvoyé au 10.8 (FR-14, « Out of Scope »).

#### FR-10 : « Ma situation » sur les cartes

Chaque séance affichée sur la page d'une partie de JDR porte, distincte de son état, une pastille « Ma situation » ; la carte d'un chapitre porte celle de sa prochaine séance. Réalise UJ-3.

**Consequences (testable):**
- MJ : « Je mène ».
- Joueur, séance à vote : « Vote à faire » tant qu'il n'a pas répondu, puis « J'ai voté ».
- Joueur, séance à inscriptions : « Je participe » ou « Pas inscrit·e ».
- Séance passée à laquelle il a participé : « J'y étais ». Pour une séance **sans inscriptions** (à vote ou datée directement), « Je participe » puis « J'y étais » valent pour les **joueurs actuels** de la partie, l'application ne gardant pas l'historique des membres. *(Amendé à l'architecture le 2026-11-01.)*
- Libellés alignés sur ceux des cartes d'événement (`event-card`), déclinés dans les trois thèmes.
- Le badge d'état ne porte plus la situation personnelle (aujourd'hui, « Répondez au vote » y remplace « vote ouvert »).
- La pastille suit les changements faits par les autres, sans recharger la page.

#### FR-11 : Fiche de scénario « situation d'abord »

Dans la fiche de scénario, chaque séance commence par la situation de l'utilisateur et l'action qu'elle appelle, avant son détail (par séance, la fiche pouvant en compter plusieurs). Réalise UJ-3.

**Consequences (testable):**
- Joueur : sa situation et l'action principale (voter, s'inscrire, se désinscrire) sont en tête de la séance.
- MJ : l'action attendue de lui (lancer le vote, fixer la date) est en tête de la séance.
- Le reste du contenu de la fiche (texte, documents, comptes rendus) est inchangé.

#### FR-12 : Vote en résumé, vote dans le calendrier

Dans la fiche de scénario, le sondage d'une séance s'affiche en vote en résumé ; on vote dans le calendrier, et le MJ conclut depuis la fiche. Réalise UJ-3.

**Consequences (testable):**
- Le résumé montre mes réponses, le meilleur créneau (ou « pas encore de meilleur créneau »), l'échéance et, si le rendez-vous dure plusieurs créneaux, sa plage.
- Qui n'a pas répondu : les noms pour le MJ, le nombre pour les joueurs (règle du 10.4).
- Joueur : « Voter dans le calendrier » ouvre la Destinée sur ce sondage (ouverture directe, 10.4 FR-13) ; la réponse créneau par créneau dans la fiche disparaît.
- MJ : « Fixer la date… » ouvre la même confirmation que dans la Destinée (10.4 FR-11 : créneaux avec leurs comptes, meilleur créneau en tête) et produit le même effet que « Sceller ce créneau » ; « Clôturer le vote » reste dans la fiche ; un lien ouvre aussi la Destinée. La liste « Choisir cette date » / « Sceller ce créneau » disparaît.
- Une fois la date fixée, le résumé laisse place à la date.
- Une séance sans sondage n'affiche aucun résumé ; « Lancer le vote » mène au Composer comme aujourd'hui.

#### FR-13 : Une partie s'ouvre sur la suite de ses séances

La page d'une partie de JDR s'ouvre sur l'onglet qui montre la suite des séances, placé en premier : Chapitres pour le MJ, Chronologie pour le joueur. Réalise UJ-3.

**Consequences (testable):**
- MJ : l'onglet Chapitres est le premier et l'onglet par défaut ; Détails passe après.
- Joueur : l'onglet Chronologie est le premier et l'onglet par défaut ; Détails passe après.
- Un joueur qui doit encore créer son personnage arrive toujours sur Fiches (exception actuelle conservée).
- Quête unique : le MJ arrive sur son onglet Scénario ; le joueur, qui n'a ni Chapitres ni Chronologie, arrive sur Détails comme aujourd'hui.
- Les accès internes qui ouvrent un onglet précis (par exemple « + Inviter » vers Invitations) ouvrent toujours le bon onglet après le réordonnancement.

**Notes:** Les badges de rôle sur les avatars (MJ, initiale du rôle) existent déjà en JDR ; rien à ajouter ici. La fusion de Chapitres et Chronologie en un seul onglet, sur le modèle d'un groupe, n'est pas retenue.

#### FR-14 : Changer la couverture depuis l'onglet Détails

Le MJ d'une partie de JDR, comme l'hôte ou l'admin en mode soirée, peut changer ou retirer la couverture depuis la page de la partie, sans passer par « Retranscrire ».

**Consequences (testable):**
- L'onglet Détails de la page de la partie s'ouvre sur la bannière illustrée de la partie, qui porte les pastilles « Changer » et « Retirer » pour qui peut modifier la partie, et pour lui seul. Vaut pour les deux modes. *(Amendé à l'architecture le 2026-11-01 : la page d'une partie n'a pas de bannière illustrée dans son en-tête, qui est le bandeau texte commun.)*
- « Changer » enregistre aussitôt l'image choisie ; « Retirer » demande une confirmation. Aucun « Annuler » après coup : l'ancienne image est supprimée dès le changement. *(Amendé à l'architecture le 2026-11-01.)*
- Le formulaire d'édition d'une partie de JDR propose bien « Changer » et « Retirer » (déjà livré en Story 38.3, à vérifier).

**Out of Scope (10.8):**
- Les boutons du pied de page de la partie (Retranscrire, Visibilité, Clore, Brûler) : abandonnés le 2026-10-31.
- Tout changement de règles du JDR (inscriptions, scellement, permissions) : seule la présentation change.

### Cross-cutting NFRs

- **Écrans validés.** Chaque écran validé modifié est signalé ⚠️ dans sa section ; l'UX en tient la liste et fait valider les nouvelles planches.
- **Mode soirée non régressé.** Hors icônes (10.7) et couverture dans l'onglet Détails (FR-14), aucun écran du mode soirée ne change.
- **Trois thèmes.** Chaque nouveau libellé (bouton de déclaration, bandeau, signal, pastilles, boutons du vote) existe dans les trois thèmes, avec le ton de chacun.
- **Temps réel.** Le signal des dispos, propre à l'utilisateur, suit le canal `user:{id}` ; les pastilles « Ma situation » et le vote en résumé suivent le signal de changement de leur partie (`docs/checklist.md`).
- **Mobile.** Tout est utilisable au doigt ; aucune fonction n'exige un appui long pour être trouvée (règle déjà posée par le PRD du 10.4).
- **Accessibilité.** Actions écrites et atteignables au clavier ; une icône ou une couleur ne porte jamais seule une information.

## 5. Non-Goals (Explicit)

- Pas de tutoriel, de visite guidée ni de système d'aide « première visite ».
- Pas de refonte du calendrier au-delà du mode déclaration et du signal.
- Pas d'icônes animées, pas de jeu d'icônes choisi indépendamment du thème, pas de bibliothèque d'icônes tierce.
- Pas de changement des règles du JDR ni des permissions : le 10.8 ne touche qu'à la présentation.
- Pas de report vers le JDR des fonctions propres au mode soirée (ludothèque, apports, envies, compteur d'hôte).

## 6. MVP Scope

### 6.1 In Scope

- 10.6 : mode déclaration (FR-1 à FR-3), rappel « Dispos à déclarer » et sa mise en sourdine (FR-4, FR-5).
- 10.7 : icônes de sens par thème, icônes utilitaires communes, surcharges levées, plus d'emoji (FR-6 à FR-9).
- 10.8 : « Ma situation » sur les cartes, fiche situation d'abord, vote en résumé, ouverture sur la suite des séances, couverture depuis l'onglet Détails (FR-10 à FR-14).

### 6.2 Out of Scope for MVP

- Boutons du pied de page de la partie (ancien candidat n° 5 du 10.8) : abandonnés.
- Fusion des onglets Chapitres et Chronologie : non retenue.
- Autres reports d'acquis soirée vers le JDR que ceux des FR-10 à FR-14 : écartés le 2026-10-31.

## 7. Success Metrics

- **SM-1** : un nouvel ami de la bande déclare ses dispos sans qu'on lui explique comment. Valide FR-1 à FR-5.
- **SM-2** : plus personne ne demande ce que veut dire une icône ; chacun reconnaît son thème aux icônes. Valide FR-6 à FR-9.
- **SM-3** : les joueurs de JDR votent depuis le calendrier sans qu'on le leur montre, et retrouvent la suite de leurs séances dès l'ouverture d'une partie. Valide FR-10 à FR-13.
- **SM-C1 (à ne pas optimiser)** : le nombre d'éléments d'aide à l'écran. Rendre la déclaration visible ne doit pas encombrer la lecture du calendrier, motif même de la décision AC15, et le rappel des dispos (FR-4) doit pouvoir se taire (FR-5). Contrebalance SM-1.

## 8. Open Questions

Aucune. Les trois questions du brouillon ont été tranchées par l'utilisateur le 2026-10-31 :

- **Q-1** (autres reports vers le JDR) : aucun, le 10.8 s'arrête aux FR-10 à FR-14.
- **Q-2** (seuil du signal) : rien de déclaré sur les quatre semaines à venir, en rappel régulier (FR-4).
- **Q-3** (faire taire le signal) : oui, « Ne plus me le rappeler », réactivable depuis la page Compte, pour ce seul signal (FR-5).

## 9. Assumptions Index

Toutes les hypothèses du brouillon ont été confirmées par l'utilisateur le 2026-10-31 ; aucune ne reste ouverte. Rappel des choix qui en sont issus :

- §4.1 FR-1 : le bouton existe dans les mêmes calendriers qu'aujourd'hui ; mode déclaration, Composer et Destinée s'excluent ; le mode ne survit pas à la sortie de la page.
- §4.1 FR-2 : le mode reste allumé après validation et quand on retire le dernier créneau ; glissement au doigt sans appui long ; double-clic = deux taps ; le rail ne suit pas la sélection, le repère de date suit le dernier créneau touché.
- §4.1 FR-3 : appui long et glissement gardés comme raccourcis.
- §4.1 FR-4 : signal en plus du mode ; pour tout membre d'une partie active, JDR ou soirée ; affiché une seule fois.
- §4.2 FR-6 : Grimoire, bâton pour le joueur, baguettes croisées pour les membres.
- §4.2 Out of Scope : marqueur de nature, œil, pictos du calendrier et crayon de couverture repris dans le nouveau jeu.
- §4.2 NFR : la police Material chargée depuis Google Fonts est retirée.
- §4.3 FR-11 : situation d'abord par séance dans la fiche de scénario.
- §4.3 FR-13 : quête unique, le joueur arrive sur Détails.
- §4.3 FR-14 : pastilles « Changer » et « Retirer » sur la bannière en tête de l'onglet Détails, dans les deux modes (lieu et absence d'« Annuler » amendés à l'architecture le 2026-11-01).
