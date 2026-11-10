# Revue AD-23 (+ amendements AD-22) — lentille « intégrité des données et sécurité d'accès »

Date : 2026-10-04. Portée : `ARCHITECTURE-SPINE.md` AD-22/AD-23, confrontés au code réel
(`apps/api/src/homme-dragon/*`, `parties/*`, `scenarios/*`, `realtime/*`, `prisma/schema.prisma`,
`prisma/seed-demo.ts`). Lecture seule hors ce fichier.

## Verdict

**AD-23 est sain sur son cœur** (lien porté par `Partie`, `UPDATE … WHERE "hommeDragonId" IS NULL`
atomique, `404` unique pour absent/étranger, émission SSE sur `user:` et non plus `partie:`), et
aucune fuite vers un non-propriétaire n'est introduite **si l'AD est appliquée à la lettre**.
**Mais il reste 1 point de sécurité-par-construction à durcir et 4 failles d'intégrité réelles
non couvertes** (dont une préexistante que l'AD prétend traiter). Aucune n'est bloquante pour le
modèle ; toutes se corrigent par du texte dans l'AD. Verdict : **« à amender avant la story 33.8 »**.

Faits vérifiés dans le code (base de la revue) :
- `Partie.mjId` n'est écrit qu'à la création (`parties.service.ts create()`), aucune route de
  transfert de MJ ; `HommeDragon.userId` n'est écrit que par `create()` après `getOwned`. Donc
  `H.userId = partie.mjId` est vrai sur toutes les données existantes.
- Aucune route de suppression de scénario ni de retour arrière de `PASSE` (`scenarios.service.ts` :
  seul `close()` écrit `PASSE`, aucun `delete`) ; `convertKind()` ne touche pas aux `PASSE`. Un
  scénario `PASSE` ne disparaît donc que par **suppression de la partie**.
- Aucune route de suppression de compte dans l'API (`account.controller.ts` : seulement
  `Delete favorites/:partieId`) : le chemin « suppression de compte » n'existe qu'en cascade SQL.
- `toPartieDto()` est un mapping explicite champ par champ ; aucun service ne renvoie une ligne
  `Partie` brute (grep `return partie;` : uniquement les gardes `getOwned/getViewable`, jamais
  sérialisées telles quelles). Ajouter `hommeDragonId` au schéma **ne fuit donc pas
  automatiquement** (contrairement au risque C-3 de `review-versions.md`).
- Seed : `seed-demo.ts` crée 2 `HommeDragon` (oneShot, lineaire), tous deux `userId = mj.id` sur des
  parties dont `mjId = mj.id`, parties distinctes. Aucun cas « plusieurs lignes pour une même
  partie ». Aucun autre `hommeDragon.create` dans `src` ou `packages`.

---

## Findings

### F1 — Moyenne — L'effectivité sera décidée à trois endroits, et le lot « membres/scénarios » contourne la garde de lecture

**Constat (code).** AD-23 impose « une seule fonction » pour l'effectivité, mais :
1. `findMine()` est volontairement **sans `buildDto`** (commentaire du code : « sans buildDto ») et
   doit désormais produire `aventures: [{ partieId, nom }]` — l'AD ne dit pas que ce champ applique
   le prédicat ;
2. le signal `HOMME_DRAGON_A_CREER` applique « le même prédicat sans appeler la fonction » ;
3. la fonction unique elle-même.
Trois implémentations du même prédicat divergent tôt ou tard (le `findMine` actuel filtre déjà
`partie: { mjId: userId }` alors que le signal actuel filtre `partieId in mjPartieIds` : deux
variantes du même invariant dans le code d'aujourd'hui).
Par ailleurs, la lecture en lot prévue (« une requête de scénarios et une de membres pour
l'ensemble des aventures ») **remplace** `computeVoyageursProteges()` (→ `listMembers()` →
`getViewable()`) et `computeHistorique()` (→ `findAllForPartie()` → `getViewable()` + gestion des
`participants` épisodiques). La garde implicite de ces deux chemins disparaît : si la requête en lot
omet `mjId = H.userId`, l'Homme Dragon lirait le roster d'une partie d'un autre MJ ; si elle
sélectionne `email`/`displayName`, l'e-mail des membres fuit (aujourd'hui réservé au MJ, AD-2).

**Scénario.** Un futur chemin (ou une régression) lie `H` à une partie dont `mjId ≠ H.userId` ;
`GET /homme-dragons/:id` du propriétaire renvoie alors pseudos et titres de scénarios d'un tiers.

