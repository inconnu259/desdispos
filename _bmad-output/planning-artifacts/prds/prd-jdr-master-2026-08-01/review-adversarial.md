---
title: "Revue adversariale — PRD Palier 9"
targets: ["prd.md", "addendum.md"]
reviewed: 2026-08-03
method: Cynical Review (bmad-review-adversarial-general)
---

# Revue adversariale — PRD Palier 9 « Refonte UI & lisibilité de l'état »

## Verdict

**À réviser avant découpe en epics.** Le cadrage (§2), les principes (§3) et la discipline
serveur affichée (§5, P-5) sont sains et bien calibrés pour un projet hobby — ce n'est pas là
qu'est le problème. Le problème est que **le §5 est faux** : au moins quatre exigences
nécessitent du serveur sans figurer dans la table des dérogations, dont une (FR-30) que
l'addendum déclare explicitement « chantier purement front » alors que le code dit le contraire.
La règle dure de l'utilisateur — *aucun changement serveur non discuté* — est déjà enfreinte au
stade du PRD, avant la première ligne de code.

Second problème structurel : le §4 annonce des regroupements « ordonnés par dépendance » et
l'ordre est démontrablement faux dans les deux sens (§4.1 dépend de §4.3, §4.4 contraint §4.3 et
§4.6). Troisième : une poignée d'exigences n'ont aucune condition d'acceptation exprimable, même
qualitative — personne, y compris l'utilisateur, ne pourra dire « c'est fait ».

Ce qui est bon et mérite d'être dit : le §2 est un vrai critère d'arbitrage utilisable ; P-1 est
la meilleure formulation possible de la règle (typographie admise comme second signal) ; l'addendum
§5 (correctif `API_BASE`) est **vérifié exact** — zéro occurrence de `localhost:3000` restante
dans `apps/web/src`. Les faits serveur de l'addendum §1 sont exacts **sauf un**, mais cet un-là
est structurant.

**27 constats. 4 critiques, 7 élevés, 9 moyens, 7 faibles.**

---

## CRITIQUES — travail serveur non remonté, ou contredit par le code

### C-1 — FR-30 : l'autocomplétion des invitations EXIGE le serveur. L'addendum affirme le contraire.

`apps/api/src/users/users.service.ts` :

```ts
/**
 * Recherche par **email OU pseudo** en correspondance **exacte** (spec §4).
 */
searchByEmailOrPseudo(q: string) {
  return this.prisma.user.findMany({
    where: { OR: [{ email: q }, { pseudo: q }] },
    select: { id: true, pseudo: true, email: true },
  });
}
```

C'est une **égalité stricte**, documentée comme telle et adossée à la spec §4. Une saisie
partielle ne renverra jamais rien. FR-30 (« la saisie propose les utilisateurs déjà
enregistrés ») est donc **impossible à livrer côté front** : il faut un `contains`/`startsWith`,
une limite de résultats, et probablement un `mode: 'insensitive'`.

Or l'addendum §1 le classe en **« Faux besoins écartés — Chantier purement front, aucun
serveur »**, et le PRD §5 le répète en toutes lettres sous « Ne nécessitent aucun changement
serveur ». La vérification annoncée s'est arrêtée à « l'endpoint existe et le front l'appelle » ;
elle n'a pas regardé **ce que l'endpoint fait**. Le front appelle bien
`parties.service.ts:88 searchUsers()` depuis `partie-detail.ts:450`, mais en recherche exacte, ce
qui est précisément l'irritant à corriger.

**Aggravant — sécurité.** Passer d'une égalité stricte à une recherche par préfixe transforme cet
endpoint en **annuaire énumérable**, et le `select` renvoie l'**e-mail**. Aujourd'hui il faut
déjà connaître l'adresse exacte pour la confirmer ; demain trois lettres suffiront à extraire des
couples pseudo/e-mail. Sur une app dont l'inscription est volontairement fermée (FR-37), c'est un
recul net.

