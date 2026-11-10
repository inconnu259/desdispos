# Sprint Change Proposal — 2026-10-04

**Projet :** master-jdr · **Palier 9, épic 33 (Homme Dragon)** · **Mode :** batch · **Statut :** approuvée et appliquée le 2026-10-04 (PRD, addendum, epics.md, sprint-status.yaml).

## 1. Résumé du problème

**Déclencheur.** La story 33.8 (« Un Homme Dragon pour plusieurs aventures », FR-63) était planifiée *après révision d'architecture*. Cette révision est faite : **AD-23** (`ARCHITECTURE-SPINE.md` du Palier 9, 2026-10-04), qui réécrit aussi AD-22 en place. Elle a tranché quatre points structurants (rattachement, adressage, périmètre du niveau, temps réel) et corrigé deux hypothèses après revue (temps réel ; effectivité des aventures).

**Catégorie :** nouvelle exigence arrivée à maturité (FR-63 passe de « planifié » à « architecturé »), avec un **changement de contrat du livré** (stories 33.5 à 33.7).

**Problème précis.** Les artefacts de planification décrivent encore l'ancien modèle ou un état d'attente :
- **PRD FR-59** : « *Un Homme Dragon est propre à une aventure : un MJ en a un par aventure* » **contredit FR-63**.
- **PRD FR-63** et **epics.md 33.8** : « planifié, après passage architecture » alors que l'AD existe.
- **epics.md 33.5** : « *le même dragon utilisé sur plusieurs aventures est hors périmètre* » et l'**épic 33** : « *piste ultérieure, non planifiée* ».
- **epics.md 33.6** : AC de refus `403` sur `GET /parties/:id/homme-dragon` ; AD-23 les remplace par `404` sur `GET /homme-dragons/:id`.
- **PRD §5** : AD-23 n'a pas de ligne au registre des dérogations (**D-22**) et le décompte de la section est périmé (« Vingt cas » pour D-1 à D-21).
- **Addendum §6.3** : « *table unique par utilisateur, partie et système… fiche incrustée dans l'écran de la partie* » n'est plus vrai.

**Preuves :** spine AD-23 ; relectures du 2026-10-04 dans le code (`homme-dragon.service.ts`, `party-signals.service.ts`, `schema.prisma`) ; quatre revues indépendantes dans `architecture-jdr-master-2026-08-04/reviews/review-*-ad23.md`.

## 2. Analyse d'impact

### Checklist (mode par lot)

| # | Point | Statut | Constat |
| --- | --- | --- | --- |
| 1.1 | Story déclencheur | [x] | 33.8 (backlog) |
| 1.2 | Problème | [x] | Exigence mûrie + changement de contrat du livré |
| 1.3 | Preuves | [x] | AD-23 + revues + code |
| 2.1 | Épic courant | [x] | L'épic 33 reste faisable ; 33.8 est la dernière story |
| 2.2 | Changements d'épic | [!] | Réécriture de la 33.8, annotations 33.5 / 33.6, notes d'épic. Aucune story ajoutée ni retirée |
| 2.3 | Épics suivants | [x] | 34 à 36 non touchés |
| 2.4 | Épics obsolètes / nouveaux | [x] | Aucun |
| 2.5 | Ordre | [x] | Inchangé : 33.3 → 33.4 → 33.5 → 33.7 → 33.6 → **33.8** (AD faite) |
| 3.1 | PRD | [!] | FR-59, FR-61, FR-63, §5 (D-22), §6, en-tête. MVP non affecté |
| 3.2 | Architecture | [x] | Déjà faite (AD-23, AD-22, schéma, ERD, Deferred). **Rien à écrire ici** |
| 3.3 | UX | [!] | Voir « À trancher » n°1 : le geste d'association et l'affichage de plusieurs aventures n'ont pas de passe UX |
| 3.4 | Autres artefacts | [!] | `epic-33-context.md` périmé (recompilé par `bmad-build`) ; addendum §6.3 ; `sprint-status.yaml` |
| 4.1 | Ajustement direct | Viable | Effort **moyen** (docs) ; la 33.8 elle-même est **élevée** |
| 4.2 | Retour arrière | Non viable | Rien à annuler : AD-23 est additive ; le contrat des 33.5 à 33.7 est cassé *par la 33.8*, pas par ce sprint change |
| 4.3 | Revue du MVP | Non viable | MVP inchangé |
| 4.4 | Voie retenue | [x] | **Ajustement direct** |

