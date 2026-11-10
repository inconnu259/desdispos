# Revue de la spine du Palier 10.4, selon la grille

- **Spine relue :** `ARCHITECTURE-SPINE.md` (draft, 2026-10-20), avec `.memlog.md`
- **Parente :** `architecture-jdr-master-2026-10-08/ARCHITECTURE-SPINE.md` (P10-AD-1 à 18)
- **PRD :** `prds/prd-jdr-master-2026-10-19-p10-4/prd.md` (+ `addendum.md`)
- **Code vérifié :** `apps/api/src` (poll, availability, parties, events, scenarios, permissions, ports) et `apps/web/src/app` (calendar-view, routes, partie-detail, seance-list)
- **Relecteur :** indépendant, en lecture seule, 2026-10-20

## Verdict

La structure est bonne : le partage atelier / vitrine est clair, les trois lectures du calendrier personnel sont nettes, l'amendement de P9-AD-18 est déclaré et la couverture des FR est complète. En revanche, la spine **n'est pas encore exploitable par les stories**. Deux règles, une fois appliquées à la lettre, produiraient un comportement faux :

- AD-4 calcule « peut organiser » avec des actions qui ne donnent pas le bon résultat en mode soirée ;
- AD-11 affirme que les indisponibilités dérivées « suivent sans changement », alors que le code ne lit que le départ d'une séance.

Plusieurs affirmations sur le code existant sont aussi inexactes : la règle de couches que fait respecter `layer-imports.spec.ts`, ce qu'arme aujourd'hui `?seanceId`, le chemin d'écriture d'une soirée isolée, et le contrat réel d'`available-slots`. À amender avant le découpage en stories.

## Synthèse

| Gravité | Nombre | AD concernés |
| --- | --- | --- |
| Critical | 2 | AD-4 (+ AD-2, AD-3), AD-11 (+ P10-AD-15) |
| High | 5 | AD-2, AD-5, AD-3, AD-7 / AD-8 / AD-11, AD-2 (vote) |
| Medium | 6 | AD-1 / AD-6 / AD-9, AD-6, AD-3 (filtre), AD-3 (PRD), FR-14, AD-10 |
| Low | 6 | AD-7 / AD-12, AD-9, AD-6, AD-4 / P9-AD-20, memlog, structure |

---

## CRITICAL

### C1 — AD-4 (et AD-2, AD-3) : « peut organiser » calculé avec des actions qui donnent un résultat faux en mode soirée, et sans méthode « en lot » qui existe

**Problème.** AD-4 dit que `canOrganize` est « calculé par `PermissionService` à partir des actions `SEANCE_POLL_CREATE` (rendez-vous) ou `POLL_CHOOSE` (sondage), en lot ». Le code donne pourtant :

