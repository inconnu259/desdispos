---
title: jdr-master Experience — Delta Wizard de création de personnage (Story 31.4)
status: final
updated: 2026-09-20
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/mockups/key-creation-desktop.html"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/mockups/key-creation-mobile.html"
  - "_bmad-output/implementation-artifacts/31-4-refonte-du-parcours-de-creation-de-personnage.md"
---

# jdr-master — Experience — Delta Wizard de création (31.4)

Ce document décrit **comment ça marche** ; [`DESIGN.md`](DESIGN.md) décrit **comment ça se voit** (tokens cités en `{path.to.token}`). En cas de conflit avec une planche, **ce document gagne**. Planche contractuelle : [`mockups/contrat-ui-wizard-creation.html`](mockups/contrat-ui-wizard-creation.html).

> ## ⚠️ Ce que cette planche engage
> Tout ce qui y est dessiné sera implémenté ; rien n'y figure pour embellir. Toute spécification ultérieure qui la modifie le signale par ⚠️, en disant ce qui change et pourquoi.

## 1. Foundation

- **Surface** : l'application web existante, mobile-first pour les joueurs (60-80 % d'usage sur téléphone, estimation de l'utilisateur), desktop pris en charge. Le wizard de création est **un parcours de joueur**.
- **Système d'UI** : Angular Material 22 ; identité visuelle héritée, **inchangée**.
- **Périmètre** : la refonte de mise en forme et d'interaction de quatre zones — les cartes de choix, le corps de la surface de détail, l'étape Attributs, l'étape Équipement.

### Contraintes d'invariance (reprises de la story 31.4)

Ce ne sont pas des choix de design mais des bornes que le design respecte :

1. **Neuf étapes, mêmes clés, même ordre**, `magic` conditionnelle à `typeId = magie`. La liste vient du schéma serveur ; ce delta ne la touche pas.
2. **Le personnage produit est identique** à celui de l'ancien parcours, pour les mêmes choix. Seule la présentation change.
3. **Front uniquement.** Aucun texte n'est créé, aucun catalogue enrichi : tout provient du catalogue seedé.
4. **Une seule surface flottante** : la `DetailSurface` existante.

## 2. Information Architecture

Inchangée : le parcours reste une suite linéaire d'étapes avec « Précédent / Suivant », en-tête d'étape, barre de progression et panneau récapitulatif (desktop). Ce qui change, c'est **ce que chaque étape montre avant tout geste** :

| Étape | Avant le geste | Sur demande (surface de détail) |
| --- | --- | --- |
| Classe | nom + description courte par carte | description complète de la classe ; chaque talent et option de classe |
| Type | idem | description complète ; chaque avantage |
| Attributs | profils avec leurs valeurs ; pool de puces | — |
| Équipement | catalogue regroupé, budget, recherche | texte d'effet d'un objet |
| Magie, Arme, Fétiche, Narratif, Portrait | inchangé | inchangé |

## 3. Voice and Tone

Ton de la base (léger, JDR) ; micro-copies nouvelles. Elles s'ajoutent au registre de thèmes **dans les trois blocs** (aucun texte de règle Ryuutama n'y entre).

| Contexte | Formulation |
| --- | --- |
| Divulgation du récit (replié / déployé) | « Lire le récit » / « Masquer le récit » |
| Champ de recherche d'équipement | « Rechercher un objet… » |
| Recherche sans résultat | [ASSUMPTION] « Aucun objet ne répond à cet appel… » — à valider, ton JDR de la base |
| Budget | « Budget · 320 / 1000 Po » ; dépassement : « — dépassement de N Po » |
| Compteur de puce (lecteur d'écran) | « 6, encore 2 à placer » |

## 4. Component Patterns

### ChoiceCard (sous-titre)
Sélectionner une carte **ne change pas** : radio, un seul choix, navigation aux flèches. Le sous-titre est décoratif pour le choix et lu par le lecteur d'écran comme description associée. **Aucun bouton n'est imbriqué dans la carte** (piège de la 31.3 : il volerait le clic ou casserait la navigation du radiogroup).

### Carte déployée (classe, type) — piste B
Sélectionner une carte la **déploie en place** (elle prend la largeur de la grille et porte son détail) ; **re-toucher la carte déployée la désélectionne** — elle se referme, « Suivant » se re-bloque, spécialité et choix obligatoires sont effacés. Le bouton « Voir le détail de… » **n'existe pas** (décision de l'utilisateur, 2026-09-20 : le détail est affiché directement).
- **Structure d'accessibilité** : la grille est un `radiogroup` ; l'en-tête de la carte déployée reste un `role="radio"` (`aria-checked="true"`), le détail est un **groupe voisin** (`role="group"`, nom = libellé de la classe). **Aucun contrôle n'est imbriqué dans un bouton radio.** La navigation aux flèches parcourt toujours les radios.
- **Choix obligatoires toujours visibles** dans la carte déployée, jamais repliés avec la référence.
- **« Occupations et actions »** : divulgation (`aria-expanded`), **repliée à chaque nouvelle sélection**.
- **Description de catégorie d'arme et de sort rituel** : derrière la surface de détail (pastille ⓘ / bouton ⓘ voisin de la ligne, jamais dans le `<label>` d'une case).

