---
title: "Messages d'erreur véridiques à la connexion"
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'dd50fa81655c2725d970fd29325a641c4d742c6e'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-34-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La page de connexion répond « Identifiants invalides. » à *tout* échec (`login.ts` : un `catch` sans test de la cause) : serveur injoignable, limite de tentatives, compte à réinitialiser, erreur du serveur. L'utilisateur retape en vain son mot de passe alors que l'application est en cause.

**Approach:** Classer l'échec de `AuthService.login()` d'après l'`HttpErrorResponse` (statut et corps) en cinq cas distincts, et afficher pour chacun un message honnête, sans détail technique, lu dans le registre thématique. Front pur : aucun changement d'API, aucun autre écran.

## Boundaries & Constraints

**Always:**
- **Classification** dans `features/auth/login/login.ts` :
  - `401` dont le corps ne porte **pas** de message personnalisé (message par défaut `Unauthorized`) → identifiants invalides, **un seul message** (jamais de distinction « compte inexistant » / « mot de passe incorrect » : la connexion accepte e-mail ou pseudo) ;
  - `401` dont le corps porte un message personnalisé (aujourd'hui le seul cas : compte à réinitialisation imposée, story 28.6) → message dédié qui renvoie vers « Mot de passe oublié ? » ; ce cas n'apparaît qu'avec le bon mot de passe, il ne révèle rien à un tiers ;
  - `429` → trop de tentatives, message dédié qui demande d'attendre une minute ;
  - statut `0`, `502`, `503`, `504` → service indisponible, message qui **ne dit jamais** que les identifiants sont faux ;
  - tout autre échec (autres `5xx`, autres `4xx`, erreur non HTTP) → message honnête sur ce que l'application sait (« une erreur est survenue, réessayez »), sans cause inventée.
- **Textes dans le registre thématique** : cinq clés `auth.login_invalid`, `auth.login_reset_required`, `auth.login_throttled`, `auth.login_unavailable`, `auth.login_unexpected` dans `TONE_MAP`, **dans les trois thèmes**, lues par `ThemeToneService.tone()` (le thème local est connu avant la connexion). Même thématisé, chaque texte **nomme sa cause par un mot clair** : « invalide » (identifiants), « réinitialis » (compte), « tentatives » (limite), « indisponible » (service), « erreur » (inattendu) ; aucun ne contient « identifiant » ou « mot de passe incorrect » sauf le premier.
- Le message n'expose jamais `err.message`, le code de statut ni le corps renvoyé par le serveur.
- Après un échec, l'identifiant et le mot de passe **restent saisis** (le formulaire n'est pas vidé) ; le message précédent est effacé à chaque nouvelle tentative ; un seul message à la fois ; `loading` revient à `false` dans tous les cas. Le message est annoncé (`role="alert"`). Succès inchangé.
- Commentaires en français (dérogation du dépôt) ; test de parité des clés dans `theme-tone.service.spec.ts`, comme les stories précédentes.

