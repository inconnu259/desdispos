---
title: jdr-master Design System — Delta Point d'entrée de la création de personnage (FR-58 à FR-60)
status: final
updated: 2026-09-21
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-20.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
---

# jdr-master — Design System — Delta Point d'entrée de la création

Ce document est un **delta** : il n'ajoute **aucun token** (couleur, typographie, espacement, rayon, élévation). Le sujet n'est pas l'identité visuelle, validée, mais **l'endroit où l'on entre dans la création d'un personnage** : sur l'écran d'une partie, et dans « Personnages ». Le wizard de création lui-même relève de `ux-jdr-master-2026-08-31`, qui n'est pas touché.

En cas de conflit avec une planche de `.working/`, **ce document gagne**. La planche contractuelle est [`mockups/contrat-ui-entree-creation.html`](mockups/contrat-ui-entree-creation.html).

> ## ⚠️ Règle de travail héritée
> Toute spécification écrite ensuite — story, critère d'acceptation, décision d'implémentation — qui **modifierait** la planche contractuelle doit le signaler par une icône ⚠️ placée juste avant la partie concernée, en disant ce qui change et pourquoi.

## 1. Brand & Style

Aucun changement d'identité. Le ton éditorial de la base (léger, JDR, thématisé) s'applique aux libellés neufs (`EXPERIENCE.md` §3). Un principe guide ce delta : **une invitation à créer ne se déguise pas en contenu.** Elle a sa propre grammaire — bordure pointillée, icône « + », verbe d'action — pour ne jamais se confondre avec une carte de personnage existant.

## 2. Colors

Aucune couleur nouvelle. Emplois de l'existant :

| Usage | Token |
| --- | --- |
| Fond du bloc d'invitation sur la partie | `{colors.surface-high}` |
| Bordure d'une ligne « à créer » (pointillée) | `{colors.accent-1}` à ~55 % |
| Pastille « + » (ligne et bloc) | fond `{colors.accent-1}` à 16 %, glyphe `{colors.accent-1}` |
| Bouton du bloc d'invitation | dégradé d'action existant (`{colors.accent-1}` → `{colors.accent-2}`), texte `{colors.primary-bg}` |
| Titre de section, libellés secondaires | `{colors.text-muted}` |
| Marqueur de nature « Homme Dragon » | contour `{colors.accent-2}`, texte `{colors.accent-2}` éclairci, **aucun fond de statut** |

> **La couleur ne dit rien ici.** La nature d'une entrée (voyageur, Homme Dragon) est portée par le **verbe et le mot** du libellé, jamais par une teinte. Le marqueur de nature double son mot par une icône ; en mode liste compact, l'icône double un `aria-label` explicite.
>
> **Contraste à mesurer, pas à supposer.** `text-muted` en 12 px sur `surface-high` frôle 4,5:1 selon le thème (Atelier Cuivré ~4,4:1, connu depuis la base). Le sous-texte du bloc d'invitation est le seul texte muet de ce delta : à mesurer dans les trois thèmes à l'implémentation ; à défaut, on le passe en `{colors.text}`.

## 3. Typography

Échelle existante, usages nouveaux :

| Élément | Token |
| --- | --- |
| Titre du bloc d'invitation | `{typography.text-base}`, 600 |
| Sous-texte du bloc | `{typography.text-sm}` (12 px), `text-muted` |
| Titre de la section de création | `{typography.text-sm}`, **capitales**, espacement 0,04 em, `text-muted` (même traitement que le titre de groupe du catalogue d'équipement du wizard) |
| Libellé d'une ligne « à créer » | `{typography.text-base}`, 500 |
| Marqueur de nature | `{typography.text-sm}`, 600 |

## 4. Layout & Spacing

- **Cible tactile 44 × 44 px minimum**, valeur de conception par défaut pour toute surface neuve (`EXPERIENCE.md` base §7). Ici : le bouton du bloc, chaque ligne « à créer » (**56 px** de haut au repos), « Voir les N autres ».
- **Bloc d'invitation** : pleine largeur de la colonne de contenu. Sur mobile, **empilé** (texte au-dessus, bouton pleine largeur dessous). Sur desktop (seuil inchangé : 1024 px), **en ligne** (texte à gauche, bouton à droite, centré verticalement).
- **Section de création** : en tête de « Personnages », **au-dessus** de la barre de contrôles, dans le flux normal (ni collante, ni prise dans le masquage au défilement de la barre). Mobile : une colonne, lignes pleine largeur. Desktop : `auto-fill, minmax(300px, 1fr)`.
- **Écart** : 8 px entre lignes ; 14 px entre le bloc / la section et ce qui suit.
- **Trois lignes visibles** ; au-delà, une divulgation « Voir les N autres » (cible 44 px).

## 5. Elevation & Depth

Aucun niveau. Le bloc et les lignes sont **à plat** : ni ombre ni `{elevation.panel}`. Une invitation qui flotte se lirait comme une fenêtre.

## 6. Shapes

Rayons existants : bloc d'invitation et lignes `{radius.card}`, bouton `{radius.button}`, pastille « + » circulaire, marqueur de nature `{radius.badge}`.

## 7. Components

### 7.1 CharacterCallout — *nouveau*

Bloc d'invitation de l'écran d'une partie : pastille « + » · **titre** · sous-texte · **bouton d'action**. Rendu **uniquement** si le prédicat de création est vrai (`EXPERIENCE.md` §4.1). **Non fermable.** Un seul composant, deux dispositions (empilée / en ligne), pilotées par la largeur, pas par un second gabarit.

### 7.2 CreateEntryRow — *nouveau*

Ligne « à créer » : pastille « + » (32 px) · libellé complet · chevron. **Toute la ligne est le lien.** Bordure `1px dashed`, fond transparent — c'est ce qui la distingue d'une carte de personnage (bordure pleine, fond `surface-high`). Jamais de portrait, de niveau ni de statistique.

### 7.3 CreateEntriesSection — *nouveau*

Titre en capitales + pile (mobile) ou grille (desktop) de `CreateEntryRow`. **N'est rendue que non vide** — jamais un titre sans ligne. Au-delà de trois lignes : divulgation « Voir les N autres » / « Voir moins ».

### 7.4 NatureMarker — *nouveau*

Petit marqueur posé après le nom d'une carte de la liste des personnages quand l'élément **n'est pas un personnage joueur** : icône + mot « Homme Dragon » (moyen et grand), icône seule + `aria-label` (mode liste). Contour `accent-2`. N'existe que pour l'Homme Dragon aujourd'hui ; réutilisable si une autre nature apparaît.

## 8. Motion

Aucune animation neuve. L'apparition ou la disparition du bloc et des lignes (après création) est **instantanée**, sans transition : c'est un changement d'état, pas un événement.

## 9. Do's and Don'ts

**À faire**

- Faire porter la nature d'une entrée par un **mot** (verbe + nom), jamais par une couleur.
- Rendre la ligne entière cliquable, pas seulement son chevron.
- Écrire le libellé de la ligne **en entier** (« Créer un voyageur pour *Le Convoi du Nord* ») : il doit se lire sans le contexte de l'écran.

**À ne pas faire**

- Dessiner une entrée de création **sous forme de carte de personnage** — c'est précisément la confusion que la bordure pointillée écarte.
- Rendre un bloc ou un titre de section **vide**.
- Laisser la section réagir à la recherche, au tri ou au mode d'affichage de la liste.
- Ajouter une croix de fermeture au bloc d'invitation : il disparaît de lui-même.
- Proposer un personnage joueur à un MJ.
