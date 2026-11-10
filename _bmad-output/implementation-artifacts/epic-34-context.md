# Epic 34 Context: Entrée dans l'application

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

La porte d'entrée de l'application cesse de mentir et devient identifiable : plus de lien menant à une impasse, un message d'échec de connexion qui dit la vraie cause, des mots de passe révélables, des écrans d'authentification (connexion, inscription, mot de passe oublié, réinitialisation, changement d'e-mail) et le parcours « rejoindre par lien » mis en forme, accessibles et rendus sans clignotement de thème, puis une identité visuelle (« Dés Dispos ») qui dit au visiteur, avant lecture, qu'il s'agit de caler des parties de jeu de rôle entre amis. C'est la première impression des futurs joueurs. Épic front pur, sans changement d'API ni dépendance sortante.

## Stories

- Story 34.1: Messages d'erreur véridiques à la connexion (livrée, en review)
- Story 34.2: Champ de mot de passe révélable, lien mort retiré (livrée, en review)
- Story 34.3: Mise en forme des écrans d'authentification (structure, accessibilité, validation écrite, thème sans clignotement avec tirage au hasard)
- Story 34.4: Identité visuelle « Dés Dispos » des écrans d'authentification (bande animée, logo, emblèmes, accroches par thème, favicon)

## Requirements & Constraints

- L'inscription reste ouverte uniquement sur invitation ; seul le lien « Créer un compte » disparaît de la connexion. Le parcours d'inscription par lien valide reste entièrement fonctionnel.
- Un message d'erreur ne ment jamais sur la cause (identifiants invalides, service indisponible, erreur inattendue sans détail technique). Garde-fou d'énumération : jamais de distinction « compte inexistant » / « mot de passe incorrect ».
- Tout champ de mot de passe de l'application est révélable et re-masquable.
- 34.3 : aucun changement fonctionnel côté données (mêmes champs, mêmes règles de validation, mêmes routes, mêmes appels d'API) ; seuls sont assouplis l'envoi invalide (plus muet) et quelques textes nouveaux listés par la spec. 320 px sans défilement horizontal ni troncature ; une seule action principale pleine largeur par carte, actions secondaires sur leur propre rangée, cibles ≥ 44 px ; jamais la couleur seule pour porter une information.
- 34.3, validation : à l'envoi invalide, tous les messages apparaissent, le focus va au premier champ invalide, rien n'est envoyé, les saisies sont conservées ; un seul message par champ, qui nomme la règle (même habillé par un thème).
- 34.3, accessibilité : `lang="fr"`, un seul `h1` par écran dans un `<main>`, titre d'onglet par écran annoncé au changement d'écran, `role="alert"` sur les erreurs apparaissant après une action, `role="status"` dans un conteneur persistant pour réussites et « Chargement… » (focus déplacé si le bouton disparaît), messages présents dès le chargement en texte simple sans rôle, focus visible jamais supprimé, bord de champ ≥ 3:1.
- 34.4 : contraste du nom et de l'accroche sur la bande ≥ 4,5:1 (à confirmer sur capture à 320 et 375 px, trois thèmes) ; `prefers-reduced-motion` coupe l'animation d'office (composition de repos complète, sans comète).

## Technical Decisions

- Tout le travail reste dans `apps/web` ; aucune installation de dépendance, aucun raster ni police nouveaux (SVG inline, polices système). Commentaires en français (dérogation du dépôt).
- Une seule feuille de style partagée pour tous les écrans bâtis sur `auth-page` / `auth-card`, pour « rejoindre » et pour les écrans de confirmation / annulation de changement d'e-mail (contenu inchangé).
- Thème avant le premier rendu : `ThemeToneService` reste seul propriétaire (classe `theme-*` sur `body`, signal, cache local `jdr-theme`). Valeur mémorisée valide, sinon tirage équiprobable parmi `THEMES` (déclarée une seule fois dans `@master-jdr/shared`), une fois par chargement, **jamais écrit** dans le stockage. Exécuté au démarrage par un initialiseur d'application ; `applyClass` retire toute classe `theme-*`. Pas de script en ligne dans `index.html` (il dupliquerait la liste des thèmes) ; `index.html` porte seulement `lang="fr"`, `<title>Dés Dispos</title>` (repli) et un fond sombre neutre. Aucune clé de thème codée en dur (renommage `medieval-steampunk` → `atelier-cuivre` à l'épic 35).
- Titre d'onglet « Dés Dispos – <page> » via une `TitleStrategy` + propriété `title` par route, annonce par `LiveAnnouncer` du CDK (déjà utilisé).
- Jeton `--mat-sys-outline` éclairci dans les trois thèmes, dans `styles.scss`, pour toute l'application : contrôle visuel de non-régression à prévoir sur les formulaires existants.
- Textes de ton : clés ajoutées dans `TONE_MAP` (`tones.ts`) dans les trois thèmes avec test de parité : `auth.login_invite_only` (ligne d'orientation sur la connexion, texte seul, jamais un lien), `auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min` (en 34.3, libellé neutre identique dans les trois thèmes ; habillage thématique à l'épic 35), et en 34.4 l'accroche par thème (`auth.tagline`, nom provisoire). Le nom « Dés Dispos » n'est pas thématisé.
- 34.4 : bande `<header>` frère de `<main>`, scène animée en SVG inline (viewBox 440 × 180, seuls `transform` et `opacity` animés, couleurs par rôles du thème, jamais littérales), emblème du thème en filigrane, logo SVG inline en `currentColor` (jamais `<img>`), bloc-marque = pictogramme `aria-hidden` + nom en texte HTML (`id` de masque SVG uniques). Fichiers de référence du logo dans `ux-designs/ux-jdr-master-2026-10-05/logo/`. Le générateur de bannières de partie n'est pas réutilisable tel quel (calibré pour 320 × 124) : SVG dédié ou générateur étendu.
- Hors périmètre 34.3 : bandeau de navigation de l'application, favicon et marque après connexion (relèvent de la 34.4, dont le sort du bandeau « master-jdr » reste à arbitrer à la rédaction de sa spec).

## UX & Interaction Patterns

- Source UX de l'épic : passe `ux-designs/ux-jdr-master-2026-10-05` (`DESIGN.md`, `EXPERIENCE.md`, spines `final`). Les spines l'emportent sur les planches ; les invariants de la spec 34.3 l'emportent sur les détails des spines. Dans le delta UX, 34.3 correspond à §2, §3 (validation), §4 (carte, champs, validation), §5, §7, §9 ; 34.4 à §3 (accroches), §4 (bande), §10, et §11 (b).
- Mise en page : bande de marque au-dessus d'une carte ; mobile d'abord (320 px minimum), colonne centrée de 448 px dès 480 px, gouttière de 16 px. Ordre dans la carte : `h1`, champs (aide « 8+ caractères » en `mat-hint`, remplacée par le message de validation si la règle est violée), erreur du formulaire au-dessus de l'action principale, action principale, rangée d'actions secondaires soulignées, ligne d'orientation (connexion seule). Hauteurs en `min-height`.
- Aucun sélecteur de thème sur ces écrans ; le thème est le dernier connu localement, sinon tiré au hasard (navigation interne : thème conservé).
- 34.4, bande : clic ou toucher sur le fond animé fige l'animation sur place, un second la relance ; aucun bouton, non mémorisé ; écarts WCAG 2.2.2 et 2.1.1 acceptés et consignés par l'utilisateur (à revoir si l'application devient publique). Accroches : une par thème (Grimoire Émeraude, Forêt Ancienne, Atelier Cuivré), texte dans le delta UX §3.
- Contraste forcé : scène masquée, action principale bordée `ButtonText` (recette manuelle).
- Reportés non traités : `aria-pressed` du bouton de révélation, `aria-describedby` de la connexion, marge de l'erreur en Atelier Cuivré, jauge d'Atelier effleurant le logo.

## Cross-Story Dependencies

- Ordre : 34.1 → 34.2 → 34.3 → 34.4. 34.3 compose avec le bouton de révélation (34.2) et les messages de connexion (34.1), qu'elle conserve tels quels.
- 34.4 dépend de 34.3 (feuille partagée, structure `<main>`/`<h1>`, source unique de thème) : bande et textes viennent du même thème que la classe posée par 34.3.
- 34.3 s'appuie sur le repli local du thème de l'épic 28 (story 28.4) ; après connexion, le thème du compte prend le relais.
- L'épic 35 (thèmes et textes, en dernier) relit les textes de ces écrans, renomme `medieval-steampunk` et habille les messages de validation par thème ; ne rien coder en dur qui l'en empêche.
