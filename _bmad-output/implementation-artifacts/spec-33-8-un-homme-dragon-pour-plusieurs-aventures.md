---
title: 'Un Homme Dragon pour plusieurs aventures'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd85521acdc4be231df6a5397c7710dbd0e47c975'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-33-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un Homme Dragon est rattaché à une seule partie (unicité `[userId, partieId, gameSystemId]`, routes `parties/:id/homme-dragon`) : un MJ qui mène plusieurs aventures en refait un par aventure, et son niveau et son historique ne cumulent rien.

**Approach:** Appliquer **AD-23** (et AD-22 réécrit) du spine du Palier 9 : lien porté par `Partie.hommeDragonId`, fiche adressée par `/homme-dragons/:id` et gardée par son propriétaire, niveau et historique cumulés sur toutes les aventures, association/dissociation par les routes de partie, fiches existantes conservées. Le spine fait foi : ne pas redécider ce qu'il tranche. Le jeu de données de démo (`seed-demo.ts`) est **entièrement revu** pour refléter le nouveau modèle et les stories 33.x, état par état.

## Boundaries & Constraints

**Always:**
- **Modèle.** `Partie.hommeDragonId` (nullable, FK `SetNull`, `@@index`) ; `HommeDragon` perd `partieId` et l'unicité, garde `@@index([userId])` ; la relation inverse `Partie.hommeDragons` devient `Partie.hommeDragon`. Une aventure de `H` = partie dont `hommeDragonId = H.id`, sans autre prédicat. `PartieDto` ne porte jamais `hommeDragonId`. Écrivains autorisés : `HommeDragonService` (create, link, unlink) ; `PartiesService.update` (remise à `NULL` dans le **même** `UPDATE` quand `gameSystemId` change, puis émission `partie:` + `notifyPartieSignalsChanged`) ; `PartiesService.remove` (la FK délie ; émettre `user:` au MJ).
- **Routes de la fiche** (nouveau contrôleur `homme-dragons/:id`) : `GET`, `PATCH`, `POST eveil-power`, `POST artefact-cadeau`, `PUT reserve/:slot`, `GET export.pdf`. Résolue par `{ id, userId: appelant }` ; absent ou étranger = `404` identique, jamais `403`. Plus de `getOwned(partie)` pour la fiche. Nom du fichier PDF fondé sur l'id de l'Homme Dragon.
- **Routes de partie** (`getOwned`) : `POST /parties/:id/homme-dragon` crée **et lie** dans une transaction (Ryuutama seul ; le lien perdant la course lève `409` et annule la création) ; `PUT` / `DELETE /parties/:id/homme-dragon/:hommeDragonId` lient / délient ; `GET /parties/:id/homme-dragon` renvoie `{ id, nom }` ou `null`. Lier : Homme Dragon absent ou étranger `404` **avant** `409` ; partie non Ryuutama `400` ; un seul `updateMany` `WHERE id AND mjId = appelant AND gameSystemId = ryuutama AND hommeDragonId IS NULL` (zéro ligne : `409`). Délier : `WHERE id AND hommeDragonId = :h`, zéro ligne `404`, sans condition de système.
- **Écritures de fiche, `PATCH` compris** : transaction, `SELECT … FOR NO KEY UPDATE` par `id`, relecture `{ id, userId }` sous verrou, **niveau calculé sous le verrou** par la fonction dérivée unique (qui accepte le client transactionnel), copie de `sheetData`. Link et unlink prennent le même verrou (ordre : `HommeDragon` puis `Partie`). Réserve, `artefactCadeau`, éveils restent exclus du `PATCH`. **Retrait d'un souffle (`key: null`) permis à tout niveau**, y compris 1 ; seuls les ajouts hors règles sont refusés. Aucune purge d'un contenu au-dessus du niveau.
- **Bloc dérivé unique** (`aventures`, `historique`, niveau, PS, éveils en attente) : `historique` = scénarios `PASSE` de toutes les aventures, chaque entrée avec sa `partieId`, tri `closedAt` puis `id` ; niveau = `levelForScenariosPasse(historique.length)`. Lecture en lot par une méthode générique de `ScenariosService` (trois requêtes groupées : scénarios, inscrits, membres ; règle de participation existante ; aucun Homme Dragon dans ce service). `HommeDragonDto` : plus de `partieId` ni de `voyageursProteges` plat ; `aventures: [{ partieId, nom, voyageurs: [{ userId, pseudo, displayName }] }]` (tri `Partie.createdAt` puis `id`). `MyHommeDragonDto` : `aventures: [{ partieId, nom }]` éventuellement vide, filtre propriétaire seul. Aplatissement dédoublonné des voyageurs pour le PDF : **une fonction pure** de `packages/game-rules`.
- **Signal `HOMME_DRAGON_A_CREER`** : calculé côté serveur, partie dont l'utilisateur est MJ, Ryuutama, `hommeDragonId` nul, requête dédiée remplaçant `hommeDragon.findMany`, sans requête par partie.
- **Temps réel** : entrée `{ prefix: 'user:', … hommeDragon.notifyChanged }` dans `realtime.service.ts` ; la page de la fiche ouvre `userTopic` elle-même (`connect`, `disconnect` à la destruction) et aucun canal `partie:`. Create, link, unlink : `partie:{id}` puis `notifyPartieSignalsChanged`, hors transaction. Les écritures de fiche n'émettent **rien**.
- **Migration** (décision : aucune production, donc aucune cérémonie) : un dossier ajouté **directement** après `20260921235211_partie_visibility_locks` avec son `migration.sql` écrit à la main (ni `migrate dev --create-only` ni base « shadow ») ; colonne + FK + index ; garde de doublons et contrôle des orphelins par `DO $$ … RAISE EXCEPTION` (peu coûteux, prévus par AD-23) ; rattrapage `UPDATE "Partie" … FROM "HommeDragon" h WHERE h."partieId" = "Partie"."id" AND h."userId" = "Partie"."mjId"` ; **puis seulement** `DROP` de l'index, de l'unicité, de la FK et de la colonne `partieId`. Elle s'applique par `docker compose up` (`migrate deploy`) : ne pas régénérer le client ni migrer à la main (`AGENTS.md`).
- **Interface — décisions de l'utilisateur.** (1) Le geste associer / dissocier existe aux **deux** endroits : l'onglet « Homme Dragon » de la partie devient un panneau d'aventure (lien vers la fiche + « Dissocier » ; sans Homme Dragon : « Créer » et « Associer un existant » parmi les miens) **et** la fiche gagne une section « Aventures » (chaque aventure avec ses voyageurs, un lien vers la partie, « Retirer » ; « Ajouter une aventure » parmi mes parties Ryuutama sans Homme Dragon, lues dans les signaux déjà calculés `HOMME_DRAGON_A_CREER` — aucun appel par partie). (2) **Dissocier demande une confirmation courte** (le niveau peut baisser), aux deux endroits ; le motif de dialogue est celui déjà en usage dans l'application. (3) La carte « Personnages » joint les noms des aventures (« Les Vents du Nord · L'Archipel »), tronqués si trop longs ; le tri « Partie » se fait sur la première aventure (`createdAt`), les Hommes Dragons sans aventure en dernier ; l'état « sans aventure » se lit sans l'ouvrir. La création garde son entrée par partie (« Créer un Homme Dragon pour <aventure> ») ; la route `parties/:id/homme-dragon` du front est repointée vers le parcours de création puis navigue vers `/homme-dragons/:id`. Fiche d'un Homme Dragon sans aventure : s'ouvre normalement, section « Aventures » vide avec « Ajouter une aventure ».
- **Jeu de données de démo — `apps/api/prisma/seed-demo.ts`, revu en entier.** Chaque état du modèle y figure une fois, avec des fiches **valides** (clés de catalogue existantes, réserve conforme aux règles de `game-rules`, éveils et cadeau cohérents avec le niveau). Les Hommes Dragons sont créés **avant** les parties, sans `partieId`, et liés par `hommeDragonId` à la création de la partie. Contenu cible :
  - **Suisen** (`DRAGON_VERT`, MJ `mj`) lié à *Le Naufrage de l'Aurore* (clôturée) **et** *Chroniques de la Guilde* : 2 scénarios `PASSE` → niveau 2, éveil du niveau 2 **en attente** (aucun `eveilPowers`), réserve d'un emplacement (`['route']`), voyageurs partagés (Alice, Bob) entre ses deux aventures.
  - **Kaien** (`DRAGON_BLEU`, MJ `mj`) lié à *La Route des Lanternes* **et** à une **nouvelle** partie *Les Annales de Brume* (`CAMPAGNE_LINEAIRE`, Ryuutama, MJ `mj`, membres Alice, Diane, Faustine, onze scénarios `PASSE` générés en boucle, chacun avec une séance minimale datée) : 1 + 11 = 12 scénarios `PASSE` → **niveau 5 atteint par cumul** (aucune aventure seule n'y arrive), PS 10 ; `eveilPowers` pour les niveaux 2, 3 et 4 (le 5 en attente), `artefactCadeau: { key: 'lanterne' }` (race ≠ bleu), réserve de 4 emplacements `['amour', 'amour', 'courage', 'rituel-du-sommeil']` (un souffle d'une autre race sur un seul emplacement, un rituel admis au niveau 5).
  - **Braise** (`DRAGON_ROUGE`, MJ `mj`) **sans aucune aventure** (état atteignable par dissociation ou suppression de partie) : niveau 1, `artefact: grande-epee`, aucune réserve ; sert de cible aux tests d'association.
  - Aucun Homme Dragon pour Diane : *Les Veilleurs du Pont* garde le signal `HOMME_DRAGON_A_CREER` et l'entrée « Créer ». Dissocier *Les Annales de Brume* de Kaien ramène son niveau de 5 à 2 sans rien purger (réserve, éveils et cadeau persistent au-dessus du niveau) : cas de test documenté dans l'en-tête du script.
  - L'en-tête du script (nombre de parties, couverture, **écarts connus** : pas d'avatar — il suppose un fichier téléversé —, niveaux 3 et 4 non figés mais reproductibles par dissociation) et le récapitulatif affiché à la fin (comptes, parties, Hommes Dragons) sont mis à jour. Aucun autre jeu de données de test ne référence `partieId` d'un Homme Dragon.
