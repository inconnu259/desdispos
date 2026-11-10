---
title: jdr-master Design System — Delta écrans d'authentification et identité de marque (Story 34.3)
status: final
updated: 2026-10-05
themes: [grimoire-emeraude, foret-ancienne, atelier-cuivre]
ui_system: Angular Material 22
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"
  - "_bmad-output/implementation-artifacts/spec-34-3-mise-en-forme-des-ecrans-dauthentification.md"
  - "_bmad-output/implementation-artifacts/epic-34-context.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-20260626/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/.memlog.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/review-accessibilite.md"
# Tokens component-scoped, plus UNE correction de token de thème : `--mat-sys-outline` (bord des champs) dans les trois
# thèmes, pour toute l'application (voir §2). Aucun token ajouté. Les valeurs viennent des écrans de
# référence validés (mockups/key-connexion.html, mockups/key-rejoindre.html) ; les références {colors.*} /
# {typography.*} désignent les tokens existants (alias nom-du-delta -> token de base / code : voir §2, « Alias »).
components:
  auth-band:                          # bande de marque au-dessus de la carte, décor animé + bloc-marque
    minHeight: 196px                                  # jamais `height` : la bande grandit avec la taille de texte
    backgroundColor: "radial-gradient(ellipse 80% 95% at 50% 30%, {colors.banner-glow}, {colors.primary-bg})"
    border: "1px solid {colors.outline-variant}"      # bord bas en mobile ; 4 côtés en bureau
    rounded-desktop: 14px                             # mobile : bande pleine largeur, aucun arrondi
    overflow: "hidden sur le calque de décor (auth-band-scene) uniquement, jamais sur la bande"
  auth-band-scene:                    # SVG inline décoratif (aria-hidden)
    viewBox: "440 x 180"
    preserveAspectRatio: "xMidYMid slice"
    interaction: "clic / toucher sur la scène = pause / reprise ; aucun bouton visible (EXPERIENCE.md §4)"
    paused-state: "animation-play-state: paused : gel sur place, état non mémorisé ; PAS un retour au repos"
    rest-state: "animation: none (prefers-reduced-motion) ; .fly (comète) à opacity 0 de base : la comète n'existe qu'en mouvement (définition : §1)"
  auth-band-watermark:                # emblème E1 du thème en filigrane
    size: 200px
    position: "x 245, y -12 dans la scène (déborde à droite)"
    opacity: 0.30
  auth-band-scrim:                    # voile qui garantit le contraste du texte
    background: "radial-gradient(ellipse 62% 78% at 30% 55%, {colors.primary-bg} à 60 %, transparent 82%)"
    pointerEvents: none                               # la zone cliquable de la pause est la scène
  brand-block:                        # logo G + nom, premier plan de la bande
    padding: "10px 22px"
    alignment: gauche, centré verticalement
    textColor: "{colors.text-primary}"
    gap: 11px
  brand-logo:
    size: 46px
    color: "{colors.text-primary}"                    # monochrome, currentColor
  brand-name:                         # « Dés Dispos »
    typography: "Georgia, 'Times New Roman', serif ; 32px ; lineHeight 1 ; 700 ; letterSpacing .01em"
    textShadow: "0 1px 10px {colors.primary-bg}"
  brand-tagline:                      # accroche du thème
    typography: "Georgia, 'Times New Roman', serif ; italique ; 14px ; lineHeight 1.3"
    maxWidth: 232px
    marginTop: 12px
    opacity: 0.93
    textShadow: "0 1px 8px {colors.primary-bg}"
  auth-card:                          # carte commune (formulaire, lien, état)
    backgroundColor: "{colors.surface-bg}"
    border: "1px solid {colors.outline-variant}"
    rounded: 14px
    padding: "20px 18px 16px"
    margin-mobile: 16px                               # = {spacing.base}
    marginTop: 16px                                   # sous la bande
    width-desktop: 448px                              # colonne centrée dès 480 px
  auth-card-title:                    # <h1 matCardTitle> : l'unique h1 de l'écran
    typography: "20px ; lineHeight 1.2 ; 600"
    textColor: "{colors.text-primary}"
    overflowWrap: anywhere                            # un nom de partie sans espaces ne déborde pas (rejoindre)
    marginBottom: 16px                                # 4px s'il y a un sous-titre
  auth-card-subtitle:
    typography: "{typography.text-base} ; lineHeight 1.3"
    textColor: "{colors.text-muted}"
  auth-card-body:
    typography: "{typography.text-lg} ; lineHeight 1.5"
    textColor: "{colors.text-primary}"
    marginBottom: 20px
  auth-field:                         # mat-form-field appearance="outline"
    height: 56px
    rounded: 8px                                      # [ASSUMPTION] voir §6 : écart avec {radius.input} (4px)
    border: "1px solid {colors.outline}"              # jeton corrigé : #6e6383 / #54735c / #8b6541 (§2), 3,1 à 3,3:1
    gap: 16px
    labelTypography: "{typography.text-lg} au repos, {typography.text-sm} flottant"
    labelColor: "{colors.text-muted}"                 # le libellé ne porte plus de consigne de règle (voir auth-field-hint)
  auth-field-hint:                    # mat-hint sous le champ : « 8+ caractères » (mots de passe)
    typography: "13px"                                # rôle « Aide » (§3)
    textColor: "{colors.text-muted}"
  auth-field-error:                   # mat-error : un court message écrit par règle non respectée
    typography: "13px"                                # [ASSUMPTION] même taille que l'aide : le message la remplace sans saut
    textColor: "{colors.error}"
  focus-ring:                         # :focus-visible, liens et boutons de la carte
    outline: "2px solid {colors.accent-1}"
    outline-offset: 2px                               # jamais `outline: none`
  password-toggle:                    # bouton de révélation livré en 34.2, conservé tel quel
    minSize: 44px
    iconSize: 24px                                    # valeur du code livré (la maquette montre 22px : le code fait foi)
    textColor: "{colors.text-muted}"
    rounded: 50%
  auth-error:                         # erreur du formulaire (role="alert") ; les erreurs de champ : auth-field-error
    typography: "{typography.text-base} ; lineHeight 1.4"
    textColor: "{colors.error}"
    margin: "-4px 0 12px"                             # sous les champs, au-dessus du bouton principal
  auth-status:                        # conteneur persistant role="status" : réussites, « Chargement… »
    typography: "{typography.text-lg} ; lineHeight 1.5"
    textColor: "{colors.text-primary}"
  auth-primary-action:                # une seule par carte
    width: 100%
    minHeight: 48px                                   # jamais `height` : le libellé passe à la ligne
    paddingBlock: 12px
    rounded: 24px                                     # pilule (demi-hauteur d'une ligne)
    backgroundColor: "{colors.accent-1}"
    textColor: "{colors.on-primary}"
    typography: "15px ; lineHeight 1.3 ; 600 ; letterSpacing .01em ; white-space normal"
    marginTop: 4px
  auth-secondary-actions:             # rangée distincte, sous l'action principale
    marginTop: 10px
    alignment: centré, retour à la ligne autorisé
  auth-secondary-link:
    minHeight: 45px                                   # padding 12px + 21px de ligne
    typography: "{typography.text-base} ; lineHeight 21px ; souligné (offset 3px)"
    textColor: "{colors.accent-1}"
  auth-orientation-line:              # connexion uniquement
    border-top: "1px solid {colors.outline-variant}"
    margin-top: 6px
    padding-top: 12px
    typography: "13px"
    textColor: "{colors.text-muted}"
    alignment: centré
  favicon-tile:                       # statique, ne suit pas le thème
    backgroundColor: "#16151b"
    glyphColor: "#f4efe6"
