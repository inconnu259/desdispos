# Sprint Change Proposal — Épic 33 : règles de l'Homme Dragon

- **Date :** 2026-09-26
- **Auteur :** agent Developer (`bmad-correct-course`), pour inconnu259
- **Mode :** par lot
- **Statut :** approuvée le 2026-09-29

## 1. Résumé du problème

**Déclencheur.** Pendant la story 33.2 (« Les souffles de mon dragon »), l'utilisateur a fourni le
2026-09-25 la transcription des règles de l'homme-dragon (`docs/dragons.md`, depuis reformulée).
Elle montre deux choses.

1. **La Q-13 (tranchée le 2026-08-05) reposait sur une confusion.** Les « six souffles seedés »
   (`eveil-powers.json`) sont les **éveils**, pas les souffles communs. Les souffles — 9 communs en
   trois familles, 3 par race — n'existaient nulle part. La 33.2 a été recadrée et livrée sur les
   vrais souffles (commit `e7ecb55`).
2. **Plusieurs règles ne sont pas prévues au palier :** la réserve de souffles (dès le niveau 2),
   l'artefact cadeau (niveau 4), les capacités de niveau (souffles multicolores, invitation au
   voyage, envol / mère-dragon), les souffles rituels (niveau 5). Le PRD rangeait la réserve dans
   le « suivi en jeu » hors périmètre (§6).

**Type :** incompréhension des exigences d'origine (règles du jeu mal connues au moment du PRD),
plus besoin nouveau exprimé par l'utilisateur.

**Décisions utilisateur déjà prises (2026-09-25 / 26) :**

| # | Décision |
|---|---|
| U-1 | Niveau calculé par **scénario `PASSE`** conservé, bien que le livre dise « séances jouées » : les scénarios correspondent aux séances telles que les groupes les jouent. |
| U-2 | **Réserve de souffles à faire maintenant**, composée **sur la page de la séance**, avec une **réserve par défaut** sur la fiche qui pré-remplit chaque séance. |
| U-3 | La réserve est de la **préparation entre les séances**, pas du suivi en jeu : le §6 est amendé en conséquence. Rien n'est décompté pendant la séance. |
| U-4 | Artefact cadeau, capacités de niveau et souffles rituels à inclure dans le même lot que la réserve. |
| U-5 | Un même homme-dragon pour plusieurs groupes / mondes : **à planifier** (il était hors périmètre). |
| U-7 | La réserve est **réservée au MJ** : le meneur l'annonce en jeu, les joueurs ne la voient pas dans l'application (2026-09-29). |
| U-8 | Les **souffles rituels** suivent pour l'instant **les mêmes mécanismes** que les autres souffles (1 PS, ou gratuit depuis la réserve) ; à revoir si le besoin apparaît (2026-09-29). |
| U-9 | Une **passe UX** conçoit l'écran de la réserve avant la story (2026-09-29). |
| U-6 | NFR4 révisée : le contenu Ryuutama est **versionné**, avec des textes **reformulés** (mécaniques conservées). Déjà appliqué dans les PRD, le backlog et le README du seed. |

## 2. Analyse d'impact

### Checklist