- Contrat cassé volontairement (routes, `404` au lieu de `403`, DTO) : mettre à jour **tous** les consommateurs listés dans le Code Map, et renverser les tests qui figent `403` ou « un par partie ».
- Commentaires et messages d'erreur en français ; `import type` réservé aux types ; aucune nouvelle dépendance.

**Never:**
- Pas de `partieId` sur la fiche ; pas de prédicat d'effectivité recopié ; pas de `hommeDragonId` dans `PartieDto` ; pas de `403` pour un Homme Dragon étranger ; pas de création hors aventure ; pas de remplacement implicite d'un lien.
- Pas d'émission `user:` ni de canal `partie:` pour les écritures ou l'écoute de la fiche ; pas de modification de `ScenariosService` au-delà de la méthode de lecture en lot ; pas d'appel par partie pour trouver les aventures éligibles.
- Pas d'avertissement avant suppression de partie ou changement de système (reporté, spine : Deferred) ; ne pas modifier `levelForScenariosPasse`, `validateReserve`, `reserveCapacity` ; ne pas réécrire les AC livrés de 33.5 à 33.7 (déjà annotés dans `epics.md`).
- Ne pas importer `@master-jdr/game-rules` dans `seed-demo.ts` (paquet ESM, script CJS) : les valeurs de niveau et de réserve y sont écrites en dur, avec un commentaire qui renvoie aux règles.
- Aucune installation de dépendance ; aucune opération git hors commit local demandé.