---

# jdr-master — Design System — Delta écrans d'authentification et identité de marque (34.3)

Ce document est un **delta** : il hérite intégralement du spine `ux-jdr-master-2026-09-23` (et, par lui, des spines de base `…2026-08-04` et `…20260626`) et **réutilise** les trois thèmes, la palette, l'échelle typographique, `{radius.*}` et `{elevation.*}`. Il **n'ajoute aucun token de thème** ; il en **corrige un seul**, `{colors.outline}` (`--mat-sys-outline`, bord des champs), dans les trois thèmes et **pour toute l'application** (§2). Il décrit : (1) l'**identité de marque** (nom, logo, emblèmes, accroches) — jusqu'ici absente : l'application n'avait ni nom définitif, ni logo, ni image ; (2) la **mise en page commune** des écrans d'authentification et du parcours « rejoindre par lien » (bande de marque + carte). Le comportement est dans EXPERIENCE.md.

**Amendements à la base** (tous décidés par l'utilisateur) : (a) le principe n°1 de la base (« pas d'images », « pas de logo », « le nom seul en typographie fait office de marque ») est **levé** pour les **seuls** logo, emblèmes et scène d'ambiance, en **SVG inline** (autorisé depuis le delta Palier 9) ; (b) Georgia, réservée par la base aux titres du thème Atelier Cuivré, sert ici au **nom de marque et à l'accroche dans les trois thèmes** ; (c) le jeton de bordure `--mat-sys-outline` est **éclairci dans les trois thèmes pour toute l'application** (contraste 1.4.11, §2), au-delà du seul périmètre des écrans d'authentification. Le nom « master-jdr » (provisoire) devient **« Dés Dispos »** pour l'interface ; le dépôt et le README gardent leur nom (EXPERIENCE.md §11).

