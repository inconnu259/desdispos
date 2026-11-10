---
title: jdr-master Experience — Delta écrans d'authentification et identité de marque (Story 34.3)
status: final
updated: 2026-10-05
inherits: "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
design: "./DESIGN.md"
sources:
  - "_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md"            # FR-37 à FR-40 (§4.8)
  - "_bmad-output/implementation-artifacts/spec-34-3-mise-en-forme-des-ecrans-dauthentification.md"
  - "_bmad-output/implementation-artifacts/epic-34-context.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-09-23/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-08-04/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/.memlog.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-jdr-master-2026-10-05/review-accessibilite.md"
---

# jdr-master — Experience — Delta écrans d'authentification et identité de marque (34.3)

Ce document est un **delta** : il hérite de l'EXPERIENCE.md `ux-jdr-master-2026-09-23` (et, par lui, des spines de base) et ne décrit que le comportement propre aux écrans d'authentification, au parcours « rejoindre par lien » et à l'identité de marque. Le visuel est dans [DESIGN.md](./DESIGN.md) (tokens référencés par leur nom, ex. `{colors.error}`, et noms de composants identiques). Planches de référence : [`mockups/key-connexion.html`](mockups/key-connexion.html), [`mockups/key-rejoindre.html`](mockups/key-rejoindre.html) (amendées pour refléter ces spines : `h1` / `<main>`, pause au clic, messages de validation). **Les spines l'emportent sur les planches.**

Problème traité : la première impression de l'application est **impersonnelle** — « juste une carte » sans titre, sans nom, sans image, sans logo, qui « pourrait être pour n'importe quoi ». Objectif n°1 de l'utilisateur : qu'un visiteur qui ne connaît pas l'application **identifie le genre (jeu de rôle) et l'esprit (trouver un créneau pour se retrouver et jouer) dès l'arrivée**, sur chacun des trois thèmes. Les écrans n'ont par ailleurs jamais été mis en forme (hiérarchie plate, actions secondaires sans cible tactile) — FR-40.

## 1. Foundation

Web responsive, Angular Material 22 — hérité. **Mobile d'abord** pour ces écrans (le lien d'invitation s'ouvre typiquement sur téléphone `[ASSUMPTION]`) ; **320 px = largeur minimale** ; colonne de 448 px centrée au-delà de 480 px. DESIGN.md est la référence d'identité visuelle. Surfaces **hors zone authentifiée** : aucun `Shell`, aucune navigation. Front pur : aucun changement d'API (spec 34.3). Enjeu : consumer / première impression ; **aucune contrainte réglementaire** (IEC 62304 / gestion des risques non concernées).

Décisions de la spec 34.3 reprises sans les rouvrir : **une seule feuille de style partagée** pour tous les écrans bâtis sur `auth-page` / `auth-card` et pour « rejoindre » ; action principale pleine largeur et distinguée des secondaires ; **aucun changement fonctionnel** (mêmes champs, **mêmes règles de validation**, mêmes routes, mêmes messages d'erreur serveur) ; thème appliqué **avant le premier affichage** ; écrans de confirmation / d'annulation d'e-mail sur la même feuille **sans changement de contenu** ; ligne d'orientation sur la connexion.

**Ajouts décidés après la spec** (conflits : §11 a) : messages de validation de champ (§3) ; correctifs d'accessibilité sans effet visuel (`lang`, `h1` / `<main>`, rôles d'annonce, titre de page par écran : §7) ; bord de champ éclairci dans toute l'application (DESIGN.md §2) ; animation de la bande en pause au clic (§4).

## 2. Information Architecture

**Surfaces** (toutes hors zone authentifiée ; bande + carte communes, DESIGN.md §4) :

| Surface | Route | Titre de page (onglet) | Carte : `h1` → contenu | Action principale | Actions secondaires |
| --- | --- | --- | --- | --- | --- |
| Connexion | `/login` | « Dés Dispos – Connexion » | « Connexion » → Email ou pseudo, Mot de passe (révélable), [erreur] | « Se connecter » | « Mot de passe oublié ? » ; ligne d'orientation sous la rangée |
| Inscription | `/register?token=` | « Dés Dispos – Créer un compte » `[ASSUMPTION]` | « Créer un compte » → Email, Pseudo, Mot de passe (aide « 8+ caractères ») (révélable), [erreur] | « Créer le compte » | « J'ai déjà un compte » |
| Mot de passe oublié | `/forgot-password` | « Dés Dispos – Mot de passe oublié » `[ASSUMPTION]` | « Mot de passe oublié » → Email, [erreur] ; après envoi : message de confirmation (`role="status"`) | « Envoyer le lien » | « Retour à la connexion » |
| Réinitialisation | `/reset-password/:token` | « Dés Dispos – Nouveau mot de passe » `[ASSUMPTION]` | « Nouveau mot de passe » → Nouveau mot de passe (aide « 8+ caractères ») (révélable), [erreur] | « Réinitialiser » | « Retour à la connexion » ; « Refaire une demande » (lien invalide / erreur) |
| Confirmer un changement d'e-mail | `/confirm-email-change/:token` | « Dés Dispos – Confirmer le changement d'e-mail » `[ASSUMPTION]` | « Confirmer le changement d'adresse e-mail » → [erreur] ; après : « Votre adresse e-mail a été changée. » (`role="status"`) | « Confirmer » | « Retour à la connexion » |
| Annuler un changement d'e-mail | `/rollback-email-change/:token` | « Dés Dispos – Annuler le changement d'e-mail » `[ASSUMPTION]` | « Annuler le changement d'adresse e-mail » → texte d'avertissement, [erreur] ; après : confirmation (`role="status"`) | « Restaurer mon ancienne adresse » ; après : « Continuer vers la réinitialisation du mot de passe » | « Retour à la connexion » |
| Rejoindre par lien | `/join/:token` | « Dés Dispos – Rejoindre » | « Rejoindre « <partie> » » + sous-titre (système de jeu) → texte | visiteur : « Créer un compte » ; connecté : « Rejoindre » | visiteur : « J'ai déjà un compte » |

