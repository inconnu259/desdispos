---
title: 'Story 32.1 : Autocomplétion des invitations'
type: 'feature'
created: '2026-09-22'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: 8f1f6e430871476f8fda250944aa1789eaac9ee7
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La recherche d'utilisateurs à inviter dans une partie n'accepte qu'une égalité stricte
sur l'email ou le pseudo, déclenchée manuellement (bouton ou touche Entrée) — le MJ doit connaître
l'orthographe exacte du pseudo et taper une action explicite au lieu d'être guidé au fil de la frappe.

**Approach:** Faire évoluer `GET /users/search` d'une égalité stricte email-ou-pseudo vers une
correspondance partielle sur le **pseudo uniquement**, et câbler la recherche de
`PartieDetail` pour qu'elle se déclenche automatiquement au fil de la frappe (au lieu du seul clic /
Entrée), sous une longueur minimale de saisie de **2 caractères**, un plafond de **10 résultats**, et
un debounce client de **500 ms** (décidés par l'utilisateur, 2026-09-22).

## Boundaries & Constraints

**Always:**
- La recherche par pseudo reste **partielle et insensible à la casse**, jamais sur l'e-mail.
- Aucune adresse e-mail n'apparaît dans la réponse (déjà vrai côté `UserSearchResultDto` — ne pas y
  toucher) ni n'est utilisée comme critère de correspondance.
- En dessous du seuil minimal de longueur, **aucune requête HTTP** n'est émise côté client.
- Le nombre de résultats renvoyés par le serveur est plafonné.
- L'invitation par e-mail exact (`inviteByEmail()`, endpoint dédié) est un chemin totalement séparé et
  reste inchangée.

**Never:**
- Ne jamais réintroduire l'e-mail comme critère de recherche ou champ de résultat.
- Ne pas construire de nouvel endpoint : `GET /users/search` évolue en place.
- Ne pas ajouter de dépendance (ex. `pg_trgm`, lib de debounce) — un `setTimeout` signal-based suffit à
  l'échelle actuelle, cohérent avec le reste du code de `PartieDetail`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Frappe sous le seuil | `q` plus court que le seuil minimal | Aucune requête émise, `results` vidé | N/A |
| Frappe au-dessus du seuil | `q` = préfixe/sous-chaîne d'un pseudo existant | Utilisateurs dont le pseudo contient `q` (insensible casse), MJ et membres déjà présents exclus | N/A |
| Beaucoup de correspondances | `q` correspond à plus d'utilisateurs que le plafond | Résultats tronqués au plafond | N/A |
| Recherche par e-mail | `q` = une adresse e-mail existante | Aucun résultat (l'e-mail n'est plus un critère) | N/A |
| Invitation par e-mail exact | Champ e-mail dédié rempli | Comportement inchangé, chemin indépendant | Inchangé |

</frozen-after-approval>

## Code Map

- `apps/api/src/users/users.service.ts:41` -- `searchByEmailOrPseudo(q)` : `OR [{email},{pseudo}]` exact
  → à remplacer par une correspondance `pseudo` seule, `contains` + `mode: 'insensitive'`, avec
  `take: 10`. Renommer en `searchByPseudo` (le nom actuel mentirait sur le comportement).
- `apps/api/src/users/users.controller.ts:12-16` -- `search()` appelle `searchByEmailOrPseudo` ; mettre
  à jour l'appel + le commentaire doc (« email ou pseudo exact » devient faux).
- `apps/api/src/users/dto/search-users.dto.ts` -- `SearchUsersDto.q` a déjà `@MinLength(1)` ; passer à
  `@MinLength(2)` (validation serveur, indépendante du gate client).
- `apps/api/src/users/users.service.spec.ts:44-52` -- test `searchByEmailOrPseudo` à réécrire pour le
  nouveau comportement (nom de méthode, `where`, `take: 10`).
- `packages/shared/src/index.ts:297-300` -- `UserSearchResultDto { id, pseudo }` : ne change pas (déjà
  sans e-mail, AD-2) — vérifier seulement qu'aucun champ n'est ajouté par erreur.