| Item | Statut | Constat |
|---|---|---|
| 1.1 Story déclencheuse | [x] | 33.2, livrée et commitée (`e7ecb55`). |
| 1.2 Problème | [x] | Q-13 erronée ; règles manquantes (ci-dessus). |
| 1.3 Preuves | [x] | `docs/dragons.md` ; `eveil-powers.json` = éveils ; audit du code (`homme-dragon-derived.ts`, `homme-dragon.service.ts`). |
| 2.1 Épic courant | [!] | L'épic 33 reste faisable ; sa note Q-13 et la 33.4 sont fausses, la 33.3 doit consommer le nouveau contenu. |
| 2.2 Changements d'épic | [!] | Ajout de stories 33.6, 33.7 et 33.8 ; description d'épic mise à jour. |
| 2.3 Épics suivants | [x] | Aucun autre épic touché (29.16 et 33.5 inchangées ; 33.8 ne doit pas être rendue plus difficile par 33.5 — déjà exigé par le PRD). |
| 2.4 Épic obsolète / nouveau | [N/A] | Pas de nouvel épic : tout reste dans le 33. |
| 2.5 Ordre | [!] | 33.3 → 33.4 → 33.5 inchangés ; puis 33.7 (enregistre les souffles rituels), passe UX, 33.6 ; 33.8 en dernier, après passage architecture. |
| 3.1 PRD | [!] | FR-26 (Q-13), §6, tableau des questions, D-7 ; nouveaux FR-61 à FR-63. |
| 3.2 Architecture | [!] | Nouvelle décision de stockage de la réserve (AD-22) ; ligne Q-13 du spine ; 33.8 exigera une révision du modèle (AD à venir). |
| 3.3 UX | [!] | Aucun écran conçu pour la réserve (page de séance, réserve par défaut) ni pour l'artefact cadeau ; passe `bmad-ux` décidée avant 33.6 (U-9). |
| 3.4 Autres artefacts | [x] | NFR4 : `epics-p1-p3-ryuutama.md` et `epics-palier8.md` décrivent encore l'ancien NFR4 (à annoter). CI inchangée. Temps réel : la réserve de séance doit être câblée sur le signal `changed` (convention SSE). |

### Impact par artefact

- **Stories livrées :** 33.1 et 33.2 restent valides. Aucun retour arrière.
- **33.3 (création guidée) :** doit consommer `homme-dragon-races.json` (textes et préférences par race) et `homme-dragon-creation-intros.json` (aide par étape), déjà rédigés et à enregistrer dans `CONTENT_TYPES`.
- **33.4 (export PDF) :** l'AC « les souffles disponibles y figurent avec leur coût » doit lire le catalogue `souffle` (pas `eveilPower`). Si 33.6 est livrée avant, le PDF peut imprimer la réserve par défaut.
- **33.5 :** inchangée.
- **Code existant :** aucun changement imposé en dehors des nouvelles stories.

## 3. Approche recommandée