- **Contenu quasi inchangé** : les titres, libellés et messages ci-dessus sont ceux du code actuel (hors épic 35). **Seuls ajouts de texte** : messages de validation de champ (§3), aide « 8+ caractères » **sortie du libellé** des deux champs de mot de passe (le libellé devient « Mot de passe » / « Nouveau mot de passe »), titres de page (ci-dessus), accroches et ligne d'orientation (§3).
- La **bande** (marque) et la **carte** sont les deux seuls blocs de chaque écran ; la bande est identique d'un écran à l'autre, seul le thème la change.
- **Aucun sélecteur de thème** sur ces écrans (décision) ; le choix du thème se fait dans le profil, après connexion.
- Bouclage : chaque écran a un parcours qui y mène (§8 pour « rejoindre », « Mot de passe oublié ? » depuis la connexion, liens d'e-mail pour réinitialisation et changement d'adresse) et une sortie (« Retour à la connexion », « J'ai déjà un compte », redirection après réussite).
- **Marque après connexion — HORS PÉRIMÈTRE de la 34.3** (décidé par l'utilisateur, mais la spec 34.3 interdit de redessiner le bandeau de l'application) : barre d'outils bureau (« master-jdr » → bloc-marque, 36 px dans la maquette de mise en situation), bandeau contextuel mobile (« jdr » → pictogramme seul, 28 px, accent 1), favicon, titre d'onglet « Dés Dispos » (repli, hors écrans d'authentification : sur ceux-ci le titre est par écran, tableau ci-dessus). À rattacher à la spec amendée ou à une story dédiée (§11, b). Référence non contractuelle : [`mockups/logos-et-emblemes-2.html`](mockups/logos-et-emblemes-2.html), section P2 / P3.

## 3. Voice and Tone

Ton **chaleureux et malicieux** (brand voice : DESIGN.md §1). Microcopy ci-dessous ; les textes des écrans en dehors du tableau sont ceux du code (§2).

**Accroches par thème** — une clé de ton **par thème** (**à créer**, `[ASSUMPTION]` nom `auth.tagline`), test de parité sur les trois thèmes :

| Thème | Accroche |
| --- | --- |
| Grimoire Émeraude | « Trouvez le soir où le grimoire s'ouvre » |
| Forêt Ancienne | « Un feu de camp, des amis, et une date qui arrange tout le monde » |
| Atelier Cuivré | « On cale tout le monde, et on lance la machine ! » |

Le **nom « Dés Dispos »** est la marque constante : il n'est pas thématisé `[ASSUMPTION]`. Seule l'accroche change avec le thème.

**Ligne d'orientation** (connexion) : « L'inscription se fait sur invitation. » — clé **`auth.login_invite_only`**, **à créer dans les trois thèmes**, texte clair qui nomme l'invitation, test de parité ; **pas un lien**, ne ment pas sur la règle métier. Le lien « Créer un compte » n'existe pas sur la connexion (FR-37, livré en 34.2).

**Messages d'échec de connexion** (34.1, clés existantes, **conservées telles quelles** ; `role="alert"`) :

| Clé | Grimoire Émeraude | Forêt Ancienne | Atelier Cuivré |
| --- | --- | --- | --- |
| `auth.login_invalid` | Le grimoire ne vous reconnaît pas : identifiants invalides. | Le carnet ne te reconnaît pas : identifiants invalides. | L’établi ne vous reconnaît pas : identifiants invalides. |
| `auth.login_reset_required` | Ce compte doit être réinitialisé : utilisez « Mot de passe oublié ? » pour rouvrir le grimoire. | Ce compte doit être réinitialisé : utilise « Mot de passe oublié ? » pour rouvrir le carnet. | Ce poste doit être réinitialisé : utilisez « Mot de passe oublié ? » pour le remettre en marche. |
| `auth.login_throttled` | Trop de tentatives. Patientez une minute avant de frapper de nouveau à la porte du grimoire. | Trop de tentatives. Patiente une minute avant de retenter ta chance. | Trop de tentatives. Patientez une minute avant de relancer la connexion. |
| `auth.login_unavailable` | Le grimoire est indisponible pour le moment. Réessayez dans quelques instants. | Le carnet est indisponible pour le moment. Réessaie dans quelques instants. | L’établi est indisponible pour le moment. Réessayez dans quelques instants. |
| `auth.login_unexpected` | Une erreur est survenue. Réessayez. | Une erreur est survenue. Réessaie. | Une erreur est survenue. Réessayez. |

**Libellés du bouton de révélation** (34.2, existants, neutres, non thématisés) : `auth.password_show` « Afficher le mot de passe » · `auth.password_hide` « Masquer le mot de passe ».

**Messages de validation de champ** (**nouveau**, décidé par l'utilisateur) — **un court message sous le champ, par règle non respectée**, **dans les trois thèmes** (clés de ton, comme les messages de la 34.1), **mais qui nomme toujours la règle** : la métaphore du thème ne remplace jamais le nom de la règle. Règles **réelles**, inventoriées dans les validateurs Angular de `apps/web/src/app/features/auth/*` :

| Écran → champ | Validateurs | Règle(s) à nommer |
| --- | --- | --- |
| Connexion → Email ou pseudo | `required` | champ requis |
| Connexion → Mot de passe | `required` | champ requis (aucune règle de longueur : la connexion ne révèle pas la politique de mot de passe) |
| Inscription → Email | `required`, `email` | champ requis ; adresse e-mail valide |
| Inscription → Pseudo | `required`, `minLength(3)` | champ requis ; 3 caractères minimum |
| Inscription → Mot de passe | `required`, `minLength(8)` | champ requis ; 8 caractères minimum |
| Oubli → Email | `required`, `email` | champ requis ; adresse e-mail valide |
| Réinitialisation → Nouveau mot de passe | `required`, `minLength(8)` | champ requis ; 8 caractères minimum |

**Clés de ton à créer** (4, **dans chacun des trois thèmes**, test de parité sur les trois thèmes). Texte de référence **neutre** ci-dessous ; les textes thématiques finaux restent à rédiger, et chacun doit contenir le nom de la règle (« champ », « adresse e-mail », « 3 caractères », « 8 caractères ») :

| Clé (`[ASSUMPTION]` noms) | Règle | Utilisée par | Libellé neutre de référence |
| --- | --- | --- | --- |
| `auth.field_required` | champ requis | tous les champs des quatre formulaires (7 champs) | « Renseignez ce champ. » |
| `auth.field_email_invalid` | adresse e-mail valide | Inscription, Oubli | « Adresse e-mail invalide. » |
| `auth.field_pseudo_min` | pseudo de 3 caractères minimum | Inscription | « 3 caractères minimum. » |
| `auth.field_password_min` | mot de passe de 8 caractères minimum | Inscription, Réinitialisation | « 8 caractères minimum. » |

Un **seul** message affiché à la fois par champ (champ vide : « requis » ; sinon la première règle non respectée). Tutoiement / vouvoiement : comme les clés `auth.login_*` de chaque thème (Forêt Ancienne tutoie). L'**aide** « 8+ caractères » (`mat-hint`, sous les champs de mot de passe) n'est **pas** une clé de ton : texte neutre en dur, comme les libellés `[ASSUMPTION]`.

**Règles** : un message d'erreur **nomme sa cause par un mot clair** et ne ment jamais (FR-38) ; un message de validation **nomme la règle** et dit la valeur attendue (3, 8), même quand le thème l'habille ; la connexion ne distingue jamais « compte inexistant » de « mot de passe incorrect » (garde-fou d'énumération, un seul message `auth.login_invalid`). Libellés d'état **en mots, pas en codes**. L'accroche n'est pas un titre.

`[NOTE FOR UX]` Les textes des écrans hors tableaux (titres, libellés, `Lien invalide.`, etc.) sont **codés en dur** dans les gabarits, en tutoiement ou en vouvoiement selon l'écran, et ne passent pas par le registre de ton. La spec 34.3 interdisait tout texte nouveau : cette interdiction est **levée** pour les messages de validation, l'aide « 8+ caractères », les titres de page, les accroches et la ligne d'orientation (§11 a). L'harmonisation du reste relève de la revue éditoriale de l'épic 35 (FR-41).

## 4. Component Patterns

Visuel et noms canoniques : DESIGN.md §7. Comportement :

- **Bande d'authentification** : `<header>` frère de `<main>`. Décor identique d'un écran à l'autre (`aria-hidden` sur la scène et le filigrane), **animé en boucle** (principes des bannières : DESIGN.md §1), **sans arrêt automatique**. Le thème actif choisit la scène, l'emblème et l'accroche : **la même source de vérité** pour la classe de thème et pour les textes (§10). Elle défile avec la page (non épinglée) `[ASSUMPTION]`.
  - **Pause / reprise** : un clic ou un toucher sur le fond animé lui-même (la scène) **fige l'animation sur place** (`animation-play-state: paused`) ; un second clic la relance. **Aucun bouton visible** ; le bloc-marque, non cliquable, ne déclenche rien. Ce n'est **pas** un retour à la composition de repos : la comète ou la luciole en cours reste figée où elle est. **L'état de pause n'est pas mémorisé** : la bande repart animée à chaque chargement (décision de l'utilisateur).
  - **Conséquence assumée** : une comète ou une luciole figée peut rester sous l'accroche (contraste de 1,0 à 3,3:1 mesuré dans ce cas).
  - **Réduire les animations** : `prefers-reduced-motion: reduce` **coupe l'animation d'office** (aucun geste), composition au repos sans comète (définition vérifiable : DESIGN.md §1).
  - **Écarts d'accessibilité acceptés** : commande ni découvrable ni activable au clavier, décor `aria-hidden` (WCAG 2.2.2 partiellement non satisfait ; 2.1.1 (clavier) non satisfait pour cette commande : pause au clic seulement) ; §11 (j).
- **Bloc-marque** : logo (SVG inline, `currentColor`) + nom « Dés Dispos » en texte + accroche. Non cliquable sur ces écrans `[ASSUMPTION]`. Le pictogramme est décoratif (`aria-hidden`) puisque le nom est écrit à côté.
- **Carte d'authentification** : le `<main>` contient la carte ; un seul titre par carte, un `<h1 matCardTitle>` ; un seul formulaire ; **une seule action principale** (pleine largeur) ; l'erreur du formulaire s'affiche **sous les champs, au-dessus** de l'action principale, sans déplacer le reste ; la ligne d'orientation n'existe que sur la connexion. L'ordre de lecture et de focus est celui du DOM : titre, champs, bouton œil de chaque champ mot de passe, action principale, actions secondaires. Les `aria-label` et l'ordre de focus existants sont conservés.
- **Champs** : Material `appearance="outline"`, libellé flottant ; `autocomplete` inchangés (`username`, `current-password`, `new-password`, `email`) ; **règles de validation inchangées** (§3, table). **Consigne de règle hors du libellé** : « 8+ caractères » en `mat-hint` sous les deux champs de mot de passe.
- **Validation des formulaires** (nouveau) : à l'envoi d'un formulaire invalide, `markAllAsTouched()` (tous les messages apparaissent d'un coup), **focus sur le premier champ invalide** (ordre du DOM), aucun appel serveur. Sous chaque champ invalide et touché : **un court message écrit par règle** (§3), qui **remplace l'aide** (`mat-hint`) tant que la règle n'est pas respectée. `aria-invalid="true"` sur le champ invalide et `aria-describedby` vers son message (Material relie `mat-error` ; **à vérifier à la recette** : l'aide aussi doit rester reliée quand elle est visible). Le message disparaît dès que la règle est respectée. Les saisies ne sont jamais effacées. La couleur ne porte pas seule l'erreur (§7).
- **Action principale** (`auth-primary-action`) : `min-height` (le libellé passe à la ligne) ; désactivée pendant l'envoi (comportement existant : `[disabled]="loading()"`) et tant que le jeton manque (inscription sans jeton, réinitialisation / confirmation / annulation sans jeton) ; aucun indicateur de chargement supplémentaire n'est spécifié (§11).
- **Rangée d'actions secondaires** : liens de navigation (`routerLink`) sur leur propre rangée, centrés, retour à la ligne autorisé, **soulignés** ; chacun garde sa destination actuelle.
- **Ligne d'orientation** : texte seul, sous la rangée d'actions de la connexion ; jamais un lien, jamais un bouton.
- **Bouton de révélation du mot de passe** (34.2, **inchangé**) : `<button type="button">` — ne soumet jamais le formulaire ; bascule œil / œil barré ; `aria-pressed` (**arbitrage en report** : la revue relève un cumul `aria-pressed` + libellé changeant, M2, §11 k) ; libellé `auth.password_show` / `auth.password_hide` ; le clic ne redonne pas le focus au champ (le focus clavier reste sur le bouton) ; présent sur **tout** champ de mot de passe (connexion, inscription, réinitialisation).
- **Rejoindre — carte** : la carte garde son contenu (« Rejoindre « <partie> » », système de jeu, texte) ; « Créer un compte » est un lien d'action principale vers `/register?token=`, « J'ai déjà un compte » le secondaire vers `/login` ; connecté, « Rejoindre » devient l'action principale, sans secondaire.

## 5. State Patterns

| État | Surface | Comportement |
| --- | --- | --- |
| **Repos** | tous les écrans | Bande animée en boucle (ou en composition de repos, sans comète, sous « réduire les animations »), carte, champs vides, libellés au repos, aide « 8+ caractères » visible sous les champs de mot de passe. |
| **Bande en pause** | tous | Clic / toucher sur la scène : animations **figées sur place** (`animation-play-state: paused`), pas de retour au repos ; un second clic les relance. Une comète ou une luciole figée peut rester sous l'accroche (écart accepté, §11 j). Aucun indicateur visible, état non mémorisé (§4). |
| **Envoi en cours** | formulaires, confirmer, annuler | Action principale désactivée ; contenu inchangé ; aucun saut de mise en page. |
| **Champ invalide (envoi)** | connexion, inscription, oubli, réinitialisation | `markAllAsTouched()` ; **focus sur le premier champ invalide** ; sous chaque champ invalide, **un court message écrit par règle** (§3) qui remplace l'aide, `aria-invalid` + `aria-describedby` ; aucun appel serveur ; saisies conservées. Le message est annoncé au focus du champ (relié par `aria-describedby`). |
| **Erreur de formulaire** | connexion | Message du thème (§3), `role="alert"`, sous les champs ; les saisies sont conservées. Cas : identifiants invalides · compte à réinitialiser · trop de tentatives · service indisponible · erreur inattendue. |
| **Erreur de formulaire** | inscription, oubli, réinitialisation, confirmer, annuler, rejoindre | Message existant, en `{colors.error}`, sous les champs (ou sous le texte), **`role="alert"`** sur chacun (erreur apparaissant après une action) ; annoncé sans déplacer le focus (§7). |
| **Inscription sans jeton** | `/register` | Message existant (« L'inscription se fait uniquement sur invitation… ») **présent dès le chargement** : texte simple sous le `h1`, **sans** `role="alert"` (§7) ; action principale désactivée. |
| **Envoi réussi** | oubli | Message de confirmation à la place du formulaire, dans un conteneur **`role="status"` persistant** ; action principale absente ; « Retour à la connexion » reste. |
| **Lien invalide (jeton manquant)** | réinitialisation, confirmer, annuler | « Lien invalide. » **présent dès le chargement** : texte simple sous le `h1`, **sans** `role="alert"` ; sur la réinitialisation s'y ajoute « Refaire une demande » ; action principale désactivée. |
| **Réussite** | confirmer, annuler | Message de réussite à la place de l'action, dans un conteneur **`role="status"` persistant** ; le **focus est déplacé** sur ce conteneur (`tabindex="-1"`) ou sur le `h1` puisque le bouton activé disparaît (§7) ; sur l'annulation, « Continuer vers la réinitialisation du mot de passe » devient l'action principale. |
| **Chargement** | rejoindre | « Chargement… » dans le conteneur `role="status"` persistant, dans la carte, sous la bande ; `[ASSUMPTION]` non maquetté. |
| **Lien introuvable** | rejoindre | Titre « Lien introuvable », « Ce lien d'invitation n'existe pas. », aucune action ; non maquetté. |
| **Lien invalide / expiré** | rejoindre | Titre et sous-titre conservés, raison renvoyée par l'API (ex. « Lien expiré. ») en `{colors.error}`, **présente dès le chargement : texte simple sans `role="alert"`** (décision de l'utilisateur : message présent au chargement, non produit par une action), **aucune action** (planche `key-rejoindre.html`). |
| **Déjà connecté** | rejoindre | « Tu es connecté en tant que <nom>. », « Rejoindre » principal ; erreur éventuelle (`role="alert"`) sous le texte ; non maquetté. |
| **Sans mouvement** | tous | `prefers-reduced-motion: reduce` : animations de la bande **coupées d'office** (aucun geste requis) ; composition de repos complète, **sans comète** (`.fly` à `opacity: 0` de base ; définition : DESIGN.md §1) ; rien de lumineux ne doit chevaucher le logo ni le texte. Vérifié à la lecture du CSS seulement (§11 f). |
| **Contraste forcé** | tous | `forced-colors: active` : scène et voile masqués, action principale bordée (`ButtonText`) (DESIGN.md §7). Recette manuelle, ❓ non testé. |
| **Thème inconnu / stockage indisponible** | tous | Pas d'erreur : le tirage (§10) s'applique ; aucune écriture n'est tentée. |
| **320 px** | tous | Aucun texte tronqué (l'accroche et les libellés longs passent à la ligne), aucune barre de défilement horizontale. |
| **Clavier virtuel ouvert** | formulaires | Le contenu reste atteignable (défilement de la page) ; la bande ne se fige pas. |

## 6. Interaction Primitives

Tap / clic sur les champs, boutons et liens ; Entrée soumet le formulaire (comportement existant). **Cible tactile ≥ 44 px** partout : action principale 48 px, champs 56 px, bouton œil 44 px, liens secondaires ≥ 44 px. Navigation clavier standard (Tab / Maj+Tab, ordre du DOM, focus visible : contour 2 px `{colors.accent-1}`, décalage 2 px). **Envoi invalide** : le focus passe au premier champ invalide. Aucun geste de glisser, aucun survol requis. **Seule interaction sur la bande** : clic / toucher sur le fond animé = pause / reprise (sans bouton, non activable au clavier : écarts 2.2.2 et 2.1.1 consignés, §11 j). Aucun sélecteur de thème. Le bouton œil n'interrompt pas la saisie : le focus reste sur le bouton (§4).

## 7. Accessibility Floor

Hérité, plus :

- **Décor** : la scène animée, le filigrane de l'emblème et le pictogramme du logo sont **`aria-hidden="true"`** (et `focusable="false"` sur les SVG) ; aucune information n'y est portée, le nom et l'accroche sont du texte. Le bloc-marque de la bande utilise le **pictogramme + le texte HTML** (pas `logo-bloc-marque.svg`, dont le `role="img" aria-label` doublerait le nom) ; les `id` du masque SVG du pictogramme (`g-cut`) sont **uniques**, ou le `<defs>` partagé une seule fois.
- **Langue** : `<html lang="fr">` (`index.html` portait `lang="en"` : un lecteur d'écran lisait le français avec une voix anglaise). Critère de recette : `document.documentElement.lang === 'fr'`.
- **Structure** : la bande est un `<header>`, **frère** de `<main>` ; `<main>` est le **conteneur de la carte** (`aria-labelledby` vers le `h1`) ; **un seul `h1` par écran** : le titre de carte, `<h1 matCardTitle>` (`<mat-card-title>` rend sinon un `<div>`) ; le nom de marque n'est pas un titre ; titres de carte en `overflow-wrap: anywhere` (nom de partie sans espaces sur « rejoindre »).
- **Titre de page** : « **Dés Dispos – <page>** » (marque d'abord, tiret demi-cadratin), **un titre par écran** (tableau §2), via une **stratégie de titre de route** (`TitleStrategy` + propriété `title` par route ; `<title>Dés Dispos</title>` reste le repli d'`index.html`). **À chaque changement d'écran**, le titre est **annoncé au lecteur d'écran** (`LiveAnnouncer` du CDK, déjà utilisé par `DetailSurface`, aucune installation). Aucun texte de contenu ajouté à l'écran (WCAG 2.4.2, 4.1.3).
- **Annonces d'état** : `role="alert"` (annoncée sans déplacer le focus) sur le **message d'erreur apparaissant après une action**, **sur tous les écrans d'authentification** (inscription, oubli, réinitialisation, confirmer, annuler, `join()` : seule la connexion le portait, 34.1) ; **`role="status"`** sur les **messages de réussite**, dans un **conteneur persistant** (présent dans le DOM avant l'action : sinon l'annonce est perdue) qui reçoit aussi « Chargement… » de « rejoindre » ; quand l'action activée disparaît, le **focus passe** à ce conteneur (`tabindex="-1"`) ou au `h1`. Les messages **présents dès le chargement** (« Lien invalide. », « L'inscription se fait uniquement sur invitation… », raison d'un lien expiré) sont du **texte simple sous le `h1`, sans `role="alert"`** (une alerte insérée au chargement est annoncée de façon inégale) ; l'action principale reste désactivée et le texte l'explique.
- **Erreurs de champ** : message écrit sous le champ, `aria-invalid="true"` + `aria-describedby`, focus sur le premier champ invalide à l'envoi (§4) (WCAG 3.3.1, 3.3.3). Exception de sécurité : la connexion ne propose pas de correction sur `auth.login_invalid` (garde-fou d'énumération de comptes, 3.3.3 s'efface devant la sécurité).
- **Mouvement** : boucle **sans arrêt automatique** ; `prefers-reduced-motion: reduce` ⇒ `animation: none` sur tout le décor, d'office ; composition de repos complète et **sans comète**. N'animer que `transform` et `opacity`. Pause / reprise au clic ou toucher sur la scène : gel sur place (§4). **Écarts acceptés** : **2.2.2** (niveau A, partiellement non satisfait) et **2.1.1** (clavier, niveau A : pause au clic seulement) ; commande non découvrable, décor `aria-hidden` ; décisions de l'utilisateur, à revoir si l'application devient publique (§11 j). 2.3.1 : conforme (périodes ≥ 3,4 s, variations lentes).
- **Focus** : **`:focus-visible` = contour 2 px `{colors.accent-1}`, décalage 2 px**, sur tous les liens et boutons de la carte (champs : état focus Material), **jamais `outline: none`** (y compris pour la pilule) ; le bouton œil garde son focus livré (34.2) `[ASSUMPTION]` ; ordre de focus du DOM, `aria-label` existants conservés. 2.4.11 (focus non masqué) : sans objet, aucun élément fixe.
- **Contraste forcé** (`forced-colors: active`, Windows) : scène et voile masqués, action principale bordée `1px solid ButtonText` (DESIGN.md §7) ; recette manuelle sur la connexion et sur « rejoindre » (❓ non testé).
- **Cibles** : ≥ 44 px (voir §6).
- **Information jamais par la couleur seule** : erreur de champ et de formulaire = couleur + message écrit ; action secondaire = couleur + soulignement ; état du bouton œil = forme de l'icône + libellé (+ `aria-pressed` tant que M2 est en report) ; accroche et nom = texte.
- **Contrastes** (voir DESIGN.md §2 : valeurs mesurées) : texte ≥ 4,5:1, indicateurs ≥ 3:1, dans les trois thèmes. **Bord de champ corrigé** : `--mat-sys-outline` à 3,2 / 3,3 / 3,1:1 (Émeraude / Forêt / Atelier ; jeton global, DESIGN.md §2). **Sur la bande** : le nom et l'accroche reposent sur le **voile** (`auth-band-scrim`, 60 %) et sur le halo de texte ; le filigrane (.30) ne doit jamais passer sous le texte au point d'en baisser le contraste sous 4,5:1 (modélisé ≥ 4,9:1 ; **à confirmer sur capture** à 320 px, §11). Marge nulle connue : erreur en Atelier Cuivré à 4,51:1 (§11).
- **Reflow et taille de texte** : 320 px de large sans défilement horizontal ni perte de contenu (équivalent WCAG 1.4.10) ; l'accroche et le libellé du bouton principal passent à la ligne ; **hauteurs en `min-height`** (bande, bouton principal), `overflow: hidden` limité au calque de décor ; **aucun libellé ne chevauche le bouton œil** (consigne de règle en `mat-hint`). Recette : 320 px avec « Continuer vers la réinitialisation du mot de passe », puis avec le jeu d'espacement de texte de 1.4.12.

## 8. Key Flows

`[ASSUMPTION]` L'utilisateur n'a pas narré de parcours ; celui-ci est dérivé de FR-40 (« parcours d'invitation »), de la spec 34.3 et des écrans de référence ; le protagoniste est nommé par la facilitation.

**Inès, invitée par Kaien (MJ) à la partie « Le Convoi du Nord », reçoit un lien sur son téléphone.** Elle n'a jamais utilisé l'application. Aucun thème n'est mémorisé sur son téléphone.

1. Kaien lui envoie le lien d'invitation par message. Inès l'ouvre sur son téléphone (375 px).
2. Le thème est **tiré avant le premier affichage** (§10) : Forêt Ancienne. La page « Rejoindre » s'affiche : lucioles et halos dans la bande, feuille lumineuse en filigrane, le logo d20 coché, « Dés Dispos » en grand, et dessous « Un feu de camp, des amis, et une date qui arrange tout le monde ».
3. **Climax :** avant d'avoir lu la carte, Inès sait qu'il s'agit d'un jeu de rôle et qu'on y cale une date entre amis — sans connaître l'application ni son nom.
4. La carte dit « Rejoindre « Le Convoi du Nord » », « Ryuutama », « Connecte-toi ou crée un compte pour rejoindre cette partie. » Elle touche « Créer un compte » (pleine largeur, 48 px, au pouce).
5. `/register?token=…` : même bande, **même thème** (pas de nouveau tirage pendant la visite). Elle renseigne Email, Pseudo et Mot de passe (aide « 8+ caractères » sous le champ) ; elle touche l'œil pour vérifier sa saisie sur le petit clavier, puis le re-masque, et touche « Créer le compte ».
6. Son compte est créé, elle est connectée et arrive dans l'application (comportement existant, inchangé ; thème de son compte, hors périmètre).

*Variantes et échecs :* **champ invalide à l'envoi** — Inès saisit un pseudo de 2 caractères et touche « Créer le compte » : tous les champs invalides montrent leur message (ici « 3 caractères minimum. », habillé par le thème), le focus passe au pseudo, rien n'est envoyé, ses saisies restent ; **lien expiré** — « Lien expiré. » sous le titre, aucune action : Inès redemande un lien à Kaien (hors application) ; **lien introuvable** — « Ce lien d'invitation n'existe pas. » ; **elle a déjà un compte** — « J'ai déjà un compte » mène à « Connexion » (même bande, même thème) ; **service indisponible à la connexion** — « Le carnet est indisponible pour le moment. Réessaie dans quelques instants. » (`role="alert"`, saisies conservées) ; **« réduire les animations » activé** — la bande reste complète, immobile, sans comète ; **la bande distrait** — Inès touche le fond animé : tout se fige sur place, un second toucher relance (aucun bouton).

## 9. Responsive & Platform

Web uniquement, un seul seuil propre à ces écrans : **480 px** (`--bp-mobile` de base).

| Largeur | Comportement |
| --- | --- |
| **320 px** (minimum) – < 480 px | Bande pleine largeur collée en haut, **min-height 196 px** ; carte avec gouttière de 16 px ; filigrane qui déborde (le voile garantit le contraste) ; aucun texte tronqué, aucun libellé superposé à une icône. |
| **≥ 480 px** (bureau 1280 px à la maquette) | Colonne centrée de **448 px** : bande à coins arrondis et carte dans la même colonne. |

La gouttière de 16 px et la colonne de 448 px sont validées sur les écrans de référence (375, 320, 1280 px). Pas de mise en page propre aux tablettes ni au paysage. Le clavier virtuel est géré par le défilement de la page (la bande n'est pas épinglée). Le seuil desktop unique du projet (1024 px) ne s'applique pas à ces écrans.

## 10. Règle de choix du thème

Section propre à ce delta. Les trois thèmes s'appliquent à ces écrans comme ailleurs ; **aucun sélecteur** n'y est proposé.

| Information connue sur l'appareil | Thème appliqué |
| --- | --- |
| Aucune (ni thème choisi, ni compte ouvert) | **Tirage aléatoire parmi les 3, à chaque visite, non mémorisé** |
| Un thème est connu (choisi dans le profil, ou posé à la connexion par le compte ; stockage local `jdr-theme`) | **Le dernier thème connu** |

- **Non mémorisé** : le thème tiré **n'est jamais écrit** dans le stockage local — sinon la visite suivante le prendrait pour un thème « connu » et le tirage cesserait.
- **Pas de clignotement** : la classe de thème est posée sur `<body>` **avant le premier affichage**, tirage compris. Aucun passage par un autre thème (spec 34.3).
- **Une seule source de vérité** : la classe de thème, l'emblème, la scène, l'accroche et les messages (§3) viennent du **même** thème ; la classe posée avant le démarrage et le thème actif de `ThemeToneService` ne doivent jamais diverger (sinon l'écran serait d'un thème et ses textes d'un autre).
- `[ASSUMPTION]` Le tirage est équiprobable, fait **une fois par chargement de l'application** ; la navigation interne entre écrans d'authentification (ex. rejoindre → inscription) garde le thème ; un rechargement est une nouvelle visite.
- `[ASSUMPTION]` Une valeur mémorisée illisible ou inconnue compte comme « aucune information » : tirage.
- La liste des thèmes reste **déclarée une seule fois** dans `@master-jdr/shared` ; aucune clé de thème codée en dur dans les écrans (épic 34, épic 35 : renommage `medieval-steampunk` → `atelier-cuivre`).
- Après connexion, le thème du compte prend le relais (épic 28, story 28.4).

## 11. Open Items

**(a) Conflits avec la spec 34.3 à répercuter à la reprise du build** — la spec garde ses cinq invariants (feuille unique, action principale distinguée, rendu mobile sans troncature, thème sans clignotement, aucun changement fonctionnel) ; ce sont des lignes secondaires, décidées par l'utilisateur après la rédaction de la spec, qui sont levées. À ajouter à `context:` de la spec et à amender :
- `[NOTE FOR UX]` **Thème par défaut fixe `grimoire-emeraude`** et **script « agnostique de la liste des thèmes »** (spec, Always et lignes de la matrice « Aucun thème mémorisé » / « Valeur invalide ») → **tirage aléatoire parmi les 3** quand rien n'est mémorisé (§10). Tirer exige de connaître la liste ou de déléguer à `ThemeToneService` ; la liste `THEMES` reste déclarée une seule fois dans `@master-jdr/shared` ; le mécanisme (script en ligne, ou autre) est à trancher à l'implémentation.
- `[NOTE FOR UX]` **« Aucune police ni image nouvelle », « aucune animation nouvelle », mot-symbole texte seul** (spec, Never et Always) → **levés** : logo, emblèmes et scène animée en **SVG inline** (aucune dépendance, aucun raster, polices système).
- `[NOTE FOR UX]` **Ligne d'orientation** : déjà dans la spec ; confirmée (sous les actions secondaires de la connexion, clé `auth.login_invite_only`).
- `[NOTE FOR UX]` **Bandeau de l'application** : la spec 34.3 interdit d'y toucher ; la décision « marque après connexion » est donc hors périmètre (b).
- `[NOTE FOR UX]` **« Aucun texte nouveau hors décisions »** (spec, Never) → **levé** pour : **messages de validation de champ** (4 clés de ton × 3 thèmes, §3), **aide « 8+ caractères »** (sortie du libellé), **titres de page par écran** (§2), accroches et ligne d'orientation. « Aucun changement fonctionnel » est **assoupli** : un envoi invalide n'est plus muet (messages, `markAllAsTouched`, focus sur le premier champ invalide) ; les **règles** de validation, les champs, les routes et les appels API restent inchangés.
- `[NOTE FOR UX]` **Jeton de bordure global** : `--mat-sys-outline` corrigé dans les trois thèmes **dans `styles.scss`, pour toute l'application** (DESIGN.md §2) — la spec 34.3 ne touche que les écrans d'authentification ; **contrôle visuel de non-régression sur l'application entière** (tous les formulaires et composants qui utilisent le jeton) à prévoir.
- `[NOTE FOR UX]` **Titre par écran** : au lieu du titre fixe (b) ; touche `app.routes.ts` (propriété `title` par route), une `TitleStrategy` et `LiveAnnouncer` (annonce au changement d'écran) en plus d'`index.html`.
- `[NOTE FOR UX]` **`<html lang="fr">`** (`index.html`, déjà dans la liste de la spec) et **structure `h1` / `<main>`** dans les gabarits des six écrans et de « rejoindre » : attributs et balises, sans changement de texte.
- `[NOTE FOR UX]` **Rôles d'annonce** : `role="alert"` (erreurs après action) et `role="status"` (réussites, « Chargement… », conteneur persistant) sur tous les écrans d'authentification et « rejoindre ».
- `[NOTE FOR UX]` **Animation en pause au clic** : la spec ne prévoyait aucune interaction sur la bande ; comportement nouveau (clic / toucher sur la scène : gel sur place, état non mémorisé), écarts WCAG 2.2.2 et 2.1.1 consignés (j).

**(b)** `[NOTE FOR UX]` **Marque après connexion hors périmètre de la 34.3** (barre d'outils bureau, bandeau mobile, favicon, titre d'onglet) → spec amendée ou story dédiée. Nuance : la spec 34.3 touche déjà `index.html` et prévoit « titre d'onglet selon la passe UX » ; favicon et titre peuvent s'y rattacher sans coût ; le reste (shell) non. **Le titre fixe est abandonné** pour les écrans d'authentification : titre par écran « Dés Dispos – <page> » (§2, §7) ; « Dés Dispos » reste le repli d'`index.html` et le titre de l'application après connexion tant que le shell n'est pas traité.

**(c)** `[NOTE FOR UX]` **Nom « Dés Dispos »** : contrôle de marque (INPI / EUIPO) et de noms de domaine **à faire chez un registraire** — la lecture DNS (2026-10-05) n'a trouvé aucun enregistrement sur `desdispos.fr` / `.com` / `.app` et variantes (`des-dispos.fr`, `dedispo.fr` / `.com` / `.app`), mais cela ne vaut ni contrôle de marque ni disponibilité. Le dépôt et le README s'appellent encore **master-jdr** (compromis possible : nom d'affichage « Dés Dispos », identifiant technique / domaine `desdispos`). La graphie en un mot « Dedispo » a été écartée : le jeu de mots disparaît et le préfixe « de- » se lit comme une négation. Collisions relevées à l'écart (autre univers) : La Veillée, Roll Call, Party Up, Gather Round, On joue ?, Séance Tenante.

**(d)** `[NOTE FOR UX]` **Texte du logo** : conversion en tracés avec la police finale pour tout usage figé ; SVG `currentColor` **inliné** dans l'application (une `<img>` rend noir).

**(e)** `[NOTE FOR UX]` **Maquettes non rendues** (construits à partir du spine seul) : inscription, mot de passe oublié, réinitialisation, confirmation / annulation d'e-mail, états « lien introuvable », « chargement » et « déjà connecté » de Rejoindre. Décision de l'utilisateur : se déduisent de la même mise en page.

**(f)** `[NOTE FOR UX]` **Réduction des animations** vérifiée seulement à la lecture du CSS de la planche (`animation: none`), pas en test navigateur ; à vérifier sur capture sous `prefers-reduced-motion: reduce` que rien de lumineux ne chevauche le logo ni le texte (`.fly` à `opacity: 0` ; lucioles et volutes visibles à leur position de départ : DESIGN.md §1). Ne s'applique pas à l'état « en pause », dont l'écart est accepté (j).

**(g)** `[NOTE FOR UX]` **Positionnement** : le PRD parle de JDR multi-systèmes, l'utilisateur décrit « jeux de société, jdr, autre » ; le d20 oriente « jdr » (tempéré par le nom et l'accroche). À aligner dans le PRD.

**(h)** `[NOTE FOR UX]` **Clés de ton à créer, dans les trois thèmes, avec test de parité** : `auth.login_invite_only` (texte clair) ; accroches par thème (`[ASSUMPTION]` `auth.tagline`) ; **messages de validation** : `auth.field_required`, `auth.field_email_invalid`, `auth.field_pseudo_min`, `auth.field_password_min` (§3, libellés neutres de référence, textes thématiques finaux à rédiger, chacun nommant la règle). Les seuils 3 et 8 sont écrits dans les textes **et** dans `Validators.minLength(...)` : source unique à envisager pour éviter la dérive (`[NOTE FOR UX]`).

**Autres points relevés par la rédaction** :
- **Bord de champ sous 3:1 : traité** (jeton global corrigé, DESIGN.md §2) ; reste le **contrôle visuel de non-régression** sur toute l'application. Erreur en Atelier Cuivré à 4,51:1 (marge nulle, i).
- `[NOTE FOR UX]` **Contraste du nom et de l'accroche sur la bande** : modélisé (≥ 4,9:1, pire cas Émeraude 320 px à 5,23:1), **à confirmer sur capture** dans les trois thèmes, à 320 et 375 px, au pic d'animation.
- `[NOTE FOR UX]` **Écarts de valeurs avec la base** : champ 8 px (maquette) vs `{radius.input}` 4 px ; carte et bande 14 px hors échelle (`{radius.card}` 10, `{radius.panel}` 12) ; action principale en pilule vs `{radius.button-cta}` ; textes 13 et 15 px hors échelle ; Georgia sur les trois thèmes. Tous validés sur maquette ; à confirmer à l'implémentation.
- `[NOTE FOR UX]` **Scène** : composition fixe (maquette) ; le générateur de bannières n'est pas réutilisable tel quel (viewBox 320 × 124, bornes de tirage calibrées pour 124 px, graine = identifiant de partie). Choix d'implémentation : SVG inline dédié, ou générateur étendu avec graine constante.
- `[NOTE FOR UX]` **Indicateur de chargement** : aucun spécifié (bouton désactivé seulement, comportement existant).
- `[ASSUMPTION]` Tirage équiprobable, une fois par chargement, valeur illisible = tirage ; marque non thématisée ; bande non épinglée ; bloc-marque non cliquable ; marge verticale de bureau 56 / 72 px ; tailles en rem ; noms de page des six titres autres que « Connexion » et « Rejoindre » ; noms des clés de ton de validation ; focus du bouton œil conservé.
- **Maquettes non promues** : `logos-et-emblemes-1.html` (exploration, pistes A à C et emblèmes E2) et `logo-picto-simplifie.svg` ; la ligne « simplifié » de `logo-g-declinaisons.html` est **caduque** (décision : pas de variante simplifiée).

**(i) Sort des 19 constats de la revue d'accessibilité** ([`review-accessibilite.md`](review-accessibilite.md) : 0 critique, 8 hauts, 5 moyens, 6 bas). Bilan : **13 intégrés, 1 écart accepté, 5 reports**.

| Constat | Sort | Où / pourquoi |
| --- | --- | --- |
| H1 Animation infinie sans pause (2.2.2) | **écart accepté** | Décisions de l'utilisateur : boucle conservée, pause / reprise au clic sur le fond, **gel sur place** (pas de retour au repos), sans bouton ; arrêt à 5 s **non retenu** ; écart 2.2.2 (partiel) **et** 2.1.1 (clavier) ; voir (j) et DESIGN.md §1, EXPERIENCE.md §4, §7 |
| H2 `lang="en"` (3.1.1) | intégré | §7 « Langue » : `<html lang="fr">` |
| H3 Titre de page unique (2.4.2, 4.1.3) | intégré | §2 (colonne titre), §7 « Titre de page » : « Dés Dispos – <page> », `TitleStrategy` + `LiveAnnouncer` ; (b) |
| H4 Aucun titre ni repère (1.3.1, 2.4.1) | intégré | §7 « Structure » : un `h1` par écran, `<header>` frère de `<main>` ; DESIGN.md §7 |
| H5 Validation muette (3.3.1, 3.3.3) | intégré | §3 (règles et 4 clés), §4 « Validation des formulaires », §5 « Champ invalide », §7 |
| H6 Messages d'état sans rôle, focus perdu (4.1.3) | intégré | §5, §7 « Annonces d'état » : `role="alert"` / `role="status"` persistant, focus déplacé ; détail (aucun rôle sur les messages présents au chargement) repris de la revue ; **`role="alert"` retiré de « Lien expiré. »** de Rejoindre par décision de l'utilisateur |
| H7 Bord de champ < 3:1 (1.4.11) | intégré | Jeton `--mat-sys-outline` corrigé **globalement** (DESIGN.md §2) au lieu de la variable locale proposée ; (a) |
| H8 Libellé long × bouton œil (1.4.10) | intégré | §2, §4 : « 8+ caractères » en `mat-hint` ; DESIGN.md §4 |
| M1 Hauteurs fixes (1.4.4, 1.4.12) | intégré | `min-height` bande et bouton principal, `overflow` limité au décor (DESIGN.md §4, §7) ; les tailles en rem restent une `[ASSUMPTION]` |
| M2 `aria-pressed` + libellé changeant (4.1.2) | **report** | Bouton livré en 34.2 (spec et tests) : arbitrage non pris ; un seul des deux à retirer ; (k) |
| M3 Repos non sain (comète figée) | intégré | `.fly { opacity: 0 }` au repos (DESIGN.md §1, frontmatter) ; **état « en pause »** : gel sur place, comète ou luciole pouvant rester sous l'accroche (contraste 1,0 à 3,3:1), écart accepté (j) ; l'effleurement du logo par la jauge en Atelier reste un choix visuel non tranché (k) |
| M4 Contraste forcé (1.4.3, 1.4.11) ❓ | intégré | Spécifié (DESIGN.md §7, EXPERIENCE.md §5, §7) ; **recette manuelle** Windows à faire |
| M5 Focus visible non spécifié (2.4.7) | intégré | Contour 2 px `accent-1`, décalage 2 px, jamais `outline: none` (DESIGN.md §7, EXPERIENCE.md §7) |
| B1 Marge de contraste de l'accroche, Émeraude 320 px | **report** | Pas de changement de design : critère de recette « ≥ 4,5:1 mesuré sur capture à 320 px, trois thèmes, au pic » et filigrane figé sans nouvelle mesure ; option de plafonner l'accroche à 200 px non retenue ; (k) |
| B2 Erreur Atelier à 4,513:1 | **report** | Marge nulle conservée ; garde-fou (pas d'`opacity` sur `auth-error`) ou éclaircissement de l'erreur à ~`#d66f82` à décider ; (k) |
| B3 « Rejoindre » : états, nom sans espaces | intégré | « Chargement… » dans le `role="status"` persistant, `overflow-wrap: anywhere` sur le `h1` (via H3, H4, H6) |
| B4 Erreur de connexion non reliée au champ | **report** | Optionnel : `aria-describedby` du message sur le champ mot de passe non décidé ; l'absence de suggestion sur `auth.login_invalid` reste admise (sécurité, §7) |
| B5 Remplissage automatique sur thème sombre ❓ | **report** | À tester à la recette (texte et fond ≥ 4,5:1 dans les trois thèmes) ; correctif `:-webkit-autofill` seulement si l'essai échoue |
| B6 Logo : nom redondant, `id` SVG | intégré | §7 « Décor » : pictogramme `aria-hidden` + texte HTML (pas `logo-bloc-marque.svg`), `id` du masque uniques |

**(j) Registre des écarts d'accessibilité acceptés et consignés** (un seul écart, deux critères). **Décisions de l'utilisateur** (2026-10-05) :
- **Boucle avec pause au clic, sans bouton** (remplace l'arrêt automatique à 5 s proposé par la revue). Raison donnée : peu d'effort d'accessibilité à ce stade (« on verra plus tard si on devient un vrai site utilisé par plein de monde »).
- **La pause fige l'animation sur place** (`animation-play-state: paused`), état non mémorisé ; ce n'est **pas** un retour à la composition de repos (alternative recommandée par la revue, écartée). **Conséquence assumée** : une comète ou une luciole figée peut rester sous l'accroche (contraste de 1,0 à 3,3:1 mesuré dans ce cas).
- **WCAG 2.2.2** (Pause, arrêt, masquage, niveau A) : **partiellement non satisfait**. La bande tourne en boucle ; la commande est non découvrable et le décor `aria-hidden` ; seul `prefers-reduced-motion` coupe l'animation sans geste.
- **WCAG 2.1.1** (Clavier, niveau A) : **non satisfait pour cette commande** : la pause n'existe qu'au clic / toucher, pas au clavier.

**À revoir si l'application devient publique** : bouton visible, activable au clavier, état conservé, arrêt ou repos sain. Les bannières de partie et le compte à rebours (`party-banner`, `party-countdown`) relèvent de la même règle, hors périmètre ; un réglage « Animations » global dans le profil serait la solution durable (backlog).

**(k) Points restés ouverts** (à trancher à la reprise ; la rédaction a retenu l'option indiquée) :
- `[NOTE FOR UX]` **M2** : retirer `aria-pressed` ou fixer le libellé (impacte spec 34.2 et ses tests) ; B4 (`aria-describedby` sur la connexion) ; B2 (erreur Atelier) ; B1 (accroche plafonnée) ; jauge d'Atelier qui effleure le logo (décaler de 8 px ou accepter).
- `[NOTE FOR UX]` **Pseudo** : la revue propose une aide « 3+ caractères » ; non décidée (le message de validation nomme déjà la règle à l'envoi). **Titre « Rejoindre »** : sans le nom de la partie ; la revue proposait un titre dynamique `Rejoindre « <partie> »`, non retenu. **Noms de page** des six autres titres : propositions de la revue `[ASSUMPTION]`. **Validateur e-mail** : `Validators.email` d'Angular est permissif (accepte `a@b`) ; le message « adresse e-mail invalide » ne promet pas plus que la règle réelle. **`Validators.required`** accepte une saisie d'espaces seuls (inchangé, hors périmètre).
- `[NOTE FOR UX]` **Non-régression visuelle** du jeton `--mat-sys-outline` sur toute l'application : à planifier (story dédiée ou à la recette de la 34.3).
