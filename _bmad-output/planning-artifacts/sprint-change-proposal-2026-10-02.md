# Sprint Change Proposal — Épic 33, story 33.6 : une seule réserve de souffles, portée par la fiche

- **Date :** 2026-10-02
- **Auteur :** agent Developer (`bmad-correct-course`), pour inconnu259
- **Mode :** par lot
- **Statut :** approuvée le 2026-10-02 (mode par lot, option B2)
- **Révision :** même jour, après décision de l'utilisateur sur le point à trancher n° 1 (option B2 : la fiche de l'Homme Dragon et son export PDF sont réservés au MJ)

## 1. Résumé du problème

**Déclencheur.** Pendant la passe UX `bmad-ux` de la story 33.6 (Réserve de souffles de l'Homme
Dragon, dossier `ux-designs/ux-jdr-master-2026-10-01/`, clôturée le 2026-10-02), l'utilisateur a
**abandonné la réserve par séance** prévue par le sprint change du 2026-09-26 (décision U-2 :
« composée sur la page de la séance, avec une réserve par défaut sur la fiche »). Ce qu'il voulait
réellement : choisir les souffles de son dragon **sur sa fiche**, avec autant d'emplacements que la
réserve en compte (niveau − 1, dès le niveau 2), les **sauvegarder** pour ne pas les refaire, et les
**imprimer** dans le PDF. Motif donné : la réserve par séance n'était pas sûre d'être utile et
« risquait de perdre l'utilisateur ».

**Type :** nouvelle information issue de la conception UX (le besoin réel était plus simple que
l'hypothèse de départ) — pas d'erreur d'implémentation. La 33.6 **n'est pas commencée**
(`33-6-reserve-de-souffles: backlog`), donc aucun code n'est à défaire.

**Conséquence.** Quatre artefacts de planification décrivent encore l'ancien modèle (PRD, `epics.md`,
spine d'architecture AD-22, `epic-33-context.md`) et deux documents d'accompagnement l'anticipent
(`deferred-work.md`, README du PDF). Il faut les amender **avant** `bmad-build` 33-6, sinon la
story serait construite sur une décision obsolète.

**Décisions utilisateur de la passe UX (2026-10-02).** La numérotation continue celle du sprint change
du 2026-09-26 (U-1 à U-9) :

| # | Décision |
|---|---|
| U-10 | **Une seule réserve par Homme Dragon**, portée par sa fiche. Plus de `Seance.reserveSouffles`, plus de réserve par défaut ni de résolution défaut/séance, plus de modification de `SeanceDto`, plus d'écran de séance, plus d'AC « j'ouvre une séance ». **Supersede U-2** (le sprint change du 2026-09-26 reste en l'état, historique : aucune modification). |
| U-11 | La réserve est un **champ de la fiche** (`HommeDragon.sheetData`, nom fixé à l'implémentation), **liste ordonnée par emplacement** (un emplacement peut être vide ; la forme `{ key, count }` est abandonnée), **enregistrée automatiquement à chaque geste**, qui **remplit `souffle_1`..`souffle_4`** de l'export PDF. **La fiche de l'Homme Dragon et son export PDF sont réservés au MJ (option B2, voir U-17)** : la réserve vit simplement dans `sheetData`, sans retrait en projection. |
| U-12 | Le bouton **« Vider la réserve » est retiré** : pour un PDF sans souffles, le MJ retire les souffles un à un. |
| U-13 | **Annulation temporaire du dernier retrait** : « Retirer » reste sans dialogue de confirmation, mais un bandeau « Annuler » reste affiché quelques secondes. |
| U-14 | Un souffle **d'une autre race n'occupe qu'un seul emplacement** (dès le niveau 3, au plus un souffle d'une autre race). |
| U-15 | Le composant partagé **`DetailSurface` est étendu** (de façon rétro-compatible) pour porter la fenêtre de choix ; la 33.6 doit **re-vérifier tous les autres usages**. |
| U-16 | **Niveau qui baisse** avec des emplacements en surplus : **aucune règle spécifique** (cas quasi impossible : un scénario terminé est terminé). |
| U-17 | **Option B2 (décision du 2026-10-02, point à trancher n° 1) : la fiche de l'Homme Dragon ENTIÈRE est réservée au MJ.** `GET /parties/:id/homme-dragon` et `GET /parties/:id/homme-dragon/export.pdf` ne servent plus rien à un non-MJ : refus `403`, comme les routes d'écriture (garde `getOwned`, au lieu de `getViewable`). Un joueur ne reçoit ni la fiche ni son PDF ; « s'il veut que quelqu'un l'imprime, le MJ fait l'export et l'envoie ». C'est un **changement de comportement du livré** (voir §2, « Impacts sur le livré »). Ni l'option A (retirer la réserve en projection) ni l'option B1 ne sont retenues. |

Restent en vigueur : U-1 (niveau par scénarios `PASSE`), U-3 (la réserve est de la préparation, pas du
suivi en jeu : rien n'est décompté), U-4, U-5, U-6, U-7 (réserve réservée au MJ), U-8 (rituels admis
comme les autres souffles ; précisé par la passe UX : choisissables dès le niveau 5, sans compter comme
« autre race ») et U-9 (passe UX : **faite**).

## 2. Analyse d'impact

### Checklist (mode par lot)

| Item | Statut | Constat |
|---|---|---|
| 1.1 Story déclencheuse | [x] | Passe UX de la 33.6 (2026-10-02). La 33.6 est en `backlog`. |
| 1.2 Problème | [x] | Nouvelle information : une seule réserve, sur la fiche (U-10 à U-16). |
| 1.3 Preuves | [x] | `EXPERIENCE.md` (§10), `DESIGN.md`, `.memlog.md`, `review-rubric.md` du dossier UX ; état du code relu (voir « Incohérences relevées »). |
| 2.1 Épic courant | [x] | L'épic 33 reste faisable tel quel. La 33.6 s'allège côté séances et s'alourdit côté UI partagée (`DetailSurface`) et accessibilité. |
| 2.2 Changements d'épic | [!] | Réécriture de la story 33.6 ; notes d'épic (Q-13, ordre, D-21) et note de la 33.8 à amender. Aucune story ajoutée ni retirée. |
| 2.3 Épics suivants | [N/A] | Aucun autre épic touché : plus aucun lien avec les séances (épics 5, 22, 36 non concernés). |
| 2.4 Épic obsolète / nouveau | [N/A] | Aucun. |
| 2.5 Ordre | [x] | 33.3 → 33.4 → 33.5 → 33.7 → (passe UX : faite) → 33.6 → 33.8 : inchangé. |
| 3.1 PRD | [!] | FR-61 (titre, corps, règles), D-21, deux renvois (FR-26, §6). Q-13 relue : sans changement. MVP non affecté. |
| 3.2 Architecture | [!] | AD-22 à réécrire en entier ; ligne Q-13 du spine. Le diagramme Mermaid (L230-250) est le graphe des modules : aucun nœud réserve ni séance, rien à ajuster. Aucune révision plus récente de l'architecture ne reprend AD-22 (`architecture-jdr-master-2026-08-04` est la plus récente). |
| 3.3 UX | [x] | Déjà fait : `ux-jdr-master-2026-10-01` (DESIGN + EXPERIENCE) est la source de vérité, il n'y a rien à amender côté UX. |
| 3.4 Autres artefacts | [!] | `epic-33-context.md` (8 passages), `deferred-work.md`, README du PDF, `docs/dragons.md`, consigne web des rituels, `sprint-status.yaml` (commentaire). Option B2 : garde de lecture de la fiche et de l'export PDF (code, specs API), et deux textes historiques qui promettent la lecture par tout membre (NFR1 du Palier 5). Voir §4 et §4.9. |
| 4.1 Option 1 : ajustement direct | [x] Viable | Amender 5 documents de planification et réécrire une story non commencée. Effort **faible** (documentaire), risque **faible**. |
| 4.2 Option 2 : retour arrière | [N/A] | Rien n'a été livré pour la réserve : rien à défaire. |
| 4.3 Option 3 : revue du MVP | [N/A] | Le palier reste atteignable ; le périmètre de la 33.6 diminue. |
| 4.4 Voie recommandée | [x] | Option 1 (§3). |
| 5.1 Résumé du problème | [x] | §1. |
| 5.2 Impact épics et artefacts | [x] | §2 et §4. |
| 5.3 Voie recommandée | [x] | §3. |
| 5.4 Impact MVP et plan d'action | [x] | MVP non affecté ; plan et séquencement en §5. |
| 5.5 Passation | [x] | §5. |
| 6.1 Revue de la checklist | [x] | Toutes les sections traitées. |
| 6.2 Exactitude de la proposition | [x] | Numéros de ligne revérifiés le 2026-10-02 (aucun décalage par rapport à `EXPERIENCE.md` §10) ; citations OLD copiées du texte actuel. |
| 6.3 Approbation explicite | [x] | **Approuvée le 2026-10-02** par l'utilisateur, avec le choix de l'option B2 (point n° 1). Points 2 à 9 : validés comme recommandés, à confirmer en mode plan au démarrage de la 33.6. |
| 6.4 `sprint-status.yaml` | [N/A] | Aucune story ajoutée ni retirée : `33-6-reserve-de-souffles` reste `backlog`. Seul le commentaire `last_updated` est à mettre à jour (§4.7). |
| 6.5 Prochaines étapes | [x] | §5. Les blocs de planification (§4.1 à §4.5, §4.7) sont appliqués le 2026-10-02 ; §4.6 et §4.9 restent à faire par la 33.6. |

### Impact par artefact

- **Stories livrées ou implémentées :** 33.1, 33.2 : inchangées. 33.4 (implémentée, `review`) : aucun
  retour arrière, voir « Ce qui ne change pas ». 33.7 (implémentée, `review`) : prérequis de la 33.6
  levé, inchangée. 33.3, 33.5 : inchangées.
- **Code existant :** aucun changement imposé avant la 33.6. À la livraison de la 33.6 (et par elle) :
  consigne web des rituels, commentaires et tests qui figent « souffle_1..4 jamais remplis », README
  du PDF, et (option B2) la garde de lecture de `HommeDragonService.findOne()` et de l'export PDF
  (`getViewable` devient `getOwned`) avec les specs API qui supposent la lecture par un membre
  (§4.9). Aucun changement web : seul le MJ appelle déjà ces deux routes.