**Action :** ajouter une dérogation D-8 (ampleur *modérée*, avec volet sécurité : ne pas renvoyer
l'e-mail en autocomplétion, limiter les résultats, exiger une longueur minimale de requête),
et corriger l'addendum §1 qui affirme aujourd'hui un fait faux.

### C-2 — La notion de « partie terminée » n'existe nulle part. Trois exigences la supposent acquise.

`model Partie` (schema.prisma:46) : `id, name, kind, gameSystemId, description, mjId, createdAt,
nextSessionDate, nextSessionSlot, reminderSentAt`. **Aucun statut, aucun `endedAt`, aucun
`closedAt`.** `PartieDto` (packages/shared/src/index.ts:39) n'en expose pas davantage. Seul
`Scenario` porte `status: ScenarioStatus (BROUILLON|A_VENIR|COURANT|PASSE)` et `closedAt`.

Trois exigences en dépendent :

- **FR-3** : « masquer les parties terminées » ;
- **FR-10** : filtrer par « statut (en cours, terminée, pas encore commencée) » ;
- **FR-12** : « compte-rendu non rédigé **sur une partie terminée** », « une partie terminée est
  visuellement en retrait », « rapport de fin manquant ».

Deux issues, aucune n'est écrite :

1. **Champ persisté** → migration Prisma + endpoint de transition + règle métier (qui clôt une
   partie ? le MJ ? automatiquement ?) → **dérogation serveur absente du §5**, d'ampleur non
   négligeable puisqu'elle introduit un cycle de vie de la Partie qui n'existe pas.
2. **Dérivation front** depuis les scénarios → il faut alors définir la règle
   (« tous scénarios `PASSE` » ? « aucun `COURANT` ni `A_VENIR` » ? une partie sans aucun
   scénario est-elle « pas encore commencée » ou « terminée » ?) et la charger pour **chaque**
   partie de la liste (cf. C-5/E-1).

Un PRD ne peut pas laisser les trois états d'un filtre indéfinis quand le modèle de données n'en
connaît aucun.

### C-3 — FR-9 : « créer une partie » n'est pas et ne peut pas être une action « réservée au MJ ».

FR-9 énonce : *« Les actions propres au MJ (créer une partie, et les options d'une partie donnée)
restent réservées au rôle correspondant »*, avec la précision *« Le rôle est évalué par partie,
pas globalement »*. Les deux phrases se contredisent : **créer une partie ne se rattache à aucune
partie**, donc à aucun rôle évaluable par partie.

Le code confirme qu'il n'y a **pas de rôle MJ global** :

- `enum GlobalRole { USER, ADMIN }` — rien de tel qu'un rôle MJ ;
- `PartiesController` : `@Post() create(@CurrentUser() user, @Body() dto)` sous le seul
  `AuthenticatedGuard` — **tout utilisateur authentifié peut créer une partie** ;
- être MJ, c'est exclusivement être `Partie.mjId` de quelque chose. On devient MJ **en créant**.

Pris au mot, FR-9 demande donc soit (a) une règle d'autorisation serveur nouvelle — dérogation
absente du §5 —, soit (b) une porte fermée à clé de l'intérieur : personne ne pourrait plus créer
sa première partie.

**Aggravant — le piège existe déjà partiellement dans l'UI.** L'entrée « Lancer une quête » est
aujourd'hui dans le menu compte (`shell.html:34`), **non gardée**, tandis que le bouton du
tableau de bord est sous `@if (mode() === 'mj')` (`dashboard.html:1`) et que le toggle lui-même
est sous `@if (hasMjParties())` (`shell.html:8`). Supprimer la bascule (FR-7) supprime la
condition `mode()` : il faut décider explicitement ce qui reste. Le PRD ne le fait pas.

**Action :** reformuler FR-9. Proposition : « la création d'une partie reste ouverte à tout
utilisateur connecté ; les *options d'une partie donnée* sont réservées à son MJ » — ce qui
correspond au code, ne demande aucun serveur, et respecte le sous-point « rôle évalué par
partie ».

### C-4 — FR-16 : aucun endpoint ne liste les personnages d'un utilisateur toutes parties confondues.

`@Controller('characters')` n'expose **aucune route de liste** — uniquement `GET :id` et
des sous-routes par personnage. La seule liste est
`@Controller('parties/:id/characters') @Get() findByPartie()`, scopée à une partie.

FR-16 demande « la liste de **tous** ses personnages, avec recherche ». Deux issues, aucune écrite :

1. Nouvel endpoint `GET /characters` (ou `GET /users/me/characters`) → **dérogation serveur
   absente du §5** ;
2. N appels front (un par partie) + agrégation + recherche côté client → décision d'architecture
   non prise, et qui hérite du problème de fan-out décrit en E-1.

Le PRD présente FR-16 comme une simple « vue distincte » ; c'est en réalité la seule exigence du
palier qui demande une lecture **transverse aux parties** côté personnages, exactement la même
classe de problème que FR-33 (D-6, exposition cross-partie des séances) — laquelle, elle, a bien
été identifiée comme serveur. L'asymétrie de traitement entre FR-33 et FR-16 n'est pas justifiée.

---

## ÉLEVÉS

### E-1 — FR-12 : la signalétique d'état est la plus grosse exigence du palier et n'a ni dérogation ni décision d'architecture.

FR-12 réclame par carte de partie, côté joueur : personnage à créer, prochaine séance, vote en
cours, compte-rendu non rédigé ; côté MJ : Homme Dragon à créer, aucun membre, aucun scénario en
cours, aucune date, aucun vote, rapport de fin manquant. Soit **jusqu'à dix signaux dérivés**.

Ce que `GET /parties?role=…` renvoie : des lignes `Partie` brutes
(`parties.service.ts:61 listForUser`) — aucune agrégation. Les signaux vivent ailleurs :
`Character` (par partie), `HommeDragon` (par partie), `Membership`, `Scenario.status`,
`Seance.compteRendu`, `Scenario.resumeFin`, `SessionPoll.status`.

Le §5 affirme que la liste unifiée « ne nécessite aucun changement serveur ». C'est vrai de la
**liste** ; c'est faux de **FR-12**, qui n'est mentionné nulle part dans le §5.

**Aggravant — le pattern a déjà cassé en production, deux fois, et c'est écrit dans le code.**
`OpenPollsService` porte ce commentaire :

> *« Bug fix (production, tempête de requêtes) : un événement sur UNE Partie déclenchait
> auparavant un refetch de `scenariosSvc.listAll()` pour TOUTES les Parties du joueur »*

et `ModeService.refreshMjParties()` :

> *« Bug fix critique (production) : […] le moindre échec réseau transitoire vidait silencieusement
> TOUTE la liste des Parties du joueur »*

FR-12 multiplie ce fan-out par ~6 sources et l'étend aux parties MJ. Décider « front-only » par
défaut, sans le dire, c'est reconduire un bug déjà payé deux fois.

**Action :** trancher explicitement — soit une dérogation D-9 « payload d'état agrégé sur la liste
des parties » (ampleur *modérée*, un seul appel), soit une décision écrite d'assumer le fan-out
avec un budget de requêtes. Ne pas laisser l'implémentation choisir.

### E-2 — D-7 « Souffles et éveils — Faible » : les éveils existent déjà entièrement, les souffles aussi (sous un autre nom).

Vérifié côté serveur :

- `POST /parties/:id/homme-dragon/eveil-power` (`homme-dragon.controller.ts:56`) ;
- `ChooseEveilPowerDto` (niveaux 2-5), `HommeDragonService.chooseEveilPower()`,
  `buildEveilPowerCatalogKeys()`, `sheetData.eveilPowers`, `pendingEveilLevels` ;
- catalogue seedé `eveil-powers.json` (`game-system.service.ts:93`) ;
- **et l'export PDF les rend déjà** (`homme-dragon.pdf.service.spec.ts` :
  *« résout le libellé du pouvoir d'éveil via GameSystemService.getContent() »*).

Côté souffles : `packages/shared/src/index.ts:669` documente *« Niveau (1-5) et Points de Souffle
max — calculés à la lecture depuis le nombre de scénarios »*, et le test existant
`homme-dragon-sheet.spec.ts:305` assert `'Points de Souffle : 5'` **sur la fiche actuelle**.

Donc : soit D-7 est **déjà livrée** et ne devrait pas figurer au §5 ; soit « souffles » désigne
autre chose (des pouvoirs de souffle du Ryuutama, distincts des Points de Souffle) — auquel cas
c'est un **nouveau domaine de contenu de jeu** (catalogue JSON + seed + validation + sheetData +
PDF), donc tout sauf « Faible ». Le PRD ne définit ni l'un ni l'autre : **FR-26 (« la fiche expose
les souffles et les éveils ») est invérifiable en l'état** — on ne sait pas ce qui manque.

**Action :** faire dire à l'utilisateur, en une phrase, ce qu'il ne voit pas aujourd'hui sur la
fiche. Puis reclasser ou supprimer D-7.

### E-3 — FR-22 est déjà implémenté ; FR-23 porte tout le §4.4 ; et le PRD prévoit de le sacrifier en premier.

`CharacterService.findOne()` autorise **déjà** tout participant de la partie à lire une fiche —
c'est commenté explicitement :

> *« la fiche est visible par tout participant de la Partie depuis la Story 6.5 […] un fellow
> player doit pouvoir atteindre cette page »*

et le mécanisme de notes existe (`CharacterNote.shared`). FR-22 (« un joueur **peut** consulter la
fiche des autres personnages ») décrit donc l'état actuel, pas un besoin. Le vrai contenu de FR-22
est l'inverse : **restreindre** ce qui est aujourd'hui entièrement ouvert — `findOne` renvoie le
`sheetData` complet à un compagnon.

Conséquence : **FR-22 n'a de sens que si FR-23 est livré**. Or la note du §4.4 désigne FR-23 comme
« le premier candidat à sortir ». Si on le sort, FR-22 devient « une version restreinte aux
informations autorisées » sans qu'aucune autorisation n'existe — l'exigence perd son objet, et
le §4.4 se réduit à FR-18/19/20/21.

**Action :** fusionner FR-22 dans FR-23, ou réécrire FR-22 comme « la consultation d'une fiche
compagnon, aujourd'hui totale, est restreinte par défaut à X ». Et acter que sortir FR-23 sort
aussi FR-22.

### E-4 — « Neuf regroupements, ordonnés par dépendance » : l'ordre est faux dans les deux sens.

Le §4 affirme un ordre topologique. Contre-exemples tirés du PRD lui-même :

| Dépendance | Sens | Preuve |
|---|---|---|
| FR-4b (§4.1) → FR-15 (§4.3) | **arrière** | FR-4b : « le nom du personnage lève l'ambiguïté dans la plupart des écrans (**FR-15**) » |
| FR-3 (§4.1) → statut « terminée » (§4.2, FR-10) | **arrière** | FR-3 masque un état que seul FR-10 énumère |
| FR-23 (§4.4) → §4.3 et §4.6 | **avant, mais tardif** | FR-15 (§4.3) et FR-28 (§4.6) affichent des données de personnage que FR-23 rendra filtrables |
| FR-13 (§4.2) → D-1 (§4.1) | correct | seul cas où l'ordre annoncé est vérifié |

Le §4.1 n'est prérequis que pour **le stockage des préférences**. Ce n'est pas la même chose que
« les neuf groupes sont ordonnés ». Le risque concret : livrer §4.3 (convention joueur/personnage
appliquée « partout ») avant FR-23, puis devoir repasser sur chaque écran pour y injecter le
filtrage de visibilité.

**Action :** remplacer l'affirmation par un graphe explicite de 4-5 arêtes réelles, ou retirer la
phrase (elle promet une garantie que le document ne tient pas).

### E-5 — D-2 décrit un travail que FR-4 interdit, et omet le travail que FR-4 exige.

Le libellé de D-2 est **« Gestion de compte (pseudo, e-mail, mot de passe) »**. Mais FR-4 tranche
explicitement l'inverse : *« Le pseudo reste immuable »*, avec un motif solide et vérifié
(`findByEmailOrPseudo` — le pseudo est un identifiant de connexion).

Et ce que D-2 ne mentionne pas alors que FR-4/FR-4b l'exigent :

- une **nouvelle colonne `displayName`** sur `User` (migration Prisma) — le modèle actuel n'a que
  `id, email, pseudo, passwordHash, role, createdAt` ;
- sa **propagation dans tous les DTO** qui renvoient aujourd'hui `pseudo` : `PartieMemberDto`
  (`listMembers` renvoie `{ userId, pseudo, email, joinedAt }`), `UserSearchResultDto`,
  `CharacterDto` (`toDto(character, owner?.pseudo ?? '', …)`), disponibilités, XP, auteur
  d'annonce ;
- la **détection d'homonymie au sein d'une partie** (FR-4b), qui est une requête serveur.

Autrement dit la dérogation la plus lourde du palier (« Élevée ») est mal libellée : elle annonce
du travail annulé et tait la moitié du travail réel.

### E-6 — Sécurité : D-2 atterrit sur une surface réseau volontairement élargie, et rien dans le palier ne la referme.

L'addendum §4 documente deux aménagements de dev actés :
`API_BASE` dérivé de `window.location` (vérifié dans `core/api-base.ts`) et `WEB_ORIGIN`
acceptant **une liste d'origines dont une IP de réseau local**. Le dernier commit du dépôt est
`feat: debug: work on the same network`.

Sur cette surface, le Palier 9 ajoute **les tout premiers endpoints qui modifient un e-mail et un
mot de passe** (D-2), plus un endpoint de recherche d'utilisateurs assoupli (C-1). Le PRD ne
relie jamais les deux faits. Concrètement, il manque :

- une exigence propriétaire du **retour arrière** des aménagements de dev — l'addendum les renvoie
  au Palier 11, c'est-à-dire *après* la mise en ligne de la gestion de compte ;
- toute mention de **limitation de débit** sur `POST` changement de mot de passe / e-mail, alors
  que `CLAUDE.md` cite explicitement le throttler comme acquis du palier auth ;
- une position sur `UserSession` : **le modèle existe** (`model UserSession { userId, sid, … }`),
  ce que ni le PRD ni l'addendum ne mentionnent — c'est pourtant l'élément qui rend Q-4
  (invalidation des autres sessions) tranchable à peu de frais. L'« état vérifié du serveur »
  (addendum §1) est incomplet sur le point même qui porte un point ouvert.

La note du §4.1 (« mérite un passage par `/security-review` ») est nécessaire mais pas suffisante :
une revue de sécurité en fin de chantier ne remplace pas une exigence qui dit ce qu'on ferme.

### E-7 — FR-38 : « messages véridiques » sans garde-fou d'énumération.

FR-38 demande de distinguer « identifiants invalides » d'une « indisponibilité du serveur ». Bon
besoin, cause réelle documentée (addendum §5). Mais l'exigence est **muette sur la limite à ne pas
franchir** : ne jamais distinguer « ce compte n'existe pas » de « mot de passe incorrect ».

Le risque est concret ici parce que la connexion accepte e-mail **ou** pseudo
(`findByEmailOrPseudo`) : un message granulaire transformerait l'écran de login en oracle
d'existence de comptes, sur une app où l'inscription est fermée (FR-37) et où C-1 s'apprête déjà à
assouplir la recherche d'utilisateurs. Une ligne suffit à le border.

---

## MOYENS

### M-1 — Q-2 et l'addendum §3 reposent sur un fait faux : la « garantie de complétude à la compilation » n'existe pas.

L'addendum §3 : *« `tones.ts` étant typé, la découpe en JSON peut faire perdre la garantie de
complétude des clés à la compilation »*. Le code :

```ts
export const TONE_MAP: Record<Theme, Record<string, string>> = { … }
```

La clé est `string`. **Aucune** union de clés, aucun `keyof`, aucun `satisfies`, et aucun test de
complétude dans `apps/web/src/app/core/theme/` (le dossier ne contient que `tones.ts` et
`theme-tone.service.ts` — pas de spec). Un thème auquel il manque 40 clés compile aujourd'hui sans
un mot ; l'accès se fait en `theme.tone()['une.cle']` dans les templates, donc l'oubli se voit
seulement à l'écran, sous forme de vide.

Q-2 pose donc la mauvaise question (« que perd-on ? » — rien) au lieu de la bonne : **« profite-t-on
de FR-43 pour *gagner* une garantie qu'on n'a jamais eue ? »**. C'est d'autant plus dommage que
FR-41 (« complétude des clés ») est précisément l'exigence qu'un typage rendrait vérifiable
gratuitement au lieu de reposer sur une relecture humaine de 3 × ~200 libellés.

### M-2 — P-3 « parité desktop/mobile » : une hypothèse non reconfirmée promue au rang de principe.

Le `.memlog.md` enregistre :

> *(assumption) Usage actuel quasi exclusivement desktop […] **A reconfirmer : desktop-first ou
> parite reelle***

Aucune entrée ultérieure ne trace la confirmation. Le PRD la promeut pourtant en **principe
transverse ferme** — « Aucun des deux n'est un support secondaire » — ce qui double implicitement
le coût de conception de chaque écran refondu. C'est le paramètre le plus cher du document et le
moins étayé. Une phrase de l'utilisateur suffit à le clore ; l'écrire comme acquis sans cette
phrase, non.

### M-3 — FR-13 : le côté « lecture » de la notification d'annonce n'est traité nulle part.

D-1 couvre le **stockage** de l'horodatage « annonce vue ». Mais pour afficher la bulle à la
connexion, il faut d'abord **savoir s'il existe des annonces non vues**, et
`@Controller('parties/:id/announcements')` est strictement scopé à une partie : il n'existe aucune
lecture transverse. À la connexion, l'app devra donc interroger les annonces de **chaque** partie
de l'utilisateur (même fan-out qu'en E-1), ou obtenir un endpoint d'agrégation.

