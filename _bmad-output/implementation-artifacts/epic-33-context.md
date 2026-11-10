# Epic 33 Context: Homme Dragon

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Le MJ crée et consulte son Homme Dragon avec le même soin qu'une fiche de personnage joueur, et retrouve en séance ce dont son dragon dispose sans rouvrir le livre : fiche refondue, formulaire de création guidé, souffles visibles, capacités de niveau, réserve de souffles composée sur la fiche, export PDF équivalent à celui des joueurs, présence dans « Personnages ». La dernière étape change le modèle : **un même Homme Dragon peut suivre plusieurs aventures** (groupes et mondes différents), son niveau et son historique cumulant les scénarios `PASSE` de toutes ses aventures. Le modèle « un Homme Dragon par partie » est abandonné. Stories 33.1 à 33.7 livrées ; reste la 33.8, qui casse volontairement le contrat des 33.5 à 33.7.

## Stories

- Story 33.1 : Fiche Homme Dragon refondue
- Story 33.2 : Les souffles de mon dragon
- Story 33.3 : Formulaire de création guidé
- Story 33.4 : Export PDF au niveau des fiches joueur
- Story 33.5 : Mes Hommes Dragons dans « Personnages »
- Story 33.6 : Réserve de souffles
- Story 33.7 : Capacités de niveau
- Story 33.8 : Un Homme Dragon pour plusieurs aventures

Ordre : 33.3 → 33.4 → 33.5 → 33.7 → 33.6 → 33.8.

## Requirements & Constraints

- **Souffles vs éveils.** Les six entrées de `eveil-powers.json` sont des éveils. Les 21 souffles (9 communs, 12 de race) vivent dans le content-type `souffle`. Un dragon voit les communs et ceux de sa race ; dès le niveau 3, ceux des autres races sont consultables dans un bloc replié. Règles : `docs/dragons.md`.
- **Niveau = nombre de scénarios `PASSE`**, cumulés sur **toutes** les aventures de l'Homme Dragon. Chaque entrée d'historique porte son aventure.
- **Aucun décompte en séance** : ni souffles, ni PS, ni éveils ne sont suivis.
- **Réserve de souffles** : inexistante au niveau 1 ; au niveau N ≥ 2, N − 1 emplacements ; un souffle commun ou de la race peut occuper plusieurs emplacements ; souffles du temps exclus ; dès le niveau 3 au plus un souffle d'une autre race, sur un seul emplacement ; rituels dès le niveau 5, sans compter comme « autre race ». Une seule réserve par Homme Dragon, enregistrée à chaque geste, imprimée dans le PDF (`souffle_1`..`souffle_4`). Pas de « Vider la réserve ».
- **Capacités de niveau** : liste cumulative ; au niveau 4, artefact cadeau choisi une fois pour toutes parmi les trois autres races ; au niveau 5, souffles rituels (clé `souffleRituel`) consultables.
- **Accès MJ seul, propriétaire seul** : la fiche, la réserve et l'export PDF ne sont jamais accessibles à un joueur, ni dans l'application ni par l'API. Un Homme Dragon étranger ou inexistant se comporte de façon identique (`404`, jamais `403`) : son existence ne fuit pas.
- **Multi-aventures (33.8)** : associer un Homme Dragon à une aventure Ryuutama dont on est MJ et qui n'en a pas ; une aventure a au plus un Homme Dragon, sans remplacement implicite (`409`, dissocier d'abord). Dissocier, supprimer l'aventure ou changer son système de jeu dissocie sans supprimer la fiche ; le niveau est recalculé et peut baisser, mais rien n'est purgé (éveils, artefact cadeau, souffles de la réserve restent lisibles, seuls les nouveaux choix sont refusés ; retirer un souffle reste toujours possible). Les fiches existantes restent intactes, liées à leur partie. Création depuis une aventure = création + association atomiques.
- **« Personnages »** : un Homme Dragon y apparaît **une seule fois, avec ses aventures** (éventuellement aucune), nature lisible sans reposer sur la couleur seule ; recherche, tri et mode d'affichage s'appliquent ; jamais visible des autres membres. Entrée de création « Créer un Homme Dragon pour <aventure> » uniquement pour une aventure Ryuutama du MJ qui n'en a pas.
- La fiche présente les voyageurs protégés **par aventure**. Nom affiché selon la convention joueur / personnage. « Homme Dragon » est un nom propre, jamais thématisé.
- Contenu Ryuutama : textes reformulés, mécaniques conservées ; catalogues complets vérifiés en revue, jamais par garde runtime ; un souffle retiré ou renommé reste lisible (repli sur la clé).

