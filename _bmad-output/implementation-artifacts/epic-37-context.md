# Epic 37 Context: La porte — un socle commun, sans rien changer au JDR

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Refactorer le cœur de l'application pour poser un socle commun (propriétaire générique, événement de base, date de séance en plage, registre des systèmes et de leurs capacités, service de permission unique, ports du calendrier, rappels par séance) sur lequel le ralliement (soirées entre amis, épics 38 à 43) et les futurs systèmes viendront se brancher — **sans aucun changement visible ni fonctionnel pour le JDR**, hormis le rappel de la veille qui devient par séance. Épic technique assumé (exception au principe « valeur utilisateur ») : aucune story de ralliement ne démarre avant sa fin. Condition de sortie : CI verte (types, build API, tests unitaires + e2e), attentes des tests existants inchangées sauf les tests de rappel.

## Stories

- Story 37.1 : Figer le comportement actuel du JDR par des tests de caractérisation
- Story 37.2 : Remplacer `mjId` par `ownerId`, le propriétaire de la partie
- Story 37.3 : Extraire l'événement de base, le scénario devenant son extension JDR
- Story 37.4 : Poser la date d'une séance en plage continue, une seule source
- Story 37.5 : Déclarer les systèmes et leurs capacités dans un registre unique
- Story 37.6 : Faire décider les droits sur une partie et ses événements par un service unique
- Story 37.7 : Brancher les capacités JDR sur le service de permission et interdire les lectures directes
- Story 37.8 : Isoler le calendrier derrière des ports
- Story 37.9 : Envoyer le rappel de la veille pour chaque séance

## Requirements & Constraints

- **JDR à comportement constant** : la suite de tests existante passe sans changement d'attentes, et l'interface JDR est inchangée. Dans cet épic, la seule exception admise est le rappel de la veille par séance (même e-mail et mêmes destinataires pour une partie à une seule prochaine séance ; une partie épisodique à plusieurs séances datées reçoit un rappel par séance). Les seuls tests autorisés à changer d'attentes sont ceux de `NotificationsService` portant sur `Partie.reminderSentAt` (et les renommages de champs dans les assertions de forme DTO en 37.2).
- **Tests de caractérisation d'abord** (37.1), écrits sur le code actuel sans toucher la production, nommant en français le comportement figé ; ils servent de référence à toutes les stories suivantes.
- **Migration** : une migration Prisma par étape de la porte, l'une après l'autre, sans expand/contract ni réversibilité exigée (aucune production avant le Palier 11) ; aucune donnée perdue. Migrations lancées dans le conteneur via `pnpm exec prisma`.
- **Colonnes hors porte** : ne pas créer ici `Membership.role` (épic 38), `Inscription.status`, `SessionPoll.relanceSentAt` (épic 40), `Event.cancelledAt`, `PartieHidden` (épic 42).
- **Sécurité** : chaque droit vérifié côté serveur par le service de permission, un test de refus par cellule actions × rôles de la famille `jdr` ; aucun IDOR via un identifiant d'événement ou de séance d'une autre partie ; 403 refus / 404 introuvable, messages en français.
- **Lectures en lot** (rôles, signaux), jamais une requête par partie.
- Conventions du dépôt : commentaires et messages d'erreur en français, aucune installation de dépendance, tout via Docker.

## Technical Decisions

