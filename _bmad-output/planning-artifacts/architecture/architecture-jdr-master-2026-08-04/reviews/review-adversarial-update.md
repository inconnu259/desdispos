# Revue adversariale — révision du 2026-08-05 (AD-16 → AD-20, AD-1 amendée)

**Méthode.** Pour chaque trou, une **paire de stories** qui respectent *toutes* les AD à la lettre et construisent quand même de façon incompatible. Une paire = un trou. Portée : le neuf (AD-16 à AD-20, la règle amendée d'AD-1) et ses frottements avec l'existant (AD-1, AD-3, AD-8, AD-9, AD-13, AD-15).

**Verdict.** La spine tient sur l'existant, mais les cinq AD neuves sont rédigées un cran en dessous du standard qu'elle s'impose elle-même : AD-3 et AD-8 fixent des **unions fermées dans `@master-jdr/shared`** et des contrats de forme contraignants, AD-16 à AD-20 n'en fixent aucun — cinq paires de stories divergentes en découlent, dont deux collisions frontales entre AD.

---

## CRITIQUE

### C-1 — AD-20 × AD-3 : deux propriétaires pour « vote en cours », et AD-20 est inapplicable en liste

**Paire.**
- **Story A (CAP-5, signalétique de liste).** FR-12 nomme « vote en cours » parmi les signaux. AD-3 impose : *« un code par signal de FR-12 »*, union fermée `PartySignalCode`, **calculé serveur**. La story ajoute `POLL_OPEN` et `POLL_NEEDS_MY_ANSWER` à `party-signals.service.ts`.
- **Story B (CAP-12, vue de partie / chronologie).** AD-20 impose l'inverse pour le même état : *« Réponds au vote » contre « Vote en cours » … **résolus par le client** à partir des charges utiles existantes*, en lisant `PollOptionDto.votes`.

**Les deux sont conformes.** Chacune cite une AD qui la couvre explicitement, et chacune viole l'autre AD.

**Ce qui casse.** Deux vérités pour le même état, calculées par deux chemins qui divergeront au premier écart (retrait de réponse AD-10 pris en compte d'un côté et pas de l'autre, sondage `CLOSED` par `PollService.close()` sans `Seance` associée, etc.). Pire : **AD-20 est structurellement inapplicable sur la liste des parties.** AD-3 interdit tout appel par partie ; la liste ne possède donc *que* `PartySignalsDto` — elle n'a **jamais** `PollOptionDto.votes` en main. La justification d'AD-20 (« le client possède déjà l'information ») est vraie en contexte d'une partie chargée et fausse en contexte de liste, sans que l'AD nomme cette frontière.

**Correctif — resserrer AD-20, ajouter une phrase de frontière :**
> **Frontière de résolution, contraignante.** AD-20 ne s'applique qu'aux surfaces qui ont **déjà chargé la charge utile de la partie concernée** (vue de partie, chronologie, écran de vote). Sur toute surface de **liste** — où AD-3 interdit l'appel par partie et où la seule charge utile est `PartySignalsDto` — l'état est porté par un `PartySignalCode` serveur, jamais reconstruit côté client. Un même état sous-jacent n'est **jamais** exprimé aux deux endroits sous deux noms : si un code `PartySignalCode` existe pour lui, la vue de partie lit ce code plutôt que de le recalculer. La distinction lecteur-dépendante (« Réponds au vote » vs « Vote en cours ») est portée par **deux codes distincts** dans l'union fermée, pas par une interprétation locale.

---

### C-2 — AD-18 × AD-9 : le calendrier personnel se voit imposer deux règles contradictoires

**Paire.**
- **Story A (D-6, couche « mes séances confirmées »).** AD-9 dit textuellement : *« Dans le **calendrier personnel**, les séances de l'utilisateur s'affichent **explicitement et légendées** : ce sont ses propres parties. »* La story affiche « Séance — *La Route du Nord* », avec l'identité de la partie.
- **Story B (CAP-19, même couche).** AD-18 dit textuellement : *« La contrainte de non-fuite d'AD-9 s'y applique **intégralement** : une séance d'une autre partie n'y apparaît que comme indisponibilité, **sans identité de partie**. »* Lecture littérale : dans un endpoint qui agrège « toutes parties confondues », toute séance vient bien d'« une autre partie » que celle de l'écran courant — l'écran courant n'étant aucune partie. La story anonymise tout.

**Les deux sont conformes.** Chacune applique la phrase explicite d'une AD ; les deux phrases visent le même endpoint.

**Ce qui casse.** Soit CAP-19 perd sa couche « mes séances confirmées » (un agenda personnel qui n'affiche que des blocs « indisponible » anonymes pour ses **propres** séances est absurde et rate la CAP), soit la story A est écrite puis annulée en revue par la story B. Le vocabulaire d'AD-9 (« une autre partie ») est relatif à un contexte de partie que le calendrier personnel n'a pas.

**Correctif — resserrer AD-18, remplacer la phrase de renvoi :**
> **Portée de la non-fuite dans le calendrier personnel.** La règle d'AD-9 se reformule ici en termes d'appartenance, jamais en termes de « partie courante » (il n'y en a pas) : une séance d'une partie **dont l'utilisateur est membre** s'affiche **avec l'identité de sa partie**, légendée ; aucun élément d'une partie dont il n'est **pas** membre n'entre dans cette charge utile sous quelque forme que ce soit. La conversion en indisponibilité anonyme d'AD-9 reste réservée au **calendrier d'une partie**, où l'on regarde la disponibilité *d'autrui*.

---

### C-3 — AD-18 : forme de la charge utile non fixée, là où AD-3 la fixe pour le cas jumeau

**Paire.**
- **Story A.** `GET /me/calendar?from&to` → liste plate : `{ items: [{ date, slot, kind, label?, partieId? }] }`, `kind` étant une union fermée.
- **Story B.** Même endpoint → objet par couche : `{ seances: [...], polls: [...], openRegistrations: [...], unavailabilities: [...] }`.

**Les deux sont conformes.** AD-18 n'exige qu'« un endpoint unique, pour une plage de dates, jamais un endpoint par couche ». Aucune contrainte de forme — contrairement à AD-3 qui va jusqu'à imposer `PartySignalsDto = { role, status, signals }`, l'union fermée `PartySignalCode` dans `@master-jdr/shared`, et le tableau vide plutôt que l'entrée absente.

**Ce qui casse.** `calendar-layers.service.ts` et les trois présentations (Mois, Semaine, Agenda) ne peuvent pas être écrits deux fois. La forme B rend en outre impossible l'ajout d'une couche sans changer le DTO — ce qu'AD-16 revendique justement comme acquis (« ajouter une couche plus tard ne coûte aucune migration »). Trou aggravant : la forme B pousse à un tri par couche côté serveur, donc à autant de requêtes que de couches — le fan-out qu'AD-18 existe pour empêcher, réintroduit à l'intérieur de l'endpoint.

**Échappatoire annexe, à refermer dans la même AD.** Le source tree place `me-calendar.controller.ts` sous un module `calendar/` **absent du graphe de modules**. AD-15 ne contraint que les sorties de `PartiesService` : une story qui donne à `CalendarModule` son propre accès Prisma sur `Partie`/`Seance` échappe légalement à la projection explicite, et rouvre la fuite silencieuse à chaque colonne ajoutée plus tard à `Partie` (motif nommé par AD-15).

**Correctif — resserrer AD-18, sur le modèle exact d'AD-3 :**
> **Contrat de forme, contraignant.** `GET /me/calendar?from=<ISO date>&to=<ISO date>` renvoie `MeCalendarDto = { items: CalendarItemDto[] }` — **une liste plate homogène, jamais un objet par couche**. `CalendarItemDto = { date, slot, kind: CalendarItemKind, ... }`. `CalendarItemKind` est une **union fermée déclarée dans `@master-jdr/shared`** et **alignée un pour un sur `layerKey` (AD-16)** : une couche allumée est un filtre sur `kind`, jamais un appel supplémentaire. Ajouter une couche = ajouter un membre à cette union, aucune migration, aucun changement de forme. Aucune séance ni partie n'est lue hors des services propriétaires : la charge utile est composée par appel à `PartiesService` / `AvailabilityService`, dont les sorties restent projetées (AD-15) — `CalendarModule` n'accède jamais à Prisma sur `Partie` ni `Seance`.

---

### C-4 — AD-1 amendée : une seule paire `listViewMode`/`listSort` pour deux listes aux vocabulaires disjoints

**Paire.**
- **Story A (CAP-4/CAP-18, liste des parties).** Écrit `listSort` ∈ `urgency | name | date | role | status` — cohérent avec `@default("urgency")` du Structural Seed.
- **Story B (CAP-8/CAP-18, mes personnages).** CAP-18 exige que *« les mêmes contrôles servent la liste des parties comme la vue mes personnages »*. Mais trier des personnages par « urgence » n'a aucun sens ; la story écrit `listSort` ∈ `level | name | partie | system`.

**Les deux sont conformes.** AD-1 ne dit que « colonne typée `String` », sans énumération et sans le garde-fou qu'AD-13 pose pour `theme` (liste déclarée une seule fois dans `@master-jdr/shared`, validation API s'y référant).

**Ce qui casse.** Deux vocabulaires **disjoints** partagent une colonne : régler le tri des personnages détruit le tri des parties, et inversement — l'utilisateur voit son réglage sauter d'un écran à l'autre, sur un palier dont la promesse est « la préférence suit l'utilisateur ». Le défaut `"urgency"` est déjà un vocabulaire de parties imposé à la liste des personnages. Sans validation ni union, la colonne accepte n'importe quelle chaîne : un `listViewMode` inconnu au front (valeur d'une story plus récente, ou d'un renommage) rend la liste dans un état non prévu au lieu de retomber sur le défaut. Ce n'est pas seulement une sous-spécification : **le modèle de données lui-même est faux** — une préférence pour deux surfaces.

**Correctif — resserrer AD-1 (règle amendée), deux ajouts :**
> **Une préférence par surface.** Un réglage d'affichage porte sur **une** surface : `partyListViewMode` / `partyListSort` et `characterListViewMode` / `characterListSort`. Une colonne partagée par deux listes dont les critères de tri sont disjoints est interdite — la grammaire commune exigée par CAP-18 est celle des **contrôles**, jamais celle du **stockage**.
> **Vocabulaire fermé pour toute colonne `String` de préférence.** Le choix de `String` plutôt qu'un enum Prisma (motivé : ajouter une valeur ne doit pas exiger une migration) s'accompagne **obligatoirement** du garde-fou d'AD-13, généralisé : l'ensemble des valeurs valides est déclaré **une seule fois** dans `@master-jdr/shared` (union fermée), la validation API s'y réfère, et **aucune seconde liste n'est écrite côté serveur ou côté front**. Une valeur **non reconnue en lecture** est traitée comme le défaut, jamais comme une erreur d'écran — les vocabulaires bougent (cf. le renommage de thème de CAP-17).

---

### C-5 — AD-16 : `layerKey` est une chaîne libre, sans union fermée ni validation

**Paire.**
- **Story A (CAP-19, couches d'indisponibilité/disponibilité).** Écrit `unavailability`, `availability`, `sessions`.
- **Story B (CAP-19, couches votes/inscriptions/agrégat MJ).** Écrit `polls-open`, `open-registrations`, `group-availability` — et pour l'existant, `my-unavailability`, `my-availability`, `my-sessions`.

**Les deux sont conformes.** AD-16 fixe la **forme** (`UserCalendarLayer(userId, layerKey)`, unicité) et rien du **vocabulaire** — alors qu'AD-3 (`PartySignalCode`) et AD-8 (`PartieStatus`) imposent chacune une union fermée dans `@master-jdr/shared` pour exactement le même risque.

**Ce qui casse.** Les lignes écrites par A ne sont lues par personne après B : la couche que l'utilisateur avait allumée devient **silencieusement éteinte**, et la table accumule des clés mortes qu'aucune contrainte ne rejette. Sans validation serveur, `layerKey` est une **surface d'écriture arbitraire** : n'importe quel client authentifié peut y insérer autant de lignes que de chaînes distinctes qu'il invente. Le rapprochement avec C-3 est direct : `layerKey` et `CalendarItemKind` sont le même vocabulaire, et rien ne les oblige aujourd'hui à coïncider.

**Correctif — resserrer AD-16 :**
> **Vocabulaire fermé, contraignant.** `layerKey` prend ses valeurs dans `CalendarLayerKey`, **union fermée déclarée dans `@master-jdr/shared`** et **identique à `CalendarItemKind` (AD-18)** — une couche est un `kind` que l'on allume, pas un vocabulaire parallèle. L'écriture est validée serveur contre cette union ; une clé inconnue est **rejetée**, jamais persistée. Ajouter une couche = ajouter un membre à l'union (aucune migration, propriété revendiquée par cette AD).

---

## MAJEUR

### M-1 — AD-16 : « jamais réglé » est indistinguable de « tout éteint volontairement »

**Paire.**
- **Story A.** Aucune ligne = jamais réglé → applique un **jeu de couches par défaut** (tout allumé) au rendu, et n'écrit en base qu'au premier réglage explicite.
- **Story B.** Applique la lettre d'AD-16 — *« l'absence de ligne vaut couche éteinte »* — et garantit le défaut en **semant les lignes** à l'inscription et par migration pour les comptes existants.

**Les deux sont conformes.** A respecte CAP-19 (« un calendrier ne peut pas paraître vide sans qu'on sache pourquoi ») ; B respecte la phrase littérale d'AD-16.

**Ce qui casse.** Si A l'emporte, un utilisateur qui éteint **volontairement toutes** ses couches (0 ligne) se les voit **toutes rallumées** au chargement suivant — sa préférence est indéfiniment inapplicable, et il n'existe aucun moyen de l'exprimer. Si B l'emporte et que la migration/seed manque (elle n'est exigée par aucune AD), tout compte existant ouvre un calendrier **vide** au premier chargement. C'est exactement le problème qu'AD-1/AD-13 ont résolu ailleurs, et bien : `theme String?` où `null` signifie *jamais choisi*, distinct de toute valeur choisie. AD-16 ne reproduit pas cette distinction. Le vocabulaire d'AD-16 ne peut pas non plus représenter l'écart au défaut, alors que CAP-19 exige que l'écran **signale** cet écart et propose de rétablir.

**Trou joint, même AD.** La sixième couche de CAP-19 — *« pour le MJ, dans une partie — la disponibilité agrégée du groupe »* — est **scopée à une partie**, dans une table **scopée au compte**, et vit sur une surface (calendrier d'une partie) que le calendrier personnel d'AD-18 ne sert pas. Story A la stocke comme les cinq autres ; story B la garde locale à l'écran. Le compte de couches diverge, et le « rétablir le défaut » de CAP-19 ne porte pas sur le même ensemble.

**Correctif — resserrer AD-16, deux ajouts :**
> **Réglé vs jamais réglé.** L'ensemble des couches actives est **explicitement matérialisé dès qu'il est réglé une première fois** : une ligne sentinelle `calendarLayersConfigured Boolean @default(false)` sur `User` (scalaire, AD-1) distingue *jamais réglé* — le front applique alors le **défaut d'usine**, déclaré une seule fois dans `@master-jdr/shared` à côté de `CalendarLayerKey` — de *réglé à l'ensemble vide*, qui est une préférence légitime et respectée. Aucune migration ne sème de lignes : le défaut vit dans le code partagé, pas en base. L'écart entre l'ensemble courant et le défaut d'usine est calculable côté front, ce qui rend le « rétablir » de CAP-19 réalisable.
> **Portée.** `UserCalendarLayer` ne porte que les couches du **calendrier personnel**. Une couche scopée à une partie (agrégat de disponibilité du groupe, MJ) n'y entre pas — elle appartient à l'écran de la partie et n'est pas une préférence de compte.

---

### M-2 — AD-19 × AD-17 × CAP-17 : ni ordre de priorité, ni composition exacte de la graine

**Paire (a) — priorité.**
- **Story A (CAP-20).** L'image de couverture remplace la bannière **dans tous les modes** (le commentaire Prisma `null = bannière générée` va dans ce sens).
- **Story B (CAP-18, liste compacte / vignette intermédiaire).** Garde la bannière générée hors grande vignette, pour préserver une signalétique de couleur stable par partie.

**Les deux sont conformes.** Aucune AD ne tranche. **Q-15 est ouverte dans la SPEC** (« l'image remplace-t-elle la bannière dans *tous* les modes ou seulement en grande vignette ? ») et **n'apparaît ni dans AD-17/AD-19 ni dans le tableau `Deferred`** — la spine ne sait pas qu'elle est ouverte.

**Paire (b) — graine.**
- **Story C.** Dérive la géométrie de `partieId` seul ; le thème n'intervient que par variables CSS.
- **Story D.** Dérive tout de `hash(partieId + themeKey)`, lecture de « déclinée selon le thème actif » (CAP-20).

**Ce qui casse.** (a) Une même partie porte **deux identités visuelles selon l'écran** — l'échec exact que CAP-20 vise (« toujours la même bannière, sur tous les appareils »). (b) Si `themeKey` entre dans la graine, le **renommage `medieval-steampunk` → `atelier-cuivre` de CAP-17 change toutes les bannières de tous les utilisateurs de ce thème** : le déterminisme sur lequel AD-19 fonde son refus de persister est cassé par une story d'un autre chantier du même palier, sans qu'aucune AD ne le voie passer.

**Correctif — resserrer AD-19 :**
> **Composition de la graine, contraignante.** La graine est dérivée de **`Partie.id` seul** — jamais du nom de la partie, jamais de la clé de thème, jamais d'un horodatage. Le thème n'agit que sur la **palette appliquée** au rendu, jamais sur la géométrie tirée : renommer un thème (CAP-17) ne change aucune bannière. C'est ce qui rend le non-stockage sûr.
> **Ordre de priorité, contraignant.** `coverImageUrl` renseignée gagne **sur toutes les surfaces qui disposent d'une zone d'image**, quel que soit le mode d'affichage ; la bannière générée est le **repli**, jamais une alternative choisie par l'écran. Une surface sans zone d'image (liste compacte) affiche une **pastille dérivée de la même graine**, produite par le **même utilitaire** que la bannière — un seul dérivateur, `party-banner.util.ts`, jamais un second calcul de couleur ailleurs. *(Reste ouvert et à inscrire en `Deferred` : le sort de l'animation de thème quand une image est fournie — Q-15, seconde moitié.)*

---

### M-3 — AD-17 : l'utilitaire n'a ni signature, ni chemin, ni nommage, ni politique de collision, ni forme d'URL

**Paire.**
- **Story A (couverture de partie).** `saveImage(file, { dir: 'covers' })` → écrit `uploads/covers/<uuid>.webp`, persiste le **chemin relatif** `/uploads/covers/<uuid>.webp`.
- **Story B (refactor du portrait, imposé par la même AD).** Réutilise le répertoire existant avec un préfixe, nomme le fichier d'après l'entité (`cover-<partieId>.jpg`, idempotent, « pas de fichier orphelin »), et persiste une **URL absolue** construite depuis l'origine de l'API.

**Les deux sont conformes.** AD-17 ne fixe que le périmètre du mécanisme (MIME, 5 Mo, EXIF, disque) et le fait qu'il soit partagé — rien de son **interface**.

**Ce qui casse.** `Partie.coverImageUrl` (et `portraitUrl`) contiennent **deux formes** selon la story qui a écrit la ligne ; un changement d'origine au Palier 11 casse la moitié des lignes. Le nommage dérivé de l'entité (B) fait **écraser** l'ancien fichier : avec un cache HTTP, l'utilisateur continue de voir l'ancienne image après remplacement, et rien ne peut invalider une URL qui n'a pas changé. Le nommage par uuid (A) laisse au contraire un fichier orphelin à chaque remplacement — question renvoyée à `Deferred` (« rétention »), mais le **choix de nommage la préempte** et n'est nulle part. Enfin, le refactor du portrait imposé par AD-17 peut, sans le dire, **normaliser le format des URLs déjà persistées** et invalider tous les portraits existants sans migration.

**Correctif — resserrer AD-17 :**
> **Interface, contraignante.** `image-upload.util.ts` expose une fonction unique `storeImage(file, kind: 'portrait' | 'cover'): Promise<string>` qui renvoie **un chemin relatif servi par l'API** (`/uploads/<kind>/<uuid>.<ext>`) — **aucune origine, aucun host n'est jamais persisté en base** (le Palier 11 changera la topologie). Le nom de fichier est un **uuid neuf à chaque dépôt**, jamais dérivé de l'identifiant de l'entité : un remplacement produit une URL neuve, donc immunisée au cache. Le remplacement **ne supprime pas** l'ancien fichier — la rétention reste `Deferred`, traitée en une fois pour portraits et couvertures. Le refactor du portrait **conserve à l'identique** le format des URLs déjà persistées : aucune ligne existante n'est réécrite, aucune migration de données n'est introduite par ce refactor.

---

### M-4 — AD-20 × AD-15 : un compteur agrégé sur `PartieDto` fuit l'existence d'un brouillon

**Paire.**
- **Story A (CAP-4/CAP-18, carte de partie).** La vignette intermédiaire affiche « 3 scénarios · 5 séances ». AD-15 impose une projection explicite ; la story y ajoute `scenarioCount` / `seanceCount`, calculés serveur en requête groupée (AD-3, « lecture en lot »). Rien n'interdit ce champ.
- **Story B (CAP-12, chronologie).** AD-20 s'applique : le client compte `scenarios.length` sur la liste qu'il a reçue, laquelle **exclut déjà les brouillons** pour un joueur (`GET /parties/:id/scenarios/drafts` est un chemin séparé — vérification citée par AD-20).

**Les deux sont conformes.**

**Ce qui casse.** Le compteur serveur de A n'a **aucune raison** d'être filtré par rôle — rien dans AD-15 ne l'exige — donc la carte affiche « 3 scénarios » à un joueur qui n'en voit que 2 dans la chronologie. Double dégât : (1) deux écrans du même palier donnent **deux nombres différents** pour la même partie ; (2) c'est précisément l'interdit de CAP-12 — *« Un joueur ne peut déduire d'aucun indice — espace, **compteur**, position — qu'un scénario brouillon existe. »* La règle existe côté SPEC ; aucune AD ne la porte, alors qu'AD-15 est exactement l'endroit où les champs de `PartieDto` se décident.

**Correctif — ajouter une AD (AD-21) ou une clause à AD-15 :**
> **Agrégats dépendants du lecteur.** Tout compteur ou agrégat exposé dans un DTO est calculé **sous la même règle de visibilité que la collection qu'il résume**, avec le rôle du demandeur en **paramètre obligatoire** de son calcul — un compteur n'est jamais dérivé d'un `_count` Prisma brut. Corollaire : un état ou un nombre visible sur deux surfaces provient d'**une seule source** — soit le serveur (AD-3/AD-15), soit le client (AD-20), jamais des deux (cf. C-1).

---

### M-5 — AD-13 × CAP-17 : la migration de la valeur `medieval-steampunk` n'est attribuée à personne

**Paire.**
- **Story A (CAP-17, découpe des thèmes).** Renomme le fichier et la clé en `atelier-cuivre`, met à jour l'union de `@master-jdr/shared` — et considère la persistance hors de son périmètre (« aucun changement serveur dans ce palier »).
- **Story B (CAP-1, préférences de compte).** Écrit `User.theme` en validant contre l'union partagée — et considère le renommage hors de son périmètre.

**Les deux sont conformes.** AD-13 fixe la source de vérité et l'exception d'amorçage, mais **ne dit rien d'une migration de valeur** ni d'un alias de lecture.

**Ce qui casse.** Personne ne migre. `User.theme = 'medieval-steampunk'` devient une valeur hors union : soit la validation la rejette, soit le front ne trouve pas le fichier. Tous les utilisateurs de ce thème le perdent — **le symptôme exact qu'AD-13 dit prévenir** (« un utilisateur existant perdant silencieusement son thème »), et que CAP-17 pose en critère de succès (« les préférences de thème déjà enregistrées survivent au renommage »).

**Correctif — resserrer AD-13 :**
> **Renommage d'une valeur de vocabulaire.** Tout renommage d'une clé de thème (CAP-17 : `medieval-steampunk` → `atelier-cuivre`) s'accompagne, **dans la même story**, d'une migration des valeurs `User.theme` déjà persistées **et** de la réécriture du cache local d'amorçage à la première lecture. Un renommage sans migration est interdit ; l'alias de lecture permanent est écarté (il rouvrirait la seconde liste de valeurs qu'AD-13 existe pour empêcher). *(Règle générale : cf. la clause de tolérance de C-4 — une valeur non reconnue retombe sur le défaut, jamais sur une erreur d'écran.)*

---

## MINEUR

### m-1 — AD-18 : ni format ni plafond de la plage de dates
Story A : `?from&to` en dates ISO, plafond 90 jours. Story B : `?month=2026-08`, une requête par mois. Les deux conformes. La vue **Agenda** de CAP-19 est potentiellement non bornée : sans plafond, une requête peut balayer plusieurs années sur **toutes** les parties de l'utilisateur — le motif qu'AD-3 combat, déplacé du *nombre d'appels* vers le *volume*. **Correctif :** fixer dans AD-18 `from`/`to` en dates ISO, `to` obligatoire, amplitude maximale bornée (p. ex. 366 jours), dépassement = `400`.

### m-2 — AD-18 / D-13 : « inscriptions ouvertes » = données de parties dont l'utilisateur n'est pas membre
La SPEC impose : *« Aucune donnée d'une partie tierce ne remonte à qui n'en est pas membre »*. Une inscription ouverte est exactement cela. Story A renvoie `{ nom, système, date }` ; story B ajoute MJ, participants, prochaine séance. Aucune projection n'est fixée. **Correctif :** nommer dans AD-18 un `OpenRegistrationDto` minimal et explicite, en rappelant qu'il constitue l'**unique exception** nommée à la règle de non-fuite, et qu'aucun champ ne s'y ajoute sans révision de l'AD.

### m-3 — AD-17 : dimensions et poids servis non contraints
Le plafond de 5 Mo est hérité du portrait, mais une couverture est large et une liste en grande vignette en affiche N. Story A redimensionne et sert une variante ; story B stocke et sert le fichier brut. Les deux conformes — et B fait charger plusieurs dizaines de Mo à l'ouverture de la liste, sur un palier dont la cible principale est le mobile. **Correctif :** fixer dans AD-17 un redimensionnement à l'entrée (côté serveur, dans l'utilitaire partagé) et une dimension maximale servie, par `kind`.

### m-4 — Source tree : bloc `calendar/` incohérent
Sous `calendar/` figurent `me-calendar.controller.ts` **puis** `parties.controller.ts` et `parties.service.ts` (qui appartiennent à `parties/`, dont le bloc précède). Par ailleurs `CalendarModule` n'apparaît **ni dans le graphe Mermaid des modules, ni dans la table Capability → Architecture**. C'est la coquille qui rend crédible l'échappatoire d'AD-15 relevée en C-3. **Correctif :** corriger l'indentation, et déclarer explicitement `CalendarModule` dans le graphe avec ses dépendances (`PartiesModule`, `AvailabilityModule`, `PollModule`) — un module qui n'est nulle part dans le graphe n'a aucune frontière opposable.

### m-5 — La SPEC ne lie que « AD-1 à AD-15 »
`SPEC.md` §Constraints : *« Les règles d'architecture … vivent dans les companions — `ARCHITECTURE-SPINE.md` (**AD-1 à AD-15**) »*. Les cinq AD neuves ne sont donc **formellement liées par aucune contrainte de la SPEC** : une story qui s'autorise la SPEC comme contrat canonique (ce que son propre en-tête revendique) peut ignorer AD-16 à AD-20 sans faute. **Correctif :** mettre à jour la SPEC en « AD-1 à AD-20 » — ou mieux, retirer l'énumération, qui se périme à chaque révision.

---

## Récapitulatif des correctifs

| # | Action | AD |
| --- | --- | --- |
| C-1 | Ajouter la clause de **frontière de résolution** (liste = serveur, partie chargée = client ; jamais les deux) | resserrer AD-20 |
| C-2 | Reformuler la non-fuite **en termes d'appartenance**, pas de « partie courante » | resserrer AD-18 |
| C-3 | Fixer `MeCalendarDto` / `CalendarItemKind` (liste plate, union fermée dans `shared`) + interdire l'accès Prisma direct de `CalendarModule` | resserrer AD-18 |
| C-4 | **Une préférence par surface** + vocabulaire fermé obligatoire pour toute colonne `String` de préférence + tolérance à la valeur inconnue | resserrer AD-1 (amendement) |
| C-5 | `CalendarLayerKey` union fermée dans `shared`, identique à `CalendarItemKind`, validée serveur | resserrer AD-16 |
| M-1 | Sentinelle *jamais réglé* + défaut d'usine dans `shared` + exclusion de la couche scopée partie | resserrer AD-16 |
| M-2 | Graine = `Partie.id` **seul** + ordre de priorité image > bannière sur toutes les surfaces + un seul dérivateur | resserrer AD-19 |
| M-3 | Signature `storeImage`, chemin relatif jamais absolu, uuid neuf par dépôt, URLs existantes inchangées | resserrer AD-17 |
| M-4 | Agrégats calculés sous la règle de visibilité de leur collection ; une seule source par état | **AD-21** (ou clause AD-15) |
| M-5 | Migration de valeur obligatoire à tout renommage de clé de thème | resserrer AD-13 |
| m-1 → m-5 | Plage de dates bornée · `OpenRegistrationDto` · redimensionnement à l'entrée · source tree + graphe · SPEC « AD-1 à AD-20 » | AD-18, AD-17, doc |
