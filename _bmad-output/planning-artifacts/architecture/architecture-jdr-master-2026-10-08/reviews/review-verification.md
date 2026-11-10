# Revue « vérification » — Architecture Spine Palier 10 (2026-10-08)

- **Document relu :** `_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-10-08/ARCHITECTURE-SPINE.md` (version `updated: 2026-10-09`)
- **Lentille :** chaque décision engagée a-t-elle été confrontée au dépôt réel, ou est-elle affirmée de mémoire ?
- **Date :** 2026-10-09 — relecteur indépendant, lecture seule du dépôt (aucun install, aucune commande git en écriture).

## Verdict

La Stack et la plupart des noms cités existent bel et bien. En revanche, quatre décisions structurantes (AD-4, AD-8, AD-14, AD-5/AD-16) s'appuient sur une image du code de séance, d'inscription, des routes et du renommage `mjId` qui ne correspond pas au dépôt. Il faut les corriger avant de découper la porte.

---

## Ce qui a été vérifié et tient

| Affirmation de la spine | Preuve |
| --- | --- |
| Node 24 LTS | `.nvmrc` = `24` ; `package.json:5-7` `"engines": { "node": ">=24 <25" }` ; `docker/dev.Dockerfile:3` `FROM node:24.17.0-bookworm-slim` |
| pnpm 11.8 | `package.json:4` `"packageManager": "pnpm@11.8.0"` ; `docker/dev.Dockerfile:9` `corepack prepare pnpm@11.8.0` |
| PostgreSQL 17 | `docker-compose.yml:19` `postgres:17-alpine` ; `.github/workflows/ci.yml:82,132` idem |
| TypeScript 5.9.3 / 6.0.3 | `apps/api/package.json:85` `^5.9.3`, `apps/web/package.json:41` `~6.0.3` ; lockfile `typescript@5.9.3`, `typescript@6.0.3` (`pnpm-lock.yaml:6975,6980`) |
| Angular 22.1.3 | `apps/web/package.json:19` ; lockfile `@angular/core@22.1.3` (`pnpm-lock.yaml:475`) |
| NestJS 11.2.3 | `apps/api/package.json:32-33` ; lockfile `@nestjs/core@11.2.3` (`pnpm-lock.yaml:2041`) |
| @nestjs/schedule 6.1.3 | `apps/api/package.json:36` ; lockfile `pnpm-lock.yaml:2071` ; `ScheduleModule.forRoot()` dans `apps/api/src/app.module.ts:37` |
| Prisma 7.10.0 (client + CLI) | `apps/api/package.json:39,78` ; lockfile `@prisma/client@7.10.0`, `prisma@7.10.0` |
| RxJS 7.8.2 | `apps/api/package.json:53`, `apps/web/package.json:26` ; lockfile `rxjs@7.8.2` |
| `NotificationsService` + `@Cron` + garde de non-chevauchement | `apps/api/src/notifications/notifications.service.ts:22` (`isRunning`), `:29` `@Cron(CronExpression.EVERY_HOUR)` |
| `Partie.reminderSentAt`, `nextSessionDate`, `nextSessionSlot` | `apps/api/prisma/schema.prisma:70-72` |
| `Seance.scenarioId` | `schema.prisma:553` |
| `Inscription` (sans statut aujourd'hui) | `schema.prisma:575-584` |
| `SessionPoll.expiresAt` | `schema.prisma:313` (`DateTime?`) |
| `Membership` (sans rôle aujourd'hui), `PartieFavorite`, `Invitation` | `schema.prisma:152`, `:118`, `:164` |
| Verrou d'inscription `SELECT … FOR UPDATE` | `apps/api/src/scenarios/scenarios.service.ts:810-811` |
| `GAME_SYSTEMS`, `gameSystemHasModule()` | `packages/shared/src/index.ts:105`, `:116` |
| `PartySignalCode`, `PartySignalsDto.role: 'mj' \| 'player'` | `packages/shared/src/index.ts:272-282`, `:287-291` |
| « Treize services » lisent `mjId` (AD-6) | exactement 13 fichiers `*.service.ts` hors spec contiennent `mjId` (account, announcements, availability, character-roles, character, homme-dragon, invitations, invite-links, parties, party-signals, poll, scenarios, xp-distributions) |
| `availability.service` lit propriétaire et type (AD-15) | `apps/api/src/availability/availability.service.ts:92`, `:711-716` |
| Une partie `ONE_SHOT` crée son scénario + sa séance dans la transaction (AD-3) | `apps/api/src/parties/parties.service.ts:162-186` |
| Accepter une `Invitation` crée le `Membership` (AD-8) | `apps/api/src/invitations/invitations.service.ts:80-90` (`membership.upsert`) |
| `AuthService` vérifie le mot de passe (argon2) et coupe les sessions (AD-11) | `apps/api/src/auth/auth.service.ts:264` `revokeSessions(tx, userId, exceptSid?)`, `:301` `argon2.verify` |
| Union `EmailTemplate` | `apps/api/src/email/email-template.enum.ts:1-10` (côté API, pas dans `shared`) |
| `ForbiddenException` en usage | `apps/api/src/parties/parties.service.ts:284` |

**Vérification web :** partielle. Prisma 7.10.0 est bien la dernière 7.x stable (26/08/2026) ; Prisma 8 est en RC, avec une GA annoncée pour octobre 2026. Angular 22.1.x existe, mais seul 22.1.2 a pu être confirmé par une source tierce. 22.1.3 n'est pas infirmé, et le lockfile le résout. Pour NestJS 11.2.x et @nestjs/schedule 6.1.3, aucune source officielle n'a été trouvée. Un agrégateur tiers signale un `@nestjs/schedule` 12.x (ESM pur), non confirmé. Aucune version de la Stack n'est inventée : toutes sont celles du lockfile.

---

## Findings

### Critical

Aucun.

### High

#### H1 — AD-4 / AD-16 : la `Seance` n'a aujourd'hui ni date de début, ni créneau, ni fin. La migration unique ne les crée pas

- **Emplacement :** spine l.100 (AD-4), l.172 (AD-16), et par ricochet l.148 (AD-12, « chaque séance datée ») et l.166 (AD-15, « plages occupées »).
- **Constat :** AD-4 affirme qu'« une `Seance` décrit une plage continue : un début (date + créneau) et une fin (date + créneau) ». Or le modèle réel n'a qu'un `dateValidee DateTime?` sans créneau (`apps/api/prisma/schema.prisma:559`). La date d'une séance se **résout** aujourd'hui depuis son sondage : `seance.poll?.chosenDate ?? seance.dateValidee`, avec un créneau `poll.chosenSlot` ou `null`, voire `FULL_DAY` par défaut (`scenarios.service.ts:556-560`, `availability.service.ts:736-738`). La liste des opérations d'AD-16 (l.172) ne contient ni l'ajout de colonnes `start*/end*` sur `Seance`, ni la règle de reprise des séances existantes (recopie depuis `poll.chosenDate/chosenSlot`, ou `dateValidee` + quel créneau ?).
- **Correction proposée :** dans AD-4, nommer les colonnes (ex. `startDate`, `startSlot`, `endDate`, `endSlot`) et dire si elles **remplacent** la résolution `poll.chosenDate ?? dateValidee` ou la **complètent**. Dans AD-16, ajouter l'étape de migration qui remplit ces colonnes, avec la règle de créneau quand `dateValidee` n'en a pas. Si la plage est volontairement différée au Palier 10.4, le dire et garder dans ce palier la résolution actuelle, nommée explicitement.

#### H2 — AD-8 / AD-14 : le « verrou existant de l'inscription » est entouré de gardes qui excluent précisément le ralliement

- **Emplacement :** spine l.124 (AD-8), l.160 (AD-14 : « routes … communes aux deux familles »).
- **Constat :** `ScenariosService.inscrire()` (`apps/api/src/scenarios/scenarios.service.ts:779-850`) passe d'abord par plusieurs gardes :
  - `resolveScenarioOrThrow(seance.scenarioId)` : un événement de ralliement n'a **pas** de ligne `Scenario` (AD-3), donc 404 ;
  - refus si le scénario est `BROUILLON`/`PASSE` (`:788`) ;
  - refus si `partie.kind !== 'CAMPAGNE_EPISODIQUE'` (`:793`) : une rencontre isolée (`ONE_SHOT`, FR-2) est refusée ;
  - refus si `inscriptionMax == null` (`:798`) ;
  - refus dès que la séance a une date (`:803-807` puis `:826` sous verrou, « les inscriptions sont figées »).

  Or un événement de ralliement est créé « avec sa séance » (AD-14), donc probablement daté, et doit accepter des inscriptions. `setSeanceCapacity()` est lui aussi réservé à l'épisodique (`:753`). La spine présente la réservation comme un simple état ajouté « sous le verrou existant » sans dire qu'il faut lever ou déplacer ces cinq gardes. Elle ne dit pas non plus que ces opérations, qui vivent aujourd'hui dans un service de **couche 3**, doivent passer dans `EventsService` (couche 2) pour être « communes ».
- **Correction proposée :** dans AD-8, distinguer le **verrou** (`SELECT … FOR UPDATE` + un seul `count`), qui est conservé, des **gardes**, qui sont réécrites dans `EventsService` et `PermissionService`. Lister les gardes qui restent propres au JDR (statut anti-spoil, gel des inscriptions après date en épisodique) et celles qui valent pour le ralliement. Dans AD-14, dire que les handlers `scenarios/seances/:id/*` délèguent à `EventsService` et n'appellent plus `resolveScenarioOrThrow`.

#### H3 — AD-14 : la cartographie des routes est inexacte

- **Emplacement :** spine l.160.
- **Constat :**
  - Les routes de JDR ne sont pas toutes sous `/parties/:id/scenarios/…`. Seules la création, la liste et les brouillons y sont (`scenarios.controller.ts:47,65,70`). Les mutations de scénario sont sous `scenarios/:id/…` (`:56,79,84,89,94,103,108`).
  - Le **sondage** n'a pas ses routes sous `…/scenarios/seances/:id/…`. Seule la création y est (`POST scenarios/seances/:id/poll`, `:118`). Vote, choix de date, options et suppression sont sous `parties/:id/poll/:pollId/…` (`apps/api/src/poll/poll.controller.ts:26,49,62,72,105,115`).
  - Aucune route de réservation n'existe encore.
- **Correction proposée :** remplacer la phrase par la liste réelle : `parties/:id/scenarios[/drafts]`, `scenarios/:id/*`, `scenarios/seances/:id/*`, `parties/:id/poll/*`. Préciser lesquelles restent inchangées, lesquelles deviennent communes aux deux familles, et le chemin de la nouvelle route de réservation.

#### H4 — AD-5 / AD-16 / Conventions : le renommage `mjId` → `ownerId` est sous-estimé et contredit la condition « interface de JDR identique »

- **Emplacement :** spine l.106 (AD-5), l.172 (AD-16), l.178 (convention « `mjId` interdit »).
- **Constat :**
  - En base, `Partie.mjId` est `String` **non nul** avec `onDelete: Cascade` (`schema.prisma:66-67`). AD-5 exige qu'il soit nullable avec `SetNull`, mais AD-16 ne mentionne que le renommage.
  - La relation s'appelle `"PartieMJ"` / `User.mjOfParties` (`schema.prisma:32`), et le rappel inclut `mj` (`notifications.service.ts:53`).
  - Le **contrat partagé** expose `PartieDto.mjId: string`, `mjPseudo?`, `mjDisplayName?` (`packages/shared/src/index.ts:245-250`), consommé par le web (`partie-detail.ts:207,263,284,732`, `partie-detail.html:17,498`, `roster-rail.ts:25`, `homme-dragon-creation-page.ts:72`). Renommer dans le DTO casse la condition de passage d'AD-16 (« interface de JDR identique ») ; ne pas renommer viole la convention qui interdit `mjId`. Un `ownerId` nullable rend aussi `PartieDto.mjId: string` faux.
  - `XpDistribution.mjId` (`schema.prisma:446-447`) garde un nom interdit et n'est pas traité.
- **Correction proposée :** dans AD-16, ajouter explicitement : passage de `ownerId` en nullable, `Cascade` → `SetNull`, renommage de la relation. Trancher pour le DTO : soit `PartieDto.ownerId` (et accepter qu'« interface identique » veuille dire « comportement identique », front adapté dans la même porte), soit une exception nommée à la convention. Dire ce que devient `XpDistribution.mjId` (exception assumée, car c'est bien le MJ, ou renommage).

### Medium

#### M1 — AD-15 / AD-1 : `nextSessionDate` a déjà deux écrivains, et la couche 1 dépend déjà des couches 2 et 3

- **Emplacement :** spine l.82 (AD-1), l.166 (AD-15).
- **Constat :** la « seule fonction » existe déjà, `ScenariosService.recalculateNextSession()` (`scenarios.service.ts:539`). Mais `PollService.choose()` écrit lui-même `nextSessionDate`, `nextSessionSlot` et `reminderSentAt` (`apps/api/src/poll/poll.service.ts:179-190`). Par ailleurs, `PollController` (couche 1) injecte `ScenariosService` (couche 3) via `forwardRef` (`poll.controller.ts:19,34,86`), et `PollService` dépend de `PartiesService` (`poll.service.ts:3`, `getOwned` partout). La spine présente la règle de dépendance vers le bas comme un acquis ; le code la viole déjà, et l'ordre de la porte (AD-16) ne prévoit pas de lever ces violations.
- **Correction proposée :** dans AD-15, nommer le second écrivain (`PollService.choose`) et le supprimer : `choose()` ne fait que fermer le sondage, et `EventsService` recalcule. Dans AD-1/AD-16, lister ces deux dépendances montantes comme dette à résorber dans la porte, et dire comment le sondage obtient ses droits (`PermissionService`, ou une interface étroite).

#### M2 — AD-9 : le statut de partie se dérive aujourd'hui de la présence d'un `Scenario`

- **Emplacement :** spine l.130.
- **Constat :** `status = closedAt ? 'TERMINEE' : hasScenario ? 'EN_COURS' : 'A_VENIR'` (`apps/api/src/parties/parties.service.ts:110-121`). Après AD-3, un ralliement n'a aucune ligne `Scenario` et resterait `A_VENIR` à vie. La spine étend la dérivation avec `ANNULEE` sans dire que son entrée passe de `Scenario` à `Event`.
- **Correction proposée :** dans AD-9, écrire la nouvelle dérivation (`ANNULEE` si partie isolée dont l'unique `Event` a `cancelledAt` ; `EN_COURS` si au moins un `Event` ; sinon `A_VENIR`), en requête groupée.

#### M3 — AD-2 : le « registre unique » ignore un second registre existant et les capacités nécessaires à AD-13

- **Emplacement :** spine l.88 (AD-2), l.154 (AD-13).
- **Constat :**
  - Il existe un modèle Prisma `GameSystem` (`schema.prisma:357`) alimenté par `GameSystemService` (`apps/api/src/game-systems/game-system.service.ts:185,223`), et une constante `RYUUTAMA_ID` (`game-systems/supported-game-systems.ts`).
  - Le signal `HOMME_DRAGON_A_CREER` filtre en dur sur `gameSystemId: RYUUTAMA_ID` (`apps/api/src/parties/party-signals.service.ts:52-56`).
  - AD-2 ne cite que la capacité `characters`, alors qu'AD-13 conditionne cinq codes à une capacité (Homme Dragon, scénario, compte rendu…).
- **Correction proposée :** dans AD-2, situer la table `GameSystem` (catalogue de contenu P5-AD-4, pas registre de capacités) et énumérer l'ensemble fermé des capacités (au moins `characters`, `scenarios`, `hommeDragon`), mappé aux codes d'AD-13. Remplacer le filtre `RYUUTAMA_ID` par `hasCapability`.

#### M4 — AD-12 : les destinataires du rappel et la reprise de la trace sont imprécis par rapport au comportement actuel

- **Emplacement :** spine l.148 et l.172.
- **Constat :** aujourd'hui, le rappel part au MJ **et à tous les membres** de la partie, quelle que soit l'inscription (`notifications.service.ts:60-61`). La règle « à ses inscrits / membres » ne dit pas lequel s'applique en `CAMPAGNE_EPISODIQUE`. Passer aux seuls inscrits changerait le comportement du JDR, ce qu'interdit la porte d'AD-16. Pour la reprise de la trace, l'appariement « séance qui correspond à `nextSessionDate` » doit utiliser la résolution `poll.chosenDate ?? dateValidee` et `chosenSlot`. Or `dateValidee` n'a pas de créneau (voir H1), donc l'égalité avec `nextSessionSlot` peut échouer.
- **Correction proposée :** écrire une règle de destinataires par famille et par `kind` qui reproduit exactement l'existant pour le JDR. Préciser la clé d'appariement de la migration (date seule, ou date + créneau si présent).

#### M5 — AD-11 : d'autres cascades depuis `User` touchent des groupes survivants

- **Emplacement :** spine l.142.
- **Constat :** AD-11 traite le propriétaire, mais :
  - `Invitation.inviterId` est en `onDelete: Cascade` (`schema.prisma:168-169`) : les invitations envoyées par un admin supprimé disparaissent d'un groupe qui survit ;
  - `InviteLink.createdById` est aussi en `Cascade` (`:185-186`) ;
  - `SessionPoll.createdById` est une chaîne sans clé étrangère (`:310`), qui pointera vers un compte inexistant ;
  - `XpDistribution.mjId` est en `Cascade` (`:446-447`).
- **Correction proposée :** énumérer dans AD-11 le sort de chaque référence vers `User` dans un groupe survivant (invitations en attente, liens d'invitation, sondages créés). Soit `SetNull`, soit une suppression assumée et listée dans `GET /me/deletion-impact`.

### Low

#### L1 — AD-8 : `InvitationStatus` a quatre valeurs, pas trois

- **Emplacement :** spine l.124.
- **Constat :** l'enum réel est `PENDING | ACCEPTED | DECLINED | REVOKED` (`schema.prisma:144-149` ; `packages/shared/src/index.ts`, `InvitationStatus`).
- **Correction proposée :** citer les quatre valeurs et dire si `REVOKED` alimente `RESERVATION_A_CONFIRMER` (non, a priori).

#### L2 — AD-12 : « prolonger l'échéance » est une opération qui n'existe pas encore

- **Emplacement :** spine l.148, l.112 (« lancer / prolonger / clore un vote »).
- **Constat :** `PollService` n'a aucune opération de prolongation. `expiresAt` est posé à la création (`poll.service.ts:57`, `DEFAULT_POLL_TTL_MS`) et typé nullable (`schema.prisma:313`).
- **Correction proposée :** marquer la prolongation comme nouvelle (route et écrivain à créer) et dire ce qui se passe pour un sondage dont `expiresAt` est nul : aucune relance.

#### L3 — AD-13 / AD-6 : le calcul des signaux est bâti sur deux rôles

- **Emplacement :** spine l.112, l.154.
- **Constat :** `computeSignals(partie, role: 'mj' | 'player')` (`party-signals.service.ts:119`) et ses branches (`:135-163`) ne connaissent que deux rôles. AD-13 ne classe pas les codes MJ hors couche 3 (`AUCUN_MEMBRE_INVITE`, `AUCUNE_DATE_NI_VOTE`, `PARTIE_TERMINEE`) pour `admin`/`member`.
- **Correction proposée :** ajouter à AD-13 une table code × rôle (`mj`/`player`/`admin`/`member`).

#### L4 — Stack : précisions manquantes sur Prisma

- **Emplacement :** spine l.188-200.
- **Constat :**
  - `@prisma/adapter-pg@7.10.0` est utilisé au runtime (`apps/api/src/prisma/prisma.service.ts:3,13`), avec `prisma.config.ts`, et le générateur est `prisma-client-js` (`schema.prisma:1-3`) ; la Stack ne le dit pas.
  - Prisma 8 serait GA en octobre 2026, et selon la doc Prisma, un `npx prisma` non épinglé résout désormais la CLI 8, qui ne lit plus `schema.prisma`.
  - Un agrégateur signale `@nestjs/schedule` 12.x (non confirmé).
- **Correction proposée :** ajouter `@prisma/adapter-pg 7.10.0` et le générateur à la Stack. Rappeler que la migration d'AD-16 se lance par `pnpm exec prisma` dans le conteneur (binaire 7.10 local), jamais par `npx prisma`.

#### L5 — Conventions : les `ForbiddenException` actuelles n'ont pas de message

- **Emplacement :** spine l.181.
- **Constat :** `throw new ForbiddenException()` sans message (`parties.service.ts:284`). La convention « messages en français » est donc neuve pour les refus.
- **Correction proposée :** l'indiquer comme règle neuve, portée par `PermissionService.assert`.