- `apps/web/src/app/core/parties/parties.service.ts:132-138` -- `searchUsers(q)` : appel HTTP inchangé,
  seul le comportement serveur évolue.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.ts:179-180,620-631` -- signaux
  `search`/`results` et `runSearch()` (aujourd'hui déclenché par `(keyup.enter)` / clic bouton
  seulement) : ajouter un déclenchement automatique, debounced à 500 ms, sur la frappe, avec garde de
  longueur minimale (2 caractères) avant tout appel réseau. Filtrage MJ/membres déjà présents
  (L629-630) inchangé.
- `apps/web/src/app/features/parties/partie-detail/partie-detail.html:273-282` -- input + bouton de
  recherche : conserver bouton et `(keyup.enter)` comme déclenchement manuel de secours en plus de
  l'autocomplétion (aucune perte de fonctionnalité existante, coût nul).
- `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests de `runSearch()`/
  recherche à adapter (déclenchement debounced à couvrir : ne part pas sous le seuil, part après le
  délai).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/users/dto/search-users.dto.ts` -- appliqué `@MinLength(2)` -- fait respecter le
  seuil aussi côté serveur (défense en profondeur, pas seulement le gate client).
- [x] `apps/api/src/users/users.service.ts` -- renommé `searchByEmailOrPseudo` → `searchByPseudo`,
  requête `contains` + `mode: 'insensitive'` sur `pseudo` uniquement, `take: 10` -- cœur du changement
  de comportement de la story.
- [x] `apps/api/src/users/users.controller.ts` -- appel et commentaire doc adaptés -- contrôleur et
  service cohérents.
- [x] `apps/api/src/users/users.service.spec.ts` -- test du service réécrit pour le nouveau nom, le
  nouveau `where` et le `take` -- couverture du comportement serveur.
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.ts` -- déclenchement debounced
  (500 ms) de `runSearch()` sur changement de `search()`, gardé par le seuil minimal (2 caractères) --
  réalise le « au fil de la frappe » de l'AC. Garde de longueur reprise dans `runSearch()` lui-même
  (défense en profondeur, s'applique aussi au bouton/(keyup.enter) manuel de secours).
- [x] `apps/web/src/app/features/parties/partie-detail/partie-detail.spec.ts` -- tests du nouveau
  déclenchement (sous le seuil : pas d'appel ; au-dessus, après le délai : appel ; nouvelle frappe
  réarme le debounce) -- couverture front.

**Acceptance Criteria:**
- Given une saisie atteignant 2 caractères dans le champ d'invitation, when 500 ms s'écoulent sans
  nouvelle frappe, then les utilisateurs dont le pseudo correspond sont proposés automatiquement, sans
  clic.
- Given une saisie d'un seul caractère, when je tape, then aucune requête HTTP n'est émise vers
  `GET /users/search`.
- Given des résultats plus nombreux que 10, when ils sont renvoyés, then leur nombre est tronqué à 10
  côté serveur.
- Given les résultats proposés, when ils sont affichés, then ils ne portent que le pseudo, sans
  adresse e-mail, et une recherche par e-mail exact ne renvoie plus aucun résultat par ce chemin.
- Given l'invitation par e-mail exact, when elle est utilisée, then son comportement est strictement
  inchangé.

## Implementation Notes

- Garde de longueur minimale (2) posée à la fois dans l'`effect()` de debounce (feedback immédiat :
  `results` vidé sans programmer de requête) et dans `runSearch()` lui-même (défense en profondeur,
  couvre aussi le bouton/(keyup.enter) manuel de secours) -- un seul comportement, jamais contournable
  par un des deux chemins de déclenchement.
- Aucun changement dans `partie-detail.html` : bouton et `(keyup.enter)` déjà présents servent tels
  quels de déclenchement manuel de secours (conforme au Code Map).
- Minuteur de debounce nettoyé à la destruction du composant (`destroyRef.onDestroy`), même discipline
  que les autres ressources du composant (SSE, etc.).
- Audit de la matrice I/O (step-03) : la ligne « Recherche par e-mail » n'était couverte qu'implicitement
  (le `where` ne référence jamais `email`, quel que soit `q`) — un test explicite avec un `q` au format
  e-mail a été ajouté à `users.service.spec.ts` pour la couvrir littéralement.