**Never:**
- Aucun changement côté API (`apps/api`), aucun intercepteur ni service global d'erreurs, aucune nouvelle dépendance.
- Ne pas toucher aux autres écrans d'authentification ni au lien « Créer un compte » (stories 34.2 et 34.3), ni aux textes d'autres écrans.
- Ne pas distinguer un compte inexistant d'un mot de passe incorrect ; ne pas coder de clé de thème en dur ; ne pas fixer le texte en dur dans `login.ts`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Identifiants invalides | `401`, corps `Unauthorized` | `auth.login_invalid`, formulaire conservé | N/A |
| Compte à réinitialiser | `401`, corps avec message personnalisé | `auth.login_reset_required` (renvoie vers « Mot de passe oublié ? ») | N/A |
| Limite de tentatives | `429` | `auth.login_throttled` | N/A |
| Serveur injoignable | statut `0` (réseau, API arrêtée) | `auth.login_unavailable`, sans mention des identifiants | N/A |
| Passerelle en échec | `502`, `503` ou `504` | `auth.login_unavailable` | N/A |
| Erreur inattendue | `500`, autre `5xx`/`4xx`, ou erreur non HTTP | `auth.login_unexpected`, aucun détail technique | N/A |
| Échec puis succès | une erreur affichée, nouvelle tentative réussie | le message disparaît, navigation vers `/` | N/A |
| Tentative suivante | une erreur affichée, nouvelle soumission | message précédent effacé avant l'appel | N/A |
| Thèmes | chacun des trois thèmes | les cinq clés existent, non vides, et portent leur mot-cause | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/features/auth/login/login.ts` -- `submit()` : le `catch` sans paramètre pose `'Identifiants invalides.'` quelle que soit la cause ; `error`/`loading` sont des signaux. Seul fichier de logique à changer ; injecter `ThemeToneService`.
- `apps/web/src/app/features/auth/login/login.html` -- `<p class="error">` à rendre annoncé (`role="alert"`) ; le lien « Créer un compte » reste (34.2).
- `apps/web/src/app/core/theme/tones.ts` -- `TONE_MAP` : trois blocs (`grimoire-emeraude` L16, `foret-ancienne` L452, `medieval-steampunk` L874) ; patron des clés d'erreur : `account.password_wrong_current` (L371, 797, 1215), `account.email_change_error`. Ajouter les cinq clés `auth.login_*` dans chacun.
- `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- patron de parité « les clés de la story X existent dans les TROIS thèmes » (L181-310, avec `toBeTruthy()` et `toContain(token)`).
- `apps/web/src/app/core/auth/auth.service.ts` L49 -- `login()` : `firstValueFrom(http.post…)`, laisse remonter l'`HttpErrorResponse` ; **inchangé**.
- `apps/api/src/auth/local.strategy.ts` L18-31 -- `401` sans message (identifiants) et `401` avec message (compte à réinitialiser) ; `apps/api/src/auth/auth.controller.ts` L22 -- limite de 5 tentatives par minute ; **lecture seule**.
- `apps/web/src/app/features/account/account.ts` L287 et L335-342 -- patron existant : test d'`HttpErrorResponse` par statut, un message de ton par cas ; `account.spec.ts` -- patron de spec de composant (`HttpErrorResponse`, mock d'`AuthService`, `vi`). **Aucun `login.spec.ts` n'existe** : à créer.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/core/theme/tones.ts` -- cinq clés `auth.login_*` dans les trois thèmes -- registre thématique honnête
- [x] `apps/web/src/app/features/auth/login/login.ts` -- classer l'échec (cinq cas) et poser le texte de ton correspondant -- message véridique
- [x] `apps/web/src/app/features/auth/login/login.html` -- `role="alert"` sur le message d'erreur -- annonce aux technologies d'assistance
- [x] `apps/web/src/app/features/auth/login/login.spec.ts` -- nouveau : une ligne de test par ligne de la matrice, plus formulaire conservé et message effacé -- couvre la matrice
- [x] `apps/web/src/app/core/theme/theme-tone.service.spec.ts` -- parité des cinq clés dans les trois thèmes et mot-cause présent dans chacune -- registre honnête

**Acceptance Criteria:**
- Given des identifiants incorrects, when je valide, then le message dit que mes identifiants sont invalides.
- Given l'API injoignable, when je tente de me connecter, then le message dit que le service est indisponible et ne prétend pas que mes identifiants sont faux.
- Given une erreur inattendue du serveur, when elle survient, then le message reste honnête et n'expose aucun détail technique.

## Implementation Notes