**Ajustement direct (option 1)** : amender le PRD et l'épic, ajouter trois stories dans l'épic 33.
Pas de retour arrière (option 2 : rien à défaire), pas de réduction du MVP (option 3 : le palier
reste atteignable ; il s'élargit de deux stories, plus une planifiée).

**Découpage du lot U-4 — recommandation.** Plutôt qu'une seule story, **deux** :
- **33.6 Réserve de souffles** — modèle, API, page de séance, réserve par défaut sur la fiche, temps réel. C'est la plus lourde : nouveau chemin d'écriture MJ, validations de règles, câblage SSE.
- **33.7 Capacités de niveau** — artefact cadeau (niveau 4), affichage des capacités acquises, souffles rituels (niveau 5). Surtout de la fiche et du contenu, peu de serveur.

Les deux sont livrables et testables séparément ; les regrouper ferait une story de plus de 1 600
tokens de spec, à haut risque. *(Si tu préfères une seule story, dis-le à la relecture.)*

**Effort / risque :**

| Story | Effort | Risque | Remarque |
|---|---|---|---|
| 33.6 | Moyen à élevé | Moyen | Écriture MJ, règles de composition, SSE ; `/security-review` à prévoir |
| 33.7 | Faible à moyen | Faible | Un champ `artefactCadeau` définitif, deux catalogues à enregistrer |
| 33.8 | Élevé | Élevé | Changement de modèle (unicité, historique et niveau inter-aventures), migration |

## 4. Propositions de modification détaillées

### 4.1 PRD — `prds/prd-jdr-master-2026-08-01/prd.md`

**FR-26, puce Q-13 (L259)**

OLD :
> **Q-13 tranchée le 2026-08-05.** Le constat de vérification initial était incomplet : les six souffles seedés existent bien de bout en bout, mais ce sont les **souffles communs**. Ceux qui sont **propres à chaque race de dragon** — vert, bleu, rouge, noir — n'existent nulle part dans l'application. Le mécanisme fonctionne, le contenu est incomplet.

NEW :
> **Q-13 tranchée le 2026-08-05, corrigée le 2026-09-25.** Les six entrées seedées (`eveil-powers.json`) sont les **éveils**, pas des souffles : la décision du 2026-08-05 les confondait. Les souffles — 9 **communs** en trois familles (temps, destin, aide aux PNJ) et 3 **propres à chaque race** — n'existaient nulle part ; ils sont seedés par la story 33.2 (`souffles.json`). Référence des règles : `docs/dragons.md`.

**FR-26, puce « Aucun suivi de consommation » (L261)**

OLD :
> **Aucun suivi de consommation.** On reste du côté « outil entre les sessions » : la réserve de souffles constituée en début de séance relève du suivi en jeu, explicitement hors périmètre (§6), et reportée après la mise en production.

NEW :
> **Aucun suivi de consommation.** On reste du côté « outil entre les sessions » : rien n'est décompté pendant la séance. La **réserve** de souffles, préparée avant la séance, est portée par FR-61 (décision du 2026-09-26).

**Nouveaux FR, à la suite de FR-27**

> #### FR-61 : Réserve de souffles préparée avant la séance
> Dès le niveau 2, le MJ compose sur la page d'une séance la réserve de son Homme Dragon pour cette séance ; une **réserve par défaut**, tenue sur la fiche, pré-remplit toute séance dont la réserve n'a pas été composée.
> - **Règles :** (niveau − 1) emplacements ; un même souffle peut y figurer en plusieurs exemplaires ; les souffles du temps n'y entrent jamais ; à partir du niveau 3, au plus **un** souffle d'une autre race. Communs et souffles de la race toujours autorisés.
> - **Aucun décompte :** la réserve est affichée, jamais consommée par l'application.
> - **MJ seul :** la réserve n'est visible que du MJ ; il l'annonce en jeu.
> - **Souffles rituels :** au niveau 5, ils entrent en réserve comme les souffles communs (mêmes mécanismes, ils ne comptent pas comme « souffle d'une autre race »).
> - **Prérequis serveur :** D-21.
>
> #### FR-62 : Capacités de niveau de l'Homme Dragon
> La fiche montre les capacités acquises selon le niveau (réserve, souffles multicolores, invitation au voyage, envol du dragon des saisons) avec leur texte ; au niveau 4, le MJ choisit une fois pour toutes un **artefact cadeau** d'une autre race ; au niveau 5, la mère-dragon accède aux **souffles rituels**.
>
> #### FR-63 : Un Homme Dragon pour plusieurs aventures
> Un même Homme Dragon peut suivre plusieurs groupes et plusieurs mondes : son historique et son niveau cumulent les aventures qu'il a racontées. Changement de modèle (unicité par partie aujourd'hui) — **planifié, après passage architecture** (story 33.8). FR-59 ne doit pas le rendre plus difficile (déjà exigé).

**§5 Dérogations serveur, nouvelle ligne**

> | D-21 | **Réserve de souffles** — réserve par séance et réserve par défaut de l'Homme Dragon, écrites par le MJ | FR-61 | Modérée — un chemin d'écriture MJ neuf, validations de règles côté serveur (capacité, souffles du temps, souffle d'une autre race), pas de lecture fan-out | à acter |

**D-7 (L451)** — ajouter en fin de cellule : « *Corrigée le 2026-09-25 : le catalogue manquant était celui de tous les souffles, communs compris ; porté par un content-type `souffle` distinct des éveils.* »

**§6 Hors périmètre, première puce (L472)**

OLD :
> **Suivi en jeu** (état, blessures, fiche vivante pendant la session), **y compris la réserve de souffles constituée en début de séance** par l'Homme Dragon. Reporté après la mise en production […]

NEW :
> **Suivi en jeu** (état, blessures, fiche vivante pendant la session), **y compris la consommation des souffles et des PS de l'Homme Dragon pendant la séance**. Reporté après la mise en production […] *(La réserve préparée avant la séance en est sortie le 2026-09-26 : FR-61.)*

**§6, puce « Un même Homme Dragon réutilisé sur plusieurs aventures » (L477)** — retirée du §6, remplacée par un renvoi : « *Planifié le 2026-09-26 : FR-63, story 33.8.* »

**§7, ligne Q-13 (L501)** — remplacer par : « *Close, corrigée le 2026-09-25.* Les six entrées seedées étaient les éveils ; les 21 souffles (9 communs, 12 de race) sont seedés par la 33.2. Réserve : FR-61. »

**§4.5 — note de règle (nouvelle, sous la description)** : « *Niveau : l'application compte les scénarios `PASSE` et non les séances jouées du livre (décision du 2026-09-25).* »

### 4.2 Épics — `epics.md`

**Inventaire (L70-72 et table FR → story L219-245)** — ajouter FR-61 → 33.6, FR-62 → 33.7, FR-63 → 33.8 ; corriger la ligne FR-26 : « Souffles communs et par race, seedés et affichés ».

**Note D-7 (L161)** et **notes d'implémentation de l'épic (L315)** — remplacer la phrase Q-13 par la version corrigée de FR-26.

**Épic 33, description et note (L1755-1757)**

OLD :
> *Q-13 tranchée le 2026-08-05 : les six souffles seedés sont les communs ; ceux propres à chaque race n'existent nulle part dans l'application. Aucun suivi de consommation — la réserve constituée en début de séance est du suivi en jeu, reporté après la mise en production.*

NEW :
> *Q-13 corrigée le 2026-09-25 : les six entrées seedées sont les éveils ; les 21 souffles (9 communs, 12 de race) sont seedés par la 33.2. Référence des règles : `docs/dragons.md`. Aucun décompte pendant la séance ; la réserve préparée avant la séance est portée par la 33.6. Le niveau compte les scénarios `PASSE` (décision du 2026-09-25).*

**Story 33.2** — AC2, ajouter : « **And** à partir du niveau 3, les souffles des trois autres races sont aussi consultables, dans un bloc replié (souffles multicolores) » (aligné sur la livraison et sur la décision utilisateur du 2026-09-25).

**Story 33.3** — ajouter l'AC :
> **Given** une étape de choix ou un champ du parcours
> **When** il s'affiche
> **Then** son texte vient du catalogue (`homme-dragon-creation-intros.json`, `homme-dragon-races.json` enregistrés dans `CONTENT_TYPES`), préférences de la race comprises

**Story 33.4** — AC2, remplacer « Then ils y figurent avec leur coût » par : « **Then** ils y figurent avec leur coût, lus depuis le catalogue `souffle` (les éveils restent listés à part) **And** si une réserve par défaut existe (33.6), elle y est imprimée ».

**Nouvelle story 33.6 : Réserve de souffles**

> As a MJ qui prépare sa séance,
> I want composer la réserve de souffles de mon dragon pour cette séance, à partir d'une réserve par défaut,
> So that je l'annonce à mes joueurs sans la recalculer à chaque fois.
>
> **Given** mon Homme Dragon est au niveau 1
> **When** j'ouvre une séance
> **Then** aucune réserve n'est proposée
>
> **Given** mon Homme Dragon est au niveau N ≥ 2
> **When** je compose une réserve (par défaut sur la fiche, ou pour une séance)
> **Then** elle compte au plus N − 1 emplacements, un même souffle pouvant en occuper plusieurs
> **And** les souffles du temps ne peuvent pas y être placés
> **And** à partir du niveau 3, au plus un souffle d'une autre race y figure ; avant, aucun
>
> **Given** une séance dont je n'ai pas composé la réserve
> **When** je l'ouvre
> **Then** elle affiche la réserve par défaut de la fiche
> **And** la modifier sur la séance ne change pas la réserve par défaut
>
> **Given** une réserve affichée
> **When** la séance a lieu
> **Then** l'application ne décompte rien
>
> **Given** un joueur de la partie ouvre la séance
> **When** elle s'affiche
> **Then** il n'y voit aucune réserve, et aucune réponse de l'API ne la lui transmet
>
> **Given** mon Homme Dragon est au niveau 5
> **When** je compose une réserve
> **Then** les souffles rituels peuvent y figurer, sans compter comme souffle d'une autre race
>
> **Given** la séance est ouverte sur un autre de mes appareils
> **When** je modifie la réserve
> **Then** cette vue se met à jour (signal temps réel de la partie)
>
> **Given** une réserve contenant un souffle retiré du catalogue
> **When** elle s'affiche
> **Then** elle reste lisible (repli sur la clé)
>
> *Décisions du 2026-09-29 :* réserve visible du MJ seul ; souffles rituels traités comme les autres souffles ; écran conçu par une passe `bmad-ux` avant la story. *Prérequis :* 33.7 (enregistre le catalogue des souffles rituels).

**Nouvelle story 33.7 : Capacités de niveau**

> As a MJ,
> I want voir ce que mon dragon a gagné en montant de niveau et choisir son artefact cadeau,
> So that je sache ce dont il est capable sans rouvrir le livre.
>
> **Given** mon Homme Dragon au niveau N
> **When** j'ouvre sa fiche
> **Then** les capacités acquises jusqu'au niveau N sont listées avec leur description (catalogue `homme-dragon-level-capacities.json` enregistré dans `CONTENT_TYPES`)
>
> **Given** mon Homme Dragon atteint le niveau 4
> **When** je choisis son artefact cadeau
> **Then** seuls les artefacts des trois autres races me sont proposés
> **And** une fois enregistré, le choix ne peut plus être modifié
> **And** l'artefact cadeau apparaît sur la fiche à côté de l'artefact principal
>
> **Given** mon Homme Dragon atteint le niveau 5
> **When** j'ouvre sa fiche
> **Then** les souffles rituels (catalogue `souffles-rituels.json`, enregistré sous la clé `souffleRituel`) sont consultables, avec leur description et le même coût que les autres souffles (1 PS)
>
> **Given** un Homme Dragon sous le niveau 4
> **When** sa fiche s'affiche
> **Then** aucun choix d'artefact cadeau n'est proposé

**Nouvelle story 33.8 : Un Homme Dragon pour plusieurs aventures** *(planifiée, après révision d'architecture)*

> As a MJ,
> I want que mon Homme Dragon suive plusieurs groupes et plusieurs mondes,
> So that son histoire et son niveau reflètent toutes les aventures qu'il a racontées.
>
> **Given** un Homme Dragon existant
> **When** je l'associe à une autre aventure Ryuutama dont je suis MJ
> **Then** il y apparaît comme Homme Dragon de cette aventure
> **And** son historique et son niveau cumulent les scénarios `PASSE` de toutes ses aventures
>
> **Given** les fiches existantes (un Homme Dragon par partie)
> **When** le nouveau modèle est livré
> **Then** chacune reste intacte et rattachée à sa partie
>
> *Prérequis :* décision d'architecture sur le modèle (unicité, rattachement, calcul du niveau), migration. Réserve de séance (33.6) : une séance reste dans une seule partie, donc un seul dragon — pas de conflit.

### 4.3 Architecture — `architecture/architecture-jdr-master-2026-08-04/ARCHITECTURE-SPINE.md`

**Ligne « Q-13 » des différés (L488)** — remplacer la justification par la version corrigée (éveils ≠ souffles, content-type `souffle`).

**Nouvelle décision AD-22 — Réserve de souffles : JSON sur la séance et dans la fiche**

> - **Décision :** la réserve d'une séance est un champ JSON nullable sur `Seance` (`reserveSouffles`, liste `{ key, count }`) ; la réserve par défaut vit dans `HommeDragon.sheetData.reserveParDefaut` (même forme). Une séance sans réserve affiche la réserve par défaut, **résolue à la lecture** (AD-3 : rien n'est recopié).
> - **Pourquoi :** configuration écrite d'un bloc depuis un écran unique, jamais interrogée par valeur → JSON (règle « JSON vs relationnel » du spine).
> - **Lecture :** MJ seul. `reserveSouffles` n'apparaît **jamais** dans les DTO de séance servis aux joueurs (même principe que `sheetVisibility`, jamais dans `PartieDto`) ; le signal temps réel ne porte aucune donnée.
> - **Écriture :** MJ seul (`getOwned`), validation serveur des règles de composition (capacité N − 1, `reservable: false` exclu, au plus un souffle d'une autre race à partir du niveau 3, souffles rituels admis au niveau 5) à partir des catalogues `souffle` et `souffleRituel` ; émission `partie:{id}` après écriture.
> - **Ne pas :** décompter quoi que ce soit ; recopier la réserve par défaut dans les séances.

*(AD-22 est une proposition ; l'architecte peut la réviser au démarrage de 33.6.)*

**Révision à prévoir (33.8)** — nouvelle AD sur le modèle multi-aventures, à ouvrir avec `bmad-architecture` avant la story.

### 4.4 UX

- Pas de modification des documents existants.
- **Décidé avant 33.6 (U-9) :** une passe `bmad-ux` pour l'écran de composition de la réserve (page de séance) et la réserve par défaut sur la fiche. 33.7 peut réutiliser les patrons existants (carte, `DetailSurface`, `ChoiceCard` de 33.3 pour l'artefact cadeau).

### 4.5 Autres artefacts

- `epics-p1-p3-ryuutama.md` (L75, L98, L158, L881) et `epics-palier8.md` (L38) : annoter « *NFR4 révisée le 2026-09-25 : contenu versionné, textes reformulés.* » — documents historiques, pas de réécriture.
- `sprint-status.yaml` : ajouter `33-6-reserve-de-souffles`, `33-7-capacites-de-niveau`, `33-8-un-homme-dragon-pour-plusieurs-aventures` en `backlog`.
- `deferred-work.md` : les items « Réserve de souffles », « Un même homme-dragon pour plusieurs groupes » et « Contenu déjà transcrit » sont absorbés par 33.3, 33.6, 33.7 et 33.8 → à archiver après approbation.

## 5. Transmission

**Portée : modérée** — réorganisation du backlog et amendements du PRD ; 33.8 relève d'une
révision d'architecture.

| Rôle | Responsabilité |
|---|---|
| Developer (cette session) | Appliquer les éditions ci-dessus au PRD, à `epics.md`, au spine, aux épics historiques ; mettre à jour `sprint-status.yaml` et archiver les items de `deferred-work.md`. |
| UX (`bmad-ux`) | Écran de réserve avant 33.6. |
| Architecte (`bmad-architecture`) | Valider AD-22 au démarrage de 33.6 ; ouvrir l'AD du modèle multi-aventures avant 33.8. |
| Developer (`bmad-build`) | 33.3 → 33.4 → 33.5 → 33.7 → (passe UX) → 33.6, puis 33.8 après l'AD. |

**Critères de réussite :** plus aucune mention « six souffles seedés = communs » dans les documents
actifs ; FR-61 à FR-63 tracés vers 33.6 à 33.8 ; `sprint-status.yaml` à jour ; §6 ne range plus la
réserve dans le hors-périmètre.

**Rappels :** passer en mode plan avant 33.6 et 33.8 ; `/security-review` sur 33.6 (nouveau chemin
d'écriture MJ) ; `/code-review` et `/security-review` encore dus sur 33.1 et 33.2.
