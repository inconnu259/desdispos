---
type: review-adversarial
target: ARCHITECTURE-SPINE.md (Palier 10 — Soirées entre amis)
date: '2026-10-09'
reviewer: relecteur adversaire (sous-agent)
method: "paires d'unités qui respectent chaque AD à la lettre et se construisent pourtant de façon incompatible"
evidence: "schema.prisma, scenarios.service.ts, poll.service.ts, poll.controller.ts, availability.service.ts, notifications.service.ts, parties.service.ts, party-signals.service.ts, participant-count.util.ts, packages/shared/src/index.ts, partie-detail.ts (web), PRD 2026-10-08"
---

# Revue adversaire — Architecture Spine, Palier 10

## Verdict

Le spine fixe correctement les **noms** et un découpage en couches convaincant **sur le papier**. Mais il ne
tient pas ce qu'il promet : la couche 1 doit appeler la couche 2 alors qu'AD-1 l'interdit. La forme de la
date d'une séance a deux définitions incompatibles, l'une dans AD-4 et l'autre dans six lecteurs du code
actuel. Le nombre d'admins n'est protégé par aucun verrou. L'anti-spoil reste en couche 3 alors que les
données qu'il protège descendent en couche 2. Le créateur d'un ralliement est à la fois `ownerId` **et**
`Membership`, ce que chaque formule « propriétaire + membres » du code compte deux fois. Deux équipes
disciplinées, qui citent chacune les AD mot pour mot, livreront des pièces qui ne s'emboîtent pas. **Le
spine n'est pas prêt à servir de contrat de construction.** Il faut au minimum 6 AD nouveaux ou resserrés
(C1 à C6) avant la porte.

Classement : **6 critical, 12 high, 9 medium, 4 low.**

---

## CRITICAL

### C1 — La couche 1 doit appeler la couche 2, qu'AD-1 lui interdit d'importer : trois architectures concurrentes

**AD visés :** AD-1, AD-6, AD-12, AD-15, P1-AD-2.

**Faits du code.**
- `PollService` (couche 1, `poll/`) importe aujourd'hui `PartiesService`. Il l'appelle pour `getOwned`,
  `getViewable` et `notifyPartieSignalsChanged`.
- `PollService.choose()` écrit directement `Partie.nextSessionDate` et `Partie.reminderSentAt`.
- Le recalcul de `nextSessionDate` est orchestré par **le contrôleur** `PollController`, qui injecte
  `ScenariosService` par `forwardRef`.
- `AvailabilityService` ne peut pas injecter `PartiesService` : il y aurait un cycle de modules, que
  `participant-count.util.ts` documente explicitement.

**Ce que dit le spine.**
- AD-1 : « une couche n'importe jamais un service d'une couche au-dessus ».
- AD-6 : `PermissionService` (couche 2) est « le seul à décider d'un droit ». Les droits concernés incluent
  « lancer / prolonger / clore un vote, fixer la date ».
- AD-15 : `availability.service` passe « par cette interface ou par `PermissionService` ».
- AD-15 : `nextSessionDate` est recalculé par « une seule fonction d'`EventsService` ».

**Paire d'unités.**
- **Unité A, story « PermissionService ».** L'équipe injecte `PermissionService` dans `PollService` et
  `AvailabilityService` (AD-6 et AD-15 le demandent). Elle casse le cycle par `forwardRef`. AD-1 est violé
  à la lettre, mais AD-15 le prescrit explicitement (« ou par `PermissionService` »).
- **Unité B, story « extraction d'Event ».** L'équipe respecte AD-1 : `PollService` ne garde plus aucun
  droit et devient de la pure persistance. La garde passe dans `EventsService`, qui enveloppe les appels
  de vote.
- **Résultat.** Les routes historiques `parties/:id/poll/:pollId/vote|choose|options` de `PollController`
  restent exposées. Elles ne sont plus gardées dans B, ou gardées autrement dans A. Le recalcul de
  `nextSessionDate` reste dans un contrôleur (violation de P1-AD-2) ou part dans `EventsService`, que
  `PollService` ne peut pas appeler.

**Conséquences.**
- Deux chemins de mutation du vote coexistent, avec deux gardes différentes.
- `Seance.reminderSentAt` (AD-12) n'est remis à zéro par personne quand une date de vote change.
  `PollService` ne connaît pas `Seance` (P2-AD-2, cité dans le code), et le recalcul vit ailleurs.

**AD à créer — « Ports de la couche 1 ».**
> **Rule :** La couche 1 n'importe aucun module de couche 2. Elle déclare des **ports**, c'est-à-dire des
> jetons d'injection définis dans `availability/` ou `poll/` : `OccupiedRangesPort` (plages + participants,
> AD-15) et `PollGuardPort` (`assertCanVote`, `assertCanManagePoll`, `onDateChosen(pollId)`). La couche 2
> (`EventsModule`) **fournit** leur implémentation. Les routes de mutation d'un sondage rattaché à une
> séance sont servies par la couche 2, qui appelle `PermissionService.assert`, puis `PollService` (pure
> persistance), puis `EventsService.recomputeNextSession` et la remise à zéro de `Seance.reminderSentAt`,
> **dans cet ordre et dans le même service**. Aucun contrôleur n'orchestre deux services. La phrase
> d'AD-15 « ou par `PermissionService` » est supprimée.

---

### C2 — La date d'une séance a deux formes : AD-4 (début/fin + créneau) contre `poll.chosenDate ?? dateValidee` partout

**AD visés :** AD-4, AD-12, AD-15, AD-16.

