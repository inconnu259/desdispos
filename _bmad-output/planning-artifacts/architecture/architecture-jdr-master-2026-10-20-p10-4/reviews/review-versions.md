# Revue — versions et mécanismes techniques (Spine Palier 10.4)

Relecteur en lecture seule. Date : 2026-10-20. Rien n'a été installé ni modifié hors ce rapport.

## Verdict

Section Stack exacte contre les `package.json`, `pnpm-lock.yaml`, `docker/dev.Dockerfile` et `docker-compose.yml` ; les mécanismes nommés existent et conviennent, avec quatre points à corriger ou à confirmer (nom d'index Prisma, `date` sans `@db.Date`, effet de `replaceUrl` sur le bandeau contextuel, `node_modules` hôte périmés).

## 1. Section Stack contre la réalité

| Spine | Réel | Source | Statut |
| --- | --- | --- | --- |
| Node.js 24 LTS | `node:24.17.0-bookworm-slim` ; `engines >=24 <25` | `docker/dev.Dockerfile`, `package.json` | OK (la spine ne donne pas le correctif ; la version est épinglée à 24.17.0) |
| pnpm 11.8.0 | `packageManager: pnpm@11.8.0` | `package.json` racine | OK |
| TypeScript API 5.9.3 | `^5.9.3`, lock `typescript@5.9.3` | `apps/api/package.json`, lock | OK |
| TypeScript web 6.0.3 | `~6.0.3`, lock `typescript@6.0.3` | `apps/web/package.json`, lock | OK |
| Angular 22.1.3 | `^22.1.3`, lock `@angular/core@22.1.3` | `apps/web/package.json`, lock | OK |
| NestJS 11.2.3 | `^11.2.3`, lock `@nestjs/common@11.2.3` | `apps/api/package.json`, lock | OK |
| Prisma 7.10.0 (client + CLI) | `^7.10.0` (client, adapter-pg, CLI), lock `7.10.0` | `apps/api/package.json`, lock | OK |
| PostgreSQL 17 | `postgres:17-alpine` | `docker-compose.yml` | OK (tag flottant sur 17.x) |
| RxJS 7.8.2 | `^7.8.2` API, `~7.8.2` web ; le lock contient aussi `rxjs@7.8.1` (dépendance transitive) | package.json, lock | OK |

Les `package.json` de `packages/shared` et `packages/game-rules` ne portent aucune dépendance runtime (game-rules : TypeScript 5.9.3 et Vitest 4.1.11 en dev) : « aucune dépendance nouvelle » est cohérent.

Web (une seule recherche, partielle) : Node 24 est en LTS, fin de vie annoncée au 30 avril 2028 ; il quitte la phase « Active LTS » vers le 20 octobre 2026 (aujourd'hui) pour la maintenance. « Node 24 LTS » reste vrai. **Non confirmé** : dates de support d'Angular 22 et de Prisma 7, et fin de vie de PostgreSQL 17 (de mémoire, novembre 2029, non vérifié sur le web).

## 2. Mécanismes techniques

- **`replaceUrl` du Router** : OK. Précédent exact dans `calendar-view.ts:1866` (`navigate([], { relativeTo, queryParams, queryParamsHandling: 'merge', replaceUrl: true })`). Retirer un paramètre se fait avec `{ poll: null }` (déjà fait pour `weeks: null`, l.2550) ; la spine ne le précise pas. **Attention** : le commentaire de `calendar-view.ts` (l.1869-1873) note que cette navigation interne déclenche `NavigationStart` -> `ContextualNavService.clear()`, qui vide le bandeau. AD-6 réécrit `?poll` « à chaque entrée, changement ou sortie » de la Destinée : chaque réécriture videra le bandeau s'il n'est pas reposé. À mentionner dans AD-6.
- **`localStorage`** : déjà utilisé côté web (`auth.service.ts`, `my-parties.service.ts`), donc le motif existe. Sous `try/catch` conforme au besoin d'AD-9.
- **Prisma `Int @default(1)`** : valide ; l'ajout d'une colonne `NOT NULL DEFAULT 1` sur `SessionPoll` ne casse pas les lignes existantes. Le schéma actuel de `SessionPoll` n'a aucun champ de durée.
- **Unique composite à 5 colonnes** (`userId`, `partieId`, `date`, `startSlot` enum `DaySlot`, `durationSlots`) : possible en Prisma 7 / PostgreSQL. Deux réserves, non testées dans ce dépôt :
  1. `PollOption.date` et `Seance.startDate` sont des `DateTime` **sans `@db.Date`** (timestamp). L'unicité sur `date` est alors celle d'un instant : la spine doit imposer la normalisation (minuit UTC) ou `@db.Date`, sinon deux masquages « du même jour » coexistent.
  2. Le nom d'index par défaut généré (`SlotWindowHidden_userId_partieId_date_startSlot_durationSlots_key`, environ 65 caractères) dépasse la limite de 63 caractères des identifiants PostgreSQL. Comportement de Prisma (troncature ou erreur) non confirmé : prévoir un `map:` explicite court sur le `@@unique`.
- **`@Put` / `@Delete` NestJS** : OK, déjà employés (`account.controller.ts:48-53`, `:70`, `:78`, `availability.controller.ts:51`). Le chemin `parties/:id/available-slots/hidden` n'entre pas en conflit avec `@Get(':id/available-slots')` (`parties.controller.ts:61`).
- **SSE existant** : OK. API : `realtime.controller.ts` (`@Sse('parties/:id/events')` et `@Sse('users/me/events')`), `party-signals.service.ts`. Web : `core/realtime/realtime.service.ts` (`partieTopic`, `userTopic`, `TopicHandler.notifyChanged(topic)`).
- **Ports cités** : `SeanceDatePort`, `OwnEventsPort`, `VISIBLE_POLL_WHERE`, actions `SEANCE_POLL_CREATE`, `POLL_CHOOSE`, `PARTIE_AVAILABILITY_READ` existent. `DatableSeanceFilter` et `isDatableSeance` sont nouveaux, comme annoncé.

## 3. Points à corriger ou à confirmer dans la spine

1. **Signature de `SeanceDatePort`** : l'actuelle est `chooseDate(tx, pollId, date, slot)` et son contrat dit « `start = end` ». AD-11 la change (durée) ; l'ADR doit nommer l'ancien contrat comme remplacé.
2. **`GetAvailableSlotsDto`** : `?span=N` est à ajouter au DTO existant (`weeks` 1-16, `from`, `to`), avec `@IsInt @Min(1) @Max(plafond partagé)` ; le plafond d'AD-10 doit y être réutilisé.
3. **Nom `OpenPollsService`** : un `core/poll/open-polls.service.ts` existe déjà côté web (parties/réalisation des votes ouverts, branché sur le `RealtimeService`). Le nouveau `GET /me/open-polls` (AD-2) risque de collision de nom et de sémantique ; préciser si le service est étendu ou remplacé.
4. **`FULL_DAY`** : `DaySlot` contient `FULL_DAY` ; `spanEnd` (MORNING -> AFTERNOON -> EVENING -> MORNING) n'est défini que pour les trois autres, ce que la règle `FULL_DAY` seulement avec `durationSlots = 1` couvre, à tester aux bords.
5. **`node_modules` hôte périmés** : `apps/api/node_modules` a Prisma 7.8.0 et Nest 11.1.28, `apps/web/node_modules` Angular 22.0.2 (datés d'août), alors que `package.json` et lock demandent 7.10.0 / 11.2.3 / 22.1.3. La spine a raison (lock) ; ne pas s'appuyer sur ces dossiers hôte pour vérifier une API.

## Non confirmé

Support d'Angular 22 et Prisma 7 ; fin de vie de PostgreSQL 17 ; comportement de Prisma sur un nom d'index par défaut de plus de 63 caractères.