## I/O & Edge-Case Matrix

| Scénario | Entrée / État | Comportement attendu | Erreur |
|----------|--------------|---------------------|--------|
| Association | `PUT` : Homme Dragon de A, partie Ryuutama de A sans Homme Dragon | lien posé ; la partie apparaît dans `aventures` ; niveau et historique cumulés | N/A |
| Partie déjà pourvue | `PUT` sur une partie qui a un Homme Dragon | rien changé | `409` |
| Étranger / inexistant | toute route de fiche ou `PUT` | même réponse dans les deux cas, aucune donnée | `404` |
| Partie non Ryuutama | `PUT` ou `POST` | rien écrit | `400` |
| Dissociation | `DELETE` après confirmation | lien retiré ; niveau recalculé (peut baisser) ; `sheetData` intact | `404` si non lié à cette partie |
| Dissociation annulée | refus dans la confirmation | aucun appel, rien changé | N/A |
| Création concurrente | deux `POST` sur la même partie | une seule fiche liée ; l'autre annulée, aucune fiche orpheline | `409` |
| Suppression de partie | partie portant un Homme Dragon | fiche conservée, `aventures` sans elle ; visible dans `GET /me/homme-dragons` | N/A |
| Changement de système | `PATCH` partie vers un autre système | `hommeDragonId` remis à `NULL` dans le même `UPDATE` ; fiche intacte | N/A |
| Niveau qui baisse | réserve peuplée, niveau 1 | retrait accepté ; tout ajout refusé ; contenu conservé et affiché | `400` sur ajout |
| Écritures concurrentes | `PATCH` + `PUT reserve` simultanés | aucune ne perd l'autre | N/A |
| Voyageurs | deux aventures partageant un joueur | par aventure sur la fiche ; dédoublonné dans le PDF | N/A |
| Signal | MJ Ryuutama sans Homme Dragon lié / avec / non Ryuutama | `HOMME_DRAGON_A_CREER` / aucun / aucun | N/A |
| Carte « Personnages » | deux aventures / aucune | noms joints, tronqués / « sans aventure » lisible ; tri « Partie » sur la première, sans aventure en dernier | N/A |
| Ajout depuis la fiche | parties Ryuutama du MJ sans Homme Dragon | liste fournie par les signaux déjà calculés, sans appel par partie ; vide = message | N/A |
| Migration | une fiche par partie | lien posé, aucune fiche perdue | N/A |
| Migration | deux fiches pour une même partie, ou fiche dont `userId ≠ mjId` | la migration échoue avec un message explicite | `RAISE EXCEPTION` |
| Temps réel | scénario d'une aventure passé `PASSE` | niveau et historique de la fiche ouverte mis à jour sans rechargement | N/A |
| Seed | base vide puis `seed:demo` | trois Hommes Dragons (niveaux 2, 5, 1) et cinq parties conformes au tableau ci-dessus ; aucune erreur de contrainte | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `HommeDragon` L418-433 (`partieId`, unicité L431, index L432) ; `Partie.hommeDragons` L85 ; commentaire L414-417 à réécrire. Exemples de rattrapage SQL : `20260805182210_user_display_name`, `20260712115353_scenarios_seances_p4` ; aucun précédent de `DO $$`.
- `apps/api/src/homme-dragon/homme-dragon.service.ts` -- toutes les méthodes sont clés sur `userId_partieId_gameSystemId` + `getOwned` : `create` L49, `update` L101, `chooseEveilPower` L170, `chooseArtefactCadeau` L255, `setReserveSlot` L338, `findOne` L435, `findMine` L459, `buildDto` L502, `computeVoyageursProteges` L544, `computeHistorique` L552. Réutiliser `buildArtefactCatalog`, `hasPrismaErrorCode`, `RYUUTAMA_ID`, `getOwnerPseudo`, les règles de `game-rules`. Le niveau est aujourd'hui calculé **avant** la transaction (L186, 267, 354).
- `apps/api/src/homme-dragon/homme-dragon.controller.ts` (`parties/:id/homme-dragon`, nom du PDF L105) ; `my-homme-dragons.controller.ts` (route inchangée) ; `homme-dragon.module.ts` (ajouter le contrôleur) ; `homme-dragon.pdf.service.ts` ; specs `homme-dragon.service.spec.ts` (403 L338, 572, 732, 826, 1518 ; 409 « un par partie » L324), `.reserve.spec.ts`, `homme-dragon.controller.spec.ts`, `pdf.service.spec.ts`, `.real.spec.ts`.
- `apps/api/src/parties/parties.service.ts` -- `update` L363-397 (changement de système L382), `remove` L579 (aucune émission), `notifyPartieSignalsChanged` L812 (émet `user:` MJ + membres, pas `partie:`). `party-signals.service.ts` L47-50, 93, 146 : requête `hommeDragon.findMany` à remplacer ; **le filtre Ryuutama n'existe pas côté serveur aujourd'hui** (il est dans `my-characters.ts` L104-115) ; spec L144-217.
- `apps/api/src/scenarios/scenarios.service.ts` -- `findAllForPartie` L203-269 (règle des participants L223-253) ; ajouter `findPasseForParties(partieIds)` (3 requêtes, `kind` lu via la relation) sans garde d'accès ; ne pas passer par `toDto`.
- `apps/api/prisma/seed-demo.ts` (1084 lignes) -- Hommes Dragons actuels L480-497 (Suisen, `partieId: oneShot.id`) et L709-723 (Kaien, `partieId: lineaire.id`) ; parties L360, 519, 774, 981 ; en-tête L67-106 (« Quatre Parties », « fiches Homme Dragon », écart connu) ; récapitulatif L1061-1075 (« MJ des 3 premières Parties ») ; `createCharacter`, `makeSheetData`, `at()/day()` à réutiliser. Séance minimale : `scenarioId` + `dateValidee` suffisent. Clés de catalogue valides : artefacts (`lanterne`, `anneau`, `grande-epee`…), éveils (`escorte-du-dragon`, `protection-du-dragon`, `rugissement-du-dragon`…), souffles (`route`, `amour`, `courage`…), rituels (`rituel-du-sommeil`…) ; seuils de niveau 1/3/7/12 scénarios `PASSE` → niveaux 2/3/4/5 (`homme-dragon-derived.ts`).
- `packages/shared/src/index.ts` -- `HommeDragonDto` L1205 (`partieId` L1208, `voyageursProteges` L1214, `historique` L1216), `MyHommeDragonDto` L1232, commentaires de routes L1243-1255 ; commentaire périmé L1179 ; nouveau type de référence `{ id, nom }`.
- `packages/game-rules/src/ryuutama/homme-dragon-pdf-field-map.ts` -- `HommeDragonPdfInput` L8-15, `voyageursProteges` L12/88/99, `slice(-12)` L94 (suppose l'ordre croissant), cases L121-122 ; nouveau `homme-dragon-voyageurs.ts` exporté par `index.ts` ; spec `__tests__/homme-dragon-pdf-field-map.spec.ts` L262-338. Types miroirs locaux, jamais d'import de `shared`.
- `apps/web/src/app/core/homme-dragon/homme-dragon.service.ts` -- méthodes par `partieId` (L28-105) ; ajouter `link`, `unlink`, `findForPartie`. `core/realtime/realtime.service.ts` L83-102 (aucune entrée `user:` pour lui ; `partie:` L86 à retirer) ; specs L107, 197-216. Seuls `dashboard.ts` L434 et `calendar-view.ts` L1472 ouvrent `userTopic` aujourd'hui.
- `apps/web/src/app/app.routes.ts` L90-96 -- `parties/:id/homme-dragon` → `homme-dragons/:id` ; la création garde une entrée par partie.
- `features/homme-dragon/` -- `homme-dragon-page` (garde MJ/Ryuutama et sous-titre par partie à retirer), `homme-dragon-sheet` (inputs `partieId`/`partieName`, L200/216/254/302/514/611 ; wizard si fiche `null` ; `voyageursProteges` html L384-395 ; historique html L397-408 ; nouvelle section « Aventures »), `reserve-section.ts` L51/231, `homme-dragon-creation-wizard` (`create(partieId)` L311, `mondesProteges` init L249 à conserver).
- `features/parties/partie-detail/partie-detail.html` L454-458 (onglet actuel = fiche entière) → panneau d'aventure.
- `features/characters/my-characters/my-characters.ts` L101-117 (entrée de création via le signal), L158-160 (navigation vers la fiche) ; `character-creation-entries.ts` L66-73 ; `character-summary-card.ts` ; `core/characters/my-characters-items.ts` L35-69 (`partieName` disparaît ; tri « Partie » et « Niveau »). Service front des signaux de parties : source de la liste des parties éligibles.
- Specs web figeant l'ancien modèle : `homme-dragon.service.spec`, `realtime.service.spec`, `my-characters-items.spec`, `my-characters.spec` (L482, 570-579, 617-625), `character-creation-entries.spec`, `character-summary-card.spec` L379, `homme-dragon-page.spec`, `homme-dragon-sheet.spec`, `homme-dragon-creation-wizard.spec`, `reserve-section.spec`, `partie-detail.spec` L2036-2065.
- `docs/backlog.md` L94-96 (« un seul par Partie »), `docs/checklist.md` L39 (garde et temps réel), `docs/dragons.md` (phrase sur le lien multi-aventures).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` + nouveau dossier de migration (`migration.sql` écrit à la main) -- lien, garde de doublons, rattrapage, contrôle, `DROP` -- modèle d'AD-23 sans perte de fiche
- [x] `packages/shared/src/index.ts` -- DTO (`aventures`, `historique.partieId`, `MyHommeDragonDto`, référence `{ id, nom }`), commentaires de routes -- contrat
- [x] `packages/game-rules/...` -- fonction d'aplatissement des voyageurs, mapper PDF et son spec -- PDF multi-aventures
- [x] `apps/api/src/scenarios/scenarios.service.ts` -- `findPasseForParties` + tests -- lecture en lot
- [x] `apps/api/src/homme-dragon/homme-dragon.service.ts` -- réécriture : bloc dérivé unique, écritures sous verrou (`PATCH` compris), `create` + lien, `link`, `unlink`, `findOne` par id, `findMine`, retrait de réserve à tout niveau -- AD-23
- [x] `apps/api/src/homme-dragon/*.controller.ts` + module + PDF -- contrôleur `homme-dragons/:id`, routes de lien, nom du fichier -- adressage
- [x] `apps/api/src/parties/parties.service.ts` + `party-signals.service.ts` -- remise à `NULL` au changement de système, émissions de `remove`, signal serveur Ryuutama -- invariants
- [x] `apps/api/prisma/seed-demo.ts` -- **revue complète** : trois Hommes Dragons créés avant les parties et liés par `hommeDragonId`, nouvelle partie *Les Annales de Brume* et ses onze scénarios `PASSE`, fiches valides aux niveaux 2, 5 et 1, en-tête, récapitulatif et cas de test mis à jour -- démo conforme à tout le modèle
- [x] `apps/web` (service, routes, temps réel, page, fiche avec section « Aventures », réserve, assistant, panneau d'aventure de `partie-detail`, confirmations, carte « Personnages » et tris) -- interface selon les décisions de l'utilisateur
- [x] Tests API, game-rules, web : renverser les `403`/« un par partie », couvrir la matrice (concurrence, migration, signal, temps réel, confirmations, tris) -- non-régression
- [x] `docs/backlog.md`, `docs/checklist.md`, `docs/dragons.md` -- alignement

**Acceptance Criteria:**
- Given un Homme Dragon et deux aventures Ryuutama dont je suis MJ, when je l'associe aux deux, then sa fiche affiche un niveau et un historique cumulés et les voyageurs par aventure.
- Given un Homme Dragon qui n'est pas le mien, when je l'appelle par n'importe quelle route, then j'obtiens `404` sans donnée.
- Given les fiches existantes, when la migration s'applique, then chacune est liée à sa partie ; en cas de doublon ou d'orphelin elle échoue explicitement.
- Given ma fiche ouverte, when un scénario de l'une de ses aventures passe `PASSE`, then son niveau se met à jour sans recharger.
- Given une base vide, when j'exécute le seed de démo puis ouvre « Personnages » avec le compte `mj`, then je vois Suisen (2 aventures), Kaien (2 aventures, niveau 5, réserve, cadeau et éveils) et Braise (sans aventure) ; et avec le compte `diane`, le signal « Homme Dragon à créer » sur *Les Veilleurs du Pont*.

## Implementation Notes

- **Diff vérifié par le chef de build** (depuis `d85521a`, relu en entier ; état final après la revue) : API 1549 tests passés / 2 échecs connus et datés (`parties.service.spec` `getAvailableSlots`, `party-signals.service.spec` `PROCHAINE_SEANCE_CONNUE`, non touchés par la story) ; typecheck API propre ; e2e 2/2 ; game-rules 234/234 ; web 2839 passés / 2 échecs hors story (`calendar-view.spec`, dates figées) ; `ng build` OK (avertissements de budget préexistants).
- **Lint** : aucune erreur sur les lignes ajoutées (API : 13 erreurs préexistantes dans 7 fichiers non touchés ; web : 105 erreurs préexistantes, surtout `prettier`). Six erreurs `prettier` sur des lignes ajoutées dans deux specs web ont été corrigées à la main par le chef de build.
- **Contrôleurs** : `homme-dragon.controller.ts` ne garde que les routes par partie (create, `GET` référence, `PUT`/`DELETE` lien) ; la fiche vit dans le nouveau `homme-dragons.controller.ts` (`HommeDragonSheetController`). Le `git mv` tenté par le sous-agent a été annulé (index propre, aucune écriture git conservée).
- **Bug trouvé et corrigé** : le `ValidationPipe` (`transform: true`, cible ES2023) rend des DTO dont les champs optionnels absents valent `undefined` ; un `PATCH` partiel écrasait donc `nom` et les autres champs. `update()` ne fusionne plus que les champs fournis, avec un test.
- **Seed** : *Les Annales de Brume* est créée à J−240 (avant son premier chapitre, J−216) ; c'est donc la première aventure de Kaien par `createdAt`. Les autres parties reçoivent un `createdAt` explicite pour un ordre d'aventures déterministe.
- **Limite connue** : une partie clôturée (`TERMINEE`) n'émet jamais `HOMME_DRAGON_A_CREER` ; elle ne se rattache donc pas depuis « Ajouter une aventure » de la fiche, mais bien depuis son propre panneau d'aventure.
- **Couverture de la matrice** : toutes les lignes ont un test automatisé, sauf les deux lignes **Migration** (doublons / orphelins) et la ligne **Seed**, vérifiées à la main par le sous-agent sur une base de test jetable (migration appliquée sur la base de dev : les 3 fiches existantes liées, aucune perdue ; seed sans erreur de contrainte ; trajets HTTP confirmés : niveaux 2/5/1, `404` uniforme, `409` de lien, dissociation 5→2 sans purge, création concurrente 201 + 409). La migration passe aussi en CI sur base vide (`migrate deploy`). Aucune base de test n'existe en local pour rejouer les cas de données.
- **Revue du 2026-10-04** : 19 constats triés (voir le journal), cinq correctifs appliqués par le sous-agent d'implémentation puis revérifiés par le chef de build — perte du `nom`/`inscription` de l'artefact sur un `PATCH` partiel (le filtrage des `undefined` descend maintenant au niveau de l'artefact), assertion du `where` du comptage de niveau, câblage `justCreated` testé côté page, partie déjà liée exclue de « Ajouter une aventure », panneau d'aventure rechargé sur `HommeDragonService.changed()`. Trois reports dans `deferred-work.md`.
- **Base de dev** : elle contient encore l'ancien jeu de démo (un Homme Dragon par partie, désormais lié par la migration). Le nouveau jeu n'apparaît qu'après `prisma migrate reset` puis `pnpm seed:demo` (non fait).

## Spec Change Log

## Review Triage Log

Revue du 2026-10-04, première passe (Blind Hunter, Edge Case Hunter, Verification Gap). Constats dédoublonnés par cause ; le sigle indique la couche d'origine (B = blind, E = edge, V = verification-gap).

- **[V] Le `where` de `scenario.count` (niveau lu sous verrou) n'est asserté par aucun test** — `medium`, patch : seul un nombre est stubbé ; retirer `status`, `closedAt` ou la relation `partie` ne casserait rien, et le niveau qui autorise les écritures divergerait de `historique.length`. Test ajouté.
- **[V] Câblage `justCreated` (état de navigation → page → fiche) non testé côté page** — `low`, patch : chaque moitié n'est testée que contre le stub de l'autre ; le bandeau peut disparaître sans test rouge. Test ajouté.
- **[V][B] Branches de données de la migration (doublon, orphelin, rattrapage) jamais exécutées par un test ; aucun test sur Postgres réel pour les verrous, l'`updateMany` conditionnel et la course create/link** — `medium`, defer : la CI ne migre qu'une base vide et aucun harnais d'intégration n'existe ; vérifié à la main par le sous-agent sur une base jetable, aucune production avant le Palier 11. Consigné dans `deferred-work.md`.
- **[E][B] `PATCH { artefact: { key } }` efface le `nom` et l'`inscription` enregistrés** — `high`, patch : `provided.artefact` est une instance `ArtefactDto` dont les champs optionnels valent `undefined` (cible ES2023, vérifié) ; le correctif du premier niveau ne la filtre pas. Perte silencieuse du nom personnalisé de l'artefact.
- **[E] « Ajouter une aventure » propose encore la partie qu'on vient de lier tant que les signaux ne sont pas rafraîchis** — `low`, patch : correction d'une ligne (exclure `aventures()`), sans surface publique.
- **[B] Le panneau d'aventure ne se recharge pas quand le lien change ailleurs** — `medium`, patch : `CLAUDE.md` exige d'évaluer le câblage temps réel de tout composant affichant des données d'une partie ; sans cela « Dissocier » renvoie 404 et « Créer » un 409 après un parcours entier. Rechargement sur `HommeDragonService.changed()` (déjà câblé sur `user:`).
- **[E][B] La migration rattrape sans condition de système (`gameSystemId = 'ryuutama'`)** — `low`, rejeté : une partie non Ryuutama portant un Homme Dragon est inatteignable, `assertGameSystemHasModule` refuse tout changement vers un système sans module (seule Ryuutama en a un) ; modifier une migration déjà appliquée sur la base de dev la désynchroniserait.
- **[B] La migration échoue sans stratégie de reprise ni requête de diagnostic** — `low`, rejeté : décision de l'utilisateur (« on s'en fout, rien en prod ») ; l'échec explicite est le comportement voulu par AD-23.
- **[E][B][V] Garde anti-réponse périmée (`updatedAt`) inopérante pour link/unlink** — `low`, rejeté : un `GET` antérieur doit se résoudre après la réponse du lien ; l'événement `user:` émis par link/unlink relance un rafraîchissement qui corrige l'état, et le correctif demande un jeton de version (plus qu'une correction directe).
- **[E][B] « Ajouter une aventure » ne propose jamais une partie `TERMINEE`** — `medium`, defer : la source est le signal `HOMME_DRAGON_A_CREER`, qui exclut les parties terminées depuis la 29.7 (préexistant) et que l'intention figée de la spec désigne ; contournement : le panneau d'aventure de la partie elle-même. Consigné dans `deferred-work.md` (liste dédiée à envisager).
- **[B][V] Les écritures de fiche n'émettent rien ; renommer une partie n'émet pas `user:` (noms d'aventures périmés jusqu'au rechargement)** — `low`, rejeté : décision AD-23 confirmée par l'utilisateur le 2026-10-04 (un `user:` par geste d'enregistrement automatique réveillerait liste, signaux, calendrier et invitations) ; la corriger éditerait l'intention figée.
- **[E][B] Messages d'erreur génériques sur les actions de lien (409/404 « Réessayez »)** — `low`, rejeté : situations de course rares (autre onglet) et correction plus large (distinguer les codes, rafraîchir trois listes).
- **[B] `PUT` de lien non idempotent (re-lier le même Homme Dragon donne 409)** — `low`, rejeté : le `409` « partie déjà pourvue » est dans l'intention figée de la spec.
- **[E][B] `HommeDragonPage` lit l'id de route une fois ; `currentUser`/`currentNavigation` lus à l'initialisation** — `low`, rejeté : aucun parcours de l'interface ne va d'une fiche à une autre sans repasser par « Personnages » (le composant est alors détruit) ; même motif que `dashboard.ts` L434 pour `userTopic`.
- **[E] Message 400/409 mal attribué si le système de la partie change entre `getOwned` et la transaction** — `low`, rejeté : fenêtre négligeable, le `409` reste sans écriture.
- **[B] L'historique affiche des pseudos bruts (`participants.join`) au lieu de la convention joueur / personnage** — `low`, defer : préexistant (`participants` est un tableau de pseudos depuis la 10.2) et hors intention ; consigné. La clé de `@for` incluant `partieId` ne collisionne qu'avec deux scénarios de même titre et même date dans une aventure (rejeté).
- **[B] La réponse d'écriture recalcule le bloc dérivé hors transaction** — `low`, rejeté : le niveau qui valide l'écriture est bien calculé sous verrou ; la réponse est cohérente à la lecture suivante, et la rendre atomique dépasse une correction directe.
- **[B] Tests rouges laissés en l'état / affirmation « non touchés par la story » douteuse** — `false` : les deux échecs API (`getAvailableSlots`, `PROCHAINE_SEANCE_CONNUE`) et les deux échecs web (`calendar-view.spec`) dépendent de la date du jour, sont listés comme échecs connus dans la section Verification approuvée, et la phrase des notes vise ces tests, pas les fichiers ; la story n'ajoute que des tests verts dans ces deux fichiers.
- **[B] Nom du PDF en UUID, cast `as string`, `remove` qui émet sans condition** — `low`, rejeté : le nom côté API est celui de l'ancienne route (id de partie) remplacé par l'id de l'Homme Dragon, le front gère déjà un nom lisible ; le cast suit un test de présence ; l'émission inconditionnelle est inoffensive.

## Design Notes

Lier, en un seul statement (`prisma.partie.updateMany`, précédent : `auth.service.ts` L217) :
```ts
const { count } = await tx.partie.updateMany({
  where: { id: partieId, mjId: userId, gameSystemId: RYUUTAMA_ID, hommeDragonId: null },
  data: { hommeDragonId },
});
if (count === 0) throw new ConflictException('Cette aventure a déjà un Homme Dragon');
```
Migration, ordre des blocs : `ADD COLUMN` + FK `ON DELETE SET NULL` + index → `DO $$` garde de doublons → `UPDATE … FROM … AND h."userId" = "Partie"."mjId"` → `DO $$` contrôle des orphelins → `DROP` index/unicité/FK/colonne. Les specs unitaires API neutralisent `@master-jdr/game-rules` par `jest.mock` : seuls les e2e le chargent pour de vrai.

Jeu de démo, vue d'ensemble (niveau = scénarios `PASSE` cumulés ; seuils 1/3/7/12) :

| Homme Dragon | Aventures | `PASSE` | Niveau | Ce que ça exerce |
|---|---|---|---|---|
| Suisen (vert) | Naufrage (clôturée) + Guilde | 1 + 1 | 2 | multi-aventures simple, éveil en attente, réserve d'un emplacement, voyageurs partagés |
| Kaien (bleu) | Route des Lanternes + Annales de Brume | 1 + 11 | 5 | niveau atteint **par cumul**, éveils 2-4 faits et le 5 en attente, cadeau, réserve pleine avec autre race et rituel |
| Braise (rouge) | aucune | 0 | 1 | état sans aventure, cible d'association |
| *(Diane)* | *Veilleurs du Pont : aucun* | 0 | — | signal « à créer », entrée de création |

## Verification

**Commands:**
- `docker compose exec api pnpm typecheck` -- expected: aucune erreur (couvre specs et scripts `prisma/`, donc `seed-demo.ts`)
- `docker compose exec api pnpm test` -- expected: aucune régression hors échecs préexistants connus (`parties.service.spec.ts`, `party-signals.service.spec.ts`)
- `docker compose exec api pnpm test:e2e` -- expected: tous les tests passent
- `docker compose exec -w /work/packages/game-rules api pnpm test` -- expected: tous les tests passent
- `docker compose exec web pnpm test` puis `docker compose exec web pnpm build` -- expected: tests verts et compilation sans erreur (la CI ne construit pas le front)
- `docker compose exec api pnpm lint:check` et `docker compose exec web pnpm lint` -- expected: aucune erreur

**Manual checks (if no CLI):**
- Base vide (procédure de l'en-tête de `seed-demo.ts`), puis `docker compose exec api pnpm seed:demo` : aucune erreur de contrainte ; la migration s'est appliquée au `docker compose up`.
- Compte `mj` : « Personnages » montre les trois Hommes Dragons ; la fiche de Kaien est au niveau 5 avec réserve, cadeau et éveils ; dissocier *Les Annales de Brume* (après confirmation) ramène le niveau à 2 sans rien perdre ; associer Braise à une partie.
- Deux onglets sur une même fiche : le niveau suit un scénario clos ; le second onglet ne se rafraîchit pas sur une écriture de fiche (choix d'AD-23).
- Compte joueur : aucune fiche ni route d'Homme Dragon accessible.
