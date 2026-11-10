# Revue adverse — amendement d'AD-10 (durée portée par le rendez-vous)

- **Cible :** `ARCHITECTURE-SPINE.md`, AD-10 amendé le 2026-10-20 et ses répercussions sur AD-2, AD-5, AD-7, AD-8, AD-11, AD-14, AD-15, AD-17.
- **Méthode :** pour chaque trou, deux stories qui respectent les AD **à la lettre** et construisent pourtant de façon incompatible, vérifiées contre le code du 2026-10-20 (`apps/api/src`, `packages/shared/src`, `apps/web/src`). Chaque trou se termine par une phrase de Rule resserrée, prête à coller.
- **Verdict :** l'amendement est sain sur le fond (une durée, un écrivain, un port), mais **la lettre laisse deux trous critiques** (une durée absente d'un DTO de modification qui retombe à 1, et une purge décidée hors verrou) et quatre trous élevés, à fermer avant le découpage des stories de PL-1.

---

## Critique

### C1 — Les DTO de modification qui oublient la durée la remettent à 1 (et purgent)

- **Story A (fenêtre d'événement, « durée facultative à la création ») :** ajoute `durationSlots?: number` à `CreateEventDto`, validé `@IsOptional() @Min(1)`, défaut 1 côté service. Or `UpdateEventDto = CreateEventDto` (`packages/shared/src/index.ts`, « remplacement COMPLET ») : le champ arrive tout seul dans `PATCH /parties/:id/events/:eventId`.
- **Story B (n'importe quel appelant existant du PATCH) :** `event-dialog.ts:470` (`form.dto()`), `event-create.ts:104` et le chemin du composer de soirée envoient le DTO sans `durationSlots`. Remplacement complet + défaut 1 ⇒ une soirée de 3 créneaux redevient d'un créneau ; si elle a un sondage ouvert, `setDurationInTx` renvoie « changé » et **toutes les réponses sont purgées**, sans que personne n'ait touché à la durée.
- Même piège sur `PUT /parties/:id/poll/:pollId/options` (`SetPollOptionsDto`) : l'appelant actuel `calendar-view.ts:1416` envoie `{ options }` seul.
- AD-14 dit « modifier un autre champ ne change jamais la plage », mais rien n'interdit au serveur de lire « absent » comme « 1 » : la story B écrit une durée de 1 *explicite* aux yeux du service.
- **Rule resserrée (AD-10) :** « Dans tout DTO d'**entrée**, `durationSlots` absent vaut **inchangé** en modification (`PATCH` d'événement compris, par exception à son remplacement complet, et `PUT …/options`) et **1** seulement à la création d'une `Seance` ; aucun service n'applique le défaut 1 à une séance existante. Test : un `PATCH` et un `PUT` sans `durationSlots` sur un rendez-vous de 3 créneaux gardent 3 et ne suppriment aucune réponse. »

### C2 — La purge est décidée hors verrou, et la fixation JDR peut sceller une plage que personne n'a votée

- **Story A (chemin JDR, `poll/`) :** dans `setOptions`, lit `Seance.durationSlots` (ou compare au DTO) **avant** `$transaction`, en déduit `purge`, puis ouvre la transaction et appelle `setDurationInTx` puis `setOptionsInTx(…, { purge })`. Rien dans AD-10 n'impose que `purge` vienne du retour de `setDurationInTx` ni l'ordre durée → options.
- **Story B (deux PUT concurrents, ou PUT + vote) :** deux MJ/onglets envoient 1 → 3 ; les deux lisent 1 hors transaction ; le premier purge et écrit 3, des membres revotent, le second purge **à nouveau** des réponses données pour la bonne plage.
- **Story C (fixer la date en JDR, inchangée) :** `PollService.choose` lit l'option **hors transaction et sans verrou** (`poll.service.ts`, chemin JDR, contrairement à `chooseGroupDate`), puis `chooseDate` lit `Seance.durationSlots` dans sa transaction. Un changement de durée validé entre les deux ⇒ la séance est datée sur `spanEnd(départ, nouvelle durée)` à partir d'une option supprimée par la purge, votée pour l'ancienne plage.
- **Rule resserrée (AD-10) :** « Changer la durée et les options se fait dans **une** transaction, dans cet ordre : verrou de la partie puis de l'événement (`FOR UPDATE`, ordre d'`updateHosted`) → `setDurationInTx` → `setOptionsInTx(…, { purge: changed })` ; `purge` vient **seulement** du retour de `setDurationInTx`, jamais d'une lecture antérieure ni du DTO. La fixation de la date (JDR comme ralliement) prend le même verrou et relit sondage et option **dans** sa transaction ; une option disparue rend 404. »