### Impact par artefact

| Artefact | Impact |
| --- | --- |
| `prd.md` | 5 blocs (§4.1) |
| `addendum.md` | 1 bloc (§4.2) |
| `epics.md` | 6 blocs (§4.3) |
| `sprint-status.yaml` | 1 bloc (§4.4) : `33-8` reste `backlog` |
| `ARCHITECTURE-SPINE.md` | **Aucun** (déjà à jour) |
| `epic-33-context.md` | Aucun : invalide (documents de planification plus récents), `bmad-build 33-8` le recompile |
| Code | Aucun dans ce sprint change |

### Impact technique de la 33.8 (information, hors périmètre de ce sprint change)

Migration Prisma (`--create-only` éditée), `HommeDragonService` entier, nouveau contrôleur `/homme-dragons/:id`, méthode de lecture en lot de `ScenariosService`, signal 29.7, PDF (`game-rules`), `seed-demo.ts`, front (route, service, page, réserve, création, `partie-detail`, « Personnages »), câblage `realtime.service.ts`. Liste exhaustive dans AD-23, § « Consommateurs ». La story est **lourde** : la découpe éventuelle se décide à sa planification.

## 3. Approche recommandée

**Ajustement direct** (hybride avec un point de découpe laissé à la planification). Effort docs : moyen. Risque : faible côté documents. La 33.8 porte le risque réel (migration, courses, contrat cassé). Aucune modification de périmètre du palier.

## 4. Propositions de modification détaillées

### 4.1 PRD — `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md` (5 blocs)

**P1 · En-tête** — frontmatter `updated: 2026-09-21` → `updated: 2026-10-04` ; ajout, après le paragraphe « Mise à jour du 2026-09-21 » :

> **Mise à jour du 2026-10-04 — architecture du modèle multi-aventures.** L'architecture de FR-63 est faite (`AD-23`, spine du Palier 9). Un Homme Dragon peut suivre plusieurs aventures ; FR-59 est amendée en conséquence (elle posait « un par aventure »), FR-61 précise sa garde, et une dérogation serveur est inscrite (D-22). Les arbitrages sont dans `sprint-change-proposal-2026-10-04.md` et ne sont pas recopiés ici.

**P2 · FR-59** (§ FR-59)

OLD : `Chaque Homme Dragon apparaît avec la partie dont il provient ; sa nature (…)`
NEW : `Chaque Homme Dragon apparaît **une seule fois**, avec **ses aventures** (éventuellement aucune) ; sa nature (…)`

OLD : `**Un Homme Dragon est propre à une aventure** : un MJ en a un *par aventure*, pas un seul au total.`
NEW : `Un Homme Dragon peut suivre **plusieurs aventures** (FR-63) : l'entrée n'est donc proposée que pour une aventure qui n'en a pas encore, et un MJ peut avoir plus ou moins d'Hommes Dragons que d'aventures.`

*Rationale :* supprime la contradiction avec FR-63 sans changer le périmètre de la section de création.

**P3 · FR-61, puce « MJ seul »** — ajouter en fin de puce : `Le droit de lire et d'écrire la fiche est celui de son **propriétaire** (le MJ qui l'a créée), quelle que soit l'aventure d'où il l'ouvre ; un Homme Dragon qui n'est pas le sien ne se distingue pas d'un Homme Dragon inexistant.`

**P4 · FR-63** (remplace le texte actuel)

