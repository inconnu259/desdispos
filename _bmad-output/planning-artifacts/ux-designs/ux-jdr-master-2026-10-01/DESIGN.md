---
title: jdr-master Design System — Delta Réserve de souffles de l'Homme Dragon (Story 33.6)
status: final
updated: 2026-10-02
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-31/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260703/DESIGN.md"
  - "_bmad-output/implementation-artifacts/epic-33-context.md"
  - "_bmad-output/implementation-artifacts/spec-33-7-capacites-de-niveau.md"
  - "docs/dragons.md"
# Tokens component-scoped uniquement (aucun token de thème ajouté ni modifié). Les valeurs sont
# celles des planches ; les références {colors.*} / {radius.*} désignent les tokens existants du spine de base
# (alias nom-du-delta -> token de base / code : voir §2, « Alias »).
components:
  reserve-slot:                       # ligne d'emplacement rempli
    backgroundColor: "{colors.surface-high}"
    border: "1px solid {colors.border-subtle}"
    rounded: "{radius.card}"
    minHeight: 64px
    padding: "8px 12px"
  reserve-slot-empty:                 # emplacement vide : pointillé, jamais un aplat
    backgroundColor: transparent
    border: "1px dashed {colors.outline}"
    rounded: "{radius.card}"
    minHeight: 64px
  reserve-slot-number:                # pastille de numéro d'emplacement
    size: 32px
    border: "1px solid {colors.outline}"
    rounded: full
  reserve-category-header:            # en-tête de catégorie repliable
    minHeight: 44px
    textColor: "{colors.text-muted}"
    typography: "{typography.text-sm}, capitales, 700"
  reserve-souffle-row:                # ligne de souffle de la fenêtre (<button aria-pressed>)
    minHeight: 56px
    backgroundColor: "{colors.surface-high}"
    border: "1px solid {colors.border-subtle}"
    rounded: "{radius.card}"
  reserve-undo:                       # Annulation du dernier retrait
    backgroundColor: "{colors.surface-high}"
    border: "1px solid {colors.outline}"
    rounded: "{radius.card}"
    minHeight: 44px
  reserve-row-off:                    # ligne de souffle grisée (consultable, non plaçable)
    backgroundColor: transparent
    nameOpacity: 0.6                  # nom seul ; la pastille de coût n'est jamais atténuée
    reasonTextColor: "{colors.text-primary}"
---

# jdr-master — Design System — Delta Réserve de souffles (33.6)

Ce document est un **delta** : il hérite intégralement du delta Homme Dragon `ux-jdr-master-2026-09-23` (et, par lui, du spine de base et du wizard perso `ux-jdr-master-2026-08-31`) et **réutilise tel quel** `ChoiceCard` et la teinte de race (gemme, liséré). Il **étend de façon rétro-compatible** `DetailSurface` / `createDetailSurfaceHost()` : c'est une extension du composant partagé, non une fourche (décision en §7). Il **n'ajoute aucun token de thème**. Il ne décrit que les éléments visuels propres à la réserve (table des noms canoniques en §7) : ligne d'emplacement, emplacement vide, compteur, en-tête de catégorie repliable, ligne de souffle et ligne grisée, zone de détail.

En cas de conflit avec une planche de `mockups/`, **ce document gagne**. Planche contractuelle : [`mockups/key-reserve-final.html`](mockups/key-reserve-final.html) (fiche, fenêtre de choix, états, mobile). Planche d'exploration, **non contractuelle** : [`mockups/key-reserve-variantes.html`](mockups/key-reserve-variantes.html) (comparaison des variantes B et C ; B retenue, C écartée — voir `.memlog.md`, le journal des décisions de la passe UX, dans ce dossier).

## 1. Brand & Style

Identique au spine hérité — aucun écart.

## 2. Colors

Aucun token de thème modifié ni ajouté. Emplois de l'existant :