- **Vérifié par le chef de build** (diff relu en entier depuis `dd50fa8`, 5 fichiers de code) : web 2869 tests passés (état final après la revue) / 2 échecs connus et datés (`calendar-view.spec`, hors story) ; `ng build` OK ; aucune erreur de lint sur les lignes ajoutées (105 erreurs `prettier` préexistantes ailleurs). Aucune modification d'API, de dépendance ni de `package.json`.
- **Matrice** : chaque ligne a un test dédié dans `login.spec.ts` (401 par défaut, 401 personnalisé, 429, statut 0, 502/503/504 séparément, 500/501/400/erreur non HTTP, échec puis succès, message effacé avant l'appel, formulaire conservé, aucune fuite de message/statut/corps) et la parité des cinq clés dans les trois thèmes, avec mot-cause, est testée dans `theme-tone.service.spec.ts`.
- **Revue du 2026-10-04** : 14 constats triés (voir le journal), un correctif appliqué puis revérifié — un `401` au corps texte (page d'un proxy) n'est plus lu comme « compte à réinitialiser » : seul un corps objet à message texte non vide, différent de `Unauthorized`, l'est, avec six cas de test de plus. Un report dans `deferred-work.md` (contrat des réponses de `/auth/login` à épingler côté API, interdit par la spec figée).
- **Textes des trois thèmes** : rédigés à l'implémentation (le thème forêt tutoie, les deux autres vouvoient, comme leurs messages `account.*`) ; l'épic 35 (revue éditoriale) pourra les relire.
- **Non fait** : le contrôle manuel de la section Verification (arrêter l'API, relire les cinq messages dans chaque thème à l'écran).

## Spec Change Log

## Review Triage Log

Revue du 2026-10-04, première passe (Blind Hunter, Edge Case Hunter, Verification Gap). Constats dédoublonnés par cause ; B = blind, E = edge, V = verification-gap.

- **[B][E] Un `401` au corps chaîne (page HTML d'un proxy ou d'un WAF) est lu comme « compte à réinitialiser »** — `medium`, patch : `hasCustomMessage` accepte tout texte non vide autre que `Unauthorized` ; Angular ne rend une chaîne que pour un corps non JSON, donc d'origine infrastructure, et le message affiché (« réinitialisez ») serait faux. Correction : n'accepter qu'un corps objet dont `message` est une chaîne.
- **[E] Comparaison avec `Unauthorized` sensible à la casse et aux espaces** — `low`, patch : même fonction, corrigée avec la ligne ci-dessus ; Nest émet bien `Unauthorized`, mais la correction est triviale et sans surface publique.
- **[B][E] La classification n'est testée que sur deux formes de `401`** — `low`, patch : les cas de corps (nul, chaîne, HTML, message blanc, tableau, casse) accompagnent la correction.
- **[V] Le contrat des réponses de `/auth/login` (corps du `401` par défaut, `401` de réinitialisation, `429` au sixième essai) n'est épinglé par aucun test d'API** — `medium`, defer : la spec figée interdit tout changement sous `apps/api`, tests compris ; la dérive d'un message côté serveur ferait afficher la mauvaise cause sans test rouge. Consigné dans `deferred-work.md`.
- **[B] La cause « réinitialisation » repose sur le fait qu'il n'existe qu'un `401` personnalisé aujourd'hui ; le lien « Mot de passe oublié ? » cité existe-t-il ?** — `false` pour le lien (présent dans `login.html`, section des actions de la carte) ; le couplage au `401` unique est le choix A de l'utilisateur (aucun changement d'API), documenté dans le code.
- **[B] Les tests moquent `AuthService.login` (aucun test via le vrai service)** — `low`, rejeté : `AuthService.login()` est un `firstValueFrom(http.post…)` qui relaie l'`HttpErrorResponse` d'origine (code relu) ; aucun intercepteur ne réécrit l'erreur.
- **[B] « Une minute » figé dans le message de limite ; le statut `0` (hors-ligne, CORS) est présenté comme « service indisponible »** — `low`, rejeté : décisions de l'utilisateur à la spec (message de limite dédié, statut `0` dans « indisponible ») ; la corriger éditerait l'intention figée.
- **[B][E] Message stocké comme chaîne résolue (reste dans l'ancien thème si le thème change)** — `low`, rejeté : la page de connexion n'offre aucune bascule de thème.
- **[E] Clé de ton absente du thème actif (`undefined`, alerte masquée)** — `low`, rejeté : la parité des cinq clés dans les trois thèmes est testée ; un repli ajouterait du code pour un état que ce test interdit.
- **[E] Double soumission pendant `loading` (Entrée dans le formulaire)** — `low`, rejeté : préexistant, et la soumission implicite est bloquée par le navigateur quand le bouton par défaut est désactivé.
- **[E] `auth.login()` qui échoue après un `POST` réussi (ex. synchronisation du thème) affiche « erreur inattendue »** — `low`, rejeté : `syncTheme` absorbe ses propres erreurs ; auparavant ce cas affichait « Identifiants invalides ».
- **[E] Statuts voisins (403, 408, 499) non testés** — `low`, rejeté : un seul chemin par défaut les couvre, déjà testé par 400, 500, 501 et l'erreur non HTTP.
- **[B] Accessibilité (focus, `aria-describedby`, `aria-invalid`, `aria-busy`) ; test de parité qui ne contrôle que des mots-clés ; `as any`, clé `jdr-theme` et assertion « 500 » dans les tests** — `low`, rejeté : hors de l'intention (`role="alert"` est ce que la spec demande ; la mise en forme des écrans relève de la 34.3), parité définie par la spec, motifs de test identiques à ceux des specs voisines.
- **[B] D'autres écrans d'authentification ou le changement d'e-mail portent des messages codés en dur** — `low`, rejeté : hors périmètre (Never : autres écrans, textes d'autres écrans), relus par les stories 34.2/34.3 et l'épic 35.

## Verification

**Commands:**
- `docker compose exec web pnpm exec ng test web --watch=false --include "src/app/features/auth/**/*.spec.ts" --include "src/app/core/theme/*.spec.ts"` -- expected: tous les tests passent
- `docker compose exec web pnpm test` -- expected: aucune régression hors échecs préexistants connus (`calendar-view.spec`, dates figées)
- `docker compose exec web pnpm build` -- expected: compilation sans erreur (la CI ne construit pas le front)
- `docker compose exec web pnpm lint` -- expected: aucune erreur nouvelle sur les lignes modifiées

**Manual checks (if no CLI):**
- Arrêter le conteneur `api` puis tenter une connexion : « service indisponible », champs conservés. Relancer l'API, saisir un mauvais mot de passe : « identifiants invalides ». Dans chacun des trois thèmes, relire les cinq messages.
