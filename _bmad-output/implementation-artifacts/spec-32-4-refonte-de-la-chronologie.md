---
title: '32.4 — Refonte de la chronologie'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '8e88ae72f77362515486a492d99f9cdc3f9fa50a'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La chronologie ne raconte rien : la ligne est un pseudo-élément décoratif *derrière* les
cartes (aucun nœud ancré), l'ordre vient de `createdAt` et non des dates réelles, un scénario
n'affiche aucune date, ses séances se réduisent à des dates nues sans état, et il n'existe ni
en-tête ni compteur — donc rien qui puisse légitimement différer entre MJ et joueur.

**Approach:** Refondre le **rendu** de `ScenarioTimeline` : nœud ancré sur la ligne par une pastille
teintée de l'état, plage de dates par nœud, séances listées avec le badge partagé de la story 32.3,
en-tête portant un compteur calculé sur les nœuds rendus. Aucune donnée nouvelle, aucun appel
serveur : tout se dérive de `ScenarioDto.seances`, déjà servi.

**Décision arrêtée (2026-09-23) — les deux orientations sont conservées.** La bascule horizontale
(≥768px : défilement interne, molette, glisser-déposer, fondus de bord) / verticale (<768px) de
`ux-jdr-master-20260711/DESIGN.md:53-63` reste en vigueur ; la planche
`ux-jdr-master-2026-08-04/mockups/signaletique-etats.html` §2 fournit le **contenu** du nœud, pas
son orientation. Chaque nœud est réellement ancré sur la ligne, avec un en-tête de nœud à **hauteur
fixe** indépendant de la carte (garantie structurelle contre le désalignement pastille/ligne), et la
colonne desktop s'élargit autant qu'il le faut pour loger les séances.

## Boundaries & Constraints

**Always:**
- Réutiliser `scenarioState()` / `seanceState()` et `<app-status-badge>` (32.3) : aucun libellé
  d'état en dur, aucune clé de registre nouvelle, aucune teinte réimplémentée.
- La pastille de nœud porte la teinte de l'état (`--jdr-status-*`) **et** est toujours doublée du
  badge à libellé. Brouillon = forme (contour tireté), jamais une 5ᵉ teinte.
- Anti-spoil : `buildNodes(scenarios, includeBrouillon)` reste le **seul** point de masquage ; le
  compteur se calcule sur les nœuds rendus, jamais sur la liste brute.
- Date effective d'une séance : même cascade que `SeanceList.resolvedDate()`, pour que chronologie
  et liste de séances ne se contredisent jamais.
- Câblage `ScenariosService.changed()` conservé ; `prefers-reduced-motion` respecté.

**Never:**
- Aucun changement serveur, DTO, migration ou dépendance. Aucun filtrage serveur des `BROUILLON`.
- Ne pas modifier `SeanceList`, `ScenarioList`, `ScenarioStatusBadge`, l'Agenda, ni le patron de
  carte de zone de 32.2 (ses liserés classent la nature du contenu, pas le statut).
- Pas d'écran de séance : activer un nœud ouvre le scénario, comme aujourd'hui. Gestes existants
  (molette, glisser, clavier, ancrage sur le nœud courant) préservés.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nœud daté | `PASSE` 2 dates / 1 date · `COURANT` · `A_VENIR` | « 12 juin — 3 juil. » / date seule · « depuis le 24 juil. » · « à partir du 2 sept. » | N/A |
| Nœud sans date | aucune séance datée | « Non planifié », ordonné sur `createdAt` | Dégradation honnête |
| Plusieurs `COURANT` | épisodique | Un seul nœud empilé, une seule pastille `live` | N/A |
| Séances d'un nœud | chaque séance | « Séance N · \<date\> » + `<app-status-badge>` | « Date à définir » si aucune date |
| Joueur, partie avec brouillon | `isMj=false` | Aucun nœud, aucun espace ; compteur = scénarios publiés | N/A |
| MJ, même partie | `isMj=true` | Nœud brouillon en fin de ligne, contour tireté ; compteur supérieur | N/A |
| Aucun scénario visible | liste vide après masquage | État vide explicite, aucune ligne orpheline | N/A |
| Échec de chargement | erreur HTTP | Message + « Réessayer » | Inchangé |

