# Revue de réalité — AD-23 (Un Homme Dragon pour plusieurs aventures)

Date : 2026-10-04 · Cible : `ARCHITECTURE-SPINE.md`, AD-23 + encart Prisma + ERD (lignes 230-243, 378-392, 405-411).
Méthode : `graphify query` d'abord, puis lecture ciblée du code ; Prisma 7.10.0 et PostgreSQL 17 (cf. « Sources et limites »).

## Verdict

**AD-23 est globalement fiable sur l'état actuel du code et sur la faisabilité Prisma/PostgreSQL** : modèle, migration en une passe, `updateMany`/`count`, motif `FOR UPDATE`, routes, DTO, `connect(topic)` — tout se vérifie. **Deux points doivent être corrigés avant la 33.8** : l'encart Prisma est incomplet (relation inverse existante à retirer, F1) et la section « Temps réel » décrit un câblage qui ne se déclenchera pas tel quel et prévoit des connexions inutiles (F2). Trois précisions de gravité moyenne (F3, F4, F5) et quelques notes basses.

Légende : ✅ confirmé · ⚠️ confirmé avec réserve · ❌ faux/incomplet.

---

## 1. Findings (par gravité)

### F1 — ❌ Haute — L'encart Prisma oublie de retirer `Partie.hommeDragons` (et `HommeDragon.partie`)