### DetailSurface (corps structuré)
Ouverture, fermeture (croix, `Échap`, voile) et retour du focus : conservés (31.2 / 31.3). **⚠️ Amendés** : sur desktop la surface est une **fenêtre centrée modale** (voile, `aria-modal`, piège de focus, clic sur le voile ferme) au lieu d'un panneau latéral non modal ; il n'y a plus de « remplacement en place » d'un terme par un autre (le voile recouvre les déclencheurs, sur desktop comme sur mobile) : on ferme, puis on active le suivant. Nouveau : le corps suit la structure titre → tableau → récit (DESIGN §7.2). Une ligne de tableau sans donnée n'est pas rendue ; une surface sans tableau ni récit n'est pas proposée (règle « pas de texte ⇒ pas d'aide »).

### Divulgation du récit (mobile uniquement)
Bascule ouvert/replié, cible 44 px, contrôle natif de type bouton portant `aria-expanded`. **L'état replié est le défaut à chaque ouverture** de la surface, : l'ouverture d'un autre terme ne hérite pas de l'état du précédent.

### WizardSummary (colonne de droite / feuille « Récap »)
- **Purement informatif** : rien de ce qu'il affiche ne se modifie ici, **sauf le Panier** (« Retirer » supprime une ligne entière ; les quantités se règlent dans le catalogue).
- **Se remplit au fil des étapes** ; une donnée non renseignée n'affiche **aucune ligne**. Le titre suit le nom saisi.
- **Mobile** : bouton « Récap » dans le bandeau collant (pastille = nombre d'exemplaires d'équipement) ; ouvre la feuille ; `Échap` / Fermer / voile la ferment et **le focus revient au bouton**.
- **Desktop** : colonne visible en permanence ; **aucune** barre de « Récap ».

### AttributePool
- Activer une puce dans une rangée **assigne** cette valeur à l'attribut ; réactiver la puce sélectionnée de la même rangée **la retire** (bascule, comportement actuel conservé).
- Activer une valeur déjà sélectionnée dans une **autre** rangée : impossible tant que son compteur est à zéro (puce épuisée, non activable).
- **Changer de profil** efface toute l'assignation (comportement actuel conservé).
- « Suivant » n'est activable que lorsque les quatre attributs sont assignés (inchangé).

