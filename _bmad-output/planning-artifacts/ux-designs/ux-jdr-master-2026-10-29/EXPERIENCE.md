---
title: "jdr-master Experience — Delta Palier 10.5 Jeux de société"
status: final
created: 2026-10-29
updated: 2026-10-29
design: DESIGN.md
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/EXPERIENCE.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/prd.md
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/.memlog.md
---

# jdr-master — Experience — Delta Palier 10.5 Jeux de société

**Ce document est un delta.** Il décrit comment fonctionnent les jeux de société du mode soirée après le Palier 10.5 (PRD `prd-jdr-master-2026-10-28-p10-5`, FR-1 à FR-10). Tout ce qu'il ne mentionne pas reste tel que le fixent le delta du Palier 10.4, celui du Palier 10 et le contrat du Palier 9. Les écarts aux écrans validés sont signalés ⚠️ et listés en §10. Rien de ce document ne s'affiche en mode JDR.

Vocabulaire : les termes du Glossaire du PRD (Jeu, Ludothèque, Participant, Jeux sur place, Jeu écarté, Apport, Envie, Jeux du groupe, Compteur d'hôte) sont des **mots de travail** ; l'interface emploie les libellés de §3.

**⚠️ Il amende le PRD sur un point**, décidé avec l'utilisateur le 2026-10-29 : sur une soirée, un jeu présent à plusieurs endroits **figure dans chaque section** où il se trouve, avec « ×N » et le nom des autres détenteurs, pour qu'ils puissent annuler ou se concerter (PRD FR-6 voulait une seule ligne par nom). Les Jeux du groupe gardent une ligne par jeu.

Planche des écrans retenus : [`mockups/planche-retenue.html`](mockups/planche-retenue.html). Les spines l'emportent sur elle.

## 1. Foundation

- **Form-factor** : web responsive, **téléphone d'abord** (on regarde les jeux en préparant sa soirée, souvent sur mobile) ; même contenu au-delà de 768 px.
- **UI system** : Angular Material 22. Surfaces existantes réutilisées : vue d'une rencontre isolée, `EventDialog` (détail d'une conjonction de groupe), vue d'un groupe, page du compte.
- **Identité visuelle** : `DESIGN.md` de ce dossier.

## 2. Information Architecture

### 2.1 Ce qui apparaît où

| Besoin (PRD) | Surface | Qui |
| --- | --- | --- |
| Gérer sa Ludothèque (FR-1) | **Page Ludothèque**, ouverte depuis le compte (§2.4) | chacun, pour la sienne |
| Voir les jeux sur place, apporter, écarter, Envie (FR-3 à FR-7) | **Onglet des jeux** d'une rencontre isolée ou d'une conjonction de groupe (§2.2, §2.3) | toute personne qui voit la conjonction ; actions selon le rôle |
| Jeux du groupe (FR-8) | **Onglet des jeux** du groupe (§2.5) | membres |
| Ludothèque d'une autre personne (FR-9) | **Feuille** ouverte en touchant son nom (§2.7) | qui partage un groupe ou une rencontre avec elle |
| Compteur d'hôte (FR-10) | Section « Qui reçoit » de l'onglet **Détails** du groupe (§2.6) | membres |

### 2.2 ⚠️ L'onglet des jeux d'une conjonction

- **Rencontre isolée** : un troisième onglet, après les deux existants : « Conjonction · Invités · **Reliques** » (côté hôte : « Conjonction · Invitations · Reliques »). Libellé de l'onglet suivi du compte de jeux sur place (« Reliques · 8 »).
- **Conjonction de groupe** : son détail est la fenêtre `EventDialog` (Palier 10, §2.6), faite de blocs sans onglets. Elle reçoit **deux onglets** en tête : « Conjonction » (les blocs existants, inscrits compris) et « Reliques · 8 ». Décidé avec l'utilisateur le 2026-10-29 (transposition de l'option 1B).

### 2.3 Contenu de l'onglet des jeux

De haut en bas :