**Faits du code.**
- `Seance` n'a **ni créneau ni plage**, seulement `dateValidee DateTime?`. Le créneau n'existe que sur
  le sondage (commentaire explicite dans `scenarios.service.ts` : « Le créneau n'existe QUE sur le vote »).
- La date effective `poll.chosenDate ?? dateValidee` est recalculée dans au moins **six** endroits :
  `recalculateNextSession`, `inscrire`/`desinscrire` (gel), `toEnrichedDto`, `getSeanceDerivedUnavailability`,
  `getMyCalendar` et `party-signals`.
- Ces lecteurs ne s'accordent même pas sur l'absence de créneau : `null` dans `recalculateNextSession`,
  `'FULL_DAY'` dans `availability.service`, rien d'affiché dans `NotificationsService.formatSessionDate`.

**Ce que dit le spine.** AD-4 décrète une séance « début (date + créneau) et fin (date + créneau) ».
AD-16 énumère la migration sans **jamais** créer ni remplir ces colonnes.

**Paire d'unités.**
- **Unité A, story « date fixée » du ralliement (FR-10).** L'équipe ajoute
  `Seance.startDate/startSlot/endDate/endSlot` (AD-4) et les écrit directement, sans sondage.
- **Unité B, story « rappels par séance » (AD-12).** L'équipe lit la date de la séance comme le code
  existant, `poll.chosenDate ?? dateValidee` (forme établie, « comportement constant », AD-16).
- **Résultat.**
  - Un ralliement à date fixée n'a **ni rappel, ni `nextSessionDate`, ni indisponibilité dérivée, ni gel
    des inscriptions**.
  - Côté JDR, une date choisie par sondage n'est jamais recopiée dans les nouvelles colonnes, sauf si
    quelqu'un décide de le faire.
  - Le moment où l'on « recopie » est lui-même indécidable : à `choose()`, que la couche 1 ne peut pas
    faire (C1) ? à la lecture ?

**AD à resserrer — AD-4 + AD-16.**
> **Rule :** `Seance.startDate`, `startSlot`, `endDate`, `endSlot` sont **la seule** source de la date
> d'une séance. `dateValidee` est supprimé par la migration d'AD-16, qui remplit les nouvelles colonnes
> ainsi :
> - début = `poll.chosenDate`/`chosenSlot` si présent ;
> - sinon `dateValidee` avec le créneau `FULL_DAY` ;
> - fin = début.
>
> Choisir une option de sondage **écrit** ces colonnes, en couche 2 (C1). Une séance sans créneau n'existe
> plus. Une fonction partagée unique `seanceRange(seance)` est interdite : il n'y a plus rien à dériver.

---

### C3 — Fuite anti-spoil : titre et description descendent en couche 2, le statut `BROUILLON` reste en couche 3

**AD visés :** AD-1, AD-3, AD-14, AD-15.

**Ce que dit le spine.** AD-3 place `title` et `description` sur `Event` (couche 2), et le statut
anti-spoil (`BROUILLON`/`A_VENIR`/…) sur `Scenario` (couche 3). AD-1 interdit à la couche 2 de lire la
couche 3.

**Paire d'unités.**
- **Unité A, `EventsController` (AD-14).** `GET /parties/:id/events` liste les `Event` de la partie,
  gardés par `PermissionService.assert(…, 'voir')`. Rien n'interdit l'appel sur une partie de **JDR** :
  AD-14 dit que la route « sert le ralliement », sans la refuser au JDR. La liste renvoie les titres et
  descriptions des scénarios en `BROUILLON`, ce qui est un **spoil** complet pour un joueur.
- **Unité B, rappel par séance (AD-12) ou annulation (FR-16).** Le gabarit d'e-mail neutre affiche le
  titre de l'`Event`, qu'il lit en couche 2. Même fuite, cette fois **par e-mail**.
- **Unité C, interface étroite (AD-15).** Elle reste propre (« sans identité »), mais `getMyCalendar`
  affiche aujourd'hui `scenarioTitle` (voir M9).

**AD à créer — « Visibilité d'un événement portée par la couche 2 ».**
> **Rule :** `Event` porte une colonne `visibility` (union fermée `'HIDDEN' | 'TITLE_ONLY' | 'FULL'`). Elle
> est écrite **uniquement** par la couche 3 (`ScenariosService`) à chaque transition anti-spoil, ce qui est
> une écriture descendante autorisée. Un événement de ralliement vaut toujours `FULL`. Toute projection de
> couche 2 (DTO, e-mail, calendrier, signal) qui inclut `title` ou `description` filtre sur `visibility`
> pour quiconque n'est pas propriétaire de l'événement. `/parties/:id/events` répond 404 sur une partie de
> famille `jdr`.

---

### C4 — « Dernier admin » sans verrou : on arrive à zéro admin par trois chemins concurrents

**AD visés :** AD-7, AD-11, AD-6.

**Ce que dit le spine.** AD-7 : « Dernier admin = nombre de `Membership` `ADMIN` », sans aucun verrou
nommé. Le seul verrou du spine est celui de l'inscription (AD-8).

**Paires d'unités.**
- **Deux admins quittent l'office en même temps.** Story « quitter l'office », deux requêtes. Chacune
  compte 2 admins, aucune n'est la dernière, les deux passent `MEMBER`. Le groupe a **zéro admin** et
  vingt membres que plus personne ne gère.
- **Suppression de compte (AD-11) contre quitter l'office (AD-7).** L'admin X supprime son compte : la
  transaction voit Y admin, donc « il reste un autre admin », et retire X. En parallèle, Y quitte
  l'office : il voit X, donc il n'est pas le dernier. Résultat : zéro admin.
- **Un admin retire un autre admin (FR-4, « gérer les membres »).** A retire B pendant que B retire A.
  Résultat : zéro admin.
- `GET /me/deletion-impact` puis `DELETE /me` : l'aperçu est un instantané. Rien n'impose que la
  transaction réévalue la situation.

**AD à créer — « Verrou de l'ensemble des admins ».**
> **Rule :** Toute écriture qui modifie l'ensemble des `Membership` `ADMIN` d'une partie, ou qui supprime
> une partie, prend d'abord `SELECT id FROM "Partie" WHERE id = $1 FOR UPDATE`. Cela couvre : nommer,
> quitter l'office, retirer un membre, quitter le groupe et suppression de compte. Le décompte et la
> décision se font **ensuite**, dans la même transaction. La suppression de compte verrouille toutes les
> parties concernées **par `id` croissant**. L'aperçu d'impact n'engage rien : `DELETE /me` recalcule tout
> sous verrou.

---

### C5 — La politique choisie par `family` seule ignore `kind` : une rencontre isolée hérite des règles du groupe

**AD visés :** AD-6, AD-7, AD-3, AD-11.

**Ce que dit le spine.** AD-6 : « La politique est choisie par `family` ». Pour `ralliement`, les admins
gèrent la partie et les membres proposent. AD-7 : « À la création d'un ralliement », c'est-à-dire isolé
**ou** groupe, le créateur est `ADMIN`. Or le PRD (matrice FR-13) dit que, pour une soirée isolée,
« l'hôte (= créateur) est seul à agir ».

**Paire d'unités.**
- **Unité A, `PermissionService`, politique `ralliement` à la lettre d'AD-6.** Elle autorise un invité
  accepté (`MEMBER`) d'une isolée à « proposer un événement » et le créateur à « nommer un admin ».
  Elle autorise aussi l'admin nommé à annuler l'événement unique et à gérer les invités.
- **Unité B, `EventsService` (AD-3 : une isolée contient « exactement un » événement).** Elle refuse le
  second événement par une garde d'invariant, en 400 ou 409. La matrice de tests d'AD-6 attend pourtant
  un 403. Deux codes d'erreur existent pour le même refus.
- **Le créateur d'une isolée quitte l'office.** Il est le dernier admin, et AD-7 dit que cela « supprime
  le groupe ». Une rencontre isolée disparaît donc parce que son hôte a cliqué « quitter l'office », un
  bouton qui ne devrait pas exister pour elle.
- AD-11 ne parle que de « groupes » et de « parties de JDR » (voir H1). L'isolée tombe entre les deux.

**AD à resserrer — AD-6.**
> **Rule :** La politique est indexée par **(`family`, `kind`)**. Trois politiques sont fermées : `jdr`,
> `ralliement×ONE_SHOT` (isolée) et `ralliement×CAMPAGNE_EPISODIQUE` (groupe).
> - Pour l'isolée, seul le propriétaire agit (gérer les invités, modifier, annuler, lancer et fixer le
>   vote). Les actions « nommer un admin », « quitter l'office » et « proposer un événement » sont
>   **refusées (403)**.
> - Un invariant de cardinalité (un seul événement) se vérifie **aussi** dans `PermissionService`, avec
>   le même code d'erreur.