**Correction proposée (à ajouter dans « Aventure effective »).**
> Le prédicat d'effectivité est exporté **une seule fois** comme fragment de requête Prisma
> (`effectiveAventuresWhere(h: { id, userId })` = `{ hommeDragonId: h.id, mjId: h.userId,
> gameSystemId: RYUUTAMA_ID }`) et réutilisé tel quel par la fonction unique, par
> `GET /me/homme-dragons` et par la requête groupée du signal 29.7 ; aucun des trois ne le réécrit.
> Les lectures en lot (membres, scénarios `PASSE`) portent ce même `where` — la garde est
> **dans la requête**, plus dans `getViewable`. Le `select` des membres est limité à
> `{ userId, pseudo }` (jamais `email`, `displayName`). Le calcul de `participants` reproduit la règle
> `CAMPAGNE_EPISODIQUE` (inscrits) / autres types (tous les membres) de `computeHistorique()`.
> Test d'acceptation : un Homme Dragon lié (par insertion SQL directe) à une partie d'un autre MJ
> ne renvoie ni voyageurs, ni historique, ni aventure.

### F2 — Moyenne — Le `UPDATE` de lien ne porte pas les conditions d'autorisation : fenêtre TOCTOU et code d'erreur oracle

**Constat.** AD-23 : « Lier est un `UPDATE … WHERE id = :p AND "hommeDragonId" IS NULL` » ; la
propriété de `H`, le MJ de la partie et « Ryuutama seul » sont vérifiés **avant**, par des lectures
séparées (`getOwned`, puis lecture de `H`). Entre ces lectures et l'`UPDATE`, un
`PATCH /parties/:id { gameSystemId }` (route éditable, `UpdatePartieDto.gameSystemId`) peut faire
sortir la partie de Ryuutama : le lien est posé sur une partie non effective, invisible
(`GET …/homme-dragon` renvoie `null`) mais qui **occupe l'emplacement** et fait répondre `409` à tout
lien suivant. Par ailleurs l'AD ne dit pas quel code renvoie « lier une `H` dont je ne suis pas
propriétaire » : un `403` ferait de la route un oracle d'existence d'UUID d'Hommes Dragons, ce que
l'AD interdit explicitement ailleurs.

**Correction proposée.**
> Lier est **un seul statement** portant toutes les conditions :
> `UPDATE "Partie" SET "hommeDragonId" = :h WHERE id = :p AND "mjId" = :caller AND
> "gameSystemId" = 'ryuutama' AND "hommeDragonId" IS NULL AND EXISTS (SELECT 1 FROM "HommeDragon"
> WHERE id = :h AND "userId" = :caller)`. Zéro ligne → on distingue **après coup** (relecture) :
> `H` absent ou étranger → `404` (jamais `403`, vérifié **avant** le `409`) ; partie déjà liée →
> `409`. Délier est `… WHERE id = :p AND "mjId" = :caller AND "hommeDragonId" = :h` et **n'exige pas**
> Ryuutama (voir F5) : on doit toujours pouvoir libérer l'emplacement.
> `Partie.mjId` et `HommeDragon.userId` sont **immuables** (aucune route de transfert, cf. « Ne pas
> transférer ») ; c'est ce qui rend `mjId = userId` vrai par construction, à ne pas rouvrir sans
> amender cet AD (un transfert de MJ doit alors délier tous les Hommes Dragons de la partie).

### F3 — Moyenne — `PATCH` générique hors verrou : une écriture de fiche peut écraser la réserve (préexistant, mais AD-22 affirme l'avoir prévenu)

**Constat (code, `homme-dragon.service.ts` `update()`, l. 116-151).** `update()` fait `findUnique` **hors
transaction**, fusionne `{ ...existingSheetData, ...dto }`, puis `update` du `sheetData` **entier**,
sans `SELECT … FOR UPDATE`. AD-22 écrit pourtant que son mécanisme prévient « deux écritures
concurrentes qui s'écrasent », et AD-23 dit « mécanique d'AD-22 inchangée » **pour les écritures
éveil/artefact/réserve** seulement. La réserve étant enregistrée **à chaque geste** (autosave), un
`PATCH` (identité, artefact) en vol sur un second onglet/appareil du même MJ relit l'ancienne
`reserve`, puis la réécrit après qu'un `PUT …/reserve/:slot` a validé : le geste de réserve est perdu
silencieusement (et idem pour `eveilPowers` et `artefactCadeau`, également présents dans l'objet
fusionné).

**Scénario.** Onglet A : le MJ enregistre un souffle sur l'emplacement 2 ; onglet B (formulaire
d'identité ouvert avant) : « Enregistrer » → `PATCH` relit `reserve` avant le commit de A, écrit après :
emplacement 2 vide. Aucune erreur, aucun signal. Fenêtre étroite mais réelle, et `eveilPowers`
(choix **définitif**, non rejouable côté UI) est exposé de la même façon.