NEW :
> #### FR-63 : Un Homme Dragon pour plusieurs aventures
> Un même Homme Dragon peut suivre plusieurs groupes et plusieurs mondes : son **historique et son niveau cumulent les scénarios `PASSE` de toutes ses aventures**.
> - **Associer / dissocier.** Le MJ associe un de ses Hommes Dragons à une aventure Ryuutama dont il est MJ et qui n'en a pas encore, et peut l'en dissocier. Une aventure a au plus un Homme Dragon ; il n'y a pas de remplacement implicite.
> - **Rien ne se perd.** Dissocier, supprimer l'aventure ou changer son système de jeu dissocie l'Homme Dragon sans supprimer sa fiche ; le niveau est recalculé, et ce qui dépasse le nouveau niveau (éveils, artefact cadeau, réserve) reste lisible, seuls les nouveaux choix sont refusés. Retirer un souffle de la réserve reste possible à tout niveau.
> - **Voyageurs protégés par aventure.** La fiche présente les joueurs de chaque aventure séparément.
> - **Données existantes.** Chaque fiche actuelle reste intacte et liée à sa partie.
> - **Prérequis serveur :** D-22.

**P5 · §5 Dérogations** — phrase d'ouverture : `**Vingt cas**` → `**Vingt-deux cas**` (le décompte était resté à vingt après D-21) ; ajout dans la phrase des origines : `**D-22 est issue de l'architecture du 2026-10-04** (AD-23).` ; nouvelle ligne du tableau, après D-21 :

> | D-22 | **Homme Dragon multi-aventures** — colonne `Partie.hommeDragonId`, fiche adressée par son identifiant (`/homme-dragons/:id`, gardée par son propriétaire), association et dissociation par partie, lecture en lot des scénarios `PASSE` de plusieurs parties | FR-63, FR-59, FR-61 | **Élevée** — migration avec rattrapage, **contrat du livré (33.5 à 33.7) cassé volontairement**, toutes les écritures de fiche passent sous verrou (le `PATCH` compris), signal 29.7 recalculé | ✅ actée (2026-10-04, AD-23) |

§6, puce « Un même Homme Dragon réutilisé… » : `*Planifié le 2026-09-29 : FR-63, story 33.8.*` → `*Planifié le 2026-09-29 : FR-63, story 33.8 ; architecture faite le 2026-10-04 (AD-23).*`

### 4.2 Addendum — `prds/prd-jdr-master-2026-08-01/addendum.md` (1 bloc)

**§6.3 « Modèle de l'Homme Dragon (D-20) »** — ajouter en fin de section :

> **Révisé le 2026-10-04 (AD-23, D-22).** Les deux premières puces décrivent l'état d'origine. Désormais : la table n'est plus unique par utilisateur, partie et système ; le lien est porté par `Partie.hommeDragonId`, un Homme Dragon a 0..N aventures, et sa fiche a une route propre (`/homme-dragons/:id`), plus incrustée dans l'écran de la partie.

### 4.3 Épics — `_bmad-output/planning-artifacts/epics.md` (6 blocs)

**E1 · Frontmatter** — `lastUpdated: '2026-10-02'` → `'2026-10-04'` ; `lastChange` préfixé par : `2026-10-04 (sprint change) : épic 33 — story 33.8 prête à planifier (AD-23 faite) : critères d'acceptation réécrits, annotations 33.5 et 33.6 ; FR-59 amendée, D-22 (voir sprint-change-proposal-2026-10-04.md). Précédemment : ` (le reste de la chaîne est conservé).

**E2 · Table FR → story** : `| FR-63 | 33.8 | Homme Dragon multi-aventures (planifié) |` → `| FR-63 | 33.8 | Homme Dragon multi-aventures (AD-23 faite) |`

**E3 · Notes d'épic 33**
- Paragraphe « Stories 33.6, 33.7 et 33.8… » : `Homme Dragon multi-aventures (planifié, après passage architecture)` → `Homme Dragon multi-aventures (architecture faite le 2026-10-04, AD-23)` ; ajouter en fin : `**La 33.8 casse volontairement le contrat des stories 33.5 à 33.7** (routes par Homme Dragon, `404` au lieu de `403`, plus de `partieId` sur la fiche) : AD-23 en liste les consommateurs.`
- Paragraphe « Story 33.5… » : `(un même Homme Dragon réutilisé sur plusieurs aventures est une piste ultérieure, non planifiée)` → `(un même Homme Dragon réutilisé sur plusieurs aventures est repris par la 33.8)`