</frozen-after-approval>

## Code Map

- `.../scenario-timeline/scenario-timeline.ts:47-65` -- `buildNodes()` : masquage anti-spoil (**seul**
  point, à ne pas déplacer) + fusion des `COURANT`. `:215-225` `seanceDateLabel()` oublie la racine
  `dateValidee` — à aligner. `:86-98` signals, `:124-133` effect temps réel, `:137-158`
  ancrage/fondus, `:181-210` ouverture MJ/joueur : à préserver.
- `.../scenario-timeline/scenario-timeline.html:30,60` -- les deux branches rendent
  `<app-scenario-status-badge>` + `<ul class="card-seances">` de dates nues : gabarit à refondre.
  `.scss:13-21,61-76` -- lignes `::before` actuelles, purement décoratives.
- `core/status/status-derivation.ts:67,138` -- `scenarioState(status)`, `seanceState(source,
  viewerId, todayKey)`, pures ; `:46` `StatusBadgeState`. Réutiliser, ne rien redéfinir.
- `shared/status-badge/status-badge.ts:23` -- `<app-status-badge [state]>`, seul input.
- `.../seance-list/seance-list.ts:159,169,181,187` -- patron à reproduire : `todayKey` figé à la
  construction, `seanceBadge()`, `resolvedDate()`, `formatSeanceDate()` (`Intl` fr-FR, UTC).
- `.../scenario-list/scenario-list.html:2-5` -- patron d'en-tête d'onglet (titre + compteur).
- `packages/shared/src/index.ts:348-390` -- `ScenarioDto.seances` embarquées ; `SeanceDto`
  `dateValidee`/`slotValidee` racine, aucun `status`.
- `apps/web/src/styles.scss:55-66,83-86` -- `--jdr-status-*` + invariant de contraste.
- `.../partie-detail/partie-detail.html:470-474` -- unique site d'appel, inputs inchangés.

## Tasks & Acceptance

**Execution:**
- [x] `scenario-timeline.ts` -- clé d'ordre = première date effective du nœud, repli `createdAt` ;
  helpers purs `nodeDateLabel()`, `nodeState()`, `seanceBadge()`, `resolvedDate()`, `visibleCount()` ;
  `todayKey` figé. Ne pas toucher au masquage ni à la fusion des `COURANT`.
- [x] `scenario-timeline.html` -- en-tête (titre + compteur), nœud ancré, plage de dates, séances
  avec badge, état vide.
- [x] `scenario-timeline.scss` -- pastille ancrée sur la ligne (teinte d'état, contour tireté pour un
  brouillon), respiration entre nœuds, imbrication des séances, `prefers-reduced-motion`.
- [x] `scenario-timeline.spec.ts` -- une assertion par ligne de la matrice I/O + non-régression des
  cas couverts (tri, fusion, ouverture, temps réel, erreurs, bascule de largeur).

**Acceptance Criteria:**
- Given la chronologie d'une campagne, when elle s'affiche, then chaque nœud est ancré sur la ligne,
  les dates sont affichées et les scénarios sont espacés de façon lisible.
- Given un scénario de la chronologie, when je le regarde, then son état et ses séances sont
  lisibles sans l'ouvrir.
- Given le MJ d'une partie comportant un brouillon, when il affiche la chronologie, then son
  brouillon y est distinctement marqué et son compteur diffère de celui du joueur.
- Given un changement d'état survenu ailleurs, when le signal temps réel arrive, then la chronologie
  se met à jour sans rechargement manuel.

## Implementation Notes

