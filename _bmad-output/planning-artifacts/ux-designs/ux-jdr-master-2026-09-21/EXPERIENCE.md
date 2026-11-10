---
title: jdr-master Experience — Delta Point d'entrée de la création de personnage (FR-58 à FR-60)
status: final
updated: 2026-09-21
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-20.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/mockups/key-partie-detail-navigation-contextuelle.html"
---

# jdr-master — Experience — Delta Point d'entrée de la création

Ce document décrit **comment ça marche** ; [`DESIGN.md`](DESIGN.md) décrit **comment ça se voit** (tokens cités en `{path.to.token}`). En cas de conflit avec une planche, **ce document gagne**. Planche contractuelle : [`mockups/contrat-ui-entree-creation.html`](mockups/contrat-ui-entree-creation.html).

> ## ⚠️ Ce que cette planche engage
> Tout ce qui y est dessiné sera implémenté ; rien n'y figure pour embellir. Toute spécification ultérieure qui la modifie le signale par ⚠️, en disant ce qui change et pourquoi.

> ## ⚠️ Ce que ce delta amende dans le contrat du Palier 9 (`ux-jdr-master-2026-08-04`)
> 1. **L'onglet Détails d'une partie** (planche `key-partie-detail-navigation-contextuelle.html`) gagne, pour le joueur sans personnage, un bloc d'invitation en tête. Le reste de l'onglet ne bouge pas.
> 2. **L'écran Personnages** gagne un **bloc distinct** au-dessus de la barre de contrôles. Le contrat disait que la liste des personnages « réutilise exactement la grammaire de la liste des parties — le même écran avec un autre contenu » ; **cela reste vrai de la liste**, dont la grammaire (modes, tri, recherche, pastille) n'est pas modifiée. Le bloc n'est pas la liste.
> 3. **Le message de liste vide** (`my_characters.empty`) est remplacé par une variante quand la section de création est affichée (§3).

## 1. Foundation

- **Surface** : l'application web existante, mobile-first pour les joueurs, desktop pris en charge. Deux écrans concernés : le **détail d'une partie** (onglet Détails) et **Personnages**.
- **Système d'UI** : Angular Material 22 ; identité visuelle héritée, **inchangée**.
- **Périmètre** : le **point d'entrée** de la création. Ni le parcours (31.4), ni le formulaire de l'Homme Dragon (33.3), ni la fiche Homme Dragon (33.1).

## 2. Information Architecture

| Écran | Avant | Après |
| --- | --- | --- |
| Détail d'une partie, onglet Détails | description, séance, troupe (mobile) | **+ bloc d'invitation en tête** pour le joueur sans personnage |
| Détail d'une partie, onglet Ma fiche (mobile) | état vide avec bouton | inchangé ; **même libellé** de bouton que le bloc |
| Détail d'une partie, rail du roster (desktop) | seul point d'entrée : slot d'initiale | **le slot reste** ; libellé accessible et infobulle ajoutés |
| Personnages | barre de contrôles + liste de mes personnages | **+ section de création** au-dessus de la barre ; **+ Hommes Dragons dans la liste** |

**Hors écran :** rien n'est ajouté à la navigation principale (quatre destinations, FR-48). L'écran de l'Homme Dragon (onglet de la partie, côté MJ) garde son propre bouton de création.

## 3. Voice and Tone

