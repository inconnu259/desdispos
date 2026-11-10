---
title: "Identité visuelle « Dés Dispos » des écrans d'authentification"
type: 'feature'
created: '2026-10-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd0ab7c1109824cd17765248bda7f224c01a24ade'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-34-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les écrans d'authentification sont impersonnels : une carte sans nom, sans image, sans logo, qui « pourrait être pour n'importe quoi ». Un visiteur qui ne connaît pas l'application ne comprend pas qu'il s'agit de trouver un créneau pour se retrouver et jouer à des jeux de rôle. Après connexion, le bandeau dit encore « master-jdr » et l'onglet affiche l'icône par défaut d'Angular.

**Approach:** Une bande commune au-dessus de la carte de chaque écran d'authentification : décor SVG animé propre au thème actif, logo « Dés Dispos » (d20 coché), nom et accroche propre au thème. Le même logo remplace le mot-symbole du bandeau de l'application et sert de favicon. Front pur ; livrable de la passe UX `ux-jdr-master-2026-10-05` (spines `final`).

## Boundaries & Constraints

**Always:**
- **Une bande, un composant dédié** (`app-auth-band`, sa propre feuille de style, jamais dans la feuille partagée `auth-card.scss` qui est compilée en sept copies), inséré **avant** `<main>` dans chacun des sept gabarits (`login`, `register`, `forgot-password`, `reset-password`, `confirm-email-change`, `rollback-email-change`, `join`) : un `<header>` **frère** de `<main>`, sans aucun `<h1>` (le seul titre reste celui de la carte). Décision de l'utilisateur (2026-10-05) : l'animation repart à chaque écran ; l'état de pause n'est jamais mémorisé.
- **Le thème actif pilote tout** : scène, emblème et accroche viennent du même signal `ThemeToneService.activeTheme`, par un `Record<Theme, …>` ou `@switch` sans dupliquer la liste `THEMES` ni coder une clé de thème en dur à plusieurs endroits ; la classe de `<body>` et le signal ne divergent jamais (déjà garanti par `applyVisitTheme()`).
- **Contenu de la bande** : décor animé `aria-hidden` (`focusable="false"` sur les SVG), filigrane d'emblème, bloc-marque = pictogramme du logo (`aria-hidden`) + nom « Dés Dispos » en texte HTML + accroche en texte HTML ; le bloc-marque n'est pas cliquable. Dessins, couleurs, tailles, voile, halo de texte, mise en page 320 px / 480 px et colonne de 448 px : `DESIGN.md` §1, §4, §7 et planche `mockups/key-connexion.html` (les spines l'emportent sur la planche : `min-height` et non hauteur fixe, `overflow: hidden` limité au calque de décor). Couleurs par les variables de thème (`--jdr-*`, `--mat-sys-*`) ; aucune clé de thème ni couleur en dur dans la scène, hors la tuile du favicon.
- **Mouvement** : animations en boucle, `transform` et `opacity` seulement ; `prefers-reduced-motion: reduce` coupe tout d'office (`animation: none`), composition de repos sans comète (`.fly` à `opacity: 0` de base). **Pause au clic** : un clic ou un toucher sur la scène (le fond animé, pas le bloc-marque) fige l'animation sur place (`animation-play-state: paused`), un second clic la relance ; aucun bouton, état non mémorisé. Écarts WCAG 2.2.2 (partiel) et 2.1.1 acceptés et consignés (`EXPERIENCE.md` §11 j) : un avertissement du lint de gabarit sur cet élément est ce même écart, à désactiver de façon ciblée et commentée.
- **Accroche par thème** : une clé de ton `auth.tagline` dans les **trois thèmes**, textes de `EXPERIENCE.md` §3 (Émeraude « Trouvez le soir où le grimoire s'ouvre » ; Forêt « Un feu de camp, des amis, et une date qui arrange tout le monde » ; Atelier « On cale tout le monde, et on lance la machine ! »), avec test de parité. Le nom « Dés Dispos » n'est pas thématisé.
- **Marque après connexion** (décision de l'utilisateur, 2026-10-05) : dans le bandeau de l'application, le mot-symbole « master-jdr » (barre d'outils de bureau) devient le bloc-marque (pictogramme + « Dés Dispos », 36 px) et le « jdr » compact mobile devient le pictogramme seul (28 px, accent 1) ; chacun reste un lien vers `/` avec le nom accessible « Dés Dispos ». Rien d'autre dans le bandeau ne change.
- **Favicon** : un SVG dédié à fond de tuile et glyphe fixes (`DESIGN.md`, composant `favicon-tile` : jamais `currentColor`, hors thème), placé dans `apps/web/public/` et déclaré dans `index.html` ; `favicon.ico` conservé en repli.
- Logo : un seul dessin source (le fichier `logo/logo-picto.svg` de la passe UX, inliné dans le composant, sans `role` ni `<title>`, `aria-hidden`) ; `id` de défs uniques par instance. Texte « Dés Dispos » en HTML (la conversion du texte en tracés pour un usage figé reste hors périmètre).
- Commentaires en français (dérogation du dépôt).

**Never:**
- Aucun changement côté API, aucune nouvelle dépendance ni installation, aucun raster, aucune police nouvelle (polices système).
- Ne pas réutiliser le générateur `party-banner` (viewBox, graine et mode incompatibles) ; ne pas copier le CSS de la bande dans la feuille partagée des écrans.
- Ne pas ajouter de sélecteur de thème sur ces écrans ; ne pas mémoriser l'état de pause ; ne pas toucher aux écrans hors authentification, au dépôt, au README ni aux noms de paquets (« master-jdr » technique inchangé).
- Ne pas traiter les constats d'accessibilité reportés (`aria-pressed`, `aria-describedby` de la connexion, erreur d'Atelier, jauge d'Atelier : `EXPERIENCE.md` §11 k).

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Bande par thème | n'importe quel écran d'authentification, chacun des trois thèmes | `<header>` avant `<main>`, scène et emblème du thème, nom « Dés Dispos », accroche = `auth.tagline` du thème, aucun `<h1>` dans la bande | N/A |
| Une seule source de vérité | thème actif changé | scène, emblème et accroche suivent le même thème | N/A |
| Décor | tout écran | chaque SVG décoratif `aria-hidden` et non focalisable ; le nom et l'accroche sont du texte | N/A |
| Pause | clic sur la scène | `is-paused` : animations figées sur place ; second clic : reprise ; aucun bouton | N/A |
| Clic hors scène | clic sur le bloc-marque | rien ne se passe | N/A |
| Navigation | passage d'un écran à l'autre | la bande repart animée, jamais en pause | N/A |
| Réduire les animations | `prefers-reduced-motion: reduce` | aucune animation, composition de repos sans comète | N/A |
| Mouvement | feuille de style de la bande | seuls `transform` et `opacity` sont animés | N/A |
| Étroit | 320 px | aucun texte tronqué ni débordant, accroche à la ligne, aucune barre de défilement horizontale | N/A |
| Parité | les trois thèmes | `auth.tagline` présente, non vide, distincte d'un thème à l'autre | N/A |
| Marque après connexion, bureau | barre d'outils de l'application | pictogramme + « Dés Dispos », lien vers `/`, nom accessible « Dés Dispos » | N/A |
| Marque après connexion, mobile | bandeau contextuel | pictogramme seul, lien vers `/`, nom accessible « Dés Dispos » | N/A |
| Favicon | document | `link rel="icon"` SVG présent, repli `.ico` conservé | N/A |
| Régression | écrans d'authentification | structure, formulaires, messages et rôles de la 34.3 inchangés (un `h1` dans un `<main>` par écran) | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/auth/{login,register,forgot-password,reset-password,confirm-email-change,rollback-email-change}/*.html` et `features/join/join.html` -- chaque gabarit commence par `<main class="auth-page" aria-labelledby="auth-title">` (join : `aria-labelledby` conditionnel) ; y insérer `<app-auth-band />` juste avant ; chaque composant ajoute l'import. Les specs existantes comptent « un seul h1 dans un `<main>` » : la bande ne doit contenir ni `<h1>` ni `<main>`.
- `apps/web/src/app/features/auth/auth-card.scss` -- `.auth-page` (flex, `padding: clamp(1rem, 6vh, 3.5rem) 1rem 2rem`) et `.auth-card` (max-width 28rem) : à réconcilier avec la bande (mobile : bande collée en haut, carte à 16 px de gouttière dessous ; bureau : marge d'environ 56 px au-dessus de la bande, colonne de 448 px commune). Compilée une fois par composant : n'y rien ajouter de la bande.
- Nouveau composant `apps/web/src/app/features/auth/auth-band/` (`auth-band.{ts,html,scss}` + spec) -- scène, emblème et accroche par thème, logo, bloc-marque, pause au clic ; styles propres. Planche source : `_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/mockups/key-connexion.html` (défs L183-247 : `mask#g-cut`, `symbol#mark-g`, rouage, 3 emblèmes ; scènes L264-362 ; CSS bande L113-126, keyframes `dd-*` L150-172, pause L174-177 et script L645-654). La planche variabilise le thème par classes locales `.th-*` ; l'application utilise `.theme-<clé>` sur `<body>` et `--jdr-*` / `--mat-sys-*` : remapper. `--jdr-banner-glow` n'est pas global (défini sur `:host` de `party-banner.scss`) : le redéfinir dans la bande. Symbols, CSS et `<use href>` vivent dans le même composant (comme `party-banner`) ; comportement des `<use>` sous encapsulation émulée à vérifier au rendu. Logo : `.../ux-jdr-master-2026-10-05/logo/logo-picto.svg` (évidé en `evenodd`, sans masque, avec `role="img"`, `<title>` et un bloc `<style>` à retirer pour l'inlinage).
- `apps/web/src/app/core/theme/theme-tone.service.ts` -- `activeTheme` (signal) ; `tones.ts` -- `TONE_MAP` : ajouter `auth.tagline` à côté des clés `auth.*` des trois thèmes ; `theme-tone.service.spec.ts` -- patron de parité des clés. Aucune clé d'accroche n'existe aujourd'hui.
- `apps/web/src/app/layout/shell/shell.html` L6 (`<span class="logo" routerLink="/">master-jdr</span>` dans la `mat-toolbar`, masqué sur mobile quand `contextualNav.title()` est posé) et L92 (`<a class="wordmark-compact" routerLink="/">jdr</a>`) ; `shell.scss` L8, L126-134, L157-170, L203-204. Aucune spec n'asserte aujourd'hui le texte de la marque : en ajouter une. Maquette de mise en situation (non contractuelle) : `mockups/logos-et-emblemes-2.html` sections P2 / P3.
- `apps/web/src/index.html` L8 `<link rel="icon" type="image/x-icon" href="favicon.ico" />` ; `apps/web/public/favicon.ico` (icône Angular par défaut) ; titre d'onglet « Dés Dispos » déjà livré en 34.3 (ne pas y retoucher). Favicon : nouveau fichier dans `apps/web/public/` (glob d'assets `public/**`).
- `apps/web/src/app/shared/party-banner/party-banner-motion.spec.ts` -- garde exécutable : lit les `.scss` listés dans `STYLESHEETS` (L28-31), vérifie que chaque `@keyframes` n'anime que `transform` / `opacity` et que `prefers-reduced-motion: reduce` est présent ; y ajouter la feuille de la bande (ligne « Mouvement » de la matrice). Patron de spec de composant : `party-banner.spec.ts` (stub de `ThemeToneService` avec `activeTheme` et `tone` en signaux).
- `angular.json` L38-49 -- budget `anyComponentStyle` (avertissement 4 ko, erreur 8 ko, build de production ; la CI ne construit pas le front) : le CSS de la bande (environ 5 ko source) doit tenir ; mesurer au build.

## Tasks & Acceptance

**Execution:**
- [x] `features/auth/auth-band/` -- composant de bande (scène par thème, emblème, logo inliné, bloc-marque, accroche, pause au clic, réduction des animations) avec sa feuille de style et sa spec (trois thèmes, `aria-hidden`, absence de `h1`, pause et reprise, clic hors scène sans effet, accroche = clé de ton) -- identité de la page
- [x] les sept gabarits d'authentification et leurs composants -- `<app-auth-band />` avant `<main>` et import -- bande sur chaque écran
- [x] `auth-card.scss` -- `.auth-page` réconcilié avec la bande (haut, gouttière 16 px, colonne de 448 px) sans y copier la bande -- mise en page mobile et bureau
- [x] `tones.ts` + `theme-tone.service.spec.ts` -- clé `auth.tagline` dans les trois thèmes, parité -- accroche par thème
- [x] `party-banner-motion.spec.ts` -- ajout de la feuille de la bande à la garde de mouvement -- seuls transform / opacity
- [x] `shell.html` + `shell.scss` + spec -- bloc-marque (bureau) et pictogramme seul (mobile) avec nom accessible, liens vers `/` -- marque après connexion
- [x] `apps/web/public/` + `index.html` -- favicon SVG dédié, repli `.ico` -- onglet
- [x] specs des écrans d'authentification -- non-régression (un `h1` dans un `<main>`, formulaires et rôles de la 34.3) -- couvre la matrice

**Acceptance Criteria:**
- Given n'importe quel écran d'authentification, dans chacun des trois thèmes, when il s'affiche, then une bande au décor propre au thème, le nom « Dés Dispos », son logo et l'accroche du thème précèdent la carte.
- Given la bande animée, when je clique ou touche le fond animé, then l'animation se fige sur place et un second clic la relance ; and avec « réduire les animations » elle reste immobile d'office.
- Given l'application après connexion, when je regarde le bandeau et l'onglet, then la marque est « Dés Dispos » (logo et nom) et le favicon est celui du logo.

## Implementation Notes

- Bande : `features/auth/auth-band/` (`app-auth-band`, feuille propre, scène par thème via un unique `Record<Theme, scène>` dans `auth-band.ts`) ; insérée avant `<main>` dans les sept gabarits. Logo : `shared/brand/brand-logo.ts` (`app-brand-logo`, un seul dessin inliné, `currentColor`, taille par `--brand-logo-size`), réutilisé par la bande et par le bandeau de l'application (écart assumé avec la spec, qui disait « inliné dans le composant » : un seul dessin source pour les deux usages). Favicon : `public/favicon.svg` (tuile et glyphe fixes) + `favicon.ico` en repli 32×32.
- `auth-card.scss` : `:host { display: block }`, haut de page rendu à la bande (le `clamp(…6vh…)` disparaît), gouttière de 16 px sous la bande, marge basse plus grande dès 480 px.
- Accroche d'Atelier : espace insécable avant « ! » (comme la planche).
- Shell : six specs de badge ciblent désormais `nav.nav-bar a[routerLink="/"]` (le nouveau lien de marque serait sinon le premier `a[routerLink="/"]`).
- Le lint de gabarit ne signale pas le `(click)` sur le `<svg aria-hidden>` : aucune désactivation de règle ; l'écart WCAG est commenté dans `auth-band.html`.
- **Vérifié par le chef de build** (diff relu depuis `d0ab7c1`) : web 2993/2995 (2 échecs connus et datés, `calendar-view.spec`, hors story) ; `ng build` OK, `auth-band.scss` absent des avertissements `anyComponentStyle` (les autres sont préexistants) ; `eslint` sans sortie sur les fichiers touchés. Aucun changement d'API ni de dépendance.
- **Non fait** : contrôles manuels de la section Verification — contraste du nom et de l'accroche au pic d'animation (trois thèmes, 320 et 375 px), contraste forcé Windows, réduction des animations en navigateur, bandeau de l'application (bureau et mobile, après connexion) et favicon dans l'onglet jamais vus à l'écran. La jauge d'Atelier frôle le logo à 375 px (point déjà reporté, `EXPERIENCE.md` §11 k).

## Spec Change Log

## Review Triage Log

Revue du 2026-10-05, première passe (Blind Hunter, Edge Case Hunter, Verification Gap). Constats dédoublonnés par cause ; B = blind, E = edge, V = verification-gap.

- **[E] Deux `<link rel="icon">` dans l'ordre SVG puis ICO(32×32) : Chromium peut retenir l'entrée suivante et afficher l'ancienne icône par défaut au lieu de la tuile** — `medium`, patch : le favicon est un critère d'acceptation et l'ordre usuel sûr est l'inverse (`.ico` avec `sizes`, puis SVG avec `sizes="any"`) ; réordonné. À confirmer à l'œil dans un navigateur (contrôle manuel).
- **[E] Le bloc-marque (`.bm` en `inline-flex` sans retour à la ligne, nom en 2 rem) peut déborder la boîte de contenu à 320 px avec une taille de texte agrandie et provoquer un défilement horizontal** — `low`, patch : correction directe de deux déclarations CSS (retour à la ligne autorisé, `overflow-wrap: anywhere`), sans effet à taille normale ; la spine impose « aucun texte tronqué ni débordant » à 320 px.
- **[B] Le commentaire de `brand-logo.ts` annonce « l'UNIQUE dessin source » alors que `favicon.svg` répète les mêmes tracés** — `low`, patch : correction du commentaire (le favicon, statique et hors thème, répète les tracés et se tient à jour à la main).
- **[V][B] La coupure par « réduire les animations », la pause et les couches `pointer-events` ne sont verrouillées que par des regex sur le texte du `.scss`, aucun moteur de rendu** — `low`, rejeté : même approche que la garde de la 29.11 (le dépôt n'a aucun banc CSS en navigateur) ; la couche `pointer-events` a été vérifiée par un vrai clic au serveur de dev (clic sur la scène : pause ; clic sur l'accroche : rien) ; la réduction des animations reste au contrôle manuel inscrit à la spec.
- **[B] La commande de pause n'est ni découvrable ni clavier, animation sans arrêt automatique ; une règle de lint de gabarit pourrait casser le build** — `false` / rejeté : écart WCAG 2.2.2 et 2.1.1 décidé par l'utilisateur et consigné (`EXPERIENCE.md` §11 j) ; le lint passe sans suppression (`eslint` sans sortie).
- **[B] Les tests CSS par regex cassent au moindre reformatage** — `low`, rejeté : la garde existante de la 29.11 suit le même patron et signale volontairement toute dérive du fichier.
- **[B] Le nom « Dés Dispos » et la pile Georgia sont écrits en dur à plusieurs endroits** — `low`, rejeté : un renommage futur toucherait quelques fichiers, mais une constante partagée ajouterait de l'indirection pour un texte de marque ; le nom est de toute façon écrit en texte HTML par décision de la spec.
- **[B][E] Aucun repli si `auth.tagline` manque dans un thème (`Record<string, string>`), `<p class="tag">` vide** — `low`, rejeté : la présence dans les trois thèmes est testée, même décision qu'aux 34.1 à 34.3 ; l'épic 35 tient la parité à la découpe des thèmes.
- **[B] Typographie des accroches (apostrophe droite, une seule espace insécable) et vouvoiement d'Émeraude** — `low`, rejeté : textes de `EXPERIENCE.md` §3 choisis par l'utilisateur, l'espace insécable de la troisième reprend la planche.
- **[B] Tailles fixes en px dans la bande contre la consigne « rem » ; contraste du texte sur le décor non mesuré** — `low`, rejeté : valeurs de la planche validée à 320, 375 et 1280 px ; la mesure du contraste est un contrôle manuel inscrit à la spec.
- **[B][E] Mise en page de `auth-card.scss` (haut de page rendu à la bande, `padding-bottom` de 4,5 rem, tablette, alignement 448 px) et bandeau mobile de l'application (nom plus grand que l'ancien `.logo`)** — `low`, rejeté : rendu vérifié par le sous-agent à 320, 375 et 1280 px (colonne commune de 448 px, 56 px au-dessus de la bande) ; les 36 px de la marque sont dans la spec.
- **[B] Gabarit SVG de 360 lignes dupliqué (dégradés, étoiles, lucioles écrits à la main)** — `low`, rejeté : le dessin est repris tel quel de la planche ; une génération par données changerait des rendus validés pour un gain de lecture.
- **[B][E] Double-clic ou double-tap sur la scène : pause puis reprise aussitôt ; clic sous « réduire les animations » sans effet visible ; contraste forcé : bande haute sans décor ; trous de test (états « chargement » de `join`, thème avant connexion)** — `low`, rejeté : bascule simple voulue par la spec (pas de bouton ni de mémoire), conséquences sans gravité, le texte reste lisible en contraste forcé, `join` ne modifie pas la bande entre ses états.
- **[B][E] Le repli `favicon.ico` reste l'icône Angular par défaut et sa taille déclarée n'est pas vérifiée** — `low`, rejeté : repli explicitement conservé par la spec (« `favicon.ico` conservé en repli ») ; un nouveau `.ico` est un livrable graphique hors de cette story. Signalé à l'utilisateur.

## Design Notes

Insertion de la bande : `<app-auth-band />` répété dans les sept gabarits (rejeté : layout de route parent, qui ferait persister l'animation et l'état de pause entre écrans et ne garderait plus le `<header>` strictement frère de `<main>` ; composant-enveloppe de l'écran entier, qui déplace aussi `<main>` et l'`aria-labelledby` de `join`). Les spines demandent « identique d'un écran à l'autre » et « état de pause non mémorisé » : l'animation repart à chaque écran, c'est voulu. Le favicon est statique et hors thème, c'est la seule couleur codée en dur de l'identité.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/auth/**/*.spec.ts" --include "src/app/features/join/*.spec.ts" --include "src/app/layout/**/*.spec.ts" --include "src/app/shared/party-banner/*.spec.ts" --include "src/app/core/theme/*.spec.ts"` -- expected: tous les tests passent
- `docker compose exec web pnpm test` -- expected: aucune régression hors échecs préexistants connus (`calendar-view.spec`, dates figées)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur, aucun nouvel avertissement de budget (`anyComponentStyle`) sur la bande
- `docker compose exec web pnpm exec eslint <fichiers touchés>` -- expected: aucune erreur sur les lignes modifiées

**Manual checks (if no CLI):**
- Rendu des trois thèmes à 320 px, 375 px et 1280 px sur la connexion et sur « rejoindre » (scène, logo, nom, accroche lisibles, aucun texte tronqué) ; contraste du nom et de l'accroche ≥ 4,5:1 sur capture, au pic d'animation, dans les trois thèmes ; clic sur la scène (pause, reprise) ; « réduire les animations » activé ; contraste forcé Windows ; aspect du bloc-marque et du pictogramme dans le bandeau de l'application (bureau et mobile) et du favicon dans l'onglet.