---

### C6 — Le créateur d'un ralliement est à la fois `ownerId` et `Membership` : toutes les formules « propriétaire + membres » doublent

**AD visés :** AD-5, AD-7, AD-15, AD-6.

**Faits du code.** Le code entier repose sur l'invariant « le MJ n'a jamais de `Membership` ».
- `participantCount() = memberships + 1`, « le MJ compte ».
- `resolveParticipants()` renvoie `[mj, ...memberships]`.
- `listForUser(userId, 'mj' | 'player')` sépare deux listes, par `mjId` et par `Membership`.
- Le web filtre `members().filter(m => m.userId !== mjId)`.
- `getSeanceDerivedUnavailability` prend `partie.mjId` comme participant **de toute séance de la partie**.

**Ce que dit le spine.** AD-7 donne au créateur d'un ralliement un `Membership ADMIN` **en plus** de
`Partie.ownerId`.

**Paire d'unités.**
- **Unité A, story « création d'un ralliement » (AD-7).** Elle crée l'`ADMIN`.
- **Unité B, porte AD-16, renommage `mjId` → `ownerId` à comportement constant.** Elle garde les formules
  telles quelles.
- **Résultat.**
  - L'effectif d'un groupe est faux de +1 : le dénominateur du vote passe de 5/5 à 5/6.
  - La partie apparaît **deux fois** dans la liste, côté « mj » et côté « player ».
  - Le roster web **masque le créateur**.
  - L'interface étroite d'AD-15, si elle reprend la règle actuelle (« propriétaire de la partie +
    inscrits » pour `CAMPAGNE_EPISODIQUE`), rend le **créateur du groupe indisponible pour chaque
    événement de chaque membre**.
  - Après AD-11 (`ownerId` vidé), `participantCount` compte un fantôme. `findUnique({ id: partie.ownerId })`
    plante sur `null`.

**AD à créer — « Qui est dans une partie ».**
> **Rule :** Une seule fonction de couche 2, `participantsOf(partieId)`, avec sa version en lot
> `participantsOfMany`, définit l'effectif :
> - **en `jdr`** : propriétaire + `Membership` ;
> - **en `ralliement`** : `Membership` seuls, le propriétaire n'étant **qu'un fait historique**.
>
> `participantCount`, `resolveParticipants`, `listForUser` et le roster web s'alignent sur elle. Le
> participant d'une plage occupée (AD-15) est **`Event.ownerId` (l'hôte) + les inscrits** de la séance,
> jamais `Partie.ownerId`. La liste d'accueil est **une** liste, dédoublonnée par `partieId`.

---

## HIGH

### H1 — Suppression de compte : événements orphelins, rencontres isolées oubliées, et une cascade qui contourne FR-6

**AD visés :** AD-11, AD-5, AD-9.

**Ce que dit le spine.** AD-11 ne traite que deux cas : (a) les parties JDR possédées, (b) « chaque
groupe où l'on est admin ». Or :
- **Un simple membre** qui supprime son compte perd ses `Membership`, `Inscription` et `PollVote` par
  cascade (`onDelete: Cascade` sur `User`). AD-11 l'interdit pourtant dans son titre (« jamais une
  cascade »).
- Ses **événements hébergés** gardent `Event.ownerId = NULL` (SetNull, AD-5). Plus personne ne peut les
  modifier, lancer, prolonger ou clore le vote, ni fixer la date : la matrice réserve ces actions à
  l'hôte. Le sondage ouvert reste ouvert **pour toujours**, avec sa relance.
- FR-6 dit que les événements à venir d'un hôte qui part sont **annulés, avec e-mail**. La procédure de
  « retrait d'un membre » et celle de suppression de compte divergent donc.
- La **rencontre isolée** du compte supprimé n'est ni dans l'aperçu ni dans la procédure. Selon que
  l'équipe la lit comme « groupe » ou non, elle est soit supprimée **sans avertissement**, soit laissée
  à zéro admin avec un propriétaire `NULL`.
- « Les émissions temps réel partent après la transaction » : après le commit, les `Membership` ne sont
  plus là pour calculer les destinataires.

**Paire d'unités.** La story « FR-6 retrait d'un membre » (`PartiesService`) annule les événements
hébergés et prévient les inscrits. La story « AD-11 » (`AccountModule`) laisse faire la cascade. Deux
procédures de départ coexistent, et elles ne produisent pas le même état.

**AD à resserrer — AD-11.**
> **Rule :** La suppression de compte appelle, pour **chaque** partie où le compte est membre ou
> propriétaire, la **même** procédure de départ que FR-6 : annulation des événements à venir hébergés,
> libération des places, retrait des votes à venir. Cette procédure est une méthode unique,
> `PartiesService.departMember(tx, partieId, userId)`. Pour les isolées : propriétaire = seul admin,
> donc l'isolée est supprimée et **listée dans l'aperçu**. Les destinataires des émissions et des e-mails
> sont **collectés dans la transaction** et utilisés après. Aucune ligne d'appartenance ne disparaît par
> cascade de `User`.

### H2 — Rappels par séance : destinataires, annulés et comportement JDR, quatre lectures

**AD visés :** AD-12, AD-16, AD-9.

**Ce que dit le spine.** AD-12 dit « envoie la veille le rappel de **chaque séance** datée, à ses
inscrits / membres ». Ce texte laisse quatre lectures ouvertes.
1. **« inscrits / membres »** : laquelle s'applique, et quand ?
   - En JDR épisodique, le code actuel envoie à **tous les membres + MJ** (au niveau de la partie). Si
     l'équipe choisit « inscrits », le comportement JDR change, alors qu'AD-16 exige qu'il reste constant.
   - En ralliement à places limitées, si elle choisit « membres », les non-inscrits reçoivent un rappel
     pour une soirée où ils ne vont pas.
   - Rien ne dit non plus si une place `RESERVED` est destinataire.
2. **Événements annulés** : AD-12 ne les exclut pas, AD-15 les exclut des plages. Une équipe envoie le
   rappel d'une soirée annulée.
3. **Comportement JDR** : aujourd'hui, une partie reçoit **un** rappel, celui de sa séance la plus
   proche. Par séance, une campagne épisodique avec deux séances dans les 24 h envoie **deux** e-mails.
   C'est un changement JDR hors de la liste fermée de FR-13.