- **Séances :** plus aucun impact. `Seance`, `SeanceDto`, `SeanceList`, `scenario-editor` et
  `scenario-read-dialog` ne sont pas touchés.

### Incohérences et ambiguïtés relevées (à lire avant d'approuver)

1. **La réserve fuirait vers les joueurs par deux routes existantes, si on se contente d'ajouter un
   champ à `sheetData`.** `GET /parties/:id/homme-dragon` (`HommeDragonService.findOne`) est « ouvert à
   tout membre » (NFR1, `getViewable`) et `buildDto()` renvoie `sheetData` en entier ; `GET
   /parties/:id/homme-dragon/export.pdf` passe par ce même `findOne`. Avec l'ancien modèle (champ sur
   `Seance`), l'AD-22 ne regardait que les DTO de séance : ce risque n'existait pas. L'AC « aucune
   réponse de l'API ne la transmet à un joueur » (conservé par `EXPERIENCE.md` §5) n'est donc tenable
   que si la lecture est restreinte. **Tranché le 2026-10-02 (option B2)** : la fiche entière et son
   export PDF deviennent réservés au MJ ; la réserve vit simplement dans `sheetData`, sans retrait en
   projection. Conséquences sur le livré : voir « Impacts sur le livré » ci-dessous.
   (`/me/homme-dragons` ne renvoie que nom, race et avatar : sans risque. Le signal temps réel ne
   porte aucune donnée.)