- **Créer, en mode soirée.** `SEANCE_POLL_CREATE` vaut `NOBODY` dans la politique ralliement (`permissions/permission.service.ts:270`). Avec la règle telle qu'écrite, `canOrganize` serait toujours faux, et Léa (UJ-2) ne verrait jamais « Proposer des dates ». En mode soirée, créer ou modifier un sondage passe par `EVENT_UPDATE` sur la cible `{ eventId }`, réservé à l'hôte (`events/group-events.service.ts:126`, `permission.service.ts:363-367`).
- **Fixer la date, en mode soirée.** `POLL_CHOOSE` vaut `ADMIN_AND_MEMBERS` (`permission.service.ts:288`). La restriction à l'hôte ne joue **que si la cible est `{ eventId }`** (`HOST_ONLY_WHEN_EVENT_TARGETED`, `permission.service.ts:382`, `:479-486`). Évaluée sur `{ partieId }` ou sans cible, l'action est accordée à tout membre : chacun verrait « Fixer la date… » et recevrait un 403. C'est exactement la divergence que l'AD dit empêcher.
- **Modifier les dates, en JDR.** C'est `POLL_OPTIONS_SET` (`poll.service.ts:533`), que l'AD ne cite pas. Le résultat est identique aujourd'hui (MJ seul), mais rien ne le garantit.
- **Aucune méthode « en lot ».** `PermissionService` n'expose que `assert()`, qui lève une exception pour une seule cible, et `rolesOf()`, qui renvoie des rôles et non des droits (`permission.service.ts:456`, `:519`). Rien ne calcule une action sur N cibles en résolvant l'hôte de chaque événement. Le test `no-direct-owner-read.spec.ts` interdit de lire `ownerId` hors de `permissions/`. Chaque lecture (`/me/open-polls` dans `poll/`, `/me/datable-seances` dans `events/`, charges utiles de l'atelier) inventerait donc son propre contournement.
- **Charges utiles à enrichir non nommées.** L'AD ne dit pas quels DTO gagnent `canOrganize` : `EventCardDto` (qui n'a aujourd'hui que `hostId`), le DTO de scénario ou de séance de l'atelier JDR, `OpenPoll`, `DatableSeance`. Une story utilisera `role === 'mj'` ou `isMjMode()`, une autre un champ servi.

**Correctif proposé.** Réécrire la règle d'AD-4 :

1. Une méthode unique dans `permissions/`, par exemple `canOrganizeMany(userId, targets: ({ seanceId } | { pollId })[]) → Map<id, boolean>`, en une ou deux requêtes. Elle résout la partie, la famille et l'hôte de l'événement de chaque cible.
2. Une table de correspondance fermée, dans la spine :

   | Famille | Créer | Modifier | Fixer la date | Prolonger |
   | --- | --- | --- | --- | --- |
   | JDR | `SEANCE_POLL_CREATE {seanceId}` | `POLL_OPTIONS_SET` | `POLL_CHOOSE {partieId}` | — |
   | Ralliement | `EVENT_UPDATE {eventId}` | `EVENT_UPDATE {eventId}` | `POLL_CHOOSE {eventId}` | `POLL_EXTEND {eventId}` |

3. La liste des DTO qui portent le booléen.
4. Une cellule de test par famille et par action dans la matrice de refus.

### C2 — AD-11 : « indisponibilités dérivées sans changement » est faux, le code ne lit que le départ d'une séance

**Problème.** AD-11 dit qu'après « fixer la date », le reste (prochaine séance, rappels, indisponibilités dérivées) « suit P10-AD-4 et P10-AD-15 sans changement ». Or tous les lecteurs de plage du code supposent `start = end`, conformément à P10-AD-4 (« ce palier n'écrit que des plages d'un créneau ») :

- `OccupiedSpan = { date, slot }`, un seul créneau, sans fin (`availability/ports/occupied-spans.port.ts:8-11`).
- `EventsService.occupiedSpansOf()` ne lit que `startDate` et `startSlot` (`events/events.service.ts:2049-2051`). Une séance de six créneaux ne rendrait la troupe indisponible que sur le premier. L'automate (`getAvailableSlots`, via `getActiveDeclarationsWithSeances`) et la carte de chaleur proposeraient donc des fenêtres en plein milieu d'une séance déjà fixée. C'est aussi ce qui fausse `?span=N`.
- `MyCalendarSeanceEntry` n'a que `date` et `slot` (`packages/shared/src/index.ts:1071-1078`) : une séance datée longue s'affiche sur son seul premier jour dans le calendrier personnel, et il en va probablement de même dans l'Agenda de l'atelier. AD-11 ne traite que l'**option** (« une option produit une entrée portant départ et fin ») et oublie la **séance datée**, qui est pourtant la régression de la Story 36.6 que l'AD prétend éviter.
- `chooseDate` écrit `endDate = date` et `endSlot = slot` (`events.service.ts:1236-1242`). Ce point est bien prévu par AD-11, à garder.

**Correctif proposé.**

- Déclarer qu'AD-11 **étend P10-AD-15** : `OccupiedSpan` devient une plage (`start`, `end`, ou départ plus durée), et `occupiedSpansOf` déplie la plage par `spanEnd` ou son inverse, avec une seule fonction de dépliage dans `@master-jdr/shared`.
- Ajouter `endDate` et `endSlot` à `MyCalendarSeanceEntry` et à l'entrée d'agenda de séance de l'atelier.
- Ajouter à la convention « Tests » : une séance de N créneaux rend la troupe indisponible sur chacun des N, y compris au passage du soir au lendemain matin.
- Retirer « sans changement ».

---

## HIGH

### H1 — AD-2 (diagramme « PO → AV ») : contredit la règle de couches que la CI fait respecter, et laisse sans port deux dépendances vers la couche 2

**Problème.**

- **`OwnEventsPort` interdit à `poll/`.** AD-2 fait obtenir à `poll/` les parties et leurs noms « par `OwnEventsPort` », un port déclaré dans `availability/ports/`. Or `ports/layer-imports.spec.ts:10-25` applique une liste blanche : un fichier de `poll/` ne peut importer que son propre dossier ou `common`, `prisma`, `permissions`, `realtime`, `auth`, `users`, `email`. Importer `../availability/ports/own-events.port` fait échouer la CI. Le diagramme (« PO --> AV », « règle de P10-AD-1 inchangée ») est donc faux.
- **`OwnEventsPort` exige une période.** `ownEventsOf(userId, roles, range)` prend une `OwnEventsRange` obligatoire et renvoie aussi les séances (`own-events.port.ts:49-51`). Il ne répond pas à « mes parties actives, sans borne ».
- **Statut de partie inaccessible.** « Partie active » (AD-3) dépend du statut de P10-AD-18. Or la seule fonction de statut est privée à `parties/` (`parties.service.ts:214-230` `toPartieDto`, et `progressOf` en `:419`). `parties/` importe `events/` (`parties.module.ts:16`), si bien qu'`events/` ne peut pas l'appeler sans créer de cycle, et `poll/` encore moins. Chaque nouvelle lecture (`/me/open-polls`, `/me/datable-seances`) serait tentée de recalculer le statut, ce qui viole P10-AD-18 (« une seule fonction »).
- **Ayants droit sans port.** « Les ayants droit sont ceux de `eligibleVoters` (P10-AD-6) » : cette fonction vit dans `events/` (`events/eligible-voters.ts`), et aucun port de `poll/ports/` ne l'expose en lot (`GroupPollVotePort` ne fait que `assertCanVote`).

**Correctif proposé.**

- Déclarer dans `poll/ports/` un port dédié, par exemple `OpenPollScopePort.scopeOf(userId) → { parties actives (id, nom, famille), ayants droit par sondage }`, implémenté par `events/` et lié dans `PortsModule`.
- Déplacer la dérivation du statut dans une fonction **unique** appelable depuis `events/` : soit une fonction pure dans `@master-jdr/shared` alimentée par `progress`, soit un calcul de `progress` en lot dans `events/` que `parties/` réutilise. Déclarer explicitement ce déplacement pour honorer P10-AD-18.
- Corriger le diagramme.

### H2 — AD-5 : `?seanceId` n'arme pas aujourd'hui le composer, et `/guild-calendar` n'est pas que « le calendrier du groupe »

**Problème.**

- **Ce que fait vraiment `?seanceId`.** AD-5 présente `?seanceId` comme « existant, Story 36.12 » et seul armement du composer. Dans le code, `?seanceId` est lu par la **Story 8.7** et ouvre l'**ancien panneau `app-poll-creation`** (`calendar-view.ts:1790-1793` : `lockedSeanceId` et `pollPanelOpen` ; `calendar-view.html:452-460`). C'est ce lien qu'utilise « Lancer le vote » de la fiche de scénario (`seance-list.ts:213-218`). La Story 36.12 arme le composer par un événement interne de l'Agenda (`startCompose(seanceId)`, `calendar-view.ts:1235-1251`, `:2485-2489`), pas par l'URL. Sans décision explicite, deux interfaces de création coexisteront, ce que l'AD dit justement empêcher. FR-14 exige que « Lancer le vote » ouvre le composer.
- **Qui utilise `/guild-calendar`.** Le tableau du paradigme attribue `/parties/:id/guild-calendar` au « calendrier du groupe ». C'est aussi le calendrier de partie **des joueurs de JDR** : la route est en mode `personal` avec un `partieId` (`app.routes.ts:129-133`), et les joueurs y sont envoyés (`partie-detail.html:119-121`, `dashboard.html:379`). `/parties/:id/calendar` est le mode `mj` (`app.routes.ts:128`). Les règles « composer à l'atelier » et `?poll` côté joueur (FR-14, page de partie) doivent viser cette route en précisant le rôle.

**Correctif proposé.**

- Corriger le tableau : le calendrier de partie est `/calendar` pour le MJ et `/guild-calendar` pour un joueur ; le calendrier du groupe est `/guild-calendar` en mode soirée.
- Dans AD-5 : `?seanceId` arme désormais le **composer** (création ou modification préremplie) et le panneau `app-poll-creation` / `pollPanelOpen` est **retiré** dans la story qui touche FR-14.
- Préciser que `?seanceId` n'a aucun effet pour qui n'a pas `canOrganize`.

### H3 — AD-3 et AD-5, mode soirée : le seul « rendez-vous à dater » réel est la soirée isolée sans date, dont le chemin d'écriture n'est pas celui de la Story 40.5b

**Problème.**

- **Un groupe n'a jamais de rendez-vous à dater.** Un événement de groupe (`CAMPAGNE_EPISODIQUE`) est créé **soit daté, soit avec sondage**, jamais sans les deux (`group-events.service.ts:322-325`, `pollMode === fixedMode` → 400). Pour un groupe, « à dater » est donc toujours vide.
- **Seule la soirée isolée en attente compte.** Le seul cas est la soirée isolée (`ONE_SHOT`) « en attente de date » (`events.service.ts:1089-1096`, `isAwaitingDate`), c'est-à-dire précisément UJ-2 (Léa).
- **Le chemin d'écriture réel.** Lui créer un sondage passe par `PATCH /parties/:id/events/:eventId` en **remplacement complet**, branche « completing » de la Story 41.2 (`group-events.service.ts:120-144`). Ce chemin **exige une échéance** (`pollDeadline`, `:338-340`), ainsi que le titre, le lieu, l'heure, la note et la capacité à renvoyer à l'identique.
- **Le composer ne sait pas viser ce cas.** Côté écran, il n'a aucune cible correspondante : `group-poll` exige un sondage déjà ouvert et l'hôte (`calendar-view.ts:1450-1466`), `group-new` est un brouillon d'événement à créer (`:1469-1480`).

AD-5 (« groupe = chemins de la Story 40.5b ») est donc inexact pour UJ-2. Le besoin d'échéance n'est décidé nulle part : le JDR a 14 jours par défaut (`poll.service.ts:27`), pas la soirée.

**Correctif proposé.**

- Ajouter à AD-3 : en mode soirée, un rendez-vous à dater n'existe que pour une soirée isolée en attente de date.
- Ajouter à AD-5 : l'écriture se fait par `PATCH …/events/:eventId` (Story 41.2), avec les autres champs **relus** depuis la carte de l'événement, et une nouvelle cible de composition.
- Décider la source de l'échéance (saisie dans le composer, ou défaut côté serveur) et la renvoyer au delta UX si besoin.

### H4 — AD-7, AD-8, AD-11 : le contrat d'`available-slots` décrit par la spine ne correspond pas au code

**Problème.**

- **« Toutes les fenêtres ».** AD-7 dit qu'`available-slots` « renvoie toutes les fenêtres avec un drapeau `hidden` ». Le code **plafonne à 20** après un tri par priorité (`parties.service.ts:1663`). Si l'on masque après le plafond, la liste rétrécit à chaque masquage sans faire remonter de nouvelles fenêtres. Si l'on masque avant, « afficher les masquées » ne peut plus rien montrer. De même, AD-8 retire côté client les fenêtres déjà proposées **après** le plafond serveur, et un sondage de 10 options vide la moitié de la liste. Rien ne fixe cet ordre, et deux stories (FR-2 et FR-3) le décideront différemment.
- **« Toute la troupe libre ».** AD-11 dit que `?span=N` ne renvoie « que les fenêtres où toute la troupe est libre ». Avec `span=1`, le code renvoie aussi des créneaux mixtes, inconnus, voire avec des refus. Il n'exclut que ceux où le MJ est indisponible et classe le reste (`:1631-1661`). Les sémantiques de `span=1` et de `span=N` divergeraient sans que ce soit dit.
- **Qui peut masquer.** AD-7 accorde masquer / démasquer au « droit `PARTIE_AVAILABILITY_READ` du MJ ». En JDR, cette action vaut `OWNER_AND_MEMBERS` (`permission.service.ts:140`), et les joueurs reçoivent déjà une vue agrégée de la même route (`parties.service.ts:1665-1672`). Les joueurs pourraient donc masquer, et le « drapeau propre au lecteur » s'appliquerait aussi à la vue agrégée. Le memlog (ligne 15, « MJ seulement ») est inexact.

**Correctif proposé.**

- Fixer dans AD-7 et AD-11 l'ordre des étapes : calcul → exclusion des fenêtres déjà proposées et des masquées (ou drapeau) → plafond. Le plus simple : le serveur exclut aussi les options des sondages ouverts, puis plafonne les fenêtres non masquées, et renvoie à part le nombre et la liste des masquées.
- Aligner `span=1` sur la règle de `span=N`, ou dire explicitement que la règle de classement existante est conservée pour tout `N`.
- Créer une `PermissionAction` réservée au MJ (par exemple `SLOT_WINDOW_HIDE`, `OWNER_ONLY` en JDR et `NOBODY` en ralliement), avec sa cellule de refus. Ne servir `hidden` qu'à la vue nominative.

### H5 — AD-2 : la charge utile de `/me/open-polls` perd la réponse du lecteur option par option, ce qui casse le vote dans le calendrier personnel

**Problème.** AD-2 énumère les champs d'une option (`optionId`, `date`, `slot`, `yes`, `maybe`, `no`) et `me = { eligible, answered, canOrganize }`. Le calendrier personnel vote aujourd'hui grâce à **`myAnswer` par option** (`availability.service.ts:955-970`), utilisé par le sélecteur de réponse (Story 36.7). Comme AD-1 retire `votes-en-cours` de `/me/calendar`, `/me/open-polls` devient la seule source, et le vote personnel (« vitrine : vote ») régresse : impossible de montrer ou de basculer sa propre réponse. `membersCount`, le dénominateur actuel, devient `eligibleCount`, ce qu'il faut dire pour le rail (`poll-track`).

**Correctif proposé.** Ajouter `myAnswer: VoteAnswer | null` à chaque option d'AD-2 (c'est sans identité, puisqu'il s'agit de la réponse du lecteur lui-même), et ajouter « remplace `membersCount` » dans les conventions. Ajouter à la convention « Tests » la caractérisation : même forme d'option qu'aujourd'hui, plus les champs ajoutés.