- Revue (7 correctifs, tous "patch" ci-dessous) appliqués : (1) `runSearch()` ignore désormais une
  réponse HTTP résolue après que `search()` a changé (`this.search().trim() !== q` avant `results.set`)
  — course de réponses ; (2) `runSearch()` annule `searchDebounceTimer` en tête (couvre aussi le
  déclenchement manuel bouton/`(keyup.enter)`, plus de requête redondante ~500 ms plus tard) ; (3)
  `search-users.dto.spec.ts` créé (patron `create-character.dto.spec.ts`) : `q` d'1 caractère rejeté,
  2 caractères accepté ; (4) test ajouté exerçant `runSearch()` directement (chemin manuel) avec 1
  caractère : aucun appel réseau, `results` vidé ; (5) `searchByPseudo` échappe désormais `\`, `%`, `_`
  dans `q` avant `contains` ; (6) `orderBy: { pseudo: 'asc' }` ajouté pour un top 10 déterministe ; (7)
  `q.trim()` appliqué côté serveur avant le filtre (défense en profondeur). Vérification ciblée
  post-patch : `docker compose exec api pnpm test users.service.spec` → 7/7 ; `search-users.dto.spec`
  → 2/2 ; suite web complète (le filtre positionnel reste cassé, cf. Verification) →
  `partie-detail.spec.ts` 119/119 (3 nouveaux tests : garde manuelle sous seuil, annulation du minuteur
  par un déclenchement manuel, réponse périmée jamais appliquée) ; `tsc --noEmit` propre côté API et web.
- Revue post-patch (step-04, cette session) : diff relu ligne à ligne (regex d'échappement LIKE vérifiée
  à la main sur le cas `100%_off\bob`), les 7 correctifs confirmés corrects. Suites complètes relancées
  sur l'arbre patché : API 1390/1392 (2 échecs pré-existants non liés — `party-signals.service.spec.ts`
  et `parties.service.spec.ts`, dérive de date, aucun fichier de cette story touché), web 2457/2459 (même
  2 échecs pré-existants dans `calendar-view.spec.ts`), `tsc --noEmit` propre API + web.

## Spec Change Log

## Review Triage Log

- **[blind-hunter]** Course de réponses : une réponse HTTP plus ancienne peut résoudre après une plus
  récente et écraser `results` avec des données périmées — `runSearch()` n'a aucune garde comparant
  `q` à la valeur courante de `search()` à la résolution. **Verdict : medium** (vérifié en lisant
  `runSearch()`/l'`effect()` : aucune séquence/jeton n'empêche un écrasement par une réponse plus
  ancienne). → **patch**.
- **[edge-case-hunter]** Même défaut que ci-dessus (course de réponses), racine partagée. **Verdict :
  medium** → fusionné avec l'entrée précédente, **patch**.
- **[blind-hunter]** Le minuteur de debounce n'est jamais annulé par un déclenchement manuel
  (bouton/`(keyup.enter)`) : celui-ci appelle `runSearch()` directement sans passer par l'`effect()`
  qui gère le minuteur — une requête programmée redondante part donc ~500 ms plus tard. **Verdict :
  low** (vérifié : requête dupliquée mais inoffensive en lecture seule, sans corruption visible seule
  — aggrave seulement la course ci-dessus). → **patch**.
- **[verification-gap, other findings]** Même défaut (minuteur non annulé par le déclenchement
  manuel). **Verdict : low** → fusionné avec l'entrée précédente, **patch**.
- **[verification-gap]** `SearchUsersDto.q` : `@MinLength(1)`→`@MinLength(2)` n'est vérifié nulle
  part au niveau DTO/`ValidationPipe` — aucun `search-users.dto.spec.ts` (convention pourtant établie
  dans ce dépôt pour les DTO validés), aucun test e2e sur `/users/search`. Une régression du seuil
  passerait toute la suite sans échec. **Verdict : medium** (finding pré-vérifié par la couche
  verification-gap — preuve détaillée acceptée telle quelle). → **patch**.
- **[verification-gap]** La garde de longueur minimale de `runSearch()` lui-même (chemin manuel
  bouton/`(keyup.enter)`) n'est exercée par aucun test — les nouveaux tests n'atteignent `runSearch()`
  que via l'`effect()` de debounce, qui filtre déjà les saisies courtes avant de le programmer.
  **Verdict : medium** (pré-vérifié). → **patch**.
- **[edge-case-hunter]** `searchByPseudo` ne échappe pas les métacaractères LIKE (`%`, `_`) dans `q`
  avant de construire le filtre `contains`. **Verdict : low** (confirmé via la doc Prisma à jour,
  Context7 : `contains`/`startsWith` sur PostgreSQL compilent en `LIKE`/`ILIKE` et Prisma n'échappe
  jamais `%`/`_` lui-même — à la charge de l'appelant). → **patch**.
- **[blind-hunter]** `searchByPseudo` n'a pas de `orderBy` : le `take: 10` tronque un ordre non
  garanti déterministe (recherches identiques pouvant renvoyer un sous-ensemble différent).
  **Verdict : low** (réel mais mineur, correction directe triviale). → **patch**.
- **[blind-hunter]** `searchByPseudo` ne trim pas `q` côté serveur : un appelant API direct (hors
  client Angular, qui trim déjà dans `runSearch()`) envoyant `" a"` passerait `@MinLength(2)` mais ne
  matcherait la sous-chaîne littérale `" a"`, résultat vide inattendu. **Verdict : low** (réel,
  n'affecte que des appelants API hors client web actuel ; correction directe triviale). → **patch**.
- **[edge-case-hunter]** Membres/MJ exclus côté client *après* le `take: 10` serveur : si les
  correspondances de pseudo les plus proches sont en majorité déjà MJ/membres, des invitables
  éligibles au-delà du top 10 brut restent invisibles. **Verdict : low** — réel en théorie, mais peu
  probable en usage quotidien (petits groupes d'amis, recoupement de pseudos rare) et la correction
  demanderait une nouvelle surface publique (paramètre d'exclusion sur l'endpoint global
  `GET /users/search`, ou endpoint dédié) — plus qu'une correction directe. **Rejeté** (peu probable
  en usage courant + correction non triviale ; contournement existant : invitation par e-mail exact
  inchangée).
- **[edge-case-hunter]** `results.set()` pourrait s'exécuter après destruction du composant si la
  requête HTTP résout après un `ngOnDestroy`. **Verdict : false** — une écriture de signal Angular
  après destruction du composant est un no-op inerte (aucun re-rendu, aucune erreur, le gabarit
  détruit ne consomme plus le signal) ; comportement préexistant à cette story, non provoqué par elle,
  et sans conséquence observable.
- **[blind-hunter]** Élargir la correspondance à `contains`/insensible à la casse augmenterait la
  surface d'énumération des pseudos sans ajout de limitation de débit. **Verdict : false** —
  `GET /users/search` est déjà derrière `AuthenticatedGuard` (authentification requise) et le
  `ThrottlerGuard` global (`app.module.ts`, 300 req/min/IP) s'applique à cette route comme à tout le
  reste de l'API ; aucune exemption (`@SkipThrottle`) n'est posée sur `UsersController`.
- **[blind-hunter]** L'ancien docstring citait « spec §4 » ; `docs/spec.md` ne serait plus à jour avec
  le nouveau comportement (pseudo seul, partiel). **Verdict : false** — `docs/spec.md` §4
  (« Fonctionnalités ») est un aperçu produit de haut niveau qui ne spécifie aucune sémantique exacte
  de correspondance de recherche ; aucune contradiction n'existe, et le nouveau docstring remplace déjà
  la référence vague par une citation directe à la Story 32.1.

## Verification

**Commands:**
- `docker compose exec api pnpm test users.service.spec` -- PASS (4/4, dont le test réécrit
  `searchByPseudo`).
- `docker compose exec web pnpm test` (le filtre positionnel `partie-detail` fait échouer le builder
  `@angular/build:unit-test` avec `Unknown argument: watch` -- pré-existant, indépendant de cette
  story ; suite complète lancée à la place) -- `partie-detail.spec.ts` : PASS (116/116, dont les 3
  nouveaux tests du debounce/seuil). 2 échecs pré-existants et sans rapport
  (`calendar-view.spec.ts`, dates de rail) ailleurs dans la suite web, non touchés par cette story.
- `docker compose exec api pnpm test` -- 1385/1387 passent. 2 échecs pré-existants et sans rapport à
  cette story (dépendants de la date du jour, aucun import de `users.service.ts` ni du module
  `users`) : `parties/party-signals.service.spec.ts` (signal `PROCHAINE_SEANCE_CONNUE`) et
  `parties/parties.service.spec.ts` (`getAvailableSlots` -- statut `UNAVAILABLE` vs `UNKNOWN`).
  Aucune régression sur les autres consommateurs de `users.service.ts`.