---

## Élevé

### H1 — La durée initiale du composer écrase la durée déclarée du rendez-vous

- AD-10 : la durée est **déclarée** à la création (fenêtre d'un événement, séance de JDR). AD-5 : pour une séance à dater, « composer **vide** » ; seul le cas « sondage ouvert » est « prérempli (options et durée) ». AD-8 : `?span` = « durée saisie pour un **nouveau** », et « choisir une fenêtre pour un nouveau sondage **fixe la durée** du composer » ; hors composer, `?span` = 1.
- **Story A (composer) :** « vide » ⇒ durée 1 ; la validation envoie 1 et écrase la durée 3 déclarée à la création de la soirée ou de la séance.
- **Story B (FR-2) :** le MJ choisit une fenêtre dans la colonne hors composer (servie à `?span=1`), puis le rendez-vous (déclaré 3) ; AD-8 fixe la durée à 1, AD-10 dit que le rendez-vous vaut 3. Les deux lectures sont littérales.
- Note : AD-8 parle encore de « durée du sondage modifié », vocabulaire d'avant l'amendement.
- **Rule resserrée (AD-5 et AD-8) :** « Le composer s'initialise **toujours** à `Seance.durationSlots` de sa cible (création comme modification) ; `?span` = la valeur **courante** du champ durée du composer. Une fenêtre choisie avant le rendez-vous (FR-2) n'est versée que si sa durée égale celle du rendez-vous ; sinon le composer s'ouvre à la durée du rendez-vous, sans la fenêtre, avec un message écrit. Remplacer « durée du sondage modifié » par « durée du rendez-vous ». »

### H2 — Durée d'une séance **datée** : modifiable ou non ? Personne ne le dit

- `UpdateEventDto = CreateEventDto` : dès que la fenêtre de création porte la durée, la fenêtre de **modification** la porte aussi (même formulaire, `event-dialog.ts`). AD-10 la dit « modifiable dans le composer », sans dire « seulement ».
- **Story A :** sur une conjonction datée, accepte le changement et recalcule `end = spanEnd(start, n)` par la fonction d'AD-14 (« une séance datée vérifie toujours… »).
- **Story B :** suit Story 40.6 (`DATE_FIXED_MESSAGE` : la date fixée depuis un sondage ne bouge plus) et refuse, ou ignore le champ en silence.
- Conséquences divergentes : disponibilités des inscrits, `reminderSentAt`, `nextSessionDate`, e-mail « date fixée » déjà parti avec l'ancienne plage.
- **Rule resserrée (AD-10, AD-14) :** « `durationSlots` ne change que là où la date de départ peut changer : séance sans date (composer), ou séance datée **sans sondage lié** (fenêtre de modification), auquel cas la fonction d'AD-14 recalcule `end` et remet `reminderSentAt` à vide ; sur une séance datée depuis un sondage, un changement de durée est refusé (400, même message que la date). »

### H3 — `poll/` lit la durée par où ? Le port d'AD-15 ne la rend pas

- AD-2 : `OpenPoll` porte `durationSlots` à la racine. AD-15 énumère **limitativement** ce que rend `OpenPollContextPort` (seanceId, titre, famille, forme, partie, ayants droit, annulation) : **pas la durée**. AD-10 ne prévoit le port `RendezVousDurationPort` que pour **écrire** (`setDurationInTx`). `SessionPollDto` (construit par `poll/` dans `setOptions`, et par `scenarios/` : deux `toDto` typés `any` selon le commentaire de `SessionPollDto`) doit aussi porter la durée, comme le gabarit de relance (AD-14 : « affichent la plage »).
- **Story A :** ajoute `seance: { select: { durationSlots: true } }` à `POLL_INCLUDE` dans `poll/` (lecture Prisma directe de la table d'`events/` : `layer-imports.spec.ts` ne voit que les imports, le test passe).
- **Story B :** étend `OpenPollContextPort` d'un champ, et `scenarios/` lit `seance.durationSlots` de son côté. Trois sources de lecture, une valeur par défaut pour le vote hérité sans séance que chacune choisit à sa guise.
- **Rule resserrée (AD-10, AD-15) :** « `poll/` ne lit `Seance` que par ports : `OpenPollContextPort.contextOf` rend aussi `durationSlots`, et `RendezVousDurationPort` expose `durationsOf(pollIds)` en lot pour `SessionPollDto` et la relance ; un sondage sans séance vaut 1. `durationSlots` est **requis** (jamais optionnel) à la racine de tout DTO de sortie (`SessionPollDto`, `EventPollDto`, `OpenPoll`, `DatableSeance`, `SeanceDto`, `EventCardSeanceDto`, `MyCalendarSeanceEntry`), pour que le compilateur attrape l'oubli. »

### H4 — L'avertissement de perte de réponses ne compte pas ce que le serveur purge

- Le composer calcule la perte sur les **seules options retirées** (`calendar-view.ts`, `removed` / `voterCount`, puis la revérification `freshVoterCount`). AD-5 garde `ComposeConfirmDialog` « avec l'avertissement de perte de réponses », sans changer le calcul.
- **Story A (composer) :** garde le calcul existant ; aucune option retirée ⇒ **aucun dialogue** ; la durée change ⇒ le serveur purge tout.
- **Story B (serveur) :** applique fidèlement la purge d'AD-10.
- **Rule resserrée (AD-5) :** « La perte annoncée suit le critère du serveur : si la durée du composer diffère de `Seance.durationSlots`, **toutes** les réponses du sondage sont comptées ; une seule fonction pure de `features/calendar/` calcule ce nombre pour le dialogue et pour la revérification avant l'écriture. »

---

## Moyen

### M1 — Le brouillon 40.5b porte la durée à l'aller, la perd au retour

- `ConjonctionDraftService.finishCompose(partieId, pollOptions?)` ne rend que les créneaux. AD-5 dit « son brouillon porte `durationSlots` », sans dire dans quels sens.
- **Story A :** ajoute `durationSlots` à `ConjonctionDraft` (aller). **Story B :** le composer change la durée, `finishCompose` ne la rend pas, la fenêtre rouverte envoie l'ancienne.
- **Rule resserrée (AD-5) :** « Le brouillon de conjonction porte `durationSlots` dans les deux sens : le composer s'initialise depuis le brouillon et `finishCompose` rend créneaux **et** durée. »

### M2 — `FULL_DAY` en JDR avec une durée > 1

- Le composer JDR accepte une case « journée » (`onComposeToggled` ne refuse `FULL_DAY` qu'en ralliement), et la Destinée JDR force la vue **Mois** (AD-6), où la case vaut `FULL_DAY`. AD-10 refuse `FULL_DAY` avec `durationSlots > 1` côté serveur.
- **Story A (composer) :** laisse passer ; 400 à l'envoi, la composition reste en mémoire. **Story B (champ durée) :** passer de 1 à 3 avec des cases « journée » déjà posées ne dit rien.
- **Rule resserrée (AD-10) :** « Avec une durée > 1, le composer refuse une case `FULL_DAY` avec sa raison écrite (patron de la Story 40.5b) et bascule en Semaine ; porter la durée au-delà de 1 retire les cases `FULL_DAY` déjà posées en le disant. »

### M3 — Création JDR : durée et sondage écrits en deux temps

- `POST /scenarios/seances/:id/poll` est **non atomique par construction** (Story 8.7 : `events.createSeancePoll` puis `pollService.create`, qui ouvre sa propre transaction). AD-10 n'impose « la même transaction » qu'au **changement** de durée.
- **Story A :** écrit la durée avant `createSeancePoll` ; un 400 sur doublon d'options laisse un rendez-vous dont la durée déclarée a changé sans sondage. **Story B :** l'écrit après ; un échec laisse un sondage ouvert sous l'ancienne durée.
- **Rule resserrée (AD-10) :** « La création d'un sondage JDR écrit durée, sondage et `Seance.pollId` dans **une** transaction (`setDurationInTx` → `createInTx` → liaison) ; la non-atomicité acceptée en Story 8.7 est levée pour cette route. »

### M4 — Un second écrivain de la durée est déjà à portée de main

- `scenarios/` écrit déjà `Seance` en direct (`scenarios.service.ts:920`, `compteRendu`), comme `notifications/` (`reminderSentAt`). « Écrivain `events/` » n'a aucune garde automatisée.
- **Story A (séance de JDR créée avec une durée) :** écrit `durationSlots` dans `scenarios/` par `prisma.seance.update`, sur ce précédent. **Story B :** passe par `events.addSeance`. Deux validations du plafond, deux défauts.
- **Rule resserrée (AD-10, AD-14) :** « Aucune écriture de `durationSlots`, `endDate` ou `endSlot` hors d'`events/` : `scenarios/` passe la durée à `events.addSeance(grant, eventId, { durationSlots })` ; un test de source (patron de `layer-imports.spec.ts`) le garde. »

### M5 — Forme du port `RendezVousDurationPort` et de `setOptionsInTx` non fixée

- `poll/` ne connaît que `pollId` ; `events/` raisonne en `seanceId` (une soirée isolée en attente de date n'a pas encore de sondage). AD-10 ne fixe ni la clé du port, ni s'il peut ouvrir sa propre transaction ou émettre. `setOptionsInTx(tx, pollId, options, { purge })` fusionne `setOptions` (bornes JDR 2–40, sans échéance aujourd'hui) et `updateInTx` (bornes de groupe, échéance) : AD-17 y ajoute `expiresAt`, mais la signature d'AD-10 ne le porte pas.
- **Story A :** port `setDurationInTx(tx, seanceId, n)` ; `poll/` doit alors trouver la séance d'un sondage, donc lire `Seance`. **Story B :** port par `pollId`, et `updateHosted` appelle une seconde fonction par `seanceId`. Deux fonctions, deux validations.
- **Rule resserrée (AD-10) :** « `RendezVousDurationPort.setDurationInTx(tx, pollId, durationSlots): Promise<{ changed: boolean }>`, clé `pollId`, dans la transaction de l'appelant, sans émettre ni ouvrir de transaction, 404 si aucune séance n'est liée ; `events/` y délègue à **une** fonction interne par `seanceId`, qu'appelle aussi `updateHosted`. `setOptionsInTx(tx, pollId, { options, expiresAt, bounds }, { purge })` porte l'échéance et les bornes de la famille. Le port est lié dans `PortsModule` et son fichier ajouté à la liste attendue de `layer-imports.spec.ts`. »

### M6 — `?span` pendant qu'on modifie la durée, et « à durée égale »

- AD-8 : `?span` = « durée du sondage modifié » ; « une fenêtre ne s'ajoute à un sondage existant qu'à durée égale ». Avec une durée modifiable dans le composer, « durée » peut être la valeur enregistrée ou la valeur en cours de saisie.
- **Story A :** `?span` = valeur enregistrée ; la colonne propose des fenêtres d'un créneau pendant que le MJ compose une plage de 3. **Story B :** `?span` = valeur saisie ; « durée égale » compare à la valeur enregistrée et refuse toute fenêtre.
- Couvert par la phrase de H1 (« `?span` = valeur courante du champ ») ; ajouter : « "à durée égale" compare à cette même valeur courante ».

### M7 — Clé du masquage : la fenêtre servie ne dit pas sa durée

- `SlotWindowHidden` a 5 colonnes, `durationSlots` compris (AD-7), mais la réponse d'`available-slots` n'est pas tenue de renvoyer la durée de chaque fenêtre.
- **Story A (web) :** reconstruit le corps du `PUT`/`DELETE` depuis le `?span` courant, qui a pu changer (H1, M6) entre la lecture et le clic. **Story B (serveur) :** compare aux 5 colonnes ⇒ démasquage sans effet, ou masquage d'une fenêtre jamais vue.
- **Rule resserrée (AD-7) :** « Chaque fenêtre servie (visible ou `hidden`) porte `durationSlots` ; masquer ou démasquer recopie celui de la fenêtre, jamais `?span`. Un masquage ne vaut que pour cette durée (le dire au delta UX). »

---

## Faible

### L1 — La purge renouvelle les `optionId` sous la Destinée

- Purge et recréation ⇒ nouveaux identifiants ; le créneau courant est un `optionId` (AD-6). Après le rechargement SSE, le sondage existe toujours mais le créneau courant a disparu : rien ne dit où se replacer.
- **Rule resserrée (AD-6) :** « Si le créneau courant n'existe plus dans un sondage toujours présent, la Destinée se replace sur `destinyEntryOption`. »

### L2 — La purge ne réarme pas la relance

- Après purge, plus personne n'a répondu ; si `relanceSentAt` est déjà posé, la relance de la veille ne repart pas. AD-17 réarme pour un changement d'échéance, pas pour une purge.
- **Rule resserrée (AD-10) :** « Une purge remet `relanceSentAt` à vide, dans la même transaction. »

### L3 — Vote hérité sans séance et exclusion d'AD-7

- L'exclusion « même départ, même durée » d'AD-7 tire la durée des options de `Seance.durationSlots` ; un sondage hérité sans séance (cas prévu par `chooseDate`) n'en a pas.
- Couvert par H3 (« un sondage sans séance vaut 1 ») ; le citer aussi dans AD-7.

### L4 — Droit de changer la durée hors composer

- AD-4 ne mappe aucune action pour la durée ; une story de séance JDR peut créer `SEANCE_DURATION_SET`, une autre réutiliser l'action de la route.
- **Rule resserrée (AD-4) :** « Écrire la durée n'a pas d'action propre : elle suit l'action de la route qui la porte (`SEANCE_POLL_CREATE`, `POLL_OPTIONS_SET`, `EVENT_UPDATE`, ajout de séance). »

---

## Synthèse des phrases à reporter dans la spine

| Trou | AD touchés | Gravité |
| --- | --- | --- |
| C1 absent = inchangé, jamais 1 | AD-10, AD-14 | Critique |
| C2 ordre et verrou durée → options, `purge` du seul retour ; fixation JDR sous verrou | AD-10, AD-11 | Critique |
| H1 composer initialisé à la durée du rendez-vous ; `?span` = valeur courante | AD-5, AD-8 | Élevé |
| H2 durée d'une séance datée | AD-10, AD-14 | Élevé |
| H3 lecture de la durée par ports, champ requis dans les DTO de sortie | AD-2, AD-10, AD-15 | Élevé |
| H4 perte annoncée = critère du serveur | AD-5 | Élevé |
| M1 à M7 | AD-5, AD-7, AD-8, AD-10, AD-14 | Moyen |
| L1 à L4 | AD-4, AD-6, AD-7, AD-10 | Faible |
