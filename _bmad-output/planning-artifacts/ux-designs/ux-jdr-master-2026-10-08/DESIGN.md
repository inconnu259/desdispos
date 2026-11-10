---
title: jdr-master Design System — Delta Palier 10 Soirées entre amis
status: final
updated: 2026-10-08
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-08/addendum.md"
  - "_bmad-output/forge/soiree-jeux-de-societe/forged-idea.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/.memlog.md"
# Aucun token de thème ajouté. Tokens component-scoped, qui référencent les tokens existants ({colors.*}, {radius.*}…).
# Les valeurs viennent des planches rendues sur l'interface réelle (mockups/) ; les spines l'emportent sur elles.
components:
  create-action:                       # bouton « lancer une quête… » déplacé dans l'en-tête (⚠️ §7.1)
    desktop:
      placement: "mat-toolbar du haut, bord droit"
      shape: "pilule pleine {radius.button}, libellé de thème + icône de création (système de glyphes §7.1)"
    mobile:
      placement: "droite du titre de l'en-tête contextuel"
      width: 48px
      height: 40px
      rounded: 20px
      glyph: 26px                      # libellé thématique conservé en nom accessible, jamais affiché
  mode-switch:                         # bascule gauche/droite Quête | Ralliement, sous le nom (⚠️ §7.2)
    kind: "mat-button-toggle-group, deux options, une seule active"
    minHeight: 44px
    labels: "EXPERIENCE.md §3 (variante par thème)"
  cover-banner:                        # aperçu de couverture du formulaire (⚠️ §7.3)
    width: 100%
    height: 170px
    rounded: 14px
  cover-change-chip:
    placement: "coin bas-droit de la bannière, décalage 12 px"
    padding: "8px 15px 8px 12px"
    rounded: 999px
    backgroundColor: "rgba(8,6,16,.58)"
    backdrop-filter: "blur(8px)"
    border: "1px solid rgba(255,255,255,.30)"
    typography: "13px / 500"
    glyph: 16px                        # crayon
  system-chip:                         # pastille texte du système/genre (Ralliement, Ryuutama, Draconis…)
    border: "1px solid rgba(255,255,255,.40)"
    rounded: 999px
    typography: "11px"
    padding: "1px 8px"
    color: "{colors.text-primary} à 85 %"
  system-badge:                        # badge rond par système, coin bas-droit de la vignette
    size: 26px
    glyph: 19px
    rounded: 50%
    backgroundColor: "{colors.primary-bg}"
    border: "1px solid rgba(255,255,255,.28)"
    offset: "-6px / -6px"
  event-card:                          # carte de conjonction (réutilise StatusBadge et la carte de chronologie)
    minWidth: 250px
    border: "1px solid {colors.status-*} ; barre gauche 3 px ; imminent = bord 2 px + barre gauche 4 px"
    sections: "titre → badge d'état → date (gras) → hôte → lieu → ligne « Ma situation » + pastille"
  tile-cancelled:                      # carte de liste annulée (⚠️ §7.6)
    content-opacity: 0.5
    strike: "trait diagonal 1 px, rgba(255,122,122,.6) → {colors.status-unavailable} à 60 %, de bas-gauche à haut-droit, sur toute la carte"
  event-dialog:                        # détail d'une conjonction
    width: "min(900px, 96vw)"
    maxHeight: 94vh
    padding: "18px 20px"
    mobile: "pleine largeur utile, défilement interne"
  situation-panel:
    rounded: 14px
    border: "1.5px solid {colors.status-todo}"          # membre qui a une action à faire
    border-host: "1.5px solid {colors.accent-1}"        # hôte
    backgroundColor: "{colors.status-todo} à 7 %"
    padding: "14px 16px"
  vote-summary:                        # cases « Vos réponses / Meilleur créneau / N'ont pas répondu »
    grid: "auto-fit, minmax(190px, 1fr), écart 10 px"
    border: "1px solid rgba(255,255,255,.10)"
    rounded: 10px
  participant-chip:
    rounded: 999px
    avatar: 26px
    ghost: "bord pointillé ; avatar estompé ; TEXTE à plein contraste (§8)"
  danger-zone:                         # Compte : zone sensible (⚠️ §7.8)
    separator: "filet 1 px, 28 px au-dessus"
    label: "11 px, capitales, espacement .08em, {colors.text-muted}"
    action: "pilule contour 1 px {colors.status-unavailable} à 55 %, texte {colors.status-unavailable}, glyphe corbeille 18 px"
  destructive-confirm:                 # bouton de confirmation rouge (⚠️ §7.9)
    backgroundColor: "{colors.status-unavailable}"
    color: "{colors.primary-bg}"
    rounded: 999px
