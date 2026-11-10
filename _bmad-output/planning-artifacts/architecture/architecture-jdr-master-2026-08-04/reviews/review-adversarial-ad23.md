# Revue adversariale — AD-23 (Homme Dragon multi-aventures) et amendements d'AD-22

Cible : `ARCHITECTURE-SPINE.md` (mise à jour 2026-10-04), AD-23 et les parenthèses « depuis AD-23 » d'AD-22.
Méthode : j'ai cherché des paires d'unités de niveau inférieur qui respectent chacune AD-23 à la lettre et construisent pourtant de façon incompatible. Chaque affirmation ci-dessous a été vérifiée dans le code brownfield (état de départ). Lecture seule sur le dépôt.

## Verdict

**AD-23 n'est pas prête à être implémentée telle quelle : à resserrer (7 trous, dont 2 bloquants, 3 élevés).**
Le cœur du modèle est sain (lien porté par `Partie`, `UPDATE` conditionnel, `404` uniforme, dérivation cumulée à la lecture). La création et le lien concurrents sont corrects : sous READ COMMITTED, le second `UPDATE … WHERE "hommeDragonId" IS NULL` attend le verrou de ligne puis réévalue son prédicat, donc renvoie zéro ligne ; la transaction de création est annulée. Les failles sont ailleurs : le prédicat « aventure effective » existe en quatre exemplaires qui ne peuvent pas s'accorder, le niveau est lu hors du verrou alors que lien/délien le font maintenant bouger, le choix d'émission SSE contredit AD-14 et le câblage front réel, la lecture en lot n'a pas de propriétaire, et le contrat HTTP/front des routes link/unlink n'est pas écrit.

Gravité : B = bloquant (deux stories divergent à coup sûr), E = élevé, M = moyen, F = faible.

---

## F1 (B) — « Aventure effective » : un prédicat à quatre implémentations, et des états « lié mais non effectif » sans issue

**Paire :** story signal 29.7 (back, `party-signals.service.ts`) × story fiche 33.8 (back, `HommeDragonService`) × story `GET /parties/:id/homme-dragon` × story « Personnages » (front).

**Ce qu'AD-23 dit, de façon contradictoire.**
- L'effectivité = lien ET `partie.mjId = H.userId` ET Ryuutama. « La requête groupée du signal applique le même prédicat sans appeler la fonction. »
- Mais plus bas : le signal est « lu sur `Partie.hommeDragonId` dans la requête groupée existante : aucune requête de plus ».
- `GET /parties/:id/homme-dragon` renvoie `null` « si la partie n'a pas d'aventure effective ». `create`/`link` exigent `hommeDragonId IS NULL` (`409` sinon). `unlink` est « Ryuutama seul ».