- Source : `apps/api/prisma/schema.prisma` l.85 `hommeDragons HommeDragon[]` (dans `Partie`) et l.422-423 `partieId` / `partie … onDelete: Cascade` (dans `HommeDragon`).
- L'encart AD-23 dit « partieId et @@unique SUPPRIMÉS » et ajoute `parties Partie[]` + `hommeDragon HommeDragon?`, mais **ne dit pas que `Partie.hommeDragons` doit disparaître**. Si le développeur l'ajoute sans le retirer, il se retrouve avec deux relations non nommées entre les mêmes modèles : erreur `PSL_AMBIGUOUS_BACKRELATION` (documentée par Prisma ; je n'ai pas rejoué ce cas précis, voir « Sources et limites »).
- J'ai validé la forme correcte : schéma dérivé du dépôt avec `Partie.hommeDragons` supprimé, `Partie.hommeDragonId String?` + `Partie.hommeDragon HommeDragon? @relation(fields:[hommeDragonId], references:[id], onDelete: SetNull)`, `HommeDragon.parties Partie[]`, `partieId`/`partie`/`@@unique`/`@@index([partieId])` retirés → `prisma validate` : **valide** sur Prisma 7.10.0 (générateur `prisma-client-js`). Une relation optionnelle `SetNull` avec back-relation liste est donc bien valide.
- **Correction** : ajouter à l'encart la ligne « `Partie.hommeDragons` supprimé (remplacé par `hommeDragon`) ». Une seule relation entre les deux modèles ⇒ pas besoin de nom de relation.
- Effet de bord non listé : `apps/api/prisma/seed-demo.ts` l.481 et l.710 font `prisma.hommeDragon.create({ data: { partieId, … } })` — ne compilera plus ; à réécrire (créer l'Homme Dragon puis lier chaque partie). À citer dans les tâches de la 33.8.

### F2 — ❌ Haute — « Temps réel » : câblage `user:` inopérant tel que décrit, et canaux `partie:` superflus

Faits vérifiés :
- `apps/web/src/app/core/realtime/realtime.service.ts` l.82-103 : `HommeDragonService.notifyChanged` n'est câblé que sur le préfixe **`'partie:'`** (l.86). Aucune entrée `'user:'` pour l'Homme Dragon. Si les écritures de fiche n'émettent plus que `user:{propriétaire}` (AD-23), **aucune fiche ouverte ne se rafraîchira** tant qu'on n'ajoute pas `{ prefix: 'user:', notifyChanged: () => this.hommeDragon.notifyChanged() }`. L'AD ne le mentionne pas.
- `HommeDragonPage` (route `parties/:id/homme-dragon`, `app.routes.ts` l.94) **ne se connecte à aucun canal aujourd'hui** (aucun `realtime.connect` dans `features/homme-dragon/`). Seul `partie-detail.ts` l.445 connecte `partie:{id}`, ce qui couvre `HommeDragonSheet` quand il est embarqué dans `partie-detail.html` l.456. « La page de la fiche se connecte **aussi** aux canaux `partie:` » laisse croire à un existant : c'est un ajout net.
- **Les canaux `partie:` par aventure sont inutiles** : `ScenariosService.close()` (l.355-379, `status: 'PASSE'` posé l.368) appelle `parties.notifyPartieSignalsChanged(partieId, mjId)` (l.379), qui émet `userTopic` pour chaque participant **y compris le MJ** (`parties.service.ts` l.790-793, `resolveParticipants` = MJ + membres). Le propriétaire de l'Homme Dragon est le MJ de ses aventures effectives : son canal `user:` reçoit déjà l'événement de clôture (et ceux de composition du groupe, cf. `removeMember` l.353-354). Précédent exact : le calendrier personnel agrège plusieurs parties via `user:{id}` seul (`calendar-view.ts` ~l.1462-1470, commentaire « fan-out `notifyPartieSignalsChanged` »).
- `connect(topic)` ouvre bien **un `EventSource` par appel, jamais dédupliqué** (`realtime.service.ts` l.105-112, commentaire AD-6) ✅ — donc N aventures = N+1 connexions SSE, et la liste est **dynamique** (`aventures[]` change à chaque lien/délien) : il faudrait une logique de reconnexion (cf. `calendar-view.ts` l.1420-1442 pour le précédent). ⚠️ Non vérifié : la limite navigateur de ~6 connexions HTTP/1.1 par origine (dev en HTTP).
- **Correction** : supprimer les connexions `partie:` par aventure ; la page de fiche se connecte à `user:{id}` seul et `RealtimeService` reçoit l'entrée `'user:'` → `hommeDragon.notifyChanged`. « `ScenariosService` n'est pas modifié » reste vrai. Conséquence à noter : ce handler se déclenche sur tout événement `user:` (le service front dédoublonne déjà les `findOne` en vol, cf. `homme-dragon.service.ts` front l.26-40) — acceptable mais à garder en tête vu l'historique « tempête de requêtes » (commentaire l.25-29).
- Précision utile pour l'émission serveur : pour les écritures de fiche (réserve enregistrée à chaque geste), émettre **directement `emit(userTopic(propriétaire))`**, pas `notifyPartieSignalsChanged` (qui notifie MJ **et tous les membres** — rafraîchissement de `GET /me/party-signals` chez chacun à chaque geste). `notifyPartieSignalsChanged` ne se justifie que pour create/link/unlink, qui changent le signal `HOMME_DRAGON_A_CREER`. L'AD dit « `user:{propriétaire}` » : le préciser.

### F3 — ⚠️ Moyenne — « Lecture en lot : une requête de scénarios et une de membres » : sous-estimé et incompatible avec la réutilisation de `ScenariosService`

- Aujourd'hui `HommeDragonService.buildDto` (l.502-542) appelle, **par partie**, `parties.listMembers` (l.544-550) et `scenarios.findAllForPartie` (l.552-568). Cette dernière (`scenarios.service.ts` l.203-250) fait `getViewable` + `scenario.findMany` + `loadSeancesBatch` + `countParticipants` + `loadRetrospectiveNotes` par scénario + `scenarioParticipant.findMany` pour les campagnes épisodiques : inutilisable en lot et lourde.
- Un lot réel = `scenario.findMany({ where: { partieId: { in }, status: 'PASSE', closedAt: { not: null } } })` (le statut `PASSE` est persisté, `scenarios.service.ts` l.368 ⇒ filtrable en SQL ✅) + `membership.findMany({ where: { partieId: { in } } })` + **`scenarioParticipant.findMany`** (3e requête, absente de l'AD) + le `kind` de chaque partie. La règle des participants (épisodique : inscrits ; sinon : tous les membres actuels, `homme-dragon.service.ts` l.563-566) devra être **reproduite** dans `HommeDragonService` ou extraite en fonction pure partagée.
- Tension avec « `ScenariosService` n'est pas modifié / ne connaît pas les Hommes Dragons » : l'AD doit assumer que `HommeDragonService` lit directement les tables `Scenario`/`ScenarioParticipant`/`Membership`, et dire où vit la règle des participants (AD-4).
- **Correction** : remplacer par « trois requêtes groupées (scénarios `PASSE`, inscrits aux scénarios épisodiques, membres) pour l'ensemble des aventures effectives, plus la lecture des parties », et expliciter l'accès direct ou l'extraction.

### F4 — ⚠️ Moyenne — Migration : faisable en UNE passe, mais l'AD omet deux détails vérifiés

Sortie réelle de `prisma migrate diff --script` (Prisma 7.10.0, schéma du dépôt → schéma dérivé) :

```sql
ALTER TABLE "HommeDragon" DROP CONSTRAINT "HommeDragon_partieId_fkey";
DROP INDEX "HommeDragon_partieId_idx";
DROP INDEX "HommeDragon_userId_partieId_gameSystemId_key";
ALTER TABLE "Partie" ADD COLUMN     "hommeDragonId" TEXT;
ALTER TABLE "HommeDragon" DROP COLUMN "partieId";
ALTER TABLE "Partie" ADD CONSTRAINT "Partie_hommeDragonId_fkey" FOREIGN KEY ("hommeDragonId") REFERENCES "HommeDragon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- ✅ L'ordre « ajout colonne → rattrapage → drop » est réalisable dans une migration : Prisma émet déjà `ADD COLUMN "Partie"` **avant** `DROP COLUMN "HommeDragon"."partieId"` ; le `UPDATE` s'insère entre les deux (l'AddForeignKey peut rester en fin de fichier). Édition manuelle obligatoire : générer avec `--create-only` puis éditer.
- ✅ Précédents de migrations avec rattrapage SQL édité à la main : `20260805182210_user_display_name` (ADD nullable → `UPDATE … WHERE … IS NULL` → SET NOT NULL) et `20260712115353_scenarios_seances_p4` (`INSERT … SELECT … WHERE NOT EXISTS`, idempotent). Style à imiter : commentaire en tête expliquant l'édition manuelle. (Prisma 7 exige `migration_lock.toml` provider postgresql ✅ présent.)
- ✅ Syntaxe du rattrapage de l'AD valide en PostgreSQL 17 (`UPDATE … SET … FROM … WHERE`, doc `sql-update`). Réserve de la doc : si une ligne cible joint plusieurs lignes `FROM`, **laquelle est utilisée n'est pas prévisible**. Aujourd'hui au plus un `HommeDragon` par partie : `HommeDragon.userId` = MJ (création via `getOwned`, `homme-dragon.service.ts` l.54-80), `gameSystemId` toujours Ryuutama, et **aucun code ne modifie `Partie.mjId`** (recherche `mjId` en `data:` : aucune occurrence) ⇒ déterministe. Par prudence, ajouter `AND h."userId" = "Partie"."mjId"` (cohérent avec la définition d'aventure effective).
- ❌ Omission : **Prisma ne crée aucun index sur la FK `Partie.hommeDragonId`** (absent du SQL ci-dessus). Or `ON DELETE SET NULL` (suppression d'un Homme Dragon, ou du compte propriétaire) et la lecture `aventures` (`WHERE "hommeDragonId" = :h`) parcourent `Partie`. Ajouter `@@index([hommeDragonId])` sur `Partie` (le schéma actuel indexait `HommeDragon.partieId`, supprimé avec la colonne).
- ✅ « Aucun expand/contract : pas de production avant le Palier 11 » : `docs/backlog.md` l.180 « Palier 11 — Mise en production d'une première version ».

### F5 — ⚠️ Moyenne — `PATCH` générique sans verrou : l'écrasement que l'AD-22 prétend prévenir reste possible

- `HommeDragonService.update()` (l.101-154) fait lecture → fusion de **tout** `sheetData` → `update`, **sans transaction ni `FOR UPDATE`** (AD-2 « MJ seul écrivain »). Un `PATCH` concurrent d'un `PUT …/reserve/:slot` (verrouillé) ou d'un `eveil-power` peut réécrire un `sheetData` périmé et **perdre la réserve / l'éveil** écrits entre sa lecture et son écriture. AD-22 « Prevents … deux écritures concurrentes qui s'écrasent » et AD-23 « mécanique d'AD-22 inchangée » ne couvrent donc que les écritures verrouillées entre elles.
- Préexistant (hors périmètre strict d'AD-23), mais l'enregistrement automatique à chaque geste de la réserve en augmente la probabilité. **Correction** : faire passer le `PATCH` par le même `SELECT … FOR UPDATE` par `id` (ou le dire en limite connue).

### F6 — ℹ️ Basse — Signal `HOMME_DRAGON_A_CREER` : formulation et tests

- Aujourd'hui ce n'est **pas** « la requête groupée » partagée mais une requête dédiée : `party-signals.service.ts` l.47-50 `prisma.hommeDragon.findMany({ where: { userId, partieId: { in: mjPartieIds } }, select: { partieId: true } })`, consommée l.93 et l.146. Après AD-23 elle est **remplacée** par une lecture de `Partie` (ex. `partie.findMany({ where: { id: { in: mjPartieIds }, hommeDragon: { userId } }, select: { id: true } })`) : le nombre de requêtes reste identique ✅ (« aucune requête de plus » exact), mais ce n'est pas une lecture « dans » l'existante, et `PartieDto` ne porte pas `hommeDragonId` (jamais, AD-22).
- Le signal n'est **pas filtré Ryuutama côté serveur** (client : `my-characters.ts` l.104-115). « Le même prédicat » (effectivité, qui inclut Ryuutama) ne doit pas changer ce comportement sans le dire.
- `party-signals.service.spec.ts` mocke `prisma.hommeDragon.findMany` (l.144-153, 272…) : à réécrire.

### F7 — ℹ️ Basse — Effectivité : clauses `mjId` et Ryuutama aujourd'hui dormantes, impasse potentielle non couverte

- `partie.mjId = H.userId` : sans effet aujourd'hui (aucun transfert de MJ dans le code). Le JSDoc de `findMine` (l.451-458, « un ancien MJ ») anticipe un cas qui n'existe pas encore — pas une erreur d'AD-23, mais la clause est de la défense, pas un comportement vérifiable.
- Si un transfert de MJ ou un changement de système (`UpdatePartieDto.gameSystemId` est éditable, `update-partie.dto.ts` ; cf. commentaire `homme-dragon.service.ts` l.108-110) laissait un lien non effectif : `GET /parties/:id/homme-dragon` renvoie `null`, link répond `409` (lien déjà présent), et **unlink est « Ryuutama seul » et exige `:h`** que le nouveau MJ ne peut pas lire. L'AD ne précise pas la forme d'appel de link/unlink (corps ? paramètre ?) ni ce cas. À trancher : `unlink` accepte-t-il un lien non effectif ? (Pas d'urgence tant qu'aucun transfert n'existe.)
- Rattrapage de `findMine` : le filtre actuel `partie: { mjId: userId }` (l.461) disparaît (« propriétaire seul ») ; sans transfert de MJ le résultat est identique.

### F8 — ℹ️ Info — Lien atomique : `updateMany` ✅

- Exprimable avec Prisma : `tx.partie.updateMany({ where: { id: partieId, hommeDragonId: null }, data: { hommeDragonId: h } })` → `{ count }` ; `count === 0` ⇒ `ConflictException` (409). Précédent exact dans le dépôt : `auth.service.ts` l.217-223 (`passwordResetToken.updateMany({ where: { id, usedAt: null, … } })` puis `claim.count === 0` ⇒ exception, dans `$transaction`). Délier : `where: { id, hommeDragonId: h }`.
- Concurrence ✅ : en READ COMMITTED (isolation par défaut, aucun `isolationLevel` dans `src/`), un second `UPDATE … WHERE … IS NULL` attend le verrou de ligne puis **réévalue le `WHERE`** sur la version mise à jour (doc PG17 § 13.2.1) ⇒ 0 ligne ; une exception levée dans `$transaction(async tx => …)` annule aussi l'`INSERT` de l'Homme Dragon (« une création qui perd la course est annulée »).
- Réserve mineure : si l'Homme Dragon est supprimé entre la vérification de propriété et l'`updateMany`, la FK lève `P2003` (500 si non mappée) — fenêtre négligeable, mapper en 404/409.

### F9 — ✅ Info — Motif `SELECT … FOR UPDATE` : conforme, clé de verrou effectivement à changer

- Usage actuel (`homme-dragon.service.ts` l.192, 273, 368) : ``tx.$queryRaw`SELECT id FROM "HommeDragon" WHERE "userId" = ${userId} AND "partieId" = ${partieId} AND "gameSystemId" = ${RYUUTAMA_ID} FOR UPDATE` `` dans un `$transaction`, résultat ignoré, puis `tx.hommeDragon.findUnique(userId_partieId_gameSystemId)` et `update`. Le verrou est donc **par clé composite, pas par id** : l'AD-23 « désormais par `id` » décrit un changement réel ; l'AD-22 lui-même ne dit que « `SELECT … FOR UPDATE` » (pas de clé) ✅.
- « Le niveau est lu avant le verrou comme aujourd'hui » ✅ (niveau calculé l.186-188, 267-269, 354-356, avant le `$transaction`).
- À l'implémentation : verrouiller `WHERE id = ${id} AND "userId" = ${userId}` ; le `findUnique` sous verrou conserve la fraîcheur (READ COMMITTED : la ligne verrouillée renvoyée est la version à jour, doc PG17).

---

## 2. Affirmations d'AD-23 sur l'état actuel — table de vérification

| Affirmation | Statut | Source |
|---|---|---|
| FR-59 « Homme Dragon propre à une aventure » : `partieId` sur la fiche, unicité `[userId, partieId, gameSystemId]` | ✅ | `schema.prisma` l.422-433 ; migration `20260716211609_homme_dragon` |
| `userId` cascade `User`, `@@index([userId])` conservés | ✅ | `schema.prisma` l.421, 432 |
| Routes actuelles `parties/:id/homme-dragon` : POST (create), GET, PATCH, `eveil-power`, `artefact-cadeau`, `PUT reserve/:slot`, `GET export.pdf` ; AD-23 les reprend sous `/homme-dragons/:id` | ✅ | `homme-dragon.controller.ts` l.26-107 |
| `GET /me/homme-dragons` existant, filtré `userId` + `partie.mjId = userId`, une requête | ✅ (AD-23 retire le filtre `mjId`) | `my-homme-dragons.controller.ts` ; `homme-dragon.service.ts` l.459-479 |
| `HommeDragonDto` porte `partieId` et `voyageursProteges` plat | ✅ | `packages/shared/src/index.ts` ~l.1205-1228 ; `homme-dragon.service.ts` l.528-541 |
| `MyHommeDragonDto` porte `partieId`/`partieName` | ✅ | `packages/shared/src/index.ts` ~l.1236-1245 ; `findMine` l.468-477 |
| Garde actuelle `getOwned(partie)` pour lecture/écriture ; lecture MJ seul, 403 non-MJ | ✅ | `homme-dragon.service.ts` l.54, 106, 175, 260, 344, 436 |
| `UpdateHommeDragonDto` exclut `race`, `artefactCadeau`, `reserve` | ✅ | `packages/shared/src/index.ts` ~l.1253-1255 |
| Émission actuelle `partieTopic(partieId)` après écriture, hors transaction | ✅ | `homme-dragon.service.ts` l.81, 152, 243, 323, 409 |
| `create()` appelle déjà `notifyPartieSignalsChanged` (signal 29.7) ; les autres écritures non | ✅ | l.84 (seul appel) |
| Signal `HOMME_DRAGON_A_CREER` dérivé d'une requête `hommeDragon` groupée, sans requête par partie | ✅ (voir F6 sur la formulation) | `party-signals.service.ts` l.47-50, 93, 146 |
| Front : `connect(topic)` → un `EventSource` par connexion, pas de partage | ✅ | `realtime.service.ts` l.105-112 (+ `urlForTopic` l.38-46) |
| AD-14 : la liste (dashboard) écoute `user:` seul | ✅ | `dashboard.ts` l.434-435 |
| `HommeDragonSheet` se rafraîchit sur `hommeDragon.changed` | ✅ mais câblé `'partie:'` seulement (F2) | `homme-dragon-sheet.ts` l.183 ; `realtime.service.ts` l.86 |
| P7-AD-2 (émission en fin de méthode, hors transaction) existe | ✅ | spine 2026-07-24 ; référencé spine l.283 |
| « Pas de production avant le Palier 11 » | ✅ | `docs/backlog.md` l.180 |

---

## 3. Sources et limites

- **Outillage** : `graphify query` exécuté en premier (graphe présent, partiellement périmé pour certains fichiers) ; `mcp__context7` chargé (Prisma `/websites/prisma_io`, PostgreSQL `/websites/postgresql_17`). Réserve : la documentation Prisma renvoyée par context7 correspond à une version plus récente que celle du dépôt (mentions de « Prisma ORM 8 », `contract emit`) ; je ne m'en suis servi que pour la sémantique stable des actions référentielles (`SetNull` exige une FK optionnelle, relation liste côté inverse, nommage en cas de deux relations). Toute vérification dépendante de la version a été faite sur le Prisma installé : **7.10.0** (`pnpm-lock.yaml` l.2358, l.6266).
- **Vérifications exécutées** (aucun fichier du dépôt modifié) : dans le conteneur `api` déjà en cours (`docker compose exec`, binaire `prisma` du projet), un schéma dérivé a été écrit dans `/tmp` du conteneur (supprimé ensuite), puis `prisma migrate diff --script --from-schema … --to-schema …` et `prisma validate`. Aucune connexion à la base, aucune migration appliquée.
- **Non rejoué** : le cas « `Partie.hommeDragons` conservé » (F1) — conclusion tirée de la documentation Prisma (`PSL_AMBIGUOUS_BACKRELATION`), pas d'un essai (ma première tentative de variante n'a pas produit le schéma voulu).
- **Non vérifié** : limite de connexions SSE par origine côté navigateur (F2) ; comportement exact du proxy de dev vis-à-vis de N flux SSE.
- **Rappel domaine/réglementaire** : l'AD touche la lecture/écriture d'une fiche liée à un propriétaire (404 au lieu de 403 pour ne pas divulguer l'existence, NFR1) ; sans incidence IEC 62304 (application non médicale). Rappel projet : `/security-review` conseillé à la fin de la 33.8 (nouvelle surface `GET|PATCH|PUT /homme-dragons/:id`, garde par propriétaire, 404 uniforme).
