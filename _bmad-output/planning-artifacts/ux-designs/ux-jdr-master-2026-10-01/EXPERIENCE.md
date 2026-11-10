---
title: jdr-master Experience — Delta Réserve de souffles de l'Homme Dragon (Story 33.6)
status: final
updated: 2026-10-02
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md"
  - "_bmad-output/implementation-artifacts/epic-33-context.md"
  - "_bmad-output/implementation-artifacts/spec-33-4-export-pdf-au-niveau-des-fiches-joueur.md"
  - "_bmad-output/implementation-artifacts/spec-33-7-capacites-de-niveau.md"
  - "docs/dragons.md"
---

# jdr-master — Experience — Delta Réserve de souffles (33.6)

Ce document est un **delta** : il hérite de l'EXPERIENCE.md du formulaire de création de l'Homme Dragon (`ux-jdr-master-2026-09-23`) et, par lui, du wizard perso, et ne décrit que le comportement propre à la réserve. Planches : [`mockups/key-reserve-final.html`](mockups/key-reserve-final.html) (contractuelle) et [`mockups/key-reserve-variantes.html`](mockups/key-reserve-variantes.html) (comparaison B / C, non contractuelle). En cas de conflit, **ce document gagne**.

Problème traité : aujourd'hui la réserve de souffles n'existe pas dans l'application — le MJ la remplit à la main dans le PDF. Règle du jeu (`docs/dragons.md`) : dès le niveau 2, la réserve compte *niveau − 1* emplacements ; chaque souffle conservé se lance une fois, gratuitement ; le MJ choisit sa réserve, puis l'annonce aux joueurs. Le MJ la compose **une seule fois** ; l'application la mémorise et permet de l'imprimer dans l'export PDF — sans rien décompter en séance.

**Périmètre tranché pendant la conception UX** : il n'y a qu'**une seule réserve par Homme Dragon**, portée par sa fiche. La réserve *par séance* (les critères d'acceptation, ou « AC », de la Story 33.6 et la décision d'architecture AD-22 d'origine) est **abandonnée** à la demande de l'utilisateur (« risque de perdre l'utilisateur ») : plus d'écran de séance, plus de résolution défaut/séance, aucun impact sur les séances. Le bouton « Vider la réserve » a été proposé puis **retiré** : pour exporter un PDF sans souffles, le MJ retire les souffles un à un.

## 1. Foundation

Web responsive, Angular Material 22 — hérité intégralement. Aucun nouveau form-factor. Surface unique : la **fiche de l'Homme Dragon** (incrustée dans l'écran de la partie côté MJ ; ouverte aussi depuis « Personnages », story 33.5). Fonctionnalité **réservée au MJ** (FR-61 / D-21). DESIGN.md est la référence d'identité visuelle. Enjeu : usage interne, fonctionnalité de jeu — **aucune contrainte réglementaire** (IEC 62304 / gestion des risques non concernées).

## 2. Information Architecture

- **Une réserve par Homme Dragon**, rattachée à sa fiche. Aucune réserve sur les séances, aucun écran de séance concerné.
- **Une section « Réserve de souffles »** dans la fiche, **colonne gauche, juste avant la carte « Souffles »** (catalogue de lecture). Ordre de la colonne gauche : Artefact, Présentation, Capacités, Cadeau à choisir, Éveil, **Réserve de souffles**, Souffles, Souffles rituels. La colonne droite (Stats dérivées, Voyageurs, Historique) est inchangée.
- **Une fenêtre de choix** (surface de détail existante) s'ouvre depuis un emplacement. Elle liste les souffles par catégorie : Communs par famille (temps, destin, aide aux PNJ), souffles de la race, souffles des autres races, souffles rituels.
- La réserve alimente l'**export PDF** (voir §10). Elle n'est **jamais** montrée aux joueurs.
- Bouclage : chaque besoin exprimé a une surface — composer (section + fenêtre), mémoriser (enregistrement automatique), imprimer (export PDF existant), exporter sans souffles (« Retirer »). Le Key Flow §8 les traverse.

## 3. Voice and Tone

Ton hérité (léger, JDR, accompagnant), vouvoiement du MJ. Textes décidés pendant la conception UX :

| Où | Texte |
| --- | --- |
| Niveau 1 (ligne d'info, sans composeur) | « La réserve de souffles s'ouvre au niveau 2. » |
| Mention d'enregistrement (**sous le titre de la section**, seulement quand la réserve est réellement enregistrée) | « Enregistrée automatiquement, utilisée pour l'export PDF. » |
| Mention pendant l'écriture | « Enregistrement… » (remplace la mention ci-dessus) |
| Erreur d'enregistrement (`role="alert"`) | « Impossible d'enregistrer la réserve. Réessayez. » |
| Annonces de la zone de statut (`role="status"`) | « Courage placé dans l'emplacement 1 » · « Chance retiré de l'emplacement 2. Annuler disponible pendant quelques secondes. » · « Chance remis dans l'emplacement 2 » · « Enregistrement… » · « Réserve enregistrée » |
| Compteur en tête de la fenêtre | « k / N emplacements » (ex. « 2 / 3 emplacements » ; singulier « 0 / 1 emplacement ») |
| Titre de la fenêtre (slot `header`) | « Choisir un souffle pour l'emplacement N » (le compteur ci-dessus est à côté) |
| Emplacement vide (bouton) | « Choisir un souffle » (indication à côté : « Emplacement libre ») |
| Emplacement rempli (boutons) | « Changer » · « Retirer » |
| Annulation du dernier retrait (bandeau) | « <Souffle> retiré de l'emplacement N. » · bouton « Annuler » |
| Zone de détail (boutons) | « Annuler » (secondaire) · « Mettre dans l'emplacement N » (principal ; N = numéro de l'emplacement visé) |
| Raison de grisage — souffle du temps | « Non réservable : souffle du temps » |
| Raison de grisage — quota d'autre race | « Un seul souffle d'une autre race » |
| Raison de grisage — souffle d'une autre race déjà placé | « Déjà dans l'emplacement N » |
| Repère non bloquant — souffle commun ou de la race déjà placé | « Déjà dans l'emplacement N » (même libellé ; n'interdit rien) |
| Raison de grisage — rituel avant le niveau 5 | « Admis dès le niveau 5 » (formulation de la planche contractuelle) |
| Raison de grisage — autre race avant le niveau 3 | `[ASSUMPTION]` « Autres races : à partir du niveau 3 » (formulation non vue sur planche) |
| Titre de la section (fiche) | « Réserve de souffles » · « Niveau N · k emplacements » (singulier : « Niveau 2 · 1 emplacement ») |
| En-tête d'« Autres races » dépliée (information, non une raison) | « 0 / 1 souffle autorisé » |
| Note de la zone de détail (souffle déjà placé) | « Déjà dans l'emplacement 2 : un même souffle peut occuper plusieurs emplacements. » |
| Intertitres de groupe | « Souffles communs » · « Votre race » · « Autres races et rituels » |
| Lignes de règle (indicatives, planche P1 / P2b / P3 / P4) | « Règle : un seul souffle d'une autre race au plus. Un même souffle peut occuper plusieurs emplacements. » · niveau 2 : « Règle : les souffles d'une autre race s'ouvrent au niveau 3. » · quota atteint : « … — <souffle> (<race>) l'occupe déjà. » |