---

## MEDIUM

### M1 — AD-1, AD-6, AD-9 : la liste ✦ risque de revenir bornée au mois affiché

AD-1 dit que « la grille filtre elle-même sur la période affichée », et AD-6 que la liste ✦ vient « toujours de `destinyPolls()` dérivé d'`allCalendarEntries()` » (`calendar-view.ts:1017-1028`). Si le filtre de période est appliqué dans `allCalendarEntries()`, la liste ✦ ne couvre plus que le mois, ce qui viole FR-7. AD-9 ne dit pas non plus si le filtre par partie s'applique à la liste ✦ (FR-15 : « toutes les natures affichées »).

**Correctif.** Écrire que `allCalendarEntries()` contient **tous** les sondages ouverts, sans borne, et que le filtre de période ne s'applique qu'au rendu. Trancher : la liste ✦ est-elle filtrée par partie (oui ou non) ?

### M2 — AD-6 : « reconnu clos » n'a pas de mécanisme, et FR-12 demande d'en donner la raison

L'AD dit « absent de la source **et** reconnu clos (date fixée, annulé, supprimé) », sans dire comment on le reconnaît. En calendrier personnel, un sondage peut quitter `/me/open-polls` parce qu'il est clos, mais aussi parce que la partie n'est plus active, que l'utilisateur l'a quittée, ou que le scénario est redevenu un brouillon caché. FR-12 exige un message « qui dit pourquoi ». L'heuristique actuelle (`lastDestinyDates`, `calendar-view.ts:1693-1733`) n'a plus de raison d'être avec une source sans borne. Rien ne dit qu'il faut la retirer.

