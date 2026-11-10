---
title: jdr-master Experience — Delta Retouche UX PartieDetail (scroll, aération, fiches de téléchargement)
status: final
updated: 2026-09-23
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-21/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/implementation-artifacts/32-2-reorganisation-de-la-vue-de-partie.md"
---

# jdr-master — Experience — Delta Retouche UX PartieDetail

Delta comportemental : aucun changement d'architecture de l'information (les onglets et les trois
zones Action/Consultation/Référence de la Story 32.2 restent en place) — le sujet est le défilement,
la densité, et le vocabulaire d'interaction partagé entre les trois zones et le pied de carte.

## Interaction Primitives

### Défilement de page unique (correction, portée globale)

**Constat utilisateur** : sur `PartieDetail`, la molette au-dessus du contenu d'un onglet ne
défile que le bloc interne de ce contenu, jamais la page — les `mat-card-actions` du pied de carte
(Retranscrire/Sceller des secrets/Clore le grimoire/Supprimer) restent hors de portée tant qu'on ne
sort pas la souris du bloc.

**Cause** : comportement par défaut d'Angular Material — `mat-mdc-tab-body-content` porte un
`overflow: auto` intégré au composant, pensé pour les cas où l'onglet doit défiler indépendamment
d'une page de hauteur fixe. Rien dans ce projet n'a besoin de ce cas : les pages défilent normalement
au niveau du `body`/`.content` du Shell (aucune contrainte de hauteur fixe sur la carte).

**Décision** : neutraliser cet `overflow` **globalement**, une seule fois, plutôt que composant par
composant. `grep` confirme deux consommateurs de `mat-tab-group` dans l'app : `partie-detail` et
`character-sheet`. Les deux doivent défiler avec la page ; aucun des deux n'a de besoin légitime d'un
scroll interne propre. (Ne pas confondre avec `.sheet-menu-surface--sheet` de `character-sheet`, une
feuille modale `position: fixed` avec son propre `max-height`/`overflow-y` : un scroll interne y est
légitime, car c'est une surface flottante, pas le corps de page.) But : molette n'importe où sur
l'écran fait défiler toute la page, boutons du pied de carte toujours atteignables. Une future 3ᵉ page
à onglets hérite de la correction sans y repenser.

## State Patterns

### Grimoires de référence/préparation — repliés au repos

Les deux fiches de la zone Référence (`Grimoires de référence`, `Grimoires de préparation (MJ)`)
s'affichent **repliées par défaut** à chaque affichage de l'onglet — pas de mémorisation d'un état
« déjà ouvert » entre deux visites (pas de sur-ingénierie pour un gain d'usage marginal). Cliquer sur
le résumé les déplie ; aucune redirection, aucun rechargement de données (les fiches sont déjà
chargées, seul l'affichage change).

## Component Patterns

- **Carte de zone** : un seul vocabulaire visuel pour Action/Consultation/Référence (cf.
  `DESIGN.md` §4) — chaque item de flux (une entrée d'historique XP, une annonce) est sa propre carte,
  pas un `<p>` nu dans un conteneur commun comme avant cette retouche.
- **Barre d'icônes partagée** : les actions MJ de la zone Action (« Distribuer de l'XP », « Proclamer
  une annonce ») et les actions du pied de carte (« Retranscrire », « Sceller des secrets », « Clore
  le grimoire », « Supprimer ») suivent désormais le même patron bouton icône + libellé en ligne —
  avant cette retouche, les deux groupes avaient un traitement visuel différent (piles de boutons
  `mat-stroked-button` verticales pour l'un, `mat-button` texte seul pour l'autre).
- **Puce de téléchargement** : remplace le bouton pleine largeur des grimoires de référence/
  préparation — icône de téléchargement + libellé court (ex. « Journal », « Monde »), alignées en
  ligne avec retour automatique.

## Accessibility Floor

- Hérite du plan de titres déjà corrigé en revue de la Story 32.2 (titre de zone `<h3>`, titres de
  bloc internes `<h4>`) ; cette retouche ne le modifie pas, elle l'étend seulement à la mise en carte
  des items de flux (Consultation). Ces items n'ont pas besoin de leur propre niveau de titre : leur
  contenu est court, un `<h4>` par item serait excessif — un `<p>` en gras suffit à porter l'intitulé
  sans ajouter de niveau au plan de titres.
- Toute icône (barre d'icônes, puce de téléchargement) reste **doublée d'un libellé texte** — jamais
  l'icône seule (principe hérité de la base, `DESIGN.md` du socle).
- Cible tactile : boutons de la barre d'icônes et puces de téléchargement conservent le padding
  suffisant pour une cible ≥ 44×44px effective, même en version compacte (référence : `DESIGN.md`
  delta du 2026-09-21, §4).