Les raisons sont **toujours écrites**, précédées de l'icône ⊘ (décorative, `aria-hidden`), et **le vocabulaire est identique** entre l'en-tête de catégorie repliée et les lignes qu'elle contient ; une ligne grisée sans raison est un défaut. Aucun mot de suivi en jeu (« restant », « utilisé », « consommé ») : l'application ne décompte rien.

## 4. Component Patterns

Voir DESIGN.md §7 pour le visuel et la table des **noms canoniques** (mêmes noms ici).

- **Ligne d'emplacement** (rempli ou vide) : une ligne numérotée. Vide → toute la ligne est le bouton « Choisir un souffle » et ouvre la fenêtre. Rempli → nom du souffle (sa description reste accessible dans la fenêtre, mais n'est jamais nécessaire pour lire la réserve) ; « Changer » rouvre la fenêtre ; « Retirer » vide l'emplacement **immédiatement, sans confirmation**, et se corrige en re-choisissant ou par l'**Annulation du dernier retrait** ci-dessous. `[ASSUMPTION]` (a)
- **Compteur d'emplacements** : en tête de la fenêtre, « k / N emplacements » ; la section de la fiche porte seulement « Niveau N · k emplacements » (singulier : « Niveau 2 · 1 emplacement »).
- **Ligne d'info de niveau 1** : une phrase, aucun composeur, aucun bouton.
- **Annulation du dernier retrait** : après « Retirer », un bandeau « <Souffle> retiré de l'emplacement N. » + bouton « Annuler » s'affiche pendant quelques secondes (durée : voir §5). « Annuler » remet le souffle dans le **même** emplacement ; si cet emplacement est entre-temps occupé, le bandeau disparaît ; un nouveau retrait remplace le message. Il n'y a **pas** de dialogue de confirmation. Le bouton est focalisable, ≥ 44 px, et ne prend jamais le focus de force.
- **Mention d'enregistrement · Message d'erreur d'enregistrement · Zone de statut** : voir §3, §5 et §7. La zone de statut est un nœud persistant ; la mention est **conditionnelle à l'état réel** (jamais « Enregistrée » pendant l'attente ou l'échec).
- **Fenêtre de choix** : c'est la **surface de détail existante** (`DetailSurface`, `createDetailSurfaceHost()`) — modale centrée à partir de 1024 px, feuille basse en dessous. Elle est ouverte *pour un emplacement précis*, et le composant est **étendu de façon rétro-compatible** (slots `header` et `footer`, `dvh` + zone sûre, `max-height` propre de la zone de détail, fermer 44 px : DESIGN.md §7). Nom accessible : le titre de l'en-tête « Choisir un souffle pour l'emplacement N » ; description : le compteur. L'en-tête porte le compteur, le **pied épinglé** porte la zone de détail et ses boutons.
- **En-tête de catégorie** : chaque catégorie est repliable/dépliable, **y compris** Communs et souffles de la race. La liste complète des souffles et de leurs infos reste ainsi consultable d'un geste.
- **Ligne de souffle** : un **`<button>` natif**, tabulable. Entrée/Espace (ou clic/tap) = **consulter** le souffle : la ligne passe en `aria-pressed="true"` et la zone de détail l'affiche. Nom accessible = nom + coût + repère + raison éventuelle ; la description est liée par `aria-describedby`. Description sur **2 lignes** (pas d'ellipse mono-ligne).
- **Ligne grisée** : une ligne de souffle en `aria-disabled="true"` (**jamais `disabled`** : elle reste focalisable). **Elle se consulte mais ne se place pas** : la zone de détail affiche sa description et sa raison ; « Mettre dans l'emplacement N » reste **visible** en `aria-disabled="true"`, la raison liée par `aria-describedby` ; l'activer n'a aucun effet. Nom à `opacity ≥ .6`, pastille de coût jamais atténuée (DESIGN.md §2).
- **Zone de détail** : « Annuler » ferme la fenêtre sans rien modifier ; « Mettre dans l'emplacement N » place le souffle consulté, enregistre et ferme (`[ASSUMPTION]`, §6). « Retirer » n'y figure pas : il reste sur la ligne d'emplacement.