Ni le §5 ni l'addendum ne le mentionnent. Comme pour FR-33/D-6, la question « d'où vient
l'information transverse ? » doit être posée à FR-13.

### M-4 — FR-7 casse la source actuelle des badges de vote, ce que FR-12 exige justement côté MJ.

`OpenPollsService.refresh()` itère sur `this.modeSvc.playerParties()` **uniquement**. La liste
unifiée de FR-7 fera cohabiter parties joueur et parties MJ ; FR-12 demande « aucun vote » comme
signal **côté MJ**. Sans retouche, les cartes MJ n'auront jamais de badge de vote — un écran plus
lisible qui affiche moins d'information que l'ancien.

Ce n'est pas un détail d'implémentation : c'est une dépendance FR-7 → FR-12 qui conditionne la
tenue de la promesse principale du palier, et elle n'apparaît dans aucun des deux documents.

### M-5 — Exigences sans condition d'acceptation exprimable.

Il ne s'agit pas de réclamer des métriques (§8 assume, à raison, de ne pas en avoir). Il s'agit
d'exigences dont **personne ne pourra dire si elles sont satisfaites**, même à l'œil, même par
l'utilisateur :

| FR | Formulation | Ce qui manque |
|---|---|---|
| FR-21 | « améliorer sa lisibilité et réduire les gestes inutiles » | quel geste, aujourd'hui, est inutile ? |
| FR-24 | « atteindre le même niveau de présentation que les fiches joueur » | quelles caractéristiques de la fiche joueur sont la cible ? |
| FR-27 | « l'export est mis au niveau du reste » | l'export HD **existe déjà** (`GET export.pdf`, `homme-dragon.pdf.service.ts`) — que lui manque-t-il ? |
| FR-28 | « une hiérarchie lisible » | quels blocs, dans quel ordre ? |
| FR-29 | « rendre compréhensibles l'enchaînement, l'état et les séances » | compréhensible se constate, mais rien ne dit *ce qui* doit devenir visible |

