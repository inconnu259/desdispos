---
title: "Mise en forme des écrans d'authentification"
type: 'feature'
created: '2026-10-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '2985446ae9b857c5e0ca0bec383f5594f61c05d9'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-34-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les écrans d'authentification sont la première impression d'un futur joueur et n'ont jamais été mis en forme : chacun recopie ses propres styles, la hiérarchie est plate (titre minuscule, bouton à largeur variable, actions secondaires en liens nus sans cible tactile), l'espacement du haut gaspille l'écran d'un téléphone, la page s'affiche un instant dans le mauvais thème (le thème n'est appliqué qu'après le démarrage d'Angular, alors que les trois thèmes sont sombres), un envoi invalide est muet, et la structure n'est pas accessible (langue `en`, aucun `h1` ni `<main>`, erreurs sans rôle d'annonce, un seul titre d'onglet « Web »).

**Approach:** Une feuille de style partagée pour tous les écrans bâtis sur `auth-page` / `auth-card` (connexion, inscription, mot de passe oublié, réinitialisation, confirmation et annulation de changement d'e-mail, et le parcours « rejoindre par lien »), une hiérarchie claire (titre `h1`, champs, **action principale pleine largeur**, actions secondaires séparées), un rendu mobile soigné, une structure accessible (langue, `h1` / `<main>`, rôles d'annonce, titre d'onglet par écran, messages de validation écrits), un jeton de bordure de champ lisible, et un thème appliqué **avant le premier rendu d'Angular** : le dernier thème connu, sinon un tirage au hasard parmi les trois. Front pur. **L'identité visuelle (bande animée, logo, emblèmes, accroches par thème, favicon) est la story 34.4**, dessinée par la même passe UX.

## Boundaries & Constraints

**Always:**
- **Une seule source de style** : une feuille partagée (partiel `@use` ou équivalent) remplace les copies des fichiers `.scss` des écrans ; plus de bloc `.auth-page` / `.auth-card` / `.error` recopié. Le parcours « rejoindre par lien » (`join`) et les écrans `confirm-email-change` / `rollback-email-change` (**sans changement de contenu**) adoptent la même mise en page (carte de même largeur, mêmes espacements, mêmes actions).
- **Hiérarchie** : titre de l'écran en `<h1 matCardTitle>` lisible (échelle typographique du système de design), champs, puis **une seule action principale** (bouton plein, pleine largeur sur téléphone, `min-height` plutôt que hauteur fixe) clairement distinguée des actions secondaires ; les actions secondaires (liens « Mot de passe oublié ? », « Retour à la connexion », « J'ai déjà un compte », « Refaire une demande »…) sont sur leur **propre rangée**, séparées de l'action principale, avec une cible d'au moins 44 px et une affordance visible autre que la couleur seule (soulignement ou forme de bouton texte).
- **Mobile** : aucun contenu tronqué ni débordant (les libellés longs passent à la ligne ; « 8+ caractères » sort du libellé des champs de mot de passe pour devenir un `mat-hint`) ; l'espacement vertical du haut s'adapte à l'écran au lieu de 4 rem fixes ; la carte occupe la largeur utile avec une gouttière de 16 px ; le contenu reste atteignable avec le clavier virtuel ouvert ; 320 px de large sans défilement horizontal.
- **Thème sans clignotement, tirage au hasard** : le thème est posé sur `<body>` (classe `theme-*`) **avant le premier rendu d'Angular** — le dernier thème connu (`jdr-theme` du stockage local), sinon (absent, illisible ou inconnu) **un tirage équiprobable parmi `THEMES`**, une fois par chargement, **jamais écrit** dans le stockage (sinon la visite suivante le prendrait pour connu). La logique reste **dans `ThemeToneService`** (liste `THEMES` déclarée une seule fois dans `@master-jdr/shared`, aucun nom de thème dupliqué) et s'exécute au démarrage de l'application, avant le premier rendu (initialiseur d'application). `ThemeToneService.applyClass` retire **toute** classe `theme-*` avant de poser la sienne. `index.html` porte un fond sombre neutre unique (seul code couleur codé en dur, hors thème, exception documentée) pour qu'aucun blanc n'apparaisse avant le démarrage. Après connexion, le thème du compte prend le relais (comportement existant).
- **Structure accessible** : `<html lang="fr">` ; chaque écran a un seul `h1` (le titre de carte) et la carte est dans un `<main>` (`aria-labelledby` vers le `h1`) ; `role="alert"` sur le message d'erreur **apparaissant après une action** sur **tous** ces écrans (seule la connexion le portait) ; `role="status"` sur les messages de réussite et sur « Chargement… » de « rejoindre », dans un **conteneur persistant** (présent avant l'action), avec **déplacement du focus** vers ce conteneur (`tabindex="-1"`) ou le `h1` quand l'action activée disparaît ; les messages **présents dès le chargement** (« Lien invalide. », « L'inscription se fait uniquement sur invitation… », raison d'un lien expiré de « rejoindre ») sont du texte simple **sans** `role="alert"`. Focus visible : contour 2 px `accent-1` décalé de 2 px sur liens et boutons de la carte, jamais `outline: none`. Contraste forcé : action principale bordée `1px solid ButtonText`.
- **Titre d'onglet par écran** : « Dés Dispos – <page> » (noms de page : tableau de `EXPERIENCE.md` §2), via une stratégie de titre de route (`TitleStrategy` + propriété `title` par route) ; `<title>Dés Dispos</title>` reste le repli d'`index.html` ; le titre est annoncé à chaque changement d'écran (`LiveAnnouncer` du CDK, déjà utilisé, aucune installation).
- **Validation écrite** : à l'envoi d'un formulaire invalide, `markAllAsTouched()`, **focus sur le premier champ invalide**, aucun appel serveur, saisies conservées ; sous chaque champ invalide, **un seul message écrit par règle non respectée**, qui nomme la règle et remplace l'aide tant qu'elle n'est pas respectée ; `aria-invalid` et `aria-describedby`. Quatre clés de ton, **présentes dans les trois thèmes** avec test de parité : `auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min` (règles et champs concernés : `EXPERIENCE.md` §3). Les **règles de validation elles-mêmes sont inchangées** (`required`, `email`, `minLength(3)`, `minLength(8)`). **Textes de cette story : le libellé neutre de référence de `EXPERIENCE.md` §3, identique dans les trois thèmes** (il nomme déjà la règle) ; l'habillage thématique relève de la revue éditoriale de l'épic 35 (FR-41).
- **Ligne d'orientation sur la connexion** : « L'inscription se fait sur invitation. », sous la rangée d'actions secondaires, clé de ton **`auth.login_invite_only`** dans les **trois thèmes** avec test de parité ; texte seul, jamais un lien.
- **Jeton de bordure de champ** : `--mat-sys-outline` éclairci **dans les trois thèmes, dans `styles.scss`, pour toute l'application** (valeurs et contrastes : `DESIGN.md` §2 — environ 3,2 / 3,3 / 3,1:1) ; couleurs ailleurs uniquement par les jetons `--mat-sys-*`. Jamais la couleur seule pour porter une information ; focus clavier visible ; les `aria-label` et l'ordre de focus existants sont conservés.
- **Aucun changement fonctionnel côté données** : mêmes champs, **mêmes règles de validation**, mêmes routes, mêmes messages d'erreur du serveur, mêmes appels d'API ; le bouton de révélation du mot de passe (34.2) et les messages d'erreur de la connexion (34.1) sont conservés. Sont assouplis, sur décision de l'utilisateur : un envoi invalide n'est plus muet, et les textes nouveaux listés ci-dessus sont autorisés.
- **Décision de l'utilisateur (2026-10-05) — passe UX et découpage.** La passe `bmad-ux` (`ux-jdr-master-2026-10-05`, spines `final`) a dessiné l'identité et la mise en page ; **en cas de conflit, les spines l'emportent sur les planches, et les invariants de cette section l'emportent sur les détails des spines**. L'identité visuelle (bande animée, logo « Dés Dispos », emblèmes, accroches par thème, pause au clic, favicon) est **reportée en story 34.4**.
- Commentaires en français (dérogation du dépôt).

