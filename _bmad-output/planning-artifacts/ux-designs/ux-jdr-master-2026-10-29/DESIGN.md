---
title: "jdr-master Design System — Delta Palier 10.5 Jeux de société"
status: final
created: 2026-10-29
updated: 2026-10-29
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/DESIGN.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/prd.md
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-28-p10-5/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-29/.memlog.md
# Aucun token de thème ajouté. Tokens component-scoped, qui référencent les tokens existants.
# Valeurs de la planche mockups/planche-retenue.html ; les spines l'emportent sur elle.
components:
  games-summary:                       # en-tête de l'onglet Reliques / Trésors / Joyaux (§7.1)
    backgroundColor: "{colors.surface-high}"
    border: "1px solid {colors.outline}"
    rounded: 12px
    padding: "9px 10px"
    title: "14.5px / 700, {colors.text-primary}"
  games-section-header:                # en-tête de section repliable (§7.2)
    typography: "12px / 700, {colors.text-primary} ; compte en {colors.text-muted}, 400"
    border-bottom: "1px solid {colors.outline-variant}"
    chevron: "▾ déplié / ▸ replié, {colors.text-muted}"
    minHeight: 44px                    # toute la ligne est la cible
  game-row:                            # un jeu sur place (§7.3)
    backgroundColor: "{colors.surface-container}"
    border: "1px solid {colors.border-subtle}"
    rounded: 10px
    padding: "7px 9px"
    gap: 6px
    name: "13px / 600"
    meta: "11px, {colors.text-muted}"   # « 2–8 joueurs · 15 min »
  fit-pill:                            # « jouable à N »
    backgroundColor: "{colors.accent-1}"
    color: "{colors.on-primary}"
    rounded: 999px
    typography: "10px / 700"
    padding: "1px 7px"
  duplicate-pill:                      # « ×2 »
    border: "1px solid {colors.status-todo}"
    color: "{colors.status-todo}"
    rounded: 999px
    typography: "10px / 700"
    padding: "0 6px"
  duplicate-line:                      # « aussi apporté par Zoé », « ⚠ déjà chez Léa »
    color: "{colors.status-todo}"
    typography: "11px"
  envy-toggle:                         # ♥ + compte (§7.4)
    rounded: 999px
    border: "1px solid {colors.outline}"
    color: "{colors.text-muted}"
    on: "bord et texte {colors.accent-2}, fond {colors.accent-2} à 10 %"
    typography: "11.5px"
    padding: "2px 8px"
  owner-link:                          # nom cliquable → Ludothèque de la personne
    color: "{colors.text-primary}"
    decoration: "soulignement pointillé 1 px"
  unavailable-row:                     # jeu indisponible ce soir, vu par l'hôte seul (§7.5)
    content-opacity: 0.45              # le bouton « Remettre » reste à plein contraste
  library-sheet:                       # Ludothèque d'une personne (§7.6)
    reuse: "tiroir du bas de DestinyList (Palier 10.4) : modal, poignée 40 × 4 px, rayon 18px 18px 0 0"
    backgroundColor: "{colors.surface-container-high}"
  quick-add:                           # saisie en série, page Ludothèque (§7.7)
    backgroundColor: "{colors.surface-high}"
    border: "1px solid {colors.outline}"
    rounded: 12px
    padding: 8px
  host-bars:                           # « Qui reçoit » (§7.8)
    bar: "hauteur 6px, rayon 3px, {colors.accent-2}"
    maxWidth: 120px                    # le plus grand compte = 120 px, les autres au prorata
---

# jdr-master — Design System — Delta Palier 10.5 Jeux de société

Ce document est un **delta** : il hérite du delta du Palier 10.4 (`ux-jdr-master-2026-10-20`), et par lui de celui du Palier 10 et du contrat du Palier 9. Il **n'ajoute aucun token de thème** ; ses composants réutilisent la palette, `{radius.*}`, `StatusBadge`, `ParticipantChip`, les tiroirs du Palier 10.4 et la convention de couleur de statut.

**Contrat UI.** Tout ce qui modifie un écran déjà validé est précédé de **⚠️** ; récapitulatif dans EXPERIENCE.md §10.

**Les spines l'emportent sur les planches.** Planche des écrans retenus : [`mockups/planche-retenue.html`](mockups/planche-retenue.html) (Grimoire Émeraude, téléphone). Planche des options, pour mémoire : [`mockups/options-jeux.html`](mockups/options-jeux.html).

## 1. Brand & Style

Le mode soirée gagne un objet : **les jeux de chacun**. Chaque thème les nomme comme un bien précieux — **Reliques** (Grimoire), **Trésors** (Forêt), **Joyaux** (Atelier) — mais le contenu dit toujours « jeux » en clair (« 8 jeux sur place »). Le ton reste chaleureux ; la fonctionnalité est **facultative** et ne doit jamais faire la leçon à qui n'a rien renseigné. Libellés : EXPERIENCE.md §3.