Correctif peu coûteux et dans l'esprit du document : pour chacune, **une ligne « aujourd'hui X,
demain Y »**. FR-12 et FR-33 montrent que le PRD sait très bien le faire quand il veut.

### M-6 — §8 : le « signal d'échec » est le bon critère et il est inutilisable faute de mesure initiale.

> *« si la refonte ajoute des écrans et des options sans réduire le nombre de gestes pour les
> parcours courants (voter une date, déclarer une dispo, retrouver son personnage) »*

C'est exactement le bon garde-fou. Mais **personne n'a compté les gestes actuels**. Après la
refonte, la comparaison reposera sur un souvenir, c'est-à-dire sur rien. Compter les clics/taps de
ces trois parcours aujourd'hui coûte dix minutes et rend le seul critère falsifiable du §8
réellement utilisable. C'est la mesure la moins cérémonieuse possible et elle manque.

### M-7 — FR-41 (« cohérence de registre ») ne passe pas le critère d'arbitrage du §2.

Le §2 pose : *« Une exigence purement décorative n'a pas sa place ici »*, et le critère
d'arbitrage est « répond à une des cinq questions du §1 **ou** supprime un geste pénible ».

- FR-42 (statuer thème / hors thème) et FR-43 (réorganisation) passent : les libellés codés en dur
  cassent le mécanisme de thème. Preuve concrète : `calendar-view.html:12` affiche
  `<mat-button-toggle value="week">Vue semaine</mat-button-toggle>` — en dur, hors `tones.ts`.