2. **`docs/dragons.md` L227 est correct aujourd'hui mais deviendra faux à la livraison de la 33.6.**
   `EXPERIENCE.md` §10.6 le déclare « déjà correct » ; c'est vrai tant que les rituels sont en lecture
   seule (« ni réserve ni décompte pour l'instant »). Dès que la 33.6 permet de placer un rituel en
   réserve, la phrase est fausse. À corriger par la 33.6 elle-même (§4.6).
3. **Deux titres « Réserve de souffles » sur la même fiche.** La carte « Capacités » (33.7, entrée
   `reserve` du catalogue `hommeDragonLevelCapacity`) porte déjà ce libellé ; la nouvelle section a le
   même. Voir point à trancher n° 8.
4. **La forme d'écriture n'est pas figée** (remplacement complet ou écriture par emplacement) :
   `EXPERIENCE.md` §10.3 la laisse « à l'architecture ». Elle conditionne le traitement d'une clé retirée
   du catalogue, d'un surplus d'emplacements après une baisse de niveau et de deux appareils qui
   écrivent en même temps. Voir point à trancher n° 2.
5. **Cases du PDF : position ou compactage ?** « Dans l'ordre des emplacements » ne dit pas si
   `souffle_2` correspond toujours à l'emplacement 2 même quand l'emplacement 1 est vide. Voir point n° 3.
6. **Un même rituel sur plusieurs emplacements** : non spécifié (relevé par la revue de la passe UX).
   Voir point n° 4.
7. **Trous signalés par la revue UX et non couverts** (`validation-report.md`, « hors de la grille ») :
   état de chargement ou d'échec du catalogue de souffles ; message distinct pour un rejet de règle
   serveur (aujourd'hui fusionné avec l'échec réseau sous « Réessayez »). Voir points n° 6 et 7.
8. **Statuts :** `sprint-status.yaml` donne 33.3, 33.4, 33.5 et 33.7 en `review`, pas en `done`.
   « Livrée » dans cette proposition signifie « implémentée et sous revue ».

### Impacts sur le livré de l'option B2 (relevé du 2026-10-02, lecture seule)

La fiche entière et son export PDF passent de « lisibles par tout membre » à « MJ seul ». Relevé fait
par `graphify query` puis lecture/`grep` du code, des specs et des documents.

**Ce qui change de comportement (API) :**

| Élément | Avant | Après (à livrer par la 33.6) |
|---|---|---|
| `GET /parties/:id/homme-dragon` (`HommeDragonService.findOne`, garde `parties.getViewable`) | Tout membre reçoit le DTO du dragon du MJ (NFR1 du Palier 5) | Garde `parties.getOwned` : un joueur membre reçoit **`403`** sans donnée, comme un non-membre aujourd'hui. Le MJ garde le comportement actuel (`null` si la partie n'est plus Ryuutama ou si la fiche n'existe pas encore). |
| `GET /parties/:id/homme-dragon/export.pdf` | Tout membre peut exporter (story 10.5 : « un joueur peut aussi exporter la fiche de son MJ ») | Refus **`403`** hérité de `findOne` (le contrôleur l'appelle d'abord) : aucun code d'export à changer. |
| Écritures (`POST`, `PATCH`, `eveil-power`, `artefact-cadeau`, future route de la réserve) | `getOwned` | Inchangé. |

Choix du code de refus : **403** (et non `null` ni `404`), parce que c'est ce que `getOwned` renvoie
déjà pour toutes les écritures du module (`404` seulement si la partie n'existe pas) et ce que
`getViewable` renvoie déjà à un non-membre ; `null` signifie « pas encore créé » pour le MJ et ne doit
pas être détourné en « interdit ».

**Ce qui ne change pas (vérifié) :**
- **Web :** aucun appelant non-MJ. `partie-detail.html` (L454) monte la fiche sous `isMj() &&
  p.gameSystemId === 'ryuutama'` ; `HommeDragonPage` (route `parties/:id/homme-dragon`) redirige tout
  non-MJ vers `/parties/:id` ; `HommeDragonService.findOne` n'est appelé que par `HommeDragonSheet` ;
  « Personnages » (33.5) passe par `GET /me/homme-dragons`, sans `sheetData` complet ; `RealtimeService`
  ne fait que notifier (aucun joueur ne monte la fiche, donc rien ne recharge) ; le tableau de bord n'y
  touche pas. Aucune spec web à changer.
- **Autres modules API :** aucun appelant de `HommeDragonService.findOne` hors du module Homme Dragon.
  Aucun test e2e (`apps/api/test`) ne couvre la fiche.
- **Stories 12.1 / 12.2 :** elles servent les fiches vierges de référence (`assets/`), pas la fiche de
  l'Homme Dragon : aucun impact.
- **PRD du Palier 9 :** FR-59 (« jamais chez les joueurs ») et FR-24/FR-27 restent vrais.

**Ce qui doit être amendé :**
- **Code et specs API (par la 33.6, voir §4.9) :** `homme-dragon.service.ts` (garde et commentaire « Lecture
  ouverte à tout membre (NFR1) »), et `homme-dragon.service.spec.ts` : le test « MJ ou membre, NFR1 »
  (appel en `u2`), le test « non-membre → Forbidden propagée par `getViewable` » et les environ dix tests
  de `findOne()` qui simulent `parties.getViewable` (dont celui qui lit en `u2`, L892) ; le spec du
  contrôleur (`exportPdf`, `GET`) simule le service et n'a pas à changer, mais un test de refus d'un
  non-MJ est à ajouter au niveau du service.
- **Documents (voir §4.9) :** `epics-palier5.md` L46 (NFR1), spine du Palier 5
  `architecture-jdr-master-2026-07-15` L101 (ligne « Accès »), et pour mémoire les notes des stories
  10.1 (L201, L331) et 10.5 (L114), qui sont historiques et ne sont pas réécrites.

## 3. Approche recommandée

**Ajustement direct (option 1).** Amender les documents de planification listés en §4 et remplacer
l'énoncé et les AC de la story 33.6. **Aucun retour arrière** (option 2) : la 33.6 n'est pas commencée,
et la 33.4 comme la 33.7 n'ont rien à défaire. **Pas de revue du MVP** (option 3) : le périmètre de la
33.6 diminue plus qu'il n'augmente.

**Effort / risque :**

| Élément | Avant (09-26) | Après (cette proposition) | Remarque |
|---|---|---|---|
| Amendement des documents | n/a | **Faible**, risque **faible** | Texte seulement, 29 blocs sur 11 fichiers ; aucun code dans la proposition. |
| Story 33.6 | Moyen à élevé ; risque moyen | **Moyen** ; risque **moyen** | On supprime la lecture/écriture sur `Seance`, `SeanceDto`, la résolution défaut/séance et le câblage de l'écran de séance. On ajoute : l'extension d'un composant partagé (`DetailSurface`, une dizaine d'usages à re-vérifier), l'accessibilité fine (focus par geste, zones `role="status"` et `role="alert"`) et le remplissage du PDF. Option B2 : un durcissement de garde sur deux routes de lecture (`getViewable` devient `getOwned`) et la mise à jour des specs API qui supposaient la lecture par un membre. Le risque se déplace de « sécurité des séances » vers « régression sur un composant partagé » ; la fuite de la réserve par la lecture ouverte de la fiche (incohérence n° 1) est supprimée par construction. |

`/security-review` reste due sur la 33.6 (nouveau chemin d'écriture MJ, exposition de `sheetData`). Mode
plan obligatoire avant la 33.6 (rappel du `CLAUDE.md` du dépôt).

## 4. Propositions de modification détaillées

Convention : « OLD » est une citation exacte du texte actuel (courte), « NEW » est le texte final, en
français, prêt à coller. Les numéros de ligne ont été revérifiés le 2026-10-02 et concordent avec
`EXPERIENCE.md` §10 ; les ancres par nom font foi si une ligne a bougé entre-temps. **Application
(2026-10-02, après approbation) :** les blocs de §4.1 à §4.5 et §4.7 sont appliqués aux artefacts de
planification ; §4.6 (README du PDF, `docs/dragons.md`, consigne web) et le code/specs de §4.9 sont livrés
par la story 33.6 ; les annotations de documents historiques de §4.9 restent à décider. Les citations OLD
décrivent le texte d'avant application.

### 4.1 PRD — `_bmad-output/planning-artifacts/prds/prd-jdr-master-2026-08-01/prd.md` (4 blocs)

**`prd.md` · FR-26, puce « Aucun suivi de consommation » · L263**

**OLD :**
> La **réserve** de souffles, préparée avant la séance, est portée par FR-61 (décision du 2026-09-29).

**NEW :**
> La **réserve** de souffles, composée une fois sur la fiche de l'Homme Dragon, est portée par FR-61 (décision du 2026-09-29, révisée le 2026-10-02).

**Justification :** « préparée avant la séance » suggère une réserve propre à chaque séance, ce que U-10
abandonne. Le reste de la puce (aucun décompte) est inchangé.

---

**`prd.md` · FR-61 (titre, corps, règles) · L268-273**

**OLD :**
> #### FR-61 : Réserve de souffles préparée avant la séance
> Dès le niveau 2, le MJ compose sur la page d'une séance la réserve de son Homme Dragon pour cette séance ; une **réserve par défaut**, tenue sur la fiche, pré-remplit toute séance dont la réserve n'a pas été composée.
> - **Règles :** (niveau − 1) emplacements ; un même souffle peut y figurer en plusieurs exemplaires ; […] à partir du niveau 3, au plus **un** souffle d'une autre race. […]

**NEW :**
> #### FR-61 : Réserve de souffles de l'Homme Dragon
> Dès le niveau 2, le MJ compose sur la **fiche** de son Homme Dragon la réserve de souffles de celui-ci. Il la compose **une seule fois** : elle est enregistrée automatiquement, mémorisée, et imprimée dans l'export PDF. Il n'y a **qu'une réserve par Homme Dragon** ; aucune réserve n'est attachée à une séance. *(Révisée le 2026-10-02 : la réserve « par séance » et la réserve « par défaut » du 2026-09-29 sont abandonnées.)*
> - **Règles :** (niveau − 1) emplacements ; un même souffle commun ou de la race peut occuper plusieurs emplacements ; les souffles du temps n'y entrent jamais ; à partir du niveau 3, au plus **un** souffle d'une autre race, qui n'occupe qu'**un seul** emplacement. Communs et souffles de la race toujours autorisés ; souffles rituels admis au niveau 5, sans compter comme souffle d'une autre race.
> - **Aucun décompte :** la réserve est une composition, pas un stock. L'application ne la consomme jamais et n'affiche aucun compteur « utilisé » ou « restant ».
> - **Export PDF :** la réserve remplit les cases de souffles du PDF (le nom de chaque souffle, dans l'ordre des emplacements) ; une réserve vide laisse les cases vides, à cocher au crayon. Pour exporter sans souffles, le MJ retire les souffles un à un.
> - **MJ seul :** la fiche de l'Homme Dragon, son export PDF et donc sa réserve sont réservés au MJ ; un joueur n'y a accès ni dans l'application ni par l'API. Le meneur annonce la réserve en jeu ; s'il veut que quelqu'un d'autre imprime la fiche, il fait l'export PDF et le lui envoie.
> - **Prérequis serveur :** D-21.

**Justification :** le corps actuel est exactement l'inverse de la décision (page de séance, réserve
par défaut qui pré-remplit). Ajouts demandés par `EXPERIENCE.md` §10.1 : un seul emplacement pour un
souffle d'une autre race (U-14), le lien avec le PDF (U-11), l'absence de « Vider » (U-12, formulé en
« retire un à un »). La puce « MJ seul » reflète l'option B2 (U-17) : elle élargit la restriction à toute
la fiche et à son PDF, ce qui change le comportement livré (lecture « par tout membre » du Palier 5).

---

**`prd.md` · §5 Dérogations serveur, ligne D-21 · L484**

**OLD :**
> | D-21 | **Réserve de souffles** — réserve par séance et réserve par défaut de l'Homme Dragon, écrites et lues par le MJ seul | FR-61 | Modérée — un chemin d'écriture MJ neuf, validations de règles côté serveur (capacité, souffles du temps, souffle d'une autre race), jamais exposée aux joueurs, pas de lecture fan-out | ✅ actée (2026-09-29, AD-22) |

**NEW :**
> | D-21 | **Réserve de souffles** — réserve unique de l'Homme Dragon, portée par sa fiche ; la fiche entière et son export PDF sont réservés au MJ | FR-61 | Modérée — un chemin d'écriture MJ neuf (route dédiée, jamais la modification générale de la fiche), validations de règles côté serveur (capacité, souffles du temps, souffle d'une autre race sur un seul emplacement), **lecture de la fiche et export PDF durcis de « tout membre » à « MJ seul »** (changement de comportement du livré, aucun appelant web non-MJ), pas de lecture fan-out, aucune migration | ✅ actée (2026-09-29, AD-22 ; révisée le 2026-10-02, option B2) |

**Justification :** la dérogation ne porte plus sur `Seance` ; elle porte sur la fiche. Le durcissement de
lecture (U-17) est ce qui rend l'AC « MJ seul » vérifiable sans retrait en projection ; il révise NFR1 du
Palier 5 (« lecture ouverte à tout membre ») pour l'Homme Dragon uniquement.

---

**`prd.md` · §6 Hors périmètre, première puce · L488**

**OLD :**
> *(la réserve préparée avant la séance en est sortie le 2026-09-29 : FR-61)*

**NEW :**
> *(la réserve de souffles, composée une fois sur la fiche, en est sortie le 2026-09-29 : FR-61)*

**Justification :** même correction de vocabulaire que L263.

**Relus, sans modification :** L261 (FR-26 : « rien n'est décompté »), L270-273 hors FR-61 couvertes
ci-dessus, L276 (FR-62 : la « réserve » y est une capacité de niveau affichée, inchangée), L517 (Q-13 :
« Réserve : FR-61. Aucun décompte pendant la séance », vrai tel quel).

### 4.2 Épics — `_bmad-output/planning-artifacts/epics.md` (7 blocs)

**`epics.md` · frontmatter `lastChange` · L13**

**OLD :**
> lastChange: "2026-09-29 (sprint change) : épic 33 — Q-13 corrigée (éveils ≠ souffles), stories 33.6, 33.7, 33.8 ; FR-61 → FR-63, D-21 (voir sprint-change-proposal-2026-09-26.md). Précédemment : […]

**NEW :**
> lastChange: "2026-10-02 (sprint change) : épic 33 — story 33.6 révisée : une seule réserve de souffles par Homme Dragon, portée par sa fiche (réserve par séance abandonnée) ; FR-61, D-21, AD-22 (voir sprint-change-proposal-2026-10-02.md). Précédemment : 2026-09-29 (sprint change) : épic 33 — Q-13 corrigée (éveils ≠ souffles), stories 33.6, 33.7, 33.8 ; FR-61 → FR-63, D-21 (voir sprint-change-proposal-2026-09-26.md). Précédemment : […]

**Justification :** journal des changements du document (le champ est tenu à jour par chaque sprint change ; `lastUpdated` passe à `'2026-10-02'`). `[…]` = reprendre la suite actuelle sans la modifier.

---

**`epics.md` · inventaire des FR · L52 et L79**

**OLD (L52) :**
> - FR-61 : Réserve de souffles préparée avant la séance (MJ seul)

**NEW (L52) :**
> - FR-61 : Réserve de souffles de l'Homme Dragon, composée sur sa fiche (MJ seul)

**OLD (L79) :**
> - FR-61 : Réserve de souffles préparée avant la séance

**NEW (L79) :**
> - FR-61 : Réserve de souffles de l'Homme Dragon, composée sur sa fiche

**Justification :** libellés alignés sur le nouveau titre de FR-61. Le tableau FR → story (L253,
« FR-61 | 33.6 | Réserve de souffles ») est correct tel quel : relu, sans modification. Idem la note D-7
(L167) qui cite D-21 et la 33.6 sans les décrire.

---

**`epics.md` · note d'ordre de l'épic 33 / D-21 · L326**

**OLD :**
> **Stories 33.6, 33.7 et 33.8 ajoutées le 2026-09-29 (sprint change)** : réserve de souffles préparée avant la séance (MJ seul, passe UX préalable), capacités de niveau (artefact cadeau, souffles rituels), et Homme Dragon multi-aventures (planifié, après passage architecture). Ordre : 33.3 → 33.4 → 33.5 → 33.7 → passe UX → 33.6 → 33.8.

**NEW :**
> **Stories 33.6, 33.7 et 33.8 ajoutées le 2026-09-29 (sprint change) ; 33.6 révisée le 2026-10-02** : réserve de souffles de l'Homme Dragon (une seule réserve, composée sur sa fiche, MJ seul ; passe UX faite le 2026-10-02), capacités de niveau (artefact cadeau, souffles rituels), et Homme Dragon multi-aventures (planifié, après passage architecture). Ordre : 33.3 → 33.4 → 33.5 → 33.7 → 33.6 → 33.8 (la passe UX de la 33.6 est faite).

**Justification :** plus de « préparée avant la séance » ; la passe UX n'est plus une étape à venir.

---

**`epics.md` · description de l'épic 33, note Q-13 · L1768**

**OLD :**
> […] Aucun décompte pendant la séance ; la réserve préparée avant la séance est portée par la 33.6. Le niveau compte les scénarios `PASSE` (décision du 2026-09-25).*

**NEW :**
> […] Aucun décompte pendant la séance ; la réserve de souffles de l'Homme Dragon, composée une fois sur sa fiche, est portée par la 33.6. Le niveau compte les scénarios `PASSE` (décision du 2026-09-25).*

**Justification :** même correction de vocabulaire (début de la note inchangé).

---

**`epics.md` · Story 33.4, AC « souffles disponibles » · L1877**

**OLD :**
> **And** si une réserve par défaut existe (33.6), elle y est imprimée

**NEW :**
> **And** si une réserve existe (33.6), elle y est imprimée (cases `souffle_1`..`souffle_4`)

**Justification :** `EXPERIENCE.md` §10.2. La 33.4 est implémentée : elle n'imprime pas la réserve (clause
reportée à la 33.6, consignée dans `deferred-work.md`). Cette retouche est une mise en cohérence du
texte d'AC, pas une demande de modification du code de la 33.4.

---

**`epics.md` · Story 33.6 (énoncé + AC + note) · L1915-1958 : remplacement en bloc**

*Reprise ligne à ligne* (ancien passage de `EXPERIENCE.md` §10.2 → sort) :

| Lignes | Ancien texte | Sort |
|---|---|---|
| L1917-1919 | « composer la réserve […] pour cette séance, à partir d'une réserve par défaut […] sans la recalculer à chaque fois » | Réécrit : composer sur la fiche, enregistrée pour l'export PDF. |
| L1923-1925 | « Given […] niveau 1 / When j'ouvre une séance / Then aucune réserve n'est proposée » | Réécrit : « j'ouvre sa fiche », ligne d'info seule. |
| L1927-1931 | « (par défaut sur la fiche, ou pour une séance) » ; N − 1 ; temps ; autre race | « sur la fiche » ; conservé ; **ajout** : un souffle d'autre race n'occupe qu'un emplacement. |
| L1933-1936 | « séance dont je n'ai pas composé la réserve […] réserve par défaut » | **Supprimé.** |
| L1938-1940 | « When la séance a lieu / Then […] ne décompte rien » | Reformulé sans séance. |
| L1942-1944 | « un joueur de la partie ouvre la séance […] » | **Supprimé**, remplacé par trois AC « MJ seul » (option B2) : lecture de la fiche et export PDF refusés (`403`) à un joueur, aucune fiche côté joueur. |
| L1946-1948 | Niveau 5 : rituels | Conservé. |
| L1950-1952 | « la séance est ouverte sur un autre de mes appareils […] » | **Retiré comme AC** (temps réel multi-appareil : « à évaluer à l'implémentation », voir la note finale). |
| L1954-1956 | Souffle retiré du catalogue | Conservé, **+ « reste retirable »**. |
| L1958 | Note de décisions | Réécrite. |
| (à ajouter) | n/a | Enregistrement automatique et échec ; annulation du dernier retrait ; interdits grisés avec raison ; catégories repliables ; PDF ; `DetailSurface` utilisable à 320 × 256 ; tests clavier de focus. |

**OLD (extraits) :**
> As a MJ qui prépare sa séance, / I want composer la réserve de souffles de mon dragon pour cette séance, à partir d'une réserve par défaut, / So that je l'annonce à mes joueurs sans la recalculer à chaque fois.

**NEW (texte complet de la story, à substituer aux lignes 1915 à 1958) :**

```markdown
### Story 33.6 : Réserve de souffles

As a MJ qui prépare ma séance,
I want composer sur la fiche de mon Homme Dragon sa réserve de souffles, une seule fois,
So that elle soit mémorisée et imprimée dans l'export PDF sans que je la refasse à chaque séance.

**Acceptance Criteria:**

**Given** mon Homme Dragon est au niveau 1
**When** j'ouvre sa fiche
**Then** la section « Réserve de souffles » affiche seulement la ligne d'information « La réserve de souffles s'ouvre au niveau 2. »
**And** aucun emplacement, aucun composeur et aucun bouton n'est proposé
**And** le serveur refuse toute écriture de réserve

**Given** mon Homme Dragon est au niveau N, de 2 à 5
**When** j'ouvre sa fiche
**Then** la section « Réserve de souffles » figure dans la colonne gauche, juste avant la carte « Souffles »
**And** elle affiche N − 1 emplacements numérotés, tous visibles, vides ou remplis, sous le titre « Niveau N · N − 1 emplacements » (au singulier au niveau 2 : « Niveau 2 · 1 emplacement »)
**And** il n'existe qu'une seule réserve par Homme Dragon : aucune réserve n'est attachée à une séance et aucun écran de séance n'est modifié

**Given** un emplacement vide
**When** je le touche, choisis un souffle dans la fenêtre « Choisir un souffle pour l'emplacement N » puis valide « Mettre dans l'emplacement N »
**Then** le souffle occupe cet emplacement, la fenêtre se ferme et la réserve est enregistrée
**And** un même souffle commun ou de ma race peut occuper plusieurs emplacements, la fenêtre l'indiquant par le repère non bloquant « Déjà dans l'emplacement N »
**And** sur un emplacement rempli, « Changer » rouvre la fenêtre et le souffle choisi remplace l'ancien

**Given** la fenêtre de choix ouverte
**When** elle liste les souffles
**Then** tous les souffles restent listés et consultables, par catégorie repliable (communs par famille, souffles de ma race, souffles des autres races, souffles rituels) : dépliées par défaut, sauf les catégories où rien n'est choisissable, repliées avec leur raison écrite à côté du titre
**And** les souffles du temps (Passé, Futur) sont grisés avec la raison « Non réservable : souffle du temps », jamais masqués, et le serveur les refuse
**And** une ligne grisée se consulte (sa description et sa raison s'affichent dans la zone de détail) mais ne se place pas : « Mettre dans l'emplacement N » reste visible, inactif, avec la raison liée

**Given** mon Homme Dragon est au niveau 2
**When** j'ouvre la fenêtre de choix
**Then** les souffles des autres races sont grisés avec une raison écrite et aucun ne peut être placé

**Given** mon Homme Dragon est au niveau 3 ou plus
**When** je place un souffle d'une autre race
**Then** il n'occupe qu'un seul emplacement et le serveur refuse de le placer une seconde fois
**And** les autres souffles d'une autre race sont grisés avec la raison « Un seul souffle d'une autre race », et le souffle placé indique « Déjà dans l'emplacement N »
**And** l'emplacement qui le contient reste modifiable (« Changer », « Retirer »)

**Given** mon Homme Dragon est au niveau 5
**When** je compose la réserve
**Then** les souffles rituels peuvent y figurer, sans compter comme souffle d'une autre race
**And** avant le niveau 5, ils sont grisés avec la raison « Admis dès le niveau 5 » et le serveur les refuse

**Given** une demande d'écriture de la réserve, quel qu'en soit l'auteur
**When** le serveur la reçoit
**Then** seul le MJ de la partie est admis, pour Ryuutama uniquement
**And** le niveau est recalculé côté serveur et toute la composition résultante est revalidée contre les catalogues `souffle` et `souffleRituel` : capacité N − 1, souffles du temps exclus, au plus un souffle d'une autre race (sur un seul emplacement) dès le niveau 3, rituels dès le niveau 5, souffle inconnu du catalogue refusé
**And** une demande invalide est rejetée sans rien écrire
**And** la réserve ne peut pas être écrite par la modification générale de la fiche

**Given** un joueur de la partie (membre, non MJ)
**When** il appelle la lecture de la fiche de l'Homme Dragon (`GET /parties/:id/homme-dragon`)
**Then** le serveur la refuse (`403`), sans aucune donnée de la fiche ni de la réserve

**Given** un joueur de la partie (membre, non MJ)
**When** il appelle l'export PDF de la fiche de l'Homme Dragon
**Then** le serveur le refuse (`403`) et ne produit aucun PDF

**Given** un joueur de la partie
**When** il parcourt l'application (partie, « Personnages »)
**Then** il ne voit aucune fiche d'Homme Dragon ni section « Réserve de souffles » (garde web existante conservée)
**And** le MJ continue de lire et d'exporter sa fiche comme avant, réserve comprise

**Given** je choisis, change ou retire un souffle
**When** le geste est fait
**Then** il est enregistré immédiatement, sans bouton « Enregistrer »
**And** un seul enregistrement est en vol : pendant l'attente, les boutons d'emplacement sont inactifs (`aria-disabled="true"`), la liste est `aria-busy="true"` et la mention devient « Enregistrement… »
**And** à la réussite, la mention « Enregistrée automatiquement, utilisée pour l'export PDF. » s'affiche sous le titre de la section et la zone de statut annonce « Réserve enregistrée »

**Given** l'enregistrement d'un geste échoue
**When** l'échec est signalé
**Then** le message « Impossible d'enregistrer la réserve. Réessayez. » s'affiche (`role="alert"`, ré-annoncé à chaque échec)
**And** l'emplacement revient à son état précédent : rien n'est vidé ni écrasé
**And** la mention d'enregistrement est masquée tant que l'erreur est affichée

**Given** un emplacement rempli
**When** je touche « Retirer »
**Then** l'emplacement est vidé aussitôt, sans dialogue de confirmation
**And** un bandeau « <Souffle> retiré de l'emplacement N. » accompagné d'un bouton « Annuler » reste affiché quelques secondes (durée à fixer à l'implémentation, 6 s en valeur d'exemple), le décompte étant suspendu tant que le focus ou le survol est sur le bandeau
**And** si l'écriture du retrait échoue, l'emplacement revient à son état précédent et aucun bandeau n'apparaît

**Given** le bandeau d'annulation affiché
**When** j'active « Annuler » (inactif tant que l'écriture du retrait n'est pas terminée)
**Then** le souffle retourne dans le même emplacement, le bandeau disparaît et la zone de statut annonce « <Souffle> remis dans l'emplacement N »
**And** si l'annulation échoue, le message d'erreur habituel s'affiche et l'emplacement reste vide
**And** le bandeau disparaît si l'emplacement est entre-temps occupé, et un nouveau retrait remplace le message (seul le dernier retrait est annulable)
**And** aucun bouton « Vider la réserve » n'existe

**Given** une réserve composée
**When** la séance a lieu ou que j'exporte la fiche
**Then** l'application ne décompte rien : aucun compteur « utilisé » ou « restant », aucun souffle marqué comme consommé

**Given** une réserve composée au niveau N
**When** mon Homme Dragon passe au niveau N + 1
**Then** la réserve existante est conservée et le nouvel emplacement apparaît vide

**Given** une réserve contenant un souffle retiré du catalogue
**When** elle s'affiche
**Then** la ligne reste lisible, son libellé étant la clé brute
**And** elle reste retirable, et « Changer » reste possible

**Given** une réserve composée
**When** j'exporte la fiche en PDF, dans le format éditable comme dans le format 2 pages
**Then** `souffle_1` à `souffle_4` portent le nom du souffle (sans son coût) de l'emplacement de même numéro
**And** un emplacement vide, ou une réserve vide, laisse sa case vide
**And** `nombre_souffles` reste égal à `max(niveau − 1, 0)` et `souffle_actuel` reste vide

**Given** la fenêtre de choix, qui réutilise `DetailSurface`
**When** `DetailSurface` est étendu (emplacements `header` et `footer` personnalisables, hauteur en `dvh` avec zone sûre, `max-height` propre de la zone de détail, bouton de fermeture de 44 px nommé « Fermer la fenêtre » ou « Fermer la feuille », largeur desktop adaptée par usage, `prefers-reduced-motion` respecté)
**Then** la fenêtre est utilisable à 320 × 256 px CSS : en-tête et pied compacts, liste défilante visible, zone de détail à défilement propre
**And** l'extension est rétro-compatible : tous les autres usages de `DetailSurface` sont re-vérifiés (specs relues, passe visuelle mobile et desktop : fermeture à 44 px, focus, mouvement réduit) sans régression

**Given** une navigation au clavier dans la section et la fenêtre
**When** je place ou change un souffle, je retire un souffle, j'annule la fenêtre (« Annuler », Échap ou ✕) ou j'annule un retrait
**Then** une fois le rendu terminé, le focus est sur la cible prévue : « Changer » de l'emplacement après un placement ou un changement, « Choisir un souffle » de l'emplacement après un retrait, « Changer » de l'emplacement rétabli après l'annulation d'un retrait, le déclencheur d'origine après « Annuler », Échap ou ✕ ; jamais sur `<body>`
**And** des tests clavier vérifient chacun de ces cas

**Given** la section et la fenêtre de choix
**When** je les parcours au clavier ou au lecteur d'écran
**Then** chaque ligne de souffle est un `<button>` natif tabulable (Entrée ou Espace pour consulter, `aria-pressed` sur la ligne consultée) et chaque ligne grisée est `aria-disabled="true"` tout en restant focalisable
**And** chaque en-tête de catégorie porte `aria-expanded` et `aria-controls`
**And** une zone `role="status"` persistante annonce les placements, retraits, annulations et enregistrements

**Given** mon Homme Dragon est au niveau 5
**When** la carte « Souffles rituels » (33.7) s'affiche
**Then** elle reste un catalogue de consultation, et sa consigne n'affirme plus « sans réserve ni décompte » : elle indique que ces souffles peuvent être placés dans la réserve, sans décompte

*Décisions du 2026-10-02 (passe UX, `ux-designs/ux-jdr-master-2026-10-01/`) :* une seule réserve par Homme Dragon, sur sa fiche (la réserve par séance et la réserve par défaut du 2026-09-29 sont abandonnées) ; « Vider la réserve » retiré ; annulation temporaire du dernier retrait ; un souffle d'une autre race n'occupe qu'un emplacement ; niveau qui baisse : aucune règle spécifique ; `DetailSurface` étendu de façon rétro-compatible. *Décisions du 2026-09-29 conservées :* réserve visible du MJ seul ; souffles rituels admis dès le niveau 5. *Prérequis :* 33.7 (catalogue des souffles rituels : levé). *Hors AC :* le câblage temps réel multi-appareil de la fiche (signal `changed` / `notifyChanged()` de la partie, `RealtimeService`) est à évaluer à l'implémentation selon `docs/checklist.md`. *Option B2 (2026-10-02) :* la fiche de l'Homme Dragon et son export PDF sont réservés au MJ (la garde de lecture passe de `getViewable` à `getOwned`) ; les specs API qui supposaient la lecture par un membre sont à renverser (sprint change 2026-10-02, §4.9). *À la livraison :* tenir à jour le README du PDF, `docs/dragons.md` et `deferred-work.md`, et renverser les tests qui figent « `souffle_1`..`souffle_4` jamais remplis » (sprint change 2026-10-02, §4.5 et §4.6). *Recommandation :* exprimer les règles de composition (capacité, quota, rituels) en fonctions pures de `packages/game-rules`, partagées par la validation serveur et le grisage web, plutôt que de dupliquer une troisième fois la règle de disponibilité (cf. `deferred-work.md`). *Revues :* mode plan avant la story, puis `/security-review` et `/code-review`.
```

**Justification :** correspond aux six « À ajouter » et aux cinq retraits de `EXPERIENCE.md` §10.2. Le
compte des AC (23 blocs contre 9) reflète la richesse de la passe UX ; chaque AC se rattache à une
section d'`EXPERIENCE.md` : niveau 1, §5 (niveau 1) ; capacité, §2/§5 ; placement, §4/§5 ; fenêtre et
interdits, §4/§5 ; autre race, §5 ; rituels, §5 ; écriture serveur, AD-22 ; MJ seul (trois blocs : refus de
la lecture, refus de l'export PDF, aucune fiche côté joueur), §5 (visibilité) et option B2 (U-17) ; enregistrement/échec, §5 ; retrait/annulation, §4/§5 ; aucun décompte, §5 ; montée
de niveau et clé retirée, §5 ; PDF, §10.5 ; `DetailSurface`, §9/§10.7 ; focus, §6 ; accessibilité, §7 ;
consigne rituels, §10.6. Le temps réel est volontairement hors AC (§6 et décision de clôture 7).

---

**`epics.md` · note de la Story 33.8 · L2005**

**OLD :**
> Réserve de séance (33.6) : une séance reste dans une seule partie, donc un seul dragon — pas de conflit.

**NEW :**
> Réserve de souffles (33.6) : elle est portée par la fiche (`sheetData`) et suit donc l'Homme Dragon d'une aventure à l'autre. L'AD du modèle multi-aventures confirme que `sheetData`, réserve comprise, reste attaché à l'Homme Dragon et non à l'aventure (la capacité de la réserve dépend du niveau, qui cumulera les scénarios `PASSE` de toutes ses aventures), et traite d'un même mouvement les routes d'écriture aujourd'hui scopées par partie (`eveil-power`, `artefact-cadeau`, réserve) ainsi que la garde « fiche et export PDF réservés au MJ » (sprint change du 2026-10-02).

**Justification :** l'argument « une séance reste dans une seule partie » n'a plus d'objet (plus de séance
concernée). Il est remplacé par la vraie question que la 33.8 hérite : la réserve vit dans la fiche, donc
elle voyage avec le dragon. Même amendement à reporter en L59 d'`epic-33-context.md` (§4.4) ; la ligne
L43 (« Aucune story antérieure ne doit figer un contrat “un Homme Dragon par partie” ») reste vraie et
s'applique à la route d'écriture de la réserve, scopée par partie comme ses voisines.

### 4.3 Architecture — `_bmad-output/planning-artifacts/architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md` (2 blocs)

**`ARCHITECTURE-SPINE.md` · AD-22 (titre, Binds, Prevents, Rule, Lecture, Écriture, Ne pas) · L221-228**

**OLD :**
> ### AD-22 — Réserve de souffles : JSON sur la séance et dans la fiche, MJ seul
> - **Rule:** la réserve d'une séance est un champ JSON nullable sur `Seance` (`reserveSouffles`, liste `{ key, count }`) ; la réserve par défaut vit dans `HommeDragon.sheetData.reserveParDefaut` (même forme). Une séance sans réserve affiche la réserve par défaut, **résolue à la lecture** […]

**NEW (à substituer aux lignes 221 à 228, le bloc Mermaid L230 s'enchaîne sans changement) :**

```markdown
### AD-22 — Réserve de souffles : une liste par emplacement dans la fiche, MJ seul

- **Binds:** FR-61 · D-21 *(ajoutée le 2026-09-29 ; **révisée le 2026-10-02** : la réserve par séance et la réserve par défaut sont abandonnées au profit d'une réserve unique sur la fiche ; à valider au démarrage de la story 33.6)*
- **Prevents:** un modèle relationnel pour une configuration écrite d'un bloc et jamais interrogée par valeur ; une réserve attachée à une séance, avec la résolution défaut/séance et la modification de `SeanceDto` qui l'accompagnent ; la fuite de la réserve vers les joueurs, que la lecture de la fiche ou de son export PDF par tout membre permettrait ; l'écriture de la réserve par la modification générale de la fiche ; deux écritures concurrentes qui s'écrasent.
- **Rule:** la réserve est **un seul champ JSON de la fiche** : `HommeDragon.sheetData.reserve` *(nom provisoire, fixé à l'implémentation)*, **liste positionnelle** dont l'index est le numéro d'emplacement ; chaque élément est la clé d'un souffle (catalogue `souffle` ou `souffleRituel`) ou `null` pour un emplacement vide ; un emplacement au-delà de la fin de la liste est vide, ce qui fait apparaître vides les emplacements gagnés à la montée de niveau sans migration. La forme `{ key, count }` ne convient plus : l'emplacement est la donnée (« Déjà dans l'emplacement N », « Retirer » par emplacement, ordre des cases du PDF). Aucun champ sur `Seance`, aucune résolution défaut/séance, aucun impact sur `SeanceDto`. Pas de migration Prisma (colonne JSON existante).
  **Lecture :** MJ seul, **sur la fiche entière**. `GET /parties/:id/homme-dragon` et l'export PDF passent par `parties.getOwned` (refus `403` pour tout non-MJ) au lieu de `parties.getViewable` ; cette garde révise, pour l'Homme Dragon uniquement, la lecture « par tout membre » du Palier 5 (NFR1). La réserve vit donc simplement dans `sheetData`, **sans retrait en projection**. `reserve` n'apparaît **jamais** dans une réponse servie à un autre lecteur : lecture agrégée de « Personnages » (33.5, qui ne renvoie que nom, race et avatar), `PartieDto`, DTO de séance (même principe que `sheetVisibility`). Le signal temps réel ne porte aucune donnée.
  **Écriture :** MJ seul (`getOwned`), Ryuutama seul, par une **route dédiée** (jamais le `PATCH` générique : `reserve` est exclu de `UpdateHommeDragonDto`, comme `artefactCadeau`). Même mécanique que `chooseEveilPower()` et `chooseArtefactCadeau()` : niveau recalculé côté serveur (scénarios `PASSE`), transaction avec verrou de ligne `SELECT … FOR UPDATE`, `sheetData` copié et jamais muté. Le serveur valide **toute la composition résultante** contre les catalogues `souffle` et `souffleRituel` : capacité niveau − 1 (aucun emplacement au niveau 1), souffles `reservable: false` exclus, au plus un souffle d'une autre race à partir du niveau 3 (aucun avant) **et sur un seul emplacement**, souffles rituels admis dès le niveau 5 sans compter comme « autre race », toute clé nouvellement placée connue du catalogue (une clé déjà présente mais retirée du catalogue est tolérée : elle reste lisible et retirable). L'écriture est faite **à chaque geste** (enregistrement automatique) ; chaque appel est atomique et rejette sans rien écrire une composition invalide. La forme exacte de l'appel (remplacement complet de la liste ou écriture d'un emplacement) est fixée par l'architecte au démarrage de la 33.6. Émission `partie:{id}` après écriture. Un niveau qui baisse n'entraîne aucune purge ni validation d'un surplus préexistant.
  **Ne pas :** décompter quoi que ce soit ; porter la réserve sur `Seance` ou la recopier dans les séances ; la servir à un non-MJ ; rouvrir la lecture de la fiche ou de l'export PDF à un non-MJ sans retirer `reserve` de la projection ; l'écrire par le `PATCH` générique de la fiche.
```

**Justification :** `EXPERIENCE.md` §10.3, point par point : titre (fiche seule) ; Binds (D-21
reformulé) ; Prevents (la « recopie dans chaque séance » est sans objet, remplacée par les vrais risques
du nouveau modèle) ; Rule (un seul champ, liste positionnelle, plus de `Seance.reserveSouffles`) ;
Lecture (« DTO de séance » devient « fiche entière réservée au MJ », option B2) ; Écriture (autre race sur un
seul emplacement, compatibilité avec l'écriture à chaque geste) ; Ne pas. Trois ajouts viennent de la
relecture du code du 2026-10-02 et sont à valider par l'architecte : le **durcissement de la garde de
lecture** de la fiche et de l'export PDF (`getViewable` devient `getOwned`, incohérence n° 1 et U-17), la **route dédiée** (le `PATCH` générique recopie `...dto` dans
`sheetData` ; `UpdateHommeDragonDto = Partial<Omit<HommeDragonSheetData, 'race' | 'artefactCadeau'>>` et
`forbidNonWhitelisted: true` y protègent déjà `artefactCadeau`, il faut y ajouter `reserve`) et le
**verrou de ligne** (mécanique déjà posée par la 10.4 et la 33.7). La forme d'appel est laissée ouverte
exprès (point n° 2). La règle « JSON vs relationnel » du spine (L262) est respectée.

---

**`ARCHITECTURE-SPINE.md` · ligne Q-13 des différés · L498**

**OLD :**
> Aucun décompte pendant la séance ; la réserve préparée avant la séance relève d'**AD-22** |

**NEW :**
> Aucun décompte pendant la séance ; la réserve de souffles de l'Homme Dragon, composée sur sa fiche, relève d'**AD-22** |

**Justification :** même correction que dans le PRD (début de la ligne inchangé).

### 4.4 Contexte d'épic — `_bmad-output/implementation-artifacts/epic-33-context.md` (8 blocs)

**`epic-33-context.md` · Goal · L7**

**OLD :**
> […] capacités de niveau, réserve de souffles préparée avant la séance, export PDF équivalent à celui des joueurs […]

**NEW :**
> […] capacités de niveau, réserve de souffles composée sur sa fiche, export PDF équivalent à celui des joueurs […]

**Justification :** suppression de « préparée avant la séance ».

---

**`epic-33-context.md` · Stories, ligne d'ordre · L20**

**OLD :**
> Ordre : 33.3 → 33.4 → 33.5 → 33.7 → passe UX → 33.6 → 33.8 (après décision d'architecture).

**NEW :**
> Ordre : 33.3 → 33.4 → 33.5 → 33.7 → 33.6 → 33.8 (après décision d'architecture). La passe UX de la 33.6 est faite (2026-10-02).

**Justification :** mise en cohérence avec la note d'ordre d'`epics.md` L326 (non listée dans §10 d'`EXPERIENCE.md`, ajoutée ici).

---

**`epic-33-context.md` · Requirements, puce « Réserve (FR-61) » · L28 (à remplacer en entier)**

**OLD :**
> […] Réserve par défaut sur la fiche, pré-remplissant toute séance non composée ; la modifier sur une séance ne touche pas le défaut. Les joueurs ne la voient jamais : aucune réponse d'API ne la leur transmet.

**NEW (puce complète) :**
> - **Réserve (FR-61, réservée au MJ)** : inexistante au niveau 1 (une ligne d'information) ; dès le niveau N ≥ 2, N − 1 emplacements, vides ou remplis, un même souffle commun ou de la race pouvant en occuper plusieurs ; souffles du temps exclus ; dès le niveau 3, au plus un souffle d'une autre race, sur un seul emplacement ; au niveau 5, les souffles rituels sont admis et ne comptent pas comme « autre race ». **Une seule réserve par Homme Dragon, portée par sa fiche** : aucune réserve par séance, aucun impact sur les séances. Enregistrée automatiquement à chaque geste, imprimée dans l'export PDF. Pas de « Vider la réserve » : on retire les souffles un à un, avec annulation temporaire du dernier retrait. Les joueurs ne la voient jamais : **la fiche de l'Homme Dragon entière et son export PDF sont réservés au MJ** (refus `403` pour un non-MJ ; la lecture « par tout membre » du Palier 5 est révisée pour l'Homme Dragon, option B2 du 2026-10-02) ; le MJ qui veut faire imprimer sa fiche par un joueur exporte le PDF et le lui envoie.

**Justification :** `EXPERIENCE.md` §10.4 demande de supprimer « Réserve par défaut sur la fiche,
pré-remplissant toute séance non composée […] » ; la puce entière est réécrite pour porter U-10 à U-17
(dont la lecture réservée au MJ).

---

**`epic-33-context.md` · Requirements, puce « PDF (33.4) » · L31**

**OLD :**
> réserve par défaut imprimée si elle existe (33.6)

**NEW :**
> réserve imprimée si elle existe (33.6 : nom du souffle dans `souffle_1`..`souffle_4`, cases vides sinon)

**Justification :** omission relevée par la revue de la passe UX (la liste de §10.3 oubliait cette puce).

---

**`epic-33-context.md` · Technical Decisions, puce « AD-22 » · L42 (à remplacer en entier)**

**OLD :**
> - **AD-22 — Réserve de souffles (33.6, à valider au démarrage de la story)** : réserve de séance = champ JSON nullable `reserveSouffles` sur `Seance` (liste `{ key, count }`) ; réserve par défaut = `HommeDragon.sheetData.reserveParDefaut`, même forme ; […]

**NEW :**
> - **AD-22 — Réserve de souffles (33.6, révisée le 2026-10-02, à valider au démarrage de la story)** : une seule réserve, `HommeDragon.sheetData.reserve` (nom provisoire), liste positionnelle par emplacement (clé de souffle ou `null`) ; aucun champ sur `Seance`, aucune résolution défaut/séance, `SeanceDto` inchangé. Lecture MJ seul sur la fiche entière : `GET /parties/:id/homme-dragon` et l'export PDF passent par `getOwned` (refus `403` pour un non-MJ, option B2), la réserve vit simplement dans `sheetData` sans retrait en projection ; le signal temps réel ne porte aucune donnée. Écriture MJ seul (`getOwned`) par une route dédiée (jamais le `PATCH` générique), niveau recalculé, verrou de ligne, validation serveur de toute la composition à partir des catalogues `souffle` et `souffleRituel` (capacité, souffles `reservable: false` exclus, autre race au plus une et sur un seul emplacement, rituels dès le niveau 5) ; écriture à chaque geste ; émission `partie:{id}` après écriture ; câblage des vues sur le signal `changed` / `notifyChanged()` à évaluer à l'implémentation (`docs/checklist.md`).

**Justification :** reflet fidèle de la nouvelle AD-22 (§4.3). Le câblage temps réel passe d'« obligatoire »
à « à évaluer » (décision de clôture 7 de la passe UX).

---

**`epic-33-context.md` · UX & Interaction Patterns, puce « Écran de réserve » · L51**

**OLD :**
> - Écran de réserve (page de séance + réserve par défaut sur la fiche) : conçu par une passe `bmad-ux` **avant** 33.6. L'artefact cadeau (33.7) réutilise `ChoiceCard`, cartes et `DetailSurface` existants.

**NEW :**
> - Écran de réserve : conçu par la passe `bmad-ux` du 2026-10-02 (`ux-designs/ux-jdr-master-2026-10-01/`, planche contractuelle `mockups/key-reserve-final.html`). Une section « Réserve de souffles » sur la fiche (colonne gauche, juste avant la carte « Souffles ») et une fenêtre de choix qui est `DetailSurface` étendu de façon rétro-compatible (les autres usages sont à re-vérifier). L'artefact cadeau (33.7) réutilise `ChoiceCard`, cartes et `DetailSurface` existants.

**Justification :** `EXPERIENCE.md` §10.4 (section sur la fiche + fenêtre de choix, au lieu de page de séance).

---

**`epic-33-context.md` · Cross-Story, ligne 33.4 · L57**

**OLD :**
> imprime la réserve par défaut si 33.6 est livrée.

**NEW :**
> n'imprime pas la réserve : la 33.6 remplit ensuite `souffle_1`..`souffle_4` (réserve unique de la fiche).

**Justification :** la 33.4 a été implémentée sans la réserve (clause reportée dans `deferred-work.md`) ;
le texte « imprime […] si 33.6 est livrée » ne décrit plus qui fait quoi.

---

**`epic-33-context.md` · Cross-Story, ligne 33.6 · L59**

**OLD :**
> - 33.6 dépend de 33.7 (enregistre le catalogue des souffles rituels) et de la passe UX ; s'appuie sur le niveau (scénarios `PASSE`), le temps réel de la partie et les séances (une séance appartient à une seule partie, donc un seul dragon — pas de conflit avec 33.8).

**NEW :**
> - 33.6 dépend de 33.7 (catalogue des souffles rituels : levé) et de la passe UX (faite le 2026-10-02) ; s'appuie sur le niveau (scénarios `PASSE`), sur `DetailSurface` (étendu de façon rétro-compatible : tous les autres usages sont à re-vérifier) et sur le signal temps réel de la partie (câblage à évaluer). Elle n'a plus aucun lien avec les séances (réserve unique sur la fiche). La réserve suit l'Homme Dragon : la 33.8 devra confirmer que `sheetData` reste attaché au dragon (AD multi-aventures).

**Justification :** `EXPERIENCE.md` §10.4 (« retirer la dépendance aux séances »).

### 4.5 `deferred-work.md` (1 bloc, **ajout** sans modifier l'entrée existante)

**`_bmad-output/implementation-artifacts/deferred-work.md` · bloc « bmad-build de 33-4 », après la première entrée · après L169**

**OLD (entrée existante, **conservée telle quelle**) :**
> summary: Clause d'AC « la réserve par défaut est imprimée si elle existe » non traitée — aucune donnée de réserve n'existe encore (`souffle_1`..`souffle_4` restent vides).
> evidence: la réserve de souffles est l'objet de la Story 33.6 ; à reprendre là (remplir les 4 cases, `nombre_souffles` restant `max(niveau − 1, 0)`).

**NEW (entrée ajoutée juste après, sans modifier la précédente) :**
> - source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-02.md`
>   summary: Mise à jour de l'entrée précédente (sprint change du 2026-10-02) : la « réserve par défaut » est abandonnée au profit d'une réserve unique portée par la fiche ; la clause se lit « si une réserve existe ».
>   evidence: la 33.6 remplit `souffle_1`..`souffle_4` avec le nom du souffle de l'emplacement de même numéro (cases vides si l'emplacement ou la réserve est vide), `nombre_souffles` restant `max(niveau − 1, 0)`. **Les deux entrées sont à clore par la livraison de la 33.6** (les déplacer dans `deferred-work-archive.md`).

**Justification :** `EXPERIENCE.md` §10.5. Le format « ajout » évite de réécrire une entrée historique. L'entrée suivante (L170-172, duplication de `availableSouffles()` entre
`game-rules` et la fiche web) reste ouverte : la 33.6 ajoute un troisième consommateur de cette règle, d'où la
recommandation de la note de story (§4.2). Ne pas la modifier.

### 4.6 À la livraison de la 33.6 (modifications faites par la story elle-même)

Ces trois textes sont **justes aujourd'hui** ; ils ne doivent changer qu'au moment où la 33.6 est
livrée, d'où leur place dans la story et non dans l'application immédiate de cette proposition.

**`apps/api/game-systems/ryuutama/assets/README.md` · tableau des champs de souffle · L89**

**OLD :**
> | `souffle_1`..`souffle_4` | Les 4 cases de la réserve : **non remplies**, réservées à la réserve de souffles (Story 33.6) |

**NEW :**
> | `souffle_1`..`souffle_4` | Les 4 cases de la réserve : nom du souffle (sans son coût) de l'emplacement de même numéro (Story 33.6) ; **vides** si l'emplacement ou la réserve est vide |

**Justification :** `EXPERIENCE.md` §10.5. À faire avec : le commentaire de tête de
`packages/game-rules/src/ryuutama/homme-dragon-pdf-field-map.ts` (L54-55, « restent volontairement non
couverts »), `mapHommeDragonToPdfFields()` (le contenu résolu `HommeDragonPdfContent` reçoit les libellés
des souffles de la réserve, comme `eveilPowerLabels`) et les tests qui figent l'absence :
`packages/game-rules/src/__tests__/homme-dragon-pdf-field-map.spec.ts` (L221) et
`apps/api/src/homme-dragon/homme-dragon.pdf.service.real.spec.ts` (L121 et ~L148).

---

**`docs/dragons.md` · « Souffles rituels (mère-dragon) » · L226-228** (correction de l'incohérence n° 2)

**OLD :**
> Ils sont consultables sur la fiche dès le niveau 5, en lecture seule (ni réserve ni décompte pour l'instant) ; sans race ni famille, ils ne comptent jamais comme des souffles « d'une autre race ».

**NEW :**
> Ils sont consultables sur la fiche dès le niveau 5, et peuvent être placés dans la réserve (sans décompte) ; sans race ni famille, ils ne comptent jamais comme des souffles « d'une autre race ».

**Justification :** vrai avant la 33.6, faux après. Document de règles transcrites : modification à faire
sur demande explicite, dans la story, conformément à `AGENTS.md`.

**`docs/dragons.md` · après la puce « Depuis la réserve » · L138** (ajout facultatif, sur le modèle de L217-219)

**NEW :**
> Dans l'application : dès le niveau 2, la fiche propose la réserve (niveau − 1 emplacements) ; le MJ la compose une fois, elle est enregistrée automatiquement et imprimée dans l'export PDF (`sheetData`, MJ seul). L'application ne décompte rien.

**Justification :** `docs/dragons.md` documente déjà le comportement applicatif des capacités de niveau
(`artefactCadeau`, L217-219) ; même usage pour la réserve. À valider avec l'utilisateur (facultatif).

---

**`apps/web/src/app/features/homme-dragon/homme-dragon-sheet/homme-dragon-sheet.html` · consigne de la carte « Souffles rituels » · ~L334** (code web : réécrit par la 33.6, **non modifié ici**)

Retrouvée par `graphify query` puis `grep` dans le dossier de la fiche.

**OLD :**
> Mère-dragon : ces souffles sont consultables ici, sans réserve ni décompte.

**NEW (proposition de texte, à valider) :**
> Mère-dragon : ces souffles sont consultables ici et peuvent être placés dans la réserve, sans décompte.

**Justification :** `EXPERIENCE.md` §10.6 et décision (d). À la même occasion, la 33.6 relit les
commentaires qui répètent l'ancienne consigne (`homme-dragon-sheet.ts` ~L310 « Pas de réserve ni de
décompte ici (story dédiée) » et ~L379-380 « aucune réserve ni décompte (33.6) ») et le titre du test
`homme-dragon-sheet.spec.ts` ~L1251 (« sans mention de réserve ni “autre race” »). La spec 33-7 (story
implémentée) n'est pas réécrite.

### 4.7 `sprint-status.yaml` (1 bloc)

**`_bmad-output/implementation-artifacts/sprint-status.yaml` · commentaire `last_updated`, L45** (le statut `33-6-reserve-de-souffles: backlog`, L567, ne change pas)

**OLD :**
> […] Prochaine etape : passe bmad-ux de l ecran de reserve puis 33.6 en mode plan. […]

**NEW (à placer en tête du commentaire, avant l'historique) :**
> last_updated: 2026-10-02  # Passe bmad-ux de la 33.6 faite (ux-designs/ux-jdr-master-2026-10-01) : UNE seule reserve par Homme Dragon, sur sa fiche (reserve par seance abandonnee). Sprint change du 2026-10-02 (sprint-change-proposal-2026-10-02.md) a approuver puis appliquer AVANT bmad-build 33-6. Prochaine etape : appliquer le sprint change, puis 33.6 en mode plan. Historique precedent ci-dessous.

**Justification :** le fichier tient son journal dans ce commentaire (convention existante, sans accents).
Aucun changement de statut.

### 4.8 Ce qui ne change pas

- **Story 33.4 (export PDF, implémentée, `review`).** Aucun retour arrière. `nombre_souffles` reste
  `max(niveau − 1, 0)` ; `souffle_actuel` reste vide ; `souffle_max` = PS ; les pages « Souffles de mon
  dragon » sont inchangées. La 33.6 se limite à **remplir `souffle_1`..`souffle_4`**
  (`mapHommeDragonToPdfFields()` + tests). `spec-33-4-export-pdf-au-niveau-des-fiches-joueur.md` n'est pas
  réécrite (elle parle encore de « réserve par défaut » : c'est son histoire). **Seul changement de
  comportement hérité de l'option B2 :** l'export PDF n'est plus accessible à un joueur (`403`) ; le
  contenu du PDF et ses AC ne changent pas.
- **Story 33.7 (capacités de niveau, implémentée, `review`).** Le catalogue `souffleRituel` et le catalogue
  `hommeDragonLevelCapacity` sont déjà enregistrés : le prérequis de la 33.6 est levé. La capacité
  `reserve` (texte du livre : « pleine au début de chaque séance […] ») reste affichée telle quelle, elle
  décrit la règle du jeu, pas le comportement de l'application. Seule change la consigne de la carte
  « Souffles rituels » (§4.6). `spec-33-7-capacites-de-niveau.md` n'est pas réécrite.
- **Story 33.8 (planifiée).** « Une séance reste dans une seule partie, donc un seul dragon » devient sans
  objet : plus aucune réserve n'est attachée à une séance. La note de la 33.8 (L2005 d'`epics.md`) est
  amendée comme au §4.2 : la réserve, portée par `sheetData`, suit l'Homme Dragon ; l'AD multi-aventures
  le confirme et traite les routes d'écriture scopées par partie ensemble. Rien d'autre ne change dans la 33.8.
- **Stories 33.1, 33.2, 33.3, 33.5** : inchangées. **Séances** (`Seance`, `SeanceDto`, `SeanceList`,
  écrans de scénario) : intactes.
- **Documents historiques non modifiés :** `sprint-change-proposal-2026-09-26.md` (U-2, §4.1 FR-61, §4.2
  33.6, §4.3 AD-22 y sont superseded par la présente proposition), `spec-33-4`, `spec-33-7`,
  `_bmad-output/specs/spec-palier9-refonte-ui/SPEC.md` (L130, « suivi en jeu »), les `.memlog.md` et
  rapports de revue, `implementation-readiness-report-2026-08-05.md`.
- **Sans mention de la réserve, donc rien à faire :** `docs/backlog.md`, `docs/spec.md`, `docs/checklist.md`,
  `AGENTS.md`, le diagramme Mermaid du spine.
- **Règles de jeu** (`docs/dragons.md` L138-143, L215) : inchangées ; seul L227 évolue, à la livraison.

### 4.9 Garde de lecture de la fiche et de l'export PDF — option B2 (comportement livré)

Ce groupe regroupe ce que l'option B2 (U-17) change **hors** des blocs déjà listés. Les AC du comportement
sont dans la Story 33.6 (§4.2) ; le texte de FR-61, D-21 et AD-22 est en §4.1 et §4.3.

**Code et specs API : à faire par la story 33.6 (aucun code dans la présente proposition).**

| Fichier | Ce qui change |
|---|---|
| `apps/api/src/homme-dragon/homme-dragon.service.ts`, `findOne()` (~L341-362) | La garde passe de `parties.getViewable` à `parties.getOwned` (refus `403` pour un non-MJ ; `404` si la partie n'existe pas). Le comportement MJ est conservé : `null` si la partie n'est plus Ryuutama ou si la fiche n'existe pas. Le commentaire de tête (« Lecture ouverte à tout membre (NFR1) — cible toujours le Homme Dragon DU MJ… un joueur qui consulte n'en a pas le sien ») est réécrit : lecture réservée au MJ. |
| `apps/api/src/homme-dragon/homme-dragon.controller.ts`, `exportPdf()` | Aucun changement de code : il appelle `findOne()` d'abord et hérite donc du refus. |
| `apps/api/src/homme-dragon/homme-dragon.service.spec.ts`, `describe('findOne()')` (~L733-790) | Le test « Homme Dragon existant → DTO retourné (MJ ou membre, NFR1) » (appel en `u2`) devient « non-MJ membre → `ForbiddenException`, aucune lecture Prisma » ; le test « non-membre → `ForbiddenException` propagée par `getViewable` » devient un test de la garde `getOwned`. |
| `apps/api/src/homme-dragon/homme-dragon.service.spec.ts`, autres tests de `findOne()` (~L892-1220) | Les tests qui simulent `parties.getViewable` pour `findOne()` simulent `parties.getOwned` ; celui qui lit en `u2` (L892, membre « bob ») lit en `mj1`. |
| `apps/api/src/homme-dragon/homme-dragon.controller.spec.ts` | Inchangé (le service y est simulé) ; ajouter, côté service, un test de refus pour l'export PDF d'un non-MJ si le contrôleur n'est pas déjà couvert par un test d'intégration. |
| Web, e2e | Aucun changement : voir « Impacts sur le livré » (§2). |

**Documents historiques : annotation proposée, non appliquée** (documents de paliers antérieurs, à
confirmer par l'utilisateur ; ils ne sont pas réécrits, sur le modèle de l'annotation NFR4 du
sprint change du 2026-09-26).

**`epics-palier5.md` · Non-Functional Requirements, NFR1 · L46**

**OLD :**
> NFR1: Lecture de la fiche Homme Dragon ouverte à tout membre de la Partie (aucune donnée exposée ne révèle un scénario non joué — pas de risque de spoil) ; écriture réservée au MJ.

**NEW :**
> NFR1: Lecture de la fiche Homme Dragon ouverte à tout membre de la Partie (aucune donnée exposée ne révèle un scénario non joué — pas de risque de spoil) ; écriture réservée au MJ. *Révisée le 2026-10-02 (sprint change de l'épic 33, option B2) : la lecture de la fiche et de son export PDF est désormais réservée au MJ, la fiche portant sa réserve de souffles.*

**Justification :** la phrase actuelle promet l'accès joueur à la fiche ; elle deviendrait fausse après la 33.6.

---

**`architecture-jdr-master-2026-07-15/ARCHITECTURE-SPINE.md` · Consistency Conventions, ligne « Accès » · L101**

**OLD :**
> | Accès | Lecture = `parties.getViewable` ; écriture MJ = `parties.getOwned` ; jamais un guard NestJS dédié (hérité, Palier 4). […]

**NEW :**
> | Accès | Lecture = `parties.getViewable` ; écriture MJ = `parties.getOwned` ; jamais un guard NestJS dédié (hérité, Palier 4). *Révisé le 2026-10-02 (AD-22, option B2) : pour `HommeDragon` uniquement, la lecture passe aussi par `parties.getOwned` (MJ seul).* […]

**Justification :** cette ligne est la source de la lecture « par tout membre » appliquée à l'Homme Dragon.

**Notes de stories historiques, non réécrites :** `10-1-creer-sa-fiche-homme-dragon.md` (L201, L331 : « lecture
ouverte à tout membre, NFR1 ») et `10-5-exporter-sa-fiche-en-pdf.md` (L114 : « un joueur peut donc aussi
exporter la fiche de son MJ » ; la story demandait déjà de vérifier auprès de l'utilisateur si l'export
devait être restreint au MJ) : ce sont des stories implémentées, leur texte décrit l'état d'époque.

## 5. Passation

**Portée : Moderate (probable).** Il y a des amendements de PRD et d'architecture (AD-22 réécrite, avec
trois ajouts à valider) et une réécriture de story ; il n'y a ni nouvel épic, ni changement de séquence, ni
impact MVP. Ce n'est pas « Minor » parce que l'architecte doit valider AD-22 et que l'option B2 change le
comportement livré de deux routes de lecture ; ce n'est pas « Major » parce que rien n'a été construit pour
la réserve et qu'aucun appelant web n'est touché.

### Points à trancher par l'utilisateur

Le point n° 1 est tranché (B2). **Les points n° 2 à 9 sont validés comme recommandés, à confirmer en mode
plan au démarrage de la 33.6** (les textes de §4 sont rédigés selon ces recommandations).

1. **TRANCHÉ le 2026-10-02 : option B2.** *Question posée :* le MJ et les joueurs lisaient la même fiche et
   le même export PDF (NFR1 du Palier 5), donc la réserve dans `sheetData` aurait fuité. *Options :*
   A (retirer la réserve en projection pour un non-MJ), B1 (réserver seulement l'export PDF), C (accepter
   la fuite). *Décision de l'utilisateur :* **B2, la fiche entière et son export PDF sont réservés au MJ**
   (refus `403` pour un non-MJ), « s'il veut que quelqu'un l'imprime, il fait l'export et l'envoie ».
   Conséquences relevées en §2 (« Impacts sur le livré ») et §4.9. FR-61, D-21, AD-22 et la Story 33.6
   sont rédigés selon B2.
2. **Forme de l'écriture (à l'architecte, au démarrage de la 33.6).** *Option A* : l'appel remplace la liste
   entière ; simple, mais un second appareil écrase l'état du premier, une clé retirée du catalogue bloque
   la validation et un surplus après une baisse de niveau est rejeté. *Option B (recommandée)* : l'appel
   écrit un emplacement (`{ clé | null }`) ; la validation se fait sous verrou sur l'état résultant, « Annuler »
   est un simple remplacement et aucun autre emplacement n'est écrasé. AD-22 laisse le choix ouvert.
3. **Cases du PDF.** *Option A (recommandée)* : `souffle_i` = emplacement i, position conservée (un
   emplacement 2 vide laisse `souffle_2` vide). *Option B* : compacter les souffles dans les premières
   cases. Et si le niveau a baissé : imprimer quand même les emplacements en surplus (cohérent avec « aucune
   règle ») ou s'arrêter à la capacité ? Recommandation : ne rien filtrer. L'AC du PDF est écrit selon A.
4. **Un même rituel peut-il occuper plusieurs emplacements ?** Non spécifié. Recommandation : oui, comme
   un souffle commun (seul un souffle d'une autre race est limité), sans AC ni interdit serveur
   spécifique. À confirmer avant que le serveur ne valide les doublons.
5. **Durée de l'annulation du dernier retrait.** « Quelques secondes », 6 s en valeur d'exemple, décompte
   suspendu au focus et au survol (WCAG 2.2.1). À fixer en mode plan de la 33.6, sans bloquer l'approbation.
6. **Rejet de règle ou échec réseau.** Le message unique « Impossible d'enregistrer la réserve. Réessayez. »
   est faux pour un rejet serveur (la répétition ne servira à rien). Garder un message unique (retenu par
   la passe UX) ou en ajouter un second ? Un rejet n'arrive que sur un état périmé (autre appareil) ou un
   bogue.
7. **Chargement et échec du catalogue de souffles.** Non spécifié par la passe UX. Recommandation : tant
   que le catalogue n'est pas chargé, les boutons d'emplacement sont inactifs avec un message ; en cas
   d'échec, le même message d'erreur. À régler en mode plan, ou par un court complément à `EXPERIENCE.md`.
8. **Deux titres « Réserve de souffles » sur la fiche** (capacité du catalogue 33.7 et nouvelle section).
   Accepter (les contextes diffèrent : liste de capacités / section de composition) ou renommer l'un des deux.
9. **Texte de la consigne des rituels** (§4.6) : proposition à valider ; la passe UX l'a laissé à écrire.

### Rôles

| Rôle | Responsabilité |
|---|---|
| Utilisateur (inconnu259) | Proposition approuvée le 2026-10-02 (option B2). Confirmer les points n° 2 à 9 en mode plan au démarrage de la 33.6 ; décider de l'annotation des deux documents historiques (§4.9). |
| Developer (cette session) | Blocs de planification §4.1 à §4.5 et §4.7 **appliqués le 2026-10-02** (aucune opération git : le commit reste à l'utilisateur). Les modifications de §4.6 et le code/specs de §4.9 sont faits par la 33.6 elle-même. |
| Architecte (`bmad-architecture`) | Valider AD-22 révisée au démarrage de la 33.6, fixer la forme d'écriture (point n° 2) et le nom du champ. |
| Developer (`bmad-build`) | 33.3 → 33.4 → 33.5 → 33.7 → 33.6 (mode plan avant) → 33.8 après l'AD multi-aventures. |

### Critères de succès

- Plus aucune occurrence de « préparée avant la séance », « réserve par défaut », « pour cette séance »,
  `reserveSouffles` ou `reserveParDefaut` dans les artefacts **actifs** (PRD, `epics.md`, spine,
  `epic-33-context.md`, `deferred-work.md`) ; les documents historiques gardent leur texte d'époque.
- FR-61, D-21 et AD-22 se renvoient les uns aux autres avec la même formulation (une réserve unique sur la
  fiche, fiche et export PDF réservés au MJ, route dédiée).
- Les specs API de `findOne()` sont renversées par la 33.6 (refus d'un non-MJ), sans aucune régression web.
- La story 33.6 d'`epics.md` ne contient plus aucun AC lié aux séances, et contient les 23 blocs d'AC de
  §4.2 (dont les trois AC « MJ seul » : refus `403` de la lecture et de l'export PDF pour un joueur).
- `docs/dragons.md` L227, le README du PDF, les tests de `souffle_1`..`souffle_4` et la consigne web des
  rituels sont mis à jour par la 33.6 elle-même (liste de contrôle de fin de story).
- `sprint-status.yaml` : `33-6-reserve-de-souffles` reste `backlog` ; le commentaire `last_updated` est à jour.

**Rappels (CLAUDE.md du dépôt) :** mode plan avant la 33.6 ; `/security-review` (nouveau chemin d'écriture
MJ et exposition de `sheetData`) et `/code-review` à la fin de la story ; relire et merger les PR de mise à
jour de dépendances ; aucune installation de dépendance (la 33.6 n'en demande aucune).