---

# jdr-master — Design System — Delta Palier 10 Soirées entre amis

Ce document est un **delta** : il hérite de `ux-jdr-master-2026-09-23` (et, par lui, des spines de base `…2026-08-04` et `…20260626`) et **réutilise** les trois thèmes, la palette, l'échelle typographique, `{radius.*}`, `{elevation.*}`, `StatusBadge`, `ContextualHeader`, `ListControlBar`, `DetailSurface` et la convention de couleur de statut. Il **n'ajoute aucun token de thème**.

**Contrat UI.** Une planche validée fait contrat. Toute partie de ce document qui **modifie** un écran déjà validé est précédée de **⚠️** et dit ce qui change et pourquoi. Récapitulatif complet : EXPERIENCE.md §10.

**Les spines l'emportent sur les planches.** Planches de référence, rendues sur l'interface réelle (thèmes grimoire, forêt ou atelier selon la planche) : [`mockups/`](mockups/). Elles illustrent ; elles ne fixent pas.

## 1. Brand & Style

Le produit sait organiser des parties de JDR. Ce palier lui ajoute une seconde famille — les **ralliements** : rencontres entre amis (jeux de société, impro, repas…), sans personnages. L'identité ne change pas ; deux choses s'ajoutent.

**Un repère visuel par système.** Chaque tuile et chaque en-tête de partie porte un **badge rond de système** (§7.5) : Ryuutama = **carte pliée avec un trajet pointillé et un dé** ; Ralliement = **feu de camp** (flamme sur deux bûches). Draconis (Palier 13) aura le sien ; il n'est pas dessiné ici. Les dessins sont des **SVG inline monochromes** (`currentColor`), dans la lignée du pictogramme de marque (`brand-logo`) : mêmes règles — pas de masque, pas d'identifiant, un seul tracé lisible à 19 px. Sources : `mockups/` (fichiers `badge-R1-…`, `badge-L1-…`).

**Une icône de création.** Le bouton de création reçoit une icône sur mesure : **le d20 du logo traversé d'un crayon** (§7.1). Elle remplace le « + » générique. Le **jeu d'icônes complet** de l'application (≈ 43 icônes génériques identiques dans les trois thèmes) est traité à part (Palier 10.7).

**Le rouge est désormais employé** — sans devenir une couleur de thème. Il porte exactement deux sens : **ce qui est irréversible** (effacer un compte, un groupe) et **ce qui est annulé** (trait diagonal sur une carte). La palette de statut garde son rôle (voir §2).

**Ton.** Inchangé : chaleureux et malicieux. Les libellés propres au mode ralliement sont dans EXPERIENCE.md §3, avec une variante par thème.

## 2. Colors

**Aucun nouveau token.** Usage des tokens existants pour ce palier :