- La **complétude des clés** de FR-41 passe aussi : une clé manquante affiche du vide.
- La **« cohérence de registre »** ne passe pas. C'est de la finition éditoriale, sur trois thèmes
  et ~200 clés chacun, relue par l'utilisateur lui-même. C'est légitime comme envie ; ça contredit
  frontalement le cadrage que le §2 impose à tout le reste du document.

Soit on assume l'exception et on l'écrit, soit on la sort. La laisser passer sous le même toit que
le §2 fragilise le critère d'arbitrage pour toutes les autres arbitrages du palier.

### M-8 — Trois exigences sont des fonctionnalités nouvelles, pas des corrections d'utilisabilité.

- **FR-11 (favoris)** — nouveau modèle de données, nouvelle interaction. Défendable
  (retrouver plus vite), mais c'est de l'ajout.
- **FR-16 (vue mes personnages)** — nouvelle vue, nouvelle navigation, cf. C-4.
- **FR-26 (souffles et éveils)** — du **contenu de jeu**. Ne répond à aucune des cinq questions du
  §1 et ne supprime aucun geste. Par le critère du §2, il sort.

Le cadrage dit « refonte d'utilisabilité, pas esthétique ». Le glissement observé n'est pas vers
l'esthétique — c'est vers la **fonctionnalité**, angle mort du critère d'arbitrage tel qu'il est
rédigé. Il vaudrait d'ajouter au §2 : « ni décoratif, **ni fonctionnalité nouvelle** ».