**Les spines l'emportent sur les planches** (elles illustrent, elles ne fixent pas). Planches de référence, amendées pour refléter les spines : [`mockups/key-connexion.html`](mockups/key-connexion.html) (connexion, 3 thèmes, 375 / 320 px, bureau 1280, variantes erreur et envoi invalide) et [`mockups/key-rejoindre.html`](mockups/key-rejoindre.html) (rejoindre, 3 thèmes, lien invalide). Logo : [`mockups/logo-g-declinaisons.html`](mockups/logo-g-declinaisons.html) (déclinaisons, zone de protection, tailles, favicon) ; fichiers [`logo/logo-picto.svg`](logo/logo-picto.svg) et [`logo/logo-bloc-marque.svg`](logo/logo-bloc-marque.svg). Comparatif des pistes (logo G retenu, emblèmes E1 retenus, mises en situation) : [`mockups/logos-et-emblemes-2.html`](mockups/logos-et-emblemes-2.html).

## 1. Brand & Style

**Nom.** « **Dés Dispos** » (deux mots, accent sur le é). Double lecture : « des dispos ? » — la phrase qu'on lance pour caler un créneau — et « dés ». Esprit du produit : *trouver un créneau pour se retrouver et jouer* (jeux de société, jdr, autre) ; l'identité porte à la fois le jeu et l'organisation. Critères du nom : français, évoque le jeu et l'organisation / le créneau, court et mémorisable, ton chaleureux ou malicieux. Vérifications de marque et de domaine : EXPERIENCE.md §11.

**But identitaire.** Qu'un visiteur qui ne connaît pas l'application **identifie le genre (jeu de rôle) dès l'arrivée** : logo (d20), emblème et scène du thème, accroche. Plus de page « juste une carte ».

**Ton.** Chaleureux et malicieux. Microcopy : EXPERIENCE.md §3.

**Logo — piste G (« d20 à coche »).** Un d20 vu de face (contour hexagonal, arêtes intérieures) dont la facette centrale pleine est évidée d'une **coche de disponibilité** : le d20 est l'icône universelle du jeu de rôle, la coche porte le « dispos ». Fichiers : `logo-picto.svg` (pictogramme, 64 × 64) et `logo-bloc-marque.svg` (pictogramme + nom, 317 × 64).