**Never:**
- Aucun changement côté API, aucune nouvelle dépendance, aucune installation, aucun raster ni police nouveaux.
- Ne pas implémenter la bande animée, le logo, les emblèmes, les accroches, la pause au clic ni le favicon (story 34.4) ; ne pas modifier le bandeau de navigation de l'application (« master-jdr ») ni les écrans hors authentification ; ne pas modifier le contenu des écrans de confirmation / d'annulation de changement d'e-mail au-delà de la feuille partagée et de la structure.
- Ne pas dupliquer la liste des thèmes ni leurs couleurs dans `index.html` ; ne jamais écrire dans le stockage local le thème tiré au hasard.
- Ne pas traiter les constats d'accessibilité reportés (`aria-pressed` du bouton de révélation, `aria-describedby` de la connexion, erreur en Atelier Cuivré, jauge d'Atelier : `EXPERIENCE.md` §11 k).

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Hiérarchie | n'importe quel écran d'authentification | `h1`, champs, une action principale pleine largeur, actions secondaires sur une rangée distincte | N/A |
| Téléphone étroit | largeur 320 px, libellé long, message d'erreur affiché | aucun contenu tronqué ni débordant, aucune barre de défilement horizontale | N/A |
| Cibles tactiles | actions principales et secondaires | au moins 44 px, distinguables sans la couleur | N/A |
| Thème mémorisé | `jdr-theme` = un thème valide | la classe de ce thème est sur `<body>` avant le premier rendu d'Angular ; aucun passage par un autre thème | N/A |
| Aucun thème mémorisé | `localStorage` vide ou indisponible | un thème tiré parmi `THEMES`, posé avant le premier rendu ; **rien n'est écrit** dans le stockage ; sans erreur | N/A |
| Valeur invalide | `jdr-theme` illisible ou inconnu | traité comme « aucune information » : tirage ; toute classe `theme-*` résiduelle retirée | N/A |
| Navigation interne | rejoindre → inscription → connexion | le thème de la visite est conservé (un seul tirage par chargement) | N/A |
| Parcours « rejoindre » | page `join`, jeton valide, connecté ou non | même mise en page, mêmes actions (« Créer un compte » pleine largeur, « J'ai déjà un compte » en secondaire) ; connecté : « Rejoindre » seul | N/A |
| Écrans de changement d'e-mail | `confirm-email-change`, `rollback-email-change` | même feuille partagée, contenu et comportement inchangés | N/A |
| Orientation sur la connexion | page de connexion, chacun des trois thèmes | ligne d'orientation sous les actions secondaires, pas un lien ; clé présente dans les trois thèmes | N/A |
| Envoi invalide | champ vide, e-mail invalide, pseudo < 3, mot de passe < 8 | aucun appel serveur, tous les messages apparaissent, focus sur le premier champ invalide, saisies conservées ; le message nomme la règle | N/A |
| Erreur après action | échec d'inscription / d'oubli / de réinitialisation / de confirmation / d'annulation / de « rejoindre » | message sous les champs, `role="alert"`, annoncé sans déplacer le focus | N/A |
| Message présent au chargement | jeton manquant, lien expiré | texte simple sous le `h1`, sans `role="alert"`, action principale désactivée | N/A |
| Réussite | oubli, confirmation, annulation | message dans un conteneur `role="status"` persistant ; focus déplacé quand le bouton disparaît | N/A |
| Titre d'onglet | changement d'écran | titre « Dés Dispos – <page> » et annonce au lecteur d'écran | N/A |
| Langue | n'importe quel écran | `document.documentElement.lang === 'fr'` | N/A |
| Bord de champ | trois thèmes | contraste ≥ 3:1 sur la surface de carte | N/A |
| Régression fonctionnelle | formulaires de connexion, d'inscription (avec jeton), d'oubli, de réinitialisation | comportements, règles et messages du serveur inchangés | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/auth/{login,register,forgot-password,reset-password,confirm-email-change,rollback-email-change}/*.scss` -- chacun recopie `.auth-page` (flex centré, `padding: 4rem 1rem`), `.auth-card` (`max-width: 24rem`), `form` (colonne, `gap: 0.5rem`), `mat-form-field` (100 %) et `.error` ; à remplacer par la feuille partagée. `login.scss` en est le modèle.
- `apps/web/src/app/features/auth/*/*.html` -- structure commune : `mat-card` > `mat-card-header` (`mat-card-title`) > `mat-card-content` (formulaire, bouton `mat-flat-button` sans largeur imposée) > `mat-card-actions` (liens nus). La 34.1 a ajouté `role="alert"` au message de connexion, la 34.2 le bouton de révélation en `matSuffix` : à conserver. Les libellés « Mot de passe (8+ caractères) » / « Nouveau mot de passe (8+ caractères) » deviennent « Mot de passe » / « Nouveau mot de passe » + `mat-hint`.
- `apps/web/src/app/features/auth/*/*.ts` -- validateurs Angular (`required`, `email`, `minLength(3)` pseudo, `minLength(8)` mot de passe) ; soumission des formulaires (`markAllAsTouched`, focus sur le premier champ invalide à ajouter) ; messages d'erreur en signal.
- `apps/web/src/app/features/join/join.{html,scss,ts}` -- classes propres `join-page` / `join-card` (`max-width: 420px`, `padding: 2rem 1rem`), actions `mat-flat-button` + `mat-button` ; à rapprocher des écrans d'authentification ; `join.spec.ts` existe (créé par la 34.2).
- `apps/web/src/index.html` -- `<title>Web</title>`, `lang="en"`, `<body><app-root>`, aucun script, aucun style. `styles.scss` L22-37 règle `body { color-scheme: light; background-color: var(--mat-sys-surface) }` (clair par défaut : source du flash) et la feuille se charge **après** un éventuel style en ligne : le fond neutre sombre est donc un `<style>` en ligne `body:not([class*="theme-"]) { background-color: <sombre>; color-scheme: dark }` — la spécificité l'emporte sur la règle `body` et cesse de s'appliquer dès que la classe de thème est posée.
- `apps/web/src/app/app.routes.ts` (L22-50, aucune propriété `title` aujourd'hui) + `app.config.ts` (aucune `TitleStrategy`, aucun initialiseur) -- ajouter `title` aux sept routes d'authentification, une `TitleStrategy` (nouvelle) fournie par `app.config.ts` : titre `Dés Dispos – <page>` si la route en porte un, sinon `Dés Dispos` (repli, y compris après connexion) ; annonce par `LiveAnnouncer` de `@angular/cdk/a11y`, **qui n'est utilisé nulle part aujourd'hui** (le CDK `^22.1.3` est déjà une dépendance : aucune installation, patron à écrire).
- `apps/web/src/app/core/theme/theme-tone.service.ts` (35 lignes) -- `activeTheme = signal(readStoredTheme())` (défaut `grimoire-emeraude`, sans `try/catch` autour de `localStorage`), `applyClass()` privé (retire seulement les trois classes connues), `setTheme()` **seul endroit qui écrit `jdr-theme`** ; instancié par `App` (`app.ts` L14), Shell et ~60 composants. **Piège** : 15 specs hors du fichier du service lisent `tone()` / `'grimoire-emeraude'` sans poser `jdr-theme` ; un tirage dans le constructeur ou dans `readStoredTheme()` les rendrait aléatoires. **Le constructeur garde donc son défaut déterministe** ; une nouvelle méthode (ex. `applyVisitTheme()`), appelée **seulement** par l'initialiseur d'application de `app.config.ts` (inactif sous `TestBed`), tire le thème quand aucun thème valide n'est mémorisé, applique la classe et met à jour le signal **sans écrire** le stockage. `core/auth/auth.service.ts` L63-90 `syncTheme(user)` : thème du compte valide ⇒ `setTheme` (écrase) ; `theme === null` ⇒ pousse le thème actif vers le compte, donc **le thème tiré devient celui du compte à la première connexion** (comportement existant, conservé, signalé à l'utilisateur).
- `apps/web/src/app/core/theme/tones.ts` -- `TONE_MAP` : trois blocs de thème ; y ajouter `auth.login_invite_only` et les quatre `auth.field_*` dans chacun.
- `apps/web/src/styles.scss` -- jetons `--mat-sys-*` par classe `.theme-*` (L67, L132, L192) ; `--mat-sys-outline` à éclaircir : L119 `#5a5070`→`#6e6383`, L180 `#3a5040`→`#54735c`, L242 `#7a5030`→`#8b6541`. Utilisé aussi directement par 19 `var(--mat-sys-outline)` dans 12 `.scss` (calendrier, fiches, réserve, sondage…) et par tous les `mat-form-field` outline : c'est le périmètre du contrôle visuel de non-régression.
- **Faits relevés par l'investigation** : `confirm-email-change.html` utilise `.saved` mais son `.scss` ne le définit pas (la feuille partagée corrige) ; `join` n'a pas de signal de chargement (« Chargement… » = branche `@else`) et n'affiche l'erreur de `join()` que connecté ; `forgot-password` n'a **aucune spec** (à créer) ; `confirm`/`rollback` n'ont que des specs de logique ; les specs existantes cherchent `p.error`, `button[type="submit"]` et des `<a>` par texte/href (`/login`, `/forgot-password`, `/register` + `token=`) : ces sélecteurs doivent rester valides.
- Spines de la passe UX : `EXPERIENCE.md` (§2 tableau des écrans et titres, §3 textes, §4 patrons, §5 états, §7 accessibilité, §10 thème) et `DESIGN.md` (§2 couleurs, §7 composants) ; planches de référence `mockups/key-connexion.html`, `key-rejoindre.html` (sans la bande, hors périmètre).
- Patron de spec : `features/auth/login/login.spec.ts`, `register.spec.ts`, `reset-password.spec.ts`, `join.spec.ts` (créés par les 34.1 et 34.2).

## Tasks & Acceptance

**Execution:**
- [x] feuille de style partagée (nouveau partiel) + les six `.scss` d'authentification et `join.scss` -- hiérarchie, mobile, cibles de 44 px, `min-height`, focus visible, contraste forcé, actions secondaires séparées ; suppression des copies -- une seule source
- [x] gabarits `.html` des écrans d'authentification et de `join` -- `<main>` + `<h1 matCardTitle>`, structure commune (titre, action principale pleine largeur, rangée d'actions secondaires), rôles d'annonce et conteneurs `role="status"` persistants avec déplacement du focus, aide « 8+ caractères » en `mat-hint`, ligne d'orientation de la connexion -- hiérarchie lisible et annonces correctes
- [x] composants des quatre formulaires -- `markAllAsTouched()`, focus sur le premier champ invalide, messages de validation par règle (`mat-error`, `aria-invalid`, `aria-describedby`) -- envoi invalide non muet
- [x] `tones.ts` + `theme-tone.service.spec.ts` -- cinq clés (`auth.login_invite_only`, `auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min`) dans les trois thèmes, texte neutre de référence de `EXPERIENCE.md` §3, tests de parité -- décisions de l'utilisateur
- [x] `theme-tone.service.ts` + spec -- tirage équiprobable parmi `THEMES` quand aucun thème valide n'est mémorisé, non écrit dans le stockage ; `applyClass` retire toute classe `theme-*` ; exécution au démarrage avant le premier rendu (initialiseur d'application) ; tests (thème mémorisé, aucun, invalide, stockage indisponible, aucune écriture) -- thème sans clignotement
- [x] `index.html` -- `lang="fr"`, `<title>Dés Dispos</title>`, fond sombre neutre -- pas de flash blanc
- [x] `app.routes.ts` + `TitleStrategy` + spec -- titre « Dés Dispos – <page> » par route, annonce au lecteur d'écran -- un titre par écran
- [x] `styles.scss` -- `--mat-sys-outline` éclairci dans les trois thèmes -- bord de champ ≥ 3:1
- [x] écrans `confirm-email-change` et `rollback-email-change` sur la feuille partagée (contenu inchangé) -- décision de l'utilisateur
- [x] specs des écrans d'authentification et de `join` -- structure (une action principale, rangée d'actions secondaires, `h1`, `main`), rôles, validation, mêmes liens et mêmes messages qu'avant -- couvre la matrice
- [x] story 34.4 (identité visuelle) ajoutée à `epics.md` et `sprint-status.yaml` (backlog) -- découpage décidé

**Acceptance Criteria:**
- Given les écrans d'authentification et le parcours « rejoindre par lien », when je les ouvre sur téléphone, then leur hiérarchie visuelle est lisible et aucun contenu n'est tronqué ni ne déborde.
- Given un écran comportant une action principale et des actions secondaires, when il s'affiche, then l'action principale est distinguée des secondaires.
- Given je ne suis pas connecté, when j'ouvre l'un de ces écrans, then il s'affiche dans le dernier thème connu localement, ou dans un thème tiré au hasard si aucun n'est connu, sans clignotement, et le tirage n'est jamais mémorisé.
- Given un formulaire d'authentification invalide, when je le valide, then chaque champ fautif affiche un message qui nomme la règle, le focus va au premier champ fautif et rien n'est envoyé.
- Given n'importe quel écran d'authentification, when un lecteur d'écran le parcourt, then la langue est le français, le titre d'onglet nomme l'écran, la structure a un `h1` dans un `<main>`, et les erreurs et réussites sont annoncées.

## Implementation Notes

- Feuille partagée : `features/auth/auth-card.scss` (`@use` par les six écrans et `join.scss`) ; aides communes dans `features/auth/auth-form.ts` (`fieldErrorKey`, `rejectInvalidSubmit`, `ariaInvalid`).
- `aria-invalid` : Material le retire pour un champ vide et obligatoire ; le gabarit le lie explicitement (`ariaInvalid`) pour que l'envoi d'un champ laissé vide reste signalé.
- « Refaire une demande » (réinitialisation) passe de lien en ligne à action secondaire, affichée si le jeton manque ou après un échec.
- `styles.scss` : `@include cdk.a11y-visually-hidden()` ajouté, sans quoi le conteneur `LiveAnnouncer` s'affichait en clair sous la page. `LiveAnnouncer` n'était en réalité utilisé nulle part avant cette story.
- Annonce du titre : seulement pour une route qui porte un `title` (écrans d'authentification) ; le repli « Dés Dispos » de la zone connectée n'est pas annoncé à chaque navigation.
- Thème : `applyVisitTheme()` (initialiseur d'application) ; le constructeur garde le défaut déterministe. À la première connexion d'un visiteur sans thème mémorisé, le thème tiré devient celui du compte (`AuthService.syncTheme`, comportement existant inchangé).
- Story 34.4 : déjà présente dans `epics.md` et `sprint-status.yaml` (backlog).
- **Vérifié par le chef de build** (diff relu depuis `2985446`, 33 fichiers modifiés et 5 créés dans `apps/web`) : tests ciblés 196/196 ; web 2961/2963 (2 échecs connus et datés, `calendar-view.spec`, hors story) ; `ng build` OK (seuls avertissements de budget `calendar-*.scss`, préexistants) ; `eslint` sans sortie sur les fichiers touchés. Aucun changement d'API ni de dépendance.
- **Lignes de matrice sans test automatisé** (faits statiques ou CSS, non couverts par la suite Vitest) : « Téléphone étroit » (320 px) et « Cibles tactiles » (44 px) — relevés au serveur de dev par le sous-agent à 320 et 375 px ; « Langue » (`lang="fr"` dans `index.html`) et « Bord de champ » (trois valeurs de `--mat-sys-outline`) — vérifiés à la lecture du diff ; « Navigation interne » — vrai par construction (l'initialiseur ne s'exécute qu'une fois par chargement).
- **Non fait** : contrôles manuels de la section Verification (tirage du thème avec un stockage vide dans un vrai navigateur déconnecté, trois thèmes, clavier virtuel, contraste forcé, lecteur d'écran, non-régression visuelle du jeton `--mat-sys-outline` sur toute l'application).

## Spec Change Log

## Review Triage Log

Revue du 2026-10-05, première passe (Blind Hunter, Edge Case Hunter, Verification Gap). Constats dédoublonnés par cause ; B = blind, E = edge, V = verification-gap.

- **[V][B] Rien ne teste le câblage réel : initialiseur `applyVisitTheme`, fournisseur `TitleStrategy`, `title` des huit routes** — `medium`, patch : supprimer la ligne de l'initialiseur ou un `title:` laisse toute la suite verte, alors que le tirage par visite et le titre par écran sont le cœur de la story ; la CI ne construit pas le front. Spec `app.config.spec.ts` ajouté (configuration réelle).
- **[E] `[attr.aria-invalid]` explicite et liaison d'hôte de `MatInput` : après « valeur valide puis champ vidé », l'attribut est effacé** — `medium`, patch : le test ajouté a ÉCHOUÉ (attribut `null`), la liaison d'hôte de Material l'emporte sur celle du gabarit ; un lecteur d'écran n'était plus prévenu qu'un champ obligatoire vidé est invalide. Corrigé par une petite directive (`auth/aria-invalid.ts`, pose l'attribut après chaque rendu) remplaçant les quatre `[attr.aria-invalid]` ; test passant.
- **[B] `tabindex="-1"` inutile sur le conteneur `role="status"` de « rejoindre »** — `low`, patch : aucun code ne le focalise sur cet écran ; suppression directe.
- **[E][B] « Chargement… » indéfini si `loadSession()` rejette sur « rejoindre »** — `low`, defer : préexistant (`join.ts` inchangé, `ngOnInit` identique à `2985446`).
- **[B] « Rejoindre » sans état d'envoi : un double clic envoie deux demandes** — `low`, defer : préexistant (le bouton n'avait déjà aucun `disabled`).
- **[B] Sur « rejoindre », la raison d'un lien expiré arrive après la réponse du serveur, donc n'est pas annoncée (pas de `role="alert"`), alors que le commentaire dit « présent dès le chargement »** — `medium` (le fait est réel), rejeté comme patch : la décision est inscrite dans le bloc figé (raison d'un lien expiré = texte simple, décision de l'utilisateur du 2026-10-05) ; la corriger éditerait l'intention. **Signalé à l'utilisateur** : sa décision reposait sur la prémisse « présent au chargement », exacte pour les écrans à jeton manquant, pas pour « rejoindre » où le message arrive après « Chargement… ».
- **[B] Les titres d'onglet ne couvrent que les routes d'authentification ; repli « Dés Dispos » non annoncé ailleurs ; annonce redoublée au premier chargement** — `low`, rejeté : le périmètre de la story est l'authentification et le repli est décidé par la spec ; l'annonce au chargement est voulue (« à chaque changement d'écran »).
- **[E] Annonce répétée du même titre en cas de navigation vers le même écran** — `low`, rejeté : aucun lien ne renvoie un écran d'authentification vers lui-même, et la garde ajoute un état.
- **[E] Un champ invalide dont l'erreur n'est pas mappée (`maxlength`, futur validateur) afficherait un `mat-error` vide** — `low`, rejeté : les sept champs n'ont que `required`, `email` et `minlength`, tous mappés ; un message de repli inventerait un texte.
- **[E] `afterNextRender` avec l'injecteur d'un composant détruit pendant l'appel** — `low`, rejeté : l'exception est avalée par le `catch` existant, l'état modifié appartient à un composant détruit, rien n'est visible.
- **[E] Thème tiré puis remplacé par le thème du compte pour un utilisateur connecté sans thème local** — `low`, rejeté : comportement existant (défaut fixe remplacé de la même manière) ; la spec renvoie explicitement au thème du compte après connexion.
- **[E][B] Le constructeur pose `theme-grimoire-emeraude` avant que `applyVisitTheme` ne le remplace** — `false` : les deux s'exécutent de façon synchrone dans l'initialiseur, aucun affichage entre les deux.
- **[B] L'`<style>` en ligne d'`index.html` pourrait être bloqué par une future CSP** — `low`, rejeté : spéculatif, aucune CSP n'est posée sur le front.
- **[B] Le sélecteur `body:not([class*="theme-"])` est trop large** — `false` : il ne s'applique qu'avant le démarrage d'Angular, où `<body>` n'a aucune classe.
- **[B] Jeton `--mat-sys-outline` global sans preuve de contraste ni contrôle des autres écrans** — `low`, rejeté : contrastes recalculés à la passe UX (3,21 / 3,25 / 3,12:1, rapport de validation) et décision explicite de l'utilisateur ; le contrôle visuel de non-régression est inscrit dans la section Verification.
- **[B] Le partiel `@use` est émis dans chacun des sept composants (encapsulation émulée)** — `low`, rejeté : le critère « une seule source » est tenu à la source, aucun avertissement de budget sur ces composants au build ; une feuille globale changerait l'approche de la spec.
- **[B] « Refaire une demande » sorti du message d'erreur de la réinitialisation** — `low`, rejeté : placement décidé par les spines (`EXPERIENCE.md` §2, rangée d'actions secondaires).
- **[B] Aides `invalid()` / `fieldError()` répétées dans quatre composants ; clés de ton triplées et texte d'invitation dupliqué ; tests avec `as any`, boucle `settle()`** — `low`, rejeté : enveloppes d'une ligne sur des aides partagées, motif de ton des stories 34.1 et 34.2, hygiène de test déjà rejetée à la 34.2.
- **[B] Pas de résumé d'erreurs annoncé pour plusieurs champs invalides ; thème différent à chaque rechargement ; `applyVisitTheme` non idempotent** — `false` / `low`, rejeté : le focus va au premier champ et chaque champ porte son message (la spec ne demande pas de résumé) ; le thème non mémorisé est la règle voulue ; la méthode n'est appelée qu'une fois par chargement.

## Design Notes

Thème : `ThemeToneService` lit `jdr-theme` ; valeur valide ⇒ elle ; sinon `THEMES[Math.floor(Math.random() * THEMES.length)]`, **non écrite**. Le service est instancié par un initialiseur d'application (`provideAppInitializer`) pour que la classe de `<body>` précède le premier rendu ; le fond sombre neutre d'`index.html` couvre l'intervalle avant le démarrage du bundle. Rejeté : un script en ligne (il dupliquerait la liste des thèmes, qui change à l'épic 35) et une liste injectée au build (outillage disproportionné). Message de validation : un seul à la fois par champ (vide ⇒ « requis » ; sinon la première règle non respectée) ; il remplace le `mat-hint`.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/auth/**/*.spec.ts" --include "src/app/features/join/*.spec.ts" --include "src/app/core/theme/*.spec.ts"` -- expected: tous les tests passent
- `docker compose exec web pnpm test` -- expected: aucune régression hors échecs préexistants connus (`calendar-view.spec`, dates figées)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front)
- `docker compose exec web pnpm lint` -- expected: aucune erreur nouvelle sur les lignes modifiées

**Manual checks (if no CLI):**
- En émulation mobile (320 px puis 375 px) : les cinq écrans et le parcours « rejoindre », dans les trois thèmes, clavier virtuel ouvert ; vérifier l'absence de clignotement en rechargeant chaque écran avec `jdr-theme` réglé sur chacun des trois thèmes (cache vidé, débit réseau limité)  ; vérifier le titre d'onglet par écran, `lang="fr"`, l'annonce des erreurs et des réussites (lecteur d'écran), le tirage du thème (aucun thème mémorisé : plusieurs rechargements donnent des thèmes différents et `jdr-theme` reste vide), et, en contraste forcé Windows, l'action principale bordée.
- Contrôle visuel de non-régression du jeton `--mat-sys-outline` éclairci sur l'ensemble de l'application (formulaires du tableau de bord, du profil, des parties, des fiches), dans les trois thèmes.