**Correction proposée (« Adressage et garde »).**
> **Toutes** les écritures de `sheetData`, `PATCH` générique compris, passent par la même séquence :
> `$transaction` → `SELECT … FOR UPDATE` par `id` → relecture `findFirst({ id, userId })` sous verrou
> → fusion sur la copie → écriture. Le `PATCH` ne relit jamais l'état hors transaction. Les clés
> pilotées par route dédiée (`reserve`, `eveilPowers`, `artefactCadeau`) sont **reprises de la ligne
> lue sous verrou**, jamais du `dto` ni d'une lecture antérieure.

### F4 — Faible — Niveau lu hors verrou ; la dissociation concurrente n'est pas sérialisée par le verrou de l'Homme Dragon

**Constat.** AD-23 conserve « le niveau est lu avant le verrou » et affirme qu'une dissociation
concurrente « ne purge rien ». C'est exact pour l'absence de purge, mais le verrou posé est sur la
ligne `HommeDragon` alors que `unlink` écrit la ligne `Partie` : **aucun des deux ne bloque l'autre**.
Séquence : l'écriture lit le niveau 3 → `unlink` commit (niveau 1) → l'écriture prend le verrou et
valide un éveil de niveau 3 / un artefact de niveau 4 / une réserve de capacité 2 sur une base
périmée. Le sens dangereux est la **baisse** (une clôture de scénario concurrente ne fait que monter,
donc sans risque). Un seul acteur (le MJ) rend le risque faible, mais l'écriture résultante viole
l'invariant « un choix n'est accepté que si le niveau actuel l'autorise ».

**Correction proposée.**
> Le niveau est calculé **dans la transaction, après** `SELECT … FOR UPDATE` (la fonction unique de
> l'AD est déjà une lecture en lot : coût marginal). Pour sérialiser aussi `unlink`/`delete partie` :
> verrouiller l'Homme Dragon en **`FOR NO KEY UPDATE`** (et non `FOR UPDATE`), puis les lignes
> `Partie` de ses aventures en `FOR SHARE`. Le `FOR NO KEY UPDATE` est nécessaire : un `link`
> (`UPDATE "Partie"`) pose une FK vers `HommeDragon` qui prend un `FOR KEY SHARE` sur la ligne `H`, en
> conflit avec `FOR UPDATE` — verrouiller ensuite la `Partie` créerait un interblocage (`40P01`).
> À défaut, documenter explicitement que la fenêtre résiduelle est acceptée (acteur unique).

### F5 — Moyenne — Perte silencieuse de niveau et contenu « au-dessus du niveau » non spécifiés (suppression de partie, changement de système, dissociation)

**Constat.** Trois événements retirent une aventure de l'ensemble effectif : suppression de la partie
(cascade : ses scénarios `PASSE` disparaissent avec elle — c'est la **seule** façon de perdre un
`PASSE`), `PATCH gameSystemId` hors Ryuutama (`parties.service.ts update()` : écriture libre, sans
aucune vérification de ce qui est lié à la partie), `unlink`. Dans les trois cas le niveau **baisse
sans trace ni confirmation**, alors que `sheetData` conserve `eveilPowers`, `artefactCadeau`,
`reserve` de niveaux désormais non atteints. Conséquences vérifiées dans le code :
- `chooseArtefactCadeau` refuse « déjà choisi » alors que `level < 4` : fiche à niveau 2 portant un
  artefact de niveau 4 ;
- `setReserveSlot` refuse **toute** écriture quand `reserveCapacity(level) < 1`, **y compris un
  retrait** : à niveau 1, une réserve peuplée est figée, ni lisible comme « hors capacité » ni
  retirable ;
- `pendingEveilLevels` ne compte que les niveaux ≤ courant : les éveils appliqués au-delà
  s'affichent sans que le niveau les justifie.
- `PartiesService.remove()` n'émet **aucun** événement (ni `partieTopic`, ni `userTopic`) : la page
  de l'Homme Dragon ouverte affiche l'aventure supprimée et le niveau périmé jusqu'au rechargement.
- L'AD ne dit pas si `Partie.update` conserve `hommeDragonId` à la sortie de Ryuutama. Conservé : la
  partie « occupe » l'emplacement sans être visible ni déliable (si `unlink` exige Ryuutama, cf. F2) ;
  effacé : la perte du lien est silencieuse et le retour à Ryuutama ne restaure rien.
Le niveau étant dérivé (AD-3) et `sheetData` intact, **rien n'est perdu définitivement** tant que la
partie n'est pas supprimée ; c'est la suppression de partie qui détruit réellement l'historique (donc
le niveau) d'un Homme Dragon survivant.