**Le contenu du nœud est écrit une seule fois, les deux orientations le projettent.** Le gabarit
porte un `<ng-template #nodeBody>` (pastille, plage de dates, cartes, séances) consommé par
`NgTemplateOutlet` dans la branche horizontale comme dans la verticale. Seul le POSITIONNEMENT
diffère, et il vit entièrement dans la feuille de style, chaque mode avec ses propres règles
(`.timeline-desktop .node__head` / `.timeline-mobile .node`) — l'exigence de DESIGN.md §4
(« implémentations distinctes, pas une réorientation CSS d'une même grille ») porte sur la
géométrie, pas sur le texte du nœud, qui ne peut plus diverger entre les deux modes.

**La ligne est dessinée par les nœuds, plus par le conteneur.** L'ancien `::before` unique porté
par `.track` / `.timeline-mobile` ne pouvait pas ancrer quoi que ce soit : en horizontal,
`left:0;right:0` se résout sur la largeur VISIBLE du conteneur de défilement, donc la ligne
s'arrêtait dès qu'on faisait défiler. Chaque `.node__head` porte désormais son propre segment,
débordant d'une demi-gouttière de chaque côté ; bout à bout, les segments forment une ligne
continue qui suit réellement le contenu. En vertical, le segment appartient au nœud et suit donc
exactement sa hauteur réelle, et le dernier nœud arrête la ligne à sa pastille au lieu de la
laisser pendre.

**`prefers-reduced-motion` est respecté des deux côtés.** Le CSS coupe la transition de bordure des
cartes et `scroll-behavior` ; le `scrollIntoView` déclenché depuis le TS (`onNodeFocus`), qui ne
passe par aucune feuille de style, lit la même media query via `scrollBehavior()`. L'ancrage initial
sur le nœud COURANT était déjà en `behavior: 'auto'`, il n'avait rien à couper.

**`AuthService` devient une dépendance du composant.** `seanceState()` dépend du LECTEUR (« Réponds
au vote » vs « Vote en cours ») : sans l'identité du lecteur, la chronologie aurait affiché un état
de séance différent de celui que `SeanceList` montre pour la même séance. Les deux bancs de test du
fichier de specs fournissent désormais un double d'`AuthService` ; `PartieDetail`, seul site
d'appel, en fournit déjà un.

**Ce qui n'a PAS bougé** : `buildNodes()` reste le seul point de masquage anti-spoil, la fusion des
`COURANT` est inchangée, `openDetail()` route toujours comme avant (aucun écran de séance), et les
gestes (molette, glisser, clavier, ancrage sur le nœud courant, fondus) sont intacts. Seul le
dernier `sort()` de `buildNodes()` change de clé. Aucun fichier serveur, DTO ni dépendance touché.

**Écart avec la Code Map** : `seanceDateLabel()` lisait déjà la racine `dateValidee` (corrigé en
32.3) ; il n'y avait rien à aligner, la cascade a simplement été extraite dans `seanceIso()` pour
être partagée avec le calcul des plages et des clés d'ordre.

## Spec Change Log

## Review Triage Log

**Revue du 2026-09-23 — 11 points, tous corrigés.**
- *État de chargement manquant* : `loaded` (signal) passe à `true` au premier `listAll()` tranché ;
  l'en-tête et l'état vide ne se rendent qu'ensuite. Avant, la piste affirmait « 0 scénario » /
  « Aucun scénario pour l'instant. » le temps de la requête, là où elle était muette avant la story.
- *Ordre des nœuds non planifiés* : `nodeOrderKey()` comparait un `createdAt` à une date de séance.
  Remplacé par `compareNodes()` — datés d'abord, non planifiés ensuite, `createdAt` en départage.
- *« Depuis » sur une date à venir* : un nœud `COURANT` dont la première date est postérieure à
  `todayKey` dit maintenant « à partir du ». `nodeDateLabel()` prend `todayKey` en paramètre et
  reste pure ; seule la méthode du composant lui passe le jour courant.
- *Ligne horizontale débordante* : le segment s'arrête sur la première et la dernière pastille
  (`:first-child` / `:last-child`), et disparaît pour un nœud unique (`:only-child`).
- *CSS mort* : `.node__dot--todo` supprimée (`scenarioState()` ne rend `todo` que pour `BROUILLON`,
  routé vers `--draft`) ; `scroll-behavior: auto` du bloc `prefers-reduced-motion` supprimée (aucun
  `scroll-behavior: smooth` n'existe dans `apps/web/src` — seul `scrollBehavior()` agit), commentaire
  rectifié.
- *Creux de pastille* : `transparent` au lieu de `--jdr-bg` (fond de PAGE) — la chronologie est
  rendue sur la surface d'une `mat-card`.
- *Alias morts* : `nodeState` et `resolvedDate` retirés du composant (les fonctions de module
  restent, `nodeDotClass()` utilise `nodeState`).
- *Tests ajoutés* : ordre d'une liste mixte (daté + non planifiés), `COURANT` à date future,
  vote `OPEN` non répondu → « Réponds au vote » / répondu → « Vote en cours » (seule justification
  d'`AuthService`), branche `prefers-reduced-motion` de `scrollBehavior()`, et non-affichage avant
  résolution du premier chargement.

- **[blind + edge-case + verification-gap, 3 couches sur 3]** `nodeOrderKey()` compare une date de
  séance à un `createdAt` : un nœud non planifié créé aujourd'hui se range AVANT tout nœud daté dans
  le futur, alors que le commentaire du code et la Design Note annoncent l'inverse. **Verdict :
  medium** (vérifié par lecture : `createdAtMs(aujourd'hui) < Date(2027).getTime()` ; aucun test ne
  fait cohabiter un nœud daté et un nœud sans date, donc la règle n'est épinglée nulle part). →
  **patch** (tri + test de liste mixte).
- **[blind + edge-case + verification-gap]** Aucun état de chargement : `scenarios` part à `[]`, donc
  le nouvel état vide affirme « Aucun scénario pour l'instant. » et « 0 scénario » entre le montage
  et la résolution de `listAll()`. Avant la story, la piste était muette. **Verdict : medium**
  (régression visible à chaque ouverture de l'onglet, introduite par le nouvel état vide). →
  **patch**.
- **[verification-gap]** L'unique justification documentée de la dépendance `AuthService` (l'état de
  séance dépendant du lecteur) n'est exercée par aucun test : le seul `poll` du fichier est `CLOSED`
  avec `options: []`. Remplacer `currentUserId()` par `undefined` laisse les 58 tests verts.
  **Verdict : medium** (gap réel sur le seul câblage nouveau du composant). → **patch**.
- **[blind + edge-case]** En mode horizontal, `.node__head::before` déborde de `-0.75rem` des deux
  côtés pour TOUS les nœuds : la ligne commence avant la première pastille et se prolonge après le
  dernier nœud, alors que le mode vertical garde explicitement le cas (`:last-child`). **Verdict :
  medium** (le même soin appliqué d'un côté et pas de l'autre, sur un épic dont l'AC dit « aucun
  espace vide, aucun nœud fantôme »). → **patch**.
- **[edge-case]** Un nœud `COURANT` dont toutes les dates effectives sont à venir (scénario ouvert
  avant sa première séance) affiche « depuis le 2 sept. » pour un jour qui n'a pas eu lieu.
  **Verdict : low** mais atteignable en usage courant, et le correctif est une bascule de formule
  déjà présente. → **patch**.
- **[blind]** `.node__dot--todo` est du CSS mort : `scenarioState()` ne rend `todo` que pour
  `BROUILLON`, que `nodeDotClass()` route vers `--draft`. **Verdict : low** (vérifié sur
  `status-derivation.ts:72`), correctif = suppression directe. → **patch**.
- **[blind]** Le bloc `prefers-reduced-motion` pose `scroll-behavior: auto` alors qu'aucun
  `scroll-behavior: smooth` n'existe dans `apps/web/src` (seule occurrence : cette ligne) : règle
  inerte, et le commentaire affirme le contraire. **Verdict : low**, correctif direct. → **patch**.
- **[blind + edge-case]** `protected readonly nodeState` / `resolvedDate` ne sont référencés ni par
  le gabarit ni par le TS. **Verdict : low**, correctif = suppression. → **patch**.
- **[blind]** `.node__dot` / `--soon` remplissent leur creux avec `var(--jdr-bg)` (fond de PAGE)
  alors que la chronologie est rendue sur la surface d'une `mat-card`. **Verdict : low** (écart
  visuel dans les trois thèmes), correctif direct (`transparent`). → **patch**.
- **[verification-gap]** La branche `prefers-reduced-motion` de `scrollBehavior()` n'est exercée par
  aucun test (jsdom répond toujours `matches: false`). **Verdict : low** mais c'est la seule garde
  d'accessibilité du composant qui ne passe pas par le CSS. → **patch**.
- **[blind]** Niveau de titre : la chronologie pose `<h3>` là où `scenario-list` pose `<h2>`.
  **Verdict : false** — `partie-detail.html:50,139,180,379,397,431` utilise `<h3>` pour TOUS ses
  titres de section d'onglet ; c'est `scenario-list` qui est l'exception, pas la chronologie.
- **[blind]** `nodeDateLabel()` n'a ni `default` ni garde d'exhaustivité : un cinquième statut
  renverrait `undefined`. **Verdict : false** — la fonction déclare `: string` et le `switch` couvre
  l'union entière ; ajouter un statut casse la compilation (« lacks ending return statement »), le
  compilateur EST la garde.
- **[edge-case]** Une date ISO malformée ferait lever `Intl.format` et produirait une clé de tri
  `NaN`. **Verdict : false** — aucun chemin producteur n'a été montré : toutes les dates viennent de
  colonnes Prisma `DateTime` sérialisées en ISO UTC.
- **[blind]** Tri et comparaison de dates par chaîne (`.sort()` lexicographique, `substring(0,10)`).
  **Verdict : low — rejeté** : les ISO servis sont normalisés UTC, l'ordre lexicographique y est
  l'ordre chronologique, et tout le dépôt formate déjà en `timeZone:'UTC'`. Le « correctif »
  ajouterait une conversion pour un risque non démontré.
- **[edge-case]** Une plage de nœud qui franchit une année se lit « 12 déc. — 3 janv. » sans
  millésime. **Verdict : low — rejeté** : la planche contractuelle prescrit jour + mois, la plage se
  lit de gauche à droite dans l'ordre chronologique, et le correctif ajoute une branche de formatage.
- **[blind]** Les lignes de séance sont numérotées et affichées dans l'ordre de création, pas de
  date. **Verdict : low — pré-existant** : `SeanceList` numérote exactement pareil sur les mêmes
  données ; trier ici seulement ferait diverger les deux surfaces. → **defer**.
- **[blind]** `seanceIso()` est la quatrième copie de la cascade de date, et `CalendarView` en porte
  deux variantes qui oublient la racine. **Verdict : medium — pré-existant** (la divergence de
  `CalendarView` est antérieure et déjà consignée) ; l'extraction d'un helper partagé dépasse cette
  story. → **defer**.
- **[blind]** La dette `StateRail` annoncée « différée à la 32.4 » par la story 32.3 n'est ni livrée
  ni re-consignée. **Verdict : medium** sur la traçabilité, mais la bande d'état est hors du
  périmètre arrêté (la chronologie utilise une pastille, et 32.2 interdit un liseré concurrent). →
  **defer**.
- **[blind]** `--jdr-text-muted` plafonne à ~4,4:1 en Medieval Steampunk et la story ajoute du petit
  texte dessus. **Verdict : low — pré-existant**, correctif de palette attribué à l'epic 35. →
  **defer**.
- **[blind]** `<ng-template #nodeBody let-node>` sans `ngTemplateContextGuard` : `node` est `any`.
  **Verdict : low — rejeté** : le correctif ajoute une surface statique publique au composant pour
  un gabarit de 30 lignes dont les quatre appels sont tous typés côté TS.
- **[blind]** Le nom accessible de la carte `role="button"` concatène désormais titre, badge et
  toutes les séances. **Verdict : low — rejeté** : le patron `role="button"` sur la carte est
  antérieur à la story, aucun contenu interactif n'est imbriqué, et la verbosité n'est pas un
  obstacle — l'ajout d'un `aria-label` créerait une surface d'accessibilité non prescrite.
- **[blind]** `$line-color` (`--color-border-subtle`) cohabite avec les jetons `--jdr-*`.
  **Verdict : low — rejeté** : le jeton est celui qu'utilisait déjà ce composant, converger
  supposerait de traiter tous ses consommateurs.
- **[verification-gap, Other]** `nodeDates()` est recalculé dans le comparateur de tri puis à chaque
  rendu. **Verdict : low — rejeté** : aucune conséquence fonctionnelle, quelques dizaines de nœuds
  au plus, et mémoïser ajouterait de l'état.
- **[blind]** La note `last_updated` de `sprint-status.yaml` ne relate que l'approbation de la spec.
  **Verdict : low** — bookkeeping d'artefact, traité à la présentation finale, pas un défaut du code.

## Design Notes

**Ordonner par date effective, pas par `createdAt`.** Une chronologie triée sur la date de création
ment dès qu'un MJ crée ses scénarios dans le désordre. Tri par première date effective du nœud ;
les nœuds sans aucune date sont relégués **en bloc après tous les nœuds datés**, et départagés entre
eux par `createdAt`. Comparer un `createdAt` à une date de séance (première version) rangeait un
scénario non planifié créé aujourd'hui AVANT tout ce qui est daté dans le futur — l'inverse de la
fin de ligne annoncée.

**Le compteur est dérivé, jamais compté deux fois.** `visibleCount()` compte les scénarios des nœuds
rendus : l'écart MJ/joueur devient automatique, et aucun chemin ne peut afficher à un joueur un
total incluant un brouillon.

**Les libellés de date ne passent pas par `theme.tone()`** : ils sont factuels. Seuls les libellés
d'état sont thématisés.

## Verification

**Commands:**
- `docker compose exec web pnpm test` -- vert, aucun nouvel échec vs baseline (échecs pré-existants
  connus : fixtures à dates figées échues, cf. `deferred-work.md`).
- `docker compose exec web pnpm build` -- succès ; seule vraie vérification de types du front
  (`tsc --noEmit` ne compile rien, `tsconfig.json` porte `files: []`).
- `docker compose exec web pnpm lint` -- aucun fichier de cette story en erreur.

**Manual checks:**
- Vérification visuelle dans les **trois thèmes** : pastilles distinguables, contour tireté visible
  en niveaux de gris, aucun badge ni compteur de brouillon côté joueur, lisibilité mobile + desktop.

**Résultats (2026-09-23).**
- `docker compose exec web pnpm test` — `scenario-timeline.spec.ts` : **64 tests verts**. Suite
  complète : 2575 verts / 2 rouges, et ces deux-là sont les échecs pré-existants connus
  (`calendar-view.spec.ts:1933,2077`, fixtures à dates figées échues, `deferred-work.md:82-89`).
- `docker compose exec web pnpm build` — **succès** (warnings de budget pré-existants uniquement ;
  `scenario-timeline.scss` reste sous le budget de 4 ko).
- `docker compose exec web pnpm lint` — **aucune erreur sur les fichiers de cette story**. Le
  dépôt porte par ailleurs des erreurs Prettier pré-existantes sur des fichiers non touchés ici
  (`partie-detail.spec.ts`, `partie-form.*`, `visibility-locks.*`, `scenario-list.spec.ts`).
- Vérification visuelle dans les trois thèmes : **non faite** (revue humaine, cf. ci-dessus).