- **Ordre imposé de la porte** : caractérisation → `ownerId` → extraction d'`Event` → plage de séance → registre → `PermissionService` (cœur, puis capacités JDR + test de non-lecture) → ports du calendrier → rappels par séance.
- **Trois couches + transverse** : couche 1 planification (`availability/`, `poll/`) ; couche 2 rassemblement (`parties/`, `events/` nouveau, `invitations/`, `account/`) ; couche 3 capacités JDR (`scenarios/`, `characters/`, `xp-distributions/`, `homme-dragon/`, `character-roles/`, `announcements/`) ; `permissions/` transverse (n'importe que `PrismaService` et le registre). Une couche n'importe jamais celle du dessus. Une table = un module écrivain (`Partie`, `Membership` → `parties/` ; `Event`, `Seance`, `Inscription` → `events/` ; `Scenario`, `Seance.compteRendu`, documents, notes → `scenarios/` ; sondages → `poll/`). Mutations en service, jamais en contrôleur ; `emit` en fin de mutation, hors transaction.
- **Propriétaire** : `Partie.mjId` → `ownerId` (nullable, `onDelete: SetNull`, immuable). DTO : `ownerId/ownerPseudo/ownerDisplayName`. `XpDistribution.mjId` non renommé. Synonymes interdits : `hostId`, `creatorId`, `mjId` (hors `XpDistribution`).
- **Event / Scenario** : `Event` (`partieId`, `title`, `description`, `ownerId`, `createdAt`, séances) créé avec **le même `id`** que chaque `Scenario` existant ; `Scenario` devient une extension 1:1 dont la clé primaire est `Event.id`. `Seance.scenarioId` → `eventId`. FK : `Event.partie` Cascade, `Scenario.event` Cascade, `Event.owner` SetNull. Création composite via `EventsService.create(…, extend)` dans une transaction (rappel d'extension fourni par `ScenariosService`), émission après validation. `ONE_SHOT` = exactement un événement, vérifié sous verrou `FOR UPDATE` de la partie. Routes `parties/:id/scenarios` et `scenarios/:id/*` inchangées.
- **Date de séance** : `Seance.startDate/startSlot/endDate/endSlot` seule source, remplies depuis `poll.chosenDate/chosenSlot`, sinon `dateValidee` (créneau vide), `end = start` ; `dateValidee` et la lecture `poll.chosenDate ?? dateValidee` disparaissent. `startSlot` vide = `FULL_DAY` pour les dispos, « sans créneau » à l'affichage. Jamais deux séances pour une plage ; seules des plages `start = end` sont écrites.
- **Registre `GAME_SYSTEMS`** (`@master-jdr/shared`, import de valeur, pas `import type`) : par entrée `family` (`jdr` | `ralliement`), `capabilities` ⊆ {characters, scenarioLifecycle, xp, hommeDragon, groupRoles, announcements, linearCampaign}, `kinds`, `openForCreation`. `ryuutama` : jdr, toutes capacités, trois kinds, ouvert ; `draconis` et autres : jdr, fermés ; `ralliement` : aucune capacité, kinds ONE_SHOT + CAMPAGNE_EPISODIQUE, **fermé à la création** jusqu'à l'épic 38, sans ligne `GameSystem`. `familyOf`, `hasCapability`, `kindsOf`, `isOpenForCreation` remplacent `gameSystemHasModule` (front et API). Changement de système entre familles refusé ; `checkPartieKindTransition` réservé à `jdr`.
- **PermissionService** : `assert(userId, action, target)` avec `target = {partieId} | {eventId} | {seanceId}` — la partie est **résolue depuis la cible**, jamais lue dans la route. `PermissionAction` = union fermée (`SCREAMING_SNAKE`) dans `@master-jdr/shared`. `roleOf` et `rolesOf` (en lot), rôles `'mj' | 'player' | 'admin' | 'member'` (seuls mj/player servent ici). Politique `jdr` = propriétaire seul organise et administre. `getOwned`/`getViewable` y délèguent. `membersOf(partie)` unique (JDR : propriétaire + `Membership`). Garde de capacité à l'entrée de chaque service de couche 3. Test qui balaie les sources et échoue si `ownerId` est lu pour décider d'un droit hors `permissions/`, projections et migrations (liste d'exceptions nommée). `GET /parties` sans paramètre renvoie toutes les parties avec leur rôle ; `?role=mj|player` garde son contrat.
- **Ports du calendrier** : couche 1 déclare `OccupiedSpansPort` (plages des autres parties où l'utilisateur participe, sans titre ni identité) et `OwnEventsPort` (calendrier personnel, avec titres, règles d'affichage actuelles), implémentés par `events/` et injectés. `availability/` et `poll/` n'importent plus `parties/` ni `scenarios/` ; le `forwardRef` `PollModule → ScenariosModule` disparaît. `nextSessionDate/nextSessionSlot` (seule valeur dérivée persistée) recalculés par une fonction unique d'`EventsService` (début de la plus proche plage à venir), appelée après toute écriture de date ; `PollService` ne les écrit plus.
- **Rappels** : `Seance.reminderSentAt` remplace `Partie.reminderSentAt` (report sur la séance de `nextSessionDate` si un rappel était parti, puis suppression de la colonne) ; tâche horaire de `NotificationsService` avec garde de non-chevauchement inchangée, un rappel par séance datée, mêmes destinataires (membres de la partie), aucun doublon après migration.
- **Projections explicites** vers les DTO, jamais d'objet Prisma brut ; identité = `pseudo` + `displayName`.

## Cross-Story Dependencies

- Stories strictement séquentielles : chacune exige la précédente livrée (37.1 → 37.9), et chacune garde verts les tests de 37.1.
- 37.3 dépend du renommage `ownerId` (37.2) pour remplir `Event.ownerId` ; 37.4 réécrit les lecteurs de date sur les séances rattachées à `Event` ; 37.6 s'appuie sur le registre (37.5) et sur `EventsService` (37.3) ; 37.7 étend 37.6 aux modules de couche 3 et annexes ; 37.8 suppose `EventsService` et la plage de séance ; 37.9 suppose `nextSessionDate` recalculé par `EventsService` (37.8).
- Bloque tous les épics 38 à 43 (aucune story de ralliement avant la fin de la porte) ; l'épic 38 ouvrira l'entrée `ralliement` du registre et ajoutera `Membership.role` et les politiques ralliement au `PermissionService`.