## 5. State Patterns

| État | Comportement |
| --- | --- |
| **Niveau 1** | La section s'affiche avec **une ligne d'info** (§3) ; ni emplacement, ni composeur, ni bouton. |
| **Niveau 2…5** | *Niveau − 1* emplacements numérotés, tous visibles (1 au niveau 2, jusqu'à 4 au niveau 5). Titre de section avec « Niveau N · k emplacements » (singulier : « Niveau 2 · 1 emplacement »). |
| **Emplacement vide / rempli** | Vide : pointillé + « Choisir un souffle ». Rempli : nom du souffle + « Changer » / « Retirer ». |
| **Même souffle sur plusieurs emplacements** | Autorisé pour un souffle **commun ou de la race** (règle du jeu). Chaque emplacement reste indépendant ; la ligne du souffle porte le repère non bloquant « Déjà dans l'emplacement N ». |
| **Souffle d'une autre race** | **N'occupe qu'un seul emplacement** (décision) : une fois placé, il est grisé dans la fenêtre avec « Déjà dans l'emplacement N ». |
| **Quota autre race** | Dès le niveau 3, au plus **un** souffle d'une autre race ; avant le niveau 3, aucun. Quota atteint → les autres souffles d'autres races sont grisés avec « Un seul souffle d'une autre race ». `[ASSUMPTION]` L'emplacement qui contient le souffle d'autre race reste modifiable (« Changer » / « Retirer ») quand le quota est atteint ; le quota se calcule hors emplacement visé. |
| **Interdits grisés avec raison** | Souffles du temps (Passé, Futur — les seuls `reservable: false`), autre race au-delà du quota ou déjà placée, rituels avant le niveau 5 : **grisés, jamais masqués**, raison écrite sur la ligne **et** dans l'en-tête quand la catégorie est repliée. |
| **Catégories repliées par défaut** | À l'ouverture de la fenêtre, **toutes les catégories sont dépliées, sauf** celles où rien n'est choisissable (ex. temps, rituels avant le niveau 5, autres races avant le niveau 3 ou quota atteint) : celles-là sont **repliées**, avec la raison en une ligne à côté du titre. Les lignes grisées d'une catégorie dépliée gardent leur raison. |
| **Rituels dès le niveau 5** | Choisissables dans la fenêtre dès le niveau 5, **ne comptent pas** comme « autre race ». La carte « Souffles rituels » (33.7) reste un catalogue de consultation ; sa consigne « sans réserve ni décompte » est réécrite (voir §10). `[ASSUMPTION]` (d) |
| **Enregistrement automatique** | Chaque geste (choisir / changer / retirer) est enregistré immédiatement ; pas de bouton « Enregistrer ». **Un seul enregistrement en vol** : pendant l'attente, les boutons d'emplacement sont `aria-disabled="true"`, la liste porte `aria-busy="true"`, la mention devient « Enregistrement… » et la zone de statut l'annonce ; à la réussite : « Réserve enregistrée ». **Échec** : « Impossible d'enregistrer la réserve. Réessayez. » (`role="alert"`, **nœud recréé à chaque échec** pour qu'une erreur répétée soit ré-annoncée) et l'emplacement **revient à son état précédent** (rien n'est vidé ni écrasé) ; la mention « Enregistrée automatiquement, utilisée pour l'export PDF. » est masquée tant que l'erreur est affichée. |
| **Annulation du dernier retrait** | Après « Retirer » : l'emplacement est vidé aussitôt et le bandeau apparaît ; **« Annuler » reste `aria-disabled` tant que l'écriture du retrait n'est pas terminée** (un seul enregistrement en vol), puis le délai de **6 s (valeur d'exemple, à fixer)** démarre (`[ASSUMPTION]` ; décompte suspendu tant que le focus ou le survol est sur le bandeau, WCAG 2.2.1). « Annuler » est lui-même une écriture : même règle (boutons `aria-disabled`, `aria-busy`) ; réussite → le souffle est remis dans le même emplacement, le bandeau disparaît, annonce « <Souffle> remis dans l'emplacement N » ; échec → message d'erreur habituel, l'emplacement reste vide. Si l'écriture du retrait échoue : l'emplacement revient, **pas de bandeau**, message d'erreur. Le bandeau disparaît aussi quand l'emplacement est de nouveau occupé ; un **nouveau retrait remplace** le message précédent (on n'annule que le dernier retrait). |
| **Mise à jour reçue fenêtre ouverte** | Un `changed` reçu pendant la consultation **ne recrée pas** les nœuds ouverts (listes à `track` stable : le focus ne saute pas). Si le placement du souffle consulté devient invalide (emplacement disparu après un changement de niveau ailleurs, souffle d'autre race déjà placé depuis un autre appareil), « Mettre dans l'emplacement N » passe en `aria-disabled="true"` avec sa raison, **annoncée par la zone de statut**. |
| **Montée de niveau** | La réserve existante est conservée ; les **nouveaux emplacements apparaissent vides**. `[ASSUMPTION]` (b) |
| **Souffle retiré du catalogue** | La ligne reste lisible, libellé = **clé brute** ; elle est **toujours retirable** (et « Changer » reste possible). `[ASSUMPTION]` (c) |
| **Réserve vide** | État normal : le PDF sort avec les cases de souffles vides (à cocher au crayon). |
| **Niveau qui baisse** | **Aucune règle spécifique** (décision : cas quasi impossible, un scénario terminé est terminé). Rien à spécifier ni à implémenter. |
| **Aucun décompte** | Ni pendant la séance, ni à l'export : la réserve est une composition, pas un stock. |
| **Visibilité** | MJ seul. La section n'existe pas pour un joueur, et aucune réponse d'API ne lui transmet la réserve. |

## 6. Interaction Primitives

Clic/tap sur un emplacement, une ligne de souffle ou un en-tête de catégorie. Cible tactile 44 px minimum (héritée). Aucun glisser-déposer, aucun stepper +/− (variante C écartée).

**Clavier.** Tab / Maj+Tab parcourent les boutons : emplacements, en-têtes de catégorie, **lignes de souffle (boutons natifs : Entrée / Espace = consulter)**, boutons de la zone de détail. Échap ferme la fenêtre (comme « Annuler » de la zone de détail et ✕). Pas de `listbox` à flèches : chaque ligne est tabulable.

**Cible de focus par geste — appliquée après le rendu** (`afterNextRender`), jamais de façon synchrone. `createDetailSurfaceHost().close()` focalise le déclencheur avant que la section soit re-rendue. Or le bouton « Choisir un souffle » d'un emplacement est remplacé par « Changer » / « Retirer » une fois le souffle placé (et inversement après « Retirer »). Le bouton focalisé n'existe alors plus : le focus retomberait sur `<body>`.
- **Placer / Changer** (« Mettre dans l'emplacement N ») → le bouton **« Changer »** de cet emplacement.
- **Retirer** → le bouton **« Choisir un souffle »** du même emplacement (le bandeau d'annulation ne déplace pas le focus).
- **« Annuler » (bandeau de retrait)** → le bouton **« Changer »** de l'emplacement rétabli. Si le bandeau expire alors que « Annuler » a le focus → « Choisir un souffle » du même emplacement.
- **« Annuler » (zone de détail) / Échap / ✕** → le **déclencheur d'origine** (le bouton qui a ouvert la fenêtre).
- **Échec d'enregistrement** (retour à l'état précédent) → même règle : le bouton correspondant à l'état rétabli.

**Tests clavier exigés** pour ces cas (placer/changer, retirer, annuler/Échap, Annulation du dernier retrait) : la cible de focus est vérifiée après le rendu ; le focus n'est jamais sur `<body>`.

`[ASSUMPTION]` « Mettre dans l'emplacement N » **ferme la fenêtre** une fois le souffle placé (le focus suit la règle ci-dessus). Les mises à jour de la fiche (autre appareil) suivent le signal temps réel de la partie (`changed`/`notifyChanged()`, `RealtimeService`) — câblage **à évaluer à l'implémentation** selon `docs/checklist.md`, sans AC imposé.

## 7. Accessibility Floor

Hérité du spine wizard, plus :
- **Lignes de souffle = `<button>` natifs**, tabulables ; `aria-pressed` sur la ligne consultée ; Entrée/Espace = consulter. Nom accessible de la ligne = **nom + coût + repère + raison**, via `aria-labelledby` ; description via `aria-describedby` (pas dans le nom). Une ligne grisée est `aria-disabled="true"` et reste focalisable.
- **Focus** : à l'ouverture de la fenêtre, le focus entre dans la fenêtre (piège de focus) ; à sa fermeture il va à la **cible définie par geste en §6** (jamais `<body>`). Bouton de fermeture de **44 px**, nommé « Fermer la fenêtre » (modale desktop) / « Fermer la feuille » (feuille mobile).
- **Dialogue** : nom accessible « Choisir un souffle pour l'emplacement N » (titre de l'en-tête), description = le compteur d'emplacements. Utilisable à **320 × 256 CSS px** (AC). `inert` sur le conteneur applicatif tant que la surface est ouverte : **recommandé** ; à défaut, risque accepté : `aria-modal` et piège de focus CDK seuls, comme dans la story 31.4.
- **Zone de statut persistante** : un nœud `role="status"` (`aria-live="polite"`) présent dès le chargement de la section, qui annonce « Courage placé dans l'emplacement 1 », « Chance retiré de l'emplacement 2. Annuler disponible… », « Chance remis dans l'emplacement 2 », « Enregistrement… », « Réserve enregistrée », et les actions devenues invalides (§5). `aria-busy` sur la liste des emplacements pendant l'enregistrement.
- **Erreur d'enregistrement** : `role="alert"` (annoncée sans déplacement du focus), nœud **recréé à chaque échec**.
- **Catégories repliables** : `aria-expanded` + `aria-controls` sur chaque en-tête (`h3 > button`), état lisible au lecteur d'écran ; titre, raison et nombre de souffles font partie du nom accessible.
- **Structure** : `role="list"` explicite sur la liste des emplacements et sur chaque liste de souffles ; les intertitres de groupe sont des `role="group"` + `aria-labelledby` ; niveaux de titre cohérents avec le `h2` de la surface (`h2` titre, `h3` catégories, `h4` sous-groupes de race) ; chaque `<li>` d'emplacement est nommé via `aria-labelledby` (« Emplacement 1 — Courage »).
- **Noms de boutons incluant le souffle** : « Changer le souffle de l'emplacement 2 : Chance », « Retirer Chance de l'emplacement 2 », « Choisir un souffle pour l'emplacement 3 ». Le libellé visible (« Changer », « Retirer », « Choisir un souffle ») est contenu dans le nom accessible.
- **Annulation du dernier retrait** : bouton « Annuler » focalisable, ≥ 44 px, annoncé par la zone de statut ; délai **suspendu** tant que le focus ou le survol est sur le bandeau (WCAG 2.2.1) ; ne prend jamais le focus de force.
- **Cibles** ≥ 44 px (emplacements, « Changer »/« Retirer », lignes de souffle, en-têtes de catégorie).
- **Information jamais par la seule couleur** : grisage = opacité + icône ⊘ + raison écrite ; vide/rempli = pointillé + libellé du bouton ; **sélection d'une ligne = contour 2 px + pastille pleine, pas l'accent seul** ; gemme et liséré de race toujours doublés du nom de la race (en `text-primary`) ; erreur = couleur + icône + texte.
- **Contrastes** : contours et indicateurs d'interface en `outline` ≥ 3:1, texte ≥ 4,5:1 ; nom grisé `opacity ≥ .6`, pastille de coût jamais atténuée ; à mesurer dans les **trois thèmes** (grimoire-emeraude, foret-ancienne, atelier-cuivre — `medieval-steampunk` dans le code jusqu'au renommage FR-43) : voir DESIGN.md §2.
- **Mouvement** : `prefers-reduced-motion` respecté — pas d'animation de hauteur au repli, rotation instantanée du chevron, y compris pour la surface.
- **Zoom et texte** : tailles en `rem`, jamais sous 12 px ; ligne d'emplacement sur deux lignes sous ~480 px de largeur de section (§9) ; feuille mobile en `dvh` avec zone sûre (`env(safe-area-inset-bottom)`).

## 8. Key Flows

**Maëlle, MJ, prépare son Homme Dragon (Dragon Rouge, niveau 4) avant la séance de samedi et veut son PDF à jour.** Elle ouvre « Personnages », puis la fiche de son dragon. Dans la colonne gauche, juste au-dessus de la carte « Souffles », la section « Réserve de souffles » indique « Niveau 4 · 3 emplacements » : trois lignes en pointillé, « Choisir un souffle ». (1) Elle touche l'emplacement 1 : la fenêtre s'ouvre, « 0 / 3 emplacements » en tête ; les souffles communs et ceux du Dragon Rouge sont dépliés, les catégories sans choix possible repliées. Elle consulte Courage, lit sa description, touche « Mettre dans l'emplacement 1 ». La fenêtre se ferme, le focus se pose sur « Changer » de l'emplacement 1, la zone de statut annonce « Courage placé dans l'emplacement 1 » puis « Réserve enregistrée » — elle n'a rien d'autre à faire. (2) Même geste pour Chance dans l'emplacement 2. (3) Pour l'emplacement 3, par curiosité, elle déplie les souffles du temps : Passé et Futur sont grisés, avec « Non réservable : souffle du temps » — elle consulte Passé, lit sa description, voit que « Mettre dans l'emplacement 3 » est inactif et pourquoi, et comprend sans chercher dans le livre. **Climax :** elle parcourt la catégorie d'une autre race (dépliée d'office : un souffle y est choisissable) et place un souffle qui lui plaît ; en rouvrant la fenêtre, tous les autres souffles d'autres races sont grisés, « Un seul souffle d'une autre race », et celui qu'elle vient de placer indique « Déjà dans l'emplacement 3 ». Elle comprend la règle sans l'avoir lue. Elle décide de remettre Courage à la place (« Changer », puis « Mettre dans l'emplacement 3 » : le même souffle peut occuper plusieurs emplacements). Elle exporte le PDF : les trois premières cases de souffles portent le nom du souffle, la quatrième reste vide, rien n'indique un suivi. (4) Samedi, elle annonce sa réserve à voix haute aux joueurs ; ceux-ci n'ont jamais vu l'écran. Le mois suivant, au niveau 5, un quatrième emplacement vide l'attend ; le reste n'a pas bougé. *Variante :* pour un PDF sans souffles, elle touche « Retirer » sur chaque emplacement (3 gestes, sans confirmation ; après chacun le focus se pose sur « Choisir un souffle » du même emplacement ; un retrait fait par mégarde se rattrape avec « Annuler » (bandeau de retrait) dans les quelques secondes qui suivent, et seul le dernier retrait est annulable). *Échec :* si une écriture échoue, l'emplacement revient à son état précédent et « Impossible d'enregistrer la réserve. Réessayez. » s'affiche (`role="alert"`) ; elle retouche le même emplacement pour réessayer.