| Besoin | Token | Remarque |
| --- | --- | --- |
| Action à faire par moi (vote à faire, invitation à accepter) | `{colors.status-todo}` | convention du `StatusBadge` : « ça t'attend » |
| Vivant, rien à faire (inscrit, j'ai voté, inscriptions ouvertes) | `{colors.status-live}` | |
| Daté, à venir | `{colors.status-soon}` ; badge **plein** quand imminent | palier imminent déjà défini (7.1) |
| Terminé, en retrait | `{colors.status-done}` / texte `{colors.text-muted}` | |
| Vous êtes l'hôte (encadré) | `{colors.accent-1}` | distingue « je gère » de « j'ai à faire » |
| **Irréversible / annulé** | `{colors.status-unavailable}` | déjà le rouge du « non » dans la piste de vote ; le rouge est « disponible » (base §2) |

**Règle d'état d'un vote** (reprend la table de la base) : un vote en cours est `status-todo` pour qui **n'a pas répondu**, `status-live` pour qui **a répondu** ; il n'est jamais `status-soon` (il n'y a pas encore de date).

⚠️ **À vérifier avant de livrer :** le contraste de `status-unavailable` en **texte** sur `{colors.surface-bg}` dans les **trois** thèmes (≥ 4,5:1). Mesuré à la main uniquement sur le grimoire (≈ 4,6:1). Voir EXPERIENCE.md §11.

## 3. Typography

Inchangée. Tailles nouvelles, toutes déjà dans l'échelle : 13 px (puce « Changer »), 11 px (pastille de système, étiquette de zone), 22 px (titre de la fenêtre d'une conjonction).

## 4. Layout & Spacing

- **Fenêtre d'une conjonction** : `min(900px, 96vw)`, `max-height` 94 vh, défilement interne ; sur mobile elle occupe la largeur utile.
- **Cartes d'événements** : grille `auto-fill` à 250 px minimum, écart 12 px ; une colonne sous 520 px.
- **Bannière du formulaire** : pleine largeur de la carte du formulaire, 170 px de haut.
- **En-tête mobile** : le bouton de création (48 × 40) tient à 307 px au plus avec le titre le plus long ; il est **icône seule** sous 440 px et prend son libellé au-dessus (mesure : EXPERIENCE.md §9).

## 5. Elevation & Depth

Inchangée. La fenêtre d'une conjonction réutilise l'élévation de `DetailSurface`.

## 6. Shapes

Pilules (`999px`) pour puces, boutons de bascule, pastilles de participants et actions ; `14 px` pour bannière et encadrés ; `10 px` pour les cases de résumé. **Le d20 et le crayon ne sont jamais rognés** dans un cercle (règle du logo).

## 7. Components

**Noms canoniques** — identiques dans EXPERIENCE.md §4.

### 7.1 ⚠️ CreateAction — le bouton de création, déplacé et global

**Ce qui change** (page « Parties » et en-tête validés) : le bouton « lancer une quête » (aujourd'hui dans le contenu de la page, **visible seulement si l'on est déjà MJ d'une partie**) passe **dans l'en-tête** et s'affiche **pour tout utilisateur connecté** sur **toutes** les pages. Pourquoi : un joueur ou un nouvel inscrit n'avait aucun moyen de créer ; une action de création globale va dans l'en-tête.

- **Bureau** : bord droit de la barre du haut, pilule pleine, libellé du thème (« Initier une mission », « Ouvrir un sentier », « Lancer une quête ») + icône.
- **Mobile** : à droite du titre de l'en-tête contextuel, **icône seule** (48 × 40 px), nom accessible = le libellé du thème.
- **Icône** : **le d20 du logo, un crayon le traversant en bas à droite**, trou découpé autour du crayon. Contour 2 px, `currentColor`. À redessiner **sans masque ni identifiant** à l'implémentation. Source : `mockups/icone-B-de-crayon.svg`. Lisible à 24 px (rendu mobile validé).
- **Repli** : si le titre et le bouton se gênent, c'est le bouton qui reste en icône ; le titre n'est jamais raccourci.

### 7.2 ⚠️ ModeSwitch — la bascule Quête | Ralliement

Un `mat-button-toggle-group` à **deux options** juste **après le nom** : à gauche l'option de ralliement, à droite la quête (libellés par thème : EXPERIENCE.md §3). Il décide de la suite du formulaire (EXPERIENCE.md §2) et **n'est plus modifiable après la création** (le mode est définitif). **Ce qui change** : le formulaire validé n'avait pas de bascule ; l'ordre devient couverture → nom → bascule → champs du mode → description.

### 7.3 ⚠️ CoverBanner + CoverChangeChip — la couverture

**Ce qui change** (formulaire validé : une ligne brute avec le bouton natif « Choisir un fichier / Aucun fichier choisi » et une vignette de 40 px) : une **bannière en aperçu pleine largeur** (170 px) portant, **sur elle**, la **puce « Changer »** (§tokens : translucide, flou, crayon). L'`<input type=file>` natif est **masqué** et couvre la puce (la puce reste le seul contrôle visible). Si une image personnalisée existe, une **seconde puce « Retirer »** s'affiche à côté `[ASSUMPTION]`. La bannière générée reste l'aperçu par défaut.

### 7.4 EventCard — la carte d'une conjonction

Reprend la carte de chronologie : **titre**, **badge d'état** (`StatusBadge`), **date en gras** (« Date à voter · jusqu'au 12 oct. » pendant un sondage), **hôte**, **lieu**, puis la ligne **« Ma situation »** : libellé discret à gauche, **pastille** à droite. Cadre coloré selon l'état (barre gauche 3 px) ; **imminent** = badge plein, bord 2 px, barre gauche 4 px. Clic = ouvre la fenêtre (§7.7). Les infos au-delà (participation, places, compteur, détail du sondage) sont **dans la fenêtre**, jamais sur la carte.

**Pastilles de situation** : « Je participe » (`live`), « Vote à faire » (`todo`), « Invitation à accepter » (`todo`) `[ASSUMPTION]`, « Pas inscrit·e » (`draft`, pointillé), « J'y étais » (`done`).

### 7.5 SystemChip + SystemBadge — le repère de système

- **SystemChip** : pastille texte portant le **nom du système** (« Ryuutama », « Draconis », « Ralliement »), 11 px, après l'indicateur de rôle. **Le sous-titre de la tuile est réduit à la nature** (« Chronique », « La convergence des Sortilèges ») : le nom du système ne s'y répète plus.
- **SystemBadge** : rond de 26 px au coin bas-droit de la vignette, glyphe de 19 px. **R1** (Ryuutama), **L1** (Ralliement). Sans badge dessiné (Draconis aujourd'hui), la pastille texte seule suffit.
- Le badge est décoratif (`aria-hidden`) ; le nom du système est porté par la pastille texte. `[ASSUMPTION]` pour les en-têtes de partie : même couple.

### 7.6 ⚠️ TileCancelled — la carte annulée

Contenu estompé à 50 %, **trait diagonal semi-transparent** (rouge `status-unavailable` à 60 %) sur toute la carte, et la mention texte **« Annulée »**. Le trait **ne porte jamais seul** le sens (§8). **Ce qui change** : la liste validée ne connaissait que « terminée » ; « annulée » est un état distinct, masqué par la même case (« Masquer les clos et les annulés »).

### 7.7 EventDialog — la fenêtre d'une conjonction

La **`DetailSurface` élargie** (`min(900px, 96vw)`). Ordre vertical fixe : **titre + badge d'état → encadré de situation → La fiche → Inscrits → pied** (« Me désinscrire » ou « Modifier · Annuler la conjonction », puis « Refermer »).

- **Encadré de situation** (`SituationPanel`) — membre : cadre `status-todo` ; texte « Vote à faire. Vous êtes inscrit·e : donnez vos disponibilités avant le … » ; **trois cases de résumé** (`VoteSummary`) : « Vos réponses : 3 créneaux sur 20 », « Meilleur créneau pour l'instant : … — 4 oui » ; bouton principal « **Voter dans le calendrier** ». Hôte : cadre `accent-1` ; cases « Réponses : 3 sur 5 inscrits », « Meilleur créneau », « N'ont pas encore répondu : … » ; actions « Fixer la date… », « Prolonger le vote », lien « Voir dans le calendrier → ».
- **Inscrits** — `ParticipantChip` : avatar de 26 px + nom, une pastille par personne ; **la vôtre** a un bord `accent-1`. **Place réservée non acceptée** : visible **de l'hôte seul**, pastille **pointillée**, avatar estompé, texte « *Nom* — invité·e, n'a pas encore accepté » à **plein contraste** (§8).
- **Le vote ne se fait pas dans la fenêtre** : le calendrier a déjà tout ce qu'il faut (mode « Destinée », piste de vote). Pas de plafond de créneaux.

### 7.8 ⚠️ DangerZone — la zone sensible du Compte

**Ce qui change** (page « Mon grimoire personnel » validée) : une section **« Zone sensible »** en bas, **sous « Fermer le grimoire »** (qui est la **déconnexion**, à ne pas confondre), séparée par un filet. Contenu : l'étiquette, une phrase d'explication en 13 px, et l'action **« Effacer mon compte »** : pilule **contour rouge**, glyphe corbeille 18 px.

### 7.9 ⚠️ DestructiveConfirm — la confirmation rouge

**Ce qui change** (`ConfirmDialog` validée : « Votre accord » + « Renoncer » + « Effacer » en vert) : pour les actions **irréversibles**, le bouton de confirmation est **rouge plein** (`status-unavailable`, texte `primary-bg`). « Renoncer » reste le bouton d'**annulation** (texte du thème). La fenêtre d'effacement de compte ajoute une **liste** de ce qui disparaît et un **champ mot de passe**.

### 7.10 Fenêtre de création — composition (aucun nouveau token)

La fenêtre « Nouvelle conjonction » (EXPERIENCE.md §2.6 bis) réutilise `EventDialog` (§7.7) et ne crée **aucun style neuf** : champs à contour (`{radius}` 6 px, bord `rgba(255,255,255,.3)`), **bascules en pilule** (la même famille que `ModeSwitch`), **stepper** de places (pilule à trois cases), **puces** de membres (`ParticipantChip`), bouton principal plein et « Renoncer » en bouton secondaire. Les blocs conditionnels (date, participation) sont des **encadrés** de 12 px d'arrondi, bord `rgba(255,255,255,.12)`.

### 7.11 Réutilisés tels quels (aucun changement)

`StatusBadge`, `ContextualHeader`, `ListControlBar`, `DetailSurface` (sauf largeur), `CalendarCell`, `CalendarLegend`, mode « Destinée », `PartyBanner`, `RosterRail`.

## 8. Do's and Don'ts

**Do**
- Un bouton de création **global**, dans l'en-tête, **pour tout utilisateur**.
- Dire **qui je suis dans cette rencontre** (situation) **avant** de décrire la rencontre.
- **Texte + forme + couleur** : jamais la couleur seule (« Annulée » écrit, badge de statut avec mot).
- Garder le **texte** de la pastille « place réservée en attente » à **plein contraste** ; seul l'avatar et le bord s'estompent.
- Rouge **réservé** à l'irréversible et à l'annulé.
- `min-height` / `min-width` sur les boutons de l'en-tête ; cible tactile ≥ 44 px (le bouton mobile fait 48 × 40 : ajouter une zone de toucher de 44 px de haut).
- Fenêtre de conjonction : **retour** (touche Échap, « Refermer », geste précédent du navigateur) ramène **exactement** à la liste (filtres, défilement).

**Don't**
- Pas de « + » générique pour la création (remplacé par l'icône §7.1).
- Pas d'`<input type=file>` natif visible.
- Pas de vote dans la fenêtre (renvoi au calendrier) ; pas de plafond de créneaux.
- Pas de rouge pour un état « normal » (retard, attente) : c'est `status-todo`.
- Pas de badge de système dans un cercle rogné autrement que celui défini (26 px) ; pas de glyphe sous 19 px.
- Pas de masque SVG ni d'identifiant dans les glyphes.
- Pas de thème dans les e-mails (EXPERIENCE.md §3).
- Ne pas redessiner ici le calendrier, le sondage, l'inscription, ni les écrans de JDR (hors périmètre, Palier 10.6 et 10.8).
