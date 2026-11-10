---
title: jdr-master Design System — Delta Formulaire de création de l'Homme Dragon (Story 33.3)
status: final
updated: 2026-09-23
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/implementation-artifacts/spec-33-1-fiche-homme-dragon-refondue.md"
---

# jdr-master — Design System — Delta Formulaire de création de l'Homme Dragon (33.3)

Ce document est un **delta** : il hérite intégralement des tokens couleur/typographie/espacement/rayon/élévation du spine de base et du patron `ChoiceCard`/`DetailSurface` du wizard de création de personnage (`ux-jdr-master-2026-08-31`), qu'il **réutilise tel quel**. Il ajoute deux choses propres au formulaire Homme Dragon : (1) un jeu de tokens de teinte par race pour les cartes de l'étape Race, (2) le rattrapage vers les champs Material déjà prévus par le spine de base mais jamais appliqués sur cette page.

En cas de conflit avec une planche de `.working/`, **ce document gagne**. Planches contractuelles : [`mockups/key-race-step.html`](mockups/key-race-step.html) (étape 1/5, traitement final) et [`mockups/key-identite-step.html`](mockups/key-identite-step.html) (étape 3/5).

## 1. Brand & Style

Identique au spine hérité — aucun écart.

## 2. Colors

Aucun token de thème modifié. Nouveaux tokens **component-scoped** (portée : étapes Race et Artefact du formulaire Homme Dragon uniquement, jamais le thème global), un jeu par race, dérivés de la palette existante :

| Race | `--h` (liséré, 2px) | `--g1` → `--g2` (gemme, dégradé conique) | `--glow` (lueur de coin, repos) |
|---|---|---|---|
| Dragon Vert | `#5fa578` | `#3f7d54` → `#8fd6ab` | `rgba(126,200,164,.20)` |
| Dragon Bleu | `#6a93c2` | `#3d6289` → `#9cc3e8` | `rgba(122,169,216,.20)` |
| Dragon Rouge | `#c06552` | `#7d3226` → `#e08a6f` | `rgba(224,120,90,.22)` |
| Dragon Noir | `#524d5e` | `#0c0b10` → `#4a4656` | `rgba(255,255,255,.10)` |

Le rouge est délibérément repoussé vers le brique/terracotta (canal rouge nettement dominant) pour ne jamais lire comme du rose, et reste toujours plus sourd que `--status-unavailable` (`#e05252`). Le Dragon Noir ne cherche pas un noir littéral sur le liséré/carte — cette identité est portée par le reflet de sa gemme (`--hl: rgba(255,255,255,.55)`), pas par la couleur du contour, qui peut rester un charbon assumé sans perdre en lisibilité (5 itérations testées avec l'utilisateur avant convergence — voir `.memlog.md`).

## 3. Typography

Identique au spine hérité.

## 4. Layout & Spacing

Identique au spine hérité : grille `auto-fill, minmax(140px, 1fr)`, seuil desktop unique du projet à **1024px** (`BreakpointObserver`, comme `CharacterSheet`/`DetailSurface`), cible tactile **44px** minimum. Aucun nouveau seuil introduit.

## 5. Elevation & Depth

Identique au spine hérité.

## 6. Shapes

Identique au spine hérité, y compris `{radius.input}` (4px, « Angular Material override ») — voir §7 Components pour son application ici.

## 7. Components

**`ChoiceCard` (variant Homme Dragon — étapes Race et Artefact)** — reprend l'API et le comportement du `ChoiceCard` du wizard perso (nom + sous-titre 2 lignes, sélection = contour/fond `accent-2`, jamais la couleur seule). Trois ajouts combinés, uniformes sur les 4 races :
- **Liséré** : contour plein 2px dans `--h` (remplace le simple `border-top` de l'ancien brouillon).
- **Lueur de coin** : dégradé radial doux (~130×100px, ancré en haut-gauche, `--glow`) en état repos ; disparaît sur l'état sélectionné (le halo `accent-2` prend le relais).
- **Gemme de race** : remplace l'icône dragon — disque 30px, `radial-gradient` (reflet, coin haut-gauche) + `conic-gradient` (`--g1`→`--g2`, effet pierre taillée), cerné d'un liséré blanc 1px à 16% d'opacité. Élément décoratif : le texte (nom + étiquette) porte seul l'information, jamais la gemme seule.
- **Étiquette** : contour 1px `--h`, texte `--h`, fond transparent (pas de pastille pleine).

À l'état sélectionné : le contour et le halo passent en `accent-2` (comme le `ChoiceCard` standard) ; gemme et étiquette gardent leur teinte de race — l'identité de race reste lisible même sur la carte choisie.

**Champs Material (étapes Identité, Vie de l'Homme Dragon)** — `mat-form-field appearance="outline"` + `matInput`, conformément au token `{radius.input}` du spine de base (déjà défini, jamais appliqué sur cette page jusqu'ici). Un groupe de champs à la fois par étape (voir EXPERIENCE.md §2), chacun avec une ligne d'aide sous le label. Remplace les `<input>`/`<select>` natifs bruts du formulaire actuel — voir `mockups/key-identite-step.html`.

## 8. Do's and Don'ts

**Do** : réutiliser `ChoiceCard`, `DetailSurface`, `createDetailSurfaceHost()` tels quels (aucune fourche). Toujours doubler la teinte de race d'un texte (nom, étiquette). Un seul groupe de champs visible par étape.

**Don't** : ne jamais introduire un second seuil desktop. Ne jamais tenter de rendre le Dragon Noir « plus noir » en assombrissant son propre contour — l'identité passe par le reflet de la gemme, pas par la teinte du liséré (5 itérations l'ont établi). Ne pas étendre le rattrapage Material à d'autres pages depuis ce document — c'est un suivi séparé (voir EXPERIENCE.md §9).
