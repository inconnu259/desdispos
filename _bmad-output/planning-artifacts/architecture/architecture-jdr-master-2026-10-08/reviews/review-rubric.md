# Revue « grille » — Architecture Spine Palier 10 (2026-10-08)

Relecteur indépendant · 2026-10-09 · fichier relu : `ARCHITECTURE-SPINE.md` (status `draft`, updated 2026-10-09)
Grille : good-spine checklist (points de divergence, applicabilité des Rules, Deferred, ratification du code, couverture FR-1 à FR-18, respect des AD hérités, enveloppe de l'altitude « feature »).
Vérifications de fait faites dans `apps/api/prisma/schema.prisma`, `apps/api/src/{poll,parties,scenarios,availability,notifications,homme-dragon}/**`, `packages/shared/src/index.ts`.

## Verdict

L'ossature est bonne et fidèle au journal : `Event` + `Scenario` à identifiant partagé, `ownerId`, service de permission unique, migration unique et épic porte. Le spine **n'est pas encore prêt à faire contrat**. AD-1 est contredit par deux autres AD du spine et par le code. La représentation de la « plage continue » d'AD-4 n'est fixée nulle part. Six points de divergence restent ouverts : effets du retrait d'un membre (FR-6), gouvernance de la rencontre isolée, conversions de type en ralliement, ensemble des capacités, politique d'inscription par famille, lecture en lot des rôles.

---

## Critical

### C-1 — AD-1 (dépendance vers le bas seulement) est inapplicable : le spine et le code exigent des appels vers le haut
- **Emplacement :** AD-1, en tension avec AD-6, AD-15, le diagramme du paradigme et la Convention « Droits ».
- **Problème :** AD-1 range `poll/` et `availability/` en couche 1 et interdit qu'une couche importe un service d'une couche supérieure. Or :
  - AD-6 fait de `PermissionService` (couche 2) le seul décideur de tout droit, couche 1 comprise. Voter, lancer, prolonger et clore un vote sont des actions d'AD-6, appelées depuis `PollService`.
  - AD-15 dit en toutes lettres que les lectures de `availability.service` « passent par cette interface [d'`EventsService`] ou par `PermissionService` ».
  - AD-15 impose que toute écriture de date passe par « une seule fonction d'`EventsService` ». Fixer la date par sondage est une écriture de la couche 1.
  - Dans le code, `PollService` appelle déjà `PartiesService.getOwned/getViewable/notifyPartieSignalsChanged` (`poll.service.ts` l.34, 88, 116, 165) et écrit `Partie.nextSessionDate` et `reminderSentAt` (l.184-190). `PollModule` importe `PartiesModule` et `forwardRef(() => ScenariosModule)` (`poll.module.ts` l.13), et `PartiesModule` importe `AvailabilityModule` (`parties.module.ts` l.10).

  Le diagramme dessine une flèche pointillée C1 → C2 sans dire qui déclare l'interface. Une équipe ajoutera des `forwardRef`, une autre déplacera `poll/` en couche 2, une troisième inventera un port. On retrouverait la divergence qu'AD-1 veut empêcher, plus des cycles de modules Nest.
- **Correction proposée :** trancher explicitement, en une règle.
  - (a) `permissions/` est **transverse** (au-dessous ou à côté des trois couches) et appelable par toutes.
  - (b) L'interface étroite d'AD-15 est un **port déclaré en couche 1** (jeton d'injection et type dans `availability/` ou `@master-jdr/shared`), **implémenté** par `events/` : c'est une inversion de dépendance, aucun import de `EventsModule` par `AvailabilityModule`.
  - (c) Soit `poll/` passe en couche 2 (le sondage choisit la date d'un événement), soit « fixer la date » est orchestré par `EventsService`, qui appelle `PollService.close`, et jamais l'inverse. C'est déjà le cas aujourd'hui côté `PollController` (« c'est le contrôleur qui orchestre », `scenarios.service.ts` l.533-535).

  Mettre à jour le diagramme et la ligne « Une flèche pleine… » en conséquence.

### C-2 — AD-4 : la plage continue n'a aucune représentation fixée, et le cas courant de FR-8 (« date fixée + créneau ») n'est pas stockable aujourd'hui
- **Emplacement :** AD-4, Structural Seed (« Données »), AD-16 (migration), P9-AD-9 hérité.
- **Problème :** AD-4 dit qu'une `Seance` porte « un début (date + créneau) et une fin (date + créneau) ». Le modèle actuel ne porte que `Seance.dateValidee DateTime?`, **sans créneau** (`schema.prisma` l.559). Le créneau ne vit que sur `SessionPoll.chosenSlot`, avec repli `FULL_DAY` (règle héritée P9-AD-9, codée `availability.service.ts` l.736-738 et `scenarios.service.ts` l.557 et l.1128).
  - En mode « date fixée » (FR-8 : « un jour et un créneau »), il n'y a donc aucune colonne pour le créneau.
  - Le spine ne nomme aucune colonne (`startDate/startSlot/endDate/endSlot` ? `dateValidee` conservé ?), ne dit pas qui fait foi entre la séance et `poll.chosenDate/chosenSlot`, et la migration d'AD-16 ne mentionne pas ce changement.
  - AD-4 dit aussi que « l'événement déclare sa durée », alors qu'AD-3 laisse `dureeHeures`/`dureeSeances` dans l'extension `Scenario` (couche 3). Un événement de ralliement n'a donc pas de durée.

  Quatre unités vont écrire ou lire cette donnée (création d'événement, fixation de la date par sondage, plages occupées de la couche 1, rappels et e-mails). Chacune choisira sa forme.
- **Correction proposée :** ajouter au Structural Seed un extrait Prisma de `Seance`, avec les colonnes exactes de la plage, l'unique source de vérité (la séance, recopiée depuis le sondage à la fixation de la date) et le sort de `dateValidee`. Réviser explicitement la règle « créneau occupé » de P9-AD-9 en la signalant. Ajouter à AD-16 la recopie `poll.chosenDate/chosenSlot ?? dateValidee/FULL_DAY` vers les nouvelles colonnes. Enfin, soit placer la durée sur `Event`, soit dire qu'elle est différée au 10.4 avec la plage longue, et retirer « l'événement déclare sa durée » de la règle actuelle.

---

## High

### H-1 — FR-6 (retrait d'un membre, départ volontaire) n'est gouverné par aucune AD
- **Emplacement :** AD-6 et AD-7 (`Binds: FR-6`), Capability Map (ligne FR-3 à FR-6), AD-11.
- **Problème :** FR-6 exige plusieurs effets :
  - suppression des inscriptions et des votes **à venir** du membre, conservation des passés ;
  - libération de ses places, réservations comprises ;
  - annulation des événements à venir dont il est l'hôte, avec e-mail ;
  - départ volontaire avec le même effet.

  Aujourd'hui, `PartiesService.removeMember` ne fait que `membership.deleteMany` (`parties.service.ts` l.346-361). Inscriptions et votes restent, et il n'existe aucune route pour quitter une partie. Aucune AD ne dit qui exécute ces effets, ni dans quelle transaction, ni avec quel découpage « à venir / passé ». AD-11 ne dit pas non plus ce que deviennent les événements à venir hébergés par un compte supprimé dans un groupe qui survit : leur `ownerId` passe à vide, mais sont-ils annulés comme le veut FR-6 ? Deux stories (retrait par un admin, suppression de compte) risquent d'écrire deux procédures différentes.
- **Correction proposée :** nouvelle AD « Sortie d'un membre : une procédure unique ». Une méthode d'`EventsService`/`PartiesService` est appelée par le retrait, le départ volontaire et AD-11. Dans une transaction, elle supprime inscriptions et réservations des séances non passées, supprime les votes des sondages `OPEN`, et annule (`cancelledAt`) les événements à venir dont il est l'hôte. Les e-mails et `emit` partent après la transaction. Définir « à venir » : séance non datée, ou datée à partir du début du jour (même borne que `recalculateNextSession`). AD-11 l'appelle pour chaque groupe qui survit.

### H-2 — La rencontre isolée (ralliement `ONE_SHOT`) n'a pas de gouvernance décidée : la politique ne dépend que de la famille
- **Emplacement :** AD-6, AD-7, AD-3, AD-11.
- **Problème :** la matrice du PRD vaut pour le **groupe**. Pour l'isolée, « l'hôte (= créateur) est seul à agir ; les invités répondent, votent et se désinscrivent ». Or :
  - AD-6 choisit la politique par `family` seulement. AD-7 donne `ADMIN` au créateur de **tout** ralliement. Rien n'empêche donc de « nommer un admin » dans une isolée.
  - Le spine ne dit pas si les invités d'une isolée participent par `Membership` seul (invitation acceptée), ou aussi par `Inscription`. FR-2 parle de « se désinscrire ».
  - AD-3 impose « exactement un » événement par `ONE_SHOT`, mais FR-2 ouvre la fenêtre de création de l'événement **après** la création de la partie. Rien ne dit si l'événement est créé avec la partie (comme le `ONE_SHOT` de JDR aujourd'hui) ou par la fenêtre (une partie sans événement si on la ferme).
  - AD-11 et `GET /me/deletion-impact` ne nomment que les « groupes » et les « parties de JDR ».
- **Correction proposée :** faire choisir la politique par `(family, kind)`, et écrire la matrice de l'isolée (actions de l'hôte, actions de l'invité, « nommer admin » refusé). Décider de la forme de participation de l'isolée. Décider que l'événement unique est créé **dans la transaction de création de la partie**, la fenêtre de FR-2 servant alors à le compléter. Inclure les isolées possédées dans AD-11, avec l'effet décidé (suppression).

### H-3 — Statut `TERMINEE` d'un ralliement : non décidé, alors qu'AD-10 en dépend
- **Emplacement :** AD-9, AD-10, P9-AD-8 hérité.
- **Problème :** P9-AD-8 ne connaît que `closedAt`, décision humaine du MJ, pour `TERMINEE`. FR-2 dit qu'« une soirée isolée passée est marquée terminée et n'accepte plus de modification », ce qui est une dérivation par date, un changement de nature pour P9-AD-8. Pour un groupe, AD-9 dit qu'« il se clôt », mais aucune action « clore » ne figure dans la liste d'AD-6 (qui le fait : un admin ?). AD-10 n'autorise le masquage que pour `TERMINEE`/`ANNULEE` : sans règle, le masquage d'une isolée passée sera refusé par une équipe et accepté par une autre, et la garde « n'accepte plus de modification » sera écrite au cas par cas.
- **Correction proposée :** étendre P9-AD-8 en le signalant. Pour une isolée de ralliement, `TERMINEE` se dérive de « plage de l'événement unique passée » (calcul serveur, même endroit que `status`), et `PermissionService` refuse toute modification dans cet état. Pour un groupe, ajouter l'action `closePartie` (admin) à l'union `PermissionAction`.

### H-4 — AD-2 « à l'intérieur d'une famille, la règle actuelle s'applique » autorise des conversions de type qui écrivent la couche 3 en ralliement
- **Emplacement :** AD-2, AD-3 (« `CAMPAGNE_LINEAIRE` reste propre à la famille `jdr` »).
- **Problème :** la règle actuelle est `checkPartieKindTransition()` (`packages/shared/src/index.ts` l.192-240). Elle autorise `ONE_SHOT ↔ CAMPAGNE_EPISODIQUE ↔ CAMPAGNE_LINEAIRE`, avec les effets `CREATE_SCENARIO` et `SEED_PARTICIPANTS` (écriture de `Scenario` et de `ScenarioParticipant`). Appliquée telle quelle à un ralliement, elle crée un `Scenario` (contraire à AD-3 : « aucun événement de ralliement n'en a »), autorise `LINEAIRE` et transforme une isolée en groupe, alors que FR-2 dit qu'une isolée « n'est jamais rattachée à un groupe ».
- **Correction proposée :** `checkPartieKindTransition` reçoit la famille. En `ralliement`, toute conversion est refusée par un nouveau code de refus dans l'union, et `CAMPAGNE_LINEAIRE` est refusé à la création. La matrice reste unique (front et serveur).

### H-5 — L'ensemble des capacités n'est pas énuméré : la garde de couche 3 et les signaux d'AD-13 vont diverger
- **Emplacement :** AD-2 (« ensemble fermé, au moins `characters` »), AD-1, AD-13.
- **Problème :** AD-1 garde **chaque** service de couche 3 par capacité, via `PermissionService`. AD-13 émet chaque code de couche 3 « si le système en a la capacité ». Mais seule `characters` est nommée. Rien ne dit quelle capacité garde `scenarios`, `homme-dragon` (aujourd'hui `gameSystemId === 'ryuutama'` en dur : `homme-dragon.service.ts` l.485 et AD-23 parent), `xp-distributions`, `character-roles` ou `announcements`. Rien ne dit non plus quel code de signal dépend de quelle capacité. AD-3 lie de plus l'extension `Scenario` à la **famille** (« tout événement d'une partie de JDR »), pas à une capacité. Une équipe gardera par `family === 'jdr'`, une autre par `hasCapability('characters')`, une troisième par `gameSystemId`.
- **Correction proposée :** énumérer dans AD-2 l'union fermée `SystemCapability`, par exemple `scenarios | characters | xp | groupRoles | announcements | hommeDragon`. Donner la table capacité → module de couche 3 → codes `PartySignalCode`, et la valeur par système (Ryuutama : toutes ; Draconis : `scenarios` seulement ; ralliement : aucune). Dire qu'`hommeDragon` remplace le test `'ryuutama'` en dur, que la ligne `Scenario` existe si et seulement si `hasCapability(scenarios)`, et que la garde d'entrée passe par `PermissionService`.

### H-6 — La politique d'inscription diffère entre familles, mais aucune AD ne la fixe ; les « ayants droit » ne sont définis nulle part
- **Emplacement :** AD-6 (liste d'actions), AD-8, AD-12, Conventions.
- **Problème :** le code actuel :
  - refuse l'inscription hors `CAMPAGNE_EPISODIQUE` (`scenarios.service.ts` l.793) ;
  - la refuse si `inscriptionMax == null` (l.798) ;
  - fige les inscriptions dès qu'une date est fixée (l.804 et l.826).

  Le ralliement demande l'inverse sur trois points : participation « tous » sans capacité (FR-9), inscriptions tardives après fixation de la date (FR-10), et probablement inscriptions en `ONE_SHOT`. Le spine ne dit pas où est stockée la participation (« tous » = `inscriptionMax` nul ?), ni que ces trois gardes deviennent des décisions de politique par famille. L'action « voter » manque à la liste d'AD-6, alors que FR-11 la rend conditionnelle (« tous » : membres ; places limitées : inscrits ; isolée : invités acceptés). Les mêmes « ayants droit » alimentent la relance (AD-12), le rappel (AD-12 : « inscrits / membres »), l'e-mail de date fixée et l'e-mail d'annulation (FR-16 : « inscrits, invités et places réservées »). Quatre unités vont chacune calculer leur audience.
- **Correction proposée :**
  - Ajouter à AD-8 la représentation de la participation (par exemple `inscriptionMax null` = « tous » en ralliement), en signalant le double sens avec le JDR.
  - Faire des trois gardes ci-dessus des cellules de la matrice d'AD-6, avec `vote` dans `PermissionAction`.
  - Ajouter une fonction unique d'audience d'`EventsService`, par exemple `audienceOf(seanceId, purpose: 'vote' | 'reminder' | 'dateFixed' | 'cancel')`, seule source des destinataires et des votants, `RESERVED` compris ou non, à décider.

### H-7 — Les rappels par séance (AD-12, dans la porte d'AD-16) changent le JDR hors de la liste fermée d'exceptions de FR-13, sans que le spine le signale
- **Emplacement :** AD-12, AD-16 (« attentes des tests existants inchangées, interface de JDR identique »).
- **Problème :** aujourd'hui, un seul rappel part par partie, pour `nextSessionDate`, au MJ et à **tous** les membres, quel que soit le type (`notifications.service.ts` l.45-61). Avec un rappel par séance datée :
  - une campagne épisodique dont deux séances tombent dans les 24 h envoie deux rappels ;
  - « à ses inscrits / membres » peut restreindre les destinataires épisodiques aux inscrits, ce qui change le comportement.

  Le journal (entrée Décision 10) note « EXCEPTION de plus à “le JDR ne change pas” → à reporter dans FR-13 du PRD ». Le PRD n'a pas été modifié : FR-13 ne liste que sept exceptions, aucune sur les rappels. La porte exige pourtant un comportement JDR identique.
- **Correction proposée :** signaler explicitement dans AD-12 qu'il s'agit d'une exception à FR-13, et demander l'amendement du PRD (8e exception). Fixer les destinataires par famille et par type, idéalement par l'audience de H-6, en disant si l'épisodique reste « MJ + tous les membres ». Ajouter à la condition de passage d'AD-16 le test de caractérisation qui fige cette exception.

### H-8 — AD-6 n'a pas d'API en lot ni de résolution séance → événement, d'où une boucle par partie ou un rôle recalculé
- **Emplacement :** AD-6, P9-AD-3 et P9-AD-15 hérités, Convention « Lecture en lot ».
- **Problème :** l'API est `assert(partieId, userId, action, eventId?)` et `roleOf(partieId, userId)`. Or :
  - `GET /me/party-signals` et `listForUser` calculent le rôle de **N** parties : aujourd'hui en lot, par `mjId: userId` (`party-signals.service.ts` l.55). Avec `roleOf` unitaire, on boucle (contraire à P9-AD-3), ou l'on relit `ownerId` et `Membership.role` sur place, ce qu'AD-6 interdit (« calculé ici et nulle part ailleurs »).
  - Les routes de séance et de sondage adressent une `seanceId`/`pollId`, pas un `eventId` : rien ne dit qui résout séance → événement → partie.
  - Le contrat `GET /parties?role=mj|player`, déclaré « inchangé » par P9-AD-3, n'a pas de sens pour `admin|member`. Un propriétaire de ralliement qui a quitté l'office resterait « mj » par `ownerId`.
- **Correction proposée :** ajouter `rolesOf(userId, partieIds[]) → Map` (requêtes groupées) et une surcharge d'`assert` par `seanceId`/`pollId`, avec la résolution dans `PermissionService`. Décider le sort de `?role=` : `mj` = rôles organisateurs (`mj|admin`), `player` = `player|member`, ou dépréciation signalée.

---

## Medium

### M-1 — La convention « Temps réel » affaiblit P9-AD-14 sans le signaler
- **Emplacement :** Consistency Conventions, ligne « Temps réel ».
- **Problème :** P9-AD-14 exige, pour toute mutation qui change un signal de liste, `partie:{id}` **et** `user:{id}` pour **chaque membre concerné** (aujourd'hui `notifyPartieSignalsChanged`). La convention du spine ne prévoit `user:` que « de la personne visée » par une réservation ou une invitation. Or l'annulation (`PARTIE_ANNULEE`), la fixation d'une date, un admin nommé, un membre retiré ou un événement créé changent tous des signaux et des rôles de liste.
- **Correction proposée :** reprendre P9-AD-14 à l'identique (« toute mutation qui change un `PartySignalCode`, un `status` ou un `role` → `notifyPartieSignalsChanged` »), la personne visée s'ajoutant à cette émission sans la remplacer. Le masquage (AD-10) est un état personnel : rafraîchissement local, aucune émission.

### M-2 — Découpe `Event` / `Scenario` non spécifiée au niveau des colonnes ; `XpDistribution.mjId` oublié
- **Emplacement :** AD-3, Structural Seed, AD-16, Convention « Noms ».
- **Problème :** AD-3 ne dit pas si `Scenario` garde `partieId` (index `[partieId, status]`, très utilisé), ni où vont `title`, `description` et `createdAt`, ni comment s'écrit la relation 1-1 à clé partagée (`id @id` + `@relation(fields: [id])`). Le parent donnait un extrait Prisma ; ici il n'y a qu'un ERD. Par ailleurs, `XpDistribution.mjId` (FK `User`, `onDelete: Cascade`, `schema.prisma` l.446-447) n'est ni renommé ni traité, alors que la convention interdit le synonyme `mjId` et qu'AD-11 promet « jamais une cascade ».
- **Correction proposée :** extrait Prisma de `Event`, `Scenario` et `Seance` dans le Structural Seed, avec les colonnes déplacées et conservées. Décider pour `XpDistribution.mjId` : renommer en `authorId` (`SetNull`) ou le documenter comme exception. Mettre AD-16 à jour.

### M-3 — Le test « aucune lecture d'`ownerId` hors service » n'est pas opérable tel qu'écrit, et heurte P9-AD-23
- **Emplacement :** AD-6, P9-AD-23 hérité (« inchangé »).
- **Problème :** `mjId` est lu légitimement hors décision de droit, dans des filtres de requête et des projections : `account.service.ts` l.127, `party-signals.service.ts` l.55, `availability.service.ts` l.92, 711, 794. Surtout, AD-23 (parent) impose des `UPDATE` conditionnels atomiques `… WHERE "mjId" = :appelant` (`homme-dragon.service.ts` l.154 et 485), c'est-à-dire un droit décidé dans la requête, hors `PermissionService`, par conception (anti-course). Un test par recherche textuelle sera soit inutilisable, soit contourné, chaque équipe tranchant différemment.
- **Correction proposée :** définir le test : liste blanche de fichiers (`permissions/`, `events/` en écriture, migrations, projections DTO), et règle pour les écritures conditionnelles atomiques (prédicat fourni par `PermissionService`, par exemple `ownerFilter(userId)`, ou exception nommée pour AD-23). Signaler l'impact sur P9-AD-23.

### M-4 — AD-7 : « dernier admin » sans règle de concurrence
- **Emplacement :** AD-7, AD-11.
- **Problème :** deux admins qui quittent l'office en même temps, ou un admin qui quitte l'office pendant qu'un autre supprime son compte, lisent chacun « il reste un autre admin ». Le groupe se retrouve alors **sans admin et non supprimé**, état que FR-5 exclut.
- **Correction proposée :** toute opération qui retire un `ADMIN` (quitter l'office, retrait, départ, AD-11) se fait en transaction, avec verrou de ligne `SELECT … FOR UPDATE` sur `Partie`, et recompte sous ce verrou. C'est le motif déjà établi pour les inscriptions et le scénario « Courant ».

### M-5 — « Lancer le vote » (FR-11) suppose un état que `SessionPoll` n'a pas
- **Emplacement :** AD-12, AD-4, AD-6.
- **Problème :** FR-8 fait choisir les créneaux candidats à la création. FR-11 fait « lancer le vote avec une échéance » plus tard, après les inscriptions. Aujourd'hui, un sondage naît `OPEN` avec une échéance par défaut (`DEFAULT_POLL_TTL_MS`, `poll.service.ts` l.57). L'état « candidats posés, vote non lancé » n'existe pas : statut nouveau, `expiresAt` nul, ou sondage créé seulement au lancement ? AD-12 (relance un jour avant `expiresAt`) et AD-13 (`VOTE_EN_COURS_SANS_REPONSE`) en dépendent.
- **Correction proposée :** décider de la représentation (par exemple `PollStatus` + `DRAFT`, ou options stockées sur la séance jusqu'au lancement). L'échéance, choisie par l'hôte, est obligatoire au lancement. La relance et le signal ignorent un vote non lancé.

### M-6 — « Ralliement est un système » contredit la lettre du PRD et de l'addendum, sans signalement
- **Emplacement :** AD-2, frontmatter `sources`.
- **Problème :** FR-1 (« une soirée ou un groupe n'a pas de système »), FR-3 (« ni scénario, ni personnage, ni système ») et l'addendum §5 (« deux axes distincts ») disent l'inverse d'AD-2. Le journal montre que l'utilisateur a révisé ce point (2026-10-09), mais le spine ne le marque pas comme écart au PRD. Un développeur qui lit le PRD stockera `gameSystemId = null`. Point secondaire : la table `GameSystem` (seedée, FK de `Character`, `HommeDragon` et `ContentType`) doit-elle contenir `ralliement` ? Ce n'est pas dit.
- **Correction proposée :** ajouter à AD-2 une mention « Révise PRD FR-1/FR-3 et addendum §5 (décision utilisateur du 2026-10-09) ; `gameSystemId` vaut `'ralliement'`, jamais `null` », et demander l'amendement du PRD. Préciser que `ralliement` n'est **pas** seedé dans `GameSystem` (P5-AD-4 : le registre n'est pas un catalogue de contenu).

### M-7 — P9-AD-2 (e-mail des membres) n'est pas étendu aux admins
- **Emplacement :** Inherited Invariants (P9-AD-2), AD-6.
- **Problème :** `listMembers` ne renvoie l'e-mail qu'au MJ (`parties.service.ts` l.326 et 339). En ralliement, les admins gèrent les membres et invitent par e-mail (FR-4). Faut-il leur montrer les e-mails ? Le code lit `mjId === userId` : sans règle, le refactor décidera seul.
- **Correction proposée :** nommer l'action `seeMemberEmails` dans `PermissionAction` et décider : `jdr` = propriétaire ; `ralliement` = admins, ou personne. Signaler l'extension de P9-AD-2.

### M-8 — Réversibilité de la migration (FR-14) et consommateurs de la migration non traités
- **Emplacement :** AD-16, section « Environnements et exploitation ».
- **Problème :** le PRD suppose une migration « réversible tant qu'aucune soirée n'a été créée » (`[ASSUMPTION]`). Prisma n'a pas de migration descendante et AD-16 n'en dit rien. Les consommateurs à mettre à jour dans la même story ne sont pas listés, alors que le parent le faisait pour AD-23 : `prisma/seed-demo.ts`, fixtures e2e, requêtes brutes `$queryRaw` sur `"Scenario"`, `"Seance"` et `"mjId"`.
- **Correction proposée :** déclarer la migration **non réversible** (pas de production avant le Palier 11 ; retour arrière = restauration d'une sauvegarde de la base de dev) et le signaler comme écart à l'hypothèse de FR-14. Lister les consommateurs : seed, e2e, SQL brut (`scenarios.service.ts` l.404 et 811, `homme-dragon.service.ts`).

### M-9 — L'interface étroite d'AD-15 ne suffit pas au calendrier personnel (P9-AD-18) ni au masquage (AD-10)
- **Emplacement :** AD-15, AD-10, P9-AD-18 (non listé dans les Inherited Invariants).
- **Problème :** AD-15 ne fait transiter que « plages occupées + participants ». Or l'endpoint du calendrier personnel vit dans `AvailabilityModule` (P9-AD-18). Il affiche les séances de l'utilisateur **légendées** (nom de partie, titre : `availability.service.ts` l.794-811 et 963-977), les inscriptions ouvertes (filtre `kind === 'CAMPAGNE_EPISODIQUE'`, l.1082) et doit exclure les parties masquées (AD-10). Ces données sont de la couche 2.
- **Correction proposée :** ajouter P9-AD-18 aux invariants hérités et définir **deux** méthodes du port : `busyRanges(userIds, period)`, sans identité, pour P9-AD-9, et `myCalendarEntries(userId, period)`, avec identité, masquage appliqué et éligibilité à l'inscription calculée par la couche 2. Un `kind` n'est jamais lu en couche 1.

---

## Low

### L-1 — Annulation en famille `jdr` non décidée
- **Emplacement :** AD-9.
- **Problème :** `Event.cancelledAt` existe pour tout événement. Le MJ peut-il annuler un scénario, et un one-shot de JDR peut-il devenir `ANNULEE` ? Le PRD dit que le JDR ne change pas.
- **Correction proposée :** « dans ce palier, `cancelEvent` est refusé en famille `jdr` (cellule de la matrice) ».

### L-2 — « Préférences de notification existantes » (FR-12) : elles n'existent pas
- **Emplacement :** AD-12.
- **Problème :** aucun champ de préférence de notification n'existe sur `User` (`schema.prisma` l.15-50). Une story pourrait en inventer un.
- **Correction proposée :** l'écrire (« aucune préférence de notification n'existe ; rien à respecter dans ce palier ») ou la différer explicitement.

### L-3 — Ordre de la porte
- **Emplacement :** AD-16.
- **Problème :** `PermissionService` (étape 4) choisit sa politique par `family`, qui naît avec le registre (étape 5).
- **Correction proposée :** inverser les étapes 4 et 5, ou dire que l'étape 4 n'implémente que la politique `jdr`.

### L-4 — `DELETE /me` : limiteur de débit non nommé
- **Emplacement :** AD-11.
- **Problème :** l'appel prend un mot de passe et forme donc un oracle de force brute (`docs/security.md`).
- **Correction proposée :** « même throttler que les routes d'authentification ».

### L-5 — Partie annulée : signaux d'action
- **Emplacement :** AD-13.
- **Problème :** P9-AD-3 retire tout signal d'action d'une partie close. Rien n'est dit pour `ANNULEE`.
- **Correction proposée :** « une partie `ANNULEE` ne porte que `PARTIE_ANNULEE` ».

### L-6 — Deferred : rien ne permet de diverger, mais il manque des entrées
- **Emplacement :** Deferred.
- **Problème :** les entrées présentes sont saines. Il manque cependant le sort des hypothèses du PRD qui ne sont pas reprises : FR-6 (annulation des événements d'un hôte retiré, à trancher : voir H-1), FR-14 (réversibilité : voir M-8) et FR-8 (hôte immuable : couvert par AD-5).
- **Correction proposée :** les rattacher explicitement, à une AD ou à Deferred.

---

## Couverture FR (synthèse)

| FR | Statut | Note |
| --- | --- | --- |
| FR-1, FR-18 | Couvert | AD-2, AD-14 ; voir M-6 (écart au PRD) et H-4 (conversions) |
| FR-2 | Partiel | H-2 (gouvernance, événement unique), H-3 (terminée) |
| FR-3, FR-4, FR-5 | Couvert | M-4 (concurrence), M-7 (e-mails) |
| FR-6 | **Non couvert** | H-1 |
| FR-7 | Partiel | AD-11 ; isolées et événements hébergés manquants (H-1, H-2) |
| FR-8, FR-9 | Partiel | C-2 (créneau de la date fixée), H-6 (participation, inscriptions tardives) |
| FR-10, FR-11 | Partiel | C-1, M-5 (lancer le vote), H-6 (votants) |
| FR-12 | Couvert | H-6 (audiences), H-7 (rappels JDR), L-2 |
| FR-13, FR-14 | Couvert | H-8, M-3, M-8 |
| FR-15 | Couvert | Conventions |
| FR-16 | Couvert | L-1 |
| FR-17 | Couvert | dépend de H-3 |

## Enveloppe opérationnelle

La section « Environnements et exploitation » est présente et cohérente avec le parent : pas de service ni de variable nouveaux, Palier 11 différé. Deux compléments sont attendus : la non-réversibilité et le retour arrière de la migration unique (M-8), et le limiteur de débit de `DELETE /me` (L-4). Rien à redire sur la tâche horaire : même garde de non-chevauchement, une seule instance en développement.
