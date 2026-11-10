---
type: architecture-review
lens: adversaire (paires d'unités conformes mais incompatibles)
target: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-20-p10-4/ARCHITECTURE-SPINE.md
inherits: _bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-08/ARCHITECTURE-SPINE.md
date: '2026-10-20'
verdict: 'À reprendre avant les stories : 3 trous critiques (droit « peut organiser », lecture des plages longues, frontière de couche de /me/open-polls)'
---

# Relecture adverse — Spine du Palier 10.4

Méthode : pour chaque trou, deux unités (stories ou modules) qui respectent **chaque AD à la lettre**
et livrent pourtant des comportements incompatibles. Les scénarios s'appuient sur le code actuel
(`apps/api/src`, `apps/web/src`, `packages/shared/src`). Chaque trou se termine par un AD nouveau ou
resserré (une phrase de Rule).

**Verdict.** La spine tient bien le partage atelier / vitrine et l'identité d'URL, mais trois trous
critiques laisseraient deux équipes construire des choses incompatibles : `canOrganize` est un seul
booléen calculé depuis des cellules de matrice qui ne disent pas ce que le serveur refuse ; la plage
longue est **écrite** proprement mais **lue** sur un seul créneau par tous les lecteurs actuels ;
`/me/open-polls` (couche 1) a besoin de trois données de couche 2 qu'aucun port ne fournit.

---

## CRITIQUE

### C1 — `canOrganize` : un booléen, trois matrices différentes, et des cellules qui mentent

**Paire A.** Story « `/me/open-polls` » : `canOrganize` = `PermissionService.rolesOf` en lot, puis
lecture de la cellule `POLL_CHOOSE` de la politique (AD-4 : « calculé par `PermissionService` à
partir de `POLL_CHOOSE`, en lot »). En ralliement, la cellule vaut `ADMIN_AND_MEMBERS`
(`permission.service.ts:288`) : **tous les membres** reçoivent `canOrganize: true`. Story « plateau »
(AD-13) : « Fixer la date… » appelle `PATCH …/choose`, qui re-décide sur l'événement
(`HOST_ONLY_WHEN_EVENT_TARGETED`, `PollService.chooseGroupDate` → `groupChoice.assertCanChoose`) :
**403 pour tout membre non hôte, administrateur compris**. Exactement le « bouton visible qui mène à
un refus » que AD-4 prétend empêcher. Il n'existe aucune API en lot qui applique les règles d'hôte
(`assert` est unitaire, `rolesOf` ne rend que des rôles).

**Paire B.** Story « `/me/datable-seances` » : `canOrganize` depuis `SEANCE_POLL_CREATE`
(AD-4, « rendez-vous »). En ralliement cette cellule vaut `NOBODY` (`permission.service.ts:270`) :
**aucun rendez-vous de ralliement n'est jamais « à dater »**. Or le seul cas datable en ralliement
est précisément la soirée isolée « date à fixer » (Story 41.2), qu'on date par `PATCH` d'événement
(`EventsService.updateHosted`, branche `pollMode && awaitingDate`, droit `EVENT_UPDATE` hôte seul).
Pendant ce temps le calendrier du groupe, qui « dérive de sa charge utile avec le même prédicat »
(AD-3), reçoit un `canOrganize` servi… par qui ? `EventCardDto` n'en porte pas ; le `canCompose`
existant compare `card.hostId === me` (`calendar-view.ts:541`).

**Paire C.** Un seul booléen couvre « Prolonger » (AD-4 le cite) : en JDR `POLL_EXTEND` vaut
`NOBODY`, mais le MJ a `canOrganize: true` (cellule `POLL_CHOOSE`) → bouton « Prolonger » → 403.
« Modifier les dates » relève de `POLL_OPTIONS_SET` (JDR) ou `EVENT_UPDATE` hôte (groupe), aucune
des deux n'est nommée.

**Correctif — AD-4 resserré :**
> **Rule:** Toute charge utile qui commande une action d'organisateur porte un objet
> `can: { propose, edit, choose, extend }` (et non un booléen unique), chacun résolu par une
> nouvelle méthode **en lot** `PermissionService.canMany(userId, action, targets[])` qui applique
> **toutes** les règles d'`assert` (cellule, `HOST_ONLY_*`, `HOST_OR_ADMIN_*`, capacité) sur une cible
> `{ eventId }` ou `{ seanceId }` — jamais sur `{ partieId }` seul ; la table action × famille est
> fixée dans `@master-jdr/shared` : `propose` = `SEANCE_POLL_CREATE` (jdr) / `EVENT_UPDATE` (ralliement),
> `edit` = `POLL_OPTIONS_SET` / `EVENT_UPDATE`, `choose` = `POLL_CHOOSE`, `extend` = `POLL_EXTEND` ;
> `EventCardDto` et la charge utile de l'atelier JDR portent le même objet, et le test de matrice
> vérifie que `canMany(...) === true` ⇔ l'écriture correspondante ne renvoie pas 403.

---

### C2 — Plages longues : écrites sur N créneaux, lues sur un seul partout

AD-11 dit : « prochaine séance, rappels, indisponibilités dérivées suivent P10-AD-4 et P10-AD-15
**sans changement** ». C'est faux dans le code actuel : tous ces lecteurs ne lisent que le départ.

**Paire A — écrivains concurrents de la fin de plage.** Story « choisir une option longue » :
`SeanceDatePort.chooseDate(tx, pollId, date, slot, durationSlots)` écrit `end = spanEnd(...)` (AD-11).
Story « modifier une conjonction » (inchangée, Story 40.2/40.6) : `updateHosted`, branche date fixée,
écrit **`endDate: input.seance.date, endSlot: input.seance.slot`** à chaque `PATCH`
(`events.service.ts:905`) — le contrôle `dateChanged` ne compare que le départ. Changer le lieu
d'une soirée de 3 créneaux la **tronque à 1 créneau**, en silence. Même chose pour `createInTx`
(`end = start`, ligne 388). AD-10 dit que la durée « est portée par le `PATCH` d'événement » mais la
durée vit sur `SessionPoll`, clos à ce moment-là.

**Paire B — indisponibilités dérivées et automate.** Story « ?span » (AD-11) : l'automate exige que
toute la troupe soit libre sur N créneaux. Mais `OccupiedSpan` = `{ date, slot }`
(`occupied-spans.port.ts`) et `occupiedSpansOf` ne pousse que `startDate/startSlot`
(`events.service.ts`, boucle `for (const seance of seances)`). Une séance de vendredi soir à dimanche
matin n'occupe ses joueurs **que vendredi soir** : l'automate d'une autre partie propose samedi.
Rien ne dit qui développe la plage : `events/` (implémenteur du port) ou `availability/` (qui habille
en `DeclarationLike` d'un jour).

**Paire C — affichage d'une séance datée longue.** AD-11 ne régit que les **options**. Une fois la
date fixée : le calendrier personnel lit `MyCalendarSeanceEntry` (`date`, `slot`, sans fin), filtré
par `startDate ∈ [from, to]` (`ownEventsOf`) — une séance du 31 au 1er disparaît en février ;
le calendrier du groupe lit `EventCardSeanceDto` (`date`, `slot`, sans fin) ; l'atelier JDR dérive la
date d'une séance de **`seance.poll?.chosenDate`** (`calendar-view.ts:621`), donc la fin s'y
calculerait par `chosenDate + durationSlots`, pendant que le personnel lit la plage de la `Seance` :
deux sources de la fin, contre P10-AD-4.

**Paire D — « en cours ».** `recomputeNextSession` ne garde que `startDate >= aujourd'hui` : une
séance commencée hier et finie demain n'est plus « prochaine » ; `updateHosted`, `cancelHosted` et
`chooseGroupDate` refusent « passée » sur le jour de **départ** ; `endedIsolatedPartieIds` lit
`endDate`. Deux définitions de « passée » pour la même plage.

**Correctif — AD-11 resserré + AD-14 nouveau :**
> **AD-11 Rule (ajout) :** Une fonction pure unique `spanSlots(date, slot, durationSlots)` de
> `@master-jdr/shared` est la **seule** énumération des créneaux couverts (automate, indisponibilités
> dérivées, estompe, `destinyDates()`, heatmap) ; `OccupiedSpansPort` rend des plages déjà
> développées créneau par créneau par `events/` à partir de `start…end` de la `Seance`.
>
> **AD-14 — Une plage datée se lit entière, s'écrit par un seul chemin. Rule :** Tout DTO qui
> expose une séance datée (`MyCalendarSeanceEntry`, `EventCardSeanceDto`, `SeanceDto`) porte
> `startDate/startSlot/endDate/endSlot` lus de la `Seance`, jamais de `poll.chosenDate` ; tout filtre
> de période teste le **chevauchement** de la plage ; « passée » = fin avant aujourd'hui et « en
> cours ou à venir » = fin ≥ aujourd'hui, partout (prochaine séance, refus d'édition, annulation,
> statut) ; tout écrivain de plage autre que `SeanceDatePort` conserve la durée existante
> (`end = spanEnd(nouveauDépart, durée actuelle)`), et aucune écriture ne pose `end = start` par
> défaut.

---

### C3 — `/me/open-polls` (couche 1) a besoin de la couche 2 sans port nommé

AD-2 place la route dans `poll/` (couche 1) et ne cite que deux sources : `OwnEventsPort` (parties,
noms) et `PermissionService.rolesOf`. Or la réponse exige :

- `seanceId` et le **titre du rendez-vous** (`Event.title`, sous anti-spoil de scénario) : données
  de `events/` ; `OwnEventsPort` ne rend que les séances **datées** de la période et les inscriptions
  ouvertes, jamais la séance non datée d'un sondage ouvert.
- `eligibleCount` : AD-2 dit « ceux de `eligibleVoters` » — fonction de `events/eligible-voters.ts`,
  donc **importation interdite** depuis `poll/` (P10-AD-1).
- « parties **actives** » (AD-3) : le statut de P10-AD-18 est calculé dans `parties/`
  (`toPartieDto`, non exportée, à partir d'un `progress` fourni par `events/`). `poll/` ne peut pas
  l'importer ; `events/` non plus (`parties/` importe déjà `events/` pour `leave()`).

**Paire.** Story « `/me/open-polls` » réimplémente « active » comme `closedAt == null` et compte les
ayants droit à partir des `Membership` ; story « `/me/datable-seances` » (dans `events/`) recode le
statut avec `cancelledIsolatedPartieIds` + `endedIsolatedPartieIds`. Une rencontre isolée terminée
par sa date apparaît dans la liste ✦ (vote possible) mais pas dans « à dater » ; deux définitions de
« partie active », exactement ce que P10-AD-18 interdit.

**Correctif — AD-15 nouveau :**
> **AD-15 — Contexte des sondages et statut par port. Rule :** `poll/` déclare
> `OpenPollContextPort.contextOf(userId, pollIds[])`, implémenté en lot par `events/`, qui rend par
> sondage `{ seanceId, rendezVousTitle, family, eligibleVoterIds, cancelled }` sous l'anti-spoil
> existant ; la dérivation du statut de partie (P10-AD-18) devient une fonction pure
> `partieStatus(closedAt, progress)` de `@master-jdr/shared`, le `progress` étant fourni en lot par
> `events/` (`progressOf(partieIds)`), et c'est la **seule** définition de « partie active » pour
> `/me/open-polls`, `/me/datable-seances` et `PartieDto`.

---

## MAJEUR

### M1 — Ayants droit et « a répondu » : deux définitions, deux plateaux qui ne s'accordent pas

- **Dénominateur JDR.** L'atelier JDR et l'ancienne couche `votes-en-cours` utilisent
  `membersCount` = MJ + membres (`participantCount`). `eligibleVoters()` ne connaît que les
  conjonctions (`hostId`, `inscriptionMax`, inscriptions) ; P10-AD-6 dit « JDR inchangé » sans
  fonction. Story « `/me/open-polls` » qui applique AD-2 à la lettre (« ceux de `eligibleVoters` »)
  à une campagne épisodique JDR (qui a une capacité) obtient MJ + inscrits confirmés ; l'atelier
  affiche MJ + tous les membres.
- **« A répondu ».** JDR : répondu = **toutes** les options (`getMissingVoters`, `poll.util.ts:8` ;
  signal `VOTE_EN_COURS_SANS_REPONSE`). Groupe : répondu = **au moins une** option
  (`respondentIds`, `event-card.util.ts:446`). Le plateau personnel affiche
  `eligibleCount − answeredCount` ; le plateau de l'atelier liste des noms par une autre règle.
  « 2 n'ont pas répondu » d'un côté, 4 noms de l'autre.

> **AD-2 Rule (ajout) :** Les ayants droit d'un sondage, toutes familles, sont donnés par une seule
> fonction `pollVoters(...)` de `events/` (JDR : MJ + membres, comme `membersCount` ; ralliement :
> `eligibleVoters`) et « a répondu » par une seule fonction pure `hasAnswered(votesDuVotant, optionIds)`
> de `@master-jdr/shared`, utilisée par `/me/open-polls`, les plateaux de l'atelier, `getMissingVoters`,
> `respondentIds` et les signaux de liste.

### M2 — Le DTO `OpenPoll` casse le vote depuis le calendrier personnel

AD-2 liste les options (`optionId, date, slot, yes, maybe, no`) et `me = { eligible, answered,
canOrganize }`, **sans `myAnswer` par option**. Le calendrier personnel vote aujourd'hui par le
sélecteur de réponse de la Story 36.7, qui lit `MyCalendarPollOption.myAnswer`. Story
« `/me/open-polls` » livre le DTO de l'AD ; story « liste ✦ / vote » ne peut plus afficher la réponse
courante — régression, ou ajout ad hoc d'un `userId`.

> **AD-2 Rule (ajout) :** Chaque option porte `myAnswer: VoteAnswer | null` (la réponse du seul
> lecteur, jamais celle d'un autre) ; c'est le seul champ dérivé d'un vote individuel autorisé dans
> le calendrier personnel.

### M3 — Changer la durée : la réconciliation garde les réponses que AD-10 doit effacer

AD-10 : « changer la durée = remplacer toutes les options ». Les deux chemins d'écriture existants
réconcilient sur la clé `date|slot` (`planOptions`, utilisé par `setOptions` JDR **et** `updateInTx`
groupe) : une option « samedi soir » passée de 1 à 3 créneaux garde son `id` et ses votes. Story
« durée JDR » ajoute `durationSlots` à `PUT …/options` ; story « durée soirée » l'ajoute au `PATCH`
d'événement ; chacune doit penser à purger, aucune règle ne dit où.

> **AD-10 Rule (ajout) :** `durationSlots` ne s'écrit que par une fonction de `poll/`
> `setOptionsInTx(tx, pollId, options, durationSlots)`, appelée par les deux chemins ; si la durée
> change, toutes les options et leurs votes sont supprimés puis recréés ; sinon réconciliation sur
> `date|slot` comme aujourd'hui.

### M4 — Automate : plafond de 20 côté serveur + filtrage côté client = liste vide

`getAvailableSlots` trie puis **tronque à 20** (`parties.service.ts`, `sorted.slice(0, 20)`). AD-7
interdit le filtrage serveur des masquées, AD-8 retire côté client masquées et déjà proposées. Un MJ
qui masque ou propose 20 fenêtres voit une liste vide alors que la 21ᵉ existe. Par ailleurs AD-11
(« ne renvoie que les fenêtres où toute la troupe est libre sur les N créneaux », défaut N = 1)
change le sens de `span=1` : aujourd'hui la liste classe aussi les créneaux mixtes et inconnus
(priorités 1 et 2). Deux stories : l'une garde le classement actuel pour N = 1, l'autre applique le
filtre strict pour tout N.

> **AD-7 Rule (ajout) :** Le plafond s'applique **après** exclusion des masquées et des fenêtres
> coïncidant avec une option ouverte (le serveur rend le plafond + la liste des masquées en sus,
> marquées `hidden`) ; pour tout N, le classement est celui d'aujourd'hui, appliqué au pire statut
> de chaque membre sur `spanSlots(...)` (« libre » = aucun `UNAVAILABLE`), sans filtre strict.

### M5 — Qui choisit `?span`, et la coïncidence de AD-8 ne marche qu'à durée égale

AD-8 retire une fenêtre qui coïncide « même date, même créneau, **même durée** » avec une option.
Rien ne dit quelle durée la colonne demande : le Deferred renvoie « durée par défaut de la liste de
l'automate » au delta UX. Story « colonne MJ » demande `span=1` ; story « composer » règle la
durée à 3 : aucune fenêtre ne coïncide jamais, les fenêtres déjà proposées restent affichées.
Pire : choisir une fenêtre de 1 créneau (FR-2) pour un sondage ouvert de durée 3 viole « même durée
pour toutes les options » (AD-10) sans qu'aucune règle dise si on refuse, convertit ou change la
durée.

> **AD-8 Rule (ajout) :** La colonne demande toujours `?span` = durée de la cible du composer
> (durée du sondage ouvert si on le modifie, durée saisie sinon, 1 par défaut) ; sélectionner une
> fenêtre pour un sondage existant n'est possible qu'à durée égale, et la sélection d'une fenêtre
> pour un nouveau sondage fixe la durée du composer.

### M6 — URL de l'atelier : quelle route pour quelle famille ?

Les liens `?poll` / `?seanceId` naissent en cinq endroits (calendrier personnel, e-mail de relance,
page de partie, fiche de scénario, fenêtre d'événement). L'atelier est `/parties/:id/calendar` pour
le JDR (`data: { mode: 'mj' }`) et `/parties/:id/guild-calendar` pour le groupe **et** la soirée
isolée (`soiree-tab.ts:156`), monté en `mode: 'personal'`. Le gabarit d'e-mail (côté API) et le
calendrier personnel choisiront chacun la route ; un lien `calendar?poll=` vers une partie de
ralliement tombe sur des lectures `SCENARIO_READ` = `NOBODY` (403). La garde existante de
`?seanceId` exige `isMjMode()` (`calendar-view.ts:1791`), donc ignorée au calendrier du groupe.

> **AD-5 Rule (ajout) :** L'adresse de l'atelier est construite par une seule fonction pure
> `atelierUrl({ partieId, family, kind }, { poll? , seanceId? })` de `@master-jdr/shared`, utilisée
> par le web **et** par les gabarits d'e-mail ; l'armement par `?seanceId` dépend de `can.propose` /
> `can.edit` servis (C1), jamais du mode de la route.

### M7 — `?seanceId` : aucun état d'échec défini (contrairement à `?poll`)

AD-6 dit quoi faire d'un `?poll` inconnu, clos ou inaccessible. AD-5 ne dit rien d'un `?seanceId`
qui désigne une séance déjà datée, à sondage **clos** (non datable selon AD-3), d'un événement
annulé, d'une autre partie, ou que le lecteur ne peut pas organiser. « Sinon vide » (AD-5) ouvrirait
un composer neuf sur une séance qui a déjà un `pollId` → 400 « déjà liée à un vote » à l'envoi.

> **AD-5 Rule (ajout) :** `?seanceId` n'arme le composer que si la séance est dans la charge utile
> et, soit `isDatableSeance(...)` est vrai (création), soit elle porte un sondage **ouvert** et
> `can.edit` (modification) ; dans tout autre cas, calendrier normal + message écrit, paramètre
> retiré par `replaceUrl`, aucune information sur la séance.

### M8 — Masquage : émis sur un canal que l'atelier n'écoute pas

AD-7 / AD-12 : le masquage émet **seulement** `user:{id}` du MJ. AD-12 : les calendriers de partie
écoutent `partie:{id}` ; le code ne branche `user:{id}` qu'en contexte personnel
(`calendar-view.ts`, effet « connecté ci-dessus en contexte personnel seulement »). Le second appareil
du MJ, ouvert sur l'atelier, ne reçoit rien — précisément le défaut que AD-7 dit empêcher.

> **AD-12 Rule (ajout) :** L'atelier, en plus de `partie:{id}`, recharge les fenêtres de l'automate
> sur `user:{id}` du lecteur quand celui-ci peut masquer.

---

## MINEUR

### m1 — Droit d'écriture du masquage = un droit de lecture partagé avec les joueurs

AD-7 garde `PUT/DELETE …/hidden` par `PARTIE_AVAILABILITY_READ`, qui vaut `OWNER_AND_MEMBERS` en JDR
(`permission.service.ts:140`) : un joueur peut écrire des lignes `SlotWindowHidden`. « Du MJ » n'est
qu'une intention.

> **AD-7 Rule (ajout) :** Nouvelle action `SLOT_WINDOW_HIDE` dans l'union fermée `PermissionAction`,
> `OWNER_ONLY` en JDR, `NOBODY` en ralliement, avec son test de refus.

### m2 — `durationSlots` absent des charges utiles de l'atelier

AD-2 met `durationSlots` dans `/me/open-polls` ; AD-10 le porte par les écritures. Rien ne l'impose
dans `SessionPollDto` ni `EventPollDto`, que lit l'atelier (et le préremplissage du composer, AD-5).
Les deux `toSessionPollDto` sont typées `any` (commentaire `packages/shared/src/index.ts`, Story
36.6) : un champ ajouté dans les options passerait inaperçu.

> **AD-10 Rule (ajout) :** `durationSlots` figure **à la racine** de `SessionPollDto`, `EventPollDto`
> et de l'entrée `OpenPoll`, jamais par option.

### m3 — Fin de la Destinée en calendrier personnel : « reconnu clos » n'est pas observable

AD-6 : fin = « absent de la source **et** reconnu clos (date fixée, annulé, supprimé) ». Une fois
`/me/open-polls` non bornée, aucune lecture du calendrier personnel ne dit **pourquoi** un sondage a
disparu (clos, partie masquée, partie terminée, scénario repassé en brouillon). Une story recode
l'heuristique « hors plage » actuelle (`lastDestinyDates`), une autre fait un appel `GET` du sondage.

> **AD-6 Rule (ajout) :** En calendrier personnel, l'absence d'un `pollId` de `/me/open-polls`
> **est** la fin du mode (la source fait autorité) ; le message est unique et neutre, sans motif.

### m4 — `votes-en-cours` quitte `/me/calendar` mais reste une couche persistée

`'votes-en-cours'` est dans `CALENDAR_LAYER_KEYS` (persisté dans les préférences de couches,
validé `@IsIn`) et `MeCalendarDto` est documenté « une clé par couche, jamais absente ». Une story
retire la clé du DTO (AD-1) ; la caractérisation existante (Story 30.5) et l'écran Compte supposent
le contraire.

> **AD-1 Rule (ajout) :** La clé de couche `votes-en-cours` reste dans `CALENDAR_LAYER_KEYS` et
> gouverne l'affichage des entrées d'option quelle que soit leur source ; `MeCalendarDto` cesse
> d'être indexé par couche et sa caractérisation est mise à jour dans la même story.

### m5 — Option longue qui chevauche une séance ou une indisponibilité

Composer à la main une option de 3 créneaux qui recouvre une séance déjà datée de la même partie, ou
une indisponibilité dérivée d'un membre : l'automate (`?span`) l'exclurait, le composer et le
plateau (« meilleure en tête » au seul nombre de « oui ») non. Rien ne dit si le chevauchement est
signalé, refusé ou ignoré, ni comment la heatmap agrège une option sur N créneaux.

> **AD-11 Rule (ajout) :** La disponibilité affichée d'une option longue (heatmap, plateau,
> conflit du composer) est l'agrégat le plus défavorable sur `spanSlots(...)`, calculé par une seule
> fonction de `features/calendar/` ; le serveur n'interdit pas le chevauchement.

---

## Synthèse des AD proposés

| Trou | AD | Nature |
| --- | --- | --- |
| C1 | AD-4 resserré | `can: { propose, edit, choose, extend }` en lot via `PermissionService.canMany` sur cible événement/séance |
| C2 | AD-11 resserré, AD-14 nouveau | `spanSlots` unique ; DTO de séance datée avec fin ; chevauchement ; écrivains qui conservent la durée |
| C3 | AD-15 nouveau | `OpenPollContextPort` + `partieStatus()` pur dans `shared` |
| M1 | AD-2 resserré | `pollVoters` + `hasAnswered` uniques |
| M2 | AD-2 resserré | `myAnswer` par option |
| M3 | AD-10 resserré | `setOptionsInTx` unique, purge si la durée change |
| M4 | AD-7 resserré | plafond après exclusion ; classement inchangé sur `spanSlots` |
| M5 | AD-8 resserré | `?span` = durée de la cible du composer |
| M6 | AD-5 resserré | `atelierUrl()` partagé web + e-mail |
| M7 | AD-5 resserré | états d'échec de `?seanceId` |
| M8 | AD-12 resserré | l'atelier écoute aussi `user:{id}` pour les masquages |
| m1 | AD-7 resserré | action `SLOT_WINDOW_HIDE` |
| m2 | AD-10 resserré | `durationSlots` à la racine des DTO de sondage |
| m3 | AD-6 resserré | absence = fin en personnel |
| m4 | AD-1 resserré | couche `votes-en-cours` conservée, `MeCalendarDto` réindexé |
| m5 | AD-11 resserré | agrégat défavorable sur la plage |