**Preuves dans le code.**
- `party-signals.service.ts` ne voit que des `PartieDto` (`listForUser` → `toPartieDto`). `hommeDragonId` n'y figure pas (AD-15 énumère les champs) et `userId` du dragon encore moins : le prédicat « effectif » ne peut donc pas s'appliquer « sans requête de plus » (L26-31, L47-50 : aujourd'hui une requête `hommeDragon.findMany` dédiée).
- Le signal n'est **pas** filtré par système côté serveur : `computeSignals` ajoute `HOMME_DRAGON_A_CREER` pour toute partie MJ sans fiche (L146). Le filtre `p.gameSystemId === 'ryuutama'` vit côté front (`my-characters.ts:104-116`, commentaire explicite). Lu littéralement, « applique le même prédicat » donnerait `HOMME_DRAGON_A_CREER` = « pas effectif » = vrai pour toute partie non Ryuutama.
- `PartiesService.update()` accepte un changement de `gameSystemId` (`data: { ...dto }`, L363-397), et aucun code du dépôt ne modifie `mjId` (grep : aucune écriture). Aujourd'hui seule Ryuutama a `module: true` (`shared/index.ts:105-110`), donc ces deux clauses du prédicat sont **inatteignables pour des données nouvelles** ; elles ne le sont que pour des fiches existantes dont la partie a basculé avant la story 29.17 (le commentaire de `HommeDragonService.update()` L108-110 documente ce cas : « fiche orpheline »).

**Incompatibilité construite.**
- Dev A (signal) lit `hommeDragonId IS NULL` : une partie liée mais non effective ne signale rien.
- Dev B (fiche) : `GET` renvoie `null` → le front propose « Créer » → `POST` fait un `409` (lien non nul). Impasse.
- Dev C (unlink) : Ryuutama seul, donc une partie sortie de Ryuutama ne peut pas être déliée ; `H.userId ≠ mjId` (données héritées) : le MJ de la partie ne possède pas H, et AD-23 ne dit pas si `unlink` exige la propriété de H.
- Dev D (« Personnages ») : `MyHommeDragonDto.aventures` = liées ou effectives ? Aucune AD ne tranche, `findMine` aujourd'hui filtre `partie.mjId = userId`.
- Effet de bord de la migration : le rattrapage SQL lie **toute** fiche à sa partie, y compris les orphelines non-Ryuutama. Niveau lu = 1 (aventures effectives vides) alors que `sheetData` porte des éveils niveau 2-5 : fiche incohérente et non déliable.

**Correction proposée (recommandée) — rendre l'état impossible par construction plutôt que de le dériver.** À insérer dans AD-23, paragraphe « Aventure effective », en remplacement du prédicat à trois clauses :

> **Invariant de lien.** `Partie.hommeDragonId` non nul implique `partie.mjId = H.userId` et `partie.gameSystemId = ryuutama`. Cet invariant est établi par les seuls écrivains du lien : `create`/`link` (vérifient propriétaire et système), la migration (ne lie que les paires qui le satisfont, cf. ci-dessous) et **tout chemin qui modifie `Partie.mjId` ou `Partie.gameSystemId`, qui met `hommeDragonId` à `NULL` dans le même `UPDATE`** (`PartiesService.update()` aujourd'hui ; le futur transfert de MJ ensuite). Il n'existe donc **pas** de prédicat « effectif » à recalculer : *aventure effective = `Partie.hommeDragonId = H.id`*, et c'est la définition unique, lue telle quelle par la fonction de `HommeDragonService`, par `findMine`, par la requête du signal et par `GET /parties/:id/homme-dragon`.
> **Signal.** `HOMME_DRAGON_A_CREER` = MJ ∧ système Ryuutama ∧ `hommeDragonId IS NULL`, **calculé serveur** (le filtre `ryuutama` de `my-characters.ts` est supprimé, AD-3 : un code, pas un filtre d'écran). Il ne passe pas par `PartieDto` (cf. F6) : une requête `partie.findMany({ where: { id: { in: mjPartieIds } }, select: { id: true, hommeDragonId: true } })` **remplace** `hommeDragon.findMany` un pour un — le nombre de requêtes ne change pas, c'est ce que « aucune requête de plus » doit vouloir dire.
> **Unlink** : réservé au MJ de la partie (`getOwned`), **sans** exigence de système ni de propriété de H — c'est une donnée de la partie ; seul `link` exige Ryuutama et propriétaire de H.

Option B (conserver le prédicat à trois clauses) : possible, mais alors il faut écrire (1) un fragment `where` Prisma unique exporté et réutilisé par les quatre lecteurs, (2) que `GET /parties/:id/homme-dragon` distingue « aucun lien » de « lien non effectif » (sinon l'impasse `409`), (3) que `create`/`link` remplacent un lien non effectif, (4) l'idem pour `unlink`. C'est plus de texte et plus d'états à tester pour un cas qui n'existe que dans les données héritées ; je recommande A.

---

## F2 (B) — Le niveau est lu **avant** le verrou, alors que lier/délier le font maintenant varier sans toucher la ligne verrouillée

**Paire :** story écriture de fiche (éveil / artefact cadeau / réserve) × story link/unlink (`Partie`).

**Preuve.** `chooseEveilPower`, `chooseArtefactCadeau`, `setReserveSlot` calculent `level` **avant** `$transaction` (L186-189, L267-270, L354-356) puis valident à l'intérieur contre ce niveau. Le verrou `SELECT … FOR UPDATE` ne porte que sur la ligne `HommeDragon`. AD-23 le conserve : « le niveau est lu avant le verrou comme aujourd'hui, et une dissociation concurrente ne purge rien ». Or aujourd'hui le niveau ne dépend que de scénarios (un seul MJ, un seul écrivain) ; demain il dépend d'un **ensemble de lignes `Partie`** que `link`/`unlink` modifient par `UPDATE "Partie"` sans jamais prendre le verrou de H.

**Scénario.** H est lié à 3 aventures (niveau 5, capacité de réserve 4). Onglet 1 : `PUT reserve/4` lit niveau 5. Onglet 2 : `unlink` ×2 → niveau 2. Onglet 1 entre en transaction, valide la composition contre « niveau 5 » et **écrit un emplacement 4 hors capacité** pour un niveau 2 ; idem un pouvoir d'éveil niveau 5 ou l'artefact cadeau (niveau ≥ 4) acceptés pour un dragon qui n'y a plus droit. La phrase « ne purge rien » (AD-22) couvre un surplus **préexistant**, pas une écriture **nouvelle** validée sur un niveau périmé.

**Correction proposée** — remplacer la phrase par :

> **Niveau sous verrou.** Toute écriture qui dépend du niveau (éveil, artefact, réserve) calcule le niveau **après** `SELECT … FOR UPDATE` sur la ligne `HommeDragon`, **dans la même transaction**, en appelant la fonction unique avec le client transactionnel (`tx`). `link` et `unlink` prennent le **même verrou de ligne sur H** (`SELECT … FOR UPDATE` sur `HommeDragon` avant l'`UPDATE "Partie"`) : ordre de verrouillage fixé, `HommeDragon` puis `Partie`, jamais l'inverse (create : la ligne H est neuve, donc pas de contention). La clôture d'un scénario dans une autre partie n'est pas sérialisée avec ces écritures (`ScenariosService` n'est pas modifié) : c'est un écart assumé, monotone (le niveau ne fait que monter par ce chemin) donc sans conséquence sur la validité.

Corollaire de coût à écrire : la fonction unique doit pouvoir rendre le **niveau seul** (une requête de comptage groupée) sans construire tout le bloc `aventures`/`historique` ; sinon chaque geste de réserve (enregistrement automatique à chaque clic) paie la lecture complète de toutes les aventures.

---

## F3 (E) — Temps réel : AD-23 contredit AD-14 et le câblage front réel

**Paire :** story back (émissions `user:{propriétaire}`) × story front (fiche/page, `RealtimeService`, `HommeDragonService.changed`).

**Preuves.**
1. `RealtimeService.handlers` (`realtime.service.ts:80-103`) : `HommeDragonService.notifyChanged` est câblé **uniquement** sur le préfixe `partie:` (L86). Le sheet ne se rafraîchit que sur `hommeDragonSvc.changed()` (`homme-dragon-sheet.ts:182-189`). AD-23 fait émettre les écritures de fiche sur `user:{propriétaire}` : **aucun handler ne réagit**, la fiche (et « Personnages ») ne se rafraîchit pas. Un Homme Dragon sans aventure n'a de plus aucun canal `partie:` à écouter.
2. Dans le sens inverse, `user:` est déjà branché sur `invitations`, `myParties`, `partySignals` et `scenarios.notifyRealtimeChanged` (L87, L89, L100, L106). Émettre `user:{propriétaire}` à **chaque geste** de la réserve (enregistrement automatique par appel, AD-22) déclenche donc, à chaque clic, le rechargement de la liste des parties, des signaux (`/me/party-signals`, une douzaine de requêtes groupées), du calendrier personnel et des invitations — exactement la classe de bug de production citée par AD-3/AD-11 (rafales de `429`, listes vidées). AD-14 pose aussi la règle inverse : un état strictement personnel est rafraîchi **localement**, sans SSE ; la fiche et sa réserve en sont, et aucun de leurs gestes ne change un signal de FR-12.
3. « La page de la fiche se connecte aussi aux canaux `partie:` de ses `aventures[]` » : `connect()` ouvre un `EventSource` par topic et **chaque `open`/reconnexion** appelle tous les handlers du préfixe (`realtime.service.ts:111-122`, `es.addEventListener('open', onSignal)`). N aventures = N salves de huit rechargements (parties, scénarios, personnages, hommeDragon, sondages, disponibilités, annonces, rôles) à l'ouverture de la page. Le « borné par les aventures » d'AD-23 borne le nombre de connexions, pas ce coût.
4. Le canal supplémentaire est **inutile** : `ScenariosService.close()` appelle déjà `parties.notifyPartieSignalsChanged(partieId, mjId)` (`scenarios.service.ts:379`), qui émet `user:` vers le MJ — qui est le propriétaire de H pour toute aventure liée (invariant F1). Le niveau cumulé change donc déjà un événement que la fiche peut recevoir sans modifier `ScenariosService`.

**Incompatibilité construite.** Dev back émet `user:` partout (lettre d'AD-23) ; dev front, qui câble « fiche → canaux `partie:` des aventures » (lettre d'AD-23), ne reçoit rien des écritures, reçoit N salves à l'ouverture, et inonde le limiteur à chaque geste de réserve.

**Correction proposée** — remplacer le paragraphe « Temps réel » :

> **Temps réel.** *Écritures de fiche* (`PATCH`, éveil, artefact cadeau, réserve) : **aucune émission** — état strictement personnel de son propriétaire (AD-14) ; l'écran applique la réponse de la route (la section de réserve le fait déjà). *`create`, `link`, `unlink`* : ils changent un signal de FR-12 (`HOMME_DRAGON_A_CREER`) et la liste « Personnages » : émission **`user:{propriétaire}`** et **`partie:{partieId}`** (écran de détail de la partie), en fin de méthode, hors transaction (P7-AD-2), sans donnée ; `notifyPartieSignalsChanged` n'est plus appelé pour ce signal (il fait émettre vers tous les membres, qui n'en reçoivent pas, le signal étant MJ seul). *Côté front* : `HommeDragonService.notifyChanged` est câblé **en plus** sur le préfixe `user:` ; la page de fiche **ne se connecte qu'à `user:{propriétaire}`**, déjà ouvert par l'application, jamais aux canaux `partie:` des aventures — la clôture d'un scénario atteint ce canal via `notifyPartieSignalsChanged` existant. Le niveau cumulé est donc rafraîchi sans connexion supplémentaire et sans modifier `ScenariosService`.

À reporter dans le tableau « Deferred » : la ligne « plafond de connexions SSE (une par canal `partie:` des aventures) » devient sans objet.

---

## F4 (E) — `PATCH` de la fiche : écrasement du JSON entier, hors verrou

**Paire :** story écriture générique (`PATCH /homme-dragons/:id`) × story réserve / éveil / artefact (`reserve`, `eveilPowers`, `artefactCadeau` dans `sheetData`).

**Preuve.** `HommeDragonService.update()` (L101-154) lit `existing` puis écrit `data: { sheetData }` **sans transaction ni `FOR UPDATE`** ; `sheetData = { ...existingSheetData, ...dto, … }` est reconstruit à partir de la lecture initiale. Les trois autres écritures, elles, sont verrouillées. AD-23 écrit : « Écritures : mécanique d'AD-22 inchangée (… `SELECT … FOR UPDATE` désormais par `id`) » — sans dire si `PATCH` en fait partie : l'une des deux stories (reprise de `update()`, reprise de `setReserveSlot()`) laissera donc `update()` tel quel.

**Scénario (perte de données silencieuse).** `PATCH {nom}` lit `sheetData` (réserve = [A]). Un `PUT reserve/2` commit (réserve = [A, B]). Le `PATCH` écrit alors `{ …ancienne copie, nom }` : la réserve revient à [A], le souffle B est perdu ; idem pour un éveil ou l'artefact cadeau. AD-22 listait pourtant « deux écritures concurrentes qui s'écrasent » comme chose à prévenir. Le risque augmente avec le multi-aventures (plusieurs onglets, un `PATCH` depuis la fiche et un geste de réserve depuis une autre vue).

**Correction proposée** — ajouter dans AD-23, paragraphe « Adressage et garde » :

> **Toutes** les écritures de `sheetData` — `PATCH` compris, sans exception — se font dans une transaction : `SELECT … FOR UPDATE` sur la ligne par `id`, relecture de `sheetData` **sous verrou**, fusion sur une copie, validation, écriture. Aucune écriture ne fusionne à partir d'une lecture antérieure au verrou. `reserve`, `eveilPowers` et `artefactCadeau` restent exclus de `UpdateHommeDragonDto` et ne sont jamais portés par le `PATCH` (le DTO les rejette, la fusion ne les touche pas).

---

## F5 (E) — Le bloc dérivé multi-aventures n'a pas de propriétaire : lecture en lot, ordre de l'historique, voyageurs de l'export

**Paire :** story fiche (back) × story PDF (`packages/game-rules` + `HommeDragonPdfService`) × story fiche (front) × `ScenariosService`.

**Preuves.**
- AD-23 exige « une requête de scénarios et une de membres pour l'ensemble des aventures » **et** « `ScenariosService` n'est pas modifié ». Mais aujourd'hui `computeHistorique` passe par `ScenariosService.findAllForPartie(partieId, userId)` (garde `getViewable`, une partie à la fois) et `computeVoyageursProteges` par `PartiesService.listMembers` (idem). Les `participants` d'une entrée sont dérivés par type de partie : `ScenarioParticipant` pour `CAMPAGNE_EPISODIQUE`, **tous les membres actuels** sinon (`homme-dragon.service.ts:563-566`, `scenarios.service.ts:223-264`). Le dev d'HommeDragon qui ne doit pas toucher `ScenariosService` réimplémente cette dérivation dans `HommeDragonService` ; deux implémentations de « qui a participé à un scénario passé » divergeront (typiquement au prochain type de partie ou changement de `kind`, cf. `convertKind`). La règle « une seule fonction » d'AD-23 ne couvre que la décision d'effectivité, pas ce sous-calcul.
- **Ordre** de `historique` non spécifié. L'export prend `historique.slice(-MAX_HISTORIQUE_ROWS)` (`homme-dragon-pdf-field-map.ts:97`) : « les dernières entrées » dépend entièrement de l'ordre. L'ordre actuel est `createdAt asc` par partie ; fusionné sur plusieurs parties, ce n'est plus chronologique par `closedAt`. Le front (fiche) et le PDF afficheront deux choses différentes.
- `voyageursProteges` plat est supprimé (« Ne pas : garder `voyageursProteges` plat »), mais `mapHommeDragonToPdfFields` (`packages/game-rules`) lit exactement ce champ plat (L88-100, type `HommeDragonPdfInput`, L12). Le dev PDF doit inventer une aplatissement : doublons (un joueur présent dans deux aventures est imprimé deux fois ?), ordre, déduplication par `userId` ou par pseudo. Le dev front, lui, affichera par aventure.
- Identité : `voyageurs: [{ userId, pseudo }]` et `participants` en `string[]` de pseudos violent AD-2 (« toujours les deux champs ») et AD-12 : la fiche n'a pas de `displayName` à afficher, donc le composant d'identité ne peut pas fonctionner (AD-2 prévoit ce cas : « dix écrans, dix replis »).

**Correction proposée** — ajouter à AD-23 :

> **Lecture en lot, propriétaire unique.** `ScenariosService` gagne **une** méthode de lecture en lot, générique et ignorante des Hommes Dragons (`findPasseForParties(partieIds, mjId)`) : scénarios `PASSE` avec `closedAt`, `partieId`, et `participants` dérivés par la même fonction que `findAllForPartie` (extraite, pas recopiée) ; le filtre `partie.mjId = mjId` est dans la requête (garde de masse, aucun `getViewable` par partie). « N'est pas modifié » signifie « ne connaît pas les Hommes Dragons », pas « n'expose pas de lecture en lot ». Même principe pour les membres (`PartiesService`, une requête `membership.findMany({ where: { partieId: { in } } })`).
> **Ordre.** `historique` est trié par `closedAt` croissant, puis `id` ; l'export imprime les `MAX_HISTORIQUE_ROWS` dernières entrées de **cet** ordre.
> **Voyageurs.** `aventures[].voyageurs: { userId, pseudo, displayName }[]` (AD-2) ; `participants` d'une entrée est `{ userId, pseudo, displayName }[]`. L'export et tout écran à plat appellent une fonction pure unique `uniqueVoyageurs(aventures)` (`@master-jdr/game-rules`) : déduplication par `userId`, ordre de première apparition. `HommeDragonPdfInput` est modifié en conséquence ; `homme-dragon.pdf.service*.spec.ts` et `homme-dragon-pdf-field-map` sont des consommateurs à mettre à jour.

---

## F6 (M) — `PartieDto` et fuite d'existence vers un non-propriétaire (NFR1)

**Paire :** story signal / liste des parties (`toPartieDto`, `PartiesService`) × story AD-22 (la fiche est MJ seul).

AD-23 dit que le signal « lit `Partie.hommeDragonId` » mais ne dit pas **comment l'information arrive** dans `party-signals.service.ts`. Le seul chemin « sans requête de plus » est de l'ajouter à `PartieDto` — projection servie **aux joueurs** (`listForUser(…, 'player')`, `getViewable`, `findOneDto`). On ferait alors fuiter vers tout membre l'**existence** (et l'id) du Homme Dragon du MJ, que NFR1 et AD-22 venaient de fermer (lecture MJ seul, `404` pour l'existence). Aucun test ne le verrait : `PartieDto` n'est « qu'un contrat déclaratif » (AD-15).

**Correction** — ajouter à AD-15 et AD-23 :

> `hommeDragonId` n'est **jamais** dans `PartieDto` (même statut que `sheetVisibility`). Le signal `HOMME_DRAGON_A_CREER` le lit par une requête dédiée (cf. F1) ; l'écran de détail obtient la référence par `GET /parties/:id/homme-dragon` (MJ seul).

Un test de contrat doit figer cette absence (`expect(dto).not.toHaveProperty('hommeDragonId')`) — c'est la seule garde, AD-15 n'en a pas d'automatique.

---

## F7 (M) — Contrat HTTP et front des routes link/unlink et de l'adressage : rien n'est écrit

**Paire :** story back (routes par partie) × story front (`HommeDragonService` web, `HommeDragonPage`, `HommeDragonSheet`, `my-characters`, `PartieDetail`).

**Trous (vérifiés contre `homme-dragon.controller.ts`, `core/homme-dragon/homme-dragon.service.ts`, `app.routes.ts:92-97`).**
- AD-23 nomme « create, link, unlink » mais seul `POST /parties/:id/homme-dragon` (create) a une forme. Verbe, chemin, corps de `link` (`{ hommeDragonId }` ?) et de `unlink` (le `:h` de `WHERE … = :h` vient d'où : corps, chemin, ou relu ?), réponse (`HommeDragonDto` ? `{ id, nom }` ? `204` ?), statut quand zéro ligne est touchée (`409` pour `link`, mais pour `unlink` : `404`, `409`, `204` ?). Un double-clic sur « Lier » rend `409` alors que l'état voulu est atteint ; un double-clic sur « Délier » idem.
- `link` d'un `H` n'appartenant pas à l'appelant : l'AD dit « exige que l'appelant soit propriétaire de H » mais pas le statut. `403` casserait « jamais `403` : l'existence ne fuit pas » ; il faut `404` (même réponse qu'un `H` inexistant).
- Routes **front** : l'AD ne dit rien de la route de la fiche. L'existante est `parties/:id/homme-dragon` (`HommeDragonPage` charge la partie, vérifie `mjId` et `gameSystemId`, et met `partie.name` dans la barre contextuelle) ; avec `/homme-dragons/:id` pour un dragon **sans aventure**, il n'y a plus de partie à charger. `HommeDragonSheet [partieId] [partieName]` (utilisé dans `PartieDetail` et dans la page) porte `partieId` partout (`findOne`, `update`, `chooseEveilPower`, `setReserveSlot`, `exportPdf`). `my-characters.ts:158-160` navigue par `item.hommeDragon.partieId`, champ supprimé par AD-23 (erreur de compilation, donc rattrapée, mais la cible de navigation reste à inventer). `MyHommeDragonDto.aventures` effective ou liée : cf. F1.
- Flux de création : `create` renvoie un `HommeDragonDto` ; l'onglet de `PartieDetail` et le parcours de création de `HommeDragonSheet` doivent savoir s'ils naviguent vers la fiche par `id` ou restent sur place.
- « Créer » vs « Lier » : une fois un H déjà possédé et délié, « Créer un Homme Dragon pour… » (entrée `HOMME_DRAGON_A_CREER` de `my-characters`) pousse à créer un doublon plutôt qu'à lier. AD-23 renvoie le libellé au Deferred, mais le choix créer/lier est structurel (deux routes, deux écrans).

**Correction proposée** — ajouter à AD-23, « Routes par partie » :

> `POST /parties/:id/homme-dragon` (création + lien, corps = fiche, réponse `HommeDragonDto`) · `PUT /parties/:id/homme-dragon` (lien, corps `{ hommeDragonId }`, réponse `{ id, nom }`) · `DELETE /parties/:id/homme-dragon` (délien, sans corps : le serveur lit `hommeDragonId` courant sous l'`UPDATE … RETURNING`). **`link` est idempotent** : si la partie est déjà liée au même `H`, `200` ; liée à un autre, `409`. **`unlink` est idempotent** : déjà vide, `204`. `H` inexistant ou d'un autre propriétaire : `404`. Réponse de `GET /parties/:id/homme-dragon` : `{ id, nom }` ou `null`. **Front** : `/homme-dragons/:id` héberge la fiche (aucune dépendance à une partie : titre et sous-titre viennent de la fiche, `aventures[]` donne les liens vers les parties) ; `parties/:id/homme-dragon` ne garde que le parcours de création/lien et redirige vers `/homme-dragons/:id` dès qu'un `H` existe ; `HommeDragonSheet` prend `[hommeDragonId]` seul, la création est portée par un composant distinct. L'écran de lien propose les Hommes Dragons de `GET /me/homme-dragons` ; créer n'est offert que si l'utilisateur n'en possède aucun libre.

---

## F8 (M) — Migration : trois cas limites non traités, et l'ordre généré par Prisma

**Cas vérifiés ou plausibles.**
1. **Ordre des instructions.** Prisma génère la migration à partir de la différence de schéma : il émettra `DROP COLUMN "HommeDragon"."partieId"` (et l'index/la contrainte) sans insérer l'`UPDATE`, et pas forcément après l'`ADD COLUMN "Partie"."hommeDragonId"`. AD-23 décrit le bon ordre mais ne dit pas qu'il est écrit **à la main** dans la migration (création `--create-only` puis édition). Sans cette consigne, une migration appliquée telle quelle supprime `partieId` avant le rattrapage : **perte du lien**, silencieuse.
2. **Parties sans fiche** : pas de problème (colonne `NULL`). **Fiches d'une partie non-Ryuutama ou d'un `userId ≠ mjId`** : le rattrapage lie sans condition ; avec F1-A il faut filtrer. **Deux fiches pour la même partie** (`@@unique` portait sur `[userId, partieId, gameSystemId]`, pas sur `partieId` seul) : `UPDATE … FROM` choisit une ligne arbitraire, l'autre devient une fiche sans aventure, sans bruit.
3. **Vérification.** Aucune assertion après rattrapage.
4. **Relation Prisma.** `Partie.hommeDragons HommeDragon[]` (schema.prisma, L85) doit disparaître au profit de `hommeDragon`/`parties` ; les noms de relation à deux sens ne se génèrent pas sans conflit. À écrire pour que le schéma compile.

**Correction proposée** — remplacer le paragraphe « Migration » :

> **Migration.** Une migration Prisma, créée avec `--create-only` puis **éditée à la main** dans cet ordre : (1) `ADD COLUMN "Partie"."hommeDragonId"` + FK `ON DELETE SET NULL` ; (2) rattrapage : `UPDATE "Partie" p SET "hommeDragonId" = h."id" FROM "HommeDragon" h WHERE h."partieId" = p."id" AND h."userId" = p."mjId" AND p."gameSystemId" = 'ryuutama'` ; (3) bloc `DO $$ … RAISE EXCEPTION` qui échoue si le nombre de parties liées diffère du nombre de fiches **éligibles** (garde contre les doublons de partie, qui font échouer la migration plutôt que de perdre un lien en silence) et qui journalise (`RAISE NOTICE`) le nombre de fiches non liées (partie non-Ryuutama ou `userId ≠ mjId`) — elles restent des Hommes Dragons sans aventure, visibles dans `GET /me/homme-dragons`, jamais supprimées ; (4) `DROP` de l'index/unique/FK/colonne `partieId`. La migration est exécutée dans une transaction unique ; elle est jouée via l'outillage du projet (conteneur `api`), jamais à la main.

Consommateurs de tests touchés (à lister dans la story, sinon casse bruyante mais tardive) : `homme-dragon.service.spec.ts` (1 566 lignes, clé composée `userId_partieId_gameSystemId` mockée partout), `homme-dragon.service.reserve.spec.ts`, `homme-dragon.controller.spec.ts` (routes), `my-homme-dragons.controller.spec.ts`, `party-signals.service.spec.ts` (mock `prisma.hommeDragon.findMany`, assertion `toHaveBeenCalledTimes(1)` L328), les specs web `homme-dragon-sheet`, `homme-dragon-page`, `my-characters`.

---

## F9 (F) — AD-22 : amendements par parenthèses, deux textes lisibles

AD-22 reste rédigé avec `getOwned`, `parties.getViewable`, `partie:{id}`, `SELECT … FOR UPDATE` par partie, avec des parenthèses « depuis AD-23 » en regard. Un dev qui lit AD-22 seul (le *Prevents* d'une story 33.6 déjà rédigée) y trouve le contraire de ce qui s'applique. Deux détails vérifiés : (a) AD-22 dit « Ryuutama seul » et la réserve valide « capacité niveau − 1 » : `partie.gameSystemId` n'existe plus pour un dragon sans aventure, il faut lire `H.gameSystemId` ; (b) « Émission `partie:{id}` après écriture » est caduque, voir F3 (aucune émission).

**Correction** : réécrire en place les phrases d'AD-22 concernées (lecture, écriture, émission, verrou) au lieu de les amender par parenthèse, et garder la mention « révisée par AD-23 » dans l'en-tête seulement. Ajouter dans AD-23 : « l'exigence Ryuutama d'un Homme Dragon se lit sur `H.gameSystemId`, jamais sur une partie ».

---

## Vérifié, sans écart retenu

- Création et lien concurrents (`UPDATE … WHERE "hommeDragonId" IS NULL` dans la transaction de création) : correct sous READ COMMITTED ; il manque seulement le statut idempotent (F7).
- `onDelete: SetNull` : la suppression d'une partie ne touche pas la fiche (`Partie` porte désormais la FK) ; la suppression d'un utilisateur supprime les deux (`User` → `HommeDragon` et `User` → `Partie.mjId`, cascades) : cohérent.
- `UpdatePartieDto` (liste blanche, `forbidNonWhitelisted`) ne permet pas de poser `hommeDragonId` par `PATCH /parties/:id` : le seul écrivain du lien reste les trois routes. (Mais `PartiesService.update` doit y poser `hommeDragonId: null` si `gameSystemId` change : F1.)
- Aucun code du dépôt n'écrit `Partie.mjId` aujourd'hui : la clause `mjId = userId` d'AD-23 protège un futur transfert qui n'existe pas ; le texte d'AD-23 devrait le dire (cf. F1, point sur le futur transfert).
- `convertKind` ne rétrograde pas les scénarios `PASSE` : le niveau cumulé n'est pas altéré par ce chemin.
- Fuite de l'identité des voyageurs : seul le propriétaire (= MJ de chaque aventure) reçoit `aventures[].voyageurs` ; `listMembers` ne renvoie l'e-mail qu'au MJ et le bloc n'en reprend pas.

## Ordre de traitement suggéré

F1 → F2 → F3 → F4 → F5 (les cinq redéfinissent le texte d'AD-23) ; F6/F7/F8 sont des précisions localisées ; F9 est une réécriture de forme.