| Usage | Token |
| --- | --- |
| Emplacement rempli (fond) | `{colors.surface-high}`, contour `{colors.border-subtle}` |
| Emplacement vide | fond transparent, contour **pointillé** `{colors.outline}` (jamais `accent-2` à 50 % : trop faible, voir contrastes) |
| Libellé « Choisir un souffle » | `{colors.text-primary}` ; `accent-2` reste réservé à des éléments décoratifs |
| Bordure des boutons (« Changer », « Retirer », « Annuler »), pastille de numéro | `{colors.outline}` |
| Ligne de souffle consultée (`aria-pressed="true"`) | contour 2 px `{colors.text-primary}`, fond `{colors.accent-2}` à 16 %, pastille pleine à droite — **la sélection ne repose jamais sur l'accent seul** |
| Libellé de catégorie, règle d'aide | `{colors.text-muted}` |
| Raison de grisage (ligne et en-tête de catégorie) | `{colors.text-primary}` (pleine intensité : elle porte l'information), précédée de ⊘ décoratif (`aria-hidden`) |
| Nom de race (étiquettes, titres de sous-groupes, en-têtes de catégorie) | `{colors.text-primary}` / `{colors.text-muted}` — **dans cet écran, seuls la gemme et le liséré portent la teinte de race** (delta 2026-09-23 inchangé ailleurs) |
| Erreur d'enregistrement | `{colors.error}` (icône ⚠ et liséré) **et** message écrit en `{colors.text-primary}` |

**Alias** (nom utilisé dans ce delta → token de la base / du code). `[ASSUMPTION]` correspondances à confirmer à l'implémentation :

| Nom du delta | Base / code |
| --- | --- |
| `text-primary` | `text-primary` du spine de base ; `--mat-sys-on-surface` côté code |
| `surface-high` | `--mat-sys-surface-container-high` (fond réel du panneau `DetailSurface`) |
| `outline` | `--mat-sys-outline` (token d'outline d'Angular Material) |
| `error` | `--mat-sys-error` (valeur par thème) — **pas** `--color-unavailable`, global et non utilisé ici |
| `radius.card` / `radius.badge` / `radius.button` | `radius-card` / `radius-badge` / `radius-button` du spine de base |
| thème `atelier-cuivre` | `medieval-steampunk` dans le code, jusqu'au renommage FR-43 |

> **Contrastes : seuils et mesures.** Texte ≥ **4,5:1** ; contours et indicateurs d'interface ≥ **3:1** (WCAG 1.4.11). Mesuré par la revue d'accessibilité du 2026-10-02 (valeurs du code, 3 thèmes) : nom grisé à `opacity .5` = 3,97 à 4,34:1 (insuffisant) → **`opacity ≥ .6` sur le nom seul** (≥ 5,0:1 dans les trois thèmes) ; `stat-pill` atténuée = 2,0 à 2,8:1 → **jamais atténuée** ; pointillé et bordures en `accent-2` à 50 % = 1,66 à 3,46:1 (insuffisant dans deux thèmes) → token `outline`. **À mesurer** à l'implémentation, dans les trois thèmes : `outline` sur `surface` et sur `surface-high` (≥ 3:1), `text-muted` sur `surface-high` (marge mince en atelier-cuivre), `text-primary` à `opacity .6`. Les textes de race ne portent plus la teinte (Dragon Noir `#524d5e` mesurait ~2:1).

## 3. Typography

Identique au spine hérité. Tailles exprimées en **`rem`**, jamais en dessous de **12 px (0,75 rem)** — y compris étiquettes, compteurs de catégorie et intertitres (pas de 11 px). Usages : en-tête de catégorie en `{typography.text-sm}`, capitales, gras, `text-muted` ; raison de grisage en `{typography.text-sm}` ; nom de souffle en `{typography.text-base}` gras ; ligne d'info de niveau 1 en `{typography.text-base}`. Description d'une ligne de souffle : **2 lignes** (`line-clamp`), jamais une ellipse mono-ligne ; l'intégralité est dans la zone de détail.

## 4. Layout & Spacing

Identique au spine hérité : seuil desktop unique du projet à **1024 px** (fenêtre centrée au-dessus, feuille basse en dessous — comportement de `DetailSurface`), cible tactile **44 px** minimum. Précisions propres à la réserve :

- Ligne d'emplacement : hauteur minimale **64 px**, une ligne par emplacement, pastille de numéro 32 px à gauche, boutons d'action à droite (44 × 44 px minimum chacun). **Bascule en deux lignes** (contenu, puis « Changer » / « Retirer » à pleine largeur) sous **~480 px de largeur de la section** (container query sur la section, pas un seuil d'écran) ; test visuel à 320 px et à 200 % de zoom. Planche : P6a.
- Ligne de souffle de la fenêtre : hauteur minimale **56 px**.
- En-tête de catégorie : hauteur minimale **44 px**, flèche de repli ▸ / ▾ à gauche, compteur de souffles dans la catégorie.
- Fenêtre desktop : largeur adaptée à la liste (**620 px** à la planche ; la largeur par défaut de `DetailSurface` reste inchangée pour ses autres usages) ; feuille mobile : ~90 % de la hauteur, exprimée en **`dvh`**, avec `padding-bottom: max(20px, env(safe-area-inset-bottom))` sur la zone du bas. Planche : P6b. Ces comportements (largeur adaptée, `dvh`, zone sûre) sont fournis par l'extension de `DetailSurface` (§7). **Critère d'acceptation (AC) : fenêtre utilisable à 320 × 256 CSS px** (400 % de zoom, téléphone en paysage) — en-tête et pied compacts, liste défilante visible, zone de détail à `max-height` propre avec son défilement.
- Dans la fiche, la section prend la place d'une carte de la colonne gauche (largeur de colonne existante, seuil local de 768 px de la fiche inchangé) ; aucun nouveau seuil.
- **Mouvement** : aucune animation propre à la réserve ; chevrons ▸ / ▾ à rotation **instantanée**, pas d'animation de hauteur au repli ; `prefers-reduced-motion` respecté (y compris côté `DetailSurface`).

## 5. Elevation & Depth

Identique au spine hérité : fenêtre centrée desktop en `{elevation.modal}`, feuille mobile en `{elevation.panel}`. Aucun niveau nouveau.

## 6. Shapes

Identique au spine hérité : cartes et lignes en `{radius.card}`, boutons en `{radius.button}`, étiquettes et compteurs en `{radius.badge}`. Pastille de numéro d'emplacement : cercle (rayon plein).

## 7. Components

**Noms canoniques** — un seul nom par composant, identique dans EXPERIENCE.md §4 :

| Composant | Token / ancre | Contenu |
| --- | --- | --- |
| **Ligne d'emplacement** (rempli ou vide) | `reserve-slot`, `reserve-slot-empty` | pastille de numéro + souffle ou invite + boutons |
| **Compteur d'emplacements** | — | « k / N emplacements » + barre segmentée, en tête de la fenêtre |
| **Ligne d'info de niveau 1** | — | icône « i » + « La réserve de souffles s'ouvre au niveau 2. » |
| **Mention d'enregistrement** · **Message d'erreur d'enregistrement** · **Zone de statut** | — | voir plus bas |
| **Fenêtre de choix** | `DetailSurface` étendu | en-tête (titre + compteur), règle, catégories, pied (zone de détail + boutons) |
| **En-tête de catégorie** | `reserve-category-header` | repli ▸ / ▾, titre, raison, compteur |
| **Annulation du dernier retrait** | `reserve-undo` | « <Souffle> retiré de l'emplacement N. » + « Annuler » |
| **Ligne de souffle** (repos · consultée · grisée) | `reserve-souffle-row`, `reserve-row-off` | nom, coût, repère, description 2 lignes |
| **Zone de détail** | — | nom, coût, étiquette, description, raison, « Annuler » / « Mettre dans l'emplacement N » |
| **Étiquette de famille / de race** | `tag` existant | texte `text-primary`, liséré et gemme teintés |

**Ligne d'emplacement (`reserve-slot`)** — pastille de numéro (`reserve-slot-number`), puis soit le souffle (nom en gras + étiquette de famille/race + coût `stat-pill` existante), soit l'invite. À droite : « Changer » et « Retirer » si rempli ; l'emplacement vide est lui-même un bouton « Choisir un souffle » pleine largeur, libellé en `text-primary`. Un même souffle peut apparaître sur plusieurs lignes ; chaque ligne reste autonome. Noms accessibles : voir EXPERIENCE.md §7.

**Emplacement vide (`reserve-slot-empty`)** — **contour pointillé** `{colors.outline}`, fond transparent, libellé « Choisir un souffle » en `text-primary`. Le pointillé distingue « à remplir » de « rempli » sans dépendre de la couleur seule : le libellé du bouton le dit en toutes lettres.

**Compteur d'emplacements** — « k / N emplacements » (singulier : « 0 / 1 emplacement ») avec une barre de N segments dont k remplis (décorative, `aria-hidden`) ; placé **à droite de l'en-tête de la fenêtre**. La section de la fiche n'a pas de compteur : son titre dit « Niveau N · k emplacements » (même règle du singulier : « Niveau 2 · 1 emplacement »).

**Ligne d'info de niveau 1** — bloc de 44 px minimum, icône « i » dans un cercle `accent-1` et une phrase ; aucun composeur.

**Annulation du dernier retrait (`reserve-undo`)** — bandeau sous la liste des emplacements : icône ↶ décorative, texte « <Souffle> retiré de l'emplacement N. » et bouton « Annuler » (≥ 44 px, bordure `{colors.outline}`). Un seul bandeau à la fois (un nouveau retrait le remplace) ; il disparaît à la fin du délai, quand l'emplacement est de nouveau occupé, ou après « Annuler ». Planche : P5 bis. Comportement : EXPERIENCE.md §5.

**Mention d'enregistrement** — « Enregistrée automatiquement, utilisée pour l'export PDF. » en `text-muted`, **sous le titre de la section** (position unique), précédée d'un ✓ décoratif. Affichée **seulement quand la réserve est réellement enregistrée** : remplacée par « Enregistrement… » pendant l'écriture, masquée tant que l'erreur est affichée.

**Message d'erreur d'enregistrement** — icône ⚠ (décorative) + texte, liséré `{colors.error}` et fond teinté d'une nuance légère de `{colors.error}`, **sous les emplacements** ; nœud `role="alert"` recréé à chaque échec. **Zone de statut** — nœud `role="status"` persistant, visuellement masqué (`sr-only`), présent dès le chargement de la section.

**En-tête de catégorie (`reserve-category-header`)** — dans la fenêtre de choix : flèche ▸ (repliée) / ▾ (dépliée), titre de catégorie, compteur de souffles, et — quand la catégorie est repliée parce que rien n'y est choisissable — la **raison en une ligne**, avec le **même vocabulaire que sur les lignes** (« ⊘ Admis dès le niveau 5 », « ⊘ Non réservable : souffle du temps », « ⊘ Un seul souffle d'une autre race »). Quand « Autres races » est dépliée, l'en-tête garde l'indication « 0 / 1 souffle autorisé » (information, non une raison). Une catégorie par groupe : Communs par famille, souffles de la race, autres races, rituels. Intertitres de groupe : « Souffles communs », « Votre race », « Autres races et rituels ».

**Ligne de souffle** (`reserve-souffle-row`) — bouton natif pleine largeur : nom + coût (`stat-pill`) + repère éventuel + description sur 2 lignes. Repère non bloquant « Déjà dans l'emplacement N » (pastille `accent-1`) sur un souffle commun ou de la race déjà placé. Consultée : contour 2 px + pastille pleine.

**Ligne grisée (`reserve-row-off`)** — fond transparent, **nom à `opacity ≥ .6`**, pastille de coût **non atténuée**, **icône ⊘ + raison écrite** à pleine intensité sous le nom. Reste lisible et **focalisable** (`aria-disabled="true"`, jamais `disabled`), jamais masquée. **Elle se consulte mais ne se place pas** : son détail (description) s'affiche dans la zone de détail, où « Mettre dans l'emplacement N » reste visible en `aria-disabled="true"`, la raison liée par `aria-describedby` (comportement : EXPERIENCE.md §4). Raisons de la planche : souffle du temps, quota d'autre race, souffle d'autre race déjà placé, rituel avant le niveau 5. Planche : P4 ter.

**Zone de détail** — nom, coût, étiquette, description complète, note éventuelle (« Déjà dans l'emplacement 2 : un même souffle peut occuper plusieurs emplacements. ») ou raison, puis deux boutons : **« Annuler »** (secondaire, ferme sans rien modifier) et **« Mettre dans l'emplacement N »** (principal). « Retirer » n'est **pas** dans la zone de détail : il reste sur la ligne d'emplacement.

**Fenêtre de choix** — réutilise **et étend** `DetailSurface` (voir « Extension » ci-dessous) : **en-tête** (slot `header` : titre « Choisir un souffle pour l'emplacement N » et compteur d'emplacements, bouton de fermeture de 44 px), règle d'aide, corps défilant (catégories, dans des `role="group"` nommés), **pied épinglé** (slot `footer` : zone de détail du souffle consulté, « Annuler », « Mettre dans l'emplacement N »). Planches : P3, P4, P6b. Niveaux de titre cohérents avec le `h2` du composant : `h2` titre, `h3` en-têtes de catégorie, `h4` sous-groupes de race.

**Extension de `DetailSurface` (décision utilisateur, option A).** Le composant partagé `DetailSurface` est **étendu de façon rétro-compatible** — ce n'est pas une fourche : un seul composant, de nouvelles capacités optionnelles, aucun changement pour qui ne les utilise pas. Contenu de l'extension : (1) slots **`header`** et **`footer`** personnalisables (en-tête : titre + compteur ; pied : zone de détail épinglée + boutons) ; (2) hauteur en **`dvh`** avec zone sûre (`env(safe-area-inset-bottom)`) ; (3) **`max-height` propre** de la zone de détail, avec son défilement ; (4) bouton de fermeture de **44 px**, libellé **« Fermer la fenêtre »** (modale desktop) / **« Fermer la feuille »** (feuille mobile) selon la forme ; (5) largeur desktop adaptée par usage ; (6) bloc **`prefers-reduced-motion`** sur ses animations (feuille, fenêtre). Les usages existants conservent leur rendu par défaut ; ceux qui bénéficient du bouton de fermeture à 44 px et du bloc `reduced-motion` sont à re-vérifier (liste en EXPERIENCE.md §10, point 7). AC : voir §4 (320 × 256 CSS px).

## 8. Do's and Don'ts

**Do** : un emplacement = une ligne = un bouton ; une ligne de souffle = un bouton natif. Toujours écrire la raison d'un grisage, avec le même vocabulaire en-tête et ligne. Réutiliser `DetailSurface` (étendu de façon rétro-compatible, jamais forké), `ChoiceCard` (sélection), `stat-pill` et la gemme / le liséré de race tels quels. Garder le nom de race en `text-primary` / `text-muted`. Exprimer les tailles en `rem` (≥ 0,75 rem).

**Don't** : ne jamais masquer un souffle interdit (la liste complète doit rester consultable instantanément). Ne jamais représenter l'état d'un emplacement, d'une sélection ou d'un grisage par la seule couleur ou le seul pointillé. Pas de teinte de race sur du texte dans cet écran. Pas d'atténuation de la pastille de coût. Pas d'ellipse mono-ligne sur les descriptions. Ne pas ajouter de compteur « utilisé / restant » en jeu (aucun décompte). Pas de dialogue de confirmation sur « Retirer » (Annulation du dernier retrait à la place). Pas de réserve par séance, pas de bouton « Vider la réserve », pas de stepper +/− (variante C). Ne pas introduire de second seuil desktop, ni de token de thème.
