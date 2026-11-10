# Sprint Change Proposal — 2026-09-20

## 1. Issue Summary

**Déclencheur :** en testant la création d'un personnage (vérification visuelle de la story 31.4), l'utilisateur a jugé le parcours d'*entrée* dans la création peu évident : il faut cliquer sur la bonne aventure, puis repérer à gauche l'**initiale de son prénom** — cliquable, avec une petite icône, mais « pas très parlant ». Il demande :

1. un **bouton explicite** « créer le personnage » dans le détail de l'aventure ;
2. dans **Personnages**, au-dessus de la liste, les **créations possibles** — « créer un personnage pour *<nom de l'aventure>* » ;
3. que les **personnages des MJ** (les Hommes Dragons) apparaissent aussi dans Personnages, **avec leur création** — éventuellement à rattacher à l'épic qui traite de l'Homme Dragon (33) ;
4. *(ajouté en cours de passe)* qu'on **interdise la création d'une partie sur un système de jeu qui n'a pas de module** — ce qui a produit, sur une partie Draconis, l'erreur trompeuse « Impossible de charger l'assistant de création ». Un message explicite reste suffisant **en attendant**.

**Nature du problème :** nouvelle exigence née de l'usage réel — problème de découvrabilité, pas une régression ni une erreur d'implémentation. Les stories 29.1 (« création mise en avant », FR-9) et 29.2 (« mes personnages », FR-16) sont livrées conformes à leurs AC ; elles ne couvraient pas le point d'entrée de création d'un *personnage*.

**Preuves (état du code au 2026-09-20) :**
- Sur la partie : la création n'existe que comme **slot d'initiale du roster desktop** (`partie-detail.html:23`, `createCharacter()` `partie-detail.ts:289`) et comme **onglet « Ma fiche » sur mobile** (`partie-detail.html:229-246`, réservé à `!isMj() && !isDesktop()`). Aucun bouton explicite sur l'écran de la partie lui-même.
- Dans Personnages (`my-characters.ts`) : liste des seuls personnages de l'utilisateur ; aucune entrée de création. La spec 29.2 l'impose (« la liste ne contient que les miens », « ne mélange jamais parties et personnages »).
- L'Homme Dragon **n'est pas un personnage dans le modèle** : table `HommeDragon` distincte (`prisma/schema.prisma:399`, unique `[userId, partieId, gameSystemId]`), routes `POST/GET/PATCH /parties/:id/homme-dragon`, **absent de `GET /me/characters`**. Sa fiche n'a **pas de route propre** : elle est incrustée dans `PartieDetail` (`partie-detail.html:334`, `isMj() && gameSystemId === 'ryuutama'`).
- Un MJ peut techniquement créer un personnage sur sa propre partie (`character.service.ts:282`, `isMj = partie.mjId === userId`), mais **aucun point d'entrée UI ne le lui propose** (slot et onglet sont réservés aux joueurs).
- Cause de la 4ᵉ demande : `GET /game-systems/draconis/schema` → **404**. Le formulaire de création de partie propose **les quatre systèmes** de la constante partagée `GAME_SYSTEMS` (`packages/shared/src/index.ts:99` : Draconis, Conte de Minuit, Ryuutama, Esteren — `partie-form.ts:77`), et `CreatePartieDto` les accepte tous (`create-partie.dto.ts:6,15`), alors que **seul Ryuutama a un module** (`game-system.service.ts:203,236` : tout autre id lève un 404). Trois systèmes sur quatre mènent donc à une partie dont la création de personnage échoue.
- ⚠️ **Il n'existe aujourd'hui aucun signal « ce système a un assistant ? »** : `GET /game-systems` liste **tout ce qui est en base** (`findAll`, `game-system.service.ts:197`), pas les modules disponibles. Le prédicat des stories 29.15/29.16 a besoin d'un indicateur — voir 4.0.

## 2. Impact Analysis

### Epic Impact