Registre thématique de la base : chaque libellé existe **dans les trois blocs de thème** (aucun texte de règle n'y entre). Le bouton **réutilise `character.create_cta`**, déjà thématisé ; la formule générique « Créer mon personnage » du brouillon d'AC n'est pas la copie définitive.

**Vocabulaire des thèmes** : Grimoire — quête · voyageur ; Forêt — sentier · compagnon de route ; Atelier — mission · automate.

| Clé | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| `character.create_cta` *(existante)* | Créer un voyageur | Éveiller un compagnon de route | Assembler un automate-voyageur |
| `character.callout_title` | Votre voyageur reste à forger | Votre compagnon de route reste à éveiller | Votre automate reste à assembler |
| `character.callout_hint` | Quelques étapes, et vous rejoignez la table. | Quelques étapes, et vous marchez avec le groupe. | Quelques étapes, et vous rejoignez l’équipe. |
| `my_characters.create_title` | À forger | À éveiller | À assembler |
| `my_characters.create_entry` | Créer un voyageur pour {partie} | Éveiller un compagnon de route pour {partie} | Assembler un automate-voyageur pour {partie} |
| `my_characters.create_entry_dragon` | Créer un Homme Dragon pour {partie} | Éveiller un Homme Dragon pour {partie} | Assembler un Homme Dragon pour {partie} |
| `my_characters.create_more` | Voir les {n} autres | Voir les {n} autres | Voir les {n} autres |
| `my_characters.create_less` | Voir moins | Voir moins | Voir moins |
| `my_characters.empty_with_entries` | Nul voyageur forgé pour l’instant. | Aucun compagnon éveillé pour l’instant. | Aucun automate assemblé pour l’instant. |
| `character.nature_dragon` | Homme Dragon | Homme Dragon | Homme Dragon |
| `roster.create_slot_label` | Créer un voyageur | Éveiller un compagnon de route | Assembler un automate-voyageur |

> Le ton des sous-textes, du titre de section et du message de liste vide a été **validé le 2026-09-21**. Les guillemets typographiques (’) sont **obligatoires** dans `tones.ts` (une apostrophe droite y casse la compilation — déjà arrivé) ; la parité des trois blocs reste testée.
>
> **Le mot « Homme Dragon » ne se thématise pas** : c'est un nom propre du système, identique dans les trois thèmes.

## 4. Component Patterns

### 4.1 Le prédicat de création — une règle, écrite une fois

« Puis-je créer un personnage sur cette partie ? » est vrai **si et seulement si** : je ne suis **pas MJ** de la partie · je n'y ai **aucun personnage** · son système de jeu **dispose d'un module** (FR-60) · la partie n'est **pas terminée**. Le bloc d'invitation (partie) et les lignes « à créer » (Personnages) lisent **le même prédicat** et la même micro-copie. Quand il est faux, **rien** n'est rendu — jamais un bouton mort, jamais un refus.

Pour un **MJ** : aucune entrée de personnage joueur. Son entrée est celle de l'**Homme Dragon** (§4.3), une par aventure Ryuutama où il n'en a pas encore. *(L'API l'autoriserait ; c'est un choix produit de ne pas l'exposer.)*

### 4.2 CharacterCallout — le bloc d'invitation de la partie *(FR-58, story 29.15)*

- **Où** : en **tête de l'onglet Détails**, avant la description — l'onglet par défaut, donc visible à l'ouverture, **sans changer d'onglet ni défiler**, sur téléphone comme sur ordinateur.
- **Quoi** : pastille « + », titre (`character.callout_title`), sous-texte (`character.callout_hint`), bouton (`character.create_cta`) qui ouvre le wizard de cette partie (`/parties/:id/characters/new`, système en paramètre — comportement inchangé).
- **Disposition** : empilé sur mobile (bouton pleine largeur), en ligne sur desktop.
- **Non fermable.** Il n'y a pas de croix : il disparaît de lui-même dès que le personnage existe. Une entrée de création qu'on peut écarter serait une entrée qu'on peut perdre.
- **Le slot du rail (desktop)** conserve son comportement. Il gagne un libellé accessible et une infobulle (`roster.create_slot_label`, le même texte que le bouton). C'est un **raccourci**, plus l'unique porte.
- **L'onglet Ma fiche (mobile)** garde son état vide et son bouton, avec le **même libellé**. *[ASSUMPTION]* Son texte d'état vide, aujourd'hui écrit en dur dans le gabarit, passe par la micro-copie de thème (dette, Q-4).

### 4.3 CreateEntriesSection — la section de création de « Personnages » *(FR-58, story 29.16 ; FR-59, story 33.5)*

- **Où** : **au-dessus** de la barre de contrôles, dans le flux — ni collante, ni prise dans le masquage au défilement de la barre. Elle défile avec la page.
- **Quoi** : un titre (`my_characters.create_title`) et **une ligne par partie éligible** :
  - « Créer un voyageur pour *{partie}* » — partie où je suis joueur et le prédicat (§4.1) est vrai ;
  - « Créer un Homme Dragon pour *{partie}* » — partie Ryuutama dont je suis MJ et où je n'ai pas encore d'Homme Dragon (**un par aventure**).
- **Ordre** : l'ordre par défaut de la liste des parties, en **une seule pile**, sans sous-groupes. *[ASSUMPTION]* Le verbe et le mot suffisent à distinguer voyageur et Homme Dragon.
- **Densité** : **trois lignes visibles**, puis « Voir les N autres » / « Voir moins ». Sur desktop, une grille de colonnes de 300 px minimum.
- **Cible** : chaque ligne est un lien complet, atteignable au clavier, **≥ 44 px** (56 px au repos). Elle mène au wizard de la partie, ou au parcours de création de l'Homme Dragon.
- **Indépendante de la liste** : la recherche, le tri, le mode d'affichage et la pastille de résumé de la barre **ne la masquent ni ne la réordonnent**. La section ne contient **jamais** de carte de personnage ; la liste ne contient toujours que **mes** éléments.
- **Jamais vide** : sans ligne, ni titre ni cadre.

### 4.4 Les Hommes Dragons dans la liste *(FR-59, story 33.5)*

- Même carte que les personnages, avec le **marqueur de nature** `NatureMarker` : icône + « Homme Dragon » en moyen et grand ; icône seule + `aria-label` « Homme Dragon » en mode liste compact.
- Le champ « partie » de la carte donne la partie d'origine, comme pour un personnage.
- **Recherche, tri, mode** s'y appliquent comme aux personnages. Au tri « Niveau », qu'il n'a pas, l'Homme Dragon passe **en dernier** *[ASSUMPTION]*. Son nom passe par `IdentityLabel` (convention de l'épic 28).
- **Jamais chez les joueurs** : l'Homme Dragon d'un MJ ne figure pas dans « Personnages » des autres membres.
- Ouvrir sa fiche : la forme (route propre ou navigation vers l'onglet de la partie) est laissée à la story 33.5 — la fiche n'a pas de route aujourd'hui.

## 5. State Patterns

| État | Ce que voit l'utilisateur |
| --- | --- |
| Joueur, partie éligible, sans personnage | Bloc d'invitation sur la partie ; une ligne dans Personnages |
| Joueur avec personnage sur cette partie | **Aucun** bloc, aucune ligne — jamais un refus « vous avez déjà un personnage » |
| Partie sans module (Draconis, etc.) | Aucun bloc, aucune ligne. Le wizard, s'il est atteint par une adresse directe, affiche son message explicite (correctif séparé) |
| MJ | Aucun bloc joueur ; ligne « Créer un Homme Dragon » dans Personnages pour chaque aventure Ryuutama sans Homme Dragon |
| Aucune ligne éligible | La section **n'est pas rendue** |
| Aucun personnage, au moins une ligne | Message de liste vide **`my_characters.empty_with_entries`** — il ne renvoie plus à « depuis une quête… », l'entrée est déjà au-dessus |
| Aucun personnage, aucune ligne | Message d'origine `my_characters.empty`, inchangé |
| Retour du wizard après création | La ligne de cette partie a disparu ; le personnage figure dans la liste ; le bloc a disparu de la partie |
| Chargement | *[ASSUMPTION]* la section **n'apparaît pas tant que ses données ne sont pas là** : pas de squelette, pour ne pas la faire sauter à l'arrivée |

**Temps réel** : la section dépend de « ai-je un personnage sur cette partie ? », qui change à la création. Câblage sur le canal `user:{id}` à évaluer à la création des stories (`docs/checklist.md`) ; le minimum requis est le **rafraîchissement au retour de navigation**.

## 6. Interaction Primitives

- Une ligne « à créer » et le bouton du bloc sont de **vrais liens** (`routerLink`), pas des boutons qui naviguent.
- **Voir les N autres** est un bouton de divulgation (`aria-expanded`), pas un lien.
- Aucun geste au glissement, aucune fermeture, aucune confirmation : l'invitation mène directement au parcours.

## 7. Accessibility Floor

Le plancher de la base et du Palier 9 s'applique (cible 44 px en valeur de conception ; jamais la couleur seule ; `aria-label` explicite sur toute icône porteuse de sens).

- Le bloc est une **région nommée** par son titre (`aria-labelledby`) ; la section de création est une `<section>` titrée par son `h2`, contenant une **liste de liens**.
- Le **nom accessible d'une ligne est son libellé complet**, partie comprise : « Créer un voyageur pour Le Convoi du Nord » — pas « Créer ».
- Le marqueur de nature double toujours un mot ou un `aria-label` ; jamais une couleur.
- Après création, le retour vers l'écran d'origine suit le comportement de navigation existant ; aucun focus n'est à piéger.

## 8. Responsive & Platform

Seuil desktop inchangé : **1024 px**.

| | Mobile | Desktop |
| --- | --- | --- |
| Bloc d'invitation | empilé, bouton pleine largeur | en ligne, bouton à droite |
| Section de création | une colonne, lignes pleine largeur | grille `minmax(300px, 1fr)` |
| Rail du roster | absent (l'onglet Ma fiche tient ce rôle) | présent, slot conservé |

## 9. Key Flows

### Camille rejoint la campagne de son frère, dans le train

Camille clique sur le lien d'invitation, s'inscrit, et arrive sur *Le Convoi du Nord*. Sur son téléphone, l'onglet **Détails** s'ouvre : en tête, « Votre voyageur reste à forger » et un gros bouton **Créer un voyageur**. Elle n'a rien à chercher. Elle appuie ; le wizard s'ouvre. *Climax : dix secondes après son arrivée, elle sait où appuyer.*

### Incon, MJ de deux aventures Ryuutama, retrouve ses dragons

Incon ouvre **Personnages** un dimanche soir. Sous « À forger », deux lignes : « Créer un Homme Dragon pour *Le Convoi du Nord* » et « … pour *Le Ballet des Braises* ». Il appuie sur la première, crée son dragon. Au retour, la ligne a disparu, et **Skarn — Homme Dragon** figure dans la liste, à côté de la voyageuse qu'il joue ailleurs. *Climax : au retour, la ligne a disparu et Skarn est dans la liste.*

### Marc rejoint une partie Draconis existante

Marc ouvre une partie créée avant FR-60 sur un système sans module. Aucun bouton, aucune ligne : la partie reste consultable, rien ne promet ce qu'on ne peut pas tenir. *Climax : l'absence même de bouton.*

## 10. Inspiration & Anti-patterns

- **À éviter** : une entrée de création déguisée en carte de personnage ; un bouton « Créer » qui mène à une erreur ; une invitation qu'on ferme et qu'on ne retrouve plus ; un bloc qui saute à l'arrivée des données ; une liste vide qui renvoie ailleurs alors que l'entrée est déjà là.

## 11. Questions ouvertes et hypothèses

Hypothèses **validées par l'utilisateur le 2026-09-21** (Q-2 tranchée, les autres retenues par défaut). Aucune ne bloque la création des stories.

| # | Point | Défaut retenu |
| --- | --- | --- |
| Q-1 | Le libellé du bouton reprend `character.create_cta` (thématisé) plutôt que « Créer mon personnage » | Repris — à valider |
| Q-2 | **Partie terminée** : le serveur n'interdit pas la création. | **Tranché le 2026-09-21 : non offerte.** Reporté dans FR-58 (PRD) et la story 29.15 (`epics.md`) |
| Q-3 | Ordre et regroupement des lignes de la section | Ordre des parties, une seule pile, sans sous-groupes |
| Q-4 | Le texte d'état vide de l'onglet Ma fiche est codé en dur | À faire passer par la micro-copie de thème, dans la story 29.15 |
| Q-5 | Tri « Niveau » avec un Homme Dragon (sans niveau) | Dernier |
| Q-6 | Ton du sous-texte, du titre de section (« À forger ») et du message de liste vide | Proposé ci-dessus — à valider |