## 2. Colors

**Aucun nouveau token.**

| Besoin | Token | Remarque |
| --- | --- | --- |
| Jouable au nombre de Participants | `{colors.accent-1}` (pastille pleine) | information positive, comme « Vous êtes l'hôte » |
| Doublon, « déjà chez … » | `{colors.status-todo}` | « ça t'attend » : un détenteur peut agir (annuler, se concerter) |
| Envie active | `{colors.accent-2}` | ⚠️ la planche l'a en rose ; le rose est `status-soon` dans le Grimoire, donc écarté |
| Barres « Qui reçoit » | `{colors.accent-2}` | |
| Indisponible ce soir (hôte) | contenu à 45 % d'opacité | pas de rouge : rien d'irréversible |

Jamais la couleur seule : « ×2 », « jouable à 6 » et « ⚠ déjà chez Léa » sont écrits.

## 3. Typography

Inchangée ; tailles de l'échelle existante (10, 11, 11.5, 12, 13, 14.5 px).

## 4. Layout & Spacing

- Onglet des jeux : résumé en tête, puis sections empilées ; lignes de jeu espacées de 6 px.
- Page Ludothèque : saisie en série en tête, liste alphabétique dessous, une ligne par jeu (44 px minimum).
- Mobile d'abord (360 px). Au-delà de 768 px, mêmes blocs sur une colonne de 640 px au plus, centrée.

## 5. Elevation & Depth

Inchangée. La feuille d'une Ludothèque reprend l'élévation du tiroir des destinées.

## 6. Shapes

Pilules (`999px`) pour « jouable à N », « ×N », ♥, filtres et « J'apporte » ; `10px` pour une ligne de jeu ; `12px` pour le résumé et la saisie en série.

## 7. Components

**Noms canoniques**, identiques dans EXPERIENCE.md §4.

### 7.1 GamesSummary

« {n} jeux sur place · {k} jouables à {N} » sur une ligne, puis les filtres en puces (`chip` du Palier 10.4) : « Jouables à {N} » et « Les plus {appelées | attendus | demandés} ». Filtre actif : puce pleine `{colors.accent-1}` à 18 % avec ✕.

### 7.2 GamesSection

En-tête repliable : titre de section, compte (« · 6 », ou « · 3 sur 6 » quand un filtre est actif), chevron à droite. Toute la ligne est le bouton.

### 7.3 GameRow

Nom à gauche, actions à droite (♥, et ⋮ pour l'hôte sur ses jeux) ; dessous : joueurs et durée, puis pastilles `FitPill` et `DuplicatePill` ; dernière ligne : provenance (« par **moi** · Je ne l'apporte plus », « par Zoé · aussi chez Léa »). Les noms de personnes sont des `OwnerLink`.

### 7.4 EnvyToggle

♥ seul quand il n'y a aucune envie ; « ♥ {n} » sinon. Actif (j'ai signalé) : couleur `{colors.accent-2}`.

### 7.5 UnavailableRow

Ligne simple dans la section du bas, vue par l'hôte seul : nom et mesure estompés, bouton « Remettre » à plein contraste.

### 7.6 LibrarySheet

Tiroir du bas, réutilise celui de `DestinyList` : titre « Cabinet | Coffre | Râtelier de {nom} · {n} », ligne sur le prêt, liste en lecture seule.

### 7.7 QuickAddRow

Encadré de la page Ludothèque : nom (champ pleine largeur), joueurs min et max, durée en minutes, bouton « Ajouter » plein. Champs à contour existants.

### 7.8 HostBars

Une ligne par membre qui a reçu : prénom, barre, « {n} fois » aligné à droite ; puis une ligne « Jamais : … » en `{colors.text-muted}`.

### 7.9 Réutilisés tels quels

`ParticipantChip`, `chip` de filtre, tiroir de `DestinyList`, champs à contour, `EventDialog` (⚠️ reçoit des onglets, EXPERIENCE.md §2.2).

## 8. Do's and Don'ts

**Do**
- Écrire « jeux » dans le contenu, réserver le mot du thème aux titres.
- Montrer le doublon **là où l'on décide** : dans « Dans mon … », à côté de « J'apporte ».
- Texte + forme + couleur pour « ×N », « jouable à N », « déjà chez ».
- Cibles de 44 px pour ♥, ⋮, « J'apporte », « Remettre » et les en-têtes de section.

**Don't**
- Pas de rouge : rien n'est irréversible ici.
- Pas d'image de boîte, de note ni de logo de catalogue (saisie manuelle seulement).
- Pas de classement, de médaille ni de « bravo » autour du compteur d'hôte.
- Pas d'invitation insistante à remplir sa Ludothèque (PRD FR-2).