- **Épic 29 (Navigation et listes)** — marqué `done`. Il doit être **rouvert** (`in-progress`) pour accueillir **trois** stories : **29.15** (bouton sur la partie), **29.16** (section de création dans Personnages) et **29.17** (seuls les systèmes jouables sont proposés à la création d'une partie — dans l'esprit de 29.14, « refonte des écrans de création et d'édition de partie »). Le changement est additif ; aucun AC livré n'est modifié, sauf **une lecture élargie de 29.2** (voir ci-dessous).
- **Épic 33 (Homme Dragon)** — `backlog`. Une story **33.5** est ajoutée : l'Homme Dragon dans Personnages, et sa création depuis là. C'est le seul morceau qui touche **l'API** (agrégation), d'où son rattachement à l'épic qui possède déjà le sujet, comme l'utilisateur le suggérait.
- **Épic 31** : non touché. **La story 31.4 (in-progress) est indépendante** : le wizard lui-même (ses 9 étapes) ne change pas ; seuls les *points d'entrée* sont concernés.
- Aucun épic invalidé. Aucune renumérotation : les nouvelles stories s'ajoutent en **fin** d'épic (29.15, 29.16, 29.17 ; 33.5).

### Story Impact

- **29.1 (« Liste unique des parties »)** et **29.2 (« Vue mes personnages »)**, `done` : leurs AC sont conservés. ⚠️ **Amendement d'interprétation de 29.2**, à consigner : « la liste ne contient que les miens » et « ne mélange jamais parties et personnages » restent vrais **de la liste** ; la nouvelle section de création est un bloc **distinct, hors liste**, jamais fait de cartes de personnages. 29.16 en fait un AC explicite.
- **Story 31.4** : intacte. Le contrat UI `ux-jdr-master-2026-08-31` (wizard) n'est pas concerné.
- **Chip de correction en cours (« Handle game systems without a creation plugin »)** : **son premier volet (message explicite sur un 404) est confirmé par l'utilisateur comme suffisant en attendant** — il reste à faire tel quel, il protège aussi les parties déjà créées sur un système sans module. Son second volet (ne plus offrir le bouton) est **repris par 29.15/29.16**, qui s'appuient sur l'indicateur de 4.0. À coordonner sur `partie-detail.{ts,html}` : ne pas les faire en parallèle sans rebase.

### Artifact Conflicts

- **PRD (`prd-jdr-master-2026-08-01/prd.md`)** : pas de conflit avec les objectifs. **Trois exigences nouvelles** sans ancrage FR : proposées **FR-58** (visibilité du point d'entrée de création d'un personnage — 29.15, 29.16), **FR-59** (Hommes Dragons dans « Personnages » — 33.5) et **FR-60** (seuls les systèmes disposant d'un module peuvent être choisis pour une nouvelle partie — 29.17). Par précédent (29.0, 29.4/29.5 insérées sans FR), elles sont ajoutées à l'inventaire d'`epics.md` ; **le PRD est à mettre à jour à sa prochaine révision** (`bmad-prd`, intention update).
- **`epics.md`** : 4 stories insérées (29.15, 29.16, 29.17, 33.5), FR-58/FR-59/FR-60 ajoutés à l'inventaire et à la table de couverture, notes d'implémentation des épics 29 et 33 complétées.
- **UX (`ux-jdr-master-2026-08-04`)** : le §4 « liste des personnages » et le patron `ListControlBar` (7.7) s'appliquent à la liste ; **aucune planche ne dessine le point d'entrée de création ni une section au-dessus de la liste**. Une **passe `bmad-ux`** est recommandée pour 29.15/29.16 avant `create-story` (placement mobile/desktop, distinction visuelle bouton vs slot, section vs liste).
- **Architecture (`ARCHITECTURE-SPINE.md` 2026-08-04)** : 29.15/29.16 sont du front pur — aucune AD — *une fois l'indicateur de 4.0 posé par 29.17*. **29.17 touche `packages/shared` et l'API** (validation du DTO, aucune migration). **33.5 touche l'API** : une lecture agrégée `HommeDragon` de l'utilisateur, sans migration ni changement de `MyCharacterDto`. Le choix (endpoint dédié vs extension de `GET /me/characters`) est laissé à `create-story`, avec la contrainte de **ne pas casser `MyCharacterDto`** ni ses consommateurs (`my-characters`, `dashboard`, tris).
- **Temps réel (`docs/checklist.md`)** : la section de création dépend de « ai-je un personnage sur cette partie ? » — donnée qui change quand on crée. À évaluer par story (canal `user:{id}` existant) ; au minimum rafraîchie au retour de navigation.

### Technical Impact

- **29.17** : `packages/shared` (indicateur de module sur `GAME_SYSTEMS`), `create-partie.dto.ts` (validation restreinte), `partie-form.ts` (n'offre que les systèmes jouables). **Les parties déjà créées sur un système sans module ne sont pas migrées** : elles restent, avec le message explicite. Les specs API utilisent `'draconis'` comme fixture (`homme-dragon.service.spec`, `invite-links.service.spec`, `parties.*.spec`) — seule la **validation de DTO** change, pas les services : à vérifier, pas à présumer.
- **29.15** : `partie-detail.{ts,html,scss}` ; un **prédicat partagé** « puis-je créer un personnage ici ? » (non-MJ · pas déjà de personnage · système jouable) — à écrire **une fois**, réutilisé par 29.16.
- **29.16** : `my-characters.{ts,html,scss}` ; sources déjà disponibles côté front (parties de l'utilisateur, `MyCharacterDto[]`, indicateur de 4.0). Aucun appel réseau supplémentaire.
- 33.5 : API (lecture agrégée, `packages/shared` pour le DTO) + front ; **la fiche Homme Dragon n'ayant pas de route propre**, l'ouvrir depuis Personnages exige soit une route dédiée, soit une navigation vers l'onglet de la partie — décision de `create-story`.
- Aucune migration, aucune dépendance.

## 3. Recommended Approach

**Option retenue : Direct Adjustment** — ajout de trois stories dans les épics existants (29 rouvert, 33).

- Rollback : non pertinent, rien à défaire.
- Révision du MVP : non pertinente, aucun objectif du PRD n'est remis en cause.

**Découpage retenu (proposé par l'utilisateur, validé en conversation le 2026-09-20)** : systèmes jouables → bouton sur la partie → section dans Personnages → Hommes Dragons. Ordre recommandé **29.17 → 29.15 → 29.16 → 33.5** : 29.17 est **petite** et pose l'indicateur de module que 29.15/29.16 lisent ; 29.15 pose le prédicat partagé et la micro-copie ; 29.16 le réutilise ; 33.5 étend la section à l'Homme Dragon.

**Décisions prises avec l'utilisateur (2026-09-20) :**
- création offerte **uniquement pour les systèmes ayant un module** ; à terme, **on ne peut plus créer de partie** sur un système sans module (29.17) ; d'ici là, un **message explicite** suffit (chip de correction) ;
- l'Homme Dragon va dans l'épic 33 ;
- **rôle MJ — tranché : sur chaque aventure, un MJ Ryuutama a un Homme Dragon (un seul *par aventure*, pas un seul au total) et pas de personnage joueur.** Le modèle le porte déjà (`HommeDragon` unique par `[userId, partieId, gameSystemId]`). L'entrée de création d'un MJ est celle de l'Homme Dragon (33.5), **une par aventure qui n'en a pas encore** ; 29.15 et 29.16 ne lui proposent jamais de personnage joueur. (L'API l'autoriserait techniquement — `character.service.ts:282` — mais c'est un choix produit de ne pas l'exposer.)

**Effort estimé :** Faible (29.17 et 29.15), Moyen (29.16 : nouvelle section + états), Moyen-élevé (33.5 : API + navigation vers une fiche sans route). **Risque :** Faible pour 29.15/29.16 (additif, front pur) ; Faible-moyen pour 29.17 (validation de DTO : vérifier les specs et e2e qui créent des parties Draconis) ; Moyen pour 33.5 (contrat API partagé, `MyCharacterDto` à préserver).

**Justification :** le besoin est net, motivé par un vrai passage d'utilisateur, et le point d'appui existe (`createCharacter()`, `MyCharacters`, `GET /game-systems`). Les stories 29.15/29.16 se livrent en front pur ; 29.17 ne touche l'API que par une validation de DTO ; seule 33.5 exige une lecture agrégée, isolée dans l'épic qui en est propriétaire.

## 4. Detailed Change Proposals

### 4.0 Indicateur de module — décision de conception

`GAME_SYSTEMS` (`packages/shared`) porte aujourd'hui `{ id, name }`. **29.17 y ajoute un indicateur booléen** (nom laissé à la story, ex. `hasModule`), `true` pour Ryuutama seul. C'est la **source de vérité unique** :
- `CreatePartieDto` valide `gameSystemId` contre les systèmes qui l'ont ;
- `partie-form` n'affiche que ceux-là ;
- 29.15/29.16 le lisent pour décider d'offrir la création — **sans appel réseau**.

*Alternative écartée :* lire `GET /game-systems` — il liste tout ce qui est en base, pas les modules disponibles ; il faudrait l'enrichir côté API pour un résultat équivalent à une constante déjà partagée.

### 4.1 `epics.md` — inventaire des FR

**Ajout** après FR-48 :

> - FR-58 : Point d'entrée explicite de création d'un personnage — sur la partie, et dans « Personnages »
> - FR-59 : Les Hommes Dragons des MJ figurent dans « Personnages », avec leur création
> - FR-60 : Seuls les systèmes de jeu disposant d'un module peuvent être choisis pour une nouvelle partie

**Table de couverture** : `FR-58 → 29.15 · 29.16` ; `FR-59 → 33.5` ; `FR-60 → 29.17`.

### 4.2 `epics.md` — Story 29.15 (épic 29, après 29.14)

> ### Story 29.15 : Un bouton clair pour créer son personnage depuis la partie
>
> As a joueur qui rejoint une partie,
> I want un bouton explicite « Créer mon personnage » sur l'écran de la partie,
> So that je sache tout de suite par où commencer, sans deviner qu'une initiale est cliquable.
>
> **Acceptance Criteria:**
>
> **Given** je suis joueur d'une partie dont le système de jeu dispose d'un module, et je n'y ai pas encore de personnage
> **When** j'ouvre le détail de la partie, sur téléphone comme sur ordinateur
> **Then** un bouton « Créer mon personnage » est visible, sans changer d'onglet ni défiler
> **And** il ouvre l'assistant de création de cette partie
>
> **Given** j'ai déjà un personnage sur cette partie
> **When** j'ouvre son détail
> **Then** le bouton n'est pas affiché — il ne mène jamais à un refus « vous avez déjà un personnage »
>
> **Given** la partie utilise un système de jeu sans module (indicateur de la story 29.17)
> **When** j'ouvre son détail
> **Then** aucun bouton de création n'est proposé
>
> **Given** je suis MJ de la partie
> **When** j'ouvre son détail
> **Then** aucun bouton de personnage joueur n'est proposé
> **And** l'entrée de création du MJ est celle de son Homme Dragon (story 33.5) — un MJ n'a pas de personnage joueur, et a un Homme Dragon par aventure
>
> **Given** le slot d'initiale du roster sur ordinateur
> **When** il reste affiché
> **Then** il conserve son comportement, mais n'est plus le seul point d'entrée
>
> **Given** le bouton
> **When** il est rendu
> **Then** c'est un vrai lien ou bouton, atteignable au clavier, dont la cible mesure au moins 44 × 44 px
> **And** son libellé vient de la micro-copie de thème, jamais codé en dur
>
> *Règle écrite une seule fois :* « puis-je créer un personnage sur cette partie ? » (non-MJ · aucun personnage · système avec module) est un prédicat partagé avec la story 29.16.

### 4.3 `epics.md` — Story 29.16 (épic 29)

> ### Story 29.16 : Créer un personnage depuis « Personnages »
>
> As a joueur,
> I want retrouver, en haut de mes personnages, les aventures où il me reste à créer le mien,
> So that la création soit là où je cherche mes personnages.
>
> **Acceptance Criteria:**
>
> **Given** je suis joueur de parties où je n'ai pas encore de personnage, et dont le système dispose d'un module
> **When** j'ouvre « Personnages »
> **Then** une section placée au-dessus de la liste propose une entrée par partie : « Créer un personnage pour *<nom de l'aventure>* »
>
> **Given** une entrée de cette section
> **When** je l'active
> **Then** j'arrive sur l'assistant de création de cette partie
>
> **Given** je n'ai aucune partie sans personnage
> **When** j'ouvre « Personnages »
> **Then** la section n'est pas rendue — jamais un bloc vide
>
> **Given** cette section et la liste
> **When** l'écran s'affiche
> **Then** la section est visuellement distincte et ne contient aucune carte de personnage
> **And** la liste ne contient toujours que mes personnages (story 29.2 inchangée)
> **And** la recherche, le tri et le mode d'affichage de la liste ne la masquent ni ne la réordonnent
>
> **Given** je viens de créer mon personnage sur une partie
> **When** je reviens sur « Personnages »
> **Then** l'entrée de cette partie a disparu et mon personnage figure dans la liste
>
> **Given** une partie dont le système n'a pas de module, ou dont je suis le MJ
> **When** la section est calculée
> **Then** elle n'y figure pas
>
> **Given** cette section
> **When** elle est rendue
> **Then** chaque entrée est un vrai lien, atteignable au clavier, cible d'au moins 44 × 44 px
> **And** elle réutilise le prédicat et la micro-copie de la story 29.15
>
> *Temps réel :* à évaluer à la création de la story (canal `user:{id}`, `docs/checklist.md`) — le minimum requis est le rafraîchissement au retour de navigation.

### 4.4 `epics.md` — Story 33.5 (épic 33, après 33.4)

> ### Story 33.5 : Mes Hommes Dragons dans « Personnages »
>
> As a MJ,
> I want retrouver mon Homme Dragon dans « Personnages » et pouvoir l'y créer,
> So that mon dragon soit aussi facile à atteindre que les personnages de mes joueurs.
>
> **Acceptance Criteria:**
>
> **Given** je suis MJ de parties Ryuutama où j'ai créé un Homme Dragon
> **When** j'ouvre « Personnages »
> **Then** chacun apparaît dans la liste, avec la partie dont il provient
> **And** sa nature (Homme Dragon, et non personnage joueur) se lit sans l'ouvrir
>
> **Given** un Homme Dragon listé
> **When** je l'ouvre
> **Then** j'arrive sur sa fiche
>
> **Given** une aventure Ryuutama dont je suis MJ et où je n'ai pas encore d'Homme Dragon (un par aventure — le même dragon utilisé sur plusieurs aventures est hors périmètre)
> **When** j'ouvre « Personnages »
> **Then** la section de création de la story 29.16 propose « Créer un Homme Dragon pour *<nom de l'aventure>* »
> **And** elle m'amène sur le parcours de création de l'Homme Dragon
>
> **Given** la liste contenant des Hommes Dragons
> **When** j'utilise la recherche, le tri ou le mode d'affichage
> **Then** ils s'appliquent aux Hommes Dragons comme aux personnages
> **And** leur nom suit la convention d'identité de l'épic 28
>
> **Given** une partie dont je ne suis pas le MJ
> **When** « Personnages » est calculé
> **Then** l'Homme Dragon de son MJ n'y figure jamais
>
> **Given** cette lecture agrégée
> **When** elle est servie
> **Then** elle ne déclenche pas de requête par partie
> **And** `GET /me/characters` et son DTO sont inchangés pour leurs consommateurs existants
>
> *À trancher à la création de la story :* endpoint dédié ou extension de la lecture existante ; route propre pour la fiche Homme Dragon ou navigation vers la partie (elle n'a pas de route aujourd'hui).
>
> *Hors périmètre, à ouvrir séparément :* réutiliser **le même Homme Dragon sur plusieurs aventures** (facultatif). Aujourd'hui un Homme Dragon est propre à une aventure ; le partager suppose un changement de modèle, donc une story à part dans l'épic 33 — non créée par cette passe.
>
> *Séquencement :* indépendante de 33.1 (fiche refondue) et de 33.3 (formulaire guidé) — ils enrichissent ce vers quoi elle mène, sans en être un prérequis.

### 4.4 bis `epics.md` — Story 29.17 (épic 29, à placer **avant** 29.15 dans l'ordre de travail)

> ### Story 29.17 : Seuls les systèmes jouables sont proposés à la création d'une partie
>
> As a MJ qui crée une partie,
> I want ne choisir qu'un système de jeu que l'application sait réellement faire jouer,
> So that je ne crée pas une partie où personne ne pourra ensuite créer de personnage.
>
> **Acceptance Criteria:**
>
> **Given** le formulaire de création d'une partie
> **When** je choisis le système de jeu
> **Then** seuls les systèmes disposant d'un module sont proposés
>
> **Given** une requête de création de partie portant un système sans module
> **When** l'API la reçoit
> **Then** elle la refuse avec un message explicite — le formulaire n'est pas la seule barrière
>
> **Given** des parties déjà créées sur un système sans module
> **When** je les ouvre
> **Then** elles restent consultables et inchangées, sans migration
> **And** aucune entrée de création de personnage n'y est offerte
>
> **Given** l'indicateur de module sur les systèmes de jeu
> **When** un nouveau système reçoit son module
> **Then** il suffit d'y basculer l'indicateur pour qu'il devienne proposé — aucune autre liste à mettre à jour
>
> **Given** un système sans module
> **When** l'indicateur est lu par les stories 29.15 et 29.16
> **Then** c'est la même source que celle du formulaire et du DTO
>
> *Note :* le message d'erreur explicite du wizard sur un système sans module (correctif séparé, déjà ouvert) reste nécessaire — il protège les parties déjà créées.

### 4.5 `epics.md` — notes des épics

- **Épic 29** : note ajoutée — « rouvert le 2026-09-20 (sprint change) : 29.17 restreint la création de partie aux systèmes ayant un module, 29.15 et 29.16 ajoutent le point d'entrée de création d'un personnage, absent des stories 29.1/29.2 ; la liste de 29.2 reste celle des seuls personnages de l'utilisateur ».
- **Épic 33** : note ajoutée — « 33.5 (2026-09-20) : l'Homme Dragon rejoint « Personnages » ; seule story de l'épic à toucher une lecture API agrégée ».

### 4.6 `sprint-status.yaml`

- `epic-29` : `done` → **`in-progress`** (rouvert).
- Nouvelles entrées, statut `backlog` :
  - `29-15-un-bouton-clair-pour-creer-son-personnage-depuis-la-partie`
  - `29-16-creer-un-personnage-depuis-personnages`
  - `29-17-seuls-les-systemes-jouables-sont-proposes-a-la-creation-dune-partie`
  - `33-5-mes-hommes-dragons-dans-personnages`
- `last_updated` mis à jour.
- ⚠️ **Effet à connaître :** `create-story` prend la première story `backlog` dans l'ordre du fichier ; **la première story de l'épic 29 (29.15 dans l'ordre du fichier, mais 29.17 dans l'ordre de travail recommandé) passe donc devant 31.5** — nommer explicitement la story voulue (épic 29 est listé avant l'épic 31). L'ordre de travail recommandé est **29.17 → 29.15 → 29.16 → 33.5**.

### 4.6 bis Piste notée, non planifiée

**Un même Homme Dragon réutilisé sur plusieurs aventures** (facultatif, précisé par l'utilisateur le 2026-09-20) : à traiter dans une story ultérieure de l'épic 33. Elle changerait le modèle (`HommeDragon` est aujourd'hui rattaché à une partie) ; 33.5 ne l'anticipe pas et ne doit pas la rendre plus difficile — l'aggrégation lit « les Hommes Dragons dont je suis propriétaire », pas « un par partie » figé dans son contrat.

### 4.7 Artefacts non modifiés par cette passe

`prd.md` (à reporter à la prochaine révision), planches UX (à produire par `bmad-ux`), story 31.4 et son contrat UI.

## 5. Implementation Handoff

**Classification du changement : Moderate.** Réorganisation du backlog (épic 29 rouvert avec trois stories, une story dans l'épic 33), deux touches d'API isolées (validation de DTO en 29.17, lecture agrégée en 33.5), une passe UX conseillée. Pas de refonte du PRD ni de l'architecture.

**Routage :**
- **Product Owner / Developer** : appliquer les changements de `epics.md` et `sprint-status.yaml` (4.1 à 4.6) ; décider de l'ordre 29.15 → 29.16 → 33.5 par rapport à 31.5.
- **UX (`bmad-ux`)** : passe courte sur 29.15/29.16 avant `create-story` — bouton vs slot d'initiale, section vs liste, mobile/desktop.
- **Developer agent** : `create-story` puis `dev-story` sur **29.17 d'abord** (petite, pose l'indicateur), puis 29.15, en coordination avec le correctif « système sans assistant » déjà ouvert (même zone : `partie-detail`).
- **Architect (consultation)** : 33.5 seulement — forme de la lecture agrégée, préservation de `MyCharacterDto`.

**Critères de succès :**
- Un joueur sans personnage voit un bouton « Créer mon personnage » sur sa partie, sur téléphone comme sur ordinateur ; il disparaît dès qu'il a créé le sien.
- « Personnages » propose la création pour chaque partie éligible, au-dessus d'une liste qui reste celle de ses seuls personnages.
- Aucune partie ne peut plus être créée sur un système sans module ; aucune entrée de création n'est offerte sur les parties existantes de tels systèmes (Draconis), ni au MJ pour un personnage joueur.
- Un MJ retrouve ses Hommes Dragons dans « Personnages » et peut en créer un depuis la section de création ; `GET /me/characters` n'a pas bougé.