4. **Report de la trace par la migration** : « la séance qui correspond à `nextSessionDate` ». Plusieurs
   séances peuvent avoir la même date (épisodique), et la séance n'a pas de créneau (C2). Une équipe
   marque la première, une autre toutes : un doublon de rappel part le lendemain de la migration, ce
   qu'AD-12 prétend justement empêcher.
5. **Remise à zéro de `Seance.reminderSentAt`** quand la date d'une séance change : personne n'en est
   chargé (C1).

**AD à resserrer — AD-12.**
> **Rule :** Les destinataires du rappel d'une séance sont `participantsOfSeance(seanceId)` (même fonction
> que les plages occupées d'AD-15) : hôte + `Inscription` (`CONFIRMED` **et** `RESERVED`) pour un
> événement à inscriptions, sinon les participants de la partie (C6). Les séances d'un événement annulé
> sont exclues. Pour le JDR, la porte fige le comportement par un test de caractérisation : **un rappel
> par partie et par jour**, destinataires inchangés. La migration pose `reminderSentAt` sur **toutes** les
> séances dont la date de début égale `nextSessionDate`. Toute écriture de date de séance remet
> `reminderSentAt` à `NULL` **dans `EventsService`**.

### H3 — Relance du vote : périmètre, fenêtre, échéance non appliquée, définition de « sans réponse »

**AD visés :** AD-12, AD-6, AD-13.

**Faits du code.** `castVote()` **ne vérifie pas `expiresAt`** : un sondage échu reste `OPEN` et accepte
les votes. FR-11 exige pourtant qu'on ne vote plus après l'échéance.

**Ce que le spine ne dit pas.**
- **Périmètre.** AD-12 met la relance sur `SessionPoll`, donc sur tous les sondages, y compris JDR. Les
  sondages JDR ont un `expiresAt` à 14 jours. Au lendemain de la migration, tous les sondages JDR ouverts
  dans leur dernier jour reçoivent un **e-mail nouveau**, ce qui est un changement JDR non listé.
- **Fenêtre.** « Un jour avant `expiresAt` » admet deux lectures : `expiresAt − 24h ≤ now < expiresAt`,
  ou `expiresAt − 24h ≤ now`. La seconde relance **tous les vieux sondages échus encore `OPEN`**.
- **« Ayants droit sans réponse ».** `PermissionService` n'expose que `assert` et `roleOf` : il ne sait
  pas **énumérer** les ayants droit. `NotificationsService` réécrit donc l'éligibilité (inscrits ou
  membres, accepté ou non, avant échéance) : c'est une seconde source de droit. « Sans réponse » veut
  dire « aucun vote » pour l'une, « une option sans réponse » pour l'autre (définition actuelle du signal
  `VOTE_EN_COURS_SANS_REPONSE`, `opt.votes.length === 0` sur **une** option).
- L'action « voter » **ne figure pas** dans la liste des actions d'AD-6.

**AD à créer — « Éligibilité au vote ».**
> **Rule :**
> - `PermissionService` expose `eligibleVoters(pollId): userId[]`, en lot. C'est **la seule** définition
>   d'« ayant droit », consommée par `castVote`, la relance et le signal `VOTE_EN_COURS_SANS_REPONSE`.
> - « Sans réponse » = aucune ligne `PollVote` de l'utilisateur sur ce sondage.
> - Un sondage dont `expiresAt < now` refuse le vote (dérivé, aucune tâche de fermeture).
> - La relance s'envoie si `expiresAt − 24h ≤ now < expiresAt` et `relanceSentAt IS NULL`, **pour la
>   famille `ralliement` seulement** dans ce palier.
> - `'vote'` entre dans l'union `PermissionAction`.

### H4 — Rôle : un appel par partie contre « lecture en lot », un hôte sans rôle, un invité sans vue, et un front qui lit `ownerId`

**AD visés :** AD-6, AD-13, P9-AD-3, P9-AD-20, conventions « Lecture en lot ».

**Problèmes.**
- **N+1 contre duplication.** L'API d'AD-6, `roleOf(partieId, userId)`, prend une partie à la fois. La
  liste et `party-signals` exigent une lecture en lot. Une équipe appelle `roleOf` en boucle et viole
  « Lecture en lot ». L'autre recalcule le rôle en lot dans `PartiesService`, ce qui viole « calculé ici
  et nulle part ailleurs ».
- **Branche binaire des signaux.** `party-signals` branche sur `role === 'player'` / `else` (MJ). Ajouter
  `'admin' | 'member'` à l'union fait tomber l'admin dans la branche MJ. Il reçoit alors
  `AUCUNE_DATE_NI_VOTE` et `AUCUN_MEMBRE_INVITE`, que n'arrête aucun garde de capacité AD-13 (ce ne sont
  pas des codes de couche 3). Le **membre hôte** d'un événement, lui, ne reçoit rien de ce qui concerne
  son événement : l'hôte est un rôle **par événement**, absent de l'union.
- **Invité en attente.** FR-2 : l'invité nominatif voit « Accepter / Décliner » **en tête de page**. Or
  `getViewable` exige propriétaire ou `Membership`, et l'union n'a pas de valeur `'invited'`. Une équipe
  ouvre la vue aux invitations `PENDING`, ce qui change aussi le JDR. L'autre laisse le 403 et casse FR-2.
- **Le front lit `ownerId`.** `partie-detail.ts` calcule `isMj = partie.mjId === me.id` et pilote les
  onglets et actions avec. AD-6 ne contraint que « hors de ce service » côté API. Une équipe web garde
  `isOwner` : le créateur qui a quitté l'office voit encore les actions d'admin, et un co-admin ne les
  voit pas. Le serveur, lui, répond l'inverse.

**AD à resserrer — AD-6.**
> **Rule :**
> - `PermissionService` expose `rolesOf(userId, partieIds[])` (en lot) et
>   `allowedActions(userId, partieId, eventId?)`.
> - Le rôle de partie est `'mj' | 'player' | 'admin' | 'member' | 'invited'`.
> - Chaque `EventDto` porte `can: PermissionAction[]`, calculé par le serveur.
> - Le web n'affiche une action que si elle figure dans `can` ou si `role` l'implique. **Aucun code web
>   ne compare `ownerId` ni `mjId` à l'utilisateur courant**, ce qui se vérifie par la même recherche
>   que côté API.
> - `party-signals` branche sur la **famille** puis sur le rôle, jamais par `else`.

### H5 — `assert(partieId, …, eventId)` ne dit pas qui vérifie que l'événement appartient à la partie : IDOR

**AD visés :** AD-6, AD-14.

**Paire d'unités.**
- **Unité A, `PermissionService`.** Elle vérifie le rôle dans `partieId` et l'hôte de `eventId`.
- **Unité B, `EventsService.update(eventId, dto)`.** Elle fait confiance à l'`assert` déjà passé.
- **Résultat.** Un utilisateur membre de A et hôte d'un événement E dans B appelle
  `PATCH /parties/A/events/E` : `assert` passe (membre de A, hôte de E) et E est modifié **via** la
  partie A. C'est la même faille que celle que `poll.service.ts` documente déjà pour `pollId`. Les
  routes de séance (`/scenarios/seances/:id/…`, AD-14) n'ont **pas** de `partieId` : chaque équipe le
  reconstitue à sa façon.