### EquipmentCatalog
- Ajouter incrémente la quantité ; retirer la décrémente (comportement actuel). Sur la ligne : **« Ajouter » → compteur − ×n +** ; « − » à ×1 retire l'objet.
- **Groupes repliables** (titre-bouton, nombre d'objets, `aria-expanded`), déployés par défaut ; **recherche ou « Ma sélection » ⇒ tout est déplié**.
- **Filtre « Tout » / « Ma sélection · n »** (`aria-pressed`).
- Le **Panier a quitté l'étape** : voir WizardSummary.
- La recherche filtre à la frappe, sans validation ; vider le champ rétablit tous les groupes.
- Changer de mode (pré-fait / achat libre) réinitialise la sélection (comportement actuel) **et** vide la recherche.

## 5. State Patterns

| Surface | Vide / sans donnée | Chargement | Erreur / limite |
| --- | --- | --- | --- |
| Carte sans texte source | compacte, sans sous-titre | — | — |
| Surface de détail | non proposée | — | — |
| Catalogue, recherche sans résultat | message de §3, groupes masqués | — | — |
| Budget dépassé | — | — | jauge en `status-unavailable` **et** texte de dépassement ; « Suivant » reste bloqué (comportement actuel) |
| Pool d'attributs, profil non choisi | aucune rangée affichée (inchangé) | — | — |

## 6. Interaction Primitives

Toucher / clic pour activer ; flèches pour parcourir un radiogroup ; `Échap` ferme la surface de détail ; le voile la ferme (mobile et desktop). **Aucun geste de glissement** : le glisser-déposer des attributs a été étudié et **mis de côté** (voir §10).

## 7. Accessibility Floor

Le plancher de la base s'applique ; en complément :

- **Cibles ≥ 44 px** pour puces, lignes de catalogue, bascule de mode, divulgation.
- **Information jamais portée par la couleur seule** : jauge de budget (texte permanent + libellé de dépassement), puce épuisée (état non activable annoncé), compteur (texte lu).
- Le sous-titre de carte est relié à la carte par `aria-describedby` ; l'`aria-label` actuel, qui concatène nom et détail, ne doit pas dupliquer le sous-titre visible.
- Contraste du sous-titre 12 px : **à mesurer dans les trois thèmes** (DESIGN §2).
- Les groupes du catalogue sont des titres de section ; la recherche a une étiquette accessible.

## 8. Responsive & Platform

| | Téléphone (< 1024 px) | Desktop (≥ 1024 px) |
| --- | --- | --- |
| Surface de détail | feuille montante, **récit replié** | **fenêtre centrée modale**, tout déployé |
| Grille de cartes | 2 colonnes environ, sous-titre 2 lignes | plus de colonnes, même règle |
| Wizard | colonne unique, barre d'actions fixe | 65 / 35 avec panneau récapitulatif |

Aucun défilement horizontal, sur aucune étape, à 360 px de large.

## 9. Key Flows

### Camille crée sa première voyageuse, dans le train
Camille, joueuse débutante, n'a jamais ouvert le livre de règles. Téléphone en main, elle arrive à l'étape Classe.
1. Elle **parcourt les cartes** : chacune dit en une phrase ce qu'est la classe — elle repère « Artisan » sans rien ouvrir.
2. Elle touche la carte « Artisan » : elle **se déploie en place** — description, talents en pastilles, et, en évidence, la spécialité **obligatoire** à renseigner ; occupations et actions sont à un geste.
3. Elle touche la pastille du talent « Création » : la feuille monte, tableau d'abord, récit replié. Elle la ferme.
4. Elle hésite sur le sens de « Difficulté : variable », **déplie le récit**, comprend, ferme.
5. **Climax — l'étape Attributs.** Elle choisit le profil « Polyvalent ». Elle place un 6 sur Esprit : dans les trois autres rangées, la puce « 6 » affiche maintenant « ×1 » — **il n'y avait pas deux 6 à confondre**. Elle place le 8, le 4, puis le second 6 (le badge disparaît, la valeur est épuisée) : les quatre attributs sont remplis, « Suivant » s'allume.
6. À l'Équipement, elle tape « corde » dans la recherche, touche le nom de l'objet pour lire son effet, l'ajoute. La jauge affiche « Budget · 370 / 1000 Po ».

### Marc, MJ pressé, prépare le personnage de son fils sur ordinateur
Sur desktop, la surface de détail est une fenêtre centrée **entièrement déployée** : Marc lit tableau et récit d'un coup d'œil, sans bascule. Un `Échap` et il retrouve le wizard, le focus sur le terme qu'il consultait.

## 10. Inspiration & Anti-patterns

- **Écarté : glisser-déposer des valeurs d'attributs (C3).** Le plus séduisant visuellement, mais interaction neuve à concevoir pour le clavier, le lecteur d'écran et le tactile, et plus coûteuse à vérifier que l'équivalence stricte des données (AC3). **Gardé sous le coude** : à rouvrir comme story dédiée si l'AttributePool s'avère insuffisant à l'usage.
- **Écarté : sélecteurs déroulants par attribut (C2)** — zéro ambiguïté mais trop « formulaire » pour un choix qui est un petit jeu.
- **Anti-pattern à ne pas reproduire** : deux contrôles visuellement identiques qui représentent des choses distinctes (le défaut d'origine des attributs).

## 11. Questions ouvertes et hypothèses

- ~~Déclencheur de description complète~~ : **tranché le 2026-09-20** — supprimé, le détail est affiché directement (piste B).
- ~~Message de recherche sans résultat~~ : **accepté par l'utilisateur** (2026-09-20).
- **Shell du wizard** : le panneau récapitulatif est désormais spécifié (DESIGN §7.5) et le bandeau d'étape devient collant sous 1024 px avec le bouton « Récap ». **Hors planche** : les étapes Fétiche, Narratif et Portrait n'ont **pas** de mise en page dédiée ici — elles héritent des composants partagés amendés (ChoiceCard, DetailSurface). Le sentiment de « première version » du shell n'est pas traité par cette planche ; à examiner à l'écran pendant la vérification visuelle de l'implémentation, et à rouvrir ici si un défaut de fond apparaît.
- **Étape Magie** : la description de chaque sort passe derrière la surface de détail (bouton ⓘ) — décision de l'utilisateur en revue de code, 2026-09-20 ; le coût en PE reste sur la ligne.
- **⚠️ Amendement d'un acquis de la 31.2** : la surface de détail desktop devient modale (voir DESIGN §7.2). C'est une décision de l'utilisateur (2026-09-20) qui s'applique à toute l'application, fiche comprise ; elle touche donc du code déjà livré et revu — à porter par la story, avec ses tests.
- **⚠️ Deux écarts assumés** par rapport à l'arbitrage de la 31.3 : la description de classe/type **quitte** l'affichage en ligne (elle est remplacée par le sous-titre de carte, le complet passe par la surface) ; le texte `effect` des objets d'équipement, jamais affiché jusqu'ici, devient accessible.