### M-9 — FR-10 : « trier par date » — laquelle ?

`Partie` porte `createdAt` **et** `nextSessionDate` (et `Membership.joinedAt` sert déjà d'ordre de
tri pour les parties joueur : `orderBy: { joinedAt: 'desc' }`, tandis que les parties MJ sont
triées par `createdAt`). Trois dates plausibles, trois classements différents, et le tri actuel
est **déjà incohérent entre les deux listes** que FR-7 va fusionner. À trancher dans le PRD, pas à
l'implémentation.

---

## FAIBLES

### F-1 — Q-7 manquant du tableau §7 sans explication.
Le §7 liste Q-1…Q-6, puis Q-8, Q-9. Le `.memlog.md` documente que Q-7 (homonymie des noms
affichés) a été tranché le 2026-08-03 et clos — mais un lecteur du seul PRD voit un trou et se
demande ce qu'il a raté. Une ligne « Q-7 — clos, cf. FR-4b » suffit.

### F-2 — P-1 tranche déjà ce que FR-14 présente comme à concevoir.
P-1 fixe l'exemple retenu (« le nom de personnage toujours en italique »), FR-14 demande de
définir « une convention visuelle unique ». Soit la convention est arrêtée, soit elle ne l'est
pas. Fusionner, ou faire de FR-14 la simple application de P-1 à tous les écrans.

