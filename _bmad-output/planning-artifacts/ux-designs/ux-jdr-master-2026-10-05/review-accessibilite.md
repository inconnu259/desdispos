---
title: Revue d'accessibilité adversariale — Delta écrans d'authentification et identité de marque (Story 34.3)
status: final
updated: 2026-10-05
cible: "DESIGN.md, EXPERIENCE.md, .working/key-connexion.html, .working/key-rejoindre.html, .working/logo-g-declinaisons.html (ux-jdr-master-2026-10-05)"
référentiel: "WCAG 2.2 AA, Angular Material 22, 3 thèmes du projet"
---

# Revue d'accessibilité — écrans d'authentification (34.3)

> **Sort des constats** : cette revue est conservée telle que rendue ; le sort de chacun des 19 constats (intégré, écart accepté, report) est dans [`validation-report.md`](validation-report.md) (version repliable : `validation-report.html`) et dans `EXPERIENCE.md` § 11 (i).

## Verdict global

**Non conforme WCAG 2.2 AA en l'état, mais la direction visuelle n'est pas en cause : tous les contrastes de texte mesurés passent, sur la bande comme sur la carte.** Les écarts viennent de trois sources : (1) le **code existant**, que la spec 34.3 « ne change pas fonctionnellement » et qui porte des défauts de niveau A (`lang="en"`, aucun titre ni repère, validation muette, messages d'état non annoncés) ; (2) des **omissions du delta** (aucun mécanisme de pause de la bande, bord de champ à ~2:1, libellés longs qui entrent en collision avec le bouton œil, hauteurs fixes) ; (3) des **affirmations du delta que la mesure contredit** (« aucun texte tronqué à 320 px », « composition au repos complète »). Tout se corrige par quelques attributs, un `min-height`, un déplacement de texte et un minuteur de 5 secondes, sans toucher à la direction artistique.

**Comptage : 19 constats — 0 critique, 8 haute, 5 moyenne, 6 basse.**

## Méthode et limites

- **Lu** : DESIGN.md, EXPERIENCE.md, `key-connexion.html`, `key-rejoindre.html`, `logo-g-declinaisons.html`, la revue précédente (format), puis le code réel : `apps/web/src/index.html`, `app/features/auth/*` (gabarits, `.ts`, `.scss`), `features/join/*`, `shared/password-reveal/*`, `core/theme/theme-tone.service.ts`, `app.routes.ts`, `styles.scss` (jetons des trois thèmes).
- **Mesuré dans un navigateur** : (a) la géométrie réelle des maquettes (position du nom, de l'accroche, du logo, du filigrane, de la jauge, par 375 / 320 / 448 px ; liste des animations et durées) ; (b) l'application **en cours d'exécution sur `localhost:4200`** (code actuel, avant mise en forme 34.3), en 320 et 375 px : langue, titre, titres, repères, collision des libellés, comportement d'un envoi vide. Le navigateur a été remis en taille desktop ensuite.
- **Contrastes calculés** (formule WCAG 2.x, script dans le scratchpad de session) à partir des hexadécimaux **de `styles.scss`**. Les mesures du DESIGN §2 sont **reproduites à ±0,05** (13,9 / 14,1 / 13,1 ; 5,9 / 6,3 / 5,7 ; 9,1 / 8,2 / 5,2 ; 8,7 / 7,8 / 6,2 ; 5,0 / 4,8 / 4,5 ; bord de champ 2,4 / 2,0 / 2,3 ; favicon 15,8).
- **Texte sur la bande : modélisé, non photographié.** Je compose, pixel par pixel sur les boîtes réelles du nom (x 79–264, y 57–89) et de l'accroche (x 22–254, y 108–145), les couches : dégradé radial bande, halos (à leur **pic** d'opacité et d'échelle), disque et glyphe du filigrane (borne haute : le glyphe est supposé couvrir toute sa boîte englobante à 30 %), puis le voile tel que défini en CSS. Je n'ai pas modélisé les étoiles (≤ 3 px) ni le halo de texte (`text-shadow`, bonus non comptable en WCAG). **Il reste à confirmer par une capture réelle**, comme le DESIGN l'exige déjà.
- **Non testé** : lecteur d'écran réel, mode contraste forcé de Windows, remplissage automatique d'un gestionnaire de mots de passe. Les constats correspondants sont marqués ❓.
- Le thème 3 s'appelle encore `medieval-steampunk` dans le code (renommage épic 35) : les mesures portent sur ses valeurs actuelles.

## Ce qui tient (à ne pas casser)

| Point | Preuve |
| --- | --- |
| Contrastes de texte de la carte (titre, saisie, libellés, sous-titre, ligne d'orientation, liens, bouton principal) | tableau ci-dessous : tous ≥ 5,17:1 |
| Texte du nom et de l'accroche sur la bande, état statique | 4,9 à 10,7:1 selon thème et largeur (modèle) |
| Cibles tactiles (2.5.8 : 24 px exigés) | bouton œil 44 × 44 (mesuré en live), principal 48 px, champs 56 px, liens secondaires ≥ 44 px prévus |
| Décor `aria-hidden="true"` + `focusable="false"` ; logo sans nom redondant | `key-connexion.html` : scène, pictogramme, defs ; le nom est du texte à côté |
| Zoom autorisé | `index.html` : `viewport` sans `user-scalable=no` |
| `autocomplete` corrects (1.3.5) et authentification sans test cognitif (3.3.8) | `login.html`, `register.html` : `username`, `current-password`, `new-password`, `email` ; la directive de révélation ne bloque ni collage ni gestionnaire |
| Une seule action principale, ordre de focus = ordre du DOM, bouton œil qui garde le focus | `password-toggle.ts` (`stopPropagation`), EXPERIENCE §4 |
| Pas de clignotement dangereux (2.3.1) | périodes ≥ 3,4 s, variations d'opacité lentes |
| Re-annonce du message d'erreur de la connexion | `login.ts` : `error.set(null)` détruit le nœud `@if`, il est recréé à chaque échec, donc ré-annoncé |
| Thème tiré une fois par chargement, jamais changé pendant la visite | EXPERIENCE §10 : conforme à 3.2.x |
| Reflow 320 px, orientation | aucune barre horizontale (`docScrollW = 320` mesuré), colonne 448 px dès 480 px |

## Tableau de contrastes (hex réels de `styles.scss`)

Fonds : *carte* = `--jdr-surface` ; *bande* = dégradé `glow → bg` + scène + voile.

| Paire | Grimoire | Forêt | Atelier | Seuil | Résultat |
| --- | --- | --- | --- | --- | --- |
| Titre / saisie `text` sur carte | 13,92 | 14,12 | 13,11 | 4,5 | OK |
| `text-muted` sur carte (libellés 12-16 px, sous-titre, aide, ligne d'orientation, icône œil) | 5,92 | 6,34 | 5,74 | 4,5 / 3 | OK |
| Lien `accent-1` sur carte (14 px) | 9,10 | 8,16 | 5,17 | 4,5 | OK |
| `on-primary` sur `accent-1` (bouton, 15 px/600) | 8,70 | 7,77 | 6,19 | 4,5 | OK |
| Bord du bouton principal (`accent-1`) sur carte | 9,10 | 8,16 | 5,17 | 3 | OK |
| Erreur `#cf6679` sur carte (14 px) | 4,96 | 4,76 | **4,513** | 4,5 | OK, **marge nulle en Atelier** |
| **Bord de champ `outline` sur carte** | **2,40** | **1,96** | **2,34** | 3 (1.4.11) | **KO** (H7) |
| Bord de carte `outline-variant` | 1,20 | 1,19 | 1,15 | — | décoratif |
| Anneau de focus `accent-2` (si Material M3 prend `secondary`) sur carte | 5,13 | 10,06 | 3,34 | 3 | OK mais à confirmer (M5) |
| Nom 32 px gras sur bande, pire cas modélisé (320 px, pic d'animation) | 4,93 | 6,77 | 7,34 | 3 (grand texte) | OK |
| Accroche 14 px italique (×0,93) sur bande, pire cas (320 px, pic) | 5,23 | 7,28 | 7,01 | 4,5 | OK, **marge faible en Émeraude** (B1) |
| Idem à 375 px, repos / pic | 6,59 / 6,36 | 8,23 / 7,72 | 7,58 / 7,58 | 4,5 | OK |
| Idem à 448 px | ≥ 7,1 | ≥ 8,2 | ≥ 10,6 | 4,5 | OK |
| Favicon `#f4efe6` sur `#16151b` | 15,84 | | | 3 | OK |
| **Transitoire** : accroche sous la tête de la comète (Émeraude), voile 0 / 0,3 | 1,0 / 2,0 | | | 4,5 | passage bref (M3) |
| **Transitoire** : accroche sous la queue de la comète | 1,7 / 3,1 | | | 4,5 | passage bref (M3) |
| **Transitoire** : accroche sous le cœur d'une luciole (Forêt) | | 1,8 / 3,3 | | 4,5 | passage bref (M3) |

Valeurs de remplacement du bord de champ (même teinte, 30 à 40 % de mélange avec `text-muted`) : voir H7.

---

## CRITIQUE

Aucun constat ne bloque à lui seul la tâche (se connecter, s'inscrire) pour une personne utilisant un lecteur d'écran ou le clavier.

## HAUTE

### H1 — La bande tourne en boucle infinie, sans moyen de la pauser, arrêter ou masquer (2.2.2, niveau A)
- **Où** : EXPERIENCE §4 (« animée **en permanence** »), DESIGN §1 (tableau des durées), `key-connexion.html` (mesuré : 19 animations infinies en Émeraude, 14 en Forêt, 7 en Atelier ; durées 3,4 s à 24 s). Seule parade spécifiée : `prefers-reduced-motion`.
- **Conséquence** : le mouvement démarre seul, dure plus de 5 secondes, est présenté **en parallèle** d'un contenu (le formulaire que l'on remplit) et n'est pas « essentiel » : les trois conditions de 2.2.2 sont réunies. `prefers-reduced-motion` est un réglage système que la plupart des personnes concernées (trouble de l'attention, vestibulaire) n'ont pas activé ; le W3C ne le liste pas comme technique suffisante pour 2.2.2. Aucune exception « décoratif ». La page sert d'écran d'entrée : c'est précisément là que la distraction coûte le plus.
- **Correctif minimal (recommandé)** : **arrêt automatique à 5 secondes**, sans nouveau contrôle. Un contenu qui s'arrête de lui-même avant 5 s sort du champ de 2.2.2. Dans le composant de bande : minuteur de 5 000 ms (annulé à la destruction) qui pose une classe `is-still` ; `.is-still .scene * { animation: none }`. Si `matchMedia('(prefers-reduced-motion: reduce)')` correspond, poser la classe **immédiatement**. Critère de recette : à t = 5,1 s, `document.getAnimations()` ne contient plus aucune animation de la scène. **Condition** : l'état « repos » doit être sain (voir M3, la comète figée). Utiliser `none` et non `animation-play-state: paused` : une pause à 5 s fige un instant arbitraire, par exemple la tête de comète sous l'accroche.
- **Variante si l'ambiance doit rester vivante** : un bouton icône 44 px dans la bande (« Mettre l'ambiance en pause » / « Reprendre »), état conservé en `sessionStorage` avec repli. Cela contredit EXPERIENCE §6 (« aucune interaction sur la bande ») et ajoute un composant : décision d'équipe, non recommandée par défaut.
- **Hors périmètre mais lié** : les bannières de partie et le compte à rebours (`party-banner`, `party-countdown`) sont soumis à la même règle. Un réglage « Animations » global dans le profil serait la solution durable ; à inscrire au backlog.

### H2 — Langue de la page : `lang="en"` en réel, alors que le delta affirme `lang="fr"` (3.1.1, niveau A)
- **Où** : EXPERIENCE §7 (« Structure : `lang="fr"` » présenté comme acquis) ; **`apps/web/src/index.html` ligne 2 : `<html lang="en">`** (confirmé en live : `document.documentElement.lang === 'en'`). Les maquettes sont en `fr`, ce qui masque l'écart. `LOCALE_ID = 'fr-FR'` (app.config.ts) n'agit pas sur l'attribut.
- **Conséquence** : un lecteur d'écran lit tout le français avec une voix et une prononciation anglaises ; les navigateurs proposent de traduire la page ; la césure et les guillemets suivent la mauvaise langue.
- **Correctif minimal** : `<html lang="fr">` dans `index.html` (le fichier est déjà dans la liste de la spec 34.3). Ajouter à la recette : `document.documentElement.lang === 'fr'`.

### H3 — Titre de page identique partout (« Web » aujourd'hui, « Dés Dispos » demain) et aucun signal au changement d'écran (2.4.2 niveau A ; 4.1.3 et 2.4.3 pour la navigation)
- **Où** : EXPERIENCE §7 et §11 (b) (« titre fixe … compromis ») ; `index.html` (`<title>Web</title>`) ; `app.routes.ts` : aucune propriété `title` sur aucune route d'authentification ni sur `join/:token`.
- **Conséquence** : sept écrans différents (connexion, inscription, oubli, réinitialisation, confirmer, annuler, rejoindre) partagent le même titre : impossible de les distinguer dans les onglets, l'historique ou la liste de fenêtres d'un lecteur d'écran ; aucun écran ne s'annonce au passage de l'un à l'autre (la navigation interne n'annonce rien et le focus tombe sur `<body>` quand le lien cliqué disparaît). Le « compromis » du §11 (b) ne tient pas : le titre par route ne coûte rien (propriété native du routeur).
- **Correctif minimal** : propriété `title` par route (« Connexion », « Créer un compte », « Mot de passe oublié », « Nouveau mot de passe », « Confirmer le changement d'e-mail », « Annuler le changement d'e-mail ») + une `TitleStrategy` qui ajoute le suffixe ` — Dés Dispos` ; `<title>Dés Dispos</title>` reste le repli d'`index.html`. Pour `join/:token`, poser le titre dynamique `Rejoindre « <partie> » — Dés Dispos` avec le service `Title` une fois l'aperçu chargé. Pour l'annonce : `LiveAnnouncer.announce(titre)` de `@angular/cdk/a11y` à chaque `NavigationEnd` (le CDK est déjà utilisé par `DetailSurface` : aucune installation). Aucun texte de contenu n'est ajouté à l'écran.

### H4 — Aucun titre ni repère dans le code ; les maquettes contredisent la spec (1.3.1, 2.4.1, 2.4.6, niveau A)
- **Où** : EXPERIENCE §7 (« le titre de carte est le seul `h1` », « bande `<header>`, carte `<main>` `[ASSUMPTION]` ») ; **code réel** : `<mat-card-title>` rend un `<div>` (mesuré en live : `h1, h2, h3, [role=heading]` → liste vide ; `main, header, nav` → liste vide) ; **maquettes** : `key-connexion.html` et `key-rejoindre.html` rendent le titre de carte en `<h2 class="ct">` (le `h1` de la planche est le titre de démonstration), `<main class="card">` pose le repère sur la carte elle-même.
- **Conséquence** : sans correctif, l'implémentation copiée sur les maquettes produit un `h2` sans `h1`, et celle qui suit le code actuel aucun titre. Un lecteur d'écran n'a ni navigation par titres ni repère « contenu principal » ; le saut vers le formulaire est impossible.
- **Correctif minimal** : écrire dans EXPERIENCE §7 que le titre de carte est un **`<h1 matCardTitle>`** (la directive s'applique sur n'importe quel élément) et corriger les deux planches (`h2` → `h1` dans la carte, le `h1` de démonstration devient hors produit). Structure : `<header>` (bande, non interactif) **frère** de `<main>` ; `<main>` = **conteneur de la carte** (`<main class="auth-page">` autour de `<mat-card>`) plutôt que la carte elle-même, avec `aria-labelledby` vers le `h1`. Le nom « Dés Dispos » reste du texte simple (déjà décidé). Sur `join`, le `h1` est « Rejoindre « <partie> » » ; ajouter `overflow-wrap: anywhere` (un nom de partie sans espaces ne doit pas déborder, voir B3).

### H5 — Validation muette : aucune erreur de champ, nommée ni annoncée (3.3.1, 3.3.3, 1.4.1 ; 3.3.2)
- **Où** : `login.ts` l. 44, `register.ts` l. 45, `forgot-password.ts` l. 37, `reset-password.ts` l. 53 : `if (this.form.invalid) return;` sans message ; **aucun `<mat-error>`** dans les six gabarits. Règles non affichées : pseudo `minLength(3)` (aucune mention nulle part), e-mail valide, mot de passe `minLength(8)` (seule mention : suffixe du libellé). EXPERIENCE §1 (« mêmes champs, validations, messages ») fige cet état.
- **Preuve en live** (`/login`, envoi à vide) : aucun message, `aria-invalid` absent (Material ne le pose pas sur un champ requis vide), focus resté sur `<body>`, seul changement : les deux contours passent au rouge. L'erreur n'est donc portée que par la **couleur** pour une personne voyante, et par **rien** pour une personne qui n'a pas la vue.
- **Conséquence** : cliquer « Se connecter » ou « Créer le compte » avec un champ vide ou trop court ne produit aucun retour. Pseudo de 2 caractères : l'envoi échoue silencieusement sans que la règle ait jamais été donnée.
- **Correctif minimal** : à l'envoi invalide, `form.markAllAsTouched()` et focus sur le premier champ invalide ; un `<mat-error>` court par règle (Material relie automatiquement le message au champ par `aria-describedby`). Textes à arbitrer, **car la spec 34.3 interdit tout texte nouveau** : « Renseignez ce champ. », « Adresse e-mail invalide. », « 3 caractères minimum. », « 8 caractères minimum. » (clés de ton ou texte neutre). Le message doit être écrit : la couleur seule ne suffit pas. **Décision à prendre** : intégrer ces quatre libellés à la 34.3, ou consigner un défaut de niveau A reporté à l'épic 35 (FR-41). Le choix de ne rien faire est un choix de non-conformité.

### H6 — Messages d'état : cinq écrans sans `role="alert"`, trois états de réussite non annoncés, focus perdu (4.1.3 AA ; 2.4.3)
- **Où** : `register.html`, `forgot-password.html`, `reset-password.html`, `confirm-email-change.html`, `rollback-email-change.html` : `<p class="error">` sans rôle (seule la connexion porte `role="alert"`, 34.1) ; `join.html` : `<p class="error">` sans rôle. États de réussite : « Votre adresse e-mail a été changée. » (`p.saved`), « Si un compte existe… » (`sent()`), « Votre ancienne adresse a été restaurée… » (`restored()`). EXPERIENCE §7 ne prévoit `role="alert"` que pour les **erreurs**.
- **Conséquence** : (a) les erreurs de formulaire apparaissent en silence au lecteur d'écran ; (b) pour les trois réussites, le bouton qu'on vient d'activer **disparaît** (remplacé par le message ou par un autre bouton), donc le focus tombe sur `<body>` et rien n'est dit : l'utilisateur ne sait pas si l'action a abouti (4.1.3) et repart du haut de la page (2.4.3) ; (c) `Chargement…` de `join` n'est pas une région de statut (voir B3).
- **Correctif minimal** :
  1. `role="alert"` sur le message d'**erreur apparaissant après une action** (inscription, oubli, réinitialisation, confirmer, annuler, `join()`), comme prévu.
  2. Les messages **présents dès le chargement** (« Lien invalide. », « L'inscription se fait uniquement sur invitation… », raison d'un lien expiré) : texte simple placé juste sous le `h1`, **sans** `role="alert"` (une alerte insérée au chargement est annoncée de façon inégale) ; l'action principale reste `disabled` et le texte l'explique.
  3. Réussites : un conteneur **persistant** `<div role="status">` (présent dans le DOM avant l'action) qui reçoit le message ; ensuite `focus()` sur ce conteneur (`tabindex="-1"`) ou sur le `h1`, pour ne pas perdre le focus quand le bouton disparaît.
  4. Mettre à jour EXPERIENCE §7 et §5 en conséquence.

### H7 — Bord de champ sous le seuil de 3:1 dans les trois thèmes (1.4.11, niveau AA)
- **Où** : DESIGN §2 (mesures 2,4 / 2,0 / 2,3, « point ouvert ») ; EXPERIENCE §11 (« à confirmer : accepté, ou jeton plus contrasté ») ; mesure indépendante : **2,40 / 1,96 / 2,34**.
- **Conséquence** : le contour 1 px est le seul signe visuel de la zone de saisie (le champ est transparent sur la carte). Sous 3:1, il disparaît pour une partie des personnes malvoyantes, surtout en Forêt (1,96). C'est la zone d'action principale de l'écran.
- **Correctif minimal** (même teinte, aucun nouveau jeton de thème : variable **locale** `--mat-form-field-outlined-outline-color` sur la carte d'authentification) : mélanger `outline` avec `text-muted` (30 à 40 %), soit **`#6e6383`** (Émeraude, 3,21:1), **`#54735c`** (Forêt, 3,26:1), **`#8b6541`** (Atelier, 3,12:1) ; ou, sans calcul, `text-muted` lui-même (5,9 / 6,3 / 5,7:1) si on préfère un contour plus net. L'état focus (2 px `primary`, ≥ 5,17:1) et survol ne changent pas. Noter dans DESIGN §2 que le reste de l'application (autres formulaires) garde l'écart : il est hors périmètre mais identique.

### H8 — Les libellés longs entrent en collision avec le bouton œil, à 320 **et** 375 px (1.4.10, 1.4.4, 1.3.1, niveau AA) ; contredit « aucun texte tronqué »
- **Où** : DESIGN §4 et EXPERIENCE §5/§9 (« 320 px : aucun texte tronqué ») ; `register.html` (« Mot de passe (8+ caractères) »), `reset-password.html` (« Nouveau mot de passe (8+ caractères) »).
- **Preuve en live** (code actuel, Material 22) :
  - 320 px, `/register` : largeur de l'infix 192 px, libellé 231 px (`white-space: nowrap`, `text-overflow: ellipsis`), bord droit du libellé 279 px contre 240 px pour l'infix ; capture : « caractères) » passe **sous l'icône œil**.
  - 375 px, `/reset-password` : libellé « Nouveau mot de passe (8+ caractères) » à 335 px de bord droit contre 295 px d'infix et 299 px pour le bouton ; même collision.
  - La mise en forme 34.3 (carte de 252 px utiles à 320 px) ne change pas l'ordre de grandeur : le bouton œil de 44 px est maintenu à l'intérieur du champ.
- **Conséquence** : la règle « 8+ caractères » est lue en partie cachée ou superposée à une icône ; en espacement de texte (1.4.12) et à 200 % la collision s'aggrave. C'est aussi la seule mention de cette règle (voir H5).
- **Correctif minimal** : sortir la consigne du libellé : `<mat-label>Mot de passe</mat-label>` + `<mat-hint>8+ caractères</mat-hint>` (13 px `text-muted`, 5,7 à 6,3:1 : OK), idem « Nouveau mot de passe » ; ajouter un hint « 3+ caractères » au pseudo. Le texte de la règle est conservé (déplacé, raccourci de « (8+ caractères) » à « 8+ caractères »). Recette : à 320 px, aucun libellé ne chevauche une icône ; test visuel dédié sur ces deux écrans.

---

## MOYENNE

### M1 — Hauteurs fixes : bande de 196 px à `overflow: hidden`, bouton de 48 px, tailles en `px` (1.4.4, 1.4.12, 1.4.10)
- **Où** : DESIGN frontmatter (`auth-band.height: 196px`, `overflow: hidden`, `auth-primary-action.height: 48px`), §3 (`[ASSUMPTION]` tailles en rem). Mesuré : nom 182 px de large (Georgia gras 32 px) ; libellé de bouton « Continuer vers la réinitialisation du mot de passe » ≈ 351 px à 15 px/600 dans un bouton d'environ 252 px à 320 px (`rollback-email-change.html`) ; `Restaurer mon ancienne adresse` ≈ 236 px (tient de peu). Les boutons Material 22 laissent le libellé passer à la ligne (`white-space: normal` mesuré), mais le code actuel les fige à 40 px de haut.
- **Conséquence** : le zoom du navigateur met tout à l'échelle (OK), mais le réglage de **taille de texte** (Android, iOS Dynamic Type, taille de police par défaut) ne grossit que le texte : l'accroche et le bloc-marque débordent de la bande fixe et sont rognés ; un libellé de bouton sur deux ou trois lignes déborde du bouton ; l'espacement de texte de 1.4.12 (interligne 1,5, lettres +0,12 em) déborde de la même façon. Sur Android, Georgia n'existe pas : la police de repli est plus large.
- **Correctif minimal** : `min-height: 196px` (jamais `height`) sur la bande, `overflow: hidden` **uniquement** sur le calque de décor ; bouton principal `min-height: 48px; height: auto; padding-block: 12px; line-height: 1.3; white-space: normal` ; titres `overflow-wrap: anywhere` ; toutes les tailles de la bande et de la carte en `rem` (la `[ASSUMPTION]` devient une règle). Recette : 320 px avec le libellé « Continuer vers la réinitialisation du mot de passe », puis avec le jeu d'espacement de texte de 1.4.12 (signet ou extension).

### M2 — Bouton œil : `aria-pressed` **et** libellé qui change (4.1.2)
- **Où** : `password-toggle.html` (`[attr.aria-pressed]` + `[attr.aria-label]` qui alterne « Afficher / Masquer le mot de passe ») ; EXPERIENCE §4 (« état par forme + `aria-pressed` + libellé ») ; DESIGN §7.
- **Conséquence** : le motif WAI-ARIA des boutons à bascule demande un **libellé constant** si `aria-pressed` change. Avec les deux, un lecteur d'écran dit « Masquer le mot de passe, bouton à bascule, enfoncé » : l'état « enfoncé » signifie que le mot de passe est *visible*, alors que le nom dit de le *masquer* ; la phrase se lit comme une double négation.
- **Correctif minimal** (une seule des deux) : **retirer `aria-pressed`** et garder le libellé changeant (cohérent avec les clés `auth.password_show/hide` déjà thématisées et testées en 34.2) ; ou garder `aria-pressed` avec le libellé constant « Afficher le mot de passe ». Mettre à jour la spec 34.2 et ses tests en conséquence.

### M3 — L'état « repos » n'est pas sain en Émeraude, et des objets lumineux passent sous le texte pendant les 5 premières secondes
- **Où** : EXPERIENCE §5 (« composition au repos complète, rien ne manque ») ; `key-connexion.html` : `.fly` n'a aucune opacité de base (le `0 %` de `dd-fly` la met à 0 seulement quand l'animation tourne).
- **Preuve** : animations annulées en live, comète à son état de repos : **opacité 1, `transform: none`, boîte x 10–80, y 33–67 à 375 px**, donc une comète figée, tête allumée, qui touche le sommet du logo et le début du « D » de « Dés » (le filigrane et le pictogramme sont à x 22–68, y 50–96 ; le nom commence à x 79). En Atelier, la jauge (x 12–55, y 20–63) effleure le sommet du logo (x 22–68, y 50–96) : sans conséquence de lisibilité mais le logo n'a plus sa zone de protection (¼ H) dans ce cas.
- **Transitoire pendant l'animation** (tableau ci-dessus) : la tête de comète a la couleur du texte (1,0:1 sous l'accroche sans voile, 2,0:1 avec un voile à 30 %), la queue 1,7 à 3,1:1, une luciole 1,8 à 3,3:1, pendant moins d'une seconde. WCAG évalue un état statique : ce n'est pas un échec formel, mais cela confirme que le mouvement n'est pas neutre pour la lecture.
- **Correctif minimal** : état de base `.fly { opacity: 0 }` (la comète n'existe qu'en mouvement ; aucune direction artistique modifiée) ; vérifier sur capture sous `prefers-reduced-motion: reduce` **et** après l'arrêt de H1 que rien ne chevauche le logo ni le texte ; retenir dans DESIGN §1 la phrase « au repos, la scène est celle de la planche **sans** comète ». En Atelier, soit décaler la jauge de 8 px vers le haut, soit accepter l'effleurement (choix visuel hors périmètre de la revue).

### M4 — Mode contraste forcé (Windows) : non spécifié (1.4.3, 1.4.11) ❓
- **Où** : aucune mention de `forced-colors` ni de `forced-color-adjust` dans DESIGN ou EXPERIENCE (`grep` : zéro ; le dépôt n'en a nulle part).
- **Conséquence probable** (à tester, je n'ai pas d'outil de capture dans ce mode) : en `forced-colors: active`, les couleurs de fond sont ramenées à `Canvas`, les `text-shadow` sont retirés, le texte passe en `CanvasText` ; les remplissages SVG de la scène et du filigrane peuvent être remplacés par des couleurs système et former des aplats pleins sous le texte ; le bouton principal pilule peut perdre toute frontière (pas de bordure spécifiée). C'est un public réel (Windows 11 en thème de contraste).
- **Correctif minimal** : `@media (forced-colors: active) { .auth-band__scene, .auth-band::after { display: none } .auth-primary-action { border: 1px solid ButtonText } }` ; recette manuelle une fois, en Windows 11 « Aquatique » et « Crépuscule », sur la connexion et sur `join`.

### M5 — Focus visible non spécifié pour les liens, le bouton principal et les liens-bouton (2.4.7, 1.4.11)
- **Où** : DESIGN et EXPERIENCE §7 (« indicateur de focus visible … (spec 34.3) ») sans valeur ; `join.html` : `a mat-flat-button` ; liens secondaires « soulignés ». Le seul focus réellement défini : bouton œil (`outline: 2px solid currentColor; outline-offset: -2px`, `currentColor` = `text-muted`, 5,7 à 6,3:1 : OK).
- **Conséquence** : le jeton de focus Material du bouton plein (anneau « secondary » en M3, soit `accent-2` : 5,13 / 10,06 / **3,34**:1 sur la carte, mais contre le bouton `accent-1` voisin 1,77 / 1,23 / 1,55) et le contour par défaut du navigateur sur les liens sont **supposés** conformes, non vérifiés. Si l'implémentation pose `outline: none` pour obtenir la pilule, le focus disparaît.
- **Correctif minimal** : ajouter à DESIGN §7 une règle : « `:focus-visible` = contour 2 px `accent-1`, décalage 2 px, sur tous les liens et boutons de la carte, jamais `outline: none` » (accent-1 ≥ 5,17:1 sur carte dans les trois thèmes) ; vérifier à la recette que le bouton principal et les liens-boutons de `join` l'affichent en pilule. 2.4.11 (focus non masqué) : sans objet, aucun élément fixe ou collant.

---

## BASSE

### B1 — Marge de contraste de l'accroche en Émeraude à 320 px : fragile, et le voile n'y protège plus rien
Le voile (60 % au centre) est une ellipse dont le rayon est proportionnel à la **largeur** de la bande : à 320 px, à l'extrémité droite des lignes d'accroche (x ≈ 250) le voile tombe à ≈ 1 %, et c'est là que démarre le filigrane (bord gauche du disque à x ≈ 193). Contraste modélisé 5,23:1 au pic d'animation (marge 0,7). **Passe**, mais n'a rien d'un garde-fou : un halo plus clair, un glyphe plus large ou une accroche plus longue le feraient tomber. **Correctif** : critère de recette « ≥ 4,5:1 mesuré sur capture à 320 px dans les trois thèmes, au pic », et ne pas modifier le filigrane (opacité, position) sans refaire la mesure ; option sans coût artistique : plafonner la largeur de l'accroche à 200 px à 320 px.

### B2 — Erreur en Atelier Cuivré : 4,513:1, marge nulle (1.4.3)
Hérité (4,51). Passe, mais toute transparence (`opacity` sur l'alerte, animation d'apparition en fondu, fond de carte plus clair) le fait tomber. **Correctif** : interdire l'opacité sur `auth-error` et sur le bloc qui le contient ; ou éclaircir l'erreur de ce thème (`#d66f82` donne 5,0:1) si l'identité le permet.

### B3 — Écran « Rejoindre » : états non annoncés, nom de partie sans espaces, erreur sans rôle
« Chargement… » n'a pas de `role="status"` ; la bascule vers l'aperçu ne s'annonce pas (couvert en partie par le titre dynamique de H3). `Rejoindre « {{ pv.partieName }} »` : un nom de partie long et sans espaces peut déborder la carte à 320 px (1.4.10) : `overflow-wrap: anywhere` sur le `h1`. L'erreur de `join()` (« Impossible de rejoindre … ») n'a pas de rôle (couvert par H6). **Correctif** : cf. H3, H4, H6 ; ajouter « Chargement… » dans le conteneur `role="status"` persistant.

### B4 — Erreur de connexion non reliée aux champs ; pas de suggestion de correction
Après un échec serveur, les champs restent « valides » : le message `role="alert"` n'est relié à aucun champ (`aria-describedby`) et ne dit pas comment corriger. L'absence de suggestion pour `auth.login_invalid` est **admissible** : 3.3.3 s'efface devant la sécurité (énumération de comptes). Les autres clés disent déjà quoi faire (patienter, réinitialiser, réessayer). **Correctif optionnel** : `aria-describedby` du message sur le champ de mot de passe.

### B5 — Remplissage automatique sur thème sombre ❓
Chrome et Edge appliquent un fond et une couleur de texte propres aux champs remplis par un gestionnaire de mots de passe, avec un contraste variable selon `color-scheme`. Les trois thèmes déclarent bien `color-scheme: dark`, mais la page de connexion repose sur ce remplissage (3.3.8). **À tester** : un identifiant rempli automatiquement dans les trois thèmes, texte et fond ≥ 4,5:1 ; sinon neutraliser par `:-webkit-autofill` en reprenant `--jdr-text` / `--jdr-surface`.

### B6 — Logo : redondance de nom accessible si le fichier de marque est inliné tel quel
`logo-g-declinaisons.html` et `logo-bloc-marque.svg` portent `role="img" aria-label="Dés Dispos"` : bon pour un usage autonome (en-tête de document, signature), **mais** inliné dans la bande à côté du texte « Dés Dispos », le lecteur d'écran dirait deux fois le nom. EXPERIENCE §4 prévoit juste `aria-hidden` sur le pictogramme seul : **à conserver**, et à écrire dans la recette (« le bloc-marque de la bande n'utilise pas `logo-bloc-marque.svg`, mais le pictogramme + le texte HTML »). Le masque SVG `id="g-cut"` est global : si le pictogramme est inliné par plusieurs composants simultanément, ses `id` doivent être uniques ou le `<defs>` partagé une seule fois dans l'application.

---

## Réponses point par point à la demande

1. **Contraste du texte et des composants** : texte de la carte conforme (≥ 5,17:1). **Texte de la bande conforme en statique** (≥ 4,9:1 modélisé, cas le plus défavorable : Émeraude, 320 px, pic d'animation, accroche à 5,23:1 ; B1). Composants : bord de champ **KO** (H7) ; bouton principal, lien, œil OK ; erreur Atelier à 4,513:1 (B2).
2. **Bordures de champs (1.4.11)** : H7, avec des valeurs de remplacement chiffrées.
3. **Cibles tactiles (2.5.8)** : conforme (≥ 44 px prévus, 44 × 44 mesuré pour l'œil) ; liens en ligne dans un message (`Refaire une demande`) exemptés. M1 pour les hauteurs fixes.
4. **Focus visible et non masqué (2.4.7, 2.4.11)** : œil conforme ; reste non spécifié (M5) ; 2.4.11 sans objet. Ordre de focus conforme (DOM).
5. **Reflow 320 px / 400 % (1.4.10) ; espacement du texte (1.4.12)** : pas de défilement horizontal (mesuré), mais **collision des libellés avec l'œil** (H8) et **hauteurs fixes** (M1) ; le bloc-marque tient (nom 182 px, 22 + 46 + 11 + 182 = 261 ≤ 298).
6. **Mouvement (2.2.2)** : **non conforme** (H1) ; mécanisme minimal = arrêt automatique à 5 s vers un état de repos sain (M3) ; `prefers-reduced-motion` correct sur le principe (`.scene * { animation: none !important }`) mais jugé insuffisant seul. 2.3.1 : conforme.
7. **Lecteurs d'écran** : décor et logo corrects ; **un seul `h1`** : absent en réel (H4) ; **repères** `header` / `main` : absents en réel, ambigus dans les planches (H4) ; **annonce des erreurs** : H6 ; **identification et suggestion d'erreur** : H5 (3.3.1, 3.3.3), exception de sécurité pour la connexion (B4) ; **bouton œil** : M2 ; **titre de page** : H3 ; **langue** : H2.
8. **Changement de thème aléatoire (3.2)** : pas de non-conformité (le tirage n'a lieu qu'à l'ouverture, jamais en réaction à une action, le thème est stable pendant la visite). Réserves de bonne pratique, sans constat : le thème tiré peut être le moins contrasté (Atelier : erreur 4,51:1, anneau `accent-2` 3,34:1) ; aucun des trois thèmes n'est clair, aucun sélecteur sur ces écrans (décision assumée) ; ne **jamais** annoncer le tirage.
9. **Couleur seule (1.4.1)** : erreur de formulaire portée par la couleur en réalité (H5) ; lien secondaire souligné (OK) ; état de l'œil par la forme + libellé (OK).
10. **Mode contraste forcé** : M4 ❓.
11. **Orientation (1.3.4)** : pas de verrouillage ; paysage 568 × 320 : défilement vertical, pas de barre horizontale.

## Ordre de traitement suggéré

1. **Avant `bmad-build` 34.3** (un mot dans les spines, aucun coût visuel) : H2, H3, H4, H1 (arrêt à 5 s), M3 (`.fly { opacity: 0 }`), H8 (consigne déplacée en `mat-hint`), H7 (jeton local), M5 (règle de focus), M1 (`min-height`, rem).
2. **À arbitrer** : H5 (quatre libellés de validation, contraire à « aucun texte nouveau »), H6 (conteneur `role="status"` et focus), M2 (retirer `aria-pressed` ou fixer le libellé).
3. **À la recette** : M4 (contraste forcé), B1 (mesure sur capture), B5 (remplissage automatique), 320 px avec libellé long, espacement de texte.

## Rappels réglementaires (hors périmètre d'accessibilité)

Aucune contrainte IEC 62304 / gestion des risques n'est concernée : produit grand public de planification de parties, pas de dispositif médical.