**Correction proposée (nouveau paragraphe « Aventure qui cesse d'être effective »).**
> Dissociation, suppression de partie et sortie de Ryuutama sont **équivalentes** pour la fiche : le
> niveau baisse à la lecture suivante, `sheetData` n'est ni purgé ni masqué. Le contenu au-dessus du
> niveau (éveils, artefact cadeau, souffles de la réserve au-delà de la capacité) reste **lisible et
> affiché** comme tel ; seuls les **nouveaux** choix sont refusés. Le **retrait** d'un emplacement de
> réserve reste permis à tout niveau, y compris 1 (amende AD-22 « au niveau 1 toute écriture est
> refusée »). `Partie.update` **ne modifie jamais** `hommeDragonId` ; `unlink` n'exige pas Ryuutama et
> reste possible sur une partie non effective, pour libérer l'emplacement. Le formulaire de
> suppression de partie et le changement de système affichent, si `hommeDragonId` est non nul, un
> avertissement « le niveau de votre Homme Dragon peut baisser » (non bloquant ; l'information vient du
> `GET /parties/:id/homme-dragon` MJ seul). `PartiesService.remove()` émet `user:{mjId}` après la
> suppression (l'id de l'Homme Dragon est lu avant), et `update()` sur changement de `gameSystemId`
> émet aussi `user:{mjId}` — la page de la fiche ne doit pas dépendre du seul canal `partie:`.
> *Option à trancher par le produit (non retenue par défaut)* : un « plus haut niveau atteint »
> persisté éviterait toute baisse mais contredit AD-3 (dérivé jamais persisté) — à n'ouvrir que si la
> baisse est jugée inacceptable.

### F6 — Moyenne (opérationnelle) — Migration : rattrapage non défensif, ordre non garanti par Prisma, seed et indexation oubliés

**Constat.** (a) La clé unique actuelle est `[userId, partieId, gameSystemId]` : **plusieurs lignes pour
une même `partieId` sont possibles au niveau SQL** (userId ou gameSystemId différents) même si le code
et le seed n'en créent jamais. `UPDATE … FROM "HommeDragon" h WHERE h."partieId" = "Partie"."id"` choisit
alors **arbitrairement** une ligne en silence ; les autres perdent leur seule trace de partie à
`DROP COLUMN "partieId"` (elles survivent, sans aventure, irrécupérables). (b) Le rattrapage ne filtre
ni `h."userId" = "Partie"."mjId"` ni Ryuutama : une ligne incohérente serait liée au mauvais MJ.
(c) `prisma migrate dev` génère `ADD COLUMN` + `DROP COLUMN` sans rattrapage ; sans `--create-only` et
édition manuelle **entre** les deux, la colonne est supprimée avant la copie : perte totale du lien
(et Prisma avertit de la perte de données, ce qui pousse à `--accept-data-loss`). (d)
`prisma/seed-demo.ts` (l. 481 et 710) crée des `HommeDragon` avec `partieId` : le seed ne compile plus
après la migration ; l'AD ne le mentionne pas, ni les mocks de `party-signals.service.spec.ts`
(`findMany` renvoyant `{ partieId }`). (e) `Partie.hommeDragonId` n'a pas d'index alors que `aventures`
(`WHERE hommeDragonId = H`), le signal et le `ON DELETE SET NULL` le parcourent ; seul
`HommeDragon @@index([userId])` est cité.

**Correction proposée (paragraphe « Migration »).**
> Migration créée avec `prisma migrate dev --create-only`, SQL édité dans cet ordre : (1) `ADD COLUMN`
> + FK `ON DELETE SET NULL` + `CREATE INDEX "Partie_hommeDragonId_idx"` ; (2) **garde** :
> `DO $$ BEGIN IF EXISTS (SELECT 1 FROM "HommeDragon" GROUP BY "partieId" HAVING count(*) > 1) THEN
> RAISE EXCEPTION '…'; END IF; END $$;` ; (3) rattrapage
> `UPDATE "Partie" p SET "hommeDragonId" = h."id" FROM "HommeDragon" h WHERE h."partieId" = p."id" AND
> h."userId" = p."mjId"` ; (4) **contrôle** : `RAISE EXCEPTION` si une ligne `HommeDragon` n'a reçu
> aucun lien (`NOT EXISTS (SELECT 1 FROM "Partie" WHERE "hommeDragonId" = h."id")`), pour ne jamais
> supprimer silencieusement la dernière trace d'une partie ; (5) `DROP INDEX` + `DROP COLUMN
> "partieId"` + `DROP` de l'unicité. La migration est irréversible (documenté ; pas de production
> avant le Palier 11). Même story : mise à jour de `seed-demo.ts` (création de l'Homme Dragon puis
> `partie.update({ hommeDragonId })`), des specs de signaux et de `findMine`.

### F7 — Faible — Surfaces de fuite à expliciter dans l'AD (aucune faille avec le texte actuel, mais rien ne les verrouille)

Vérifié et **couvert** : `GET /homme-dragons/:id` et export PDF (`404` unique), `PartieDto`
(mapping explicite, pas de champ ajouté), DTO de séance (inchangé), `/me/homme-dragons` (filtre
propriétaire), SSE `user:` (abonné = son propriétaire uniquement, `RealtimeController.userEvents`),
signal 29.7 (rôle `mj` seul). Vérifié et **non couvert par le texte** :
1. **`PartieDto` ne doit pas porter `hommeDragonId`** (ni un booléen « a un Homme Dragon ») : il est
   servi à tous les membres. AD-22 le dit pour `reserve`, AD-23 non.
2. **Aucune écriture de fiche n'émet plus `partie:{id}`** : ce canal est abonné par tout membre
   (`getViewable`) ; émettre dessus pour une écriture de fiche révèle aux joueurs l'existence et le
   rythme d'édition. Aujourd'hui `create/update/chooseEveilPower/chooseArtefactCadeau/setReserveSlot`
   émettent `partieTopic` : à retirer, pas seulement à ajouter `user:`. Exception acceptée : les
   événements qui changent déjà des données publiques de la partie (scénario clos, membres).
3. **Lier/délier/créer** n'émettent que `user:{propriétaire}`, jamais `partie:` (même raison) ; le
   signal 29.7 (`notifyPartieSignalsChanged`) existe déjà et suffit côté MJ.
4. Dans la transaction d'écriture, relire `findFirst({ id, userId })` et non `findUnique({ id })` :
   le `404` unique doit survivre à un futur refactor qui ne garderait que le verrou par `id`.
5. Nom de fichier de l'export PDF : aujourd'hui `homme-dragon-${partieId}-…` ; devient l'`id` de
   l'Homme Dragon, jamais un id de partie (qui peut ne plus exister ou n'être qu'une aventure parmi N).
6. `GET /parties/:id/homme-dragon` (référence `{ id, nom }`) : `getOwned` donne `403` à un non-MJ — comme
   toutes les routes MJ de partie ; pas un problème propre à l'Homme Dragon, mais l'AD doit préciser
   `null` (et non la référence) pour une partie liée non effective, et la requête de la référence
   applique le fragment de F1.

---

## Réponses aux points demandés

**(a) Suppression de partie / de compte / changement de système.**
Partie supprimée : `Partie.hommeDragonId` n'existe plus ; `HommeDragon` intact (SetNull n'agit que
sur les lignes `Partie` référençantes, supprimées avec elles) → pas d'orphelin. Niveau : baisse du
nombre de `PASSE` de cette aventure (perte réelle d'historique, F5). Compte du MJ supprimé : cascade
`User → HommeDragon` et `User → Partie` ; seules des parties du même MJ peuvent référencer `H`
(F2), donc aucune `Partie` d'un tiers ne reste avec un lien pendant (SetNull l'aurait de toute façon
nettoyé). Aucune route de suppression de compte n'existe aujourd'hui. Changement de système : le lien
reste (si `Partie.update` ne l'efface pas — à spécifier, F5), l'aventure devient non effective, niveau
en baisse, retour à Ryuutama restaure tout.

**(b) Fuites.** Voir F7 ; risque principal = les lectures en lot qui contournent `getViewable` (F1).

**(c) Migration / unicité.** Code et seed : une ligne par partie, `userId = mjId`. SQL : plusieurs
lignes possibles → garde et prédicat `userId = mjId` (F6).

**(d) Concurrence.** `create`+`link` : l'`UPDATE … IS NULL` sous `READ COMMITTED` relit la condition après
attente du verrou de ligne → le perdant obtient 0 ligne, `409`, rollback de sa création : correct.
Lien contre changement de système : TOCTOU (F2). Écritures de fiche contre dissociation : niveau
périmé (F4). `PATCH` contre `PUT reserve` : perte d'écriture (F3).

**(e) Niveau ↔ historique.** Un `PASSE` ne disparaît que par suppression de partie ; les trois causes de
non-effectivité sont traitées en F5 (niveau dérivé, contenu au-dessus du niveau conservé et lisible,
retrait de réserve autorisé à tout niveau).