### F-3 — « Sept exceptions » sous-compte le volume réel de changement serveur.
D-1 agrège trois changements de schéma distincts (thème, masquage, horodatage annonce vue) et D-2
en agrège quatre (colonne `displayName` + trois endpoints). Le chiffre « sept » rassure plus que
la réalité. Compter les lignes de table n'est pas compter le travail.

### F-4 — FR-12 : « une partie nouvelle est mise en avant » — « nouvelle » n'est pas défini.
Créée il y a moins de N jours ? Jamais ouverte par cet utilisateur ? Rejointe depuis la dernière
connexion ? Trois implémentations, trois comportements.

### F-5 — FR-2 : le conflit repli local / valeur de compte n'est pas arbitré.
Le repli local est justifié (écrans d'auth). Mais si les deux diffèrent à la connexion, qui gagne,
et accepte-t-on le flash de thème au moment de la bascule ? Une phrase.

### F-6 — FR-36 et FR-31 sont des tâches d'investigation, pas des exigences.
« L'utilité de la vue semaine est réévaluée », « la refonte statue explicitement sur la place de… »
décrivent un travail à faire, pas un état de l'application. Leur place naturelle est le §7 (Points
ouverts), avec une date de décision — d'autant que Q-6 y duplique déjà FR-36.

### F-7 — FR-17 décrit le symptôme, pas la cible.
La bannière est un composant dédié (`<app-level-up-banner>` dans `character-sheet.html:80`), pas
un débordement CSS accidentel. « Retrouve un placement correct, à l'emplacement prévu près du
nom » suppose un emplacement prévu que le document ne décrit pas. Une capture ou deux mots sur la
forme cible (pastille ? bandeau réduit ?) évitent un aller-retour.