**Correctif.** Règle : absence après un rechargement **réussi** de la source qui fait autorité = fin du mode. La raison se déduit de la charge utile déjà présente (séance désormais datée → « date fixée », événement annulé → « annulé », sinon un message générique), sans nouvelle lecture. Retirer l'heuristique de plage dans la même story.

### M3 — AD-3 : le branchement de `DatableSeanceFilter` n'est pas défini, et le précédent cité ne s'applique pas

Le précédent de P10-AD-3 est un **rappel passé à l'appel** : c'est `scenarios/` qui appelle `events.create(…, extend)`. Pour `GET /me/datable-seances`, c'est le contrôleur d'`events/` qui initie la lecture, et aucun appel ne vient de `scenarios/`. Il faut un jeton d'injection lié quelque part, sinon chaque story improvisera, par exemple en faisant lire `Scenario.status` directement à `events/`.

**Correctif.** Déclarer le jeton dans `events/ports/`, le lier dans `PortsModule` (racine de composition déjà globale) en `useExisting: ScenariosService` ou un service dédié, et étendre la convention « Écrivains / lecteurs » en conséquence.

### M4 — AD-3 et PRD : « sans sondage lié » restreint la définition du PRD sans figurer dans les écarts ⚠️

Le Glossaire du PRD définit un rendez-vous à dater comme « **sans sondage ouvert** ». AD-3 dit « sans sondage **lié** ». En JDR, un vote fermé sans date par `POLL_CLOSE` (`poll.service.ts:584-599`, accessible depuis le calendrier MJ) laisse donc la séance hors de portée des trois calendriers. Le cas figure dans Deferred (« relancer un vote clos sans date »), mais pas dans la liste « ⚠️ Écarts » à reporter au PRD. Le contournement existant (`resetSeanceDate` supprime le sondage, `scenarios.service.ts:728-751`) n'est pas mentionné.

