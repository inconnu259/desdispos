---
title: "jdr-master Design System — Delta Palier 10.4 Sondage et Destinée dans le calendrier"
status: final
created: 2026-10-20
updated: 2026-10-20
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/DESIGN.md"
sources:
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/prd.md
  - _bmad-output/planning-artifacts/prds/prd-jdr-master-2026-10-19-p10-4/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/mockups/contrat-ui-calendrier.html
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-08/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-20/.memlog.md
# Aucun token de thème ajouté. Tokens component-scoped, qui référencent les tokens existants.
# Valeurs de la planche mockups/proposition-tiroir-destinee-mobile.html ; les spines l'emportent sur elle.
components:
  destiny-sheet:                       # plateau de la destinée, mobile < 768 px (⚠️ §7.1)
    placement: "bas de l'écran, pleine largeur, au-dessus de la grille"
    backgroundColor: "{colors.surface-container-high}"
    rounded: "18px 18px 0 0"
    shadow: "0 -6px 24px rgba(0,0,0,.5)"
    grabber: "40 × 4 px, {colors.outline}, rayon 2 px"
    padding: "8px 14px 14px"
    heightCollapsed: "≈ 120 px (résumé + deux boutons)"
    heightExpanded: "jusqu'à 150 px sous le haut de l'écran ; défilement interne"
    scrim: none                        # non modal : la grille reste utilisable
  destiny-list-sheet:                  # liste des destinées, mobile < 1024 px (⚠️ §7.2)
    inherits: "display-surface--sheet du panneau « Affichage » (P9)"
    scrim: "rgba(0,0,0,.45)"           # modal
    rounded: "18px 18px 0 0"
  destiny-list-menu:                   # liste des destinées, ≥ 1024 px
    inherits: "menu ancré du panneau « Affichage » (overlay CDK)"
  destiny-board:                       # plateau de la destinée, ≥ 768 px (⚠️ §7.1)
    placement: "colonne de droite ; remplace son contenu tant que la Destinée est active"
    widthPartie: "flex 0 0 40 %, min 280 px (colonne MJ existante)"
    widthPersonal: "340 px, min 260 px (colonne joueur / groupe existante)"
    sticky: "top 16 px, max-height 100vh − 48 px, défilement interne"
  destiny-line:                        # ligne de la liste des destinées
    backgroundColor: "{colors.surface-container-highest}"
    rounded: 10px
    padding: "9px 10px"
    groupHeading: "11,5 px, capitales, espacement .04em, {colors.text-muted}"
  candidate-slot-row:                  # créneau candidat dans le plateau
    backgroundColor: "{colors.surface-container-highest}"
    rounded: 10px
    padding: "8px 10px"
    yesBar: "4 px, fond #3a3150, remplissage {colors.status-todo} proportionnel aux oui sur la troupe"
    current: "contour 2 px {colors.accent-1}"
    bestTag: "10,5 px, {colors.accent-1}, texte « meilleur »"
  state-tag:                           # pastille d'état dans la liste des destinées
    rounded: 999px
    typography: "11px"
    padding: "2px 8px"
    todo: "{colors.status-todo} à 18 % de fond, bordure à 50 %"
    answered: "{colors.accent-1} à 15 % de fond, bordure à 45 %"
    organizer: "{colors.accent-2} à 18 % de fond, bordure à 50 %"
    notVoter: "{colors.text-muted}, contour {colors.outline}"
  side-dock:                           # colonne de droite rangée en dock, ≥ 768 px (⚠️ §7.3)
    width: 44px
    placement: "collée au bord droit du calendrier, pleine hauteur de la colonne, sticky"
    backgroundColor: "{colors.surface-container}"
    rounded: "12px 0 0 12px"
    toggle: "flèche ‹ en tête, cible 44 × 44 px"
    label: "texte vertical (writing-mode: vertical-rl), 12,5 px / 600, libellé + compteur"
    collapseControl: "flèche › dans l'en-tête de la colonne ouverte"
  automate-list-header:                # en-tête des fenêtres de l'automate (⚠️ §7.3)
    kind: "≥ 768 px : titre + compteur + flèche › (range la colonne) ; < 768 px : bouton pleine largeur + chevron, aria-expanded"
    minHeight: 44px
  automate-card-selected:              # fenêtre de l'automate sélectionnée (⚠️ §7.3)
    border: "2px solid {colors.accent-1}"
    actions: "« Ajouter au vote » bouton plein ; « Masquer » bouton texte"
  automate-card-masked:
    opacity: .55
    action: "« Démasquer » bouton texte"
  propose-dates-action:                # bouton « Proposer des dates » (⚠️ §7.4)
    kind: "mat-stroked-button écrit, ligne .calendar-controls, à la place de l'armement du composer"
    minHeight: 36px
  mode-switch-explained:               # bascule de mode sur deux lignes (⚠️ §7.6)
    inherits: "mode-switch (P10 §7.2), mat-button-toggle-group"
    line1: "nom du thème, 14 px / 500"
    line2: "ligne en clair, 12 px, {colors.text-muted}"
    minHeight: 56px
  nature-option-hint:                  # ligne d'explication sous une nature (§7.6)
    typography: "12px, {colors.text-muted}"
    marginTop: 2px
  rendezvous-picker:                   # choix du rendez-vous à dater (§7.5)
    mobile: "tiroir modal, même patron que destiny-list-sheet"
    desktop: "≥ 1024 px : menu ancré, comme destiny-list-menu ; une ligne = un choix, sans bouton de confirmation"
  duration-stepper:                    # durée d'un rendez-vous (⚠️ §7.7) — composer, fenêtre d'événement, éditeur de séance
    kind: "pilule à trois segments « − | n créneaux | + », contour {colors.outline}, rayon 999px"
    plusMinus: "14 px / 700, {colors.accent-1} ; grisé à la borne (1, plafond)"
    value: "12,5 px / 600"
    minTarget: 44px
    plainText: "12 px, {colors.accent-1}, à droite ou dessous : plage au départ choisi, sinon « soit N jours »"
  deadline-field:                      # fin du vote (⚠️ §7.7)
    kind: "libellé {colors.text-muted} + date dans un champ à contour, crayon {colors.accent-1}"
    rounded: 8px
    hint: "11,5 px, {colors.text-muted}, explique le défaut"
  span-bands:                          # plage sur plusieurs créneaux, bandes reliées (⚠️ §7.8)
    covered: "marquage existant de la bande : vote = fond {colors.status-todo} 16 % + liseré gauche 3 px ; séance fixée = traitement séance existant"
    connector: "triangle 5 px de la couleur du liseré, au bord droit de la dernière bande d'un jour et au bord gauche de la première du lendemain"
    label: "nom sur la première bande visible de chaque ligne de semaine (et en tête de la vue si la plage a commencé avant, précédé de « ← »), 8,5-9,5 px, tronqué"
    preview: "état preview existant (36.3) : fond {colors.accent-1} 22 %, pointillé 1,5 px {colors.accent-1}, sur toutes les bandes de la plage"