**AD à resserrer — AD-6.**
> **Rule :** `assert` prend un **sujet** (`{ partieId } | { eventId } | { seanceId } | { pollId }`) et
> **résout lui-même** la chaîne sujet → événement → partie. Il lève 404 si un `partieId` fourni ne
> correspond pas. Aucun appelant ne passe à la fois un `partieId` d'URL et un identifiant enfant non
> vérifié.

### H6 — `inscriptionMax`, gel par la date, `kind` : la même colonne et la même route ont deux sens selon la famille

**AD visés :** AD-8, AD-14, AD-6, AD-1.

**Faits du code.** `inscrire()` refuse :
- si `kind !== CAMPAGNE_EPISODIQUE` ;
- si `inscriptionMax == null` (« pas encore de capacité définie par le MJ ») ;
- et après une date validée (gel du roster). `desinscrire()` est gelé de la même façon.

**Ce que demande le PRD.** FR-9 et FR-10 : participation « tous » = **aucune limite**, inscriptions
tardives **après** fixation de la date, désinscription « à tout moment ».

**Ce que dit le spine.** AD-14 rend les routes `…/scenarios/seances/:id/inscription` « communes aux deux
familles », et AD-8 compte les places « sous le verrou existant ».

**Paire d'unités.**
- **Équipe JDR (porte, comportement constant).** Elle garde les gardes **dans le service**.
- **Équipe ralliement.** Elle met les règles dépendant de la famille dans `PermissionService` (AD-6 :
  « s'inscrire » est une action). Elle lit `inscriptionMax = null` comme « tous ».
- **Résultat.** Selon l'ordre des gardes, un ralliement « tous » est refusé (« pas de capacité ») ou une
  campagne JDR épisodique sans capacité devient illimitée. Les gardes d'état (gel, annulé, complet)
  vivent pour moitié dans `PermissionService` (AD-9 y met l'annulation) et pour moitié dans le service,
  **hors** du verrou pour les premières.
- **`RESERVED`.** Compte-t-il comme « inscrit » pour voter (FR-11), pour le rappel (H2), pour les plages
  occupées (AD-15), pour l'e-mail d'annulation (FR-16) ? Chaque équipe répond seule.

**AD à créer — « Règle d'inscription par famille ».**
> **Rule :**
> - La participation est une colonne explicite `Seance.participation` (`'ALL' | 'LIMITED'`).
>   `inscriptionMax` n'a de sens que pour `LIMITED`, et **`null` ne signifie jamais « illimité »**.
> - `PermissionService` décide des **rôles**. Les prédicats d'**état** (annulé, gelé, complet, échu) sont
>   évalués **dans la transaction verrouillée** du service propriétaire, par une table de règles
>   (famille → gel par la date oui/non) déclarée dans le registre (AD-2).
> - `RESERVED` compte comme inscrit pour la capacité, le vote, le rappel, les plages occupées et
>   l'annulation.

### H7 — Annulation contre inscription, réservation ou choix de date : pas de verrou commun, et une fermeture de sondage sans écrivain désigné

**AD visés :** AD-9, AD-8, P7-AD-2.

**Le trou de concurrence.** L'inscription verrouille la ligne `Seance` (AD-8). L'annulation écrit
`Event.cancelledAt`. Le refus de l'annulé est vérifié par `PermissionService` **avant** la transaction
d'inscription (AD-9). Une inscription concurrente à l'annulation s'insère donc après. Le destinataire
n'est pas dans la liste de l'e-mail d'annulation, déjà calculée, et il est inscrit à une soirée annulée.

**Paire d'unités sur la fermeture du sondage.** « Son sondage passe à `CLOSED` » :
- l'**équipe A** écrit `tx.sessionPoll.update` dans la transaction d'annulation, en contournant
  `PollModule`, seul écrivain de `SessionPoll` (P2-AD-2, encore cité dans le code) ;
- l'**équipe B** appelle `PollService.close()`, qui garde par `getOwned` (propriétaire seulement). Un
  **admin** qui annule l'événement d'un autre échoue, et l'écriture sort de la transaction.

**AD à créer — « Ordre des verrous ».**
> **Rule :** L'ordre des verrous est fixe : `Partie` → `Event` → `Seance` (`FOR UPDATE`, du parent vers
> l'enfant). L'annulation verrouille `Event` puis ses `Seance`. L'inscription et la réservation
> verrouillent `Event` **puis** `Seance`, et relisent `cancelledAt` sous verrou. La fermeture du sondage
> à l'annulation passe par `PollService.closeWithin(tx, pollId)`, sans garde : la garde a été faite par
> la couche 2. Les destinataires de l'e-mail sont lus sous verrou.

### H8 — Statut dérivé : `TERMINEE` et `ANNULEE` n'ont pas de formule pour le ralliement, et le JDR devient annulable

**AD visés :** AD-9, AD-10, P9-AD-8.

**Faits du code.** La formule actuelle est
`closedAt ? TERMINEE : hasScenario ? EN_COURS : A_VENIR`.

**Problèmes.**
- **Un ralliement n'a pas de `Scenario`.** Sans réécriture, une isolée reste `A_VENIR` à jamais. Il
  faudrait `hasEvent`, mais aucune AD ne le dit.
- **« Une soirée isolée passée est marquée terminée » (FR-2).** Deux lectures :
  - le statut se dérive de la **date**, et la formule JDR change (une partie JDR dont la séance est passée
    n'est **pas** terminée aujourd'hui) ;
  - il se dérive de `closedAt`, et quelqu'un doit clore. AD-10 interdit alors de masquer une isolée passée
    tant que l'hôte ne l'a pas close.
- **Priorité `ANNULEE` contre `TERMINEE`** quand `closedAt` et l'annulation coexistent : non tranchée.
- **AD-9 pose `cancelledAt` sur tout `Event`**, et la politique `jdr` autorise le propriétaire à
  « annuler un événement ». Un MJ peut donc annuler l'unique scénario d'un one-shot JDR, et la partie
  JDR devient `ANNULEE`. Ce changement JDR ne figure pas dans la liste fermée de FR-13.

**AD à resserrer — AD-9.**
> **Rule :** Une seule fonction `deriveStatus(partie, events)` en couche 2, en lot, appliquée dans cet
> ordre :
> 1. `ANNULEE` (isolée dont l'événement est annulé) ;
> 2. `TERMINEE` (`closedAt` posé, **ou** isolée de ralliement dont la plage est passée) ;
> 3. `EN_COURS` (au moins un `Event`) ;
> 4. `A_VENIR`.
>
> L'action « annuler un événement » est **refusée en famille `jdr`** dans ce palier.

### H9 — Masquage contre réouverture : une partie masquée redevient active, sans démasquage possible

**AD visés :** AD-10, AD-12, AD-15.

**Le trou.** AD-10 refuse le masquage hors `TERMINEE`/`ANNULEE` mais ne dit rien de l'inverse. Une
partie JDR **close** se rouvre (`closedAt` remis à `NULL`, cas prévu par `checkPartieKindTransition`,
« une partie clôturée se rouvre »). Le joueur qui l'avait masquée :
- ne la voit plus nulle part ;
- n'a pas de démasquage dans ce palier ;
- continue de recevoir rappels et relances (AD-12 ne filtre pas le masquage) ;
- a ses séances **retirées de ses indisponibilités dérivées** (AD-10 : « exclue … des créneaux »). Il
  apparaît donc **disponible** à l'heure de sa propre séance, dans le calendrier des autres groupes.

Il y a aussi une course entre le masquage (contrôle du statut) et une réouverture concurrente, sans
verrou. Enfin, `GET /parties/:id` sur une partie masquée : 404 ou 200 ? Les liens d'e-mail y mènent.

**AD à resserrer — AD-10.**
> **Rule :**
> - Le masquage n'agit **que sur les listes, les signaux et le calendrier personnel**. Il ne retire
>   jamais de plage occupée (AD-15) ni de destinataire d'e-mail.
> - Rouvrir une partie (`closedAt` → `NULL`) **supprime** ses lignes `PartieHidden`, dans la même
>   transaction.
> - L'accès direct par identifiant reste permis.

### H10 — Conversion de type à l'intérieur de la famille : la matrice JDR applique des effets JDR au ralliement

**AD visés :** AD-2, AD-3.

**Ce que dit le spine.** AD-2 : « à l'intérieur d'une famille, la règle actuelle s'applique ». Cette
règle actuelle, c'est `checkPartieKindTransition()`, dont les effets sont `CREATE_SCENARIO`,
`SEED_PARTICIPANTS` et `DEMOTE_EXTRA_COURANTS`, tous **de couche 3**.

**Paire d'unités.**
- **Équipe parties.** Elle laisse convertir une isolée en groupe (`ONE_SHOT` → `CAMPAGNE_EPISODIQUE`) :
  `SEED_PARTICIPANTS` crée des `ScenarioParticipant` pour un ralliement. Dans l'autre sens, à zéro
  événement, `CREATE_SCENARIO` crée une ligne `Scenario`. Les deux violent AD-3 (« aucun événement de
  ralliement n'en a »).
- **Équipe ralliement.** Elle autorise `CAMPAGNE_LINEAIRE` à un ralliement, puisque la matrice le permet
  et qu'AD-3 dit seulement que ce type « reste propre à la famille `jdr` », sans dire qui le refuse.
- Le PRD (FR-1) ne dit rien d'un changement de type pour le ralliement.

**AD à resserrer — AD-2.**
> **Rule :** La matrice de conversion est indexée par famille.
> - En `ralliement`, **aucune conversion de `kind`** n'est permise dans ce palier, et `CAMPAGNE_LINEAIRE`
>   est refusé à la création (400).
> - `checkPartieKindTransition` refuse toute entrée hors `jdr`.

### H11 — Colonnes de `Seance` à deux propriétaires, et AD-1 contournable par `PrismaService` global

**AD visés :** AD-1, AD-3, P1-AD-1.

**Deux propriétaires pour `Seance`.** AD-3 : « `EventsService` possède `Event` et ses séances ». Or :
- `Seance.compteRendu` est une notion de **couche 3** (AD-1 la range dans « scénario … compte-rendu »)
  stockée sur une table de couche 2, et écrite par `ScenariosService.setCompteRendu` ;
- `lieu`, `heureRdv` et `notePratique` servent aux deux familles, mais sont écrits par
  `ScenariosService.setInfosPratiques`.

L'équipe A laisse `ScenariosService` écrire `Seance` (écriture descendante, « autorisée »). L'équipe B
déplace l'écriture dans `EventsService`, que `ScenariosService` appelle. Deux chemins de mutation
existent pour une même colonne, avec des gardes différentes (`getOwned` et `assert`).

**AD-1 se contourne par Prisma.** AD-1 interdit d'**importer un service** d'une couche supérieure.
Comme `PrismaService` est global (P1-AD-1), n'importe quelle couche **lit n'importe quelle table** :
- `party-signals` (couche 2) lit `Character`, `HommeDragon` et `Scenario.resumeFin` ;
- `availability` (couche 1) lit `Partie.ownerId` et `Partie.kind` ;
- `getMyCalendar` lit `scenario.title` et `compteRendu`.

Tout cela respecte la lettre d'AD-1 et vide AD-15 de son sens.

**AD à resserrer — AD-1.**
> **Rule :** La règle de dépendance porte sur les **modèles Prisma**, pas seulement sur les services.
> Chaque modèle est assigné à une couche dans le Structural Seed (table modèle → couche). Une couche ne
> lit ni n'écrit le modèle d'une couche supérieure par `PrismaService`, ce qui se vérifie par un test de
> recherche sur `prisma.<model>` par dossier. `Seance.compteRendu` est déplacé sur une extension de
> couche 3, ou déclaré colonne de couche 3 écrite par `ScenariosService` seul. `lieu`, `heureRdv` et
> `notePratique` sont écrits par `EventsService` seul.

### H12 — Création composite `Event` + `Scenario` : ordre des transactions, émission prématurée, et « exactement un » à l'épreuve de la course

**AD visés :** AD-3, P7-AD-2.

**Paire d'unités.**
- **`EventsService.create()`.** Elle ouvre sa transaction, crée `Event` + `Seance` et **émet**
  `partie:{id}` en fin de mutation (P7-AD-2).
- **`ScenariosService.create()`.** Elle appelle `EventsService.create()`, **puis** crée `Scenario`. Les
  clients rechargent `/scenarios` entre les deux : l'`Event` existe sans `Scenario`, ce qui viole
  l'invariant d'AD-3, de façon **permanente** si la seconde écriture échoue. Le code a déjà accepté ce
  risque une fois (`createSeancePoll`, « non-atomique par construction »).

**Isolée et « exactement un événement ».**
- L'**équipe parties** crée l'`Event` dans `PartiesService.create()` (comme le JDR crée son scénario).
- L'**équipe events** le crée par la fenêtre qui s'ouvre ensuite (FR-2). L'isolée vit sans événement
  si la fenêtre est fermée.
- Deux `POST /events` concurrents sur une isolée créent deux événements : aucun verrou n'est nommé.

**AD à créer — « Écritures composées ».**
> **Rule :**
> - Les méthodes de couche 2 appelées par la couche 3 prennent un `tx` et **n'émettent pas**. L'appelant
>   le plus haut possède la transaction et émet une fois, après le commit.
> - `Event` et `Scenario` naissent dans la même transaction.
> - L'`Event` d'une isolée naît dans la transaction de création de la partie. La fenêtre FR-2 **édite**
>   cet événement, elle ne le crée pas.
> - La création d'un événement verrouille `Partie` (C4) avant de compter.

---

## MEDIUM

### M1 — Migration : trois lectures de « recopier chaque `Scenario` »

**AD visé :** AD-16.

**Les trois lectures.**
- `Scenario` garde-t-il `partieId`, `title`, `description` et `createdAt` ? AD-3 dit « ne porte que ce
  qui est propre au JDR », AD-16 ne dit pas de les supprimer.
- `markCourant()` verrouille `SELECT … FROM "Scenario" WHERE "partieId" = … FOR UPDATE` : si `partieId`
  disparaît, ce verrou doit passer par `Event`. Il recoupe alors le verrou d'annulation (H7) dans un
  ordre non défini, d'où un risque d'interblocage.
- L'index `Scenario(partieId, status)` disparaît ou non.

**Contradictions de nommage.** La convention interdit `mjId`, mais `XpDistribution.mjId` existe (en
cascade). Et `PartieDto.mjId`, `mjPseudo` et `mjDisplayName` sont dans **le contrat du front JDR**,
qu'AD-14 déclare inchangé.

**Réversibilité.** FR-14 demande une migration réversible, mais Prisma n'a pas de migration descendante
et le spine n'en parle pas.

**AD à resserrer — AD-16.**
> **Rule :**
> - Après la migration, `Scenario` = `id` (clé étrangère vers `Event.id`, `onDelete: Cascade`) + colonnes
>   de couche 3. `partieId`, `title` et `description` sont **supprimés**, et le verrou « un seul
>   `COURANT` » verrouille les lignes `Event` de la partie.
> - `PartieDto` passe à `ownerId` / `ownerPseudo` / `ownerDisplayName` **dans la même story** que le
>   renommage web (exception nommée à « interface inchangée »).
> - `XpDistribution.mjId` est renommé `authorId`.
> - La réversibilité est assurée par un script SQL inverse, versionné à côté de la migration.

### M2 — `nextSessionDate` : partagé par le groupe ou propre à l'utilisateur, début ou fin de plage, jamais effacé

**AD visé :** AD-15.

**Ce que dit le spine.** AD-15 persiste `nextSessionDate` par `Partie`, donc au niveau du groupe.

**Problèmes.**
- Dans un groupe, la « prochaine séance » est celle de n'importe quel membre. `PROCHAINE_SEANCE_CONNUE`
  s'affiche chez un membre qui ne va pas à cette soirée, et le tri « urgence » de la liste suit
  l'agenda des autres.
- La « plus proche plage » se mesure-t-elle au début ou à la fin ? Une plage en cours (commencée hier,
  finie demain) est exclue par la comparaison `>= startOfToday` sur le début.
- La date n'est jamais effacée une fois passée (dette différée, citée dans `party-signals`). Elle ne
  peut donc pas servir au `TERMINEE` d'une isolée (H8).
- AD-15 dit que le recalcul se fait à la « suppression d'un événement », alors qu'aucune action « supprimer
  un événement » n'existe dans l'union d'AD-6 ni dans le code.

**AD à resserrer — AD-15.**
> **Rule :** `nextSessionDate` reste au niveau du groupe et ne sert **qu'au** tri et au signal du
> propriétaire ou de l'admin. Les signaux d'un membre se calculent en lot sur **ses** inscriptions. La
> comparaison se fait sur la **fin** de plage. « Supprimer un événement » est soit ajouté à l'union avec
> sa politique, soit retiré d'AD-15.

### M3 — L'ordre de la porte met `PermissionService` avant le registre dont il dépend

**AD visés :** AD-16, AD-6, AD-2.

**Le problème.** AD-16 ordonne : `ownerId` → `Event` → **`PermissionService`** → **registre des
capacités**. Or AD-6 choisit la politique **par `family`**, qui vient du registre. AD-1 impose la garde
de couche 3 « par un appel au service de permission » sur la capacité. La première version de
`PermissionService` doit donc inventer une famille sans le registre. AD-2 l'interdit (« seules lectures
autorisées »), ou alors l'équipe code une politique JDR seule, à réécrire ensuite. La matrice « un test
de refus par cellule × familles » ne peut pas exister pour `ralliement` à la porte.

**AD à resserrer — AD-16.**
> **Rule :** Le registre (AD-2) précède `PermissionService` dans la porte. La matrice de la porte couvre
> `jdr` seul ; les cellules `ralliement` sont exigées par la première story de ralliement.

### M4 — Temps réel : l'annulation, les changements d'admin et la suppression de compte ne parviennent pas aux listes

**AD visés :** conventions « Temps réel », P9-AD-14.

**Le problème.** La liste n'écoute que `user:{id}` (P9-AD-14). La convention n'impose `user:{id}` que
pour la réservation et l'invitation. Annuler un événement change le statut (`ANNULEE`) et les signaux
de **tous** les membres, mais la convention n'émet que `partie:{id}`. Les listes restent donc périmées.
Même chose pour nommer un admin ou quitter l'office (le rôle change), pour la suppression d'un groupe
(AD-7, AD-11) et pour le masquage. La signature `notifyPartieSignalsChanged(partieId, mjId)` suppose un
propriétaire non nul.

**AD à resserrer — conventions.**
> **Rule :** Toute mutation qui change le statut, le rôle, l'appartenance ou un signal d'une partie émet
> `user:{id}` à chaque participant (C6), à partir d'une liste **collectée avant** la mutation si elle
> supprime des lignes. `notifyPartieSignalsChanged(partieId)` ne prend plus d'identifiant de
> propriétaire.

### M5 — `RESERVATION_A_CONFIRMER` pour une invitation en attente est impossible à émettre

**AD visés :** AD-13, P9-AD-3.

**Le problème.** `party-signals` renvoie une carte **par partie de l'utilisateur**, c'est-à-dire par
propriété ou `Membership`. Un invité `PENDING` n'a ni l'un ni l'autre : pas de carte, donc pas de signal.
Deux voies s'offrent aux équipes :
- **Équipe A** : elle ajoute les parties où l'on a une invitation en attente. Les invités JDR voient
  alors apparaître des cartes dans leur liste, ce qui est un changement JDR.
- **Équipe B** : elle limite le code aux places `RESERVED`, contredisant AD-13.

**AD à resserrer — AD-13.**
> **Rule :** Les invitations `PENDING` produisent une carte avec le rôle `'invited'` (H4), **pour la
> famille `ralliement` seulement**. En JDR, l'écran d'invitations actuel reste la seule entrée.

### M6 — Capacité, réservations et acceptation : des écritures hors du verrou d'AD-8

**AD visé :** AD-8.

**Les trous.**
- `setSeanceCapacity()` ne verrouille pas la ligne : l'hôte réduit la capacité **sous** le nombre de
  lignes déjà `RESERVED` ou `CONFIRMED`, ce qui donne « 7 / 6 ».
- Accepter (`RESERVED` → `CONFIRMED`) en même temps que l'hôte retire la réservation (`DELETE`) produit
  un P2025 brut ou une acceptation fantôme.
- L'hôte compte-t-il dans la capacité ? UJ-2 dit non (2 + 4 = 6), mais aucune AD ne l'écrit. Si l'hôte
  s'inscrit, il prend une place.
- L'hôte peut réserver la place d'un membre déjà `CONFIRMED` : un upsert le **rétrograde**.

**AD à resserrer — AD-8.**
> **Rule :**
> - Changer la capacité, réserver, accepter, retirer ou décliner prend le même verrou (`Event` → `Seance`,
>   H7). La capacité ne descend pas sous le nombre de lignes (409).
> - L'hôte n'a jamais de ligne `Inscription` : il est participant de droit (C6).
> - Réserver la place d'un utilisateur déjà inscrit est refusé (409).

### M7 — Le test « aucune lecture de `ownerId` hors service » n'est pas implémentable tel qu'écrit

**AD visé :** AD-6.

**Le problème.** Plusieurs codes légitimes lisent `ownerId` **sans décider d'un droit** :
- `EventsService` (hôte = participant, C6) ;
- `AccountService` (AD-11, vider `ownerId`) ;
- la projection des DTO (identité de l'hôte, P9-AD-2) ;
- `availability` (via l'interface).

Une recherche textuelle ne distingue pas « décider d'un droit » de « lire ». L'équipe A met une liste
blanche par fichier, et le test ne protège plus rien. L'équipe B fait de chaque lecture un appel à
`PermissionService`, qui devient un service de lecture générale.

**AD à resserrer — AD-6.**
> **Rule :** Le test interdit `ownerId` dans toute **condition** (`if`, `?:`, `where` d'autorisation)
> hors de `permissions/`. Il autorise les lectures **projetées** (`select`, DTO) et les écritures listées
> nommément (AD-11). La liste blanche est un fichier versionné, revu à chaque ajout.

### M8 — Actions des clés étrangères d'`Event`, redondance `Event.ownerId` / `Partie.ownerId` en JDR

**AD visés :** AD-3, AD-5.

**Le problème.** Le spine ne fixe pas les actions de suppression des clés étrangères suivantes :
- `Event.partieId` (supprimer un groupe, AD-7, suppose une cascade) ;
- `Scenario.id` → `Event.id` ;
- `Seance.eventId`.

En JDR, `Event.ownerId` recopie `Partie.ownerId` : il y a deux sources du « MJ ». Une équipe garde la
politique `jdr` sur `Partie.ownerId`, une autre sur `Event.ownerId`. Elles divergent dès qu'un script
ou un test crée l'un sans l'autre.

**AD à resserrer — AD-5.**
> **Rule :**
> - `Event.partieId`, `Scenario.id` et `Seance.eventId` sont en `onDelete: Cascade`.
> - En famille `jdr`, la politique ne lit **que** `Partie.ownerId`, et `EventsService` refuse un
>   `Event.ownerId` différent à l'écriture.

### M9 — Le calendrier personnel ne tient pas dans « l'interface étroite »

**AD visés :** AD-15, AD-1.

**Le problème.** `getMyCalendar` (couche 1) renvoie aujourd'hui `partieName`, `scenarioTitle`, `lieu`,
`heureRdv`, `notePratique` et `compteRenduManquant`, une notion de couche 3. L'interface étroite d'AD-15
ne fournit que « plages + participants ». L'équipe A élargit l'interface au fil des besoins, et elle
cesse d'être étroite. L'équipe B déplace `GET /me/calendar` en couche 2 sans que le spine le dise. Le
filtre du masquage (AD-10), qui exige la notion de partie, ne peut pas vivre en couche 1.

**AD à resserrer — AD-15.**
> **Rule :** `GET /me/calendar` est servi par la couche 2 (`EventsModule`), qui compose les déclarations
> de la couche 1 et ses propres projections filtrées (C3, AD-10). La couche 1 ne sert que les
> déclarations, les sondages et les indisponibilités **anonymes**.

---

## LOW

### L1 — Union `PermissionAction` : ni liste close, ni forme des codes

**AD visé :** AD-6.

AD-6 dit « au moins : … » et liste des actions **en français descriptif**. Elle omet « voter »,
« se désinscrire », « accepter / décliner une réservation », « supprimer le groupe », « quitter le
groupe » et « supprimer un événement ». Deux équipes créeront deux orthographes pour le même code
(`cancel_event` contre `ANNULER_EVENEMENT`).

**Rule :** L'union est **énumérée dans le spine**, en codes `SCREAMING_SNAKE` anglais comme les autres
unions. Toute action absente est une modification du spine.

### L2 — Fichiers sur disque à la suppression

**AD visé :** AD-11.

AD-11 décrit « une transaction », mais les couvertures, documents de scénario et portraits supprimés
avec les parties restent sur disque.

**Rule :** Les chemins sont collectés dans la transaction et supprimés **après** le commit, au mieux
(journal des échecs).

### L3 — `ralliement` dans le registre, mais pas dans la table `GameSystem`

**AD visé :** AD-2.

`GameSystemService` lit des lignes `GameSystem` en base, et `Character.gameSystemId` est une clé
étrangère vers cette table. L'équipe A amorce une ligne `ralliement` ; l'équipe B ne le fait pas, et un
appel au schéma de fiche sur un ralliement part en 404 ou en 500.

**Rule :** `ralliement` n'a **pas** de ligne `GameSystem`. Tout accès à `GameSystemService` est gardé
par `hasCapability(…, 'characters')`.

### L4 — Identité d'un propriétaire supprimé

**AD visés :** P9-AD-2, AD-5.

P9-AD-2 exige `pseudo` **et** `displayName` dans toute identité de DTO. Avec `ownerId = NULL`, une
équipe renvoie `null` et une autre une identité sentinelle « compte supprimé ».

**Rule :** Le DTO renvoie `owner: null` et le web affiche le libellé de thème « compte supprimé ».

---

## Synthèse des AD à créer ou resserrer

| # | Action | AD |
| --- | --- | --- |
| C1 | **Créer** « Ports de la couche 1 » ; supprimer « ou par `PermissionService` » d'AD-15 | AD-1, AD-15 |
| C2 | **Resserrer** : colonnes de plage comme seule source, remplies par la migration | AD-4, AD-16 |
| C3 | **Créer** `Event.visibility` écrite par la couche 3 ; `/events` en 404 pour `jdr` | AD-3, AD-14 |
| C4 | **Créer** le verrou `Partie FOR UPDATE` pour l'ensemble des admins et la suppression | AD-7, AD-11 |
| C5 | **Resserrer** : politique indexée par (`family`, `kind`) | AD-6 |
| C6 | **Créer** `participantsOf` ; l'hôte comme participant ; liste dédoublonnée | AD-5, AD-7, AD-15 |
| H1–H12 | Voir chaque section | AD-11, AD-12, AD-6, AD-8, AD-9, AD-10, AD-2, AD-1, AD-3 |