1. **Résumé** (`GamesSummary`) : « {n} jeux sur place · {k} jouables à {N} », où **N = nombre actuel de Participants**, hôte compris (une place réservée pas encore acceptée ne compte pas) ; puis deux filtres : « Jouables à {N} » et « Les plus {appelées…} » (§3).
2. **Sections repliables** (`GamesSection`), dans cet ordre :

| Section | Contenu | Visible par |
| --- | --- | --- |
| **Chez {hôte}** (pour l'hôte : « Chez moi ») | Jeux de l'hôte, sauf les Jeux écartés | tous |
| **Apportées / Apportés à la veillée / Acheminés** | Apports de tous les Participants, les miens compris (« par **moi** · Je ne l'apporte plus ») | tous |
| **Dans mon cabinet / coffre / Sur mon râtelier** | Mes Jeux non apportés, chacun avec « J'apporte » ; « ⚠ déjà chez {nom} » s'il est déjà sur place | un Participant autre que l'hôte |
| **Scellées ce soir / Restés au logis / Hors service** | Jeux écartés, chacun avec « Remettre » ; mention « visible par vous seul·e / toi seul·e » | l'hôte seul |

- **Doublons** : un jeu présent dans deux provenances figure dans les deux sections, avec `DuplicatePill` « ×N » et la ligne « aussi chez {nom} » / « aussi apporté par {nom} » (tous les autres détenteurs). Le regroupement par nom ignore la casse et les accents (PRD FR-6).
- **Ordre dans une section** : alphabétique ; filtre « Les plus … » actif, par nombre d'Envies décroissant, puis alphabétique.
- **Aucune troncature** : une section montre tous ses jeux ; on la replie si elle est longue.
- Les sections sont **dépliées au départ** ; l'état replié est retenu dans ce navigateur, par section, comme le dock du Palier 10.4.
- **Les filtres** valent pour toutes les sections ; une section garde son en-tête, avec « · {k} sur {n} », même vide après filtrage.

### 2.4 ⚠️ La Ludothèque (page)

- **Entrée** : une ligne dans la page du compte (« Mon grimoire / Mon carnet / Mon établi »), **avant la zone sensible** : « Mon cabinet de reliques · {n} jeux › » et, dessous, à qui elle est visible.
- **Page** : titre du thème, sous-titre de visibilité ; **saisie en série** en tête (`QuickAddRow`) : nom, joueurs min et max, durée en minutes, « Ajouter ». Après l'ajout, les champs se vident et le focus revient au nom. Dessous, la liste alphabétique ; ✎ ouvre la même saisie sur la ligne, avec « Enregistrer » et « Retirer de mon cabinet ».
- **Retirer** un jeu : immédiat, avec un message « Jeu retiré · Annuler » pendant quelques secondes. Si le jeu est apporté à une soirée à venir, une confirmation le dit d'abord (« Ce jeu est apporté à 1 soirée à venir : il en sera retiré. »).
- **Route** : sous le compte (`/profile/...`), à fixer en architecture.

### 2.5 ⚠️ L'onglet des jeux du groupe

Les onglets du groupe deviennent « Conjonctions · **Reliques** · Détails · Missives ». Contenu : champ « Chercher un jeu… », puces « Jouable à : 2 · 4 · 6 · 8+ » (une seule active à la fois, re-toucher l'éteint), puis une ligne par jeu (nom, joueurs, durée, « chez {noms} »), alphabétique ; en pied, « {n} jeux chez {m} membres ». Pas d'action d'écriture ici.

### 2.6 ⚠️ « Qui reçoit » dans Détails

Section repliable de l'onglet **Détails** du groupe, au-dessus des réglages : une ligne par membre ayant reçu (`HostBars`, du plus au moins), puis « Jamais : {noms} ». Seuls comptent les événements passés et non annulés. Pas de classement, pas de mise en avant.

### 2.7 ⚠️ La Ludothèque d'une personne

Toucher un nom ouvre la feuille `LibrarySheet` : depuis un propriétaire dans une ligne de jeu, une pastille d'inscrit ou d'invité, un membre dans « Missives ». Lecture seule ; ligne sur le prêt (§3). Les pastilles et noms deviennent donc des boutons (aujourd'hui inertes).

## 3. Voice and Tone

Toute clé nouvelle a une voix par thème, ou entre dans `NEUTRAL_KEYS` avec sa raison. Un mot de thème n'appartient qu'à un thème (ex. « cercle » = le groupe en Forêt seulement). Le contenu dit « jeux » ; seul le titre prend le mot précieux du thème. Accords : *reliques* féminin ; *trésors*, *joyaux* masculins.

### 3.1 Libellés par thème (validés le 2026-10-29)

| Usage | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| Onglet (conjonction et groupe) | Reliques | Trésors | Joyaux |
| Ludothèque (page, entrée) | Mon cabinet de reliques | Mon coffre aux trésors | Mon râtelier |
| Section de ma Ludothèque | Dans mon cabinet | Dans mon coffre | Sur mon râtelier |
| Section des apports | Apportées | Apportés à la veillée | Acheminés |
| J'apporte | J'apporte | Je l'apporte | Je l'achemine |
| Ne plus l'apporter | Je ne l'apporte plus | Je ne l'apporte plus | Annuler l'acheminement |
| Envie (nom du bouton) | Cette relique m'appelle | J'ai envie d'y jouer | Je veux l'essayer |
| Compte d'envies | {n} appels | {n} envies | {n} demandes |
| Filtre par Envies | Les plus appelées | Les plus attendus | Les plus demandés |
| ⋮ Rendre indisponible | Sceller pour ce soir | Laisser au logis ce soir | Hors service ce soir |
| Section du bas (hôte) | Scellées ce soir | Restés au logis | Hors service |
| Remettre | Lever le sceau | Ressortir | Remettre en service |
| Qui reçoit | Qui ouvre sa porte | Qui accueille le cercle | Qui accueille l'équipage |
| Feuille d'une personne | Cabinet de {nom} | Coffre de {nom} | Râtelier de {nom} |
| Ligne sur le prêt | Pour emprunter un jeu, demandez-le à {nom}. | Pour emprunter un jeu, demande-le à {nom}. | Pour un prêt, adressez-vous à {nom}. |

### 3.2 Textes complémentaires (dérivés du tableau validé, acceptés le 2026-10-29)

| Usage | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| Visibilité (page, entrée) | Visible par les membres de vos groupes et les invités de vos conjonctions. | Visible par tes cercles et les invités de tes haltes. | Visible par vos équipages et les invités de vos réunions. |
| Mention de la section du bas | visible par vous seul·e | visible par toi seul·e | visible par vous seul·e |
| Aucun jeu sur place | Aucune relique sur place pour l'instant. | Aucun trésor sur place pour l'instant. | Aucun joyau sur place pour l'instant. |
| Lien discret (FR-2) | Remplir mon cabinet | Remplir mon coffre | Garnir mon râtelier |
| Ma Ludothèque vide (section) | Votre cabinet est vide. | Ton coffre est vide. | Votre râtelier est vide. |
| Groupe sans jeu | Personne n'a encore rempli son cabinet. | Personne n'a encore rempli son coffre. | Personne n'a encore garni son râtelier. |
| Nom en double (refus) | Ce jeu est déjà dans votre cabinet. | Ce jeu est déjà dans ton coffre. | Ce jeu est déjà sur votre râtelier. |
| Retiré (message) | Jeu retiré · Annuler | Jeu retiré · Annuler | Jeu retiré · Annuler |

### 3.3 Neutres (`NEUTRAL_KEYS`)

« Chez {hôte} », « Chez moi », « {n} jeux sur place · {k} jouables à {N} », « Jouables à {N} », « Jouable à : », « {min}–{max} joueurs · {d} min » (avec ses formes partielles), « ×{n} », « aussi apporté par {noms} », « aussi chez {noms} », « ⚠ déjà chez {nom} », « par moi », « par {nom} », « {n} fois », « Jamais : {noms} », « {n} jeux chez {m} membres », « Chercher un jeu… », « Seul le nom est obligatoire. », libellés des champs (Nom, Joueurs, à, Durée en minutes), « Ajouter », « Jeu retiré · Annuler ». Raison : mesure, provenance ou saisie, volontairement hors thème.

## 4. Component Patterns

| Composant | Comportement |
| --- | --- |
| `GamesSummary` | Se met à jour en direct (compte, N). Filtres : puces à bascule (`aria-pressed`), cumulables. |
| `GamesSection` | En-tête bouton (`aria-expanded`) ; replier garde le compte. État retenu dans ce navigateur. |
| `GameRow` | Ligne non cliquable en soi ; ses cibles : ♥, ⋮ (hôte, ses jeux), « J'apporte » / « Je ne l'apporte plus », noms (`OwnerLink`). |
| `EnvyToggle` | Bascule (`aria-pressed`) ; active ou retire mon Envie ; le compte suit. Toucher le compte (« ♥ 3 ») ouvre la liste des noms dans un petit menu. |
| Menu ⋮ (hôte) | Une seule entrée : « Sceller pour ce soir » (selon le thème). Le jeu passe aussitôt dans la section du bas. |
| `UnavailableRow` | « Remettre » le rend aussitôt à « Chez moi », pour tous. |
| `OwnerLink` | Bouton ; ouvre `LibrarySheet` de la personne. |
| `LibrarySheet` | Tiroir modal (celui de `DestinyList`) ; `Échap`, fond assombri ou glisser vers le bas ferment ; focus rendu au nom touché. |
| `QuickAddRow` | `Entrée` dans n'importe quel champ ajoute ; nom vide : bouton inactif ; max < min : message sous le champ. |
| `HostBars` | Lecture seule ; section repliable. |

## 5. State Patterns

### 5.1 Onglet des jeux d'une conjonction

| État | Ce qu'on voit |
| --- | --- |
| Aucun jeu sur place | Résumé « 0 jeu sur place » ; texte « Aucune relique sur place pour l'instant. » ; pour un Participant : section « Dans mon cabinet » (ou, si elle est vide, « Votre cabinet est vide. » + « Remplir mon cabinet ») |
| Je ne suis pas Participant (membre non inscrit, place réservée pas encore acceptée, invité qui a décliné) | Jeux sur place en lecture ; ni ♥, ni « Dans mon … » |
| Je suis Participant, hôte | « Chez moi » avec ⋮, « Apportées », section du bas s'il y a des Jeux écartés |
| Soirée passée, terminée ou annulée | ⚠️ **Pas d'onglet des jeux** : rien n'est conservé ni affiché (architecture du 2026-10-29, AD-5). Dans `EventDialog`, la fenêtre revient à ses blocs sans onglets |
| Un jeu sans nombre de joueurs | Jamais « jouable à N » ; exclu par le filtre « Jouables à N » |

### 5.2 Ludothèque

Vide : la saisie en série seule, avec « Seul le nom est obligatoire. » ; pas de texte qui pousse à la remplir. Erreur serveur à l'ajout : message sous la saisie, champs conservés.

### 5.3 En direct

L'onglet des jeux suit le signal de changement de la partie (Apport, Envie, Jeu écarté, inscription, Ludothèque modifiée d'un Participant). Quand N change, le résumé et les pastilles « jouable à N » se recalculent **sans bandeau** ; si le filtre « Jouables à N » est actif, son libellé change aussi. (la planche en montrait un pour illustrer) Un jeu que je viens de toucher et qui disparaît (écarté par l'hôte, retiré par son propriétaire) : son action échoue sans erreur bloquante, la liste se met à jour.

## 6. Interaction Primitives

- Aucun geste nouveau : boutons, menus et tiroirs existants. Pas de glisser pour apporter ou écarter.
- « J'apporte » et « Je ne l'apporte plus » agissent **sans confirmation** ; le jeu change de section aussitôt.
- Le ⋮ de l'hôte n'existe que sur ses propres jeux, et seulement sur une soirée à venir.

## 7. Accessibility Floor

- En-têtes de section : boutons avec `aria-expanded` ; leur nom accessible inclut le compte (« Apportées, 2 jeux »).
- ♥ : bouton `aria-pressed`, nom « {libellé d'Envie} — {jeu}, {n} {appels|envies|demandes} ».
- « jouable à N », « ×N » et « déjà chez » sont du **texte**, lus avec la ligne ; jamais seulement une couleur.
- Quand N change, une annonce polie (`aria-live`) : « 7 participants : 4 jeux jouables à 7. »
- `LibrarySheet` piège le focus et le rend au nom touché ; `Échap` ferme.
- Cibles de 44 px (♥, ⋮, J'apporte, Remettre, en-têtes, noms).
- Champs de la saisie nommés ; erreurs reliées par `aria-describedby`.

## 8. Key Flows

Mêmes protagonistes que le PRD.

1. **UJ-1 — Léa, hôte, montre ses jeux sans rien faire de plus.** Elle ouvre sa conjonction, onglet « Reliques · 8 » : ses jeux sont dans « Chez moi ». ⋮ sur *Dixit* → « Sceller pour ce soir » ; *Dixit* passe en bas, dans « Scellées ce soir ». **Climax** : le résumé dit « 5 jouables à 6 ».
2. **UJ-2 — Tom n'apporte pas un doublon.** Onglet « Reliques » de la conjonction : dans « Dans mon cabinet », *Terraforming Mars* porte « ⚠ déjà chez Léa ». Il touche « J'apporte » sur *Skull*, qui monte dans « Apportées » (« par moi »). **Climax** : il voit aussi *Codenames* ×2 (« par Zoé · aussi chez Léa ») et le signale à Zoé. **Cas limite** : il se désinscrit ; *Skull* quitte la liste.
3. **UJ-3 — Sam signale une Envie puis monte une soirée.** ♥ sur *Skull* (« ♥ 3 »). Plus tard, groupe, onglet « Reliques », recherche « Cascadia » : « chez Karim ». Il touche Karim : la feuille « Cabinet de Karim ». **Climax** : il propose une conjonction et demande à Karim, hors de l'appli, d'apporter le jeu.

## 9. Responsive & Platform

| Largeur | Onglet des jeux | Feuille d'une personne | Page Ludothèque |
| --- | --- | --- | --- |
| < 768 px | pleine largeur | tiroir du bas | pleine largeur |
| ≥ 768 px | colonne de 640 px au plus | tiroir modal (menu ancré non retenu : une liste peut être longue) | colonne de 640 px au plus |

À vérifier : les quatre onglets du groupe à 360 px avec le libellé le plus long de chaque thème (« Conjonctions », « Haltes », « Réunions » + « Reliques / Trésors / Joyaux » + « Détails » + « Missives »).

## 10. ⚠️ Écarts aux écrans validés

1. **Vue d'une rencontre isolée** (Palier 10 §2.5) : un 3ᵉ onglet, « Reliques / Trésors / Joyaux ».
2. **`EventDialog`** (Palier 10 §2.6) : passe de blocs sans onglets à deux onglets, « Conjonction » et l'onglet des jeux.
3. **Vue d'un groupe** (Palier 10 §2.4) : un 4ᵉ onglet, inséré après « Conjonctions ».
4. **Onglet Détails du groupe** : nouvelle section « Qui reçoit ».
5. **Page du compte** : une ligne vers la Ludothèque, avant la zone sensible.
6. **Pastilles d'inscrits et d'invités, lignes de Missives** : deviennent des boutons qui ouvrent la Ludothèque de la personne.
7. **PRD FR-6** : un jeu présent à plusieurs endroits d'une soirée figure dans chaque section (×N), au lieu d'une ligne unique.

## 11. Open Items

Hypothèses du brouillon acceptées par l'utilisateur le 2026-10-29 (couleur de l'Envie, pas de bandeau, retrait avec « Annuler », textes de §3.2, organisation de l'onglet, colonne de 640 px).

**Couverture des planches** : onglet des jeux (invité, filtre, hôte), page Ludothèque et son entrée, onglets « Reliques » et « Détails » du groupe, feuille d'une personne → [`mockups/planche-retenue.html`](mockups/planche-retenue.html). **Spines seules** : la fenêtre `EventDialog` à deux onglets et la barre d'onglets de la rencontre isolée (simple ajout d'un onglet), les états vides et figés.

- **À vérifier à l'implémentation** : la largeur des quatre onglets du groupe à 360 px (§9) ; le contraste de `{colors.accent-2}` en texte (Envie active) dans les trois thèmes (≥ 4,5:1).