| Règle | Valeur |
| --- | --- |
| Couleur | **Une seule**, `currentColor` : la couleur de texte du contexte ({colors.text-primary} dans l'application). Aucun dégradé, aucune demi-teinte. Le thème **recolore** le logo. |
| Hors thème (valeurs d'usage documentées) | fond sombre neutre `#16151b` → logo `#f4efe6` ; fond clair `#f4efe6` → logo `#16151b` ; impression `#000000` sur `#ffffff` ou inverse |
| Zone de protection | **¼ H** minimum autour du bloc (H = hauteur du pictogramme) ; **½ H** recommandé (bande d'authentification, en-tête de document). Aucun autre élément dans la marge. |
| Taille minimale | pictogramme complet **28 px** de haut (≈ 139 px de large pour le bloc-marque) ; **32 px recommandé**. Ne pas rogner le pictogramme dans un cercle ou un carré qui coupe les pointes du d20. |
| Variante simplifiée | **Aucune** (décision) : le logo s'emploie **tel quel à toutes les tailles**, favicon compris. Conséquence assumée : sous ~28 px la coche se bouche, à 16 px le pictogramme devient un amas de lignes ; sous 28 px, pas de bloc-marque — pictogramme seul. Le favicon est un compromis accepté. |
| Intégration | SVG **inline** (une `<img>` rend `currentColor` en noir). Texte « Dés Dispos » : en `<text>` Georgia gras dans `logo-bloc-marque.svg` (largeur figée par `textLength`) — **à convertir en tracés avec la police finale** pour tout usage figé (impression, réseaux, signature d'e-mail). Dans l'interface, le nom est du texte HTML. |
| Favicon et icône (`favicon-tile`) | **Statiques**, hors thème : tuile `#16151b`, glyphe `#f4efe6` (contraste ≈ 15,8:1), logo tel quel. |

**Emblèmes (un par thème, E1 retenus).** Ambiance, jamais marque : le logo a le premier rôle, l'emblème le second (décision de mise en page P1bis, voir §4). Dessinés en SVG inline, colorés par les rôles du thème (jamais de couleur littérale).

| Thème | Emblème | Accroche |
| --- | --- | --- |
| Grimoire Émeraude | grimoire ouvert surmonté d'une étoile à quatre branches | « Trouvez le soir où le grimoire s'ouvre » |
| Forêt Ancienne | feuille de chêne en contour, avec un point lumineux (accent 2) | « Un feu de camp, des amis, et une date qui arrange tout le monde » |
| Atelier Cuivré (`atelier-cuivre` ; `medieval-steampunk` dans le code jusqu'à l'épic 35) | rouage de huit dents dont le moyeu est un dé aux points couleur du texte | « On cale tout le monde, et on lance la machine ! » |

L'accroche est une **microcopy par thème** (clé de ton) ; l'emblème en filigrane est **décoratif** (`aria-hidden`).

**Scène animée (la bande).** Elle reprend, pour chaque thème, les **principes d'animation des bannières de partie** (`GeneratedBanner`, delta Palier 9 §7.3 et §8) :
- **Seuls `transform` et `opacity` sont animés** ; rien d'autre (jamais `width`, `left`, `box-shadow`).
- `prefers-reduced-motion: reduce` ⇒ **toutes les animations coupées d'office**, la composition **au repos reste complète** et lisible (aucune information ne passe par le mouvement).
- **Composition de repos** (définition vérifiable) : le rendu du décor avec `animation: none`, c'est-à-dire chaque élément à son **style de base**, hors keyframes. Concrètement : halos à opacité .75 sans mise à l'échelle, étoiles à .5, lucioles à .8 et volutes de vapeur à .9 **à leur position de départ**, rouages à rotation 0, aiguille du manomètre à sa position de base, et **aucune comète** (`.fly` à `opacity: 0` de base : elle n'existe qu'en mouvement, sinon elle restait figée, tête allumée, sur le sommet du logo et le début du nom). C'est ce que rend la planche sous `prefers-reduced-motion: reduce`. Rien de lumineux ne doit chevaucher le logo ni le texte dans cet état (à vérifier sur capture). Ce n'est **ni** l'état animé **ni** l'état en pause.
- Décor `aria-hidden`, jamais d'information portée.
- Couleurs **par rôles** (`{colors.accent-1}`, `{colors.accent-2}`, `{colors.banner-glow}`, `{colors.primary-bg}`), jamais littérales.
- Contrairement aux bannières (grande carte seule animée), la bande est **animée partout** : pas de mode moyen / liste ici.
- **La bande reste en boucle** (aucun arrêt automatique). **Pause / reprise au clic ou au toucher sur le fond animé lui-même**, sans bouton visible (comportement : EXPERIENCE.md §4).
- **La pause fige l'animation sur place** (`animation-play-state: paused`, décision de l'utilisateur) : état non mémorisé, et **pas** un retour à la composition de repos. **Conséquence assumée** : une comète ou une luciole figée peut rester sous l'accroche (contraste de 1,0 à 3,3:1 mesuré dans ce cas).
- **Écarts acceptés et consignés** (décisions de l'utilisateur) : **WCAG 2.2.2** (niveau A) partiellement non satisfait — la commande n'est pas découvrable et le décor est `aria-hidden` ; **WCAG 2.1.1** (clavier) — la pause n'existe qu'au clic / toucher. Seul `prefers-reduced-motion` coupe l'animation sans geste. À revoir si l'application devient publique (bouton visible + clavier). Voir EXPERIENCE.md §11 (j).

| Thème | Composition de la scène (maquette) | Durées |
| --- | --- | --- |
| Grimoire Émeraude | deux halos qui respirent, étoiles qui scintillent en décalé, une comète traversante (invisible au repos), emblème en filigrane | halo 6 s · étoiles 3,4 s · comète 7 s |
| Forêt Ancienne | trois halos qui pulsent en décalé, lucioles ascendantes (dérive latérale ±8 à 14 px), emblème en filigrane | halo 6 s · lucioles 8,5 s |
| Atelier Cuivré | grille de plan technique (constante du thème), trois rouages (sens et vitesses alternés), quatre rivets, volutes de vapeur, manomètre à aiguille oscillante, emblème en filigrane | rouages 11 / 16 / 24 s · vapeur 5 s · aiguille 5,5 s |

`[ASSUMPTION]` Les compositions de la maquette sont **fixes** (aucun tirage ni graine). Le générateur des bannières n'est pas réutilisable tel quel (viewBox 320 × 124 et bornes de tirage calibrées pour 124 px de haut ; ici 440 × 180 pour 196 px) : choix d'implémentation en EXPERIENCE.md §11.

## 2. Colors

**Seul `{colors.outline}` (`--mat-sys-outline`) est modifié**, éclairci dans les trois thèmes pour passer 3:1 (WCAG 1.4.11) : Émeraude `#5a5070` → `#6e6383` ; Forêt `#3a5040` → `#54735c` ; Atelier `#7a5030` → `#8b6541`. Décision de l'utilisateur : **dans `styles.scss`, pour toute l'application**, pas seulement ici. Le jeton sert à tous les formulaires et à d'autres composants : **contrôle visuel de non-régression sur l'application entière à prévoir** (hors périmètre strict de la 34.3, EXPERIENCE.md §11). Les trois thèmes (sombres) s'appliquent à ces écrans comme ailleurs (choix du thème : EXPERIENCE.md §10).

| Usage | Token |
| --- | --- |
| Fond de page | `{colors.primary-bg}` |
| Fond de la bande | dégradé radial `{colors.banner-glow}` → `{colors.primary-bg}` ; voile de lisibilité `{colors.primary-bg}` à 60 % |
| Scène et emblème | `{colors.accent-1}`, `{colors.accent-2}`, `{colors.text-primary}` (étoiles, points du dé, vapeur) ; aiguille du manomètre : teinte `status-todo` du thème (comme `party-banner.scss`) |
| Logo, nom, accroche | `{colors.text-primary}` |
| Carte | fond `{colors.surface-bg}`, bord `{colors.outline-variant}` |
| Bord des champs | `{colors.outline}` (valeur corrigée, voir ci-dessus) |
| Anneau de focus | `{colors.accent-1}` (liens, bouton principal, liens-boutons) ; bouton œil : focus livré en 34.2 conservé |
| Titre, texte, saisie | `{colors.text-primary}` ; sous-titre, libellés, aide (`mat-hint`), ligne d'orientation, bouton œil : `{colors.text-muted}` |
| Action principale | fond `{colors.accent-1}`, texte `{colors.on-primary}` (**pas** `{colors.gradient-cta}` : aplat) |
| Actions secondaires | `{colors.accent-1}`, **toujours soulignées** |
| Erreur (formulaire et champ) | `{colors.error}` (`#cf6679`, identique dans les trois thèmes) **et** message écrit |

**Alias** (nom utilisé ici → token de la base / du code). `[ASSUMPTION]` correspondances à confirmer à l'implémentation :

| Nom du delta | Base / code |
| --- | --- |
| `primary-bg`, `surface-bg`, `text-primary`, `text-muted`, `accent-1`, `accent-2` | `--jdr-bg`, `--jdr-surface`, `--jdr-text`, `--jdr-text-muted`, `--jdr-accent-1`, `--jdr-accent-2` (`styles.scss`) |
| `outline`, `outline-variant`, `error`, `on-primary` | `--mat-sys-outline`, `--mat-sys-outline-variant`, `--mat-sys-error`, `--mat-sys-on-primary` |
| `banner-glow` | `--jdr-banner-glow` (`party-banner.scss` : accent 2 à 34 % sur `--jdr-surface`) ; la base de la bannière est `--jdr-bg` |
| thème `atelier-cuivre` | `medieval-steampunk` dans le code, jusqu'au renommage (épic 35) |

**Valeurs de référence lues dans `styles.scss`** (informatif : ne redéfinit rien, `styles.scss` fait foi ; les hex du spine de base 2026-06-27 sont en retard sur le code) :

| Thème | primary-bg | surface-bg | accent-1 | accent-2 | text-primary | text-muted | outline | outline-variant | on-primary | banner-glow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Grimoire Émeraude | `#0d0a14` | `#1a1428` | `#7ec8a4` | `#9b6dff` | `#e8e0f0` | `#9b8fb0` | **`#6e6383`** (était `#5a5070`) | `#2a2340` | `#062018` | `#463271` |
| Forêt Ancienne | `#080f0a` | `#0f1f12` | `#2ecc71` | `#f0c040` | `#d4f0dc` | `#7aa885` | **`#54735c`** (était `#3a5040`) | `#1a2e1f` | `#062518` | `#5c5622` |
| Atelier Cuivré | `#1a1008` | `#2a1e10` | `#cd7f32` | `#4a7c59` | `#f0e6d0` | `#b39569` | **`#8b6541`** (était `#7a5030`) | `#3a2810` | `#1a0800` | `#353e29` |

> **Contrastes : seuils et mesures.** Texte ≥ **4,5:1** ; contours et indicateurs d'interface ≥ **3:1** (WCAG 1.4.11). Mesuré le 2026-10-05 sur les valeurs ci-dessus (Émeraude / Forêt / Atelier) : texte sur carte 13,9 / 14,1 / 13,1:1 ; `text-muted` sur carte 5,9 / 6,3 / 5,7:1 ; lien `accent-1` sur carte 9,1 / 8,2 / 5,2:1 ; `on-primary` sur `accent-1` 8,7 / 7,8 / 6,2:1 ; erreur `#cf6679` sur carte 5,0 / 4,8 / 4,5:1 (**marge nulle en Atelier Cuivré**) ; **bord de champ `outline` sur carte, jeton corrigé : 3,2 / 3,3 / 3,1:1 (≥ 3:1, OK)** — avant correction 2,4 / 2,0 / 2,3:1 ; anneau de focus `accent-1` sur carte ≥ 5,2:1. Le bord de carte `outline-variant` (≈ 1,2:1) est décoratif. **Nom et accroche sur la bande** : modélisés à 4,9 jusqu'à 10,7:1 selon thème et largeur (pire cas : Émeraude, 320 px, pic d'animation, accroche 5,23:1, marge faible) — **à confirmer par capture** dans les trois thèmes, à 320 et 375 px ; ne pas modifier le filigrane (opacité, position) sans refaire la mesure.

## 3. Typography

Hérite de l'échelle de base (`{typography.text-sm}` 12 px, `{typography.text-base}` 14 px, `{typography.text-lg}` 16 px, `{typography.text-xl}` 20 px) et de la pile système. **Valeurs hors échelle, propres à ces écrans** (component-scoped, voir le frontmatter) :

| Rôle | Valeur |
| --- | --- |
| Nom de marque | Georgia gras 32 px, interligne 1, +.01em ; halo de texte `0 1px 10px {colors.primary-bg}` |
| Accroche | Georgia italique 14 px, interligne 1.3, largeur max 232 px, halo `0 1px 8px {colors.primary-bg}` ; **passe à la ligne, jamais tronquée** (2 lignes en Forêt Ancienne à 375 px) |
| Titre de carte | 20 px / 1.2 / 600 (≈ `{typography.text-xl}`) |
| Sous-titre | `{typography.text-base}` (14 px) |
| Texte de carte | `{typography.text-lg}` (16 px, interligne 1.5) |
| Libellé de champ | 16 px au repos, 12 px flottant (`{typography.text-sm}`) ; saisie 16 px |
| Bouton principal | 15 px / 1.3 / 600 ; le libellé passe à la ligne (`white-space: normal`), le bouton grandit (`min-height`) |
| Action secondaire | `{typography.text-base}` (14 px), soulignée |
| Aide (`mat-hint`), ligne d'orientation | 13 px |
| Message de validation d'un champ (`mat-error`) | 13 px `[ASSUMPTION]` (même taille que l'aide qu'il remplace) |

`[ASSUMPTION]` Tailles à exprimer de façon à suivre le zoom du texte (rem) à l'implémentation ; la maquette est en px.

## 4. Layout & Spacing

**Mise en page P1bis** (retenue) : une **bande** de marque au-dessus d'une **carte**. Le filigrane de l'emblème est en grande illustration, le bloc-marque seul au premier plan, l'accroche dessous. Même mise en page sur **tous** les écrans bâtis sur `auth-page` (connexion, inscription, mot de passe oublié, réinitialisation, confirmation / annulation d'e-mail) **et** sur « rejoindre par lien ».

| Élément | Mobile (< 480 px) | Bureau (≥ 480 px) |
| --- | --- | --- |
| Bande | pleine largeur, collée en haut, **min-height 196 px**, bord bas 1 px | colonne centrée de **448 px**, 4 coins arrondis 14 px, bord 1 px |
| Carte | marge **16 px** (gouttière), 16 px sous la bande | même colonne de **448 px**, 16 px sous la bande |
| Largeur minimale | **320 px** : aucun texte tronqué, aucun défilement horizontal, **aucun libellé qui chevauche une icône** | — |

- **Bande.** **Hauteur minimale** 196 px (jamais fixe : l'accroche et le bloc-marque ne sont pas rognés quand la taille de texte grossit) ; `overflow: hidden` **uniquement** sur le calque de décor. Scène 440 × 180 (`preserveAspectRatio` « xMidYMid slice »). Filigrane 200 × 200 en (245, −12), **opacité .30**, déborde à droite. Voile radial 62 % × 78 % centré à 30 % / 55 %, **60 %** de `{colors.primary-bg}`, transparent à 82 % : il garantit le contraste du texte sur la scène. Bloc-marque aligné à gauche, padding 10 / 22, centré verticalement.
- **Bloc-marque.** Logo 46 × 46, écart 11, nom 32 px ; accroche 12 px sous le bloc. À 320 px le bloc (46 + 11 + nom) tient dans la largeur utile de 276 px ; l'accroche passe à la ligne.
- **Carte.** Padding 20 / 18 / 16, rayon 14, bord 1 px.
- **Champs.** Hauteur **56 px**, écart vertical 16 px, bouton œil 44 × 44 px. **Sous le champ** : l'aide (`mat-hint`, ex. « 8+ caractères ») **ou** le message de validation (`mat-error`), qui **remplace** l'aide quand la règle n'est pas respectée. La consigne de règle est **hors du libellé** (le libellé « Mot de passe (8+ caractères) » entrait en collision avec le bouton œil dès 320 et 375 px).
- **Action principale.** Pleine largeur, **min-height 48 px** (`padding-block` 12 px), pilule, 4 px sous les champs ; le libellé passe à la ligne (« Continuer vers la réinitialisation du mot de passe » à 320 px).
- **Rangée d'actions secondaires.** Propre rangée, 10 px sous l'action principale, liens centrés, cible **≥ 44 px** (45 px à la maquette), retour à la ligne autorisé.
- **Ligne d'orientation** (connexion) : filet 1 px, 6 px de marge + 12 px de padding, centrée.
- **Espacement du haut.** Mobile : aucun (la bande touche le haut de l'écran) ; bureau : marge verticale de la page `[ASSUMPTION]` 56 px en haut / 72 px en bas (valeurs du cadre de la maquette), à confirmer.
- Seuil : **480 px** (`--bp-mobile` de base) pour la colonne de 448 px ; le seuil desktop unique du projet (1024 px) n'intervient pas ici. Aucun seuil nouveau.
- **Clavier virtuel** : la bande défile avec la page (non épinglée) `[ASSUMPTION]` ; le formulaire reste atteignable (EXPERIENCE.md §9).

## 5. Elevation & Depth

Aucune ombre portée : la hiérarchie vient du **fond** (`{colors.surface-bg}` sur `{colors.primary-bg}`) et du **bord** `{colors.outline-variant}`. Ni `{elevation.card}` ni `{elevation.panel}` ici. Seules profondeurs : le filigrane de l'emblème (opacité .30) et le halo de texte du nom et de l'accroche (lisibilité, pas relief).

## 6. Shapes

| Élément | Rayon |
| --- | --- |
| Bande (bureau), carte | 14 px (valeur validée sur maquette, hors échelle de base : `{radius.card}` = 10, `{radius.panel}` = 12) |
| Champ | 8 px à la maquette ; `[ASSUMPTION]` à réconcilier avec `{radius.input}` (4 px, override Angular Material) — voir EXPERIENCE.md §11 |
| Action principale | pilule (24 px = demi-hauteur) ; la base prévoit `{radius.button-cta}` 10 px pour un CTA : **écart assumé** |
| Bouton œil | cercle |
| Logo | pointes du d20 jamais rognées |

## 7. Components

**Noms canoniques** — un seul nom par composant, identique dans EXPERIENCE.md §4.

| Composant | Token / ancre | Contenu |
| --- | --- | --- |
| **Bande d'authentification** | `auth-band`, `auth-band-scene`, `auth-band-watermark`, `auth-band-scrim` | scène animée du thème, filigrane de l'emblème E1, voile, bloc-marque, accroche |
| **Bloc-marque** | `brand-block`, `brand-logo`, `brand-name`, `brand-tagline` | logo G (46 px) + « Dés Dispos » (32 px) ; l'accroche est dessous |
| **Carte d'authentification** | `auth-card`, `auth-card-title`, `auth-card-subtitle`, `auth-card-body`, `auth-field`, `auth-field-hint`, `auth-field-error`, `auth-error`, `auth-status`, `auth-primary-action`, `focus-ring` | titre (`h1`), [sous-titre], contenu (champs avec aide / message de champ, ou texte), [erreur], [état], action principale |
| **Rangée d'actions secondaires** | `auth-secondary-actions`, `auth-secondary-link` | un ou plusieurs liens soulignés, centrés |
| **Ligne d'orientation** | `auth-orientation-line` | « L'inscription se fait sur invitation. » (connexion seule) |
| **Bouton de révélation du mot de passe** | `password-toggle` | œil / œil barré en suffixe du champ (34.2) |

**Bande d'authentification** — `<header>` de **196 px minimum**, **frère** de `<main>` (la carte) : décor (scène + filigrane + voile) en arrière-plan, bloc-marque au premier plan. Les trois scènes sont dans §1 (table). Elle ne change ni de hauteur nominale ni de contenu d'un écran d'authentification à l'autre ; seul le thème la change. Un clic / toucher sur la scène la **fige sur place** ou la relance (§1, EXPERIENCE.md §4) ; aucun bouton visible. Planches : `key-connexion.html` (375 px, 320 px, bureau 1280 px, 3 thèmes) et `key-rejoindre.html`, où la pause est opérationnelle.

**Bloc-marque** — logo G + nom en une ligne (46 px de logo, 11 px d'écart, nom 32 px) ; accroche dessous, 12 px d'écart. Zone de protection du logo ¼ H (§1), ½ H visée dans la bande. Le nom et le logo sont tous deux en `{colors.text-primary}`.

**Carte d'authentification** — le `<main>` est le **conteneur** de la carte (`aria-labelledby` vers le `h1`). Ordre vertical fixe : titre (`<h1 matCardTitle>`, + sous-titre sur « rejoindre ») → contenu (champs ou texte) → [erreur du formulaire, **au-dessus** du bouton principal] → action principale → rangée d'actions secondaires → [ligne d'orientation, connexion]. Champs : `mat-form-field appearance="outline"` à libellé flottant (16 px au repos → 12 px), **bord corrigé** (§2), libellé **sans** consigne de règle. Sous le champ : aide `{colors.text-muted}` (« 8+ caractères ») ; **champ invalide et touché** : l'aide cède la place à un court **message écrit** `{colors.error}` qui nomme la règle (EXPERIENCE.md §3). Variante « erreur du formulaire » : message `{colors.error}` sous les champs, le reste de l'écran ne bouge pas. Variante « lien invalide » (rejoindre) : raison en `{colors.error}` sous le titre et le sous-titre, texte simple sans `role="alert"`, **aucune action** (planche `key-rejoindre.html`). Variante « envoi invalide » (connexion) : planche `key-connexion.html`. L'aide « 8+ caractères » ne figure sur aucune planche (inscription et réinitialisation ne sont pas maquettées, EXPERIENCE.md §11 e).

**Rangée d'actions secondaires** — liens soulignés en `{colors.accent-1}`, sur leur propre rangée, séparée de l'action principale ; l'affordance n'est jamais la couleur seule.

**Focus visible** (`focus-ring`) — sur tous les liens et boutons de la carte (liens secondaires, bouton principal, liens-boutons de « rejoindre ») : `:focus-visible` = **contour 2 px `{colors.accent-1}`, décalage 2 px**, ≥ 5,2:1 sur la carte dans les trois thèmes ; **jamais `outline: none`**, y compris pour obtenir la pilule (le contour doit épouser la forme). Le bouton œil garde son focus livré en 34.2 (`outline: 2px solid currentColor`, décalage −2 px, `text-muted` 5,7 à 6,3:1) `[ASSUMPTION]`.

**Contraste forcé** (`forced-colors: active`, Windows) — la scène et le voile sont **masqués** (`display: none`) pour ne pas former d'aplats sous le texte ; l'action principale reçoit un **bord `1px solid ButtonText`** (la pilule n'a sinon aucune frontière). Recette manuelle unique, Windows 11 « Aquatique » et « Crépuscule », sur la connexion et sur « rejoindre ».

**Ligne d'orientation** — texte de 13 px en `{colors.text-muted}`, centré, précédé d'un filet ; **pas un lien**.

**Bouton de révélation du mot de passe** — conservé tel que livré en 34.2 : `<button type="button">` de 44 px minimum, icône œil / œil barré de 24 px, en `matSuffix` du champ ; état par la forme de l'icône + `aria-pressed` + libellé (EXPERIENCE.md §4).

## 8. Do's and Don'ts

**Do**
- Le **même** bloc-marque, la **même** bande et la **même** carte sur tous les écrans d'authentification et sur « rejoindre ».
- Logo et emblème peints par les **rôles** du thème (`currentColor`, `{colors.accent-1}`, `{colors.accent-2}`) ; le logo **tel quel** à toutes les tailles, zone de protection ¼ H.
- Une **seule** action principale pleine largeur par carte ; les actions secondaires sur leur propre rangée.
- L'accroche passe à la ligne ; le voile garantit le contraste du texte sur le décor de base.
- Animer seulement `transform` et `opacity` ; composition de repos complète et **sans comète** sous « réduire les animations » ; pause au clic = gel sur place.
- Un **court message écrit par règle** sous le champ (jamais la couleur seule).
- `min-height` sur la bande et sur le bouton principal.
- Contour de focus 2 px `{colors.accent-1}`, décalage 2 px.
- Bord de champ `{colors.outline}` corrigé (3,1 à 3,3:1).

**Don't**
- Pas de sélecteur de thème sur ces écrans.
- Pas de variante simplifiée du logo ; pas de logo en `<img>` (il rendrait noir) ; pas de logo sous 28 px hors favicon, ni de bloc-marque sous 28 px de pictogramme ; pas de rognage du pictogramme dans un cercle ou un carré.
- Pas d'emblème en médaillon à côté du logo (deux pictogrammes en concurrence) : l'emblème est en filigrane.
- Pas de couleur littérale dans les SVG de la scène.
- Pas d'information portée par l'animation ; pas de comète visible dans la composition de repos.
- Pas de bouton visible de pause sur la bande (décision : clic / toucher sur la scène ; écarts WCAG 2.2.2 et 2.1.1 consignés, EXPERIENCE.md §11 j).
- Pas de texte tronqué (l'accroche passe à la ligne).
- Pas de `{colors.gradient-cta}` sur l'action principale de ces écrans.
- Pas de `height` fixe sur la bande ni sur le bouton principal (`min-height`).
- Pas de consigne de règle dans un libellé de champ (aide `mat-hint`).
- Pas d'`outline: none`.
- Ne pas redessiner ici le bandeau de navigation de l'application (hors périmètre : EXPERIENCE.md §2).