## 9. Responsive & Platform

Seuil desktop unique du projet : **1024 px** — modale centrée au-dessus, feuille basse en dessous (comportement de `DetailSurface`). La fiche passe en deux colonnes dès 768 px (seuil local de la fiche, inchangé) ; sous ce seuil la section reste « juste avant la carte Souffles » dans l'ordre linéaire. **Ligne d'emplacement** : bascule en deux lignes (contenu, puis « Changer » / « Retirer » à pleine largeur) sous **~480 px de largeur de section** (container query), pas selon l'écran ; test visuel à 320 px et à 200 % de zoom (planches P6a). Feuille mobile : `dvh` + `padding-bottom: max(20px, env(safe-area-inset-bottom))` (P6b), fournis par l'extension de `DetailSurface` (DESIGN.md §7) ; la fenêtre reste utilisable à **320 × 256 CSS px** (AC : en-tête et pied compacts, liste défilante visible, zone de détail à `max-height` avec défilement propre). Aucun second seuil d'écran introduit.

## 10. Impact sur les artefacts de planification

Abandon de la réserve par séance : amender **avant `bmad-build` 33-6** (sprint change léger). Numéros de ligne relevés le 2026-10-02 (à revérifier au moment de l'édition ; les ancres par nom font foi). Le `sprint-change-proposal-2026-09-26.md` est historique : ne pas le réécrire.

1. **PRD `prds/prd-jdr-master-2026-08-01/prd.md`** (source de FR-61, **en tête de liste**) : titre FR-61 L268 (« préparée avant la séance ») ; corps L269 (« sur la page d'une séance … pour cette séance ; une réserve par défaut … pré-remplit toute séance ») → **une seule réserve sur la fiche** ; règles L270 (ajouter : un souffle d'une autre race n'occupe qu'un emplacement) ; L271-273 à relire (aucun décompte, MJ seul, prérequis D-21) ; **D-21 L484** (« réserve par séance et réserve par défaut » → « réserve de l'Homme Dragon ») ; L263 et L488 (« préparée avant la séance ») à relire ; Q-13 L517 à relire.
2. **`epics.md`** : libellé FR-61 **L52** et **L79** (« préparée avant la séance »), tableau FR-61 **L253**, note d'ordre / D-21 **L326**, note Q-13 **L1768** (« la réserve préparée avant la séance est portée par la 33.6 »), **Story 33.4 L1877** (« si une réserve par défaut existe » → « si une réserve existe »), note **L2005** (« Réserve de séance (33.6) : une séance reste dans une seule partie… » : à supprimer). **Story 33.6 (L1915-1958), ligne à ligne :**
   - L1917-1919 (énoncé « pour cette séance, à partir d'une réserve par défaut … sans la recalculer à chaque fois ») → composer la réserve sur la fiche, enregistrée pour l'export PDF.
   - L1923-1925 (AC « j'ouvre une séance » / aucune réserve) → « j'ouvre sa fiche » : la section affiche la ligne d'info, aucun composeur.
   - L1927-1931 : L1928 (« par défaut sur la fiche, ou pour une séance ») → « sur la fiche » ; conserver capacité N − 1, même souffle commun/de race possible, temps exclus, quota autre race ; **ajouter** : un souffle d'une autre race n'occupe qu'un emplacement.
   - L1933-1936 (« séance dont je n'ai pas composé la réserve … réserve par défaut ») → **supprimer**.
   - L1938-1940 (« When la séance a lieu » / aucun décompte) → reformuler sans séance (« l'application ne décompte rien »).
   - L1942-1944 (« un joueur de la partie ouvre la séance ») → **supprimer** ; le remplacer par « aucune réponse d'API ne transmet la réserve à un joueur ».
   - L1946-1948 (niveau 5 : rituels, sans compter comme autre race) → conserver.
   - L1950-1952 (« la séance est ouverte sur un autre de mes appareils ») → **retirer comme AC** : temps réel multi-appareil = « à évaluer à l'implémentation (`docs/checklist.md`) », pas un AC imposé.
   - L1954-1956 (souffle retiré du catalogue) → ajouter « et reste retirable ».
   - L1958 (note) → « écran conçu par une passe `bmad-ux` » : fait ; confronter « souffles rituels traités comme les autres souffles » à la décision (d).
   - **À ajouter** : enregistrement automatique à chaque geste, échec avec retour à l'état précédent ; Annulation du dernier retrait ; fenêtre utilisable à 320 × 256 CSS px ; interdits grisés avec raison écrite, jamais masqués ; catégories repliables ; PDF (point 5).
3. **`architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md`, AD-22 (L221-228), point par point :** titre L221 (« sur la séance et dans la fiche » → fiche seule) ; **Binds** L223 (D-21 reformulé) ; **Prevents** L224 (« la recopie de la réserve par défaut dans chaque séance » : sans objet) ; **Rule** L225 → **un seul champ** `HommeDragon.sheetData.reserve` (nom à fixer par l'architecture ; ancien `reserveParDefaut`), liste **positionnelle par emplacement** (un emplacement peut être vide — la forme `{ key, count }` ne convient plus : « Déjà dans l'emplacement N », « Retirer » par emplacement), **plus de `Seance.reserveSouffles`**, plus de résolution défaut/séance, aucun impact `SeanceDto` ; **Lecture** L226 (« DTO de séance » → toute réponse servie aux joueurs : jamais) ; **Écriture** L227 (ajouter : un souffle d'autre race sur un seul emplacement ; écriture compatible avec l'enregistrement **à chaque geste**, par emplacement ou par remplacement complet — choix d'architecture) ; **Ne pas** L228 (retirer « recopier … dans les séances »). Ligne **Q-13 L498** (« la réserve préparée avant la séance relève d'AD-22 ») à reformuler. *Le diagramme Mermaid qui suit (L230-250) est le graphe des modules et ne contient aucun nœud réserve/séance : rien à ajuster.*
4. **`implementation-artifacts/epic-33-context.md`** : Goal **L7** (« réserve … préparée avant la séance ») ; puce *Réserve (FR-61)* **L28** (supprimer en entier « Réserve par défaut sur la fiche, pré-remplissant toute séance non composée … la modifier sur une séance ne touche pas le défaut ») ; puce *PDF (33.4)* **L31** (« réserve par défaut imprimée si elle existe » → « réserve ») ; puce *AD-22* **L42** ; puce UX **L51** (« Écran de réserve (page de séance + …) » → section sur la fiche + fenêtre de choix) ; *Cross-Story* **L57** (33.4) et **L59** (33.6 : retirer la dépendance aux séances).
5. **Lien avec l'export PDF (33.4, livrée)** : le gabarit a `nombre_souffles` (« Nombre Max », **déjà** égal à `max(N − 1, 0)` depuis la 33.4) et 4 cases `souffle_1..4` laissées vides et « réservées à la réserve de la 33.6 ». La 33.6 **remplit `souffle_1..4`** dans l'ordre des emplacements, **chaque case = le nom du souffle seul** (`mapHommeDragonToPdfFields()` + tests `homme-dragon-pdf-field-map.spec.ts`) ; **réserve vide ⇒ cases vides** ; `nombre_souffles` ne change pas ; `souffle_actuel` reste vide. À mettre à jour : `implementation-artifacts/deferred-work.md` **L168-169** (clause « réserve par défaut » → à clore par la 33.6) et `apps/api/game-systems/ryuutama/assets/README.md` **L89** (« réservées à la 33.6 » : à tenir à jour à la livraison). La spec 33.4 est une story livrée : ne pas la réécrire.
6. **Textes existants à réécrire (périmètre 33.6)** : la consigne « Mère-dragon : ces souffles sont consultables ici, sans réserve ni décompte. » dans `apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` (~L334). `docs/dragons.md` L227 est **déjà correct** (rien à faire avant la livraison). La spec 33-7 est une story livrée : ne pas la réécrire.
7. **Extension du composant partagé `DetailSurface`** (`apps/web/src/app/shared/detail-surface/`) : la 33.6 l'**étend de façon rétro-compatible** (slots `header` / `footer`, `dvh` + zone sûre, `max-height` de la zone de détail, fermer 44 px avec libellé « Fermer la fenêtre » / « Fermer la feuille », largeur desktop adaptée, `prefers-reduced-motion` sur ses animations : feuille et fenêtre, aujourd'hui sans bloc `reduce`). **Elle doit re-vérifier tous les autres usages** (relevé par graphify + recherche le 2026-10-02) : `homme-dragon-sheet` (artefact, éveil, souffle, capacités de niveau, cadeau, souffles rituels — `<app-detail-surface>` ×1, plus `createDetailSurfaceHost()`) ; `homme-dragon-creation-wizard` (×2) ; `character-sheet` (×1) ; `character-wizard` (×2) et ses étapes `class-step`, `weapon-step`, `type-step`, `magic-step`, `equipment-step` (×1 chacune) ; le gabarit partagé `talent-detail.ts` ; commentaire de patron dans `layout/shell/shell.scss`. Les `*.spec.ts` associés (`detail-surface.spec.ts`, `detail-surface-host.spec.ts`, specs des fiches et assistants) sont à relire ; passe visuelle mobile et desktop sur chaque usage (bouton de fermeture agrandi à 44 px, focus, `reduced-motion`).

## 11. Questions ouvertes et hypothèses

Hypothèses de la facilitation (a)-(d), non contestées par l'utilisateur et **retenues** à la clôture de la conception UX, à confirmer à la relecture du draft :
- `[ASSUMPTION]` (a) « Retirer » sans confirmation (instantané, réversible en re-choisissant ou par l'Annulation du dernier retrait).
- `[ASSUMPTION]` (b) À la montée de niveau, les nouveaux emplacements apparaissent vides.
- `[ASSUMPTION]` (c) Souffle retiré du catalogue : ligne lisible, libellé = clé brute, toujours retirable.
- `[ASSUMPTION]` (d) La carte « Souffles rituels » (33.7) reste un catalogue de consultation, sa consigne est réécrite, les rituels sont choisissables dans la fenêtre dès le niveau 5.

Autres hypothèses (signalées en ligne) :
- `[ASSUMPTION]` Raison de grisage « Autres races : à partir du niveau 3 » (§3).
- `[ASSUMPTION]` Quand le quota d'autre race est atteint, l'emplacement qui contient ce souffle reste modifiable (§5).
- `[ASSUMPTION]` La fenêtre se ferme après « Mettre dans l'emplacement N » (§6) ; le focus suit alors la règle par geste.
- `[ASSUMPTION]` Annulation du dernier retrait : durée du délai à fixer (valeur d'exemple : voir §5) ; décompte suspendu tant que le focus ou le survol est sur le bandeau (WCAG 2.2.1).
- `[ASSUMPTION]` Correspondance des alias de tokens (`text-primary`, `surface-high`, `outline`, `error`) avec la base et le code (DESIGN.md §2).

### Décisions de clôture

Questions soulevées pendant la finalisation et la relecture, **toutes tranchées** (aucun point ouvert) :
1. **Souffle d'une autre race** : n'occupe qu'**un seul** emplacement ; une fois placé, grisé « Déjà dans l'emplacement N » (décision utilisateur).
2. **Niveau qui baisse** avec emplacements en surplus : **aucune règle spécifique**, rien à spécifier ni implémenter (décision utilisateur).
3. **Mention d'enregistrement** : « Enregistrée automatiquement, utilisée pour l'export PDF. », sous le titre de la section, conditionnelle à l'état réel (retenue faute d'objection).
4. **Message d'erreur** : « Impossible d'enregistrer la réserve. Réessayez. » — `role="alert"`, l'emplacement revient à l'état précédent (retenu faute d'objection).
5. **Compteur** « k / N emplacements » en tête de la fenêtre de choix, titre de l'en-tête « Choisir un souffle pour l'emplacement N » (retenu faute d'objection).
6. **Case du PDF** : nom du souffle seul, sans coût (retenu faute d'objection).
7. **Temps réel multi-appareil** : via le signal de la partie, câblage **à évaluer à l'implémentation** selon `docs/checklist.md` ; ce n'est pas un AC imposé (retenu faute d'objection).
8. **Ligne grisée** : se consulte, ne se place pas ; focalisable ; bouton principal visible en `aria-disabled` avec sa raison (revue, aligne DESIGN.md et EXPERIENCE.md).
9. **Bouton secondaire de la zone de détail** : « Annuler » (la planche contractuelle fait foi ; « Retirer » reste sur la ligne d'emplacement).
10. **Surface de la fenêtre de choix** (option A, décision utilisateur) : on **étend** le composant partagé `DetailSurface` de façon rétro-compatible — slots `header` (titre « Choisir un souffle pour l'emplacement N » + compteur « k / N emplacements ») et `footer` (zone de détail épinglée + « Mettre dans l'emplacement N » + « Annuler »), hauteur en `dvh` avec zone sûre, `max-height` propre de la zone de détail avec défilement, fermeture 44 px (« Fermer la fenêtre » / « Fermer la feuille »), largeur desktop adaptée. AC : utilisable à 320 × 256 CSS px. Conséquences de planification : §10, point 7.
11. **Annulation du dernier retrait** (option A, décision utilisateur) : toujours **sans dialogue de confirmation**, mais un bandeau « <Souffle> retiré de l'emplacement N. Annuler » reste affiché quelques secondes (durée : voir §5), annoncé dans la zone `role="status"` ; « Annuler » remet le souffle dans le même emplacement, disparaît si l'emplacement est entre-temps occupé, et un nouveau retrait remplace le message. Interaction avec « un seul enregistrement en vol » : voir §5.