---

## Ce qui est solide (à ne pas casser en corrigeant)

- **§2** est un vrai critère d'arbitrage, formulé de façon opérationnelle. Rare.
- **P-1** avec la typographie admise comme second signal : meilleure formulation que l'icône
  systématique, et vérifiable à l'œil.
- **P-2** (vigilance, pas conformité) : bien calibré, correctement justifié par un test sur
  appareil réel, et l'addendum §2 en trace la révision. Exemplaire.
- **FR-4** : la justification de l'immuabilité du pseudo est correcte et **vérifiée dans le code**
  (`findByEmailOrPseudo` est bien appelé par la validation de connexion).
- **FR-37** : la justification (impasse silencieuse, `RegisterDto` exige un token) est exacte.
- **Addendum §5** : vérifié — **0 occurrence** de `localhost:3000` dans `apps/web/src`, `API_BASE`
  conforme à la description. Le seul endroit du document où une vérification annoncée tient
  entièrement.
- **§6 Hors périmètre** : chaque exclusion est motivée, pas seulement listée.

---

## Ordre de traitement recommandé

1. **C-1, C-2, C-3, C-4** — corriger le §5 et l'addendum §1 avant toute découpe en epics. C'est la
   règle dure de l'utilisateur qui est en jeu, et trois de ces quatre points changent le contenu
   d'une exigence, pas seulement sa documentation.
2. **E-1, E-5** — chiffrer FR-12 et re-libeller D-2 : ce sont les deux plus gros écarts entre le
   coût annoncé et le coût réel.
3. **E-2, E-3** — clarifier avec l'utilisateur ce que « souffles » désigne, et acter que FR-22
   tombe avec FR-23.
4. **E-4** — remplacer la promesse d'ordonnancement par un graphe de dépendances honnête.
5. **E-6, E-7** — sécurité : possession du retour arrière des aménagements de dev, throttling,
   `UserSession` dans l'état vérifié, borne d'énumération sur FR-38.
6. **M-5, M-6** — une ligne « aujourd'hui X, demain Y » sur les cinq exigences invérifiables, et
   compter les gestes des trois parcours nommés au §8 **avant** de commencer.
7. Le reste au fil de l'eau.