**E4 · Story 33.5**, sous l'AC « une aventure Ryuutama dont je suis MJ et où je n'ai pas encore d'Homme Dragon » — ajouter une ligne en italique : `*Révisé par la 33.8 (AD-23, 2026-10-04) : « un par aventure » n'est plus une règle de modèle. La liste montre un Homme Dragon une seule fois, avec ses aventures ; l'entrée de création reste proposée pour une aventure qui n'en a pas.*` (l'AC de départ est conservé tel quel : il décrit ce qui a été livré.)

**E5 · Story 33.6**, après les deux AC `403` — ajouter : `*Révisé par la 33.8 (AD-23, 2026-10-04) : la lecture et l'export passent par `/homme-dragons/:id`, gardés par le propriétaire de l'Homme Dragon ; tout autre appelant reçoit `404`, jamais `403` (l'existence ne fuit pas). L'intention — aucun accès d'un joueur — est inchangée.*`

**E6 · Story 33.8 — réécriture complète**

> ### Story 33.8 : Un Homme Dragon pour plusieurs aventures
>
> *Architecture faite le 2026-10-04 (AD-23, spine du Palier 9 ; AD-22 réécrit). Story lourde : migration, routes, front, PDF — la découpe éventuelle se décide à la planification.*
>
> As a MJ,
> I want que mon Homme Dragon suive plusieurs groupes et plusieurs mondes,
> So that son histoire et son niveau reflètent toutes les aventures qu'il a racontées.
>
> **Acceptance Criteria:**
>
> **Given** un Homme Dragon dont je suis propriétaire et une aventure Ryuutama dont je suis MJ, sans Homme Dragon
> **When** je l'associe à cette aventure
> **Then** il y apparaît comme Homme Dragon de cette aventure
> **And** son historique et son niveau cumulent les scénarios `PASSE` de toutes ses aventures, chaque entrée d'historique portant son aventure
>
> **Given** une aventure qui a déjà un Homme Dragon
> **When** j'en associe un autre
> **Then** le serveur refuse (`409`) et ne remplace rien
> **And** je dois d'abord dissocier le premier
>
> **Given** un Homme Dragon associé à une aventure
> **When** je le dissocie
> **Then** l'aventure n'a plus d'Homme Dragon et son niveau est recalculé, il peut baisser
> **And** aucun éveil, artefact cadeau ni souffle de la réserve n'est supprimé : ce qui dépasse le niveau reste lisible et seuls les nouveaux choix sont refusés
> **And** je peux toujours retirer un souffle de la réserve, quel que soit le niveau
>
> **Given** un Homme Dragon qui n'est pas le mien, ou qui n'existe pas
> **When** je le lis, l'écris, l'exporte ou l'associe
> **Then** la réponse est la même (`404`) dans les deux cas, sans aucune donnée
> **And** un joueur de l'aventure n'y a accès ni dans l'application ni par l'API
>
> **Given** un Homme Dragon associé à deux aventures
> **When** j'ouvre « Personnages »
> **Then** il apparaît une seule fois, avec ses deux aventures
> **And** l'ouvrir m'amène sur sa fiche, qui présente les voyageurs protégés **par aventure**
>
> **Given** un Homme Dragon associé à une aventure
> **When** cette aventure est supprimée
> **Then** l'Homme Dragon subsiste, sans aventure, et reste accessible dans « Personnages »
> **And** son niveau est recalculé sur ses aventures restantes
>
> **Given** une aventure portant un Homme Dragon
> **When** son système de jeu change
> **Then** l'Homme Dragon en est dissocié, sans perdre sa fiche
>
> **Given** une aventure Ryuutama sans Homme Dragon
> **When** j'en crée un depuis la section de création
> **Then** il est créé et associé à cette aventure en une seule opération
> **And** deux créations simultanées pour la même aventure ne donnent jamais deux Hommes Dragons associés ni une fiche orpheline
>
> **Given** les fiches existantes (un Homme Dragon par partie)
> **When** le nouveau modèle est livré
> **Then** chacune reste intacte et rattachée à sa partie
> **And** la migration échoue avec une erreur explicite, sans rien choisir au hasard, si deux fiches visent la même partie ou si une fiche resterait sans lien
>
> **Given** une aventure Ryuutama dont je suis MJ, sans Homme Dragon associé
> **When** la liste des parties est calculée
> **Then** le signal « Homme Dragon à créer » s'affiche comme avant, sans requête par partie
>
> **Given** deux écritures simultanées sur la même fiche (la réserve et la modification générale, par exemple)
> **When** elles aboutissent
> **Then** aucune n'écrase l'autre
>
> **Given** ma fiche ouverte
> **When** un scénario de l'une de ses aventures passe en `PASSE`
> **Then** son niveau et son historique se mettent à jour sans que je recharge
>
> *Prérequis levé :* AD-23 (modèle, routes `PUT`/`DELETE /parties/:id/homme-dragon/:hommeDragonId`, fiche sous `/homme-dragons/:id`, temps réel, migration) et AD-22 réécrite. **Contrat du livré cassé volontairement** (33.5 à 33.7) : la liste des consommateurs à mettre à jour est dans AD-23. À vérifier à l'implémentation : l'absence d'interblocage du verrou `FOR NO KEY UPDATE`, et le comportement d'un deuxième onglet ouvert (il ne se rafraîchit pas sur une écriture de fiche, par choix d'AD-23).

### 4.4 `sprint-status.yaml` (1 bloc)

`33-8-un-homme-dragon-pour-plusieurs-aventures: backlog` **ne change pas**. La ligne de commentaire `last_updated: 2026-10-03  # …` devient `last_updated: 2026-10-04  # Sprint change 2026-10-04 : AD-23 faite (modele Homme Dragon multi-aventures), story 33-8 prete a planifier (reste backlog) ; PRD et epics amendes, D-22 (voir sprint-change-proposal-2026-10-04.md). Precedemment : …` (le texte existant est conservé après le préfixe).

### 4.5 Ce qui ne change pas

Le spine (déjà à jour) ; `epic-33-context.md` (recompilé au démarrage de la 33.8) ; les stories 33.1 à 33.4 et 33.7 ; les épics 34 à 36 ; aucun fichier de code ; aucune opération git.

## 5. Passation

**Portée : modérée** — réorganisation documentaire sans nouvelle story ; la 33.8 est lourde.

### À trancher par l'utilisateur

1. **Passe UX avant la 33.8 ?** Trois choses n'ont pas de maquette : le geste « associer / dissocier » (où, avec quelle confirmation), la carte « Personnages » d'un Homme Dragon à plusieurs aventures, et les voyageurs présentés par aventure sur la fiche. *Ma préférence :* **pas de passe séparée** ; la spec de la 33.8 les traite en « questions ouvertes » à arbitrer avec toi (précédent : la 33.6 avait eu sa passe parce que son écran était neuf). *Alternative :* une passe `bmad-ux` courte avant.
2. **Découpe de la 33.8.** Elle couvre migration + API + signaux, puis front + PDF. *Ma préférence :* la décider à la planification de la spec, pas ici.

### Rôles

| Rôle | Responsabilité |
| --- | --- |
| Utilisateur (PM) | Valider cette proposition, les deux points ci-dessus |
| Developer (`bmad-build`) | Appliquer les blocs 4.1 à 4.4 après approbation, puis planifier la 33.8 (mode plan avant, rappel du `CLAUDE.md`) |
| Architecte | Rien : AD-23 est faite |

### Critères de succès

PRD et epics ne contredisent plus AD-23 ; D-22 inscrite et le décompte corrigé ; FR-59 sans « propre à une aventure » ; story 33.8 en Given/When/Then, sans « Prérequis » en attente ; `sprint-status.yaml` à jour ; rappels de fin de palier du `CLAUDE.md` (`/security-review`, `/code-review`) conservés pour la 33.8, qui touche à la garde d'accès de la fiche.