**Correctif.** Ajouter ce point à la liste ⚠️ des écarts au PRD (définition du Glossaire) et citer le contournement.

### M5 — FR-14 : aucun contrat d'URL pour « ouvrir la liste des destinées restreinte »

FR-14 : si une partie a plusieurs sondages ouverts, le bouton « vote en attente » ouvre la **liste** des destinées restreinte à cette partie. Les conventions n'autorisent que `?poll` et `?seanceId`, et interdisent les synonymes. Deux stories (page de partie, accueil `dashboard.html:379`) inventeront deux formes différentes.

**Correctif.** Décider la forme, par exemple `?poll=` choisi côté serveur et côté page quand il n'y en a qu'un, sinon `?destinies` (sans valeur) qui ouvre la liste, et l'ajouter aux conventions. Autre option : le bouton choisit d'office le premier sondage « à faire ».

### M6 — AD-10 : trois points de la durée restent sous-spécifiés

- **Événement de groupe daté d'emblée.** La durée n'est portée que par `SessionPoll.durationSlots` et « le `PATCH` d'événement ». La **création** d'un événement de groupe daté directement (sans sondage, `group-events.service.ts:327-336`) n'est pas citée : où va la durée, et la plage de la séance est-elle écrite par `spanEnd` ?
- **`FULL_DAY`.** `spanEnd(date, 'FULL_DAY', 1)` n'est pas défini, alors que `startSlot` vide se lit `FULL_DAY` (P10-AD-4).
- **Réconciliation des options.** Elle se fait sur la clé `date|slot` (`poll.service.ts:622-668`). Si la durée change, elle conserverait les réponses de toutes les options inchangées. La règle « remplacer toutes ses options » doit dire explicitement qu'elle **contourne** `planOptions`.

