---
title: jdr-master Design System — Delta Retouche UX PartieDetail (scroll, aération, fiches de téléchargement)
status: final
updated: 2026-09-23
themes: [grimoire-emeraude, foret-ancienne, medieval-steampunk]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-21/DESIGN.md"
sources:
  - "_bmad-output/implementation-artifacts/32-2-reorganisation-de-la-vue-de-partie.md"
---

# jdr-master — Design System — Delta Retouche UX PartieDetail

Ce document est un **delta** : aucun nouveau token de couleur, typographie ou rayon. Le sujet est la **densité et la structure visuelle** de l'onglet « Détails » de `PartieDetail` (livré par la Story 32.2), retouché après retour d'usage réel — le regroupement en trois zones (Action/Consultation/Référence) tenait, mais l'espacement était trop serré et les trois zones n'avaient pas le même vocabulaire visuel.

En cas de conflit avec une planche de `.working/`, **ce document gagne**. Planche contractuelle : [`mockups/key-partie-detail-onglet-details.html`](mockups/key-partie-detail-onglet-details.html).

## 1. Colors

Aucune couleur nouvelle. Usage de l'existant : un même patron de carte appliqué aux trois zones, chaque zone gardant sa propre teinte de liseré.

| Usage | Token |
| --- | --- |
| Liseré + titre de carte, zone Action | `{colors.accent-2}` (violet — action) |
| Liseré + titre de carte, zone Consultation | `{colors.accent-1}` (vert — lecture) |
| Liseré + titre de carte, zone Référence | `{colors.text-muted}` (neutre — support, la moins prioritaire) |
| Fond des cartes des trois zones | `{colors.surface-bg}` |
| Bouton « Supprimer » du pied de carte | `--mat-sys-error` (système M3, déjà décliné par les trois thèmes), **nouveau dans ce composant** : jamais utilisé jusqu'ici sur ce bouton (simple `mat-button` sans couleur). ⚠️ Correction post-implémentation (2026-09-23) : l'attribut `color="warn"` de Material **n'a aucun effet en theming M3** (documenté par Angular Material — supporté en M2 seulement) ; la teinte passe par une classe dédiée référençant `--mat-sys-error` directement, pas par l'attribut `color` |

> **La couleur classe le contenu, elle ne trie jamais par urgence.** Les trois liserés n'introduisent pas une nouvelle échelle de statut (pas de rapport avec `status-todo/live/soon/done`, Story 29.0) — c'est une hiérarchie de *nature du contenu* (agir / consulter / se référer), toujours doublée d'un libellé de zone en toutes lettres.

## 2. Layout & Spacing

- **Patron de carte unique**, réutilisé dans les trois zones et pour les items de flux (historique XP, annonces) : fond `{colors.surface-bg}`, `border-radius` existant du composant, liseré gauche 3px, padding `0.9rem 1.1rem`, `margin-bottom` `0.7rem` entre cartes d'une même zone.
- **Séparation zone/contenu** : un espace vertical net sépare le titre de chaque zone de son premier bloc de contenu (contre l'espacement quasi nul retouché en revue de la Story 32.2) ; `margin-bottom` d'environ `2rem` entre chaque zone (Action/Consultation/Référence), plus large qu'entre deux cartes d'une même zone.
- **Espacement entre actions rapprochées** : les boutons « Distribuer de l'XP » et « Proclamer une annonce », auparavant en pile serrée, passent en **barre d'icônes horizontale** (`gap: 0.6rem`, retour à la ligne automatique) — l'espacement vient de la mise en ligne elle-même, pas d'une marge verticale supplémentaire.
- **Grimoires de référence/préparation** : passent en zone **repliable, repliée par défaut** (`<details>`/`<summary>` natif ou `mat-expansion-panel` équivalent) — récupère l'espace vertical qu'occupaient les boutons pleine largeur, sans perdre l'accès au contenu.

## 3. Shapes

- **Puce de téléchargement** (grimoires) : passe de bouton `mat-stroked-button` pleine largeur/texte à une puce compacte icône + libellé court, `border-radius` en pilule (999px), bordure fine `{colors.border-subtle}` — les puces s'enchaînent en ligne avec retour automatique, gain de place net face à l'ancien empilement d'un bouton par ligne.
- **Barre d'icônes** (actions MJ et pied de carte) : même forme pour « Distribuer l'XP »/« Proclamer une annonce » et pour « Retranscrire »/« Sceller des secrets »/« Clore le grimoire »/« Supprimer » — bouton avec icône + libellé court, alignés en ligne, même hauteur, même `border-radius` que le reste du composant.

## 4. Components

| Composant | Règle |
| --- | --- |
| **Carte de zone** (nouveau nom pour le patron existant) | Liseré gauche coloré + titre en majuscules dans la teinte du liseré + corps en `text-primary`/`text-muted`. Un seul bouton d'action visible par carte quand elle en a un (jamais deux CTA concurrents dans la même carte). |
| **Barre d'icônes** | 2 à 4 boutons maximum par barre (au-delà, repenser le regroupement) ; icône + libellé toujours les deux, jamais l'icône seule (accessibilité, cohérent avec le principe « jamais la couleur/icône seule » de la base). |
| **Grimoire repliable** | `summary` = titre de la fiche (ex. « Grimoires de référence ») + chevron ; replié par défaut (le comportement au clic relève d'`EXPERIENCE.md` §State Patterns). |

## 5. Do's and Don'ts

- **Don't** ajouter une quatrième teinte de liseré à ce composant sans repasser par ce document — trois zones, trois teintes, pas plus.
- **Don't** replier une carte qui appelle une action (zone Action) — seules les fiches de référence/préparation (zone Référence) sont repliables : ce qui demande une action reste toujours immédiatement visible.