---

# jdr-master — Design System — Delta Palier 10.4

**Ce document est un delta** du delta Palier 10 (`ux-jdr-master-2026-10-08/DESIGN.md`), lui-même héritier du delta Palier 9 qui porte le contrat du calendrier. Il n'ajoute **aucun token de thème** : palette, typographie et trois thèmes sont inchangés. Il fixe l'apparence des surfaces neuves (tiroir et plateau de la destinée, liste des destinées, choix du rendez-vous, compteur de durée, fin du vote, plages en bandes reliées) et des retouches d'écrans validés, signalées ⚠️.

**Mise à jour du 2026-10-20, après l'architecture** : trois composants pour les plages longues et l'échéance (`duration-stepper`, `deadline-field`, `span-bands`, §7.7 et §7.8), toujours sans token de thème. Retouches : `rendezvous-picker` passe en menu ancré sur ordinateur (§7.5) ; dans la vitrine, plateau sans noms et « Modifier les dates » vers l'atelier (§7.1, §7.4). Options comparées : [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html), retenues **1A** et **2A**.

En cas de conflit entre ce document et une planche de `mockups/`, **ce document gagne**.

---

## 1. Brand & Style

Inchangé. Le calendrier reste l'outil le plus « fonctionnel » de l'application : les nouvelles surfaces reprennent les patrons qu'il a déjà (tiroir du panneau « Affichage », colonne de droite, fenêtre « Votre accord ») plutôt que d'en inventer.