**Correctif.** Préciser ces trois points dans la règle d'AD-10.

---

## LOW

### L1 — AD-7 et AD-12 : l'émission sur `user:{id}` du MJ n'atteint pas l'écran qui affiche la liste

Le calendrier de partie ne s'abonne qu'à `partie:{id}` (`calendar-view.ts:1856`). `user:{id}` ne l'est qu'en contexte personnel (`:1895`). Un masquage fait sur un appareil ne se propage donc pas en direct sur l'autre.

**Correctif.** Ou bien le calendrier MJ s'abonne aussi à `user:{id}`, ou bien on accepte l'absence de direct pour le masquage et on retire l'émission (à dire explicitement).

### L2 — AD-9 : colonne repliée et Destinée

Que se passe-t-il quand la Destinée s'active (`?poll` à l'arrivée, ou choix dans la liste ✦) alors que la colonne de droite est en dock ? Le plateau s'ouvre-t-il d'office ? Ce point est à trancher dans AD-9 ou dans le delta UX.

### L3 — AD-6 : « partie inaccessible »

En calendrier de partie, l'utilisateur sans accès reçoit le **refus de la page**, pas « calendrier normal + message » (FR-13 : « refus habituel »). La formule d'AD-6 ne vaut que pour le calendrier personnel.