## Technical Decisions

- **Modèle (AD-23).** `Partie.hommeDragonId` (nullable, FK, `onDelete: SetNull`, indexé) porte le lien. `HommeDragon` n'a plus de `partieId` ni d'unicité par (utilisateur, partie, système) ; il garde `userId` (cascade), `gameSystemId`, `sheetData`. Une seule source de vérité : **une aventure de H est une partie dont `hommeDragonId = H.id`**, sans autre prédicat. Tout `UPDATE` de `Partie` qui change `gameSystemId` remet `hommeDragonId` à `NULL` dans la même instruction. Seuls `HommeDragonService` (create, link, unlink) et `PartiesService.update` (remise à `NULL`) écrivent ce champ. `PartieDto` ne porte jamais `hommeDragonId`.
- **Routes.** Fiche par id : `GET|PATCH /homme-dragons/:id`, `POST …/eveil-power`, `POST …/artefact-cadeau`, `PUT …/reserve/:slot`, `GET …/export.pdf`, résolue par `{ id, userId: appelant }`. Par partie (`getOwned`) : `POST /parties/:id/homme-dragon` (crée et lie), `PUT` / `DELETE /parties/:id/homme-dragon/:hommeDragonId` (lie / délie), `GET /parties/:id/homme-dragon` (`{ id, nom }` ou `null`). Lier : `404` avant `409`, partie non Ryuutama `400`, un seul `updateMany` conditionnel (zéro ligne : `409` ; délier : `404`). `GET /me/homme-dragons` : une ligne par Homme Dragon, filtrée par propriétaire, `aventures: [{ partieId, nom }]`. Aucune création hors aventure.
- **Écritures de fiche, `PATCH` compris** : transaction, `SELECT … FOR NO KEY UPDATE` sur la ligne `HommeDragon` par `id` (ordre : `HommeDragon` puis `Partie`), relecture sous verrou, **niveau calculé sous le verrou**, fusion sur une copie de `sheetData` jamais mutée. Link et unlink prennent le même verrou. Réserve, `artefactCadeau` et éveils exclus de `UpdateHommeDragonDto` : routes dédiées. Validation serveur de toute la composition de la réserve (catalogues `souffle` / `souffleRituel`) ; règles de composition en fonctions pures de `packages/game-rules`, partagées avec le grisage web.
- **Bloc dérivé unique** (AD-3) : une fonction de `HommeDragonService`, acceptant le client Prisma ou transactionnel, produit aventures, historique, niveau, PS et éveils en attente. Lecture en lot générique dans `ScenariosService` (scénarios `PASSE` de N parties avec participants : trois requêtes groupées, jamais une boucle sur `findAllForPartie`). `HommeDragonDto` perd `partieId` et le `voyageursProteges` plat au profit de `aventures: [{ partieId, nom, voyageurs }]` ; l'aplatissement dédoublonné pour le PDF est une fonction unique de `game-rules`.
- **Signal « Homme Dragon à créer »** (29.7) : partie dont l'utilisateur est MJ, Ryuutama, `hommeDragonId` nul, calculé côté serveur sans requête par partie.
- **Temps réel** : la fiche n'écoute que `user:{id}` (entrée à ajouter dans `realtime.service.ts`), aucun canal `partie:`. Create / link / unlink émettent `partie:{id}` puis `notifyPartieSignalsChanged`, hors transaction ; `PartiesService.remove` émet `user:` au MJ. Les écritures de fiche n'émettent rien (le client écrit puis se met à jour avec la réponse). Le niveau suit les scénarios clos via l'émission existante de `ScenariosService`.
- **Migration** : `--create-only` éditée ; colonne + FK + index, garde de doublons (échec explicite, jamais de choix arbitraire), rattrapage par `partieId` et `mjId`, contrôle qu'aucune fiche n'est orpheline, **puis seulement** suppression de `partieId` et de l'unicité. La relation inverse devient `Partie.hommeDragon`. Pas d'expand/contract.
- **Consommateurs à mettre à jour avec la 33.8** : API (`homme-dragon.service.ts`, deux contrôleurs, `party-signals.service.ts`, `parties.service.ts` update/remove, `seed-demo.ts`, `mapHommeDragonToPdfFields` et `HommeDragonPdfInput` de `game-rules`) ; front (service, route `parties/:id/homme-dragon` → `/homme-dragons/:id`, page, `reserve-section`, assistant de création, onglet de `partie-detail`, `my-characters`, `character-creation-entries`, `my-characters-items.ts` dont les tris « Partie » et « Niveau » perdent `partieName`, câblage temps réel). Les tests API qui figent `403` ou « un par partie » sont à renverser.
- **Patrons déjà posés** : cartes façon `CharacterSheet`, `DetailSurface` / `createDetailSurfaceHost()` pour tout élément de catalogue avec description, repli de nom aligné sur `characterName()`, catalogues via `CONTENT_TYPES` et seed.
- Revues : mode plan avant la 33.8, puis `/security-review` et `/code-review` (elle touche la garde d'accès). Vérifier à l'implémentation l'absence d'interblocage du verrou et le comportement d'un deuxième onglet (non rafraîchi sur une écriture de fiche, par choix).

## UX & Interaction Patterns

- Création en 5 étapes (Race, Artefact filtré, Identité, Vie de l'Homme Dragon, Avatar) avec `ChoiceCard` teintée par race, toujours doublée d'un texte ; champs Material `outline` avec aide sous chaque label.
- Réserve : section sur la fiche (colonne gauche, avant la carte « Souffles »), fenêtre de choix en `DetailSurface` étendu de façon rétro-compatible ; lignes grisées consultables avec raison écrite, enregistrement automatique, retrait sans confirmation avec annulation temporaire, focus et annonces `role="status"` gérés. Références : `ux-designs/ux-jdr-master-2026-10-01/`.
- Liste « Personnages » : même carte que les personnages, marqueur de nature (icône + mot, jamais la couleur seule).
- **Pas de maquette** pour la 33.8 : le geste associer / dissocier (emplacement, confirmation), la carte d'un Homme Dragon à plusieurs aventures et les voyageurs par aventure sont à arbitrer avec l'utilisateur à la planification de la spec. Aucun avertissement avant suppression de partie ou changement de système n'est spécifié.

## Cross-Story Dependencies

- 33.3 et 33.5 reposent sur le wizard de personnage, la section de création de la 29.16 et la convention de nommage de l'épic 28 ; 33.2 sur le catalogue d'artefacts et `DetailSurface` de la 33.1.
- 33.4 lit le catalogue `souffle` ; la 33.6 remplit ensuite les cases `souffle_1`..`souffle_4`. 33.6 dépend de la 33.7 (souffles rituels) et durcit la lecture au MJ seul.
- **33.8 est la dernière et révise le livré** : routes par Homme Dragon à la place de `/parties/:id/homme-dragon`, `404` au lieu de `403`, plus de `partieId` sur la fiche, contrat de « Personnages » (33.5) et réserve (33.6, `sheetData` reste attaché au dragon) adaptés. Les ACs de 33.5 et 33.6 restent tels que livrés ; la 33.8 les révise.
- Hors épic : signal 29.7 (épic 29, recalculé), temps réel (`RealtimeService`), `ScenariosService` (lecture en lot), `PartiesService` (remise à `NULL`).