## 2. Colors

Aucune couleur nouvelle.

- Les créneaux candidats gardent le marquage du vote : fond `{colors.status-todo}` à 16 % et liseré gauche de 3 px (`{components.CalendarCell}`, P9 §7.9).
- La barre de oui du plateau utilise `{colors.status-todo}` ; le créneau courant, `{colors.accent-1}` ; « Organisateur », `{colors.accent-2}`.
- L'estompe de la Destinée reste à `opacity .28`, au jour (Story 36.9). La sélection d'une fenêtre de l'automate réutilise exactement cette estompe (§7.3).
- Aucune information n'est portée par la seule couleur : chaque pastille a son texte, le meilleur créneau son mot « meilleur », le créneau courant son rang « n / N ».
- Une plage longue réutilise les marquages de bande existants (vote, séance) ; l'aperçu de sélection réutilise l'état preview (36.3). Aucune teinte propre aux plages.

## 3. Typography

Inchangée. Titres de tiroir 15 px / 600 ; sous-titres 12 px `{colors.text-muted}` ; en-têtes de groupe 11,5 px en capitales.

## 4. Layout & Spacing

- **Deux seuils, déjà dans le code** : 768 px pour la mise en page en deux colonnes, 1024 px pour la bascule menu / tiroir du panneau « Affichage ». Le plateau suit **768 px** (c'est une colonne) ; la liste des destinées et le choix du rendez-vous suivent **1024 px** (ce sont des menus). `[ASSUMPTION]`
- **Calendrier personnel ≥ 768 px** : il n'a pas de colonne de droite aujourd'hui. Elle apparaît, en largeur « joueur / groupe » (340 px), **seulement quand la Destinée est active**, et disparaît avec elle. `[ASSUMPTION]`
- **Barre du composer** : deux lignes de plus (Durée, Fin du vote) sous « Pour : … » ; sur mobile, elle reste collée en bas et la grille défile au-dessus.
- **Mobile < 768 px** : la colonne de droite reste empilée sous la grille pour son contenu habituel ; seul le plateau de la destinée passe en tiroir du bas.

## 5. Elevation & Depth

- Le tiroir de la destinée flotte au-dessus de la grille (ombre vers le haut), **sans fond assombri** : la grille reste lisible et touchable.
- La liste des destinées et le choix du rendez-vous sont **modaux** : fond assombri `rgba(0,0,0,.45)`, comme le panneau « Affichage ».

## 6. Shapes

Tiroirs : coins supérieurs 18 px, poignée 40 × 4 px. Lignes et créneaux : 10 px. Pastilles : 999 px.

## 7. Components

### 7.1 ⚠️ DestinySheet / DestinyBoard — le plateau de la destinée

Une seule surface, deux formes : **tiroir** sous 768 px, **colonne de droite** au-delà. Planche : [`mockups/proposition-tiroir-destinee-mobile.html`](mockups/proposition-tiroir-destinee-mobile.html), écrans ② et ③.

- **Replié (mobile, ≈ 120 px)** : nom du vote ; ligne « n / N · {départ} → {fin} · x oui · fin du vote … » (créneau unique : « n / N · {date} {moment} · x oui · fin du vote … ») ; pastille d'état ; deux boutons : « Voir les N dates » (déplie) et l'action principale du rôle (« Fixer la date… » pour l'organisateur, rien pour un votant, qui répond sur la grille).
- **Déplié / colonne** : titre, sous-titre (« Fin du vote {date} », « Vote terminé · plus de vote possible » ensuite, « x réponses sur N »), liste de `candidate-slot-row`, ligne « N'ont pas … » (clé existante `poll.missing_prefix`) **pour l'organisateur seulement** (« {n} n'ont pas encore répondu » pour les autres participants), puis les actions de l'organisateur : « Modifier les dates » (contour) et « Fixer la date… » (plein, `{colors.gradient-cta}`) ; en mode soirée, « Prolonger le vote » s'ajoute.
- Sous les actions de l'organisateur, un lien texte « Proposer des dates pour un autre rendez-vous ».
- Un créneau candidat long (plusieurs créneaux) s'écrit « ven. 6 soir → dim. 8 après-midi » dans sa `candidate-slot-row`.
- Remplace, tant que la Destinée est active, le contenu de la colonne MJ (bloc « qui manque », Du / Au, fenêtres de l'automate) ; garde en pied l'en-tête replié « Éphémérides · N » (`automate-list-header`) ; masqué pendant le composer.
- ⚠️ **Dans la vitrine** (calendrier personnel), la ligne « N'ont pas … » devient « {n} n'ont pas encore répondu » et, pour l'organisateur, un lien texte « voir qui » ; « Modifier les dates » y mène à l'atelier mais garde l'apparence du bouton.

### 7.2 ⚠️ DestinyList — la liste des destinées

Ouverte par la puce ✦. Planche : écran ①. Tiroir modal sous 1024 px, menu ancré au-delà.

- En-têtes de groupe = **nom de la partie ou du ralliement**, jamais un mot générique.
- `destiny-line` : nom du vote, ligne « Fin du vote … · N créneaux » (« Vote terminé » ensuite), `state-tag` à droite.
- La puce ✦ garde son libellé « ✦ Destinée » au repos et « ✦ Destinée · {nom du vote} » une fois active (36.9) ; elle **ouvre la liste** au lieu de basculer le mode. Quitter le mode passe par une ligne « Quitter la Destinée » en tête de liste quand une destinée est active. `[ASSUMPTION]`

### 7.3 ⚠️ AutomateList — les fenêtres de l'automate

Planche : [`mockups/proposition-colonne-mj-ephemerides.html`](mockups/proposition-colonne-mj-ephemerides.html) (fenêtre sélectionnée ; composer en cours).

- **En-tête** (`automate-list-header`) : « {libellé du thème} · N ». Sur ordinateur, la flèche **›** range toute la colonne en `side-dock` (44 px) collé au bord droit, et la grille reprend la largeur ; la flèche **‹** du dock la rouvre. Sur mobile, un chevron replie la liste. Les champs Du / Au et « Scruter » vivent **sous** l'en-tête, visibles seulement colonne ouverte ou liste dépliée.
- **Carte sélectionnée** (`automate-card-selected`) : contour `{colors.accent-1}` 2 px ; deux actions écrites. Dans la grille, la bande de la fenêtre prend le même contour, et **tous les autres jours** prennent l'estompe de la Destinée (.28) — sauf composer ouvert, où rien n'est estompé (le composer a la priorité).
- **Carte dans le composer** : elle quitte la liste (PRD FR-2) ; la bande prend le liseré orange tireté « désigné pour le vote » existant (36.10).
- **Fenêtres masquées** : un lien « Afficher les N masquées » en pied de liste ; une carte masquée, à 55 % d'opacité, porte « Démasquer ».

### 7.4 ⚠️ ProposeDatesAction — le bouton « Proposer des dates »

Bouton écrit, contour, dans la ligne `.calendar-controls`, à la place du bouton d'armement du composer (« Inscrire des dates » MJ) et des boutons « Composer les créneaux : {titre} » de l'hôte. Il devient « Modifier les dates » quand la destinée active est un sondage dont on est organisateur. Absent s'il n'y a rien à proposer ni à modifier. ⚠️ Dans la vitrine, même apparence, mais il mène à l'atelier (pas de composer dans le calendrier personnel).

### 7.5 RendezvousPicker — le choix du rendez-vous à dater

Liste groupée par partie (même rendu que `destiny-line`, sans pastille), une ligne par rendez-vous : nom du rendez-vous et, dessous, sa nature (« séance sans date », « séance au vote ouvert », « soirée sans date »). Tiroir modal sous 1024 px, menu ancré au-delà ; une ligne = un choix, sans bouton de confirmation. Aucun écran si un seul rendez-vous est possible.

### 7.6 ⚠️ ModeSwitch et nature expliqués — le formulaire de création

La bascule Quête | Ralliement (et ses variantes) passe sur deux lignes : le nom du thème, puis la ligne en clair (« Jeu de rôle », « Soirée entre amis ») en `{colors.text-muted}`. La hauteur minimale passe de 44 à 56 px. Chaque option de nature porte sa ligne d'explication en dessous, même style. Textes : `EXPERIENCE.md` §2.7.

### 7.7 ⚠️ Composer : durée et fin du vote

Option 1A de [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html). Dans `app-compose-bar`, sous « Pour : … » :

- ligne **Durée** : libellé `{colors.text-muted}`, `duration-stepper`, puis le texte en clair `{colors.accent-1}` (plage au départ choisi, sinon « soit N jours » dès 3 créneaux) ;
- ligne **Fin du vote** : `deadline-field`, et dessous l'explication du défaut.

Le même `duration-stepper` figure dans la fenêtre de création ou de modification d'un événement et dans l'éditeur de séance, sous le champ de date, libellé « Durée », prérempli à 1 créneau ; son texte en clair donne la plage si la date est saisie, sinon « soit N jours ».

### 7.8 ⚠️ SpanBands : une plage sur plusieurs jours

Option 2A de [`mockups/options-plages-longues.html`](mockups/options-plages-longues.html). En Mois comme en Semaine :

- **Bandes** : chaque bande couverte prend le marquage de sa nature (vote ou séance) ; le reste du jour garde ses bandes normales.
- **Connecteur** : un `connector` relie la dernière bande d'un jour à la première du lendemain ; au changement de semaine, il sort par le bord droit du dimanche et entre par le bord gauche du lundi.
- **Nom** : sur la première bande **visible** de chaque ligne de semaine, et en tête de la vue affichée quand la plage a commencé avant ; précédé alors de « ← ».
- **Chevauchement** : une bande couverte par plusieurs plages du même vote porte « ×{n} » en 9 px, `{colors.text}`, coin supérieur droit.
- **Aperçu** : la sélection allume toutes les bandes de la plage en état preview.

Agenda : une seule ligne « départ → fin » ; rail : la plage sur chaque jour couvert, « (suite) » hors du premier.

### 7.9 Réutilisés tels quels

`{components.CalendarCell}`, `{components.DetailRail}` (jamais estompé), `app-compose-bar` (cible, compte, Valider / Annuler), la barre de sélection des dispos (36.3, portée Journée · Matin · Après-m. · Soir), `DateFixDialog` (40.6), `ExtendVoteDialog` (40.7), `SealConfirmDialog` (36.12), le sélecteur de réponse de vote.

## 8. Do's and Don'ts

- **Do** garder la grille visible quand le plateau est replié : c'est tout l'intérêt du tiroir.
- **Do** réutiliser l'estompe de la Destinée pour mettre en avant une fenêtre de l'automate : un seul langage visuel pour « regarde ceci ».
- **Do** montrer la plage entière dès qu'on touche un départ : l'aperçu est le garde-fou contre une mauvaise durée.
- **Don't** estomper le rail de détail, ni retirer les pointeurs ou l'accessibilité d'un jour estompé (36.9).
- **Don't** écrire « partie » ou un mot du JDR dans une surface que le mode soirée affiche ; nommer par le nom propre.
- **Don't** ajouter une couleur pour « meilleur créneau » : le mot suffit.
- **Don't** dessiner une plage en barre continue par-dessus les cases (option 2B écartée) : elle cacherait les bandes qu'elle recouvre, ainsi que le moment exact du départ et de la fin.