### L4 — AD-4 et P9-AD-20

AD-4 restreint P9-AD-20 (« états dépendants du lecteur résolus côté client ») pour les **droits**, en mettant fin à `hostId === me` côté écran. C'est cohérent avec P10-AD-6, mais ce n'est pas déclaré dans le tableau des invariants hérités.

### L5 — memlog

La ligne 15 dit qu'`available-slots` est réservé au MJ, ce qui est faux (voir H4). La décision de la ligne 22 indique une clé `(userId, partieId, date, slot)` alors que la spine retient cinq colonnes avec `durationSlots`. Il faut aligner les deux pour la traçabilité.

### L6 — Structure

- **Questions ouvertes.** Il n'y a pas de section « Open Questions ». Les points H3 (échéance) et M5 (URL de la liste) devraient y figurer s'ils ne sont pas tranchés.
- **Enveloppe opérationnelle.** Environnements, migrations et absence de production sont couverts. L'observabilité et les journaux ne sont pas mentionnés : ajouter « inchangés » pour que la dimension soit explicitement décidée.
- **`PL-1`.** Lié alors qu'il n'existe pas encore au PRD. C'est déclaré, et donc acceptable, à condition que l'amendement du PRD reprenne cet identifiant.

---

## Grille : réponses point par point

| Critère | Évaluation |
| --- | --- |
| Points de divergence fixés sans en manquer | Partiel. Manquent les droits par famille (C1), la plage d'une séance datée côté lecteurs (C2), l'ordre plafond / masquage (H4), le chemin de la soirée isolée (H3), l'URL de la liste (M5) et le branchement du filtre (M3). |
| Rules applicables et efficaces | AD-4 et AD-11 ne le sont pas en l'état (C1, C2). AD-2 n'est pas réalisable sans casser `layer-imports.spec.ts` (H1). Les autres sont applicables. |
| Deferred sans divergence possible | Globalement bon. Le seul risque est « relancer un vote clos sans date », qui diverge du PRD sans figurer dans les écarts ⚠️ (M4). Le rendu sur plusieurs jours est renvoyé à l'UX, mais les données de la séance datée ne le sont pas (C2). |
| Ratification du code existant | Quatre affirmations sont inexactes : `?seanceId` (H2), `/guild-calendar` (H2), les chemins de soirée (H3) et `available-slots` (H4). Plus une règle de couches contredite (H1). Celles qui sont exactes : les routes `choose` / `extend` / `options`, `Seance.pollId`, `destinyPollId`, `?from` / `?to`, l'exclusion `admin` / `member` dans `/me/calendar`, `VISIBLE_POLL_WHERE`, le refus d'une séance déjà liée. |
| Couverture du PRD | FR-1 à FR-17 sont tous reliés. FR-12 (raison du message) est sous-spécifié (M2). FR-14 (liste restreinte) n'a pas de contrat (M5). La réponse au vote dans la vitrine est perdue (H5). |
| AD hérités | L'amendement de P9-AD-18 est déclaré, et c'est correct. Non déclarés : l'extension de P10-AD-15 (forme d'`OccupiedSpan`, C2), le déplacement nécessaire de la fonction de statut de P10-AD-18 (H1), et la restriction de P9-AD-20 (L4). P10-AD-1 est contredit par le diagramme d'AD-2 (H1). |
| Dimensions structurelles | Données, routes, droits, temps réel, état client, tests, environnements et migrations sont décidés. L'observabilité n'est pas mentionnée. Il n'y a pas de section de questions ouvertes (L6). |
